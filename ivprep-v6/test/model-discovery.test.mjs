import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { MODEL_CANDIDATES } from '../config/models.mjs';

async function loadDiscoveryWithoutOpeningTheRealtimeTransport() {
  const sourceUrl = new URL('../providers/openai-model-discovery.mjs', import.meta.url);
  const modelsUrl = new URL('../config/models.mjs', import.meta.url).href;
  const errorsUrl = new URL('../providers/errors.mjs', import.meta.url).href;
  const source = (await readFile(sourceUrl, 'utf8'))
    .replace("'../config/models.mjs'", JSON.stringify(modelsUrl))
    .replace("'./errors.mjs'", JSON.stringify(errorsUrl))
    .replace(
      "import { probeOpenAIRealtimeModel } from './openai-realtime.mjs';",
      "const probeOpenAIRealtimeModel = async () => { throw new Error('Realtime transport was not injected.'); };",
    );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const { discoverOpenAIModels } = await loadDiscoveryWithoutOpeningTheRealtimeTransport();

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => payload };
}

test('model discovery probes only the exact frozen candidates and preserves provider-returned IDs', async () => {
  const responseProbes = [];
  const realtimeProbes = [];
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/models')) {
      return jsonResponse({ data: MODEL_CANDIDATES.map(({ id }) => ({ id })) });
    }

    const body = JSON.parse(options.body);
    responseProbes.push(body.model);
    return jsonResponse({ model: `${body.model}-provider-revision` });
  };
  const realtimeProbe = async ({ model }) => {
    realtimeProbes.push(model);
    return { model: `${model}-provider-revision`, capability: 'probed' };
  };

  const result = await discoverOpenAIModels({
    apiKey: 'test-key-never-logged',
    fetchImpl,
    realtimeProbe,
  });

  assert.deepEqual(result.models.map(({ id }) => id), MODEL_CANDIDATES.map(({ id }) => id));
  assert.deepEqual(responseProbes, MODEL_CANDIDATES.slice(0, 3).map(({ id }) => id));
  assert.deepEqual(realtimeProbes, MODEL_CANDIDATES.slice(3).map(({ id }) => id));
  assert.deepEqual(
    result.models.map(({ id, providerModelId }) => [id, providerModelId]),
    MODEL_CANDIDATES.map(({ id }) => [id, `${id}-provider-revision`]),
    'a provider revision must remain separately visible, never replace the requested ID',
  );
  assert.deepEqual(result.failures, []);
});

test('a failed exact candidate remains an explicit failure and is never replaced', async () => {
  const failedModel = 'gpt-5.6-terra';
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith('/models')) return jsonResponse({ data: [] });
    const { model } = JSON.parse(options.body);
    if (model === failedModel) return jsonResponse({}, { ok: false, status: 404 });
    return jsonResponse({ model });
  };

  const result = await discoverOpenAIModels({
    apiKey: 'test-key-never-logged',
    fetchImpl,
    realtimeProbe: async ({ model }) => ({ model, capability: 'probed' }),
  });

  assert.equal(result.models.some(({ id }) => id === failedModel), false);
  assert.deepEqual(result.failures, [{
    id: failedModel,
    architecture: 'responses-openai-speech',
    status: 'unavailable',
    catalogVisible: false,
    reason: 'openai_model_capability_failed',
    providerStatus: 404,
    retryable: false,
  }]);
  assert.equal(result.models.length + result.failures.length, MODEL_CANDIDATES.length);
  assert.deepEqual(
    [...result.models.map(({ id }) => id), ...result.failures.map(({ id }) => id)].sort(),
    MODEL_CANDIDATES.map(({ id }) => id).sort(),
  );
});

test('missing credentials fail before network access with a sanitized public error', async () => {
  let fetchCalled = false;
  await assert.rejects(
    discoverOpenAIModels({
      apiKey: '',
      fetchImpl: async () => { fetchCalled = true; },
    }),
    (error) => {
      assert.equal(error.code, 'openai_not_configured');
      assert.equal(error.status, 503);
      assert.equal(error.publicMessage, 'The OpenAI interviewer is not configured.');
      assert.equal(JSON.stringify(error).includes('test-key'), false);
      return true;
    },
  );
  assert.equal(fetchCalled, false);
});
