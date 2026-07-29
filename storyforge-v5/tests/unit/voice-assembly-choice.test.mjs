import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const appSource = await readFile(
  new URL('../../public/app.js', import.meta.url),
  'utf8',
);

function extractFunction(name) {
  const declaration = `function ${name}(`;
  const asyncDeclaration = `async function ${name}(`;
  const asyncStart = appSource.indexOf(asyncDeclaration);
  const start = asyncStart >= 0 ? asyncStart : appSource.indexOf(declaration);
  assert.notEqual(start, -1, `${name} must remain implemented`);
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const character = appSource[index];
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
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  assert.fail(`could not isolate ${name}`);
}

function raceHarness({
  cancel,
  recording,
  createStory,
} = {}) {
  const calls = [];
  const preserved = [];
  const context = vm.createContext({
    api: {
      async cancelRecording(id) {
        calls.push(['cancel', id]);
        return cancel ? cancel(calls.filter(([name]) => name === 'cancel').length) : {};
      },
      async recording(id) {
        calls.push(['recording', id]);
        return recording ? recording() : { state: 'assembled' };
      },
      async createStory(payload) {
        calls.push(['create', structuredClone(payload)]);
        return createStory
          ? createStory(payload, calls.filter(([name]) => name === 'create').length)
          : { story: { id: 'story' } };
      },
    },
    firstDefined: (...values) => values.find(
      (value) => value !== undefined && value !== null
    ),
    async preserveCancelledRecordingDraft(...args) {
      preserved.push(args);
      return undefined;
    },
  });
  for (const name of [
    'recordingState',
    'typedStoryPayload',
    'isRecordingStateConflict',
    'saveWithoutAudioAfterDeadline',
  ]) {
    vm.runInContext(extractFunction(name), context);
  }
  return {
    calls,
    preserved,
    save: vm.runInContext('saveWithoutAudioAfterDeadline', context),
  };
}

const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const exactText = '  Typed lead.\nTranscript detail.\nTyped ending.  ';
const audioPayload = Object.freeze({
  title: 'A reviewed story',
  text: exactText,
  captureType: 'audio',
  recordingId,
  draftVersion: 7,
  surface: 'quick',
});

test('pending assembly expires at 90 seconds and each invocation gets a fresh deadline', async () => {
  let now = 0;
  const reads = [];
  const context = vm.createContext({
    Date: { now: () => now },
    api: {
      async recording() {
        reads.push(now);
        return { state: 'finishing' };
      },
    },
    audioAssemblyDecisionRequired: Object.freeze({
      audioAssemblyDecisionRequired: true,
    }),
    firstDefined: (...values) => values.find(
      (value) => value !== undefined && value !== null
    ),
    voiceAssemblyRetryMs: 2_000,
    voiceAssemblyWaitMs: 90_000,
    captureSaveInterrupted: false,
    async voiceDelay(milliseconds) {
      now += milliseconds;
    },
  });
  vm.runInContext(extractFunction('recordingState'), context);
  vm.runInContext(extractFunction('saveRecordedStoryWhenAssembled'), context);
  const save = vm.runInContext('saveRecordedStoryWhenAssembled', context);

  assert.equal(
    (await save(recordingId, audioPayload)).audioAssemblyDecisionRequired,
    true,
  );
  assert.equal(reads.at(-2), 88_000);
  assert.equal(reads.at(-1), 90_000);
  assert.equal(reads.every((value) => value <= 90_000), true);

  reads.length = 0;
  assert.equal(
    (await save(recordingId, audioPayload)).audioAssemblyDecisionRequired,
    true,
  );
  assert.equal(reads[0], 90_000);
  assert.equal(reads.at(-2), 178_000);
  assert.equal(reads.at(-1), 180_000);
});

test('S-a cancels once then creates exactly one byte-identical typed story', async () => {
  const harness = raceHarness();
  const result = await harness.save(recordingId, audioPayload, exactText);
  assert.equal(result.savedWithoutAudio, true);
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['create', {
      title: 'A reviewed story',
      text: exactText,
      captureType: 'text',
      draftVersion: 7,
      surface: 'quick',
    }],
  ]);
  assert.deepEqual(harness.preserved, [[recordingId, exactText]]);
});

test('S-b assembled race performs one reread and one E7 with the original payload', async () => {
  const conflict = Object.assign(new Error('conflict'), {
    code: 'state_conflict',
    status: 409,
  });
  const harness = raceHarness({
    cancel: () => {
      throw conflict;
    },
    recording: () => ({ state: 'assembled' }),
  });
  const result = await harness.save(recordingId, audioPayload, exactText);
  assert.equal(result.savedWithoutAudio, false);
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['recording', recordingId],
    ['create', audioPayload],
  ]);
});

test('S-b failed E7 creates typed-only first then makes one final E5 attempt', async () => {
  const conflict = () => Object.assign(new Error('conflict'), {
    code: 'state_conflict',
    status: 409,
  });
  const harness = raceHarness({
    cancel: () => {
      throw conflict();
    },
    recording: () => ({ state: 'attached' }),
    createStory: (_payload, attempt) => {
      if (attempt === 1) throw new Error('single E7 failed');
      return { story: { id: 'typed-only' } };
    },
  });
  const result = await harness.save(recordingId, audioPayload, exactText);
  assert.equal(result.savedWithoutAudio, true);
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['recording', recordingId],
    ['create', audioPayload],
    ['create', {
      title: 'A reviewed story',
      text: exactText,
      captureType: 'text',
      draftVersion: 7,
      surface: 'quick',
    }],
    ['cancel', recordingId],
  ]);
  assert.deepEqual(harness.preserved, [[recordingId, exactText]]);
});

test('S-b non-saveable reread falls back to typed-only and one final E5', async () => {
  const conflict = Object.assign(new Error('conflict'), {
    code: 'state_conflict',
    status: 409,
  });
  let cancelAttempt = 0;
  const harness = raceHarness({
    cancel: () => {
      cancelAttempt += 1;
      if (cancelAttempt === 1) throw conflict;
      return {};
    },
    recording: () => ({ state: 'finishing' }),
  });
  const result = await harness.save(recordingId, audioPayload, exactText);
  assert.equal(result.savedWithoutAudio, true);
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['recording', recordingId],
    ['create', {
      title: 'A reviewed story',
      text: exactText,
      captureType: 'text',
      draftVersion: 7,
      surface: 'quick',
    }],
    ['cancel', recordingId],
  ]);
  assert.deepEqual(harness.preserved, [[recordingId, exactText]]);
});

test('S-b unreadable reread fails closed to typed-only and one final E5', async () => {
  const conflict = Object.assign(new Error('conflict'), {
    code: 'state_conflict',
    status: 409,
  });
  let cancelAttempt = 0;
  const harness = raceHarness({
    cancel: () => {
      cancelAttempt += 1;
      if (cancelAttempt === 1) throw conflict;
      return {};
    },
    recording: () => {
      throw new Error('reread unavailable');
    },
  });
  const result = await harness.save(recordingId, audioPayload, exactText);
  assert.equal(result.savedWithoutAudio, true);
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['recording', recordingId],
    ['create', {
      title: 'A reviewed story',
      text: exactText,
      captureType: 'text',
      draftVersion: 7,
      surface: 'quick',
    }],
    ['cancel', recordingId],
  ]);
  assert.deepEqual(harness.preserved, [[recordingId, exactText]]);
});

test('S-c leaves the prompt retryable and creates no story', async () => {
  const harness = raceHarness({
    cancel: () => {
      throw new Error('Network unavailable.');
    },
  });
  await assert.rejects(
    harness.save(recordingId, audioPayload, exactText),
    (error) => (
      error.message === 'Network unavailable.'
      && error.audioAssemblyPromptRetry === true
    ),
  );
  assert.deepEqual(harness.calls, [['cancel', recordingId]]);
});

test('S-a story-create failure preserves a typed retry draft without an automatic retry', async () => {
  const harness = raceHarness({
    createStory: () => {
      throw new Error('Story save unavailable.');
    },
  });
  await assert.rejects(
    harness.save(recordingId, audioPayload, exactText),
    /Story save unavailable/,
  );
  assert.deepEqual(harness.calls, [
    ['cancel', recordingId],
    ['create', {
      title: 'A reviewed story',
      text: exactText,
      captureType: 'text',
      draftVersion: 7,
      surface: 'quick',
    }],
  ]);
  assert.deepEqual(harness.preserved, [[recordingId, exactText]]);
});

test('Decision 1 does not alter normal discard or immutable assembly-failure copy', () => {
  const discardStart = appSource.indexOf('async function voiceDiscard()');
  const discardEnd = appSource.indexOf('async function retryVoiceTranscription()', discardStart);
  const decisionStart = appSource.indexOf('async function saveWithoutAudioAfterDeadline');
  const decisionEnd = appSource.indexOf('function promptForAudioAssemblyDecision', decisionStart);
  assert.equal(
    appSource.slice(decisionStart, decisionEnd).includes('voiceDiscard('),
    false,
  );
  assert.match(
    appSource.slice(discardStart, discardEnd),
    /removeVoiceText\(body\.value, voiceState\.voiceSpans\)/,
  );
  assert.equal(
    appSource.includes(
      "We couldn't attach your audio this time. Every word is safe in your story text. You can save your story now, and you can record again anytime.",
    ),
    true,
  );
});
