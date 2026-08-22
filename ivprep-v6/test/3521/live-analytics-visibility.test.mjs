import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ANALYTICS_FAMILIES,
  ANALYTICS_METRIC_IDS,
  AnalyticsVisibilityState,
  MINIMAL_ANALYTICS_METRICS,
  VISIBILITY_STORAGE_KEY,
} from '../../public/live-analytics/visibility-state.mjs';
import { LiveMetricProjector } from '../../public/live-analytics/live-metric-projector.mjs';

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

function visionFrame(atMs, movement = 0.2) {
  return {
    modality: 'vision',
    atMs,
    primaryLock: { state: 'PRIMARY_LOCKED', selectionRequired: false, bystanderCount: 0 },
    geometry: {
      face: {
        present: true,
        box: { left: 0.35, top: 0.2, width: 0.3, height: 0.45, centerX: 0.5, centerY: 0.425 },
        yawProxyDeg: 2,
        pitchProxyDeg: -1,
        rollProxyDeg: 0,
      },
      pose: { torsoPresent: true, shoulderWidth: 0.3, centerX: 0.5 + movement, centerY: 0.5, lateralLeanDeg: movement * 10 },
      hands: {
        left: { present: true, centerX: 0.35 + movement, centerY: 0.6, zone: 'chest' },
        right: { present: true, centerX: 0.65 - movement, centerY: 0.6, zone: 'chest' },
      },
    },
    faceFamily: {
      available: true,
      'FACE.SMILE': { availability: 'AVAILABLE', active: true, bilateral: 0.4, symmetry: 0.9 },
      'FACE.BLINK': { availability: 'AVAILABLE', closing: false, count: 2 },
      'FACE.BROW': { availability: 'AVAILABLE', active: false, magnitude: 0.1 },
      'FACE.PERIOCULAR': { availability: 'AVAILABLE', active: false, bilateral: 0.1 },
      'FACE.GAZE': { availability: 'AVAILABLE', horizontal: 0.02, vertical: 0, offCentreMagnitude: 0.02, cameraFacing: true },
    },
    faceFamilySummary: {
      observedDurationMs: atMs,
      cartridges: {
        'FACE.SMILE': { eventCount: Math.floor(atMs / 1000) },
        'FACE.BLINK': { eventCount: Math.floor(atMs / 2000) },
      },
      cameraDwell: {
        available: true,
        cameraFacingRatio: 0.7,
        offCameraRatio: 0.3,
        longestFacingRunMs: atMs,
        gazeReleases: 1,
      },
      movementVariability: { value: movement },
    },
    live: { gestureActive: movement >= 0.2 ? 'both' : null, postureMovementActive: true },
  };
}

test('the presentation registry is canonical and every metric has one surface and one drawer control', async () => {
  assert.equal(ANALYTICS_METRIC_IDS.length, 22);
  assert.equal(new Set(ANALYTICS_METRIC_IDS).size, ANALYTICS_METRIC_IDS.length);
  assert.deepEqual(ANALYTICS_METRIC_IDS, Object.values(ANALYTICS_FAMILIES).flat());
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  for (const id of ANALYTICS_METRIC_IDS) {
    assert.equal(occurrences(html, `data-visibility-metric="${id}"`), 1, `${id} must own one visual surface`);
    assert.equal(occurrences(html, `data-visibility-toggle="${id}"`), 1, `${id} must own one drawer control`);
  }
});

test('Minimal is the no-preference default and presets are exact', () => {
  const state = new AnalyticsVisibilityState({ storage: new MemoryStorage() });
  assert.equal(state.snapshot().preset, 'minimal');
  assert.deepEqual(state.snapshot().visibleMetricIds, MINIMAL_ANALYTICS_METRICS);
  assert.deepEqual(state.selectPreset('full').visibleMetricIds, ANALYTICS_METRIC_IDS);
  assert.deepEqual(state.selectPreset('interview').visibleMetricIds, []);
  assert.deepEqual(state.selectPreset('minimal').visibleMetricIds, MINIMAL_ANALYTICS_METRICS);
});

test('individual controls create Custom without collapsing a partially visible family', () => {
  const state = new AnalyticsVisibilityState({ preset: 'full', storage: new MemoryStorage() });
  for (const id of [
    'head-face.smile-events',
    'head-face.camera-facing-balance',
    'head-face.geometry-trend',
  ]) state.setMetricVisible(id, false);
  const snapshot = state.snapshot();
  assert.equal(snapshot.preset, 'custom');
  assert.equal(snapshot.familyState['head-face'], 'mixed');
  assert.equal(snapshot.visibleMetricIds.includes('head-face.region-status'), true);
  assert.equal(snapshot.visibleMetricIds.includes('body-posture.wireframe'), true);
  assert.equal(snapshot.visibleMetricIds.includes('voice-delivery.volume'), true);
});

test('family off/on remembers the prior subset and rails remain independent', () => {
  const state = new AnalyticsVisibilityState({ preset: 'full', storage: new MemoryStorage() });
  state.setMetricVisible('body-posture.alignment', false);
  const priorBody = state.snapshot().visibleMetricIds.filter((id) => id.startsWith('body-posture.'));
  state.setFamilyVisible('body-posture', false);
  assert.equal(state.snapshot().familyState['body-posture'], 'off');
  assert.equal(state.snapshot().familyState['head-face'], 'on');
  assert.equal(state.snapshot().familyState['voice-delivery'], 'on');
  state.setFamilyVisible('body-posture', true);
  assert.deepEqual(
    state.snapshot().visibleMetricIds.filter((id) => id.startsWith('body-posture.')),
    priorBody,
  );
});

test('visible module and rail collapse controls restore prior Custom subsets', () => {
  const state = new AnalyticsVisibilityState({ preset: 'full', storage: new MemoryStorage() });
  state.setMetricVisible('head-face.smile-events', false);
  const priorHead = state.snapshot().visibleMetricIds.filter((id) => id.startsWith('head-face.'));
  state.setModuleVisible('head-face', false);
  state.setModuleVisible('head-face', true);
  assert.deepEqual(state.snapshot().visibleMetricIds.filter((id) => id.startsWith('head-face.')), priorHead);

  state.setMetricVisible('voice-delivery.pitch', false);
  const priorVoice = state.snapshot().visibleMetricIds.filter((id) => id.startsWith('voice-delivery.'));
  state.setRailVisible('voice', false);
  state.setRailVisible('voice', true);
  assert.deepEqual(state.snapshot().visibleMetricIds.filter((id) => id.startsWith('voice-delivery.')), priorVoice);
});

test('Interview Only restores Minimal as well as Custom', () => {
  const state = new AnalyticsVisibilityState({ preset: 'minimal', storage: new MemoryStorage() });
  state.setMode('interview');
  state.setMode('coaching');
  assert.equal(state.snapshot().preset, 'minimal');
  assert.deepEqual(state.snapshot().visibleMetricIds, MINIMAL_ANALYTICS_METRICS);
});

test('Interview Only preserves the saved Custom set', () => {
  const storage = new MemoryStorage();
  const state = new AnalyticsVisibilityState({ preset: 'full', storage });
  state.setMetricVisible('head-face.smile-events', false);
  const custom = state.snapshot().visibleMetricIds;
  state.setMode('interview');
  assert.deepEqual(state.snapshot().visibleMetricIds, []);
  state.setMode('coaching');
  assert.equal(state.snapshot().preset, 'custom');
  assert.deepEqual(state.snapshot().visibleMetricIds, custom);
});

test('persistence contains only schema version and allowlisted presentation IDs', () => {
  const storage = new MemoryStorage();
  const state = new AnalyticsVisibilityState({ storage });
  state.setMetricVisible('body-posture.hands-visible', true);
  const stored = JSON.parse(storage.getItem(VISIBILITY_STORAGE_KEY));
  assert.deepEqual(Object.keys(stored), ['version', 'visibleMetricIds']);
  assert.equal(stored.version, 1);
  assert.ok(stored.visibleMetricIds.every((id) => ANALYTICS_METRIC_IDS.includes(id)));
  assert.doesNotMatch(JSON.stringify(stored), /timestamp|device|session|history|telemetry/iu);
  state.resetCustom();
  assert.equal(storage.getItem(VISIBILITY_STORAGE_KEY), null);
});

test('corrupt, oversized, and unknown persisted choices fail safely to Minimal', () => {
  for (const raw of [
    '{broken',
    'x'.repeat(10_001),
    JSON.stringify({ version: 1, visibleMetricIds: ['unknown.metric'] }),
  ]) {
    const storage = new MemoryStorage({ [VISIBILITY_STORAGE_KEY]: raw });
    assert.deepEqual(
      new AnalyticsVisibilityState({ preset: 'custom', storage }).snapshot().visibleMetricIds,
      MINIMAL_ANALYTICS_METRICS,
    );
  }
});

test('metric histories and counters advance while their presentation IDs are hidden', () => {
  const state = new AnalyticsVisibilityState({ preset: 'full', storage: new MemoryStorage() });
  const projector = new LiveMetricProjector();
  projector.ingest(visionFrame(1_000, 0.1));
  for (const id of [
    'head-face.smile-events',
    'head-face.camera-facing-balance',
    'head-face.geometry-trend',
    'body-posture.alignment',
    'body-posture.hands-visible',
    'body-posture.gesture-activity',
  ]) state.setMetricVisible(id, false);
  const before = projector.latest.metrics.HEAD_FACE;
  const beforeBody = projector.latest.metrics.BODY_HANDS;
  projector.ingest(visionFrame(2_000, 0.2));
  projector.ingest(visionFrame(3_000, 0.3));
  const after = projector.latest.metrics.HEAD_FACE;
  const afterBody = projector.latest.metrics.BODY_HANDS;
  assert.equal(state.snapshot().familyState['head-face'], 'mixed');
  assert.equal(state.snapshot().familyState['body-posture'], 'mixed');
  for (const id of [
    'head-face.smile-events',
    'head-face.camera-facing-balance',
    'head-face.geometry-trend',
    'body-posture.alignment',
    'body-posture.hands-visible',
    'body-posture.gesture-activity',
  ]) assert.equal(state.snapshot().visibleMetricIds.includes(id), false);
  assert.ok(after.smileEvents.count > before.smileEvents.count);
  assert.ok(after.cameraFacingDwell.longestFacingRunMs > before.cameraFacingDwell.longestFacingRunMs);
  assert.ok(after.geometryTrend.values.length > before.geometryTrend.values.length);
  assert.ok(afterBody.movementTrend.values.length > (beforeBody.movementTrend.values?.length || 0));
  assert.ok(afterBody.gestureEvents.count > beforeBody.gestureEvents.count);
});

test('visibility state has no capture, detector, network, provider, or reset path', async () => {
  const source = await readFile(new URL('../../public/live-analytics/visibility-state.mjs', import.meta.url), 'utf8');
  for (const forbidden of [
    'getUserMedia', 'AudioContext', 'startAnalytics', 'stopMedia',
    'projector.reset', 'fetch(', 'WebSocket', 'provider',
  ]) assert.equal(source.includes(forbidden), false, `visibility state must not contain ${forbidden}`);
});
