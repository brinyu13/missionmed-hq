import { hashValue } from '../domain/value-utils.js';
import {
  createTrustedRequestContext,
  readTrustedRequestContext,
} from '../security/trusted-request-context.mjs';
import {
  createWordPressLorS2sClient,
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_BINDING_PROVENANCE,
} from './wordpress-lor-s2s-protocol.mjs';

export {
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_ADMISSION_PATH,
  WORDPRESS_LOR_BINDING_PROVENANCE,
};

const SUBJECT_PATTERN = /^wp:[1-9][0-9]*$/u;
const BINDING_PATTERN = /^lorb1_[A-Za-z0-9_-]{43}$/u;
const UTC_INSTANT_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const ACTOR_CASE_ACCESS_SCHEMA = 'missionmed.lor.actor-case-access.v1';
const CASE_API_PATTERN = /^\/api\/lor-studio\/cases\/([^/?#]+)(?:[/?#]|$)/u;
const FACULTY_CANDIDATE_API_PATTERN =
  /^\/api\/lor-studio\/invitations\/([^/?#]+)\/(?:bootstrap|verify)(?:[?#]|$)/u;
const FACULTY_CANDIDATE_PAGE_PATTERN =
  /^\/lor-studio\/invitations\/([^/?#]+)\/?(?:[?#]|$)/u;
const ACTOR_ROLES = new Set(['student', 'faculty', 'mentor']);
const RESOURCE_ENTITLEMENT_KEYS = new Set([
  'active',
  'canaryConsented',
  'canaryEnabled',
  'lorEnabled',
  'producerStatus',
  'revoked',
  'studentId',
  'tier',
]);
const RESOURCE_ENTITLEMENT_PRODUCER = 'WORDPRESS_RESOURCE_ADMISSION_V1_SIGNED_S2S';

export class WordPressCurrentUserAdmissionError extends Error {
  constructor(code) {
    super(`WordPress LOR admission failed: ${code}`);
    this.name = 'WordPressCurrentUserAdmissionError';
    this.code = code;
  }
}

function fail(code) {
  throw new WordPressCurrentUserAdmissionError(code);
}

function canonicalSubject(value) {
  if (typeof value !== 'string' || !SUBJECT_PATTERN.test(value) || value.length > 200) {
    fail('SUBJECT_INVALID');
  }
  const identifier = Number(value.slice(3));
  if (!Number.isSafeInteger(identifier) || identifier <= 0) fail('SUBJECT_INVALID');
  return value;
}

function canonicalSessionSubject(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) fail('SUBJECT_INVALID');
    return `wp:${value}`;
  }
  if (typeof value !== 'string' || value.trim() !== value) fail('SUBJECT_INVALID');
  if (SUBJECT_PATTERN.test(value)) return canonicalSubject(value);
  if (!/^[1-9][0-9]*$/u.test(value)) fail('SUBJECT_INVALID');
  const identifier = Number(value);
  if (!Number.isSafeInteger(identifier) || String(identifier) !== value) fail('SUBJECT_INVALID');
  return `wp:${value}`;
}

function exactBinding(session, now) {
  const bindingId = session?.lorAdmissionBindingId;
  if (typeof bindingId !== 'string' || !BINDING_PATTERN.test(bindingId)) {
    fail('BINDING_UNAVAILABLE');
  }
  if (session?.lorAdmissionBindingProvenance !== WORDPRESS_LOR_BINDING_PROVENANCE) {
    fail('BINDING_UNAVAILABLE');
  }
  const expiresAt = session?.lorAdmissionBindingExpiresAt;
  if (typeof expiresAt !== 'string' || !UTC_INSTANT_PATTERN.test(expiresAt)) {
    fail('BINDING_UNAVAILABLE');
  }
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs) || new Date(expiresAtMs).toISOString() !== expiresAt || expiresAtMs <= now) {
    fail('BINDING_UNAVAILABLE');
  }
  return bindingId;
}

function nowMilliseconds(clock) {
  const raw = clock();
  const milliseconds = raw instanceof Date ? raw.getTime() : Number(raw);
  if (!Number.isFinite(milliseconds)) fail('CLOCK_INVALID');
  return milliseconds;
}

function requestCaseId(request) {
  const raw = typeof request?.url === 'string' ? request.url : '';
  const match = CASE_API_PATTERN.exec(raw);
  if (!match) return null;
  let caseId;
  try {
    caseId = decodeURIComponent(match[1]);
  } catch {
    fail('CASE_ACCESS_INVALID');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(caseId)) {
    fail('CASE_ACCESS_INVALID');
  }
  return caseId;
}

function requestFacultyCandidateInvitationId(request) {
  const raw = typeof request?.url === 'string' ? request.url : '';
  const match = FACULTY_CANDIDATE_API_PATTERN.exec(raw)
    ?? FACULTY_CANDIDATE_PAGE_PATTERN.exec(raw);
  if (!match) return null;
  let invitationId;
  try {
    invitationId = decodeURIComponent(match[1]);
  } catch {
    fail('INVITATION_CANDIDATE_INVALID');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(invitationId)) {
    fail('INVITATION_CANDIDATE_INVALID');
  }
  return invitationId;
}

function exactActorCaseAccess(value, { authenticatedSubject, caseId }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CASE_ACCESS_DENIED');
  let descriptors;
  let keys;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail('CASE_ACCESS_DENIED');
  }
  const expected = [
    'actorId',
    'actorRole',
    'authoritySource',
    'caseId',
    'resourceStudentId',
    'schemaVersion',
  ];
  if (
    keys.length !== expected.length
    || keys.some((key) => typeof key !== 'string' || !expected.includes(key))
    || expected.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || descriptor.enumerable !== true;
    })
  ) fail('CASE_ACCESS_DENIED');
  const snapshot = Object.fromEntries(expected.map((key) => [key, descriptors[key].value]));
  if (
    snapshot.schemaVersion !== ACTOR_CASE_ACCESS_SCHEMA
    || snapshot.authoritySource !== 'database_verified_case_access'
    || snapshot.actorId !== authenticatedSubject
    || !ACTOR_ROLES.has(snapshot.actorRole)
    || snapshot.caseId !== caseId
  ) fail('CASE_ACCESS_DENIED');
  canonicalSubject(snapshot.resourceStudentId);
  if (snapshot.actorRole === 'student' && snapshot.resourceStudentId !== authenticatedSubject) {
    fail('CASE_ACCESS_DENIED');
  }
  return Object.freeze(snapshot);
}

function exactResourceStudentEntitlement(value, studentId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('RESOURCE_ENTITLEMENT_DENIED');
  let descriptors;
  let keys;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
    keys = Reflect.ownKeys(value);
  } catch {
    fail('RESOURCE_ENTITLEMENT_DENIED');
  }
  if (
    keys.length !== RESOURCE_ENTITLEMENT_KEYS.size
    || keys.some((key) => typeof key !== 'string' || !RESOURCE_ENTITLEMENT_KEYS.has(key))
  ) fail('RESOURCE_ENTITLEMENT_DENIED');
  const snapshot = Object.create(null);
  for (const key of RESOURCE_ENTITLEMENT_KEYS) {
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      fail('RESOURCE_ENTITLEMENT_DENIED');
    }
    snapshot[key] = descriptor.value;
  }
  if (
    snapshot.studentId !== studentId
    || snapshot.active !== true
    || snapshot.tier !== 'tier3_360'
    || snapshot.lorEnabled !== true
    || snapshot.revoked !== false
    || typeof snapshot.canaryEnabled !== 'boolean'
    || typeof snapshot.canaryConsented !== 'boolean'
    || snapshot.producerStatus !== RESOURCE_ENTITLEMENT_PRODUCER
  ) fail('RESOURCE_ENTITLEMENT_DENIED');
  return Object.freeze(snapshot);
}

/**
 * Build the server-only WordPress admission resolver and matching case-service
 * entitlement port. The browser-carried HQ session contains only a non-secret
 * binding identifier. Every authorization is a fresh, signed S2S POST; the
 * binding is useless without the server-held domain-separated HMAC key.
 *
 * @param {{
 *   s2sClient?: { admit(input: { bindingId: string, subject: string }): Promise<Record<string, unknown>> } | null,
 *   origin?: string,
 *   sharedSecret?: string,
 *   fetchImplementation?: typeof globalThis.fetch,
 *   clock?: () => Date | number,
 *   nonceFactory?: () => string,
 *   maximumResponseBytes?: number,
 *   transportTimeoutMs?: number,
 *   actorResolver?: { resolve(input: { authenticatedSubject: string, caseId: string }): Promise<Record<string, unknown>> } | null,
 *   resourceEntitlementResolver?: { signedS2s: true, resolve(input: { authenticatedSubject: string, actorRole: string, studentId: string }): Promise<Record<string, unknown>> } | null,
 * }} [options]
 */
export function createWordPressCurrentUserAdmission({
  s2sClient = null,
  origin,
  sharedSecret,
  fetchImplementation = globalThis.fetch,
  clock = () => new Date(),
  nonceFactory,
  maximumResponseBytes,
  transportTimeoutMs,
  actorResolver = null,
  resourceEntitlementResolver = null,
} = {}) {
  if (typeof clock !== 'function') fail('CLOCK_INVALID');
  let client = s2sClient;
  if (client === null) {
    const options = { origin, sharedSecret, fetchImplementation, clock };
    if (nonceFactory !== undefined) options.nonceFactory = nonceFactory;
    if (maximumResponseBytes !== undefined) options.maximumResponseBytes = maximumResponseBytes;
    if (transportTimeoutMs !== undefined) options.transportTimeoutMs = transportTimeoutMs;
    client = createWordPressLorS2sClient(options);
  }
  if (!client || typeof client.admit !== 'function') fail('S2S_CLIENT_UNAVAILABLE');
  if (actorResolver !== null && typeof actorResolver?.resolve !== 'function') {
    fail('ACTOR_RESOLVER_UNAVAILABLE');
  }
  if (
    resourceEntitlementResolver !== null
    && (
      resourceEntitlementResolver?.signedS2s !== true
      || typeof resourceEntitlementResolver?.resolve !== 'function'
    )
  ) fail('RESOURCE_ENTITLEMENT_RESOLVER_UNAVAILABLE');

  async function resolveResourceEntitlement({ authenticatedSubject, actorRole, studentId }) {
    if (
      resourceEntitlementResolver === null
      || !['faculty', 'mentor'].includes(actorRole)
    ) fail('RESOURCE_ENTITLEMENT_DENIED');
    try {
      return exactResourceStudentEntitlement(
        await resourceEntitlementResolver.resolve({ authenticatedSubject, actorRole, studentId }),
        studentId,
      );
    } catch {
      fail('RESOURCE_ENTITLEMENT_DENIED');
    }
  }

  const sourceReferenceHash = hashValue({
    authority: 'DR-133',
    contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
    path: WORDPRESS_LOR_ADMISSION_PATH,
    transport: 'signed_s2s_post',
  });
  const contexts = new WeakMap();

  const admission = {
    requiresTrustedRequestContext: true,

    /** @param {{ subject?: unknown, session?: Record<string, any>, request?: {url?: unknown} }} [input] */
    async resolve(input = {}) {
      const authenticatedSubject = canonicalSubject(input.subject);
      const sessionSubject = canonicalSessionSubject(input.session?.user?.id);
      if (sessionSubject !== authenticatedSubject) fail('SESSION_SUBJECT_MISMATCH');
      const bindingId = exactBinding(input.session, nowMilliseconds(clock));

      let receipt;
      try {
        receipt = await client.admit({ bindingId, subject: authenticatedSubject });
      } catch {
        fail('ADMISSION_DENIED');
      }
      if (
        !receipt
        || receipt.contract !== WORDPRESS_LOR_ADMISSION_CONTRACT
        || receipt.subject !== authenticatedSubject
        || receipt.admitted !== true
      ) fail('ADMISSION_DENIED');

      const caseId = requestCaseId(input.request);
      const candidateInvitationId = requestFacultyCandidateInvitationId(input.request);
      let actorRole = 'student';
      let resourceStudentId = authenticatedSubject;
      let actorAccess = null;
      let resourceEntitlement = null;
      if (caseId !== null && actorResolver !== null) {
        try {
          actorAccess = exactActorCaseAccess(
            await actorResolver.resolve({ authenticatedSubject, caseId }),
            { authenticatedSubject, caseId },
          );
        } catch {
          fail('CASE_ACCESS_DENIED');
        }
        actorRole = actorAccess.actorRole;
        resourceStudentId = actorAccess.resourceStudentId;
        if (actorRole !== 'student') {
          resourceEntitlement = await resolveResourceEntitlement({
            authenticatedSubject,
            actorRole,
            studentId: resourceStudentId,
          });
        }
      } else if (candidateInvitationId !== null) {
        // A logged-in WordPress principal may present invitation credentials, but receives
        // no case identity or faculty access here. The database verification command resolves
        // the case and challenge and commits the faculty binding atomically before later
        // case-scoped requests can resolve a faculty role.
        actorRole = 'faculty';
      }

      // This stable proof identifies the verified identity source for the
      // permanent database crosswalk. Freshness/replay are independently
      // enforced by the signed S2S nonce and the bounded receipt on every call.
      const proofHash = hashValue({
        schemaVersion: 'missionmed.lor.wordpress-admission-proof.v2',
        sourceReferenceHash,
        subject: authenticatedSubject,
        actorRole,
        ...(actorAccess === null
          ? {}
          : {
            actorCaseAccessAuthority: actorAccess.authoritySource,
            caseId: actorAccess.caseId,
            resourceStudentId,
          }),
        ...(candidateInvitationId === null
          ? {}
          : {
            invitationCandidateRef: hashValue({
              schemaVersion: 'missionmed.lor.invitation-candidate-reference.v1',
              invitationId: candidateInvitationId,
            }),
          }),
      });
      const context = createTrustedRequestContext({
        schemaVersion: 'missionmed.lor.trusted-request-context.v1',
        authenticatedSubject,
        actorRole,
        sourceReferenceHash,
        proofHash,
        entitlementVerified: true,
        lorEnabled: true,
        canaryAuthorized: true,
        clientAsserted: false,
      });
      const projection = Object.freeze({
        available: true,
        sourceVerified: true,
        revoked: resourceEntitlement?.revoked ?? false,
        active: resourceEntitlement?.active ?? true,
        tier: resourceEntitlement?.tier ?? 'tier3_360',
        lorEnabled: resourceEntitlement?.lorEnabled ?? true,
        canaryEnabled: resourceEntitlement?.canaryEnabled ?? true,
        canaryConsented: resourceEntitlement?.canaryConsented ?? true,
        studentId: resourceStudentId,
        actorId: receipt.subject,
        role: actorRole,
      });
      contexts.set(projection, context);
      return projection;
    },

    consumeTrustedRequestContext(projection) {
      const context = projection && typeof projection === 'object'
        ? contexts.get(projection)
        : undefined;
      if (!context) fail('TRUSTED_CONTEXT_UNAVAILABLE');
      contexts.delete(projection);
      return context;
    },

    /** @param {{ studentId?: unknown }} [input] */
    async getStudentEntitlement(input = {}) {
      const subject = canonicalSubject(input.studentId);
      let context;
      try {
        context = readTrustedRequestContext();
      } catch {
        fail('TRUSTED_CONTEXT_UNAVAILABLE');
      }
      if (context.actorRole === 'student') {
        if (context.authenticatedSubject !== subject) fail('ENTITLEMENT_SUBJECT_MISMATCH');
        return Object.freeze({
          studentId: subject,
          active: true,
          tier: 'tier3_360',
          lorEnabled: true,
          revoked: false,
          canaryEnabled: true,
          canaryConsented: true,
          producerStatus: 'WORDPRESS_ADMISSION_V2_SIGNED_S2S',
        });
      }
      return resolveResourceEntitlement({
        authenticatedSubject: context.authenticatedSubject,
        actorRole: context.actorRole,
        studentId: subject,
      });
    },
  };

  return Object.freeze(admission);
}

export const WORDPRESS_CURRENT_USER_ADMISSION_CONTRACT = Object.freeze({
  authority: 'DR-133',
  receiptContract: WORDPRESS_LOR_ADMISSION_CONTRACT,
  path: WORDPRESS_LOR_ADMISSION_PATH,
  method: 'POST',
  redirect: 'manual',
  credentials: 'omit',
  sessionCredential: 'non_secret_binding_id_only',
  bindingProvenance: WORDPRESS_LOR_BINDING_PROVENANCE,
  authorization: 'domain_separated_hmac_with_atomic_nonce',
  proofHashInputs: [
    'schemaVersion',
    'sourceReferenceHash',
    'subject',
    'actorRole',
    'actorCaseAccessAuthority_if_case_resolved',
    'caseId_if_case_resolved',
    'resourceStudentId_if_case_resolved',
    'invitationCandidateRef_if_candidate_route',
  ],
  actorCaseAccess: Object.freeze({
    schemaVersion: ACTOR_CASE_ACCESS_SCHEMA,
    authoritySource: 'database_verified_case_access',
    roleSource: 'server_database_only',
    requestBinding: 'exact_case_api_path',
    browserRoleAccepted: false,
    resourceStudentEntitlement: RESOURCE_ENTITLEMENT_PRODUCER,
  }),
  invitationCandidate: Object.freeze({
    role: 'faculty',
    caseAccessBeforeVerification: false,
    invitationReference: 'hashed_in_trusted_identity_proof_only',
    acceptedRoutes: Object.freeze([
      '/lor-studio/invitations/:invitationId',
      '/api/lor-studio/invitations/:invitationId/bootstrap',
      '/api/lor-studio/invitations/:invitationId/verify',
    ]),
  }),
});
