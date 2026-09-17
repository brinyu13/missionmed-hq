// Y1-Y2-CAM-V6-3509 — measurement cartridge → normalized metric event → renderer.
//
// The 3494 hot-swap law: no DSP inside a gauge. These tests exercise the normalization
// layer with known diagnostics so the mapping is verified deterministically, which is
// the right level for this - a browser cannot prove it without a real face and mic.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { METRICS, MetricBus, selectCorrection, statusRail } from '../../public/studio/metric-bus.mjs';

const audio = (over = {}) => ({
  modality: 'audio', atMs: 1000, available: true,
  capturedLevelDbfs: -20, peakAmplitude: 0.3, energyVariationDb: 6, speaking: true,
  pauseInProgressMs: 0, ...over,
});

const vision = (over = {}) => ({
  modality: 'vision', atMs: 1000,
  geometry: {
    face: { present: true, yawDeg: 3 },
    pose: { torsoPresent: true, lateralLeanDeg: 1 },
    hands: { left: { present: true, zone: 'chest' }, right: { present: false } },
  },
  faceFamily: {
    available: true,
    'FACE.SMILE': { availability: 'AVAILABLE', active: true, bilateral: 0.5 },
    'FACE.BROW': { availability: 'AVAILABLE', active: false, magnitude: 0.1 },
    cameraDwell: { available: true, cameraFacingRatio: 0.82, gazeReleases: 3 },
    movementVariability: { available: true, value: 0.09, coverage: 0.8 },
  },
  ...over,
});

test('the bus exposes exactly the ten approved metrics', () => {
  assert.deepEqual([...METRICS], [
    'VOICE_LEVEL', 'VOLUME_VARIATION', 'PITCH', 'PITCH_VARIATION',
    'PACE', 'CADENCE', 'PAUSE', 'FACE', 'HANDS', 'FRAMING',
  ]);
});

test('volume level and volume variation are separate observables', () => {
  const bus = new MetricBus();
  // A LOUD MONOTONE must not read as good on variation. This is the specific failure
  // the two-metric split exists to prevent.
  for (let i = 0; i < 40; i += 1) bus.ingest(audio({ capturedLevelDbfs: -9, atMs: 1000 + i * 100 }));
  const { VOICE_LEVEL, VOLUME_VARIATION } = bus.latest;
  assert.equal(VOICE_LEVEL.available, true);
  assert.ok(VOICE_LEVEL.dbfs === -9);
  assert.equal(VOLUME_VARIATION.available, true);
  assert.equal(VOLUME_VARIATION.flat, true, 'a constant loud level must report FLAT');
  assert.ok(VOLUME_VARIATION.rangeDb < 1);

  // Genuine variation clears the flat flag.
  const varied = new MetricBus();
  const levels = [-30, -22, -14, -20, -28, -16];
  for (let i = 0; i < 40; i += 1) varied.ingest(audio({ capturedLevelDbfs: levels[i % levels.length], atMs: 1000 + i * 100 }));
  assert.equal(varied.latest.VOLUME_VARIATION.flat, false);
  assert.ok(varied.latest.VOLUME_VARIATION.rangeDb > 10);
});

test('pitch is driven by F0 semitones and never by level', () => {
  const bus = new MetricBus();
  // No validated F0 -> both pitch metrics unavailable, regardless of a healthy level.
  bus.ingest(audio({ pitch: { summary: { available: false } } }));
  assert.equal(bus.latest.PITCH.available, false);
  assert.equal(bus.latest.PITCH.reason, 'NO_VALIDATED_F0');
  assert.equal(bus.latest.PITCH_VARIATION.available, false);

  // Establishing range is a distinct, honest state.
  bus.ingest(audio({ pitch: { summary: { available: false, reason: 'INSUFFICIENT_VOICED_AUDIO' } } }));
  assert.equal(bus.latest.PITCH.reason, 'ESTABLISHING_RANGE');

  // Live F0 an octave above median -> +12 semitones, top register.
  bus.ingest(audio({
    pitch: { voiced: true, f0Hz: 294, summary: { available: true, medianHz: 147, minHz: 120, maxHz: 300, rangeSemitones: 15.8, variationSemitones: 3.1 } },
  }));
  const p = bus.latest.PITCH;
  assert.equal(p.available, true);
  assert.ok(Math.abs(p.semitones - 12) < 0.01, `expected +12 st, got ${p.semitones}`);
  assert.equal(p.register, 2, 'an octave up is the top register');
  assert.equal(bus.latest.PITCH_VARIATION.monotone, false);

  // Below median goes negative.
  bus.ingest(audio({ pitch: { voiced: true, f0Hz: 110, summary: { available: true, medianHz: 147, minHz: 100, maxHz: 300, rangeSemitones: 19, variationSemitones: 3.1 } } }));
  assert.ok(bus.latest.PITCH.semitones < -4);
  assert.equal(bus.latest.PITCH.register, -2);

  // An unvoiced frame produces no register rather than a fabricated one.
  bus.ingest(audio({ pitch: { voiced: false, f0Hz: null, summary: { available: true, medianHz: 147, minHz: 100, maxHz: 300, rangeSemitones: 19, variationSemitones: 3.1 } } }));
  assert.equal(bus.latest.PITCH.semitones, null);
  assert.equal(bus.latest.PITCH.register, null);
});

test('monotone delivery is distinguished from varied delivery', () => {
  const flat = new MetricBus();
  flat.ingest(audio({ pitch: { voiced: true, f0Hz: 150, summary: { available: true, medianHz: 150, minHz: 148, maxHz: 152, rangeSemitones: 0.4, variationSemitones: 0.3 } } }));
  assert.equal(flat.latest.PITCH_VARIATION.monotone, true);

  const lively = new MetricBus();
  lively.ingest(audio({ pitch: { voiced: true, f0Hz: 150, summary: { available: true, medianHz: 150, minHz: 110, maxHz: 210, rangeSemitones: 11, variationSemitones: 3.4 } } }));
  assert.equal(lively.latest.PITCH_VARIATION.monotone, false);
});

test('pace and cadence derive from speech edges on the shared clock', () => {
  const bus = new MetricBus();
  // Fewer than three onsets cannot support a rate.
  bus.ingest(audio({ speaking: true, atMs: 0 }));
  assert.equal(bus.latest.PACE.available, false);

  // Regular onsets every 1.2s -> ~50 phrases/min, usable, and very even cadence.
  let t = 0;
  for (let i = 0; i < 8; i += 1) {
    bus.ingest(audio({ speaking: false, atMs: t += 600 }));
    bus.ingest(audio({ speaking: true, atMs: t += 600 }));
  }
  const pace = bus.latest.PACE;
  assert.equal(pace.available, true);
  assert.equal(pace.zone, 'usable');
  assert.ok(pace.phrasesPerMinute > 40 && pace.phrasesPerMinute < 60, `got ${pace.phrasesPerMinute}`);
  // Perfectly regular phrasing is the cadence failure mode, not the goal.
  assert.equal(bus.latest.CADENCE.metronomic, true);
});

test('face, hands and framing normalize from vision without affect claims', () => {
  const bus = new MetricBus();
  bus.ingest(vision());
  const { FACE, HANDS, FRAMING } = bus.latest;

  assert.equal(FACE.available, true);
  assert.equal(FACE.cameraFacingRatio, 0.82);
  assert.equal(FACE.gazeReleases, 3);
  for (const term of ['happy', 'confident', 'authentic', 'engaged', 'emotion', 'honest']) {
    assert.doesNotMatch(FACE.summary, new RegExp(term, 'iu'));
  }

  assert.equal(HANDS.available, true);
  assert.equal(HANDS.left, true);
  assert.equal(HANDS.right, false);
  assert.equal(HANDS.activity, 'single');
  // No gesture classifier exists, so none may be implied.
  assert.equal(HANDS.gestureClassification.available, false);
  assert.equal(HANDS.gestureClassification.reason, 'NOT_IMPLEMENTED');

  assert.equal(FRAMING.available, true);
  assert.equal(FRAMING.cameraFacing, true);
  bus.ingest(vision({ geometry: { face: { present: true, yawDeg: 40 }, pose: {}, hands: {} } }));
  assert.equal(bus.latest.FRAMING.cameraFacing, false, 'a turned head must not read as square');

  // No face at all fails closed.
  bus.ingest(vision({ faceFamily: { available: false, reason: 'NO_FACE_BLENDSHAPES' } }));
  assert.equal(bus.latest.FACE.available, false);
  assert.equal(bus.latest.FACE.reason, 'NO_FACE_IN_FRAME');
});

test('exactly one correction is elevated, and only with evidence', () => {
  // Nothing measured yet -> idle, never a coaching instruction.
  const idle = selectCorrection({});
  assert.equal(idle.state, 'idle');
  assert.equal(idle.metric, undefined);

  // Evidence with nothing wrong -> locked, not a correction.
  const ok = selectCorrection({ VOICE_LEVEL: { available: true, dbfs: -20, inCorridor: true } });
  assert.equal(ok.state, 'locked');

  // Several problems at once still yield ONE correction, the most severe.
  const many = selectCorrection({
    VOICE_LEVEL: { available: true, dbfs: -50, inCorridor: false },
    VOLUME_VARIATION: { available: true, flat: true },
    PACE: { available: true, zone: 'fast' },
    CADENCE: { available: true, metronomic: true },
  });
  assert.equal(many.state, 'warn');
  assert.equal(many.metric, 'VOICE_LEVEL', 'too quiet outranks the others');
  assert.ok(typeof many.instruction === 'string' && many.instruction.length > 0);

  // An UNAVAILABLE metric can never produce coaching.
  const noEvidence = selectCorrection({ VOLUME_VARIATION: { available: false, reason: 'NEED_MORE_SPEECH' } });
  assert.equal(noEvidence.state, 'idle');
});

test('the status rail reports every metric compactly and fails closed', () => {
  const rail = statusRail({
    VOICE_LEVEL: { available: true, dbfs: -20, inCorridor: true },
    VOLUME_VARIATION: { available: true, flat: true },
  });
  assert.equal(rail.length, 10, 'all ten metrics always appear');
  assert.equal(rail.find((r) => r.id === 'VOICE_LEVEL').state, 'ok');
  assert.equal(rail.find((r) => r.id === 'VOLUME_VARIATION').state, 'warn');
  // Metrics with no evidence are unavailable, not silently ok.
  assert.equal(rail.find((r) => r.id === 'PITCH').state, 'unavailable');
  assert.equal(rail.find((r) => r.id === 'FACE').state, 'unavailable');
});

test('renderers contain no DSP and no thresholds of their own', async () => {
  const src = await readFile(new URL('../../public/studio/instruments.mjs', import.meta.url), 'utf8');
  // The hot-swap law: gauges render, they do not measure.
  for (const banned of ['estimateF0', 'getFloatTimeDomainData', 'createAnalyser', 'AudioContext', 'FaceFamily', 'PitchTrack']) {
    assert.ok(!src.includes(banned), `renderers must not contain ${banned}`);
  }
  // Renderers must be swappable via the registry rather than hardcoded at call sites.
  assert.match(src, /export const INSTRUMENTS = Object\.freeze\(\{/u);
  assert.match(src, /export class InstrumentRack/u);
  // A single rAF loop for the whole rack, so adding gauges never adds loops.
  const rack = src.slice(src.indexOf('export class InstrumentRack'));
  assert.equal((rack.match(/requestAnimationFrame/gu) || []).length, 2, 'one loop: schedule + reschedule');
});

test('the student cockpit wires through the bus and never unsubscribes on hide', async () => {
  const src = await readFile(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  // Raw diagnostics must go through normalization before reaching renderers.
  assert.match(src, /state\.bus\.ingest\(detail\)/u);
  assert.match(src, /state\.rack\?\.update\(frame\)/u);
  assert.match(src, /state\.labRack\?\.update\(frame\)/u);
  // Overlay toggles change drawing only - setInstrumentation, never a teardown.
  assert.match(src, /setInstrumentation\?\.\(\{/u);
  assert.doesNotMatch(src, /overlays[\s\S]{0,200}resetSession|overlays[\s\S]{0,200}destroy\(/u);
  // The engineering cockpit is hidden by role, not removed from the tree.
  const html = await readFile(new URL('../../public/studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="communication-analytics-test-root" data-founder-only/u);
  assert.match(html, /data-student-cockpit/u);
});
