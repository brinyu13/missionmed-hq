import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { admissionRegistry } from './admission-registry.mjs';
import { publicAdmissionState, strictProjectHqSession, validateIvPrepMutation } from './admission-contract.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = normalize(join(MODULE_DIR, '..', 'public'));
const MAX_BODY_BYTES = 64 * 1024;
const PRODUCT_PREFIX = '/iv-prep-on-call';
const API_PREFIX = '/api/ivprep-v6';

const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.task': 'application/octet-stream',
  '.tflite': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
});

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function headers(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...extra,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, headers({ 'Content-Type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(body));
}

function sendAdmissionError(response, admission) {
  sendJson(response, admission?.status || 401, { error: admission?.code || 'ivprep_authentication_required' });
}

function trustedOrigin(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)
      || parsed.username || parsed.password || parsed.pathname !== '/'
      || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function hasQueryCredential(url) {
  for (const [name, value] of url?.searchParams || []) {
    const normalized = String(name).replace(/[^a-z0-9]/giu, '').toLowerCase();
    if (/(?:authorization|bearer|credential|password|secret|session|cookie|token|apikey|csrf|jwt|wpauthorization)/u.test(normalized)) return true;
    const candidate = String(value || '').trim();
    if (/^(?:bearer|basic)\s+/iu.test(candidate) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(candidate)) return true;
  }
  return false;
}

function startRequestHash({ mode }) {
  return createHash('sha256')
    .update(JSON.stringify({ operation: 'interview_start', mode }))
    .digest('hex');
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new TypeError('Request body is too large.');
    chunks.push(chunk);
  }
  if (!bytes) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Request body must be an object.');
  return value;
}

function staticFile(pathname) {
  let relativePath;
  if (pathname === PRODUCT_PREFIX || pathname === `${PRODUCT_PREFIX}/`) relativePath = 'aaa/index.html';
  else if (pathname.startsWith(`${PRODUCT_PREFIX}/assets/`)) relativePath = pathname.slice(`${PRODUCT_PREFIX}/assets/`.length);
  else return null;
  let decoded;
  try { decoded = decodeURIComponent(relativePath); } catch { return null; }
  if (!decoded || decoded.includes('\0') || isAbsolute(decoded)) return null;
  const resolved = normalize(join(PUBLIC_ROOT, decoded));
  const fromRoot = relative(PUBLIC_ROOT, resolved);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot) || !existsSync(resolved) || !statSync(resolved).isFile()) return null;
  return resolved;
}

function isProductPath(pathname) {
  return pathname === PRODUCT_PREFIX
    || pathname.startsWith(`${PRODUCT_PREFIX}/`)
    || pathname === API_PREFIX
    || pathname.startsWith(`${API_PREFIX}/`);
}

export function createIvPrepHqHandler({
  registry = admissionRegistry,
  now = () => Date.now(),
  idFactory = () => randomUUID(),
  flags = {
    enabled: enabled(process.env.IVPREP_ENABLED),
    videoEnabled: enabled(process.env.IVPREP_VIDEO_ENABLED),
    adminCanaryEnabled: enabled(process.env.IVPREP_ADMIN_CANARY_ENABLED),
  },
  providerControllerFactory = null,
} = {}) {
  const interviews = new Map();

  return async function handleIvPrepV6Request({
    request,
    response,
    url,
    hqSession,
    cookieFingerprint,
    hqSessionMaxTtlSeconds,
    expectedOrigin,
  } = {}) {
    const pathname = url?.pathname || '/';
    if (!isProductPath(pathname)) return false;
    if (request.headers.authorization || request.headers.Authorization || hasQueryCredential(url)) {
      sendAdmissionError(response, { status: 401, code: 'ivprep_authentication_required' });
      return true;
    }
    if (!flags.enabled || !flags.adminCanaryEnabled) {
      sendJson(response, 503, { error: 'ivprep_unavailable' });
      return true;
    }

    const admission = strictProjectHqSession({
      request,
      hqSession,
      cookieFingerprint,
      registry,
      now: now(),
      maxSessionTtlSeconds: hqSessionMaxTtlSeconds,
    });
    if (!admission.ok) {
      sendAdmissionError(response, admission);
      return true;
    }

    if (pathname === PRODUCT_PREFIX) {
      response.writeHead(308, headers({ Location: `${PRODUCT_PREFIX}/` }));
      response.end();
      return true;
    }

    if (pathname.startsWith(`${PRODUCT_PREFIX}/`)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, headers({ Allow: 'GET, HEAD' }));
        response.end();
        return true;
      }
      const file = staticFile(pathname);
      if (!file) {
        sendJson(response, 404, { error: 'not_found' });
        return true;
      }
      response.writeHead(200, headers({
        'Cache-Control': 'no-cache',
        'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      }));
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
      return true;
    }

    if (request.headers.upgrade) {
      sendJson(response, 426, { error: 'ivprep_websocket_unavailable' });
      return true;
    }

    if (request.method === 'GET' && pathname === `${API_PREFIX}/session`) {
      sendJson(response, 200, publicAdmissionState(admission, { videoEnabled: flags.videoEnabled }));
      return true;
    }

    if (request.method === 'GET' && pathname === `${API_PREFIX}/vault`) {
      sendJson(response, 200, { sessions: [] });
      return true;
    }

    const sealedOrigin = trustedOrigin(expectedOrigin);
    if (!sealedOrigin) {
      sendJson(response, 403, { error: 'ivprep_admission_denied' });
      return true;
    }

    const statusMatch = pathname.match(new RegExp(`^${API_PREFIX}/interviews/([A-Za-z0-9._:-]{1,120})/status$`, 'u'));
    if (request.method === 'GET' && statusMatch) {
      const interview = interviews.get(statusMatch[1]);
      const owner = registry.assertBinding({
        interviewId: statusMatch[1],
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
      });
      if (!interview || !owner.ok) {
        sendJson(response, 409, { error: 'ivprep_session_owner_changed' });
        return true;
      }
      const provider = interview.controller?.status?.() || null;
      if (provider?.state === 'ACTIVE') {
        interview.state = 'active';
        interview.connection = null;
      } else if (provider?.state === 'CLOSED') {
        interview.state = 'ended';
        interview.connection = null;
      } else if (provider?.state === 'FAILED_CLOSED') {
        interview.state = 'failed_closed';
        interview.connection = null;
      }
      sendJson(response, 200, {
        interview: { id: interview.id, mode: interview.mode, state: interview.state },
        provider: provider ? { state: provider.state, active: provider.active === true } : null,
      });
      return true;
    }

    const mediaReadyMatch = pathname.match(new RegExp(`^${API_PREFIX}/interviews/([A-Za-z0-9._:-]{1,120})/media-ready$`, 'u'));
    if (request.method === 'POST' && mediaReadyMatch) {
      const mutation = validateIvPrepMutation({ request, admission, expectedOrigin: sealedOrigin });
      if (!mutation.ok) { sendAdmissionError(response, mutation); return true; }
      const interview = interviews.get(mediaReadyMatch[1]);
      const owner = registry.assertBinding({
        interviewId: mediaReadyMatch[1],
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
      });
      if (!interview || !owner.ok || interview.mode !== 'video' || !interview.controller) {
        sendJson(response, 409, { error: 'ivprep_session_owner_changed' });
        return true;
      }
      let body;
      try { body = await readJson(request); }
      catch { sendJson(response, 400, { error: 'ivprep_invalid_request' }); return true; }
      const keys = Object.keys(body).sort();
      if (keys.join(',') !== 'audioAuthority,audioPlayable,videoDecoded'
        || body.videoDecoded !== true
        || body.audioPlayable !== true
        || body.audioAuthority !== 'avatar-livekit') {
        sendJson(response, 400, { error: 'ivprep_invalid_request' });
        return true;
      }
      const recorded = await interview.controller.recordBrowserMediaReady({
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
        videoDecoded: true,
        audioPlayable: true,
        audioAuthority: 'avatar-livekit',
      });
      if (!recorded?.ok) {
        sendJson(response, 503, { error: 'ivprep_media_readiness_unconfirmed' });
        return true;
      }
      sendJson(response, 202, { interview: { id: interview.id, mode: interview.mode, state: 'starting' } });
      return true;
    }

    if (request.method === 'POST' && pathname === `${API_PREFIX}/interviews/start`) {
      const mutation = validateIvPrepMutation({ request, admission, expectedOrigin: sealedOrigin });
      if (!mutation.ok) {
        sendAdmissionError(response, mutation);
        return true;
      }
      let body;
      try { body = await readJson(request); }
      catch { sendJson(response, 400, { error: 'ivprep_invalid_request' }); return true; }
      const mode = body.mode === 'video' ? 'video' : 'voice-only';
      if (Object.keys(body).some((key) => key !== 'mode')) {
        sendJson(response, 400, { error: 'ivprep_invalid_request' });
        return true;
      }
      const idempotencyKey = String(request.headers['idempotency-key'] || '').trim();
      if (!/^[A-Za-z0-9._:-]{8,120}$/u.test(idempotencyKey)) {
        sendJson(response, 400, { error: 'ivprep_invalid_request' });
        return true;
      }
      const requestHash = startRequestHash({ mode });
      const existing = [...interviews.values()].find((entry) => entry.idempotencyKey === idempotencyKey && entry.subject === admission.subject);
      if (existing) {
        const owner = registry.assertBinding({
          interviewId: existing.id,
          subject: admission.subject,
          cookieFingerprint: admission.cookieFingerprint,
          entitlementRevision: admission.entitlement.revision,
        });
        if (!owner.ok || existing.requestHash !== requestHash) {
          sendJson(response, 409, { error: 'ivprep_idempotency_conflict' });
          return true;
        }
        const replay = { interview: { id: existing.id, mode: existing.mode, state: existing.state } };
        if (existing.state === 'starting' && existing.connection) replay.connection = existing.connection;
        sendJson(response, existing.state === 'starting' ? 202 : 200, replay);
        return true;
      }
      if (mode === 'video' && (!flags.videoEnabled || admission.entitlement.video !== true)) {
        sendJson(response, 503, { error: 'ivprep_unavailable' });
        return true;
      }
      if (mode === 'video' && typeof providerControllerFactory !== 'function') {
        sendJson(response, 503, { error: 'ivprep_unavailable' });
        return true;
      }
      const active = [...interviews.values()].find((entry) => entry.subject === admission.subject && ['starting', 'active', 'terminating'].includes(entry.state));
      if (active) {
        sendJson(response, 409, { error: 'ivprep_interview_active' });
        return true;
      }
      const id = idFactory();
      registry.bindInterview({
        interviewId: id,
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
      });
      const interview = {
        id,
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
        idempotencyKey,
        requestHash,
        mode,
        state: mode === 'video' ? 'starting' : 'active',
        startedAtMs: now(),
        connection: null,
        controller: mode === 'video' ? providerControllerFactory({ admission, id }) : null,
      };
      interviews.set(id, interview);
      const terminateInterview = async (reason) => {
        if (['ended', 'failed_closed'].includes(interview.state)) return;
        interview.state = 'terminating';
        if (interview.controller) {
          const stopped = await interview.controller.stop(reason);
          interview.state = stopped?.ok ? 'ended' : 'failed_closed';
        } else {
          interview.state = 'ended';
        }
        interview.connection = null;
      };
      registry.setTerminationHandler?.(id, terminateInterview);
      if (interview.controller) {
        const started = await interview.controller.start({
          subject: admission.subject,
          interviewId: id,
          idempotencyKey,
          testNo: 1,
        });
        if (!started?.ok) {
          interview.state = 'failed_closed';
          sendJson(response, 503, { error: 'ivprep_provider_start_failed' });
          return true;
        }
        if (interview.state !== 'starting') {
          const stopped = await interview.controller.stop('termination_requested_during_start');
          interview.state = stopped?.ok ? 'ended' : 'failed_closed';
          sendJson(response, 409, { error: 'ivprep_session_owner_changed' });
          return true;
        }
        const stillOwned = registry.assertBinding({
          interviewId: id,
          subject: admission.subject,
          cookieFingerprint: admission.cookieFingerprint,
          entitlementRevision: admission.entitlement.revision,
        });
        if (!stillOwned.ok) {
          const stopped = await interview.controller.stop('admission_changed_during_start');
          interview.state = stopped?.ok ? 'ended' : 'failed_closed';
          sendJson(response, 409, { error: 'ivprep_session_owner_changed' });
          return true;
        }
        if (started.pending === true) {
          interview.connection = started.connection;
          sendJson(response, 202, {
            interview: { id, mode, state: interview.state },
            connection: interview.connection,
          });
          return true;
        }
        interview.state = 'active';
      }
      sendJson(response, 201, { interview: { id, mode, state: interview.state } });
      return true;
    }

    const endMatch = pathname.match(new RegExp(`^${API_PREFIX}/interviews/([A-Za-z0-9._:-]{1,120})/end$`, 'u'));
    if (request.method === 'POST' && endMatch) {
      const mutation = validateIvPrepMutation({ request, admission, expectedOrigin: sealedOrigin });
      if (!mutation.ok) { sendAdmissionError(response, mutation); return true; }
      const interview = interviews.get(endMatch[1]);
      const owner = registry.assertBinding({
        interviewId: endMatch[1],
        subject: admission.subject,
        cookieFingerprint: admission.cookieFingerprint,
        entitlementRevision: admission.entitlement.revision,
      });
      if (!interview || !owner.ok) {
        sendJson(response, 409, { error: 'ivprep_session_owner_changed' });
        return true;
      }
      if (interview.controller) {
        const stopped = await interview.controller.stop('user_ended');
        interview.state = stopped?.ok ? 'ended' : 'failed_closed';
        if (!stopped?.ok) {
          sendJson(response, 503, { error: 'ivprep_provider_cleanup_unconfirmed' });
          return true;
        }
      } else {
        interview.state = 'ended';
      }
      interview.connection = null;
      interview.endedAtMs = now();
      registry.clearTerminationHandler?.(interview.id);
      sendJson(response, 200, { interview: { id: interview.id, mode: interview.mode, state: interview.state } });
      return true;
    }

    sendJson(response, 404, { error: 'not_found' });
    return true;
  };
}

export const handleIvPrepV6Request = createIvPrepHqHandler();
