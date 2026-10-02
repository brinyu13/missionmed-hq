import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ID = /^[A-Za-z0-9_.:-]{1,160}$/u;
const MAX_PROVIDER_MS = 86_400_000;
const DEFAULT_LIMITS = Object.freeze({ connectMs: 10_000, appendMs: 5_000, durationMs: 3_600_000,
  drainMs: 2_000, queueRecords: 64, queueBytes: 256 * 1024, fragments: 8192,
  transcriptBytes: 2 * 1024 * 1024, fragmentBytes: 16 * 1024, packetBytes: 2 * 1024 * 1024,
  messages: 1_000_000 });

/**
 * Inactive server-only observer. Caller establishes provider/session ownership;
 * this module does not grant access or create a provider session. Never sends.
 * append must durably append exact records, idempotently by observation_id/seq.
 * A rejected/timed-out append is uncertain custody: no later sequence is sent.
 * Fragments are approximate PROVIDER_SESSION intervals, not completed turns,
 * exact word boundaries, speaker biometrics, or proof of audible playback.
 */
export function attachOpenAiLiveTranscriptObserver({ providerSessionId, ivocSessionId, ownerSubject,
  observationId, apiKey, append, WebSocketImpl, limits = {} } = {}) {
  if (typeof providerSessionId !== 'string' || !/^[A-Za-z0-9_-]{8,160}$/u.test(providerSessionId)
    || typeof ivocSessionId !== 'string' || !UUID.test(ivocSessionId)
    || typeof observationId !== 'string' || !UUID.test(observationId)
    || typeof ownerSubject !== 'string' || !/^wp:[1-9][0-9]{0,19}$/u.test(ownerSubject)
    || typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/u.test(apiKey)
    || typeof append !== 'function' || (WebSocketImpl !== undefined && typeof WebSocketImpl !== 'function')) {
    throw new TypeError('Live transcript observer requires exact server-owned identity and sink.');
  }
  const bounds = { ...DEFAULT_LIMITS };
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) throw new TypeError('Observer limits are invalid.');
  for (const [key, value] of Object.entries(limits)) {
    if (!Object.hasOwn(bounds, key) || !Number.isSafeInteger(value) || value < 1 || value > bounds[key]) {
      throw new TypeError('Observer limits may only tighten bounded defaults.');
    }
    bounds[key] = value;
  }
  let resolveReady, rejectReady, resolveCompletion;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  // Caller still observes rejection; prevent an unobserved early transport error.
  ready.catch(() => {});
  const completion = new Promise(resolve => { resolveCompletion = resolve; });
  const identity = { observation_id: observationId, session_id: ivocSessionId,
    owner_subject: ownerSubject, provider_session_id: providerSessionId };
  const queue = [], seen = new Map(), timers = new Set();
  let socket, opened = false, rootPersisted = false, draining = false, finished = false;
  let terminal = null, seq = 0, queueBytes = 0, count = 0, bytes = 0, messages = 0;
  let connectTimer, finishTimer, durationTimer;
  const receivedAt = () => new Date().toISOString();
  const schedule = (fn, ms) => { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); return timer; };
  const cancelTimer = timer => { clearTimeout(timer); timers.delete(timer); };
  const record = (kind, fields = {}, at = receivedAt()) => Object.freeze({ ...identity, seq: ++seq, kind,
    speaker: null, provider_event_id: null, fragment_text: null, provider_start_ms: null,
    provider_end_ms: null, server_received_at: at, terminal_status: null, terminal_reason: null, ...fields });

  function cleanup() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    if (!socket) return;
    for (const [event, listener] of [['open', onOpen], ['message', onMessage], ['close', onClose], ['error', onError]]) {
      socket.off(event, listener);
    }
    if (socket.readyState === 3) return;
    // ws can emit a final error while aborting a still-connecting socket.
    const swallow = () => {};
    socket.on('error', swallow);
    socket.once('close', () => socket.off('error', swallow));
    try { socket.terminate(); } catch { /* Local cleanup is not a provider close. */ }
  }
  function settle(status, reason, terminalPersisted) {
    if (finished) return;
    finished = true;
    queue.length = 0; queueBytes = 0; seen.clear();
    cleanup();
    if (!rootPersisted) rejectReady(new Error('Live transcript observation did not attach durably.'));
    resolveCompletion(Object.freeze({ status, reason, terminalPersisted, observationId }));
  }
  async function persist(batch) {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(() => append(Object.freeze(batch))),
        new Promise((_, reject) => { timer = schedule(() => reject(new Error('persistence_timeout')), bounds.appendMs); }),
      ]);
    } finally { cancelTimer(timer); }
  }
  async function drain() {
    if (draining || finished || !opened) return;
    draining = true;
    try {
      while (!finished) {
        if (queue.length) {
          // Root must commit before any fragment, including early arrivals.
          const batch = queue.splice(0, rootPersisted ? 32 : 1);
          queueBytes -= batch.reduce((total, item) => total + Buffer.byteLength(item.fragment_text || ''), 0);
          try { await persist(batch); } catch (error) {
            settle('INCOMPLETE', error?.message === 'persistence_timeout' ? 'persistence_timeout' : 'persistence_failure', false);
            return;
          }
          if (!rootPersisted) { rootPersisted = true; resolveReady(batch[0]); }
          continue;
        }
        if (terminal) {
          const end = record('terminal', { terminal_status: terminal.status, terminal_reason: terminal.reason }, terminal.at);
          try { await persist([end]); } catch (error) {
            settle('INCOMPLETE', error?.message === 'persistence_timeout' ? 'persistence_timeout' : 'persistence_failure', false);
            return;
          }
          settle(terminal.status, terminal.reason, true);
        }
        return;
      }
    } finally { draining = false; }
  }
  function stop(status, reason, at = receivedAt()) {
    if (terminal || finished) return;
    terminal = { status, reason, at };
    // Do not cancel an active persistence deadline; drain owns that timer.
    cancelTimer(durationTimer); cancelTimer(connectTimer); cancelTimer(finishTimer);
    if (!opened) { settle('INCOMPLETE', reason, false); return; }
    void drain();
  }
  function onOpen() {
    if (terminal || finished || opened) return;
    opened = true; cancelTimer(connectTimer);
    // Early messages have not received sequence identities until the root exists.
    const early = queue.splice(0);
    queue.push(record('attached'));
    for (const item of early) queue.push(record('fragment', item.fields, item.at));
    void drain();
  }
  function onMessage(data, binary = false) {
    if (terminal || finished) return;
    const at = receivedAt();
    if (++messages > bounds.messages) { stop('INCOMPLETE', 'event_limit', at); return; }
    if (binary || (!Buffer.isBuffer(data) && typeof data !== 'string')
      || Buffer.byteLength(data) > bounds.packetBytes) { stop('INCOMPLETE', 'invalid_event', at); return; }
    let event;
    try { event = JSON.parse(data.toString()); } catch { stop('INCOMPLETE', 'invalid_event', at); return; }
    if (!event || typeof event !== 'object' || Array.isArray(event)) { stop('INCOMPLETE', 'invalid_event', at); return; }
    if (event.type === 'session.closed') { stop('PROVIDER_CLOSED', 'provider_closed', at); return; }
    if (!['session.input_transcript.delta', 'session.output_transcript.delta'].includes(event.type)) return;
    if (typeof event.delta !== 'string' || Buffer.byteLength(event.delta) > bounds.fragmentBytes
      || !Number.isSafeInteger(event.start_ms) || !Number.isSafeInteger(event.end_ms)
      || event.start_ms < 0 || event.end_ms < event.start_ms || event.end_ms > MAX_PROVIDER_MS
      || (Object.hasOwn(event, 'event_id') && (typeof event.event_id !== 'string' || !ID.test(event.event_id)))) {
      stop('INCOMPLETE', 'invalid_event', at); return;
    }
    const fields = { speaker: event.type === 'session.input_transcript.delta' ? 'input' : 'output',
      provider_event_id: event.event_id ?? null, fragment_text: event.delta,
      provider_start_ms: event.start_ms, provider_end_ms: event.end_ms };
    if (event.event_id) {
      const digest = createHash('sha256').update(JSON.stringify(fields)).digest('hex');
      if (seen.has(event.event_id)) {
        if (seen.get(event.event_id) !== digest) stop('INCOMPLETE', 'conflicting_event_id', at);
        return;
      }
      seen.set(event.event_id, digest);
    }
    const size = Buffer.byteLength(event.delta);
    if (++count > bounds.fragments) { stop('INCOMPLETE', 'event_limit', at); return; }
    if ((bytes += size) > bounds.transcriptBytes) { stop('INCOMPLETE', 'byte_limit', at); return; }
    if (queue.length >= bounds.queueRecords || queueBytes + size > bounds.queueBytes) {
      stop('INCOMPLETE', 'queue_limit', at); return;
    }
    queueBytes += size;
    queue.push(opened ? record('fragment', fields, at) : { fields, at });
    void drain();
  }
  function onClose() { stop('INCOMPLETE', 'socket_closed'); }
  function onError() { stop('INCOMPLETE', 'socket_error'); }
  durationTimer = schedule(() => stop('INCOMPLETE', 'duration_limit'), bounds.durationMs);
  connectTimer = schedule(() => stop('INCOMPLETE', 'connect_timeout'), bounds.connectMs);
  function connect(Implementation) {
    if (terminal || finished) return;
    try {
      socket = new Implementation(`wss://api.openai.com/v1/live/sessions/${providerSessionId}/attach`, {
        headers: { Authorization: `Bearer ${apiKey}` }, maxPayload: bounds.packetBytes,
        handshakeTimeout: bounds.connectMs, followRedirects: false,
      });
      socket.on('open', onOpen); socket.on('message', onMessage);
      socket.on('close', onClose); socket.on('error', onError);
    } catch { stop('INCOMPLETE', 'connect_failure'); }
  }
  // Existing ws dependency is loaded only for an explicitly constructed live
  // observer, never for importing this inactive seam or injected socket tests.
  if (WebSocketImpl) connect(WebSocketImpl);
  else void import('ws').then(module => connect(module.default), () => stop('INCOMPLETE', 'connect_failure'));
  return Object.freeze({ ready, completion, finish() {
    if (!terminal && !finished && !finishTimer) finishTimer = schedule(() => stop('INCOMPLETE', 'finish_timeout'), bounds.drainMs);
    return completion;
  } });
}
