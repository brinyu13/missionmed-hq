import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const AES_256_GCM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const VERSION = 'v1';

function toBase64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${'='.repeat(paddingLength)}`, 'base64');
}

function parsePortalKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('PORTAL_ENCRYPTION_KEY is required.');
  }

  const tryHex = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
  if (tryHex && tryHex.length === 32) return tryHex;

  for (const encoding of ['base64url', 'base64'] as const) {
    try {
      const decoded =
        encoding === 'base64url' ? fromBase64Url(trimmed) : Buffer.from(trimmed, 'base64');
      if (decoded.length === 32) return decoded;
    } catch {
      // continue
    }
  }

  if (Buffer.byteLength(trimmed, 'utf8') === 32) {
    return Buffer.from(trimmed, 'utf8');
  }

  throw new Error('PORTAL_ENCRYPTION_KEY must resolve to exactly 32 bytes.');
}

function getPortalKey(explicit?: string): Buffer {
  const source = explicit ?? process.env.PORTAL_ENCRYPTION_KEY ?? '';
  return parsePortalKey(source);
}

export function generatePortalToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 64) {
    throw new Error('byteLength must be an integer between 16 and 64.');
  }
  return toBase64Url(randomBytes(byteLength));
}

export function hashPortalToken(rawToken: string): string {
  if (!rawToken || rawToken.trim().length === 0) {
    throw new Error('rawToken is required.');
  }
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function encryptPortalToken(rawToken: string, explicitKey?: string): string {
  if (!rawToken || rawToken.trim().length === 0) {
    throw new Error('rawToken is required.');
  }

  const key = getPortalKey(explicitKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_256_GCM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(rawToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join('.');
}

export function decryptPortalToken(payload: string, explicitKey?: string): string {
  if (!payload || payload.trim().length === 0) {
    throw new Error('Encrypted token payload is required.');
  }

  const [version, ivPart, tagPart, cipherPart] = payload.split('.');
  if (version !== VERSION || !ivPart || !tagPart || !cipherPart) {
    throw new Error('Invalid encrypted token format.');
  }

  const key = getPortalKey(explicitKey);
  const iv = fromBase64Url(ivPart);
  const authTag = fromBase64Url(tagPart);
  const ciphertext = fromBase64Url(cipherPart);

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES || ciphertext.length < 1) {
    throw new Error('Invalid encrypted token payload components.');
  }

  const decipher = createDecipheriv(AES_256_GCM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const token = decrypted.toString('utf8');
  if (!token) {
    throw new Error('Decrypted token is empty.');
  }
  return token;
}

export function validatePortalEncryptionKey(explicitKey?: string): boolean {
  getPortalKey(explicitKey);
  return true;
}
