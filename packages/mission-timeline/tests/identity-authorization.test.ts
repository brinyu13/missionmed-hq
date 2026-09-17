import assert from "node:assert/strict";
import test from "node:test";

import { decide } from "../src/security/authorization.js";
import { InMemoryPrincipalDirectory, MatrixSessionExchange } from "../src/identity/matrix-identity.js";
import { advisor, context, FIXED_NOW, fixedClock, student } from "./fixtures.js";

test("Matrix exchange maps immutable WordPress ID and never trusts email", async () => {
  const directory = new InMemoryPrincipalDirectory();
  directory.register({
    principalId: student.principalId,
    wpUserId: 42,
    role: "STUDENT",
    programIds: student.programIds,
    assignedDocumentIds: [],
    active: true,
  });
  const exchange = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const session = await exchange.exchange({
    wpUserId: 42,
    displayName: "Student",
    email: "attacker-controlled@example.invalid",
    nonceVerified: true,
    sessionId: "matrix_session",
  });
  const claims = exchange.verify(session.token, "request_1");
  assert.equal(claims.principalId, student.principalId);
  assert.equal(claims.role, "STUDENT");
  assert.equal(session.expiresAt, "2026-07-15T12:10:00.000Z");
});

test("Matrix exchange rejects unverified nonce and token tampering", async () => {
  const directory = new InMemoryPrincipalDirectory();
  directory.register({ principalId: student.principalId, wpUserId: 42, role: "STUDENT", programIds: [], assignedDocumentIds: [], active: true });
  const exchange = new MatrixSessionExchange(directory, { verify: async (identity) => identity.nonceVerified }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  await assert.rejects(
    exchange.exchange({ wpUserId: 42, displayName: "Student", nonceVerified: false, sessionId: "bad" }),
    (error: { code?: string }) => error.code === "MATRIX_NONCE_INVALID",
  );
  const valid = await exchange.exchange({ wpUserId: 42, displayName: "Student", nonceVerified: true, sessionId: "good" });
  assert.throws(() => exchange.verify(`${valid.token}x`, "request"), (error: { code?: string }) => error.code === "SESSION_TOKEN_INVALID");
});

test("authorization is owner and assignment scoped with deny by default", () => {
  const resource = {
    documentId: "timeline_test",
    ownerPrincipalId: student.principalId,
    programId: "program_internal_medicine",
  };
  assert.equal(decide(student, "document:edit", resource).allowed, true);
  assert.equal(decide(context("STUDENT", "principal_other"), "document:read", resource).allowed, false);
  assert.equal(decide(advisor, "review:comment", resource).allowed, true);
  assert.equal(decide({ ...advisor, assignedDocumentIds: [] }, "review:comment", resource).allowed, false);
  assert.equal(decide(context("PLATFORM_ADMIN", "admin"), "document:read", resource).allowed, false);
});

test("break glass and faculty grants expire deterministically", () => {
  const resource = { documentId: "timeline_test", ownerPrincipalId: student.principalId, programId: "program_internal_medicine" };
  const active = context("PLATFORM_ADMIN", "platform", { breakGlass: { reason: "Incident 42", expiresAt: "2026-07-15T12:01:00.000Z" } });
  const expired = { ...active, breakGlass: { reason: "Incident 42", expiresAt: "2026-07-15T11:59:00.000Z" } };
  assert.equal(decide(active, "document:read", resource, fixedClock).allowed, true);
  assert.equal(decide(expired, "document:read", resource, fixedClock).allowed, false);
  const faculty = context("FACULTY", "faculty", {
    facultyGrants: [{ documentId: "timeline_test", actions: ["document:read"], expiresAt: "2026-07-15T12:30:00.000Z" }],
  });
  assert.equal(decide(faculty, "document:read", resource, fixedClock).allowed, true);
  assert.equal(decide(faculty, "document:edit", resource, fixedClock).allowed, false);
  assert.equal(FIXED_NOW.toISOString(), "2026-07-15T12:00:00.000Z");
});
