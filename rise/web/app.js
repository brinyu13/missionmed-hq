/* Generated from the founder-approved Fable 5002 shell. Do not edit directly. */
'use strict';

const UNKNOWN_DOMAINS = Object.freeze({
  roster: 'NOT_YET_VERIFIED', leadership: 'NOT_YET_VERIFIED', requirements: 'NOT_YET_VERIFIED',
  visa: 'NOT_YET_VERIFIED', salary: 'NOT_YET_VERIFIED', fellowship: 'NOT_YET_VERIFIED', outcomes: 'NOT_YET_VERIFIED',
});

async function riseFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (globalThis.__RISE_RUNTIME__?.session?.csrfToken && options.method && options.method !== 'GET') {
    headers.set('X-RISE-CSRF', globalThis.__RISE_RUNTIME__.session.csrfToken);
  }
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || `RISE request failed (${response.status})`);
    error.code = body?.error?.code || 'RISE_REQUEST_FAILED';
    error.status = response.status;
    error.details = body?.error?.details;
    if (response.status === 401 && body?.error?.details?.loginUrl) location.assign(body.error.details.loginUrl);
    throw error;
  }
  return body;
}

function identifier(record, namespace) {
  return (record.identifiers || []).find(item => item.namespace === namespace)?.value || null;
}

function shortSpecialty(designation) {
  const known = { 'Internal Medicine': 'IM', 'Family Medicine': 'FM', Pediatrics: 'PEDS', Neurology: 'NEURO', Psychiatry: 'PSYCH' };
  return known[designation] || designation.split(/\s|\//).filter(Boolean).map(word => word[0]).join('').slice(0, 6).toUpperCase();
}

function toFableProgram(record) {
  const evidenceCount = Number(record.evidence?.knownEvidenceLabeledClaims ?? record.evidence?.knownClaims ?? 0);
  return {
    id: record.programSpecialtyId,
    legacyId: null,
    acgme: identifier(record, 'ACGME_PROGRAM'),
    name: record.display?.programName || 'Unnamed program',
    inst: record.display?.institution || record.display?.programName || 'Institution not published',
    hospital: record.display?.hospital || null,
    city: record.display?.city || 'Location not published',
    state: record.display?.state || '',
    spec: shortSpecialty(record.designation || 'Program'),
    specName: record.designation || 'Specialty not published',
    track: record.entryFormat || 'Not published',
    url: record.officialUrl || null,
    tier: null,
    officialFacts: evidenceCount,
    depth: evidenceCount ? 'registry' : 'identity',
    verified: record.source?.retrievedAt || record.source?.sourceUpdatedAt || null,
    type: record.programType || 'Not published',
    positions: 'Not published',
    abim: { state: 'NOT_PUBLISHED' },
    domains: { ...UNKNOWN_DOMAINS },
    soap: [],
    aliases: [],
    maturity: 'CANONICAL_IDENTITY_ONLY',
    demo: false,
    rich: null,
  };
}

async function loadAllPrograms() {
  const catalog = await riseFetch('/api/rise/v1/programs/catalog');
  return {
    records: [...(catalog.records || [])],
    registryReleaseId: catalog.registryReleaseId,
    total: catalog.total,
  };
}

async function loadRuntime() {
  const session = await riseFetch('/api/rise/v1/session');
  const [status, registry, savedResult] = await Promise.all([
    riseFetch('/api/rise/v1/status'),
    loadAllPrograms(),
    riseFetch('/api/rise/v1/me/programs'),
  ]);
  const saved = new Map((savedResult.records || []).map(record => [record.programSpecialtyId, {
    state: record.state,
    notes: record.notes || '',
  }]));
  return {
    session,
    status,
    saved,
    persistence: savedResult.persistence || 'unavailable',
    data: {
      meta: {
        build: status.buildId,
        corpus: registry.registryReleaseId,
        generated: new Date().toISOString().slice(0, 10),
        programCount: registry.total,
        soapJoined: 0,
      },
      profile: {
        name: 'Student',
        demo: false,
        available: false,
        facts: [],
        completeness: 0,
        missing: ['Matrix profile integration is not authorized for this release'],
      },
      programs: registry.records.map(toFableProgram),
    },
  };
}

let runtime;
try {
  runtime = await loadRuntime();
} catch (error) {
  document.body.classList.remove('is-booting');
  const main = document.querySelector('#main');
  if (main) main.innerHTML = `<div class="view"><p class="eyebrow">RISE unavailable</p><h1 class="h1">We could not load your <em>verified data</em></h1><p class="sub">${String(error.message).replace(/[&<>"']/g, '')}</p></div>`;
  throw error;
}
globalThis.__RISE_RUNTIME__ = runtime;
const D = runtime.data;

/* ============================================================
   RISE NEXT-GEN FOUNDER SHELL · app core
   P1-RISE-5002 — implements P1-RISE-5001 docs 05/06/07 (+04 chassis)
   Production wiring only: no network, no backend, simulate everything.
   ============================================================ */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------------- state ---------------- */
const state = {
  role: runtime.session.role === 'admin' || runtime.session.role === 'operator' ? 'admin' : 'student',
  canAdmin: runtime.session.capabilities.includes('rise:operator'),
  member: runtime.session.capabilities.includes('rise:premium'),
  theme: 'midnight',
  saved: runtime.saved,
  compare: [],
  underlying: null,                   // last non-file route
  find: { mode: 'profile', q: '', state: '', soap: false, soapTrack: '', abim: false, depth: '', fresh: '', visaPub: false, imgEv: false, sort: 'fit', view: 'list', shown: 50, scroll: 0, moreOpen: false },
  fileTab: 'overview',
  fileFrom: 'find',
  campaigns: [],
  reviewDone: new Set(),
  dismissedLocks: new Set(),
  updating: new Set(),                // program ids currently updating from an authorized research job
  changed: [],                        // ingest log for "Updated this week"
};

/* Campaign state is loaded only from an authorized research backend. */

/* ---------------- program index ---------------- */
const byId = new Map(D.programs.map(p => [p.id, p]));
const STATES = [...new Set(D.programs.map(p => p.state))].sort();
const stateNames = { AL:'Alabama', AR:'Arkansas', AZ:'Arizona', CA:'California', CO:'Colorado', CT:'Connecticut', DC:'Washington DC', DE:'Delaware', FL:'Florida', GA:'Georgia', IA:'Iowa', IL:'Illinois', IN:'Indiana', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', MA:'Massachusetts', MD:'Maryland', MI:'Michigan', MN:'Minnesota', MO:'Missouri', MS:'Mississippi', MT:'Montana', NC:'North Carolina', ND:'North Dakota', NE:'Nebraska', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NV:'Nevada', NY:'New York', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', PR:'Puerto Rico', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VA:'Virginia', VT:'Vermont', WA:'Washington', WI:'Wisconsin', WV:'West Virginia', WY:'Wyoming' };

/* ---------------- fit engine ---------------- */
const fitCache = new Map();
function computeFit(p) {
  if (fitCache.has(p.id)) return fitCache.get(p.id);
  const f = { tier: null, line: 'Needs more verified data — fit is not forced', reasons: [], rep: false, counts: null, known: false };
  fitCache.set(p.id, f);
  return f;
}
const tierHue = t => t === 'gold' ? 'var(--gold-fit)' : t === 'silver' ? 'var(--silver-fit)' : 'transparent';
function tierChip(p, f) {
  if (!f.tier) return '';
  return `<span class="tierChip ${f.tier}" title="Computed from verified requirements">${f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit'}</span>`;
}
const FIT_LEGEND = 'Fit tiers describe how accessible a program looks for your profile, from published requirements and evidence. They are not match odds.';

/* ---------------- freshness (doc 05 §5.8) ---------------- */
function freshness(p) {
  if (state.updating.has(p.id)) return { cls: 'fp-run', label: 'Updating' };
  const d = p.verified ? new Date(p.verified) : new Date(0), now = new Date();
  const days = (now - d) / 864e5;
  if (days <= 45) return { cls: 'fp-ok', label: 'Verified recently' };
  if (d >= new Date('2026-06-01')) return { cls: 'fp-cycle', label: 'Current cycle' };
  return { cls: 'fp-old', label: 'Needs refresh' };
}
const freshPill = p => { const f = freshness(p); return `<span class="freshPill ${f.cls}"><i></i>${f.label}</span>`; };

/* ---------------- glyphs ---------------- */
const GLYPH = {
  meets: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="var(--meets)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><path d="M10 3l8 14H2z" stroke="var(--check)" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 8.5v3.6" stroke="var(--check)" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="14.6" r="1" fill="var(--check)"/></svg>',
  issue: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="var(--issue)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  unknown: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="var(--unknown)" stroke-width="1.8" stroke-dasharray="3.4 3"/></svg>',
  conflict: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="var(--conflict)" stroke-width="1.8"/><path d="M10 3a7 7 0 010 14z" fill="var(--conflict)" opacity=".6"/></svg>',
  na: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><path d="M5 10h10" stroke="var(--dim)" stroke-width="2" stroke-linecap="round"/></svg>',
  info: '<svg class="glyph" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="var(--cy)" stroke-width="1.6"/><path d="M10 9v5M10 6.2v.4" stroke="var(--cy)" stroke-width="2" stroke-linecap="round"/></svg>',
};
const STATE_WORD = { meets: 'Meets', check: 'Check', issue: 'Issue', unknown: 'Not published', conflict: 'Conflicting', na: 'N/A', info: 'Policy' };
const stateTag = (s, word) => `<span class="stateTag st-${s}">${GLYPH[s] || ''}${esc(word || STATE_WORD[s] || s)}</span>`;
const ICONS = {
  home: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z"/></svg>',
  find: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  my: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z"/></svg>',
  rank: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h10M4 12h13M4 18h7"/><path d="M19 5v6M16 8h6" stroke-linecap="round"/></svg>',
  prof: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  res: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6v4a3 3 0 01-1 2.2V12l5 7a1.5 1.5 0 01-1.2 2.4H6.2A1.5 1.5 0 015 19l5-7V9.2A3 3 0 019 7z"/></svg>',
  queue: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2"/></svg>',
  review: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="4" width="16" height="16" rx="3"/></svg>',
  cov: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  lock: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
  star: '★', search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
};

/* ---------------- toast / modal ---------------- */
let toastT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3400); }
let modalReturn = null;
function openModal(html, opts) {
  modalReturn = document.activeElement;
  const m = $('#modal');
  m.innerHTML = `<div class="modalSheet" role="dialog" aria-modal="true"><button class="modalClose" aria-label="Close" onclick="closeModal()">✕</button>${html}</div>`;
  m.classList.add('open');
  $('#main').setAttribute('inert', '');
  const f = $('.modalSheet button:not(.modalClose), .modalSheet [tabindex]');
  (f || $('.modalClose')).focus();
}
function closeModal() {
  $('#modal').classList.remove('open'); $('#modal').innerHTML = '';
  if (!$('#file').classList.contains('open')) $('#main').removeAttribute('inert');
  if (modalReturn && modalReturn.focus) modalReturn.focus();
}
window.closeModal = closeModal;

/* ---------------- unlock sheet (doc 11) ---------------- */
function unlockSheet(what, summary) {
  openModal(`
    <div class="mKicker">✦ Membership depth</div>
    <div class="mTitle">${esc(what)}</div>
    <div class="mSum">${summary}</div>
    <div class="mSum" style="margin-top:8px">Entitlement verification is unavailable for this release, so access fails closed.</div>
    <div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>
    <div class="mFoot">No preview toggle and no inferred membership mapping.</div>`);
}
window.unlockSheet = unlockSheet;

/* ---------------- save / compare ---------------- */
async function persistProgramState(id) {
  const record = state.saved.get(id);
  if (!record) {
    await riseFetch('/api/rise/v1/me/programs/' + encodeURIComponent(id), { method: 'DELETE' });
    return;
  }
  await riseFetch('/api/rise/v1/me/programs/' + encodeURIComponent(id), {
    method: 'PUT', body: JSON.stringify({ state: record.state, notes: record.notes }),
  });
}
async function toggleSave(id, ev) {
  if (ev) ev.stopPropagation();
  const previous = state.saved.has(id) ? { ...state.saved.get(id) } : null;
  if (previous) { state.saved.delete(id); toast('Removed from My Programs'); }
  else { state.saved.set(id, { state: 'SAVED', notes: '' }); toast('Saved to My Programs'); }
  rerender();
  try { await persistProgramState(id); }
  catch (error) {
    if (previous) state.saved.set(id, previous); else state.saved.delete(id);
    rerender(); toast('Could not sync My Programs — no change was saved.');
  }
}
window.toggleSave = toggleSave;
function toggleCompare(id, ev) {
  if (ev) ev.stopPropagation();
  const i = state.compare.indexOf(id);
  if (i >= 0) { state.compare.splice(i, 1); toast('Removed from Compare'); }
  else if (state.compare.length >= 4) { toast('Compare holds four programs max'); }
  else { state.compare.push(id); toast(`Added to Compare (${state.compare.length} of 4)`); }
  renderShell(); if (currentRoute().startsWith('program/')) openFileFor(currentRoute()); else rerender();
}
window.toggleCompare = toggleCompare;

/* ---------------- router ---------------- */
function currentRoute() { return location.hash.replace(/^#\/?/, ''); }
function nav(r) { location.hash = '#/' + r; }
window.nav = nav;
function onRoute() {
  const r = currentRoute();
  const file = $('#file');
  if (r.startsWith('program/')) {
    if (!state.underlying) { state.underlying = 'find'; renderMain('find'); }
    openFileFor(r);
    return;
  }
  const base = r.split('/')[0] || 'home';
  if (base === 'admin' && !state.canAdmin) { toast('Admin access is not available for this account.'); nav('home'); return; }
  if ((base === 'admin') !== (state.role === 'admin')) { state.role = base === 'admin' ? 'admin' : 'student'; }
  if (file.classList.contains('open')) {
    const same = (r || 'home') === (state.underlying || 'home');
    const sc = $('#main').scrollTop;
    closeFile(false);
    state.underlying = r || 'home';
    renderMain(r || 'home');
    if (same) {
      $('#main').scrollTop = sc;
      if (state.lastOpenedId) { const row = $(`#main [data-open="${state.lastOpenedId}"]`); if (row) row.focus(); }
      const live = $('#toast'); // polite announcement
    }
    return;
  }
  state.underlying = r || 'home';
  renderMain(r || 'home');
}
window.addEventListener('hashchange', onRoute);

function rerender() { renderShell(); const r = currentRoute(); if (!r.startsWith('program/')) renderMain(r || 'home'); }
window.rerender = rerender;

/* ---------------- shell ---------------- */
function renderShell() {
  const r = (currentRoute() || 'home');
  const activeBase = r.startsWith('program/') ? (state.fileFrom === 'my' ? 'my' : state.fileFrom === 'home' ? 'home' : 'find') : r.split('/')[0] || 'home';
  const adminView = r.split('/')[1] || 'research';
  const student = [
    ['home', 'Home', ICONS.home], ['find', 'Find Programs', ICONS.find], ['my', 'My Programs', ICONS.my],
    ['rank', 'Rank List', ICONS.rank], ['profile', 'My Profile', ICONS.prof],
  ];
  const admin = [['admin/research', 'Research', ICONS.res], ['admin/queue', 'Queue', ICONS.queue], ['admin/review', 'Review', ICONS.review], ['admin/coverage', 'Coverage', ICONS.cov]];
  const savedN = state.saved.size;
  $('#rail').innerHTML = `
    <button class="railCta" onclick="focusLookup()">✦ <span>Tell me about…</span></button>
    ${student.map(([k, l, ic]) => `<button class="rtab ${activeBase === k ? 'on' : ''}" ${activeBase === k ? 'aria-current="page"' : ''} onclick="nav('${k}')">${ic}<span>${l}</span>${k === 'my' && savedN ? `<span class="badge">${savedN}</span>` : ''}</button>`).join('')}
    ${state.role === 'admin' ? `<div class="railSep"></div><div class="railGroupLbl">Research · Admin</div>` +
      admin.map(([k, l, ic]) => `<button class="rtab adminTab ${r === k || (activeBase === 'admin' && k.endsWith(adminView) && r.startsWith('admin')) ? (r === k ? 'on' : '') : ''} ${r === k ? 'on' : ''}" onclick="nav('${k}')">${ic}<span>${l}</span>${k === 'admin/review' ? `<span class="badge">${4 - state.reviewDone.size > 0 ? 4 - state.reviewDone.size : ''}</span>` : ''}</button>`).join('') : ''}
    <div class="railFoot">
      <button class="matrixBack" onclick="toast('Production wiring — Matrix link not wired.')">↩ <span>Back to Matrix</span></button>
      <div class="roleRow ${state.role}"><span class="roleDot"></span><span class="roleName">${state.role === 'admin' ? 'Admin' : 'Student'}</span></div>
      ${state.canAdmin ? `<button class="roleSwitch" onclick="switchRole()">${state.role === 'admin' ? 'View student experience' : 'Admin tools'}</button>` : ''}
      <div class="identity"><span>${esc(D.profile.name)} · ${D.profile.available ? 'Matrix profile' : 'Profile unavailable'}</span></div>
    </div>`;
  $('#cmpCount').textContent = state.compare.length;
}
function switchRole() {
  if (!state.canAdmin) { toast('Admin access is not available for this account.'); return; }
  if (state.role === 'admin') { state.role = 'student'; nav('home'); }
  else { state.role = 'admin'; nav('admin/research'); }
}
window.switchRole = switchRole;
function focusLookup() {
  if ((currentRoute() || 'home') === 'home' && $('#heroInput')) { $('#heroInput').focus(); }
  else $('#omni').focus();
}
window.focusLookup = focusLookup;

/* ---------------- lookup (doc 06 §6.3) ---------------- */
function searchPrograms(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const toks = q.split(/\s+/);
  return D.programs.map(p => {
    const hay = [p.name, p.inst, p.city, p.state, stateNames[p.state] || '', (p.aliases || []).join(' ')].join(' ').toLowerCase();
    let score = 0;
    if (!toks.every(t => hay.includes(t))) return null;
    if (p.name.toLowerCase().startsWith(q)) score += 40;
    if ((p.aliases || []).some(a => a.startsWith(q))) score += 60;
    score += p.depth === 'gold' ? 20 : p.depth === 'demo' ? 15 : p.tier === 'A' ? 8 : 0;
    return { p, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score).map(x => x.p);
}
function detectIntent(q) {
  const ql = q.toLowerCase();
  const stMatch = Object.entries(stateNames).find(([ab, nm]) => ql.includes(nm.toLowerCase()) || new RegExp(`\\b${ab.toLowerCase()}\\b`).test(ql));
  const cleaned = q.replace(/[?.!,]/g, ' ').replace(/\b(does|do|the|at|for|about|tell|me|check|whether|sponsor|sponsors|sponsorship|h1b|h-1b|j1|j-1|visa|comlex|usmle|deadline|deadlines|step|score|scores|attempt|attempts|programs?|like|what|is|are|how)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const progs = searchPrograms(cleaned);
  if (/programs? like\s+/i.test(ql)) { const p = searchPrograms(ql.replace(/.*programs? like\s+/i, '')); if (p.length) return { kind: 'similar', p: p[0] }; }
  if (/soap/i.test(ql)) return { kind: 'soap', st: stMatch ? stMatch[0] : '' };
  if (/(fit me|fit for me|which .*fit|for me\??$|friendly)/i.test(ql) && stMatch) return { kind: 'fit_in_place', st: stMatch[0] };
  if (/(h-?1b|j-?1|visa|sponsor)/i.test(ql) && progs.length) return { kind: 'fact', p: progs[0], field: 'visa' };
  if (/(comlex|usmle|step|score|attempt)/i.test(ql) && progs.length) return { kind: 'fact', p: progs[0], field: 'exams' };
  if (/deadline/i.test(ql) && progs.length) return { kind: 'fact', p: progs[0], field: 'deadline' };
  if (stMatch && /programs?/i.test(ql)) return { kind: 'fit_in_place', st: stMatch[0] };
  return null;
}
function factCardHTML(p, field) {
  const rows = [];
  if (field === 'visa') {
    if (p.rich && p.rich.visa) {
      p.rich.visa.slice(0, 3).forEach(v => rows.push([v.c, stateTag(v.state, v.state === 'unknown' ? 'Not published as sponsorship' : null) + ` <span style="color:var(--mid);font-size:14px">${esc(v.says)}</span>`]));
    } else {
      rows.push(['Visa sponsorship', stateTag('unknown', p.domains.visa === 'NOT_PUBLICLY_FOUND' ? 'Not publicly found' : 'Not yet verified by RISE')]);
    }
  } else if (field === 'exams') {
    if (p.rich && p.rich.requirements) {
      p.rich.requirements.filter(r => /USMLE|COMLEX/.test(r.c)).slice(0, 3).forEach(r => rows.push([r.c, stateTag(r.state) + ` <span style="color:var(--mid);font-size:14px">${esc(r.says)}</span>`]));
    } else rows.push(['USMLE / COMLEX', stateTag('unknown', 'Deep research pending')]);
  } else {
    if (p.rich && p.rich.requirements) { const d = p.rich.requirements.find(r => /deadline/i.test(r.c)); rows.push(['Deadline', d ? `<b>${esc(d.says)}</b>` : stateTag('unknown')]); }
    else rows.push(['Deadline', stateTag('unknown', 'Not yet verified by RISE')]);
  }
  return `<div class="factCard" role="region" aria-label="Answer">
    <div class="factHead">${esc(p.name)}</div>
    <div class="factSub">${esc(p.inst)} · ${esc(p.city)}, ${esc(p.state)} · ${freshPill(p)}</div>
    ${rows.map(([l, v]) => `<div class="factRow"><span class="fl">${esc(l)}</span><span class="fv">${v}</span></div>`).join('')}
    <div class="factActs"><button class="rowBtn pri" onclick="openProgram('${p.id}','fit','home')">Open File → Fit</button>
    <button class="rowBtn" onclick="toggleSave('${p.id}',event)">${state.saved.has(p.id) ? '★ Saved' : '☆ Save'}</button></div>
  </div>`;
}
function runIntent(intent) {
  if (!intent) return;
  if (intent.kind === 'fact') { const host = $('#heroAC') || $('#omniAC'); host.innerHTML = factCardHTML(intent.p, intent.field); return; }
  if (intent.kind === 'similar') { Object.assign(state.find, { q: '', state: intent.p.state, soap: false, sort: 'fit', mode: 'profile' }); nav('find'); toast('Programs like ' + intent.p.name.split(' ').slice(0, 2).join(' ') + ' — same state, sorted by fit'); return; }
  if (intent.kind === 'soap') { Object.assign(state.find, { soap: true, state: intent.st || '', q: '' }); nav('find'); return; }
  if (intent.kind === 'fit_in_place') { Object.assign(state.find, { state: intent.st, mode: 'profile', sort: 'fit', q: '', soap: false }); nav('find'); return; }
}
function lookupBind(inputSel, acSel, origin) {
  const input = $(inputSel), ac = $(acSel);
  let sel = -1, items = [];
  function close() { ac.innerHTML = ''; sel = -1; items = []; }
  function render(q) {
    const intent = detectIntent(q);
    items = searchPrograms(q);
    if (!q || q.length < 2) { close(); return; }
    if (!items.length && !intent) {
      ac.innerHTML = `<div class="acList"><div class="acNone">I looked for programs matching “${esc(q)}” — try a hospital name or city.</div></div>`; return;
    }
    const top = items.slice(0, 7);
    ac.innerHTML = `<div class="acList" role="listbox">
      ${intent && intent.kind !== 'fact' ? `<button class="acRow" data-i="-2"><span class="acMain"><span class="acName" style="color:var(--cy)">→ ${intent.kind === 'soap' ? 'Show SOAP 2026 openings' + (intent.st ? ' in ' + stateNames[intent.st] : '') : intent.kind === 'similar' ? 'Show programs like ' + esc(intent.p.name) : 'Show programs in ' + stateNames[intent.st] + ' that fit me'}</span><span class="acSub">Opens Find Programs with these filters</span></span></button>` : ''}
      ${top.length ? `<div class="acGroup">Programs</div>` : ''}
      ${top.map((p, i) => { const f = computeFit(p); return `<button class="acRow" role="option" data-i="${i}">
          <span class="specTag">${p.spec}</span>
          <span class="acMain"><span class="acName">${esc(p.name)}</span><span class="acSub">${esc(p.inst)} · ${esc(p.city)}, ${p.state}</span></span>
          <span class="acMeta">${tierChip(p, f)}${p.demo ? '<span class="demoTag">Demo</span>' : ''}<span class="freshPill ${freshness(p).cls}"><i></i></span></span>
        </button>`; }).join('')}
      ${items.length > 7 ? `<button class="acAll" data-i="-3">Show all ${items.length} results in Find Programs →</button>` : ''}
    </div>`;
    $$('.acRow,.acAll', ac).forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); pick(+b.dataset.i, q); }));
  }
  function pick(i, q) {
    if (i === -2) { runIntent(detectIntent(q)); close(); input.blur(); return; }
    if (i === -3) { state.find.q = q; nav('find'); close(); return; }
    const p = items[i >= 0 ? i : 0];
    if (p) { openProgram(p.id, 'overview', origin); close(); input.value = ''; }
  }
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => {
    const rows = $$('.acRow', ac);
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, rows.length - 1); rows.forEach((r, i) => r.classList.toggle('sel', i === sel)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); rows.forEach((r, i) => r.classList.toggle('sel', i === sel)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const intent = detectIntent(input.value);
      if (sel >= 0 && rows[sel]) pick(+rows[sel].dataset.i, input.value);
      else if (intent && intent.kind === 'fact') { runIntent(intent); }
      else if (intent && items.length === 0) { runIntent(intent); close(); }
      else if (items.length) pick(0, input.value);
      else if (intent) { runIntent(intent); close(); }
    }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (!ac.contains(document.activeElement)) close(); }, 180));
}

/* ---------------- main renderer ---------------- */
function renderMain(route) {
  renderShell();
  const main = $('#main');
  const base = route.split('/')[0] || 'home';
  if (base === 'home') main.innerHTML = viewHome();
  else if (base === 'find') main.innerHTML = viewFind();
  else if (base === 'my') main.innerHTML = viewMy();
  else if (base === 'rank') main.innerHTML = viewRank();
  else if (base === 'profile') main.innerHTML = viewProfile();
  else if (base === 'admin') main.innerHTML = viewAdmin(route.split('/')[1] || 'research');
  else main.innerHTML = viewHome();
  afterRender(base);
  const h = $('#main h1'); if (h) { h.setAttribute('tabindex', '-1'); }
}
function afterRender(base) {
  if (base === 'home' && $('#heroInput')) lookupBind('#heroInput', '#heroAC', 'home');
  if (base === 'find') bindFind();
  if (base === 'admin') bindAdmin();
}

/* ---------------- HOME (doc 06) ---------------- */
function goldSilver() {
  const gold = [], silver = [];
  D.programs.forEach(p => { const f = computeFit(p); if (f.tier === 'gold') gold.push([p, f]); else if (f.tier === 'silver') silver.push([p, f]); });
  const w = x => (x[1].known ? 0 : 1) + (x[0].demo ? .5 : 0);
  gold.sort((a, b) => w(a) - w(b)); silver.sort((a, b) => w(a) - w(b));
  return { gold, silver };
}
function compactRow(p, f) {
  return `<div class="pRow" role="button" tabindex="0" style="--tierHue:${tierHue(f.tier)};padding:11px 14px;margin-bottom:7px" onclick="if(!event.target.closest('button'))openProgram('${p.id}','overview','home')" onkeydown="if(event.key==='Enter'&&!event.target.closest('button'))openProgram('${p.id}','overview','home')">
    <button class="starBtn ${state.saved.has(p.id) ? 'on' : ''}" style="width:38px;height:38px;font-size:19px" aria-pressed="${state.saved.has(p.id)}" aria-label="Save ${esc(p.name)}" onclick="toggleSave('${p.id}',event)">★</button>
    <span class="specTag">${p.spec}</span>
    <span class="rMain"><span class="rTitleLine"><span class="rName" style="font-size:16.5px">${esc(p.name)}</span>${p.demo ? '<span class="demoTag">Demo</span>' : ''}</span>
      <span class="rSub" style="font-size:14px">${esc(p.city)}, ${p.state} · ${f.reasons.length ? esc(f.reasons.slice(0, 2).join(' · ')) : esc(f.line)}</span></span>
    <span class="rMeta">${tierChip(p, f)}</span>
  </div>`;
}
function viewHome() {
  const { gold, silver } = goldSilver();
  const prof = D.profile;
  const savedArr = [...state.saved.keys()].map(id => byId.get(id)).filter(Boolean);
  const soapCount = D.programs.filter(p => p.soap.length).length;
  const tries = ['Which New York programs fit me?', 'Show programs with published visa evidence', 'Programs with verified SOAP history'];
  return `<div class="view" data-view="home">
    <section class="homeHero">
      <h1 class="greet">${greeting()}, <em>${esc(prof.name)}</em>.</h1>
      <p class="greetSub">Which program are you wondering about?</p>
      <div class="heroWrap">
        <div class="heroCapture" onclick="$('#heroInput').focus()">
          <span class="pfx">Tell me about</span>
          <input id="heroInput" type="text" placeholder="…a program, a hospital, a city" aria-label="Program lookup" autocomplete="off">
          <button class="heroGo" onclick="const i=$('#heroInput');i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))">Open File</button>
        </div>
        <div id="heroAC"></div>
      </div>
      <div class="tryRow"><span class="tryLbl">Try asking</span>${tries.map(t => `<button class="tryChip" onclick="$('#heroInput').value='${t.replace(/'/g, "\\'")}';$('#heroInput').dispatchEvent(new Event('input'));$('#heroInput').focus()">${t}</button>`).join('')}</div>
    </section>
    <div class="homeGrid">
      <section class="panel" aria-label="Your fit">
        <div class="pHead"><h2 class="h2">Your <em>fit</em></h2><button class="pMore" onclick="Object.assign(state.find,{mode:'profile',sort:'fit'});nav('find')">See all in Find Programs ▸</button></div>
        <div class="pBody">
          <div class="tierHead"><span class="tierChip gold">Gold Fit</span><span class="tierCount">${gold.length}</span></div>
          ${gold.slice(0, 3).map(([p, f]) => compactRow(p, f)).join('') || '<div class="covNote">No Gold Fit is issued until verified profile and program evidence support it.</div>'}
          <div class="tierHead" style="margin-top:14px"><span class="tierChip silver">Silver Fit</span><span class="tierCount">${silver.length}</span></div>
          ${silver.slice(0, state.member ? 4 : 2).map(([p, f]) => compactRow(p, f)).join('')}
          ${!state.member && silver.length > 2 ? `<button class="pRow" style="justify-content:center;color:var(--gd);font-family:var(--num);font-weight:700;font-size:14px;letter-spacing:.1em;text-transform:uppercase" onclick="unlockSheet('See all ${silver.length} Silver Fit programs','Your full Silver list, with the evidence behind every tier.')">${ICONS.lock} See all ${silver.length} Silver Fit programs</button>` : ''}
          <div class="covNote">Fit tiers are withheld until canonical profile facts and current, source-located program requirements are both available.</div>
          <div class="drbRead">
            <div class="drbHead"><span class="seal">✦</span> Dr Brian’s <em>read</em></div>
            <div class="drbSub">Notes on programs in your fit set.</div>
            <div class="drbRow"><b>No verified program note yet.</b> Program-specific guidance appears only when it is bound to canonical evidence.</div>
          </div>
        </div>
        <div class="fitLegend">${FIT_LEGEND}</div>
      </section>
      <div>
        <section class="panel" aria-label="My programs" style="margin-bottom:20px">
          <div class="pHead"><h2 class="h2">My <em>programs</em></h2><button class="pMore" onclick="nav('my')">All ▸</button></div>
          <div class="pBody">
            <div class="myChips">${['SAVED', 'APPLIED', 'INTERVIEWING', 'RANKED'].map(s => `<button class="cChip" onclick="nav('my')">${s.toLowerCase()}<b>${[...state.saved.values()].filter(v => v.state === s).length}</b></button>`).join('')}</div>
            ${savedArr.slice(0, 3).map(p => { const f = computeFit(p); return compactRow(p, f); }).join('') || `<p class="sub">Save a program from any File — the ★ — and it lives here.</p>`}
          </div>
        </section>
        <section class="panel" aria-label="Your profile">
          <div class="pHead"><h2 class="h2">Your <em>profile</em></h2><button class="pMore" onclick="nav('profile')">Update ▸</button></div>
          <div class="pBody"><div class="profRow">
            ${ringSVG(prof.completeness)}
            <div class="profMissing">
              ${prof.missing.map(m => `<button class="missChip" onclick="nav('profile')">+ ${esc(m)}</button>`).join('')}
            </div>
          </div></div>
        </section>
      </div>
    </div>
    <div class="doorRow">
      ${door('EVIDENCE', 'SOAP 2026 Openings', 'Programs that had unfilled spots last March. Evidence, not a promise.', `${soapCount} corpus programs · Categorical, Prelim & Primary Care`, false, `Object.assign(state.find,{soap:true,state:'',q:''});nav('find')`)}
      ${door('NETWORK', 'Alumni Connections', 'MissionMed alumni at programs you’re looking at.', 'Integration unavailable', !state.member, `doorAlumni()`)}
      ${door('WRITE', 'Letter of Interest', 'Specific letters built from a program’s real differentiators and your facts.', '', !state.member, `doorLetter()`)}
      ${door('OPENINGS', 'Match Bridge', 'Off-cycle and unexpected openings, with RISE’s file on each program.', '', !state.member, `doorBridge()`)}
    </div>
    <div class="freshStrip"><b>Updated this week:</b> <span>${state.changed.length ? esc(state.changed.slice(-1)[0]) : `${D.meta.programCount} canonical program identities loaded · deep research and SOAP coverage shown only when published by the active registry release`}</span>
      <button class="go" onclick="Object.assign(state.find,{sort:'updated'});nav('find')">What changed ▸</button></div>
  </div>`;
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function ringSVG(pct) {
  const r = 34, c = 2 * Math.PI * r;
  return `<div class="profRing" role="img" aria-label="Profile ${pct}% complete"><svg width="84" height="84"><circle cx="42" cy="42" r="${r}" stroke="var(--edge)" stroke-width="8" fill="none"/><circle cx="42" cy="42" r="${r}" stroke="url(#gradR)" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${c * pct / 100} ${c}"/><defs><linearGradient id="gradR"><stop offset="0" stop-color="var(--em)"/><stop offset="1" stop-color="var(--em2)"/></linearGradient></defs></svg><span class="cv">${pct}%</span></div>`;
}
function door(eyebrow, title, line, num, locked, onclick) {
  return `<a class="door ${locked ? 'locked' : ''}" role="link" tabindex="0" onclick="${onclick}" onkeydown="if(event.key==='Enter'){${onclick}}">
    ${locked ? `<span class="dLock">${ICONS.lock}</span>` : ''}
    <span class="dEyebrow">${eyebrow}</span><span class="dTitle">${title}</span><span class="dLine">${line}</span>
    ${num ? `<span class="dNum">${num}</span>` : '<span class="dNum"></span>'}
  </a>`;
}
window.doorAlumni = () => unlockSheet('Alumni Connections', 'No authorized ACTN/alumni integration is configured for this release. No connections are inferred or displayed.');
window.doorLetter = () => unlockSheet('Letter of Interest', 'No authorized production generation service is configured. Applicant or program facts are never invented.');
window.doorBridge = () => unlockSheet('Match Bridge', 'No canonical production Match Bridge service is configured for this release.');

/* ============ FIND PROGRAMS (doc 07) + MY PROGRAMS + RANK + PROFILE ============ */
'use strict';

function filteredPrograms() {
  const f = state.find;
  let list = D.programs.slice();
  if (f.q) { const hits = new Set(searchPrograms(f.q).map(p => p.id)); list = list.filter(p => hits.has(p.id)); }
  if (f.state) list = list.filter(p => p.state === f.state);
  if (f.soap) list = list.filter(p => p.soap.length && (!f.soapTrack || p.soap.some(s => s.track === f.soapTrack)));
  if (f.abim) list = list.filter(p => p.abim && p.abim.state === 'VERIFIED');
  if (f.depth) list = list.filter(p => p.depth === f.depth);
  if (f.visaPub) list = list.filter(p => p.rich && (p.rich.visa || []).some(v => v.state === 'meets' && /J-1|H-1B/.test(v.c)));
  if (f.imgEv) list = list.filter(p => p.rich && (p.rich.roster || []).some(r => r.cat === 'IMG'));
  if (f.fresh) list = list.filter(p => freshness(p).label === f.fresh);
  const cmp = {
    fit: (a, b) => fitRank(a) - fitRank(b) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    state: (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
    abim: (a, b) => (b.abim.passRate || -1) - (a.abim.passRate || -1),
    updated: (a, b) => new Date(b.verified) - new Date(a.verified),
    soap: (a, b) => soapN(b) - soapN(a),
  }[f.sort] || ((a, b) => a.name.localeCompare(b.name));
  list.sort(cmp);
  return list;
}
function soapN(p) { return p.soap.reduce((s, x) => s + x.positions, 0); }
function fitRank(p) {
  const f = computeFit(p);
  if (f.tier === 'gold') return f.rep ? 1 : 0;
  if (f.tier === 'silver') return f.rep ? 3 : 2;
  if (f.known && f.counts && f.counts.issue) return 9;           // issues last
  if (f.known) return 4;
  return 6;                                                       // unknown between
}
function activePills() {
  const f = state.find, pills = [];
  if (f.q) pills.push({ k: 'q', label: `“${f.q}”` });
  if (f.state) pills.push({ k: 'state', label: stateNames[f.state] || f.state });
  if (f.soap) pills.push({ k: 'soap', label: 'SOAP 2026' + (f.soapTrack ? ' · ' + f.soapTrack : '') });
  if (f.abim) pills.push({ k: 'abim', label: 'ABIM verified' });
  if (f.depth) pills.push({ k: 'depth', label: { gold: 'Gold dossier', enriched: 'Enriched', registry: 'Registry', demo: 'Demo' }[f.depth] });
  if (f.visaPub) pills.push({ k: 'visaPub', label: 'Visa sponsorship published' });
  if (f.imgEv) pills.push({ k: 'imgEv', label: 'IMG evidence on roster' });
  if (f.fresh) pills.push({ k: 'fresh', label: f.fresh });
  return pills;
}
window.dropPill = k => {
  const f = state.find;
  if (k === 'q') f.q = ''; if (k === 'state') f.state = ''; if (k === 'soap') { f.soap = false; f.soapTrack = ''; }
  if (k === 'abim') f.abim = false; if (k === 'depth') f.depth = ''; if (k === 'visaPub') f.visaPub = false;
  if (k === 'imgEv') f.imgEv = false; if (k === 'fresh') f.fresh = '';
  state.find.shown = 50; rerender();
};
window.clearFilters = () => { Object.assign(state.find, { q: '', state: '', soap: false, soapTrack: '', abim: false, depth: '', fresh: '', visaPub: false, imgEv: false, shown: 50 }); rerender(); };

function sigIMG(p, f) {
  if (p.rich && p.rich.roster) { const img = p.rich.roster.filter(r => r.cat === 'IMG').length; return `<span class="sig" title="Named examples on official records; composition % gated by denominator"><b>IMG ✓</b><span style="color:var(--dim)"> on roster</span></span>`; }
  return `<span class="sig dimmed" title="Roster not yet researched or privacy-held">roster —</span>`;
}
function sigVisa(p) {
  if (p.rich && p.rich.visa) { const listed = p.rich.visa.filter(v => /J-1|H-1B/.test(v.c) && v.state !== 'na').map(v => v.c); return `<span class="sig" title="Listed statuses — sponsorship detail in the File"><b>${listed.slice(0, 2).join(' · ')}</b><span style="color:var(--dim)"> listed</span></span>`; }
  return `<span class="sig dimmed">○ visa not published</span>`;
}
function sigSOAP(p) {
  if (!p.soap.length) return '';
  const n = soapN(p);
  return `<span class="sig" title="SOAP ${p.soap[0].year}: ${p.soap.map(s => s.track + ' ' + s.positions).join(', ')}"><b style="color:var(--gn)">SOAP ✓</b><span style="color:var(--dim)"> ${n}</span></span>`;
}

function programRow(p, origin) {
  const f = computeFit(p);
  const showFit = state.find.mode !== 'criteria' || origin !== 'find';
  return `<div class="pRow" role="button" tabindex="0" style="--tierHue:${tierHue(f.tier)}" data-open="${p.id}" data-origin="${origin}">
    <button class="starBtn ${state.saved.has(p.id) ? 'on' : ''}" aria-pressed="${state.saved.has(p.id)}" aria-label="Save ${esc(p.name)}" onclick="toggleSave('${p.id}',event)">★</button>
    <span class="specTag">${p.spec}</span>
    <span class="rMain">
      <span class="rTitleLine"><span class="rName">${esc(p.name)}</span>${p.demo ? '<span class="demoTag">Demo</span>' : ''}${p.depth === 'gold' ? '<span class="demoTag" style="color:var(--gd);border-color:rgba(255,215,106,.5)">Gold dossier</span>' : ''}</span>
      <span class="rSub">${esc(p.inst)} · ${esc(p.city)}, ${p.state}${p.type ? ' · ' + esc(p.type) : ''}</span>
      ${showFit ? `<span class="rFit">${tierChip(p, f)}<span>${esc(f.line)}</span></span>` : ''}
    </span>
    <span class="rMeta">
      ${sigIMG(p, f)}${sigVisa(p)}${sigSOAP(p)}
      ${freshPill(p)}
      <button class="rowBtn" onclick="event.stopPropagation();toggleCompare('${p.id}')">${state.compare.includes(p.id) ? '✓ Comparing' : '⊞ Compare'}</button>
      <button class="rowBtn pri" onclick="event.stopPropagation();openProgram('${p.id}','overview','${origin}')">Open File</button>
    </span>
  </div>`;
}
function programCard(p, origin) {
  const f = computeFit(p);
  return `<div class="pCard" role="button" tabindex="0" style="--tierHue:${tierHue(f.tier) === 'transparent' ? 'var(--edge2)' : tierHue(f.tier)}" data-open="${p.id}" data-origin="${origin}">
    <span class="cTop"><span class="specTag">${p.spec}</span>${tierChip(p, f)}${p.demo ? '<span class="demoTag">Demo</span>' : ''}
      <button class="starBtn ${state.saved.has(p.id) ? 'on' : ''}" aria-pressed="${state.saved.has(p.id)}" aria-label="Save ${esc(p.name)}" onclick="toggleSave('${p.id}',event)">★</button></span>
    <span class="cName">${esc(p.name)}</span>
    <span class="cSub">${esc(p.inst)}<br>${esc(p.city)}, ${p.state}</span>
    <span class="cFoot">${sigIMG(p, f)}${sigVisa(p)}${sigSOAP(p)}${freshPill(p)}</span>
  </div>`;
}

function viewFind() {
  const f = state.find;
  const list = filteredPrograms();
  const pills = activePills();
  const shown = list.slice(0, f.shown);
  const soapSeg = f.soap ? `<div class="modeSeg" role="radiogroup" aria-label="SOAP track" style="margin:0 0 10px">
      ${['', 'Categorical', 'Preliminary', 'Primary Care'].map(t => `<button class="${f.soapTrack === t ? 'on' : ''}" onclick="state.find.soapTrack='${t}';rerender()">${t || 'All tracks'}</button>`).join('')}
    </div><div class="covBanner">SOAP is historical accessibility evidence — programs that had unfilled positions in a past cycle. It is not a friendliness rating, and never a promise.</div>` : '';
  return `<div class="view" data-view="find">
    <p class="eyebrow">Find Programs</p>
    <h1 class="h1"><em>${list.length}</em> ${f.soap ? 'SOAP 2026 ' : ''}Internal Medicine programs</h1>
    <div class="modeSeg" role="radiogroup" aria-label="Search mode">
      ${[['criteria', 'Set criteria'], ['profile', 'Use my profile'], ['cv', 'Use my CV']].map(([k, l]) => `<button role="radio" aria-checked="${f.mode === k}" class="${f.mode === k ? 'on' : ''}" onclick="setMode('${k}')">${l}</button>`).join('')}
    </div>
    ${f.mode === 'profile' ? `<div class="pillRow">${D.profile.facts.filter(x => ['Graduate type', 'Visa need', 'USMLE Step 2 CK', 'Year of graduation', 'USCE'].includes(x[0])).map(x => `<span class="pill profilePill">${esc(x[0])}: ${esc(x[1])}<button class="x" title="What-if: relax this for the session (does not change Matrix)" onclick="toast('What-if: fit shown as if “${esc(x[0])}” didn’t apply. Your Matrix profile is unchanged. (Production wiring: display only)')">✕</button></span>`).join('')}<span class="pill" style="border-style:dashed;background:none">from your Matrix profile</span></div>` : ''}
    ${soapSeg}
    <div class="filterRow">
      <select class="fSel" aria-label="Specialty" onchange="toast('Production wiring corpus is Internal Medicine; FM and the other 29 specialty tabs join at ingest.')"><option>Internal Medicine</option><option>Family Medicine (corpus pending)</option></select>
      <select class="fSel" aria-label="State" onchange="state.find.state=this.value;state.find.shown=50;rerender()">
        <option value="">All states</option>${STATES.map(s => `<option value="${s}" ${f.state === s ? 'selected' : ''}>${stateNames[s] || s}</option>`).join('')}</select>
      <button class="fBtn ${f.imgEv ? 'on' : ''}" onclick="state.find.imgEv=!state.find.imgEv;rerender()" title="From current rosters where identified. Observation, not policy.">IMG evidence</button>
      <button class="fBtn ${f.visaPub ? 'on' : ''}" onclick="state.find.visaPub=!state.find.visaPub;rerender()">Visa published</button>
      <button class="fBtn" onclick="openFilterDrawer()">More filters ${pills.length > (f.q ? 1 : 0) + (f.state ? 1 : 0) ? `<span class="badge">${pills.length}</span>` : ''}</button>
      ${pills.length ? `<button class="clearF" onclick="clearFilters()">Clear filters</button>` : ''}
    </div>
    ${pills.length ? `<div class="pillRow">${pills.map(p => `<span class="pill">${esc(p.label)}<button class="x" aria-label="Remove filter ${esc(p.label)}" onclick="dropPill('${p.k}')">✕</button></span>`).join('')}</div>` : ''}
    <div class="listBar">
      <select class="fSel" aria-label="Sort" onchange="state.find.sort=this.value;rerender()">
        ${[['fit', 'Sort: Best fit for me'], ['name', 'Sort: Program name A–Z'], ['state', 'Sort: State'], ['abim', 'Sort: ABIM pass rate (verified)'], ['updated', 'Sort: Recently updated'], ['soap', 'Sort: SOAP openings']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="countNote">Showing ${shown.length} of ${list.length}</span>
      <div class="viewToggle" role="radiogroup" aria-label="View">
        <button class="${f.view === 'list' ? 'on' : ''}" onclick="state.find.view='list';rerender()">☰ List</button>
        <button class="${f.view === 'grid' ? 'on' : ''}" onclick="state.find.view='grid';rerender()">▦ Grid</button>
      </div>
    </div>
    <div class="covBanner">Canonical identities are live in this release. Deep research remains unknown until current evidence is published by the active registry.</div>
    <div id="results">${shown.length
      ? (f.view === 'list' ? shown.map(p => programRow(p, 'find')).join('') : `<div class="cardGrid">${shown.map(p => programCard(p, 'find')).join('')}</div>`)
      : `<div class="emptyLib"><div class="big">No programs match.</div>Clear a filter, or try the program’s hospital name.<div style="margin-top:14px"><button class="rowBtn pri" onclick="clearFilters()">Clear filters</button></div></div>`}
    </div>
    ${list.length > f.shown ? `<button class="loadMore" onclick="state.find.shown+=50;rerender()">Load 50 more</button>` : ''}
  </div>`;
}
window.setMode = k => {
  state.find.mode = k;
  if (k === 'cv') { cvSheet(); state.find.mode = 'profile'; return; }
  rerender();
};
function bindFind() {
  $$('#results [data-open]').forEach(el => {
    el.addEventListener('click', e => { if (e.target.closest('button')) return; openProgram(el.dataset.open, 'overview', el.dataset.origin); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.target.closest('button')) openProgram(el.dataset.open, 'overview', el.dataset.origin); });
  });
}

/* ---------- CV mode (doc 10 §10.5) ---------- */
function cvSheet() {
  openModal(`<div class="mKicker">Use my CV</div><div class="mTitle">File Vault connection unavailable</div><div class="mSum">No production-safe CV selection or upload contract is authorized for this RISE release. The approved seam remains visible and locked; no file is uploaded or interpreted.</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
}
window.cvSheet = cvSheet;

/* ---------- MY PROGRAMS ---------- */
/* ---------- MY PROGRAMS ---------- */
const MY_STATES = ['SAVED', 'APPLIED', 'INTERVIEWING', 'RANKED'];
window.cycleMyState = async (id, ev) => {
  ev.stopPropagation();
  const rec = state.saved.get(id); if (!rec) return;
  const previous = rec.state;
  rec.state = MY_STATES[(MY_STATES.indexOf(rec.state) + 1) % MY_STATES.length];
  rerender();
  try { await persistProgramState(id); } catch { rec.state = previous; rerender(); toast('Could not sync the program state.'); }
};
window.updateProgramNotes = async (id, value) => {
  const rec = state.saved.get(id); if (!rec) return;
  const previous = rec.notes; rec.notes = value;
  try { await persistProgramState(id); } catch { rec.notes = previous; toast('Could not sync these notes.'); }
};
function viewMy() {
  const items = [...state.saved.entries()].map(([id, rec]) => ({ p: byId.get(id), rec })).filter(x => x.p);
  return `<div class="view" data-view="my">
    <p class="eyebrow">My Programs</p>
    <h1 class="h1"><em>${items.length}</em> program${items.length === 1 ? '' : 's'} you’re tracking</h1>
    <p class="sub" style="margin:6px 0 18px">Click the state chip to advance it: saved → applied → interviewing → ranked. Notes are stored by the configured RISE persistence adapter.</p>
    ${state.compare.length >= 2 ? `<button class="rowBtn pri" style="margin-bottom:14px" onclick="openCompare()">Open Compare (${state.compare.length})</button>` : `<p class="sub" style="margin-bottom:14px">Add programs to Compare from any row — up to four.</p>`}
    ${items.length ? items.map(({ p, rec }) => {
      const f = computeFit(p);
      return `<div class="pRow" style="--tierHue:${tierHue(f.tier)};flex-wrap:wrap" data-open="${p.id}" data-origin="my" role="button" tabindex="0">
        <button class="starBtn on" aria-label="Remove ${esc(p.name)}" onclick="toggleSave('${p.id}',event)">★</button>
        <span class="specTag">${p.spec}</span>
        <span class="rMain"><span class="rTitleLine"><span class="rName">${esc(p.name)}</span>${p.demo ? '<span class="demoTag">Demo</span>' : ''}</span>
          <span class="rSub">${esc(p.city)}, ${p.state} · ${esc(f.line)}</span></span>
        <span class="rMeta">
          ${tierChip(p, f)}
          <button class="rowBtn" onclick="cycleMyState('${p.id}',event)" title="Click to advance">${rec.state.toLowerCase()}</button>
          <button class="rowBtn" onclick="event.stopPropagation();toggleCompare('${p.id}')">${state.compare.includes(p.id) ? '✓ Comparing' : '⊞ Compare'}</button>
          <button class="rowBtn pri" onclick="event.stopPropagation();openProgram('${p.id}','overview','my')">Open File</button>
        </span>
        <textarea placeholder="Notes — interview dates, contacts, gut feel…" style="width:100%;margin-top:8px;background:rgba(13,19,32,.6);border:1px solid var(--edge);border-radius:10px;color:var(--tx);font-family:var(--disp);font-size:15px;padding:10px 12px;min-height:44px;resize:vertical" onclick="event.stopPropagation()" onchange="updateProgramNotes('${p.id}',this.value)">${esc(rec.notes)}</textarea>
      </div>`;
    }).join('') : `<div class="emptyLib"><div class="big">Nothing saved yet.</div>Save a program from any File — the ★ — and it lives here.<div style="margin-top:14px"><button class="rowBtn pri" onclick="nav('find')">Find Programs</button></div></div>`}
  </div>`;
}

/* ---------- COMPARE ---------- */
window.openCompare = () => {
  const ps = state.compare.map(id => byId.get(id)).filter(Boolean);
  if (ps.length < 2) { toast(ps.length ? 'One selected — add at least one more program' : 'Nothing to compare yet'); return; }
  const anyUnknown = row => row.some(v => /Not published|unknown|pending/i.test(v));
  const rows = [
    ['Fit', ps.map(p => { const f = computeFit(p); return (f.tier ? (f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit') + (f.rep ? ' (rep.)' : '') + ' · ' : '') + f.line; })],
    ['Published requirements', ps.map(p => p.rich && p.rich.requirements ? `${p.rich.requirements.filter(r => /REQUIREMENT/.test(r.pub)).length} published · ${p.rich.requirements.filter(r => r.state === 'unknown').length} not published` : 'Not yet verified by RISE')],
    ['Visa', ps.map(p => p.rich && p.rich.visa ? p.rich.visa.filter(v => /J-1|H-1B/.test(v.c)).map(v => `${v.c}: ${v.state === 'meets' ? 'published' : 'listed, sponsorship not published'}`).join(' · ') : 'Not published')],
    ['IMG / DO evidence', ps.map(p => p.rich && p.rich.roster ? 'IMG, US-DO and Caribbean examples on official records; % gated by denominator' : 'Roster not yet researched')],
    ['SOAP history', ps.map(p => p.soap.length ? p.soap.map(s => `${s.year} ${s.track}: ${s.positions}`).join(' · ') : '— none recorded')],
    ['In-house fellowships', ps.map(p => p.rich && p.rich.fellowships ? `${p.rich.fellowships.direct.length} direct in-house` : 'Not yet verified')],
    ['ABIM pass rate', ps.map(p => p.abim && p.abim.passRate ? `${p.abim.passRate}% (${p.abim.examinees} examinees)` : p.abim && p.abim.claim ? `${p.abim.claim} — program claim` : 'Not reported / not verified')],
    ['PGY-1 salary', ps.map(p => p.rich && p.rich.salary && p.rich.salary.rows[0][1] !== '$—' ? `${p.rich.salary.rows[0][1]} (${p.rich.salary.currentness.split('—')[0].trim()})` : 'Not published')],
    ['Freshness', ps.map(p => freshness(p).label)],
  ];
  openModal(`
    <div class="mKicker">Compare · ${ps.length} of 4</div>
    <div class="mTitle">Side by side</div>
    <div class="tblWrap" style="max-height:60vh;overflow:auto"><table class="tbl cmpTable">
      <tr><th>Signal</th>${ps.map(p => `<th>${esc(p.name)}${p.demo ? ' <span class="demoTag">Demo</span>' : ''}</th>`).join('')}</tr>
      ${rows.map(([label, vals]) => `<tr><td><b>${label}</b></td>${vals.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
    </table></div>
    <div class="mFoot">No “leads” crown is shown when any compared program has Not-published rows (4004 law). ${FIT_LEGEND}</div>
    <div class="mActs"><button class="mBtn sec" onclick="state.compare=[];closeModal();renderShell();toast('Compare cleared')">Clear compare</button>
    <button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
};

/* ---------- RANK LIST ---------- */
function viewRank() {
  const items = [...state.saved.entries()].map(([id, rec]) => ({ p: byId.get(id), rec })).filter(x => x.p);
  return `<div class="view" data-view="rank">
    <p class="eyebrow">Rank List <span style="color:var(--vi)">· powered by RankList IQ</span></p>
    <h1 class="h1">Rank <em>List</em></h1>
    <p class="sub" style="max-width:680px;margin:8px 0 20px">When RankList IQ ships, it opens here with your My Programs set preloaded — your fit states, tiers and evidence go in; a priority order comes back as its own column, never folded into the tiers. RISE does not rebuild RankList IQ.</p>
    <div class="covBanner">Feature-flagged shell. Nothing is promised until RankList IQ is real — this page exists so you can see where it lands.</div>
    ${items.length ? `<div class="tblWrap"><table class="tbl"><caption>Your programs, as RankList IQ will receive them</caption>
      <tr><th>#</th><th>Program</th><th>Fit</th><th>State</th><th>RankList IQ priority</th></tr>
      ${items.map(({ p, rec }, i) => { const f = computeFit(p); return `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b><br><span style="color:var(--dim);font-size:14px">${esc(p.city)}, ${p.state}</span></td><td>${f.tier ? (f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit') : '—'} · ${esc(f.line)}</td><td>${rec.state.toLowerCase()}</td><td style="color:var(--dim)">arrives with RankList IQ</td></tr>`; }).join('')}
    </table></div>` : `<div class="emptyLib"><div class="big">No programs to rank yet.</div>Save programs first — the ★ on any row.</div>`}
  </div>`;
}

/* ---------- MY PROFILE ---------- */
function viewProfile() {
  const prof = D.profile;
  return `<div class="view" data-view="profile">
    <p class="eyebrow">My Profile · shared with Matrix</p>
    <h1 class="h1">Your <em>profile</em></h1>
    <p class="sub" style="max-width:680px;margin:8px 0 18px">RISE will render and update the canonical Matrix profile only after an authorized profile adapter is configured. This release creates no duplicate profile truth.</p>
    <div class="covBanner">Matrix profile integration is unavailable and fails closed. No representative applicant facts are shown.</div>
    <div class="homeGrid">
      <section class="panel"><div class="pHead"><h2 class="h2">Applicant <em>facts</em></h2></div>
        <div class="pBody">${prof.facts.map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}
        <p class="sub" style="margin-top:12px;font-size:14px">Each fact powers requirement checks across the corpus — e.g. “USMLE Step 2 CK” is used by every published score preference.</p></div>
      </section>
      <div>
        <section class="panel" style="margin-bottom:20px"><div class="pHead"><h2 class="h2">Completeness</h2></div>
          <div class="pBody"><div class="profRow">${ringSVG(prof.completeness)}<div class="profMissing">${prof.missing.map(m => `<button class="missChip" onclick="toast('Matrix profile editing is unavailable in this release.')">+ ${esc(m)}</button>`).join('')}</div></div></div>
        </section>
        <section class="panel"><div class="pHead"><h2 class="h2">Use it</h2></div>
          <div class="pBody" style="display:flex;flex-direction:column;gap:10px">
            <button class="fAct pri" onclick="Object.assign(state.find,{mode:'profile',sort:'fit'});nav('find')">Use my profile to find programs</button>
            <button class="fAct" onclick="cvSheet()">Use my CV instead</button>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}


/* ---------- More filters drawer ---------- */
window.openFilterDrawer = () => {
  const f = state.find;
  const dw = $('#filterDrawer');
  dw.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="More filters">
    <button class="drawerClose" aria-label="Close" onclick="$('#filterDrawer').classList.remove('open')">✕</button>
    <h3>More filters</h3>
    <p class="sub" style="font-size:14px">Every filter states its evidence caveat. Nothing here guesses.</p>
    <div class="fGroup"><div class="fLbl">SOAP</div>
      <button class="tgl ${f.soap ? 'on' : ''}" onclick="state.find.soap=!state.find.soap;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>SOAP 2026 openings<span class="cav">Historical accessibility evidence, not a friendliness rating.</span></span></button>
    </div>
    <div class="fGroup"><div class="fLbl">Evidence depth</div>
      ${[['', 'Any depth'], ['gold', 'Gold dossier'], ['enriched', 'Enriched (Tier A)'], ['registry', 'Registry']].map(([k, l]) => `
        <button class="tgl ${f.depth === k ? 'on' : ''}" onclick="state.find.depth='${k}';openFilterDrawer();rerenderKeepDrawer()"><span class="box">${f.depth === k ? '●' : ''}</span><span>${l}</span></button>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Board performance</div>
      <button class="tgl ${f.abim ? 'on' : ''}" onclick="state.find.abim=!state.find.abim;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>ABIM rate verified<span class="cav">Never borrowed from another program; title-ambiguous rows excluded.</span></span></button>
    </div>
    <div class="fGroup"><div class="fLbl">Graduate-type evidence</div>
      <button class="tgl ${f.imgEv ? 'on' : ''}" onclick="state.find.imgEv=!state.find.imgEv;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>IMG evidence on roster<span class="cav">From current rosters where identified. Observation, not policy.</span></span></button>
      <button class="tgl" onclick="toast('DO / Caribbean roster filters activate as rosters are researched (privacy decision pending).')"><span class="box"></span><span>DO / Caribbean evidence<span class="cav">Activates when rosters land — privacy review pending.</span></span></button>
    </div>
    <div class="fGroup"><div class="fLbl">Visa</div>
      <button class="tgl ${f.visaPub ? 'on' : ''}" onclick="state.find.visaPub=!state.find.visaPub;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>Sponsorship published<span class="cav">Published sponsorship only — a listed status is not sponsorship.</span></span></button>
    </div>
    <div class="fGroup"><div class="fLbl">Freshness</div>
      ${[['', 'Any'], ['Verified recently', 'Verified recently'], ['Current cycle', 'Current cycle'], ['Needs refresh', 'Needs refresh']].map(([k, l]) => `
        <button class="tgl ${f.fresh === k ? 'on' : ''}" onclick="state.find.fresh='${k}';openFilterDrawer();rerenderKeepDrawer()"><span class="box">${f.fresh === k ? '●' : ''}</span><span>${l}</span></button>`).join('')}
    </div>
    <button class="fAct pri" style="margin-top:8px" onclick="$('#filterDrawer').classList.remove('open')">Show results</button>
  </div>`;
  dw.classList.add('open');
};
window.rerenderKeepDrawer = () => { state.find.shown = 50; renderMain('find'); };


/* ============ PROGRAM FILE (docs 08 + 09) ============ */
'use strict';

let fileReturnFocus = null;
function openProgram(id, tab, origin) {
  state.fileFrom = origin || 'find';
  state.lastOpenedId = id;
  fileReturnFocus = document.activeElement;
  nav(`program/${id}/${tab || 'overview'}`);
}
window.openProgram = openProgram;

function openFileFor(route) {
  const [, id, tab] = route.split('/');
  const p = byId.get(id);
  if (!p) { nav('find'); return; }
  state.fileTab = tab || 'overview';
  const file = $('#file');
  file.innerHTML = renderFile(p);
  file.classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#main').setAttribute('inert', '');
  renderShell();
  const t = $('#fileTitle'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
}
function closeFile(navigate = true) {
  const file = $('#file');
  file.classList.remove('open'); file.innerHTML = '';
  document.body.style.overflow = '';
  $('#main').removeAttribute('inert');
  if (navigate) nav(state.underlying || 'find');
}
window.closeFile = closeFile;
window.setFileTab = (id, tab) => { history.replaceState(null, '', `#/program/${id}/${tab}`); state.fileTab = tab; const p = byId.get(id); $('#fileBody').innerHTML = fileTabBody(p, tab); $$('.tabStrip button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); }); };

const TABS = [['overview', 'Overview'], ['fit', 'Fit'], ['residents', 'Residents'], ['people', 'People'], ['next', 'Fellowships & Outcomes'], ['details', 'Details']];
const lockedTab = t => !state.member && ['residents', 'people', 'next'].includes(t);

function backLabel() { return state.fileFrom === 'my' ? '‹ Back to My Programs' : state.fileFrom === 'home' ? '‹ Home' : '‹ Back to results'; }

function renderFile(p) {
  const f = computeFit(p);
  const initials = p.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const saved = state.saved.has(p.id);
  const soap = p.soap.length ? `SOAP 2026: <b style="color:var(--gn)">✓ ${soapN(p)} position${soapN(p) > 1 ? 's' : ''}</b> <span style="color:var(--dim)">(${p.soap.map(s => s.track).join(', ')})</span>` : `SOAP 2026: <b>—</b>`;
  const imgSig = p.demo ? 'IMG/DO evidence: <b>strong (demo)</b>' : (p.rich && p.rich.roster ? 'IMG/DO evidence: <b>present on official records</b>' : 'IMG/DO evidence: <b>not yet researched</b>');
  const visaSig = p.demo ? 'Visa: <b>J-1 · H-1B published</b>' : (p.rich && p.rich.visa ? 'Visa: <b>J-1 · H-1B listed</b> <span style="color:var(--dim)">(sponsorship not published)</span>' : 'Visa: <b>○ not published</b>');
  return `<div class="fileSheet" role="dialog" aria-modal="true" aria-labelledby="fileTitle">
    <div class="fileTopBar">
      <button class="backBtn" onclick="closeFile()">${backLabel()}</button>
      <div class="fileTopRight">
        ${freshPill(p)}
        <button class="srcBtn" onclick="openSources('${p.id}')">ⓘ Sources & freshness</button>
        <button class="fileClose" aria-label="Close file" onclick="closeFile()">✕</button>
      </div>
    </div>
    <div class="fileHead">
      <div class="fTile" aria-hidden="true">${initials}</div>
      <div class="fIdent">
        <div class="fEyebrow">${esc(p.specName)} · ${esc(p.track)} ${p.demo ? '<span class="demoTag">Representative demo data</span>' : ''}${p.depth === 'gold' ? '<span class="demoTag" style="color:var(--gd);border-color:rgba(255,215,106,.5)">Gold dossier · 267 refs</span>' : ''}</div>
        <h1 class="fName" id="fileTitle">${esc(p.name)}</h1>
        <div class="fSub">${esc(p.inst)} · ${esc(p.city)}, ${p.state}${p.type ? ' · ' + esc(p.type) : ''}${p.positions ? ' · ' + esc(p.positions) : ''}</div>
        <div class="forYou">
          <div class="fyLbl">For you</div>
          ${f.known || f.tier ? `<div class="fyLine">${tierChip(p, f)}<span>${esc(f.line)}</span></div>
          ${f.reasons.length ? `<div class="fyWhy">${esc(f.reasons.slice(0, 2).join(' · '))}</div>` : ''}` :
      `<div class="fyLine"><span>${esc(f.line)}</span></div><div class="fyWhy">Requirements land in the Fit tab as research is verified.</div>`}
        </div>
        <div class="sigLine"><span>${imgSig}</span><span>${visaSig}</span><span>${soap}</span></div>
      </div>
      <div class="fActs">
        <button class="fAct pri" onclick="toggleSave('${p.id}',event);this.blur()">${saved ? '★ Saved' : '★ Save'}</button>
        <button class="fAct ${state.compare.includes(p.id) ? 'on' : ''}" onclick="toggleCompare('${p.id}')">${state.compare.includes(p.id) ? '✓ In Compare' : '⊞ Add to Compare'}</button>
        <button class="fAct" onclick="askMenu('${p.id}')">Ask about this ▾</button>
      </div>
    </div>
    <div class="tabStrip" role="tablist" aria-label="Program file sections">
      ${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${state.fileTab === k}" class="${state.fileTab === k ? 'on' : ''}" onclick="setFileTab('${p.id}','${k}')">${l}${lockedTab(k) ? `<span class="lockIco">${ICONS.lock}</span>` : ''}</button>`).join('')}
    </div>
    <div class="fileBody" id="fileBody">${fileTabBody(p, state.fileTab)}</div>
  </div>`;
}
window.askMenu = id => {
  const p = byId.get(id);
  openModal(`<div class="mKicker">Ask about ${esc(p.name.split(' ').slice(0, 3).join(' '))}</div>
    <div class="mTitle">Take this file somewhere useful</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="fAct" onclick="closeModal();toast('CAM handoff: identity, interview intel, Why This Program + verified dates. (Production wiring seam)')">◇ Use for Interview Prep (CAM)</button>
      <button class="fAct" onclick="closeModal();${state.member ? `toast('Letter of Interest workspace opens with this program\\'s verified differentiators. (Phase-5 seam)')` : `unlockSheet('Letter of Interest','Letters built from this program\\'s verified differentiators and your verified facts.')`}">✎ Add to Letter of Interest</button>
      <button class="fAct" onclick="closeModal();toast('Message routed to Dr Brian with this program attached. (Production wiring)')">✦ Ask Dr Brian</button>
    </div>
    <div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
};

/* ---------- tab bodies ---------- */
function unknownFooter(p, extra) {
  const map = { NOT_PUBLICLY_FOUND: 'Not published by the program', INTERNAL_CONTEXT_NOT_REVERIFIED: 'Not yet verified by RISE', NOT_PUBLICLY_FOUND_OR_NOT_EXHAUSTIVELY_VERIFIED: 'Not yet verified by RISE', ROSTER_COLLECTION_NOT_EXECUTED_PRIVACY_DECISION_NOT_MATERIALIZED: 'Held for privacy review', VERIFIED_PARTIAL_CURRENT_OFFICIAL: 'Partially verified', PARTIAL: 'Partially verified', DEMO: 'Representative demo' };
  const fams = Object.entries(p.domains || {}).filter(([k, v]) => !/^VERIFIED$/.test(v)).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} — ${map[v] || v.toLowerCase().replace(/_/g, ' ')}`);
  const chips = (extra || []).concat(fams);
  if (!chips.length) return '';
  return `<div class="unkFooter"><div class="lbl">Not yet in the file</div><div class="unkChips">${chips.slice(0, 10).map(c => `<span class="unkChip">${esc(c)}</span>`).join('')}</div>
  ${state.role === 'admin' ? `<button class="rowBtn" style="margin-top:10px;color:var(--admin);border-color:rgba(127,163,255,.4)" onclick="closeFile();nav('admin/research');toast('Campaign scope pre-filled from this file’s gaps.')">⚗ Research this</button>` : ''}</div>`;
}
const srcBtnInline = (p, i) => `<button class="srcI" title="Open source" onclick="openSources('${p.id}',${i == null ? -1 : i})">ⓘ</button>`;

function lockBlock(what, summary, skel) {
  return `<div class="lockBlock"><div class="lkHead">${ICONS.lock} ${esc(what)}</div>
    <div class="lkSum">${summary}</div>
    <button class="lkBtn" onclick="unlockSheet('${esc(what).replace(/'/g, "\\'")}','${summary.replace(/'/g, "\\'").replace(/<[^>]+>/g, '')}')">Unlock with membership</button>
    ${skel ? `<div class="skelRows" aria-hidden="true"><span class="skel"></span><span class="skel w3"></span><span class="skel w2"></span></div>` : ''}
  </div>`;
}

function fileTabBody(p, tab) {
  const R = p.rich;
  if (tab === 'overview') return tabOverview(p, R);
  if (tab === 'fit') return tabFit(p, R);
  if (tab === 'residents') return tabResidents(p, R);
  if (tab === 'people') return tabPeople(p, R);
  if (tab === 'next') return tabNext(p, R);
  if (tab === 'details') return tabDetails(p, R);
  return '';
}

function tabOverview(p, R) {
  if (!R) {
    return `<div class="fileGrid"><div>
      <h2 class="h2" style="margin-bottom:8px">Why this <em>program</em></h2>
      <p class="sub">Evidence-backed differentiators appear here after deep research. This release has the canonical identity; narrative layers remain pending until source-located evidence is published.</p>
      ${p.soap.length ? `<div class="lawBanner">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} unfilled position${s.positions > 1 ? 's' : ''}`).join(' · ')}. Historical accessibility evidence, not a friendliness rating.</div>` : ''}
      ${unknownFooter(p, ['Why This Program — deep research pending', 'Mission & curriculum — deep research pending'])}
    </div><div>${snapshotRail(p)}</div></div>`;
  }
  return `<div class="fileGrid"><div>
    <h2 class="h2" style="margin-bottom:4px">Why this <em>program</em></h2>
    ${R.why.slice(0, state.member ? 99 : 3).map((w, i) => `<div class="whyItem">
      <div class="whyFact">${esc(w.fact)}</div>
      <div class="whyWhy">Why it may matter: ${esc(w.why)}</div>
      <div class="whyMeta"><span>${esc(w.group)}</span><span>Verified ${esc(p.verified)}</span>${srcBtnInline(p, w.src)}${p.demo ? '<span class="demoTag">Demo</span>' : ''}</div>
    </div>`).join('')}
    ${!state.member && R.why.length > 3 ? lockBlock(`${R.why.length - 3} more Why This Program item${R.why.length - 3 > 1 ? 's' : ''}`, 'The full evidence-backed differentiator list for this program.', true) : ''}
    <h2 class="h2" style="margin:26px 0 6px">Mission & differentiators</h2>
    <p style="font-family:var(--voice);font-style:italic;font-size:17px;color:var(--mid);line-height:1.6">“${esc(R.mission)}” ${srcBtnInline(p, 0)}</p>
    ${R.values ? `<ul class="bullets" style="margin-top:10px">${R.values.map(v => `<li>${esc(v)}</li>`).join('')}</ul>` : ''}
    <h2 class="h2" style="margin:26px 0 6px">Curriculum snapshot</h2>
    <ul class="bullets">${R.curriculum.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    <h2 class="h2" style="margin:26px 0 6px">Community & patient population</h2>
    <p class="sub" style="font-size:16px">${esc(R.population)}</p>
    <h2 class="h2" style="margin:26px 0 6px">Facilities & training sites</h2>
    <p class="sub" style="font-size:16px">${esc(R.facilities)}</p>
    <h2 class="h2" style="margin:26px 0 6px">Research strengths</h2>
    <p class="sub" style="font-size:16px">${esc(R.research)}</p>
    ${unknownFooter(p, R.real ? ['Current-cycle interview format', 'Procedure curriculum'] : ['Everything here is representative demo data'])}
  </div>
  <div>
    ${snapshotRail(p)}
    ${R.mmNotes ? `<div class="noteBox"><div class="lbl">MissionMed notes</div><div class="txt">${esc(R.mmNotes)}</div></div>` : ''}
    <div class="railCard" style="margin-top:16px"><div class="rLbl">Freshness by family</div>
      ${Object.entries(p.domains).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v" style="font-size:14px">${famFresh(v)}</span></div>`).join('')}
    </div>
  </div></div>`;
}
function famFresh(v) {
  if (/^VERIFIED$/.test(v)) return `<span class="freshPill fp-ok"><i></i>Verified recently</span>`;
  if (/PRIOR_CYCLE/.test(v)) return `<span class="freshPill fp-old"><i></i>Prior cycle</span>`;
  if (/PARTIAL/.test(v)) return `<span class="freshPill fp-cycle"><i></i>Partially verified</span>`;
  if (/DEMO/.test(v)) return `<span class="demoTag">Demo</span>`;
  if (/PRIVACY/.test(v)) return `<span style="color:var(--vi);font-size:13.5px">Privacy hold</span>`;
  return `<span style="color:var(--dim);font-size:13.5px">Not yet researched</span>`;
}
function snapshotRail(p) {
  return `<div class="railCard"><div class="rLbl">Snapshot</div>
    ${[['Type', p.type || 'Not published'], ['Positions', p.positions || 'Not published'], ['ACGME ID', p.acgme || 'Not published'], ['Legacy RISE ID', p.legacyId || '—'], ['Official site', p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">program website ↗</a>` : 'Not recovered'], ['ABIM', p.abim.passRate ? `${p.abim.passRate}% pass · ${p.abim.examinees} examinees` : p.abim.claim ? `${p.abim.claim} (program claim)` : p.abim.state === 'VERIFIED_ABSENT' ? 'Not reported by ABIM' : 'Not verified']].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
  </div>
  ${p.rich && p.rich.people ? `<div class="railCard"><div class="rLbl">People</div>
    ${p.rich.people.slice(0, 3).map(x => `<div class="kv"><span class="k">${esc(x.role.split('·')[0].replace('Program Director', 'PD').replace('Associate PD', 'APD'))}</span><span class="v">${esc(x.n)}</span></div>`).join('')}
    <button class="rowBtn" style="margin-top:10px" onclick="setFileTab('${p.id}','people')">All people →</button></div>` : ''}`;
}

function tabFit(p, R) {
  if (!R) {
    return `<div>
      <div class="lawBanner"><b>Not published means the program hasn’t said.</b> RISE does not guess. Absence of a restriction is not acceptance.</div>
      <div class="sumStrip">
        <div class="sumStat"><span class="n">○</span><span class="l">Requirements</span></div>
        <div class="sumStat"><span class="n" style="font-size:17px;font-weight:600;color:var(--mid)">${p.domains.requirements === 'NOT_PUBLICLY_FOUND' ? 'Not published by the program' : 'Not yet verified by RISE'}</span><span class="l">Current state</span></div>
      </div>
      ${p.soap.length ? `<h2 class="h2" style="margin:20px 0 8px">SOAP history</h2><p class="sub">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} unfilled`).join(' · ')} <i>(NRMP dataset)</i>. Historical evidence, not a promise.</p>` : ''}
      ${unknownFooter(p)}
    </div>`;
  }
  const rows = R.requirements;
  const counts = computeFit(p).counts || { meets: 0, check: 0, unknown: 0 };
  return `<div>
    <div class="sumStrip">
      <div class="sumStat"><span class="n"><em>${counts.meets}</em></span><span class="l">Meets</span></div>
      <div class="sumStat"><span class="n">${counts.check || 0}</span><span class="l">Check</span></div>
      <div class="sumStat"><span class="n">${counts.issue || 0}</span><span class="l">Issues</span></div>
      <div class="sumStat"><span class="n">${counts.unknown || 0}</span><span class="l">Not published</span></div>
      <div class="sumStat"><span class="n">${counts.conflict || 0}</span><span class="l">Conflicting</span></div>
    </div>
    <div class="tblWrap"><table class="tbl">
      <caption>Requirements vs. you ${p.demo ? '· representative demo data' : '· from the program’s published pages'}</caption>
      <tr><th scope="col">Criterion</th><th scope="col">Published as</th><th scope="col">Program says</th><th scope="col">You</th><th scope="col">State</th></tr>
      ${rows.map(r => `<tr><td><b>${esc(r.c)}</b>${r.note ? `<br><span style="color:var(--dim);font-size:13px">${esc(r.note)}</span>` : ''}</td>
        <td style="font-family:var(--num);font-size:13px;letter-spacing:.06em;color:var(--dim)">${esc(r.pub.replace(/_/g, ' '))}</td>
        <td class="quote">“${esc(r.says)}”</td><td>${esc(r.you)}</td><td>${stateTag(r.state)}</td></tr>`).join('')}
    </table></div>
    <div class="lawBanner"><b>Not published means the program hasn’t said.</b> RISE does not guess. Absence of a restriction is not acceptance.</div>
    <h2 class="h2" style="margin:24px 0 8px">Visa</h2>
    <div class="tblWrap"><table class="tbl">
      <tr><th>Status</th><th>Published as</th><th>State</th></tr>
      ${R.visa.map(v => `<tr><td><b>${esc(v.c)}</b></td><td class="quote">“${esc(v.says)}”</td><td>${stateTag(v.state, v.state === 'unknown' ? 'Not published as sponsorship' : v.state === 'info' ? 'Policy' : null)}</td></tr>`).join('')}
    </table></div>
    <p class="sub" style="font-size:14.5px;margin-top:6px">Listing a visa category is not the same as confirming sponsorship, willingness to rank applicants needing it, or timing of issuance.</p>
    <h2 class="h2" style="margin:24px 0 8px">IMG · Caribbean · DO evidence</h2>
    ${p.demo ? `<p class="sub">Representative roster composition removed</p>` :
      `<ul class="bullets">
        <li>IMG representation confirmed on official resident records — schools include Nishtar, Aga Khan, Dow, Khyber, Peshawar and Saba ${srcBtnInline(p, 5)}</li>
        <li>Caribbean representation confirmed (Saba University School of Medicine on an official record)</li>
        <li>US-DO representation confirmed (LECOM, Lake Erie COM, William Carey COM)</li>
      </ul>
      <div class="gateNote">Roster composition percentages are withheld — the roster is PARTIAL and the denominator is not safe. Current roster composition is observational evidence, not an admissions rule.</div>`}
    ${p.soap.length ? `<h2 class="h2" style="margin:24px 0 8px">SOAP history</h2><p class="sub">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} unfilled`).join(' · ')} (NRMP). Historical evidence, not a promise.</p>` : ''}
    <h2 class="h2" style="margin:24px 0 8px">Interview & signals</h2>
    <p class="sub">${p.demo ? 'Interview evidence is not published.' : 'Interview format and signaling are not yet verified for this program.'}</p>
    <button class="rowBtn" style="margin-top:8px" onclick="toast('CAM handoff seam — interview prep opens with this program’s verified facts.')">◇ Use for Interview Prep</button>
    ${unknownFooter(p)}
  </div>`;
}

function tabResidents(p, R) {
  if (!R || !R.rosterSummary) {
    return `<div><div class="sumStrip"><div class="sumStat"><span class="n">○</span><span class="l">Roster</span></div>
      <div class="sumStat"><span class="n" style="font-size:17px;font-weight:600;color:var(--mid)">${/PRIVACY/.test(p.domains.roster) ? 'Held for MissionMed’s roster privacy review' : 'Not yet researched'}</span><span class="l">Current state</span></div></div>
      <div class="lawBanner">Current roster composition is observational evidence, not an admissions rule.</div>${unknownFooter(p)}</div>`;
  }
  const S = R.rosterSummary;
  const pct = S.img != null;
  return `<div>
    <div class="sumStrip">
      ${pct ? `<div class="sumStat"><span class="n"><em>${S.img}%</em></span><span class="l">IMG</span></div>
      <div class="sumStat"><span class="n">${S.car}%</span><span class="l">Caribbean</span></div>
      <div class="sumStat"><span class="n">${S.usdo}%</span><span class="l">US-DO</span></div>
      <div class="sumStat"><span class="n">${S.usmd}%</span><span class="l">US-MD</span></div>
      <div class="sumStat"><span class="n">${S.unk}%</span><span class="l">Unknown</span></div>` :
      `<div class="sumStat"><span class="n" style="font-size:18px;font-weight:600;color:var(--mid)">Withheld</span><span class="l">Composition %</span></div>`}
      <div class="sumStat"><span class="n" style="font-size:17px;font-weight:600">${esc(S.expected)}</span><span class="l">Expected</span></div>
      <div class="sumStat"><span class="n" style="font-size:17px;font-weight:600">${esc(S.completeness)}</span><span class="l">Completeness</span></div>
    </div>
    ${S.note ? `<div class="gateNote">${esc(S.note)}</div>` : ''}
    ${S.countries ? `<p class="sub" style="margin:8px 0 14px">Countries represented: ${esc(S.countries)}.</p>` : ''}
    <div class="lawBanner">Current roster composition is observational evidence, not an admissions rule.</div>
    ${state.member ? `
      <div class="tblWrap"><table class="tbl">
        <caption>${p.demo ? 'Roster (representative demo)' : 'Identity-safe named examples from official individual pages — not a complete roster'}</caption>
        <tr><th>Resident</th><th>Degree</th><th>Medical school</th><th>Country</th><th>Category</th><th>Caribbean</th></tr>
        ${R.roster.map(r => `<tr><td><b>${esc(r.n)}</b></td><td>${esc(r.deg)}</td><td>${esc(r.sch)}</td><td>${esc(r.co)}</td>
          <td>${stateTag(r.cat === 'IMG' ? 'info' : r.cat === 'US-DO' ? 'meets' : r.cat === 'US-MD' ? 'meets' : 'unknown', r.cat)}</td>
          <td>${stateTag(r.car === 'YES' ? 'info' : r.car === 'NO' ? 'na' : 'unknown', r.car)}</td></tr>`).join('')}
      </table></div>
      ${!p.demo ? `` : ''}`
      : lockBlock('Full roster detail', `${R.roster.length} identity-safe named examples recovered from official pages — degree, school, country, category and Caribbean status per resident.`, true)}
    ${unknownFooter(p, R.real ? ['Complete deduplicated roster', 'Composition percentages (denominator unsafe)'] : [])}
  </div>`;
}

function tabPeople(p, R) {
  if (!R || !R.people) {
    return `<div><p class="sub">Leadership ${p.domains.leadership === 'NOT_PUBLICLY_FOUND' ? 'was not publicly found in the last research pass' : 'is not yet verified by RISE'}.</p>${unknownFooter(p)}</div>`;
  }
  return `<div>
    <div class="tblWrap"><table class="tbl">
      <caption>Program leadership ${p.demo ? '· representative demo' : '· official staff listing'}</caption>
      <tr><th>Person</th><th>Role</th><th>Residency here?</th><th>Fellowship here?</th></tr>
      ${R.people.map(x => `<tr><td><b>${esc(x.n)}</b>${x.note ? `<br><span style="color:var(--dim);font-size:13.5px">${esc(x.note)}</span>` : ''}
        ${!p.demo ? `<br><span style="color:var(--dim);font-size:12.5px">Official photo not yet collected</span>` : ''}</td>
        <td>${esc(x.role)}</td>
        <td>${x.resHere === 'N/A' ? stateTag('na', 'N/A') : stateTag(x.resHere === 'YES' ? 'meets' : x.resHere === 'NO' ? 'na' : 'unknown', x.resHere)}</td>
        <td>${x.felHere === 'N/A' ? stateTag('na', 'N/A') : stateTag(x.felHere === 'YES' ? 'meets' : x.felHere === 'NO' ? 'na' : 'unknown', x.felHere)}</td></tr>`).join('')}
    </table></div>
    ${state.member ? `<p class="sub">${esc(R.peopleNote || '')}</p><div class="lawBanner">Current employment ≠ internal training. A trained-here percentage appears only when the known-history denominator is adequate (≥3); here it is 1 of 8.</div>`
      : lockBlock('Training histories & the trained-here pattern', `Where each leader trained — medical school, residency, fellowship — shown only for source-located records.`, true)}
    ${unknownFooter(p, R.real ? ['Assistant PDs (none safely identified)', 'Chief resident names', '7 of 8 leadership training histories'] : [])}
  </div>`;
}

function tabNext(p, R) {
  if (!R || !R.fellowships) {
    return `<div><p class="sub">Fellowship inventory ${p.domains.fellowship === 'NOT_PUBLICLY_FOUND' ? 'not publicly found in the last pass' : 'not yet verified by RISE'}.</p>${unknownFooter(p)}</div>`;
  }
  const F = R.fellowships;
  return `<div>
    <h2 class="h2" style="margin-bottom:8px">Fellowship inventory</h2>
    <div class="fileGrid" style="grid-template-columns:1fr 1fr;gap:16px">
      <div class="railCard"><div class="rLbl" style="color:var(--gn)">Direct in-house (${F.direct.length})</div><ul class="bullets">${F.direct.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div>
        ${F.advanced.length ? `<div class="railCard"><div class="rLbl" style="color:var(--vi)">Advanced subtracks — not direct IM entry</div><ul class="bullets">${F.advanced.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${F.uncertain.length ? `<div class="railCard"><div class="rLbl" style="color:var(--check)">Uncertain</div><ul class="bullets">${F.uncertain.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${F.excluded.length ? `<div class="railCard"><div class="rLbl">Not IM-accessible (excluded)</div><ul class="bullets">${F.excluded.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </div>
    </div>
    <div class="lawBanner">${esc(F.law)}</div>
    <h2 class="h2" style="margin:24px 0 8px">Current fellows & where they trained</h2>
    ${state.member ? (R.fellows.length ? `<div class="tblWrap"><table class="tbl">
        <caption>Page-listed fellows with recovered residency origins</caption>
        <tr><th>Fellowship</th><th>Fellow</th><th>Residency origin</th><th>Same system?</th></tr>
        ${R.fellows.map(x => `<tr><td>${esc(x.fel)}</td><td><b>${esc(x.n)}</b></td><td>${esc(x.origin)}</td><td>${stateTag(x.same === 'YES' ? 'meets' : x.same === 'NO' ? 'na' : 'unknown', x.same)}</td></tr>`).join('')}
      </table></div><p class="sub" style="font-size:14.5px">${esc(R.fellowsNote)}</p>` : `<p class="sub">${esc(R.fellowsNote)}</p>`)
      : lockBlock('Current fellows & residency origins', `${R.fellows.length} fellows with recovered origins across ${[...new Set(R.fellows.map(x => x.fel))].length} fellowships — internal and external examples. No retention percentage is calculated (denominator unsafe).`, true)}
    <h2 class="h2" style="margin:24px 0 8px">Graduate outcomes</h2>
    <p class="sub">${esc(R.outcomes)}</p>
    ${unknownFooter(p, R.real ? ['Row-by-row graduate destinations', 'Retention calculation (insufficient denominator)'] : [])}
  </div>`;
}

function tabDetails(p, R) {
  const abim = p.abim.passRate ? `${p.abim.passRate}% pass rate · ${p.abim.examinees} examinees (ABIM, verified)` :
    p.abim.claim ? `${p.abim.claim} — <b>program claim</b>, not a verified ABIM extract` :
    p.abim.state === 'VERIFIED_ABSENT' ? 'Not reported by ABIM for this program' :
    p.abim.state === 'VERIFIED_TITLE_LEVEL_AMBIGUITY' ? 'ABIM reports this under a title that may combine programs — rate withheld' : 'Not verified';
  return `<div class="fileGrid"><div>
    <div class="railCard"><div class="rLbl">Board performance</div><p style="font-size:16px">${abim}</p></div>
    <div class="railCard"><div class="rLbl">Salary</div>
      ${R && R.salary ? `${R.salary.rows.map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
      <p class="sub" style="font-size:14px;margin-top:8px">${esc(R.salary.label)} · <span style="color:var(--check)">${esc(R.salary.currentness)}</span></p>` : `<p class="sub">Not published / not yet verified.</p>`}
    </div>
    <div class="railCard"><div class="rLbl">Benefits</div>
      ${R && R.benefits && R.benefits.length ? `<ul class="bullets">${R.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : `<p class="sub">Not yet verified.</p>`}
    </div>
  </div><div>
    <div class="railCard"><div class="rLbl">Identity</div>
      ${[['ACGME ID', p.acgme || 'Not published'], ['Legacy RISE ID', p.legacyId || '—'], ['NRMP code', p.soap.length ? 'joined via SOAP dataset' : 'Not yet mapped'], ['Application service', R ? 'ERAS' : 'Not verified'], ['Official site', p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">↗ program website</a>` : 'Not recovered']].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    </div>
    <div class="railCard"><div class="rLbl">Curriculum & structure</div>
      ${R ? `<ul class="bullets">${R.curriculum.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p class="sub">Deep research pending.</p>'}
    </div>
    ${R && R.conflicts && R.conflicts.length ? `<div class="railCard"><div class="rLbl" style="color:var(--conflict)">Conflicts (${R.conflicts.length})</div>
      ${R.conflicts.slice(0, 3).map(c => `<div class="kv"><span class="k">${esc(c.field)}</span><span class="v" style="font-size:14px">${stateTag('conflict', '')} ${esc(c.a)} <span style="color:var(--dim)">vs</span> ${esc(c.b)}</span></div>`).join('')}
      <button class="rowBtn" style="margin-top:10px" onclick="openSources('${p.id}')">All in Sources ⓘ</button></div>` : ''}
  </div></div>
  ${unknownFooter(p)}`;
}

/* ---------- sources & freshness panel (doc 09 §9.8) ---------- */
window.openSources = (id, evidenceIdx) => {
  const p = byId.get(id); if (!p) return;
  const R = p.rich || {};
  const panel = $('#srcPanel');
  panel.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="Sources and freshness">
    <button class="drawerClose" aria-label="Close" onclick="$('#srcPanel').classList.remove('open')">✕</button>
    <h3>Sources & freshness</h3>
    <p class="sub" style="font-size:14.5px">${esc(p.name)}</p>
    <div class="fGroup"><div class="fLbl">Freshness by family</div>
      ${Object.entries(p.domains).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v" style="font-size:14px">${famFresh(v)} <span style="color:var(--dim);font-size:12.5px">verified ${esc(p.verified)}</span></span></div>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Coverage</div>
      <p class="sub" style="font-size:14.5px">${p.depth === 'gold' ? `Research depth: <b>${esc(R.depthResult || '')}</b>` : p.depth === 'enriched' ? `Enriched pass — ${p.officialFacts} official facts recorded.` : p.depth === 'demo' ? 'Representative demo record.' : 'Registry depth — identity, official URL and ABIM verified where shown.'}</p>
    </div>
    <div class="fGroup"><div class="fLbl">Sources</div>
      ${(R.sources || [{ t: 'Canonical registry source', pub: 'RISE corpus', tier: 2, acc: '2026-08-16', cur: 'current' }]).map((s, i) => `
        <div class="srcRow" ${evidenceIdx === i ? 'style="outline:2px solid var(--cy);border-radius:8px;padding:12px"' : ''}>
          <div class="srcT">${esc(s.t)}</div>
          <div class="srcM"><span class="srcTier">Tier ${s.tier} · ${s.tier === 1 ? 'Official' : s.tier === 2 ? 'Directory / internal' : 'Secondary'}</span><span>${esc(s.pub)}</span><span>accessed ${esc(s.acc)}</span><span class="cur-${s.cur}">${s.cur}</span></div>
        </div>`).join('')}
    </div>
    ${R.conflicts && R.conflicts.length ? `<div class="fGroup"><div class="fLbl">Conflicts</div>
      ${R.conflicts.map(c => `<div class="srcRow"><div class="srcT">${stateTag('conflict', '')} ${esc(c.field)}</div>
        <div style="font-size:14px;color:var(--mid);margin-top:4px">A: ${esc(c.a)}<br>B: ${esc(c.b)}<br><span style="color:var(--dim)">How RISE shows it: ◐ until resolved · ${esc(c.res)}</span></div></div>`).join('')}
    </div>` : ''}
    ${R.unresolved ? `<div class="fGroup"><div class="fLbl">Unresolved fields (${R.unresolved.length})</div>
      <div class="unkChips">${R.unresolved.map(u => `<span class="unkChip">${esc(u)}</span>`).join('')}</div></div>` : ''}
  </div>`;
  panel.classList.add('open');
};


/* ============ ADMIN — RESEARCH COMMAND CENTER (doc 12) · simulate only ============ */
'use strict';

const FAMILIES = [
  ['rosters', 'Resident rosters', 'Names, PGY, schools, categories — privacy-gated'],
  ['schools', 'Resident schools & composition', 'Normalized schools, countries, category shares'],
  ['leadership', 'Leadership', 'PD, APDs, coordinator, chairs'],
  ['leadtrain', 'Leadership training histories', 'Med school, residency, fellowship, trained-here'],
  ['requirements', 'Application requirements', 'Scores, attempts, LORs, deadlines, YOG, USCE'],
  ['visa', 'Visa', 'J-1, H-1B, F-1 OPT — sponsorship vs listed status'],
  ['abim', 'ABIM', 'Pass rates, examinees, title-level mapping'],
  ['salary', 'Salary & benefits', 'PGY scales, leave, funds'],
  ['fellowships', 'Fellowships', 'Direct in-house vs advanced vs affiliate'],
  ['fellows', 'Current fellows', 'Cohorts per fellowship'],
  ['origins', 'Fellow origins', 'Residency origins, same-system'],
  ['outcomes', 'Graduate outcomes', 'Destinations by class year'],
];
const UNIT_COST = 0.30;
const famDomain = { rosters: 'roster', schools: 'roster', leadership: 'leadership', leadtrain: 'leadership', requirements: 'requirements', visa: 'visa', abim: 'requirements', salary: 'salary', fellowships: 'fellowship', fellows: 'fellowship', origins: 'fellowship', outcomes: 'outcomes' };

const adminDraft = { states: [], soapOnly: false, savedOnly: false, condition: 'stale', families: new Set(), hypothesis: null, nl: null };

function scopePrograms() {
  let list = D.programs.filter(p => !p.demo);
  if (adminDraft.states.length) list = list.filter(p => adminDraft.states.includes(p.state));
  if (adminDraft.soapOnly) list = list.filter(p => p.soap.length);
  if (adminDraft.savedOnly) list = list.filter(p => state.saved.has(p.id));
  return list;
}
function needsResearch(p) {
  if (adminDraft.condition === 'all') return true;
  const fams = [...adminDraft.families];
  if (!fams.length) return false;
  return fams.some(f => {
    const d = p.domains[famDomain[f]] || 'NOT_PUBLICLY_FOUND';
    if (adminDraft.condition === 'stale') return !/^VERIFIED$/.test(d);
    if (adminDraft.condition === 'missing') return /NOT_PUBLICLY_FOUND|NOT_EXECUTED/.test(d);
    if (adminDraft.condition === 'conflicted') return /CONFLICT/.test(d);
    return true;
  });
}
function previewNumbers() {
  const scope = scopePrograms();
  const need = scope.filter(needsResearch);
  const famN = Math.max(1, adminDraft.families.size);
  const rosterHolds = [...adminDraft.families].includes('rosters') ? need.filter(p => /PRIVACY/.test(p.domains.roster)).length : 0;
  const tasks = need.length * famN;
  return { scope: scope.length, need: need.length, tasks, cost: tasks * UNIT_COST, eta: Math.max(4, Math.round(tasks * 0.8)), skipped: scope.length - need.length, rosterHolds, needList: need };
}

function viewAdmin(sub) {
  const head = `<div class="adminBanner"><b>Admin command center</b><span>The research factory is <b>not authorized</b> for this release. Preview and paid submission fail closed.</span></div>`;
  if (sub === 'queue') return `<div class="view">${head}${viewQueue()}</div>`;
  if (sub === 'review') return `<div class="view">${head}${viewReview()}</div>`;
  if (sub === 'coverage') return `<div class="view">${head}${viewCoverage()}</div>`;
  return `<div class="view">${head}${viewResearch()}</div>`;
}

/* ---------- Research / Campaigns ---------- */
function viewResearch() {
  const pv = previewNumbers();
  const famChecked = k => adminDraft.families.has(k);
  const spend = state.campaigns.reduce((s, c) => s + (c.state === 'INGESTED' || c.state === 'RUNNING' ? c.cost : 0), 0);
  return `
    <p class="eyebrow" style="color:var(--admin)">Research · Campaigns</p>
    <h1 class="h1">Operate the <em>intelligence</em></h1>
    <p class="sub" style="max-width:720px;margin:6px 0 4px">Describe the research, or build the scope by hand. RISE will resolve scope, processor and cost only after the production research adapter is authorized.</p>
    <div class="nlBar">
      <input id="nlInput" type="text" placeholder="Describe the research… e.g. “Update resident rosters in New Jersey”" aria-label="Natural-language research">
      <button class="nlGo" onclick="parseNL($('#nlInput').value)">Draft it</button>
    </div>
    <div class="nlChips">
      ${['Check whether the APD changed at SUNY Upstate', 'Update all current resident rosters in New Jersey', 'Refresh visa rules for Florida Family Medicine', 'I heard Adena now sponsors H-1B. Verify it.'].map(t => `<button class="nlChip" onclick="$('#nlInput').value='${t.replace(/'/g, "\\'")}';parseNL('${t.replace(/'/g, "\\'")}')">${t}</button>`).join('')}
    </div>
    <div id="nlDraft"></div>
    <div class="stepper">
      <div>
        <div class="stepCard">
          <div class="stepNum">1 · Scope</div>
          <div class="filterRow" style="margin-bottom:10px">
            <select class="fSel" aria-label="Specialty"><option>Internal Medicine</option><option>Family Medicine (corpus pending)</option></select>
            <select class="fSel" aria-label="State" onchange="adminDraft.states=this.value?[this.value]:[];refreshAdmin()">
              <option value="">All states</option>${STATES.map(s => `<option value="${s}" ${adminDraft.states[0] === s ? 'selected' : ''}>${stateNames[s] || s}</option>`).join('')}
            </select>
          </div>
          <button class="tgl ${adminDraft.soapOnly ? 'on' : ''}" onclick="adminDraft.soapOnly=!adminDraft.soapOnly;refreshAdmin()"><span class="box">✓</span><span>SOAP 2026 programs only<span class="cav">${D.programs.filter(p => p.soap.length).length} in corpus</span></span></button>
          <button class="tgl ${adminDraft.savedOnly ? 'on' : ''}" onclick="adminDraft.savedOnly=!adminDraft.savedOnly;refreshAdmin()"><span class="box">✓</span><span>Programs students are tracking<span class="cav">${state.saved.size} saved in this session</span></span></button>
          <div class="fLbl" style="margin-top:14px">Data condition</div>
          ${[['stale', 'Only stale or missing', 'default'], ['missing', 'Only missing'], ['conflicted', 'Only conflicted'], ['all', 'Everything in scope']].map(([k, l, d]) => `
            <button class="tgl ${adminDraft.condition === k ? 'on' : ''}" onclick="adminDraft.condition='${k}';refreshAdmin()"><span class="box">${adminDraft.condition === k ? '●' : ''}</span><span>${l}${d ? `<span class="cav">${d}</span>` : ''}</span></button>`).join('')}
        </div>
        <div class="stepCard">
          <div class="stepNum">2 · Field families</div>
          ${FAMILIES.map(([k, l, c]) => {
            const scope = scopePrograms();
            const cur = scope.filter(p => /^VERIFIED$/.test(p.domains[famDomain[k]] || '')).length;
            return `<button class="famTgl ${famChecked(k) ? 'on' : ''}" onclick="adminDraft.families.has('${k}')?adminDraft.families.delete('${k}'):adminDraft.families.add('${k}');refreshAdmin()">
            <span class="box">✓</span><span><span class="fN">${l}</span><span class="fC">${c} · coverage: ${cur}/${scope.length} current</span></span></button>`;
          }).join('')}
          <div style="display:flex;gap:9px;margin-top:8px">
            <button class="rowBtn" onclick="FAMILIES.forEach(f=>adminDraft.families.add(f[0]));adminDraft.condition='missing';refreshAdmin()">All missing high-value</button>
            <button class="rowBtn" onclick="FAMILIES.forEach(f=>adminDraft.families.add(f[0]));adminDraft.condition='stale';refreshAdmin()">All stale</button>
          </div>
        </div>
      </div>
      <div>
        <div class="previewCard" id="pvCard">
          <div class="stepNum">3 · Preview</div>
          ${!adminDraft.families.size ? '<p class="sub" style="font-size:15px;margin:4px 0 8px;color:var(--check)">Pick at least one field family in step 2.</p>' : ''}
          <div class="pvLine"><span class="n">${pv.need}</span><span>programs require research</span></div>
          <div class="pvLine"><span class="n">${pv.tasks}</span><span>tasks · processor unavailable</span></div>
          <div class="pvLine"><span class="n cost">—</span><span>cost unavailable until server preview</span></div>
          <div class="pvLine"><span class="n">~${pv.eta}m</span><span>estimated time</span></div>
          ${pv.skipped && adminDraft.families.size ? `<p class="sub" style="font-size:14px;margin-top:8px">Skips: ${pv.skipped} program${pv.skipped > 1 ? 's' : ''} already current or out of condition for the selected families.</p>` : ''}
          ${pv.rosterHolds ? `<p class="sub" style="font-size:14px;color:var(--vi)">${pv.rosterHolds} roster task${pv.rosterHolds > 1 ? 's' : ''} held — roster privacy decision not materialized.</p>` : ''}
          <div class="stepNum" style="margin-top:16px">4 · Run</div>
          <button class="runBtn" disabled>⚗ Run research</button>
          <p class="simNote">Disabled until a bounded server-side preview, processor route, cost estimate and explicit paid-submit confirmation are authorized.</p>
        </div>
        <div class="stepCard" style="margin-top:16px">
          <div class="stepNum">Budget & history</div>
          <div class="kv"><span class="k">Processor & unit cost</span><span class="v">Unavailable · server preview required</span></div>
          <div class="kv"><span class="k">Monthly cap</span><span class="v">$250 · spent $${spend.toFixed(2)}</span></div>
          <div class="kv"><span class="k">Per-campaign cap</span><span class="v">$50 (second confirm above)</span></div>
          ${state.campaigns.map(c => `<div class="taskRow" style="margin-top:10px"><span class="tp">${esc(c.name)}</span><span class="tf">${c.tasks} tasks · $${c.cost.toFixed(2)}</span><span class="tState ts-${c.state}">${c.state.replace(/_/g, ' ')}</span>${c.state === 'RUNNING' ? `<button class="rowBtn" onclick="nav('admin/queue')">Monitor</button>` : ''}</div>`).join('')}
        </div>
      </div>
    </div>`;
}
window.refreshAdmin = () => { if ((currentRoute() || '').startsWith('admin')) renderMain(currentRoute()); };

/* ---------- NL parse (doc 12 §12.7) ---------- */
window.parseNL = q => {
  if (!q || !q.trim()) return;
  $('#nlDraft').innerHTML = `<div class="previewCard" style="margin-bottom:18px">
    <div class="stepNum">Draft from your sentence — confirmation remains required</div>
    <div class="pillRow" style="margin-top:6px"><span class="pill">Request: ${esc(q.trim())}</span><span class="pill">Scope: unavailable</span><span class="pill">Processor: unavailable</span></div>
    <div class="pvLine"><span class="n">—</span><span>task count and cost require an authorized server preview</span></div>
    <div class="mActs" style="margin-top:12px"><button class="mBtn pri" disabled>Run research</button><button class="mBtn sec" onclick="$('#nlDraft').innerHTML=''">Discard</button></div>
    <div class="mFoot">Natural language never submits paid work directly. This release has no research adapter, so the flow stops here.</div>
  </div>`;
};

/* ---------- run + queue simulation ---------- */
window.runCampaign = () => toast('Research submission is disabled: no authorized factory adapter or server cost preview.');

/* ---------- queue ---------- */
function viewQueue() {
  return `<p class="eyebrow" style="color:var(--admin)">Queue</p><h1 class="h1">Task <em>monitor</em></h1><div class="emptyLib"><div class="big">No authorized research queue is connected.</div>Queued, running, returned, normalizing, QA, ingested, partial and failed states will appear only from the canonical research backend.</div>`;
}

/* ---------- review queue + change detection (doc 12 §12.5) ---------- */
const REVIEW_ITEMS = [];
function viewReview() {
  return `<p class="eyebrow" style="color:var(--admin)">Review</p><h1 class="h1">Nothing ships <em>unreviewed</em></h1><div class="emptyLib"><div class="big">No authorized review queue is connected.</div>Research changes cannot be accepted, rejected, or ingested from this release.</div>`;
}
window.reviewDecide = () => toast('Review decisions are disabled until the canonical research backend is connected.');

/* ---------- coverage ---------- */
function viewCoverage() {
  const states = [...new Set(D.programs.filter(p => !p.demo).map(p => p.state))].sort();
  const fams = [['requirements', 'Reqs'], ['visa', 'Visa'], ['roster', 'Roster'], ['leadership', 'People'], ['salary', 'Salary'], ['fellowship', 'Fellows']];
  const cellFor = (st, fam) => {
    const ps = D.programs.filter(p => p.state === st && !p.demo);
    const cur = ps.filter(p => /^VERIFIED$/.test(p.domains[fam])).length;
    const hold = ps.filter(p => /PRIVACY/.test(p.domains[fam])).length;
    const miss = ps.filter(p => /NOT_PUBLICLY_FOUND/.test(p.domains[fam])).length;
    if (hold === ps.length && ps.length) return ['cov-hold', 'hold'];
    if (cur === ps.length && ps.length) return ['cov-cur', cur + '/' + ps.length];
    if (cur > 0) return ['cov-stale', cur + '/' + ps.length];
    if (miss === ps.length) return ['cov-miss', '0/' + ps.length];
    return ['cov-stale', cur + '/' + ps.length];
  };
  const top = states.map(s => [s, D.programs.filter(p => p.state === s && !p.demo).length]).sort((a, b) => b[1] - a[1]).slice(0, 12);
  return `<p class="eyebrow" style="color:var(--admin)">Coverage</p>
    <h1 class="h1">Where the corpus <em>stands</em></h1>
    <p class="sub" style="margin:8px 0 18px">Specialty × state × field family. Click a cell to pre-fill a campaign scope. Green = current · amber = partial/stale · grey = missing · violet = privacy hold.</p>
    <div class="tblWrap" style="padding:14px"><div class="covGrid">
      <span></span>${fams.map(([k, l]) => `<span class="covRowLbl" style="text-align:center">${l}</span>`).join('')}
      ${top.map(([st, n]) => `<span class="covRowLbl">${st} · ${n}</span>` + fams.map(([k]) => {
        const [cls, txt] = cellFor(st, k);
        return `<button class="covCell ${cls} clickable" onclick="adminDraft.states=['${st}'];adminDraft.families=new Set(['${k === 'roster' ? 'rosters' : k === 'fellowship' ? 'fellowships' : k === 'leadership' ? 'leadership' : k}']);adminDraft.condition='stale';nav('admin/research');toast('Scope pre-filled: ${stateNames[st] || st} · ${k}')">${txt}</button>`;
      }).join('')).join('')}
    </div></div>
    <div class="sumStrip" style="margin-top:18px">
      <div class="sumStat"><span class="n"><em>${D.meta.programCount}</em></span><span class="l">Canonical identities</span></div>
      <div class="sumStat"><span class="n">0</span><span class="l">Published deep dossiers</span></div>
      <div class="sumStat"><span class="n">0</span><span class="l">Published SOAP joins</span></div>
      <div class="sumStat"><span class="n">—</span><span class="l">Research adapter unavailable</span></div>
    </div>`;
}
function bindAdmin() {}

Object.assign(globalThis, { state, D, $, $$, adminDraft, FAMILIES, byId, fitCache, renderMain, renderShell, openFileFor });

/* ============ boot ============ */
function init() {
  document.body.classList.remove('is-booting');
  lookupBind('#omni', '#omniAC', 'home');
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); focusLookup(); }
    if (e.key === 'Escape') {
      if ($('#modal').classList.contains('open')) { closeModal(); return; }
      if ($('#srcPanel').classList.contains('open')) { $('#srcPanel').classList.remove('open'); return; }
      if ($('#filterDrawer') && $('#filterDrawer').classList.contains('open')) { $('#filterDrawer').classList.remove('open'); return; }
      if ($('#file').classList.contains('open')) { closeFile(); return; }
    }
  });
  ['#modal', '#srcPanel', '#filterDrawer'].forEach(sel => {
    const el = $(sel); if (!el) return;
    el.addEventListener('mousedown', e => { if (e.target === el) { el.classList.remove('open'); if (sel === '#modal') closeModal(); } });
  });
  $('#file').addEventListener('mousedown', e => { if (e.target === $('#file')) closeFile(); });
  $('#themeBtn').addEventListener('click', () => {
    const order = ['midnight', 'graphite', 'daylight'];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    document.body.dataset.theme = state.theme === 'midnight' ? '' : state.theme;
    toast('Theme: ' + { midnight: 'Midnight Depth', graphite: 'Graphite Motion', daylight: 'Soft Daylight' }[state.theme]);
  });
  if (!location.hash) location.hash = '#/home';
  onRoute();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
