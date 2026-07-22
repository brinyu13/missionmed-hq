import { createDeterministicMentorSeed, MMC_MENTOR_FIXTURE_NOW } from './deterministic-mentor-seed.mjs';

export class MemoryMentorRepository {
  #state;
  #clock;
  #transactionTail = Promise.resolve();

  constructor(options = {}) {
    this.#state = normalizeState(options.seed || createDeterministicMentorSeed(options));
    this.#clock = options.clock || (() => new Date(MMC_MENTOR_FIXTURE_NOW));
  }

  now() {
    const value = this.#clock();
    const date = value instanceof Date ? new Date(value.valueOf()) : new Date(value);
    if (!Number.isFinite(date.valueOf())) throw new TypeError('The mentor repository clock is invalid.');
    return date;
  }

  snapshot() {
    return cloneState(this.#state);
  }

  async transaction(callback) {
    if (typeof callback !== 'function') throw new TypeError('A mentor repository transaction callback is required.');
    const previous = this.#transactionTail;
    let release;
    this.#transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const draft = cloneState(this.#state);
      const result = await callback(draft, this.now());
      this.#state = draft;
      return result;
    } finally {
      release();
    }
  }

  async setFixtureAssignmentState(assignmentId, state) {
    if (this.#state.meta.fixture !== true || !['ACTIVE', 'REVOKED', 'EXPIRED'].includes(state)) {
      throw new TypeError('Assignment mutation is available only to deterministic local fixtures.');
    }
    return this.transaction((draft) => {
      const assignment = draft.assignments.get(assignmentId);
      if (!assignment) throw new TypeError('Unknown fixture assignment.');
      draft.assignments.set(assignmentId, {
        ...assignment,
        state,
        version: assignment.version + 1,
      });
      return structuredClone(draft.assignments.get(assignmentId));
    });
  }
}

function normalizeState(seed) {
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) throw new TypeError('A mentor repository seed is required.');
  const state = structuredClone(seed);
  const mapFields = [
    'students', 'assignments', 'sessions', 'captures', 'tasks', 'commitments',
    'plans', 'milestones', 'attentions', 'reviews', 'files', 'receipts', 'commandIds',
  ];
  for (const field of mapFields) {
    if (!(state[field] instanceof Map)) state[field] = new Map(state[field] || []);
  }
  state.audit = [...(state.audit || [])];
  state.outbox = [...(state.outbox || [])];
  return state;
}

function cloneState(state) {
  return structuredClone(state);
}
