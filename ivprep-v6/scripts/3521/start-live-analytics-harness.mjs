import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const host = '127.0.0.1';
const liveAnalyticsPath = '/iv-prep-on-call/live-analytics/';
const localTimingPath = '/iv-prep-on-call/live-analytics/local-transcript-timing';
const maximumAudioBytes = 4_000_000;
const now = () => Date.now();
const bootMs = now();
const sessionTtlSeconds = 25 * 60;
const maximumSessionTtlSeconds = 30 * 60;
let sealedOrigin = null;

function sendJson(response, status, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.byteLength,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function readBoundedBody(request, maximumBytes = maximumAudioBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.byteLength;
    if (bytes > maximumBytes) throw Object.assign(new Error('Audio window too large.'), { code: 'AUDIO_WINDOW_TOO_LARGE' });
    chunks.push(chunk);
  }
  if (bytes === 0) throw Object.assign(new Error('Audio window is empty.'), { code: 'AUDIO_WINDOW_EMPTY' });
  return Buffer.concat(chunks, bytes);
}

function unavailableLocalTiming(reason) {
  return Object.freeze({
    available: false,
    reason,
    source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
    providerSessions: 0,
    persistence: 'MEMORY_ONLY',
    stop() {},
  });
}

function projectLocalWordTiming(payload) {
  const wordCount = Number.isInteger(payload?.wordCount) ? payload.wordCount : null;
  const speechDurationMs = Number(payload?.speechDurationMs);
  const words = Array.isArray(payload?.words) ? payload.words.map((word) => Object.freeze({
    startMs: Number(word?.startMs),
    endMs: Number(word?.endMs),
    probability: word?.probability === null ? null : Number(word?.probability),
  })) : null;
  const validWords = Array.isArray(words)
    && words.every((word, index) => Number.isFinite(word.startMs)
      && word.startMs >= 0
      && Number.isFinite(word.endMs)
      && word.endMs > word.startMs
      && (word.probability === null || (Number.isFinite(word.probability) && word.probability >= 0 && word.probability <= 1))
      && (index === 0 || word.startMs >= words[index - 1].startMs));
  if (payload?.available !== true
    || payload?.source !== 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS'
    || payload?.providerSessions !== 0
    || payload?.rawTextReturned !== false
    || payload?.rawAudioPersisted !== false
    || !Number.isInteger(wordCount)
    || wordCount < 0
    || !validWords
    || words.length !== wordCount
    || !Number.isFinite(speechDurationMs)
    || speechDurationMs < 0) {
    throw Object.assign(new Error('Invalid local per-word transcript timing.'), { reason: 'INVALID_LOCAL_WORD_TIMING' });
  }
  return Object.freeze({
    available: true,
    providerSessions: 0,
    rawAudioPersisted: false,
    rawTextReturned: false,
    source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
    speechDurationMs,
    words: Object.freeze(words),
    wordCount,
  });
}

async function startLocalWhisperSidecar() {
  const python = String(process.env.IVPREP_LOCAL_WHISPER_PYTHON || '').trim();
  const modelDir = String(process.env.IVPREP_LOCAL_WHISPER_MODEL_DIR || '').trim();
  if (!python || !modelDir) return unavailableLocalTiming('LOCAL_WHISPER_RUNTIME_NOT_CONFIGURED');

  const script = fileURLToPath(new URL('./local-whisper-timing.py', import.meta.url));
  const child = spawn(python, [script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      PATH: process.env.PATH || '/usr/bin:/bin',
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || process.env.LANG || 'en_US.UTF-8',
      HF_HUB_OFFLINE: '1',
      TRANSFORMERS_OFFLINE: '1',
      NO_PROXY: '*',
      IVPREP_LOCAL_WHISPER_MODEL_DIR: modelDir,
      IVPREP_LOCAL_WHISPER_PORT: '0',
      IVPREP_LOCAL_WHISPER_MAX_BYTES: String(maximumAudioBytes),
    },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  return await new Promise((resolve) => {
    let output = '';
    let errorOutput = '';
    let port = null;
    let ready = false;
    let settled = false;
    let alive = true;
    let runtimeReason = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      finish(unavailableLocalTiming('LOCAL_WHISPER_MODEL_START_TIMEOUT'));
    }, 120_000);
    child.stderr.on('data', (chunk) => { errorOutput = `${errorOutput}${chunk}`.slice(-2_000); });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const lines = output.split(/\r?\n/u);
      output = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('LOCAL_WHISPER_SIDECAR_PORT=')) port = Number(line.split('=').at(-1));
        if (line === 'LOCAL_WHISPER_MODEL_READY=1') ready = true;
      }
      if (ready && Number.isInteger(port) && port > 0) {
        finish(Object.freeze({
          get available() { return alive && child.exitCode === null; },
          get reason() { return alive && child.exitCode === null ? null : runtimeReason || 'LOCAL_WHISPER_PROCESS_EXITED'; },
          source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
          providerSessions: 0,
          persistence: 'MEMORY_ONLY',
          async transcribe(audio, contentType) {
            if (!alive || child.exitCode !== null) {
              throw Object.assign(new Error('Local timing process is unavailable.'), { reason: runtimeReason || 'LOCAL_WHISPER_PROCESS_EXITED' });
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30_000);
            try {
              const response = await fetch(`http://${host}:${port}/transcribe`, {
                method: 'POST',
                body: audio,
                signal: controller.signal,
                headers: { 'Content-Type': contentType || 'application/octet-stream', Accept: 'application/json' },
              });
              const payload = await response.json();
              if (!response.ok) throw Object.assign(new Error(payload?.reason || 'Local transcription failed.'), { reason: payload?.reason });
              return payload;
            } finally {
              clearTimeout(timer);
            }
          },
          stop() {
            alive = false;
            runtimeReason = 'LOCAL_WHISPER_PROCESS_STOPPED';
            if (child.exitCode === null) child.kill('SIGTERM');
          },
        }));
      }
    });
    child.once('error', () => {
      alive = false;
      runtimeReason = 'LOCAL_WHISPER_PROCESS_START_FAILED';
      finish(unavailableLocalTiming(runtimeReason));
    });
    child.once('exit', () => {
      alive = false;
      runtimeReason = errorOutput ? 'LOCAL_WHISPER_MODEL_LOAD_FAILED' : 'LOCAL_WHISPER_PROCESS_EXITED';
      if (!settled) finish(unavailableLocalTiming(errorOutput ? 'LOCAL_WHISPER_MODEL_LOAD_FAILED' : 'LOCAL_WHISPER_PROCESS_EXITED'));
    });
  });
}

const registry = new InMemoryAdmissionRegistry({ now });
registry.grantSyntheticEntitlement({
  subject: 'wp:3521',
  revision: 'local-live-analytics-harness-1',
  expiresAtMs: bootMs + sessionTtlSeconds * 1_000,
  founder: true,
  voice: true,
  video: false,
  grantedVideoSeconds: 0,
});

const hqSession = Object.freeze({
  version: 1,
  issuedAt: new Date(bootMs).toISOString(),
  expiresAt: new Date(bootMs + sessionTtlSeconds * 1_000).toISOString(),
  csrfToken: 'local_harness_csrf_3521',
  authSource: 'wordpress-cookie',
  user: Object.freeze({ id: 3521, roles: Object.freeze(['administrator']) }),
});

// This harness intentionally has no provider controller and makes paid provider
// creation impossible. It exists only for the localhost analytics surface.
const handler = createIvPrepHqHandler({
  registry,
  now,
  flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: false }),
  runtimeState: async () => Object.freeze({
    mode: 'hosted',
    workerRegistrationState: 'UNAVAILABLE',
    providerSessionsCreatedAtReadiness: 0,
    paidProviderCreationEnabled: false,
  }),
});

const localWhisper = await startLocalWhisperSidecar();

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
  if (url.pathname === '/') {
    response.writeHead(302, { Location: liveAnalyticsPath, 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  if (url.pathname === `${localTimingPath}/status`) {
    if (request.method !== 'GET') {
      sendJson(response, 405, { available: false, reason: 'METHOD_NOT_ALLOWED', providerSessions: 0 });
      return;
    }
    sendJson(response, 200, {
      available: localWhisper.available,
      reason: localWhisper.available ? null : localWhisper.reason,
      source: localWhisper.source,
      providerSessions: 0,
      persistence: 'MEMORY_ONLY',
    });
    return;
  }
  if (url.pathname === localTimingPath) {
    if (request.method !== 'POST') {
      sendJson(response, 405, { available: false, reason: 'METHOD_NOT_ALLOWED', providerSessions: 0 });
      return;
    }
    if (!sealedOrigin || request.headers.origin !== sealedOrigin) {
      sendJson(response, 403, { available: false, reason: 'SAME_ORIGIN_LOOPBACK_REQUIRED', providerSessions: 0 });
      return;
    }
    if (!localWhisper.available) {
      sendJson(response, 503, { available: false, reason: localWhisper.reason, providerSessions: 0 });
      return;
    }
    const contentType = String(request.headers['content-type'] || '').toLowerCase();
    if (!(contentType.startsWith('audio/') || contentType === 'application/octet-stream')) {
      sendJson(response, 415, { available: false, reason: 'UNSUPPORTED_AUDIO_TYPE', providerSessions: 0 });
      return;
    }
    try {
      const audio = await readBoundedBody(request);
      const timing = projectLocalWordTiming(await localWhisper.transcribe(audio, contentType));
      sendJson(response, 200, timing);
    } catch (error) {
      const status = error?.code === 'AUDIO_WINDOW_TOO_LARGE' ? 413 : error?.code === 'AUDIO_WINDOW_EMPTY' ? 400 : 422;
      sendJson(response, status, { available: false, reason: error?.reason || error?.code || 'LOCAL_TRANSCRIPTION_FAILED', providerSessions: 0 });
    }
    return;
  }
  const handled = await handler({
    request,
    response,
    url,
    hqSession,
    cookieFingerprint: '5'.repeat(64),
    hqSessionMaxTtlSeconds: maximumSessionTtlSeconds,
    expectedOrigin: sealedOrigin,
  });
  if (!handled) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(0, host, () => {
  const address = server.address();
  sealedOrigin = `http://${host}:${address.port}`;
  process.stdout.write(`LIVE_ANALYTICS_HARNESS_URL=${sealedOrigin}${liveAnalyticsPath}\n`);
  process.stdout.write('PROVIDER_SESSIONS=0\n');
  process.stdout.write(`LOCAL_TRANSCRIPT_TIMING=${localWhisper.available ? 'AVAILABLE' : `UNAVAILABLE:${localWhisper.reason}`}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    localWhisper.stop();
    server.close(() => process.exit(0));
  });
}
