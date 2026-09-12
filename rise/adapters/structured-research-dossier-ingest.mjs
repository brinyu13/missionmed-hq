import { createHash } from "node:crypto";

import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";

export const STRUCTURED_DOSSIER_CONTRACT = "rise-structured-research-dossier-v1";

const DOMAIN_SPECS = Object.freeze([
  ["identity_structure", ["identity_structure", "1_identity_structure"]],
  ["visa", ["visa", "2_visa"]],
  ["step1_policy", ["step1_policy", "3_step1_policy"]],
  ["step2_requirement", ["step2_requirement", "step2_requirement_minimum_score", "4_step2_requirement", "4_step2_requirement_minimum"]],
  ["step2_timing", ["step2_timing", "5_step2_timing"]],
  ["attempts_policy", ["attempts_policy", "6_attempts_policy"]],
  ["yog_policy", ["yog_limit", "7_yog_limit"]],
  ["usce", ["usce_requirement", "8_usce_requirement"]],
  ["ecfmg", ["ecfmg_requirement", "9_ecfmg_requirement"]],
  ["deadline_signaling", ["application_deadline_signaling", "deadline_signaling", "10_deadline_and_signaling", "10_deadline_signaling"]],
  ["resident_roster", ["current_residents", "11_current_residents"]],
  ["resident_medical_schools", ["resident_medical_schools", "12_resident_medical_schools"]],
  ["resident_composition", ["resident_composition", "13_resident_composition"]],
  ["leadership", ["leadership_pd_apd", "program_leadership", "14_leadership", "14_program_leadership"]],
  ["core_faculty", ["core_faculty", "15_core_faculty"]],
  ["movement_disorders", ["movement_disorders", "16_movement_disorders"]],
  ["ms_neuroimmunology", ["ms_neuroimmunology", "17_ms_neuroimmunology"]],
  ["fellowship_inventory", ["fellowships", "neurology_fellowships", "18_fellowships"]],
  ["outcomes", ["graduate_outcomes", "19_graduate_outcomes"]],
  ["board_pass_rate", ["board_pass_rate", "20_board_pass_rate"]],
  ["salary_benefits", ["salary_benefits", "21_salary_benefits"]],
  ["curriculum", ["curriculum_training", "curriculum_training_structure", "22_curriculum", "22_curriculum_training_structure"]],
  ["program_differentiators", ["why_this_program", "23_why_this_program"]],
  ["spanish_latino_relevance", ["spanish_latino", "spanish_latino_relevance", "24_spanish_latino_relevance"]],
  ["ucc_puerto_rico", ["ucc_puerto_rico", "25_ucc_puerto_rico"]],
  ["sources_freshness", ["sources_freshness", "sources_freshness_completion", "26_sources_freshness_completion"]],
]);

const COMPLETED_STATES = new Set([
  "VERIFIED", "PARTIALLY_VERIFIED", "RESEARCHED_NOT_FOUND", "CONFLICT", "NOT_APPLICABLE", "STALE", "UNAVAILABLE",
]);

const PROVIDER_ALIASES = new Map([
  ["CLAUDE_OPUS_5", "CLAUDE_OPUS"], ["CLAUDE_OPUS", "CLAUDE_OPUS"],
  ["CLAUDE_SONNET", "CLAUDE_SONNET"], ["PARALLEL", "PARALLEL"],
  ["OPENAI_TERRA", "OPENAI"], ["OPENAI_SOL", "OPENAI"], ["OPENAI", "OPENAI"],
  ["RISE_REPLAY_TEST", "RISE_REPLAY_TEST"],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clean(value) {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
}

function studentSafeValue(value) {
  if (typeof value === "string") {
    const parts = value.split(/(?<=[.!?])\s+|\s*;\s*/).map(clean).filter(Boolean);
    return parts.filter((part) => !/\bAlejandra\b/i.test(part)).join("; ") || null;
  }
  if (Array.isArray(value)) return value.map(studentSafeValue).filter((item) => item !== null);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, studentSafeValue(item)]));
  }
  return value;
}

function stateForStudent(sourceState) {
  return ({
    VERIFIED: "VERIFIED",
    PARTIALLY_VERIFIED: "VERIFIED",
    RESEARCHED_NOT_FOUND: "RESEARCHED_NOT_PUBLIC",
    CONFLICT: "CONFLICT",
    NOT_APPLICABLE: "RESEARCHED_NOT_PUBLIC",
    STALE: "STALE_NEEDS_REFRESH",
    UNAVAILABLE: "RESEARCHED_NOT_PUBLIC",
    NOT_RESEARCHED: "NOT_YET_RESEARCHED",
  })[sourceState] ?? "NOT_YET_RESEARCHED";
}

function domainEntry(domains, aliases) {
  for (const alias of aliases) if (domains?.[alias]) return { sourceKey: alias, ...domains[alias] };
  return null;
}

function urls(entry) {
  return [...new Set((entry?.source_urls ?? []).filter((url) => /^https:\/\//i.test(String(url))))].sort();
}

function valueSummary(value) {
  const safe = studentSafeValue(value);
  if (typeof safe === "string") return clean(safe);
  if (safe && typeof safe === "object") return clean(JSON.stringify(safe));
  return null;
}

function normalizeResident(row, index) {
  if (!row || typeof row !== "object") return null;
  const school = clean(row.normalized_school ?? row.medical_school ?? row.school);
  const degree = clean(row.degree ?? row.degree_credential);
  let classification = clean(row.classification ?? row.category);
  if (!classification && /\bD\.?O\.?\b/i.test(degree ?? "")) classification = "US_DO";
  if (!classification && /international|non-US|M\.B\.B\.S|MBBS/i.test(`${school ?? ""} ${degree ?? ""}`)) classification = "IMG";
  return {
    row_key: `${clean(row.name)?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-") || "resident"}-${index + 1}`,
    name: clean(row.name) ?? "Resident name not published",
    pgy: clean(row.pgy ?? row.pgy_year ?? row.pgy_level ?? row.class),
    track: clean(row.track),
    degree,
    medical_school: school && !/^(?:RESEARCHED_NOT_FOUND|NOT_FOUND)$/i.test(school) ? school : null,
    medical_school_country: clean(row.school_country ?? row.medical_school_country ?? row.country),
    classification,
    caribbean: row.caribbean === true || /caribbean/i.test(`${classification ?? ""} ${school ?? ""}`),
    source_url: clean(row.source_url ?? row.url),
  };
}

function leadershipRows(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([role, person]) => {
      if (typeof person === "string") return [{ name: clean(person), role: clean(role.replaceAll("_", " ")) }];
      if (person && typeof person === "object") return [{ name: clean(person.name), role: clean(person.role ?? person.title ?? role.replaceAll("_", " ")), credentials: clean(person.credentials ?? person.degree), source_url: clean(person.source_url ?? person.url) }];
      return [];
    }).filter((row) => row.name);
  }
  const text = clean(value);
  if (!text) return [];
  return text.split(/\s*;\s*/).flatMap((part) => {
    const match = part.match(/^(?:(Program Director|PD|Associate Program Director|APD|Assistant Program Director|Chair|Vice[- ]Chair|Coordinator)\s*(?:=|:)?\s*)(.+)$/i);
    return match ? [{ name: clean(match[2]), role: clean(match[1]) }] : [];
  });
}

function summaryRows(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? { summary: clean(item) } : item).filter(Boolean);
  const summary = valueSummary(value);
  return summary ? [{ summary }] : [];
}

function safeDifferentiators(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows.map(clean).filter((item) => item && !/\bAlejandra\b|\byour\b|\byou\b|\bapplicant'?s\b/i.test(item)).map((summary) => ({ summary }));
}

function explicitVisa(value, label) {
  if (value && typeof value === "object") {
    const key = label === "J-1" ? ["j1", "j_1"] : ["h1b", "h_1b"];
    for (const candidate of key) if (candidate in value) return value[candidate] === true;
  }
  const text = clean(value) ?? "";
  const token = label === "J-1" ? "J-?1" : "H-?1B";
  const mentions = text.split(/[.;]/).filter((part) => new RegExp(`\\b${token}\\b`, "i").test(part));
  return mentions.some((part) => !new RegExp(`(?:\\b(?:no|not|without)\\b.{0,24}\\b${token}\\b|\\b${token}\\b.{0,32}\\b(?:no|not offered|not sponsored|not listed|unavailable)\\b)`, "i").test(part));
}

function projectionClaims(record, resolved, claim) {
  const projections = [];
  const completed = (name) => resolved.get(name) && ["VERIFIED", "PARTIALLY_VERIFIED"].includes(resolved.get(name).state);
  const push = (field, value, domains) => {
    const sourceUrls = [...new Set(domains.flatMap((name) => urls(resolved.get(name))))].sort();
    if (value === null || value === undefined || (Array.isArray(value) && !value.length)) return;
    projections.push(claim(field, value, sourceUrls, `#/projections/${field}`,
      domains.some((name) => resolved.get(name)?.state === "PARTIALLY_VERIFIED") ? "PARTIALLY_VERIFIED" : "VERIFIED"));
  };
  if (completed("visa")) {
    const entry = resolved.get("visa");
    const value = entry.normalized_value;
    const j1 = explicitVisa(value, "J-1");
    const h1b = explicitVisa(value, "H-1B");
    push("research.visa", { j1, h1b, supported: [j1 ? "J-1" : null, h1b ? "H-1B" : null].filter(Boolean), summary: valueSummary(value), evidenceState: stateForStudent(entry.state) }, ["visa"]);
  }
  const applicationDomains = ["step1_policy", "step2_requirement", "step2_timing", "attempts_policy", "yog_policy", "usce", "ecfmg", "deadline_signaling"].filter((name) => completed(name));
  if (applicationDomains.length) push("research.application_requirements", Object.fromEntries(applicationDomains.map((name) => [name, studentSafeValue(resolved.get(name).normalized_value)])), applicationDomains);
  if (completed("resident_roster")) push("research.resident_roster", (record.resident_roster ?? []).map(normalizeResident).filter(Boolean), ["resident_roster"]);
  if (completed("resident_medical_schools")) push("research.resident_medical_schools", summaryRows(resolved.get("resident_medical_schools").normalized_value), ["resident_medical_schools"]);
  if (completed("resident_composition")) push("research.resident_composition", resolved.get("resident_composition").normalized_value ?? record.resident_composition, ["resident_composition"]);
  if (completed("leadership")) push("research.leadership", leadershipRows(resolved.get("leadership").normalized_value), ["leadership"]);
  if (completed("core_faculty")) push("research.core_faculty", summaryRows(resolved.get("core_faculty").normalized_value), ["core_faculty"]);
  if (completed("fellowship_inventory")) push("research.fellowship_inventory", summaryRows(resolved.get("fellowship_inventory").normalized_value), ["fellowship_inventory"]);
  if (completed("outcomes")) push("research.outcomes", summaryRows(resolved.get("outcomes").normalized_value), ["outcomes"]);
  if (completed("curriculum")) push("research.curriculum", { summary: valueSummary(resolved.get("curriculum").normalized_value) }, ["curriculum"]);
  if (completed("salary_benefits")) push("research.salary_benefits", { summary: valueSummary(resolved.get("salary_benefits").normalized_value) }, ["salary_benefits"]);
  const differentiators = safeDifferentiators(record.why_this_program);
  if (completed("program_differentiators") && differentiators.length) push("research.program_differentiators", differentiators, ["program_differentiators"]);
  return projections;
}

export function normalizeStructuredResearchDossier({ record, sourceBytes, sourceFile }) {
  const acgmeId = clean(record?.acgme_id);
  if (!/^180\d{7}$/.test(acgmeId ?? "")) throw new Error("Structured dossier must be an Adult Neurology ACGME identity");
  if (!/adult neurology/i.test(String(record?.specialty_confirmed ?? ""))) throw new Error("Structured dossier specialty was not independently confirmed as Adult Neurology");
  if (!/child neurology/i.test(String(record?.child_neurology_contamination_check ?? ""))) throw new Error("Structured dossier is missing the Child Neurology contamination check");
  const stagedAt = `${clean(record?.retrieved_date)}T12:00:00.000Z`;
  if (!Number.isFinite(Date.parse(stagedAt))) throw new Error("Structured dossier retrieved_date is invalid");
  const sourceFileSha256 = sha256(sourceBytes);
  const providerInput = clean(record.provider)?.toUpperCase();
  const provider = PROVIDER_ALIASES.get(providerInput);
  if (!provider) throw new Error(`Unsupported structured dossier provider: ${providerInput}`);
  const campaignId = clean(record.research_ticket);
  const providerRunId = `${campaignId}:${acgmeId}:${sourceFileSha256}`;
  const identity = canonicalProgramSpecialtyIdentity(acgmeId, "Neurology");
  const resolved = new Map();
  for (const [name, aliases] of DOMAIN_SPECS) {
    const entry = domainEntry(record.domains, aliases);
    if (!entry) throw new Error(`Structured dossier ${acgmeId} is missing domain ${name}`);
    const state = clean(entry.state)?.toUpperCase();
    if (!COMPLETED_STATES.has(state)) throw new Error(`Structured dossier ${acgmeId} domain ${name} is not complete: ${state}`);
    resolved.set(name, { ...entry, state });
  }
  const claim = (field, value, sourceUrls, sourceLocator, evidenceState) => ({
    ...createCanonicalEvidenceClaim({
      subjectId: identity.program.id, field, value, provider, providerRunId,
      sourceType: "completed_structured_research_dossier", sourceUrl: sourceUrls[0] ?? null,
      sourceLocator: `${sourceFile}${sourceLocator}`, retrievedAt: stagedAt,
      publicationState: "REVIEW_REQUIRED", reviewState: "PENDING",
      conflictState: evidenceState === "CONFLICT" ? "UNRESOLVED" : "NONE",
    }),
    provider, evidenceState, directSourceUrls: sourceUrls, dossierSourceUrls: sourceUrls, sourceUrls,
  });
  const claims = [...resolved].map(([name, entry]) => {
    const sourceUrls = urls(entry);
    return claim(`research.domain.${name}`, {
      state: stateForStudent(entry.state), sourceState: entry.state,
      summary: valueSummary(entry.normalized_value ?? entry.raw_finding),
      confidence: clean(entry.confidence), sourceType: clean(entry.source_type), retrievedDate: clean(record.retrieved_date),
    }, sourceUrls, `#/domains/${entry.sourceKey}`, entry.state);
  });
  claims.push(...projectionClaims(record, resolved, claim));
  return {
    contractId: STRUCTURED_DOSSIER_CONTRACT, provider, providerKey: providerInput, campaignId, acgmeId, stagedAt,
    sourceFile, sourceFileSha256, providerRunId,
    idempotencyKey: sha256(`${provider}\0${campaignId}\0${acgmeId}\0${sourceFileSha256}`),
    claims, domainCount: resolved.size, newSpendUsd: 0,
  };
}

export function structuredDossierSummary(ingests) {
  return {
    contractId: STRUCTURED_DOSSIER_CONTRACT,
    programs: ingests.length,
    acgmeIds: ingests.map((item) => item.acgmeId).sort(),
    domainsAttempted: ingests.reduce((sum, item) => sum + item.domainCount, 0),
    claims: ingests.reduce((sum, item) => sum + item.claims.length, 0),
    notYetResearchedDomains: ingests.flatMap((item) => item.claims).filter((claim) => claim.evidenceState === "NOT_RESEARCHED").length,
    newProviderSpendUsd: 0,
  };
}
