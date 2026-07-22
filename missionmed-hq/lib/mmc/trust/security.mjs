import crypto from 'node:crypto';

import { buildSafeErrorEnvelope } from '../contracts/state-contract.mjs';

export const MMC_DEFAULT_MAX_JSON_BYTES = 64 * 1024;

export const MMC_CAPABILITIES = Object.freeze({
  QUERY: 'mmc:query',
  COMMAND: 'mmc:command',
  OPERATIONS: 'mmc:operations',
  IDENTITY_REVIEW: 'mmc:identity:review',
  PROMPT_MANAGE: 'mmc:prompt:manage',
  POLICY_MANAGE: 'mmc:policy:manage',
  AI_QUEUE: 'mmc:ai:queue',
  REVIEW: 'mmc:review',
  PUBLICATION_APPROVE: 'mmc:publication:approve',
  PUBLICATION_READ: 'mmc:publication:read',
  STUDENT_SELF_AUTHOR: 'mmc:student:self-author',
  STUDENT_RESPOND: 'mmc:student:respond',
  WORKER_CLAIM: 'mmc:worker:claim',
  WORKER_COMPLETE: 'mmc:worker:complete',
  WORKER_OUTBOX_DISPATCH: 'mmc:worker:outbox_dispatch',
  WORKER_INBOX: 'mmc:worker:inbox',
  WORKER_ANALYSIS: 'mmc:worker:analysis',
  WORKER_ASSET_PROCESS: 'mmc:worker:asset_process',
});

const ADMIN_CAPABILITIES = Object.freeze(Object.values(MMC_CAPABILITIES).filter((capability) => (
  ![
    MMC_CAPABILITIES.PUBLICATION_READ,
    MMC_CAPABILITIES.STUDENT_SELF_AUTHOR,
    MMC_CAPABILITIES.STUDENT_RESPOND,
    MMC_CAPABILITIES.WORKER_CLAIM,
    MMC_CAPABILITIES.WORKER_COMPLETE,
    MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH,
    MMC_CAPABILITIES.WORKER_INBOX,
    MMC_CAPABILITIES.WORKER_ANALYSIS,
    MMC_CAPABILITIES.WORKER_ASSET_PROCESS,
  ]
    .includes(capability)
)));

const MENTOR_CAPABILITIES = Object.freeze([
  MMC_CAPABILITIES.QUERY,
  MMC_CAPABILITIES.COMMAND,
  MMC_CAPABILITIES.REVIEW,
  MMC_CAPABILITIES.PUBLICATION_APPROVE,
]);

const OPERATOR_CAPABILITIES = Object.freeze([
  MMC_CAPABILITIES.QUERY,
  MMC_CAPABILITIES.OPERATIONS,
  MMC_CAPABILITIES.IDENTITY_REVIEW,
]);

const ROLE_CAPABILITY_CEILINGS = Object.freeze({
  admin: ADMIN_CAPABILITIES,
  mentor: MENTOR_CAPABILITIES,
  operator: OPERATOR_CAPABILITIES,
  student: Object.freeze([
    MMC_CAPABILITIES.PUBLICATION_READ,
    MMC_CAPABILITIES.STUDENT_SELF_AUTHOR,
    MMC_CAPABILITIES.STUDENT_RESPOND,
  ]),
  worker: Object.freeze([
    MMC_CAPABILITIES.WORKER_CLAIM,
    MMC_CAPABILITIES.WORKER_COMPLETE,
    MMC_CAPABILITIES.WORKER_OUTBOX_DISPATCH,
    MMC_CAPABILITIES.WORKER_INBOX,
    MMC_CAPABILITIES.WORKER_ANALYSIS,
    MMC_CAPABILITIES.WORKER_ASSET_PROCESS,
  ]),
});

export const MMC_JSON_SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
});

export class MmcHttpError extends Error {
  constructor(statusCode, code, publicMessage, options = {}) {
    super(publicMessage, { cause: options.cause });
    this.name = 'MmcHttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryable = options.retryable === true;
    this.retryAfterSeconds = Number.isInteger(options.retryAfterSeconds)
      ? options.retryAfterSeconds
      : undefined;
    this.details = options.details && typeof options.details === 'object' && !Array.isArray(options.details)
      ? Object.freeze(structuredClone(options.details))
      : undefined;
  }
}

export function decodeCanonicalRequestPathname(encodedPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(String(encodedPathname || '/'));
  } catch (error) {
    throw new MmcHttpError(400, 'INVALID_REQUEST_PATH', 'The request path is invalid.', { cause: error });
  }

  const segments = pathname.split('/');
  if (!pathname.startsWith('/')
      || pathname.includes('\0')
      || pathname.includes('\\')
      || pathname.includes('//')
      || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new MmcHttpError(400, 'NON_CANONICAL_REQUEST_PATH', 'The request path is invalid.');
  }
  return pathname;
}

export async function readBoundedJsonBody(request, options = {}) {
  const maxBytes = clampInteger(options.maxBytes, MMC_DEFAULT_MAX_JSON_BYTES, 1, 1024 * 1024);
  const requireObject = options.requireObject !== false;
  const allowEmpty = options.allowEmpty === true;
  const headers = normalizeHeaders(request?.headers);
  const hasMaterializedBody = request && Object.hasOwn(request, 'body');

  const declaredLength = Number(headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength >= 0) {
    assertBodySize(declaredLength, maxBytes);
  }

  if (options.requireContentType !== false && !hasMaterializedBody) {
    const contentType = String(headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      throw new MmcHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'MMC commands require application/json.');
    }
  }

  let bodyBuffer;
  if (hasMaterializedBody) {
    if (Buffer.isBuffer(request.body)) {
      bodyBuffer = request.body;
    } else if (typeof request.body === 'string') {
      bodyBuffer = Buffer.from(request.body, 'utf8');
    } else if (request.body == null) {
      bodyBuffer = Buffer.alloc(0);
    } else {
      bodyBuffer = Buffer.from(JSON.stringify(request.body), 'utf8');
    }
    assertBodySize(bodyBuffer.byteLength, maxBytes);
  } else {
    const chunks = [];
    let totalBytes = 0;
    for await (const rawChunk of request || []) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      totalBytes += chunk.byteLength;
      assertBodySize(totalBytes, maxBytes);
      chunks.push(chunk);
    }
    bodyBuffer = Buffer.concat(chunks, totalBytes);
  }

  let decoded;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bodyBuffer);
  } catch (error) {
    throw new MmcHttpError(400, 'MALFORMED_UTF8', 'The request body is not valid UTF-8.', { cause: error });
  }
  const text = decoded.trim();
  if (!text) {
    if (allowEmpty) return {};
    throw new MmcHttpError(400, 'MALFORMED_JSON', 'A non-empty JSON object is required.');
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new MmcHttpError(400, 'MALFORMED_JSON', 'The request body is not valid JSON.', { cause: error });
  }

  if (requireObject && (!payload || typeof payload !== 'object' || Array.isArray(payload))) {
    throw new MmcHttpError(422, 'INVALID_REQUEST_SHAPE', 'The request body must be a JSON object.');
  }
  return payload;
}

export function assertMmcCsrf(request, session) {
  if (!isMutationMethod(request?.method)) return;
  const expected = session?.csrfToken;
  const supplied = normalizeHeaders(request?.headers)['x-mmhq-csrf'];
  if (typeof expected !== 'string' || typeof supplied !== 'string'
    || !expected || !safeEqual(expected, supplied)) {
    throw new MmcHttpError(403, 'CSRF_VALIDATION_FAILED', 'Missing or invalid MMC CSRF token.');
  }
}

export function assertExactRequestOrigin(request, approvedOrigins, options = {}) {
  const approved = new Set((Array.isArray(approvedOrigins) ? approvedOrigins : [approvedOrigins])
    .map(normalizeExactHttpsOrigin)
    .filter(Boolean));
  if (!approved.size) {
    throw new MmcHttpError(503, 'MMC_ORIGIN_POLICY_UNAVAILABLE', 'MMC origin policy is not configured.');
  }

  const headers = normalizeHeaders(request?.headers);
  const originHeader = String(headers.origin || '').trim();
  const fetchSite = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (!originHeader) {
    if (options.allowNonBrowser === true && !fetchSite) return;
    throw new MmcHttpError(403, 'ORIGIN_REQUIRED', 'An approved same-origin request is required.');
  }

  const origin = normalizeExactHttpsOrigin(originHeader);
  if (!origin || !approved.has(origin)) {
    throw new MmcHttpError(403, 'ORIGIN_FORBIDDEN', 'The request origin is not approved for MMC.');
  }
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    throw new MmcHttpError(403, 'FETCH_METADATA_FORBIDDEN', 'Cross-site MMC requests are not allowed.');
  }
}

export function deriveMmcPrincipal(options = {}) {
  const source = options.sourcePrincipal || {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new MmcHttpError(403, 'MMC_PRINCIPAL_SCOPE_MISMATCH', 'The authenticated MMC principal binding is invalid.');
  }

  const sourceRole = hasValue(source.role) ? normalizeRole(source.role) : null;
  const configuredRole = hasValue(options.role) ? normalizeRole(options.role) : null;
  assertMatchingPrincipalBinding(sourceRole, configuredRole);
  const role = sourceRole || configuredRole || normalizeRole(null);

  const sourceEnvironment = hasValue(source.environment) ? normalizeEnvironment(source.environment) : null;
  const configuredEnvironment = hasValue(options.environment) ? normalizeEnvironment(options.environment) : null;
  assertMatchingPrincipalBinding(sourceEnvironment, configuredEnvironment);
  const environment = sourceEnvironment || configuredEnvironment || normalizeEnvironment(undefined);

  const sourcePrincipalId = optionalOpaqueIdentifier(source.id, 'principal');
  const configuredPrincipalId = optionalOpaqueIdentifier(options.principalId, 'principal');
  assertMatchingPrincipalBinding(sourcePrincipalId, configuredPrincipalId);
  const principalId = sourcePrincipalId || configuredPrincipalId || requireOpaqueIdentifier(null, 'principal');

  const sourceTenantId = optionalOpaqueIdentifier(source.tenantId, 'tenant');
  const configuredTenantId = optionalOpaqueIdentifier(options.tenantId, 'tenant');
  assertMatchingPrincipalBinding(sourceTenantId, configuredTenantId);
  const tenantId = sourceTenantId || configuredTenantId || requireOpaqueIdentifier(null, 'tenant');

  const subjectId = resolvePrincipalIdentifier(source.subjectId, options.subjectId, 'subject');
  const assignmentId = resolvePrincipalIdentifier(source.assignmentId, options.assignmentId, 'assignment');
  const workloadId = resolvePrincipalIdentifier(source.workloadId, options.workloadId, 'workload');
  const queueName = resolvePrincipalQueueName(source.queueName, options.queueName);
  const roleCapabilities = capabilitiesForRole(role);
  if (options.capabilities !== undefined && !Array.isArray(options.capabilities)) {
    throw new MmcHttpError(403, 'MMC_CAPABILITY_SET_INVALID', 'The MMC capability grant is invalid.');
  }
  const explicitlyDerived = options.capabilities || [];
  const knownCapabilities = new Set(Object.values(MMC_CAPABILITIES));
  const capabilityCeiling = new Set(ROLE_CAPABILITY_CEILINGS[role] || []);
  for (const capability of explicitlyDerived) {
    if (!knownCapabilities.has(capability)) {
      throw new MmcHttpError(403, 'MMC_CAPABILITY_UNKNOWN', 'The MMC capability grant is invalid.');
    }
    if (!capabilityCeiling.has(capability)) {
      throw new MmcHttpError(403, 'MMC_CAPABILITY_ELEVATION_FORBIDDEN', 'The MMC capability grant exceeds the authenticated role.');
    }
  }
  const capabilities = [...new Set([...roleCapabilities, ...explicitlyDerived])].sort();

  return Object.freeze({
    id: principalId,
    tenantId,
    environment,
    role,
    subjectId,
    assignmentId,
    workloadId,
    queueName,
    capabilities: Object.freeze(capabilities),
  });
}

export function assertCapability(principal, capability) {
  if (!Object.values(MMC_CAPABILITIES).includes(capability)) {
    throw new TypeError(`Unknown MMC capability: ${String(capability)}`);
  }
  if (!principal?.capabilities?.includes(capability)) {
    throw new MmcHttpError(403, 'CAPABILITY_REQUIRED', 'The current MMC principal is not authorized for this operation.');
  }
}

export function safeMmcErrorPayload(error, options = {}) {
  const correlationId = requireOpaqueIdentifier(options.correlationId || crypto.randomUUID(), 'correlation');
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const known = error instanceof MmcHttpError;
  const safeError = {
    code: known ? error.code : 'MMC_INTERNAL_ERROR',
    message: known ? error.publicMessage : 'MMC could not complete the request.',
    retryable: known ? error.retryable : false,
    correlationId,
  };
  if (known && Number.isInteger(error.retryAfterSeconds)) {
    safeError.retryAfterSeconds = error.retryAfterSeconds;
  }
  if (known && error.code === 'VERSION_CONFLICT' && error.details) {
    safeError.conflict = error.details;
  }
  return { statusCode, payload: buildSafeErrorEnvelope(safeError) };
}

export function redactSensitiveValue(value, depth = 0) {
  if (depth > 8) return '[DEPTH_LIMIT]';
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveValue(entry, depth + 1));
  if (!value || typeof value !== 'object') {
    const text = typeof value === 'string' ? value : null;
    if (text && (looksLikeAbsolutePath(text) || looksLikeCredential(text))) return '[REDACTED]';
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/token|secret|password|credential|authorization|cookie|transcript|private_note|absolute_path|drop.?zone/iu.test(key)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSensitiveValue(entry, depth + 1)];
  }));
}

export function normalizeExactHttpsOrigin(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin.toLowerCase();
  } catch {
    return '';
  }
}

function capabilitiesForRole(role) {
  if (role === 'admin') return [...ADMIN_CAPABILITIES];
  if (role === 'operator') return [...OPERATOR_CAPABILITIES];
  if (role === 'mentor') return [...MENTOR_CAPABILITIES];
  if (role === 'student') return [];
  if (role === 'worker') return [];
  return [];
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function optionalOpaqueIdentifier(value, label) {
  return hasValue(value) ? requireOpaqueIdentifier(value, label) : null;
}

function resolvePrincipalIdentifier(sourceValue, configuredValue, label) {
  const source = optionalOpaqueIdentifier(sourceValue, label);
  const configured = optionalOpaqueIdentifier(configuredValue, label);
  assertMatchingPrincipalBinding(source, configured);
  return source || configured;
}

function resolvePrincipalQueueName(sourceValue, configuredValue) {
  const normalize = (value) => {
    if (!hasValue(value)) return null;
    if (typeof value !== 'string') {
      throw new MmcHttpError(422, 'MMC_QUEUE_INVALID', 'The workload queue binding is invalid.');
    }
    const queueName = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(queueName)) {
      throw new MmcHttpError(422, 'MMC_QUEUE_INVALID', 'The workload queue binding is invalid.');
    }
    return queueName;
  };
  const source = normalize(sourceValue);
  const configured = normalize(configuredValue);
  assertMatchingPrincipalBinding(source, configured);
  return source || configured;
}

function assertMatchingPrincipalBinding(sourceValue, configuredValue) {
  if (sourceValue !== null && configuredValue !== null && sourceValue !== configuredValue) {
    throw new MmcHttpError(403, 'MMC_PRINCIPAL_SCOPE_MISMATCH', 'The authenticated MMC principal scope does not match the configured scope.');
  }
}

function normalizeRole(value) {
  if (typeof value !== 'string') {
    throw new MmcHttpError(403, 'MMC_ROLE_FORBIDDEN', 'The authenticated role is not recognized by MMC.');
  }
  const role = value.trim().toLowerCase();
  if (['admin', 'mentor', 'operator', 'student', 'worker'].includes(role)) return role;
  throw new MmcHttpError(403, 'MMC_ROLE_FORBIDDEN', 'The authenticated role is not recognized by MMC.');
}

function normalizeEnvironment(value) {
  if (value !== undefined && typeof value !== 'string') {
    throw new MmcHttpError(503, 'MMC_ENVIRONMENT_INVALID', 'MMC environment binding is invalid.');
  }
  const environment = (value || 'LOCAL').trim().toUpperCase();
  if (['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'].includes(environment)) return environment;
  throw new MmcHttpError(503, 'MMC_ENVIRONMENT_INVALID', 'MMC environment binding is invalid.');
}

function requireOpaqueIdentifier(value, label) {
  if (typeof value !== 'string') {
    throw new MmcHttpError(422, 'INVALID_OPAQUE_IDENTIFIER', `The ${label} identifier is invalid.`);
  }
  const identifier = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(identifier)) {
    throw new MmcHttpError(422, 'INVALID_OPAQUE_IDENTIFIER', `The ${label} identifier is invalid.`);
  }
  return identifier;
}

function assertBodySize(actual, maximum) {
  if (actual > maximum) {
    throw new MmcHttpError(413, 'PAYLOAD_TOO_LARGE', 'The MMC request body exceeds the allowed size.');
  }
}

function normalizeHeaders(headers = {}) {
  if (typeof headers?.get === 'function') {
    return Object.fromEntries(['content-type', 'content-length', 'origin', 'sec-fetch-site', 'x-mmhq-csrf']
      .map((key) => [key, headers.get(key) || '']));
  }
  return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]));
}

function isMutationMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length > 0
    && leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function looksLikeAbsolutePath(value) {
  return /^(?:\/[A-Za-z0-9._ -]+|[A-Za-z]:[\\/])/u.test(String(value || ''));
}

function looksLikeCredential(value) {
  const text = String(value || '');
  return /^Bearer\s+/iu.test(text)
    || /^(?:sk-|eyJ)[A-Za-z0-9._-]{16,}$/u.test(text)
    || /(?:token|secret|password)=/iu.test(text);
}

function clampInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}
