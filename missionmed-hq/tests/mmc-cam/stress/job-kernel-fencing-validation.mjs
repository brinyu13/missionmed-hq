import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  DurableJobKernel,
  MemoryJobRepository,
} from '../../../lib/mmc/jobs/durable-job-kernel.mjs';
import { MMC_CAPABILITIES, deriveMmcPrincipal } from '../../../lib/mmc/trust/security.mjs';

const mentor = Object.freeze({
  id: 'operator_006_primary', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'admin',
  capabilities: Object.freeze([MMC_CAPABILITIES.AI_QUEUE]),
});
const reconciler = Object.freeze({
  id: 'operator_006_reconciler', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'operator',
  capabilities: Object.freeze([MMC_CAPABILITIES.OPERATIONS]),
});
const worker = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_006_primary', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'worker',
    workloadId: 'workload_006_ingest', queueName: 'mmc.ingest',
  },
  principalId: 'worker_006_primary', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'worker',
  workloadId: 'workload_006_ingest', queueName: 'mmc.ingest',
  capabilities: [
    MMC_CAPABILITIES.WORKER_CLAIM,
    MMC_CAPABILITIES.WORKER_COMPLETE,
  ],
});
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const providerBinding = Object.freeze({
  providerIdempotencyKeyDigest: hash('stable-provider-key:tenant_006_alpha:session_006_0001'),
});
const dispatchInput = (lease) => ({
  jobId: lease.jobId,
  generation: lease.generation,
  providerIdempotencyKeyDigest: lease.providerIdempotencyKeyDigest,
});
const dispatcher = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_006_dispatcher', tenantId: worker.tenantId, environment: worker.environment, role: 'worker',
    workloadId: 'workload_006_outbox', queueName: 'mmc.outbox',
  },
  principalId: 'worker_006_dispatcher', tenantId: worker.tenantId, environment: worker.environment, role: 'worker',
  workloadId: 'workload_006_outbox', queueName: 'mmc.outbox',
  capabilities: [
    MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH,
    MMC_CAPABILITIES.WORKER_INBOX,
  ],
});
let nowMs = Date.parse('2026-07-15T12:00:00.000Z');
const clock = () => new Date(nowMs);
const repository = new MemoryJobRepository();
let authorityActive = true;
const approvedGrantIds = new Set(['grant_006_acquire_0001']);
const deniedRecoveryEvidenceHash = hash('operator recovery evidence denied by policy 006');
let observedReconcileDecision = null;
const authorize = ({ action, job, request, recovery, decision }) => {
  if (action === 'reconcile_expired_external_result') observedReconcileDecision = structuredClone(decision);
  const grantId = job?.authorityGrantId || request?.authorityGrantId;
  return authorityActive
    && recovery?.evidenceHash !== deniedRecoveryEvidenceHash
    && !(decision?.disposition === 'RETRY' && decision?.retryDelaySeconds === 13)
    && approvedGrantIds.has(grantId);
};
const kernel = new DurableJobKernel({ repository, clock, authorize });

const enqueueRequest = {
  idempotencyKey: 'job_idem_006_0001',
  targetId: '00600000-0000-4000-8000-000000000401',
  jobKind: 'ASSET_ACQUISITION',
  queueName: 'mmc.ingest',
  assetHandle: 'asset_006_opaque_0001',
  authorityGrantId: 'grant_006_acquire_0001',
  payloadHash: hash('synthetic bounded job'),
  ...providerBinding,
};
await assert.rejects(
  kernel.enqueue({ ...enqueueRequest, idempotencyKey: 12345678 }, { principal: mentor }),
  (error) => error?.code === 'JOB_IDENTIFIER_INVALID',
  'Typed job identifiers must never coerce numeric JSON values to strings.',
);
const enqueueResults = await Promise.all(Array.from({ length: 100 }, () => kernel.enqueue(enqueueRequest, { principal: mentor })));
assert.equal(enqueueResults.filter((entry) => !entry.replayed).length, 1);
assert.equal(new Set(enqueueResults.map((entry) => entry.jobId)).size, 1);
const jobId = enqueueResults[0].jobId;

await assert.rejects(
  kernel.claim({ jobId, queueName: worker.queueName, leaseSeconds: '15' }, { principal: worker }),
  (error) => error?.code === 'JOB_INTEGER_INVALID',
  'Typed lease numbers must never coerce JSON strings to integers.',
);

const claims = await Promise.allSettled(Array.from({ length: 1000 }, () => kernel.claim({
  jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker })));
assert.equal(claims.filter((entry) => entry.status === 'fulfilled').length, 1, 'CAS claim must elect one lease owner.');
const firstLease = claims.find((entry) => entry.status === 'fulfilled').value;
assert.equal(firstLease.generation, 1);
assert.equal(firstLease.targetId, enqueueRequest.targetId);
assert.equal(firstLease.authorityGrantId, enqueueRequest.authorityGrantId);

nowMs += 16_000;
const reacquire = await kernel.claim({ jobId, queueName: worker.queueName, leaseSeconds: 60 }, { principal: worker });
assert.equal(reacquire.generation, 2, 'An expired lease must increment the fencing generation.');
await assert.rejects(
  kernel.heartbeat({ jobId, generation: firstLease.generation, leaseSeconds: 60 }, { principal: worker }),
  (error) => error?.statusCode === 409 && error?.code === 'STALE_LEASE_GENERATION',
);
await kernel.start(dispatchInput(reacquire), { principal: worker });

authorityActive = false;
await assert.rejects(
  kernel.heartbeat({ jobId, generation: reacquire.generation, leaseSeconds: 60 }, { principal: worker }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
  'Every worker transition must recheck current authority and stop after revocation.',
);
authorityActive = true;

// Seed an exact, currently leased job with 10,000 authoritative outbox rows.
// Ten concurrent deliveries per logical event prove the atomic inbox boundary.
const runningJob = repository.snapshot().jobs.get(jobId);
const syntheticOutbox = Array.from({ length: 10_000 }, (_, event) => ({
  id: `10000000-0000-4000-8000-${String(event).padStart(12, '0')}`,
  tenantId: worker.tenantId,
  environment: worker.environment,
  topic: 'mmc.job.synthetic_projection',
  jobId,
  generation: reacquire.generation,
  aggregateKind: 'JOB',
  aggregateId: jobId,
  state: 'PENDING',
  createdAt: clock().toISOString(),
}));
const inboxRepository = new MemoryJobRepository({
  jobs: [[jobId, runningJob]],
  outbox: syntheticOutbox,
});
const inboxKernel = new DurableJobKernel({ repository: inboxRepository, clock, authorize });
let appliedDeliveries = 0;
let duplicateDeliveries = 0;
let firstDelivery;
let firstEffect;
for (let index = 0; index < syntheticOutbox.length; index += 1) {
  const event = syntheticOutbox[index];
  const delivery = await inboxKernel.claimOutbox({
    queueName: dispatcher.queueName,
    leaseSeconds: 60,
  }, { principal: dispatcher });
  assert.equal(delivery.eventId, event.id);
  assert.equal(delivery.aggregateKind, 'JOB');
  assert.equal(delivery.aggregateId, jobId);
  assert.equal(delivery.effectKind, 'PROJECTION_REFRESH');
  const effectResult = {
    effectKind: 'PROJECTION_REFRESH',
    targetKind: 'JOB',
    targetId: jobId,
    effectDigest: hash(`projection:${event.id}`),
  };
  const consumeInput = {
    eventId: delivery.eventId,
    eventHash: delivery.eventHash,
    deliveryGeneration: delivery.deliveryGeneration,
    effectResult,
  };
  const deliveries = await Promise.all(Array.from({ length: 10 }, () => (
    inboxKernel.consumeOnce(consumeInput, { principal: dispatcher })
  )));
  if (index === 0) {
    firstDelivery = delivery;
    firstEffect = effectResult;
  }
  appliedDeliveries += deliveries.filter((entry) => entry.applied).length;
  duplicateDeliveries += deliveries.filter((entry) => entry.duplicate).length;
}
assert.equal(inboxRepository.snapshot().consumerEffects.size, 10_000,
  'Consumer inbox must commit one repository effect for each logical event.');
assert.equal(appliedDeliveries, 10_000);
assert.equal(duplicateDeliveries, 90_000);
await assert.rejects(
  inboxKernel.consumeOnce({
    eventId: firstDelivery.eventId,
    eventHash: firstDelivery.eventHash,
    deliveryGeneration: firstDelivery.deliveryGeneration,
    effectResult: { ...firstEffect, effectDigest: hash('conflicting effect') },
  }, { principal: dispatcher }),
  (error) => error?.code === 'INBOX_EVENT_MISMATCH',
  'An inbox event cannot be replayed with a different projection effect.',
);
await assert.rejects(
  inboxKernel.consumeOnce({
    eventId: firstDelivery.eventId,
    eventHash: firstDelivery.eventHash,
    deliveryGeneration: firstDelivery.deliveryGeneration,
    effectResult: firstEffect,
    consumerId: 'caller_selected_consumer_forbidden',
  }, { principal: dispatcher }),
  (error) => error?.code === 'JOB_FIELDS_INVALID',
  'Consumer identity must be derived from the signed dispatcher scope, never caller-selected.',
);

// Outbox scan progress is isolated by signed tenant/environment/queue scope.
// A tenant that scans past another tenant's event must not starve that event.
const betaJobId = '20000000-0000-4000-8000-000000000001';
const betaTenantId = 'tenant_006_beta';
const betaDispatcher = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_006_dispatcher_beta', tenantId: betaTenantId, environment: worker.environment, role: 'worker',
    workloadId: 'workload_006_outbox_beta', queueName: 'mmc.outbox',
  },
  principalId: 'worker_006_dispatcher_beta', tenantId: betaTenantId, environment: worker.environment, role: 'worker',
  workloadId: 'workload_006_outbox_beta', queueName: 'mmc.outbox',
  capabilities: [MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH, MMC_CAPABILITIES.WORKER_INBOX],
});
const tenantCursorEvents = [
  {
    ...syntheticOutbox[0], id: '20000000-0000-4000-8000-000000000101',
    tenantId: betaTenantId, jobId: betaJobId, aggregateId: betaJobId,
  },
  { ...syntheticOutbox[1], id: '20000000-0000-4000-8000-000000000102' },
];
const tenantCursorRepository = new MemoryJobRepository({
  jobs: [
    [jobId, runningJob],
    [betaJobId, { ...runningJob, id: betaJobId, tenantId: betaTenantId }],
  ],
  outbox: tenantCursorEvents,
});
const tenantCursorKernel = new DurableJobKernel({ repository: tenantCursorRepository, clock, authorize });
assert.equal((await tenantCursorKernel.claimOutbox({
  queueName: dispatcher.queueName, leaseSeconds: 60,
}, { principal: dispatcher })).eventId, tenantCursorEvents[1].id);
assert.equal((await tenantCursorKernel.claimOutbox({
  queueName: betaDispatcher.queueName, leaseSeconds: 60,
}, { principal: betaDispatcher })).eventId, tenantCursorEvents[0].id,
'A cursor advance in another tenant scope must not hide this tenant event.');

await kernel.recordExternalResult({
  jobId,
  generation: reacquire.generation,
  outcome: 'OUTCOME_UNKNOWN',
  resultHash: hash('provider timeout after request'),
  providerReceiptId: 'provider_receipt_unknown_006',
  ...providerBinding,
}, { principal: worker });
await assert.rejects(
  kernel.recordExternalResult({
    jobId,
    generation: reacquire.generation,
    outcome: 'SUCCEEDED',
    resultHash: hash('attacker overwrite of provider outcome'),
    providerReceiptId: 'provider_receipt_overwrite_006',
    ...providerBinding,
  }, { principal: worker }),
  (error) => error?.code === 'EXTERNAL_RESULT_IMMUTABLE',
  'A provider outcome must be append-once for a lease.',
);
await assert.rejects(
  kernel.complete({ jobId, generation: reacquire.generation, disposition: 'RETRY', retryDelaySeconds: 10 }, { principal: worker }),
  (error) => error?.statusCode === 409 && error?.code === 'UNSAFE_EXTERNAL_RETRY',
);
const deadLetter = await kernel.complete({
  jobId, generation: reacquire.generation, disposition: 'DEAD_LETTER',
}, { principal: worker });
assert.equal(deadLetter.state, 'DEAD_LETTER');

// A consumer acknowledgement and an unrelated job transaction must serialize
// through the same repository commit boundary. This reproduces the historical
// snapshot/replace race that could erase an already acknowledged inbox effect.
const lostUpdateEvent = { ...syntheticOutbox[0], id: '10000000-0000-4000-8001-000000000001' };
const lostUpdateRepository = new MemoryJobRepository({
  jobs: [[jobId, runningJob]],
  outbox: [lostUpdateEvent],
});
let announceAuthorization;
let releaseAuthorization;
const authorizationStarted = new Promise((resolve) => { announceAuthorization = resolve; });
const authorizationRelease = new Promise((resolve) => { releaseAuthorization = resolve; });
const gatedAuthorize = async ({ action, job, request }) => {
  if (action === 'consume') {
    announceAuthorization();
    await authorizationRelease;
  }
  const grantId = job?.authorityGrantId || request?.authorityGrantId;
  return approvedGrantIds.has(grantId);
};
const lostUpdateKernelA = new DurableJobKernel({ repository: lostUpdateRepository, clock, authorize: gatedAuthorize });
const lostUpdateKernelB = new DurableJobKernel({ repository: lostUpdateRepository, clock, authorize: gatedAuthorize });
const lostDelivery = await lostUpdateKernelA.claimOutbox({
  queueName: dispatcher.queueName, leaseSeconds: 60,
}, { principal: dispatcher });
const consuming = lostUpdateKernelA.consumeOnce({
  eventId: lostDelivery.eventId,
  eventHash: lostDelivery.eventHash,
  deliveryGeneration: lostDelivery.deliveryGeneration,
  effectResult: {
    effectKind: 'PROJECTION_REFRESH',
    targetKind: 'JOB',
    targetId: jobId,
    effectDigest: hash('lost-update projection'),
  },
}, { principal: dispatcher });
await authorizationStarted;
const enqueuing = lostUpdateKernelB.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_concurrent_inbox',
}, { principal: mentor });
releaseAuthorization();
await Promise.all([consuming, enqueuing]);
const lostUpdateSnapshot = lostUpdateRepository.snapshot();
assert.equal(lostUpdateSnapshot.inbox.size, 1, 'Concurrent job commits must not erase inbox receipts.');
assert.equal(lostUpdateSnapshot.consumerEffects.size, 1, 'Concurrent job commits must not erase consumer effects.');
assert.equal(lostUpdateSnapshot.jobs.size, 2, 'Inbox commits must not erase either the leased or concurrent job.');

const multiKernelRepository = new MemoryJobRepository();
const multiKernelA = new DurableJobKernel({ repository: multiKernelRepository, clock, authorize });
const multiKernelB = new DurableJobKernel({ repository: multiKernelRepository, clock, authorize });
const multiKernelRequest = { ...enqueueRequest, idempotencyKey: 'job_idem_006_multi_kernel' };
const multiKernelResults = await Promise.all(Array.from({ length: 100 }, (_, index) => (
  (index % 2 ? multiKernelA : multiKernelB).enqueue(multiKernelRequest, { principal: mentor })
)));
assert.equal(multiKernelResults.filter((entry) => entry.replayed === false).length, 1,
  'Repository-level serialization must span every kernel instance.');
assert.equal(new Set(multiKernelResults.map((entry) => entry.jobId)).size, 1);
assert.equal(multiKernelRepository.snapshot().jobs.size, 1);

const knownSuccessRepository = new MemoryJobRepository();
const knownSuccessKernel = new DurableJobKernel({ repository: knownSuccessRepository, clock, authorize });
const knownEnqueue = await knownSuccessKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_known_success',
}, { principal: mentor });
const knownLease = await knownSuccessKernel.claim({
  jobId: knownEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 60,
}, { principal: worker });
await knownSuccessKernel.start(dispatchInput(knownLease), { principal: worker });
const knownResult = {
  jobId: knownEnqueue.jobId,
  generation: knownLease.generation,
  outcome: 'SUCCEEDED',
  resultHash: hash('known provider success 006'),
  providerReceiptId: 'provider_receipt_success_006',
  ...providerBinding,
};
await assert.rejects(
  knownSuccessKernel.recordExternalResult({
    ...knownResult,
    providerIdempotencyKeyDigest: hash('wrong-provider-key-result'),
  }, { principal: worker }),
  (error) => error?.code === 'PROVIDER_IDEMPOTENCY_KEY_MISMATCH',
  'A provider result cannot attach under a different idempotency key digest.',
);
assert.equal((await knownSuccessKernel.recordExternalResult(knownResult, { principal: worker })).replayed, false);
assert.equal((await knownSuccessKernel.recordExternalResult(knownResult, { principal: worker })).replayed, true);
await assert.rejects(
  knownSuccessKernel.complete({
    jobId: knownEnqueue.jobId,
    generation: knownLease.generation,
    disposition: 'RETRY',
    retryDelaySeconds: 1,
  }, { principal: worker }),
  (error) => error?.code === 'EXTERNAL_SUCCESS_MUST_COMMIT',
);
assert.equal((await knownSuccessKernel.complete({
  jobId: knownLease.jobId,
  generation: knownLease.generation,
  disposition: 'SUCCEEDED',
}, { principal: worker })).state, 'SUCCEEDED');
let terminalOutboxDelivered = false;
const terminalEventCount = [...knownSuccessRepository.snapshot().outbox.values()]
  .filter((event) => event.deliveryState === 'PENDING').length;
for (let index = 0; index < terminalEventCount; index += 1) {
  const delivery = await knownSuccessKernel.claimOutbox({
    queueName: dispatcher.queueName, leaseSeconds: 60,
  }, { principal: dispatcher });
  terminalOutboxDelivered ||= delivery.topic === 'mmc.job.job_succeeded';
  await knownSuccessKernel.consumeOnce({
    eventId: delivery.eventId,
    eventHash: delivery.eventHash,
    deliveryGeneration: delivery.deliveryGeneration,
    effectResult: {
      effectKind: 'PROJECTION_REFRESH',
      targetKind: 'JOB',
      targetId: knownLease.jobId,
      effectDigest: hash(`terminal-job-projection:${delivery.eventId}`),
    },
  }, { principal: dispatcher });
}
assert.equal(terminalOutboxDelivered, true,
  'A terminal producer event must remain deliverable after the producer lease is gone.');

// Provider results are append-once per lease generation, not forever. A
// confirmed failure may schedule a bounded retry; the next generation can then
// persist its own confirmed success without overwriting historical evidence.
const retryRepository = new MemoryJobRepository();
const retryKernel = new DurableJobKernel({ repository: retryRepository, clock, authorize });
const retryEnqueue = await retryKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_failed_then_success',
}, { principal: mentor });
const failedLease = await retryKernel.claim({
  jobId: retryEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 60,
}, { principal: worker });
await retryKernel.start(dispatchInput(failedLease), { principal: worker });
await retryKernel.recordExternalResult({
  jobId: failedLease.jobId,
  generation: failedLease.generation,
  outcome: 'FAILED',
  resultHash: hash('bounded provider failure 006'),
  providerReceiptId: 'provider_receipt_failed_006',
  ...providerBinding,
}, { principal: worker });
await assert.rejects(
  retryKernel.complete({
    jobId: failedLease.jobId, generation: failedLease.generation,
    disposition: 'RETRY', retryDelaySeconds: 13,
  }, { principal: worker }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
  'The current-authority adapter must receive and authorize the exact worker completion decision.',
);
await retryKernel.complete({
  jobId: failedLease.jobId, generation: failedLease.generation,
  disposition: 'RETRY', retryDelaySeconds: 0,
}, { principal: worker });
const retryAfterFailure = retryRepository.snapshot().jobs.get(retryEnqueue.jobId);
assert.equal(retryAfterFailure.externalResult, null);
assert.equal(retryAfterFailure.externalResultHistory.length, 1);
assert.equal(retryAfterFailure.externalResultHistory[0].generation, failedLease.generation);
const successLease = await retryKernel.claim({
  jobId: retryEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 60,
}, { principal: worker });
assert.equal(successLease.generation, failedLease.generation + 1);
await retryKernel.start(dispatchInput(successLease), { principal: worker });
await retryKernel.recordExternalResult({
  jobId: successLease.jobId,
  generation: successLease.generation,
  outcome: 'SUCCEEDED',
  resultHash: hash('bounded provider success after retry 006'),
  providerReceiptId: 'provider_receipt_retry_success_006',
  ...providerBinding,
}, { principal: worker });
assert.equal((await retryKernel.complete({
  jobId: successLease.jobId, generation: successLease.generation, disposition: 'SUCCEEDED',
}, { principal: worker })).state, 'SUCCEEDED');

// An unknown outcome may retry only when the server-owned provider policy
// proves idempotency. The result is archived to the old generation before the
// next lease is issued.
const idempotentRepository = new MemoryJobRepository();
const idempotentKernel = new DurableJobKernel({
  repository: idempotentRepository,
  clock,
  authorize,
  providerIdempotencyPolicy: async () => true,
});
const idempotentEnqueue = await idempotentKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_unknown_idempotent_retry',
}, { principal: mentor });
const unknownLease = await idempotentKernel.claim({
  jobId: idempotentEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 60,
}, { principal: worker });
await idempotentKernel.start(dispatchInput(unknownLease), { principal: worker });
await idempotentKernel.recordExternalResult({
  jobId: unknownLease.jobId,
  generation: unknownLease.generation,
  outcome: 'OUTCOME_UNKNOWN',
  resultHash: hash('unknown but provider-idempotent 006'),
  providerReceiptId: 'provider_receipt_unknown_idempotent_006',
  ...providerBinding,
}, { principal: worker });
assert.equal((await idempotentKernel.complete({
  jobId: unknownLease.jobId, generation: unknownLease.generation,
  disposition: 'RETRY', retryDelaySeconds: 0,
}, { principal: worker })).state, 'RETRY_SCHEDULED');
const idempotentRetryLease = await idempotentKernel.claim({
  jobId: unknownLease.jobId, queueName: worker.queueName, leaseSeconds: 60,
}, { principal: worker });
assert.equal(idempotentRetryLease.generation, unknownLease.generation + 1);
assert.equal(idempotentRetryLease.providerIdempotencyKeyDigest, unknownLease.providerIdempotencyKeyDigest,
  'Every generation must reuse the immutable provider idempotency key digest.');
await assert.rejects(
  idempotentKernel.start({
    ...dispatchInput(idempotentRetryLease),
    providerIdempotencyKeyDigest: hash('attacker-rebound-provider-key'),
  }, { principal: worker }),
  (error) => error?.code === 'PROVIDER_IDEMPOTENCY_KEY_MISMATCH',
  'A retry generation cannot rebind the provider idempotency key.',
);

// Crash-window reconciliation resolves an exact, recorded provider result
// after lease expiry without issuing another provider effect.
const crashRepository = new MemoryJobRepository();
const crashKernel = new DurableJobKernel({ repository: crashRepository, clock, authorize });
const crashEnqueue = await crashKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_crash_reconcile',
}, { principal: mentor });
const crashLease = await crashKernel.claim({
  jobId: crashEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
await crashKernel.start(dispatchInput(crashLease), { principal: worker });
await crashKernel.recordExternalResult({
  jobId: crashLease.jobId,
  generation: crashLease.generation,
  outcome: 'SUCCEEDED',
  resultHash: hash('provider succeeded before worker crash 006'),
  providerReceiptId: 'provider_receipt_crash_success_006',
  ...providerBinding,
}, { principal: worker });
nowMs += 16_000;
await assert.rejects(
  crashKernel.claim({
    jobId: crashLease.jobId, queueName: worker.queueName, leaseSeconds: 60,
  }, { principal: worker }),
  (error) => error?.code === 'EXTERNAL_RESULT_RECONCILIATION_REQUIRED',
);
await assert.rejects(
  crashKernel.complete({
    jobId: crashLease.jobId, generation: crashLease.generation, disposition: 'SUCCEEDED',
  }, { principal: worker }),
  (error) => error?.code === 'JOB_LEASE_EXPIRED',
);
await assert.rejects(
  crashKernel.adjudicateRecordedExternalResult({
    jobId: crashLease.jobId,
    generation: crashLease.generation,
    disposition: 'SUCCEEDED',
    evidenceHash: deniedRecoveryEvidenceHash,
    retryDelaySeconds: 0,
  }, { principal: reconciler }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
  'The authority adapter must receive and authorize the exact recorded-result adjudication evidence.',
);
const reconciledCrash = await crashKernel.adjudicateRecordedExternalResult({
  jobId: crashLease.jobId,
  generation: crashLease.generation,
  disposition: 'SUCCEEDED',
  evidenceHash: hash('operator exact recorded-result evidence 006'),
  retryDelaySeconds: 0,
}, { principal: reconciler });
assert.equal(reconciledCrash.state, 'SUCCEEDED');
assert.equal(reconciledCrash.reconciledByOperator, true,
  'Operations must reconcile a recorded result when the original workload is unavailable.');

// A provider response can itself arrive just after lease expiry. The exact
// unchanged generation may append that result, but must reconcile it rather
// than complete directly or allow another provider attempt.
const lateResultRepository = new MemoryJobRepository();
const lateResultKernel = new DurableJobKernel({ repository: lateResultRepository, clock, authorize });
const lateResultEnqueue = await lateResultKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_provider_returned_after_expiry',
}, { principal: mentor });
const lateResultLease = await lateResultKernel.claim({
  jobId: lateResultEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
await lateResultKernel.start(dispatchInput(lateResultLease), { principal: worker });
nowMs += 16_000;
await assert.rejects(
  lateResultKernel.claim({
    jobId: lateResultLease.jobId, queueName: worker.queueName, leaseSeconds: 60,
  }, { principal: worker }),
  (error) => error?.code === 'EXPIRED_DISPATCH_RECONCILIATION_REQUIRED',
  'A replacement worker cannot race a late provider result by reclaiming an expired running job.',
);
const lateResult = await lateResultKernel.recordExternalResult({
  jobId: lateResultLease.jobId,
  generation: lateResultLease.generation,
  outcome: 'SUCCEEDED',
  resultHash: hash('provider returned success after lease expiry 006'),
  providerReceiptId: 'provider_receipt_late_success_006',
  ...providerBinding,
}, { principal: worker });
assert.equal(lateResult.recordedAfterLeaseExpiry, true);
assert.equal(lateResult.reconciliationRequired, true);
await assert.rejects(
  lateResultKernel.claim({
    jobId: lateResultLease.jobId, queueName: worker.queueName, leaseSeconds: 60,
  }, { principal: worker }),
  (error) => error?.code === 'EXTERNAL_RESULT_RECONCILIATION_REQUIRED',
  'A late known result must fence a replacement claim.',
);
await assert.rejects(
  lateResultKernel.complete({
    jobId: lateResultLease.jobId, generation: lateResultLease.generation, disposition: 'SUCCEEDED',
  }, { principal: worker }),
  (error) => error?.code === 'JOB_LEASE_EXPIRED',
);
assert.equal((await lateResultKernel.reconcileExpiredResult({
  jobId: lateResultLease.jobId, generation: lateResultLease.generation, disposition: 'SUCCEEDED',
}, { principal: worker })).state, 'SUCCEEDED');
assert.deepEqual(observedReconcileDecision, { disposition: 'SUCCEEDED', retryDelaySeconds: 0 },
  'The reconciliation authority decision must receive the exact worker-selected disposition.');

// If no provider result ever arrives, only an authorized recovery adjudication
// can unstick an expired RUNNING generation. Confirmed-not-sent may retry;
// unknown outcome must dead-letter and cannot be converted into a blind retry.
const recoveryRepository = new MemoryJobRepository();
const recoveryKernel = new DurableJobKernel({ repository: recoveryRepository, clock, authorize });
const recoveryEnqueue = await recoveryKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_expired_running_recovery',
}, { principal: mentor });
const recoveryLease = await recoveryKernel.claim({
  jobId: recoveryEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
await recoveryKernel.start(dispatchInput(recoveryLease), { principal: worker });
nowMs += 16_000;
await assert.rejects(
  recoveryKernel.adjudicateExpiredRunning({
    jobId: recoveryLease.jobId,
    generation: recoveryLease.generation,
    finding: 'CONFIRMED_NOT_SENT',
    evidenceHash: hash('operator provider-not-sent evidence 006'),
  }, { principal: worker }),
  (error) => error?.code === 'CAPABILITY_REQUIRED',
  'A workload principal cannot self-adjudicate its expired provider attempt.',
);
await assert.rejects(
  recoveryKernel.adjudicateExpiredRunning({
    jobId: recoveryLease.jobId,
    generation: recoveryLease.generation,
    finding: 'CONFIRMED_NOT_SENT',
    evidenceHash: deniedRecoveryEvidenceHash,
    retryDelaySeconds: 0,
  }, { principal: reconciler }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
  'Recovery finding and evidence must be visible to the current-authority decision.',
);
const recoveredRetry = await recoveryKernel.adjudicateExpiredRunning({
  jobId: recoveryLease.jobId,
  generation: recoveryLease.generation,
  finding: 'CONFIRMED_NOT_SENT',
  evidenceHash: hash('operator provider-not-sent evidence 006'),
  retryDelaySeconds: 0,
}, { principal: reconciler });
assert.equal(recoveredRetry.state, 'RETRY_SCHEDULED');
const recoveryRetryLease = await recoveryKernel.claim({
  jobId: recoveryLease.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
assert.equal(recoveryRetryLease.generation, recoveryLease.generation + 1);
assert.equal(recoveryRepository.snapshot().jobs.get(recoveryLease.jobId).recoveryHistory.length, 1);

const unknownRecoveryRepository = new MemoryJobRepository();
const unknownRecoveryKernel = new DurableJobKernel({ repository: unknownRecoveryRepository, clock, authorize });
const unknownRecoveryEnqueue = await unknownRecoveryKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_expired_running_unknown',
}, { principal: mentor });
const unknownRecoveryLease = await unknownRecoveryKernel.claim({
  jobId: unknownRecoveryEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
await unknownRecoveryKernel.start(dispatchInput(unknownRecoveryLease), { principal: worker });
nowMs += 16_000;
assert.equal((await unknownRecoveryKernel.adjudicateExpiredRunning({
  jobId: unknownRecoveryLease.jobId,
  generation: unknownRecoveryLease.generation,
  finding: 'OUTCOME_UNKNOWN',
  evidenceHash: hash('operator unknown-outcome evidence 006'),
}, { principal: reconciler })).state, 'DEAD_LETTER');
await assert.rejects(
  unknownRecoveryKernel.claim({
    jobId: unknownRecoveryLease.jobId, queueName: worker.queueName, leaseSeconds: 15,
  }, { principal: worker }),
  (error) => error?.code === 'JOB_NOT_CLAIMABLE',
);

// Revocation stops completion but does not discard a provider outcome already
// issued by the exact lease. The quarantined result fences retry until current
// authority permits reconciliation.
const revokedResultRepository = new MemoryJobRepository();
const revokedResultKernel = new DurableJobKernel({ repository: revokedResultRepository, clock, authorize });
const revokedResultEnqueue = await revokedResultKernel.enqueue({
  ...enqueueRequest,
  idempotencyKey: 'job_idem_006_result_after_revocation',
}, { principal: mentor });
const revokedResultLease = await revokedResultKernel.claim({
  jobId: revokedResultEnqueue.jobId, queueName: worker.queueName, leaseSeconds: 15,
}, { principal: worker });
await revokedResultKernel.start(dispatchInput(revokedResultLease), { principal: worker });
authorityActive = false;
const revokedEvidence = await revokedResultKernel.recordExternalResult({
  jobId: revokedResultLease.jobId,
  generation: revokedResultLease.generation,
  outcome: 'SUCCEEDED',
  resultHash: hash('provider succeeded as authority was revoked 006'),
  providerReceiptId: 'provider_receipt_revoked_success_006',
  ...providerBinding,
}, { principal: worker });
assert.equal(revokedEvidence.authorityActiveAtRecord, false);
assert.equal(revokedEvidence.reconciliationRequired, true);
assert.equal(
  [...revokedResultRepository.snapshot().outbox.values()]
    .find((event) => event.topic === 'mmc.job.external_succeeded')?.deliveryState,
  'QUARANTINED',
  'Provider evidence recorded across revocation must never enter the dispatchable projection lane.',
);
await assert.rejects(
  revokedResultKernel.complete({
    jobId: revokedResultLease.jobId, generation: revokedResultLease.generation, disposition: 'SUCCEEDED',
  }, { principal: worker }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
);
nowMs += 16_000;
authorityActive = true;
await assert.rejects(
  revokedResultKernel.claim({
    jobId: revokedResultLease.jobId, queueName: worker.queueName, leaseSeconds: 15,
  }, { principal: worker }),
  (error) => error?.code === 'EXTERNAL_RESULT_RECONCILIATION_REQUIRED',
);
assert.equal((await revokedResultKernel.reconcileExpiredResult({
  jobId: revokedResultLease.jobId, generation: revokedResultLease.generation, disposition: 'SUCCEEDED',
}, { principal: worker })).state, 'SUCCEEDED');

await assert.rejects(
  kernel.recordExternalResult({
    jobId: firstLease.jobId,
    generation: firstLease.generation,
    outcome: 'SUCCEEDED',
    resultHash: hash('stale provider response after a newer claim 006'),
    providerReceiptId: 'provider_receipt_stale_generation_006',
    ...providerBinding,
  }, { principal: worker }),
  (error) => error?.code === 'STALE_LEASE_GENERATION',
  'A late result cannot attach after a newer generation has been claimed.',
);

await assert.rejects(
  retryKernel.claim({
    jobId: retryEnqueue.jobId, queueName: 'mmc.attacker', leaseSeconds: 60,
  }, { principal: worker }),
  (error) => error?.statusCode === 404 && error?.code === 'JOB_NOT_FOUND',
  'The signed worker queue and requested queue must match exactly.',
);

const failClosedRepository = new MemoryJobRepository();
await assert.rejects(
  new DurableJobKernel({ repository: failClosedRepository, clock }).enqueue({
    ...enqueueRequest,
    idempotencyKey: 'job_idem_006_missing_authority_adapter',
  }, { principal: mentor }),
  (error) => error?.code === 'JOB_AUTHORITY_ADAPTER_REQUIRED',
);
await assert.rejects(
  new DurableJobKernel({ repository: failClosedRepository, clock, authorize: async () => false }).enqueue({
    ...enqueueRequest,
    idempotencyKey: 'job_idem_006_async_false_authority',
  }, { principal: mentor }),
  (error) => error?.code === 'JOB_AUTHORITY_DENIED',
);
assert.equal(failClosedRepository.snapshot().jobs.size, 0);

const tamperedJobAudit = structuredClone(repository.snapshot().audit[0]);
tamperedJobAudit.eventDigest = 'f'.repeat(64);
const tamperedJobAuditRepository = new MemoryJobRepository({
  jobs: [[jobId, runningJob]],
  audit: [tamperedJobAudit],
});
await assert.rejects(
  new DurableJobKernel({ repository: tamperedJobAuditRepository, clock, authorize }).enqueue({
    ...enqueueRequest,
    idempotencyKey: 'job_idem_006_tampered_audit',
  }, { principal: mentor }),
  (error) => error?.code === 'JOB_AUDIT_CHAIN_INVALID',
  'A rewritten job audit digest must stop the next scoped transition atomically.',
);
assert.equal(tamperedJobAuditRepository.snapshot().jobs.size, 1);

const rollbackRepository = new MemoryJobRepository();
const rollbackKernel = new DurableJobKernel({ repository: rollbackRepository, clock, authorize });
await assert.rejects(
  rollbackKernel.enqueue({ ...enqueueRequest, idempotencyKey: 'job_idem_006_rollback' }, {
    principal: mentor,
    failurePoint: 'after_enqueue',
  }),
  /Synthetic job transaction failure/u,
);
const rollback = rollbackRepository.snapshot();
assert.equal(rollback.jobs.size, 0);
assert.equal(rollback.audit.length, 0);
assert.equal(rollback.outbox.size, 0);

const outboxRollbackEvent = { ...syntheticOutbox[0], id: '10000000-0000-4000-8002-000000000001' };
const outboxRollbackRepository = new MemoryJobRepository({
  jobs: [[jobId, runningJob]],
  outbox: [outboxRollbackEvent],
});
const outboxRollbackKernel = new DurableJobKernel({ repository: outboxRollbackRepository, clock, authorize });
const outboxRollbackLease = await outboxRollbackKernel.claimOutbox({
  queueName: dispatcher.queueName, leaseSeconds: 60,
}, { principal: dispatcher });
const outboxRollbackInput = {
  eventId: outboxRollbackLease.eventId,
  eventHash: outboxRollbackLease.eventHash,
  deliveryGeneration: outboxRollbackLease.deliveryGeneration,
  effectResult: {
    effectKind: 'PROJECTION_REFRESH',
    targetKind: 'JOB',
    targetId: jobId,
    effectDigest: hash('atomic outbox rollback effect'),
  },
};
await assert.rejects(
  outboxRollbackKernel.consumeOnce({
    ...outboxRollbackInput,
    effectResult: { ...outboxRollbackInput.effectResult, targetId: betaJobId },
  }, { principal: dispatcher }),
  (error) => error?.code === 'OUTBOX_EFFECT_TARGET_MISMATCH',
  'A consumer cannot redirect a server-bound outbox effect to another aggregate.',
);
await assert.rejects(
  outboxRollbackKernel.consumeOnce(outboxRollbackInput, {
    principal: dispatcher,
    failurePoint: 'before_consumer_effect_commit',
  }),
  /Synthetic job transaction failure/u,
);
let outboxRollbackSnapshot = outboxRollbackRepository.snapshot();
assert.equal(outboxRollbackSnapshot.inbox.size, 0);
assert.equal(outboxRollbackSnapshot.consumerEffects.size, 0);
assert.equal(outboxRollbackSnapshot.outbox.get(outboxRollbackLease.eventId).deliveryState, 'LEASED');
assert.equal((await outboxRollbackKernel.consumeOnce(
  outboxRollbackInput, { principal: dispatcher },
)).applied, true);
outboxRollbackSnapshot = outboxRollbackRepository.snapshot();
assert.equal(outboxRollbackSnapshot.inbox.size, 1);
assert.equal(outboxRollbackSnapshot.consumerEffects.size, 1);
assert.equal(outboxRollbackSnapshot.outbox.get(outboxRollbackLease.eventId).deliveryState, 'DELIVERED');

console.log(JSON.stringify({
  result: 'MMC v2 durable job fencing validation passed',
  concurrentLeaseAttempts: 1000,
  electedLeases: 1,
  staleGenerationRejected: true,
  unknownOutcomeUnsafeRetryRejected: true,
  externalResultAppendOnce: true,
  stableProviderIdempotencyKeyBoundAcrossGenerations: true,
  logicalOutboxEvents: 10_000,
  deliveries: 100_000,
  consumerEffects: inboxRepository.snapshot().consumerEffects.size,
  terminalProducerEventDelivered: terminalOutboxDelivered,
  callerSelectedConsumerIdentityRejected: true,
  atomicOutboxEffectReceiptDelivery: true,
  authorityRevocationRechecked: true,
  tenantScopedOutboxCursor: true,
  exactOutboxEffectTargetBound: true,
  dispatcherLeaseIncludesEffectBinding: true,
  concurrentInboxLostUpdateRejected: true,
  multiKernelRepositorySerialization: true,
  knownProviderSuccessRetryRejected: true,
  generationBoundRetryThenSuccess: true,
  providerIdempotentUnknownRetry: true,
  expiredLeaseResultReconciledWithoutOriginalWorkload: true,
  providerReturnAfterExpiryRecordedThenReconciled: true,
  expiredRunningJobNotBlindlyReclaimed: true,
  expiredRunningOperatorRecoveryAudited: true,
  recoveryEvidenceAuthorityBound: true,
  completionDecisionAuthorityBound: true,
  revokedAuthorityProviderOutcomePreserved: true,
  providerEvidenceQuarantinedUntilAdjudicated: true,
  tamperEvidentJobAuditChain: true,
  exactWorkerQueueBinding: true,
  authorityAdapterFailClosed: true,
  injectedRollbackAtomic: true,
}, null, 2));
