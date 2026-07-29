import { keywordsForDraft } from './keywords.mjs';
import { flagLexiconTerms } from './lexicon.mjs';
import {
  createOpenAIGpt4oTranscribeDriver,
} from './openai-gpt-4o-transcribe.mjs';
import {
  createOpenAIWhisper1Driver,
} from './openai-whisper1.mjs';

const safeCodes = new Set([
  'transcribe_unavailable',
  'transcribe_timeout',
  'transcribe_rejected_format',
  'transcribe_failed_permanent',
]);
const usageMetricNames = Object.freeze([
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'durationSeconds',
  'inputAudioTokens',
  'inputTextTokens',
  'outputAudioTokens',
  'outputTextTokens',
]);

export class TranscriptionError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'TranscriptionError';
    this.code = safeCodes.has(code) ? code : 'transcribe_failed_permanent';
  }
}

function requireDriver(driver, name) {
  if (!driver || typeof driver.transcribeSegment !== 'function') {
    throw new TypeError(`${name}.transcribeSegment must be supplied.`);
  }
  return driver;
}

function normalizeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({});
  }
  return Object.freeze(Object.fromEntries(
    usageMetricNames
      .map((name) => [name, Number(value[name])])
      .filter(([, metric]) => Number.isFinite(metric) && metric >= 0),
  ));
}

function normalizeResult(result, startedAt, now) {
  return {
    text: String(result?.text || ''),
    ...(Array.isArray(result?.words) ? { words: result.words } : {}),
    ...(Number.isFinite(Number(result?.confidence))
      ? { confidence: Number(result.confidence) }
      : {}),
    flaggedTerms: Array.isArray(result?.flaggedTerms) ? result.flaggedTerms : [],
    providerId: result?.providerId ? String(result.providerId) : null,
    modelId: result?.modelId ? String(result.modelId) : null,
    usage: normalizeUsage(result?.usage),
    latencyMs: Number.isFinite(Number(result?.latencyMs))
      ? Math.max(0, Math.round(Number(result.latencyMs)))
      : Math.max(0, now() - startedAt),
  };
}

function normalizedFailure(error) {
  if (error instanceof TranscriptionError) return error;
  if (error?.name === 'AbortError' || error?.code === 'request_timeout') {
    return new TranscriptionError('transcribe_timeout', 'Transcription timed out.', { cause: error });
  }
  return new TranscriptionError(
    safeCodes.has(error?.code) ? error.code : 'transcribe_unavailable',
    'Transcription is currently unavailable.',
    { cause: error },
  );
}

function providerStatus(error) {
  const value = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return Number.isInteger(value) ? value : 0;
}

function timeoutFailure(error) {
  return error?.name === 'AbortError'
    || error?.code === 'request_timeout'
    || error?.code === 'transcribe_timeout';
}

function serverFailure(error) {
  const status = providerStatus(error);
  return status >= 500 && status <= 599;
}

function hardPrimaryFailure(error) {
  if (error?.providerFailure === 'hard') return true;
  const status = providerStatus(error);
  return status >= 400
    && status <= 499
    && ![408, 409, 425, 429].includes(status);
}

function flagSpanKey(flag) {
  const start = Number(flag?.start);
  const end = Number(flag?.end);
  if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start) {
    return `${start}:${end}`;
  }
  return String(flag?.from || '').trim().toLowerCase();
}

function mergeFlaggedTerms(lexiconFlags, providerFlags) {
  const lexiconKeys = new Set(lexiconFlags.map(flagSpanKey));
  return [
    ...lexiconFlags,
    ...providerFlags.filter((flag) => !lexiconKeys.has(flagSpanKey(flag))),
  ];
}

export function createTranscriptionAdapter({
  primary,
  fallback = null,
  lexiconMatcher = flagLexiconTerms,
  emitEvent = () => {},
  now = () => Date.now(),
}) {
  const primaryDriver = requireDriver(primary, 'primary');
  const fallbackDriver = fallback ? requireDriver(fallback, 'fallback') : null;
  if (typeof emitEvent !== 'function') throw new TypeError('emitEvent must be a function.');
  const sessions = new Map();

  async function run(driver, input) {
    const startedAt = now();
    const result = normalizeResult(await driver.transcribeSegment(input), startedAt, now);
    const lexiconFlags = lexiconMatcher(result.text);
    result.flaggedTerms = mergeFlaggedTerms(lexiconFlags, result.flaggedTerms);
    return result;
  }

  async function runWithImmediateRetry(driver, input) {
    try {
      return await run(driver, input);
    } catch (error) {
      if (!timeoutFailure(error) && !serverFailure(error)) throw error;
      return run(driver, input);
    }
  }

  function sessionState(input) {
    const recordingId = String(input?.recordingId || '');
    if (!recordingId) {
      return {
        recordingId: '',
        fallback: false,
        consecutive5xx: 0,
        failoverAuditPending: false,
      };
    }
    if (!sessions.has(recordingId)) {
      sessions.set(recordingId, {
        recordingId,
        fallback: false,
        consecutive5xx: 0,
        failoverAuditPending: false,
      });
    }
    return sessions.get(recordingId);
  }

  function switchSessionToFallback(state, input) {
    if (!fallbackDriver || state.fallback) return;
    state.fallback = true;
    state.failoverAuditPending = true;
    emitEvent(Object.freeze({
      t: new Date(now()).toISOString(),
      event: 'provider_failover',
      ...(state.recordingId ? { recordingId: state.recordingId } : {}),
      ...(input?.studentId ? { studentId: String(input.studentId) } : {}),
      errorCategory: 'transcribe',
    }));
  }

  async function transcribeSegment(input) {
    const state = sessionState(input);
    if (state.fallback && fallbackDriver) {
      try {
        return await runWithImmediateRetry(fallbackDriver, input);
      } catch (error) {
        throw normalizedFailure(error);
      }
    }
    try {
      const result = await runWithImmediateRetry(primaryDriver, input);
      state.consecutive5xx = 0;
      return result;
    } catch (primaryError) {
      const normalized = normalizedFailure(primaryError);
      if (!fallbackDriver) throw normalized;

      if (normalized.code === 'transcribe_rejected_format') {
        try {
          return await runWithImmediateRetry(fallbackDriver, input);
        } catch (fallbackError) {
          throw normalizedFailure(fallbackError);
        }
      }

      if (serverFailure(primaryError)) {
        state.consecutive5xx += 1;
        if (state.consecutive5xx < 3) throw normalized;
        switchSessionToFallback(state, input);
      } else if (hardPrimaryFailure(primaryError)) {
        switchSessionToFallback(state, input);
      } else {
        throw normalized;
      }

      try {
        return await runWithImmediateRetry(fallbackDriver, input);
      } catch (fallbackError) {
        throw normalizedFailure(fallbackError);
      }
    }
  }

  function capabilities() {
    const value = typeof primaryDriver.capabilities === 'function'
      ? primaryDriver.capabilities()
      : {};
    return Object.freeze({
      keywords: value?.keywords === true,
      confidence: value?.confidence === true,
    });
  }

  function releaseSession(recordingId) {
    sessions.delete(String(recordingId || ''));
  }

  function hasPendingFailover(recordingId) {
    return sessions.get(String(recordingId || ''))?.failoverAuditPending === true;
  }

  function acknowledgeFailover(recordingId) {
    const state = sessions.get(String(recordingId || ''));
    if (!state?.failoverAuditPending) return false;
    state.failoverAuditPending = false;
    return true;
  }

  return Object.freeze({
    acknowledgeFailover,
    available: true,
    capabilities,
    hasPendingFailover,
    keywordsForDraft,
    releaseSession,
    transcribeSegment,
  });
}

export function createUnavailableTranscriptionAdapter() {
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment() {
        throw new TranscriptionError(
          'transcribe_unavailable',
          'Transcription is currently unavailable.',
        );
      },
      capabilities() {
        return { keywords: false, confidence: false };
      },
    },
  });
  return Object.freeze({
    ...adapter,
    available: false,
  });
}

function openAIDriver(model, options) {
  if (model === 'gpt-4o-transcribe') {
    return createOpenAIGpt4oTranscribeDriver({ ...options, model });
  }
  if (model === 'whisper-1') {
    return createOpenAIWhisper1Driver({ ...options, model });
  }
  throw new TypeError('The transcription model is outside the fixed StoryForge pair.');
}

export function createTranscriptionAdapterForProvider(provider = 'none', {
  apiKey,
  fetchImpl = globalThis.fetch,
  primaryModel = 'gpt-4o-transcribe',
  fallbackModel = 'whisper-1',
  emitEvent,
  now,
} = {}) {
  const selected = String(provider || 'none').trim().toLowerCase();
  if (selected === 'none') return createUnavailableTranscriptionAdapter();
  if (selected === 'openai') {
    const driverOptions = { apiKey, fetchImpl };
    return createTranscriptionAdapter({
      primary: openAIDriver(primaryModel, driverOptions),
      fallback: openAIDriver(fallbackModel, driverOptions),
      ...(emitEvent ? { emitEvent } : {}),
      ...(now ? { now } : {}),
    });
  }

  const error = new Error(
    'The configured transcription provider is not authorized by this release source.',
  );
  error.code = 'transcription_provider_authority_blocked';
  throw error;
}
