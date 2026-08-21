import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compareSurvivalManifests, rowHash } from '../../scripts/survival-manifest-lib.mjs';

const source = await readFile(
  new URL('../../scripts/apply-b1-517-production-migrations.sh', import.meta.url),
  'utf8',
);

test('B1-517 runner binds clean custody, fresh recovery, PG18 TLS, and exact rehearsal evidence', () => {
  for (const marker of [
    'BASE_LEDGER_COUNT=29',
    'BASELINE_LATEST_VERSION=20260814120000',
    'BASELINE_LATEST_SHA256=7d97ecf9fa5d9fec79fd9bc929c169f70912e07ee123574938f416e5b6f71878',
    '20260819220000_b1_515r4_admin_population_scope_repair.sql',
    '20260820120000_b1_517_myeras_alignment.sql',
    'STORYFORGE_RAILWAY_BACKUP_ID',
    'STORYFORGE_DB_BACKUP_SHA256',
    'STORYFORGE_KINSTA_BACKUP_RECEIPT_SHA256',
    'STORYFORGE_KINSTA_SNAPSHOT_RECEIPT_SHA256',
    'STORYFORGE_CANDIDATE_ADDITIONS_RECEIPT_SHA256',
    'Git worktree is not clean',
    'PostgreSQL 18 psql is required',
    'PGSSLMODE=require',
    'missionmed.storyforge.survival-manifest.v3',
    'missionmed.storyforge.candidate-additions.v1',
    'survival runtime dependency pg is unavailable',
    '--single-transaction',
    'B1-517-APPLY',
    'B1_517_PRODUCTION_MIGRATION_APPLY_PASS',
    'pending=2',
  ]) assert.ok(source.includes(marker), marker);
});

test('B1-517 survival reconciliation permits only one explicitly hashed live activity append', () => {
  const original = rowHash({ id: 'session-before', active_ms: '5' });
  const appended = rowHash({ id: 'session-after', active_ms: '9' });
  const table = {
    columnNamesHash: 'a'.repeat(64),
    count: 1,
    rows: { ['b'.repeat(64)]: original },
  };
  const pre = {
    schema: 'missionmed.storyforge.survival-manifest.v3',
    capture: { databaseSystemHash: 'db', fullVisibility: true, objectVerification: 'required_pass' },
    protectedTables: { sf_activity_sessions: table },
    featureFlags: { rows: {} }, permanentObjects: { count: 0, rows: {} }, global: {}, stories: {}, ledger: { rows: {} },
  };
  const post = structuredClone(pre);
  post.protectedTables.sf_activity_sessions = {
    ...table,
    count: 2,
    rows: { ...table.rows, ['c'.repeat(64)]: appended },
  };
  const expected = [['sf_activity_sessions', 'c'.repeat(64), appended]];
  assert.equal(compareSurvivalManifests(pre, post, { expectedProtectedRowAdditions: expected }).pass, true);

  const mutated = structuredClone(post);
  mutated.protectedTables.sf_activity_sessions.rows['b'.repeat(64)] = 'd'.repeat(64);
  assert.equal(compareSurvivalManifests(pre, mutated, { expectedProtectedRowAdditions: expected }).pass, false);

  const extra = structuredClone(post);
  extra.protectedTables.sf_activity_sessions.count = 3;
  extra.protectedTables.sf_activity_sessions.rows['e'.repeat(64)] = 'f'.repeat(64);
  assert.equal(compareSurvivalManifests(pre, extra, { expectedProtectedRowAdditions: expected }).pass, false);
});

test('B1-517 runner permits only exact governed table, flag, and ledger additions', () => {
  for (const table of [
    'sf_eras_profiles', 'sf_eras_taxonomy_terms', 'sf_eras_legacy_theme_map',
    'sf_story_eras_tags', 'sf_myeras_workspaces', 'sf_myeras_experiences',
    'sf_myeras_experience_stories', 'sf_myeras_impactful',
    'sf_story_clinical_case', 'sf_story_use_ranks',
  ]) assert.ok(source.includes(table), table);
  for (const flag of [
    'eras_taxonomy', 'myeras_workspace', 'clinical_case_metadata',
    'use_ranking', 'myeras_versions', 'ai_condensation',
  ]) assert.ok(source.includes(flag), flag);
  assert.match(source, /--expected-populated-table-addition/);
  assert.match(source, /--expected-table-addition/);
  assert.match(source, /--expected-feature-flag-addition/);
  assert.match(source, /--expected-ledger-addition/);
  assert.match(source, /1\|37\|10\|6/);
  assert.match(source, /protected user or story counts changed during B1-517 migration/);
  assert.doesNotMatch(source, /202608131[2-5]0000_b1_515r/);
});

test('B1-517 runner passes the canonical Founder identity into the atomic migration train', () => {
  assert.match(source, /SELECT updated_by FROM public\.sf_feature_flags WHERE key='admin_console'/);
  assert.match(source, /-v founder_user_id="\$founder_id" --single-transaction/);
  assert.match(source, /missionmed\.storyforge\.b1-517\.production-migrations/);
});
