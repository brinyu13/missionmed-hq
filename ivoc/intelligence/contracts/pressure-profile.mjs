// IVOC Application Intelligence — PressureProfile contract.
// Pure module. Authority: donor packet §6 (RA-07: pressure is policy, not tone).
//
// Nothing here touches voice, accent, warmth wording or embodiment. Those stay
// Actor configuration per interviewer profile and are independently swappable.

export const PRESSURE_PROFILE_SCHEMA = 'ivoc.pressure_profile.v1';

export const INTERVIEWER_STYLES = Object.freeze(['dove', 'peacock', 'owl', 'eagle']);
export const CONSISTENCY_SURFACING = Object.freeze(['results_only', 'end_of_answer_block', 'immediate']);
export const PRACTICE_GOALS = Object.freeze(['full_simulation', 'guided_mock', 'individual_question']);

// Style bases, index-aligned with INTERVIEWER_STYLES (dove, peacock, owl, eagle).
const BASE = Object.freeze({
  max_probes_per_question: [1, 2, 2, 3],
  evidence_challenge_rate: [0.10, 0.25, 0.35, 0.60],
  consistency_surfacing: ['results_only', 'end_of_answer_block', 'end_of_answer_block', 'immediate'],
  move_on_coverage_threshold: [0.50, 0.60, 0.70, 0.80],
  proactive_budget_per_session: [1, 2, 2, 3],
  silence_tolerance_ms: [2500, 2000, 1800, 1200],
  rambling_tolerance_s: [90, 75, 60, 45],
  restricted_reactive_allowed: [false, false, true, true],
});

// Founder-law constants that no style or modifier may exceed.
export const HARD_LIMITS = Object.freeze({
  max_consecutive_probes: 3,
  max_probes_per_question: 3,
  clarification_cap_per_session: 1,
  min_answers_before_clarification: 2,
  min_pool_questions_before_proactive: 2,
  proactive_per_pool_questions_full_simulation: 2,
});

// follow_up_intensity (0..3) → probability mass allowed outside the pool (8000 §8.4).
export const OUTSIDE_POOL_MASS = Object.freeze([0.05, 0.20, 0.35, 0.50]);

// Fields that must never appear on a profile (they belong to the Actor).
export const FORBIDDEN_PROFILE_FIELDS = Object.freeze(['voice', 'accent', 'tone', 'warmth', 'embodiment', 'avatar']);

export class PressureProfileError extends TypeError {
  constructor(code, message) {
    super(message || code);
    this.name = 'PressureProfileError';
    this.code = code;
  }
}

function pick(table, index) {
  return table[Math.min(index, INTERVIEWER_STYLES.length - 1)];
}

export function resolvePressureProfile({ style, pressure_modifier = false, follow_up_intensity, practice_goal } = {}) {
  if (!INTERVIEWER_STYLES.includes(style)) throw new PressureProfileError('invalid_style', `style must be one of ${INTERVIEWER_STYLES.join(', ')}`);
  if (typeof pressure_modifier !== 'boolean') throw new PressureProfileError('invalid_modifier', 'pressure_modifier must be boolean');
  if (!Number.isInteger(follow_up_intensity) || follow_up_intensity < 0 || follow_up_intensity > 3) {
    throw new PressureProfileError('invalid_intensity', 'follow_up_intensity must be an integer 0 through 3');
  }
  if (!PRACTICE_GOALS.includes(practice_goal)) throw new PressureProfileError('invalid_goal', 'practice_goal is invalid');
  if (practice_goal === 'individual_question' && pressure_modifier) {
    throw new PressureProfileError('modifier_law', 'pressure modifier is not valid for individual question practice');
  }

  const base = INTERVIEWER_STYLES.indexOf(style);
  const effective = pressure_modifier ? Math.min(base + 1, INTERVIEWER_STYLES.length - 1) : base;

  let probes = pick(BASE.max_probes_per_question, effective);
  if (follow_up_intensity === 0) probes = 0;
  else if (follow_up_intensity === 1) probes = Math.max(1, probes - 1);
  else if (follow_up_intensity === 3) probes = Math.min(HARD_LIMITS.max_probes_per_question, probes + 1);

  let surfacing = pick(BASE.consistency_surfacing, effective);
  let coaching = 0;
  if (practice_goal === 'guided_mock') { surfacing = 'end_of_answer_block'; coaching = 1; }
  if (practice_goal === 'individual_question') coaching = 1;

  const profile = Object.freeze({
    schema_version: '1',
    style,
    effective_style: INTERVIEWER_STYLES[effective],
    pressure_modifier,
    follow_up_intensity,
    practice_goal,
    max_probes_per_question: probes,
    max_consecutive_probes: HARD_LIMITS.max_consecutive_probes,
    evidence_challenge_rate: pick(BASE.evidence_challenge_rate, effective),
    consistency_surfacing: surfacing,
    move_on_coverage_threshold: pick(BASE.move_on_coverage_threshold, effective),
    proactive_budget_per_session: pick(BASE.proactive_budget_per_session, effective),
    silence_tolerance_ms: pick(BASE.silence_tolerance_ms, effective),
    rambling_tolerance_s: pick(BASE.rambling_tolerance_s, effective),
    restricted_reactive_allowed: pick(BASE.restricted_reactive_allowed, effective),
    outside_pool_mass: OUTSIDE_POOL_MASS[follow_up_intensity],
    coaching_interjections_per_answer: coaching,
    coaching_language_allowed: practice_goal !== 'full_simulation',
    clarification_cap_per_session: HARD_LIMITS.clarification_cap_per_session,
  });
  return assertPressureProfile(profile);
}

export function assertPressureProfile(profile) {
  if (!profile || typeof profile !== 'object') throw new PressureProfileError('invalid_profile', 'profile must be an object');
  if (profile.schema_version !== '1') throw new PressureProfileError('invalid_profile', 'profile.schema_version must be 1');
  for (const key of Object.keys(profile)) {
    if (FORBIDDEN_PROFILE_FIELDS.includes(key)) throw new PressureProfileError('forbidden_field', `${key} belongs to the Actor, not the pressure profile`);
  }
  if (!INTERVIEWER_STYLES.includes(profile.style) || !INTERVIEWER_STYLES.includes(profile.effective_style)) {
    throw new PressureProfileError('invalid_profile', 'profile style is invalid');
  }
  if (!Number.isInteger(profile.max_probes_per_question) || profile.max_probes_per_question < 0
    || profile.max_probes_per_question > HARD_LIMITS.max_probes_per_question) {
    throw new PressureProfileError('invalid_profile', 'max_probes_per_question out of range');
  }
  if (profile.max_consecutive_probes !== HARD_LIMITS.max_consecutive_probes) throw new PressureProfileError('hard_limit', 'max_consecutive_probes is fixed at 3');
  for (const key of ['evidence_challenge_rate', 'move_on_coverage_threshold', 'outside_pool_mass']) {
    if (!Number.isFinite(profile[key]) || profile[key] < 0 || profile[key] > 1) throw new PressureProfileError('invalid_profile', `${key} must be between 0 and 1`);
  }
  if (!CONSISTENCY_SURFACING.includes(profile.consistency_surfacing)) throw new PressureProfileError('invalid_profile', 'consistency_surfacing is invalid');
  for (const key of ['proactive_budget_per_session', 'silence_tolerance_ms', 'rambling_tolerance_s', 'coaching_interjections_per_answer', 'clarification_cap_per_session']) {
    if (!Number.isInteger(profile[key]) || profile[key] < 0) throw new PressureProfileError('invalid_profile', `${key} must be a non-negative integer`);
  }
  if (typeof profile.restricted_reactive_allowed !== 'boolean' || typeof profile.coaching_language_allowed !== 'boolean') {
    throw new PressureProfileError('invalid_profile', 'boolean dials must be boolean');
  }
  if (profile.practice_goal === 'full_simulation' && profile.coaching_language_allowed) {
    throw new PressureProfileError('mode_law', 'full_simulation forbids coaching language');
  }
  return profile;
}
