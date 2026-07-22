export const MMC_MENTOR_FIXTURE_TENANT_ID = '00700000-0000-4000-8000-000000000001';
export const MMC_MENTOR_FIXTURE_PRINCIPAL_ID = '00700000-0000-4000-8000-000000000002';
export const MMC_MENTOR_FIXTURE_NOW = '2026-07-22T13:00:00.000Z';

const NAMES = Object.freeze([
  'Amina Rahman',
  'Mateo Alvarez',
  'Linh Nguyen',
  'Nadia Okafor',
  'Samir Haddad',
  'Elena Petrova',
  'Priya Shah',
  'Omar Diallo',
]);

export function createDeterministicMentorSeed(options = {}) {
  const tenantId = options.tenantId || MMC_MENTOR_FIXTURE_TENANT_ID;
  const environment = options.environment || 'LOCAL';
  const mentorPrincipalId = options.mentorPrincipalId || MMC_MENTOR_FIXTURE_PRINCIPAL_ID;
  const students = new Map();
  const assignments = new Map();

  NAMES.forEach((displayName, index) => {
    const number = index + 1;
    const subjectLinkId = id('subject', number);
    const assignmentId = id('assignment', number);
    students.set(subjectLinkId, {
      id: subjectLinkId,
      tenantId,
      environment,
      displayName,
      program: number % 2 ? 'Residency Match Mentorship' : 'Clinical Readiness',
      cohort: number <= 4 ? '2027 Match' : '2028 Match',
      identityState: 'VERIFIED_LOCAL_LINK',
      freshness: number === 6 ? 'STALE' : 'CURRENT',
      version: 1,
      nextAction: nextAction(number),
      handlingContext: number === 2
        ? [{ id: 'context_007_002', text: 'Prefers written follow-up after calls.', purpose: 'COMMUNICATION_PREFERENCE', ageDays: 8 }]
        : [],
      dataSufficiency: number === 6
        ? [{ id: 'gap_007_006', label: 'Latest milestone evidence is missing.', state: 'SOURCE_MISSING' }]
        : [{ id: `sufficiency_007_${pad(number)}`, label: 'Core planning evidence is current.', state: 'CURRENT' }],
    });
    assignments.set(assignmentId, {
      id: assignmentId,
      tenantId,
      environment,
      subjectLinkId,
      mentorPrincipalId,
      state: 'ACTIVE',
      version: 1,
      startedAt: '2026-07-01T12:00:00.000Z',
      expiresAt: null,
    });
  });

  const sessions = new Map([
    ['session_007_scheduled_001', {
      id: 'session_007_scheduled_001', tenantId, environment,
      subjectLinkId: id('subject', 3), assignmentId: id('assignment', 3),
      mentorPrincipalId, version: 1, status: 'SCHEDULED',
      objective: 'Confirm the next evidence-backed application milestone.',
      startedAt: '2026-07-22T15:00:00.000Z', updatedAt: '2026-07-20T14:00:00.000Z',
      scheduledAt: '2026-07-22T15:00:00.000Z', endedAt: null,
      persistence: 'SAVED', connectivity: 'ONLINE', summary: null,
    }],
    ['session_007_history_001', {
      id: 'session_007_history_001', tenantId, environment,
      subjectLinkId: id('subject', 1), assignmentId: id('assignment', 1),
      mentorPrincipalId, version: 3, status: 'CLOSED',
      objective: 'Review the personal statement evidence plan.',
      startedAt: '2026-07-12T14:00:00.000Z', updatedAt: '2026-07-12T14:42:00.000Z',
      scheduledAt: '2026-07-12T14:00:00.000Z', endedAt: '2026-07-12T14:42:00.000Z',
      persistence: 'SAVED', connectivity: 'ONLINE',
      summary: 'Agreed on an evidence outline and a mentor review checkpoint.',
    }],
  ]);

  const tasks = new Map([
    ['task_007_mentor_001', task({
      id: 'task_007_mentor_001', tenantId, environment, subjectNumber: 2,
      ownerType: 'MENTOR', title: 'Review the revised experience outline',
      dueAt: '2026-07-21T17:00:00.000Z', status: 'IN_PROGRESS',
    })],
    ['task_007_student_001', task({
      id: 'task_007_student_001', tenantId, environment, subjectNumber: 4,
      ownerType: 'STUDENT', title: 'Upload the agreed milestone evidence',
      dueAt: '2026-07-20T17:00:00.000Z', status: 'BLOCKED',
    })],
    ['task_007_shared_001', task({
      id: 'task_007_shared_001', tenantId, environment, subjectNumber: 1,
      ownerType: 'SHARED', title: 'Finalize the personal statement evidence plan',
      dueAt: '2026-07-25T17:00:00.000Z', status: 'ACCEPTED',
    })],
  ]);

  const commitments = new Map([
    ['commitment_007_mentor_001', commitment({
      id: 'commitment_007_mentor_001', tenantId, environment, subjectNumber: 2,
      ownerType: 'MENTOR', title: 'Return comments on the revised outline',
      dueAt: '2026-07-21T17:00:00.000Z', status: 'IN_PROGRESS',
    })],
    ['commitment_007_student_001', commitment({
      id: 'commitment_007_student_001', tenantId, environment, subjectNumber: 1,
      ownerType: 'STUDENT', title: 'Draft two evidence paragraphs',
      dueAt: '2026-07-24T17:00:00.000Z', status: 'ACCEPTED',
    })],
  ]);

  const plans = new Map([
    ['plan_007_001', {
      id: 'plan_007_001', kind: 'PLAN', tenantId, environment,
      subjectLinkId: id('subject', 1), assignmentId: id('assignment', 1),
      version: 1, title: 'Application narrative plan',
      objective: 'Build an evidence-grounded application narrative.',
      status: 'ACTIVE', targetDate: '2026-08-15',
      updatedAt: '2026-07-20T13:00:00.000Z',
    }],
  ]);

  const milestones = new Map([
    ['milestone_007_001', {
      id: 'milestone_007_001', kind: 'MILESTONE', tenantId, environment,
      subjectLinkId: id('subject', 1), assignmentId: id('assignment', 1),
      version: 1, title: 'Evidence outline approved', status: 'IN_PROGRESS',
      targetDate: '2026-07-28', evidenceState: 'CURRENT',
    }],
  ]);

  const captures = new Map([
    ['capture_007_history_001', {
      id: 'capture_007_history_001', kind: 'CAPTURE', tenantId, environment,
      subjectLinkId: id('subject', 1), assignmentId: id('assignment', 1),
      sessionId: 'session_007_history_001', version: 1, captureKind: 'MUTUAL_COMMITMENT',
      text: 'Review the evidence outline before the next call.',
      occurredAt: '2026-07-12T14:31:00.000Z', reviewState: 'APPROVED',
      visibility: 'MENTOR_PRIVATE', publicationState: 'NOT_ELIGIBLE',
      updatedAt: '2026-07-12T14:42:00.000Z',
    }],
  ]);

  const reviews = new Map([
    ['review_007_ai_001', review({
      id: 'review_007_ai_001', tenantId, environment, subjectNumber: 5,
      queueKind: 'AI_CLAIM', label: 'Evidence-linked summary proposal',
      sourceVersion: 2, firstObservedAt: '2026-07-19T12:00:00.000Z',
    })],
    ['review_007_identity_001', review({
      id: 'review_007_identity_001', tenantId, environment, subjectNumber: 7,
      queueKind: 'IDENTITY', label: 'Synthetic identity conflict requires review',
      sourceVersion: 1, firstObservedAt: '2026-07-22T10:00:00.000Z',
    })],
    ['review_007_media_001', review({
      id: 'review_007_media_001', tenantId, environment, subjectNumber: 6,
      queueKind: 'MEDIA_EXCEPTION', label: 'Transcript evidence is incomplete',
      sourceVersion: 1, firstObservedAt: '2026-07-18T10:00:00.000Z',
    })],
  ]);

  const attentions = new Map([
    ['attention_007_safety_001', attention({
      id: 'attention_007_safety_001', tenantId, environment, subjectNumber: 7,
      category: 'PRIVACY_SAFETY_DECISION', reason: 'An identity conflict blocks safe attachment.',
      dueAt: '2026-07-22T14:00:00.000Z', firstObservedAt: '2026-07-22T10:00:00.000Z',
      nextAction: 'Inspect the attested identity evidence.', sourceObjectId: 'review_007_identity_001',
    })],
    ['attention_007_deadline_001', attention({
      id: 'attention_007_deadline_001', tenantId, environment, subjectNumber: 1,
      category: 'AUTHORITATIVE_DEADLINE', reason: 'An approved milestone is due within six days.',
      dueAt: '2026-07-28T17:00:00.000Z', firstObservedAt: '2026-07-20T13:00:00.000Z',
      nextAction: 'Open the milestone evidence plan.', sourceObjectId: 'milestone_007_001',
    })],
    ['attention_007_mentor_001', attention({
      id: 'attention_007_mentor_001', tenantId, environment, subjectNumber: 2,
      category: 'OVERDUE_MENTOR_PROMISE', reason: 'A mentor-owned review checkpoint is overdue.',
      dueAt: '2026-07-21T17:00:00.000Z', firstObservedAt: '2026-07-21T17:00:00.000Z',
      nextAction: 'Review and return the outline comments.', sourceObjectId: 'commitment_007_mentor_001',
    })],
    ['attention_007_call_001', attention({
      id: 'attention_007_call_001', tenantId, environment, subjectNumber: 3,
      category: 'SCHEDULED_CALL_PREP', reason: 'A scheduled call starts in two hours.',
      dueAt: '2026-07-22T15:00:00.000Z', firstObservedAt: '2026-07-20T14:00:00.000Z',
      nextAction: 'Open Call Prep.', sourceObjectId: 'session_007_scheduled_001',
    })],
    ['attention_007_followthrough_001', attention({
      id: 'attention_007_followthrough_001', tenantId, environment, subjectNumber: 4,
      category: 'STUDENT_COMMITMENT_FOLLOW_THROUGH', reason: 'An accepted student task is blocked after its checkpoint.',
      dueAt: '2026-07-20T17:00:00.000Z', firstObservedAt: '2026-07-20T17:00:00.000Z',
      nextAction: 'Check the named blocker with the student.', sourceObjectId: 'task_007_student_001',
    })],
    ['attention_007_review_001', attention({
      id: 'attention_007_review_001', tenantId, environment, subjectNumber: 5,
      category: 'REVIEW_WAIT', reason: 'An evidence-linked proposal awaits mentor review.',
      dueAt: null, firstObservedAt: '2026-07-19T12:00:00.000Z',
      nextAction: 'Review the exact evidence spans.', sourceObjectId: 'review_007_ai_001',
    })],
    ['attention_007_data_001', attention({
      id: 'attention_007_data_001', tenantId, environment, subjectNumber: 6,
      category: 'DATA_SUFFICIENCY', reason: 'Latest milestone evidence is missing.',
      dueAt: null, firstObservedAt: '2026-07-18T10:00:00.000Z',
      nextAction: 'Request or locate the missing evidence.', sourceObjectId: 'gap_007_006',
    })],
    ['attention_007_duplicate_001', attention({
      id: 'attention_007_duplicate_001', tenantId, environment, subjectNumber: 1,
      category: 'DATA_SUFFICIENCY', reason: 'A lower-priority duplicate source note is stale.',
      dueAt: null, firstObservedAt: '2026-07-17T10:00:00.000Z',
      nextAction: 'Inspect source freshness.', sourceObjectId: 'milestone_007_001',
    })],
  ]);

  const files = new Map([
    ['file_007_001', {
      id: 'file_007_001', tenantId, environment, subjectLinkId: id('subject', 1),
      assignmentId: id('assignment', 1), version: 1, label: 'Synthetic evidence outline.pdf',
      mediaType: 'application/pdf', sourceAuthority: 'IMPORTED', freshness: 'CURRENT',
      reviewState: 'APPROVED', observedAt: '2026-07-20T12:00:00.000Z',
      assetHandle: 'asset_handle_007_001',
    }],
  ]);

  return {
    meta: { tenantId, environment, mentorPrincipalId, fixture: true, version: 1 },
    students,
    assignments,
    sessions,
    captures,
    tasks,
    commitments,
    plans,
    milestones,
    attentions,
    reviews,
    files,
    receipts: new Map(),
    commandIds: new Map(),
    audit: [],
    outbox: [],
  };
}

export function createScaleMentorSeed(options = {}) {
  const studentCount = boundedCount(options.studentCount, 1000, 1, 1000);
  const taskCount = boundedCount(options.taskCount, 10_000, 0, 10_000);
  const reviewCount = boundedCount(options.reviewCount, 500, 0, 500);
  const sessionCount = boundedCount(options.sessionCount, 100, 0, 1000);
  const seed = createDeterministicMentorSeed(options);
  const { tenantId, environment, mentorPrincipalId } = seed.meta;

  seed.students.clear();
  seed.assignments.clear();
  seed.sessions.clear();
  seed.captures.clear();
  seed.tasks.clear();
  seed.commitments.clear();
  seed.plans.clear();
  seed.milestones.clear();
  seed.attentions.clear();
  seed.reviews.clear();
  seed.files.clear();

  for (let index = 1; index <= studentCount; index += 1) {
    const suffix = String(index).padStart(6, '0');
    const subjectLinkId = `subject_scale_${suffix}`;
    const assignmentId = `assignment_scale_${suffix}`;
    seed.students.set(subjectLinkId, {
      id: subjectLinkId, tenantId, environment, displayName: `Synthetic Student ${suffix}`,
      program: 'Scale Fixture', cohort: 'Synthetic', identityState: 'VERIFIED_LOCAL_LINK',
      freshness: 'CURRENT', version: 1, nextAction: 'Review the bounded synthetic plan.',
      handlingContext: [], dataSufficiency: [],
    });
    seed.assignments.set(assignmentId, {
      id: assignmentId, tenantId, environment, subjectLinkId, mentorPrincipalId,
      state: 'ACTIVE', version: 1, startedAt: '2026-07-01T12:00:00.000Z', expiresAt: null,
    });
  }

  for (let index = 1; index <= taskCount; index += 1) {
    const suffix = String(index).padStart(6, '0');
    const subjectNumber = ((index - 1) % studentCount) + 1;
    seed.tasks.set(`task_scale_${suffix}`, {
      id: `task_scale_${suffix}`, kind: 'TASK', tenantId, environment,
      subjectLinkId: `subject_scale_${String(subjectNumber).padStart(6, '0')}`,
      assignmentId: `assignment_scale_${String(subjectNumber).padStart(6, '0')}`,
      version: 1, title: `Bounded synthetic action ${suffix}`, details: null,
      ownerType: index % 3 === 0 ? 'MENTOR' : 'STUDENT', status: 'ACCEPTED',
      sensitivity: 'NORMAL', dueAt: '2026-08-01T17:00:00.000Z',
      updatedAt: '2026-07-22T13:00:00.000Z',
    });
  }

  for (let index = 1; index <= reviewCount; index += 1) {
    const suffix = String(index).padStart(6, '0');
    const subjectNumber = ((index - 1) % studentCount) + 1;
    seed.reviews.set(`review_scale_${suffix}`, {
      id: `review_scale_${suffix}`, kind: 'PROPOSAL', tenantId, environment,
      subjectLinkId: `subject_scale_${String(subjectNumber).padStart(6, '0')}`,
      assignmentId: `assignment_scale_${String(subjectNumber).padStart(6, '0')}`,
      version: 1, queueKind: 'AI_CLAIM', label: `Synthetic proposal ${suffix}`,
      state: 'OPEN', sourceVersion: 1, firstObservedAt: '2026-07-20T12:00:00.000Z',
      ownerType: 'MENTOR', dueAt: null, policyVersionId: 'policy_007_local_review_v1',
      origin: 'AI_PROPOSAL', freshness: 'CURRENT', reviewState: 'REVIEW_REQUIRED',
    });
  }

  for (let index = 1; index <= sessionCount; index += 1) {
    const suffix = String(index).padStart(6, '0');
    seed.sessions.set(`session_scale_${suffix}`, {
      id: `session_scale_${suffix}`, tenantId, environment,
      subjectLinkId: 'subject_scale_000001', assignmentId: 'assignment_scale_000001',
      mentorPrincipalId, version: 1, status: 'CLOSED',
      objective: `Synthetic historical session ${suffix}`,
      startedAt: '2026-07-01T12:00:00.000Z', updatedAt: '2026-07-01T13:00:00.000Z',
      scheduledAt: '2026-07-01T12:00:00.000Z', endedAt: '2026-07-01T13:00:00.000Z',
      persistence: 'SAVED', connectivity: 'ONLINE', summary: 'Bounded scale fixture.',
    });
  }

  return seed;
}

function id(kind, number) {
  return `${kind}_007_${pad(number)}`;
}

function pad(number) {
  return String(number).padStart(3, '0');
}

function task({ id: objectId, tenantId, environment, subjectNumber, ownerType, title, dueAt, status }) {
  return {
    id: objectId, kind: 'TASK', tenantId, environment,
    subjectLinkId: id('subject', subjectNumber), assignmentId: id('assignment', subjectNumber),
    version: 1, title, details: null, ownerType, dueAt, status, sensitivity: 'NORMAL',
    updatedAt: '2026-07-22T12:00:00.000Z',
  };
}

function commitment({ id: objectId, tenantId, environment, subjectNumber, ownerType, title, dueAt, status }) {
  return {
    id: objectId, kind: 'COMMITMENT', tenantId, environment,
    subjectLinkId: id('subject', subjectNumber), assignmentId: id('assignment', subjectNumber),
    version: 1, title, details: null, ownerType, dueAt, status, sensitivity: 'NORMAL',
    updatedAt: '2026-07-22T12:00:00.000Z',
  };
}

function review({ id: objectId, tenantId, environment, subjectNumber, queueKind, label, sourceVersion, firstObservedAt }) {
  return {
    id: objectId, kind: 'PROPOSAL', tenantId, environment,
    subjectLinkId: id('subject', subjectNumber), assignmentId: id('assignment', subjectNumber),
    version: 1, queueKind, label, state: 'OPEN', sourceVersion, firstObservedAt,
    ownerType: 'MENTOR', dueAt: null, policyVersionId: 'policy_007_local_review_v1',
    origin: queueKind === 'AI_CLAIM' ? 'AI_PROPOSAL' : 'DETERMINISTIC',
    freshness: queueKind === 'MEDIA_EXCEPTION' ? 'SOURCE_MISSING' : 'CURRENT',
    reviewState: 'REVIEW_REQUIRED',
  };
}

function attention({ id: objectId, tenantId, environment, subjectNumber, category, reason, dueAt, firstObservedAt, nextAction, sourceObjectId }) {
  return {
    id: objectId, kind: 'ATTENTION', tenantId, environment,
    subjectLinkId: id('subject', subjectNumber), assignmentId: id('assignment', subjectNumber),
    version: 1, category, reason, dueAt, firstObservedAt, nextAction, sourceObjectId,
    sourceVersion: 1, disposition: 'OPEN', dispositionSourceVersion: null,
    dispositionReason: null, dispositionExpiresAt: null,
    evidence: {
      origin: category === 'REVIEW_WAIT' ? 'AI_PROPOSAL' : 'DETERMINISTIC',
      freshness: category === 'DATA_SUFFICIENCY' ? 'SOURCE_MISSING' : 'CURRENT',
      reviewState: category === 'REVIEW_WAIT' ? 'REVIEW_REQUIRED' : 'APPROVED',
      sourceLabel: 'Synthetic CAM v2 local fixture',
      observedAt: firstObservedAt,
    },
    updatedAt: firstObservedAt,
  };
}

function nextAction(number) {
  const actions = [
    'Open the milestone evidence plan.',
    'Return the promised outline comments.',
    'Prepare for the scheduled call.',
    'Clarify the named blocker.',
    'Review the exact evidence spans.',
    'Request the missing evidence.',
    'Resolve the identity conflict.',
    'Review the next agreed action.',
  ];
  return actions[number - 1];
}

function boundedCount(value, fallback, minimum, maximum) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < minimum || normalized > maximum) {
    throw new TypeError(`Scale fixture count must be an integer from ${minimum} to ${maximum}.`);
  }
  return normalized;
}
