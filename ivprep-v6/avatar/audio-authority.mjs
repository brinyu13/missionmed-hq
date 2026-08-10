export const INTERVIEWER_AUDIO_AUTHORITIES = Object.freeze({
  LIVEAVATAR_LIVEKIT: 'liveavatar-livekit',
  OPENAI_REALTIME_DIRECT: 'openai-realtime-direct',
  BROWSER_OPENAI_SPEECH: 'browser-openai-speech',
});

export function selectInterviewerAudioAuthority({ railId, avatarRequested, avatarConnected } = {}) {
  if (railId === 'openai-realtime-continuous') {
    return Object.freeze({
      authority: INTERVIEWER_AUDIO_AUTHORITIES.OPENAI_REALTIME_DIRECT,
      avatarActive: false,
      reason: 'The accepted Realtime rail owns direct playback until the unified V6 ticket supplies an output-audio sink.',
    });
  }
  if (avatarRequested && avatarConnected) {
    return Object.freeze({
      authority: INTERVIEWER_AUDIO_AUTHORITIES.LIVEAVATAR_LIVEKIT,
      avatarActive: true,
      reason: 'LiveAvatar LiveKit publishes the synchronized interviewer audio and video.',
    });
  }
  return Object.freeze({
    authority: INTERVIEWER_AUDIO_AUTHORITIES.BROWSER_OPENAI_SPEECH,
    avatarActive: false,
    reason: 'The browser plays the existing OpenAI Speech fallback and no avatar media is presented as live.',
  });
}

export class InterviewerAudioAuthority {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.active = null;
    this.history = [];
  }

  begin({ authority, utteranceId }) {
    if (!Object.values(INTERVIEWER_AUDIO_AUTHORITIES).includes(authority)) {
      throw new TypeError('Unknown interviewer audio authority.');
    }
    if (!utteranceId) throw new TypeError('An interviewer utterance ID is required.');
    if (this.active) throw new Error('An audible interviewer stream is already active.');
    this.active = { authority, utteranceId, startedAt: this.now() };
    return { ...this.active };
  }

  finish({ reason = 'complete' } = {}) {
    if (!this.active) return null;
    const record = { ...this.active, endedAt: this.now(), reason };
    this.history.push(record);
    this.active = null;
    return record;
  }

  interrupt() {
    return this.finish({ reason: 'interrupted' });
  }

  health() {
    return {
      active: this.active ? { ...this.active } : null,
      completedStreams: this.history.length,
      duplicateAudioPrevented: true,
    };
  }
}
