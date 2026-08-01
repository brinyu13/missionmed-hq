import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const { Client } = pg;

const packageDir = path.resolve(
  fileURLToPath(new URL('../../../', import.meta.url)),
);

const baseMigrations = [
  '20260726150000_b1_500_storyforge_v5_foundation.sql',
  '20260727170000_b1_502_storyforge_submit_assignment_gate.sql',
  '20260727190000_b1_502_storyforge_background_preference.sql',
  '20260728045100_b1_503_story_domain_conformance.sql',
  '20260728045444_b1_503_interview_mentor_conformance.sql',
];

const phaseOneMigrations = [
  '20260729000100_b1_506_voice_recording_sessions.sql',
  '20260729000200_b1_506_feature_flags.sql',
  '20260729010000_b1_506a_voice_audit_lifecycle.sql',
  '20260730000100_b1_507b_reconciliation_state.sql',
  '20260801190000_b1_510i_admin_console.sql',
];

function commandPath(name) {
  if (process.env.STORYFORGE_PG_BIN) {
    return path.join(process.env.STORYFORGE_PG_BIN, name);
  }
  return name;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error || result.status !== 0) {
    const detail = [
      `${command} ${args.join(' ')} failed`,
      result.error?.message,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n');
    throw new Error(detail);
  }
  return result.stdout;
}

function assertPostgresParity() {
  const output = run(commandPath('postgres'), ['--version']).trim();
  const match = output.match(/PostgreSQL\)\s+(\d+)|PostgreSQL\s+(\d+)/);
  const major = Number(match?.[1] || match?.[2]);
  if (major !== 18 && process.env.STORYFORGE_ALLOW_NON_PG18 !== '1') {
    throw new Error(
      `PostgreSQL 18 is required for authoritative StoryForge tests; found ${output}. `
      + 'Set STORYFORGE_PG_BIN to the PostgreSQL 18 bin directory.',
    );
  }
  return major;
}

function psqlArgs(socketDir, database = 'storyforge') {
  return [
    '-X',
    '-h', socketDir,
    '-p', '5432',
    '-U', 'postgres',
    '-d', database,
    '-v', 'ON_ERROR_STOP=1',
    '--set=founder_user_id=11111111-1111-4111-8111-111111111111',
    '--set=admin_console_founder_user_id=cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ];
}

function applySqlFile(socketDir, file) {
  run(commandPath('psql'), [...psqlArgs(socketDir), '-f', file]);
}

export async function startEphemeralStoryForgeDatabase({
  applyPhaseOne = true,
} = {}) {
  const postgresMajor = assertPostgresParity();
  const root = mkdtempSync(path.join(tmpdir(), 'storyforge-v55-pg-'));
  const dataDir = path.join(root, 'data');
  const socketDir = path.join(root, 'socket');
  mkdirSync(socketDir);

  let started = false;
  try {
    run(commandPath('initdb'), [
      '-D', dataDir,
      '-A', 'trust',
      '-U', 'postgres',
      '--no-locale',
      '--encoding=UTF8',
    ]);
    run(commandPath('pg_ctl'), [
      '-D', dataDir,
      '-o', `-k ${socketDir} -h ''`,
      '-l', path.join(root, 'postgres.log'),
      '-w',
      'start',
    ]);
    started = true;

    run(commandPath('psql'), [
      ...psqlArgs(socketDir, 'postgres'),
      '-c', 'CREATE DATABASE storyforge',
    ]);

    applySqlFile(
      socketDir,
      path.join(packageDir, 'infra/postgres/bootstrap_production.sql'),
    );
    for (const migration of baseMigrations) {
      applySqlFile(
        socketDir,
        path.join(packageDir, 'infra/postgres/migrations', migration),
      );
    }
    applySqlFile(
      socketDir,
      path.join(packageDir, 'infra/postgres/seed_local.sql'),
    );
    if (applyPhaseOne) {
      for (const migration of phaseOneMigrations) {
        applySqlFile(
          socketDir,
          path.join(packageDir, 'infra/postgres/migrations', migration),
        );
      }
    }

    const client = new Client({
      host: socketDir,
      port: 5432,
      user: 'postgres',
      database: 'storyforge',
    });
    await client.connect();

    return {
      client,
      packageDir,
      postgresMajor,
      socketDir,
      async stop() {
        await client.end();
        run(commandPath('pg_ctl'), [
          '-D', dataDir,
          '-m', 'fast',
          '-w',
          'stop',
        ]);
        started = false;
        rmSync(root, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (started) {
      spawnSync(commandPath('pg_ctl'), [
        '-D', dataDir,
        '-m', 'fast',
        '-w',
        'stop',
      ], { encoding: 'utf8' });
    }
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export async function withIdentity(client, {
  sub,
  role,
  wpUserId,
  eligible = true,
}, operation) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(
      `SELECT
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.app_role', $2, true),
         set_config('request.jwt.claim.storyforge_eligible', $3, true),
         set_config('request.jwt.claim.wp_user_id', $4, true)`,
      [sub, role, eligible ? 'true' : 'false', String(wpUserId)],
    );
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export async function withRole(client, role, operation) {
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export function migrationSql(name) {
  return readFileSync(
    path.join(packageDir, 'infra/postgres/migrations', name),
    'utf8',
  );
}
