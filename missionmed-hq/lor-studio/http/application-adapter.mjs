const SAFE_ERROR_MESSAGES = Object.freeze({
  AUTHORIZATION_DENIED: 'Access to this recommendation case was denied.',
  DOMAIN_INVARIANT: 'The requested case transition is not valid.',
  IDEMPOTENCY_CONFLICT: 'The idempotency key conflicts with an earlier request.',
  INTEGRATION_DISABLED: 'A required integration is unavailable.',
  INVITATION_DENIED: 'Faculty invitation verification was denied.',
  NOT_FOUND: 'The requested recommendation case was not found.',
  STALE_REVISION: 'The case changed after it was loaded. Reload before retrying.',
  VALIDATION_FAILED: 'The request payload is invalid.',
});

/** @typedef {Record<string, unknown> & { get?: (name: string) => unknown }} ApplicationHeaders */
/** @typedef {import('node:stream').Readable & { method?: string, headers?: ApplicationHeaders }} ApplicationRequest */

/**
 * @typedef {object} RecommendationCaseServiceContract
 * @property {(input: { caseId: unknown, actor: unknown, idempotencyKey: string }) => Promise<unknown>} createCase
 * @property {(input: { caseId: unknown, actor: unknown }) => Promise<unknown>} getCaseProjection
 * @property {(input: { caseId: unknown, actor: unknown }) => Promise<unknown>} resumeBuilder
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, stepId: unknown, stepData: unknown }) => Promise<unknown>} autosaveBuilder
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, stepId: unknown }) => Promise<unknown>} completeBuilderStep
 */

/**
 * @typedef {object} RecommendationCaseRepositoryContract
 * @property {boolean} [isDurable]
 * @property {string} [durability]
 */

/**
 * @typedef {object} LorApplicationAdapterOptions
 * @property {RecommendationCaseServiceContract} [caseService]
 * @property {RecommendationCaseRepositoryContract} [repository]
 * @property {boolean} [providersReady]
 * @property {boolean} [allAcceptedFunctionsOperational]
 * @property {boolean} [allowNonDurableForTests]
 */

/**
 * @typedef {object} LorApplicationContract
 * @property {(context?: unknown) => Promise<Record<string, unknown>>} getBootstrap
 * @property {(input: { request: ApplicationRequest, url: URL, actor: unknown }) => Promise<{ status: number, body: unknown }>} handleRequest
 */

/**
 * @param {ApplicationRequest} request
 * @param {string} name
 */
function header(request, name) {
  if (typeof request?.headers?.get === 'function') return String(request.headers.get(name) || '').trim();
  return String(request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '').trim();
}

/** @param {string} message */
function validationError(message) {
  return Object.assign(new Error(message), { code: 'VALIDATION_FAILED' });
}

/** @param {ApplicationRequest} request */
async function readJsonBody(request) {
  const contentType = header(request, 'content-type').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw validationError('JSON content type is required.');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 256_000) {
      throw validationError('Request is too large.');
    }
    chunks.push(buffer);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw validationError('Malformed JSON.');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw validationError('JSON object is required.');
  }
  return payload;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string[]} allowed
 */
function assertExactKeys(payload, allowed) {
  const unexpected = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unexpected.length) {
    throw validationError('Unexpected request fields.');
  }
}

/** @param {ApplicationRequest} request */
function idempotencyKey(request) {
  const value = header(request, 'idempotency-key');
  if (!value || value.length > 200) {
    throw validationError('A bounded Idempotency-Key header is required.');
  }
  return value;
}

function mapError(error) {
  const code = String(error?.code || 'INTERNAL_ERROR');
  const reasonCode = String(error?.details?.reasonCode || '');
  if (code === 'AUTHORIZATION_DENIED') {
    return {
      status: 404,
      body: {
        error: 'not_found',
        message: SAFE_ERROR_MESSAGES.NOT_FOUND,
      },
    };
  }
  const status = {
    AUTHORIZATION_DENIED: 403,
    DOMAIN_INVARIANT: 409,
    IDEMPOTENCY_CONFLICT: 409,
    INTEGRATION_DISABLED: 503,
    INVITATION_DENIED: 403,
    NOT_FOUND: 404,
    STALE_REVISION: 409,
    VALIDATION_FAILED: 400,
  }[code] || 500;
  const result = {
    status,
    body: {
      error: code.toLowerCase(),
      message: SAFE_ERROR_MESSAGES[code] || 'The LOR Studio request failed safely.',
    },
  };
  if (reasonCode && /^[A-Z0-9_:-]{1,120}$/u.test(reasonCode)) result.body.reasonCode = reasonCode;
  return result;
}

function routeCase(pathname) {
  const match = pathname.match(/^\/api\/lor-studio\/cases\/([^/]+)(?:\/(builder)(?:\/(complete))?)?$/u);
  if (!match) return null;
  return {
    caseId: decodeURIComponent(match[1]),
    builder: match[2] === 'builder',
    complete: match[3] === 'complete',
  };
}

/**
 * @param {LorApplicationAdapterOptions} [options]
 * @returns {Readonly<LorApplicationContract>}
 */
export function createLorApplicationAdapter({
  caseService,
  repository,
  providersReady = false,
  allAcceptedFunctionsOperational = false,
  allowNonDurableForTests = false,
} = {}) {
  if (!caseService) throw new Error('RecommendationCaseService is required.');
  if (!repository) throw new Error('Recommendation case repository is required.');
  if (repository.isDurable !== true && allowNonDurableForTests !== true) {
    throw new Error('Non-durable LOR repositories may only be used by an explicit test harness.');
  }

  async function getBootstrap() {
    const storageMode = repository.isDurable === true ? 'durable' : String(repository.durability || 'NON_DURABLE_TEST_ONLY');
    const operational = repository.isDurable === true
      && providersReady === true
      && allAcceptedFunctionsOperational === true;
    return {
      operational,
      runtimeMode: operational ? 'live' : 'unavailable',
      storageMode,
      providersReady: providersReady === true,
      capabilities: {
        builder: true,
        autosave: true,
        resume: true,
        versionHistory: true,
        durableStorage: repository.isDurable === true,
        fullAcceptedFunctionSet: allAcceptedFunctionsOperational === true,
      },
    };
  }

  /** @param {{ request: ApplicationRequest, url: URL, actor: unknown }} input */
  async function handleRequest({ request, url, actor }) {
    try {
      const method = String(request.method || 'GET').toUpperCase();
      if (url.pathname === '/api/lor-studio/cases' && method === 'POST') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['caseId']);
        await caseService.createCase({
          caseId: payload.caseId,
          actor,
          idempotencyKey: idempotencyKey(request),
        });
        const projection = await caseService.getCaseProjection({ caseId: payload.caseId, actor });
        return { status: 201, body: { case: projection } };
      }

      const route = routeCase(url.pathname);
      if (!route) return { status: 404, body: { error: 'lor_route_not_found' } };

      if (!route.builder && method === 'GET') {
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
      }

      if (route.builder && !route.complete && method === 'GET') {
        const resume = await caseService.resumeBuilder({ caseId: route.caseId, actor });
        return { status: 200, body: resume };
      }

      if (route.builder && !route.complete && method === 'PATCH') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['expectedRevision', 'stepId', 'stepData']);
        await caseService.autosaveBuilder({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
          stepId: payload.stepId,
          stepData: payload.stepData,
        });
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
      }

      if (route.complete && method === 'POST') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['expectedRevision', 'stepId']);
        await caseService.completeBuilderStep({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
          stepId: payload.stepId,
        });
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
      }

      return {
        status: 405,
        body: { error: 'method_not_allowed' },
      };
    } catch (error) {
      return mapError(error);
    }
  }

  return Object.freeze({ getBootstrap, handleRequest });
}
