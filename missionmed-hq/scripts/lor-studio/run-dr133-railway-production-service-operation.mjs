import {
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
} from './railway-dr133-production-runner-core.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODES = Object.freeze({
  'connectivity-preflight': Object.freeze({
    module: './verify-dr133-railway-production-connectivity.mjs',
    exportName: 'verifyDr133RailwayProductionConnectivity',
  }),
  migration: Object.freeze({
    module: './run-dr133-railway-production-migrations.mjs',
    exportName: 'runDr133ProductionMigration',
  }),
  'successor-migration': Object.freeze({
    module: './run-dr133-railway-production-migrations.mjs',
    exportName: 'runDr133ProductionSuccessorMigration',
  }),
  'schema-verifier': Object.freeze({
    module: './run-dr133-railway-production-migrations.mjs',
    exportName: 'verifyDr133ProductionSuccessorSchema',
  }),
  'rollback-drill': Object.freeze({
    module: './run-dr133-railway-production-rollback-drill.mjs',
    exportName: 'runDr133ProductionRollbackDrill',
  }),
  'runtime-login': Object.freeze({
    module: './provision-dr133-railway-production-runtime-login.mjs',
    exportName: 'provisionDr133RailwayProductionRuntimeLogin',
  }),
  'runtime-login-deprovision': Object.freeze({
    module: './deprovision-dr133-railway-production-runtime-login.mjs',
    exportName: 'deprovisionDr133RailwayProductionRuntimeLogin',
  }),
});
const CONTROL = /[\u0000-\u001f\u007f]/u;

function fail() {
  process.exitCode = 1;
  return null;
}

export function scrubDr133SensitiveAmbientEnvironment(environment) {
  if (!environment || typeof environment !== 'object') return false;
  for (const key of Object.keys(environment)) {
    try {
      delete environment[key];
    } catch {
      return false;
    }
    if (Object.hasOwn(environment, key)) return false;
  }
  return Object.keys(environment).length === 0;
}

function normalizeDr133ProductionProviderDatabaseUrl(rawValue, expectedUser) {
  if (typeof rawValue !== 'string' || rawValue.length > 4_096 || CONTROL.test(rawValue)) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    return null;
  }
  let username;
  let password;
  let database;
  try {
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
    database = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.hostname !== DR133_TARGET.databaseHost
    || parsed.port !== '5432'
    || database !== `/${DR133_TARGET.databaseName}`
    || ![DR133_TARGET.databaseAdmin, DR133_RUNTIME_LOGIN].includes(expectedUser)
    || username !== expectedUser
    || password.length < 32
    || password.length > 512
    || parsed.hash !== ''
    || [...parsed.searchParams.keys()].some((key) => key !== 'sslmode')
    || parsed.searchParams.getAll('sslmode').length > 1
    || (
      parsed.searchParams.has('sslmode')
      && parsed.searchParams.get('sslmode') !== 'require'
    )
  ) return null;
  parsed.search = '?sslmode=require';
  return parsed.toString();
}

export function normalizeDr133ProductionProviderAdminUrl(rawValue) {
  return normalizeDr133ProductionProviderDatabaseUrl(
    rawValue,
    DR133_TARGET.databaseAdmin,
  );
}

export function normalizeDr133ProductionProviderRuntimeUrl(rawValue) {
  return normalizeDr133ProductionProviderDatabaseUrl(rawValue, DR133_RUNTIME_LOGIN);
}

async function main() {
  const ambient = process.env;
  const snapshot = Object.freeze({
    adminDatabaseUrl: ambient.DATABASE_URL,
    databaseCa: ambient.LOR_DR133_RUNTIME_DATABASE_CA,
    deploymentId: ambient.RAILWAY_DEPLOYMENT_ID,
    environmentId: ambient.RAILWAY_ENVIRONMENT_ID,
    environmentName: ambient.RAILWAY_ENVIRONMENT_NAME,
    mode: ambient.LOR_DR133_MODE,
    projectId: ambient.RAILWAY_PROJECT_ID,
    region: ambient.RAILWAY_REPLICA_REGION,
    runtimeDatabaseUrl: ambient.LOR_DR133_RUNTIME_DATABASE_URL,
    serviceId: ambient.RAILWAY_SERVICE_ID,
    tunnelHost: ambient.LOR_DR133_TUNNEL_HOST,
    tunnelPort: ambient.LOR_DR133_TUNNEL_PORT,
  });
  if (!scrubDr133SensitiveAmbientEnvironment(ambient)) return fail();
  const mode = snapshot.mode;
  const operationDescriptor = MODES[mode];
  const adminUrl = normalizeDr133ProductionProviderAdminUrl(snapshot.adminDatabaseUrl);
  const runtimeUrl = mode === 'runtime-login'
    ? normalizeDr133ProductionProviderRuntimeUrl(
      snapshot.runtimeDatabaseUrl,
    )
    : null;
  if (!operationDescriptor || !adminUrl || (mode === 'runtime-login' && !runtimeUrl)) {
    return fail();
  }
  const environment = Object.freeze({
    LOR_DR133_ADMIN_DATABASE_URL: adminUrl,
    LOR_DR133_RUNTIME_DATABASE_CA: snapshot.databaseCa,
    LOR_DR133_MODE: mode,
    LOR_DR133_TUNNEL_HOST: snapshot.tunnelHost,
    LOR_DR133_TUNNEL_PORT: snapshot.tunnelPort,
    ...(runtimeUrl ? { LOR_DR133_RUNTIME_DATABASE_URL: runtimeUrl } : {}),
    RAILWAY_DEPLOYMENT_ID: snapshot.deploymentId,
    RAILWAY_ENVIRONMENT_ID: snapshot.environmentId,
    RAILWAY_ENVIRONMENT_NAME: snapshot.environmentName,
    RAILWAY_PROJECT_ID: snapshot.projectId,
    RAILWAY_REPLICA_REGION: snapshot.region,
    RAILWAY_SERVICE_ID: snapshot.serviceId,
  });
  try {
    const operationModule = await import(operationDescriptor.module);
    const operation = operationModule[operationDescriptor.exportName];
    if (typeof operation !== 'function') return fail();
    await operation({ environment, output: process.stdout });
  } catch {
    process.exitCode = 1;
  }
  return undefined;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) await main();
