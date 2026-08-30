import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { admissionRegistry } from '../../ivprep-v6/server/admission-registry.mjs';
import { strictProjectHqSession, validateIvPrepMutation } from '../../ivprep-v6/server/admission-contract.mjs';
import { createIvocRepository } from './repository.mjs';
import { createIvocStorage } from './storage.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const STATIC_ROOT = normalize(join(MODULE_DIR, '..', '..', 'ivprep-v6', 'public', 'ivoc-standalone'));
const ANALYTICS_ROOT = normalize(join(MODULE_DIR, '..', '..', 'ivprep-v6', 'public', 'analytics'));
const UI_PREFIX = '/iv-prep-analytics';
const ANALYTICS_PREFIX = '/iv-prep-on-call/analytics';
const API_PREFIX = '/api/ivoc/v1';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
});

function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
}

function safeText(value, max = 400) { return String(value || '').trim().slice(0, max); }
function rolesOf(session) { return Array.isArray(session?.user?.roles) ? session.user.roles.map((r) => String(r).toLowerCase()) : []; }
function isAdmin(session, admission) { return admission?.entitlement?.founder === true || rolesOf(session).some((r) => ['administrator', 'admin'].includes(r)); }
function isMentor(session) { return rolesOf(session).some((r) => ['mentor', 'coach', 'faculty', 'teacher'].includes(r)); }
function displayName(session) { return safeText(session?.user?.displayName || session?.user?.login || 'MissionMed student', 120); }

function securityHeaders(mediaBase, extra = {}) {
  let mediaOrigin = '';
  try { mediaOrigin = new URL(mediaBase).origin; } catch {}
  const connect = [`'self'`, mediaOrigin].filter(Boolean).join(' ');
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'self'; connect-src ${connect}; img-src 'self' data: blob:; media-src 'self' blob: ${mediaOrigin}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(self), microphone=(self)',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...extra,
  };
}

function sendJson(response, status, payload, mediaBase) {
  response.writeHead(status, securityHeaders(mediaBase, { 'Content-Type': 'application/json; charset=utf-8' }));
  response.end(JSON.stringify(payload));
}

function sendError(response, status, code, mediaBase) { sendJson(response, status, { error: code }, mediaBase); }

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!bytes) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('invalid_json'), { status: 400 });
  return value;
}

function staticPath(pathname, root = STATIC_ROOT, prefix = UI_PREFIX) {
  let name = pathname === prefix || pathname === `${prefix}/`
    ? 'index.html' : pathname.slice(`${prefix}/`.length);
  try { name = decodeURIComponent(name); } catch { return null; }
  if (!name || name.includes('\0') || isAbsolute(name)) return null;
  const file = normalize(join(root, name));
  const rel = relative(root, file);
  if (rel.startsWith('..') || isAbsolute(rel) || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

function publicRecording(row) {
  if (!row) return null;
  return {
    id: row.id, sessionId: row.session_id, status: row.status, mime: row.mime_type,
    sizeBytes: row.size_bytes, durationMs: row.duration_ms, sealedAt: row.sealed_at,
    createdAt: row.created_at,
  };
}

function publicSession(row, recording = null, result = null, review = null) {
  return {
    id: row.id, title: row.title, sessionType: row.session_type, questionId: row.question_id,
    questionText: row.question_text, state: row.state, startedAt: row.started_at,
    endedAt: row.ended_at, durationMs: row.duration_ms,
    interviewerProvider: row.interviewer_provider, recording: publicRecording(recording),
    results: result ? { schema: result.schema_name, schemaVersion: result.schema_version, payload: result.payload, summary: result.summary } : null,
    reviewStatus: review?.status || null,
  };
}

function extensionForMime(mime) { return String(mime || '').includes('mp4') ? 'mp4' : 'webm'; }

export function createIvocHandler({
  registry = admissionRegistry,
  repository = null,
  storage = null,
  now = () => Date.now(),
  env = process.env,
} = {}) {
  const mediaBase = String(env.MMHQ_MEDIA_UPLOAD_BASE || env.MMHQ_CIE_BASE || 'https://cdn.missionmedinstitute.com').replace(/\/+$/u, '');
  const db = repository || createIvocRepository({
    baseUrl: env.IVPREP_SUPABASE_URL,
    serviceRoleKey: env.IVPREP_SUPABASE_SERVICE_ROLE_KEY,
  });
  const media = storage || createIvocStorage({ mediaBase, sessionSecret: env.MMHQ_SESSION_SECRET });
  const enabled = bool(env.IVPREP_ENABLED) && bool(env.IVPREP_ADMIN_CANARY_ENABLED);
  const requireHead = bool(env.IVOC_REQUIRE_MEDIA_HEAD, false);

  async function audit({ actor, owner = null, sessionId = null, recordingId = null, action, decision, reason }) {
    await db.insert('ivoc_access_log', {
      actor_subject: actor || null, owner_subject: owner || null, session_id: sessionId,
      recording_id: recordingId, action, decision, reason,
    }).catch(() => null);
  }

  async function canReadSession({ row, actor, session, admission }) {
    if (!row) return false;
    if (row.owner_subject === actor || isAdmin(session, admission)) return true;
    if (!isMentor(session)) return false;
    const assignment = await db.single(`ivoc_reviews?session_id=eq.${encodeURIComponent(row.id)}&mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=id&limit=1`);
    return Boolean(assignment);
  }

  return async function handleIvocRequest({ request, response, url, hqSession, cookieFingerprint, hqSessionMaxTtlSeconds, expectedOrigin } = {}) {
    const pathname = url?.pathname || '/';
    if (!(pathname === UI_PREFIX || pathname.startsWith(`${UI_PREFIX}/`) || pathname.startsWith(`${ANALYTICS_PREFIX}/`) || pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`))) return false;
    if (request.headers.authorization || request.headers.Authorization) { sendError(response, 401, 'ivprep_authentication_required', mediaBase); return true; }
    if (!enabled) { sendError(response, 503, 'ivprep_unavailable', mediaBase); return true; }

    try { await registry.refreshSubject?.({ hqSession, cookieFingerprint }); }
    catch { sendError(response, 503, 'ivprep_admission_unavailable', mediaBase); return true; }
    const admission = strictProjectHqSession({ request, hqSession, cookieFingerprint, registry, now: now(), maxSessionTtlSeconds: hqSessionMaxTtlSeconds });
    if (!admission.ok) { sendError(response, admission.status || 401, admission.code || 'ivprep_authentication_required', mediaBase); return true; }
    const actor = admission.subject;

    if (pathname === UI_PREFIX) { response.writeHead(308, securityHeaders(mediaBase, { Location: `${UI_PREFIX}/` })); response.end(); return true; }
    if (pathname.startsWith(`${UI_PREFIX}/`)) {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, securityHeaders(mediaBase, { Allow: 'GET, HEAD' })); response.end(); return true; }
      const file = staticPath(pathname);
      if (!file) { sendError(response, 404, 'not_found', mediaBase); return true; }
      response.writeHead(200, securityHeaders(mediaBase, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' }));
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
      return true;
    }

    if (pathname.startsWith(`${ANALYTICS_PREFIX}/`)) {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, securityHeaders(mediaBase, { Allow: 'GET, HEAD' })); response.end(); return true; }
      const file = staticPath(pathname, ANALYTICS_ROOT, ANALYTICS_PREFIX);
      if (!file) { sendError(response, 404, 'not_found', mediaBase); return true; }
      response.writeHead(200, securityHeaders(mediaBase, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' }));
      if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
      return true;
    }

    if (!pathname.startsWith(`${API_PREFIX}/`)) { sendError(response, 404, 'not_found', mediaBase); return true; }
    if (!['GET', 'HEAD'].includes(request.method)) {
      const mutation = validateIvPrepMutation({ request, admission, expectedOrigin });
      if (!mutation.ok) { sendError(response, mutation.status || 403, mutation.code || 'ivprep_admission_denied', mediaBase); return true; }
    }

    try {
      if (request.method === 'GET' && pathname === `${API_PREFIX}/bootstrap`) {
        const preferences = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*&limit=1`);
        sendJson(response, 200, {
          identity: { subject: actor, displayName: displayName(hqSession), roles: rolesOf(hqSession), admin: isAdmin(hqSession, admission), mentor: isMentor(hqSession) },
          entitlement: { admitted: true, founder: admission.entitlement?.founder === true, voice: true, video: admission.entitlement?.video === true },
          csrfToken: admission.csrfToken,
          preferences: preferences ? { calibration: preferences.calibration, visibility: preferences.visibility, coachingEnabled: preferences.coaching_enabled, recordingDefault: preferences.recording_default } : null,
        }, mediaBase);
        return true;
      }

      if (request.method === 'POST' && pathname === `${API_PREFIX}/sessions`) {
        const input = await readJson(request);
        const row = await db.insert('ivoc_sessions', {
          owner_subject: actor, owner_display_name: displayName(hqSession),
          title: safeText(input.title, 200) || 'IV Prep practice session',
          session_type: ['question', 'quick', 'mock'].includes(input.sessionType) ? input.sessionType : 'question',
          question_id: safeText(input.questionId, 120) || null,
          question_text: safeText(input.questionText, 1000) || null,
          interviewer_provider: safeText(input.interviewerProvider, 80) || 'missionmed-static',
          analytics_schema: input.analyticsSchema === 'ivoc.analytics.v1' ? input.analyticsSchema : 'ivoc.analytics.v1',
          recording_enabled: input.recordingEnabled !== false,
          calibration_snapshot: input.calibration && typeof input.calibration === 'object' ? input.calibration : {},
          context: input.context && typeof input.context === 'object' ? input.context : {},
        });
        await audit({ actor, owner: actor, sessionId: row.id, action: 'session_create', decision: 'allow', reason: 'owner' });
        sendJson(response, 201, publicSession(row), mediaBase); return true;
      }

      let match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/recordings$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) { await audit({ actor, sessionId, action: 'recording_create', decision: 'deny', reason: 'not_owner' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const recordingId = randomUUID();
        const upload = media.createUpload({ ownerSubject: actor, recordingId, extension: extensionForMime(input.mime) });
        const row = await db.insert('ivoc_recordings', {
          id: recordingId, session_id: sessionId, owner_subject: actor, storage_object_key: upload.objectKey,
          status: 'uploading', mime_type: safeText(input.mime, 120) || 'video/webm',
        });
        sendJson(response, 201, { ...publicRecording(row), uploadUrl: upload.uploadUrl, uploadToken: upload.uploadToken, uploadExpiresAt: upload.expiresAt, uploadExpiresAtMs: upload.tokenExpiresAtMs }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/seal$/u);
      if (request.method === 'POST' && match) {
        const recordingId = match[1];
        const row = await db.single(`ivoc_recordings?id=eq.${recordingId}&select=*&limit=1`);
        if (!row || row.owner_subject !== actor) { await audit({ actor, recordingId, action: 'recording_seal', decision: 'deny', reason: 'not_owner' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const tokenValid = media.validateUploadToken({ recordingId, objectKey: row.storage_object_key, expiresAtMs: Number(input.uploadExpiresAtMs), uploadToken: input.uploadToken });
        if (!tokenValid) { sendError(response, 403, 'recording_upload_token_invalid', mediaBase); return true; }
        if (requireHead && !(await media.verifyObject(row.storage_object_key))) { sendError(response, 409, 'recording_media_not_confirmed', mediaBase); return true; }
        const saved = await db.update(`ivoc_recordings?id=eq.${recordingId}&owner_subject=eq.${encodeURIComponent(actor)}&select=*`, {
          status: 'saved', size_bytes: Math.max(0, Math.trunc(Number(input.sizeBytes) || 0)),
          duration_ms: Math.max(0, Math.trunc(Number(input.durationMs) || 0)), mime_type: safeText(input.mime, 120) || row.mime_type,
          sealed_at: new Date(now()).toISOString(), paused_spans: Array.isArray(input.pausedSpans) ? input.pausedSpans : [],
        });
        await audit({ actor, owner: actor, sessionId: row.session_id, recordingId, action: 'recording_seal', decision: 'allow', reason: requireHead ? 'head_confirmed' : 'signed_upload_completed' });
        sendJson(response, 200, { recording: publicRecording(saved) }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/results$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        if (!sessionRow || sessionRow.owner_subject !== actor) { sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        if (input.schema !== 'ivoc.analytics.v1' || Number(input.schemaVersion) !== 1) { sendError(response, 400, 'analytics_schema_invalid', mediaBase); return true; }
        const existing = await db.single(`ivoc_results?session_id=eq.${sessionId}&select=id&limit=1`);
        const payload = { owner_subject: actor, schema_name: input.schema, schema_version: 1, payload: input, summary: { scores: input.scores || {}, counters: input.counters || {} } };
        const result = existing
          ? await db.update(`ivoc_results?id=eq.${existing.id}&select=*`, payload)
          : await db.insert('ivoc_results', { session_id: sessionId, ...payload });
        const durationMs = Math.max(0, Math.trunc(Number(input.durationMs || input.history?.at(-1)?.t * 1000) || 0));
        await db.update(`ivoc_sessions?id=eq.${sessionId}&owner_subject=eq.${encodeURIComponent(actor)}&select=*`, { state: 'saved', ended_at: new Date(now()).toISOString(), duration_ms: durationMs });
        sendJson(response, 200, { id: result.id, sessionId, schema: result.schema_name, schemaVersion: result.schema_version }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})\/review$/u);
      if (request.method === 'POST' && match) {
        const sessionId = match[1];
        const sessionRow = await db.single(`ivoc_sessions?id=eq.${sessionId}&select=*&limit=1`);
        const admin = isAdmin(hqSession, admission);
        const assigned = await db.single(`ivoc_reviews?session_id=eq.${sessionId}&mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=*&limit=1`);
        if (!sessionRow || (!admin && (!isMentor(hqSession) || !assigned))) { await audit({ actor, owner: sessionRow?.owner_subject, sessionId, action: 'review_complete', decision: 'deny', reason: 'not_assigned' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const input = await readJson(request);
        const body = { status: 'reviewed', reviewed_at: new Date(now()).toISOString(), notes: Array.isArray(input.notes) ? input.notes.slice(0, 100) : [] };
        const row = assigned
          ? await db.update(`ivoc_reviews?id=eq.${assigned.id}&select=*`, body)
          : await db.insert('ivoc_reviews', { session_id: sessionId, owner_subject: sessionRow.owner_subject, mentor_subject: actor, assigned_by_subject: actor, ...body });
        await audit({ actor, owner: sessionRow.owner_subject, sessionId, action: 'review_complete', decision: 'allow', reason: admin ? 'admin' : 'assigned_mentor' });
        sendJson(response, 200, { sessionId, reviewStatus: row.status, reviewedAt: row.reviewed_at }, mediaBase); return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/library`) {
        const scope = url.searchParams.get('scope') || 'own';
        let rows;
        if (scope === 'all' && isAdmin(hqSession, admission)) rows = await db.request('ivoc_sessions?select=*&order=created_at.desc&limit=200');
        else if (scope === 'assigned' && (isMentor(hqSession) || isAdmin(hqSession, admission))) {
          const reviews = isAdmin(hqSession, admission)
            ? await db.request('ivoc_reviews?status=neq.revoked&select=session_id')
            : await db.request(`ivoc_reviews?mentor_subject=eq.${encodeURIComponent(actor)}&status=neq.revoked&select=session_id`);
          const ids = [...new Set(reviews.map((r) => r.session_id))];
          rows = ids.length ? await db.request(`ivoc_sessions?id=in.(${ids.join(',')})&select=*&order=created_at.desc&limit=200`) : [];
        } else rows = await db.request(`ivoc_sessions?owner_subject=eq.${encodeURIComponent(actor)}&select=*&order=created_at.desc&limit=200`);
        const ids = rows.map((r) => r.id);
        const recordings = ids.length ? await db.request(`ivoc_recordings?session_id=in.(${ids.join(',')})&select=*`) : [];
        const results = ids.length ? await db.request(`ivoc_results?session_id=in.(${ids.join(',')})&select=*`) : [];
        const reviews = ids.length ? await db.request(`ivoc_reviews?session_id=in.(${ids.join(',')})&status=neq.revoked&select=session_id,status,mentor_subject`) : [];
        sendJson(response, 200, { sessions: rows.map((row) => publicSession(row, recordings.find((x) => x.session_id === row.id), results.find((x) => x.session_id === row.id), reviews.find((x) => x.session_id === row.id))) }, mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/sessions\/([0-9a-f-]{36})$/u);
      if (request.method === 'GET' && match) {
        const row = await db.single(`ivoc_sessions?id=eq.${match[1]}&select=*&limit=1`);
        if (!(await canReadSession({ row, actor, session: hqSession, admission }))) { await audit({ actor, owner: row?.owner_subject, sessionId: match[1], action: 'session_read', decision: 'deny', reason: 'scope' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const recording = await db.single(`ivoc_recordings?session_id=eq.${row.id}&select=*&limit=1`);
        const result = await db.single(`ivoc_results?session_id=eq.${row.id}&select=*&limit=1`);
        await audit({ actor, owner: row.owner_subject, sessionId: row.id, action: 'session_read', decision: 'allow', reason: row.owner_subject === actor ? 'owner' : 'authorized_review' });
        sendJson(response, 200, publicSession(row, recording, result), mediaBase); return true;
      }

      match = pathname.match(/^\/api\/ivoc\/v1\/recordings\/([0-9a-f-]{36})\/playback-url$/u);
      if (request.method === 'GET' && match) {
        const recording = await db.single(`ivoc_recordings?id=eq.${match[1]}&status=eq.saved&select=*&limit=1`);
        const sessionRow = recording ? await db.single(`ivoc_sessions?id=eq.${recording.session_id}&select=*&limit=1`) : null;
        if (!recording || !(await canReadSession({ row: sessionRow, actor, session: hqSession, admission }))) { await audit({ actor, owner: recording?.owner_subject, recordingId: match[1], action: 'recording_playback', decision: 'deny', reason: 'scope' }); sendError(response, 404, 'not_found', mediaBase); return true; }
        const signed = media.signedUrl(recording.storage_object_key, 10 * 60 * 1000);
        await audit({ actor, owner: recording.owner_subject, sessionId: recording.session_id, recordingId: recording.id, action: 'recording_playback', decision: 'allow', reason: recording.owner_subject === actor ? 'owner' : 'authorized_review' });
        sendJson(response, 200, { recordingId: recording.id, url: signed.url, expiresAt: signed.expiresAt, disposition: url.searchParams.get('disposition') === 'attachment' ? 'attachment' : 'inline' }, mediaBase); return true;
      }

      if (request.method === 'GET' && pathname === `${API_PREFIX}/preferences`) {
        const row = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*&limit=1`);
        sendJson(response, 200, row ? { calibration: row.calibration, visibility: row.visibility, coachingEnabled: row.coaching_enabled, recordingDefault: row.recording_default } : null, mediaBase); return true;
      }
      if (request.method === 'PUT' && pathname === `${API_PREFIX}/preferences`) {
        const input = await readJson(request);
        const existing = await db.single(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=owner_subject&limit=1`);
        const body = { calibration: input.calibration && typeof input.calibration === 'object' ? input.calibration : {}, visibility: input.visibility && typeof input.visibility === 'object' ? input.visibility : {}, coaching_enabled: input.coachingEnabled !== false, recording_default: input.recordingDefault !== false };
        const row = existing ? await db.update(`ivoc_preferences?owner_subject=eq.${encodeURIComponent(actor)}&select=*`, body) : await db.insert('ivoc_preferences', { owner_subject: actor, ...body });
        sendJson(response, 200, { calibration: row.calibration, visibility: row.visibility, coachingEnabled: row.coaching_enabled, recordingDefault: row.recording_default }, mediaBase); return true;
      }

      sendError(response, 404, 'not_found', mediaBase); return true;
    } catch (error) {
      const status = Number(error?.status) || (error instanceof SyntaxError ? 400 : 500);
      const code = status >= 500 ? 'ivoc_internal_error' : safeText(error?.message, 100) || 'ivoc_request_failed';
      const requestId = randomUUID();
      console.error(JSON.stringify({ event: 'ivoc_request_error', requestId, path: pathname, code, detailHash: createHash('sha256').update(String(error?.detail || '')).digest('hex').slice(0, 16) }));
      sendJson(response, status, { error: code, requestId }, mediaBase); return true;
    }
  };
}

let defaultHandler = null;
export async function handleIvocRequest(input) {
  if (!defaultHandler) defaultHandler = createIvocHandler();
  return defaultHandler(input);
}
