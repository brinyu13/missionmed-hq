import crypto from 'node:crypto';

import { MentorCommandService } from '../../../lib/mmc/commands/mentor-owner-handlers.mjs';
import {
  validateMentorCommandEnvelope,
  validateMentorCommandResult,
} from '../../../lib/mmc/contracts/mentor-query-contract.mjs';
import { buildSafeErrorEnvelope } from '../../../lib/mmc/contracts/state-contract.mjs';
import {
  MMC_MENTOR_FIXTURE_PRINCIPAL_ID,
  MMC_MENTOR_FIXTURE_TENANT_ID,
  createDeterministicMentorSeed,
  createScaleMentorSeed,
} from '../../../lib/mmc/queries/deterministic-mentor-seed.mjs';
import { MemoryMentorRepository } from '../../../lib/mmc/queries/mentor-memory-repository.mjs';
import { MentorQueryService } from '../../../lib/mmc/queries/mentor-query-service.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

export const FIXTURE_NOW = '2026-07-22T13:00:00.000Z';
export const PRIMARY_SUBJECT_ID = 'subject_007_001';
export const SECONDARY_SUBJECT_ID = 'subject_007_002';
export const PRIMARY_SESSION_ID = 'session_007_history_001';

const UUID_NAMESPACE = '8fef2f07-6bb6-4a53-9d3d-16f241724fb3';

export class FixtureResponseError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createFixtureStore({ scenario = 'default' } = {}) {
  const seed = scenario === 'scale'
    ? createScaleMentorSeed({
      environment: 'FIXTURE',
      studentCount: 1000,
      taskCount: 10_000,
      reviewCount: 500,
      sessionCount: 100,
    })
    : createDeterministicMentorSeed({ environment: 'FIXTURE' });
  if (scenario === 'empty') clearFixtureRecords(seed);
  if (scenario === 'long-transcript') addLongTranscriptEvidence(seed);
  if (scenario === 'long-rtl') addLongRtlContent(seed);
  const repository = new MemoryMentorRepository({ seed });
  const principal = Object.freeze({
    id: MMC_MENTOR_FIXTURE_PRINCIPAL_ID,
    tenantId: MMC_MENTOR_FIXTURE_TENANT_ID,
    environment: 'FIXTURE',
    role: 'admin',
    capabilities: Object.freeze([
      MMC_CAPABILITIES.QUERY,
      MMC_CAPABILITIES.COMMAND,
      MMC_CAPABILITIES.REVIEW,
      MMC_CAPABILITIES.OPERATIONS,
    ]),
  });
  return {
    scenario,
    repository,
    principal,
    queryService: new MentorQueryService({ repository }),
    commandService: new MentorCommandService({ repository }),
    requests: [],
  };
}

export function fixtureScenarioFromRequest(request, url, fallback = 'default') {
  const explicit = normalizeScenario(url.searchParams.get('fixture'));
  if (explicit) return explicit;
  const cookie = String(request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('mmc_cam_fixture='));
  if (!cookie) return normalizeScenario(fallback) || 'default';
  return normalizeScenario(decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))) || 'default';
}

export function normalizeScenario(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const accepted = new Set([
    'default', 'loading', 'empty', 'partial', 'stale', 'offline-not-saved',
    'conflict', 'error', 'revoked', 'scale', 'long-transcript', 'long-rtl',
  ]);
  return accepted.has(normalized) ? normalized : '';
}

export function buildFixtureEnvelope(pathname, scenario = 'default', store = createFixtureStore({ scenario }), searchParams = null) {
  if (scenario === 'error') {
    throw new FixtureResponseError(503, 'FIXTURE_READ_FAILURE', 'The synthetic review source is temporarily unavailable.');
  }
  if (scenario === 'revoked') {
    throw new FixtureResponseError(403, 'ASSIGNMENT_REVOKED', 'This mentor assignment is no longer active.');
  }

  const route = decodeURIComponent(String(pathname || '')).replace(/\/+$/u, '') || '/';
  const match = mentorResourceForPath(route);
  if (!match) {
    throw new FixtureResponseError(404, 'FIXTURE_ROUTE_NOT_FOUND', 'The requested synthetic review route does not exist.');
  }
  const envelope = store.queryService.query(match.resource, {
    principal: store.principal,
    correlationId: deterministicUuid(`query:${scenario}:${route}`),
    limit: searchParams?.get('limit') || undefined,
    cursor: searchParams?.get('cursor') || undefined,
    filters: { ownerType: searchParams?.get('owner') || undefined },
    ...match.params,
  });
  return applyScenarioToEnvelope(envelope, scenario);
}

export async function executeFixtureCommand(command, scenario = 'default', store = createFixtureStore({ scenario })) {
  if (scenario === 'offline-not-saved') {
    throw new FixtureResponseError(503, 'OFFLINE', 'Connection unavailable. This command was not saved.');
  }
  if (scenario === 'revoked') {
    throw new FixtureResponseError(403, 'ASSIGNMENT_REVOKED', 'This mentor assignment is no longer active.');
  }
  if (scenario === 'conflict') {
    throw new FixtureResponseError(409, 'VERSION_CONFLICT', 'A newer version exists. Refresh before deciding.');
  }

  validateMentorCommandEnvelope(command);
  const result = await store.commandService.execute(command, {
    principal: store.principal,
    correlationId: deterministicUuid(`command:${command.commandId}`),
  });
  validateMentorCommandResult(result);
  return result;
}

export function fixtureErrorEnvelope(error, scenario = 'default') {
  const candidateCode = String(error?.code || '').toUpperCase();
  const code = /^[A-Z][A-Z0-9_]{2,63}$/u.test(candidateCode) ? candidateCode : 'FIXTURE_REQUEST_FAILED';
  const message = error instanceof FixtureResponseError || typeof error?.publicMessage === 'string'
    ? String(error.publicMessage || error.message)
    : 'The fixture request could not be completed.';
  return buildSafeErrorEnvelope({
    code,
    message,
    retryable: Number(error?.statusCode || 500) >= 500,
    correlationId: deterministicUuid(`${code}:${scenario}`),
  });
}

function mentorResourceForPath(route) {
  const prefix = '/api/mmc/v2/mentor';
  if (route === `${prefix}/today`) return { resource: 'today', params: {} };
  if (route === `${prefix}/students`) return { resource: 'students', params: {} };
  if (route === `${prefix}/work`) return { resource: 'work', params: {} };
  const review = route.match(/^\/api\/mmc\/v2\/mentor\/reviews(?:\/([^/]+))?(?:\/([^/]+))?$/u);
  if (review) return {
    resource: 'reviews',
    params: {
      queueKind: review[1] ? review[1].toUpperCase() : undefined,
      reviewId: review[2] || undefined,
    },
  };
  const operations = route.match(/^\/api\/mmc\/v2\/mentor\/operations(?:\/([^/]+))?(?:\/([^/]+))?$/u);
  if (operations) return { resource: 'operations', params: { area: operations[1] || undefined, itemId: operations[2] || undefined } };
  const student = route.match(/^\/api\/mmc\/v2\/mentor\/students\/([^/]+)\/(overview|plan|history|files|prep)$/u);
  if (student) {
    const resource = {
      overview: 'student_overview',
      plan: 'student_plan',
      history: 'student_history',
      files: 'student_files',
      prep: 'call_prep',
    }[student[2]];
    return { resource, params: { subjectLinkId: student[1] } };
  }
  const detail = route.match(/^\/api\/mmc\/v2\/mentor\/students\/([^/]+)\/history\/sessions\/([^/]+)$/u);
  if (detail) return { resource: 'session_detail', params: { subjectLinkId: detail[1], sessionId: detail[2] } };
  const session = route.match(/^\/api\/mmc\/v2\/mentor\/sessions\/([^/]+)\/(live|review)$/u);
  if (session) {
    return {
      resource: session[2] === 'live' ? 'live_session' : 'session_review',
      params: { sessionId: session[1] },
    };
  }
  return null;
}

function applyScenarioToEnvelope(envelope, scenario) {
  const copy = structuredClone(envelope);
  if (scenario === 'stale') copy.meta.freshness = 'STALE';
  if (scenario === 'partial') {
    const firstSection = Object.keys(copy.meta.sections)[0];
    if (firstSection) copy.meta.sections[firstSection] = 'PARTIAL';
  }
  return copy;
}

function clearFixtureRecords(seed) {
  for (const field of [
    'students', 'assignments', 'sessions', 'captures', 'tasks', 'commitments',
    'plans', 'milestones', 'attentions', 'reviews', 'files',
  ]) seed[field].clear();
}

function addLongTranscriptEvidence(seed) {
  const unit = 'Synthetic transcript evidence remains bounded, attributed, and explicitly non-production. ';
  const text = unit.repeat(Math.ceil(1011 / unit.length)).slice(0, 1011);
  for (let index = 0; index < 99; index += 1) {
    const suffix = String(index + 1).padStart(3, '0');
    seed.captures.set(`capture_007_long_${suffix}`, {
      id: `capture_007_long_${suffix}`,
      kind: 'CAPTURE',
      tenantId: seed.meta.tenantId,
      environment: seed.meta.environment,
      subjectLinkId: PRIMARY_SUBJECT_ID,
      assignmentId: 'assignment_007_001',
      sessionId: PRIMARY_SESSION_ID,
      version: 1,
      captureKind: index % 2 ? 'QUESTION' : 'PRIVATE_MEMORY',
      text,
      occurredAt: `2026-07-12T14:${String(index % 60).padStart(2, '0')}:00.000Z`,
      reviewState: 'APPROVED',
      visibility: 'MENTOR_PRIVATE',
      publicationState: 'NOT_ELIGIBLE',
      updatedAt: '2026-07-12T14:42:00.000Z',
    });
  }
}

function addLongRtlContent(seed) {
  const student = seed.students.get(PRIMARY_SUBJECT_ID);
  seed.students.set(PRIMARY_SUBJECT_ID, {
    ...student,
    displayName: 'آمنة عبد الرحمن — طالبة تجريبية ذات اسم طويل للتحقق من اتجاه النص والاستجابة',
    program: 'برنامج الإرشاد الطبي الدولي — محتوى اصطناعي',
    nextAction: 'مراجعة الدليل الحالي وتأكيد الخطوة التالية دون افتراضات.',
  });
}

function deterministicUuid(input) {
  const digest = crypto.createHash('sha256').update(`${UUID_NAMESPACE}:${input}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
