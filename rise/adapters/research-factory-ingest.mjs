import { createHash } from "node:crypto";
import { canonicalProgramSpecialtyIdentity } from "../src/identity.mjs";
import { createCanonicalEvidenceClaim } from "../src/evidence.mjs";

const PROVIDERS = new Map([
  ["RISE-BOOTSTRAP-001", "PARALLEL"],
  ["CLAUDE-SPRINT-009", "CLAUDE_OPUS"],
  ["CLAUDE-SUBSTITUTE-009", "CLAUDE_SONNET"],
]);

const PARALLEL_REVIEW_FIELDS = Object.freeze([
  "visa", "abim", "img_accessibility", "caribbean_accessibility", "do_accessibility",
  "leadership", "resident_roster", "fellowship_inventory",
]);

function pythonTruthy(value) {
  if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function extractEvidenceUrls(value) {
  const urls = new Set();
  const visit = (candidate) => {
    if (typeof candidate === "string") {
      for (const match of candidate.matchAll(/https?:\/\/[^\s\])}"'<>]+/g)) {
        urls.add(match[0].replace(/[.,;]+$/, ""));
      }
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (candidate && typeof candidate === "object") {
      for (const item of Object.values(candidate)) visit(item);
    }
  };
  visit(value);
  return [...urls].sort();
}

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

export function normalizeResearchFactoryRecord({ record, sourceBytes, sourceFile, sourceResearch = null }) {
  const { acgmeId, campaignId, provider, stagedAt } = validateRecord(record);
  const sourceFileSha256 = sha256(sourceBytes);
  const programSpecialty = canonicalProgramSpecialtyIdentity(acgmeId, "UNRESOLVED_SPECIALTY");
  const providerRunId = `${campaignId}:${acgmeId}:${sourceFileSha256}`;
  const claims = [];
  const dossierUrls = extractEvidenceUrls(sourceResearch?.sources ?? []);
  const claim = ({ bucket, field, value, sourceType, publicationState, reviewState }) => {
    const directSourceUrls = extractEvidenceUrls(value);
    const sourceUrls = [...new Set([...directSourceUrls, ...dossierUrls])].sort();
    return {
      ...createCanonicalEvidenceClaim({
      subjectId: programSpecialty.program.id,
      field: `research.${field}`,
      value,
      provider,
      providerRunId,
      sourceType,
      sourceUrl: sourceUrls[0] ?? null,
      sourceLocator: `${sourceFile}#/${bucket}/${field}`,
      retrievedAt: stagedAt,
      publicationState,
      reviewState,
      }),
      directSourceUrls,
      dossierSourceUrls: dossierUrls,
      sourceUrls,
    };
  };
  for (const [field, value] of Object.entries(record.safe_facts).sort()) {
    claims.push(claim({
      bucket: "safe_facts", field, value,
      sourceType: "completed_research_factory_safe_fact",
      publicationState: "REVIEW_REQUIRED",
      reviewState: "PENDING_RIGHTS_AND_FIELD_REVIEW",
    }));
  }
  for (const [field, value] of Object.entries(record.needs_review).sort()) {
    claims.push(claim({
      bucket: "needs_review", field, value,
      sourceType: "completed_research_factory_review_fact",
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

export function normalizeParallelRawResearchRecord({ record, sourceBytes, sourceFile }) {
  const content = record?.output?.content;
  if (!content || Array.isArray(content) || typeof content !== "object") {
    throw new Error("Parallel raw result must contain output.content");
  }
  const acgmeId = required(
    record?.run?.metadata?.acgme_id ?? content?.program_identity?.acgme_id,
    "parallel raw acgme_id",
  );
  const hasConflicts = Array.isArray(content.conflicts) && content.conflicts.length > 0;
  const safeFacts = {};
  const needsReview = {};
  for (const field of PARALLEL_REVIEW_FIELDS.slice(0, 5)) {
    const value = content[field];
    if (!pythonTruthy(value)) continue;
    (hasConflicts ? needsReview : safeFacts)[field] = value;
  }
  for (const field of PARALLEL_REVIEW_FIELDS.slice(5)) {
    const value = content[field];
    if (pythonTruthy(value)) needsReview[field] = value;
  }
  const stagedAt = record?.run?.modified_at ?? record?.run?.created_at;
  return normalizeResearchFactoryRecord({
    record: {
      acgme_id: acgmeId,
      campaign_id: "RISE-BOOTSTRAP-001",
      staged_at: stagedAt,
      safe_facts: safeFacts,
      needs_review: needsReview,
      source_result: sourceFile,
    },
    sourceBytes,
    sourceFile,
    sourceResearch: content,
  });
}
