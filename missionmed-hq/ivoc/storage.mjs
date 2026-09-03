import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const REGION = 'auto';
const SERVICE = 's3';
const UPLOAD_STATE_PREFIX = 'r2-multipart:';

function safeSegment(value, fallback = 'user') {
  const normalized = String(value || '').replace(/[^A-Za-z0-9._-]/gu, '_').slice(0, 100);
  return normalized || fallback;
}

function requireConfig(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`ivoc_${name}_missing`);
  return normalized;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding = undefined) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function tokenFor(purpose, recordingId, objectKey, expiresAtMs, secret, extra = '') {
  return createHmac('sha256', secret)
    .update(`${purpose}\n${recordingId}\n${objectKey}\n${expiresAtMs}\n${extra}`)
    .digest('base64url');
}

function equalToken(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function awsEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodedObjectPath(endpoint, bucket, key) {
  const prefix = endpoint.pathname.replace(/\/+$/u, '');
  return `${prefix}/${awsEncode(bucket)}/${String(key).split('/').map(awsEncode).join('/')}`.replace(/^\/{2,}/u, '/');
}

function canonicalQuery(entries = []) {
  return entries
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function amzTimestamp(timestampMs) {
  return new Date(timestampMs).toISOString().replace(/[:-]|\.\d{3}/gu, '');
}

function decodeXml(value) {
  return String(value || '')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

function xmlValue(xml, name) {
  const match = String(xml || '').match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'u'));
  return match ? decodeXml(match[1]) : '';
}

function encodeUploadState(state) {
  return `${UPLOAD_STATE_PREFIX}${Buffer.from(JSON.stringify(state)).toString('base64url')}`;
}

function decodeUploadState(value) {
  const encoded = String(value || '');
  if (!encoded.startsWith(UPLOAD_STATE_PREFIX)) throw Object.assign(new Error('recording_upload_state_invalid'), { status: 409 });
  try {
    const state = JSON.parse(Buffer.from(encoded.slice(UPLOAD_STATE_PREFIX.length), 'base64url').toString('utf8'));
    if (state?.v !== 1 || typeof state.uploadId !== 'string' || !state.uploadId || typeof state.parts !== 'object' || Array.isArray(state.parts)) throw new Error('invalid');
    return state;
  } catch {
    throw Object.assign(new Error('recording_upload_state_invalid'), { status: 409 });
  }
}

function normalizeEtag(value) {
  const etag = String(value || '').trim();
  return etag ? (etag.startsWith('"') ? etag : `"${etag.replaceAll('"', '')}"`) : '';
}

export function createIvocStorage({
  endpoint: endpointInput,
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket = 'missionmed-cam-production',
  prefix = 'ivoc/recordings',
  sessionSecret,
  now = () => Date.now(),
  fetchImpl = fetch,
} = {}) {
  const endpoint = new URL(String(endpointInput || (accountId ? `https://${String(accountId).trim()}.r2.cloudflarestorage.com` : '')));
  if (endpoint.protocol !== 'https:') throw new Error('ivoc_r2_endpoint_invalid');
  endpoint.search = '';
  endpoint.hash = '';
  const accessKey = requireConfig(accessKeyId, 'r2_access_key_id');
  const accessSecret = requireConfig(secretAccessKey, 'r2_secret_access_key');
  const bucketName = requireConfig(bucket, 'r2_bucket');
  const storagePrefix = String(prefix || 'ivoc/recordings').replace(/^\/+|\/+$/gu, '') || 'ivoc/recordings';
  const secret = requireConfig(sessionSecret, 'storage_signing_secret');

  function objectKey({ ownerSubject, recordingId, extension = 'webm' }) {
    return `${storagePrefix}/${safeSegment(ownerSubject)}/ivoc_${safeSegment(recordingId || randomUUID())}.${safeSegment(extension, 'webm')}`;
  }

  async function r2Request(method, key, { query = [], headers = {}, body = undefined } = {}) {
    const timestamp = amzTimestamp(now());
    const date = timestamp.slice(0, 8);
    const pathname = encodedObjectPath(endpoint, bucketName, key);
    const queryString = canonicalQuery(query);
    const payload = body === undefined ? Buffer.alloc(0) : (Buffer.isBuffer(body) ? body : Buffer.from(body));
    const payloadHash = sha256(payload);
    const headerEntries = Object.entries({
      host: endpoint.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': timestamp,
      ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim().replace(/\s+/gu, ' ')])),
    }).sort(([a], [b]) => a.localeCompare(b));
    const canonicalHeaders = `${headerEntries.map(([name, value]) => `${name}:${value}`).join('\n')}\n`;
    const signedHeaders = headerEntries.map(([name]) => name).join(';');
    const canonicalRequest = [method, pathname, queryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', timestamp, scope, sha256(canonicalRequest)].join('\n');
    const dateKey = hmac(`AWS4${accessSecret}`, date);
    const regionKey = hmac(dateKey, REGION);
    const serviceKey = hmac(regionKey, SERVICE);
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign, 'hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const requestUrl = new URL(endpoint);
    requestUrl.pathname = pathname;
    requestUrl.search = queryString;
    const response = await fetchImpl(requestUrl, {
      method,
      redirect: 'error',
      headers: Object.fromEntries([...headerEntries.filter(([name]) => name !== 'host'), ['authorization', authorization]]),
      body: ['GET', 'HEAD'].includes(method) ? undefined : payload,
    }).catch(() => null);
    if (!response?.ok) {
      const error = new Error('ivoc_storage_request_failed');
      error.status = 502;
      error.detail = `r2_${Number(response?.status || 0)}`;
      throw error;
    }
    return response;
  }

  async function createUpload({ ownerSubject, recordingId, extension, mime = 'video/webm' }) {
    const key = objectKey({ ownerSubject, recordingId, extension });
    const response = await r2Request('POST', key, { query: [['uploads', '']], headers: { 'content-type': mime } });
    const uploadId = xmlValue(await response.text(), 'UploadId');
    if (!uploadId) throw Object.assign(new Error('ivoc_storage_multipart_invalid'), { status: 502 });
    const expiresAtMs = now() + (60 * 60 * 1000);
    return {
      objectKey: key,
      uploadState: encodeUploadState({ v: 1, uploadId, totalParts: null, parts: {} }),
      expiresAt: new Date(expiresAtMs).toISOString(),
      uploadToken: tokenFor('upload', recordingId, key, expiresAtMs, secret),
      tokenExpiresAtMs: expiresAtMs,
    };
  }

  function validateUploadToken({ recordingId, objectKey: key, expiresAtMs, uploadToken }) {
    if (!Number.isFinite(Number(expiresAtMs)) || Number(expiresAtMs) <= now()) return false;
    return equalToken(uploadToken, tokenFor('upload', recordingId, key, Number(expiresAtMs), secret));
  }

  async function uploadPart({ objectKey: key, uploadState, part, parts, body }) {
    const state = decodeUploadState(uploadState);
    if (!Number.isSafeInteger(parts) || parts < 1 || parts > 1_000 || (state.totalParts != null && state.totalParts !== parts)) {
      throw Object.assign(new Error('recording_chunk_contract_invalid'), { status: 400 });
    }
    const response = await r2Request('PUT', key, {
      query: [['partNumber', String(part)], ['uploadId', state.uploadId]],
      headers: { 'content-type': 'application/octet-stream' },
      body,
    });
    const etag = normalizeEtag(response.headers.get('etag'));
    if (!etag) throw Object.assign(new Error('ivoc_storage_part_etag_missing'), { status: 502 });
    const next = { ...state, totalParts: parts, parts: { ...state.parts, [String(part)]: etag } };
    return { etag, uploadState: encodeUploadState(next) };
  }

  async function verifyObject(key) {
    try { return (await r2Request('HEAD', key)).ok === true; } catch { return false; }
  }

  async function completeUpload({ objectKey: key, uploadState }) {
    const state = decodeUploadState(uploadState);
    if (!Number.isSafeInteger(state.totalParts) || state.totalParts < 1) throw Object.assign(new Error('recording_upload_incomplete'), { status: 409 });
    const completedParts = [];
    for (let part = 1; part <= state.totalParts; part += 1) {
      const etag = normalizeEtag(state.parts[String(part)]);
      if (!etag) throw Object.assign(new Error('recording_upload_incomplete'), { status: 409 });
      completedParts.push(`<Part><PartNumber>${part}</PartNumber><ETag>${etag}</ETag></Part>`);
    }
    const body = `<CompleteMultipartUpload>${completedParts.join('')}</CompleteMultipartUpload>`;
    const response = await r2Request('POST', key, {
      query: [['uploadId', state.uploadId]], headers: { 'content-type': 'application/xml' }, body,
    });
    const xml = await response.text();
    return { etag: normalizeEtag(xmlValue(xml, 'ETag') || response.headers.get('etag')) };
  }

  function createPlayback({ recordingId, objectKey: key, disposition = 'inline', ttlMs = 10 * 60 * 1000 }) {
    const normalizedDisposition = disposition === 'attachment' ? 'attachment' : 'inline';
    const expiresAtMs = now() + ttlMs;
    return {
      token: tokenFor('playback', recordingId, key, expiresAtMs, secret, normalizedDisposition),
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      disposition: normalizedDisposition,
    };
  }

  function validatePlaybackToken({ recordingId, objectKey: key, expiresAtMs, playbackToken, disposition = 'inline' }) {
    const normalizedDisposition = disposition === 'attachment' ? 'attachment' : 'inline';
    if (!Number.isFinite(Number(expiresAtMs)) || Number(expiresAtMs) <= now()) return false;
    return equalToken(playbackToken, tokenFor('playback', recordingId, key, Number(expiresAtMs), secret, normalizedDisposition));
  }

  async function fetchObject(key, { method = 'GET', range = '' } = {}) {
    const normalizedMethod = method === 'HEAD' ? 'HEAD' : 'GET';
    return r2Request(normalizedMethod, key, { headers: range ? { range } : {} });
  }

  return Object.freeze({
    createUpload,
    validateUploadToken,
    uploadPart,
    completeUpload,
    verifyObject,
    createPlayback,
    validatePlaybackToken,
    fetchObject,
  });
}
