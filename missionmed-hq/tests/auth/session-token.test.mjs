import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SessionTokenError,
  decodeSessionToken,
  readSessionFromHeaders,
  selectSessionCredential,
} from '../../lib/auth/session-token.mjs';

const KEY = Buffer.alloc(32, 0x2a);
const NOW = Date.parse('2026-08-09T18:00:00.000Z');
const COOKIE_NAME = 'mmhq_session';

function validPayload(overrides = {}) {
  return {
    version: 1,
    issuedAt: '2026-08-09T17:55:00.000Z',
    expiresAt: '2026-08-09T18:30:00.000Z',
    csrfToken: 'synthetic-csrf',
    authSource: 'wordpress_handoff',
    audience: 'lor-studio',
    apiScope: 'lor-studio',
    user: { id: 42, subject: 'wp:42', roles: ['subscriber'] },
    ...overrides,
  };
}

function encrypt(value, { plaintext } = {}) {
  const iv = Buffer.from('000102030405060708090a0b', 'hex');
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const input = plaintext ?? JSON.stringify(value);
  const ciphertext = Buffer.concat([cipher.update(input, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${tag.toString('base64url')}`;
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof SessionTokenError && error.code === code);
}

test('accepts a structurally valid future-expiry encrypted session', () => {
  const payload = validPayload();
  const result = decodeSessionToken({ token: encrypt(payload), key: KEY, now: NOW });
  assert.deepEqual(result, payload);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects a missing or invalid encryption key', () => {
  const token = encrypt(validPayload());
  expectCode(() => decodeSessionToken({ token, key: null, now: NOW }), 'SESSION_KEY_INVALID');
  expectCode(() => decodeSessionToken({ token, key: Buffer.alloc(16), now: NOW }), 'SESSION_KEY_INVALID');
});

test('rejects malformed token versions and part counts', () => {
  expectCode(() => decodeSessionToken({ token: 'v2.a.b.c', key: KEY, now: NOW }), 'SESSION_TOKEN_FORMAT_INVALID');
  expectCode(() => decodeSessionToken({ token: 'v1.a.b', key: KEY, now: NOW }), 'SESSION_TOKEN_FORMAT_INVALID');
});

test('rejects corrupt authentication tags and ciphertext', () => {
  const token = encrypt(validPayload());
  const parts = token.split('.');
  parts[3] = Buffer.alloc(16, 0xff).toString('base64url');
  expectCode(() => decodeSessionToken({ token: parts.join('.'), key: KEY, now: NOW }), 'SESSION_TOKEN_AUTHENTICATION_FAILED');
});

test('rejects authenticated plaintext that is not JSON', () => {
  const token = encrypt(null, { plaintext: 'not-json' });
  expectCode(() => decodeSessionToken({ token, key: KEY, now: NOW }), 'SESSION_TOKEN_JSON_INVALID');
});

test('rejects missing, invalid, and expired expiry values', () => {
  for (const [expiresAt, expected] of [
    [undefined, 'SESSION_EXPIRES_AT_INVALID'],
    ['not-a-date', 'SESSION_EXPIRES_AT_INVALID'],
    ['2026-08-09T18:00:00.000Z', 'SESSION_EXPIRED'],
  ]) {
    const payload = validPayload({ expiresAt });
    expectCode(() => decodeSessionToken({ token: encrypt(payload), key: KEY, now: NOW }), expected);
  }
});

test('rejects missing, invalid, or future issue times', () => {
  for (const [issuedAt, expected] of [
    [undefined, 'SESSION_ISSUED_AT_INVALID'],
    ['not-a-date', 'SESSION_ISSUED_AT_INVALID'],
    ['2026-08-09T18:00:00.001Z', 'SESSION_NOT_YET_VALID'],
  ]) {
    const payload = validPayload({ issuedAt });
    expectCode(() => decodeSessionToken({ token: encrypt(payload), key: KEY, now: NOW }), expected);
  }
});

test('accepts a valid bearer credential', () => {
  const token = encrypt(validPayload());
  assert.deepEqual(selectSessionCredential({
    authorizationHeader: `Bearer ${token}`,
    cookieHeader: '',
    cookieName: COOKIE_NAME,
  }), { source: 'bearer', token });
  assert.equal(readSessionFromHeaders({
    headers: { authorization: `Bearer ${token}` },
    key: KEY,
    cookieName: COOKIE_NAME,
    now: NOW,
  }).user.subject, 'wp:42');
});

test('accepts a valid named cookie credential', () => {
  const token = encrypt(validPayload());
  const result = readSessionFromHeaders({
    headers: { cookie: `other=value; ${COOKIE_NAME}=${encodeURIComponent(token)}` },
    key: KEY,
    cookieName: COOKIE_NAME,
    now: NOW,
  });
  assert.equal(result.apiScope, 'lor-studio');
});

test('rejects an invalid recognized bearer instead of downgrading to a valid cookie', () => {
  const validCookie = encrypt(validPayload());
  expectCode(() => readSessionFromHeaders({
    headers: {
      authorization: 'Bearer invalid-token',
      cookie: `${COOKIE_NAME}=${validCookie}`,
    },
    key: KEY,
    cookieName: COOKIE_NAME,
    now: NOW,
  }), 'SESSION_TOKEN_FORMAT_INVALID');
});

test('rejects malformed bearer and cookie formats', () => {
  expectCode(() => selectSessionCredential({
    authorizationHeader: 'Bearer',
    cookieName: COOKIE_NAME,
  }), 'SESSION_BEARER_INVALID');
  expectCode(() => readSessionFromHeaders({
    headers: { cookie: `${COOKIE_NAME}=%` },
    key: KEY,
    cookieName: COOKIE_NAME,
    now: NOW,
  }), 'SESSION_COOKIE_INVALID');
});

test('does not log tokens, keys, payloads, identities, or validation failures', () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const calls = [];
  console.warn = (...args) => calls.push(args);
  console.error = (...args) => calls.push(args);
  try {
    decodeSessionToken({ token: encrypt(validPayload()), key: KEY, now: NOW });
    assert.throws(() => decodeSessionToken({ token: 'invalid', key: KEY, now: NOW }));
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
  assert.deepEqual(calls, []);
});

test('preserves fields consumed by existing Matrix, CAM, Arena, USCE, and LOR session boundaries', () => {
  const payload = validPayload({
    wpAuthorization: 'synthetic-server-proof',
    schedulerEntitlement: { active: true },
    supabase: { accessToken: 'synthetic-test-token' },
  });
  const result = decodeSessionToken({ token: encrypt(payload), key: KEY, now: NOW });
  assert.deepEqual(result, payload);
});

test('server delegates only session decoding and keeps generic encrypted payload consumers separate', async () => {
  const source = await readFile(new URL('../../server.mjs', import.meta.url), 'utf8');
  assert.match(source, /function readEncryptedPayloadToken\(token\)/u);
  assert.match(source, /function readEncryptedSession\(token\)[\s\S]*readSessionFromHeaders/u);
  assert.match(source, /function readStripeConnectState\(token, session\)[\s\S]*readEncryptedPayloadToken\(token\)/u);
  assert.doesNotMatch(source, /function readEncryptedSession\(token\)[\s\S]{0,500}readEncryptedPayloadToken\(token\)/u);
});
