import { fileURLToPath } from 'node:url';

import { loadLocalEnvironment } from '../config/load-environment.mjs';
import { createAvatarProviderFromEnv } from '../providers/liveavatar-provider.mjs';

loadLocalEnvironment({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) });

const provider = createAvatarProviderFromEnv();
try {
  const started = await provider.start();
  if (started.status !== 'connected' || !started.media?.url) {
    throw new Error(started.reason || 'LiveAvatar server authorization is unavailable.');
  }
  console.log(JSON.stringify({
    provider: 'liveavatar',
    mode: 'LITE',
    avatarId: started.avatarId,
    livekitOrigin: new URL(started.media.url).origin,
  }, null, 2));
} catch (error) {
  console.error(error?.publicMessage || 'LiveAvatar origin probe could not start.');
  process.exitCode = 1;
} finally {
  await provider.close().catch(() => {});
}
