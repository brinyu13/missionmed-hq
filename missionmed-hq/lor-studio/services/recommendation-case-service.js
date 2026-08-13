import { AuthorizationDeniedError, ValidationError } from '../domain/errors.js';
import {
  appendReceipt,
  autosaveBuilderStep,
  builderProgress,
  completeBuilderStep,
  createRecommendationCase,
} from '../domain/recommendation-case.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  hashValue,
  makeId,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import {
  authorizeCaseAction,
  evaluateStudentEntitlement,
  projectCaseForActor,
} from '../security/authorization-policy.js';
import { createMetadataServiceEvent } from './metadata-events.js';
import { assertPort } from './ports.js';

/**
 * @typedef {{
 *   eventId: string,
 *   eventType: string,
 *   caseId: string,
 *   actorId: string,
 *   actorRole: string,
 *   correlationId: string,
 *   outcome?: string,
 *   revision?: number | null,
 *   occurredAt?: Date | string | number,
 *   idFactory?: () => string,
 * }} MetadataServiceEventInput
 */

/**
 * @typedef {{
 *   id: string,
 *   studentId: string,
 *   actorId?: string,
 *   now?: Date | string | number,
 *   builderSessionId?: string,
 *   idFactory?: () => string,
 * }} RecommendationCaseInput
 */

/**
 * @type {(input: MetadataServiceEventInput) => ReturnType<typeof createMetadataServiceEvent>}
 */
const buildMetadataServiceEvent = createMetadataServiceEvent;

/**
 * @type {(input: RecommendationCaseInput) => ReturnType<typeof createRecommendationCase>}
 */
const buildRecommendationCase = createRecommendationCase;

function assertStudentActor(actor) {
  if (!actor || actor.role !== 'student' || typeof actor.id !== 'string' || actor.id.length === 0) {
    throw new AuthorizationDeniedError('STUDENT_ACTOR_REQUIRED');
  }
}

function requestMetadata(operation, caseId, actorId, idempotencyKey, payload) {
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    throw new ValidationError('Every write requires an idempotency key');
  }
  return {
    idempotencyKey,
    requestHash: hashValue({ operation, caseId, actorId, payload }),
  };
}

export class RecommendationCaseService {
  constructor({
    repository,
    entitlementPort,
    eventSink,
    clock = () => new Date(),
    requireCanary = false,
    caseIdFactory = () => makeId('case'),
    protectedIdFactory,
  }) {
    if (repository?.isDurable === true) {
      if (repository.atomicStateAndEvent !== true) {
        throw new TypeError('Durable repositories must declare atomicStateAndEvent=true');
      }
      this.repository = assertPort(
        repository,
        ['reserveCaseCreation', 'getById', 'commitWithEvent'],
        'repository',
      );
      if (eventSink !== undefined && eventSink !== null) {
        throw new TypeError('Durable repositories commit their metadata event atomically; no separate eventSink is allowed');
      }
      this.persistenceMode = 'DURABLE_ATOMIC_STATE_AND_EVENT';
      this.eventSink = null;
    } else if (
      repository?.isDurable === false &&
      repository?.durability === 'NON_DURABLE_TEST_ONLY'
    ) {
      this.repository = assertPort(
        repository,
        ['reserveCaseCreation', 'create', 'getById', 'save'],
        'repository',
      );
      this.eventSink = assertPort(eventSink, ['emit'], 'eventSink');
      this.persistenceMode = 'NON_DURABLE_TEST_ONLY_SEPARATE_EVENT';
    } else {
      throw new TypeError('Repository durability must be explicit and fail closed');
    }
    this.entitlementPort = assertPort(
      entitlementPort,
      ['getStudentEntitlement'],
      'entitlementPort',
    );
    this.clock = clock;
    this.requireCanary = requireCanary;
    if (typeof caseIdFactory !== 'function') throw new TypeError('caseIdFactory must be a server-side function');
    if (protectedIdFactory !== undefined && typeof protectedIdFactory !== 'function') {
      throw new TypeError('protectedIdFactory must be a server-side function');
    }
    this.caseIdFactory = /** @type {(request: {actorId: string, idempotencyKey: string}) => string} */ (caseIdFactory);
    this.protectedIdFactory = protectedIdFactory;
  }

  async #entitlement(studentId) {
    return this.entitlementPort.getStudentEntitlement({ studentId });
  }

  #buildEvent({ eventType, caseRecord, actor, idempotencyKey, outcome = 'success' }) {
    const correlationId = sha256(idempotencyKey).slice(0, 32);
    return buildMetadataServiceEvent({
      eventId: `event_${sha256(`${caseRecord.id}:${eventType}:${idempotencyKey}`).slice(0, 32)}`,
      eventType,
      caseId: caseRecord.id,
      actorId: actor.id,
      actorRole: actor.role,
      correlationId,
      outcome,
      revision: caseRecord.revision,
      occurredAt: caseRecord.updatedAt,
    });
  }

  async #commitWrite({
    operation,
    candidate,
    expectedRevision = null,
    metadata,
    eventType,
    actor,
  }) {
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      const event = this.#buildEvent({
        eventType,
        caseRecord: candidate,
        actor,
        idempotencyKey: metadata.idempotencyKey,
      });
      return this.repository.commitWithEvent({
        operation,
        record: candidate,
        expectedRevision,
        idempotencyKey: metadata.idempotencyKey,
        requestHash: metadata.requestHash,
        event,
      });
    }
    const stored = operation === 'create'
      ? await this.repository.create(candidate, metadata)
      : await this.repository.save(candidate, { expectedRevision, ...metadata });
    await this.eventSink.emit(this.#buildEvent({
      eventType,
      caseRecord: stored,
      actor,
      idempotencyKey: metadata.idempotencyKey,
    }));
    return stored;
  }

  async createCase(input = {}) {
    const request = assertPlainObject(input, 'case create input');
    const unexpectedKeys = Object.keys(request).filter((key) => !['actor', 'idempotencyKey'].includes(key));
    if (unexpectedKeys.length > 0) {
      throw new ValidationError('Recommendation case and protected identifiers are server-generated');
    }
    const { actor, idempotencyKey } = request;
    assertStudentActor(actor);
    if (typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      throw new ValidationError('Every write requires an idempotency key');
    }
    const entitlement = await this.#entitlement(actor.id);
    const decision = evaluateStudentEntitlement(entitlement, {
      studentId: actor.id,
      requireCanary: this.requireCanary,
    });
    if (!decision.allowed) throw new AuthorizationDeniedError(decision.reasonCode);
    const creationRequestHash = hashValue({ operation: 'case.create', actorId: actor.id, payload: {} });
    const proposedCaseId = this.caseIdFactory({ actorId: actor.id, idempotencyKey });
    assertNonEmptyString(proposedCaseId, 'caseId', { maxLength: 200 });
    const proposedBuilderSessionId = makeId('builder', this.protectedIdFactory);
    const proposedCreatedAt = toIso(this.clock(), 'case createdAt');
    const reservation = await this.repository.reserveCaseCreation({
      actorId: actor.id,
      idempotencyKey,
      requestHash: creationRequestHash,
      proposedIdentifiers: {
        caseId: proposedCaseId,
        builderSessionId: proposedBuilderSessionId,
        createdAt: proposedCreatedAt,
      },
    });
    const caseId = assertNonEmptyString(reservation?.caseId, 'reserved caseId', { maxLength: 200 });
    const builderSessionId = assertNonEmptyString(
      reservation?.builderSessionId,
      'reserved builderSessionId',
      { maxLength: 200 },
    );
    const createdAt = toIso(reservation?.createdAt, 'reserved createdAt');
    const metadata = requestMetadata('case.create', caseId, actor.id, idempotencyKey, {});
    const caseRecord = buildRecommendationCase({
      id: caseId,
      studentId: actor.id,
      actorId: actor.id,
      now: createdAt,
      builderSessionId,
    });
    return this.#commitWrite({
      operation: 'create',
      candidate: caseRecord,
      metadata,
      eventType: 'case.created',
      actor,
    });
  }

  async autosaveBuilder({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    stepId,
    stepData,
  }) {
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    authorizeCaseAction({
      actor,
      action: 'write_builder',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    const metadata = requestMetadata(
      'builder.autosave',
      caseId,
      actor.id,
      idempotencyKey,
      { stepId, stepData },
    );
    const next = autosaveBuilderStep(current, {
      actorId: actor.id,
      stepId,
      stepData,
      now: this.clock(),
    });
    return this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: 'builder.autosaved',
      actor,
    });
  }

  async completeBuilderStep({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    stepId,
  }) {
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    authorizeCaseAction({
      actor,
      action: 'write_builder',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    const metadata = requestMetadata(
      'builder.complete_step',
      caseId,
      actor.id,
      idempotencyKey,
      { stepId },
    );
    const next = completeBuilderStep(current, {
      actorId: actor.id,
      stepId,
      now: this.clock(),
    });
    return this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: 'builder.step_completed',
      actor,
    });
  }

  async recordReceipt({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    receiptType,
    receipt,
  }) {
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    authorizeCaseAction({
      actor,
      action: 'record_receipt',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    if (receipt.caseId !== caseId || receipt.actorId !== actor.id) {
      throw new AuthorizationDeniedError('RECEIPT_RESOURCE_BINDING_MISMATCH');
    }
    const metadata = requestMetadata(
      `${receiptType}.record`,
      caseId,
      actor.id,
      idempotencyKey,
      { receiptType, receiptHash: receipt.receiptHash },
    );
    const next = appendReceipt(current, {
      actorId: actor.id,
      receiptType,
      receipt,
      now: this.clock(),
    });
    return this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: `${receiptType}.recorded`,
      actor,
    });
  }

  async resumeBuilder({ caseId, actor }) {
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    authorizeCaseAction({
      actor,
      action: 'read_student_projection',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    return Object.freeze({
      progress: builderProgress(current),
      projection: projectCaseForActor({
        actor,
        caseRecord: current,
        entitlement,
        requireCanary: this.requireCanary,
      }),
    });
  }

  async getCaseProjection({ caseId, actor, serviceGrant = null }) {
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    return projectCaseForActor({
      actor,
      caseRecord: current,
      entitlement,
      serviceGrant,
      requireCanary: this.requireCanary,
      now: this.clock(),
    });
  }
}
