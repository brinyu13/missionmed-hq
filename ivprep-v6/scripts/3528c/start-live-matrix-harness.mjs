import http from 'node:http';
import { randomUUID } from 'node:crypto';

import { createIvocHandler } from '../../../missionmed-hq/ivoc/routes.mjs';
import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';
import { createLocalWordTimingRuntime } from '../../server/local-word-timing-runtime.mjs';

const host = '127.0.0.1';
const now = () => Date.now();
const bootMs = now();
const sessionTtlSeconds = 25 * 60;
const maximumSessionTtlSeconds = 30 * 60;
let sealedOrigin = null;

const registry = new InMemoryAdmissionRegistry({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3528', revision: 'local-3528c-live-matrix-1',
  expiresAtMs: bootMs + sessionTtlSeconds * 1_000,
  founder: true, voice: true, video: false, grantedVideoSeconds: 0,
});

const hqSession = Object.freeze({
  version: 1,
  issuedAt: new Date(bootMs).toISOString(),
  expiresAt: new Date(bootMs + sessionTtlSeconds * 1_000).toISOString(),
  csrfToken: 'local_harness_csrf_3528c',
  authSource: 'wordpress-cookie',
  user: Object.freeze({ id: 3528, roles: Object.freeze(['administrator']), displayName: 'Founder QA' }),
});

function createMemoryRepository() {
  const tables = new Map([
    ['ivoc_sessions', []], ['ivoc_recordings', []], ['ivoc_results', []],
    ['ivoc_reviews', []], ['ivoc_preferences', []], ['ivoc_access_log', []],
  ]);

  function compare(row, key, raw) {
    if (raw.startsWith('eq.')) return String(row[key] ?? '') === decodeURIComponent(raw.slice(3));
    if (raw.startsWith('neq.')) return String(row[key] ?? '') !== decodeURIComponent(raw.slice(4));
    if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const values = raw.slice(4, -1).split(',').map(decodeURIComponent);
      return values.includes(String(row[key] ?? ''));
    }
    return true;
  }

  function query(tablePath) {
    const parsed = new URL(`http://local/${tablePath}`);
    const table = parsed.pathname.slice(1);
    let rows = [...(tables.get(table) || [])];
    for (const [key, value] of parsed.searchParams) {
      if (!['select', 'order', 'limit'].includes(key)) rows = rows.filter((row) => compare(row, key, value));
    }
    const order = parsed.searchParams.get('order');
    if (order) {
      const [key, direction] = order.split('.');
      rows.sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')) * (direction === 'desc' ? -1 : 1));
    }
    return rows.slice(0, Number(parsed.searchParams.get('limit')) || rows.length);
  }

  function stamp(table, body) {
    const at = new Date().toISOString();
    return {
      id: body.id || (table === 'ivoc_preferences' ? body.owner_subject : randomUUID()),
      created_at: at, updated_at: at,
      ...(table === 'ivoc_sessions' ? { started_at: at, state: 'active' } : {}),
      ...body,
    };
  }

  return Object.freeze({
    request: async (path) => structuredClone(query(path)),
    single: async (path) => structuredClone(query(path)[0] || null),
    insert: async (table, body) => {
      const row = stamp(table, body);
      tables.get(table).push(row);
      return structuredClone(row);
    },
    update: async (path, body) => {
      const parsed = new URL(`http://local/${path}`);
      const table = parsed.pathname.slice(1);
      const matches = query(path);
      const row = matches[0];
      if (!row) return null;
      Object.assign(row, body, { updated_at: new Date().toISOString() });
      const stored = tables.get(table).find((candidate) => candidate.id === row.id || (table === 'ivoc_preferences' && candidate.owner_subject === row.owner_subject));
      if (stored && stored !== row) Object.assign(stored, row);
      return structuredClone(row);
    },
  });
}

const mediaBytes = new Map();
const mediaTypes = new Map();
function createLocalStorage() {
  return Object.freeze({
    createUpload: ({ ownerSubject, recordingId, extension = 'webm' }) => {
      const expiresAtMs = now() + 60 * 60 * 1000;
      const objectKey = `local/${ownerSubject}/${recordingId}.${extension}`;
      return {
        objectKey,
        uploadUrl: `${sealedOrigin}/__ivoc-media/${recordingId}`,
        uploadToken: `${recordingId}.${expiresAtMs}.local`,
        expiresAt: new Date(expiresAtMs).toISOString(), tokenExpiresAtMs: expiresAtMs,
      };
    },
    validateUploadToken: ({ recordingId, expiresAtMs, uploadToken }) => Number(expiresAtMs) > now() && uploadToken === `${recordingId}.${expiresAtMs}.local`,
    signedUrl: (objectKey, ttlMs) => {
      const recordingId = objectKey.split('/').at(-1).split('.')[0];
      const expiresAtMs = now() + ttlMs;
      return { url: `${sealedOrigin}/__ivoc-media/${recordingId}`, expiresAt: new Date(expiresAtMs).toISOString(), expiresAtMs };
    },
    verifyObject: async (objectKey) => mediaBytes.has(objectKey.split('/').at(-1).split('.')[0]),
  });
}

const wordTimingRuntime = createLocalWordTimingRuntime();
const timingCapability = await wordTimingRuntime.probe();
const legacyHandler = createIvPrepHqHandler({
  registry, now,
  flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: false }),
  runtimeState: async () => Object.freeze({
    mode: 'hosted', workerRegistrationState: 'UNAVAILABLE', providerSessionsCreatedAtReadiness: 0,
    paidProviderCreationEnabled: false,
  }),
  wordTimingRuntime,
});
const ivocHandler = createIvocHandler({
  registry, repository: createMemoryRepository(), storage: createLocalStorage(), now,
  env: { IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true', MMHQ_CIE_BASE: 'http://127.0.0.1' },
});

async function handleMedia(request, response, url) {
  const match = url.pathname.match(/^\/__ivoc-media\/([0-9a-f-]{36})$/u);
  if (!match) return false;
  const id = match[1];
  if (request.method === 'PUT') {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 250 * 1024 * 1024) { response.writeHead(413); response.end(); return true; }
      chunks.push(chunk);
    }
    mediaBytes.set(id, Buffer.concat(chunks));
    mediaTypes.set(id, request.headers['content-type'] || 'video/webm');
    response.writeHead(200, { 'Cache-Control': 'no-store' }); response.end(); return true;
  }
  if (!['GET', 'HEAD'].includes(request.method) || !mediaBytes.has(id)) { response.writeHead(404); response.end(); return true; }
  const body = mediaBytes.get(id);
  response.writeHead(200, { 'Content-Type': mediaTypes.get(id), 'Content-Length': String(body.length), 'Cache-Control': 'no-store' });
  if (request.method === 'HEAD') response.end(); else response.end(body);
  return true;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (url.pathname === '/') { response.writeHead(302, { Location: '/iv-prep-analytics/', 'Cache-Control': 'no-store' }); response.end(); return; }
  if (await handleMedia(request, response, url)) return;
  const common = {
    request, response, url, hqSession, cookieFingerprint: '5'.repeat(64),
    hqSessionMaxTtlSeconds: maximumSessionTtlSeconds, expectedOrigin: sealedOrigin,
  };
  if (await ivocHandler(common)) return;
  if (await legacyHandler(common)) return;
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found');
});

server.listen(0, host, () => {
  const address = server.address();
  sealedOrigin = `http://${host}:${address.port}`;
  process.stdout.write(`IVOC_3528C_URL=${sealedOrigin}/iv-prep-analytics/\n`);
  process.stdout.write('PROVIDER_SESSIONS=0\n');
  process.stdout.write(`LOCAL_TRANSCRIPT_TIMING=${timingCapability.available ? 'AVAILABLE:SHERPA_ONNX_MEMORY_ONLY' : `UNAVAILABLE:${timingCapability.reason}`}\n`);
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await legacyHandler.shutdown('harness_shutdown');
    server.close(() => process.exit(0));
  });
}
