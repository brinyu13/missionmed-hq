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
    onAuthoritativeAudioStream = () => {},
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
    this.onAuthoritativeAudioStream = onAuthoritativeAudioStream;
    this.now = now;
    this.peer = null;
    this.channel = null;
    this.sessionId = null;
    this.state = 'idle';
    this.startedResolve = null;
    this.startedReject = null;
    this.startTimer = null;
    this.audioBoundTimer = null;
    this.audioBoundResolve = null;
    this.audioBoundReject = null;
    this.startedAtMs = null;
    this.transcriptSequence = 0;
    this.activeTranscriptIds = { applicant: null, interviewer: null };
    this.audioAuthority = null;
    this.remoteAudioTrackId = null;
    this.openingQuestion = null;
    this.openingRequested = false;
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

  requestOpening(question) {
    const text = String(question || '').trim();
    if (!text || text.length > 1_000) throw new TypeError('A bounded opening question is required.');
    if (this.openingRequested) return false;
    if (this.channel?.readyState !== 'open') throw new Error('InterviewBrain event channel is not ready.');
    this.channel.send(JSON.stringify({
      event_id: 'ivoc-opening-question',
      type: 'session.instructions.append',
      delegation_id: null,
      content: `Ask this opening interview question now, naturally, without waiting for the applicant to speak, without adding a preamble or a second question, then pause and listen: ${JSON.stringify(text)}`,
    }));
    this.openingRequested = true;
    return true;
  }

  async start({ audioTrack, voice = 'marin', context, ivocSessionId, openingQuestion } = {}) {
    if (this.state !== 'idle' && this.state !== 'closed') throw new Error('A live interview is already active.');
    if (!audioTrack || audioTrack.kind !== 'audio' || audioTrack.readyState === 'ended') {
      throw new TypeError('A live microphone track is required.');
    }
    this.emitStatus('connecting', 'Creating a secure WebRTC session');
    this.startedAtMs = this.now();
    this.transcriptSequence = 0;
    this.activeTranscriptIds = { applicant: null, interviewer: null };
    this.openingQuestion = String(openingQuestion || '').trim();
    if (!this.openingQuestion || this.openingQuestion.length > 1_000) {
      throw new TypeError('A bounded opening question is required.');
    }
    this.openingRequested = false;
    this.audioAuthority = 'configured';
    this.remoteAudioTrackId = null;
    this.emitTelemetry('configured');
    const peer = new this.PeerConnection();
    this.peer = peer;
    peer.addTrack(audioTrack);
    const audioBound = new Promise((resolve, reject) => {
      this.audioBoundResolve = resolve;
      this.audioBoundReject = reject;
      this.audioBoundTimer = setTimeout(() => reject(new Error('InterviewBrain audio did not bind in time.')), START_TIMEOUT_MS);
    });
    peer.ontrack = async (event) => {
      const track = event.track;
      if (track?.kind && track.kind !== 'audio') {
        track.stop?.();
        return;
      }
      const trackId = String(track?.id || 'provider-audio').slice(0, 160);
      if (this.remoteAudioTrackId && this.remoteAudioTrackId !== trackId) {
        track?.stop?.();
        this.emitTelemetry('surplus_rejected');
        return;
      }
      if (this.remoteAudioTrackId === trackId) return;
      this.remoteAudioTrackId = trackId;
      const stream = event.streams?.[0] || new MediaStream([track]);
      try {
        if (!this.audioElement) throw new Error('Interviewer playback surface is unavailable.');
        this.audioElement.srcObject = stream;
        await this.audioElement.play?.();
        await this.onAuthoritativeAudioStream(stream);
        this.audioAuthority = 'bound';
        this.emitTelemetry('bound');
        clearTimeout(this.audioBoundTimer);
        this.audioBoundResolve?.(stream);
        this.audioBoundResolve = null;
        this.audioBoundReject = null;
      } catch (error) {
        this.remoteAudioTrackId = null;
        clearTimeout(this.audioBoundTimer);
        this.audioBoundReject?.(error);
        this.audioBoundResolve = null;
        this.audioBoundReject = null;
        this.emitStatus('error', String(error?.message || error));
      }
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
      await Promise.all([started, audioBound]);
      this.requestOpening(this.openingQuestion);
      return Object.freeze({ id: this.sessionId, model: created.session.model, audioAuthority: this.diagnostics() });
    } catch (error) {
      clearTimeout(this.startTimer);
      clearTimeout(this.audioBoundTimer);
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
    clearTimeout(this.audioBoundTimer);
    this.audioBoundResolve = null;
    this.audioBoundReject = null;
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
    this.openingQuestion = null;
    this.openingRequested = false;
    this.emitStatus('closed', 'Interview ended');
    return Object.freeze({ ok: true });
  }
}
