import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorityAdapter } from "../src/authority.mjs";
import { sha256 } from "../src/canonical.mjs";
import { MemoryCieRepository } from "../src/repository/memoryRepository.mjs";
import { CieService } from "../src/service.mjs";
import { fullSkillCard, observedClaim, sessionClock, skillSnapshotInput } from "./fixtures.mjs";
import { TEST_SUBJECTS, testUuid } from "./testIds.mjs";

const authority = createAuthorityAdapter(async (value) => value, "cie-test-authority");
const principal = (subject_id, role, capabilities = []) => authority.verify({ subject_id, role, capabilities, authority_session_ref: `session-${subject_id}` });
const student = await principal(TEST_SUBJECTS.student, "student");
const studentB = await principal(TEST_SUBJECTS.studentB, "student");
const mentor = await principal(TEST_SUBJECTS.mentor, "mentor");
const mentorB = await principal(TEST_SUBJECTS.mentorB, "mentor");
const admin = await principal(TEST_SUBJECTS.admin, "admin");
const integration = await principal(TEST_SUBJECTS.integration, "integration", ["cie:skill-snapshot:import", "cie:priority:write", "cie:review:write"]);
const deletionWorker = await principal(TEST_SUBJECTS.deletionWorker, "integration", ["cie:deletion:work"]);
function harness() {
  const repository = new MemoryCieRepository();
  let uuid = 0;
  let request = 0;
  const now = new Date("2026-07-17T12:00:00.000Z");
  const service = new CieService(repository, {
    now: () => new Date(now),
    uuid: () => testUuid(++uuid),
    consentPolicy: async ({ purpose }) => ({
      policy_version: "pilot-v1",
      policy_text_hash: sha256(`policy:${purpose}`),
      locale: "en-US",
      retention_policy_ref: "cie-retention-c0"
    }),
    externalDeletionProofVerifier: async ({ providerReceipt }) => ({
      verified_absent: providerReceipt?.receipt_id === "synthetic-cam-delete-receipt" && providerReceipt?.asset_ref_hash === "d".repeat(64),
      provider: "synthetic-cam-adapter",
      provider_receipt_hash: sha256(providerReceipt || null)
    })
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
    scope: { device_class: "synthetic", session_only: true },
    ...overrides
  };
}

function supportingSkillSnapshotInput() {
  const fullCard = {
    ...fullSkillCard,
    skill_id: "CIE-D4-ABA-002",
    student_title: "Summarize before moving on",
    mentor_title: "Concise transition summary",
    atomic_target: "Summarize the prior point before moving on.",
    next_rep_success: "One concise summary appears before the next topic on replay."
  };
  return {
    ...skillSnapshotInput,
    publication_seq: 2,
    full_card: fullCard,
    source_authority: {
      ...skillSnapshotInput.source_authority,
      authority_ref: "fixture_cie_d4_aba_002_v1",
      content_hash: sha256(fullCard)
    }
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
  const supportingSnapshot = await value.service.importSkillSnapshot(integration, student.subject_id, supportingSkillSnapshotInput(), value.meta("supporting-snapshot"));
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
    expires_at: "2026-07-18T12:00:00.000Z"
  }, value.meta("grant"));
  assert.equal(grant.authority_ref, student.authority_ref);
  assert.equal(grant.authority_session_ref, student.authority_session_ref);
  return { ...value, session, evidence, sharing, snapshot, supportingSnapshot, moment: momentResult.moment, grant };
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
    supporting_snapshot_id: value.supportingSnapshot.id,
    consent_receipt_ids: [value.evidence.id],
    review_moment_id: value.moment.id
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

  const mentorBGrant = await value.service.grantAccess(student, value.session.id, {
    grantee_user_id: mentorB.subject_id,
    artifact_type: "moment",
    artifact_id: value.moment.id,
    scope: "review",
    consent_receipt_id: value.sharing.id,
    expires_at: "2026-07-18T12:00:00.000Z"
  }, value.meta("second-mentor-grant"));
  const mentorBTimeline = value.service.listTimeline(mentorB, value.session.id, { limit: 20 });
  assert.equal(mentorBTimeline.items.some((item) => item.payload?.moment_id === value.moment.id), true);
  assert.equal(mentorBTimeline.items.some((item) => item.kind === "opportunity"), false);

  await assert.rejects(value.service.grantAccess(student, value.session.id, {
    grantee_user_id: mentorB.subject_id,
    artifact_type: "track_item",
    artifact_id: opportunity.track_item.track_item_id,
    scope: "review",
    consent_receipt_id: value.sharing.id
  }, value.meta("opportunity-grant-forbidden")), { code: "VISIBILITY_STATE_MISMATCH" });

  await assert.rejects(value.service.createMoment(mentor, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 10_500,
    t1_ms: 12_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor",
    review_source_moment_id: second.moment.id,
    type: "mentor-selected",
    label: "Must remain unavailable",
    visibility: "mentor",
    consent_receipt_ids: [value.evidence.id, value.sharing.id],
    provenance: { ...observedClaim, statement: "This unshared range must not be writable." }
  }, value.meta("mentor-outside-grant")), { code: "RESOURCE_UNAVAILABLE" });

  await assert.rejects(value.service.createMoment(integration, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 2_000,
    t1_ms: 4_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor",
    review_source_moment_id: value.moment.id,
    type: "integration-bypass",
    label: "Must require a human mentor grant",
    visibility: "mentor",
    consent_receipt_ids: [value.evidence.id, value.sharing.id],
    provenance: { ...observedClaim, statement: "An integration capability cannot impersonate a mentor." }
  }, value.meta("integration-review-bypass")), { code: "MOMENT_SOURCE_MISMATCH" });

  await assert.rejects(value.service.grantAccess(student, value.session.id, {
    grantee_user_id: mentor.subject_id,
    artifact_type: "session",
    artifact_id: value.session.id,
    scope: "review",
    consent_receipt_id: value.sharing.id
  }, value.meta("session-grant-forbidden")), { code: "VISIBILITY_GRANT_ARTIFACT_INVALID" });

  assert.ok(value.service.resolveMomentLink(student, value.session.id, value.moment.id).priorities);
  const mentorLink = value.service.resolveMomentLink(mentor, value.session.id, value.moment.id);
  assert.equal(mentorLink.state, "READY");
  assert.equal(mentorLink.priorities, null);
  for (const denied of [studentB, admin]) {
    assert.throws(() => value.service.resolveMomentLink(denied, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });
  }

  await value.service.revokeAccess(student, value.session.id, value.grant.id, value.meta("author-grant-revoke", 1));
  assert.throws(() => value.service.listTimeline(mentor, value.session.id, { limit: 20 }), { code: "RESOURCE_UNAVAILABLE" });
  const mentorBAfterRevoke = value.service.listTimeline(mentorB, value.session.id, { limit: 20 });
  assert.equal(mentorBAfterRevoke.items.some((item) => item.kind === "opportunity"), false);

  await value.service.recordConsent(student, value.session.id, consentInput("mentor_sharing", {
    granted: false,
    supersedes_receipt_id: value.sharing.id
  }), value.meta("cross-mentor-consent-withdrawal"));
  assert.throws(() => value.service.listTimeline(mentorB, value.session.id, { limit: 20 }), { code: "RESOURCE_UNAVAILABLE" });
  assert.equal(value.repository.getVisibilityGrant(mentorBGrant.id).revoked_at, null);
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
    expires_at: "2026-07-18T12:00:00.000Z"
  }, value.meta("grant-replacement"));
  assert.equal(replacement.row_version, 1);
  const withdrawal = await value.service.recordConsent(student, value.session.id, consentInput("mentor_sharing", {
    granted: false,
    supersedes_receipt_id: value.sharing.id
  }), value.meta("sharing-withdrawal"));
  assert.equal(withdrawal.receipt_revision, 2);
  assert.equal(Date.parse(withdrawal.recorded_at) > Date.parse(value.sharing.recorded_at), true);
  assert.equal(withdrawal.authority_ref, "cie-test-authority");
  assert.equal(withdrawal.authority_session_ref, student.authority_session_ref);
  assert.throws(() => value.service.resolveMomentLink(mentor, value.session.id, value.moment.id), { code: "RESOURCE_UNAVAILABLE" });
});

test("repository restore rejects Opportunity reviewer and track-author drift", async () => {
  const value = await seeded();
  await value.service.setPriorities(mentor, value.session.id, {
    spotlight_snapshot_id: value.snapshot.id,
    supporting_snapshot_id: value.supportingSnapshot.id,
    consent_receipt_ids: [value.evidence.id],
    review_moment_id: value.moment.id
  }, value.meta("reviewer-binding-priorities"));
  const created = await value.service.createOpportunity(mentor, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 2_000,
    t1_ms: 6_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor-manual",
    type: "missed_clarifying_question",
    skill_snapshot_id: value.snapshot.id,
    evidence_note: "Synthetic reviewer-binding fixture.",
    context: { fixture: true, patient_data: false },
    uncertainty: "low",
    consent_receipt_ids: [value.evidence.id, value.sharing.id],
    evidence_claim: { ...observedClaim, evidence_refs: [value.moment.id], statement: "The selected replay range begins with a counterpoint." },
    coaching_claim: { tier: "L3", badge: "MENTOR", statement: "Ask one clarifying question.", evidence_refs: [value.moment.id], method_status: "human_observation" }
  }, value.meta("reviewer-binding-opportunity"));
  const state = value.repository.exportState();
  const corrupted = state.opportunities.find((entry) => entry.id === created.opportunity.id);
  corrupted.reviewer = { subject_id: mentorB.subject_id, role: "mentor" };
  const body = { ...corrupted };
  delete body.content_hash;
  corrupted.content_hash = sha256(body);
  assert.throws(() => new MemoryCieRepository(state), { code: "REPOSITORY_STATE_INVALID" });
});

test("timeline pagination is bound to one event snapshot under concurrent inserts", async () => {
  const value = await seeded();
  const create = (name, t0, t1) => value.service.createMoment(student, value.session.id, {
    range_kind: "SPAN",
    t0_ms: t0,
    t1_ms: t1,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "student",
    type: "self-selected",
    label: name,
    note: "Synthetic pagination fixture.",
    skill_snapshot_ids: [value.snapshot.id],
    visibility: "private",
    consent_receipt_ids: [value.evidence.id],
    provenance: { ...observedClaim, statement: `Synthetic ${name} replay range.` }
  }, value.meta(name));
  const second = await create("page-second", 20_000, 21_000);
  const third = await create("page-third", 30_000, 31_000);
  const firstPage = value.service.listTimeline(student, value.session.id, { limit: 1 });
  assert.ok(firstPage.next_cursor);
  const snapshotEventSeq = firstPage.snapshot_event_seq;
  const inserted = await create("page-concurrent", 500, 900);

  const pagedIds = firstPage.items.map((item) => item.track_item_id);
  let cursor = firstPage.next_cursor;
  while (cursor) {
    const page = value.service.listTimeline(student, value.session.id, { limit: 1, cursor });
    assert.equal(page.snapshot_event_seq, snapshotEventSeq);
    pagedIds.push(...page.items.map((item) => item.track_item_id));
    cursor = page.next_cursor;
  }
  assert.equal(pagedIds.includes(inserted.track_item.track_item_id), false);
  assert.equal(pagedIds.includes(second.track_item.track_item_id), true);
  assert.equal(pagedIds.includes(third.track_item.track_item_id), true);
  const fresh = value.service.listTimeline(student, value.session.id, { limit: 20 });
  assert.equal(fresh.items.some((item) => item.track_item_id === inserted.track_item.track_item_id), true);
  assert.ok(fresh.snapshot_event_seq > snapshotEventSeq);
});

test("consent authority, policy, and timestamp fields are server-owned", async () => {
  const value = await seeded();
  await assert.rejects(value.service.recordConsent(student, value.session.id, consentInput("mentor_sharing", {
    granted: false,
    authority_ref: "caller-spoof",
    recorded_at: "2026-07-17T11:59:00.000Z",
    supersedes_receipt_id: value.sharing.id
  }), value.meta("spoofed-consent-authority")), { code: "CONSENT_SERVER_FIELD_FORBIDDEN" });
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
  const supportingSnapshot = await value.service.importSkillSnapshot(integration, student.subject_id, supportingSkillSnapshotInput(), value.meta("supporting-snapshot"));
  const initial = await value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: supportingSnapshot.id,
    consent_receipt_ids: [evidence.id]
  }, value.meta("priority-initial"));
  assert.equal(initial.priorities.row_version, 1);
  const a = value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: supportingSnapshot.id,
    consent_receipt_ids: [evidence.id]
  }, value.meta("priority-a", 1));
  const b = value.service.setPriorities(integration, first.id, {
    spotlight_snapshot_id: snapshot.id,
    supporting_snapshot_id: supportingSnapshot.id,
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
      evidence_refs: ["synthetic-media-input"],
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
      evidence_refs: ["synthetic-media-input"],
      simulated: true,
      numeric_value: 1,
      unit: "count",
      algorithm_id: "caller-claimed-method",
      algorithm_version: "v1",
      limitations: "Synthetic only.",
      method_status: "active_validated"
    }
  }, value.meta("inactive-l0")), { code: "CLAIM_RUNG_WRITE_FORBIDDEN" });
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
  const sentinel = "SENSITIVE_DELETION_SENTINEL";
  const replacementEvidence = await value.service.recordConsent(student, value.session.id, consentInput("evidence_storage", {
    scope: { fixture: true, sentinel },
    supersedes_receipt_id: value.evidence.id
  }), value.meta("sentinel-consent"));
  await value.service.setPriorities(mentor, value.session.id, {
    spotlight_snapshot_id: value.snapshot.id,
    supporting_snapshot_id: value.supportingSnapshot.id,
    review_moment_id: value.moment.id,
    consent_receipt_ids: [replacementEvidence.id]
  }, value.meta("sentinel-priority"));
  await value.service.createOpportunity(mentor, value.session.id, {
    range_kind: "SPAN",
    t0_ms: 2_000,
    t1_ms: 6_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor-manual",
    type: "missed_clarifying_question",
    skill_snapshot_id: value.snapshot.id,
    evidence_note: sentinel,
    context: { sentinel },
    uncertainty: "low",
    consent_receipt_ids: [replacementEvidence.id, value.sharing.id],
    evidence_claim: { ...observedClaim, evidence_refs: [value.moment.id], statement: "The synthetic range is replayable." },
    coaching_claim: { tier: "L3", badge: "MENTOR", statement: "Ask one clarifying question.", evidence_refs: [value.moment.id], method_status: "human_observation" }
  }, value.meta("sentinel-opportunity"));
  const replayInput = {
    range_kind: "SPAN",
    t0_ms: 20_000,
    t1_ms: 21_000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "student",
    type: "self-selected",
    label: "Deletion sentinel",
    note: sentinel,
    visibility: "private",
    consent_receipt_ids: [replacementEvidence.id],
    provenance: { ...observedClaim, statement: "Synthetic deletion sentinel range." }
  };
  const replayMeta = value.meta("sentinel-moment");
  await value.service.createMoment(student, value.session.id, replayInput, replayMeta);
  assert.equal(JSON.stringify(value.repository.exportState()).includes(sentinel), true);
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
  assert.equal(value.repository.listMutationReceipts(value.session.id).every((receipt) => receipt.response === null), true);
  assert.equal(value.repository.getDeletionJob(requested.job.id).completed_at, null);

  await assert.rejects(value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    provider_receipt: { receipt_id: "provider-denied", asset_ref_hash: "d".repeat(64) }
  }, value.meta("delete-proof-invalid")), { code: "DELETION_ABSENCE_NOT_VERIFIED" });
  assert.equal(value.repository.getDeletionJob(requested.job.id).state, "CLEANUP_PENDING");

  await assert.rejects(value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    authority_ref: "caller-spoof"
  }, value.meta("delete-proof-spoof")), { code: "DELETION_PROOF_SERVER_FIELD_FORBIDDEN" });

  await assert.rejects(value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    provider_receipt_hash: "c".repeat(64)
  }, value.meta("delete-proof-dummy-hash")), { code: "DELETION_PROOF_SERVER_FIELD_FORBIDDEN" });

  const completed = await value.service.recordExternalDeletionProof(deletionWorker, requested.job.id, "cam_media_revision", {
    provider_receipt: { receipt_id: "synthetic-cam-delete-receipt", asset_ref_hash: "d".repeat(64) }
  }, value.meta("delete-proof"));
  assert.equal(completed.job.state, "COMPLETE");
  assert.ok(completed.job.completed_at);
  assert.equal(completed.steps.filter((step) => !["audit_finalization", "mutation_receipts"].includes(step.resource_class)).every((step) => step.state === "VERIFIED_ABSENT"), true);
  assert.equal(completed.steps.find((step) => step.resource_class === "mutation_receipts").state, "VERIFIED_REDACTED");
  assert.equal(completed.steps.find((step) => step.resource_class === "audit_finalization").state, "VERIFIED_PRESERVED");
  assert.equal(value.repository.getSession(value.session.id).state, "DELETED");
  assert.equal(value.repository.getSession(value.session.id).clock, null);
  assert.equal(value.repository.getSession(value.session.id).external_session_ref, null);
  assert.equal(JSON.stringify(value.repository.exportState()).includes(value.session.external_session_ref), false);
  assert.equal(value.service.getDeletionStatus(student, requested.job.id).job.state, "COMPLETE");
  assert.throws(() => value.service.listTimeline(student, value.session.id), { code: "RESOURCE_UNAVAILABLE" });
  assert.equal(value.repository.listAudit(value.session.id).some((event) => event.event_type === "cie.deletion.completed"), true);
  assert.equal(JSON.stringify(value.repository.exportState()).includes(sentinel), false);
  assert.equal(value.repository.listMutationReceipts(value.session.id).every((receipt) => receipt.response === null && receipt.redacted_at), true);
  const persisted = value.repository.exportState();
  assert.equal(new MemoryCieRepository(persisted).getSession(value.session.id).state, "DELETED");
  const proofless = structuredClone(persisted);
  for (const step of proofless.deletion_steps) {
    step.proof = null;
    step.proof_hash = null;
    step.verified_at = null;
  }
  assert.throws(() => new MemoryCieRepository(proofless), { code: "REPOSITORY_STATE_INVALID" });
  const wrongSemantics = structuredClone(persisted);
  for (const step of wrongSemantics.deletion_steps) step.state = "VERIFIED_PRESERVED";
  assert.throws(() => new MemoryCieRepository(wrongSemantics), { code: "REPOSITORY_STATE_INVALID" });
  const missingCompletionAudit = structuredClone(persisted);
  missingCompletionAudit.audit_events = missingCompletionAudit.audit_events.filter((event) => event.event_type !== "cie.deletion.completed");
  assert.throws(() => new MemoryCieRepository(missingCompletionAudit), { code: "REPOSITORY_STATE_INVALID" });
  await assert.rejects(value.service.createMoment(student, value.session.id, replayInput, replayMeta), { code: "RESOURCE_UNAVAILABLE" });
});
