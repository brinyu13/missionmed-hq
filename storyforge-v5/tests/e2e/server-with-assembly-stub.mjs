import { createAppServer, createPhaseOneRuntime } from '../../server/app.mjs';
import { config, validateConfig } from '../../server/config.mjs';
import { closePool, healthCheck } from '../../server/db.mjs';

const errors = validateConfig();
if (errors.length) {
  throw new Error(`StoryForge E2E configuration is invalid: ${errors.join('; ')}`);
}

// B1-514 product surfaces remain database-default-off. The isolated browser
// database opts individual fixtures in; these process controls merely permit
// the E2E server to exercise those explicitly enabled rows.
process.env.STORYFORGE_VISIBILITY_CONSENT_FORCE_OFF = '0';
process.env.STORYFORGE_STORY_VERSIONS_FORCE_OFF = '0';
process.env.STORYFORGE_INSPIRATION_FORCE_OFF = '0';
process.env.STORYFORGE_REQUEST_A_STORY_FORCE_OFF = '0';
process.env.STORYFORGE_GUEST_FORCE_OFF = '0';
process.env.STORYFORGE_GUEST_CONTRIBUTIONS_FORCE_OFF = '0';
process.env.STORYFORGE_REQUEST_LIFECYCLE_FORCE_OFF = '0';
process.env.STORYFORGE_GUEST_DISCLOSURE_VERSION = 'b1-514-e2e-v1';
process.env.STORYFORGE_PUBLIC_URL = 'https://missionmedinstitute.com/storyforge';
process.env.STORYFORGE_PUBLIC_ORIGIN = 'https://missionmedinstitute.com';
process.env.STORYFORGE_BASE_PATH = '/storyforge/';
process.env.STORYFORGE_POSTMARK_ENABLED = '1';
process.env.STORYFORGE_POSTMARK_DRY_RUN = '1';
process.env.STORYFORGE_POSTMARK_FROM = 'storyforge-e2e@missionmed.example';
process.env.STORYFORGE_POSTMARK_REPLY_TO = 'storyforge-e2e@missionmed.example';
process.env.STORYFORGE_GATEWAY_SHARED_SECRET = 'b1-514-e2e-gateway-secret-32-bytes-minimum';
process.env.STORYFORGE_STORY_ARCHIVE_FORCE_OFF = '0';
process.env.STORYFORGE_PEER_SHARE_FORCE_OFF = '0';
process.env.STORYFORGE_STORY_PROMOTIONS_FORCE_OFF = '0';
process.env.STORYFORGE_PER_USE_SCORING_FORCE_OFF = '0';
process.env.STORYFORGE_ADMIN_REVIEW_CONTROLS_FORCE_OFF = '0';
process.env.STORYFORGE_VOICE_CAPTURE_FORCE_OFF = '0';

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
