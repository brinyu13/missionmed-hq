import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('FAC-01 explicitly starts the behavior state machine and preserves audio speech truth across camera frames', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  assert.match(runtime, /this\.behavior\.beginInterview\(0\)/u);
  assert.match(runtime, /this\.latestAudioSpeaking\s*=\s*detail\.vad\?\.available/u);
  assert.match(runtime, /const speaking = this\.latestAudioSpeaking \|\| stateName/u);
});

test('FAC-01 projects vocal variety from validated speaker-relative pitch and loudness variation', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  assert.match(runtime, /minimumVoicedFrames/u);
  assert.match(runtime, /pitchWeight/u);
  assert.match(runtime, /loudnessWeight/u);
  assert.match(runtime, /pitchVariationSemitones/u);
  assert.doesNotMatch(runtime, /const varietyScore = varietyObserved \? corridorScore\(range/u);
});

test('FAC-01 exposes zero, one-left, one-right, and both-hand truth without a binary contradiction', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  const live = await source('public/ivoc-standalone/app/live.mjs');
  assert.match(runtime, /visibility: hands\.bothPresent === true/u);
  assert.match(live, /ONE HAND VISIBLE · LEFT/u);
  assert.match(live, /ONE HAND VISIBLE · RIGHT/u);
  assert.match(live, /BOTH HANDS VISIBLE · L \+ R/u);
  assert.match(live, /HANDS OUT OF FRAME · OK WHILE LISTENING/u);
});

test('FAC-01 keeps overlay presentation independently toggleable from measurement', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  const live = await source('public/ivoc-standalone/app/live.mjs');
  for (const part of ['face', 'hands', 'body', 'position']) {
    assert.match(live, new RegExp(`data-overlay="${part}"`, 'u'));
  }
  assert.match(runtime, /setOverlayVisibility\(next = \{\}\)/u);
  assert.match(live, /measurement continues/u);
});

test('FAC-01 keeps the frozen cockpit macro layout and makes recording secondary to the full-width trace deck', async () => {
  const css = await source('public/ivoc-standalone/styles/cockpit.css');
  assert.match(css, /\.room-left/u);
  assert.match(css, /\.room-center/u);
  assert.match(css, /\.room-right/u);
  assert.match(css, /aspect-ratio: 16 \/ 9/u);
  assert.match(css, /\.rec-dock[\s\S]*flex: 0 0 340px/u);
  assert.match(css, /\.vv-deck[\s\S]*flex: 1/u);
});

test('FAC-01 trace deck eases only inside observed runs and breaks silence or unvoiced gaps', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  const live = await source('public/ivoc-standalone/app/live.mjs');
  assert.match(runtime, /frame\.speaking && frame\.pitch\.available && frame\.pitch\.voiced/u);
  assert.match(runtime, /pace: frame\.speaking && frame\.speedWpm\.available/u);
  assert.match(live, /maximumJoinGap/u);
  assert.match(live, /eased = null; previousAt = null/u);
});
