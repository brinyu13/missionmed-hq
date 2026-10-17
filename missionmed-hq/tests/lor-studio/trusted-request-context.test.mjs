import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
  createTrustedRequestContext,
  readTrustedRequestContext,
  runWithTrustedRequestContext,
} from '../../lor-studio/security/trusted-request-context.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function validContext(overrides = {}) {
  return {
    schemaVersion: TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
    authenticatedSubject: 'wp:123',
    actorRole: 'student',
    sourceReferenceHash: HASH_A,
    proofHash: HASH_B,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    clientAsserted: false,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((settle) => { resolve = settle; });
  return { promise, resolve };
}

test('creates a detached frozen null-prototype context with exact primitive values', () => {
  const input = validContext();
  const context = createTrustedRequestContext(input);

  assert.equal(Object.getPrototypeOf(context), null);
  assert.equal(Object.isFrozen(context), true);
  assert.equal(context.authenticatedSubject, 'wp:123');
  assert.notEqual(context, input);

  input.authenticatedSubject = 'wp:456';
  assert.equal(context.authenticatedSubject, 'wp:123');
  assert.throws(() => { context.actorRole = 'mentor'; }, TypeError);
});

test('rejects accessors, non-enumerable descriptors, inherited keys, symbols, and non-plain objects', () => {
  const accessor = validContext();
  Object.defineProperty(accessor, 'actorRole', {
    enumerable: true,
    get() {
      throw new Error('must not be invoked');
    },
  });
  assert.throws(() => createTrustedRequestContext(accessor), /enumerable data property/u);

  const hidden = validContext();
  Object.defineProperty(hidden, 'proofHash', { value: HASH_B, enumerable: false });
  assert.throws(() => createTrustedRequestContext(hidden), /exact context keys|enumerable data property/u);

  const inherited = Object.create({ inherited: true });
  Object.assign(inherited, validContext());
  assert.throws(() => createTrustedRequestContext(inherited), /plain object/u);

  const symbol = validContext();
  symbol[Symbol('extra')] = true;
  assert.throws(() => createTrustedRequestContext(symbol), /exact context keys/u);

  assert.throws(() => createTrustedRequestContext([]), /plain object/u);
  assert.throws(() => createTrustedRequestContext(new Date()), /plain object/u);
  assert.throws(() => createTrustedRequestContext(null), /plain object/u);
});

test('rejects missing and extra keys', () => {
  const missing = validContext();
  delete missing.proofHash;
  assert.throws(() => createTrustedRequestContext(missing), /exact context keys/u);
  assert.throws(
    () => createTrustedRequestContext({ ...validContext(), requestHeader: 'client-asserted' }),
    /exact context keys/u,
  );
});

test('rejects malformed subjects, roles, hashes, and schema versions', () => {
  for (const authenticatedSubject of [
    '', '123', 'wp:0', 'wp:01', 'wp:-1', 'wp:1.5', 'wp:9007199254740992', 123,
  ]) {
    assert.throws(
      () => createTrustedRequestContext(validContext({ authenticatedSubject })),
      /authenticatedSubject/u,
    );
  }

  for (const actorRole of ['', 'admin', 'Student', null]) {
    assert.throws(() => createTrustedRequestContext(validContext({ actorRole })), /actorRole/u);
  }

  for (const fieldName of ['sourceReferenceHash', 'proofHash']) {
    for (const invalidHash of ['', 'a'.repeat(63), 'A'.repeat(64), 'g'.repeat(64), 1, undefined]) {
      assert.throws(
        () => createTrustedRequestContext(validContext({ [fieldName]: invalidHash })),
        new RegExp(fieldName, 'u'),
      );
    }
    assert.equal(createTrustedRequestContext(validContext({ [fieldName]: null }))[fieldName], null);
  }

  assert.throws(
    () => createTrustedRequestContext(validContext({ schemaVersion: 'missionmed.lor.trusted-request-context.v2' })),
    /schemaVersion/u,
  );
});

test('requires exact server-owned boolean assertions', () => {
  const cases = [
    ['entitlementVerified', false],
    ['entitlementVerified', 1],
    ['lorEnabled', false],
    ['canaryAuthorized', 'true'],
    ['clientAsserted', true],
    ['clientAsserted', 0],
  ];
  for (const [fieldName, value] of cases) {
    assert.throws(
      () => createTrustedRequestContext(validContext({ [fieldName]: value })),
      new RegExp(fieldName, 'u'),
    );
  }
});

test('reader fails closed outside a scope and returns detached frozen copies inside it', async () => {
  assert.throws(() => readTrustedRequestContext(), /unavailable/u);

  await runWithTrustedRequestContext(validContext(), async () => {
    const first = readTrustedRequestContext();
    const second = readTrustedRequestContext();
    assert.notEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.getPrototypeOf(first), null);
    assert.equal(first.authenticatedSubject, 'wp:123');
    assert.throws(() => { first.proofHash = null; }, TypeError);
    assert.equal(second.proofHash, HASH_B);
  });

  assert.throws(() => readTrustedRequestContext(), /unavailable/u);
});

test('concurrent async scopes remain isolated', async () => {
  const firstEntered = deferred();
  const releaseFirst = deferred();
  const secondEntered = deferred();
  const releaseSecond = deferred();

  const firstRun = runWithTrustedRequestContext(
    validContext({ authenticatedSubject: 'wp:101', actorRole: 'student' }),
    async () => {
      firstEntered.resolve();
      await releaseFirst.promise;
      return readTrustedRequestContext();
    },
  );
  const secondRun = runWithTrustedRequestContext(
    validContext({ authenticatedSubject: 'wp:202', actorRole: 'mentor' }),
    async () => {
      secondEntered.resolve();
      await releaseSecond.promise;
      return readTrustedRequestContext();
    },
  );

  await Promise.all([firstEntered.promise, secondEntered.promise]);
  releaseSecond.resolve();
  const second = await secondRun;
  releaseFirst.resolve();
  const first = await firstRun;

  assert.equal(first.authenticatedSubject, 'wp:101');
  assert.equal(first.actorRole, 'student');
  assert.equal(second.authenticatedSubject, 'wp:202');
  assert.equal(second.actorRole, 'mentor');
  assert.throws(() => readTrustedRequestContext(), /unavailable/u);
});

test('scope is inactive after resolve and detached work fails closed', async () => {
  const detachedEntered = deferred();
  const releaseDetached = deferred();
  let detachedResult;

  await runWithTrustedRequestContext(validContext(), async () => {
    detachedResult = (async () => {
      detachedEntered.resolve();
      await releaseDetached.promise;
      return assert.throws(() => readTrustedRequestContext(), /unavailable/u);
    })();
    await detachedEntered.promise;
  });

  releaseDetached.resolve();
  await detachedResult;
  assert.throws(() => readTrustedRequestContext(), /unavailable/u);
});

test('scope is inactive after reject and the original rejection is preserved', async () => {
  const expected = new Error('operation failed');
  await assert.rejects(
    runWithTrustedRequestContext(validContext(), async () => {
      assert.equal(readTrustedRequestContext().authenticatedSubject, 'wp:123');
      throw expected;
    }),
    (error) => error === expected,
  );
  assert.throws(() => readTrustedRequestContext(), /unavailable/u);
});
