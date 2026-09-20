// IVOC Application Intelligence — InterviewAttentionSignal contract.
// Pure module. Authority: donor packet §3.3.
//
// Law encoded here, not in prose:
//   - `stance` separates "an interviewer may reasonably ask" (interviewer_plausible)
//     from "a program would treat as an integrity issue" (objective_concern).
//   - `proactive_eligible` is forced false for restricted sensitivity or
//     objective_concern stance.
//   - Probe wording never carries accusation language.
//   - No `red_flag` field exists anywhere in this lane.

import { SENSITIVITIES, wordCount } from './application-fact.mjs';

export const ATTENTION_SIGNAL_SCHEMA = 'ivoc.attention_signal.v1';

export const SIGNAL_KINDS = Object.freeze([
  'probe_candidate',
  'clarification_candidate',
  'strength_interest_signal',
  'consistency_check',
]);

export const STANCES = Object.freeze(['interviewer_plausible', 'objective_concern']);

export const INTERVIEWER_ROLES = Object.freeze([
  'program_director', 'faculty', 'chief_resident', 'apd', 'admin_interviewer',
]);

export const CONSISTENCY_RELATIONS = Object.freeze([
  'date_range_mismatch',
  'count_mismatch',
  'claim_absent_in_source',
  'role_title_mismatch',
  'institution_mismatch',
]);

export const SIGNAL_LIMITS = Object.freeze({
  max_probe_words: 25,
  max_rationale_words: 60,
  max_reactive_triggers: 12,
  min_probes: 1,
  max_probes: 3,
});

// Accusation vocabulary that may never appear in a probe or a rationale.
export const PROHIBITED_PROBE_LANGUAGE = /\b(lie|lied|lying|liar|dishonest\w*|fraud\w*|fabricat\w*|misrepresent\w*|red[\s_-]?flags?|suspicious\w*|decept\w*|deceiv\w*|cheat\w*|falsif\w*|caught|excuse)\b/iu;

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class AttentionSignalError extends TypeError {
  constructor(code, message) {
    super(message || code);
    this.name = 'AttentionSignalError';
    this.code = code;
  }
}

function ratio(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new AttentionSignalError('invalid_signal', `${label} must be between 0 and 1`);
}

function stringArray(value, label, { allowEmpty = true, max } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => !NON_EMPTY(item))) {
    throw new AttentionSignalError('invalid_signal', `${label} must be an array of non-empty strings`);
  }
  if (max !== undefined && value.length > max) throw new AttentionSignalError('invalid_signal', `${label} exceeds ${max} entries`);
}

export function assertProbeText(text, label = 'probe') {
  if (!NON_EMPTY(text)) throw new AttentionSignalError('invalid_probe', `${label} must be non-empty`);
  if (wordCount(text) > SIGNAL_LIMITS.max_probe_words) throw new AttentionSignalError('probe_too_long', `${label} exceeds ${SIGNAL_LIMITS.max_probe_words} words`);
  if (PROHIBITED_PROBE_LANGUAGE.test(text)) throw new AttentionSignalError('prohibited_language', `${label} contains accusation language`);
  return text;
}

export function assertAttentionSignal(signal) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    throw new AttentionSignalError('invalid_signal', 'signal must be an object');
  }
  if (signal.schema_version !== '1') throw new AttentionSignalError('invalid_signal', 'signal.schema_version must be 1');
  for (const key of ['signal_id', 'subject_id', 'rule_id', 'rules_version', 'rationale']) {
    if (!NON_EMPTY(signal[key])) throw new AttentionSignalError('invalid_signal', `signal.${key} is required`);
  }
  if (Object.prototype.hasOwnProperty.call(signal, 'red_flag')) {
    throw new AttentionSignalError('forbidden_field', 'red_flag is not a concept in this lane');
  }
  if (!SIGNAL_KINDS.includes(signal.kind)) throw new AttentionSignalError('invalid_signal', 'signal.kind is invalid');
  if (!STANCES.includes(signal.stance)) throw new AttentionSignalError('invalid_signal', 'signal.stance is invalid');
  if (!SENSITIVITIES.includes(signal.sensitivity)) throw new AttentionSignalError('invalid_signal', 'signal.sensitivity is invalid');
  stringArray(signal.fact_refs, 'signal.fact_refs', { allowEmpty: false });
  if (wordCount(signal.rationale) > SIGNAL_LIMITS.max_rationale_words) throw new AttentionSignalError('rationale_too_long', 'signal.rationale exceeds 60 words');
  if (PROHIBITED_PROBE_LANGUAGE.test(signal.rationale)) throw new AttentionSignalError('prohibited_language', 'signal.rationale contains accusation language');
  ratio(signal.confidence, 'signal.confidence');
  ratio(signal.salience, 'signal.salience');
  if (typeof signal.proactive_eligible !== 'boolean') throw new AttentionSignalError('invalid_signal', 'signal.proactive_eligible must be boolean');
  if (signal.proactive_eligible && (signal.sensitivity === 'restricted' || signal.stance === 'objective_concern')) {
    throw new AttentionSignalError('proactive_law', 'restricted or objective_concern signals can never be proactive');
  }
  stringArray(signal.reactive_triggers, 'signal.reactive_triggers', { max: SIGNAL_LIMITS.max_reactive_triggers });
  stringArray(signal.allowed_roles, 'signal.allowed_roles', { allowEmpty: false });
  for (const role of signal.allowed_roles) {
    if (!INTERVIEWER_ROLES.includes(role)) throw new AttentionSignalError('invalid_signal', `signal.allowed_roles contains unknown role ${role}`);
  }
  if (!Array.isArray(signal.possible_probes)
    || signal.possible_probes.length < SIGNAL_LIMITS.min_probes
    || signal.possible_probes.length > SIGNAL_LIMITS.max_probes) {
    throw new AttentionSignalError('invalid_signal', 'signal.possible_probes must hold 1 to 3 probes');
  }
  signal.possible_probes.forEach((probe, index) => assertProbeText(probe, `signal.possible_probes[${index}]`));
  stringArray(signal.program_affinity, 'signal.program_affinity');
  stringArray(signal.expires_with, 'signal.expires_with');
  if (signal.kind === 'consistency_check') {
    const c = signal.comparison;
    if (!c || typeof c !== 'object' || !NON_EMPTY(c.a) || !NON_EMPTY(c.b) || !CONSISTENCY_RELATIONS.includes(c.relation)) {
      throw new AttentionSignalError('invalid_signal', 'consistency_check requires comparison {a, b, relation}');
    }
  } else if (signal.comparison !== undefined) {
    throw new AttentionSignalError('invalid_signal', 'only consistency_check carries a comparison');
  }
  if (signal.stance === 'objective_concern' && signal.kind !== 'consistency_check') {
    throw new AttentionSignalError('stance_law', 'objective_concern is only defensible as a verifiable consistency_check');
  }
  return signal;
}

/**
 * Whether a signal may reach the Actor (spoken lane).
 * objective_concern never speaks. restricted speaks only reactively, only when
 * the pressure profile allows it, and only as a clarification the student may decline.
 */
export function isActorSpeakable(signal, { reactive = false, restricted_reactive_allowed = false } = {}) {
  if (signal.stance !== 'interviewer_plausible') return false;
  if (signal.sensitivity === 'restricted') return reactive === true && restricted_reactive_allowed === true;
  return true;
}
