import assert from 'node:assert/strict';
import test from 'node:test';

import { InterviewerAudioAuthority } from '../../ivprep-v6/avatar/audio-authority.mjs';
import {
  EMBODIMENT_ADMIN_POLICY,
  EMBODIMENT_RUNTIME_CONTRACT,
  EmbodimentGenerationGate,
  FICTIONAL_INTERVIEWER_PROFILES,
  publicEmbodimentConfig,
} from './embodiment.mjs';

test('embodiment catalog is fictional, provider-neutral, and never exposes a speech-engine choice', () => {
  assert.equal(FICTIONAL_INTERVIEWER_PROFILES.length, 12);
  assert.deepEqual(new Set(FICTIONAL_INTERVIEWER_PROFILES.map((profile) => profile.roleId)), new Set(['program_director', 'faculty', 'chief_resident']));
  assert.deepEqual(new Set(FICTIONAL_INTERVIEWER_PROFILES.map((profile) => profile.styleId)), new Set(['dove', 'peacock', 'owl', 'eagle']));
  for (const profile of FICTIONAL_INTERVIEWER_PROFILES) {
    assert.equal(profile.fictional, true);
    assert.equal(profile.personClone, false);
    assert.equal(profile.providerVoiceId, null);
    assert.equal(profile.avatarAssetId, null);
  }
  assert.equal(EMBODIMENT_RUNTIME_CONTRACT.directorAuthority, 'missionmed-interviewbrain');
  assert.equal(EMBODIMENT_RUNTIME_CONTRACT.providerRole, 'actor-only');
  assert.equal(EMBODIMENT_RUNTIME_CONTRACT.providerSelectionExposedToStudent, false);
  assert.equal(EMBODIMENT_ADMIN_POLICY.providers.lemonSlice, 'deferred');
  assert.equal(EMBODIMENT_ADMIN_POLICY.activation.externalSpendAllowed, false);
  assert.equal(publicEmbodimentConfig().profiles.length, 12);
});

const successfulEffects = () => ({
  cancelProviderResponse: async () => true,
  flushAudio: async () => true,
  flushMotion: async () => true,
});
const generation = (id = '1') => ({
  profileId: 'program_director:owl', generationId: `gen-${id}`, responseId: `resp-${id}`,
  audioAuthority: 'openai-gpt-live-native',
});
const event = (kind, atMs, id = '1') => ({ kind, atMs, generationId: `gen-${id}`, responseId: `resp-${id}` });

test('generation gate reuses one audio authority, flushes on interruption, and rejects stale output', async () => {
  let now = 0;
  const audio = new InterviewerAudioAuthority({ now: () => now });
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...successfulEffects() });
  gate.begin({
    profileId: 'program_director:owl', generationId: 'gen-1', responseId: 'resp-1',
    audioAuthority: 'openai-realtime-direct',
  });
  assert.deepEqual(gate.accept({ kind: 'motion_frame', generationId: 'gen-1', responseId: 'resp-1', atMs: 10 }), { accepted: true, kind: 'motion_frame', atMs: 10 });
  now = 12;
  assert.equal(gate.accept({ kind: 'audio_started', generationId: 'gen-1', responseId: 'resp-1', atMs: 12 }).accepted, true);
  assert.equal(audio.health().active.utteranceId, 'resp-1');
  assert.equal(gate.accept({ kind: 'audio_delta', generationId: 'gen-1', responseId: 'resp-1', atMs: 11 }).reason, 'clock_regression');
  const interrupted = await gate.interrupt();
  assert.equal(interrupted.interrupted, true);
  assert.equal(interrupted.cancelProviderResponse, true);
  assert.equal(interrupted.flushAudio, true);
  assert.equal(interrupted.flushMotion, true);
  assert.equal(interrupted.cleaned, true);
  assert.equal(audio.health().active, null);
  assert.equal(gate.accept({ kind: 'audio_delta', generationId: 'gen-1', responseId: 'resp-1', atMs: 13 }).reason, 'stale_generation');

  gate.begin({
    profileId: 'chief_resident:dove', generationId: 'gen-2', responseId: 'resp-2',
    audioAuthority: 'liveavatar-livekit',
  });
  assert.equal(gate.accept({ kind: 'audio_started', generationId: 'gen-2', responseId: 'resp-2', atMs: 20 }).accepted, true);
  assert.equal(gate.accept({ kind: 'audio_completed', generationId: 'gen-2', responseId: 'resp-2', atMs: 30 }).accepted, true);
  assert.deepEqual(gate.accept({ kind: 'completed', generationId: 'gen-2', responseId: 'resp-2', atMs: 31 }), { completed: true, generationId: 'gen-2', responseId: 'resp-2' });
  assert.equal(audio.health().completedStreams, 2);
});

test('transport cleanup functions are mandatory, not implicit successful no-ops', () => {
  const audioAuthority = new InterviewerAudioAuthority();
  assert.throws(() => new EmbodimentGenerationGate({ audioAuthority }), /effects are required/);
  for (const name of Object.keys(successfulEffects())) {
    assert.throws(() => new EmbodimentGenerationGate({
      audioAuthority, ...successfulEffects(), [name]: undefined,
    }), /effects are required/);
  }
});

test('interruption invalidates identity before effects, shares cleanup, and holds audio until all acknowledgements', async () => {
  const audio = new InterviewerAudioAuthority();
  const calls = [];
  const resolveEffects = [];
  const effects = Object.fromEntries(Object.keys(successfulEffects()).map((name) => [name, (identity) => {
    calls.push({ name, identity, active: gate.active });
    return new Promise((resolve) => resolveEffects.push(resolve));
  }]));
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...effects });
  gate.begin(generation());
  gate.accept(event('audio_started', 10));
  const cleanup = gate.interrupt();
  assert.equal(gate.active, null);
  assert.equal(calls.length, 0);
  assert.equal(gate.interrupt(), cleanup);
  assert.equal(gate.accept(event('audio_delta', 11)).reason, 'stale_generation');
  assert.deepEqual(gate.complete(), { completed: false });
  assert.throws(() => gate.begin(generation('2')), /cleanup is pending/);
  assert.equal(audio.health().active.utteranceId, 'resp-1');
  await Promise.resolve();
  assert.deepEqual(calls.map(({ name }) => name), Object.keys(successfulEffects()));
  for (const call of calls) {
    assert.equal(call.active, null);
    assert.deepEqual(call.identity, { generationId: 'gen-1', responseId: 'resp-1' });
    assert.equal(call.identity, calls[0].identity);
    assert.equal(Object.isFrozen(call.identity), true);
  }
  resolveEffects[0](true);
  resolveEffects[1](true);
  await Promise.resolve();
  assert.equal(audio.health().active.utteranceId, 'resp-1');
  resolveEffects[2](true);
  assert.equal((await cleanup).cleaned, true);
  assert.equal(audio.health().active, null);
  assert.equal(gate.interrupt(), cleanup);
  assert.equal(calls.length, 3);
  gate.begin(generation('2'));
  assert.equal(gate.accept(event('audio_delta', 11)).reason, 'stale_generation');
  assert.equal(gate.accept(event('audio_started', 12, '2')).accepted, true);
  assert.deepEqual(gate.accept(event('completed', 15, '2')), {
    completed: true, generationId: 'gen-2', responseId: 'resp-2',
  });
  assert.equal(audio.health().completedStreams, 2);
});

for (const failure of ['throw', 'reject', undefined, false, { ok: true }]) {
  test(`failed cleanup (${String(failure)}) attempts every effect once and retains audio ownership`, async () => {
    const audio = new InterviewerAudioAuthority();
    const calls = [];
    const effects = Object.fromEntries(Object.keys(successfulEffects()).map((name) => [name, () => {
      calls.push(name);
      if (name !== 'flushAudio') return true;
      if (failure === 'throw') throw new Error('transport failure not exposed');
      if (failure === 'reject') return Promise.reject(new Error('transport failure not exposed'));
      return failure;
    }]));
    const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...effects });
    gate.begin(generation());
    gate.accept(event('audio_started', 10));
    const cleanup = gate.interrupt();
    const result = await cleanup;
    assert.deepEqual(calls, Object.keys(successfulEffects()));
    assert.equal(result.cancelProviderResponse, true);
    assert.equal(result.flushAudio, false);
    assert.equal(result.flushMotion, true);
    assert.equal(result.cleaned, false);
    assert.deepEqual(result.failedEffects, ['flushAudio']);
    assert.equal(audio.health().active.utteranceId, 'resp-1');
    assert.throws(() => audio.begin({ authority: 'openai-gpt-live-native', utteranceId: 'other' }), /already active/);
    assert.throws(() => gate.begin(generation('2')), /cleanup failed/);
    assert.equal(gate.accept(event('audio_completed', 12)).reason, 'stale_generation');
    assert.equal(gate.interrupt(), cleanup);
    assert.equal((await gate.interrupt()), result);
    assert.equal(calls.length, 3);
  });
}

test('every cleanup position can fail without preventing remaining effects or falsely releasing authority', async () => {
  for (const failedName of Object.keys(successfulEffects())) {
    const audio = new InterviewerAudioAuthority();
    const calls = [];
    const gate = new EmbodimentGenerationGate({ audioAuthority: audio,
      ...Object.fromEntries(Object.keys(successfulEffects()).map((name) => [name, () => {
        calls.push(name);
        if (name === failedName) throw new Error('failure');
        return true;
      }])),
    });
    gate.begin(generation());
    gate.accept(event('audio_started', 10));
    assert.deepEqual((await gate.interrupt()).failedEffects, [failedName]);
    assert.deepEqual(calls, Object.keys(successfulEffects()));
    assert.equal(audio.health().active.utteranceId, 'resp-1');
  }
});

test('audio authority release failure blocks the gate rather than claiming a clean interruption', async () => {
  const audio = new InterviewerAudioAuthority();
  audio.interrupt = () => { throw new Error('release failed'); };
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...successfulEffects() });
  gate.begin(generation());
  gate.accept(event('audio_started', 10));
  const result = await gate.interrupt();
  assert.equal(result.cleaned, false);
  assert.deepEqual(result.failedEffects, ['audioAuthorityRelease']);
  assert.equal(audio.health().active.utteranceId, 'resp-1');
  assert.throws(() => gate.begin(generation('2')), /cleanup failed/);
});

test('non-audible interruption still requires all effects and does not release another audio owner', async () => {
  const audio = new InterviewerAudioAuthority();
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...successfulEffects() });
  audio.begin({ authority: 'openai-gpt-live-native', utteranceId: 'unrelated' });
  gate.begin(generation());
  assert.equal((await gate.interrupt()).cleaned, true);
  assert.equal(audio.health().active.utteranceId, 'unrelated');
});

test('session clock and used generation identities survive both completion and interruption', async () => {
  const audio = new InterviewerAudioAuthority();
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio, ...successfulEffects() });
  gate.begin(generation());
  assert.deepEqual(gate.accept(event('completed', 20)), { completed: true, generationId: 'gen-1', responseId: 'resp-1' });
  assert.throws(() => gate.begin(generation()), /cannot be reused/);
  gate.begin(generation('2'));
  assert.equal(gate.accept(event('motion_frame', 19, '2')).reason, 'clock_regression');
  assert.equal(gate.accept(event('motion_frame', 25, '2')).accepted, true);
  await gate.interrupt();
  assert.throws(() => gate.begin(generation('2')), /cannot be reused/);
  gate.begin(generation('3'));
  assert.equal(gate.accept(event('audio_started', 24, '3')).reason, 'clock_regression');
  assert.equal(audio.health().active, null);
  assert.equal(gate.accept(event('audio_started', 26, '3')).accepted, true);
  assert.equal(gate.accept(event('audio_started', 100, '3')).reason, 'duplicate_audio');
  assert.equal(gate.accept(event('audio_delta', 27, '3')).accepted, true);
  assert.equal(gate.accept(event('completed', 28, '3')).completed, true);
  assert.equal(audio.health().active, null);
});
