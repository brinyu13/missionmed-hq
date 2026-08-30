/* ============================================================
   3528B — LIVE COCKPIT (full recomposition) + PROCESSING
   Preserves the approved scientific-instrument identity:
   Founder scanners, piano, corridors, hold-last-valid honesty.
   All signals here come from the deterministic SimEngine and are
   labeled SIMULATED. Codex swaps SimEngine.frame() for the real
   LiveMetricProjector frame (field names mirror the contract).
   ============================================================ */
import { SimEngine, paintSimFeed, CALIBRATION, QUESTIONS } from './data.mjs';
import { ui, saveUi, draft, go, toast, whisper, confirmModal, session } from './main.mjs';

const qOf = id => QUESTIONS.find(q => q.id === id);
const fmt = s => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/* ---------------- instrument definitions (one visual family) --- */
const INSTRUMENTS = [
  {
    id: 'pace', name: 'PACE', unit: 'WPM',
    tech: f => f.speedWpm.available ? `${f.speedWpm.wordsPerMinute} WPM` : null,
    corridorLabel: () => `YOUR TARGET ${CALIBRATION.paceCorridor[0]}–${CALIBRATION.paceCorridor[1]} WPM`,
    score: f => f.speedWpm.available ? f.speedWpm.score : null,
    cue: f => f.speedWpm.cue,
    holdReason: f => f.speedWpm.holdReason,
    verbs: { raise: 'SPEED UP', lower: 'SLOW DOWN', hold: 'HOLD' },
    gauge: 'meter',
    labels: ['SLOW', 'TARGET ZONE', 'FAST'],
    gaugeNorm: f => f.speedWpm.available ? Math.max(0, Math.min(1, (f.speedWpm.wordsPerMinute - 90) / 130)) : null,
    corridorNorm: () => [(CALIBRATION.paceCorridor[0] - 90) / 130, (CALIBRATION.paceCorridor[1] - 90) / 130],
  },
  {
    id: 'volume', name: 'VOLUME', unit: 'LU',
    tech: f => f.volume.available ? `${f.volume.deltaLu > 0 ? '+' : ''}${f.volume.deltaLu} LU vs baseline` : null,
    corridorLabel: () => `YOUR CORRIDOR ${CALIBRATION.volumeCorridorLu[0]}…+${CALIBRATION.volumeCorridorLu[1]} LU`,
    score: f => f.volume.available ? f.volume.score : null,
    cue: f => f.volume.cue,
    holdReason: f => f.volume.holdReason,
    verbs: { raise: 'SPEAK UP', lower: 'LOWER VOLUME', hold: 'HOLD' },
    gauge: 'meter',
    labels: ['QUIET', 'CORRIDOR', 'LOUD'],
    gaugeNorm: f => f.volume.available ? Math.max(0, Math.min(1, (f.volume.speechLufsK + 34) / 22)) : null,
    corridorNorm: () => [(-27 + 34) / 22, (-15 + 34) / 22],
  },
  {
    id: 'variety', name: 'VOCAL VARIETY', unit: 'SD',
    tech: f => f.volumeModulation.available ? `${f.volumeModulation.rangeLu} LU range · speaker-relative` : null,
    corridorLabel: () => 'YOUR RANGE 3.4–6.2 LU',
    score: f => f.volumeModulation.available ? f.volumeModulation.score : null,
    cue: f => f.volumeModulation.cue,
    holdReason: f => f.speedWpm.holdReason,
    verbs: { raise: 'ADD VARIATION', lower: 'STABILIZE', hold: 'HOLD' },
    gauge: 'piano',
  },
];

function scoreColor(v) {
  if (v == null) return 'var(--g-amber)';
  return v >= 7 && v <= 8.5 ? 'var(--g-teal)' : 'var(--g-gold)';
}

/* ---------------- LIVE screen ---------------------------------- */
function liveScreen(el) {
  if (!draft.qids || !draft.qids.length) { go('home'); return; }
  const q = qOf(draft.qids[0]);
  const engine = new SimEngine(3528);
  const showAnalytics = ui.analyticsVisible !== false;

  /* recording state machine (doc 05) */
  const rec = {
    state: ui.recording ? 'RECORDING' : 'OFF',
    elapsed: 0, finalizeT: 0,
  };
  if (ui.recording) toast('● Recording started — saved to YOUR MissionMed library.', 'rec');

  // dev/QA only: deterministic fast-forward for checkpoint captures (?ff=seconds)
  const ff = +(new URLSearchParams(location.search).get('ff') || 0);
  if (ff > 0) { for (let acc = 0; acc < ff; acc += .1) engine.tick(.1); if (rec.state === 'RECORDING') rec.elapsed = ff; }
  const devTuner = new URLSearchParams(location.search).get('tuner');

  el.innerHTML = `
  <div class="room ${showAnalytics ? '' : 'interview-only'}" id="room">
    <div class="room-top">
      <span class="state-chip" id="stateChip">LISTENING</span>
      <span class="room-q">“${q.text}”</span>
      <span class="spacer"></span>
      <span class="rec-mirror" id="recMirror"></span>
      <button class="coach-master ${ui.coaching ? 'on' : ''}" id="coachMaster" role="switch" aria-checked="${ui.coaching}">
        <i></i>LIVE COACHING <b>${ui.coaching ? 'ON' : 'OFF'}</b>
      </button>
      <button class="btn btn-quiet room-finish" id="finishBtn">FINISH ▸</button>
    </div>

    <div class="room-main">
      <aside class="room-left" ${showAnalytics ? '' : 'hidden'}>
        <div class="scan-card" id="faceCard">
          <div class="scan-head"><b>HEAD · FACE</b><span class="live-tag" id="faceLive">● LIVE</span></div>
          <div class="scan-well"><img src="assets/founder-face-scanner.png" alt="Face scanner instrument"><i class="scan-sweep"></i></div>
          <div class="counter-row">
            <div class="counter"><em>SMILE EVENTS</em><b id="cSmiles">0</b><small>qualifying · full-face</small></div>
            <div class="counter"><em>HEAD NODS</em><b id="cNods">0</b><small>listening-only</small></div>
          </div>
          <div class="scan-rows">
            <div class="scan-row"><em>PRESENCE</em><b id="rPresence" class="ok">TRACKED</b></div>
            <div class="scan-row"><em>CAMERA-FACING</em><b id="rFacing">—</b></div>
          </div>
        </div>
        <div class="scan-card" id="bodyCard">
          <div class="scan-head"><b>BODY · GESTURES</b><span class="live-tag">● LIVE</span></div>
          <div class="scan-well body"><img src="assets/founder-body-scanner.png" alt="Body scanner instrument"><i class="scan-sweep"></i></div>
          <div class="hands-state ok" id="handsState">HANDS VISIBLE · L + R</div>
          <div class="counter-row">
            <div class="counter wide"><em>EFFECTIVE GESTURES</em><b id="cGestures">0</b><small id="gRate">corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min</small></div>
          </div>
        </div>
      </aside>

      <div class="room-center">
        <div class="stage-wrap">
          <div class="stage" id="stage16">
            <canvas id="liveFeed"></canvas>
            <span class="feed-tag">YOU · SIMULATED FEED</span>
            <span class="stage-corner tl"></span><span class="stage-corner tr"></span>
            <span class="stage-corner bl"></span><span class="stage-corner br"></span>
          </div>
        </div>
        <div class="prompt-bar">
          <span class="prompt-ava">MC</span>
          <div class="prompt-tx">
            <em>DR. MAYA CHEN · INTERVIEWER <i>(SIM)</i></em>
            <b id="promptText">“${q.text}”</b>
          </div>
          <span class="prompt-state" id="promptState"></span>
        </div>
      </div>

      <aside class="room-right" ${showAnalytics ? '' : 'hidden'}>
        ${INSTRUMENTS.map(ins => `
        <div class="inst" id="inst-${ins.id}">
          <div class="inst-head">
            <b>${ins.name}</b>
            <button class="inst-gear" data-gear="${ins.id}" title="Tune your personal corridor">⚙</button>
          </div>
          <div class="inst-score">
            <b class="inst-num" id="num-${ins.id}">—</b>
            <span class="inst-of">/10</span>
            <span class="coach-arrow" id="arrow-${ins.id}"></span>
          </div>
          <div class="inst-tech" id="tech-${ins.id}">&nbsp;</div>
          <div class="inst-corr" id="corr-${ins.id}">${ins.corridorLabel()}</div>
          <div class="inst-verb"><span class="verb-pill" id="verb-${ins.id}">WAITING FOR SPEECH</span></div>
          <div class="inst-gauge g-${ins.gauge}" id="gauge-${ins.id}"></div>
          <div class="inst-tune" id="tune-${ins.id}" hidden></div>
        </div>`).join('')}
      </aside>
    </div>

    <div class="room-bottom">
      <div class="rec-dock" id="recDock"></div>
      <div class="vv-deck" ${showAnalytics ? '' : 'hidden'}>
        <div class="vv-head">
          <div class="vv-title"><b>VOCAL VARIATION</b><small>speech-gated history · silence visible</small></div>
          <div class="vv-traces" id="vvTraces">
            <button class="vv-t on" data-trace="vol"><i style="background:var(--g-teal)"></i>VOLUME</button>
            <button class="vv-t on" data-trace="pitch"><i style="background:var(--g-violet)"></i>PITCH</button>
            <button class="vv-t on" data-trace="pace"><i style="background:var(--g-cyan)"></i>PACE</button>
            <button class="vv-t" data-all="1">SHOW ALL</button>
            <button class="vv-t" data-none="1">HIDE ALL</button>
          </div>
          <div class="vv-windows" id="vvWindows">
            ${[['30', '30S'], ['60', '1M'], ['180', '3M'], ['300', '5M'], ['0', 'FULL']].map(([v, l]) =>
    `<button class="vv-w ${v === '60' ? 'on' : ''}" data-win="${v}">${l}</button>`).join('')}
          </div>
        </div>
        <canvas id="vvCanvas"></canvas>
      </div>
    </div>
  </div>`;

  /* ---------- pieces ---------- */
  const $ = id => el.querySelector('#' + id);
  const feedCanvas = $('liveFeed');
  const feedCtx = feedCanvas.getContext('2d');
  const vvCanvas = $('vvCanvas');
  const vvCtx = vvCanvas.getContext('2d');
  const traces = { vol: true, pitch: true, pace: true };
  let vvWindow = 60;

  /* gauges — one shared corridor-band grammar; variety adds the piano */
  const gaugeEls = {};
  for (const ins of INSTRUMENTS) {
    const host = $(`gauge-${ins.id}`);
    if (ins.gauge === 'meter') {
      const [a, b] = ins.corridorNorm();
      host.innerHTML = `<div class="lu-meter">
        <i class="lu-corr" style="left:${a * 100}%;width:${(b - a) * 100}%"></i>
        <i class="lu-fill"></i>
        <i class="lu-tick"></i>
      </div><div class="gauge-labels"><span>${ins.labels[0]}</span><span class="gl-mid">${ins.labels[1]}</span><span>${ins.labels[2]}</span></div>`;
      gaugeEls[ins.id] = { fill: host.querySelector('.lu-fill'), tick: host.querySelector('.lu-tick'), corr: host.querySelector('.lu-corr') };
    } else if (ins.gauge === 'piano') {
      const whites = 15, W = 300, ww = W / whites;
      let keys = '', blacks = '';
      for (let i = 0; i < whites; i++) {
        keys += `<rect class="pk-w" data-k="${i}" x="${i * ww}" y="0" width="${ww - 1.2}" height="52" rx="2.5"/>`;
        if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1)
          blacks += `<rect class="pk-b" x="${(i + 1) * ww - 5}" y="0" width="10" height="31" rx="2"/>`;
      }
      host.innerHTML = `<svg viewBox="0 0 ${W} 70" class="piano-svg">
        <g id="pianoKeys">${keys}</g>${blacks}
        <line x1="${W / 2}" y1="-3" x2="${W / 2}" y2="56" class="p-median"/>
        <text x="${W / 2}" y="67" text-anchor="middle" class="p-label">YOUR MEDIAN</text>
        <text x="6" y="67" class="p-label">LOW</text><text x="${W - 6}" y="67" text-anchor="end" class="p-label">HIGH</text>
      </svg>`;
      gaugeEls[ins.id] = { keys: [...host.querySelectorAll('.pk-w')] };
    }
  }

  /* corridor tuners (inline ⚙) */
  function renderTuner(id) {
    const host = $(`tune-${id}`);
    if (id === 'pace') {
      host.innerHTML = `
        <em>PERSONAL SWEET SPOT · WPM</em>
        <div class="tune-row"><span id="tvLo">${CALIBRATION.paceCorridor[0]}</span>
        <input type="range" min="100" max="200" value="${CALIBRATION.paceCorridor[0]}" data-t="pace0">
        <input type="range" min="100" max="220" value="${CALIBRATION.paceCorridor[1]}" data-t="pace1">
        <span id="tvHi">${CALIBRATION.paceCorridor[1]}</span></div>`;
    } else if (id === 'volume') {
      host.innerHTML = `
        <em>PERSONAL CORRIDOR · LU vs BASELINE</em>
        <div class="tune-row"><span>${CALIBRATION.volumeCorridorLu[0]}</span>
        <input type="range" min="-12" max="0" value="${CALIBRATION.volumeCorridorLu[0]}" data-t="vol0">
        <input type="range" min="0" max="12" value="${CALIBRATION.volumeCorridorLu[1]}" data-t="vol1">
        <span>+${CALIBRATION.volumeCorridorLu[1]}</span></div>`;
    } else {
      host.innerHTML = `<em>VARIETY RANGE · SPEAKER-RELATIVE</em>
        <div class="tune-row"><span>3.4</span><input type="range" min="1" max="8" value="3.4" step=".2" data-t="var0">
        <input type="range" min="2" max="10" value="6.2" step=".2" data-t="var1"><span>6.2</span></div>`;
    }
  }
  INSTRUMENTS.forEach(i => renderTuner(i.id));
  if (devTuner && $(`tune-${devTuner}`)) { $(`tune-${devTuner}`).hidden = false; $(`inst-${devTuner}`).classList.add('focus'); }

  /* recording dock */
  const dock = $('recDock');
  function renderDock() {
    const s = rec.state;
    if (s === 'OFF') {
      dock.innerHTML = `<div class="dock-line off"><i class="dock-dot"></i><b class="dock-label">NOT RECORDING</b>
        <span class="dock-sub">results only · no replay</span></div>`;
      return;
    }
    if (s === 'RECORDING') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot rec"></i><b class="dock-label red">REC</b>
        <b class="dock-timer" id="dockTimer">${fmt(rec.elapsed)}</b>
        <button class="dock-btn" id="dockPause">⏸ PAUSE</button>
        <button class="dock-btn stop" id="dockStop">■ STOP</button></div>
        <div class="dock-note">Saving to YOUR MissionMed library — only you and your mentors can view.</div>`;
    } else if (s === 'PAUSED') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot pause"></i><b class="dock-label amber">RECORDING PAUSED</b>
        <b class="dock-timer" id="dockTimer">${fmt(rec.elapsed)}</b>
        <button class="dock-btn resume" id="dockResume">▶ RESUME</button>
        <button class="dock-btn stop" id="dockStop">■ STOP</button></div>
        <div class="dock-note">Analytics keep measuring — the paused span is excluded from your recording.</div>`;
    } else if (s === 'FINALIZING') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-ring"></i><b class="dock-label">SAVING TO MISSIONMED…</b>
        <b class="dock-timer">${Math.round(rec.finalizeT * 83)}%</b></div>
        <div class="dock-note">Sealing recording · uploading chunks</div>`;
    } else if (s === 'SAVED') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot saved"></i><b class="dock-label teal">✓ SAVED TO VIDEO LIBRARY</b>
        <b class="dock-timer">${fmt(rec.elapsed)}</b></div>
        <div class="dock-note">Download video &amp; results available on your Results screen.</div>`;
    }
  }
  renderDock();

  function recMirrorSync() {
    const m = $('recMirror');
    if (rec.state === 'RECORDING') { m.className = 'rec-mirror rec'; m.innerHTML = `<i></i>REC ${fmt(rec.elapsed)}`; }
    else if (rec.state === 'PAUSED') { m.className = 'rec-mirror pause'; m.innerHTML = `<i></i>PAUSED ${fmt(rec.elapsed)}`; }
    else if (rec.state === 'OFF') { m.className = 'rec-mirror off'; m.innerHTML = `<i></i>NOT RECORDING`; }
    else { m.className = 'rec-mirror'; m.innerHTML = ''; }
    el.querySelector('#room').dataset.rec = rec.state;
  }
  recMirrorSync();

  /* ---------- render loop ---------- */
  let raf, lastTs = performance.now(), domT = 0, focused = null;
  let cueHold = { id: null, since: 0 };

  function paintVV() {
    const w = vvCanvas.width = vvCanvas.clientWidth * Math.min(devicePixelRatio, 1.5);
    const h = vvCanvas.height = vvCanvas.clientHeight * Math.min(devicePixelRatio, 1.5);
    if (!w || !h) return;
    const c = vvCtx;
    c.clearRect(0, 0, w, h);
    const hist = engine.history;
    if (!hist.length) return;
    const tEnd = engine.t;
    const span = vvWindow === 0 ? Math.max(30, tEnd) : vvWindow;
    const t0 = tEnd - span; // "now" always anchors the right edge
    const X = t => ((t - t0) / span) * w;
    const pad = h * .08;
    const Y = v => h - pad - v * (h - pad * 2);
    // silence shading
    c.fillStyle = 'rgba(120,132,160,.08)';
    let runStart = null;
    for (let i = 0; i < hist.length; i++) {
      const p = hist[i];
      if (p.t < t0) continue;
      if (!p.speaking && runStart == null) runStart = p.t;
      if ((p.speaking || i === hist.length - 1) && runStart != null) {
        c.fillRect(X(runStart), 0, Math.max(2, X(p.t) - X(runStart)), h);
        runStart = null;
      }
    }
    // grid
    c.strokeStyle = 'rgba(66,80,106,.35)'; c.lineWidth = 1;
    for (let gy = 1; gy < 4; gy++) { c.beginPath(); c.moveTo(0, h * gy / 4); c.lineTo(w, h * gy / 4); c.stroke(); }
    const lanes = [['vol', '#2fe7b0'], ['pitch', '#a696ff'], ['pace', '#39d6ff']];
    for (const [k, color] of lanes) {
      if (!traces[k]) continue;
      c.strokeStyle = color; c.lineWidth = Math.max(1.5, h * .018); c.lineJoin = 'round';
      c.beginPath();
      let pen = false;
      for (const p of hist) {
        if (p.t < t0) continue;
        const v = p[k];
        if (v == null) { pen = false; continue; }
        const x = X(p.t), y = Y(v);
        if (!pen) { c.moveTo(x, y); pen = true; } else c.lineTo(x, y);
      }
      c.stroke();
    }
    // pre-speech hint (honest empty state)
    if (!hist.some(p => p.speaking)) {
      c.fillStyle = 'rgba(147,161,186,.75)';
      c.font = `600 ${Math.max(12, h * .12)}px "Space Grotesk", monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('WAITING FOR OBSERVED SPEECH — SILENCE STAYS VISIBLE', w / 2, h * .42);
      c.textAlign = 'left';
    }
    // time labels along the bottom edge
    c.fillStyle = 'rgba(147,161,186,.9)';
    c.font = `${Math.max(11, h * .105)}px "Space Grotesk", monospace`;
    c.textBaseline = 'bottom';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const tt = t0 + span * i / steps;
      const label = `-${fmt(tEnd - tt)}`;
      const x = Math.min(w - 46, Math.max(4, X(tt) - 16));
      c.fillText(i === steps ? 'now' : label, x, h - 3);
    }
  }

  function domSync(f) {
    // state chip
    const sc = $('stateChip');
    sc.textContent = f.state;
    sc.className = `state-chip s-${f.state.toLowerCase()}`;
    $('promptState').textContent = f.state === 'ANSWERING' ? '● ANSWER IN PROGRESS' : f.state === 'THINKING' ? '● TAKE YOUR TIME' : '● LISTENING';

    /* instruments */
    for (const ins of INSTRUMENTS) {
      const score = ins.score(f);
      const num = $(`num-${ins.id}`);
      const inst = $(`inst-${ins.id}`);
      if (score != null) {
        num.textContent = score.toFixed(1);
        num.style.color = scoreColor(score);
        inst.classList.remove('unavail');
        ins._last = score;
      } else if (ins._last != null) {
        num.textContent = ins._last.toFixed(1);
        num.style.color = '';
        inst.classList.add('unavail');
      } else {
        num.textContent = '—';
        inst.classList.add('unavail');
      }
      const tech = ins.tech(f);
      $(`tech-${ins.id}`).textContent = tech || (score == null ? (ins._last != null ? 'holding last valid' : 'no speech observed yet') : '');
      const verb = $(`verb-${ins.id}`);
      const cue = ins.cue(f);
      if (score == null) {
        verb.textContent = ins.holdReason(f) || 'HOLDING · LISTENING';
        verb.className = 'verb-pill hold';
      } else if (cue === 0) { verb.textContent = `IN RANGE — ${ins.verbs.hold}`; verb.className = 'verb-pill ok'; }
      else if (cue === 1) { verb.textContent = ins.verbs.raise; verb.className = 'verb-pill push'; }
      else { verb.textContent = ins.verbs.lower; verb.className = 'verb-pill push'; }
      const arrow = $(`arrow-${ins.id}`);
      if (ui.coaching && score != null) {
        arrow.innerHTML = cue === 0 ? '<i class="ca ok">✓</i>' : cue === 1 ? '<i class="ca up">↑</i>' : '<i class="ca down">↓</i>';
      } else arrow.innerHTML = '';
      // gauges
      const g = gaugeEls[ins.id];
      if (ins.gauge === 'meter' && g.fill) {
        const [a, b] = ins.corridorNorm();
        g.corr.style.left = `${a * 100}%`;
        g.corr.style.width = `${(b - a) * 100}%`;
        const n = ins.gaugeNorm(f);
        const nn = n == null ? 0 : n;
        g.fill.style.width = `${nn * 100}%`;
        g.tick.style.left = `${nn * 100}%`;
        g.fill.style.opacity = n == null ? .3 : 1;
      } else if (ins.gauge === 'piano' && g.keys) {
        const semis = f.pitch.available ? f.pitch.semitonesFromSpeakerMedian : null;
        const idx = semis == null ? null : Math.max(0, Math.min(14, Math.round(7 + semis)));
        g.keys.forEach((k, i) => {
          k.classList.toggle('active', idx === i);
          k.classList.toggle('range', semis != null && Math.abs(i - 7) <= 3);
        });
      }
    }

    /* face / body */
    $('cSmiles').textContent = f.headFace.smileEvents;
    $('cNods').textContent = f.headFace.nods;
    $('rFacing').textContent = f.headFace.cameraFacingPct + '% FACING';
    $('rFacing').className = f.headFace.cameraFacingPct >= 85 ? 'ok' : 'warn';
    $('cGestures').textContent = f.bodyHands.gestures;
    const gr = $('gRate');
    gr.textContent = f.bodyHands.gestureRate != null
      ? `${f.bodyHands.gestureRate} / min · corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]}`
      : `corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min`;
    const hs = $('handsState');
    if (!f.bodyHands.handsVisible) { hs.className = 'hands-state bad'; hs.textContent = '⚠ HANDS NOT VISIBLE'; }
    else { hs.className = 'hands-state ok'; hs.textContent = 'HANDS VISIBLE · L + R'; }
    const body = $('bodyCard');
    body.dataset.activity = f.bodyHands.handsVisible ? f.bodyHands.activity : 'hidden';

    /* whisper escalation: sustained deviation ≥3.5 s, one at a time */
    if (ui.coaching && f.speaking) {
      let active = null;
      for (const ins of INSTRUMENTS) {
        const cue = ins.cue(f);
        if (cue && ins.score(f) != null) { active = { id: ins.id, cue, ins }; break; }
      }
      if (active) {
        if (cueHold.id !== active.id + active.cue) cueHold = { id: active.id + active.cue, since: f.t };
        else if (f.t - cueHold.since > 3.5) {
          const label = active.cue === 1 ? active.ins.verbs.raise : active.ins.verbs.lower;
          whisper(label, { arrow: active.cue === 1 ? '↑' : '↓' });
          engine.events.push({ t: f.t, kind: 'cue', label: `${active.ins.name} · ${label}` });
          cueHold.since = f.t + 6; // cooldown
        }
      } else cueHold = { id: null, since: 0 };
    }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (ts - lastTs) / 1000);
    lastTs = ts;
    engine.tick(dt);
    if (rec.state === 'RECORDING') { rec.elapsed += dt; const t = $('dockTimer'); if (t) t.textContent = fmt(rec.elapsed); const m = $('recMirror'); if (m.firstChild) m.innerHTML = `<i></i>REC ${fmt(rec.elapsed)}`; }
    if (rec.state === 'FINALIZING') {
      rec.finalizeT += dt;
      renderDock();
      if (rec.finalizeT > 1.3) { rec.state = 'SAVED'; renderDock(); recMirrorSync(); toast('✓ Recording saved to MissionMed', 'save'); setTimeout(finishToProcessing, 900); }
    }
    // feed
    const w = feedCanvas.width = feedCanvas.clientWidth * Math.min(devicePixelRatio, 1.5);
    const h = feedCanvas.height = feedCanvas.clientHeight * Math.min(devicePixelRatio, 1.5);
    if (w && h) paintSimFeed(feedCtx, w, h, engine.t, engine.frame());
    domT += dt;
    if (domT > .2) { domT = 0; domSync(engine.frame()); paintVV(); }
  }
  raf = requestAnimationFrame(loop);
  /* hidden-tab fallback: rAF suspends when the tab is hidden; keep the
     session honest with a coarse interval (timers, state, recording). */
  const hiddenIv = setInterval(() => {
    if (!document.hidden) return;
    const ts = performance.now();
    const dt = Math.min(1.2, (ts - lastTs) / 1000);
    lastTs = ts;
    engine.tick(dt);
    if (rec.state === 'RECORDING') { rec.elapsed += dt; const t = $('dockTimer'); if (t) t.textContent = fmt(rec.elapsed); }
    if (rec.state === 'FINALIZING') { rec.finalizeT += dt; if (rec.finalizeT > 1.3) { rec.state = 'SAVED'; renderDock(); recMirrorSync(); setTimeout(finishToProcessing, 400); } }
    const w = feedCanvas.width, h = feedCanvas.height;
    if (w && h) paintSimFeed(feedCtx, w, h, engine.t, engine.frame());
    domSync(engine.frame());
    paintVV();
  }, 500);

  /* ---------- interactions ---------- */
  function sealAndStop() {
    if (rec.state === 'RECORDING' || rec.state === 'PAUSED') {
      rec.state = 'FINALIZING'; rec.finalizeT = 0;
      renderDock(); recMirrorSync();
    } else finishToProcessing();
  }
  function finishToProcessing() {
    const f = engine.frame();
    session.last = {
      title: draft.title || q.text.split(' ').slice(0, 4).join(' '),
      question: q,
      dur: rec.elapsed || engine.t,
      recorded: ui.recording,
      scores: {
        pace: INSTRUMENTS[0]._last ?? null,
        volume: INSTRUMENTS[1]._last ?? null,
        variety: INSTRUMENTS[2]._last ?? null,
      },
      wpmAvg: f.speedWpm.wordsPerMinute || 158,
      counters: { nods: f.headFace.nods, smiles: f.headFace.smileEvents, gestures: f.bodyHands.gestures, handsPct: f.bodyHands.handsVisible ? 96 : 74 },
      events: engine.events.slice(),
      history: engine.history.slice(),
      t: engine.t,
    };
    go('processing');
  }

  el.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#coachMaster')) {
      ui.coaching = !ui.coaching; saveUi();
      const b = t.closest('#coachMaster');
      b.classList.toggle('on', ui.coaching);
      b.setAttribute('aria-checked', ui.coaching);
      b.querySelector('b').textContent = ui.coaching ? 'ON' : 'OFF';
      if (!ui.coaching) whisper(null);
      toast(ui.coaching ? 'Live coaching ON' : 'Coaching off — measurement continues', 'info');
      return;
    }
    if (t.closest('#finishBtn')) { sealAndStop(); return; }
    if (t.closest('#dockPause')) { rec.state = 'PAUSED'; renderDock(); recMirrorSync(); toast('Recording paused', 'rec'); return; }
    if (t.closest('#dockResume')) { rec.state = 'RECORDING'; renderDock(); recMirrorSync(); toast('Recording resumed', 'rec'); return; }
    if (t.closest('#dockStop')) { sealAndStop(); return; }
    const gear = t.closest('[data-gear]');
    if (gear) {
      const id = gear.dataset.gear;
      const tune = $(`tune-${id}`);
      const wasHidden = tune.hidden;
      el.querySelectorAll('.inst-tune').forEach(x => x.hidden = true);
      el.querySelectorAll('.inst').forEach(x => x.classList.remove('focus'));
      if (wasHidden) { tune.hidden = false; $(`inst-${id}`).classList.add('focus'); }
      return;
    }
    const instHead = t.closest('.inst-head b');
    if (instHead) {
      const inst = t.closest('.inst');
      const on = inst.classList.contains('focus');
      el.querySelectorAll('.inst').forEach(x => x.classList.remove('focus'));
      if (!on) inst.classList.add('focus');
      return;
    }
    const tr = t.closest('[data-trace]');
    if (tr) { const k = tr.dataset.trace; traces[k] = !traces[k]; tr.classList.toggle('on', traces[k]); paintVV(); return; }
    if (t.closest('[data-all]')) { for (const k in traces) traces[k] = true; el.querySelectorAll('[data-trace]').forEach(x => x.classList.add('on')); paintVV(); return; }
    if (t.closest('[data-none]')) { for (const k in traces) traces[k] = false; el.querySelectorAll('[data-trace]').forEach(x => x.classList.remove('on')); paintVV(); return; }
    const wbtn = t.closest('[data-win]');
    if (wbtn) {
      vvWindow = +wbtn.dataset.win;
      el.querySelectorAll('.vv-w').forEach(x => x.classList.toggle('on', x === wbtn));
      paintVV(); return;
    }
  });

  el.addEventListener('input', e => {
    const t = e.target.closest('[data-t]');
    if (!t) return;
    const v = +t.value;
    if (t.dataset.t === 'pace0') CALIBRATION.paceCorridor[0] = Math.min(v, CALIBRATION.paceCorridor[1] - 10);
    if (t.dataset.t === 'pace1') CALIBRATION.paceCorridor[1] = Math.max(v, CALIBRATION.paceCorridor[0] + 10);
    if (t.dataset.t === 'vol0') CALIBRATION.volumeCorridorLu[0] = v;
    if (t.dataset.t === 'vol1') CALIBRATION.volumeCorridorLu[1] = v;
    $('corr-pace').textContent = INSTRUMENTS[0].corridorLabel();
    $('corr-volume').textContent = INSTRUMENTS[1].corridorLabel();
  });

  async function escMenu() {
    cancelAnimationFrame(raf);
    const resume = await confirmModal({
      title: 'PAUSED — INTERVIEW ROOM',
      body: 'Measurement is suspended while this menu is open. End &amp; save seals your recording and computes results.',
      okLabel: 'RESUME', cancelLabel: 'END & SAVE',
    });
    if (resume) { lastTs = performance.now(); raf = requestAnimationFrame(loop); }
    else sealAndStop();
  }

  return {
    destroy: () => { cancelAnimationFrame(raf); clearInterval(hiddenIv); whisper(null); },
    onEscape: escMenu,
  };
}

/* ---------------- PROCESSING interstitial ----------------------- */
function processingScreen(el) {
  el.innerHTML = `
  <div class="processing">
    <div class="proc-ring"></div>
    <h2 class="t-display-md">SEALING YOUR SESSION…</h2>
    <div class="proc-steps">
      <span data-step="0">Finalizing recording &amp; poster</span>
      <span data-step="1">Computing delivery analytics</span>
      <span data-step="2">Writing your library record</span>
    </div>
  </div>`;
  const steps = [...el.querySelectorAll('[data-step]')];
  steps.forEach((s, i) => setTimeout(() => s.classList.add('done'), 380 * (i + 1)));
  const t = setTimeout(() => go('results'), 1700);
  return { destroy: () => clearTimeout(t) };
}

export const LIVE_SCREENS = {
  live: { render: liveScreen, env: false, hilite: 'practice', autoFocus: false, railMin: true },
  processing: { render: processingScreen, envTheme: 'results', hilite: 'results' },
};
