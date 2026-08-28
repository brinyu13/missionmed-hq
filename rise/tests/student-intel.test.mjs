import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";

import { createMemoryStudentIntelStore, createRiseServer } from "../server.mjs";

const ISSUER = "https://auth.example.test";
const CSRF = "csrfTokenForStudentIntelTests000000";

function session(subject, capabilities, displayName, role = "student") {
  return {
    subject,
    displayName,
    role,
    audience: "rise",
    issuer: ISSUER,
    capabilities,
    sessionId: createHash("sha256").update(subject).digest("hex"),
    csrfToken: CSRF,
    validatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

const sessions = new Map([
  ["alice", session("wp:course-3893:alice", ["rise:read", "rise:private-beta", "rise:contribute"], "Alice Applicant")],
  ["bob", session("wp:course-3646:bob", ["rise:read", "rise:private-beta", "rise:contribute"], "Bob Beta")],
  ["readonly", session("wp:unrelated:readonly", ["rise:read"], "Read Only")],
  ["admin", session("wp:admin:one", ["rise:read", "rise:private-beta", "rise:contribute", "rise:operator", "rise:admin"], "MissionMed Admin", "admin")],
]);

const registryIndex = {
  schemaVersion: 1,
  registryReleaseId: "student_intel_test_release",
  activationStatus: "test_fixture",
  dataClassification: "synthetic_test_fixture",
  releaseGate: { sourceRightsApproved: false },
  counts: { matchableClaims: 0, quarantinedSourceRows: 0 },
  filters: { states: ["NY"], specialties: ["Internal Medicine"] },
  programs: [{
    id: "program-fixture",
    programSpecialtyId: "ps-fixture",
    display: { programName: "Fixture Program", institution: "Fixture Institution", hospital: "Fixture Hospital", city: "Albany", state: "NY", zip: "12208" },
    designation: "Internal Medicine",
    kind: "single",
    entryFormat: "categorical",
    components: ["Internal Medicine"],
    identifiers: [{ namespace: "TEST", value: "fixture" }],
    browseMemberships: [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
    fields: {},
    evidence: { knownClaims: 0, evidenceLabeledClaims: 0, quarantinedClaims: 0, coveragePercent: 0, matchableClaims: 0 },
    source: { authority: "SYNTHETIC_TEST_FIXTURE", urls: [], retrievedAt: "2026-08-28", sourceUpdatedAt: "2026-08-28" },
  }],
};

let server;
let origin;

function headers(user, { mutation = false } = {}) {
  return {
    "X-Test-User": user,
    ...(mutation ? { "Content-Type": "application/json", "X-RISE-CSRF": CSRF } : {}),
  };
}

before(async () => {
  server = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async (request) => sessions.get(request.headers["x-test-user"]) ?? null,
    authIssuer: ISSUER,
    studentIntelStore: createMemoryStudentIntelStore(),
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("private-beta notice acknowledgment is scoped to the authenticated student", async () => {
  const first = await fetch(`${origin}/api/rise/v1/me/beta-notice`, { headers: headers("alice") });
  assert.deepEqual(await first.json(), { version: "rise-private-beta-notice-2026-08-28", acknowledged: false });
  const acknowledged = await fetch(`${origin}/api/rise/v1/me/beta-notice`, {
    method: "POST",
    headers: headers("alice", { mutation: true }),
    body: "{}",
  });
  assert.deepEqual(await acknowledged.json(), { version: "rise-private-beta-notice-2026-08-28", acknowledged: true });
  assert.equal((await (await fetch(`${origin}/api/rise/v1/me/beta-notice`, { headers: headers("bob") })).json()).acknowledged, false);
});

test("only private-beta contributors can submit and input validation fails closed", async () => {
  const denied = await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, {
    method: "POST",
    headers: headers("readonly", { mutation: true }),
    body: JSON.stringify({ category: "Culture", claim: "Denied", observedOn: "2026-08-20", sourceKind: "FIRSTHAND" }),
  });
  assert.equal(denied.status, 403);

  const future = await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, {
    method: "POST",
    headers: headers("alice", { mutation: true }),
    body: JSON.stringify({ category: "Visa", claim: "Future claim", observedOn: "2099-01-01", sourceKind: "ONLINE", sourceUrl: "https://example.test" }),
  });
  assert.equal(future.status, 400);
  assert.equal((await future.json()).error.code, "INVALID_INTEL_DATE");

  const insecureUrl = await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, {
    method: "POST",
    headers: headers("alice", { mutation: true }),
    body: JSON.stringify({ category: "Visa", claim: "Unsafe source", observedOn: "2026-08-20", sourceKind: "ONLINE", sourceUrl: "http://example.test" }),
  });
  assert.equal(insecureUrl.status, 400);
  assert.equal((await insecureUrl.json()).error.code, "INVALID_INTEL_SOURCE_URL");
});

let anonymousSubmissionId;

test("anonymous Student Intel never exposes hidden identity to another student", async () => {
  const created = await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, {
    method: "POST",
    headers: headers("alice", { mutation: true }),
    body: JSON.stringify({
      category: "Visa",
      claim: "The coordinator said the J-1 policy changed for this cycle.",
      contextNotes: "Email received after an interview invitation.",
      observedOn: "2026-08-20",
      sourceKind: "DIRECT_COMMUNICATION",
      sourceLabel: "Coordinator email",
      displayIdentity: "ANONYMOUS",
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  anonymousSubmissionId = createdBody.record.submissionId;
  assert.equal(createdBody.record.highPriority, true);
  assert.equal(createdBody.record.contributor, "Anonymous MissionMed Student");

  const studentResponse = await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, { headers: headers("bob") });
  const studentBody = await studentResponse.json();
  assert.equal(studentBody.records.length, 1);
  assert.equal(studentBody.records[0].contributor, "Anonymous MissionMed Student");
  const serialized = JSON.stringify(studentBody);
  assert.equal(serialized.includes("Alice Applicant"), false);
  assert.equal(serialized.includes("wp:course-3893:alice"), false);
  assert.equal(Object.hasOwn(studentBody.records[0], "submitterSubject"), false);
  assert.equal(Object.hasOwn(studentBody.records[0], "originalClaim"), false);

  const adminBody = await (await fetch(`${origin}/api/rise/v1/operator/student-intel`, { headers: headers("admin") })).json();
  assert.equal(adminBody.records[0].submitterDisplayName, "Alice Applicant");
  assert.equal(adminBody.records[0].submitterSubject, "wp:course-3893:alice");
  assert.equal(adminBody.analytics.highPriority, 1);
  assert.deepEqual(adminBody.analytics.topPrograms, [{ programSpecialtyId: "ps-fixture", count: 1 }]);
  assert.deepEqual(adminBody.analytics.topCategories, [{ category: "Visa", count: 1 }]);
});

test("corroboration is idempotent and a contributor cannot corroborate their own report", async () => {
  const own = await fetch(`${origin}/api/rise/v1/student-intel/${anonymousSubmissionId}/corroborate`, {
    method: "POST", headers: headers("alice", { mutation: true }), body: "{}",
  });
  assert.equal((await own.json()).corroborationCount, 0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${origin}/api/rise/v1/student-intel/${anonymousSubmissionId}/corroborate`, {
      method: "POST", headers: headers("bob", { mutation: true }), body: "{}",
    });
    assert.equal((await response.json()).corroborationCount, 1);
  }
});

test("moderation preserves the original claim and canonical promotion requires verification", async () => {
  const premature = await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }),
    body: JSON.stringify({ action: "PROMOTE_CANONICAL", canonicalField: "visa.j1", canonicalValue: true, reason: "Attempt before verification" }),
  });
  assert.equal(premature.status, 400);
  assert.equal((await premature.json()).error.code, "INTEL_PROMOTION_NOT_VERIFIED");

  const edited = await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }),
    body: JSON.stringify({ action: "EDIT_DISPLAY", displayClaim: "A coordinator communication indicated a J-1 policy change.", reason: "Remove identifying detail" }),
  });
  const editedRecord = (await edited.json()).record;
  assert.match(editedRecord.originalClaim, /coordinator said/);
  assert.match(editedRecord.claim, /communication indicated/);

  const verified = await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }),
    body: JSON.stringify({ action: "MARK_VERIFIED", reason: "Confirmed against the official program page" }),
  });
  assert.equal((await verified.json()).record.status, "VERIFIED_BY_MISSIONMED");

  const promoted = await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }),
    body: JSON.stringify({ action: "PROMOTE_CANONICAL", canonicalField: "visa.j1", canonicalValue: true, reason: "Explicit canonical promotion" }),
  });
  assert.equal(promoted.status, 200);
  const audit = await (await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}/audit`, { headers: headers("admin") })).json();
  assert.deepEqual(audit.records.map((event) => event.action), ["EDIT_DISPLAY", "MARK_VERIFIED", "PROMOTE_CANONICAL"]);
  assert.match(audit.records[0].before.originalClaim, /coordinator said/);
  assert.match(audit.records[2].after.originalClaim, /coordinator said/);
});

test("hide and unhide control every student projection, while admin identity remains available", async () => {
  const hidden = await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }), body: JSON.stringify({ action: "HIDE", reason: "Privacy review" }),
  });
  assert.equal((await hidden.json()).record.visible, false);
  for (const user of ["alice", "bob"]) {
    const body = await (await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, { headers: headers(user) })).json();
    assert.equal(body.records.length, 0);
  }
  const admin = await (await fetch(`${origin}/api/rise/v1/operator/student-intel`, { headers: headers("admin") })).json();
  assert.equal(admin.records[0].submitterDisplayName, "Alice Applicant");

  await fetch(`${origin}/api/rise/v1/operator/student-intel/${anonymousSubmissionId}`, {
    method: "PATCH", headers: headers("admin", { mutation: true }), body: JSON.stringify({ action: "UNHIDE", reason: "Privacy review complete" }),
  });
  assert.equal((await (await fetch(`${origin}/api/rise/v1/program-specialties/ps-fixture/student-intel`, { headers: headers("bob") })).json()).records.length, 1);
});

test("production-shaped staging storage cannot masquerade as a live canonical promotion sink", async () => {
  const store = createMemoryStudentIntelStore({ canonicalPromotionMode: "staging_only" });
  const submitted = await store.submit({
    subject: sessions.get("alice").subject,
    displayName: "Alice Applicant",
    releaseId: registryIndex.registryReleaseId,
    programSpecialtyId: "ps-fixture",
    input: {
      category: "Visa", claim: "Verified staging-only claim", contextNotes: "", observedOn: "2026-08-20",
      anonymousToStudents: true, highPriority: true,
      source: { kind: "ONLINE", url: "https://example.test/source", label: "Official source" },
    },
  });
  await store.moderate({ actorSubject: sessions.get("admin").subject, submissionId: submitted.submissionId, action: "MARK_VERIFIED", input: { reason: "Test verification" } });
  const stagingServer = createRiseServer({
    registryIndex,
    authMode: "injected",
    authenticator: async (request) => sessions.get(request.headers["x-test-user"]) ?? null,
    authIssuer: ISSUER,
    studentIntelStore: store,
    logger: { info() {}, error() {} },
  });
  await new Promise((resolve) => stagingServer.listen(0, "127.0.0.1", resolve));
  try {
    const stagingOrigin = `http://127.0.0.1:${stagingServer.address().port}`;
    const response = await fetch(`${stagingOrigin}/api/rise/v1/operator/student-intel/${submitted.submissionId}`, {
      method: "PATCH", headers: headers("admin", { mutation: true }),
      body: JSON.stringify({ action: "PROMOTE_CANONICAL", canonicalField: "visa.j1", canonicalValue: true, reason: "Must fail closed" }),
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "CANONICAL_PROMOTION_SINK_UNAVAILABLE");
  } finally {
    await new Promise((resolve, reject) => stagingServer.close((error) => error ? reject(error) : resolve()));
  }
});

test("paid verification remains preview-only and cannot interfere with another campaign", async () => {
  const preview = await fetch(`${origin}/api/rise/v1/operator/student-intel/verification:preview`, {
    method: "POST", headers: headers("admin", { mutation: true }), body: "{}",
  });
  const body = await preview.json();
  assert.equal(body.connected, false);
  assert.equal(body.paidSubmissionAuthorized, false);
  assert.equal(body.taskClass, "RISE_STUDENT_INTEL_CLAIM_VERIFICATION");
  assert.deepEqual(body.queueClasses, ["HIGH_PRIORITY", "TWICE_MONTHLY"]);
  assert.deepEqual(body.cadence, { timezone: "America/New_York", daysOfMonth: [1, 15], active: false });
  assert.equal(body.selectedProduct, null);
  assert.equal(body.routerPolicy, "P1-RISE-PARALLEL-COST-QUALITY-OPTIMIZATION-007");

  const run = await fetch(`${origin}/api/rise/v1/operator/student-intel/verification:run`, {
    method: "POST", headers: headers("admin", { mutation: true }), body: "{}",
  });
  assert.equal(run.status, 409);
  assert.equal((await run.json()).error.details.paidSubmissionAuthorized, false);
});
