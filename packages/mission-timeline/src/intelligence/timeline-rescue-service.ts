import { sha256, stableStringify } from "../core/canonical.js";
import { extractPdf } from "./timeline-rescue-pdf.js";
import { extractPptx } from "./timeline-rescue-pptx.js";
import {
  TIMELINE_RESCUE_SCHEMA_VERSION,
  type RescueCleanupAction,
  type RescueCvCandidate,
  type RescueGeometry,
  type RescueReconciliationItem,
  type RescueSemanticCandidate,
  type RescueSourceEvidence,
  type RescueVisionObservation,
  type RescueVisualObject,
  type TimelineRescueCategoryId,
  type TimelineRescueFormat,
  type TimelineRescueResult,
  type TimelineRescueSource,
} from "./timeline-rescue-schema.js";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIMES = new Set(["image/png", "image/jpeg"]);
const KEYNOTE_GUIDANCE = "Using Keynote? In Keynote choose File > Export To > PowerPoint (preferred) or PDF, then upload the exported .pptx or .pdf here. Native .key parsing is not claimed or performed.";
const CATEGORY_LABELS = new Set(["education", "usmle", "clinical", "research", "work", "personal", "color key", "timeline"]);

interface DateEvidence {
  startDate: string;
  endDate: string | null;
  timelineKind: "duration" | "milestone";
  strippedText: string;
  explicit: boolean;
}

function detectFormat(source: TimelineRescueSource): TimelineRescueFormat {
  const filename = source.filename.toLowerCase();
  const mime = source.mimeType.toLowerCase();
  if (filename.endsWith(".key") || mime.includes("iwork-keynote") || mime.includes("x-keynote")) return "KEYNOTE";
  if (filename.endsWith(".pptx") || mime === PPTX_MIME) return "PPTX";
  if (filename.endsWith(".pdf") || mime === "application/pdf") return "PDF";
  if (/\.(png|jpe?g)$/.test(filename) || IMAGE_MIMES.has(mime)) return "IMAGE";
  throw new Error("TIMELINE_RESCUE_FORMAT_UNSUPPORTED");
}

function normalizedTitle(value: string): string {
  return value.replace(/[|•·]+/g, " ").replace(/\s+/g, " ").replace(/^[-–—:,;\s]+|[-–—:,;\s]+$/g, "").trim().slice(0, 500);
}

function datesFromText(value: string): DateEvidence | null {
  const range = value.match(/\b((?:19|20)\d{2})\s*(?:-|–|—|to|through)\s*((?:19|20)\d{2}|present|current)\b/i);
  if (range) {
    const startYear = Number(range[1]);
    const open = /present|current/i.test(range[2]!);
    const endYear = open ? null : Number(range[2]);
    if (!open && (endYear! < startYear || endYear! - startYear > 30)) return null;
    return {
      startDate: `${startYear}-01`,
      endDate: open ? null : `${endYear}-12`,
      timelineKind: "duration",
      strippedText: normalizedTitle(value.replace(range[0], " ")),
      explicit: true,
    };
  }
  const single = value.match(/\b((?:19|20)\d{2})\b/);
  if (!single) return null;
  return {
    startDate: `${single[1]}-01`, endDate: null, timelineKind: "milestone",
    strippedText: normalizedTitle(value.replace(single[0], " ")), explicit: true,
  };
}

function categoryFor(value: string): { categoryId: TimelineRescueCategoryId; reason: string; score: number } {
  const text = value.toLowerCase();
  if (/\b(usmle|step\s*[123]|ecfmg)\b/.test(text)) return { categoryId: "usmle", reason: "Explicit examination or ECFMG term.", score: 0.96 };
  if (/\b(research|publication|poster|abstract|manuscript|laboratory|lab)\b/.test(text)) return { categoryId: "res", reason: "Explicit research or publication term.", score: 0.9 };
  if (/\b(observership|externship|clerkship|rotation|clinical|elective|sub[- ]?internship)\b/.test(text)) return { categoryId: "cl", reason: "Explicit clinical experience term.", score: 0.88 };
  if (/\b(teaching hospital|residency|fellowship|house officer|internship)\b/.test(text)) return { categoryId: "th", reason: "Explicit hospital training term.", score: 0.88 };
  if (/\b(university|college|school|degree|graduat|medical education|award|honou?r)\b/.test(text)) return { categoryId: "education", reason: "Explicit education or honor term.", score: 0.86 };
  if (/\b(marriage|married|baby|birth|family|relocat|citizenship|green card|remembrance|loss)\b/.test(text)) return { categoryId: "personal", reason: "Explicit personal-life term.", score: 0.9 };
  if (/\b(work|employ|physician|assistant|coordinator|leadership|volunteer|service)\b/.test(text)) return { categoryId: "work", reason: "Explicit work, leadership, or service term.", score: 0.8 };
  return { categoryId: "unclassified", reason: "No reliable MissionMed category term was found.", score: 0.35 };
}

function evidenceFor(
  artifactSha256: string,
  format: Exclude<TimelineRescueFormat, "KEYNOTE">,
  object: RescueVisualObject,
  method: RescueSourceEvidence["extractionMethod"],
  support: RescueSourceEvidence["support"],
  confidence: number,
): RescueSourceEvidence {
  return {
    evidenceId: `rescue-evidence-${sha256(stableStringify({ artifactSha256, object: object.id, text: object.text, support })).slice(0, 20)}`,
    artifactSha256, format, pageOrSlide: object.pageOrSlide, objectId: object.id, extractionMethod: method,
    support, sourceText: object.text ?? "", geometry: object.geometry, confidence,
  };
}

function level(score: number): RescueSemanticCandidate["confidence"]["level"] {
  if (score >= 0.9) return "HIGH";
  if (score >= 0.75) return "MEDIUM";
  if (score >= 0.55) return "LOW";
  return "NEEDS_REVIEW";
}

function isFurnitureText(text: string): boolean {
  const normalized = normalizedTitle(text).toLowerCase();
  return !normalized || /^(?:19|20)\d{2}$/.test(normalized) || CATEGORY_LABELS.has(normalized) || normalized.length < 3;
}

function geometryDate(object: RescueVisualObject, years: Array<{ year: number; x: number }>): DateEvidence | null {
  const geometry = object.geometry;
  if (!geometry || years.length < 2) return null;
  const ordered = [...years].sort((a, b) => a.x - b.x);
  const center = geometry.x + geometry.width / 2;
  if (center < ordered[0]!.x - geometry.width || center > ordered.at(-1)!.x + geometry.width) return null;
  const nearest = (point: number) => ordered.reduce((best, item) => Math.abs(item.x - point) < Math.abs(best.x - point) ? item : best);
  const start = nearest(geometry.x).year;
  const end = nearest(geometry.x + geometry.width).year;
  return { startDate: `${Math.min(start, end)}-01`, endDate: start === end ? null : `${Math.max(start, end)}-12`, timelineKind: start === end ? "milestone" : "duration", strippedText: normalizedTitle(object.text ?? ""), explicit: false };
}

function candidatesFromObjects(
  artifactSha256: string,
  format: Exclude<TimelineRescueFormat, "KEYNOTE">,
  objects: RescueVisualObject[],
): { candidates: RescueSemanticCandidate[]; evidence: RescueSourceEvidence[]; unresolved: string[] } {
  const evidence: RescueSourceEvidence[] = [];
  const candidates: RescueSemanticCandidate[] = [];
  const unresolved: string[] = [];
  const yearsByPage = new Map<number, Array<{ year: number; x: number }>>();
  for (const object of objects) {
    const year = object.text?.trim().match(/^((?:19|20)\d{2})$/)?.[1];
    if (!year || !object.geometry) continue;
    const list = yearsByPage.get(object.pageOrSlide) ?? [];
    list.push({ year: Number(year), x: object.geometry.x + object.geometry.width / 2 });
    yearsByPage.set(object.pageOrSlide, list);
  }
  for (const object of objects) {
    if (!object.text || isFurnitureText(object.text)) continue;
    const explicit = datesFromText(object.text);
    const dateEvidence = explicit ?? (format === "PPTX" ? geometryDate(object, yearsByPage.get(object.pageOrSlide) ?? []) : null);
    if (!dateEvidence || !dateEvidence.strippedText) {
      if (categoryFor(object.text).categoryId !== "unclassified") unresolved.push(`Confirm dates for “${normalizedTitle(object.text)}” on ${format === "PPTX" ? "slide" : "page"} ${object.pageOrSlide}.`);
      continue;
    }
    const method: RescueSourceEvidence["extractionMethod"] = object.id.startsWith("vision-")
      ? "OCR_OR_VISION_OBSERVATION"
      : format === "PPTX" ? "PPTX_OOXML" : format === "PDF" ? "PDF_TEXT_OPERATOR" : "OCR_OR_VISION_OBSERVATION";
    const category = categoryFor(dateEvidence.strippedText);
    const sourceConfidence = method === "PPTX_OOXML" ? 0.98 : method === "PDF_TEXT_OPERATOR" ? 0.72 : (object.sourceConfidence ?? 0.75);
    const score = Math.min(sourceConfidence, category.score, dateEvidence.explicit ? 0.95 : 0.48);
    const sourceEvidence = evidenceFor(artifactSha256, format, object, method, dateEvidence.explicit ? (method === "OCR_OR_VISION_OBSERVATION" ? "VISION_OBSERVATION" : "SOURCE_FACT") : "GEOMETRY_INFERENCE", sourceConfidence);
    evidence.push(sourceEvidence);
    const uncertainties: string[] = [];
    if (!dateEvidence.explicit) uncertainties.push("Dates were inferred from object geometry against the visible year axis; confirm both dates.");
    if (category.categoryId === "unclassified") uncertainties.push("MissionMed category could not be established from the source text.");
    if (format !== "PPTX") uncertainties.push("Document/image extraction may not preserve original reading order or geometry.");
    candidates.push({
      id: `rescue-candidate-${sha256(stableStringify({ artifactSha256, evidenceId: sourceEvidence.evidenceId })).slice(0, 20)}`,
      title: dateEvidence.strippedText,
      categoryId: category.categoryId,
      timelineKind: dateEvidence.timelineKind,
      startDate: dateEvidence.startDate,
      endDate: dateEvidence.endDate,
      location: null,
      institution: null,
      confidence: { score, level: level(score), reasons: [category.reason, dateEvidence.explicit ? "Date is explicit in source text." : "Date is a geometry inference requiring confirmation."] },
      provenance: [sourceEvidence],
      uncertainties,
      reviewState: "REQUIRED",
      safeToAutoAccept: false,
    });
  }
  const unique = [...new Map(candidates.map((candidate) => [`${candidate.title.toLowerCase()}|${candidate.startDate}|${candidate.endDate ?? ""}`, candidate])).values()];
  return { candidates: unique, evidence, unresolved: [...new Set(unresolved)].slice(0, 100) };
}

function visualObjects(observations: RescueVisionObservation[] | undefined): RescueVisualObject[] {
  if (!observations) return [];
  return observations.slice(0, 2_000).flatMap((item, index) => {
    const text = String(item.text ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 2_000);
    const confidence = Number(item.confidence);
    if (!item.id || !text || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !Number.isInteger(item.pageOrSlide) || item.pageOrSlide < 1) return [];
    const raw = item.geometry;
    const geometry: RescueGeometry | null = raw && [raw.x, raw.y, raw.width, raw.height].every(Number.isFinite) && raw.width >= 0 && raw.height >= 0
      ? { x: raw.x, y: raw.y, width: raw.width, height: raw.height, unit: raw.unit ?? "NORMALIZED" }
      : null;
    return [{ id: `vision-${item.id}`, pageOrSlide: item.pageOrSlide, kind: "TEXT" as const, name: null, text, geometry, groupId: null, zIndex: index, fill: null, stroke: null, fontFamily: null, fontSizePt: null, relationshipTarget: null, mediaSha256: null, sourceConfidence: confidence }];
  });
}

function reconcile(timeline: RescueSemanticCandidate[], cv: RescueCvCandidate[]): RescueReconciliationItem[] {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const used = new Set<string>();
  const output: RescueReconciliationItem[] = [];
  for (const candidate of timeline) {
    const title = normalize(candidate.title);
    const match = cv.find((item) => !used.has(item.id) && (normalize(item.title) === title || normalize(item.title).includes(title) || title.includes(normalize(item.title))));
    if (!match) {
      output.push({ timelineCandidateId: candidate.id, cvCandidateId: null, state: "TIMELINE_ONLY", authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION", recommendation: "Keep as student intent only after the student confirms this fact; it is not corroborated by the supplied CV.", requiresReview: true });
      continue;
    }
    used.add(match.id);
    const state = match.startDate && (match.startDate !== candidate.startDate || (match.endDate ?? null) !== candidate.endDate)
      ? "DATE_CONFLICT"
      : match.categoryId && match.categoryId !== candidate.categoryId ? "CATEGORY_CONFLICT" : "MATCH";
    output.push({ timelineCandidateId: candidate.id, cvCandidateId: match.id, state, authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION", recommendation: state === "MATCH" ? "Source facts agree; review before importing." : "Use the CV as factual authority, show both values, and require an explicit student decision.", requiresReview: true });
  }
  for (const item of cv) if (!used.has(item.id)) output.push({ timelineCandidateId: null, cvCandidateId: item.id, state: "CV_ONLY", authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION", recommendation: "The CV contains this fact but the imported Timeline does not. Ask the student whether it belongs on the Timeline.", requiresReview: true });
  return output;
}

function cleanup(candidates: RescueSemanticCandidate[]): { authority: "MISSIONMED_D1_409H_CANONICAL_PRESENTATION"; mode: "PROPOSAL_ONLY"; factualMutationAllowed: false; actions: RescueCleanupAction[] } {
  const base: RescueCleanupAction[] = [
    { id: "rescue-cleanup-background", kind: "RESTORE_CANONICAL_BACKGROUND", scope: "PRESENTATION_ONLY", reason: "Imported geometry is evidence, but D1-409H remains the presentation authority.", candidateIds: [], requiresReview: true, changesBiography: false },
    { id: "rescue-cleanup-furniture", kind: "RESTORE_CANONICAL_FURNITURE", scope: "PRESENTATION_ONLY", reason: "Restore the protected title, year axis, Color Key, profile card, and MissionMed furniture.", candidateIds: [], requiresReview: true, changesBiography: false },
    { id: "rescue-cleanup-typography", kind: "NORMALIZE_TYPOGRAPHY", scope: "PRESENTATION_ONLY", reason: "Normalize imported text to the canonical MissionMed hierarchy without changing wording.", candidateIds: candidates.map((item) => item.id), requiresReview: true, changesBiography: false },
  ];
  for (const candidate of candidates) base.push({ id: `rescue-cleanup-${candidate.id}`, kind: "REBUILD_SEMANTIC_EVENT", scope: "PRESENTATION_ONLY", reason: "Rebuild this reviewed source item as an editable semantic Timeline event instead of preserving student slide geometry blindly.", candidateIds: [candidate.id], requiresReview: true, changesBiography: false });
  return { authority: "MISSIONMED_D1_409H_CANONICAL_PRESENTATION", mode: "PROPOSAL_ONLY", factualMutationAllowed: false, actions: base };
}

export function analyzeTimelineRescue(source: TimelineRescueSource, cvCandidates: RescueCvCandidate[] = []): TimelineRescueResult {
  const format = detectFormat(source);
  const artifactSha256 = sha256(source.bytes);
  if (format === "KEYNOTE") return {
    schemaVersion: TIMELINE_RESCUE_SCHEMA_VERSION, format, artifactSha256, extractionStatus: "UNSUPPORTED_KEYNOTE", slideOrPageCount: 0, slideSize: null,
    objects: [], evidence: [], candidates: [], cleanupProposal: cleanup([]), reconciliation: reconcile([], cvCandidates),
    warnings: ["Native .key parsing is intentionally not claimed because the production runtime has no reliable Keynote parser."],
    unresolvedQuestions: ["Export the Keynote file to PowerPoint or PDF, then upload that exported file."], keynoteGuidance: KEYNOTE_GUIDANCE,
    integrationHook: "SERVER_AUTHENTICATED_REVIEW_QUEUE",
  };

  let objects: RescueVisualObject[] = [];
  let slideOrPageCount = 1;
  let slideSize: TimelineRescueResult["slideSize"] = null;
  let extractionStatus: TimelineRescueResult["extractionStatus"] = "LIMITED";
  const warnings: string[] = [];
  if (format === "PPTX") {
    const pptx = extractPptx(source.bytes);
    objects = pptx.objects;
    slideOrPageCount = pptx.slideCount;
    slideSize = pptx.slideSize;
    extractionStatus = "STRUCTURED";
    warnings.push(...pptx.warnings);
  } else if (format === "PDF") {
    const pdf = extractPdf(source.bytes);
    objects = pdf.objects;
    slideOrPageCount = pdf.pageCount;
    warnings.push(...pdf.warnings);
    extractionStatus = objects.length ? "LIMITED" : "VISION_REQUIRED";
  } else {
    const png = source.bytes.byteLength >= 8 && Buffer.from(source.bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = source.bytes.byteLength >= 4 && source.bytes[0] === 0xff && source.bytes[1] === 0xd8 && source.bytes.at(-2) === 0xff && source.bytes.at(-1) === 0xd9;
    if (!png && !jpeg) throw new Error("TIMELINE_RESCUE_IMAGE_INVALID");
    extractionStatus = "VISION_REQUIRED";
    warnings.push("Image rescue requires authenticated server-side OCR/document vision; pixels alone are retained as visual reference, never converted into invented facts.");
  }
  const observed = visualObjects(source.visualObservations);
  if (observed.length) {
    objects.push(...observed);
    slideOrPageCount = Math.max(slideOrPageCount, ...observed.map((item) => item.pageOrSlide));
    if (format !== "PPTX") extractionStatus = "LIMITED";
  }
  const mapped = candidatesFromObjects(artifactSha256, format, objects);
  const unresolvedQuestions = [...mapped.unresolved];
  if (!mapped.candidates.length) unresolvedQuestions.unshift("No event was recovered with enough source support. Provide a clearer export or answer a targeted review question; no facts were invented.");
  if ((format === "IMAGE" || (format === "PDF" && !objects.length)) && !observed.length) unresolvedQuestions.unshift("Run authenticated OCR/document vision before semantic rescue.");
  return {
    schemaVersion: TIMELINE_RESCUE_SCHEMA_VERSION, format, artifactSha256, extractionStatus, slideOrPageCount, slideSize,
    objects, evidence: mapped.evidence, candidates: mapped.candidates, cleanupProposal: cleanup(mapped.candidates), reconciliation: reconcile(mapped.candidates, cvCandidates),
    warnings: [...new Set(warnings)], unresolvedQuestions: [...new Set(unresolvedQuestions)], keynoteGuidance: null,
    integrationHook: "SERVER_AUTHENTICATED_REVIEW_QUEUE",
  };
}

export { KEYNOTE_GUIDANCE };
