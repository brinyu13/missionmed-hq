import crypto from 'node:crypto';

import {
  MENTOR_QUERY_KIND,
  buildMentorQueryEnvelope,
} from '../contracts/mentor-query-contract.mjs';
import { FRESHNESS, SECTION_STATE } from '../contracts/state-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';
import { isMmcAssignmentEffective } from '../trust/assignment-authority.mjs';
import { rankMentorAttention } from './attention-ranking.mjs';

const CURSOR_KEY = Buffer.from('MMC_CAM_007_DETERMINISTIC_LOCAL_CURSOR_KEY', 'utf8');

export const MENTOR_QUERY_RESOURCES = Object.freeze([
  'today',
  'students',
  'student_overview',
  'student_plan',
  'student_history',
  'session_detail',
  'student_files',
  'call_prep',
  'live_session',
  'session_review',
  'work',
  'reviews',
  'operations',
]);

export class MentorQueryService {
  #repository;

  constructor({ repository }) {
    if (!repository || typeof repository.snapshot !== 'function' || typeof repository.now !== 'function') {
      throw new TypeError('MentorQueryService requires a mentor repository.');
    }
    this.#repository = repository;
  }

  get repository() {
    return this.#repository;
  }

  query(resource, options = {}) {
    if (!MENTOR_QUERY_RESOURCES.includes(resource)) {
      throw new MmcHttpError(404, 'MENTOR_QUERY_NOT_FOUND', 'The mentor query was not found.');
    }
    const state = this.#repository.snapshot();
    const now = this.#repository.now();
    const principal = requireQueryPrincipal(state, options.principal, resource);
    const correlationId = requireCorrelationId(options.correlationId);
    const page = resolvePage(options, principal, resource);

    switch (resource) {
      case 'today':
        return this.#today(state, principal, now, correlationId);
      case 'students':
        return this.#students(state, principal, now, correlationId, page);
      case 'student_overview':
        return this.#overview(state, principal, now, correlationId, options.subjectLinkId);
      case 'student_plan':
        return this.#plan(state, principal, now, correlationId, options.subjectLinkId);
      case 'student_history':
        return this.#history(state, principal, now, correlationId, options.subjectLinkId, page);
      case 'session_detail':
        return this.#sessionDetail(state, principal, now, correlationId, options.subjectLinkId, options.sessionId);
      case 'student_files':
        return this.#files(state, principal, now, correlationId, options.subjectLinkId, page);
      case 'call_prep':
        return this.#prep(state, principal, now, correlationId, options.subjectLinkId);
      case 'live_session':
        return this.#liveSession(state, principal, now, correlationId, options.sessionId);
      case 'session_review':
        return this.#sessionReview(state, principal, now, correlationId, options.sessionId);
      case 'work':
        return this.#work(state, principal, now, correlationId, page, options.filters);
      case 'reviews':
        return this.#reviews(state, principal, now, correlationId, page, options.queueKind, options.reviewId);
      case 'operations':
        return this.#operations(state, principal, now, correlationId, options.area, options.itemId);
      default:
        throw new MmcHttpError(404, 'MENTOR_QUERY_NOT_FOUND', 'The mentor query was not found.');
    }
  }

  #today(state, principal, now, correlationId) {
    const scope = authorizedScope(state, principal, now);
    const ranked = rankMentorAttention(
      [...state.attentions.values()].filter((item) => scope.subjects.has(item.subjectLinkId)),
      { now },
    );
    const attention = ranked.map((item) => attentionDto(item, state, now));
    const sessions = [...state.sessions.values()]
      .filter((session) => scope.subjects.has(session.subjectLinkId) && session.status === 'SCHEDULED')
      .sort((left, right) => String(left.scheduledAt).localeCompare(String(right.scheduledAt)));
    const mentorPromises = [...state.commitments.values()]
      .filter((item) => scope.subjects.has(item.subjectLinkId) && item.ownerType === 'MENTOR' && !isTerminalWork(item.status))
      .sort(workOrder)
      .slice(0, 100)
      .map(workDto);
    const reviewWaits = [...state.reviews.values()]
      .filter((item) => scope.subjects.has(item.subjectLinkId) && ['OPEN', 'DEFERRED', 'NEEDS_EVIDENCE'].includes(item.state))
      .sort(reviewOrder)
      .slice(0, 100)
      .map(reviewDto);

    return envelope(MENTOR_QUERY_KIND.TODAY, {
      kind: MENTOR_QUERY_KIND.TODAY,
      version: state.meta.version,
      attention,
      disclosure: { initialLimit: 3, additionalCount: Math.min(4, Math.max(0, attention.length - 3)) },
      upcomingCall: sessions.length ? sessionDto(sessions[0]) : null,
      mentorPromises,
      reviewWaits,
      operatingState: {
        authority: 'DETERMINISTIC_LOCAL_FIXTURE',
        persistence: 'LOCAL_IN_MEMORY',
        providers: 'DISABLED',
        studentPublication: 'DISABLED_UNTIL_008',
      },
    }, principal, now, correlationId, {
      attention: attention.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      upcoming_call: sessions.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      mentor_promises: mentorPromises.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      review_waits: reviewWaits.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      providers: SECTION_STATE.UNAVAILABLE,
    });
  }

  #students(state, principal, now, correlationId, page) {
    const scope = authorizedScope(state, principal, now);
    const rows = [...state.students.values()]
      .filter((student) => scope.subjects.has(student.id))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'en') || left.id.localeCompare(right.id, 'en'));
    const slice = paginate(rows, page, principal, 'students');
    const students = slice.items.map((student) => studentSummaryDto(student, scope.assignmentBySubject.get(student.id)));
    return envelope(MENTOR_QUERY_KIND.STUDENTS, {
      kind: MENTOR_QUERY_KIND.STUDENTS,
      version: state.meta.version,
      students,
      total: rows.length,
      nextCursor: slice.nextCursor,
    }, principal, now, correlationId, {
      directory: students.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      identity: SECTION_STATE.AVAILABLE,
      assignments: SECTION_STATE.AVAILABLE,
    });
  }

  #overview(state, principal, now, correlationId, subjectLinkId) {
    const { student, assignment } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const attention = rankMentorAttention(
      [...state.attentions.values()].filter((item) => item.subjectLinkId === student.id),
      { now },
    );
    const sessions = subjectValues(state.sessions, student.id).sort(sessionOrder);
    const commitments = subjectValues(state.commitments, student.id).filter((item) => !isTerminalWork(item.status)).map(workDto);
    const changes = buildChanges(state, student.id);
    return envelope(MENTOR_QUERY_KIND.STUDENT_OVERVIEW, {
      kind: MENTOR_QUERY_KIND.STUDENT_OVERVIEW,
      subjectLink: {
        id: student.id,
        displayName: student.displayName,
        identityState: student.identityState,
        version: student.version,
      },
      assignment: assignmentDto(assignment),
      version: maxVersion([student, assignment, ...sessions, ...subjectValues(state.tasks, student.id), ...subjectValues(state.commitments, student.id)]),
      changes,
      nextSafeMove: attention.length ? attentionDto(attention[0], state, now) : { state: 'NONE', label: 'No action is currently required.' },
      upcomingCall: sessions.find((session) => session.status === 'SCHEDULED') ? sessionDto(sessions.find((session) => session.status === 'SCHEDULED')) : null,
      commitments,
      dataSufficiency: structuredClone(student.dataSufficiency),
      handlingContext: structuredClone(student.handlingContext),
    }, principal, now, correlationId, {
      changes: changes.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      plan: SECTION_STATE.AVAILABLE,
      history: sessions.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      data_sufficiency: student.dataSufficiency.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      private_context: student.handlingContext.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
    }, student.freshness);
  }

  #plan(state, principal, now, correlationId, subjectLinkId) {
    const { student } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const goals = subjectValues(state.plans, student.id).map(planDto);
    const milestones = subjectValues(state.milestones, student.id).map(milestoneDto);
    const tasks = subjectValues(state.tasks, student.id).map(workDto);
    const commitments = subjectValues(state.commitments, student.id).map(workDto);
    const openLoops = [...tasks, ...commitments].filter((item) => !isTerminalWork(item.status));
    return envelope(MENTOR_QUERY_KIND.STUDENT_PLAN, {
      kind: MENTOR_QUERY_KIND.STUDENT_PLAN,
      subjectLinkId: student.id,
      version: maxVersion([...goals, ...milestones, ...tasks, ...commitments], student.version),
      goals,
      milestones,
      tasks,
      commitments,
      openLoops,
    }, principal, now, correlationId, {
      goals: goals.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      milestones: milestones.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      tasks: tasks.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      commitments: commitments.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      open_loops: openLoops.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
    }, student.freshness);
  }

  #history(state, principal, now, correlationId, subjectLinkId, page) {
    const { student } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const rows = subjectValues(state.sessions, student.id).sort(sessionOrder);
    const slice = paginate(rows, page, principal, `history:${student.id}`);
    const sessions = slice.items.map(sessionDto);
    const observations = subjectValues(state.captures, student.id)
      .filter((capture) => capture.reviewState === 'APPROVED')
      .slice(0, 100)
      .map(captureDto);
    const timeline = sessions.map((session) => ({
      id: `timeline_${session.id}`,
      kind: 'SESSION',
      label: session.objective,
      occurredAt: session.startedAt,
      sourceAuthority: 'HUMAN_JUDGMENT',
    }));
    return envelope(MENTOR_QUERY_KIND.STUDENT_HISTORY, {
      kind: MENTOR_QUERY_KIND.STUDENT_HISTORY,
      subjectLinkId: student.id,
      version: maxVersion(rows, student.version),
      sessions,
      observations,
      timeline,
      corrections: [],
      nextCursor: slice.nextCursor,
    }, principal, now, correlationId, {
      sessions: sessions.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      observations: observations.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      timeline: timeline.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      corrections: SECTION_STATE.EMPTY,
    }, student.freshness);
  }

  #sessionDetail(state, principal, now, correlationId, subjectLinkId, sessionId) {
    const { student } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const session = requireSession(state, principal, now, sessionId);
    if (session.subjectLinkId !== student.id) resourceNotFound();
    const captures = [...state.captures.values()].filter((capture) => capture.sessionId === session.id).map(captureDto);
    const proposals = subjectValues(state.reviews, student.id).filter((item) => item.sessionId === session.id || !item.sessionId).map(reviewDto).slice(0, 100);
    const evidence = captures.map((capture) => ({
      id: `evidence_${capture.id}`,
      sourceLabel: 'Mentor typed capture',
      origin: 'OBSERVED',
      freshness: 'CURRENT',
      reviewState: capture.reviewState,
      observedAt: capture.occurredAt,
    }));
    return envelope(MENTOR_QUERY_KIND.SESSION_DETAIL, {
      kind: MENTOR_QUERY_KIND.SESSION_DETAIL,
      subjectLinkId: student.id,
      session: sessionDto(session),
      captures,
      proposals,
      evidence,
    }, principal, now, correlationId, {
      session: SECTION_STATE.AVAILABLE,
      captures: captures.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      proposals: proposals.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      evidence: evidence.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
    }, student.freshness);
  }

  #files(state, principal, now, correlationId, subjectLinkId, page) {
    const { student } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const rows = subjectValues(state.files, student.id).sort((left, right) => left.label.localeCompare(right.label, 'en'));
    const slice = paginate(rows, page, principal, `files:${student.id}`);
    const files = slice.items.map(fileDto);
    return envelope(MENTOR_QUERY_KIND.STUDENT_FILES, {
      kind: MENTOR_QUERY_KIND.STUDENT_FILES,
      subjectLinkId: student.id,
      version: maxVersion(rows, student.version),
      files,
      nextCursor: slice.nextCursor,
    }, principal, now, correlationId, {
      files: files.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      provider_links: SECTION_STATE.UNAVAILABLE,
    }, student.freshness);
  }

  #prep(state, principal, now, correlationId, subjectLinkId) {
    const { student } = requireAuthorizedStudent(state, principal, now, subjectLinkId);
    const sessions = subjectValues(state.sessions, student.id).sort(sessionOrder);
    const upcoming = sessions.find((session) => session.status === 'SCHEDULED');
    const commitments = subjectValues(state.commitments, student.id).filter((item) => !isTerminalWork(item.status)).map(workDto);
    const milestones = subjectValues(state.milestones, student.id).map(milestoneDto);
    const changes = buildChanges(state, student.id);
    return envelope(MENTOR_QUERY_KIND.CALL_PREP, {
      kind: MENTOR_QUERY_KIND.CALL_PREP,
      subjectLinkId: student.id,
      version: maxVersion([student, ...sessions, ...subjectValues(state.commitments, student.id), ...subjectValues(state.milestones, student.id)]),
      objective: upcoming?.objective || `Clarify the next evidence-backed action for ${student.displayName}.`,
      changes,
      commitments,
      nextQuestion: student.nextAction,
      milestone: milestones[0] || null,
      handlingContext: structuredClone(student.handlingContext),
      dataGaps: structuredClone(student.dataSufficiency.filter((item) => item.state !== 'CURRENT')),
      pinnedObjectIds: [...commitments.slice(0, 2).map((item) => item.id), ...(milestones[0] ? [milestones[0].id] : [])],
    }, principal, now, correlationId, {
      objective: SECTION_STATE.AVAILABLE,
      changes: changes.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      commitments: commitments.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      milestone: milestones.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      private_context: student.handlingContext.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      data_gaps: student.dataSufficiency.some((item) => item.state !== 'CURRENT') ? SECTION_STATE.PARTIAL : SECTION_STATE.EMPTY,
    }, student.freshness);
  }

  #liveSession(state, principal, now, correlationId, sessionId) {
    const session = requireSession(state, principal, now, sessionId);
    if (!['ACTIVE', 'PAUSED', 'REVIEW_REQUIRED'].includes(session.status)) {
      throw new MmcHttpError(409, 'SESSION_NOT_LIVE', 'This session is not in a live or resumable state.');
    }
    const captures = [...state.captures.values()].filter((capture) => capture.sessionId === session.id).map(captureDto);
    const priorCommitments = subjectValues(state.commitments, session.subjectLinkId).filter((item) => !isTerminalWork(item.status)).map(workDto);
    return envelope(MENTOR_QUERY_KIND.LIVE_SESSION, {
      kind: MENTOR_QUERY_KIND.LIVE_SESSION,
      subjectLinkId: session.subjectLinkId,
      session: {
        ...sessionDto(session),
        elapsedSeconds: Math.max(0, Math.floor((now.valueOf() - Date.parse(session.startedAt)) / 1000)),
      },
      objective: session.objective,
      priorCommitments,
      captures,
      saveState: session.persistence === 'SAVED' ? 'SAVED' : 'NOT_SAVED',
      connectivity: session.connectivity || 'ONLINE',
      subjectLocked: true,
    }, principal, now, correlationId, {
      session: SECTION_STATE.AVAILABLE,
      captures: captures.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      prior_commitments: priorCommitments.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      offline_persistence: SECTION_STATE.UNAVAILABLE,
    });
  }

  #sessionReview(state, principal, now, correlationId, sessionId) {
    const session = requireSession(state, principal, now, sessionId);
    if (!['REVIEW_REQUIRED', 'CLOSED'].includes(session.status)) {
      throw new MmcHttpError(409, 'SESSION_REVIEW_NOT_READY', 'End the session before opening post-session review.');
    }
    const proposals = subjectValues(state.reviews, session.subjectLinkId)
      .filter((item) => item.sessionId === session.id)
      .map(reviewDto);
    const items = proposals.slice(0, 100);
    return envelope(MENTOR_QUERY_KIND.SESSION_REVIEW, {
      kind: MENTOR_QUERY_KIND.SESSION_REVIEW,
      subjectLinkId: session.subjectLinkId,
      session: sessionDto(session),
      items,
      complexityBand: items.length <= 3 ? 'SMALL_MANUAL' : (items.length <= 10 ? 'BOUNDED_ASSISTED' : 'COMPLEX_DEFERRED'),
      publicationPlane: 'DISABLED_UNTIL_008',
    }, principal, now, correlationId, {
      session: SECTION_STATE.AVAILABLE,
      review_items: items.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      publication: SECTION_STATE.UNAVAILABLE,
    });
  }

  #work(state, principal, now, correlationId, page, filters = {}) {
    const scope = authorizedScope(state, principal, now);
    const allowedOwners = ['MENTOR', 'STUDENT', 'SHARED'];
    const ownerType = allowedOwners.includes(filters?.ownerType) ? filters.ownerType : null;
    const rows = [...state.tasks.values(), ...state.commitments.values()]
      .filter((item) => scope.subjects.has(item.subjectLinkId) && (!ownerType || item.ownerType === ownerType))
      .sort(workOrder);
    const slice = paginate(rows, page, principal, `work:${ownerType || 'ALL'}`);
    const items = slice.items.map(workDto);
    return envelope(MENTOR_QUERY_KIND.WORK, {
      kind: MENTOR_QUERY_KIND.WORK,
      version: maxVersion(rows, state.meta.version),
      items,
      total: rows.length,
      nextCursor: slice.nextCursor,
      filters: ['owner', 'consequence', 'due_window', 'program', 'cohort', 'evidence_freshness'],
    }, principal, now, correlationId, {
      work: items.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      ownership: SECTION_STATE.AVAILABLE,
    });
  }

  #reviews(state, principal, now, correlationId, page, queueKind = 'ALL', reviewId = null) {
    const scope = authorizedScope(state, principal, now);
    let rows = [...state.reviews.values()].filter((item) => scope.subjects.has(item.subjectLinkId));
    if (queueKind && queueKind !== 'ALL') rows = rows.filter((item) => item.queueKind === queueKind);
    if (reviewId) rows = rows.filter((item) => item.id === reviewId);
    rows.sort(reviewOrder);
    const slice = paginate(rows, page, principal, `reviews:${queueKind || 'ALL'}:${reviewId || 'ALL'}`);
    const items = slice.items.map(reviewDto);
    return envelope(MENTOR_QUERY_KIND.REVIEWS, {
      kind: MENTOR_QUERY_KIND.REVIEWS,
      version: maxVersion(rows, state.meta.version),
      queueKind: queueKind || 'ALL',
      items,
      total: rows.length,
      nextCursor: slice.nextCursor,
    }, principal, now, correlationId, {
      review_queue: items.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
      ai_proposals: SECTION_STATE.PARTIAL,
      student_publication: SECTION_STATE.UNAVAILABLE,
    });
  }

  #operations(state, principal, now, correlationId, area = null, itemId = null) {
    if (!['admin', 'operator'].includes(principal.role)) {
      throw new MmcHttpError(403, 'MENTOR_OPERATIONS_FORBIDDEN', 'Operations requires the MMC operations role.');
    }
    assertCapability(principal, MMC_CAPABILITIES.OPERATIONS);
    const allAreas = [
      { id: 'pipeline', label: 'Pipeline', state: 'LOCAL_ONLY' },
      { id: 'identity', label: 'Identity review', state: 'DETERMINISTIC_FIXTURE' },
      { id: 'jobs', label: 'Jobs', state: 'NO_DURABLE_ADAPTER' },
      { id: 'webex', label: 'Webex policy', state: 'PROVIDER_DISABLED' },
      { id: 'prompts', label: 'Prompt policy', state: 'NO_ACTIVE_PROVIDER' },
      { id: 'audit', label: 'Audit', state: 'LOCAL_IN_MEMORY' },
    ];
    const areas = area ? allAreas.filter((entry) => entry.id === area) : allAreas;
    if (area && !areas.length) resourceNotFound();
    return envelope(MENTOR_QUERY_KIND.OPERATIONS, {
      kind: MENTOR_QUERY_KIND.OPERATIONS,
      version: state.meta.version,
      areas: areas.map((entry) => ({ ...entry, selectedItemId: itemId || null })),
      health: {
        gateway: 'LOCAL_FIXTURE_READY',
        commands: 'LOCAL_IN_MEMORY_ONLY',
        queries: 'DETERMINISTIC_FIXTURE',
        externalWrites: 'PROHIBITED',
      },
      providerIntegrations: 'UNAVAILABLE',
      durablePersistence: 'UNAVAILABLE',
      studentPublication: 'DISABLED_UNTIL_008',
    }, principal, now, correlationId, {
      operations: SECTION_STATE.AVAILABLE,
      durable_jobs: SECTION_STATE.UNAVAILABLE,
      providers: SECTION_STATE.UNAVAILABLE,
      audit: state.audit.length ? SECTION_STATE.AVAILABLE : SECTION_STATE.EMPTY,
    });
  }
}

function envelope(kind, data, principal, now, correlationId, sections, freshness = FRESHNESS.CURRENT) {
  return buildMentorQueryEnvelope({
    kind,
    data,
    meta: {
      environment: principal.environment,
      asOf: now.toISOString(),
      freshness: Object.hasOwn(FRESHNESS, freshness) ? freshness : FRESHNESS.CURRENT,
      sections,
      correlationId,
    },
  });
}

function requireQueryPrincipal(state, principal, resource) {
  if (!principal || typeof principal !== 'object' || Array.isArray(principal)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_REQUIRED', 'An authenticated MMC principal is required.');
  }
  if (principal.tenantId !== state.meta.tenantId || principal.environment !== state.meta.environment) {
    throw new MmcHttpError(403, 'MMC_PRINCIPAL_SCOPE_MISMATCH', 'The authenticated MMC principal scope is invalid.');
  }
  if (!['LOCAL', 'FIXTURE'].includes(principal.environment)) {
    throw new MmcHttpError(503, 'MENTOR_DURABLE_PERSISTENCE_REQUIRED', 'Mentor fixture queries cannot serve this environment.');
  }
  if (resource === 'operations') {
    if (!['admin', 'operator'].includes(principal.role)) {
      throw new MmcHttpError(403, 'MENTOR_OPERATIONS_FORBIDDEN', 'Operations requires the MMC operations role.');
    }
    assertCapability(principal, MMC_CAPABILITIES.OPERATIONS);
  } else {
    if (!['mentor', 'admin'].includes(principal.role)) {
      throw new MmcHttpError(403, 'MENTOR_ROLE_REQUIRED', 'The mentor workspace requires a mentor role.');
    }
    assertCapability(principal, MMC_CAPABILITIES.QUERY);
  }
  return principal;
}

function authorizedScope(state, principal, now) {
  const assignments = [...state.assignments.values()].filter((assignment) => (
    assignment.tenantId === principal.tenantId
      && assignment.environment === principal.environment
      && isMmcAssignmentEffective(assignment, now)
      && (principal.role === 'admin' || assignment.mentorPrincipalId === principal.id)
  ));
  return {
    subjects: new Set(assignments.map((assignment) => assignment.subjectLinkId)),
    assignmentBySubject: new Map(assignments.map((assignment) => [assignment.subjectLinkId, assignment])),
  };
}

function requireAuthorizedStudent(state, principal, now, subjectLinkId) {
  const scope = authorizedScope(state, principal, now);
  const student = state.students.get(String(subjectLinkId || ''));
  const assignment = scope.assignmentBySubject.get(String(subjectLinkId || ''));
  if (!student || !assignment) resourceNotFound();
  return { student, assignment };
}

function requireSession(state, principal, now, sessionId) {
  const session = state.sessions.get(String(sessionId || ''));
  if (!session) resourceNotFound();
  const { assignment } = requireAuthorizedStudent(state, principal, now, session.subjectLinkId);
  if (session.assignmentId !== assignment.id) resourceNotFound();
  return session;
}

function resourceNotFound() {
  throw new MmcHttpError(404, 'MENTOR_RESOURCE_NOT_FOUND', 'The requested mentor resource was not found.');
}

function resolvePage(options, principal, scope) {
  const limit = options.limit === undefined ? 50 : Number(options.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new MmcHttpError(422, 'MENTOR_PAGE_LIMIT_INVALID', 'The page limit must be from one to one hundred.');
  }
  let offset = 0;
  if (options.cursor) offset = decodeCursor(options.cursor, principal, scope);
  return { limit, offset };
}

function paginate(rows, page, principal, scope) {
  const items = rows.slice(page.offset, page.offset + page.limit);
  const nextOffset = page.offset + items.length;
  return {
    items,
    nextCursor: nextOffset < rows.length ? encodeCursor(nextOffset, principal, scope) : null,
  };
}

function encodeCursor(offset, principal, scope) {
  const body = Buffer.from(JSON.stringify({
    offset,
    principalId: principal.id,
    tenantId: principal.tenantId,
    environment: principal.environment,
    scope,
  }), 'utf8').toString('base64url');
  const digest = crypto.createHmac('sha256', CURSOR_KEY).update(body).digest('hex');
  return `c_${body}.${digest}`;
}

function decodeCursor(cursor, principal, scope) {
  const match = /^c_([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/u.exec(String(cursor || ''));
  if (!match) throw new MmcHttpError(400, 'MENTOR_CURSOR_INVALID', 'The mentor query cursor is invalid.');
  const digest = crypto.createHmac('sha256', CURSOR_KEY).update(match[1]).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(match[2]))) {
    throw new MmcHttpError(400, 'MENTOR_CURSOR_INVALID', 'The mentor query cursor is invalid.');
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'));
  } catch {
    throw new MmcHttpError(400, 'MENTOR_CURSOR_INVALID', 'The mentor query cursor is invalid.');
  }
  if (!decoded || decoded.principalId !== principal.id || decoded.tenantId !== principal.tenantId
      || decoded.environment !== principal.environment || decoded.scope !== scope
      || !Number.isSafeInteger(decoded.offset) || decoded.offset < 0) {
    throw new MmcHttpError(400, 'MENTOR_CURSOR_SCOPE_MISMATCH', 'The mentor query cursor is invalid.');
  }
  return decoded.offset;
}

function subjectValues(map, subjectLinkId) {
  return [...map.values()].filter((item) => item.subjectLinkId === subjectLinkId);
}

function attentionDto(item, state, now) {
  const student = state.students.get(item.subjectLinkId);
  return {
    id: item.id,
    version: item.version,
    subjectLinkId: item.subjectLinkId,
    studentName: student?.displayName || 'Assigned student',
    category: item.category,
    reason: item.reason,
    dueAt: item.dueAt,
    firstObservedAt: item.firstObservedAt,
    sourceVersion: item.sourceVersion,
    nextAction: item.nextAction,
    evidence: structuredClone(item.evidence),
    ageDays: Math.max(0, Math.floor((now.valueOf() - Date.parse(item.firstObservedAt)) / 86_400_000)),
    disposition: 'OPEN',
  };
}

function studentSummaryDto(student, assignment) {
  return {
    subjectLinkId: student.id,
    displayName: student.displayName,
    program: student.program,
    cohort: student.cohort,
    assignmentId: assignment.id,
    assignmentState: assignment.state,
    freshness: student.freshness,
    nextAction: student.nextAction,
  };
}

function assignmentDto(assignment) {
  return {
    id: assignment.id,
    state: assignment.state,
    version: assignment.version,
    startedAt: assignment.startedAt,
    expiresAt: assignment.expiresAt,
  };
}

function sessionDto(session) {
  return {
    id: session.id,
    version: session.version,
    status: session.status,
    objective: session.objective,
    startedAt: session.startedAt,
    scheduledAt: session.scheduledAt || null,
    endedAt: session.endedAt || null,
    updatedAt: session.updatedAt,
    subjectLinkId: session.subjectLinkId,
    assignmentId: session.assignmentId,
    persistence: session.persistence || 'SAVED',
    connectivity: session.connectivity || 'ONLINE',
    summary: session.summary || null,
  };
}

function workDto(item) {
  return {
    id: item.id,
    kind: item.kind,
    version: item.version,
    subjectLinkId: item.subjectLinkId,
    assignmentId: item.assignmentId,
    title: item.title,
    details: item.details || null,
    ownerType: item.ownerType,
    dueAt: item.dueAt || null,
    status: item.status,
    sensitivity: item.sensitivity,
    updatedAt: item.updatedAt,
  };
}

function reviewDto(item) {
  return {
    id: item.id,
    kind: item.kind,
    version: item.version,
    subjectLinkId: item.subjectLinkId,
    assignmentId: item.assignmentId,
    queueKind: item.queueKind,
    label: item.label,
    state: item.state,
    sourceVersion: item.sourceVersion,
    firstObservedAt: item.firstObservedAt,
    ownerType: item.ownerType || 'MENTOR',
    dueAt: item.dueAt || null,
    origin: item.origin,
    freshness: item.freshness,
    reviewState: item.reviewState,
    decision: item.decision || null,
    rationale: item.rationale || null,
    editedText: item.editedText || null,
    policyVersionId: item.policyVersionId || null,
  };
}

function captureDto(capture) {
  return {
    id: capture.id,
    kind: capture.kind,
    version: capture.version,
    subjectLinkId: capture.subjectLinkId,
    assignmentId: capture.assignmentId,
    sessionId: capture.sessionId,
    captureKind: capture.captureKind,
    text: capture.text,
    occurredAt: capture.occurredAt,
    reviewState: capture.reviewState,
    visibility: capture.visibility,
    publicationState: capture.publicationState,
    updatedAt: capture.updatedAt,
  };
}

function planDto(plan) {
  return {
    id: plan.id,
    kind: plan.kind,
    version: plan.version,
    subjectLinkId: plan.subjectLinkId,
    assignmentId: plan.assignmentId,
    title: plan.title,
    objective: plan.objective,
    status: plan.status,
    targetDate: plan.targetDate || null,
    updatedAt: plan.updatedAt,
  };
}

function milestoneDto(milestone) {
  return {
    id: milestone.id,
    kind: milestone.kind,
    version: milestone.version,
    subjectLinkId: milestone.subjectLinkId,
    assignmentId: milestone.assignmentId,
    title: milestone.title,
    status: milestone.status,
    targetDate: milestone.targetDate,
    evidenceState: milestone.evidenceState,
  };
}

function fileDto(file) {
  return {
    id: file.id,
    version: file.version,
    subjectLinkId: file.subjectLinkId,
    assignmentId: file.assignmentId,
    label: file.label,
    mediaType: file.mediaType,
    sourceAuthority: file.sourceAuthority,
    freshness: file.freshness,
    reviewState: file.reviewState,
    observedAt: file.observedAt,
    assetHandle: file.assetHandle,
  };
}

function buildChanges(state, subjectLinkId) {
  return [...subjectValues(state.tasks, subjectLinkId), ...subjectValues(state.commitments, subjectLinkId)]
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, 5)
    .map((item) => ({
      id: `change_${item.id}_${item.version}`,
      objectId: item.id,
      objectKind: item.kind,
      label: item.title,
      changedAt: item.updatedAt,
      version: item.version,
      origin: 'HUMAN_JUDGMENT',
      freshness: 'CURRENT',
    }));
}

function maxVersion(values, fallback = 1) {
  return Math.max(fallback, ...values.map((value) => Number(value?.version) || 0));
}

function workOrder(left, right) {
  const leftTime = Date.parse(left.dueAt || '') || Number.MAX_SAFE_INTEGER;
  const rightTime = Date.parse(right.dueAt || '') || Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || left.id.localeCompare(right.id, 'en');
}

function reviewOrder(left, right) {
  return String(left.firstObservedAt).localeCompare(String(right.firstObservedAt)) || left.id.localeCompare(right.id, 'en');
}

function sessionOrder(left, right) {
  return String(right.startedAt).localeCompare(String(left.startedAt)) || left.id.localeCompare(right.id, 'en');
}

function isTerminalWork(status) {
  return ['COMPLETED', 'CANCELLED'].includes(status);
}

function requireCorrelationId(value) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(normalized)) {
    throw new MmcHttpError(500, 'CORRELATION_ID_INVALID', 'The server correlation identifier is invalid.');
  }
  return normalized;
}
