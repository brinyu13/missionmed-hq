/* Generated from the founder-approved Fable 5002 shell. Do not edit directly. */
/* Release: P1-RISE-5012H application intelligence UX. */
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

function toFableProgram(record, filterIntelligence, flagBits) {
  const evidenceCount = Number(record.intelligence?.knownRegistryFieldCount ?? 0);
  const flags = Number(filterIntelligence?.flags || 0);
  const enabled = name => Boolean(flags & Number(flagBits?.[name] || 0));
  const j1 = enabled('j1');
  const h1b = enabled('h1b');
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
    depth: filterIntelligence?.researchDepth || (evidenceCount ? 'basic' : 'pending'),
    verified: record.source?.retrievedAt || record.source?.sourceUpdatedAt || null,
    type: record.programType || 'Not published',
    positions: record.intelligence?.firstYearPositions ?? record.intelligence?.residentsPerYear ?? 'Not published',
    abim: { state: 'NOT_PUBLISHED' },
    domains: { ...UNKNOWN_DOMAINS },
    soap: (record.soap2026?.tracks || []).map(track => ({
      year: 2026,
      positions: Number(track.availablePositions || 0),
      track: track.programType || 'Track not stated',
      nrmpProgramCode: track.nrmpProgramCode || null,
      source: 'SOAP 2026 bounded historical evidence',
    })),
    browseMemberships: (record.browseMemberships || []).map(m => ({ browseSpecialty: m.browseSpecialty, relationship: m.relationship })),
    aliases: [],
    maturity: 'CANONICAL_IDENTITY_ONLY',
    demo: false,
    rich: null,
    canonical: null,
    researchProjection: null,
    profileLoading: false,
    intelligence: { ...(record.intelligence || {}) },
    searchTerms: Array.isArray(filterIntelligence?.searchTerms) ? filterIntelligence.searchTerms : [],
    application: filterIntelligence?.application || null,
    applicationMatch: filterIntelligence?.applicationMatch || null,
    filterIntelligence: {
      visa: { j1, h1b, j1OrH1b: j1 || h1b, any: enabled('anyVisa') },
      residentEvidence: { img: enabled('img'), do: enabled('do'), caribbean: enabled('caribbean'), usmd: enabled('usmd') },
      researchDepth: filterIntelligence?.researchDepth || 'pending',
      researchState: filterIntelligence?.researchState || 'NOT_YET_RESEARCHED',
      approvedDomainCount: Number(filterIntelligence?.approvedDomainCount || 0),
      pendingDomainCount: Number(filterIntelligence?.pendingDomainCount || 0),
      soap2026: enabled('soap2026'), abim: enabled('abim'), alumni: enabled('alumni'),
    },
  };
}

const MATRIX_PROFILE_LABELS = Object.freeze({
  primary_specialty: 'Specialty of choice', medical_school: 'Medical school', medical_school_country: 'Medical school country',
  graduation_year: 'Graduation year', is_img: 'IMG status', step1_status: 'Step 1 / Level 1 status',
  step1_score: 'Step 1 / Level 1 score', step2_status: 'Step 2 CK / Level 2 status',
  step2_score: 'Step 2 CK / Level 2 score', visa_status: 'Visa / citizenship', usce_months: 'USCE months',
  current_location: 'Application-season location', match_cycle: 'Match cycle', phone_mobile: 'Phone / mobile',
  first_name: 'First name', last_name: 'Last name',
});

function profileFromMatrix(payload) {
  if (payload?.unavailable) {
    return {
      name: 'Student', demo: false, available: false, facts: [], completeness: 0,
      missing: [], missingKeys: [], raw: {},
      unavailableMessage: payload.message || 'Matrix profile integration is unavailable',
    };
  }
  const raw = payload?.profile && typeof payload.profile === 'object' ? payload.profile : {};
  const factKeys = ['primary_specialty', 'medical_school', 'medical_school_country', 'graduation_year', 'is_img', 'step1_status', 'step1_score', 'step2_status', 'step2_score', 'visa_status', 'usce_months', 'current_location', 'match_cycle'];
  const facts = factKeys.filter(key => raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '')
    .map(key => [MATRIX_PROFILE_LABELS[key], String(raw[key])]);
  const missingKeys = Array.isArray(payload?.required_fields)
    ? payload.required_fields.filter(key => !raw[key])
    : ['first_name', 'last_name', 'phone_mobile', 'primary_specialty'].filter(key => !raw[key]);
  const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || 'Student';
  const progress = Number(payload?.progress);
  return {
    name,
    demo: false,
    available: true,
    facts,
    completeness: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    missing: missingKeys.map(key => MATRIX_PROFILE_LABELS[key] || key.replaceAll('_', ' ')),
    missingKeys,
    raw,
  };
}

async function loadRuntime() {
  const session = await riseFetch('/api/rise/v1/session');
  const status = await riseFetch('/api/rise/v1/status');
  const firstPage = await riseFetch('/api/rise/v1/programs/catalog?page=1&pageSize=1000');
  const catalogPageRequests = [];
  for (let p = 2; p <= firstPage.totalPages; p++) {
    catalogPageRequests.push(riseFetch('/api/rise/v1/programs/catalog?page=' + p + '&pageSize=1000'));
  }
  const [catalogPages, filterIntelligence, matrixProfile, savedResult, betaNotice, researchControl, applicationPreferences] = await Promise.all([
    Promise.all(catalogPageRequests),
    riseFetch('/api/rise/v1/filter-intelligence'),
    riseFetch('/api/rise/v1/me/profile').catch(error => ({
      unavailable: true,
      message: error?.message || 'Matrix profile integration is unavailable',
    })),
    riseFetch('/api/rise/v1/me/programs'),
    riseFetch('/api/rise/v1/me/beta-notice'),
    riseFetch('/api/rise/v1/research/control').catch(() => ({ controls: null })),
    riseFetch('/api/rise/v1/me/application-preferences').catch(() => ({ preferences: null })),
  ]);
  const catalogRecords = [...firstPage.records, ...catalogPages.flatMap(page => page.records)];
  const registry = { registryReleaseId: firstPage.registryReleaseId, total: firstPage.total, records: catalogRecords };
  const filterByProgram = new Map((filterIntelligence.records || []).map(record => [record.programSpecialtyId, record]));
  const saved = new Map((savedResult.records || []).map(record => [record.programSpecialtyId, {
    state: record.state,
    notes: record.notes || '',
  }]));
  return {
    session,
    status,
    betaNotice,
    researchControl: researchControl.controls,
    saved,
    persistence: savedResult.persistence || 'unavailable',
    data: {
      meta: {
        build: status.buildId,
        corpus: registry.registryReleaseId,
        generated: new Date().toISOString().slice(0, 10),
        programCount: registry.total,
        soapJoined: registry.records.filter(record => record.soap2026?.appeared).length,
      },
      profile: profileFromMatrix(matrixProfile),
      filterCounts: filterIntelligence.counts || {},
      filterPolicy: filterIntelligence.evidencePolicy || {},
      applicationFacetCounts: filterIntelligence.applicationFacetCounts || {},
      applicationPreferences: applicationPreferences.preferences || {
        personalizationEnabled: true,
        priorities: ['visa', 'exams', 'yog', 'usce', 'research_depth'],
        cardFields: ['visa', 'exams', 'yog', 'usce', 'composition', 'research_depth'],
      },
      programs: registry.records.map(record => toFableProgram(record, filterByProgram.get(record.programSpecialtyId), filterIntelligence.flagBits)),
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
  find: { mode: 'profile', q: '', state: '', specialty: '', residentSchool: '', soap: false, soapTrack: '', abim: false, depth: '', fresh: '', visaMode: '', imgEv: false, doEv: false, caribbeanEv: false, usmdEv: false, step1Policy: '', step2Minimum: '', comlex2: false, attemptsMaximum: '', yogWindow: '', usceMode: '', minImgPct: '', minDoPct: '', sameSchool: false, sameCountry: false, fellowships: false, sort: 'fit', view: 'list', shown: 50, scroll: 0, moreOpen: false },
  applicationPreferences: D.applicationPreferences,
  fileTab: 'overview',
  fileFrom: 'find',
  campaigns: [],
  reviewDone: new Set(),
  dismissedLocks: new Set(),
  updating: new Set(),                // program ids currently updating from an authorized research job
  changed: [],                        // ingest log for "Updated this week"
  researchAdmin: { loading: false, error: null, control: null, revision: null, providers: [], jobs: [], benchmarks: [], frozenBenchmarkIds: [], reviewStats: null, reviewRecords: [] },
};

/* Campaign state is loaded only from an authorized research backend. */

/* ---------------- program index ---------------- */
const byId = new Map(D.programs.map(p => [p.id, p]));
const STATES = [...new Set(D.programs.map(p => p.state))].sort();
const SPECIALTIES = [...new Set(D.programs.flatMap(p => (p.browseMemberships || []).map(m => m.browseSpecialty)))].sort();
const RESIDENT_SCHOOLS = [...new Set(D.programs.flatMap(p => p.searchTerms || []))].sort();
const stateNames = { AL:'Alabama', AR:'Arkansas', AZ:'Arizona', CA:'California', CO:'Colorado', CT:'Connecticut', DC:'Washington DC', DE:'Delaware', FL:'Florida', GA:'Georgia', IA:'Iowa', IL:'Illinois', IN:'Indiana', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', MA:'Massachusetts', MD:'Maryland', MI:'Michigan', MN:'Minnesota', MO:'Missouri', MS:'Mississippi', MT:'Montana', NC:'North Carolina', ND:'North Dakota', NE:'Nebraska', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NV:'Nevada', NY:'New York', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', PR:'Puerto Rico', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VA:'Virginia', VT:'Vermont', WA:'Washington', WI:'Wisconsin', WV:'West Virginia', WY:'Wyoming' };

/* ---------------- fit engine ---------------- */
const fitCache = new Map();
function computeFit(p) {
  const cacheKey = `${p.id}:${state.find.mode}:${state.applicationPreferences.personalizationEnabled}`;
  if (fitCache.has(cacheKey)) return fitCache.get(cacheKey);
  const personalized = state.find.mode === 'profile' && state.applicationPreferences.personalizationEnabled
    && D.profile.available && p.applicationMatch;
  const groups = personalized ? p.applicationMatch : null;
  const f = personalized ? {
    tier: null,
    line: groups.summary || 'No supported profile comparison is available',
    reasons: [...(groups.blockers || []), ...(groups.cautions || []), ...(groups.positives || [])].slice(0, 3).map(item => item.title),
    rep: false,
    counts: { issue: (groups.blockers || []).length, check: (groups.cautions || []).length, meets: (groups.positives || []).length, unknown: (groups.unknowns || []).length },
    known: [...(groups.blockers || []), ...(groups.cautions || []), ...(groups.positives || [])].length > 0,
  } : { tier: null, line: 'Needs more verified data — fit is not forced', reasons: [], rep: false, counts: null, known: false };
  fitCache.set(cacheKey, f);
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
  if (d >= new Date('2026-06-01')) return { cls: 'fp-cycle', label: 'Registry current' };
  return { cls: 'fp-old', label: 'Registry needs refresh' };
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
    rerender(); toast('Could not sync My Programs' + (error.code ? ' (' + error.code + ')' : '') + ' — no change was saved.');
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
    ['home', 'Home', ICONS.home], ['find', 'Find Programs', ICONS.find], ['soap', 'SOAP Explorer', ICONS.find], ['my', 'My Programs', ICONS.my],
    ['rank', 'Rank List', ICONS.rank], ['profile', 'My Profile', ICONS.prof],
  ];
  const admin = [['admin/research', 'Research', ICONS.res], ['admin/benchmark', 'Benchmark', ICONS.res], ['admin/queue', 'Queue', ICONS.queue], ['admin/review', 'Review', ICONS.review], ['admin/coverage', 'Coverage', ICONS.cov]];
  const savedN = state.saved.size;
  $('#rail').innerHTML = `
    <button class="railCta" onclick="focusLookup()">✦ <span>Tell me about…</span></button>
    ${student.map(([k, l, ic]) => `<button class="rtab ${activeBase === k ? 'on' : ''}" ${activeBase === k ? 'aria-current="page"' : ''} onclick="nav('${k}')">${ic}<span>${l}</span>${k === 'my' && savedN ? `<span class="badge">${savedN}</span>` : ''}</button>`).join('')}
    ${state.role === 'admin' ? `<div class="railSep"></div><div class="railGroupLbl">Research · Admin</div>` +
      admin.map(([k, l, ic]) => `<button class="rtab adminTab ${r === k || (activeBase === 'admin' && k.endsWith(adminView) && r.startsWith('admin')) ? (r === k ? 'on' : '') : ''} ${r === k ? 'on' : ''}" onclick="nav('${k}')">${ic}<span>${l}</span>${k === 'admin/review' ? `<span class="badge">${state.researchAdmin.reviewRecords.length || ''}</span>` : ''}</button>`).join('') : ''}
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
    const hay = [p.name, p.inst, p.hospital, p.city, p.state, stateNames[p.state] || '', p.specName, p.acgme, p.legacyId, p.id, (p.aliases || []).join(' '), (p.searchTerms || []).join(' ')].filter(Boolean).join(' ').toLowerCase();
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
      ${intent && intent.kind !== 'fact' ? `<button class="acRow" data-i="-2"><span class="acMain"><span class="acName" style="color:var(--cy)">→ ${intent.kind === 'soap' ? 'Show SOAP 2026 history' + (intent.st ? ' in ' + stateNames[intent.st] : '') : intent.kind === 'similar' ? 'Show programs like ' + esc(intent.p.name) : 'Show programs in ' + stateNames[intent.st] + ' that fit me'}</span><span class="acSub">Opens Find Programs with these filters</span></span></button>` : ''}
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
  else if (base === 'soap') main.innerHTML = viewSoapExplorer();
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
  if (base === 'find' || base === 'soap') bindFind();
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
      ${door('EVIDENCE', 'SOAP 2026 history', 'Programs that appeared in the 2026 SOAP results. Historical evidence, not a prediction.', `${soapCount} corpus programs · Categorical, Prelim & Primary Care`, false, `nav('soap')`)}
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

function matchingPrograms(f = state.find) {
  let list = D.programs.slice();
  if (f.q) { const hits = new Set(searchPrograms(f.q).map(p => p.id)); list = list.filter(p => hits.has(p.id)); }
  if (f.state) list = list.filter(p => p.state === f.state);
  if (f.specialty) list = list.filter(p => (p.browseMemberships || []).some(m => m.browseSpecialty === f.specialty));
  if (f.residentSchool) {
    const school = f.residentSchool.trim().toLocaleLowerCase('en-US');
    list = list.filter(p => (p.searchTerms || []).some(term => term.toLocaleLowerCase('en-US').includes(school)));
  }
  if (f.soap) list = list.filter(p => p.soap.length && (!f.soapTrack || p.soap.some(s => s.track === f.soapTrack)));
  if (f.abim) list = list.filter(p => p.filterIntelligence.abim);
  if (f.depth) list = list.filter(p => p.filterIntelligence.researchDepth === f.depth);
  if (f.visaMode) list = list.filter(p => ({
    j1: p.filterIntelligence.visa.j1,
    h1b: p.filterIntelligence.visa.h1b,
    either: p.filterIntelligence.visa.j1OrH1b,
    any: p.filterIntelligence.visa.any,
  })[f.visaMode]);
  if (f.imgEv) list = list.filter(p => p.filterIntelligence.residentEvidence.img);
  if (f.doEv) list = list.filter(p => p.filterIntelligence.residentEvidence.do);
  if (f.caribbeanEv) list = list.filter(p => p.filterIntelligence.residentEvidence.caribbean);
  if (f.usmdEv) list = list.filter(p => p.filterIntelligence.residentEvidence.usmd);
  if (f.step1Policy) list = list.filter(p => f.step1Policy === 'required' ? p.application?.exams?.step1Required === true : p.application?.exams?.step1Required !== true);
  if (f.step2Minimum) list = list.filter(p => p.application?.exams?.step2Minimum !== null && p.application.exams.step2Minimum <= Number(f.step2Minimum));
  if (f.comlex2) list = list.filter(p => p.application?.exams?.comlexLevel2Accepted === true);
  if (f.attemptsMaximum) list = list.filter(p => p.application?.exams?.maxAttempts !== null && p.application.exams.maxAttempts >= Number(f.attemptsMaximum));
  if (f.yogWindow) list = list.filter(p => p.application?.yog?.noPublishedCutoff || (p.application?.yog?.years !== null && p.application.yog.years >= Number(f.yogWindow)));
  if (f.usceMode) list = list.filter(p => ({ required: p.application?.usce?.required, recommended: p.application?.usce?.recommended, unpublished: !p.application?.usce?.published })[f.usceMode]);
  if (f.minImgPct) list = list.filter(p => (p.application?.roster?.composition?.IMG_NON_CARIBBEAN?.percent ?? p.application?.roster?.registryComposition?.img ?? -1) >= Number(f.minImgPct));
  if (f.minDoPct) list = list.filter(p => (p.application?.roster?.composition?.US_DO?.percent ?? p.application?.roster?.registryComposition?.do ?? -1) >= Number(f.minDoPct));
  if (f.sameSchool) list = list.filter(p => p.application?.roster?.sameSchoolCount > 0);
  if (f.sameCountry) list = list.filter(p => p.application?.roster?.sameCountryCount > 0);
  if (f.fellowships) list = list.filter(p => p.application?.fellowshipCount > 0);
  if (f.fresh) list = list.filter(p => freshness(p).label === f.fresh);
  return list;
}
function filteredPrograms() {
  const f = state.find;
  const list = matchingPrograms(f);
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
function filterOptionCount(patch) {
  return matchingPrograms({ ...state.find, ...patch }).length;
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
  if (f.q) pills.push({ k: 'q', label: `”${f.q}”` });
  if (f.specialty) pills.push({ k: 'specialty', label: f.specialty });
  if (f.state) pills.push({ k: 'state', label: stateNames[f.state] || f.state });
  if (f.residentSchool) pills.push({ k: 'residentSchool', label: 'Resident school: ' + f.residentSchool });
  if (f.soap) pills.push({ k: 'soap', label: 'SOAP 2026' + (f.soapTrack ? ' · ' + f.soapTrack : '') });
  if (f.abim) pills.push({ k: 'abim', label: 'ABIM verified' });
  if (f.depth) pills.push({ k: 'depth', label: { deep: 'Deep Research', enriched: 'Enriched Research', basic: 'Basic Profile', pending: 'Research Pending' }[f.depth] });
  if (f.visaMode) pills.push({ k: 'visaMode', label: { j1: 'J-1 sponsorship published', h1b: 'H-1B sponsorship published', either: 'J-1 or H-1B published', any: 'Any visa evidence' }[f.visaMode] });
  if (f.imgEv) pills.push({ k: 'imgEv', label: 'IMG resident / graduate evidence' });
  if (f.doEv) pills.push({ k: 'doEv', label: 'DO resident / graduate evidence' });
  if (f.caribbeanEv) pills.push({ k: 'caribbeanEv', label: 'Caribbean graduate roster evidence' });
  if (f.usmdEv) pills.push({ k: 'usmdEv', label: 'US MD resident / graduate evidence' });
  if (f.step1Policy) pills.push({ k: 'step1Policy', label: f.step1Policy === 'required' ? 'Step 1 required' : 'No published Step 1 exclusion' });
  if (f.step2Minimum) pills.push({ k: 'step2Minimum', label: `Published Step 2 minimum ≤ ${f.step2Minimum}` });
  if (f.comlex2) pills.push({ k: 'comlex2', label: 'COMLEX Level 2 accepted' });
  if (f.attemptsMaximum) pills.push({ k: 'attemptsMaximum', label: `Published policy accommodates ${f.attemptsMaximum} attempt${Number(f.attemptsMaximum) === 1 ? '' : 's'}` });
  if (f.yogWindow) pills.push({ k: 'yogWindow', label: `YOG window ≥ ${f.yogWindow} years or no published cutoff` });
  if (f.usceMode) pills.push({ k: 'usceMode', label: { required: 'USCE required', recommended: 'USCE recommended', unpublished: 'No published USCE requirement' }[f.usceMode] });
  if (f.minImgPct) pills.push({ k: 'minImgPct', label: `IMG roster/composition ≥ ${f.minImgPct}%` });
  if (f.minDoPct) pills.push({ k: 'minDoPct', label: `DO roster/composition ≥ ${f.minDoPct}%` });
  if (f.sameSchool) pills.push({ k: 'sameSchool', label: 'Residents from my medical school' });
  if (f.sameCountry) pills.push({ k: 'sameCountry', label: 'Residents from my school country' });
  if (f.fellowships) pills.push({ k: 'fellowships', label: 'In-house fellowships published' });
  if (f.fresh) pills.push({ k: 'fresh', label: f.fresh });
  return pills;
}
window.dropPill = k => {
  const f = state.find;
  if (k === 'q') f.q = ''; if (k === 'specialty') f.specialty = ''; if (k === 'state') f.state = ''; if (k === 'residentSchool') f.residentSchool = ''; if (k === 'soap') { f.soap = false; f.soapTrack = ''; }
  if (k === 'abim') f.abim = false; if (k === 'depth') f.depth = ''; if (k === 'visaMode') f.visaMode = '';
  if (k === 'imgEv') f.imgEv = false; if (k === 'doEv') f.doEv = false; if (k === 'caribbeanEv') f.caribbeanEv = false; if (k === 'usmdEv') f.usmdEv = false; if (k === 'fresh') f.fresh = '';
  if (['step1Policy','step2Minimum','attemptsMaximum','yogWindow','usceMode','minImgPct','minDoPct'].includes(k)) f[k] = '';
  if (['comlex2','sameSchool','sameCountry','fellowships'].includes(k)) f[k] = false;
  state.find.shown = 50; rerender();
};
window.clearFilters = () => { Object.assign(state.find, { q: '', specialty: '', state: '', residentSchool: '', soap: false, soapTrack: '', abim: false, depth: '', fresh: '', visaMode: '', imgEv: false, doEv: false, caribbeanEv: false, usmdEv: false, step1Policy: '', step2Minimum: '', comlex2: false, attemptsMaximum: '', yogWindow: '', usceMode: '', minImgPct: '', minDoPct: '', sameSchool: false, sameCountry: false, fellowships: false, shown: 50 }); rerender(); };

function sigIMG(p, f) {
  if (p.filterIntelligence.residentEvidence.img) return `<span class="sig" title="Program-reported resident or graduate composition, or approved roster evidence. Observation, not admissions policy."><b>IMG ✓</b><span style="color:var(--dim)"> ${esc(p.intelligence.imgGraduatesPercent || 'reported')}</span></span>`;
  return `<span class="sig dimmed" title="No current filterable IMG resident or graduate evidence">IMG —</span>`;
}
function sigVisa(p) {
  const visa = p.filterIntelligence.visa;
  const listed = [visa.j1 ? 'J-1' : '', visa.h1b ? 'H-1B' : ''].filter(Boolean);
  if (listed.length) return `<span class="sig" title="Explicit published sponsorship evidence"><b>${listed.join(' · ')}</b><span style="color:var(--dim)"> published</span></span>`;
  if (visa.any) return `<span class="sig" title="Published visa evidence is available; J-1 or H-1B sponsorship is not established"><b>Visa ✓</b><span style="color:var(--dim)"> evidence</span></span>`;
  return p.intelligence.visaSponsorship != null
    ? `<span class="sig dimmed">○ no published sponsorship</span>`
    : `<span class="sig dimmed">○ visa not yet researched</span>`;
}
function sigSOAP(p) {
  if (!p.soap.length) return '';
  const n = soapN(p);
  return `<span class="sig" title="SOAP ${p.soap[0].year}: ${p.soap.map(s => s.track + ' ' + s.positions).join(', ')}"><b style="color:var(--gn)">SOAP ✓</b><span style="color:var(--dim)"> ${n}</span></span>`;
}

function researchDepthChip(p) {
  const labels = { deep: 'Deep Research', enriched: 'Enriched Research', basic: 'Basic Profile', pending: 'Research Pending' };
  return `<span class="evidenceChip depth-${esc(p.filterIntelligence.researchDepth)}">${labels[p.filterIntelligence.researchDepth] || 'Research Pending'} · ${p.filterIntelligence.approvedDomainCount} verified domains</span>`;
}

function filterMatchEvidence(p) {
  const chips = [researchDepthChip(p)];
  const evidence = p.filterIntelligence.residentEvidence;
  if ((state.find.imgEv || evidence.img) && evidence.img) chips.push(`<span class="evidenceChip">IMG resident/graduate evidence${p.intelligence.imgGraduatesPercent ? ` · ${esc(p.intelligence.imgGraduatesPercent)}` : ''}</span>`);
  if ((state.find.doEv || evidence.do) && evidence.do) chips.push(`<span class="evidenceChip">DO resident/graduate evidence${p.intelligence.doGraduatesPercent ? ` · ${esc(p.intelligence.doGraduatesPercent)}` : ''}</span>`);
  if ((state.find.usmdEv || evidence.usmd) && evidence.usmd) chips.push(`<span class="evidenceChip">US MD resident/graduate evidence${p.intelligence.usmdGraduatesPercent ? ` · ${esc(p.intelligence.usmdGraduatesPercent)}` : ''}</span>`);
  if (state.find.caribbeanEv && evidence.caribbean) chips.push('<span class="evidenceChip">Caribbean roster evidence</span>');
  return `<span class="matchReasons">${chips.join('')}</span>`;
}

function applicationIndicator(p, key) {
  const a = p.application || {};
  const depth = { deep: 'Deep Research', enriched: 'Enriched Research', basic: 'Basic Profile', pending: 'Research Pending' }[p.filterIntelligence.researchDepth] || 'Research Pending';
  if (key === 'visa') return ['Visa', a.visa?.j1 || a.visa?.h1b ? [a.visa.j1 ? 'J-1' : '', a.visa.h1b ? 'H-1B' : ''].filter(Boolean).join(' · ') + ' published' : (a.visa?.summary || 'Not yet researched')];
  if (key === 'exams') return ['Exams', a.exams?.step2Minimum != null ? `Step 2 minimum ${a.exams.step2Minimum}` : a.exams?.comlexLevel2Accepted ? 'COMLEX Level 2 accepted' : 'No numeric cutoff published'];
  if (key === 'yog') return ['YOG', a.yog?.noPublishedCutoff ? 'No published cutoff' : a.yog?.years != null ? `${a.yog.years}-year window` : 'Not published'];
  if (key === 'usce') return ['USCE', a.usce?.required ? 'Required' : a.usce?.recommended ? 'Recommended' : a.usce?.published ? 'Published policy' : 'Not published'];
  if (key === 'composition') {
    const img = a.roster?.composition?.IMG_NON_CARIBBEAN?.percent ?? a.roster?.registryComposition?.img;
    const value = img != null ? `IMG ${img}%` : a.roster?.total ? `${a.roster.total} roster entries` : 'Not yet classified';
    return ['Residents', value];
  }
  if (key === 'research_depth') return ['Research', depth];
  if (key === 'attempts') return ['Attempts', a.exams?.maxAttempts != null ? `Published max ${a.exams.maxAttempts}` : 'Not published'];
  if (key === 'same_school') return ['Your school', a.roster?.sameSchoolCount ? `${a.roster.sameSchoolCount} roster match${a.roster.sameSchoolCount === 1 ? '' : 'es'}` : 'No supported match'];
  if (key === 'same_country') return ['School country', a.roster?.sameCountryCount ? `${a.roster.sameCountryCount} roster match${a.roster.sameCountryCount === 1 ? '' : 'es'}` : 'No supported match'];
  if (key === 'fellowships') return ['Fellowships', a.fellowshipCount ? `${a.fellowshipCount} published` : 'Not yet verified'];
  if (key === 'soap') return ['SOAP 2026', p.soap.length ? `${soapN(p)} reported position${soapN(p) === 1 ? '' : 's'}` : 'No appearance'];
  return [key.replaceAll('_', ' '), 'Unknown'];
}

function applicationCardSnapshot(p, limit = 6) {
  const fields = (state.applicationPreferences.cardFields || []).slice(0, limit);
  return `<span class="applicationMiniGrid">${fields.map(key => { const [label, value] = applicationIndicator(p, key); return `<span><b>${esc(label)}</b>${esc(value)}</span>`; }).join('')}</span>`;
}

function applicationMatchReasons(p) {
  if (state.find.mode !== 'profile' || !state.applicationPreferences.personalizationEnabled
    || !D.profile.available || !p.applicationMatch) return '';
  const groups = [['blockers','Known blocker'],['cautions','Caution'],['positives','Positive'],['unknowns','Unknown']];
  const cards = groups.flatMap(([key,label]) => (p.applicationMatch[key] || []).slice(0, key === 'unknowns' ? 1 : 2).map(item => `<span class="matchSignal is-${key}"><b>${label}</b>${esc(item.title)}</span>`));
  return cards.length ? `<span class="applicationMatchReasons">${cards.join('')}</span>` : '';
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
      ${filterMatchEvidence(p)}
      ${applicationCardSnapshot(p)}
      ${applicationMatchReasons(p)}
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
    ${filterMatchEvidence(p)}
    ${applicationCardSnapshot(p)}
    ${applicationMatchReasons(p)}
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
    </div><div class="covBanner">SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.</div>` : '';
  return `<div class="view" data-view="find">
    <p class="eyebrow">Find Programs</p>
    <h1 class="h1"><em>${list.length}</em> ${f.soap ? 'SOAP 2026 ' : ''}${f.specialty || 'residency'} programs</h1>
    <form class="centralProgramSearch" role="search" onsubmit="applyFindSearch(event)">
      <span aria-hidden="true">⌕</span>
      <input id="centralProgramSearch" type="search" value="${esc(f.q)}" autocomplete="off" aria-label="Search residency programs" placeholder="Search programs, hospitals, institutions, cities, states, specialties, or ACGME IDs…" oninput="queueFindSearch(this)">
      ${f.q ? '<button type="button" class="centralSearchClear" aria-label="Clear program search" onclick="state.find.q=\'\';state.find.shown=50;rerender()">Clear</button>' : ''}
      <button type="submit" class="rowBtn pri">Search</button>
    </form>
    <div class="modeSeg" role="radiogroup" aria-label="Search mode">
      ${[['criteria', 'Set criteria'], ['profile', 'Use my profile'], ['cv', 'Use my CV']].map(([k, l]) => `<button role="radio" aria-checked="${f.mode === k}" class="${f.mode === k ? 'on' : ''}" onclick="setMode('${k}')">${l}</button>`).join('')}
    </div>
    ${f.mode === 'profile' ? `<div class="profileIntelligenceCallout"><div><b>${state.applicationPreferences.personalizationEnabled ? 'Personalized application intelligence is on' : 'Personalized application intelligence is off'}</b><span>${D.profile.available ? 'RISE compares only supported published program facts with your canonical Matrix profile. It does not calculate match probability.' : 'Matrix is unavailable, so RISE is showing evidence without personalized conclusions.'}</span></div><div><button class="rowBtn" onclick="setApplicationPersonalization(${!state.applicationPreferences.personalizationEnabled})">Turn ${state.applicationPreferences.personalizationEnabled ? 'off' : 'on'}</button><button class="rowBtn pri" onclick="openApplicationPreferences()">Customize cards</button></div></div>` : ''}
    ${soapSeg}
    <div class="filterRow">
      <select class="fSel" aria-label="Specialty" onchange="state.find.specialty=this.value;state.find.shown=50;rerender()">
        <option value="">All specialties</option>${SPECIALTIES.map(s => `<option value="${esc(s)}" ${f.specialty === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <select class="fSel" aria-label="State" onchange="state.find.state=this.value;state.find.shown=50;rerender()">
        <option value="">All states</option>${STATES.map(s => `<option value="${s}" ${f.state === s ? 'selected' : ''}>${stateNames[s] || s}</option>`).join('')}</select>
      <button class="fBtn ${f.imgEv ? 'on' : ''}" onclick="state.find.imgEv=!state.find.imgEv;state.find.shown=50;rerender()" title="Program-reported resident or graduate composition, or approved roster evidence. Observation, not policy.">IMG evidence <span class="fCount">${filterOptionCount({ imgEv: true }).toLocaleString()}</span></button>
      <button class="fBtn ${f.visaMode === 'any' ? 'on' : ''}" onclick="state.find.visaMode=state.find.visaMode==='any'?'':'any';state.find.shown=50;rerender()">Visa published <span class="fCount">${filterOptionCount({ visaMode: 'any' }).toLocaleString()}</span></button>
      <button class="fBtn" onclick="openFilterDrawer()">More filters ${pills.length > (f.q ? 1 : 0) + (f.state ? 1 : 0) ? `<span class="badge">${pills.length}</span>` : ''}</button>
      ${pills.length ? `<button class="clearF" onclick="clearFilters()">Clear filters</button>` : ''}
    </div>
    ${pills.length ? `<div class="pillRow">${pills.map(p => `<span class="pill">${esc(p.label)}<button class="x" aria-label="Remove filter ${esc(p.label)}" onclick="dropPill('${p.k}')">✕</button></span>`).join('')}</div>` : ''}
    <div class="listBar">
      <select class="fSel" aria-label="Sort" onchange="state.find.sort=this.value;rerender()">
        ${[['fit', 'Sort: Best fit for me'], ['name', 'Sort: Program name A–Z'], ['state', 'Sort: State'], ['abim', 'Sort: ABIM pass rate (verified)'], ['updated', 'Sort: Recently updated'], ['soap', 'Sort: SOAP history']].map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="countNote">Showing ${shown.length} of ${list.length}</span>
      <div class="viewToggle" role="radiogroup" aria-label="View">
        <button class="${f.view === 'list' ? 'on' : ''}" onclick="state.find.view='list';rerender()">☰ List</button>
        <button class="${f.view === 'grid' ? 'on' : ''}" onclick="state.find.view='grid';rerender()">▦ Grid</button>
      </div>
    </div>
    <div class="covBanner">Filters use current canonical registry fields, approved evidence, and provider-neutral research workflow coverage. Resident evidence is observational, not an admissions-policy claim.</div>
    <div id="results">${shown.length
      ? (f.view === 'list' ? shown.map(p => programRow(p, 'find')).join('') : `<div class="cardGrid">${shown.map(p => programCard(p, 'find')).join('')}</div>`)
      : `<div class="emptyLib"><div class="big">No programs match.</div>Clear a filter, or try the program’s hospital name.<div style="margin-top:14px"><button class="rowBtn pri" onclick="clearFilters()">Clear filters</button></div></div>`}
    </div>
    ${list.length > f.shown ? `<button class="loadMore" onclick="state.find.shown+=50;rerender()">Load 50 more</button>` : ''}
  </div>`;
}
let findSearchTimer = null;
window.applyFindSearch = event => { event.preventDefault(); state.find.q = String(new FormData(event.currentTarget).get('q') || event.currentTarget.querySelector('input')?.value || '').trim(); state.find.shown = 50; rerender(); };
window.queueFindSearch = input => {
  state.find.q = input.value;
  clearTimeout(findSearchTimer);
  findSearchTimer = setTimeout(() => {
    state.find.shown = 50;
    renderMain('find');
    requestAnimationFrame(() => {
      const next = $('#centralProgramSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });
  }, 180);
};
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

window.editMatrixProfile = (focusField = '') => {
  if (!D.profile.available) { toast('Matrix profile integration is unavailable.'); return; }
  const p = D.profile.raw || {};
  const fields = [
    ['first_name','First name','text'], ['last_name','Last name','text'], ['phone_mobile','Phone/mobile','tel'],
    ['current_location','Application-season location','text'], ['medical_school','Medical school','text'],
    ['step1_score','Step 1 / Level 1 score','number'], ['step2_score','Step 2 CK / Level 2 score','number'],
    ['usce_months','USCE months','number']
  ];
  openModal(`<div class="mKicker">Canonical Matrix profile</div><div class="mTitle">Update approved fields</div>
    <div class="mSum">These edits go through RISE to Matrix and are re-read from the canonical owner. Specialty, visa and other controlled fields remain in the full Matrix editor.</div>
    <form id="matrixProfileForm" onsubmit="saveMatrixProfile(event)">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0">${fields.map(([key,label,type]) => `<label style="display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase"><span>${esc(label)}</span><input name="${key}" type="${type}" value="${esc(p[key] ?? '')}" style="width:100%;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--ink);padding:11px 12px" ${focusField === key ? 'autofocus' : ''}></label>`).join('')}</div>
      <div class="mActs"><button class="mBtn pri" type="submit">Save to Matrix</button><button class="mBtn sec" type="button" onclick="location.assign('/member-dashboard/#profile')">Open full Matrix profile</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div>
    </form>`);
};
window.saveMatrixProfile = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const result = await riseFetch('/api/rise/v1/me/profile', { method: 'POST', body: JSON.stringify({ profile, mark_complete: false }) });
    Object.assign(D.profile, profileFromMatrix(result));
    closeModal(); rerender(); toast('Matrix profile updated and re-read.');
  } catch (error) {
    form.querySelector('button[type="submit"]').disabled = false;
    toast(error.message || 'Matrix profile update failed.');
  }
};

const APPLICATION_OPTION_LABELS = Object.freeze({
  visa: 'Visa', exams: 'USMLE / COMLEX', attempts: 'Exam attempts', yog: 'Year of graduation', usce: 'USCE',
  img: 'IMG evidence', do: 'DO evidence', same_school: 'Residents from my school', same_country: 'Residents from my school country',
  location: 'Location', research_depth: 'Research depth', fellowships: 'In-house fellowships', soap: 'SOAP history',
  composition: 'Resident composition',
});
window.setApplicationPersonalization = async enabled => {
  const previous = state.applicationPreferences.personalizationEnabled;
  state.applicationPreferences.personalizationEnabled = enabled;
  fitCache.clear(); rerender();
  try {
    const payload = await riseFetch('/api/rise/v1/me/application-preferences', { method: 'PUT', body: JSON.stringify(state.applicationPreferences) });
    state.applicationPreferences = payload.preferences;
    void recordApplicationEvent('PERSONALIZATION_ENABLED', null, enabled ? 'enabled' : 'disabled');
  } catch (error) {
    state.applicationPreferences.personalizationEnabled = previous;
    fitCache.clear(); rerender(); toast(error.message || 'Could not update personalization.');
  }
};
window.openApplicationPreferences = () => {
  const prefs = state.applicationPreferences;
  const priorityKeys = ['visa','exams','attempts','yog','usce','img','do','same_school','same_country','location','research_depth','fellowships','soap'];
  const cardKeys = ['visa','exams','yog','usce','composition','research_depth','attempts','same_school','same_country','fellowships','soap'];
  openModal(`<div class="mKicker">Application priorities</div><div class="mTitle">Choose what RISE puts first</div><div class="mSum">Select 1–5 priorities and 3–8 card indicators. These preferences are private to your account and never change your canonical Matrix profile.</div><form id="applicationPreferencesForm" onsubmit="saveApplicationPreferences(event)"><fieldset class="preferenceGrid"><legend>My priorities</legend>${priorityKeys.map(key => `<label><input type="checkbox" name="priorities" value="${key}" ${prefs.priorities.includes(key) ? 'checked' : ''}> ${esc(APPLICATION_OPTION_LABELS[key])}</label>`).join('')}</fieldset><fieldset class="preferenceGrid"><legend>Program card indicators</legend>${cardKeys.map(key => `<label><input type="checkbox" name="cardFields" value="${key}" ${prefs.cardFields.includes(key) ? 'checked' : ''}> ${esc(APPLICATION_OPTION_LABELS[key])}</label>`).join('')}</fieldset><div class="mActs"><button class="mBtn pri" type="submit">Save priorities</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div></form>`);
};
window.saveApplicationPreferences = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const next = { ...state.applicationPreferences, priorities: data.getAll('priorities'), cardFields: data.getAll('cardFields') };
  if (next.priorities.length < 1 || next.priorities.length > 5 || next.cardFields.length < 3 || next.cardFields.length > 8) {
    toast('Choose 1–5 priorities and 3–8 card indicators.'); return;
  }
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const payload = await riseFetch('/api/rise/v1/me/application-preferences', { method: 'PUT', body: JSON.stringify(next) });
    state.applicationPreferences = payload.preferences; fitCache.clear(); closeModal(); rerender(); toast('Application priorities saved.');
  } catch (error) { form.querySelector('button[type="submit"]').disabled = false; toast(error.message || 'Could not save priorities.'); }
};

function recordApplicationEvent(eventType, programSpecialtyId = null, dimension = null) {
  return riseFetch('/api/rise/v1/analytics/events', { method: 'POST', body: JSON.stringify({ eventType, programSpecialtyId, dimension }) }).catch(() => null);
}

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

/* ---------- SOAP EXPLORER ---------- */
const soapExplorerState = { q: '', specialty: '', jurisdiction: '', sort: 'positions', shown: 50 };
function soapExplorerPrograms() {
  const q = soapExplorerState.q.trim().toLocaleLowerCase('en-US');
  const positions = p => p.soap.reduce((sum, row) => sum + Number(row.positions || 0), 0);
  const records = D.programs.filter(p => p.soap.length)
    .filter(p => !q || [p.name, p.inst, p.city, p.state, p.specName, p.acgme].filter(Boolean).join(' ').toLocaleLowerCase('en-US').includes(q))
    .filter(p => !soapExplorerState.specialty || p.specName === soapExplorerState.specialty)
    .filter(p => !soapExplorerState.jurisdiction || p.state === soapExplorerState.jurisdiction);
  return records.sort((a, b) => soapExplorerState.sort === 'name'
    ? a.name.localeCompare(b.name)
    : soapExplorerState.sort === 'state'
      ? a.state.localeCompare(b.state) || a.name.localeCompare(b.name)
      : positions(b) - positions(a) || a.name.localeCompare(b.name));
}
window.applySoapSearch = event => {
  event.preventDefault();
  soapExplorerState.q = String(new FormData(event.currentTarget).get('q') || '').trim();
  soapExplorerState.shown = 50;
  rerender();
};
window.setSoapExplorerFilter = (key, value) => {
  soapExplorerState[key] = value;
  soapExplorerState.shown = 50;
  rerender();
};
window.loadMoreSoap = () => { soapExplorerState.shown += 50; rerender(); };
function viewSoapExplorer() {
  const all = D.programs.filter(p => p.soap.length);
  const records = soapExplorerPrograms();
  const shown = records.slice(0, soapExplorerState.shown);
  const specialties = [...new Set(all.map(p => p.specName))].sort();
  const jurisdictions = [...new Set(all.map(p => p.state).filter(Boolean))].sort();
  const specialtyOptions = specialties.map(value => '<option value="' + esc(value) + '" ' + (soapExplorerState.specialty === value ? 'selected' : '') + '>' + esc(value) + '</option>').join('');
  const jurisdictionOptions = jurisdictions.map(value => '<option value="' + esc(value) + '" ' + (soapExplorerState.jurisdiction === value ? 'selected' : '') + '>' + esc(value) + '</option>').join('');
  return '<div class="view soapExplorer" data-view="soap">' +
    '<p class="eyebrow">SOAP Explorer</p>' +
    '<h1 class="h1"><em>' + records.length + '</em> historical SOAP 2026 program' + (records.length === 1 ? '' : 's') + '</h1>' +
    '<div class="soapContext"><b>SOAP 2026</b> — This program appeared in the 2026 SOAP results. SOAP participation reflects the 2026 Match cycle and does not predict future availability or match likelihood.</div>' +
    '<form class="soapSearch" onsubmit="applySoapSearch(event)" role="search"><label class="srOnly" for="soapQuery">Search SOAP 2026 programs</label>' +
    '<input id="soapQuery" name="q" value="' + esc(soapExplorerState.q) + '" placeholder="Program, institution, state, specialty, or ACGME ID"><button class="rowBtn pri" type="submit">Search</button></form>' +
    '<div class="soapFilters"><select class="fSel" aria-label="SOAP specialty" onchange="setSoapExplorerFilter(&quot;specialty&quot;,this.value)"><option value="">All specialties</option>' + specialtyOptions + '</select>' +
    '<select class="fSel" aria-label="SOAP state" onchange="setSoapExplorerFilter(&quot;jurisdiction&quot;,this.value)"><option value="">All states</option>' + jurisdictionOptions + '</select>' +
    '<select class="fSel" aria-label="Sort SOAP results" onchange="setSoapExplorerFilter(&quot;sort&quot;,this.value)"><option value="positions" ' + (soapExplorerState.sort === 'positions' ? 'selected' : '') + '>Sort: reported positions</option><option value="name" ' + (soapExplorerState.sort === 'name' ? 'selected' : '') + '>Sort: program name</option><option value="state" ' + (soapExplorerState.sort === 'state' ? 'selected' : '') + '>Sort: state</option></select>' +
    '<span class="countNote">Showing ' + shown.length + ' of ' + records.length + '</span></div>' +
    '<div id="results">' + (shown.length ? shown.map(p => programRow(p, 'soap')).join('') : '<div class="emptyLib"><div class="big">No SOAP 2026 programs match.</div>Adjust the search or filters.</div>') + '</div>' +
    (records.length > shown.length ? '<button class="loadMore" onclick="loadMoreSoap()">Load 50 more</button>' : '') + '</div>';
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
    <h1 class="h1">RankList <em>IQ</em></h1>
    <p class="sub" style="max-width:680px;margin:8px 0 20px">RankList IQ transforms your saved programs, fit tiers, and verified evidence into a data-informed priority order — presented as its own column alongside your personal rankings, never replacing your judgment.</p>
    <div class="covBanner" style="border-color:rgba(var(--accentGlow),.35);background:rgba(var(--accentGlow),.06)">Activates during Interview Season &bull; October 2026</div>
    ${items.length ? `<div class="tblWrap"><table class="tbl"><caption>Your saved programs — RankList IQ will use these when it activates</caption>
      <tr><th>#</th><th>Program</th><th>Fit</th><th>State</th><th>RankList IQ priority</th></tr>
      ${items.map(({ p, rec }, i) => { const f = computeFit(p); return `<tr><td>${i + 1}</td><td><b>${esc(p.name)}</b><br><span style="color:var(--dim);font-size:14px">${esc(p.city)}, ${p.state}</span></td><td>${f.tier ? (f.tier === 'gold' ? 'Gold Fit' : 'Silver Fit') : '—'} · ${esc(f.line)}</td><td>${rec.state.toLowerCase()}</td><td style="color:var(--dim)">October 2026</td></tr>`; }).join('')}
    </table></div>` : `<div class="emptyLib"><div class="big">No programs to rank yet.</div>Save programs first — the ★ on any row.</div>`}
  </div>`;
}

/* ---------- MY PROFILE ---------- */
function viewProfile() {
  const prof = D.profile;
  return `<div class="view" data-view="profile">
    <p class="eyebrow">My Profile · shared with Matrix</p>
    <h1 class="h1">Your <em>profile</em></h1>
    <p class="sub" style="max-width:680px;margin:8px 0 18px">This is your canonical Matrix profile rendered in RISE — there is no separate RISE profile truth. Approved edits write through the server adapter and are re-read from Matrix.</p>
    <div class="covBanner">${prof.available ? 'Canonical Matrix values only. No representative applicant facts are shown.' : 'Matrix profile integration is unavailable. RISE will not create or display a second profile truth.'}</div>
    <div class="profileIntelligenceCallout"><div><b>Personalized application intelligence</b><span>${state.applicationPreferences.personalizationEnabled ? 'On — blocker, caution, positive, and unknown signals use supported facts only.' : 'Off — RISE will show program evidence without profile-based conclusions.'}</span></div><div><button class="rowBtn" onclick="setApplicationPersonalization(${!state.applicationPreferences.personalizationEnabled})">Turn ${state.applicationPreferences.personalizationEnabled ? 'off' : 'on'}</button><button class="rowBtn pri" onclick="openApplicationPreferences()">Set my priorities</button></div></div>
    <div class="homeGrid">
      <section class="panel"><div class="pHead"><h2 class="h2">Applicant <em>facts</em></h2>${prof.available ? '<button class="pMore" onclick="editMatrixProfile()">Update ▸</button>' : ''}</div>
        <div class="pBody">${prof.facts.map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('')}
        <p class="sub" style="margin-top:12px;font-size:14px">Each fact powers requirement checks across the corpus — e.g. “USMLE Step 2 CK” is used by every published score preference.</p></div>
      </section>
      <div>
        <section class="panel" style="margin-bottom:20px"><div class="pHead"><h2 class="h2">Completeness</h2></div>
          <div class="pBody"><div class="profRow">${ringSVG(prof.completeness)}<div class="profMissing">${prof.missing.map((m, i) => `<button class="missChip" onclick="editMatrixProfile('${esc(prof.missingKeys[i] || '')}')">+ ${esc(m)}</button>`).join('')}</div></div></div>
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
  const count = patch => `<span class="fCount">${filterOptionCount(patch).toLocaleString()}</span>`;
  const caribbeanAvailable = Number(D.filterCounts.caribbeanResidentEvidence || 0) > 0;
  dw.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="More filters">
    <button class="drawerClose" aria-label="Close" onclick="$('#filterDrawer').classList.remove('open')">✕</button>
    <h3>More filters</h3>
    <p class="sub" style="font-size:14px">Every filter states its evidence caveat. Nothing here guesses.</p>
    <div class="fGroup"><div class="fLbl">SOAP</div>
      <button class="tgl ${f.soap ? 'on' : ''}" onclick="state.find.soap=!state.find.soap;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>SOAP 2026 history<span class="cav">Historical cycle evidence; no future availability or match-likelihood inference.</span></span>${count({ soap: true })}</button>
    </div>
    <div class="fGroup"><div class="fLbl">Research depth</div>
      ${[
        ['', 'Any research depth', 'All current canonical programs.'],
        ['deep', 'Deep Research', 'Highest current major research pass with broad domain coverage.'],
        ['enriched', 'Enriched Research', 'At least one meaningful research pass beyond the core profile.'],
        ['basic', 'Basic Profile', 'Strong core registry profile; no substantial completed enrichment yet.'],
        ['pending', 'Research Pending', 'Canonical identity exists; meaningful enrichment is not yet available.'],
      ].map(([k, l, caveat]) => `
        <button class="tgl ${f.depth === k ? 'on' : ''}" onclick="state.find.depth='${k}';openFilterDrawer();rerenderKeepDrawer()"><span class="box">${f.depth === k ? '●' : ''}</span><span>${l}<span class="cav">${caveat}</span></span>${count({ depth: k })}</button>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Resident / graduate evidence</div>
      <button class="tgl ${f.imgEv ? 'on' : ''}" onclick="state.find.imgEv=!state.find.imgEv;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>IMG residents / graduates reported<span class="cav">Program-reported composition or approved roster evidence. Observation, not admissions policy.</span></span>${count({ imgEv: true })}</button>
      <button class="tgl ${f.doEv ? 'on' : ''}" onclick="state.find.doEv=!state.find.doEv;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>DO residents / graduates reported<span class="cav">Independent from Caribbean evidence. Observation, not admissions policy.</span></span>${count({ doEv: true })}</button>
      <button class="tgl ${f.caribbeanEv ? 'on' : ''} ${caribbeanAvailable ? '' : 'unavailable'}" ${caribbeanAvailable ? `onclick="state.find.caribbeanEv=!state.find.caribbeanEv;openFilterDrawer();rerenderKeepDrawer()"` : 'disabled'}><span class="box">✓</span><span>Caribbean graduates on roster<span class="cav">${caribbeanAvailable ? 'Approved canonical roster observations only.' : 'Awaiting approved canonical roster evidence; review-gated research is not exposed.'}</span></span>${count({ caribbeanEv: true })}</button>
      <button class="tgl ${f.usmdEv ? 'on' : ''}" onclick="state.find.usmdEv=!state.find.usmdEv;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>US MD residents / graduates reported<span class="cav">Program-reported composition or approved roster evidence.</span></span>${count({ usmdEv: true })}</button>
      <label class="fLbl" for="residentSchoolFilter" style="margin-top:14px">Resident medical school</label>
      <input id="residentSchoolFilter" class="fSel" style="width:100%" list="residentSchoolOptions" value="${esc(f.residentSchool)}" placeholder="Type a school name or alias" onchange="state.find.residentSchool=this.value.trim();state.find.shown=50;rerenderKeepDrawer()">
      <datalist id="residentSchoolOptions">${RESIDENT_SCHOOLS.map(school => '<option value="' + esc(school) + '"></option>').join('')}</datalist>
      <span class="cav">Matches approved current/recent resident-roster evidence only.</span>
    </div>
    <div class="fGroup"><div class="fLbl">Visa</div>
      ${[
        ['', 'Any visa status', 'No visa evidence filter.'],
        ['j1', 'J-1 sponsorship published', 'Explicit published J-1 sponsorship evidence only.'],
        ['h1b', 'H-1B sponsorship published', 'Explicit published H-1B sponsorship evidence only.'],
        ['either', 'J-1 or H-1B sponsorship published', 'At least one explicitly published sponsorship route.'],
        ['any', 'Any visa sponsorship evidence', 'Any valid published visa evidence; no inference from IMG or ECFMG wording.'],
      ].map(([k, l, caveat]) => `
        <button class="tgl ${f.visaMode === k ? 'on' : ''}" onclick="state.find.visaMode='${k}';openFilterDrawer();rerenderKeepDrawer()"><span class="box">${f.visaMode === k ? '●' : ''}</span><span>${l}<span class="cav">${caveat}</span></span>${count({ visaMode: k })}</button>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Exams & attempts</div>
      <button class="tgl ${f.comlex2 ? 'on' : ''}" onclick="state.find.comlex2=!state.find.comlex2;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>COMLEX Level 2 accepted<span class="cav">Supported published acceptance evidence.</span></span>${count({ comlex2: true })}</button>
      <label class="filterField">Step 1 policy<select class="fSel" onchange="state.find.step1Policy=this.value;openFilterDrawer();rerenderKeepDrawer()"><option value="">Any published state</option><option value="required" ${f.step1Policy === 'required' ? 'selected' : ''}>Published as required</option><option value="not_required_or_unknown" ${f.step1Policy === 'not_required_or_unknown' ? 'selected' : ''}>No published exclusion</option></select></label>
      <label class="filterField">Maximum published Step 2 minimum<input class="fSel" inputmode="numeric" type="number" min="180" max="300" value="${esc(f.step2Minimum)}" placeholder="e.g. 240" onchange="state.find.step2Minimum=this.value;openFilterDrawer();rerenderKeepDrawer()"></label>
      <label class="filterField">My exam attempts<input class="fSel" inputmode="numeric" type="number" min="1" max="12" value="${esc(f.attemptsMaximum)}" placeholder="Published limit must accommodate" onchange="state.find.attemptsMaximum=this.value;openFilterDrawer();rerenderKeepDrawer()"></label>
    </div>
    <div class="fGroup"><div class="fLbl">Graduation & US clinical experience</div>
      <label class="filterField">Graduation window<select class="fSel" onchange="state.find.yogWindow=this.value;openFilterDrawer();rerenderKeepDrawer()"><option value="">Any published state</option>${[1,2,3,5,10].map(years => `<option value="${years}" ${String(f.yogWindow) === String(years) ? 'selected' : ''}>Allows ${years}+ years or no published cutoff</option>`).join('')}</select></label>
      ${[['','Any USCE state'],['required','USCE required'],['recommended','USCE recommended'],['unpublished','No published USCE requirement']].map(([key,label]) => `<button class="tgl ${f.usceMode === key ? 'on' : ''}" onclick="state.find.usceMode='${key}';openFilterDrawer();rerenderKeepDrawer()"><span class="box">${f.usceMode === key ? '●' : ''}</span><span>${label}</span>${count({ usceMode: key })}</button>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Resident composition & connections</div>
      <label class="filterField">Minimum IMG evidence %<input class="fSel" inputmode="numeric" type="number" min="0" max="100" value="${esc(f.minImgPct)}" placeholder="e.g. 20" onchange="state.find.minImgPct=this.value;openFilterDrawer();rerenderKeepDrawer()"></label>
      <label class="filterField">Minimum DO evidence %<input class="fSel" inputmode="numeric" type="number" min="0" max="100" value="${esc(f.minDoPct)}" placeholder="e.g. 10" onchange="state.find.minDoPct=this.value;openFilterDrawer();rerenderKeepDrawer()"></label>
      <button class="tgl ${f.sameSchool ? 'on' : ''}" onclick="state.find.sameSchool=!state.find.sameSchool;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>Residents from my medical school<span class="cav">Exact normalized school match in approved roster evidence.</span></span>${count({ sameSchool: true })}</button>
      <button class="tgl ${f.sameCountry ? 'on' : ''}" onclick="state.find.sameCountry=!state.find.sameCountry;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>Residents from my medical-school country<span class="cav">Country is used only when explicit or conservatively derived from the school.</span></span>${count({ sameCountry: true })}</button>
      <button class="tgl ${f.fellowships ? 'on' : ''}" onclick="state.find.fellowships=!state.find.fellowships;openFilterDrawer();rerenderKeepDrawer()"><span class="box">✓</span><span>In-house fellowships published</span>${count({ fellowships: true })}</button>
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
  void hydrateProgramProfile(p);
}
async function hydrateProgramProfile(p, force = false) {
  if ((!force && p.canonical) || p.profileLoading) return;
  p.profileLoading = true;
  try {
    const [payload, request] = await Promise.all([
      riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(p.id)),
      riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(p.id) + '/research'),
    ]);
    p.canonical = payload.program || null;
    p.researchProjection = payload.research || { currentFacts: [], pendingEvidence: { fields: [], claimCount: 0 } };
    p.researchRequest = request;
    p.url = fieldValue(p, 'Program Website') || p.url;
    p.type = fieldValue(p, 'Program Best Described As') || p.type;
    p.positions = fieldValue(p, 'First Year Positions') || fieldValue(p, 'Residents Per Year') || p.positions;
    p.domains = projectedDomainStates(p);
  } catch (error) {
    p.profileError = error.message || 'Program profile unavailable';
  } finally {
    p.profileLoading = false;
  }
  if (currentRoute().startsWith(`program/${p.id}/`)) {
    const file = $('#file');
    if (file) file.innerHTML = renderFile(p);
  }
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
  const composition = [p.intelligence.imgGraduatesPercent ? `IMG ${p.intelligence.imgGraduatesPercent}` : '', p.intelligence.doGraduatesPercent ? `DO ${p.intelligence.doGraduatesPercent}` : '', p.intelligence.usmdGraduatesPercent ? `US MD ${p.intelligence.usmdGraduatesPercent}` : ''].filter(Boolean);
  const imgSig = p.demo ? 'IMG/DO evidence: <b>strong (demo)</b>' : composition.length ? `Resident/graduate composition: <b>${composition.map(esc).join(' · ')}</b>` : `Resident evidence: <b>${researchStateText(p, 'research.resident_roster')}</b>`;
  const researchedVisa = publishedVisaSummary(p);
  const visaSig = p.demo ? 'Visa: <b>J-1 · H-1B published</b>' : researchedVisa ? `Visa: <b>${esc(researchedVisa)}</b>` : p.intelligence.visaSponsorship != null ? `Visa: <b>${esc(p.intelligence.visaSponsorship)}</b>` : `Visa: <b>${researchStateText(p, 'research.visa')}</b>`;
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
        <div class="fEyebrow">${esc(p.specName)} · ${esc(p.track)} ${p.demo ? '<span class="demoTag">Representative demo data</span>' : ''}${p.depth === 'gold' ? '<span class="demoTag" style="color:var(--gd);border-color:rgba(255,215,106,.5)">Gold dossier · 267 refs</span>' : ''}${p.researchProjection?.dossier?.dossierOutcome === 'DEEP' ? `<span class="demoTag deepCurrent">Deep Research Current ✓ · ${esc(String(p.researchProjection.dossier.researchTimestamp || '').slice(0,10))}</span>` : ''}</div>
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
        ${researchCtaButton(p)}
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

function researchCtaButton(p) {
  const controls = runtime.researchControl;
  if (!controls || !controls.globalEnabled || controls.emergencyKillSwitch) return '';
  if (!state.canAdmin && !controls.studentEnabled) return '';
  if (!(controls.canaryProgramIds || []).includes(p.acgme)) return '';
  const eligibility = p.researchRequest?.eligibility;
  const requestClass = eligibility?.requestClass || 'FULL';
  const labels = {
    FULL: 'Deep Research This Program', DELTA: 'Complete Deep Research',
    REFRESH: 'Refresh This Program', NO_OP: 'Deep Research Current ✓',
    ACTIVE: 'Research already underway',
  };
  const noCharge = requestClass === 'NO_OP' || requestClass === 'ACTIVE';
  return `<button class="fAct researchCta ${requestClass === 'NO_OP' ? 'isCurrent' : ''}" ${requestClass === 'NO_OP' ? 'disabled' : ''} onclick="openResearchRequest('${p.id}')">⚗ ${labels[requestClass] || labels.FULL}</button><span class="researchNoCharge">${noCharge ? 'This will not use one of your requests' : requestClass === 'REFRESH' ? 'Uses 1 Research Request only if meaningful refresh work is needed' : 'Uses 1 Research Request'}</span>`;
}

function quotaMeter(quota = {}) {
  const used = Number(quota.used || 0), limit = Number(quota.quotaLimit || 0);
  const pct = limit ? Math.min(100, Math.round(used / limit * 100)) : 0;
  return `<div class="quotaMeter"><div><b>${used} used</b><span>${Math.max(0, Number(quota.remaining || 0))} remaining</span></div><div class="quotaTrack"><i style="width:${pct}%"></i></div></div>`;
}

function researchStatusCopy(status) {
  return ({ QUEUED:'Queued', RESEARCHING:'Researching', PROCESSING_REVIEWING:'Processing / Reviewing', UPDATED:'Updated', PARTIAL:'Partial', FAILED_REQUEST_RESTORED:'Failed · Request Restored' })[status] || 'Queued';
}

window.openResearchRequest = id => {
  const p = byId.get(id); if (!p) return;
  const eligibility = p.researchRequest?.eligibility || {};
  const requestClass = eligibility.requestClass || 'FULL';
  const active = eligibility.activeJob;
  if (active) {
    openModal(`<div class="mKicker">Deep Research Dossier</div><div class="mTitle">${esc(researchStatusCopy(active.studentStatus))}</div><div class="researchStatusOrb is-active" aria-hidden="true"></div><div class="mSum">Research is already underway for ${esc(p.name)}. The completed improvement is shared automatically with every authorized RISE user.</div>${quotaMeter(eligibility.quota)}<div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    return;
  }
  if (requestClass === 'NO_OP') return;
  openModal(`<div class="mKicker">MissionMed Deep Research</div><div class="mTitle">Research this program?</div><div class="mSum"><b>Use one of your Research Requests to have RISE perform a comprehensive research pass on this program.</b></div><div class="researchPromise"><b>RISE will investigate</b><span>Visa sponsorship and application requirements</span><span>USMLE / COMLEX, attempts, YOG, USCE and ECFMG policies</span><span>Current residents, medical schools and roster composition evidence</span><span>Leadership, core faculty and training paths</span><span>Fellowships, board performance and graduate outcomes</span><span>Curriculum, research, culture, facilities and program-specific differentiators</span></div><div class="mKicker quotaHeading">Your Research Requests</div>${quotaMeter(eligibility.quota)}<div class="requestCost"><b>Before you use a request:</b> Research Requests are most valuable for programs you are genuinely considering. If this program is already deeply researched, or another student has already requested the same work, you will not be charged another request.</div><div class="mSum researchQuestion"><b>Are you sure you want RISE to research this program further?</b></div><div class="mActs"><button class="mBtn pri" onclick="confirmProgramResearch('${p.id}')">Research This Program</button><button class="mBtn sec" onclick="closeModal()">Not Yet</button></div>`);
};

window.confirmProgramResearch = async id => {
  const p = byId.get(id); if (!p) return;
  try {
    const payload = await riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(id) + '/research', {
      method: 'POST', body: JSON.stringify({ source: state.canAdmin ? 'ADMIN' : 'STUDENT' }),
    });
    await hydrateProgramProfile(p, true);
    const studentStatus = payload.job?.studentStatus || (payload.noOp ? 'UPDATED' : 'QUEUED');
    openModal(`<div class="mKicker">Deep Research Dossier</div><div class="mTitle">${esc(researchStatusCopy(studentStatus))}</div><div class="researchStatusOrb ${studentStatus === 'UPDATED' ? 'is-done' : 'is-active'}" aria-hidden="true"></div><div class="mSum">${payload.deduplicated ? 'This shared research was already current or underway. No duplicate request was used.' : 'Your request is reserved and the production research worker will continue in the background.'}</div>${quotaMeter(payload.quota)}<div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    if (!payload.noOp && studentStatus !== 'UPDATED') setTimeout(() => hydrateProgramProfile(p, true), 6000);
  } catch (error) { toast(error.message || 'Research request unavailable.'); }
};

/* ---------- tab bodies ---------- */
function fieldClaim(p, name) { return p.canonical?.fields?.[name] || null; }
function fieldValue(p, name) {
  const claim = fieldClaim(p, name);
  return claim?.knowledge?.state === 'known' ? claim.knowledge.value : null;
}
function displayValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (Array.isArray(value)) return value.map(displayValue).join(' · ');
  if (value && typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key.replaceAll('_', ' ')}: ${displayValue(item)}`).join(' · ');
  return String(value ?? '');
}
function approvedResearchFact(p, field) {
  return (p.researchProjection?.currentFacts || []).find(fact => fact.field === field) || null;
}
function publishedVisaSummary(p) {
  const fact = approvedResearchFact(p, 'research.visa');
  if (!fact) return '';
  const value = fact.canonicalValue ?? fact.knowledge?.value;
  const supported = Array.isArray(value?.supported) ? value.supported.map(String) : [];
  const labels = [];
  if (value?.j1 === true || supported.some(item => /\bJ-?1\b/i.test(item))) labels.push('J-1');
  if (value?.h1b === true || supported.some(item => /\bH-?1B\b/i.test(item))) labels.push('H-1B');
  return labels.length ? `${labels.join(' · ')} sponsorship published` : 'Verified visa policy available';
}
function pendingResearchField(p, field) {
  return (p.researchProjection?.pendingEvidence?.fields || []).find(item => item.field === field) || null;
}
function researchStateText(p, field) {
  if (approvedResearchFact(p, field)) return 'Verified';
  const pending = pendingResearchField(p, field);
  const dispositions = new Set(pending?.dispositions || []);
  if (dispositions.has('CONFLICT_REQUIRES_REVIEW')) return 'Conflicting published information · under review';
  if (dispositions.has('STALE_NEEDS_REFRESH')) return 'Research needs refresh';
  if (dispositions.has('IDENTITY_AMBIGUITY')) return 'Evidence found · identity verification pending';
  if (dispositions.has('APPROVED_HISTORICAL')) return 'Historical evidence available · current status not established';
  if (dispositions.has('RESEARCHED_NOT_FOUND')) return 'No published policy found';
  if (dispositions.has('INSUFFICIENT_EVIDENCE')) return 'Research reviewed · no supportable published value';
  if (pending) return 'Evidence found · verification pending';
  return p.profileLoading ? 'Loading…' : 'Not yet researched';
}
const DOMAIN_RESEARCH_FIELDS = {
  identity: ['research.program_overview'], visa: ['research.visa'], requirements: ['research.application_requirements'],
  roster: ['research.resident_roster'], resident_schools: ['research.resident_medical_schools'],
  composition: ['research.img_accessibility','research.do_accessibility','research.usmd_accessibility','research.caribbean_accessibility'],
  leadership: ['research.leadership'], faculty: ['research.core_faculty'], training_paths: ['research.faculty_training_graph'],
  board: ['research.abim'], fellowship: ['research.fellowship_inventory'], outcomes: ['research.outcomes'],
  salary: ['research.salary_benefits'], curriculum: ['research.curriculum'], scholarly: ['research.research_opportunities'],
  differentiators: ['research.program_differentiators'], culture: ['research.culture'], facilities: ['research.facilities_patient_population'],
};
const DOMAIN_REGISTRY_FIELDS = {
  roster: ['IMG Graduates Percent', 'DO Graduates Percent', 'US MD Graduates Percent', 'Total Residents'],
  leadership: ['Program Director', 'Program Coordinator'],
  requirements: ['Step Preferences', 'COMLEX Accepted', 'Medical School Graduation Timeline', 'Gap Experience Requirement', 'Minimum LOR', 'Maximum LOR'],
  visa: ['Visa Sponsorship', 'J1', 'H1B'], salary: ['Salary PGY1', 'Benefits', 'Vacation'],
  fellowship: [], outcomes: [],
};
function projectedDomainStates(p) {
  return Object.fromEntries(Object.keys(DOMAIN_RESEARCH_FIELDS).map(domain => {
    const dossierKey = ({ identity:'identity_structure', requirements:'application_requirements', roster:'current_resident_roster', resident_schools:'resident_medical_schools', composition:'resident_composition', leadership:'program_leadership', faculty:'core_faculty', training_paths:'trained_here_retention', board:'board_pass_rate', fellowship:'in_house_fellowships', outcomes:'graduate_outcomes', salary:'salary_benefits', curriculum:'curriculum_training', scholarly:'research_scholarly', differentiators:'program_differentiators', culture:'culture_resident_experience', facilities:'facilities_patient_population' })[domain] || domain;
    const dossierState = p.researchProjection?.dossier?.completionMatrix?.[dossierKey]?.state;
    if (dossierState) return [domain, dossierState];
    const researchFields = DOMAIN_RESEARCH_FIELDS[domain];
    if (researchFields.some(field => approvedResearchFact(p, field))) return [domain, 'VERIFIED'];
    if ((DOMAIN_REGISTRY_FIELDS[domain] || []).some(field => fieldValue(p, field) != null)) return [domain, 'VERIFIED_REGISTRY'];
    if (researchFields.some(field => pendingResearchField(p, field))) return [domain, 'EVIDENCE_FOUND_NOT_VERIFIED'];
    return [domain, 'NOT_RESEARCHED'];
  }));
}
function registryFactRows(p, fields) {
  return fields.map(name => ({ name, value: fieldValue(p, name), claim: fieldClaim(p, name) })).filter(row => row.value != null);
}
function registryTable(p, fields, caption = 'Published program information') {
  const rows = registryFactRows(p, fields);
  if (!rows.length) return `<p class="sub">No approved published values are currently available for this section.</p>`;
  return `<div class="tblWrap"><table class="tbl"><caption>${esc(caption)}</caption><tr><th>Field</th><th>Published value</th><th>Source date</th></tr>${rows.map(row => `<tr><td><b>${esc(row.name)}</b></td><td>${esc(displayValue(row.value))}</td><td>${esc(row.claim?.sourceUpdatedAt || row.claim?.retrievedAt || p.verified || 'Not stated')}</td></tr>`).join('')}</table></div>`;
}
function approvedResearchTable(p, fields, caption = 'Approved research evidence') {
  const rows = fields.map(field => approvedResearchFact(p, field)).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="tblWrap"><table class="tbl"><caption>${esc(caption)}</caption><tr><th>Domain</th><th>Approved current value</th><th>Verified / retrieved</th></tr>${rows.map(row => `<tr><td><b>${esc(row.field.replace(/^research\./, '').replaceAll('_', ' '))}</b></td><td>${esc(displayValue(row.canonicalValue ?? row.knowledge?.value))}</td><td>${esc(row.retrievedAt || 'Not stated')}</td></tr>`).join('')}</table></div>`;
}

function unknownFooter(p, extra) {
  const map = { NOT_PUBLICLY_FOUND: 'Not published by the program', NOT_RESEARCHED: 'Not yet researched', EVIDENCE_FOUND_NOT_VERIFIED: 'Evidence found · verification pending', VERIFIED_REGISTRY: 'Approved registry evidence', INTERNAL_CONTEXT_NOT_REVERIFIED: 'Not yet verified by RISE', NOT_PUBLICLY_FOUND_OR_NOT_EXHAUSTIVELY_VERIFIED: 'Not yet verified by RISE', ROSTER_COLLECTION_NOT_EXECUTED_PRIVACY_DECISION_NOT_MATERIALIZED: 'Held for privacy review', VERIFIED_PARTIAL_CURRENT_OFFICIAL: 'Partially verified', PARTIAL: 'Partially verified', DEMO: 'Representative demo' };
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

function applicationIntelligenceSection(p) {
  const keys = [...new Set([...(state.applicationPreferences.priorities || []), ...(state.applicationPreferences.cardFields || [])])].slice(0, 10);
  const groups = p.applicationMatch || { blockers: [], cautions: [], positives: [], unknowns: [] };
  const personalized = state.applicationPreferences.personalizationEnabled && state.find.mode === 'profile'
    && D.profile.available && p.applicationMatch;
  const groupCopy = { blockers: 'Known blockers', cautions: 'Cautions', positives: 'Positive signals', unknowns: 'Unknowns' };
  return `<section class="applicationSnapshot"><div class="applicationSnapshotHead"><div><p class="eyebrow">Application intelligence</p><h2 class="h2">What matters <em>for your application</em></h2></div><button class="rowBtn" onclick="openApplicationPreferences()">Customize</button></div><div class="applicationSnapshotGrid">${keys.map(key => { const [label,value] = applicationIndicator(p,key); return `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }).join('')}</div>${personalized ? `<div class="applicationReasonGroups">${Object.entries(groupCopy).map(([key,label]) => `<section class="is-${key}"><h3>${label} <span>${groups[key]?.length || 0}</span></h3>${groups[key]?.length ? groups[key].slice(0,4).map(item => `<div><b>${esc(item.title)}</b><p>${esc(item.detail)}</p></div>`).join('') : '<p>None supported by current evidence.</p>'}</section>`).join('')}</div><div class="lawBanner">These are evidence-backed application signals, not a match probability. “Unknown” never means accepted.</div>` : `<div class="lawBanner">Personalized conclusions are off. Program evidence remains visible.</div>`}</section>`;
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

function whyProgramSection(p) {
  const differentiators = approvedResearchFact(p, 'research.program_differentiators');
  const curriculum = approvedResearchFact(p, 'research.curriculum');
  const culture = approvedResearchFact(p, 'research.culture');
  const facilities = approvedResearchFact(p, 'research.facilities_patient_population');
  const value = differentiators?.canonicalValue ?? differentiators?.knowledge?.value;
  const entries = evidenceRows(value, ['differentiators','items','reasons','features']).filter(item => item && typeof item === 'object').slice(0, 12);
  const supporting = [curriculum, culture, facilities].filter(Boolean);
  const cards = entries.length ? entries.map(item => `<article class="railCard whyEvidenceCard">
    <div class="rLbl">${esc(String(item.category || 'Program feature').replaceAll('_', ' '))}</div>
    <h3>${esc(item.title || 'Verified program differentiator')}</h3>
    <p>${esc(item.detail || '')}</p>
    ${item.applicant_relevance ? `<div class="whyWhy">Why it may matter: ${esc(item.applicant_relevance)}</div>` : ''}
    <span>${item.source_url ? `<a href="${esc(item.source_url)}" target="_blank" rel="noopener">Official source ↗</a> · ` : ''}${esc(item.retrieved_at || differentiators.retrievedAt || 'Date not stated')}</span>
  </article>`).join('') : supporting.map(row => `<article class="railCard"><div class="rLbl">${esc(row.field.replace(/^research\./,'').replaceAll('_',' '))}</div><p>${esc(displayValue(row.canonicalValue ?? row.knowledge?.value))}</p><span>${esc(row.retrievedAt || 'Date not stated')}</span></article>`).join('');
  return `<section class="whyProgramSection"><h2 class="h2" style="margin-bottom:8px">Why this <em>program</em></h2><p class="sub">Source-backed differentiators and training features from the current shared dossier. Use these as research leads, then confirm fit in your own voice.</p>${cards ? `<div class="whyCards">${cards}</div>${entries.length && entries.length < 5 ? '<div class="gateNote">The dossier currently supports fewer than five distinct differentiators; RISE will not pad the list with generic claims.</div>' : ''}` : `<div class="lawBanner"><b>Not yet available.</b> Verified program differentiators will appear here after the dossier is completed and reviewed.</div>`}</section>`;
}

function tabOverview(p, R) {
  if (!R) {
    return `${applicationIntelligenceSection(p)}<div class="fileGrid"><div>
      <h2 class="h2" style="margin-bottom:8px">Approved program <em>profile</em></h2>
      ${p.profileLoading ? '<p class="sub">Loading the full approved program profile…</p>' : p.profileError ? `<div class="lawBanner">${esc(p.profileError)}</div>` : registryTable(p, ['Program Best Described As', 'Program Length', 'First Year Positions', 'Residents Per Year', 'Total Residents', 'Application Deadline', 'Applicant Interview Format', 'Application Service'], 'Approved canonical registry facts')}
      ${approvedResearchTable(p, ['research.curriculum', 'research.program_overview'], 'Approved current research')}
      ${whyProgramSection(p)}
      <div class="lawBanner"><b>Research status:</b> ${p.filterIntelligence.researchState === 'EVIDENCE_FOUND_VERIFICATION_PENDING' ? 'Additional evidence exists and is awaiting verification. Approved registry facts remain available now.' : 'Additional domain research has not yet been verified.'}</div>
      ${p.soap.length ? `<div class="lawBanner">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} reported position${s.positions > 1 ? 's' : ''}`).join(' · ')}. Historical cycle evidence; no future availability or match-likelihood inference.</div>` : ''}
      ${unknownFooter(p, ['Narrative differentiators — not yet verified'])}
    </div><div>${snapshotRail(p)}</div></div>`;
  }
  return `${applicationIntelligenceSection(p)}<div class="fileGrid"><div>
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
  if (/^VERIFIED_REGISTRY$/.test(v)) return `<span class="freshPill fp-cycle"><i></i>Approved registry evidence</span>`;
  if (/^EVIDENCE_FOUND_NOT_VERIFIED$/.test(v)) return `<span style="color:var(--check);font-size:13.5px">Evidence found · verification pending</span>`;
  if (/PRIOR_CYCLE/.test(v)) return `<span class="freshPill fp-old"><i></i>Prior cycle</span>`;
  if (/PARTIAL/.test(v)) return `<span class="freshPill fp-cycle"><i></i>Partially verified</span>`;
  if (/DEMO/.test(v)) return `<span class="demoTag">Demo</span>`;
  if (/PRIVACY/.test(v)) return `<span style="color:var(--vi);font-size:13.5px">Privacy hold</span>`;
  return `<span style="color:var(--dim);font-size:13.5px">Not yet researched</span>`;
}
function snapshotRail(p) {
  return `<div class="railCard"><div class="rLbl">Snapshot</div>
    ${[['Type', p.type || 'Not published'], ['Length', fieldValue(p, 'Program Length') || p.intelligence.programLength || 'Not published'], ['First-year positions', fieldValue(p, 'First Year Positions') || p.intelligence.firstYearPositions || 'Not published'], ['Total residents', fieldValue(p, 'Total Residents') || p.intelligence.totalResidents || 'Not published'], ['ACGME ID', p.acgme || 'Not published'], ['Official site', p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">program website ↗</a>` : 'Not recovered']].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
  </div>
  ${p.rich && p.rich.people ? `<div class="railCard"><div class="rLbl">People</div>
    ${p.rich.people.slice(0, 3).map(x => `<div class="kv"><span class="k">${esc(x.role.split('·')[0].replace('Program Director', 'PD').replace('Associate PD', 'APD'))}</span><span class="v">${esc(x.n)}</span></div>`).join('')}
    <button class="rowBtn" style="margin-top:10px" onclick="setFileTab('${p.id}','people')">All people →</button></div>` : ''}`;
}

function tabFit(p, R) {
  if (!R) {
    return `<div>${applicationIntelligenceSection(p)}
      <div class="lawBanner"><b>Not published means the program hasn’t said.</b> RISE does not guess. Absence of a restriction is not acceptance.</div>
      <h2 class="h2" style="margin:20px 0 8px">Application requirements</h2>
      ${registryTable(p, ['Step Preferences', 'COMLEX Accepted', 'IMG Step 1 Required', 'IMG Step 2 Required', 'DO COMLEX Level 1 Required', 'DO COMLEX Level 2 Required', 'Minimum LOR', 'Maximum LOR', 'Specialty Specific LOR Required', 'Medical School Graduation Timeline', 'Gap Experience Requirement', 'Required Supplemental Information', 'Application Deadline'], 'Program-reported requirements')}
      <h2 class="h2" style="margin:24px 0 8px">Visa</h2>
      ${registryTable(p, ['Visa Sponsorship', 'J1', 'H1B', 'F1 OPT First Year'], 'Program-reported visa information')}
      ${approvedResearchTable(p, ['research.application_requirements', 'research.visa'], 'Approved application research')}
      ${pendingResearchField(p, 'research.application_requirements') ? '<div class="gateNote">Additional application evidence found · verification pending.</div>' : ''}
      ${pendingResearchField(p, 'research.visa') ? '<div class="gateNote">Additional visa evidence found · verification pending.</div>' : ''}
      ${p.soap.length ? `<h2 class="h2" style="margin:20px 0 8px">SOAP history</h2><p class="sub">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} reported positions`).join(' · ')} <i>(NRMP dataset)</i>. Historical evidence, not a promise.</p>` : ''}
      ${unknownFooter(p)}
    </div>`;
  }
  const rows = R.requirements;
  const counts = computeFit(p).counts || { meets: 0, check: 0, unknown: 0 };
  return `<div>${applicationIntelligenceSection(p)}
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
    ${p.soap.length ? `<h2 class="h2" style="margin:24px 0 8px">SOAP history</h2><p class="sub">SOAP ${p.soap[0].year}: ${p.soap.map(s => `${s.track} — ${s.positions} reported positions`).join(' · ')} (NRMP). Historical evidence, not a promise.</p>` : ''}
    <h2 class="h2" style="margin:24px 0 8px">Interview & signals</h2>
    <p class="sub">${p.demo ? 'Interview evidence is not published.' : 'Interview format and signaling are not yet verified for this program.'}</p>
    <button class="rowBtn" style="margin-top:8px" onclick="toast('CAM handoff seam — interview prep opens with this program’s verified facts.')">◇ Use for Interview Prep</button>
    ${unknownFooter(p)}
  </div>`;
}

function approvedResearchValue(p, field) {
  const fact = approvedResearchFact(p, field);
  return fact ? (fact.canonicalValue ?? fact.knowledge?.value ?? null) : null;
}

function evidenceRows(value, keys = []) {
  if (Array.isArray(value)) return value.flatMap(item => Array.isArray(item) ? evidenceRows(item, keys) : [item]).filter(Boolean);
  if (!value || typeof value !== 'object') return value == null ? [] : [value];
  const prioritized = keys.filter(key => ['full_roster','residents','roster'].includes(key)).find(key => Array.isArray(value[key]));
  if (prioritized) return evidenceRows(value[prioritized], keys);
  const nested = keys.filter(key => Array.isArray(value[key])).flatMap(key => evidenceRows(value[key], keys));
  if (nested.length) return nested;
  return [value];
}

function genericRosterTable(p) {
  const value = approvedResearchValue(p, 'research.resident_roster');
  const rows = evidenceRows(value, ['full_roster','residents','roster','pgy_1','pgy_2','pgy_3','pgy_4','pgy4_chiefs','pgy3_chiefs','other_residents_identified'])
    .filter(row => row && typeof row === 'object').slice(0, 250);
  if (!rows.length) return '';
  return `<div class="rosterSummaryLine"><b>${rows.length}</b> published current/recent roster entr${rows.length === 1 ? 'y' : 'ies'} available</div><div class="residentCardGrid">${rows.map(row => { const name = row.name || row.resident_name || 'Resident name not published'; const school = row.medical_school || row.medicalSchool || row.school || 'Medical school not published'; const degree = row.degree || ''; const pgy = row.pgy || row.pgy_year || row.pgy_level || row.PGY || row.class || row.class_of || 'PGY not published'; const country = row.medical_school_country || row.school_country || row.country || ''; const classification = row.classification || row.category || ''; return `<article><div class="residentIdentity"><b>${esc(name)}</b><span>${esc([degree,pgy].filter(Boolean).join(' · '))}</span></div><p>${esc(school)}</p><div class="residentMeta">${country ? `<span>${esc(country)}</span>` : '<span>Country not identified</span>'}${classification ? `<span>${esc(String(classification).replaceAll('_',' '))}</span>` : '<span>Category unknown</span>'}</div></article>`; }).join('')}</div>`;
}

function genericPeopleTable(p) {
  const rows = [
    ...evidenceRows(approvedResearchValue(p, 'research.leadership'), ['leadership','people','program_leadership']),
    ...evidenceRows(approvedResearchValue(p, 'research.core_faculty'), ['faculty','people','core_faculty']),
  ].filter(row => row && typeof row === 'object').slice(0, 100);
  if (!rows.length) return '';
  return `<div class="peopleCardGrid">${rows.map(row => { const name = row.name || row.full_name || row.person || 'Name not published'; const role = row.role || row.title || row.position || 'Role not published'; const training = row.training_summary || row.training || row.residency || row.fellowship || ''; const interests = row.interests || row.clinical_interests || row.research_interests || ''; const photo = String(row.photo_url || row.image_url || ''); const safePhoto = photo.startsWith('/') && !photo.startsWith('//') ? photo : ''; return `<article>${safePhoto ? `<img src="${esc(safePhoto)}" alt="" loading="lazy">` : '<div class="personPlaceholder" aria-hidden="true">◌</div>'}<div><h3>${esc(name)}</h3><b>${esc(role)}</b>${training ? `<p>${esc(displayValue(training))}</p>` : ''}${interests ? `<p class="sub">${esc(displayValue(interests))}</p>` : ''}</div></article>`; }).join('')}</div>`;
}

function genericFellowshipOutcomes(p) {
  const fellowships = evidenceRows(approvedResearchValue(p, 'research.fellowship_inventory'), ['fellowships','inventory','programs']);
  const outcomes = evidenceRows(approvedResearchValue(p, 'research.outcomes'), ['outcomes','graduates','placements']);
  const cards = (label, rows) => rows.length ? `<section><h3>${label}</h3><div class="outcomeCardGrid">${rows.slice(0,80).map(row => `<article>${esc(typeof row === 'object' ? displayValue(row) : row)}</article>`).join('')}</div></section>` : `<section><h3>${label}</h3><p class="sub">Not yet available from approved evidence.</p></section>`;
  return fellowships.length || outcomes.length ? `<div class="outcomesGrid">${cards('In-house fellowships',fellowships)}${cards('Graduate outcomes',outcomes)}</div>` : '';
}

function tabResidents(p, R) {
  if (!R || !R.rosterSummary) {
    const rosterState = researchStateText(p, 'research.resident_roster');
    return `<div>
      ${registryTable(p, ['Total Residents', 'Residents Per Year', 'IMG Graduates Percent', 'DO Graduates Percent', 'US MD Graduates Percent'], 'Program-reported resident and graduate composition')}
      ${genericRosterTable(p)}
      ${approvedResearchTable(p, ['research.resident_medical_schools', 'research.img_accessibility', 'research.do_accessibility', 'research.usmd_accessibility', 'research.caribbean_accessibility'], 'Approved roster research')}
      <div class="lawBanner"><b>Named roster:</b> ${esc(rosterState)}. Current composition is observational evidence, not an admissions rule, and does not establish acceptance policy.</div>
      ${unknownFooter(p)}</div>`;
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
    return `<div><h2 class="h2" style="margin-bottom:8px">Program leadership</h2>
      ${registryTable(p, ['Program Director', 'Program Director Credentials', 'Program Coordinator', 'Coordinator Email', 'Coordinator Phone'], 'Approved leadership information')}
      ${genericPeopleTable(p)}
      ${approvedResearchTable(p, ['research.faculty_training_graph'], 'Approved leadership training research')}
      <div class="lawBanner"><b>Additional leadership research:</b> ${esc(researchStateText(p, 'research.leadership'))}</div>${unknownFooter(p)}</div>`;
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
    return `<div><h2 class="h2" style="margin-bottom:8px">Fellowships & outcomes</h2>
      ${genericFellowshipOutcomes(p)}
      <div class="lawBanner"><b>Fellowship inventory:</b> ${esc(researchStateText(p, 'research.fellowship_inventory'))}<br><b>Graduate outcomes:</b> ${esc(researchStateText(p, 'research.outcomes'))}</div>${unknownFooter(p)}</div>`;
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
      <p class="sub" style="font-size:14px;margin-top:8px">${esc(R.salary.label)} · <span style="color:var(--check)">${esc(R.salary.currentness)}</span></p>` : registryTable(p, ['Salary PGY1', 'Salary PGY2', 'Salary PGY3', 'Salary PGY4'], 'Program-reported salary')}
    </div>
    <div class="railCard"><div class="rLbl">Benefits</div>
      ${R && R.benefits && R.benefits.length ? `<ul class="bullets">${R.benefits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : registryTable(p, ['Benefits', 'Vacation', 'Educational Stipend', 'Meal Allowance'], 'Program-reported benefits')}
      ${approvedResearchTable(p, ['research.salary_benefits', 'research.abim'], 'Approved practical research')}
    </div>
  </div><div>
    <div class="railCard"><div class="rLbl">Identity</div>
      ${[['ACGME ID', p.acgme || 'Not published'], ['Legacy RISE ID', p.legacyId || '—'], ['NRMP code', p.soap.length ? 'joined via SOAP dataset' : 'Not yet mapped'], ['Application service', R ? 'ERAS' : 'Not verified'], ['Official site', p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">↗ program website</a>` : 'Not recovered']].map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    </div>
    <div class="railCard"><div class="rLbl">Curriculum & structure</div>
      ${R ? `<ul class="bullets">${R.curriculum.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : registryTable(p, ['Clinic Structure', 'Call Schedule', 'Night Float', 'Average Work Hours', 'Research Track', 'Required Away Rotations', 'Moonlighting'], 'Program-reported structure and features')}
      ${approvedResearchTable(p, ['research.curriculum'], 'Approved curriculum research')}
    </div>
    ${R && R.conflicts && R.conflicts.length ? `<div class="railCard"><div class="rLbl" style="color:var(--conflict)">Conflicts (${R.conflicts.length})</div>
      ${R.conflicts.slice(0, 3).map(c => `<div class="kv"><span class="k">${esc(c.field)}</span><span class="v" style="font-size:14px">${stateTag('conflict', '')} ${esc(c.a)} <span style="color:var(--dim)">vs</span> ${esc(c.b)}</span></div>`).join('')}
      <button class="rowBtn" style="margin-top:10px" onclick="openSources('${p.id}')">All in Sources ⓘ</button></div>` : ''}
  </div></div>
  ${unknownFooter(p)}`;
}

/* ---------- sources & freshness panel (doc 09 §9.8) ---------- */
function sourceTrustPresentation(url, canonicalProgramUrl = '') {
  let host = '';
  let canonicalHost = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch {}
  try { canonicalHost = new URL(canonicalProgramUrl).hostname.toLowerCase(); } catch {}
  if (!host) return { tier: 2, label: 'Reviewed reference' };
  if (/(^|\.)(facebook\.com|instagram\.com|linkedin\.com|reddit\.com|tiktok\.com|x\.com|youtube\.com)$/.test(host)) {
    return { tier: 3, label: 'Community / secondary' };
  }
  if (/(^|\.)(wikipedia\.org|doximity\.com|imgprep\.com|matcharesident\.com|residencyadvisor\.com|residencymatch\.ai|residencyprograms\.io)$/.test(host)) {
    return { tier: 3, label: 'Secondary / discovery' };
  }
  if (/(^|\.)(abim\.org|freida\.ama-assn\.org|programdirectory\.nrmp\.org)$/.test(host)) {
    return { tier: 1, label: 'Official directory / approved' };
  }
  const firstParty = canonicalHost && (host === canonicalHost || host.endsWith(`.${canonicalHost}`) || canonicalHost.endsWith(`.${host}`));
  if (firstParty || /\.(edu|gov)$/.test(host) || /(^|\.)(mayo\.edu|nemours\.org)$/.test(host)) {
    return { tier: 1, label: 'Institutional / approved' };
  }
  return { tier: 2, label: 'Web reference / approved' };
}

function embeddedSourceUrls(value) {
  const urls = new Set();
  const visit = item => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (/^(?:source_?url|url)$/i.test(key) && typeof child === 'string' && child.startsWith('https://')) urls.add(child);
      else visit(child);
    }
  };
  visit(value);
  return [...urls].sort();
}

window.openSources = (id, evidenceIdx) => {
  const p = byId.get(id); if (!p) return;
  const R = p.rich || {};
  const canonicalSources = (p.canonical?.source?.urls || [p.url]).filter(Boolean).map(url => ({
    t: 'Approved canonical registry source', pub: url, tier: 1, tierLabel: 'Official directory / approved',
    acc: p.canonical?.source?.retrievedAt || p.verified || 'not stated', cur: 'current', url,
  }));
  const directResearchSourceIndex = new Map();
  const dossierSourceIndex = new Map();
  for (const fact of p.researchProjection?.currentFacts || []) {
    const domain = fact.field.replace(/^research\./, '').replaceAll('_', ' ');
    for (const url of embeddedSourceUrls(fact.canonicalValue ?? fact.knowledge?.value)) {
      const trust = sourceTrustPresentation(url, p.url);
      const row = directResearchSourceIndex.get(url) || {
        t: 'Direct canonical research source', pub: 'Direct source embedded in the approved value',
        ...trust, tierLabel: trust.label, acc: fact.retrievedAt || 'not stated', cur: 'current', url, domains: new Set(),
      };
      row.domains.add(domain);
      directResearchSourceIndex.set(url, row);
      dossierSourceIndex.delete(url);
    }
    for (const url of (fact.sourceUrls?.length ? fact.sourceUrls : [fact.sourceUrl]).filter(Boolean)) {
      if (directResearchSourceIndex.has(url)) continue;
      const trust = sourceTrustPresentation(url, p.url);
      const row = dossierSourceIndex.get(url) || {
        t: 'Dossier discovery source', pub: 'Retained for dossier traceability; not asserted as direct support for every field',
        ...trust, tierLabel: trust.label, acc: fact.retrievedAt || 'not stated', cur: 'current', url,
      };
      dossierSourceIndex.set(url, row);
    }
  }
  const directResearchSources = [...directResearchSourceIndex.values()].map(row => ({
    ...row, t: `${row.t} · ${[...row.domains].sort().join(', ')}`,
  }));
  const sourceRows = R.sources || [...new Map([...canonicalSources, ...dossierSourceIndex.values(), ...directResearchSources].map(row => [row.url || row.pub, row])).values()];
  const presentedSourceRows = sourceRows.map(row => {
    const trust = sourceTrustPresentation(row.url, p.url);
    return { ...row, tier: row.tier ?? trust.tier, tierLabel: row.tierLabel ?? trust.label };
  });
  const pendingFields = p.researchProjection?.pendingEvidence?.fields || [];
  const panel = $('#srcPanel');
  panel.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="Sources and freshness">
    <button class="drawerClose" aria-label="Close" onclick="$('#srcPanel').classList.remove('open')">✕</button>
    <h3>Sources & freshness</h3>
    <p class="sub" style="font-size:14.5px">${esc(p.name)}</p>
    <div class="fGroup"><div class="fLbl">Freshness by family</div>
      ${Object.entries(p.domains).map(([k, v]) => `<div class="kv"><span class="k">${k}</span><span class="v" style="font-size:14px">${famFresh(v)} <span style="color:var(--dim);font-size:12.5px">registry retrieved ${esc(p.verified)}</span></span></div>`).join('')}
    </div>
    <div class="fGroup"><div class="fLbl">Coverage</div>
      <p class="sub" style="font-size:14.5px"><b>${esc({ deep: 'Deep Research', enriched: 'Enriched Research', basic: 'Basic Profile', pending: 'Research Pending' }[p.filterIntelligence.researchDepth] || 'Research Pending')}</b> · ${p.filterIntelligence.approvedDomainCount} approved meaningful domains. Raw claim count is not used as the depth label.</p>
    </div>
    ${p.researchProjection?.dossier ? `<div class="fGroup"><div class="fLbl">Deep Research Dossier V2</div><p class="sub" style="font-size:14px"><b>${esc(p.researchProjection.dossier.dossierOutcome || 'PARTIAL')}</b> · ${Math.round(Number(p.researchProjection.dossier.completionScore || 0) * 100)}% weighted resolution · researched ${esc(String(p.researchProjection.dossier.researchTimestamp || 'date not stated').slice(0,10))}</p><div class="dossierMatrix">${Object.entries(p.researchProjection.dossier.completionMatrix || {}).map(([domain, item]) => `<span class="matrix-${esc(String(item.state || '').toLowerCase())}"><b>${esc(domain.replaceAll('_',' '))}</b>${esc(String(item.state || '').replaceAll('_',' '))}</span>`).join('')}</div></div>` : ''}
    <div class="fGroup"><div class="fLbl">Sources</div>
      ${(presentedSourceRows.length ? presentedSourceRows : [{ t: 'Canonical registry source', pub: 'RISE corpus', tier: 2, tierLabel: 'Directory / internal', acc: p.verified || 'not stated', cur: 'current' }]).map((s, i) => `
        <div class="srcRow" ${evidenceIdx === i ? 'style="outline:2px solid var(--cy);border-radius:8px;padding:12px"' : ''}>
          <div class="srcT">${esc(s.t)}</div>
          <div class="srcM"><span class="srcTier">Tier ${s.tier} · ${esc(s.tierLabel)}</span><span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">Open source ↗</a>` : esc(s.pub)}</span><span>accessed ${esc(s.acc)}</span><span class="cur-${s.cur}">${s.cur}</span></div>
        </div>`).join('')}
    </div>
    ${pendingFields.length ? `<div class="fGroup"><div class="fLbl">Reviewed evidence state</div><p class="sub" style="font-size:14px">Unsupported or disputed values remain hidden; provenance and source records are preserved.</p><div class="unkChips">${pendingFields.map(item => `<span class="unkChip">${esc(item.field.replace(/^research\./, '').replaceAll('_', ' '))} · ${esc(researchStateText(p, item.field))}</span>`).join('')}</div></div>` : ''}
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

function researchControlPanel() {
  const admin = state.researchAdmin, c = admin.control;
  if (admin.loading && !c) return '<div class="stepCard" style="margin:18px 0">Loading live production router…</div>';
  if (!c) return `<div class="stepCard" style="margin:18px 0">${esc(admin.error || 'Live production router unavailable.')}</div>`;
  const providers = admin.providers || [];
  const routeOptions = selected => providers.map(p => `<option value="${esc(p.providerKey)}" ${p.providerKey === selected ? 'selected' : ''}>${esc(p.providerKey)}</option>`).join('');
  return `<div class="stepCard" style="margin:18px 0">
    <div class="stepNum">Live production router · revision ${Number(admin.revision || 0)}</div>
    <div class="pillRow" style="margin:8px 0 12px"><span class="pill">Build: ${esc(c.buildMode)}</span><span class="pill">Contract: Dossier V2 · 18 domains</span><span class="pill">Spend: $${Number(c.actualSpendUsd || 0).toFixed(4)} actual · $${Number(c.reservedSpendUsd || 0).toFixed(4)} reserved / $${Number(c.budgetCapUsd || 0).toFixed(2)}</span><span class="pill">Canary: ${esc(c.canaryMode)} · ${Number(c.canaryProgramCount || 0)} programs</span><span class="pill">Rollout scope: ${esc(c.specialtyScope.join(', '))} · ${esc(c.stateScope.join(', '))}</span></div>
    <div class="rvActs" style="margin-bottom:12px">
      <button class="rvBtn ${c.globalEnabled ? 'on' : ''}" onclick="toggleResearchControl('globalEnabled')">Global ${c.globalEnabled ? 'enabled' : 'paused'}</button>
      <button class="rvBtn ${c.studentEnabled ? 'on' : ''}" onclick="toggleResearchControl('studentEnabled')">Students ${c.studentEnabled ? 'enabled' : 'paused'}</button>
      <button class="rvBtn ${c.emergencyKillSwitch ? 'on' : ''}" onclick="toggleResearchControl('emergencyKillSwitch')">Kill switch ${c.emergencyKillSwitch ? 'ACTIVE' : 'clear'}</button>
    </div>
    <form onsubmit="saveResearchControls(event)" class="intelFormGrid">
      <label><span>Specialty scope</span><input name="specialtyScope" value="${esc(c.specialtyScope.join(', '))}" required></label>
      <label><span>State scope</span><input name="stateScope" value="${esc(c.stateScope.join(', '))}" required></label>
      <label class="wide"><span>Canary ACGME program IDs</span><input name="canaryProgramIds" value="${esc(c.canaryProgramIds.join(', '))}" required></label>
      <label><span>Entitlement scope</span><input name="entitlementScope" value="${esc(c.entitlementScope.join(', '))}" required></label>
      <label><span>Default quota</span><input name="defaultQuota" type="number" min="0" max="100" value="${Number(c.defaultQuota)}" required></label>
      <label><span>Quota window days</span><input name="quotaWindowDays" type="number" min="1" max="366" value="${Number(c.quotaWindowDays)}" required></label>
      <label><span>Concurrency cap</span><input name="concurrencyCap" type="number" min="1" max="32" value="${Number(c.concurrencyCap)}" required></label>
      <label><span>Primary route</span><select name="primaryProvider">${routeOptions(c.primaryProvider)}</select></label>
      <label><span>Fallback route</span><select name="fallbackProvider"><option value="">None</option>${routeOptions(c.fallbackProvider)}</select></label>
      <label><span>Escalation route</span><select name="escalationProvider"><option value="">None</option>${routeOptions(c.escalationProvider)}</select></label>
      <label><span>Budget cap</span><input value="$${Number(c.budgetCapUsd || 0).toFixed(2)} · Founder-authorized hard cap" disabled></label>
      <div class="wide mActs"><button class="mBtn pri" type="submit">Save live router</button></div>
    </form>
    <div class="stepNum" style="margin-top:16px">Provider control</div>
    ${providers.map(p => `<div class="taskRow"><span class="tp">${esc(p.providerKey)} · ${esc(p.modelKey)}</span><span class="tf">${esc(p.state)} · network ${p.networkAllowed ? 'on' : 'off'} · $${Number(p.actualSpendUsd || 0).toFixed(4)} actual / $${Number(p.reservedSpendUsd || 0).toFixed(4)} reserved</span><span class="tState">${p.enabled ? 'ENABLED' : 'PAUSED'}</span>${p.providerKey === 'RISE_REPLAY_TEST' ? `<button class="rowBtn" onclick="toggleReplayProvider()">${p.enabled ? 'Pause' : 'Enable'} replay</button>` : p.providerKey.startsWith('OPENAI_') ? `<span class="rvActs"><button class="rowBtn" onclick="setOpenAiProviderMode('${esc(p.providerKey)}','BENCHMARKING')" ${p.state === 'BENCHMARKING' ? 'disabled' : ''}>Benchmark</button><button class="rowBtn" onclick="setOpenAiProviderMode('${esc(p.providerKey)}','PRODUCTION_APPROVED')" ${p.state === 'PRODUCTION_APPROVED' ? 'disabled' : ''}>Approve production</button><button class="rowBtn" onclick="setOpenAiProviderMode('${esc(p.providerKey)}','PAUSED')" ${p.state === 'PAUSED' ? 'disabled' : ''}>Pause</button></span>` : '<span class="cav">Reserved and paused</span>'}</div>`).join('')}
  </div>`;
}

function researchControlInput(c, changes = {}) {
  return { globalEnabled:c.globalEnabled, studentEnabled:c.studentEnabled, emergencyKillSwitch:c.emergencyKillSwitch,
    specialtyScope:c.specialtyScope, stateScope:c.stateScope, canaryMode:c.canaryMode,
    canaryProgramIds:c.canaryProgramIds, entitlementScope:c.entitlementScope,
    defaultQuota:c.defaultQuota, quotaWindowDays:c.quotaWindowDays, budgetCapUsd:c.budgetCapUsd, concurrencyCap:c.concurrencyCap,
    primaryProvider:c.primaryProvider, fallbackProvider:c.fallbackProvider, escalationProvider:c.escalationProvider, ...changes };
}

async function persistResearchControls(controls, reason) {
  const payload = await riseFetch('/api/rise/v1/operator/research/router', { method:'PATCH', body:JSON.stringify({ expectedRevision:state.researchAdmin.revision, controls, reason }) });
  state.researchAdmin.control = payload.controls; state.researchAdmin.revision = payload.revision; runtime.researchControl = payload.controls;
  renderMain(currentRoute());
}

window.toggleResearchControl = async field => {
  const c = state.researchAdmin.control;
  try { await persistResearchControls(researchControlInput(c, { [field]:!c[field] }), `Admin toggled ${field}`); toast('Live router updated.'); }
  catch (error) { toast(error.message || 'Router update failed.'); }
};

window.saveResearchControls = async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget).entries());
  const csv = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean);
  try {
    await persistResearchControls(researchControlInput(state.researchAdmin.control, {
      specialtyScope:csv(values.specialtyScope), stateScope:csv(values.stateScope),
      canaryProgramIds:csv(values.canaryProgramIds), entitlementScope:csv(values.entitlementScope),
      defaultQuota:Number(values.defaultQuota), quotaWindowDays:Number(values.quotaWindowDays), concurrencyCap:Number(values.concurrencyCap),
      primaryProvider:values.primaryProvider, fallbackProvider:values.fallbackProvider || null, escalationProvider:values.escalationProvider || null,
    }), 'Admin updated live router scope'); toast('Live router scope saved.');
  } catch (error) { toast(error.message || 'Router save failed.'); }
};

window.toggleReplayProvider = async () => {
  const provider = state.researchAdmin.providers.find(item => item.providerKey === 'RISE_REPLAY_TEST');
  if (!provider) return;
  try {
    const payload = await riseFetch('/api/rise/v1/operator/research/providers/RISE_REPLAY_TEST', { method:'PATCH', body:JSON.stringify({ expectedRevision:provider.revision, provider:{ ...provider, enabled:!provider.enabled }, reason:'Admin toggled zero-spend replay provider' }) });
    state.researchAdmin.providers = state.researchAdmin.providers.map(item => item.providerKey === payload.provider.providerKey ? payload.provider : item);
    renderMain(currentRoute()); toast('Replay provider updated.');
  } catch (error) { toast(error.message || 'Provider update failed.'); }
};

window.setOpenAiProviderMode = async (providerKey, mode) => {
  const provider = state.researchAdmin.providers.find(item => item.providerKey === providerKey);
  if (!provider) return;
  const active = mode === 'BENCHMARKING' || mode === 'PRODUCTION_APPROVED';
  try {
    const payload = await riseFetch('/api/rise/v1/operator/research/providers/' + encodeURIComponent(providerKey), {
      method:'PATCH', body:JSON.stringify({ expectedRevision:provider.revision, provider:{ ...provider,
        state:mode, enabled:active, networkAllowed:active, spendAllowed:active,
      }, reason:`Admin set ${providerKey} to ${mode} under P1-RISE-5012F` }),
    });
    state.researchAdmin.providers = state.researchAdmin.providers.map(item => item.providerKey === payload.provider.providerKey ? payload.provider : item);
    renderMain(currentRoute()); toast(`${providerKey} updated.`);
  } catch (error) { toast(error.message || 'Provider update failed.'); }
};

async function loadAdminResearch(force = false) {
  if (!state.canAdmin || state.researchAdmin.loading || (!force && state.researchAdmin.control)) return;
  state.researchAdmin.loading = true;
  try {
    const [router, jobs, review, benchmarks] = await Promise.all([
      riseFetch('/api/rise/v1/operator/research/router'),
      riseFetch('/api/rise/v1/operator/research/jobs'),
      riseFetch('/api/rise/v1/operator/research/review'),
      riseFetch('/api/rise/v1/operator/research/benchmarks'),
    ]);
    state.researchAdmin = {
      loading:false, error:null, control:router.controls, revision:router.revision,
      providers:router.providers || [], jobs:jobs.records || [], benchmarks:benchmarks.records || [],
      frozenBenchmarkIds:benchmarks.frozenAcgmeIds || [],
      reviewStats:review.stats || null, reviewRecords:review.records || [],
    };
  } catch (error) { state.researchAdmin = { ...state.researchAdmin, loading:false, error:error.message || 'Unavailable' }; }
  if ((currentRoute() || '').startsWith('admin/')) renderMain(currentRoute());
}

function viewAdmin(sub) {
  const research = state.researchAdmin;
  const live = research.control;
  const summary = research.error ? `Control readback failed: ${esc(research.error)}` : live
    ? `Live production router · ${live.globalEnabled ? 'enabled' : 'paused'} · emergency kill ${live.emergencyKillSwitch ? 'active' : 'clear'} · unapproved spend $0.00`
    : 'Loading the live production research router…';
  const head = `<div class="adminBanner"><b>Admin command center</b><span>${summary}</span></div>`;
  if (sub === 'queue') return `<div class="view">${head}${viewQueue()}</div>`;
  if (sub === 'benchmark') return `<div class="view">${head}${viewBenchmarkLab()}</div>`;
  if (sub === 'review') return `<div class="view">${head}${viewReview()}</div>`;
  if (sub === 'coverage') return `<div class="view">${head}${viewCoverage()}</div>`;
  return `<div class="view">${head}${viewResearch()}</div>`;
}

function viewBenchmarkLab() {
  const records = state.researchAdmin.benchmarks || [];
  const completed = records.filter(record => record.status === 'COMPLETED');
  const totalCost = records.reduce((sum, record) => sum + Number(record.actualCostUsd || 0), 0);
  return `<div class="secHead"><div><div class="eyebrow">P1-RISE-5012E</div><h1>Provider Benchmark Lab</h1><p class="sub">Frozen eight-program Parallel baseline versus OpenAI Terra and Sol. Benchmark output is isolated from canonical student evidence.</p></div></div>
    <div class="stepCard"><div class="pillRow"><span class="pill">Frozen programs: ${state.researchAdmin.frozenBenchmarkIds.length}</span><span class="pill">Jobs: ${records.length}</span><span class="pill">Completed: ${completed.length}</span><span class="pill">Actual spend: $${totalCost.toFixed(4)}</span></div>
      <div class="mActs"><button class="mBtn pri" onclick="runProviderBenchmark()">Queue Terra + Sol benchmark</button></div>
    </div>
    <div class="tblWrap"><table class="tbl"><tr><th>Program</th><th>Provider</th><th>Status</th><th>Findings</th><th>Latency</th><th>Cost</th></tr>${records.map(record => `<tr><td>${esc(record.acgmeId)}</td><td>${esc(record.modelKey)}</td><td>${esc(record.status)}</td><td>${Number(record.resultSummary?.findingCount || 0)}</td><td>${record.resultSummary?.latencyMs ? `${Number(record.resultSummary.latencyMs)} ms` : '—'}</td><td>$${Number(record.actualCostUsd || 0).toFixed(4)}</td></tr>`).join('') || '<tr><td colspan="6">No benchmark jobs have been queued.</td></tr>'}</table></div>`;
}

window.runProviderBenchmark = async () => {
  try {
    const payload = await riseFetch('/api/rise/v1/operator/research/benchmarks', {
      method:'POST', body:JSON.stringify({ providerKeys:['OPENAI_TERRA','OPENAI_SOL'] }),
    });
    toast(`${payload.jobs.length} benchmark jobs queued.`);
    state.researchAdmin.control = null;
    await loadAdminResearch(true);
  } catch (error) { toast(error.message || 'Benchmark queue failed.'); }
};

/* ---------- Research / Campaigns ---------- */
function viewResearch() {
  const pv = previewNumbers();
  const famChecked = k => adminDraft.families.has(k);
  const spend = state.campaigns.reduce((s, c) => s + (c.state === 'INGESTED' || c.state === 'RUNNING' ? c.cost : 0), 0);
  return `
    <p class="eyebrow" style="color:var(--admin)">Research · Campaigns</p>
    <h1 class="h1">Operate the <em>intelligence</em></h1>
    <p class="sub" style="max-width:720px;margin:6px 0 4px">Describe the research, or build the scope by hand. RISE will resolve scope, processor and cost only after the production research adapter is authorized.</p>
    ${researchControlPanel()}
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
  const jobs = state.researchAdmin.jobs || [];
  return `<p class="eyebrow" style="color:var(--admin)">Queue</p><h1 class="h1">Task <em>monitor</em></h1>
    ${state.researchAdmin.error ? `<div class="emptyLib"><div class="big">Live queue unavailable.</div>${esc(state.researchAdmin.error)}</div>` : jobs.length
      ? `<div class="stepCard">${jobs.map(job => `<div class="taskRow"><span class="tp">${esc(job.specialty)} · ${esc(job.state)} · ${esc(job.programSpecialtyId)}</span><span class="tf">${esc(job.providerKey)} · $${Number(job.actualCostUsd || 0).toFixed(2)}</span><span class="tState">${esc(job.status)}</span></div>`).join('')}</div>`
      : '<div class="emptyLib"><div class="big">The live production queue is empty.</div>The durable queue is connected and the default router remains fail-closed.</div>'}`;
}

/* ---------- review queue + change detection (doc 12 §12.5) ---------- */
function viewReview() {
  const records = state.researchAdmin.reviewRecords || [];
  const stats = state.researchAdmin.reviewStats;
  const dispositions = Object.fromEntries((stats?.dispositions || []).map(item => [item.disposition, Number(item.claims || 0)]));
  const summary = stats ? `<div class="sumStrip">
    <div class="sumStat"><span class="n"><em>${Number(stats.totalClaims || 0).toLocaleString()}</em></span><span class="l">Provider claims</span></div>
    <div class="sumStat"><span class="n">${Number(stats.visiblePromotions || 0).toLocaleString()}</span><span class="l">Live values</span></div>
    <div class="sumStat"><span class="n">${Number(dispositions.CONFLICT_REQUIRES_REVIEW || 0).toLocaleString()}</span><span class="l">Conflicts</span></div>
    <div class="sumStat"><span class="n">${Number(dispositions.INSUFFICIENT_EVIDENCE || 0).toLocaleString()}</span><span class="l">Insufficient</span></div>
  </div>` : '';
  return `<p class="eyebrow" style="color:var(--admin)">Evidence review</p><h1 class="h1">Exceptions with <em>durable decisions</em></h1>
    <p class="sub" style="margin:8px 0 18px">Every provider claim has a final disposition. This queue contains only claims that still need a human exception decision; approving creates an append-only canonical promotion.</p>
    ${summary}
    ${state.researchAdmin.error ? `<div class="emptyLib"><div class="big">Live review queue unavailable.</div>${esc(state.researchAdmin.error)}</div>` : records.length
      ? `<div class="stepCard">${records.map(item => `<article class="srcRow" style="margin-bottom:14px">
          <div class="srcT">${esc(item.programName || item.acgmeId)} · ${esc(item.field.replace(/^research\./, '').replaceAll('_', ' '))}</div>
          <div class="srcM"><span>${esc(item.provider)}</span><span>${esc(item.disposition)}</span><span>${esc(item.reason)}</span><span>reviewed ${esc(item.reviewedAt || 'not stated')}</span></div>
          <p class="sub" style="margin:8px 0;font-size:14px"><b>Reviewed value:</b> ${esc(displayValue(item.value))}</p>
          <div class="pillRow">${(item.sourceUrls || []).map(url => `<a class="pill" href="${esc(url)}" target="_blank" rel="noopener">Source ↗</a>`).join('') || '<span class="pill">No source URL</span>'}</div>
          <div class="rvActs" style="margin-top:10px">
            <button class="rvBtn" onclick="reviewDecide('${item.claimId}','APPROVED_CURRENT')">Approve current</button>
            <button class="rvBtn" onclick="reviewDecide('${item.claimId}','INSUFFICIENT_EVIDENCE')">Reject / insufficient</button>
            <button class="rvBtn" onclick="reviewDecide('${item.claimId}','APPROVED_HISTORICAL')">Mark historical</button>
            <button class="rvBtn" onclick="reviewDecide('${item.claimId}','STALE_NEEDS_REFRESH')">Mark stale</button>
          </div>
        </article>`).join('')}</div>`
      : '<div class="emptyLib"><div class="big">No exception claims remain.</div>All current claims have durable final dispositions.</div>'}`;
}
window.reviewDecide = async (claimId, disposition) => {
  if (!confirm('Record ' + disposition.replaceAll('_', ' ').toLowerCase() + ' for this evidence claim?')) return;
  try {
    await riseFetch('/api/rise/v1/operator/research/review/' + encodeURIComponent(claimId), {
      method:'PATCH', body:JSON.stringify({ disposition, reason:'Founder/admin exception review' }),
    });
    state.researchAdmin.control = null;
    await loadAdminResearch(true);
    toast('Durable review decision recorded.');
  } catch (error) { toast(error.message || 'Review decision failed.'); }
};

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
function bindAdmin() {
  const route = currentRoute() || '';
  if (['admin/research', 'admin/benchmark', 'admin/queue', 'admin/review', 'admin/coverage'].includes(route)) {
    void loadAdminResearch();
  }
}

Object.assign(globalThis, { state, D, $, $$, adminDraft, FAMILIES, byId, fitCache, renderMain, renderShell, openFileFor });

/* P1-RISE-5007 additive Fable-native private-beta extension.
   This source is injected before boot by sync-fable-shell.mjs. */
{
  const INTEL_CATEGORIES = [
    'Application Requirements', 'Visa', 'USMLE', 'COMLEX', 'YOG', 'USCE', 'Interview',
    'Residents', 'Faculty / Leadership', 'Fellowships', 'Rotations', 'Curriculum', 'Research',
    'Culture', 'Salary / Benefits', 'Facilities', 'Program Update', 'Other',
  ];
  const INTEL_STATUS_LABELS = {
    STUDENT_REPORT: 'Student report', VERIFICATION_PENDING: 'Verification pending',
    VERIFIED_BY_MISSIONMED: 'Verified by MissionMed', PARTIALLY_VERIFIED: 'Partially verified',
    COULD_NOT_VERIFY: 'Could not verify', CONFLICTING: 'Conflicting', OUTDATED: 'Outdated',
    REJECTED_HIDDEN: 'Rejected / hidden',
  };
  const canContributeIntel = runtime.session.capabilities.includes('rise:contribute');
  state.intelByProgram = new Map();
  state.intelLoading = new Set();
  state.intelAdmin = { records: null, analytics: null, error: null, loading: false };
  state.intelAdminFilter = 'ALL';

  function coverageBadge(p) {
    const tier = p.filterIntelligence.researchDepth || 'pending';
    const stateLabel = { deep: 'DEEP RESEARCH', enriched: 'ENRICHED RESEARCH', basic: 'BASIC PROFILE', pending: 'RESEARCH PENDING' }[tier];
    const pending = p.filterIntelligence.researchState === 'EVIDENCE_FOUND_VERIFICATION_PENDING';
    return `<span class="coverageBadge ${p.filterIntelligence.approvedDomainCount > 0 ? 'has-evidence' : ''}" title="Meaningful approved domain coverage, not program quality">${stateLabel} · ${p.filterIntelligence.approvedDomainCount} VERIFIED DOMAIN${p.filterIntelligence.approvedDomainCount === 1 ? '' : 'S'}${pending ? ' · EVIDENCE PENDING' : ''}</span>`;
  }

  function intelStatus(status) {
    return `<span class="intelStatus is-${esc(status).toLowerCase()}">${esc(INTEL_STATUS_LABELS[status] || status)}</span>`;
  }

  function intelSource(record) {
    if (!record.source) return '';
    const label = record.source.label || record.source.kind?.replaceAll('_', ' ') || 'Source';
    return record.source.url
      ? `<a class="intelSource" href="${esc(record.source.url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>`
      : `<span class="intelSource">${esc(label)}</span>`;
  }

  function studentIntelPanel(p) {
    const payload = state.intelByProgram.get(p.id);
    const records = payload?.records || [];
    const loading = state.intelLoading.has(p.id);
    return `<section class="intelSection" aria-labelledby="student-intel-title">
      <div class="intelHead">
        <div><p class="eyebrow">Community evidence</p><h2 class="h2" id="student-intel-title">Student <em>Intel</em></h2></div>
        ${canContributeIntel ? `<button class="rowBtn pri" onclick="openStudentIntelForm('${p.id}')">+ Contribute Intel</button>` : ''}
      </div>
      <div class="lawBanner intelLaw"><b>Student reports are leads, not canonical program facts.</b> Check the status, source, observed date, and Sources & Freshness before relying on a claim.</div>
      ${loading ? '<div class="intelEmpty">Loading Student Intel…</div>' : payload?.error ? `<div class="intelEmpty">Student Intel could not load. <button class="rowBtn" onclick="loadProgramIntel('${p.id}',true)">Try again</button></div>` : records.length ? records.map(record => `
        <article class="intelCard ${record.featured ? 'featured' : ''}">
          <div class="intelMeta"><span class="intelCategory">${esc(record.category)}</span>${intelStatus(record.status)}${record.highPriority ? '<span class="intelPriority">High priority · waiting for research budget</span>' : ''}</div>
          <p class="intelClaim">${esc(record.claim)}</p>
          ${record.adminNotation ? `<p class="intelNotation"><b>MissionMed note:</b> ${esc(record.adminNotation)}</p>` : ''}
          <div class="intelFoot"><span>${esc(record.contributor)}</span><span>Observed ${esc(record.observedOn)}</span>${intelSource(record)}<button class="intelCorroborate" onclick="corroborateIntel('${p.id}','${record.submissionId}')">I can corroborate · ${record.corroborationCount}</button></div>
        </article>`).join('') : '<div class="intelEmpty"><b>No Student Intel published yet.</b><br>Be the first to share a source-located or firsthand observation. Unknown remains unknown until someone contributes and MissionMed verifies it.</div>'}
    </section>`;
  }

  async function loadProgramIntel(programId, force = false) {
    if (!force && (state.intelByProgram.has(programId) || state.intelLoading.has(programId))) return;
    state.intelLoading.add(programId);
    if (force) state.intelByProgram.delete(programId);
    refreshIntelPanel(programId);
    try {
      const payload = await riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(programId) + '/student-intel');
      state.intelByProgram.set(programId, payload);
    } catch (error) {
      state.intelByProgram.set(programId, { records: [], error: error.message || 'Unavailable' });
    } finally {
      state.intelLoading.delete(programId);
      refreshIntelPanel(programId);
    }
  }
  window.loadProgramIntel = loadProgramIntel;

  function refreshIntelPanel(programId) {
    if (currentRoute() !== `program/${programId}/overview`) return;
    const program = byId.get(programId);
    const body = $('#fileBody');
    if (program && body) body.innerHTML = fileTabBody(program, 'overview');
  }

  const lockedFileTabBody = fileTabBody;
  fileTabBody = function extendedFileTabBody(program, tab) {
    const body = lockedFileTabBody(program, tab);
    return tab === 'overview' ? `${body}${studentIntelPanel(program)}` : body;
  };

  const lockedRenderFile = renderFile;
  renderFile = function extendedRenderFile(program) {
    return lockedRenderFile(program).replace(
      '<h1 class="fName"',
      `${coverageBadge(program)}<h1 class="fName"`,
    );
  };

  const lockedOpenFileFor = openFileFor;
  openFileFor = function extendedOpenFileFor(route) {
    lockedOpenFileFor(route);
    const [, programId] = route.split('/');
    void loadProgramIntel(programId);
  };
  window.openFileFor = openFileFor;

  const lockedOpenSources = window.openSources;
  window.openSources = (id, evidenceIdx) => {
    lockedOpenSources(id, evidenceIdx);
    const drawer = $('#srcPanel .drawer');
    const coverage = byId.get(id);
    if (!drawer || drawer.querySelector('.betaSourceReminder')) return;
    const reminder = document.createElement('div');
    reminder.className = 'lawBanner betaSourceReminder';
    reminder.innerHTML = `<b>BETA · VERIFY WITH PROGRAM.</b> Sources can be incomplete or outdated; residency requirements, personnel, visa policies, and deadlines can change. Confirm important application requirements directly with the program.${coverage ? ` Coverage: ${coverageBadge(coverage)}` : ''}`;
    drawer.querySelector('h3')?.insertAdjacentElement('afterend', reminder);
  };

  window.openStudentIntelForm = programId => {
    if (!canContributeIntel) { toast('Student Intel contribution is available only to the private-beta cohort.'); return; }
    const today = new Date().toISOString().slice(0, 10);
    openModal(`<div class="mKicker">Private beta · Student Intel</div><div class="mTitle">Contribute what you know</div>
      <div class="mSum">Your original submission is preserved for audit. MissionMed may edit only the student-facing display text, add notation, hide it, or verify it. Anonymous-to-students is the default; admins always retain contributor identity.</div>
      <form id="studentIntelForm" onsubmit="submitStudentIntel(event,'${programId}')">
        <div class="intelFormGrid">
          <label><span>Category</span><select name="category" required>${INTEL_CATEGORIES.map(category => `<option>${esc(category)}</option>`).join('')}</select></label>
          <label><span>Observed / source date</span><input name="observedOn" type="date" max="${today}" value="${today}" required></label>
          <label><span>Source type</span><select name="sourceKind"><option value="ONLINE">Online source</option><option value="FIRSTHAND">Firsthand observation</option><option value="DIRECT_COMMUNICATION">Direct communication</option><option value="OTHER">Other</option></select></label>
          <label><span>Student display</span><select name="displayIdentity"><option value="ANONYMOUS">Anonymous to students</option><option value="SHOW_MY_NAME">Show my name</option></select></label>
          <label class="wide"><span>What should students know?</span><textarea name="claim" maxlength="8000" required placeholder="State the claim precisely. Distinguish what you observed from what you inferred."></textarea></label>
          <label class="wide"><span>Source URL (required for online sources)</span><input name="sourceUrl" type="url" inputmode="url" placeholder="https://…"></label>
          <label class="wide"><span>Source label</span><input name="sourceLabel" maxlength="240" placeholder="Official program page, coordinator email, interview day…"></label>
          <label class="wide"><span>Context for MissionMed review</span><textarea name="contextNotes" maxlength="4000" placeholder="Optional private review context. This is not shown to students."></textarea></label>
        </div>
        <div class="mActs"><button class="mBtn pri" type="submit">Submit for verification</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div>
        <div class="mFoot">Do not include patient information, private contact details, or facts you are not authorized to share.</div>
      </form>`);
  };

  window.submitStudentIntel = async (event, programId) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await riseFetch('/api/rise/v1/program-specialties/' + encodeURIComponent(programId) + '/student-intel', { method: 'POST', body: JSON.stringify(payload) });
      closeModal();
      await loadProgramIntel(programId, true);
      toast('Student Intel submitted for verification.');
    } catch (error) {
      button.disabled = false;
      toast(error.message || 'Student Intel submission failed.');
    }
  };

  window.corroborateIntel = async (programId, submissionId) => {
    if (!canContributeIntel) { toast('Corroboration is available only to the private-beta cohort.'); return; }
    try {
      await riseFetch('/api/rise/v1/student-intel/' + encodeURIComponent(submissionId) + '/corroborate', { method: 'POST', body: '{}' });
      await loadProgramIntel(programId, true);
      toast('Corroboration recorded.');
    } catch (error) { toast(error.message || 'Could not record corroboration.'); }
  };

  function adminIntelView() {
    const { records, analytics, error } = state.intelAdmin;
    const allRecords = records || [];
    const visibleRecords = allRecords.filter(record => {
      if (state.intelAdminFilter === 'PENDING') return ['VERIFICATION_PENDING', 'CONFLICTING'].includes(record.status);
      if (state.intelAdminFilter === 'HIGH') return record.highPriority;
      if (state.intelAdminFilter === 'HIDDEN') return !record.visible || record.status === 'REJECTED_HIDDEN';
      return true;
    });
    const topLists = analytics ? `<div class="intelTopLists">
      <div><span>Top programs</span><b>${(analytics.topPrograms || []).map(item => `${esc(item.programSpecialtyId)} · ${item.count}`).join('<br>') || 'No submissions'}</b></div>
      <div><span>Top categories</span><b>${(analytics.topCategories || []).map(item => `${esc(item.category)} · ${item.count}`).join('<br>') || 'No submissions'}</b></div>
    </div>` : '';
    const metrics = analytics ? `<div class="sumStrip intelMetrics">
      <div class="sumStat"><span class="n">${analytics.total}</span><span class="l">Total reports</span></div>
      <div class="sumStat"><span class="n">${analytics.newThisWeek}</span><span class="l">New this week</span></div>
      <div class="sumStat"><span class="n">${analytics.highPriority}</span><span class="l">High priority</span></div>
      <div class="sumStat"><span class="n">$${Number(analytics.verificationCost || 0).toFixed(2)}</span><span class="l">Verification spend</span></div>
    </div><div class="intelStatusCounts">
      ${[['VERIFICATION_PENDING','Pending'],['VERIFIED_BY_MISSIONMED','Verified'],['PARTIALLY_VERIFIED','Partial'],['CONFLICTING','Conflicting'],['OUTDATED','Outdated'],['REJECTED_HIDDEN','Rejected']].map(([key,label]) => `<span><b>${analytics.counts?.[key] || 0}</b>${label}</span>`).join('')}
      <span><b>${analytics.verificationYield == null ? '—' : `${Math.round(analytics.verificationYield * 100)}%`}</b>Verification yield</span>
    </div>` : '';
    const content = error ? `<div class="emptyLib"><div class="big">Student Intel is unavailable.</div>${esc(error)}</div>` : records === null ? '<div class="emptyLib"><div class="big">Loading Student Intel…</div></div>' : visibleRecords.length ? visibleRecords.map(record => `
      <article class="reviewCard intelAdminCard">
        <div class="intelMeta"><span class="intelCategory">${esc(record.category)}</span>${intelStatus(record.status)}${record.highPriority ? '<span class="intelPriority">High priority · waiting for research budget</span>' : ''}</div>
        <div class="intelAdminIdentity"><b>${esc(record.submitterDisplayName)}</b><span>${esc(record.submitterSubject)}</span><span>${record.anonymousToStudents ? 'Anonymous to students' : 'Name shown to students'}</span></div>
        <div class="rvGrid"><div class="rvBox"><div class="lbl">Original · immutable</div><div class="val">${esc(record.originalClaim)}</div></div><div class="rvBox new"><div class="lbl">Student-facing display</div><div class="val">${esc(record.claim)}</div></div></div>
        ${record.contextNotes ? `<p class="sub">Private context: ${esc(record.contextNotes)}</p>` : ''}
        <div class="intelFoot"><span>${esc(record.programSpecialtyId)}</span><span>Observed ${esc(record.observedOn)}</span>${intelSource(record)}<span>${record.corroborationCount} corroboration${record.corroborationCount === 1 ? '' : 's'}</span></div>
        <div class="rvActs">
          ${[['EDIT_DISPLAY','Edit display'],['ANNOTATE','Add notation'],['REQUEST_CLARIFICATION','Request clarification'],['FEATURE','Feature'],[record.visible ? 'HIDE' : 'UNHIDE',record.visible ? 'Hide' : 'Unhide'],['REJECT','Reject'],['DELETE','Delete'],['MARK_OUTDATED','Mark outdated'],['MARK_CONFLICTING','Mark conflicting'],['MARK_VERIFIED','Mark verified'],['MARK_PARTIAL','Mark partial'],['COULD_NOT_VERIFY','Could not verify'],['SEND_TO_VERIFICATION','Verify again'],['PROMOTE_CANONICAL','Promote verified fact']].map(([action,label]) => `<button class="rvBtn ${action === 'MARK_VERIFIED' ? 'acc' : ''}" onclick="openIntelModeration('${record.submissionId}','${action}')">${label}</button>`).join('')}
          <button class="rvBtn" onclick="openIntelAudit('${record.submissionId}')">Audit trail</button>
        </div>
      </article>`).join('') : '<div class="emptyLib"><div class="big">No Student Intel submissions yet.</div>New private-beta contributions will appear here with contributor identity and immutable original text.</div>';
    return `<div class="view"><div class="adminBanner"><b>Student Intel · Admin</b><span>Contributor identity is admin-only. Original claims and audit events remain immutable.</span></div>
      <p class="eyebrow" style="color:var(--admin)">Student Intel</p><h1 class="h1">Moderate the <em>community layer</em></h1>
      <p class="sub" style="margin:8px 0 18px">Review, annotate, verify, corroborate, hide, and explicitly promote. Paid verification remains separate from the existing IM campaign and cannot run without a server cost preview and confirmation.</p>
      ${metrics}${topLists}<div class="rvActs intelFilters" style="margin:14px 0 8px">
        ${[['ALL','All submissions'],['PENDING','Verification queue'],['HIGH','High priority'],['HIDDEN','Hidden / rejected']].map(([key,label]) => `<button class="rvBtn ${state.intelAdminFilter === key ? 'on' : ''}" onclick="setIntelAdminFilter('${key}')">${label}</button>`).join('')}
      </div><div class="rvActs" style="margin:0 0 20px"><button class="rvBtn" onclick="previewIntelVerification()">Preview verification queue</button><button class="rvBtn" disabled>Run paid verification</button><span class="intelSinkState">Verification history is retained per report. Canonical promotion remains blocked until the evidence sink is connected.</span></div>${content}</div>`;
  }

  window.setIntelAdminFilter = filter => {
    state.intelAdminFilter = filter;
    renderMain(currentRoute());
  };

  async function loadAdminIntel(force = false) {
    if (!state.canAdmin || state.intelAdmin.loading || (!force && state.intelAdmin.records !== null)) return;
    state.intelAdmin.loading = true;
    try {
      const payload = await riseFetch('/api/rise/v1/operator/student-intel');
      state.intelAdmin = { records: payload.records || [], analytics: payload.analytics || null, error: null, loading: false };
    } catch (error) {
      state.intelAdmin = { records: [], analytics: null, error: error.message || 'Unavailable', loading: false };
    }
    if (currentRoute() === 'admin/student-intel') renderMain(currentRoute());
  }

  const lockedViewAdmin = viewAdmin;
  viewAdmin = function extendedViewAdmin(sub) {
    return sub === 'student-intel' ? adminIntelView() : lockedViewAdmin(sub);
  };

  const lockedBindAdmin = bindAdmin;
  bindAdmin = function extendedBindAdmin() {
    lockedBindAdmin();
    if (currentRoute() === 'admin/student-intel') void loadAdminIntel();
  };

  const lockedRenderShell = renderShell;
  renderShell = function extendedRenderShell() {
    lockedRenderShell();
    if (state.role !== 'admin') return;
    const railFoot = $('#rail .railFoot');
    if (!railFoot || $('#rail [data-intel-admin]')) return;
    railFoot.insertAdjacentHTML('beforebegin', `<button data-intel-admin class="rtab adminTab ${currentRoute() === 'admin/student-intel' ? 'on' : ''}" onclick="nav('admin/student-intel')">${ICONS.review}<span>Student Intel</span></button>`);
  };
  window.renderShell = renderShell;

  window.openIntelModeration = (submissionId, action) => {
    const record = state.intelAdmin.records?.find(item => item.submissionId === submissionId);
    if (!record) return;
    const edit = action === 'EDIT_DISPLAY' ? `<label class="wide"><span>Student-facing display text</span><textarea name="displayClaim" maxlength="8000" required>${esc(record.claim)}</textarea></label>` : '';
    const notation = action === 'ANNOTATE' ? '<label class="wide"><span>Public MissionMed notation</span><textarea name="adminNotation" maxlength="4000" required></textarea></label>' : '';
    const promote = action === 'PROMOTE_CANONICAL' ? '<label><span>Canonical field</span><input name="canonicalField" maxlength="128" required></label><label><span>Canonical JSON value</span><textarea name="canonicalValue" required placeholder="true, 230, or &quot;text&quot;"></textarea></label>' : '';
    openModal(`<div class="mKicker">Student Intel moderation</div><div class="mTitle">${esc(action.replaceAll('_', ' '))}</div><div class="mSum">The original claim is never edited. This action and its before/after state will be added to the immutable audit trail.</div>
      <form onsubmit="submitIntelModeration(event,'${submissionId}','${action}')"><div class="intelFormGrid">${edit}${notation}${promote}<label class="wide"><span>Reason</span><textarea name="reason" maxlength="4000" required></textarea></label></div><div class="mActs"><button class="mBtn pri" type="submit">Confirm action</button><button class="mBtn sec" type="button" onclick="closeModal()">Cancel</button></div></form>`);
  };

  window.submitIntelModeration = async (event, submissionId, action) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (action === 'PROMOTE_CANONICAL') {
      try { values.canonicalValue = JSON.parse(values.canonicalValue); }
      catch { toast('Canonical value must be valid JSON.'); return; }
    }
    try {
      await riseFetch('/api/rise/v1/operator/student-intel/' + encodeURIComponent(submissionId), { method: 'PATCH', body: JSON.stringify({ action, ...values }) });
      closeModal();
      state.intelByProgram.clear();
      state.intelAdmin.records = null;
      await loadAdminIntel(true);
      toast('Moderation action recorded.');
    } catch (error) { toast(error.message || 'Moderation failed.'); }
  };

  window.openIntelAudit = async submissionId => {
    try {
      const payload = await riseFetch('/api/rise/v1/operator/student-intel/' + encodeURIComponent(submissionId) + '/audit');
      openModal(`<div class="mKicker">Immutable audit trail</div><div class="mTitle">${payload.records.length} recorded action${payload.records.length === 1 ? '' : 's'}</div><div class="intelAudit">${payload.records.length ? payload.records.map(event => `<div><b>${esc(event.action.replaceAll('_', ' '))}</b><span>${esc(event.createdAt)}</span><p>${esc(event.reason || 'No reason supplied')}</p></div>`).join('') : '<p>No moderation actions recorded.</p>'}</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    } catch (error) { toast(error.message || 'Audit trail unavailable.'); }
  };

  window.previewIntelVerification = async () => {
    try {
      const preview = await riseFetch('/api/rise/v1/operator/student-intel/verification:preview', { method: 'POST', body: '{}' });
      const programs = new Set(preview.submissions.map(item => item.programSpecialtyId));
      const categories = new Set(preview.submissions.map(item => item.category));
      const priority = preview.submissions.filter(item => item.highPriority).length;
      openModal(`<div class="mKicker">Preview before spend</div><div class="mTitle">${preview.submissions.length} verification lead${preview.submissions.length === 1 ? '' : 's'}</div><div class="mSum">${programs.size} program${programs.size === 1 ? '' : 's'} · ${categories.size} categor${categories.size === 1 ? 'y' : 'ies'} · ${priority} high priority. Task class: ${esc(preview.taskClass || 'RISE_STUDENT_INTEL_CLAIM_VERIFICATION')}. Router: ${esc(preview.routerPolicy)}. Supplied URL first: ${preview.suppliedUrlFirst ? 'yes' : 'no'}.</div><div class="lawBanner" style="margin-top:16px"><b>Paid submission is unavailable.</b> No processor is selected and cost cannot be estimated because the bounded server-side factory bridge and separate Student Intel budget are not connected. The 1st/15th schedule is staged but inactive; the existing IM campaign is untouched.</div><div class="mActs"><button class="mBtn sec" onclick="closeModal()">Close</button></div>`);
    } catch (error) { toast(error.message || 'Verification preview unavailable.'); }
  };

  window.acknowledgeRiseBeta = async () => {
    try {
      runtime.betaNotice = await riseFetch('/api/rise/v1/me/beta-notice', { method: 'POST', body: '{}' });
      closeModal();
    } catch (error) { toast(error.message || 'Could not record beta acknowledgment.'); }
  };

  function showPrivateBetaNotice() {
    if (!runtime.session.privateBeta || runtime.betaNotice?.acknowledged) return;
    openModal(`<div class="mKicker">RISE private beta</div><div class="mTitle">Broad discovery. Honest evidence.</div><div class="mSum">RISE Beta combines MissionMed research with information from official program sources and, where labeled, reports shared by MissionMed students. Missing means unknown—not no. Student Intel is community-supplied until its status says MissionMed verified.</div><div class="lawBanner" style="margin-top:16px"><b>Use sources and dates.</b> Residency requirements, personnel, visa policies, deadlines, and other program details can change, and sources may be incomplete or outdated. Always confirm important application requirements directly with the residency program before making application decisions.</div><div class="mActs"><button class="mBtn pri" onclick="acknowledgeRiseBeta()">I understand</button></div><div class="mFoot">Your private-beta access does not add unrelated MissionMed entitlements.</div>`);
  }

  const lockedInit = init;
  init = function extendedInit() {
    lockedInit();
    setTimeout(showPrivateBetaNotice, 0);
  };
}


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
