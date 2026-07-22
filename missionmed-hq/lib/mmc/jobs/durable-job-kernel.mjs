import crypto from 'node:crypto';

import { canonicalize } from '../contracts/command-contract.mjs';
import { canonicalUuid } from '../contracts/uuid-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';

const TERMINAL_STATES = new Set(['SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'CANCELLED']);
const CLAIMABLE_STATES = new Set(['QUEUED', 'RETRY_SCHEDULED']);
const EXTERNAL_OUTCOMES = new Set(['SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN']);
const CONSUMER_EFFECT_KINDS = new Set([
  'PROJECTION_REFRESH', 'INDEX_REFRESH', 'CACHE_INVALIDATION', 'NOTIFICATION_ENQUEUE',
]);
const CONSUMER_TARGET_KINDS = new Set(['SUBJECT', 'ASSIGNMENT', 'SESSION', 'JOB', 'PUBLICATION']);
const OUTBOX_QUEUE = 'mmc.outbox';

export const MMC_JOB_KINDS = Object.freeze([
  'SOURCE_DISCOVERY',
  'ASSET_ACQUISITION',
  'TRANSCRIPT_PROCESSING',
  'AI_ANALYSIS',
  'PUBLICATION_RENDER',
  'RECONCILIATION',
]);

export class MemoryJobRepository {
  #state;
  #transactionTail = Promise.resolve();

  constructor(seed = {}) {
    this.#state = normalizeJobSeed(seed);
  }

  snapshot() {
    return cloneState(this.#state);
  }

  async transaction(callback) {
    return this.#serialize(async () => {
      const draft = cloneState(this.#state);
      const result = await callback(draft);
      this.#state = draft;
      return result;
    });
  }

  async consumeTransaction(callback) {
    return this.#serialize(() => callback(this.#state));
  }

  async #serialize(callback) {
    const previous = this.#transactionTail;
    let release;
    this.#transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback();
    } finally {
      release();
    }
  }

}

export class DurableJobKernel {
  #repository;
  #clock;
  #idFactory;
  #authorize;
  #providerIdempotencyPolicy;
  #locks = new Map();

  constructor(options = {}) {
    this.#repository = options.repository || new MemoryJobRepository();
    this.#clock = options.clock || (() => new Date());
    this.#idFactory = options.idFactory || (() => crypto.randomUUID());
    this.#authorize = options.authorize || denyUnavailableAuthority;
    this.#providerIdempotencyPolicy = options.providerIdempotencyPolicy || (() => false);
  }

  get repository() {
    return this.#repository;
  }

  async enqueue(input, context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.AI_QUEUE);
    const request = validateEnqueue(input);
    const scope = hashJson({
      tenantId: principal.tenantId,
      environment: principal.environment,
      principalId: principal.id,
      jobKind: request.jobKind,
      targetId: request.targetId,
      idempotencyKey: request.idempotencyKey,
    });
    const semanticHash = hashJson(request);
    return this.#withLock(`enqueue:${scope}`, async () => this.#atomic(async (draft) => {
      await requireActiveAuthority(this.#authorize({ action: 'enqueue', principal, request, context, draft }));
      const receipt = draft.enqueueReceipts.get(scope);
      if (receipt) {
        if (receipt.semanticHash !== semanticHash) {
          throw conflict('JOB_IDEMPOTENCY_MISMATCH', 'The job idempotency key is bound to different work.');
        }
        return { ...structuredClone(receipt.result), replayed: true };
      }

      const now = this.#clock().toISOString();
      const id = requireUuid(this.#idFactory(), 'generated job id');
      const job = {
        id,
        tenantId: principal.tenantId,
        environment: principal.environment,
        targetId: request.targetId,
        queueName: request.queueName,
        jobKind: request.jobKind,
        assetHandle: request.assetHandle,
        authorityGrantId: request.authorityGrantId,
        payloadHash: request.payloadHash,
        providerIdempotencyKeyDigest: request.providerIdempotencyKeyDigest,
        state: 'QUEUED',
        attempt: 0,
        maxAttempts: 5,
        generation: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: now,
        dispatchIntent: null,
        dispatchIntentHistory: [],
        externalResult: null,
        externalResultHistory: [],
        recoveryHistory: [],
        createdAt: now,
        updatedAt: now,
      };
      draft.jobs.set(id, job);
      recordTransition(draft, job, 'JOB_ENQUEUED', principal.id, this.#idFactory, now);
      const result = Object.freeze({ ok: true, status: 'ACCEPTED', jobId: id, state: job.state, replayed: false });
      draft.enqueueReceipts.set(scope, { semanticHash, result, createdAt: now });
      injectFailure(context, 'after_enqueue');
      return result;
    }));
  }

  async claim(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_CLAIM);
    const jobId = requireOpaqueId(input?.jobId, 'jobId');
    const queueName = requireQueueName(input?.queueName);
    if (queueName !== worker.queueName) {
      throw new MmcHttpError(404, 'JOB_NOT_FOUND', 'The job was not found.');
    }
    const leaseSeconds = boundedInteger(input?.leaseSeconds, 60, 15, 300, 'leaseSeconds');
    return this.#withLock(`job:${jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireScopedJob(draft, jobId, worker);
      await requireActiveAuthority(this.#authorize({ action: 'claim', principal: worker, job: structuredClone(job), context, draft }));
      const nowDate = this.#clock();
      const expiredLease = ['LEASED', 'RUNNING'].includes(job.state)
        && job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) <= nowDate.getTime();
      if (expiredLease && job.externalResult) {
        throw conflict('EXTERNAL_RESULT_RECONCILIATION_REQUIRED',
          'An expired lease with a recorded provider outcome requires reconciliation before another claim.');
      }
      if (expiredLease && job.dispatchIntent) {
        throw conflict('EXPIRED_DISPATCH_RECONCILIATION_REQUIRED',
          'An expired dispatched job cannot be reclaimed without evidence-backed outcome reconciliation.');
      }
      const retryDue = job.state !== 'RETRY_SCHEDULED'
        || !job.nextAttemptAt || Date.parse(job.nextAttemptAt) <= nowDate.getTime();
      if (((!CLAIMABLE_STATES.has(job.state) || !retryDue) && !expiredLease) || job.attempt >= job.maxAttempts) {
        throw conflict('JOB_NOT_CLAIMABLE', 'The job is not currently claimable.');
      }

      job.state = 'LEASED';
      job.generation += 1;
      job.attempt += 1;
      job.leaseOwner = worker.workloadId;
      job.leaseExpiresAt = new Date(nowDate.getTime() + leaseSeconds * 1000).toISOString();
      job.updatedAt = nowDate.toISOString();
      recordTransition(draft, job, 'JOB_CLAIMED', worker.id, this.#idFactory, job.updatedAt);
      injectFailure(context, 'after_claim');
      return leaseView(job);
    }));
  }

  async start(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_CLAIM);
    const dispatch = validateDispatchInput(input);
    return this.#withLock(`job:${dispatch.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireCurrentLease(draft, dispatch, worker, this.#clock());
      await requireActiveAuthority(this.#authorize({
        action: 'start', principal: worker, job: structuredClone(job), context, draft,
      }));
      if (job.state !== 'LEASED') {
        throw conflict('JOB_TRANSITION_INVALID', `The job cannot transition from ${job.state} to RUNNING.`);
      }
      if (dispatch.providerIdempotencyKeyDigest !== job.providerIdempotencyKeyDigest) {
        throw conflict('PROVIDER_IDEMPOTENCY_KEY_MISMATCH',
          'The provider idempotency key digest does not match the immutable job binding.');
      }
      const now = this.#clock().toISOString();
      job.dispatchIntent = Object.freeze({
        generation: job.generation,
        providerIdempotencyKeyDigest: job.providerIdempotencyKeyDigest,
        dispatchIntentDigest: hashJson({
          jobId: job.id,
          generation: job.generation,
          jobKind: job.jobKind,
          payloadHash: job.payloadHash,
          providerIdempotencyKeyDigest: job.providerIdempotencyKeyDigest,
        }),
        recordedAt: now,
      });
      job.state = 'RUNNING';
      job.updatedAt = now;
      recordTransition(draft, job, 'JOB_DISPATCH_INTENT_RECORDED', worker.id, this.#idFactory, now);
      injectFailure(context, 'after_start');
      return leaseView(job);
    }));
  }

  async heartbeat(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_CLAIM);
    const lease = validateLeaseInput(input);
    const leaseSeconds = boundedInteger(input?.leaseSeconds, 60, 15, 300, 'leaseSeconds');
    return this.#withLock(`job:${lease.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireCurrentLease(draft, lease, worker, this.#clock());
      await requireActiveAuthority(this.#authorize({ action: 'heartbeat', principal: worker, job: structuredClone(job), context, draft }));
      const now = this.#clock();
      job.leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
      job.updatedAt = now.toISOString();
      recordTransition(draft, job, 'JOB_HEARTBEAT', worker.id, this.#idFactory, job.updatedAt);
      injectFailure(context, 'after_heartbeat');
      return leaseView(job);
    }));
  }

  async recordExternalResult(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_COMPLETE);
    const external = validateExternalResultInput(input);
    const lease = { jobId: external.jobId, generation: external.generation };

    return this.#withLock(`job:${lease.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireScopedJob(draft, lease.jobId, worker);
      if (job.generation !== lease.generation || job.leaseOwner !== worker.workloadId) {
        throw conflict('STALE_LEASE_GENERATION', 'The worker lease generation is stale.');
      }
      const now = this.#clock();
      if (!['LEASED', 'RUNNING'].includes(job.state) || !job.leaseExpiresAt) {
        throw conflict('JOB_LEASE_EXPIRED', 'The worker lease has expired.');
      }
      if (job.state !== 'RUNNING' || !job.dispatchIntent
        || job.dispatchIntent.generation !== job.generation) {
        throw conflict('EXTERNAL_DISPATCH_INTENT_REQUIRED',
          'A generation-bound dispatch intent must be committed before a provider result can be recorded.');
      }
      if (external.providerIdempotencyKeyDigest !== job.providerIdempotencyKeyDigest
        || external.providerIdempotencyKeyDigest !== job.dispatchIntent.providerIdempotencyKeyDigest) {
        throw conflict('PROVIDER_IDEMPOTENCY_KEY_MISMATCH',
          'The provider result does not match the immutable dispatch idempotency key digest.');
      }
      // A provider response may arrive just after lease expiry. Preserve the
      // exact unchanged generation's outcome so reconciliation can commit it
      // without repeating the provider effect.
      const recordedAfterLeaseExpiry = Date.parse(job.leaseExpiresAt) <= now.getTime();
      // Revocation stops new work and completion, but it must not erase the
      // outcome of a provider call already issued by this exact lease. A
      // revoked result is quarantined as evidence until an authorized
      // reconciliation/complete transition rechecks current authority.
      const authorityActiveAtRecord = await this.#authorize({
        action: 'record_external_result', principal: worker, job: structuredClone(job), context, draft,
      }) === true;
      if (job.externalResult) {
        const previous = {
          outcome: job.externalResult.outcome,
          resultHash: job.externalResult.resultHash,
          providerReceiptId: job.externalResult.providerReceiptId,
          providerIdempotencyKeyDigest: job.externalResult.providerIdempotencyKeyDigest,
        };
        const replay = {
          outcome: external.outcome,
          resultHash: external.resultHash,
          providerReceiptId: external.providerReceiptId,
          providerIdempotencyKeyDigest: external.providerIdempotencyKeyDigest,
        };
        if (hashJson(previous) !== hashJson(replay)) {
          throw conflict('EXTERNAL_RESULT_IMMUTABLE',
            'A provider outcome is already recorded for this lease and cannot be overwritten.');
        }
        return Object.freeze({
          jobId: job.id,
          generation: job.generation,
          outcome: job.externalResult.outcome,
          reconciliationRequired: job.externalResult.recordedAfterLeaseExpiry === true
            || job.externalResult.authorityActiveAtRecord !== true
            || job.externalResult.outcome === 'OUTCOME_UNKNOWN',
          recordedAfterLeaseExpiry: job.externalResult.recordedAfterLeaseExpiry === true,
          authorityActiveAtRecord: job.externalResult.authorityActiveAtRecord === true,
          replayed: true,
        });
      }
      const providerIdempotencyProven = await this.#providerIdempotencyPolicy({
        principal: worker,
        job: structuredClone(job),
        outcome: external.outcome,
        providerReceiptId: external.providerReceiptId,
        context,
      }) === true;
      job.externalResult = {
        generation: job.generation,
        outcome: external.outcome,
        resultHash: external.resultHash,
        providerReceiptId: external.providerReceiptId,
        providerIdempotencyKeyDigest: external.providerIdempotencyKeyDigest,
        dispatchIntentDigest: job.dispatchIntent.dispatchIntentDigest,
        providerIdempotencyProven,
        recordedAfterLeaseExpiry,
        authorityActiveAtRecord,
        recordedAt: now.toISOString(),
      };
      job.updatedAt = job.externalResult.recordedAt;
      // A provider result is evidence, not yet a canonical completion. Keep
      // this transition non-dispatchable until completion/reconciliation emits
      // a separately authorized operational event.
      recordTransition(draft, job, `EXTERNAL_${external.outcome}`, worker.id,
        this.#idFactory, job.updatedAt, { deliveryState: 'QUARANTINED' });
      injectFailure(context, 'after_external_result');
      return Object.freeze({
        jobId: job.id,
        generation: job.generation,
        outcome: external.outcome,
        reconciliationRequired: recordedAfterLeaseExpiry || !authorityActiveAtRecord
          || external.outcome === 'OUTCOME_UNKNOWN',
        recordedAfterLeaseExpiry,
        authorityActiveAtRecord,
        replayed: false,
      });
    }));
  }

  async complete(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_COMPLETE);
    const lease = validateLeaseInput(input);
    const disposition = requireEnum(input?.disposition,
      new Set(['SUCCEEDED', 'RETRY', 'FAILED', 'DEAD_LETTER']), 'disposition');
    const retryDelaySeconds = input?.retryDelaySeconds == null
      ? 0 : boundedInteger(input.retryDelaySeconds, 0, 0, 86_400, 'retryDelaySeconds');
    const decision = Object.freeze({ disposition, retryDelaySeconds });

    return this.#withLock(`job:${lease.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireCurrentLease(draft, lease, worker, this.#clock());
      await requireActiveAuthority(this.#authorize({
        action: 'complete', principal: worker, job: structuredClone(job),
        decision: structuredClone(decision), context, draft,
      }));
      if (!job.externalResult) {
        throw conflict('EXTERNAL_RESULT_REQUIRED', 'A bounded external result must be recorded before completion.');
      }
      assertExternalDisposition(job, disposition);
      if (disposition === 'RETRY' && job.attempt >= job.maxAttempts) {
        throw conflict('JOB_MAX_ATTEMPTS_REACHED', 'The job has exhausted its bounded retry attempts.');
      }

      const now = this.#clock();
      job.state = disposition === 'RETRY' ? 'RETRY_SCHEDULED' : disposition;
      job.nextAttemptAt = disposition === 'RETRY'
        ? new Date(now.getTime() + retryDelaySeconds * 1000).toISOString() : null;
      if (disposition === 'RETRY') {
        archiveCurrentExternalResult(job, 'RETRY_SCHEDULED', now.toISOString());
        archiveCurrentDispatchIntent(job, 'RETRY_SCHEDULED', now.toISOString());
      }
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = now.toISOString();
      recordTransition(draft, job, `JOB_${job.state}`, worker.id, this.#idFactory, job.updatedAt);
      injectFailure(context, 'after_complete');
      return Object.freeze({ jobId: job.id, generation: job.generation, state: job.state, nextAttemptAt: job.nextAttemptAt });
    }));
  }

  async reconcileExpiredResult(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_COMPLETE);
    const lease = validateLeaseInput(input);
    const disposition = requireEnum(input?.disposition,
      new Set(['SUCCEEDED', 'RETRY', 'FAILED', 'DEAD_LETTER']), 'disposition');
    const retryDelaySeconds = input?.retryDelaySeconds == null
      ? 0 : boundedInteger(input.retryDelaySeconds, 0, 0, 86_400, 'retryDelaySeconds');
    const decision = Object.freeze({ disposition, retryDelaySeconds });

    return this.#withLock(`job:${lease.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireScopedJob(draft, lease.jobId, worker);
      if (job.generation !== lease.generation || job.leaseOwner !== worker.workloadId) {
        throw conflict('STALE_LEASE_GENERATION', 'The worker lease generation is stale.');
      }
      const now = this.#clock();
      if (!['LEASED', 'RUNNING'].includes(job.state) || !job.leaseExpiresAt
        || Date.parse(job.leaseExpiresAt) > now.getTime() || !job.externalResult
        || job.externalResult.generation !== lease.generation) {
        throw conflict('EXPIRED_EXTERNAL_RESULT_REQUIRED',
          'An expired lease with its exact recorded provider outcome is required for reconciliation.');
      }
      await requireActiveAuthority(this.#authorize({
        action: 'reconcile_expired_external_result', principal: worker,
        job: structuredClone(job), decision: structuredClone(decision), context, draft,
      }));
      assertExternalDisposition(job, disposition);
      if (disposition === 'RETRY' && job.attempt >= job.maxAttempts) {
        throw conflict('JOB_MAX_ATTEMPTS_REACHED', 'The job has exhausted its bounded retry attempts.');
      }

      job.state = disposition === 'RETRY' ? 'RETRY_SCHEDULED' : disposition;
      job.nextAttemptAt = disposition === 'RETRY'
        ? new Date(now.getTime() + retryDelaySeconds * 1000).toISOString() : null;
      if (disposition === 'RETRY') {
        archiveCurrentExternalResult(job, 'RECONCILED_RETRY', now.toISOString());
        archiveCurrentDispatchIntent(job, 'RECONCILED_RETRY', now.toISOString());
      }
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = now.toISOString();
      recordTransition(draft, job, `JOB_RECONCILED_${job.state}`, worker.id, this.#idFactory, job.updatedAt);
      injectFailure(context, 'after_reconcile_expired_result');
      return Object.freeze({
        jobId: job.id, generation: job.generation, state: job.state,
        nextAttemptAt: job.nextAttemptAt, reconciled: true,
      });
    }));
  }

  async adjudicateExpiredRunning(input, context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.OPERATIONS);
    const recovery = validateExpiredRunningAdjudication(input);

    return this.#withLock(`job:${recovery.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireScopedJobForPrincipal(draft, recovery.jobId, principal);
      if (job.generation !== recovery.generation) {
        throw conflict('STALE_LEASE_GENERATION', 'The worker lease generation is stale.');
      }
      const now = this.#clock();
      if (job.state !== 'RUNNING' || !job.leaseExpiresAt
        || Date.parse(job.leaseExpiresAt) > now.getTime() || job.externalResult
        || !job.dispatchIntent || job.dispatchIntent.generation !== job.generation) {
        throw conflict('EXPIRED_RUNNING_ADJUDICATION_REQUIRED',
          'An expired running generation without a provider result is required for recovery adjudication.');
      }
      await requireActiveAuthority(this.#authorize({
        action: 'adjudicate_expired_running', principal, job: structuredClone(job), context, draft,
        recovery: structuredClone(recovery),
      }));

      const disposition = recovery.finding === 'CONFIRMED_NOT_SENT' ? 'RETRY_SCHEDULED' : 'DEAD_LETTER';
      if (disposition === 'RETRY_SCHEDULED' && job.attempt >= job.maxAttempts) {
        throw conflict('JOB_MAX_ATTEMPTS_REACHED', 'The job has exhausted its bounded retry attempts.');
      }
      const adjudicatedAt = now.toISOString();
      job.recoveryHistory ||= [];
      job.recoveryHistory.push(Object.freeze({
        generation: job.generation,
        finding: recovery.finding,
        evidenceHash: recovery.evidenceHash,
        adjudicatorPrincipalId: principal.id,
        disposition,
        adjudicatedAt,
      }));
      job.state = disposition;
      job.nextAttemptAt = disposition === 'RETRY_SCHEDULED'
        ? new Date(now.getTime() + recovery.retryDelaySeconds * 1000).toISOString()
        : null;
      if (disposition === 'RETRY_SCHEDULED') {
        archiveCurrentDispatchIntent(job, `RECOVERY_${recovery.finding}`, adjudicatedAt);
      }
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = adjudicatedAt;
      recordTransition(draft, job, `JOB_RECOVERY_${recovery.finding}`, principal.id, this.#idFactory, adjudicatedAt);
      injectFailure(context, 'after_expired_running_adjudication');
      return Object.freeze({
        jobId: job.id,
        generation: job.generation,
        state: job.state,
        finding: recovery.finding,
        nextAttemptAt: job.nextAttemptAt,
      });
    }));
  }

  async adjudicateRecordedExternalResult(input, context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.OPERATIONS);
    const recovery = validateRecordedResultAdjudication(input);
    return this.#withLock(`job:${recovery.jobId}`, async () => this.#atomic(async (draft) => {
      const job = requireScopedJobForPrincipal(draft, recovery.jobId, principal);
      if (job.generation !== recovery.generation) {
        throw conflict('STALE_LEASE_GENERATION', 'The provider result generation is stale.');
      }
      const now = this.#clock();
      if (!['LEASED', 'RUNNING'].includes(job.state) || !job.leaseExpiresAt
        || Date.parse(job.leaseExpiresAt) > now.getTime() || !job.externalResult
        || job.externalResult.generation !== recovery.generation) {
        throw conflict('EXPIRED_EXTERNAL_RESULT_REQUIRED',
          'An expired lease with its exact recorded provider outcome is required for operator reconciliation.');
      }
      await requireActiveAuthority(this.#authorize({
        action: 'adjudicate_recorded_external_result', principal,
        job: structuredClone(job), recovery: structuredClone(recovery), context, draft,
      }));
      assertExternalDisposition(job, recovery.disposition);
      if (recovery.disposition === 'RETRY' && job.attempt >= job.maxAttempts) {
        throw conflict('JOB_MAX_ATTEMPTS_REACHED', 'The job has exhausted its bounded retry attempts.');
      }
      const adjudicatedAt = now.toISOString();
      job.recoveryHistory ||= [];
      job.recoveryHistory.push(Object.freeze({
        generation: job.generation,
        finding: 'RECORDED_EXTERNAL_RESULT',
        evidenceHash: recovery.evidenceHash,
        resultHash: job.externalResult.resultHash,
        adjudicatorPrincipalId: principal.id,
        disposition: recovery.disposition,
        adjudicatedAt,
      }));
      job.state = recovery.disposition === 'RETRY' ? 'RETRY_SCHEDULED' : recovery.disposition;
      job.nextAttemptAt = recovery.disposition === 'RETRY'
        ? new Date(now.getTime() + recovery.retryDelaySeconds * 1000).toISOString()
        : null;
      if (recovery.disposition === 'RETRY') {
        archiveCurrentExternalResult(job, 'OPERATOR_RECONCILED_RETRY', adjudicatedAt);
        archiveCurrentDispatchIntent(job, 'OPERATOR_RECONCILED_RETRY', adjudicatedAt);
      }
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
      job.updatedAt = adjudicatedAt;
      recordTransition(draft, job, `JOB_OPERATOR_RECONCILED_${job.state}`,
        principal.id, this.#idFactory, adjudicatedAt);
      injectFailure(context, 'after_operator_external_result_adjudication');
      return Object.freeze({
        jobId: job.id,
        generation: job.generation,
        state: job.state,
        nextAttemptAt: job.nextAttemptAt,
        reconciledByOperator: true,
      });
    }));
  }

  async claimOutbox(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH);
    const queueName = requireQueueName(input?.queueName);
    if (queueName !== worker.queueName) {
      throw new MmcHttpError(404, 'OUTBOX_EVENT_NOT_FOUND', 'The outbox event was not found.');
    }
    const leaseSeconds = boundedInteger(input?.leaseSeconds, 60, 15, 300, 'leaseSeconds');
    return this.#repository.consumeTransaction(async (draft) => {
      const now = this.#clock();
      const candidate = findNextOutboxCandidate(draft, worker, queueName, now);
      const event = candidate?.event;
      if (!event) {
        throw conflict('OUTBOX_EVENT_NOT_AVAILABLE', 'No outbox event is currently available for delivery.');
      }
      const job = requireScopedJobForPrincipal(draft, event.jobId, worker);
      await requireActiveAuthority(this.#authorize({
        action: 'claim_outbox', principal: worker, job: structuredClone(job),
        event: immutableOutboxEnvelope(event), context, draft,
      }));
      event.deliveryState = 'LEASED';
      event.deliveryGeneration += 1;
      event.deliveryLeaseOwner = worker.workloadId;
      event.deliveryLeaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
      event.deliveryAttempts += 1;
      if (candidate.pendingIndex != null) {
        draft.outboxCursors.set(candidate.cursorKey, candidate.pendingIndex + 1);
      }
      return outboxLeaseView(event);
    });
  }

  async consumeOnce(input, context = {}) {
    const worker = requireWorker(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_INBOX);
    const delivery = validateOutboxDeliveryInput(input);
    const effectResult = validateConsumerEffect(input?.effectResult);
    const effectHash = hashJson(effectResult);
    const key = `${worker.tenantId}\u001f${worker.environment}\u001f${delivery.eventId}`;
    return this.#withLock(`inbox:${key}`, async () => this.#repository.consumeTransaction(async (draft) => {
      const event = draft.outbox.get(delivery.eventId);
      if (!event || event.tenantId !== worker.tenantId
        || event.environment !== worker.environment || event.deliveryQueueName !== worker.queueName
        || hashMmcOutboxEvent(event) !== delivery.eventHash) {
        throw new MmcHttpError(404, 'OUTBOX_EVENT_NOT_FOUND', 'The authoritative outbox event was not found.');
      }
      const receipt = draft.inbox.get(key);
      if (receipt) {
        if (receipt.eventHash !== delivery.eventHash || receipt.effectHash !== effectHash) {
          throw conflict('INBOX_EVENT_MISMATCH', 'The event identity is bound to different content.');
        }
        return Object.freeze({ applied: false, duplicate: true, effectId: receipt.effectId });
      }
      const now = this.#clock();
      if (event.deliveryState !== 'LEASED'
        || event.deliveryGeneration !== delivery.deliveryGeneration
        || event.deliveryLeaseOwner !== worker.workloadId
        || !event.deliveryLeaseExpiresAt
        || Date.parse(event.deliveryLeaseExpiresAt) <= now.getTime()) {
        throw conflict('OUTBOX_LEASE_EXPIRED', 'The outbox delivery lease is stale or expired.');
      }
      const job = requireScopedJobForPrincipal(draft, event.jobId, worker);
      await requireActiveAuthority(this.#authorize({
        action: 'consume', principal: worker, job: structuredClone(job),
        event: immutableOutboxEnvelope(event), effect: structuredClone(effectResult), context, draft,
      }));
      if (effectResult.effectKind !== event.effectKind
        || effectResult.targetKind !== event.aggregateKind
        || effectResult.targetId !== event.aggregateId) {
        throw conflict('OUTBOX_EFFECT_TARGET_MISMATCH',
          'The consumer effect target must match the server-bound outbox aggregate.');
      }
      // The effect is a fixed, bounded repository projection—not an arbitrary
      // provider side effect. Effect, receipt, and DELIVERED state commit in
      // one repository transaction so crash/retry converges exactly once.
      const effectId = requireUuid(this.#idFactory(), 'generated consumer effect id');
      const consumedAt = now.toISOString();
      injectFailure(context, 'before_consumer_effect_commit');
      draft.consumerEffects.set(effectId, {
        id: effectId,
        tenantId: event.tenantId,
        environment: event.environment,
        outboxEventId: event.id,
        dispatcherQueueName: worker.queueName,
        ...structuredClone(effectResult),
        appliedAt: consumedAt,
      });
      draft.inbox.set(key, {
        eventHash: delivery.eventHash,
        effectHash,
        effectId,
        consumedAt,
      });
      event.deliveryState = 'DELIVERED';
      event.deliveredAt = consumedAt;
      event.deliveryLeaseOwner = null;
      event.deliveryLeaseExpiresAt = null;
      return Object.freeze({ applied: true, duplicate: false, effectId });
    }));
  }

  async #atomic(callback) {
    return this.#repository.transaction(callback);
  }

  async #withLock(key, callback) {
    const previous = this.#locks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    this.#locks.set(key, current);
    await previous;
    try {
      return await callback();
    } finally {
      release();
      if (this.#locks.get(key) === current) this.#locks.delete(key);
    }
  }
}

function validateEnqueue(input) {
  assertExactObject(input, [
    'idempotencyKey', 'targetId', 'jobKind', 'queueName', 'assetHandle',
    'authorityGrantId', 'payloadHash', 'providerIdempotencyKeyDigest',
  ]);
  return Object.freeze({
    idempotencyKey: requireOpaqueId(input.idempotencyKey, 'idempotencyKey'),
    targetId: requireUuid(input.targetId, 'targetId'),
    queueName: requireQueueName(input.queueName),
    jobKind: requireEnum(input.jobKind, new Set(MMC_JOB_KINDS), 'jobKind'),
    assetHandle: requireOpaqueId(input.assetHandle, 'assetHandle'),
    authorityGrantId: requireOpaqueId(input.authorityGrantId, 'authorityGrantId'),
    payloadHash: requireHash(input.payloadHash, 'payloadHash'),
    providerIdempotencyKeyDigest: requireHash(
      input.providerIdempotencyKeyDigest, 'providerIdempotencyKeyDigest',
    ),
  });
}

function validateLeaseInput(input) {
  return {
    jobId: requireOpaqueId(input?.jobId, 'jobId'),
    generation: boundedInteger(input?.generation, -1, 1, Number.MAX_SAFE_INTEGER, 'generation'),
  };
}

function validateDispatchInput(input) {
  assertExactObject(input, ['jobId', 'generation', 'providerIdempotencyKeyDigest']);
  return Object.freeze({
    ...validateLeaseInput(input),
    providerIdempotencyKeyDigest: requireHash(
      input.providerIdempotencyKeyDigest, 'providerIdempotencyKeyDigest',
    ),
  });
}

function validateExternalResultInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw invalid('JOB_OBJECT_REQUIRED', 'A plain provider result object is required.');
  }
  const allowed = new Set([
    'jobId', 'generation', 'outcome', 'resultHash', 'providerReceiptId',
    'providerIdempotencyKeyDigest',
  ]);
  const required = ['jobId', 'generation', 'outcome', 'resultHash', 'providerIdempotencyKeyDigest'];
  if (Object.keys(input).some((field) => !allowed.has(field)) || required.some((field) => !Object.hasOwn(input, field))) {
    throw invalid('JOB_FIELDS_INVALID', 'The provider result fields are invalid.');
  }
  return Object.freeze({
    jobId: requireOpaqueId(input.jobId, 'jobId'),
    generation: boundedInteger(input.generation, -1, 1, Number.MAX_SAFE_INTEGER, 'generation'),
    outcome: requireEnum(input.outcome, EXTERNAL_OUTCOMES, 'outcome'),
    resultHash: requireHash(input.resultHash, 'resultHash'),
    providerReceiptId: input.providerReceiptId == null
      ? null : requireOpaqueId(input.providerReceiptId, 'providerReceiptId'),
    providerIdempotencyKeyDigest: requireHash(
      input.providerIdempotencyKeyDigest, 'providerIdempotencyKeyDigest',
    ),
  });
}

function validateExpiredRunningAdjudication(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw invalid('JOB_OBJECT_REQUIRED', 'A plain recovery adjudication object is required.');
  }
  const allowed = new Set(['jobId', 'generation', 'finding', 'evidenceHash', 'retryDelaySeconds']);
  const required = ['jobId', 'generation', 'finding', 'evidenceHash'];
  if (Object.keys(input).some((field) => !allowed.has(field)) || required.some((field) => !Object.hasOwn(input, field))) {
    throw invalid('JOB_FIELDS_INVALID', 'The recovery adjudication fields are invalid.');
  }
  const finding = requireEnum(input.finding,
    new Set(['CONFIRMED_NOT_SENT', 'OUTCOME_UNKNOWN']), 'finding');
  const retryDelaySeconds = input.retryDelaySeconds == null
    ? 0 : boundedInteger(input.retryDelaySeconds, 0, 0, 86_400, 'retryDelaySeconds');
  if (finding === 'OUTCOME_UNKNOWN' && retryDelaySeconds !== 0) {
    throw invalid('JOB_RECOVERY_RETRY_FORBIDDEN',
      'An unknown provider outcome cannot be scheduled for retry by adjudication.');
  }
  return Object.freeze({
    jobId: requireOpaqueId(input.jobId, 'jobId'),
    generation: boundedInteger(input.generation, -1, 1, Number.MAX_SAFE_INTEGER, 'generation'),
    finding,
    evidenceHash: requireHash(input.evidenceHash, 'evidenceHash'),
    retryDelaySeconds,
  });
}

function validateRecordedResultAdjudication(input) {
  assertExactObject(input, ['jobId', 'generation', 'disposition', 'evidenceHash', 'retryDelaySeconds']);
  return Object.freeze({
    jobId: requireOpaqueId(input.jobId, 'jobId'),
    generation: boundedInteger(input.generation, -1, 1, Number.MAX_SAFE_INTEGER, 'generation'),
    disposition: requireEnum(input.disposition,
      new Set(['SUCCEEDED', 'RETRY', 'FAILED', 'DEAD_LETTER']), 'disposition'),
    evidenceHash: requireHash(input.evidenceHash, 'evidenceHash'),
    retryDelaySeconds: input.retryDelaySeconds == null
      ? 0 : boundedInteger(input.retryDelaySeconds, 0, 0, 86_400, 'retryDelaySeconds'),
  });
}

function validateOutboxDeliveryInput(input) {
  assertExactObject(input, ['eventId', 'eventHash', 'deliveryGeneration', 'effectResult']);
  return Object.freeze({
    eventId: requireOpaqueId(input.eventId, 'eventId'),
    eventHash: requireHash(input.eventHash, 'eventHash'),
    deliveryGeneration: boundedInteger(
      input.deliveryGeneration, -1, 1, Number.MAX_SAFE_INTEGER, 'deliveryGeneration',
    ),
  });
}

function validateConsumerEffect(input) {
  assertExactObject(input, ['effectKind', 'targetKind', 'targetId', 'effectDigest']);
  return Object.freeze({
    effectKind: requireEnum(input.effectKind, CONSUMER_EFFECT_KINDS, 'effectKind'),
    targetKind: requireEnum(input.targetKind, CONSUMER_TARGET_KINDS, 'targetKind'),
    targetId: requireUuid(input.targetId, 'targetId'),
    effectDigest: requireHash(input.effectDigest, 'effectDigest'),
  });
}

function requireCurrentLease(draft, lease, worker, now) {
  const job = requireScopedJob(draft, lease.jobId, worker);
  if (job.generation !== lease.generation || job.leaseOwner !== worker.workloadId) {
    throw conflict('STALE_LEASE_GENERATION', 'The worker lease generation is stale.');
  }
  if (!['LEASED', 'RUNNING'].includes(job.state) || !job.leaseExpiresAt || Date.parse(job.leaseExpiresAt) <= now.getTime()) {
    throw conflict('JOB_LEASE_EXPIRED', 'The worker lease has expired.');
  }
  return job;
}

function requireScopedJob(draft, jobId, principal) {
  const job = draft.jobs.get(jobId);
  if (!job || job.tenantId !== principal.tenantId || job.environment !== principal.environment
    || job.queueName !== principal.queueName) {
    throw new MmcHttpError(404, 'JOB_NOT_FOUND', 'The job was not found.');
  }
  return job;
}

function requireScopedJobForPrincipal(draft, jobId, principal) {
  const job = draft.jobs.get(jobId);
  if (!job || job.tenantId !== principal.tenantId || job.environment !== principal.environment) {
    throw new MmcHttpError(404, 'JOB_NOT_FOUND', 'The job was not found.');
  }
  return job;
}

function recordTransition(draft, job, eventType, principalId, idFactory, occurredAt, options = {}) {
  validateScopedJobAuditChain(draft.audit, job.tenantId, job.environment);
  const auditId = requireUuid(idFactory(), 'generated audit id');
  const eventId = requireUuid(idFactory(), 'generated outbox event id');
  const previousAudit = findLastScopedJobAudit(draft.audit, job.tenantId, job.environment);
  const auditEvent = {
    id: auditId,
    tenantId: job.tenantId,
    environment: job.environment,
    sequence: (previousAudit?.sequence || 0) + 1,
    previousEventDigest: previousAudit?.eventDigest || null,
    jobId: job.id,
    generation: job.generation,
    state: job.state,
    eventType,
    principalId,
    occurredAt,
  };
  auditEvent.eventDigest = hashJson(auditEvent);
  draft.audit.push(auditEvent);
  draft.outbox.set(eventId, {
    id: eventId, tenantId: job.tenantId, environment: job.environment,
    topic: `mmc.job.${eventType.toLowerCase()}`, jobId: job.id,
    generation: job.generation,
    aggregateKind: 'JOB',
    aggregateId: job.id,
    effectKind: 'PROJECTION_REFRESH',
    payloadDigest: hashJson({
      jobId: job.id,
      generation: job.generation,
      state: job.state,
      eventType,
    }),
    deliveryQueueName: OUTBOX_QUEUE,
    deliveryState: options.deliveryState || 'PENDING',
    deliveryGeneration: 0,
    deliveryLeaseOwner: null,
    deliveryLeaseExpiresAt: null,
    deliveryAttempts: 0,
    deliveredAt: null,
    createdAt: occurredAt,
  });
  draft.outboxOrder.push(eventId);
}

function findLastScopedJobAudit(events, tenantId, environment) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.tenantId === tenantId && event?.environment === environment) return event;
  }
  return null;
}

function validateScopedJobAuditChain(events, tenantId, environment) {
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
      || hashJson(digestInput) !== eventDigest) {
      throw new MmcHttpError(500, 'JOB_AUDIT_CHAIN_INVALID',
        'The durable job audit chain failed integrity verification.');
    }
    previousEventDigest = eventDigest;
  }
}

function leaseView(job) {
  return Object.freeze({
    jobId: job.id,
    targetId: job.targetId,
    payloadHash: job.payloadHash,
    jobKind: job.jobKind,
    queueName: job.queueName,
    assetHandle: job.assetHandle,
    authorityGrantId: job.authorityGrantId,
    providerIdempotencyKeyDigest: job.providerIdempotencyKeyDigest,
    generation: job.generation,
    attempt: job.attempt,
    state: job.state,
    leaseExpiresAt: job.leaseExpiresAt,
  });
}

function requirePrincipal(principal) {
  if (!principal || typeof principal !== 'object'
    || typeof principal.id !== 'string' || !principal.id.trim()
    || typeof principal.tenantId !== 'string' || !principal.tenantId.trim()
    || typeof principal.environment !== 'string' || !principal.environment.trim()
    || !Array.isArray(principal.capabilities)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'A valid MMC principal is required.');
  }
  return principal;
}

function requireWorker(principal) {
  principal = requirePrincipal(principal);
  if (principal.role !== 'worker' || !principal.workloadId || !principal.queueName) {
    throw new MmcHttpError(403, 'WORKLOAD_PRINCIPAL_REQUIRED', 'A dedicated MMC workload principal is required.');
  }
  requireOpaqueId(principal.workloadId, 'workloadId');
  requireQueueName(principal.queueName);
  return principal;
}

function requireQueueName(value) {
  if (typeof value !== 'string') throw invalid('JOB_QUEUE_INVALID', 'queueName is invalid.');
  const text = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(text)) {
    throw invalid('JOB_QUEUE_INVALID', 'queueName is invalid.');
  }
  return text;
}

function assertExternalDisposition(job, disposition) {
  if (job.externalResult.generation !== job.generation) {
    throw conflict('EXTERNAL_RESULT_GENERATION_MISMATCH',
      'The provider outcome is not bound to the current lease generation.');
  }
  if (job.externalResult.outcome === 'SUCCEEDED' && disposition !== 'SUCCEEDED') {
    throw conflict('EXTERNAL_SUCCESS_MUST_COMMIT',
      'A confirmed provider success must be committed as succeeded and cannot be retried.');
  }
  if (disposition === 'SUCCEEDED' && job.externalResult.outcome !== 'SUCCEEDED') {
    throw conflict('EXTERNAL_SUCCESS_REQUIRED', 'A job can succeed only after a confirmed provider success.');
  }
  if (job.externalResult.outcome === 'OUTCOME_UNKNOWN') {
    if (disposition === 'SUCCEEDED' || disposition === 'FAILED') {
      throw conflict('OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION',
        'An unknown provider outcome requires read-before/reconciliation or an explicit dead letter.');
    }
    if (disposition === 'RETRY' && !job.externalResult.providerIdempotencyProven) {
      throw conflict('UNSAFE_EXTERNAL_RETRY',
        'An unknown provider outcome cannot be retried without a proven provider idempotency contract.');
    }
  }
}

function archiveCurrentExternalResult(job, resolution, resolvedAt) {
  job.externalResultHistory ||= [];
  job.externalResultHistory.push(Object.freeze({ ...job.externalResult, resolution, resolvedAt }));
  job.externalResult = null;
}

function archiveCurrentDispatchIntent(job, resolution, resolvedAt) {
  job.dispatchIntentHistory ||= [];
  if (job.dispatchIntent) {
    job.dispatchIntentHistory.push(Object.freeze({ ...job.dispatchIntent, resolution, resolvedAt }));
  }
  job.dispatchIntent = null;
}

function assertExactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalid('JOB_OBJECT_REQUIRED', 'A plain job request object is required.');
  }
  const unknown = Object.keys(value).filter((key) => !fields.includes(key));
  const missing = fields.filter((key) => !Object.hasOwn(value, key));
  if (unknown.length || missing.length) throw invalid('JOB_FIELDS_INVALID', 'The job request fields are invalid.');
}

function requireOpaqueId(value, label) {
  if (typeof value !== 'string') throw invalid('JOB_IDENTIFIER_INVALID', `${label} is invalid.`);
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(text)) throw invalid('JOB_IDENTIFIER_INVALID', `${label} is invalid.`);
  return text;
}

function requireHash(value, label) {
  if (typeof value !== 'string') throw invalid('JOB_HASH_INVALID', `${label} is invalid.`);
  const text = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(text)) throw invalid('JOB_HASH_INVALID', `${label} is invalid.`);
  return text;
}

function requireUuid(value, label) {
  const text = canonicalUuid(value);
  if (!text) {
    throw invalid('JOB_UUID_INVALID', `${label} is invalid.`);
  }
  return text;
}

function requireEnum(value, allowed, label) {
  if (typeof value !== 'string') throw invalid('JOB_ENUM_INVALID', `${label} is invalid.`);
  const text = value.trim();
  if (!allowed.has(text)) throw invalid('JOB_ENUM_INVALID', `${label} is invalid.`);
  return text;
}

function boundedInteger(value, fallback, minimum, maximum, label) {
  const number = value == null ? fallback : value;
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw invalid('JOB_INTEGER_INVALID', `${label} is invalid.`);
  }
  return number;
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function injectFailure(context, point) {
  if (context?.failurePoint === point) throw new Error(`Synthetic job transaction failure at ${point}.`);
}

function cloneState(state) {
  return {
    jobs: new Map([...state.jobs].map(([key, value]) => [key, structuredClone(value)])),
    enqueueReceipts: new Map([...state.enqueueReceipts].map(([key, value]) => [key, structuredClone(value)])),
    audit: structuredClone(state.audit),
    outbox: new Map([...state.outbox].map(([key, value]) => [key, structuredClone(value)])),
    outboxOrder: [...state.outboxOrder],
    outboxCursors: new Map(state.outboxCursors),
    inbox: new Map([...state.inbox].map(([key, value]) => [key, structuredClone(value)])),
    consumerEffects: new Map([...state.consumerEffects].map(([key, value]) => [key, structuredClone(value)])),
  };
}

function normalizeJobSeed(seed = {}) {
  const outbox = normalizeOutbox(seed.outbox);
  return cloneState({
    jobs: new Map(seed.jobs || []),
    enqueueReceipts: new Map(seed.enqueueReceipts || []),
    audit: [...(seed.audit || [])],
    outbox,
    outboxOrder: [...outbox.keys()],
    outboxCursors: new Map(),
    inbox: new Map(seed.inbox || []),
    consumerEffects: new Map(seed.consumerEffects || []),
  });
}

function normalizeOutbox(value) {
  if (value instanceof Map) return new Map(value);
  const events = Array.isArray(value) ? value : [];
  return new Map(events.map((event) => [event.id, {
    ...event,
    payloadDigest: event.payloadDigest || hashJson({
      jobId: event.jobId,
      generation: event.generation,
      topic: event.topic,
    }),
    aggregateKind: event.aggregateKind || 'JOB',
    aggregateId: event.aggregateId || event.jobId,
    effectKind: event.effectKind || 'PROJECTION_REFRESH',
    deliveryQueueName: event.deliveryQueueName || OUTBOX_QUEUE,
    deliveryState: event.deliveryState || event.state || 'PENDING',
    deliveryGeneration: event.deliveryGeneration || 0,
    deliveryLeaseOwner: event.deliveryLeaseOwner || null,
    deliveryLeaseExpiresAt: event.deliveryLeaseExpiresAt || null,
    deliveryAttempts: event.deliveryAttempts || 0,
    deliveredAt: event.deliveredAt || null,
  }]));
}

function findNextOutboxCandidate(draft, worker, queueName, now) {
  const cursorKey = `${worker.tenantId}\u001f${worker.environment}\u001f${queueName}`;
  const cursor = draft.outboxCursors.get(cursorKey) || 0;
  for (let index = cursor; index < draft.outboxOrder.length; index += 1) {
    const event = draft.outbox.get(draft.outboxOrder[index]);
    if (event && event.tenantId === worker.tenantId
      && event.environment === worker.environment
      && event.deliveryQueueName === queueName
      && event.deliveryState === 'PENDING') {
      return { event, pendingIndex: index, cursorKey };
    }
  }
  for (const event of draft.outbox.values()) {
    if (event.tenantId === worker.tenantId
      && event.environment === worker.environment
      && event.deliveryQueueName === queueName
      && event.deliveryState === 'LEASED'
      && event.deliveryLeaseExpiresAt
      && Date.parse(event.deliveryLeaseExpiresAt) <= now.getTime()) {
      return { event, pendingIndex: null, cursorKey };
    }
  }
  return null;
}

function immutableOutboxEnvelope(event) {
  return Object.freeze({
    id: event.id,
    tenantId: event.tenantId,
    environment: event.environment,
    topic: event.topic,
    jobId: event.jobId,
    generation: event.generation,
    aggregateKind: event.aggregateKind,
    aggregateId: event.aggregateId,
    effectKind: event.effectKind,
    payloadDigest: event.payloadDigest,
    deliveryQueueName: event.deliveryQueueName,
    createdAt: event.createdAt,
  });
}

function computeMmcOutboxEventHash(event) {
  return hashJson(immutableOutboxEnvelope(event));
}

function outboxLeaseView(event) {
  return Object.freeze({
    eventId: event.id,
    eventHash: computeMmcOutboxEventHash(event),
    deliveryGeneration: event.deliveryGeneration,
    deliveryLeaseExpiresAt: event.deliveryLeaseExpiresAt,
    topic: event.topic,
    payloadDigest: event.payloadDigest,
    aggregateKind: event.aggregateKind,
    aggregateId: event.aggregateId,
    effectKind: event.effectKind,
  });
}

function denyUnavailableAuthority() {
  throw new MmcHttpError(503, 'JOB_AUTHORITY_ADAPTER_REQUIRED',
    'The durable job authority adapter is not available.');
}

async function requireActiveAuthority(result) {
  if (await result !== true) {
    throw new MmcHttpError(403, 'JOB_AUTHORITY_DENIED', 'The job authority grant is not active.');
  }
}

function invalid(code, message) {
  return new MmcHttpError(422, code, message);
}

function conflict(code, message) {
  return new MmcHttpError(409, code, message);
}

export const MMC_JOB_TERMINAL_STATES = Object.freeze([...TERMINAL_STATES]);

export function hashMmcOutboxEvent(event) {
  return computeMmcOutboxEventHash(event);
}
