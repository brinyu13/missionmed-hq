import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../scripts/apply-b1-514-production-migrations.sh', import.meta.url), 'utf8');

test('B1-514 runner binds the clean commit, fresh backup, PRE manifest, PG18, TLS, and exact ledger', () => {
  for (const marker of [
    'STORYFORGE_DB_BACKUP_ID',
    'STORYFORGE_DB_BACKUP_SHA256',
    'STORYFORGE_SURVIVAL_PRE_MANIFEST',
    "manifest?.capture?.phase!=='pre'",
    'candidateSha256',
    'Git worktree is not clean',
    'PostgreSQL 18 psql is required',
    'PGSSLMODE=require',
    'accepted baseline ledger differs',
    '--single-transaction',
  ]) assert.ok(source.includes(marker), marker);
});

test('B1-514 runner applies only the seven additive V2 migrations and seeds exact governed libraries', () => {
  assert.equal((source.match(/20260810\d+_b1_514_v(?:2|21)_[a-z0-9_]+\.sql/g) || []).filter((value, index, all) => all.indexOf(value) === index).length, 7);
  assert.match(source, /seed-inspiration-prompts\.mjs/);
  assert.match(source, /seed-contributor-prompts\.mjs/);
  assert.match(source, /\|81\|48/);
  assert.match(source, /visibility IS NOT NULL/);
  assert.match(source, /B1-514-APPLY/);
});
