export const RAIL_IDS = Object.freeze({
  RESPONSES_SPEECH: 'responses-speech',
  OPENAI_REALTIME: 'openai-realtime-continuous',
  GPT_LIVE: 'gpt-live',
});

function socketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/conversation-rail`;
}

function pcm16FromFloat32(input, inputRate, outputRate = 24000) {
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Int16Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) sum += input[cursor];
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output;
}

function bytesFromBase64(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

export class ResponsesSpeechRail {
  constructor() { this.id = RAIL_IDS.RESPONSES_SPEECH; }
  health() { return { railId: this.id, status: 'available', connected: false, fallbackEligible: false }; }
  async close() {}
}

export class GPTLiveRail {
  constructor() { this.id = RAIL_IDS.GPT_LIVE; }
  health() { return { railId: this.id, status: 'unavailable', reason: 'provider_api_not_available', connected: false, fallbackEligible: false }; }
  async start() { throw new Error('GPT-Live API is not available for this authenticated application.'); }
  async close() {}
}

export class OpenAIRealtimeRail {
  constructor({ onState = () => {}, onTurn = () => {}, onError = () => {} } = {}) {
    this.id = RAIL_IDS.OPENAI_REALTIME;
    this.onState = onState;
    this.onTurn = onTurn;
    this.onError = onError;
    this.socket = null;
    this.status = 'idle';
    this.model = null;
    this.voiceId = null;
    this.turnDetection = null;
    this.startedAt = null;
    this.connectedAt = null;
    this.firstAudioAt = null;
    this.lastSpeechStoppedAt = null;
    this.lastSpeechStartedAt = null;
    this.interruptionDetectedAt = null;
    this.interruptionCancelledAt = null;
    this.responseStartedAt = null;
    this.currentItemId = null;
    this.currentResponseId = null;
    this.currentAssistant = '';
    this.inputSegments = [];
    this.responseUsage = null;
    this.openingPending = false;
    this.outputDone = false;
    this.audioContext = null;
    this.captureContext = null;
    this.captureSource = null;
    this.captureProcessor = null;
    this.captureMute = null;
    this.nextPlayTime = 0;
    this.responseAudioStartTime = null;
    this.sources = new Set();
    this.pendingSchedules = 0;
    this.playbackGeneration = 0;
    this.playbackQueue = Promise.resolve();
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;
  }

  health() {
    return {
      railId: this.id, status: this.status, connected: this.status === 'connected', model: this.model,
      voiceId: this.voiceId, turnDetection: this.turnDetection, fallbackEligible: this.status === 'failed' || this.status === 'closed',
    };
  }

  async start({ stream, alphaSessionId, model, voiceId, speed, behaviorPresetId, context, reasoningEffort = 'low' }) {
    if (this.status !== 'idle') return this.readyPromise;
    const audioTrack = stream?.getAudioTracks?.().find((track) => track.readyState === 'live');
    if (!audioTrack) throw new Error('A live microphone track is required for Continuous Conversation.');
    this.status = 'connecting';
    this.model = model;
    this.voiceId = voiceId;
    this.startedAt = performance.now();
    this.onState({ status: this.status });
    this.readyPromise = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    const socket = new WebSocket(socketUrl());
    this.socket = socket;
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => socket.send(JSON.stringify({
      type: 'start', alphaSessionId, model, voiceId, speed, behaviorPresetId, context, reasoningEffort,
    }));
    socket.onmessage = (message) => this.#handleMessage(message.data);
    socket.onerror = () => this.#fail(new Error('Continuous Conversation transport failed.'));
    socket.onclose = () => {
      if (!['closed', 'failed'].includes(this.status)) this.#fail(new Error('Continuous Conversation disconnected.'));
    };
    await this.readyPromise;
    await this.#startCapture(stream);
    return this.health();
  }

  async #startCapture(stream) {
    const Context = window.AudioContext || window.webkitAudioContext;
    const context = new Context();
    this.captureContext = context;
    if (context.state === 'suspended') await context.resume();
    this.captureSource = context.createMediaStreamSource(stream);
    this.captureProcessor = context.createScriptProcessor(2048, 1, 1);
    this.captureMute = context.createGain();
    this.captureMute.gain.value = 0;
    this.captureProcessor.onaudioprocess = (event) => {
      if (this.socket?.readyState !== WebSocket.OPEN || this.status !== 'connected') return;
      const pcm = pcm16FromFloat32(event.inputBuffer.getChannelData(0), context.sampleRate);
      if (pcm.byteLength <= 32 * 1024) this.socket.send(pcm.buffer);
    };
    this.captureSource.connect(this.captureProcessor);
    this.captureProcessor.connect(this.captureMute);
    this.captureMute.connect(context.destination);
  }

  requestOpening(utterance) {
    if (this.status !== 'connected') throw new Error('Continuous Conversation is not connected.');
    this.openingPending = true;
    this.socket.send(JSON.stringify({ type: 'opening', utterance }));
  }

  submitText(value) {
    const text = String(value || '').trim();
    if (!text || this.socket?.readyState !== WebSocket.OPEN) throw new Error('Continuous Conversation is not ready for a typed answer.');
    this.inputSegments.push(text);
    this.socket.send(JSON.stringify({ type: 'input_text', text }));
  }

  interrupt({ automatic = false } = {}) {
    const playedMs = this.responseAudioStartTime == null || !this.audioContext
      ? 0
      : Math.max(0, Math.round((this.audioContext.currentTime - this.responseAudioStartTime) * 1000));
    this.#stopOutput();
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({
      type: 'interrupt', itemId: this.currentItemId, playedMs, cancel: !automatic,
    }));
    return { playedMs, itemId: this.currentItemId };
  }

  #handleMessage(raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'rail_ready') {
      this.status = 'connected';
      this.connectedAt = performance.now();
      this.turnDetection = message.health?.turnDetection || 'semantic_vad';
      this.readyResolve?.(this.health());
      this.onState({ status: this.status, connectedMs: Math.round(this.connectedAt - this.startedAt) });
      return;
    }
    if (message.type === 'rail_error') {
      this.#fail(new Error(message.message || 'Continuous Conversation provider error.'));
      return;
    }
    if (message.type === 'rail_interrupted') {
      this.interruptionCancelledAt = performance.now();
      this.onState({
        status: 'listening',
        interruptionLatencyMs: this.interruptionDetectedAt == null ? null : Math.round(this.interruptionCancelledAt - this.interruptionDetectedAt),
      });
      return;
    }
    if (message.type === 'rail_event') this.#handleRailEvent(message.event || {});
  }

  #handleRailEvent(event) {
    if (event.type === 'connected') {
      this.model = event.model || this.model;
      this.voiceId = event.voiceId || this.voiceId;
      this.turnDetection = event.turnDetection || this.turnDetection;
    } else if (event.type === 'speech_started') {
      this.lastSpeechStartedAt = performance.now();
      if (this.sources.size || this.currentResponseId) {
        this.interruptionDetectedAt = performance.now();
        this.interrupt({ automatic: true });
      }
      this.onState({ status: 'listening', speechStarted: true });
    } else if (event.type === 'speech_stopped') {
      this.lastSpeechStoppedAt = performance.now();
      this.onState({ status: 'floor-yield-detected', speechStopped: true });
    } else if (event.type === 'input_transcript_done') {
      const transcript = String(event.transcript || '').trim();
      if (transcript) this.inputSegments.push(transcript);
    } else if (event.type === 'response_started') {
      this.currentResponseId = event.responseId;
      this.responseStartedAt = performance.now();
      this.outputDone = false;
      this.onState({ status: 'responding' });
    } else if (event.type === 'output_item') {
      this.currentItemId = event.itemId || this.currentItemId;
    } else if (event.type === 'assistant_transcript_delta') {
      this.currentAssistant += event.delta || '';
    } else if (event.type === 'assistant_transcript_done') {
      this.currentAssistant = event.transcript || this.currentAssistant;
    } else if (event.type === 'audio_delta') {
      if (this.firstAudioAt === null) this.firstAudioAt = performance.now();
      this.currentItemId = event.itemId || this.currentItemId;
      this.#queuePcm(event.delta);
    } else if (event.type === 'audio_done') {
      this.outputDone = true;
      this.#settleWhenDrained();
    } else if (event.type === 'response_done') {
      this.outputDone = true;
      this.responseUsage = event.usage || null;
      this.#settleWhenDrained();
    } else if (event.type === 'response_cancelled') {
      this.responseUsage = event.usage || null;
      this.currentAssistant = '';
      this.currentResponseId = null;
      this.currentItemId = null;
      this.outputDone = false;
      this.firstAudioAt = null;
      this.responseStartedAt = null;
      this.responseAudioStartTime = null;
      this.nextPlayTime = 0;
      this.#stopOutput();
      this.onState({ status: 'listening', cancelled: true });
    } else if (event.type === 'closed') {
      if (this.status !== 'closed') this.#fail(new Error('Continuous Conversation provider closed.'));
    } else if (event.type === 'error') {
      this.#fail(new Error(event.message || 'Continuous Conversation provider error.'));
    }
  }

  #queuePcm(base64) {
    const generation = this.playbackGeneration;
    this.pendingSchedules += 1;
    this.playbackQueue = this.playbackQueue
      .then(() => this.#playPcm(base64, generation))
      .catch((error) => {
        if (!['closed', 'failed'].includes(this.status)) this.#fail(error);
      })
      .finally(() => {
        this.pendingSchedules -= 1;
        this.#settleWhenDrained();
      });
  }

  async #playPcm(base64, generation) {
    const bytes = bytesFromBase64(base64);
    if (!bytes.byteLength || bytes.byteLength % 2) return;
    if (generation !== this.playbackGeneration) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    this.audioContext ||= new Context({ sampleRate: 24000 });
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    if (generation !== this.playbackGeneration || ['closed', 'failed'].includes(this.status)) return;
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const buffer = this.audioContext.createBuffer(1, samples.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    const startAt = Math.max(this.audioContext.currentTime + 0.01, this.nextPlayTime || 0);
    if (this.responseAudioStartTime == null) this.responseAudioStartTime = startAt;
    this.nextPlayTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); this.#settleWhenDrained(); };
    source.start(startAt);
    this.onState({ status: 'speaking', firstAudioMs: Math.round(this.firstAudioAt - this.responseStartedAt) });
  }

  #settleWhenDrained() {
    if (!this.outputDone || this.pendingSchedules || this.sources.size) return;
    const assistant = this.currentAssistant.trim();
    const applicant = this.inputSegments.join(' ').trim();
    const timings = {
      connectionMs: this.connectedAt == null ? null : Math.round(this.connectedAt - this.startedAt),
      firstAudioMs: this.firstAudioAt == null || this.responseStartedAt == null ? null : Math.round(this.firstAudioAt - this.responseStartedAt),
      floorToResponseMs: this.lastSpeechStoppedAt == null || this.responseStartedAt == null ? null : Math.round(this.responseStartedAt - this.lastSpeechStoppedAt),
      interruptionMs: this.interruptionDetectedAt == null || this.interruptionCancelledAt == null ? null : Math.round(this.interruptionCancelledAt - this.interruptionDetectedAt),
    };
    const opening = this.openingPending && !applicant;
    this.openingPending = false;
    this.currentAssistant = '';
    this.currentResponseId = null;
    this.currentItemId = null;
    this.outputDone = false;
    this.firstAudioAt = null;
    this.responseStartedAt = null;
    this.responseAudioStartTime = null;
    this.nextPlayTime = 0;
    if (opening) {
      this.onState({ status: 'listening', openingComplete: true, timings });
      return;
    }
    if (!assistant || !applicant) return;
    this.inputSegments = [];
    this.onTurn({ applicant, utterance: assistant, timings, usage: this.responseUsage });
    this.responseUsage = null;
  }

  #stopOutput() {
    this.playbackGeneration += 1;
    for (const source of this.sources) { try { source.stop(); } catch { /* already stopped */ } }
    this.sources.clear();
    this.nextPlayTime = 0;
  }

  #fail(error) {
    if (this.status === 'failed' || this.status === 'closed') return;
    this.status = 'failed';
    this.readyReject?.(error);
    this.#stopOutput();
    this.onError(error);
    this.onState({ status: this.status, fallbackEligible: true });
  }

  async close() {
    if (this.status === 'closed') return;
    this.status = 'closed';
    this.#stopOutput();
    if (this.captureProcessor) this.captureProcessor.onaudioprocess = null;
    try { this.captureSource?.disconnect(); } catch { /* already disconnected */ }
    try { this.captureProcessor?.disconnect(); } catch { /* already disconnected */ }
    try { this.captureMute?.disconnect(); } catch { /* already disconnected */ }
    if (this.captureContext && this.captureContext.state !== 'closed') await this.captureContext.close().catch(() => {});
    if (this.audioContext && this.audioContext.state !== 'closed') await this.audioContext.close().catch(() => {});
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'close' }));
    if (this.socket?.readyState < WebSocket.CLOSING) this.socket.close(1000, 'missionmed-rail-close');
    this.socket = null;
    this.onState({ status: this.status });
  }
}
