import { fileURLToPath } from 'node:url';

import { createAvatarEndurancePlan } from '../../avatar/endurance-plan.mjs';
import { validatedLiveAvatarLiveKitOrigin } from '../../avatar/livekit-origin.mjs';
import { LIVE_INTERVIEWER_TARGET } from '../../avatar/live-interviewer-target.mjs';
import { loadLocalEnvironment } from '../../config/load-environment.mjs';
import { LiveAvatarProvider } from '../../providers/liveavatar-provider.mjs';
import { createOpenAISpeech } from '../../providers/openai-speech.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
loadLocalEnvironment({ path: `${root}.env` });
loadLocalEnvironment({ path: `${root}.env.local` });

const minutesArgument = process.argv.find((argument) => argument.startsWith('--minutes='));
const durationSeconds = Math.round(Number(minutesArgument?.split('=')[1] || 10) * 60);
const plan = createAvatarEndurancePlan(durationSeconds);
const presence = Object.freeze({
  liveAvatarAuth: Boolean(String(process.env.LIVEAVATAR_API_KEY || '').trim()),
  openaiAuth: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
});

if (!Object.values(presence).every(Boolean)) {
  console.error(JSON.stringify({ ready: false, reason: 'required-server-auth-or-origin-missing', presence }));
  process.exitCode = 2;
} else {
  const provider = new LiveAvatarProvider({
    enduranceHarness: true,
    enduranceDurationSeconds: plan.durationSeconds,
  });
  const startedAt = Date.now();
  const waitUntil = async (seconds) => {
    while (Date.now() - startedAt < seconds * 1_000) {
      const remaining = seconds * 1_000 - (Date.now() - startedAt);
      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, remaining)));
    }
  };
  let interrupted = false;
  let staleAudioRejected = false;
  let reconnected = false;
  let started = null;
  let cleanup = { requested: false, acknowledged: false, independentlyObserved: false };
  let closed = false;
  try {
    started = await provider.start();
    if (started.status !== 'connected' || started.avatarId !== LIVE_INTERVIEWER_TARGET.avatarId) {
      throw new Error('locked-avatar-session-not-connected');
    }
    validatedLiveAvatarLiveKitOrigin(started.media.url);

    for (let index = 0; index < plan.utterances.length; index += 1) {
      const checkpoint = plan.utterances[index];
      await waitUntil(checkpoint.atSeconds);
      if (!interrupted && checkpoint.atSeconds >= plan.checkpoints.interruptAtSeconds) {
        const speech = await createOpenAISpeech({
          input: checkpoint.text,
          selection: { presetId: 'experienced-male-program-director', voiceId: 'cedar', speed: 0.92, format: 'pcm' },
        });
        const eventId = `endurance-interrupt-${index}`;
        const split = Math.max(2, Math.floor(speech.bytes.length / 4 / 2) * 2);
        await provider.enqueueAudio(speech.bytes.subarray(0, split), { eventId, final: false });
        await provider.interrupt({ eventId });
        interrupted = true;
        try {
          await provider.enqueueAudio(speech.bytes.subarray(split), { eventId, final: true });
        } catch (error) {
          staleAudioRejected = error?.code === 'liveavatar_audio_cancelled';
        }
        continue;
      }
      if (!reconnected && checkpoint.atSeconds >= plan.checkpoints.reconnectAtSeconds) {
        await provider.reconnect();
        reconnected = true;
      }
      const speech = await createOpenAISpeech({
        input: checkpoint.text,
        selection: { presetId: 'experienced-male-program-director', voiceId: 'cedar', speed: 0.92, format: 'pcm' },
      });
      await provider.enqueueAudio(speech.bytes, { eventId: `endurance-${index}`, final: true });
    }
    await waitUntil(plan.checkpoints.stopAtSeconds);
    const usage = provider.usage();
    if (!interrupted || !staleAudioRejected || !reconnected) throw new Error('required-endurance-checkpoint-failed');
    cleanup = { requested: true, acknowledged: false, independentlyObserved: false };
    const stopped = await provider.stop({ reason: 'completed' });
    cleanup.acknowledged = stopped?.stopped === true;
    if (!cleanup.acknowledged) throw new Error('provider-cleanup-unacknowledged');
    await provider.close();
    closed = true;
    console.log(JSON.stringify({
      ready: true,
      finalAcceptance: false,
      scope: 'LiveAvatar LITE transport endurance; browser video, lip-sync, and W. Clint remain separate acceptance evidence',
      avatarId: LIVE_INTERVIEWER_TARGET.avatarId,
      audibleVoice: 'OpenAI cedar supplied PCM',
      lockedVoiceTargetId: LIVE_INTERVIEWER_TARGET.voiceId,
      durationSeconds: plan.durationSeconds,
      interrupted,
      staleAudioRejected,
      reconnected,
      sessions: usage.sessions,
      audioChunks: usage.audioChunks,
      interruptions: usage.interruptions,
      reconnects: usage.reconnects,
      cleanup,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      ready: false,
      finalAcceptance: false,
      code: String(error?.code || 'avatar_transport_endurance_failed').slice(0, 80),
    }));
    process.exitCode = 1;
  } finally {
    if (!closed) {
      try { await provider.close(); }
      catch {
        console.error(JSON.stringify({ ready: false, finalAcceptance: false, code: 'provider-cleanup-unconfirmed', cleanup }));
        process.exitCode = 1;
      }
    }
  }
}
