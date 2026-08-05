import assert from "node:assert/strict";
import test from "node:test";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { ObjectRecord, PrincipalContext } from "../src/contracts/types.js";
import { sha256 } from "../src/core/canonical.js";
import { TimelineError } from "../src/core/errors.js";
import {
  R2PrivateObjectStore,
  readR2Environment,
  type ProductionMediaRepository,
} from "../src/storage/production/index.js";

const TOKEN_SECRET = "rc1-r2-unit-token-secret-000000000000000000000000";
const PDF = new TextEncoder().encode("%PDF-1.7\nprivate timeline fixture\n%%EOF");

function context(principalId: string, role: PrincipalContext["role"] = "STUDENT"): PrincipalContext {
  return {
    principalId,
    role,
    programIds: ["missionmed-360"],
    assignedDocumentIds: [],
    facultyGrants: [],
    serviceScopes: role === "SERVICE" ? ["artifact:create"] : [],
    sessionId: `session-${principalId}`,
    requestId: `request-${principalId}`,
  };
}

function hasCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof TimelineError && error.code === code;
}

class MutableClock {
  private value = new Date("2026-08-05T12:00:00.000Z");

  readonly now = () => new Date(this.value);

  advance(milliseconds: number): void {
    this.value = new Date(this.value.getTime() + milliseconds);
  }
}

class MemoryMediaRepository implements ProductionMediaRepository {
  readonly records = new Map<string, ObjectRecord>();

  async insertPending(contextValue: PrincipalContext, record: ObjectRecord): Promise<ObjectRecord> {
    if (contextValue.role === "STUDENT" && record.ownerPrincipalId !== contextValue.principalId) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
    }
    this.records.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async getAuthorized(contextValue: PrincipalContext, objectId: string): Promise<ObjectRecord | null> {
    const record = this.records.get(objectId);
    if (!record) return null;
    if (contextValue.role !== "SERVICE" && record.ownerPrincipalId !== contextValue.principalId) return null;
    return structuredClone(record);
  }

  async transition(
    contextValue: PrincipalContext,
    objectId: string,
    expectedStatus: ObjectRecord["status"],
    nextStatus: ObjectRecord["status"],
    changedAt: string,
  ): Promise<ObjectRecord | null> {
    const record = await this.getAuthorized(contextValue, objectId);
    if (!record || record.status !== expectedStatus) return null;
    record.status = nextStatus;
    if (nextStatus === "CONFIRMED") record.confirmedAt = changedAt;
    this.records.set(objectId, structuredClone(record));
    return structuredClone(record);
  }
}

interface FakeHead {
  ContentLength: number;
  ContentType: string;
  ChecksumSHA256: string;
  Metadata: Record<string, string>;
}

class FakeR2 {
  readonly heads = new Map<string, FakeHead>();
  readonly commands: object[] = [];
  readonly client = {
    send: async (command: object) => {
      this.commands.push(command);
      if (command instanceof HeadObjectCommand) {
        const key = String(command.input.Key);
        const head = this.heads.get(key);
        if (!head) throw Object.assign(new Error("not found"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
        return structuredClone(head);
      }
      if (command instanceof PutObjectCommand) {
        const input = command.input;
        if (input.Body) {
          this.heads.set(String(input.Key), {
            ContentLength: Number(input.ContentLength),
            ContentType: String(input.ContentType),
            ChecksumSHA256: String(input.ChecksumSHA256),
            Metadata: { ...(input.Metadata ?? {}) },
          });
        }
        return { ETag: "private-fixture" };
      }
      if (command instanceof DeleteObjectCommand) {
        this.heads.delete(String(command.input.Key));
        return {};
      }
      throw new Error("UNEXPECTED_R2_COMMAND");
    },
  } as unknown as S3Client;

  accept(record: ObjectRecord, overrides: Partial<FakeHead> = {}): void {
    this.heads.set(record.storageKey, {
      ContentLength: record.expectedBytes,
      ContentType: record.mimeType,
      ChecksumSHA256: Buffer.from(record.expectedSha256, "hex").toString("base64"),
      Metadata: {
        "object-id": record.id,
        "expected-sha256": record.expectedSha256,
        "object-class": record.objectClass,
      },
      ...overrides,
    });
  }
}

function fixture(clock = new MutableClock()) {
  const repository = new MemoryMediaRepository();
  const r2 = new FakeR2();
  const signedCommands: Array<PutObjectCommand | GetObjectCommand> = [];
  const signedOptions: Array<{
    expiresIn: number;
    signableHeaders?: Set<string>;
    unhoistableHeaders?: Set<string>;
  }> = [];
  const store = new R2PrivateObjectStore({
    client: r2.client,
    repository,
    bucket: "missionmed-timeline-private-test",
    environment: "test",
    tokenSecret: TOKEN_SECRET,
    signedUrlSeconds: 60,
    maxUploadBytes: 16 * 1024 * 1024,
    clock: clock.now,
    presign: async (_client, command, options) => {
      signedCommands.push(command);
      signedOptions.push(options);
      return `https://private-signed.invalid/grant?ttl=${options.expiresIn}`;
    },
  });
  return { store, repository, r2, signedCommands, signedOptions, clock };
}

function uploadRequest() {
  return {
    documentId: "timeline_test_document",
    objectClass: "MEDIA" as const,
    mimeType: "application/pdf",
    byteSize: PDF.byteLength,
    sha256: sha256(PDF),
  };
}

test("R2 configuration is all-or-none, private-endpoint only, and region auto", () => {
  assert.equal(readR2Environment({}), null);
  assert.throws(
    () => readR2Environment({ TIMELINE_MEDIA_S3_BUCKET: "partial" }),
    /TIMELINE_MEDIA_STORAGE_CONFIGURATION_INCOMPLETE/,
  );
  const env = {
    TIMELINE_MEDIA_S3_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    TIMELINE_MEDIA_S3_REGION: "auto",
    TIMELINE_MEDIA_S3_BUCKET: "missionmed-timeline-private",
    TIMELINE_MEDIA_S3_ACCESS_KEY_ID: "redacted-access-key",
    TIMELINE_MEDIA_S3_SECRET_ACCESS_KEY: "redacted-secret-key",
    TIMELINE_MEDIA_SIGNED_URL_TTL_SECONDS: "120",
    TIMELINE_MEDIA_MAX_UPLOAD_BYTES: String(15 * 1024 * 1024),
  };
  const config = readR2Environment(env)!;
  assert.equal(config.region, "auto");
  assert.equal(config.bucket, "missionmed-timeline-private");
  assert.throws(
    () => readR2Environment({ ...env, TIMELINE_MEDIA_S3_ENDPOINT: "https://public.example.com" }),
    /TIMELINE_MEDIA_S3_ENDPOINT_INVALID/,
  );
  assert.throws(
    () => readR2Environment({ ...env, TIMELINE_MEDIA_S3_ENDPOINT: "not-a-url" }),
    /TIMELINE_MEDIA_S3_ENDPOINT_INVALID/,
  );
  assert.throws(
    () => readR2Environment({ ...env, TIMELINE_MEDIA_S3_REGION: "us-east-1" }),
    /TIMELINE_MEDIA_S3_REGION_MUST_BE_AUTO/,
  );
});

test("private signed PUT, custody confirmation, signed GET, and delete are owner scoped", async () => {
  const { store, repository, r2, signedCommands, signedOptions } = fixture();
  const student = context("principal-student-a");
  const signed = await store.signUpload(student, uploadRequest());
  const pending = repository.records.get(signed.objectId)!;

  assert.match(signed.uploadUrl, /^https:\/\/private-signed\.invalid\//);
  assert.match(
    pending.storageKey,
    /^timeline\/private\/test\/users\/[a-f0-9]{32}\/documents\/[a-f0-9]{32}\/media\/[a-f0-9]{32}\/[a-f0-9]{64}$/,
  );
  assert.doesNotMatch(pending.storageKey, /principal-student-a|timeline_test_document/);
  assert.equal(signed.requiredHeaders["x-amz-checksum-sha256"], Buffer.from(uploadRequest().sha256, "hex").toString("base64"));
  assert.ok(signedCommands[0] instanceof PutObjectCommand);
  assert.deepEqual([...signedOptions[0]!.signableHeaders!], ["content-type"]);
  assert.deepEqual([...signedOptions[0]!.unhoistableHeaders!], [
    "x-amz-checksum-sha256",
    "x-amz-meta-object-id",
    "x-amz-meta-expected-sha256",
    "x-amz-meta-object-class",
  ]);

  r2.accept(pending);
  const confirmed = await store.confirmUpload(student, signed.objectId, signed.uploadToken);
  assert.equal(confirmed.status, "CONFIRMED");
  await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), hasCode("OBJECT_UPLOAD_NOT_PENDING"));
  await assert.rejects(store.signDownload(context("principal-student-b"), signed.objectId), hasCode("OBJECT_NOT_FOUND"));

  const download = await store.signDownload(student, signed.objectId);
  assert.match(download.downloadUrl, /^https:\/\/private-signed\.invalid\//);
  assert.ok(signedCommands.at(-1) instanceof GetObjectCommand);
  await store.deleteObject(student, signed.objectId);
  assert.equal(repository.records.get(signed.objectId)?.status, "DELETED");
  assert.equal(r2.heads.has(pending.storageKey), false);
});

test("Founder and approved-administrator documents use the same private owner-scoped media path", async () => {
  const { store, repository, r2 } = fixture();
  const administrator = context("principal-admin", "PROGRAM_ADMIN");
  const signed = await store.signUpload(administrator, {
    ...uploadRequest(),
    mimeType: "image/gif",
  });
  const pending = repository.records.get(signed.objectId)!;
  r2.accept(pending);
  assert.equal((await store.confirmUpload(administrator, signed.objectId, signed.uploadToken)).status, "CONFIRMED");
  assert.match((await store.signDownload(administrator, signed.objectId)).downloadUrl, /^https:\/\/private-signed\.invalid\//);
  await store.deleteObject(administrator, signed.objectId);
  assert.equal(repository.records.get(signed.objectId)?.status, "DELETED");
});

test("confirmation token expiry and R2 integrity mismatches fail closed", async () => {
  const clock = new MutableClock();
  const { store, repository, r2 } = fixture(clock);
  const student = context("principal-student-a");
  const expired = await store.signUpload(student, uploadRequest());
  r2.accept(repository.records.get(expired.objectId)!);
  clock.advance(60_001);
  await assert.rejects(store.confirmUpload(student, expired.objectId, expired.uploadToken), hasCode("OBJECT_UPLOAD_EXPIRED"));

  const mismatched = await store.signUpload(student, uploadRequest());
  const pending = repository.records.get(mismatched.objectId)!;
  r2.accept(pending, { ContentLength: pending.expectedBytes + 1 });
  await assert.rejects(store.confirmUpload(student, mismatched.objectId, mismatched.uploadToken), hasCode("OBJECT_SIZE_MISMATCH"));
  assert.equal(repository.records.get(mismatched.objectId)?.status, "QUARANTINED");
});

test("MIME, size, checksum, role, and service bytes are validated before custody confirmation", async () => {
  const { store, repository } = fixture();
  const student = context("principal-student-a");
  await assert.rejects(store.signUpload(student, { ...uploadRequest(), mimeType: "image/svg+xml" }), hasCode("OBJECT_MIME_DENIED"));
  await assert.rejects(store.signUpload(student, { ...uploadRequest(), byteSize: 17 * 1024 * 1024 }), hasCode("OBJECT_SIZE_DENIED"));
  await assert.rejects(store.signUpload(student, { ...uploadRequest(), sha256: "not-a-checksum" }), hasCode("OBJECT_HASH_INVALID"));
  await assert.rejects(store.signUpload(context("advisor", "ADVISOR"), uploadRequest()), hasCode("OBJECT_UPLOAD_ROLE_DENIED"));

  const service = context("timeline-export-service", "SERVICE");
  await assert.rejects(
    store.putServiceObject(service, { ...uploadRequest(), ownerPrincipalId: student.principalId }, new Uint8Array([1, 2, 3])),
    hasCode("OBJECT_SERVICE_BYTES_INVALID"),
  );
  const stored = await store.putServiceObject(
    service,
    { ...uploadRequest(), ownerPrincipalId: student.principalId },
    PDF,
  );
  assert.equal(stored.ownerPrincipalId, student.principalId);
  assert.equal(stored.status, "CONFIRMED");
  assert.equal(repository.records.get(stored.id)?.status, "CONFIRMED");
});
