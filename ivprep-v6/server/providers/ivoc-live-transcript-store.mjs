const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBJECT = /^wp:[1-9][0-9]{0,19}$/u;
const PROVIDER = /^[A-Za-z0-9_-]{8,160}$/u;
const RECORD_KEYS = ['observation_id', 'seq', 'session_id', 'owner_subject', 'provider_session_id',
  'kind', 'speaker', 'provider_event_id', 'fragment_text', 'provider_start_ms', 'provider_end_ms',
  'server_received_at', 'terminal_status', 'terminal_reason'].sort().join(',');

// Private server sink only. No browser endpoint or transcript read surface.
// The database independently verifies owner, append ordering and immutability.
export function createIvocLiveTranscriptStore({ rest } = {}) {
  if (typeof rest?.table !== 'function' || typeof rest?.request !== 'function') {
    throw new TypeError('IVOC live transcript storage unavailable.');
  }
  async function assertActiveSession({ ownerSubject, ivocSessionId } = {}) {
    if (typeof ownerSubject !== 'string' || !SUBJECT.test(ownerSubject)
      || typeof ivocSessionId !== 'string' || !UUID.test(ivocSessionId)) {
      throw new TypeError('IVOC live transcript identity invalid.');
    }
    const rows = await rest.table('ivoc_sessions',
      `?id=eq.${ivocSessionId}&owner_subject=eq.${encodeURIComponent(ownerSubject)}&select=id,owner_subject,state,interviewer_provider&limit=1`);
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== ivocSessionId
      || rows[0].owner_subject !== ownerSubject || rows[0].state !== 'active'
      || rows[0].interviewer_provider !== 'openai-gpt-live') {
      throw new Error('IVOC active owned live session unavailable.');
    }
    return Object.freeze({ ownerSubject, ivocSessionId });
  }
  async function bindObservation({ ownerSubject, ivocSessionId, providerSessionId, observationId } = {}) {
    if (typeof observationId !== 'string' || !UUID.test(observationId)
      || typeof providerSessionId !== 'string' || !PROVIDER.test(providerSessionId)) {
      throw new TypeError('IVOC live transcript observation invalid.');
    }
    await assertActiveSession({ ownerSubject, ivocSessionId });
    return async function append(records) {
      if (!Array.isArray(records) || records.length < 1 || records.length > 32) {
        throw new TypeError('IVOC live transcript batch invalid.');
      }
      const batch = structuredClone(records);
      for (const record of batch) {
        if (!record || typeof record !== 'object' || Array.isArray(record)
          || Object.keys(record).sort().join(',') !== RECORD_KEYS
          || record.observation_id !== observationId || record.session_id !== ivocSessionId
          || record.owner_subject !== ownerSubject || record.provider_session_id !== providerSessionId) {
          throw new TypeError('IVOC live transcript binding invalid.');
        }
      }
      try {
        await rest.request('/ivoc_live_transcript_events', { method: 'POST', body: batch, prefer: 'return=minimal' });
      } catch {
        // Do not expose SQL, transcript text, object identities or provider data.
        throw new Error('IVOC live transcript persistence unconfirmed.');
      }
    };
  }
  return Object.freeze({ assertActiveSession, bindObservation });
}
