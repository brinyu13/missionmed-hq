/* ============================================================
   3528B — Post-match screens: RESULTS (premium debrief),
   LIBRARY (archive wall), PROGRESS, SETTINGS, MENTOR.
   Adult, professional, zero childish gamification.
   ============================================================ */
import { sceneDataUri } from './art.mjs';
import { QUESTIONS, CATEGORIES, CALIBRATION } from './data.mjs';
import { account, accountName } from './account.mjs';
import { ivocApi } from './api.mjs';
import { ui, saveUi, draft, saveDraft, go, toast, session, setReducedMotion } from './main.mjs';

const qOf = id => QUESTIONS.find(q => q.id === id);
const fmt = s => { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function plateTint(v) { return v != null && v >= 7 && v <= 8.5 ? 'teal' : 'gold'; }

/* build a results model from the live session or a library row */
async function resultsModel(param) {
  if ((!param || param === 'last') && session.last) {
    const s = session.last;
    return {
      title: s.title, q: s.question, date: 'Just now', dur: fmt(s.dur), recorded: s.recorded,
      scores: { pace: s.scores.pace, volume: s.scores.volume, variety: s.scores.variety },
      wpmAvg: s.wpmAvg, counters: s.counters, events: s.events, total: s.t, live: true,
      recordingId: s.recordingId, payload: { scores: s.scores, counters: s.counters, events: s.events, history: s.history },
    };
  }
  let row = null;
  if (param) row = await ivocApi.session(param).catch(() => null);
  if (!row) row = (await ivocApi.library().catch(() => ({ sessions: [] }))).sessions?.[0] || null;
  if (!row) return {
    title: 'No completed session', q: null, date: '—', dur: '00:00', recorded: false,
    scores: { pace: null, volume: null, variety: null }, wpmAvg: null, total: 1,
    counters: { nods: 0, smiles: 0, gestures: 0, handsPct: null }, events: [], payload: null,
  };
  const payload = row.results?.payload || {};
  const q = qOf(row.questionId) || (row.questionText ? { id: row.questionId, text: row.questionText } : null);
  const durS = Math.max(0, Number(row.durationMs || row.recording?.durationMs || 0) / 1000);
  return {
    id: row.id, title: row.title, q,
    date: row.endedAt ? new Date(row.endedAt).toLocaleString() : new Date(row.startedAt).toLocaleString(),
    dur: fmt(durS), recorded: row.recording?.status === 'saved', recordingId: row.recording?.id || null,
    scores: { pace: payload.scores?.pace ?? null, volume: payload.scores?.volume ?? null, variety: payload.scores?.variety ?? null },
    wpmAvg: payload.metrics?.SPEED_WPM?.wordsPerMinute ?? payload.wpmAvg ?? null, total: Math.max(1, durS),
    counters: { nods: payload.counters?.nods ?? 0, smiles: payload.counters?.smiles ?? 0, gestures: payload.counters?.gestures ?? 0, handsPct: payload.counters?.handsPct ?? null },
    events: Array.isArray(payload.events) ? payload.events : [], payload,
  };
}

const EV_META = {
  smile: { color: 'var(--g-teal)', icon: '☺', pos: true },
  gesture: { color: 'var(--g-cyan)', icon: '✦', pos: true },
  nod: { color: 'var(--g-violet)', icon: '◦', pos: true },
  answer: { color: 'var(--g-gold)', icon: '■', pos: true },
  cue: { color: 'var(--g-gold)', icon: '↕', pos: false },
};

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
        ${counters.map(([k, v]) => `<div class="rcount"><em>${k}</em><b>${v}</b></div>`).join('')}
      </div>
      <div class="res-progression">
        <span class="chip teal"><span class="dot"></span>STRUCTURED RESULTS SAVED</span>
        <span class="chip">ACCOUNT VIDEO LIBRARY</span>
        <span class="chip">YOUR PERSONAL CORRIDORS</span>
      </div>
    </div>
  </div>

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
  async function ensureReplay() {
    if (!m.recordingId) { toast('This session has no saved recording.', 'info'); return null; }
    if (!playback) playback = await ivocApi.playback(m.recordingId);
    const video = el.querySelector('#rrVideo');
    if (video.src !== playback.url) video.src = playback.url;
    video.hidden = false;
    el.querySelector('.rr-art').hidden = true;
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
      const t = +seek.dataset.seek;
      const head = el.querySelector('#rrHead');
      const pos = el.querySelector('#rrPos');
      if (head) { head.style.left = `${(t / m.total) * 100}%`; pos.textContent = fmt(t); }
      void ensureReplay().then((video) => { if (video) { video.currentTime = t; void video.play(); toast(`Replay seek → ${fmt(t)}`, 'info'); } });
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
}

/* ================= LIBRARY ================= */
const MODE_ART = { quick: 'quick', question: 'question', mock: 'mock' };
function rowScores(row) {
  const scores = row.results?.payload?.scores || {};
  return { pace: scores.pace ?? null, volume: scores.volume ?? null, variety: scores.variety ?? null };
}
function rowDuration(row) { return fmt(Number(row.durationMs || row.recording?.durationMs || 0) / 1000); }
function scoreText(value) { return value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—'; }
async function libraryScreen(el) {
  let filter = 'all';
  const payload = await ivocApi.library();
  const sessions = payload.sessions || [];
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
  <div class="lib-grid" id="libGrid"></div>`;

  const grid = el.querySelector('#libGrid');
  function paint() {
    const rows = sessions.filter(s =>
      filter === 'all' ? true :
        filter === 'reviewed' ? s.reviewStatus === 'reviewed' :
          filter === 'pending' ? s.reviewStatus !== 'reviewed' : s.sessionType === filter);
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
          <b>${s.title}</b>
          <small>${new Date(s.startedAt).toLocaleString()} · ${q ? CATEGORIES.find(c => c.id === q.cat)?.label || '' : ''}</small>
          <em>PACE ${scoreText(scores.pace)} · VOL ${scoreText(scores.volume)} · VAR ${scoreText(scores.variety)}</em>
        </span>
      </button>`; }).join('') ||
      `<div class="lib-empty"><span class="le-art" style="background-image:${sceneDataUri('library')}"></span><b>No recordings here yet.</b><span>Start your first session — it lands in your library automatically.</span></div>`;
  }
  paint();
  el.addEventListener('click', e => {
    const f = e.target.closest('[data-f]');
    if (f) {
      filter = f.dataset.f;
      el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === f));
      paint(); return;
    }
    const open = e.target.closest('[data-open]');
    if (open) go('results', open.dataset.open);
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
  const queue = (await ivocApi.library(account.identity.admin ? 'all' : 'assigned')).sessions?.filter((s) => s.reviewStatus !== 'reviewed') || [];
  el.innerHTML = `
  <div class="topline">
    <span class="crumb">MENTOR REVIEW / <b>YOUR STUDENTS</b></span>
    <span class="spacer"></span>
    <span class="chip amber"><span class="dot"></span>${account.identity.admin ? 'ADMIN GLOBAL VIEW' : 'ASSIGNED MENTOR VIEW'}</span>
  </div>
  <div class="mentor-body">
    <section class="panel">
      <div class="t-label pl-title">REVIEW QUEUE · ${queue.length} PENDING</div>
      ${queue.map((s, i) => { const scores = rowScores(s); return `
      <div class="ment-row">
        <button class="hist-row" data-focusable ${i === 0 ? 'data-autofocus' : ''} data-open="${s.id}" style="flex:1">
          <span class="hr-art" style="background-image:${sceneDataUri(MODE_ART[s.sessionType] || 'mock')}"></span>
          <span class="hr-tx"><b>${s.title}</b><small>${new Date(s.startedAt).toLocaleString()} · ${rowDuration(s)}</small></span>
          <span class="hr-scores">${scoreText(scores.pace)} · ${scoreText(scores.volume)} · ${scoreText(scores.variety)}</span>
        </button>
        <button class="btn btn-quiet" data-focusable data-rev="${s.id}">✓ MARK REVIEWED</button>
      </div>`; }).join('') || '<div class="mom-empty">Queue clear — every assigned recording reviewed.</div>'}
    </section>
    <section class="panel">
      <div class="t-label pl-title">HOW MENTOR ACCESS WORKS</div>
      <div class="priv">
        <p>Mentors see only assigned students. Access is checked server-side per recording and logged. Students always see the review state of each recording.</p>
      </div>
    </section>
  </div>`;
  el.addEventListener('click', e => {
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
