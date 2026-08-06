import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, issueDevToken, isLoopbackRequest } from './auth.mjs';
import { config, isAudioConfigured, validateConfig } from './config.mjs';
import {
  appendAudit,
  appendServiceAudit,
  closePool,
  healthCheck,
  pool,
  withIdentity as withDatabaseIdentity,
  withServiceTransaction,
} from './db.mjs';
import { createFlagService, createPostgresFlagStore } from './flags.mjs';
import { createAdminConsoleService } from './admin-console.mjs';
import { createProductConfigurationService } from './product-configuration.mjs';
import { createStoryMediaService } from './story-media.mjs';
import { createMentorNotesService } from './mentor-notes.mjs';
import { previewImport } from './imports.mjs';
import {
  createAudioPlayback,
  createAudioUpload,
  createStoryMediaUpload,
  createR2StorageClient,
  copyAudioObject,
  deleteAudioObject,
  deleteAudioAssetObject,
  deleteRecordingPrefix,
  deleteRecordingObjects,
  getRecordingSegment,
  headAudioObject,
  listAudioObjects,
  listAudioObjectsPage,
  putRecordingSegment,
  readAudioControlObject,
  promoteStoryMediaObject,
  storyMediaSpec,
  verifyAudioUpload,
  verifyStoryMediaUpload,
  writeAudioControlObject,
} from './storage.mjs';
import {
  createPostgresRecordingStore,
  createRecordingsService,
} from './recordings.mjs';
import {
  createTranscriptionAdapterForProvider,
  createUnavailableTranscriptionAdapter,
} from './transcription/adapter.mjs';
import {
  createOptionAAssemblyExecutor,
  createOptionBAssemblyExecutor,
} from './assembly/executors.mjs';
import { createReconciliationService } from './reconciliation.mjs';
import { startReconciliationScheduler } from './reconciliation-scheduler.mjs';

// A 5 MB CSV/XLSX expands to roughly 6.7 MB when carried as base64 JSON.
const jsonLimit = 8 * 1024 * 1024;
const multipartLimit = (5 * 1024 * 1024) + (128 * 1024);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
]);

function authorityBlockedAssembly() {
  const error = new Error(
    'Recording assembly is unavailable until the RP-8 architecture decision is approved.',
  );
  error.code = 'assembly_authority_blocked';
  error.status = 503;
  throw error;
}

export function createAssemblyExecutorForEnvironment({
  environment = process.env,
  serviceTransaction = withServiceTransaction,
  storage = {
    getRecordingSegment,
    headAudioObject,
    putRecordingSegment,
  },
} = {}) {
  const executor = String(environment.STORYFORGE_ASSEMBLY_EXECUTOR || '')
    .trim()
    .toLowerCase();
  const loadSegments = ({ studentId, recordingId }) => serviceTransaction(async (client) => {
    const result = await client.query(
      `SELECT segment.seq, segment.mime_type, segment.object_key
         FROM public.sf_recording_segments segment
         JOIN public.sf_recording_sessions session
           ON session.id = segment.session_id
        WHERE session.id = $1
          AND session.student_id = $2
        ORDER BY segment.seq`,
      [recordingId, studentId],
    );
    return result.rows;
  });
  if (executor === 'concat') {
    return createOptionAAssemblyExecutor({
      loadSegments,
      getObject: storage.getRecordingSegment,
      putObject: storage.putRecordingSegment,
    });
  }
  if (executor === 'copy') {
    return createOptionBAssemblyExecutor({
      loadSegments,
      headObject: storage.headAudioObject,
    });
  }
  return Object.freeze({
    available: false,
    option: null,
    assembleRecording: authorityBlockedAssembly,
  });
}

function emitStructuredEvent(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function emitStructuredError(event) {
  process.stderr.write(`${JSON.stringify(event)}\n`);
}

export function safeRequestFailureEvent(failure, now = new Date()) {
  const code = String(failure?.code || '');
  const errorCategory = code.includes('auth')
    || code.includes('token')
    || code.includes('identity')
    || code.includes('denied')
    || code.includes('required')
    ? 'auth'
    : code.includes('transcrib')
      ? 'transcribe'
      : code.includes('assembl')
        ? 'assembly'
        : code.includes('audio') || code.includes('storage')
          ? 'upload'
          : 'save';
  return Object.freeze({
    t: now.toISOString(),
    event: 'request_failed',
    status: Number(failure?.status) || 500,
    errorCategory,
  });
}

export function createPhaseOneRuntime({
  identityTransaction = withDatabaseIdentity,
  serviceTransaction = withServiceTransaction,
  auditWriter = appendAudit,
  serviceAuditWriter = appendServiceAudit,
  storage = {
    putRecordingSegment,
    getRecordingSegment,
    deleteRecordingObjects,
    deleteAudioAssetObject,
    copyAudioObject,
    headAudioObject,
    listAudioObjects,
    listAudioObjectsPage,
    readAudioControlObject,
    writeAudioControlObject,
    deleteAudioObject,
    deleteRecordingPrefix,
  },
  transcription = createUnavailableTranscriptionAdapter(),
  assembly = { available: false, assembleRecording: authorityBlockedAssembly },
  eventWriter = emitStructuredEvent,
  environment = process.env,
} = {}) {
  const flagStore = createPostgresFlagStore({
    withIdentity: identityTransaction,
    withServiceTransaction: serviceTransaction,
    appendAudit: auditWriter,
    appendServiceAudit: serviceAuditWriter,
  });
  const flagService = createFlagService({
    store: flagStore,
    environment,
    allowEligibleAll: true,
    emitEvent: eventWriter,
  });
  const recordingStore = createPostgresRecordingStore({
    withIdentity: identityTransaction,
    withServiceTransaction: serviceTransaction,
    appendAudit: auditWriter,
    appendServiceAudit: serviceAuditWriter,
  });
  const recordingsService = createRecordingsService({
    store: recordingStore,
    flagService,
    storage,
    transcription,
    assembly,
    emitEvent: eventWriter,
    environment,
  });
  return Object.freeze({ flagService, recordingsService, transcription });
}

const defaultPhaseOneRuntime = createPhaseOneRuntime();

function importReviewFingerprint(rows) {
  const contract = rows.map((row) => ({
    rowNumber: row.rowNumber,
    text: row.text,
    exactDuplicateId: row.exactDuplicateId,
    nearDuplicateId: row.nearDuplicateId,
    formulaLike: row.formulaLike,
    error: row.error,
  }));
  return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function exactHttpOrigin(value) {
  try {
    const parsed = new URL(String(value || ''));
    return (
      ['http:', 'https:'].includes(parsed.protocol)
      && !parsed.username
      && !parsed.password
    ) ? parsed.origin : '';
  } catch {
    return '';
  }
}

export function storyForgeContentSecurityPolicy({
  matrixOrigin,
  audioOrigin = '',
} = {}) {
  const exactAudioOrigin = exactHttpOrigin(audioOrigin);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    `img-src 'self' data:${exactAudioOrigin ? ` ${exactAudioOrigin}` : ''}`,
    `media-src 'self' blob:${exactAudioOrigin ? ` ${exactAudioOrigin}` : ''}`,
    `connect-src 'self'${exactAudioOrigin ? ` ${exactAudioOrigin}` : ''}`,
    "font-src 'self'",
    `frame-ancestors 'self' ${matrixOrigin}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function setSecurityHeaders(response) {
  const matrixOrigin = new URL(config.matrixBaseUrl).origin;
  response.setHeader('Content-Security-Policy', storyForgeContentSecurityPolicy({
    matrixOrigin,
    audioOrigin: config.r2.endpoint,
  }));
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'SAMEORIGIN');
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  response.setHeader('Cache-Control', 'no-store');
}

function enforceAllowedOrigin(request, response) {
  const origin = String(request.headers.origin || '').trim();
  if (!origin) return;
  let normalized = '';
  try {
    normalized = new URL(origin).origin;
  } catch {
    normalized = '';
  }
  if (!normalized || !config.allowedOrigins.includes(normalized)) {
    const error = new Error('This origin is not allowed to call StoryForge.');
    error.code = 'origin_not_allowed';
    throw error;
  }
  response.setHeader('Access-Control-Allow-Origin', normalized);
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

export function publicError(error) {
  const databaseStatus = {
    '22023': 400,
    '22P02': 400,
    '23514': 409,
    '23505': 409,
    '40001': 409,
    '42501': 403,
    P0002: 404,
  }[error?.code];
  const authCodes = new Set([
    'auth_required',
    'ERR_JWT_EXPIRED',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
  ]);
  const forbiddenCodes = new Set([
    'admin_required',
    'eligibility_required',
    'invalid_role_claim',
    'invalid_subject_claim',
    'invalid_token_identifier_claim',
    'invalid_wp_user_id_claim',
    'dev_auth_unavailable',
    'ai_feature_gated',
    'origin_not_allowed',
    'recording_access_denied',
    'student_required',
    'voice_disabled',
  ]);
  const inputCodes = new Set([
    'invalid_identifier',
    'invalid_json',
    'invalid_audio_size',
    'invalid_multipart',
    'invalid_recording_duration',
    'invalid_segment_duration',
    'invalid_segment_sequence',
    'invalid_voice_allowlist',
    'invalid_voice_cohort',
    'invalid_voice_scope',
    'invalid_voice_scope_values',
    'import_preview_stale',
    'malformed_csv',
    'malformed_xlsx',
    'request_failed',
    'too_many_import_rows',
    'unsupported_audio_format',
    'unsupported_import_format',
    'unknown_fixture_identity',
  ]);
  const unavailableCodes = new Set([
    'ai_provider_unconfigured',
    'audio_storage_unavailable',
    'audio_verification_failed',
    'voice_flag_unavailable',
  ]);
  const joseAuthFailure = /^ERR_(?:JOSE|JWS|JWT)_/.test(String(error?.code || ''));
  const declaredStatus = Number.isInteger(error?.status)
    && error.status >= 400
    && error.status <= 599
    ? error.status
    : null;
  const status = databaseStatus
    || declaredStatus
    || (authCodes.has(error?.code) || joseAuthFailure ? 401 : null)
    || (forbiddenCodes.has(error?.code) ? 403 : null)
    || (['request_too_large', 'import_too_large'].includes(error?.code) ? 413 : null)
    || (inputCodes.has(error?.code) ? 400 : null)
    || (unavailableCodes.has(error?.code) ? 503 : null)
    || 500;
  return {
    status,
    code: String(error?.code || 'request_failed'),
    message: status >= 500 && !unavailableCodes.has(error?.code)
      ? 'StoryForge could not complete this request.'
      : String(error?.message || 'Request failed.'),
    ...(Number.isInteger(error?.retryAfterMs) && error.retryAfterMs > 0
      ? { retryAfterMs: error.retryAfterMs }
      : {}),
  };
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > jsonLimit) {
      const error = new Error('Request exceeds the 8 MB limit.');
      error.code = 'request_too_large';
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.code = 'invalid_json';
    throw error;
  }
}

async function readMultipartSegment(request) {
  const contentType = String(request.headers['content-type'] || '');
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    const error = new Error('Audio segments must use multipart form data.');
    error.code = 'invalid_multipart';
    throw error;
  }
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > multipartLimit) {
    const error = new Error('Audio segments may not exceed 5 MB.');
    error.code = 'segment_too_large';
    error.status = 413;
    throw error;
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > multipartLimit) {
      const error = new Error('Audio segments may not exceed 5 MB.');
      error.code = 'segment_too_large';
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  let form;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'content-type': contentType },
    }).formData();
  } catch {
    const error = new Error('Audio segment form data is malformed.');
    error.code = 'invalid_multipart';
    throw error;
  }
  const segment = form.get('segment');
  if (!segment || typeof segment.arrayBuffer !== 'function') {
    const error = new Error('An audio segment is required.');
    error.code = 'invalid_audio_size';
    throw error;
  }
  return {
    seq: form.get('seq'),
    durationMs: form.get('durationMs'),
    expectedVersion: form.get('expectedVersion'),
    mimeType: String(form.get('mimeType') || segment.type || ''),
    buffer: Buffer.from(await segment.arrayBuffer()),
  };
}

function safeUuid(value) {
  const uuid = String(value || '');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(uuid)) {
    const error = new Error('A valid resource identifier is required.');
    error.code = 'invalid_identifier';
    throw error;
  }
  return uuid;
}

function storyProjection(prefix = '') {
  const p = prefix ? `${prefix}.` : '';
  return `${p}id, ${p}student_id, ${p}title, ${p}original_text, ${p}current_text,
    ${p}capture_type, ${p}status, ${p}student_score, ${p}mentor_score,
    ${p}review_suitability,
    ${p}classification, ${p}starred, ${p}needs_followup, ${p}categories, ${p}uses,
    (SELECT count(*)::integer
       FROM public.sf_story_questions projection_pair
      WHERE projection_pair.story_id = ${p}id
        AND projection_pair.state IN ('suggested', 'confirmed')) AS question_count,
    (SELECT projection_audio.id
       FROM public.sf_audio_assets projection_audio
      WHERE projection_audio.story_id = ${p}id
        AND projection_audio.state = 'verified'
      ORDER BY projection_audio.verified_at DESC, projection_audio.created_at DESC
      LIMIT 1) AS audio_asset_id,
    (SELECT projection_audio.duration_ms
       FROM public.sf_audio_assets projection_audio
      WHERE projection_audio.story_id = ${p}id
        AND projection_audio.state = 'verified'
      ORDER BY projection_audio.verified_at DESC, projection_audio.created_at DESC
      LIMIT 1) AS audio_duration_ms,
    ${p}prefix_enabled, ${p}lesson, ${p}themes, ${p}student_star,
    ${p}mentor_star, ${p}birds, ${p}positions, ${p}revised,
    ${p}reviewed_by,
    (SELECT reviewer.display_name
       FROM public.sf_users reviewer
      WHERE reviewer.id = ${p}reviewed_by) AS reviewed_by_name,
    (SELECT reviewer.role
       FROM public.sf_users reviewer
      WHERE reviewer.id = ${p}reviewed_by) AS reviewed_by_role,
    ${p}row_version, ${p}revision_no,
    ${p}submitted_at, ${p}last_submitted_at, ${p}opened_at,
    ${p}reviewed_at, ${p}approved_at, ${p}student_updated_at,
    ${p}status_changed_at, ${p}feedback_sent_at, ${p}feedback_opened_at,
    ${p}student_responded_at, ${p}archived_at, ${p}created_at, ${p}updated_at`;
}

async function requireDatabaseRole(client, roles) {
  const result = await client.query(
    `SELECT public.sf_has_live_identity($1::text[]) AS allowed`,
    [roles],
  );
  if (!result.rows[0]?.allowed) {
    const error = new Error('This StoryForge role cannot use that surface.');
    error.code = '42501';
    throw error;
  }
}

function agendaTitle(value, maxLength = 72) {
  const title = String(value || '').trim();
  return title.length <= maxLength ? title : `${title.slice(0, maxLength - 1).trimEnd()}…`;
}

export function defaultStoryAgendaItems(stories = []) {
  return stories.flatMap((story) => {
    const title = agendaTitle(story.title || 'Untitled story');
    if (story.status === 'awaiting' && story.revised) {
      return [{
        label: `Re-review the revision of “${title}”`,
        storyId: story.id,
        route: '/library',
      }];
    }
    if (story.status === 'awaiting') {
      return [{
        label: `First review: “${title}”`,
        storyId: story.id,
        route: '/library',
      }];
    }
    if (story.status === 'changes') {
      return [{
        label: `Walk through requested changes on “${title}”`,
        storyId: story.id,
        route: '/library',
      }];
    }
    if (!story.mentor_score) {
      return [{
        label: `Score “${title}”`,
        storyId: story.id,
        route: '/library',
      }];
    }
    return [{
      label: `Discuss “${title}”`,
      storyId: story.id,
      route: '/library',
    }];
  });
}

export function defaultQuestionAgendaItems(questions = []) {
  return questions.map((question) => {
    const text = agendaTitle(question.text);
    const pairCount = Number(question.pair_count || 0);
    const confirmedCount = Number(question.confirmed_count || 0);
    const followupCount = Number(question.followup_count || 0);
    const preparedFollowupCount = Number(question.prepared_followup_count || 0);
    let label = `Finish follow-up prep for “${text}”`;
    if (!pairCount) label = `Find a story for “${text}”`;
    else if (!confirmedCount) label = `Confirm the strongest story for “${text}”`;
    else if (!question.preferred_story_id) label = `Choose the preferred story for “${text}”`;
    else if (!followupCount) label = `Prepare a follow-up for “${text}”`;
    else if (preparedFollowupCount >= followupCount) return null;
    return {
      label,
      questionId: question.id,
      route: '/prep',
    };
  }).filter(Boolean);
}

async function api(request, response, url, {
  authorizeRequest,
  auditWriter,
  emitEvent,
  withIdentity,
  flagService,
  adminConsoleService,
  productConfigurationService,
  storyMediaService,
  mentorNotesService,
  recordingsService,
  signAudioPlayback,
}) {
  if (request.method === 'GET' && url.pathname === '/api/config') {
    return sendJson(response, 200, {
      devAuth: config.devAuth && isLoopbackRequest(request),
      audioAvailable: isAudioConfigured(),
      ai: config.flags,
      identityMode: config.devAuth ? 'local-signed-fixture' : 'missionmed-signed-jwt',
      basePath: config.basePath,
      matrixBaseUrl: config.matrixBaseUrl,
      wpBootstrapPath: config.wpBootstrapPath,
      wpTokenPath: config.wpTokenPath,
      tokenRefreshSkewSeconds: config.tokenRefreshSkewSeconds,
      premiumMotion: config.premiumMotion,
    });
  }

  const devSession = url.pathname.match(/^\/api\/dev\/session\/([A-Za-z]+)$/);
  if (request.method === 'POST' && devSession) {
    const token = await issueDevToken(devSession[1], request);
    return sendJson(response, 200, { token, fixture: true });
  }

  const identity = await authorizeRequest(request);

  if (request.method === 'GET' && url.pathname === '/api/presentation') {
    return sendJson(response, 200, {
      configuration: await productConfigurationService.read(identity),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/console/content-display') {
    return sendJson(response, 200, {
      configuration: await productConfigurationService.read(identity),
    });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/console/content-display/validate') {
    return sendJson(response, 200, await productConfigurationService.validate(identity, await readJson(request)));
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/console/content-display/publish') {
    return sendJson(response, 200, {
      configuration: await productConfigurationService.publish(identity, await readJson(request)),
    });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/console/content-display/restore-defaults') {
    return sendJson(response, 200, {
      configuration: await productConfigurationService.restore(identity, await readJson(request)),
    });
  }

  const storyMediaCollection = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/media$/i);
  if (storyMediaCollection && request.method === 'GET') {
    return sendJson(response, 200, { media: await storyMediaService.list(identity, storyMediaCollection[1]) });
  }
  if (storyMediaCollection && request.method === 'POST') {
    return sendJson(response, 201, await storyMediaService.allocate(identity, {
      ...(await readJson(request)),
      storyId: storyMediaCollection[1],
    }));
  }
  const storyMediaItem = url.pathname.match(
    /^\/api\/story-media\/([a-f0-9-]+)(?:\/(verify|playback))?$/i,
  );
  if (storyMediaItem) {
    const mediaId = storyMediaItem[1];
    const action = storyMediaItem[2] || '';
    if (request.method === 'POST' && action === 'verify') {
      return sendJson(response, 200, { media: await storyMediaService.verify(identity, mediaId, await readJson(request)) });
    }
    if (request.method === 'GET' && action === 'playback') {
      return sendJson(response, 200, await storyMediaService.playback(identity, mediaId));
    }
    if (request.method === 'PATCH' && !action) {
      return sendJson(response, 200, { media: await storyMediaService.update(identity, mediaId, await readJson(request)) });
    }
    if (request.method === 'DELETE' && !action) {
      return sendJson(response, 200, await storyMediaService.remove(identity, mediaId));
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/recordings') {
    await readJson(request);
    const recording = await recordingsService.createRecording(identity);
    return sendJson(response, recording.created ? 201 : 200, recording);
  }

  const recordingRoute = url.pathname.match(
    /^\/api\/recordings\/([a-f0-9-]+)(?:\/(segments|finish|cancel|retry-transcription))?$/i,
  );
  if (recordingRoute) {
    const recordingId = safeUuid(recordingRoute[1]);
    const action = recordingRoute[2] || '';
    if (request.method === 'GET' && !action) {
      return sendJson(
        response,
        200,
        await recordingsService.getRecording(identity, recordingId),
      );
    }
    if (request.method === 'POST' && action === 'segments') {
      const segment = await recordingsService.addSegment(
        identity,
        recordingId,
        await readMultipartSegment(request),
      );
      return sendJson(response, segment.created ? 201 : 200, segment);
    }
    if (request.method === 'POST' && action === 'finish') {
      const result = await recordingsService.finishRecording(
        identity,
        recordingId,
        await readJson(request),
      );
      return sendJson(response, 200, result);
    }
    if (request.method === 'POST' && action === 'cancel') {
      await readJson(request);
      return sendJson(
        response,
        200,
        await recordingsService.cancelRecording(identity, recordingId),
      );
    }
    if (request.method === 'POST' && action === 'retry-transcription') {
      return sendJson(
        response,
        200,
        await recordingsService.retryTranscription(
          identity,
          recordingId,
          await readJson(request),
        ),
      );
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/features') {
    return sendJson(response, 200, await flagService.getAdminFeatures(identity));
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/features/voice_capture') {
    const flag = await flagService.updateVoiceCapture(identity, await readJson(request));
    return sendJson(response, 200, { flag });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/voice/health') {
    return sendJson(response, 200, await flagService.getVoiceHealth(identity));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/features/admin_console') {
    return sendJson(response, 200, { flag: await adminConsoleService.getFlag(identity) });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/features/admin_console') {
    return sendJson(response, 200, {
      flag: await adminConsoleService.updateFlag(identity, await readJson(request)),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/console/home') {
    return sendJson(response, 200, await adminConsoleService.home(
      identity,
      Object.fromEntries(url.searchParams),
    ));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/console/students') {
    return sendJson(response, 200, await adminConsoleService.students(
      identity,
      Object.fromEntries(url.searchParams),
    ));
  }

  const adminStudentRoute = url.pathname.match(/^\/api\/admin\/console\/students\/([a-f0-9-]+)$/i);
  if (request.method === 'GET' && adminStudentRoute) {
    return sendJson(response, 200, await adminConsoleService.student(
      identity,
      adminStudentRoute[1],
      Object.fromEntries(url.searchParams),
    ));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/console/queue') {
    return sendJson(response, 200, await adminConsoleService.queue(
      identity,
      Object.fromEntries(url.searchParams),
    ));
  }

  const adminStoryRoute = url.pathname.match(/^\/api\/admin\/console\/stories\/([a-f0-9-]+)(?:\/(review))?$/i);
  if (adminStoryRoute) {
    if (request.method === 'GET' && !adminStoryRoute[2]) {
      return sendJson(response, 200, await adminConsoleService.story(identity, adminStoryRoute[1]));
    }
    if (request.method === 'POST' && adminStoryRoute[2] === 'review') {
      return sendJson(response, 200, await adminConsoleService.review(
        identity,
        adminStoryRoute[1],
        await readJson(request),
      ));
    }
  }

  const adminStoryTaxonomy = url.pathname.match(
    /^\/api\/admin\/console\/stories\/([a-f0-9-]+)\/taxonomy$/i,
  );
  if (request.method === 'PATCH' && adminStoryTaxonomy) {
    return sendJson(response, 200, await adminConsoleService.taxonomy(
      identity,
      adminStoryTaxonomy[1],
      await readJson(request),
    ));
  }

  if (request.method === 'GET' && url.pathname === '/api/session') {
    const [user, voiceCapture, adminConsole, mentorNotes, mentorNotesRead, storyMedia, b1511, adminB1511] = await Promise.all([
      withIdentity(identity, async (client) => {
        const result = await client.query(
          `SELECT id, wp_user_id, display_name, first_name, pronouns, role, eligible,
             cohort, academic_year, specialty, application_cycle, background_preference,
             reading_size_preference
           FROM public.sf_users WHERE id = $1`,
          [identity.sub],
        );
        return result.rows[0] || null;
      }),
      flagService.voiceCapture(identity),
      adminConsoleService.capability(identity),
      mentorNotesService.capability(identity),
      mentorNotesService.readCapability(identity),
      Promise.resolve(storyMediaService.capability(identity)),
      withIdentity(identity, async (client) => {
        try {
          const result = await client.query('SELECT public.sf_b1_511_capabilities() AS payload');
          return result.rows[0]?.payload || {};
        } catch (error) {
          if (error?.code === '42883') return {};
          throw error;
        }
      }),
      identity.wordpressAdmin === true && identity.role !== 'admin'
        ? withIdentity(identity, async (client) => {
          try {
            const result = await client.query('SELECT public.sf_b1_511_capabilities() AS payload');
            return result.rows[0]?.payload || {};
          } catch (error) {
            if (error?.code === '42883') return {};
            throw error;
          }
        }, { adminMode: true })
        : Promise.resolve({}),
    ]);
    if (!user) {
      const error = new Error('StoryForge profile is missing or eligibility was revoked.');
      error.code = 'eligibility_required';
      throw error;
    }
    return sendJson(response, 200, {
      user: {
        ...user,
        first_name: identity.firstName,
        username: identity.username,
        wordpress_admin: identity.wordpressAdmin,
      },
      capabilities: {
        voiceCapture,
        adminConsole,
        mentorNotes,
        mentorNotesRead: mentorNotesRead && b1511.mentorNotesRead === true,
        storyMedia,
        submissionReview: b1511.submissionReview === true,
        taxonomy: b1511.taxonomy === true || adminB1511.taxonomy === true,
        inlinePriority: b1511.inlinePriority === true,
        storySearch: b1511.storySearch === true,
      },
    });
  }

  if (request.method === 'PATCH' && url.pathname === '/api/preferences/background') {
    const body = await readJson(request);
    const backgroundPreference = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT public.sf_set_background_preference($1) AS background_preference`,
        [body.background],
      );
      return result.rows[0]?.background_preference;
    });
    return sendJson(response, 200, { backgroundPreference });
  }

  if (request.method === 'PATCH' && url.pathname === '/api/preferences/text-size') {
    const body = await readJson(request);
    const textSize = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT public.sf_set_reading_size_preference($1) AS reading_size_preference`,
        [body.textSize],
      );
      return result.rows[0]?.reading_size_preference;
    });
    return sendJson(response, 200, { textSize });
  }

  if (request.method === 'GET' && url.pathname === '/api/stories') {
    const rows = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT ${storyProjection('s')}, u.display_name AS student_name
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         WHERE s.archived_at IS NULL
         ORDER BY s.updated_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { stories: rows });
  }

  if (request.method === 'POST' && url.pathname === '/api/stories') {
    const body = await readJson(request);
    if (body.recordingId) {
      const attached = await recordingsService.saveRecordingStory(
        identity,
        safeUuid(body.recordingId),
        body,
      );
      return sendJson(response, attached.created ? 201 : 200, {
        story: attached.story,
        audio: attached.attachment,
      });
    }
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_create_story_v5($1::jsonb, $2)`,
        [JSON.stringify(body), body.surface || 'quick'],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { story });
  }

  const storyRoute = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)$/i);
  if (request.method === 'GET' && storyRoute) {
    const id = safeUuid(storyRoute[1]);
    const detail = await withIdentity(identity, async (client) => {
      const storyResult = await client.query(
        `SELECT ${storyProjection('s')}, u.display_name AS student_name,
           EXISTS (
             SELECT 1
             FROM public.sf_mentor_assignments assignment
             WHERE assignment.student_id = s.student_id
               AND assignment.active
           ) AS mentor_review_available
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         WHERE s.id = $1`,
        [id],
      );
      if (!storyResult.rows[0]) return null;
      const [original, revisions, feedback, reflections, suggestions, mappings, craft, history] = await Promise.all([
        client.query(
          `SELECT original_transcript, audio_asset_id, capture_type, created_at
           FROM public.sf_story_originals WHERE story_id = $1`,
          [id],
        ),
        client.query(
          `SELECT id, revision_no, text_snapshot, title_snapshot, actor_id, reason, created_at
           FROM public.sf_story_revisions WHERE story_id = $1 ORDER BY created_at`,
          [id],
        ),
        client.query(
          `SELECT f.id, f.mentor_id, u.display_name AS reviewer_name,
             u.display_name AS mentor_name, u.role AS reviewer_role,
             f.body, f.disposition, f.created_at
           FROM public.sf_feedback f JOIN public.sf_users u ON u.id = f.mentor_id
           WHERE f.story_id = $1 ORDER BY f.created_at`,
          [id],
        ),
        client.query(
          `SELECT r.*, u.display_name AS author_name
           FROM public.sf_story_reflections r
           JOIN public.sf_users u ON u.id = r.author_id
           WHERE r.story_id = $1
           ORDER BY r.created_at`,
          [id],
        ),
        client.query(
          `SELECT s.*, u.display_name AS suggested_by_name
           FROM public.sf_use_suggestions s
           JOIN public.sf_users u ON u.id = s.suggested_by
           WHERE s.story_id = $1
           ORDER BY s.created_at`,
          [id],
        ),
        client.query(
          `SELECT sq.*, q.canonical_key, q.text AS question_text, q.family,
             pref.story_id = sq.story_id AS preferred,
             coalesce(
               (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', followup.id,
                     'text', followup.text,
                     'source', followup.source,
                     'clinical', followup.clinical,
                     'prepared', followup.prepared,
                     'note', followup.preparation_note,
                     'sortOrder', followup.sort_order,
                     'rowVersion', followup.row_version
                   )
                   ORDER BY followup.sort_order, followup.created_at
                 )
                 FROM public.sf_pair_followups followup
                 WHERE followup.story_question_id = sq.id
                   AND followup.removed_at IS NULL
               ),
               '[]'::jsonb
             ) AS followups
           FROM public.sf_story_questions sq JOIN public.sf_questions q ON q.id = sq.question_id
           LEFT JOIN public.sf_question_preferences pref
             ON pref.student_id = $2
            AND pref.question_id = sq.question_id
           WHERE sq.story_id = $1`,
          [id, storyResult.rows[0].student_id],
        ),
        client.query(
          `SELECT * FROM public.sf_story_craft WHERE story_id = $1`,
          [id],
        ),
        client.query(
          `SELECT id, actor_id, actor_role, actor_display, action, entity_type,
             entity_id, surface, detail, previous_value, new_value, created_at
           FROM public.sf_audit_events
           WHERE story_id = $1
           ORDER BY created_at DESC, id DESC`,
          [id],
        ),
      ]);
      return {
        story: storyResult.rows[0],
        original: original.rows[0] || null,
        revisions: revisions.rows,
        feedback: feedback.rows,
        reflections: reflections.rows,
        useSuggestions: suggestions.rows,
        questionMappings: mappings.rows,
        craft: craft.rows[0] || null,
        history: history.rows,
      };
    });
    if (!detail) {
      const error = new Error('Story not found.');
      error.code = 'P0002';
      throw error;
    }
    return sendJson(response, 200, detail);
  }

  if (request.method === 'PATCH' && storyRoute) {
    const id = safeUuid(storyRoute[1]);
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_update_story_v5($1, $2::jsonb, $3::bigint, $4)`,
        [id, JSON.stringify(body), body.expectedVersion ?? null, body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  const storyTaxonomy = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/taxonomy$/i);
  if (request.method === 'PATCH' && storyTaxonomy) {
    const id = safeUuid(storyTaxonomy[1]);
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_update_story_taxonomy_configured($1, $2, $3::text[], $4::text[], $5, false) AS story',
        [
          id,
          body.expectedVersion ?? null,
          body.categories ?? [],
          body.uses ?? [],
          body.surface || 'workspace',
        ],
      );
      return result.rows[0]?.story;
    });
    return sendJson(response, 200, { story });
  }

  const storyPriority = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/priority$/i);
  if (request.method === 'PATCH' && storyPriority) {
    const id = safeUuid(storyPriority[1]);
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        'SELECT public.sf_update_story_priority($1, $2, $3::smallint, $4) AS story',
        [id, body.expectedVersion ?? null, body.priority ?? null, body.surface || 'library'],
      );
      return result.rows[0]?.story;
    });
    return sendJson(response, 200, { story });
  }

  const storyMentorNotes = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/mentor-notes$/i);
  if (storyMentorNotes) {
    if (request.method === 'GET') {
      return sendJson(response, 200, {
        notes: await mentorNotesService.list(identity, storyMentorNotes[1], {
          reviewer: url.searchParams.get('reviewer') === '1',
        }),
      });
    }
    if (request.method === 'POST') {
      return sendJson(response, 201, {
        note: await mentorNotesService.create(
          identity,
          storyMentorNotes[1],
          await readJson(request),
        ),
      });
    }
  }

  const mentorNoteRoute = url.pathname.match(
    /^\/api\/mentor-notes\/([a-f0-9-]+)(?:\/(publish|discard|audio|playback))?$/i,
  );
  if (mentorNoteRoute) {
    const noteId = mentorNoteRoute[1];
    const action = mentorNoteRoute[2] || '';
    if (request.method === 'PATCH' && !action) {
      return sendJson(response, 200, {
        note: await mentorNotesService.update(identity, noteId, await readJson(request)),
      });
    }
    if (request.method === 'POST' && action === 'publish') {
      return sendJson(response, 200, {
        note: await mentorNotesService.publish(identity, noteId, await readJson(request)),
      });
    }
    if (request.method === 'POST' && action === 'discard') {
      return sendJson(response, 200, {
        note: await mentorNotesService.discard(identity, noteId, await readJson(request)),
      });
    }
    if (request.method === 'POST' && action === 'audio') {
      const audio = await readMultipartSegment(request);
      return sendJson(response, 200, {
        note: await mentorNotesService.uploadAudio(identity, noteId, {
          ...audio,
          buffer: audio.buffer,
          expectedVersion: audio.expectedVersion,
          surface: 'workspace',
        }),
      });
    }
    if (request.method === 'GET' && action === 'playback') {
      return sendJson(response, 200, await mentorNotesService.playback(identity, noteId));
    }
  }

  const storyAction = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/(submit|withdraw|open|review)$/i);
  if (request.method === 'POST' && storyAction) {
    const id = safeUuid(storyAction[1]);
    const action = storyAction[2];
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const queries = {
        submit: {
          text: `SELECT * FROM public.sf_submit_story($1, $2)`,
          values: [id, body.surface || 'workspace'],
        },
        withdraw: {
          text: `SELECT * FROM public.sf_withdraw_story($1, $2::bigint, $3)`,
          values: [id, body.expectedVersion ?? null, body.surface || 'workspace'],
        },
        open: {
          text: `SELECT * FROM public.sf_open_story($1, $2)`,
          values: [id, body.surface || 'quick'],
        },
        review: {
          text: `SELECT * FROM public.sf_review_story(
            $1, $2, $3, $4::smallint, $5::boolean, $6, $7
          )`,
          values: [
            id,
            body.feedback,
            body.status,
            body.mentorScore,
            Boolean(body.needsFollowup),
            body.classification || null,
            body.surface || 'workspace',
          ],
        },
      };
      const result = await client.query(queries[action]);
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  const storyStatus = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/status$/i);
  if (request.method === 'POST' && storyStatus) {
    const id = safeUuid(storyStatus[1]);
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_set_story_status($1, $2, $3)`,
        [id, body.status, body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  const storyFeedback = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/feedback$/i);
  if (request.method === 'POST' && storyFeedback) {
    const id = safeUuid(storyFeedback[1]);
    const body = await readJson(request);
    const feedback = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_add_story_feedback($1, $2, $3, $4)`,
        [id, body.body, body.disposition || 'feedback', body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { feedback });
  }

  const storyReflections = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/reflections$/i);
  if (request.method === 'POST' && storyReflections) {
    const id = safeUuid(storyReflections[1]);
    const body = await readJson(request);
    const reflection = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_add_story_reflection($1, $2, $3)`,
        [id, body.prompt, body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { reflection });
  }

  const storyUseSuggestions = url.pathname.match(
    /^\/api\/stories\/([a-f0-9-]+)\/use-suggestions$/i,
  );
  if (request.method === 'POST' && storyUseSuggestions) {
    const body = await readJson(request);
    const suggestion = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_set_use_suggestion($1, $2, $3, $4)`,
        [
          safeUuid(storyUseSuggestions[1]),
          body.useKey,
          body.active !== false,
          body.surface || 'workspace',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { suggestion });
  }

  const reflectionAnswer = url.pathname.match(/^\/api\/reflections\/([a-f0-9-]+)$/i);
  const reflectionAnswerAlias = url.pathname.match(
    /^\/api\/stories\/[a-f0-9-]+\/reflections\/([a-f0-9-]+)$/i,
  );
  if (request.method === 'PATCH' && (reflectionAnswer || reflectionAnswerAlias)) {
    const body = await readJson(request);
    const reflection = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_answer_story_reflection($1, $2, $3)`,
        [
          safeUuid((reflectionAnswer || reflectionAnswerAlias)[1]),
          body.answer,
          body.surface || 'workspace',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { reflection });
  }

  const storyEvaluation = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/evaluation$/i);
  if (request.method === 'PATCH' && storyEvaluation) {
    const id = safeUuid(storyEvaluation[1]);
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_update_story_evaluation($1, $2::jsonb, $3)`,
        [id, JSON.stringify(body), body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  const storyCraft = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/craft$/i);
  if (request.method === 'PATCH' && storyCraft) {
    const id = safeUuid(storyCraft[1]);
    const body = await readJson(request);
    const craft = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_update_story_craft($1, $2::jsonb, $3)`,
        [id, JSON.stringify(body), body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { craft });
  }

  const storyArchive = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/(archive|restore)$/i);
  if (request.method === 'POST' && storyArchive) {
    const body = await readJson(request);
    const storyId = safeUuid(storyArchive[1]);
    const archiving = storyArchive[2] === 'archive';
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_set_story_archived($1, $2, $3)`,
        [
          storyId,
          archiving,
          body.surface || 'library',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  if (request.method === 'GET' && url.pathname === '/api/drafts/story-builder') {
    const draft = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT payload, row_version, updated_at
         FROM public.sf_story_drafts
         WHERE user_id = $1`,
        [identity.sub],
      );
      return result.rows[0] || null;
    });
    const draftPayload = typeof draft?.payload === 'string'
      ? (() => {
          try { return JSON.parse(draft.payload); } catch { return {}; }
        })()
      : (draft?.payload || {});
    const recoveredRecordingId = draftPayload?.voice?.recordingId || draftPayload?.recordingId;
    if (uuidPattern.test(String(recoveredRecordingId || ''))) {
      emitEvent({
        t: new Date().toISOString(),
        event: 'draft_recovered',
        recordingId: recoveredRecordingId,
        studentId: identity.sub,
      });
    }
    return sendJson(response, 200, { draft });
  }

  if (request.method === 'PATCH' && url.pathname === '/api/drafts/story-builder') {
    const body = await readJson(request);
    const draft = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_save_story_draft($1::jsonb, $2::bigint)`,
        [
          JSON.stringify(body.payload || {}),
          body.expectedVersion ?? null,
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { draft });
  }

  if (request.method === 'GET' && url.pathname === '/api/notifications') {
    const notifications = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT n.*, u.display_name AS actor_name
         FROM public.sf_notifications n
         LEFT JOIN public.sf_users u ON u.id = n.actor_id
         ORDER BY n.created_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { notifications });
  }

  if (request.method === 'POST' && url.pathname === '/api/notifications/read-all') {
    const count = await withIdentity(identity, async (client) => {
      const result = await client.query(`SELECT public.sf_mark_all_notifications_read() AS count`);
      return result.rows[0]?.count || 0;
    });
    return sendJson(response, 200, { count });
  }

  const notificationRead = url.pathname.match(/^\/api\/notifications\/([a-f0-9-]+)\/read$/i);
  if (request.method === 'POST' && notificationRead) {
    const id = safeUuid(notificationRead[1]);
    const notification = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_mark_notification_read($1)`,
        [id],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { notification });
  }

  if (request.method === 'GET' && url.pathname === '/api/students') {
    const students = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const result = await client.query(
        `SELECT u.id, u.display_name, u.cohort,
           count(s.id)::integer AS story_count,
           count(s.id) FILTER (WHERE s.status = 'awaiting' AND NOT s.revised)::integer AS awaiting_review,
           count(s.id) FILTER (WHERE s.status = 'awaiting' AND s.revised)::integer AS revised,
           count(s.id) FILTER (WHERE s.status = 'changes')::integer AS waiting_on_student,
           count(s.id) FILTER (WHERE s.mentor_score IS NULL AND s.status <> 'private')::integer AS unscored,
           max(s.last_submitted_at) AS last_submitted_at,
           max(coalesce(s.student_updated_at, s.updated_at)) AS last_activity_at
         FROM public.sf_users u
         LEFT JOIN public.sf_stories s ON s.student_id = u.id AND s.archived_at IS NULL
         WHERE u.role = 'student'
         GROUP BY u.id, u.display_name, u.cohort
         ORDER BY u.display_name`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { students });
  }

  if (request.method === 'GET' && url.pathname === '/api/queue') {
    const stories = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const result = await client.query(
        `SELECT ${storyProjection('s')}, u.display_name AS student_name,
           CASE
             WHEN s.status = 'awaiting' AND s.revised THEN 'revised'
             WHEN s.status = 'awaiting' THEN 'awaiting_review'
             WHEN s.status = 'in_review' THEN 'in_review'
             WHEN s.status = 'changes' THEN 'waiting_on_student'
             WHEN s.status = 'reviewed' THEN 'reviewed'
             WHEN s.status = 'approved' THEN 'approved'
             ELSE 'other'
           END AS bucket
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         WHERE s.status <> 'private' AND s.archived_at IS NULL
         ORDER BY coalesce(s.last_submitted_at, s.submitted_at, s.updated_at) DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { stories });
  }

  if (request.method === 'GET' && url.pathname === '/api/mentor/home') {
    const home = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const [storiesResult, studentsResult, activityResult] = await Promise.all([
        client.query(
          `SELECT ${storyProjection('story')}, student.display_name AS student_name,
             CASE
               WHEN story.status = 'awaiting' AND story.revised THEN 'revised'
               WHEN story.status = 'awaiting' THEN 'awaiting'
               WHEN story.status = 'changes' THEN 'waiting'
               WHEN story.status = 'in_review' THEN 'in_review'
               WHEN story.status = 'reviewed' THEN 'reviewed'
               WHEN story.status = 'approved' THEN 'approved'
               ELSE 'other'
             END AS bucket
           FROM public.sf_stories story
           JOIN public.sf_users student ON student.id = story.student_id
           WHERE story.status <> 'private' AND story.archived_at IS NULL
           ORDER BY coalesce(story.student_responded_at, story.last_submitted_at, story.updated_at) DESC`,
        ),
        client.query(
          `SELECT count(DISTINCT student_id)::integer AS count
           FROM public.sf_mentor_assignments
           WHERE mentor_id = $1 AND active`,
          [identity.sub],
        ),
        client.query(
          `SELECT event.id, event.action, event.entity_type, event.entity_id,
             event.student_id, event.story_id, event.question_id, event.detail,
             event.previous_value, event.new_value, event.created_at,
             event.actor_id, event.actor_display,
             story.title AS story_title,
             student.display_name AS student_name, student.cohort
           FROM public.sf_audit_events event
           LEFT JOIN public.sf_stories story ON story.id = event.story_id
           LEFT JOIN public.sf_users student ON student.id = event.student_id
           WHERE event.actor_id = $1
             AND (
               (event.student_id IS NULL AND event.story_id IS NULL)
               OR (
                 event.student_id IS NOT NULL
                 AND public.sf_is_assigned(event.student_id)
               )
               OR (
                 event.student_id IS NULL
                 AND event.story_id IS NOT NULL
                 AND public.sf_is_assigned(story.student_id)
               )
             )
           ORDER BY event.created_at DESC
           LIMIT 12`,
          [identity.sub],
        ),
      ]);
      const stories = storiesResult.rows;
      return {
        stats: {
          students: studentsResult.rows[0]?.count || 0,
          awaiting: stories.filter((story) => story.bucket === 'awaiting').length,
          revised: stories.filter((story) => story.bucket === 'revised').length,
          waiting: stories.filter((story) => story.bucket === 'waiting').length,
          unscored: stories.filter((story) => !story.mentor_score).length,
        },
        awaiting: stories.filter((story) => ['awaiting', 'revised'].includes(story.bucket)).slice(0, 8),
        recentActivity: activityResult.rows,
      };
    });
    return sendJson(response, 200, home);
  }

  const studentDetail = url.pathname.match(/^\/api\/(?:mentor\/)?students\/([a-f0-9-]+)$/i);
  if (request.method === 'GET' && studentDetail) {
    const studentId = safeUuid(studentDetail[1]);
    const detail = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const studentResult = await client.query(
        `SELECT id, display_name, first_name, pronouns, cohort, academic_year,
           specialty, application_cycle
         FROM public.sf_users
         WHERE id = $1
           AND role = 'student'
           AND public.sf_is_assigned(id)`,
        [studentId],
      );
      if (!studentResult.rows[0]) return null;
      const [storiesResult, sessionsResult, activityResult] = await Promise.all([
        client.query(
          `SELECT ${storyProjection('story')}
           FROM public.sf_stories story
           WHERE story.student_id = $1 AND story.archived_at IS NULL
           ORDER BY story.updated_at DESC`,
          [studentId],
        ),
        client.query(
          `SELECT session.*,
             count(item.id)::integer AS item_count,
             count(item.id) FILTER (WHERE item.completed)::integer AS completed_count
           FROM public.sf_coaching_sessions session
           LEFT JOIN public.sf_coaching_session_items item ON item.session_id = session.id
           WHERE session.student_id = $1
           GROUP BY session.id
           ORDER BY session.started_at DESC`,
          [studentId],
        ),
        client.query(
          `SELECT id, actor_id, actor_display, action, entity_type, entity_id,
             story_id, question_id, detail, previous_value, new_value, created_at
           FROM public.sf_audit_events
           WHERE student_id = $1
           ORDER BY created_at DESC
           LIMIT 100`,
          [studentId],
        ),
      ]);
      return {
        student: studentResult.rows[0],
        stories: storiesResult.rows,
        coachingHistory: sessionsResult.rows,
        activity: activityResult.rows,
      };
    });
    if (!detail) {
      const error = new Error('Student not found.');
      error.code = 'P0002';
      throw error;
    }
    return sendJson(response, 200, detail);
  }

  if (
    request.method === 'GET'
    && (url.pathname === '/api/mentor/activity' || url.pathname === '/api/activity')
  ) {
    const period = String(url.searchParams.get('period') || 'week');
    const interval = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
      all: '100 years',
    }[period] || '7 days';
    const studentId = url.searchParams.get('studentId')
      ? safeUuid(url.searchParams.get('studentId'))
      : null;
    const actionType = String(url.searchParams.get('type') || '').trim();
    const activity = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const result = await client.query(
        `SELECT event.id, event.actor_id, event.actor_display, event.action,
           event.entity_type, event.entity_id, event.student_id, event.story_id,
           event.question_id, event.detail, event.previous_value, event.new_value,
           event.surface, event.created_at, story.title AS story_title,
           student.display_name AS student_name, student.cohort
         FROM public.sf_audit_events event
         LEFT JOIN public.sf_stories story ON story.id = event.story_id
         LEFT JOIN public.sf_users student ON student.id = event.student_id
         WHERE event.actor_id = $1
           AND event.created_at >= now() - $2::interval
           AND ($3::uuid IS NULL OR event.student_id = $3)
           AND (
             (event.student_id IS NULL AND event.story_id IS NULL)
             OR (
               event.student_id IS NOT NULL
               AND public.sf_is_assigned(event.student_id)
             )
             OR (
               event.student_id IS NULL
               AND event.story_id IS NOT NULL
               AND public.sf_is_assigned(story.student_id)
             )
           )
           AND (
             $4 = ''
             OR event.action LIKE
               CASE $4
                 WHEN 'status' THEN 'story.%'
                 WHEN 'feedback' THEN 'story.feedback%'
                 WHEN 'score' THEN '%score%'
                 WHEN 'question' THEN 'question.%'
                 WHEN 'star' THEN '%star%'
                 ELSE $4 || '%'
               END
           )
         ORDER BY event.created_at DESC
         LIMIT 250`,
        [identity.sub, interval, studentId, actionType],
      );
      return result.rows;
    });
    return sendJson(response, 200, { activity, period });
  }

  if (request.method === 'GET' && url.pathname === '/api/teaching/stories') {
    const stories = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor']);
      const result = await client.query(
        `SELECT ${storyProjection('story')}, student.display_name AS student_name,
           craft.detail AS craft_detail, craft.stakes AS craft_stakes,
           craft.turn AS craft_turn, craft.honest AS craft_honest,
           craft.lesson AS craft_lesson
         FROM public.sf_stories story
         JOIN public.sf_users student ON student.id = story.student_id
         LEFT JOIN public.sf_story_craft craft ON craft.story_id = story.id
         WHERE story.status <> 'private' AND story.archived_at IS NULL
         ORDER BY coalesce(story.mentor_score, 0) DESC, story.updated_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { stories });
  }

  if (
    request.method === 'GET'
    && (
      url.pathname === '/api/coaching-sessions'
      || url.pathname === '/api/mentor/sessions'
      || url.pathname === '/api/sessions'
    )
  ) {
    const studentId = url.searchParams.get('studentId')
      ? safeUuid(url.searchParams.get('studentId'))
      : null;
    const sessions = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT session.*,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'id', item.id,
                 'label', item.label,
                 'storyId', item.story_id,
                 'questionId', item.question_id,
                 'route', item.route,
                 'sortOrder', item.sort_order,
                 'completed', item.completed,
                 'completedAt', item.completed_at
               )
               ORDER BY item.sort_order, item.created_at
             ) FILTER (WHERE item.id IS NOT NULL),
             '[]'::jsonb
           ) AS items
         FROM public.sf_coaching_sessions session
         LEFT JOIN public.sf_coaching_session_items item ON item.session_id = session.id
         WHERE ($1::uuid IS NULL OR session.student_id = $1)
         GROUP BY session.id
         ORDER BY session.started_at DESC`,
        [studentId],
      );
      return result.rows;
    });
    return sendJson(response, 200, { sessions });
  }

  if (
    request.method === 'POST'
    && (
      url.pathname === '/api/coaching-sessions'
      || url.pathname === '/api/mentor/sessions'
      || url.pathname === '/api/sessions'
    )
  ) {
    const body = await readJson(request);
    const studentId = safeUuid(body.studentId);
    const payload = await withIdentity(identity, async (client) => {
      const storiesResult = await client.query(
        `SELECT id, title, status, revised, mentor_score
         FROM public.sf_stories
         WHERE student_id = $1
           AND status <> 'private'
           AND archived_at IS NULL
         ORDER BY coalesce(student_responded_at, last_submitted_at, updated_at) DESC`,
        [studentId],
      );
      const questionsResult = await client.query(
        `SELECT question.id, question.text, preference.story_id AS preferred_story_id,
           count(DISTINCT pair.id) FILTER (
             WHERE story.id IS NOT NULL
               AND pair.state IN ('suggested', 'confirmed')
           )::integer AS pair_count,
           count(DISTINCT pair.id) FILTER (
             WHERE story.id IS NOT NULL
               AND pair.state = 'confirmed'
           )::integer AS confirmed_count,
           count(DISTINCT followup.id)::integer AS followup_count,
           count(DISTINCT followup.id) FILTER (
             WHERE followup.prepared
           )::integer AS prepared_followup_count
         FROM public.sf_questions question
         LEFT JOIN public.sf_story_questions pair
           ON pair.question_id = question.id
          AND pair.state IN ('suggested', 'confirmed')
         LEFT JOIN public.sf_stories story
           ON story.id = pair.story_id
          AND story.student_id = $1
          AND story.status <> 'private'
          AND story.archived_at IS NULL
         LEFT JOIN public.sf_pair_followups followup
           ON followup.story_question_id = pair.id
          AND followup.removed_at IS NULL
          AND story.id IS NOT NULL
         LEFT JOIN public.sf_question_preferences preference
           ON preference.student_id = $1
          AND preference.question_id = question.id
         WHERE question.governance_state = 'approved'
            OR question.owner_student_id = $1
         GROUP BY question.id, question.text, question.family,
           question.canonical_key, preference.story_id
         HAVING preference.story_id IS NULL
           OR count(DISTINCT pair.id) FILTER (
             WHERE story.id IS NOT NULL
               AND pair.state = 'confirmed'
           ) = 0
           OR count(DISTINCT followup.id) = 0
           OR count(DISTINCT followup.id) FILTER (
             WHERE followup.prepared
           ) < count(DISTINCT followup.id)
         ORDER BY
           CASE question.family
             WHEN 'core' THEN 1 WHEN 'behavioral' THEN 2 WHEN 'clinical' THEN 3
             WHEN 'cv' THEN 4 WHEN 'redflag' THEN 5 WHEN 'personal' THEN 6
             ELSE 7
           END,
           question.canonical_key NULLS LAST,
           question.text
         LIMIT 8`,
        [studentId],
      );
      const storyItems = defaultStoryAgendaItems(storiesResult.rows).slice(0, 4);
      const questionItems = defaultQuestionAgendaItems(questionsResult.rows)
        .slice(0, Math.max(0, 6 - storyItems.length));
      const agenda = [...storyItems, ...questionItems];
      const result = await client.query(
        `SELECT * FROM public.sf_start_coaching_session($1, $2::jsonb)`,
        [studentId, JSON.stringify(agenda)],
      );
      const session = result.rows[0];
      const itemsResult = await client.query(
        `SELECT id, label, story_id, question_id, route, sort_order,
           completed, completed_at, created_at, updated_at
         FROM public.sf_coaching_session_items
         WHERE session_id = $1
         ORDER BY sort_order, created_at`,
        [session.id],
      );
      return { session, items: itemsResult.rows };
    });
    return sendJson(response, 201, payload);
  }

  const sessionItem = url.pathname.match(
    /^\/api\/(?:coaching-session-items|sessions\/items)\/([a-f0-9-]+)$/i,
  );
  if (request.method === 'PATCH' && sessionItem) {
    const body = await readJson(request);
    const item = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_toggle_coaching_session_item($1, $2)`,
        [safeUuid(sessionItem[1]), Boolean(body.completed)],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { item });
  }

  const sessionEnd = url.pathname.match(
    /^\/api\/(?:coaching-sessions|sessions)\/([a-f0-9-]+)\/end$/i,
  );
  if (request.method === 'POST' && sessionEnd) {
    const body = await readJson(request);
    const session = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_end_coaching_session($1, $2)`,
        [safeUuid(sessionEnd[1]), body.summary || null],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { session });
  }

  if (request.method === 'GET' && url.pathname === '/api/questions') {
    const requestedStudentId = identity.role === 'mentor'
      ? String(url.searchParams.get('studentId') || '').trim()
      : '';
    const selectedStudentId = requestedStudentId ? safeUuid(requestedStudentId) : null;
    const questions = await withIdentity(identity, async (client) => {
      if (identity.role === 'mentor' && selectedStudentId) {
        const assignment = await client.query(
          `SELECT public.sf_is_assigned($1) AS assigned`,
          [selectedStudentId],
        );
        if (!assignment.rows[0]?.assigned) {
          const error = new Error('The selected student is not assigned to this mentor.');
          error.code = '42501';
          throw error;
        }
      }
      const scopeStudentId = identity.role === 'student'
        ? identity.sub
        : selectedStudentId;
      const result = await client.query(
        `SELECT id, canonical_key, text, family, provenance, owner_student_id, import_batch_id,
          governance_state, created_by, approved_by, approved_at, created_at, updated_at
         FROM public.sf_questions
         WHERE owner_student_id IS NULL
            OR ($1::uuid IS NOT NULL AND owner_student_id = $1)
         ORDER BY family, text`,
        [scopeStudentId],
      );
      return result.rows;
    });
    return sendJson(response, 200, { questions });
  }

  if (request.method === 'POST' && url.pathname === '/api/questions') {
    const body = await readJson(request);
    const question = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_create_custom_question($1, $2, $3)`,
        [
          body.text,
          body.family ?? 'custom',
          body.surface ?? 'library',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { question });
  }

  const questionApproval = url.pathname.match(/^\/api\/questions\/([a-f0-9-]+)\/approve$/i);
  if (request.method === 'POST' && questionApproval) {
    const body = await readJson(request);
    const question = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_approve_question($1, $2)`,
        [safeUuid(questionApproval[1]), body.surface || 'library'],
      );
      return result.rows[0];
    }, identity.wordpressAdmin === true && identity.role !== 'admin' ? { adminMode: true } : undefined);
    return sendJson(response, 200, { question });
  }

  if (request.method === 'GET' && url.pathname === '/api/interview-intelligence') {
    const studentId = safeUuid(url.searchParams.get('studentId') || identity.sub);
    const payload = await withIdentity(identity, async (client) => {
      const studentResult = await client.query(
        `SELECT id, display_name, first_name, cohort, academic_year, specialty
         FROM public.sf_users
         WHERE id = $1 AND role = 'student'`,
        [studentId],
      );
      if (!studentResult.rows[0]) return null;
      const result = await client.query(
        `SELECT q.id, q.canonical_key, q.text, q.family, q.provenance,
           preferred_story.id AS preferred_story_id,
           count(DISTINCT pair.id) FILTER (
             WHERE pair.state IN ('suggested', 'confirmed') AND story.id IS NOT NULL
           )::integer AS pair_count,
           count(DISTINCT pair.id) FILTER (
             WHERE pair.state = 'confirmed' AND story.id IS NOT NULL
           )::integer AS confirmed_count,
           count(DISTINCT pair.id) FILTER (
             WHERE pair.state = 'confirmed'
               AND coalesce(pair.mentor_strength, 0) >= 3
               AND pair.story_id = preferred_story.id
               AND story.id IS NOT NULL
           )::integer AS ready_pair_count,
           max(pair.student_strength) FILTER (
             WHERE pair.state IN ('suggested', 'confirmed') AND story.id IS NOT NULL
           ) AS best_student_strength,
           max(pair.mentor_strength) FILTER (
             WHERE pair.state IN ('suggested', 'confirmed') AND story.id IS NOT NULL
           ) AS best_mentor_strength,
           count(DISTINCT followup.id)::integer AS followups_total,
           count(DISTINCT followup.id) FILTER (WHERE followup.prepared)::integer AS followups_prepared
         FROM public.sf_questions q
         LEFT JOIN public.sf_story_questions pair
           ON pair.question_id = q.id
         LEFT JOIN public.sf_stories story
           ON story.id = pair.story_id
          AND story.student_id = $1
          AND story.archived_at IS NULL
         LEFT JOIN public.sf_pair_followups followup
           ON followup.story_question_id = pair.id
          AND followup.removed_at IS NULL
          AND story.id IS NOT NULL
         LEFT JOIN public.sf_question_preferences pref
           ON pref.student_id = $1
          AND pref.question_id = q.id
         LEFT JOIN public.sf_stories preferred_story
           ON preferred_story.id = pref.story_id
          AND preferred_story.student_id = $1
          AND preferred_story.archived_at IS NULL
         WHERE q.governance_state = 'approved'
            OR q.owner_student_id = $1
         GROUP BY q.id, q.canonical_key, q.text, q.family, q.provenance,
           preferred_story.id
         ORDER BY
           CASE q.family
             WHEN 'core' THEN 1 WHEN 'behavioral' THEN 2 WHEN 'clinical' THEN 3
             WHEN 'cv' THEN 4 WHEN 'redflag' THEN 5 WHEN 'personal' THEN 6
             ELSE 7
           END,
           q.canonical_key NULLS LAST,
           q.text`,
        [studentId],
      );
      const questions = result.rows.map((row) => {
        const ready = Boolean(row.preferred_story_id)
          && row.ready_pair_count > 0;
        return {
          id: row.id,
          canonicalKey: row.canonical_key,
          text: row.text,
          family: row.family,
          provenance: row.provenance,
          state: ready ? 'ready' : (row.pair_count > 0 ? 'progress' : 'none'),
          preferredStoryId: row.preferred_story_id,
          pairCount: row.pair_count,
          confirmedCount: row.confirmed_count,
          readyPairCount: row.ready_pair_count,
          bestStudentStrength: row.best_student_strength,
          bestMentorStrength: row.best_mentor_strength,
          followupsTotal: row.followups_total,
          followupsPrepared: row.followups_prepared,
        };
      });
      const stats = questions.reduce((summary, question) => {
        summary[question.state === 'none' ? 'gaps' : question.state] += 1;
        summary.followupsTotal += question.followupsTotal;
        summary.followupsPrepared += question.followupsPrepared;
        return summary;
      }, {
        total: questions.length,
        ready: 0,
        progress: 0,
        gaps: 0,
        followupsTotal: 0,
        followupsPrepared: 0,
      });
      return {
        student: studentResult.rows[0],
        studentId,
        stats,
        families: [
          { id: 'core', label: 'Core & Common' },
          { id: 'behavioral', label: 'Behavioral' },
          { id: 'clinical', label: 'Clinical' },
          { id: 'cv', label: 'CV & Application' },
          { id: 'redflag', label: 'Red Flag' },
          { id: 'personal', label: 'Personal' },
          { id: 'custom', label: 'Custom' },
        ],
        questions,
      };
    });
    if (!payload) {
      const error = new Error('Student not found.');
      error.code = 'P0002';
      throw error;
    }
    return sendJson(response, 200, payload);
  }

  const questionWorkshop = url.pathname.match(/^\/api\/questions\/([a-f0-9-]+)\/workshop$/i);
  if (request.method === 'GET' && questionWorkshop) {
    const questionId = safeUuid(questionWorkshop[1]);
    const studentId = safeUuid(url.searchParams.get('studentId') || identity.sub);
    const workshop = await withIdentity(identity, async (client) => {
      const accessResult = await client.query(
        `SELECT id FROM public.sf_users WHERE id = $1 AND role = 'student'`,
        [studentId],
      );
      if (!accessResult.rows[0]) return null;
      const questionResult = await client.query(
        `SELECT id, canonical_key, text, family, provenance
         FROM public.sf_questions
         WHERE id = $1
           AND (governance_state = 'approved' OR owner_student_id = $2)`,
        [questionId, studentId],
      );
      if (!questionResult.rows[0]) return null;
      const questionFamily = questionResult.rows[0].family;
      const [preferenceResult, pairsResult, coachingResult, suggestionsResult] = await Promise.all([
        client.query(
          `SELECT preference.story_id, preference.set_by, preference.set_at,
             preference.row_version
           FROM public.sf_question_preferences preference
           JOIN public.sf_stories story
             ON story.id = preference.story_id
            AND story.student_id = preference.student_id
            AND story.archived_at IS NULL
           WHERE preference.student_id = $1
             AND preference.question_id = $2`,
          [studentId, questionId],
        ),
        client.query(
          `SELECT pair.id, pair.story_id, story.title, story.current_text,
             story.prefix_enabled, story.lesson, story.status, story.revised,
             story.student_score, story.mentor_score, story.themes, story.uses,
             student.display_name AS student_name,
             pair.student_strength, pair.mentor_strength, pair.student_proposed,
             pair.mentor_confirmed, pair.state, pair.proposed_by, pair.proposed_role,
             pair.why, pair.clinical, pair.created_at, pair.updated_at, pair.row_version,
             proposer.display_name AS proposed_by_name,
             coalesce(
               (
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', followup.id,
                     'text', followup.text,
                     'source', followup.source,
                     'clinical', followup.clinical,
                     'prepared', followup.prepared,
                     'note', followup.preparation_note,
                     'sortOrder', followup.sort_order,
                     'rowVersion', followup.row_version,
                     'createdAt', followup.created_at,
                     'updatedAt', followup.updated_at
                   )
                   ORDER BY followup.sort_order, followup.created_at
                 )
                 FROM public.sf_pair_followups followup
                 WHERE followup.story_question_id = pair.id
                   AND followup.removed_at IS NULL
               ),
               '[]'::jsonb
             ) AS followups
           FROM public.sf_story_questions pair
           JOIN public.sf_stories story ON story.id = pair.story_id
           JOIN public.sf_users student ON student.id = story.student_id
           LEFT JOIN public.sf_users proposer ON proposer.id = pair.proposed_by
           WHERE pair.question_id = $2
             AND story.student_id = $1
             AND story.archived_at IS NULL
             AND pair.state IN ('suggested', 'confirmed')
           ORDER BY
             CASE WHEN pair.state = 'confirmed' THEN 0 ELSE 1 END,
             coalesce(pair.mentor_strength, pair.student_strength, 0) DESC,
             story.updated_at DESC`,
          [studentId, questionId],
        ),
        client.query(
          `SELECT note.id, note.story_id, note.body, note.created_at,
             note.mentor_id, mentor.display_name AS mentor_name
           FROM public.sf_question_coaching_notes note
           JOIN public.sf_users mentor ON mentor.id = note.mentor_id
           WHERE note.student_id = $1
             AND note.question_id = $2
             AND (
               note.story_id IS NULL
               OR EXISTS (
                 SELECT 1
                 FROM public.sf_stories note_story
                 WHERE note_story.id = note.story_id
                   AND note_story.student_id = note.student_id
                   AND note_story.archived_at IS NULL
               )
             )
           ORDER BY note.created_at`,
          [studentId, questionId],
        ),
        client.query(
          `SELECT ${storyProjection('story')}, student.display_name AS student_name
           FROM public.sf_stories story
           JOIN public.sf_users student ON student.id = story.student_id
           WHERE story.student_id = $1
             AND story.status <> 'private'
             AND story.archived_at IS NULL
             AND (
               $3 = 'custom'
               OR story.themes && CASE $3
                 WHEN 'core' THEN ARRAY['identity', 'growth']::text[]
                 WHEN 'behavioral' THEN ARRAY[
                   'mistake', 'conflict', 'leader', 'team', 'growth', 'resil', 'comm'
                 ]::text[]
                 WHEN 'clinical' THEN ARRAY['patient', 'advoc', 'mistake']::text[]
                 WHEN 'cv' THEN ARRAY['identity', 'leader', 'team']::text[]
                 WHEN 'redflag' THEN ARRAY['resil', 'growth', 'mistake']::text[]
                 WHEN 'personal' THEN ARRAY['identity', 'resil']::text[]
                 ELSE ARRAY[]::text[]
               END
             )
             AND NOT EXISTS (
               SELECT 1 FROM public.sf_story_questions pair
               WHERE pair.story_id = story.id
                 AND pair.question_id = $2
                 AND pair.state IN ('suggested', 'confirmed')
             )
           ORDER BY coalesce(story.mentor_score, story.student_score, 0) DESC, story.updated_at DESC
           LIMIT 6`,
          [studentId, questionId, questionFamily],
        ),
      ]);
      const preferredStoryId = preferenceResult.rows[0]?.story_id || null;
      const pairs = pairsResult.rows.map((pair) => ({
        ...pair,
        preferred: pair.story_id === preferredStoryId,
      }));
      const confirmed = pairs.some((pair) => pair.state === 'confirmed');
      const readyPair = pairs.some(
        (pair) => pair.preferred
          && pair.state === 'confirmed'
          && Number(pair.mentor_strength || 0) >= 3,
      );
      const focus = pairs.find((pair) => pair.preferred) || pairs[0] || null;
      const followups = focus?.followups || [];
      const gaps = {
        preferredStoryChosen: Boolean(preferredStoryId),
        mentorConfirmed: confirmed,
        followupsMapped: followups.length > 0,
        allFollowupsPrepared: followups.length > 0 && followups.every((item) => item.prepared),
      };
      return {
        studentId,
        question: questionResult.rows[0],
        state: preferredStoryId && readyPair
          ? 'ready'
          : (pairs.length ? 'progress' : 'none'),
        preferredStoryId,
        preference: preferenceResult.rows[0] || null,
        pairs,
        coachingNotes: coachingResult.rows,
        suggestedStories: suggestionsResult.rows,
        gaps,
      };
    });
    if (!workshop) {
      const error = new Error('Question workshop not found.');
      error.code = 'P0002';
      throw error;
    }
    return sendJson(response, 200, workshop);
  }

  if (request.method === 'POST' && url.pathname === '/api/story-question-pairs') {
    const body = await readJson(request);
    if (
      (identity.role === 'student' && Object.hasOwn(body, 'mentorStrength'))
      || (identity.role === 'mentor' && Object.hasOwn(body, 'studentStrength'))
    ) {
      const error = new Error('Story-question strength is owned by the signed role.');
      error.code = '42501';
      throw error;
    }
    const patch = {
      ...body,
      strength: identity.role === 'mentor'
        ? (body.mentorStrength ?? body.strength)
        : (body.studentStrength ?? body.strength),
    };
    const pair = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_upsert_story_question($1, $2, $3::jsonb, $4)`,
        [
          safeUuid(body.storyId),
          safeUuid(body.questionId),
          JSON.stringify(patch),
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { pair });
  }

  const pairRoute = url.pathname.match(/^\/api\/story-question-pairs\/([a-f0-9-]+)$/i);
  if (request.method === 'PATCH' && pairRoute) {
    const pairId = safeUuid(pairRoute[1]);
    const body = await readJson(request);
    if (
      (identity.role === 'student' && Object.hasOwn(body, 'mentorStrength'))
      || (identity.role === 'mentor' && Object.hasOwn(body, 'studentStrength'))
    ) {
      const error = new Error('Story-question strength is owned by the signed role.');
      error.code = '42501';
      throw error;
    }
    const patch = {
      ...body,
      strength: identity.role === 'mentor'
        ? (body.mentorStrength ?? body.strength)
        : (body.studentStrength ?? body.strength),
    };
    const pair = await withIdentity(identity, async (client) => {
      const current = await client.query(
        `SELECT story_id, question_id FROM public.sf_story_questions WHERE id = $1`,
        [pairId],
      );
      if (!current.rows[0]) return null;
      const result = await client.query(
        `SELECT * FROM public.sf_upsert_story_question($1, $2, $3::jsonb, $4)`,
        [
          current.rows[0].story_id,
          current.rows[0].question_id,
          JSON.stringify(patch),
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    if (!pair) {
      const error = new Error('Story-question pair not found.');
      error.code = 'P0002';
      throw error;
    }
    return sendJson(response, 200, { pair });
  }

  const pairDecision = url.pathname.match(
    /^\/api\/story-question-pairs\/([a-f0-9-]+)\/(confirm|reject|remove)$/i,
  );
  if (request.method === 'POST' && pairDecision) {
    const pairId = safeUuid(pairDecision[1]);
    const action = pairDecision[2];
    const body = await readJson(request);
    const pair = await withIdentity(identity, async (client) => {
      const result = action === 'remove'
        ? await client.query(
          `SELECT * FROM public.sf_remove_story_question($1, $2)`,
          [pairId, body.surface || 'workshop'],
        )
        : await client.query(
          `SELECT * FROM public.sf_review_story_question($1, $2, $3, $4)`,
          [pairId, action === 'confirm' ? 'confirmed' : 'rejected', body.reason || null, body.surface || 'workshop'],
        );
      return result.rows[0];
    });
    return sendJson(response, 200, { pair });
  }

  const questionPreferencePut = url.pathname.match(/^\/api\/question-preferences\/([a-f0-9-]+)$/i);
  if (
    (request.method === 'POST' && url.pathname === '/api/question-preferences')
    || (request.method === 'PUT' && questionPreferencePut)
  ) {
    const body = await readJson(request);
    const preference = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_set_question_preference($1, $2, $3, $4)`,
        [
          safeUuid(body.studentId || identity.sub),
          safeUuid(questionPreferencePut?.[1] || body.questionId),
          safeUuid(body.storyId),
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { preference });
  }

  const questionCoachingAlias = url.pathname.match(/^\/api\/questions\/([a-f0-9-]+)\/coaching$/i);
  if (
    request.method === 'POST'
    && (url.pathname === '/api/question-coaching-notes' || questionCoachingAlias)
  ) {
    const body = await readJson(request);
    const note = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_add_question_coaching_note($1, $2, $3, $4, $5)`,
        [
          safeUuid(body.studentId),
          safeUuid(questionCoachingAlias?.[1] || body.questionId),
          body.storyId ? safeUuid(body.storyId) : null,
          body.body,
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { note });
  }

  const pairFollowupCreateAlias = url.pathname.match(
    /^\/api\/story-question-pairs\/([a-f0-9-]+)\/followups$/i,
  );
  if (
    request.method === 'POST'
    && (url.pathname === '/api/pair-followups' || pairFollowupCreateAlias)
  ) {
    const body = await readJson(request);
    const followup = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_add_pair_followup($1, $2, $3, $4, $5, $6)`,
        [
          safeUuid(pairFollowupCreateAlias?.[1] || body.pairId),
          body.text,
          Boolean(body.clinical),
          Boolean(body.prepared),
          body.note || '',
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { followup });
  }

  const followupRoute = url.pathname.match(/^\/api\/(?:pair-followups|followups)\/([a-f0-9-]+)$/i);
  if (request.method === 'PATCH' && followupRoute) {
    const body = await readJson(request);
    const followup = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_update_pair_followup($1, $2::jsonb, $3::bigint, $4)`,
        [
          safeUuid(followupRoute[1]),
          JSON.stringify(body),
          body.expectedVersion ?? null,
          body.surface || 'workshop',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { followup });
  }

  const followupRemove = url.pathname.match(
    /^\/api\/(?:pair-followups|followups)\/([a-f0-9-]+)\/remove$/i,
  );
  if (request.method === 'POST' && followupRemove) {
    const body = await readJson(request);
    const followup = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_remove_pair_followup($1, $2)`,
        [safeUuid(followupRemove[1]), body.surface || 'workshop'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { followup });
  }

  if (request.method === 'GET' && url.pathname === '/api/workshops') {
    const workshops = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT w.*, qa.text AS question_a, qb.text AS question_b, u.display_name AS student_name
         FROM public.sf_workshops w
         JOIN public.sf_questions qa ON qa.id = w.question_a_id
         JOIN public.sf_questions qb ON qb.id = w.question_b_id
         JOIN public.sf_users u ON u.id = w.student_id
         ORDER BY w.updated_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { workshops });
  }

  if (request.method === 'POST' && url.pathname === '/api/workshops') {
    const body = await readJson(request);
    const workshop = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_create_workshop($1, $2, $3)`,
        [safeUuid(body.studentId), safeUuid(body.questionAId), safeUuid(body.questionBId)],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { workshop });
  }

  const workshopRoute = url.pathname.match(/^\/api\/workshops\/([a-f0-9-]+)$/i);
  if (request.method === 'PATCH' && workshopRoute) {
    const body = await readJson(request);
    const workshop = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_update_workshop(
          $1, $2::smallint, $3::smallint, $4, $5, $6, $7, $8
        )`,
        [
          safeUuid(workshopRoute[1]),
          body.strengthA,
          body.strengthB,
          body.preferredQuestionId || null,
          body.why || null,
          body.notes || null,
          body.gaps || null,
          body.status || 'draft',
        ],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { workshop });
  }

  if (request.method === 'GET' && url.pathname === '/api/next-questions') {
    const rows = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_next_questions ORDER BY updated_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { questions: rows });
  }

  if (request.method === 'POST' && url.pathname === '/api/next-questions') {
    const body = await readJson(request);
    const question = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_add_next_question($1, $2, $3, $4::boolean)`,
        [safeUuid(body.studentId || identity.sub), body.text, body.notes || null, Boolean(body.prepared)],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { question });
  }

  if (request.method === 'POST' && url.pathname === '/api/imports/preview') {
    const body = await readJson(request);
    const existingQuestions = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor', 'admin']);
      const result = await client.query(`SELECT id, text FROM public.sf_questions WHERE governance_state <> 'retired'`);
      return result.rows;
    });
    const rows = await previewImport({ ...body, existingQuestions });
    return sendJson(response, 200, {
      rows,
      selectedCount: rows.filter((row) => row.selected).length,
      reviewFingerprint: importReviewFingerprint(rows),
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/imports') {
    const batches = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor', 'admin']);
      const result = await client.query(
        `SELECT batch.id, batch.source_name, batch.source_format, batch.state,
           batch.row_count, batch.committed_at, batch.rolled_back_at, batch.created_at,
           creator.display_name AS created_by_name,
           count(row.id) FILTER (WHERE row.created_question_id IS NOT NULL)::integer
             AS created_question_count
         FROM public.sf_import_batches batch
         JOIN public.sf_users creator ON creator.id = batch.created_by
         LEFT JOIN public.sf_import_rows row ON row.batch_id = batch.id
         GROUP BY batch.id, creator.display_name
         ORDER BY batch.created_at DESC
         LIMIT 50`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { batches });
  }

  if (request.method === 'POST' && url.pathname === '/api/imports/commit') {
    const body = await readJson(request);
    const batch = await withIdentity(identity, async (client) => {
      await requireDatabaseRole(client, ['mentor', 'admin']);
      const submittedRows = Array.isArray(body.rows) ? body.rows : [];
      const existingResult = await client.query(
        `SELECT id, text
         FROM public.sf_questions
         WHERE governance_state <> 'retired'`,
      );
      const previewRows = await previewImport({
        format: 'paste',
        text: submittedRows.map((row) => `${String(row.text || '')} | ${String(row.family || '')}`).join('\n'),
        existingQuestions: existingResult.rows,
      });
      const fingerprint = importReviewFingerprint(previewRows);
      if (!/^[a-f0-9]{64}$/.test(String(body.reviewFingerprint || ''))
          || body.reviewFingerprint !== fingerprint) {
        const error = new Error('Import preview is missing or stale. Preview the source again before committing.');
        error.code = 'import_preview_stale';
        throw error;
      }
      const rows = previewRows.map((row, index) => {
        const submitted = submittedRows[index] || {};
        const selected = Boolean(submitted.selected);
        if (
          selected
          && (
            row.error
            || row.exactDuplicateId
            || String(submitted.nearDuplicateId || '') !== String(row.nearDuplicateId || '')
          )
        ) {
          const error = new Error(`Import row ${row.rowNumber} must be reviewed again before commit.`);
          error.code = 'import_preview_stale';
          throw error;
        }
        return {
          text: row.text,
          family: row.family,
          selected,
          nearDuplicateReviewed: Boolean(row.nearDuplicateId && selected),
        };
      });
      const result = await client.query(
        `SELECT * FROM public.sf_commit_question_import($1, $2, $3::jsonb)`,
        [body.sourceName, body.format, JSON.stringify(rows)],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { batch });
  }

  const importRollback = url.pathname.match(/^\/api\/imports\/([a-f0-9-]+)\/rollback$/i);
  if (request.method === 'POST' && importRollback) {
    const batch = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_rollback_question_import($1)`,
        [safeUuid(importRollback[1])],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { batch });
  }

  if (request.method === 'POST' && url.pathname === '/api/audio/presign') {
    await flagService.assertVoiceEnabled(identity);
    const body = await readJson(request);
    const storyId = safeUuid(body.storyId);
    const signed = await createAudioUpload({
      studentId: identity.sub,
      storyId,
      contentType: String(body.contentType || ''),
      byteSize: Number(body.byteSize),
    });
    const asset = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_begin_audio_asset($1, $2, $3, $4::bigint)`,
        [storyId, signed.objectKey, body.contentType, Number(body.byteSize)],
      );
      return result.rows[0];
    });
    return sendJson(response, 201, { asset, upload: signed });
  }

  const audioConfirm = url.pathname.match(/^\/api\/audio\/([a-f0-9-]+)\/confirm$/i);
  if (request.method === 'POST' && audioConfirm) {
    await flagService.assertVoiceEnabled(identity);
    const assetId = safeUuid(audioConfirm[1]);
    const body = await readJson(request);
    const assetResult = await withIdentity(identity, async (client) => client.query(
      `SELECT * FROM public.sf_audio_assets WHERE id = $1 AND student_id = $2`,
      [assetId, identity.sub],
    ));
    const asset = assetResult.rows[0];
    if (!asset) {
      const error = new Error('Audio asset not found.');
      error.code = 'P0002';
      throw error;
    }
    const verified = await verifyAudioUpload({
      objectKey: asset.object_key,
      expectedType: asset.content_type,
      expectedSize: Number(asset.byte_size),
    });
    const confirmed = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_confirm_audio_asset($1, $2, $3)`,
        [assetId, body.checksumSha256 || null, body.durationMs ?? null],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { asset: confirmed, verified });
  }

  const audioDelete = url.pathname.match(/^\/api\/audio\/([a-f0-9-]+)$/i);
  if (request.method === 'DELETE' && audioDelete) {
    return sendJson(
      response,
      200,
      await recordingsService.deleteAudio(identity, safeUuid(audioDelete[1])),
    );
  }

  const audioPlayback = url.pathname.match(/^\/api\/audio\/([a-f0-9-]+)\/playback$/i);
  if (request.method === 'GET' && audioPlayback) {
    const assetId = safeUuid(audioPlayback[1]);
    const asset = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, story_id, object_key, content_type, byte_size, duration_ms
         FROM public.sf_audio_assets
         WHERE id = $1 AND state = 'verified'`,
        [assetId],
      );
      return result.rows[0] || null;
    });
    if (!asset) {
      await withIdentity(identity, async (client) => auditWriter(client, {
        action: 'unauthorized_denied',
        entityType: 'audio_asset',
        entityId: assetId,
        surface: 'library',
        studentId: identity.sub,
        previousValue: null,
        newValue: { errorCategory: 'auth' },
      }));
      emitEvent({
        t: new Date().toISOString(),
        event: 'unauthorized_denied',
        assetId,
        studentId: identity.sub,
        errorCategory: 'auth',
      });
      const error = new Error('Audio asset not found.');
      error.code = 'P0002';
      throw error;
    }
    const playbackKeys = await recordingsService.playbackKeys(asset);
    const playbacks = await Promise.all(
      playbackKeys.map((objectKey) => signAudioPlayback({ objectKey })),
    );
    emitEvent({
      t: new Date().toISOString(),
      event: 'audio_playback_granted',
      assetId,
      storyId: asset.story_id,
      studentId: identity.sub,
    });
    return sendJson(response, 200, {
      asset: {
        id: asset.id,
        storyId: asset.story_id,
        contentType: asset.content_type,
        byteSize: Number(asset.byte_size),
        durationMs: asset.duration_ms,
      },
      playbackUrl: playbacks[0]?.playbackUrl,
      playbackUrls: playbacks.map((item) => item.playbackUrl),
      expiresIn: playbacks[0]?.expiresIn,
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/suggest') {
    const body = await readJson(request);
    const mode = body.mode === 'clinical' ? 'clinical' : 'general';
    const enabled = mode === 'clinical'
      ? (identity.role === 'mentor' ? config.flags.aiClinicalMentor : config.flags.aiClinicalStudent)
      : (identity.role === 'mentor' ? config.flags.aiMentorBeta : config.flags.aiStudentGeneral);
    const error = new Error(enabled
      ? 'The approved AI provider and DPA configuration are not installed.'
      : 'AI suggestions are not enabled for this account and mode.');
    error.code = enabled ? 'ai_provider_unconfigured' : 'ai_feature_gated';
    throw error;
  }

  const error = new Error('API route not found.');
  error.code = 'P0002';
  throw error;
}

async function serveStatic(response, url) {
  if (config.devAuth && url.pathname === '/_test/axe.js') {
    const data = await readFile(path.join(config.packageDir, 'node_modules', 'axe-core', 'axe.min.js'));
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.setHeader('Content-Length', data.length);
    response.end(data);
    return true;
  }
  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const filePath = path.resolve(config.publicDir, requested);
  if (!filePath.startsWith(`${config.publicDir}${path.sep}`) && filePath !== path.join(config.publicDir, 'index.html')) {
    return false;
  }
  try {
    const details = await stat(filePath);
    if (!details.isFile()) return false;
    const data = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader('Content-Type', mimeTypes.get(path.extname(filePath)) || 'application/octet-stream');
    response.setHeader('Content-Length', data.length);
    if (path.basename(filePath) === 'index.html') {
      response.setHeader('Cache-Control', 'no-store, max-age=0');
    } else if (/\/assets\/(?:[^/]+\/)*[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(filePath)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      response.setHeader('Cache-Control', 'no-cache');
    }
    response.end(data);
    return true;
  } catch {
    if (!path.extname(requested)) {
      const data = await readFile(path.join(config.publicDir, 'index.html'));
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Content-Length', data.length);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.end(data);
      return true;
    }
    return false;
  }
}

export function createAppServer({
  checkHealth = healthCheck,
  authorizeRequest = authorize,
  identityTransaction = withDatabaseIdentity,
  phaseOneRuntime = defaultPhaseOneRuntime,
  adminConsoleService = null,
  productConfigurationService = null,
  storyMediaService = null,
  mentorNotesService = null,
  auditWriter = appendAudit,
  audioPlaybackSigner = createAudioPlayback,
  reportEvent = emitStructuredEvent,
  reportError = emitStructuredError,
} = {}) {
  const resolvedAdminConsoleService = adminConsoleService || createAdminConsoleService({
    withIdentity: identityTransaction,
  });
  const resolvedProductConfigurationService = productConfigurationService || createProductConfigurationService({
    withIdentity: identityTransaction,
  });
  const resolvedStoryMediaService = storyMediaService || createStoryMediaService({
    withIdentity: identityTransaction,
    storage: {
      spec: storyMediaSpec,
      createUpload: createStoryMediaUpload,
      verifyUpload: verifyStoryMediaUpload,
      promoteObject: promoteStoryMediaObject,
      signPlayback: audioPlaybackSigner,
      deleteObject: deleteAudioObject,
    },
  });
  const resolvedMentorNotesService = mentorNotesService || createMentorNotesService({
    withIdentity: identityTransaction,
    storage: {
      putRecordingSegment,
      headAudioObject,
      deleteRecordingObjects,
    },
    transcription: phaseOneRuntime.transcription || createUnavailableTranscriptionAdapter(),
    signPlayback: audioPlaybackSigner,
  });
  const apiRuntime = Object.freeze({
    authorizeRequest,
    auditWriter,
    emitEvent: reportEvent,
    withIdentity: identityTransaction,
    flagService: phaseOneRuntime.flagService,
    adminConsoleService: resolvedAdminConsoleService,
    productConfigurationService: resolvedProductConfigurationService,
    storyMediaService: resolvedStoryMediaService,
    mentorNotesService: resolvedMentorNotesService,
    recordingsService: phaseOneRuntime.recordingsService,
    signAudioPlayback: audioPlaybackSigner,
  });
  return http.createServer(async (request, response) => {
    setSecurityHeaders(response);
    const url = new URL(request.url || '/', config.publicOrigin);
    try {
      if (request.method === 'GET' && url.pathname === '/healthz') {
        await checkHealth();
        return sendJson(response, 200, {
          ok: true,
          service: 'storyforge-v5',
        });
      }
      if (url.pathname.startsWith('/api/')) {
        response.setHeader('Cache-Control', 'no-store, private');
        response.setHeader('Pragma', 'no-cache');
        enforceAllowedOrigin(request, response);
        if (request.method === 'OPTIONS') {
          response.statusCode = 204;
          response.end();
          return;
        }
        return await api(request, response, url, apiRuntime);
      }
      if (!config.originApiOnly && request.method === 'GET' && await serveStatic(response, url)) return;
      sendJson(response, 404, { error: { code: 'not_found', message: 'Resource not found.' } });
    } catch (error) {
      const failure = publicError(error);
      if (failure.status >= 500) reportError(safeRequestFailureEvent(failure));
      sendJson(response, failure.status, {
        error: {
          code: failure.code,
          message: failure.message,
          ...(failure.retryAfterMs ? { retryAfterMs: failure.retryAfterMs } : {}),
        },
      });
    }
  });
}

async function start() {
  const errors = validateConfig();
  if (errors.length) {
    throw new Error(`StoryForge configuration is invalid: ${errors.join('; ')}`);
  }
  const phaseOneRuntime = createPhaseOneRuntime({
    transcription: createTranscriptionAdapterForProvider(
      config.transcription.provider,
      {
        apiKey: config.transcription.apiKey,
        primaryModel: config.transcription.primaryModel,
        fallbackModel: config.transcription.fallbackModel,
        emitEvent: emitStructuredEvent,
      },
    ),
    assembly: createAssemblyExecutorForEnvironment(),
  });
  await healthCheck();
  await phaseOneRuntime.recordingsService.recoverPendingTranscriptions();
  await phaseOneRuntime.recordingsService.recoverPendingAssemblies();
  await phaseOneRuntime.recordingsService.recoverPendingAudioAssets();
  const sweeps = phaseOneRuntime.recordingsService.startSweeps();
  const r2Client = isAudioConfigured()
    ? createR2StorageClient(config.r2)
    : null;
  const reconciliationService = createReconciliationService({
    pool,
    r2Client,
    config: {
      r2: config.r2,
      audioReconciliation: config.audioReconciliation,
      audioReconciliationSuspended: config.audioReconciliationSuspended,
    },
    logger: emitStructuredEvent,
  });
  const reconciliationScheduler = startReconciliationScheduler(
    reconciliationService,
  );
  const server = createAppServer({ phaseOneRuntime });
  server.listen(config.port, config.host, () => {
    console.log(`StoryForge V5 listening on ${config.host}:${config.port}`);
  });
  const shutdown = async () => {
    sweeps.stop();
    reconciliationScheduler.stop();
    server.close();
    await closePool();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    emitStructuredError(safeRequestFailureEvent(
      { status: 500, code: error?.code || 'startup_failed' },
    ));
    process.exitCode = 1;
  });
}
