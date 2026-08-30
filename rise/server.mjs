import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertCurrentSourceRights } from "./src/source-authorization.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const DEFAULT_WEB_DIRECTORY = path.join(here, "web");
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PAGE_SIZE = 50;
const MAX_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_AUTH_VALIDATION_AGE_MS = 60 * 1000;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_ROLES = new Set(["student", "mentor", "operator", "admin"]);
const STUDENT_PROGRAM_STATES = new Set(["SAVED", "APPLIED", "INTERVIEWING", "RANKED"]);
const MAX_PROGRAM_NOTES_LENGTH = 4_000;
const STUDENT_INTEL_CATEGORIES = new Set([
  "Application Requirements", "Visa", "USMLE", "COMLEX", "YOG", "USCE", "Interview",
  "Residents", "Faculty / Leadership", "Fellowships", "Rotations", "Curriculum", "Research",
  "Culture", "Salary / Benefits", "Facilities", "Program Update", "Other",
]);
const STUDENT_INTEL_STATUSES = new Set([
  "STUDENT_REPORT", "VERIFICATION_PENDING", "VERIFIED_BY_MISSIONMED", "PARTIALLY_VERIFIED",
  "COULD_NOT_VERIFY", "CONFLICTING", "OUTDATED", "REJECTED_HIDDEN",
]);
const STUDENT_INTEL_MODERATION_ACTIONS = new Set([
  "EDIT_DISPLAY", "ANNOTATE", "REQUEST_CLARIFICATION", "FEATURE", "HIDE", "UNHIDE", "REJECT",
  "DELETE", "MARK_OUTDATED", "MARK_CONFLICTING", "MARK_VERIFIED", "MARK_PARTIAL",
  "COULD_NOT_VERIFY", "SEND_TO_VERIFICATION", "PROMOTE_CANONICAL",
]);
const HIGH_IMPACT_CATEGORIES = new Set(["Visa", "USMLE", "COMLEX", "YOG", "USCE", "Faculty / Leadership", "Program Update", "Application Requirements"]);
const HIGH_IMPACT_PATTERN = /\b(?:program\s+closed|closure|accreditation|probation|withdrawn|program\s+director|associate\s+program\s+director|\bpd\b|\bapd\b|visa|h-?1b|j-?1|deadline|cutoff|minimum\s+score|attempts?|year\s+of\s+graduation|\byog\b|\busce\b|comlex|usmle)\b/i;
const BETA_NOTICE_VERSION = "rise-private-beta-notice-2026-08-28";
const MAX_INTEL_CLAIM_LENGTH = 8_000;
const MAX_INTEL_CONTEXT_LENGTH = 4_000;

const REGION_BY_JURISDICTION = new Map(Object.entries({
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast",
  NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IN: "Midwest", IL: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest", IA: "Midwest", KS: "Midwest",
  MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South", VA: "South", DC: "South",
  WV: "South", AL: "South", KY: "South", MS: "South", TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West",
  AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
}));

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".woff2", "font/woff2"],
]);
const REQUIRED_WEB_ASSET_PATHS = Object.freeze(["index.html", "styles.css", "app.js", "vendor/lucide.js"]);
const STATIC_ASSET_PATHS = new Set(REQUIRED_WEB_ASSET_PATHS.filter((asset) => !asset.startsWith("vendor/")));

function securityHeaders(response, requestId) {
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'unsafe-inline'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "));
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Request-ID", requestId);
}

function sendJson(response, status, body, { cache = "no-store", requestId } = {}) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cache);
  if (requestId) securityHeaders(response, requestId);
  response.end(`${JSON.stringify(body)}\n`);
}

function apiError(response, status, code, message, requestId, details) {
  sendJson(response, status, { error: { code, message, requestId, details } }, { requestId });
}

function createJsonLogger({ stdout = process.stdout, stderr = process.stderr } = {}) {
  const write = (stream, level, entry) => {
    stream.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, ...entry })}\n`);
  };
  return {
    info(entry) { write(stdout, "info", entry); },
    error(entry) { write(stderr, "error", entry); },
  };
}

function createRuntimeMetrics() {
  const startedAt = Date.now();
  const statuses = new Map();
  let requests = 0;
  let totalDurationMs = 0;
  let maxDurationMs = 0;
  return {
    observe(status, durationMs) {
      requests += 1;
      statuses.set(String(status), (statuses.get(String(status)) ?? 0) + 1);
      totalDurationMs += durationMs;
      maxDurationMs = Math.max(maxDurationMs, durationMs);
    },
    snapshot() {
      return {
        schemaVersion: 1,
        startedAt: new Date(startedAt).toISOString(),
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        requests,
        statusCounts: Object.fromEntries([...statuses].sort(([left], [right]) => left.localeCompare(right))),
        durationMs: {
          mean: requests ? Math.round(totalDurationMs / requests * 10) / 10 : 0,
          max: Math.round(maxDurationMs * 10) / 10,
        },
      };
    },
  };
}

export function createMemoryStudentStore() {
  const recordsBySubject = new Map();
  const recordsFor = (subject) => {
    if (!recordsBySubject.has(subject)) recordsBySubject.set(subject, new Map());
    return recordsBySubject.get(subject);
  };
  return {
    scope: "process_local_test_only",
    async list({ subject }) {
      return [...recordsFor(subject).values()]
        .map((record) => ({ ...record }))
        .sort((left, right) => left.programSpecialtyId.localeCompare(right.programSpecialtyId));
    },
    async put({ subject, programSpecialtyId, state, notes }) {
      const updatedAt = new Date().toISOString();
      const record = { programSpecialtyId, state, notes, updatedAt };
      recordsFor(subject).set(programSpecialtyId, record);
      return { ...record };
    },
    async delete({ subject, programSpecialtyId }) {
      return recordsFor(subject).delete(programSpecialtyId);
    },
  };
}

function publicIntelRecord(record) {
  return {
    submissionId: record.submissionId,
    programSpecialtyId: record.programSpecialtyId,
    category: record.category,
    claim: record.displayClaim,
    observedOn: record.observedOn,
    submittedAt: record.submittedAt,
    status: record.status,
    contributor: record.anonymousToStudents ? "Anonymous MissionMed Student" : record.publicContributorName,
    adminNotation: record.publicAdminNotation || "",
    featured: record.featured,
    highPriority: record.highPriority,
    corroborationCount: record.corroborators.size,
    source: record.source ? { ...record.source } : null,
  };
}

function adminIntelRecord(record) {
  return {
    ...publicIntelRecord(record),
    originalClaim: record.originalClaim,
    contextNotes: record.contextNotes,
    submitterSubject: record.submitterSubject,
    submitterDisplayName: record.submitterDisplayName,
    anonymousToStudents: record.anonymousToStudents,
    visible: record.visible,
    moderationLocked: record.moderationLocked,
    deletedAt: record.deletedAt,
    lastVerificationAttemptAt: record.lastVerificationAttemptAt,
    nextEligibleVerificationAt: record.nextEligibleVerificationAt,
  };
}

export function createMemoryStudentIntelStore({ canonicalPromotionMode = "live" } = {}) {
  const records = new Map();
  const audit = [];
  const promotions = [];
  const notices = new Map();
  let sequence = 0;
  return {
    scope: "process_local_test_only",
    canonicalPromotionMode,
    async betaNotice({ subject }) {
      return { version: BETA_NOTICE_VERSION, acknowledged: notices.get(subject) === BETA_NOTICE_VERSION };
    },
    async acknowledgeBetaNotice({ subject }) {
      notices.set(subject, BETA_NOTICE_VERSION);
      return { version: BETA_NOTICE_VERSION, acknowledged: true };
    },
    async listProgram({ subject, isAdmin, programSpecialtyId }) {
      return [...records.values()]
        .filter((record) => record.programSpecialtyId === programSpecialtyId)
        .filter((record) => isAdmin || (record.visible && !record.deletedAt && record.status !== "REJECTED_HIDDEN"))
        .map((record) => isAdmin ? adminIntelRecord(record) : publicIntelRecord(record));
    },
    async submit({ subject, displayName, releaseId, programSpecialtyId, input }) {
      const submittedAt = new Date().toISOString();
      const submissionId = `intel-${++sequence}`;
      const record = {
        submissionId, releaseId, programSpecialtyId,
        submitterSubject: subject,
        submitterDisplayName: displayName || "MissionMed Student",
        publicContributorName: input.anonymousToStudents ? "" : (displayName || "MissionMed Student"),
        anonymousToStudents: input.anonymousToStudents,
        category: input.category,
        originalClaim: input.claim,
        displayClaim: input.claim,
        contextNotes: input.contextNotes,
        observedOn: input.observedOn,
        submittedAt,
        status: "VERIFICATION_PENDING",
        publicAdminNotation: "",
        featured: false,
        visible: true,
        moderationLocked: false,
        deletedAt: null,
        highPriority: input.highPriority,
        source: input.source,
        corroborators: new Set(),
        lastVerificationAttemptAt: null,
        nextEligibleVerificationAt: null,
      };
      records.set(submissionId, record);
      return publicIntelRecord(record);
    },
    async corroborate({ subject, submissionId }) {
      const record = records.get(submissionId);
      if (!record || !record.visible || record.deletedAt) return null;
      if (record.submitterSubject !== subject) record.corroborators.add(subject);
      return { submissionId, corroborationCount: record.corroborators.size };
    },
    async adminList() {
      return [...records.values()].map(adminIntelRecord).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
    },
    async moderate({ actorSubject, submissionId, action, input }) {
      const record = records.get(submissionId);
      if (!record) return null;
      const before = adminIntelRecord(record);
      if (action === "EDIT_DISPLAY") record.displayClaim = input.displayClaim;
      if (action === "ANNOTATE") record.publicAdminNotation = input.adminNotation;
      if (action === "REQUEST_CLARIFICATION") record.moderationLocked = true;
      if (action === "FEATURE") record.featured = input.featured !== false;
      if (action === "HIDE") record.visible = false;
      if (action === "UNHIDE") { record.visible = true; if (record.status === "REJECTED_HIDDEN") record.status = "VERIFICATION_PENDING"; }
      if (action === "REJECT") { record.visible = false; record.status = "REJECTED_HIDDEN"; record.moderationLocked = true; }
      if (action === "DELETE") { record.visible = false; record.status = "REJECTED_HIDDEN"; record.moderationLocked = true; record.deletedAt = new Date().toISOString(); }
      if (action === "MARK_OUTDATED") record.status = "OUTDATED";
      if (action === "MARK_CONFLICTING") record.status = "CONFLICTING";
      if (action === "MARK_VERIFIED") record.status = "VERIFIED_BY_MISSIONMED";
      if (action === "MARK_PARTIAL") record.status = "PARTIALLY_VERIFIED";
      if (action === "COULD_NOT_VERIFY") record.status = "COULD_NOT_VERIFY";
      if (action === "SEND_TO_VERIFICATION") record.status = "VERIFICATION_PENDING";
      if (action === "PROMOTE_CANONICAL") {
        if (record.status !== "VERIFIED_BY_MISSIONMED") {
          const error = new Error("Only MissionMed-verified Student Intel may be promoted");
          error.code = "INTEL_PROMOTION_NOT_VERIFIED";
          throw error;
        }
        promotions.push({ submissionId, actorSubject, field: input.canonicalField, value: input.canonicalValue, sourceUrl: record.source?.url || null, promotedAt: new Date().toISOString() });
      }
      const after = adminIntelRecord(record);
      audit.push({ submissionId, actorSubject, action, reason: input.reason || "", before, after, createdAt: new Date().toISOString() });
      return after;
    },
    async audit({ submissionId }) { return audit.filter((event) => event.submissionId === submissionId).map((event) => structuredClone(event)); },
    async analytics() {
      const list = [...records.values()];
      const counts = Object.fromEntries([...STUDENT_INTEL_STATUSES].map((status) => [status, list.filter((record) => record.status === status).length]));
      const countBy = (field, key) => [...list.reduce((map, record) => map.set(record[field], (map.get(record[field]) || 0) + 1), new Map())]
        .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
        .slice(0, 5).map(([value, count]) => ({ [key]: value, count }));
      return {
        total: list.length, newThisWeek: list.length,
        highPriority: list.filter((record) => record.highPriority).length,
        counts, topPrograms: countBy("programSpecialtyId", "programSpecialtyId"),
        topCategories: countBy("category", "category"), verificationCost: 0, verificationYield: null,
      };
    },
    async verificationPreview() {
      const queued = [...records.values()].filter((record) => record.status === "VERIFICATION_PENDING" && !record.deletedAt);
      return {
        connected: false, budgetStatus: "UNAVAILABLE", paidSubmissionAuthorized: false,
        taskClass: "RISE_STUDENT_INTEL_CLAIM_VERIFICATION", queueClasses: ["HIGH_PRIORITY", "TWICE_MONTHLY"],
        cadence: { timezone: "America/New_York", daysOfMonth: [1, 15], active: false },
        selectedProduct: null, selectedProcessor: null, submissions: queued.map(adminIntelRecord),
        estimatedCost: null, routerPolicy: "P1-RISE-PARALLEL-COST-QUALITY-OPTIMIZATION-007", suppliedUrlFirst: true,
      };
    },
  };
}

function resolveStudentStore(store, { production }) {
  const candidate = store ?? createMemoryStudentStore();
  if (
    typeof candidate.list !== "function" ||
    typeof candidate.put !== "function" ||
    typeof candidate.delete !== "function" ||
    (production && candidate.scope !== "durable_private")
  ) {
    throw new Error("RISE student store must provide list(), put(), and delete(); production scope must be durable_private");
  }
  return candidate;
}

function resolveStudentIntelStore(store, { production }) {
  const candidate = store ?? createMemoryStudentIntelStore();
  const required = ["betaNotice", "acknowledgeBetaNotice", "listProgram", "submit", "corroborate", "adminList", "moderate", "audit", "analytics", "verificationPreview"];
  if (required.some((name) => typeof candidate[name] !== "function") || (production && candidate.scope !== "durable_private")) {
    throw new Error("RISE Student Intel store is incomplete; production scope must be durable_private");
  }
  return candidate;
}

function validateStudentProgramInput(body) {
  const state = String(body?.state ?? "").trim().toUpperCase();
  const notes = String(body?.notes ?? "");
  if (!STUDENT_PROGRAM_STATES.has(state)) {
    const error = new Error("Student program state must be SAVED, APPLIED, INTERVIEWING, or RANKED");
    error.code = "INVALID_STUDENT_PROGRAM_STATE";
    throw error;
  }
  if (notes.length > MAX_PROGRAM_NOTES_LENGTH || /\0/.test(notes)) {
    const error = new Error(`Program notes must be at most ${MAX_PROGRAM_NOTES_LENGTH} characters and contain no null bytes`);
    error.code = "INVALID_PROGRAM_NOTES";
    throw error;
  }
  return { state, notes };
}

function validDateOnly(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = Date.parse(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(normalized) ? normalized : null;
}

function validateStudentIntelInput(body) {
  const category = String(body?.category ?? "").trim();
  const claim = String(body?.claim ?? "").trim();
  const contextNotes = String(body?.contextNotes ?? "").trim();
  const observedOn = validDateOnly(body?.observedOn);
  const sourceKind = String(body?.sourceKind ?? "ONLINE").trim().toUpperCase();
  const sourceUrl = String(body?.sourceUrl ?? "").trim();
  const anonymousToStudents = body?.displayIdentity !== "SHOW_MY_NAME";
  if (!STUDENT_INTEL_CATEGORIES.has(category)) throw Object.assign(new Error("Select a valid Student Intel category"), { code: "INVALID_INTEL_CATEGORY" });
  if (!claim || claim.length > MAX_INTEL_CLAIM_LENGTH || /\0/.test(claim)) throw Object.assign(new Error(`Student Intel claim must be 1-${MAX_INTEL_CLAIM_LENGTH} characters`), { code: "INVALID_INTEL_CLAIM" });
  if (contextNotes.length > MAX_INTEL_CONTEXT_LENGTH || /\0/.test(contextNotes)) throw Object.assign(new Error(`Student Intel context must be at most ${MAX_INTEL_CONTEXT_LENGTH} characters`), { code: "INVALID_INTEL_CONTEXT" });
  if (!observedOn || observedOn > new Date().toISOString().slice(0, 10)) throw Object.assign(new Error("Observed/source date must be a valid date that is not in the future"), { code: "INVALID_INTEL_DATE" });
  if (!new Set(["ONLINE", "FIRSTHAND", "DIRECT_COMMUNICATION", "OTHER"]).has(sourceKind)) throw Object.assign(new Error("Select a valid Student Intel source kind"), { code: "INVALID_INTEL_SOURCE" });
  let normalizedSourceUrl = null;
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || sourceUrl.length > 2_048) throw new Error();
      normalizedSourceUrl = parsed.toString();
    } catch {
      throw Object.assign(new Error("Student Intel source URL must be a valid HTTPS URL"), { code: "INVALID_INTEL_SOURCE_URL" });
    }
  }
  if (sourceKind === "ONLINE" && !normalizedSourceUrl) throw Object.assign(new Error("A source URL is required for online information"), { code: "INTEL_SOURCE_URL_REQUIRED" });
  const highPriority = HIGH_IMPACT_CATEGORIES.has(category) && HIGH_IMPACT_PATTERN.test(claim);
  return {
    category, claim, contextNotes, observedOn, anonymousToStudents, highPriority,
    source: { kind: sourceKind, url: normalizedSourceUrl, label: String(body?.sourceLabel ?? "").trim().slice(0, 240) },
  };
}

function validateModerationInput(body) {
  const action = String(body?.action ?? "").trim().toUpperCase();
  if (!STUDENT_INTEL_MODERATION_ACTIONS.has(action)) throw Object.assign(new Error("Select a valid Student Intel moderation action"), { code: "INVALID_INTEL_MODERATION_ACTION" });
  const displayClaim = String(body?.displayClaim ?? "").trim();
  const adminNotation = String(body?.adminNotation ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  if (action === "EDIT_DISPLAY" && (!displayClaim || displayClaim.length > MAX_INTEL_CLAIM_LENGTH)) throw Object.assign(new Error("Edited display text is required"), { code: "INVALID_INTEL_DISPLAY" });
  if (adminNotation.length > MAX_INTEL_CONTEXT_LENGTH || reason.length > MAX_INTEL_CONTEXT_LENGTH) throw Object.assign(new Error("Moderation notes are too long"), { code: "INVALID_INTEL_MODERATION_NOTE" });
  const canonicalField = String(body?.canonicalField ?? "").trim();
  if (action === "PROMOTE_CANONICAL" && (!canonicalField || canonicalField.length > 128 || body?.canonicalValue === undefined)) throw Object.assign(new Error("Canonical field and value are required for promotion"), { code: "INVALID_INTEL_PROMOTION" });
  return { action, displayClaim, adminNotation, reason, featured: body?.featured, canonicalField, canonicalValue: body?.canonicalValue };
}

function normalizeQuery(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

function knownValue(field) {
  return field?.knowledge?.state === "known" ? field.knowledge.value : undefined;
}

function regionFor(state) {
  return REGION_BY_JURISDICTION.get(state) ?? "Territory / Other";
}

function listView(record) {
  const j1 = knownValue(record.fields.J1);
  const h1b = knownValue(record.fields.H1B);
  return {
    id: record.id,
    programSpecialtyId: record.programSpecialtyId,
    identifiers: record.identifiers ?? [],
    lifecycle: record.lifecycle ?? "unknown",
    display: { ...record.display, region: regionFor(record.display.state) },
    designation: record.designation,
    kind: record.kind,
    entryFormat: record.entryFormat,
    browseMemberships: record.browseMemberships,
    programType: knownValue(record.fields["Program Best Described As"]) ?? null,
    officialUrl: knownValue(record.fields["Program Website"]) ?? null,
    visa: {
      j1: j1 === true ? "known_yes" : "unknown",
      h1b: h1b === true ? "known_yes" : "unknown",
    },
    evidence: record.evidence,
    soap2026: record.soap2026 ? {
      appeared: true,
      cycle: 2026,
      tracks: record.soap2026.tracks,
      wording: record.soap2026.wording,
      context: record.soap2026.context,
    } : null,
    source: {
      authority: record.source.authority,
      retrievedAt: record.source.retrievedAt,
      sourceUpdatedAt: record.source.sourceUpdatedAt,
    },
  };
}

function evidenceBand(percent) {
  if (percent >= 65) return "high";
  if (percent >= 40) return "medium";
  return "low";
}

function buildSearchReadModel(programs) {
  const byName = [...programs].sort((left, right) =>
    String(left.display.programName).localeCompare(String(right.display.programName)) ||
    String(left.id).localeCompare(String(right.id)));
  const metadata = new WeakMap();
  for (const record of byName) {
    metadata.set(record, {
      haystack: normalizeQuery([
        record.display.programName,
        record.display.institution,
        record.display.hospital,
        record.display.city,
        record.display.state,
        record.designation,
        record.id,
        record.programSpecialtyId,
        ...(record.identifiers ?? []).map((identifier) => identifier.value),
      ].filter(Boolean).join(" ")),
      region: regionFor(record.display.state),
      programType: normalizeQuery(knownValue(record.fields["Program Best Described As"])),
      j1: knownValue(record.fields.J1) === true,
      h1b: knownValue(record.fields.H1B) === true,
      evidence: evidenceBand(record.evidence.coveragePercent),
      soap2026: record.soap2026?.appeared === true,
      soapPositions: (record.soap2026?.tracks ?? []).reduce((sum, track) => sum + Number(track.availablePositions ?? 0), 0),
      specialtyRelationships: new Map(record.browseMemberships.map((membership) =>
        [membership.browseSpecialty, membership.relationship])),
    });
  }
  return { byName, metadata };
}

function selectedSpecialtyMatch(record, specialty, includeCombined, metadata) {
  if (!specialty || record.designation === specialty) return true;
  const relationship = metadata.specialtyRelationships.get(specialty);
  if (!relationship) return false;
  return relationship !== "RELATED_COMBINED" || includeCombined;
}

function searchPrograms(readModel, searchParams) {
  const query = normalizeQuery(searchParams.get("q"));
  const specialty = String(searchParams.get("specialty") ?? "").trim();
  const designation = String(searchParams.get("designation") ?? "").trim();
  const jurisdiction = String(searchParams.get("jurisdiction") ?? "").trim();
  const region = String(searchParams.get("region") ?? "").trim();
  const programType = normalizeQuery(searchParams.get("programType"));
  const visa = String(searchParams.get("visa") ?? "").trim().toUpperCase();
  const evidence = String(searchParams.get("evidence") ?? "").trim().toLowerCase();
  const includeCombined = searchParams.get("includeCombined") === "true";
  const soap2026 = searchParams.get("soap2026") === "true";
  const sort = String(searchParams.get("sort") ?? "name");
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24));

  let records = readModel.byName.filter((record) => {
    const metadata = readModel.metadata.get(record);
    if (!selectedSpecialtyMatch(record, specialty, includeCombined, metadata)) return false;
    if (designation && record.designation !== designation) return false;
    if (jurisdiction && record.display.state !== jurisdiction) return false;
    if (region && metadata.region !== region) return false;
    if (programType && !metadata.programType.includes(programType)) return false;
    if (visa === "J1" && !metadata.j1) return false;
    if (visa === "H1B" && !metadata.h1b) return false;
    if (evidence && metadata.evidence !== evidence) return false;
    if (soap2026 && !metadata.soap2026) return false;
    return !query || metadata.haystack.includes(query);
  });
  if (sort === "jurisdiction" || sort === "evidence" || sort === "soap_positions") records = [...records].sort((left, right) => {
    if (sort === "jurisdiction") {
      return String(left.display.state).localeCompare(String(right.display.state)) ||
        String(left.display.programName).localeCompare(String(right.display.programName));
    }
    if (sort === "evidence") {
      return right.evidence.coveragePercent - left.evidence.coveragePercent ||
        String(left.display.programName).localeCompare(String(right.display.programName));
    }
    if (sort === "soap_positions") {
      return readModel.metadata.get(right).soapPositions - readModel.metadata.get(left).soapPositions ||
        String(left.display.programName).localeCompare(String(right.display.programName));
    }
    return String(left.display.programName).localeCompare(String(right.display.programName));
  });
  const total = records.length;
  const start = (page - 1) * pageSize;
  const pageRecords = records.slice(start, start + pageSize).map(listView);
  return {
    query: { q: query, specialty, designation, jurisdiction, region, programType, visa, evidence, includeCombined, soap2026, sort },
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    records: pageRecords,
  };
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body exceeds 64 KiB");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body is not valid JSON");
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function isProductionEnvironment({
  nodeEnv = process.env.NODE_ENV,
  riseEnvironment = process.env.RISE_ENVIRONMENT,
} = {}) {
  return String(nodeEnv ?? "").toLowerCase() === "production" ||
    String(riseEnvironment ?? "").toLowerCase() === "production";
}

const PRODUCTION_REQUIRED_ENVIRONMENT = [
  "RISE_AUTH_MODE",
  "RISE_AUTH_ADAPTER_MODULE",
  "RISE_AUTH_ISSUER",
  "RISE_LOGIN_URL",
  "RISE_HQ_AUTH_SESSION_URL",
  "RISE_HQ_SESSION_COOKIE_NAME",
  "RISE_SESSION_BINDING_HMAC_KEY",
  "RISE_AUDIT_HMAC_KEY",
  "RISE_ABUSE_ADAPTER_MODULE",
  "RISE_SOURCE_RIGHTS_ADAPTER_MODULE",
  "RISE_STUDENT_STATE_ADAPTER_MODULE",
  "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY",
  "RISE_MATRIX_PROFILE_ADAPTER_MODULE",
  "RISE_MATRIX_PROFILE_URL",
  "RISE_DATABASE_URL",
  "RISE_DATABASE_SSL_MODE",
  "RISE_ARTIFACT_MODE",
  "RISE_INDEX_PATH",
  "RISE_INDEX_SHA256",
  "RISE_INDEX_MANIFEST_PATH",
  "RISE_INDEX_MANIFEST_SHA256",
  "RISE_ACTIVATION_RECEIPT_PATH",
  "RISE_ACTIVATION_RECEIPT_SHA256",
  "RISE_SOURCE_AUTHORIZATION_SHA256S",
  "RISE_ASSET_MANIFEST_SHA256",
  "RISE_BUILD_ID",
  "RISE_PUBLIC_ORIGIN",
];

export function validateProductionEnvironment(environment = process.env) {
  if (environment.NODE_ENV !== "production" || environment.RISE_ENVIRONMENT !== "production") {
    throw new Error("Production RISE requires NODE_ENV=production and RISE_ENVIRONMENT=production");
  }
  const missing = PRODUCTION_REQUIRED_ENVIRONMENT.filter((name) => !String(environment[name] ?? "").trim());
  if (missing.length) throw new Error(`Production RISE environment is incomplete: ${missing.join(", ")}`);
  if (environment.RISE_AUTH_MODE !== "injected") {
    throw new Error("Production RISE requires RISE_AUTH_MODE=injected");
  }
  if (environment.RISE_ARTIFACT_MODE !== "bundled") {
    throw new Error("Production RISE requires immutable bundled artifacts");
  }
  if (environment.RISE_DATABASE_SSL_MODE !== "require") {
    throw new Error("Production RISE requires RISE_DATABASE_SSL_MODE=require");
  }
  for (const name of [
    "RISE_ALLOW_INSECURE_LOOPBACK_AUTH",
    "RISE_ALLOW_INSECURE_LOOPBACK_ABUSE",
    "RISE_ALLOW_INSECURE_LOOPBACK_SOURCE_RIGHTS",
    "RISE_ALLOW_INSECURE_LOOPBACK_STUDENT_STATE",
    "RISE_ALLOW_INSECURE_LOOPBACK_MATRIX_PROFILE",
    "RISE_ALLOW_INSECURE_LOOPBACK_ARTIFACTS",
  ]) {
    if (environment[name] === "true") throw new Error(`${name} is prohibited in production`);
  }
  for (const name of ["RISE_INDEX_SHA256", "RISE_INDEX_MANIFEST_SHA256", "RISE_ACTIVATION_RECEIPT_SHA256", "RISE_ASSET_MANIFEST_SHA256"]) {
    if (!/^[a-f0-9]{64}$/.test(environment[name])) throw new Error(`${name} must be a lowercase SHA-256`);
  }
  for (const name of ["RISE_AUTH_ADAPTER_MODULE", "RISE_ABUSE_ADAPTER_MODULE", "RISE_SOURCE_RIGHTS_ADAPTER_MODULE", "RISE_STUDENT_STATE_ADAPTER_MODULE", "RISE_MATRIX_PROFILE_ADAPTER_MODULE", "RISE_INDEX_PATH", "RISE_INDEX_MANIFEST_PATH", "RISE_ACTIVATION_RECEIPT_PATH"]) {
    if (!path.isAbsolute(environment[name])) throw new Error(`${name} must be an absolute path`);
  }
  for (const [name, expected] of Object.entries({
    RISE_AUTH_ADAPTER_MODULE: "/app/adapters/hq-auth.mjs",
    RISE_ABUSE_ADAPTER_MODULE: "/app/adapters/postgres-runtime.mjs",
    RISE_SOURCE_RIGHTS_ADAPTER_MODULE: "/app/adapters/postgres-runtime.mjs",
    RISE_STUDENT_STATE_ADAPTER_MODULE: "/app/adapters/postgres-runtime.mjs",
    RISE_MATRIX_PROFILE_ADAPTER_MODULE: "/app/adapters/http-matrix-profile.mjs",
    RISE_INDEX_PATH: "/app/releases/student-rights-safe/api-index.json",
    RISE_INDEX_MANIFEST_PATH: "/app/releases/student-rights-safe/index-manifest.json",
    RISE_ACTIVATION_RECEIPT_PATH: "/app/releases/student-rights-safe/activation-receipt.json",
  })) {
    if (environment[name] !== expected) throw new Error(`${name} must be ${expected}`);
  }
  const publicOrigin = new URL(environment.RISE_PUBLIC_ORIGIN);
  const authIssuer = new URL(environment.RISE_AUTH_ISSUER);
  const hqSessionUrl = new URL(environment.RISE_HQ_AUTH_SESSION_URL);
  const loginUrl = new URL(environment.RISE_LOGIN_URL);
  const matrixProfileUrl = new URL(environment.RISE_MATRIX_PROFILE_URL);
  const databaseUrl = new URL(environment.RISE_DATABASE_URL);
  if (
    publicOrigin.protocol !== "https:" || publicOrigin.pathname !== "/" || publicOrigin.search || publicOrigin.hash ||
    authIssuer.protocol !== "https:" || authIssuer.href !== `${authIssuer.origin}/` ||
    hqSessionUrl.protocol !== "https:" || hqSessionUrl.origin !== authIssuer.origin || hqSessionUrl.pathname !== "/api/auth/session" ||
    loginUrl.protocol !== "https:" || loginUrl.origin !== publicOrigin.origin ||
    loginUrl.pathname !== "/wp-admin/admin-post.php" ||
    loginUrl.searchParams.get("action") !== "mmed_rise_auth_redirect" ||
    [...loginUrl.searchParams.keys()].some((key) => key !== "action") ||
    loginUrl.username || loginUrl.password || loginUrl.hash ||
    matrixProfileUrl.protocol !== "https:" || matrixProfileUrl.origin !== publicOrigin.origin ||
    matrixProfileUrl.pathname !== "/wp-json/mmed/v1/profile/me" || matrixProfileUrl.search || matrixProfileUrl.hash ||
    !new Set(["postgres:", "postgresql:"]).has(databaseUrl.protocol) ||
    !databaseUrl.hostname || !databaseUrl.username || !databaseUrl.password
  ) {
    throw new Error("RISE public-origin and HQ-auth topology is invalid");
  }
  if (Buffer.byteLength(environment.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY) < 32) {
    throw new Error("RISE_STUDENT_STATE_SUBJECT_HMAC_KEY must contain at least 32 bytes");
  }
  return true;
}

function safeStringEqual(left, right) {
  const leftBytes = Buffer.from(String(left ?? ""));
  const rightBytes = Buffer.from(String(right ?? ""));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function validTimestamp(value) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function canonicalIssuerOrigin(value) {
  try {
    const url = new URL(String(value ?? ""));
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeSession(session, { audience, issuer, now = Date.now() }) {
  if (
    !session || typeof session !== "object" ||
    (session.revoked !== undefined && session.revoked !== false) ||
    (session.revokedAt !== undefined && session.revokedAt !== null)
  ) return null;
  const subject = String(session.subject ?? "").trim();
  const role = String(session.role ?? "student").trim().toLowerCase();
  const displayName = String(session.displayName ?? "").trim().slice(0, 120);
  const validatedAt = validTimestamp(session.validatedAt);
  const expiresAt = validTimestamp(session.expiresAt);
  const sessionId = String(session.sessionId ?? "");
  const csrfToken = String(session.csrfToken ?? "");
  const previewIssuer = issuer === "rise:local-preview";
  const expectedIssuer = previewIssuer ? issuer : canonicalIssuerOrigin(issuer);
  const sessionIssuer = previewIssuer ? session.issuer : canonicalIssuerOrigin(session.issuer);
  if (
    !subject || subject.length > 256 ||
    !SESSION_ROLES.has(role) ||
    session.audience !== audience ||
    !expectedIssuer || sessionIssuer !== expectedIssuer ||
    validatedAt === null || validatedAt > now + 5_000 || now - validatedAt > MAX_AUTH_VALIDATION_AGE_MS ||
    expiresAt === null || expiresAt <= now || expiresAt - now > MAX_SESSION_LIFETIME_MS ||
    !/^[a-f0-9]{64}$/.test(sessionId) ||
    !/^[A-Za-z0-9_-]{24,256}$/.test(csrfToken)
  ) {
    return null;
  }
  const capabilities = Array.isArray(session.capabilities)
    ? [...new Set(session.capabilities.filter((item) =>
      typeof item === "string" && /^[a-z0-9:_-]{1,128}$/.test(item)))].slice(0, 32)
    : [];
  return {
    subject,
    role,
    displayName,
    audience,
    issuer: expectedIssuer,
    capabilities,
    sessionId,
    csrfToken,
    expiresAt: new Date(expiresAt).toISOString(),
    preview: session.preview === true,
  };
}

function publicSession(session) {
  return {
    authenticated: true,
    role: session.role,
    audience: session.audience,
    capabilities: session.capabilities,
    privateBeta: session.capabilities.includes("rise:private-beta") || session.capabilities.includes("rise:admin"),
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken,
    preview: session.preview,
  };
}

function validCsrf(request, session) {
  if (!MUTATION_METHODS.has(request.method)) return true;
  const token = request.headers["x-rise-csrf"];
  return typeof token === "string" && safeStringEqual(token, session.csrfToken);
}

function resolveAuditHmacKey(value, { production }) {
  if (value) {
    const key = Buffer.from(String(value));
    if (key.length < 32) throw new Error("RISE_AUDIT_HMAC_KEY must contain at least 32 bytes");
    return key;
  }
  if (production) throw new Error("RISE_AUDIT_HMAC_KEY is required in production");
  return randomBytes(32);
}

function createAuthenticator({ mode, authenticator, audience = "rise", issuer, production = false }) {
  if (mode === "local-preview") {
    if (production) {
      throw new Error("local-preview authentication is prohibited in production");
    }
    const previewSession = {
      subject: "local-preview",
      role: "admin",
      audience,
      issuer: "rise:local-preview",
      capabilities: ["rise:read", "rise:operator", "rise:admin", "rise:premium", "rise:private-beta", "rise:contribute"],
      sessionId: randomBytes(32).toString("hex"),
      csrfToken: randomBytes(24).toString("base64url"),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      preview: true,
    };
    return async () => normalizeSession({
      ...previewSession,
      validatedAt: new Date().toISOString(),
    }, { audience, issuer: previewSession.issuer });
  }
  if (mode !== "injected" || typeof authenticator !== "function" || !issuer) {
    throw new Error("RISE requires local-preview outside production or an injected host authentication adapter");
  }
  return async (request) => {
    // Production RISE deliberately accepts host-session authentication only.
    // A browser-visible bearer credential must never be forwarded or replayed.
    if (request.headers.authorization) return null;
    const session = await authenticator(request);
    return normalizeSession(session, { audience, issuer });
  };
}

function hasCapability(session, capability) {
  return session.capabilities.includes("rise:admin") || session.capabilities.includes(capability);
}

export function validateListenConfiguration({
  host,
  authMode,
  nodeEnv = process.env.NODE_ENV,
  riseEnvironment = process.env.RISE_ENVIRONMENT,
} = {}) {
  const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
  if (authMode === "local-preview" && !loopback.has(host)) {
    throw new Error("local-preview authentication may listen only on a loopback address");
  }
  if (authMode === "local-preview" && isProductionEnvironment({ nodeEnv, riseEnvironment })) {
    throw new Error("local-preview authentication is prohibited in production");
  }
  return true;
}

function validateActivationReceipt(receipt, {
  registryReleaseId,
  apiIndexSha256,
  indexManifestSha256,
  now = Date.now(),
}) {
  const approvedAt = validTimestamp(receipt?.approvedAt);
  if (
    receipt?.schemaVersion !== 1 ||
    receipt?.immutable !== true ||
    receipt?.action !== "activate" ||
    receipt?.revoked === true ||
    receipt?.registryReleaseId !== registryReleaseId ||
    receipt?.apiIndexSha256 !== apiIndexSha256 ||
    receipt?.indexManifestSha256 !== indexManifestSha256 ||
    !String(receipt?.decisionRecordId ?? "").trim() ||
    !String(receipt?.approvedBySubject ?? "").trim() ||
    approvedAt === null || approvedAt > now + 5 * 60 * 1000
  ) {
    throw new Error("RISE activation receipt is invalid or does not bind the runtime artifacts");
  }
  return {
    verified: true,
    action: receipt.action,
    decisionRecordId: String(receipt.decisionRecordId),
    approvedAt: new Date(approvedAt).toISOString(),
  };
}

function rateLimiter({ limit = 120, windowMs = 60_000, maxBuckets = 10_000 } = {}) {
  const buckets = new Map();
  return (key, cost = 1) => {
    const now = Date.now();
    if (buckets.size >= maxBuckets) {
      for (const [candidate, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(candidate);
      }
      if (buckets.size >= maxBuckets && !buckets.has(key)) return false;
    }
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: cost, resetAt: now + windowMs });
      return cost <= limit;
    }
    current.count += cost;
    return current.count <= limit;
  };
}

function requestRateCost(url) {
  if (url.pathname === "/api/rise/v1/programs/catalog") return 5;
  if (url.pathname !== "/api/rise/v1/programs") return 1;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "24", 10) || 24));
  return 1 + Math.ceil(pageSize / 10);
}

function localAbuseController() {
  const allowGlobal = rateLimiter({ limit: 2_000, windowMs: 60_000, maxBuckets: 1 });
  const allowSubject = rateLimiter();
  return {
    scope: "process_local_test_only",
    async allowPreAuth() {
      return allowGlobal("global", 1);
    },
    async allowAuthenticatedSubject({ subjectKey, cost }) {
      return allowSubject(subjectKey, cost);
    },
  };
}

function resolveAbuseController(controller, { production }) {
  if (!controller) {
    if (production) {
      throw new Error("Production RISE requires an injected shared durable abuse controller");
    }
    return localAbuseController();
  }
  if (
    typeof controller.allowPreAuth !== "function" ||
    typeof controller.allowAuthenticatedSubject !== "function" ||
    (production && controller.scope !== "shared_durable")
  ) {
    throw new Error("RISE abuse controller must provide pre-auth and authenticated-subject controls; production scope must be shared_durable");
  }
  return controller;
}

function resolveSourceRightsController(controller, { production }) {
  if (!controller) {
    if (production) throw new Error("Production RISE requires an injected shared current source-rights controller");
    return { scope: "process_local_test_only", async assertCurrent() { return true; } };
  }
  if (typeof controller.assertCurrent !== "function" || (production && controller.scope !== "shared_durable_current")) {
    throw new Error("RISE source-rights controller must provide assertCurrent(); production scope must be shared_durable_current");
  }
  return controller;
}

function resolveMatrixProfileAdapter(adapter, { production }) {
  if (!adapter) {
    if (production) throw new Error("Production RISE requires the canonical Matrix profile adapter");
    return null;
  }
  if (
    adapter.scope !== "canonical_matrix_owner_transport" ||
    typeof adapter.read !== "function" ||
    typeof adapter.write !== "function"
  ) {
    throw new Error("RISE Matrix profile adapter must provide canonical read() and write() transport");
  }
  return adapter;
}

async function serveStatic(request, requestPath, response, webDirectory, requestId) {
  const assetAliases = new Map([
    ["/rise/assets/app", "app.js"],
    ["/rise/assets/styles", "styles.css"],
  ]);
  let relative = requestPath === "/rise/" || requestPath === "/rise"
    ? "index.html"
    : assetAliases.get(requestPath) ?? requestPath.slice("/rise/".length);
  if (requestPath === "/rise/vendor/lucide.js") {
    const bundledVendorPath = path.resolve(webDirectory, "vendor/lucide.js");
    let body;
    try {
      body = await fs.readFile(bundledVendorPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      body = await fs.readFile(require.resolve("lucide/dist/umd/lucide.min.js"));
    }
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    response.setHeader("ETag", etag);
    securityHeaders(response, requestId);
    if (request.headers["if-none-match"] === etag) {
      response.statusCode = 304;
      response.end();
    } else {
      response.end(request.method === "HEAD" ? undefined : body);
    }
    return true;
  }
  if (!requestPath.startsWith("/rise")) return false;
  try {
    relative = decodeURIComponent(relative || "index.html");
  } catch {
    return false;
  }
  if (!STATIC_ASSET_PATHS.has(relative)) return false;
  const absolute = path.resolve(webDirectory, relative);
  const root = `${path.resolve(webDirectory)}${path.sep}`;
  if (!absolute.startsWith(root) && absolute !== path.resolve(webDirectory, "index.html")) return false;
  try {
    const body = await fs.readFile(absolute);
    response.statusCode = 200;
    response.setHeader("Content-Type", MIME_TYPES.get(path.extname(absolute)) ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-cache");
    const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
    response.setHeader("ETag", etag);
    securityHeaders(response, requestId);
    if (request.headers["if-none-match"] === etag) {
      response.statusCode = 304;
      response.end();
    } else {
      response.end(request.method === "HEAD" ? undefined : body);
    }
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function createRiseServer({
  registryIndex,
  webDirectory = DEFAULT_WEB_DIRECTORY,
  authMode = process.env.RISE_AUTH_MODE ?? "local-preview",
  authenticator,
  buildId = process.env.RISE_BUILD_ID ?? "local-unversioned",
  environment = process.env.RISE_ENVIRONMENT ?? (process.env.NODE_ENV === "production" ? "production" : "local"),
  production = isProductionEnvironment({ riseEnvironment: environment }),
  expectedSourceAuthorizationSha256s = process.env.RISE_SOURCE_AUTHORIZATION_SHA256S,
  revokedSourceAuthorizationSha256s = process.env.RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S,
  authIssuer = process.env.RISE_AUTH_ISSUER,
  loginUrl = process.env.RISE_LOGIN_URL,
  auditHmacKey = process.env.RISE_AUDIT_HMAC_KEY,
  abuseController,
  sourceRightsController,
  studentStore,
  studentIntelStore,
  matrixProfileAdapter,
  logger = createJsonLogger(),
} = {}) {
  if (!registryIndex?.programs || !registryIndex?.registryReleaseId) {
    throw new Error("A validated RISE API index is required");
  }
  const syntheticTestFixture = registryIndex.dataClassification === "synthetic_test_fixture";
  const sourceRightsApproved = registryIndex.releaseGate?.sourceRightsApproved === true;
  if (!syntheticTestFixture) {
    assertCurrentSourceRights(registryIndex.releaseGate, {
      production,
      expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
      revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
    });
  }
  if (production && syntheticTestFixture) {
    throw new Error("Synthetic RISE fixtures are prohibited in production");
  }
  if (production && (
    registryIndex.activationStatus !== "active" ||
    registryIndex.activationReceipt?.verified !== true
  )) {
    throw new Error("Production RISE requires a verified active-release receipt");
  }
  const byProgramSpecialtyId = new Map(registryIndex.programs.map((record) => [record.programSpecialtyId, record]));
  const searchReadModel = buildSearchReadModel(registryIndex.programs);
  const authenticate = createAuthenticator({ mode: authMode, authenticator, issuer: authIssuer, production });
  const abuse = resolveAbuseController(abuseController, { production });
  const auditKey = resolveAuditHmacKey(auditHmacKey, { production });
  const sourceRights = syntheticTestFixture
    ? null
    : resolveSourceRightsController(sourceRightsController, { production });
  const studentPrograms = resolveStudentStore(studentStore, { production });
  const studentIntel = resolveStudentIntelStore(studentIntelStore, { production });
  const matrixProfile = resolveMatrixProfileAdapter(matrixProfileAdapter, { production });
  const authorizationSha256s = registryIndex.releaseGate?.sourceRights?.map((right) => right.sha256) ?? [];
  async function assertLiveSourceRights() {
    if (syntheticTestFixture) return true;
    assertCurrentSourceRights(registryIndex.releaseGate, {
      production,
      expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
      revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
    });
    let decision = null;
    try {
      decision = await sourceRights.assertCurrent({
        registryReleaseId: registryIndex.registryReleaseId,
        authorizationSha256s,
      });
    } catch {
      decision = null;
    }
    if (decision !== true && decision?.current !== true) {
      const error = new Error("Current source-rights validation is unavailable or revoked");
      error.code = "SOURCE_RIGHTS_UNAVAILABLE";
      throw error;
    }
    return decision === true ? { current: true, decisionId: null } : decision;
  }
  const metrics = createRuntimeMetrics();
  return http.createServer(async (request, response) => {
    const requestId = randomUUID();
    const startedAt = performance.now();
    let status = 500;
    let subjectAuditId = null;
    let sourceRightsDecisionId = null;
    try {
      const url = new URL(request.url ?? "/", "http://rise.local");
      const preAuthAllowed = await abuse.allowPreAuth({
        method: request.method,
        path: url.pathname,
        cost: requestRateCost(url),
      });
      if (!preAuthAllowed) {
        status = 429;
        response.setHeader("Retry-After", "60");
        apiError(response, 429, "PRE_AUTH_RATE_LIMITED", "RISE ingress request budget exceeded", requestId);
        return;
      }
      if (url.pathname === "/api/rise/v1/health") {
        let sourceRightsCurrent = true;
        if (!syntheticTestFixture) {
          try {
            const decision = await assertLiveSourceRights();
            sourceRightsDecisionId = decision.decisionId;
          } catch {
            sourceRightsCurrent = false;
          }
        }
        status = sourceRightsCurrent ? 200 : 503;
        sendJson(response, status, {
          ok: sourceRightsCurrent,
          service: "missionmed-rise",
          registryReleaseId: registryIndex.registryReleaseId,
          activationStatus: registryIndex.activationStatus ?? "offline_shadow_only",
          buildId,
          environment,
          sourceRightsCurrent,
        }, { cache: "no-store", requestId });
        return;
      }
      if (url.pathname === "/") {
        status = 302;
        response.statusCode = 302;
        response.setHeader("Location", "/rise/");
        securityHeaders(response, requestId);
        response.end();
        return;
      }
      if (!url.pathname.startsWith("/api/rise/v1/")) {
        if (!new Set(["GET", "HEAD"]).has(request.method)) {
          status = 405;
          apiError(response, 405, "METHOD_NOT_ALLOWED", "Static RISE routes accept GET or HEAD only", requestId);
          return;
        }
        if (authMode === "local-preview") response.setHeader("X-RISE-Preview", "true");
        const served = await serveStatic(request, url.pathname, response, webDirectory, requestId);
        if (served) {
          status = response.statusCode;
          return;
        }
        status = 404;
        apiError(response, 404, "NOT_FOUND", "Route not found", requestId);
        return;
      }
      const session = await authenticate(request);
      if (!session) {
        status = 401;
        apiError(response, 401, "UNAUTHENTICATED", "A valid RISE host session is required", requestId, {
          loginUrl: loginUrl || null,
        });
        return;
      }
      if (!hasCapability(session, "rise:read")) {
        status = 403;
        apiError(response, 403, "FORBIDDEN", "RISE read capability required", requestId);
        return;
      }
      subjectAuditId = createHmac("sha256", auditKey)
        .update("rise-audit-subject-v1\0")
        .update(session.subject)
        .digest("hex")
        .slice(0, 32);
      if (!await abuse.allowAuthenticatedSubject({
        subjectKey: subjectAuditId,
        method: request.method,
        path: url.pathname,
        cost: requestRateCost(url),
      })) {
        status = 429;
        response.setHeader("Retry-After", "60");
        apiError(response, 429, "RATE_LIMITED", "Authenticated RISE request budget exceeded", requestId);
        return;
      }
      if (!validCsrf(request, session)) {
        status = 403;
        apiError(response, 403, "CSRF_INVALID", "A valid RISE CSRF token is required", requestId);
        return;
      }
      if (!syntheticTestFixture) {
        const decision = await assertLiveSourceRights();
        sourceRightsDecisionId = decision.decisionId;
      }
      if (authMode === "local-preview") response.setHeader("X-RISE-Preview", "true");

      if (request.method === "GET" && url.pathname === "/api/rise/v1/session") {
        status = 200;
        sendJson(response, 200, publicSession(session), { requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/status") {
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          sourceSnapshotId: registryIndex.sourceSnapshotId,
          counts: registryIndex.counts,
          activationStatus: registryIndex.activationStatus ?? "offline_shadow_only",
          dataClassification: registryIndex.dataClassification ?? "source_controlled_registry",
          sourceRightsApproved,
          buildId,
          environment,
          activationDecisionRecordId: registryIndex.activationReceipt?.decisionRecordId ?? null,
          integrations: {
            matrix: matrixProfile ? "canonical_owner_transport" : "disabled",
            matrixProfile: matrixProfile ? "read_write" : "disabled",
            fileVault: "disabled",
            rankListIq: "disabled",
            researchFactory: "canonical_sink_zero_spend",
            canonicalEvidence: studentIntel.canonicalPromotionMode === "live" ? "durable" : "unavailable",
            soap2026: registryIndex.programs.some((program) => program.soap2026?.appeared) ? "historical_private_beta" : "unavailable",
            studentIntel: studentIntel.scope === "durable_private" ? "durable" : "process_local_test_only",
            actn: "disabled",
            cam: "disabled",
            storyforge: "disabled",
          },
          persistence: studentPrograms.scope === "durable_private" ? "durable" : "process_local_test_only",
          privateBeta: true,
          sourcePolicy: registryIndex.sourcePolicy ?? {
            freida: "written_authorization_required",
            residencyExplorer: "written_authorization_required",
          },
        }, { requestId });
        return;
      }
      if (url.pathname === "/api/rise/v1/me/beta-notice" && (request.method === "GET" || request.method === "POST")) {
        const payload = request.method === "GET"
          ? await studentIntel.betaNotice({ subject: session.subject })
          : await studentIntel.acknowledgeBetaNotice({ subject: session.subject });
        status = 200;
        sendJson(response, 200, payload, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/me/programs") {
        const records = await studentPrograms.list({
          subject: session.subject,
          releaseId: registryIndex.registryReleaseId,
        });
        status = 200;
        sendJson(response, 200, {
          records,
          persistence: studentPrograms.scope === "durable_private" ? "durable" : "process_local_test_only",
        }, { cache: "no-store", requestId });
        return;
      }
      const intelProgramMatch = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)\/student-intel$/);
      if (intelProgramMatch && (request.method === "GET" || request.method === "POST")) {
        const programSpecialtyId = decodeURIComponent(intelProgramMatch[1]);
        if (!byProgramSpecialtyId.has(programSpecialtyId)) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        if (request.method === "POST" && !hasCapability(session, "rise:contribute")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "RISE private-beta contribution capability required", requestId);
          return;
        }
        const isAdmin = hasCapability(session, "rise:operator");
        if (request.method === "GET") {
          const records = await studentIntel.listProgram({ subject: session.subject, isAdmin, programSpecialtyId });
          status = 200;
          sendJson(response, 200, { programSpecialtyId, records }, { cache: "no-store", requestId });
          return;
        }
        const input = validateStudentIntelInput(await readBody(request));
        const record = await studentIntel.submit({
          subject: session.subject,
          displayName: session.displayName,
          releaseId: registryIndex.registryReleaseId,
          programSpecialtyId,
          input,
        });
        status = 201;
        sendJson(response, 201, { record }, { cache: "no-store", requestId });
        return;
      }
      const corroborationMatch = url.pathname.match(/^\/api\/rise\/v1\/student-intel\/([^/]+)\/corroborate$/);
      if (request.method === "POST" && corroborationMatch) {
        if (!hasCapability(session, "rise:contribute")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "RISE private-beta contribution capability required", requestId);
          return;
        }
        const result = await studentIntel.corroborate({ subject: session.subject, submissionId: decodeURIComponent(corroborationMatch[1]) });
        if (!result) {
          status = 404;
          apiError(response, 404, "INTEL_NOT_FOUND", "Student Intel submission not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, result, { cache: "no-store", requestId });
        return;
      }
      const studentProgramMatch = url.pathname.match(/^\/api\/rise\/v1\/me\/programs\/([^/]+)$/);
      if (studentProgramMatch && (request.method === "PUT" || request.method === "DELETE")) {
        let programSpecialtyId;
        try {
          programSpecialtyId = decodeURIComponent(studentProgramMatch[1]);
        } catch {
          status = 400;
          apiError(response, 400, "INVALID_PROGRAM_ID", "Program specialty identifier is malformed", requestId);
          return;
        }
        if (!byProgramSpecialtyId.has(programSpecialtyId)) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        if (request.method === "DELETE") {
          await studentPrograms.delete({
            subject: session.subject,
            releaseId: registryIndex.registryReleaseId,
            programSpecialtyId,
          });
          status = 200;
          sendJson(response, 200, { deleted: true, programSpecialtyId }, { requestId });
          return;
        }
        const input = validateStudentProgramInput(await readBody(request));
        const record = await studentPrograms.put({
          subject: session.subject,
          releaseId: registryIndex.registryReleaseId,
          programSpecialtyId,
          ...input,
        });
        status = 200;
        sendJson(response, 200, { record }, { requestId });
        return;
      }
      if (url.pathname === "/api/rise/v1/me/profile" && (request.method === "GET" || request.method === "POST")) {
        if (!matrixProfile) {
          status = 409;
          apiError(response, 409, "MATRIX_PROFILE_UNAVAILABLE",
            "No authorized canonical Matrix profile adapter is configured for this release", requestId);
          return;
        }
        const payload = request.method === "GET"
          ? await matrixProfile.read({ request, subject: session.subject })
          : await (async () => {
            const body = await readBody(request);
            return matrixProfile.write({
              request,
              subject: session.subject,
              profile: body.profile,
              markComplete: body.mark_complete === true,
            });
          })();
        status = 200;
        sendJson(response, 200, payload, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/programs/catalog") {
        const records = searchReadModel.byName.map(listView);
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          total: records.length,
          records,
        }, { cache: "private, no-cache", requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/soap-2026") {
        const parameters = new URLSearchParams(url.searchParams);
        parameters.set("soap2026", "true");
        if (!parameters.has("sort")) parameters.set("sort", "soap_positions");
        const result = searchPrograms(searchReadModel, parameters);
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          cycle: 2026,
          wording: "SOAP 2026 - This program appeared in the 2026 SOAP results.",
          context: "SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.",
          ...result,
          filterOptions: registryIndex.filters,
        }, { cache: "private, no-cache", requestId });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/programs") {
        const result = searchPrograms(searchReadModel, url.searchParams);
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          ...result,
          filterOptions: registryIndex.filters,
        }, { cache: "no-store", requestId });
        return;
      }
      const profileMatch = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)$/);
      if (request.method === "GET" && profileMatch) {
        const record = byProgramSpecialtyId.get(decodeURIComponent(profileMatch[1]));
        if (!record) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, { registryReleaseId: registryIndex.registryReleaseId, program: record }, {
          cache: "no-store",
          requestId,
        });
        return;
      }
      const evidenceMatch = url.pathname.match(/^\/api\/rise\/v1\/program-specialties\/([^/]+)\/evidence$/);
      if (request.method === "GET" && evidenceMatch) {
        const record = byProgramSpecialtyId.get(decodeURIComponent(evidenceMatch[1]));
        if (!record) {
          status = 404;
          apiError(response, 404, "PROGRAM_NOT_FOUND", "Program specialty not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, {
          registryReleaseId: registryIndex.registryReleaseId,
          programSpecialtyId: record.programSpecialtyId,
          evidence: record.fields,
          source: record.source,
        }, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/rise/v1/matches:evaluate") {
        await readBody(request);
        status = 409;
        apiError(response, 409, "MATCHING_EVIDENCE_NOT_READY",
          "The current registry release has no current-cycle, source-located hard-match claims", requestId, {
            matchableClaims: registryIndex.counts.matchableClaims,
          });
        return;
      }
      const handoffMatch = url.pathname.match(/^\/api\/rise\/v1\/handoffs\/(actn|cam|storyforge)$/);
      if (request.method === "POST" && handoffMatch) {
        await readBody(request);
        status = 409;
        apiError(response, 409, "INTEGRATION_DISABLED", `${handoffMatch[1]} integration is disabled`, requestId);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/operator/student-intel") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        const [records, analytics] = await Promise.all([studentIntel.adminList(), studentIntel.analytics()]);
        status = 200;
        sendJson(response, 200, { records, analytics }, { cache: "no-store", requestId });
        return;
      }
      const intelAuditMatch = url.pathname.match(/^\/api\/rise\/v1\/operator\/student-intel\/([^/]+)\/audit$/);
      if (request.method === "GET" && intelAuditMatch) {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        const records = await studentIntel.audit({ submissionId: decodeURIComponent(intelAuditMatch[1]) });
        status = 200;
        sendJson(response, 200, { records }, { cache: "no-store", requestId });
        return;
      }
      const intelModerationMatch = url.pathname.match(/^\/api\/rise\/v1\/operator\/student-intel\/([^/]+)$/);
      if (request.method === "PATCH" && intelModerationMatch) {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        const input = validateModerationInput(await readBody(request));
        if (input.action === "PROMOTE_CANONICAL" && studentIntel.canonicalPromotionMode !== "live") {
          status = 409;
          apiError(response, 409, "CANONICAL_PROMOTION_SINK_UNAVAILABLE", "Canonical promotion is disabled until the canonical evidence sink is connected", requestId);
          return;
        }
        const record = await studentIntel.moderate({
          actorSubject: session.subject,
          submissionId: decodeURIComponent(intelModerationMatch[1]),
          action: input.action,
          input,
        });
        if (!record) {
          status = 404;
          apiError(response, 404, "INTEL_NOT_FOUND", "Student Intel submission not found", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, { record }, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/rise/v1/operator/student-intel/verification:preview") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        const preview = await studentIntel.verificationPreview();
        status = 200;
        sendJson(response, 200, preview, { cache: "no-store", requestId });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/rise/v1/operator/student-intel/verification:run") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        await readBody(request);
        status = 409;
        apiError(response, 409, "RESEARCH_FACTORY_UNAVAILABLE", "Student Intel paid verification is not connected to a bounded server-side factory bridge", requestId, { paidSubmissionAuthorized: false });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/operator/queue") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        status = 409;
        apiError(response, 409, "OPERATOR_BACKEND_DISABLED",
          "The offline release exposes quarantine counts, but no authorized operator backend exists", requestId, {
            quarantinedSourceRows: registryIndex.counts.quarantinedSourceRows,
          });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/rise/v1/operator/metrics") {
        if (!hasCapability(session, "rise:operator")) {
          status = 403;
          apiError(response, 403, "FORBIDDEN", "Operator capability required", requestId);
          return;
        }
        status = 200;
        sendJson(response, 200, metrics.snapshot(), { requestId });
        return;
      }
      status = 404;
      apiError(response, 404, "NOT_FOUND", "API route not found", requestId);
    } catch (error) {
      if (error.code === "BODY_TOO_LARGE") {
        status = 413;
        apiError(response, 413, error.code, error.message, requestId);
      } else if (error.code === "INVALID_JSON") {
        status = 400;
        apiError(response, 400, error.code, error.message, requestId);
      } else if (
        error.code === "INVALID_STUDENT_PROGRAM_STATE" || error.code === "INVALID_PROGRAM_NOTES" ||
        String(error.code ?? "").startsWith("INVALID_INTEL_") || error.code === "INTEL_SOURCE_URL_REQUIRED" ||
        error.code === "INTEL_PROMOTION_NOT_VERIFIED"
      ) {
        status = 400;
        apiError(response, 400, error.code, error.message, requestId);
      } else if (error.code === "SOURCE_RIGHTS_UNAVAILABLE") {
        status = 503;
        apiError(response, 503, error.code, "Current registry source rights could not be verified", requestId);
      } else if (error.code === "MATRIX_AUTH_REQUIRED" || error.code === "MATRIX_AUTH_REJECTED") {
        status = 401;
        apiError(response, 401, error.code, "Canonical Matrix authentication is required", requestId);
      } else if (error.code === "MATRIX_SUBJECT_INVALID" || error.code === "MATRIX_SUBJECT_MISMATCH") {
        status = 403;
        apiError(response, 403, error.code, "Canonical Matrix subject binding failed", requestId);
      } else if (error.code === "MATRIX_PROFILE_INVALID") {
        status = 400;
        apiError(response, 400, error.code, error.message, requestId);
      } else if (error.code === "MATRIX_PROFILE_UPSTREAM_UNAVAILABLE" || error.code === "MATRIX_PROFILE_UPSTREAM_REJECTED") {
        status = 503;
        apiError(response, 503, error.code, "Canonical Matrix profile owner is unavailable", requestId);
      } else {
        status = 500;
        logger.error?.({ event: "rise_request_error", requestId, message: error.message });
        apiError(response, 500, "INTERNAL_ERROR", "Unexpected service error", requestId);
      }
    } finally {
      const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
      metrics.observe(status, durationMs);
      logger.info?.({
        event: "rise_request",
        requestId,
        method: request.method,
        path: String(request.url ?? "").split("?", 1)[0],
        status,
        durationMs,
        subjectAuditId,
        sourceRightsDecisionId,
      });
    }
  });
}

export async function loadRegistryIndex(indexPath, {
  expectedSha256 = process.env.RISE_INDEX_SHA256,
  manifestPath = process.env.RISE_INDEX_MANIFEST_PATH,
  expectedManifestSha256 = process.env.RISE_INDEX_MANIFEST_SHA256,
  activationReceiptPath = process.env.RISE_ACTIVATION_RECEIPT_PATH,
  expectedActivationReceiptSha256 = process.env.RISE_ACTIVATION_RECEIPT_SHA256,
  production = isProductionEnvironment(),
  expectedSourceAuthorizationSha256s = process.env.RISE_SOURCE_AUTHORIZATION_SHA256S,
  revokedSourceAuthorizationSha256s = process.env.RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S,
} = {}) {
  if (production && !expectedSha256) {
    throw new Error("RISE_INDEX_SHA256 is required in production");
  }
  let preReadManifest = null;
  let manifestSha256 = null;
  if (production || manifestPath) {
    if (!manifestPath) throw new Error("RISE_INDEX_MANIFEST_PATH is required in production");
    const manifestBytes = await fs.readFile(manifestPath);
    manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
    if (production && !expectedManifestSha256) {
      throw new Error("RISE_INDEX_MANIFEST_SHA256 is required in production");
    }
    if (expectedManifestSha256 && manifestSha256 !== expectedManifestSha256) {
      throw new Error("RISE index manifest hash mismatch");
    }
    preReadManifest = JSON.parse(manifestBytes.toString("utf8"));
    if (
      preReadManifest.schemaVersion !== 1 ||
      preReadManifest.immutable !== true ||
      !/^[a-f0-9]{64}$/.test(preReadManifest.apiIndexSha256 ?? "") ||
      preReadManifest.apiIndexSha256 !== expectedSha256
    ) {
      throw new Error("RISE index manifest does not match the runtime index pin");
    }
    if (production && preReadManifest.dataClassification === "synthetic_test_fixture") {
      throw new Error("Synthetic RISE fixtures are prohibited in production");
    }
    if (preReadManifest.dataClassification !== "synthetic_test_fixture") {
      assertCurrentSourceRights({
        sourceRightsApproved: preReadManifest.sourceRightsApproved,
        sourceRights: preReadManifest.sourceRights,
      }, {
        production,
        expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
        revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
      });
    }
  }
  const source = await fs.readFile(indexPath);
  const actualSha256 = createHash("sha256").update(source).digest("hex");
  if (expectedSha256 && actualSha256 !== expectedSha256) {
    throw new Error(`RISE API index hash mismatch: expected ${expectedSha256}, received ${actualSha256}`);
  }
  const index = JSON.parse(source.toString("utf8"));
  if (index.schemaVersion !== 1 || !Array.isArray(index.programs)) throw new Error("Unsupported RISE API index");
  if (preReadManifest && index.registryReleaseId !== preReadManifest.registryReleaseId) {
    throw new Error("RISE index release does not match its pre-read manifest");
  }
  if (production && index.dataClassification === "synthetic_test_fixture") {
    throw new Error("Synthetic RISE fixtures are prohibited in production");
  }
  if (index.dataClassification !== "synthetic_test_fixture") {
    assertCurrentSourceRights(index.releaseGate, {
      production,
      expectedAuthorizationSha256s: expectedSourceAuthorizationSha256s,
      revokedAuthorizationSha256s: revokedSourceAuthorizationSha256s,
    });
  }
  if (production || activationReceiptPath) {
    if (!activationReceiptPath) throw new Error("RISE_ACTIVATION_RECEIPT_PATH is required in production");
    if (production && !expectedActivationReceiptSha256) {
      throw new Error("RISE_ACTIVATION_RECEIPT_SHA256 is required in production");
    }
    const receiptBytes = await fs.readFile(activationReceiptPath);
    const receiptSha256 = createHash("sha256").update(receiptBytes).digest("hex");
    if (expectedActivationReceiptSha256 && receiptSha256 !== expectedActivationReceiptSha256) {
      throw new Error("RISE activation receipt hash mismatch");
    }
    const activationReceipt = validateActivationReceipt(JSON.parse(receiptBytes.toString("utf8")), {
      registryReleaseId: index.registryReleaseId,
      apiIndexSha256: actualSha256,
      indexManifestSha256: manifestSha256,
    });
    index.artifactActivationStatus = index.activationStatus;
    index.activationStatus = "active";
    index.activationReceipt = { ...activationReceipt, sha256: receiptSha256 };
  }
  return index;
}

export async function loadWebBuild(webDirectory, {
  expectedManifestSha256 = process.env.RISE_ASSET_MANIFEST_SHA256,
  production = isProductionEnvironment(),
} = {}) {
  const manifestPath = path.join(webDirectory, "asset-manifest.json");
  let bytes;
  try {
    bytes = await fs.readFile(manifestPath);
  } catch (error) {
    if (error.code === "ENOENT" && !production) return { buildId: "local-unversioned", files: null };
    throw error;
  }
  const actualManifestSha256 = createHash("sha256").update(bytes).digest("hex");
  if (production && !expectedManifestSha256) throw new Error("RISE_ASSET_MANIFEST_SHA256 is required in production");
  if (expectedManifestSha256 && actualManifestSha256 !== expectedManifestSha256) {
    throw new Error("RISE web asset manifest hash mismatch");
  }
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (
    manifest.schemaVersion !== 1 || !manifest.buildId || !manifest.files ||
    typeof manifest.files !== "object" || Array.isArray(manifest.files)
  ) {
    throw new Error("Unsupported RISE web asset manifest");
  }
  if (production) {
    const missing = REQUIRED_WEB_ASSET_PATHS.filter((relative) => !Object.hasOwn(manifest.files, relative));
    if (missing.length) throw new Error(`RISE web asset manifest is incomplete: ${missing.join(", ")}`);
  }
  const root = `${path.resolve(webDirectory)}${path.sep}`;
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const absolute = path.resolve(webDirectory, relative);
    if (!absolute.startsWith(root) || !/^[a-f0-9]{64}$/.test(expected)) {
      throw new Error(`Invalid RISE web asset manifest entry: ${relative}`);
    }
    const actual = createHash("sha256").update(await fs.readFile(absolute)).digest("hex");
    if (actual !== expected) throw new Error(`RISE web asset hash mismatch: ${relative}`);
  }
  return { ...manifest, manifestSha256: actualManifestSha256 };
}

export async function startFromEnvironment() {
  const production = isProductionEnvironment();
  if (production) validateProductionEnvironment();
  const indexPath = process.env.RISE_INDEX_PATH;
  if (!indexPath) throw new Error("RISE_INDEX_PATH is required");
  const index = await loadRegistryIndex(path.resolve(indexPath), { production });
  const webDirectory = process.env.RISE_WEB_DIRECTORY
    ? path.resolve(process.env.RISE_WEB_DIRECTORY)
    : DEFAULT_WEB_DIRECTORY;
  const authMode = process.env.RISE_AUTH_MODE ?? "local-preview";
  let authenticator;
  let abuseController;
  let sourceRightsController;
  let studentStore;
  let studentIntelStore;
  let matrixProfileAdapter;
  if (authMode === "injected") {
    const adapterPath = process.env.RISE_AUTH_ADAPTER_MODULE;
    if (!adapterPath) throw new Error("RISE_AUTH_ADAPTER_MODULE is required for injected authentication");
    const adapter = await import(pathToFileURL(path.resolve(adapterPath)).href);
    if (typeof adapter.authenticateRiseRequest !== "function") {
      throw new Error("RISE auth adapter must export authenticateRiseRequest(request)");
    }
    authenticator = adapter.authenticateRiseRequest;
  }
  const abuseAdapterPath = process.env.RISE_ABUSE_ADAPTER_MODULE;
  if (abuseAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(abuseAdapterPath)).href);
    if (typeof adapter.createRiseAbuseController !== "function") {
      throw new Error("RISE abuse adapter must export createRiseAbuseController()");
    }
    abuseController = await adapter.createRiseAbuseController();
  }
  const sourceRightsAdapterPath = process.env.RISE_SOURCE_RIGHTS_ADAPTER_MODULE;
  if (sourceRightsAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(sourceRightsAdapterPath)).href);
    if (typeof adapter.createRiseSourceRightsController !== "function") {
      throw new Error("RISE source-rights adapter must export createRiseSourceRightsController()");
    }
    sourceRightsController = await adapter.createRiseSourceRightsController();
  }
  const studentStateAdapterPath = process.env.RISE_STUDENT_STATE_ADAPTER_MODULE;
  if (studentStateAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(studentStateAdapterPath)).href);
    if (typeof adapter.createRiseStudentStore !== "function") {
      throw new Error("RISE student-state adapter must export createRiseStudentStore()");
    }
    studentStore = await adapter.createRiseStudentStore();
  }
  const studentIntelAdapterPath = process.env.RISE_STUDENT_INTEL_ADAPTER_MODULE ?? studentStateAdapterPath;
  if (studentIntelAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(studentIntelAdapterPath)).href);
    if (typeof adapter.createRiseStudentIntelStore !== "function") {
      throw new Error("RISE Student Intel adapter must export createRiseStudentIntelStore()");
    }
    studentIntelStore = await adapter.createRiseStudentIntelStore();
  }
  const matrixProfileAdapterPath = process.env.RISE_MATRIX_PROFILE_ADAPTER_MODULE;
  if (matrixProfileAdapterPath) {
    const adapter = await import(pathToFileURL(path.resolve(matrixProfileAdapterPath)).href);
    if (typeof adapter.createMatrixProfileAdapter !== "function") {
      throw new Error("RISE Matrix profile adapter must export createMatrixProfileAdapter()");
    }
    matrixProfileAdapter = adapter.createMatrixProfileAdapter();
  }
  if (production && index.dataClassification !== "synthetic_test_fixture") {
    const current = await sourceRightsController?.assertCurrent({
      registryReleaseId: index.registryReleaseId,
      authorizationSha256s: index.releaseGate?.sourceRights?.map((right) => right.sha256) ?? [],
    });
    if (!current) throw new Error("Production RISE source rights are not currently verified");
  }
  const webBuild = await loadWebBuild(webDirectory, { production });
  if (production && !process.env.RISE_BUILD_ID) {
    throw new Error("RISE_BUILD_ID is required in production");
  }
  if (process.env.RISE_BUILD_ID && process.env.RISE_BUILD_ID !== webBuild.buildId) {
    throw new Error("RISE_BUILD_ID does not match the authenticated web build");
  }
  const host = process.env.RISE_HOST ?? (production ? "0.0.0.0" : "127.0.0.1");
  validateListenConfiguration({ host, authMode, riseEnvironment: process.env.RISE_ENVIRONMENT });
  const server = createRiseServer({
    registryIndex: index,
    webDirectory,
    authMode,
    authenticator,
    authIssuer: process.env.RISE_AUTH_ISSUER,
    loginUrl: process.env.RISE_LOGIN_URL,
    auditHmacKey: process.env.RISE_AUDIT_HMAC_KEY,
    abuseController,
    sourceRightsController,
    studentStore,
    studentIntelStore,
    matrixProfileAdapter,
    buildId: webBuild.buildId,
    production,
  });
  const port = Number.parseInt(process.env.PORT ?? "4177", 10);
  server.listen(port, host, () => {
    process.stdout.write(`${JSON.stringify({
      service: "missionmed-rise",
      url: `http://${host}:${port}/rise/`,
      registryReleaseId: index.registryReleaseId,
      authMode,
    })}\n`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startFromEnvironment().catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
