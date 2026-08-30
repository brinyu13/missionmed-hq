import assert from "node:assert/strict";
import test from "node:test";
import { importSoap2026 } from "../tools/import-soap-2026.mjs";

test("SOAP 2026 import is checksum-bound, exact-identity reconciled, and track preserving", async () => {
  const { release, manifest, claims } = await importSoap2026({ write: false });
  assert.deepEqual(release.counts, {
    sourceRows: 925,
    positions: 2854,
    uniqueAcgmeIds: 886,
    exactAcgmeMatches: 883,
    reviewRequired: 3,
    additionalTrackRows: 39,
    specialties: 23,
  });
  assert.equal(claims.length, 925);
  assert.equal(release.identities.filter((identity) => identity.exposureState === "PRIVATE_BETA").length, 883);
  assert.equal(release.identities.filter((identity) => identity.exposureState === "INTERNAL_ONLY").length, 3);
  assert.deepEqual(
    release.identities.filter((identity) => identity.exposureState === "INTERNAL_ONLY").map((identity) => identity.acgmeId).sort(),
    ["1102500001", "1204500005", "1861723010"],
  );
  assert.equal(manifest.historicalClaimCount, 925);
  assert.equal(claims.filter((claim) => claim.publicationState === "PRIVATE_BETA" && claim.reviewState === "APPROVED").length, 922);
  assert.equal(claims.filter((claim) => claim.publicationState === "INTERNAL_ONLY" && claim.reviewState === "REVIEW_REQUIRED").length, 3);
  assert.ok(claims.every((claim) => claim.value.wording === "SOAP 2026 - This program appeared in the 2026 SOAP results."));
  const serialized = JSON.stringify({ release, claims });
  for (const prohibited of ["currently unfilled", "easy match", "guaranteed match", "friendliness rating"]) {
    assert.equal(serialized.toLowerCase().includes(prohibited), false, prohibited);
  }
});
