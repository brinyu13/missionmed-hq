import { createRecommendationArtifactService } from '../services/artifact-service.js';

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
 * @property {(input: { actor: unknown, idempotencyKey: string }) => Promise<{id: string}>} createCase
 * @property {(input: { caseId: unknown, actor: unknown }) => Promise<unknown>} getCaseProjection
 * @property {(input: { caseId: unknown, actor: unknown }) => Promise<unknown>} resumeBuilder
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, stepId: unknown, stepData: unknown }) => Promise<unknown>} autosaveBuilder
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, stepId: unknown }) => Promise<unknown>} completeBuilderStep
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, receiptType: unknown, receiptData: unknown }) => Promise<unknown>} recordReceipt
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, documentId: unknown }) => Promise<unknown>} releaseFinalDocument
 * @property {{ getStudentEntitlement: (input: { studentId: string }) => Promise<any> }} [entitlementPort] read, never invoked for an authorization decision - see createLorApplicationAdapter
 * @property {() => Date | string | number} [clock]
 * @property {boolean} [requireCanary]
 */

/**
 * @typedef {object} RecommendationCaseRepositoryContract
 * @property {boolean} [isDurable]
 * @property {string} [durability]
 * @property {(caseId: string) => Promise<Record<string, unknown>>} [getById]
 */

/**
 * @typedef {object} RecommendationArtifactServiceContract
 * @property {(input: { actor: unknown, caseId: string }) => Promise<{ artifact: { buffer: Buffer, mimeType: string }, filename: string }>} exportFinalDocumentArtifact
 */

/**
 * @typedef {object} LorApplicationAdapterOptions
 * @property {RecommendationCaseServiceContract} [caseService]
 * @property {RecommendationCaseRepositoryContract} [repository]
 * @property {RecommendationArtifactServiceContract | null} [artifactService]
 * @property {{ emit: (event: unknown) => Promise<unknown> } | null} [artifactAuditSink]
 * @property {boolean} [providersReady]
 * @property {boolean} [allAcceptedFunctionsOperational]
 * @property {boolean} [allowNonDurableForTests]
 */

/**
 * @typedef {object} LorApplicationContract
 * @property {(context?: unknown) => Promise<Record<string, unknown>>} getBootstrap
 * @property {(input: { request: ApplicationRequest, url: URL, actor: unknown }) => Promise<{ status: number, body?: unknown, binary?: { body: Buffer, contentType: string, filename: string } }>} handleRequest
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
  if (code === 'INVITATION_DENIED') {
    // The denial reason stays on the thrown error for server-side audit and telemetry.
    // It is never echoed to the client: distinguishing token, recipient, OTP, expiry, and
    // lockout denials would turn this response into an invitation-state probing oracle.
    return {
      status: 403,
      body: {
        error: 'invitation_denied',
        message: SAFE_ERROR_MESSAGES.INVITATION_DENIED,
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
  const match = pathname.match(
    /^\/api\/lor-studio\/cases\/([^/]+)(?:\/(?:(builder)(?:\/(complete))?|(receipts)|(final-document)\/(release|export)))?$/u,
  );
  if (!match) return null;
  return {
    caseId: decodeURIComponent(match[1]),
    builder: match[2] === 'builder',
    complete: match[3] === 'complete',
    receipts: match[4] === 'receipts',
    // Only the explicit two-segment paths route. `/final-document` on its own is not a resource
    // here, so it falls through to the not-found body rather than to the projection.
    releaseFinalDocument: match[5] === 'final-document' && match[6] === 'release',
    exportFinalDocument: match[5] === 'final-document' && match[6] === 'export',
  };
}

/**
 * @param {LorApplicationAdapterOptions} [options]
 * @returns {Readonly<LorApplicationContract>}
 */
export function createLorApplicationAdapter({
  caseService,
  repository,
  artifactService = null,
  artifactAuditSink = null,
  providersReady = false,
  allAcceptedFunctionsOperational = false,
  allowNonDurableForTests = false,
} = {}) {
  if (!caseService) throw new Error('RecommendationCaseService is required.');
  if (!repository) throw new Error('Recommendation case repository is required.');
  if (repository.isDurable !== true && allowNonDurableForTests !== true) {
    throw new Error('Non-durable LOR repositories may only be used by an explicit test harness.');
  }

  /**
   * The artifact export path. An injected service wins; otherwise one is built from the two
   * dependencies this adapter already holds, so the export route is live wherever the rest of the
   * API is live rather than needing a separate composition change to stop being dark.
   *
   * The entitlement port is read off the case service because that is the ONLY dependency the
   * artifact service needs which this adapter is not given directly, and reading it is a data
   * lookup, not an authorisation decision - every access decision still happens in
   * security/authorization-policy.js and documents/artifact-access-policy.mjs.
   *
   * `requireCanary` is mirrored only when the case service states it as an explicit boolean.
   * Coercing an absent value would silently evaluate entitlement with a WEAKER canary requirement
   * than the rest of the application, and a weaker gate reached by accident is still a weaker
   * gate; absence therefore falls through to the artifact service's fail-closed default.
   */
  let resolvedArtifactService = null;
  if (artifactService) {
    if (typeof artifactService.exportFinalDocumentArtifact !== 'function') {
      throw new Error('An injected LOR artifact service must implement exportFinalDocumentArtifact.');
    }
    resolvedArtifactService = artifactService;
  } else if (
    typeof repository.getById === 'function'
    && typeof caseService?.entitlementPort?.getStudentEntitlement === 'function'
  ) {
    // Narrowed deliberately: the `typeof repository.getById === 'function'` guard above has
    // already established the shape the artifact service requires, but the guard narrows the
    // property rather than the object it is read from.
    const artifactRepository = /** @type {{ getById: (caseId: string) => Promise<Record<string, any>> }} */ (
      /** @type {unknown} */ (repository)
    );
    const artifactOptions = {
      repository: artifactRepository,
      entitlementPort: caseService.entitlementPort,
    };
    if (artifactAuditSink) artifactOptions.auditSink = artifactAuditSink;
    if (typeof caseService.clock === 'function') artifactOptions.clock = caseService.clock;
    if (typeof caseService.requireCanary === 'boolean') {
      artifactOptions.requireCanary = caseService.requireCanary;
    }
    resolvedArtifactService = createRecommendationArtifactService(artifactOptions);
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
        assertExactKeys(payload, []);
        const created = await caseService.createCase({
          actor,
          idempotencyKey: idempotencyKey(request),
        });
        const projection = await caseService.getCaseProjection({ caseId: created.id, actor });
        return { status: 201, body: { case: projection } };
      }

      const route = routeCase(url.pathname);
      if (!route) return { status: 404, body: { error: 'lor_route_not_found' } };

      if (
        !route.builder
        && !route.receipts
        && !route.releaseFinalDocument
        && !route.exportFinalDocument
        && method === 'GET'
      ) {
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
      }

      if (route.exportFinalDocument && method === 'GET') {
        // A download, so GET - which also means the runtime's CSRF gate does not apply and must
        // not be relied on here. Nothing about this request is trusted except the path: the
        // authenticated actor comes from the runtime, and EVERY other input the export turns on
        // (privacy class, purpose, destination, entitlement, waiver state, release state) is
        // resolved server-side from the stored case.
        //
        // The query string is therefore empty by contract. Rejecting rather than ignoring extra
        // parameters is what keeps `?privacyGrant=...`, `?privacyClass=...`, or `?actor=...` from
        // ever becoming something a future reader of this route mistakes for input.
        if ([...url.searchParams.keys()].length > 0) {
          throw validationError('The final-document export accepts no query parameters.');
        }
        if (!resolvedArtifactService) {
          throw Object.assign(
            new Error('The LOR artifact export service is not configured.'),
            { code: 'INTEGRATION_DISABLED' },
          );
        }
        const exported = await resolvedArtifactService.exportFinalDocumentArtifact({
          actor,
          caseId: route.caseId,
        });
        return {
          status: 200,
          binary: {
            body: exported.artifact.buffer,
            contentType: exported.artifact.mimeType,
            filename: exported.filename,
          },
        };
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

      if (route.receipts && method === 'POST') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['expectedRevision', 'receiptType', 'receiptData']);
        // Only the decision itself crosses the wire. Receipt identity, the recorded timestamp,
        // the owning case, the acting principal, and the integrity hash are minted by the
        // service; the supersession chain is enforced by the aggregate, not relaxed here.
        await caseService.recordReceipt({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
          receiptType: payload.receiptType,
          receiptData: payload.receiptData,
        });
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 201, body: { case: projection } };
      }

      if (route.releaseFinalDocument && method === 'POST') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['expectedRevision', 'documentId']);
        // Exactly two facts cross the wire: the revision the caller reasoned about, and the
        // document that revision names. There is deliberately no field here for the acting
        // writer, the release time, or `releasedToStudentAt` - student visibility is derived by
        // the aggregate from its own release record, so no request body can assert it.
        await caseService.releaseFinalDocument({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
          documentId: payload.documentId,
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
