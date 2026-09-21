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
  constructor({ candidateStream, audioContext, MediaStreamCtor = globalThis.MediaStream } = {}) {
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
    this.remoteSource = null;
    this.remoteTrackId = null;
    this.stream = new MediaStreamCtor([...candidateVideo, mixedAudio[0]]);
    this.destroyed = false;
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
    try { this.remoteSource?.disconnect?.(); } catch {}
    for (const track of this.destination?.stream?.getTracks?.() || []) track.stop?.();
    this.remoteSource = null;
    this.remoteTrackId = null;
  }
}

export function createConversationRecordingMix(options) {
  return new ConversationRecordingMix(options);
}
