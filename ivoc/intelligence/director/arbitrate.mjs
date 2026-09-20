// IVOC Application Intelligence — Director arbitration over five question lanes.
// Authority: donor packet §5 (RA-06) and §6. Pure and deterministic.
//
// Lanes: pool | application | live_semantic | program | mentor.
// Founder law: the Pool guides realistic interviews and never guarantees a question;
// individual_question guarantees its selected question as the opening and confines
// every later move to probes on that question or close.
//
// This module never touches the Spine, a provider or the browser. Codex wires its
// output into `brain.move.v1` events and the live hint relay.

import { assertQuestionPoolSnapshot } from '../../contracts/question-pool.mjs';
import { assertPressureProfile } from '../contracts/pressure-profile.mjs';
import { assertDirectorMove } from '../contracts/director-move.mjs';
import { isActorSpeakable } from '../contracts/attention-signal.mjs';
import { wordCount } from '../contracts/application-fact.mjs';

export const PROACTIVE_SALIENCE_THRESHOLD = 0.6;
export const REACTIVE_BOOST = 1.5;
export const COVERED_PENALTY = 0.3;
export const SHARE_CORRECTION_MIN = 0.25;
export const SHARE_CORRECTION_MAX = 4;

export const LANE_PRIORS = Object.freeze({
  full_simulation: Object.freeze({ pool: 0.55, application: 0.20, live_semantic: 0.15, program: 0.07, mentor: 0.03 }),
  guided_mock: Object.freeze({ pool: 0.40, application: 0.20, live_semantic: 0.10, program: 0.05, mentor: 0.25 }),
  individual_question: Object.freeze({ pool: 1, application: 0, live_semantic: 0, program: 0, mentor: 0 }),
});

const LANE_ORDER = ['pool', 'application', 'live_semantic', 'program', 'mentor'];

export function createMemory(overrides = {}) {
  return {
    turn_index: 0,
    asked_question_ids: [],
    covered_question_ids: [],
    asked_signal_ids: [],
    current_question_id: null,
    current_question_origin: null,
    current_signal_id: null,
    probes_on_current: 0,
    consecutive_probes: 0,
    answers_completed: 0,
    pool_questions_asked: 0,
    outside_pool_moves: 0,
    proactive_used: 0,
    clarifications_used: 0,
    current_answer_coverage: null,
    lane_moves: {},
    closed: false,
    ...overrides,
  };
}

/** Merge a move's memory_delta into memory (pure). */
export function applyMemoryDelta(memory, move) {
  const next = { ...memory };
  for (const [key, value] of Object.entries(move.memory_delta)) {
    if (Array.isArray(value) && Array.isArray(memory[key])) next[key] = [...new Set([...memory[key], ...value])];
    else next[key] = value;
  }
  return next;
}

class Candidate {
  constructor(fields) { Object.assign(this, fields); }
}

function round(value) { return Math.round(value * 10000) / 10000; }

function guidanceFor(kind, lane, text, context) {
  const lead = {
    ask_pool: 'Ask this naturally, in your own words, and let the applicant finish.',
    ask_application: 'Bring this in as a natural next topic; speak only to the listed fact.',
    ask_program: 'Ask about program fit using only sourced program facts.',
    ask_mentor: 'Steer toward this focus area without naming a mentor.',
    probe_reactive: `Connect to what the applicant just said${context ? ` about ${context}` : ''}, then ask:`,
    probe_live: 'Follow up on the applicant\'s own words:',
    clarify: 'Ask gently, as a curiosity, and accept the applicant\'s framing:',
    move_on: 'Acknowledge briefly and move to the next question.',
    close: 'Thank the applicant and close the interview warmly.',
  }[`${kind}_${lane}`] || {
    probe: 'Follow up on the applicant\'s own words:', clarify: 'Ask gently, as a curiosity, and accept the applicant\'s framing:',
    move_on: 'Acknowledge briefly and move to the next question.', close: 'Thank the applicant and close the interview warmly.',
  }[kind] || 'Continue naturally.';
  const guidance = text ? `${lead} ${text}` : lead;
  return wordCount(guidance) > 60 ? guidance.split(/\s+/u).slice(0, 60).join(' ') : guidance;
}

function baseMove(kind, { lane = null, question_ref = null, guidance, rationale_ref, signal_refs = [], memory_delta, candidates }) {
  const move = {
    schema_version: '1',
    kind,
    lane,
    question_ref,
    guidance,
    rationale_ref,
    signal_refs,
    memory_delta,
    candidates: candidates.map((c) => ({ lane: c.lane, id: c.id, kind: c.kind, score: c.score, reason: c.reason })),
  };
  return assertDirectorMove(move);
}

/**
 * @param {object} input
 * @param {object} input.pack               validated InterviewContextPack
 * @param {object} input.pool_snapshot      ivoc.question_pool_snapshot.v1
 * @param {object} input.memory             createMemory() state
 * @param {object} input.pressure_profile   resolvePressureProfile() output
 * @param {string} input.practice_goal
 * @param {number} input.target_asked_count
 * @param {Array}  [input.reactive_matches] evaluateReactiveTriggers() output for the last answer
 * @param {Array}  [input.live_candidates]  [{ id, text, confidence }] answer-grounded follow-ups from the Actor/Context Intelligence
 * @param {Array}  [input.live_consistency] evaluateLiveConsistency() output for the last answer
 * @param {string} [input.interviewer_role]
 * @param {string} [input.selected_question_id]  required for individual_question
 */
export function arbitrate(input) {
  const {
    pack, pool_snapshot, memory, pressure_profile, practice_goal, target_asked_count,
    reactive_matches = [], live_candidates = [], live_consistency = [], interviewer_role = 'program_director', selected_question_id,
  } = input || {};
  if (!pack || !Array.isArray(pack.signals) || typeof pack.subject_id !== 'string') throw new TypeError('pack is required');
  assertQuestionPoolSnapshot(pool_snapshot);
  assertPressureProfile(pressure_profile);
  if (!LANE_PRIORS[practice_goal]) throw new TypeError('practice_goal is invalid');
  if (pressure_profile.practice_goal !== practice_goal) throw new TypeError('pressure_profile.practice_goal must match practice_goal');
  if (!Number.isInteger(target_asked_count) || target_asked_count < 1) throw new TypeError('target_asked_count must be a positive integer');
  if (!memory || typeof memory !== 'object') throw new TypeError('memory is required');
  if (memory.closed) return baseMove('close', { guidance: guidanceFor('close'), rationale_ref: 'director:already_closed', memory_delta: {}, candidates: [] });

  const priors = LANE_PRIORS[practice_goal];
  const signalById = new Map(pack.signals.map((s) => [s.signal_id, s]));
  const poolItems = new Map(pool_snapshot.items.map((item) => [item.canonical_id, item]));
  const asked = new Set(memory.asked_question_ids);
  const askedSignals = new Set(memory.asked_signal_ids);
  const covered = new Set(memory.covered_question_ids);
  const askedCount = memory.asked_question_ids.length;
  const candidates = [];
  const rejected = [];

  // ---------------------------------------------------------------- opening
  if (askedCount === 0) {
    if (practice_goal === 'individual_question') {
      const id = selected_question_id || pool_snapshot.expanded_question_ids[0];
      const item = poolItems.get(id);
      if (!item || !item.text) throw new TypeError('individual_question requires a selected pool question with text');
      return baseMove('ask', {
        lane: 'pool',
        question_ref: { origin: 'pool', question_id: item.canonical_id, version: item.version, text: item.text },
        guidance: guidanceFor('ask', 'pool', item.text),
        rationale_ref: 'founder_law:individual_question_guarantees_selected_question',
        memory_delta: { turn_index: memory.turn_index + 1, asked_question_ids: [item.canonical_id], current_question_id: item.canonical_id, current_question_origin: 'pool', current_signal_id: null, probes_on_current: 0, consecutive_probes: 0, pool_questions_asked: memory.pool_questions_asked + 1, current_answer_coverage: null, lane_moves: { ...(memory.lane_moves || {}), pool: ((memory.lane_moves || {}).pool || 0) + 1 } },
        candidates: [{ lane: 'pool', id: item.canonical_id, kind: 'ask', score: 1, reason: 'guaranteed opening' }],
      });
    }
  }

  // ---------------------------------------------------------------- stay on the current question?
  const onQuestion = memory.current_question_id !== null;
  const probeBudgetLeft = onQuestion && memory.probes_on_current < pressure_profile.max_probes_per_question
    && memory.consecutive_probes < pressure_profile.max_consecutive_probes;
  const coverage = Number.isFinite(memory.current_answer_coverage) ? memory.current_answer_coverage : 1;

  if (onQuestion && probeBudgetLeft) {
    for (const match of reactive_matches) {
      const signal = signalById.get(match.signal_id);
      if (!signal || askedSignals.has(signal.signal_id)) continue;
      const reactive = true;
      if (!isActorSpeakable(signal, { reactive, restricted_reactive_allowed: pressure_profile.restricted_reactive_allowed })) {
        rejected.push({ id: signal.signal_id, reason: signal.stance === 'objective_concern' ? 'objective_concern_never_spoken' : 'restricted_not_allowed_by_profile' });
        continue;
      }
      if (!signal.allowed_roles.includes(interviewer_role)) { rejected.push({ id: signal.signal_id, reason: 'role_not_allowed' }); continue; }
      const isClarification = signal.kind === 'clarification_candidate' || signal.kind === 'consistency_check';
      if (isClarification) {
        if (memory.clarifications_used >= pressure_profile.clarification_cap_per_session) { rejected.push({ id: signal.signal_id, reason: 'clarification_cap' }); continue; }
        if (memory.answers_completed < 2) { rejected.push({ id: signal.signal_id, reason: 'too_early_for_clarification' }); continue; }
        if (signal.kind === 'consistency_check' && pressure_profile.consistency_surfacing === 'results_only') { rejected.push({ id: signal.signal_id, reason: 'consistency_results_only' }); continue; }
      }
      // Relevance saturates at 1 after the reactive boost; match strength (how many
      // distinct lexemes the answer shares with the signal) then separates candidates.
      const relevance = Math.min(1, signal.salience * REACTIVE_BOOST);
      const matchStrength = 1 + 0.5 * (Math.max(1, match.matched_lexemes?.length || 1) - 1);
      // A document-level consistency check that the answer itself just re-opened
      // (live finding on a shared fact) is the clearest moment to clarify gently.
      const liveCorroborated = signal.kind === 'consistency_check'
        && live_consistency.some((finding) => finding.fact_refs.some((id) => signal.fact_refs.includes(id)));
      const prior = practice_goal === 'individual_question' ? 1 : priors.application;
      candidates.push(new Candidate({
        lane: 'application', id: signal.signal_id, kind: isClarification ? 'clarify' : 'probe', signal,
        score: round(prior * relevance * matchStrength * (liveCorroborated ? REACTIVE_BOOST : 1) * (1 + pressure_profile.evidence_challenge_rate)),
        reason: `reactive match on ${match.matched_lexemes.join(', ')}`, context: match.matched_lexemes.join(', '),
      }));
    }
    if (pressure_profile.consistency_surfacing !== 'results_only' && memory.clarifications_used < pressure_profile.clarification_cap_per_session && memory.answers_completed >= 2) {
      for (const finding of live_consistency) {
        candidates.push(new Candidate({
          lane: 'live_semantic', id: `live-consistency:${finding.fact_refs.join('+')}`, kind: 'clarify', live: finding,
          score: round((practice_goal === 'individual_question' ? 1 : priors.live_semantic) * 0.8 * (1 + pressure_profile.evidence_challenge_rate)),
          reason: 'answer differs from a document on duration',
        }));
      }
    }
    if (coverage < pressure_profile.move_on_coverage_threshold) {
      for (const live of live_candidates) {
        if (!live || typeof live.text !== 'string' || !live.text.trim()) continue;
        const prior = practice_goal === 'individual_question' ? 1 : priors.live_semantic;
        candidates.push(new Candidate({
          lane: 'live_semantic', id: live.id || `live:${memory.turn_index}`, kind: 'follow_up', live,
          score: round(prior * (Number.isFinite(live.confidence) ? live.confidence : 0.5) * (1 + (1 - coverage))),
          reason: `coverage ${coverage} below ${pressure_profile.move_on_coverage_threshold}`,
        }));
      }
    }
  }

  const stay = candidates.filter((c) => ['probe', 'clarify', 'follow_up'].includes(c.kind)).sort(byScore);
  if (stay.length) {
    const best = stay[0];
    return emitStay(best, { memory, candidates, rejected });
  }

  // ---------------------------------------------------------------- individual question: probes only, then close
  if (practice_goal === 'individual_question') {
    return baseMove('close', {
      guidance: guidanceFor('close'),
      rationale_ref: probeBudgetLeft ? 'individual_question:no_grounded_probe_available' : 'individual_question:probe_budget_exhausted',
      memory_delta: { turn_index: memory.turn_index + 1, answers_completed: memory.answers_completed + (onQuestion ? 1 : 0), closed: true },
      candidates: [...candidates, ...rejected.map((r) => ({ lane: 'application', id: r.id, kind: 'rejected', score: 0, reason: r.reason }))],
    });
  }

  // ---------------------------------------------------------------- move on or close
  const answersCompleted = memory.answers_completed + (onQuestion ? 1 : 0);
  if (askedCount >= target_asked_count) {
    return baseMove('close', {
      guidance: guidanceFor('close'),
      rationale_ref: 'director:target_asked_count_reached',
      memory_delta: { turn_index: memory.turn_index + 1, answers_completed: answersCompleted, closed: true },
      candidates: [],
    });
  }

  const progress = askedCount / target_asked_count;
  const poolPressure = 1 + progress;
  const nonPoolPressure = Math.max(0.2, 1 - progress);
  // Would one more outside-pool move keep the session within the allowed mass?
  const outsidePoolAllowed = (memory.outside_pool_moves + 1) / (askedCount + 1) <= pressure_profile.outside_pool_mass;
  // Lane priors are probability-mass targets. `shareCorrection` implements them
  // deterministically: a lane below its target share is boosted, a lane above it
  // is damped (clamped so no lane can ever be silenced or dominate outright).
  const laneMoves = memory.lane_moves || {};
  const shareCorrection = (lane) => {
    if (askedCount === 0) return 1;
    const share = (laneMoves[lane] || (lane === 'pool' ? memory.pool_questions_asked : 0)) / askedCount;
    return Math.min(SHARE_CORRECTION_MAX, Math.max(SHARE_CORRECTION_MIN, priors[lane] / Math.max(share, 0.05)));
  };
  const next = [];

  for (const id of pool_snapshot.expanded_question_ids) {
    const item = poolItems.get(id);
    if (!item?.text) continue;
    const penalty = asked.has(id) ? 0 : covered.has(id) ? COVERED_PENALTY : 1;
    if (penalty === 0) continue;
    next.push(new Candidate({ lane: 'pool', id, kind: 'ask', item, score: round(priors.pool * item.weight * penalty * poolPressure * shareCorrection('pool')), reason: covered.has(id) ? 'pool item semantically covered' : 'pool item not yet asked' }));
  }

  const proactiveAllowed = outsidePoolAllowed
    && memory.proactive_used < pressure_profile.proactive_budget_per_session
    && memory.pool_questions_asked >= 2
    && (practice_goal !== 'full_simulation' || memory.proactive_used < Math.floor(memory.pool_questions_asked / 2));

  for (const signal of pack.signals) {
    if (askedSignals.has(signal.signal_id)) continue;
    if (!signal.allowed_roles.includes(interviewer_role)) continue;
    const isClarification = signal.kind === 'clarification_candidate' || signal.kind === 'consistency_check';
    const lane = signal.rule_id === 'AIS-R08' ? 'program' : signal.rule_id === 'AIS-R09' ? 'mentor' : 'application';
    if (!outsidePoolAllowed) { rejected.push({ id: signal.signal_id, reason: 'outside_pool_mass_exhausted' }); continue; }
    if (!signal.proactive_eligible || !isActorSpeakable(signal)) { rejected.push({ id: signal.signal_id, reason: 'not_proactive_eligible' }); continue; }
    if (signal.salience < PROACTIVE_SALIENCE_THRESHOLD) { rejected.push({ id: signal.signal_id, reason: 'below_salience_threshold' }); continue; }
    if (isClarification) {
      if (memory.clarifications_used >= pressure_profile.clarification_cap_per_session || answersCompleted < 2) { rejected.push({ id: signal.signal_id, reason: 'clarification_gate' }); continue; }
      if (signal.kind === 'consistency_check' && pressure_profile.consistency_surfacing === 'results_only') { rejected.push({ id: signal.signal_id, reason: 'consistency_results_only' }); continue; }
    } else if (lane === 'application' && !proactiveAllowed) { rejected.push({ id: signal.signal_id, reason: 'proactive_budget_or_pacing' }); continue; }
    next.push(new Candidate({
      lane, id: signal.signal_id, kind: isClarification ? 'clarify' : 'ask', signal,
      score: round(priors[lane] * signal.salience * nonPoolPressure * shareCorrection(lane) * (1 + pressure_profile.evidence_challenge_rate)),
      reason: `${lane} lane, salience ${signal.salience}`,
    }));
  }

  next.sort(byScore);
  const all = [...candidates, ...next, ...rejected.map((r) => ({ lane: 'application', id: r.id, kind: 'rejected', score: 0, reason: r.reason }))];
  if (next.length === 0) {
    return baseMove('close', {
      guidance: guidanceFor('close'),
      rationale_ref: 'director:no_candidates_remaining',
      memory_delta: { turn_index: memory.turn_index + 1, answers_completed: answersCompleted, closed: true },
      candidates: all,
    });
  }
  const best = next[0];
  const delta = {
    turn_index: memory.turn_index + 1,
    answers_completed: answersCompleted,
    probes_on_current: 0,
    consecutive_probes: 0,
    current_answer_coverage: null,
  };
  if (best.lane === 'pool') {
    return baseMove('ask', {
      lane: 'pool',
      question_ref: { origin: 'pool', question_id: best.item.canonical_id, version: best.item.version, text: best.item.text },
      guidance: guidanceFor('ask', 'pool', best.item.text),
      rationale_ref: `pool:${pool_snapshot.snapshot_id}:${best.reason.replace(/\s+/gu, '_')}`,
      memory_delta: { ...delta, asked_question_ids: [best.item.canonical_id], current_question_id: best.item.canonical_id, current_question_origin: 'pool', current_signal_id: null, pool_questions_asked: memory.pool_questions_asked + 1, lane_moves: { ...laneMoves, pool: (laneMoves.pool || 0) + 1 } },
      candidates: all,
    });
  }
  const signal = best.signal;
  const isClarification = best.kind === 'clarify';
  return baseMove('ask', {
    lane: best.lane,
    question_ref: { origin: 'contextual', question_id: signal.signal_id, version: signal.rules_version, text: signal.possible_probes[0] },
    guidance: guidanceFor(isClarification ? 'clarify' : 'ask', isClarification ? null : best.lane, signal.possible_probes[0]),
    rationale_ref: `${signal.rule_id}:${signal.signal_id}`,
    signal_refs: [signal.signal_id],
    memory_delta: {
      ...delta,
      asked_question_ids: [signal.signal_id],
      asked_signal_ids: [signal.signal_id],
      current_question_id: signal.signal_id,
      current_question_origin: 'contextual',
      current_signal_id: signal.signal_id,
      outside_pool_moves: memory.outside_pool_moves + 1,
      lane_moves: { ...laneMoves, [best.lane]: (laneMoves[best.lane] || 0) + 1 },
      proactive_used: memory.proactive_used + (best.lane === 'application' && !isClarification ? 1 : 0),
      clarifications_used: memory.clarifications_used + (isClarification ? 1 : 0),
    },
    candidates: all,
  });
}

function byScore(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  const la = LANE_ORDER.indexOf(a.lane);
  const lb = LANE_ORDER.indexOf(b.lane);
  if (la !== lb) return la - lb;
  return a.id < b.id ? -1 : 1;
}

function emitStay(best, { memory, candidates, rejected }) {
  const all = [...candidates, ...rejected.map((r) => ({ lane: 'application', id: r.id, kind: 'rejected', score: 0, reason: r.reason }))];
  const delta = {
    turn_index: memory.turn_index + 1,
    probes_on_current: memory.probes_on_current + 1,
    consecutive_probes: memory.consecutive_probes + 1,
  };
  if (best.lane === 'application') {
    const signal = best.signal;
    const isClarification = best.kind === 'clarify';
    return baseMove('probe', {
      lane: 'application',
      question_ref: { origin: 'contextual', question_id: signal.signal_id, version: signal.rules_version, text: signal.possible_probes[0] },
      guidance: guidanceFor(isClarification ? 'clarify' : 'probe', isClarification ? null : 'reactive', signal.possible_probes[0], best.context),
      rationale_ref: `${signal.rule_id}:${signal.signal_id}:reactive`,
      signal_refs: [signal.signal_id],
      memory_delta: { ...delta, asked_signal_ids: [signal.signal_id], clarifications_used: memory.clarifications_used + (isClarification ? 1 : 0) },
      candidates: all,
    });
  }
  if (best.kind === 'clarify') {
    return baseMove('probe', {
      lane: 'live_semantic',
      question_ref: { origin: 'generated', text: best.live.probe },
      guidance: guidanceFor('clarify', null, best.live.probe),
      rationale_ref: 'live_consistency:date_range_mismatch',
      signal_refs: [],
      memory_delta: { ...delta, clarifications_used: memory.clarifications_used + 1 },
      candidates: all,
    });
  }
  return baseMove('follow_up', {
    lane: 'live_semantic',
    question_ref: { origin: 'generated', text: best.live.text },
    guidance: guidanceFor('probe', 'live', best.live.text),
    rationale_ref: 'live_semantic:coverage_below_threshold',
    signal_refs: [],
    memory_delta: delta,
    candidates: all,
  });
}
