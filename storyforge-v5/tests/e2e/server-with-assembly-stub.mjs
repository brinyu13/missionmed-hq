import { createAppServer, createPhaseOneRuntime } from '../../server/app.mjs';
import { config, validateConfig } from '../../server/config.mjs';
import { closePool, healthCheck } from '../../server/db.mjs';

const errors = validateConfig();
if (errors.length) {
  throw new Error(`StoryForge E2E configuration is invalid: ${errors.join('; ')}`);
}

// This test-only executor proves the E4/E7 browser path through the production
// injection boundary without selecting production Option A or Option B.
const phaseOneRuntime = createPhaseOneRuntime({
  assembly: Object.freeze({
    available: true,
    async assembleRecording() {},
  }),
});

await healthCheck();
await phaseOneRuntime.recordingsService.recoverPendingTranscriptions();
await phaseOneRuntime.recordingsService.recoverPendingAssemblies();
await phaseOneRuntime.recordingsService.recoverPendingAudioAssets();
const sweeps = phaseOneRuntime.recordingsService.startSweeps();
const server = createAppServer({ phaseOneRuntime });

server.listen(config.port, config.host, () => {
  console.log(`StoryForge V5 E2E server listening on ${config.host}:${config.port}`);
});

const shutdown = async () => {
  sweeps.stop();
  server.close();
  await closePool();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
