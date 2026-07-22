import crypto from 'node:crypto';

import {
  MMC_MENTOR_COMMAND_KINDS,
  mentorCommandIdempotencyScope,
  mentorCommandSemanticHash,
  validateMentorCommandEnvelope,
  validateMentorCommandResult,
} from '../contracts/mentor-query-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';
import { isMmcAssignmentEffective } from '../trust/assignment-authority.mjs';

export const MENTOR_COMMAND_OWNER_BY_KIND = Object.freeze({
  'session.start': 'mentor_session_owner',
  'capture.save': 'mentor_capture_owner',
  'session.pause': 'mentor_session_owner',
  'session.resume': 'mentor_session_owner',
  'session.end_for_review': 'mentor_session_owner',
  'review.decide': 'mentor_review_owner',
  'attention.defer': 'mentor_attention_owner',
  'attention.dismiss': 'mentor_attention_owner',
  'plan.update': 'mentor_plan_owner',
  'commitment.upsert': 'mentor_commitment_owner',
  'task.upsert': 'mentor_task_owner',
});

const CAPABILITY_BY_KIND = Object.freeze({
  'session.start': MMC_CAPABILITIES.COMMAND,
  'capture.save': MMC_CAPABILITIES.COMMAND,
  'session.pause': MMC_CAPABILITIES.COMMAND,
  'session.resume': MMC_CAPABILITIES.COMMAND,
  'session.end_for_review': MMC_CAPABILITIES.COMMAND,
  'review.decide': MMC_CAPABILITIES.REVIEW,
  'attention.defer': MMC_CAPABILITIES.COMMAND,
  'attention.dismiss': MMC_CAPABILITIES.COMMAND,
  'plan.update': MMC_CAPABILITIES.COMMAND,
  'commitment.upsert': MMC_CAPABILITIES.COMMAND,
  'task.upsert': MMC_CAPABILITIES.COMMAND,
});

const TARGET_BY_KIND = Object.freeze({
  'session.start': Object.freeze({ collection: 'sessions', aggregateKind: 'SESSION' }),
  'capture.save': Object.freeze({ collection: 'captures', aggregateKind: 'CAPTURE' }),
  'session.pause': Object.freeze({ collection: 'sessions', aggregateKind: 'SESSION' }),
  'session.resume': Object.freeze({ collection: 'sessions', aggregateKind: 'SESSION' }),
  'session.end_for_review': Object.freeze({ collection: 'sessions', aggregateKind: 'SESSION' }),
  'review.decide': Object.freeze({ collection: 'reviews', aggregateKind: 'PROPOSAL' }),
  'attention.defer': Object.freeze({ collection: 'attentions', aggregateKind: 'ATTENTION' }),
  'attention.dismiss': Object.freeze({ collection: 'attentions', aggregateKind: 'ATTENTION' }),
  'plan.update': Object.freeze({ collection: 'plans', aggregateKind: 'PLAN' }),
  'commitment.upsert': Object.freeze({ collection: 'commitments', aggregateKind: 'COMMITMENT' }),
  'task.upsert': Object.freeze({ collection: 'tasks', aggregateKind: 'TASK' }),
});

const OWNER_HANDLERS = Object.freeze({
  'session.start': startSession,
  'capture.save': saveCapture,
  'session.pause': pauseSession,
  'session.resume': resumeSession,
  'session.end_for_review': endSessionForReview,
  'review.decide': decideReview,
  'attention.defer': deferAttention,
  'attention.dismiss': dismissAttention,
  'plan.update': updatePlan,
  'commitment.upsert': upsertCommitment,
  'task.upsert': upsertTask,
});

assertCompleteOwnerVocabulary();

export class MentorCommandService {
  #repository;
  #idFactory;

  constructor({ repository, idFactory } = {}) {
    if (!repository || typeof repository.transaction !== 'function') {
      throw new TypeError('MentorCommandService requires a shared mentor repository.');
    }
    this.#repository = repository;
    this.#idFactory = idFactory || (() => crypto.randomUUID());
  }

  get repository() {
    return this.#repository;
  }

  async execute(commandInput, context = {}) {
    const command = validateMentorCommandEnvelope(commandInput);
    const principal = requireMentorPrincipal(context.principal);
    const scopeKey = mentorCommandIdempotencyScope(command, principal);
    const semanticHash = mentorCommandSemanticHash(command);
    const commandIdentityKey = [principal.tenantId, principal.environment, command.commandId].join('\u001f');
    const correlationId = requireCorrelationId(context.correlationId || `corr_${this.#idFactory()}`);

    return this.#repository.transaction(async (draft, nowDate) => {
      verifyAuditChain(draft.audit, principal.tenantId, principal.environment);
      const now = nowDate.toISOString();
      authorizeMentorCommand(draft, principal, command, nowDate);

      const target = TARGET_BY_KIND[command.kind];
      const collection = draft[target.collection];
      const current = collection.get(command.targetId) || null;
      if (current) {
        authorizeExistingMentorTarget(draft, principal, current, nowDate);
      } else if (command.expectedVersion !== 0) {
        resourceNotFound();
      }

      const commandIdentity = draft.commandIds.get(commandIdentityKey);
      if (commandIdentity) {
        if (commandIdentity.semanticHash !== semanticHash) {
          throw conflict('MENTOR_COMMAND_ID_PAYLOAD_MISMATCH', 'This command identifier is bound to different semantics.');
        }
        if (commandIdentity.scopeKey !== scopeKey) {
          throw conflict('MENTOR_COMMAND_ID_SCOPE_MISMATCH', 'This command identifier is bound to another idempotency scope.');
        }
        return replayResult(commandIdentity.result);
      }

      const receipt = draft.receipts.get(scopeKey);
      if (receipt) {
        if (receipt.semanticHash !== semanticHash) {
          throw conflict('MENTOR_IDEMPOTENCY_PAYLOAD_MISMATCH', 'This idempotency key is bound to different command semantics.');
        }
        if (receipt.commandId !== command.commandId) {
          throw conflict('MENTOR_IDEMPOTENCY_COMMAND_ID_MISMATCH', 'This idempotency key is bound to another command identifier.');
        }
        return replayResult(receipt.result);
      }

      const currentVersion = current?.version || 0;
      if (command.expectedVersion !== currentVersion) {
        throw new MmcHttpError(409, 'VERSION_CONFLICT',
          'The target version changed. Compare the current version and reapply the intended command.', {
            details: {
              expectedVersion: command.expectedVersion,
              currentVersion,
              resolution: 'COMPARE_AND_REAPPLY',
            },
          });
      }

      const version = currentVersion + 1;
      const aggregate = await OWNER_HANDLERS[command.kind]({
        command,
        principal,
        current: current ? structuredClone(current) : null,
        draft,
        now,
        version,
      });
      validateOwnerAggregate(aggregate, command, target, version);
      authorizeMentorCommand(draft, principal, command, nowDate, aggregate);

      collection.set(command.targetId, deepFreeze({
        ...aggregate,
        createdAt: aggregate.createdAt || current?.createdAt || now,
        updatedAt: now,
      }));
      const sideEffects = applyCommandSideEffects({ command, draft, aggregate: collection.get(command.targetId), now });

      const auditId = `audit_${this.#idFactory()}`;
      const previousAudit = lastScopedAudit(draft.audit, principal.tenantId, principal.environment);
      const audit = {
        id: auditId,
        tenantId: principal.tenantId,
        environment: principal.environment,
        sequence: (previousAudit?.sequence || 0) + 1,
        previousEventDigest: previousAudit?.eventDigest || null,
        principalId: principal.id,
        effectiveRole: principal.role,
        subjectLinkId: aggregate.subjectLinkId,
        assignmentId: aggregate.assignmentId,
        commandId: command.commandId,
        commandKind: command.kind,
        owner: MENTOR_COMMAND_OWNER_BY_KIND[command.kind],
        purpose: command.purpose,
        targetId: command.targetId,
        targetVersion: version,
        semanticHash,
        beforeHash: current ? hashValue(current) : null,
        afterHash: hashValue({ primary: aggregate, sideEffects }),
        outcome: 'COMMITTED',
        correlationId,
        occurredAt: now,
      };
      audit.eventDigest = hashValue(audit);
      draft.audit.push(deepFreeze(audit));
      draft.outbox.push(deepFreeze({
        id: `event_${this.#idFactory()}`,
        tenantId: principal.tenantId,
        environment: principal.environment,
        topic: `mmc.mentor.${command.kind}`,
        aggregateId: command.targetId,
        aggregateKind: target.aggregateKind,
        aggregateVersion: version,
        commandId: command.commandId,
        deliveryState: 'LOCAL_ONLY_NO_DISPATCH',
        createdAt: now,
      }));
      draft.meta.version += 1;

      const committed = collection.get(command.targetId);
      const objectResults = [
        { id: command.targetId, kind: target.aggregateKind, version },
        ...sideEffects.map((entry) => ({ id: entry.id, kind: entry.kind, version: entry.version })),
      ];
      const result = deepFreeze({
        ok: true,
        status: 'COMMITTED',
        commandId: command.commandId,
        aggregateVersion: version,
        objectResults,
        auditId,
        correlationId,
        replayed: false,
        readback: buildReadback(committed, target.aggregateKind),
      });
      validateMentorCommandResult(result);
      draft.receipts.set(scopeKey, deepFreeze({
        scopeKey,
        semanticHash,
        commandId: command.commandId,
        result,
        createdAt: now,
      }));
      draft.commandIds.set(commandIdentityKey, deepFreeze({
        commandId: command.commandId,
        scopeKey,
        semanticHash,
        result,
        createdAt: now,
      }));
      return result;
    });
  }
}

export function createMentorOwnerHandlers() {
  return OWNER_HANDLERS;
}

function startSession({ command, principal, current, draft, now, version }) {
  if (current) throw conflict('SESSION_ALREADY_EXISTS', 'This session already exists.');
  const assignment = requireActiveAssignment(draft, principal, command.payload.subjectLinkId, now);
  const active = [...draft.sessions.values()].find((session) => (
    session.mentorPrincipalId === assignment.mentorPrincipalId
      && session.status === 'ACTIVE'
      && session.id !== command.targetId
  ));
  if (active) {
    throw conflict('ACTIVE_SESSION_CONFLICT', 'Pause or end the current active session before starting another.');
  }
  return {
    id: command.targetId,
    kind: 'SESSION',
    tenantId: principal.tenantId,
    environment: principal.environment,
    subjectLinkId: assignment.subjectLinkId,
    assignmentId: assignment.id,
    mentorPrincipalId: assignment.mentorPrincipalId,
    version,
    status: 'ACTIVE',
    objective: command.payload.objective,
    scheduledCallId: command.payload.scheduledCallId || null,
    startedAt: now,
    scheduledAt: null,
    pausedAt: null,
    endedAt: null,
    summary: null,
    pauseReason: null,
    resumeCount: 0,
    persistence: 'SAVED',
    connectivity: 'ONLINE',
    reviewState: 'NOT_REQUIRED',
  };
}

function saveCapture({ command, principal, current, draft, now, version }) {
  const session = requireCommandSession(draft, principal, command.payload.sessionId, command.payload.subjectLinkId, now);
  if (session.status !== 'ACTIVE') {
    throw conflict('SESSION_CAPTURE_NOT_ACTIVE', 'Resume the session before saving a capture.');
  }
  if (current && (current.sessionId !== session.id || current.subjectLinkId !== session.subjectLinkId
      || current.assignmentId !== session.assignmentId)) {
    throw conflict('CAPTURE_SUBJECT_CONTINUITY_CONFLICT', 'A capture cannot move to another session or student.');
  }
  return {
    id: command.targetId,
    kind: 'CAPTURE',
    tenantId: principal.tenantId,
    environment: principal.environment,
    subjectLinkId: session.subjectLinkId,
    assignmentId: session.assignmentId,
    sessionId: session.id,
    version,
    captureKind: command.payload.captureKind,
    text: command.payload.text,
    occurredAt: command.payload.occurredAt || now,
    reviewState: 'REVIEW_REQUIRED',
    visibility: command.payload.captureKind === 'PUBLICATION_CANDIDATE'
      ? 'PUBLICATION_CANDIDATE'
      : 'MENTOR_PRIVATE',
    publicationState: command.payload.captureKind === 'PUBLICATION_CANDIDATE'
      ? 'DRAFT'
      : 'NOT_ELIGIBLE',
    persistence: 'SAVED',
  };
}

function applyCommandSideEffects({ command, draft, aggregate, now }) {
  if (command.kind !== 'capture.save') return [];
  const reviewId = `review_capture_${aggregate.id}`;
  const currentReview = draft.reviews.get(reviewId) || null;
  const review = deepFreeze({
    id: reviewId,
    kind: 'PROPOSAL',
    tenantId: aggregate.tenantId,
    environment: aggregate.environment,
    subjectLinkId: aggregate.subjectLinkId,
    assignmentId: aggregate.assignmentId,
    sessionId: aggregate.sessionId,
    version: (currentReview?.version || 0) + 1,
    queueKind: 'SESSION_CAPTURE',
    label: aggregate.text,
    state: 'OPEN',
    sourceVersion: aggregate.version,
    firstObservedAt: currentReview?.firstObservedAt || now,
    ownerType: 'MENTOR',
    dueAt: null,
    origin: 'OBSERVED',
    freshness: 'CURRENT',
    reviewState: 'REVIEW_REQUIRED',
    decision: null,
    rationale: null,
    editedText: null,
    policyVersionId: 'policy_007_local_review_v1',
    createdAt: currentReview?.createdAt || now,
    updatedAt: now,
  });
  draft.reviews.set(reviewId, review);
  return [review];
}

function pauseSession({ command, principal, current, draft, now, version }) {
  const session = requireCurrentSession(draft, principal, current, command.targetId, now);
  if (session.status !== 'ACTIVE') throw conflict('SESSION_PAUSE_STATE_INVALID', 'Only an active session can be paused.');
  return {
    ...session,
    version,
    status: 'PAUSED',
    pausedAt: now,
    pauseReason: command.payload.reason || null,
    persistence: 'SAVED',
  };
}

function resumeSession({ command, principal, current, draft, now, version }) {
  const session = requireCurrentSession(draft, principal, current, command.targetId, now);
  if (session.status !== 'PAUSED') throw conflict('SESSION_RESUME_STATE_INVALID', 'Only a paused session can be resumed.');
  const otherActive = [...draft.sessions.values()].find((entry) => (
    entry.mentorPrincipalId === session.mentorPrincipalId
      && entry.status === 'ACTIVE'
      && entry.id !== session.id
  ));
  if (otherActive) throw conflict('ACTIVE_SESSION_CONFLICT', 'End or pause the other active session before resuming.');
  return {
    ...session,
    version,
    status: 'ACTIVE',
    pausedAt: null,
    pauseReason: null,
    resumeCount: (session.resumeCount || 0) + 1,
    persistence: 'SAVED',
  };
}

function endSessionForReview({ command, principal, current, draft, now, version }) {
  const session = requireCurrentSession(draft, principal, current, command.targetId, now);
  if (!['ACTIVE', 'PAUSED'].includes(session.status)) {
    throw conflict('SESSION_END_STATE_INVALID', 'Only an active or paused session can enter review.');
  }
  return {
    ...session,
    version,
    status: 'REVIEW_REQUIRED',
    endedAt: now,
    summary: command.payload.summary || session.summary || null,
    reviewState: 'REVIEW_REQUIRED',
    persistence: 'SAVED',
  };
}

function decideReview({ command, principal, current, draft, now, version }) {
  if (!current) resourceNotFound();
  requireActiveAssignment(draft, principal, current.subjectLinkId, now, current.assignmentId);
  if (!['OPEN', 'DEFERRED', 'NEEDS_EVIDENCE'].includes(current.state)) {
    throw conflict('REVIEW_DECISION_STATE_INVALID', 'This review item is no longer awaiting a decision.');
  }
  if (current.policyVersionId && command.payload.policyVersionId !== current.policyVersionId) {
    throw conflict('REVIEW_POLICY_VERSION_CONFLICT', 'The review policy changed. Reload the item before deciding.');
  }
  const stateByDecision = {
    ACCEPT: 'APPROVED',
    REJECT: 'REJECTED',
    DEFER: 'DEFERRED',
    REQUEST_EVIDENCE: 'NEEDS_EVIDENCE',
  };
  const reviewStateByDecision = {
    ACCEPT: 'APPROVED',
    REJECT: 'REJECTED',
    DEFER: 'REVIEW_REQUIRED',
    REQUEST_EVIDENCE: 'REVIEW_REQUIRED',
  };
  return {
    ...current,
    version,
    state: stateByDecision[command.payload.decision],
    reviewState: reviewStateByDecision[command.payload.decision],
    decision: command.payload.decision,
    editedText: command.payload.editedText || null,
    rationale: command.payload.rationale,
    policyVersionId: command.payload.policyVersionId,
    reviewerPrincipalId: principal.id,
    decidedAt: now,
  };
}

function deferAttention(context) {
  return setAttentionDisposition(context, 'DEFERRED');
}

function dismissAttention(context) {
  return setAttentionDisposition(context, 'DISMISSED');
}

function setAttentionDisposition({ command, principal, current, draft, now, version }, disposition) {
  if (!current) resourceNotFound();
  requireActiveAssignment(draft, principal, current.subjectLinkId, now, current.assignmentId);
  if (current.sourceVersion !== command.payload.sourceVersion) {
    throw conflict('ATTENTION_SOURCE_VERSION_CONFLICT', 'The attention source changed. Review the current reason before deciding.');
  }
  if (Date.parse(command.payload.expiresAt) <= Date.parse(now)) {
    throw new MmcHttpError(422, 'ATTENTION_EXPIRY_INVALID', 'The attention decision expiry must be in the future.');
  }
  return {
    ...current,
    version,
    disposition,
    dispositionSourceVersion: command.payload.sourceVersion,
    dispositionReason: command.payload.reason,
    dispositionExpiresAt: command.payload.expiresAt,
    dispositionPrincipalId: principal.id,
  };
}

function updatePlan({ command, principal, current, draft, now, version }) {
  const assignment = requireActiveAssignment(draft, principal, command.payload.subjectLinkId, now);
  assertExistingSubjectContinuity(current, assignment, 'PLAN_SUBJECT_CONTINUITY_CONFLICT');
  return {
    id: command.targetId,
    kind: 'PLAN',
    tenantId: principal.tenantId,
    environment: principal.environment,
    subjectLinkId: assignment.subjectLinkId,
    assignmentId: assignment.id,
    version,
    title: command.payload.title,
    objective: command.payload.objective,
    status: command.payload.status,
    targetDate: command.payload.targetDate || null,
    sourceAuthority: 'HUMAN_JUDGMENT',
  };
}

function upsertCommitment(context) {
  return upsertWork(context, 'COMMITMENT');
}

function upsertTask(context) {
  return upsertWork(context, 'TASK');
}

function upsertWork({ command, principal, current, draft, now, version }, kind) {
  const assignment = requireActiveAssignment(draft, principal, command.payload.subjectLinkId, now);
  assertExistingSubjectContinuity(current, assignment, `${kind}_SUBJECT_CONTINUITY_CONFLICT`);
  return {
    id: command.targetId,
    kind,
    tenantId: principal.tenantId,
    environment: principal.environment,
    subjectLinkId: assignment.subjectLinkId,
    assignmentId: assignment.id,
    version,
    title: command.payload.title,
    details: command.payload.details || null,
    ownerType: command.payload.ownerType,
    dueAt: command.payload.dueAt || null,
    status: command.payload.status,
    sensitivity: command.payload.sensitivity,
    sourceAuthority: 'HUMAN_JUDGMENT',
  };
}

function requireMentorPrincipal(principal) {
  if (!principal || typeof principal !== 'object' || Array.isArray(principal)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_REQUIRED', 'An authenticated MMC principal is required.');
  }
  if (!['mentor', 'admin'].includes(principal.role)) {
    throw new MmcHttpError(403, 'MENTOR_ROLE_REQUIRED', 'Mentor commands require a mentor or admin role.');
  }
  if (!['LOCAL', 'FIXTURE'].includes(principal.environment)) {
    throw new MmcHttpError(503, 'MENTOR_DURABLE_PERSISTENCE_REQUIRED', 'Local mentor commands cannot serve this environment.');
  }
  for (const field of ['id', 'tenantId', 'environment']) {
    if (typeof principal[field] !== 'string' || !principal[field].trim()) {
      throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'The authenticated MMC principal is invalid.');
    }
  }
  return principal;
}

function authorizeMentorCommand(draft, principal, command, now, proposed = null) {
  if (draft.meta.tenantId !== principal.tenantId || draft.meta.environment !== principal.environment) {
    throw new MmcHttpError(403, 'MMC_PRINCIPAL_SCOPE_MISMATCH', 'The authenticated MMC principal scope is invalid.');
  }
  assertCapability(principal, CAPABILITY_BY_KIND[command.kind]);
  const subjectLinkId = proposed?.subjectLinkId || commandSubject(draft, command);
  const assignmentId = proposed?.assignmentId || commandAssignment(draft, command);
  requireActiveAssignment(draft, principal, subjectLinkId, now, assignmentId);
  return true;
}

function authorizeExistingMentorTarget(draft, principal, current, now) {
  if (!current || typeof current.subjectLinkId !== 'string' || typeof current.assignmentId !== 'string') {
    resourceNotFound();
  }
  requireActiveAssignment(draft, principal, current.subjectLinkId, now, current.assignmentId);
  return true;
}

function commandSubject(draft, command) {
  if (command.kind === 'capture.save') return draft.sessions.get(command.payload.sessionId)?.subjectLinkId || resourceNotFound();
  if (command.payload.subjectLinkId) return command.payload.subjectLinkId;
  const target = TARGET_BY_KIND[command.kind];
  return draft[target.collection].get(command.targetId)?.subjectLinkId || resourceNotFound();
}

function commandAssignment(draft, command) {
  if (command.kind === 'session.start' || ['plan.update', 'commitment.upsert', 'task.upsert'].includes(command.kind)) return null;
  if (command.kind === 'capture.save') return draft.sessions.get(command.payload.sessionId)?.assignmentId || resourceNotFound();
  const target = TARGET_BY_KIND[command.kind];
  return draft[target.collection].get(command.targetId)?.assignmentId || resourceNotFound();
}

function requireActiveAssignment(draft, principal, subjectLinkId, now, expectedAssignmentId = null) {
  const scoped = [...draft.assignments.values()].filter((entry) => (
    entry.tenantId === principal.tenantId
      && entry.environment === principal.environment
      && entry.subjectLinkId === subjectLinkId
      && (!expectedAssignmentId || entry.id === expectedAssignmentId)
  ));
  const authorized = principal.role === 'admin'
    ? scoped
    : scoped.filter((entry) => entry.mentorPrincipalId === principal.id);
  if (!authorized.length) resourceNotFound();
  const assignment = authorized.find((entry) => isMmcAssignmentEffective(entry, now)) || authorized[0];
  if (!isMmcAssignmentEffective(assignment, now)) {
    throw new MmcHttpError(403, 'MENTOR_ASSIGNMENT_REVOKED', 'The current mentor assignment is not active or effective.');
  }
  return assignment;
}

function requireCommandSession(draft, principal, sessionId, subjectLinkId, now) {
  const session = draft.sessions.get(sessionId);
  if (!session || session.subjectLinkId !== subjectLinkId) resourceNotFound();
  requireActiveAssignment(draft, principal, session.subjectLinkId, now, session.assignmentId);
  return session;
}

function requireCurrentSession(draft, principal, current, targetId, now) {
  if (!current || current.id !== targetId) resourceNotFound();
  requireActiveAssignment(draft, principal, current.subjectLinkId, now, current.assignmentId);
  return current;
}

function assertExistingSubjectContinuity(current, assignment, code) {
  if (current && (current.subjectLinkId !== assignment.subjectLinkId || current.assignmentId !== assignment.id)) {
    throw conflict(code, 'An existing object cannot move to another student or assignment.');
  }
}

function validateOwnerAggregate(aggregate, command, target, version) {
  if (!aggregate || typeof aggregate !== 'object' || Array.isArray(aggregate)
      || Object.getPrototypeOf(aggregate) !== Object.prototype
      || aggregate.id !== command.targetId
      || aggregate.kind !== target.aggregateKind
      || aggregate.version !== version
      || typeof aggregate.subjectLinkId !== 'string'
      || typeof aggregate.assignmentId !== 'string') {
    throw new MmcHttpError(500, 'MENTOR_OWNER_HANDLER_INVALID', 'The mentor command owner produced an invalid aggregate.');
  }
}

function buildReadback(aggregate, kind) {
  const stateByKind = {
    SESSION: () => ({ status: aggregate.status, persistence: aggregate.persistence, reviewState: aggregate.reviewState }),
    CAPTURE: () => ({ captureKind: aggregate.captureKind, reviewState: aggregate.reviewState, publicationState: aggregate.publicationState }),
    PROPOSAL: () => ({ state: aggregate.state, reviewState: aggregate.reviewState, decision: aggregate.decision }),
    ATTENTION: () => ({ disposition: aggregate.disposition, expiresAt: aggregate.dispositionExpiresAt }),
    PLAN: () => ({ status: aggregate.status, targetDate: aggregate.targetDate }),
    COMMITMENT: () => ({ status: aggregate.status, ownerType: aggregate.ownerType, dueAt: aggregate.dueAt }),
    TASK: () => ({ status: aggregate.status, ownerType: aggregate.ownerType, dueAt: aggregate.dueAt }),
  };
  return deepFreeze({
    id: aggregate.id,
    kind,
    version: aggregate.version,
    subjectLinkId: aggregate.subjectLinkId,
    assignmentId: aggregate.assignmentId,
    state: stateByKind[kind](),
  });
}

function replayResult(result) {
  const replay = deepFreeze({ ...structuredClone(result), replayed: true });
  validateMentorCommandResult(replay);
  return replay;
}

function verifyAuditChain(events, tenantId, environment) {
  let sequence = 0;
  let previousEventDigest = null;
  for (const event of events) {
    if (event.tenantId !== tenantId || event.environment !== environment) continue;
    const { eventDigest, ...digestInput } = event;
    sequence += 1;
    if (event.sequence !== sequence || event.previousEventDigest !== previousEventDigest
        || eventDigest !== hashValue(digestInput)) {
      throw new MmcHttpError(500, 'MENTOR_AUDIT_CHAIN_INVALID', 'The local mentor audit chain failed integrity verification.');
    }
    previousEventDigest = eventDigest;
  }
}

function lastScopedAudit(events, tenantId, environment) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].tenantId === tenantId && events[index].environment === environment) return events[index];
  }
  return null;
}

function assertCompleteOwnerVocabulary() {
  const defined = Object.keys(OWNER_HANDLERS).sort();
  const expected = [...MMC_MENTOR_COMMAND_KINDS].sort();
  if (JSON.stringify(defined) !== JSON.stringify(expected)
      || JSON.stringify(Object.keys(MENTOR_COMMAND_OWNER_BY_KIND).sort()) !== JSON.stringify(expected)
      || JSON.stringify(Object.keys(CAPABILITY_BY_KIND).sort()) !== JSON.stringify(expected)
      || JSON.stringify(Object.keys(TARGET_BY_KIND).sort()) !== JSON.stringify(expected)) {
    throw new TypeError('Every mentor command must have exactly one owner, capability, handler, and aggregate target.');
  }
}

function requireCorrelationId(value) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(normalized)) {
    throw new MmcHttpError(500, 'CORRELATION_ID_INVALID', 'The server correlation identifier is invalid.');
  }
  return normalized;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function conflict(code, message) {
  return new MmcHttpError(409, code, message);
}

function resourceNotFound() {
  throw new MmcHttpError(404, 'MENTOR_RESOURCE_NOT_FOUND', 'The requested mentor resource was not found.');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}
