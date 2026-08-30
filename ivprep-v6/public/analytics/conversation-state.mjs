export const CONVERSATION_STATES = Object.freeze({
  SETUP: 'SETUP',
  LISTENING: 'LISTENING',
  TRANSITION_TO_ANSWER: 'TRANSITION_TO_ANSWER',
  ANSWERING: 'ANSWERING',
  PAUSE: 'PAUSE_SHORT',
  PAUSE_SHORT: 'PAUSE_SHORT',
  PAUSE_LONG: 'PAUSE_LONG',
  NOTES: 'NOTES',
  TRANSITION_TO_LISTENING: 'TRANSITION_TO_LISTENING',
});

const TRANSITION_STATES = new Set([
  CONVERSATION_STATES.TRANSITION_TO_ANSWER,
  CONVERSATION_STATES.TRANSITION_TO_LISTENING,
]);

export class ConversationStateMachine {
  constructor({ now = () => performance.now(), degraded = false } = {}) {
    this.now = now;
    this.degraded = Boolean(degraded);
    this.reset();
  }

  reset(atMs = this.now()) {
    this.state = CONVERSATION_STATES.SETUP;
    this.enteredAtMs = Math.round(Number(atMs));
    this.history = [];
    this.userSpeaking = false;
    this.interviewerSpeaking = false;
    this.overlap = false;
    this.preNotesState = null;
    return this.snapshot();
  }

  dispatch(event, atMs = this.now(), detail = {}) {
    const time = Math.round(Number(atMs));
    if (!Number.isFinite(time) || time < this.enteredAtMs) throw new TypeError('Conversation events require monotonic timestamps.');
    const previous = this.state;
    switch (event) {
      case 'SETUP_READY':
        if (this.state === CONVERSATION_STATES.SETUP) this.#enter(CONVERSATION_STATES.LISTENING, time, event);
        break;
      case 'INTERVIEWER_SPEECH_START':
        this.interviewerSpeaking = true;
        if (this.userSpeaking) this.overlap = true;
        // Overlap is an observable property of the answering turn. Hearing the
        // interviewer while the interviewee is already speaking must not relabel
        // that interval as LISTENING.
        if (this.state !== CONVERSATION_STATES.SETUP && !this.userSpeaking) this.#enter(CONVERSATION_STATES.LISTENING, time, event);
        break;
      case 'INTERVIEWER_SPEECH_END':
        this.interviewerSpeaking = false;
        if (this.state !== CONVERSATION_STATES.SETUP) this.#enter(this.degraded ? CONVERSATION_STATES.ANSWERING : CONVERSATION_STATES.TRANSITION_TO_ANSWER, time, event);
        break;
      case 'USER_SPEECH_START':
        this.userSpeaking = true;
        if (this.interviewerSpeaking) this.overlap = true;
        if (this.state !== CONVERSATION_STATES.SETUP) this.#enter(CONVERSATION_STATES.ANSWERING, time, event);
        break;
      case 'USER_SPEECH_END':
        this.userSpeaking = false;
        if (this.state === CONVERSATION_STATES.ANSWERING) this.#enter(this.degraded ? CONVERSATION_STATES.ANSWERING : CONVERSATION_STATES.PAUSE_SHORT, time, event);
        break;
      case 'TICK':
        if (this.state === CONVERSATION_STATES.PAUSE_SHORT && time - this.enteredAtMs >= 1_000) {
          this.#enter(CONVERSATION_STATES.PAUSE_LONG, time, event);
        }
        break;
      case 'USER_SPEECH_RESUME':
        this.userSpeaking = true;
        if (this.state !== CONVERSATION_STATES.SETUP) this.#enter(CONVERSATION_STATES.ANSWERING, time, event);
        break;
      case 'ANSWER_END':
        this.userSpeaking = false;
        this.overlap = false;
        if (this.state !== CONVERSATION_STATES.SETUP) this.#enter(this.degraded ? CONVERSATION_STATES.LISTENING : CONVERSATION_STATES.TRANSITION_TO_LISTENING, time, event);
        break;
      case 'NOTES_START':
        if (this.state !== CONVERSATION_STATES.SETUP && this.state !== CONVERSATION_STATES.NOTES) {
          this.preNotesState = this.state;
          this.#enter(CONVERSATION_STATES.NOTES, time, event);
        }
        break;
      case 'NOTES_END':
        if (this.state === CONVERSATION_STATES.NOTES) {
          const restore = this.preNotesState === CONVERSATION_STATES.ANSWERING
            ? CONVERSATION_STATES.PAUSE_SHORT
            : this.preNotesState || CONVERSATION_STATES.LISTENING;
          this.preNotesState = null;
          this.#enter(restore, time, event);
        }
        break;
      case 'INTERVIEWER_TURN_READY':
        if (this.state === CONVERSATION_STATES.TRANSITION_TO_LISTENING) this.#enter(CONVERSATION_STATES.LISTENING, time, event);
        break;
      case 'RESET':
        return this.reset(time);
      default:
        throw new TypeError(`Unknown conversation event: ${event}`);
    }
    return { ...this.snapshot(), changed: previous !== this.state, detail };
  }

  #enter(next, atMs, event) {
    if (this.state === next) return;
    this.history.push(Object.freeze({ state: this.state, startMs: this.enteredAtMs, endMs: atMs, exitEvent: event }));
    if (this.history.length > 64) this.history.shift();
    this.state = next;
    this.enteredAtMs = atMs;
  }

  snapshot(atMs = this.now()) {
    const time = Math.max(this.enteredAtMs, Math.round(Number(atMs)));
    return Object.freeze({
      state: this.state,
      startMs: this.enteredAtMs,
      endMs: time,
      transition: TRANSITION_STATES.has(this.state),
      degraded: this.degraded,
      userSpeaking: this.userSpeaking,
      interviewerSpeaking: this.interviewerSpeaking,
      overlap: this.overlap,
    });
  }
}
