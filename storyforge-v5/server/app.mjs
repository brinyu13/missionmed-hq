import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, issueDevToken, isLoopbackRequest } from './auth.mjs';
import { config, isAudioConfigured, validateConfig } from './config.mjs';
import { closePool, healthCheck, pool, withIdentity } from './db.mjs';
import { previewImport } from './imports.mjs';
import { createAudioUpload, verifyAudioUpload } from './storage.mjs';

const jsonLimit = 6 * 1024 * 1024;
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
]);

function setSecurityHeaders(response) {
  const matrixOrigin = new URL(config.matrixBaseUrl).origin;
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    `frame-ancestors 'self' ${matrixOrigin}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
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
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

function publicError(error) {
  const databaseStatus = {
    '22023': 400,
    '23514': 409,
    '23505': 409,
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
    'eligibility_required',
    'invalid_role_claim',
    'invalid_subject_claim',
    'dev_auth_unavailable',
    'ai_feature_gated',
    'origin_not_allowed',
  ]);
  const inputCodes = new Set([
    'invalid_identifier',
    'invalid_json',
    'invalid_audio_size',
    'malformed_csv',
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
  ]);
  const status = databaseStatus
    || (authCodes.has(error?.code) ? 401 : null)
    || (forbiddenCodes.has(error?.code) ? 403 : null)
    || (error?.code === 'request_too_large' ? 413 : null)
    || (inputCodes.has(error?.code) ? 400 : null)
    || (unavailableCodes.has(error?.code) ? 503 : null)
    || 500;
  return {
    status,
    code: String(error?.code || 'request_failed'),
    message: status >= 500 && !unavailableCodes.has(error?.code)
      ? 'StoryForge could not complete this request.'
      : String(error?.message || 'Request failed.'),
  };
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > jsonLimit) {
      const error = new Error('Request exceeds the 6 MB limit.');
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
    ${p}classification, ${p}starred, ${p}needs_followup, ${p}uses,
    ${p}revision_no, ${p}submitted_at, ${p}opened_at, ${p}reviewed_at,
    ${p}approved_at, ${p}created_at, ${p}updated_at`;
}

async function api(request, response, url) {
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
    });
  }

  const devSession = url.pathname.match(/^\/api\/dev\/session\/([A-Za-z]+)$/);
  if (request.method === 'POST' && devSession) {
    const token = await issueDevToken(devSession[1], request);
    return sendJson(response, 200, { token, fixture: true });
  }

  const identity = await authorize(request);

  if (request.method === 'GET' && url.pathname === '/api/session') {
    const user = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, wp_user_id, display_name, role, eligible, cohort
         FROM public.sf_users WHERE id = $1`,
        [identity.sub],
      );
      return result.rows[0] || null;
    });
    if (!user) {
      const error = new Error('StoryForge profile is missing or eligibility was revoked.');
      error.code = 'eligibility_required';
      throw error;
    }
    return sendJson(response, 200, { user });
  }

  if (request.method === 'GET' && url.pathname === '/api/stories') {
    const rows = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT ${storyProjection('s')}, u.display_name AS student_name
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         ORDER BY s.updated_at DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { stories: rows });
  }

  if (request.method === 'POST' && url.pathname === '/api/stories') {
    const body = await readJson(request);
    const story = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT * FROM public.sf_create_story($1, $2, $3, $4)`,
        [body.title, body.text, body.captureType || 'text', body.surface || 'quick'],
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
        `SELECT ${storyProjection('s')}, u.display_name AS student_name
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         WHERE s.id = $1`,
        [id],
      );
      if (!storyResult.rows[0]) return null;
      const [revisions, feedback, mappings] = await Promise.all([
        client.query(
          `SELECT id, revision_no, text_snapshot, title_snapshot, actor_id, reason, created_at
           FROM public.sf_story_revisions WHERE story_id = $1 ORDER BY created_at`,
          [id],
        ),
        client.query(
          `SELECT f.id, f.mentor_id, u.display_name AS mentor_name, f.body, f.disposition, f.created_at
           FROM public.sf_feedback f JOIN public.sf_users u ON u.id = f.mentor_id
           WHERE f.story_id = $1 ORDER BY f.created_at`,
          [id],
        ),
        client.query(
          `SELECT sq.*, q.text AS question_text
           FROM public.sf_story_questions sq JOIN public.sf_questions q ON q.id = sq.question_id
           WHERE sq.story_id = $1`,
          [id],
        ),
      ]);
      return {
        story: storyResult.rows[0],
        revisions: revisions.rows,
        feedback: feedback.rows,
        questionMappings: mappings.rows,
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
        `SELECT * FROM public.sf_update_story($1, $2, $3, $4::smallint, $5::text[], $6)`,
        [id, body.title, body.text, body.studentScore, body.uses || null, body.surface || 'workspace'],
      );
      return result.rows[0];
    });
    return sendJson(response, 200, { story });
  }

  const storyAction = url.pathname.match(/^\/api\/stories\/([a-f0-9-]+)\/(submit|open|review)$/i);
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
      const result = await client.query(
        `SELECT u.id, u.display_name, u.cohort,
           count(s.id)::integer AS story_count,
           count(s.id) FILTER (WHERE s.status IN ('submitted', 'resubmitted'))::integer AS awaiting_review
         FROM public.sf_users u
         LEFT JOIN public.sf_stories s ON s.student_id = u.id
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
      const result = await client.query(
        `SELECT ${storyProjection('s')}, u.display_name AS student_name,
           CASE
             WHEN s.status IN ('submitted', 'resubmitted') THEN 'awaiting_review'
             WHEN s.status = 'opened' THEN 'in_review'
             WHEN s.status = 'needs_revision' THEN 'waiting_on_student'
             WHEN s.status = 'approved' THEN 'approved'
             ELSE 'other'
           END AS bucket
         FROM public.sf_stories s
         JOIN public.sf_users u ON u.id = s.student_id
         WHERE s.status <> 'private'
         ORDER BY coalesce(s.submitted_at, s.updated_at) DESC`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { stories });
  }

  if (request.method === 'GET' && url.pathname === '/api/questions') {
    const questions = await withIdentity(identity, async (client) => {
      const result = await client.query(
        `SELECT id, text, family, provenance, owner_student_id, import_batch_id,
          governance_state, created_by, approved_by, approved_at, created_at
         FROM public.sf_questions
         ORDER BY family, text`,
      );
      return result.rows;
    });
    return sendJson(response, 200, { questions });
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
      const result = await client.query(`SELECT id, text FROM public.sf_questions WHERE governance_state <> 'retired'`);
      return result.rows;
    });
    const rows = await previewImport({ ...body, existingQuestions });
    return sendJson(response, 200, { rows, selectedCount: rows.filter((row) => row.selected).length });
  }

  if (request.method === 'POST' && url.pathname === '/api/imports/commit') {
    const body = await readJson(request);
    const rows = Array.isArray(body.rows) ? body.rows.map((row) => ({
      text: String(row.text || ''),
      family: String(row.family || 'general'),
      selected: Boolean(row.selected),
    })) : [];
    const batch = await withIdentity(identity, async (client) => {
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
    const assetId = safeUuid(audioConfirm[1]);
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
    const result = await pool.query(
      `UPDATE public.sf_audio_assets
       SET state = 'verified', verified_at = now()
       WHERE id = $1 AND student_id = $2 AND state = 'pending'
       RETURNING *`,
      [assetId, identity.sub],
    );
    return sendJson(response, 200, { asset: result.rows[0], verified });
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
    } else if (/\/assets\/[^/]+\.[a-f0-9]{12}\.(?:css|js|svg|png|woff2?)$/i.test(filePath)) {
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

export function createAppServer() {
  return http.createServer(async (request, response) => {
    setSecurityHeaders(response);
    const url = new URL(request.url || '/', config.publicOrigin);
    try {
      if (request.method === 'GET' && url.pathname === '/healthz') {
        const db = await healthCheck();
        return sendJson(response, 200, {
          ok: true,
          service: 'storyforge-v5',
          database: db.database,
        });
      }
      if (url.pathname.startsWith('/api/')) {
        enforceAllowedOrigin(request, response);
        if (request.method === 'OPTIONS') {
          response.statusCode = 204;
          response.end();
          return;
        }
        return await api(request, response, url);
      }
      if (request.method === 'GET' && await serveStatic(response, url)) return;
      sendJson(response, 404, { error: { code: 'not_found', message: 'Resource not found.' } });
    } catch (error) {
      const failure = publicError(error);
      if (failure.status >= 500) console.error(error);
      sendJson(response, failure.status, { error: { code: failure.code, message: failure.message } });
    }
  });
}

async function start() {
  const errors = validateConfig();
  if (errors.length) {
    throw new Error(`StoryForge configuration is invalid: ${errors.join('; ')}`);
  }
  await healthCheck();
  const server = createAppServer();
  server.listen(config.port, config.host, () => {
    console.log(`StoryForge V5 listening on ${config.host}:${config.port}`);
  });
  const shutdown = async () => {
    server.close();
    await closePool();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
