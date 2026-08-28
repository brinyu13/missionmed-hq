import { createHash } from "node:crypto";
import fs from "node:fs/promises";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ALLOWED_USE = "create_or_supplement_missionmed_rise_database";

export const SOURCE_POLICIES = Object.freeze({
  FREIDA: Object.freeze({ provider: "AMA", product: "FREIDA" }),
  "Residency Explorer": Object.freeze({ provider: "AAMC", product: "Residency Explorer" }),
  "HRSA THCGME": Object.freeze({
    provider: "U.S. Health Resources and Services Administration",
    product: "THCGME AY 2025-2026 Awardees",
  }),
});

function authorizationError(message, code = "RISE_SOURCE_AUTHORIZATION_INVALID", source) {
  const error = new Error(message);
  error.code = code;
  error.details = source ? { source } : undefined;
  return error;
}

function parsedTime(value) {
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function validateAuthorizationRecord(record, source, { now = Date.now() } = {}) {
  const policy = SOURCE_POLICIES[source];
  if (!policy) throw authorizationError(`Unsupported source authorization policy: ${source}`);
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw authorizationError(`${source} authorization record must be an object`, undefined, source);
  }
  const effectiveFrom = parsedTime(record.effectiveFrom);
  const validThrough = parsedTime(record.validThrough);
  const reviewedAt = parsedTime(record.missionMedReview?.reviewedAt);
  const valid = record.schemaVersion === 1 &&
    record.status === "approved" &&
    record.provider === policy.provider &&
    record.product === policy.product &&
    typeof record.authorizationId === "string" && record.authorizationId.length >= 8 &&
    typeof record.writtenAuthorizationReference === "string" && record.writtenAuthorizationReference.length >= 8 &&
    SHA256_PATTERN.test(record.sourceOwnerGrantSha256 ?? "") &&
    Array.isArray(record.allowedUses) && record.allowedUses.includes(ALLOWED_USE) &&
    effectiveFrom !== null && effectiveFrom <= now &&
    validThrough !== null && validThrough >= now &&
    record.missionMedReview?.decision === "approved" &&
    typeof record.missionMedReview?.decisionRecordId === "string" && record.missionMedReview.decisionRecordId.length >= 8 &&
    typeof record.missionMedReview?.reviewerSubject === "string" &&
    reviewedAt !== null && reviewedAt <= now;
  if (!valid) {
    throw authorizationError(`${source} authorization record is invalid, unreviewed, not yet effective, or expired`, undefined, source);
  }
  return {
    source,
    authorizationId: record.authorizationId,
    reference: record.writtenAuthorizationReference,
    sourceOwnerGrantSha256: record.sourceOwnerGrantSha256,
    effectiveFrom: record.effectiveFrom,
    validThrough: record.validThrough,
    reviewedAt: record.missionMedReview.reviewedAt,
    decisionRecordId: record.missionMedReview.decisionRecordId,
    status: "approved",
  };
}

export async function loadPinnedSourceAuthorizations({
  datasetConfig,
  pathsBySource = {},
  grantPathsBySource = {},
  now = Date.now(),
} = {}) {
  const requirements = datasetConfig?.requiredSourceAuthorizations;
  if (!Array.isArray(requirements) || !requirements.length) {
    throw authorizationError("Dataset configuration must declare required source authorizations", "RISE_SOURCE_POLICY_BLOCKED");
  }
  const summaries = {};
  for (const requirement of requirements) {
    const { source, required = true, approvedRecordSha256 } = requirement ?? {};
    if (!SOURCE_POLICIES[source]) throw authorizationError(`Dataset declares unsupported source: ${source}`);
    if (!required && !approvedRecordSha256) continue;
    if (!SHA256_PATTERN.test(approvedRecordSha256 ?? "")) {
      throw authorizationError(
        `${source} has no governance-pinned written authorization hash`,
        "RISE_SOURCE_POLICY_BLOCKED",
        source,
      );
    }
    const filePath = pathsBySource[source];
    if (!filePath) {
      throw authorizationError(`${source} authorization file is required`, "RISE_SOURCE_POLICY_BLOCKED", source);
    }
    const bytes = await fs.readFile(filePath);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== approvedRecordSha256) {
      throw authorizationError(`${source} authorization hash does not match governance configuration`, undefined, source);
    }
    let record;
    try {
      record = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw authorizationError(`${source} authorization record is not valid JSON`, undefined, source);
    }
    const summary = validateAuthorizationRecord(record, source, { now });
    const grantPath = grantPathsBySource[source];
    if (!grantPath) {
      throw authorizationError(`${source} source-owner grant file is required`, "RISE_SOURCE_POLICY_BLOCKED", source);
    }
    const grantSha256 = createHash("sha256").update(await fs.readFile(grantPath)).digest("hex");
    if (grantSha256 !== summary.sourceOwnerGrantSha256) {
      throw authorizationError(`${source} source-owner grant bytes do not match the approved authorization record`, undefined, source);
    }
    summaries[source] = { ...summary, sha256, sourceOwnerGrantBytesVerified: true };
  }
  return summaries;
}

function normalizedShaSet(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  return new Set(values.map((item) => String(item).trim().toLowerCase()).filter(Boolean));
}

export function assertCurrentSourceRights(releaseGate, {
  now = Date.now(),
  production = false,
  expectedAuthorizationSha256s,
  revokedAuthorizationSha256s,
} = {}) {
  if (releaseGate?.sourceRightsApproved !== true || !Array.isArray(releaseGate.sourceRights) || !releaseGate.sourceRights.length) {
    throw authorizationError("Registry source rights are not approved", "RISE_SOURCE_POLICY_BLOCKED");
  }
  const current = new Set();
  const revoked = normalizedShaSet(revokedAuthorizationSha256s);
  for (const right of releaseGate.sourceRights) {
    const expires = parsedTime(right?.validThrough);
    if (
      right?.status !== "approved" ||
      !SOURCE_POLICIES[right?.source] ||
      !SHA256_PATTERN.test(right?.sha256 ?? "") ||
      !SHA256_PATTERN.test(right?.sourceOwnerGrantSha256 ?? "") ||
      right?.sourceOwnerGrantBytesVerified !== true ||
      typeof right?.authorizationId !== "string" ||
      typeof right?.decisionRecordId !== "string" ||
      expires === null || expires < now ||
      revoked.has(right.sha256)
    ) {
      throw authorizationError(`Registry source authorization is expired, revoked, or invalid: ${right?.source ?? "unknown"}`);
    }
    current.add(right.sha256);
  }
  const expected = normalizedShaSet(expectedAuthorizationSha256s);
  if (production && !expected.size) {
    throw authorizationError("RISE_SOURCE_AUTHORIZATION_SHA256S is required in production");
  }
  if (expected.size && (expected.size !== current.size || [...expected].some((sha) => !current.has(sha)))) {
    throw authorizationError("Registry source authorization hashes do not match the runtime pins");
  }
  return true;
}
