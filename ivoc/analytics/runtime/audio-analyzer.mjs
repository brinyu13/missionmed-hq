const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function rms(samples) {
  let energy = 0;
  for (const value of samples) energy += value * value;
  return Math.sqrt(energy / Math.max(1, samples.length));
}

function estimatePitch(samples, sampleRate) {
  const level = rms(samples);
  if (level < 0.01) return null;
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(samples.length - 1, Math.ceil(sampleRate / 70));
  let bestLag = 0;
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    for (let index = 0; index < samples.length - lag; index += 1) correlation += samples[index] * samples[index + lag];
    if (correlation > best) {
      best = correlation;
      bestLag = lag;
    }
  }
  return bestLag ? sampleRate / bestLag : null;
}

export function analyzePcmFrame(samples, sampleRate, state = {}) {
  if (!(samples instanceof Float32Array) || samples.length < 32) throw new TypeError('samples must be a Float32Array');
  if (!Number.isFinite(sampleRate) || sampleRate < 8000) throw new TypeError('sampleRate is invalid');
  const level = rms(samples);
  const dbfs = level === 0 ? -96 : Math.max(-96, 20 * Math.log10(level));
  const clippingRatio = samples.reduce((count, value) => count + (Math.abs(value) >= 0.98 ? 1 : 0), 0) / samples.length;
  const speaking = dbfs > (state.speechThresholdDbfs ?? -48);
  const pitchHz = speaking ? estimatePitch(samples, sampleRate) : null;
  const priorSpeaking = state.speaking === true;
  const nowMs = state.nowMs ?? 0;
  const speechStartedAt = speaking && !priorSpeaking ? nowMs : state.speechStartedAt ?? null;
  const silenceStartedAt = !speaking && priorSpeaking ? nowMs : state.silenceStartedAt ?? null;
  const silenceMs = !speaking && silenceStartedAt !== null ? nowMs - silenceStartedAt : 0;
  const speechState = speaking ? 'ANSWERING' : silenceMs >= 1500 ? 'PAUSE_LONG' : silenceMs >= 400 ? 'PAUSE_SHORT' : 'TRANSITION';
  const peak = speaking && !priorSpeaking ? 1 : 0;
  const syllablePeaks = (state.syllablePeaks ?? 0) + peak;
  const elapsedMinutes = Math.max((nowMs - (state.windowStartedAt ?? nowMs)) / 60000, 1 / 60);
  const paceSpm = syllablePeaks / elapsedMinutes;
  return {
    metrics: Object.freeze({
      volume_dbfs: Number(dbfs.toFixed(2)),
      volume_0_10: Number(clamp((dbfs + 60) / 4.5, 0, 10).toFixed(1)),
      clipping_ratio: Number(clippingRatio.toFixed(4)),
      pitch_hz: pitchHz === null ? null : Number(pitchHz.toFixed(1)),
      speech_state: speechState,
      speaking,
      pace_syllables_per_minute: Number(clamp(paceSpm, 0, 360).toFixed(1)),
      pause_ms: silenceMs,
    }),
    state: Object.freeze({
      ...state,
      speaking,
      speechStartedAt,
      silenceStartedAt,
      syllablePeaks,
      windowStartedAt: state.windowStartedAt ?? nowMs,
    }),
  };
}

export function createWebAudioSampler(stream, { onMetrics, intervalMs = 100, AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
  if (!stream || typeof stream.getAudioTracks !== 'function' || stream.getAudioTracks().length === 0) throw new TypeError('an admitted audio stream is required');
  if (typeof onMetrics !== 'function' || !AudioContextClass) throw new TypeError('Web Audio and onMetrics are required');
  let context;
  let source;
  let analyser;
  let timer;
  let state = {};
  return {
    async start() {
      context = new AudioContextClass();
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer);
        const output = analyzePcmFrame(buffer, context.sampleRate, { ...state, nowMs: performance.now() });
        state = output.state;
        onMetrics(output.metrics);
      }, intervalMs);
    },
    async stop() {
      clearInterval(timer);
      source?.disconnect();
      await context?.close();
      state = {};
    },
  };
}
