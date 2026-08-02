import test from "node:test";
import assert from "node:assert/strict";
import { ClaimLifecycle, studentProjection, validateUploadManifest, type SubjectWorkspace } from "../../apps/priq-api/src/domain.ts";
import { CueGovernor, FeatureController, createDebrief, lockedDefaults } from "../../apps/priq-api/src/features.ts";
import { assertStoryReferences } from "../../apps/priq-api/src/integrations.ts";
import { buildProfileRequest, materializeClaims } from "../../apps/priq-api/src/profile.ts";
import { approvedPublicSources, PERSON_ID, resolveConradFischer, sourceTypeCoverage, SUBJECT_ID } from "../../apps/priq-api/src/research.ts";
import { InMemoryJobQueue } from "../../packages/mir-queue/src/index.ts";

test("private upload manifest validates consent, hash, bytes, type, and retention", () => {
  const errors = validateUploadManifest({
    logicalName: "", expectedClass: "cv", filename: "cv.pdf", mediaType: "application/pdf", byteLength: 0,
    sha256: "bad", subjectId: SUBJECT_ID, consentBasis: "", retentionUntil: "2020-01-01T00:00:00Z",
  }, new Date("2026-08-02T00:00:00Z"));
  assert.equal(errors.length, 5);
  assert.deepEqual(validateUploadManifest({
    logicalName: "Authorized CV", expectedClass: "cv", filename: "cv.pdf", mediaType: "application/pdf", byteLength: 42,
    sha256: "a".repeat(64), subjectId: SUBJECT_ID, consentBasis: "student-authorized interview preparation", retentionUntil: "2026-09-01T00:00:00Z",
  }, new Date("2026-08-02T00:00:00Z")), []);
});

test("Conrad Fischer identity resolves from independent evidence assertions, not hostnames", () => {
  const result = resolveConradFischer(approvedPublicSources);
  assert.equal(result.status, "resolved"); assert.equal(result.canonicalId, PERSON_ID); assert.equal(result.conflicts.length, 0);
  const relocated = approvedPublicSources.map((source, index) => ({ ...source, uri: `https://untrusted.invalid/${index}` }));
  assert.equal(resolveConradFischer(relocated).status, "resolved");
  const titlesAndHostsOnly = approvedPublicSources.map((source) => ({ ...source, assertions: undefined }));
  assert.equal(resolveConradFischer(titlesAndHostsOnly).status, "ambiguous");
});

test("research truthfully reports audiovisual gap", () => {
  const coverage = sourceTypeCoverage(approvedPublicSources);
  assert.equal(coverage.distinctTypes, 3);
  assert.equal(coverage.hasAudiovisual, false);
});

test("profile request excludes pending sources and retains safety instructions", () => {
  const request = buildProfileRequest({
    tenantId: "missionmed", userId: "founder:1", role: "founder", subjectIds: [SUBJECT_ID], dataClasses: ["public_professional"], feature: "profile", requestId: "req:profile",
  }, approvedPublicSources);
  const input = request.input as { sources: Array<{ id: string }> };
  assert.equal(input.sources.some((source) => source.id === "src:av-pending"), false);
  assert.match(request.instructions, /never a diagnosis/);
});

test("claims require real registered evidence ids", () => {
  assert.throws(() => materializeClaims({ claims: [{ kind: "program", text: "x", confidence: "high", sourceIds: ["invented"] }] }, approvedPublicSources, SUBJECT_ID, "founder:1"), /EVIDENCE_INVALID/);
  const claims = materializeClaims({ claims: [{ kind: "program", text: "Evidence-bound draft", confidence: "medium", sourceIds: ["src:obh-brookdale-im"] }] }, approvedPublicSources, SUBJECT_ID, "founder:1");
  assert.equal(claims[0].status, "draft"); assert.equal(claims[0].evidence[0].sourceId, "src:obh-brookdale-im");
});

test("founder review state machine and student projection prevent draft leakage", () => {
  const lifecycle = new ClaimLifecycle();
  const draft = lifecycle.create({ subjectId: SUBJECT_ID, kind: "research", text: "Supported", confidence: "high", evidence: [{ sourceId: "s1", locator: "p1" }], createdBy: "coach:1" });
  const review = lifecycle.submit(draft); const approved = lifecycle.approve(review, "founder:1");
  const rejected = lifecycle.reject(lifecycle.submit(lifecycle.create({ subjectId: SUBJECT_ID, kind: "x", text: "No", confidence: "low", evidence: [{ sourceId: "s2", locator: "p2" }], createdBy: "coach:1" })), "founder:1", "unsupported");
  const workspace: SubjectWorkspace = {
    subject: { id: SUBJECT_ID, displayName: "Ezechiel Fenelon" }, program: { id: "p", name: "Brookdale", specialty: "Internal Medicine" },
    person: { id: PERSON_ID, displayName: "Dr. Conrad Fischer" }, sources: [], claims: [approved, rejected, draft], founderReviewStatus: "approved", studentPublishedAt: new Date().toISOString(),
  };
  const projection = studentProjection(workspace);
  assert.deepEqual(projection.claims.map((claim) => claim.status), ["approved"]);
  assert.throws(() => studentProjection({ ...workspace, studentPublishedAt: undefined }), /NOT_PUBLISHED/);
});

test("StoryForge references fail closed when a story is absent", () => {
  const stories = [{ id: "story:1", title: "A", text: "real bytes", version: "v1" }];
  assert.doesNotThrow(() => assertStoryReferences(stories, ["story:1"]));
  assert.throws(() => assertStoryReferences(stories, ["story:missing"]), /NOT_FOUND/);
});

test("feature switches are backend gates and Copilot governor rate-limits cues", () => {
  const features = new FeatureController();
  assert.equal(features.get().studentWorkspaceEnabled, lockedDefaults.studentWorkspaceEnabled);
  assert.throws(() => features.require("studentWorkspaceEnabled"), /FEATURE_DISABLED/);
  features.set("mirEnabled", false); assert.throws(() => features.require("researchEnabled"), /FEATURE_DISABLED/);
  const governor = new CueGovernor(20_000);
  assert.equal(governor.detect("Um I would begin with the patient", 100_000).length, 1);
  assert.equal(governor.detect("um another answer", 101_000).length, 0);
});

test("debrief refuses to invent content without interview evidence", () => {
  assert.equal(createDebrief({ subjectId: SUBJECT_ID, transcriptAvailable: false, cueIds: [], founderNotes: [] }).status, "blocked");
  const result = createDebrief({ subjectId: SUBJECT_ID, transcriptAvailable: false, cueIds: ["cue:1"], founderNotes: ["strength: concise close", "improve: name the result"] });
  assert.deepEqual(result.strengths, ["concise close"]); assert.deepEqual(result.improvements, ["name the result"]);
});

test("queue records failure without retrying implicitly", async () => {
  const queue = new InMemoryJobQueue(); const job = queue.enqueue("profile", SUBJECT_ID, {});
  await queue.runNext({ profile: async () => { throw new Error("provider unavailable"); } });
  assert.equal(job.state, "failed"); assert.equal(job.attempts, 1); assert.equal(job.error, "provider unavailable");
});
