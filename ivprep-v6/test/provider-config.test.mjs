import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_INTERVIEWER_MODEL,
  DEFAULT_OBSERVER_MODEL,
  DEFAULT_REALTIME_MODEL,
  MODEL_ARCHITECTURES,
  MODEL_CANDIDATES,
  publicModelStudioConfig,
  requireModelCandidate,
} from '../config/models.mjs';
import {
  DEFAULT_SPEECH_MODEL,
  DEFAULT_SPEECH_VOICE_ID,
  PREFERRED_FOUNDER_VOICE,
  normalizeSpeechSelection,
  requireRealtimeVoiceId,
  requireSpeechVoiceId,
} from '../config/voices.mjs';

const EXPECTED_MODELS = [
  ['gpt-5.6-terra', 'responses-openai-speech'],
  ['gpt-5.6-sol', 'responses-openai-speech'],
  ['gpt-5.6-luna', 'responses-openai-speech'],
  ['gpt-realtime-2.1', 'native-realtime-voice'],
  ['gpt-realtime-2.1-mini', 'native-realtime-voice'],
  ['gpt-realtime-2', 'native-realtime-voice'],
];

test('provider configuration preserves the exact alpha defaults and selectable IDs', () => {
  assert.equal(DEFAULT_INTERVIEWER_MODEL, 'gpt-5.6-terra');
  assert.equal(DEFAULT_OBSERVER_MODEL, 'gpt-5.6-luna');
  assert.equal(DEFAULT_REALTIME_MODEL, 'gpt-realtime-2.1');
  assert.deepEqual(
    MODEL_CANDIDATES.map(({ id, architecture }) => [id, architecture]),
    EXPECTED_MODELS,
  );
  assert.equal(MODEL_ARCHITECTURES.RESPONSES_SPEECH, 'responses-openai-speech');
  assert.equal(MODEL_ARCHITECTURES.NATIVE_REALTIME, 'native-realtime-voice');
});

test('unsupported model selections fail explicitly without aliases or fallback', () => {
  assert.throws(() => requireModelCandidate('gpt-5.6-terra', 'native-realtime-voice'), /Unsupported model/);
  assert.throws(() => requireModelCandidate('gpt-realtime', 'native-realtime-voice'), /Unsupported model/);
  assert.throws(() => requireModelCandidate('gpt-5.6', 'responses-openai-speech'), /Unsupported model/);

  const onlySol = [{ id: 'gpt-5.6-sol', architecture: 'responses-openai-speech' }];
  const publicConfig = publicModelStudioConfig({ models: onlySol });
  assert.equal(publicConfig.defaultModelId, null, 'missing Terra must not silently select another model');
  assert.deepEqual(publicConfig.models, onlySol);
});

test('speech defaults and voice selections keep exact provider IDs', () => {
  assert.equal(DEFAULT_SPEECH_MODEL, 'gpt-4o-mini-tts');
  assert.equal(DEFAULT_SPEECH_VOICE_ID, 'cedar');
  assert.equal(normalizeSpeechSelection().voiceId, 'cedar');
  assert.equal(requireSpeechVoiceId('marin'), 'marin');
  assert.equal(requireRealtimeVoiceId('cedar'), 'cedar');
  assert.throws(() => requireSpeechVoiceId('W. Clint Oxley'), /Unsupported/);
  assert.throws(() => requireRealtimeVoiceId('onyx'), /Unsupported/);
});

test('founder voice display preference remains unbound until a provider ID is verified', () => {
  assert.deepEqual(PREFERRED_FOUNDER_VOICE, {
    displayName: 'W. Clint Oxley',
    providerVoiceId: null,
    verification: 'unverified',
  });
});
