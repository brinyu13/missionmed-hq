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
    const payload = await this.#request('/api/avatar/session/start', { sessionId: this.sessionId });
    const { Room, RoomEvent } = await import('/vendor/livekit-client.esm.mjs');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (!['video', 'audio'].includes(track.kind)) return;
      const element = track.attach();
      element.autoplay = true;
      if (track.kind === 'video') {
        element.id = 'live-avatar-video';
        element.setAttribute('aria-label', 'Live synchronized interviewer avatar');
        element.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;background:#070b12';
      } else {
        element.hidden = true;
      }
      this.videoContainer?.append(element);
      this.attached.push({ track, element });
      if (track.kind === 'video') this.#setState('live');
    });
    room.on(RoomEvent.Disconnected, () => this.#setState('disconnected'));
    room.on(RoomEvent.Reconnecting, () => this.#setState('reconnecting'));
    room.on(RoomEvent.Reconnected, () => this.#setState('live'));
    await room.connect(payload.livekitUrl, payload.livekitClientToken, { autoSubscribe: true });
    this.startedAt = Date.now();
    return { status: this.state, sessionId: this.sessionId };
  }

  async enqueueAudio(audio) {
    if (!this.sessionId) return { accepted: false, reason: 'No avatar session is active.' };
    const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : audio;
    if (!bytes?.byteLength) return { accepted: false, reason: 'No avatar audio was supplied.' };
    const eventId = crypto.randomUUID();
    const chunkSize = 48_000;
    let chunks = 0;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize));
      let binary = '';
      for (let binaryOffset = 0; binaryOffset < chunk.length; binaryOffset += 0x8000) {
        binary += String.fromCharCode(...chunk.subarray(binaryOffset, binaryOffset + 0x8000));
      }
      const final = offset + chunk.length >= bytes.length;
      await this.#request('/api/avatar/session/audio', {
        sessionId: this.sessionId,
        eventId,
        final,
        pcmBase64: btoa(binary),
      });
      chunks += 1;
    }
    return { accepted: true, eventId, bytes: bytes.byteLength, chunks, final: true };
  }

  async attachAudioStream(stream) {
    if (!stream?.getReader) throw new TypeError('Avatar audio stream must be a readable byte stream.');
    const reader = stream.getReader();
    let chunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) { await this.enqueueAudio(value); chunks += 1; }
    }
    return { accepted: true, chunks };
  }

  async interrupt() {
    if (!this.sessionId) return { interrupted: false };
    return this.#request('/api/avatar/session/interrupt', { sessionId: this.sessionId });
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
    await this.#detach();
    return this.start();
  }

  health() {
    return { provider: 'liveavatar', available: this.state === 'live', state: this.state, reconnects: this.reconnects, reason: this.lastError };
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
  }

  async close() {
    try { await this.stop('closed'); }
    catch { await this.#detach(); }
  }
}
