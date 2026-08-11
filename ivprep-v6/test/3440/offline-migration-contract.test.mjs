import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../../supabase/migrations/20260811170000_ivprep_3440_admin_canary.sql', import.meta.url);

test('offline IV Prep migration is service-role-only and deny-by-default', { skip: !existsSync(migrationUrl) }, async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /offline-only schema candidate/u);
  for (const table of [
    'ivprep_entitlements',
    'ivprep_cookie_revocations',
    'ivprep_interview_bindings',
    'ivprep_provider_reservations',
    'ivprep_idempotency',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'u'));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, 'u'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'u'));
    assert.match(sql, new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`, 'u'));
  }
  assert.equal(/create\s+policy/iu.test(sql), false);
  assert.equal(/security\s+definer/iu.test(sql), false);
  assert.equal(/auth\.uid|accessToken|raw_cookie/iu.test(sql), false);
  assert.match(sql, /test_number between 1 and 3/u);
  assert.match(sql, /reserved_seconds between 1 and 59/u);
  assert.match(sql, /cookie_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/u);
});
