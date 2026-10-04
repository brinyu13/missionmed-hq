// Live instrument rails. Consumes cockpit frames (3528C mapFrame shape) at a 1 Hz display
// clock with hold-last-valid rules. LEFT = teaching rail (observability grammar: lit = tracked,
// dim = not tracked, pulse = activity, amber only when the single active correction says so,
// red = hardware fault only). RIGHT = voice rail on one 0–10 grammar (corridor ≡ 7–8).
// Never synthesises a value: an unavailable producer shows the literal reason.

const FACE_ART = '/iv-prep-on-call/assets/ivoc-standalone/assets/founder-face-scanner.png';
const BODY_ART = '/iv-prep-on-call/assets/ivoc-standalone/assets/founder-body-scanner.png';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const human = (reason) => String(reason || 'unavailable').toLowerCase().replace(/[_·]+/g, ' ').replace(/\s+/g, ' ').trim();
const ticks = (n) => `<span class="ticks">${'<i></i>'.repeat(Math.min(12, Math.max(0, n)))}</span>`;

export function pitchRailState(frame={}){
  const pitch=frame.pitch||{};
  if(frame.speaking!==true)return {label:'Listening',tone:'hold'};
  if(pitch.available!==true)return {label:'Unavailable',tone:'hold'};
  if(pitch.voiced!==true)return {label:'Unvoiced',tone:'hold'};
  if(pitch.referenceBasis!=='FIXED_PERSONAL_CALIBRATION_MEDIAN')return {label:'Calibrate',tone:'hold'};
  if(pitch.coachingAvailable!==true)return {label:'Awaiting evidence',tone:'hold'};
  if(['pitch-high','pitch-low'].includes(frame.cue?.id))return {label:'Toward your range',tone:'adj'};
  return {label:'Personal range',tone:'hold'};
}

export function leftRailMarkup() {
  return `
  <div class="correction" id="correction" data-state="idle" aria-live="polite">
    <span class="glyph">·</span>
    <div><strong>Watching</strong><small>One correction at a time. Nothing to change yet.</small></div>
  </div>
  <section class="plate" aria-label="Head and face teaching plate" data-provenance="RECOVERED SELECTED DESIGN" title="Head · Face plate · recovered selected design (3521 live-analytics plates on the Founder scanner art); producers: FaceFamily / smile-pattern / NodDetector via the 3528C composition root">
    <div class="plate-head"><span class="t-label">Head · Face</span><span class="chip" id="face-chip">Searching</span></div>
    <div class="scan" id="face-scan" data-tracked="false">
      <img src="${FACE_ART}" alt="">
      <span class="region" data-region="brows" style="left:22%;top:26%;width:56%;height:14%"></span>
      <span class="region" data-region="eyes" style="left:24%;top:36%;width:52%;height:14%"></span>
      <span class="region" data-region="cheeks" style="left:16%;top:52%;width:68%;height:18%"></span>
      <span class="region" data-region="mouth" style="left:30%;top:70%;width:40%;height:14%"></span>
      <div class="dim" id="face-dim">Paused · face not tracked</div>
    </div>
    <div class="rows">
      <div class="row"><span class="k">Facing</span><span class="v" id="face-facing">—</span></div>
      <div class="row"><span class="k">Smiles</span><span class="v" id="face-smiles">—</span></div>
      <div class="row"><span class="k">Nods</span><span class="v" id="face-nods">—</span></div>
    </div>
  </section>
  <section class="plate" aria-label="Body and hands teaching plate" data-provenance="RECOVERED SELECTED DESIGN" title="Body · Hands plate · recovered selected design; producers: holistic worker hands five-state + gesture units via the 3528C composition root">
    <div class="plate-head"><span class="t-label">Body · Hands</span><span class="chip" id="body-chip">Searching</span></div>
    <div class="scan" id="body-scan" data-tracked="false">
      <img src="${BODY_ART}" alt="">
      <span class="region" data-region="torso" style="left:30%;top:14%;width:40%;height:34%"></span>
      <span class="region" data-region="left" style="left:4%;top:44%;width:26%;height:22%"></span>
      <span class="region" data-region="right" style="left:70%;top:44%;width:26%;height:22%"></span>
      <div class="dim" id="body-dim">Paused · body not tracked</div>
    </div>
    <div class="rows">
      <div class="row"><span class="k">Framing</span><span class="v" id="body-framing">—</span></div>
      <div class="row"><span class="k">Hands</span><span class="v" id="body-hands">—</span></div>
      <div class="row"><span class="k">Gestures</span><span class="v" id="body-gestures">—</span></div>
    </div>
  </section>`;
}

export function rightRailMarkup() {
  const speedTicks = Array.from({ length: 31 }, (_, i) => `<line class="speed-tick${i >= 15 && i <= 20 ? ' target' : ''}" data-tick="${i}" x1="160" y1="8" x2="160" y2="22" transform="rotate(${-90 + i * 6} 160 100)"/>`).join('');
  const whites = 15; const W = 300; const ww = W / whites;
  let keys = ''; let blacks = '';
  for (let i = 0; i < whites; i += 1) {
    keys += `<rect class="pk-w" data-k="${i}" x="${i * ww}" y="0" width="${ww - 1.2}" height="44" rx="2.5"/>`;
    if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1) blacks += `<rect class="pk-b" x="${(i + 1) * ww - 5}" y="0" width="10" height="26" rx="2"/>`;
  }
  return `
  <section class="inst hero" aria-label="Pace instrument">
    <div class="inst-head" data-provenance="RECOVERED + MODERNIZED" title="Pace speedometer · recovered 3528C design, modernized hold law; producer: timed-word WPM (Sherpa) — unavailable shown literally, never phrase rate"><span class="t-label">Pace</span><span class="verb" id="pace-verb">Listening</span></div>
    <div class="speedometer" id="speedo" data-available="false" data-held="false">
      <svg viewBox="0 0 320 124" role="img" aria-label="Speaking pace speedometer">
        <path class="speed-rim" d="M68 100 A92 92 0 0 1 252 100"/>
        <path class="speed-rim-target" id="speed-target-arc" d="M160 8 A92 92 0 0 1 206 20.5"/>
        <g>${speedTicks}</g>
        <g class="speed-needle" id="speed-needle" style="transform:rotate(-90deg)"><path d="M157.5 100 L160 24 L162.5 100 Z"/></g>
        <circle class="speed-hub-outer" cx="160" cy="100" r="12"/><circle class="speed-hub" cx="160" cy="100" r="5.5"/>
        <text class="speed-hold-label" x="160" y="60" text-anchor="middle">LAST READING</text>
        <text class="speed-label" x="40" y="118">SLOW</text><text class="speed-label" x="160" y="118" text-anchor="middle">YOUR RANGE</text><text class="speed-label" x="280" y="118" text-anchor="end">FAST</text>
      </svg>
    </div>
    <div class="inst-val"><b id="pace-score">—</b><span id="pace-wpm">waiting for timed words</span></div>
    <div class="inst-foot"><span class="t-tech" id="pace-basis">corridor 140–175 wpm</span></div>
  </section>
  <section class="inst" aria-label="Volume instrument">
    <div class="inst-head" data-provenance="RECOVERED SELECTED DESIGN" title="Volume 16-segment bar · recovered 3521 design; producer: audio analyser dBFS + K-weighted corridor, speech-gated"><span class="t-label">Volume</span><span class="verb" id="vol-verb">Listening</span></div>
    <div class="segments" id="vol-segments">${'<i></i>'.repeat(16)}<span class="corr" id="vol-corr" style="left:40%;width:26%"></span></div>
    <div class="seg-labels"><span>Quiet</span><span>Your range</span><span>Loud</span></div>
    <div class="inst-val"><b id="vol-score">—</b><span id="vol-raw">speech-gated</span></div>
  </section>
  <section class="inst" aria-label="Pitch instrument">
    <div class="inst-head" data-provenance="RECOVERED SELECTED DESIGN" title="Pitch piano · recovered 3521 design; producer: pitch-f0 NSDF, semitones from own median; calibrated corrections use the single arbiter"><span class="t-label">Pitch</span><span class="verb hold" id="pitch-verb">Awaiting evidence</span></div>
    <div class="piano" id="piano" data-available="false">
      <svg viewBox="0 0 ${W} 60" role="img" aria-label="Speaker-relative pitch occupancy">
        <g id="piano-keys">${keys}</g>${blacks}
        <line x1="${W / 2}" y1="-2" x2="${W / 2}" y2="48" class="p-median"/>
        <text x="${W / 2}" y="58" text-anchor="middle" class="p-label">YOUR MEDIAN</text><text x="4" y="58" class="p-label">LOW</text><text x="${W - 4}" y="58" text-anchor="end" class="p-label">HIGH</text>
      </svg>
    </div>
    <div class="inst-val"><b id="pitch-st">—</b><span id="pitch-hz">establishing range</span></div>
  </section>
  <section class="inst" aria-label="Vocal variety instrument">
    <div class="inst-head" data-provenance="RECOVERED + MODERNIZED" title="Vocal variety · recovered 3521 vocal-variation chart modernized to the 0–10 band; producer: pitch SD + loudness range projection"><span class="t-label">Variety</span><span class="verb" id="var-verb">Listening</span></div>
    <div class="band"><span class="corr" style="left:70%;width:10%"></span><span class="marker" id="var-marker" style="left:0%"></span></div>
    <canvas class="ribbon" id="var-ribbon" width="300" height="34" aria-hidden="true"></canvas>
    <div class="inst-val"><b id="var-score">—</b><span id="var-note">pitch SD × loudness range</span></div>
  </section>`;
}

export class RailsController {
  constructor(root) {
    this.root = root;
    this.$ = (id) => root.querySelector(`#${id}`);
    this.lastDisplayAt = -Infinity;
    this.hold = { pace: null, paceAt: -Infinity };
    this.varietyHistory = [];
    this.pianoHeat = new Array(15).fill(0);
    this.lastCounts = { smiles: null, nods: null, gestures: null };
    this.prevState = {};
  }

  // Render once per second, but process every frame for pulses/counts.
  ingest(frame, { force = false } = {}) {
    if (!frame) return;
    this.pulse(frame);
    if (frame.volumeModulation?.available && Number.isFinite(frame.volumeModulation.score)) {
      this.varietyHistory.push({ t: frame.t, v: frame.volumeModulation.score });
      if (this.varietyHistory.length > 120) this.varietyHistory.shift();
    }
    if (frame.pitch?.available && frame.pitch.voiced && Number.isFinite(frame.pitch.semitonesFromSpeakerMedian)) {
      const key = Math.max(0, Math.min(14, Math.round(7 + frame.pitch.semitonesFromSpeakerMedian)));
      this.pianoHeat[key] += 1;
    }
    if (!force && frame.t - this.lastDisplayAt < 1) return;
    this.lastDisplayAt = frame.t;
    this.renderLeft(frame);
    this.renderRight(frame);
  }

  pulse(frame) {
    const h = frame.headFace || {}; const b = frame.bodyHands || {};
    const fire = (sel) => { const el = this.root.querySelector(sel); if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse', 'on'); setTimeout(() => el.classList.remove('pulse'), 520); };
    if (h.smileNow || (Number.isFinite(h.smileEvents) && this.lastCounts.smiles !== null && h.smileEvents > this.lastCounts.smiles)) { fire('[data-region="mouth"]'); fire('[data-region="cheeks"]'); }
    if (h.nodNow || (Number.isFinite(h.nods) && this.lastCounts.nods !== null && h.nods > this.lastCounts.nods)) fire('[data-region="eyes"]');
    if (h.browActive) fire('[data-region="brows"]');
    if (b.gestureNow || (Number.isFinite(b.gestures) && this.lastCounts.gestures !== null && b.gestures > this.lastCounts.gestures)) { if (b.leftVisible) fire('[data-region="left"]'); if (b.rightVisible) fire('[data-region="right"]'); }
    this.lastCounts = { smiles: Number.isFinite(h.smileEvents) ? h.smileEvents : this.lastCounts.smiles, nods: Number.isFinite(h.nods) ? h.nods : this.lastCounts.nods, gestures: Number.isFinite(b.gestures) ? b.gestures : this.lastCounts.gestures };
  }

  renderLeft(frame) {
    const h = frame.headFace || {}; const b = frame.bodyHands || {};
    const tracked = h.presence === 'TRACKED';
    const faceScan = this.$('face-scan'); const bodyScan = this.$('body-scan');
    faceScan.dataset.tracked = String(tracked);
    bodyScan.dataset.tracked = String(b.inFrame === true);
    for (const region of faceScan.querySelectorAll('.region')) region.classList.toggle('on', tracked);
    const torso = bodyScan.querySelector('[data-region="torso"]'); torso.classList.toggle('on', b.inFrame === true);
    bodyScan.querySelector('[data-region="left"]').classList.toggle('on', b.leftVisible === true);
    bodyScan.querySelector('[data-region="right"]').classList.toggle('on', b.rightVisible === true);
    const chip = this.$('face-chip'); chip.textContent = tracked ? 'Tracked' : (h.presence === 'SEARCHING' ? 'Searching' : 'Unavailable'); chip.className = `chip ${tracked ? 'ok' : 'warn'}`;
    const bchip = this.$('body-chip'); bchip.textContent = b.inFrame ? 'In frame' : 'Searching'; bchip.className = `chip ${b.inFrame ? 'ok' : 'warn'}`;
    const facing = this.$('face-facing');
    if (Number.isFinite(h.cameraFacingPct)) { facing.className = 'v'; facing.innerHTML = `${h.cameraFacingPct}%<small>toward screen · not eye contact</small>`; }
    else { facing.className = 'v na'; facing.textContent = 'unavailable'; }
    const smiles = this.$('face-smiles');
    if (h.smileEventsAvailable && Number.isFinite(h.smileEvents)) { smiles.className = 'v'; smiles.innerHTML = `${h.smileEvents}${ticks(h.smileEvents)}<small>patterns</small>`; }
    else { smiles.className = 'v na'; smiles.textContent = human(h.smileEventsUnavailableReason || 'baseline needed'); }
    const nods = this.$('face-nods');
    if (h.nodsAvailable && Number.isFinite(h.nods)) { nods.className = 'v'; nods.innerHTML = `${h.nods}${ticks(h.nods)}<small>${frame.state === 'LISTENING' ? 'listening' : 'cycles'}</small>`; }
    else { nods.className = 'v na'; nods.textContent = human(h.nodsUnavailableReason || 'unavailable'); }
    const framing = this.$('body-framing');
    framing.className = b.framing && b.framing !== 'UNAVAILABLE' ? 'v' : 'v na'; framing.textContent = b.framing && b.framing !== 'UNAVAILABLE' ? b.framing.toLowerCase().replace('-', '-') : 'unavailable';
    const hands = this.$('body-hands');
    if (b.handsAvailable) {
      const map = { BOTH: 'L + R in view', LEFT: 'L only', RIGHT: 'R only', NONE: frame.state === 'ANSWERING' ? 'not in view' : 'out of frame · ok while listening' };
      hands.className = 'v'; hands.textContent = map[b.visibility] || b.visibility;
    } else { hands.className = 'v na'; hands.textContent = 'unavailable'; }
    const g = this.$('body-gestures');
    if (b.gesturesAvailable && Number.isFinite(b.gestures)) {
      g.className = 'v';
      g.innerHTML = b.gestureRateAvailable ? `${b.gestures}${ticks(b.gestures)}<small>${b.gestureRate}/min · your 6–14</small>` : `${b.gestures}${ticks(b.gestures)}<small>${human(b.gestureRateUnavailableReason || 'measuring')}</small>`;
    } else { g.className = 'v na'; g.textContent = human(b.gestureUnavailableReason || 'unavailable'); }
    // The single active correction.
    const corr = this.$('correction');
    const cue = frame.cue;
    const fault = frame.fault;
    if (fault) { corr.dataset.state = 'fault'; corr.querySelector('.glyph').textContent = '!'; corr.querySelector('strong').textContent = fault.message; corr.querySelector('small').textContent = fault.detail || ''; }
    else if (cue) { corr.dataset.state = 'active'; corr.querySelector('.glyph').textContent = cue.id?.includes('speed') ? '≈' : cue.id?.includes('loud') ? '↑' : '⌖'; corr.querySelector('strong').textContent = cue.message; corr.querySelector('small').textContent = cue.detail || ''; }
    else { corr.dataset.state = 'idle'; corr.querySelector('.glyph').textContent = '·'; corr.querySelector('strong').textContent = frame.state === 'ANSWERING' ? 'Nothing to change' : frame.state === 'LISTENING' ? 'Listening' : 'Watching'; corr.querySelector('small').textContent = frame.state === 'ANSWERING' ? 'Keep going.' : 'One correction at a time.'; }
    // Framing attention bracket uses the cue, never a separate judgment.
    for (const region of bodyScan.querySelectorAll('.region')) region.classList.toggle('attn', Boolean(cue && (cue.id === 'framing' || cue.id === 'orientation-away')));
  }

  renderRight(frame) {
    const s = frame.speedWpm || {}; const v = frame.volume || {}; const p = frame.pitch || {}; const m = frame.volumeModulation || {};
    const pitchState=pitchRailState(frame),pitchVerb=this.$('pitch-verb');pitchVerb.textContent=pitchState.label;pitchVerb.className='verb '+pitchState.tone;
    // PACE with hold-last-valid: bright ≤2 s, dim ≤8 s, then LAST label.
    const speedo = this.$('speedo');
    if (s.available && Number.isFinite(s.wordsPerMinute)) { this.hold.pace = { wpm: s.wordsPerMinute, score: s.score, cue: s.cue }; this.hold.paceAt = frame.t; }
    const held = this.hold.pace; const age = frame.t - this.hold.paceAt;
    if (held && (s.available || age <= 8)) {
      const score = Number.isFinite(held.score) ? held.score : 7;
      const angle = -90 + (Math.max(0, Math.min(10, score)) / 10) * 180;
      this.$('speed-needle').style.transform = `rotate(${angle}deg)`;
      speedo.dataset.available = 'true'; speedo.dataset.held = String(!s.available);
      this.$('pace-score').innerHTML = `${score.toFixed(1)}<small>/10</small>`;
      this.$('pace-wpm').textContent = s.available ? `${held.wpm} wpm` : `last · ${held.wpm} wpm · ${Math.round(age)} s ago`;
      const verb = this.$('pace-verb'); const cue = held.cue;
      verb.textContent = cue === 1 ? 'Pick up pace' : cue === -1 ? 'Slow down' : 'Hold'; verb.className = `verb ${cue === 0 ? 'ok' : cue === 1 ? 'up' : 'down'}`;
      for (const tick of speedo.querySelectorAll('.speed-tick')) tick.classList.toggle('lit', Number(tick.dataset.tick) <= Math.round((score / 10) * 30));
    } else {
      speedo.dataset.available = 'false'; speedo.dataset.held = 'false';
      this.$('speed-needle').style.transform = 'rotate(-90deg)';
      this.$('pace-score').innerHTML = '<span class="na">—</span>';
      this.$('pace-wpm').textContent = frame.speaking ? human(s.holdReason || 'listening for your pace') : 'speech-gated · listening';
      const verb = this.$('pace-verb'); verb.textContent = frame.speaking ? 'Measuring' : 'Listening'; verb.className = 'verb';
      for (const tick of speedo.querySelectorAll('.speed-tick')) tick.classList.remove('lit');
    }
    this.$('pace-basis').textContent = s.fixture ? 'FIXTURE corridor 140–175 wpm' : 'corridor 140–175 wpm · personal when calibrated';
    // VOLUME: raw bar always moves when the mic is live; score/pill only with speech + personal corridor.
    const segs = [...this.$('vol-segments').querySelectorAll('i')];
    const level = v.available ? Math.round((Number.isFinite(v.normalized) ? v.normalized : 0) * 16) : 0;
    const corridorLo = 7; const corridorHi = 11;
    segs.forEach((seg, i) => { seg.className = i < level ? `lit${i >= corridorLo && i <= corridorHi ? ' in' : i > corridorHi + 2 ? ' hot' : ''}` : ''; });
    const volScore = this.$('vol-score'); const volVerb = this.$('vol-verb');
    if (v.coachingAvailable && Number.isFinite(v.score)) {
      volScore.innerHTML = `${v.score.toFixed(1)}<small>/10</small>`;
      this.$('vol-raw').textContent = `${v.scientificValue} ${v.scientificUnit}`;
      volVerb.textContent = v.cue === 1 ? 'Quiet · lift' : v.cue === -1 ? 'Loud · ease' : 'Hold'; volVerb.className = `verb ${v.cue === 0 ? 'ok' : 'up'}`;
    } else {
      volScore.innerHTML = '<span class="na">—</span>';
      this.$('vol-raw').textContent = v.available ? human(v.holdReason || 'speech-gated') : 'waiting for microphone';
      volVerb.textContent = frame.speaking ? 'Measuring' : 'Listening'; volVerb.className = 'verb';
    }
    // PITCH: level never coached; occupancy heat + current key.
    const piano = this.$('piano'); piano.dataset.available = String(Boolean(p.available));
    const max = Math.max(1, ...this.pianoHeat);
    const nowKey = p.available && p.voiced && Number.isFinite(p.semitonesFromSpeakerMedian) ? Math.max(0, Math.min(14, Math.round(7 + p.semitonesFromSpeakerMedian))) : null;
    piano.querySelectorAll('.pk-w').forEach((key, i) => {
      const ratio = this.pianoHeat[i] / max;
      key.dataset.heat = ratio > .66 ? 'high' : ratio > .33 ? 'medium' : ratio > 0 ? 'low' : 'none';
      key.classList.toggle('now', i === nowKey);
    });
    if (p.available && p.voiced && Number.isFinite(p.semitonesFromSpeakerMedian)) {
      this.$('pitch-st').innerHTML = `${p.semitonesFromSpeakerMedian > 0 ? '+' : ''}${p.semitonesFromSpeakerMedian.toFixed(1)}<small>st</small>`;
      this.$('pitch-hz').textContent = `${p.f0Hz} Hz · ${p.referenceBasis === 'FIXED_PERSONAL_CALIBRATION_MEDIAN' ? 'personal median' : 'rolling median'}`;
    } else if (p.available) { this.$('pitch-st').innerHTML = '<span class="na">unvoiced</span>'; this.$('pitch-hz').textContent = 'held 1.2 s'; }
    else { this.$('pitch-st').innerHTML = '<span class="na">—</span>'; this.$('pitch-hz').textContent = frame.speaking ? 'establishing speaker range' : 'speech-gated · listening'; }
    // VARIETY: 0–10 band + ribbon.
    const varScore = this.$('var-score'); const varVerb = this.$('var-verb');
    if (m.available && Number.isFinite(m.score)) {
      varScore.innerHTML = `${m.score.toFixed(1)}<small>/10</small>`;
      this.$('var-marker').style.left = `${Math.max(0, Math.min(100, m.score * 10))}%`;
      varVerb.textContent = m.cue === 1 ? 'Add variety' : m.cue === -1 ? 'Steady delivery' : 'Healthy variation'; varVerb.className = `verb ${m.cue === 0 ? 'ok' : 'up'}`;
      this.$('var-note').textContent = 'pitch SD × loudness range';
    } else {
      varScore.innerHTML = '<span class="na">—</span>';
      varVerb.textContent = frame.speaking ? 'Building' : 'Listening'; varVerb.className = 'verb';
      this.$('var-note').textContent = human(m.holdReason || 'building speech history');
    }
    this.drawRibbon();
  }

  drawRibbon() {
    const canvas = this.$('var-ribbon'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff08'; ctx.fillRect(0, H * 0.2, W, H * 0.1);
    const hist = this.varietyHistory; if (hist.length < 2) return;
    const t0 = hist[0].t; const t1 = hist[hist.length - 1].t; const span = Math.max(1, t1 - t0);
    ctx.beginPath(); ctx.strokeStyle = '#ffb84d'; ctx.lineWidth = 2;
    hist.forEach((pt, i) => { const x = ((pt.t - t0) / span) * W; const y = H - (pt.v / 10) * H; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
    ctx.stroke();
  }
}
