import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../scripts/apply-b1-515-production-migration.sh', import.meta.url), 'utf8');

test('B1-515 runner binds exact custody, fresh recovery evidence, PG18, TLS, and survival v3', () => {
  for (const marker of [
    'STORYFORGE_RAILWAY_BACKUP_ID', 'STORYFORGE_KINSTA_BACKUP_RECEIPT',
    'STORYFORGE_KINSTA_SNAPSHOT_RECEIPT', 'STORYFORGE_DB_BACKUP_SHA256',
    'STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER', 'Git worktree is not clean',
    'PostgreSQL 18 psql is required', 'PGSSLMODE=require',
    "manifest?.schema!=='missionmed.storyforge.survival-manifest.v3'",
    '--single-transaction', 'B1-515-APPLY', 'B1_515_PRODUCTION_MIGRATION_APPLY_PASS',
  ]) assert.ok(source.includes(marker), marker);
});

test('B1-515 runner permits only the exact empty tables, default-off flags, and ledger row', () => {
  assert.equal((source.match(/20260812120000_b1_515_v201_reviews_collections_peer\.sql/g) || []).length, 1);
  for (const table of ['sf_story_trash', 'sf_story_use_reviews', 'sf_story_publications', 'sf_peer_story_grants', 'sf_peer_feedback']) {
    assert.match(source, new RegExp(`--expected-table-addition ${table}`));
  }
  for (const flag of ['story_archive', 'story_promotions', 'per_use_scoring', 'peer_share']) {
    assert.ok(source.includes(flag));
  }
  assert.match(source, /--expected-feature-flag-addition/);
  assert.match(source, /protected user or story counts changed/);
  assert.match(source, /migration ledger is not the exact B1-514 V2 baseline/);
});
