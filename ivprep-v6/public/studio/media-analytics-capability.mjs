// Media and Delivery Intelligence stay below the presentation boundary.
// Dimensions and play() are not proof of a visible camera image: a live device
// can deliver black pixels indefinitely. Only a tiny local aggregate is used;
// no frame or pixel array leaves the browser.
export const CAMERA_BLACK_MESSAGE = 'Camera connected, but its image is black. Uncover or illuminate the camera, or choose another camera.';
const trackAvailable = (track) => track.readyState === 'live' && track.enabled !== false && track.muted !== true;

export function summarizeVideoFramePixels(pixels) {
  if (!pixels || pixels.length < 4 || pixels.length % 4 !== 0) return Object.freeze({ visible: false, mean: 0, max: 0 });
  let total = 0; let maximum = 0; let lit = 0;
  const count = pixels.length / 4;
  for (let index = 0; index < pixels.length; index += 4) {
    const level = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
    total += level;
    maximum = Math.max(maximum, level);
    if (level >= 24) lit += 1;
  }
  const mean = total / count;
  return Object.freeze({ visible: mean >= 6 && maximum >= 24 && lit / count >= 0.02,
    mean: Math.round(mean), max: Math.round(maximum) });
}

export function createMediaAnalyticsBridge() {
  return {
    media: Object.freeze({ cam: false, mic: false, stream: null, AC: null, analyser: null, data: null }),
    frameVisibility: Object.freeze({ stream: null, visible: false, reason: 'unchecked' }),
    ownsStream: false,
    source: null,
    sink: null,
    audioContext: null,
    trackListeners: [],
    frameRecoveryTimer: null,
    frameRecoveryIdentity: null,
    stopFrameRecovery() {
      clearInterval(this.frameRecoveryTimer);
      this.frameRecoveryTimer = null;
      this.frameRecoveryIdentity = null;
    },
    watchFrameRecovery(video, stream, canvas, context) {
      this.stopFrameRecovery();
      const identity = {};
      this.frameRecoveryIdentity = identity;
      // One tiny local sample per half-second, only after a black-image failure.
      // Do not acquire media, start an interview, or retain raw camera pixels.
      this.frameRecoveryTimer = setInterval(() => {
        if (this.frameRecoveryIdentity !== identity) return;
        if (this.media.stream !== stream || video.srcObject !== stream
          || this.frameVisibility.stream !== stream || this.frameVisibility.reason !== 'black_image'
          || !stream.getVideoTracks().some((track) => track.readyState === 'live')) {
          this.stopFrameRecovery();
          return;
        }
        if (!stream.getVideoTracks().some(trackAvailable) || video.paused || video.ended
          || video.videoWidth < 16 || video.videoHeight < 16) return;
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          if (!summarizeVideoFramePixels(context.getImageData(0, 0, canvas.width, canvas.height).data).visible) return;
        } catch { return; }
        this.frameVisibility = Object.freeze({ stream, visible: true, reason: 'image_verified' });
        this.stopFrameRecovery();
        window.dispatchEvent?.(new CustomEvent('ivoc-media-liveness'));
      }, 500);
      this.frameRecoveryTimer?.unref?.();
    },
    refreshLiveness() {
      const stream = this.media.stream;
      const cam = Boolean(stream?.getVideoTracks?.().some(trackAvailable));
      const rawMic = Boolean(stream?.getAudioTracks?.().some(trackAvailable));
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
      // A temporarily muted live microphone still needs its processing graph;
      // unmute should restore readiness without another capture request.
      const mic = tracks.some((track) => track.kind === 'audio' && track.readyState === 'live');
      const cam = tracks.some((track) => track.kind === 'video' && trackAvailable(track));
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
      this.media = Object.freeze({ cam, mic: Boolean(tracks.some((track) => track.kind === 'audio' && trackAvailable(track))
        && AC && analyser && data), stream, AC, analyser, data });
      this.frameVisibility = Object.freeze({ stream, visible: false, reason: 'unchecked' });
      this.watchTracks(stream);
      return this.media;
    },
    async verifyVisibleFrame(video, { timeoutMs = 1500 } = {}) {
      const stream = this.media.stream;
      if (!video || !stream || video.srcObject !== stream || video.videoWidth < 16 || video.videoHeight < 16) {
        throw new Error('Camera stream is not bound to the preview. Reconnect your camera.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 48;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Camera image could not be checked in this browser.');
      this.stopFrameRecovery();
      const deadline = Date.now() + timeoutMs;
      do {
        if (this.media.stream !== stream || video.srcObject !== stream || !stream.getVideoTracks().some(trackAvailable)) {
          throw new Error('Camera disconnected while checking the preview. Reconnect it.');
        }
        let summary;
        try {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          summary = summarizeVideoFramePixels(context.getImageData(0, 0, canvas.width, canvas.height).data);
        } catch {
          throw new Error('Camera image could not be checked in this browser.');
        }
        if (summary.visible) {
          this.frameVisibility = Object.freeze({ stream, visible: true, reason: 'image_verified' });
          return this.frameVisibility;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (true);
      this.frameVisibility = Object.freeze({ stream, visible: false, reason: 'black_image' });
      this.watchFrameRecovery(video, stream, canvas, context);
      throw new Error(CAMERA_BLACK_MESSAGE);
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
      this.stopFrameRecovery();
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
      this.frameVisibility = Object.freeze({ stream: null, visible: false, reason: 'unchecked' });
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
