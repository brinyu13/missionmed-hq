import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('FAC-01 explicitly starts the behavior state machine and preserves audio speech truth across camera frames', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  assert.match(runtime, /this\.behavior\.beginInterview\(0, \{ explicitMeasurementStart: true \}\)/u);
  assert.match(runtime, /this\.latestAudioSpeaking\s*=\s*detail\.vad\?\.speaking/u);
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

test('FAC-01 distinguishes unavailable hand evidence from measured zero, one-left, one-right, and both-hand truth', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  const live = await source('public/ivoc-standalone/app/live.mjs');
  assert.match(runtime, /const handsAvailable = body\.available === true && hands\.available === true/u);
  assert.match(runtime, /const handVisibility = hands\.bothPresent === true/u);
  assert.match(runtime, /visibility: handsAvailable \? handVisibility : 'UNAVAILABLE'/u);
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
  assert.match(css, /\.rec-dock[\s\S]*flex: 0 0 58px/u);
  assert.match(css, /\.vv-deck[\s\S]*grid-column: 1 \/ 3/u);
  assert.match(css, /\.variety-score[\s\S]*grid-column: 3/u);
});

test('FAC-01 trace deck renders three continuous live lines without changing the truthful stored history', async () => {
  const runtime = await source('public/ivoc-standalone/app/real-runtime.mjs');
  const live = await source('public/ivoc-standalone/app/live.mjs');
  assert.match(runtime, /frame\.speaking && frame\.pitch\.available && frame\.pitch\.voiced/u);
  assert.match(runtime, /pace: frame\.speaking && frame\.speedWpm\.available/u);
  assert.match(live, /One continuous shared-axis trace per real metric/u);
  assert.match(live, /Explicit observed[\s\S]*silence is projected to zero/u);
  assert.match(live, /Stored history and raw measurement values are never rewritten/u);
  assert.match(live, /SHARED 0–10 · ZERO = SILENCE/u);
  assert.match(live, /c\.lineJoin = 'round'/u);
  assert.match(live, /c\.lineTo\(X\(p\.t\), Y\(value\)\)/u);
  assert.match(live, /c\.lineTo\(X\(tEnd\), Y\(value\)\)/u);
  assert.doesNotMatch(runtime, /pitch:\s*Math\.random/u);
  assert.doesNotMatch(runtime, /pace:\s*Math\.random/u);
});

test('FAC-02B Results overlays Volume, Pitch and Pace on the same labeled 0–10 axis', async () => {
  const post = await source('public/ivoc-standalone/app/post.mjs');
  const css = await source('public/ivoc-standalone/styles/post.css');
  assert.match(post, /VOICE · 0–10/u);
  assert.match(post, /ONE SHARED AXIS/u);
  assert.match(post, /0 = OBSERVED SILENCE/u);
  assert.match(post, /viewBox="0 0 100 100"/u);
  assert.match(post, /fr-voice-\$\{key\}/u);
  assert.match(post, /\['VOLUME', 'vol'/u);
  assert.match(post, /\['PITCH', 'pitch'/u);
  assert.match(post, /\['PACE', 'pace'/u);
  assert.match(css, /\.fr-voice-lane \{ min-height: 148px; \}/u);
  assert.match(css, /\.fr-voice-grid line\.zero/u);
});
