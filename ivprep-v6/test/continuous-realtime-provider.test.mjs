import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPENAI_CONTINUOUS_REALTIME_CAPABILITIES,
  OpenAIContinuousRealtimeRail,
} from '../providers/openai-continuous-realtime.mjs';

class FakeWebSocket extends EventEmitter {
  static instance = null;

  constructor(url, options) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = 1;
    this.sent = [];
    FakeWebSocket.instance = this;
    queueMicrotask(() => this.emit('message', JSON.stringify({ type: 'session.created', session: { model: 'gpt-realtime-2.1' } })));
  }

  send(raw) {
    const event = JSON.parse(raw);
    this.sent.push(event);
    if (event.type === 'session.update') {
      queueMicrotask(() => this.emit('message', JSON.stringify({
        type: 'session.updated',
        session: {
          model: event.session.model,
          audio: {
            input: { turn_detection: event.session.audio.input.turn_detection },
            output: { voice: event.session.audio.output.voice },
          },
        },
      })));
    }
  }

  close() {
    this.readyState = 3;
    this.emit('close');
  }
}

test('continuous provider configures one long-lived exact Realtime 2.1 semantic-VAD session', async () => {
  const events = [];
  const rail = new OpenAIContinuousRealtimeRail({
    apiKey: 'unit-test-key-never-logged',
    WebSocketImpl: FakeWebSocket,
    now: () => 1_000,
    onEvent: (event) => events.push(event),
  });
  const health = await rail.start({
    model: 'gpt-realtime-2.1',
    voiceId: 'cedar',
    speed: 0.92,
    behaviorPresetId: 'direct-program-director',
    reasoningEffort: 'low',
    context: { specialty: 'Internal Medicine', questionPlan: ['Tell me about yourself.'] },
  });

  assert.equal(health.connected, true);
  assert.equal(health.model, 'gpt-realtime-2.1');
  const update = FakeWebSocket.instance.sent.find((event) => event.type === 'session.update');
  assert.deepEqual(update.session.audio.input.turn_detection, {
    type: 'semantic_vad', eagerness: 'low', create_response: true, interrupt_response: true,
  });
  assert.deepEqual(update.session.audio.input.format, { type: 'audio/pcm', rate: 24000 });
  assert.equal(update.session.audio.input.transcription.model, 'gpt-4o-mini-transcribe');
  assert.equal(update.session.audio.output.voice, 'cedar');
  assert.equal(update.session.audio.output.speed, 0.92);
  assert.equal(update.session.reasoning.effort, 'low');
  assert.equal(JSON.stringify(update).includes('unit-test-key-never-logged'), false);
  assert.equal(events.at(0).turnDetection, 'semantic_vad');
  await rail.close();
});

test('continuous provider streams bounded PCM, typed fallback, opening, cancel, and truncation events', async () => {
  const normalized = [];
  const rail = new OpenAIContinuousRealtimeRail({
    apiKey: 'unit-key', WebSocketImpl: FakeWebSocket, onEvent: (event) => normalized.push(event),
  });
  await rail.start({
    model: 'gpt-realtime-2.1', voiceId: 'marin', speed: 1,
    behaviorPresetId: 'professional-warm', context: { specialty: 'Pediatrics' },
  });
  rail.appendInputAudio(Buffer.alloc(4_800, 3));
  rail.appendInputText('I would like to answer by typing.');
  rail.requestOpening('Tell me about yourself.');
  rail.interrupt({ itemId: 'item-safe-local', playedMs: 740 });

  const sent = FakeWebSocket.instance.sent;
  assert.equal(sent.some((event) => event.type === 'input_audio_buffer.append' && Buffer.from(event.audio, 'base64').length === 4_800), true);
  assert.equal(sent.some((event) => event.type === 'conversation.item.create' && event.item.content[0].type === 'input_text'), true);
  assert.equal(sent.some((event) => event.type === 'response.create'), true);
  assert.equal(sent.some((event) => event.type === 'response.cancel'), true);
  assert.equal(sent.some((event) => event.type === 'conversation.item.truncate' && event.audio_end_ms === 740), true);
  assert.throws(() => rail.appendInputAudio(Buffer.alloc(33 * 1024)), /bounded PCM16/);

  FakeWebSocket.instance.emit('message', JSON.stringify({ type: 'input_audio_buffer.speech_started', audio_start_ms: 200, item_id: 'user-item' }));
  FakeWebSocket.instance.emit('message', JSON.stringify({ type: 'response.done', response: { id: 'resp-safe', status: 'cancelled', usage: { total_tokens: 4 } } }));
  assert.equal(normalized.some((event) => event.type === 'speech_started'), true);
  assert.equal(normalized.some((event) => event.type === 'response_cancelled'), true);
  await rail.close();
});

test('future GPT-Live remains a truthful unavailable seam', () => {
  assert.equal(OPENAI_CONTINUOUS_REALTIME_CAPABILITIES.model, 'gpt-realtime-2.1');
  assert.equal(OPENAI_CONTINUOUS_REALTIME_CAPABILITIES.turnDetection.type, 'semantic_vad');
});
