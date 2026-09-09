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
  precision: { start: "MONTH" | "YEAR"; end: "MONTH" | "YEAR" | null };
  uncertainties: string[];
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

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_TOKEN = "(?:(?:19|20)\\d{2}-(?:0[1-9]|1[0-2])|(?:0?[1-9]|1[0-2])/(?:19\\d{2}|20\\d{2}|\\d{2})|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2})";
const DATE_RANGE = new RegExp(`\\b(${DATE_TOKEN})\\s*(?:-|–|—|to|through)\\s*(${DATE_TOKEN}|present|current|ongoing)\\b`, "i");
const DATE_SINGLE = new RegExp(`\\b(${DATE_TOKEN})\\b`, "i");

function datePoint(raw: string, edge: "start" | "end", axisYears: number[]): { date: string; precision: "MONTH" | "YEAR"; uncertainties: string[] } {
  const uncertainties: string[] = [];
  const iso = raw.match(/^((?:19|20)\d{2})-(\d{2})$/);
  if (iso) return { date: raw, precision: "MONTH", uncertainties };
  const numeric = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (numeric) {
    const shortYear = numeric[2]!;
    let year = Number(shortYear);
    if (shortYear.length === 2) {
      const matches = [...new Set(axisYears.filter(value => value % 100 === year))];
      if (matches.length === 1) year = matches[0]!;
      else {
        year += 2000;
        uncertainties.push(`Two-digit year ${shortYear} is displayed as ${year}; confirm the century because the visible year axis does not establish it.`);
      }
    }
    return { date: `${year}-${numeric[1]!.padStart(2, "0")}`, precision: "MONTH", uncertainties };
  }
  const named = raw.match(/^([a-z]+)\.?\s+((?:19|20)\d{2})$/i);
  if (named) return { date: `${named[2]}-${String(MONTHS.indexOf(named[1]!.slice(0, 3).toLowerCase()) + 1).padStart(2, "0")}`, precision: "MONTH", uncertainties };
  uncertainties.push(`Source date ${raw} has year-only precision; ${edge === "start" ? "January" : "December"} is a positioning placeholder, not a source-backed month.`);
  return { date: `${raw}-${edge === "start" ? "01" : "12"}`, precision: "YEAR", uncertainties };
}

function datesFromText(value: string, axisYears: number[] = []): DateEvidence | null {
  // A malformed or incomplete visible range must not degrade into a different date.
  if ([...value.matchAll(/\b(\d{1,2})\/(\d{2,4})\b/g)].some(match => Number(match[1]) < 1 || Number(match[1]) > 12)) return null;
  if ([...value.matchAll(/\b(?:19|20)\d{2}-(\d{2})(?!\d)/g)].some(match => Number(match[1]) < 1 || Number(match[1]) > 12)) return null;
  const range = value.match(DATE_RANGE);
  if (range) {
    const start = datePoint(range[1]!, "start", axisYears);
    const open = /^(?:present|current|ongoing)$/i.test(range[2]!);
    const end = open ? null : datePoint(range[2]!, "end", axisYears);
    if (end && (end.date < start.date || Number(end.date.slice(0, 4)) - Number(start.date.slice(0, 4)) > 100)) return null;
    return { startDate: start.date, endDate: end?.date ?? null, timelineKind: "duration",
      strippedText: normalizedTitle(value.replace(range[0], " ")), explicit: true,
      precision: { start: start.precision, end: end?.precision ?? null }, uncertainties: [...start.uncertainties, ...(end?.uncertainties ?? [])] };
  }
  const single = value.match(DATE_SINGLE);
  if (!single) return null;
  if (/^\s*(?:-|–|—|to\b|through\b)\s*$/.test(value.slice(single.index! + single[0].length))) return null;
  const start = datePoint(single[1]!, "start", axisYears);
  return { startDate: start.date, endDate: null, timelineKind: "milestone",
    strippedText: normalizedTitle(value.replace(single[0], " ")), explicit: true,
    precision: { start: start.precision, end: null }, uncertainties: start.uncertainties };
}

function categoryFor(value: string): { categoryId: TimelineRescueCategoryId; reason: string; score: number } {
  const text = value.toLowerCase();
  if (/\b(usmle|step\s*[123]|ecfmg)\b/.test(text)) return { categoryId: "usmle", reason: "Explicit examination or ECFMG term.", score: 0.96 };
  if (/\b(research|publication|poster|abstract|manuscript|laboratory|lab)\b/.test(text)) return { categoryId: "res", reason: "Explicit research or publication term.", score: 0.9 };
  if (/\b(observership|externship|clerkship|rotation|clinical|elective|sub[- ]?internship)\b/.test(text)) return { categoryId: "cl", reason: "Explicit clinical experience term.", score: 0.88 };
  if (/\b(teaching hospital|residency|fellowship|house officer|internship)\b/.test(text)) return { categoryId: "th", reason: "Explicit hospital training term.", score: 0.88 };
  if (/\b(university|college|school|degree|graduat|medical education|award|honou?r)\b/.test(text)) return { categoryId: "education", reason: "Explicit education or honor term.", score: 0.86 };
  if (/\b(marriage|married|baby|birth|family|relocat(?:e|ed|es|ing|ion)?|citizenship|green card|remembrance|loss)\b/.test(text)) return { categoryId: "personal", reason: "Explicit personal-life term.", score: 0.9 };
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
  if (yearRibbonValues(normalized).length) return true;
  if (!normalized || /^(?:19|20)\d{2}$/.test(normalized) || CATEGORY_LABELS.has(normalized) || normalized.length < 3) return true;
  if (/^timeline\s*:/.test(normalized)) return true;
  if (/^step\s*[123](?:\s*ck)?\s*:\s*(?:pass(?:ed)?|fail(?:ed)?|\d{3})$/i.test(normalized)) return true;
  if (/^(?:work experience|personal \(not on cv\)|usmle studies|usce|clinical experience|research experience|teaching hospital|color key|medical school:.*|degree:.*|specialty:.*)$/.test(normalized)) return true;
  if (/^color key\b/.test(normalized) && /\bwork experience\b/.test(normalized) && /\busmle studies\b/.test(normalized)) return true;
  if (/\bmedical school\s*:/.test(normalized) && /\bdegree\s*:/.test(normalized)) return true;
  if (/\b(?:synthetic|non-student)\b.*\bqa fixture\b/.test(normalized)) return true;
  return false;
}

function yearRibbonValues(text: string): number[] {
  const normalized = text.replace(/[|•·,]/g, " ").trim();
  return /^(?:(?:19|20)\d{2}\s+){2,}(?:19|20)\d{2}$/.test(normalized)
    ? normalized.split(/\s+/).map(Number) : [];
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
  return { startDate: `${Math.min(start, end)}-01`, endDate: start === end ? null : `${Math.max(start, end)}-12`, timelineKind: start === end ? "milestone" : "duration", strippedText: normalizedTitle(object.text ?? ""), explicit: false, precision: { start: "YEAR", end: start === end ? null : "YEAR" }, uncertainties: [] };
}

/** Associate visible native runs, never the hidden export baseline. Ambiguous
 * formatting remains combined for review instead of guessing an institution. */
function visibleEventTextRoles(group: RescueVisualObject, sources: RescueVisualObject[]) {
  const dateOnly = (object: RescueVisualObject) => datesFromText(object.text ?? "")?.strippedText === "";
  const words = sources.filter(object => !dateOnly(object));
  const readingOrder = (items: RescueVisualObject[]) => [...items].sort((a,b) =>
    (a.geometry && b.geometry ? a.geometry.y-b.geometry.y || a.geometry.x-b.geometry.x : 0) || a.zIndex-b.zIndex);
  const textOf = (items: RescueVisualObject[]) => normalizedTitle(readingOrder(items).map(item => item.text).join(" "));
  const explicitTitles = words.filter(item => /^MM:event:.*:title(?::[^:]*)?$/.test(item.name ?? ""));
  const explicitSites = words.filter(item => /^MM:event:.*:site(?::[^:]*)?$/.test(item.name ?? ""));
  if (explicitTitles.length && explicitTitles.length+explicitSites.length === words.length) {
    return { title: textOf(explicitTitles), institution: textOf(explicitSites) || null, inferred: false };
  }
  // The current editable export uses paint IDs. Its duration title is larger and
  // bold; the regular institution run is below it. Do not impose this convention
  // on generic imports, milestone wraps, mixed styles, or same-size text.
  if (group.semanticRole !== "event" || words.length < 2 ||
      !sources.some(item => dateOnly(item) && datesFromText(item.text!)?.timelineKind === "duration")) return null;
  const sizes = [...new Set(words.map(item => item.fontSizePt))];
  if (sizes.length !== 2 || sizes.some(size => size === null || size <= 0)) return null;
  const largest = Math.max(...sizes as number[]);
  const titles = words.filter(item => item.fontSizePt === largest);
  const sites = words.filter(item => item.fontSizePt !== largest);
  if (!titles.every(item => item.fontBold === true && item.geometry) ||
      !sites.every(item => item.fontBold !== true && item.geometry) ||
      !sites.every(site => titles.every(title => site.geometry!.y >= title.geometry!.y+title.geometry!.height*.75))) return null;
  return { title: textOf(titles), institution: textOf(sites), inferred: true };
}

const VISIBLE_ROLE = /\b(?:doctor of medicine|bachelor|master|mbbs|m\.d\.|degree|resident physician|physician|research (?:assistant|fellow|associate)|observership|externship|clinical (?:elective|rotation)|clerkship|volunteer|internship|fellowship)\b/i;
const VISIBLE_INSTITUTION = /\b(?:hospital|clinic|university|college|school|institute|laboratory|lab|centre|center|foundation|association|red cross)\b/i;

function visualObservationTextRoles(object: RescueVisualObject) {
  if (!object.id.startsWith("vision-") || !object.geometry || object.geometry.width <= 0 || object.geometry.height <= 0) return null;
  const lines = (object.text ?? "").split(/\n/).map(line => line.trim()).filter(Boolean);
  const dateLines = lines.filter(line => datesFromText(line)?.strippedText === "");
  if (dateLines.length !== 1 || datesFromText(dateLines[0]!)?.timelineKind !== "duration") return null;
  const words = lines.filter(line => !dateLines.includes(line));
  if (words.length < 2 || words.some(line => datesFromText(line))) return null;
  // A single observed box and preserved reading order support a proposed role/site
  // split. Do not split a wrapped milestone, a title without a recognizable role,
  // or an unlabelled continuation merely because it occupies another line.
  if (!VISIBLE_ROLE.test(words[0]!)) return null;
  const siteStart = words.findIndex((line,index) => index > 0 && VISIBLE_INSTITUTION.test(line));
  if (siteStart < 1) return null;
  return { title: normalizedTitle(words.slice(0,siteStart).join(" ")), institution: normalizedTitle(words.slice(siteStart).join(" ")), inferred: true };
}

/** A vision provider can segment one visible row into separate date/title/site
 * boxes. Associate only an unambiguous adjacent row; geometry links explicitly
 * observed text and never supplies the date itself. Keep all original objects. */
function visualDurationRows(objects: RescueVisualObject[]) {
  const visible=objects.filter(object=>object.id.startsWith('vision-')&&object.text&&object.geometry&&object.geometry.width>0&&object.geometry.height>0);
  const dates=visible.filter(object=>{
    const date=datesFromText(object.text!);
    return date?.timelineKind==='duration'&&date.strippedText==='';
  });
  const titles=visible.filter(object=>!object.text!.includes('\n')&&!datesFromText(object.text!)&&!isFurnitureText(object.text!)&&VISIBLE_ROLE.test(object.text!));
  const sites=visible.filter(object=>!datesFromText(object.text!)&&!isFurnitureText(object.text!)&&VISIBLE_INSTITUTION.test(object.text!)&&!VISIBLE_ROLE.test(object.text!));
  const adjacent=(upper:RescueVisualObject,lower:RescueVisualObject)=>{
    const a=upper.geometry!,b=lower.geometry!;
    if(upper.pageOrSlide!==lower.pageOrSlide||a.unit!==b.unit)return false;
    const gap=b.y-(a.y+a.height),horizontalGap=Math.max(a.x-b.x-b.width,b.x-a.x-a.width,0);
    return gap>=-1e-8&&gap<=Math.max(a.height,b.height)*1.5&&horizontalGap<=Math.max(a.width,b.width)*.4;
  };
  const proposals: Array<{date:RescueVisualObject;title:RescueVisualObject;site:RescueVisualObject}>=[];
  for(const date of dates){
    const matchingTitles=titles.filter(title=>adjacent(date,title));
    if(matchingTitles.length!==1)continue;
    const title=matchingTitles[0]!;
    const matchingSites=sites.filter(site=>adjacent(title,site)&&site.pageOrSlide===date.pageOrSlide&&site.geometry!.unit===date.geometry!.unit&&
      Math.min(site.geometry!.x+site.geometry!.width,date.geometry!.x+date.geometry!.width)>Math.max(site.geometry!.x,date.geometry!.x));
    if(matchingSites.length===1)proposals.push({date,title,site:matchingSites[0]!});
  }
  return proposals.filter(row=>proposals.filter(other=>other.title.id===row.title.id||other.site.id===row.site.id).length===1).map(({date,title,site})=>{
    const sources=[date,title,site],boxes=sources.map(object=>object.geometry!);
    const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
    const object:RescueVisualObject={...date,id:`vision-row-${date.id}`,text:sources.map(source=>source.text).join('\n'),
      geometry:{x,y,width:Math.max(...boxes.map(box=>box.x+box.width))-x,height:Math.max(...boxes.map(box=>box.y+box.height))-y,unit:date.geometry!.unit},
      sourceConfidence:Math.min(...sources.map(source=>source.sourceConfidence??.5))};
    return {object,sources,roles:{title:normalizedTitle(title.text!),institution:normalizedTitle(site.text!),inferred:true}};
  });
}

/** Join a date immediately left of one observed milestone label. Both directions
 * must be unique: overlapping rows, rival dates, pages and furniture stay apart.
 * Geometry associates visible text; it never creates a date or a category. */
function visualMilestoneRows(objects: RescueVisualObject[]) {
  const visible=objects.filter(object=>object.id.startsWith('vision-')&&object.text&&object.geometry&&object.geometry.width>0&&object.geometry.height>0);
  const dates=visible.filter(object=>{
    const date=datesFromText(object.text!);
    return date?.timelineKind==='milestone'&&date.strippedText==='';
  });
  const titles=visible.filter(object=>!datesFromText(object.text!)&&!isFurnitureText(object.text!)&&
    !/^(?:step\s*[123](?:\s*ck)?\s*:|program logo|profile photo|drop photo|your big interview|date pending)/i.test(object.text!.trim()));
  const adjacent=(date:RescueVisualObject,title:RescueVisualObject)=>{
    const a=date.geometry!,b=title.geometry!;
    if(date.pageOrSlide!==title.pageOrSlide||a.unit!==b.unit)return false;
    const gap=b.x-(a.x+a.width),overlap=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    return gap>=-1e-8&&gap<=Math.min(a.height,b.height)*.75&&
      Math.abs(a.y-b.y)<=Math.min(a.height,b.height)*.35&&overlap>=Math.min(a.height,b.height)*.65;
  };
  return dates.flatMap(date=>{
    const matches=titles.filter(title=>adjacent(date,title));
    if(matches.length!==1||dates.filter(other=>adjacent(other,matches[0]!)).length!==1)return [];
    const title=matches[0]!,a=date.geometry!,b=title.geometry!;
    const sources=[date,title];
    // One known wrapped exam label may split after "Step 2". Join only the
    // explicit CK/result line directly below the same left edge, never a score
    // elsewhere in the profile or an arbitrary neighboring line.
    if(/^USMLE\s+Step\s+2$/i.test(title.text!.trim())){
      const continuations=visible.filter(other=>{
        if(!/^CK(?:\s*[-–:]\s*(?:\d{3}|Pass(?:ed)?|Fail(?:ed)?))?$/i.test(other.text!.trim()))return false;
        const c=other.geometry!,gap=c.y-(b.y+b.height);
        return other.pageOrSlide===title.pageOrSlide&&c.unit===b.unit&&Math.abs(c.x-b.x)<=Math.min(c.height,b.height)*.25&&
          gap>=0&&gap<=Math.min(c.height,b.height)*.5;
      });
      if(continuations.length===1)sources.push(continuations[0]!);
    }
    const boxes=sources.map(source=>source.geometry!);
    const object:RescueVisualObject={...date,id:`vision-milestone-${date.id}`,text:sources.map(source=>source.text).join('\n'),
      geometry:{x:a.x,y:Math.min(...boxes.map(box=>box.y)),width:Math.max(...boxes.map(box=>box.x+box.width))-a.x,
        height:Math.max(...boxes.map(box=>box.y+box.height))-Math.min(...boxes.map(box=>box.y)),unit:a.unit},
      sourceConfidence:Math.min(...sources.map(source=>source.sourceConfidence??.5))};
    return [{object,sources,roles:{title:normalizedTitle(sources.slice(1).map(source=>source.text).join(' ')),institution:null,inferred:true}}];
  });
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
  const ribbonYearsByPage = new Map<number, number[]>();
  for (const object of objects) {
    const ribbon = yearRibbonValues(object.text ?? "");
    if (ribbon.length) ribbonYearsByPage.set(object.pageOrSlide,[...(ribbonYearsByPage.get(object.pageOrSlide) ?? []),...ribbon]);
    const year = object.text?.trim().match(/^((?:19|20)\d{2})$/)?.[1];
    if (!year || !object.geometry) continue;
    const list = yearsByPage.get(object.pageOrSlide) ?? [];
    list.push({ year: Number(year), x: object.geometry.x + object.geometry.width / 2 });
    yearsByPage.set(object.pageOrSlide, list);
  }
  const visibleYears = (page: number) => [...(yearsByPage.get(page) ?? []).map(item=>item.year),...(ribbonYearsByPage.get(page) ?? [])];
  const byId = new Map(objects.map(object => [object.id, object]));
  const ancestry = (object: RescueVisualObject): RescueVisualObject[] => {
    const parents: RescueVisualObject[] = [], seen = new Set<string>();
    let parentId = object.groupId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent || parent.pageOrSlide !== object.pageOrSlide) break;
      parents.push(parent); parentId = parent.groupId;
    }
    return parents;
  };
  const ignored = (object: RescueVisualObject) => [object, ...ancestry(object)].some(item => item.semanticRole && item.semanticRole !== "event");
  const grouped = new Set<string>();
  const units: Array<{ object: RescueVisualObject; sources: RescueVisualObject[]; roles?: ReturnType<typeof visibleEventTextRoles> }> = [];
  // Join visible title/site/date runs only inside one native event group. Invisible
  // customXml facts are deliberately not substituted for text edited in PowerPoint.
  for (const group of objects.filter(object => object.kind === "GROUP" && !ignored(object))) {
    const sources = objects.filter(object => object.text && !ignored(object) && ancestry(object).some(parent => parent.id === group.id));
    if (!sources.length || sources.some(object => grouped.has(object.id))) continue;
    const hasSeparateDate = sources.some(object => {
      const date = datesFromText(object.text!, visibleYears(object.pageOrSlide));
      return date && !date.strippedText;
    });
    if (group.semanticRole !== "event" && !hasSeparateDate) continue;
    const usable = sources.filter(object => !isFurnitureText(object.text!) || Boolean(datesFromText(object.text!)?.strippedText === ""));
    if (!usable.length) continue;
    const combined = { ...group, text: usable.sort((a, b) => a.zIndex-b.zIndex).map(object => object.text).join("\n") };
    units.push({ object: combined, sources: usable, roles: visibleEventTextRoles(group, usable) });
    sources.forEach(object => grouped.add(object.id));
  }
  if(format!=='PPTX')for(const row of visualDurationRows(objects.filter(object=>!ignored(object)&&!grouped.has(object.id)))){
    units.push(row);row.sources.forEach(object=>grouped.add(object.id));
  }
  if(format!=='PPTX')for(const row of visualMilestoneRows(objects.filter(object=>!ignored(object)&&!grouped.has(object.id)))){
    units.push(row);row.sources.forEach(object=>grouped.add(object.id));
  }
  units.push(...objects.filter(object => object.text && !ignored(object) && !grouped.has(object.id)).map(object => ({ object, sources: [object], roles: visualObservationTextRoles(object) })));
  for (const { object, sources, roles } of units) {
    if (!object.text || isFurnitureText(object.text)) continue;
    const axisYears = visibleYears(object.pageOrSlide);
    const explicit = datesFromText(object.text, axisYears);
    const visibleDateNotation = /\b\d{1,2}\/\d{2,4}\b|\b(?:19|20)\d{2}\b/.test(object.text);
    const dateEvidence = explicit ?? (format === "PPTX" && !visibleDateNotation ? geometryDate(object, yearsByPage.get(object.pageOrSlide) ?? []) : null);
    if (!dateEvidence || !dateEvidence.strippedText) {
      if (categoryFor(object.text).categoryId !== "unclassified") unresolved.push(`Confirm dates for “${normalizedTitle(object.text)}” on ${format === "PPTX" ? "slide" : "page"} ${object.pageOrSlide}.`);
      continue;
    }
    const method: RescueSourceEvidence["extractionMethod"] = object.id.startsWith("vision-")
      ? "OCR_OR_VISION_OBSERVATION"
      : format === "PPTX" ? "PPTX_OOXML" : format === "PDF" ? "PDF_TEXT_OPERATOR" : "OCR_OR_VISION_OBSERVATION";
    const title = roles?.title || dateEvidence.strippedText;
    const titleCategory = categoryFor(title);
    const category = titleCategory.categoryId === "unclassified" ? categoryFor(dateEvidence.strippedText) : titleCategory;
    const sourceConfidence = method === "PPTX_OOXML" ? 0.98 : method === "PDF_TEXT_OPERATOR" ? 0.72 : (object.sourceConfidence ?? 0.75);
    const score = Math.min(sourceConfidence, category.score, roles?.inferred ? 0.74 : 1, dateEvidence.explicit ? (dateEvidence.uncertainties.length ? 0.7 : 0.95) : 0.48);
    const support = dateEvidence.explicit ? (method === "OCR_OR_VISION_OBSERVATION" ? "VISION_OBSERVATION" : "SOURCE_FACT") : "GEOMETRY_INFERENCE";
    const provenance = sources.map(source => evidenceFor(artifactSha256, format, source, method, support, sourceConfidence));
    evidence.push(...provenance);
    const uncertainties = [...dateEvidence.uncertainties];
    if (roles?.inferred) uncertainties.push(object.id.startsWith("vision-")
      ? sources.length>1?(roles.institution?"Date, title and institution were associated using adjacent observed text boxes; confirm this row against the source.":"The visible date and milestone label were associated using adjacent observed text boxes; confirm them against the source."):"Title and institution were separated using the observed source lines inside one visual region; confirm their roles against the source."
      : "Title and institution were separated using visible text size and placement; confirm their roles.");
    if (!dateEvidence.explicit) uncertainties.push("Dates were inferred from object geometry against the visible year axis; confirm both dates.");
    if (category.categoryId === "unclassified") uncertainties.push("MissionMed category could not be established from the source text.");
    if (format !== "PPTX") uncertainties.push("Document/image extraction may not preserve original reading order or geometry.");
    candidates.push({
      id: `rescue-candidate-${sha256(stableStringify({ artifactSha256, evidenceIds: provenance.map(item => item.evidenceId) })).slice(0, 20)}`,
      title,
      categoryId: category.categoryId,
      timelineKind: dateEvidence.timelineKind,
      startDate: dateEvidence.startDate,
      endDate: dateEvidence.endDate,
      openEnded: dateEvidence.explicit && dateEvidence.timelineKind === "duration" && dateEvidence.endDate === null,
      datePrecision: dateEvidence.precision,
      location: null,
      institution: roles?.institution ?? null,
      confidence: { score, level: level(score), reasons: [category.reason, dateEvidence.explicit ? "Date text is present in the source; any missing precision remains listed for review." : "Date is a geometry inference requiring confirmation."] },
      provenance,
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
    // Line boundaries are provider-observed structure, needed to distinguish a
    // role from its institution. Retain them in source evidence as well as parsing.
    const text = String(item.text ?? "").replace(/\r\n?/g,"\n").replace(/[\u0000-\u0009\u000b-\u001f]/g, " ")
      .split("\n").map(line=>line.replace(/[^\S\n]+/g," ").trim()).filter(Boolean).join("\n").trim().slice(0, 2_000);
    const confidence = Number(item.confidence);
    if (!item.id || !text || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !Number.isInteger(item.pageOrSlide) || item.pageOrSlide < 1) return [];
    const raw = item.geometry;
    const geometry: RescueGeometry | null = raw && [raw.x, raw.y, raw.width, raw.height].every(Number.isFinite) && raw.width >= 0 && raw.height >= 0
      ? { x: raw.x, y: raw.y, width: raw.width, height: raw.height, unit: raw.unit ?? "NORMALIZED" }
      : null;
    return [{ id: `vision-${item.id}`, pageOrSlide: item.pageOrSlide, kind: "TEXT" as const, name: null, text, geometry, groupId: null, zIndex: index, fill: null, stroke: null, fontFamily: null, fontSizePt: null, relationshipTarget: null, mediaSha256: null, sourceConfidence: confidence }];
  });
}

function attachVisibleProfileClaims(
  artifactSha256: string,
  format: Exclude<TimelineRescueFormat, "KEYNOTE">,
  objects: RescueVisualObject[],
  candidates: RescueSemanticCandidate[],
) {
  const evidence: RescueSourceEvidence[] = [], unresolved: string[] = [];
  const visible = objects.filter(object => object.text && object.geometry && object.geometry.width > 0 && object.geometry.height > 0);
  const medical = candidates.filter(candidate => /\b(?:doctor of medicine|doctor of osteopathic medicine|medical degree|mbbs|mbchb|mbbch)\b/i.test(candidate.title));
  if (medical.length !== 1) return { evidence, unresolved };
  const target = medical[0]!;
  const pages = new Set(target.provenance.map(item => item.pageOrSlide));
  const pageObjects = visible.filter(object => pages.has(object.pageOrSlide));
  const personalName = (value: string) => {
    const clean = normalizedTitle(value);
    return /^[\p{L}][\p{L}\p{M}'’.\-]*(?:\s+[\p{L}][\p{L}\p{M}'’.\-]*){1,5}$/u.test(clean) &&
      !isFurnitureText(clean)&&!/\b(?:your journey|timeline|synthetic|profile|photo|university|medicine|school|college|pharmacy|hospital|interview|degree|research)\b/i.test(clean) ? clean : null;
  };
  const names: Array<{value: string; object: RescueVisualObject; anchor: "title" | "profile"}> = [];
  const degrees: Array<{value: string; object: RescueVisualObject}> = [];
  // A complete multiline profile already has its own name line. Its whole-box
  // height must not turn distant Color Key labels into neighboring names.
  const schoolObjects = pageObjects.filter(object => /^medical school\s*:/i.test(object.text!));
  for (const object of pageObjects) {
    const lines = object.text!.split(/\n/).map(line => line.trim()).filter(Boolean);
    for (const line of lines) {
      const title = line.match(/^timeline\s*:\s*(.+)$/i);
      if (title && personalName(title[1]!)) names.push({value:personalName(title[1]!)!,object,anchor:"title"});
      const degree = line.match(/^degree\s*:\s*(MD|DO|MBBS|MBCHB|MBBCH)\s*$/i);
      if (degree) degrees.push({value:degree[1]!.toUpperCase(),object});
    }
    const profileLine = lines.findIndex(line => /^medical school\s*:/i.test(line));
    if (profileLine > 0 && personalName(lines[profileLine-1]!)) names.push({value:personalName(lines[profileLine-1]!)!,object,anchor:"profile"});
    if (lines.length !== 1 || !personalName(lines[0]!)) continue;
    const box = object.geometry!;
    const aboveSchool = schoolObjects.some(school => {
      const other = school.geometry!;
      const gap = other.y-(box.y+box.height);
      return school.pageOrSlide === object.pageOrSlide && other.unit === box.unit &&
        Math.abs(other.x-box.x) <= Math.max(box.height,other.height)*.5 &&
        gap >= -box.height*.25 && gap <= Math.max(box.height,other.height)*1.5;
    });
    if (object.semanticRole === "profile" || aboveSchool) names.push({value:personalName(lines[0]!)!,object,anchor:"profile"});
  }
  const claimEvidence = (sources: RescueVisualObject[]) => [...new Map(sources.map(object => [object.id,object])).values()].map(object => {
    const vision = object.id.startsWith("vision-");
    const entry = evidenceFor(artifactSha256,format,object,vision?"OCR_OR_VISION_OBSERVATION":format==="PPTX"?"PPTX_OOXML":"PDF_TEXT_OPERATOR",vision?"VISION_OBSERVATION":"SOURCE_FACT",vision?(object.sourceConfidence??.5):format==="PPTX"?.98:.72);
    evidence.push(entry);return entry;
  });
  const profileClaims: NonNullable<RescueSemanticCandidate["profileClaims"]> = {};
  const uniqueNames = new Set(names.map(item => item.value.toLocaleLowerCase()));
  if (uniqueNames.size > 1) unresolved.push("Visible Timeline header and profile names disagree. Confirm the profile name; no name was prefilled.");
  else if (uniqueNames.size === 1 && names.some(item=>item.anchor==="title") && names.some(item=>item.anchor==="profile")) {
    profileClaims.fullName={value:names[0]!.value,provenance:claimEvidence(names.map(item=>item.object))};
  }
  const uniqueDegrees = new Set(degrees.map(item=>item.value));
  const titleDegree = /\bdoctor of osteopathic medicine\b/i.test(target.title)?"DO":/\bdoctor of medicine\b/i.test(target.title)?"MD":target.title.match(/\b(MBBS|MBCHB|MBBCH)\b/i)?.[1]?.toUpperCase();
  if (uniqueDegrees.size > 1 || (uniqueDegrees.size===1 && titleDegree && !uniqueDegrees.has(titleDegree))) unresolved.push("Visible profile degree and medical-education title disagree. Confirm the degree; no credential was prefilled.");
  else if (uniqueDegrees.size === 1) profileClaims.degree={value:degrees[0]!.value,provenance:claimEvidence(degrees.map(item=>item.object))};
  if (Object.keys(profileClaims).length) target.profileClaims=profileClaims;
  target.uncertainties.push(...unresolved);
  return { evidence, unresolved };
}

const RESCUE_CATEGORY_ALIASES: Record<string,string> = {
  education:'education',usmle:'exams',exam:'exams',exams:'exams',
  th:'clinical',cl:'clinical',clinical:'clinical',usce:'clinical',us_clinical:'clinical',
  res:'research',research:'research',research_awards:'research',work:'work',personal:'personal',unclassified:'unclassified',
};
const RESCUE_CATEGORY_NAMES: Record<string,string> = {education:'Education',exams:'Exams',clinical:'Clinical',research:'Research',work:'Work',personal:'Personal',unclassified:'Not established from the Timeline text'};
const comparisonCategory=(value:string)=>RESCUE_CATEGORY_ALIASES[value.trim().toLowerCase()]??value.trim().toLowerCase();
const categoryName=(value:string)=>RESCUE_CATEGORY_NAMES[comparisonCategory(value)]??(value.trim()||'Not recorded');
const asRecord=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

/** Applied, explicitly CV-typed history only. A Rescue import or untyped legacy
 * draft cannot become a CV source merely because it has acceptedCandidates. */
export function acceptedCvCandidatesForRescue(value:unknown):RescueCvCandidate[] {
  const intake=asRecord(value);
  const cvImport=(value:unknown)=>{
    const record=asRecord(value),analysis=asRecord(record.analysis);
    const types=[record.documentType,analysis.effectiveType,analysis.detectedType].filter(type=>String(type??'').trim()).map(type=>String(type).toUpperCase());
    return types.length&&types.every(type=>['CV','RESUME','MYERAS'].includes(type))&&Array.isArray(record.acceptedCandidates)&&
      record.acceptedCandidates.every(candidate=>Array.isArray(asRecord(candidate).provenance)&&(asRecord(candidate).provenance as unknown[]).length)?record:null;
  };
  const source=cvImport(intake.lastImport)??cvImport(intake.lastAcceptedCvImport);
  if(!source)return [];
  return (source.acceptedCandidates as unknown[]).map(asRecord)
    .filter(candidate=>String(candidate.id??'').trim()&&String(candidate.title??'').trim())
    .map(candidate=>({id:String(candidate.id),title:String(candidate.title),categoryId:String(candidate.categoryId??''),
      startDate:candidate.startDate?String(candidate.startDate):null,endDate:candidate.endDate?String(candidate.endDate):null,provenance:candidate.provenance}));
}

function reconcile(timeline: RescueSemanticCandidate[], cv: RescueCvCandidate[]): RescueReconciliationItem[] {
  if(!cv.length)return [];
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const used = new Set<string>();
  const output: RescueReconciliationItem[] = [];
  const timelineDate=(candidate:RescueSemanticCandidate)=>{
    const show=(value:string,edge:'start'|'end')=>candidate.datePrecision?.[edge]==='YEAR'?`${value.slice(0,4)} (year only)`:value;
    return `${show(candidate.startDate,'start')}${candidate.openEnded?' – ongoing':candidate.endDate?` – ${show(candidate.endDate,'end')}`:' (milestone)'}`;
  };
  const cvDate=(item:RescueCvCandidate)=>`${item.startDate||'Not recorded'}${item.endDate?` – ${item.endDate}`:''}`;
  for (const candidate of timeline) {
    const title = normalize(candidate.title);
    const matches = cv.filter(item=>!used.has(item.id)&&title&&normalize(item.title)===title);
    // An ambiguous repeated title is not evidence that either source row matches.
    const match=matches.length===1?matches[0]:undefined;
    if (!match) {
      output.push({ timelineCandidateId: candidate.id, cvCandidateId: null, state: "TIMELINE_ONLY", authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION", recommendation: `“${candidate.title}” has no unique title match among your accepted CV entries. Confirm it against the original sources; it may be a separate or differently worded entry.`, requiresReview: true });
      continue;
    }
    used.add(match.id);
    const datesDisagree=Boolean((match.startDate&&match.startDate!==candidate.startDate)||(match.endDate&&(match.endDate!==candidate.endDate))||
      (match.startDate&&Boolean(match.endDate)!==Boolean(candidate.endDate)));
    const categoriesDisagree=Boolean(match.categoryId&&comparisonCategory(match.categoryId)!==comparisonCategory(candidate.categoryId));
    const state = datesDisagree?'DATE_CONFLICT':categoriesDisagree?'CATEGORY_CONFLICT':'MATCH';
    const details=[datesDisagree?`Timeline: ${timelineDate(candidate)}. Accepted CV: ${cvDate(match)} (saved dates; check source precision).`:'',
      categoriesDisagree?`Timeline category: ${categoryName(candidate.categoryId)}. Accepted CV category: ${categoryName(match.categoryId)}.`:''].filter(Boolean).join(' ');
    output.push({timelineCandidateId:candidate.id,cvCandidateId:match.id,state,authority:"CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION",
      recommendation:state==='MATCH'?`“${candidate.title}” matches an accepted CV title, with no disagreement in the recorded dates or category. Verify the original source before importing.`:
        `“${candidate.title}”: ${details} Choose the supported value during review; no source facts have been changed.`,requiresReview:true});
  }
  for (const item of cv) if (!used.has(item.id)) output.push({ timelineCandidateId: null, cvCandidateId: item.id, state: "CV_ONLY", authority: "CV_FACTS_TIMELINE_INTENT_MISSIONMED_PRESENTATION", recommendation: `Accepted CV entry “${item.title}” (${cvDate(item)}; ${categoryName(item.categoryId)}) has no unique title match in this Timeline. Check whether it belongs here or appears under another title.`, requiresReview: true });
  return output;
}

function cleanup(candidates: RescueSemanticCandidate[]): { authority: "MISSIONMED_FOUNDER_KEYNOTE_2025_CANONICAL_PRESENTATION"; mode: "PROPOSAL_ONLY"; factualMutationAllowed: false; actions: RescueCleanupAction[] } {
  const base: RescueCleanupAction[] = [
    { id: "rescue-cleanup-background", kind: "RESTORE_CANONICAL_BACKGROUND", scope: "PRESENTATION_ONLY", reason: "Imported geometry is evidence, but the checksum-bound 2025 Founder Keynote remains the presentation authority.", candidateIds: [], requiresReview: true, changesBiography: false },
    { id: "rescue-cleanup-furniture", kind: "RESTORE_CANONICAL_FURNITURE", scope: "PRESENTATION_ONLY", reason: "Restore the protected title, year axis, Color Key, profile card, and MissionMed furniture.", candidateIds: [], requiresReview: true, changesBiography: false },
    { id: "rescue-cleanup-typography", kind: "NORMALIZE_TYPOGRAPHY", scope: "PRESENTATION_ONLY", reason: "Normalize imported text to the canonical MissionMed hierarchy without changing wording.", candidateIds: candidates.map((item) => item.id), requiresReview: true, changesBiography: false },
  ];
  for (const candidate of candidates) base.push({ id: `rescue-cleanup-${candidate.id}`, kind: "REBUILD_SEMANTIC_EVENT", scope: "PRESENTATION_ONLY", reason: "Rebuild this reviewed source item as an editable semantic Timeline event instead of preserving student slide geometry blindly.", candidateIds: [candidate.id], requiresReview: true, changesBiography: false });
  return { authority: "MISSIONMED_FOUNDER_KEYNOTE_2025_CANONICAL_PRESENTATION", mode: "PROPOSAL_ONLY", factualMutationAllowed: false, actions: base };
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
  // Editable OOXML is the visible source authority. Model observations may repeat
  // title fragments, dates and furniture; they are review evidence, not new events.
  // Newly added native objects still enter the same source grouping above.
  const nativeObjects = [...objects];
  if (observed.length) {
    objects.push(...observed);
    slideOrPageCount = Math.max(slideOrPageCount, ...observed.map((item) => item.pageOrSlide));
    if (format !== "PPTX") extractionStatus = "LIMITED";
    else warnings.push("AI visual observations are retained for comparison only. Editable PowerPoint events are recovered from visible native objects; review any disagreement against the slide.");
  }
  const mapped = candidatesFromObjects(artifactSha256, format, format === "PPTX" ? nativeObjects : objects);
  const profile = attachVisibleProfileClaims(artifactSha256,format,format === "PPTX" ? nativeObjects : objects,mapped.candidates);
  const evidenceIds = new Set(mapped.evidence.map(item=>item.evidenceId));
  for (const item of profile.evidence) if (!evidenceIds.has(item.evidenceId)) { mapped.evidence.push(item); evidenceIds.add(item.evidenceId); }
  const evidencedObjects = new Set(mapped.evidence.map(item=>item.objectId));
  mapped.evidence.push(...observed.filter(object=>!evidencedObjects.has(object.id)).map(object => evidenceFor(artifactSha256, format, object, "OCR_OR_VISION_OBSERVATION", "VISION_OBSERVATION", object.sourceConfidence ?? .5)));
  const unresolvedQuestions = [...mapped.unresolved,...profile.unresolved];
  if (format === "PPTX" && observed.length && !mapped.candidates.length) unresolvedQuestions.push("No dated native event could be recovered from this PowerPoint. For an image-only slide, export a clear single-page PDF or image for visual review; AI fragments have not been promoted to events.");
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
