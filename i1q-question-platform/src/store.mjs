import {
  ENTITY_TYPES,
  ID_PREFIXES,
  IMMUTABLE_ENTITY_TYPES,
  assertKnownEntityType,
} from './contracts.mjs';
import { canonicalJson, deterministicId, hashChain, sha256 } from './hash.mjs';

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export class ConflictError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConflictError';
    this.code = code;
    this.statusCode = 409;
  }
}

export class NotFoundError extends Error {
  constructor(code) {
    super(code);
    this.name = 'NotFoundError';
    this.code = code;
    this.statusCode = 404;
  }
}

export class MemoryRepository {
  #collections = new Map();
  #lastAuditHash = null;
  #auditSequence = 0;
  #clock;

  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.#clock = clock;
    for (const entityType of ENTITY_TYPES) {
      this.#collections.set(entityType, new Map());
    }
  }

  now() {
    return this.#clock();
  }

  create(entityType, payload, { id, actorId = 'system', action = 'create' } = {}) {
    assertKnownEntityType(entityType);
    const collection = this.#collections.get(entityType);
    const entityId = id || deterministicId(ID_PREFIXES[entityType], payload);
    if (collection.has(entityId)) {
      throw new ConflictError(`duplicate_id:${entityType}:${entityId}`);
    }
    const timestamp = this.now();
    const row = Object.freeze({
      ...clone(payload),
      id: entityId,
      created_at: payload.created_at || timestamp,
      content_hash: sha256(payload),
    });
    collection.set(entityId, row);
    if (entityType !== 'audit_events') {
      this.appendAudit({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId });
    }
    return clone(row);
  }

  get(entityType, id) {
    assertKnownEntityType(entityType);
    const row = this.#collections.get(entityType).get(id);
    if (!row) {
      throw new NotFoundError(`not_found:${entityType}:${id}`);
    }
    return clone(row);
  }

  has(entityType, id) {
    assertKnownEntityType(entityType);
    return this.#collections.get(entityType).has(id);
  }

  list(entityType, { cursor = '', limit = 50, predicate = () => true } = {}) {
    assertKnownEntityType(entityType);
    const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const rows = [...this.#collections.get(entityType).values()]
      .filter(predicate)
      .sort((left, right) => left.id.localeCompare(right.id));
    const start = cursor ? Math.max(0, rows.findIndex((row) => row.id === cursor) + 1) : 0;
    const page = rows.slice(start, start + boundedLimit).map(clone);
    return {
      rows: page,
      next_cursor: start + boundedLimit < rows.length ? page.at(-1)?.id || null : null,
      total: rows.length,
    };
  }

  update(entityType, id, patch, { actorId = 'system', expectedHash = null } = {}) {
    assertKnownEntityType(entityType);
    if (IMMUTABLE_ENTITY_TYPES.has(entityType)) {
      throw new ConflictError(`immutable_entity:${entityType}`);
    }
    const current = this.get(entityType, id);
    if (expectedHash && current.content_hash !== expectedHash) {
      throw new ConflictError(`optimistic_lock_failed:${entityType}:${id}`);
    }
    const nextPayload = {
      ...current,
      ...clone(patch),
      id,
      created_at: current.created_at,
      updated_at: this.now(),
    };
    delete nextPayload.content_hash;
    const next = Object.freeze({ ...nextPayload, content_hash: sha256(nextPayload) });
    this.#collections.get(entityType).set(id, next);
    this.appendAudit({ actor_id: actorId, action: 'update', entity_type: entityType, entity_id: id });
    return clone(next);
  }

  appendAudit(payload) {
    const timestamp = this.now();
    this.#auditSequence += 1;
    const eventPayload = {
      ...clone(payload),
      occurred_at: timestamp,
      previous_hash: this.#lastAuditHash,
      sequence: this.#auditSequence,
    };
    const eventHash = hashChain(this.#lastAuditHash, eventPayload);
    const id = deterministicId('audit', { eventHash, timestamp });
    const event = Object.freeze({
      ...eventPayload,
      id,
      event_hash: eventHash,
      content_hash: sha256(eventPayload),
      created_at: timestamp,
    });
    this.#collections.get('audit_events').set(id, event);
    this.#lastAuditHash = eventHash;
    return clone(event);
  }

  verifyAuditChain() {
    let previous = null;
    const events = [...this.#collections.get('audit_events').values()]
      .sort((left, right) => left.sequence - right.sequence);
    for (const event of events) {
      const payload = {
        actor_id: event.actor_id,
        action: event.action,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        occurred_at: event.occurred_at,
        previous_hash: event.previous_hash,
        sequence: event.sequence,
      };
      if (event.previous_hash !== previous || event.event_hash !== hashChain(previous, payload)) {
        return false;
      }
      previous = event.event_hash;
    }
    return true;
  }

  snapshot() {
    const world = {};
    for (const [entityType, rows] of this.#collections.entries()) {
      world[entityType] = [...rows.values()].map(clone).sort((a, b) => a.id.localeCompare(b.id));
    }
    return {
      canonical_json: canonicalJson(world),
      hash: sha256(world),
      world,
    };
  }
}
