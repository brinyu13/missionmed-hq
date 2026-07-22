import crypto from 'node:crypto';

import {
  MMC_COMMAND_KINDS,
  canonicalize,
  commandIdempotencyScope,
  semanticCommandHash,
  validateCommandEnvelope,
} from '../contracts/command-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';

const CAPABILITY_BY_COMMAND = Object.freeze({
  'task.upsert': MMC_CAPABILITIES.COMMAND,
  'session.close': MMC_CAPABILITIES.COMMAND,
  'review.decide': MMC_CAPABILITIES.REVIEW,
  'identity.decide': MMC_CAPABILITIES.IDENTITY_REVIEW,
  'publication.approve': MMC_CAPABILITIES.PUBLICATION_APPROVE,
  'job.enqueue': MMC_CAPABILITIES.AI_QUEUE,
  'student.respond': MMC_CAPABILITIES.STUDENT_RESPOND,
});

const AGGREGATE_KIND_BY_COMMAND = Object.freeze({
  'task.upsert': 'TASK',
  'session.close': 'SESSION',
  'review.decide': 'PROPOSAL',
  'identity.decide': 'IDENTITY_CANDIDATE',
  'publication.approve': 'PUBLICATION',
  'job.enqueue': 'JOB',
  'student.respond': 'STUDENT_RESPONSE_STREAM',
});

const DEFAULT_HANDLER_BY_COMMAND = Object.freeze({
  'task.upsert': ({ command, current }) => ({
    aggregate: {
      kind: 'TASK',
      id: command.targetId,
      title: command.payload.title,
      details: command.payload.details || null,
      dueAt: command.payload.dueAt || null,
      ownerType: command.payload.ownerType,
      status: command.payload.status,
      sensitivity: command.payload.sensitivity,
      createdAt: current?.aggregate?.createdAt || null,
    },
    lineage: [],
  }),
});

export class MemoryCommandRepository {
  #state;
  #transactionTail = Promise.resolve();

  constructor(seed = {}) {
    this.#state = normalizeSeed(seed);
  }

  async transaction(callback) {
    const previous = this.#transactionTail;
    let release;
    this.#transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const draft = cloneState(this.#state);
      const result = await callback(draft);
      this.#state = draft;
      return result;
    } finally {
      release();
    }
  }

  snapshot() {
    return cloneState(this.#state);
  }
}

export class MmcCommandKernel {
  #repository;
  #handlers;
  #authorize;
  #clock;
  #idFactory;
  #scopeLocks = new Map();

  constructor(options = {}) {
    this.#repository = options.repository || new MemoryCommandRepository();
    this.#handlers = { ...DEFAULT_HANDLER_BY_COMMAND, ...(options.handlers || {}) };
    this.#authorize = options.authorize || defaultAuthorize;
    this.#clock = options.clock || (() => new Date());
    this.#idFactory = options.idFactory || (() => crypto.randomUUID());
  }

  get repository() {
    return this.#repository;
  }

  async execute(commandInput, context = {}) {
    const command = validateCommandEnvelope(commandInput);
    const principal = requirePrincipal(context.principal);
    const scopeKey = commandIdempotencyScope(command, principal);
    const semanticHash = semanticCommandHash(command);
    const commandIdentityKey = makeCommandIdentityKey(principal, command.commandId);

    return this.#withScopeLock(scopeKey, async () => this.#repository.transaction(async (draft) => {
      // A replay after revocation must not return a cached protected result.
      const authorized = await this.#authorize({ principal, command, context, draft });
      if (authorized !== true) {
        throw new MmcHttpError(403, 'COMMAND_AUTHORITY_DENIED',
          'The current MMC principal is not authorized for this command.');
      }
      validateScopedAuditChain(draft.audit, principal.tenantId, principal.environment);

      const commandIdentity = draft.commandIds.get(commandIdentityKey);
      if (commandIdentity) {
        if (commandIdentity.semanticHash !== semanticHash) {
          throw new MmcHttpError(409, 'COMMAND_ID_PAYLOAD_MISMATCH',
            'This command identifier is already bound to different semantics.');
        }
        if (commandIdentity.scopeKey !== scopeKey) {
          throw new MmcHttpError(409, 'COMMAND_ID_SCOPE_MISMATCH',
            'This command identifier is already bound to a different idempotency scope.');
        }
        return policySafeReplay(commandIdentity.result, context);
      }

      const receipt = draft.receipts.get(scopeKey);
      if (receipt) {
        if (receipt.semanticHash !== semanticHash) {
          throw new MmcHttpError(409, 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            'This idempotency key is already bound to a different semantic command.');
        }
        if (receipt.commandId !== command.commandId) {
          throw new MmcHttpError(409, 'IDEMPOTENCY_COMMAND_ID_MISMATCH',
            'This idempotency key is already bound to a different command identifier.');
        }
        return policySafeReplay(receipt.result, context);
      }

      const aggregateKey = makeAggregateKey(principal, command);
      const current = draft.aggregates.get(aggregateKey) || null;
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

      const handler = this.#handlers[command.kind];
      if (typeof handler !== 'function') {
        throw new MmcHttpError(501, 'COMMAND_HANDLER_NOT_ENABLED',
          'This typed MMC command is defined but its canonical handler is not enabled.');
      }

      const version = currentVersion + 1;
      const handlerResult = await handler({ command, principal, current: cloneJson(current), context });
      const aggregateKind = AGGREGATE_KIND_BY_COMMAND[command.kind];
      const aggregate = validateHandlerAggregate(handlerResult?.aggregate, command.targetId, aggregateKind);
      const lineage = validateLineage(handlerResult?.lineage || []);
      const objectResults = validateObjectResults(handlerResult?.objectResults, {
        id: command.targetId,
        kind: aggregateKind,
        version,
      });
      const commitAuthorized = await this.#authorize({
        principal, command, context, draft, phase: 'COMMIT',
      });
      if (commitAuthorized !== true) {
        throw new MmcHttpError(403, 'COMMAND_AUTHORITY_DENIED',
          'The current MMC principal is not authorized for this command.');
      }
      const now = this.#clock().toISOString();
      const auditId = `audit_${this.#idFactory()}`;
      const outboxId = `event_${this.#idFactory()}`;
      const correlationId = requireOpaqueContextId(context.correlationId || `corr_${this.#idFactory()}`);
      const committedAggregate = {
        ...aggregate,
        createdAt: aggregate.createdAt || current?.aggregate?.createdAt || now,
        updatedAt: now,
      };

      draft.aggregates.set(aggregateKey, {
        tenantId: principal.tenantId,
        environment: principal.environment,
        targetId: command.targetId,
        aggregateKind,
        commandKind: command.kind,
        version,
        updatedAt: now,
        aggregate: committedAggregate,
      });
      injectFailure(context, 'after_aggregate');

      const previousAudit = findLastScopedAudit(draft.audit, principal.tenantId, principal.environment);
      const auditEvent = {
        id: auditId,
        tenantId: principal.tenantId,
        environment: principal.environment,
        sequence: (previousAudit?.sequence || 0) + 1,
        previousEventDigest: previousAudit?.eventDigest || null,
        principalId: principal.id,
        effectiveRole: principal.role || null,
        subjectId: principal.subjectId || null,
        assignmentId: principal.assignmentId || null,
        commandId: command.commandId,
        commandKind: command.kind,
        purpose: command.purpose,
        targetId: command.targetId,
        targetVersion: version,
        semanticHash,
        beforeHash: current ? hashCanonical(current.aggregate) : null,
        afterHash: hashCanonical(committedAggregate),
        outcome: 'COMMITTED',
        correlationId,
        occurredAt: now,
      };
      auditEvent.eventDigest = hashCanonical(auditEvent);
      draft.audit.push(deepFreeze(auditEvent));
      injectFailure(context, 'after_audit');

      for (const edge of lineage) {
        draft.lineage.push(deepFreeze({
          ...edge,
          id: `lineage_${this.#idFactory()}`,
          tenantId: principal.tenantId,
          environment: principal.environment,
          commandId: command.commandId,
          targetId: command.targetId,
          targetVersion: version,
          createdAt: now,
        }));
      }
      injectFailure(context, 'after_lineage');

      draft.outbox.push(deepFreeze({
        id: outboxId,
        tenantId: principal.tenantId,
        environment: principal.environment,
        topic: `mmc.${command.kind}`,
        aggregateId: command.targetId,
        aggregateKind,
        aggregateVersion: version,
        commandId: command.commandId,
        state: 'PENDING',
        createdAt: now,
      }));
      injectFailure(context, 'after_outbox');

      const result = deepFreeze({
        ok: true,
        status: 'COMMITTED',
        commandId: command.commandId,
        aggregateVersion: version,
        objectResults,
        auditId,
        correlationId,
        replayed: false,
      });
      draft.receipts.set(scopeKey, deepFreeze({ scopeKey, semanticHash, commandId: command.commandId, result, createdAt: now }));
      draft.commandIds.set(commandIdentityKey, deepFreeze({
        commandId: command.commandId,
        scopeKey,
        semanticHash,
        result,
        createdAt: now,
      }));
      injectFailure(context, 'after_receipt');
      return result;
    }));
  }

  async #withScopeLock(key, callback) {
    const previous = this.#scopeLocks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    this.#scopeLocks.set(key, current);
    await previous;
    try {
      return await callback();
    } finally {
      release();
      if (this.#scopeLocks.get(key) === current) this.#scopeLocks.delete(key);
    }
  }
}

function defaultAuthorize({ principal, command }) {
  const capability = CAPABILITY_BY_COMMAND[command.kind];
  if (!capability) throw new TypeError(`No capability is mapped for ${command.kind}.`);
  assertCapability(principal, capability);
  return true;
}

function requirePrincipal(principal) {
  if (!principal || typeof principal !== 'object') {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_REQUIRED', 'An authenticated MMC principal is required.');
  }
  for (const field of ['id', 'tenantId', 'environment']) {
    if (typeof principal[field] !== 'string' || !principal[field].trim()) {
      throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'The authenticated MMC principal is invalid.');
    }
  }
  if (!Array.isArray(principal.capabilities)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'The authenticated MMC principal is invalid.');
  }
  return principal;
}

function makeAggregateKey(principal, command) {
  return [
    principal.tenantId,
    principal.environment,
    AGGREGATE_KIND_BY_COMMAND[command.kind],
    command.targetId,
  ].join('\u001f');
}

function makeCommandIdentityKey(principal, commandId) {
  return [principal.tenantId, principal.environment, commandId].join('\u001f');
}

function validateHandlerAggregate(value, targetId, aggregateKind) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new MmcHttpError(500, 'COMMAND_HANDLER_INVALID', 'The command handler produced an invalid canonical aggregate.');
  }
  const aggregate = canonicalize(value);
  if (aggregate.id !== targetId || aggregate.kind !== aggregateKind) {
    throw new MmcHttpError(500, 'COMMAND_HANDLER_TARGET_MISMATCH',
      'The command handler attempted to write a different aggregate identity.');
  }
  return aggregate;
}

function validateObjectResults(value, defaultResult) {
  const entries = value === undefined ? [defaultResult] : value;
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 200) {
    throw new MmcHttpError(500, 'COMMAND_OBJECT_RESULTS_INVALID',
      'The command handler produced invalid object results.');
  }
  return deepFreeze(entries.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || Object.getPrototypeOf(entry) !== Object.prototype
      || Object.keys(entry).some((key) => !['id', 'kind', 'version'].includes(key))
      || !['id', 'kind', 'version'].every((key) => Object.hasOwn(entry, key))
      || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(entry.id)
      || typeof entry.kind !== 'string' || !/^[A-Z][A-Z0-9_]{1,63}$/u.test(entry.kind)
      || !Number.isSafeInteger(entry.version) || entry.version < 1) {
      throw new MmcHttpError(500, 'COMMAND_OBJECT_RESULTS_INVALID',
        'The command handler produced invalid object results.');
    }
    return canonicalize(entry);
  }));
}

function validateLineage(value) {
  if (!Array.isArray(value) || value.length > 500) {
    throw new MmcHttpError(500, 'COMMAND_LINEAGE_INVALID', 'The command handler produced invalid lineage.');
  }
  return value.map((edge) => {
    if (!edge || typeof edge !== 'object' || Array.isArray(edge) || Object.getPrototypeOf(edge) !== Object.prototype) {
      throw new MmcHttpError(500, 'COMMAND_LINEAGE_INVALID', 'The command handler produced invalid lineage.');
    }
    const exactFields = ['relation', 'sourceId'];
    if (Object.keys(edge).some((key) => !exactFields.includes(key))
      || exactFields.some((key) => !Object.hasOwn(edge, key))) {
      throw new MmcHttpError(500, 'COMMAND_LINEAGE_INVALID',
        'The command handler attempted to write protected lineage bindings.');
    }
    const normalized = canonicalize(edge);
    if (!['SOURCE_TO_PROPOSAL', 'PROPOSAL_TO_CANONICAL', 'SOURCE_TO_CANONICAL', 'CANONICAL_TO_PUBLICATION']
      .includes(normalized.relation)
      || typeof normalized.sourceId !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(normalized.sourceId)) {
      throw new MmcHttpError(500, 'COMMAND_LINEAGE_INVALID', 'The command handler produced unsupported lineage.');
    }
    return normalized;
  });
}

function policySafeReplay(result, context) {
  const filtered = typeof context.filterReplayResult === 'function'
    ? context.filterReplayResult(cloneJson(result))
    : cloneJson(result);
  if (!filtered || typeof filtered !== 'object' || Array.isArray(filtered)) {
    throw new MmcHttpError(500, 'REPLAY_FILTER_INVALID', 'The replay result policy is invalid.');
  }
  return deepFreeze({ ...canonicalize(filtered), replayed: true });
}

function injectFailure(context, point) {
  if (context?.failurePoint === point) throw new Error(`Synthetic transaction failure at ${point}.`);
}

function requireOpaqueContextId(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(text)) {
    throw new MmcHttpError(500, 'CORRELATION_ID_INVALID', 'The server correlation identifier is invalid.');
  }
  return text;
}

function hashCanonical(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function findLastScopedAudit(events, tenantId, environment) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.tenantId === tenantId && event?.environment === environment) return event;
  }
  return null;
}

function validateScopedAuditChain(events, tenantId, environment) {
  let sequence = 0;
  let previousEventDigest = null;
  for (const event of events) {
    if (event?.tenantId !== tenantId || event?.environment !== environment) continue;
    const { eventDigest, ...digestInput } = event || {};
    sequence += 1;
    if (event.sequence !== sequence
      || event.previousEventDigest !== previousEventDigest
      || typeof eventDigest !== 'string'
      || !/^[a-f0-9]{64}$/u.test(eventDigest)
      || hashCanonical(digestInput) !== eventDigest) {
      throw new MmcHttpError(500, 'COMMAND_AUDIT_CHAIN_INVALID',
        'The command audit chain failed integrity verification.');
    }
    previousEventDigest = eventDigest;
  }
}

function normalizeSeed(seed) {
  return {
    aggregates: new Map(seed.aggregates || []),
    receipts: new Map(seed.receipts || []),
    commandIds: new Map(seed.commandIds || []),
    audit: [...(seed.audit || [])],
    lineage: [...(seed.lineage || [])],
    outbox: [...(seed.outbox || [])],
  };
}

function cloneState(state) {
  return {
    aggregates: new Map([...state.aggregates].map(([key, value]) => [key, cloneJson(value)])),
    receipts: new Map([...state.receipts].map(([key, value]) => [key, cloneJson(value)])),
    commandIds: new Map([...state.commandIds].map(([key, value]) => [key, cloneJson(value)])),
    audit: cloneJson(state.audit),
    lineage: cloneJson(state.lineage),
    outbox: cloneJson(state.outbox),
  };
}

function cloneJson(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

export const MMC_SUPPORTED_COMMAND_KINDS = MMC_COMMAND_KINDS;
