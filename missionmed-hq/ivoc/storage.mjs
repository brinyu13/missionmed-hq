import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

function safeSegment(value, fallback = 'user') {
  const normalized = String(value || '').replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 100);
  return normalized || fallback;
}

function signatureFor(objectKey, expiresAtMs, secret) {
  return createHash('sha256').update(`${objectKey}:${expiresAtMs}:${secret}`).digest('hex');
}

function tokenFor(recordingId, objectKey, expiresAtMs, secret) {
  return createHmac('sha256', secret).update(`${recordingId}\n${objectKey}\n${expiresAtMs}`).digest('base64url');
}

function equalToken(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function createIvocStorage({ mediaBase, sessionSecret, now = () => Date.now(), fetchImpl = fetch } = {}) {
  const base = String(mediaBase || 'https://cdn.missionmedinstitute.com').replace(/\/+$/u, '');
  const secret = String(sessionSecret || '').trim();
  if (!secret) throw new Error('ivoc_storage_signing_secret_missing');

  function objectKey({ ownerSubject, recordingId, extension = 'webm' }) {
    return `dboc-iv/${safeSegment(ownerSubject)}/ivoc/${safeSegment(recordingId || randomUUID())}.${safeSegment(extension, 'webm')}`;
  }

  function signedUrl(key, ttlMs = 15 * 60 * 1000) {
    const expiresAtMs = now() + ttlMs;
    const signature = signatureFor(key, expiresAtMs, secret);
    return {
      url: `${base}/${key}?x-dboc-signature=${signature}&x-dboc-expires=${expiresAtMs}`,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
    };
  }

  function createUpload({ ownerSubject, recordingId, extension }) {
    const key = objectKey({ ownerSubject, recordingId, extension });
    const signed = signedUrl(key, 60 * 60 * 1000);
    return {
      objectKey: key,
      uploadUrl: signed.url,
      expiresAt: signed.expiresAt,
      uploadToken: tokenFor(recordingId, key, signed.expiresAtMs, secret),
      tokenExpiresAtMs: signed.expiresAtMs,
    };
  }

  function validateUploadToken({ recordingId, objectKey: key, expiresAtMs, uploadToken }) {
    if (!Number.isFinite(Number(expiresAtMs)) || Number(expiresAtMs) <= now()) return false;
    return equalToken(uploadToken, tokenFor(recordingId, key, Number(expiresAtMs), secret));
  }

  async function verifyObject(key) {
    const signed = signedUrl(key, 2 * 60 * 1000);
    const response = await fetchImpl(signed.url, { method: 'HEAD', redirect: 'error' }).catch(() => null);
    return response?.ok === true;
  }

  return Object.freeze({ createUpload, validateUploadToken, signedUrl, verifyObject });
}

