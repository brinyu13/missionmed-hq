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
const effectiveAuthorityGate = path.join(
  packageDir,
  'infra',
  'postgres',
  'verify_b1_506a_effective_authority.sql',
);
const phaseOneSafetyScript = path.join(
  packageDir,
  'scripts',
  'phase-one-release-safety.mjs',
);
const postgresHarnesses = [
  path.join(packageDir, 'scripts', 'run-e2e.sh'),
  path.join(packageDir, 'scripts', 'run-integration.sh'),
  path.join(packageDir, 'scripts', 'run-conformance.sh'),
];
const phpCli = spawnSync('sh', ['-c', 'command -v php'], { encoding: 'utf8' }).stdout.trim();
const owner = `${spawnSync('id', ['-un'], { encoding: 'utf8' }).stdout.trim()}:${
  spawnSync('id', ['-gn'], { encoding: 'utf8' }).stdout.trim()
}`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function writeFakeKinstaWpLoad(remoteRoot) {
  writeFileSync(path.join(remoteRoot, 'wp-load.php'), `<?php
class WP_Error {}

function is_wp_error($value) {
    return $value instanceof WP_Error;
}

function wp_remote_retrieve_response_code($response) {
    return isset($response['response']['code']) ? (int) $response['response']['code'] : 0;
}

function wp_remote_retrieve_body($response) {
    return isset($response['body']) ? (string) $response['body'] : '';
}

final class B1_503_Fake_Kinsta_Cache_Purge {
    private function response($kind) {
        $log = getenv('FAKE_KINSTA_PURGE_LOG');
        if (is_string($log) && '' !== $log) {
            file_put_contents($log, $kind . PHP_EOL, FILE_APPEND);
        }

        $mode = getenv('FAKE_KINSTA_PURGE_MODE');
        if (!is_string($mode) || '' === $mode) {
            $mode = 'success';
        }
        if ($mode === $kind . '_wp_error') {
            return new WP_Error();
        }

        $code = $mode === $kind . '_http' ? 503 : 200;
        $body = $mode === $kind . '_body'
            ? 'Unexpected cache response.'
            : 'Cache has been cleared.';
        return array(
            'response' => array('code' => $code),
            'body' => $body,
        );
    }

    public function purge_complete_site_cache() {
        return $this->response('site');
    }

    public function purge_complete_cdn_cache() {
        return $this->response('cdn');
    }
}

$kinsta_muplugin = (object) array(
    'kinsta_cache_purge' => new B1_503_Fake_Kinsta_Cache_Purge(),
);
`);
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

test('browser harnesses pin PostgreSQL 18 and the exact forward-only migration order', () => {
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
  ];

  for (const harness of postgresHarnesses) {
    const source = readFileSync(harness, 'utf8');
    assert.match(source, /STORYFORGE_PG_BIN/);
    assert.match(source, /PostgreSQL 18 is required/);
    assert.doesNotMatch(source, /bootstrap_local\.sql/);
    assert.doesNotMatch(source, /find[^\n]*infra\/postgres\/migrations/);
    assert.doesNotMatch(source, /_rollback\.sql/);

    const executionMarkers = [
      'bootstrap_production.sql',
      'for migration in "${base_migrations[@]}"; do',
      'seed_local.sql',
      'for migration in "${phase_one_migrations[@]}"; do',
    ];
    let priorIndex = -1;
    for (const sourceName of executionMarkers) {
      const sourceIndex = source.indexOf(sourceName);
      assert.ok(sourceIndex > priorIndex, `${path.basename(harness)} order: ${sourceName}`);
      priorIndex = sourceIndex;
    }
    for (const sourceName of [...baseMigrations, ...phaseOneMigrations]) {
      assert.equal(
        source.split(sourceName).length - 1,
        1,
        `${path.basename(harness)} pins ${sourceName} exactly once`,
      );
    }
  }
});

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
  const fakeKinstaPurgeLog = path.join(fixture, 'fake-kinsta-purge.log');

  mkdirSync(oldReleaseDir, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });
  mkdirSync(rollbackParent, { recursive: true });
  writeFakeKinstaWpLoad(remoteRoot);
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
  const fixtureEnvironment = {
    FAKE_WP_LOG: fakeWpLog,
    FAKE_KINSTA_PURGE_LOG: fakeKinstaPurgeLog,
    FAKE_KINSTA_PURGE_MODE: 'success',
  };

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
    '--php-cli', phpCli,
  ];
  const rollbackWithoutPhpArgs = rollbackArgs.slice(0, -2);
  const rollbackWithoutPhp = run(
    rollbackScript,
    ['preflight', ...rollbackWithoutPhpArgs],
    fixtureEnvironment,
  );
  assert.notEqual(rollbackWithoutPhp.status, 0);
  assert.match(rollbackWithoutPhp.stderr, /required argument is empty/);

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

  const wpCacheCommands = readFileSync(fakeWpLog, 'utf8')
    .split('\n')
    .filter((line) => line.includes('kinsta cache purge'));
  assert.deepEqual(wpCacheCommands, []);
  assert.deepEqual(
    readFileSync(fakeKinstaPurgeLog, 'utf8').trim().split('\n'),
    ['site', 'cdn', 'site', 'cdn'],
  );
  const cutoverSources = [
    readFileSync(installScript, 'utf8'),
    readFileSync(rollbackScript, 'utf8'),
  ].join('\n');
  assert.doesNotMatch(
    cutoverSources,
    /kinsta cache purge|purge_complete_object_cache|purge_complete_caches|--all|--object/,
  );

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

test('guarded Kinsta install refuses every invalid scoped cache response', () => {
  assert.ok(phpCli, 'PHP CLI is required for the local cutover fixture');
  const cases = [
    ['site_wp_error', 74, /site cache purge returned WP_Error/, ['site']],
    ['site_http', 74, /site cache purge did not return HTTP 200/, ['site']],
    ['site_body', 74, /site cache purge returned an unexpected body/, ['site']],
    ['cdn_wp_error', 75, /CDN cache purge returned WP_Error/, ['site', 'cdn']],
    ['cdn_http', 75, /CDN cache purge did not return HTTP 200/, ['site', 'cdn']],
    ['cdn_body', 75, /CDN cache purge returned an unexpected body/, ['site', 'cdn']],
  ];

  for (const [mode, expectedStatus, expectedError, expectedCalls] of cases) {
    const fixture = mkdtempSync(path.join(os.tmpdir(), `storyforge-b1-503-${mode}-`));
    const remoteRoot = path.join(fixture, 'remote', 'public');
    const muRoot = path.join(remoteRoot, 'wp-content', 'mu-plugins');
    const runtimeRoot = path.join(muRoot, 'missionmed-storyforge-runtime');
    const releasesRoot = path.join(runtimeRoot, 'releases');
    const stagingRoot = path.join(fixture, 'private', 'staging');
    const rollbackParent = path.join(fixture, 'private', 'rollback');
    const releaseCommit = '3333333333333333333333333333333333333333';
    const releaseId = 'v-fedcba9876543210';
    const routeSource = path.join(stagingRoot, 'missionmed-storyforge-route.php');
    const releaseSource = path.join(stagingRoot, 'release.php');
    const fakeWp = path.join(fixture, 'fake-wp');
    const fakeWpLog = path.join(fixture, 'fake-wp.log');
    const fakeKinstaPurgeLog = path.join(fixture, 'fake-kinsta-purge.log');

    mkdirSync(releasesRoot, { recursive: true });
    mkdirSync(stagingRoot, { recursive: true });
    mkdirSync(rollbackParent, { recursive: true });
    writeFakeKinstaWpLoad(remoteRoot);
    const rollbackDir = path.join(realpathSync(rollbackParent), 'B1-503-test-receipt');

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
  *) exit 9 ;;
esac
`);
    chmodSync(fakeWp, 0o755);
    chmodSync(releasesRoot, 0o555);
    chmodSync(runtimeRoot, 0o555);
    chmodSync(muRoot, 0o555);

    const installArgs = [
      '--remote-root', realpathSync(remoteRoot),
      '--release-commit', releaseCommit,
      '--route-source', realpathSync(routeSource),
      '--release-source', realpathSync(releaseSource),
      '--route-sha256', routeSha,
      '--route-size', String(Buffer.byteLength(routeBytes)),
      '--release-sha256', releaseSha,
      '--release-size', String(Buffer.byteLength(releaseBytes)),
      '--release-id', releaseId,
      '--expected-owner', owner,
      '--expected-current-target', 'absent',
      '--expected-route-sha256', 'absent',
      '--rollback-dir', rollbackDir,
      '--wp-cli', fakeWp,
      '--php-cli', phpCli,
    ];
    const refusal = run(
      installScript,
      ['install', ...installArgs, '--confirm', 'B1-503-INSTALL'],
      {
        FAKE_WP_LOG: fakeWpLog,
        FAKE_KINSTA_PURGE_LOG: fakeKinstaPurgeLog,
        FAKE_KINSTA_PURGE_MODE: mode,
      },
    );

    assert.equal(refusal.status, expectedStatus, refusal.stderr || refusal.stdout);
    assert.match(refusal.stderr, expectedError);
    assert.doesNotMatch(refusal.stdout, /B1_503_KINSTA_INSTALL_PASS/);
    assert.deepEqual(
      readFileSync(fakeKinstaPurgeLog, 'utf8').trim().split('\n'),
      expectedCalls,
    );
    assert.doesNotMatch(readFileSync(fakeWpLog, 'utf8'), /kinsta cache purge/);
    assert.equal(existsSync(rollbackDir), true, 'failed purge must retain the sealed receipt');

    if (mode === 'site_body') {
      const receipt = path.join(rollbackDir, 'rollback.tsv');
      const rollbackRefusal = run(
        rollbackScript,
        [
          'rollback',
          '--remote-root', realpathSync(remoteRoot),
          '--receipt', receipt,
          '--receipt-sha256', sha256(readFileSync(receipt)),
          '--wp-cli', fakeWp,
          '--php-cli', phpCli,
          '--confirm', 'B1-503-ROLLBACK',
        ],
        {
          FAKE_WP_LOG: fakeWpLog,
          FAKE_KINSTA_PURGE_LOG: fakeKinstaPurgeLog,
          FAKE_KINSTA_PURGE_MODE: 'cdn_body',
        },
      );
      assert.equal(rollbackRefusal.status, 75, rollbackRefusal.stderr || rollbackRefusal.stdout);
      assert.match(
        rollbackRefusal.stderr,
        /CDN cache purge returned an unexpected body/,
      );
      assert.doesNotMatch(rollbackRefusal.stdout, /B1_503_KINSTA_ROLLBACK_PASS/);
      assert.deepEqual(
        readFileSync(fakeKinstaPurgeLog, 'utf8').trim().split('\n'),
        ['site', 'site', 'cdn'],
      );
      assert.equal(
        existsSync(path.join(runtimeRoot, 'current')),
        false,
        'failed rollback purge occurs only after the prior pointer is restored',
      );
      assert.equal(
        existsSync(path.join(muRoot, 'missionmed-storyforge-route.php')),
        false,
        'failed rollback purge occurs only after the prior route is restored',
      );
    }
  }
});

test('production migration runner accepts amended M1 before target reads', () => {
  const source = readFileSync(migrationScript, 'utf8');
  const safetyCall = source.indexOf('"$node_bin" "$phase_one_safety"');
  assert(safetyCall > 0);
  assert(safetyCall < source.indexOf('required_variables=('));
  assert(safetyCall < source.indexOf('psql_bin='));

  const result = run(migrationScript, ['preflight']);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /STORYFORGE_RAILWAY_PROJECT_ID is required/,
  );
  assert.doesNotMatch(result.stderr, /M1 contains an unrestricted live-identity policy predicate/);
});

test('production migration post-commit closure includes every M4 grant', () => {
  const source = readFileSync(migrationScript, 'utf8');
  const marker = '/* B1_506A_EXACT_ROLE_CLOSURE_POSTCOMMIT */';
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, 'post-commit closure marker must exist');
  const postCommitClosure = source.slice(markerIndex);

  for (const relation of [
    'sf_audio_deletion_intents',
    'sf_reconciliation_runs',
    'sf_reconciliation_state',
  ]) {
    assert.match(postCommitClosure, new RegExp(`'${relation}'`));
  }
  assert.match(postCommitClosure, /'sf_reconciliation_sweep_old_runs'/);
  for (const policy of [
    'sf_deletion_intents_service',
    'sf_reconciliation_runs_service',
    'sf_reconciliation_state_service',
  ]) {
    assert.match(postCommitClosure, new RegExp(`'${policy}'`));
  }
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
    '20260729000100_b1_506_voice_recording_sessions.sql',
    '20260729000200_b1_506_feature_flags.sql',
    '20260729010000_b1_506a_voice_audit_lifecycle.sql',
    '20260730000100_b1_507b_reconciliation_state.sql',
  ];

  mkdirSync(candidateScripts, { recursive: true });
  mkdirSync(candidateMigrations, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  const candidateRunner = path.join(candidateScripts, path.basename(migrationScript));
  const candidateSafety = path.join(
    candidateScripts,
    path.basename(phaseOneSafetyScript),
  );
  copyFileSync(migrationScript, candidateRunner);
  copyFileSync(phaseOneSafetyScript, candidateSafety);
  copyFileSync(
    path.join(packageDir, 'infra', 'postgres', 'bootstrap_production.sql'),
    path.join(candidatePostgres, 'bootstrap_production.sql'),
  );
  copyFileSync(
    effectiveAuthorityGate,
    path.join(candidatePostgres, path.basename(effectiveAuthorityGate)),
  );
  for (const file of migrationFiles) {
    copyFileSync(
      path.join(packageDir, 'infra', 'postgres', 'migrations', file),
      path.join(candidateMigrations, file),
    );
  }
  const candidateM1 = path.join(
    candidateMigrations,
    '20260729000100_b1_506_voice_recording_sessions.sql',
  );
  const amendedM1 = readFileSync(candidateM1, 'utf8');
  const amendedM1Sha = '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2';
  assert.equal(sha256(amendedM1), amendedM1Sha);
  chmodSync(candidateRunner, 0o755);

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
    '20260728045100|20260728045100_b1_503_story_domain_conformance.sql|fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68',
    '20260728045444|20260728045444_b1_503_interview_mentor_conformance.sql|5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2',
    '20260729000100|20260729000100_b1_506_voice_recording_sessions.sql|6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2',
    '20260729000200|20260729000200_b1_506_feature_flags.sql|8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a',
    '20260729010000|20260729010000_b1_506a_voice_audit_lifecycle.sql|e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323',
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
  *"--set=version=20260728045100"*) printf '%s\\n' 'fea497dc32a07ac2c05b8ae21caa6b77d85cc4a571b30816432016719a9a8a68' ;;
  *"--set=version=20260728045444"*) printf '%s\\n' '5b3ea347c1dfb36b22cab81ed6042e0d6e10e2786febb67e83214b56dd4071e2' ;;
  *"--set=version=20260729000100"*) printf '%s\\n' '6f6a3340bc29d1222b5f78472eb9a4897739722d090241de6d64f3e8f781c9c2' ;;
  *"--set=version=20260729000200"*) printf '%s\\n' '8899d7d6525c0cbc72790378fcf6a2d8aeb4bc1e7b8afac737be6c3e9af34c3a' ;;
  *"--set=version=20260729010000"*) printf '%s\\n' 'e67561cc087e2d71d5d7f65ba3033eff06c0dd328a6e43b3915aa58ba1e74323' ;;
  *"--set=version=20260730000100"*) : ;;
  *"B1_506A_EXACT_ROLE_CLOSURE_POSTCOMMIT"*) printf 'true\\n' ;;
  *"verify_b1_506a_effective_authority.sql"*) printf 'B1_507B_EFFECTIVE_AUTHORITY_PASS\\n' ;;
  *"NOT rolcreatedb"*) printf '9|1|1|0|1\\n' ;;
  *"sf_users"*"sf_mentor_assignments"*) printf '1|0|1\\n' ;;
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
    STORYFORGE_FOUNDER_USER_ID: '33333333-3333-4333-8333-333333333333',
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
  const preflight = run(candidateRunner, ['preflight'], environment);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.match(preflight.stdout, /B1_508_PRODUCTION_MIGRATION_PREFLIGHT_PASS/);
  assert.match(preflight.stdout, /pending_migrations=1/);
  assert.equal(existsSync(fakeSqlLog), false, 'preflight must not issue the mutation transaction');

  const originalSafety = readFileSync(candidateSafety, 'utf8');
  const safetyRelative = 'storyforge-v5/scripts/phase-one-release-safety.mjs';
  let gitResult = spawnSync(
    'git',
    ['-C', repository, 'update-index', '--assume-unchanged', safetyRelative],
    { encoding: 'utf8' },
  );
  assert.equal(gitResult.status, 0, gitResult.stderr || gitResult.stdout);
  writeFileSync(
    candidateSafety,
    'console.log(JSON.stringify({ ok: true, bypass: true }));\n',
  );
  const hiddenSafetyEdit = run(candidateRunner, ['preflight'], environment);
  assert.notEqual(hiddenSafetyEdit.status, 0);
  assert.match(
    hiddenSafetyEdit.stderr,
    /rejects assume-unchanged or skip-worktree index flags/,
  );
  assert.doesNotMatch(hiddenSafetyEdit.stdout, /B1_508_PRODUCTION_MIGRATION_PREFLIGHT_PASS/);
  gitResult = spawnSync(
    'git',
    ['-C', repository, 'update-index', '--no-assume-unchanged', safetyRelative],
    { encoding: 'utf8' },
  );
  assert.equal(gitResult.status, 0, gitResult.stderr || gitResult.stdout);
  writeFileSync(candidateSafety, originalSafety);
  assert.equal(
    spawnSync(
      'git',
      ['-C', repository, 'status', '--porcelain=v1', '--untracked-files=all'],
      { encoding: 'utf8' },
    ).stdout,
    '',
  );

  const apply = run(candidateRunner, ['apply'], {
    ...environment,
    STORYFORGE_MIGRATION_CONFIRM: 'B1-508-APPLY-M4',
  });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  assert.match(apply.stdout, /B1_508_PRODUCTION_MIGRATIONS_APPLIED/);
  assert.match(apply.stdout, /migration_count=9/);
  const transactionSql = readFileSync(fakeSqlLog, 'utf8');
  assert.match(transactionSql, /pg_advisory_xact_lock/);
  assert.match(transactionSql, /\\getenv app_password STORYFORGE_APP_DB_PASSWORD/);
  assert.match(transactionSql, /ALTER ROLE storyforge_app PASSWORD :'app_password'/);
  assert.match(transactionSql, /ALTER ROLE storyforge_app LOGIN/);
  assert.doesNotMatch(transactionSql, /REVOKE authenticated FROM storyforge_app/);
  assert.doesNotMatch(
    transactionSql,
    /GRANT authenticated TO storyforge_app WITH INHERIT FALSE, SET TRUE/,
  );
  assert.match(transactionSql, /application role membership closure is not exact/);
  assert.match(transactionSql, /application role relation ACL closure is not exact/);
  assert.match(transactionSql, /application role routine ACL closure is not exact/);
  assert.match(
    transactionSql,
    /effective authenticated\/PUBLIC authority closure is not exact/,
  );
  assert.ok(
    transactionSql.indexOf('application role routine ACL closure is not exact')
      < transactionSql.indexOf('ALTER ROLE storyforge_app LOGIN'),
    'exact privilege closure must execute before LOGIN is enabled',
  );
  assert.match(transactionSql, /B1-506 post-migration ledger is not exact/);
  assert.match(transactionSql, /20260730000100_b1_507b_reconciliation_state\.sql/);
  assert.doesNotMatch(
    transactionSql,
    /INSERT INTO public\.sf_schema_migrations[\s\S]*:'version_1'/,
  );
  assert.match(apply.stdout, /feature_flag_seeded_by=33333333-3333-4333-8333-333333333333/);
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
