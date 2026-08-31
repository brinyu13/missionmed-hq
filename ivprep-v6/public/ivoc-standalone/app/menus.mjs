/* ============================================================
   3528B — Menu screens: home lobby, practice mode select,
   question select, setup, ready, recovery.
   Fortnite interaction grammar · MissionMed identity.
   ============================================================ */
import { sceneDataUri } from './art.mjs';
import { CATEGORIES, QUESTIONS, CALIBRATION } from './data.mjs';
import { accountName } from './account.mjs';
import { ivocApi } from './api.mjs';
import { ui, saveUi, draft, saveDraft, go, toast, focusCtl, setReducedMotion, session } from './main.mjs';

const catOf = id => CATEGORIES.find(c => c.id === id);
const qOf = id => QUESTIONS.find(q => q.id === id);
function svgIcon(d, size = 18, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
function pips(n) {
  return `<span class="pips">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

function fillDeviceSelect(select, devices, selectedId, fallbackLabel) {
  select.replaceChildren();
  for (const [index, device] of devices.entries()) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `${fallbackLabel} ${index + 1}`;
    option.selected = device.deviceId === selectedId;
    select.appendChild(option);
  }
}

async function mountDevicePreview(video, meter = null, { cameraDeviceId = '', microphoneDeviceId = '' } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 }, height: { ideal: 720 },
      ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : { facingMode: 'user' }),
    },
    audio: {
      channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      ...(microphoneDeviceId ? { deviceId: { exact: microphoneDeviceId } } : {}),
    },
  });
  video.srcObject = stream;
  await video.play();
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!meter) return;
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const value of samples) { const x = (value - 128) / 128; sum += x * x; }
    const rms = Math.sqrt(sum / samples.length);
    meter.style.width = `${Math.max(3, Math.min(100, rms * 420))}%`;
  };
  loop();
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === 'videoinput');
  const microphones = devices.filter((d) => d.kind === 'audioinput');
  const cameraTrack = stream.getVideoTracks()[0] || null;
  const microphoneTrack = stream.getAudioTracks()[0] || null;
  const cameraId = cameraTrack?.getSettings?.().deviceId || cameraDeviceId || cameras[0]?.deviceId || '';
  const microphoneId = microphoneTrack?.getSettings?.().deviceId || microphoneDeviceId || microphones[0]?.deviceId || '';
  return {
    stream,
    cameras,
    microphones,
    cameraId,
    microphoneId,
    camera: cameras.find((d) => d.deviceId === cameraId)?.label || cameraTrack?.label || 'Browser camera',
    microphone: microphones.find((d) => d.deviceId === microphoneId)?.label || microphoneTrack?.label || 'Browser microphone',
    destroy: () => { cancelAnimationFrame(raf); stream.getTracks().forEach((track) => track.stop()); void context.close(); video.srcObject = null; },
  };
}

/* ================= HOME — the lobby ================= */
const MODES = [
  {
    id: 'quick', art: 'quick', kicker: 'FASTEST REP', title: 'Quick Practice',
    sub: 'One question, straight into the room. Speaking in under a minute.',
    facts: [['Duration', '~2 min'], ['Questions', '1 · auto-drawn'], ['Recording', 'ON'], ['Coaching', 'ON']],
  },
  {
    id: 'question', art: 'question', kicker: 'TARGETED WORK', title: 'Question Practice',
    sub: 'Drill the exact question or category you\'re worried about.',
    facts: [['Duration', '~4 min'], ['Questions', '1 · your pick'], ['Recording', 'ON'], ['Coaching', 'ON']],
  },
  {
    id: 'mock', art: 'mock', kicker: 'FULL DRESS', title: 'Self Mock Interview',
    sub: 'Multi-question set, clean interview-only room, recording on.',
    facts: [['Duration', '12–20 min'], ['Questions', 'up to 5 · ordered'], ['Recording', 'ON'], ['Coaching', 'Whispers off by default']],
  },
];

async function homeScreen(el) {
  const library = await ivocApi.library().catch(() => ({ sessions: [] }));
  const rows = library.sessions || [];
  const latest = rows[0] || null;
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">MISSIONMED · <b>IV PREP ON-CALL</b></span>
    <span class="spacer"></span>
    <span class="chip teal"><span class="dot"></span>STREAK · 3 DAYS</span>
    ${latest ? `<button class="chip" data-focusable data-continue>${svgIcon('M7 4.5v15l12-7.5z', 13)} CONTINUE · ${latest.title.toUpperCase()}</button>` : '<span class="chip">NO SAVED REPS YET</span>'}
  </div>
  <div class="home-body">
    <div class="home-title">
      <div class="home-kicker">YOUR ARENA IS OPEN</div>
      <h1 class="t-display">READY TO TRAIN,<br>${accountName().toUpperCase()}?</h1>
      <div class="home-sub">Camera on, analytics live — every rep recorded to your library.</div>
    </div>
  </div>
  <div class="lobby-row" role="list">
    ${MODES.map((m, i) => `
      <button class="lobby-card hero" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-mode="${m.id}" role="listitem" aria-label="${m.title}">
        <span class="lc-art" style="background-image:${sceneDataUri(m.art)}"></span>
        <span class="lc-shade"></span>
        ${i === 0 ? '<span class="lc-flag">RECOMMENDED</span>' : ''}
        <span class="lc-text"><em>${m.kicker}</em><b>${m.title}</b></span>
        <span class="lc-enter">PRESS ENTER ▸</span>
      </button>`).join('')}
    <button class="lobby-card sec" data-focusable data-go="library" aria-label="Video Library">
      <span class="lc-art" style="background-image:${sceneDataUri('library')}"></span>
      <span class="lc-shade"></span>
      <span class="lc-text"><em>YOUR FILM</em><b>Video Library</b></span>
      <span class="lc-count">${rows.length}</span>
    </button>
    <button class="lobby-card sec" data-focusable data-go="results" aria-label="Results">
      <span class="lc-art" style="background-image:${sceneDataUri('results')}"></span>
      <span class="lc-shade"></span>
      <span class="lc-text"><em>LAST MATCH</em><b>Results</b></span>
    </button>
    <button class="lobby-card sec" data-focusable data-go="progress" aria-label="Progress">
      <span class="lc-art" style="background-image:${sceneDataUri('progress')}"></span>
      <span class="lc-shade"></span>
      <span class="lc-text"><em>TRAJECTORY</em><b>Progress</b></span>
    </button>
  </div>`;

  el.addEventListener('click', e => {
    const mode = e.target.closest('[data-mode]');
    if (mode) { startMode(mode.dataset.mode); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    if (latest && e.target.closest('[data-continue]')) { draft.mode = latest.sessionType || 'question'; draft.qids = [latest.questionId || 'q1']; saveDraft(); go('setup'); }
  });
}

export function startMode(mode) {
  draft.mode = mode;
  if (mode === 'quick') {
    const pick = QUESTIONS[0];
    draft.qids = [pick.id];
    saveDraft();
    go('setup');
  } else {
    draft.qids = draft.qids && draft.mode === mode ? draft.qids : [];
    saveDraft();
    go('questions');
  }
}

/* ================= PRACTICE — mode select ================= */
function practiceScreen(el) {
  let sel = Math.max(0, MODES.findIndex(m => m.id === draft.mode));
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">PRACTICE / <b>SELECT A MODE</b></span>
  </div>
  <div class="mode-stage">
    <div class="mode-row">
      ${MODES.map((m, i) => `
        <button class="mode-card" data-focusable ${i === sel ? 'data-autofocus' : ''} data-i="${i}" aria-label="${m.title}">
          <span class="mc-art" style="background-image:${sceneDataUri(m.art)}"></span>
          <span class="mc-shade"></span>
          <span class="mc-title">${m.title}</span>
          <span class="mc-play">PLAY</span>
        </button>`).join('')}
    </div>
    <div class="mode-caption t-label">SELECT A PRACTICE MODE</div>
    <div class="mode-facts" id="modeFacts"></div>
  </div>
  <div class="backnext">
    <button class="btn btn-quiet" data-focusable data-back>◂ BACK</button>
    <span class="spacer"></span>
    <button class="btn btn-gold" data-focusable data-next>NEXT ▸ <span id="nextMode"></span></button>
  </div>`;

  const cards = [...el.querySelectorAll('.mode-card')];
  const facts = el.querySelector('#modeFacts');
  const nextLbl = el.querySelector('#nextMode');
  function paint() {
    cards.forEach((c, i) => c.classList.toggle('sel', i === sel));
    const m = MODES[sel];
    facts.innerHTML = m.facts.map(([k, v]) => `<span class="fact"><em>${k}</em><b>${v}</b></span>`).join('');
    facts.insertAdjacentHTML('afterbegin', `<span class="fact wide"><b>${m.sub}</b></span>`);
    nextLbl.textContent = m.title.toUpperCase();
  }
  paint();
  el.addEventListener('click', e => {
    const c = e.target.closest('.mode-card');
    if (c) {
      const i = +c.dataset.i;
      if (i === sel) { startMode(MODES[sel].id); return; }
      sel = i; paint(); return;
    }
    if (e.target.closest('[data-back]')) go('home');
    if (e.target.closest('[data-next]')) startMode(MODES[sel].id);
  });
  el.addEventListener('focusin', e => { }, true);
  // arrow-focus also selects
  const obs = new MutationObserver(() => {
    const f = el.querySelector('.mode-card.is-focused');
    if (f && +f.dataset.i !== sel) { sel = +f.dataset.i; paint(); }
  });
  cards.forEach(c => obs.observe(c, { attributes: true, attributeFilter: ['class'] }));
  return { destroy: () => obs.disconnect() };
}

/* ================= QUESTIONS — spatial select ================= */
async function questionsScreen(el) {
  const library = await ivocApi.library().catch(() => ({ sessions: [] }));
  const practiceStats = new Map();
  for (const row of library.sessions || []) {
    if (!row.questionId) continue;
    const prior = practiceStats.get(row.questionId) || { practiced: 0, best: null };
    prior.practiced += 1;
    const scores = Object.values(row.results?.payload?.scores || {}).map(Number).filter(Number.isFinite);
    const overall = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
    if (overall != null) prior.best = prior.best == null ? overall : Math.max(prior.best, overall);
    practiceStats.set(row.questionId, prior);
  }
  const multi = draft.mode === 'mock';
  let cat = 'all';
  let picked = new Set(draft.qids || []);
  let previewId = draft.qids?.[0] || QUESTIONS[0].id;
  if (ui.favorites == null) ui.favorites = QUESTIONS.filter(q => q.fav).map(q => q.id);

  el.innerHTML = `
  <div class="topline">
    <span class="crumb">${multi ? 'SELF MOCK' : 'QUESTION PRACTICE'} / <b>PICK ${multi ? 'YOUR SET' : 'YOUR QUESTION'}</b></span>
    <span class="spacer"></span>
    <span class="chip">${QUESTIONS.length} IN CORPUS · NO TYPING NEEDED</span>
  </div>
  <div class="q-rail" id="qRail"></div>
  <div class="q-body">
    <div class="q-grid" id="qGrid"></div>
    <aside class="q-preview" id="qPreview"></aside>
  </div>
  <div class="backnext">
    <button class="btn btn-quiet" data-focusable data-back>◂ BACK</button>
    <span class="spacer"></span>
    ${multi ? '<div class="q-tray" id="qTray"></div><span class="spacer"></span>' : ''}
    <button class="btn btn-gold" data-focusable data-next id="qNext">NEXT ▸</button>
  </div>`;

  const railEl = el.querySelector('#qRail');
  const gridEl = el.querySelector('#qGrid');
  const prevEl = el.querySelector('#qPreview');
  const nextBtn = el.querySelector('#qNext');
  const trayEl = el.querySelector('#qTray');

  function catList() {
    const favs = new Set(ui.favorites);
    return [
      { id: 'all', label: 'All', icon: 'M4 6h16M4 12h16M4 18h16', color: '#c2cde0', n: QUESTIONS.length },
      ...CATEGORIES.map(c => ({ ...c, n: QUESTIONS.filter(q => q.cat === c.id).length })),
      { id: 'fav', label: 'Favorites', icon: 'M12 21s-7-4.6-9-9a5.2 5.2 0 019-4 5.2 5.2 0 019 4c-2 4.4-9 9-9 9z', color: '#ff6f91', n: favs.size },
    ];
  }
  function renderRail() {
    railEl.innerHTML = catList().map(c => `
      <button class="qcat ${cat === c.id ? 'on' : ''}" data-focusable data-cat="${c.id}" style="--cc:${c.color}">
        ${svgIcon(c.icon, 16)}<span>${c.label}</span><i>${c.n}</i>
      </button>`).join('');
  }
  function visible() {
    const favs = new Set(ui.favorites);
    if (cat === 'all') return QUESTIONS;
    if (cat === 'fav') return QUESTIONS.filter(q => favs.has(q.id));
    return QUESTIONS.filter(q => q.cat === cat);
  }
  function renderGrid() {
    const favs = new Set(ui.favorites);
    gridEl.innerHTML = visible().map((q, i) => {
      const c = catOf(q.cat);
      const on = picked.has(q.id);
      return `
      <button class="qcard ${on ? 'sel' : ''} ${previewId === q.id ? 'pv' : ''}" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-q="${q.id}" style="--cc:${c.color}">
        <span class="qc-top"><span class="qc-cat">${svgIcon(c.icon, 13)} ${c.label}</span>${pips(q.diff)}</span>
        <span class="qc-text">${q.text}</span>
        <span class="qc-foot">
          ${practiceStats.get(q.id)?.practiced ? `<span>practiced ×${practiceStats.get(q.id).practiced}${practiceStats.get(q.id).best ? ` · best ${practiceStats.get(q.id).best.toFixed(1)}` : ''}</span>` : '<span class="new">not practiced yet</span>'}
          <span class="qc-fav ${favs.has(q.id) ? 'on' : ''}" data-fav="${q.id}" title="Favorite">♥</span>
        </span>
        ${on ? `<span class="qc-tick">${multi ? [...picked].indexOf(q.id) + 1 : '✓'}</span>` : ''}
      </button>`;
    }).join('') || '<div class="q-empty">No favorites yet — tap ♥ on any card.</div>';
  }
  function renderPreview() {
    const q = qOf(previewId);
    if (!q) { prevEl.innerHTML = ''; return; }
    const c = catOf(q.cat);
    prevEl.innerHTML = `
      <div class="qp-kicker" style="color:${c.color}">${svgIcon(c.icon, 15)} ${c.label.toUpperCase()} · ${'●'.repeat(q.diff)}${'○'.repeat(3 - q.diff)}</div>
      <div class="qp-text">“${q.text}”</div>
      <div class="qp-meta">
        <span><em>PRACTICED</em><b>${practiceStats.get(q.id)?.practiced || '—'}</b></span>
        <span><em>PERSONAL BEST</em><b>${practiceStats.get(q.id)?.best ? practiceStats.get(q.id).best.toFixed(1) : '—'}</b></span>
        <span><em>AVG LENGTH</em><b>${q.diff + 1}:${q.diff * 15 || '00'}0</b></span>
      </div>
      <button class="btn btn-gold qp-start" data-focusable data-start="${q.id}">▸ START PRACTICE</button>
      <div class="qp-note">${multi ? 'Enter adds to your set · up to 5, ordered.' : 'Enter selects · Start launches setup with this question.'}</div>`;
  }
  function renderTray() {
    if (!trayEl) return;
    trayEl.innerHTML = picked.size
      ? [...picked].map((id, i) => `<span class="traychip">${i + 1} · ${qOf(id).text.slice(0, 26)}…<b data-untray="${id}">✕</b></span>`).join('')
      : '<span class="tray-hint">Pick up to 5 questions in order</span>';
  }
  function sync() {
    renderGrid(); renderPreview(); renderTray();
    nextBtn.disabled = picked.size === 0;
    nextBtn.innerHTML = picked.size ? `NEXT ▸ ${multi ? picked.size + ' QUESTION' + (picked.size > 1 ? 'S' : '') : 'SETUP'}` : 'PICK A QUESTION';
  }
  renderRail(); sync();

  el.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      e.stopPropagation();
      const id = fav.dataset.fav;
      const favs = new Set(ui.favorites);
      favs.has(id) ? favs.delete(id) : favs.add(id);
      ui.favorites = [...favs]; saveUi(); sync(); renderRail();
      return;
    }
    const cc = e.target.closest('[data-cat]');
    if (cc) { cat = cc.dataset.cat; renderRail(); sync(); return; }
    const qc = e.target.closest('[data-q]');
    if (qc) {
      const id = qc.dataset.q;
      previewId = id;
      if (multi) {
        if (picked.has(id)) picked.delete(id);
        else if (picked.size < 5) picked.add(id);
        else toast('Mock set holds five questions — remove one first.', 'info');
      } else picked = new Set([id]);
      draft.qids = [...picked]; saveDraft(); sync();
      return;
    }
    const un = e.target.closest('[data-untray]');
    if (un) { picked.delete(un.dataset.untray); draft.qids = [...picked]; saveDraft(); sync(); return; }
    const st = e.target.closest('[data-start]');
    if (st) { if (!picked.size) picked = new Set([st.dataset.start]); draft.qids = [...picked]; saveDraft(); go('setup'); return; }
    if (e.target.closest('[data-back]')) go('practice');
    if (e.target.closest('[data-next]') && picked.size) go('setup');
  });
}

/* ================= SETUP — devices + toggles ================= */
async function setupScreen(el) {
  if (!draft.qids || !draft.qids.length) { go('questions'); return; }
  const qs = draft.qids.map(qOf).filter(Boolean);
  const modeName = MODES.find(m => m.id === draft.mode)?.title || 'Practice';
  draft.cam = draft.cam || 'Browser camera';
  draft.mic = draft.mic || 'Browser microphone';
  saveDraft();

  el.innerHTML = `
  <div class="topline">
    <span class="crumb">${modeName.toUpperCase()} / <b>LOCK IN YOUR SETUP</b></span>
    <span class="spacer"></span>
    <span class="chip teal"><span class="dot"></span>PRIVATE DEVICE CHECK</span>
  </div>
  <div class="setup-body">
    <section class="setup-left">
      <div class="panel">
        <div class="t-label pl-title">CAMERA</div>
        <label class="device-select">${svgIcon('M3 7h12v10H3zM15 11l6-3.5v9L15 13', 16)}<select id="camSelect" data-focusable aria-label="Camera"><option>Requesting camera permission…</option></select><i>▾</i></label>
        <div class="setup-feed">
          <video id="setupFeed" playsinline muted></video>
          <span class="feed-tag">LIVE PREVIEW · REAL CAMERA</span>
          <span class="feed-guide"></span>
        </div>
        <div class="miclevel"><span class="t-label">MIC</span><div class="micbar"><i id="micFill"></i></div><b class="device-state" id="micState">REQUESTING</b></div>
        <label class="device-select">${svgIcon('M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 6 0 0012 0M12 17v4', 16)}<select id="micSelect" data-focusable aria-label="Microphone"><option>Requesting microphone permission…</option></select><i>▾</i></label>
        <div class="device-readiness" id="deviceReadiness"><span>CAMERA · REQUESTING</span><span>MICROPHONE · REQUESTING</span></div>
      </div>
    </section>
    <section class="setup-mid">
      <div class="panel">
        <div class="t-label pl-title">THIS SESSION</div>
        <div class="sess-q">
          ${qs.map((q, i) => `<div class="sess-qrow" data-focusable data-editq>${qs.length > 1 ? `<b>${i + 1}</b>` : ''}<span>“${q.text}”</span>${svgIcon('M4 20l4-1L20 7l-3-3L5 16z', 14)}</div>`).join('')}
        </div>
        <div class="sess-title">
          <em class="t-label">SESSION TITLE</em>
          <b id="sessTitle">${draft.title || `${qs[0].text.split(' ').slice(0, 3).join(' ')} · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</b>
          <button class="chip" data-focusable data-rename>✎ RENAME</button>
        </div>
      </div>
      <div class="panel">
        <div class="t-label pl-title">SESSION OPTIONS</div>
        <button class="gtoggle t-red" role="switch" aria-checked="${ui.recording}" data-focusable data-tog="recording">
          <span class="tx"><b>Recording</b><small>Saved to your MissionMed library — only you and your mentors can view.</small></span><span class="knob"></span>
        </button>
        <button class="gtoggle" role="switch" aria-checked="${ui.coaching}" data-focusable data-tog="coaching">
          <span class="tx"><b>Live coaching</b><small>One whisper at a time; measurement always runs.</small></span><span class="knob"></span>
        </button>
        <button class="gtoggle t-teal" role="switch" aria-checked="${ui.analyticsVisible}" data-focusable data-tog="analyticsVisible">
          <span class="tx"><b>Analytics visible</b><small>Off = clean interview-only room, still measuring.</small></span><span class="knob"></span>
        </button>
        <button class="gtoggle" role="switch" aria-checked="${ui.reducedMotion}" data-focusable data-tog="reducedMotion">
          <span class="tx"><b>Reduced motion</b><small>Static backgrounds, minimal animation.</small></span><span class="knob"></span>
        </button>
        <div class="rec-note ${ui.recording ? '' : 'warn'}" id="recNote"></div>
      </div>
    </section>
    <aside class="setup-right">
      <div class="panel">
        <div class="t-label pl-title">YOUR CALIBRATION</div>
        <div class="cal-row"><em>PACE CORRIDOR</em><b>${CALIBRATION.paceCorridor[0]}–${CALIBRATION.paceCorridor[1]} WPM → 7–8</b></div>
        <div class="cal-row"><em>VOLUME CORRIDOR</em><b>${CALIBRATION.volumeCorridorLu[0]}…+${CALIBRATION.volumeCorridorLu[1]} LU → 7–8</b></div>
        <div class="cal-row"><em>GESTURES</em><b>${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min</b></div>
        <div class="cal-note">Corridors are personal. Fine-tune inside each instrument (⚙) while live.</div>
      </div>
    </aside>
  </div>
  <div class="backnext">
    <button class="btn btn-quiet" data-focusable data-back>◂ BACK</button>
    <span class="spacer"></span>
    <button class="btn btn-gold" data-focusable data-autofocus data-next>READY SCREEN ▸</button>
  </div>`;

  const recNote = el.querySelector('#recNote');
  function syncRec() {
    recNote.className = `rec-note ${ui.recording ? '' : 'warn'}`;
    recNote.innerHTML = ui.recording
      ? '● Recording is ON — a red REC indicator stays visible for the whole session.'
      : '▲ NOT RECORDING — you\'ll get live analytics and results, but no replay in your library.';
  }
  syncRec();

  const micFill = el.querySelector('#micFill');
  const camSelect = el.querySelector('#camSelect');
  const micSelect = el.querySelector('#micSelect');
  const readiness = el.querySelector('#deviceReadiness');
  const micState = el.querySelector('#micState');
  let preview = null;
  let previewCancelled = false;
  let previewGeneration = 0;
  async function mountSelectedPreview() {
    const generation = ++previewGeneration;
    preview?.destroy();
    readiness.innerHTML = '<span>CAMERA · CONNECTING</span><span>MICROPHONE · CONNECTING</span>';
    micState.textContent = 'CONNECTING';
    const mounted = await mountDevicePreview(el.querySelector('#setupFeed'), micFill, {
      cameraDeviceId: draft.cameraDeviceId,
      microphoneDeviceId: draft.microphoneDeviceId,
    });
    if (previewCancelled || generation !== previewGeneration) { mounted.destroy(); return; }
    preview = mounted;
    draft.cameraDeviceId = mounted.cameraId;
    draft.microphoneDeviceId = mounted.microphoneId;
    draft.cam = mounted.camera;
    draft.mic = mounted.microphone;
    saveDraft();
    fillDeviceSelect(camSelect, mounted.cameras, mounted.cameraId, 'Camera');
    fillDeviceSelect(micSelect, mounted.microphones, mounted.microphoneId, 'Microphone');
    readiness.innerHTML = '<span class="ok">CAMERA · LIVE</span><span class="ok">MICROPHONE · LIVE</span>';
    micState.textContent = 'LIVE';
    micState.classList.add('ok');
  }
  void mountSelectedPreview().catch((error) => {
    readiness.innerHTML = '<span class="warn">CAMERA / MICROPHONE · UNAVAILABLE</span>';
    micState.textContent = 'CHECK PERMISSION';
    toast(`Camera/microphone unavailable: ${error.message}`, 'rec');
  });

  el.addEventListener('change', (event) => {
    if (event.target === camSelect) draft.cameraDeviceId = camSelect.value;
    else if (event.target === micSelect) draft.microphoneDeviceId = micSelect.value;
    else return;
    saveDraft();
    void mountSelectedPreview().catch((error) => toast(`Device switch failed: ${error.message}`, 'rec'));
  });

  el.addEventListener('click', async e => {
    const tog = e.target.closest('[data-tog]');
    if (tog) {
      const k = tog.dataset.tog;
      ui[k] = !ui[k]; saveUi();
      tog.setAttribute('aria-checked', ui[k]);
      if (k === 'reducedMotion') setReducedMotion(ui[k]);
      if (k === 'recording') syncRec();
      return;
    }
    if (e.target.closest('[data-rename]')) {
      const t = prompt('Session title (optional — the only typing in the app):', el.querySelector('#sessTitle').textContent.trim());
      if (t) { draft.title = t; saveDraft(); el.querySelector('#sessTitle').textContent = t; }
      return;
    }
    if (e.target.closest('[data-editq]')) { go(draft.mode === 'quick' ? 'practice' : 'questions'); return; }
    if (e.target.closest('[data-back]')) go(draft.mode === 'quick' ? 'home' : 'questions');
    if (e.target.closest('[data-next]')) go('ready');
  });

  return { destroy: () => { previewCancelled = true; preview?.destroy(); } };
}

/* ================= READY — frame up, then go ================= */
async function readyScreen(el) {
  if (!draft.qids || !draft.qids.length) { go('home'); return; }
  const q = qOf(draft.qids[0]);
  const modeName = MODES.find(m => m.id === draft.mode)?.title || 'Practice';
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">READY / <b>FRAME UP & GO</b></span>
    <span class="spacer"></span>
    <span class="chip ${ui.recording ? 'rec' : 'amber'}"><span class="dot"></span>${ui.recording ? 'REC ARMED' : 'NOT RECORDING'}</span>
  </div>
  <div class="ready-body">
    <div class="ready-stage">
      <video id="readyFeed" playsinline muted></video>
      <div class="ready-guide"><span></span></div>
      <div class="ready-guide-tag">GOLD POSITION GUIDE · ALIGN HEAD & SHOULDERS</div>
      <span class="feed-tag">LIVE PREVIEW · REAL CAMERA</span>
    </div>
    <aside class="ready-side">
      <div class="panel">
        <div class="t-label pl-title">THIS SESSION</div>
        <div class="cal-row"><em>MODE</em><b>${modeName}</b></div>
        <div class="cal-row"><em>QUESTION${draft.qids.length > 1 ? 'S' : ''}</em><b>${draft.qids.length > 1 ? draft.qids.length + ' in set' : ''}</b></div>
        <div class="ready-q">“${q.text}”</div>
        <div class="cal-row"><em>RECORDING</em><b class="${ui.recording ? 'ok' : 'warn'}">${ui.recording ? 'ON' : 'OFF'}</b></div>
        <div class="cal-row"><em>COACHING</em><b>${ui.coaching ? 'ON' : 'OFF'}</b></div>
      </div>
      <button class="btn btn-gold btn-xl ready-start" data-focusable data-autofocus data-start>▸ ENTER INTERVIEW ROOM</button>
      <div class="ready-note">Inside the room, Start Analytics arms real capture before you answer. Esc opens the pause menu at any time.</div>
      <button class="btn btn-quiet" data-focusable data-back>◂ BACK</button>
    </aside>
  </div>
  <div class="countdown" id="countdown" hidden><b></b></div>`;

  let preview = null;
  let previewCancelled = false;
  void mountDevicePreview(el.querySelector('#readyFeed'), null, {
    cameraDeviceId: draft.cameraDeviceId,
    microphoneDeviceId: draft.microphoneDeviceId,
  }).then((mounted) => {
    if (previewCancelled) { mounted.destroy(); return; }
    preview = mounted;
  }).catch((error) => toast(`Camera unavailable: ${error.message}`, 'rec'));
  let counting = false;
  el.addEventListener('click', e => {
    if (e.target.closest('[data-back]')) { go('setup'); return; }
    if (e.target.closest('[data-start]') && !counting) {
      counting = true;
      const cd = el.querySelector('#countdown');
      const num = cd.querySelector('b');
      if (ui.reducedMotion) { go('live'); return; }
      cd.hidden = false;
      let n = 3;
      num.textContent = n;
      const iv = setInterval(() => {
        n--;
        if (n === 0) { clearInterval(iv); go('live'); }
        else { num.textContent = n; num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; }
      }, 700);
      const skip = ev => { if (ev.key === 'Enter' || ev.key === ' ') { clearInterval(iv); removeEventListener('keydown', skip); go('live'); } };
      addEventListener('keydown', skip);
    }
  });
  return { destroy: () => { previewCancelled = true; preview?.destroy(); } };
}

/* ================= RECOVERY ================= */
function recoveryScreen(el) {
  el.innerHTML = `
  <div class="recovery">
    <div class="t-label" style="color:var(--g-amber)">SESSION INTERRUPTED</div>
    <h1 class="t-display-md">YOUR LAST TAKE WAS CUT SHORT.</h1>
    <p class="t-body" style="color:var(--g-mid)">A live interview refresh never splices — a broken take ends honestly. What was captured up to the interruption is safe.</p>
    <div class="rec-choices">
      <button class="rc-tile" data-focusable data-autofocus data-save>
        <b>SAVE WHAT WAS RECORDED</b><span>Seal the partial recording, compute results, mark the session interrupted.</span>
      </button>
      <button class="rc-tile" data-focusable data-resume>
        <b>RESUME SETUP</b><span>Same question and config — a fresh, clean take.</span>
      </button>
      <button class="rc-tile danger" data-focusable data-discard>
        <b>DISCARD</b><span>Delete the partial capture permanently.</span>
      </button>
    </div>
  </div>`;
  el.addEventListener('click', async e => {
    if (e.target.closest('[data-save]')) { toast('Partial session saved to your library.', 'save'); go('results'); }
    if (e.target.closest('[data-resume]')) go('ready');
    if (e.target.closest('[data-discard]')) {
      const { confirmModal } = await import('./main.mjs');
      if (await confirmModal({ title: 'Discard partial take?', body: 'The interrupted capture is deleted permanently. This cannot be undone.', okLabel: 'DISCARD', okClass: 'btn-red' })) go('home');
    }
  });
}

export const MENU_SCREENS = {
  home: { render: homeScreen, envTheme: 'lobby', world: 'assets/arena-world-day.jpg', hilite: 'home' },
  practice: { render: practiceScreen, envTheme: 'practice', back: 'home', hilite: 'practice' },
  questions: { render: questionsScreen, envTheme: 'practice', back: 'practice', hilite: 'practice' },
  setup: { render: setupScreen, envTheme: 'practice', back: 'questions', hilite: 'practice' },
  ready: { render: readyScreen, envTheme: 'practice', back: 'setup', hilite: 'practice', railHidden: true },
  recovery: { render: recoveryScreen, envTheme: 'lobby', back: 'home', hilite: 'home' },
};
