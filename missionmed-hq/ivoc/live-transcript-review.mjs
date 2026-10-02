// Provider-clock fragments are not recording seek points, completed turns,
// biometric identity, or proof of audio actually heard.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBJECT = /^wp:[1-9][0-9]{0,19}$/u;
const PROVIDER = /^[A-Za-z0-9_-]{8,160}$/u;
const EVENT = /^[A-Za-z0-9_.:-]{1,160}$/u;
const SELECT = 'observation_id,seq,session_id,owner_subject,provider_session_id,kind,speaker,provider_event_id,fragment_text,provider_start_ms,provider_end_ms,server_received_at,terminal_status,terminal_reason';
const REASONS = new Set(['socket_closed', 'socket_error', 'connect_timeout', 'duration_limit',
  'finish_timeout', 'queue_limit', 'event_limit', 'byte_limit', 'invalid_event',
  'conflicting_event_id', 'persistence_failure', 'persistence_timeout', 'connect_failure']);
const fail = () => { throw new Error('live_transcript_review_unavailable'); };
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const matches = (pattern, v) => typeof v === 'string' && pattern.test(v);

export function unavailableLiveTranscript(sessionId, reason = 'READ_UNAVAILABLE') {
  return { schema: 'ivoc.server-transcript-review.v1', sessionId, status: 'UNAVAILABLE', reason,
    provenance: 'SERVER_OBSERVED', timingBasis: 'PROVIDER_SESSION_APPROXIMATE',
    speechBoundaries: 'UNVERIFIED', heardAudio: 'UNVERIFIED', candidateIdentity: 'UNVERIFIED', observations: [] };
}

// Caller authorizes first and rechecks custody afterward. No client-selected
// provider/observation identity, table mutation, or direct browser DB access.
export async function readLiveTranscriptReview(db, session) {
  const sessionId = session?.id;
  if (!matches(UUID, sessionId) || !matches(SUBJECT, session?.owner_subject)) return unavailableLiveTranscript(null);
  const empty = reason => unavailableLiveTranscript(sessionId, reason);
  if (session.interviewer_provider !== 'openai-gpt-live') return empty('NOT_APPLICABLE');
  const base = `ivoc_live_transcript_events?session_id=eq.${sessionId}&owner_subject=eq.${encodeURIComponent(session.owner_subject)}`;
  const signal = AbortSignal.timeout(12000);
  const read = path => db.request(path, { signal });
  let bytes = 0;
  try {
    const roots = await read(`${base}&kind=eq.attached&select=${SELECT}&order=server_received_at.asc,observation_id.asc&limit=5`);
    if (!Array.isArray(roots) || roots.length > 4) fail();
    if (!roots.length) return empty('NOT_CAPTURED');
    const observations = [], seen = new Set(), providers = new Set();
    for (const root of roots) {
      if (!matches(UUID, root?.observation_id) || seen.has(root.observation_id)
        || !matches(PROVIDER, root.provider_session_id) || providers.has(root.provider_session_id)) fail();
      seen.add(root.observation_id); providers.add(root.provider_session_id);
      const path = `${base}&observation_id=eq.${root.observation_id}`;
      const tail = await read(`${path}&select=seq&order=seq.desc&limit=1`);
      if (!Array.isArray(tail) || tail.length !== 1 || !integer(tail[0]?.seq, 1, 8194)) fail();
      // Fixed high water + keyset pages: concurrent appends cannot shift offsets
      // or make a truncated page appear to be a closed observation.
      const high = tail[0].seq, fragments = [], eventIds = new Set();
      let seq = 0, terminal = null;
      while (seq < high) {
        signal.throwIfAborted();
        const rows = await read(`${path}&and=(seq.gt.${seq},seq.lte.${high})&select=${SELECT}&order=seq.asc&limit=256`);
        if (!Array.isArray(rows) || !rows.length || rows.length > 256) fail();
        for (const row of rows) {
          if (!row || terminal || row.seq !== seq + 1 || row.seq > high
            || row.session_id !== sessionId || row.owner_subject !== session.owner_subject
            || row.observation_id !== root.observation_id || row.provider_session_id !== root.provider_session_id
            || typeof row.server_received_at !== 'string' || !Number.isFinite(Date.parse(row.server_received_at))) fail();
          seq = row.seq;
          if (row.kind === 'fragment') {
            if (seq === 1 || !['input', 'output'].includes(row.speaker)
              || typeof row.fragment_text !== 'string' || Buffer.byteLength(row.fragment_text) > 16384
              || !integer(row.provider_start_ms, 0, 86400000)
              || !integer(row.provider_end_ms, row.provider_start_ms, 86400000)
              || row.terminal_status !== null || row.terminal_reason !== null) fail();
            if (row.provider_event_id !== null) {
              if (!matches(EVENT, row.provider_event_id) || eventIds.has(row.provider_event_id)) fail();
              eventIds.add(row.provider_event_id);
            }
            bytes += Buffer.byteLength(row.fragment_text);
            if (bytes > 2 * 1024 * 1024 || fragments.length >= 8192) fail();
            fragments.push({ sequence: seq, speaker: row.speaker === 'input' ? 'student' : 'interviewer',
              text: row.fragment_text, providerStartMs: row.provider_start_ms, providerEndMs: row.provider_end_ms });
          } else {
            if ([row.speaker, row.provider_event_id, row.fragment_text, row.provider_start_ms, row.provider_end_ms].some(v => v !== null)) fail();
            if (seq === 1) {
              if (row.kind !== 'attached' || row.terminal_status !== null || row.terminal_reason !== null) fail();
            } else if (row.kind === 'terminal' && seq === high
              && ((row.terminal_status === 'PROVIDER_CLOSED' && row.terminal_reason === 'provider_closed')
                || (row.terminal_status === 'INCOMPLETE' && REASONS.has(row.terminal_reason)))) {
              terminal = row.terminal_status;
            } else fail();
          }
        }
      }
      observations.push({ ordinal: observations.length + 1, status: terminal || 'INCOMPLETE', fragments });
    }
    return { ...empty(null), status: 'AVAILABLE', observations };
  } catch {
    // Recording/results remain usable. Never expose partial rows after a
    // custody, shape, budget or sequence failure; never leak SQL/provider IDs.
    return empty('READ_UNAVAILABLE');
  }
}
