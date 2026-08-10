import { liveMediaReady } from './avatar/media-readiness.mjs';

export class AvatarProvider {
  async configure() { throw new Error('AvatarProvider.configure not implemented'); }
  async createSession() { throw new Error('AvatarProvider.createSession not implemented'); }
  async start() { throw new Error('AvatarProvider.start not implemented'); }
  async enqueueAudio() { throw new Error('AvatarProvider.enqueueAudio not implemented'); }
  async attachAudioStream() { throw new Error('AvatarProvider.attachAudioStream not implemented'); }
  async interrupt() { throw new Error('AvatarProvider.interrupt not implemented'); }
  async stop() { throw new Error('AvatarProvider.stop not implemented'); }
  async reconnect() { throw new Error('AvatarProvider.reconnect not implemented'); }
  capabilities() { return {}; }
  health() { return { available: false, state: 'unconfigured' }; }
  usage() { return { sessions: 0, seconds: 0 }; }
  async close() {}
}

export class UnavailableAvatarProvider extends AvatarProvider {
  constructor(reason = 'Avatar integration begins in Y1-Y2-CAM-V6-3402.') {
    super();
    this.reason = reason;
  }
  async configure() { return { available: false, reason: this.reason }; }
  async createSession() { return { available: false, reason: this.reason }; }
  async start() { return { available: false, reason: this.reason }; }
  async enqueueAudio() { return { accepted: false, reason: this.reason }; }
  async attachAudioStream() { return { accepted: false, reason: this.reason }; }
  async interrupt() { return { interrupted: false, reason: this.reason }; }
  async stop() { return { stopped: true }; }
  async reconnect() { return { available: false, reason: this.reason }; }
  health() { return { available: false, state: 'not-implemented', reason: this.reason }; }
  capabilities() { return {}; }
}

function publicError(payload, fallback) {
  return new Error(String(payload?.error?.message || payload?.error || payload?.message || fallback).slice(0, 240));
}

export class LiveAvatarBrowserProvider extends AvatarProvider {
  constructor({ videoContainer, onState = () => {}, fetchImpl = window.fetch.bind(window) } = {}) {
    super();
    this.videoContainer = videoContainer;
    this.onState = onState;
    this.fetchImpl = fetchImpl;
    this.room = null;
    this.sessionId = null;
    this.alphaSessionId = null;
    this.activeAudioEventId = null;
    this.state = 'idle';
    this.lastError = null;
    this.startedAt = null;
    this.connectStartedAt = null;
    this.firstVideoTrackMs = null;
    this.firstFrameMs = null;
    this.firstAudioTrackMs = null;
    this.firstAudioPlaybackMs = null;
    this.reconnects = 0;
    this.sessionsStarted = 0;
    this.attached = [];
    this.videoReady = false;
    this.audioReady = false;
    this.audioPlaybackReady = false;
    this.providerMode = null;
    this.deliveryProfileId = null;
    this.providerCapabilities = Object.freeze({});
  }

  #setState(state, extra = {}) {
    this.state = state;
    this.onState({ state, ...extra });
  }

  async #request(path, body) {
    const response = await this.fetchImpl(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw publicError(payload, 'Live avatar request failed.');
    return payload;
  }

  async configure(configuration = {}) {
    const alphaSessionId = String(configuration.alphaSessionId || '');
    if (!alphaSessionId) throw new Error('An active interview session is required for LiveAvatar.');
    this.alphaSessionId = alphaSessionId;
    return { configured: true, alphaSessionId, audioAuthority: 'liveavatar-livekit' };
  }

  async createSession(configuration = {}) {
    this.#setState('creating');
    try {
      await this.configure(configuration);
      const payload = await this.#request('/api/avatar/session/create', configuration);
      if (!payload.deliveryProfileId || payload.capabilities?.supportsRealtimeVideo !== true) {
        throw new Error('The server did not provide a supported avatar delivery profile.');
      }
      this.providerMode = payload.mode || null;
      this.deliveryProfileId = payload.deliveryProfileId;
      this.providerCapabilities = Object.freeze({ ...payload.capabilities });
      this.sessionId = payload.sessionId;
      this.#setState('created');
      return { sessionId: this.sessionId, status: 'created' };
    } catch (error) {
      this.lastError = error.message;
      this.#setState('unavailable', { reason: error.message });
      throw error;
    }
  }

  async start() {
    if (!this.sessionId) throw new Error('Create the avatar session before starting it.');
    this.#setState('connecting');
    this.connectStartedAt = performance.now();
    this.firstVideoTrackMs = null;
    this.firstFrameMs = null;
    this.firstAudioTrackMs = null;
    this.firstAudioPlaybackMs = null;
    const sessionId = this.sessionId;
    try {
      const payload = await this.#request('/api/avatar/session/start', { sessionId, alphaSessionId: this.alphaSessionId });
      if (payload.deliveryProfileId !== this.deliveryProfileId) throw new Error('The avatar delivery profile changed during the active session.');
      if (this.providerCapabilities.mediaTransport !== 'livekit') throw new Error('The active avatar media transport is not implemented in this browser adapter.');
      const { Room, RoomEvent } = await import('/vendor/livekit-client.esm.mjs');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      let resolveMedia;
      const mediaSubscribed = new Promise((resolve) => { resolveMedia = resolve; });
      const publishMediaState = () => {
        if (liveMediaReady(this)) {
          this.#setState('live');
          resolveMedia();
        } else if (this.videoReady && this.audioReady) this.#setState('media-ready');
        else if (this.videoReady) this.#setState('video-ready');
      };
      const removeTrack = (track) => {
        const retained = [];
        for (const attached of this.attached) {
          if (attached.track !== track) { retained.push(attached); continue; }
          try { attached.track.detach(attached.element); } catch {}
          attached.element.remove();
        }
        this.attached = retained;
        if (track.kind === 'video') {
          this.videoReady = false;
          this.#setState('disconnected', { reason: 'Live avatar video was interrupted. Voice-only remains available.' });
        }
        if (track.kind === 'audio') {
          this.audioReady = false;
          this.#setState('degraded', { reason: 'Live avatar audio was interrupted. Voice-only remains available.' });
        }
      };
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (!['video', 'audio'].includes(track.kind)) return;
        for (const existing of this.attached.filter((entry) => entry.track.kind === track.kind)) removeTrack(existing.track);
        const element = track.attach();
        element.autoplay = true;
        element.playsInline = true;
        if (track.kind === 'video') {
          element.id = 'live-avatar-video';
          element.setAttribute('aria-label', 'Live synchronized interviewer avatar');
          element.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:none;z-index:2;background:#070b12';
          this.firstVideoTrackMs ??= Math.round(performance.now() - this.connectStartedAt);
        } else {
          element.hidden = true;
          this.audioReady = true;
          this.firstAudioTrackMs ??= Math.round(performance.now() - this.connectStartedAt);
          element.addEventListener('playing', () => {
            this.firstAudioPlaybackMs ??= Math.round(performance.now() - this.connectStartedAt);
            publishMediaState();
          }, { once: true });
        }
        this.videoContainer?.append(element);
        this.attached.push({ track, element });
        if (track.kind === 'video') {
          const markRenderedFrame = () => {
            if (!this.attached.some((entry) => entry.track === track)) return;
            this.videoReady = true;
            this.firstFrameMs ??= Math.round(performance.now() - this.connectStartedAt);
            publishMediaState();
          };
          element.addEventListener('playing', markRenderedFrame, { once: true });
          if (typeof element.requestVideoFrameCallback === 'function') element.requestVideoFrameCallback(markRenderedFrame);
        }
        publishMediaState();
      });
      room.on(RoomEvent.TrackUnsubscribed, removeTrack);
      room.on(RoomEvent.Disconnected, () => {
        const intentionalStop = ['stopping', 'stopped'].includes(this.state);
        for (const attached of [...this.attached]) removeTrack(attached.track);
        this.videoReady = false;
        this.audioReady = false;
        if (intentionalStop) return;
        this.#setState('disconnected', { reason: 'Live avatar connection was interrupted. Voice-only remains available.' });
        if (this.startedAt && this.sessionId && this.reconnects < 2) {
          queueMicrotask(() => this.reconnect().catch((error) => {
            this.lastError = publicError(error, 'Live avatar reconnection failed.').message;
            this.#setState('unavailable', { reason: `${this.lastError} Voice-only remains available.` });
          }));
        }
      });
      room.on(RoomEvent.Reconnecting, () => this.#setState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => this.#setState(liveMediaReady(this) ? 'live' : 'connecting'));
      if (RoomEvent.AudioPlaybackStatusChanged) {
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          this.audioPlaybackReady = room.canPlaybackAudio !== false;
          if (!this.audioPlaybackReady) {
            this.lastError = 'Browser audio playback requires a user gesture.';
            this.#setState('audio-blocked', { reason: this.lastError });
          } else if (this.videoReady && this.audioReady) {
            this.lastError = null;
            publishMediaState();
          }
        });
      }
      await room.connect(payload.livekitUrl, payload.livekitClientToken, { autoSubscribe: true });
      if (typeof room.startAudio === 'function') await room.startAudio().catch(() => {});
      this.audioPlaybackReady = room.canPlaybackAudio !== false;
      publishMediaState();
      await Promise.race([
        mediaSubscribed,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Live avatar synchronized audio and video did not become ready.')), 20_000)),
      ]);
      if (!this.videoReady || !this.audioReady || !this.audioPlaybackReady) throw new Error('Live avatar synchronized audio and video did not become ready.');
      this.startedAt = Date.now();
      this.sessionsStarted += 1;
      this.#setState('live');
      return { status: this.state, sessionId: this.sessionId, videoReady: true, audioReady: true, audioPlaybackReady: true, firstVideoTrackMs: this.firstVideoTrackMs, firstFrameMs: this.firstFrameMs, firstAudioTrackMs: this.firstAudioTrackMs, firstAudioPlaybackMs: this.firstAudioPlaybackMs };
    } catch (error) {
      this.lastError = publicError(error, 'Live avatar media could not start.').message;
      try { await this.#request('/api/avatar/session/stop', { sessionId, alphaSessionId: this.alphaSessionId, reason: 'SERVER_ERROR' }); } catch {}
      await this.#detach();
      this.sessionId = null;
      this.#setState('unavailable', { reason: this.lastError });
      throw publicError(error, 'Live avatar media could not start.');
    }
  }

  #pcmBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  #sendPcm(bytes, { eventId, final }) {
    return this.#request('/api/avatar/session/audio', {
      sessionId: this.sessionId,
      alphaSessionId: this.alphaSessionId,
      eventId,
      final,
      pcmBase64: this.#pcmBase64(bytes),
    });
  }

  async enqueueAudio(audio, { signal, eventId = crypto.randomUUID() } = {}) {
    if (this.providerCapabilities.supportsSuppliedAudio !== true) return { accepted: false, reason: 'The active avatar delivery profile does not accept supplied audio.' };
    if (!this.sessionId) return { accepted: false, reason: 'No avatar session is active.' };
    const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio;
    if (!bytes?.byteLength) return { accepted: false, reason: 'No avatar audio was supplied.' };
    this.activeAudioEventId = eventId;
    const chunkSize = 48_000;
    let chunks = 0;
    let finalResponse = null;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      if (signal?.aborted) {
        await this.interrupt({ eventId }).catch(() => {});
        return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: offset, chunks, final: false };
      }
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      const final = offset + chunk.length >= bytes.length;
      finalResponse = await this.#sendPcm(chunk, { eventId, final });
      chunks += 1;
      if (signal?.aborted) {
        await this.interrupt({ eventId }).catch(() => {});
        return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: offset + chunk.length, chunks, final };
      }
    }
    if (this.activeAudioEventId === eventId) this.activeAudioEventId = null;
    return { ...finalResponse, accepted: finalResponse?.accepted !== false, eventId, bytes: bytes.byteLength, chunks, final: true };
  }

  async attachAudioStream(stream, { signal, eventId = crypto.randomUUID() } = {}) {
    if (!stream?.getReader) throw new TypeError('Avatar audio stream must be a readable byte stream.');
    const reader = stream.getReader();
    this.activeAudioEventId = eventId;
    let pending = null;
    let byteLength = 0;
    let sourceChunks = 0;
    let sentChunks = 0;
    let finalResponse = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.byteLength) continue;
        sourceChunks += 1;
        for (let offset = 0; offset < value.byteLength; offset += 48_000) {
          const next = value.subarray(offset, Math.min(value.byteLength, offset + 48_000));
          if (pending) {
            if (signal?.aborted) {
              await this.interrupt({ eventId }).catch(() => {});
              return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: byteLength, chunks: sentChunks, final: false, sourceChunks };
            }
            finalResponse = await this.#sendPcm(pending, { eventId, final: false });
            byteLength += pending.byteLength;
            sentChunks += 1;
          }
          pending = next;
        }
      }
      if (!pending) {
        await this.interrupt({ eventId }).catch(() => {});
        return { accepted: false, reason: 'No avatar audio was supplied.', eventId };
      }
      if (signal?.aborted) {
        await this.interrupt({ eventId }).catch(() => {});
        return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: byteLength, chunks: sentChunks, final: false, sourceChunks };
      }
      finalResponse = await this.#sendPcm(pending, { eventId, final: true });
      byteLength += pending.byteLength;
      sentChunks += 1;
      return { ...finalResponse, accepted: finalResponse?.accepted !== false, eventId, bytes: byteLength, chunks: sentChunks, final: true, sourceChunks };
    } catch (error) {
      await this.interrupt({ eventId }).catch(() => {});
      throw error;
    } finally {
      try { reader.releaseLock(); } catch {}
      if (this.activeAudioEventId === eventId) this.activeAudioEventId = null;
    }
  }

  async interrupt({ eventId = this.activeAudioEventId } = {}) {
    if (!this.sessionId) return { interrupted: false };
    const result = await this.#request('/api/avatar/session/interrupt', { sessionId: this.sessionId, alphaSessionId: this.alphaSessionId, eventId });
    if (!eventId || this.activeAudioEventId === eventId) this.activeAudioEventId = null;
    return result;
  }

  async resumeAudio() {
    if (!this.room) return { available: false, reason: 'No live avatar media room is connected.' };
    if (typeof this.room.startAudio === 'function') await this.room.startAudio();
    this.audioPlaybackReady = this.room.canPlaybackAudio !== false;
    if (liveMediaReady(this)) {
      this.lastError = null;
      this.#setState('live');
    } else {
      this.#setState('audio-blocked', { reason: 'Browser audio playback is still blocked.' });
    }
    return { available: liveMediaReady(this), audioPlaybackReady: this.audioPlaybackReady };
  }

  async stop(reason = 'stopped') {
    if (!this.sessionId) return { stopped: true };
    const sessionId = this.sessionId;
    this.#setState('stopping');
    let acknowledged = false;
    try {
      const result = await this.#request('/api/avatar/session/stop', { sessionId, alphaSessionId: this.alphaSessionId, reason });
      acknowledged = result?.cleanup?.acknowledged !== false;
      return result;
    } finally {
      await this.#detach();
      this.activeAudioEventId = null;
      if (acknowledged) this.acknowledgeServerCleanup();
      else this.#setState('cleanup-unconfirmed', { reason: 'Remote avatar cleanup is unconfirmed. Server ownership is retained for retry.' });
    }
  }

  acknowledgeServerCleanup() {
    this.sessionId = null;
    this.alphaSessionId = null;
    this.#setState('stopped');
  }

  async reconnect() {
    if (!this.sessionId) throw new Error('No avatar session is available to reconnect.');
    this.reconnects += 1;
    this.#setState('reconnecting');
    const result = await this.#request('/api/avatar/session/reconnect', { sessionId: this.sessionId, alphaSessionId: this.alphaSessionId });
    if (this.room && !liveMediaReady(this) && result.livekitUrl && result.livekitClientToken) {
      await this.room.connect(result.livekitUrl, result.livekitClientToken, { autoSubscribe: true });
      if (typeof this.room.startAudio === 'function') await this.room.startAudio().catch(() => {});
      this.audioPlaybackReady = this.room.canPlaybackAudio !== false;
    }
    if (!liveMediaReady(this)) {
      const deadline = Date.now() + 10_000;
      while (!liveMediaReady(this) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    if (!liveMediaReady(this)) throw new Error('Live avatar media did not recover after reconnect.');
    this.#setState('live');
    return { ...result, videoReady: this.videoReady, audioReady: this.audioReady, audioPlaybackReady: this.audioPlaybackReady };
  }

  health() {
    return { provider: 'liveavatar', mode: this.providerMode, deliveryProfileId: this.deliveryProfileId, capabilities: this.capabilities(), available: this.state === 'live' && liveMediaReady(this), state: this.state, videoReady: this.videoReady, audioReady: this.audioReady, audioPlaybackReady: this.audioPlaybackReady, firstVideoTrackMs: this.firstVideoTrackMs, firstFrameMs: this.firstFrameMs, firstAudioTrackMs: this.firstAudioTrackMs, firstAudioPlaybackMs: this.firstAudioPlaybackMs, reconnects: this.reconnects, sessionsStarted: this.sessionsStarted, reason: this.lastError };
  }

  capabilities() { return this.providerCapabilities; }

  usage() {
    return { provider: 'liveavatar', mode: this.providerMode, deliveryProfileId: this.deliveryProfileId, sessions: this.sessionsStarted, minutes: this.startedAt ? Math.max(0, (Date.now() - this.startedAt) / 60_000) : 0 };
  }

  async #detach() {
    for (const { track, element } of this.attached.splice(0)) {
      try { track.detach(element); } catch {}
      element.remove();
    }
    if (this.room) {
      try { await this.room.disconnect(); } catch {}
      this.room = null;
    }
    this.videoReady = false;
    this.audioReady = false;
    this.audioPlaybackReady = false;
  }

  async close() {
    try { await this.stop('closed'); }
    catch { await this.#detach(); }
  }
}
