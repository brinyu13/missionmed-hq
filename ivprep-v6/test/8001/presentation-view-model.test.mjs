import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContextSources,
  buildHomeViewModel,
  buildIdentityViewModel,
  buildReadinessRows,
  reviewTranscriptCoverage,
  reviewTurnSpeakerLabel,
  reviewEvidenceCopy,
  buildQuestionPoolBulkAction,
  programSearchFailureCopy,
} from '../../public/studio/presentation-view-model.mjs';
import { publicAdmissionState } from '../../server/admission-contract.mjs';
import { summarizeVideoFramePixels } from '../../public/studio/media-analytics-capability.mjs';

const row = (rows, label) => rows.find(([name]) => name === label);

test('connected devices do not become measured readiness without per-signal evidence', () => {
  const rows = buildReadinessRows({ media: { cam: true, mic: true }, metrics: {} });
  for (const label of ['Framing', 'Face / head', 'Hands / gestures', 'Smile / expression', 'Volume', 'Pace', 'Pitch', 'Pauses']) {
    assert.equal(row(rows, label)[1], false, label);
    assert.equal(row(rows, label)[2], 'Awaiting measured evidence', label);
  }
});

test('readiness exposes only signal-specific measured evidence', () => {
  const metrics = Object.fromEntries(['FRAMING', 'HANDS', 'VOICE_LEVEL', 'PACE', 'PITCH', 'PAUSE']
    .map((key) => [key, { available: true }]));
  metrics.FACE = { available: true, smileActive: null };
  const rows = buildReadinessRows({ media: { cam: true, mic: true }, metrics });
  for (const label of ['Framing', 'Face / head', 'Hands / gestures', 'Volume', 'Pace', 'Pitch', 'Pauses']) {
    assert.equal(row(rows, label)[1], true, label);
  }
  assert.equal(row(rows, 'Smile / expression')[1], false);
  metrics.FACE.smileActive = false;
  assert.equal(row(buildReadinessRows({ media: { cam: true }, metrics }), 'Smile / expression')[1], true);
});

test('Top 3 availability follows the real mentor-priority projection', () => {
  const empty = buildContextSources({ mentorPriorities: { version: 2, priorities: [] } })
    .find((source) => source.name === 'Top 3');
  assert.equal(empty.connected, true);
  assert.equal(empty.available, false);

  const populated = buildContextSources({ mentorPriorities: { version: 3, priorities: [{ text: 'Name your contribution' }] } })
    .find((source) => source.name === 'Top 3');
  assert.equal(populated.available, true);
  assert.match(populated.detail, /1 mentor priority/u);
});

test('owner context cards follow the server capability manifest without exposing provider details', () => {
  const sources = buildContextSources({
    contextCapabilities: {
      storyForge: { connected: true }, rise: { connected: false }, fileVault: { connected: true },
    },
  });
  assert.equal(sources.find((source) => source.name === 'StoryForge').available, true);
  assert.equal(sources.find((source) => source.name === 'CV').available, true);
  assert.equal(sources.find((source) => source.name === 'File Vault').available, true);
  assert.equal(sources.find((source) => source.name === 'RISE').available, false);
  assert.equal(sources.find((source) => source.name === 'MCC').available, false);
  const connectedRise = buildContextSources({ contextCapabilities: { rise: { connected: true } } })
    .find((source) => source.name === 'RISE');
  assert.equal(connectedRise.connected, true);
  assert.equal(connectedRise.available, false);
  const selectedRise = buildContextSources({ programVerified: true, contextCapabilities: { rise: { connected: true } } })
    .find((source) => source.name === 'RISE');
  assert.equal(selectedRise.available, true);
});

test('Admin review copy names the selected student instead of the reviewer', () => {
  const pitch = '+1.1 st vs your median';
  const transcript = 'Counted from your transcript';
  assert.equal(reviewEvidenceCopy(pitch, { role: 'student' }), pitch);
  assert.equal(reviewEvidenceCopy(pitch, { role: 'admin', reviewScope: 'self' }), pitch);
  assert.equal(reviewEvidenceCopy(pitch, { role: 'admin', reviewScope: 'admin' }), "+1.1 st vs the student's median");
  assert.equal(reviewEvidenceCopy(transcript, { role: 'admin', reviewScope: 'admin' }), "Counted from the student's transcript");
});

test('Home presents real latest-session and mentor state with truthful empty fallbacks', () => {
  const empty = buildHomeViewModel({ identity: { displayName: 'Alex Morgan' } });
  assert.equal(empty.initials, 'AM');
  assert.equal(empty.continueTitle, 'No saved practice yet');
  assert.equal(empty.mentorPriority, 'No mentor priority has been set yet.');

  const real = buildHomeViewModel({
    identity: { wpUserId: 1, displayName: 'Brian Yu', roles: ['administrator'] },
    sessions: [
      { title: 'Older answer', startedAt: '2026-09-01T12:00:00Z' },
      { title: 'Recent answer', startedAt: '2026-09-02T12:00:00Z' },
    ],
    mentorPriorities: { priorities: [{ text: 'Lead with your contribution.' }] },
  });
  assert.equal(real.greetingName, 'Dr Brian.');
  assert.equal(real.continueTitle, 'Recent answer');
  assert.equal(real.mentorPriority, 'Lead with your contribution.');
});

test('temporary IVOC Founder access does not impersonate Dr Brian in presentation', () => {
  const admission = { ok: true, subject: 'wp:142', expiresAtMs: Date.now() + 60_000,
    csrfToken: 'local-test-csrf', entitlement: { founder: true, voice: true, video: true, grantedVideoSeconds: 0, revision: 'test' } };
  const publicState = publicAdmissionState(admission, {
    hqSession: { user: { id: 142, displayName: 'Ismat Huq', roles: ['subscriber'] } },
  });
  assert.equal(publicState.identity.displayName, 'Ismat Huq');
  assert.equal(publicState.identity.founder, true);
  assert.deepEqual(buildIdentityViewModel(publicState.identity), { initials: 'IH', greetingName: 'Ismat.' });
  assert.equal(buildHomeViewModel({ identity: publicState.identity }).greetingName, 'Ismat.');
  assert.equal(buildIdentityViewModel({ wpUserId: 1, founder: true, displayName: 'Brian Yu' }).greetingName, 'Dr Brian.');
  assert.equal(buildIdentityViewModel({ wpUserId: 142, founder: true }).greetingName, 'Doctor.');
});

test('video readiness rejects live-but-black frames without treating one bright pixel as a picture', () => {
  const black = new Uint8ClampedArray(64 * 48 * 4);
  assert.equal(summarizeVideoFramePixels(black).visible, false);
  const singlePixel = black.slice();
  singlePixel[0] = 255; singlePixel[1] = 255; singlePixel[2] = 255;
  assert.equal(summarizeVideoFramePixels(singlePixel).visible, false);
  const lit = new Uint8ClampedArray(64 * 48 * 4);
  for (let index = 0; index < lit.length; index += 4) {
    lit[index] = 72; lit[index + 1] = 64; lit[index + 2] = 58; lit[index + 3] = 255;
  }
  assert.equal(summarizeVideoFramePixels(lit).visible, true);
});

test('Admin review transcript names the selected student, not the reviewer', () => {
  assert.equal(reviewTurnSpeakerLabel('student', { role: 'admin', ownerDisplayName: 'Alex Morgan' }), 'Student · Alex Morgan');
  assert.equal(reviewTurnSpeakerLabel('student', { role: 'student', ownerDisplayName: 'Alex Morgan' }), 'You');
  assert.equal(reviewTurnSpeakerLabel('interviewer', { role: 'admin', ownerDisplayName: 'Alex Morgan' }), 'Interviewer');
  assert.equal(reviewTranscriptCoverage([{ speaker: 'interviewer' }]), 'interviewer_only');
  assert.equal(reviewTranscriptCoverage([{ speaker: 'interviewer' }, { speaker: 'student' }]), 'candidate_present');
});

test('bulk Question Pool action follows visible search results instead of the selected category', () => {
  const questions = [
    { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.', category: 'Core' },
    { question_id: 'MR-02', canonical_text: 'Describe your research.', category: 'Research' },
  ];
  const categoryOf = (question) => question.category;
  const search = buildQuestionPoolBulkAction({ questions, category: 'Core', search: 'research', categoryOf });
  assert.equal(search.label, 'Add matching questions');
  assert.deepEqual(search.targets.map((question) => question.question_id), ['MR-02']);
  const category = buildQuestionPoolBulkAction({ questions, category: 'Core', categoryOf });
  assert.equal(category.label, 'Add entire category');
  assert.deepEqual(category.targets.map((question) => question.question_id), ['CORE-01']);
});

test('program search failure is student-facing and does not expose an internal error code', () => {
  assert.match(programSearchFailureCopy({ status: 403 }), /not available for this account/u);
  assert.match(programSearchFailureCopy({ status: 500 }), /temporarily unavailable/u);
  assert.doesNotMatch(programSearchFailureCopy({ status: 500, message: 'ivoc_internal_error' }), /ivoc_internal_error/u);
});
