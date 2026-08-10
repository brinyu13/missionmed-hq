import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

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
import { createAvatarProviderFromEnv } from '../providers/liveavatar-provider.mjs';
import { ProviderError, publicProviderError } from '../providers/errors.mjs';
import { discoverOpenAIModels } from '../providers/openai-model-discovery.mjs';
import { createOpenAIRealtimeTurn } from '../providers/openai-realtime.mjs';
import { OpenAIContinuousRealtimeRail } from '../providers/openai-continuous-realtime.mjs';
import { publicConversationRailConfig } from '../providers/conversation-rail.mjs';
import {
  createInterviewerExchange,
  observeInterviewerUtterance,
} from '../providers/openai-responses.mjs';
import { createOpenAISpeech } from '../providers/openai-speech.mjs';
import { publicFacultyRoster, surpriseAssignment } from '../config/faculty-roster.mjs';
import { loadLocalEnvironment as loadEnvironmentFile } from '../config/load-environment.mjs';
import {
  ALPHA_DEFAULT_MINUTES,
  ALPHA_HARD_MAXIMUM_MINUTES,
  AlphaStore,
  INACTIVE_COMMERCIALIZATION_CONTROLS,
} from '../persistence/alpha-store.mjs';
import { LIVE_INTERVIEWER_TARGET, publicLiveInterviewerTarget } from '../avatar/live-interviewer-target.mjs';
import { validatedLiveAvatarLiveKitOrigin } from '../avatar/livekit-origin.mjs';

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = normalize(join(MODULE_DIRECTORY, '..'));
const PUBLIC_ROOT = normalize(join(APP_ROOT, 'public'));
const LIVEKIT_BROWSER_MODULE = normalize(join(APP_ROOT, 'node_modules', 'livekit-client', 'dist', 'livekit-client.esm.mjs'));
const MAX_JSON_BYTES = 512 * 1024;
const DEFAULT_DISCOVERY_TTL_MS = 5 * 60 * 1000;
const LOOPBACK_HOSTS = Object.freeze(new Set(['127.0.0.1', '::1', 'localhost']));
const MAX_REQUESTS_PER_MINUTE = 120;
const MAX_CONCURRENT_PROVIDER_REQUESTS = 2;
const MAX_RAIL_CONTROL_BYTES = 64 * 1024;
const RAIL_RATE_WINDOW_MS = 1_000;
const MAX_RAIL_MESSAGES_PER_WINDOW = 80;
const MAX_RAIL_AUDIO_BYTES_PER_WINDOW = 256 * 1024;

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

export function loadLocalEnvironment() {
  loadEnvironmentFile({ path: join(APP_ROOT, '.env') });
  loadEnvironmentFile({ path: join(APP_ROOT, '.env.local') });
}

export function requireLocalAlphaHost(value = '127.0.0.1') {
  const host = String(value || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new TypeError('Founder Alpha must bind to a loopback host. Private deployment requires Y1-Y2-CAM-V6-3403 authorization and auth review.');
  }
  return host;
}

function securityHeaders(extra = {}) {
  const liveKitOrigin = configuredLiveKitOrigin();
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'self'; connect-src 'self'${liveKitOrigin ? ` ${liveKitOrigin}` : ''}; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...extra,
  };
}

function configuredLiveKitOrigin() {
  const raw = String(process.env.LIVEAVATAR_LIVEKIT_ORIGIN || '').trim();
  if (!raw) return null;
  try { return validatedLiveAvatarLiveKitOrigin(raw); }
  catch { return null; }
}

function sendJson(response, status, body) {
  response.writeHead(status, securityHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(body));
}

function publicAvatarHealth(provider) {
  const health = provider.health();
  return {
    provider: health.provider,
    status: health.status,
    configured: Boolean(health.configured),
    available: Boolean(health.available),
    connected: Boolean(health.connected),
    mode: health.mode || null,
    avatarId: health.avatarId || null,
    fallback: health.fallback || null,
    reason: health.reason || null,
    lastError: health.lastError || null,
  };
}

function publicAvatarUsage(provider) {
  const usage = provider.usage();
  const { sessionId: _sessionId, ...safe } = usage;
  return safe;
}

function sendMethodNotAllowed(response, methods) {
  response.writeHead(405, securityHeaders({ Allow: methods.join(', ') }));
  response.end();
}

function apiRequestOrigin(request) {
  const rawHost = String(request.headers.host || '');
  let hostname;
  try { hostname = new URL(`http://${rawHost}`).hostname.toLowerCase(); }
  catch { throw new TypeError('A valid local Host header is required.'); }
  if (!LOOPBACK_HOSTS.has(hostname)) throw new TypeError('API requests must use the loopback Founder Alpha host.');
  if (request.method === 'POST') {
    const contentType = String(request.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) throw new TypeError('POST requests require application/json.');
    const fetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase();
    if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) throw new TypeError('Cross-site API requests are not allowed.');
    const origin = String(request.headers.origin || '');
    if (origin) {
      let originUrl;
      try { originUrl = new URL(origin); }
      catch { throw new TypeError('A valid Origin header is required.'); }
      if (originUrl.protocol !== 'http:' || originUrl.host !== rawHost) throw new TypeError('Cross-origin API requests are not allowed.');
    }
  }
  return hostname;
}

function requireFounderLocalHeader(request) {
  if (request.headers['x-ivprep-founder'] !== 'local-founder') {
    throw new TypeError('Founder-local request marker is required.');
  }
}

function createRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();
  return (request) => {
    const key = String(request.socket?.remoteAddress || 'unknown');
    const current = now();
    const previous = buckets.get(key);
    const bucket = !previous || current - previous.startedAt >= 60_000 ? { startedAt: current, count: 0 } : previous;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > MAX_REQUESTS_PER_MINUTE) {
      throw new ProviderError('Local alpha request limit exceeded.', {
        code: 'alpha_rate_limited', status: 429, provider: 'missionmed', publicMessage: 'Too many local alpha requests. Wait one minute and try again.',
      });
    }
  };
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
  const file = pathname === '/vendor/livekit-client.esm.mjs' && existsSync(LIVEKIT_BROWSER_MODULE)
    ? LIVEKIT_BROWSER_MODULE
    : staticFileForPath(pathname);
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
  avatarProvider = createAvatarProviderFromEnv(),
  interviewerExchange = createInterviewerExchange,
  interviewerObserver = observeInterviewerUtterance,
  speechProvider = createOpenAISpeech,
  realtimeTurnProvider = createOpenAIRealtimeTurn,
  continuousRailFactory = (options) => new OpenAIContinuousRealtimeRail(options),
  alphaStore = new AlphaStore({ path: process.env.IVPREP_ALPHA_DATA_PATH || join(APP_ROOT, '.alpha-data', 'sessions.json') }),
} = {}) {
  const configured = typeof apiKey === 'string' && Boolean(apiKey.trim());
  const liveAvatarConfigured = avatarProvider.health().configured === true || avatarProvider.health().available === true;
  const liveAvatarMediaConfigured = liveAvatarConfigured && Boolean(configuredLiveKitOrigin());
  const getDiscovery = createDiscoveryCache({ apiKey, fetchImpl, modelDiscovery, ttlMs: discoveryTtlMs });
  const rateLimit = createRateLimiter();
  let activeProviderRequests = 0;
  const realtimeRails = new Map();
  let avatarOwnerAlphaSessionId = null;
  const requireAvatarOwner = (body) => {
    if (typeof body.alphaSessionId !== 'string' || !body.alphaSessionId) throw new TypeError('An active interview session identifier is required.');
    if (typeof body.sessionId !== 'string' || !body.sessionId) throw new TypeError('An avatar session identifier is required.');
    if (body.alphaSessionId !== avatarOwnerAlphaSessionId) throw new TypeError('Avatar session does not belong to this interview.');
    if (body.sessionId !== avatarProvider.health().sessionId) throw new TypeError('Avatar session does not match the active server session.');
  };
  const requestAvatarCleanup = async (reason) => {
    if (!avatarOwnerAlphaSessionId) return { requested: false, acknowledged: true, state: 'not-required' };
    try {
      const stopped = await avatarProvider.stop({ reason });
      avatarOwnerAlphaSessionId = null;
      return { requested: true, acknowledged: true, state: 'acknowledged', stopped: stopped?.stopped === true };
    } catch {
      return { requested: true, acknowledged: false, state: 'unconfirmed' };
    }
  };
  const requireAcknowledgedCleanup = (cleanup) => {
    if (cleanup.acknowledged) return cleanup;
    throw new ProviderError('LiveAvatar remote cleanup was not acknowledged; ownership is retained for retry.', {
      code: 'liveavatar_cleanup_unconfirmed', status: 503, provider: 'liveavatar', retryable: true,
      publicMessage: 'The interview is safe, but remote avatar cleanup is unconfirmed. Retry ending the avatar session.',
    });
  };
  const withProviderSlot = async (operation) => {
    if (activeProviderRequests >= MAX_CONCURRENT_PROVIDER_REQUESTS) {
      throw new ProviderError('Founder Alpha provider concurrency limit reached.', {
        code: 'alpha_concurrency_limited', status: 429, provider: 'missionmed', publicMessage: 'Another provider request is already running. Try again in a moment.',
      });
    }
    activeProviderRequests += 1;
    try { return await operation(); }
    finally { activeProviderRequests -= 1; }
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const requestAbort = new AbortController();
    request.once('aborted', () => requestAbort.abort());
    response.once('close', () => {
      if (!response.writableEnded) requestAbort.abort();
    });
    try {
      if (url.pathname.startsWith('/api/')) {
        apiRequestOrigin(request);
        rateLimit(request);
      }
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'ivprep-v6-alpha',
          openaiConfigured: configured,
          avatarProvider: publicAvatarHealth(avatarProvider),
          alpha: {
            disabled: alphaStore.isDisabled(),
            defaultMinutes: ALPHA_DEFAULT_MINUTES,
            hardMaximumMinutes: ALPHA_HARD_MAXIMUM_MINUTES,
          },
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/model-studio-config') {
        const discovery = await getDiscovery();
        sendJson(response, 200, publicModelStudioConfig(discovery));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/conversation-rail-config') {
        const discovery = await getDiscovery();
        sendJson(response, 200, publicConversationRailConfig({
          realtimeAvailable: discovery.models.some((model) => model.id === 'gpt-realtime-2.1'),
        }));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/voice-studio-config') {
        sendJson(response, 200, publicVoiceStudioConfig({ configured }));
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/avatar-provider-config') {
        const liveSessionBlock = process.env.LIVEAVATAR_START_BLOCK === 'insufficient-credits'
          ? 'insufficient-credits'
          : null;
        sendJson(response, 200, {
          health: publicAvatarHealth(avatarProvider),
          usage: publicAvatarUsage(avatarProvider),
          target: publicLiveInterviewerTarget({
            hasServerAuthorization: liveAvatarConfigured,
            hasApprovedLiveKitOrigin: Boolean(configuredLiveKitOrigin()),
            authenticatedAvatarVerified: process.env.LIVEAVATAR_AUTHENTICATED_AVATAR_VERIFIED === 'true',
            authenticatedVoiceVerified: process.env.LIVEAVATAR_AUTHENTICATED_VOICE_VERIFIED === 'true',
            lockedVoiceCompatible: process.env.LIVEAVATAR_LOCKED_VOICE_COMPATIBLE === 'true',
            liveSessionBlock,
          }),
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/create') {
        const body = requireBodyObject(await readJson(request));
        const health = avatarProvider.health();
        if (!liveAvatarConfigured) {
          throw new ProviderError('LiveAvatar server authorization is unavailable.', {
            code: 'liveavatar_not_configured', status: 503, provider: 'liveavatar', publicMessage: 'Live avatar is unavailable. Continue in visible voice-only mode.',
          });
        }
        if (typeof body.alphaSessionId !== 'string' || !body.alphaSessionId) throw new TypeError('An active interview session identifier is required.');
        const alphaSession = alphaStore.getSession(body.alphaSessionId);
        if (!alphaSession || alphaSession.state !== 'active' || alphaSession.mode !== 'avatar') throw new TypeError('An active avatar-mode interview session is required.');
        if (avatarOwnerAlphaSessionId && avatarOwnerAlphaSessionId !== alphaSession.id) {
          throw new ProviderError('Another interview already owns the LiveAvatar session.', {
            code: 'liveavatar_session_owned', status: 409, provider: 'liveavatar', publicMessage: 'Another local interview is using the live avatar. Continue in voice-only mode.',
          });
        }
        if (body.avatarId && body.avatarId !== LIVE_INTERVIEWER_TARGET.avatarId) throw new TypeError('Requested avatar does not match the Founder-locked Dexter asset.');
        if (health.avatarId !== LIVE_INTERVIEWER_TARGET.avatarId) throw new TypeError('Server avatar configuration does not match the Founder-locked Dexter asset.');
        const created = await avatarProvider.createSession();
        avatarOwnerAlphaSessionId = alphaSession.id;
        sendJson(response, 201, { sessionId: created.sessionId, status: created.status, avatarId: created.avatarId, mode: created.mode, maxSessionDuration: created.maxSessionDuration });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/start') {
        const body = requireBodyObject(await readJson(request));
        requireAvatarOwner(body);
        const started = await avatarProvider.start();
        if (started.status !== 'connected' || !started.media?.url || !started.media?.clientToken) {
          throw new ProviderError('LiveAvatar did not establish a media session.', {
            code: 'liveavatar_media_unavailable', status: 503, provider: 'liveavatar', publicMessage: 'Live avatar is unavailable. Continue in visible voice-only mode.',
          });
        }
        const actualLiveKitOrigin = validatedLiveAvatarLiveKitOrigin(started.media.url);
        const allowedLiveKitOrigin = configuredLiveKitOrigin();
        if (!allowedLiveKitOrigin || actualLiveKitOrigin !== allowedLiveKitOrigin) {
          requireAcknowledgedCleanup(await requestAvatarCleanup('SERVER_ERROR'));
          throw new ProviderError('LiveKit signaling origin is not approved for this alpha.', {
            code: 'liveavatar_livekit_origin_unapproved', status: 503, provider: 'liveavatar', publicMessage: 'Live avatar media origin is not approved. Continue in visible voice-only mode.',
          });
        }
        sendJson(response, 200, {
          sessionId: started.sessionId,
          status: started.status,
          livekitUrl: started.media.url,
          livekitClientToken: started.media.clientToken,
          maxSessionDuration: started.maxSessionDuration,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/audio') {
        const body = requireBodyObject(await readJson(request));
        requireAvatarOwner(body);
        if (typeof body.pcmBase64 !== 'string' || body.pcmBase64.length > 1_100_000) throw new TypeError('A bounded Base64 PCM payload is required.');
        sendJson(response, 200, await avatarProvider.enqueueAudio(Buffer.from(body.pcmBase64, 'base64'), {
          eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
          final: body.final !== false,
        }));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/interrupt') {
        const body = requireBodyObject(await readJson(request));
        requireAvatarOwner(body);
        sendJson(response, 200, await avatarProvider.interrupt({ eventId: typeof body.eventId === 'string' ? body.eventId : undefined }));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/reconnect') {
        const body = requireBodyObject(await readJson(request));
        requireAvatarOwner(body);
        const reconnected = await avatarProvider.reconnect();
        const actualLiveKitOrigin = validatedLiveAvatarLiveKitOrigin(reconnected.media?.url);
        const allowedLiveKitOrigin = configuredLiveKitOrigin();
        if (!allowedLiveKitOrigin || actualLiveKitOrigin !== allowedLiveKitOrigin) {
          requireAcknowledgedCleanup(await requestAvatarCleanup('SERVER_ERROR'));
          throw new ProviderError('LiveKit signaling origin is not approved for this alpha.', {
            code: 'liveavatar_livekit_origin_unapproved', status: 503, provider: 'liveavatar', publicMessage: 'Live avatar media origin is not approved. Continue in visible voice-only mode.',
          });
        }
        sendJson(response, 200, {
          sessionId: reconnected.sessionId,
          status: reconnected.status,
          reconnected: true,
          livekitUrl: reconnected.media.url,
          livekitClientToken: reconnected.media.clientToken,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/avatar/session/stop') {
        const body = requireBodyObject(await readJson(request));
        requireAvatarOwner(body);
        const cleanup = requireAcknowledgedCleanup(await requestAvatarCleanup(body.reason || 'USER_CLOSED'));
        sendJson(response, 200, { stopped: cleanup.stopped, cleanup });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/faculty-roster') {
        sendJson(response, 200, {
          records: publicFacultyRoster({ liveAvatarConfigured: liveAvatarMediaConfigured, openaiConfigured: configured }),
          priorProviderProvenance: {
            provider: 'liveavatar', mode: 'LITE', avatarIdSource: 'GET /v1/avatars/public',
            currentAuthenticatedVerification: false,
          },
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/surprise-me') {
        const body = requireBodyObject(await readJson(request));
        const assignment = surpriseAssignment({ specialty: body.specialty, liveAvatarConfigured: liveAvatarMediaConfigured, openaiConfigured: configured });
        if (!assignment) {
          sendJson(response, 409, { error: 'No licensed, provider-ready alpha interviewer matches this selection.', code: 'no_eligible_interviewer' });
          return;
        }
        sendJson(response, 200, { assignment });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/alpha-sessions') {
        requireFounderLocalHeader(request);
        sendJson(response, 200, {
          sessions: alphaStore.listSessions(),
          usage: alphaStore.usageLedger(),
          commercialization: INACTIVE_COMMERCIALIZATION_CONTROLS,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/alpha-sessions/start') {
        const body = requireBodyObject(await readJson(request));
        const mode = body.mode === 'avatar' ? 'avatar' : 'voice-only';
        if (mode === 'avatar' && !liveAvatarMediaConfigured) {
          throw new ProviderError('LiveAvatar configuration is missing.', {
            code: 'avatar_provider_unavailable', status: 503, provider: 'liveavatar', publicMessage: 'Live avatar is unavailable. Choose the visible voice-only fallback or ask the founder to configure LiveAvatar.',
          });
        }
        if (!configured) {
          throw new ProviderError('OpenAI configuration is missing.', {
            code: 'openai_not_configured', status: 503, provider: 'openai', publicMessage: 'The interviewer voice and intelligence provider is not configured.',
          });
        }
        let session;
        try { session = alphaStore.startSession({ ...body, mode }); }
        catch (error) {
          const activeIdentity = /already has an active interview/i.test(error.message);
          const disabled = /globally disabled/i.test(error.message);
          throw new ProviderError(error.message, {
            code: activeIdentity ? 'alpha_identity_active' : disabled ? 'alpha_disabled' : 'alpha_start_failed',
            status: activeIdentity ? 409 : disabled ? 503 : 400,
            provider: 'missionmed',
            retryable: false,
            publicMessage: activeIdentity
              ? 'This test identity already has an active interview.'
              : disabled ? 'New alpha interviews are disabled.' : 'The local alpha session could not start.',
          });
        }
        sendJson(response, 201, { session });
        return;
      }

      const sessionEventMatch = url.pathname.match(/^\/api\/alpha-sessions\/([^/]+)\/events$/u);
      if (request.method === 'POST' && sessionEventMatch) {
        const body = requireBodyObject(await readJson(request));
        sendJson(response, 200, { session: alphaStore.appendEvent(sessionEventMatch[1], body) });
        return;
      }

      const sessionEndMatch = url.pathname.match(/^\/api\/alpha-sessions\/([^/]+)\/end$/u);
      if (request.method === 'POST' && sessionEndMatch) {
        const body = requireBodyObject(await readJson(request));
        const session = alphaStore.getSession(sessionEndMatch[1]);
        if (!session) throw new TypeError('Alpha session was not found.');
        await closeRealtimeRail(session.id, 'alpha-session-ended');
        let avatarCleanup = { requested: false, acknowledged: true, state: 'not-required' };
        if (avatarOwnerAlphaSessionId === session.id) {
          avatarCleanup = await requestAvatarCleanup(body.terminationState || 'completed');
        }
        sendJson(response, 200, {
          session: alphaStore.endSession(sessionEndMatch[1], body.terminationState || 'completed'),
          avatarCleanup,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/alpha-control/emergency-disable') {
        requireFounderLocalHeader(request);
        const body = requireBodyObject(await readJson(request));
        const disabled = alphaStore.setDisabled(body.disabled !== false);
        let avatarCleanup = { requested: false, acknowledged: true, state: 'not-required' };
        if (disabled) {
          await closeAllRealtimeRails('emergency-disable');
          avatarCleanup = await requestAvatarCleanup('USER_CLOSED');
        }
        sendJson(response, 200, { disabled, avatarCleanup });
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
        sendJson(response, 200, await withProviderSlot(() => interviewerExchange({
          apiKey,
          model,
          observerModel,
          reasoningEffort: body.reasoningEffort || process.env.OPENAI_INTERVIEWER_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
          behaviorPresetId: body.behaviorPresetId,
          context: body.context,
          signal: requestAbort.signal,
          fetchImpl,
        })));
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
        sendJson(response, 200, await withProviderSlot(() => interviewerObserver({
          apiKey,
          observerModel,
          context: body.context,
          utterance: body.utterance,
          signal: requestAbort.signal,
          fetchImpl,
        })));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/speech') {
        const body = requireBodyObject(await readJson(request));
        const speech = await withProviderSlot(() => speechProvider({
          apiKey,
          model: body.model || process.env.OPENAI_SPEECH_MODEL || DEFAULT_SPEECH_MODEL,
          input: body.input,
          selection: body.selection,
          signal: requestAbort.signal,
          fetchImpl,
        }));
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
  const railSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_RAIL_CONTROL_BYTES });

  function safeRailSend(client, event) {
    if (client.readyState === 1) client.send(JSON.stringify(event));
  }

  async function closeRealtimeRail(alphaSessionId, reason = 'closed') {
    const record = realtimeRails.get(alphaSessionId);
    if (!record) return false;
    realtimeRails.delete(alphaSessionId);
    clearTimeout(record.hardCapTimer);
    await record.rail.close().catch(() => {});
    if (record.client.readyState < 2) record.client.close(1000, reason.slice(0, 80));
    return true;
  }

  async function closeAllRealtimeRails(reason = 'server-close') {
    await Promise.all([...realtimeRails.keys()].map((id) => closeRealtimeRail(id, reason)));
  }

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const origin = new URL(String(request.headers.origin || ''));
      const host = String(request.headers.host || '').toLowerCase();
      const hostName = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
      if (url.pathname !== '/api/conversation-rail' || origin.protocol !== 'http:' || origin.host.toLowerCase() !== host || !LOOPBACK_HOSTS.has(hostName)) throw new Error('invalid upgrade');
    } catch {
      socket.destroy();
      return;
    }
    railSocketServer.handleUpgrade(request, socket, head, (client) => railSocketServer.emit('connection', client, request));
  });

  railSocketServer.on('connection', (client) => {
    let alphaSessionId = null;
    let operation = Promise.resolve();
    let railRateWindowStartedAt = Date.now();
    let railMessagesInWindow = 0;
    let railAudioBytesInWindow = 0;
    const accountRailFrame = (bytes, isBinary) => {
      const now = Date.now();
      if (now - railRateWindowStartedAt >= RAIL_RATE_WINDOW_MS) {
        railRateWindowStartedAt = now;
        railMessagesInWindow = 0;
        railAudioBytesInWindow = 0;
      }
      railMessagesInWindow += 1;
      if (isBinary) railAudioBytesInWindow += bytes;
      if (railMessagesInWindow > MAX_RAIL_MESSAGES_PER_WINDOW || railAudioBytesInWindow > MAX_RAIL_AUDIO_BYTES_PER_WINDOW) {
        throw new ProviderError('Continuous Conversation relay rate exceeded.', {
          code: 'continuous_rail_rate_limited', status: 429, provider: 'missionmed', retryable: true,
          publicMessage: 'Continuous Conversation audio arrived too quickly. Reconnect the interview.',
        });
      }
    };
    const fail = (error) => {
      const safe = publicProviderError(error);
      safeRailSend(client, { type: 'rail_error', code: safe.code, message: safe.error, retryable: safe.retryable });
    };
    const cleanup = async (reason) => {
      if (alphaSessionId) await closeRealtimeRail(alphaSessionId, reason);
    };

    client.on('message', (raw, isBinary) => {
      operation = operation.then(async () => {
        accountRailFrame(raw.length, isBinary);
        if (isBinary) {
          if (!alphaSessionId) throw new TypeError('Continuous Conversation must start before audio is sent.');
          const record = realtimeRails.get(alphaSessionId);
          if (!record) throw new TypeError('Continuous Conversation session is not active.');
          record.rail.appendInputAudio(raw);
          return;
        }
        const text = raw.toString();
        if (text.length > MAX_RAIL_CONTROL_BYTES) throw new TypeError('Continuous Conversation control event is too large.');
        let event;
        try { event = JSON.parse(text); } catch { throw new TypeError('Continuous Conversation control event must be JSON.'); }
        if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('Continuous Conversation control event is invalid.');

        if (event.type === 'start') {
          if (alphaSessionId) throw new TypeError('Continuous Conversation is already started.');
          const session = alphaStore.getSession(String(event.alphaSessionId || ''));
          if (!session || session.state !== 'active') throw new TypeError('An active alpha session is required.');
          if (session.model !== 'gpt-realtime-2.1' || event.model !== 'gpt-realtime-2.1') throw new TypeError('Continuous Conversation requires exact model gpt-realtime-2.1.');
          if (realtimeRails.has(session.id)) throw new ProviderError('This alpha session already owns a Continuous Conversation rail.', {
            code: 'continuous_rail_already_active', status: 409, provider: 'missionmed', publicMessage: 'Continuous Conversation is already active for this interview.',
          });
          alphaSessionId = session.id;
          const rail = continuousRailFactory({
            apiKey,
            onEvent: (providerEvent) => safeRailSend(client, { type: 'rail_event', event: providerEvent }),
          });
          const remainingMs = Math.max(1, session.hardEndsAt - Date.now());
          const hardCapTimer = setTimeout(() => closeRealtimeRail(session.id, 'alpha-hard-cap'), remainingMs);
          hardCapTimer.unref?.();
          realtimeRails.set(session.id, { rail, client, hardCapTimer });
          try {
            const health = await rail.start({
              model: event.model,
              voiceId: event.voiceId,
              speed: event.speed,
              behaviorPresetId: event.behaviorPresetId,
              context: event.context,
              reasoningEffort: event.reasoningEffort || 'low',
            });
            safeRailSend(client, { type: 'rail_ready', health });
          } catch (error) {
            await closeRealtimeRail(session.id, 'provider-start-failed');
            throw error;
          }
          return;
        }

        if (!alphaSessionId) throw new TypeError('Continuous Conversation is not started.');
        const record = realtimeRails.get(alphaSessionId);
        if (!record) throw new TypeError('Continuous Conversation session is not active.');
        if (event.type === 'opening') record.rail.requestOpening(event.utterance);
        else if (event.type === 'input_text') record.rail.appendInputText(event.text);
        else if (event.type === 'interrupt') safeRailSend(client, {
          type: 'rail_interrupted',
          result: record.rail.interrupt({ itemId: event.itemId, playedMs: event.playedMs, cancel: event.cancel !== false }),
        });
        else if (event.type === 'close') await closeRealtimeRail(alphaSessionId, 'client-close');
        else throw new TypeError('Unsupported Continuous Conversation control event.');
      }).catch((error) => {
        fail(error);
        if (error?.code === 'continuous_rail_rate_limited' && client.readyState < 2) client.close(1008, 'rail-rate-limited');
      });
    });
    client.on('close', () => { operation = operation.then(() => cleanup('browser-disconnected')).catch(() => {}); });
    client.on('error', () => { operation = operation.then(() => cleanup('browser-error')).catch(() => {}); });
  });

  server.once('close', () => {
    closeAllRealtimeRails('server-close').catch(() => {});
    railSocketServer.close();
    avatarProvider.close().catch(() => {});
  });
  server.closeProviders = async () => {
    await closeAllRealtimeRails('server-close');
    await avatarProvider.close();
  };
  return server;
}

export async function startIvPrepServer() {
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
  const shutdown = async () => {
    await server.closeProviders().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  startIvPrepServer().catch(() => {
    console.error('[ivprep-v6] failed_to_start');
    process.exitCode = 1;
  });
}
