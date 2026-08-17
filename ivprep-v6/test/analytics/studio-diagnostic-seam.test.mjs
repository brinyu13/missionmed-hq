// Y1-Y2-CAM-V6-3507 — the Studio shell, and the diagnostic seam that feeds it.
//
// The live build mounted the FACE and PITCH lanes but they could never populate:
// public/aaa/app.mjs subscribed via `state.communicationAnalytics?.pipeline`, and the
// facade returned by initializeAnalyticsUi exposed no `pipeline` property at all. With
// optional chaining the whole subscription was a silent no-op, so every lane rendered
// UNAVAILABLE forever while the engines behind them worked fine.
//
// These guards pin the seam and the readout contract so that failure mode cannot
// return silently.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DI_GROUPS,
  bodyLaneReadouts,
  faceLaneReadouts,
  pitchLaneReadouts,
  voiceLaneReadouts,
} from '../../public/analytics/di-groups-ui.mjs';

const UI = new URL('../../public/analytics/ui.mjs', import.meta.url);
const STUDIO = new URL('../../public/studio/studio.mjs', import.meta.url);
const STUDIO_HTML = new URL('../../public/studio/index.html', import.meta.url);
const MOUNT = new URL('../../server/hq-mount.mjs', import.meta.url);

const ui = await readFile(UI, 'utf8');
const studio = await readFile(STUDIO, 'utf8');
const studioHtml = await readFile(STUDIO_HTML, 'utf8');
const mount = await readFile(MOUNT, 'utf8');

test('the analytics facade exposes a diagnostic subscription', () => {
  assert.match(ui, /onDiagnostic: \(listener\) => \{/u, 'facade must expose onDiagnostic');
  // Both emitting pipelines must be forwarded: founderPipeline drives the cockpit's
  // guided runs, pipeline drives the student overlay.
  const body = ui.slice(ui.indexOf('onDiagnostic: (listener) => {'), ui.indexOf('persistentEnvelopes:'));
  assert.match(body, /founderPipeline\.addEventListener\('diagnostic'/u);
  assert.match(body, /pipeline\.addEventListener\('diagnostic'/u);
  // Must hand back an unsubscribe so long-lived surfaces cannot leak listeners.
  assert.match(body, /removeEventListener\('diagnostic'/u);
  // A misuse must fail loudly rather than silently no-op, which is the exact defect
  // this seam replaces.
  assert.match(body, /throw new TypeError/u);
});

test('no consumer subscribes through a non-existent facade property', () => {
  // The original defect. `?.pipeline` on the facade is always undefined, so the
  // optional call silently did nothing.
  assert.doesNotMatch(studio, /analytics\??\.pipeline/u, 'the Studio shell must not reach for facade.pipeline');
  assert.match(studio, /state\.analytics\.onDiagnostic/u, 'the Studio shell must use the real seam');
});

test('the Studio shell is the product surface and the legacy shell is only a fallback', () => {
  assert.match(mount, /relativePath = 'studio\/index\.html'/u, 'the product root must serve the Studio shell');
  assert.match(mount, /legacy.*relativePath = 'aaa\/index\.html'|relativePath = 'aaa\/index\.html'/su);
  // The legacy path must exist so the pre-Fable shell stays reachable for comparison.
  assert.match(mount, /\$\{PRODUCT_PREFIX\}\/legacy/u);
});

test('the Studio shell declares the approved Performance Studio hierarchy', () => {
  for (const view of ['home', 'newsession', 'devicecheck', 'training', 'simulation',
    'postanswer', 'filmroom', 'compare', 'lab', 'mentor', 'progress', 'fingerprint', 'vault']) {
    assert.match(studioHtml, new RegExp(`data-view-panel="${view}"`, 'u'), `${view} screen missing`);
    assert.match(studioHtml, new RegExp(`data-nav="${view}"`, 'u'), `${view} nav item missing`);
  }
  // The surface ids the proven analytics cockpit binds to must be present, or the
  // working telemetry silently detaches.
  for (const id of ['founder-student-video', 'founder-student-stage', 'founder-room-stage',
    'founder-room-wrapper', 'playback', 'communication-analytics-test-root']) {
    assert.match(studioHtml, new RegExp(`id="${id}"`, 'u'), `surface id ${id} missing`);
  }
  // The cockpit resolves its owning view from data-view-panel; the training screen
  // must therefore carry both.
  assert.match(studioHtml, /data-view-panel="training" id="communication-analytics-test-root"/u);
});

test('the Studio shell uses the canonical corpus and never the retired fixture', async () => {
  assert.match(studio, /from '\.\.\/questions\/question-store\.mjs'/u);
  assert.doesNotMatch(studio, /QUESTIONS.*fixtures\.mjs/u);
  const fixtures = await readFile(new URL('../../public/aaa/fixtures.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fixtures, /export const QUESTIONS\b/u, 'the 10-question fixture must stay retired');
});

test('FACE lanes render every cartridge and fail closed honestly', () => {
  const faceGroup = DI_GROUPS.find((g) => g.id === 'FACE');
  assert.equal(faceGroup.lanes.length, 10);

  // No face in frame must say so, not render a zero.
  const absent = faceLaneReadouts({ available: false, reason: 'NO_FACE_BLENDSHAPES' });
  for (const lane of faceGroup.lanes) {
    assert.match(absent[lane.id], /UNAVAILABLE/u, `${lane.id} must fail closed`);
  }

  // A live frame must produce real readouts for available cartridges.
  const live = faceLaneReadouts({
    available: true,
    'FACE.SMILE': { availability: 'AVAILABLE', bilateral: 0.62, symmetry: 0.94, active: true },
    'FACE.BROW': { availability: 'AVAILABLE', magnitude: 0.41, active: true },
    'FACE.BLINK': { availability: 'AVAILABLE', count: 7 },
    'FACE.PERIOCULAR': { availability: 'UNAVAILABLE' },
    cameraDwell: { available: true, cameraFacingRatio: 0.83, longestFacingRunMs: 5200, gazeReleases: 4 },
    gazeShifts: [{ from: 'CENTRE', to: 'LEFT', durationMs: 900 }],
    movementVariability: { available: true, value: 0.12, coverage: 0.7 },
  });
  assert.match(live['FACE.SMILE'], /0\.62/u);
  assert.match(live['FACE.SMILE'], /ACTIVE/u);
  assert.match(live['FACE.BROW'], /0\.41/u);
  assert.match(live['FACE.BLINK'], /7 events/u);
  // A cartridge whose channels are absent stays unavailable even in a live frame.
  assert.match(live['FACE.PERIOCULAR'], /UNAVAILABLE/u);
  assert.match(live['FACE.CAMERA_DWELL'], /83% facing/u);
  assert.match(live['FACE.GAZE_SHIFT'], /CENTRE→LEFT/u);
  // Claim safety survives into the rendered strings.
  for (const value of Object.values(live)) {
    assert.doesNotMatch(String(value), /happy|confident|authentic|engaged|emotion/iu);
  }
});

test('PITCH renders speaker-relative and never a target frequency', () => {
  // No validated F0 at all.
  const none = pitchLaneReadouts({ summary: { available: false } });
  assert.match(none['VOICE.PITCH'], /UNAVAILABLE — NO VALIDATED F0 INPUT/u);
  assert.match(none['VOICE.PITCH_VARIATION'], /UNAVAILABLE/u);

  // Not enough voiced audio yet is a distinct, honest state.
  const warming = pitchLaneReadouts({ summary: { available: false, reason: 'INSUFFICIENT_VOICED_AUDIO' } });
  assert.match(warming['VOICE.PITCH'], /KEEP SPEAKING/u);

  // Live: register is expressed in semitones against the speaker's own median.
  const live = pitchLaneReadouts({
    voiced: true, f0Hz: 165,
    summary: { available: true, medianHz: 147, minHz: 120, maxHz: 190, rangeSemitones: 7.9, variationSemitones: 2.4 },
  });
  assert.match(live['VOICE.PITCH'], /st vs your median/u);
  assert.match(live['VOICE.PITCH'], /median 147 Hz/u);
  assert.match(live['VOICE.PITCH_VARIATION'], /2\.40 st/u);
  assert.match(live['VOICE.PITCH_RANGE'], /7\.9 st/u);
  // An unvoiced frame must not fabricate a register.
  const unvoiced = pitchLaneReadouts({ voiced: false, f0Hz: null, summary: { available: true, medianHz: 147, minHz: 120, maxHz: 190, rangeSemitones: 7.9, variationSemitones: 2.4 } });
  assert.match(unvoiced['VOICE.PITCH'], /UNVOICED/u);
  // No universal ideal is ever displayed.
  for (const value of Object.values(live)) {
    assert.doesNotMatch(String(value), /target|ideal|should be/iu);
  }
});

test('voice and body lanes fail closed without a source', () => {
  const noAudio = voiceLaneReadouts({ available: false });
  assert.match(noAudio['VOICE.VOLUME'], /UNAVAILABLE/u);
  const live = voiceLaneReadouts({ available: true, capturedLevelDbfs: -22.4, energyVariationDb: 6.1, speaking: true });
  assert.match(live['VOICE.VOLUME'], /-22\.4 dBFS/u);
  assert.match(live['VOICE.PAUSE'], /SPEAKING/u);

  const noVision = bodyLaneReadouts(null);
  assert.match(noVision['BODY.YAW'], /UNAVAILABLE/u);
  assert.match(noVision['HANDS.LEFT'], /UNAVAILABLE/u);
  const geometry = {
    face: { present: true, yawDeg: -4.2, pitchDeg: 2.1, rollDeg: 0.4 },
    pose: { torsoPresent: true, lateralLeanDeg: 1.8 },
    hands: { left: { present: true, zone: 'chest' }, right: { present: false } },
  };
  const body = bodyLaneReadouts(geometry);
  assert.match(body['BODY.YAW'], /-4\.2°/u);
  assert.match(body['BODY.LEAN'], /1\.8°/u);
  assert.match(body['HANDS.LEFT'], /TRACKED · chest/u);
  assert.match(body['HANDS.RIGHT'], /NOT IN FRAME/u);
});

test('the M1 media lifecycle fixes remain intact under the shell port', () => {
  // These three defects each produced the black-video / IDLE-vision failure.
  assert.match(ui, /const camLive =/u, 'frozen-media fix must survive');
  assert.match(ui, /const micLive =/u);
  assert.doesNotMatch(ui.slice(ui.indexOf('  async connect() {'), ui.indexOf('\n  start() {')), /current\.(cam|mic)\s*=[^=]/u);
  assert.match(ui, /ownsActiveView\(view, role\) \{/u, 'DOM-resolved view owner must survive');
  assert.match(ui, /if \(liveStream && this\.bridge\?\.media\?\.cam\) preview\.srcObject = liveStream;/u, 'stream re-attach must survive');
});
