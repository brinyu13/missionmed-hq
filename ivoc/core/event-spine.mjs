import { assertTimelineEvent, mediaOrder } from '../contracts/timeline.mjs';

function clone(value) {
  return structuredClone(value);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class EventSpine {
  #sessions = new Map();

  #bucket(sessionId) {
    if (!this.#sessions.has(sessionId)) {
      this.#sessions.set(sessionId, {
        events: [],
        byEventId: new Map(),
        byIdempotencyKey: new Map(),
        lastSeq: 0,
      });
    }
    return this.#sessions.get(sessionId);
  }

  appendBatch(sessionId, events) {
    if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
    if (!Array.isArray(events) || events.length === 0 || events.length > 200) {
      throw new TypeError('events must contain 1 through 200 entries');
    }
    const bucket = this.#bucket(sessionId);
    const output = [];
    for (const candidate of events) {
      assertTimelineEvent(candidate);
      if (candidate.session_id !== sessionId) throw new Error('cross-session event batch denied');
      const fingerprint = canonical(candidate);
      const existing = bucket.byEventId.get(candidate.event_id);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new Error('event_id replay changed payload');
        output.push(clone(existing.event));
        continue;
      }
      if (candidate.idempotency_key) {
        const replay = bucket.byIdempotencyKey.get(candidate.idempotency_key);
        if (replay) {
          if (replay.fingerprint !== fingerprint) throw new Error('idempotency key replay changed payload');
          output.push(clone(replay.event));
          continue;
        }
      }
      const event = Object.freeze({ ...clone(candidate), seq: ++bucket.lastSeq });
      const entry = { fingerprint, event };
      bucket.events.push(event);
      bucket.byEventId.set(event.event_id, entry);
      if (event.idempotency_key) bucket.byIdempotencyKey.set(event.idempotency_key, entry);
      output.push(clone(event));
    }
    return output;
  }

  read(sessionId) {
    return this.#bucket(sessionId).events.map(clone).sort(mediaOrder);
  }

  lastSeq(sessionId) {
    return this.#bucket(sessionId).lastSeq;
  }
}
