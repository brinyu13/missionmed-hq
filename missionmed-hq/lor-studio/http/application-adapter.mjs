import { createRecommendationArtifactService } from '../services/artifact-service.js';
import { isVerifiedPrivateVersionedStorageAdapter } from '../adapters/private-versioned-storage-adapter.mjs';
import { isAuthenticDurableArtifactAuditSink } from '../repositories/supabase-durable-artifact-audit-sink.mjs';

const AUTHENTIC_LOR_APPLICATION_ADAPTERS = new WeakSet();

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
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string }) => Promise<unknown>} publishStudentEvidence
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, answers: unknown, notes: unknown, draftText: unknown, finalDocument: unknown, documentState: unknown, facultyApproval: unknown }) => Promise<unknown>} saveFacultyPrivateContent
 * @property {(input: { caseId: unknown, actor: unknown, expectedRevision: unknown, idempotencyKey: string, documentId: unknown }) => Promise<unknown>} releaseFinalDocument
 * @property {{ getStudentEntitlement: (input: { studentId: string }) => Promise<any> }} [entitlementPort] read, never invoked for an authorization decision - see createLorApplicationAdapter
 * @property {() => Date | string | number} [clock]
 * @property {boolean} [requireCanary]
 */

/**
 * @typedef {object} RecommendationCaseRepositoryContract
 * @property {boolean} [isDurable]
 * @property {string} [durability]
 * @property {boolean} [supportsStudentEvidencePublication]
 * @property {(caseId: string) => Promise<Record<string, unknown>>} [getById]
 * @property {(request: Record<string, unknown>) => Promise<Record<string, unknown>>} [commitStudentEvidencePublication]
 */

/**
 * @typedef {object} RecommendationArtifactServiceContract
 * @property {string} [auditMode]
 * @property {(input: { actor: unknown, caseId: string }) => Promise<{ artifact: { buffer: Buffer, mimeType: string }, filename: string }>} exportFinalDocumentArtifact
 */

/**
 * @typedef {object} AiDraftingServiceContract
 * @property {(input: { actor: unknown, caseId: string, idempotencyKey: string, factIds?: string[] | null }) => Promise<Record<string, unknown>>} requestProposal
 * @property {(input: { actor: unknown, caseId: string, proposalId: string, idempotencyKey: string, action: string, resultingText?: string | null }) => Promise<Record<string, unknown>>} recordProposalDecision
 * @property {(input: { actor: unknown, caseId: string, proposalId: string }) => Promise<Record<string, unknown>>} getProposal
 */

/**
 * @typedef {object} LorApplicationAdapterOptions
 * @property {RecommendationCaseServiceContract} [caseService]
 * @property {RecommendationCaseRepositoryContract} [repository]
 * @property {RecommendationArtifactServiceContract | null} [artifactService]
 * @property {AiDraftingServiceContract | null} [aiDraftingService]
 * @property {{ issue: Function, resendOtp: Function, revoke: Function } | null} [facultyInvitationLifecycleService]
 * @property {{ verify: Function } | null} [facultyInvitationVerificationService]
 * @property {{ durability: string, put: Function, get: Function } | null} [privateStorageService]
 * @property {{ emit: (event: unknown) => Promise<unknown> } | null} [artifactAuditSink]
 * @property {boolean} [providersReady]
 * @property {boolean} [allAcceptedFunctionsOperational]
 * @property {boolean} [allowNonDurableForTests]
 */

/**
 * @typedef {object} LorApplicationContract
 * @property {(context?: unknown) => Promise<Record<string, unknown>>} getBootstrap
 * @property {(input: { request: ApplicationRequest, url: URL, actor: unknown }) => Promise<{ status: number, body?: unknown, binary?: { body: Buffer, contentType: string, filename: string, sensitive?: boolean } }>} handleRequest
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
const DEFAULT_JSON_BODY_MAX_BYTES = 256_000;
const PRIVATE_ARTIFACT_MAX_BYTES = 52_428_800;
const PRIVATE_ARTIFACT_BASE64_MAX_LENGTH = Math.ceil(PRIVATE_ARTIFACT_MAX_BYTES / 3) * 4;
const PRIVATE_ARTIFACT_JSON_MAX_BYTES = 70_000_000;

async function readJsonBody(request, maximumBytes = DEFAULT_JSON_BODY_MAX_BYTES) {
  const contentType = header(request, 'content-type').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw validationError('JSON content type is required.');
  }
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw validationError('Request body limit is invalid.');
  }
  const declaredLength = header(request, 'content-length');
  if (
    declaredLength
    && (!/^(?:0|[1-9][0-9]*)$/u.test(declaredLength) || Number(declaredLength) > maximumBytes)
  ) throw validationError('Request is too large.');
  const chunks = [];
  let bytes = 0;
  let combined = null;
  let text = '';
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maximumBytes) {
        buffer.fill(0);
        throw validationError('Request is too large.');
      }
      chunks.push(buffer);
    }
    combined = Buffer.concat(chunks);
    text = combined.toString('utf8');
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw validationError('Malformed JSON.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw validationError('JSON object is required.');
    }
    return payload;
  } finally {
    text = '';
    combined?.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
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
  const privateArtifactMatch = pathname.match(
    /^\/api\/lor-studio\/cases\/([^/]+)\/private-artifacts\/([^/]+)(?:\/versions\/([^/]+))?$/u,
  );
  if (privateArtifactMatch) {
    const caseId = decodeRouteSegment(privateArtifactMatch[1]);
    const objectId = decodeRouteSegment(privateArtifactMatch[2]);
    const versionId = privateArtifactMatch[3] === undefined
      ? null : decodeRouteSegment(privateArtifactMatch[3]);
    if (caseId === null || objectId === null || (privateArtifactMatch[3] !== undefined && versionId === null)) {
      return null;
    }
    return {
      caseId,
      builder: false,
      complete: false,
      receipts: false,
      facultyPrivate: false,
      releaseFinalDocument: false,
      exportFinalDocument: false,
      aiProposals: false,
      proposalId: null,
      proposalDecision: false,
      facultyInvitations: false,
      publishStudentEvidence: false,
      invitationResend: false,
      invitationRevoke: false,
      privateArtifactPut: versionId === null,
      privateArtifactGet: versionId !== null,
      objectId,
      versionId,
    };
  }
  const facultyInvitationMatch = pathname.match(
    /^\/api\/lor-studio\/cases\/([^/]+)\/faculty-invitations(?:\/(otp\/resend|revoke))?$/u,
  );
  if (facultyInvitationMatch) {
    const caseId = decodeRouteSegment(facultyInvitationMatch[1]);
    if (caseId === null) return null;
    return {
      caseId,
      builder: false,
      complete: false,
      receipts: false,
      facultyPrivate: false,
      releaseFinalDocument: false,
      exportFinalDocument: false,
      aiProposals: false,
      proposalId: null,
      proposalDecision: false,
      facultyInvitations: true,
      publishStudentEvidence: false,
      invitationResend: facultyInvitationMatch[2] === 'otp/resend',
      invitationRevoke: facultyInvitationMatch[2] === 'revoke',
      privateArtifactPut: false,
      privateArtifactGet: false,
      objectId: null,
      versionId: null,
    };
  }
  const evidencePublishMatch = pathname.match(
    /^\/api\/lor-studio\/cases\/([^/]+)\/evidence\/publish$/u,
  );
  if (evidencePublishMatch) {
    const caseId = decodeRouteSegment(evidencePublishMatch[1]);
    if (caseId === null) return null;
    return {
      caseId,
      builder: false,
      complete: false,
      receipts: false,
      facultyPrivate: false,
      releaseFinalDocument: false,
      exportFinalDocument: false,
      aiProposals: false,
      proposalId: null,
      proposalDecision: false,
      facultyInvitations: false,
      publishStudentEvidence: true,
      invitationResend: false,
      invitationRevoke: false,
      privateArtifactPut: false,
      privateArtifactGet: false,
      objectId: null,
      versionId: null,
    };
  }
  const match = pathname.match(
    /^\/api\/lor-studio\/cases\/([^/]+)(?:\/(?:(builder)(?:\/(complete))?|(receipts)|(faculty-private)|(final-document)\/(release|export)|(ai-proposals)(?:\/([^/]+)(?:\/(decision))?)?))?$/u,
  );
  if (!match) return null;
  const caseId = decodeRouteSegment(match[1]);
  const proposalId = match[9] === undefined ? null : decodeRouteSegment(match[9]);
  if (caseId === null || (match[9] !== undefined && proposalId === null)) return null;
  return {
    caseId,
    builder: match[2] === 'builder',
    complete: match[3] === 'complete',
    receipts: match[4] === 'receipts',
    facultyPrivate: match[5] === 'faculty-private',
    // Only the explicit two-segment paths route. `/final-document` on its own is not a resource
    // here, so it falls through to the not-found body rather than to the projection.
    releaseFinalDocument: match[6] === 'final-document' && match[7] === 'release',
    exportFinalDocument: match[6] === 'final-document' && match[7] === 'export',
    // `/ai-proposals` is the collection, `/ai-proposals/:id` one proposal, and
    // `/ai-proposals/:id/decision` the mandatory human decision on it. Nothing deeper routes.
    aiProposals: match[8] === 'ai-proposals',
    proposalId,
    proposalDecision: match[10] === 'decision',
    facultyInvitations: false,
    publishStudentEvidence: false,
    invitationResend: false,
    invitationRevoke: false,
    privateArtifactPut: false,
    privateArtifactGet: false,
    objectId: null,
    versionId: null,
  };
}

function decodeRouteSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function routeFacultyInvitationVerification(pathname) {
  const match = pathname.match(
    /^\/api\/lor-studio\/invitations\/([^/]+)\/verify$/u,
  );
  if (!match) return null;
  const invitationId = decodeRouteSegment(match[1]);
  return invitationId === null ? null : { invitationId };
}

function decodeCanonicalBase64(value) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > PRIVATE_ARTIFACT_BASE64_MAX_LENGTH
  ) {
    throw validationError('Private artifact content must be bounded canonical base64.');
  }
  let content;
  try {
    content = Buffer.from(value, 'base64');
  } catch {
    throw validationError('Private artifact content must be bounded canonical base64.');
  }
  if (
    content.byteLength === 0
    || content.byteLength > PRIVATE_ARTIFACT_MAX_BYTES
    || content.toString('base64') !== value
  ) {
    content.fill(0);
    throw validationError('Private artifact content must be bounded canonical base64.');
  }
  return content;
}

/**
 * @param {LorApplicationAdapterOptions} [options]
 * @returns {Readonly<LorApplicationContract>}
 */
export function createLorApplicationAdapter({
  caseService,
  repository,
  artifactService = null,
  aiDraftingService = null,
  facultyInvitationLifecycleService = null,
  facultyInvitationVerificationService = null,
  privateStorageService = null,
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
  if (repository.isDurable === true && artifactService && allowNonDurableForTests !== true) {
    throw new Error('A durable LOR repository constructs its audited artifact service internally.');
  }
  if (
    repository.isDurable === true
    && artifactAuditSink
    && allowNonDurableForTests !== true
    && !isAuthenticDurableArtifactAuditSink(artifactAuditSink)
  ) {
    throw new Error('A durable LOR repository requires an authentic actor/case-bound artifact audit sink.');
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

  /**
   * The AI drafting plane. Unlike the artifact export above, NOTHING is auto-constructed here.
   * Building a drafting service means choosing a proposal provider and a durable proposal store,
   * and those are composition decisions with a credential and a persistence contract behind
   * them - an HTTP adapter that quietly picked defaults would be deciding, on a deployment's
   * behalf, that AI drafting is available. Absence therefore means the routes below fail closed
   * with INTEGRATION_DISABLED rather than behaving as though drafting merely returned nothing.
   */
  let resolvedAiDraftingService = null;
  if (aiDraftingService) {
    for (const method of ['requestProposal', 'recordProposalDecision', 'getProposal']) {
      if (typeof (/** @type {any} */ (aiDraftingService))[method] !== 'function') {
        throw new Error(`An injected LOR AI drafting service must implement ${method}.`);
      }
    }
    resolvedAiDraftingService = aiDraftingService;
  }
  let resolvedFacultyInvitationLifecycleService = null;
  if (facultyInvitationLifecycleService) {
    for (const method of ['issue', 'resendOtp', 'revoke']) {
      if (typeof facultyInvitationLifecycleService[method] !== 'function') {
        throw new Error(`An injected faculty invitation lifecycle service must implement ${method}.`);
      }
    }
    resolvedFacultyInvitationLifecycleService = facultyInvitationLifecycleService;
  }
  let resolvedFacultyInvitationVerificationService = null;
  if (facultyInvitationVerificationService) {
    if (typeof facultyInvitationVerificationService.verify !== 'function') {
      throw new Error('An injected faculty invitation verification service must implement verify.');
    }
    resolvedFacultyInvitationVerificationService = facultyInvitationVerificationService;
  }
  let resolvedPrivateStorageService = null;
  if (privateStorageService) {
    if (
      privateStorageService.durability !== 'DURABLE_PROVIDER_BOUND'
      || !isVerifiedPrivateVersionedStorageAdapter(privateStorageService)
    ) {
      throw new Error('An injected private storage service must be a verified provider-bound adapter.');
    }
    for (const method of ['put', 'get']) {
      if (typeof privateStorageService[method] !== 'function') {
        throw new Error(`An injected private storage service must implement ${method}.`);
      }
    }
    resolvedPrivateStorageService = privateStorageService;
  }

  // Construction is not counted as accepted-function coverage. These booleans describe the two
  // explicit case-bound routes below; each invokes the verified adapter while the runtime holds
  // the authenticated request's trusted context. No actor, case authority, object key, storage
  // locator, encryption material, or version authority can be supplied through the request body.
  const privateStorageAcceptedFunctionBound = Boolean(
    resolvedPrivateStorageService
    && typeof resolvedPrivateStorageService.put === 'function'
    && typeof resolvedPrivateStorageService.get === 'function'
  );

  // A readiness receipt is evidence about a dependency at one instant; it is not the dependency
  // itself.  These surfaces must also be present in this exact application graph before a caller
  // can receive a live bootstrap.  This prevents a green receipt (or asserted booleans) from
  // advertising AI, invitation delivery/OTP verification, or private object storage while the
  // corresponding route is still wired to null.
  const concreteProviderSurfacesReady = Boolean(
    resolvedAiDraftingService
    && resolvedFacultyInvitationLifecycleService
    && resolvedFacultyInvitationVerificationService
    && resolvedPrivateStorageService
    && privateStorageAcceptedFunctionBound
  );
  const studentEvidencePublicationBound = Boolean(
    repository.isDurable === true
    && repository.supportsStudentEvidencePublication === true
    && typeof repository.commitStudentEvidencePublication === 'function'
    && typeof caseService.publishStudentEvidence === 'function'
  );
  const concreteAcceptedFunctionSetReady = Boolean(
    concreteProviderSurfacesReady
    && resolvedArtifactService
    && resolvedArtifactService.auditMode === 'durable_actor_case_bound_append_only'
    && studentEvidencePublicationBound
  );

  async function getBootstrap() {
    const storageMode = repository.isDurable === true
      ? (resolvedPrivateStorageService && privateStorageAcceptedFunctionBound
        ? 'durable'
        : 'database_only')
      : String(repository.durability || 'NON_DURABLE_TEST_ONLY');
    const measuredProvidersReady = providersReady === true && concreteProviderSurfacesReady;
    const measuredAcceptedFunctionSetReady = allAcceptedFunctionsOperational === true
      && concreteAcceptedFunctionSetReady;
    const operational = repository.isDurable === true
      && storageMode === 'durable'
      && measuredProvidersReady
      && measuredAcceptedFunctionSetReady;
    return {
      operational,
      runtimeMode: operational ? 'live' : 'unavailable',
      storageMode,
      providersReady: measuredProvidersReady,
      capabilities: {
        builder: true,
        autosave: true,
        resume: true,
        versionHistory: true,
        studentEvidencePublication: studentEvidencePublicationBound,
        durableStorage: storageMode === 'durable',
        fullAcceptedFunctionSet: measuredAcceptedFunctionSetReady,
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

      const verificationRoute = routeFacultyInvitationVerification(url.pathname);
      if (verificationRoute) {
        if (method !== 'POST') {
          return { status: 405, body: { error: 'method_not_allowed' } };
        }
        if ([...url.searchParams.keys()].length > 0) {
          throw validationError('Faculty verification accepts no query parameters.');
        }
        if (!resolvedFacultyInvitationVerificationService) {
          throw Object.assign(
            new Error('The LOR faculty invitation verification service is not configured.'),
            { code: 'INTEGRATION_DISABLED' },
          );
        }
        const payload = await readJsonBody(request);
        assertExactKeys(payload, ['otpCode', 'recipientEmail']);
        const verification = await resolvedFacultyInvitationVerificationService.verify({
          actor,
          invitationId: verificationRoute.invitationId,
          idempotencyKey: idempotencyKey(request),
          otpCode: payload.otpCode,
          recipientEmail: payload.recipientEmail,
        });
        return { status: 200, body: { verification } };
      }

      const route = routeCase(url.pathname);
      if (!route) return { status: 404, body: { error: 'lor_route_not_found' } };

      if (route.facultyInvitations) {
        if (!resolvedFacultyInvitationLifecycleService) {
          throw Object.assign(
            new Error('The LOR faculty invitation lifecycle service is not configured.'),
            { code: 'INTEGRATION_DISABLED' },
          );
        }
        if (!route.invitationResend && !route.invitationRevoke && method === 'POST') {
          const payload = await readJsonBody(request);
          assertExactKeys(payload, ['expectedRevision', 'recipientEmail']);
          const invitation = await resolvedFacultyInvitationLifecycleService.issue({
            actor,
            caseId: route.caseId,
            expectedRevision: payload.expectedRevision,
            recipientEmail: payload.recipientEmail,
            idempotencyKey: idempotencyKey(request),
          });
          const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
          return { status: 201, body: { case: projection, invitation } };
        }
        if (route.invitationResend && method === 'POST') {
          const payload = await readJsonBody(request);
          assertExactKeys(payload, ['recipientEmail']);
          const invitation = await resolvedFacultyInvitationLifecycleService.resendOtp({
            actor,
            caseId: route.caseId,
            recipientEmail: payload.recipientEmail,
            idempotencyKey: idempotencyKey(request),
          });
          const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
          return { status: 200, body: { case: projection, invitation } };
        }
        if (route.invitationRevoke && method === 'POST') {
          const payload = await readJsonBody(request);
          assertExactKeys(payload, []);
          const invitation = await resolvedFacultyInvitationLifecycleService.revoke({
            actor,
            caseId: route.caseId,
            idempotencyKey: idempotencyKey(request),
          });
          const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
          return { status: 200, body: { case: projection, invitation } };
        }
        return { status: 405, body: { error: 'method_not_allowed' } };
      }

      if (route.privateArtifactPut || route.privateArtifactGet) {
        if (!resolvedPrivateStorageService) {
          throw Object.assign(
            new Error('The LOR private artifact storage service is not configured.'),
            { code: 'INTEGRATION_DISABLED' },
          );
        }
        if (route.privateArtifactPut && method === 'POST') {
          if ([...url.searchParams.keys()].length !== 0) {
            throw validationError('Private artifact writes accept no query parameters.');
          }
          const payload = await readJsonBody(request, PRIVATE_ARTIFACT_JSON_MAX_BYTES);
          assertExactKeys(payload, [
            'checksum', 'contentBase64', 'contentClass', 'contentType', 'purpose',
          ]);
          const content = decodeCanonicalBase64(payload.contentBase64);
          try {
            const receipt = await resolvedPrivateStorageService.put({
              caseId: route.caseId,
              objectId: route.objectId,
              content,
              contentType: payload.contentType,
              checksum: payload.checksum,
              contentClass: payload.contentClass,
              purpose: payload.purpose,
              idempotencyKey: idempotencyKey(request),
            });
            return { status: 201, body: { receipt } };
          } finally {
            content.fill(0);
          }
        }
        if (route.privateArtifactGet && method === 'GET') {
          const queryKeys = [...url.searchParams.keys()];
          if (
            queryKeys.length !== 2
            || new Set(queryKeys).size !== 2
            || !queryKeys.includes('contentClass')
            || !queryKeys.includes('purpose')
            || url.searchParams.getAll('contentClass').length !== 1
            || url.searchParams.getAll('purpose').length !== 1
          ) throw validationError('Private artifact reads require the exact class and purpose query.');
          const stored = await resolvedPrivateStorageService.get({
            caseId: route.caseId,
            objectId: route.objectId,
            versionId: route.versionId,
            contentClass: url.searchParams.get('contentClass'),
            purpose: url.searchParams.get('purpose'),
          });
          return {
            status: 200,
            binary: {
              body: stored.content,
              // Private artifacts are always delivered as passive opaque attachments. The
              // authenticated route never reflects a stored media type into the browser's
              // content-sniffing surface.
              contentType: 'application/octet-stream',
              filename: `${encodeURIComponent(route.objectId)}.bin`,
              sensitive: true,
            },
          };
        }
        return { status: 405, body: { error: 'method_not_allowed' } };
      }

      if (
        !route.builder
        && !route.receipts
        && !route.facultyPrivate
        && !route.releaseFinalDocument
        && !route.exportFinalDocument
        && !route.aiProposals
        && !route.facultyInvitations
        && !route.publishStudentEvidence
        && !route.privateArtifactPut
        && !route.privateArtifactGet
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

      if (route.publishStudentEvidence && method === 'POST') {
        const payload = await readJsonBody(request);
        // The database derives every evidence row, consent binding, content hash, provenance
        // record, and audit-chain value. The client may identify only the revision it read.
        assertExactKeys(payload, ['expectedRevision']);
        await caseService.publishStudentEvidence({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
        });
        // The command returns the domain's student-safe aggregate, whose field names are not the
        // browser projection contract (`id` versus `caseId`, `releasedDocument` versus
        // `finalDocument`). Re-read through the actor-aware projection boundary just like every
        // other successful write route. Returning the command object directly makes the durable
        // write succeed while the UI truthfully rejects its acknowledgement as unreadable.
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
      }

      if (route.aiProposals) {
        if (!resolvedAiDraftingService) {
          throw Object.assign(
            new Error('The LOR AI drafting service is not configured.'),
            { code: 'INTEGRATION_DISABLED' },
          );
        }

        if (route.proposalId === null && method === 'POST') {
          const payload = await readJsonBody(request);
          // The whole request surface for drafting is an optional narrowing of evidence the case
          // ALREADY holds under consent. There is deliberately no field here for fact text, for
          // an evidence reference, for a template, for a provider, or - the one that matters
          // most - for a decision: a generate request cannot make its own output into content.
          assertExactKeys(payload, ['factIds']);
          const proposal = await resolvedAiDraftingService.requestProposal({
            actor,
            caseId: route.caseId,
            idempotencyKey: idempotencyKey(request),
            factIds: payload.factIds ?? null,
          });
          return { status: 201, body: { proposal } };
        }

        if (route.proposalId !== null && !route.proposalDecision && method === 'GET') {
          const proposal = await resolvedAiDraftingService.getProposal({
            actor,
            caseId: route.caseId,
            proposalId: route.proposalId,
          });
          return { status: 200, body: { proposal } };
        }

        if (route.proposalDecision && method === 'POST') {
          const payload = await readJsonBody(request);
          // Two facts cross the wire: which way the human decided, and - for an edit only - the
          // wording they wrote. The deciding principal, the decision timestamp, the proposal
          // output hash the decision binds to, and the resulting-text hash are all minted
          // server-side, so no request body can assert who decided or what they decided about.
          assertExactKeys(payload, ['action', 'resultingText']);
          const proposal = await resolvedAiDraftingService.recordProposalDecision({
            actor,
            caseId: route.caseId,
            proposalId: route.proposalId,
            idempotencyKey: idempotencyKey(request),
            action: payload.action,
            resultingText: payload.resultingText ?? null,
          });
          return { status: 201, body: { proposal } };
        }

        return { status: 405, body: { error: 'method_not_allowed' } };
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

      if (route.facultyPrivate && method === 'PATCH') {
        const payload = await readJsonBody(request);
        assertExactKeys(payload, [
          'expectedRevision',
          'answers',
          'notes',
          'draftText',
          'finalDocument',
          'documentState',
          'facultyApproval',
        ]);
        await caseService.saveFacultyPrivateContent({
          caseId: route.caseId,
          actor,
          expectedRevision: payload.expectedRevision,
          idempotencyKey: idempotencyKey(request),
          answers: payload.answers,
          notes: payload.notes,
          draftText: payload.draftText,
          finalDocument: payload.finalDocument,
          documentState: payload.documentState,
          facultyApproval: payload.facultyApproval,
        });
        const projection = await caseService.getCaseProjection({ caseId: route.caseId, actor });
        return { status: 200, body: { case: projection } };
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

  const application = Object.freeze({ getBootstrap, handleRequest });
  AUTHENTIC_LOR_APPLICATION_ADAPTERS.add(application);
  return application;
}

export function isAuthenticLorApplicationAdapter(value) {
  if (!value || typeof value !== 'object') return false;
  try {
    return Object.isFrozen(value)
      && Reflect.ownKeys(value).length === 2
      && typeof value.getBootstrap === 'function'
      && typeof value.handleRequest === 'function'
      && Object.getOwnPropertyDescriptor(value, 'getBootstrap')?.value === value.getBootstrap
      && Object.getOwnPropertyDescriptor(value, 'handleRequest')?.value === value.handleRequest
      && AUTHENTIC_LOR_APPLICATION_ADAPTERS.has(value);
  } catch {
    return false;
  }
}
