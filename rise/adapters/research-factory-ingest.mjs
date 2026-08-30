import { createHash } from "node:crypto";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";
import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";

const PROVIDERS = new Map([
  ["RISE-BOOTSTRAP-001", "PARALLEL"],
  ["CLAUDE-SPRINT-009", "CLAUDE_OPUS"],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function required(value, name) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
}

function validateRecord(record) {
  const acgmeId = required(record?.acgme_id, "acgme_id");
  if (!/^\d{10}$/.test(acgmeId)) throw new Error("acgme_id must contain ten digits");
  const campaignId = required(record?.campaign_id, "campaign_id");
  const provider = PROVIDERS.get(campaignId);
  if (!provider) throw new Error(`Unsupported completed research campaign: ${campaignId}`);
  const stagedAt = required(record?.staged_at, "staged_at");
  if (!Number.isFinite(Date.parse(stagedAt))) throw new Error("staged_at must be an ISO timestamp");
  if (!record.safe_facts || Array.isArray(record.safe_facts) || typeof record.safe_facts !== "object") {
    throw new Error("safe_facts must be an object");
  }
  if (!record.needs_review || Array.isArray(record.needs_review) || typeof record.needs_review !== "object") {
    throw new Error("needs_review must be an object");
  }
  return { acgmeId, campaignId, provider, stagedAt };
}

export function normalizeResearchFactoryRecord({ record, sourceBytes, sourceFile }) {
  const { acgmeId, campaignId, provider, stagedAt } = validateRecord(record);
  const sourceFileSha256 = sha256(sourceBytes);
  const programSpecialty = canonicalProgramSpecialtyIdentity(acgmeId, "UNRESOLVED_SPECIALTY");
  const providerRunId = `${campaignId}:${acgmeId}:${sourceFileSha256}`;
  const claims = [];
  for (const [field, value] of Object.entries(record.safe_facts).sort()) {
    claims.push(createCanonicalEvidenceClaim({
      subjectId: programSpecialty.program.id,
      field: `research.${field}`,
      value,
      provider,
      providerRunId,
      sourceType: "completed_research_factory_safe_fact",
      sourceLocator: `${sourceFile}#/safe_facts/${field}`,
      retrievedAt: stagedAt,
      publicationState: "REVIEW_REQUIRED",
      reviewState: "PENDING_RIGHTS_AND_FIELD_REVIEW",
    }));
  }
  for (const [field, value] of Object.entries(record.needs_review).sort()) {
    claims.push(createCanonicalEvidenceClaim({
      subjectId: programSpecialty.program.id,
      field: `research.${field}`,
      value,
      provider,
      providerRunId,
      sourceType: "completed_research_factory_review_fact",
      sourceLocator: `${sourceFile}#/needs_review/${field}`,
      retrievedAt: stagedAt,
      publicationState: "REVIEW_REQUIRED",
      reviewState: "PENDING",
    }));
  }
  return {
    provider,
    campaignId,
    acgmeId,
    stagedAt,
    sourceFile,
    sourceFileSha256,
    providerRunId,
    idempotencyKey: sha256(`${provider}\0${campaignId}\0${acgmeId}\0${sourceFileSha256}`),
    claims,
  };
}
