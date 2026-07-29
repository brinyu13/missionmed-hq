import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { startEphemeralStoryForgeDatabase } from './helpers/ephemeral-postgres.mjs';

const founderUserId = '11111111-1111-4111-8111-111111111111';
const appPassword = 'local-only-b1-506a-proof-password-0001';
const gitCommit = '7777777777777777777777777777777777777777';
const backupId = 'local-pg18-transaction-proof';

const ledger = [
  [
    '20260726150000',
    '20260726150000_b1_500_storyforge_v5_foundation.sql',
    '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f',
  ],
  [
    '20260727170000',
    '20260727170000_b1_502_storyforge_submit_assignment_gate.sql',
    '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f',
  ],
  [
    '20260727190000',
    '20260727190000_b1_502_storyforge_background_preference.sql',
    'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405',
  ],
  [
    '20260728045100',
    '20260728045100_b1_503_story_domain_conformance.sql',
    'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68',
  ],
  [
    '20260728045444',
    '20260728045444_b1_503_interview_mentor_conformance.sql',
    '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2',
  ],
  [
    '20260729000100',
    '20260729000100_b1_506_voice_recording_sessions.sql',
    '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2',
  ],
  [
    '20260729000200',
    '20260729000200_b1_506_feature_flags.sql',
    '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a',
  ],
  [
    '20260729010000',
    '20260729010000_b1_506a_voice_audit_lifecycle.sql',
    'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323',
  ],
];

function pgTool(name) {
  return process.env.STORYFORGE_PG_BIN
    ? path.join(process.env.STORYFORGE_PG_BIN, name)
    : name;
}

function quoteShell(value) {
  return `'${String(value).replaceAll("'", `'\"'\"'`)}'`;
}

function exactRunnerSql(packageDir) {
  const runnerPath = path.join(
    packageDir,
    'scripts',
    'apply-production-migrations.sh',
  );
  const source = readFileSync(runnerPath, 'utf8');
  const startAnchor = "{\n  cat <<'SQL'\n\\getenv app_password STORYFORGE_APP_DB_PASSWORD";
  const endAnchor = '\n} | "$psql_bin" "${psql_args[@]}"';
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start);
  assert.notEqual(start, -1, 'production SQL block start anchor must exist');
  assert.notEqual(end, -1, 'production SQL block end anchor must exist');
  assert.equal(
    source.indexOf(startAnchor, start + 1),
    -1,
    'production SQL block start anchor must be unique',
  );
  assert.equal(
    source.indexOf(endAnchor, end + 1),
    -1,
    'production SQL block end anchor must be unique',
  );

  const phaseOne = ledger.slice(5);
  const migrationPaths = phaseOne.map(([, file]) => (
    path.join(packageDir, 'infra', 'postgres', 'migrations', file)
  ));
  const bash = [
    'set -euo pipefail',
    `PACKAGE_DIR=${quoteShell(packageDir)}`,
    'STORYFORGE_EXPECTED_USER_COUNT=6',
    'STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT=3',
    `pending_migrations=(${migrationPaths.map(quoteShell).join(' ')})`,
    `pending_versions=(${phaseOne.map(([version]) => quoteShell(version)).join(' ')})`,
    `pending_files=(${phaseOne.map(([, file]) => quoteShell(file)).join(' ')})`,
    `pending_hashes=(${phaseOne.map(([, , sha]) => quoteShell(sha)).join(' ')})`,
    source.slice(start, end) + '\n}',
  ].join('\n');
  const generated = spawnSync('bash', ['-c', bash], {
    cwd: packageDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.match(generated.stdout, /B1-506 post-migration ledger is not exact/);
  assert.match(
    generated.stdout,
    /effective authenticated\/PUBLIC authority closure is not exact/,
  );
  assert.match(generated.stdout, /ALTER ROLE storyforge_app LOGIN/);
  assert.doesNotMatch(generated.stdout, new RegExp(appPassword));
  return generated.stdout;
}

function psqlArgs(database) {
  return [
    '-X',
    '-h', database.socketDir,
    '-p', '5432',
    '-U', 'postgres',
    '-d', 'storyforge',
    '-v', 'ON_ERROR_STOP=1',
  ];
}

function runTransaction(database, sql) {
  const phaseOne = ledger.slice(5);
  const args = [
    ...psqlArgs(database),
    '--single-transaction',
    `--set=git_commit=${gitCommit}`,
    `--set=backup_id=${backupId}`,
    `--set=founder_user_id=${founderUserId}`,
  ];
  phaseOne.forEach(([version, file, sha], index) => {
    args.push(
      `--set=version_${index}=${version}`,
      `--set=file_${index}=${file}`,
      `--set=sha_${index}=${sha}`,
    );
  });
  return spawnSync(pgTool('psql'), args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      STORYFORGE_APP_DB_PASSWORD: appPassword,
    },
    input: sql,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function runSqlFile(database, file) {
  return spawnSync(
    pgTool('psql'),
    [...psqlArgs(database), '-f', file],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}

async function seedPreMigrationLedger(database) {
  for (const [version, fileName, sha256] of ledger.slice(0, 5)) {
    await database.client.query(
      `INSERT INTO public.sf_schema_migrations
         (version, file_name, sha256, git_commit, backup_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [version, fileName, sha256, gitCommit, backupId],
    );
  }
}

test(
  'exact production stream commits atomically and literal M3 rollback/reapply retains audit history',
  { timeout: 45_000 },
  async () => {
    const database = await startEphemeralStoryForgeDatabase({
      applyPhaseOne: false,
    });
    try {
      await seedPreMigrationLedger(database);
      const result = runTransaction(
        database,
        exactRunnerSql(database.packageDir),
      );
      assert.equal(result.status, 0, result.stderr || result.stdout);

      const ledgerResult = await database.client.query(
        `SELECT version, file_name, sha256
           FROM public.sf_schema_migrations
          ORDER BY version`,
      );
      assert.deepEqual(
        ledgerResult.rows.map((row) => [
          row.version,
          row.file_name,
          row.sha256,
        ]),
        ledger,
      );

      const roleResult = await database.client.query(
        `SELECT role_item.rolcanlogin,
                role_item.rolinherit,
                role_item.rolsuper,
                role_item.rolcreatedb,
                role_item.rolcreaterole,
                role_item.rolreplication,
                role_item.rolbypassrls,
                role_item.rolpassword LIKE 'SCRAM-SHA-256$%' AS scram
           FROM pg_authid role_item
          WHERE role_item.rolname = 'storyforge_app'`,
      );
      assert.deepEqual(roleResult.rows, [{
        rolcanlogin: true,
        rolinherit: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
        rolbypassrls: false,
        scram: true,
      }]);

      const membership = await database.client.query(
        `SELECT granted.rolname AS granted_role,
                member_role.rolname AS member_role,
                membership.admin_option,
                membership.inherit_option,
                membership.set_option
           FROM pg_auth_members membership
           JOIN pg_roles granted ON granted.oid = membership.roleid
           JOIN pg_roles member_role ON member_role.oid = membership.member
          WHERE membership.member IN (
                  'storyforge_app'::regrole,
                  'authenticated'::regrole
                )
             OR membership.roleid IN (
                  'storyforge_app'::regrole,
                  'authenticated'::regrole
                )`,
      );
      assert.deepEqual(membership.rows, [{
        granted_role: 'authenticated',
        member_role: 'storyforge_app',
        admin_option: false,
        inherit_option: false,
        set_option: true,
      }]);

      const authorityGate = path.join(
        database.packageDir,
        'infra',
        'postgres',
        'verify_b1_506a_effective_authority.sql',
      );
      const authority = runSqlFile(database, authorityGate);
      assert.equal(authority.status, 0, authority.stderr || authority.stdout);
      assert.match(authority.stdout, /B1_506A_EFFECTIVE_AUTHORITY_PASS/);

      const audit = await database.client.query(
        `SELECT public.sf_append_voice_audit_service(
           'provider_failover',
           'recording_session',
           gen_random_uuid(),
           $1::uuid,
           NULL,
           '{"provider":"openai"}'::jsonb,
           '{"provider":"openai","model":"whisper-1"}'::jsonb
         ) AS id`,
        [founderUserId],
      );
      const auditId = audit.rows[0].id;

      const rollbackFile = path.join(
        database.packageDir,
        'infra',
        'postgres',
        'migrations',
        '20260729010000_b1_506a_voice_audit_lifecycle_rollback.sql',
      );
      const rollback = runSqlFile(database, rollbackFile);
      assert.equal(rollback.status, 0, rollback.stderr || rollback.stdout);

      const rolledBack = await database.client.query(
        `SELECT
           to_regclass('public.sf_recording_sessions') IS NOT NULL AS m1_retained,
           to_regclass('public.sf_feature_flags') IS NOT NULL AS m2_retained,
           to_regprocedure(
             'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'
           ) IS NULL AS m3_routine_removed,
           to_regclass('public.sf_audit_error_category_idx') IS NULL AS m3_index_removed,
           (SELECT count(*) FROM public.sf_schema_migrations) AS ledger_count,
           (SELECT count(*) FROM public.sf_audit_events WHERE id = $1) AS audit_count`,
        [auditId],
      );
      assert.deepEqual(rolledBack.rows, [{
        m1_retained: true,
        m2_retained: true,
        m3_routine_removed: true,
        m3_index_removed: true,
        ledger_count: '8',
        audit_count: '1',
      }]);

      const migrationFile = path.join(
        database.packageDir,
        'infra',
        'postgres',
        'migrations',
        '20260729010000_b1_506a_voice_audit_lifecycle.sql',
      );
      const reapply = runSqlFile(database, migrationFile);
      assert.equal(reapply.status, 0, reapply.stderr || reapply.stdout);
      const authorityAfterReapply = runSqlFile(database, authorityGate);
      assert.equal(
        authorityAfterReapply.status,
        0,
        authorityAfterReapply.stderr || authorityAfterReapply.stdout,
      );

      const reapplied = await database.client.query(
        `SELECT
           to_regprocedure(
             'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'
           ) IS NOT NULL AS m3_routine_restored,
           to_regclass('public.sf_audit_error_category_idx') IS NOT NULL AS m3_index_restored,
           (SELECT count(*) FROM public.sf_schema_migrations) AS ledger_count,
           (SELECT count(*) FROM public.sf_audit_events WHERE id = $1) AS audit_count`,
        [auditId],
      );
      assert.deepEqual(reapplied.rows, [{
        m3_routine_restored: true,
        m3_index_restored: true,
        ledger_count: '8',
        audit_count: '1',
      }]);
    } finally {
      await database.stop();
    }
  },
);

test(
  'effective-authority drift aborts the exact transaction and preserves the five-row baseline',
  { timeout: 45_000 },
  async () => {
    const database = await startEphemeralStoryForgeDatabase({
      applyPhaseOne: false,
    });
    try {
      await seedPreMigrationLedger(database);
      const exactSql = exactRunnerSql(database.packageDir);
      const marker = 'REVOKE authenticated FROM storyforge_app;';
      assert.equal(
        exactSql.split(marker).length - 1,
        1,
        'membership-normalization marker must be unique',
      );
      const driftedSql = exactSql.replace(
        marker,
        `GRANT INSERT ON public.sf_stories TO authenticated;\n${marker}`,
      );
      const result = runTransaction(database, driftedSql);
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /effective authenticated\/PUBLIC authority closure is not exact/,
      );

      const state = await database.client.query(
        `SELECT
           (SELECT count(*) FROM public.sf_schema_migrations) AS ledger_count,
           to_regclass('public.sf_recording_sessions') IS NULL AS m1_absent,
           to_regclass('public.sf_feature_flags') IS NULL AS m2_absent,
           to_regprocedure(
             'public.sf_append_voice_audit_service(text,text,uuid,uuid,uuid,jsonb,jsonb)'
           ) IS NULL AS m3_absent,
           NOT role_item.rolcanlogin AS app_nologin,
           role_item.rolpassword IS NULL AS password_absent,
           NOT has_table_privilege(
             'authenticated',
             'public.sf_stories',
             'INSERT'
           ) AS drift_rolled_back,
           (SELECT count(*) FROM public.sf_users) AS user_count,
           (SELECT count(*) FROM public.sf_mentor_assignments WHERE active)
             AS active_assignment_count
          FROM pg_authid role_item
         WHERE role_item.rolname = 'storyforge_app'`,
      );
      assert.deepEqual(state.rows, [{
        ledger_count: '5',
        m1_absent: true,
        m2_absent: true,
        m3_absent: true,
        app_nologin: true,
        password_absent: true,
        drift_rolled_back: true,
        user_count: '6',
        active_assignment_count: '3',
      }]);
    } finally {
      await database.stop();
    }
  },
);
