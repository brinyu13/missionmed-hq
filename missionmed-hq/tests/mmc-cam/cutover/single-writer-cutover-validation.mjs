import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { SingleWriterCutover } from '../../../lib/mmc/cutover/single-writer-cutover.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

const operator = Object.freeze({
  id: 'operator_006_cutover', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'operator',
  capabilities: Object.freeze([MMC_CAPABILITIES.OPERATIONS]),
});
const context = { principal: operator };
const commandPrincipal = Object.freeze({
  id: 'admin_006_command', tenantId: operator.tenantId, environment: operator.environment, role: 'admin',
  capabilities: Object.freeze([MMC_CAPABILITIES.COMMAND]),
});
const digest = crypto.createHash('sha256').update('exact synthetic canonical snapshot').digest('hex');
const exact = { v1Count: 120, v2Count: 120, v1Hash: digest, v2Hash: digest };

const cutoverOptions = { tenantId: operator.tenantId, environment: operator.environment };
const cutover = new SingleWriterCutover(cutoverOptions);
assert.throws(() => cutover.assertWriter('v1'), (error) => error?.code === 'WRITER_NOT_AUTHORITATIVE');
assert.throws(() => cutover.assertWriter('v2'), (error) => error?.code === 'WRITER_NOT_AUTHORITATIVE');
assert.equal(cutover.snapshot().state, 'SEALED_NO_WRITER');
assert.deepEqual(cutover.snapshot().featureGates, {
  reads: false, commands: false, ingest: false, aiProposal: false,
  operationalPromotion: false, studentPublication: false,
});

await cutover.beginShadow({ ...exact, v2Hash: crypto.createHash('sha256').update('mismatch').digest('hex') }, context);
await assert.rejects(cutover.freezeV1({ inflightV1Commands: 2 }, context),
  (error) => error?.code === 'CUTOVER_RECONCILIATION_MISMATCH');
await cutover.updateReconciliation(exact, context);
const frozen = await cutover.freezeV1({ inflightV1Commands: 2 }, context);
assert.equal(frozen.state, 'V1_FROZEN');
assert.throws(() => cutover.assertWriter('v1'), (error) => error?.code === 'WRITER_NOT_AUTHORITATIVE');
assert.throws(() => cutover.assertWriter('v2'), (error) => error?.code === 'WRITER_NOT_AUTHORITATIVE');

await assert.rejects(cutover.switchToV2({ lockId: frozen.lockId, expectedGeneration: frozen.generation }, context),
  (error) => error?.code === 'CUTOVER_NOT_DRAINED');
await cutover.markDrained({
  lockId: frozen.lockId, expectedGeneration: frozen.generation, inflightV1Commands: 0, inflightV2Commands: 0,
}, context);
await assert.rejects(
  cutover.switchToV2({ lockId: frozen.lockId, expectedGeneration: frozen.generation }, context),
  (error) => error?.code === 'CUTOVER_RECONCILIATION_MISMATCH',
  'A pre-freeze reconciliation must be invalid after freeze and drain.',
);
await cutover.updateReconciliation(exact, context);
const v2 = await cutover.switchToV2({ lockId: frozen.lockId, expectedGeneration: frozen.generation }, context);
assert.equal(v2.state, 'V2_WRITER');
assert.equal(cutover.assertWriter('v2'), true);
assert.throws(() => cutover.assertWriter('v1'), (error) => error?.code === 'WRITER_NOT_AUTHORITATIVE');
assert.equal(v2.featureGates.commands, false, 'Writer authority must not silently enable command traffic.');

await cutover.setFeaturePlane({ plane: 'reads', enabled: true }, context);
await cutover.setFeaturePlane({ plane: 'commands', enabled: true }, context);
await assert.rejects(cutover.setFeaturePlane({ plane: 'aiProposal', enabled: true }, context),
  (error) => error?.code === 'FEATURE_PLANE_PREREQUISITE');

const crossTenantPrincipal = Object.freeze({
  ...commandPrincipal,
  id: 'admin_006_cross_tenant',
  tenantId: 'tenant_006_attacker',
});
await assert.rejects(cutover.runV2Command({
  tenantId: operator.tenantId,
  environment: operator.environment,
  commandId: 'command_006_cross_tenant',
}, { principal: crossTenantPrincipal }, async () => ({ status: 'COMMITTED', replayed: false })),
(error) => error?.code === 'CUTOVER_COMMAND_SCOPE_MISMATCH');
const crossEnvironmentPrincipal = Object.freeze({
  ...commandPrincipal,
  id: 'admin_006_cross_environment',
  environment: 'LIVE',
});
await assert.rejects(cutover.runV2Command({
  tenantId: operator.tenantId,
  environment: operator.environment,
  commandId: 'command_006_cross_environment',
}, { principal: crossEnvironmentPrincipal }, async () => ({ status: 'COMMITTED', replayed: false })),
(error) => error?.code === 'CUTOVER_COMMAND_SCOPE_MISMATCH');
assert.equal(cutover.snapshot().acknowledgedV2Writes, 0,
  'Cross-scope command attempts must not execute or acknowledge writes.');

const beforeWriteRollback = new SingleWriterCutover(cutoverOptions);
await beforeWriteRollback.beginShadow(exact, context);
const beforeFrozen = await beforeWriteRollback.freezeV1({ inflightV1Commands: 0 }, context);
await beforeWriteRollback.markDrained({
  lockId: beforeFrozen.lockId, expectedGeneration: beforeFrozen.generation, inflightV1Commands: 0, inflightV2Commands: 0,
}, context);
await beforeWriteRollback.updateReconciliation(exact, context);
const beforeV2 = await beforeWriteRollback.switchToV2({
  lockId: beforeFrozen.lockId, expectedGeneration: beforeFrozen.generation,
}, context);
const rolledBack = await beforeWriteRollback.rollbackBeforeAcknowledgedV2Write({
  lockId: beforeFrozen.lockId, expectedGeneration: beforeV2.generation,
}, context);
assert.equal(rolledBack.state, 'SEALED_NO_WRITER');

const commandResult = await cutover.runV2Command({
  tenantId: operator.tenantId,
  environment: operator.environment,
  commandId: 'command_006_ack_0001',
}, { principal: commandPrincipal }, async () => ({ status: 'COMMITTED', replayed: false }));
assert.equal(commandResult.status, 'COMMITTED');
assert.equal(cutover.snapshot().acknowledgedV2Writes, 1);
await assert.rejects(cutover.rollbackBeforeAcknowledgedV2Write({
  lockId: frozen.lockId, expectedGeneration: v2.generation,
}, context), (error) => error?.code === 'V2_FORWARD_REPAIR_REQUIRED');
const forward = await cutover.enterForwardRepair({
  lockId: frozen.lockId, expectedGeneration: v2.generation,
}, context);
assert.equal(forward.state, 'FORWARD_REPAIR');
assert.equal(forward.featureGates.commands, false);
assert.equal(forward.featureGates.studentPublication, false);

console.log(JSON.stringify({
  result: 'MMC v2 single-writer cutover validation passed',
  defaultOffFeaturePlanes: true,
  reconciliationMismatchBlocked: true,
  postFreezeDrainReconciliationRequired: true,
  frozenWindowHasNoWriter: true,
  dualWriteImpossible: true,
  preWriteRollbackToSealedNoWriter: true,
  commandExecutionUsesCutoverAuthority: true,
  commandPrincipalScopeBound: true,
  postWriteForwardRepairOnly: true,
}, null, 2));
