import assert from 'node:assert/strict';
import test from 'node:test';
import { M1_SIGNAL_DESCRIPTORS } from './descriptors.mjs';
import { SignalRegistry } from './registry.mjs';

test('M1 registry exposes the truthful target set and emits canonical timeline envelopes', () => {
  const events = [];
  const registry = new SignalRegistry({ sessionId: 's1', clock: { now: () => 125 }, eventSink: (event) => events.push(event), wallNow: () => '2026-09-16T16:00:00.000Z' });
  M1_SIGNAL_DESCRIPTORS.forEach((descriptor) => registry.register(descriptor));
  registry.setAvailability('voice.volume', 'ok');
  registry.ingest('voice.volume', { dbfs: -21.4, scale_0_10: 8.1 });
  assert.equal(registry.descriptors().length, 18);
  assert.equal(registry.snapshot()['voice.volume'].last_sample.value.dbfs, -21.4);
  assert.deepEqual(events.map((event) => event.type), ['signal.availability.v1', 'signal.sample.v1']);
  assert.equal(events.every((event) => event.source === 'client.analytics' && event.t_media_ms === 125), true);
});

test('unknown and undefined samples fail closed', () => {
  const registry = new SignalRegistry({ sessionId: 's1', clock: { now: () => 0 }, eventSink: () => {} });
  registry.register(M1_SIGNAL_DESCRIPTORS[0]);
  assert.throws(() => registry.ingest('not.real', 1), /unknown signal/);
  assert.throws(() => registry.ingest('frame.face_presence', undefined), /sample is required/);
});
