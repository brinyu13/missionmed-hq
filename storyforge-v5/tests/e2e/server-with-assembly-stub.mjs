import { createAppServer, createPhaseOneRuntime } from '../../server/app.mjs';
import { config, validateConfig } from '../../server/config.mjs';
import { closePool, healthCheck, withIdentity } from '../../server/db.mjs';
import { createMentorNotesService } from '../../server/mentor-notes.mjs';

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
process.env.STORYFORGE_AVATAR_IDENTITY_FORCE_OFF = '0';

// This test-only executor proves the E4/E7 browser path through the production
// injection boundary without selecting production Option A or Option B.
const deterministicTranscription = Object.freeze({
  available: true,
  keywordsForDraft() { return []; },
  async transcribeSegment(input = {}) {
    return {
      text: `Deterministic near-live transcript segment ${Number(input.seq || 0) + 1}.`,
      providerId: 'openai',
      modelId: 'gpt-4o-mini-transcribe',
      fallbackUsed: false,
      flaggedTerms: [],
    };
  },
});

const phaseOneRuntime = createPhaseOneRuntime({
  transcription: deterministicTranscription,
  assembly: Object.freeze({
    available: true,
    async assembleRecording() {},
  }),
});

// The isolated browser suite exercises the complete mentor Stop -> review ->
// publish path without external R2 traffic. Authorization, note lifecycle,
// transcript persistence, and playback claims still pass through production
// service/RPC boundaries; only object bytes live in this process.
const isolatedAudioObjects = new Map();
const mentorNotesService = createMentorNotesService({
  withIdentity,
  transcription: deterministicTranscription,
  storage: {
    async putRecordingSegment({ objectKey, contentType, body, byteSize }) {
      isolatedAudioObjects.set(objectKey, { contentType, body: Buffer.from(body), byteSize });
    },
    async headAudioObject({ objectKey }) {
      const object = isolatedAudioObjects.get(objectKey);
      if (!object) throw Object.assign(new Error('Audio object not found.'), { code: 'NoSuchKey' });
      return { contentType: object.contentType, byteSize: object.byteSize };
    },
    async deleteRecordingObjects({ objectKeys = [] } = {}) {
      objectKeys.forEach((objectKey) => isolatedAudioObjects.delete(objectKey));
    },
  },
  async signPlayback({ objectKey }) {
    if (!isolatedAudioObjects.has(objectKey)) throw new Error('Audio object not found.');
    return { playbackUrl: `https://audio.test/${encodeURIComponent(objectKey)}`, expiresIn: 60 };
  },
});

await healthCheck();
await phaseOneRuntime.recordingsService.recoverPendingTranscriptions();
await phaseOneRuntime.recordingsService.recoverPendingAssemblies();
await phaseOneRuntime.recordingsService.recoverPendingAudioAssets();
const sweeps = phaseOneRuntime.recordingsService.startSweeps();
const server = createAppServer({ phaseOneRuntime, mentorNotesService });

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
