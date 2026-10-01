import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  buildContextSources,
  contextSourceHint,
  buildOwnerIntegrationFacts,
  buildPracticeEntryIntent,
  resolveAdminStudentSelection,
  buildAdminStudentProgress,
  buildComparisonSelection,
  buildEvidenceMomentLinks,
  debriefConfidenceCopy,
  interviewerPresenceCopy,
  buildHomeViewModel,
  buildIdentityViewModel,
  buildReadinessRows,
  reviewTranscriptCoverage,
  reviewTurnSpeakerLabel,
  reviewEvidenceCopy,
  buildQuestionPoolBulkAction,
  programSearchFailureCopy,
  buildBuilderLaunchLabel,
  buildResultsNextAction,
  buildRetryIntent,
  buildBuilderStepAction,
  buildPracticeQuestionLabel,
  buildBuilderLaunchOrder,
} from '../../public/studio/presentation-view-model.mjs';
import { publicAdmissionState } from '../../server/admission-contract.mjs';
import { summarizeVideoFramePixels } from '../../public/studio/media-analytics-capability.mjs';

const row = (rows, label) => rows.find(([name]) => name === label);

test('retry retains owner question and goal without reusing stale context authority', () => {
  const question = { question_id: 'Q1', canonical_text: 'Why this program?' };
  const detail = { id: 'own', sessionType: 'mock', interviewerProvider: 'openai-gpt-live', retryContext: {
    schema: 'ivoc.retry-intent.v1', sourceSessionId: 'own', questionId: 'Q1', questionText: question.canonical_text,
    goal: 'Guided Mock IV Practice', pressurePractice: true, program: 'Original program',
    contextSources: ['CV', 'RISE', 'StoryForge', 'private-unrecognized'],
  } };
  const retry = buildRetryIntent({ detail, catalog: [question], drill: { text: 'Name your own contribution.' } });
  assert.equal(retry.available, true);
  assert.equal(retry.question, question);
  assert.equal(retry.wizard.goal, 'Guided Mock IV Practice');
  assert.equal(retry.wizard.retrySessionType, 'mock');
  assert.equal(retry.wizard.pressurePractice, true);
  assert.equal(retry.wizard.programVerified, false);
  assert.equal(retry.wizard.programId, null);
  assert.equal(retry.wizard.storyForgeOptIn, null);
  assert.deepEqual(retry.wizard.contextSources, ['CV']);
  assert.equal(retry.drill, 'Name your own contribution.');
  assert.match(retry.notes.join(' '), /version unavailable/);
  assert.equal(buildRetryIntent({ detail, catalog: [question], reviewScope: 'admin' }).available, false);
  assert.equal(buildRetryIntent({ detail, catalog: [] }).available, false);
  assert.equal(buildRetryIntent({ detail, catalog: [{ ...question, canonical_text: 'Edited question' }] }).available, false);
  assert.equal(buildRetryIntent({ detail: { ...detail, id: 'different' }, catalog: [question] }).available, false);
  assert.equal(buildRetryIntent({ detail: null }).available, false);
});

test('actual retry transition seeds exactly one question and never starts capture or provider', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.match(/async function prepareSavedQuestionRetry[\s\S]*?(?=\nfunction renderPostAnswer)/)[0];
  const question = { question_id: 'Q1', canonical_text: 'Why here?' };
  const detail = { id: 'own', sessionType: 'mock', interviewerProvider: 'openai-gpt-live', retryContext: {
    schema: 'ivoc.retry-intent.v1', sourceSessionId: 'own', questionId: 'Q1', questionText: 'Why here?', goal: 'Full IV Simulation',
  } };
  const saved = { sessionDetail: detail };
  const state = { lastSaved: saved, view: 'postanswer', session: { state: 'COMPLETE' }, wizard: { goal: 'stale', program: 'wrong' } };
  const prepare = new Function('state','isAdminReview','preserveInterviewLifecycle','projectContextResults','contextResultFromSessionSpine','buildRetryIntent','store','WIZARD_STEPS','renderSet','setView','$','el', `return ${implementation};`)(state,
    s => s?.reviewScope === 'admin', s => s === 'RUNNING', () => ({drill:{text:'One specific example.'}}), d => d,
    buildRetryIntent, { all: () => [question] }, [1,2,3,4,5,6], () => {}, view => { state.view = view; }, () => null, () => null);
  await prepare(saved);
  assert.equal(state.view, 'newsession'); assert.equal(state.wizardStep, 6);
  assert.deepEqual(state.interviewSet, [question]); assert.equal(state.targetQuestions, 1);
  assert.equal(state.launchMode, 'ai'); assert.equal(state.wizard.focus, 'One specific example.');
  assert.equal(state.wizard.program, ''); assert.equal(state.wizard.retrySourceSessionId, 'own');
  state.view = 'postanswer'; saved.reviewScope = 'admin'; await prepare(saved);
  assert.equal(state.view, 'postanswer');
});

test('citations resolve only unique bounded ranges in this saved recording', () => {
  const result = { transcript: { status: 'AVAILABLE', segments: [
    { id: 'seg-1', startMs: 0, endMs: 1500 },
    { id: 'seg-2', startMs: 1200, endMs: 500 },
    { id: 'seg-3', startMs: null, endMs: 1000 },
    { id: 'seg-4', startMs: 1900, endMs: 3000 },
    { id: 'seg-5', startMs: 500, endMs: 700 }, { id: 'seg-5', startMs: 900, endMs: 1100 },
  ] } };
  const links = buildEvidenceMomentLinks(result, ['seg-1','seg-1','seg-2','seg-3','seg-4','seg-5','absent'], 2000);
  assert.equal(links.length, 6);
  assert.equal(links[0].label, 'Moment 1 · 0.0–1.5s');
  assert.equal(links[0].available, true);
  assert.ok(links.slice(1).every(link => !link.available && link.label.includes('unavailable')));
  assert.equal(buildEvidenceMomentLinks(result, ['seg-1'])[0].available, false);
});

test('evidence confidence is never described as measured transcript coverage', () => {
  assert.match(debriefConfidenceCopy({ label: 'MODERATE', score: .76, coverage: .9, coverageBasis: 'evidence_confidence' }), /90% cited-evidence confidence/);
  assert.match(debriefConfidenceCopy({ label: 'MODERATE', score: .76, coverage: .9 }), /provider-estimated coverage/);
});

test('actual Results citation action loads authorized playback, seeks, and stays paused', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.match(/async function openLastSavedFilmRoom[\s\S]*?(?=\nasync function analyzeLastAnswer)/)[0];
  const video = Object.assign(new EventTarget(), { readyState: 1, duration: 10, currentTime: 0, plays: 0,
    pause() {}, async play() { this.plays++; } });
  const saved = { session: { recording: { id: 'recording-a' } } };
  const state = { lastSaved: saved, role: 'student', view: 'postanswer', durable: { playback: async id => {
    assert.equal(id, 'recording-a'); return { url: 'https://private.invalid/recording-a' };
  } } };
  const notes = [];
  const open = new Function('state','$','isAdminReview','adminReviewGate','mayPresentSavedReview','presentFilmRoomAnalytics','renderFilmRoomSpine','setView','el',
    `let playbackReviewRequest = 0; return ${implementation};`)(state,
    selector => selector === '#playback' ? video : { append: note => notes.push(note) },
    () => false, {}, ({ saved, currentSaved }) => saved === currentSaved, value => value, () => {},
    view => { state.view = view; }, (...parts) => parts.at(-1));
  await open(null, { autoplay: false, moment: { startMs: 2500, endMs: 4000, label: 'Moment 2' }, expectedSaved: saved });
  assert.equal(state.view, 'filmroom');
  assert.equal(video.currentTime, 2.5);
  assert.equal(video.plays, 0);
  assert.match(notes[0], /Paused at cited evidence/);

  state.view = 'postanswer';
  state.durable.playback = async () => { state.lastSaved = { session: { id: 'another-answer' } }; return { url: 'https://private.invalid/stale' }; };
  await open(null, { autoplay: false, moment: { startMs: 5000, endMs: 6000 }, expectedSaved: saved });
  assert.equal(video.currentTime, 2.5);
  assert.equal(state.view, 'postanswer');
  assert.notEqual(video.src, 'https://private.invalid/stale');

  state.lastSaved = saved;
  state.durable.playback = async () => { throw new Error('Signed playback temporarily unavailable'); };
  await open(null, { autoplay: false, moment: { startMs: 2500, endMs: 4000 }, expectedSaved: saved });
  assert.equal(state.view, 'postanswer');
  assert.match(notes.at(-1), /Signed playback temporarily unavailable/);
});

test('completed analysis binds citations to refreshed saved detail and discards obsolete review replies', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.match(/async function analyzeLastAnswer[\s\S]*?(?=\nfunction renderHomeCorpus)/)[0];
  const saved = { persisted: true, recording: { recording: { id: 'r1' } }, session: { id: 's1', questionId: 'q1' }, analytics: { answerId: 'a1' } };
  const detail = { id: 's1' };
  const state = { lastSaved: saved, role: 'student', durable: { analyze: async () => ({ persistence: { transcript: true } }), api: { session: async () => detail } } };
  const rendered = [];
  const analyze = new Function('state','$','isAdminReview','adminReviewGate','mayPresentSavedReview','renderContextEvidence','renderFilmRoomSpine',
    `return ${implementation};`)(state, () => null, () => false, {},
    ({saved,currentSaved}) => saved === currentSaved, () => rendered.push(state.lastSaved), () => {});
  await analyze();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0], state.lastSaved);
  assert.equal(rendered[0].sessionDetail, detail);
  assert.notEqual(rendered[0], saved);
  state.lastSaved = saved;
  state.durable.analyze = async () => { state.lastSaved = null; return { persistence: { transcript: true } }; };
  await analyze();
  assert.equal(rendered.length, 1);
});

test('comparison retains the reviewed stable ID and selects only an earlier compatible baseline', () => {
  const attempt = (id, questionId, at) => ({ id, questionId, title: questionId, at,
    sessionType: 'question', interviewerProvider: 'missionmed-static', evidenceVersion: 'ivoc.analytics.v1:1::' });
  const attempts = [attempt('new-other', 'Q2', 50), attempt('later', 'Q1', 40), attempt('reviewed', 'Q1', 30), attempt('earlier', 'Q1', 20)];
  const view = buildComparisonSelection(attempts, { currentId: 'reviewed', baselineId: 'new-other' });
  assert.equal(view.current.id, 'reviewed');
  assert.equal(view.baseline.id, 'earlier');
  assert.deepEqual(view.eligible.map((entry) => entry.id), ['earlier']);
  assert.equal(buildComparisonSelection([...attempts].reverse(), { currentId: 'reviewed', baselineId: 'earlier' }).baseline.id, 'earlier');
  assert.equal(buildComparisonSelection(attempts, { currentId: 'new-other' }).baseline, null);
  assert.equal(buildComparisonSelection([attempts[2]]).baseline, null);
  assert.equal(buildComparisonSelection([]).current, null);
});

test('actual pool summary refresh synchronizes the visible target with current practice intent', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const body = source.match(/function renderPoolSummary\(\) \{([\s\S]*?)\n\}/)[1];
  const target = { value: '5' };
  const preview = { replaceChildren() {}, append() {} };
  const state = { targetQuestions: 1, interviewSet: [] };
  const render = new Function('$', 'state', 'document', body);
  render((selector) => selector === '#builder-target' ? target : selector === '#builder-pool-preview' ? preview : null,
    state, { createElement: () => ({ textContent: '' }) });
  assert.equal(target.value, '1');
  state.targetQuestions = 7;
  render((selector) => selector === '#builder-target' ? target : selector === '#builder-pool-preview' ? preview : null,
    state, { createElement: () => ({ textContent: '' }) });
  assert.equal(target.value, '7');
});

test('Admin review return preserves only a currently authorized student selection', () => {
  const students = [{ subject: 'wp:1' }, { subject: 'wp:142' }];
  assert.equal(resolveAdminStudentSelection(students, 'wp:142'), 'wp:142');
  assert.equal(resolveAdminStudentSelection(students, 'wp:999'), 'wp:1');
  assert.equal(resolveAdminStudentSelection(students), 'wp:1');
  assert.equal(resolveAdminStudentSelection([], 'wp:142'), '');
});

test('Admin progress uses only selected-subject saved history without inferred performance', () => {
  const model = buildAdminStudentProgress({ subject: 'wp:142', displayName: 'Selected student', sessions: [
    { id: 'a', ownerSubject: 'wp:142', state: 'saved', questionId: 'CORE-01', durationMs: 12000, endedAt: '2026-10-01T12:00:00Z' },
    { id: 'b', ownerSubject: 'wp:1', state: 'saved', questionId: 'CORE-02', durationMs: 99000 },
    { id: 'c', ownerSubject: 'wp:142', state: 'abandoned', durationMs: 99000 },
  ] });
  assert.deepEqual(model.totals, { savedSessions: 1, recordedMs: 12000, activeDays: 1, uniqueQuestions: 1 });
  assert.match(model.title, /Selected student/);
  assert.match(model.note, /no mastery, rank or recurring pattern is inferred/);
  assert.equal(buildAdminStudentProgress().totals.savedSessions, 0);
  assert.equal(model.durationAvailable, true);
  assert.equal(buildAdminStudentProgress({ subject: 'wp:142', sessions: [{ ownerSubject: 'wp:142', state: 'saved', durationMs: null }] }).durationAvailable, false);
});

test('one-question shortcuts establish explicit intent without resetting AI or in-progress launch choices', () => {
  assert.deepEqual(buildPracticeEntryIntent({ destination: 'newsession', launchMode: 'practice', builderStep: '1' }), { goal: 'Individual Question', targetQuestions: 1, duration: 5, pressurePractice: false });
  assert.equal(buildPracticeEntryIntent({ destination: 'newsession', launchMode: 'ai', builderStep: '0' }), null);
  assert.equal(buildPracticeEntryIntent({ destination: 'devicecheck', launchMode: 'practice', builderStep: '1' }), null);
  assert.equal(buildPracticeEntryIntent({ destination: 'newsession', launchMode: 'practice' }), null);
});

test('voice presence never advertises empty student voice selection', () => {
  assert.match(interviewerPresenceCopy(false), /selection are not available/);
  assert.match(interviewerPresenceCopy(true), /Founder\/Admin Interview Room/);
  assert.doesNotMatch(interviewerPresenceCopy(false), /Choose an available/);
});

test('empty mentor priorities do not instruct students to select a program', () => {
  const sources = buildContextSources({ mentorPriorities: { version: 2, priorities: [] }, contextCapabilities: { rise: { connected: true } }, programVerified: true });
  const top3 = sources.find((source) => source.name === 'Top 3');
  assert.equal(contextSourceHint(top3), 'No mentor priorities have been added');
  assert.equal(contextSourceHint(sources.find((source) => source.name === 'RISE')), 'Checked when interview begins');
  assert.equal(contextSourceHint({ name: 'RISE', connected: true, available: false }), 'Select a verified program first');
});

test('Admin connector readouts distinguish configuration from positive subject-data acceptance', () => {
  const facts = buildOwnerIntegrationFacts({ fileVault: { connected: true }, rise: { connected: true }, storyForge: { connected: false } });
  assert.equal(facts[0].value, 'CONFIGURED · SUBJECT DATA CHECKED AT START');
  assert.equal(facts[1].state, 'ready');
  assert.equal(facts[2].value, 'NOT CONNECTED');
});

test('normal AI Home and navigation entries configure before device readiness', () => {
  const html = readFileSync(new URL('../../public/studio/index.html', import.meta.url), 'utf8');
  const aiEntries = [...html.matchAll(/<button\b[^>]*data-launch-mode="ai"[^>]*>[\s\S]*?<\/button>/gu)]
    .map(match => match[0]).filter(markup => /(?:nav-item|practice-card instant)/u.test(markup));
  assert.equal(aiEntries.length, 2);
  for (const entry of aiEntries) {
    assert.match(entry, /data-(?:nav|goto)="newsession"/u);
    assert.match(entry, /data-builder-step="0"/u);
    assert.doesNotMatch(entry, /data-(?:nav|goto)="devicecheck"/u);
  }
});

test('practice launch preserves chosen mode and displays the selected question before recording', () => {
  assert.deepEqual(buildBuilderLaunchOrder('practice'), ['practice', 'ai']);
  assert.deepEqual(buildBuilderLaunchOrder('ai'), ['ai', 'practice']);
  assert.equal(buildPracticeQuestionLabel({ canonical_text: 'Tell me about yourself.' }), 'Tell me about yourself.');
  assert.equal(buildPracticeQuestionLabel(), 'Free practice');
});

test('general practice and AI mock can continue without inventing a program', () => {
  for (const launchMode of ['practice', 'ai']) {
    const wizard = { launchMode, program: '', programId: null, programVerified: false, contextSources: [] };
    const before = structuredClone(wizard);
    assert.deepEqual(buildBuilderStepAction({ step: 'program', wizard }), {
      enabled: true, label: 'Continue',
    });
    assert.deepEqual(wizard, before);
    assert.equal(buildContextSources({ programVerified: wizard.programVerified,
      contextCapabilities: { rise: { connected: true } } }).find(source => source.name === 'RISE').available, false);
  }
});

test('program navigation preserves selected/manual context and required question gates', () => {
  for (const wizard of [
    { program: 'Manual program', programId: null, programVerified: false },
    { program: 'Verified program', programId: 'owner-program-id', programVerified: true },
  ]) {
    const before = structuredClone(wizard);
    assert.deepEqual(buildBuilderStepAction({ step: 'program', wizard }), { enabled: true, label: 'Continue' });
    assert.deepEqual(wizard, before);
  }
  assert.equal(buildBuilderStepAction({ step: 'questions', questionCount: 0 }).enabled, false);
  assert.equal(buildBuilderStepAction({ step: 'readiness', questionCount: 0 }).enabled, false);
  assert.equal(buildBuilderStepAction({ step: 'readiness', questionCount: 1 }).enabled, true);
  assert.equal(buildBuilderStepAction({ step: 'goal', wizard: {} }).enabled, false);
});

test('builder promises device review before either launch mode', () => {
  assert.equal(buildBuilderLaunchLabel({ mode: 'ai', devicesReady: true }), 'Review devices and start AI interview ▸');
  assert.equal(buildBuilderLaunchLabel({ mode: 'practice', devicesReady: true }), 'Review devices and begin practice ▸');
  assert.equal(buildBuilderLaunchLabel({ mode: 'ai', devicesReady: false }), 'Check devices for AI interview ▸');
  assert.equal(buildBuilderLaunchLabel({ mode: 'practice', devicesReady: false }), 'Check devices for self practice ▸');
});

test('Results continuation follows the saved interview mode and Admin review scope', () => {
  assert.deepEqual(buildResultsNextAction({ interviewerProvider: 'openai-gpt-live', launchMode: 'practice' }), {
    label: 'Plan another AI interview ▸', destination: 'newsession', launchMode: 'ai',
  });
  assert.deepEqual(buildResultsNextAction({ interviewerProvider: 'missionmed-static', launchMode: 'ai' }), {
    label: 'Practice another question ▸', destination: 'training', launchMode: 'practice',
  });
  assert.deepEqual(buildResultsNextAction({ reviewScope: 'admin', interviewerProvider: 'openai-gpt-live' }), {
    label: 'Back to student library ▸', destination: 'mentor', launchMode: null,
  });
});

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
  assert.equal(reviewEvidenceCopy('UNAVAILABLE — KEEP SPEAKING TO ESTABLISH YOUR RANGE', { role: 'admin', reviewScope: 'admin' }), 'UNAVAILABLE — INSUFFICIENT STUDENT SPEECH TO ESTABLISH A RANGE');
  assert.equal(reviewEvidenceCopy('+0.2 vs your baseline', { role: 'admin', reviewScope: 'admin' }), "+0.2 vs the student's baseline");
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
