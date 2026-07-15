import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AuthorizationError,
  assertLocalDemoConfiguration,
  createTrustedFinalizationContext,
  enforceRequestIntegrity,
  localDemoActor,
  normalizeIdentityContext,
} from './auth.mjs';
import { ENTITY_TYPES, PLATFORM_VERSION } from './contracts.mjs';
import { QuestionPlatform, createSyntheticDemoPlatform } from './platform.mjs';

const MODULE_DIR = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = normalize(join(MODULE_DIR, '..', 'public'));
const MAX_BODY_BYTES = 1_000_000;
const SHA256_HEX = /^[0-9a-f]{64}$/u;
const REVIEW_CONTENT_FIELDS = new Set([
  'item_revision_id',
  'assignment_id',
  'exact_revision_hash',
  'review_type',
  'prompt',
  'choices',
  'answer',
  'explanation',
  'correct_answer_rationale',
  'source_ids',
  'evidence_claim_ids',
]);
const REVIEW_CHOICE_FIELDS = new Set([
  'key',
  'text',
  'why_tempting',
  'why_wrong',
  'misconception_id',
]);

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
      error.code = 'request_body_too_large';
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
    error.code = 'invalid_json';
    error.statusCode = 400;
    throw error;
  }
}

function publicErrorCode(error, statusCode) {
  if (statusCode >= 500) {
    return 'internal_error';
  }
  if (error instanceof AuthorizationError) {
    return error.code;
  }
  const code = typeof error?.code === 'string' ? error.code.split(':', 1)[0] : '';
  if (['invalid_json', 'request_body_too_large', 'workflow_endpoint_required'].includes(code)) {
    return code;
  }
  if (statusCode === 404) {
    return 'not_found';
  }
  if (statusCode === 409) {
    return 'request_conflict';
  }
  if (statusCode === 403) {
    return 'request_forbidden';
  }
  return 'request_rejected';
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

function exactKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

function normalizeReviewContent(payload, { itemRevisionId, assignmentId, purpose }) {
  const reviewType = purpose === 'editorial_review'
    ? 'editorial'
    : purpose === 'medical_review' ? 'medical' : null;
  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  const sourceIds = Array.isArray(payload?.source_ids) ? payload.source_ids : [];
  const claimIds = Array.isArray(payload?.evidence_claim_ids) ? payload.evidence_claim_ids : [];
  const stableString = (value) => typeof value === 'string' && value.trim() === value && value.length > 0;
  if (
    !reviewType
    || !exactKeys(payload, REVIEW_CONTENT_FIELDS)
    || payload.item_revision_id !== itemRevisionId
    || payload.assignment_id !== assignmentId
    || payload.review_type !== reviewType
    || !SHA256_HEX.test(payload.exact_revision_hash || '')
    || !stableString(payload.prompt)
    || !['A', 'B', 'C', 'D'].includes(payload.answer)
    || !stableString(payload.explanation)
    || !stableString(payload.correct_answer_rationale)
    || choices.length !== 4
    || sourceIds.length === 0
    || claimIds.length === 0
    || !sourceIds.every(stableString)
    || !claimIds.every(stableString)
  ) {
    throw new AuthorizationError('review_content_adapter_invalid', 500);
  }
  const choiceKeys = new Set();
  for (const choice of choices) {
    if (
      !exactKeys(choice, REVIEW_CHOICE_FIELDS)
      || !['A', 'B', 'C', 'D'].includes(choice.key)
      || choiceKeys.has(choice.key)
      || !stableString(choice.text)
    ) {
      throw new AuthorizationError('review_content_adapter_invalid', 500);
    }
    choiceKeys.add(choice.key);
    const correct = choice.key === payload.answer;
    if (correct) {
      if (choice.why_tempting !== null || choice.why_wrong !== null || choice.misconception_id !== null) {
        throw new AuthorizationError('review_content_adapter_invalid', 500);
      }
    } else if (
      !stableString(choice.why_tempting)
      || !stableString(choice.why_wrong)
      || !stableString(choice.misconception_id)
    ) {
      throw new AuthorizationError('review_content_adapter_invalid', 500);
    }
  }
  if (choiceKeys.size !== 4) {
    throw new AuthorizationError('review_content_adapter_invalid', 500);
  }
  return structuredClone(payload);
}

async function serveStatic(pathname, response) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const relative = normalize(requested).replace(/^([/\\])+/, '');
  const filePath = normalize(join(PUBLIC_DIR, relative));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
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
  platform: suppliedPlatform = null,
  localDemo = false,
  identityResolver = null,
  finalizationResolver = null,
  reviewContentResolver = null,
} = {}) {
  assertLocalDemoConfiguration(localDemo);
  if (localDemo && identityResolver) {
    throw new AuthorizationError('local_demo_forbidden', 403);
  }
  if (identityResolver !== null && typeof identityResolver !== 'function') {
    throw new AuthorizationError('identity_adapter_required', 500);
  }
  if (finalizationResolver !== null && (typeof finalizationResolver !== 'function' || !identityResolver)) {
    throw new AuthorizationError('finalization_adapter_invalid', 500);
  }
  if (reviewContentResolver !== null && (typeof reviewContentResolver !== 'function' || !identityResolver)) {
    throw new AuthorizationError('review_content_adapter_invalid', 500);
  }
  const platform = suppliedPlatform || (localDemo ? createSyntheticDemoPlatform() : new QuestionPlatform());
  if (platform.syntheticDemo === true && (!localDemo || identityResolver)) {
    throw new AuthorizationError('local_demo_forbidden', 403);
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (localDemo) {
      try {
        localDemoActor(request, true);
      } catch (error) {
        json(response, error.statusCode || 401, { error: error.code || 'authentication_required' });
        return;
      }
    }
    if (url.pathname === '/api/health') {
      json(response, 200, {
        ok: true,
        service: 'i1q-question-platform',
        version: PLATFORM_VERSION,
        mode: localDemo
          ? 'LOCAL_SYNTHETIC_DEMO'
          : identityResolver ? 'INJECTED_AUTH_ADAPTER' : 'AUTH_ADAPTER_REQUIRED',
      });
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      await serveStatic(url.pathname, response);
      return;
    }

    try {
      let actor;
      let identityContext = null;
      if (identityResolver) {
        let resolved;
        try {
          resolved = await identityResolver(request);
        } catch {
          throw new AuthorizationError('authentication_required', 401);
        }
        identityContext = normalizeIdentityContext(resolved);
        enforceRequestIntegrity(request, identityContext);
        actor = identityContext.actor;
      } else {
        actor = localDemoActor(request, localDemo);
      }

      if (request.method === 'GET' && url.pathname === '/api/v1/session') {
        json(response, 200, {
          actor: { id: actor.id, roles: [...actor.roles] },
          session: identityContext ? {
            expires_at: identityContext.session.expiresAt,
            csrf_token: identityContext.requestSecurity?.csrfToken || null,
          } : {
            expires_at: null,
            csrf_token: null,
          },
        });
        return;
      }

      const featureFlagMutation = request.method === 'PUT'
        && /^\/api\/v1\/feature-flags\/[a-z_]+$/u.test(url.pathname);
      const reviewContentMatch = url.pathname.match(/^\/api\/v1\/item-revisions\/([^/]+)\/review-content$/u);
      if (
        !localDemo
        && !featureFlagMutation
        && !platform.featureFlagEnabled('internal_platform_enabled')
      ) {
        throw new AuthorizationError('internal_platform_disabled', 403);
      }

      const reviewMutation = request.method === 'POST' && (
        url.pathname === '/api/v1/review-assignments'
        || /^\/api\/v1\/review-assignments\/[^/]+\/accept$/u.test(url.pathname)
        || url.pathname === '/api/v1/review-events'
      );
      const reviewRoute = reviewMutation || (request.method === 'GET' && reviewContentMatch);
      if (
        !localDemo
        && reviewRoute
        && !platform.featureFlagEnabled('internal_review_enabled')
      ) {
        throw new AuthorizationError('internal_review_disabled', 403);
      }

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
        json(response, 201, platform.registerReviewer(body, actor));
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
      const draftRevisionMatch = url.pathname.match(/^\/api\/v1\/item-revisions\/([^/]+)\/draft$/u);
      if (request.method === 'PATCH' && draftRevisionMatch) {
        json(response, 200, platform.editDraftRevision(draftRevisionMatch[1], await readJson(request), actor));
        return;
      }
      const submitRevisionMatch = url.pathname.match(/^\/api\/v1\/item-revisions\/([^/]+)\/submit-candidate$/u);
      if (request.method === 'POST' && submitRevisionMatch) {
        json(response, 200, platform.submitRevisionCandidate(submitRevisionMatch[1], actor));
        return;
      }
      if (request.method === 'GET' && reviewContentMatch) {
        const itemRevisionId = decodeURIComponent(reviewContentMatch[1]);
        const assignmentId = url.searchParams.get('assignment_id') || '';
        const purpose = url.searchParams.get('purpose') || '';
        let content;
        if (localDemo) {
          content = platform.readAssignedReviewContent(itemRevisionId, assignmentId, purpose, actor);
        } else {
          if (!reviewContentResolver) {
            throw new AuthorizationError('review_content_adapter_required', 503);
          }
          content = await reviewContentResolver({
            request,
            identityContext,
            actor,
            itemRevisionId,
            assignmentId,
            purpose,
          });
        }
        json(response, 200, normalizeReviewContent(content, { itemRevisionId, assignmentId, purpose }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/review-assignments') {
        json(response, 201, platform.createReviewAssignment(await readJson(request), actor));
        return;
      }
      const acceptAssignmentMatch = url.pathname.match(/^\/api\/v1\/review-assignments\/([^/]+)\/accept$/u);
      if (request.method === 'POST' && acceptAssignmentMatch) {
        json(response, 200, platform.acceptReviewAssignment(acceptAssignmentMatch[1], actor));
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
      const validationMatch = url.pathname.match(/^\/api\/v1\/releases\/([^/]+)\/validations$/u);
      if (request.method === 'POST' && validationMatch) {
        json(response, 201, platform.recordReleaseValidation(
          validationMatch[1],
          await readJson(request),
          actor,
        ));
        return;
      }
      const promotionMatch = url.pathname.match(/^\/api\/v1\/releases\/([^/]+)\/promotions$/u);
      if (request.method === 'POST' && promotionMatch) {
        const body = await readJson(request);
        json(response, 201, platform.promoteRelease(promotionMatch[1], body, actor));
        return;
      }
      const artifactMatch = url.pathname.match(/^\/api\/v1\/releases\/([^/]+)\/artifacts\/([^/]+)$/u);
      if (request.method === 'GET' && artifactMatch) {
        let finalizationContext = null;
        if (finalizationResolver) {
          try {
            const resolvedFinalization = await finalizationResolver({
              request,
              identityContext,
              releaseId: artifactMatch[1],
              channel: artifactMatch[2],
            });
            if (resolvedFinalization) {
              finalizationContext = createTrustedFinalizationContext(resolvedFinalization, {
                identityContext,
                releaseId: artifactMatch[1],
                channel: artifactMatch[2],
              });
            }
          } catch {
            finalizationContext = null;
          }
        }
        json(response, 200, platform.artifactForPhase(
          artifactMatch[1],
          artifactMatch[2],
          finalizationContext,
          actor,
        ));
        return;
      }

      json(response, 404, { error: 'not_found' });
    } catch (error) {
      const statusCode = error.statusCode || (error instanceof AuthorizationError ? error.statusCode : 500);
      json(response, statusCode, {
        error: publicErrorCode(error, statusCode),
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
