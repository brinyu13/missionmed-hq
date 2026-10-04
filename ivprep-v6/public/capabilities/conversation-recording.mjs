function liveTracks(stream, kind) {
  const tracks = kind === 'audio' ? stream?.getAudioTracks?.() : stream?.getVideoTracks?.();
  return (tracks || []).filter((track) => track?.kind === kind && track.readyState !== 'ended');
}

/**
 * Presentation-neutral recording tap for an AI conversation.
 *
 * The returned stream contains the candidate video plus one Web Audio mix track.
 * Candidate microphone and the authoritative remote interviewer track feed that
 * mix, but the mix is never connected to speakers. The existing interviewer
 * audio element therefore remains the one and only audible authority.
 */
export class ConversationRecordingMix {
  constructor({ candidateStream, audioContext, MediaStreamCtor = globalThis.MediaStream, retainCandidateAudio = false } = {}) {
    if (!candidateStream || !audioContext || typeof MediaStreamCtor !== 'function'
        || typeof audioContext.createMediaStreamSource !== 'function'
        || typeof audioContext.createMediaStreamDestination !== 'function') {
      throw new TypeError('Conversation recording dependencies are required.');
    }
    const candidateAudio = liveTracks(candidateStream, 'audio');
    const candidateVideo = liveTracks(candidateStream, 'video');
    if (candidateAudio.length !== 1 || candidateVideo.length < 1) {
      throw new TypeError('A live candidate camera and microphone are required.');
    }
    this.audioContext = audioContext;
    this.MediaStreamCtor = MediaStreamCtor;
    this.destination = audioContext.createMediaStreamDestination();
    const mixedAudio = liveTracks(this.destination.stream, 'audio');
    if (mixedAudio.length !== 1) throw new Error('Conversation recording mix is unavailable.');
    this.candidateSource = audioContext.createMediaStreamSource(new MediaStreamCtor(candidateAudio));
    this.candidateSource.connect(this.destination);
    this.candidateTrack = candidateAudio[0];
    this.candidateDestination = null;
    this.candidateAudioStream = null;
    this.candidateReplacement = null;
    if (retainCandidateAudio) {
      try {
        this.candidateDestination = audioContext.createMediaStreamDestination();
        const audio = liveTracks(this.candidateDestination.stream, 'audio');
        if (audio.length !== 1) throw new Error('Candidate recording tap is unavailable.');
        this.candidateSource.connect(this.candidateDestination);
        this.candidateAudioStream = new MediaStreamCtor(audio);
      } catch (error) {
        this.candidateSource.disconnect();
        for (const destination of [this.destination, this.candidateDestination]) {
          for (const track of destination?.stream?.getTracks?.() || []) track.stop?.();
        }
        throw error;
      }
    }
    this.remoteSource = null;
    this.remoteTrackId = null;
    this.stream = new MediaStreamCtor([...candidateVideo, mixedAudio[0]]);
    this.destroyed = false;
  }

  // Prepare a silent input only. Output tracks never change while MediaRecorder
  // is active; the optional candidate-only tap cannot receive interviewer audio.
  prepareCandidateMicrophone(track) {
    if (this.destroyed || this.candidateReplacement) throw new Error('Recording microphone replacement is unavailable.');
    if (track?.kind !== 'audio' || track.readyState !== 'live' || track.enabled === false || track.muted === true) {
      throw new TypeError('A usable microphone track is required.');
    }
    const previous = this.candidateSource, previousTrack = this.candidateTrack;
    const source = this.audioContext.createMediaStreamSource(new this.MediaStreamCtor([track]));
    const pending = {source, previous, state:'prepared'};
    this.candidateReplacement = pending;
    const connect = node => {
      node.connect(this.destination);
      if (this.candidateDestination) node.connect(this.candidateDestination);
    };
    return Object.freeze({
      commit: () => {
        if (this.destroyed || this.candidateReplacement !== pending || pending.state !== 'prepared') throw new Error('Recording microphone replacement was cancelled.');
        if (track.readyState !== 'live' || track.enabled === false || track.muted === true) throw new Error('The replacement microphone is no longer usable.');
        // If the second connection fails, the still-connected original remains.
        try { connect(source); } catch (error) { source.disconnect(); throw error; }
        previous.disconnect();this.candidateSource = source;this.candidateTrack = track;pending.state = 'committed';
      },
      rollback: () => {
        if (this.destroyed || this.candidateReplacement !== pending) return false;
        source.disconnect();
        if (pending.state === 'committed') {
          connect(previous);this.candidateSource = previous;this.candidateTrack = previousTrack;
        }
        pending.state = 'rolled_back';this.candidateReplacement = null;return true;
      },
      complete: () => {
        // Non-mutating validation: another participant may still reject the
        // transaction. Retain rollback ownership until every check succeeds.
        if (this.destroyed || this.candidateReplacement !== pending || pending.state !== 'committed') throw new Error('Recording microphone replacement is not committed.');
        return true;
      },
      release: () => {
        // Terminal, no-throw bookkeeping only, after capture publication.
        if (this.candidateReplacement !== pending || pending.state !== 'committed') return false;
        pending.state = 'complete';this.candidateReplacement = null;return true;
      },
    });
  }

  attachAuthoritativeAudio(stream) {
    if (this.destroyed) throw new Error('Conversation recording mix is closed.');
    const tracks = liveTracks(stream, 'audio');
    if (tracks.length !== 1) throw new TypeError('One authoritative interviewer audio track is required.');
    const track = tracks[0];
    const trackId = String(track.id || 'provider-audio').slice(0, 160);
    if (this.remoteTrackId === trackId) return false;
    if (this.remoteTrackId) throw new Error('A second interviewer audio authority was rejected.');
    const source = this.audioContext.createMediaStreamSource(new this.MediaStreamCtor([track]));
    source.connect(this.destination);
    this.remoteSource = source;
    this.remoteTrackId = trackId;
    return true;
  }

  diagnostics() {
    return Object.freeze({
      schema: 'ivoc.conversation-recording-mix.v1',
      candidateAudio: true,
      candidateVideo: true,
      interviewerAudio: Boolean(this.remoteTrackId),
      audibleOutputs: 0,
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.candidateSource?.disconnect?.(); } catch {}
    for (const source of [this.candidateReplacement?.source, this.candidateReplacement?.previous]) {
      try { source?.disconnect?.(); } catch {}
    }
    this.candidateReplacement = null;
    try { this.remoteSource?.disconnect?.(); } catch {}
    for (const destination of [this.destination, this.candidateDestination]) {
      for (const track of destination?.stream?.getTracks?.() || []) track.stop?.();
    }
    this.remoteSource = null;
    this.remoteTrackId = null;
  }
}

export function createConversationRecordingMix(options) {
  return new ConversationRecordingMix(options);
}
