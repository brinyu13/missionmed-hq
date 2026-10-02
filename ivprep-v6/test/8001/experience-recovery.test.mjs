import test from 'node:test';
import assert from 'node:assert/strict';
import { interviewTeachingPolicy, InterviewProgression, CLOSING_QUESTION, substantiveQuestionPlan } from '../../public/capabilities/interview-progression.mjs';
import { AnalyticsPreview } from '../../public/capabilities/analytics-preview.mjs';
import { MeasurementTimeline, timelineValueAt } from '../../public/studio/flight-recorder-view.mjs';
import { serializeAnalyticsEnvelope } from '../../public/analytics/event-contract.mjs';
import { SmilePatternEventDetector } from '../../public/analytics/smile-pattern.mjs';
import { LiveInterviewSession } from '../../public/capabilities/live-interview.mjs';
import { readFileSync } from 'node:fs';

for (const count of [1, 3, 5, 30]) test('native policy preserves substantive target ' + count + ' and separate closing', () => {
  const policy = interviewTeachingPolicy(count);
  assert.ok(policy.includes('exactly ' + count + ' planned substantive questions'));
  assert.ok(policy.includes(CLOSING_QUESTION));
  assert.match(policy, /does NOT count against the substantive target/);
  assert.match(policy, /opening question is substantive question 1/);
  assert.match(policy, /Adaptive follow-ups do not consume/);
});
test('native instructions cover hook, no-hook, interruption, multiple candidate questions and sign-off', () => {
  const policy = interviewTeachingPolicy(3);
  for (const text of ['teaching moment with my son', 'What happened?', 'Do not always ask a follow-up',
    'silence, trailing audio', 'one or more candidate questions', 'Any other questions?', 'do not invent program details',
    'PROFESSIONAL SIGN-OFF', 'Do not claim the recording is saved']) assert.ok(policy.includes(text), text);
  // Prompt contract coverage, not a claim that a real model obeyed it audibly.
});
test('closing action is idempotent; fragments/silence have no state transition', () => {
  const progression = new InterviewProgression();
  assert.equal(progression.requestClosing(), null);
  progression.start();
  assert.equal(progression.phase, 'CORE_QUESTIONS');
  assert.ok(progression.requestClosing().includes(CLOSING_QUESTION));
  assert.equal(progression.requestClosing(), null);
  progression.finish();
  assert.equal(progression.requestClosing(), null);
  progression.reset(); assert.equal(progression.phase, 'READY');
});
test('selected closing question is never opening or a substantive slot', () => {
  const closing = { question_id: 'MR142-004', tags: ['CLOSING'] };
  const core = { question_id: 'CORE-01' };
  assert.deepEqual(substantiveQuestionPlan([closing, core]), [core]);
  assert.deepEqual(substantiveQuestionPlan([core, closing]), [core]);
  assert.deepEqual(substantiveQuestionPlan([closing]), []);
});
test('closing uses native instruction append without extra playback or hangup', () => {
  const sent = [];
  const live = new LiveInterviewSession({ createSession() {}, endSession() { throw Error('must not stop'); }, PeerConnection: class {} });
  live.channel = { readyState: 'open', send: text => sent.push(JSON.parse(text)) };
  assert.throws(() => live.requestClosing('closing'), /not connected/);
  live.state = 'active'; live.requestClosing(CLOSING_QUESTION);
  assert.equal(live.requestClosing(CLOSING_QUESTION), false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'session.instructions.append');
  assert.equal(sent[0].delegation_id, null);
});
test('calibration is bounded, separate, cancellable and never finalizes a recorded answer', () => {
  const actions = []; const timers = new Map(); let next = 0;
  const preview = new AnalyticsPreview({
    analytics: { beginAnswer: () => actions.push('begin'), abandonAnswer: () => actions.push('abandon'),
      beginFaceBaseline: () => actions.push('baseline'), endFaceBaseline: () => actions.push('baseline-end') },
    setTimer: (fn, ms) => { timers.set(++next, { fn, ms }); return next; },
    clearTimer: id => timers.delete(id),
  });
  assert.equal(preview.start({}), true); assert.equal(preview.start({}), false);
  assert.deepEqual([...timers.values()].map(t => t.ms), [5000, 30000]);
  [...timers.values()].find(t => t.ms === 30000).fn();
  assert.equal(preview.active, false); assert.equal(timers.size, 0);
  assert.equal(actions.filter(a => a === 'abandon').length, 1);
  assert.equal(preview.stop(), false);
});
test('timeline persists only bounded scalars, gaps stay missing and survives JSON reload', () => {
  const timeline = new MeasurementTimeline();
  assert.equal(timeline.ingest({ modality: 'audio', speaking: true }, { VOICE_LEVEL: { available: true, dbfs: -20 } }, -1), false);
  timeline.ingest({ modality: 'audio', speaking: true, rawPcm: [1, 2] }, { VOICE_LEVEL: { available: true, dbfs: -20 } }, 0);
  timeline.ingest({ modality: 'vision', geometry: { secret: 'not persisted' } }, { HANDS: { available: true, left: true, right: false, moving: true } }, 10);
  const recovered = JSON.parse(serializeAnalyticsEnvelope({ flightRecorder: timeline.snapshot() })).flightRecorder;
  assert.equal(recovered.points[0].level, -20);
  assert.equal(recovered.points[1].hands, 1);
  assert.equal(timelineValueAt(recovered.points, 'voice', 4000), null);
  assert.doesNotMatch(JSON.stringify(recovered), /rawPcm|secret|geometry/);
  for (let i = 1; i < 2000; i++) timeline.ingest({ modality: 'audio', available: false }, {}, i * 1000);
  assert.equal(timeline.points.length, 1800); assert.equal(timeline.truncated, true);
  assert.ok(serializeAnalyticsEnvelope({ flightRecorder: timeline.snapshot() }).length < 256000);
});
test('calibration cannot replace a recorded lifecycle and pending navigation cancels start', () => {
  let lifecycle = 'RUNNING'; let begins = 0;
  const preview = new AnalyticsPreview({ analytics: { beginAnswer() { begins++; } },
    canStart: () => !['STARTING', 'RUNNING', 'FINISHING', 'SAVE_RETRY'].includes(lifecycle) });
  for (lifecycle of ['STARTING', 'RUNNING', 'FINISHING', 'SAVE_RETRY']) assert.equal(preview.start({}), false);
  assert.equal(begins, 0);
  const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(source, /view !== 'devicecheck'\) \{ \+\+signalPreviewGeneration/);
  assert.match(source, /await ensureVisibleVideoFrame\(\$\('#devicecheck-video'\)\);\s*if \(generation !== signalPreviewGeneration \|\| !canPreviewSignals\(\)\) return;/);
  assert.match(source, /canStart: canPreviewSignals/);
});
test('default preview timers preserve the browser global receiver', () => {
  const originalSet = globalThis.setTimeout; const originalClear = globalThis.clearTimeout;
  let scheduled = 0; let cleared = 0;
  globalThis.setTimeout = function () { assert.equal(this, globalThis); return ++scheduled; };
  globalThis.clearTimeout = function () { assert.equal(this, globalThis); cleared++; };
  try {
    const preview = new AnalyticsPreview({ analytics: { beginAnswer() {}, abandonAnswer() {} } });
    assert.equal(preview.start({}), true); preview.stop();
    assert.equal(scheduled, 2); assert.equal(cleared, 2);
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
test('smile event count survives bounded retention and release duration is observed', () => {
  const detector = new SmilePatternEventDetector({ maximumEvents: 1, config: {
    smileOnDelta: .15, smileOffDelta: .07, smileMinimumDurationMs: 200, smileRefractoryMs: 0,
  } });
  detector.setBaseline(.1);
  for (const origin of [0, 1000]) {
    detector.ingest({ atMs: origin, bilateral: .4 });
    detector.ingest({ atMs: origin + 250, bilateral: .4 });
    detector.ingest({ atMs: origin + 600, bilateral: .1 });
  }
  assert.equal(detector.summary().eventCount, 2);
  assert.equal(detector.summary().retainedEventCount, 1);
  assert.equal(detector.summary().events[0].durationMs, 600);
  assert.equal(detector.summary().events[0].complete, true);
});
test('tracking gap cannot manufacture continuous smile duration', () => {
  const detector = new SmilePatternEventDetector({ config: {
    smileOnDelta: .15, smileOffDelta: .07, smileMinimumDurationMs: 300, smileRefractoryMs: 0,
  } });
  detector.setBaseline(.1);
  detector.ingest({ atMs: 0, bilateral: .4 });
  detector.ingest({ atMs: 5000, bilateral: .1 });
  assert.equal(detector.summary().eventCount, 0);
});
