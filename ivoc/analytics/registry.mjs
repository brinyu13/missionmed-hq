import { assertSignalDescriptor } from './descriptors.mjs';

const clone = (value) => structuredClone(value);
const tierReliability = (tier) => (tier === 'SUPPORTED' ? 'measured' : 'provisional');

export class SignalRegistry {
  #descriptors = new Map();
  #plugins = new Map();
  #state = new Map();
  #eventCounter = 0;

  constructor({ sessionId, clock, eventSink, wallNow = () => new Date().toISOString() }) {
    if (!sessionId || !clock || typeof eventSink !== 'function') throw new TypeError('registry requires sessionId, clock and eventSink');
    this.sessionId = sessionId;
    this.clock = clock;
    this.eventSink = eventSink;
    this.wallNow = wallNow;
  }

  register(descriptor, plugin = null) {
    assertSignalDescriptor(descriptor);
    if (this.#descriptors.has(descriptor.signal_id)) throw new Error(`duplicate signal ${descriptor.signal_id}`);
    this.#descriptors.set(descriptor.signal_id, descriptor);
    if (plugin) this.#plugins.set(descriptor.signal_id, plugin);
    this.#state.set(descriptor.signal_id, { availability: 'unavailable', reason: 'not_started', last_sample: null });
    return this;
  }

  descriptors() {
    return [...this.#descriptors.values()].map(clone);
  }

  snapshot() {
    return Object.fromEntries([...this.#state].map(([key, value]) => [key, clone(value)]));
  }

  setAvailability(signalId, availability, reason = null) {
    if (!this.#descriptors.has(signalId)) throw new Error(`unknown signal ${signalId}`);
    if (!['ok', 'degraded', 'unavailable'].includes(availability)) throw new TypeError('invalid availability');
    const current = this.#state.get(signalId);
    this.#state.set(signalId, { ...current, availability, reason });
    this.#emit('signal.availability.v1', signalId, { availability, reason }, availability);
  }

  ingest(signalId, sample, { availability = 'ok', at = this.clock.now() } = {}) {
    const descriptor = this.#descriptors.get(signalId);
    if (!descriptor) throw new Error(`unknown signal ${signalId}`);
    if (!Number.isFinite(at) || at < 0) throw new TypeError('sample time must be non-negative');
    if (sample === undefined) throw new TypeError('sample is required');
    const record = Object.freeze({ signal_id: signalId, t_media_ms: at, value: clone(sample), availability });
    this.#state.set(signalId, { availability, reason: null, last_sample: record });
    this.#emit('signal.sample.v1', signalId, { sample: record }, availability, descriptor);
    return clone(record);
  }

  async preflight(context) {
    const results = {};
    for (const [signalId, descriptor] of this.#descriptors) {
      const plugin = this.#plugins.get(signalId);
      try {
        const result = plugin?.preflight ? await plugin.preflight(context) : { state: 'not_ready', reason: 'plugin_unbound' };
        const availability = result.state === 'ready' ? 'ok' : result.state === 'not_applicable' ? 'degraded' : 'unavailable';
        this.setAvailability(signalId, availability, result.reason ?? null);
        results[signalId] = { ...result, descriptor_version: descriptor.version };
      } catch {
        this.setAvailability(signalId, 'unavailable', 'preflight_failed');
        results[signalId] = { state: 'not_ready', reason: 'preflight_failed', descriptor_version: descriptor.version };
      }
    }
    return results;
  }

  async start(context) {
    for (const [signalId, plugin] of this.#plugins) {
      try {
        await plugin.start?.({ ...context, emit: (sample, options) => this.ingest(signalId, sample, options) });
      } catch {
        this.setAvailability(signalId, 'unavailable', 'detector_start_failed');
      }
    }
  }

  async stop() {
    for (const [signalId, plugin] of this.#plugins) {
      try {
        await plugin.stop?.();
      } catch {
        this.setAvailability(signalId, 'unavailable', 'detector_stop_failed');
      }
    }
  }

  finalize() {
    return Object.freeze({
      session_id: this.sessionId,
      signals: this.descriptors().map((descriptor) => ({ descriptor, state: this.snapshot()[descriptor.signal_id] })),
      produced_at: this.wallNow(),
    });
  }

  #emit(type, signalId, payload, availability, descriptor = this.#descriptors.get(signalId)) {
    this.eventSink({
      event_id: `${this.sessionId}:analytics:${++this.#eventCounter}`,
      session_id: this.sessionId,
      t_media_ms: this.clock.now(),
      t_wall: this.wallNow(),
      source: 'client.analytics',
      type,
      schema_version: '1',
      reliability: tierReliability(descriptor.reliability.tier),
      availability,
      payload: { signal_id: signalId, ...clone(payload) },
    });
  }
}
