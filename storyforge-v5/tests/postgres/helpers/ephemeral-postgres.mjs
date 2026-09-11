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
  '20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql',
  '20260806130000_b1_511a_wordpress_admin_authority.sql',
  '20260806190000_b1_512_concrete_configuration_media.sql',
];

const currentMigrations = [
  '20260810190000_b1_514_v2_r1_visibility_consent_activity.sql',
  '20260810200000_b1_514_v2_r2_story_versions_provenance.sql',
  '20260810210000_b1_514_v2_r3_inspiration.sql',
  '20260810220000_b1_514_v2_ra_requests_guest.sql',
  '20260810230000_b1_514_v2_preferences_environments.sql',
  '20260810240000_b1_514_v2_ra_lifecycle_completion.sql',
  '20260810250000_b1_514_v21_authored_segment_writes.sql',
  '20260810260000_b1_514_guest_voice_contributions.sql',
  '20260810270000_b1_514_request_delivery_attempts.sql',
  '20260810280000_b1_514_guest_voice_cleanup_recovery.sql',
  '20260812120000_b1_515_v201_reviews_collections_peer.sql',
  '20260813120000_b1_515r_admin_subject_masterkey.sql',
  '20260813130000_b1_515r_action_center_contribution_review.sql',
  '20260813140000_b1_515r_arena_avatar_directory_groups.sql',
  '20260813150000_b1_515r_inspiration_recommendation_publish_fix.sql',
  '20260814120000_b1_515r2_admin_population_avatar_sound.sql',
  '20260819220000_b1_515r4_admin_population_scope_repair.sql',
  '20260820120000_b1_517_myeras_alignment.sql',
  '20260908193000_sf_access_5014_canonical_admin_identity.sql',
  '20260911030000_sf_audio_playback_admin_projection.sql',
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
  applyCurrent = false,
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
    if (applyCurrent) {
      for (const migration of currentMigrations) {
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
  wordpressAdmin = false,
  adminMode = false,
}, operation) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(
      `SELECT
         set_config('request.jwt.claim.sub', $1, true),
         set_config('request.jwt.claim.app_role', $2, true),
         set_config('request.jwt.claim.storyforge_eligible', $3, true),
         set_config('request.jwt.claim.wp_user_id', $4, true),
         set_config('request.jwt.claim.wordpress_admin', $5, true),
         set_config('request.jwt.claim.admin_mode', $6, true)`,
      [
        sub,
        role,
        eligible ? 'true' : 'false',
        String(wpUserId),
        wordpressAdmin ? 'true' : 'false',
        adminMode ? 'true' : 'false',
      ],
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
