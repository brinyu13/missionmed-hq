import assert from "node:assert/strict";
import test from "node:test";
import { ProviderAuthenticityService022, sanitizeProviderMetadata022 } from "../src/intelligence/provider-authenticity-022.js";
import { attachProviderReceipt, getProviderReceipt } from "../src/intelligence/provider-receipt.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { adminRosterStatus } from "../src/admin/postgres-admin-service.js";
import { document, student } from "./fixtures.js";
import { canonicalServerQuality022, completeServerQuality022 } from "../src/intelligence/server-quality-022.js";
import type { TimelineQualityAnalysisResponse } from "../src/intelligence/timeline-ai-workflow-service.js";

const clock = () => new Date("2026-09-07T01:00:00Z");
const key = new TextEncoder().encode("controlled-unit-fixture-not-a-secret-022");
const authority = new ProviderAuthenticityService022("unit-current", new Map([["unit-current", key]]), clock);
function result() {
  const transport = attachProviderReceipt({}, new Response("{}"), { id: "resp_controlled_transport", model: "unit-model" }, "request", "{}");
  return { status: "COMPLETE", mode: "SERVER_AI", provider: "openai", model: "unit-model", findings: [], unresolvedQuestions: [],
    providerReceipt: getProviderReceipt(transport) };
}
function quality(doc = document()) {
  const analysis = result();
  const serverQuality = completeServerQuality022(canonicalServerQuality022(doc), analysis as unknown as TimelineQualityAnalysisResponse);
  const proof = authority.sign(doc, "GUARDIAN", { ...analysis, serverQuality })!;
  assert.ok(proof);
  return { proof, serverQuality };
}

test("a JSON-shaped provider receipt cannot obtain a server signature", () => {
  const analysis = result();
  assert.ok(authority.sign(document(), "GUARDIAN", analysis));
  assert.equal(authority.sign(document(), "GUARDIAN", structuredClone(analysis)), null);
});

test("signed analysis binds exact provider result, current source, owner, document and key domain", () => {
  const doc = document(), { proof } = quality(doc);
  assert.ok(authority.verify(doc, "GUARDIAN", proof));
  for (const forged of [
    { ...proof, signature: "a".repeat(64), serverVerified: true },
    { ...proof, payload: { ...proof.payload, findings: [] , invented: true } },
    { ...proof, workflow: "CV" }, { ...proof, keyId: "unknown" }, { ...proof, resultSha256: "b".repeat(64) },
  ]) assert.equal(authority.verify(doc, "GUARDIAN", forged), null);
  assert.equal(authority.verify({ ...doc, id: "copied-document" }, "GUARDIAN", proof), null);
  assert.equal(authority.verify({ ...doc, studentOwnerId: "other-student" }, "GUARDIAN", proof), null);
  assert.equal(authority.verify({ ...doc, title: "changed source" }, "GUARDIAN", proof), null);
  assert.ok(authority.verify({ ...doc, revision: 50, metadata: { benign: true } }, "GUARDIAN", proof));
  const rotated = new ProviderAuthenticityService022("unit-new", new Map([["unit-new", new TextEncoder().encode("new-controlled-fixture-key-not-a-secret")], ["unit-current", key]]), clock);
  assert.ok(rotated.verify(doc, "GUARDIAN", proof));
});

test("create, checkpoint, version, list and reload strip forged AI receipts and verified readiness", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, clock, authority);
  const malicious = document({ metadata: { qualityReport022: { ai: { status: "COMPLETE", providerReceipt: structuredClone(result().providerReceipt), serverVerified: true } },
    qualitySummary022: { exportReady: true, issueCount: 0, aiReview: true, serverVerified: true } },
    intake: { lastImport: { analysis: { intelligenceMode: "SERVER_AI", providerReceipt: structuredClone(result().providerReceipt) } } } });
  const created = await service.createDocument(student, { id: malicious.id, title: malicious.title, programId: malicious.programId, document: malicious });
  const assertRulesOnly=(value:any)=>{assert.ok(value.metadata?.qualityReport022?.findings?.length);assert.equal(value.metadata.qualityReport022.ai?.providerReceipt,undefined);assert.equal(value.metadata.qualitySummary022.aiReview,false);assert.equal(value.metadata.qualitySummary022.basis,"MISSIONMED_RULE");};
  assertRulesOnly(created.document);
  const analysis = ((created.document.intake as any).lastImport.analysis);
  assert.equal(analysis.providerReceipt, undefined);
  assert.equal(analysis.intelligenceMode, "LOCAL_LIMITED");
  assertRulesOnly((await service.saveCheckpoint(student, malicious.id, "device", 0, malicious)).snapshot);
  assertRulesOnly((await service.createVersion(student, malicious.id, 0, malicious, "forged")).snapshot);
  // Legacy rows inserted before the new sanitizer are also reverified on reads.
  const row = (await repository.getDocument(malicious.id))!;
  row.document.metadata = malicious.metadata;
  (repository as any).documents.set(malicious.id, row);
  assertRulesOnly((await service.getDocument(student, malicious.id)).document);
  assertRulesOnly((await service.listOwnDocuments(student))[0]!.document);
});

test("saved Guardian report and roster readiness are rebuilt from signed canonical results, never edited report fields", async () => {
  const doc = document(), { proof, serverQuality } = quality(doc);
  doc.metadata = { qualityReport022: { ai: { providerAuthenticity: proof }, findings: [], findingCount: 0, exportReady: true },
    qualitySummary022: { issueCount: 0, exportReady: true } };
  const service = new TimelineService(new InMemoryTimelineRepository(), clock, authority);
  await service.createDocument(student, { id: doc.id, title: doc.title, programId: doc.programId, document: doc });
  const saved = (await service.getDocument(student, doc.id)).document;
  assert.deepEqual((saved.metadata?.qualityReport022 as any).findings, serverQuality.findings);
  assert.equal((saved.metadata?.qualitySummary022 as any).issueCount, serverQuality.findingCount);
  assert.equal((saved.metadata?.qualityReport022 as any).ai.providerAuthenticity.serverVerified, true);
  const row = { document_id: doc.id, owner_principal_id: doc.studentOwnerId, principal_status: "ACTIVE", quality_source: doc,
    quality_summary: { issueCount: 0, exportReady: true, sourceSha256: proof.sourceSha256, checkedAt: proof.issuedAt } };
  assert.equal(adminRosterStatus(42, row, clock(), authority).exportReadiness, "NEEDS_REVIEW");
  assert.equal(adminRosterStatus(42, row, clock(), authority).guardianBasis,"MISSIONMED_RULE");
  const signedStatus = adminRosterStatus(42, { ...row, quality_authenticity: proof }, clock(), authority);
  assert.equal(signedStatus.guardianIssueCount, serverQuality.findingCount);
  const changed = structuredClone(saved); changed.events[0]!.title = "Changed event";
  const degraded=sanitizeProviderMetadata022(changed,authority);
  assert.equal((degraded.metadata?.qualitySummary022 as any).aiReview,false);
  assert.equal((degraded.metadata?.qualityReport022 as any).ai?.providerReceipt,undefined);
});

test("CV and Rescue provenance stays bound to original SOURCE through student edits without authenticating student changes", () => {
  for (const workflow of ["CV", "RESCUE"] as const) {
    const doc = document();
    const proof = authority.sign(doc, workflow, result(), { objectId: "source-exact-owner", sha256: "d".repeat(64) })!;
    doc.intake = { lastImport: { analysis: { intelligenceMode: "SERVER_AI", providerAuthenticity: proof,
      providerReceipt: { responseId: "forged-replacement" }, founderStandardProvenance: { standards: ["fake approval"] } },
      acceptedCandidates: [{ title: "Student reviewed wording" }] } };
    doc.events[0]!.title = "Student changed wording";
    const cleaned = sanitizeProviderMetadata022(doc, authority);
    const parser = (cleaned.intake as any).lastImport.analysis;
    assert.equal(parser.providerReceipt.responseId, "resp_controlled_transport");
    assert.equal(parser.providerAuthenticity.sourceObjectId, "source-exact-owner");
    assert.equal(parser.founderStandardProvenance, undefined);
    assert.equal(cleaned.events[0]!.title, "Student changed wording");
    assert.equal(authority.verify({ ...doc, id: "another-document" }, workflow, proof), null);
    assert.equal(authority.verify(doc, workflow, { ...proof, sourceObjectId: "substituted-file" }), null);
  }
});
