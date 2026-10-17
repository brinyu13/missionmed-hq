import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import { AudioSignalAnalyzer, measurePcmFrame } from '../../analytics/audio-signal.mjs';
import { SessionClock } from '../../analytics/session-clock.mjs';
import { VALIDATION_RECORD } from '../../analytics/signal-registry.mjs';
import { VisionEpisodeAnalyzer } from '../../analytics/episode-detectors.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireTruth = (condition, message) => { if (!condition) throw new Error(message); };

const manifestBytes = await readFile('fixtures/analytics/manifest.v1.json');
const manifest = JSON.parse(manifestBytes);
const digest = sha256(manifestBytes);
if (digest !== VALIDATION_RECORD.fixtureManifestSha256) throw new Error(`Fixture manifest hash mismatch: ${digest}.`);
if (manifest.dataPolicy !== 'synthetic-only') throw new Error('Ground-truth fixtures must be synthetic-only.');
if (JSON.stringify(manifest.validatedScope) !== JSON.stringify(VALIDATION_RECORD.validatedSignals)) throw new Error('Validation scope differs from the sealed signal registry.');

const fixtures = new Map();
for (const fixture of manifest.fixtures || []) {
  if (!fixture || typeof fixture.path !== 'string' || !/^[a-f0-9]{64}$/u.test(fixture.sha256 || '')) throw new Error('Every fixture requires a path and sealed SHA-256.');
  const bytes = await readFile(`fixtures/analytics/${fixture.path}`);
  const actual = sha256(bytes);
  if (actual !== fixture.sha256) throw new Error(`Fixture hash mismatch for ${fixture.path}: ${actual}.`);
  fixtures.set(fixture.path, JSON.parse(bytes));
}

const usedFixtures = new Set();
const consumedCases = new Set();
function useFixture(path) {
  const fixture = fixtures.get(path);
  if (!fixture || usedFixtures.has(path)) throw new Error(`Fixture missing or consumed more than once: ${path}.`);
  usedFixtures.add(path);
  return fixture;
}
function consume(path, id) {
  const key = `${path}#${id}`;
  if (consumedCases.has(key)) throw new Error(`Fixture case consumed more than once: ${key}.`);
  consumedCases.add(key);
}

const levelPath = 'audio/level-clipping-grid.v1.json';
const levelFixture = useFixture(levelPath);
let clippingTruePositive = 0;
let clippingFalsePositive = 0;
let clippingFalseNegative = 0;
let maxLevelAbsoluteErrorDb = 0;
for (const entry of levelFixture.cases) {
  consume(levelPath, entry.id);
  let samples;
  if (entry.kind === 'constant') samples = new Float32Array(1_000).fill(entry.amplitude);
  else if (entry.kind === 'sine') samples = Float32Array.from({ length: 4_800 }, (_, index) => entry.amplitude * Math.sin(2 * Math.PI * entry.frequencyHz * index / levelFixture.sampleRate));
  else if (entry.kind === 'prefix') samples = Float32Array.from(entry.samples);
  else if (entry.kind === 'ratio') samples = Float32Array.from({ length: entry.sampleCount }, (_, index) => index < entry.clippedSamples ? 1 : 0);
  else throw new Error(`Unsupported audio fixture kind: ${entry.kind}.`);
  const measured = measurePcmFrame(samples);
  if (Number.isFinite(entry.expectedPeak)) requireTruth(Math.abs(measured.peak - entry.expectedPeak) <= 1e-7, `${entry.id} peak mismatch.`);
  if (Number.isFinite(entry.expectedRms)) requireTruth(Math.abs(measured.rms - entry.expectedRms) <= 1e-6, `${entry.id} RMS mismatch.`);
  if (Number.isFinite(entry.expectedDbfs)) {
    const measuredDbfs = 20 * Math.log10(Math.max(measured.rms, 1e-8));
    maxLevelAbsoluteErrorDb = Math.max(maxLevelAbsoluteErrorDb, Math.abs(measuredDbfs - entry.expectedDbfs));
  }
  const predictedClipped = measured.clippedFraction > 0;
  if (predictedClipped && entry.expectedClipped) clippingTruePositive += 1;
  if (predictedClipped && !entry.expectedClipped) clippingFalsePositive += 1;
  if (!predictedClipped && entry.expectedClipped) clippingFalseNegative += 1;
}
const clippingPrecision = clippingTruePositive / Math.max(1, clippingTruePositive + clippingFalsePositive);
const clippingRecall = clippingTruePositive / Math.max(1, clippingTruePositive + clippingFalseNegative);
requireTruth(maxLevelAbsoluteErrorDb <= manifest.acceptance.levelAbsoluteErrorDb, `Level error ${maxLevelAbsoluteErrorDb} exceeds acceptance.`);
requireTruth(clippingPrecision >= manifest.acceptance.clippingPrecision, `Clipping precision ${clippingPrecision} is below acceptance.`);
requireTruth(clippingRecall >= manifest.acceptance.clippingRecall, `Clipping recall ${clippingRecall} is below acceptance.`);

const pausePath = 'audio/pause-grid.v1.json';
const pauseFixture = useFixture(pausePath);
for (const entry of pauseFixture.cases) {
  consume(pausePath, entry.id);
  const analyzer = new AudioSignalAnalyzer({ frameMs: pauseFixture.frameMs });
  analyzer.begin(0);
  let at = 0;
  const feed = (duration, rms) => { for (let elapsed = 0; elapsed < duration; elapsed += pauseFixture.frameMs) { analyzer.ingest({ atMs: at, rms, peak: rms, clippedFraction: 0 });at += pauseFixture.frameMs; } };
  feed(entry.leadSpeechMs, pauseFixture.speechRms);
  feed(entry.silenceMs, pauseFixture.silenceRms);
  feed(entry.tailSpeechMs, pauseFixture.speechRms);
  const result = analyzer.finish(at);
  if (Number.isFinite(entry.expectedPauseCount)) requireTruth(result.pauseEpisodes.length === entry.expectedPauseCount, `${entry.id} pause count mismatch.`);
  if (entry.expectedSpeech === true) requireTruth(result.responseStartLatencyMs !== null, `${entry.id} speech was not detected.`);
}

const timelinePath = 'timeline/synchronized-events.v1.json';
const timelineFixture = useFixture(timelinePath);
let clockNow = 0;
const clock = new SessionClock({ sessionId: timelineFixture.sessionId, now: () => clockNow, wallClock: () => 0 });
let maxClockAbsoluteErrorMs = 0;
for (const answer of timelineFixture.answers) {
  consume(timelinePath, answer.answerId);
  clockNow = answer.startMs;
  const started = clock.startAnswer(answer.answerId);
  clockNow = answer.endMs;
  const ended = clock.endAnswer(answer.answerId);
  maxClockAbsoluteErrorMs = Math.max(maxClockAbsoluteErrorMs, Math.abs(started.startedAtMs - answer.startMs), Math.abs(ended.endedAtMs - answer.endMs));
}
for (const [index, event] of timelineFixture.events.entries()) {
  consume(timelinePath, `event-${index + 1}-${event.answerId}-${event.metric}`);
  const answer = timelineFixture.answers.find((entry) => entry.answerId === event.answerId);
  requireTruth(Boolean(answer), `Timeline event ${index + 1} has no answer.`);
  requireTruth(event.startMs >= answer.startMs && event.endMs <= answer.endMs, `Timeline event ${index + 1} crosses answer bounds.`);
  maxClockAbsoluteErrorMs = Math.max(maxClockAbsoluteErrorMs, Math.abs((event.startMs - answer.startMs) - event.mediaStartMs));
}
requireTruth(maxClockAbsoluteErrorMs <= manifest.acceptance.clockAbsoluteErrorMs, `Clock error ${maxClockAbsoluteErrorMs} exceeds acceptance.`);

const visionPath = 'vision/compact-episodes.v1.json';
const visionFixture = useFixture(visionPath);
const compact = (entry) => ({
  faceCount: entry.faceCount,
  face: { present: true, box: { centerX: 0.5, centerY: 0.4, width: 0.3 }, yawProxyDeg: 0, pitchProxyDeg: 0, rollProxyDeg: 0, movementRatePerSecond: 0 },
  pose: { torsoPresent: true, shoulderWidth: 0.2, centerX: 0.5, centerY: 0.45, lateralLeanDeg: entry.leanDeg || 0 },
  hands: { left: { present: false }, right: { present: false } },
});
for (const entry of visionFixture.cases) {
  consume(visionPath, entry.id);
  const analyzer = new VisionEpisodeAnalyzer();
  analyzer.begin(0);
  for (let index = 0; index < entry.frames; index += 1) analyzer.ingest({ atMs: index * visionFixture.frameMs, expectedFrameMs: visionFixture.frameMs, geometry: compact(entry), inferenceMs: 10 });
  const result = analyzer.finish(entry.frames * visionFixture.frameMs);
  if (entry.expectedPersonSpecific !== undefined) requireTruth(result.personSpecificAvailable === entry.expectedPersonSpecific, `${entry.id} person-specific gate mismatch.`);
  if (entry.expectedMultipleFaces !== undefined) requireTruth(result.multipleFacesDetected === entry.expectedMultipleFaces, `${entry.id} multiple-face gate mismatch.`);
  if (entry.expectedLeanEpisodes !== undefined) requireTruth(result.episodes.filter((event) => event.metric === 'lateral_torso_lean').length === entry.expectedLeanEpisodes, `${entry.id} lean episode mismatch.`);
}

const securityPath = 'security/transcript-injection.v1.json';
const securityFixture = useFixture(securityPath);
for (const [index, hostile] of securityFixture.cases.entries()) {
  consume(securityPath, `case-${index + 1}`);
  let now = 0;
  const session = new AnalyticsSession({ sessionId: `security-${index}`, now: () => now, wallClock: () => 0 });
  session.beginAnswer({ answerId: 'a' });
  now = 10_000;
  const result = session.endAnswer({ transcript: hostile });
  requireTruth(!JSON.stringify(result).includes(hostile), `Transcript fixture ${index + 1} escaped into evidence.`);
  requireTruth(result.events.filter((event) => event.source.input === 'transcript').every((event) => event.maturity === 'FOUNDER_EXPERIMENTAL'), `Transcript fixture ${index + 1} reached student maturity.`);
}

requireTruth(usedFixtures.size === fixtures.size, 'Every sealed fixture file must be executed exactly once.');
const declaredCases = [...fixtures.values()].reduce((sum, fixture) => sum + (fixture.cases?.length || 0) + (fixture.events?.length || 0) + (fixture.answers?.length || 0), 0);
requireTruth(consumedCases.size === declaredCases, `Consumed ${consumedCases.size} of ${declaredCases} declared fixture cases.`);

const testFiles = (await readdir('test/analytics')).filter((name) => name.endsWith('.test.mjs')).sort().map((name) => `test/analytics/${name}`);
if (testFiles.length < 9) throw new Error('Analytics validation suite is incomplete.');
const testResult = spawnSync(process.execPath, ['--test', ...testFiles], { encoding: 'utf8' });
process.stdout.write(testResult.stdout);
if (testResult.status !== 0) {
  process.stderr.write(testResult.stderr);
  process.exit(testResult.status || 1);
}
process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  validationRecordId: VALIDATION_RECORD.id,
  manifestSha256: digest,
  fixtureFilesExecuted: usedFixtures.size,
  fixtureCasesExecuted: consumedCases.size,
  measured: {
    maxLevelAbsoluteErrorDb: Number(maxLevelAbsoluteErrorDb.toFixed(6)),
    clippingPrecision: Number(clippingPrecision.toFixed(6)),
    clippingRecall: Number(clippingRecall.toFixed(6)),
    maxClockAbsoluteErrorMs,
  },
  validatedSignals: VALIDATION_RECORD.validatedSignals,
  founderExperimentalSignalsRemainHidden: true,
  testModules: testFiles.length,
}, null, 2)}\n`);
