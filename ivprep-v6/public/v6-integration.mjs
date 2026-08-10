import { MicController } from './mic-controller.mjs';
import { LiveAvatarBrowserProvider } from './avatar-provider.mjs';
import { OpenAIRealtimeRail, RAIL_IDS } from './conversation-rail.mjs';
import { InterviewerAudioAuthority } from './avatar/audio-authority.mjs';

const bridge = window.V6Bridge;
if (!bridge) throw new Error('V6 integration bridge is unavailable.');

const state = {
  railId: RAIL_IDS.RESPONSES_SPEECH,
  railStatus: 'available',
  railConfigs: [],
  railConnectionMs: null,
  railFirstAudioMs: null,
  railFloorToResponseMs: null,
  railAnswerEndToResponseMs: null,
  railInterruptionMs: null,
  avatarInterruptAckMs: null,
  lastAvatarCleanup: null,
  avatarReconnectEvidence: [],
  continuousCompletedTurn: null,
  continuousAlreadySpoken: null,
  model: 'gpt-5.6-terra',
  providerModel: null,
  architecture: 'responses-openai-speech',
  observerModel: 'gpt-5.6-luna',
  providerObserverModel: null,
  behaviorPresetId: 'direct-program-director',
  voicePresetId: 'experienced-male-program-director',
  voiceId: 'cedar',
  voiceSpeed: 0.92,
  models: [],
  behaviors: [],
  voices: [],
  openaiConfigured: false,
  providerHealth: 'checking',
  streaming: 'idle',
  latencyMs: null,
  roundTripMs: null,
  muted: false,
  paused: false,
  typedFallbackOpen: false,
  interviewStarted: false,
  interviewerSpeaking: false,
  avatarSpeechActive: false,
  currentAudio: null,
  currentAudioUrl: null,
  currentPlaybackSettle: null,
  activeSpeechController: null,
  activeExchangeController: null,
  pendingAudio: null,
  lastError: null,
  avatarEnabled: true,
  avatarProviderReady: false,
  avatarNotice: 'Checking live-avatar provider…',
  facultyRoster: [],
  selectedInterviewerId: 'senior-academic-pd-male',
  alphaSessionId: null,
  alphaSessionStarting: null,
  alphaSessionEnding: null,
  alphaMode: null,
  alphaDisabled: false,
  usageLedger: [],
  founderHarness: false,
  avatarTarget: null,
  audioAuthority: 'browser-openai-speech',
  audibleVoiceTruth: 'OpenAI Speech · cedar',
};

let continuousRail = null;
const interviewerAudio = new InterviewerAudioAuthority();

const avatar = new LiveAvatarBrowserProvider({
  videoContainer: document.getElementById('ivtile'),
  onState: ({ state: avatarState, reason }) => {
    if (['degraded', 'disconnected', 'unavailable', 'cleanup-unconfirmed'].includes(avatarState)) {
      interviewerAudio.interrupt();
      state.alphaMode = 'voice-only';
      state.audioAuthority = 'browser-openai-speech';
      state.audibleVoiceTruth = `OpenAI Speech · ${state.voiceId}`;
    }
    state.avatarNotice = avatarState === 'live'
      ? 'Live synchronized avatar audio + video connected. LiveKit is the only audible interviewer stream.'
      : reason || `Avatar ${avatarState}.`;
    renderAvatarState();
    renderDiagnostics();
  },
});

function publicError(error, fallback = 'The interviewer provider is unavailable.') {
  const message = String(error?.message || error?.error?.message || error?.error || error?.code || fallback).trim();
  return new Error(message.slice(0, 240));
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw publicError({ message: typeof payload?.error === 'string' ? payload.error : payload?.error?.message || payload?.message });
  return payload;
}

function architectureFor(modelId) {
  return state.models.find((candidate) => candidate.id === modelId)?.architecture
    || (String(modelId).startsWith('gpt-realtime') ? 'native-realtime-voice' : 'responses-openai-speech');
}

function setInterviewerSpeaking(active, streaming = active ? 'streaming' : 'complete') {
  state.interviewerSpeaking = Boolean(active);
  state.streaming = streaming;
  micController.setInterviewerSpeaking(Boolean(active));
  bridge.setIvState(active ? 'speaking' : 'idle');
  renderDiagnostics();
  renderFocusRoom();
}

function base64Audio(base64, contentType) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  if (String(contentType).startsWith('audio/pcm')) return pcm16WavBlob(bytes);
  return new Blob([bytes], { type: contentType || 'audio/wav' });
}

function pcm16WavBlob(bytes) {
  const wav = new ArrayBuffer(44 + bytes.length);
  const view = new DataView(wav);
  const write = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + bytes.length, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, bytes.length, true);
  new Uint8Array(wav, 44).set(bytes);
  return new Blob([wav], { type: 'audio/wav' });
}

function interruptAudio(reason = 'interrupted') {
  if (state.activeSpeechController) state.activeSpeechController.abort(reason);
  state.activeSpeechController = null;
  const audio = state.currentAudio;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  if (state.currentAudioUrl) URL.revokeObjectURL(state.currentAudioUrl);
  state.currentAudio = null;
  state.currentAudioUrl = null;
  const settle = state.currentPlaybackSettle;
  state.currentPlaybackSettle = null;
  state.avatarSpeechActive = false;
  interviewerAudio.interrupt();
  setInterviewerSpeaking(false, reason);
  let avatarInterruption = Promise.resolve({ interrupted: false });
  if (avatar.sessionId) {
    const interruptedAt = performance.now();
    avatarInterruption = avatar.interrupt().then((result) => {
      state.avatarInterruptAckMs = Math.round(performance.now() - interruptedAt);
      renderDiagnostics();
      return result;
    }).catch(() => ({ interrupted: false }));
  }
  if (settle) settle();
  return avatarInterruption;
}

async function ensureAlphaSession() {
  if (state.alphaSessionId) return state.alphaSessionId;
  if (state.alphaSessionStarting) return state.alphaSessionStarting;
  state.alphaSessionStarting = (async () => {
    const selected = state.facultyRoster.find((record) => record.id === state.selectedInterviewerId) || state.facultyRoster[0];
    const continuousDirectAudio = state.railId === RAIL_IDS.OPENAI_REALTIME;
    const mode = !continuousDirectAudio && state.avatarEnabled && state.avatarProviderReady && selected?.available ? 'avatar' : 'voice-only';
    if (mode === 'voice-only') {
      state.audioAuthority = continuousDirectAudio ? 'openai-realtime-direct' : 'browser-openai-speech';
      state.audibleVoiceTruth = continuousDirectAudio
        ? `OpenAI Realtime · ${state.voiceId}`
        : `OpenAI Speech · ${state.voiceId}`;
      state.avatarNotice = continuousDirectAudio
        ? 'Continuous Conversation is using direct OpenAI Realtime audio. LiveAvatar is visibly off for this experimental rail to prevent duplicate or unsynchronized audio.'
        : state.avatarEnabled
        ? 'Live avatar unavailable: provider authorization is missing. Continuing with the same interviewer intelligence and OpenAI voice only.'
        : 'Avatar is off. Continuing with the same interviewer intelligence and OpenAI voice only.';
      renderAvatarState();
    }
    const payload = await jsonRequest('/api/alpha-sessions/start', {
      method: 'POST',
      body: JSON.stringify({
        testIdentity: 'founder-local',
        durationMinutes: 2,
        selectedInterviewer: selected?.id || state.selectedInterviewerId,
        model: state.model,
        voice: state.voiceId,
        avatar: selected?.avatarId || null,
        behavior: state.behaviorPresetId,
        mode,
      }),
    });
    state.alphaSessionId = payload.session.id;
    state.alphaMode = mode;
    if (mode === 'avatar') {
      try {
        await avatar.createSession({
          alphaSessionId: state.alphaSessionId,
          interviewerId: selected.id,
          avatarId: selected.avatarId,
          maxSessionDuration: Math.min(2, payload.session.durationMinutes) * 60,
        });
        await avatar.start();
        state.audioAuthority = 'liveavatar-livekit';
        state.audibleVoiceTruth = `Supplied OpenAI Speech · ${state.voiceId} · synchronized by LiveAvatar LITE`;
        await persistAlphaEvent({ avatarStarted: true, deliveryMode: 'avatar', deliveryReason: 'live-media-ready' });
      } catch (error) {
        state.avatarNotice = `Live avatar unavailable: ${publicError(error).message} Voice-only remains active.`;
        state.alphaMode = 'voice-only';
        state.audioAuthority = 'browser-openai-speech';
        state.audibleVoiceTruth = `OpenAI Speech · ${state.voiceId}`;
        await persistAlphaEvent({ deliveryMode: 'voice-only', deliveryReason: 'avatar-start-failed' });
        renderAvatarState();
      }
    }
    return state.alphaSessionId;
  })();
  try { return await state.alphaSessionStarting; }
  finally { state.alphaSessionStarting = null; }
}

async function persistAlphaEvent(event) {
  if (!state.alphaSessionId) return;
  try {
    await jsonRequest(`/api/alpha-sessions/${encodeURIComponent(state.alphaSessionId)}/events`, { method: 'POST', body: JSON.stringify(event) });
  } catch (error) {
    state.lastError = `Persistence: ${publicError(error).message}`;
    renderDiagnostics();
  }
}

async function endAlphaSession(terminationState = 'completed', { keepalive = false } = {}) {
  if (state.alphaSessionEnding) return state.alphaSessionEnding;
  if (!state.alphaSessionId) return;
  const id = state.alphaSessionId;
  state.alphaSessionEnding = (async () => {
    const errors = [];
    let persisted = false;
    let avatarCleanup = { requested: false, acknowledged: true, state: 'not-required' };
    try { await closeContinuousRail(); } catch (error) { errors.push(error); }
    const persistEnd = async () => {
      const result = await jsonRequest(`/api/alpha-sessions/${encodeURIComponent(id)}/end`, {
        method: 'POST',
        body: JSON.stringify({ terminationState }),
        keepalive,
      });
      persisted = true;
      if (result.avatarCleanup) avatarCleanup = result.avatarCleanup;
      if (avatarCleanup.acknowledged && avatar.sessionId) avatar.acknowledgeServerCleanup();
      if (avatarCleanup.requested && !avatarCleanup.acknowledged) {
        errors.push(new Error('Remote avatar cleanup is unconfirmed; server ownership was retained for retry.'));
      }
    };
    if (keepalive) {
      try { await persistEnd(); } catch (error) { errors.push(error); }
      // The alpha-end endpoint owns remote provider cleanup on unload; this call only releases local media.
      try { if (avatar.health().state !== 'idle') await avatar.stop(terminationState); } catch {}
    } else {
      try {
        if (avatar.health().state !== 'idle') {
          const stopped = await avatar.stop(terminationState);
          if (stopped?.cleanup) avatarCleanup = stopped.cleanup;
        }
      } catch (error) { errors.push(error); }
      try { await persistEnd(); } catch (error) { errors.push(error); }
    }
    if (!keepalive && avatarCleanup.requested && !avatarCleanup.acknowledged && avatar.sessionId) {
      try {
        const retried = await avatar.stop('cleanup-retry');
        if (retried?.cleanup) avatarCleanup = retried.cleanup;
      } catch (error) { errors.push(error); }
    }
    state.lastAvatarCleanup = avatarCleanup;
    if (persisted && avatarCleanup.acknowledged && state.alphaSessionId === id) {
      state.alphaSessionId = null;
      state.founderHarness = false;
    }
    if (errors.length) state.lastError = `Cleanup: ${publicError(errors[0]).message}`;
    return { persisted, errors: errors.length, avatarCleanup };
  })();
  try { return await state.alphaSessionEnding; }
  finally { state.alphaSessionEnding = null; }
}

async function playBlob(blob, telemetry = {}) {
  await interruptAudio('loading');
  const utteranceId = crypto.randomUUID();
  interviewerAudio.begin({ authority: 'browser-openai-speech', utteranceId });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  state.currentAudioUrl = url;
  state.currentAudio = audio;
  state.latencyMs = telemetry.latencyMs ?? state.latencyMs;
  setInterviewerSpeaking(true, 'streaming');
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, reason = 'complete') => {
      if (settled) return;
      settled = true;
      if (state.currentAudio === audio) {
        if (state.currentAudioUrl) URL.revokeObjectURL(state.currentAudioUrl);
        state.currentAudio = null;
        state.currentAudioUrl = null;
        state.currentPlaybackSettle = null;
        setInterviewerSpeaking(false, reason);
      }
      interviewerAudio.finish({ reason });
      if (error) reject(error); else resolve();
    };
    state.currentPlaybackSettle = () => finish(null, state.streaming);
    audio.addEventListener('ended', () => finish(), { once: true });
    audio.addEventListener('error', () => finish(new Error('Spoken interviewer audio could not be played.'), 'error'), { once: true });
    audio.play().catch((error) => {
      finish(publicError(error, 'Browser audio playback was blocked.'), 'blocked');
    });
  });
}

function continuousSessionContext() {
  const context = bridge.context();
  return {
    interviewType: context.selection?.type || 'residency practice',
    specialty: context.selection?.specialty || context.selection?.spec || 'not specified',
    programContext: context.selection?.program || 'general',
    interviewer: context.interviewer,
    questionPlan: context.questions,
    authorizedApplicantContext: {
      priorities: context.priorities,
      stories: context.stories,
      timeline: context.timeline,
    },
    sessionRules: {
      durationSeconds: 120,
      thoughtfulPausesAllowed: true,
      exactFallbackRail: 'Responses + OpenAI Speech',
    },
  };
}

function createContinuousRail() {
  return new OpenAIRealtimeRail({
    onState: (event) => {
      state.railStatus = event.status || state.railStatus;
      if (event.connectedMs != null) state.railConnectionMs = event.connectedMs;
      if (event.firstAudioMs != null) state.railFirstAudioMs = event.firstAudioMs;
      if (event.timings?.firstAudioMs != null) state.railFirstAudioMs = event.timings.firstAudioMs;
      if (event.timings?.floorToResponseMs != null) state.railFloorToResponseMs = event.timings.floorToResponseMs;
      if (event.interruptionLatencyMs != null) state.railInterruptionMs = event.interruptionLatencyMs;
      if (event.status === 'responding' && micController.detector.lastSpeechAtMs != null) {
        state.railAnswerEndToResponseMs = Math.max(0, Math.round(performance.now() - micController.detector.lastSpeechAtMs));
      }
      if (event.status === 'speaking' || event.status === 'responding') {
        if (!interviewerAudio.health().active) interviewerAudio.begin({ authority: 'openai-realtime-direct', utteranceId: crypto.randomUUID() });
        setInterviewerSpeaking(true, 'streaming');
      }
      if (['listening', 'floor-yield-detected'].includes(event.status)) {
        interviewerAudio.finish({ reason: event.status });
        setInterviewerSpeaking(false, event.status);
        if (bridge.recording) bridge.setIvState('listen');
      }
      renderDiagnostics();
      renderRailFallbackOffer();
    },
    onTurn: (turn) => {
      state.continuousCompletedTurn = turn;
      state.continuousAlreadySpoken = turn.utterance;
      state.railFirstAudioMs = turn.timings?.firstAudioMs ?? state.railFirstAudioMs;
      state.railFloorToResponseMs = turn.timings?.floorToResponseMs ?? state.railFloorToResponseMs;
      if (bridge.view === 'room' && bridge.recording) {
        bridge.setTypedTranscript(turn.applicant);
        bridge.endTake();
      }
    },
    onError: (error) => {
      interviewerAudio.interrupt();
      state.railStatus = 'failed';
      state.providerHealth = 'degraded';
      state.lastError = publicError(error, 'Continuous Conversation unavailable.').message;
      setInterviewerSpeaking(false, 'error');
      bridge.setIvState('error');
      bridge.toast('Continuous Conversation unavailable. Continue using High-Intelligence Voice is ready.');
      renderDiagnostics();
      renderRailFallbackOffer();
    },
  });
}

async function ensureContinuousRail() {
  if (state.railId !== RAIL_IDS.OPENAI_REALTIME) return null;
  if (continuousRail?.health().connected) return continuousRail;
  if (!bridge.media?.stream || !bridge.media.mic) throw new Error('Grant microphone access before starting Continuous Conversation.');
  await ensureAlphaSession();
  continuousRail = createContinuousRail();
  await continuousRail.start({
    stream: bridge.media.stream,
    alphaSessionId: state.alphaSessionId,
    model: 'gpt-realtime-2.1',
    voiceId: state.voiceId,
    speed: Math.min(1.5, Math.max(0.25, state.voiceSpeed)),
    behaviorPresetId: state.behaviorPresetId,
    context: continuousSessionContext(),
    reasoningEffort: 'low',
  });
  state.providerModel = 'gpt-realtime-2.1';
  state.providerHealth = 'healthy';
  return continuousRail;
}

async function closeContinuousRail() {
  const rail = continuousRail;
  continuousRail = null;
  if (rail) await rail.close().catch(() => {});
  interviewerAudio.interrupt();
  if (state.railId === RAIL_IDS.OPENAI_REALTIME && state.railStatus !== 'failed') state.railStatus = 'closed';
}

async function speak(text) {
  if (state.railId === RAIL_IDS.OPENAI_REALTIME) {
    state.interviewStarted = true;
    renderFocusRoom();
    const rail = await ensureContinuousRail();
    if (state.continuousAlreadySpoken === text) {
      state.continuousAlreadySpoken = null;
      if (!bridge.recording && bridge.view === 'room') bridge.beginRec();
      return;
    }
    rail.requestOpening(text);
    if (!bridge.recording && bridge.view === 'room') bridge.beginRec();
    return;
  }
  await ensureAlphaSession();
  if (state.alphaMode === 'avatar' && avatar.health().available) {
    const startedAt = performance.now();
    if (state.activeSpeechController || state.avatarSpeechActive || interviewerAudio.health().active) {
      await interruptAudio('superseded');
    }
    const controller = new AbortController();
    state.activeSpeechController = controller;
    state.streaming = 'generating';
    bridge.setIvState('thinking');
    renderDiagnostics();
    let generatedPcm = null;
    let fallBackToVoice = false;
    try {
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ input: text, selection: { presetId: state.voicePresetId, voiceId: state.voiceId, speed: state.voiceSpeed, format: 'pcm' } }),
      });
      if (!response.ok) throw publicError(await response.json().catch(() => ({})), 'OpenAI Speech request failed.');
      const audio = await response.arrayBuffer();
      generatedPcm = new Uint8Array(audio);
      if (controller.signal.aborted) return;
      state.avatarSpeechActive = true;
      interviewerAudio.begin({ authority: 'liveavatar-livekit', utteranceId: crypto.randomUUID() });
      setInterviewerSpeaking(true, 'streaming');
      const result = await avatar.enqueueAudio(audio, { signal: controller.signal });
      if (!result?.accepted) throw new Error(result?.reason || 'Live avatar rejected the interviewer audio.');
      if (result.playbackEnded === false && result.reason !== 'interrupted') {
        state.alphaMode = 'voice-only';
        state.audioAuthority = 'browser-openai-speech';
        state.audibleVoiceTruth = `OpenAI Speech · ${state.voiceId}`;
        state.avatarNotice = 'Live avatar playback did not complete. Continuing with the same intelligence and OpenAI voice only.';
        await persistAlphaEvent({ deliveryMode: 'voice-only', deliveryReason: 'avatar-playback-failed' });
        renderAvatarState();
        throw new Error('Live avatar playback did not complete. Continue in voice-only mode.');
      }
      state.latencyMs = Number(response.headers.get('X-IVPrep-Latency-Ms')) || Math.round(performance.now() - startedAt);
      state.roundTripMs = Math.round(performance.now() - startedAt);
      return;
    } catch (error) {
      if (controller.signal.aborted) return;
      await avatar.interrupt().catch(() => {});
      await avatar.stop('provider-failure').catch(() => {});
      state.alphaMode = 'voice-only';
      state.audioAuthority = 'browser-openai-speech';
      state.audibleVoiceTruth = `OpenAI Speech · ${state.voiceId}`;
      state.avatarNotice = `Avatar unavailable — continuing with voice. ${publicError(error).message}`;
      await persistAlphaEvent({ deliveryMode: 'voice-only', deliveryReason: 'avatar-utterance-failed' });
      if (generatedPcm?.byteLength) {
        state.pendingAudio = {
          utterance: text,
          blob: pcm16WavBlob(generatedPcm),
          latencyMs: Math.round(performance.now() - startedAt),
        };
      }
      fallBackToVoice = true;
      renderAvatarState();
    } finally {
      if (state.activeSpeechController === controller) state.activeSpeechController = null;
      state.avatarSpeechActive = false;
      interviewerAudio.finish({ reason: state.streaming === 'interrupted' ? 'interrupted' : 'complete' });
      setInterviewerSpeaking(false, state.streaming === 'interrupted' ? 'interrupted' : 'complete');
    }
    if (!fallBackToVoice) return;
  }
  if (state.pendingAudio?.utterance === text) {
    const pending = state.pendingAudio;
    state.pendingAudio = null;
    return playBlob(pending.blob, { latencyMs: pending.latencyMs });
  }
  const startedAt = performance.now();
  if (state.activeSpeechController) state.activeSpeechController.abort('superseded');
  const controller = new AbortController();
  state.activeSpeechController = controller;
  let response;
  let audioBlob;
  try {
    response = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        input: text,
        selection: {
          presetId: state.voicePresetId,
          voiceId: state.voiceId,
          speed: state.voiceSpeed,
          format: 'mp3',
        },
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      state.providerHealth = 'degraded';
      state.lastError = typeof payload?.error === 'string' ? payload.error : payload?.error?.message || 'OpenAI Speech request failed.';
      renderDiagnostics();
      throw publicError({ message: state.lastError });
    }
    audioBlob = await response.blob();
  } finally {
    if (state.activeSpeechController === controller) state.activeSpeechController = null;
  }
  state.voiceId = response.headers.get('X-IVPrep-Voice-Id') || state.voiceId;
  state.latencyMs = Number(response.headers.get('X-IVPrep-Latency-Ms')) || Math.round(performance.now() - startedAt);
  state.roundTripMs = Math.round(performance.now() - startedAt);
  state.providerHealth = 'healthy';
  return playBlob(audioBlob, { latencyMs: state.latencyMs });
}

function interviewContext(take) {
  const context = bridge.context();
  return {
    interviewType: context.selection?.type || 'residency practice',
    specialty: context.selection?.specialty || context.selection?.spec || 'not specified',
    programContext: context.selection?.program || 'general',
    interviewer: context.interviewer,
    questionPlan: context.questions,
    turnPosition: {
      currentIndex: bridge.run.qi,
      totalPlannedQuestions: context.questions.length,
      remainingPlannedQuestions: Math.max(0, context.questions.length - bridge.run.qi - 1),
    },
    previousTurns: context.memory,
    latestQuestion: take.q,
    latestApplicantAnswer: take.transcript || '[No usable transcript was captured.]',
    answerSignals: {
      durationSeconds: take.dur,
      pauseCount: take.pauses,
      longestPauseSeconds: take.longest,
      words: take.words,
    },
    missionMedContext: { priorities: context.priorities, stories: context.stories, timeline: context.timeline },
  };
}

async function onTakeComplete(take) {
  if (!take?.transcript?.trim()) throw new Error('No usable transcript was captured. Use the typed-answer fallback or retry the microphone.');
  const startedAt = performance.now();
  const context = interviewContext(take);
  if (state.activeExchangeController) state.activeExchangeController.abort('superseded');
  const controller = new AbortController();
  state.activeExchangeController = controller;
  let payload;
  try {
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) {
      const completed = state.continuousCompletedTurn;
      if (!completed?.utterance || !completed?.applicant) throw new Error('Continuous Conversation did not produce a complete transcript pair.');
      state.continuousCompletedTurn = null;
      const observer = await jsonRequest('/api/interviewer-observe', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          observerModel: state.observerModel,
          context: { ...context, latestApplicantAnswer: completed.applicant },
          utterance: completed.utterance,
        }),
      });
      payload = {
        model: 'gpt-realtime-2.1',
        observerModel: observer.providerModel || state.observerModel,
        voiceId: state.voiceId,
        utterance: completed.utterance,
        metadata: observer.metadata,
        timings: {
          ...completed.timings,
          observerMs: observer.latencyMs,
          totalMs: (completed.timings?.floorToResponseMs || 0) + (observer.latencyMs || 0),
        },
        usage: { interviewer: completed.usage, observer: observer.usage },
      };
    } else if (state.architecture === 'native-realtime-voice') {
      payload = await jsonRequest('/api/realtime-turn', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          model: state.model,
          voiceId: state.voiceId,
          behaviorPresetId: state.behaviorPresetId,
          context,
        }),
      });
      if (payload.audioBase64) {
        state.pendingAudio = {
          utterance: payload.utterance,
          blob: base64Audio(payload.audioBase64, payload.audioContentType),
          latencyMs: payload.timings?.firstAudioMs ?? payload.timings?.totalMs,
        };
      }
    } else {
      payload = await jsonRequest('/api/interviewer-exchange', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          model: state.model,
          observerModel: state.observerModel,
          behaviorPresetId: state.behaviorPresetId,
          context,
        }),
      });
    }
  } finally {
    if (state.activeExchangeController === controller) state.activeExchangeController = null;
  }
  state.providerModel = payload.model || state.model;
  state.providerObserverModel = payload.observerModel || state.observerModel;
  state.voiceId = payload.voiceId || state.voiceId;
  state.latencyMs = payload.timings?.firstAudioMs ?? payload.timings?.naturalMs ?? null;
  state.roundTripMs = Math.round(performance.now() - startedAt);
  state.providerHealth = 'healthy';
  state.lastError = null;
  renderDiagnostics();
  await persistAlphaEvent({
    transcript: { question: take.q, answer: take.transcript || '', generatedUtterance: payload.utterance },
    instructorRecord: payload.metadata || null,
    modelUsage: { railId: state.railId, model: state.providerModel, observerModel: state.providerObserverModel, usage: payload.usage || null, timings: payload.timings || null },
  });
  return {
    utterance: payload.utterance,
    observer: payload.metadata,
    provider: 'openai',
    model: state.model,
    providerModel: state.providerModel,
    providerObserverModel: state.providerObserverModel,
    voice: state.voiceId,
    final: Boolean(payload.metadata?.final),
    terminated: Boolean(payload.metadata?.terminated),
    terminationReason: payload.metadata?.terminationReason || null,
    latency: { ...payload.timings, browserRoundTripMs: state.roundTripMs },
  };
}

function cancelTurn(reason = 'cancelled') {
  if (state.activeExchangeController) state.activeExchangeController.abort(reason);
  state.activeExchangeController = null;
  state.pendingAudio = null;
  if (continuousRail) closeContinuousRail();
  interruptAudio(reason);
}

const micController = new MicController({
  level: () => bridge.audio?.level || 0,
  silenceMs: 5000,
  onTurnComplete: () => {
    if (!bridge.recording || state.paused) return;
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) return;
    bridge.toast('Five seconds of genuine silence: answer complete.');
    bridge.endTake();
  },
  onBargeIn: () => {
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) {
      continuousRail?.interrupt({ automatic: false });
      bridge.toast('Interviewer stopped. The floor is yours.');
      return;
    }
    interruptAudio('interrupted');
    bridge.toast('Interviewer stopped. The floor is yours.');
    if (!bridge.recording && bridge.view === 'room') bridge.beginRec();
  },
});
micController.start();
setInterval(() => {
  if (!bridge.media?.mic) {
    micController.resetTurn();
    return;
  }
  if (bridge.recording && !micController.listening) micController.start();
  if (!bridge.recording) micController.resetTurn();
  micController.tick();
}, 100);

function option(select, value, label, selected) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  node.selected = selected;
  select.append(node);
}

function studioField(label, select) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:grid;gap:6px;min-width:190px;flex:1';
  const title = document.createElement('span');
  title.className = 'eyebrow';
  title.style.fontSize = '9px';
  title.textContent = label;
  select.style.cssText = 'width:100%;padding:10px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:8px';
  wrap.append(title, select);
  return wrap;
}

function openFounderHarness() {
  if (state.alphaSessionId || continuousRail?.health().connected) {
    bridge.toast('End the active interview before starting a new Founder test.');
    return;
  }
  state.founderHarness = true;
  state.selectedInterviewerId = 'senior-academic-pd-male';
  state.avatarEnabled = true;
  state.avatarNotice = state.avatarProviderReady
    ? 'Founder preflight: Dexter target selected. Start is gated on synchronized provider audio + video.'
    : 'Avatar unavailable — continuing with voice. LiveAvatar server authorization is missing.';
  bridge.prepareLiveInterviewerTest();
  renderAvatarState();
  renderDiagnostics();
}

function renderFounderStudios() {
  if (bridge.role !== 'admin') return;
  let panel = document.getElementById('frontier-studios');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'frontier-studios';
    panel.className = 'panel';
    panel.style.marginTop = '18px';
    document.getElementById('regList')?.parentElement?.append(panel);
  }
  panel.replaceChildren();
  const body = document.createElement('div');
  body.className = 'pPad';
  const title = document.createElement('div');
  title.className = 'pLbl';
  title.textContent = 'Founder Conversation Rail + Model + Voice Studio · exact provider IDs';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:14px';
  const railSelect = document.createElement('select');
  for (const rail of state.railConfigs) {
    option(railSelect, rail.id, `${rail.label} · ${rail.status}${rail.model ? ` · ${rail.model}` : ''}`, rail.id === state.railId);
    railSelect.lastElementChild.disabled = rail.status === 'unavailable';
  }
  if (!state.railConfigs.length) option(railSelect, state.railId, `${state.railId} · configuration unavailable`, true);
  railSelect.onchange = () => {
    if (state.alphaSessionId || continuousRail?.health().connected) {
      bridge.toast('Conversation Rail is fixed during an active interview. End or abandon this session before switching.');
      setTimeout(renderFounderStudios, 0);
      return;
    }
    state.railId = railSelect.value;
    state.railStatus = state.railConfigs.find((rail) => rail.id === state.railId)?.status || 'unavailable';
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) {
      state.model = 'gpt-realtime-2.1';
      state.architecture = 'native-realtime-voice';
    } else if (state.railId === RAIL_IDS.RESPONSES_SPEECH) {
      state.model = state.models.some((model) => model.id === 'gpt-5.6-terra') ? 'gpt-5.6-terra' : state.model;
      state.architecture = architectureFor(state.model);
    }
    renderDiagnostics();
    setTimeout(renderFounderStudios, 0);
  };
  const modelSelect = document.createElement('select');
  const railModels = state.railId === RAIL_IDS.OPENAI_REALTIME
    ? state.models.filter((model) => model.id === 'gpt-realtime-2.1')
    : state.models.filter((model) => model.architecture === 'responses-openai-speech' && ['gpt-5.6-terra', 'gpt-5.6-sol'].includes(model.id));
  for (const model of railModels) option(modelSelect, model.id, `${model.id} · ${model.architecture}`, model.id === state.model);
  if (!state.models.length) option(modelSelect, state.model, `${state.model} · configuration unavailable`, true);
  modelSelect.onchange = () => {
    if (state.alphaSessionId || continuousRail?.health().connected) {
      bridge.toast('Interviewer model is fixed during an active interview. End or abandon this session before switching.');
      setTimeout(renderFounderStudios, 0);
      return;
    }
    state.model = modelSelect.value;
    state.architecture = architectureFor(state.model);
    renderDiagnostics();
    setTimeout(renderFounderStudios, 0);
  };
  const voiceSelect = document.createElement('select');
  for (const voice of state.voices) option(voiceSelect, voice.id, `${voice.displayName} · ${voice.providerVoiceId}`, voice.id === state.voicePresetId);
  if (!state.voices.length) option(voiceSelect, state.voicePresetId, `${state.voiceId} · exact OpenAI voice ID`, true);
  voiceSelect.onchange = () => {
    if (state.alphaSessionId || continuousRail?.health().connected) {
      bridge.toast('Voice is fixed during an active interview. End or abandon this session before switching.');
      setTimeout(renderFounderStudios, 0);
      return;
    }
    const voice = state.voices.find((candidate) => candidate.id === voiceSelect.value);
    if (!voice) return;
    state.voicePresetId = voice.id;
    state.voiceId = voice.providerVoiceId;
    state.voiceSpeed = voice.speed;
    renderDiagnostics();
    setTimeout(renderFounderStudios, 0);
  };
  const behaviorSelect = document.createElement('select');
  for (const behavior of state.behaviors) option(behaviorSelect, behavior.id, behavior.label, behavior.id === state.behaviorPresetId);
  if (!state.behaviors.length) option(behaviorSelect, state.behaviorPresetId, state.behaviorPresetId, true);
  behaviorSelect.onchange = () => {
    if (state.alphaSessionId || continuousRail?.health().connected) {
      bridge.toast('Interviewer behavior is fixed during an active interview. End or abandon this session before switching.');
      setTimeout(renderFounderStudios, 0);
      return;
    }
    state.behaviorPresetId = behaviorSelect.value;
    renderDiagnostics();
    setTimeout(renderFounderStudios, 0);
  };
  row.append(studioField('Conversation rail', railSelect), studioField('Interviewer model', modelSelect), studioField('Voice preset', voiceSelect), studioField('Behavior', behaviorSelect));
  const truth = document.createElement('div');
  truth.className = 'notice';
  truth.style.marginTop = '12px';
  truth.textContent = `Selected rail: ${state.railId} · model: ${state.model}. Audible interviewer: ${state.audibleVoiceTruth}. Audio authority: ${state.audioAuthority}. Locked visual: Dexter Doctor Sitting (bd43ce31-7425-4379-8407-60f029548e61). Locked voice metadata: W. Clint Oxley (a33a57ab-8388-49fc-a069-dbcfd1bc5405). Authenticated evidence confirms both records, but LITE exposes no W. Clint voice selector; supplied OpenAI cedar PCM remains the audible voice. Realtime remains direct audio until the unified V6 ticket supplies its accepted output-audio sink.`;
  const rosterTitle = document.createElement('div');
  rosterTitle.className = 'pLbl';
  rosterTitle.style.marginTop = '16px';
  rosterTitle.textContent = 'Founder Faculty Roster · provider truth';
  const roster = document.createElement('div');
  roster.style.cssText = 'display:grid;gap:7px;margin-top:10px;max-height:330px;overflow:auto';
  for (const record of state.facultyRoster) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `line ${record.id === state.selectedInterviewerId ? 'on' : ''}`;
    item.style.cssText = 'width:100%;text-align:left;display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(120px,1fr) auto;gap:8px;align-items:center';
    const status = record.available
      ? 'AVAILABLE · ALPHA'
      : record.avatarId && state.avatarTarget?.liveSessionBlock === 'insufficient-credits'
      ? 'PROVIDER CREDITS REQUIRED'
      : record.availability === 'custom-avatar-required'
      ? 'CUSTOM AVATAR REQUIRED'
      : record.availability === 'provider-auth-required'
      ? 'PROVIDER AUTH REQUIRED'
      : 'COMING LATER';
    item.innerHTML = `<b>${record.displayName}</b><span>${record.specialty.join(' · ')}</span><span class="chip ${record.available ? 'gn' : 'dim'}">${status}</span>`;
    item.onclick = () => { state.selectedInterviewerId = record.id; renderFounderStudios(); };
    roster.append(item);
  }
  const founderActions = document.createElement('div');
  founderActions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
  const surprise = document.createElement('button');
  surprise.className = 'btnGhost';
  surprise.textContent = 'Surprise Me';
  surprise.onclick = async () => {
    try {
      const result = await jsonRequest('/api/surprise-me', { method: 'POST', body: JSON.stringify({ specialty: 'Internal Medicine' }) });
      state.selectedInterviewerId = result.assignment.id;
      bridge.toast(`Assigned shortly before launch: ${result.assignment.displayName}. Future questions remain private.`);
      renderFounderStudios();
    } catch (error) {
      bridge.toast(`${publicError(error).message} Voice-only fallback remains available.`);
    }
  };
  const testLive = document.createElement('button');
  testLive.id = 'founder-test-live-interviewer';
  testLive.className = 'btnHero';
  testLive.textContent = 'TEST LIVE INTERVIEWER';
  testLive.onclick = () => openFounderHarness();
  const ledger = document.createElement('button');
  ledger.className = 'btnGhost';
  ledger.textContent = 'Refresh usage ledger';
  ledger.onclick = async () => {
    try {
      const result = await jsonRequest('/api/alpha-sessions', { headers: { 'X-IVPrep-Founder': 'local-founder' } });
      state.usageLedger = result.usage || [];
      const minutes = state.usageLedger.reduce((sum, entry) => sum + Number(entry.estimatedMinutes || 0), 0);
      bridge.toast(`${state.usageLedger.length} completed local alpha session(s) · ${minutes.toFixed(1)} estimated minute(s).`);
    } catch (error) { bridge.toast(publicError(error).message); }
  };
  const disable = document.createElement('button');
  disable.className = 'btnGhost';
  disable.textContent = state.alphaDisabled ? 'Re-enable alpha starts' : 'Emergency disable new starts';
  disable.onclick = async () => {
    const result = await jsonRequest('/api/alpha-control/emergency-disable', {
      method: 'POST', headers: { 'X-IVPrep-Founder': 'local-founder' }, body: JSON.stringify({ disabled: !state.alphaDisabled }),
    });
    state.alphaDisabled = result.disabled;
    bridge.toast(state.alphaDisabled ? 'Emergency disable is active. New sessions are blocked.' : 'Local alpha starts re-enabled.');
    renderFounderStudios();
  };
  founderActions.append(testLive, surprise, ledger, disable);
  body.append(title, row, truth, rosterTitle, roster, founderActions);
  panel.append(body);
}

function renderRailFallbackOffer() {
  const button = document.getElementById('continuous-rail-fallback');
  if (!button) return;
  button.hidden = !(state.railId === RAIL_IDS.OPENAI_REALTIME && state.railStatus === 'failed');
  renderFocusRoom();
}

function ensureFocusRoomStyle() {
  if (document.getElementById('frontier-focus-room-style')) return;
  const style = document.createElement('style');
  style.id = 'frontier-focus-room-style';
  style.textContent = `
    body.frontier-focus-room #side,
    body.frontier-focus-room #topbar,
    body.frontier-focus-room section[data-view="room"] > .platbar,
    body.frontier-focus-room section[data-view="room"] > .roundtop,
    body.frontier-focus-room #mtop,
    body.frontier-focus-room #mbot,
    body.frontier-focus-room #coachlane,
    body.frontier-focus-room #laneticker,
    body.frontier-focus-room #safstrip,
    body.frontier-focus-room #teledrawer,
    body.frontier-focus-room #roomctl { display:none !important; }
    body.frontier-focus-room main { left:0; top:0; }
    body.frontier-focus-room section[data-view="room"] { max-width:980px; padding:18px 20px 96px; }
    body.frontier-focus-room #meetwrap { max-width:920px; margin:0 auto; border-radius:18px; }
    body.frontier-focus-room #roomstage { height:min(72vh,680px); min-height:420px; }
    body.frontier-focus-room #frontier-room-controls { max-width:920px; margin:12px auto 0; border:0; background:transparent; }
    body.frontier-focus-room #frontier-room-controls:before { display:none; }
    body.frontier-focus-room #frontier-room-controls .pPad { padding:4px 0; }
    body.frontier-focus-room #frontier-room-buttons { justify-content:center; }
    body.frontier-focus-room #frontier-avatar-toggle,
    body.frontier-focus-room #frontier-typed-fallback { display:none !important; }
    body.frontier-focus-room #frontier-typed-fallback.typed-open { display:flex !important; margin-top:10px; }
    body.frontier-focus-room #frontier-start[hidden],
    body.frontier-focus-room #frontier-interrupt[hidden],
    body.frontier-focus-room #frontier-type-instead[hidden] { display:none !important; }
    body.frontier-focus-room #continuous-rail-fallback { display:none !important; }
    body.frontier-focus-room #continuous-rail-fallback:not([hidden]) { display:inline-flex !important; }
    body.frontier-focus-room #frontier-room-status { display:block; text-align:center; font-size:14px; color:var(--mid); margin:2px 0 12px; }
    body.frontier-focus-room #avatar-live-state,
    body.frontier-focus-room #frontier-disclosure { display:block; max-width:920px; margin:8px auto 0; }
    @media (max-width:700px) {
      body.frontier-focus-room section[data-view="room"] { padding:10px 10px 86px; }
      body.frontier-focus-room #roomstage { height:62vh; min-height:360px; }
    }
  `;
  document.head.append(style);
}

function renderFocusRoom() {
  ensureFocusRoomStyle();
  const focused = bridge.role === 'student' && bridge.view === 'room' && (state.founderHarness || state.railId === RAIL_IDS.OPENAI_REALTIME);
  document.body.classList.toggle('frontier-focus-room', focused);
  const recordingBadge = document.getElementById('recb');
  if (focused && !state.interviewStarted && recordingBadge) {
    recordingBadge.classList.remove('hot');
    recordingBadge.innerHTML = '<i></i>STANDBY';
  }
  const status = document.getElementById('frontier-room-status');
  if (status) {
    status.hidden = !focused;
    status.textContent = !state.interviewStarted
      ? (!state.founderHarness ? 'Ready when you are.' : `${state.avatarNotice} Audible interviewer: ${state.audibleVoiceTruth}.`)
      : state.railStatus === 'failed'
      ? 'The interviewer connection needs attention.'
      : state.interviewerSpeaking || ['responding', 'speaking'].includes(state.railStatus)
      ? 'Interviewer speaking — you can interrupt naturally.'
      : state.railStatus === 'floor-yield-detected'
      ? 'Thinking…'
      : 'Listening — pause naturally. The interviewer will respond when you finish.';
  }
  const interrupt = document.getElementById('frontier-interrupt');
  if (interrupt) {
    interrupt.hidden = false;
    interrupt.disabled = !state.interviewerSpeaking;
    interrupt.setAttribute('aria-disabled', String(!state.interviewerSpeaking));
  }
  const start = document.getElementById('frontier-start');
  if (start) start.hidden = !focused || state.interviewStarted;
  const typeButton = document.getElementById('frontier-type-instead');
  if (typeButton) typeButton.hidden = !focused || !state.interviewStarted;
  const reconnect = document.getElementById('founder-test-reconnect');
  if (reconnect) reconnect.hidden = !state.founderHarness || state.alphaMode !== 'avatar' || !avatar.sessionId;
  const typed = document.getElementById('frontier-typed-fallback');
  if (typed) typed.classList.toggle('typed-open', !focused || state.typedFallbackOpen);
}

function founderAvatarEvidence() {
  return {
    evidenceVersion: 1,
    capturedAt: new Date().toISOString(),
    target: {
      provider: state.avatarTarget?.provider || 'liveavatar',
      avatarId: state.avatarTarget?.avatarId || null,
      avatarDisplayName: state.avatarTarget?.avatarDisplayName || null,
      voiceId: state.avatarTarget?.voiceId || null,
      voiceDisplayName: state.avatarTarget?.voiceDisplayName || null,
      authenticatedAvatarVerified: Boolean(state.avatarTarget?.authenticatedAvatarVerified),
      authenticatedVoiceVerified: Boolean(state.avatarTarget?.authenticatedVoiceVerified),
      lockedVoiceCompatible: Boolean(state.avatarTarget?.lockedVoiceCompatible),
    },
    delivery: {
      railId: state.railId,
      model: state.model,
      audibleVoiceTruth: state.audibleVoiceTruth,
      audioAuthority: state.audioAuthority,
      avatarMode: state.alphaMode,
    },
    media: avatar.health(),
    usage: avatar.usage(),
    audioAuthorityEvidence: interviewerAudio.evidence(),
    interruption: { controlAcknowledgementMs: state.avatarInterruptAckMs },
    reconnects: state.avatarReconnectEvidence,
    cleanup: state.lastAvatarCleanup,
    limitations: {
      renderedFrameIsMeasured: true,
      audioTrackPlaybackIsMeasured: true,
      visualLipSyncRequiresHumanObservation: true,
      visibleMouthStopRequiresHumanObservation: true,
    },
  };
}

function ensureRoomControls() {
  if (document.getElementById('frontier-room-controls')) return;
  const roomControls = document.getElementById('roomctl');
  if (!roomControls) return;
  const panel = document.createElement('div');
  panel.id = 'frontier-room-controls';
  panel.className = 'panel';
  panel.style.cssText = 'margin:12px auto 0;max-width:860px';
  const body = document.createElement('div');
  body.className = 'pPad';
  body.style.cssText = 'display:grid;gap:10px';
  const buttons = document.createElement('div');
  buttons.id = 'frontier-room-buttons';
  buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const start = document.createElement('button');
  start.id = 'frontier-start';
  start.className = 'btnHero';
  start.textContent = 'Start Interview';
  start.onclick = async () => {
    if (state.interviewStarted || bridge.view !== 'room') return;
    if (!bridge.build?.length) return bridge.startInterview();
    start.disabled = true;
    start.textContent = 'Connecting interviewer…';
    try {
      await ensureAlphaSession();
      state.interviewStarted = true;
      state.typedFallbackOpen = false;
      renderFocusRoom();
      bridge.startInterview();
    } catch (error) {
      state.avatarNotice = `Avatar unavailable — continuing with voice. ${publicError(error).message}`;
      state.alphaMode = 'voice-only';
      state.audioAuthority = state.railId === RAIL_IDS.OPENAI_REALTIME ? 'openai-realtime-direct' : 'browser-openai-speech';
      renderAvatarState();
      bridge.toast(state.avatarNotice);
    } finally {
      start.disabled = false;
      start.textContent = 'Start Interview';
    }
  };
  const mute = document.createElement('button');
  mute.id = 'frontier-mute';
  mute.className = 'btnGhost';
  mute.textContent = 'Mute microphone';
  mute.onclick = () => {
    state.muted = !state.muted;
    bridge.setMuted(state.muted);
    micController.setMuted(state.muted);
    mute.textContent = state.muted ? 'Unmute microphone' : 'Mute microphone';
  };
  const interrupt = document.createElement('button');
  interrupt.id = 'frontier-interrupt';
  interrupt.className = 'btnGhost';
  interrupt.textContent = 'Interrupt interviewer';
  interrupt.onclick = () => {
    if (!state.interviewerSpeaking) return bridge.toast('The interviewer is not speaking.');
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) continuousRail?.interrupt({ automatic: false });
    else interruptAudio('interrupted');
    if (!bridge.recording) bridge.beginRec();
  };
  const reconnect = document.createElement('button');
  reconnect.id = 'founder-test-reconnect';
  reconnect.className = 'btnGhost';
  reconnect.textContent = 'TEST RECONNECT';
  reconnect.hidden = true;
  reconnect.onclick = async () => {
    reconnect.disabled = true;
    reconnect.textContent = 'Reconnecting…';
    const startedAt = performance.now();
    try {
      const result = await avatar.reconnect();
      const record = { at: new Date().toISOString(), success: Boolean(result.reconnected), mediaReady: avatar.health().available, elapsedMs: Math.round(performance.now() - startedAt) };
      state.avatarReconnectEvidence.push(record);
      bridge.toast(record.mediaReady ? 'LiveAvatar control reconnected; synchronized media remains ready.' : 'LiveAvatar control reconnected, but media readiness was not restored.');
    } catch (error) {
      state.avatarReconnectEvidence.push({ at: new Date().toISOString(), success: false, mediaReady: false, elapsedMs: Math.round(performance.now() - startedAt) });
      state.avatarNotice = `Avatar reconnect failed — continuing with voice. ${publicError(error).message}`;
      state.alphaMode = 'voice-only';
      state.audioAuthority = 'browser-openai-speech';
      renderAvatarState();
      bridge.toast(state.avatarNotice);
    } finally {
      reconnect.disabled = false;
      reconnect.textContent = 'TEST RECONNECT';
      renderDiagnostics();
    }
  };
  const evidence = document.createElement('button');
  evidence.id = 'founder-export-avatar-evidence';
  evidence.className = 'btnGhost';
  evidence.textContent = 'Export avatar evidence';
  evidence.onclick = () => downloadEvidence(
    `Y1-Y2-CAM-V6-3430-avatar-evidence-${Date.now()}.json`,
    JSON.stringify(founderAvatarEvidence(), null, 2),
    'application/json;charset=utf-8',
  );
  const railFallback = document.createElement('button');
  railFallback.id = 'continuous-rail-fallback';
  railFallback.className = 'btnHero';
  railFallback.textContent = 'Continue using High-Intelligence Voice';
  railFallback.hidden = true;
  railFallback.onclick = async () => {
    await closeContinuousRail();
    state.railId = RAIL_IDS.RESPONSES_SPEECH;
    state.railStatus = 'available';
    state.model = 'gpt-5.6-terra';
    state.architecture = 'responses-openai-speech';
    state.lastError = null;
    state.providerHealth = 'configured';
    bridge.toast('High-Intelligence Voice is active. Existing transcript and interview context were preserved.');
    renderRailFallbackOffer();
    renderDiagnostics();
  };
  const end = document.createElement('button');
  end.id = 'frontier-end';
  end.className = 'btnGhost';
  end.textContent = 'End interview';
  end.onclick = async () => {
    const exportFounderCleanupEvidence = state.founderHarness;
    end.disabled = true;
    end.textContent = 'Ending…';
    state.interviewStarted = false;
    state.typedFallbackOpen = false;
    cancelTurn('ended');
    if (bridge.recording) bridge.abandonTake();
    const outcome = await endAlphaSession('ended').catch((error) => ({ persisted: false, errors: 1, avatarCleanup: { requested: true, acknowledged: false, state: 'unconfirmed' }, error }));
    bridge.stopMedia();
    if (outcome.avatarCleanup?.acknowledged) {
      if (exportFounderCleanupEvidence) {
        downloadEvidence(
          `Y1-Y2-CAM-V6-3430-avatar-evidence-final-${Date.now()}.json`,
          JSON.stringify(founderAvatarEvidence(), null, 2),
          'application/json;charset=utf-8',
        );
      }
      state.founderHarness = false;
      bridge.toast('Session ended — provider cleanup acknowledged; camera and microphone released.');
      if (bridge.run.takes.length) bridge.finishRound();
      else bridge.nav('home');
    } else {
      state.founderHarness = true;
      state.avatarNotice = 'Camera and microphone released. Remote avatar cleanup is unconfirmed — click End interview to retry.';
      renderAvatarState();
      bridge.toast(state.avatarNotice);
    }
    end.disabled = false;
    end.textContent = 'End interview';
  };
  const avatarToggle = document.createElement('button');
  avatarToggle.id = 'frontier-avatar-toggle';
  avatarToggle.className = 'btnGhost';
  avatarToggle.textContent = state.avatarEnabled ? 'Avatar on' : 'Avatar off';
  avatarToggle.onclick = async () => {
    state.avatarEnabled = !state.avatarEnabled;
    avatarToggle.textContent = state.avatarEnabled ? 'Avatar on' : 'Avatar off';
    if (!state.avatarEnabled) {
      interruptAudio('avatar-off');
      avatarToggle.disabled = true;
      await avatar.stop('founder-avatar-off').catch(() => {});
      avatarToggle.disabled = false;
      state.alphaMode = 'voice-only';
      state.avatarNotice = 'Avatar is off. The interviewer intelligence and voice are unchanged.';
    } else if (!state.avatarProviderReady) {
      state.avatarNotice = 'Live avatar unavailable: provider authorization is missing. Voice-only remains active.';
    } else {
      state.avatarNotice = 'Avatar will connect for the next interview session.';
    }
    renderAvatarState();
  };
  const enableAvatarAudio = document.createElement('button');
  enableAvatarAudio.id = 'enable-avatar-audio';
  enableAvatarAudio.className = 'btnGhost';
  enableAvatarAudio.textContent = 'Enable avatar audio';
  enableAvatarAudio.hidden = true;
  enableAvatarAudio.onclick = async () => {
    enableAvatarAudio.disabled = true;
    try {
      const result = await avatar.resumeAudio();
      if (!result.available) bridge.toast('Avatar audio is still blocked. Voice-only remains available.');
    } catch (error) {
      state.avatarNotice = `Avatar audio unavailable: ${publicError(error).message} Voice-only remains available.`;
    } finally {
      enableAvatarAudio.disabled = false;
      renderAvatarState();
    }
  };
  const typeInstead = document.createElement('button');
  typeInstead.id = 'frontier-type-instead';
  typeInstead.className = 'btnGhost';
  typeInstead.textContent = 'Type instead';
  typeInstead.onclick = () => {
    const form = document.getElementById('frontier-typed-fallback');
    state.typedFallbackOpen = !state.typedFallbackOpen;
    renderFocusRoom();
    if (state.typedFallbackOpen) form?.querySelector('textarea')?.focus();
  };
  buttons.append(start, mute, interrupt, reconnect, evidence, typeInstead, railFallback, avatarToggle, enableAvatarAudio, end);
  const typed = document.createElement('form');
  typed.id = 'frontier-typed-fallback';
  typed.className = 'typed-open';
  typed.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const input = document.createElement('textarea');
  input.rows = 2;
  input.placeholder = 'Typed-answer fallback when microphone or transcription is unavailable';
  input.setAttribute('aria-label', 'Typed answer fallback');
  input.style.cssText = 'flex:1;min-width:240px;padding:10px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:8px';
  const submit = document.createElement('button');
  submit.className = 'btnHero';
  submit.type = 'submit';
  submit.textContent = 'Submit typed answer';
  typed.onsubmit = (event) => {
    event.preventDefault();
    if (state.interviewerSpeaking) return bridge.toast('Interrupt the interviewer before submitting an answer.');
    if (!bridge.recording) {
      if (bridge.view !== 'room' || state.activeExchangeController) return bridge.toast('Wait until the interviewer finishes and the answer window reopens.');
      bridge.beginRec();
    }
    const answer = String(input.value || '').trim();
    if (!answer) return bridge.toast('Type an answer first.');
    if (state.railId === RAIL_IDS.OPENAI_REALTIME) {
      try {
        continuousRail?.submitText(answer);
        input.value = '';
        state.typedFallbackOpen = false;
        renderFocusRoom();
        bridge.toast('Typed answer sent to Continuous Conversation.');
      } catch (error) { bridge.toast(publicError(error).message); }
      return;
    }
    bridge.setTypedTranscript(answer);
    bridge.endTake();
    input.value = '';
  };
  typed.append(input, submit);
  const disclosure = document.createElement('div');
  disclosure.id = 'frontier-disclosure';
  disclosure.className = 'notice';
  disclosure.textContent = 'AI interviewer using a provider stock avatar; not a real physician. Exactly one audible interviewer stream is active, while transcript authority remains independent from playback. Continuous Conversation streams microphone audio to OpenAI Realtime; High-Intelligence Voice sends completed interview text. Local replay remains in this tab.';
  const avatarState = document.createElement('div');
  avatarState.id = 'avatar-live-state';
  avatarState.className = 'notice';
  avatarState.setAttribute('role', 'status');
  avatarState.setAttribute('aria-live', 'polite');
  avatarState.textContent = state.avatarNotice;
  const focusStatus = document.createElement('div');
  focusStatus.id = 'frontier-room-status';
  focusStatus.setAttribute('role', 'status');
  focusStatus.setAttribute('aria-live', 'polite');
  focusStatus.hidden = true;
  body.append(focusStatus, buttons, avatarState, typed, disclosure);
  panel.append(body);
  roomControls.after(panel);
  renderFocusRoom();
}

function renderAvatarState() {
  const notice = document.getElementById('avatar-live-state');
  if (notice) notice.textContent = state.avatarNotice;
  const canvas = document.getElementById('ivcv');
  const monogram = document.getElementById('avcircle');
  const live = avatar.health().available && Boolean(document.getElementById('live-avatar-video'));
  const liveVideo = document.getElementById('live-avatar-video');
  const enableAvatarAudio = document.getElementById('enable-avatar-audio');
  if (enableAvatarAudio) enableAvatarAudio.hidden = avatar.health().state !== 'audio-blocked';
  if (liveVideo) liveVideo.style.visibility = live ? 'visible' : 'hidden';
  if (canvas) canvas.style.visibility = live ? 'hidden' : '';
  if (monogram) monogram.style.visibility = live ? 'hidden' : '';
  if (state.founderHarness) {
    const participantName = state.avatarTarget?.participantDisplayName || 'Dexter · MissionMed AI Faculty';
    const tileName = document.getElementById('ivtilename');
    const panelName = document.getElementById('ivpanelname');
    if (tileName) { tileName.textContent = participantName; tileName.style.display = 'block'; }
    if (panelName) panelName.textContent = participantName;
  }
}

function ensureDiagnostics() {
  let diagnostic = document.getElementById('founder-live-diagnostics');
  if (!diagnostic) {
    diagnostic = document.createElement('div');
    diagnostic.id = 'founder-live-diagnostics';
    diagnostic.className = 'notice';
    diagnostic.style.cssText = 'margin:10px auto 0;max-width:860px';
    document.getElementById('frontier-room-controls')?.after(diagnostic);
  }
  diagnostic.hidden = bridge.role !== 'admin' && !state.founderHarness;
  return diagnostic;
}

function renderDiagnostics() {
  const diagnostic = ensureDiagnostics();
  if (!diagnostic || diagnostic.hidden) return;
  diagnostic.textContent = `RAIL ${state.railId} · RAIL STATE ${state.railStatus} · MODEL ${state.model}${state.providerModel && state.providerModel !== state.model ? ` · PROVIDER MODEL ${state.providerModel}` : ''} · AUDIBLE ${state.audibleVoiceTruth} · AUDIO AUTHORITY ${state.audioAuthority} · AVATAR ${avatar.health().state} · VIDEO TRACK ${avatar.health().firstVideoTrackMs ?? '—'} ms · FIRST RENDERED FRAME ${avatar.health().firstFrameMs ?? '—'} ms · AUDIO TRACK ${avatar.health().firstAudioTrackMs ?? '—'} ms · AUDIO ELEMENT PLAYING ${avatar.health().firstAudioPlaybackMs ?? '—'} ms · CONNECT ${state.railConnectionMs ?? '—'} ms · RAIL FIRST AUDIO ${state.railFirstAudioMs ?? state.latencyMs ?? '—'} ms · ANSWER END→RESPONSE ${state.railAnswerEndToResponseMs ?? '—'} ms · FLOOR→RESPONSE ${state.railFloorToResponseMs ?? '—'} ms · RAIL INTERRUPT ${state.railInterruptionMs ?? '—'} ms · AVATAR CONTROL ACK ${state.avatarInterruptAckMs ?? '—'} ms · ROUND TRIP ${state.roundTripMs ?? '—'} ms · STREAM ${state.streaming} · PROVIDER ${state.providerHealth}`;
}

function downloadEvidence(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureResultsEvidence() {
  const results = document.querySelector('section[data-view="results"]');
  if (!results) return;
  if (bridge.view === 'results' && state.alphaSessionId) endAlphaSession('completed');
  let panel = document.getElementById('frontier-results-evidence');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'frontier-results-evidence';
    panel.className = 'panel';
    panel.style.margin = '14px 0';
    results.firstElementChild?.after(panel);
  }
  const rep = bridge.result;
  const turns = Array.isArray(rep?.frontierTurns) ? rep.frontierTurns : [];
  const renderKey = JSON.stringify(turns.map((turn) => [turn.question, turn.answer, turn.generatedUtterance, turn.model, turn.voice, turn.observer?.action]));
  if (panel.dataset.renderKey === renderKey) return;
  panel.dataset.renderKey = renderKey;
  panel.replaceChildren();
  const body = document.createElement('div');
  body.className = 'pPad';
  const title = document.createElement('div');
  title.className = 'pLbl';
  title.textContent = 'Transcript + instructor evidence';
  body.append(title);
  if (!turns.length) {
    const empty = document.createElement('div');
    empty.className = 'notice';
    empty.style.marginTop = '10px';
    empty.textContent = 'No frontier transcript or instructor evidence exists for this result.';
    body.append(empty);
  } else {
    for (const [index, turn] of turns.entries()) {
      const row = document.createElement('div');
      row.className = 'line';
      row.style.cssText = 'display:grid;gap:6px;align-items:start';
      const question = document.createElement('b');
      question.textContent = `Turn ${index + 1} · Interviewer: ${turn.question || '—'}`;
      const answer = document.createElement('div');
      answer.className = 'serif';
      answer.textContent = `Applicant: ${turn.answer || '[No transcript captured]'}`;
      const generated = document.createElement('div');
      generated.textContent = `Completed interviewer utterance: ${turn.generatedUtterance || '[No completed frontier utterance recorded]'}`;
      const observer = document.createElement('div');
      observer.style.cssText = 'font-size:11px;color:var(--mid)';
      observer.textContent = turn.observer
        ? `Instructor observer: ${turn.observer.action} · ${turn.observer.activeTopic} · ${turn.observer.instructorRationale}`
        : 'Instructor observer: no completed record for this turn.';
      const exact = document.createElement('div');
      exact.className = 'eyebrow';
      exact.style.fontSize = '8.5px';
      exact.textContent = `MODEL ${turn.model || '—'} · VOICE ${turn.voice || '—'} · PROVIDER ${turn.provider || '—'}`;
      row.append(question, answer, generated, observer, exact);
      body.append(row);
    }
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
    const transcriptButton = document.createElement('button');
    transcriptButton.className = 'btnGhost';
    transcriptButton.textContent = 'Export transcript';
    transcriptButton.onclick = () => downloadEvidence(
      `${rep.id || 'ivprep'}-transcript.txt`,
      turns.map((turn, index) => `TURN ${index + 1}\nINTERVIEWER QUESTION ANSWERED: ${turn.question || ''}\nAPPLICANT: ${turn.answer || ''}\nCOMPLETED NEXT INTERVIEWER UTTERANCE: ${turn.generatedUtterance || ''}`).join('\n\n'),
      'text/plain;charset=utf-8',
    );
    const recordButton = document.createElement('button');
    recordButton.className = 'btnGhost';
    recordButton.textContent = 'Export instructor record';
    recordButton.onclick = () => downloadEvidence(
      `${rep.id || 'ivprep'}-instructor-record.json`,
      JSON.stringify({ sessionId: rep.id || null, interviewer: rep.iv || null, turns }, null, 2),
      'application/json;charset=utf-8',
    );
    actions.append(transcriptButton, recordButton);
    body.append(actions);
  }
  panel.append(body);
}

async function loadConfiguration() {
  try {
    const [health, models, voices, roster, avatarConfig, railConfig] = await Promise.all([
      jsonRequest('/api/health'),
      jsonRequest('/api/model-studio-config'),
      jsonRequest('/api/voice-studio-config'),
      jsonRequest('/api/faculty-roster'),
      jsonRequest('/api/avatar-provider-config'),
      jsonRequest('/api/conversation-rail-config'),
    ]);
    state.openaiConfigured = Boolean(health.openaiConfigured);
    state.providerHealth = health.openaiConfigured ? 'configured' : 'not configured';
    state.models = Array.isArray(models.models) ? models.models : [];
    state.behaviors = Array.isArray(models.behaviorPresets) ? models.behaviorPresets : [];
    state.voices = Array.isArray(voices.presets) ? voices.presets : [];
    state.facultyRoster = Array.isArray(roster.records) ? roster.records : [];
    state.railConfigs = Array.isArray(railConfig.rails) ? railConfig.rails : [];
    state.railId = railConfig.defaultRailId || RAIL_IDS.RESPONSES_SPEECH;
    state.railStatus = state.railConfigs.find((rail) => rail.id === state.railId)?.status || 'unavailable';
    state.avatarTarget = avatarConfig.target || null;
    state.avatarProviderReady = Boolean(
      (avatarConfig.health?.configured === true || avatarConfig.health?.available === true)
      && avatarConfig.target?.hasApprovedLiveKitOrigin
    );
    state.alphaDisabled = Boolean(health.alpha?.disabled);
    state.avatarNotice = state.avatarProviderReady
      ? 'Dexter LiveAvatar transport is authenticated. W. Clint metadata is verified, but LITE cannot select that voice; synchronized supplied OpenAI cedar PCM is the configured audible path.'
      : avatarConfig.target?.liveSessionBlock === 'insufficient-credits'
      ? 'Authenticated Dexter session cannot start: LiveAvatar reports insufficient credits. Voice-only OpenAI cedar remains available.'
      : 'Avatar unavailable — continuing with voice. LiveAvatar authorization or the exact approved LiveKit origin is missing.';
    if (models.defaultModelId) state.model = models.defaultModelId;
    if (models.defaultBehaviorPresetId) state.behaviorPresetId = models.defaultBehaviorPresetId;
    if (models.observerModelId) state.observerModel = models.observerModelId;
    if (voices.defaultPresetId) state.voicePresetId = voices.defaultPresetId;
    if (voices.defaultVoiceId) state.voiceId = voices.defaultVoiceId;
    const selectedVoice = state.voices.find((voice) => voice.id === state.voicePresetId);
    if (selectedVoice) state.voiceSpeed = selectedVoice.speed;
    state.architecture = architectureFor(state.model);
  } catch (error) {
    state.providerHealth = 'unavailable';
    state.lastError = publicError(error).message;
  }
  renderFounderStudios();
  renderAvatarState();
  renderDiagnostics();
}

ensureRoomControls();
setInterval(() => {
  ensureRoomControls();
  ensureDiagnostics();
  ensureResultsEvidence();
  renderDiagnostics();
  renderFocusRoom();
}, 500);
addEventListener('beforeunload', () => {
  cancelTurn('closed');
  bridge.stopMedia();
  micController.stop();
  endAlphaSession('abandoned', { keepalive: true });
});

window.V6Frontier = {
  state,
  avatar,
  micController,
  speak,
  interrupt: interruptAudio,
  cancelTurn,
  onTakeComplete,
  openFounderHarness,
  renderFounderStudios,
  health: () => ({ openai: state.providerHealth, avatar: avatar.health(), rail: continuousRail?.health() || { railId: state.railId, status: state.railStatus } }),
};

loadConfiguration();
