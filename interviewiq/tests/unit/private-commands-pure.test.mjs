import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loiEnabled, loiCanonicalLookup, loiProgramAllowed,
  loiInterviewAllowed, loiHistory, loiChecks, loiHandoff, headCheck,
} from '../../server/private-commands.mjs';
import { LOI_CANARY_OWNER } from '../../server/loi-openai.mjs';

// ── helpers ──────────────────────────────────────────────────────────

function canaryLoiConfig(overrides = {}) {
  return {
    loi: {
      enabled: true,
      mode: 'CANARY',
      ownerId: LOI_CANARY_OWNER,
      programId: 'some_program',
      ...overrides,
    },
  };
}

function eligibleConfig(overrides = {}) {
  return {
    loi: {
      enabled: true,
      mode: 'ELIGIBLE',
      ...overrides,
    },
  };
}

function validStudent(overrides = {}) {
  return {
    id: LOI_CANARY_OWNER,
    role: 'student',
    eligible: true,
    tier: '360',
    ...overrides,
  };
}

// ── loiEnabled ───────────────────────────────────────────────────────

test('loiEnabled returns true for valid CANARY config and student', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent()), true);
});

test('loiEnabled returns true with ivprep_complete tier', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent({ tier: 'ivprep_complete' })), true);
});

test('loiEnabled returns false when loi not enabled', () => {
  assert.equal(loiEnabled(canaryLoiConfig({ enabled: false }), validStudent()), false);
});

test('loiEnabled returns false for non-student role', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent({ role: 'admin' })), false);
});

test('loiEnabled returns false for ineligible actor', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent({ eligible: false })), false);
});

test('loiEnabled returns false for wrong tier', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent({ tier: 'basic' })), false);
});

test('loiEnabled returns false when CANARY mode lacks ownerId', () => {
  assert.equal(loiEnabled(canaryLoiConfig({ ownerId: undefined }), validStudent()), false);
});

test('loiEnabled returns false when CANARY mode lacks programId', () => {
  assert.equal(loiEnabled(canaryLoiConfig({ programId: undefined }), validStudent()), false);
});

test('loiEnabled returns false when actor id does not match ownerId', () => {
  assert.equal(loiEnabled(canaryLoiConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })), false);
});

test('loiEnabled returns true in ELIGIBLE mode without ownerId', () => {
  assert.equal(loiEnabled(eligibleConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })), true);
});

test('loiEnabled returns true in ELIGIBLE mode with matching ownerId', () => {
  const config = eligibleConfig({ ownerId: LOI_CANARY_OWNER });
  assert.equal(loiEnabled(config, validStudent()), true);
});

test('loiEnabled returns false in ELIGIBLE mode with mismatched ownerId', () => {
  const config = eligibleConfig({ ownerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' });
  assert.equal(loiEnabled(config, validStudent()), false);
});

test('loiEnabled returns false for invalid mode', () => {
  assert.equal(loiEnabled(canaryLoiConfig({ mode: 'INVALID' }), validStudent()), false);
});

test('loiEnabled defaults mode to CANARY when missing', () => {
  const config = canaryLoiConfig();
  delete config.loi.mode;
  // CANARY requires ownerId and programId — both present
  assert.equal(loiEnabled(config, validStudent()), true);
});

// ── loiCanonicalLookup ───────────────────────────────────────────────

test('loiCanonicalLookup returns true for ELIGIBLE mode with enabled actor', () => {
  assert.equal(loiCanonicalLookup(eligibleConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' })), true);
});

test('loiCanonicalLookup returns false for CANARY mode', () => {
  assert.equal(loiCanonicalLookup(canaryLoiConfig(), validStudent()), false);
});

test('loiCanonicalLookup returns false when loiEnabled returns false', () => {
  assert.equal(loiCanonicalLookup(eligibleConfig({ enabled: false }), validStudent()), false);
});

// ── loiProgramAllowed ────────────────────────────────────────────────

test('loiProgramAllowed returns true for matching programId', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig(), validStudent(), 'some_program'), true);
});

test('loiProgramAllowed returns false for mismatched programId', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig(), validStudent(), 'other_program'), false);
});

test('loiProgramAllowed returns true when config has no programId filter', () => {
  assert.equal(loiProgramAllowed(eligibleConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }), 'any_program'), true);
});

test('loiProgramAllowed returns false for non-string programId', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig(), validStudent(), 42), false);
});

test('loiProgramAllowed returns false for empty programId', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig(), validStudent(), ''), false);
});

test('loiProgramAllowed returns false for programId exceeding 180 chars', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig({ programId: undefined }), validStudent(), 'a'.repeat(181)), false);
});

test('loiProgramAllowed returns false for programId starting with non-alnum', () => {
  assert.equal(loiProgramAllowed(eligibleConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }), '.bad'), false);
});

test('loiProgramAllowed accepts programId with dots, colons, hyphens', () => {
  assert.equal(loiProgramAllowed(eligibleConfig(), validStudent({ id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' }), 'rise_mayo.im:cat-2025'), true);
});

test('loiProgramAllowed returns false when loiEnabled fails', () => {
  assert.equal(loiProgramAllowed(canaryLoiConfig({ enabled: false }), validStudent(), 'some_program'), false);
});

// ── loiInterviewAllowed ──────────────────────────────────────────────

test('loiInterviewAllowed returns true when owner matches and program allowed', () => {
  const row = { owner_id: LOI_CANARY_OWNER, program_id: 'some_program' };
  assert.equal(loiInterviewAllowed(canaryLoiConfig(), validStudent(), row), true);
});

test('loiInterviewAllowed returns false when owner_id does not match actor', () => {
  const row = { owner_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', program_id: 'some_program' };
  assert.equal(loiInterviewAllowed(canaryLoiConfig(), validStudent(), row), false);
});

test('loiInterviewAllowed returns false when program_id not allowed', () => {
  const row = { owner_id: LOI_CANARY_OWNER, program_id: 'wrong_program' };
  assert.equal(loiInterviewAllowed(canaryLoiConfig(), validStudent(), row), false);
});

test('loiInterviewAllowed returns false for null row', () => {
  assert.equal(loiInterviewAllowed(canaryLoiConfig(), validStudent(), null), false);
});

// ── loiHistory ───────────────────────────────────────────────────────

const revisionType = 'iiq.loi.revision';
const outreachType = 'iiq.loi.outreach';

function makeRevision(overrides = {}) {
  return {
    type: revisionType,
    schemaVersion: 1,
    revisionId: 'rev-1',
    letterId: 'letter-1',
    interviewId: 'int-1',
    text: 'Dear Program Director...',
    program: { id: 'some_program', name: 'Mayo IM', track: '' },
    storyRefs: [],
    ...overrides,
  };
}

function makeOutreach(overrides = {}) {
  return {
    type: outreachType,
    schemaVersion: 1,
    handoffId: 'handoff-1',
    eventId: 'event-1',
    letterId: 'letter-1',
    revisionId: 'rev-1',
    ...overrides,
  };
}

function makeRow(overrides = {}) {
  return {
    id: 'int-1',
    program_id: 'some_program',
    program_name: 'Mayo IM',
    program_track: '',
    ...overrides,
  };
}

test('loiHistory returns empty history for null anchors', () => {
  const result = loiHistory(null, makeRow());
  assert.deepEqual(result.history, []);
  assert.equal(result.current, null);
  assert.equal(result.currentConsentValid, null);
});

test('loiHistory returns empty history for empty anchors', () => {
  const result = loiHistory([], makeRow());
  assert.deepEqual(result.history, []);
  assert.equal(result.current, null);
});

test('loiHistory filters non-revision/outreach anchors', () => {
  const result = loiHistory([{ type: 'unknown' }, null, undefined], makeRow());
  assert.deepEqual(result.history, []);
});

test('loiHistory identifies current revision as last known revision', () => {
  const rev1 = makeRevision({ revisionId: 'rev-1' });
  const rev2 = makeRevision({ revisionId: 'rev-2' });
  const result = loiHistory([rev1, rev2], makeRow());
  assert.equal(result.current.revisionId, 'rev-2');
});

test('loiHistory marks unknown schema revisions as unavailable', () => {
  const rev = makeRevision({ schemaVersion: 99 });
  const result = loiHistory([rev], makeRow());
  assert.equal(result.history[0].unavailable, true);
  assert.equal(result.current, null);
});

test('loiHistory separates outreach from revisions', () => {
  const rev = makeRevision();
  const out = makeOutreach();
  const result = loiHistory([rev, out], makeRow());
  assert.equal(result.outreach.length, 1);
  assert.equal(result.outreach[0].type, outreachType);
});

test('loiHistory currentBindingValid checks interviewId match for schema v1', () => {
  const rev = makeRevision({ interviewId: 'int-1' });
  const result = loiHistory([rev], makeRow({ id: 'int-1' }));
  assert.equal(result.currentBindingValid, true);
});

test('loiHistory currentBindingValid false for interviewId mismatch', () => {
  const rev = makeRevision({ interviewId: 'int-other' });
  const result = loiHistory([rev], makeRow({ id: 'int-1' }));
  assert.equal(result.currentBindingValid, false);
});

test('loiHistory currentBindingValid checks program_id match', () => {
  const rev = makeRevision({ program: { id: 'wrong', name: 'Mayo IM', track: '' } });
  const result = loiHistory([rev], makeRow());
  assert.equal(result.currentBindingValid, false);
});

test('loiHistory currentBindingValid checks program_name match', () => {
  const rev = makeRevision({ program: { id: 'some_program', name: 'Wrong', track: '' } });
  const result = loiHistory([rev], makeRow());
  assert.equal(result.currentBindingValid, false);
});

test('loiHistory currentBindingValid checks program track with default empty', () => {
  const rev = makeRevision({ program: { id: 'some_program', name: 'Mayo IM', track: 'Categorical' } });
  const result = loiHistory([rev], makeRow({ program_track: '' }));
  assert.equal(result.currentBindingValid, false);
});

test('loiHistory currentConsentValid null when consents not provided', () => {
  const rev = makeRevision();
  const result = loiHistory([rev], makeRow(), null);
  assert.equal(result.currentConsentValid, null);
  assert.deepEqual(result.consentInvalidRevisionIds, []);
});

test('loiHistory currentConsentValid true when no storyRefs', () => {
  const rev = makeRevision({ storyRefs: [] });
  const result = loiHistory([rev], makeRow(), []);
  assert.equal(result.currentConsentValid, true);
});

test('loiHistory currentConsentValid true when all storyRefs have active consent', () => {
  const rev = makeRevision({ storyRefs: [{ id: 'story-1' }] });
  const consents = [{ subject_ref: 'story-1', status: 'active' }];
  const result = loiHistory([rev], makeRow(), consents);
  assert.equal(result.currentConsentValid, true);
});

test('loiHistory currentConsentValid false when storyRef consent revoked', () => {
  const rev = makeRevision({ storyRefs: [{ id: 'story-1' }] });
  const consents = [{ subject_ref: 'story-1', status: 'revoked' }];
  const result = loiHistory([rev], makeRow(), consents);
  assert.equal(result.currentConsentValid, false);
});

test('loiHistory consentInvalidRevisionIds lists revisions with invalid consent', () => {
  const rev1 = makeRevision({ revisionId: 'rev-1', storyRefs: [{ id: 'story-1' }] });
  const rev2 = makeRevision({ revisionId: 'rev-2', storyRefs: [] });
  const consents = []; // story-1 has no consent
  const result = loiHistory([rev1, rev2], makeRow(), consents);
  assert.deepEqual(result.consentInvalidRevisionIds, ['rev-1']);
});

test('loiHistory v2 schema for program targets', () => {
  const rev = makeRevision({
    schemaVersion: 2,
    targetKind: 'program',
    targetId: 'target-1',
    program: { id: 'some_program', name: 'Mayo IM', track: '', registryReleaseId: 'rel-1' },
  });
  const row = makeRow({
    targetKind: 'program',
    id: 'target-1',
    registry_release_id: 'rel-1',
  });
  const result = loiHistory([rev], row);
  assert.equal(result.current.schemaVersion, 2);
  assert.equal(result.currentBindingValid, true);
});

test('loiHistory v2 currentBindingValid false for targetId mismatch', () => {
  const rev = makeRevision({
    schemaVersion: 2,
    targetKind: 'program',
    targetId: 'target-wrong',
    program: { id: 'some_program', name: 'Mayo IM', track: '', registryReleaseId: 'rel-1' },
  });
  const row = makeRow({
    targetKind: 'program',
    id: 'target-1',
    registry_release_id: 'rel-1',
  });
  const result = loiHistory([rev], row);
  assert.equal(result.currentBindingValid, false);
});

test('loiHistory v2 currentBindingValid false for registryReleaseId mismatch', () => {
  const rev = makeRevision({
    schemaVersion: 2,
    targetKind: 'program',
    targetId: 'target-1',
    program: { id: 'some_program', name: 'Mayo IM', track: '', registryReleaseId: 'rel-old' },
  });
  const row = makeRow({
    targetKind: 'program',
    id: 'target-1',
    registry_release_id: 'rel-new',
  });
  const result = loiHistory([rev], row);
  assert.equal(result.currentBindingValid, false);
});

// ── loiChecks ────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    text: 'Dear Director, I want to train at Mayo Clinic IM because patient-centered care is my calling, and your published outcomes data shows excellence.',
    program: { name: 'Mayo Clinic IM' },
    motivations: [
      { text: 'patient-centered care is my calling', confirmed: true },
    ],
    facts: [
      { text: 'Completed IM sub-internship', confirmed: true },
    ],
    context: {
      whyNow: 'Graduating this year',
      applicationState: 'Submitted ERAS',
      interviewState: 'Awaiting invitations',
    },
    evidence: [
      { field: 'outcomes', value: { detail: 'published outcomes data shows excellence' } },
    ],
    evidenceDigest: 'abc123',
    studentFactualConfirmation: true,
    studentSpecificityConfirmation: true,
    ...overrides,
  };
}

test('loiChecks returns no reasons for valid entry', () => {
  const result = loiChecks(makeEntry());
  assert.deepEqual(result.reasons, []);
  assert.equal(result.provenance, true);
  assert.equal(result.specificity, true);
});

test('loiChecks flags unconfirmed motivations', () => {
  const entry = makeEntry({
    motivations: [{ text: 'patient-centered care is my calling', confirmed: false }],
  });
  const result = loiChecks(entry);
  assert.ok(result.reasons.length > 0);
  assert.ok(result.reasons.some(r => r.includes('Confirm')));
});

test('loiChecks flags unconfirmed facts', () => {
  const entry = makeEntry({
    facts: [{ text: 'Completed IM sub-internship', confirmed: false }],
  });
  const result = loiChecks(entry);
  assert.ok(result.reasons.some(r => r.includes('Confirm')));
});

test('loiChecks flags empty whyNow context', () => {
  const entry = makeEntry({
    context: { whyNow: '', applicationState: 'Submitted', interviewState: 'Waiting' },
  });
  const result = loiChecks(entry);
  assert.ok(result.reasons.some(r => r.includes('Confirm')));
});

test('loiChecks flags empty applicationState context', () => {
  const entry = makeEntry({
    context: { whyNow: 'Graduating', applicationState: '   ', interviewState: 'Waiting' },
  });
  const result = loiChecks(entry);
  assert.ok(result.reasons.some(r => r.includes('Confirm')));
});

test('loiChecks flags missing program name in text', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at this program because patient-centered care is my calling, and your published outcomes data shows excellence.',
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, false);
  assert.ok(result.reasons.some(r => r.includes('program name')));
});

test('loiChecks flags text without linked motivation', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at Mayo Clinic IM and your published outcomes data shows excellence.',
    motivations: [{ text: 'something not in the letter', confirmed: true }],
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, false);
});

test('loiChecks flags text without evidence detail', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at Mayo Clinic IM because patient-centered care is my calling.',
    evidence: [{ field: 'outcomes', value: { detail: 'something not included' } }],
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, false);
});

test('loiChecks flags empty evidence array', () => {
  const entry = makeEntry({ evidence: [], evidenceDigest: 'abc' });
  const result = loiChecks(entry);
  assert.equal(result.provenance, false);
  assert.ok(result.reasons.some(r => r.includes('RISE evidence')));
});

test('loiChecks flags missing evidenceDigest', () => {
  const entry = makeEntry({ evidenceDigest: null });
  const result = loiChecks(entry);
  assert.equal(result.provenance, false);
});

test('loiChecks flags missing studentFactualConfirmation', () => {
  const entry = makeEntry({ studentFactualConfirmation: false });
  const result = loiChecks(entry);
  assert.ok(result.reasons.some(r => r.includes('factual accuracy')));
});

test('loiChecks flags missing studentSpecificityConfirmation', () => {
  const entry = makeEntry({ studentSpecificityConfirmation: false });
  const result = loiChecks(entry);
  assert.ok(result.reasons.some(r => r.includes('factual accuracy') || r.includes('change for another')));
});

test('loiChecks returns correct confirmation fields', () => {
  const result = loiChecks(makeEntry({ studentFactualConfirmation: true, studentSpecificityConfirmation: false }));
  assert.equal(result.studentFactualConfirmation, true);
  assert.equal(result.studentSpecificityConfirmation, false);
});

test('loiChecks evidence detail must be >= 8 chars to count', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at Mayo Clinic IM because patient-centered care is my calling, and short.',
    evidence: [{ field: 'outcomes', value: 'short' }],
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, false);
});

test('loiChecks walks nested evidence values for string matching', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at Mayo Clinic IM because patient-centered care is my calling, and your research program has twelve active studies.',
    evidence: [{ field: 'research', value: { nested: { deep: 'twelve active studies' } } }],
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, true);
});

test('loiChecks handles evidence value as string array', () => {
  const entry = makeEntry({
    text: 'Dear Director, I want to train at Mayo Clinic IM because patient-centered care is my calling, and your residency outcomes are excellent.',
    evidence: [{ field: 'outcomes', value: ['residency outcomes are excellent'] }],
  });
  const result = loiChecks(entry);
  assert.equal(result.specificity, true);
});

// ── loiHandoff ───────────────────────────────────────────────────────

test('loiHandoff returns URLs for valid short input', () => {
  const result = loiHandoff({
    recipient: 'director@mayo.edu',
    subject: 'Letter of Interest',
    text: 'Dear Director...',
  });
  assert.equal(result.recipient, 'director@mayo.edu');
  assert.equal(result.subject, 'Letter of Interest');
  assert.equal(result.copyOnly, false);
  assert.ok(result.gmailUrl.startsWith('https://mail.google.com/'));
  assert.ok(result.mailtoUrl.startsWith('mailto:'));
  assert.equal(result.reason, null);
});

test('loiHandoff returns copyOnly for very long text', () => {
  const result = loiHandoff({
    recipient: 'director@mayo.edu',
    subject: 'Letter of Interest',
    text: 'x'.repeat(10000),
  });
  assert.equal(result.copyOnly, true);
  assert.equal(result.gmailUrl, null);
  assert.equal(result.mailtoUrl, null);
  assert.ok(result.reason.includes('compose URL limit'));
});

test('loiHandoff rejects invalid email', () => {
  assert.throws(
    () => loiHandoff({ recipient: 'not-email', subject: 'Test', text: 'Hello' }),
    { code: 'loi_recipient_invalid' }
  );
});

test('loiHandoff rejects empty recipient', () => {
  assert.throws(
    () => loiHandoff({ recipient: '', subject: 'Test', text: 'Hello' }),
    { code: 'invalid_text' }
  );
});

test('loiHandoff rejects subject with control characters', () => {
  assert.throws(
    () => loiHandoff({ recipient: 'a@b.com', subject: 'Bad\nSubject', text: 'Hello' }),
    { code: 'loi_subject_invalid' }
  );
});

test('loiHandoff rejects empty subject', () => {
  assert.throws(
    () => loiHandoff({ recipient: 'a@b.com', subject: '', text: 'Hello' }),
    { code: 'invalid_text' }
  );
});

test('loiHandoff rejects subject over 300 chars', () => {
  assert.throws(
    () => loiHandoff({ recipient: 'a@b.com', subject: 'x'.repeat(301), text: 'Hello' }),
    { code: 'invalid_text' }
  );
});

// ── headCheck ────────────────────────────────────────────────────────

test('headCheck passes for null current and null expectedHead', () => {
  assert.doesNotThrow(() => headCheck(
    { expectedHead: null, expectedLetterVersion: 0, letterId: null },
    null
  ));
});

test('headCheck passes for matching current', () => {
  const current = { revisionId: 'rev-1', letterVersion: 3, letterId: 'letter-1' };
  assert.doesNotThrow(() => headCheck(
    { expectedHead: 'rev-1', expectedLetterVersion: 3, letterId: 'letter-1' },
    current
  ));
});

test('headCheck throws for revisionId mismatch', () => {
  const current = { revisionId: 'rev-1', letterVersion: 3, letterId: 'letter-1' };
  assert.throws(
    () => headCheck({ expectedHead: 'rev-wrong', expectedLetterVersion: 3, letterId: 'letter-1' }, current),
    { code: 'loi_head_conflict' }
  );
});

test('headCheck throws for letterVersion mismatch', () => {
  const current = { revisionId: 'rev-1', letterVersion: 3, letterId: 'letter-1' };
  assert.throws(
    () => headCheck({ expectedHead: 'rev-1', expectedLetterVersion: 2, letterId: 'letter-1' }, current),
    { code: 'loi_head_conflict' }
  );
});

test('headCheck throws for letterId mismatch when current exists', () => {
  const current = { revisionId: 'rev-1', letterVersion: 3, letterId: 'letter-1' };
  assert.throws(
    () => headCheck({ expectedHead: 'rev-1', expectedLetterVersion: 3, letterId: 'letter-2' }, current),
    { code: 'loi_letter_conflict' }
  );
});

test('headCheck throws when letterId non-null but current is null', () => {
  assert.throws(
    () => headCheck({ expectedHead: null, expectedLetterVersion: 0, letterId: 'letter-1' }, null),
    { code: 'loi_letter_conflict' }
  );
});

test('headCheck throws when expectedHead non-null but current is null', () => {
  assert.throws(
    () => headCheck({ expectedHead: 'rev-1', expectedLetterVersion: 0, letterId: null }, null),
    { code: 'loi_head_conflict' }
  );
});
