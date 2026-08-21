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

import { rowHash, sha256 } from '../../scripts/survival-manifest-lib.mjs';
import {
  migrationSql,
  startEphemeralStoryForgeDatabase,
} from '../postgres/helpers/ephemeral-postgres.mjs';

const packageDir = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const cliPath = path.join(packageDir, 'scripts', 'sf-survival-manifest.mjs');
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_EMIT_9f8df53a';
const candidateSha256 = sha256('B1-514 synthetic candidate');
const b1514Migrations = [
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

test('survival CLI enforces private artifacts and a populated PostgreSQL 18 V2 baseline', { timeout: 180_000 }, async (t) => {
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
    for (const migration of b1514Migrations) {
      await database.client.query(migrationSql(migration).replace(/^\\set .*$/gm, ''));
    }
    await database.client.query(
      `INSERT INTO public.sf_story_versions (
         id, story_id, version_key, body, source
       ) VALUES (
         '51400000-0000-4514-8514-000000000004',
         '51400000-0000-4514-8514-000000000001',
         'thirty_second', $1, 'typed'
       )`,
      [`${sentinel} concise version`],
    );
    await database.client.query(
      `INSERT INTO public.sf_story_version_revisions (
         id, version_id, story_id, body, source, saved_at, actor_user_id
       ) VALUES (
         '51400000-0000-4514-8514-000000000005',
         '51400000-0000-4514-8514-000000000004',
         '51400000-0000-4514-8514-000000000001',
         $1, 'typed', now(), '11111111-1111-4111-8111-111111111111'
       )`,
      [`${sentinel} version revision`],
    );
    await database.client.query(
      `INSERT INTO public.sf_authored_segments (
         id, story_id, story_version_id, source_role, source_entity_type,
         source_entity_id, body_hash, author_id
       ) VALUES (
         '51400000-0000-4514-8514-000000000006',
         '51400000-0000-4514-8514-000000000001',
         '51400000-0000-4514-8514-000000000004',
         'student_typed', 'story_version',
         '51400000-0000-4514-8514-000000000004', $1,
         '11111111-1111-4111-8111-111111111111'
       )`,
      ['a'.repeat(64)],
    );
    await database.client.query(
      `INSERT INTO public.sf_contributor_prompts (
         id, library_key, relationship_ids, text, hint, sort_order
       ) VALUES (
         '51400000-0000-4514-8514-000000000010', 'c-999', ARRAY['parent'],
         'Tell me about one bounded remembered moment.', 'One specific moment.', 999
       )`,
    );
    const prompt = await database.client.query(
      `SELECT id, text FROM public.sf_contributor_prompts
       WHERE id='51400000-0000-4514-8514-000000000010'`,
    );
    await database.client.query(
      `INSERT INTO public.sf_story_invitations (
         id, student_id, contributor_first_name, relationship_id, email,
         status, disclosure_version
       ) VALUES (
         '51400000-0000-4514-8514-000000000007',
         '11111111-1111-4111-8111-111111111111', 'Private', 'parent',
         'private@example.test', 'draft', 'test-v1'
       )`,
    );
    await database.client.query(
      `INSERT INTO public.sf_story_contributions (
         id, invitation_id, kind, transcript, prompt_id, prompt_text_snapshot
       ) VALUES (
         '51400000-0000-4514-8514-000000000008',
         '51400000-0000-4514-8514-000000000007', 'voice', $1, $2, $3
       )`,
      [`${sentinel} guest transcript`, prompt.rows[0].id, prompt.rows[0].text],
    );
    await database.client.query(
      `INSERT INTO public.sf_contribution_audio_assets (
         id, contribution_id, invitation_id, object_key, content_type,
         byte_size, duration_ms, state
       ) VALUES (
         '51400000-0000-4514-8514-000000000009',
         '51400000-0000-4514-8514-000000000008',
         '51400000-0000-4514-8514-000000000007',
         'storyforge-contribution-audio/11111111-1111-4111-8111-111111111111/51400000-0000-4514-8514-000000000007/51400000-0000-4514-8514-000000000008/51400000-0000-4514-8514-000000000009.webm',
         'audio/webm', 18, 1000, 'pending'
       )`,
    );

    await t.test('capture writes a new 0600 artifact without private prose', () => {
      chmodSync(testRoot, 0o700);
      mkdirSync(evidenceRoot, { mode: 0o700 });
      const prePath = path.join(evidenceRoot, 'PRE.json');
      const result = runCli(captureArgs('pre', prePath), { evidenceRoot, connectionString });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(lstatSync(prePath).mode & 0o777, 0o600);
      const contents = readFileSync(prePath, 'utf8');
      assertNoPrivateProse(result.stdout, result.stderr, contents);
      const manifest = JSON.parse(contents);
      for (const table of [
        'sf_mentorship_consent', 'sf_story_versions', 'sf_story_version_revisions',
        'sf_authored_segments', 'sf_inspiration_prompts', 'sf_inspiration_saved',
        'sf_inspiration_events', 'sf_inspiration_favorites', 'sf_inspiration_pins',
        'sf_inspiration_prompt_history', 'sf_contributor_prompts', 'sf_story_invitations',
        'sf_story_invitation_events', 'sf_story_invitation_suppressions',
        'sf_story_invitation_provider_messages', 'sf_story_invitation_delivery_attempts',
        'sf_story_contributions', 'sf_contribution_audio_assets', 'sf_guest_voice_sessions',
        'sf_guest_voice_segments', 'sf_guest_voice_events', 'sf_guest_voice_cleanup_intents',
      ]) assert.ok(manifest.protectedTables[table], table);
      assert.equal(manifest.protectedTables.sf_story_versions.count, 1);
      assert.equal(manifest.protectedTables.sf_story_contributions.count, 1);
      assert.equal(manifest.permanentObjects.rows['contribution_audio:51400000-0000-4514-8514-000000000009'].required, false);
    });

    await t.test('an unchanged populated V2 baseline compares PASS', async () => {
      const prePath = path.join(evidenceRoot, 'PRE.json');
      const postPath = path.join(evidenceRoot, 'POST-UNCHANGED.json');
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
      const postPath = path.join(evidenceRoot, 'POST-UNCHANGED.json');
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

    await t.test('exact contribution review schema evolution preserves every existing field and requires defaults', async () => {
      await database.client.query(
        `ALTER TABLE public.sf_story_contributions
           ADD COLUMN student_score smallint NULL,
           ADD COLUMN student_review_note text NULL,
           ADD COLUMN reviewed_at timestamptz NULL,
           ADD COLUMN row_version bigint NOT NULL DEFAULT 0`,
      );
      const evolvedPath = path.join(evidenceRoot, 'POST-CONTRIBUTION-REVIEW.json');
      const capture = runCli(captureArgs('post', evolvedPath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const withoutContract = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', evolvedPath,
      ], { evidenceRoot, connectionString });
      assert.notEqual(withoutContract.status, 0);
      const withContract = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', evolvedPath,
        '--expected-contribution-review-columns',
      ], { evidenceRoot, connectionString });
      assert.equal(withContract.status, 0, withContract.stderr);

      await database.client.query(
        `UPDATE public.sf_story_contributions SET student_score=5
         WHERE id='51400000-0000-4514-8514-000000000008'`,
      );
      const populatedPath = path.join(evidenceRoot, 'POST-CONTRIBUTION-POPULATED.json');
      const populatedCapture = runCli(captureArgs('post', populatedPath), { evidenceRoot, connectionString });
      assert.equal(populatedCapture.status, 0, populatedCapture.stderr);
      const populatedCompare = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', populatedPath,
        '--expected-contribution-review-columns',
      ], { evidenceRoot, connectionString });
      assert.notEqual(populatedCompare.status, 0);
      await database.client.query(
        `UPDATE public.sf_story_contributions SET student_score=NULL
         WHERE id='51400000-0000-4514-8514-000000000008'`,
      );
      assertNoPrivateProse(capture.stdout, capture.stderr, withoutContract.stdout,
        withoutContract.stderr, withContract.stdout, withContract.stderr,
        populatedCapture.stdout, populatedCapture.stderr,
        populatedCompare.stdout, populatedCompare.stderr,
        readFileSync(evolvedPath, 'utf8'), readFileSync(populatedPath, 'utf8'));
    });

    await t.test('Arena avatar projection schema evolution is default-null and lossless', async () => {
      await database.client.query(
        `ALTER TABLE public.sf_users
           ADD COLUMN arena_avatar_id uuid NULL,
           ADD COLUMN arena_avatar_thumbnail_url text NULL,
           ADD COLUMN arena_avatar_synced_at timestamptz NULL`,
      );
      const evolvedPath = path.join(evidenceRoot, 'POST-ARENA-AVATAR.json');
      const capture = runCli(captureArgs('post', evolvedPath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const withoutContract = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', evolvedPath,
      ], { evidenceRoot, connectionString });
      assert.notEqual(withoutContract.status, 0);
      const withContract = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', evolvedPath,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.equal(withContract.status, 0, withContract.stderr);

      await database.client.query(
        `UPDATE public.sf_users
         SET arena_avatar_id='55555555-5555-4555-8555-555555555555',
             arena_avatar_thumbnail_url='https://cdn.missionmedinstitute.com/avatar.webp',
             arena_avatar_synced_at=now()
         WHERE id='11111111-1111-4111-8111-111111111111'`,
      );
      const populatedPath = path.join(evidenceRoot, 'POST-ARENA-AVATAR-POPULATED.json');
      const populatedCapture = runCli(captureArgs('post', populatedPath), { evidenceRoot, connectionString });
      assert.equal(populatedCapture.status, 0, populatedCapture.stderr);
      const populatedCompare = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', populatedPath,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.notEqual(populatedCompare.status, 0);
      await database.client.query(
        `UPDATE public.sf_users
            SET arena_avatar_id=NULL,
                arena_avatar_thumbnail_url=NULL,
                arena_avatar_synced_at=NULL
          WHERE id='11111111-1111-4111-8111-111111111111'`,
      );
      assertNoPrivateProse(
        capture.stdout, capture.stderr, withoutContract.stdout, withoutContract.stderr,
        withContract.stdout, withContract.stderr, populatedCapture.stdout,
        populatedCapture.stderr, populatedCompare.stdout, populatedCompare.stderr,
        readFileSync(evolvedPath, 'utf8'), readFileSync(populatedPath, 'utf8'),
      );
    });

    await t.test('candidate table and default-off flag additions require exact allowlists', async () => {
      await database.client.query(
        `CREATE TABLE public.sf_peer_feedback (
           id uuid PRIMARY KEY,
           story_id uuid NOT NULL REFERENCES public.sf_stories(id) ON DELETE RESTRICT
         )`,
      );
      await database.client.query(
        `INSERT INTO public.sf_feature_flags (key, scope, updated_by)
         VALUES ('peer_review_test_gate', 'off', '11111111-1111-4111-8111-111111111111')`,
      );
      const candidatePath = path.join(evidenceRoot, 'POST-CANDIDATE.json');
      const capture = runCli(captureArgs('post', candidatePath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const captured = JSON.parse(readFileSync(candidatePath, 'utf8'));
      const flagHash = captured.featureFlags.rows.peer_review_test_gate.rowHash;
      const withoutAllowlist = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', candidatePath,
      ], { evidenceRoot, connectionString });
      assert.notEqual(withoutAllowlist.status, 0);
      const withAllowlist = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', candidatePath,
        '--expected-table-addition', 'sf_peer_feedback',
        '--expected-feature-flag-addition', `peer_review_test_gate:${flagHash}`,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.equal(withAllowlist.status, 0, withAllowlist.stderr);

      await database.client.query(
        `CREATE TABLE public.sf_eras_seed_test (
           id uuid PRIMARY KEY,
           term_id text NOT NULL
         )`,
      );
      await database.client.query(
        `INSERT INTO public.sf_eras_seed_test (id, term_id)
         VALUES ('51400000-0000-4514-8514-000000000099', 'exact-seed')`,
      );
      const populatedCandidatePath = path.join(evidenceRoot, 'POST-POPULATED-CANDIDATE.json');
      const populatedCapture = runCli(captureArgs('post', populatedCandidatePath), {
        evidenceRoot, connectionString,
      });
      assert.equal(populatedCapture.status, 0, populatedCapture.stderr);
      const populatedManifest = JSON.parse(readFileSync(populatedCandidatePath, 'utf8'));
      const tableHash = rowHash(populatedManifest.protectedTables.sf_eras_seed_test);
      const populatedAllowlist = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', populatedCandidatePath,
        '--expected-table-addition', 'sf_peer_feedback',
        '--expected-populated-table-addition', `sf_eras_seed_test:${tableHash}`,
        '--expected-feature-flag-addition', `peer_review_test_gate:${flagHash}`,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.equal(populatedAllowlist.status, 0, populatedAllowlist.stderr);
      const wrongHash = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', populatedCandidatePath,
        '--expected-table-addition', 'sf_peer_feedback',
        '--expected-populated-table-addition', `sf_eras_seed_test:${sha256('wrong')}`,
        '--expected-feature-flag-addition', `peer_review_test_gate:${flagHash}`,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.notEqual(wrongHash.status, 0);
      assertNoPrivateProse(capture.stdout, capture.stderr, withoutAllowlist.stdout,
        withoutAllowlist.stderr, withAllowlist.stdout, withAllowlist.stderr,
        populatedCapture.stdout, populatedCapture.stderr, populatedAllowlist.stdout,
        populatedAllowlist.stderr, wrongHash.stdout, wrongHash.stderr,
        readFileSync(candidatePath, 'utf8'), readFileSync(populatedCandidatePath, 'utf8'));
    });

    await t.test('mutating a populated V2 row fails without emitting private prose', async () => {
      await database.client.query(
        `UPDATE public.sf_story_versions SET body=$1
         WHERE id='51400000-0000-4514-8514-000000000004'`,
        [`${sentinel} mutated version`],
      );
      const mutatedPath = path.join(evidenceRoot, 'POST-MUTATED.json');
      const failureReport = path.join(evidenceRoot, 'COMPARE-MUTATED-FAIL.json');
      const capture = runCli(captureArgs('post', mutatedPath), { evidenceRoot, connectionString });
      assert.equal(capture.status, 0, capture.stderr);
      const captured = JSON.parse(readFileSync(mutatedPath, 'utf8'));
      const flagHash = captured.featureFlags.rows.peer_review_test_gate.rowHash;
      const compare = runCli([
        'compare', '--pre', path.join(evidenceRoot, 'PRE.json'), '--post', mutatedPath,
        '--output', failureReport,
        '--expected-table-addition', 'sf_peer_feedback',
        '--expected-feature-flag-addition', `peer_review_test_gate:${flagHash}`,
        '--expected-contribution-review-columns',
        '--expected-arena-avatar-columns',
      ], { evidenceRoot, connectionString });
      assert.notEqual(compare.status, 0);
      assert.match(compare.stdout, /FAIL STORYFORGE_V1_SURVIVAL/);
      assert.match(readFileSync(failureReport, 'utf8'), /sf_story_versions/);
      assertNoPrivateProse(capture.stdout, capture.stderr, compare.stdout, compare.stderr,
        readFileSync(mutatedPath, 'utf8'), readFileSync(failureReport, 'utf8'));
    });

    await t.test('verified contribution audio cannot be captured without object HEAD proof', async () => {
      await database.client.query(
        `UPDATE public.sf_contribution_audio_assets
         SET state='verified', verified_at=now()
         WHERE id='51400000-0000-4514-8514-000000000009'`,
      );
      const output = path.join(evidenceRoot, 'POST-UNVERIFIED-OBJECT.json');
      const result = runCli(captureArgs('post', output), { evidenceRoot, connectionString });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /audio storage is not configured/i);
      assertNoPrivateProse(result.stdout, result.stderr);
      assert.throws(() => lstatSync(output), /ENOENT/);
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
