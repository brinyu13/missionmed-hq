// Media and Delivery Intelligence stay below the presentation boundary.
export function createMediaAnalyticsBridge() {
  return {
    media: Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null }),
    ownsStream: false,
    source: null,
    sink: null,
    audioContext: null,
    primeAudioContext() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!this.audioContext || this.audioContext.state === 'closed') this.audioContext = new Ctx();
      if (this.audioContext.state !== 'running') void this.audioContext.resume().catch(() => {});
      return this.audioContext;
    },
    async bindStream(stream, { ownsStream = false } = {}) {
      this.stopMedia({ keepContext: true });
      if (!(stream instanceof MediaStream)) throw new TypeError('A browser media stream is required.');
      const tracks = stream.getTracks();
      const mic = tracks.some((track) => track.kind === 'audio' && track.readyState === 'live');
      const cam = tracks.some((track) => track.kind === 'video' && track.readyState === 'live');
      let AC = null; let analyser = null; let data = null; let source = null; let sink = null;
      if (mic) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          AC = this.primeAudioContext();
          if (AC && AC.state !== 'running') { try { await AC.resume(); } catch {} }
          analyser = AC.createAnalyser(); analyser.fftSize = 2048;
          data = new Float32Array(analyser.fftSize);
          source = AC.createMediaStreamSource(stream); source.connect(analyser);
          sink = AC.createMediaStreamDestination(); analyser.connect(sink);
        }
      }
      this.ownsStream = ownsStream; this.source = source; this.sink = sink;
      this.media = Object.freeze({ cam, mic: Boolean(mic && AC && analyser && data), stream, AC, analyser, data });
      return this.media;
    },
    async replaceTrack(kind, deviceId) {
      const constraint = kind === 'audio' ? { audio: { deviceId: { exact: deviceId } }, video: false } : { video: { deviceId: { exact: deviceId } }, audio: false };
      const fresh = await navigator.mediaDevices.getUserMedia(constraint);
      const incoming = kind === 'audio' ? fresh.getAudioTracks()[0] : fresh.getVideoTracks()[0];
      if (!incoming) { fresh.getTracks().forEach((track) => track.stop()); throw new Error(`No ${kind} track returned.`); }
      const current = this.media.stream;
      const outgoing = kind === 'audio' ? current?.getAudioTracks?.()[0] : current?.getVideoTracks?.()[0];
      const retained = (current?.getTracks?.() || []).filter((track) => track !== outgoing);
      this.ownsStream = false;
      await this.bindStream(new MediaStream([...retained, incoming]), { ownsStream: true });
      try { outgoing?.stop?.(); } catch {}
      return this.media;
    },
    async requestMedia(mic = true, cam = true) {
      return this.bindStream(await navigator.mediaDevices.getUserMedia({ audio: mic === true, video: cam === true }), { ownsStream: true });
    },
    stopMedia({ keepContext = false } = {}) {
      try { this.source?.disconnect?.(); } catch {}
      try { this.sink?.disconnect?.(); } catch {}
      if (this.ownsStream) this.media.stream?.getTracks?.().forEach((track) => track.stop());
      if (!keepContext) { void this.media.AC?.close?.().catch?.(() => {}); this.audioContext = null; }
      this.ownsStream = false; this.source = null; this.sink = null;
      this.media = Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null });
    },
  };
}

export async function loadAnalyticsCapabilityModules() {
  const [{ initializeAnalyticsUi }, { DeliveryIntelligenceGroups }] = await Promise.all([
    import('../analytics/ui.mjs'),
    import('../analytics/di-groups-ui.mjs'),
  ]);
  return Object.freeze({ initializeAnalyticsUi, DeliveryIntelligenceGroups });
}
