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

test('generation gate reuses one audio authority, flushes on interruption, and rejects stale output', () => {
  let now = 0;
  const audio = new InterviewerAudioAuthority({ now: () => now });
  const gate = new EmbodimentGenerationGate({ audioAuthority: audio });
  gate.begin({
    profileId: 'program_director:owl', generationId: 'gen-1', responseId: 'resp-1',
    audioAuthority: 'openai-realtime-direct',
  });
  assert.deepEqual(gate.accept({ kind: 'motion_frame', generationId: 'gen-1', responseId: 'resp-1', atMs: 10 }), { accepted: true, kind: 'motion_frame', atMs: 10 });
  now = 12;
  assert.equal(gate.accept({ kind: 'audio_started', generationId: 'gen-1', responseId: 'resp-1', atMs: 12 }).accepted, true);
  assert.equal(audio.health().active.utteranceId, 'resp-1');
  assert.equal(gate.accept({ kind: 'audio_delta', generationId: 'gen-1', responseId: 'resp-1', atMs: 11 }).reason, 'clock_regression');
  const interrupted = gate.interrupt();
  assert.equal(interrupted.interrupted, true);
  assert.equal(interrupted.cancelProviderResponse, true);
  assert.equal(interrupted.flushAudio, true);
  assert.equal(interrupted.flushMotion, true);
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
