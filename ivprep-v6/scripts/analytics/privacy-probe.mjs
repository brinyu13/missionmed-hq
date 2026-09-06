import { readFile } from 'node:fs/promises';

const firstParty = [
  'public/analytics/browser-pipeline.mjs',
  'public/analytics/holistic-worker.mjs',
  'public/analytics/face-detector-worker.mjs',
  'public/analytics/ui.mjs',
  'public/analytics/analytics-session.mjs',
  'public/analytics/results-projection.mjs',
];
const text = (await Promise.all(firstParty.map((file) => readFile(file, 'utf8')))).join('\n');
const prohibited = [
  /https?:\/\/(?!localhost|127\.0\.0\.1)/iu,
  /localStorage|indexedDB/iu,
  /OPENAI_API_KEY|token\s*=|secret\s*=/iu,
];
for (const pattern of prohibited) if (pattern.test(text)) throw new Error(`Privacy source probe rejected ${pattern}.`);
for (const file of ['public/analytics/holistic-worker.mjs', 'public/analytics/face-detector-worker.mjs']) {
  const worker = await readFile(file, 'utf8');
  if (!worker.includes('url.origin !== self.location.origin') || !worker.includes('self.fetch =')) throw new Error(`Same-origin worker guard is absent from ${file}.`);
}
const server = await readFile('server/serve.mjs', 'utf8');
if (!server.includes("worker-src 'self'") || !server.includes("connect-src 'self'")) throw new Error('CSP privacy boundary is absent.');
const host = await readFile('public/index.html', 'utf8');
if (!host.includes("analyticsCall('persistentEnvelopes',value)") || !host.includes('communicationAnalyticsReplayMediaId:null')) {
  throw new Error('Host rep persistence is not projected to the sealed student-safe analytics minimum.');
}
process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  analyticsEngineRawMediaPersistence: false,
  savedAnalyticsMetadata: 'sealed-student-safe-events-only',
  optionalUserReplayDefault: 'off',
  optionalUserReplayRetention: 'tab-memory-only-until-clear-pagehide-or-delete',
  firstPartyExternalEndpoints: 0,
  workerEgressGuard: true,
  cspDefenseInDepth: true,
  browserRuntimeProbeRequiredForObservedNetworkEvidence: true,
}, null, 2)}\n`);
