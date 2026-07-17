import { CLOCK_ID, CLOCK_VERSION, SegmentedSessionClock } from "../src/clock.mjs";

export const captureClock = Object.freeze({
  clock_id: CLOCK_ID,
  clock_version: CLOCK_VERSION,
  origin_kind: "monotonic",
  paint_cadence_is_evidence_clock: false,
  gaps: []
});

const timeline = new SegmentedSessionClock();
timeline.addSegment({
  segment_id: "segment_1",
  rep_ref: "cam_rep_123",
  media_revision_ref: "media_revision_1",
  validated_duration_ms: 120_000,
  capture_clock: captureClock
});
export const sessionClock = timeline.contract();

export const observedClaim = Object.freeze({
  tier: "L1",
  badge: "OBSERVED_ON_REPLAY",
  statement: "A clarifying question begins at this replay range.",
  evidence_refs: ["moment_ref_1"],
  simulated: true,
  method_status: "human_observation"
});

export const fullSkillCard = Object.freeze({
  skill_id: "CIE-D4-ABA-001",
  version: "v1.0",
  status: "published",
  student_title: "Ask one question before you argue",
  mentor_title: "Clarifying question before rebuttal",
  plain_description: "Ask one clarifying question before offering a counterpoint.",
  parent_domain: "D4",
  competency_cluster: "Ask before you argue",
  atomic_target: "Ask one clarifying question before countering.",
  positive_examples: ["Can I check what you mean?", "Which part concerns you most?"],
  counterexamples: ["A rhetorical question", "Three stacked questions"],
  observable_markers: [
    { claim_rung: "L1", description: "The first response on replay is a clarifying question." },
    { claim_rung: "L1", description: "The question is answerable and concerns the other position." }
  ],
  eligible_metrics: [],
  metric_limitations: "This behavior cannot establish curiosity, respect, sincerity, competence, or outcomes.",
  mode_relevance: "Primary in M6 and M12; contextual elsewhere.",
  scenario_relevance: "Colleague disagreement and feedback conversations.",
  age_relevance: "Adapt wording for age and communication needs.",
  evidence_tier: "T2",
  mm_coaching_note: "Pair with listening and use only where inquiry is appropriate.",
  practice_drills: [{ id: "HOLD_THE_COUNTER", duration_seconds: 90 }],
  moment_labels: ["question before counter"],
  next_rep_success: "One clarifying question appears before the first counterpoint on replay.",
  comparison_criteria: "Compare the first response after a disagreement cue.",
  prerequisites: [],
  related_skills: [],
  context_guidance: "In urgent closed-loop orders, read-back may be more appropriate than inquiry.",
  accessibility_notes: "Allow additional response time and alternative communication modes.",
  cultural_note: "Directness and softening vary; assess the observable sequence, not style conformity.",
  content_owner: "synthetic-test-council",
  review_date: "2027-07-17",
  version_history: [{ version: "v1.0", change: "Synthetic C0 fixture" }],
  archival_reason: null
});

export const skillSnapshotInput = Object.freeze({
  publication_seq: 1,
  full_card: fullSkillCard,
  source_authority: {
    kind: "synthetic_fixture",
    authority_ref: "fixture_cie_d4_aba_001_v1",
    verified_at: "2026-07-17T12:00:00.000Z"
  }
});
