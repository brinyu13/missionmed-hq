const OPENAI_LIVE_SESSIONS_URL = 'https://api.openai.com/v1/live/sessions';
const MODEL = 'gpt-live-1';
const SAFE_VOICES = new Set(['marin', 'cedar', 'coral']);
const SAFE_CONTEXT = Object.freeze({
  goal: new Set(['Residency interview practice', 'Instant focused rep', 'Individual question', 'Coached practice', 'Full interview simulation']),
  interviewer: new Set(['Program Director · balanced', 'Faculty · conversational', 'Chief Resident · warm', 'Pressure practice · direct']),
  program: new Set(['General residency interview', 'Internal Medicine · RISE seam', 'Family Medicine · RISE seam', 'Program context not available']),
  environment: new Set(['MissionMed · interview only', 'MissionMed · coached analytics', 'StoryForge context seam', 'RISE + StoryForge seams']),
});
const MAX_SDP_BYTES = 256 * 1024;
const MAX_CONTEXT_BYTES = 16 * 1024;

function boundedText(value, name, allowed, maximum = 240) {
  const text = String(value || '').trim();
  if (!text || text.length > maximum || !allowed.has(text)) throw new TypeError(`${name} is invalid.`);
  return text;
}

function exactSessionId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,160}$/u.test(id) ? id : null;
}

export function normalizeLiveInterviewContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Interview context must be an object.');
  }
  const expected = ['environment', 'goal', 'interviewer', 'program', 'questionIds', 'targetQuestions'];
  if (Object.keys(value).sort().join(',') !== expected.join(',')) {
    throw new TypeError('Interview context has unexpected fields.');
  }
  if (!Array.isArray(value.questionIds) || value.questionIds.length > 30) {
    throw new TypeError('Question IDs are invalid.');
  }
  const context = Object.freeze({
    goal: boundedText(value.goal, 'Practice goal', SAFE_CONTEXT.goal),
    interviewer: boundedText(value.interviewer, 'Interviewer', SAFE_CONTEXT.interviewer),
    program: boundedText(value.program, 'Program', SAFE_CONTEXT.program),
    environment: boundedText(value.environment, 'Environment', SAFE_CONTEXT.environment),
    targetQuestions: Number.isInteger(value.targetQuestions) && value.targetQuestions >= 1 && value.targetQuestions <= 30
      ? value.targetQuestions
      : 1,
    questionIds: Object.freeze(value.questionIds.map((id) => {
      const exact = String(id || '').trim();
      if (!/^[A-Za-z0-9._:-]{1,120}$/u.test(exact)) throw new TypeError('Question ID is invalid.');
      return exact;
    })),
  });
  if (Buffer.byteLength(JSON.stringify(context), 'utf8') > MAX_CONTEXT_BYTES) {
    throw new TypeError('Interview context is too large.');
  }
  return context;
}

export function buildLiveInterviewInstructions(context) {
  const authorizedContext = JSON.stringify(normalizeLiveInterviewContext(context));
  return [
    'You are InterviewBrain, a calm, professional residency interviewer for IV Prep On-Call.',
    'Conduct a realistic spoken interview. Ask one question at a time and follow up only on what the applicant actually says.',
    'Keep each turn concise. Use sparse, natural backchannels only when they do not steal the floor.',
    'If the applicant interrupts, stop speaking and listen. A thoughtful pause, restart, or word search is not automatically a finished answer.',
    'Never infer emotion, personality, diagnosis, protected traits, or facts absent from the authorized context or the applicant response.',
    'RISE and StoryForge are context seams only. Never claim access to records not present below.',
    `AUTHORIZED SESSION CONTEXT: ${authorizedContext}`,
  ].join('\n');
}

export class OpenAiLiveSessionBroker {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    fetchImpl = globalThis.fetch,
    timeoutMs = 15_000,
  } = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured.');
    if (typeof this.fetch !== 'function') throw new TypeError('A fetch implementation is required.');
  }

  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${OPENAI_LIVE_SESSIONS_URL}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error('OpenAI Live request failed.');
        error.code = 'OPENAI_LIVE_REQUEST_FAILED';
        error.status = response.status;
        throw error;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async create({ sdp, voice = 'marin', context } = {}) {
    const offer = String(sdp || '');
    if (!offer.startsWith('v=0') || Buffer.byteLength(offer, 'utf8') > MAX_SDP_BYTES) {
      throw new TypeError('WebRTC offer SDP is invalid.');
    }
    if (!SAFE_VOICES.has(voice)) throw new TypeError('Voice is invalid.');
    const body = await this.request('', {
      method: 'POST',
      body: JSON.stringify({
        session: {
          model: MODEL,
          instructions: buildLiveInterviewInstructions(context),
          audio: { output: { voice } },
          store: false,
        },
        transport: { type: 'webrtc', sdp: offer },
      }),
    });
    const id = exactSessionId(body?.session?.id);
    const answer = String(body?.transport?.sdp || '');
    if (!id || body?.transport?.type !== 'webrtc' || !answer.startsWith('v=0')
      || Buffer.byteLength(answer, 'utf8') > MAX_SDP_BYTES) {
      throw new Error('OpenAI Live returned an invalid WebRTC session.');
    }
    return Object.freeze({
      session: Object.freeze({ id, model: MODEL }),
      transport: Object.freeze({ type: 'webrtc', sdp: answer }),
    });
  }

  async hangup(sessionId) {
    const id = exactSessionId(sessionId);
    if (!id) throw new TypeError('Live session ID is invalid.');
    await this.request(`/${encodeURIComponent(id)}/hangup`, { method: 'POST', body: '{}' });
    return Object.freeze({ ok: true });
  }
}

export function createOpenAiLiveSessionBroker(options = {}) {
  return new OpenAiLiveSessionBroker(options);
}

export const OPENAI_LIVE_MODEL = MODEL;
