import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';
import { assertValidatedLorTargetBinding } from './lor-target-binding.mjs';
import {
  DR133_TARGET,
  expectedDr133SuccessorSentinel,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

export const PRODUCTION_RUNTIME_TARGET_INTEGRATION = 'lor_production_runtime_target';
export const PRODUCTION_RUNTIME_TARGET_SCHEMA = 'missionmed.lor.production-runtime-target.v1';

export const PRODUCTION_RUNTIME_TARGET_ENV_KEYS = Object.freeze({
  schemaVersion: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_SCHEMA_VERSION',
  environmentName: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_ENVIRONMENT_NAME',
  executionServiceId: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_EXECUTION_SERVICE_ID',
  databaseHost: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_HOST',
  databaseAdmin: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_DATABASE_ADMIN',
  runtimeLogin: 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_LOGIN',
});

const DATABASE_HOST = 'postgres.railway.internal';
const DATABASE_ADMIN = 'postgres';
const RUNTIME_LOGIN = 'lor_studio_runtime_login';
const CONFIGURATION_PREFIX = 'MMHQ_LOR_STUDIO_RUNTIME_TARGET_';
const FOUNDATION_MIGRATION = '20260825010000';
const STAGING_MIGRATION_LEDGER = 'lor_studio/migrations/staging';
const PRODUCTION_MIGRATION_LEDGER = 'lor_studio/migrations/production';
const SUCCESSOR_SENTINEL_SUFFIXES = Object.freeze([
  'identityScope=20260825010300',
  'facultyInvitationCommands=20260825010500',
  'facultyPrivateExportCommands=20260825010700',
  'aiProposalCommands=20260825010900',
  'studentEvidenceCommands=20260825011100',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ENVIRONMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/u;
const RESOLVED_TARGETS = new WeakSet();

function disabled(status) {
  return new IntegrationDisabledError(PRODUCTION_RUNTIME_TARGET_INTEGRATION, status);
}

function snapshotConfiguration(environment) {
  if (!environment || (typeof environment !== 'object' && typeof environment !== 'function')) {
    throw disabled('RUNTIME_TARGET_ENVIRONMENT_REQUIRED');
  }
  const snapshot = Object.create(null);
  try {
    const expectedKeys = Object.values(PRODUCTION_RUNTIME_TARGET_ENV_KEYS).sort();
    const configuredKeys = Reflect.ownKeys(environment)
      .filter((key) => typeof key === 'string' && key.startsWith(CONFIGURATION_PREFIX))
      .sort();
    if (
      configuredKeys.length !== expectedKeys.length
      || configuredKeys.some((key, index) => key !== expectedKeys[index])
    ) throw new TypeError('unexpected runtime target key');
    for (const [field, key] of Object.entries(PRODUCTION_RUNTIME_TARGET_ENV_KEYS)) {
      const descriptor = Object.getOwnPropertyDescriptor(environment, key);
      if (
        !descriptor
        || !Object.hasOwn(descriptor, 'value')
        || descriptor.enumerable !== true
        || typeof descriptor.value !== 'string'
      ) throw new TypeError('unsafe runtime target descriptor');
      snapshot[field] = descriptor.value;
    }
  } catch {
    throw disabled('RUNTIME_TARGET_CONFIGURATION_REQUIRED');
  }
  return Object.freeze(snapshot);
}

function productionSuccessorSentinel(binding) {
  const foundation = [
    'missionmed.lor.railway-postgres-target.v2',
    'deploymentEnvironment=production',
    `migrationLedger=${binding.migrationLedger}`,
    `provider=${binding.provider}`,
    `project=${binding.projectId}`,
    `environment=${binding.environmentId}`,
    `service=${binding.serviceId}`,
    `database=${binding.databaseName}`,
    `admin=${DATABASE_ADMIN}`,
    `region=${binding.region}`,
    `decision=${binding.decisionRecord}`,
    'dataCopied=false',
    `foundation=${FOUNDATION_MIGRATION}`,
  ].join('|');
  return SUCCESSOR_SENTINEL_SUFFIXES.reduce(
    (sentinel, suffix) => `${sentinel}|${suffix}`,
    foundation,
  );
}

function assertExactStagingTarget(binding, configuration) {
  const expectedBinding = {
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
    schema: 'lor_studio',
    decisionRecord: DR133_TARGET.decisionRecord,
    migrationLedger: STAGING_MIGRATION_LEDGER,
  };
  if (
    Object.entries(expectedBinding).some(([key, value]) => binding[key] !== value)
    || configuration.environmentName !== DR133_TARGET.environmentName
    || configuration.executionServiceId !== DR133_TARGET.executionServiceId
  ) throw disabled('RUNTIME_TARGET_STAGING_IDENTITY_MISMATCH');
}

function assertDistinctProductionTarget(binding, configuration) {
  if (
    binding.migrationLedger !== PRODUCTION_MIGRATION_LEDGER
    || binding.environmentId === DR133_TARGET.environmentId
    || binding.serviceId === DR133_TARGET.databaseServiceId
    || binding.serviceId === DR133_TARGET.executionServiceId
    || configuration.executionServiceId === DR133_TARGET.executionServiceId
    || configuration.environmentName === DR133_TARGET.environmentName
  ) throw disabled('RUNTIME_TARGET_PRODUCTION_IDENTITY_MISMATCH');
}

/**
 * Resolve the non-secret deployment axes that are not part of the durable database
 * binding. The database identity itself always comes from the already validated,
 * module-branded target binding; there is no staging default or ambient fallback.
 */
export function resolveProductionRuntimeTarget(rawBinding, environment = process.env) {
  const binding = assertValidatedLorTargetBinding(
    rawBinding,
    PRODUCTION_RUNTIME_TARGET_INTEGRATION,
  );
  const configuration = snapshotConfiguration(environment);
  if (configuration.schemaVersion !== PRODUCTION_RUNTIME_TARGET_SCHEMA) {
    throw disabled('RUNTIME_TARGET_SCHEMA_VERSION_INVALID');
  }
  if (!ENVIRONMENT_NAME.test(configuration.environmentName)) {
    throw disabled('RUNTIME_TARGET_ENVIRONMENT_NAME_INVALID');
  }
  if (
    !UUID.test(configuration.executionServiceId)
    || configuration.executionServiceId === binding.serviceId
  ) {
    throw disabled('RUNTIME_TARGET_EXECUTION_SERVICE_ID_INVALID');
  }
  if (
    configuration.databaseHost !== DATABASE_HOST
    || configuration.databaseAdmin !== DATABASE_ADMIN
    || configuration.runtimeLogin !== RUNTIME_LOGIN
  ) throw disabled('RUNTIME_TARGET_DATABASE_IDENTITY_INVALID');
  if (binding.environment !== 'staging' && binding.environment !== 'production') {
    throw disabled('RUNTIME_TARGET_DEPLOYMENT_ENVIRONMENT_INVALID');
  }
  if (binding.environment === 'staging') {
    assertExactStagingTarget(binding, configuration);
  } else {
    assertDistinctProductionTarget(binding, configuration);
  }

  const resolvedSuccessorSentinel = binding.environment === 'staging'
    ? expectedDr133SuccessorSentinel()
    : productionSuccessorSentinel(binding);
  if (
    binding.environment === 'production'
    && resolvedSuccessorSentinel === expectedDr133SuccessorSentinel()
  ) throw disabled('RUNTIME_TARGET_PRODUCTION_SENTINEL_COLLISION');

  const target = deepFreeze({
    schemaVersion: PRODUCTION_RUNTIME_TARGET_SCHEMA,
    provider: binding.provider,
    projectId: binding.projectId,
    environmentId: binding.environmentId,
    environmentName: configuration.environmentName,
    executionServiceId: configuration.executionServiceId,
    databaseServiceId: binding.serviceId,
    databaseHost: DATABASE_HOST,
    databaseName: binding.databaseName,
    databaseAdmin: DATABASE_ADMIN,
    runtimeLogin: RUNTIME_LOGIN,
    region: binding.region,
    schema: binding.schema,
    decisionRecord: binding.decisionRecord,
    migrationLedger: binding.migrationLedger,
    deploymentEnvironment: binding.environment,
    dataCopied: 'false',
    successorSentinel: resolvedSuccessorSentinel,
  });
  RESOLVED_TARGETS.add(target);
  return target;
}

export function assertResolvedProductionRuntimeTarget(target) {
  if (!target || typeof target !== 'object' || !RESOLVED_TARGETS.has(target)) {
    throw disabled('RESOLVED_RUNTIME_TARGET_REQUIRED');
  }
  return target;
}

export const PRODUCTION_RUNTIME_TARGET_CONTRACT = deepFreeze({
  schemaVersion: PRODUCTION_RUNTIME_TARGET_SCHEMA,
  authority: 'DR-133',
  targetBinding: 'module_private_validated_lor_target_binding',
  environments: ['staging', 'production'],
  databaseHost: DATABASE_HOST,
  databaseAdmin: DATABASE_ADMIN,
  runtimeLogin: RUNTIME_LOGIN,
  foundationMigration: FOUNDATION_MIGRATION,
  stagingMigrationLedger: STAGING_MIGRATION_LEDGER,
  productionMigrationLedger: PRODUCTION_MIGRATION_LEDGER,
  successorSentinelSuffixes: [...SUCCESSOR_SENTINEL_SUFFIXES],
  configurationKeys: Object.values(PRODUCTION_RUNTIME_TARGET_ENV_KEYS),
  secretConfiguration: 'prohibited',
  defaultTarget: null,
  fallbackTarget: null,
});
