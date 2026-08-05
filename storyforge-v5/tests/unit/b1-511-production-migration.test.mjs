import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../scripts/apply-b1-511-production-migration.sh', import.meta.url), 'utf8');

test('B1-511 production runner pins one migration, accepted infrastructure, and a clean exact commit', () => {
  assert.match(source, /MIGRATION_VERSION="20260805190000"/);
  assert.match(source, /MIGRATION_SHA256="9bae7859f5966a8e9fc2f29fe9ccb37b0e59675e830c6b7ccdaef3914532c05f"/);
  assert.match(source, /EXPECTED_PROJECT_ID="875e7c17-d06f-4301-a4bb-e61016f153cf"/);
  assert.match(source, /EXPECTED_VOLUME_INSTANCE_ID="8d4a7b7f-7d55-4a1d-81eb-07221b4a7bf5"/);
  assert.match(source, /Git worktree is not clean/);
  assert.match(source, /production migration ledger differs from the accepted ten-row baseline/);
});

test('B1-511 production runner requires backup, SSL, default-off flags, and forced RLS', () => {
  assert.match(source, /backup receipt must contain exactly sixteen fields/);
  assert.match(source, /provider backup is not locked and non-expiring/);
  assert.match(source, /railway\|postgres\|\$STORYFORGE_EXPECTED_DB_SYSTEM_IDENTIFIER\|true/);
  assert.match(source, /scope='off'/);
  assert.match(source, /relrowsecurity AND relforcerowsecurity/);
  assert.match(source, /STORYFORGE_MIGRATION_CONFIRM:-.*B1-511-APPLY/);
  assert.match(source, /production counts changed after preflight/);
  assert.doesNotMatch(source, /1\/0/);
  assert.match(source, /--single-transaction/);
});
