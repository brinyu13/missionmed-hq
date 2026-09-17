import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

import type { PrincipalContext } from "../src/contracts/types.js";
import { sha256 } from "../src/core/canonical.js";
import {
  DisposableFilesystemS3Client,
  hasJpegPrivacyMetadata,
  InMemoryPrivateStorageAuditSink,
  isOpaquePrivateStorageKey,
  S3CompatibleClientError,
  StagingPrivateObjectStore,
} from "../src/storage/staging/index.js";
import type {
  DeleteObjectRequest,
  MalwareScannerPort,
  PresignDownloadRequest,
  PresignUploadRequest,
  PrivateStorageAuthorizationPort,
  PrivateStorageAuthorizationRequest,
  PrivateObjectSanitizerPort,
  PutObjectRequest,
  S3CompatibleClientPort,
  S3ObjectBody,
  S3ObjectHead,
  SignedObjectGrant,
} from "../src/storage/staging/index.js";
import { context, exportService, otherStudent, student } from "./fixtures.js";

const cleanScanner: MalwareScannerPort = {
  async scan() {
    return { status: "CLEAN", scanner: "test-boundary", scannerVersion: "1", signatureVersion: "fixture-1" };
  },
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = new TextEncoder().encode("%PDF-1.7\nfixture\n%%EOF");

function defaultAuthorization(calls: PrivateStorageAuthorizationRequest[]): PrivateStorageAuthorizationPort {
  return {
    async authorize(request) {
      calls.push(structuredClone(request));
      const { actor, operation, resource } = request;
      if (actor.role === "SERVICE") return { allowed: true, reasonCode: "SERVICE_POLICY" };
      if (!actor.programIds.includes(resource.programId)) return { allowed: false, reasonCode: "PROGRAM_DENIED" };
      if (actor.role === "STUDENT") {
        const ownerAllowed = resource.ownerPrincipalId === undefined || resource.ownerPrincipalId === actor.principalId;
        return {
          allowed: ownerAllowed,
          reasonCode: ownerAllowed ? `STUDENT_${operation}` : "STUDENT_OWNER_DENIED",
        };
      }
      if (actor.role === "ADVISOR") {
        const assigned = Boolean(resource.documentId && actor.assignedDocumentIds.includes(resource.documentId));
        const actionAllowed = operation === "READ" || operation === "LIST";
        return {
          allowed: assigned && actionAllowed,
          reasonCode: assigned && actionAllowed ? `ADVISOR_${operation}` : "ADVISOR_ASSIGNMENT_DENIED",
        };
      }
      return { allowed: false, reasonCode: "ROLE_DENIED" };
    },
  };
}

class MutableClock {
  private value = new Date("2026-07-15T12:00:00.000Z");

  readonly now = () => new Date(this.value);

  advance(milliseconds: number): void {
    this.value = new Date(this.value.getTime() + milliseconds);
  }
}

async function fixture(
  t: test.TestContext,
  options: {
    scanner?: MalwareScannerPort;
    sanitizer?: PrivateObjectSanitizerPort;
    clock?: MutableClock;
    client?: S3CompatibleClientPort;
    filesystem?: DisposableFilesystemS3Client;
    lifecycleRules?: ConstructorParameters<typeof StagingPrivateObjectStore>[0]["lifecycleRules"];
    retryPolicy?: ConstructorParameters<typeof StagingPrivateObjectStore>[0]["retryPolicy"];
    authorization?: PrivateStorageAuthorizationPort;
  } = {},
) {
  const clock = options.clock ?? new MutableClock();
  const filesystem = options.filesystem ?? (await DisposableFilesystemS3Client.create({ clock: clock.now }));
  t.after(() => filesystem.dispose());
  const audit = new InMemoryPrivateStorageAuditSink();
  const authorizationCalls: PrivateStorageAuthorizationRequest[] = [];
  const store = new StagingPrivateObjectStore({
    client: options.client ?? filesystem,
    malwareScanner: options.scanner ?? cleanScanner,
    authorization: options.authorization ?? defaultAuthorization(authorizationCalls),
    jpegSanitizer: options.sanitizer,
    auditSink: audit,
    environment: "test",
    uploadExpiryMs: 120_000,
    downloadExpiryMs: 60_000,
    lifecycleRules: options.lifecycleRules,
    retryPolicy: options.retryPolicy,
    clock: clock.now,
    sleep: async () => undefined,
  });
  return { store, filesystem, audit, clock, authorizationCalls };
}

async function stage(
  store: StagingPrivateObjectStore,
  filesystem: DisposableFilesystemS3Client,
  actor: PrincipalContext,
  bytes: Uint8Array,
  mimeType: string,
  overrides: Partial<Parameters<StagingPrivateObjectStore["signUpload"]>[1]> = {},
) {
  const signed = await store.signUpload(actor, {
    documentId: "timeline_test",
    objectClass: "MEDIA",
    mimeType,
    byteSize: bytes.byteLength,
    sha256: sha256(bytes),
    ...overrides,
  });
  await filesystem.uploadSigned(signed.uploadUrl, bytes, signed.requiredHeaders);
  return signed;
}

function jpegWithGpsExif(): Uint8Array {
  const exifPayload = new Uint8Array([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x47, 0x50, 0x53, 0x49, 0x46, 0x44,
  ]);
  const length = exifPayload.byteLength + 2;
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, length >> 8, length & 0xff, ...exifPayload,
    0xff, 0xd9,
  ]);
}

function hasCapabilityField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasCapabilityField);
  return Object.entries(value).some(([key, item]) => /(?:url|token|storage.?key)/i.test(key) || hasCapabilityField(item));
}

function code(expected: string): (error: unknown) => boolean {
  return (error) => Boolean(error && typeof error === "object" && "code" in error && error.code === expected);
}

test("private staging adapter uses short opaque grants and real private filesystem objects", async (t) => {
  const { store, filesystem, audit, clock } = await fixture(t);
  const signed = await stage(store, filesystem, student, PNG, "image/png");
  const pending = (await store.getAuthorizedObject(student, signed.objectId))!;

  assert.equal(isOpaquePrivateStorageKey(pending.storageKey), true);
  assert.doesNotMatch(pending.storageKey, /principal|student|timeline_test|@|\.\./i);
  assert.equal(Date.parse(signed.expiresAt) - clock.now().getTime(), 120_000);
  assert.equal((await stat(filesystem.rootDirectory)).mode & 0o777, 0o700);

  const confirmed = await store.confirmUpload(student, signed.objectId, signed.uploadToken);
  assert.equal(confirmed.status, "CONFIRMED");
  const metadata = await store.getStagingMetadata(student, signed.objectId);
  assert.equal(metadata.lifecycle.policyVersion, "staging-v1");
  assert.equal(metadata.lifecycle.retentionClass, "media-policy");
  assert.equal(metadata.integrity.storedSha256, sha256(PNG));
  const stored = await filesystem.headObject(confirmed.storageKey);
  assert.equal(stored?.metadata["retention-class"], "media-policy");
  assert.equal(stored?.metadata["malware-status"], "CLEAN");

  const download = await store.signDownload(student, signed.objectId);
  assert.equal(Date.parse(download.expiresAt) - clock.now().getTime(), 60_000);
  assert.deepEqual((await filesystem.downloadSigned(download.downloadUrl)).bytes, PNG);
  await assert.rejects(filesystem.downloadSigned(download.downloadUrl), (error: { code?: string }) => error.code === "S3_GRANT_REPLAYED");
  await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_UPLOAD_REPLAYED");

  assert.equal(hasCapabilityField(audit.events), false);
  assert.equal(JSON.stringify(audit.events).includes("staging-object+fs:"), false);
});

test("owner authorization precedes token checks and deletion revokes outstanding access", async (t) => {
  const { store, filesystem } = await fixture(t);
  const signed = await stage(store, filesystem, student, PNG, "image/png");

  await assert.rejects(store.confirmUpload(otherStudent, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_ACCESS_DENIED");
  await store.confirmUpload(student, signed.objectId, signed.uploadToken);
  await assert.rejects(store.signDownload(otherStudent, signed.objectId), (error: { code?: string }) => error.code === "OBJECT_ACCESS_DENIED");
  await assert.rejects(store.getStagingMetadata(otherStudent, signed.objectId), (error: { code?: string }) => error.code === "OBJECT_ACCESS_DENIED");
  await assert.rejects(store.deleteObject(otherStudent, signed.objectId), (error: { code?: string }) => error.code === "OBJECT_ACCESS_DENIED");

  const download = await store.signDownload(student, signed.objectId);
  await store.deleteObject(student, signed.objectId);
  assert.equal((await store.getAuthorizedObject(student, signed.objectId))?.status, "DELETED");
  assert.equal(await filesystem.objectCount(), 0);
  await assert.rejects(filesystem.downloadSigned(download.downloadUrl), (error: { code?: string }) => error.code === "S3_GRANT_REVOKED");

  await assert.rejects(
    store.signUpload(student, {
      documentId: "timeline_test",
      ownerPrincipalId: otherStudent.principalId,
      objectClass: "MEDIA",
      mimeType: "image/png",
      byteSize: PNG.byteLength,
      sha256: sha256(PNG),
    }),
    (error: { code?: string }) => error.code === "OBJECT_OWNER_OVERRIDE_DENIED",
  );
});

test("authorization callback binds owner, advisor assignment, program, list, and every lifecycle action", async (t) => {
  const { store, filesystem, authorizationCalls } = await fixture(t);
  const assignedAdvisor = context("ADVISOR", "principal_advisor", {
    assignedDocumentIds: ["timeline_test"],
  });
  const unassignedAdvisor = context("ADVISOR", "principal_unassigned_advisor");
  const otherProgramStudent = context("STUDENT", "principal_other_program", {
    programIds: ["program_surgery"],
  });
  const signed = await stage(store, filesystem, student, PNG, "image/png");
  await store.confirmUpload(student, signed.objectId, signed.uploadToken);

  const advisorGrant = await store.signDownload(assignedAdvisor, signed.objectId);
  assert.deepEqual((await filesystem.downloadSigned(advisorGrant.downloadUrl)).bytes, PNG);
  assert.equal((await store.getStagingMetadata(assignedAdvisor, signed.objectId)).record.id, signed.objectId);
  await assert.rejects(store.signDownload(unassignedAdvisor, signed.objectId), code("OBJECT_ACCESS_DENIED"));
  await assert.rejects(store.signDownload(otherProgramStudent, signed.objectId), code("OBJECT_ACCESS_DENIED"));
  await assert.rejects(store.deleteObject(assignedAdvisor, signed.objectId), code("OBJECT_ACCESS_DENIED"));

  const listed = await store.listObjects(student, {
    programId: "program_internal_medicine",
    ownerPrincipalId: student.principalId,
  });
  assert.deepEqual(listed.map((record) => record.id), [signed.objectId]);
  await assert.rejects(
    store.listObjects(otherProgramStudent, { programId: "program_internal_medicine" }),
    code("OBJECT_ACCESS_DENIED"),
  );

  await store.deleteObject(student, signed.objectId);
  const lifecycleOperations = authorizationCalls.map((request) => request.operation);
  for (const required of ["CREATE", "WRITE", "READ", "LIST", "DELETE"] as const) {
    assert.ok(lifecycleOperations.includes(required), `missing authorization callback for ${required}`);
  }
  assert.ok(
    authorizationCalls.every((request) => request.actor.principalId && request.resource.programId),
    "authorization callback must receive actor and program-bound resource",
  );
});

test("program, owner, document, and object scopes produce isolated opaque keys", async (t) => {
  const { store, filesystem } = await fixture(t);
  const programTwo = context("STUDENT", "principal_program_two", { programIds: ["program_surgery"] });
  const first = await stage(store, filesystem, student, PNG, "image/png", { documentId: "timeline_alpha" });
  const second = await stage(store, filesystem, otherStudent, PNG, "image/png", { documentId: "timeline_beta" });
  const third = await stage(store, filesystem, programTwo, PNG, "image/png", {
    documentId: "timeline_gamma",
    programId: "program_surgery",
  });
  const records = await Promise.all([
    store.getAuthorizedObject(student, first.objectId),
    store.getAuthorizedObject(otherStudent, second.objectId),
    store.getAuthorizedObject(programTwo, third.objectId),
  ]);
  const keys = records.map((record) => record!.storageKey);
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.every(isOpaquePrivateStorageKey));
  const scopeSegments = keys.map((key) => key.split("/").slice(3, 7).join("/"));
  assert.equal(new Set(scopeSegments).size, 3);
  assert.doesNotMatch(keys.join(" "), /program_surgery|timeline_|principal_/);
  const studentList = await store.listObjects(student, { programId: "program_internal_medicine" });
  assert.deepEqual(studentList.map((record) => record.id), [first.objectId]);
});

test("anonymous, traversal, guessed IDs, disallowed MIME, and oversize payloads fail closed", async (t) => {
  const { store, filesystem } = await fixture(t);
  const request = {
    documentId: "timeline_test",
    objectClass: "MEDIA" as const,
    mimeType: "image/png",
    byteSize: PNG.byteLength,
    sha256: sha256(PNG),
  };
  await assert.rejects(
    store.signUpload(undefined as unknown as PrincipalContext, request),
    code("OBJECT_AUTHENTICATION_REQUIRED"),
  );
  await assert.rejects(store.signUpload(student, { ...request, documentId: "../timeline_test" }), code("OBJECT_DOCUMENT_INVALID"));
  await assert.rejects(filesystem.headObject("../../outside"), code("S3_KEY_INVALID"));
  await assert.rejects(store.signDownload(student, "object_00000000-0000-4000-8000-000000000000"), code("OBJECT_NOT_FOUND"));
  await assert.rejects(store.getObject("object_00000000-0000-4000-8000-000000000000"), code("OBJECT_AUTHORIZATION_CONTEXT_REQUIRED"));
  await assert.rejects(store.signUpload(student, { ...request, mimeType: "application/x-msdownload" }), code("OBJECT_MIME_DENIED"));
  await assert.rejects(store.signUpload(student, { ...request, byteSize: 15 * 1024 * 1024 + 1 }), code("OBJECT_SIZE_DENIED"));
});

test("magic-byte spoofing and post-upload size, hash, MIME, and metadata changes quarantine", async (t) => {
  await t.test("magic bytes", async (t) => {
    const { store, filesystem } = await fixture(t);
    const signed = await stage(store, filesystem, student, PDF, "image/png");
    await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_MAGIC_MISMATCH");
    const metadata = await store.getStagingMetadata(student, signed.objectId);
    assert.equal(metadata.record.status, "QUARANTINED");
    assert.equal(metadata.quarantine?.persisted, true);
    assert.equal(isOpaquePrivateStorageKey(metadata.record.storageKey), true);
  });

  const cases = [
    { name: "size", replacement: new Uint8Array([...PNG, 0]), contentType: "image/png", code: "OBJECT_SIZE_MISMATCH", alterMetadata: false },
    { name: "hash", replacement: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b]), contentType: "image/png", code: "OBJECT_HASH_MISMATCH", alterMetadata: false },
    { name: "MIME", replacement: PNG, contentType: "text/plain", code: "OBJECT_MIME_MISMATCH", alterMetadata: false },
    { name: "metadata", replacement: PNG, contentType: "image/png", code: "OBJECT_METADATA_MISMATCH", alterMetadata: true },
  ];
  for (const attack of cases) {
    await t.test(attack.name, async (t) => {
      const { store, filesystem } = await fixture(t);
      const signed = await stage(store, filesystem, student, PNG, "image/png");
      const record = (await store.getAuthorizedObject(student, signed.objectId))!;
      const head = (await filesystem.headObject(record.storageKey))!;
      await filesystem.putObject({
        key: record.storageKey,
        bytes: attack.replacement,
        contentType: attack.contentType,
        checksumSha256: sha256(attack.replacement),
        metadata: attack.alterMetadata ? { ...head.metadata, "owner-hash": "0".repeat(64) } : head.metadata,
        idempotencyKey: `tamper-${attack.name}`,
      });
      await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === attack.code);
      assert.equal((await store.getAuthorizedObject(student, signed.objectId))?.status, "QUARANTINED");
    });
  }
});

test("malware scanner infection and unavailability fail closed into quarantine", async (t) => {
  await t.test("infected", async (t) => {
    const scanner: MalwareScannerPort = {
      async scan() {
        return { status: "INFECTED", scanner: "test-boundary", scannerVersion: "1", findingCode: "EICAR_TEST" };
      },
    };
    const { store, filesystem } = await fixture(t, { scanner });
    const bytes = new TextEncoder().encode("harmless scanner contract fixture");
    const signed = await stage(store, filesystem, student, bytes, "text/plain");
    await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_MALWARE_DETECTED");
    assert.equal((await store.getStagingMetadata(student, signed.objectId)).quarantine?.reasonCode, "OBJECT_MALWARE_DETECTED");
  });

  await t.test("scanner unavailable", async (t) => {
    const scanner: MalwareScannerPort = { async scan() { throw new Error("scanner offline"); } };
    const { store, filesystem } = await fixture(t, { scanner });
    const signed = await stage(store, filesystem, student, PNG, "image/png");
    await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_MALWARE_SCAN_FAILED");
    assert.equal((await store.getAuthorizedObject(student, signed.objectId))?.status, "QUARANTINED");
  });
});

test("JPEG uploads strip EXIF/GPS and a broken sanitizer fails closed", async (t) => {
  await t.test("strip metadata", async (t) => {
    let scans = 0;
    const scanner: MalwareScannerPort = {
      async scan() {
        scans += 1;
        return { status: "CLEAN", scanner: "test-boundary", scannerVersion: "1" };
      },
    };
    const { store, filesystem } = await fixture(t, { scanner });
    const jpeg = jpegWithGpsExif();
    assert.equal(hasJpegPrivacyMetadata(jpeg), true);
    const signed = await stage(store, filesystem, student, jpeg, "image/jpeg");
    const confirmed = await store.confirmUpload(student, signed.objectId, signed.uploadToken);
    const clean = await filesystem.getObject(confirmed.storageKey);
    assert.equal(hasJpegPrivacyMetadata(clean.bytes), false);
    assert.equal(new TextDecoder().decode(clean.bytes).includes("GPSIFD"), false);
    assert.equal((await store.getStagingMetadata(student, signed.objectId)).sanitization?.removedMetadata, true);
    assert.equal(scans, 2);
  });

  await t.test("fail closed boundary", async (t) => {
    const sanitizer: PrivateObjectSanitizerPort = {
      async sanitize(request) {
        return { bytes: request.bytes, sanitizer: "broken", sanitizerVersion: "1", removedMetadata: false };
      },
    };
    const { store, filesystem } = await fixture(t, { sanitizer });
    const signed = await stage(store, filesystem, student, jpegWithGpsExif(), "image/jpeg");
    await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_SANITIZATION_FAILED");
    assert.equal((await store.getAuthorizedObject(student, signed.objectId))?.status, "QUARANTINED");
  });
});

test("upload grants and confirmation tokens reject expiry and replay", async (t) => {
  const clock = new MutableClock();
  const { store, filesystem } = await fixture(t, { clock });
  const request = {
    documentId: "timeline_test",
    objectClass: "MEDIA" as const,
    mimeType: "image/png",
    byteSize: PNG.byteLength,
    sha256: sha256(PNG),
  };
  const signed = await store.signUpload(student, request);
  await filesystem.uploadSigned(signed.uploadUrl, PNG, signed.requiredHeaders);
  await assert.rejects(store.confirmUpload(student, signed.objectId, `${signed.uploadToken}tampered`), code("OBJECT_UPLOAD_TOKEN_INVALID"));
  await assert.rejects(filesystem.uploadSigned(signed.uploadUrl, PNG, signed.requiredHeaders), (error: { code?: string }) => error.code === "S3_GRANT_REPLAYED");
  await store.confirmUpload(student, signed.objectId, signed.uploadToken);

  const expired = await store.signUpload(student, request);
  clock.advance(120_001);
  await assert.rejects(filesystem.uploadSigned(expired.uploadUrl, PNG, expired.requiredHeaders), (error: { code?: string }) => error.code === "S3_GRANT_EXPIRED");
  await assert.rejects(store.confirmUpload(student, expired.objectId, expired.uploadToken), (error: { code?: string }) => error.code === "OBJECT_UPLOAD_EXPIRED");
});

test("download capabilities are private, tamper-evident, short-lived, and object/action bound", async (t) => {
  const clock = new MutableClock();
  const { store, filesystem } = await fixture(t, { clock });
  const signed = await stage(store, filesystem, student, PNG, "image/png");
  await store.confirmUpload(student, signed.objectId, signed.uploadToken);
  const download = await store.signDownload(student, signed.objectId);
  assert.match(download.downloadUrl, /^staging-object\+fs:\/\/download\/[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(download.downloadUrl, /^https?:/);

  const parsed = new URL(download.downloadUrl);
  const token = parsed.pathname.slice(1);
  const replacement = token.endsWith("A") ? "B" : "A";
  parsed.pathname = `/${token.slice(0, -1)}${replacement}`;
  await assert.rejects(filesystem.downloadSigned(parsed.toString()), code("S3_GRANT_INVALID"));
  await assert.rejects(filesystem.uploadSigned(download.downloadUrl, PNG, {}), code("S3_GRANT_INVALID"));

  clock.advance(60_001);
  await assert.rejects(filesystem.downloadSigned(download.downloadUrl), code("S3_GRANT_EXPIRED"));
});

test("audit events retain metadata only and pseudonymize PII-shaped actor and request identifiers", async (t) => {
  const { store, filesystem, audit } = await fixture(t);
  const piiShapedActor = context("STUDENT", "student@example.com", {
    requestId: "request_Jane_Doe_01-02-1990",
    sessionId: "session_secret_bearer_value",
  });
  const secretBytes = new TextEncoder().encode("private medical narrative");
  const signed = await stage(store, filesystem, piiShapedActor, secretBytes, "text/plain", {
    documentId: "timeline_private_subject",
  });
  await store.confirmUpload(piiShapedActor, signed.objectId, signed.uploadToken);
  const serialized = JSON.stringify(audit.events);
  assert.doesNotMatch(serialized, /student@example\.com|Jane_Doe|01-02-1990|session_secret|private medical narrative|timeline_private_subject/);
  assert.doesNotMatch(serialized, /staging-object\+fs:|upload.?token|download.?url|storage.?key/i);
  assert.ok(audit.events.every((event) => event.actorId === "ANONYMOUS" || /^[a-f0-9]{64}$/.test(event.actorId)));
  assert.ok(audit.events.every((event) => event.requestId === "ANONYMOUS" || /^[a-f0-9]{64}$/.test(event.requestId)));
});

test("idempotent upload issuance keeps one object, revokes old grants, and rejects conflicts", async (t) => {
  const { store, filesystem } = await fixture(t);
  const request = {
    documentId: "timeline_test",
    objectClass: "MEDIA" as const,
    mimeType: "image/png",
    byteSize: PNG.byteLength,
    sha256: sha256(PNG),
    idempotencyKey: "upload-request-0001",
  };
  const first = await store.signUpload(student, request);
  const second = await store.signUpload(student, request);
  assert.equal(second.objectId, first.objectId);
  await assert.rejects(filesystem.uploadSigned(first.uploadUrl, PNG, first.requiredHeaders), (error: { code?: string }) => error.code === "S3_GRANT_REVOKED");
  await filesystem.uploadSigned(second.uploadUrl, PNG, second.requiredHeaders);
  await store.confirmUpload(student, second.objectId, second.uploadToken);

  await assert.rejects(
    store.signUpload(student, { ...request, mimeType: "text/plain" }),
    (error: { code?: string }) => error.code === "OBJECT_IDEMPOTENCY_CONFLICT",
  );
});

test("temporary lifecycle cleanup is service-only and removes expired bytes", async (t) => {
  const clock = new MutableClock();
  const { store, filesystem, audit } = await fixture(t, {
    clock,
    lifecycleRules: {
      TEMP: { retentionClass: "temporary-test", pendingTtlMs: 500, confirmedTtlMs: 1_000, quarantineTtlMs: 500 },
    },
  });
  const signed = await stage(store, filesystem, student, PNG, "image/png", { objectClass: "TEMP" });
  await store.confirmUpload(student, signed.objectId, signed.uploadToken);
  assert.equal((await store.getStagingMetadata(student, signed.objectId)).lifecycle.deleteAfter, "2026-07-15T12:00:01.000Z");
  await assert.rejects(store.cleanupTemporaryObjects(student), (error: { code?: string }) => error.code === "SERVICE_ROLE_REQUIRED");
  clock.advance(1_001);
  const result = await store.cleanupTemporaryObjects(exportService);
  assert.deepEqual(result, { examined: 1, eligible: 1, deleted: 1, failed: 0 });
  assert.equal(await filesystem.objectCount(), 0);
  assert.ok(audit.events.some((event) => event.action === "TEMPORARY_CLEANUP" && event.outcome === "SUCCESS"));
});

class QuarantineSourceDeleteFailureClient implements S3CompatibleClientPort {
  private failedSourceDelete = false;

  constructor(private readonly delegate: S3CompatibleClientPort) {}

  presignUpload(request: PresignUploadRequest): Promise<SignedObjectGrant> { return this.delegate.presignUpload(request); }
  presignDownload(request: PresignDownloadRequest): Promise<SignedObjectGrant> { return this.delegate.presignDownload(request); }
  headObject(key: string): Promise<S3ObjectHead | null> { return this.delegate.headObject(key); }
  getObject(key: string): Promise<S3ObjectBody> { return this.delegate.getObject(key); }
  putObject(request: PutObjectRequest): Promise<S3ObjectHead> { return this.delegate.putObject(request); }
  revokeObjectGrants(key: string): Promise<void> { return this.delegate.revokeObjectGrants(key); }

  async deleteObject(request: DeleteObjectRequest): Promise<void> {
    if (!this.failedSourceDelete && request.key.includes("/objects/")) {
      this.failedSourceDelete = true;
      throw new S3CompatibleClientError("SOURCE_DELETE_FAILED", "injected quarantine source delete failure");
    }
    return this.delegate.deleteObject(request);
  }
}

test("quarantine tracks both physical copies when source deletion fails", async (t) => {
  const clock = new MutableClock();
  const filesystem = await DisposableFilesystemS3Client.create({ clock: clock.now });
  const client = new QuarantineSourceDeleteFailureClient(filesystem);
  const { store } = await fixture(t, { clock, filesystem, client });
  const signed = await stage(store, filesystem, student, PDF, "image/png");
  await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), code("OBJECT_MAGIC_MISMATCH"));
  assert.equal((await store.getStagingMetadata(student, signed.objectId)).quarantine?.persisted, true);
  assert.equal(await filesystem.objectCount(), 2);

  await store.deleteObject(student, signed.objectId);
  assert.equal(await filesystem.objectCount(), 0);
});

class RetryAfterWriteClient implements S3CompatibleClientPort {
  headAttempts = 0;
  confirmedWriteAttempts = 0;

  constructor(private readonly delegate: S3CompatibleClientPort) {}

  presignUpload(request: PresignUploadRequest): Promise<SignedObjectGrant> { return this.delegate.presignUpload(request); }
  presignDownload(request: PresignDownloadRequest): Promise<SignedObjectGrant> { return this.delegate.presignDownload(request); }
  getObject(key: string): Promise<S3ObjectBody> { return this.delegate.getObject(key); }
  deleteObject(request: DeleteObjectRequest): Promise<void> { return this.delegate.deleteObject(request); }
  revokeObjectGrants(key: string): Promise<void> { return this.delegate.revokeObjectGrants(key); }

  async headObject(key: string): Promise<S3ObjectHead | null> {
    this.headAttempts += 1;
    if (this.headAttempts === 1) throw new S3CompatibleClientError("TRANSIENT_HEAD", "temporary head failure", true);
    return this.delegate.headObject(key);
  }

  async putObject(request: PutObjectRequest): Promise<S3ObjectHead> {
    if (request.metadata.status !== "CONFIRMED") return this.delegate.putObject(request);
    this.confirmedWriteAttempts += 1;
    const result = await this.delegate.putObject(request);
    if (this.confirmedWriteAttempts === 1) throw new S3CompatibleClientError("RESPONSE_LOST", "write response was lost", true);
    return result;
  }
}

test("retry policy recovers transient reads and a lost idempotent write response", async (t) => {
  const clock = new MutableClock();
  const filesystem = await DisposableFilesystemS3Client.create({ clock: clock.now });
  const retryingClient = new RetryAfterWriteClient(filesystem);
  const { store, audit } = await fixture(t, {
    clock,
    filesystem,
    client: retryingClient,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 0 },
  });
  const signed = await stage(store, filesystem, student, PNG, "image/png");
  const [first, second] = await Promise.allSettled([
    store.confirmUpload(student, signed.objectId, signed.uploadToken),
    store.confirmUpload(student, signed.objectId, signed.uploadToken),
  ]);
  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  if (second.status === "rejected") assert.equal((second.reason as { code?: string }).code, "OBJECT_UPLOAD_REPLAYED");
  assert.equal(retryingClient.headAttempts, 2);
  assert.equal(retryingClient.confirmedWriteAttempts, 2);
  assert.ok(audit.events.some((event) => event.action === "UPLOAD_CONFIRMED" && event.outcome === "SUCCESS"));
});

test("service writes preserve requested ownership and are idempotent", async (t) => {
  const { store } = await fixture(t);
  const service = context("SERVICE", exportService.principalId);
  const request = {
    documentId: "timeline_test",
    ownerPrincipalId: student.principalId,
    objectClass: "EXPORT" as const,
    mimeType: "application/pdf",
    byteSize: PDF.byteLength,
    sha256: sha256(PDF),
    idempotencyKey: "service-export-0001",
  };
  const first = await store.putServiceObject(service, request, PDF);
  const repeated = await store.putServiceObject(service, request, PDF);
  assert.equal(first.id, repeated.id);
  assert.equal(first.ownerPrincipalId, student.principalId);
  assert.equal(first.status, "CONFIRMED");
});
