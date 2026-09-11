import { createHash } from "node:crypto";

export const REVIEW_RULE_VERSION = "5012d.1";
export const FINAL_DISPOSITIONS = Object.freeze([
  "APPROVED_CURRENT", "APPROVED_HISTORICAL", "RESEARCHED_NOT_FOUND", "SUPERSEDED",
  "CONFLICT_REQUIRES_REVIEW", "INSUFFICIENT_EVIDENCE", "STALE_NEEDS_REFRESH", "IDENTITY_AMBIGUITY",
]);
export const PRESERVED_CANARY_ACGME_IDS = new Set(["1851113100", "1854831078"]);

const SOCIAL_HOSTS = /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|reddit\.com|tiktok\.com|x\.com|youtube\.com)$/i;
const SECONDARY_HOSTS = /(^|\.)(doximity\.com|imgprep\.com|matcharesident\.com|residencyadvisor\.com|residencymatch\.ai|residencyprograms\.io|wikipedia\.org)$/i;
const REFERENCE_HOSTS = /(^|\.)(abim\.org|freida\.ama-assn\.org|programdirectory\.nrmp\.org)$/i;
const NOT_RESEARCHED = /\b(?:not[_ ]re-?researched|not[_ ]researched|outside (?:the )?(?:specified )?scope|already.complete.not.researched|not a missing.field target)\b/i;
const NOT_FOUND = /\b(?:researched[_ ]not[_ ]found|unavailable|not[_ ]applicable|unknown_after_recovery_search|not[_ ]found|not[_ ]available|not[_ ]reported|not[_ ]published|no published|unable to (?:locate|verify)|no exact program|verified absent)\b/i;
const CONFLICT = /\b(?:conflicting|conflict_requires_review|unresolved conflict|conflict note|vs\.?\s+(?:official|freida|program))\b/i;
const HISTORICAL = /\b(?:former|previous|historical|class of 20(?:1\d|2[0-4])|20(?:1\d|2[0-4]) roster)\b/i;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function textOf(value) {
  return JSON.stringify(value ?? null).replaceAll("\\u", " ");
}

function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

export function classifySourceUrls(urls = []) {
  const result = { institutional: [], reference: [], secondary: [], social: [], invalid: [] };
  for (const url of [...new Set(urls)].sort()) {
    const host = hostOf(url);
    if (!host) result.invalid.push(url);
    else if (SOCIAL_HOSTS.test(host)) result.social.push(url);
    else if (SECONDARY_HOSTS.test(host)) result.secondary.push(url);
    else if (REFERENCE_HOSTS.test(host)) result.reference.push(url);
    else result.institutional.push(url);
  }
  return result;
}

function scalar(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const key of keys) if (value[key] !== undefined && value[key] !== null) return value[key];
  return null;
}

function cleanString(value) {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
}

const SCHOOL_ALIASES = new Map([
  ["st georges university", "St. George's University School of Medicine"],
  ["st georges university school of medicine", "St. George's University School of Medicine"],
  ["sgu", "St. George's University School of Medicine"],
  ["ross university", "Ross University School of Medicine"],
  ["ross university school of medicine", "Ross University School of Medicine"],
  ["american university of the caribbean", "American University of the Caribbean School of Medicine"],
  ["american university of the caribbean school of medicine", "American University of the Caribbean School of Medicine"],
  ["lake erie college of osteopathic medicine", "Lake Erie College of Osteopathic Medicine"],
]);

export function normalizeMedicalSchool(rawValue) {
  const raw = cleanString(rawValue);
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[.'’\-]/g, "").replace(/\s+/g, " ").trim();
  return { raw, canonical: SCHOOL_ALIASES.get(key) ?? raw, aliasApplied: SCHOOL_ALIASES.has(key) };
}

function rows(value) {
  if (Array.isArray(value)) return value.flatMap((item) => Array.isArray(item) ? rows(item) : [item]);
  if (value && typeof value === "object") {
    for (const key of ["full_roster", "residents", "roster", "pgy_1", "pgy_2", "pgy_3", "pgy4_chiefs", "pgy3_chiefs", "other_residents_identified"]) {
      if (Array.isArray(value[key])) return value[key].flatMap(rows);
    }
  }
  return [];
}

function normalizeRoster(value) {
  return rows(value).filter((row) => row && typeof row === "object" && cleanString(row.name)).map((row) => {
    const school = normalizeMedicalSchool(row.medical_school ?? row.school);
    return {
      name: cleanString(row.name),
      degree: cleanString(row.degree),
      medical_school: school?.canonical ?? null,
      medical_school_raw: school?.raw ?? null,
      pgy: cleanString(row.pgy ?? row.pgy_year ?? row.pgy_level ?? row.PGY ?? row.class ?? row.class_of),
      classification: cleanString(row.classification),
      caribbean: row.caribbean ?? row.Caribbean ?? row.caribbean_status ?? null,
      source_url: cleanString(row.source_url ?? row.url),
    };
  });
}

function normalizeLeadership(value) {
  return rows(value).filter((row) => row && typeof row === "object" && cleanString(row.name)).map((row) => ({
    name: cleanString(row.name),
    role: cleanString(row.role ?? row.title),
    credentials: cleanString(row.credentials ?? row.degree),
    source_url: cleanString(row.source_url ?? row.official_profile_url ?? row.profile_url ?? row.url),
  }));
}

function normalizeGenericRows(value) {
  return rows(value).filter((row) => row && typeof row === "object")
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, item]) => [key, typeof item === "string" ? cleanString(item) : item])))
    .filter((row) => Object.values(row).some((item) => item !== null && item !== undefined && item !== ""));
}

function normalizeFellowships(value) {
  return rows(value).map((row) => typeof row === "string" ? { name: cleanString(row) } : {
    name: cleanString(row?.name ?? row?.program ?? row?.fellowship),
    classification: cleanString(row?.classification ?? row?.category),
    source_url: cleanString(row?.source_url ?? row?.url),
  }).filter((row) => row.name);
}

function normalizedValue(field, value) {
  if (field === "research.resident_roster") return normalizeRoster(value);
  if (field === "research.leadership") return normalizeLeadership(value);
  if (field === "research.fellowship_inventory") return normalizeFellowships(value);
  if ([
    "research.resident_medical_schools", "research.core_faculty", "research.faculty_training_graph",
    "research.program_differentiators",
  ].includes(field)) return normalizeGenericRows(value);
  return value;
}

function isValid(field, value) {
  if (field === "research.resident_roster") return normalizeRoster(value).length > 0;
  if (field === "research.leadership") return normalizeLeadership(value).some((row) => row.role);
  if (field === "research.fellowship_inventory") return normalizeFellowships(value).length > 0;
  if ([
    "research.resident_medical_schools", "research.core_faculty", "research.faculty_training_graph",
    "research.program_differentiators",
  ].includes(field)) return normalizeGenericRows(value).length > 0;
  if (field === "research.abim") {
    const rate = scalar(value, ["pass_rate", "passRate", "rate", "percent_passing", "pass_rate_value"]);
    const match = String(rate ?? "").match(/(?:^|\D)(100|\d{1,2})(?:\.\d+)?\s*%/);
    return Boolean(match) && Number(match[1]) >= 0 && Number(match[1]) <= 100;
  }
  if (field === "research.visa") {
    const visa = textOf(value);
    return /\b(?:J-?1|H-?1B|visa|sponsor)/i.test(visa) && !/^\{\}$/.test(visa);
  }
  if (/accessibility$/.test(field)) {
    const signal = cleanString(scalar(value, ["signal", "signal_strength", "classification"])) ?? textOf(value);
    return !/^(?:UNKNOWN|NONE|NOT[_ ]RESEARCHED)/i.test(signal) && /\b(?:STRONG|HIGH|MODERATE|LIMITED|SUPPORTED|CONFIRMED|ROSTER|RESIDENT|COMLEX|IMG|DO|CARIBBEAN|EVIDENCE)/i.test(signal);
  }
  return value !== null && value !== undefined;
}

function preliminaryDecision({ claim, acgmeId, identityResolved = true, allowedCanaryAcgmeIds = new Set() }) {
  const sourceQuality = classifySourceUrls(claim.sourceUrls);
  const text = textOf(claim.value);
  const sourceCount = sourceQuality.institutional.length + sourceQuality.reference.length;
  const base = {
    claimId: claim.id, acgmeId, field: claim.field, provider: claim.provider,
    sourceUrls: claim.sourceUrls ?? [], directSourceUrls: claim.directSourceUrls ?? [],
    normalizedValue: normalizedValue(claim.field, claim.value), ruleVersion: REVIEW_RULE_VERSION,
  };
  if (!identityResolved || !/^\d{10}$/.test(String(acgmeId ?? ""))) return { ...base, disposition: "IDENTITY_AMBIGUITY", reason: "canonical_identity_not_exact", qualityScore: 0 };
  if (PRESERVED_CANARY_ACGME_IDS.has(String(acgmeId)) && !allowedCanaryAcgmeIds.has(String(acgmeId))) {
    throw new Error(`Protected 5012A canary holdout entered review without an exact 5012E allowance: ${acgmeId}`);
  }
  if (NOT_RESEARCHED.test(text)) return { ...base, disposition: "INSUFFICIENT_EVIDENCE", reason: "source_explicitly_says_not_researched", qualityScore: 0 };
  if (CONFLICT.test(text)) return { ...base, disposition: "CONFLICT_REQUIRES_REVIEW", reason: "claim_contains_unresolved_conflict", qualityScore: 0 };
  if (NOT_FOUND.test(text)) return { ...base, disposition: "RESEARCHED_NOT_FOUND", reason: "completed_search_found_no_supportable_published_answer", qualityScore: sourceCount };
  if (!sourceCount) return { ...base, disposition: "INSUFFICIENT_EVIDENCE", reason: "no_credible_source_url", qualityScore: 0 };
  if (!isValid(claim.field, claim.value)) return { ...base, disposition: "INSUFFICIENT_EVIDENCE", reason: "field_schema_or_semantics_not_supportable", qualityScore: sourceCount };
  const historical = HISTORICAL.test(text) && !/\b(?:current|2025|2026|2027)\b/i.test(text);
  return {
    ...base,
    disposition: historical ? "APPROVED_HISTORICAL" : "APPROVED_CURRENT",
    reason: historical ? "source_linked_historical_fact" : "source_linked_schema_valid_current_fact",
    qualityScore: (claim.directSourceUrls?.length ? 100 : 0) + sourceQuality.institutional.length * 10 + sourceQuality.reference.length * 5,
  };
}

function mergeValues(field, decisions) {
  if ([
    "research.resident_roster", "research.resident_medical_schools", "research.leadership",
    "research.core_faculty", "research.faculty_training_graph", "research.fellowship_inventory",
    "research.program_differentiators",
  ].includes(field)) {
    const unique = new Map();
    for (const decision of decisions) for (const row of decision.normalizedValue) unique.set(digest(row), row);
    return [...unique.values()].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  }
  return decisions[0].normalizedValue;
}

export function reviewResearchCorpus(ingests, { resolvedAcgmeIds = null, allowedCanaryAcgmeIds = new Set() } = {}) {
  const preliminary = ingests.flatMap((ingest) => ingest.claims.map((claim) => preliminaryDecision({
    claim, acgmeId: ingest.acgmeId,
    identityResolved: resolvedAcgmeIds ? resolvedAcgmeIds.has(String(ingest.acgmeId)) : true,
    allowedCanaryAcgmeIds,
  })));
  const grouped = new Map();
  for (const decision of preliminary) {
    const key = `${decision.acgmeId}\0${decision.field}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(decision);
  }
  const final = [];
  const promotions = [];
  for (const group of grouped.values()) {
    const approved = group.filter((decision) => decision.disposition === "APPROVED_CURRENT")
      .sort((left, right) => right.qualityScore - left.qualityScore || left.claimId.localeCompare(right.claimId));
    const mergeable = [
      "research.resident_roster", "research.resident_medical_schools", "research.leadership",
      "research.core_faculty", "research.faculty_training_graph", "research.fellowship_inventory",
      "research.program_differentiators",
    ].includes(group[0].field);
    for (const decision of group) {
      if (decision.disposition !== "APPROVED_CURRENT" || mergeable || decision === approved[0]) final.push(decision);
      else final.push({ ...decision, disposition: "SUPERSEDED", reason: `stronger_current_claim:${approved[0].claimId}` });
    }
    if (approved.length) {
      const contributors = mergeable ? approved : [approved[0]];
      promotions.push({
        acgmeId: group[0].acgmeId,
        field: group[0].field,
        canonicalValue: mergeValues(group[0].field, contributors),
        sourceClaimIds: contributors.map((item) => item.claimId),
        sourceUrls: [...new Set(contributors.flatMap((item) => item.sourceUrls))].sort(),
        publicationState: "PRIVATE_BETA",
        reviewState: "APPROVED",
      });
    }
  }
  final.sort((left, right) => left.claimId.localeCompare(right.claimId));
  promotions.sort((left, right) => left.acgmeId.localeCompare(right.acgmeId) || left.field.localeCompare(right.field));
  if (final.length !== preliminary.length || final.some((item) => !FINAL_DISPOSITIONS.includes(item.disposition))) {
    throw new Error("Every provider claim must receive exactly one final disposition");
  }
  const dispositions = Object.fromEntries(FINAL_DISPOSITIONS.map((name) => [name, final.filter((item) => item.disposition === name).length]));
  return { ruleVersion: REVIEW_RULE_VERSION, decisions: final, promotions, dispositions };
}
