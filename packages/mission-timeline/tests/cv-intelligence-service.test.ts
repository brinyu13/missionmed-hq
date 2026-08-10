import assert from "node:assert/strict";
import test from "node:test";

import type { ObjectRecord } from "../src/contracts/types.js";
import { sha256 } from "../src/core/canonical.js";
import { CvIntelligenceService } from "../src/intelligence/cv-intelligence-service.js";
import type { CvIntelligenceProvider } from "../src/intelligence/cv-intelligence-provider.js";
import type { CvIntelligenceRequest, CvProviderResult } from "../src/intelligence/cv-intelligence-schema.js";
import { document, otherStudent, student } from "./fixtures.js";

const sourceBytes = new TextEncoder().encode("fixture CV");
const sourceHash = sha256(sourceBytes);
const sourceObject: ObjectRecord = {
  id: "object_cv_source",
  ownerPrincipalId: student.principalId,
  documentId: "timeline_test",
  objectClass: "SOURCE",
  storageKey: "opaque",
  mimeType: "application/pdf",
  expectedBytes: sourceBytes.byteLength,
  expectedSha256: sourceHash,
  status: "CONFIRMED",
  createdAt: "2026-08-10T12:00:00.000Z",
  confirmedAt: "2026-08-10T12:00:00.000Z",
};

function request(overrides: Partial<CvIntelligenceRequest> = {}): CvIntelligenceRequest {
  return {
    source: { objectId: sourceObject.id, sha256: sourceHash, mimeType: "application/pdf" },
    blocks: [{ id: "block_education", pageNumber: 1, section: "Education", text: "2014-2018 Bachelor of Science in Biology, Meridian University" }],
    documentType: "CV",
    existingEvents: [],
    consentVersion: "d1-ux-007-ai-v1",
    idempotencyKey: "cv-analysis-test-1",
    ...overrides,
  };
}

function result(overrides: Partial<CvProviderResult["candidates"][number]> = {}): CvProviderResult {
  const excerpt = "2014-2018 Bachelor of Science in Biology, Meridian University";
  return {
    candidates: [{
      localId: "education_1",
      canonicalType: "EDUCATION",
      categoryId: "education",
      timelineKind: "duration",
      title: "Bachelor of Science in Biology",
      organization: "Meridian University",
      location: null,
      country: null,
      specialty: null,
      experienceType: null,
      startDate: "2014-01",
      endDate: "2018-12",
      datePrecision: "YEAR",
      openEnded: false,
      classificationReason: "The source explicitly describes undergraduate education.",
      evidence: ["title", "organization", "startDate", "endDate", "canonicalType", "categoryId"].map((field) => ({
        field: field as "title",
        sourceBlockIds: ["block_education"],
        excerpt,
        support: "EXPLICIT" as const,
        reason: "The field is stated in the source block.",
        uncertainty: null,
      })),
      uncertainty: [],
      warnings: [],
      ...overrides,
    }],
    qualitySuggestions: [],
    unresolvedQuestions: [],
  };
}

function provider(output: CvProviderResult): CvIntelligenceProvider {
  return {
    descriptor: { provider: "test-ai", model: "test-model-1" },
    async analyze() { return structuredClone(output); },
  };
}

test("server CV intelligence binds fields to source evidence and permits only evidence-safe bulk acceptance", async () => {
  const service = new CvIntelligenceService({ provider: provider(result()), expectedConsentVersion: "d1-ux-007-ai-v1" });
  const response = await service.analyze(student, document(), sourceObject, request());
  assert.equal(response.status, "COMPLETE");
  assert.equal(response.mode, "SERVER_AI");
  assert.equal(response.provider, "test-ai");
  assert.equal(response.candidates.length, 1);
  assert.equal(response.candidates[0]!.categoryId, "education");
  assert.equal(response.candidates[0]!.safeToBulkAccept, true);
  assert.equal(response.candidates[0]!.confidence.level, "HIGH");
  assert.equal(response.sourceSha256, sourceHash);
  assert.doesNotMatch(JSON.stringify(response), /fixture CV/);
});

test("taxonomy guard prevents an award from remaining in Work", async () => {
  const excerpt = "2019 Dean's Award for Clinical Excellence";
  const awardResult = result({
    canonicalType: "AWARD_HONOR",
    categoryId: "work",
    title: "Dean's Award for Clinical Excellence",
    organization: null,
    startDate: "2019-01",
    endDate: null,
  });
  for (const evidence of awardResult.candidates[0]!.evidence) evidence.excerpt = excerpt;
  const service = new CvIntelligenceService({ provider: provider(awardResult), expectedConsentVersion: "d1-ux-007-ai-v1" });
  const response = await service.analyze(student, document(), sourceObject, request({
    blocks: [{ id: "block_education", pageNumber: 1, section: "Honors", text: excerpt }],
  }));
  assert.equal(response.candidates[0]!.categoryId, "education");
  assert.equal(response.candidates[0]!.safeToBulkAccept, false);
  assert.ok(response.candidates[0]!.warnings.some((warning) => /corrected from work to education/i.test(warning)));
});

test("unconfigured or unavailable AI fails soft without fabricating candidates", async () => {
  const service = new CvIntelligenceService();
  const response = await service.analyze(student, document(), sourceObject, request());
  assert.equal(response.status, "LIMITED_FALLBACK_REQUIRED");
  assert.equal(response.mode, "LOCAL_LIMITED");
  assert.equal(response.fallbackReason, "UNCONFIGURED");
  assert.deepEqual(response.candidates, []);
  assert.match(response.unresolvedQuestions[0]!, /limited local parser/i);
});

test("AI analysis enforces owner, object binding, integrity, and consent before provider invocation", async () => {
  let calls = 0;
  const counted: CvIntelligenceProvider = {
    descriptor: { provider: "test-ai", model: "test-model-1" },
    async analyze() { calls += 1; return result(); },
  };
  const service = new CvIntelligenceService({ provider: counted, expectedConsentVersion: "d1-ux-007-ai-v1" });
  await assert.rejects(service.analyze(otherStudent, document(), sourceObject, request()), (error: { code?: string }) => error.code === "CV_ANALYSIS_OWNER_REQUIRED");
  await assert.rejects(service.analyze(student, document(), { ...sourceObject, documentId: "timeline_other" }, request()), (error: { code?: string }) => error.code === "CV_SOURCE_ACCESS_DENIED");
  await assert.rejects(service.analyze(student, document(), sourceObject, request({ source: { ...request().source, sha256: "f".repeat(64) } })), (error: { code?: string }) => error.code === "CV_SOURCE_INTEGRITY_MISMATCH");
  await assert.rejects(service.analyze(student, document(), sourceObject, request({ consentVersion: "old" })), (error: { code?: string }) => error.code === "CV_AI_CONSENT_REQUIRED");
  assert.equal(calls, 0);
});

test("unsupported excerpts are rejected rather than promoted into the Timeline", async () => {
  const unsupported = result();
  unsupported.candidates[0]!.evidence[0]!.excerpt = "Fabricated credential not found in source";
  const service = new CvIntelligenceService({ provider: provider(unsupported), expectedConsentVersion: "d1-ux-007-ai-v1" });
  const response = await service.analyze(student, document(), sourceObject, request());
  assert.equal(response.candidates.length, 0);
  assert.equal(response.rejectedCandidateCount, 1);
});
