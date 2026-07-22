import assert from 'node:assert/strict';

import {
  MENTOR_QUERY_KIND,
  buildMentorQueryEnvelope,
  validateMentorQueryData,
} from '../../../lib/mmc/contracts/mentor-query-contract.mjs';
import { createDeterministicMentorSeed } from '../../../lib/mmc/queries/deterministic-mentor-seed.mjs';
import { MemoryMentorRepository } from '../../../lib/mmc/queries/mentor-memory-repository.mjs';
import { MentorQueryService } from '../../../lib/mmc/queries/mentor-query-service.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

const tenantId = '00700000-0000-4000-8000-000000000001';
const mentorId = '00700000-0000-4000-8000-000000000002';
const seed = createDeterministicMentorSeed({ tenantId, mentorPrincipalId: mentorId, environment: 'LOCAL' });
// Make one subject demonstrably outside this principal's assignment scope.
seed.assignments.set('assignment_007_008', {
  ...seed.assignments.get('assignment_007_008'),
  mentorPrincipalId: '00700000-0000-4000-8000-000000000099',
});
const repository = new MemoryMentorRepository({ seed });
const service = new MentorQueryService({ repository });
const principal = Object.freeze({
  id: mentorId,
  tenantId,
  environment: 'LOCAL',
  role: 'mentor',
  capabilities: Object.freeze([MMC_CAPABILITIES.QUERY, MMC_CAPABILITIES.COMMAND, MMC_CAPABILITIES.REVIEW]),
});
const correlationId = 'corr_007_query_contract';
const query = (resource, options = {}) => service.query(resource, { principal, correlationId, ...options });

const today = query('today');
assert.equal(today.data.kind, MENTOR_QUERY_KIND.TODAY);
assert.deepEqual(today.data.attention.slice(0, 3).map((item) => item.category), [
  'PRIVACY_SAFETY_DECISION',
  'AUTHORITATIVE_DEADLINE',
  'OVERDUE_MENTOR_PROMISE',
]);
assert.equal(new Set(today.data.attention.slice(0, 3).map((item) => item.subjectLinkId)).size, 3);
assert.equal(today.data.attention.every((item) => Number.isSafeInteger(item.version) && item.version > 0), true,
  'Every attention DTO must expose its aggregate version for safe defer/dismiss commands.');
assert.equal(today.data.attention.length, 7, 'The first three plus four disclosure contract must remain bounded.');
assert.equal(today.data.disclosure.initialLimit, 3);
assert.equal(today.data.disclosure.additionalCount, 4);
assert.equal(today.data.operatingState.persistence, 'LOCAL_IN_MEMORY');
assert.equal(today.data.operatingState.providers, 'DISABLED');
assert.equal(today.data.operatingState.studentPublication, 'DISABLED_UNTIL_008');
assert.equal(Object.hasOwn(today.data, 'riskScore'), false);
assert.equal(Object.isFrozen(today), true);
assert.equal(Object.isFrozen(today.data.attention[0]), true);

const directory = query('students');
assert.equal(directory.data.kind, MENTOR_QUERY_KIND.STUDENTS);
assert.equal(directory.data.total, 7);
assert.equal(directory.data.students.length, 7);
assert.equal(directory.meta.environment, 'LOCAL');
assert.equal(directory.meta.asOf, '2026-07-22T13:00:00.000Z');

const overview = query('student_overview', { subjectLinkId: 'subject_007_001' });
assert.equal(overview.data.subjectLink.identityState, 'VERIFIED_LOCAL_LINK');
assert.equal(overview.data.assignment.state, 'ACTIVE');
assert.equal(overview.data.nextSafeMove.subjectLinkId, 'subject_007_001');
assert.equal(overview.meta.sections.private_context, 'EMPTY');

const plan = query('student_plan', { subjectLinkId: 'subject_007_001' });
assert.equal(plan.data.kind, MENTOR_QUERY_KIND.STUDENT_PLAN);
assert.equal(plan.data.goals[0].id, 'plan_007_001');
assert.equal(plan.data.openLoops.every((item) => item.subjectLinkId === 'subject_007_001'), true);

const history = query('student_history', { subjectLinkId: 'subject_007_001' });
assert.equal(history.data.sessions[0].id, 'session_007_history_001');
assert.equal(history.data.observations[0].captureKind, 'MUTUAL_COMMITMENT');

const detail = query('session_detail', {
  subjectLinkId: 'subject_007_001',
  sessionId: 'session_007_history_001',
});
assert.equal(detail.data.session.subjectLinkId, detail.data.subjectLinkId);
assert.equal(detail.data.evidence[0].origin, 'OBSERVED');

const files = query('student_files', { subjectLinkId: 'subject_007_001' });
assert.equal(files.data.files[0].assetHandle, 'asset_handle_007_001');
assert.equal(Object.hasOwn(files.data.files[0], 'absolutePath'), false);

const prep = query('call_prep', { subjectLinkId: 'subject_007_001' });
assert.equal(prep.data.kind, MENTOR_QUERY_KIND.CALL_PREP);
assert.equal(prep.data.pinnedObjectIds.includes('milestone_007_001'), true);

const work = query('work');
assert.equal(work.data.items.every((item) => ['TASK', 'COMMITMENT'].includes(item.kind)), true);
assert.equal(work.data.filters.includes('evidence_freshness'), true);

const reviews = query('reviews');
assert.equal(reviews.data.items.every((item) => item.ownerType === 'MENTOR'), true);
assert.equal(reviews.data.items.every((item) => Object.hasOwn(item, 'dueAt')), true);
assert.equal(reviews.meta.sections.student_publication, 'UNAVAILABLE');

assert.throws(
  () => query('student_overview', { subjectLinkId: 'subject_007_008' }),
  (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
  'An unassigned subject must be indistinguishable from a missing subject.',
);
assert.throws(
  () => query('session_detail', {
    subjectLinkId: 'subject_007_002',
    sessionId: 'session_007_history_001',
  }),
  (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
  'A session cannot be opened through another student route.',
);

const stale = query('student_overview', { subjectLinkId: 'subject_007_006' });
assert.equal(stale.meta.freshness, 'STALE');
assert.equal(stale.meta.sections.data_sufficiency, 'AVAILABLE');

await repository.setFixtureAssignmentState('assignment_007_001', 'REVOKED');
assert.throws(
  () => query('student_plan', { subjectLinkId: 'subject_007_001' }),
  (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
  'Assignment revocation must immediately remove query authority.',
);

await repository.transaction((draft) => {
  const assignment = draft.assignments.get('assignment_007_002');
  draft.assignments.set(assignment.id, {
    ...assignment,
    state: 'ACTIVE',
    expiresAt: '2026-07-22T12:59:59.999Z',
    version: assignment.version + 1,
  });
});
assert.throws(
  () => query('student_overview', { subjectLinkId: 'subject_007_002' }),
  (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
  'Assignment expiry must immediately remove query authority even while state remains ACTIVE.',
);

assert.throws(
  () => validateMentorQueryData(MENTOR_QUERY_KIND.STUDENTS, {
    ...directory.data,
    leakedTenantId: tenantId,
  }),
  /MENTOR_UNKNOWN_FIELD/u,
  'Exact query DTOs must reject unknown top-level fields.',
);
assert.throws(
  () => buildMentorQueryEnvelope({
    kind: MENTOR_QUERY_KIND.TODAY,
    data: { ...today.data, kind: MENTOR_QUERY_KIND.WORK },
    meta: today.meta,
  }),
  /MENTOR_QUERY_KIND_MISMATCH/u,
);

console.log(JSON.stringify({
  result: 'MMC 007 mentor query contract validation passed',
  exactEnvelope: true,
  attentionOrdering: true,
  threePlusFourBound: true,
  assignmentIsolation: true,
  stateHonesty: true,
  publicationDisabled: true,
}, null, 2));
