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

function header(request, name) {
  if (typeof request?.headers?.get === 'function') return String(request.headers.get(name) || '').trim();
  return String(request?.headers?.[name.toLowerCase()] || request?.headers?.[name] || '').trim();
}

async function readJsonBody(request) {
  const contentType = header(request, 'content-type').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    const error = new Error('JSON content type is required.');
    error.code = 'VALIDATION_FAILED';
    throw error;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 256_000) {
      const error = new Error('Request is too large.');
      error.code = 'VALIDATION_FAILED';
      throw error;
    }
    chunks.push(buffer);
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Malformed JSON.');
    error.code = 'VALIDATION_FAILED';
    throw error;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const error = new Error('JSON object is required.');
    error.code = 'VALIDATION_FAILED';
    throw error;
  }
  return payload;
}

function assertExactKeys(payload, allowed) {
  const unexpected = Object.keys(payload).filter((key) => !allowed.includes(key));
  if (unexpected.length) {
    const error = new Error('Unexpected request fields.');
    error.code = 'VALIDATION_FAILED';
    throw error;
  }
}

function idempotencyKey(request) {
  const value = header(request, 'idempotency-key');
  if (!value || value.length > 200) {
    const error = new Error('A bounded Idempotency-Key header is required.');
    error.code = 'VALIDATION_FAILED';
    throw error;
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
