import { createDecipheriv } from 'node:crypto';

const SESSION_TOKEN_VERSION = 'v1';
const SESSION_PAYLOAD_VERSION = 1;
const AES_256_KEY_BYTES = 32;
const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

export class SessionTokenError extends Error {
  constructor(code) {
    super('Session token validation failed.');
    this.name = 'SessionTokenError';
    this.code = code;
  }
}

function reject(code) {
  throw new SessionTokenError(code);
}

function normalizeKey(key) {
  if (!(key instanceof Uint8Array) || key.byteLength !== AES_256_KEY_BYTES) {
    reject('SESSION_KEY_INVALID');
  }

  return Buffer.from(key);
}

function decodeTokenPart(value, expectedBytes, code) {
  const encoded = String(value || '');
  if (!encoded || !BASE64URL_PATTERN.test(encoded)) {
    reject(code);
  }

  const decoded = Buffer.from(encoded, 'base64url');
  if (decoded.length === 0 || (expectedBytes && decoded.length !== expectedBytes)) {
    reject(code);
  }

  if (decoded.toString('base64url') !== encoded) {
    reject(code);
  }

  return decoded;
}

function normalizeNow(now) {
  const supplied = typeof now === 'function' ? now() : now;
  const value = supplied instanceof Date ? supplied.getTime() : Number(supplied);
  if (!Number.isFinite(value)) {
    reject('SESSION_CLOCK_INVALID');
  }
  return value;
}

function parseTimestamp(value, code) {
  if (typeof value !== 'string' || value.trim() === '') {
    reject(code);
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    reject(code);
  }
  return timestamp;
}

function parseCookies(cookieHeader) {
  const cookies = new Map();
  for (const part of String(cookieHeader || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name || cookies.has(name)) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      reject('SESSION_COOKIE_INVALID');
    }
  }
  return cookies;
}

export function decodeSessionToken({ token, key, now = Date.now } = {}) {
  const sessionKey = normalizeKey(key);
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== SESSION_TOKEN_VERSION) {
    reject('SESSION_TOKEN_FORMAT_INVALID');
  }

  const iv = decodeTokenPart(parts[1], GCM_IV_BYTES, 'SESSION_TOKEN_IV_INVALID');
  const ciphertext = decodeTokenPart(parts[2], null, 'SESSION_TOKEN_CIPHERTEXT_INVALID');
  const tag = decodeTokenPart(parts[3], GCM_TAG_BYTES, 'SESSION_TOKEN_TAG_INVALID');

  let plaintext;
  try {
    const decipher = createDecipheriv('aes-256-gcm', sessionKey, iv);
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    reject('SESSION_TOKEN_AUTHENTICATION_FAILED');
  }

  let payload;
  try {
    payload = JSON.parse(plaintext);
  } catch {
    reject('SESSION_TOKEN_JSON_INVALID');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    reject('SESSION_PAYLOAD_INVALID');
  }
  if (payload.version !== SESSION_PAYLOAD_VERSION) {
    reject('SESSION_PAYLOAD_VERSION_INVALID');
  }

  const nowMs = normalizeNow(now);
  const issuedAtMs = parseTimestamp(payload.issuedAt, 'SESSION_ISSUED_AT_INVALID');
  const expiresAtMs = parseTimestamp(payload.expiresAt, 'SESSION_EXPIRES_AT_INVALID');
  if (issuedAtMs > nowMs) {
    reject('SESSION_NOT_YET_VALID');
  }
  if (expiresAtMs <= nowMs || expiresAtMs <= issuedAtMs) {
    reject('SESSION_EXPIRED');
  }

  return Object.freeze({ ...payload });
}

export function selectSessionCredential({ authorizationHeader, cookieHeader, cookieName } = {}) {
  const authorization = String(authorizationHeader || '').trim();
  if (/^Bearer\b/iu.test(authorization)) {
    const match = authorization.match(/^Bearer\s+([^\s]+)$/iu);
    if (!match) {
      reject('SESSION_BEARER_INVALID');
    }
    return Object.freeze({ source: 'bearer', token: match[1] });
  }

  const normalizedCookieName = String(cookieName || '').trim();
  if (!normalizedCookieName) {
    reject('SESSION_COOKIE_NAME_INVALID');
  }
  const token = parseCookies(cookieHeader).get(normalizedCookieName);
  if (!token) return null;
  return Object.freeze({ source: 'cookie', token });
}

export function readSessionFromHeaders({ headers = {}, key, cookieName, now = Date.now } = {}) {
  const credential = selectSessionCredential({
    authorizationHeader: headers.authorization ?? headers.Authorization,
    cookieHeader: headers.cookie ?? headers.Cookie,
    cookieName,
  });
  if (!credential) return null;

  return decodeSessionToken({ token: credential.token, key, now });
}
