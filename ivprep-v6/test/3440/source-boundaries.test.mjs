import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

const hqSourceUrl = new URL('missionmed-hq/server.mjs', root);

test('HQ integration is a narrow mount and successful-logout notification', { skip: !existsSync(hqSourceUrl) }, async () => {
  const hq = await source('missionmed-hq/server.mjs');
  assert.match(hq, /handleIvPrepV6Request/u);
  assert.match(hq, /recordIvPrepHqLogout/u);
  assert.match(hq, /pathname === '\/api\/auth\/logout'/u);
  assert.match(hq, /if \(session && !validateCsrf\(request, session\)\)/u);
  assert.ok(hq.indexOf('recordIvPrepHqLogout') < hq.lastIndexOf("'Set-Cookie': clearSessionCookie(request)"));
});

test('product admission never projects shared access tokens or bearer auth', async () => {
  const mount = await source('ivprep-v6/server/hq-mount.mjs');
  const admission = await source('ivprep-v6/server/admission-contract.mjs');
  assert.equal(mount.includes('accessToken'), false);
  assert.equal(admission.includes('accessToken'), false);
  assert.match(mount, /request\.headers\.authorization/u);
  assert.equal(mount.includes('console.'), false);
});

test('browser vault is server-sourced and donor fixtures are not imported', async () => {
  const app = await source('ivprep-v6/public/aaa/app.mjs');
  assert.match(app, /loadVault/u);
  assert.equal(/import[\s\S]{0,160}VAULT_SESSIONS/u.test(app), false);
  assert.match(app, /vaultSessions: \[\]/u);
});

test('ElevenLabs remains conditional and only the corrected multi-stream path is named', async () => {
  const packageJson = JSON.parse(await source('ivprep-v6/package.json'));
  assert.equal(packageJson.dependencies['@livekit/agents-plugin-elevenlabs'], undefined);
  const providerSources = await Promise.all([
    source('ivprep-v6/server/providers/openai-realtime-adapter.mjs'),
    source('ivprep-v6/server/providers/lemonslice-avatar-adapter.mjs'),
    source('ivprep-v6/server/providers/livekit-session-coordinator.mjs'),
  ]);
  assert.equal(providerSources.join('\n').includes('/stream-input'), false);
  const elevenlabs = await source('ivprep-v6/server/providers/elevenlabs-tts-adapter.mjs');
  assert.match(elevenlabs, /\/v1\/text-to-speech\/\$\{value\}\/multi-stream-input/u);
});
