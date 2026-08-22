import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  normalizeVocalVariationValue,
  VOCAL_VARIATION_TRACES,
  VocalVariationTraceVisibility,
} from '../../public/live-analytics/hud-renderers.mjs';

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
