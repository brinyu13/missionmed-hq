import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  continuousVocalVariationPoints,
  normalizeVocalVariationValue,
  PitchHudRenderer,
  SpeedHudRenderer,
  VOCAL_VARIATION_TRACES,
  VocalVariationTraceVisibility,
} from '../../public/live-analytics/hud-renderers.mjs';

function hudRoot() {
  const calls = [];
  const context = new Proxy({
    calls,
    setTransform() {},
    setLineDash(value) { calls.push(['setLineDash', value]); },
    fillText(...args) { calls.push(['fillText', ...args]); },
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const canvas = {
    width: 0,
    height: 0,
    clientWidth: 260,
    clientHeight: 100,
    getBoundingClientRect: () => ({ width: 260, height: 100 }),
    getContext: () => context,
  };
  const value = { textContent: '', dataset: {} };
  const status = { textContent: '', dataset: {} };
  const root = {
    querySelector(selector) {
      if (selector.includes('data-hud-canvas')) return canvas;
      if (selector.includes('data-hud-value')) return value;
      if (selector.includes('data-hud-state')) return status;
      return null;
    },
  };
  return { root, calls, value, status };
}

test('Vocal Variation uses fixed physical-scale normalization without changing raw values', () => {
  assert.deepEqual([...VOCAL_VARIATION_TRACES], ['volume', 'pitch', 'speed']);
  assert.equal(normalizeVocalVariationValue('volume', -60), 0);
  assert.equal(normalizeVocalVariationValue('volume', -30), 0.5);
  assert.equal(normalizeVocalVariationValue('volume', 0), 1);
  assert.equal(normalizeVocalVariationValue('pitch', -6), 0);
  assert.equal(normalizeVocalVariationValue('pitch', 0), 0.5);
  assert.equal(normalizeVocalVariationValue('pitch', 6), 1);
  assert.equal(normalizeVocalVariationValue('speed', 120), 0.5);
  assert.equal(normalizeVocalVariationValue('speed', 240), 1);
  assert.equal(normalizeVocalVariationValue('pitch', null), null, 'unvoiced pitch must remain a gap');
  assert.throws(() => normalizeVocalVariationValue('unknown', 1), /Unknown Vocal Variation trace/u);
});

test('each Vocal Variation trace is independently hideable and show/hide-all preserves no measurement data', () => {
  const visibility = new VocalVariationTraceVisibility();
  assert.deepEqual(visibility.snapshot().visible, ['volume', 'pitch', 'speed']);
  visibility.toggle('pitch');
  assert.deepEqual(visibility.snapshot(), { visible: ['volume', 'speed'], hidden: ['pitch'] });
  visibility.setAll(false);
  assert.deepEqual(visibility.snapshot().visible, []);
  visibility.set('speed', true);
  assert.deepEqual(visibility.snapshot().visible, ['speed']);
  visibility.setAll(true);
  assert.deepEqual(visibility.snapshot().visible, ['volume', 'pitch', 'speed']);
});

test('continuous telemetry holds only bounded known values and marks every held point as unobserved', () => {
  const pitch = continuousVocalVariationPoints([
    { atMs: 0, value: 1.5 },
    { atMs: 500, value: null },
    { atMs: 1_250, value: null },
  ], { holdGapMs: 1_200 });
  assert.deepEqual(pitch, [
    { atMs: 0, value: 1.5, observed: true },
    { atMs: 500, value: 1.5, observed: false },
    { atMs: 1_250, value: null, observed: false },
  ]);
  const speed = continuousVocalVariationPoints([{ atMs: 1_000, value: 150 }], { holdGapMs: 2_000, endAtMs: 2_500 });
  assert.deepEqual(speed.at(-1), { atMs: 2_500, value: 150, observed: false });
  const volume = continuousVocalVariationPoints([{ atMs: 0, value: -35 }, { atMs: 50, value: -30 }], { holdGapMs: 0 });
  assert(volume.every((point) => point.observed === true));
});

test('Speaking Speed keeps a visible dial scaffold while truthful WPM is still unavailable', () => {
  const surface = hudRoot();
  const renderer = new SpeedHudRenderer(surface.root);
  renderer.update({ available: false, reason: 'NEED_MORE_TIMED_WORDS' });
  assert.equal(surface.value.textContent, '—');
  assert.match(surface.status.textContent, /NEED MORE TIMED WORDS/u);
  assert(surface.calls.some((call) => call[0] === 'fillText' && call[1] === 'WAITING FOR TIMED WORDS'));
});

test('Pitch holds the last validated register briefly without claiming a current voiced F0', () => {
  const surface = hudRoot();
  const renderer = new PitchHudRenderer(surface.root);
  renderer.update({ available: true, voiced: true, semitones: 1.2, register: 1, atMs: 1_000, state: 'neutral' });
  renderer.update({ available: true, voiced: false, semitones: null, atMs: 1_500, state: 'idle' });
  assert.equal(surface.value.textContent, '+1.2 st');
  assert.equal(surface.status.textContent, 'RECENT VALID F0 · CURRENT FRAME UNVOICED');
  renderer.update({ available: true, voiced: false, semitones: null, atMs: 2_500, state: 'idle' });
  assert.equal(surface.value.textContent, '—');
  assert.equal(surface.status.textContent, 'UNVOICED — WAITING FOR VALID F0');
  assert(surface.calls.some((call) => call[0] === 'fillText' && call[1] === 'MEDIAN'));
});

test('Pitch keeps a horizontal piano-key scaffold when F0 is unavailable', () => {
  const surface = hudRoot();
  const renderer = new PitchHudRenderer(surface.root);
  renderer.update({ available: false, reason: 'VOICED_F0_REQUIRED' });
  assert.equal(surface.value.textContent, '—');
  assert.match(surface.status.textContent, /VOICED F0 REQUIRED/u);
  assert(surface.calls.some((call) => call[0] === 'fillText' && call[1] === 'LOW'));
  assert(surface.calls.some((call) => call[0] === 'fillText' && call[1] === 'MEDIAN'));
  assert(surface.calls.some((call) => call[0] === 'fillText' && call[1] === 'HIGH'));
});

test('the right rail exposes the exact Vocal Variation control and trace contract', async () => {
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  assert.match(html, /<h2 id="modulation-title">Vocal Variation<\/h2>/u);
  assert.match(html, /Normalized voice history · time/u);
  for (const trace of VOCAL_VARIATION_TRACES) {
    assert.match(html, new RegExp(`data-vocal-trace-toggle="${trace}"`, 'u'));
  }
  assert.match(html, /data-vocal-trace-toggle="all"/u);
  assert.match(html, /measured volume, validated pitch, and observed speaking speed/u);
  assert.doesNotMatch(html, />Volume Modulation</u);
});
