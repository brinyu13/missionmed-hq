import test from 'node:test';
import assert from 'node:assert/strict';

process.env.HOMEBASE_DATABASE_URL ||= 'postgres://localhost:5432/homebase_test_placeholder';
process.env.HOMEBASE_JWT_ISSUER ||= 'http://127.0.0.1:4190';

const { PS_STAGES } = await import('../../server/app.mjs');
const { verifyToken } = await import('../../server/auth.mjs');

test('PS state machine preserves the legacy eight stages in order', () => {
  assert.equal(PS_STAGES.length, 8);
  PS_STAGES.forEach((meta, index) => {
    assert.equal(meta.stage, index);
    assert.ok(meta.admin.length > 0);
    assert.ok(meta.student.length > 0);
  });
  assert.equal(PS_STAGES[0].student, 'Getting Started');
  assert.equal(PS_STAGES[4].student, 'Advanced Draft');
  assert.equal(PS_STAGES[7].admin, 'Final completed');
});

test('verifyToken refuses a missing bearer token', async () => {
  await assert.rejects(() => verifyToken(''), (error) => {
    assert.equal(error.code, 'auth_required');
    return true;
  });
});

test('verifyToken refuses a malformed token', async () => {
  await assert.rejects(() => verifyToken('not-a-jwt'));
});
