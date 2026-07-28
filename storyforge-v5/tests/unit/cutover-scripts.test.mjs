import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const installScript = path.join(packageDir, 'scripts', 'install-b1-503-kinsta-release.sh');
const rollbackScript = path.join(packageDir, 'scripts', 'rollback-b1-503-kinsta-release.sh');
const migrationScript = path.join(packageDir, 'scripts', 'apply-production-migrations.sh');
const phpCli = spawnSync('sh', ['-c', 'command -v php'], { encoding: 'utf8' }).stdout.trim();
const owner = `${spawnSync('id', ['-un'], { encoding: 'utf8' }).stdout.trim()}:${
  spawnSync('id', ['-gn'], { encoding: 'utf8' }).stdout.trim()
}`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function run(script, args, environment = {}) {
  const bashArgs = process.env.STORYFORGE_TEST_CUTOVER_TRACE
    ? ['-x', script, ...args]
    : [script, ...args];
  return spawnSync('bash', bashArgs, {
    cwd: packageDir,
    env: { ...process.env, ...environment },
    encoding: 'utf8',
  });
}

test('guarded Kinsta install and rollback preserve exact prior state and immutable releases', () => {
  assert.ok(phpCli, 'PHP CLI is required for the local cutover fixture');
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'storyforge-b1-503-cutover-'));
  const remoteRoot = path.join(fixture, 'remote', 'public');
  const muRoot = path.join(remoteRoot, 'wp-content', 'mu-plugins');
  const runtimeRoot = path.join(muRoot, 'missionmed-storyforge-runtime');
  const releasesRoot = path.join(runtimeRoot, 'releases');
  const privateRoot = path.join(fixture, 'private');
  const stagingRoot = path.join(privateRoot, 'staging');
  const rollbackParent = path.join(privateRoot, 'rollback');
  const oldCommit = '1111111111111111111111111111111111111111';
  const newCommit = '2222222222222222222222222222222222222222';
  const releaseId = 'v-0123456789abcdef';
  const oldReleaseDir = path.join(releasesRoot, oldCommit);
  const newReleaseDir = path.join(releasesRoot, newCommit);
  const currentLink = path.join(runtimeRoot, 'current');
  const routeTarget = path.join(muRoot, 'missionmed-storyforge-route.php');
  const routeSource = path.join(stagingRoot, 'missionmed-storyforge-route.php');
  const releaseSource = path.join(stagingRoot, 'release.php');
  const fakeWp = path.join(fixture, 'fake-wp');
  const fakeWpLog = path.join(fixture, 'fake-wp.log');

  mkdirSync(oldReleaseDir, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });
  mkdirSync(rollbackParent, { recursive: true });
  const rollbackDir = path.join(realpathSync(rollbackParent), 'B1-503-test-receipt');
  writeFileSync(path.join(oldReleaseDir, 'release.php'), "<?php\nreturn array('release_id' => 'v-oldoldoldoldold0');\n");
  symlinkSync(`releases/${oldCommit}`, currentLink);

  const oldRoute = "<?php\n// prior isolated StoryForge route\n";
  writeFileSync(routeTarget, oldRoute);
  chmodSync(routeTarget, 0o444);
  const oldRouteSha = sha256(oldRoute);

  const releaseBytes = `<?php
return array(
  'release_id' => '${releaseId}',
  'assets' => array(),
);
`;
  writeFileSync(releaseSource, releaseBytes);
  const releaseSha = sha256(releaseBytes);
  const routeBytes = `<?php
define( 'MMSFR_RELEASE_ID', '${releaseId}' );
define( 'MMSFR_RELEASE_PHP_SHA256', '${releaseSha}' );
define( 'MMSFR_RELEASE_PHP_SIZE', ${Buffer.byteLength(releaseBytes)} );
`;
  writeFileSync(routeSource, routeBytes);
  const routeSha = sha256(routeBytes);

  writeFileSync(fakeWp, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_WP_LOG"
case "$*" in
  *" eval "*) exit 0 ;;
  *" kinsta cache purge --site") exit 0 ;;
  *" kinsta cache purge --cdn") exit 0 ;;
  *) exit 9 ;;
esac
`);
  chmodSync(fakeWp, 0o755);

  chmodSync(oldReleaseDir, 0o555);
  chmodSync(releasesRoot, 0o555);
  chmodSync(runtimeRoot, 0o555);
  chmodSync(muRoot, 0o555);

  const installArgs = [
    '--remote-root', realpathSync(remoteRoot),
    '--release-commit', newCommit,
    '--route-source', realpathSync(routeSource),
    '--release-source', realpathSync(releaseSource),
    '--route-sha256', routeSha,
    '--route-size', String(Buffer.byteLength(routeBytes)),
    '--release-sha256', releaseSha,
    '--release-size', String(Buffer.byteLength(releaseBytes)),
    '--release-id', releaseId,
    '--expected-owner', owner,
    '--expected-current-target', `releases/${oldCommit}`,
    '--expected-route-sha256', oldRouteSha,
    '--rollback-dir', rollbackDir,
    '--wp-cli', fakeWp,
    '--php-cli', phpCli,
  ];
  const fixtureEnvironment = { FAKE_WP_LOG: fakeWpLog };

  const preflight = run(installScript, ['preflight', ...installArgs], fixtureEnvironment);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.match(preflight.stdout, /B1_503_KINSTA_INSTALL_PREFLIGHT_PASS/);
  assert.equal(existsSync(newReleaseDir), false);
  assert.equal(existsSync(rollbackDir), false);
  assert.equal(readlinkSync(currentLink), `releases/${oldCommit}`);

  const install = run(
    installScript,
    ['install', ...installArgs, '--confirm', 'B1-503-INSTALL'],
    fixtureEnvironment,
  );
  assert.equal(install.status, 0, install.stderr || install.stdout);
  assert.match(install.stdout, /B1_503_KINSTA_INSTALL_PASS/);
  assert.equal(readlinkSync(currentLink), `releases/${newCommit}`);
  assert.equal(realpathSync(currentLink), realpathSync(newReleaseDir));
  assert.equal(sha256(readFileSync(routeTarget)), routeSha);
  assert.equal(sha256(readFileSync(path.join(newReleaseDir, 'release.php'))), releaseSha);
  assert.ok(lstatSync(newReleaseDir).isDirectory());

  const receipt = path.join(rollbackDir, 'rollback.tsv');
  const receiptSha = sha256(readFileSync(receipt));
  const rollbackArgs = [
    '--remote-root', realpathSync(remoteRoot),
    '--receipt', receipt,
    '--receipt-sha256', receiptSha,
    '--wp-cli', fakeWp,
  ];

  const rollbackPreflight = run(
    rollbackScript,
    ['preflight', ...rollbackArgs],
    fixtureEnvironment,
  );
  assert.equal(
    rollbackPreflight.status,
    0,
    rollbackPreflight.stderr || rollbackPreflight.stdout,
  );
  assert.match(rollbackPreflight.stdout, /B1_503_KINSTA_ROLLBACK_PREFLIGHT_PASS/);

  const rollback = run(
    rollbackScript,
    ['rollback', ...rollbackArgs, '--confirm', 'B1-503-ROLLBACK'],
    fixtureEnvironment,
  );
  assert.equal(rollback.status, 0, rollback.stderr || rollback.stdout);
  assert.match(rollback.stdout, /B1_503_KINSTA_ROLLBACK_PASS/);
  assert.equal(readlinkSync(currentLink), `releases/${oldCommit}`);
  assert.equal(realpathSync(currentLink), realpathSync(oldReleaseDir));
  assert.equal(sha256(readFileSync(routeTarget)), oldRouteSha);
  assert.equal(existsSync(newReleaseDir), true, 'rollback must retain the installed release');
  assert.equal(
    sha256(readFileSync(path.join(newReleaseDir, 'release.php'))),
    releaseSha,
    'rollback must not mutate the installed release',
  );
  assert.equal(
    sha256(readFileSync(path.join(rollbackDir, 'rollback-observed', 'active-route.php'))),
    routeSha,
  );

  const cacheCommands = readFileSync(fakeWpLog, 'utf8')
    .split('\n')
    .filter((line) => line.includes('kinsta cache purge'));
  assert.deepEqual(cacheCommands.map((line) => line.split('kinsta cache purge ')[1]), [
    '--site',
    '--cdn',
    '--site',
    '--cdn',
  ]);
  assert.doesNotMatch(cacheCommands.join('\n'), /--all|--object|purge_complete_caches/);

  const repeatedInstall = run(installScript, ['preflight', ...installArgs], fixtureEnvironment);
  assert.notEqual(repeatedInstall.status, 0);
  assert.match(repeatedInstall.stderr, /release target already exists/);

  const tamperedReceipt = readFileSync(receipt, 'utf8').replace(
    'B1-503-KINSTA-ROLLBACK-V1',
    'B1-503-KINSTA-ROLLBACK-V2',
  );
  chmodSync(rollbackDir, 0o700);
  chmodSync(receipt, 0o600);
  writeFileSync(receipt, tamperedReceipt);
  const tampered = run(
    rollbackScript,
    ['preflight', ...rollbackArgs],
    fixtureEnvironment,
  );
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /receipt SHA-256 mismatch/);
});

test('production migration runner pins source, backup, provider, DB, and exact ledgers', () => {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'storyforge-b1-503-migration-'));
  const repository = path.join(fixture, 'repo');
  const candidatePackage = path.join(repository, 'storyforge-v5');
  const candidateScripts = path.join(candidatePackage, 'scripts');
  const candidatePostgres = path.join(candidatePackage, 'infra', 'postgres');
  const candidateMigrations = path.join(candidatePostgres, 'migrations');
  const fakeBin = path.join(fixture, 'bin');
  const fakePsql = path.join(fakeBin, 'psql');
  const fakeSqlLog = path.join(fixture, 'transaction.sql');
  const backupReceipt = path.join(fixture, 'db-backup.tsv');
  const expectedSystemIdentifier = '7667256745042145332';
  const backupId = '59a491f8-ecb2-4fc8-b5b3-da43ccada133';
  const migrationFiles = [
    '20260726150000_b1_500_storyforge_v5_foundation.sql',
    '20260727170000_b1_502_storyforge_submit_assignment_gate.sql',
    '20260727190000_b1_502_storyforge_background_preference.sql',
    '20260728045100_b1_503_story_domain_conformance.sql',
    '20260728045444_b1_503_interview_mentor_conformance.sql',
  ];

  mkdirSync(candidateScripts, { recursive: true });
  mkdirSync(candidateMigrations, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  copyFileSync(migrationScript, path.join(candidateScripts, path.basename(migrationScript)));
  copyFileSync(
    path.join(packageDir, 'infra', 'postgres', 'bootstrap_production.sql'),
    path.join(candidatePostgres, 'bootstrap_production.sql'),
  );
  for (const file of migrationFiles) {
    copyFileSync(
      path.join(packageDir, 'infra', 'postgres', 'migrations', file),
      path.join(candidateMigrations, file),
    );
  }
  chmodSync(path.join(candidateScripts, path.basename(migrationScript)), 0o755);

  const gitEnvironment = {
    ...process.env,
    GIT_AUTHOR_NAME: 'B1-503 Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'B1-503 Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  };
  for (const args of [
    ['init', '-q', repository],
    ['-C', repository, 'add', '.'],
    ['-C', repository, 'commit', '-qm', 'fixture'],
  ]) {
    const result = spawnSync('git', args, { env: gitEnvironment, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const fixtureCommit = spawnSync('git', ['-C', repository, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).stdout.trim();

  const expectedLedger = [
    '20260726150000|20260726150000_b1_500_storyforge_v5_foundation.sql|93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f',
    '20260727170000|20260727170000_b1_502_storyforge_submit_assignment_gate.sql|95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f',
    '20260727190000|20260727190000_b1_502_storyforge_background_preference.sql|ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405',
  ].join('\n');
  writeFileSync(fakePsql, `#!/usr/bin/env bash
set -euo pipefail
joined="$*"
if [[ "$joined" == "--version" ]]; then
  echo "psql (PostgreSQL) 18.4"
  exit 0
fi
if [[ "$joined" == *"--single-transaction"* ]]; then
  command cat > "$FAKE_PSQL_SQL_LOG"
  exit 0
fi
case "$joined" in
  *"pg_control_system"*) printf 'railway\\tpostgres\\t7667256745042145332\\ttrue\\n' ;;
  *"to_regclass"*) printf '1\\n' ;;
  *"ORDER BY version"*) printf '%s\\n' "$FAKE_PSQL_PRE_LEDGER" ;;
  *"--set=version=20260726150000"*) printf '%s\\n' '93018d16582890890ac9ad696cdfd11b5d8118afa55a709725c531a52fae6a1f' ;;
  *"--set=version=20260727170000"*) printf '%s\\n' '95269aeb5a414656c92246ea8e798faac7f0b33d7062540b187f30b8a781315f' ;;
  *"--set=version=20260727190000"*) printf '%s\\n' 'ee8ad5cf0a1b850a23c015a07a0f762de2a4b588abbd29a381b35c2db6d79405' ;;
  *"--set=version=20260728045100"*) : ;;
  *"--set=version=20260728045444"*) : ;;
  *"NOT rolcreatedb"*) printf '5|1|1|0\\n' ;;
  *"sf_users"*"sf_mentor_assignments"*) printf '1|0\\n' ;;
  *) printf 'unexpected fake psql invocation: %s\\n' "$joined" >&2; exit 71 ;;
esac
`);
  chmodSync(fakePsql, 0o755);

  const backupReceiptText = `# B1-503 fixture database backup receipt
# Machine-readable fields follow.
format\tB1-503-DB-BACKUP-V1
backup_id\t${backupId}
project_id\t875e7c17-d06f-4301-a4bb-e61016f153cf
environment_id\tbcef8734-e42b-44df-8488-c2a3de68213f
database_service_id\ta4a66362-c3ba-475a-ae21-2aa46624bafe
volume_instance_id\t8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5
pg_host\tsakura.proxy.rlwy.net
pg_port\t10257
pg_database\trailway
db_system_identifier\t${expectedSystemIdentifier}
pg_dump_sha256\t18d737fba373c0a5da0cd43874601a0cecd2a81a9c1c9ad40d55febdd9ccea6c
pg_dump_major\t18
restore_rehearsal\tPASS
provider_backup_locked\ttrue
provider_backup_expires_at\tnull
provider_backup_created_at\t2026-07-28T08:07:44.233Z
`;
  writeFileSync(backupReceipt, backupReceiptText);
  const environment = {
    PATH: `${fakeBin}:${process.env.PATH}`,
    FAKE_PSQL_SQL_LOG: fakeSqlLog,
    FAKE_PSQL_PRE_LEDGER: expectedLedger,
    STORYFORGE_RAILWAY_PROJECT_ID: '875e7c17-d06f-4301-a4bb-e61016f153cf',
    STORYFORGE_RAILWAY_ENVIRONMENT_ID: 'bcef8734-e42b-44df-8488-c2a3de68213f',
    STORYFORGE_RAILWAY_DATABASE_SERVICE_ID: 'a4a66362-c3ba-475a-ae21-2aa46624bafe',
    STORYFORGE_DB_BACKUP_ID: backupId,
    STORYFORGE_DB_BACKUP_RECEIPT: backupReceipt,
    STORYFORGE_DB_BACKUP_RECEIPT_SHA256: sha256(backupReceiptText),
    STORYFORGE_DEPLOY_GIT_COMMIT: fixtureCommit,
    STORYFORGE_SOURCE_MODE: 'git',
    STORYFORGE_APP_DB_PASSWORD: 'fixture-password-with-more-than-32-characters',
    STORYFORGE_EXPECTED_PGHOST: 'sakura.proxy.rlwy.net',
    STORYFORGE_EXPECTED_PGPORT: '10257',
    STORYFORGE_EXPECTED_PGUSER: 'postgres',
    STORYFORGE_EXPECTED_PGDATABASE: 'railway',
    STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER: expectedSystemIdentifier,
    STORYFORGE_EXPECTED_USER_COUNT: '1',
    STORYFORGE_EXPECTED_ACTIVE_ASSIGNMENT_COUNT: '0',
    RAILWAY_PROJECT_ID: '875e7c17-d06f-4301-a4bb-e61016f153cf',
    RAILWAY_ENVIRONMENT_ID: 'bcef8734-e42b-44df-8488-c2a3de68213f',
    RAILWAY_SERVICE_ID: 'a4a66362-c3ba-475a-ae21-2aa46624bafe',
    PGHOST: 'sakura.proxy.rlwy.net',
    PGPORT: '10257',
    PGUSER: 'postgres',
    PGPASSWORD: 'fixture-admin-password',
    PGDATABASE: 'railway',
    PGSSLMODE: 'require',
  };
  const candidateRunner = path.join(candidateScripts, path.basename(migrationScript));

  const preflight = run(candidateRunner, ['preflight'], environment);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.match(preflight.stdout, /B1_503_PRODUCTION_MIGRATION_PREFLIGHT_PASS/);
  assert.match(preflight.stdout, /pending_migrations=2/);
  assert.equal(existsSync(fakeSqlLog), false, 'preflight must not issue the mutation transaction');

  const apply = run(candidateRunner, ['apply'], {
    ...environment,
    STORYFORGE_MIGRATION_CONFIRM: 'B1-503-APPLY-TWO-MIGRATIONS',
  });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  assert.match(apply.stdout, /B1_503_PRODUCTION_MIGRATIONS_APPLIED/);
  const transactionSql = readFileSync(fakeSqlLog, 'utf8');
  assert.match(transactionSql, /pg_advisory_xact_lock/);
  assert.match(transactionSql, /\\getenv app_password STORYFORGE_APP_DB_PASSWORD/);
  assert.match(transactionSql, /ALTER ROLE storyforge_app PASSWORD :'app_password'/);
  assert.match(transactionSql, /ALTER ROLE storyforge_app LOGIN/);
  assert.match(transactionSql, /B1-503 post-migration ledger is not exact/);
  assert.doesNotMatch(transactionSql, /fixture-password-with-more-than-32-characters/);
  assert.doesNotMatch(transactionSql, /\\password storyforge_app/);

  const badTarget = run(candidateRunner, ['preflight'], {
    ...environment,
    RAILWAY_SERVICE_ID: 'dab015bf-15ef-4698-9f16-cbf8cf23de7a',
  });
  assert.notEqual(badTarget.status, 0);
  assert.match(badTarget.stderr, /provider-injected RAILWAY_SERVICE_ID/);

  const badTls = run(candidateRunner, ['preflight'], {
    ...environment,
    PGSSLMODE: 'disable',
  });
  assert.notEqual(badTls.status, 0);
  assert.match(badTls.stderr, /PGSSLMODE must be require or verify-full/);
});
