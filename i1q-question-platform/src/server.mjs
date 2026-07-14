import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthorizationError, localDemoActor } from './auth.mjs';
import { ENTITY_TYPES, PLATFORM_VERSION } from './contracts.mjs';
import { createSyntheticDemoPlatform } from './platform.mjs';

const MODULE_DIR = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = normalize(join(MODULE_DIR, '..', 'public'));
const MAX_BODY_BYTES = 1_000_000;

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
});

function setSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cache-Control', 'no-store');
}

function json(response, statusCode, payload) {
  setSecurityHeaders(response);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('request_body_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

function dashboard(platform, actor) {
  const count = (entityType) => platform.list(entityType, { limit: 1 }, actor).total;
  const governance = platform.governance(actor);
  const unassigned = Object.entries(governance).filter(([, owner]) => owner === null).map(([slot]) => slot);
  return {
    inventory_sources: count('inventory_sources'),
    extraction_jobs: count('batch_jobs'),
    candidates: count('extraction_candidates'),
    review_assignments: count('review_assignments'),
    blocked_releases: count('release_snapshots'),
    incidents: count('incident_records'),
    current_release: null,
    governance_unassigned: unassigned,
    production_gate: 'BLOCKED_EXTERNAL_AUTH_AND_GOVERNANCE',
  };
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const relative = normalize(requested).replace(/^([/\\])+/, '');
  const filePath = normalize(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    json(response, 404, { error: 'not_found' });
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error('not_file');
    }
    setSecurityHeaders(response);
    response.statusCode = 200;
    response.setHeader('Content-Type', MIME[extname(filePath)] || 'application/octet-stream');
    createReadStream(filePath).pipe(response);
  } catch {
    json(response, 404, { error: 'not_found' });
  }
}

export function createQuestionPlatformServer({
  platform = createSyntheticDemoPlatform(),
  localDemo = false,
  identityResolver = null,
} = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === '/api/health') {
      json(response, 200, {
        ok: true,
        service: 'i1q-question-platform',
        version: PLATFORM_VERSION,
        mode: localDemo ? 'LOCAL_SYNTHETIC_DEMO' : 'AUTH_ADAPTER_REQUIRED',
      });
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      await serveStatic(url.pathname, response);
      return;
    }

    try {
      const actor = identityResolver
        ? await identityResolver(request)
        : localDemoActor(request, localDemo);

      if (request.method === 'GET' && url.pathname === '/api/v1/dashboard') {
        json(response, 200, dashboard(platform, actor));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/governance') {
        json(response, 200, platform.governance(actor));
        return;
      }
      const governanceMatch = url.pathname.match(/^\/api\/v1\/governance\/([a-z_]+)$/u);
      if (request.method === 'PUT' && governanceMatch) {
        const body = await readJson(request);
        json(response, 200, platform.assignGovernanceSlot(governanceMatch[1], body.reviewer_id, actor));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/reviewers') {
        const body = await readJson(request);
        json(response, 201, platform.registerReviewer(body, actor, { id: body.id }));
        return;
      }
      const flagMatch = url.pathname.match(/^\/api\/v1\/feature-flags\/([a-z_]+)$/u);
      if (request.method === 'PUT' && flagMatch) {
        const body = await readJson(request);
        json(response, 200, platform.setFeatureFlag(flagMatch[1], body.enabled, body.scope, actor));
        return;
      }

      const resourceMatch = url.pathname.match(/^\/api\/v1\/resources\/([a-z_]+)(?:\/([^/]+))?$/u);
      if (resourceMatch) {
        const [, entityType, id] = resourceMatch;
        if (!ENTITY_TYPES.includes(entityType)) {
          json(response, 404, { error: 'unknown_resource' });
          return;
        }
        if (request.method === 'GET' && id) {
          json(response, 200, platform.get(entityType, id, actor));
          return;
        }
        if (request.method === 'GET') {
          json(response, 200, platform.list(entityType, {
            cursor: url.searchParams.get('cursor') || '',
            limit: url.searchParams.get('limit') || 50,
          }, actor));
          return;
        }
        if (request.method === 'POST' && !id) {
          const body = await readJson(request);
          json(response, 201, platform.create(entityType, body, actor, {
            idempotencyKey: request.headers['idempotency-key'],
          }));
          return;
        }
        if (request.method === 'PATCH' && id) {
          const body = await readJson(request);
          json(response, 200, platform.update(entityType, id, body, actor, {
            expectedHash: request.headers['if-match'],
          }));
          return;
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/item-revisions') {
        json(response, 201, platform.createRevision(await readJson(request), actor, {
          idempotencyKey: request.headers['idempotency-key'],
        }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/review-assignments') {
        json(response, 201, platform.createReviewAssignment(await readJson(request), actor));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/review-events') {
        json(response, 201, platform.submitReviewEvent(await readJson(request), actor));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/releases') {
        json(response, 201, platform.assembleRelease(await readJson(request), actor));
        return;
      }
      const promotionMatch = url.pathname.match(/^\/api\/v1\/releases\/([^/]+)\/promotions$/u);
      if (request.method === 'POST' && promotionMatch) {
        const body = await readJson(request);
        json(response, 201, platform.promoteRelease(promotionMatch[1], body.to_state, actor));
        return;
      }
      const artifactMatch = url.pathname.match(/^\/api\/v1\/releases\/([^/]+)\/artifacts\/([^/]+)$/u);
      if (request.method === 'GET' && artifactMatch) {
        json(response, 200, platform.artifactForPhase(
          artifactMatch[1],
          artifactMatch[2],
          url.searchParams.get('phase') || 'pre_answer',
          actor,
        ));
        return;
      }

      json(response, 404, { error: 'not_found' });
    } catch (error) {
      const statusCode = error.statusCode || (error instanceof AuthorizationError ? error.statusCode : 500);
      json(response, statusCode, {
        error: statusCode >= 500 ? 'internal_error' : error.code || error.message,
      });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = '127.0.0.1';
  const port = Number(process.env.PORT || 4176);
  const localDemo = process.env.I1Q_LOCAL_DEMO === '1';
  const server = createQuestionPlatformServer({ localDemo });
  server.listen(port, host, () => {
    process.stdout.write(`I1Q Question Platform listening on http://${host}:${port} (${localDemo ? 'local-demo' : 'auth-required'})\n`);
  });
}
