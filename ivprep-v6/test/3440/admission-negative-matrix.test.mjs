import assert from 'node:assert/strict';
import test from 'node:test';

import { strictProjectHqSession, validateIvPrepMutation } from '../../server/admission-contract.mjs';
import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';

const NOW = Date.parse('2026-08-11T16:00:00.000Z');
const FINGERPRINT = 'a'.repeat(64);

function registryWithEntitlement() {
  const registry = new InMemoryAdmissionRegistry({ now: () => NOW });
  registry.grantSyntheticEntitlement({
    subject: 'wp:47',
    revision: 'local-1',
    expiresAtMs: NOW + 60_000,
    founder: true,
    voice: true,
    video: false,
    grantedVideoSeconds: 0,
  });
  return registry;
}

function validSession(overrides = {}) {
  return {
    version: 1,
    issuedAt: new Date(NOW - 60_000).toISOString(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    csrfToken: 'csrf_token_1234567890',
    authSource: 'wordpress-cookie',
    user: { id: 47, roles: ['administrator'] },
    ...overrides,
  };
}

function admit({ hqSession = validSession(), registry = registryWithEntitlement(), headers = {}, fingerprint = FINGERPRINT } = {}) {
  return strictProjectHqSession({
    request: { headers },
    hqSession,
    cookieFingerprint: fingerprint,
    registry,
    now: NOW,
    maxSessionTtlSeconds: 300,
  });
}

test('strict product admission accepts only a current entitled HQ cookie session', () => {
  const result = admit();
  assert.equal(result.ok, true);
  assert.equal(result.subject, 'wp:47');
  assert.equal(result.entitlement.video, false);
});

test('negative authentication matrix fails closed without projecting session secrets', () => {
  const cases = [
    { name: 'missing session', hqSession: null },
    { name: 'array session', hqSession: [] },
    { name: 'missing fingerprint', fingerprint: null },
    { name: 'wrong version', hqSession: validSession({ version: 2 }) },
    { name: 'missing expiry', hqSession: validSession({ expiresAt: null }) },
    { name: 'expired', hqSession: validSession({ expiresAt: new Date(NOW).toISOString() }) },
    { name: 'future issued-at', hqSession: validSession({ issuedAt: new Date(NOW + 360_000).toISOString() }) },
    { name: 'TTL too long', hqSession: validSession({ expiresAt: new Date(NOW + 601_000).toISOString() }) },
    { name: 'invalid CSRF', hqSession: validSession({ csrfToken: 'short' }) },
    { name: 'invalid source', hqSession: validSession({ authSource: 'bearer' }) },
    { name: 'invalid WP identity', hqSession: validSession({ user: { id: 0, roles: [] } }) },
    { name: 'invalid roles', hqSession: validSession({ user: { id: 47, roles: 'administrator' } }) },
    { name: 'Authorization forbidden', headers: { authorization: 'Bearer opaque' } },
  ];
  for (const item of cases) {
    const result = admit(item);
    assert.deepEqual(result, { ok: false, status: 401, code: 'ivprep_authentication_required' }, item.name);
    assert.equal(JSON.stringify(result).includes('opaque'), false, item.name);
  }
});

test('missing, expired, revoked, or voice-disabled entitlement denies admission', () => {
  const empty = new InMemoryAdmissionRegistry({ now: () => NOW });
  assert.equal(admit({ registry: empty }).code, 'ivprep_admission_denied');

  const expired = new InMemoryAdmissionRegistry({ now: () => NOW });
  assert.throws(() => expired.grantSyntheticEntitlement({ subject: 'wp:47', revision: 'r1', expiresAtMs: NOW, voice: true }));

  const noVoice = new InMemoryAdmissionRegistry({ now: () => NOW });
  noVoice.grantSyntheticEntitlement({ subject: 'wp:47', revision: 'r1', expiresAtMs: NOW + 1_000, voice: false });
  assert.equal(admit({ registry: noVoice }).code, 'ivprep_admission_denied');

  const revoked = registryWithEntitlement();
  revoked.recordLogout({ cookieFingerprint: FINGERPRINT });
  assert.equal(admit({ registry: revoked }).code, 'ivprep_authentication_required');
});

test('mutations require the exact session CSRF and same origin', () => {
  const admission = admit();
  const good = { headers: { origin: 'https://hq.missionmed.ai', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': admission.csrfToken } };
  assert.equal(validateIvPrepMutation({ request: good, admission, expectedOrigin: 'https://hq.missionmed.ai' }).ok, true);
  for (const request of [
    { headers: { ...good.headers, 'x-mmhq-csrf': 'wrong' } },
    { headers: { ...good.headers, origin: 'https://evil.example' } },
    { headers: { ...good.headers, 'sec-fetch-site': 'cross-site' } },
  ]) assert.equal(validateIvPrepMutation({ request, admission, expectedOrigin: 'https://hq.missionmed.ai' }).ok, false);
});
