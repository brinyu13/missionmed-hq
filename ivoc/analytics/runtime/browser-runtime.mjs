import { M1_SIGNAL_DESCRIPTORS } from '../descriptors.mjs';
import { SignalRegistry } from '../registry.mjs';
import { createWebAudioSampler } from './audio-analyzer.mjs';

export class BrowserAnalyticsRuntime {
  constructor({ sessionId, clock, eventSink, mediaDevices = globalThis.navigator?.mediaDevices, audioSamplerFactory = createWebAudioSampler }) {
    this.mediaDevices = mediaDevices;
    this.audioSamplerFactory = audioSamplerFactory;
    this.registry = new SignalRegistry({ sessionId, clock, eventSink });
    M1_SIGNAL_DESCRIPTORS.forEach((item) => this.registry.register(item));
    this.stream = null;
    this.audioSampler = null;
  }

  async preflight() {
    if (!this.mediaDevices?.getUserMedia) {
      return { camera: { state: 'not_ready', reason: 'media_devices_unavailable' }, microphone: { state: 'not_ready', reason: 'media_devices_unavailable' } };
    }
    return { camera: { state: 'not_ready', reason: 'permission_not_yet_granted' }, microphone: { state: 'not_ready', reason: 'permission_not_yet_granted' } };
  }

  async start({ video = true, audio = true } = {}) {
    this.stream = await this.mediaDevices.getUserMedia({ video: video ? { aspectRatio: 16 / 9 } : false, audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: false } : false });
    const hasVideo = this.stream.getVideoTracks().length > 0;
    const hasAudio = this.stream.getAudioTracks().length > 0;
    for (const id of ['frame.face_presence', 'frame.framing', 'head.position', 'head.movement', 'head.camera_facing_balance', 'face.smile_activity', 'hands.visible', 'hands.gesture_events', 'hands.gesture_rate']) {
      this.registry.setAvailability(id, hasVideo ? 'degraded' : 'unavailable', hasVideo ? 'vision_adapter_pending' : 'video_track_missing');
    }
    for (const id of ['speech.state', 'voice.volume', 'voice.pace', 'voice.pauses', 'voice.pitch_variation']) {
      this.registry.setAvailability(id, hasAudio ? 'ok' : 'unavailable', hasAudio ? null : 'audio_track_missing');
    }
    if (hasAudio) {
      this.audioSampler = this.audioSamplerFactory(this.stream, {
        onMetrics: (metrics) => {
          this.registry.ingest('voice.volume', { dbfs: metrics.volume_dbfs, scale_0_10: metrics.volume_0_10, clipping_ratio: metrics.clipping_ratio });
          this.registry.ingest('voice.pitch_variation', { f0_hz: metrics.pitch_hz }, { availability: metrics.pitch_hz === null ? 'degraded' : 'ok' });
          this.registry.ingest('speech.state', { state: metrics.speech_state });
          this.registry.ingest('voice.pace', { syllables_per_minute: metrics.pace_syllables_per_minute }, { availability: 'degraded' });
          if (metrics.speech_state === 'PAUSE_SHORT' || metrics.speech_state === 'PAUSE_LONG') this.registry.ingest('voice.pauses', { kind: metrics.speech_state, duration_ms: metrics.pause_ms });
        },
      });
      await this.audioSampler.start();
    }
    return { stream: this.stream, readiness: { camera: hasVideo, microphone: hasAudio, vision: hasVideo ? 'degraded' : 'unavailable', audio: hasAudio ? 'ready' : 'unavailable' } };
  }

  async stop() {
    await this.audioSampler?.stop();
    for (const track of this.stream?.getTracks?.() ?? []) track.stop();
    this.stream = null;
    return this.registry.finalize();
  }
}
