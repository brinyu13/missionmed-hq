import assert from "node:assert/strict";
import test from "node:test";

import { SignJWT } from "jose";

import type { Role } from "../src/contracts/types.js";
import {
  WordPressTimelineJwtVerifier,
  type TimelinePrincipalDirectory,
  type TimelinePrincipalRecord,
} from "../src/identity/wordpress-timeline-jwt.js";

const secret = new TextEncoder().encode("d1-411c-test-jwt-secret-0123456789abcdef");
const principalId = "9d8d7a7a-c915-4d36-a657-910ad2220001";
const jti = "9d8d7a7a-c915-4d36-a657-910ad2220002";
const now = new Date("2026-08-02T18:00:00.000Z");

class Directory implements TimelinePrincipalDirectory {
  record: TimelinePrincipalRecord | null = {
    principalId,
    wpUserId: 42,
    role: "STUDENT",
    active: true,
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    resourceGrants: [],
  };

  async resolve(
    requestedPrincipalId: string,
    requestedWpUserId: number,
    requestedRole: Role,
  ): Promise<TimelinePrincipalRecord | null> {
    if (
      !this.record
      || requestedPrincipalId !== this.record.principalId
      || requestedWpUserId !== this.record.wpUserId
      || requestedRole !== this.record.role
    ) return null;
    return structuredClone(this.record);
  }
}

async function token(overrides: Record<string, unknown> = {}, key = secret): Promise<string> {
  const seconds = Math.floor(now.getTime() / 1000);
  return new SignJWT({
    wp_user_id: 42,
    timeline_role: "STUDENT",
    timeline_eligible: true,
    is_wordpress_administrator: false,
    has_learndash_3893_access: true,
    course_id: 3893,
    ...overrides,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: "timeline-v1" })
    .setIssuer("https://missionmed.example/timeline/")
    .setAudience("mission-timeline")
    .setSubject(principalId)
    .setJti(jti)
    .setIssuedAt(seconds)
    .setNotBefore(seconds - 2)
    .setExpirationTime(seconds + 120)
    .sign(key);
}

function verifier(directory = new Directory()): WordPressTimelineJwtVerifier {
  return new WordPressTimelineJwtVerifier({
    issuer: "https://missionmed.example/timeline/",
    audience: "mission-timeline",
    secretsByKeyId: new Map([["timeline-v1", secret]]),
    principalDirectory: directory,
    clock: () => now,
  });
}

test("valid course-3893 student JWT binds to the immutable DB principal", async () => {
  const context = await verifier().verify(await token(), "request_411c");
  assert.equal(context.principalId, principalId);
  assert.equal(context.wpUserId, 42);
  assert.equal(context.role, "STUDENT");
  assert.equal(context.hasLearndash3893Access, true);
  assert.equal(context.isWordpressAdministrator, false);
});

test("administrator role requires the administrator claim and does not imply a resource grant", async () => {
  const directory = new Directory();
  directory.record = { ...directory.record!, role: "PROGRAM_ADMIN", resourceGrants: [] };
  const context = await verifier(directory).verify(await token({
    timeline_role: "PROGRAM_ADMIN",
    is_wordpress_administrator: true,
    has_learndash_3893_access: false,
  }), "request_admin");
  assert.equal(context.role, "PROGRAM_ADMIN");
  assert.deepEqual(context.facultyGrants, []);
});

test("wrong audience, eligibility, role, course, signature, and database binding fail closed", async () => {
  const seconds = Math.floor(now.getTime() / 1000);
  const wrongAudience = await new SignJWT({
    wp_user_id: 42,
    timeline_role: "STUDENT",
    timeline_eligible: true,
    is_wordpress_administrator: false,
    has_learndash_3893_access: true,
    course_id: 3893,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: "timeline-v1" })
    .setIssuer("https://missionmed.example/timeline/")
    .setAudience("other-product")
    .setSubject(principalId)
    .setJti(jti)
    .setIssuedAt(seconds)
    .setNotBefore(seconds - 2)
    .setExpirationTime(seconds + 120)
    .sign(secret);
  await assert.rejects(verifier().verify(wrongAudience, "r1"), /Timeline session token is invalid/);
  await assert.rejects(verifier().verify(await token({ timeline_eligible: false }), "r2"), /Timeline session token is invalid/);
  await assert.rejects(verifier().verify(await token({ timeline_role: "PROGRAM_ADMIN" }), "r3"), /Timeline session token is invalid/);
  await assert.rejects(verifier().verify(await token({ course_id: 1 }), "r4"), /Timeline session token is invalid/);
  await assert.rejects(verifier().verify(await token({}, new TextEncoder().encode("another-long-signing-secret-0123456789abcdef")), "r5"), /Timeline session token is invalid/);
  const missing = new Directory();
  missing.record = null;
  await assert.rejects(verifier(missing).verify(await token(), "r6"), /Timeline principal is unavailable/);
});

test("expired token is rejected", async () => {
  const seconds = Math.floor(now.getTime() / 1000);
  const expired = await new SignJWT({
    wp_user_id: 42,
    timeline_role: "STUDENT",
    timeline_eligible: true,
    is_wordpress_administrator: false,
    has_learndash_3893_access: true,
    course_id: 3893,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: "timeline-v1" })
    .setIssuer("https://missionmed.example/timeline/")
    .setAudience("mission-timeline")
    .setSubject(principalId)
    .setJti(jti)
    .setIssuedAt(seconds - 200)
    .setNotBefore(seconds - 200)
    .setExpirationTime(seconds - 10)
    .sign(secret);
  await assert.rejects(verifier().verify(expired, "expired"), /Timeline session token is invalid/);
});
