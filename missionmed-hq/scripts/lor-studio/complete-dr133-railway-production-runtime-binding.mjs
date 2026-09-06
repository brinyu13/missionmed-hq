import { randomBytes } from 'node:crypto';

import {
  DR133_RUNNER_CONTRACT,
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  verifiedDr133DatabaseCa,
} from './railway-dr133-production-runner-core.mjs';
import {
  DR133_RUNTIME_CA_TRANSFER_CONTRACT,
  transferDr133RailwayRuntimeRootCa,
} from './railway-dr133-production-runtime-ca-transfer.mjs';
import {
  DR133_RUNTIME_URL_BINDING_CONTRACT,
  DR133_RUNTIME_URL_VARIABLE_KEY,
  bindDr133RailwayProductionRuntimeDatabaseUrl,
} from './railway-dr133-production-runtime-url-binding.mjs';
import {
  dr133ReleaseVariableValueSha256,
} from './railway-dr133-production-release-orchestrator.mjs';
import {
  DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT,
  preflightDr133RailwayProductionTunnelSourceCustody,
  runDr133RailwayProductionTunnelOperation,
} from './run-dr133-railway-production-tunnel-operation.mjs';

export const DR133_RUNTIME_BINDING_LIFECYCLE_CONTRACT =
  'missionmed.lor.dr133-production-runtime-binding-lifecycle.v1';

const OPTION_KEYS = new Set(['databaseCa', 'environment', 'sourceCommit']);
const DEPENDENCY_KEYS = new Set([
  'bindRuntimeUrl',
  'bindRootCa',
  'createPassword',
  'runTunnelOperation',
  'verifySourceCustody',
]);
const SAFE_PASSWORD = /^[A-Za-z0-9_-]{43,128}$/u;
const SAFE_COMMIT = /^[0-9a-f]{40}$/u;
const PROVEN_NO_LOGIN_RESULTS = new Set([
  'NO_MUTATION',
  'RUNTIME_LOGIN_ROLLED_BACK',
  'RUNTIME_LOGIN_DEPROVISION_COMMITTED_VERIFIED',
]);
const PROVEN_DEPROVISION_ERROR_CODES = new Set([
  'RUNTIME_LOGIN_OUTCOME_UNKNOWN_DEPROVISIONED',
  'RUNTIME_LOGIN_REJECTED_DEPROVISIONED',
]);

export class Dr133RuntimeBindingLifecycleError extends Error {
  constructor(code, {
    roleAbsent = true,
    variableState = 'MUTATION_NOT_ATTEMPTED',
  } = {}) {
    super(`DR-133 runtime binding lifecycle failed: ${code}`);
    this.name = 'Dr133RuntimeBindingLifecycleError';
    this.code = code;
    this.roleAbsent = roleAbsent;
    this.variableState = variableState;
  }
}

function fail(code, options) {
  throw new Dr133RuntimeBindingLifecycleError(code, options);
}

function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function buildRuntimeUrl(password) {
  if (typeof password !== 'string' || !SAFE_PASSWORD.test(password)) {
    fail('RUNTIME_PASSWORD_GENERATION_REJECTED');
  }
  return `postgresql://${DR133_RUNTIME_LOGIN}:${password}`
    + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`;
}

function runtimeUrlExpectationSha256(runtimeUrl) {
  const bytes = Buffer.from(runtimeUrl, 'utf8');
  try {
    return dr133ReleaseVariableValueSha256(DR133_RUNTIME_URL_VARIABLE_KEY, bytes);
  } finally {
    bytes.fill(0);
  }
}

function validateSourceReceipt(receipt, sourceCommit) {
  if (!plain(receipt)
    || receipt.contract !== DR133_SOURCE_CUSTODY_PREFLIGHT_CONTRACT
    || receipt.result !== 'SOURCE_CUSTODY_VERIFIED'
    || receipt.sourceCommit !== sourceCommit
    || !Number.isSafeInteger(receipt.trackedPathCount)
    || receipt.trackedPathCount < 1
    || !Number.isSafeInteger(receipt.dependencyPackageCount)
    || receipt.dependencyPackageCount < 1) fail('SOURCE_CUSTODY_UNPROVEN');
}

function validateCaReceipt(receipt) {
  if (!plain(receipt)
    || receipt.contract !== DR133_RUNTIME_CA_TRANSFER_CONTRACT
    || receipt.result !== 'ROOT_CA_BOUND_VERIFIED') fail('ROOT_CA_BINDING_UNPROVEN');
}

function validateRuntimeUrlReceipt(receipt) {
  if (!plain(receipt)
    || receipt.contract !== DR133_RUNTIME_URL_BINDING_CONTRACT
    || receipt.result !== 'RUNTIME_DATABASE_URL_STAGED_NO_DEPLOY_CONFIRMED') {
    fail('RUNTIME_URL_STAGING_UNPROVEN', {
      variableState: 'OUTCOME_UNKNOWN',
    });
  }
}

function validateProvisionReceipt(receipt) {
  if (!plain(receipt)
    || receipt.contract !== DR133_RUNNER_CONTRACT
    || receipt.mode !== 'runtime-login'
    || receipt.result !== 'RUNTIME_LOGIN_COMMITTED_VERIFIED') {
    fail('RUNTIME_LOGIN_PROVISION_UNPROVEN', {
      roleAbsent: false,
      variableState: 'STAGED_NO_DEPLOY',
    });
  }
}

function normalizeDependencies(rawDependencies = {}) {
  if (!plain(rawDependencies) || Reflect.ownKeys(rawDependencies).some(
    (key) => typeof key !== 'string' || !DEPENDENCY_KEYS.has(key),
  )) fail('DEPENDENCIES_INVALID');
  const dependencies = {
    bindRootCa: transferDr133RailwayRuntimeRootCa,
    bindRuntimeUrl: bindDr133RailwayProductionRuntimeDatabaseUrl,
    createPassword: () => randomBytes(48).toString('base64url'),
    runTunnelOperation: runDr133RailwayProductionTunnelOperation,
    verifySourceCustody: preflightDr133RailwayProductionTunnelSourceCustody,
    ...rawDependencies,
  };
  if (Object.values(dependencies).some((value) => typeof value !== 'function')) {
    fail('DEPENDENCIES_INVALID');
  }
  return Object.freeze(dependencies);
}

function loginKnownAbsent(error) {
  return PROVEN_DEPROVISION_ERROR_CODES.has(error?.code)
    || PROVEN_NO_LOGIN_RESULTS.has(error?.safeReceipt?.result)
    || error?.safeReceipts?.some(
      (receipt) => PROVEN_NO_LOGIN_RESULTS.has(receipt?.result),
    ) === true;
}

function bindingFailureState(error) {
  if (error?.bindingState === 'NOT_ATTEMPTED') return 'MUTATION_NOT_ATTEMPTED';
  return 'OUTCOME_UNKNOWN';
}

export function createDr133RailwayProductionRuntimeBindingLifecycle(rawDependencies = {}) {
  const dependencies = normalizeDependencies(rawDependencies);
  return async (rawOptions = {}) => {
    if (!plain(rawOptions) || Reflect.ownKeys(rawOptions).some(
      (key) => typeof key !== 'string' || !OPTION_KEYS.has(key),
    )) fail('OPTIONS_INVALID');
    const sourceCommit = rawOptions.sourceCommit;
    if (typeof sourceCommit !== 'string' || !SAFE_COMMIT.test(sourceCommit)) {
      fail('SOURCE_COMMIT_INVALID');
    }
    const environment = rawOptions.environment ?? process.env;
    const databaseCa = verifiedDr133DatabaseCa(rawOptions.databaseCa);

    let sourceReceipt;
    try {
      sourceReceipt = await dependencies.verifySourceCustody({ sourceCommit });
      validateSourceReceipt(sourceReceipt, sourceCommit);
    } catch {
      fail('SOURCE_CUSTODY_UNPROVEN');
    }

    try {
      validateCaReceipt(await dependencies.bindRootCa({ environment, sink: true }));
    } catch {
      fail('ROOT_CA_BINDING_UNPROVEN');
    }

    let runtimeUrl = buildRuntimeUrl(dependencies.createPassword());
    const valueSha256 = runtimeUrlExpectationSha256(runtimeUrl);
    try {
      try {
        validateRuntimeUrlReceipt(await dependencies.bindRuntimeUrl({
          environment,
          runtimeDatabaseUrl: runtimeUrl,
        }));
      } catch (error) {
        throw new Dr133RuntimeBindingLifecycleError('RUNTIME_URL_STAGING_FAILED', {
          roleAbsent: true,
          variableState: bindingFailureState(error),
        });
      }

      try {
        validateProvisionReceipt(await dependencies.runTunnelOperation({
          databaseCa,
          environment,
          mode: 'runtime-login',
          runtimeDatabaseUrl: runtimeUrl,
          sourceCommit,
        }));
      } catch (error) {
        throw new Dr133RuntimeBindingLifecycleError(
          loginKnownAbsent(error)
            ? 'RUNTIME_LOGIN_FAILED_VARIABLE_STAGED_ROLE_ABSENT'
            : 'RUNTIME_LOGIN_FAILED_CLEANUP_UNPROVEN',
          {
            roleAbsent: loginKnownAbsent(error),
            variableState: 'STAGED_NO_DEPLOY',
          },
        );
      }

      return Object.freeze({
        contract: DR133_RUNTIME_BINDING_LIFECYCLE_CONTRACT,
        result: 'RUNTIME_BINDING_STAGED_NO_DEPLOY_VERIFIED',
        role: DR133_RUNTIME_LOGIN,
        sourceCommit,
        variableKey: DR133_RUNTIME_URL_VARIABLE_KEY,
        valueSha256,
      });
    } finally {
      runtimeUrl = null;
    }
  };
}

const defaultLifecycle = createDr133RailwayProductionRuntimeBindingLifecycle();

export async function completeDr133RailwayProductionRuntimeBinding(rawOptions = {}) {
  return await defaultLifecycle(rawOptions);
}
