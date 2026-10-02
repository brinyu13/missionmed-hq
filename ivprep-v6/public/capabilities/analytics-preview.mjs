// A bounded, local-only epoch. No recorder, account or provider calls.
export class AnalyticsPreview {
  constructor({ analytics, canStart = () => true, onState = () => {},
    setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimer = id => globalThis.clearTimeout(id) }) {
    this.canStart = canStart;
    this.analytics = analytics; this.onState = onState; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.active = false; this.timer = null;
    this.baselineTimer = null;
  }
  start(videoElement) {
    if (this.active || !this.canStart()) return false;
    this.analytics.beginAnswer({ videoElement });
    this.active = true;
    this.analytics.beginFaceBaseline?.();
    this.onState('measuring');
    this.baselineTimer = this.setTimer(() => {
      if (!this.active) return;
      this.analytics.endFaceBaseline?.();
      this.onState('exploring');
    }, 5000);
    this.timer = this.setTimer(() => this.stop('complete'), 30_000);
    return true;
  }
  stop(reason = 'stopped') {
    if (!this.active) return false;
    this.clearTimer(this.timer); this.timer = null;
    this.clearTimer(this.baselineTimer); this.baselineTimer = null;
    this.active = false;
    this.analytics.endFaceBaseline?.();
    this.analytics.abandonAnswer('preflight_' + reason);
    this.onState(reason);
    return true;
  }
}
