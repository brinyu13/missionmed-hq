import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorityAdapter } from "../src/authority.mjs";
import { sha256 } from "../src/canonical.mjs";
import { MemoryCieRepository } from "../src/repository/memoryRepository.mjs";
import { CieService } from "../src/service.mjs";
import { fullSkillCard, observedClaim, sessionClock, skillSnapshotInput } from "./fixtures.mjs";

const authority = createAuthorityAdapter(async (value) => value, "cie-test-authority");
const principal = (subject_id, role, capabilities = []) => authority.verify({ subject_id, role, capabilities, authority_session_ref: `session-${subject_id}` });
const student = await principal("student_a", "student");
const studentB = await principal("student_b", "student");
const mentor = await principal("mentor_a", "mentor");
const admin = await principal("admin_a", "admin");
const integration = await principal("integration_a", "integration", ["cie:skill-snapshot:import", "cie:priority:write", "cie:review:write"]);
const deletionWorker = await principal("cie_deletion_worker", "integration", ["cie:deletion:work"]);
function harness() {
  const repository = new MemoryCieRepository();
  let uuid = 0;
  let request = 0;
  const now = new Date("2026-07-17T12:00:00.000Z");
  const service = new CieService(repository, {
    now: () => new Date(now),
    uuid: () => `id_${String(++uuid).padStart(4, "0")}`
  });
  const meta = (name, expectedRowVersion = null) => ({
    idempotencyKey: `${name}-${++request}`,
    requestId: `request-${request}`,
    correlationId: "correlation-c0",
    expectedRowVersion
  });
  return { repository, service, meta, now };
}

function consentInput(purpose, overrides = {}) {
  return {
    purpose,
    granted: true,
    authority_ref: `synthetic-${purpose}`,
    policy_version: "pilot-v1",
    policy_text_hash: sha256(`policy:${purpose}`),
    locale: "en-US",
    retention_policy_ref: "cie-retention-c0",
    scope: { device_class: "synthetic", session_only: true },
    recorded_at: "2026-07-17T12:00:00.000Z",
    ...overrides
  };
}

async function seeded() {
  const value = harness();
  const session = await value.service.createSession(student, {
    external_session_ref: "cam-session-synthetic-1",
    mode_ref: "M1",
    media_revision_ref: "media_revision_1",
    clock: sessionClock
  }, value.meta("session"));
  const evidence = await value.service.recordConsent(student, session.id, consentInput("evidence_storage"), value.meta("evidence-consent"));
  const sharing = await value.service.recordConsent(student, session.id, consentInput("mentor_sharing"), value.meta("sharing-consent"));
  const snapshot = await value.service.importSkillSnapshot(integration, student.subject_id, skillSnapshotInput, value.meta("snapshot"));
  const momentResult = await value.service.createMoment(student, session.id, {
    range_kind: "SPAN",
    t0_ms: 1_000,
    t1_ms: 9_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "student",
    type: "self-selected",
    label: "Question before counter",
    note: "Synthetic practice evidence only.",
    skill_snapshot_ids: [snapshot.id],
    visibility: "mentor",
    consent_receipt_ids: [evidence.id, sharing.id],
    provenance: observedClaim
  }, value.meta("moment"));
  const grant = await value.service.grantAccess(student, session.id, {
    grantee_user_id: mentor.subject_id,
    artifact_type: "moment",
    artifact_id: momentResult.moment.id,
    scope: "review",
    consent_receipt_id: sharing.id,
    authority_ref: "synthetic-review-grant",
    expires_at: "2026-07-18T12:00:00.000Z"
  }, value.meta("grant"));
  return { ...value, session, evidence, sharing, snapshot, moment: momentResult.moment, grant };
}

test("C0 service enforces self-first mentor review, exact grants, and hidden Opportunities", async () => {
  const value = await seeded();
  const second = await value.service.createMoment(student, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 10_000,
    t1_ms: 14_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "student",
    type: "self-selected",
    label: "Unshared evidence",
    note: "This Moment is not shared with the mentor.",
    skill_snapshot_ids: [value.snapshot.id],
    visibility: "mentor",
    consent_receipt_ids: [value.evidence.id, value.sharing.id],
    provenance: { ...observedClaim, statement: "A separate replay range was selected." }
  }, value.meta("second-moment"));

  const priorities = await value.service.setPriorities(mentor, value.session.id, {
    spotlight_snapshot_id: value.snapshot.id,
    supporting_snapshot_id: null,
    consent_receipt_ids: [value.evidence.id]
  }, value.meta("priorities"));
  assert.equal(priorities.priorities.row_version, 1);

  const opportunity = await value.service.createOpportunity(mentor, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 2_000,
    t1_ms: 6_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor-manual",
    type: "missed_clarifying_question",
    skill_snapshot_id: value.snapshot.id,
    evidence_note: "The reply moves to a counterpoint before a clarifying question.",
    context: { fixture: true, patient_data: false },
    uncertainty: "low",
    consent_receipt_ids: [value.evidence.id, value.sharing.id],
    evidence_claim: { ...observedClaim, evidence_refs: [value.moment.id], statement: "The selected replay range begins with a counterpoint." },
    coaching_claim: {
      tier: "L3",
      badge: "MENTOR",
      statement: "Try one answerable clarifying question before the counterpoint.",
      evidence_refs: [value.moment.id],
      simulated: true,
      method_status: "human_observation"
    }
  }, value.meta("opportunity"));
  assert.equal(opportunity.opportunity.source_moment_id, value.moment.id);
  assert.equal(opportunity.opportunity.student_visible, false);

  const ownerTimeline = value.service.listTimeline(student, value.session.id, { limit: 20 });
  assert.equal(ownerTimeline.items.some((item) => item.kind === "opportunity"), false);
  const ownerReviewerSpoof = value.service.listTimeline(student, value.session.id, { limit: 20, audience: "reviewer" });
  assert.equal(ownerReviewerSpoof.items.some((item) => item.kind === "opportunity"), false);
  const mentorTimeline = value.service.listTimeline(mentor, value.session.id, { limit: 20 });
  assert.equal(mentorTimeline.items.some((item) => item.payload?.moment_id === value.moment.id), true);
  assert.equal(mentorTimeline.items.some((item) => item.payload?.moment_id === second.moment.id), false);
  assert.equal(mentorTimeline.items.some((item) => item.kind === "opportunity"), true);

  assert.ok(value.service.resolveMomentLink(student, value.session.id, value.moment.id).priorities);
  const mentorLink = value.service.resolveMomentLink(mentor, value.session.id, value.moment.id);
  assert.equal(mentorLink.state, "READY");
  assert.equal(mentorLink.priorities, null);
  for (const denied of [studentB, admin]) {
    assert.throws(() => value.service.resolveMomentLink(denied, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });
  }
});

test("grant revocation and consent withdrawal fail closed without enumerating Moments", async () => {
  const value = await seeded();
  const revoked = await value.service.revokeAccess(student, value.session.id, value.grant.id, value.meta("revoke", 1));
  assert.equal(revoked.row_version, 2);
  assert.throws(() => value.service.resolveMomentLink(mentor, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });

  const replacement = await value.service.grantAccess(student, value.session.id, {
    grantee_user_id: mentor.subject_id,
    artifact_type: "moment",
    artifact_id: value.moment.id,
    scope: "review",
    consent_receipt_id: value.sharing.id,
    authority_ref: "synthetic-review-grant-2",
    expires_at: "2026-07-18T12:00:00.000Z"
  }, value.meta("grant-replacement"));
  assert.equal(replacement.row_version, 1);
  const withdrawal = await value.service.recordConsent(student, value.session.id, consentInput("mentor_sharing", {
    granted: false,
    recorded_at: "2026-07-17T12:01:00.000Z",
    supersedes_receipt_id: value.sharing.id
  }), value.meta("sharing-withdrawal"));
  assert.equal(withdrawal.receipt_revision, 2);
  assert.throws(() => value.service.resolveMomentLink(mentor, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });
});

test("backdated consent cannot displace the latest authority revision", async () => {
  const value = await seeded();
  await assert.rejects(value.service.recordConsent(student, value.session.id, consentInput("mentor_sharing", {
    granted: false,
    recorded_at: "2026-07-17T11:59:00.000Z",
    supersedes_receipt_id: value.sharing.id
  }), value.meta("backdated-withdrawal")), { code: "CONSENT_TIME_REGRESSION" });
  assert.equal(value.repository.latestConsent(value.session.id, "mentor_sharing").id, value.sharing.id);
});

test("mutation retries are idempotent and priority updates reject stale writers", async () => {
  const value = harness();
  const input = {
    external_session_ref: "cam-session-idempotent",
    mode_ref: "M1",
    media_revision_ref: "media_revision_1",
    clock: sessionClock
  };
  const meta = value.meta("session-retry");
  const first = await value.service.createSession(student, input, meta);
  const replay = await value.service.createSession(student, input, meta);
  assert.deepEqual(replay, first);
  await assert.rejects(value.service.createSession(student, { ...input, mode_ref: "M2" }, meta), { code: "IDEMPOTENCY_KEY_REUSED" });

  const evidence = await value.service.recordConsent(student, first.id, consentInput("evidence_storage"), value.meta("evidence"));
  const snapshot = await value.service.importSkillSnapshot(integration, student.subject_id, skillSnapshotInput, value.meta("snapshot"));
  const initial = await value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: null,
    consent_receipt_ids: [evidence.id]
  }, value.meta("priority-initial"));
  assert.equal(initial.priorities.row_version, 1);
  const a = value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: null,
    consent_receipt_ids: [evidence.id]
  }, value.meta("priority-a", 1));
  const b = value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: null,
    consent_receipt_ids: [evidence.id]
  }, value.meta("priority-b", 1));
  const results = await Promise.allSettled([a, b]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "ROW_VERSION_CONFLICT").length, 1);
  assert.equal(value.repository.getPriorities(first.id).row_version, 2);
});

test("inactive future inputs produce no artifact", async () => {
  const value = await seeded();
  const before = value.repository.exportState();
  await assert.rejects(value.service.appendTrackItem(student, value.session.id, {
    item_revision: 1,
    supersedes_item_revision: null,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    kind: "physio",
    range_kind: "POINT",
    t0_ms: 1_500,
    t1_ms: 1_500,
    payload: { bpm: 70 },
    payload_schema_version: "cie.polar.v1",
    visibility: "private",
    consent_receipt_ids: [value.evidence.id],
    provenance: {
      tier: "L0",
      badge: "SIMULATED",
      statement: "Synthetic provider packet value.",
      evidence_refs: [],
      simulated: true,
      numeric_value: 70,
      unit: "bpm",
      algorithm_id: "synthetic-fixture",
      algorithm_version: "v1",
      limitations: "Not a score or interpretation.",
      method_status: "active_validated"
    }
  }, value.meta("inactive-physio")), { code: "TRACK_KIND_INACTIVE" });
  assert.equal(value.repository.exportState().track_items.length, before.track_items.length);
  await assert.rejects(value.service.appendTrackItem(student, value.session.id, {
    item_revision: 1,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    kind: "derived_signal",
    range_kind: "POINT",
    t0_ms: 2_000,
    t1_ms: 2_000,
    payload: { score: 1 },
    visibility: "private",
    consent_receipt_ids: [value.evidence.id],
    provenance: observedClaim
  }, value.meta("inactive-derived")), { code: "TRACK_KIND_INACTIVE" });
  await assert.rejects(value.service.appendTrackItem(student, value.session.id, {
    item_revision: 1,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    kind: "event",
    range_kind: "POINT",
    t0_ms: 2_000,
    t1_ms: 2_000,
    payload: { count: 1 },
    visibility: "private",
    consent_receipt_ids: [value.evidence.id],
    provenance: {
      tier: "L0",
      badge: "SIMULATED",
      statement: "Synthetic count.",
      evidence_refs: [],
      simulated: true,
      numeric_value: 1,
      unit: "count",
      algorithm_id: "caller-claimed-method",
      limitations: "Synthetic only.",
      method_status: "active_validated"
    }
  }, value.meta("inactive-l0")), { code: "MEASUREMENT_METHOD_INACTIVE" });
});

test("skill snapshot identity is owner-scoped without cross-user reuse", async () => {
  const value = harness();
  const first = await value.service.importSkillSnapshot(integration, student.subject_id, skillSnapshotInput, value.meta("snapshot-a"));
  const second = await value.service.importSkillSnapshot(integration, studentB.subject_id, {
    ...skillSnapshotInput,
    full_card: { ...fullSkillCard }
  }, value.meta("snapshot-b"));
  assert.notEqual(first.id, second.id);
  assert.equal(first.content_hash, second.content_hash);
  assert.equal(value.repository.listSkillSnapshots(student.subject_id).length, 1);
  assert.equal(value.repository.listSkillSnapshots(studentB.subject_id).length, 1);
});

test("session deletion remains pending until local closure and external CAM absence are proven", async () => {
  const value = await seeded();
  const requestMeta = value.meta("delete-session", 1);
  const requested = await value.service.requestSessionDeletion(student, value.session.id, requestMeta);
  assert.equal(requested.job.state, "TOMBSTONED");
  assert.equal(requested.steps.every((step) => step.state === "PENDING"), true);
  const replay = await value.service.requestSessionDeletion(student, value.session.id, requestMeta);
  assert.deepEqual(replay, requested);
  assert.throws(() => value.service.resolveMomentLink(mentor, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });

  const local = await value.service.runLocalDeletion(deletionWorker, requested.job.id, value.meta("delete-local"));
  assert.equal(local.job.state, "CLEANUP_PENDING");
  assert.equal(local.steps.find((step) => step.resource_class === "cam_media_revision").state, "PENDING");
  assert.equal(local.steps.find((step) => step.resource_class === "audit_finalization").state, "PENDING");
  assert.equal(value.repository.exportState().moments.length, 0);
  assert.equal(value.repository.exportState().track_items.length, 0);
  assert.equal(value.repository.getDeletionJob(requested.job.id).completed_at, null);

  await assert.rejects(value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    verified_absent: false,
    authority_ref: "cam-media-deletion-v1",
    checked_at: "2026-07-17T12:02:00.000Z"
  }, value.meta("delete-proof-invalid")), { code: "DELETION_ABSENCE_NOT_VERIFIED" });
  assert.equal(value.repository.getDeletionJob(requested.job.id).state, "CLEANUP_PENDING");

  const completed = await value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    verified_absent: true,
    authority_ref: "cam-media-deletion-v1",
    checked_at: "2026-07-17T12:02:00.000Z",
    provider_receipt_hash: "c".repeat(64)
  }, value.meta("delete-proof"));
  assert.equal(completed.job.state, "COMPLETE");
  assert.ok(completed.job.completed_at);
  assert.equal(completed.steps.every((step) => step.state === "VERIFIED_ABSENT"), true);
  assert.equal(value.repository.getSession(value.session.id).state, "DELETED");
  assert.equal(value.service.getDeletionStatus(student, requested.job.id).job.state, "COMPLETE");
  assert.throws(() => value.service.listTimeline(student, value.session.id), { code: "RESOURCE_UNAVAILABLE" });
  assert.equal(value.repository.listAudit(value.session.id).some((event) => event.event_type === "cie.deletion.completed"), true);
});
