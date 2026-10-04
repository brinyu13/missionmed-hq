// Flight Recorder — shared-clock temporal instrument.
//  LIVE mode (low distraction): three voice traces on ONE labelled 0–10 axis (zero line =
//  silence), silence shading, gaps drawn as hatched intervals (never a line), plus a thin
//  glyph strip (question ◆, follow-up ◇, coaching ↕, recording ●, smile ☺, nod ◦, gesture ✦, hook ⚓).
//  FILM mode (rich): full lane set — VOICE 0–10, CONVERSATION STATE, HAND VISIBILITY,
//  FRAMING/PRESENCE, GESTURES, SMILES, HEAD NODS, COACHING, QUESTION/TURN, HOOKS, RECORDING,
//  SIGNAL GAPS — with a playhead synced to playback and seek-on-click (2 s pre-roll).
// Both modes read the SAME samples from trace-reducer.mjs; nothing is recomputed differently.

import { intervalRuns } from '../model/trace-reducer.mjs';

const COLORS = { vol: '#2fe7b0', pitch: '#a696ff', pace: '#39d6ff', variety: '#ffb84d' };
const WINDOWS = { '30S': 30, '1M': 60, '3M': 180, '5M': 300, FULL: Infinity };

// Reuse the recovered Film Room lane grammar in a compact live deck. These are
// observed bands/marks on the existing recording clock, not new producers.
export function compactRecorderLanes(samples, events) {
  const runs=(key)=>intervalRuns(samples,key).map(r=>({t:r.startT,end:r.endT+.5,value:r.value}));
  const marks=(kinds)=>events.filter(e=>kinds.includes(e.kind)&&Number.isFinite(e.t)).map(e=>({...e,value:e.label||e.kind}));
  return [
    {name:'Conversation',kind:'state',bands:runs('state')},
    {name:'Hands',kind:'hands',bands:runs('hands')},
    {name:'Framing / presence',kind:'presence',bands:runs('presence'),marks:marks(['framing'])},
    {name:'Gestures',marks:marks(['gesture'])},
    {name:'Smiles',marks:marks(['smile'])},
    {name:'Nods',marks:marks(['nod'])},
    {name:'Coaching',marks:marks(['cue'])},
    {name:'Question / turn',marks:marks(['question','answer','followup','closing','overlap'])},
    {name:'Hooks',marks:marks(['hook'])},
    {name:'Recording',marks:marks(['recording'])},
    {name:'Signal gaps',kind:'gap',bands:runs('signalGap'),marks:marks(['gap'])},
  ];
}

export function recorderMarkup({ mode = 'live' } = {}) {
  return `
  <div class="recorder-head" data-provenance="RECOVERED + MODERNIZED" title="Flight Recorder · recovered 3528C 14-lane deck + 3527 shared 0–10 axis, modernized to solid blocks/bands and 12 replay lanes; reducer: ivoc.trace-reducer.v1 (null = gap)">
    <div class="legend"><span class="t-label" style="color:var(--ink2)">Flight Recorder</span><span><i class="vol"></i>Volume</span><span><i class="pit"></i>Pitch</span><span><i class="pace"></i>Pace</span>${mode === 'film' ? '<span><i class="var"></i>Variety</span>' : ''}<span class="t-tech" id="fr-axis">shared 0–10 · zero = silence</span></div>
    <div style="display:flex;gap:10px;align-items:center"><span class="t-tech" id="fr-clock">00:00</span><div class="windows" id="fr-windows">${Object.keys(WINDOWS).map((w) => `<button type="button" data-window="${w}" aria-pressed="${w === (mode === 'film' ? 'FULL' : '1M')}">${w}</button>`).join('')}</div></div>
  </div>
  <div class="recorder-body"><canvas id="fr-canvas" aria-label="Voice traces on a shared 0 to 10 axis"></canvas></div>
  <div class="recorder-events"><canvas id="fr-events" aria-label="Conversation, hands, framing, gestures, smiles, nods, coaching, question turns, hooks, recording and signal gaps"></canvas></div>`;
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class LiveRecorder {
  constructor(root, { window = '1M' } = {}) {
    this.root = root; this.windowKey = window; this.samples = []; this.events = []; this.now = 0;
    root.querySelector('#fr-windows')?.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-window]'); if (!b) return;
      this.windowKey = b.dataset.window;
      root.querySelectorAll('#fr-windows button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.draw();
    });
    this.resize = () => this.draw();
    addEventListener('resize', this.resize);
  }
  setData(samples, events) { this.samples = samples; this.events = events; }
  tick(nowS) { this.now = nowS; this.draw(); }
  destroy() { removeEventListener('resize', this.resize); }

  draw() {
    const canvas = this.root.querySelector('#fr-canvas'); const evCanvas = this.root.querySelector('#fr-events'); if (!canvas) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = Math.max(10, canvas.clientWidth); const H = Math.max(10, canvas.clientHeight);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const span = WINDOWS[this.windowKey] === Infinity ? Math.max(30, this.now) : WINDOWS[this.windowKey];
    const t1 = this.now; const t0 = Math.max(0, t1 - span);
    const padL = 28; const padR = 8; const padT = 6; const padB = 14;
    const x = (t) => padL + ((t - t0) / Math.max(1e-6, t1 - t0)) * (W - padL - padR);
    const y = (v) => padT + (1 - v) * (H - padT - padB);
    // Grid: 0 / 2.5 / 5 / 7.5 / 10 with the corridor band 7–8 shaded.
    ctx.fillStyle = '#2fe7b012'; ctx.fillRect(padL, y(0.8), W - padL - padR, y(0.7) - y(0.8));
    ctx.strokeStyle = '#ffffff10'; ctx.lineWidth = 1; ctx.font = '600 9.5px Rajdhani, monospace'; ctx.fillStyle = '#8e9bb3';
    for (const g of [0, 2.5, 5, 7.5, 10]) { const yy = y(g / 10); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke(); ctx.fillText(String(g), 4, yy + 3); }
    ctx.strokeStyle = '#ffffff30'; ctx.beginPath(); ctx.moveTo(padL, y(0)); ctx.lineTo(W - padR, y(0)); ctx.stroke();
    // Time labels.
    ctx.fillStyle = '#5f6c86';
    for (let k = 0; k <= 4; k += 1) { const t = t0 + (t1 - t0) * (k / 4); const label = k === 4 ? 'now' : `-${fmt(t1 - t)}`; const tx = x(t); ctx.textAlign = k === 4 ? 'right' : k === 0 ? 'left' : 'center'; ctx.fillText(label, tx, H - 3); }
    ctx.textAlign = 'left';
    const visible = this.samples.filter((s) => s.t >= t0 - 1 && s.t <= t1);
    // Silence shading and gap hatching.
    for (const run of intervalRuns(visible, 'speaking')) {
      if (run.value === false) { ctx.fillStyle = '#ffffff05'; ctx.fillRect(x(run.startT), padT, Math.max(1, x(run.endT + 0.5) - x(run.startT)), H - padT - padB); }
    }
    for (const run of intervalRuns(visible, 'signalGap')) {
      if (run.value === true) { hatch(ctx, x(run.startT), padT, Math.max(2, x(run.endT + 0.5) - x(run.startT)), H - padT - padB, '#e5484d66'); }
    }
    // Traces: continuous within speech, broken at null (gap). Scores 0–10 are used so the axis
    // is the same grammar as the instruments; the trace reducer keeps the raw normalisations too.
    // Solid blocks (Founder: "blocks and bands, not wirey line soup"): every 0.5 s sample is a filled block
    // from the silence line to its 0–10 value; a gap (null) is simply no block, never a bridged line.
    const step = Math.max(1, x(0.5) - x(0));
    const drawBlocks = (key, color) => {
      ctx.fillStyle = color + 'a8';
      for (const s of visible) {
        const v = s.scores?.[key] != null ? s.scores[key] / 10 : null;
        if (v === null) continue;
        const px = x(s.t); const py = y(Math.max(0, Math.min(1, v)));
        ctx.fillRect(px, py, Math.max(1, step - 1), y(0) - py);
      }
    };
    drawBlocks('volume', COLORS.vol); drawBlocks('pace', COLORS.pace);
    // Pitch has no score (level is never coached): its normalised register is a faint band, 3 px tall.
    ctx.fillStyle = COLORS.pitch + '99';
    for (const s of visible) { if (s.pitch === null) continue; ctx.fillRect(x(s.t), y(s.pitch) - 1.5, Math.max(1, step - 1), 3); }
    // Now line.
    ctx.strokeStyle = '#fff8e8aa'; ctx.beginPath(); ctx.moveTo(x(t1), padT); ctx.lineTo(x(t1), H - padB); ctx.stroke();
    this.root.querySelector('#fr-clock').textContent = fmt(this.now);
    // Events strip.
    if (evCanvas) {
      const EW = Math.max(10, evCanvas.clientWidth); const EH = Math.max(6, evCanvas.clientHeight);
      if (evCanvas.width !== Math.round(EW * dpr) || evCanvas.height !== Math.round(EH * dpr)) { evCanvas.width = Math.round(EW * dpr); evCanvas.height = Math.round(EH * dpr); }
      const ectx = evCanvas.getContext('2d'); ectx.setTransform(dpr, 0, 0, dpr, 0, 0); ectx.clearRect(0, 0, EW, EH);
      ectx.font = '700 11px Archivo, sans-serif'; ectx.textAlign = 'center'; ectx.textBaseline = 'middle';
      if(EH>=80){
        const deck=compactRecorderLanes(visible,this.events),cellW=EW/3,rowH=EH/4;
        deck.forEach((lane,index)=>{
          const col=index%3,row=Math.floor(index/3),left=col*cellW,labelW=Math.min(126,cellW*.36),top=row*rowH;
          const tx=t=>left+labelW+((t-t0)/Math.max(1e-6,t1-t0))*(cellW-labelW-12);
          ectx.fillStyle='#b7c3d7';ectx.textAlign='left';ectx.fillText(lane.name,left+3,top+rowH/2);
          ectx.fillStyle='#ffffff08';ectx.fillRect(left+labelW,top+4,cellW-labelW-12,rowH-8);
          for(const band of lane.bands||[]){
            if(band.end<t0||band.t>t1)continue;
            const unknown=band.value==='UNAVAILABLE'||band.value==='SEARCHING'||band.value==null;
            ectx.fillStyle=unknown?'#ffb84d55':lane.kind==='gap'?(band.value?'#e5484d':'#31435b'):lane.kind==='state'?({ANSWERING:'#2fbf63',LISTENING:'#3f6bd8',THINKING:'#8b7cf7',PAUSE:'#ffc24b'}[band.value]||'#57628a'):lane.kind==='hands'?(band.value==='NONE'?'#7f8ca3':'#2fe7b0'):'#2fe7b0';
            const begin=tx(Math.max(t0,band.t)),end=tx(Math.min(t1,band.end));
            ectx.fillRect(begin,top+6,Math.max(0,end-begin),rowH-12);
          }
          for(const ev of lane.marks||[]){
            if(ev.t<t0||ev.t>t1)continue;
            ectx.fillStyle=ev.kind==='overlap'?'#ffb84d':ev.kind==='gap'?'#e5484d':ev.kind==='recording'?'#ff6b74':ev.kind==='hook'?'#a696ff':'#39d6ff';
            ectx.fillRect(tx(ev.t)-2,top+5,4,rowH-10);
          }
        });
        return;
      }
      const glyph = { question: ['◆', '#39d6ff'], followup: ['◇', '#d9a6ff'], overlap: ['≋', '#ffb84d'], cue: ['↕', '#ffa928'], recording: ['●', '#ff6b74'], smile: ['☺', '#ffb84d'], nod: ['◦', '#9fd8ff'], gesture: ['✦', '#2fe7b0'], hook: ['⚓', '#a696ff'], closing: ['■', '#39d6ff'], transition: ['·', '#5f6c86'], answer: ['·', '#5f6c86'] };
      for (const ev of this.events) {
        if (ev.t < t0 || ev.t > t1) continue;
        const [g, c] = glyph[ev.kind] || ['·', '#8e9bb3']; ectx.fillStyle = c; ectx.fillText(g, x(ev.t) * (EW / W), EH / 2);
      }
    }
  }
}

function hatch(ctx, x, y, w, h, color) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = -h; i < w + h; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
  ctx.restore();
}

// ---------- Film Room lanes ----------
const STATE_CLASS = { LISTENING: 'listening', ANSWERING: 'answering', THINKING: 'thinking', PAUSE: 'pause', TRANSITION: 'transition', SETUP: 'setup', CLOSING: 'closing' };

export function renderFilmLanes(host, { samples = [], events = [], durationS = null, onSeek = () => {}, playback = null, label = 'Flight Recorder' } = {}) {
  const end = Math.max(1, durationS || (samples.length ? samples[samples.length - 1].t : 1));
  const pct = (t) => `${Math.max(0, Math.min(100, (t / end) * 100))}%`;
  // A minimum percentage would widen isolated observations across unknown
  // intervals in long/decimated recordings. Preserve the measured geometry.
  const width = (a, b) => `${Math.max(0, ((b - a + 0.5) / end) * 100)}%`;
  const groups = { VOICE: true, BEHAVIOR: true, EVENTS: true, GAPS: true };
  const laneRow = (name, group, inner, cls = '') => `<div class="lane ${cls}" data-group="${group}"><span class="name">${name}</span><div class="track" data-track>${inner}</div></div>`;
  const runs = (key, map) => intervalRuns(samples, key).map((r) => `<button type="button" class="run ${map(r.value)}" data-seek="${r.startT}" style="left:${pct(r.startT)};width:${width(r.startT, r.endT)}" title="${r.value} · ${fmt(r.startT)}–${fmt(r.endT)}" aria-label="${key} ${r.value} · ${fmt(r.startT)}–${fmt(r.endT)}"></button>`).join('');
  const pins = (kind, extra = (e) => e.label || kind) => events.filter((e) => e.kind === kind).map((e) => `<button type="button" class="pin ${kind}" data-seek="${e.t}" style="left:${pct(e.t)}" title="${fmt(e.t)} · ${String(extra(e)).replace(/"/g, '&quot;')}" aria-label="${fmt(e.t)} ${String(extra(e)).replace(/"/g, '&quot;')}"></button>`).join('');
  host.innerHTML = `
    <div class="recorder-head" data-provenance="RECOVERED + MODERNIZED" title="Flight Recorder · recovered 3528C 14-lane deck + 3527 shared 0–10 axis, modernized to solid blocks/bands and 12 replay lanes; reducer: ivoc.trace-reducer.v1 (null = gap)"><div class="legend"><span class="t-label" style="color:var(--ink2)">${label}</span><span><i class="vol"></i>Volume</span><span><i class="pit"></i>Pitch</span><span><i class="pace"></i>Pace</span><span><i class="var"></i>Variety</span><span class="t-tech">shared 0–10 · zero = silence · click any mark to replay from 2 s before</span></div><span class="t-tech" id="film-clock">00:00 / ${fmt(end)}</span></div>
    <div class="lanes">
      ${laneRow('Voice · 0–10', 'VOICE', '<canvas data-voice></canvas>', 'voice')}
      ${laneRow('Conversation state', 'BEHAVIOR', runs('state', (v) => STATE_CLASS[v] || 'setup'))}
      ${laneRow('Hand visibility', 'BEHAVIOR', runs('hands', (v) => v === 'BOTH' ? 'both' : v === 'NONE' ? 'none' : v === 'UNAVAILABLE' ? 'gap' : 'one'))}
      ${laneRow('Framing / presence', 'BEHAVIOR', runs('presence', (v) => v === 'TRACKED' ? 'tracked' : 'searching') + pins('framing'))}
      ${laneRow('Gestures', 'EVENTS', pins('gesture'))}
      ${laneRow('Smiles', 'EVENTS', pins('smile'))}
      ${laneRow('Head nods', 'EVENTS', pins('nod'))}
      ${laneRow('Coaching', 'EVENTS', pins('cue'))}
      ${laneRow('Question / turn', 'EVENTS', pins('question') + pins('followup') + pins('closing') + pins('overlap'))}
      ${laneRow('Hooks', 'EVENTS', pins('hook'))}
      ${laneRow('Recording', 'EVENTS', pins('recording'))}
      ${laneRow('Signal gaps', 'GAPS', runs('signalGap', (v) => v ? 'gap' : 'clear'))}
    </div>`;
  // Voice canvas.
  const canvas = host.querySelector('[data-voice]');
  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2); const W = Math.max(10, canvas.clientWidth); const H = Math.max(10, canvas.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const x = (t) => (t / end) * W; const y = (v) => 4 + (1 - v) * (H - 14);
    ctx.fillStyle = '#2fe7b012'; ctx.fillRect(0, y(0.8), W, y(0.7) - y(0.8));
    ctx.strokeStyle = '#ffffff12'; for (const g of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(0, y(g)); ctx.lineTo(W, y(g)); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff40'; ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(W, y(0)); ctx.stroke();
    ctx.fillStyle = '#5f6c86'; ctx.font = '600 9.5px Rajdhani'; ctx.fillText('0 · SILENCE', 4, H - 2); ctx.fillText('10', 4, 10);
    for (const run of intervalRuns(samples, 'speaking')) if (run.value === false) { ctx.fillStyle = '#ffffff05'; ctx.fillRect(x(run.startT), 0, Math.max(1, x(run.endT + 0.5) - x(run.startT)), H); }
    // Film Room voice lane: the same solid-block grammar as the live recorder (one block per 0.5 s sample).
    const bw = Math.max(1, x(0.5) - x(0));
    const trace = (get, color) => { ctx.fillStyle = color + '99'; for (const s of samples) { const v = get(s); if (v === null || v === undefined) continue; const px = x(s.t); const py = y(Math.max(0, Math.min(1, v))); ctx.fillRect(px, py, Math.max(1, bw - 0.5), y(0) - py); } };
    trace((s) => s.scores?.volume != null ? s.scores.volume / 10 : null, COLORS.vol);
    trace((s) => s.scores?.pace != null ? s.scores.pace / 10 : null, COLORS.pace);
    trace((s) => s.scores?.variety != null ? s.scores.variety / 10 : null, COLORS.variety, 1.2);
    trace((s) => s.pitch, COLORS.pitch, 1.2);
  };
  draw();
  // Playhead + seek.
  const tracks = [...host.querySelectorAll('[data-track]')];
  const heads = tracks.map((t) => { const p = document.createElement('span'); p.className = 'playhead'; t.append(p); return p; });
  const setHead = (tS) => { const left = pct(tS); heads.forEach((h) => { h.style.left = left; }); const clock = host.querySelector('#film-clock'); if (clock) clock.textContent = `${fmt(tS)} / ${fmt(end)}`; };
  setHead(0);
  const click=e=>{
    const pin = e.target.closest('[data-seek]');
    if (pin) { onSeek(Math.max(0, Number(pin.dataset.seek) - 2)); return; }
    const track = e.target.closest('[data-track]');
    if (track) { const rect = track.getBoundingClientRect(); const ratio = (e.clientX - rect.left) / rect.width; onSeek(ratio * end); }
  };
  host.addEventListener('click',click);
  const sync = () => setHead(playback.currentTime);
  if (playback) {
    playback.addEventListener('timeupdate', sync); playback.addEventListener('seeked', sync);
  }
  return { setHead, redraw: draw,destroy(){host.removeEventListener('click',click);playback?.removeEventListener('timeupdate',sync);playback?.removeEventListener('seeked',sync);} };
}
