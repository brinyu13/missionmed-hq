import { performance } from 'node:perf_hooks';

import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import { serializeAnalyticsEnvelope } from '../../analytics/event-contract.mjs';

const durationSeconds = Number(process.argv.find((arg) => arg.startsWith('--duration-seconds='))?.split('=')[1] || 900);
if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 3_600) throw new TypeError('Duration must be between 60 and 3600 seconds.');
const frameMs = 125;
const frameCount = Math.round(durationSeconds * 1_000 / frameMs);
let now = 0;
const session = new AnalyticsSession({ sessionId: 'synthetic-performance', now: () => now, wallClock: () => 0 });
session.beginAnswer({ answerId: 'endurance', hasCamera: true });
const started = performance.now();
for (let index = 0; index < frameCount; index += 1) {
  now = index * frameMs;
  const motion = index % 8 < 4;
  session.ingestVision({
    atMs: now,
    inferenceMs: 20 + (index % 7),
    geometry: {
      faceCount: 1,
      face: { present: true, box: { centerX: .5, centerY: .4, width: .3 }, yawProxyDeg: 0, pitchProxyDeg: 0, rollProxyDeg: 0, movementRatePerSecond: 0 },
      pose: { torsoPresent: true, shoulderWidth: .2, centerX: .5 + (index % 16 < 8 ? .02 : -.02), centerY: .45, lateralLeanDeg: index % 20 < 8 ? 15 : 0 },
      hands: { left: { present: true, wristX: motion ? (index % 2 ? .45 : .4) : .4, wristY: .5, zone: 'chest' }, right: { present: false } },
    },
  });
}
now = durationSeconds * 1_000;
const result = session.endAnswer();
const serialized = serializeAnalyticsEnvelope(result);
const elapsedMs = performance.now() - started;
const bytes = new TextEncoder().encode(serialized).byteLength;
const report = {
  status: result.events.length <= 260 && bytes <= 256_000 && elapsedMs <= 5_000 ? 'PASS' : 'FAIL',
  logicalDurationSeconds: durationSeconds,
  frames: frameCount,
  processingElapsedMs: Number(elapsedMs.toFixed(2)),
  events: result.events.length,
  envelopeBytes: bytes,
  visualInferenceP95Ms: result.performance.visualInferenceP95Ms,
  rawMediaRetained: false,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.status !== 'PASS') process.exit(1);
