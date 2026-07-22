import assert from 'node:assert/strict';

import {
  MMC_CAPABILITIES,
  deriveMmcPrincipal,
} from '../../../lib/mmc/trust/security.mjs';

function expectCode(action, code, message) {
  assert.throws(action, (error) => error?.statusCode === 403 && error?.code === code, message);
}

const matchingMentor = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'mentor_principal_006_security',
    role: 'mentor',
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    subjectId: 'subject_006_security',
    assignmentId: 'assignment_006_security',
  },
  principalId: 'mentor_principal_006_security',
  role: 'mentor',
  tenantId: 'tenant_006_security',
  environment: 'LOCAL',
  subjectId: 'subject_006_security',
  assignmentId: 'assignment_006_security',
  capabilities: [MMC_CAPABILITIES.PUBLICATION_APPROVE],
});
assert.equal(matchingMentor.id, 'mentor_principal_006_security');
assert.equal(matchingMentor.tenantId, 'tenant_006_security');
assert.equal(matchingMentor.environment, 'LOCAL');
assert.equal(matchingMentor.role, 'mentor');
assert.equal(matchingMentor.capabilities.includes(MMC_CAPABILITIES.PUBLICATION_APPROVE), true,
  'A legitimate mentor must be able to approve a publication.');
assert.equal(Object.isFrozen(matchingMentor.capabilities), true);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor', tenantId: 'tenant_006_evil' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
  }),
  'MMC_PRINCIPAL_SCOPE_MISMATCH',
  'An authenticated principal cannot be rebound across tenants.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor', environment: 'LIVE' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
  }),
  'MMC_PRINCIPAL_SCOPE_MISMATCH',
  'An authenticated principal cannot be rebound across environments.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor' },
    role: 'student',
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
  }),
  'MMC_PRINCIPAL_SCOPE_MISMATCH',
  'An authenticated principal role cannot be rebound by configuration.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor', subjectId: 'subject_006_other' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    subjectId: 'subject_006_security',
  }),
  'MMC_PRINCIPAL_SCOPE_MISMATCH',
  'An authenticated principal subject cannot be silently rebound.',
);

assert.throws(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 12345678, role: 'mentor' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
  }),
  (error) => error?.statusCode === 422 && error?.code === 'INVALID_OPAQUE_IDENTIFIER',
  'Principal identifiers must never coerce numeric JSON values to strings.',
);

assert.throws(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'worker_principal_006_numeric_queue', role: 'worker', queueName: 123 },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
  }),
  (error) => error?.statusCode === 422 && error?.code === 'MMC_QUEUE_INVALID',
  'Workload queue bindings must never coerce numeric JSON values to strings.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'student_principal_006_security', role: 'student' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    capabilities: [MMC_CAPABILITIES.PUBLICATION_APPROVE],
  }),
  'MMC_CAPABILITY_ELEVATION_FORBIDDEN',
  'A student cannot be granted mentor publication authority.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    capabilities: [MMC_CAPABILITIES.WORKER_COMPLETE],
  }),
  'MMC_CAPABILITY_ELEVATION_FORBIDDEN',
  'A mentor cannot receive worker-only capabilities.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    capabilities: [MMC_CAPABILITIES.WORKER_ASSET_PROCESS],
  }),
  'MMC_CAPABILITY_ELEVATION_FORBIDDEN',
  'A mentor cannot receive the asset-processing workload capability.',
);

for (const role of ['mentor', 'admin']) {
  expectCode(
    () => deriveMmcPrincipal({
      sourcePrincipal: { id: `${role}_principal_006_dispatch_denied`, role },
      tenantId: 'tenant_006_security',
      environment: 'LOCAL',
      capabilities: [MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH],
    }),
    'MMC_CAPABILITY_ELEVATION_FORBIDDEN',
    `${role} cannot receive the outbox-dispatch workload capability.`,
  );
}

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    capabilities: ['mmc:root:anything'],
  }),
  'MMC_CAPABILITY_UNKNOWN',
  'Unknown capabilities must be rejected rather than silently discarded.',
);

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: { id: 'mentor_principal_006_security', role: 'mentor' },
    tenantId: 'tenant_006_security',
    environment: 'LOCAL',
    capabilities: MMC_CAPABILITIES.PUBLICATION_APPROVE,
  }),
  'MMC_CAPABILITY_SET_INVALID',
  'Capability grants must use an explicit array.',
);

const student = deriveMmcPrincipal({
  sourcePrincipal: { id: 'student_principal_006_security', role: 'student' },
  tenantId: 'tenant_006_security',
  environment: 'LOCAL',
  capabilities: [MMC_CAPABILITIES.PUBLICATION_READ, MMC_CAPABILITIES.STUDENT_RESPOND],
});
assert.deepEqual(student.capabilities, [MMC_CAPABILITIES.PUBLICATION_READ, MMC_CAPABILITIES.STUDENT_RESPOND].sort());

const worker = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_principal_006_security', role: 'worker',
    workloadId: 'workload_006_security', queueName: 'mmc.analysis',
  },
  tenantId: 'tenant_006_security',
  environment: 'LOCAL',
  workloadId: 'workload_006_security',
  queueName: 'mmc.analysis',
  capabilities: [
    MMC_CAPABILITIES.WORKER_CLAIM,
    MMC_CAPABILITIES.WORKER_COMPLETE,
    MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH,
    MMC_CAPABILITIES.WORKER_ANALYSIS,
    MMC_CAPABILITIES.WORKER_ASSET_PROCESS,
  ],
});
assert.deepEqual(worker.capabilities, [
  MMC_CAPABILITIES.WORKER_CLAIM,
  MMC_CAPABILITIES.WORKER_COMPLETE,
  MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH,
  MMC_CAPABILITIES.WORKER_ANALYSIS,
  MMC_CAPABILITIES.WORKER_ASSET_PROCESS,
].sort());
assert.equal(worker.workloadId, 'workload_006_security');
assert.equal(worker.queueName, 'mmc.analysis');

expectCode(
  () => deriveMmcPrincipal({
    sourcePrincipal: {
      id: 'worker_principal_006_security', role: 'worker', queueName: 'mmc.analysis',
    },
    tenantId: 'tenant_006_security', environment: 'LOCAL', queueName: 'mmc.ingest',
  }),
  'MMC_PRINCIPAL_SCOPE_MISMATCH',
  'A signed worker queue cannot be rebound by runtime configuration.',
);

const ignoredSourceCapabilities = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'student_principal_006_ignored',
    role: 'student',
    capabilities: [MMC_CAPABILITIES.PUBLICATION_APPROVE],
  },
  tenantId: 'tenant_006_security',
  environment: 'LOCAL',
});
assert.deepEqual(ignoredSourceCapabilities.capabilities, [],
  'Untrusted source-principal capability fields must never elevate the derived principal.');

console.log(JSON.stringify({
  result: 'MMC v2 principal derivation validation passed',
  exactScopeBinding: true,
  roleCapabilityCeilings: true,
  mentorPublicationApproval: true,
  unknownCapabilityFailClosed: true,
  workerAnalysisCapabilitySeparatedFromEnqueue: true,
  workerAssetProcessCapabilityMatchesSqlContract: true,
  workerOutboxDispatchCapabilityIsWorkloadOnly: true,
  exactWorkerQueueBinding: true,
}, null, 2));
