import { BrowserAnalyticsRuntime } from '../../analytics/runtime/browser-runtime.mjs';
import { CanonicalRecorder } from '../../media/recorder.mjs';

export function createM1ViewModel({ sessionId, mediaId, clock, eventSink, onChunk }) {
  let recorder;
  const analytics = new BrowserAnalyticsRuntime({ sessionId, clock, eventSink });
  const listeners = new Set();
  const state = { phase: 'idle', readiness: null, stream: null, signals: analytics.registry.snapshot(), recording: false, error: null };
  const publish = () => listeners.forEach((listener) => listener(structuredClone(state)));
  const emit = (type, payload) => eventSink({ type, payload, session_id: sessionId, t_media_ms: clock.now() });
  return Object.freeze({
    subscribe(listener) { listeners.add(listener); listener(structuredClone(state)); return () => listeners.delete(listener); },
    async preflight() { state.readiness = await analytics.preflight(); state.phase = 'preflight'; publish(); return state.readiness; },
    async start() {
      state.phase = 'requesting_media'; publish();
      try {
        const started = await analytics.start();
        state.stream = started.stream;
        state.readiness = started.readiness;
        recorder = new CanonicalRecorder({ sessionId, mediaId, stream: state.stream, clock, emit, onChunk });
        recorder.start();
        state.recording = true;
        state.phase = 'live';
        const poll = setInterval(() => { state.signals = analytics.registry.snapshot(); publish(); if (state.phase !== 'live') clearInterval(poll); }, 250);
        publish();
        return state.stream;
      } catch (error) {
        state.phase = 'faulted'; state.error = error instanceof Error ? error.message : 'Media start failed'; publish(); throw error;
      }
    },
    async stop() {
      state.phase = 'sealing'; publish();
      const media = await recorder.stop();
      const analyticsSummary = await analytics.stop();
      state.phase = 'complete'; state.recording = false; state.stream = null; state.signals = analytics.registry.snapshot(); publish();
      return { media, analytics: analyticsSummary };
    },
  });
}
