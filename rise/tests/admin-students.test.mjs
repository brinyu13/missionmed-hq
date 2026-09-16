import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { createMemoryStudentStore, createRiseServer } from "../server.mjs";

const adminRegistryIndex = {
  schemaVersion: 1,
  registryReleaseId: "rise_registry_admin_students_test",
  sourceSnapshotId: "rise_snapshot_admin_students_test",
  activationStatus: "test_fixture",
  dataClassification: "synthetic_test_fixture",
  releaseGate: { sourceRightsApproved: false },
  counts: { programSpecialties: 1 },
  filters: { states: ["MN"], specialties: ["Internal Medicine"] },
  programs: [{
    id: "program-a", programSpecialtyId: "ps-a", designation: "Internal Medicine", kind: "single",
    entryFormat: "categorical", components: ["Internal Medicine"],
    display: { programName: "Fixture Program", institution: "Fixture Health", hospital: "Fixture Hospital", city: "Minneapolis", state: "MN", zip: "55401" },
    identifiers: [{ namespace: "ACGME_PROGRAM", value: "1400000001" }],
    browseMemberships: [{ browseSpecialty: "Internal Medicine", relationship: "EXACT_DESIGNATION" }],
    fields: {}, evidence: { knownClaims: 0, evidenceLabeledClaims: 0, quarantinedClaims: 0, coveragePercent: 0, matchableClaims: 0 },
    source: { authority: "TEST_FIXTURE", assertionClass: "synthetic", urls: [], retrievedAt: "2026-09-16", sourceUpdatedAt: "2026-09-16" },
  }],
};

test("student and admin views share one canonical gold-star relationship", async () => {
  const store = createMemoryStudentStore();
  await store.registerIdentity({ subject: "wp:101", displayName: "Student One", email: "one@example.test" });
  await store.put({ subject: "wp:101", programSpecialtyId: "ps-a", state: "SAVED", notes: "private", goldStarred: true });
  await store.put({ subject: "wp:101", programSpecialtyId: "ps-b", state: "APPLIED", notes: "private", goldStarred: false });
  const own = await store.list({ subject: "wp:101" });
  assert.equal(own.filter(record => record.goldStarred).length, 1);
  const index = await store.adminList({ q: "student one", goldOnly: true });
  assert.equal(index.total, 1);
  assert.equal(index.records[0].programCount, 2);
  assert.equal(index.records[0].goldStarCount, 1);
  const detail = await store.adminRead({ studentKey: "wp:101" });
  assert.equal(detail.records.length, 2);
  assert.equal(detail.records.find(record => record.programSpecialtyId === "ps-a").goldStarred, true);
  assert.deepEqual(detail.records.map(record => record.priorityPosition), [1, 2]);
  await store.reorder({ subject: "wp:101", orderedProgramSpecialtyIds: ["ps-b", "ps-a"] });
  assert.deepEqual((await store.list({ subject: "wp:101" })).map(record => record.programSpecialtyId), ["ps-b", "ps-a"]);
  await store.delete({ subject: "wp:101", programSpecialtyId: "ps-b" });
  assert.equal((await store.list({ subject: "wp:101" }))[0].priorityPosition, 1);
});

test("5014A priority migration and delegated routes are additive, RLS-bound, and priority-only", async () => {
  const [migration, priorityMigration, server, app] = await Promise.all([
    fs.readFile(new URL("../sql/015_admin_students_application_intelligence.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../sql/016_student_program_priority_order.sql", import.meta.url), "utf8"),
    fs.readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    fs.readFile(new URL("../web/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS gold_starred boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS rise_runtime\.student_program_subjects/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
  assert.match(migration, /current_setting\('rise\.is_admin', true\) = 'true'/);
  assert.match(priorityMigration, /ADD COLUMN IF NOT EXISTS priority_position integer/);
  assert.match(priorityMigration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(priorityMigration, /student_program_priority_audit/);
  assert.match(priorityMigration, /FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(priorityMigration, /GRANT [^;]+ TO (?:anon|authenticated|PUBLIC)/i);
  assert.doesNotMatch(migration, /GRANT [^;]+ TO (?:anon|authenticated|PUBLIC)/i);
  assert.match(server, /GET" && url\.pathname === "\/api\/rise\/v1\/operator\/students"[\s\S]*hasCapability\(session, "rise:operator"\)/);
  assert.match(server, /operatorStudentMatch[\s\S]*request\.method === "GET"/);
  assert.match(server, /operator\/delegated\/programs/);
  assert.match(server, /DELEGATED_CONTEXT_INVALID/);
  assert.match(app, /Student view is read-only except for priority order/);
  assert.match(app, /Viewing RISE for/);
  assert.match(app, /goldStarred: record\.goldStarred === true/);
});

test("admin student APIs enforce operator authorization and omit private notes", async () => {
  const store = createMemoryStudentStore();
  const studentKey = "a".repeat(64);
  await store.registerIdentity({ subject: studentKey, displayName: "Fixture Student", email: "student@example.test" });
  await store.put({ subject: studentKey, programSpecialtyId: "ps-a", state: "SAVED", notes: "private note", goldStarred: true });
  const server = createRiseServer({
    registryIndex: adminRegistryIndex,
    authMode: "injected",
    authIssuer: "https://auth.example.test",
    studentStore: store,
    authenticator: async (request) => {
      const role = request.headers["x-test-role"];
      if (!role) return null;
      return {
        subject: String(request.headers["x-test-actor"] ?? (role === "admin" ? "fixture-admin" : "fixture-student")),
        role,
        audience: "rise",
        issuer: "https://auth.example.test",
        capabilities: role === "admin" ? ["rise:read", "rise:operator"] : ["rise:read"],
        sessionId: String(request.headers["x-test-session-id"] ?? "1").repeat(64),
        csrfToken: "csrfTokenForAdminStudentTest000000",
        validatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    },
    logger: { info() {}, error() {} },
    adminIdentityResolver: async ({ identities }) => new Map(identities.map(identity => [identity.studentKey, {
      ...identity, displayName: "Canonical Student", email: "canonical@example.test", identityStatus: "CANONICAL_WORDPRESS",
    }])),
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${baseUrl}/api/rise/v1/operator/students`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/rise/v1/operator/students`, { headers: { "X-Test-Role": "student" } })).status, 403);
    const indexResponse = await fetch(`${baseUrl}/api/rise/v1/operator/students?goldOnly=true`, { headers: { "X-Test-Role": "admin" } });
    assert.equal(indexResponse.status, 200);
    const index = await indexResponse.json();
    assert.equal(index.total, 1);
    assert.equal(index.records[0].goldStarCount, 1);
    assert.equal(index.records[0].displayName, "Canonical Student");
    const detailResponse = await fetch(`${baseUrl}/api/rise/v1/operator/students/${studentKey}`, { headers: { "X-Test-Role": "admin" } });
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.records[0].programSpecialtyId, "ps-a");
    assert.equal(detail.records[0].goldStarred, true);
    assert.equal(Object.hasOwn(detail.records[0], "notes"), false);

    const csrfHeaders = { "X-Test-Role": "admin", "X-RISE-CSRF": "csrfTokenForAdminStudentTest000000" };
    const contextResponse = await fetch(`${baseUrl}/api/rise/v1/operator/students/${studentKey}/context`, { method: "POST", headers: csrfHeaders });
    assert.equal(contextResponse.status, 200);
    const context = await contextResponse.json();
    assert.equal(context.identity.displayName, "Canonical Student");
    assert.match(context.delegatedContextToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const delegatedHeaders = { ...csrfHeaders, "Content-Type": "application/json", "X-RISE-Delegated-Context": context.delegatedContextToken, "X-Test-Session-Id": "2" };
    const delegatedRead = await fetch(`${baseUrl}/api/rise/v1/operator/delegated/programs`, { headers: delegatedHeaders });
    assert.equal(delegatedRead.status, 200);
    const reorderResponse = await fetch(`${baseUrl}/api/rise/v1/operator/delegated/programs`, {
      method: "PATCH", headers: delegatedHeaders, body: JSON.stringify({ orderedProgramSpecialtyIds: ["ps-a"] }),
    });
    assert.equal(reorderResponse.status, 200);
    assert.equal((await reorderResponse.json()).records[0].priorityPosition, 1);
    assert.equal((await fetch(`${baseUrl}/api/rise/v1/operator/delegated/programs`, {
      headers: { ...delegatedHeaders, "X-RISE-Delegated-Context": `${context.delegatedContextToken}x` },
    })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/rise/v1/operator/delegated/programs`, {
      headers: { ...delegatedHeaders, "X-Test-Actor": "different-admin" },
    })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/rise/v1/operator/delegated/programs`, {
      headers: { "X-Test-Role": "student", "X-RISE-Delegated-Context": context.delegatedContextToken },
    })).status, 403);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
