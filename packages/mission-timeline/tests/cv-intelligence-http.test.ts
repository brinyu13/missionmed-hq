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
