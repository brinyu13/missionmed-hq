import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DR133_ARTIFACTS,
  DR133_SUCCESSOR_STAGES,
  expectedDr133SuccessorSentinel,
  extractSuccessorRollbackGuardVerificationSql,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';

const migrationUrl = new URL(
  '../../scripts/lor-studio/migrations/20260830073256_f2_lor_1012_faculty_scope_durable_verification.sql',
  import.meta.url,
);
const rollbackUrl = new URL(
  '../../scripts/lor-studio/rollbacks/20260830073256_f2_lor_1012_faculty_scope_durable_verification.rollback.sql',
  import.meta.url,
);

function resolverBody(sql) {
  const startMarker = 'CREATE OR REPLACE FUNCTION lor_studio.resolve_faculty_case_scope(';
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf('$faculty_scope$;', start);
  assert.ok(start >= 0 && end > start);
  return sql.slice(start, end + '$faculty_scope$;'.length);
}

test('faculty-scope successor is hash-pinned and is the last production stage', async () => {
  const [migration, rollback] = await Promise.all([
    readFile(migrationUrl),
    readFile(rollbackUrl),
  ]);
  const forwardArtifact = DR133_ARTIFACTS.find(
    ({ id }) => id === 'faculty-scope-durable-verification',
  );
  const rollbackArtifact = DR133_ARTIFACTS.find(
    ({ id }) => id === 'faculty-scope-durable-verification-rollback',
  );
  assert.equal(createHash('sha256').update(migration).digest('hex'), forwardArtifact.sha256);
  assert.equal(createHash('sha256').update(rollback).digest('hex'), rollbackArtifact.sha256);
  assert.deepEqual(DR133_SUCCESSOR_STAGES.at(-1), {
    id: 'faculty-scope-durable-verification',
    rollbackId: 'faculty-scope-durable-verification-rollback',
    sentinelSuffix: 'facultyScopeDurableVerification=20260830073256',
  });
  assert.match(
    expectedDr133SuccessorSentinel(),
    /\|privateStorageObjectIdRegex=20260826011900\|facultyScopeDurableVerification=20260830073256$/u,
  );
});

test('successor makes verified faculty access durable without weakening revocation or binding', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  const resolver = resolverBody(migration);
  for (const required of [
    'invitation.used_at IS NOT NULL',
    'invitation.revoked_at IS NULL',
    'invitation.used_at < invitation.expires_at',
    'verification.otp_revoked IS FALSE',
    'verification.otp_verified_at <= verification.invitation_used_at',
    'verification.invitation_used_at < verification.otp_expires_at',
    'verification.invitation_used_at = invitation.used_at',
    'verification.faculty_auth_uid = invitation.faculty_auth_uid',
    'faculty_otp_proof_revocations',
    'eligible_count <> 1',
    "ERRCODE = 'P1202'",
  ]) {
    assert.match(resolver, new RegExp(required.replaceAll('.', '\\.'), 'u'), required);
  }
  assert.doesNotMatch(
    resolver,
    /invitation\.expires_at > pg_catalog\.statement_timestamp\(\)/u,
  );
  assert.doesNotMatch(
    resolver,
    /verification\.otp_expires_at > pg_catalog\.statement_timestamp\(\)/u,
  );
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/u);
  assert.match(migration, /OWNER TO lor_studio_command_owner/u);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO lor_studio_app/u);
  assert.doesNotMatch(migration, /\bCASCADE\b/u);
});

test('rollback is guarded, literal, exact, and restores predecessor semantics without CASCADE', async () => {
  const rollback = await readFile(rollbackUrl, 'utf8');
  const resolver = resolverBody(rollback);
  const guard = extractSuccessorRollbackGuardVerificationSql(
    rollback,
    'faculty-scope-durable-verification-rollback',
  );
  assert.match(guard, /faculty-scope rollback custody mismatch/u);
  assert.doesNotMatch(guard, /CREATE OR REPLACE FUNCTION lor_studio\.resolve_faculty_case_scope/u);
  assert.match(
    resolver,
    /invitation\.expires_at > pg_catalog\.statement_timestamp\(\)/u,
  );
  assert.match(
    resolver,
    /verification\.otp_expires_at > pg_catalog\.statement_timestamp\(\)/u,
  );
  assert.match(rollback, /suffix text := '\|facultyScopeDurableVerification=20260830073256'/u);
  assert.match(rollback, /pg_catalog\.right\(observed_sentinel/u);
  assert.doesNotMatch(rollback, /\bCASCADE\b/u);
});
