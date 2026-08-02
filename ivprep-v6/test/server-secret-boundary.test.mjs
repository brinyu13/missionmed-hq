import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createIvPrepServer, requireLocalAlphaHost } from '../server/serve.mjs';

test('local Founder Alpha refuses non-loopback exposure', () => {
  assert.equal(requireLocalAlphaHost('127.0.0.1'), '127.0.0.1');
  assert.equal(requireLocalAlphaHost('localhost'), 'localhost');
  assert.equal(requireLocalAlphaHost('::1'), '::1');
  assert.throws(() => requireLocalAlphaHost('0.0.0.0'), /loopback host/u);
  assert.throws(() => requireLocalAlphaHost('192.168.1.20'), /loopback host/u);
});

test('server startup fails closed when HOST requests all-interface exposure', () => {
  const serverPath = fileURLToPath(new URL('../server/serve.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [serverPath], {
    encoding: 'utf8',
    env: { HOST: '0.0.0.0', PORT: '18320' },
    timeout: 5_000,
  });

  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /listening on/u);
  assert.match(result.stderr, /failed_to_start/u);
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) return sourceFiles(url);
    return /\.(?:html|m?js)$/u.test(entry.name) ? [url] : [];
  }));
  return nested.flat();
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test('browser-delivered files contain no server credential access or authorization material', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const files = await sourceFiles(publicDirectory);
  assert.ok(files.length > 0);

  const prohibited = [
    /OPENAI_API_KEY/u,
    /process\.env/u,
    /Authorization\s*:/u,
    /Bearer\s+/u,
    /client_secret/u,
    /\/v1\/realtime\/client_secrets/u,
    /\bsk-[A-Za-z0-9_-]{8,}/u,
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const pattern of prohibited) {
      assert.doesNotMatch(source, pattern, `${file.pathname} crossed the server-only secret boundary`);
    }
  }
});

test('health and Founder configuration responses never serialize the server API key', async (t) => {
  const apiKey = 'server-only-test-secret-never-return';
  const discovery = {
    models: [{ id: 'gpt-5.6-terra', architecture: 'responses-openai-speech', providerModelId: 'gpt-5.6-terra' }],
    failures: [],
    discoveredAt: '2026-08-02T00:00:00.000Z',
  };
  const server = createIvPrepServer({
    apiKey,
    modelDiscovery: async (options) => {
      assert.equal(options.apiKey, apiKey, 'the key remains inside the server/provider call');
      return discovery;
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);

  for (const path of [
    '/api/health',
    '/api/model-studio-config',
    '/api/voice-studio-config',
    '/api/avatar-provider-config',
  ]) {
    const response = await fetch(`${origin}${path}`);
    const text = await response.text();
    assert.equal(response.status, 200, path);
    assert.equal(text.includes(apiKey), false, `${path} leaked the API key`);
    assert.equal(text.includes('OPENAI_API_KEY'), false, `${path} exposed the environment variable name`);
    assert.doesNotMatch(text, /Authorization|Bearer\s+/u, `${path} exposed authorization material`);
    assert.doesNotThrow(() => JSON.parse(text));
  }
});

test('a mocked interviewer exchange receives the key server-side but never serializes it', async (t) => {
  const apiKey = 'server-only-exchange-secret-never-return';
  const models = [
    { id: 'gpt-5.6-terra', architecture: 'responses-openai-speech' },
    { id: 'gpt-5.6-luna', architecture: 'responses-openai-speech' },
  ];
  let exchangeCalled = false;
  const server = createIvPrepServer({
    apiKey,
    modelDiscovery: async () => ({ models, failures: [], discoveredAt: null }),
    interviewerExchange: async (options) => {
      exchangeCalled = true;
      assert.equal(options.apiKey, apiKey, 'the API key is available only to the server provider call');
      assert.equal(options.model, 'gpt-5.6-terra');
      assert.equal(options.observerModel, 'gpt-5.6-luna');
      return {
        requestedModel: options.model,
        model: options.model,
        observerModel: options.observerModel,
        utterance: 'Tell me about a difficult clinical decision.',
        metadata: { disposition: 'continue' },
        timings: { naturalMs: 7, observerMs: 3, totalMs: 10 },
        usage: null,
      };
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);

  const response = await fetch(`${origin}/api/interviewer-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-terra',
      observerModel: 'gpt-5.6-luna',
      context: { latestApplicantAnswer: 'I escalated the concern to my attending.' },
    }),
  });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(exchangeCalled, true);
  assert.equal(text.includes(apiKey), false);
  assert.doesNotMatch(text, /OPENAI_API_KEY|Authorization|Bearer\s+|client_secret/u);
  assert.equal(JSON.parse(text).utterance, 'Tell me about a difficult clinical decision.');
});

test('an unconfigured server fails model discovery as a sanitized 503 without network access', async (t) => {
  let fetchCalled = false;
  const server = createIvPrepServer({
    apiKey: '',
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('network must not be reached without a key');
    },
  });
  t.after(() => close(server));
  const origin = await listen(server);

  const healthResponse = await fetch(`${origin}/api/health`);
  const health = await healthResponse.json();
  assert.equal(health.openaiConfigured, false);

  const response = await fetch(`${origin}/api/model-studio-config`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    error: 'The OpenAI interviewer is not configured.',
    code: 'openai_not_configured',
    provider: 'openai',
    retryable: false,
  });
  assert.equal(fetchCalled, false);
  assert.equal(JSON.stringify(body).includes('OPENAI_API_KEY'), false);
});
