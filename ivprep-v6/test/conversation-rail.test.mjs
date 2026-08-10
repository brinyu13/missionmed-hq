import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

import { CONVERSATION_RAIL_IDS, publicConversationRailConfig } from '../providers/conversation-rail.mjs';
import { continuousTurnReadiness } from '../public/conversation-rail.mjs';
import { AlphaStore } from '../persistence/alpha-store.mjs';
import { createIvPrepServer } from '../server/serve.mjs';

const serverSource = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../server/serve.mjs', import.meta.url), 'utf8'));

class FakeRail extends EventEmitter {
  constructor(options, calls) { super(); this.options = options; this.calls = calls; this.connected = false; }
  async start(options) { this.calls.push(['start', options]); this.connected = true; this.options.onEvent({ type: 'connected', model: options.model, voiceId: options.voiceId, turnDetection: 'semantic_vad' }); return this.health(); }
  appendInputAudio(bytes) { this.calls.push(['audio', bytes.length]); return { accepted: true }; }
  appendInputText(text) { this.calls.push(['text', text]); }
  requestOpening(text) { this.calls.push(['opening', text]); }
  interrupt(options) { this.calls.push(['interrupt', options]); return { cancelled: true }; }
  health() { return { provider: 'openai', railId: CONVERSATION_RAIL_IDS.OPENAI_REALTIME, status: this.connected ? 'connected' : 'closed', connected: this.connected, model: 'gpt-realtime-2.1', voiceId: 'cedar' }; }
  usage() { return { estimatedMinutes: 0 }; }
  async close() { this.calls.push(['close']); this.connected = false; }
}

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}

test('rail catalog makes authenticated Realtime the Founder Alpha default and fails back explicitly when unavailable', () => {
  const config = publicConversationRailConfig({ realtimeAvailable: true });
  assert.equal(config.defaultRailId, CONVERSATION_RAIL_IDS.OPENAI_REALTIME);
  assert.equal(config.rails.find((rail) => rail.id === CONVERSATION_RAIL_IDS.OPENAI_REALTIME).status, 'founder-alpha-default');
  assert.equal(config.rails.find((rail) => rail.id === CONVERSATION_RAIL_IDS.OPENAI_REALTIME).maturity, 'experimental');
  assert.equal(publicConversationRailConfig({ realtimeAvailable: false }).defaultRailId, CONVERSATION_RAIL_IDS.RESPONSES_SPEECH);
  assert.deepEqual(config.rails.find((rail) => rail.id === CONVERSATION_RAIL_IDS.GPT_LIVE), {
    id: 'gpt-live', label: 'FUTURE — GPT-Live', provider: 'openai', model: null,
    architecture: 'gpt-live', status: 'unavailable', reason: 'provider_api_not_available',
  });
});

test('same-origin relay bounds frame rate and audio bytes', () => {
  assert.match(serverSource, /MAX_RAIL_MESSAGES_PER_WINDOW = 80/);
  assert.match(serverSource, /MAX_RAIL_AUDIO_BYTES_PER_WINDOW = 256 \* 1024/);
  assert.match(serverSource, /continuous_rail_rate_limited/);
  assert.match(serverSource, /client\.close\(1008, 'rail-rate-limited'\)/);
});

test('continuous turn assembly waits for late transcript events instead of discarding the response', () => {
  assert.equal(continuousTurnReadiness({ outputDone: true, pendingSchedules: 0, activeSources: 0, assistant: 'Follow-up?', applicant: '' }), 'waiting-for-transcript-pair');
  assert.equal(continuousTurnReadiness({ outputDone: true, pendingSchedules: 0, activeSources: 0, assistant: '', applicant: 'Answer' }), 'waiting-for-transcript-pair');
  assert.equal(continuousTurnReadiness({ outputDone: true, pendingSchedules: 0, activeSources: 0, assistant: 'Follow-up?', applicant: 'Answer' }), 'turn-complete');
  assert.equal(continuousTurnReadiness({ outputDone: true, pendingSchedules: 0, activeSources: 0, opening: true, assistant: 'Opening question', applicant: '' }), 'opening-complete');
});

test('same-origin rail relay owns one alpha session and closes on alpha end', async (t) => {
  const calls = [];
  const path = join(mkdtempSync(join(tmpdir(), 'ivprep-rail-')), 'sessions.json');
  const alphaStore = new AlphaStore({ path });
  const server = createIvPrepServer({
    apiKey: 'server-only-unit-key', alphaStore,
    modelDiscovery: async () => ({ models: [{ id: 'gpt-realtime-2.1', architecture: 'native-realtime-voice' }], failures: [], discoveredAt: null }),
    continuousRailFactory: (options) => new FakeRail(options, calls),
  });
  t.after(async () => { await server.closeProviders(); await new Promise((resolve) => server.close(resolve)); });
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  const started = await fetch(`${origin}/api/alpha-sessions/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testIdentity: 'rail-smoke', durationMinutes: 2, model: 'gpt-realtime-2.1', voice: 'cedar', mode: 'voice-only' }),
  }).then((response) => response.json());

  const client = new WebSocket(`ws://127.0.0.1:${port}/api/conversation-rail`, { headers: { Origin: origin } });
  await once(client, 'open');
  client.send(JSON.stringify({
    type: 'start', alphaSessionId: started.session.id, model: 'gpt-realtime-2.1', voiceId: 'cedar', speed: 0.92,
    behaviorPresetId: 'direct-program-director', context: { specialty: 'Internal Medicine' }, reasoningEffort: 'low',
  }));
  const messages = [];
  client.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  while (!messages.some((message) => message.type === 'rail_ready')) await new Promise((resolve) => setTimeout(resolve, 5));
  client.send(Buffer.alloc(4_800));
  client.send(JSON.stringify({ type: 'input_text', text: 'Typed fallback.' }));
  client.send(JSON.stringify({ type: 'opening', utterance: 'Tell me about yourself.' }));
  client.send(JSON.stringify({ type: 'interrupt', itemId: 'item-local', playedMs: 400 }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.some(([name]) => name === 'start'), true);
  assert.equal(calls.some(([name, bytes]) => name === 'audio' && bytes === 4_800), true);
  assert.equal(calls.some(([name]) => name === 'text'), true);
  assert.equal(calls.some(([name]) => name === 'opening'), true);
  assert.equal(calls.some(([name]) => name === 'interrupt'), true);

  await fetch(`${origin}/api/alpha-sessions/${started.session.id}/end`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ terminationState: 'completed' }),
  });
  await once(client, 'close');
  assert.equal(calls.some(([name]) => name === 'close'), true);
});
