/* ============================================================
   3528B — LIVE COCKPIT (full recomposition) + PROCESSING
   Preserves the approved scientific-instrument identity:
   Founder scanners, piano, corridors, hold-last-valid honesty.
   Production cockpit. Signals come only from the real local camera,
   microphone, transcript-timing, and LiveMetricProjector pipelines.
   ============================================================ */
import { CALIBRATION, QUESTIONS } from './data.mjs';
import { ivocApi } from './api.mjs';
import { RealAnalyticsEngine } from './real-runtime.mjs';
import { AccountRecordingController } from './recording.mjs';
import { ui, saveUi, draft, saveDraft, go, toast, whisper, confirmModal, session } from './main.mjs';

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
    gauge: 'speedometer',
    labels: ['SLOW', 'TARGET ZONE', 'FAST'],
    gaugeNorm: f => f.speedWpm.available ? Math.max(0, Math.min(1, (f.speedWpm.wordsPerMinute - 90) / 130)) : null,
    corridorNorm: () => [(CALIBRATION.paceCorridor[0] - 90) / 130, (CALIBRATION.paceCorridor[1] - 90) / 130],
  },
  {
    id: 'volume', name: 'VOLUME', unit: 'REAL LEVEL',
    tech: f => f.volume.available
      ? `${Number(f.volume.scientificValue).toFixed(1)} ${f.volume.scientificUnit}`
      : null,
    corridorLabel: f => f?.volume?.corridor
      ? `REAL ${f.volume.scientificUnit} CORRIDOR ${f.volume.corridor[0]}…${f.volume.corridor[1]}`
      : 'PERSONAL SPEAKING CORRIDOR',
    score: f => f.volume.available ? f.volume.score : null,
    cue: f => f.volume.cue,
    holdReason: f => f.volume.holdReason,
    verbs: { raise: 'SPEAK UP', lower: 'LOWER VOLUME', hold: 'HOLD' },
    gauge: 'segments',
    labels: ['QUIET', 'CORRIDOR', 'LOUD'],
    gaugeNorm: f => f.volume.available ? Math.max(0, Math.min(1, f.volume.normalized ?? ((f.volume.scientificValue + 60) / 60))) : null,
    corridorNorm: f => {
      if (!Array.isArray(f?.volume?.corridor) || f.volume.corridor.length !== 2) return [null, null];
      const [lo, hi] = f.volume.corridor;
      return [Math.max(0, (lo + 60) / 60), Math.min(1, (hi + 60) / 60)];
    },
  },
  {
    id: 'pitch', name: 'PITCH', unit: 'HZ', kind: 'pitch',
    tech: f => f.pitch.available && f.pitch.voiced && Number.isFinite(f.pitch.f0Hz)
      ? `${f.pitch.f0Hz.toFixed(1)} Hz · validated F0`
      : null,
    corridorLabel: () => 'KEY HEAT = VOICED OCCUPANCY · LINE = YOUR MEDIAN',
    score: f => f.pitch.available && f.pitch.voiced && Number.isFinite(f.pitch.semitonesFromSpeakerMedian)
      ? f.pitch.semitonesFromSpeakerMedian
      : null,
    cue: () => 0,
    holdReason: f => f.pitch.voiced ? 'ESTABLISHING SPEAKER MEDIAN' : 'UNVOICED · NO VALIDATED F0',
    verbs: { raise: 'VOICED', lower: 'VOICED', hold: 'VOICED' },
    gauge: 'piano',
  },
];

function scoreColor(v) {
  if (v == null) return 'var(--g-amber)';
  return v >= 7 && v <= 8.5 ? 'var(--g-teal)' : 'var(--g-gold)';
}

/* ---------------- LIVE screen ---------------------------------- */
async function liveScreen(el) {
  if (!draft.qids || !draft.qids.length) { go('home'); return; }
  const q = qOf(draft.qids[0]);
  const showAnalytics = ui.analyticsVisible !== false;

  // Instrument hold-last-valid state belongs to one interview session only.
  for (const instrument of INSTRUMENTS) {
    instrument._last = null;
    instrument._lastWpm = null;
  }

  /* recording state machine (doc 05) */
  const rec = {
    state: ui.recording ? 'READY' : 'OFF',
    elapsed: 0, finalizeT: 0,
  };
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
      <button class="btn btn-quiet room-devices" id="roomDevices" aria-expanded="false" aria-controls="roomDevicePanel">⚙ CAMERA + MIC</button>
      <button class="btn btn-quiet room-finish" id="finishBtn">FINISH ▸</button>
    </div>

    <section class="room-device-panel" id="roomDevicePanel" hidden aria-label="Live camera and microphone settings">
      <div class="room-device-head"><b>LIVE DEVICES</b><button type="button" id="roomDeviceClose" aria-label="Close device settings">×</button></div>
      <p>Switch hardware without leaving the interview room. Measurement and the session clock continue.</p>
      <label><span>CAMERA</span><select id="liveCameraSelect" aria-label="Live camera"><option value="">Start analytics to load cameras</option></select></label>
      <label><span>MICROPHONE</span><select id="liveMicrophoneSelect" aria-label="Live microphone"><option value="">Start analytics to load microphones</option></select></label>
      <div class="room-device-foot"><button type="button" id="roomDeviceRefresh">↻ RESCAN</button><span id="roomDeviceStatus" role="status">READY</span></div>
    </section>

    <div class="room-main">
      <aside class="room-left" ${showAnalytics ? '' : 'hidden'}>
        <div class="scan-card" id="faceCard">
          <div class="scan-head"><b>HEAD · FACE</b><span class="live-tag" id="faceLive">● LIVE</span></div>
          <div class="scan-well"><img src="assets/founder-face-scanner.png" alt="Face scanner instrument"><i class="scan-sweep"></i></div>
          <div class="counter-row">
            <div class="counter"><em>SMILE EVENTS</em><b id="cSmiles">0</b><small>observable · mouth/cheek</small></div>
            <div class="counter"><em>HEAD NODS</em><b id="cNods">0</b><small>observed · state-aware</small></div>
          </div>
          <div class="scan-rows">
            <div class="scan-row"><em>PRESENCE</em><b id="rPresence" class="ok">TRACKED</b></div>
            <div class="scan-row"><em>CAMERA-FACING</em><b id="rFacing">—</b></div>
          </div>
        </div>
        <div class="scan-card" id="bodyCard">
          <div class="scan-head"><b>BODY · GESTURES</b><span class="live-tag">● LIVE</span></div>
          <div class="scan-well body"><img src="assets/founder-body-scanner.png" alt="Body scanner instrument"><i class="scan-sweep"></i></div>
          <div class="hands-state listening" id="handsState">HANDS · OBSERVING</div>
          <div class="counter-row">
            <div class="counter wide"><em>EFFECTIVE GESTURES</em><b id="cGestures">0</b><small id="gRate">corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min</small></div>
          </div>
        </div>
      </aside>

      <div class="room-center">
        <div class="video-stack">
          <div class="stage-wrap"><div class="stage" id="stage16">
            <video id="liveVideo" playsinline muted></video>
            <canvas id="liveOverlay" aria-hidden="true"></canvas>
            <div class="capture-start" id="captureStart">
              <b>TEST YOUR CAMERA + MICROPHONE</b>
              <span>Analytics begin before the interview so you can confirm every instrument.</span>
              <button class="btn btn-gold btn-xl" id="startAnalytics">START ANALYTICS</button>
              <small id="captureStatus">Camera and microphone stay private to this MissionMed session.</small>
            </div>
            <span class="feed-tag">YOU · REAL CAMERA · LOCAL ANALYTICS</span>
            <span class="stage-corner tl"></span><span class="stage-corner tr"></span>
            <span class="stage-corner bl"></span><span class="stage-corner br"></span>
            <div class="overlay-controls" aria-label="Camera overlay visibility">
              <button class="overlay-toggle on" data-overlay="face" aria-pressed="true">FACE</button>
              <button class="overlay-toggle on" data-overlay="hands" aria-pressed="true">HANDS</button>
              <button class="overlay-toggle on" data-overlay="body" aria-pressed="true">BODY</button>
              <button class="overlay-toggle on" data-overlay="position" aria-pressed="true">POSITION</button>
            </div>
          </div></div>
          <div class="rec-dock" id="recDock"></div>
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
            ${ins.kind === 'pitch' ? '<span class="inst-source">REAL F0</span>' : `<button class="inst-gear" data-gear="${ins.id}" title="Tune your personal corridor">⚙</button>`}
          </div>
          <div class="inst-score ${ins.kind === 'pitch' ? 'pitch-score' : ''}">
            <b class="inst-num" id="num-${ins.id}">—</b>
            <span class="inst-of" id="unit-${ins.id}">${ins.kind === 'pitch' ? 'st' : ins.id === 'pace' ? 'WPM' : '/10'}</span>
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
      <div class="vv-deck" ${showAnalytics ? '' : 'hidden'}>
        <div class="vv-head">
          <div class="vv-title"><b>VOCAL VARIATION</b><small>shared 0–10 scale · 0 = silence · live movement</small></div>
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
      <div class="variety-score" id="varietyScore" ${showAnalytics ? '' : 'hidden'}>
        <div class="variety-kicker">VOCAL VARIETY</div>
        <div class="variety-number"><b id="varietyNum">—</b><span>/10</span></div>
        <div class="variety-tech" id="varietyTech">No voiced history yet</div>
        <div class="variety-verb" id="varietyVerb">SPEECH-GATED · LISTENING</div>
      </div>
    </div>
  </div>`;

  /* ---------- pieces ---------- */
  const $ = id => el.querySelector('#' + id);
  const video = $('liveVideo');
  const overlay = $('liveOverlay');
  const engine = new RealAnalyticsEngine({ video, overlayCanvas: overlay });
  let accountSession = null;
  let recorder = null;
  let analyticsStarted = false;
  let finalizing = false;
  const vvCanvas = $('vvCanvas');
  const vvCtx = vvCanvas.getContext('2d');
  const traces = { vol: true, pitch: true, pace: true };
  let vvWindow = 60;
  let lastVarietyScore = null;
  let deviceRefreshTimer = 0;
  let deviceSwitching = false;

  function fillLiveDeviceSelect(select, devices, selectedId, fallbackLabel) {
    select.replaceChildren();
    for (const [index, device] of devices.entries()) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
      option.selected = device.deviceId === selectedId;
      select.appendChild(option);
    }
    if (!select.options.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = `No ${fallbackLabel.toLowerCase()} detected`;
      select.appendChild(option);
    }
  }

  async function refreshLiveDevices(message = '') {
    const status = $('roomDeviceStatus');
    status.textContent = message || 'SCANNING…';
    const devices = await navigator.mediaDevices.enumerateDevices();
    const current = analyticsStarted ? engine.currentDevices() : {
      cameraDeviceId: draft.cameraDeviceId || '',
      microphoneDeviceId: draft.microphoneDeviceId || '',
    };
    fillLiveDeviceSelect($('liveCameraSelect'), devices.filter(device => device.kind === 'videoinput'), current.cameraDeviceId, 'Camera');
    fillLiveDeviceSelect($('liveMicrophoneSelect'), devices.filter(device => device.kind === 'audioinput'), current.microphoneDeviceId, 'Microphone');
    status.textContent = analyticsStarted ? (message || 'MEASUREMENT CONTINUOUS') : 'SELECTION APPLIES WHEN ANALYTICS STARTS';
  }

  async function switchLiveDevice(kind, deviceId) {
    if (!deviceId || deviceSwitching) return;
    const status = $('roomDeviceStatus');
    const label = kind === 'camera' ? 'CAMERA' : 'MICROPHONE';
    if (!analyticsStarted) {
      if (kind === 'camera') draft.cameraDeviceId = deviceId;
      else draft.microphoneDeviceId = deviceId;
      saveDraft();
      status.textContent = `${label} SELECTED · START ANALYTICS TO APPLY`;
      return;
    }
    deviceSwitching = true;
    status.textContent = `${label} SWITCHING…`;
    $('liveCameraSelect').disabled = true;
    $('liveMicrophoneSelect').disabled = true;
    try {
      const selected = await engine.switchDevice(kind, deviceId);
      draft.cameraDeviceId = selected.cameraDeviceId;
      draft.microphoneDeviceId = selected.microphoneDeviceId;
      draft.cam = selected.cameraLabel;
      draft.mic = selected.microphoneLabel;
      saveDraft();
      await refreshLiveDevices(`${label} LIVE · SESSION CONTINUOUS`);
      engine.events.push({ t: engine.frame().t, kind: 'device-switch', label: `${label} switched` });
      toast(`${label[0]}${label.slice(1).toLowerCase()} switched — measurement continues.`, 'save');
    } catch (error) {
      status.textContent = `${label} SWITCH FAILED · CURRENT DEVICE RETAINED`;
      toast(`${label[0]}${label.slice(1).toLowerCase()} switch failed: ${error.message}`, 'rec');
      await refreshLiveDevices(`${label} SWITCH FAILED · CURRENT DEVICE RETAINED`).catch(() => {});
    } finally {
      deviceSwitching = false;
      $('liveCameraSelect').disabled = false;
      $('liveMicrophoneSelect').disabled = false;
    }
  }

  const handleDeviceChange = () => {
    clearTimeout(deviceRefreshTimer);
    deviceRefreshTimer = setTimeout(() => {
      void refreshLiveDevices('DEVICE LIST CHANGED').catch(() => {
        $('roomDeviceStatus').textContent = 'DEVICE REFRESH FAILED';
      });
    }, 250);
  };
  navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);

  /* gauges — dedicated instruments, one shared truth grammar */
  const gaugeEls = {};
  for (const ins of INSTRUMENTS) {
    const host = $(`gauge-${ins.id}`);
    if (ins.gauge === 'speedometer') {
      const ticks = Array.from({ length: 31 }, (_, index) => {
        const angle = -90 + index * 6;
        return `<line class="speed-tick" data-tick="${index}" x1="160" y1="8" x2="160" y2="23" transform="rotate(${angle} 160 100)"/>`;
      }).join('');
      host.innerHTML = `<div class="speedometer">
        <svg class="speed-dial" viewBox="0 0 320 120" role="img" aria-label="Live speaking pace analog speedometer">
          <path class="speed-rim" d="M68 100 A92 92 0 0 1 252 100" pathLength="100"/>
          <g class="speed-ticks">${ticks}</g>
          <g class="speed-needle" style="transform:rotate(-90deg)">
            <path d="M157.5 100 L160 22 L162.5 100 Z"/>
          </g>
          <circle class="speed-hub-outer" cx="160" cy="100" r="12"/>
          <circle class="speed-hub" cx="160" cy="100" r="5.5"/>
          <text class="speed-hold-label" x="160" y="58" text-anchor="middle">LAST VALIDATED</text>
          <text class="speed-label speed-label-slow" x="38" y="116">${ins.labels[0]}</text>
          <text class="speed-label speed-label-target" x="160" y="116" text-anchor="middle">${ins.labels[1]}</text>
          <text class="speed-label speed-label-fast" x="282" y="116" text-anchor="end">${ins.labels[2]}</text>
        </svg>
      </div>`;
      gaugeEls[ins.id] = {
        root: host.querySelector('.speedometer'),
        ticks: [...host.querySelectorAll('.speed-tick')],
        needle: host.querySelector('.speed-needle'),
      };
    } else if (ins.gauge === 'segments') {
      host.innerHTML = `<div class="volume-segments">${Array.from({ length: 16 }, (_, index) => `<i data-segment="${index}"></i>`).join('')}<span class="segment-corridor"></span></div>
        <div class="gauge-labels"><span>${ins.labels[0]}</span><span class="gl-mid">${ins.labels[1]}</span><span>${ins.labels[2]}</span></div>`;
      gaugeEls[ins.id] = { segments: [...host.querySelectorAll('[data-segment]')], corr: host.querySelector('.segment-corridor') };
    } else if (ins.gauge === 'piano') {
      const whites = 15, W = 300, ww = W / whites;
      let keys = '', blacks = '';
      for (let i = 0; i < whites; i++) {
        keys += `<rect class="pk-w" data-k="${i}" x="${i * ww}" y="0" width="${ww - 1.2}" height="52" rx="2.5"/>`;
        if ([0, 1, 3, 4, 5].includes(i % 7) && i < whites - 1)
          blacks += `<rect class="pk-b" x="${(i + 1) * ww - 5}" y="0" width="10" height="31" rx="2"/>`;
      }
      host.innerHTML = `<svg viewBox="0 0 ${W} 70" class="piano-svg" role="img" aria-label="Speaker-relative pitch occupancy heat map">
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
        <div class="tune-row"><span id="volTuneLo">${CALIBRATION.volumeCorridorLu[0]}</span>
        <input type="range" min="-12" max="0" value="${CALIBRATION.volumeCorridorLu[0]}" data-t="vol0">
        <input type="range" min="0" max="12" value="${CALIBRATION.volumeCorridorLu[1]}" data-t="vol1">
        <span id="volTuneHi">+${CALIBRATION.volumeCorridorLu[1]}</span></div>`;
    }
  }
  INSTRUMENTS.filter(i => i.kind !== 'pitch').forEach(i => renderTuner(i.id));
  if (devTuner && $(`tune-${devTuner}`)) { $(`tune-${devTuner}`).hidden = false; $(`inst-${devTuner}`).classList.add('focus'); }

  /* recording dock */
  const dock = $('recDock');
  function renderDock() {
    const s = rec.state;
    if (s === 'READY') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot"></i><b class="dock-label">REC READY</b>
        <span class="dock-sub">starts with analytics · saves to your MissionMed account</span></div>`;
      return;
    }
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
        <b class="dock-timer">${Math.min(99, Math.round(rec.finalizeT * 83))}%</b></div>
        <div class="dock-note">Sealing recording · uploading chunks</div>`;
    } else if (s === 'SAVED') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot saved"></i><b class="dock-label teal">✓ SAVED TO VIDEO LIBRARY</b>
        <b class="dock-timer">${fmt(rec.elapsed)}</b></div>
        <div class="dock-note">Download video &amp; results available on your Results screen.</div>`;
    } else if (s === 'ERROR') {
      dock.innerHTML = `<div class="dock-line"><i class="dock-dot pause"></i><b class="dock-label red">SAVE NEEDS RETRY</b>
        <button class="dock-btn resume" id="dockRetry">RETRY SAVE</button></div>
        <div class="dock-note">The recording is still held safely in this tab. Do not close it.</div>`;
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
    const tEnd = engine.frame().t;
    const span = vvWindow === 0 ? Math.max(30, tEnd) : vvWindow;
    const t0 = tEnd - span; // "now" always anchors the right edge
    const plotLeft = Math.max(38, w * .032);
    const plotRight = Math.max(8, w * .008);
    const plotTop = Math.max(8, h * .055);
    const plotBottom = h - Math.max(22, h * .15);
    const plotWidth = Math.max(1, w - plotLeft - plotRight);
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const X = t => plotLeft + ((t - t0) / span) * plotWidth;
    const Y = value => plotBottom - Math.max(0, Math.min(1, Number(value) || 0)) * plotHeight;
    // silence shading
    c.fillStyle = 'rgba(120,132,160,.08)';
    let runStart = null;
    for (let i = 0; i < hist.length; i++) {
      const p = hist[i];
      if (p.t < t0) continue;
      if (!p.speaking && runStart == null) runStart = p.t;
      if ((p.speaking || i === hist.length - 1) && runStart != null) {
        c.fillRect(X(runStart), plotTop, Math.max(2, X(p.t) - X(runStart)), plotHeight);
        runStart = null;
      }
    }
    // Every trace uses the same physical screen axis: bottom 0, top 10.
    c.textAlign = 'right'; c.textBaseline = 'middle';
    c.font = `700 ${Math.max(9, h * .067)}px "Space Grotesk", monospace`;
    for (const score of [0, 2.5, 5, 7.5, 10]) {
      const y = Y(score / 10);
      c.strokeStyle = score === 0 ? 'rgba(147,161,186,.62)' : 'rgba(66,80,106,.38)';
      c.lineWidth = score === 0 ? 1.4 : 1;
      c.beginPath(); c.moveTo(plotLeft, y); c.lineTo(w - plotRight, y); c.stroke();
      c.fillStyle = score === 0 ? 'rgba(220,228,244,.95)' : 'rgba(147,161,186,.88)';
      c.fillText(String(score), plotLeft - 7, y);
    }
    c.textAlign = 'left';
    c.fillStyle = 'rgba(147,161,186,.86)';
    c.textBaseline = 'top';
    c.fillText('SHARED 0–10 · ZERO = SILENCE', plotLeft + 8, plotTop + 5);

    const lanes = [['vol', '#2fe7b0'], ['pitch', '#a696ff'], ['pace', '#39d6ff']];
    for (const [k, color] of lanes) {
      if (!traces[k]) continue;
      const inWindow = hist.filter((point) => point.t >= t0);
      let value = 0;
      for (const point of hist) {
        if (point.t > t0) break;
        if (point.speaking === false) value = 0;
        else if (Number.isFinite(Number(point[k]))) value = Math.max(0, Math.min(1, Number(point[k])));
      }

      // One continuous shared-axis trace per real metric. Explicit observed
      // silence is projected to zero; a speaking-frame signal gap carries the
      // last measurement while the separate gap evidence remains authoritative.
      // Stored history and raw measurement values are never rewritten here.
      c.strokeStyle = color; c.lineWidth = Math.max(2, h * .018); c.lineJoin = 'round'; c.lineCap = 'round';
      c.shadowColor = color; c.shadowBlur = Math.max(3, h * .025);
      c.beginPath();
      c.moveTo(X(t0), Y(value));
      for (const p of inWindow) {
        if (p.speaking === false) value = 0;
        else if (Number.isFinite(Number(p[k]))) value = Math.max(0, Math.min(1, Number(p[k])));
        c.lineTo(X(p.t), Y(value));
      }
      c.lineTo(X(tEnd), Y(value));
      c.stroke();
      c.shadowBlur = 0;
    }
    // pre-speech hint (honest empty state)
    if (!hist.some(p => p.speaking)) {
      c.fillStyle = 'rgba(147,161,186,.75)';
      c.font = `600 ${Math.max(12, h * .12)}px "Space Grotesk", monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('WAITING FOR SPEECH · ALL TRACES HOLD AT ZERO', plotLeft + plotWidth / 2, plotTop + plotHeight * .5);
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
      const x = Math.min(w - 46, Math.max(plotLeft, X(tt) - 16));
      c.fillText(i === steps ? 'now' : label, x, h - 3);
    }
  }

  function domSync(f) {
    // state chip
    const sc = $('stateChip');
    sc.textContent = f.state;
    sc.className = `state-chip s-${f.state.toLowerCase()}`;
    $('promptState').textContent = f.state === 'ANSWERING'
      ? '● ANSWER IN PROGRESS'
      : f.state === 'THINKING'
        ? '● THINKING'
        : f.state === 'PAUSE'
          ? '● DELIBERATE PAUSE'
          : f.state === 'TRANSITION'
            ? '● TURN TRANSITION'
            : '● LISTENING';

    /* instruments */
    for (const ins of INSTRUMENTS) {
      const score = ins.score(f);
      const num = $(`num-${ins.id}`);
      const unit = $(`unit-${ins.id}`);
      const inst = $(`inst-${ins.id}`);
      if (score != null) {
        num.textContent = ins.id === 'pace'
          ? String(Math.round(f.speedWpm.wordsPerMinute))
          : ins.kind === 'pitch' ? `${score > 0 ? '+' : ''}${score.toFixed(1)}` : score.toFixed(1);
        if (unit) unit.textContent = ins.id === 'pace' ? 'WPM' : ins.kind === 'pitch' ? 'st' : '/10';
        num.style.color = ins.kind === 'pitch' ? 'var(--g-cyan)' : scoreColor(score);
        inst.classList.remove('unavail');
        ins._last = score;
        if (ins.id === 'pace' && Number.isFinite(f.speedWpm.wordsPerMinute)) {
          ins._lastWpm = f.speedWpm.wordsPerMinute;
        }
      } else if (ins._last != null && ins.kind !== 'pitch') {
        num.textContent = ins.id === 'pace' && Number.isFinite(ins._lastWpm)
          ? String(Math.round(ins._lastWpm))
          : ins._last.toFixed(1);
        num.style.color = '';
        inst.classList.add('unavail');
      } else {
        num.textContent = '—';
        inst.classList.add('unavail');
      }
      // WPM arrives as discrete, genuine two-second rolling transcript-timing
      // windows.  Keep the most recent validated raw value visible while the
      // next window is collecting so the instrument does not look dead or
      // snap back to zero between real decodes.
      const heldPaceTech = ins.id === 'pace' && Number.isFinite(ins._lastWpm)
        ? `${ins._last.toFixed(1)}/10 coaching · last validated 5–10 words`
        : null;
      const livePaceTech = ins.id === 'pace' && f.speedWpm.available
        ? `${score.toFixed(1)}/10 coaching · live rolling 5–10 words`
        : null;
      const tech = livePaceTech || ins.tech(f) || heldPaceTech;
      $(`tech-${ins.id}`).textContent = tech || (score == null ? (ins.kind === 'pitch' ? 'Unvoiced · no validated F0' : ins._last != null ? 'holding last valid' : 'no speech observed yet') : '');
      $(`corr-${ins.id}`).textContent = ins.corridorLabel(f);
      const verb = $(`verb-${ins.id}`);
      const cue = ins.cue(f);
      if (score == null) {
        verb.textContent = ins.holdReason(f) || 'HOLDING · LISTENING';
        verb.className = 'verb-pill hold';
      } else if (ins.kind === 'pitch') {
        verb.textContent = 'VOICED · LIVE F0';
        verb.className = 'verb-pill ok';
      } else if (cue === 0) { verb.textContent = `IN RANGE — ${ins.verbs.hold}`; verb.className = 'verb-pill ok'; }
      else if (cue === 1) { verb.textContent = ins.verbs.raise; verb.className = 'verb-pill push'; }
      else { verb.textContent = ins.verbs.lower; verb.className = 'verb-pill push'; }
      const arrow = $(`arrow-${ins.id}`);
      if (ui.coaching && score != null && ins.kind !== 'pitch') {
        arrow.innerHTML = cue === 0 ? '<i class="ca ok">✓</i>' : cue === 1 ? '<i class="ca up">↑</i>' : '<i class="ca down">↓</i>';
      } else arrow.innerHTML = '';
      // gauges
      const g = gaugeEls[ins.id];
      if (ins.gauge === 'speedometer' && g.needle) {
        const liveNorm = ins.gaugeNorm(f);
        const heldNorm = Number.isFinite(ins._lastWpm)
          ? Math.max(0, Math.min(1, (ins._lastWpm - 90) / 130))
          : null;
        const n = liveNorm ?? heldNorm;
        const nn = n == null ? 0 : n;
        const [targetStart, targetEnd] = ins.corridorNorm(f);
        const targetStartTick = Math.round(Math.max(0, Math.min(1, targetStart)) * 30);
        const targetEndTick = Math.round(Math.max(0, Math.min(1, targetEnd)) * 30);
        g.needle.style.transform = `rotate(${-90 + nn * 180}deg)`;
        const held = liveNorm == null && heldNorm != null;
        g.root.classList.toggle('held', held);
        g.needle.classList.toggle('observed', liveNorm != null);
        g.ticks.forEach((tick, index) => {
          tick.classList.toggle('active', n != null && index <= Math.round(nn * 30));
          tick.classList.toggle('target', index >= targetStartTick && index <= targetEndTick);
        });
      } else if (ins.gauge === 'segments' && g.segments) {
        const n = ins.gaugeNorm(f);
        const [a, b] = ins.corridorNorm(f);
        const corridorAvailable = Number.isFinite(a) && Number.isFinite(b);
        g.corr.hidden = !corridorAvailable;
        if (corridorAvailable) {
          g.corr.style.left = `${a * 100}%`;
          g.corr.style.width = `${Math.max(.04, b - a) * 100}%`;
        }
        g.segments.forEach((segment, index) => {
          const position = (index + .5) / g.segments.length;
          segment.classList.toggle('active', n != null && position <= n);
          segment.classList.toggle('target', corridorAvailable && position >= a && position <= b);
        });
      } else if (ins.gauge === 'piano' && g.keys) {
        const semis = f.pitch.available ? f.pitch.semitonesFromSpeakerMedian : null;
        const idx = semis == null ? null : Math.max(0, Math.min(14, Math.round(7 + semis)));
        const pitchOccupancy = Array(15).fill(0);
        for (const point of engine.history) {
          if (!Number.isFinite(point.pitch)) continue;
          pitchOccupancy[Math.max(0, Math.min(14, Math.round(point.pitch * 14)))] += 1;
        }
        const maximumOccupancy = Math.max(0, ...pitchOccupancy);
        g.keys.forEach((k, i) => {
          const count = pitchOccupancy[i];
          const relativeOccupancy = maximumOccupancy > 0 ? count / maximumOccupancy : 0;
          const heat = count === 0 ? 'none' : relativeOccupancy < .34 ? 'low' : relativeOccupancy < .67 ? 'medium' : 'high';
          k.dataset.heat = heat;
          k.dataset.occupancy = String(count);
          k.setAttribute('aria-label', `Pitch zone ${i + 1}: ${count} validated voiced sample${count === 1 ? '' : 's'}; occupancy ${heat}`);
          k.classList.toggle('active', idx === i);
          k.classList.toggle('range', semis != null && Math.abs(i - 7) <= 3);
          k.classList.toggle('heat-low', heat === 'low');
          k.classList.toggle('heat-medium', heat === 'medium');
          k.classList.toggle('heat-high', heat === 'high');
        });
      }
    }

    /* aligned Vocal Variation coaching score; traces stay in the deck */
    const variety = f.volumeModulation;
    if (variety.available && Number.isFinite(variety.score)) {
      lastVarietyScore = variety.score;
      $('varietyNum').textContent = variety.score.toFixed(1);
      $('varietyNum').style.color = scoreColor(variety.score);
      $('varietyTech').textContent = `${variety.pitchVariationSemitones?.toFixed(1) ?? '—'} st pitch · ${variety.loudnessVariationLu?.toFixed(1) ?? '—'} LU energy`;
      $('varietyVerb').textContent = variety.cue === 1 ? 'ADD VARIATION' : variety.cue === -1 ? 'STABILIZE' : 'IN RANGE · HOLD';
      $('varietyScore').classList.remove('unavail');
    } else {
      $('varietyNum').textContent = lastVarietyScore == null ? '—' : lastVarietyScore.toFixed(1);
      $('varietyTech').textContent = lastVarietyScore == null ? 'No voiced history yet' : 'Holding last validated score';
      $('varietyVerb').textContent = variety.holdReason || 'SPEECH-GATED · LISTENING';
      $('varietyScore').classList.add('unavail');
    }

    /* face / body */
    $('cSmiles').textContent = f.headFace.smileEventsAvailable ? f.headFace.smileEvents : '—';
    $('cSmiles').title = f.headFace.smileEventsLiveAvailable ? 'Measured qualifying smile-pattern events' : f.headFace.smileEventsAvailable ? `Last observed count · ${f.headFace.smileEventsUnavailableReason}` : f.headFace.smileEventsUnavailableReason;
    $('cNods').textContent = f.headFace.nodsAvailable ? f.headFace.nods : '—';
    $('cNods').title = f.headFace.nodsLiveAvailable ? 'Measured observed head-pitch cycles' : f.headFace.nodsAvailable ? `Last observed count · ${f.headFace.nodsUnavailableReason}` : f.headFace.nodsUnavailableReason;
    $('rPresence').textContent = f.headFace.presence;
    $('rPresence').className = f.headFace.presence === 'TRACKED' ? 'ok' : 'warn';
    $('rFacing').textContent = f.headFace.cameraFacingPct + '% FACING';
    $('rFacing').className = f.headFace.cameraFacingPct >= 85 ? 'ok' : 'warn';
    $('cGestures').textContent = f.bodyHands.gesturesAvailable ? f.bodyHands.gestures : '—';
    $('cGestures').title = f.bodyHands.gesturesAvailable ? 'Qualified gesture events' : f.bodyHands.gestureUnavailableReason;
    const gr = $('gRate');
    gr.textContent = f.bodyHands.gestureRate != null
      ? `${f.bodyHands.gestureRate} / min · corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]}`
      : `corridor ${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min`;
    const hs = $('handsState');
    if (f.bodyHands.visibility === 'BOTH') { hs.className = 'hands-state ok'; hs.textContent = 'BOTH HANDS VISIBLE · L + R'; }
    else if (f.bodyHands.visibility === 'LEFT') { hs.className = 'hands-state partial'; hs.textContent = 'ONE HAND VISIBLE · LEFT'; }
    else if (f.bodyHands.visibility === 'RIGHT') { hs.className = 'hands-state partial'; hs.textContent = 'ONE HAND VISIBLE · RIGHT'; }
    else if (f.state === 'LISTENING' || f.state === 'THINKING' || f.state === 'PAUSE') {
      hs.className = 'hands-state listening'; hs.textContent = 'HANDS OUT OF FRAME · OK WHILE LISTENING';
    } else { hs.className = 'hands-state bad'; hs.textContent = '⚠ HANDS NOT OBSERVABLE'; }
    const body = $('bodyCard');
    body.dataset.activity = ['LISTENING', 'THINKING', 'PAUSE'].includes(f.state)
      ? 'listening'
      : !f.bodyHands.handsVisible
        ? 'hidden'
        : f.bodyHands.gestureState === 'HEALTHY'
          ? 'healthy'
          : 'low';

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
    if (rec.state === 'FINALIZING') { rec.finalizeT += dt; renderDock(); }
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
    if (rec.state === 'FINALIZING') { rec.finalizeT += dt; renderDock(); }
    domSync(engine.frame());
    paintVV();
  }, 500);

  /* ---------- interactions ---------- */
  async function startAnalytics() {
    if (analyticsStarted) return;
    const button = $('startAnalytics');
    button.disabled = true;
    $('captureStatus').textContent = 'Requesting your camera and microphone…';
    try {
      const bootstrap = await ivocApi.bootstrap();
      engine.csrfToken = ivocApi.csrfToken;
      const stream = await engine.start({
        cameraDeviceId: draft.cameraDeviceId,
        microphoneDeviceId: draft.microphoneDeviceId,
      });
      accountSession = await ivocApi.createSession({
        title: draft.title || q.text.split(' ').slice(0, 6).join(' '),
        sessionType: draft.mode || 'question',
        questionId: q.id,
        questionText: q.text,
        analyticsSchema: 'ivoc.analytics.v1',
        recordingEnabled: ui.recording === true,
      });
      recorder = new AccountRecordingController({
        api: ivocApi,
        stream,
        enabled: ui.recording,
        sessionId: accountSession.id,
        title: draft.title || q.text,
        questionId: q.id,
        sessionNow: () => Math.max(0, Number(engine.frame()?.t || 0) * 1000),
      });
      recorder.addEventListener('state', (event) => {
        rec.state = event.detail.state;
        rec.elapsed = event.detail.elapsedMs / 1000;
        renderDock(); recMirrorSync();
      });
      if (ui.recording) {
        await recorder.start();
        engine.events.push({ t: engine.frame().t, kind: 'recording-start', label: 'Recording started' });
      }
      engine.events.push({ t: engine.frame().t, kind: 'question', label: `Question · ${q.text}` });
      analyticsStarted = true;
      $('captureStart').hidden = true;
      $('captureStatus').textContent = `Authenticated as ${bootstrap.identity?.displayName || 'MissionMed student'}`;
      await refreshLiveDevices('ANALYTICS LIVE · DEVICES READY');
      toast('Analytics live — speak and move to test every instrument.', 'save');
    } catch (error) {
      button.disabled = false;
      $('captureStatus').textContent = `Analytics could not start: ${error.message}`;
      toast('Camera/microphone or authenticated session is unavailable.', 'rec');
    }
  }

  async function sealAndStop() {
    if (finalizing) return;
    if (!analyticsStarted) { toast('Start analytics first.', 'info'); return; }
    finalizing = true;
    rec.state = ui.recording ? 'FINALIZING' : 'OFF'; rec.finalizeT = 0;
    renderDock(); recMirrorSync();
    try {
      if (ui.recording) engine.events.push({ t: engine.frame().t, kind: 'recording-stop', label: 'Recording stopped' });
      const [recordingResult, runtimeResult] = await Promise.all([
        recorder?.stopAndSeal?.() || Promise.resolve(null),
        engine.finish(),
      ]);
      rec.state = recordingResult ? 'SAVED' : 'OFF';
      renderDock(); recMirrorSync();
      await finishToProcessing(runtimeResult, recordingResult);
    } catch (error) {
      finalizing = false;
      rec.state = 'ERROR';
      toast(`Save failed — ${error.message}. Your capture remains in this tab for retry.`, 'rec');
      renderDock();
    }
  }
  async function finishToProcessing(runtimeResult = null, recordingResult = null) {
    const f = runtimeResult?.frame || engine.frame();
    const analyticsDurationMs = Math.max(0, Math.round(runtimeResult?.analytics?.durationMs ?? (runtimeResult?.frame?.t || f.t || 0) * 1000));
    const recordingDurationMs = recordingResult?.durationMs ?? recordingResult?.recording?.durationMs ?? null;
    const playableDurationMs = ui.recording && Number.isFinite(Number(recordingResult?.playableDurationMs ?? recordingDurationMs))
      ? Math.max(0, Math.round(Number(recordingResult?.playableDurationMs ?? recordingDurationMs)))
      : analyticsDurationMs;
    const history = runtimeResult?.history || engine.history.slice();
    const activeAnsweringDurationMs = history.reduce((total, point, index) => {
      const next = history[index + 1];
      if (point?.state !== 'ANSWERING' || !Number.isFinite(point?.t)) return total;
      const end = Number.isFinite(next?.t) ? next.t : analyticsDurationMs / 1000;
      return total + Math.max(0, Math.min(5, end - point.t)) * 1000;
    }, 0);
    const observedTimes = history.map(point => Number(point?.t)).filter(Number.isFinite);
    const analyticsObservationDurationMs = observedTimes.length > 1
      ? Math.max(0, Math.round((observedTimes.at(-1) - observedTimes[0]) * 1000))
      : 0;
    const handPresenceEvent = runtimeResult?.analytics?.events?.find?.((event) => event.metric === 'hand_presence') || null;
    const handPresenceFraction = Number.isFinite(Number(handPresenceEvent?.observation?.value))
      ? Math.max(0, Math.min(1, Number(handPresenceEvent.observation.value)))
      : null;
    const handsPresence = {
      available: handPresenceFraction !== null
        && handPresenceEvent?.quality?.reliability !== 'unavailable'
        && Number(handPresenceEvent?.quality?.coverage || 0) > 0,
      fraction: handPresenceFraction,
      analyzableFrames: runtimeResult?.analytics?.modalities?.camera?.analyzableFrames ?? null,
      provenance: 'FULL_SESSION_CAMERA_OBSERVATION',
    };
    const resultEnvelope = {
      schema: 'ivoc.analytics.v1',
      schemaVersion: 1,
      sessionId: accountSession?.id || null,
      capturedAt: new Date().toISOString(),
      durationMs: playableDurationMs,
      sessionDurationMs: analyticsDurationMs,
      recordingDurationMs: Number.isFinite(Number(recordingDurationMs)) ? Math.round(Number(recordingDurationMs)) : null,
      playableDurationMs,
      activeAnsweringDurationMs: Math.round(activeAnsweringDurationMs),
      analyticsObservationDurationMs,
      recordingStartSessionMs: Number.isFinite(Number(recordingResult?.recordingStartSessionMs))
        ? Math.round(Number(recordingResult.recordingStartSessionMs))
        : null,
      pausedSpans: Array.isArray(recordingResult?.pausedSpans)
        ? recordingResult.pausedSpans.map(span => ({ startMs: Number(span.startMs), endMs: Number(span.endMs) }))
        : [],
      scores: {
        pace: INSTRUMENTS[0]._last ?? null,
        volume: INSTRUMENTS[1]._last ?? null,
        variety: lastVarietyScore,
      },
      wpmLastObserved: INSTRUMENTS[0]._lastWpm ?? null,
      wpmAvg: INSTRUMENTS[0]._lastWpm ?? null,
      counters: {
        nods: f.headFace.nodsAvailable ? f.headFace.nods : null,
        smiles: f.headFace.smileEventsAvailable ? f.headFace.smileEvents : null,
        gestures: f.bodyHands.gesturesAvailable ? f.bodyHands.gestures : null,
        handsPct: handsPresence.available ? Math.round(handsPresence.fraction * 100) : null,
      },
      handsPresence,
      events: runtimeResult?.events || engine.events.slice(),
      history,
      metrics: runtimeResult?.snapshot?.metrics || null,
      behavior: runtimeResult?.behavior || null,
      analytics: runtimeResult?.analytics || null,
    };
    if (accountSession?.id) await ivocApi.saveResults(accountSession.id, resultEnvelope);
    session.last = {
      id: accountSession?.id || null,
      recordingId: recordingResult?.recording?.id || recorder?.recording?.id || null,
      title: draft.title || q.text.split(' ').slice(0, 4).join(' '),
      question: q,
      dur: playableDurationMs / 1000,
      sessionDur: analyticsDurationMs / 1000,
      recordingDur: Number.isFinite(Number(recordingDurationMs)) ? Number(recordingDurationMs) / 1000 : null,
      playableDur: playableDurationMs / 1000,
      answeringDur: activeAnsweringDurationMs / 1000,
      analyticsObservationDur: analyticsObservationDurationMs / 1000,
      recordingStartSessionMs: resultEnvelope.recordingStartSessionMs,
      pausedSpans: resultEnvelope.pausedSpans,
      recorded: ui.recording,
      scores: {
        pace: INSTRUMENTS[0]._last ?? null,
        volume: INSTRUMENTS[1]._last ?? null,
        variety: lastVarietyScore,
      },
      wpmAvg: INSTRUMENTS[0]._lastWpm ?? null,
      counters: resultEnvelope.counters,
      handsPresence,
      events: resultEnvelope.events,
      history: resultEnvelope.history,
      t: f.t,
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
    if (t.closest('#startAnalytics')) { void startAnalytics(); return; }
    if (t.closest('#roomDevices')) {
      const panel = $('roomDevicePanel');
      panel.hidden = !panel.hidden;
      $('roomDevices').setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) void refreshLiveDevices().catch((error) => {
        $('roomDeviceStatus').textContent = `DEVICE LIST UNAVAILABLE · ${error.message}`;
      });
      return;
    }
    if (t.closest('#roomDeviceClose')) {
      $('roomDevicePanel').hidden = true;
      $('roomDevices').setAttribute('aria-expanded', 'false');
      return;
    }
    if (t.closest('#roomDeviceRefresh')) {
      void refreshLiveDevices().catch((error) => {
        $('roomDeviceStatus').textContent = `DEVICE REFRESH FAILED · ${error.message}`;
      });
      return;
    }
    if (t.closest('#finishBtn')) { void sealAndStop(); return; }
    if (t.closest('#dockPause')) {
      if (recorder?.pause()) engine.events.push({ t: engine.frame().t, kind: 'recording-pause', label: 'Recording paused' });
      toast('Recording paused', 'rec'); return;
    }
    if (t.closest('#dockResume')) {
      if (recorder?.resume()) engine.events.push({ t: engine.frame().t, kind: 'recording-resume', label: 'Recording resumed' });
      toast('Recording resumed', 'rec'); return;
    }
    if (t.closest('#dockRetry')) { void sealAndStop(); return; }
    if (t.closest('#dockStop')) { sealAndStop(); return; }
    const overlayToggle = t.closest('[data-overlay]');
    if (overlayToggle) {
      const key = overlayToggle.dataset.overlay;
      const enabled = overlayToggle.getAttribute('aria-pressed') !== 'true';
      overlayToggle.setAttribute('aria-pressed', String(enabled));
      overlayToggle.classList.toggle('on', enabled);
      engine.setOverlayVisibility({ [key]: enabled });
      toast(`${key.toUpperCase()} overlay ${enabled ? 'ON' : 'OFF'} — measurement continues`, 'info');
      return;
    }
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
    if ($('volTuneLo')) $('volTuneLo').textContent = CALIBRATION.volumeCorridorLu[0];
    if ($('volTuneHi')) $('volTuneHi').textContent = `+${CALIBRATION.volumeCorridorLu[1]}`;
    $('corr-pace').textContent = INSTRUMENTS[0].corridorLabel();
    $('corr-volume').textContent = INSTRUMENTS[1].corridorLabel();
    clearTimeout(liveScreen._preferenceTimer);
    liveScreen._preferenceTimer = setTimeout(() => {
      void ivocApi.savePreferences({
        calibration: { paceCorridor: CALIBRATION.paceCorridor, volumeCorridorLu: CALIBRATION.volumeCorridorLu, gestureCorridor: CALIBRATION.gestureCorridor },
        visibility: { analyticsVisible: ui.analyticsVisible }, coachingEnabled: ui.coaching, recordingDefault: ui.recording,
      }).catch(() => {});
    }, 450);
  });

  el.addEventListener('change', e => {
    if (e.target === $('liveCameraSelect')) { void switchLiveDevice('camera', e.target.value); return; }
    if (e.target === $('liveMicrophoneSelect')) void switchLiveDevice('microphone', e.target.value);
  });

  async function escMenu() {
    cancelAnimationFrame(raf);
    const resume = await confirmModal({
      title: 'PAUSED — INTERVIEW ROOM',
      body: 'Measurement is suspended while this menu is open. End &amp; save seals your recording and computes results.',
      okLabel: 'RESUME', cancelLabel: 'END & SAVE',
    });
    if (resume) { lastTs = performance.now(); raf = requestAnimationFrame(loop); }
    else void sealAndStop();
  }

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      clearInterval(hiddenIv);
      clearTimeout(deviceRefreshTimer);
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      whisper(null);
      recorder?.destroy();
      engine.destroy();
    },
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
  live: { render: liveScreen, env: false, hilite: 'practice', autoFocus: false, railHidden: true },
  processing: { render: processingScreen, envTheme: 'results', hilite: 'results', railHidden: true },
};
