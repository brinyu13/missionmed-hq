const DEFAULTS = Object.freeze({
  silenceMs: 5000,
  minimumSpeechMs: 220,
  bargeInMs: 180,
});

export class SilenceTurnDetector {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.reset();
  }

  reset(atMs = 0) {
    this.startedAtMs = atMs;
    this.speechStartedAtMs = null;
    this.lastSpeechAtMs = null;
    this.speechMs = 0;
    this.completed = false;
    this.muted = false;
    this.wasSpeaking = false;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.wasSpeaking = false;
  }

  get hasGenuineSpeech() {
    return this.speechMs >= this.options.minimumSpeechMs;
  }

  ingest({ speaking, atMs }) {
    if (this.completed || this.muted) return { completed: false, silenceMs: 0 };
    const now = Number.isFinite(atMs) ? atMs : 0;

    if (speaking) {
      if (this.speechStartedAtMs === null) this.speechStartedAtMs = now;
      if (this.lastSpeechAtMs !== null) {
        this.speechMs += Math.max(0, Math.min(250, now - this.lastSpeechAtMs));
      }
      this.lastSpeechAtMs = now;
      this.wasSpeaking = true;
      return { completed: false, silenceMs: 0, speechStarted: true };
    }

    const silenceMs = this.lastSpeechAtMs === null ? 0 : Math.max(0, now - this.lastSpeechAtMs);
    if (this.hasGenuineSpeech && silenceMs >= this.options.silenceMs) {
      this.completed = true;
      return { completed: true, silenceMs, speechMs: this.speechMs };
    }
    this.wasSpeaking = false;
    return { completed: false, silenceMs, speechMs: this.speechMs };
  }
}

export class MicController {
  constructor({
    level = () => 0,
    threshold = 0.05,
    clock = () => performance.now(),
    onTurnComplete = () => {},
    onBargeIn = () => {},
    ...detectorOptions
  } = {}) {
    this.level = level;
    this.threshold = threshold;
    this.clock = clock;
    this.onTurnComplete = onTurnComplete;
    this.onBargeIn = onBargeIn;
    this.detector = new SilenceTurnDetector(detectorOptions);
    this.listening = false;
    this.interviewerSpeaking = false;
    this.bargeInStartedAtMs = null;
    this.bargeInFired = false;
    this.lastTickAtMs = null;
  }

  start() {
    this.listening = true;
    this.lastTickAtMs = this.clock();
    this.detector.reset(this.lastTickAtMs);
  }

  stop() {
    this.listening = false;
    this.interviewerSpeaking = false;
    this.bargeInStartedAtMs = null;
    this.bargeInFired = false;
    this.lastTickAtMs = null;
  }

  resetTurn() {
    this.detector.reset(this.clock());
  }

  setMuted(muted) {
    const wasMuted = this.detector.muted;
    this.detector.setMuted(muted);
    if (wasMuted && !muted && this.detector.lastSpeechAtMs !== null) {
      this.detector.lastSpeechAtMs = this.lastTickAtMs ?? this.clock();
    }
  }

  setInterviewerSpeaking(speaking) {
    this.interviewerSpeaking = Boolean(speaking);
    if (!speaking) {
      this.bargeInStartedAtMs = null;
      this.bargeInFired = false;
    }
  }

  tick(atMs = this.clock()) {
    this.lastTickAtMs = atMs;
    if (!this.listening) return { completed: false, silenceMs: 0 };
    const speaking = Number(this.level()) > this.threshold;

    if (this.interviewerSpeaking && speaking) {
      if (this.bargeInStartedAtMs === null) this.bargeInStartedAtMs = atMs;
      if (!this.bargeInFired && atMs - this.bargeInStartedAtMs >= this.detector.options.bargeInMs) {
        this.bargeInFired = true;
        this.onBargeIn({ atMs });
      }
      return { completed: false, silenceMs: 0, bargeIn: this.bargeInFired };
    }

    if (!speaking) this.bargeInStartedAtMs = null;
    const event = this.detector.ingest({ speaking, atMs });
    if (event.completed) this.onTurnComplete(event);
    return event;
  }
}

export const MIC_CONTROLLER_DEFAULTS = DEFAULTS;
