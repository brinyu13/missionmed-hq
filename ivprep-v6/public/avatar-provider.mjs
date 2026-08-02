export class AvatarProvider {
  async createSession() { throw new Error('AvatarProvider.createSession not implemented'); }
  async start() { throw new Error('AvatarProvider.start not implemented'); }
  async enqueueAudio() { throw new Error('AvatarProvider.enqueueAudio not implemented'); }
  async attachAudioStream() { throw new Error('AvatarProvider.attachAudioStream not implemented'); }
  async interrupt() { throw new Error('AvatarProvider.interrupt not implemented'); }
  async stop() { throw new Error('AvatarProvider.stop not implemented'); }
  async reconnect() { throw new Error('AvatarProvider.reconnect not implemented'); }
  health() { return { available: false, state: 'unconfigured' }; }
  usage() { return { sessions: 0, seconds: 0 }; }
  async close() {}
}

export class UnavailableAvatarProvider extends AvatarProvider {
  constructor(reason = 'Avatar integration begins in Y1-Y2-CAM-V6-3402.') {
    super();
    this.reason = reason;
  }
  async createSession() { return { available: false, reason: this.reason }; }
  async start() { return { available: false, reason: this.reason }; }
  async enqueueAudio() { return { accepted: false, reason: this.reason }; }
  async attachAudioStream() { return { accepted: false, reason: this.reason }; }
  async interrupt() { return { interrupted: false, reason: this.reason }; }
  async stop() { return { stopped: true }; }
  async reconnect() { return { available: false, reason: this.reason }; }
  health() { return { available: false, state: 'not-implemented', reason: this.reason }; }
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
    this.state = 'idle';
    this.lastError = null;
    this.startedAt = null;
    this.reconnects = 0;
    this.attached = [];
    this.videoReady = false;
    this.audioReady = false;
    this.audioPlaybackReady = false;
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

  async createSession(configuration = {}) {
    this.#setState('creating');
    try {
      const payload = await this.#request('/api/avatar/session/create', configuration);
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
    const sessionId = this.sessionId;
    try {
      const payload = await this.#request('/api/avatar/session/start', { sessionId });
      const { Room, RoomEvent } = await import('/vendor/livekit-client.esm.mjs');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      let resolveVideo;
      const videoSubscribed = new Promise((resolve) => { resolveVideo = resolve; });
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
        if (track.kind === 'audio') this.audioReady = false;
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
          this.videoReady = true;
          resolveVideo();
        } else {
          element.hidden = true;
          this.audioReady = true;
        }
        this.videoContainer?.append(element);
        this.attached.push({ track, element });
        if (this.videoReady && this.audioPlaybackReady) this.#setState('live');
        else if (this.videoReady) this.#setState('video-ready');
      });
      room.on(RoomEvent.TrackUnsubscribed, removeTrack);
      room.on(RoomEvent.Disconnected, () => {
        for (const attached of [...this.attached]) removeTrack(attached.track);
        this.videoReady = false;
        this.audioReady = false;
        this.#setState('disconnected', { reason: 'Live avatar connection was interrupted. Voice-only remains available.' });
      });
      room.on(RoomEvent.Reconnecting, () => this.#setState('reconnecting'));
      room.on(RoomEvent.Reconnected, () => this.#setState(this.videoReady && this.audioPlaybackReady ? 'live' : 'connecting'));
      if (RoomEvent.AudioPlaybackStatusChanged) {
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          this.audioPlaybackReady = room.canPlaybackAudio !== false;
          if (!this.audioPlaybackReady) {
            this.lastError = 'Browser audio playback requires a user gesture.';
            this.#setState('audio-blocked', { reason: this.lastError });
          } else if (this.videoReady) {
            this.lastError = null;
            this.#setState('live');
          }
        });
      }
      await room.connect(payload.livekitUrl, payload.livekitClientToken, { autoSubscribe: true });
      if (typeof room.startAudio === 'function') await room.startAudio().catch(() => {});
      this.audioPlaybackReady = room.canPlaybackAudio !== false;
      await Promise.race([
        videoSubscribed,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Live avatar video did not become ready.')), 20_000)),
      ]);
      if (!this.videoReady) throw new Error('Live avatar video did not become ready.');
      this.startedAt = Date.now();
      this.#setState(this.audioPlaybackReady ? 'live' : 'audio-blocked', this.audioPlaybackReady ? {} : { reason: 'Browser audio playback requires a user gesture.' });
      return { status: this.state, sessionId: this.sessionId, videoReady: true, audioReady: this.audioReady, audioPlaybackReady: this.audioPlaybackReady };
    } catch (error) {
      this.lastError = publicError(error, 'Live avatar media could not start.').message;
      try { await this.#request('/api/avatar/session/stop', { sessionId, reason: 'SERVER_ERROR' }); } catch {}
      await this.#detach();
      this.sessionId = null;
      this.#setState('unavailable', { reason: this.lastError });
      throw publicError(error, 'Live avatar media could not start.');
    }
  }

  async enqueueAudio(audio, { signal } = {}) {
    if (!this.sessionId) return { accepted: false, reason: 'No avatar session is active.' };
    const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio;
    if (!bytes?.byteLength) return { accepted: false, reason: 'No avatar audio was supplied.' };
    const eventId = crypto.randomUUID();
    const chunkSize = 48_000;
    let chunks = 0;
    let finalResponse = null;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      if (signal?.aborted) return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: offset, chunks, final: false };
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      let binary = '';
      for (let binaryOffset = 0; binaryOffset < chunk.length; binaryOffset += 0x8000) {
        binary += String.fromCharCode(...chunk.subarray(binaryOffset, binaryOffset + 0x8000));
      }
      const final = offset + chunk.length >= bytes.length;
      finalResponse = await this.#request('/api/avatar/session/audio', {
        sessionId: this.sessionId,
        eventId,
        final,
        pcmBase64: btoa(binary),
      });
      chunks += 1;
      if (signal?.aborted) return { accepted: true, playbackEnded: false, reason: 'interrupted', eventId, bytes: offset + chunk.length, chunks, final };
    }
    return { ...finalResponse, accepted: finalResponse?.accepted !== false, eventId, bytes: bytes.byteLength, chunks, final: true };
  }

  async attachAudioStream(stream) {
    if (!stream?.getReader) throw new TypeError('Avatar audio stream must be a readable byte stream.');
    const reader = stream.getReader();
    const buffers = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) { buffers.push(value); byteLength += value.byteLength; }
    }
    if (!byteLength) return { accepted: false, reason: 'No avatar audio was supplied.' };
    const audio = new Uint8Array(byteLength);
    let offset = 0;
    for (const buffer of buffers) { audio.set(buffer, offset); offset += buffer.byteLength; }
    const result = await this.enqueueAudio(audio);
    return { ...result, sourceChunks: buffers.length };
  }

  async interrupt() {
    if (!this.sessionId) return { interrupted: false };
    return this.#request('/api/avatar/session/interrupt', { sessionId: this.sessionId });
  }

  async resumeAudio() {
    if (!this.room) return { available: false, reason: 'No live avatar media room is connected.' };
    if (typeof this.room.startAudio === 'function') await this.room.startAudio();
    this.audioPlaybackReady = this.room.canPlaybackAudio !== false;
    if (this.audioPlaybackReady && this.videoReady) {
      this.lastError = null;
      this.#setState('live');
    } else {
      this.#setState('audio-blocked', { reason: 'Browser audio playback is still blocked.' });
    }
    return { available: this.audioPlaybackReady && this.videoReady, audioPlaybackReady: this.audioPlaybackReady };
  }

  async stop(reason = 'stopped') {
    if (!this.sessionId) return { stopped: true };
    const sessionId = this.sessionId;
    this.#setState('stopping');
    try { return await this.#request('/api/avatar/session/stop', { sessionId, reason }); }
    finally { await this.#detach(); this.sessionId = null; this.#setState('stopped'); }
  }

  async reconnect() {
    if (!this.sessionId) throw new Error('No avatar session is available to reconnect.');
    this.reconnects += 1;
    const result = await this.#request('/api/avatar/session/reconnect', { sessionId: this.sessionId });
    this.#setState(this.videoReady && this.audioPlaybackReady ? 'live' : 'reconnecting');
    return { ...result, videoReady: this.videoReady, audioReady: this.audioReady, audioPlaybackReady: this.audioPlaybackReady };
  }

  health() {
    return { provider: 'liveavatar', available: this.state === 'live' && this.videoReady && this.audioPlaybackReady, state: this.state, videoReady: this.videoReady, audioReady: this.audioReady, audioPlaybackReady: this.audioPlaybackReady, reconnects: this.reconnects, reason: this.lastError };
  }

  usage() {
    return { provider: 'liveavatar', sessions: this.startedAt ? 1 : 0, minutes: this.startedAt ? Math.max(0, (Date.now() - this.startedAt) / 60_000) : 0 };
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
