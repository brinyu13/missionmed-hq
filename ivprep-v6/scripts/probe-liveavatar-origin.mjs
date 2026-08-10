import { fileURLToPath } from 'node:url';

import { validatedLiveAvatarLiveKitOrigin } from '../avatar/livekit-origin.mjs';
import { loadLocalEnvironment } from '../config/load-environment.mjs';
import { createAvatarProviderFromEnv } from '../providers/liveavatar-provider.mjs';

loadLocalEnvironment({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) });

const provider = createAvatarProviderFromEnv();
let evidence = null;
try {
  const started = await provider.start();
  if (started.status !== 'connected' || !started.media?.url) {
    throw new Error(started.reason || 'LiveAvatar server authorization is unavailable.');
  }
  validatedLiveAvatarLiveKitOrigin(started.media.url);
  evidence = {
    provider: 'liveavatar',
    mode: 'LITE',
    avatarId: started.avatarId,
    livekitOriginValidated: true,
    cleanupAcknowledged: false,
  };
} finally {
  await provider.close();
  if (evidence) {
    evidence.cleanupAcknowledged = true;
    console.log(JSON.stringify(evidence));
  }
}
