import assert from "node:assert/strict";
import test from "node:test";

import { createRiseIvocProgramProjection } from "../src/ivoc-projection.mjs";

const SESSION_ID = "00000000-0000-4000-8000-000000000042";

function program() {
  return {
    id: "program-im",
    programSpecialtyId: "ps-im",
    display: { programName: "Alpha Internal Medicine Program", state: "NY" },
    designation: "Internal Medicine",
    identifiers: [{ namespace: "ACGME_PROGRAM", value: "1400000001" }],
    fields: { "Program Best Described As": { knowledge: { state: "known", value: "University-based" } } },
  };
}

test("RISE emits one minimized deterministic IVOC projection from published current facts", () => {
  const input = {
    session: { subject: "wp:42" }, sessionId: SESSION_ID,
    registryReleaseId: "rise_registry_test", program: program(), now: () => Date.parse("2026-09-21T01:00:00.000Z"),
    researchProjection: { currentFacts: [
      { field: "research.curriculum", canonicalValue: { summary: "Graded autonomy with a longitudinal continuity clinic." }, publicationState: "STUDENT_VISIBLE", retrievedAt: "2026-09-20", sourceUrl: "https://example.test/curriculum" },
      { field: "research.leadership", canonicalValue: [{ role: "Program Director", name: "Private Name" }, { role: "Associate Program Director", name: "Private Name Two" }], publicationState: "PRIVATE_BETA", retrievedAt: "2026-09-20", sourceUrl: "https://example.test/leadership" },
      { field: "research.outcomes", canonicalValue: { summary: "Review required and must stay out." }, publicationState: "REVIEW_REQUIRED", retrievedAt: "2026-09-20" },
    ] },
  };
  const projection = createRiseIvocProgramProjection(input);
  const repeated = createRiseIvocProgramProjection(input);
  assert.deepEqual(projection, repeated);
  assert.equal(projection.subject_id, "wp:42");
  assert.equal(projection.authorization.consent_ref, `ivoc-session:${SESSION_ID}`);
  assert.equal(projection.payload.program_id, "ps-im");
  assert.equal(projection.payload.acgme_id, "1400000001");
  assert.deepEqual(projection.payload.people.map((item) => item.role), ["Associate Program Director", "Program Director"]);
  assert.equal(projection.payload.high_yield_facts.length, 1);
  assert.doesNotMatch(JSON.stringify(projection), /Private Name/u);
  assert.doesNotMatch(JSON.stringify(projection), /Review required/u);
  assert.match(projection.source_receipt.hash, /^[0-9a-f]{64}$/u);
});

test("invalid subject/session/program identity fails closed", () => {
  assert.throws(() => createRiseIvocProgramProjection({
    session: {}, sessionId: SESSION_ID, registryReleaseId: "release", program: program(),
  }), /input_invalid/u);
  assert.throws(() => createRiseIvocProgramProjection({
    session: { subject: "wp:42" }, sessionId: "not-a-session", registryReleaseId: "release", program: program(),
  }), /input_invalid/u);
});
