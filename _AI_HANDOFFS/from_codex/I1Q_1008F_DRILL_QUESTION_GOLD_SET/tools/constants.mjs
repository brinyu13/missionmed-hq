export const SCHEMA = Object.freeze({
  shard: 'missionmed.i1q.1008f.restricted-drill-gold-set.v1',
  sequence: 'missionmed.i1q.1008f.student-call-sequence.v1',
  question: 'missionmed.i1q.1008f.question.v1',
  answer: 'missionmed.i1q.1008f.student-answer-span.v1',
  jumping: 'missionmed.i1q.1008f.jumping-in-exclusion.v1',
  state: 'missionmed.i1q.1008f.restricted-run-state.v1',
  safeLedger: 'missionmed.i1q.1008f.drill-processing-ledger-safe.v1',
});

export const MINIMUM_RUNTIME_RESERVE_BYTES = 10 * 1024 ** 3;
export const REQUIRED_DRILL_COUNT = 97;
export const POSTFLIGHT_INTERVAL = 4;
export const CONCURRENCY = 1;

export const RUNTIME_COMPARISON = Object.freeze({
  artifact_sha256: 'd14aab14802c51c440d85b3cb019d7812f6aeee79a36a256983d63e8c0daf2f6',
  detector_slice_sha256: '561abe4b6c4d5a8d625605ed4059de4182e8f552e1d0e27268c158ca7196a07d',
  commit: '86df235045f501ac58b7af6070dfc509bdbe2712',
  authority: 'COMPARISON_ONLY',
  limitations: Object.freeze(['NODES_ONLY', 'FIVE_SECOND_GAP', 'NO_ROSTER_MATCH', 'NO_SEQUENCE_SEMANTICS']),
});

export const REJECTION_CATEGORIES = Object.freeze([
  'ADMINISTRATION', 'ATTENDANCE', 'BANTER', 'GREETING', 'JUMPING_IN',
  'LEARNER_QUESTION', 'LEARNER_STATEMENT', 'NONMEDICAL_INSTRUCTION', 'TEACHING_STATEMENT',
]);
