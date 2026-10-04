const START_TIMEOUT_MS = 15_000;
const OVERALL_START_TIMEOUT_MS = 90_000;

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
    this.microphoneSender = null;
    this.microphoneReplacement = null;
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
    this.closingRequested = false;
    this.handledDelegations = new Set();
    this.startGeneration = 0;
    this.cancelStart = null;
    this.overallStartTimer = null;
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
    if (event.type === 'session.delegation.created') {
      const delegation = event.delegation;
      if (this.state !== 'active' || this.channel?.readyState !== 'open'
        || delegation?.target !== 'client' || !/^[A-Za-z0-9_-]{1,160}$/.test(delegation.id || '')
        || this.handledDelegations.has(delegation.id)) return;
      // No owner lookup or reasoning backend is wired to this speech adapter.
      // Return that actual limitation instead of leaving a provider request pending.
      try { this.channel.send(JSON.stringify({
        type: 'session.instructions.append', event_id: 'ivoc-context-limit-' + delegation.id,
        delegation_id: delegation.id,
        content: 'The application has no additional lookup or backend result for this request. Respond now using only the authorized context already supplied. If the needed fact is missing, say that you do not have verified information about it; do not invent program policy or promise further checking. Then invite the candidate to continue or ask their next question. Preserve the current interview phase and do not restart the question pool.',
      })); } catch {
        this.emitStatus('active', 'The interviewer could not receive the context update. Please repeat your question.');
        return;
      }
      this.handledDelegations.add(delegation.id);
      if (this.handledDelegations.size > 64) this.handledDelegations.delete(this.handledDelegations.values().next().value);
      return;
    }
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

  requestClosing(content) {
    if (this.closingRequested) return false;
    if (this.state !== 'active' || this.channel?.readyState !== 'open') throw new Error('The interviewer is not connected. You can still finish and save.');
    if (typeof content !== 'string' || content.length > 1800) throw new TypeError('A bounded closing instruction is required.');
    this.channel.send(JSON.stringify({ type: 'session.instructions.append', event_id: 'ivoc-candidate-questions', delegation_id: null, content }));
    this.closingRequested = true;
    // Receipt is not audible delivery. Recording continues until Finish.
    return true;
  }

  // Input replacement does not create a provider session, audible output, new
  // transcript owner or generation. The capture owner stops the old track only
  // after recording and analytics consumers have also committed.
  async prepareMicrophoneReplacement(track, {isCurrent = () => true} = {}) {
    if (track?.kind !== 'audio' || track.readyState !== 'live' || track.enabled === false || track.muted === true) throw new TypeError('A usable microphone track is required.');
    const peer = this.peer, sender = this.microphoneSender, generation = this.startGeneration;
    if (this.state !== 'active' || !peer || !sender?.replaceTrack || this.microphoneReplacement) throw new Error('Interview microphone replacement is unavailable.');
    const previous = sender.track;
    if (!previous || previous.readyState !== 'live') throw new Error('The current interview microphone is unavailable.');
    const pending = {state:'preparing'};
    this.microphoneReplacement = pending;
    const owned = () => this.peer === peer && this.microphoneSender === sender && this.startGeneration === generation && this.state === 'active' && this.microphoneReplacement === pending;
    const rollback = async () => {
      // stop() invalidates ownership synchronously; never put input back on a
      // closed peer after an awaited replaceTrack resolves late.
      if (!owned()) return false;
      if (sender.track !== previous) await sender.replaceTrack(previous);
      if (this.microphoneReplacement === pending) this.microphoneReplacement = null;
      pending.state = 'rolled_back';return true;
    };
    try {
      if (!isCurrent()) throw new Error('Interview microphone replacement was cancelled.');
      await sender.replaceTrack(track);
      if (!owned() || !isCurrent()) throw new Error('Interview microphone replacement was cancelled.');
      if (track.readyState !== 'live' || track.enabled === false || track.muted === true) throw new Error('The replacement microphone is no longer usable.');
      pending.state = 'prepared';
      return Object.freeze({
        commit: () => {
          if (!owned() || !isCurrent() || pending.state !== 'prepared' || sender.track !== track) throw new Error('Interview microphone replacement was cancelled.');
          pending.state = 'committed';
        },
        rollback,
        complete: () => {
          if (!owned() || !isCurrent() || pending.state !== 'committed') throw new Error('Interview microphone replacement was cancelled.');
          return true;
        },
        release: () => {
          // No provider/audio action, and no throw after irreversible capture
          // retirement. All fallible validation happens in complete().
          if (this.microphoneReplacement !== pending || pending.state !== 'committed') return false;
          this.microphoneReplacement = null;pending.state = 'complete';return true;
        },
      });
    } catch (error) { await rollback();throw error; }
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
    this.closingRequested = false;
    this.handledDelegations.clear();
    if (!this.openingQuestion || this.openingQuestion.length > 1_000) {
      throw new TypeError('A bounded opening question is required.');
    }
    this.openingRequested = false;
    this.audioAuthority = 'configured';
    this.remoteAudioTrackId = null;
    this.emitTelemetry('configured');
    const peer = new this.PeerConnection();
    this.peer = peer;
    const generation = ++this.startGeneration;
    const current = () => this.startGeneration === generation && this.peer === peer;
    this.microphoneSender = peer.addTrack(audioTrack);
    const audioBound = new Promise((resolve, reject) => {
      this.audioBoundResolve = resolve;
      this.audioBoundReject = reject;
    });
    // Observe rejection immediately even while ICE/server custody is pending.
    audioBound.catch(() => {});
    peer.ontrack = async (event) => {
      const track = event.track;
      if (!current()) { track?.stop?.(); return; }
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
        if (!current()) return;
        await this.onAuthoritativeAudioStream(stream);
        if (!current()) return;
        this.audioAuthority = 'bound';
        this.emitTelemetry('bound');
        clearTimeout(this.audioBoundTimer);
        this.audioBoundResolve?.(stream);
        this.audioBoundResolve = null;
        this.audioBoundReject = null;
      } catch (error) {
        if (!current()) return;
        this.remoteAudioTrackId = null;
        clearTimeout(this.audioBoundTimer);
        this.audioBoundReject?.(error);
        this.audioBoundResolve = null;
        this.audioBoundReject = null;
        this.emitStatus('error', String(error?.message || error));
      }
    };
    peer.onconnectionstatechange = () => {
      if (!current()) return;
      if (['failed', 'disconnected'].includes(peer.connectionState)) {
        this.emitStatus('error', `WebRTC ${peer.connectionState}`);
      }
    };
    const channel = peer.createDataChannel('oai-events');
    this.channel = channel;
    channel.onmessage = (event) => { if (current()) this.handleEvent(event); };
    const started = new Promise((resolve, reject) => {
      this.startedResolve = resolve;
      this.startedReject = reject;
    });
    started.catch(() => {});
    const cancelled = new Promise((_, reject) => {
      this.cancelStart = reject;
      this.overallStartTimer = setTimeout(() => reject(new Error('InterviewBrain startup did not finish in time.')), OVERALL_START_TIMEOUT_MS);
    });
    // Retain the returned provider identity even if cancellation wins the
    // awaiting race. Once published, normal stop owns cleanup instead.
    let returnedId = null, published = false, lateCleanup = null;
    const cleanupLate = () => {
      if (!returnedId || published) return Promise.resolve();
      return lateCleanup ||= Promise.resolve().then(() => this.endSession(returnedId, { keepalive: true }));
    };
    cancelled.catch(() => cleanupLate()).catch(() => {});
    const step = value => Promise.race([value, cancelled]);
    try {
      const offer = await step(peer.createOffer());
      await step(peer.setLocalDescription(offer));
      await step(waitForIce(peer));
      if (!current()) throw new Error('InterviewBrain startup was stopped.');
      const creating = Promise.resolve(this.createSession({
        sdp: peer.localDescription?.sdp || offer.sdp,
        voice,
        context,
        ivocSessionId,
      })).then(async created => {
        returnedId = created?.session?.id || null;
        if (!current()) {
          // Cancellation cannot abort server creation; hang up only its exact
          // late returned identity, without rebinding any browser media.
          await cleanupLate();
          throw new Error('InterviewBrain startup was stopped.');
        }
        return created;
      });
      creating.catch(() => {});
      const created = await step(creating);
      if (!current()) {
        await cleanupLate();
        throw new Error('InterviewBrain startup was stopped.');
      }
      this.sessionId = created.session.id;
      published = true;
      if (created.audioAuthority?.mode !== 'single'
          || created.audioAuthority?.authority !== 'openai-gpt-live-native') {
        throw new Error('InterviewBrain audio authority is invalid.');
      }
      // These are negotiation/media deadlines, not server-create deadlines.
      if (this.startedReject) this.startTimer = setTimeout(() => this.startedReject?.(new Error('InterviewBrain did not start in time.')), START_TIMEOUT_MS);
      if (this.audioBoundReject) this.audioBoundTimer = setTimeout(() => this.audioBoundReject?.(new Error('InterviewBrain audio did not bind in time.')), START_TIMEOUT_MS);
      await step(peer.setRemoteDescription({ type: 'answer', sdp: created.transport.sdp }));
      await step(Promise.all([started, audioBound]));
      if (!current()) throw new Error('InterviewBrain startup was stopped.');
      clearTimeout(this.overallStartTimer);
      this.requestOpening(this.openingQuestion);
      return Object.freeze({ id: this.sessionId, model: created.session.model, audioAuthority: this.diagnostics() });
    } catch (error) {
      if (!current()) { await cleanupLate(); throw error; }
      clearTimeout(this.startTimer);
      clearTimeout(this.audioBoundTimer);
      this.startedResolve = null;
      this.startedReject = null;
      await this.stop({ notifyServer: Boolean(this.sessionId) });
      if (this.startGeneration === generation + 1) this.emitStatus('error', String(error?.message || error));
      throw error;
    }
  }

  async stop({ notifyServer = true, keepalive = false } = {}) {
    const generation = ++this.startGeneration;
    this.cancelStart?.(new Error('InterviewBrain startup was stopped.'));
    this.cancelStart = null;
    clearTimeout(this.overallStartTimer);
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
    this.microphoneSender = null;
    this.microphoneReplacement = null;
    if (this.audioAuthority) this.emitTelemetry('released');
    this.audioAuthority = 'released';
    this.remoteAudioTrackId = null;
    if (this.audioElement) {
      this.audioElement.pause?.();
      this.audioElement.srcObject = null;
    }
    this.startedAtMs = null;
    this.openingQuestion = null;
    this.openingRequested = false;
    if (notifyServer && id) await this.endSession(id, { keepalive });
    if (this.startGeneration === generation) this.emitStatus('closed', 'Interview ended');
    return Object.freeze({ ok: true });
  }
}
