const START_TIMEOUT_MS = 15_000;

function transcriptEvent(event) {
  const type = String(event?.type || '');
  if (!type.includes('transcript')) return null;
  const speaker = type.includes('input') ? 'applicant' : 'interviewer';
  const final = /(?:[.]done|[.]completed)$/u.test(type)
    || (!Object.hasOwn(event, 'delta') && typeof event.transcript === 'string');
  const rawText = String(event.delta ?? event.text ?? event.transcript ?? '');
  const text = final ? rawText.trim() : rawText;
  return { speaker, final, text, type };
}

function waitForIce(peer, timeoutMs = 5_000) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      peer.removeEventListener?.('icegatheringstatechange', changed);
      resolve();
    }
    function changed() { if (peer.iceGatheringState === 'complete') done(); }
    peer.addEventListener?.('icegatheringstatechange', changed);
  });
}

/**
 * Presentation-neutral GPT-Live browser transport.
 *
 * Views supply an already-admitted microphone track and render status and
 * transcript events. Provider credentials, context hydration, authorization,
 * voice policy and canonical session ownership remain server-side.
 */
export class LiveInterviewSession {
  constructor({
    createSession,
    endSession,
    audioElement,
    PeerConnection = globalThis.RTCPeerConnection,
    onStatus = () => {},
    onTranscript = () => {},
    onEvent = () => {},
    onTelemetry = () => {},
    now = () => performance.now(),
  } = {}) {
    if (typeof createSession !== 'function' || typeof endSession !== 'function'
      || typeof PeerConnection !== 'function') throw new TypeError('Live interview dependencies are required.');
    this.createSession = createSession;
    this.endSession = endSession;
    this.audioElement = audioElement;
    this.PeerConnection = PeerConnection;
    this.onStatus = onStatus;
    this.onTranscript = onTranscript;
    this.onEvent = onEvent;
    this.onTelemetry = onTelemetry;
    this.now = now;
    this.peer = null;
    this.channel = null;
    this.sessionId = null;
    this.state = 'idle';
    this.startedResolve = null;
    this.startedReject = null;
    this.startTimer = null;
    this.startedAtMs = null;
    this.transcriptSequence = 0;
    this.activeTranscriptIds = { applicant: null, interviewer: null };
    this.audioAuthority = null;
    this.remoteAudioTrackId = null;
  }

  emitStatus(state, detail = null) {
    this.state = state;
    this.onStatus(Object.freeze({ state, detail }));
  }

  emitTelemetry(state) {
    const event = Object.freeze({
      schema: 'ivoc.audio-authority.event.v1',
      authority: 'openai-gpt-live-native',
      mode: 'single',
      state,
      observedAtMs: this.startedAtMs == null ? 0 : Math.max(0, Math.round(this.now() - this.startedAtMs)),
    });
    this.onTelemetry(event);
    return event;
  }

  diagnostics() {
    return Object.freeze({
      schema: 'ivoc.audio-authority.v1',
      mode: 'single',
      authority: 'openai-gpt-live-native',
      state: this.audioAuthority || 'idle',
      remoteTrackBound: Boolean(this.remoteAudioTrackId),
    });
  }

  handleEvent(raw) {
    let event;
    try { event = JSON.parse(typeof raw === 'string' ? raw : raw?.data || '{}'); }
    catch { return; }
    this.onEvent(event);
    if (event.type === 'session.started') {
      clearTimeout(this.startTimer);
      this.startedResolve?.(event);
      this.startedResolve = null;
      this.startedReject = null;
      this.emitStatus('active', 'InterviewBrain is listening');
      return;
    }
    if (event.type === 'session.closed') {
      this.emitStatus('closed', event.reason || 'Provider closed the session');
      return;
    }
    if (event.type === 'error') {
      this.emitStatus('error', event.error?.message || 'InterviewBrain reported an error');
      return;
    }
    const transcript = transcriptEvent(event);
    if (transcript) {
      const providerIdentity = event.item_id || event.item?.id || event.response_id || event.response?.id || null;
      const identity = providerIdentity || this.activeTranscriptIds[transcript.speaker]
        || `local:${transcript.speaker}:${++this.transcriptSequence}`;
      this.activeTranscriptIds[transcript.speaker] = identity;
      const observedAtMs = this.startedAtMs == null ? 0 : Math.max(0, Math.round(this.now() - this.startedAtMs));
      if (transcript.text.trim() || transcript.final) {
        this.onTranscript(Object.freeze({
          ...transcript,
          identity,
          observedAtMs,
          responseId: event.response_id || event.response?.id || null,
          itemId: event.item_id || event.item?.id || null,
        }));
      }
      if (transcript.final) this.activeTranscriptIds[transcript.speaker] = null;
    }
  }

  async start({ audioTrack, voice = 'marin', context, ivocSessionId } = {}) {
    if (this.state !== 'idle' && this.state !== 'closed') throw new Error('A live interview is already active.');
    if (!audioTrack || audioTrack.kind !== 'audio' || audioTrack.readyState === 'ended') {
      throw new TypeError('A live microphone track is required.');
    }
    this.emitStatus('connecting', 'Creating a secure WebRTC session');
    this.startedAtMs = this.now();
    this.transcriptSequence = 0;
    this.activeTranscriptIds = { applicant: null, interviewer: null };
    this.audioAuthority = 'configured';
    this.remoteAudioTrackId = null;
    this.emitTelemetry('configured');
    const peer = new this.PeerConnection();
    this.peer = peer;
    peer.addTrack(audioTrack);
    peer.ontrack = (event) => {
      const track = event.track;
      const trackId = String(track?.id || 'provider-audio').slice(0, 160);
      if (this.remoteAudioTrackId && this.remoteAudioTrackId !== trackId) {
        track?.stop?.();
        this.emitTelemetry('surplus_rejected');
        return;
      }
      if (this.remoteAudioTrackId === trackId) return;
      this.remoteAudioTrackId = trackId;
      this.audioAuthority = 'bound';
      this.emitTelemetry('bound');
      if (!this.audioElement) return;
      const stream = event.streams?.[0] || new MediaStream([track]);
      this.audioElement.srcObject = stream;
      void this.audioElement.play?.().catch?.(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        this.emitStatus('error', `WebRTC ${peer.connectionState}`);
      }
    };
    const channel = peer.createDataChannel('oai-events');
    this.channel = channel;
    channel.onmessage = (event) => this.handleEvent(event);
    const started = new Promise((resolve, reject) => {
      this.startedResolve = resolve;
      this.startedReject = reject;
      this.startTimer = setTimeout(() => reject(new Error('InterviewBrain did not start in time.')), START_TIMEOUT_MS);
    });
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIce(peer);
      const created = await this.createSession({
        sdp: peer.localDescription?.sdp || offer.sdp,
        voice,
        context,
        ivocSessionId,
      });
      this.sessionId = created.session.id;
      if (created.audioAuthority?.mode !== 'single'
          || created.audioAuthority?.authority !== 'openai-gpt-live-native') {
        throw new Error('InterviewBrain audio authority is invalid.');
      }
      await peer.setRemoteDescription({ type: 'answer', sdp: created.transport.sdp });
      await started;
      return Object.freeze({ id: this.sessionId, model: created.session.model, audioAuthority: this.diagnostics() });
    } catch (error) {
      clearTimeout(this.startTimer);
      this.startedResolve = null;
      this.startedReject = null;
      await this.stop({ notifyServer: Boolean(this.sessionId) });
      this.emitStatus('error', String(error?.message || error));
      throw error;
    }
  }

  async stop({ notifyServer = true, keepalive = false } = {}) {
    const id = this.sessionId;
    this.sessionId = null;
    clearTimeout(this.startTimer);
    try {
      if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify({ type: 'session.close' }));
    } catch { /* server hangup below remains authoritative */ }
    try { this.channel?.close?.(); } catch {}
    try { this.peer?.close?.(); } catch {}
    this.channel = null;
    this.peer = null;
    if (this.audioAuthority) this.emitTelemetry('released');
    this.audioAuthority = 'released';
    this.remoteAudioTrackId = null;
    if (this.audioElement) {
      this.audioElement.pause?.();
      this.audioElement.srcObject = null;
    }
    if (notifyServer && id) await this.endSession(id, { keepalive });
    this.startedAtMs = null;
    this.emitStatus('closed', 'Interview ended');
    return Object.freeze({ ok: true });
  }
}
