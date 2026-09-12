import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  DEEP_RESEARCH_DOSSIER_V2,
  DEEP_RESEARCH_DOMAIN_KEYS,
  RESEARCH_ROUTER_CONFIG,
  evaluateResearchEligibility,
  evaluateDossierCompletion,
  classifyDossierRequest,
  normalizeProviderRoute,
  normalizeResearchControls,
  programDescriptor,
  publicResearchControls,
  researchDedupeKey,
} from "../src/research-router.mjs";

const canaryProgram = {
  programSpecialtyId: "rise_ps_e1ada2b6-9c76-59c0-89c9-62edf4960026",
  designation: "Child Neurology",
  display: { state: "TX" },
  identifiers: [{ namespace: "ACGME_PROGRAM", value: "1854831078" }],
};

test("benchmark program descriptors normalize canonical US jurisdictions without widening the canary", () => {
  assert.deepEqual(programDescriptor({
    programSpecialtyId: "rise_ps_benchmark",
    designation: "Internal Medicine",
    display: { state: "New Jersey" },
    identifiers: [{ namespace: "ACGME_PROGRAM", value: "1403321227" }],
  }), {
    specialty: "Internal Medicine",
    state: "NJ",
    programSpecialtyId: "rise_ps_benchmark",
    acgmeId: "1403321227",
  });
});
const student = {
  capabilities: ["rise:read", "rise:private-beta"],
};

test("checked-in router contract matches the embedded production contract", async () => {
  const file = JSON.parse(await fs.readFile(new URL("../config/research-router.v1.json", import.meta.url), "utf8"));
  assert.deepEqual(file, RESEARCH_ROUTER_CONFIG);
  assert.equal(file.buildMode, "LIVE_PRODUCTION");
  assert.equal(file.defaults.globalEnabled, false);
  assert.equal(file.defaults.studentEnabled, false);
  assert.equal(file.defaults.emergencyKillSwitch, true);
  assert.equal(file.defaults.budgetCapUsd, 12);
  assert.equal(file.defaults.defaultQuota, 30);
});

test("Deep Research Dossier V2 is a deterministic 18-domain terminal contract", () => {
  assert.equal(DEEP_RESEARCH_DOSSIER_V2.contractId, "MISSIONMED_DEEP_RESEARCH_DOSSIER_V2");
  assert.equal(DEEP_RESEARCH_DOMAIN_KEYS.length, 18);
  const matrix = Object.fromEntries(DEEP_RESEARCH_DOMAIN_KEYS.map((key) => [key, {
    state: "RESEARCHED_NOT_FOUND", summary: "Meaningful search completed.", sourceUrls: [],
  }]));
  matrix.identity_structure.state = "VERIFIED";
  matrix.visa.state = "VERIFIED";
  matrix.application_requirements.state = "VERIFIED";
  const completion = evaluateDossierCompletion(matrix);
  assert.equal(completion.counts.NOT_RESEARCHED, 0);
  assert.equal(completion.deep, true);
  assert.equal(completion.outcome, "DEEP");
  assert.equal(classifyDossierRequest({ completionMatrix: matrix, researchedAt: new Date().toISOString() }).requestClass, "NO_OP");
});

test("dossier routing distinguishes FULL, DELTA, REFRESH and leaves no arbitrary claim-count shortcut", () => {
  assert.equal(classifyDossierRequest().requestClass, "FULL");
  const partial = { visa: { state: "VERIFIED", summary: "J-1", sourceUrls: ["https://example.edu"] } };
  const delta = classifyDossierRequest({ completionMatrix: partial });
  assert.equal(delta.requestClass, "DELTA");
  assert.ok(delta.requestedDomains.includes("application_requirements"));
  assert.ok(!delta.requestedDomains.includes("visa"));
  const complete = Object.fromEntries(DEEP_RESEARCH_DOMAIN_KEYS.map((key) => [key, { state: "RESEARCHED_NOT_FOUND" }]));
  complete.identity_structure.state = "VERIFIED";
  complete.visa.state = "VERIFIED";
  assert.equal(classifyDossierRequest({ completionMatrix: complete, researchedAt: "2025-01-01T00:00:00.000Z" }).requestClass, "REFRESH");
});

test("default production research controls fail closed", () => {
  const result = evaluateResearchEligibility({
    program: canaryProgram,
    session: student,
    controls: RESEARCH_ROUTER_CONFIG.defaults,
    subjectHash: "a".repeat(64),
  });
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ["EMERGENCY_KILL_SWITCH", "GLOBAL_PAUSED", "STUDENT_PAUSED"]);
});

test("student canary requires exact program allowlist, entitlement, and optional subject hash", () => {
  const controls = normalizeResearchControls({
    ...RESEARCH_ROUTER_CONFIG.defaults,
    globalEnabled: true,
    studentEnabled: true,
    emergencyKillSwitch: false,
    subjectAllowlistHashes: ["a".repeat(64)],
  });
  assert.equal(evaluateResearchEligibility({
    program: canaryProgram,
    session: student,
    controls,
    subjectHash: "a".repeat(64),
  }).eligible, true);
  assert.deepEqual(evaluateResearchEligibility({
    program: { ...canaryProgram, identifiers: [{ namespace: "ACGME_PROGRAM", value: "1850000000" }] },
    session: student,
    controls,
    subjectHash: "a".repeat(64),
  }).reasons, ["PROGRAM_OUT_OF_CANARY"]);
  assert.deepEqual(evaluateResearchEligibility({
    program: canaryProgram,
    session: { capabilities: ["rise:read"] },
    controls,
    subjectHash: "a".repeat(64),
  }).reasons, ["ENTITLEMENT_REQUIRED"]);
  assert.deepEqual(evaluateResearchEligibility({
    program: canaryProgram,
    session: student,
    controls,
    subjectHash: "b".repeat(64),
  }).reasons, ["SUBJECT_OUT_OF_CANARY"]);
});

test("administrator can use the bounded scope while student execution remains paused", () => {
  const controls = normalizeResearchControls({
    ...RESEARCH_ROUTER_CONFIG.defaults,
    globalEnabled: true,
    studentEnabled: false,
    emergencyKillSwitch: false,
  });
  const result = evaluateResearchEligibility({
    program: { ...canaryProgram, display: { state: "Florida" } },
    session: { capabilities: ["rise:read", "rise:operator"] },
    controls,
    subjectHash: "a".repeat(64),
    source: "ADMIN",
  });
  assert.equal(result.eligible, true);
  assert.equal(result.scope.state, "FL");
});

test("administrator cannot bypass the two-program production canary", () => {
  const controls = normalizeResearchControls({
    ...RESEARCH_ROUTER_CONFIG.defaults,
    globalEnabled: true,
    studentEnabled: true,
    emergencyKillSwitch: false,
  });
  const result = evaluateResearchEligibility({
    program: { ...canaryProgram, identifiers: [{ namespace: "ACGME_PROGRAM", value: "1850000000" }] },
    session: { capabilities: ["rise:read", "rise:operator"] },
    controls,
    subjectHash: "a".repeat(64),
    source: "ADMIN",
  });
  assert.deepEqual(result.reasons, ["PROGRAM_OUT_OF_CANARY"]);
});

test("zero-spend replay route cannot enable network or spend", () => {
  assert.throws(() => normalizeProviderRoute({
    providerKey: "RISE_REPLAY_TEST",
    modelKey: "fixture",
    state: "TEST_ONLY",
    enabled: true,
    networkAllowed: true,
    spendAllowed: false,
  }), /offline and zero-spend/);
  assert.throws(() => normalizeProviderRoute({
    providerKey: "PARALLEL",
    modelKey: "fixture",
    state: "BENCHMARKING",
    enabled: true,
    networkAllowed: true,
    spendAllowed: true,
  }), /Spend requires/);
});

test("public control projection reveals no subject hashes", () => {
  const controls = {
    ...RESEARCH_ROUTER_CONFIG.defaults,
    subjectAllowlistHashes: ["a".repeat(64)],
  };
  const payload = publicResearchControls(controls, RESEARCH_ROUTER_CONFIG.providers);
  assert.equal(payload.subjectCanaryRequired, true);
  assert.equal(payload.subjectCanaryCount, 1);
  assert.equal(Object.hasOwn(payload, "subjectAllowlistHashes"), false);
  assert.equal(payload.unapprovedProviderSpendUsd, 0);
});

test("dedupe keys are stable and isolate provider, program, and window", () => {
  const input = {
    programSpecialtyId: "rise_ps_canary",
    providerKey: "RISE_REPLAY_TEST",
    windowKey: "2026-09-09",
  };
  assert.equal(researchDedupeKey(input), researchDedupeKey(input));
  assert.notEqual(researchDedupeKey(input), researchDedupeKey({ ...input, windowKey: "2026-09-10" }));
  assert.match(researchDedupeKey(input), /^[a-f0-9]{64}$/);
  assert.match(researchDedupeKey({ ...input, windowKey: "56303671-4983-4d79-b622-c35bf994b453" }), /^[a-f0-9]{64}$/);
});

test("controls reject noncanonical state and nonzero global budget", () => {
  assert.throws(() => normalizeResearchControls({
    ...RESEARCH_ROUTER_CONFIG.defaults,
    stateScope: ["Atlantis"],
  }), /state scope/);
  const controls = normalizeResearchControls({ ...RESEARCH_ROUTER_CONFIG.defaults, budgetCapUsd: 1 });
  assert.equal(controls.budgetCapUsd, 1);
});
