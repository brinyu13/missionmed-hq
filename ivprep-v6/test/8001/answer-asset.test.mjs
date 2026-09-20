import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ANSWER_ASSET_SCHEMA,
  assertAnswerAssetOwner,
  normalizeAnswerAssetWrite,
} from '../../../ivoc/contracts/answer-asset.mjs';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260920180000_ivoc_answer_assets.sql',
  import.meta.url,
);

const source = {
  assetId: '6ff8494c-2a9d-40c1-a46b-4c0f3d0ff940',
  expectedVersion: 1,
  ownerSubject: 'wp:42',
  sessionId: '00000000-0000-4000-8000-000000000142',
  recordingId: '00000000-0000-4000-8000-000000000143',
  answerSegmentId: 'segment:00000000-0000-4000-8000-000000000142:primary',
  questionId: 'CORE-01',
  title: 'Leadership answer',
  startMs: 1_500,
  endMs: 8_500,
  strongestAnswer: true,
  changeReason: 'Promote bounded answer clip',
};

test('Match Bridge Ready requires explicit bounded-clip consent and audience', () => {
  const ready = normalizeAnswerAssetWrite({
    ...source,
    status: 'match_bridge_ready',
    audiences: ['match_bridge', 'student', 'match_bridge'],
    consent: { granted: true, scope: 'bounded_clip', grantedAt: '2026-09-20T12:00:00-04:00' },
  });

  assert.equal(ready.schema, ANSWER_ASSET_SCHEMA);
  assert.deepEqual(ready.audiences, ['match_bridge', 'student']);
  assert.equal(ready.consent.grantedAt, '2026-09-20T16:00:00.000Z');
  assert.equal(assertAnswerAssetOwner(ready, 'wp:42'), ready);
});

test('private and revoked AnswerAssets fail closed on audience or consent drift', () => {
  assert.throws(() => normalizeAnswerAssetWrite({
    ...source,
    status: 'private', audiences: ['student', 'match_bridge'],
    consent: { granted: false, scope: 'bounded_clip', grantedAt: null },
  }), /private_audience_invalid/u);
  assert.throws(() => normalizeAnswerAssetWrite({
    ...source,
    status: 'revoked', audiences: ['student'],
    consent: { granted: true, scope: 'bounded_clip', grantedAt: '2026-09-20T16:00:00.000Z' },
  }), /revoked_audience_invalid/u);
  assert.throws(() => assertAnswerAssetOwner(normalizeAnswerAssetWrite({
    ...source,
    status: 'private', audiences: ['student'],
    consent: { granted: false, scope: 'bounded_clip', grantedAt: null },
  }), 'wp:7'), /owner_invalid/u);
});

test('AnswerAsset migration binds clips to owner session, saved recording, answer range, and terminal revocation', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(migration, /create table public\.ivoc_answer_asset_versions/u);
  assert.match(migration, /recording\.status = 'saved'/u);
  assert.match(migration, /p_start_ms >= \(segment\.answer->>'t_start_ms'\)::bigint/u);
  assert.match(migration, /p_end_ms <= \(segment\.answer->>'t_end_ms'\)::bigint/u);
  assert.match(migration, /p_consent->>'scope' <> 'bounded_clip'/u);
  assert.match(migration, /ivoc_answer_asset_revoked' using errcode = 'P0001'/u);
  assert.match(migration, /ivoc_answer_asset_ready_requires_revocation' using errcode = 'P0001'/u);
  assert.match(migration, /if p_status <> 'revoked' or not current_exists then/u);
  assert.match(migration, /force row level security/u);
  assert.doesNotMatch(migration, /grant .* to (anon|authenticated)/u);
});
