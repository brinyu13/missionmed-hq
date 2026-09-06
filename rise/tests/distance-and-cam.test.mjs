import assert from "node:assert/strict";
import test from "node:test";
import { validateCamContext } from "../src/cam-context.mjs";
import { approximateStraightLineDistance } from "../src/distance.mjs";
import { programIdentity, programSpecialtyIdentity } from "../src/identity.mjs";
import { CRITERION_OUTCOMES } from "../src/matching.mjs";

test("distance is labeled as approximate straight-line distance", () => {
  const result = approximateStraightLineDistance(
    { latitude: 40.7128, longitude: -74.0060 },
    { latitude: 40.7306, longitude: -73.9352 },
    { originBasis: "ZIP centroid", destinationBasis: "program mailing address", datasetVersion: "fixture-v1" },
  );
  assert.equal(result.state, "known");
  assert.equal(result.method, "haversine");
  assert.match(result.label, /^Approximately \d+ straight-line miles$/);
  assert.doesNotMatch(result.label, /commute|drive/i);
});

test("distance returns unknown when either coordinate is missing", () => {
  assert.equal(approximateStraightLineDistance(null, { latitude: 1, longitude: 1 }).state, "unknown");
});

const SUBJECT = "wp:123";
const RELEASE_ID = "rise_registry_2026_07_15";
const PROGRAM_ID = programIdentity("1400000001").id;
const PROGRAM_SPECIALTY_ID = programSpecialtyIdentity(PROGRAM_ID, "Internal Medicine").id;
const KNOWN_REFERENCES = Object.freeze({
  claim: new Set(["rise_claim_visa"]),
  criterion: new Set(["matrix_criterion_visa"]),
  question: new Set(["cam_question_001"]),
  storyforge_reference: new Set(["storyforge_reference_001"]),
  assessment: new Set(["matrix_assessment_001"]),
});

function validContext(now, overrides = {}) {
  return {
    audience: "cam",
    subject: SUBJECT,
    issuedAt: now,
    expiresAt: now + 4 * 60 * 1000,
    jti: "one-time-fixture-0001",
    programId: PROGRAM_ID,
    programSpecialtyId: PROGRAM_SPECIALTY_ID,
    registryReleaseId: RELEASE_ID,
    claimIds: ["rise_claim_visa"],
    assessmentId: "matrix_assessment_001",
    criterionOutcomes: [{
      criterionId: "matrix_criterion_visa",
      outcome: CRITERION_OUTCOMES.SATISFIED,
    }],
    questionIds: ["cam_question_001"],
    consentedStoryForgeReferenceIds: ["storyforge_reference_001"],
    ...overrides,
  };
}

function createResolver({ allowPair = true, references = KNOWN_REFERENCES } = {}) {
  return {
    async validateProgramSpecialty(binding) {
      return allowPair
        && binding.subject === SUBJECT
        && binding.registryReleaseId === RELEASE_ID
        && binding.programId === PROGRAM_ID
        && binding.programSpecialtyId === PROGRAM_SPECIALTY_ID;
    },
    async validateReference(reference) {
      return reference.subject === SUBJECT
        && reference.registryReleaseId === RELEASE_ID
        && reference.programId === PROGRAM_ID
        && reference.programSpecialtyId === PROGRAM_SPECIALTY_ID
        && references[reference.kind]?.has(reference.id) === true;
    },
  };
}

function createAtomicReplayStore() {
  const consumed = new Set();
  return {
    consumed,
    async consumeOnce(binding) {
      const key = `${binding.audience}:${binding.subject}:${binding.jti}`;
      if (consumed.has(key)) return false;
      consumed.add(key);
      await Promise.resolve();
      return true;
    },
  };
}

function validationOptions(now, overrides = {}) {
  return {
    now,
    expectedSubject: SUBJECT,
    currentRegistryReleaseId: RELEASE_ID,
    resolver: createResolver(),
    replayStore: createAtomicReplayStore(),
    ...overrides,
  };
}

test("CAM context accepts only a short-lived, fully bound, resolver-backed payload", async () => {
  const now = Date.now();
  assert.deepEqual(await validateCamContext(validContext(now), validationOptions(now)), { ok: true, errors: [] });
});

test("CAM context requires subject, current release, resolvers, and atomic replay consumption", async () => {
  const now = Date.now();
  const base = validationOptions(now);

  const noSubject = await validateCamContext(validContext(now), { ...base, expectedSubject: undefined });
  assert.ok(noSubject.errors.includes("missing_subject_binding"));

  const noRelease = await validateCamContext(validContext(now), { ...base, currentRegistryReleaseId: undefined });
  assert.ok(noRelease.errors.includes("missing_registry_release_binding"));

  const noResolver = await validateCamContext(validContext(now), { ...base, resolver: undefined });
  assert.ok(noResolver.errors.includes("missing_reference_resolver"));

  const incompleteResolver = await validateCamContext(validContext(now), { ...base, resolver: {} });
  assert.ok(incompleteResolver.errors.includes("missing_program_specialty_validator"));
  assert.ok(incompleteResolver.errors.includes("missing_reference_validator"));

  const nonAtomicStore = await validateCamContext(validContext(now), { ...base, replayStore: new Set() });
  assert.ok(nonAtomicStore.errors.includes("missing_atomic_replay_store"));
});

test("CAM context binds the subject and current immutable registry release", async () => {
  const now = Date.now();
  const wrongSubject = await validateCamContext(
    validContext(now, { subject: "wp:999" }),
    validationOptions(now),
  );
  assert.ok(wrongSubject.errors.includes("wrong_subject"));

  const wrongRelease = await validateCamContext(
    validContext(now, { registryReleaseId: "rise_registry_old" }),
    validationOptions(now),
  );
  assert.ok(wrongRelease.errors.includes("wrong_registry_release"));
});

test("CAM context resolves the release-bound program and program-specialty relationship", async () => {
  const now = Date.now();
  const otherProgramSpecialtyId = programSpecialtyIdentity(PROGRAM_ID, "Pediatrics").id;
  const wrongPair = await validateCamContext(
    validContext(now, { programSpecialtyId: otherProgramSpecialtyId }),
    validationOptions(now),
  );
  assert.ok(wrongPair.errors.includes("invalid_program_specialty_pair"));

  const unavailable = await validateCamContext(
    validContext(now),
    validationOptions(now, {
      resolver: {
        ...createResolver(),
        async validateProgramSpecialty() {
          throw new Error("registry offline");
        },
      },
    }),
  );
  assert.ok(unavailable.errors.includes("program_specialty_resolver_unavailable"));
});

test("CAM context rejects fake or unrelated IDs through the injected resolver", async () => {
  const now = Date.now();
  const fakeClaim = await validateCamContext(
    validContext(now, { claimIds: ["rise_claim_unrelated"] }),
    validationOptions(now),
  );
  assert.ok(fakeClaim.errors.includes("unresolved_reference:claimIds[0]"));

  const fakeCriterion = await validateCamContext(
    validContext(now, {
      criterionOutcomes: [{
        criterionId: "matrix_criterion_fake",
        outcome: CRITERION_OUTCOMES.UNKNOWN,
      }],
    }),
    validationOptions(now),
  );
  assert.ok(fakeCriterion.errors.includes("unresolved_reference:criterionOutcomes[0].criterionId"));
});

test("CAM context does not consume a replay ID until every reference resolves", async () => {
  const now = Date.now();
  const replayStore = createAtomicReplayStore();
  const options = validationOptions(now, { replayStore });
  const invalid = await validateCamContext(
    validContext(now, { claimIds: ["rise_claim_unrelated"] }),
    options,
  );
  assert.equal(invalid.ok, false);
  assert.equal(replayStore.consumed.size, 0);

  const valid = await validateCamContext(validContext(now), options);
  assert.equal(valid.ok, true);
  assert.equal(replayStore.consumed.size, 1);
});

test("CAM context strictly validates arrays and criterion outcome shape", async () => {
  const now = Date.now();
  const malformed = await validateCamContext(
    validContext(now, {
      claimIds: [{ id: "rise_claim_visa" }],
      criterionOutcomes: [{
        criterionId: "matrix_criterion_visa",
        outcome: "LIKELY",
        explanation: { text: "unsupported nested object" },
      }],
      questionIds: Array.from({ length: 65 }, (_, index) => `cam_question_${index}`),
    }),
    validationOptions(now),
  );
  assert.ok(malformed.errors.includes("invalid_id:claimIds[0]"));
  assert.ok(malformed.errors.includes("invalid_criterion_outcome_state:0"));
  assert.ok(malformed.errors.includes("invalid_criterion_outcome_field:0:explanation"));
  assert.ok(malformed.errors.includes("array_too_large:questionIds"));
});

test("CAM context excludes coarse geography, street addresses, and coordinates", async () => {
  const now = Date.now();
  const geography = await validateCamContext(
    {
      ...validContext(now, { assessmentId: "123 Main Street" }),
      coarseGeography: "Mid-Atlantic",
      coordinates: "39.2904,-76.6122",
    },
    validationOptions(now),
  );
  assert.ok(geography.errors.includes("field_not_allowed:coarseGeography"));
  assert.ok(geography.errors.includes("geography_not_allowed:coarseGeography"));
  assert.ok(geography.errors.includes("field_not_allowed:coordinates"));
  assert.ok(geography.errors.includes("exact_geography_not_allowed"));
  assert.ok(geography.errors.includes("invalid_id:assessmentId"));
});

test("CAM context preserves issuance, TTL, HTML, and demo rejection", async () => {
  const now = Date.now();
  const missingIssuedAt = validContext(now);
  delete missingIssuedAt.issuedAt;
  assert.ok((await validateCamContext(missingIssuedAt, validationOptions(now))).errors.includes("invalid_issued_at"));

  const future = await validateCamContext(
    validContext(now, { issuedAt: now + 31_000, expiresAt: now + 4 * 60 * 1000 }),
    validationOptions(now),
  );
  assert.ok(future.errors.includes("issued_in_future"));

  const longLived = await validateCamContext(
    validContext(now, { expiresAt: now + 5 * 60 * 1000 + 1 }),
    validationOptions(now),
  );
  assert.ok(longLived.errors.includes("ttl_exceeds_five_minutes"));

  const unsafe = await validateCamContext(
    { ...validContext(now), rawProfileHtml: "<p>demo</p>" },
    validationOptions(now),
  );
  assert.ok(unsafe.errors.includes("html_not_allowed"));
  assert.ok(unsafe.errors.includes("prohibited_content:demo"));
  assert.ok(unsafe.errors.includes("field_not_allowed:rawProfileHtml"));
});

test("CAM context consumes replay IDs atomically and rejects concurrent replay", async () => {
  const now = Date.now();
  const replayStore = createAtomicReplayStore();
  const options = validationOptions(now, { replayStore });
  const [first, second] = await Promise.all([
    validateCamContext(validContext(now), options),
    validateCamContext(validContext(now), options),
  ]);

  assert.equal([first, second].filter((entry) => entry.ok).length, 1);
  const replay = [first, second].find((entry) => !entry.ok);
  assert.ok(replay.errors.includes("replayed_one_time_id"));
  assert.equal(replayStore.consumed.size, 1);
});
