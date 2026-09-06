import {
  MODEL_ARCHITECTURES,
  MODEL_CANDIDATES,
} from '../config/models.mjs';
import { ProviderError, providerResponseError } from './errors.mjs';
import { probeOpenAIRealtimeModel } from './openai-realtime.mjs';

const MODELS_ENDPOINT = 'https://api.openai.com/v1/models';
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

function requireApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new ProviderError('OPENAI_API_KEY is not configured.', {
      code: 'openai_not_configured',
      status: 503,
      provider: 'openai',
      publicMessage: 'The OpenAI interviewer is not configured.',
    });
  }
  return apiKey;
}

function authHeaders(apiKey) {
  return { Authorization: `Bearer ${requireApiKey(apiKey)}`, 'Content-Type': 'application/json' };
}

async function listAuthenticatedModels({ apiKey, fetchImpl }) {
  let response;
  try { response = await fetchImpl(MODELS_ENDPOINT, { headers: authHeaders(apiKey) }); }
  catch (cause) {
    throw new ProviderError('OpenAI model discovery failed before a response was received.', {
      code: 'openai_model_discovery_network_failed',
      provider: 'openai',
      retryable: true,
      cause,
    });
  }
  if (!response?.ok) throw providerResponseError('openai', response, 'model_discovery');
  const payload = await response.json();
  return new Set(Array.isArray(payload?.data)
    ? payload.data.map((entry) => entry?.id).filter((id) => typeof id === 'string')
    : []);
}

async function probeResponsesModel({ apiKey, model, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model,
        store: false,
        input: 'Reply with exactly OK.',
        max_output_tokens: 16,
      }),
    });
  } catch (cause) {
    throw new ProviderError('OpenAI model capability probe failed before a response was received.', {
      code: 'openai_model_capability_network_failed',
      provider: 'openai',
      retryable: true,
      cause,
    });
  }
  if (!response?.ok) throw providerResponseError('openai', response, 'model_capability');
  const payload = await response.json();
  return {
    providerModelId: typeof payload?.model === 'string' ? payload.model : model,
    capability: 'probed',
  };
}

function publicFailure(candidate, error, catalogVisible) {
  const known = error instanceof ProviderError;
  return Object.freeze({
    id: candidate.id,
    architecture: candidate.architecture,
    status: 'unavailable',
    catalogVisible,
    reason: known ? error.code : 'model_capability_probe_failed',
    providerStatus: known ? error.providerStatus : null,
    retryable: known ? error.retryable : false,
  });
}

/**
 * Discovers and actively probes only the exact, frozen Founder Model Studio
 * candidates. The returned object is safe for a browser: it contains neither
 * credentials nor raw provider response bodies.
 */
export async function discoverOpenAIModels({
  apiKey = process.env.OPENAI_API_KEY,
  fetchImpl = globalThis.fetch,
  realtimeProbe = probeOpenAIRealtimeModel,
  realtimeProbeTimeoutMs = 10_000,
} = {}) {
  requireApiKey(apiKey);
  const catalog = await listAuthenticatedModels({ apiKey, fetchImpl });

  const outcomes = await Promise.all(MODEL_CANDIDATES.map(async (candidate) => {
    const catalogVisible = catalog.has(candidate.id);
    try {
      const capability = candidate.architecture === MODEL_ARCHITECTURES.NATIVE_REALTIME
        ? await realtimeProbe({ apiKey, model: candidate.id, timeoutMs: realtimeProbeTimeoutMs })
        : await probeResponsesModel({ apiKey, model: candidate.id, fetchImpl });
      return {
        ok: true,
        value: Object.freeze({
          id: candidate.id,
          providerModelId: capability.model || capability.providerModelId || candidate.id,
          architecture: candidate.architecture,
          capability: capability.capability || 'probed',
          catalogVisible,
        }),
      };
    } catch (error) {
      return { ok: false, value: publicFailure(candidate, error, catalogVisible) };
    }
  }));

  return Object.freeze({
    models: Object.freeze(outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.value)),
    failures: Object.freeze(outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.value)),
    discoveredAt: new Date().toISOString(),
  });
}
