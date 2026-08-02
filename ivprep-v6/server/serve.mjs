import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DEFAULT_INTERVIEWER_MODEL,
  DEFAULT_OBSERVER_MODEL,
  DEFAULT_REASONING_EFFORT,
  MODEL_ARCHITECTURES,
  publicModelStudioConfig,
} from '../config/models.mjs';
import {
  DEFAULT_SPEECH_MODEL,
  publicVoiceStudioConfig,
} from '../config/voices.mjs';
import { NullAvatarProvider } from '../providers/avatar-provider.mjs';
import { ProviderError, publicProviderError } from '../providers/errors.mjs';
import { discoverOpenAIModels } from '../providers/openai-model-discovery.mjs';
import { createOpenAIRealtimeTurn } from '../providers/openai-realtime.mjs';
import {
  createInterviewerExchange,
  observeInterviewerUtterance,
} from '../providers/openai-responses.mjs';
import { createOpenAISpeech } from '../providers/openai-speech.mjs';

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = normalize(join(MODULE_DIRECTORY, '..'));
const PUBLIC_ROOT = normalize(join(APP_ROOT, 'public'));
const MAX_JSON_BYTES = 512 * 1024;
const DEFAULT_DISCOVERY_TTL_MS = 5 * 60 * 1000;
const LOOPBACK_HOSTS = Object.freeze(new Set(['127.0.0.1', '::1', 'localhost']));

const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
});

function readEnvironmentFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || Object.hasOwn(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

export function loadLocalEnvironment() {
  readEnvironmentFile(join(APP_ROOT, '.env'));
  readEnvironmentFile(join(APP_ROOT, '.env.local'));
}

export function requireLocalAlphaHost(value = '127.0.0.1') {
  const host = String(value || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new TypeError('Founder Alpha must bind to a loopback host. Private deployment requires Y1-Y2-CAM-V6-3403 authorization and auth review.');
  }
  return host;
}

function securityHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(body));
}

function sendMethodNotAllowed(response, methods) {
  response.writeHead(405, securityHeaders({ Allow: methods.join(', ') }));
  response.end();
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_JSON_BYTES) {
        reject(new TypeError('Request body exceeds the alpha limit.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (bytes === 0) {
        reject(new TypeError('A JSON request body is required.'));
        return;
      }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new TypeError('Request body must be valid JSON.')); }
    });
    request.on('error', reject);
  });
}

function requireBodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TypeError('Request body must be an object.');
  return body;
}

function modelIsAvailable(discovery, id, architecture) {
  return discovery.models.some((model) => model.id === id && model.architecture === architecture);
}

function requireDiscoveredModel(discovery, id, architecture) {
  if (!modelIsAvailable(discovery, id, architecture)) {
    throw new ProviderError('Requested model did not pass authenticated capability discovery.', {
      code: 'openai_model_unavailable',
      status: 503,
      provider: 'openai',
      publicMessage: 'The selected OpenAI model is not available for this alpha.',
    });
  }
  return id;
}

function staticFileForPath(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return null; }
  if (decoded.includes('\0')) return null;
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (isAbsolute(requested)) return null;
  const resolved = normalize(join(PUBLIC_ROOT, requested));
  const pathFromRoot = relative(PUBLIC_ROOT, resolved);
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) return null;
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  return resolved;
}

function sendStatic(response, pathname) {
  const file = staticFileForPath(pathname);
  if (!file) {
    sendJson(response, 404, { error: 'Not found.', code: 'not_found' });
    return;
  }
  response.writeHead(200, securityHeaders({
    'Cache-Control': 'no-cache',
    'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
  }));
  createReadStream(file).pipe(response);
}

function createDiscoveryCache({ apiKey, fetchImpl, modelDiscovery, ttlMs }) {
  let cache = null;
  let pending = null;
  return async function discovery() {
    if (cache && Date.now() - cache.loadedAt < ttlMs) return cache.value;
    if (pending) return pending;
    pending = modelDiscovery({ apiKey, fetchImpl })
      .then((value) => {
        cache = { loadedAt: Date.now(), value };
        return value;
      })
      .finally(() => { pending = null; });
    return pending;
  };
}

export function createIvPrepServer({
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch,
  modelDiscovery = discoverOpenAIModels,
  discoveryTtlMs = DEFAULT_DISCOVERY_TTL_MS,
  avatarProvider = new NullAvatarProvider(),
  interviewerExchange = createInterviewerExchange,
  interviewerObserver = observeInterviewerUtterance,
  speechProvider = createOpenAISpeech,
  realtimeTurnProvider = createOpenAIRealtimeTurn,
} = {}) {
  const configured = typeof apiKey === 'string' && Boolean(apiKey.trim());
  const getDiscovery = createDiscoveryCache({ apiKey, fetchImpl, modelDiscovery, ttlMs: discoveryTtlMs });

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const requestAbort = new AbortController();
    request.once('aborted', () => requestAbort.abort());
    response.once('close', () => {
      if (!response.writableEnded) requestAbort.abort();
    });
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'ivprep-v6-alpha',
          openaiConfigured: configured,
          avatarProvider: avatarProvider.health(),
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/model-studio-config') {
        const discovery = await getDiscovery();
        sendJson(response, 200, publicModelStudioConfig(discovery));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/voice-studio-config') {
        sendJson(response, 200, publicVoiceStudioConfig({ configured }));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/avatar-provider-config') {
        sendJson(response, 200, { health: avatarProvider.health(), usage: avatarProvider.usage() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/interviewer-exchange') {
        const body = requireBodyObject(await readJson(request));
        const discovery = await getDiscovery();
        const model = requireDiscoveredModel(
          discovery,
          body.model || process.env.OPENAI_INTERVIEWER_MODEL || DEFAULT_INTERVIEWER_MODEL,
          MODEL_ARCHITECTURES.RESPONSES_SPEECH,
        );
        const observerModel = requireDiscoveredModel(
          discovery,
          body.observerModel || process.env.OPENAI_OBSERVER_MODEL || DEFAULT_OBSERVER_MODEL,
          MODEL_ARCHITECTURES.RESPONSES_SPEECH,
        );
        sendJson(response, 200, await interviewerExchange({
          apiKey,
          model,
          observerModel,
          reasoningEffort: body.reasoningEffort || process.env.OPENAI_INTERVIEWER_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
          behaviorPresetId: body.behaviorPresetId,
          context: body.context,
          signal: requestAbort.signal,
          fetchImpl,
        }));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/interviewer-observe') {
        const body = requireBodyObject(await readJson(request));
        const discovery = await getDiscovery();
        const observerModel = requireDiscoveredModel(
          discovery,
          body.observerModel || process.env.OPENAI_OBSERVER_MODEL || DEFAULT_OBSERVER_MODEL,
          MODEL_ARCHITECTURES.RESPONSES_SPEECH,
        );
        sendJson(response, 200, await interviewerObserver({
          apiKey,
          observerModel,
          context: body.context,
          utterance: body.utterance,
          signal: requestAbort.signal,
          fetchImpl,
        }));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/speech') {
        const body = requireBodyObject(await readJson(request));
        const speech = await speechProvider({
          apiKey,
          model: body.model || process.env.OPENAI_SPEECH_MODEL || DEFAULT_SPEECH_MODEL,
          input: body.input,
          selection: body.selection,
          signal: requestAbort.signal,
          fetchImpl,
        });
        response.writeHead(200, securityHeaders({
          'Content-Type': speech.contentType,
          'Content-Length': String(speech.bytes.length),
          'X-IVPrep-Speech-Model': speech.model,
          'X-IVPrep-Voice-Id': speech.voiceId,
          'X-IVPrep-Latency-Ms': String(speech.latencyMs),
        }));
        response.end(speech.bytes);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/realtime-turn') {
        const body = requireBodyObject(await readJson(request));
        const discovery = await getDiscovery();
        const model = requireDiscoveredModel(discovery, body.model, MODEL_ARCHITECTURES.NATIVE_REALTIME);
        const observerModel = requireDiscoveredModel(
          discovery,
          body.observerModel || process.env.OPENAI_OBSERVER_MODEL || DEFAULT_OBSERVER_MODEL,
          MODEL_ARCHITECTURES.RESPONSES_SPEECH,
        );
        const realtime = await realtimeTurnProvider({
          apiKey,
          model,
          voiceId: body.voiceId,
          behaviorPresetId: body.behaviorPresetId,
          context: body.context,
          safetyIdentifier: body.safetyIdentifier,
          signal: requestAbort.signal,
        });
        const observer = await interviewerObserver({
          apiKey,
          observerModel,
          context: body.context,
          utterance: realtime.utterance,
          signal: requestAbort.signal,
          fetchImpl,
        });
        sendJson(response, 200, {
          requestedModel: realtime.requestedModel,
          model: realtime.providerModel,
          architecture: MODEL_ARCHITECTURES.NATIVE_REALTIME,
          observerModel: observer.providerModel,
          voiceId: realtime.voiceId,
          utterance: realtime.utterance,
          metadata: observer.metadata,
          audioBase64: realtime.audio.toString('base64'),
          audioContentType: realtime.audioContentType,
          timings: {
            firstAudioMs: realtime.firstAudioMs,
            realtimeMs: realtime.totalMs,
            observerMs: observer.latencyMs,
            totalMs: realtime.totalMs + observer.latencyMs,
          },
          usage: { interviewer: realtime.usage, observer: observer.usage },
        });
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        if (['GET', 'POST'].includes(request.method)) sendJson(response, 404, { error: 'Not found.', code: 'not_found' });
        else sendMethodNotAllowed(response, ['GET', 'POST']);
        return;
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendMethodNotAllowed(response, ['GET', 'HEAD']);
        return;
      }
      if (request.method === 'HEAD') {
        const file = staticFileForPath(url.pathname);
        if (!file) sendJson(response, 404, { error: 'Not found.', code: 'not_found' });
        else {
          response.writeHead(200, securityHeaders({
            'Cache-Control': 'no-cache',
            'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
          }));
          response.end();
        }
        return;
      }
      sendStatic(response, url.pathname);
    } catch (error) {
      if (error instanceof TypeError) {
        sendJson(response, 400, { error: error.message, code: 'invalid_request' });
        return;
      }
      const publicError = publicProviderError(error);
      const status = error instanceof ProviderError ? error.status : 500;
      sendJson(response, status, publicError);
      if (!(error instanceof ProviderError)) console.error('[ivprep-v6] unexpected_error');
    }
  });
}

async function start() {
  loadLocalEnvironment();
  const host = requireLocalAlphaHost(process.env.HOST || '127.0.0.1');
  if (!LOOPBACK_HOSTS.has(host)) throw new TypeError('HOST must remain loopback-only for the unauthenticated Founder Alpha.');
  const port = Number(process.env.PORT || 8343);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('PORT must be an integer between 1 and 65535.');
  const server = createIvPrepServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  console.log(`[ivprep-v6] listening on http://${host}:${port}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  start().catch(() => {
    console.error('[ivprep-v6] failed_to_start');
    process.exitCode = 1;
  });
}
