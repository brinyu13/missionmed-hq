import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FACULTY_CANDIDATE_CREDENTIAL_CONTRACT,
  FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
  createFacultyCandidateCredentialContext,
  readFacultyCandidateCredentialContext,
  runWithFacultyCandidateCredentialContext,
} from '../../lor-studio/security/faculty-candidate-credential-context.mjs';

const NOW = new Date('2026-08-25T12:05:00.000Z');
const TOKEN_HASH = 'a'.repeat(64);
const FLOW_NONCE_HASH = 'b'.repeat(64);

function credential(overrides = {}) {
  return {
    schemaVersion: FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
    authoritySource: 'server_verified_sealed_candidate_cookie',
    authenticatedSubject: 'wp:43',
    invitationId: 'invitation-faculty-1',
    tokenHash: TOKEN_HASH,
    flowNonceHash: FLOW_NONCE_HASH,
    issuedAt: '2026-08-25T12:00:00.000Z',
    expiresAt: '2026-08-25T12:10:00.000Z',
    clientAsserted: false,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test('valid server credential is exact, detached, immutable, and request scoped', async () => {
  const input = credential();
  const created = createFacultyCandidateCredentialContext(input, NOW);
  assert.equal(Object.getPrototypeOf(created), null);
  assert.equal(Object.isFrozen(created), true);
  assert.deepEqual({ ...created }, input);

  input.authenticatedSubject = 'wp:999';
  input.tokenHash = 'c'.repeat(64);
  assert.equal(created.authenticatedSubject, 'wp:43');
  assert.equal(created.tokenHash, TOKEN_HASH);

  await runWithFacultyCandidateCredentialContext(credential(), async () => {
    const first = readFacultyCandidateCredentialContext();
    const second = readFacultyCandidateCredentialContext();
    assert.notEqual(first, second);
    assert.equal(Object.getPrototypeOf(first), null);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(first.authenticatedSubject, 'wp:43');
    assert.equal(first.invitationId, 'invitation-faculty-1');
  }, NOW);

  assert.throws(
    () => readFacultyCandidateCredentialContext(),
    /context is unavailable/u,
  );
  assert.deepEqual(FACULTY_CANDIDATE_CREDENTIAL_CONTRACT, {
    schemaVersion: FACULTY_CANDIDATE_CREDENTIAL_SCHEMA,
    authoritySource: 'server_verified_sealed_candidate_cookie',
    maximumLifetimeSeconds: 900,
    rawTokenAccepted: false,
    browserPersistence: 'none',
    requestScope: 'exact_invitation_candidate_verification_only',
  });
});

test('forged, client-asserted, accessor, and raw-secret credentials fail closed without echo', () => {
  const rawToken = 'raw-candidate-token-that-must-not-escape';
  const variants = [
    credential({ schemaVersion: 'missionmed.lor.faculty-candidate-credential.attacker' }),
    credential({ authoritySource: 'client_asserted_cookie' }),
    credential({ clientAsserted: true }),
    credential({ clientAsserted: 'false' }),
    { ...credential(), rawToken },
    Object.assign(Object.create({ inherited: true }), credential()),
    Object.defineProperty(credential(), 'tokenHash', {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error(rawToken);
      },
    }),
  ];

  for (const variant of variants) {
    assert.throws(
      () => createFacultyCandidateCredentialContext(variant, NOW),
      (error) => {
        assert.equal(error instanceof TypeError, true);
        assert.doesNotMatch(`${error.message} ${JSON.stringify(error)}`, /raw-candidate-token/u);
        return true;
      },
    );
  }
});

test('expired, noncanonical, overlong, and future-issued credentials fail closed', () => {
  for (const candidate of [
    credential({ expiresAt: NOW.toISOString() }),
    credential({ expiresAt: '2026-08-25T12:04:59.999Z' }),
    credential({ expiresAt: '2026-08-25T12:00:00.000Z' }),
    credential({ expiresAt: '2026-08-25T12:15:00.001Z' }),
    credential({ issuedAt: '2026-08-25T12:05:30.001Z' }),
    credential({ issuedAt: '2026-08-25T08:00:00-04:00' }),
    credential({ expiresAt: 'not-an-instant' }),
  ]) {
    assert.throws(
      () => createFacultyCandidateCredentialContext(candidate, NOW),
      /Invalid faculty candidate credential/u,
    );
  }
  assert.throws(
    () => createFacultyCandidateCredentialContext(credential(), new Date('invalid')),
    /credential is unavailable or expired/u,
  );
});

test('malformed subjects and invitation locators are denied; exact valid bindings remain isolated', async () => {
  for (const candidate of [
    credential({ authenticatedSubject: '' }),
    credential({ authenticatedSubject: '43' }),
    credential({ authenticatedSubject: 'wp:0' }),
    credential({ authenticatedSubject: 'wp:043' }),
    credential({ authenticatedSubject: 'WP:43' }),
    credential({ invitationId: '' }),
    credential({ invitationId: '../invitation-faculty-1' }),
    credential({ invitationId: 'invitation/faculty/1' }),
    credential({ invitationId: `invitation-${'x'.repeat(200)}` }),
  ]) {
    assert.throws(
      () => createFacultyCandidateCredentialContext(candidate, NOW),
      /credential is unavailable or expired/u,
    );
  }

  const firstEntered = deferred();
  const secondEntered = deferred();
  const release = deferred();
  const first = runWithFacultyCandidateCredentialContext(credential(), async () => {
    firstEntered.resolve();
    await release.promise;
    const context = readFacultyCandidateCredentialContext();
    return [context.authenticatedSubject, context.invitationId];
  }, NOW);
  const second = runWithFacultyCandidateCredentialContext(credential({
    authenticatedSubject: 'wp:44',
    invitationId: 'invitation-faculty-2',
    tokenHash: 'c'.repeat(64),
    flowNonceHash: 'd'.repeat(64),
  }), async () => {
    secondEntered.resolve();
    await release.promise;
    const context = readFacultyCandidateCredentialContext();
    return [context.authenticatedSubject, context.invitationId];
  }, NOW);
  await Promise.all([firstEntered.promise, secondEntered.promise]);
  release.resolve();
  assert.deepEqual(await first, ['wp:43', 'invitation-faculty-1']);
  assert.deepEqual(await second, ['wp:44', 'invitation-faculty-2']);
});

test('scope teardown prevents delayed-task leakage after success and rejection', async () => {
  let delayedRead;
  const result = await runWithFacultyCandidateCredentialContext(credential(), async () => {
    delayedRead = async () => readFacultyCandidateCredentialContext();
    return 'verified';
  }, NOW);
  assert.equal(result, 'verified');
  await assert.rejects(delayedRead, /context is unavailable/u);

  const sentinel = new Error('operation failed');
  await assert.rejects(
    () => runWithFacultyCandidateCredentialContext(credential(), async () => {
      assert.equal(readFacultyCandidateCredentialContext().invitationId, 'invitation-faculty-1');
      throw sentinel;
    }, NOW),
    (error) => error === sentinel,
  );
  assert.throws(
    () => readFacultyCandidateCredentialContext(),
    /context is unavailable/u,
  );
});

test('nested scope restores the exact outer binding and never exposes an ended inner scope', async () => {
  await runWithFacultyCandidateCredentialContext(credential(), async () => {
    assert.equal(readFacultyCandidateCredentialContext().invitationId, 'invitation-faculty-1');
    await runWithFacultyCandidateCredentialContext(credential({
      authenticatedSubject: 'wp:44',
      invitationId: 'invitation-faculty-2',
      tokenHash: 'c'.repeat(64),
      flowNonceHash: 'd'.repeat(64),
    }), async () => {
      assert.equal(readFacultyCandidateCredentialContext().invitationId, 'invitation-faculty-2');
    }, NOW);
    assert.equal(readFacultyCandidateCredentialContext().invitationId, 'invitation-faculty-1');
  }, NOW);
});

test('missing operation and malformed hashes are rejected before a scope can exist', async () => {
  await assert.rejects(
    () => runWithFacultyCandidateCredentialContext(credential(), null, NOW),
    /operation required/u,
  );
  for (const candidate of [
    credential({ tokenHash: 'A'.repeat(64) }),
    credential({ tokenHash: 'a'.repeat(63) }),
    credential({ flowNonceHash: 'b'.repeat(65) }),
  ]) {
    assert.throws(
      () => createFacultyCandidateCredentialContext(candidate, NOW),
      /credential is unavailable or expired/u,
    );
  }
  assert.throws(
    () => readFacultyCandidateCredentialContext(),
    /context is unavailable/u,
  );
});
