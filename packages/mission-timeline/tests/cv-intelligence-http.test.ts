import assert from "node:assert/strict";
import test from "node:test";

import { TimelineHttpApi } from "../src/api/http-api.js";
import { sha256 } from "../src/core/canonical.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryPrincipalDirectory, MatrixSessionExchange } from "../src/identity/matrix-identity.js";
import { CvIntelligenceService } from "../src/intelligence/cv-intelligence-service.js";
import type { CvIntelligenceProvider } from "../src/intelligence/cv-intelligence-provider.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { InMemoryTelemetrySink, PrivacySafeTelemetry } from "../src/telemetry/telemetry.js";
import { fixedClock, student } from "./fixtures.js";

function httpRequest(path: string, method = "GET", token?: string, payload?: unknown): Request {
  return new Request(`https://timeline.local${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(payload === undefined ? {} : { "content-type": "application/json" }),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

test("owner-authenticated CV route validates private SOURCE custody and returns evidence-bound analysis", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const directory = new InMemoryPrincipalDirectory();
  directory.register({ principalId: student.principalId, wpUserId: 42, role: "STUDENT", programIds: student.programIds, assignedDocumentIds: [], active: true });
  const identity = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const objectStore = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const provider: CvIntelligenceProvider = {
    descriptor: { provider: "test-ai", model: "test-model-1" },
    async analyze() {
      const excerpt = "2019 Dean's Award for Clinical Excellence";
      return {
        candidates: [{
          localId: "award_1", canonicalType: "AWARD_HONOR", categoryId: "education", timelineKind: "milestone",
          title: "Dean's Award for Clinical Excellence", organization: null, location: null, country: null, specialty: null,
          experienceType: null, startDate: "2019-01", endDate: null, datePrecision: "YEAR", openEnded: false,
          classificationReason: "The source explicitly identifies an award.",
          evidence: ["title", "startDate", "canonicalType", "categoryId"].map((field) => ({
            field: field as "title", sourceBlockIds: ["block_award"], excerpt, support: "EXPLICIT" as const,
            reason: "Explicit in source.", uncertainty: null,
          })),
          uncertainty: [], warnings: [],
        }],
        qualitySuggestions: [], unresolvedQuestions: [],
      };
    },
  };
  const api = new TimelineHttpApi(
    service,
    identity,
    objectStore,
    new PrivacySafeTelemetry(new InMemoryTelemetrySink(), "test", fixedClock),
    "test",
    false,
    new CvIntelligenceService({ provider, expectedConsentVersion: "d1-ux-007-ai-v1" }),
  );
  const exchange = await api.handle(httpRequest("/v1/session/exchange", "POST"), { wpUserId: 42, displayName: "Student", nonceVerified: true, sessionId: "matrix_session" });
  const { token } = await exchange.json();
  await api.handle(httpRequest("/v1/documents", "POST", token, { id: "timeline_cv_http", programId: student.programIds[0], title: "Timeline", document: { events: [] } }));

  const bytes = new TextEncoder().encode("private source fixture");
  const digest = sha256(bytes);
  const signedResponse = await api.handle(httpRequest("/v1/objects/sign", "POST", token, {
    documentId: "timeline_cv_http", objectClass: "SOURCE", mimeType: "application/pdf", byteSize: bytes.byteLength, sha256: digest,
  }));
  const signed = await signedResponse.json();
  await objectStore.acceptTestUpload(signed.objectId, signed.uploadToken, bytes, "application/pdf");
  await api.handle(httpRequest(`/v1/objects/${signed.objectId}/confirm`, "POST", token, { uploadToken: signed.uploadToken }));

  const payload = {
    source: { objectId: signed.objectId, sha256: digest, mimeType: "application/pdf" },
    blocks: [{ id: "block_award", pageNumber: 1, section: "Honors", text: "2019 Dean's Award for Clinical Excellence" }],
    documentType: "CV", existingEvents: [], consentVersion: "d1-ux-007-ai-v1", idempotencyKey: "cv-http-1",
  };
  const anonymous = await api.handle(httpRequest("/v1/documents/timeline_cv_http/intake/analyze", "POST", undefined, payload));
  assert.equal(anonymous.status, 401);
  const response = await api.handle(httpRequest("/v1/documents/timeline_cv_http/intake/analyze", "POST", token, payload));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, "SERVER_AI");
  assert.equal(body.candidates[0].canonicalType, "AWARD_HONOR");
  assert.equal(body.candidates[0].safeToBulkAccept, true);
});

test("owner-authenticated File Vault handoff stores one exact private SOURCE with integrity and provenance", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const directory = new InMemoryPrincipalDirectory();
  directory.register({ principalId: student.principalId, wpUserId: 42, role: "STUDENT", programIds: student.programIds, assignedDocumentIds: [], active: true });
  const identity = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const objectStore = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const api = new TimelineHttpApi(
    service,
    identity,
    objectStore,
    new PrivacySafeTelemetry(new InMemoryTelemetrySink(), "test", fixedClock),
    "test",
    false,
  );
  const exchange = await api.handle(httpRequest("/v1/session/exchange", "POST"), { wpUserId: 42, displayName: "Student", nonceVerified: true, sessionId: "matrix_session" });
  const { token } = await exchange.json();
  await api.handle(httpRequest("/v1/documents", "POST", token, { id: "timeline_filevault_http", programId: student.programIds[0], title: "Timeline", document: { events: [] } }));
  const bytes = new TextEncoder().encode("exact private File Vault CV bytes");
  const digest = sha256(bytes);
  const request = new Request("https://timeline.local/v1/documents/timeline_filevault_http/file-vault/ingestions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "content-length": String(bytes.byteLength),
      "x-content-sha256": digest,
      "x-file-vault-id": "11111111-1111-4111-8111-111111111111",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: bytes,
  });
  const response = await api.handle(request);
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.deepEqual(payload.provenance, {
    provider: "missionmed-filevault-v1",
    vaultFileId: "11111111-1111-4111-8111-111111111111",
    versionId: "22222222-2222-4222-8222-222222222222",
  });
  const stored = await objectStore.getAuthorizedObject(student, payload.source.objectId);
  assert.equal(stored?.ownerPrincipalId, student.principalId);
  assert.equal(stored?.objectClass, "SOURCE");
  assert.equal(stored?.expectedSha256, digest);

  const tampered = new Request("https://timeline.local/v1/documents/timeline_filevault_http/file-vault/ingestions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "content-length": String(bytes.byteLength),
      "x-content-sha256": "0".repeat(64),
      "x-file-vault-id": "11111111-1111-4111-8111-111111111111",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: bytes,
  });
  assert.equal((await api.handle(tampered)).status, 409);

  // The custody write must run under the real student, never a forged SERVICE principal:
  // SERVICE is the one role that waives owner checks and no RLS policy accepts it here.
  await assert.rejects(
    objectStore.putOwnedObject(
      { ...student, role: "SERVICE" },
      { documentId: "timeline_filevault_http", ownerPrincipalId: student.principalId, objectClass: "SOURCE", mimeType: "application/pdf", byteSize: bytes.byteLength, sha256: digest },
      bytes,
    ),
    (error: { code?: string }) => error.code === "OBJECT_OWNER_ROLE_REQUIRED",
  );

  const oversize = new Uint8Array(20 * 1024 * 1024 + 1);
  const tooLarge = new Request("https://timeline.local/v1/documents/timeline_filevault_http/file-vault/ingestions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "content-length": String(oversize.byteLength),
      "x-content-sha256": sha256(oversize),
      "x-file-vault-id": "11111111-1111-4111-8111-111111111111",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: oversize,
  });
  const tooLargeResponse = await api.handle(tooLarge);
  assert.equal(tooLargeResponse.status, 413);
  assert.equal((await tooLargeResponse.json()).error.code, "FILE_VAULT_INGEST_SIZE_DENIED");

  const deleted = await api.handle(httpRequest(`/v1/objects/${payload.source.objectId}`, "DELETE", token));
  assert.equal(deleted.status, 204);
  const released = await objectStore.getAuthorizedObject(student, payload.source.objectId);
  assert.equal(released?.status, "DELETED");
  assert.equal(released?.bytes, undefined);
  assert.equal((await api.handle(httpRequest(`/v1/objects/${payload.source.objectId}`, "DELETE", token))).status, 204);
});

test("File Vault ingestion and source deletion answer alike for a document that is not the student's", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const directory = new InMemoryPrincipalDirectory();
  directory.register({ principalId: student.principalId, wpUserId: 42, role: "STUDENT", programIds: student.programIds, assignedDocumentIds: [], active: true });
  directory.register({ principalId: "principal_other_student", wpUserId: 77, role: "STUDENT", programIds: student.programIds, assignedDocumentIds: [], active: true });
  const identity = new MatrixSessionExchange(directory, { verify: async () => true }, "0123456789abcdef0123456789abcdef", 600, fixedClock);
  const objectStore = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const api = new TimelineHttpApi(service, identity, objectStore, new PrivacySafeTelemetry(new InMemoryTelemetrySink(), "test", fixedClock), "test", false);
  const owner = (await (await api.handle(httpRequest("/v1/session/exchange", "POST", undefined), { wpUserId: 42, displayName: "Student", nonceVerified: true, sessionId: "matrix_session" })).json()).token;
  const intruder = (await (await api.handle(httpRequest("/v1/session/exchange", "POST", undefined), { wpUserId: 77, displayName: "Other", nonceVerified: true, sessionId: "matrix_session_2" })).json()).token;
  await api.handle(httpRequest("/v1/documents", "POST", owner, { id: "timeline_owned", programId: student.programIds[0], title: "Timeline", document: { events: [] } }));

  const bytes = new TextEncoder().encode("exact private File Vault CV bytes");
  const ingest = (token: string, documentId: string) => new Request(`https://timeline.local/v1/documents/${documentId}/file-vault/ingestions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/pdf",
      "content-length": String(bytes.byteLength),
      "x-content-sha256": sha256(bytes),
      "x-file-vault-id": "11111111-1111-4111-8111-111111111111",
      "x-file-vault-version": "22222222-2222-4222-8222-222222222222",
    },
    body: bytes,
  });
  const crossOwner = await api.handle(ingest(intruder, "timeline_owned"));
  const absent = await api.handle(ingest(intruder, "timeline_never_created"));
  assert.equal(crossOwner.status, 404);
  assert.deepEqual(await crossOwner.json(), await absent.json());
  assert.equal(absent.status, 404);

  const objectId = (await (await api.handle(ingest(owner, "timeline_owned"))).json()).source.objectId;
  const crossDelete = await api.handle(httpRequest(`/v1/objects/${objectId}`, "DELETE", intruder));
  const absentDelete = await api.handle(httpRequest("/v1/objects/object_never_created", "DELETE", intruder));
  assert.equal(crossDelete.status, 404);
  assert.equal(absentDelete.status, 404);
  assert.deepEqual(await crossDelete.json(), await absentDelete.json());
  assert.equal((await objectStore.getAuthorizedObject(student, objectId))?.status, "CONFIRMED");
});
