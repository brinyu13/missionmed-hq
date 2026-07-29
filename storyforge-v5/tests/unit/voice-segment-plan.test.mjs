import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { recordingConstants } from '../../server/recordings.mjs';

const appUrl = new URL('../../public/app.js', import.meta.url);

function extractFunction(source, name) {
  const candidates = [`async function ${name}(`, `function ${name}(`];
  const start = candidates
    .map((candidate) => source.indexOf(candidate))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `${name} must remain implemented in the real browser bundle`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} must have a normal function body`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`could not isolate ${name} from the browser bundle`);
}

async function frontendHarness() {
  const source = await readFile(appUrl, 'utf8');
  const planMatch = source.match(
    /const VOICE_SEGMENT_PLAN = Object\.freeze\(\[\s*(\d+)\s*,\s*(\d+)\s*\]\);/,
  );
  assert.ok(planMatch, 'browser bundle must declare the binding segment plan');
  const stored = [];
  const uploaded = [];
  const recorders = [];
  const timers = new Map();
  const timerDelays = [];
  let timerId = 0;
  let now = 0;

  class DeterministicRecorder extends EventTarget {
    constructor(stream, options) {
      super();
      this.stream = stream;
      this.mimeType = options.mimeType;
      this.state = 'inactive';
      recorders.push(this);
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      const chunk = new Event('dataavailable');
      Object.defineProperty(chunk, 'data', { value: new Blob(['voice-segment']) });
      this.dispatchEvent(chunk);
      this.state = 'inactive';
      this.dispatchEvent(new Event('stop'));
    }
  }

  const voiceState = {
    nextSegmentSeq: 0,
    segmentPlanMs: [Number(planMatch[1]), Number(planMatch[2])],
    stream: { active: true },
    durationMs: 0,
    segmentStartedAt: 0,
    segmentTimeout: 0,
    clockTimer: 0,
    recorder: null,
    segmentChunks: [],
    segmentMimeType: '',
    recordingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    uploadQueue: Promise.resolve(),
    closePromise: null,
    mode: 'rec',
    limitReached: false,
  };
  const window = {
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, callback);
      timerDelays.push(delay);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    setInterval() {
      return ++timerId;
    },
    clearInterval() {},
  };
  const context = vm.createContext({
    Blob,
    Date: { now: () => now },
    MediaRecorder: DeterministicRecorder,
    beginVoiceSegment: undefined,
    closeVoiceSegment: undefined,
    ensureVoiceStream: async () => {},
    scheduleCaptureDraftSave: () => {},
    storeVoiceSegment: async (record) => stored.push(record),
    supportedVoiceMimeType: () => 'audio/webm;codecs=opus',
    updateVoiceClock: () => {},
    uploadVoiceSegment: async (record) => uploaded.push(record),
    voiceDone: async () => {},
    voiceState,
    window,
  });
  vm.runInContext(
    `${extractFunction(source, 'beginVoiceSegment')}
     ${extractFunction(source, 'closeVoiceSegment')}
     globalThis.__beginVoiceSegment = beginVoiceSegment;
     globalThis.__closeVoiceSegment = closeVoiceSegment;`,
    context,
  );
  return {
    begin: context.__beginVoiceSegment,
    close: context.__closeVoiceSegment,
    plan: voiceState.segmentPlanMs,
    recorders,
    setNow(value) {
      now = value;
    },
    stored,
    timerDelays,
    uploaded,
    voiceState,
  };
}

test('frontend and backend share the binding 4-second opener and 15-second steady plan', async () => {
  const harness = await frontendHarness();
  assert.deepEqual(harness.plan, [4_000, 15_000]);
  assert.deepEqual([...recordingConstants.segmentPlanMs], [4_000, 15_000]);
});

test('the first boundary closes at 4 seconds and creates a fresh 15-second recorder', async () => {
  const harness = await frontendHarness();
  await harness.begin();
  assert.equal(harness.recorders.length, 1);
  assert.equal(harness.recorders[0].state, 'recording');
  assert.deepEqual(harness.timerDelays, [4_000]);

  harness.setNow(4_000);
  await harness.close({ continueRecording: true });
  assert.equal(harness.stored.length, 1);
  assert.equal(harness.stored[0].seq, 0);
  assert.equal(harness.stored[0].durationMs, 4_000);
  assert.equal(harness.recorders.length, 2, 'each segment gets a new MediaRecorder');
  assert.notEqual(harness.recorders[0], harness.recorders[1]);
  assert.equal(harness.recorders[1].state, 'recording');
  assert.deepEqual(harness.timerDelays, [4_000, 15_000]);
});

test('pause and stop close the current segment without starting another one', async () => {
  const harness = await frontendHarness();
  await harness.begin();
  harness.setNow(2_250);
  await harness.close({ continueRecording: false });
  assert.equal(harness.stored.length, 1);
  assert.equal(harness.stored[0].durationMs, 2_250);
  assert.equal(harness.recorders.length, 1);
  assert.equal(harness.voiceState.recorder, null);
  assert.equal(harness.voiceState.segmentStartedAt, 0);
  await harness.voiceState.uploadQueue;
  assert.equal(harness.uploaded.length, 1);
});
