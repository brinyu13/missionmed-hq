import { createHash } from "node:crypto";

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLISHED_STATES = new Set(["STUDENT_VISIBLE", "PRIVATE_BETA"]);
const FACT_LABELS = new Map([
  ["research.curriculum", "Curriculum"],
  ["research.culture", "Culture"],
  ["research.fellowship_inventory", "Fellowships"],
  ["research.outcomes", "Outcomes"],
  ["research.structure", "Training structure"],
  ["research.interview_format", "Interview format"],
  ["research.program_differentiators", "Program differentiator"],
]);
const PERSON_CREDENTIAL = /\b[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?(?:\s+[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?){1,3},?\s+(?:MD|DO|PhD|MBBS)\b/u;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function text(value, maximum) {
  const normalized = String(value ?? "").trim().replace(/\s+/gu, " ");
  return normalized && normalized.length <= maximum ? normalized : null;
}

function knownValue(field) {
  return field?.knowledge?.state === "known" ? field.knowledge.value : null;
}

function summary(value) {
  const candidates = Array.isArray(value) ? value : [value];
  const parts = candidates.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && typeof item.summary === "string") return item.summary;
    return "";
  }).map((item) => text(item, 360)).filter(Boolean).slice(0, 2);
  const joined = text(parts.join(" "), 600);
  return joined && !PERSON_CREDENTIAL.test(joined) ? joined : null;
}

function sourceRef(programId, fact) {
  const sourceUrl = text(fact?.sourceUrl, 2_048);
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash) return parsed.toString();
    } catch { /* use the deterministic owner reference below */ }
  }
  return `rise:${programId}:${text(fact?.field, 128) || "fact"}:${sha256({
    field: fact?.field, value: fact?.canonicalValue, retrievedAt: fact?.retrievedAt,
  }).slice(0, 24)}`;
}

function roleProjection(programId, currentFacts) {
  const facts = currentFacts.filter((fact) => ["research.leadership", "research.core_faculty"].includes(fact?.field)
    && PUBLISHED_STATES.has(fact?.publicationState));
  const roles = new Map();
  for (const fact of facts) {
    const haystack = JSON.stringify(fact.canonicalValue ?? fact.knowledge ?? "").toLowerCase();
    const ref = sourceRef(programId, fact);
    const asOf = text(fact.retrievedAt, 40);
    if (/associate program director|\bapd\b/u.test(haystack)) roles.set("Associate Program Director", { role: "Associate Program Director", source_ref: ref, ...(asOf ? { as_of: asOf } : {}) });
    if (/program director|\bpd\b/u.test(haystack)) roles.set("Program Director", { role: "Program Director", source_ref: ref, ...(asOf ? { as_of: asOf } : {}) });
    if (/chief resident/u.test(haystack)) roles.set("Chief Resident", { role: "Chief Resident", source_ref: ref, ...(asOf ? { as_of: asOf } : {}) });
    if (/faculty/u.test(haystack) || fact.field === "research.core_faculty") roles.set("Faculty", { role: "Faculty", source_ref: ref, ...(asOf ? { as_of: asOf } : {}) });
  }
  return [...roles.values()].sort((left, right) => left.role.localeCompare(right.role));
}

export function createRiseIvocProgramProjection({
  session,
  sessionId,
  registryReleaseId,
  program,
  researchProjection = {},
  now = () => Date.now(),
} = {}) {
  const subject = text(session?.subject, 256);
  const programId = text(program?.programSpecialtyId, 256);
  const releaseId = text(registryReleaseId, 256);
  const name = text(program?.display?.programName, 240);
  if (!subject || !SESSION_ID.test(String(sessionId || "")) || !programId || !releaseId || !name) {
    throw new TypeError("rise_ivoc_projection_input_invalid");
  }
  const currentFacts = Array.isArray(researchProjection?.currentFacts) ? researchProjection.currentFacts : [];
  const highYield = currentFacts
    .filter((fact) => FACT_LABELS.has(fact?.field) && PUBLISHED_STATES.has(fact?.publicationState))
    .map((fact) => {
      const value = summary(fact.canonicalValue ?? fact.knowledge?.value);
      if (!value) return null;
      const asOf = text(fact.retrievedAt, 40);
      return {
        fact: `${FACT_LABELS.get(fact.field)}: ${value}`,
        source_ref: sourceRef(programId, fact),
        ...(asOf ? { as_of: asOf } : {}),
      };
    }).filter(Boolean).sort((left, right) => `${left.source_ref}:${left.fact}`.localeCompare(`${right.source_ref}:${right.fact}`)).slice(0, 8);
  const acgmeId = text((program.identifiers ?? []).find((item) => item?.namespace === "ACGME_PROGRAM")?.value, 32);
  const payload = {
    program_id: programId,
    ...(acgmeId ? { acgme_id: acgmeId } : {}),
    name,
    specialty: text(program.designation, 160),
    state: text(program.display?.state, 80),
    type: text(knownValue(program.fields?.["Program Best Described As"]), 120),
    high_yield_facts: highYield,
    people: roleProjection(programId, currentFacts),
  };
  const content = { registry_release_id: releaseId, subject_id: subject, payload };
  const sourceVersion = `rise-ivoc-${releaseId}-${sha256(content).slice(0, 20)}`;
  const producedAt = new Date(now()).toISOString();
  return Object.freeze({
    projection_id: `rise-program:${subject}:${programId}`,
    owner_app: "rise",
    projection_type: "rise.program_cheat_sheet",
    schema_version: "1",
    subject_id: subject,
    source_version: sourceVersion,
    produced_at: producedAt,
    authorization: {
      basis: "owner_policy",
      consent_ref: `ivoc-session:${sessionId}`,
      scope: ["program_identity", "interview_relevant_facts", "people_role_presence"],
    },
    minimization: {
      fields_included: ["program_id", "acgme_id", "name", "specialty", "state", "type", "high_yield_facts", "people"],
      fields_excluded_reason: {
        people_names: "not required by the initial IVOC Actor projection",
        review_required: "not current published RISE truth",
        conflicting: "not current published RISE truth",
        research_corpus: "RISE remains canonical owner",
      },
    },
    payload,
    source_receipt: {
      owner_ref: `rise:${releaseId}:${programId}@${sourceVersion}`,
      hash: sha256({ subject_id: subject, source_version: sourceVersion, payload }),
    },
    revocation: { revocable: true },
  });
}
