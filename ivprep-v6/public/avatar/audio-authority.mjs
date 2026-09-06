export const INTERVIEWER_AUDIO_AUTHORITIES = Object.freeze({
  LIVEAVATAR_LIVEKIT: 'liveavatar-livekit',
  OPENAI_REALTIME_DIRECT: 'openai-realtime-direct',
  BROWSER_OPENAI_SPEECH: 'browser-openai-speech',
});

export class InterviewerAudioAuthority {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.active = null;
    this.history = [];
  }

  begin({ authority, utteranceId }) {
    if (!Object.values(INTERVIEWER_AUDIO_AUTHORITIES).includes(authority)) throw new TypeError('Unknown interviewer audio authority.');
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
    return { active: this.active ? { ...this.active } : null, completedStreams: this.history.length, duplicateAudioPrevented: true };
  }

  evidence() {
    return {
      activeAuthority: this.active?.authority || null,
      completedStreams: this.history.length,
      duplicateAudioPrevented: true,
      history: this.history.map(({ authority, startedAt, endedAt, reason }) => ({ authority, startedAt, endedAt, reason })),
    };
  }
}
