import { MicController } from './mic-controller.mjs';
import { UnavailableAvatarProvider } from './avatar-provider.mjs';

const bridge = window.V6Bridge;
if (!bridge) throw new Error('V6 integration bridge is unavailable.');

const state = {
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
  currentAudio: null,
  currentAudioUrl: null,
  currentPlaybackSettle: null,
  activeSpeechController: null,
  activeExchangeController: null,
  pendingAudio: null,
  lastError: null,
};

const avatar = new UnavailableAvatarProvider('Avatar provider implementation is reserved for Y1-Y2-CAM-V6-3402.');

function publicError(error, fallback = 'The interviewer provider is unavailable.') {
  const message = String(error?.message || fallback).trim();
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

function base64Audio(base64, contentType) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  if (String(contentType).startsWith('audio/pcm')) {
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
  return new Blob([bytes], { type: contentType || 'audio/wav' });
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
  state.streaming = reason;
  micController.setInterviewerSpeaking(false);
  renderDiagnostics();
  if (settle) settle();
}

async function playBlob(blob, telemetry = {}) {
  interruptAudio('loading');
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  state.currentAudioUrl = url;
  state.currentAudio = audio;
  state.streaming = 'streaming';
  state.latencyMs = telemetry.latencyMs ?? state.latencyMs;
  bridge.setIvState('speaking');
  micController.setInterviewerSpeaking(true);
  renderDiagnostics();
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
        state.streaming = reason;
        micController.setInterviewerSpeaking(false);
        renderDiagnostics();
      }
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

async function speak(text) {
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
    if (state.architecture === 'native-realtime-voice') {
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
  interruptAudio(reason);
}

const micController = new MicController({
  level: () => bridge.audio?.level || 0,
  silenceMs: 5000,
  onTurnComplete: () => {
    if (!bridge.recording || state.paused) return;
    bridge.toast('Five seconds of genuine silence: answer complete.');
    bridge.endTake();
  },
  onBargeIn: () => {
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
  title.textContent = 'Founder Model + Voice Studio · exact provider IDs';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:14px';
  const modelSelect = document.createElement('select');
  for (const model of state.models) option(modelSelect, model.id, `${model.id} · ${model.architecture}`, model.id === state.model);
  if (!state.models.length) option(modelSelect, state.model, `${state.model} · configuration unavailable`, true);
  modelSelect.onchange = () => {
    state.model = modelSelect.value;
    state.architecture = architectureFor(state.model);
    renderDiagnostics();
    setTimeout(renderFounderStudios, 0);
  };
  const voiceSelect = document.createElement('select');
  for (const voice of state.voices) option(voiceSelect, voice.id, `${voice.displayName} · ${voice.providerVoiceId}`, voice.id === state.voicePresetId);
  if (!state.voices.length) option(voiceSelect, state.voicePresetId, `${state.voiceId} · exact OpenAI voice ID`, true);
  voiceSelect.onchange = () => {
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
  behaviorSelect.onchange = () => { state.behaviorPresetId = behaviorSelect.value; renderDiagnostics(); setTimeout(renderFounderStudios, 0); };
  row.append(studioField('Interviewer model', modelSelect), studioField('Voice preset', voiceSelect), studioField('Behavior', behaviorSelect));
  const truth = document.createElement('div');
  truth.className = 'notice';
  truth.style.marginTop = '12px';
  truth.textContent = `Current ${state.model} · OpenAI voice ID ${state.voiceId}. “W. Clint Oxley” remains a founder-preferred display name with no verified provider-ID binding; it is not presented as this voice.`;
  body.append(title, row, truth);
  panel.append(body);
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
  buttons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const mute = document.createElement('button');
  mute.className = 'btnGhost';
  mute.textContent = 'Mute microphone';
  mute.onclick = () => {
    state.muted = !state.muted;
    bridge.setMuted(state.muted);
    micController.setMuted(state.muted);
    mute.textContent = state.muted ? 'Unmute microphone' : 'Mute microphone';
  };
  const interrupt = document.createElement('button');
  interrupt.className = 'btnGhost';
  interrupt.textContent = 'Interrupt interviewer';
  interrupt.onclick = () => {
    if (!state.currentAudio) return bridge.toast('The interviewer is not speaking.');
    interruptAudio('interrupted');
    if (!bridge.recording) bridge.beginRec();
  };
  const end = document.createElement('button');
  end.className = 'btnGhost';
  end.textContent = 'End interview';
  end.onclick = () => {
    cancelTurn('ended');
    if (bridge.recording) bridge.abandonTake();
    if (bridge.run.takes.length) bridge.finishRound();
    else { bridge.stopMedia(); bridge.nav('home'); }
  };
  buttons.append(mute, interrupt, end);
  const typed = document.createElement('form');
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
    if (state.currentAudio) return bridge.toast('Interrupt the interviewer before submitting an answer.');
    if (!bridge.recording) {
      if (bridge.view !== 'room' || state.activeExchangeController) return bridge.toast('Wait until the interviewer finishes and the answer window reopens.');
      bridge.beginRec();
    }
    const answer = bridge.setTypedTranscript(input.value);
    if (!answer) return bridge.toast('Type an answer first.');
    bridge.endTake();
    input.value = '';
  };
  typed.append(input, submit);
  const disclosure = document.createElement('div');
  disclosure.className = 'notice';
  disclosure.textContent = 'The interviewer voice is AI-generated. Interview text is sent to the configured OpenAI service. Browser speech recognition follows the browser implementation; the raw recording stays local to this tab.';
  body.append(buttons, typed, disclosure);
  panel.append(body);
  roomControls.after(panel);
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
  diagnostic.hidden = bridge.role !== 'admin';
  return diagnostic;
}

function renderDiagnostics() {
  const diagnostic = ensureDiagnostics();
  if (!diagnostic || diagnostic.hidden) return;
  diagnostic.textContent = `MODEL ${state.model}${state.providerModel && state.providerModel !== state.model ? ` · PROVIDER MODEL ${state.providerModel}` : ''} · VOICE ${state.voiceId} · AVATAR ${avatar.health().state} · LATENCY ${state.latencyMs ?? '—'} ms · ROUND TRIP ${state.roundTripMs ?? '—'} ms · STREAM ${state.streaming} · PROVIDER ${state.providerHealth}`;
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
    const [health, models, voices] = await Promise.all([
      jsonRequest('/api/health'),
      jsonRequest('/api/model-studio-config'),
      jsonRequest('/api/voice-studio-config'),
    ]);
    state.openaiConfigured = Boolean(health.openaiConfigured);
    state.providerHealth = health.openaiConfigured ? 'configured' : 'not configured';
    state.models = Array.isArray(models.models) ? models.models : [];
    state.behaviors = Array.isArray(models.behaviorPresets) ? models.behaviorPresets : [];
    state.voices = Array.isArray(voices.presets) ? voices.presets : [];
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
  renderDiagnostics();
}

ensureRoomControls();
setInterval(() => {
  ensureRoomControls();
  ensureDiagnostics();
  ensureResultsEvidence();
  renderDiagnostics();
}, 500);
addEventListener('beforeunload', () => {
  cancelTurn('closed');
  bridge.stopMedia();
  micController.stop();
  avatar.close();
});

window.V6Frontier = {
  state,
  avatar,
  micController,
  speak,
  interrupt: interruptAudio,
  cancelTurn,
  onTakeComplete,
  renderFounderStudios,
  health: () => ({ openai: state.providerHealth, avatar: avatar.health() }),
};

loadConfiguration();
