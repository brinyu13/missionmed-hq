import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { assertCurrentSourceRights, validateAuthorizationRecord } from "../src/source-authorization.mjs";

const riseRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gate(validThrough = "2099-12-31") {
  return {
    sourceRightsApproved: true,
    sourceRights: [{
      source: "FREIDA",
      status: "approved",
      sha256: "a".repeat(64),
      sourceOwnerGrantSha256: "d".repeat(64),
      sourceOwnerGrantBytesVerified: true,
      authorizationId: "fixture-authorization",
      decisionRecordId: "fixture-decision",
      validThrough,
    }],
  };
}

test("persisted source rights expire and honor runtime revocation", () => {
  assert.equal(assertCurrentSourceRights(gate(), { now: Date.parse("2026-07-15") }), true);
  assert.throws(
    () => assertCurrentSourceRights(gate("2026-01-01"), { now: Date.parse("2026-07-15") }),
    /expired, revoked, or invalid/,
  );
  assert.throws(
    () => assertCurrentSourceRights(gate(), { revokedAuthorizationSha256s: "a".repeat(64) }),
    /expired, revoked, or invalid/,
  );
});

test("production requires an exact set of authorization pins", () => {
  assert.throws(() => assertCurrentSourceRights(gate(), { production: true }), /SHA256S is required/);
  assert.throws(
    () => assertCurrentSourceRights(gate(), {
      production: true,
      expectedAuthorizationSha256s: "b".repeat(64),
    }),
    /hashes do not match/,
  );
  assert.equal(assertCurrentSourceRights(gate(), {
    production: true,
    expectedAuthorizationSha256s: "a".repeat(64),
  }), true);
});

test("field-level source resolution keeps restricted corpora internal and admits only bounded projections", async () => {
  const dataset = JSON.parse(await fs.readFile(path.join(riseRoot, "config/dataset.v1.json"), "utf8"));
  const resolutions = JSON.parse(await fs.readFile(path.join(riseRoot, "config/source-resolutions.v1.json"), "utf8"));
  assert.equal(dataset.canonicalGoogleSheetId, null);
  assert.equal(dataset.requiredSourceAuthorizations[0].approvedRecordSha256, null);
  assert.equal(resolutions.authorizationStatus, "mixed_field_level");
  assert.equal(resolutions.resolutions.FREIDA, "INTERNAL_ONLY_PENDING_WRITTEN_AUTHORIZATION");
  assert.equal(resolutions.resolutions["Residency Explorer"], "INTERNAL_ONLY_PENDING_WRITTEN_AUTHORIZATION");
  assert.equal(resolutions.resolutions["SOAP 2026"], "APPROVED_HISTORICAL_EXACT_ACGME_PRIVATE_BETA");
  assert.equal(resolutions.resolutions["Provider Research Factory"], "CANONICAL_INGEST_REVIEW_REQUIRED");
});

test("SOAP authority is bounded to the approved historical-cycle product", () => {
  const result = validateAuthorizationRecord({
    schemaVersion: 1,
    authorizationId: "rise-auth-soap-2026-dr-148-v1",
    status: "approved",
    provider: "NRMP R3 SOAP Unfilled Positions 2026",
    product: "SOAP 2026 bounded historical projection",
    writtenAuthorizationReference: "MissionMed OS DR-148",
    sourceOwnerGrantSha256: "f".repeat(64),
    allowedUses: ["create_or_supplement_missionmed_rise_database"],
    effectiveFrom: "2026-08-29T00:00:00.000Z",
    validThrough: "2027-08-29T23:59:59.999Z",
    missionMedReview: {
      decision: "approved",
      decisionRecordId: "DR-148",
      reviewerSubject: "independent-authority-review:085c00d",
      reviewedAt: "2026-08-29T00:00:00.000Z",
    },
  }, "SOAP 2026", { now: Date.parse("2026-08-30T12:00:00.000Z") });
  assert.equal(result.source, "SOAP 2026");
  assert.equal(result.decisionRecordId, "DR-148");
});
