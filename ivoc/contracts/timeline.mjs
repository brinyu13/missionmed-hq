export const EVENT_SCHEMA = 'ivoc.event.v1';

export const EVENT_SOURCES = Object.freeze([
  'client.orchestrator', 'client.analytics', 'client.recorder', 'client.ui',
  'server.brain', 'server.transport', 'server.transcription', 'server.projector',
  'admin.studio', 'fabric',
]);

export const RELIABILITY = Object.freeze([
  'measured', 'derived', 'provisional', 'canonical', 'synthetic',
]);

export const AVAILABILITY = Object.freeze(['ok', 'degraded', 'unavailable']);

export function assertTimelineEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('timeline event must be an object');
  }
  for (const key of ['event_id', 'session_id', 't_wall', 'source', 'type', 'schema_version']) {
    if (typeof event[key] !== 'string' || event[key].length === 0) {
      throw new TypeError(`timeline event ${key} must be a non-empty string`);
    }
  }
  if (event.schema_version !== '1') throw new TypeError('timeline event schema_version must be 1');
  if (!Number.isFinite(event.t_media_ms) || event.t_media_ms < -1) {
    throw new TypeError('timeline event t_media_ms must be >= -1');
  }
  if (!EVENT_SOURCES.includes(event.source)) throw new TypeError('invalid timeline event source');
  if (!RELIABILITY.includes(event.reliability)) throw new TypeError('invalid timeline reliability');
  if (!AVAILABILITY.includes(event.availability)) throw new TypeError('invalid timeline availability');
  if (event.idempotency_key !== undefined && (typeof event.idempotency_key !== 'string' || !event.idempotency_key)) {
    throw new TypeError('timeline idempotency_key must be non-empty when present');
  }
  return event;
}

export function mediaOrder(left, right) {
  return left.t_media_ms - right.t_media_ms || left.seq - right.seq;
}
