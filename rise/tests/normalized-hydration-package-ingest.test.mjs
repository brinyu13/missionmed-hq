import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { loadNormalizedHydrationPackage, TERMINAL_STATE_CONTRACT } from "../adapters/normalized-hydration-package-ingest.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";

const packageRoot = fileURLToPath(new URL("../config/research-packages/tx-fl-adult-neurology-2026-09-12.v1", import.meta.url));
const registryPath = fileURLToPath(new URL("../releases/student-rights-safe/api-index.json", import.meta.url));
let loaded;

test("5012J normalized package validates exact sealed corpus", async () => {
  loaded = await loadNormalizedHydrationPackage(packageRoot, { registryPath });
  assert.deepEqual({
    programs: loaded.summary.programs, domainFacts: loaded.summary.domainFacts,
    residents: loaded.summary.residents, programDirectors: loaded.summary.programDirectors,
    faculty: loaded.summary.faculty, sources: loaded.summary.sources,
    conflicts: loaded.summary.conflicts, retractions: loaded.summary.retractions,
    compositionUnavailable: loaded.summary.compositionUnavailable,
    spend: loaded.summary.newProviderSpendUsd,
  }, {
    programs: 34, domainFacts: 884, residents: 566, programDirectors: 34,
    faculty: 636, sources: 4032, conflicts: 47, retractions: 6,
    compositionUnavailable: 9, spend: 0,
  });
  assert.equal(new Set(loaded.summary.acgmeIds).size, 34);
  assert.equal(loaded.identities.find((item) => item.acgmeId === "1801100157").state, "FL");
});

test("unknown composition is never projected as zero", () => {
  const claims = loaded.ingests.flatMap((ingest) => ingest.claims)
    .filter((claim) => claim.field === "research.resident_composition");
  assert.equal(claims.filter((claim) => !claim.value.percentagesAvailable).length, 9);
  for (const claim of claims.filter((item) => !item.value.percentagesAvailable)) {
    assert.deepEqual(claim.value.percentages, { usMd: null, do: null, img: null, caribbeanImg: null });
  }
});

test("all 34 PDs and all 566 unique residents are projected without identity inference", () => {
  const leadership = loaded.ingests.flatMap((ingest) => ingest.claims)
    .filter((claim) => claim.field === "research.leadership").flatMap((claim) => claim.value);
  assert.equal(leadership.filter((row) => row.roleCategory === "PROGRAM_DIRECTOR").length, 34);
  const rosters = loaded.ingests.flatMap((ingest) => ingest.claims)
    .filter((claim) => claim.field === "research.resident_roster" && Array.isArray(claim.value))
    .flatMap((claim) => claim.value);
  assert.equal(rosters.length, 566);
  assert.equal(new Set(rosters.map((row) => `${row.name}\0${row.pgy}\0${row.medical_school}`)).size, 566);
  assert.ok(rosters.every((row) => ["US_MD", "US_DO", "IMG_OTHER", "IMG_CARIBBEAN", "UNKNOWN"].includes(row.classification)));
});

test("terminal state envelopes supersede without approving disputed facts", () => {
  const review = reviewResearchCorpus(loaded.ingests, { resolvedAcgmeIds: new Set(loaded.summary.acgmeIds) });
  assert.equal(review.decisions.length, loaded.ingests.flatMap((item) => item.claims).length);
  const conflict = review.promotions.find((item) => item.field === "research.domain.visa" && item.canonicalValue.sourceState === "CONFLICT");
  assert.equal(conflict.canonicalValue.contractId, TERMINAL_STATE_CONTRACT);
  assert.equal(conflict.canonicalValue.state, "CONFLICT_REQUIRES_REVIEW");
  assert.ok(loaded.ingests.flatMap((item) => item.claims)
    .filter((claim) => claim.evidenceState === "TERMINAL_STATE_ENVELOPE")
    .every((claim) => claim.sourceUrls.length > 0));
  assert.ok(review.promotions.length > 1_000);
});

test("numeric cutoffs are conservative and omit preferences, ranges, and conflicts", () => {
  const applications = loaded.ingests.map((ingest) => ({
    acgmeId: ingest.acgmeId,
    value: ingest.claims.find((claim) => claim.field === "research.application_requirements").value,
  }));
  assert.deepEqual(applications.filter((item) => item.value.step2.publishedMinimum !== null)
    .map((item) => [item.acgmeId, item.value.step2.publishedMinimum]), [
      ["1801100003", 220],
      ["1804800169", 220],
    ]);
  assert.equal(applications.filter((item) => item.value.comlex.publishedMinimum !== null).length, 0);
});

test("known contamination guards survive normalization", () => {
  const all = JSON.stringify(loaded.ingests);
  assert.match(all, /Universidad Central del Este/);
  assert.match(all, /Universidad Central del Caribe/);
  assert.match(all, /UNVERIFIED_BOOLEAN/);
  assert.match(all, /PERSONAL_AND_UNDERGRADUATE/);
  assert.match(all, /2353180R0/);
  assert.match(all, /3626180R0/);
  assert.doesNotMatch(all, /Alejandra'?s own|applies_to_alejandra|alejandra_classification/i);
});
