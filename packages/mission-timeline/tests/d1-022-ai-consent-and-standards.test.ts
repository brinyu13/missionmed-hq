import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { authorizeTimelineAi, timelineAiProcessingMode } from "../src/intelligence/timeline-ai-authorization.js";
import { TimelineAiWorkflowService } from "../src/intelligence/timeline-ai-workflow-service.js";
import { OpenAiTimelineWorkflowProvider } from "../src/intelligence/openai-timeline-ai-workflows.js";
import { CvIntelligenceService } from "../src/intelligence/cv-intelligence-service.js";
import { OpenAiCvIntelligenceProvider } from "../src/intelligence/openai-cv-intelligence.js";
import { emptyFounderStandardRetrieval, founderStandardProvenance, PostgresFounderStandardRegistry, type FounderStandardRetriever } from "../src/intelligence/founder-standard-registry.js";
import { WordPressTimelineJwtVerifier } from "../src/identity/wordpress-timeline-jwt.js";
import { sha256 } from "../src/core/canonical.js";
import { TimelineError } from "../src/core/errors.js";
import { syntheticCvPdf } from "./support/synthetic-cv-files.js";
import { student, document } from "./fixtures.js";
import type { PrincipalContext } from "../src/contracts/types.js";

const consentVersion = "d1-022-ai-v1";
const consentedStudent: PrincipalContext = { ...student, hasLearndash3893Access: true, aiConsent: { version: consentVersion, consentedAt: "2026-09-01T10:00:00.000Z", source: "WORDPRESS_VERIFIED" } };
const options = { processingMode: "consented_students" as const, expectedConsentVersion: consentVersion, syntheticPrincipalIds: new Set<string>(), syntheticFixture: false };

test("022 real AI requires verified separate consent, live entitlement and configured mode", () => {
  assert.equal(authorizeTimelineAi(consentedStudent, options).allowed, true);
  for (const context of [
    { ...consentedStudent, aiConsent: undefined },
    { ...consentedStudent, hasLearndash3893Access: false },
    { ...consentedStudent, aiConsent: { ...consentedStudent.aiConsent!, version: "old" } },
    { ...consentedStudent, aiConsent: { ...consentedStudent.aiConsent!, consentedAt: "2099-01-01T00:00:00Z" } },
    { ...consentedStudent, role: "PROGRAM_ADMIN" as const },
    { ...consentedStudent, aiConsent: { ...consentedStudent.aiConsent!, source: "CLIENT_FLAG" } } as unknown as PrincipalContext,
  ]) assert.equal(authorizeTimelineAi(context, options).allowed, false);
  assert.equal(authorizeTimelineAi(consentedStudent, { ...options, processingMode: "synthetic_only" }).allowed, false);
  assert.equal(authorizeTimelineAi(consentedStudent, { ...options, expectedConsentVersion: "" }).allowed, false);
  assert.throws(() => timelineAiProcessingMode("automatic"), /MODE_INVALID/);
});

test("022 a forged synthetic marker never bypasses consent or an exact principal allowlist", () => {
  assert.equal(authorizeTimelineAi(consentedStudent, { ...options, syntheticFixture: true }).allowed, false);
  assert.equal(authorizeTimelineAi(student, { ...options, syntheticFixture: true, syntheticPrincipalIds: new Set([student.principalId]) }).allowed, true);
  assert.equal(authorizeTimelineAi(student, { ...options, syntheticFixture: false, syntheticPrincipalIds: new Set([student.principalId]) }).allowed, false);
});

const registry: FounderStandardRetriever = { async retrieve() { return { ...emptyFounderStandardRetrieval(), standards: [{ standardId: "timeline-no-invention", version: 2, kind: "INTERVIEW_READINESS", title: "Retain the source", guidance: "Ask about ambiguity instead of inventing dates.", applicability: { workflows: ["CV", "GUARDIAN", "RESCUE"], categoryIds: [] }, dataClass: "NONPERSONAL", contentSha256: "a".repeat(64), sourceRef: "D1-022-test-only", sourceSha256: "b".repeat(64), approvalRef: "TEST-APPROVAL", approvalDecisionId: "test-decision" }] }; } };

test("022 consented Guardian and Rescue use actual transport receipts and retrieved standards, never document-authored approval", async () => {
  const captured: Record<string, unknown>[] = [];
  const provider = new OpenAiTimelineWorkflowProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init?.body)); captured.push(payload);
    const rescue = payload.text.format.name.includes("rescue");
    return new Response(JSON.stringify({ id: `resp_test_${captured.length}`, model: "test-actual-model", output_text: JSON.stringify(rescue ? { observations: [], unresolvedQuestions: [] } : { findings: [], unresolvedQuestions: [] }) }), { status: 200, headers: { "x-request-id": `request-test-${captured.length}` } });
  } });
  const service = new TimelineAiWorkflowService(provider, [], [], { ...options, founderStandards: registry });
  const doc = document(); doc.founderStandards = { approvalRef: "FORGED_DOCUMENT_APPROVAL" };
  const quality = await service.analyzeQuality(consentedStudent, doc);
  const rescue = await service.observeRescue(consentedStudent, doc, { artifactSha256: "c".repeat(64), format: "PPTX", pageOrSlideCount: 1, objects: [] });
  assert.equal(quality.status, "COMPLETE"); assert.equal(rescue.status, "COMPLETE");
  assert.equal(quality.providerReceipt?.responseId, "resp_test_1"); assert.equal(rescue.providerReceipt?.responseId, "resp_test_2");
  assert.equal(quality.providerReceipt?.store, false);
  assert.equal(quality.founderStandardProvenance?.standards[0]?.approvalRef, "TEST-APPROVAL");
  assert.equal(rescue.founderStandardProvenance?.standards[0]?.version, 2);
  assert.doesNotMatch(JSON.stringify(captured), /FORGED_DOCUMENT_APPROVAL|test-private-key/);
  assert.match(JSON.stringify(captured), /Ask about ambiguity/);
  assert.ok(captured.every((item) => item.store === false));
});

test("022 no consent means no Guardian or Rescue provider call", async () => {
  let calls = 0;
  const provider = new OpenAiTimelineWorkflowProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl: async () => { calls++; throw new Error("should not run"); } });
  const service = new TimelineAiWorkflowService(provider, [], [], { ...options, founderStandards: registry });
  await assert.rejects(service.analyzeQuality(student, document()), { code: "TIMELINE_AI_CONSENT_REQUIRED" });
  await assert.rejects(service.observeRescue(student, document(), { artifactSha256: "c".repeat(64), format: "PPTX", pageOrSlideCount: 1, objects: [] }), { code: "TIMELINE_AI_CONSENT_REQUIRED" });
  assert.equal(calls, 0);
});

test("022 missing real provider receipt cannot become completed student AI review", async () => {
  const provider = new OpenAiTimelineWorkflowProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify({ findings: [], unresolvedQuestions: [] }) }), { status: 200 }) });
  const service = new TimelineAiWorkflowService(provider, [], [], options);
  const result = await service.analyzeQuality(consentedStudent, document());
  assert.equal(result.status, "AI_UNAVAILABLE"); assert.equal(result.providerReceipt, undefined); assert.deepEqual(result.findings, []);
});

test("022 CV consent uses server claim, exact stored source and approved retrieval", async () => {
  const bytes = syntheticCvPdf(["Research Fellow, Example Institute, January 2024 - December 2024"]); const hash = sha256(bytes);
  const source = { record: { id: "source-test", ownerPrincipalId: student.principalId, documentId: "timeline_test", objectClass: "SOURCE" as const, status: "CONFIRMED" as const, storageKey: "opaque", mimeType: "application/pdf", expectedBytes: bytes.length, expectedSha256: hash, createdAt: "2026-09-01T00:00:00Z", confirmedAt: "2026-09-01T00:00:00Z" }, bytes };
  let calls = 0; let sent = "";
  const provider = new OpenAiCvIntelligenceProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl: async (_url, init) => { calls++; sent = String(init?.body); return new Response(JSON.stringify({ id: "resp_cv_022", model: "test-model", output_text: JSON.stringify({ candidates: [], qualitySuggestions: [], unresolvedQuestions: [] }) }), { status: 200 }); } });
  const service = new CvIntelligenceService({ provider, expectedConsentVersion: consentVersion, processingMode: "consented_students", founderStandards: registry });
  const request = { source: { objectId: "source-test", sha256: hash, mimeType: "application/pdf" }, blocks: [{ id: "spoof", pageNumber: 1, section: null, text: "UNTRUSTED_CLIENT_TEXT" }], documentType: "CV", existingEvents: [], consentVersion, idempotencyKey: "d1-022-cv-test" };
  await assert.rejects(service.analyze(student, document(), source, request), { code: "CV_AI_CONSENT_REQUIRED" }); assert.equal(calls, 0);
  const response = await service.analyze(consentedStudent, document(), source, request);
  assert.equal(response.mode, "SERVER_AI"); assert.equal(response.providerReceipt?.responseId, "resp_cv_022");
  assert.equal(response.founderStandardProvenance?.standards[0]?.version, 2);
  assert.doesNotMatch(sent, /UNTRUSTED_CLIENT_TEXT/); assert.match(sent, /Research Fellow/);
});

test("022 Founder manager authority and private example rejection occur before SQL", async () => {
  let calls = 0;
  const store = new PostgresFounderStandardRegistry({ async connect() { calls++; throw new Error("must not query"); }, async query() { throw new Error("must not query"); } });
  await assert.rejects(store.listForManagement(consentedStudent), { code: "FOUNDER_STANDARD_MANAGER_REQUIRED" });
  const manager: PrincipalContext = { ...student, role: "PROGRAM_ADMIN", isWordpressAdministrator: true, founderStandardsManager: true };
  await assert.rejects(store.createRevision(manager, { standardId: "example-rule", baseVersion: 0, kind: "GOOD_EXAMPLE", title: "Example", guidance: "Private student prose", applicability: { workflows: ["CV"], categoryIds: [] }, provenance: { sourceRef: "example", sourceSha256: "a".repeat(64), dataClass: "PRIVATE" } }), { code: "FOUNDER_STANDARD_PRIVATE_CONTENT_DENIED" });
  assert.equal(calls, 0);
  assert.deepEqual(founderStandardProvenance(emptyFounderStandardRetrieval()).standards, []);
});

test("022 verified JWT grants consent and admin subjects only through exact signed capabilities", async () => {
  const now = new Date("2026-09-06T12:00:00.000Z"); const principalId = "e8e84330-025c-5c28-8d91-ef9a20fd74b1"; const secret = new TextEncoder().encode("d1-022-test-secret-32-characters-long");
  const verifier = new WordPressTimelineJwtVerifier({ issuer: "https://example.test/timeline/", secretsByKeyId: new Map([["test", secret]]), clock: () => now, principalDirectory: { async resolve(id, wpUserId, role) { return { principalId: id, wpUserId, role, active: true, programIds: [], assignedDocumentIds: [], resourceGrants: [] }; } } });
  const token = (extra: Record<string, unknown>) => new SignJWT({ wp_user_id: 101, timeline_role: "STUDENT", timeline_eligible: true, course_id: 3893, has_learndash_3893_access: true, is_wordpress_administrator: false, ...extra }).setProtectedHeader({ alg: "HS256", typ: "JWT", kid: "test" }).setIssuer("https://example.test/timeline/").setAudience("mission-timeline").setSubject(principalId).setIssuedAt(now.getTime()/1000).setNotBefore(now.getTime()/1000).setExpirationTime(now.getTime()/1000+120).setJti("38d0789b-2b29-4cb3-96d8-5b4db865644b").sign(secret);
  const verified = await verifier.verify(await token({ timeline_ai_consent: true, timeline_ai_consent_version: consentVersion, timeline_ai_consented_at: "2026-09-01T10:00:00Z", timeline_admin_workspace: true, timeline_founder_standards_manager: true }), "test-request");
  assert.equal(verified.aiConsent?.source, "WORDPRESS_VERIFIED"); assert.equal(verified.adminWorkspace, false); assert.equal(verified.founderStandardsManager, false);
  const malformed = await verifier.verify(await token({ timeline_ai_consent: "true", timeline_ai_consent_version: consentVersion, timeline_ai_consented_at: "2026-09-01T10:00:00Z" }), "test-request"); assert.equal(malformed.aiConsent, undefined);
  const admin = await verifier.verify(await token({ timeline_role: "PROGRAM_ADMIN", is_wordpress_administrator: true, timeline_admin_workspace: true, timeline_founder_standards_manager: true, timeline_admin_subject_principal_id: principalId, timeline_admin_subject_wp_user_id: 202 }), "test-request");
  assert.equal(admin.founderStandardsManager, true); assert.equal(admin.adminWorkspace, true); assert.equal(admin.adminSubjectPrincipalId, principalId); assert.equal(admin.adminSubjectWpUserId, 202); assert.equal(admin.aiConsent, undefined);
});


test("022 unavailable or unverifiable standards preserve rules degradation and never send content to a provider", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error("provider must not be contacted"); };
  const failingRegistry: FounderStandardRetriever = { async retrieve() { throw new TimelineError("FOUNDER_STANDARD_INTEGRITY_FAILED", "Synthetic integrity failure", 503); } };
  const workflow = new TimelineAiWorkflowService(new OpenAiTimelineWorkflowProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl }), [], [], { ...options, founderStandards: failingRegistry });
  assert.equal((await workflow.analyzeQuality(consentedStudent, document())).status, "AI_UNAVAILABLE");
  assert.equal((await workflow.observeRescue(consentedStudent, document(), { artifactSha256: "c".repeat(64), format: "PPTX", pageOrSlideCount: 1, objects: [] })).status, "AI_UNAVAILABLE");
  const bytes = syntheticCvPdf(["Research Fellow, Example Institute, January 2024 - December 2024"]); const hash = sha256(bytes);
  const source = { record: { id: "source-test", ownerPrincipalId: student.principalId, documentId: "timeline_test", objectClass: "SOURCE" as const, status: "CONFIRMED" as const, storageKey: "opaque", mimeType: "application/pdf", expectedBytes: bytes.length, expectedSha256: hash, createdAt: "2026-09-01T00:00:00Z", confirmedAt: "2026-09-01T00:00:00Z" }, bytes };
  const request = { source: { objectId: "source-test", sha256: hash, mimeType: "application/pdf" }, blocks: [{id: "client-placeholder", pageNumber: 1, section: null, text: "Ignored client text"}], documentType: "CV", existingEvents: [], consentVersion, idempotencyKey: "d1-022-standard-failure" };
  const cv = new CvIntelligenceService({ provider: new OpenAiCvIntelligenceProvider({ apiKey: "test-private-key-not-a-real-secret", model: "test-model", fetchImpl }), expectedConsentVersion: consentVersion, processingMode: "consented_students", founderStandards: failingRegistry });
  const response = await cv.analyze(consentedStudent, document(), source, request);
  assert.equal(response.status, "LIMITED_FALLBACK_REQUIRED");
  assert.equal(response.providerReceipt, undefined);
  assert.equal(calls, 0);
});
