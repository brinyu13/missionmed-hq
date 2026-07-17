import assert from "node:assert/strict";
import test from "node:test";
import {
  validateClaimMetadata,
  validateMomentInput,
  validateOpportunityInput,
  validatePriorityInput,
  validateSessionInput,
  validateSkillSnapshotInput,
  validateTrackItemInput
} from "../src/contracts.mjs";
import { fullSkillCard, observedClaim, sessionClock, skillSnapshotInput } from "./fixtures.mjs";

test("session contract preserves one canonical clock", () => {
  assert.deepEqual(validateSessionInput({ external_session_ref: "cam_rep_123", mode_ref: "M1", clock: sessionClock }), {
    contract_version: "cie.c0.v1",
    external_session_ref: "cam_rep_123",
    mode_ref: "M1",
    media_revision_ref: null,
    clock: sessionClock
  });
});

test("track items are ranges with structural claim provenance", () => {
  const item = validateTrackItemInput({
    kind: "event",
    range_kind: "SPAN",
    t0_ms: 120,
    t1_ms: 300,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    payload: { event: "clarifying_question" },
    provenance: observedClaim,
    visibility: "private"
  }, { authorRole: "student", sourceKind: "human" });
  assert.equal(item.t0_ms, 120);
  assert.equal(item.provenance.tier, "L1");
  assert.throws(() => validateTrackItemInput({ ...item, kind: "transcript" }, { authorRole: "student", sourceKind: "human" }), { code: "TRACK_KIND_INVALID" });
  assert.throws(() => validateTrackItemInput({ ...item, t0_ms: -1 }, { authorRole: "student", sourceKind: "human" }), { code: "TIME_RANGE_INVALID" });
});

test("Ladder laws prohibit numeric coaching and person inference", () => {
  assert.throws(() => validateClaimMetadata({
    tier: "L2",
    badge: "COACHING_FRAMEWORK",
    statement: "Practice a shorter opening.",
    evidence_refs: ["moment_1"],
    numeric_value: 7,
    framework: "named-framework",
    evidence_tier: "T2"
  }, { authorRole: "mentor", sourceKind: "human" }), { code: "CLAIM_NUMERIC_FORBIDDEN" });

  assert.throws(() => validateClaimMetadata({
    tier: "L1",
    badge: "OBSERVED_ON_REPLAY",
    statement: "The student sounded confident and empathetic.",
    evidence_refs: ["moment_1"],
    method_status: "active_validated"
  }, { authorRole: "system", sourceKind: "machine" }), { code: "PERSON_INFERENCE_FORBIDDEN" });
});

test("skill snapshots are content addressed and domains are not assignable", () => {
  const snapshot = validateSkillSnapshotInput(skillSnapshotInput);
  assert.match(snapshot.content_hash, /^[a-f0-9]{64}$/u);
  assert.equal(snapshot.render_subset.title, fullSkillCard.student_title);
  assert.throws(() => validateSkillSnapshotInput({ ...skillSnapshotInput, full_card: { ...fullSkillCard, skill_id: "D4" } }), { code: "SKILL_DOMAIN_NOT_ASSIGNABLE" });
});

test("priority contract enforces exactly one spotlight and one supporting reference", () => {
  assert.deepEqual(validatePriorityInput({ spotlight_snapshot_id: "snap_1", supporting_snapshot_id: "snap_2" }), {
    contract_version: "cie.c0.v1",
    spotlight_snapshot_id: "snap_1",
    supporting_snapshot_id: "snap_2"
  });
  assert.throws(() => validatePriorityInput({ spotlight_snapshot_id: "snap_1", supporting_snapshot_id: "snap_1" }), { code: "PRIORITY_DUPLICATE" });
});

test("Moments require a watchable range and verified human source", () => {
  const moment = validateMomentInput({
    t0_ms: 1000,
    t1_ms: 2500,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "student",
    type: "communication",
    label: "Clarifying question before counterpoint",
    visibility: "private",
    provenance: observedClaim
  }, { authorRole: "student", sourceKind: "human" });
  assert.equal(moment.source, "student");
  assert.throws(() => validateMomentInput({ ...moment, t1_ms: moment.t0_ms }, { authorRole: "student", sourceKind: "human" }), { code: "SPAN_RANGE_INVALID" });
});

test("C0 Opportunities are manual, mentor-authored, evidence-anchored L3 only", () => {
  const value = validateOpportunityInput({
    t0_ms: 1500,
    t1_ms: 3000,
    segment_id: "segment_1",
    media_revision_ref: "media_revision_1",
    source: "mentor-manual",
    type: "missed_clarifying_question",
    skill_snapshot_id: "snap_1",
    evidence_note: "The selected span begins with a counterpoint before a clarifying question appears.",
    context: { mode_ref: "M12", cue: "colleague disagreement" },
    uncertainty: "low",
    evidence_claim: observedClaim,
    coaching_claim: {
      tier: "L3",
      badge: "MENTOR",
      statement: "Consider asking one clarifying question before the counterpoint.",
      evidence_refs: ["moment_1"]
    }
  }, { authorRole: "mentor", sourceKind: "human" });
  assert.equal(value.status, "approved");
  assert.throws(() => validateOpportunityInput({
    ...value,
    source: "ai",
    evidence_claim: value.evidence_claim,
    coaching_claim: value.coaching_claim
  }, { authorRole: "mentor", sourceKind: "human" }), { code: "OPPORTUNITY_SOURCE_INVALID" });
});
