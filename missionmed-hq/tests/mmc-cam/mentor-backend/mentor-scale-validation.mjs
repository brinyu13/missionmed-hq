import assert from 'node:assert/strict';

import { createScaleMentorSeed } from '../../../lib/mmc/queries/deterministic-mentor-seed.mjs';
import { MemoryMentorRepository } from '../../../lib/mmc/queries/mentor-memory-repository.mjs';
import { MentorQueryService } from '../../../lib/mmc/queries/mentor-query-service.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

const tenantId = '00700000-0000-4000-8000-000000000001';
const mentorId = '00700000-0000-4000-8000-000000000002';
const seed = createScaleMentorSeed({
  tenantId,
  environment: 'LOCAL',
  mentorPrincipalId: mentorId,
  studentCount: 1000,
  taskCount: 10_000,
  reviewCount: 500,
  sessionCount: 100,
});
const repository = new MemoryMentorRepository({ seed });
const service = new MentorQueryService({ repository });
const principal = Object.freeze({
  id: mentorId,
  tenantId,
  environment: 'LOCAL',
  role: 'mentor',
  capabilities: Object.freeze([MMC_CAPABILITIES.QUERY]),
});
const correlationId = 'corr_007_scale_contract';
const query = (resource, options = {}) => service.query(resource, { principal, correlationId, ...options });
const startedAt = performance.now();

const studentsPage1 = query('students', { limit: 100 });
assert.equal(studentsPage1.data.total, 1000);
assert.equal(studentsPage1.data.students.length, 100);
assert.match(studentsPage1.data.nextCursor, /^c_[A-Za-z0-9_-]+\.[a-f0-9]{64}$/u);
const studentsPage2 = query('students', { limit: 100, cursor: studentsPage1.data.nextCursor });
assert.equal(studentsPage2.data.students.length, 100);
assert.equal(
  studentsPage1.data.students.some((left) => studentsPage2.data.students.some((right) => right.subjectLinkId === left.subjectLinkId)),
  false,
);

const workPage1 = query('work', { limit: 100 });
assert.equal(workPage1.data.total, 10_000);
assert.equal(workPage1.data.items.length, 100);
assert.ok(workPage1.data.nextCursor);
const mentorWork = query('work', { limit: 100, filters: { ownerType: 'MENTOR' } });
assert.equal(mentorWork.data.items.every((item) => item.ownerType === 'MENTOR'), true);
assert.equal(mentorWork.data.total, Math.floor(10_000 / 3));

const reviewsPage = query('reviews', { limit: 100 });
assert.equal(reviewsPage.data.total, 500);
assert.equal(reviewsPage.data.items.length, 100);
assert.equal(reviewsPage.data.items.every((item) => item.policyVersionId === 'policy_007_local_review_v1'), true);

const historyPage = query('student_history', {
  subjectLinkId: 'subject_scale_000001',
  limit: 25,
});
assert.equal(historyPage.data.sessions.length, 25);
assert.ok(historyPage.data.nextCursor, 'One hundred historical sessions must paginate.');

assert.throws(
  () => query('students', { limit: 101 }),
  (error) => error?.statusCode === 422 && error?.code === 'MENTOR_PAGE_LIMIT_INVALID',
);
const tamperedCursor = `${studentsPage1.data.nextCursor.slice(0, -1)}${studentsPage1.data.nextCursor.endsWith('a') ? 'b' : 'a'}`;
assert.throws(
  () => query('students', { limit: 100, cursor: tamperedCursor }),
  (error) => error?.statusCode === 400 && error?.code === 'MENTOR_CURSOR_INVALID',
);

const otherPrincipal = Object.freeze({
  ...principal,
  id: '00700000-0000-4000-8000-000000000099',
});
assert.throws(
  () => service.query('students', {
    principal: otherPrincipal,
    correlationId: 'corr_007_scale_other',
    limit: 100,
    cursor: studentsPage1.data.nextCursor,
  }),
  (error) => error?.statusCode === 400 && error?.code === 'MENTOR_CURSOR_SCOPE_MISMATCH',
  'A cursor must be bound to the exact authenticated principal and resource.',
);

const elapsedMilliseconds = Math.round(performance.now() - startedAt);
console.log(JSON.stringify({
  result: 'MMC 007 mentor scale validation passed',
  students: 1000,
  workItems: 10_000,
  reviews: 500,
  sessionsForSelectedStudent: 100,
  pageBound: 100,
  opaqueScopedCursor: true,
  elapsedMilliseconds,
}, null, 2));
