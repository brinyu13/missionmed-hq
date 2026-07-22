import assert from 'node:assert/strict';

import {
  MENTOR_COMMAND_OWNER_BY_KIND,
  MentorCommandService,
} from '../../../lib/mmc/commands/mentor-owner-handlers.mjs';
import {
  MMC_MENTOR_COMMAND_KINDS,
  validateMentorCommandEnvelope,
} from '../../../lib/mmc/contracts/mentor-query-contract.mjs';
import { createDeterministicMentorSeed } from '../../../lib/mmc/queries/deterministic-mentor-seed.mjs';
import { MemoryMentorRepository } from '../../../lib/mmc/queries/mentor-memory-repository.mjs';
import { MentorQueryService } from '../../../lib/mmc/queries/mentor-query-service.mjs';
import { MMC_CAPABILITIES } from '../../../lib/mmc/trust/security.mjs';

const tenantId = '00700000-0000-4000-8000-000000000001';
const mentorId = '00700000-0000-4000-8000-000000000002';
const repository = new MemoryMentorRepository({
  seed: createDeterministicMentorSeed({ tenantId, mentorPrincipalId: mentorId, environment: 'LOCAL' }),
});
let generated = 0;
const service = new MentorCommandService({
  repository,
  idFactory: () => `00700000-0000-4000-8000-${String(generated += 1).padStart(12, '0')}`,
});
const queries = new MentorQueryService({ repository });
const principal = Object.freeze({
  id: mentorId,
  tenantId,
  environment: 'LOCAL',
  role: 'mentor',
  capabilities: Object.freeze([MMC_CAPABILITIES.QUERY, MMC_CAPABILITIES.COMMAND, MMC_CAPABILITIES.REVIEW]),
});
const correlationId = 'corr_007_command_owner';
let commandNumber = 100;
const command = (kind, targetId, expectedVersion, payload, purpose = `Exercise ${kind} local owner.`) => ({
  commandId: `00700000-0000-4000-8000-${String(commandNumber += 1).padStart(12, '0')}`,
  idempotencyKey: `idem_007_${kind.replace(/[^a-z]/gu, '_')}_${String(commandNumber).padStart(4, '0')}`,
  expectedVersion,
  targetId,
  kind,
  purpose,
  payload,
  schemaVersion: 1,
});
const execute = (input) => service.execute(input, { principal, correlationId });

assert.deepEqual(Object.keys(MENTOR_COMMAND_OWNER_BY_KIND).sort(), [...MMC_MENTOR_COMMAND_KINDS].sort());
assert.equal(Object.values(MENTOR_COMMAND_OWNER_BY_KIND).every((owner) => typeof owner === 'string' && owner.length > 3), true);

const start = command('session.start', 'session_007_local_001', 0, {
  subjectLinkId: 'subject_007_001',
  objective: 'Review the next evidence-backed milestone.',
});
const concurrentStarts = await Promise.all(Array.from({ length: 100 }, () => execute(start)));
assert.equal(concurrentStarts.filter((result) => result.replayed === false).length, 1);
assert.equal(concurrentStarts.filter((result) => result.replayed === true).length, 99);
assert.equal(new Set(concurrentStarts.map((result) => result.auditId)).size, 1);
assert.equal(concurrentStarts[0].readback.state.status, 'ACTIVE');

await assert.rejects(
  execute(command('session.start', 'session_007_local_002', 0, {
    subjectLinkId: 'subject_007_002',
    objective: 'This second active session must fail.',
  })),
  (error) => error?.statusCode === 409 && error?.code === 'ACTIVE_SESSION_CONFLICT',
);

const capture = command('capture.save', 'capture_007_local_001', 0, {
  subjectLinkId: 'subject_007_001',
  sessionId: start.targetId,
  captureKind: 'MUTUAL_COMMITMENT',
  text: 'Student and mentor will review the evidence outline by Friday.',
});
assert.doesNotThrow(
  () => validateMentorCommandEnvelope(command('capture.save', `c${'a'.repeat(184)}`, 0, {
    subjectLinkId: 'subject_007_001',
    sessionId: start.targetId,
    captureKind: 'QUESTION',
    text: 'This identifier reaches the supported derived review boundary.',
  })),
  'A 185-character capture identifier must remain within the derived 200-character boundary.',
);
assert.throws(
  () => validateMentorCommandEnvelope(command('capture.save', `c${'a'.repeat(185)}`, 0, {
    subjectLinkId: 'subject_007_001',
    sessionId: start.targetId,
    captureKind: 'QUESTION',
    text: 'This identifier would overflow its derived review identifier.',
  })),
  (error) => error?.statusCode === 422 && error?.code === 'MENTOR_COMMAND_IDENTIFIER_INVALID',
  'Capture identifiers must leave room for the derived review identifier.',
);
await assert.rejects(
  execute(command('capture.save', 'capture_007_cross_subject', 0, {
    subjectLinkId: 'subject_007_002',
    sessionId: start.targetId,
    captureKind: 'QUESTION',
    text: 'This cross-subject capture must remain indistinguishable from a missing resource.',
  })),
  (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
  'A capture cannot change the subject bound to its session.',
);
assert.equal(repository.snapshot().captures.has('capture_007_cross_subject'), false);
const captureResult = await execute(capture);
assert.deepEqual(captureResult.objectResults.map((entry) => entry.kind), ['CAPTURE', 'PROPOSAL']);
assert.equal(captureResult.readback.state.reviewState, 'REVIEW_REQUIRED');
assert.equal(captureResult.readback.state.publicationState, 'NOT_ELIGIBLE');

let snapshot = repository.snapshot();
const captureReview = snapshot.reviews.get('review_capture_capture_007_local_001');
assert.equal(captureReview.policyVersionId, 'policy_007_local_review_v1');
assert.equal(captureReview.sessionId, start.targetId);

const pauseResult = await execute(command('session.pause', start.targetId, 1, { reason: 'Short interruption.' }));
assert.equal(pauseResult.readback.state.status, 'PAUSED');
await assert.rejects(
  execute(command('capture.save', 'capture_007_local_002', 0, {
    subjectLinkId: 'subject_007_001',
    sessionId: start.targetId,
    captureKind: 'QUESTION',
    text: 'This capture cannot save while paused.',
  })),
  (error) => error?.statusCode === 409 && error?.code === 'SESSION_CAPTURE_NOT_ACTIVE',
);
const resumeResult = await execute(command('session.resume', start.targetId, 2, {}));
assert.equal(resumeResult.readback.state.status, 'ACTIVE');
const endResult = await execute(command('session.end_for_review', start.targetId, 3, {
  summary: 'A bounded local session is ready for item review.',
}));
assert.equal(endResult.readback.state.status, 'REVIEW_REQUIRED');

const sessionReview = queries.query('session_review', {
  principal,
  correlationId,
  sessionId: start.targetId,
});
assert.equal(sessionReview.data.items.length, 1);
assert.equal(sessionReview.data.items[0].id, captureReview.id);
assert.equal(sessionReview.data.items[0].policyVersionId, 'policy_007_local_review_v1');
assert.equal(sessionReview.data.publicationPlane, 'DISABLED_UNTIL_008');

await assert.rejects(
  execute(command('review.decide', captureReview.id, 1, {
    decision: 'ACCEPT',
    rationale: 'A stale policy cannot authorize this decision.',
    policyVersionId: 'policy_007_stale',
  })),
  (error) => error?.statusCode === 409 && error?.code === 'REVIEW_POLICY_VERSION_CONFLICT',
);
const reviewResult = await execute(command('review.decide', captureReview.id, 1, {
  decision: 'ACCEPT',
  editedText: 'Student and mentor will review the evidence outline by Friday.',
  rationale: 'The mentor verified the typed capture.',
  policyVersionId: captureReview.policyVersionId,
}));
assert.equal(reviewResult.readback.state.state, 'APPROVED');

const deferredAttention = command('attention.defer', 'attention_007_deadline_001', 1, {
  sourceVersion: 1,
  reason: 'The exact evidence review is scheduled.',
  expiresAt: '2026-07-23T13:00:00.000Z',
});
const attentionResult = await execute(deferredAttention);
assert.equal(attentionResult.readback.state.disposition, 'DEFERRED');
let today = queries.query('today', { principal, correlationId });
assert.equal(today.data.attention.some((item) => item.id === deferredAttention.targetId), false);
await repository.transaction((draft) => {
  const item = draft.attentions.get(deferredAttention.targetId);
  draft.attentions.set(item.id, { ...item, version: item.version + 1, sourceVersion: item.sourceVersion + 1 });
});
today = queries.query('today', { principal, correlationId });
assert.equal(today.data.attention.some((item) => item.id === deferredAttention.targetId), true,
  'A materially new source version must make a deferred item visible again.');

const planUpdate = command('plan.update', 'plan_007_001', 1, {
  subjectLinkId: 'subject_007_001',
  title: 'Application narrative plan',
  objective: 'Complete a reviewed evidence-based narrative.',
  status: 'ACTIVE',
  targetDate: '2026-08-16',
});
const planResult = await execute(planUpdate);
assert.equal(planResult.readback.state.targetDate, '2026-08-16');

const commitmentResult = await execute(command('commitment.upsert', 'commitment_007_student_001', 1, {
  subjectLinkId: 'subject_007_001',
  title: 'Draft three evidence paragraphs',
  ownerType: 'STUDENT',
  status: 'IN_PROGRESS',
  sensitivity: 'NORMAL',
  dueAt: '2026-07-25T17:00:00.000Z',
}));
assert.equal(commitmentResult.readback.state.status, 'IN_PROGRESS');

const taskUpdate = command('task.upsert', 'task_007_mentor_001', 1, {
  subjectLinkId: 'subject_007_002',
  title: 'Return the revised experience outline',
  ownerType: 'MENTOR',
  status: 'COMPLETED',
  sensitivity: 'NORMAL',
  dueAt: '2026-07-22T17:00:00.000Z',
});
const taskResult = await execute(taskUpdate);
assert.equal(taskResult.readback.state.status, 'COMPLETED');
assert.equal(taskResult.readback.subjectLinkId, 'subject_007_002');

await assert.rejects(
  execute(command('task.upsert', taskUpdate.targetId, 2, {
    ...taskUpdate.payload,
    subjectLinkId: 'subject_007_003',
  })),
  (error) => error?.statusCode === 409 && error?.code === 'TASK_SUBJECT_CONTINUITY_CONFLICT',
);

await assert.rejects(
  execute(command('plan.update', 'plan_007_001', 0, {
    subjectLinkId: 'subject_007_001', title: 'Stale update', objective: 'This version must conflict.', status: 'ACTIVE',
  })),
  (error) => error?.statusCode === 409 && error?.code === 'VERSION_CONFLICT'
    && error?.details?.currentVersion === 2,
);

assert.throws(
  () => validateMentorCommandEnvelope({
    ...command('session.start', 'session_007_illegal', 0, {
      subjectLinkId: 'subject_007_001', objective: 'Attempt client-authored authority.',
    }),
    payload: {
      subjectLinkId: 'subject_007_001',
      objective: 'Attempt client-authored authority.',
      assignmentId: 'assignment_007_001',
    },
  }),
  (error) => error?.statusCode === 422,
);

await repository.transaction((draft) => {
  const assignment = draft.assignments.get('assignment_007_005');
  draft.assignments.set(assignment.id, {
    ...assignment,
    mentorPrincipalId: '00700000-0000-4000-8000-000000000099',
    version: assignment.version + 1,
  });
});
const beforeOpaqueDenials = repository.snapshot();
const crossPrincipalReview = command('review.decide', 'review_007_ai_001', 1, {
  decision: 'REJECT',
  rationale: 'This cross-principal decision must be denied opaquely.',
  policyVersionId: 'policy_007_local_review_v1',
});
const missingReview = command('review.decide', 'review_007_missing_001', 0, {
  decision: 'REJECT',
  rationale: 'This missing decision must use the same opaque denial.',
  policyVersionId: 'policy_007_local_review_v1',
});
for (const denied of [crossPrincipalReview, missingReview]) {
  await assert.rejects(
    execute(denied),
    (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
    'Cross-principal and missing command targets must be indistinguishable.',
  );
}
const afterOpaqueDenials = repository.snapshot();
assert.equal(afterOpaqueDenials.audit.length, beforeOpaqueDenials.audit.length);
assert.equal(afterOpaqueDenials.outbox.length, beforeOpaqueDenials.outbox.length);
assert.equal(afterOpaqueDenials.receipts.size, beforeOpaqueDenials.receipts.size);
assert.equal(afterOpaqueDenials.commandIds.size, beforeOpaqueDenials.commandIds.size);

await repository.transaction((draft) => {
  const assignment = draft.assignments.get('assignment_007_001');
  draft.assignments.set(assignment.id, {
    ...assignment,
    state: 'REASSIGNED',
    version: assignment.version + 1,
  });
  draft.assignments.set('assignment_007_001b', {
    ...assignment,
    id: 'assignment_007_001b',
    state: 'ACTIVE',
    version: 1,
    startedAt: '2026-07-22T12:00:00.000Z',
    expiresAt: null,
  });
});
await assert.rejects(
  execute(planUpdate),
  (error) => error?.statusCode === 403 && error?.code === 'MENTOR_ASSIGNMENT_REVOKED',
  'A replacement assignment must not authorize replay of readback bound to the prior assignment lineage.',
);

await repository.transaction((draft) => {
  const assignment = draft.assignments.get('assignment_007_001');
  draft.assignments.set(assignment.id, {
    ...assignment,
    mentorPrincipalId: '00700000-0000-4000-8000-000000000099',
    version: assignment.version + 1,
  });
});
const beforeForeignTargetDenials = repository.snapshot();
const foreignPlanTarget = command('plan.update', 'plan_007_001', 2, {
  subjectLinkId: 'subject_007_002',
  title: 'Foreign target probe',
  objective: 'This target must remain opaque.',
  status: 'ACTIVE',
});
const missingPlanTarget = command('plan.update', 'plan_007_missing_001', 2, {
  ...foreignPlanTarget.payload,
});
const foreignSessionTarget = command('session.start', 'session_007_history_001', 3, {
  subjectLinkId: 'subject_007_002',
  objective: 'This existing foreign session must remain opaque.',
});
const missingSessionTarget = command('session.start', 'session_007_missing_001', 3, {
  subjectLinkId: 'subject_007_002',
  objective: 'This missing session must use the same opaque denial.',
});
for (const denied of [foreignPlanTarget, missingPlanTarget, foreignSessionTarget, missingSessionTarget]) {
  await assert.rejects(
    execute(denied),
    (error) => error?.statusCode === 404 && error?.code === 'MENTOR_RESOURCE_NOT_FOUND',
    'Foreign and missing payload-addressed targets must be indistinguishable.',
  );
}
const afterForeignTargetDenials = repository.snapshot();
assert.equal(afterForeignTargetDenials.audit.length, beforeForeignTargetDenials.audit.length);
assert.equal(afterForeignTargetDenials.outbox.length, beforeForeignTargetDenials.outbox.length);
assert.equal(afterForeignTargetDenials.receipts.size, beforeForeignTargetDenials.receipts.size);
assert.equal(afterForeignTargetDenials.commandIds.size, beforeForeignTargetDenials.commandIds.size);

snapshot = repository.snapshot();
assert.equal(snapshot.audit.length, 10);
assert.equal(snapshot.outbox.length, 10);
assert.equal(snapshot.receipts.size, 10);
assert.equal(snapshot.audit.every((entry, index) => entry.sequence === index + 1), true);
assert.equal(snapshot.outbox.every((entry) => entry.deliveryState === 'LOCAL_ONLY_NO_DISPATCH'), true);

await repository.transaction((draft) => {
  const assignment = draft.assignments.get('assignment_007_002');
  draft.assignments.set(assignment.id, {
    ...assignment,
    state: 'ACTIVE',
    expiresAt: '2026-07-22T12:59:59.999Z',
    version: assignment.version + 1,
  });
});
await assert.rejects(
  execute(taskUpdate),
  (error) => error?.statusCode === 403 && error?.code === 'MENTOR_ASSIGNMENT_REVOKED',
  'A replay must recheck assignment expiry before returning protected readback.',
);
await assert.rejects(
  execute(command('plan.update', 'plan_007_expired_002', 0, {
    subjectLinkId: 'subject_007_002', title: 'Expired assignment write', objective: 'This write must fail.', status: 'ACTIVE',
  })),
  (error) => error?.statusCode === 403 && error?.code === 'MENTOR_ASSIGNMENT_REVOKED',
  'An expired ACTIVE assignment must not authorize a new write.',
);

console.log(JSON.stringify({
  result: 'MMC 007 mentor command owner validation passed',
  commandKinds: MMC_MENTOR_COMMAND_KINDS.length,
  concurrentReplays: 99,
  subjectContinuity: true,
  assignmentExpiry: true,
  actionableCaptureReview: true,
  publicationDisabled: true,
  providerDispatches: 0,
}, null, 2));
