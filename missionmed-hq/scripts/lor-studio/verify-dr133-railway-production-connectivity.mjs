import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  DR133_TARGET,
  Dr133RunnerError,
  classifySafeFailure,
  failDr133,
  resolveDr133RunnerEnvironment,
} from './railway-dr133-production-runner-core.mjs';

const { Client } = pg;

export const DR133_PRODUCTION_CONNECTIVITY_CONTRACT =
  'missionmed.lor.railway-dr133-production-connectivity.v1';

export const DR133_PRODUCTION_CONNECTIVITY_SQL = `
/* missionmed:dr133:production-connectivity-preflight */
WITH database_identity AS (
  SELECT pg_catalog.pg_get_userbyid(database.datdba)::text AS database_owner
  FROM pg_catalog.pg_database AS database
  WHERE database.datname = pg_catalog.current_database()
),
ssl_session AS (
  SELECT ssl, version, cipher
  FROM pg_catalog.pg_stat_ssl
  WHERE pid = pg_catalog.pg_backend_pid()
)
SELECT
  pg_catalog.current_database()::text AS database_name,
  current_user::text AS current_user,
  session_user::text AS session_user,
  database_identity.database_owner,
  (pg_catalog.current_setting('server_version_num')::integer / 10000)::integer
    AS postgres_major,
  (
    pg_catalog.inet_server_addr() IS NOT NULL
    AND (
      pg_catalog.inet_server_addr() << pg_catalog.inet '10.0.0.0/8'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '172.16.0.0/12'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '192.168.0.0/16'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet '100.64.0.0/10'
      OR pg_catalog.inet_server_addr() << pg_catalog.inet 'fc00::/7'
    )
  ) AS private_server_address,
  (
    pg_catalog.current_setting('ssl') = 'on'
    AND COALESCE(ssl_session.ssl, false)
  ) AS ssl_active,
  ssl_session.version::text AS ssl_version,
  ssl_session.cipher::text AS ssl_cipher,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_namespace
    WHERE nspname = 'lor_studio'
  ) AS schema_count,
  (
    SELECT pg_catalog.count(*)::text
    FROM pg_catalog.pg_roles
    WHERE rolname LIKE 'lor\\_studio\\_%' ESCAPE '\\'
  ) AS role_count
FROM database_identity
LEFT JOIN ssl_session ON true
`;

function assertFreshPrivateTarget(row) {
  if (
    !row
    || row.database_name !== DR133_TARGET.databaseName
    || row.current_user !== DR133_TARGET.databaseAdmin
    || row.session_user !== DR133_TARGET.databaseAdmin
    || row.database_owner !== DR133_TARGET.databaseAdmin
    || ![16, 18].includes(row.postgres_major)
    || row.private_server_address !== true
    || row.ssl_active !== true
    || !/^TLSv1\.[23]$/u.test(row.ssl_version ?? '')
    || typeof row.ssl_cipher !== 'string'
    || row.ssl_cipher.length < 3
    || row.ssl_cipher.length > 128
    || row.schema_count !== '0'
    || row.role_count !== '0'
  ) failDr133('CONNECTIVITY_PREFLIGHT_REJECTED');
  return row.postgres_major;
}

function writeReceipt(output, payload) {
  if (!output || typeof output.write !== 'function') failDr133('OUTPUT_STREAM_INVALID');
  const success = payload?.result === 'FRESH_PRIVATE_TARGET_VERIFIED';
  if (
    !payload
    || payload.contract !== DR133_PRODUCTION_CONNECTIVITY_CONTRACT
    || (
      success
        ? ![16, 18].includes(payload.postgresMajor)
        : payload.result !== 'BLOCKED'
          || !/^[A-Z0-9_]{3,80}$/u.test(payload.runnerCode ?? '')
          || !(payload.postgresCode === null || /^[0-9A-Z]{5}$/u.test(payload.postgresCode))
    )
  ) failDr133('OUTPUT_RECEIPT_INVALID');
  output.write(`${JSON.stringify(payload)}\n`);
}

export async function verifyDr133RailwayProductionConnectivity({
  environment = process.env,
  ClientClass = Client,
  output = process.stdout,
} = {}) {
  let client;
  let connected = false;
  let postgresMajor;
  let primaryError = null;
  try {
    const resolved = resolveDr133RunnerEnvironment(environment, {
      mode: 'connectivity-preflight',
    });
    client = new ClientClass({
      connectionString: resolved.adminPgConnectionString,
      ssl: {
        ca: resolved.databaseCa,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: resolved.databaseTlsServername,
      },
      enableChannelBinding: true,
      application_name: 'missionmed-f2-lor-1012-dr133-production-connectivity',
      connectionTimeoutMillis: 15_000,
      query_timeout: 15_000,
    });
    await client.connect();
    connected = true;
    const result = await client.query(DR133_PRODUCTION_CONNECTIVITY_SQL);
    postgresMajor = assertFreshPrivateTarget(result.rows?.[0]);
  } catch (error) {
    primaryError = error;
  } finally {
    if (connected) {
      try {
        await client.end();
      } catch {
        primaryError ??= new Dr133RunnerError('CONNECTIVITY_CLEANUP_FAILED');
      }
    }
  }
  if (primaryError) {
    const safe = classifySafeFailure(primaryError);
    writeReceipt(output, {
      contract: DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
      result: 'BLOCKED',
      runnerCode: safe.runnerCode,
      postgresCode: safe.postgresCode,
    });
    failDr133(safe.postgresCode ? `POSTGRES_${safe.postgresCode}` : safe.runnerCode);
  }
  writeReceipt(output, {
    contract: DR133_PRODUCTION_CONNECTIVITY_CONTRACT,
    result: 'FRESH_PRIVATE_TARGET_VERIFIED',
    postgresMajor,
  });
  return Object.freeze({ result: 'FRESH_PRIVATE_TARGET_VERIFIED' });
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  verifyDr133RailwayProductionConnectivity().catch(() => {
    process.exitCode = 1;
  });
}
