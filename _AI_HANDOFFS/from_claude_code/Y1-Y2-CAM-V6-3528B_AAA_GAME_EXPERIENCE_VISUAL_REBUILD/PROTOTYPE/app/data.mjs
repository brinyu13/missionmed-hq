/* ============================================================
   3528B — PROTOTYPE DATA + DETERMINISTIC SIM ENGINE
   Everything here is SIMULATED and labeled as such in the UI.
   The MetricFrame shape mirrors the real projector contract
   (LIVE_METRIC_IDS: VOLUME, SPEED_WPM, VOLUME_MODULATION, PITCH,
   HEAD_FACE, BODY_HANDS) so Codex swaps in the real runtime by
   replacing SimEngine with LiveMetricProjector output only.
   ============================================================ */

/* -- question corpus (prototype subset) ------------------------ */
export const CATEGORIES = [
  { id: 'behavioral', label: 'Behavioral', icon: 'M4 17l5-10 4 7 3-4 4 7', color: '#39d6ff' },
  { id: 'motivation', label: 'Motivation', icon: 'M12 3l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3L12 16.8 6.4 20l1.4-6.3L3 9.5l6.4-.6z', color: '#ffc24b' },
  { id: 'teamwork', label: 'Teamwork', icon: 'M7 10a3 3 0 100-6 3 3 0 000 6zm10 0a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.5-5 5-5s5 2 5 5m0 0c0-3 2.5-5 5-5s5 2 5 5', color: '#2fe7b0' },
  { id: 'ethics', label: 'Ethics', icon: 'M12 3v18M5 7h14M7 7l-3 6a4 4 0 006 0zM17 7l-3 6a4 4 0 006 0z', color: '#a696ff' },
  { id: 'resilience', label: 'Resilience', icon: 'M4 14c2-6 6-9 8-9s6 3 8 9m-13 2a3 3 0 106 0 3 3 0 10-6 0', color: '#ff8d5e' },
  { id: 'fit', label: 'Program Fit', icon: 'M12 21s-7-4.6-9-9a5.2 5.2 0 019-4 5.2 5.2 0 019 4c-2 4.4-9 9-9 9z', color: '#ff6f91' },
  { id: 'self', label: 'Self-Assessment', icon: 'M12 13a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0M17 3l2 2-2 2', color: '#7fd0ff' },
];

export const QUESTIONS = [
  { id: 'q1', cat: 'behavioral', text: 'Tell me about a time you handled a difficult patient situation.', diff: 2, practiced: 3, best: 7.5, fav: true },
  { id: 'q2', cat: 'behavioral', text: 'Describe a time you received difficult feedback. What did you do?', diff: 2, practiced: 1, best: 7.0, fav: false },
  { id: 'q3', cat: 'behavioral', text: 'Tell me about a mistake you made in a clinical setting.', diff: 3, practiced: 0, best: null, fav: false },
  { id: 'q4', cat: 'motivation', text: 'Why this specialty?', diff: 1, practiced: 4, best: 8.0, fav: true },
  { id: 'q5', cat: 'motivation', text: 'Where do you see your career in ten years?', diff: 1, practiced: 0, best: null, fav: false },
  { id: 'q6', cat: 'teamwork', text: 'What would your team say about you?', diff: 1, practiced: 1, best: 7.4, fav: false },
  { id: 'q7', cat: 'teamwork', text: 'Describe a conflict with a colleague and how you resolved it.', diff: 2, practiced: 0, best: null, fav: false },
  { id: 'q8', cat: 'ethics', text: 'A colleague appears impaired on shift. What do you do?', diff: 3, practiced: 0, best: null, fav: true },
  { id: 'q9', cat: 'ethics', text: 'A patient refuses a life-saving intervention. Walk me through your thinking.', diff: 3, practiced: 1, best: 6.8, fav: false },
  { id: 'q10', cat: 'resilience', text: 'Tell me about a failure and what you learned.', diff: 2, practiced: 2, best: 7.2, fav: false },
  { id: 'q11', cat: 'resilience', text: 'How do you handle the emotional weight of medicine?', diff: 2, practiced: 0, best: null, fav: false },
  { id: 'q12', cat: 'fit', text: 'Why our program?', diff: 1, practiced: 1, best: 7.9, fav: false },
  { id: 'q13', cat: 'fit', text: 'What will you contribute to our residency community?', diff: 2, practiced: 0, best: null, fav: false },
  { id: 'q14', cat: 'self', text: 'What are your greatest strengths and weaknesses?', diff: 1, practiced: 1, best: 7.8, fav: false },
  { id: 'q15', cat: 'self', text: 'Teach me something in two minutes.', diff: 3, practiced: 0, best: null, fav: false },
];

/* -- recorded sessions (prototype library) --------------------- */
export const SESSIONS = [
  { id: 's1', title: 'Difficult patient · rep 3', qid: 'q1', mode: 'question', date: 'Aug 28 · 10:02 PM', dur: '03:04', pace: 7.5, vol: 7.6, vary: 7.1, reviewed: true },
  { id: 's2', title: 'Quick morning rep', qid: 'q4', mode: 'quick', date: 'Aug 27 · 10:02 PM', dur: '01:36', pace: 8.0, vol: 7.2, vary: 6.8, reviewed: false },
  { id: 's3', title: 'Mock block A · Q1', qid: 'q6', mode: 'mock', date: 'Aug 26 · 10:02 PM', dur: '04:03', pace: 7.1, vol: 6.9, vary: 7.4, reviewed: true },
  { id: 's4', title: 'Feedback answer polish', qid: 'q2', mode: 'question', date: 'Aug 24 · 9:41 PM', dur: '02:22', pace: 6.8, vol: 7.8, vary: 6.5, reviewed: false },
  { id: 's5', title: 'Why this specialty · rep 4', qid: 'q4', mode: 'quick', date: 'Aug 22 · 8:15 PM', dur: '01:58', pace: 7.7, vol: 7.4, vary: 7.0, reviewed: true },
];

export const STUDENT = { name: 'Dr B', role: 'Student · Internal Med', entitlement: 'IV PREP 360' };

export const CALIBRATION = {
  paceCorridor: [140, 175],
  volumeCorridorLu: [-6, 6],
  gestureCorridor: [6, 14],
};

/* -- deterministic sim (seeded — NO Math.random) --------------- */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const WORDS = ('in my third year rotation I cared for a patient who was frightened and angry about a delayed ' +
  'diagnosis I listened first before explaining anything and asked what mattered most to her that day ' +
  'we agreed on a plan together and I followed up personally every morning until discharge').split(' ');

/**
 * SimEngine — deterministic stand-in for LiveMetricProjector.
 * frame() returns a MetricFrame mirroring the real contract fields:
 *   speedWpm.wordsPerMinute       ← projector SPEED_WPM.wordsPerMinute
 *   volume.speechLufsK            ← projector VOLUME.speechLufsK
 *   volumeModulation.rangeLu      ← projector VOLUME_MODULATION.speechModulationRangeLu
 *   pitch.semitonesFromSpeakerMedian / register ← projector PITCH
 *   headFace.*  bodyHands.*       ← behavior-intelligence-runtime
 * Scores are 0–10 vs the personal corridor (7–8 ≡ inside corridor).
 */
export class SimEngine {
  constructor(seed = 3528) {
    this.rnd = lcg(seed);
    this.t = 0;
    this.state = 'LISTENING';          // LISTENING | THINKING | ANSWERING
    this.stateT = 0;
    this.wpm = 0; this.lufs = -60; this.semis = 0; this.mod = 0;
    this.nods = 0; this.smiles = 0; this.gestures = 0;
    this.handsVisible = true;
    this.facing = 96;
    this.history = [];                  // {t, vol, pitch, pace, speaking}
    this.events = [];                   // {t, kind, label}
    this.wordI = 0;
    this._lastEmit = 0;
  }

  /* advance simulation by dt seconds */
  tick(dt) {
    this.t += dt; this.stateT += dt;
    const r = this.rnd;

    // conversational state machine: interviewer asks → thinking → answering
    if (this.state === 'LISTENING' && this.stateT > 6) { this.state = 'THINKING'; this.stateT = 0; }
    else if (this.state === 'THINKING' && this.stateT > 2.4) { this.state = 'ANSWERING'; this.stateT = 0; }
    else if (this.state === 'ANSWERING' && this.stateT > 46) {
      this.state = 'LISTENING'; this.stateT = 0;
      this.events.push({ t: this.t, kind: 'answer', label: 'Answer complete' });
    }

    const speaking = this.state === 'ANSWERING';
    if (speaking) {
      const drift = Math.sin(this.t / 9) * 16 + Math.sin(this.t / 3.7) * 8;
      this.wpm += ((158 + drift) - this.wpm) * Math.min(1, dt * 2);
      this.lufs += ((-21 + Math.sin(this.t / 7) * 2.6 + (r() - .5) * 1.4) - this.lufs) * Math.min(1, dt * 2.5);
      this.semis = Math.sin(this.t / 2.6) * 2.4 + Math.sin(this.t / .9) * 1.1 + (r() - .5) * .8;
      this.mod += ((4.6 + Math.sin(this.t / 11) * 1.8) - this.mod) * Math.min(1, dt);
      this.wordI = (this.wordI + Math.max(1, Math.round(dt * this.wpm / 60))) % WORDS.length;
      if (r() < dt * .28) { this.gestures++; this.events.push({ t: this.t, kind: 'gesture', label: 'Effective gesture unit' }); }
      if (r() < dt * .06) { this.smiles++; this.events.push({ t: this.t, kind: 'smile', label: 'Qualifying full-face smile' }); }
    } else {
      this.wpm += (0 - this.wpm) * Math.min(1, dt * 3);
      this.lufs += (-58 - this.lufs) * Math.min(1, dt * 2);
      this.semis = 0;
      if (this.state === 'LISTENING' && r() < dt * .16) { this.nods++; this.events.push({ t: this.t, kind: 'nod', label: 'Listening nod' }); }
    }
    this.facing = Math.max(72, Math.min(100, this.facing + (r() - .48) * dt * 30));
    if (r() < dt * .01) this.handsVisible = !this.handsVisible;
    else if (!this.handsVisible && r() < dt * .3) this.handsVisible = true;

    // history lane @ 5 Hz
    if (this.t - this._lastEmit > .2) {
      this._lastEmit = this.t;
      this.history.push({
        t: this.t,
        vol: speaking ? Math.max(0, Math.min(1, (this.lufs + 34) / 22)) : null,
        pitch: speaking ? Math.max(0, Math.min(1, (this.semis + 6) / 12)) : null,
        pace: speaking ? Math.max(0, Math.min(1, (this.wpm - 90) / 130)) : null,
        speaking,
      });
      if (this.history.length > 3000) this.history.splice(0, 500);
    }
  }

  /* score helper: 0–10 vs corridor, 7–8 ≡ inside corridor */
  static corridorScore(v, [lo, hi], spanFactor = 1.6) {
    const mid = (lo + hi) / 2, half = (hi - lo) / 2;
    const d = Math.abs(v - mid) / (half * spanFactor);
    if (Math.abs(v - mid) <= half) return 7.5 + (1 - Math.abs(v - mid) / half) * .5;
    return Math.max(0, Math.min(10, 7.5 - (d - 1 / spanFactor) * 4.2));
  }

  frame() {
    const speaking = this.state === 'ANSWERING';
    const paceScore = speaking && this.wpm > 40 ? SimEngine.corridorScore(this.wpm, CALIBRATION.paceCorridor) : null;
    const volScore = speaking ? SimEngine.corridorScore(this.lufs, [-27, -15]) : null;
    const varyScore = speaking ? SimEngine.corridorScore(this.mod, [3.4, 6.2]) : null;
    const gestureRate = this.t > 20 ? this.gestures / (this.t / 60) : null;

    const dir = (v, [lo, hi]) => v == null ? null : v < lo ? 1 : v > hi ? -1 : 0; // 1=raise, -1=lower, 0=hold

    return {
      t: this.t,
      state: this.state,
      speaking,
      speedWpm: { available: paceScore != null, wordsPerMinute: paceScore != null ? Math.round(this.wpm) : null, score: paceScore, cue: paceScore == null ? null : dir(this.wpm, CALIBRATION.paceCorridor), holdReason: speaking ? null : 'WAITING FOR SPEECH' },
      volume: { available: volScore != null, speechLufsK: volScore != null ? +this.lufs.toFixed(1) : null, deltaLu: volScore != null ? +(this.lufs + 21).toFixed(1) : null, score: volScore, cue: volScore == null ? null : dir(this.lufs, [-27, -15]), holdReason: speaking ? null : 'WAITING FOR SPEECH' },
      volumeModulation: { available: varyScore != null, rangeLu: varyScore != null ? +this.mod.toFixed(1) : null, score: varyScore, cue: varyScore == null ? null : dir(this.mod, [3.4, 6.2]) },
      pitch: { available: speaking, semitonesFromSpeakerMedian: speaking ? +this.semis.toFixed(1) : null, register: speaking ? (this.semis <= -1.5 ? -1 : this.semis < 1.5 ? 0 : 1) : null },
      headFace: { nods: this.nods, smileEvents: this.smiles, presence: 'TRACKED', cameraFacingPct: Math.round(this.facing) },
      bodyHands: { handsVisible: this.handsVisible, gestures: this.gestures, gestureRate: gestureRate ? +gestureRate.toFixed(1) : null, inFrame: true, activity: gestureRate == null ? 'observing' : gestureRate < CALIBRATION.gestureCorridor[0] ? 'low' : gestureRate > CALIBRATION.gestureCorridor[1] ? 'high' : 'healthy' },
      currentWords: speaking ? WORDS.slice(Math.max(0, this.wordI - 6), this.wordI).join(' ') : '',
    };
  }
}

/* -- simulated studio feed (canvas-painted applicant) ---------- */
export function paintSimFeed(ctx, w, h, t, frame) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1b2333'); g.addColorStop(1, '#0e1422');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // back wall light pool
  const rg = ctx.createRadialGradient(w * .5, h * .34, 10, w * .5, h * .34, w * .5);
  rg.addColorStop(0, 'rgba(66,88,130,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const cx = w / 2 + Math.sin(t / 5) * w * .004;
  const cy = h * .58 + Math.sin(t / 3.1) * h * .006; // breathing
  const s = h / 500;
  // shoulders
  ctx.fillStyle = '#2a3450';
  ctx.beginPath();
  ctx.moveTo(cx - 150 * s, h);
  ctx.bezierCurveTo(cx - 150 * s, cy + 60 * s, cx - 70 * s, cy + 10 * s, cx, cy + 12 * s);
  ctx.bezierCurveTo(cx + 70 * s, cy + 10 * s, cx + 150 * s, cy + 60 * s, cx + 150 * s, h);
  ctx.fill();
  // collar
  ctx.fillStyle = '#3b4a6e';
  ctx.beginPath();
  ctx.moveTo(cx - 34 * s, cy + 28 * s); ctx.lineTo(cx, cy + 66 * s); ctx.lineTo(cx + 34 * s, cy + 28 * s);
  ctx.lineTo(cx + 20 * s, cy + 18 * s); ctx.lineTo(cx, cy + 40 * s); ctx.lineTo(cx - 20 * s, cy + 18 * s);
  ctx.fill();
  // head
  const hy = cy - 96 * s + Math.sin(t / 3.1) * 2 * s;
  ctx.fillStyle = '#c9a184';
  ctx.beginPath(); ctx.ellipse(cx, hy, 58 * s, 72 * s, 0, 0, 6.2832); ctx.fill();
  // hair
  ctx.fillStyle = '#241d18';
  ctx.beginPath(); ctx.ellipse(cx, hy - 34 * s, 60 * s, 44 * s, 0, Math.PI, 0); ctx.fill();
  // eyes (blink on deterministic cycle)
  const blink = (t % 4.2) > 4.05;
  ctx.fillStyle = '#1a1512';
  if (blink) {
    ctx.fillRect(cx - 34 * s, hy - 8 * s, 22 * s, 3 * s); ctx.fillRect(cx + 12 * s, hy - 8 * s, 22 * s, 3 * s);
  } else {
    ctx.beginPath(); ctx.ellipse(cx - 23 * s, hy - 7 * s, 7 * s, 9 * s, 0, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 23 * s, hy - 7 * s, 7 * s, 9 * s, 0, 0, 6.2832); ctx.fill();
  }
  // brows
  ctx.strokeStyle = '#241d18'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 34 * s, hy - 22 * s); ctx.lineTo(cx - 12 * s, hy - 24 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 12 * s, hy - 24 * s); ctx.lineTo(cx + 34 * s, hy - 22 * s); ctx.stroke();
  // nose + mouth (mouth moves while ANSWERING)
  ctx.strokeStyle = '#a87f63';
  ctx.beginPath(); ctx.moveTo(cx, hy + 4 * s); ctx.lineTo(cx - 4 * s, hy + 18 * s); ctx.stroke();
  const talking = frame && frame.speaking;
  const mo = talking ? (Math.abs(Math.sin(t * 9)) * 7 + 2) * s : 2.5 * s;
  ctx.fillStyle = '#7c4a3c';
  ctx.beginPath(); ctx.ellipse(cx, hy + 36 * s, 16 * s, mo, 0, 0, 6.2832); ctx.fill();
  // key light
  const kl = ctx.createRadialGradient(w * .3, h * .2, 10, w * .3, h * .2, w * .55);
  kl.addColorStop(0, 'rgba(255,214,150,.10)'); kl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = kl; ctx.fillRect(0, 0, w, h);
}
