import assert from 'node:assert/strict';

import { MmcCommandKernel, MemoryCommandRepository } from '../../../lib/mmc/commands/command-kernel.mjs';
import { validateCommandEnvelope } from '../../../lib/mmc/contracts/command-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError } from '../../../lib/mmc/trust/security.mjs';

const principal = Object.freeze({
  id: 'mentor_006_primary',
  tenantId: 'tenant_006_alpha',
  environment: 'LOCAL',
  role: 'mentor',
  capabilities: Object.freeze([MMC_CAPABILITIES.COMMAND]),
});

const baseCommand = Object.freeze({
  commandId: '00600000-0000-4000-8000-000000000001',
  idempotencyKey: 'idem_task_006_0001',
  expectedVersion: 0,
  targetId: 'task_006_0001',
  kind: 'task.upsert',
  purpose: 'Record a bounded synthetic mentor task.',
  payload: Object.freeze({
    title: 'Review the evidence envelope',
    ownerType: 'MENTOR',
    status: 'ACCEPTED',
    sensitivity: 'NORMAL',
  }),
  schemaVersion: 1,
});

const uuidV7Command = validateCommandEnvelope({
  ...baseCommand,
  commandId: '0190f3f2-7f7a-7cc8-9a9b-123456789abc',
});
assert.equal(uuidV7Command.commandId, '0190f3f2-7f7a-7cc8-9a9b-123456789abc',
  'The canonical wire UUID contract must admit RFC 9562 UUIDv7 identifiers.');
assert.throws(
  () => validateCommandEnvelope({
    ...baseCommand,
    commandId: '0190f3f2-7f7a-9cc8-9a9b-123456789abc',
  }),
  (error) => error?.code === 'COMMAND_UUID_INVALID',
  'Undefined UUID versions must fail the canonical wire boundary.',
);
assert.throws(
  () => validateCommandEnvelope({ ...baseCommand, idempotencyKey: 12345678 }),
  (error) => error?.code === 'COMMAND_IDENTIFIER_INVALID',
  'Typed command identifiers must never coerce numeric JSON values to strings.',
);

for (const dueAt of [
  '2026-02-29T17:00:00.000Z',
  '2026-04-31T17:00:00.000Z',
]) {
  assert.throws(
    () => validateCommandEnvelope({
      ...baseCommand,
      payload: { ...baseCommand.payload, dueAt },
    }),
    (error) => error?.code === 'COMMAND_TIMESTAMP_INVALID',
    `Command timestamps must reject silently normalized calendar value ${dueAt}.`,
  );
}

const repository = new MemoryCommandRepository();
let authorized = true;
const kernel = new MmcCommandKernel({
  repository,
  authorize: ({ principal: current }) => {
    if (!authorized || !current.capabilities.includes(MMC_CAPABILITIES.COMMAND)) {
      throw new MmcHttpError(403, 'ASSIGNMENT_REVOKED', 'The current mentor assignment is not active.');
    }
    return true;
  },
});

const results = await Promise.all(Array.from({ length: 100 }, () => kernel.execute(baseCommand, {
  principal,
  correlationId: 'corr_006_command_0001',
})));
assert.equal(results.filter((result) => result.replayed === false).length, 1);
assert.equal(results.filter((result) => result.replayed === true).length, 99);
assert.equal(new Set(results.map((result) => result.auditId)).size, 1);
assert.equal(new Set(results.map((result) => result.aggregateVersion)).size, 1);
assert.deepEqual(results[0].objectResults, [{ id: baseCommand.targetId, kind: 'TASK', version: 1 }]);

let snapshot = repository.snapshot();
assert.equal(snapshot.aggregates.size, 1, 'One canonical aggregate must be committed.');
assert.equal(snapshot.receipts.size, 1, 'One idempotency receipt must be committed.');
assert.equal(snapshot.commandIds.size, 1, 'One scoped command identifier must be committed.');
assert.equal(snapshot.audit.length, 1, 'Audit must be atomic and duplicate-safe.');
assert.equal(snapshot.outbox.length, 1, 'Outbox must be atomic and duplicate-safe.');

await assert.rejects(
  kernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000002',
    payload: { ...baseCommand.payload, title: 'Changed semantic payload' },
  }, { principal, correlationId: 'corr_006_command_0002' }),
  (error) => error?.statusCode === 409 && error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH',
);

await assert.rejects(
  kernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000020',
  }, { principal, correlationId: 'corr_006_command_idem_command_mismatch' }),
  (error) => error?.statusCode === 409 && error?.code === 'IDEMPOTENCY_COMMAND_ID_MISMATCH',
  'The same idempotency scope cannot be rebound to another command identifier.',
);

await assert.rejects(
  kernel.execute({
    ...baseCommand,
    idempotencyKey: 'idem_task_006_same_command_new_scope',
  }, { principal, correlationId: 'corr_006_command_scope_mismatch' }),
  (error) => error?.statusCode === 409 && error?.code === 'COMMAND_ID_SCOPE_MISMATCH',
  'A command identifier cannot be rebound to another idempotency scope.',
);

await assert.rejects(
  kernel.execute({
    ...baseCommand,
    idempotencyKey: 'idem_task_006_same_command_changed',
    payload: { ...baseCommand.payload, title: 'Different command semantics' },
  }, { principal, correlationId: 'corr_006_command_payload_mismatch' }),
  (error) => error?.statusCode === 409 && error?.code === 'COMMAND_ID_PAYLOAD_MISMATCH',
  'A command identifier cannot be rebound to different semantics.',
);

snapshot = repository.snapshot();
assert.equal(snapshot.commandIds.size, 1);
assert.equal(snapshot.audit.length, 1);
assert.equal(snapshot.outbox.length, 1);

await assert.rejects(
  kernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000003',
    idempotencyKey: 'idem_task_006_0002',
  }, { principal, correlationId: 'corr_006_command_0003' }),
  (error) => error?.statusCode === 409 && error?.code === 'VERSION_CONFLICT'
    && error?.details?.expectedVersion === 0
    && error?.details?.currentVersion === 1
    && error?.details?.resolution === 'COMPARE_AND_REAPPLY',
);

authorized = false;
await assert.rejects(
  kernel.execute(baseCommand, { principal, correlationId: 'corr_006_command_0004' }),
  (error) => error?.statusCode === 403 && error?.code === 'ASSIGNMENT_REVOKED',
  'A receipt replay must recheck current authority before returning any result.',
);
authorized = true;

const commitRaceRepository = new MemoryCommandRepository();
let releaseCommitRaceHandler;
let commitRaceHandlerEntered;
const commitRaceHandlerStarted = new Promise((resolve) => { commitRaceHandlerEntered = resolve; });
let commitRaceAuthorityActive = true;
const commitRaceKernel = new MmcCommandKernel({
  repository: commitRaceRepository,
  authorize: async () => commitRaceAuthorityActive,
  handlers: {
    'task.upsert': async ({ command }) => {
      commitRaceHandlerEntered();
      await new Promise((resolve) => { releaseCommitRaceHandler = resolve; });
      return { aggregate: { id: command.targetId, kind: 'TASK' }, lineage: [] };
    },
  },
});
const commitRaceExecution = commitRaceKernel.execute({
  ...baseCommand,
  commandId: '00600000-0000-4000-8000-000000000006',
  idempotencyKey: 'idem_task_006_commit_authority_race',
  targetId: 'task_006_commit_authority_race',
}, { principal, correlationId: 'corr_006_commit_authority_race' });
await commitRaceHandlerStarted;
commitRaceAuthorityActive = false;
releaseCommitRaceHandler();
await assert.rejects(
  commitRaceExecution,
  (error) => error?.statusCode === 403 && error?.code === 'COMMAND_AUTHORITY_DENIED',
  'Authority revoked during an asynchronous handler must be rechecked immediately before commit.',
);
snapshot = commitRaceRepository.snapshot();
assert.equal(snapshot.aggregates.size, 0);
assert.equal(snapshot.receipts.size, 0);
assert.equal(snapshot.audit.length, 0);
assert.equal(snapshot.outbox.length, 0);

for (const [label, authorizationResult] of [
  ['false', false],
  ['null', null],
  ['undefined', undefined],
  ['number', 1],
  ['string', 'true'],
  ['object', {}],
]) {
  const deniedRepository = new MemoryCommandRepository();
  const deniedKernel = new MmcCommandKernel({
    repository: deniedRepository,
    authorize: async () => authorizationResult,
  });
  await assert.rejects(
    deniedKernel.execute({
      ...baseCommand,
      commandId: `00600000-0000-4000-8000-${String(30 + label.length).padStart(12, '0')}`,
      idempotencyKey: `idem_task_006_denied_${label}`,
      targetId: `task_006_denied_${label}`,
    }, { principal, correlationId: `corr_006_command_denied_${label}` }),
    (error) => error?.statusCode === 403 && error?.code === 'COMMAND_AUTHORITY_DENIED',
    `Only literal true may authorize a command adapter (${label}).`,
  );
  const deniedSnapshot = deniedRepository.snapshot();
  assert.equal(deniedSnapshot.aggregates.size, 0);
  assert.equal(deniedSnapshot.receipts.size, 0);
  assert.equal(deniedSnapshot.commandIds.size, 0);
  assert.equal(deniedSnapshot.audit.length, 0);
  assert.equal(deniedSnapshot.lineage.length, 0);
  assert.equal(deniedSnapshot.outbox.length, 0);
}

const rollbackRepository = new MemoryCommandRepository();
const rollbackKernel = new MmcCommandKernel({ repository: rollbackRepository });
await assert.rejects(
  rollbackKernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000004',
    idempotencyKey: 'idem_task_006_rollback',
    targetId: 'task_006_rollback',
  }, {
    principal,
    correlationId: 'corr_006_command_rollback',
    failurePoint: 'after_audit',
  }),
  /Synthetic transaction failure/u,
);
snapshot = rollbackRepository.snapshot();
assert.equal(snapshot.aggregates.size, 0);
assert.equal(snapshot.receipts.size, 0);
assert.equal(snapshot.commandIds.size, 0);
assert.equal(snapshot.audit.length, 0);
assert.equal(snapshot.lineage.length, 0);
assert.equal(snapshot.outbox.length, 0);

await assert.rejects(
  rollbackKernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000005',
    idempotencyKey: 'idem_task_006_authority',
    targetId: 'task_006_authority',
    payload: { ...baseCommand.payload, assignmentId: 'caller_authored_assignment' },
  }, { principal, correlationId: 'corr_006_command_auth' }),
  (error) => error?.statusCode === 422,
);

const commandIdRaceRepository = new MemoryCommandRepository();
const commandIdRaceKernel = new MmcCommandKernel({ repository: commandIdRaceRepository });
const commandIdRaceBase = {
  ...baseCommand,
  commandId: '00600000-0000-4000-8000-000000000060',
  targetId: 'task_006_command_id_race',
};
const commandIdRace = await Promise.allSettled([
  commandIdRaceKernel.execute({
    ...commandIdRaceBase,
    idempotencyKey: 'idem_task_006_command_race_a',
  }, { principal, correlationId: 'corr_006_command_race_a' }),
  commandIdRaceKernel.execute({
    ...commandIdRaceBase,
    idempotencyKey: 'idem_task_006_command_race_b',
  }, { principal, correlationId: 'corr_006_command_race_b' }),
]);
assert.equal(commandIdRace.filter((entry) => entry.status === 'fulfilled').length, 1);
assert.equal(commandIdRace.filter((entry) => (
  entry.status === 'rejected' && entry.reason?.code === 'COMMAND_ID_SCOPE_MISMATCH'
)).length, 1);
snapshot = commandIdRaceRepository.snapshot();
assert.equal(snapshot.commandIds.size, 1);
assert.equal(snapshot.receipts.size, 1);
assert.equal(snapshot.audit.length, 1);
assert.equal(snapshot.outbox.length, 1);

const otherTenantPrincipal = Object.freeze({
  ...principal,
  tenantId: 'tenant_006_beta',
});
const scopedCommandResult = await kernel.execute(baseCommand, {
  principal: otherTenantPrincipal,
  correlationId: 'corr_006_command_other_tenant',
});
assert.equal(scopedCommandResult.replayed, false, 'Command identifiers are unique within exact tenant/environment scope.');
snapshot = repository.snapshot();
assert.equal(snapshot.commandIds.size, 2);
assert.equal(snapshot.audit.length, 2);
assert.equal(snapshot.audit[0].sequence, 1);
assert.equal(snapshot.audit[1].sequence, 1, 'Audit chains are serialized independently per tenant/environment.');
assert.equal(snapshot.audit[0].previousEventDigest, null);
assert.match(snapshot.audit[0].eventDigest, /^[a-f0-9]{64}$/u);

const protectedLineageRepository = new MemoryCommandRepository();
const protectedLineageKernel = new MmcCommandKernel({
  repository: protectedLineageRepository,
  handlers: {
    'task.upsert': ({ command }) => ({
      aggregate: { id: command.targetId, kind: 'TASK' },
      lineage: [{
        relation: 'SOURCE_TO_CANONICAL',
        sourceId: 'source_006_protected_lineage',
        tenantId: 'tenant_006_evil',
        environment: 'LIVE',
        targetId: 'task_006_evil',
        targetVersion: 999,
      }],
    }),
  },
});
await assert.rejects(
  protectedLineageKernel.execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000070',
    idempotencyKey: 'idem_task_006_protected_lineage',
    targetId: 'task_006_protected_lineage',
  }, { principal, correlationId: 'corr_006_protected_lineage' }),
  (error) => error?.statusCode === 500 && error?.code === 'COMMAND_LINEAGE_INVALID',
  'Handlers must not be able to overwrite server-owned lineage bindings.',
);
snapshot = protectedLineageRepository.snapshot();
assert.equal(snapshot.aggregates.size, 0);
assert.equal(snapshot.commandIds.size, 0);
assert.equal(snapshot.audit.length, 0);
assert.equal(snapshot.lineage.length, 0);
assert.equal(snapshot.outbox.length, 0);

const validLineageRepository = new MemoryCommandRepository();
const validLineageKernel = new MmcCommandKernel({
  repository: validLineageRepository,
  idFactory: (() => {
    let next = 0;
    return () => `00600000-0000-4000-8000-${String(next += 1).padStart(12, '0')}`;
  })(),
  clock: () => new Date('2026-07-15T13:00:00.000Z'),
  handlers: {
    'task.upsert': ({ command }) => ({
      aggregate: { id: command.targetId, kind: 'TASK' },
      lineage: [{ relation: 'SOURCE_TO_CANONICAL', sourceId: 'source_006_valid_lineage' }],
    }),
  },
});
const validLineageCommand = {
  ...baseCommand,
  commandId: '00600000-0000-4000-8000-000000000071',
  idempotencyKey: 'idem_task_006_valid_lineage',
  targetId: 'task_006_valid_lineage',
};
await validLineageKernel.execute(validLineageCommand, {
  principal,
  correlationId: 'corr_006_valid_lineage',
});
snapshot = validLineageRepository.snapshot();
assert.equal(snapshot.lineage.length, 1);
assert.deepEqual(snapshot.lineage[0], {
  relation: 'SOURCE_TO_CANONICAL',
  sourceId: 'source_006_valid_lineage',
  id: 'lineage_00600000-0000-4000-8000-000000000003',
  tenantId: principal.tenantId,
  environment: principal.environment,
  commandId: validLineageCommand.commandId,
  targetId: validLineageCommand.targetId,
  targetVersion: 1,
  createdAt: '2026-07-15T13:00:00.000Z',
});
assert.equal(snapshot.audit[0].purpose, validLineageCommand.purpose);
assert.equal(snapshot.audit[0].effectiveRole, principal.role);
assert.equal(snapshot.audit[0].outcome, 'COMMITTED');
assert.match(snapshot.audit[0].afterHash, /^[a-f0-9]{64}$/u);
assert.equal(snapshot.audit[0].beforeHash, null);
assert.equal(snapshot.audit[0].correlationId, 'corr_006_valid_lineage');

const tamperedAuditRepository = new MemoryCommandRepository({
  audit: [{
    ...snapshot.audit[0],
    tenantId: principal.tenantId,
    environment: principal.environment,
    eventDigest: 'f'.repeat(64),
  }],
});
await assert.rejects(
  new MmcCommandKernel({ repository: tamperedAuditRepository }).execute({
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000089',
    idempotencyKey: 'idem_task_006_tampered_audit',
    targetId: 'task_006_tampered_audit',
  }, { principal, correlationId: 'corr_006_tampered_audit' }),
  (error) => error?.code === 'COMMAND_AUDIT_CHAIN_INVALID',
  'A rewritten audit digest must stop the next scoped command before mutation.',
);
assert.equal(tamperedAuditRepository.snapshot().aggregates.size, 0);

const completeModelRepository = new MemoryCommandRepository();
const completeModelKernel = new MmcCommandKernel({ repository: completeModelRepository });
const completeModelPrincipal = Object.freeze({
  ...principal,
  capabilities: Object.freeze([
    MMC_CAPABILITIES.COMMAND,
    MMC_CAPABILITIES.REVIEW,
    MMC_CAPABILITIES.IDENTITY_REVIEW,
    MMC_CAPABILITIES.PUBLICATION_APPROVE,
    MMC_CAPABILITIES.AI_QUEUE,
    MMC_CAPABILITIES.STUDENT_RESPOND,
  ]),
});
const completeModelCommands = [
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000090',
    idempotencyKey: 'idem_task_006_complete_model',
    targetId: 'task_006_complete_model',
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000091',
    idempotencyKey: 'idem_session_006_complete_model',
    targetId: 'session_006_complete_model',
    kind: 'session.close',
    payload: { decisions: [], summary: 'The bounded synthetic session is closed.' },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000092',
    idempotencyKey: 'idem_review_006_complete_model',
    targetId: 'proposal_006_complete_model',
    kind: 'review.decide',
    payload: {
      proposalId: 'proposal_006_complete_model', decision: 'ACCEPT',
      rationale: 'Exact evidence was reviewed.', policyVersionId: 'policy_version_006_complete_model',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000093',
    idempotencyKey: 'idem_identity_006_complete_model',
    targetId: 'candidate_006_complete_model',
    kind: 'identity.decide',
    payload: {
      candidateId: 'candidate_006_complete_model', decision: 'APPROVE_LOCAL_LINK',
      evidenceEnvelopeIds: ['evidence_006_complete_model'], reason: 'The signed local evidence is exact.',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000094',
    idempotencyKey: 'idem_publication_006_complete_model',
    targetId: 'publication_006_complete_model',
    kind: 'publication.approve',
    payload: {
      publicationId: 'publication_006_complete_model',
      sourceVersionIds: ['source_version_006_complete_model'],
      policyVersionId: 'policy_version_006_complete_model',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000095',
    idempotencyKey: 'idem_job_006_complete_model',
    targetId: 'job_006_complete_model',
    kind: 'job.enqueue',
    payload: {
      jobKind: 'AI_ANALYSIS', assetHandle: 'asset_006_complete_model',
      authorityGrantId: 'grant_006_complete_model', policyVersionId: 'policy_version_006_complete_model',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000096',
    idempotencyKey: 'idem_student_006_complete_model',
    targetId: 'publication_006_student_response_stream',
    kind: 'student.respond',
    payload: {
      publicationId: 'publication_006_student_response_stream', itemId: 'publication_item_006_complete_model',
      response: 'DISPUTE', comment: 'This bounded synthetic item needs correction.',
    },
  },
];
await completeModelKernel.execute(completeModelCommands[0], {
  principal: completeModelPrincipal,
  correlationId: 'corr_006_complete_task',
});
for (const command of completeModelCommands.slice(1)) {
  await assert.rejects(
    completeModelKernel.execute(command, {
      principal: completeModelPrincipal,
      correlationId: `corr_006_complete_${command.commandId.slice(-3)}`,
    }),
    (error) => error?.statusCode === 501 && error?.code === 'COMMAND_HANDLER_NOT_ENABLED',
    `The ${command.kind} command must fail closed until its owning trust kernel adapter is injected.`,
  );
}
const completeModelSnapshot = completeModelRepository.snapshot();
assert.deepEqual([...completeModelSnapshot.aggregates.values()].map((entry) => entry.aggregateKind), ['TASK']);
assert.equal(completeModelSnapshot.audit.length, 1);
assert.equal(completeModelSnapshot.outbox.length, 1);

const splitTargetCommands = [
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000080',
    idempotencyKey: 'idem_review_006_split_target',
    targetId: 'proposal_006_wrong',
    kind: 'review.decide',
    payload: {
      proposalId: 'proposal_006_right',
      decision: 'ACCEPT',
      rationale: 'A bounded review rationale.',
      policyVersionId: 'policy_version_006_0001',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000081',
    idempotencyKey: 'idem_identity_006_split_target',
    targetId: 'candidate_006_wrong',
    kind: 'identity.decide',
    payload: {
      candidateId: 'candidate_006_right',
      decision: 'APPROVE_LOCAL_LINK',
      evidenceEnvelopeIds: ['evidence_006_identity'],
      reason: 'A bounded identity decision reason.',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000082',
    idempotencyKey: 'idem_publication_006_split_target',
    targetId: 'publication_006_wrong',
    kind: 'publication.approve',
    payload: {
      publicationId: 'publication_006_right',
      sourceVersionIds: ['source_version_006_0001'],
      policyVersionId: 'policy_version_006_0001',
    },
  },
  {
    ...baseCommand,
    commandId: '00600000-0000-4000-8000-000000000083',
    idempotencyKey: 'idem_student_006_split_target',
    targetId: 'publication_006_wrong',
    kind: 'student.respond',
    payload: {
      publicationId: 'publication_006_right',
      itemId: 'publication_item_006_0001',
      response: 'DISPUTE',
      comment: 'The published item needs correction.',
    },
  },
];
for (const splitTargetCommand of splitTargetCommands) {
  assert.throws(
    () => validateCommandEnvelope(splitTargetCommand),
    (error) => error?.statusCode === 422 && error?.code === 'COMMAND_TARGET_BINDING_MISMATCH',
    `Split target must fail closed for ${splitTargetCommand.kind}.`,
  );
}

console.log(JSON.stringify({
  result: 'MMC v2 command concurrency validation passed',
  concurrentDuplicates: results.length,
  canonicalCommits: 1,
  idempotencyMismatch: '409',
  versionConflict: '409',
  replayAuthorityRechecked: true,
  commitTimeAuthorityRechecked: true,
  strictBooleanAuthorization: true,
  scopedCommandIdUniqueness: true,
  protectedLineageBindings: true,
  completeTypedCommandContract: true,
  domainHandlerOwnershipFailClosed: true,
  tamperEvidentAuditChain: true,
  splitTargetRejected: true,
  injectedRollbackAtomic: true,
}, null, 2));
