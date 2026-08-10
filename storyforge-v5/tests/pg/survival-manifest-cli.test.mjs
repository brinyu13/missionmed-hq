import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sha256 } from '../../scripts/survival-manifest-lib.mjs';
import { startEphemeralStoryForgeDatabase } from '../postgres/helpers/ephemeral-postgres.mjs';

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const cliPath = path.join(packageDir, 'scripts', 'sf-survival-manifest.mjs');
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_EMIT_9f8df53a';
const candidateSha256 = sha256('B1-514 synthetic candidate');

function databaseUrl(socketDir, user = 'postgres') {
  return `postgresql://${user}@localhost/storyforge?host=${encodeURIComponent(socketDir)}`;
}

function runCli(args, { evidenceRoot, connectionString }) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: packageDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      STORYFORGE_SURVIVAL_DATABASE_URL: connectionString,
      STORYFORGE_SURVIVAL_EVIDENCE_ROOT: evidenceRoot,
    },
  });
}

function assertNoPrivateProse(...values) {
  for (const value of values) assert.doesNotMatch(String(value || ''), new RegExp(sentinel));
}

function captureArgs(phase, output) {
  return [
    'capture',
    '--phase', phase,
    '--release', 'R1',
    '--candidate-sha256', candidateSha256,
    '--output', output,
    '--require-object-head',
  ];
}

test('survival CLI enforces private artifacts and PostgreSQL 18 migration invariants', { timeout: 120_000 }, async (t) => {
  const database = await startEphemeralStoryForgeDatabase();
  assert.equal(database.postgresMajor, 18);
  const testRoot = mkdtempSync(path.join(tmpdir(), 'storyforge-survival-cli-'));
  const evidenceRoot = path.join(testRoot, 'evidence');
  const wrongModeRoot = path.join(testRoot, 'wrong-mode');
  const symlinkRoot = path.join(testRoot, 'evidence-link');
  const connectionString = databaseUrl(database.socketDir);

  try {
    await database.client.query(
      `INSERT INTO public.sf_stories (
         id, student_id, title, original_text, current_text, lesson, capture_type, status
       ) VALUES (
         '51400000-0000-4514-8514-000000000001',
         '11111111-1111-4111-8111-111111111111', $1, $2, $3, $4, 'text', 'private'
       )`,
      [`${sentinel} title`, `${sentinel} original`, `${sentinel} working`, `${sentinel} lesson`],
    );
    await database.client.query(
      `INSERT INTO public.sf_story_originals (
         story_id, original_transcript, capture_type
       ) VALUES ('51400000-0000-4514-8514-000000000001', $1, 'text')`,
      [`${sentinel} original transcript`],
    );
    await database.client.query(
      `INSERT INTO public.sf_story_revisions (
         id, story_id, revision_no, text_snapshot, title_snapshot, actor_id, reason
       ) VALUES (
         '51400000-0000-4514-8514-000000000002',
         '51400000-0000-4514-8514-000000000001', 0, $1, $2,
         '11111111-1111-4111-8111-111111111111', 'capture'
       )`,
      [`${sentinel} revision`, `${sentinel} revision title`],
    );
    await database.client.query(
      `INSERT INTO public.sf_story_internal_notes (id, story_id, admin_id, body)
       VALUES (
         '51400000-0000-4514-8514-000000000003',
         '51400000-0000-4514-8514-000000000001',
         'cccccccc-cccc-4ccc-8ccc-cccccccccccc', $1
       )`,
      [`${sentinel} private administrator note`],
    );

    await t.test('capture writes a new 0600 artifact without private prose', () => {
      chmodSync(testRoot, 0o700);
      mkdirSync(evidenceRoot, { mode: 0o700 });
      const prePath = path.join(evidenceRoot, 'PRE.json');
      const result = runCli(captureArgs('pre', prePath), { evidenceRoot, connectionString });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(lstatSync(prePath).mode & 0o777, 0o600);
      assertNoPrivateProse(result.stdout, result.stderr, readFileSync(prePath, 'utf8'));
    });

    await t.test('absent visibility to present SQL NULL compares PASS', async () => {
      await database.client.query('ALTER TABLE public.sf_stories ADD COLUMN visibility text');
      const prePath = path.join(evidenceRoot, 'PRE.json');
      const postPath = path.join(evidenceRoot, 'POST-NULL.json');
      const reportPath = path.join(evidenceRoot, 'COMPARE-PASS.json');
      const capture = runCli(captureArgs('post', postPath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const compare = runCli([
        'compare', '--pre', prePath, '--post', postPath, '--output', reportPath,
      ], { evidenceRoot, connectionString });
      assert.equal(compare.status, 0, compare.stderr);
      assert.match(compare.stdout, /PASS STORYFORGE_V1_SURVIVAL/);
      assert.equal(lstatSync(reportPath).mode & 0o777, 0o600);
      assertNoPrivateProse(capture.stdout, capture.stderr, compare.stdout, compare.stderr,
        readFileSync(postPath, 'utf8'), readFileSync(reportPath, 'utf8'));
    });

    await t.test('private root mode, root symlink, outside-root output, and overwrite are rejected', () => {
      const prePath = path.join(evidenceRoot, 'PRE.json');
      const postPath = path.join(evidenceRoot, 'POST-NULL.json');
      const existingOutput = path.join(evidenceRoot, 'COMPARE-PASS.json');
      const overwrite = runCli([
        'compare', '--pre', prePath, '--post', postPath, '--output', existingOutput,
      ], { evidenceRoot, connectionString });
      assert.notEqual(overwrite.status, 0);

      mkdirSync(wrongModeRoot, { mode: 0o755 });
      const wrongMode = runCli([
        'compare', '--pre', prePath, '--post', postPath,
        '--output', path.join(wrongModeRoot, 'report.json'),
      ], { evidenceRoot: wrongModeRoot, connectionString });
      assert.notEqual(wrongMode.status, 0);
      assert.match(wrongMode.stderr, /mode 0700/);

      symlinkSync(evidenceRoot, symlinkRoot);
      const symlink = runCli([
        'compare', '--pre', prePath, '--post', postPath,
        '--output', path.join(symlinkRoot, 'report.json'),
      ], { evidenceRoot: symlinkRoot, connectionString });
      assert.notEqual(symlink.status, 0);
      assert.match(symlink.stderr, /not a symlink/);

      const outside = runCli([
        'compare', '--pre', prePath, '--post', postPath,
        '--output', path.join(testRoot, 'outside.json'),
      ], { evidenceRoot, connectionString });
      assert.notEqual(outside.status, 0);
      assert.match(outside.stderr, /directly inside/);
      assertNoPrivateProse(overwrite.stderr, wrongMode.stderr, symlink.stderr, outside.stderr);
    });

    await t.test('synthetic historical version generation is captured and fails comparison', async () => {
      await database.client.query(
        `CREATE TABLE public.sf_story_versions (
           id uuid PRIMARY KEY,
           story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT,
           version_kind text NOT NULL
         )`,
      );
      await database.client.query(
        `INSERT INTO public.sf_story_versions (id, story_id, version_kind)
         VALUES (
           '51400000-0000-4514-8514-000000000004',
           '51400000-0000-4514-8514-000000000001', 'thirty_second'
         )`,
      );
      const generatedPath = path.join(evidenceRoot, 'POST-GENERATED.json');
      const failureReport = path.join(evidenceRoot, 'COMPARE-GENERATED-FAIL.json');
      const capture = runCli(captureArgs('post', generatedPath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const compare = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', generatedPath,
        '--output', failureReport,
      ], { evidenceRoot, connectionString });
      assert.notEqual(compare.status, 0);
      assert.match(compare.stdout, /FAIL STORYFORGE_V1_SURVIVAL/);
      assert.match(readFileSync(failureReport, 'utf8'), /historical_version_synthesized/);
      assertNoPrivateProse(capture.stdout, capture.stderr, compare.stdout, compare.stderr,
        readFileSync(generatedPath, 'utf8'), readFileSync(failureReport, 'utf8'));
    });

    await t.test('filtered authenticated capture fails before writing an artifact', async () => {
      await database.client.query('CREATE ROLE survival_filtered LOGIN');
      await database.client.query('GRANT USAGE ON SCHEMA public TO survival_filtered');
      await database.client.query('GRANT SELECT ON ALL TABLES IN SCHEMA public TO survival_filtered');
      const filteredPath = path.join(evidenceRoot, 'FILTERED.json');
      const result = runCli(captureArgs('post', filteredPath), {
        evidenceRoot,
        connectionString: databaseUrl(database.socketDir, 'survival_filtered'),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /cannot prove full protected-table visibility/);
      assert.equal(lstatSync(evidenceRoot).isDirectory(), true);
      assertNoPrivateProse(result.stdout, result.stderr);
      assert.throws(() => lstatSync(filteredPath), /ENOENT/);
    });
  } finally {
    await database.stop();
    rmSync(testRoot, { recursive: true, force: true });
  }
});
