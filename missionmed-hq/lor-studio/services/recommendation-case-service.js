import { AuthorizationDeniedError, ValidationError } from '../domain/errors.js';
import {
  appendReceipt,
  appendStudentSafeReceipt,
  assertFacultyCaseProjection,
  assertMentorCaseProjection,
  assertStudentSafeRecommendationCase,
  autosaveBuilderStep,
  autosaveStudentSafeBuilderStep,
  completeBuilderStep,
  completeStudentSafeBuilderStep,
  createRecommendationCaseVersionEntry,
  createRecommendationCase,
  createStudentSafeRecommendationCase,
  projectStudentSafeCase,
  releaseFinalDocument,
  studentSafeBuilderProgress,
  toStudentSafeRecommendationCase,
} from '../domain/recommendation-case.js';
import { createConsentReceipt, createWaiverReceipt } from '../domain/receipts.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  hashValue,
  makeId,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import {
  assertTrustedStudentAuthorization,
  authorizeCaseAction,
  projectCaseForActor,
  resolveTrustedStudentAuthorization,
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
 * @typedef {{
 *   id?: string,
 *   caseId: string,
 *   studentId: string,
 *   scopes: unknown,
 *   policyVersion: unknown,
 *   recordedAt?: Date | string | number,
 * }} ConsentReceiptInput
 */

/**
 * @typedef {{
 *   id?: string,
 *   caseId: string,
 *   studentId: string,
 *   waived: unknown,
 *   policyVersion: unknown,
 *   priorReceiptId?: unknown,
 *   acknowledgment: unknown,
 *   recordedAt?: Date | string | number,
 * }} WaiverReceiptInput
 */

/**
 * @type {(input: RecommendationCaseInput) => ReturnType<typeof createRecommendationCase>}
 */
const buildRecommendationCase = createRecommendationCase;

/**
 * @type {(input: ConsentReceiptInput) => ReturnType<typeof createConsentReceipt>}
 */
const buildConsentReceipt = createConsentReceipt;

/**
 * @type {(input: WaiverReceiptInput) => ReturnType<typeof createWaiverReceipt>}
 */
const buildWaiverReceipt = createWaiverReceipt;

/**
 * @type {(prefix: string, idFactory?: () => string) => string}
 */
const buildId = makeId;

function assertStudentActor(actor) {
  if (!actor || actor.role !== 'student' || typeof actor.id !== 'string' || actor.id.length === 0) {
    throw new AuthorizationDeniedError('STUDENT_ACTOR_REQUIRED');
  }
}

function assertMentorActor(actor) {
  if (!actor || actor.role !== 'mentor' || typeof actor.id !== 'string' || actor.id.length === 0) {
    throw new AuthorizationDeniedError('MENTOR_ACTOR_REQUIRED');
  }
}

function assertFacultyActor(actor) {
  if (
    !actor
    || actor.role !== 'faculty'
    || typeof actor.id !== 'string'
    || !/^wp:[1-9][0-9]*$/u.test(actor.id)
  ) {
    throw new AuthorizationDeniedError('FACULTY_ACTOR_REQUIRED');
  }
}

// The only receipt fields a client is permitted to assert. Receipt identity, the recorded
// timestamp, the owning case, the acting principal, and the integrity hash are all minted
// server-side: a client that could choose them could backdate a FERPA waiver, forge a
// supersession chain, or re-file a decision the student already replaced.
const CLIENT_SUPPLIED_RECEIPT_FIELDS = new Map([
  ['consent', Object.freeze(['policyVersion', 'scopes'])],
  ['waiver', Object.freeze(['acknowledgment', 'policyVersion', 'priorReceiptId', 'waived'])],
]);

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
      if (repository.actorSafeCommands !== true) {
        throw new TypeError('Durable repositories must declare actorSafeCommands=true');
      }
      this.repository = assertPort(
        repository,
        [
          'reserveCaseCreation',
          'readStudentSafeCase',
          'commitStudentCaseCreate',
          'commitStudentBuilderAutosave',
          'commitStudentBuilderComplete',
          'commitStudentConsentReceipt',
          'commitStudentWaiverReceipt',
          'readFacultyCaseProjection',
          'commitFacultyFinalDocumentRelease',
          'readMentorCaseProjection',
          'getById',
          'commitWithEvent',
        ],
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

  async #trustedStudentAuthorization(studentId) {
    const entitlement = await this.#entitlement(studentId);
    const authorization = resolveTrustedStudentAuthorization(entitlement, {
      studentId,
      requireCanary: this.requireCanary,
    });
    return { entitlement, authorization };
  }

  async #readStudentSafeCase({ caseId, actor }) {
    assertStudentActor(actor);
    const { entitlement, authorization } = await this.#trustedStudentAuthorization(actor.id);
    let state;
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      state = await this.repository.readStudentSafeCase({
        caseId,
        studentId: actor.id,
        studentAccessAuthorization: authorization,
      });
      assertStudentSafeRecommendationCase(state);
    } else {
      // Explicitly limited to the NON_DURABLE_TEST_ONLY adapter. Production cannot reach this
      // branch because durable construction requires actorSafeCommands=true and the exact safe
      // repository methods above.
      state = toStudentSafeRecommendationCase(await this.repository.getById(caseId));
    }
    if (state.id !== caseId || state.studentId !== actor.id) {
      throw new AuthorizationDeniedError('CASE_OWNERSHIP_MISMATCH');
    }
    authorizeCaseAction({
      actor,
      action: 'read_student_projection',
      caseRecord: state,
      entitlement,
      requireCanary: this.requireCanary,
    });
    return { state, entitlement, authorization };
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
    // Fail closed before the write. The durable branch above mints its metadata event first, so a
    // write whose event the metadata vocabulary refuses can never reach durable storage. This
    // branch has to refuse in the same order: minting the event only after the save would leave
    // committed state that no event describes - `durable_state_before_event` (ports.js:16) in
    // reverse - and for a final-document release that unrecorded state is the student's sight of
    // the letter. The event is rebuilt from the stored result below so a replayed write still
    // reports the revision that was actually persisted.
    this.#buildEvent({
      eventType,
      caseRecord: candidate,
      actor,
      idempotencyKey: metadata.idempotencyKey,
    });
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

  async #commitStudentSafe({
    method,
    candidate,
    versionEntry,
    expectedRevision = undefined,
    metadata,
    eventType,
    actor,
    authorization,
    receipt = undefined,
  }) {
    if (this.persistenceMode !== 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      throw new TypeError('Actor-safe commits are a durable repository operation');
    }
    assertStudentSafeRecommendationCase(candidate);
    assertTrustedStudentAuthorization(authorization);
    const event = this.#buildEvent({
      eventType,
      caseRecord: candidate,
      actor,
      idempotencyKey: metadata.idempotencyKey,
    });
    const command = {
      state: candidate,
      idempotencyKey: metadata.idempotencyKey,
      requestHash: metadata.requestHash,
      event,
      versionEntry,
      studentWriteAuthorization: authorization,
    };
    if (expectedRevision !== undefined) command.expectedRevision = expectedRevision;
    if (receipt !== undefined) command.receipt = receipt;
    const stored = await this.repository[method](command);
    assertStudentSafeRecommendationCase(stored);
    if (stored.id !== candidate.id || stored.studentId !== candidate.studentId) {
      throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
    }
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
    const { authorization } = await this.#trustedStudentAuthorization(actor.id);
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
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      const { state, versionEntry } = createStudentSafeRecommendationCase({
        id: caseId,
        studentId: actor.id,
        actorId: actor.id,
        now: new Date(createdAt),
        builderSessionId,
      });
      return this.#commitStudentSafe({
        method: 'commitStudentCaseCreate',
        candidate: state,
        versionEntry,
        metadata,
        eventType: 'case.created',
        actor,
        authorization,
      });
    }
    const caseRecord = buildRecommendationCase({
      id: caseId,
      studentId: actor.id,
      actorId: actor.id,
      now: createdAt,
      builderSessionId,
    });
    const stored = await this.#commitWrite({
      operation: 'create',
      candidate: caseRecord,
      metadata,
      eventType: 'case.created',
      actor,
    });
    return toStudentSafeRecommendationCase(stored);
  }

  async autosaveBuilder({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    stepId,
    stepData,
  }) {
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      const { state: current, entitlement, authorization } = await this.#readStudentSafeCase({
        caseId,
        actor,
      });
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
      // An exact idempotency replay may arrive after later revisions have committed. The
      // database receipt is authoritative and must be consulted before stale-candidate checks;
      // sending the current safe DTO lets the command function perform that lookup without
      // hydrating protected history. A different key has no receipt and is rejected stale inside
      // the same command function before any mutation.
      if (
        Number.isSafeInteger(expectedRevision)
        && expectedRevision >= 0
        && current.revision > expectedRevision
      ) {
        return this.#commitStudentSafe({
          method: 'commitStudentBuilderAutosave',
          candidate: current,
          versionEntry: createRecommendationCaseVersionEntry({
            revision: current.revision,
            eventType: 'builder.autosaved',
            actorId: actor.id,
            occurredAt: current.updatedAt,
            changes: { builder: current.builder },
          }),
          expectedRevision,
          metadata,
          eventType: 'builder.autosaved',
          actor,
          authorization,
        });
      }
      const { state, versionEntry } = autosaveStudentSafeBuilderStep(current, {
        actorId: actor.id,
        stepId,
        stepData,
        now: this.clock(),
      });
      return this.#commitStudentSafe({
        method: 'commitStudentBuilderAutosave',
        candidate: state,
        versionEntry,
        expectedRevision,
        metadata,
        eventType: 'builder.autosaved',
        actor,
        authorization,
      });
    }
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
    const stored = await this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: 'builder.autosaved',
      actor,
    });
    return toStudentSafeRecommendationCase(stored);
  }

  async completeBuilderStep({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    stepId,
  }) {
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      const { state: current, entitlement, authorization } = await this.#readStudentSafeCase({
        caseId,
        actor,
      });
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
      // An exact retry can read any later committed revision, so running the mutation again would
      // reject the already-completed step before the repository could consult its idempotency
      // receipt. Reconstruct only a metadata candidate and let the database distinguish the same
      // key (replay) from a new key (stale revision). No protected history is needed to do so.
      if (
        Number.isSafeInteger(expectedRevision)
        && expectedRevision >= 0
        && current.revision > expectedRevision
        && current.builder.completedStepIds.includes(stepId)
      ) {
        return this.#commitStudentSafe({
          method: 'commitStudentBuilderComplete',
          candidate: current,
          versionEntry: createRecommendationCaseVersionEntry({
            revision: current.revision,
            eventType: 'builder.step_completed',
            actorId: actor.id,
            occurredAt: current.updatedAt,
            changes: { builder: current.builder },
          }),
          expectedRevision,
          metadata,
          eventType: 'builder.step_completed',
          actor,
          authorization,
        });
      }
      const { state, versionEntry } = completeStudentSafeBuilderStep(current, {
        actorId: actor.id,
        stepId,
        now: this.clock(),
      });
      return this.#commitStudentSafe({
        method: 'commitStudentBuilderComplete',
        candidate: state,
        versionEntry,
        expectedRevision,
        metadata,
        eventType: 'builder.step_completed',
        actor,
        authorization,
      });
    }
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
    const stored = await this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: 'builder.step_completed',
      actor,
    });
    return toStudentSafeRecommendationCase(stored);
  }

  /**
   * Narrow an untrusted receipt payload to the fields a client may assert.
   *
   * @param {unknown} receiptType
   * @param {unknown} receiptData
   */
  #assertClientReceiptFields(receiptType, receiptData) {
    const allowed = CLIENT_SUPPLIED_RECEIPT_FIELDS.get(
      typeof receiptType === 'string' ? receiptType : '',
    );
    if (!allowed) throw new ValidationError('Unknown receipt type');
    const input = assertPlainObject(receiptData, 'receipt data');
    const unexpectedKeys = Object.keys(input).filter((key) => !allowed.includes(key));
    if (unexpectedKeys.length > 0) {
      throw new ValidationError('Receipt identity, timestamps, and integrity hashes are server-generated');
    }
    return input;
  }

  /**
   * Derive a receipt identifier from the request that asks for it.
   *
   * Receipts live in an append-only log with no identifier ledger of its own, so a random ID
   * would make an interrupted retry indistinguishable from a second decision: the consent log
   * would grow a duplicate entry, and a waiver retry would fail closed on the supersession chain
   * with no way for the student to clear it. Deriving the ID from the case, the principal, the
   * idempotency key, and the asserted payload means the same request re-derives the same
   * identifier while any change of intent derives a different one.
   *
   * @param {{ caseId: string, actorId: string, idempotencyKey: string, receiptType: string, input: Record<string, unknown> }} request
   */
  #deriveReceiptId({ caseId, actorId, idempotencyKey, receiptType, input }) {
    return buildId(receiptType, () => hashValue({
      operation: `${receiptType}.record`,
      caseId,
      actorId,
      idempotencyKey,
      receiptData: input,
    }));
  }

  /**
   * @param {{ id: string, caseId: string, studentId: string, receiptType: string, input: Record<string, unknown> }} request
   */
  #mintReceipt({ id, caseId, studentId, receiptType, input }) {
    const recordedAt = toIso(this.clock(), 'receipt recordedAt');
    if (receiptType === 'consent') {
      return buildConsentReceipt({
        id,
        caseId,
        studentId,
        scopes: input.scopes,
        policyVersion: input.policyVersion,
        recordedAt,
      });
    }
    return buildWaiverReceipt({
      id,
      caseId,
      studentId,
      waived: input.waived,
      policyVersion: input.policyVersion,
      // Never inferred from the tail of the chain. A waiver decision may only be replaced by a
      // request that names the receipt it replaces, so a stale client cannot silently flip a
      // decision it never saw.
      priorReceiptId: input.priorReceiptId ?? null,
      acknowledgment: input.acknowledgment,
      recordedAt,
    });
  }

  async recordReceipt({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    receiptType,
    receiptData,
  }) {
    const input = this.#assertClientReceiptFields(receiptType, receiptData);
    let current;
    let entitlement;
    let authorization = null;
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      ({ state: current, entitlement, authorization } = await this.#readStudentSafeCase({
        caseId,
        actor,
      }));
    } else {
      current = await this.repository.getById(caseId);
      entitlement = await this.#entitlement(current.studentId);
    }
    authorizeCaseAction({
      actor,
      action: 'record_receipt',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    const metadata = requestMetadata(
      `${receiptType}.record`,
      caseId,
      actor.id,
      idempotencyKey,
      { receiptType, receiptData: input },
    );
    const receiptId = this.#deriveReceiptId({
      caseId: current.id,
      actorId: actor.id,
      idempotencyKey: metadata.idempotencyKey,
      receiptType,
      input,
    });
    const field = receiptType === 'consent' ? 'consentReceipts' : 'waiverReceipts';
    if (current[field].some((recorded) => recorded.id === receiptId)) {
      // This exact request already landed in the append-only log. Replaying it must neither
      // append a second decision nor fail the student closed on a chain rule it already
      // satisfied, so the committed record is returned unchanged and no second event is emitted.
      return this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT'
        ? current
        : toStudentSafeRecommendationCase(current);
    }
    const receipt = this.#mintReceipt({
      id: receiptId,
      caseId: current.id,
      studentId: actor.id,
      receiptType,
      input,
    });
    if (receipt.caseId !== caseId || receipt.actorId !== actor.id) {
      throw new AuthorizationDeniedError('RECEIPT_RESOURCE_BINDING_MISMATCH');
    }
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      const { state, versionEntry } = appendStudentSafeReceipt(current, {
        actorId: actor.id,
        receiptType,
        receipt,
        now: this.clock(),
      });
      return this.#commitStudentSafe({
        method: receiptType === 'consent'
          ? 'commitStudentConsentReceipt'
          : 'commitStudentWaiverReceipt',
        candidate: state,
        versionEntry,
        expectedRevision,
        metadata,
        eventType: `${receiptType}.recorded`,
        actor,
        authorization,
        receipt,
      });
    }
    const next = appendReceipt(current, {
      actorId: actor.id,
      receiptType,
      receipt,
      now: this.clock(),
    });
    const stored = await this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: `${receiptType}.recorded`,
      actor,
    });
    return toStudentSafeRecommendationCase(stored);
  }

  /**
   * Release the approved final document to the student.
   *
   * This is the only operation that can grant a student sight of the letter, so every fact it
   * turns on is resolved server-side: the acting principal from the authenticated actor, the
   * recipient binding and the document itself from the stored case, the release timestamp from
   * the service clock, and `releasedToStudentAt` from the aggregate's own release record. A
   * request contributes exactly two things - the revision the caller reasoned about, and the
   * document that revision names - and neither can widen who may see the letter.
   *
   * Authorisation is the existing `release_letter` case action, which the policy already binds to
   * the recipient-verified faculty writer (authorization-policy.js:37-42,176-185); the aggregate
   * then re-checks that binding rather than trusting this layer.
   *
   * @param {{
   *   caseId: string,
   *   actor: { id: string, role: string },
   *   expectedRevision: unknown,
   *   idempotencyKey: string,
   *   documentId: unknown,
   * }} input
   */
  async releaseFinalDocument({
    caseId,
    actor,
    expectedRevision,
    idempotencyKey,
    documentId,
  }) {
    if (this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT') {
      assertFacultyActor(actor);
      assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
      assertNonEmptyString(documentId, 'documentId', { maxLength: 200 });
      if (
        typeof expectedRevision !== 'number'
        || !Number.isSafeInteger(expectedRevision)
        || expectedRevision < 0
      ) {
        throw new ValidationError('expectedRevision must be a non-negative integer');
      }
      const releaseRevision = /** @type {number} */ (expectedRevision);
      const releaseDocumentId = /** @type {string} */ (documentId);
      const metadata = requestMetadata(
        'faculty.final_document_release',
        caseId,
        actor.id,
        idempotencyKey,
        { documentId: releaseDocumentId },
      );
      const event = buildMetadataServiceEvent({
        eventId: `event_${sha256(`${caseId}:faculty.final_document_released:${metadata.idempotencyKey}`).slice(0, 32)}`,
        eventType: 'faculty.final_document_released',
        caseId,
        actorId: actor.id,
        actorRole: 'faculty',
        correlationId: sha256(metadata.idempotencyKey).slice(0, 32),
        revision: releaseRevision + 1,
        occurredAt: toIso(this.clock(), 'faculty release occurredAt'),
      });
      const stored = await this.repository.commitFacultyFinalDocumentRelease({
        caseId,
        actorId: actor.id,
        expectedRevision: releaseRevision,
        documentId: releaseDocumentId,
        idempotencyKey: metadata.idempotencyKey,
        requestHash: metadata.requestHash,
        event,
      });
      assertFacultyCaseProjection(stored);
      if (stored.caseId !== caseId) {
        throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
      }
      return stored;
    }
    const current = await this.repository.getById(caseId);
    const entitlement = await this.#entitlement(current.studentId);
    authorizeCaseAction({
      actor,
      action: 'release_letter',
      caseRecord: current,
      entitlement,
      requireCanary: this.requireCanary,
    });
    const metadata = requestMetadata(
      'faculty.final_document_release',
      caseId,
      actor.id,
      idempotencyKey,
      { documentId },
    );
    // facultyId is never client-asserted: it is the authenticated principal the policy above just
    // bound to this case's verified invitation, and the aggregate checks that binding again.
    const next = releaseFinalDocument(current, {
      actorId: actor.id,
      facultyId: actor.id,
      caseId: current.id,
      documentId: /** @type {string} */ (documentId),
      expectedRevision: /** @type {number} */ (expectedRevision),
      now: this.clock(),
    });
    if (next === current) {
      // The aggregate recognised this as a replay of the release it already recorded and returned
      // the committed record untouched. Honour that: a retry must not mint a second revision, a
      // second release timestamp, or a second event, exactly as a replayed receipt does not.
      return current;
    }
    return this.#commitWrite({
      operation: 'save',
      candidate: next,
      expectedRevision,
      metadata,
      eventType: 'faculty.final_document_released',
      actor,
    });
  }

  async resumeBuilder({ caseId, actor }) {
    const { state } = await this.#readStudentSafeCase({ caseId, actor });
    return Object.freeze({
      progress: studentSafeBuilderProgress(state),
      projection: projectStudentSafeCase(state),
    });
  }

  async getCaseProjection({ caseId, actor, serviceGrant = null }) {
    if (actor?.role === 'student') {
      const { state } = await this.#readStudentSafeCase({ caseId, actor });
      return projectStudentSafeCase(state);
    }
    if (
      actor?.role === 'faculty'
      && this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT'
    ) {
      assertFacultyActor(actor);
      const projection = await this.repository.readFacultyCaseProjection({
        caseId,
        actorId: actor.id,
      });
      assertFacultyCaseProjection(projection);
      if (projection.caseId !== caseId) {
        throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
      }
      return Object.freeze(structuredClone(projection));
    }
    if (
      actor?.role === 'mentor'
      && this.persistenceMode === 'DURABLE_ATOMIC_STATE_AND_EVENT'
    ) {
      assertMentorActor(actor);
      const projection = await this.repository.readMentorCaseProjection({
        caseId,
        actorId: actor.id,
      });
      assertMentorCaseProjection(projection);
      if (projection.caseId !== caseId) {
        throw new AuthorizationDeniedError('CASE_SUBJECT_SCOPE_MISMATCH');
      }
      // The repository/SQL boundary stays the exact five-field mentor DTO. The established HTTP
      // hydration transport still uses schemaVersion to select its role-specific renderer, so the
      // service adds that transport discriminator only after the exact DB result is validated.
      return Object.freeze({
        schemaVersion: 'missionmed.lor.mentor-projection.v1',
        ...structuredClone(projection),
      });
    }
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
