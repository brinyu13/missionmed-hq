import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260920170000_ivoc_user_credits.sql',
  import.meta.url,
);

test('per-user credit accounting is atomic, idempotent, append-only, and fail-fast', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(migration, /create table public\.ivoc_credit_accounts/u);
  assert.match(migration, /create table public\.ivoc_credit_events/u);
  assert.match(migration, /idempotency_key uuid not null unique/u);
  assert.match(migration, /perform pg_advisory_xact_lock\(hashtextextended\(p_subject_id, 4902\)\)/u);
  assert.match(migration, /if next_consumed > next_allowance \+ next_override/u);
  assert.match(migration, /ivoc_credit_balance_insufficient' using errcode = 'P0001'/u);
  assert.match(migration, /ivoc_credit_version_conflict' using errcode = 'P0001'/u);
  assert.match(migration, /ivoc_credit_idempotency_conflict' using errcode = 'P0001'/u);
  assert.match(migration, /alter table public\.ivoc_credit_accounts force row level security/u);
  assert.match(migration, /alter table public\.ivoc_credit_events force row level security/u);
  assert.doesNotMatch(migration, /grant .* to (anon|authenticated)/u);
  assert.match(migration, /grant execute on function public\.ivoc_mutate_user_credits/u);
});
