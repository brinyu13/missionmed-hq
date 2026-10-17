// Synthetic integration contract, not acoustic/browser/clinical acceptance.
// Intended source path: ivprep-v6/test/8001/voice-first-journey.test.mjs.
// Only device, provider transport, account API and clock boundaries are fixtures.
// Recording bytes below are deliberately NOT an audio/video codec. Receipt timing
// locates provisional text; it does not establish speech onset/offset or turn yield.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionController } from '../../public/studio-fable/app/controller/session-controller.mjs';
import { DurableStudioSession } from '../../public/studio/durable-session.mjs';
import { AccountRecordingController } from '../../public/ivoc-standalone/app/recording.mjs';
import { ConversationRecordingMix } from '../../public/capabilities/conversation-recording.mjs';
import { GptLiveInterviewer } from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import { LiveInterviewSession } from '../../public/capabilities/live-interview.mjs';
import { NativeInterviewObserver } from '../../public/studio-fable/app/brain/native-observer.mjs';
import { defaultSettings, conductorConfig, toWizard } from '../../public/studio-fable/app/settings/interviewer.mjs';
import { buildLiveInterviewInstructions } from '../../server/providers/openai-live-session.mjs';
import { projectSavedAttempt, validReplaySeek, privatePlaybackUrl, retainedEvidenceReport } from '../../public/studio-fable/app/adapters/saved-review.mjs';
import { parseSavedReviewRoute, savedReviewHash } from '../../public/studio/review-scope.mjs';
import { bindSubject, state } from '../../public/studio-fable/app/state.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const OWNER = 'wp:1', FOREIGN = 'wp:2';
const QUESTION = { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.' };
const POLICY = { schema: 'ivoc.interview-policy.v1', version: 1, maxFollowUpsPerAnswer: 1, defaultFollowUpDepth: 1, defaultPressureEnabled: false };
const SCENARIOS = [
  { id: 'dove-guarded', style: 'Dove', answer: 'I took last year off for a medical situation and then applied. I prefer not to discuss those personal details.', follow: 'Of course. What would you like us to know about your clinical training?', reply: 'I completed my clinical rotations and particularly enjoyed working with the ward team.' },
  { id: 'owl-method', style: 'Owl', answer: 'I became the captain and medical director of a private ambulance service. Our results improved.', follow: 'How did you change the service, and what was your own contribution?', reply: 'I scheduled weekly case reviews with our team, tracked handoff errors and revised the handoff checklist.' },
  { id: 'peacock-tangent', style: 'Peacock', answer: 'I enjoy medicine and teaching. Also our soccer team won on Saturday and the trip home took three hours.', follow: 'Returning to your clinical experience, what did you learn from teaching on the ward?', reply: 'I learned to ask learners to explain their reasoning before offering my own explanation.' },
  { id: 'eagle-brisk', style: 'Eagle', pacing: 'Brisk', answer: 'I trained in Ohio, completed my rotations, and tutored junior students twice a week. I organized cases, collected feedback, and revised the sessions. That is my background.', follow: null, reply: null },
  { id: 'eagle-pressure', style: 'Eagle', pressure: true, answer: 'I led the quality project and reduced missed handoffs by half. Actually, our first measurement showed no improvement.', follow: 'What did the measurements show, and which part of the change was yours?', reply: 'The initial month was unchanged. After I revised the checklist, the next month improved. I should have distinguished those periods.' },
  { id: 'owl-interruption', style: 'Owl', interruption: true, answer: 'I led a teaching project with five students. I want to correct that: there were four students.', follow: 'Thank you for the correction. What did you change in your teaching?', reply: 'I asked each student to explain one case and adjusted the next lesson from their feedback.' },
];

class Track {
  constructor(kind, id) { Object.assign(this, { kind, id, readyState: 'live', enabled: true, muted: false, stops: 0 }); }
  stop() { this.stops++; this.readyState = 'ended'; }
}
class Stream {
  constructor(tracks) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
}
class AudioGraph {
  constructor() { this.state = 'running'; this.sources = []; this.outputs = []; this.destination = { audible: true }; }
  createMediaStreamDestination() { const out = { stream: new Stream([new Track('audio', 'mixed-' + this.outputs.length)]) }; this.outputs.push(out); return out; }
  createMediaStreamSource(stream) { const node = { stream, targets: [], disconnected: false, connect(target) { this.targets.push(target); }, disconnect() { this.disconnected = true; } }; this.sources.push(node); return node; }
}
// Device substitute only: real AccountRecordingController handles allocation,
// chunks, stop, upload, seal and timing. This byte marker cannot prove audibility.
class FixtureMediaRecorder extends EventTarget {
  static isTypeSupported() { return true; }
  constructor(stream, options) { super(); this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() {
    assert.equal(this.state, 'recording'); this.state = 'inactive';
    const e = new Event('dataavailable'); e.data = new Blob(['SYNTHETIC-NON-CODEC'], { type: this.mimeType });
    this.dispatchEvent(e); this.dispatchEvent(new Event('stop'));
  }
}

for (const [index, scenario] of SCENARIOS.entries()) test(`joined synthetic journey: ${scenario.id}`, { concurrency: false }, async t => {
  const globals = Object.fromEntries(['fetch', 'MediaRecorder', 'CustomEvent', 'document', 'localStorage'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => { for (const [k, descriptor] of Object.entries(globals)) { if (descriptor) Object.defineProperty(globalThis, k, descriptor); else delete globalThis[k]; } bindSubject(FOREIGN); });
  globalThis.CustomEvent ??= class extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } };
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, getElementById() { return null; } };
  globalThis.MediaRecorder = FixtureMediaRecorder;
  const localWrites = [];
  globalThis.localStorage = { getItem() { return null; }, setItem(k, v) { localWrites.push([k, v]); } };
  const calls = { creates: 0, recordings: 0, uploads: 0, seals: 0, saves: 0, starts: 0, stops: 0, playback: 0, detail: 0, provider: 0 };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://fixture.invalid/upload?part=1&parts=1');
    assert.equal(options.method, 'PUT'); assert.ok(options.body instanceof Blob);
    calls.uploads++; return { ok: true }; // Never forwards to native fetch.
  };
  const forbiddenProvider = () => { calls.provider++; throw new Error('provider access forbidden'); };
  let clock = 100, actor = OWNER, storage = null, native, mix, input, allocated, savedRecording;
  const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, recordingId = `fixture-recording-${index}`;
  const settings = { ...defaultSettings(), goal: 'Full IV Simulation', style: scenario.style, pressure: scenario.pressure === true,
    pacing: scenario.pacing || 'Normal', interruption: scenario.interruption === true, depth: 2, maxFollowUps: 2, targetQuestions: 1 };
  const wizard = toWizard(settings, { interviewPolicy: POLICY, contextSources: ['StoryForge'], program: { verified: true, name: 'Synthetic program', programId: 'fixture-program', programReleaseId: 'fixture-release' } });
  const context = { environment: 'MissionMed · coached analytics', goal: 'Full interview simulation', interviewer: 'Program Director · balanced',
    interviewerStyle: scenario.style, pressurePractice: scenario.pressure === true, program: 'General residency interview', questionIds: ['CORE-01'], targetQuestions: 1,
    followUpDepth: wizard.followUpDepth, maxFollowUps: wizard.maxFollowUps, interviewPolicyVersion: POLICY.version, interviewerPreferences: wizard.interviewerPreferences };
  const instructions = buildLiveInterviewInstructions(context, { receipt: 'ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@' + 'c'.repeat(64),
    actorBlock: 'AUTHORIZED APPLICATION CONTEXT\nSynthetic applicant: teaching project. Synthetic program: supervised ward teaching. No other facts supplied.', interviewPolicy: POLICY });
  assert.match(instructions, new RegExp(`INTERVIEWER STYLE: ${scenario.style}`));
  assert.match(instructions, /at most 1 substantive follow-up per answer/);
  assert.match(instructions, /not a renewed allowance after each follow-up answer/);
  assert.match(instructions, /withheld\/private details/);
  assert.match(instructions, /If the applicant interrupts, stop speaking and listen/);
  assert.match(instructions, /Never infer emotion, personality, diagnosis/);
  assert.match(instructions, /Do you have any questions for me/);
  assert.match(instructions, scenario.pressure ? /appropriately skeptical/ : /PRESSURE MODIFIER: Off/);
  assert.equal(wizard.followUpDepth, 1, 'even pressure/depth2 cannot raise server ceiling');

  const api = {
    identity: { subject: OWNER, admin: false },
    async bootstrap() { return { entitlement: { admitted: true }, identity: { subject: actor, admin: false }, interviewPolicy: POLICY, capabilities: { candidateAudioCapture: false } }; },
    async createSession(value) { calls.creates++; input = clone(value); allocated = { id, ownerSubject: OWNER, state: 'active', interviewerProvider: 'openai-gpt-live', questionId: 'CORE-01', questionText: QUESTION.canonical_text }; return clone(allocated); },
    async createRecording(sessionId) { assert.equal(sessionId, id); calls.recordings++; return { id: recordingId, uploadUrl: 'https://fixture.invalid/upload' }; },
    async sealRecording(value, seal) { assert.equal(value, recordingId); calls.seals++; savedRecording = { id: recordingId, status: 'saved', sessionId: id, ownerSubject: OWNER, durationMs: seal.durationMs }; return { recording: clone(savedRecording) }; },
    async saveResults(sessionId, envelope) { assert.equal(sessionId, id); calls.saves++; if (calls.saves === 1) throw new Error('synthetic-transient-save-failure'); storage = clone({ ...allocated, state: 'saved', recording: savedRecording, results: { payload: envelope } }); return { saved: true }; },
    async library(scope, projection) { assert.equal(scope, 'own'); assert.equal(projection, 'list'); return { scopeSubject: actor, sessions: storage ? [clone(storage)] : [] }; },
    async session(value) { assert.equal(value, id); calls.detail++; return clone(storage); },
    async playback(value) { assert.equal(value, recordingId); calls.playback++; return { recordingId, url: `/api/ivoc/v1/recordings/${recordingId}/playback` }; },
  };
  const account = { mode: 'REAL', subject: OWNER, role: 'student', api, liveInterviewAvailable: true,
    apiClient: { createLiveInterview: forbiddenProvider, endLiveInterview: forbiddenProvider, keepLiveInterviewPresence: forbiddenProvider } };
  const graph = new AudioGraph(), camera = new Track('video', 'camera'), microphone = new Track('audio', 'microphone'), remote = new Track('audio', 'native-remote');
  const stream = new Stream([camera, microphone]), wire = [], captions = [], observations = [];
  const observer = new NativeInterviewObserver({ questions: [QUESTION], config: conductorConfig(settings, { interviewPolicy: POLICY }), context: {}, now: () => clock }); observer.start();
  class NativeTransportFixture extends LiveInterviewSession {
    constructor(options) { super({ ...options, now: () => clock, PeerConnection: class {} }); native = this; }
    async start() {
      calls.starts++; this.state = 'active'; this.startedAtMs = clock;
      this.channel = { readyState: 'open', send: raw => wire.push(JSON.parse(raw)) };
      this.audioAuthority = 'configured'; this.emitTelemetry('configured');
      await this.onAuthoritativeAudioStream(new Stream([remote]));
      this.audioAuthority = 'bound'; this.emitTelemetry('bound'); return { synthetic: true };
    }
    async stop() { calls.stops++; this.onTranscript({ identity: 'late', speaker: 'applicant', text: 'STALE PRIVATE TEXT', final: true }); this.emitTelemetry('released'); this.state = 'closed'; }
  }
  const durable = new DurableStudioSession({ api, now: () => '2026-10-17T00:00:00Z', nowMs: () => clock, MediaStreamCtor: Stream,
    recordingFactory: options => new AccountRecordingController({ ...options, probePlayableDuration: async () => null }) });
  await durable.bootstrap();
  const controller = new SessionController({ mixFactory: options => (mix = new ConversationRecordingMix({ ...options, MediaStreamCtor: Stream })),
    liveFactory: options => new GptLiveInterviewer({ ...options, now: () => clock, LiveInterviewSessionCtor: NativeTransportFixture,
      onCaptions: groups => captions.push(clone(groups)), onTranscriptOverlap: event => observations.push(event),
      onTranscriptFragment: event => observer.ingestFragment(event) }) });
  controller.account = account; controller.durable = durable; controller.phase = 'READY';
  controller.engine = { stream, audioContext: graph, beginSession: async () => {}, destroy() {},
    finish: async () => ({ analytics: { schema: 'missionmed.ivprep.analytics.session.v1', durationMs: clock - 100, events: [] } }) };
  bindSubject(FOREIGN); bindSubject(OWNER);
  await controller.startSession({ mode: 'mock', question: QUESTION, interviewSet: [QUESTION], wizard, targetQuestions: 1, context, openingQuestion: QUESTION.canonical_text });
  assert.equal(controller.phase, 'LIVE'); assert.equal(calls.creates, 1); assert.equal(calls.recordings, 1);
  assert.equal(mix.diagnostics().interviewerAudio, true); assert.equal(mix.diagnostics().audibleOutputs, 0);
  assert.equal(graph.sources.length, 2); assert.ok(graph.sources.every(s => !s.targets.includes(graph.destination)));
  assert.equal(mix.remoteSource.targets.length, 1, 'interviewer cannot enter candidate-only tap');
  assert.equal(mix.remoteSource.targets[0], mix.destination);
  assert.throws(() => mix.attachAuthoritativeAudio(new Stream([new Track('audio', 'second-owner')])), /second interviewer/);
  assert.match(JSON.stringify(input), /fixture-program/); assert.match(JSON.stringify(input), /StoryForge/);
  const expected = [];
  const emit = (speaker, text, { overlap = false } = {}) => {
    clock += 2000; const n = expected.length, identity = `turn-${n}`, direction = speaker === 'interviewer' ? 'output' : 'input';
    const event = { type: `session.${direction}_transcript.delta`, event_id: `event-${n}`, delta: text,
      start_ms: clock - 100 - (overlap ? 2500 : 500), end_ms: clock - 100 };
    native.onEvent(event); native.onTranscript({ type: event.type, identity, speaker, text, final: false, sessionId: id });
    expected.push({ speaker: speaker === 'applicant' ? 'student' : speaker, text });
    const hint = observer.pendingHookContext(); if (hint && controller.live.appendHookContext(hint)) observer.hookContextSent(hint);
  };
  emit('interviewer', QUESTION.canonical_text); emit('applicant', scenario.answer);
  if (scenario.id === 'dove-guarded') assert.equal(observer.pendingHookContext(), null, 'withheld personal details must not generate an advisory probe');
  if (scenario.follow) { emit('interviewer', scenario.follow); emit('applicant', scenario.reply, { overlap: scenario.interruption }); }
  emit('interviewer', 'Do you have any questions for me?'); emit('applicant', 'No, thank you. That covers my questions.');
  emit('interviewer', 'Thank you for your time. Select Finish and save when you are ready.');
  assert.equal(wire.filter(e => e.type === 'session.instructions.append').length, 0, 'partial ASR does not force speech or a strong objective');
  assert.ok(wire.every(e => e.type === 'session.thinking.append'));
  assert.ok(wire.length <= 1, 'one advisory per planned question, not a fresh budget per answer');
  assert.ok(captions.flat().every(group => group.final === false));
  assert.ok([...durable.liveConversationTurns.values()].every(turn => turn.final === false));
  assert.equal(durable.recordLiveTranscript({ sessionId: 'foreign-session', speaker: 'student', text: 'FOREIGN PRIVATE TEXT' }), false);
  if (scenario.interruption) assert.ok(observations.length > 0, 'actual overlap observer receives overlapping fragments');
  // Synthetic scalar measurements test plumbing only, never calibrated inference.
  const record = { settings, samples: [{ t: 1, presence: 'TRACKED', facing: 70, hands: 'BOTH', state: 'ANSWERING', speaking: true, wpm: 125, pitch: null }],
    events: [{ t: 2, kind: 'gesture', label: 'Synthetic movement', state: 'ANSWERING' }], turns: [], hooks: [], calibrationUsed: false };
  const failed = await controller.finishSession({ record });
  assert.equal(failed.persisted, false); assert.equal(controller.phase, 'SAVE_FAILED'); assert.equal(storage, null);
  const retained = durable.pendingRecording, retainedAnalytics = controller.lastSave.analytics;
  assert.equal(calls.stops, 1); assert.equal(calls.uploads, 1); assert.equal(calls.seals, 1);
  actor = FOREIGN; assert.equal(await controller.retrySave(), null); assert.equal(calls.saves, 1);
  assert.equal(durable.pendingRecording, retained); assert.equal(controller.lastSave.analytics, retainedAnalytics);
  actor = OWNER; const saved = await controller.retrySave();
  assert.equal(saved.persisted, true); assert.equal(controller.phase, 'SAVED');
  assert.deepEqual([calls.starts, calls.creates, calls.recordings, calls.stops, calls.uploads, calls.seals, calls.saves, calls.provider], [1, 1, 1, 1, 1, 1, 2, 0]);
  assert.ok(mix.destroyed); assert.ok(graph.outputs.every(o => o.stream.getTracks()[0].stops === 1));
  const payload = storage.results.payload;
  assert.deepEqual(payload.liveConversation.turns.map(({ speaker, text }) => ({ speaker, text })), expected);
  assert.ok(payload.liveConversation.turns.every(turn => turn.timingBasis === 'MESSAGE_RECEIPT' && turn.finalization === 'CLIENT_FINISH'));
  assert.deepEqual(payload.audioAuthority.events.map(e => e.state), ['configured', 'bound', 'released']);
  assert.equal(payload.behavior, null); assert.deepEqual(payload.scores, {});
  assert.equal(payload.analytics.fable.calibrationUsed, false); assert.equal(payload.analytics.fable.samples[0].pitch, null);
  assert.doesNotMatch(JSON.stringify(storage), /STALE PRIVATE TEXT|FOREIGN PRIVATE TEXT/);
  assert.ok(localWrites.every(([, value]) => !value.includes(scenario.answer) && !value.includes(recordingId)), 'local settings storage receives no conversation or recording');

  // Cold boundary: discard all live controller/durable state and JSON roundtrip
  // the server fixture, then use NEW actual owners and fresh own-library reads.
  const persisted = JSON.stringify(storage); storage = JSON.parse(persisted);
  controller.account = null; controller.durable = null; controller.lastSave = null;
  bindSubject(FOREIGN); bindSubject(OWNER); assert.equal(state.attempts.length, 0);
  const cold = new SessionController(), coldDurable = new DurableStudioSession({ api }); await coldDurable.bootstrap();
  cold.account = account; cold.durable = coldDurable;
  const review = await cold.sessionDetail(id); assert.ok(review);
  for (const view of ['postanswer', 'filmroom']) {
    const route = parseSavedReviewRoute(savedReviewHash(view, review)); assert.deepEqual(route, { view, sessionId: id });
  }
  const projected = projectSavedAttempt(review, OWNER); assert.ok(projected); assert.equal(projected.recordingId, recordingId);
  assert.deepEqual(projected.turns.map(({ speaker, text }) => ({ speaker: speaker === 'applicant' ? 'student' : speaker, text })), expected);
  assert.ok(projected.turns.every(turn => !turn.canonical && turn.timing === 'message-receipt'));
  assert.equal(projected.samples[0].t, 1); assert.equal(projected.events[0].t, 2);
  assert.equal(projected.samples[0].pitch, null); assert.equal(retainedEvidenceReport(projected).available, true);
  for (const at of [0, projected.durationS / 2, projected.durationS]) assert.equal(validReplaySeek(at, projected.durationS), at);
  assert.equal(validReplaySeek(projected.durationS + 1, projected.durationS), null);
  const playback = await cold.playbackUrl(projected);
  assert.ok(privatePlaybackUrl(playback, recordingId, 'https://fixture.invalid/iv-prep-on-call/'));
  assert.equal(privatePlaybackUrl({ ...playback, url: 'https://foreign.invalid/play' }, recordingId, 'https://fixture.invalid/'), null);
  assert.equal(projectSavedAttempt(review, FOREIGN), null);
  const wrongRecording = clone(review); wrongRecording.sessionDetail.recording.ownerSubject = FOREIGN;
  assert.equal(projectSavedAttempt(wrongRecording, OWNER).recordingId, null);
  const missingLane = clone(review); delete missingLane.sessionDetail.results.payload.analytics.fable;
  const unavailable = projectSavedAttempt(missingLane, OWNER);
  assert.equal(unavailable.traceUnavailable, true); assert.deepEqual(unavailable.samples, []); assert.equal(retainedEvidenceReport(unavailable).available, false);
  const reads = calls.playback; actor = FOREIGN;
  await assert.rejects(cold.playbackUrl(projected), /account access changed/); assert.equal(calls.playback, reads);
  t.diagnostic('Synthetic joined contract only: no provider, decoded audio, browser reload, real roles, natural response quality or human calibration acceptance.');
});
