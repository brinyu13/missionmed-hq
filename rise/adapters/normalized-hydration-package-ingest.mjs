import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";

export const NORMALIZED_HYDRATION_CONTRACT = "rise-normalized-hydration-package-v1";
export const TERMINAL_STATE_CONTRACT = "rise-terminal-evidence-state-v1";
export const EXPECTED_PACKAGE_COUNTS = Object.freeze({
  programs: 34, domainFacts: 884, residents: 566, composition: 34,
  leadership: 212, faculty: 636, fellowshipOutcomes: 34,
  applicationRequirements: 34, tracks: 46, reconciliation: 785,
  sourceManifest: 4032, exceptions: 477, programDirectors: 34, retractions: 6,
});

const PACKAGE_FILES = Object.freeze([
  "00_README_FOR_CODEX.md", "01_PROGRAM_DOMAIN_FACTS.jsonl", "02_RESIDENTS_NORMALIZED.csv",
  "03_RESIDENT_COMPOSITION_ESTIMATES.csv", "04_LEADERSHIP_NORMALIZED.csv",
  "05_FACULTY_NORMALIZED.csv", "06_FELLOWSHIPS_OUTCOMES_NORMALIZED.jsonl",
  "07_APPLICATION_REQUIREMENTS.csv", "08_TRACKS_POSITION_TYPES.csv",
  "09_REGISTRY_RECONCILIATION.csv", "10_SOURCE_MANIFEST.csv",
  "11_CONFLICTS_AND_EXCEPTIONS.csv", "12_CODEX_HYDRATION_HANDOFF.md",
]);

const DOMAIN_KEYS = Object.freeze({
  "1_identity_structure": "identity_structure", "2_visa": "visa",
  "3_step1_policy": "step1_policy", "4_step2_requirement_minimum": "step2_requirement",
  "5_step2_timing": "step2_timing", "6_attempts_policy": "attempts_policy",
  "7_yog_limit": "yog_policy", "8_usce_requirement": "usce",
  "9_ecfmg_requirement": "ecfmg", "10_deadline_signaling": "deadline_signaling",
  "11_current_residents": "resident_roster", "12_resident_medical_schools": "resident_medical_schools",
  "13_resident_composition": "resident_composition", "14_leadership": "leadership",
  "15_core_faculty": "core_faculty", "16_movement_disorders": "movement_disorders",
  "17_ms_neuroimmunology": "ms_neuroimmunology", "18_fellowships": "fellowship_inventory",
  "19_graduate_outcomes": "outcomes", "20_board_pass_rate": "board_pass_rate",
  "21_salary_benefits": "salary_benefits", "22_curriculum": "curriculum",
  "23_why_this_program": "program_differentiators",
  "24_spanish_latino_relevance": "spanish_latino_relevance",
  "25_ucc_puerto_rico": "ucc_puerto_rico", "26_sources_freshness_completion": "sources_freshness",
});

const SOURCE_STATES = new Set([
  "VERIFIED", "PARTIALLY_VERIFIED", "RESEARCHED_NOT_PUBLIC", "RESEARCHED_NOT_FOUND",
  "CONFLICT", "NOT_APPLICABLE", "STALE_NEEDS_REFRESH",
]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stableJson(value)).digest("hex");
}

function clean(value) {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
}

function bool(value) {
  if (value === true || /^(?:true|yes)$/i.test(String(value ?? "").trim())) return true;
  if (value === false || /^(?:false|no)$/i.test(String(value ?? "").trim())) return false;
  return null;
}

function number(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function sanitize(value) {
  if (typeof value === "string") {
    return value.split(/(?<=[.!?])\s+|\s*;\s*/).map(clean).filter(Boolean)
      .filter((part) => !/alejandra/i.test(part)).join("; ") || null;
  }
  if (Array.isArray(value)) return value.map(sanitize).filter((item) => item !== null);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/alejandra/i.test(key))
      .map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

export function parseCsv(text) {
  const table = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); table.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); table.push(row); }
  if (quoted) throw new Error("CSV ended inside a quoted field");
  const header = table.shift();
  if (!header?.length) return [];
  return table.filter((values) => values.some((value) => value !== ""))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function availability(sourceState) {
  return ({
    VERIFIED: "AVAILABLE_LIVE", PARTIALLY_VERIFIED: "AVAILABLE_LIVE",
    RESEARCHED_NOT_FOUND: "RESEARCHED_NOT_FOUND",
    RESEARCHED_NOT_PUBLIC: "RESEARCHED_NOT_PUBLIC",
    CONFLICT: "CONFLICT_REQUIRES_REVIEW",
    STALE_NEEDS_REFRESH: "STALE_NEEDS_REFRESH",
    NOT_APPLICABLE: "NOT_APPLICABLE",
  })[sourceState];
}

function terminalState({ sourceState, summary = null, absence = null, confidence = null, adversariallyValidated = null, details = null }) {
  if (!SOURCE_STATES.has(sourceState)) throw new Error(`Unsupported package state: ${sourceState}`);
  return {
    contractId: TERMINAL_STATE_CONTRACT, state: availability(sourceState), sourceState,
    summary: sanitize(summary), absence: sanitize(absence), confidence: clean(confidence),
    adversariallyValidated: clean(adversariallyValidated), details: sanitize(details),
  };
}

function urlList(values) {
  return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : [value])
    .map(clean).filter((value) => value && /^https:\/\//i.test(value)))].sort();
}

function explicitBoolean(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const key of keys) {
    if (!(key in value)) continue;
    if (value[key] === true || /^(?:yes|true)$/i.test(String(value[key]))) return true;
    if (value[key] === false || /^(?:no|false)$/i.test(String(value[key]))) return false;
  }
  return null;
}

function visaSignals(fact) {
  if (!["VERIFIED", "PARTIALLY_VERIFIED"].includes(fact.status)) return { j1: null, h1b: null, any: null };
  let value = fact.value;
  if (typeof value === "string" && /^\s*\{/.test(value)) {
    try { value = JSON.parse(value); } catch {}
  }
  let j1 = explicitBoolean(value, ["j1", "j1_through_ecfmg"]);
  let h1b = explicitBoolean(value, ["h1b", "h1b_for_residency", "h1b_freida"]);
  const text = JSON.stringify(value ?? fact.summary ?? "");
  if (j1 === null) {
    if (/no visa sponsorship of any type|J-?1\s*(?::|=)?\s*(?:no|false)|no J-?1/i.test(text)) j1 = false;
    else if (/J-?1.{0,28}(?:through|via|sponsor|yes|only)|(?:through|via) ECFMG.{0,20}J-?1/i.test(text)) j1 = true;
  }
  if (h1b === null) {
    if (/no visa sponsorship of any type|H-?1B.{0,32}(?:no|not sponsored|not offered|not supported|false)|no H-?1B/i.test(text)) h1b = false;
    else if (/H-?1B.{0,28}(?:yes|sponsor|offered|accepted)/i.test(text)) h1b = true;
  }
  return { j1, h1b, any: j1 === true || h1b === true ? true : j1 === false && h1b === false ? false : null };
}

function hardMinimum(text, label = "step") {
  const value = clean(text);
  if (!value || /no published (?:standalone )?(?:numeric )?(?:minimum|score)|no minimum score|not a cutoff/i.test(value)) return null;
  const patterns = label === "comlex"
    ? [/COMLEX(?:-USA)?(?:\s+Level)?\s*2(?:-CE)?\D{0,36}(\d{3})\s*(?:or above|or higher|\+)/i]
    : [
      /(?:USMLE\s*)?Step\s*2(?:\s*CK)?\D{0,48}(\d{3})\s*(?:or above|or higher|\+)/i,
      /\b(\d{3})[- ]or[- ]higher\s+minimum\b/i,
      /minimum(?:\s+score)?\s*:\s*(?:USMLE\s*)?Step\s*2(?:\s*CK)?\D{0,16}(\d{3})/i,
    ];
  const match = patterns.map((pattern) => value.match(pattern)).find(Boolean);
  if (!match || /prefer(?:red|ence)?/i.test(value.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30))) return null;
  const result = Number(match[1]);
  return result >= (label === "comlex" ? 400 : 180) && result <= (label === "comlex" ? 800 : 300) ? result : null;
}

function maxAttempts(text) {
  const value = clean(text);
  if (!value || /no published attempt limit|not published/i.test(value)) return null;
  const match = value.match(/(?:maximum|max(?:imum)? of|no more than)\s+(\d)\s+(?:attempt|fail)/i);
  return match ? Number(match[1]) : null;
}

function requirementState(status, summary, absence, extra = {}) {
  return { ...terminalState({ sourceState: status, summary, absence }), ...extra };
}

function residentRow(row) {
  return {
    name: clean(row.resident_name), pgy: clean(row.pgy), track: clean(row.track),
    degree: clean(row.degree_suffix), medical_school: clean(row.medical_school_normalized),
    medical_school_raw: clean(row.medical_school_raw), medical_school_country: clean(row.school_country),
    classification: clean(row.school_classification), classificationEvidence: clean(row.classification_evidence),
    classificationConfidence: clean(row.classification_confidence),
    caribbean: row.school_classification === "IMG_CARIBBEAN",
    caribbeanSubtype: clean(row.caribbean_subtype), source_url: clean(row.source_url),
    sourceDate: clean(row.source_date), conflict: bool(row.conflict_flag), notes: sanitize(row.notes),
  };
}

function personRow(row, faculty = false) {
  const common = {
    name: clean(faculty ? row.faculty_name : row.person_name), degree: clean(row.degree),
    role: clean(row.role), medical_school: clean(row.medical_school),
    residency_program: clean(row.residency_program), fellowship_program: clean(row.fellowship_program),
    puertoRicoTie: sanitize(row.puerto_rico_tie), source_url: clean(row.source_url),
    confidence: clean(row.confidence), sectionStatus: clean(row.section_status),
    adversariallyValidated: clean(row.adversarially_validated),
  };
  return faculty ? {
    ...common, subspecialty: clean(row.subspecialty_interest), trainedHere: bool(row.trained_here),
    puertoRicoTieType: clean(row.pr_tie_type), puertoRicoTieSchool: clean(row.pr_tie_school),
    spanishDocumented: bool(row.spanish_documented), rosterCompleteness: clean(row.roster_completeness),
    absence: clean(row.absence_message),
  } : {
    ...common, roleCategory: clean(row.role_category), subspecialty: clean(row.subspecialty),
    trainedHereResidency: bool(row.trained_here_residency), trainedHereFellowship: bool(row.trained_here_fellowship),
    currencyIndicator: clean(row.currency_indicator), conflictState: clean(row.conflict_state),
    absence: clean(row.absence_message),
  };
}

function claimFactory({ program, packageSha256, retrievedAt }) {
  const providerRunId = `P1-RISE-5012J:${program.acgmeId}:${packageSha256}`;
  return (field, value, sourceUrls, locator, evidenceState = "NORMALIZED_PACKAGE_PROJECTION") => ({
    ...createCanonicalEvidenceClaim({
      subjectId: program.programId, field, value, provider: "CLAUDE_OPUS", providerRunId,
      sourceType: "completed_normalized_hydration_package", sourceUrl: sourceUrls[0] ?? null,
      sourceLocator: locator, retrievedAt, publicationState: "REVIEW_REQUIRED",
      reviewState: "PENDING", conflictState: "NONE",
      assertionClass: value?.contractId === TERMINAL_STATE_CONTRACT ? "source_attributed_state" : "source_attributed",
    }),
    provider: "CLAUDE_OPUS", evidenceState, sourceUrls, directSourceUrls: sourceUrls,
  });
}

function group(rows, key = "acgme_id") {
  const result = new Map();
  for (const row of rows) {
    const id = String(row[key]);
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(row);
  }
  return result;
}

async function readPackage(root) {
  const checksumText = await fs.readFile(path.join(root, "13_CHECKSUMS.txt"), "utf8");
  const expected = new Map(checksumText.trim().split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#")).map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (!match) throw new Error(`Invalid checksum line: ${line}`);
    return [match[2].replace(/^\.\//, ""), match[1]];
  }));
  const bytes = new Map();
  for (const name of PACKAGE_FILES) {
    const value = await fs.readFile(path.join(root, name));
    if (expected.get(name) !== sha256(value)) throw new Error(`Hydration package checksum mismatch: ${name}`);
    bytes.set(name, value);
  }
  const jsonl = (name) => bytes.get(name).toString("utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const csv = (name) => parseCsv(bytes.get(name).toString("utf8"));
  return {
    packageSha256: sha256(PACKAGE_FILES.map((name) => `${name}\0${expected.get(name)}`).join("\n")),
    domainFacts: jsonl("01_PROGRAM_DOMAIN_FACTS.jsonl"), residents: csv("02_RESIDENTS_NORMALIZED.csv"),
    composition: csv("03_RESIDENT_COMPOSITION_ESTIMATES.csv"), leadership: csv("04_LEADERSHIP_NORMALIZED.csv"),
    faculty: csv("05_FACULTY_NORMALIZED.csv"), fellowshipOutcomes: jsonl("06_FELLOWSHIPS_OUTCOMES_NORMALIZED.jsonl"),
    applicationRequirements: csv("07_APPLICATION_REQUIREMENTS.csv"), tracks: csv("08_TRACKS_POSITION_TYPES.csv"),
    reconciliation: csv("09_REGISTRY_RECONCILIATION.csv"), sourceManifest: csv("10_SOURCE_MANIFEST.csv"),
    exceptions: csv("11_CONFLICTS_AND_EXCEPTIONS.csv"),
  };
}

export async function loadNormalizedHydrationPackage(root, { registryPath } = {}) {
  const data = await readPackage(root);
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const registryCount = registry?.counts?.uniquePrograms;
  const registryPrograms = Array.isArray(registry?.programs) ? registry.programs : [];
  if (!Number.isInteger(registryCount) || registryCount < 6139 || registryPrograms.length !== registryCount || registry?.counts?.specialtyTabs !== 31) {
    throw new Error(`Full registry contract is inconsistent: ${registryCount}/${registryPrograms.length} programs and ${registry?.counts?.specialtyTabs} specialties`);
  }
  const registryIds = registryPrograms.map((program) => program?.id);
  if (registryIds.some((id) => typeof id !== "string" || !id) || new Set(registryIds).size !== registryIds.length) {
    throw new Error("Full registry contains a missing or duplicate canonical program identity");
  }
  for (const [key, expected] of Object.entries(EXPECTED_PACKAGE_COUNTS)) {
    if (["programs", "programDirectors", "retractions"].includes(key)) continue;
    if (data[key].length !== expected) throw new Error(`Hydration package ${key} count drifted: ${data[key].length}/${expected}`);
  }
  const acgmeIds = [...new Set(data.domainFacts.map((row) => String(row.acgme_id)))].sort();
  if (acgmeIds.length !== EXPECTED_PACKAGE_COUNTS.programs) throw new Error("Hydration package must resolve exactly 34 programs");
  if (new Set(data.domainFacts.map((row) => `${row.acgme_id}\0${row.domain}`)).size !== data.domainFacts.length) throw new Error("Duplicate program/domain fact");
  if (data.domainFacts.some((row) => !DOMAIN_KEYS[row.domain] || !SOURCE_STATES.has(row.status))) throw new Error("Unknown domain or evidence state");
  if (new Set(data.residents.map((row) => `${row.acgme_id}\0${clean(row.resident_name)?.toLowerCase()}\0${clean(row.pgy)}`)).size !== data.residents.length) throw new Error("Duplicate resident row");
  if (data.leadership.filter((row) => row.role_category === "PROGRAM_DIRECTOR").length !== EXPECTED_PACKAGE_COUNTS.programDirectors) throw new Error("Expected one supported PD for all 34 programs");
  if (data.exceptions.filter((row) => row.kind === "RETRACTED").length !== EXPECTED_PACKAGE_COUNTS.retractions) throw new Error("Expected six retractions");

  const registryByAcgme = new Map();
  for (const program of registry.programs) {
    const id = program.identifiers?.find((item) => item.namespace === "ACGME_PROGRAM")?.value;
    if (acgmeIds.includes(String(id))) registryByAcgme.set(String(id), program);
  }
  if (registryByAcgme.size !== acgmeIds.length) throw new Error(`Registry identity resolution incomplete: ${registryByAcgme.size}/34`);

  const groups = Object.fromEntries(Object.entries(data)
    .filter(([, rows]) => Array.isArray(rows) && rows.length && rows[0]?.acgme_id)
    .map(([key, rows]) => [key, group(rows)]));
  const factsByProgram = group(data.domainFacts);
  const retrievedAt = "2026-09-12T18:00:00.000Z";
  const identities = [], ingests = [];

  for (const acgmeId of acgmeIds) {
    const registryProgram = registryByAcgme.get(acgmeId);
    const facts = factsByProgram.get(acgmeId);
    const factByDomain = new Map(facts.map((fact) => [fact.domain, fact]));
    const packageIdentity = facts[0];
    const program = { acgmeId, programId: registryProgram.id, programSpecialtyId: registryProgram.programSpecialtyId };
    const claim = claimFactory({ program, packageSha256: data.packageSha256, retrievedAt });
    const claims = [];
    const sources = (...domains) => urlList(domains.flatMap((domain) => factByDomain.get(domain)?.source_urls ?? []));

    for (const fact of facts) {
      const value = terminalState({
        sourceState: fact.status, summary: fact.summary ?? fact.value,
        absence: fact.student_facing_absence_message, confidence: fact.confidence,
        adversariallyValidated: fact.adversarially_validated,
        details: fact.status === "CONFLICT" ? fact.conflict_notes : null,
      });
      claims.push(claim(`research.domain.${DOMAIN_KEYS[fact.domain]}`, value, urlList(fact.source_urls),
        `P1-RISE-5012J/01_PROGRAM_DOMAIN_FACTS.jsonl#${acgmeId}/${fact.domain}`, "TERMINAL_STATE_ENVELOPE"));
    }

    const visaFact = factByDomain.get("2_visa");
    claims.push(claim("research.visa", {
      ...terminalState({ sourceState: visaFact.status, summary: visaFact.summary, absence: visaFact.student_facing_absence_message, confidence: visaFact.confidence, adversariallyValidated: visaFact.adversarially_validated }),
      ...visaSignals(visaFact),
    }, sources("2_visa"), `P1-RISE-5012J/07_APPLICATION_REQUIREMENTS.csv#${acgmeId}/visa`, "TERMINAL_STATE_ENVELOPE"));

    const residents = (groups.residents.get(acgmeId) ?? []).map(residentRow);
    const rosterFact = factByDomain.get("11_current_residents");
    claims.push(claim("research.resident_roster", residents.length ? residents : terminalState({
      sourceState: rosterFact.status, summary: rosterFact.summary, absence: rosterFact.student_facing_absence_message,
      confidence: rosterFact.confidence, adversariallyValidated: rosterFact.adversarially_validated,
    }), urlList([residents.map((row) => row.source_url), sources("11_current_residents")]),
    `P1-RISE-5012J/02_RESIDENTS_NORMALIZED.csv#${acgmeId}`, residents.length ? "NORMALIZED_PACKAGE_PROJECTION" : "TERMINAL_STATE_ENVELOPE"));

    const composition = groups.composition.get(acgmeId)[0];
    const percentagesAvailable = bool(composition.percentages_available) === true;
    claims.push(claim("research.resident_composition", {
      contractId: "rise-roster-composition-estimate-v1",
      state: percentagesAvailable ? "AVAILABLE_LIVE" : "RESEARCHED_NOT_PUBLIC",
      sourceState: percentagesAvailable ? "VERIFIED" : "RESEARCHED_NOT_PUBLIC",
      rosterTotal: number(composition.resident_roster_total), classifiedTotal: number(composition.resident_classified_total),
      unclassifiedTotal: number(composition.resident_unclassified_total),
      counts: { usMd: number(composition.us_md_count), do: number(composition.do_count), img: number(composition.img_count), caribbeanImg: number(composition.caribbean_img_count), imgOther: number(composition.img_other_count), unresolved: number(composition.other_or_unresolved_count) },
      percentages: { usMd: percentagesAvailable ? number(composition.us_md_pct_of_classified) : null, do: percentagesAvailable ? number(composition.do_pct_of_classified) : null, img: percentagesAvailable ? number(composition.img_pct_of_classified) : null, caribbeanImg: percentagesAvailable ? number(composition.caribbean_img_pct_of_classified) : null },
      coveragePercent: number(composition.classified_coverage_pct_of_roster),
      percentagesAvailable, officialProgramStatistic: false,
      denominatorBasis: clean(composition.denominator_basis), estimateMethod: clean(composition.estimate_method),
      estimateConfidence: clean(composition.estimate_confidence), disclaimer: clean(composition.disclaimer),
      snapshot: clean(composition.roster_snapshot_date_or_cycle),
    }, urlList([
      String(composition.source_urls ?? "").split(/\s*[;|]\s*/),
      sources("13_resident_composition", "11_current_residents"),
    ]), `P1-RISE-5012J/03_RESIDENT_COMPOSITION_ESTIMATES.csv#${acgmeId}`));

    const leadership = groups.leadership.get(acgmeId).map((row) => personRow(row));
    const faculty = (groups.faculty.get(acgmeId) ?? []).map((row) => personRow(row, true));
    claims.push(claim("research.leadership", leadership, urlList(leadership.map((row) => row.source_url)), `P1-RISE-5012J/04_LEADERSHIP_NORMALIZED.csv#${acgmeId}`));
    const facultyFact = factByDomain.get("15_core_faculty");
    claims.push(claim("research.core_faculty", faculty.length ? faculty : terminalState({
      sourceState: facultyFact.status, summary: facultyFact.summary, absence: facultyFact.student_facing_absence_message,
      confidence: facultyFact.confidence, adversariallyValidated: facultyFact.adversarially_validated,
    }), urlList([faculty.map((row) => row.source_url), sources("15_core_faculty")]),
    `P1-RISE-5012J/05_FACULTY_NORMALIZED.csv#${acgmeId}`, faculty.length ? "NORMALIZED_PACKAGE_PROJECTION" : "TERMINAL_STATE_ENVELOPE"));

    const application = groups.applicationRequirements.get(acgmeId)[0];
    const stepMinimum = ["VERIFIED", "PARTIALLY_VERIFIED"].includes(application.step2_required_status) ? hardMinimum(application.step2_published_minimum) : null;
    const appValue = {
      contractId: "rise-application-requirements-v2",
      step1: requirementState(application.step1_status, application.step1_summary, application.step1_absence),
      step2: requirementState(application.step2_required_status, application.step2_requirement_summary, application.step2_absence, {
        required: ["VERIFIED", "PARTIALLY_VERIFIED"].includes(application.step2_required_status)
          ? (/\b(?:not required|no Step 2)/i.test(application.step2_requirement_summary) ? false : /\b(?:required|must be passed|pass required)/i.test(application.step2_requirement_summary) ? true : null) : null,
        publishedMinimum: stepMinimum, publishedMinimumKind: stepMinimum === null ? null : "REQUIRED",
        timingCode: clean(application.step2_timing_code), createsBarrierMidOctober: bool(application.step2_creates_barrier_mid_october),
        barrierSemantics: clean(application.step2_barrier_semantics),
      }),
      comlex: requirementState(application.comlex_status, application.comlex_summary, null, {
        accepted: ["VERIFIED", "PARTIALLY_VERIFIED"].includes(application.comlex_status)
          ? (/\b(?:accepted|accepts|may satisfy|or COMLEX|COMLEX Level 2.*pass)/i.test(application.comlex_summary) ? true : null) : null,
        publishedMinimum: ["VERIFIED", "PARTIALLY_VERIFIED"].includes(application.comlex_status)
          ? hardMinimum(`${application.step2_published_minimum} ${application.comlex_summary}`, "comlex") : null,
      }),
      attempts: requirementState(application.attempts_status, application.attempts_summary, application.attempts_absence, { maximum: maxAttempts(application.attempts_summary) }),
      yog: requirementState(application.yog_status, application.yog_summary, application.yog_absence),
      usce: requirementState(application.usce_status, application.usce_summary, application.usce_absence),
      ecfmg: requirementState(application.ecfmg_status, application.ecfmg_summary, application.ecfmg_absence),
      deadline: requirementState(application.deadline_status, application.deadline_summary, application.deadline_absence),
      civilianMilitaryEligibilityBarrier: bool(application.civilian_military_eligibility_barrier),
      eligibilityNote: sanitize(application.eligibility_note), adversariallyValidated: clean(application.adversarially_validated),
    };
    claims.push(claim("research.application_requirements", appValue, sources("3_step1_policy", "4_step2_requirement_minimum", "5_step2_timing", "6_attempts_policy", "7_yog_limit", "8_usce_requirement", "9_ecfmg_requirement", "10_deadline_signaling"), `P1-RISE-5012J/07_APPLICATION_REQUIREMENTS.csv#${acgmeId}`));

    const fo = groups.fellowshipOutcomes.get(acgmeId)[0];
    const fellowshipRows = [
      ...(fo.fellowships?.in_house ?? []).map((row) => ({ ...sanitize(row), relationship: "IN_HOUSE" })),
      ...(fo.fellowships?.affiliated ?? []).map((row) => ({ ...sanitize(row), relationship: "AFFILIATED" })),
      ...(fo.fellowships?.planned_or_aspirational ?? []).map((row) => ({ ...sanitize(row), relationship: "PLANNED_NOT_EXISTING" })),
    ];
    const fellowshipFact = factByDomain.get("18_fellowships");
    claims.push(claim("research.fellowship_inventory", fellowshipRows.length ? fellowshipRows : terminalState({
      sourceState: fellowshipFact.status, summary: fellowshipFact.summary, absence: fellowshipFact.student_facing_absence_message,
      confidence: fellowshipFact.confidence, adversariallyValidated: fellowshipFact.adversarially_validated,
    }), urlList([fellowshipRows.map((row) => row.source_url), sources("18_fellowships")]), `P1-RISE-5012J/06_FELLOWSHIPS_OUTCOMES_NORMALIZED.jsonl#${acgmeId}/fellowships`, fellowshipRows.length ? "NORMALIZED_PACKAGE_PROJECTION" : "TERMINAL_STATE_ENVELOPE"));
    for (const [field, value, domain] of [
      ["research.outcomes", fo.outcomes, "19_graduate_outcomes"], ["research.subspecialties", fo.subspecialties, "16_movement_disorders"],
      ["research.research_opportunities", fo.research_opportunities, "22_curriculum"],
      ["research.salary_benefits", fo.salary_benefits, "21_salary_benefits"],
      ["research.program_differentiators", fo.differentiators, "23_why_this_program"],
      ["research.spanish_latino_relevance", fo.spanish_latino, "24_spanish_latino_relevance"],
      ["research.ucc_puerto_rico", fo.ucc_puerto_rico, "25_ucc_puerto_rico"],
    ]) claims.push(claim(field, sanitize(value), sources(domain), `P1-RISE-5012J/06_FELLOWSHIPS_OUTCOMES_NORMALIZED.jsonl#${acgmeId}/${field}`));

    const tracks = groups.tracks.get(acgmeId).map((row) => ({
      nrmpCode: clean(row.nrmp_code), nrmpInstitutionCode: clean(row.nrmp_institution_code),
      positionType: clean(row.position_type), status: clean(row.track_status),
      preliminaryDependency: clean(row.prelim_dependency), seniorStudentEligible: bool(row.senior_student_eligible),
      attributionBasis: clean(row.attribution_basis), adversariallyValidated: clean(row.adversarially_validated),
    }));
    claims.push(claim("research.track_inventory", tracks, sources("1_identity_structure"), `P1-RISE-5012J/08_TRACKS_POSITION_TYPES.csv#${acgmeId}`));
    claims.push(claim("research.sources_freshness", (groups.sourceManifest.get(acgmeId) ?? []).map((row) => ({
      sourceId: clean(row.source_id), domain: clean(row.domain), url: clean(row.url), sourceType: clean(row.source_type),
      sourceDate: clean(row.source_date), retrievedAt: clean(row.retrieved_at), confidence: clean(row.confidence), domainStatus: clean(row.domain_status),
    })), sources("26_sources_freshness_completion"), `P1-RISE-5012J/10_SOURCE_MANIFEST.csv#${acgmeId}`));
    claims.push(claim("research.conflicts_exceptions", (groups.exceptions.get(acgmeId) ?? []).map((row) => ({
      kind: clean(row.kind), locus: clean(row.locus), detail: sanitize(row.detail),
      handling: sanitize(row.handling), adversariallyValidated: clean(row.adversarially_validated),
    })), urlList(facts.flatMap((fact) => fact.source_urls ?? [])), `P1-RISE-5012J/11_CONFLICTS_AND_EXCEPTIONS.csv#${acgmeId}`));

    const sourceId = "rise_src_p1_rise_5012j_review";
    const identity = {
      programIdentityId: registryProgram.id, acgmeId, programSpecialtyId: registryProgram.programSpecialtyId,
      programName: registryProgram.display.programName, institution: registryProgram.display.institution,
      city: packageIdentity.city || registryProgram.display.city || null, state: packageIdentity.state,
      specialty: "Neurology", sourceId,
    };
    identities.push({ ...identity, contentSha256: sha256(identity) });
    ingests.push({
      contractId: NORMALIZED_HYDRATION_CONTRACT, provider: "CLAUDE_OPUS", providerKey: "CLAUDE_OPUS",
      campaignId: "P1-RISE-5012J", acgmeId, stagedAt: retrievedAt,
      sourceFile: `P1_RISE_TX_FL_NEURO_HYDRATION_PACKAGE/${acgmeId}`, sourceFileSha256: data.packageSha256,
      providerRunId: `P1-RISE-5012J:${acgmeId}:${data.packageSha256}`,
      idempotencyKey: sha256(`P1-RISE-5012J\0${acgmeId}\0${data.packageSha256}`),
      claims, domainCount: facts.length, newSpendUsd: 0,
    });
  }
  return {
    summary: {
      contractId: NORMALIZED_HYDRATION_CONTRACT, packageSha256: data.packageSha256,
      programs: ingests.length, acgmeIds, domainFacts: data.domainFacts.length, residents: data.residents.length,
      programDirectors: data.leadership.filter((row) => row.role_category === "PROGRAM_DIRECTOR").length,
      faculty: data.faculty.length, sources: data.sourceManifest.length,
      conflicts: data.exceptions.filter((row) => row.kind === "CONFLICT").length,
      retractions: data.exceptions.filter((row) => row.kind === "RETRACTED").length,
      compositionUnavailable: data.composition.filter((row) => bool(row.percentages_available) !== true).length,
      newProviderSpendUsd: 0,
    },
    identities, ingests,
  };
}
