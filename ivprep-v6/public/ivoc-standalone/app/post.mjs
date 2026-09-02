/* ============================================================
   3528B — Post-match screens: RESULTS (premium debrief),
   LIBRARY (archive wall), PROGRESS, SETTINGS, MENTOR.
   Adult, professional, zero childish gamification.
   ============================================================ */
import { sceneDataUri } from './art.mjs';
import { QUESTIONS, CATEGORIES, CALIBRATION } from './data.mjs';
import { account, accountName } from './account.mjs';
import { ivocApi } from './api.mjs';
import {
  intervalRuns,
  mediaToSessionSeconds,
  normalizeDurations,
  normalizeTimebase,
  selectLibrarySessions,
  selectMentorSessions,
  sessionToMediaSeconds,
  tracePath,
} from './post-model.mjs';
import { ui, saveUi, draft, saveDraft, go, toast, session, setReducedMotion } from './main.mjs';

const qOf = id => QUESTIONS.find(q => q.id === id);
const fmt = s => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const optionalMs = (value, scale = 1) => value != null && Number.isFinite(Number(value))
  ? Number(value) * scale
  : null;

function plateTint(v) { return v != null && v >= 7 && v <= 8.5 ? 'teal' : 'gold'; }

/* build a results model from the live session or a library row */
async function resultsModel(param) {
  if ((!param || param === 'last') && session.last) {
    const s = session.last;
    const payload = {
      scores: s.scores, counters: s.counters, events: s.events, history: s.history,
      sessionDurationMs: optionalMs(s.sessionDur, 1000),
      recordingDurationMs: optionalMs(s.recordingDur, 1000),
      playableDurationMs: optionalMs(s.playableDur ?? s.dur, 1000),
      activeAnsweringDurationMs: optionalMs(s.answeringDur, 1000),
      analyticsObservationDurationMs: optionalMs(s.analyticsObservationDur, 1000),
      recordingStartSessionMs: s.recordingStartSessionMs,
      pausedSpans: s.pausedSpans,
    };
    const durations = normalizeDurations(payload);
    const timebase = normalizeTimebase(payload);
    return {
      title: s.title, q: s.question, date: 'Just now', dur: fmt(durations.playableMs / 1000), recorded: s.recorded,
      scores: { pace: s.scores.pace, volume: s.scores.volume, variety: s.scores.variety },
      wpmAvg: s.wpmAvg, counters: s.counters, events: s.events, history: s.history || [],
      total: Math.max(1, (durations.timelineMs ?? 1_000) / 1000), replayTotal: Math.max(1, (durations.replayMs ?? 1_000) / 1000), live: true,
      recordingId: s.recordingId, payload, durations, timebase,
    };
  }
  let row = null;
  if (param) row = await ivocApi.session(param).catch(() => null);
  if (!row) row = (await ivocApi.library().catch(() => ({ sessions: [] }))).sessions?.[0] || null;
  if (!row) return {
    title: 'No completed session', q: null, date: '—', dur: '00:00', recorded: false,
    scores: { pace: null, volume: null, variety: null }, wpmAvg: null, total: 1,
    counters: { nods: null, smiles: null, gestures: null, handsPct: null }, events: [], history: [], payload: null,
    durations: normalizeDurations({}), timebase: normalizeTimebase({}), replayTotal: 1,
  };
  const payload = row.results?.payload || {};
  const q = qOf(row.questionId) || (row.questionText ? { id: row.questionId, text: row.questionText } : null);
  const durations = normalizeDurations({ ...payload, recording: row.recording, durationMs: row.durationMs });
  const timebase = normalizeTimebase({ ...payload, ...(row.recording || {}) });
  const durS = Math.max(0, Number(durations.playableMs ?? 0) / 1000);
  return {
    id: row.id, title: row.title, q,
    date: row.endedAt ? new Date(row.endedAt).toLocaleString() : new Date(row.startedAt).toLocaleString(),
    dur: fmt(durS), recorded: row.recording?.status === 'saved', recordingId: row.recording?.id || null,
    scores: { pace: payload.scores?.pace ?? null, volume: payload.scores?.volume ?? null, variety: payload.scores?.variety ?? null },
    wpmAvg: payload.wpmLastObserved ?? payload.metrics?.SPEED_WPM?.wordsPerMinute ?? payload.wpmAvg ?? null,
    total: Math.max(1, Number(durations.timelineMs ?? 1_000) / 1000), replayTotal: Math.max(1, Number(durations.replayMs ?? 1_000) / 1000),
    counters: { nods: payload.counters?.nods ?? null, smiles: payload.counters?.smiles ?? null, gestures: payload.counters?.gestures ?? null, handsPct: payload.counters?.handsPct ?? null },
    events: Array.isArray(payload.events) ? payload.events : [],
    history: Array.isArray(payload.history) ? payload.history : [], payload, durations, timebase,
  };
}

const EV_META = {
  smile: { color: 'var(--g-teal)', icon: '☺', pos: true },
  gesture: { color: 'var(--g-cyan)', icon: '✦', pos: true },
  nod: { color: 'var(--g-violet)', icon: '◦', pos: true },
  answer: { color: 'var(--g-gold)', icon: '■', pos: true },
  cue: { color: 'var(--g-gold)', icon: '↕', pos: false },
  question: { color: 'var(--g-cyan)', icon: '?', pos: false },
  transition: { color: 'var(--g-violet)', icon: '⇄', pos: false },
  'recording-start': { color: 'var(--g-red)', icon: '●', pos: false },
  'recording-pause': { color: 'var(--g-amber)', icon: 'Ⅱ', pos: false },
  'recording-resume': { color: 'var(--g-teal)', icon: '▶', pos: false },
  'recording-stop': { color: 'var(--g-red)', icon: '■', pos: false },
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function flightRecorderMarkup(model, windowSeconds = 0) {
  const fullTotal = Math.max(1, model.total);
  const total = windowSeconds > 0 ? Math.min(fullTotal, windowSeconds) : fullTotal;
  const start = Math.max(0, fullTotal - total);
  const history = (model.history || [])
    .filter(point => Number(point?.t) >= start)
    .map(point => ({ ...point, t: Number(point.t) - start }));
  const visibleEvents = (model.events || []).filter(event => Number(event?.t) >= start && Number(event?.t) <= start + total);
  const voiceTraces = [
    ['VOLUME', 'vol', 'var(--g-teal)'],
    ['PITCH', 'pitch', 'var(--g-violet)'],
    ['PACE', 'pace', 'var(--g-cyan)'],
  ];
  const stateColors = { LISTENING: '#3f6bd8', THINKING: '#8b7cf7', ANSWERING: '#2fbf63', PAUSE: '#ffc24b', TRANSITION: '#8fa0d9', SETUP: '#57628a' };
  const stateRuns = intervalRuns(history, point => point.state || 'UNAVAILABLE', total);
  const handRuns = intervalRuns(history, point => point.hands || 'NONE', total);
  const presenceRuns = intervalRuns(history, point => point.presence || 'UNAVAILABLE', total);
  const gapRuns = intervalRuns(history, point => point.signalGap === true
    || point.speaking === true && point.vol == null && point.pitch == null && point.pace == null ? 'GAP' : 'OBSERVED', total)
    .filter(run => run.value === 'GAP');
  const eventRows = [
    ['GESTURES', visibleEvents.filter(event => event.kind === 'gesture')],
    ['SMILES', visibleEvents.filter(event => event.kind === 'smile')],
    ['HEAD NODS', visibleEvents.filter(event => event.kind === 'nod')],
    ['COACHING', visibleEvents.filter(event => event.kind === 'cue')],
    ['QUESTION / TURN', visibleEvents.filter(event => event.kind === 'question' || event.kind === 'transition' || event.kind === 'answer')],
    ['RECORDING', visibleEvents.filter(event => String(event.kind || '').startsWith('recording-'))],
  ];
  const lane = (label, body, group) => `<div class="fr-lane" data-fr-lane="${group}"><div class="fr-label">${label}</div><div class="fr-track">${body}</div></div>`;
  const voicePaths = voiceTraces.map(([label, key, color]) => {
    const path = tracePath(history, key, total);
    return path ? `<path class="fr-voice-path fr-voice-${key}" d="${path}" stroke="${color}" aria-label="${label} shared 0 to 10 trace"/>` : '';
  }).join('');
  const voicePlot = `<div class="fr-lane fr-voice-lane" data-fr-lane="voice">
    <div class="fr-label fr-voice-label">
      <b>VOICE · 0–10</b><small>ONE SHARED AXIS<br>0 = OBSERVED SILENCE</small>
      ${voiceTraces.map(([label, key, color]) => `<i><span style="background:${color}"></span>${label}</i>`).join('')}
    </div>
    <div class="fr-track fr-voice-track">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Volume, Pitch, and Pace on one shared 0 to 10 timeline">
        <g class="fr-voice-grid"><line x1="0" y1="6" x2="100" y2="6"/><line x1="0" y1="28" x2="100" y2="28"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="72" x2="100" y2="72"/><line class="zero" x1="0" y1="94" x2="100" y2="94"/></g>
        ${voicePaths}
      </svg>
      <div class="fr-y-labels" aria-hidden="true"><span>10</span><span>7.5</span><span>5</span><span>2.5</span><span>0 · SILENCE</span></div>
      ${voicePaths ? '' : '<span class="fr-unavail">UNAVAILABLE · NO OBSERVED VOICE RUN</span>'}
    </div>
  </div>`;
  const stateLane = lane('CONVERSATION STATE', stateRuns.map(run => `<i class="fr-run" style="left:${run.left}%;width:${run.width}%;background:${stateColors[run.value] || '#57628a'}" title="${esc(run.value)} · ${fmt(start + run.start)}–${fmt(start + run.end)}"></i>`).join('') || '<span class="fr-unavail">NO STATE HISTORY</span>', 'behavior');
  const handsLane = lane('HAND VISIBILITY', handRuns.map(run => `<i class="fr-run hands-${esc(run.value).toLowerCase()}" style="left:${run.left}%;width:${run.width}%" title="${esc(run.value)}"></i>`).join('') || '<span class="fr-unavail">NO HAND HISTORY</span>', 'behavior');
  const presenceLane = lane('FRAMING / PRESENCE', presenceRuns.map(run => `<i class="fr-run presence-${esc(run.value).toLowerCase()}" style="left:${run.left}%;width:${run.width}%" title="${esc(run.value)}"></i>`).join('') || '<span class="fr-unavail">NO FRAMING HISTORY</span>', 'behavior');
  const gapLane = lane('SIGNAL GAPS', gapRuns.map(run => `<i class="fr-run signal-gap" style="left:${run.left}%;width:${run.width}%" title="Signal unavailable · ${fmt(start + run.start)}"></i>`).join('') || '<span class="fr-ok">NO MULTI-SIGNAL GAPS OBSERVED</span>', 'evidence');
  const chipLanes = eventRows.map(([label, events]) => lane(label,
    events.length ? events.map(event => `<button class="fr-chip" data-seek="${Number(event.t) || 0}" style="left:${Math.max(0, Math.min(100, ((Number(event.t) || 0) - start) / total * 100))}%" title="${esc(event.label)} · ${fmt(Number(event.t) || 0)}">${esc(event.label)}</button>`).join('') : '<span class="fr-unavail">NO VALIDATED EVENTS</span>', 'events')).join('');
  return `<section class="flight-recorder" data-fr-start="${start}" data-fr-total="${total}">
    <div class="fr-head">
      <span class="fr-badge">FR-C</span>
      <div><b>SESSION FLIGHT RECORDER</b><small>EVIDENCE, NOT VERDICT · CHIPS SEEK WITH 2-SECOND PRE-ROLL · GAPS STAY VISIBLE</small></div>
      <div class="fr-groups"><button class="on" data-fr-group="voice">VOICE</button><button class="on" data-fr-group="behavior">BEHAVIOR</button><button class="on" data-fr-group="events">EVENTS</button><button class="on" data-fr-group="evidence">GAPS</button></div>
      <div class="fr-zoom" aria-label="Flight Recorder time scale"><button class="${windowSeconds === 30 ? 'on' : ''}" data-fr-zoom="30">30S</button><button class="${windowSeconds === 60 ? 'on' : ''}" data-fr-zoom="60">1M</button><button class="${windowSeconds === 180 ? 'on' : ''}" data-fr-zoom="180">3M</button><button class="${windowSeconds === 0 ? 'on' : ''}" data-fr-zoom="0">FULL</button></div>
    </div>
    <div class="fr-ruler"><span>${fmt(start)}</span><span>${fmt(start + total / 2)}</span><span>${fmt(start + total)}</span></div>
    <div class="fr-lanes" data-fr-inspect>${voicePlot}${stateLane}${handsLane}${presenceLane}${chipLanes}${gapLane}<i class="fr-playhead" id="frPlayhead"></i><output class="fr-inspector" id="frInspector" hidden></output></div>
  </section>`;
}

/* ================= RESULTS ================= */
async function resultsScreen(el, { param }) {
  const m = await resultsModel(param);
  const strongest = m.events.filter(e => EV_META[e.kind]?.pos && e.kind !== 'answer').slice(0, 4);
  const coaching = m.events.filter(e => e.kind === 'cue').slice(0, 4);
  const plates = [
    { id: 'pace', name: 'PACE', v: m.scores.pace, tech: m.wpmAvg != null ? `${m.wpmAvg} WPM · TARGET ${CALIBRATION.paceCorridor[0]}–${CALIBRATION.paceCorridor[1]}` : 'WPM UNAVAILABLE · NO TIMED WORDS' },
    { id: 'volume', name: 'VOLUME', v: m.scores.volume, tech: `CORRIDOR ${CALIBRATION.volumeCorridorLu[0]}…+${CALIBRATION.volumeCorridorLu[1]} LU` },
    { id: 'variety', name: 'VARIETY', v: m.scores.variety, tech: 'SPEAKER-RELATIVE RANGE' },
  ];
  const counters = [
    ['HEAD NODS', m.counters.nods], ['SMILE EVENTS', m.counters.smiles],
    ['GESTURES', m.counters.gestures], ['HANDS VISIBLE', m.counters.handsPct != null ? m.counters.handsPct + '%' : '—'],
  ];
  const nextQ = QUESTIONS.find(q => q.practiced === 0) || QUESTIONS[2];
  const durationItems = [
    ['PLAYABLE RECORDING', m.durations?.playableMs],
    ['SESSION', m.durations?.sessionMs],
    ['ACTIVE ANSWERING', m.durations?.activeAnsweringMs],
    ['ANALYTICS OBSERVED', m.durations?.analyticsObservationMs],
  ];

  el.innerHTML = `
  <div class="results-scroll">
  <div class="topline">
    <span class="crumb">MATCH SUMMARY / <b>SESSION COMPLETE</b></span>
    <span class="spacer"></span>
    <span class="chip">${m.date} · ${m.dur}</span>
    ${m.recorded ? '<span class="chip teal"><span class="dot"></span>SAVED TO LIBRARY</span>' : '<span class="chip amber"><span class="dot"></span>NOT RECORDED</span>'}
  </div>
  <div class="res-head">
    <h1 class="t-display-md">SESSION COMPLETE.</h1>
    <div class="res-q">${m.q ? `“${m.q.text}”` : ''}</div>
    <div class="duration-strip">${durationItems.map(([label, value]) => `<span><em>${label}</em><b>${value == null ? '—' : fmt(value / 1000)}</b></span>`).join('')}</div>
  </div>

  <div class="res-hero">
    <div class="res-replay" data-focusable data-autofocus data-replay tabindex="-1">
      <span class="rr-art" style="background-image:${sceneDataUri('mock')}"></span>
      <video class="rr-video" id="rrVideo" controls playsinline hidden></video>
      <span class="rr-shade"></span>
      <span class="rr-play">▶</span>
      <span class="rr-note">${m.recorded ? 'WATCH REPLAY' : 'NO RECORDING — RESULTS ONLY'}</span>
      <div class="rr-scrub">
        <div class="rr-track" id="rrTrack">
          ${m.events.map(e => `<i class="rr-mark" data-seek="${e.t}" style="left:${(e.t / m.total) * 100}%;background:${EV_META[e.kind]?.color || '#888'}" title="${e.label} · ${fmt(e.t)}"></i>`).join('')}
          <i class="rr-head" id="rrHead"></i>
        </div>
        <div class="rr-times"><span id="rrPos">00:00</span><span>${m.dur}</span></div>
      </div>
    </div>
    <div class="res-side">
      <div class="res-plates">
        ${plates.map(p => `
        <div class="plate ${plateTint(p.v)}">
          <em>${p.name}</em>
          <b data-count="${p.v ?? ''}">${p.v != null ? '0.0' : '—'}</b><span>/10</span>
          <small>${p.tech}</small>
        </div>`).join('')}
      </div>
      <div class="res-counters">
        ${counters.map(([k, v]) => `<div class="rcount"><em>${k}</em><b>${v ?? '—'}</b></div>`).join('')}
      </div>
      <div class="res-progression">
        <span class="chip teal"><span class="dot"></span>STRUCTURED RESULTS SAVED</span>
        <span class="chip">ACCOUNT VIDEO LIBRARY</span>
        <span class="chip">YOUR PERSONAL CORRIDORS</span>
      </div>
    </div>
  </div>

  <div id="flightRecorderHost">${flightRecorderMarkup(m)}</div>

  <div class="res-moments">
    <div class="mom-col">
      <div class="t-section mom-title">STRONGEST MOMENTS</div>
      ${strongest.length ? strongest.map(e => `
        <button class="mom-card" data-focusable data-seek="${e.t}">
          <span class="mom-t">${fmt(e.t)}</span>
          <i style="color:${EV_META[e.kind].color}">${EV_META[e.kind].icon}</i>
          <span class="mom-label">${e.label}</span>
          <span class="mom-go">▶</span>
        </button>`).join('') : '<div class="mom-empty">A quiet take — moments will land here.</div>'}
    </div>
    <div class="mom-col">
      <div class="t-section mom-title">COACHING MOMENTS</div>
      ${coaching.length ? coaching.map(e => `
        <button class="mom-card" data-focusable data-seek="${e.t}">
          <span class="mom-t">${fmt(e.t)}</span>
          <i style="color:var(--g-gold)">↕</i>
          <span class="mom-label">${e.label}</span>
          <span class="mom-go">▶</span>
        </button>`).join('') : '<div class="mom-empty">Nothing flagged — a steady take.</div>'}
    </div>
  </div>

  <div class="res-actions">
    <button class="btn btn-gold btn-xl" data-focusable data-replay>▶ WATCH REPLAY</button>
    <button class="next-card" data-focusable data-next-practice>
      <em>NEXT PRACTICE ▸</em><b>“${nextQ.text}”</b>
    </button>
    <span class="spacer"></span>
    <button class="btn btn-quiet" data-focusable data-dl="video" ${m.recorded ? '' : 'disabled'}>⬇ VIDEO</button>
    <button class="btn btn-quiet" data-focusable data-dl="results">⬇ RESULTS</button>
    <button class="btn btn-quiet" data-focusable data-lib>LIBRARY</button>
  </div>
  </div>`;

  /* count-up animation */
  if (!ui.reducedMotion) {
    el.querySelectorAll('[data-count]').forEach(b => {
      const target = parseFloat(b.dataset.count);
      if (!Number.isFinite(target)) return;
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 600);
        b.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(1);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  } else {
    el.querySelectorAll('[data-count]').forEach(b => {
      const t = parseFloat(b.dataset.count);
      if (Number.isFinite(t)) b.textContent = t.toFixed(1);
    });
  }

  let playback = null;
  let flightWindowSeconds = 0;
  function flightWindow() {
    const section = el.querySelector('.flight-recorder');
    return {
      start: Number(section?.dataset.frStart || 0),
      total: Math.max(1, Number(section?.dataset.frTotal || m.total)),
    };
  }
  function updatePlayheads(sessionSeconds) {
    const { start, total } = flightWindow();
    const flightPercent = Math.max(0, Math.min(1, (sessionSeconds - start) / total));
    const replaySeconds = sessionToMediaSeconds(sessionSeconds, { ...m.timebase, playableDurationMs: m.durations?.playableMs });
    const replayPercent = Math.max(0, Math.min(1, replaySeconds / Math.max(1, m.replayTotal)));
    const flightHead = el.querySelector('#frPlayhead');
    const replayHead = el.querySelector('#rrHead');
    if (flightHead) flightHead.style.left = `calc(176px + (100% - 176px) * ${flightPercent})`;
    if (replayHead) replayHead.style.left = `${replayPercent * 100}%`;
    const pos = el.querySelector('#rrPos');
    if (pos) pos.textContent = fmt(replaySeconds);
  }
  async function ensureReplay() {
    if (!m.recordingId) { toast('This session has no saved recording.', 'info'); return null; }
    if (!playback) playback = await ivocApi.playback(m.recordingId);
    const video = el.querySelector('#rrVideo');
    if (video.src !== playback.url) video.src = playback.url;
    video.hidden = false;
    el.querySelector('.rr-art').hidden = true;
    if (!video.dataset.flightBound) {
      video.dataset.flightBound = 'true';
      video.addEventListener('timeupdate', () => {
        const sessionSeconds = mediaToSessionSeconds(video.currentTime, m.timebase);
        updatePlayheads(sessionSeconds);
      });
    }
    return video;
  }
  function downloadJson() {
    const blob = new Blob([JSON.stringify(m.payload || {}, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = href; a.download = `ivoc-results-${m.id || 'session'}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  el.addEventListener('click', e => {
    const seek = e.target.closest('[data-seek]');
    if (seek) {
      const eventT = +seek.dataset.seek;
      const sessionT = seek.classList.contains('fr-chip') ? Math.max(0, eventT - 2) : eventT;
      const mediaT = sessionToMediaSeconds(sessionT, { ...m.timebase, playableDurationMs: m.durations?.playableMs });
      updatePlayheads(sessionT);
      void ensureReplay().then((video) => { if (video) { video.currentTime = mediaT; void video.play(); toast(`Replay seek → ${fmt(mediaT)} media / ${fmt(sessionT)} session${seek.classList.contains('fr-chip') ? ' (−2s context)' : ''}`, 'info'); } });
      return;
    }
    const group = e.target.closest('[data-fr-group]');
    if (group) {
      group.classList.toggle('on');
      el.querySelectorAll(`[data-fr-lane="${group.dataset.frGroup}"]`).forEach(lane => { lane.hidden = !group.classList.contains('on'); });
      return;
    }
    const zoom = e.target.closest('[data-fr-zoom]');
    if (zoom) {
      flightWindowSeconds = Number(zoom.dataset.frZoom) || 0;
      el.querySelector('#flightRecorderHost').innerHTML = flightRecorderMarkup(m, flightWindowSeconds);
      return;
    }
    if (e.target.closest('[data-replay]')) { void ensureReplay().then((video) => video?.play()); return; }
    const dl = e.target.closest('[data-dl]');
    if (dl && !dl.disabled) {
      if (dl.dataset.dl === 'results') downloadJson();
      else void ivocApi.playback(m.recordingId, 'attachment').then(({ url }) => { const a = document.createElement('a'); a.href = url; a.download = ''; a.click(); });
      return;
    }
    if (e.target.closest('[data-lib]')) { go('library'); return; }
    if (e.target.closest('[data-next-practice]')) {
      draft.mode = 'question'; draft.qids = [nextQ.id]; saveDraft(); go('setup');
    }
  });
  el.addEventListener('pointermove', event => {
    const track = event.target.closest('.fr-track');
    const inspector = el.querySelector('#frInspector');
    if (!track || !inspector) { if (inspector) inspector.hidden = true; return; }
    const rect = track.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    const { start, total } = flightWindow();
    const at = start + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * total;
    const nearest = (m.history || []).reduce((best, point) => Math.abs(Number(point?.t) - at) < Math.abs(Number(best?.t) - at) ? point : best, m.history?.[0] || null);
    if (!nearest) { inspector.hidden = true; return; }
    inspector.hidden = false;
    inspector.style.left = `${Math.max(182, Math.min(el.querySelector('.fr-lanes').clientWidth - 250, event.clientX - el.querySelector('.fr-lanes').getBoundingClientRect().left))}px`;
    inspector.style.top = `${Math.max(4, event.clientY - el.querySelector('.fr-lanes').getBoundingClientRect().top - 52)}px`;
    const score = key => nearest.speaking === false ? '0.0' : nearest[key] == null ? '—' : (Math.max(0, Math.min(1, Number(nearest[key]))) * 10).toFixed(1);
    inspector.textContent = `${fmt(at)} · ${nearest.state || 'STATE —'} · VOL ${score('vol')}/10 · PITCH ${score('pitch')}/10 · PACE ${score('pace')}/10 · HANDS ${nearest.hands || '—'}`;
  });
}

/* ================= LIBRARY ================= */
const MODE_ART = { quick: 'quick', question: 'question', mock: 'mock' };
function rowScores(row) {
  const scores = row.results?.payload?.scores || {};
  return { pace: scores.pace ?? null, volume: scores.volume ?? null, variety: scores.variety ?? null };
}
function rowDuration(row) { return fmt(Number(row.recording?.durationMs ?? row.durationMs ?? 0) / 1000); }
function scoreText(value) { return value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—'; }
async function libraryScreen(el) {
  let filter = 'all';
  let query = '';
  let sort = 'newest';
  let view = ui.libraryView === 'grid' ? 'grid' : 'list';
  let dateRangeDays = 0;
  let category = 'all';
  let performance = 'all';
  const payload = await ivocApi.library();
  const sessions = (payload.sessions || []).map(row => ({ ...row, questionCategory: qOf(row.questionId)?.cat || row.questionCategory || '' }));
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">VIDEO LIBRARY / <b>YOUR FILM</b></span>
    <span class="spacer"></span>
    <span class="chip">${sessions.filter((row) => row.recording?.status === 'saved').length} RECORDINGS · ALL YOURS</span>
  </div>
  <div class="lib-filters" id="libFilters">
    ${[['all', 'ALL'], ['quick', 'QUICK'], ['question', 'QUESTION'], ['mock', 'MOCK'], ['reviewed', 'REVIEWED'], ['pending', 'PENDING REVIEW']]
      .map(([v, l]) => `<button class="qcat ${v === 'all' ? 'on' : ''}" data-focusable data-f="${v}" style="--cc:var(--g-gold)"><span>${l}</span></button>`).join('')}
  </div>
  <div class="lib-tools">
    <label class="lib-search"><span>SEARCH</span><input id="libSearch" type="search" placeholder="Session title or interview question" autocomplete="off"></label>
    <label class="lib-filter-select"><span>DATE</span><select id="libDate"><option value="0">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
    <label class="lib-filter-select"><span>CATEGORY</span><select id="libCategory"><option value="all">All categories</option>${CATEGORIES.map(item => `<option value="${item.id}">${esc(item.label)}</option>`).join('')}</select></label>
    <label class="lib-filter-select"><span>PERFORMANCE</span><select id="libPerformance"><option value="all">All observed</option><option value="on-target">In corridor</option><option value="needs-work">Needs review</option></select></label>
    <label class="lib-sort"><span>SORT</span><select id="libSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="duration">Duration</option><option value="pace">Pace</option><option value="volume">Volume</option><option value="variety">Variety</option><option value="review">Review status</option><option value="question">Question</option><option value="score">Highest coaching score</option></select></label>
    <div class="lib-view" aria-label="Library view"><button class="${view === 'list' ? 'on' : ''}" data-view="list">☰ LIST</button><button class="${view === 'grid' ? 'on' : ''}" data-view="grid">▦ GRID</button></div>
  </div>
  <div class="lib-grid list" id="libGrid"></div>`;

  const grid = el.querySelector('#libGrid');
  function paint() {
    const rows = selectLibrarySessions(sessions, { filter, query, sort, scoreOf: rowScores, dateRangeDays, category, performance });
    grid.className = `lib-grid ${view}`;
    if (view === 'list') {
      grid.innerHTML = rows.length ? `<div class="library-table">
        <div class="library-head"><span>RECORDING</span><span>SESSION / QUESTION</span><span>DATE</span><span>DURATION</span><span>PACE</span><span>VOLUME</span><span>VARIETY</span><span>GESTURES</span><span>REVIEW</span><span>ACTIONS</span></div>
        ${rows.map((s, i) => {
          const scores = rowScores(s);
          const q = qOf(s.questionId);
          const gestures = s.results?.payload?.counters?.gestures;
          const reviewed = s.reviewStatus === 'reviewed';
          return `<article class="library-row" ${i === 0 ? 'data-autofocus' : ''}>
            <button class="library-thumb" data-focusable data-watch="${esc(s.id)}" aria-label="Watch ${esc(s.title)}"><span style="background-image:${sceneDataUri(MODE_ART[s.sessionType] || 'mock')}"></span><i>▶</i></button>
            <div class="library-session"><b>${esc(s.title)}</b><small>${esc(s.sessionType || 'practice').toUpperCase()} · ${esc(q?.text || s.questionText || 'Question not retained')}</small></div>
            <time>${new Date(s.startedAt).toLocaleDateString()}<small>${new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></time>
            <b class="library-duration">${rowDuration(s)}</b>
            <b>${scoreText(scores.pace)}</b><b>${scoreText(scores.volume)}</b><b>${scoreText(scores.variety)}</b>
            <b>${gestures == null ? '—' : esc(gestures)}</b>
            <span class="library-review ${reviewed ? 'ok' : ''}">${reviewed ? '✓ REVIEWED' : 'PENDING'}</span>
            <div class="library-actions"><button data-focusable data-watch="${esc(s.id)}">WATCH</button><button data-focusable data-results="${esc(s.id)}">RESULTS</button>${s.recording?.status === 'saved' ? `<button data-focusable data-download="${esc(s.recording.id)}">DOWNLOAD</button>` : ''}</div>
          </article>`;
        }).join('')}</div>` : `<div class="lib-empty"><span class="le-art" style="background-image:${sceneDataUri('library')}"></span><b>No recordings here yet.</b><span>Start your first session — it lands in your library automatically.</span></div>`;
      return;
    }
    grid.innerHTML = rows.map((s, i) => {
      const scores = rowScores(s);
      const q = qOf(s.questionId);
      return `
      <button class="poster" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-open="${s.id}">
        <span class="po-art" style="background-image:${sceneDataUri(MODE_ART[s.sessionType] || 'mock')}"></span>
        <span class="po-shade"></span>
        <span class="po-dur">${rowDuration(s)}</span>
        <span class="po-play">▶</span>
        ${s.reviewStatus === 'reviewed' ? '<span class="po-rev ok">✓ MENTOR REVIEWED</span>' : '<span class="po-rev">PENDING REVIEW</span>'}
        <span class="po-text">
          <b>${esc(s.title)}</b>
          <small>${new Date(s.startedAt).toLocaleString()} · ${q ? CATEGORIES.find(c => c.id === q.cat)?.label || '' : ''}</small>
          <em>PACE ${scoreText(scores.pace)} · VOL ${scoreText(scores.volume)} · VAR ${scoreText(scores.variety)}</em>
        </span>
      </button>`; }).join('') ||
      `<div class="lib-empty"><span class="le-art" style="background-image:${sceneDataUri('library')}"></span><b>No recordings here yet.</b><span>Start your first session — it lands in your library automatically.</span></div>`;
  }
  paint();
  el.querySelector('#libSearch').addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); paint(); });
  el.querySelector('#libSort').addEventListener('change', event => { sort = event.target.value; paint(); });
  el.querySelector('#libDate').addEventListener('change', event => { dateRangeDays = Number(event.target.value) || 0; paint(); });
  el.querySelector('#libCategory').addEventListener('change', event => { category = event.target.value; paint(); });
  el.querySelector('#libPerformance').addEventListener('change', event => { performance = event.target.value; paint(); });
  el.addEventListener('click', e => {
    const f = e.target.closest('[data-f]');
    if (f) {
      filter = f.dataset.f;
      el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === f));
      paint(); return;
    }
    const viewButton = e.target.closest('[data-view]');
    if (viewButton) {
      view = viewButton.dataset.view;
      ui.libraryView = view; saveUi();
      el.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('on', button === viewButton));
      paint(); return;
    }
    const open = e.target.closest('[data-open]');
    if (open) go('results', open.dataset.open);
    const watch = e.target.closest('[data-watch]');
    if (watch) { go('results', watch.dataset.watch); return; }
    const results = e.target.closest('[data-results]');
    if (results) { go('results', results.dataset.results); return; }
    const download = e.target.closest('[data-download]');
    if (download) void ivocApi.playback(download.dataset.download, 'attachment').then(({ url }) => {
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = ''; anchor.click();
    });
  });
}

/* ================= PROGRESS ================= */
async function progressScreen(el) {
  const sessions = (await ivocApi.library()).sessions || [];
  const completed = sessions.filter((row) => row.results?.payload?.scores);
  const makeSkill = (name, key) => {
    const trend = completed.slice().reverse().map((row) => row.results.payload.scores[key]).filter((value) => value != null).map(Number).filter(Number.isFinite);
    const avg = trend.length ? trend.reduce((sum, value) => sum + value, 0) / trend.length : null;
    return { name, avg, pb: trend.length ? Math.max(...trend) : null, trend, dir: trend.length > 1 && trend.at(-1) >= trend[0] ? '▲' : trend.length > 1 ? '▼' : '—' };
  };
  const skills = [makeSkill('PACE', 'pace'), makeSkill('VOLUME', 'volume'), makeSkill('VOCAL VARIETY', 'variety')];
  const spark = t => {
    if (t.length < 2) return '<span class="spark"></span>';
    const min = Math.min(...t), max = Math.max(...t);
    const pts = t.map((v, i) => `${(i / (t.length - 1)) * 120},${34 - ((v - min) / (max - min || 1)) * 28}`).join(' ');
    return `<svg viewBox="0 0 120 38" class="spark"><polyline points="${pts}"/><circle cx="120" cy="${34 - ((t[t.length - 1] - min) / (max - min || 1)) * 28}" r="3"/></svg>`;
  };
  const weeks = 5, days = 7;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const practiced = new Set(sessions.map((row) => Math.floor((today - new Date(row.startedAt).setHours(0, 0, 0, 0)) / 86400000)).filter((daysAgo) => daysAgo >= 0 && daysAgo < weeks * days).map((daysAgo) => weeks * days - 1 - daysAgo));
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">PROGRESS / <b>YOUR TRAJECTORY</b></span>
    <span class="spacer"></span>
    <span class="chip teal"><span class="dot"></span>${completed.length ? 'REAL SESSION HISTORY' : 'FIRST REP AWAITS'}</span>
    <span class="chip">${sessions.length} SESSIONS</span>
  </div>
  <div class="prog-body">
    <section class="prog-skills">
      <div class="t-section mom-title">SKILL MASTERY · VS YOUR OWN CORRIDORS</div>
      ${skills.map(s => `
      <div class="skill-row">
        <em>${s.name}</em>
        <b class="${s.avg != null && s.avg >= 7 ? 'ok' : ''}">${s.avg == null ? '—' : s.avg.toFixed(1)}</b>
        <div class="skill-band"><i class="sb-corr"></i>${s.avg == null ? '' : `<i class="sb-dot" style="left:${(s.avg / 10) * 100}%"></i>`}</div>
        ${spark(s.trend)}
        <span class="skill-pb">PB ${s.pb == null ? '—' : s.pb.toFixed(1)} <i>${s.dir}</i></span>
      </div>`).join('')}
      <div class="prog-note">Framed against your personal corridors only — no population rankings, no percentiles.</div>
    </section>
    <section class="prog-cal">
      <div class="t-section mom-title">CONSISTENCY</div>
      <div class="cal-grid">
        ${Array.from({ length: weeks * days }, (_, i) => `<i class="${practiced.has(i) ? 'on' : ''}"></i>`).join('')}
      </div>
      <div class="cal-legend"><span>5 WEEKS</span><span><i class="on"></i> PRACTICED</span></div>
    </section>
    <section class="prog-hist">
      <div class="t-section mom-title">SESSION HISTORY</div>
      ${sessions.map((s, i) => { const scores = rowScores(s); return `
      <button class="hist-row" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-open="${s.id}">
        <span class="hr-art" style="background-image:${sceneDataUri(MODE_ART[s.sessionType] || 'mock')}"></span>
        <span class="hr-tx"><b>${s.title}</b><small>${new Date(s.startedAt).toLocaleString()} · ${rowDuration(s)}</small></span>
        <span class="hr-scores">${scoreText(scores.pace)} · ${scoreText(scores.volume)} · ${scoreText(scores.variety)}</span>
        <span class="hr-go">▸</span>
      </button>`; }).join('') || '<div class="mom-empty">Complete a real session to begin your trajectory.</div>'}
    </section>
  </div>`;
  el.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) go('results', open.dataset.open);
  });
}

/* ================= SETTINGS ================= */
function settingsScreen(el) {
  el.innerHTML = `
  <div class="topline"><span class="crumb">SETTINGS / <b>YOUR DEFAULTS</b></span></div>
  <div class="set-body">
    <div class="panel">
      <div class="t-label pl-title">SESSION DEFAULTS</div>
      <button class="gtoggle t-red" role="switch" aria-checked="${ui.recording}" data-focusable data-autofocus data-tog="recording">
        <span class="tx"><b>Recording on by default</b><small>Every session saves to your MissionMed library.</small></span><span class="knob"></span>
      </button>
      <button class="gtoggle" role="switch" aria-checked="${ui.coaching}" data-focusable data-tog="coaching">
        <span class="tx"><b>Live coaching</b><small>One whisper at a time while you answer.</small></span><span class="knob"></span>
      </button>
      <button class="gtoggle t-teal" role="switch" aria-checked="${ui.analyticsVisible}" data-focusable data-tog="analyticsVisible">
        <span class="tx"><b>Analytics visible</b><small>Off = interview-only room; measurement continues.</small></span><span class="knob"></span>
      </button>
      <button class="gtoggle" role="switch" aria-checked="${ui.reducedMotion}" data-focusable data-tog="reducedMotion">
        <span class="tx"><b>Reduced motion</b><small>Static environments, instant transitions.</small></span><span class="knob"></span>
      </button>
    </div>
    <div class="panel">
      <div class="t-label pl-title">YOUR CORRIDORS</div>
      <div class="cal-row"><em>PACE</em><b>${CALIBRATION.paceCorridor[0]}–${CALIBRATION.paceCorridor[1]} WPM</b></div>
      <div class="cal-row"><em>VOLUME</em><b>${CALIBRATION.volumeCorridorLu[0]}…+${CALIBRATION.volumeCorridorLu[1]} LU</b></div>
      <div class="cal-row"><em>GESTURES</em><b>${CALIBRATION.gestureCorridor[0]}–${CALIBRATION.gestureCorridor[1]} / min</b></div>
      <div class="cal-note">Corridors are tuned inside each live instrument (⚙) and persist to your profile.</div>
    </div>
    <div class="panel">
      <div class="t-label pl-title">PRIVACY — PLAIN LANGUAGE</div>
      <div class="priv">
        <p><b>What is recorded:</b> your camera and microphone during a session, plus the delivery metrics computed from them.</p>
        <p><b>Where it lives:</b> your MissionMed account library. Only you and your assigned mentors can view it.</p>
        <p><b>Deletion:</b> you can delete any recording from its detail page; deletion is permanent.</p>
        <p><b>What is never claimed:</b> emotion, honesty, or a universal “good voice.” Instruments measure delivery against your own corridors.</p>
      </div>
    </div>
  </div>`;
  el.addEventListener('click', e => {
    const tog = e.target.closest('[data-tog]');
    if (!tog) return;
    const k = tog.dataset.tog;
    ui[k] = !ui[k]; saveUi();
    tog.setAttribute('aria-checked', ui[k]);
    if (k === 'reducedMotion') setReducedMotion(ui[k]);
    void ivocApi.savePreferences({
      calibration: { paceCorridor: CALIBRATION.paceCorridor, volumeCorridorLu: CALIBRATION.volumeCorridorLu, gestureCorridor: CALIBRATION.gestureCorridor },
      visibility: { analyticsVisible: ui.analyticsVisible }, coachingEnabled: ui.coaching, recordingDefault: ui.recording,
    }).catch(() => toast('Preference saved locally; account sync will retry later.', 'info'));
  });
}

/* ================= MENTOR ================= */
async function mentorScreen(el) {
  if (!account.identity?.mentor && !account.identity?.admin) { go('home'); return; }
  const sessions = (await ivocApi.library(account.identity.admin ? 'all' : 'assigned')).sessions || [];
  let mentorFilter = 'pending';
  let mentorQuery = '';
  let mentorStudent = 'all';
  let mentorMode = 'all';
  let mentorCategory = 'all';
  let mentorDateRangeDays = 0;
  const students = [...new Map(sessions.map(row => [String(row.ownerId || row.studentId || row.studentName || row.ownerDisplayName || 'unknown'), row.ownerDisplayName || row.studentName || 'Assigned student'])).entries()];
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">MENTOR REVIEW / <b>YOUR STUDENTS</b></span>
    <span class="spacer"></span>
    <span class="chip amber"><span class="dot"></span>${account.identity.admin ? 'ADMIN GLOBAL VIEW' : 'ASSIGNED MENTOR VIEW'}</span>
  </div>
  <div class="mentor-body">
    <section class="panel">
      <div class="mentor-toolbar">
        <div><div class="t-label pl-title">REVIEW QUEUE</div><small>${sessions.filter(row => row.reviewStatus !== 'reviewed').length} PENDING · ${sessions.length} ASSIGNED</small></div>
        <label class="lib-search"><span>FIND STUDENT / SESSION</span><input id="mentorSearch" type="search" placeholder="Search review queue"></label>
        <label class="lib-filter-select"><span>STUDENT</span><select id="mentorStudent"><option value="all">All assigned</option>${students.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label>
        <label class="lib-filter-select"><span>MODE</span><select id="mentorMode"><option value="all">All modes</option><option value="quick">Quick</option><option value="question">Question</option><option value="mock">Mock</option></select></label>
        <label class="lib-filter-select"><span>CATEGORY</span><select id="mentorCategory"><option value="all">All categories</option>${CATEGORIES.map(item => `<option value="${item.id}">${esc(item.label)}</option>`).join('')}</select></label>
        <label class="lib-filter-select"><span>DATE</span><select id="mentorDate"><option value="0">Any time</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
        <div class="mentor-filters"><button class="on" data-mf="pending">PENDING</button><button data-mf="reviewed">REVIEWED</button><button data-mf="all">ALL</button></div>
      </div>
      <div id="mentorRows"></div>
    </section>
    <section class="panel">
      <div class="t-label pl-title">HOW MENTOR ACCESS WORKS</div>
      <div class="priv">
        <p>Mentors see only assigned students. Access is checked server-side per recording and logged. Students always see the review state of each recording.</p>
      </div>
    </section>
  </div>`;
  const rowsHost = el.querySelector('#mentorRows');
  function paintMentorRows() {
    const enriched = sessions.map(row => ({ ...row, questionCategory: qOf(row.questionId)?.cat || row.questionCategory || '' }));
    const rows = selectMentorSessions(enriched, {
      filter: mentorFilter, query: mentorQuery, student: mentorStudent, mode: mentorMode,
      category: mentorCategory, dateRangeDays: mentorDateRangeDays,
    });
    rowsHost.innerHTML = rows.map((s, i) => { const scores = rowScores(s); const reviewed = s.reviewStatus === 'reviewed'; return `
    <div class="ment-row ${reviewed ? 'reviewed' : ''}">
      <button class="hist-row" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-open="${s.id}" style="flex:1">
        <span class="hr-art" style="background-image:${sceneDataUri(MODE_ART[s.sessionType] || 'mock')}"></span>
        <span class="hr-tx"><b>${esc(s.ownerDisplayName || s.studentName || 'Assigned student')}</b><small>${esc(s.title)} · ${esc(s.questionText || qOf(s.questionId)?.text || 'Question not retained')} · ${new Date(s.startedAt).toLocaleString()} · ${rowDuration(s)}</small></span>
        <span class="hr-scores">PACE ${scoreText(scores.pace)} · VOL ${scoreText(scores.volume)} · VAR ${scoreText(scores.variety)}</span>
        <span class="chip">${esc(s.assignmentStatus || 'ASSIGNED')}</span>
      </button>
      ${reviewed ? '<span class="chip teal">✓ REVIEWED</span>' : `<button class="btn btn-quiet" data-focusable data-rev="${s.id}">✓ MARK REVIEWED</button>`}
    </div>`; }).join('') || '<div class="mom-empty">No sessions match this review view.</div>';
  }
  paintMentorRows();
  el.querySelector('#mentorSearch').addEventListener('input', event => { mentorQuery = event.target.value.trim().toLowerCase(); paintMentorRows(); });
  el.querySelector('#mentorStudent').addEventListener('change', event => { mentorStudent = event.target.value; paintMentorRows(); });
  el.querySelector('#mentorMode').addEventListener('change', event => { mentorMode = event.target.value; paintMentorRows(); });
  el.querySelector('#mentorCategory').addEventListener('change', event => { mentorCategory = event.target.value; paintMentorRows(); });
  el.querySelector('#mentorDate').addEventListener('change', event => { mentorDateRangeDays = Number(event.target.value) || 0; paintMentorRows(); });
  el.addEventListener('click', e => {
    const filterButton = e.target.closest('[data-mf]');
    if (filterButton) {
      mentorFilter = filterButton.dataset.mf;
      el.querySelectorAll('[data-mf]').forEach(button => button.classList.toggle('on', button === filterButton));
      paintMentorRows(); return;
    }
    const rev = e.target.closest('[data-rev]');
    if (rev) {
      void ivocApi.markReviewed(rev.dataset.rev).then(() => { toast('Marked reviewed — the student sees this immediately.', 'save'); mentorScreen(el); });
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) go('results', open.dataset.open);
  });
}

export const POST_SCREENS = {
  results: { render: resultsScreen, envTheme: 'results', back: 'home', hilite: 'results' },
  library: { render: libraryScreen, envTheme: 'library', back: 'home', hilite: 'library' },
  progress: { render: progressScreen, envTheme: 'progress', back: 'home', hilite: 'progress' },
  settings: { render: settingsScreen, envTheme: 'lobby', back: 'home', hilite: 'settings' },
  mentor: { render: mentorScreen, envTheme: 'lobby', back: 'home', hilite: 'mentor' },
};
