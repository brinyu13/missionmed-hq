import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import net from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assetAliases from '../../infra/edge/generated-asset-aliases.mjs';

const routerFile = fileURLToPath(new URL('../../infra/edge/local-router.mjs', import.meta.url));
const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

test('local router serves only verified non-index aliases and denies raw logical paths', async (context) => {
  const port = await availablePort();
  const child = spawn(process.execPath, [routerFile], {
    env: {
      ...process.env,
      STORYFORGE_EDGE_PORT: String(port),
      STORYFORGE_EDGE_HOST: '127.0.0.1',
      STORYFORGE_EDGE_STATIC_DIR: distDir,
      STORYFORGE_EDGE_APP_ORIGIN: 'http://127.0.0.1:9',
      STORYFORGE_EDGE_WP_ORIGIN: 'http://127.0.0.1:9',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  context.after(() => {
    child.kill('SIGTERM');
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/storyforge/`);
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // The child has not bound its loopback socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(ready, true, stderr);

  assert.equal(Object.keys(assetAliases).length, 14);
  for (const [alias, entry] of Object.entries(assetAliases)) {
    const response = await fetch(`${base}/storyforge/_asset/${alias}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200, entry.path);
    assert.equal(bytes.length, entry.size, entry.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
    assert.equal(response.headers.get('content-type'), entry.type, entry.path);
    assert.equal(
      response.headers.get('cache-control'),
      entry.cache === 'immutable'
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
      entry.path,
    );

    const raw = await fetch(`${base}/storyforge/${entry.path}`);
    assert.equal(raw.status, 404, entry.path);
  }

  const index = await readFile(new URL('../../dist/index.html', import.meta.url));
  const indexAlias = createHash('sha256').update(index).digest('hex').slice(0, 12);
  assert.equal((await fetch(`${base}/storyforge/_asset/${indexAlias}`)).status, 404);
  assert.equal((await fetch(`${base}/storyforge/index.html`)).status, 404);
});
