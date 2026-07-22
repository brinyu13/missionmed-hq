import crypto from 'node:crypto';

import { MentorCommandService } from '../../lib/mmc/commands/mentor-owner-handlers.mjs';
import { canonicalUuid } from '../../lib/mmc/contracts/uuid-contract.mjs';
import { isMmcRouteSafeId } from '../../lib/mmc/contracts/mentor-query-contract.mjs';
import {
  createDeterministicMentorSeed,
} from '../../lib/mmc/queries/deterministic-mentor-seed.mjs';
import { MemoryMentorRepository } from '../../lib/mmc/queries/mentor-memory-repository.mjs';
import { MentorQueryService } from '../../lib/mmc/queries/mentor-query-service.mjs';
import {
  MMC_JSON_SECURITY_HEADERS,
  MmcHttpError,
  assertMmcCsrf,
  decodeCanonicalRequestPathname,
  deriveMmcPrincipal,
  readBoundedJsonBody,
  safeMmcErrorPayload,
} from '../../lib/mmc/trust/security.mjs';

export const MMC_MENTOR_API_PREFIX = '/api/mmc/v2/mentor';

export const MENTOR_ROUTE_CONTRACT = Object.freeze([
  Object.freeze({ method: 'GET', path: '/today', resource: 'today' }),
  Object.freeze({ method: 'GET', path: '/students', resource: 'students' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/overview', resource: 'student_overview' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/plan', resource: 'student_plan' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/history', resource: 'student_history' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/history/sessions/:sessionId', resource: 'session_detail' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/files', resource: 'student_files' }),
  Object.freeze({ method: 'GET', path: '/students/:subjectLinkId/prep', resource: 'call_prep' }),
  Object.freeze({ method: 'GET', path: '/sessions/:sessionId/live', resource: 'live_session' }),
  Object.freeze({ method: 'GET', path: '/sessions/:sessionId/review', resource: 'session_review' }),
  Object.freeze({ method: 'GET', path: '/work', resource: 'work' }),
  Object.freeze({ method: 'GET', path: '/reviews/:queueKind?/:reviewId?', resource: 'reviews' }),
  Object.freeze({ method: 'GET', path: '/operations/:area?/:itemId?', resource: 'operations' }),
  Object.freeze({ method: 'POST', path: '/commands', resource: 'commands' }),
]);

const runtimeByScope = new Map();

export function isMmcMentorPath(pathname = '') {
  const normalized = String(pathname || '').replace(/\/+$/u, '') || '/';
  return normalized === MMC_MENTOR_API_PREFIX || normalized.startsWith(`${MMC_MENTOR_API_PREFIX}/`);
}

export function createLocalMentorRuntime(options = {}) {
  const repository = options.repository || new MemoryMentorRepository({
    seed: options.seed || createDeterministicMentorSeed({
      tenantId: options.tenantId,
      environment: options.environment,
      mentorPrincipalId: options.mentorPrincipalId,
    }),
    clock: options.clock,
  });
  return Object.freeze({
    repository,
    queryService: options.queryService || new MentorQueryService({ repository }),
    commandService: options.commandService || new MentorCommandService({
      repository,
      idFactory: options.idFactory,
    }),
  });
}

export function getDefaultLocalMentorRuntime(config, principal) {
  const key = [config.tenantId, config.environment, principal.id].join('\u001f');
  if (!runtimeByScope.has(key)) {
    runtimeByScope.set(key, createLocalMentorRuntime({
      tenantId: config.tenantId,
      environment: config.environment,
      mentorPrincipalId: principal.id,
    }));
  }
  return runtimeByScope.get(key);
}

export async function handleMmcMentorRoute(request, response, url, deps = {}) {
  if (!isMmcMentorPath(url?.pathname)) return false;
  const correlationId = `corr_${crypto.randomUUID()}`;
  const headers = { ...MMC_JSON_SECURITY_HEADERS };
  const privateSendJson = deps.mentorSendJson || deps.sendJson;
  const send = (status, payload) => privateSendJson(response, status, payload, headers);

  try {
    if (typeof privateSendJson !== 'function') {
      throw new TypeError('The MMC mentor route requires a JSON response adapter.');
    }
    if (!deps.isAuthorizedMmcPrivateSession?.(deps.session)) {
      throw new MmcHttpError(403, 'MMC_PRIVATE_FORBIDDEN', 'The mentor workspace requires private route authorization.');
    }
    const config = resolveMentorConfig(deps.mentorConfig);
    if (!config.enabled) {
      throw new MmcHttpError(503, 'MMC_MENTOR_EXPERIENCE_DISABLED', 'The mentor experience is disabled by default.');
    }
    if (!config.inMemoryEnabled || !['FIXTURE', 'LOCAL'].includes(config.environment)) {
      throw new MmcHttpError(503, 'MENTOR_DURABLE_PERSISTENCE_REQUIRED',
        'The local mentor repository cannot serve this environment.');
    }

    const principal = resolvePrincipal(deps, config);
    const runtime = deps.mentorRuntime || getDefaultLocalMentorRuntime(config, principal);
    validateRuntime(runtime);
    const pathname = decodeCanonicalRequestPathname(url.pathname).replace(/\/+$/u, '') || MMC_MENTOR_API_PREFIX;
    const route = matchMmcMentorRoute(pathname);
    if (!route) throw new MmcHttpError(404, 'MMC_MENTOR_ROUTE_NOT_FOUND', 'The mentor route was not found.');
    const method = String(request?.method || 'GET').toUpperCase();
    if (method !== route.method) {
      throw new MmcHttpError(405, 'MMC_MENTOR_METHOD_NOT_ALLOWED', 'The request method is not allowed for this mentor route.');
    }

    assertMentorRequestBoundary(request, url, config, {
      requireOrigin: route.resource === 'commands',
    });

    if (route.resource === 'commands') {
      if (!config.commandsEnabled) {
        throw new MmcHttpError(503, 'MMC_MENTOR_COMMANDS_DISABLED', 'Mentor commands are disabled by default.');
      }
      assertMmcCsrf(request, deps.session);
      const command = await readBoundedJsonBody(request, { maxBytes: config.maxJsonBytes });
      const result = await runtime.commandService.execute(command, { principal, correlationId });
      send(200, result);
      return true;
    }

    const limit = url.searchParams.get('limit') || undefined;
    const cursor = url.searchParams.get('cursor') || undefined;
    const filters = {
      ownerType: url.searchParams.get('owner') || undefined,
    };
    const result = runtime.queryService.query(route.resource, {
      principal,
      correlationId,
      limit,
      cursor,
      filters,
      ...route.params,
    });
    send(200, result);
    return true;
  } catch (error) {
    const safe = safeMmcErrorPayload(error, { correlationId });
    send(safe.statusCode, safe.payload);
    return true;
  }
}

export function matchMmcMentorRoute(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/u, '') || MMC_MENTOR_API_PREFIX;
  if (!isMmcMentorPath(normalized)) return null;
  const remainder = normalized.slice(MMC_MENTOR_API_PREFIX.length);
  const segments = remainder.split('/').filter(Boolean);
  if (!segments.length) return null;
  if (segments.length === 1) {
    const resourceBySegment = {
      today: 'today',
      students: 'students',
      work: 'work',
      reviews: 'reviews',
      operations: 'operations',
      commands: 'commands',
    };
    const resource = resourceBySegment[segments[0]];
    if (!resource) return null;
    return Object.freeze({
      method: resource === 'commands' ? 'POST' : 'GET',
      resource,
      params: Object.freeze({}),
    });
  }
  if (segments[0] === 'students' && isOpaqueRouteId(segments[1])) {
    const subjectLinkId = segments[1];
    if (segments.length === 3) {
      const resource = {
        overview: 'student_overview',
        plan: 'student_plan',
        history: 'student_history',
        files: 'student_files',
        prep: 'call_prep',
      }[segments[2]];
      if (resource) return routeMatch(resource, { subjectLinkId });
    }
    if (segments.length === 5 && segments[2] === 'history' && segments[3] === 'sessions'
        && isOpaqueRouteId(segments[4])) {
      return routeMatch('session_detail', { subjectLinkId, sessionId: segments[4] });
    }
  }
  if (segments[0] === 'sessions' && segments.length === 3 && isOpaqueRouteId(segments[1])) {
    const resource = { live: 'live_session', review: 'session_review' }[segments[2]];
    if (resource) return routeMatch(resource, { sessionId: segments[1] });
  }
  if (segments[0] === 'reviews' && segments.length <= 3
      && segments.slice(1).every(isOpaqueRouteId)) {
    return routeMatch('reviews', {
      queueKind: segments[1] ? segments[1].toUpperCase() : 'ALL',
      reviewId: segments[2] || null,
    });
  }
  if (segments[0] === 'operations' && segments.length <= 3
      && segments.slice(1).every(isOpaqueRouteId)) {
    return routeMatch('operations', {
      area: segments[1] || null,
      itemId: segments[2] || null,
    });
  }
  return null;
}

function resolveMentorConfig(injected = null) {
  const source = injected || {
    enabled: flag(process.env.MMHQ_MMC_CAM_MENTOR_ENABLED),
    commandsEnabled: flag(process.env.MMHQ_MMC_CAM_MENTOR_COMMANDS_ENABLED),
    inMemoryEnabled: flag(process.env.MMHQ_MMC_CAM_LOCAL_IN_MEMORY_ENABLED),
    tenantId: process.env.MMHQ_MMC_V2_TENANT_ID,
    environment: process.env.MMHQ_MMC_V2_ENVIRONMENT,
    approvedOrigins: splitCsv(process.env.MMHQ_MMC_V2_APPROVED_ORIGINS),
    allowLoopbackHttp: flag(process.env.MMHQ_MMC_CAM_LOCAL_HTTP_ENABLED),
    maxJsonBytes: Number(process.env.MMHQ_MMC_V2_MAX_JSON_BYTES || 64 * 1024),
  };
  if (String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production'
      && (source.enabled === true || source.inMemoryEnabled === true || source.commandsEnabled === true)) {
    throw new MmcHttpError(503, 'MMC_MENTOR_LOCAL_RUNTIME_PRODUCTION_FORBIDDEN',
      'The local in-memory mentor experience cannot run in a production process.');
  }
  const tenantId = canonicalUuid(source.tenantId);
  if (!tenantId) {
    throw new MmcHttpError(503, 'MMC_MENTOR_TENANT_UNAVAILABLE', 'The mentor tenant binding is unavailable.');
  }
  const environment = String(source.environment || '').trim().toUpperCase();
  if (!['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'].includes(environment)) {
    throw new MmcHttpError(503, 'MMC_MENTOR_ENVIRONMENT_UNAVAILABLE', 'The mentor environment binding is unavailable.');
  }
  const maxJsonBytes = Number(source.maxJsonBytes);
  return Object.freeze({
    enabled: source.enabled === true,
    commandsEnabled: source.commandsEnabled === true,
    inMemoryEnabled: source.inMemoryEnabled === true,
    tenantId,
    environment,
    approvedOrigins: Object.freeze(Array.isArray(source.approvedOrigins) ? [...source.approvedOrigins] : []),
    allowLoopbackHttp: source.allowLoopbackHttp === true && ['LOCAL', 'FIXTURE'].includes(environment),
    maxJsonBytes: Number.isSafeInteger(maxJsonBytes) ? Math.max(1024, Math.min(256 * 1024, maxJsonBytes)) : 64 * 1024,
  });
}

function resolvePrincipal(deps, config) {
  const sourcePrincipal = deps.mmcPrincipal
    || (typeof deps.buildMmcPrincipal === 'function' ? deps.buildMmcPrincipal(deps.session) : deps.session?.mmcPrincipal);
  return deriveMmcPrincipal({
    sourcePrincipal,
    tenantId: config.tenantId,
    environment: config.environment,
    capabilities: deps.mentorCapabilities || [],
  });
}

function assertMentorRequestBoundary(request, requestUrl, config, options = {}) {
  const headers = normalizeHeaders(request?.headers);
  const fetchSite = String(headers['sec-fetch-site'] || '').trim().toLowerCase();
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
    throw new MmcHttpError(403, 'FETCH_METADATA_FORBIDDEN', 'Only same-origin MMC requests are allowed.');
  }

  const suppliedHeader = String(headers.origin || '').trim();
  if (!suppliedHeader) {
    if (options.requireOrigin === true) {
      throw new MmcHttpError(403, 'ORIGIN_REQUIRED', 'An exact same-origin request is required.');
    }
    return;
  }

  const supplied = normalizeMentorOrigin(suppliedHeader, config.allowLoopbackHttp);
  const requestOrigin = normalizeMentorOrigin(requestUrl?.origin, config.allowLoopbackHttp);
  const approved = new Set(config.approvedOrigins
    .map((origin) => normalizeMentorOrigin(origin, config.allowLoopbackHttp))
    .filter(Boolean));
  if (!supplied || !requestOrigin || supplied !== requestOrigin || !approved.has(supplied)) {
    throw new MmcHttpError(403, 'ORIGIN_FORBIDDEN', 'The request origin is not the exact MMC application origin.');
  }
}

function normalizeMentorOrigin(value, allowLoopbackHttp) {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.pathname !== '/'
        || parsed.search || parsed.hash || !parsed.port && parsed.host.endsWith(':')) return null;
    if (parsed.protocol === 'https:') return parsed.origin;
    if (allowLoopbackHttp === true && parsed.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase())) {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeHeaders(headers = {}) {
  if (typeof headers?.get === 'function') {
    return Object.fromEntries(['origin', 'sec-fetch-site'].map((key) => [key, headers.get(key) || '']));
  }
  return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]));
}

function validateRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object'
      || typeof runtime.queryService?.query !== 'function'
      || typeof runtime.commandService?.execute !== 'function'
      || typeof runtime.repository?.snapshot !== 'function') {
    throw new MmcHttpError(503, 'MMC_MENTOR_RUNTIME_UNAVAILABLE', 'The local mentor runtime is unavailable.');
  }
}

function routeMatch(resource, params) {
  return Object.freeze({ method: 'GET', resource, params: Object.freeze(params) });
}

function isOpaqueRouteId(value) {
  return isMmcRouteSafeId(value);
}

function flag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function splitCsv(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}
