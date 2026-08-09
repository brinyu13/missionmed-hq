import {
  DomainInvariantError,
  IdempotencyConflictError,
  NotFoundError,
  StaleRevisionError,
  ValidationError,
} from '../domain/errors.js';
import { assertRecommendationCase } from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  canonicalize,
  cloneFrozen,
} from '../domain/value-utils.js';
import { RecommendationCaseRepositoryPort } from '../services/ports.js';

function assertRequestMetadata({ idempotencyKey, requestHash }) {
  assertNonEmptyString(idempotencyKey, 'idempotencyKey', { maxLength: 200 });
  if (!/^[a-f0-9]{64}$/u.test(requestHash)) {
    throw new ValidationError('requestHash must be a SHA-256 digest');
  }
}

export class InMemoryRecommendationCaseRepository extends RecommendationCaseRepositoryPort {
  constructor() {
    super();
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.isDurable = false;
    this.atomicStateAndEvent = false;
    this.#records = new Map();
    this.#idempotency = new Map();
  }

  #records;
  #idempotency;

  describePersistence() {
    return Object.freeze({
      durability: this.durability,
      productionEligible: false,
      warning: 'Process-local records are lost on restart and must never back real users.',
    });
  }

  assertProductionReady() {
    throw new DomainInvariantError('In-memory recommendation case persistence is not production-ready');
  }

  #idempotencyNamespace(caseId, key) {
    return `${caseId}:${key}`;
  }

  #replayOrConflict(caseId, idempotencyKey, requestHash) {
    const prior = this.#idempotency.get(this.#idempotencyNamespace(caseId, idempotencyKey));
    if (!prior) return null;
    if (prior.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
    return cloneFrozen(prior.result);
  }

  #recordIdempotency(caseId, idempotencyKey, requestHash, result) {
    this.#idempotency.set(this.#idempotencyNamespace(caseId, idempotencyKey), {
      requestHash,
      result: cloneFrozen(result),
    });
  }

  async create(record, metadata) {
    assertRecommendationCase(record);
    assertRequestMetadata(metadata);
    const replay = this.#replayOrConflict(record.id, metadata.idempotencyKey, metadata.requestHash);
    if (replay) return replay;
    if (this.#records.has(record.id)) {
      throw new DomainInvariantError('Recommendation case IDs are unique and cannot be recreated');
    }
    if (record.revision !== 0) throw new DomainInvariantError('New cases must begin at revision zero');
    const stored = cloneFrozen(record);
    this.#records.set(record.id, stored);
    this.#recordIdempotency(record.id, metadata.idempotencyKey, metadata.requestHash, stored);
    return cloneFrozen(stored);
  }

  async getById(caseId) {
    assertNonEmptyString(caseId, 'caseId');
    const record = this.#records.get(caseId);
    if (!record) throw new NotFoundError('recommendation_case', caseId);
    return cloneFrozen(record);
  }

  async save(record, { expectedRevision, idempotencyKey, requestHash }) {
    assertRecommendationCase(record);
    assertRequestMetadata({ idempotencyKey, requestHash });
    const replay = this.#replayOrConflict(record.id, idempotencyKey, requestHash);
    if (replay) return replay;
    const current = this.#records.get(record.id);
    if (!current) throw new NotFoundError('recommendation_case', record.id);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be a non-negative integer');
    }
    if (current.revision !== expectedRevision) {
      throw new StaleRevisionError({
        caseId: record.id,
        expectedRevision,
        actualRevision: current.revision,
      });
    }
    if (record.revision !== expectedRevision + 1) {
      throw new DomainInvariantError('Saved records must advance exactly one revision');
    }
    if (record.studentId !== current.studentId || record.createdAt !== current.createdAt) {
      throw new DomainInvariantError('Recommendation case identity and ownership are immutable');
    }
    const priorHistory = record.versionHistory.slice(0, current.versionHistory.length);
    if (canonicalize(priorHistory) !== canonicalize(current.versionHistory)) {
      throw new DomainInvariantError('Version history is append-only and cannot be rewritten');
    }
    const stored = cloneFrozen(record);
    this.#records.set(record.id, stored);
    this.#recordIdempotency(record.id, idempotencyKey, requestHash, stored);
    return cloneFrozen(stored);
  }
}
