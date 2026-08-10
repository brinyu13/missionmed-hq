import { fileURLToPath } from 'node:url';

import { verifyLockedLiveAvatarAssets } from '../../avatar/asset-verification.mjs';
import { validatedLiveAvatarLiveKitOrigin } from '../../avatar/livekit-origin.mjs';
import { LIVE_INTERVIEWER_TARGET } from '../../avatar/live-interviewer-target.mjs';
import { liveAvatarModeStartupDecision, resolveLiveAvatarProviderMode } from '../../avatar/liveavatar-modes.mjs';
import { loadLocalEnvironment } from '../../config/load-environment.mjs';
import { publicProviderError } from '../../providers/errors.mjs';
import { createAvatarProviderFromEnv } from '../../providers/liveavatar-provider.mjs';
import { startIvPrepServer } from '../../server/serve.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
loadLocalEnvironment({ path: `${root}.env` });
loadLocalEnvironment({ path: `${root}.env.local` });
const providerMode = resolveLiveAvatarProviderMode(process.env.LIVEAVATAR_MODE || 'lite');
const modeStartup = liveAvatarModeStartupDecision(providerMode);

let startupStage = 'metadata-verification';

async function bootstrap() {
  const evidence = await verifyLockedLiveAvatarAssets({ apiKey: process.env.LIVEAVATAR_API_KEY });
  if (!evidence.avatar.verified || !evidence.voice.verified) {
    throw new Error('Locked LiveAvatar target verification failed.');
  }
  process.env.LIVEAVATAR_AUTHENTICATED_AVATAR_VERIFIED = 'true';
  process.env.LIVEAVATAR_AUTHENTICATED_VOICE_VERIFIED = 'true';
  process.env.LIVEAVATAR_LOCKED_VOICE_COMPATIBLE = 'false';

  if (!modeStartup.bootstrapProvider) {
    process.env.LIVEAVATAR_START_BLOCK = modeStartup.block;
    console.log(JSON.stringify({
      provider: 'liveavatar',
      providerMode,
      authenticatedTargetsVerified: true,
      lockedAvatarVerified: true,
      lockedVoiceMetadataVerified: true,
      lockedProviderVoiceCompatible: false,
      modeImplemented: false,
      liveSessionBlocked: modeStartup.block,
      fallback: modeStartup.fallback,
    }));
    return;
  }

  const provider = createAvatarProviderFromEnv();
  let cleanupAcknowledged = false;
  let failedStage = null;
  try {
    startupStage = 'authenticated-session-start';
    const started = await provider.start();
    if (
      started?.status !== 'connected'
      || started.avatarId !== LIVE_INTERVIEWER_TARGET.avatarId
      || !started.media?.url
      || !started.media?.clientToken
    ) throw new Error('LiveAvatar bootstrap did not establish the locked media session.');
    startupStage = 'provider-origin-validation';
    process.env.LIVEAVATAR_LIVEKIT_ORIGIN = validatedLiveAvatarLiveKitOrigin(started.media.url);
  } catch (error) {
    failedStage = startupStage;
    throw error;
  } finally {
    startupStage = 'bootstrap-cleanup';
    await provider.close();
    cleanupAcknowledged = true;
    if (failedStage) startupStage = failedStage;
  }

  console.log(JSON.stringify({
    provider: 'liveavatar',
    providerMode,
    authenticatedTargetsVerified: true,
    lockedAvatarVerified: true,
    lockedVoiceMetadataVerified: true,
    lockedProviderVoiceCompatible: false,
    livekitOriginValidated: true,
    bootstrapCleanupAcknowledged: cleanupAcknowledged,
  }));
}

try {
  await bootstrap();
  startupStage = 'local-server-start';
  await startIvPrepServer();
} catch (error) {
  const sanitized = publicProviderError(error);
  const failure = {
    started: false,
    stage: startupStage,
    code: sanitized.code || 'authenticated_founder_start_failed',
    providerStatus: Number.isInteger(error?.providerStatus) ? error.providerStatus : null,
  };
  console.error(JSON.stringify(failure));
  if (sanitized.code === 'liveavatar_insufficient_credits') {
    process.env.LIVEAVATAR_START_BLOCK = 'insufficient-credits';
    console.log(JSON.stringify({
      provider: 'liveavatar',
      providerMode,
      authenticatedTargetsVerified: true,
      lockedAvatarVerified: true,
      lockedVoiceMetadataVerified: true,
      lockedProviderVoiceCompatible: false,
      livekitOriginValidated: false,
      liveSessionBlocked: 'insufficient-credits',
      fallback: 'voice-only',
    }));
    await startIvPrepServer();
  } else {
    process.exitCode = 1;
  }
}
