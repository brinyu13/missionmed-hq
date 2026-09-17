import {
  buildInterviewerInstructions,
  DEFAULT_INTERVIEWER_MODEL,
  DEFAULT_OBSERVER_MODEL,
  DEFAULT_REASONING_EFFORT,
  MODEL_ARCHITECTURES,
  requireModelCandidate,
} from '../config/models.mjs';
import { ProviderError, providerResponseError } from './errors.mjs';

const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

const ACTIONS = Object.freeze([
  'OPENING', 'PLAN_QUESTION', 'FOLLOW_UP', 'PROBE_GAP', 'CALLBACK_QUESTION',
  'CLARIFY_STATUS', 'CLARIFY_CONTRADICTION', 'RECOVER_SILENCE',
  'RECOVER_RAMBLE', 'RECOVER_SHORT', 'DEFLECT_OFFTOPIC', 'SET_BOUNDARY',
  'TERMINATE_INTERVIEW', 'WRAP_UP',
]);

export const OBSERVER_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'action', 'activeTopic', 'evidenceExcerpt', 'instructorRationale',
    'threadState', 'riskFlags', 'importantFacts', 'planDisposition',
    'planQuestionId', 'final', 'terminated', 'terminationReason', 'conductEvidence',
  ],
  properties: {
    action: { type: 'string', enum: ACTIONS },
    activeTopic: { type: 'string' },
    evidenceExcerpt: { type: ['string', 'null'] },
    instructorRationale: { type: 'string' },
    threadState: { type: 'string', enum: ['opened', 'continued', 'resolved', 'none'] },
    riskFlags: { type: 'array', items: { type: 'string' } },
    importantFacts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fact', 'evidenceExcerpt'],
        properties: {
          fact: { type: 'string' },
          evidenceExcerpt: { type: 'string' },
        },
      },
    },
    planDisposition: { type: 'string', enum: ['stay', 'advance', 'wrap'] },
    planQuestionId: { type: ['string', 'null'] },
    final: { type: 'boolean' },
    terminated: { type: 'boolean' },
    terminationReason: { type: ['string', 'null'] },
    conductEvidence: { type: ['string', 'null'] },
  },
});

const OBSERVER_INSTRUCTIONS = `You are the instructor-review observer for a residency interview. The interviewer utterance has already been generated. Observe and classify it; never rewrite it and never invent another question.

Use exact applicant evidence only. evidenceExcerpt must be an exact consecutive excerpt from the latest applicant answer, or null for an opening with no applicant answer. importantFacts must contain only durable facts with exact excerpts. If the interviewer clearly ends the interview because of applicant conduct, set action=TERMINATE_INTERVIEW, terminated=true, final=true, planDisposition=wrap, and record a concise professional terminationReason plus exact conductEvidence. Do not expose chain-of-thought; instructorRationale is one concise observable explanation.`;

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

function outputText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') return content.text.trim();
    }
  }
  return '';
}

function assertContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new TypeError('Interview context must be an object.');
}

function normalized(value) {
  return String(value || '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function exactExcerpt(value, source) {
  const excerpt = typeof value === 'string' ? value.trim() : '';
  if (!excerpt || !source) return null;
  return normalized(source).includes(normalized(excerpt)) ? excerpt : null;
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateObserverMetadata(metadata, context) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('Observer metadata must be an object.');
  if (!ACTIONS.includes(metadata.action)) throw new TypeError('Unknown observer action.');
  if (!['opened', 'continued', 'resolved', 'none'].includes(metadata.threadState)) throw new TypeError('Unknown observer thread state.');
  if (!['stay', 'advance', 'wrap'].includes(metadata.planDisposition)) throw new TypeError('Unknown plan disposition.');
  if (!Array.isArray(metadata.riskFlags) || !Array.isArray(metadata.importantFacts)) throw new TypeError('Observer arrays are required.');
  if (!nullableText(metadata.activeTopic) || !nullableText(metadata.instructorRationale)) throw new TypeError('Observer topic and rationale are required.');

  const answer = String(context.latestApplicantAnswer || '').trim();
  const evidenceExcerpt = answer ? exactExcerpt(metadata.evidenceExcerpt, answer) || answer : null;
  const terminated = Boolean(metadata.terminated) || metadata.action === 'TERMINATE_INTERVIEW';
  if (terminated && metadata.action !== 'TERMINATE_INTERVIEW') throw new TypeError('Observer termination action mismatch.');
  const importantFacts = metadata.importantFacts
    .map((item) => ({ fact: nullableText(item?.fact), evidenceExcerpt: exactExcerpt(item?.evidenceExcerpt, answer) }))
    .filter((item) => item.fact && item.evidenceExcerpt);

  return Object.freeze({
    action: metadata.action,
    activeTopic: metadata.activeTopic.trim(),
    evidenceExcerpt,
    instructorRationale: metadata.instructorRationale.trim(),
    threadState: metadata.threadState,
    riskFlags: Object.freeze(metadata.riskFlags.map(String).filter(Boolean)),
    importantFacts: Object.freeze(importantFacts.map(Object.freeze)),
    planDisposition: terminated ? 'wrap' : metadata.planDisposition,
    planQuestionId: typeof metadata.planQuestionId === 'string' ? metadata.planQuestionId : null,
    final: terminated ? true : Boolean(metadata.final),
    terminated,
    terminationReason: terminated ? nullableText(metadata.terminationReason) || 'Interview terminated due to applicant conduct.' : null,
    conductEvidence: terminated ? exactExcerpt(metadata.conductEvidence, answer) || evidenceExcerpt : null,
  });
}

export async function createNaturalInterviewerUtterance({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_INTERVIEWER_MODEL || DEFAULT_INTERVIEWER_MODEL,
  reasoningEffort = process.env.OPENAI_INTERVIEWER_REASONING_EFFORT || DEFAULT_REASONING_EFFORT,
  behaviorPresetId,
  context,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertContext(context);
  requireModelCandidate(model, MODEL_ARCHITECTURES.RESPONSES_SPEECH);
  const startedAt = performance.now();
  let response;
  try {
    response = await fetchImpl(RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: reasoningEffort, context: 'current_turn' },
        instructions: buildInterviewerInstructions(behaviorPresetId),
        input: JSON.stringify(context),
        text: { verbosity: 'low' },
        max_output_tokens: 900,
      }),
    });
  } catch (cause) {
    throw new ProviderError('OpenAI interviewer request failed before a response was received.', {
      code: signal?.aborted ? 'openai_interviewer_cancelled' : 'openai_interviewer_network_failed',
      provider: 'openai',
      retryable: !signal?.aborted,
      cause,
    });
  }
  if (!response?.ok) throw providerResponseError('openai', response, 'interviewer');
  const payload = await response.json();
  const utterance = outputText(payload);
  if (!utterance) throw new ProviderError('OpenAI returned no interviewer utterance.', { code: 'openai_empty_interviewer', provider: 'openai' });
  return Object.freeze({
    requestedModel: model,
    providerModel: typeof payload.model === 'string' ? payload.model : model,
    utterance,
    responseId: typeof payload.id === 'string' ? payload.id : null,
    latencyMs: Math.round(performance.now() - startedAt),
    usage: payload.usage || null,
  });
}

export async function observeInterviewerUtterance({
  apiKey = process.env.OPENAI_API_KEY,
  observerModel = process.env.OPENAI_OBSERVER_MODEL || DEFAULT_OBSERVER_MODEL,
  context,
  utterance,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  assertContext(context);
  requireModelCandidate(observerModel, MODEL_ARCHITECTURES.RESPONSES_SPEECH);
  if (typeof utterance !== 'string' || !utterance.trim()) throw new TypeError('Completed interviewer utterance is required.');
  const startedAt = performance.now();
  let response;
  try {
    response = await fetchImpl(RESPONSES_ENDPOINT, {
      method: 'POST',
      headers: authHeaders(apiKey),
      signal,
      body: JSON.stringify({
        model: observerModel,
        store: false,
        reasoning: { effort: 'medium', context: 'current_turn' },
        instructions: OBSERVER_INSTRUCTIONS,
        input: JSON.stringify({ context, completedInterviewerUtterance: utterance }),
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'missionmed_interviewer_observer',
            strict: true,
            schema: OBSERVER_SCHEMA,
          },
        },
        max_output_tokens: 1200,
      }),
    });
  } catch (cause) {
    throw new ProviderError('OpenAI observer request failed before a response was received.', {
      code: signal?.aborted ? 'openai_observer_cancelled' : 'openai_observer_network_failed',
      provider: 'openai',
      retryable: !signal?.aborted,
      cause,
    });
  }
  if (!response?.ok) throw providerResponseError('openai', response, 'observer');
  const payload = await response.json();
  let parsed;
  try { parsed = JSON.parse(outputText(payload)); }
  catch (cause) { throw new ProviderError('OpenAI returned invalid observer metadata.', { code: 'openai_invalid_observer', provider: 'openai', cause }); }
  return Object.freeze({
    metadata: validateObserverMetadata(parsed, context),
    providerModel: typeof payload.model === 'string' ? payload.model : observerModel,
    latencyMs: Math.round(performance.now() - startedAt),
    usage: payload.usage || null,
  });
}

export async function createInterviewerExchange(options = {}) {
  const startedAt = performance.now();
  const natural = await createNaturalInterviewerUtterance(options);
  const observer = await observeInterviewerUtterance({
    apiKey: options.apiKey,
    observerModel: options.observerModel,
    context: options.context,
    utterance: natural.utterance,
    signal: options.signal,
    fetchImpl: options.fetchImpl,
  });
  return Object.freeze({
    requestedModel: natural.requestedModel,
    model: natural.providerModel,
    architecture: MODEL_ARCHITECTURES.RESPONSES_SPEECH,
    observerModel: observer.providerModel,
    utterance: natural.utterance,
    metadata: observer.metadata,
    timings: Object.freeze({
      naturalMs: natural.latencyMs,
      observerMs: observer.latencyMs,
      totalMs: Math.round(performance.now() - startedAt),
    }),
    usage: Object.freeze({ interviewer: natural.usage, observer: observer.usage }),
  });
}
