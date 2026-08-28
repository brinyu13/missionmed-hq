import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { assertCurrentSourceRights } from "../src/source-authorization.mjs";

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

test("blocked source configuration exposes no direct source locator or real-program resolution", async () => {
  const dataset = JSON.parse(await fs.readFile(path.join(riseRoot, "config/dataset.v1.json"), "utf8"));
  const resolutions = JSON.parse(await fs.readFile(path.join(riseRoot, "config/source-resolutions.v1.json"), "utf8"));
  assert.equal(dataset.canonicalGoogleSheetId, null);
  assert.equal(dataset.requiredSourceAuthorizations[0].approvedRecordSha256, null);
  assert.equal(resolutions.authorizationStatus, "blocked_pending_source_owner_rights");
  assert.deepEqual(resolutions.resolutions, {});
});
