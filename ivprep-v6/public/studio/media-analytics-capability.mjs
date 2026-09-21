// Media and Delivery Intelligence stay below the presentation boundary.
export function createMediaAnalyticsBridge() {
  return {
    media: Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null }),
    ownsStream: false,
    source: null,
    sink: null,
    audioContext: null,
    trackListeners: [],
    refreshLiveness() {
      const stream = this.media.stream;
      const cam = Boolean(stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
      const rawMic = Boolean(stream?.getAudioTracks?.().some((track) => track.readyState === 'live'));
      this.media = Object.freeze({
        ...this.media,
        cam,
        mic: Boolean(rawMic && this.media.AC && this.media.analyser && this.media.data),
      });
      window.dispatchEvent?.(new CustomEvent('ivoc-media-liveness'));
      return this.media;
    },
    watchTracks(stream) {
      this.trackListeners = [];
      for (const track of stream.getTracks()) {
        const refresh = () => this.refreshLiveness();
        for (const name of ['ended', 'mute', 'unmute']) track.addEventListener?.(name, refresh);
        this.trackListeners.push({ track, refresh });
      }
    },
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
      this.watchTracks(stream);
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
    async requestMedia(mic = true, cam = true, selected = {}) {
      // A failed re-acquisition must never leave a dead stream advertised as LIVE or
      // bound to a visible preview. Release the old owned capture before retrying.
      this.stopMedia({ keepContext: true });
      const audio = mic === true
        ? (selected.microphone ? { deviceId: { exact: selected.microphone } } : true)
        : false;
      const video = cam === true
        ? (selected.camera ? { deviceId: { exact: selected.camera } } : true)
        : false;
      try {
        return await this.bindStream(await navigator.mediaDevices.getUserMedia({ audio, video }), { ownsStream: true });
      } catch (primaryError) {
        const recoverable = ['AbortError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError']
          .includes(primaryError?.name);
        if (!recoverable || mic !== true || cam !== true) throw primaryError;

        // Chrome can expose a valid camera in its site-permission preview while a
        // combined audio+video request still fails (or while a remembered device ID
        // has gone stale). Recover each current default independently, then bind the
        // tracks to one canonical IVOC stream. Never retain a half-open capture.
        let videoStream = null; let audioStream = null;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          const videoTrack = videoStream.getVideoTracks()[0];
          const audioTrack = audioStream.getAudioTracks()[0];
          if (!videoTrack || !audioTrack) throw new Error('Camera and microphone did not both return live tracks.');
          return await this.bindStream(new MediaStream([videoTrack, audioTrack]), { ownsStream: true });
        } catch (recoveryError) {
          videoStream?.getTracks?.().forEach((track) => track.stop());
          audioStream?.getTracks?.().forEach((track) => track.stop());
          throw recoveryError?.name ? recoveryError : primaryError;
        }
      }
    },
    stopMedia({ keepContext = false } = {}) {
      for (const { track, refresh } of this.trackListeners) {
        for (const name of ['ended', 'mute', 'unmute']) track.removeEventListener?.(name, refresh);
      }
      this.trackListeners = [];
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
