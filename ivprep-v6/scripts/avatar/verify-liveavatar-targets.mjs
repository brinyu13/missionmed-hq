import { fileURLToPath } from 'node:url';

import { verifyLockedLiveAvatarAssets } from '../../avatar/asset-verification.mjs';
import { loadLocalEnvironment } from '../../config/load-environment.mjs';
import { publicProviderError } from '../../providers/errors.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
loadLocalEnvironment({ path: `${root}.env` });
loadLocalEnvironment({ path: `${root}.env.local` });

try {
  const evidence = await verifyLockedLiveAvatarAssets({ apiKey: process.env.LIVEAVATAR_API_KEY });
  console.log(JSON.stringify(evidence));
  if (!evidence.avatar.verified || !evidence.voice.verified) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ authenticated: false, ...publicProviderError(error) }));
  process.exitCode = 1;
}
