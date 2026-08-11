import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { fingerprintIvPrepHqCookie } from '../../server/hq-auth-lifecycle.mjs';

test('cookie fingerprints are stable, domain-separated, and never retain the cookie', () => {
  const raw = 'v1.sensitive.encrypted.cookie';
  const fingerprint = fingerprintIvPrepHqCookie(raw);
  assert.match(fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(fingerprint, fingerprintIvPrepHqCookie(raw));
  assert.equal(fingerprint.includes(raw), false);
  assert.equal(fingerprintIvPrepHqCookie(''), null);
});

test('successful logout revokes admission and requests bound interview termination once', async () => {
  let now = 1_000;
  const registry = new InMemoryAdmissionRegistry({ now: () => now });
  const fingerprint = 'b'.repeat(64);
  registry.grantSyntheticEntitlement({ subject: 'wp:9', revision: 'rev-9', expiresAtMs: 20_000, voice: true });
  registry.bindInterview({ interviewId: 'interview-9', subject: 'wp:9', cookieFingerprint: fingerprint, entitlementRevision: 'rev-9' });
  const requested = [];
  registry.setTerminationHandler('interview-9', async (reason) => requested.push(reason));
  const first = registry.recordLogout({ cookieFingerprint: fingerprint });
  const duplicate = registry.recordLogout({ cookieFingerprint: fingerprint });
  assert.deepEqual(first, { recorded: true, duplicate: false, terminationRequests: 1 });
  assert.deepEqual(duplicate, { recorded: true, duplicate: true, terminationRequests: 0 });
  assert.equal(registry.isRevoked(fingerprint), true);
  assert.equal(registry.bindingFor('interview-9').terminationRequested, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requested, ['hq_logout']);
  now += 24 * 60 * 60 * 1000 + 1;
  assert.equal(registry.isRevoked(fingerprint), false);
});

test('account, cookie, and entitlement revision switching all fail ownership checks', () => {
  const registry = new InMemoryAdmissionRegistry();
  registry.bindInterview({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r1' });
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:2', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r1' }).ok, false);
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'd'.repeat(64), entitlementRevision: 'r1' }).ok, false);
  assert.equal(registry.assertBinding({ interviewId: 'one', subject: 'wp:1', cookieFingerprint: 'c'.repeat(64), entitlementRevision: 'r2' }).ok, false);
});
