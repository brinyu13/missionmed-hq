import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('actual Builder handlers clear hidden pressure/focus and prior-room Analytics override', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const state = { wizard: { goal: 'Guided Mock IV Practice', focus: 'Explain the impact', pressurePractice: true,
    duration: 15, contextSources: [], interviewMode: 'Interview Mode' }, room: { showAnalytics: false },
    durable: {}, interviewSet: [], targetQuestions: 5 };
  const choices = new Map();
  class Element {
    constructor() { this.children = []; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    addEventListener() {}
    setAttribute() {}
  }
  let renders = 0;
  const dependencies = { state, el: () => new Element(), choiceButton: options => { choices.set(options.label, options); return new Element(); },
    renderWizard: () => { renders += 1; }, buildContextSources: () => [], contextSourceHint: () => '' };
  const load = (start, end) => new Function(...Object.keys(dependencies),
    `${source.slice(source.indexOf(start), source.indexOf(end))}; return ${start.split(' ')[1].split('(')[0]};`)(...Object.values(dependencies));
  const goal = load('function renderGoalStep(', '\nfunction renderQuestionStep(');
  goal(new Element());
  choices.get('Individual Question').onClick();
  assert.equal(state.wizard.pressurePractice, false);
  assert.equal(state.wizard.focus, '');
  assert.equal(state.targetQuestions, 1);
  choices.get('Guided Mock IV Practice').onClick();
  assert.equal(state.wizard.pressurePractice, false, 'returning must not restore invisible pressure');
  const environment = load('function renderEnvironmentStep(', '\nfunction readinessRows(');
  environment(new Element());
  choices.get('Coached / Live Analytics Mode').onClick();
  assert.equal(state.wizard.interviewMode, 'Coached / Live Analytics Mode');
  assert.equal(state.room.showAnalytics, null);
  state.room.showAnalytics = true;
  choices.get('Interview Mode').onClick();
  assert.equal(state.wizard.interviewMode, 'Interview Mode');
  assert.equal(state.room.showAnalytics, null);
  assert.equal(renders, 4);
});

test('one-prompt source-ready detail enables analysis without inventing candidate verification', () => {
  const detail = { id: 'p1', sessionType: 'quick', interviewerProvider: 'missionmed-static', recording: { id: 'r1' },
    analysisAvailability: { status: 'READY', workflow: 'SELF_PRACTICE', sessionId: 'p1', replayRecordingId: 'r1' },
    spine: { candidateAttribution: { status: 'UNVERIFIED' } } };
  assert.equal(buildCandidateAnalysisState(detail).available, true);
  assert.equal(detail.spine.candidateAttribution.status, 'UNVERIFIED');
  for (const mutate of [d => { d.interviewerProvider = 'openai-gpt-live'; },
    d => { d.recording.id = 'other'; }, d => { d.analysisAvailability.sessionId = 'other'; },
    d => { d.analysisAvailability.status = 'AVAILABLE'; }]) {
    const changed = structuredClone(detail); mutate(changed);
    assert.equal(buildCandidateAnalysisState(changed).available, false);
  }
});

test('Admin review remains read-only even with an available source-bound result and a stale retry control', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.match(/async function analyzeLastAnswer[\s\S]*?(?=\nfunction renderHomeCorpus)/)[0];
  const binding = { status: 'SOURCE_BOUND', assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', biometricIdentity: 'UNVERIFIED',
    sourceRecordingId: 'mic', replayRecordingId: 'r1' };
  const detail = { id: 's1', sessionType: 'question', interviewerProvider: 'missionmed-static', questionId: 'CORE-01', questionText: 'Prompt',
    recording: { id: 'r1' }, analysisAvailability: { status: 'AVAILABLE', workflow: 'SELF_PRACTICE', sessionId: 's1', replayRecordingId: 'r1', semanticRetryAvailable: true },
    contextAnalysis: { sessionId: 's1', question: { questionId: 'CORE-01', canonicalText: 'Prompt' }, sourceBinding: binding },
    spine: { sourceBinding: binding, candidateAttribution: { status: 'UNVERIFIED' } } };
  assert.equal(buildCandidateAnalysisState(detail).available, true);
  let calls = 0;
  const state = { lastSaved: { persisted: true, reviewScope: 'admin', session: { id: 's1', questionId: 'CORE-01' },
    recording: { recording: { id: 'r1' } }, analytics: { answerId: 'a1' }, sessionDetail: detail },
    durable: { analyze: async () => { calls += 1; } } };
  const analyze = new Function('state', '$', 'isAdminReview', 'buildCandidateAnalysisState', `return ${implementation};`)(
    state, () => null, saved => saved.reviewScope === 'admin', buildCandidateAnalysisState);
  await analyze(); assert.equal(calls, 0);
  assert.match(source, /attribution\.canGenerate && !isAdminReview\(state\.lastSaved\)/);
  const reviewed = state.lastSaved;
  state.lastSaved = { ...reviewed, reviewScope: 'own' };
  let resolve;
  state.durable.analyze = () => new Promise(done => { resolve = done; });
  const button = { disabled: false, innerHTML: '' };
  const run = new Function('state', '$', 'isAdminReview', 'buildCandidateAnalysisState', 'adminReviewGate',
    'mayPresentSavedReview', 'renderContextEvidence', `return ${implementation};`)(state, () => button,
    saved => saved.reviewScope === 'admin', buildCandidateAnalysisState, {},
    ({ saved, currentSaved }) => saved === currentSaved, () => { throw Error('stale response rendered'); });
  const pending = run();
  state.lastSaved = reviewed;
  resolve({ persistence: { transcript: false } });
  await pending;
  assert.equal(button.disabled, true, 'late own-session completion must not re-enable Admin provider control');
});

import {
  buildContextSources,
  contextSourceHint,
  buildOwnerIntegrationFacts,
  buildPracticeEntryIntent,
  resolveAdminStudentSelection,
  buildAdminStudentProgress,
  buildComparisonSelection,
  buildTeachingComparison,
  buildEvidenceMomentLinks,
  buildNameUseReview,
  buildCandidateAnalysisState,
  debriefConfidenceCopy,
  buildInterviewerSelectionLabel,
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

function teachingDetail(id, startMs = 1000) {
  const binding = { status: 'SOURCE_BOUND', sourceRecordingId: `mic-${id}`, replayRecordingId: `replay-${id}`,
    assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', biometricIdentity: 'UNVERIFIED' };
  return { id, ownerSubject: 'wp:1', state: 'saved', sessionType: 'question', interviewerProvider: 'missionmed-static',
    questionId: 'CORE-10', questionText: 'Tell me about an error.',
    recording: { id: binding.replayRecordingId, sessionId: id, status: 'saved', recordingRole: 'conversation', durationMs: 20_000 },
    analysisAvailability: { status: 'AVAILABLE', workflow: 'SELF_PRACTICE', sessionId: id, replayRecordingId: binding.replayRecordingId },
    spine: { sourceBinding: binding, candidateAttribution: { status: 'UNVERIFIED' }, setupPrompt: {
      schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', approval: 'ACTIVE_AT_SELECTION',
      questionId: 'CORE-10', version: 1, text: 'Tell me about an error.' } },
    contextAnalysis: { sessionId: id, sourceBinding: binding,
      question: { questionId: 'CORE-10', revision: 1, canonicalText: 'Tell me about an error.' },
      transcript: { status: 'AVAILABLE', segments: [{ id: 'seg-1', startMs, endMs: startMs + 1000, text: 'I checked the dose.' }] },
      analysis: { status: 'AVAILABLE', score: .75, coverage: .8, limitations: ['Synthetic contract fixture; no model-quality acceptance.'],
        coachingPatterns: [{ facet: 'specificity', polarity: 'weakness', text: 'Name the action you took.', transcriptSegmentIds: ['seg-1'] }] } } };
}

const teachingComparison = (baseline, current, extra = {}) => buildTeachingComparison({ baseline, current,
  subject: 'wp:1', baselineId: 'earlier', currentId: 'later', ...extra });

test('teaching comparison retains two exact replay offsets and cited coaching without inferring improvement', () => {
  const baseline = teachingDetail('earlier', 1000); const current = teachingDetail('later', 7000);
  const original = structuredClone([baseline, current]);
  const comparison = teachingComparison(baseline, current);
  assert.equal(comparison.available, true);
  for (const [side, id, offset] of [[comparison.baseline, 'earlier', 1000], [comparison.current, 'later', 7000]]) {
    assert.equal(side.sessionId, id); assert.equal(side.recordingId, `replay-${id}`);
    assert.equal(side.sourceRecordingId, `mic-${id}`); assert.equal(side.durationMs, 20_000);
    assert.deepEqual(side.question, { questionId: 'CORE-10', revision: 1, canonicalText: 'Tell me about an error.' });
    assert.equal(side.coaching.improvement.text, 'Name the action you took.');
    assert.deepEqual(side.coaching.drill.refs, ['seg-1']);
    assert.equal(side.moments.length, 1); assert.equal(side.moments[0].startMs, offset);
    assert.equal(side.moments[0].endMs, offset + 1000); assert.equal(side.moments[0].available, true);
    assert.equal(Object.isFrozen(side), true);
  }
  assert.match(comparison.limitation, /not measured improvement/);
  assert.match(comparison.limitation, /not biometric/);
  assert.equal(Object.hasOwn(comparison, 'improved'), false);
  assert.deepEqual([baseline, current], original);
});

test('teaching comparison requires expected distinct IDs and explicit exact ownership', () => {
  for (const extra of [{ subject: null }, { subject: 'wp:2' }, { baselineId: null }, { baselineId: 'wrong' },
    { currentId: 'wrong' }, { currentId: 'earlier' }]) {
    assert.equal(teachingComparison(teachingDetail('earlier'), teachingDetail('later'), extra).available, false);
  }
  for (const change of [d => { delete d.ownerSubject; }, d => { d.ownerSubject = 'wp:2'; },
    d => { d.id = 'wrong'; }, d => { d.recording.sessionId = 'wrong'; },
    d => { d.recording.id = 'replay-earlier'; }, d => { d.contextAnalysis.sourceBinding.sourceRecordingId = 'mic-earlier'; }]) {
    const current = teachingDetail('later'); change(current);
    assert.equal(teachingComparison(teachingDetail('earlier'), current).available, false);
  }
});

test('teaching comparison rejects missing or changed prompt identity, version and mode', () => {
  for (const change of [d => { d.contextAnalysis.question.revision = 2; d.spine.setupPrompt.version = 2; },
    d => { delete d.contextAnalysis.question.revision; }, d => { d.contextAnalysis.question.revision = '1'; },
    d => { d.spine.setupPrompt.version = 2; }, d => { delete d.spine.setupPrompt; },
    d => { d.contextAnalysis.question.questionId = d.questionId = d.spine.setupPrompt.questionId = 'CORE-11'; },
    d => { d.contextAnalysis.question.canonicalText = d.questionText = d.spine.setupPrompt.text = 'Changed prompt'; },
    d => { d.sessionType = 'quick'; }, d => { d.sessionType = 'mock'; },
    d => { d.interviewerProvider = 'openai-gpt-live'; }, d => { d.state = 'active'; }]) {
    const current = teachingDetail('later'); change(current);
    assert.equal(teachingComparison(teachingDetail('earlier'), current).available, false);
  }
  const left = teachingDetail('earlier'); const right = teachingDetail('later');
  left.sessionType = right.sessionType = 'quick';
  assert.equal(teachingComparison(left, right).available, true);
});

test('teaching comparison never promotes legacy or unavailable/native evidence into coaching', () => {
  for (const change of [d => { delete d.contextAnalysis; }, d => { d.analysisAvailability.status = 'READY'; },
    d => { d.contextAnalysis.analysis.status = 'UNAVAILABLE'; }, d => { d.contextAnalysis.transcript.status = 'UNAVAILABLE'; },
    d => { d.contextAnalysis.sourceBinding.assurance = 'PROVIDER_ATTESTED'; },
    d => { d.contextAnalysis.sourceBinding.biometricIdentity = 'VERIFIED'; },
    d => { d.spine.sourceBinding = null; }, d => { d.contextAnalysis.analysis.coachingPatterns = []; },
    d => { d.recording.recordingRole = 'candidate_audio'; }, d => { d.recording.status = 'uploading'; }]) {
    const current = teachingDetail('later'); change(current);
    current.liveTranscript = { status: 'AVAILABLE', events: [{ text: 'Native fragment', approximate: true }] };
    assert.equal(teachingComparison(teachingDetail('earlier'), current).available, false);
  }
});

test('teaching comparison rejects ambiguous, missing, forged and out-of-range cited moments without clamping', () => {
  for (const change of [d => { d.contextAnalysis.transcript.segments.push({ id: 'seg-1', startMs: 4000, endMs: 5000 }); },
    d => { d.contextAnalysis.transcript.segments = []; }, d => { d.contextAnalysis.transcript.segments[0].startMs = null; },
    d => { d.contextAnalysis.transcript.segments[0].startMs = '1000'; },
    d => { d.contextAnalysis.transcript.segments[0].startMs = -1; },
    d => { d.contextAnalysis.transcript.segments[0].endMs = 1000; },
    d => { d.contextAnalysis.transcript.segments[0].endMs = 20_001; },
    d => { d.recording.durationMs = null; }, d => { d.recording.durationMs = '20000'; },
    d => { d.contextAnalysis.analysis.coachingPatterns[0].transcriptSegmentIds = ['absent']; },
    d => { const ref = 'x'.repeat(96); d.contextAnalysis.transcript.segments[0].id = ref;
      d.contextAnalysis.analysis.coachingPatterns[0].transcriptSegmentIds = [`${ref}overlong`]; }]) {
    const current = teachingDetail('later'); change(current);
    const comparison = teachingComparison(teachingDetail('earlier'), current);
    assert.equal(comparison.available, false); assert.equal(Object.hasOwn(comparison, 'current'), false);
  }
});

test('teaching comparison retains every bounded citation across strength and improvement without an eight-ref truncation', () => {
  const baseline = teachingDetail('earlier'); const current = teachingDetail('later');
  for (const detail of [baseline, current]) {
    detail.contextAnalysis.transcript.segments = Array.from({ length: 16 }, (_, index) => ({
      id: `seg-${index + 1}`, startMs: index * 1000, endMs: index * 1000 + 500 }));
    detail.contextAnalysis.analysis.coachingPatterns = [
      { facet: 'structure', polarity: 'strength', text: 'Names the sequence.',
        transcriptSegmentIds: detail.contextAnalysis.transcript.segments.slice(0, 8).map(segment => segment.id) },
      { facet: 'specificity', polarity: 'weakness', text: 'Name your contribution.',
        transcriptSegmentIds: detail.contextAnalysis.transcript.segments.slice(8).map(segment => segment.id) },
    ];
  }
  const comparison = teachingComparison(baseline, current);
  assert.equal(comparison.available, true);
  assert.equal(comparison.current.moments.length, 16);
  assert.equal(comparison.current.moments.at(-1).ref, 'seg-16');
  assert.equal(comparison.current.moments.at(-1).startMs, 15_000);
});

test('saved name observations cold-reload from exact selected detail, never actor/Builder state', () => {
  const payload = { sessionId: 'selected', nameUseCoaching: { schema: 'ivoc.name-use.v1', enabled: true,
    source: 'manual', name: 'Dr. Sample', sessionId: 'selected' } };
  const detail = { id: 'selected', ownerSubject: 'test:subject', recording: { durationMs: 3000 },
    results: { payload }, spine: { candidateAttribution: { status: 'VERIFIED' }, turns: [{ speaker: 'student', startMs: 100, endMs: 800,
      transcript: { canonical_ref: 'transcript:test#seg-1', text: 'Thank you Dr. Sample.' } }] } };
  const saved = JSON.parse(JSON.stringify({ reviewScope: 'admin', session: { id: 'selected', ownerSubject: 'test:subject' },
    sessionDetail: detail, envelope: { sessionId: 'actor-attempt', nameUseCoaching: { ...payload.nameUseCoaching, name: 'Actor name' } } }));
  const view = buildNameUseReview(saved);
  assert.equal(view.status, 'AVAILABLE'); assert.equal(view.name, 'Dr. Sample');
  assert.equal(view.moments[0].label, 'First recording third');
  assert.equal(buildEvidenceMomentLinks(view.replayEvidence, ['seg-1'], 3000)[0].available, true);
  assert.match(view.copy, /Manually supplied/); assert.doesNotMatch(view.copy, /Actor name/);
  assert.equal(buildNameUseReview({ ...saved, sessionDetail: { ...detail, id: 'actor-attempt' } }).status, 'UNASSESSED');
  assert.equal(buildNameUseReview({ ...saved, sessionDetail: { ...detail, ownerSubject: 'test:other' } }).status, 'UNASSESSED');
  assert.equal(buildNameUseReview(null).status, 'UNASSESSED');
  const missing = { ...saved, sessionDetail: { ...detail, recording: { durationMs: null } } };
  const unavailable = buildNameUseReview(missing);
  assert.equal(unavailable.moments[0].label, 'Recording third unavailable');
  assert.equal(buildEvidenceMomentLinks(unavailable.replayEvidence, ['seg-1'], 3000)[0].available, false);
});

test('actual Results name-use wiring uses saved evidence and existing guarded replay, with default-off Builder opt-in', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(source, /interviewerName: '', nameUseCoaching: false/);
  assert.match(source, /checkbox\.addEventListener\('change', \(\) => \{ state\.wizard\.nameUseCoaching = checkbox\.checked;/);
  const body = source.slice(source.indexOf('function renderContextEvidence('), source.indexOf('function renderEvidenceMomentLinks('));
  assert.match(body, /buildNameUseReview\(state\.lastSaved\)/);
  assert.match(body, /renderEvidenceMomentLinks\(nameUse\.replayEvidence, \[moment\.segmentId\]\)/);
  assert.doesNotMatch(body, /state\.wizard\.interviewerName/);
});

test('actual Results render clears private name observations when saved review is cleared', () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.slice(source.indexOf('function renderContextEvidence('), source.indexOf('function renderEvidenceMomentLinks('));
  const element = (tag, className = '', text = '') => ({ tag, className, textContent: text, children: [],
    append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; } });
  const host = element('div'); const replayCalls = [];
  const state = { role: 'admin', wizard: { interviewerName: 'Actor Builder name' }, lastSaved: {
    reviewScope: 'admin', session: { id: 'selected' }, sessionDetail: { id: 'selected', recording: { durationMs: 3000 },
      results: { payload: { sessionId: 'selected', nameUseCoaching: { schema: 'ivoc.name-use.v1', enabled: true,
        source: 'manual', name: 'Dr. Saved', sessionId: 'selected' } } },
      spine: { candidateAttribution: { status: 'VERIFIED' }, turns: [{ speaker: 'student', startMs: 100, endMs: 500,
        transcript: { canonical_ref: 'transcript:test#seg-1', text: 'Thanks, Dr. Saved.' } }] } } } };
  const render = new Function('state', '$', 'el', 'buildNameUseReview', 'renderEvidenceMomentLinks', 'document',
    `return ${implementation};`)(state, () => host, element, buildNameUseReview,
    (evidence, refs) => { replayCalls.push([evidence, refs]); return element('button'); }, { createElement: element });
  const flatten = node => [node.textContent, ...node.children.map(flatten)].join(' ');
  render({ transcript: { status: 'UNAVAILABLE', reason: 'PENDING' } });
  assert.match(flatten(host), /Dr\. Saved/); assert.doesNotMatch(flatten(host), /Actor Builder name/);
  assert.deepEqual(replayCalls[0][1], ['seg-1']);
  assert.equal(buildEvidenceMomentLinks(replayCalls[0][0], ['seg-1'], 3000)[0].startMs, 100);
  state.lastSaved = null;
  render({ transcript: { status: 'UNAVAILABLE', reason: 'NO_SELECTED_ANSWER' } });
  assert.doesNotMatch(flatten(host), /Dr\. Saved|Thanks/);
  assert.match(flatten(host), /Not assessed/);
});

test('retry retains owner question and goal without reusing stale context authority', () => {
  const question = { question_id: 'Q1', canonical_text: 'Why this program?' };
  const detail = { id: 'own', sessionType: 'mock', interviewerProvider: 'openai-gpt-live', retryContext: {
    schema: 'ivoc.retry-intent.v1', sourceSessionId: 'own', questionId: 'Q1', questionText: question.canonical_text,
    goal: 'Guided Mock IV Practice', pressurePractice: true, program: 'Original program',
    interviewer: 'Associate Program Director', interviewerStyle: 'Eagle',
    contextSources: ['CV', 'RISE', 'StoryForge', 'private-unrecognized'],
  } };
  const retry = buildRetryIntent({ detail, catalog: [question], drill: { text: 'Name your own contribution.' } });
  assert.equal(retry.available, true);
  assert.equal(retry.question, question);
  assert.equal(retry.wizard.goal, 'Guided Mock IV Practice');
  assert.equal(retry.wizard.retrySessionType, 'mock');
  assert.equal(retry.wizard.pressurePractice, true);
  assert.equal(retry.wizard.interviewer, 'Associate Program Director');
  assert.equal(retry.wizard.interviewerStyle, 'Eagle');
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
  const historical = buildRetryIntent({ detail: { ...detail, retryContext: { ...detail.retryContext, interviewerStyle: null } }, catalog: [question] });
  assert.equal(historical.wizard.interviewerStyle, 'Owl');
  assert.match(historical.notes.join(' '), /Original conversation style unavailable; using Owl/);
});

test('review and runtime identify the actual role and style through the same presentation adapter', () => {
  for (const interviewer of ['Program Director', 'Faculty', 'Chief Resident', 'Associate Program Director']) {
    for (const interviewerStyle of ['Dove', 'Peacock', 'Owl', 'Eagle']) {
      assert.equal(buildInterviewerSelectionLabel({ interviewer, interviewerStyle }), `${interviewer} · ${interviewerStyle}`);
    }
  }
  assert.equal(buildInterviewerSelectionLabel({ interviewer: 'Unknown', interviewerStyle: 'Fake' }), 'Interviewer');
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(source, /addSummaryRow\('Interviewer', buildInterviewerSelectionLabel\(state.wizard\)\)/);
  assert.match(source, /#room-interviewer-role'\).*buildInterviewerSelectionLabel\(state.wizard\)/);
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

test('uncalibrated model confidence is qualitative, not a precise student performance score', () => {
  for (const [label, expected] of [['HIGH', 'High'], ['MODERATE', 'Moderate'], ['LIMITED', 'Limited']]) {
    const input = Object.freeze({ label, score: .76, coverage: .9, coverageBasis: 'evidence_confidence' });
    const copy = debriefConfidenceCopy(input);
    assert.ok(copy.startsWith(`AI-estimated evidence confidence: ${expected}.`));
    assert.match(copy, /not a validated performance or readiness score/);
    assert.doesNotMatch(copy, /%|analysis strength|measured transcript coverage/);
    assert.equal(input.score, .76); assert.equal(input.coverage, .9);
    assert.equal(debriefConfidenceCopy({ label, score: NaN, coverage: Infinity }), copy);
  }
  for (const input of [undefined, null, {}, { label: '' }, { label: 'CERTAIN' }, { label: '__proto__' },
    { label: { toString: null } }, { label: ['HIGH'] }]) {
    const copy = debriefConfidenceCopy(input);
    assert.match(copy, /confidence is unavailable/);
    assert.doesNotMatch(copy, /%|NaN|undefined|CERTAIN|__proto__/);
  }
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
  const saved = { persisted: true, recording: { recording: { id: 'r1' } }, session: { id: 's1', questionId: 'q1' }, analytics: { answerId: 'a1' },
    sessionDetail: { spine: { candidateAttribution: { status: 'VERIFIED' } } } };
  const detail = { id: 's1', spine: { candidateAttribution: { status: 'VERIFIED' } } };
  const state = { lastSaved: saved, role: 'student', durable: { analyze: async () => ({ persistence: { transcript: true } }), api: { session: async () => detail } } };
  const rendered = []; const published = [];
  const analyze = new Function('state','$','isAdminReview','adminReviewGate','mayPresentSavedReview','renderContextEvidence','renderFilmRoomSpine','buildCandidateAnalysisState',
    `return ${implementation};`)(state, () => null, () => false, {},
    ({saved,currentSaved}) => saved === currentSaved, result => { rendered.push(state.lastSaved); published.push(result); }, () => {}, buildCandidateAnalysisState);
  await analyze();
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0], state.lastSaved);
  assert.equal(rendered[0].sessionDetail, detail);
  assert.notEqual(rendered[0], saved);
  state.lastSaved = saved;
  detail.spine.candidateAttribution.status = 'UNVERIFIED';
  await analyze();
  assert.equal(published.at(-1).transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(rendered.length, 2);
  state.lastSaved = saved;
  state.durable.analyze = async () => { state.lastSaved = null; return { persistence: { transcript: true } }; };
  await analyze();
  assert.equal(rendered.length, 2);
});

test('unverified candidate analysis is disabled and its actual action never calls the provider', async () => {
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const implementation = source.match(/async function analyzeLastAnswer[\s\S]*?(?=\nfunction renderHomeCorpus)/)[0];
  const results = [];
  const state = { lastSaved: { persisted: true, sessionDetail: { spine: { candidateAttribution: { status: 'UNVERIFIED' } } } },
    durable: { analyze: () => { throw new Error('must not process unknown speaker audio'); } } };
  const analyze = new Function('state', '$', 'buildCandidateAnalysisState', 'renderContextEvidence', `return ${implementation};`)(
    state, () => null, buildCandidateAnalysisState, value => results.push(value));
  await analyze();
  assert.equal(results[0].transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(buildCandidateAnalysisState().available, false);
  assert.match(buildCandidateAnalysisState().unavailableCopy, /recording and measured delivery signals remain available/);
  assert.match(source, /contextButton\.disabled = !\(attribution\.canGenerate/);
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
