(function () {
  'use strict';
  const cfg = window.mmedAppearanceV1;
  if (!cfg) return;
  const root = document.documentElement;
  const attribute = 'data-mmed-dashboard-appearance';
  const modes = ['dark', 'light', 'auto'];
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  let snapshot = safe(cfg.snapshot), available = !!cfg.available, saving = false, restoring = false;
  let generation = 0, status = initialStatus(), observer, draftMode = null, restoreRequested = false;
  function safe(s) {
    const states = ['valid', 'absent', 'invalid', 'ambiguous'];
    if (!s || s.contract !== 'matrix.appearance.preference.v1' || s.version !== 1 ||
        !modes.includes(s.mode) || !states.includes(s.state) || s.auto_policy !== 'os-browser') return null;
    const revision = 'v1:' + (s.state === 'valid' ? s.mode : s.state);
    return s.revision === revision ? { contract: s.contract, version: 1, mode: s.mode, state: s.state,
      revision: s.revision, auto_policy: s.auto_policy } : null;
  }
  function onDashboard() { return !location.hash || location.hash === '#dashboard'; }
  function initialStatus() {
    if (!available || !snapshot) return 'Appearance is unconfirmed. Reload to try again.';
    if (snapshot.state === 'invalid') return 'Appearance is unavailable. Your saved data was preserved.';
    if (snapshot.state === 'ambiguous') return 'Appearance is unconfirmed. Choose and apply your preference.';
    return '';
  }
  function apply() {
    if (!onDashboard()) { root.removeAttribute(attribute); root.removeAttribute('data-mmed-appearance-restoring'); return; }
    const mode = snapshot ? snapshot.mode : 'dark';
    root.setAttribute(attribute, mode === 'auto' ? (media && media.matches ? 'dark' : 'light') : mode);
    if (restoring) root.setAttribute('data-mmed-appearance-restoring', '1');
    else root.removeAttribute('data-mmed-appearance-restoring');
    sync();
  }
  function sync(updateChoice) {
    document.querySelectorAll('.mmed-appearance-v1').forEach(control => {
      const select = control.querySelector('select'), button = control.querySelector('button'), live = control.querySelector('[role="status"]');
      if (updateChoice) select.value = snapshot ? snapshot.mode : 'dark';
      select.disabled = button.disabled = saving || restoring || !available || !snapshot || snapshot.state === 'invalid';
      if (live.textContent !== status) live.textContent = status;
      control.setAttribute('aria-busy', saving || restoring ? 'true' : 'false');
    });
  }
  function mount() {
    if (!onDashboard()) return;
    const top = document.querySelector('#sos-content .mmdv2 .mmdv2-top');
    if (!top || top.querySelector('.mmed-appearance-v1')) { sync(); return; }
    const control = document.createElement('div'); control.className = 'mmed-appearance-v1';
    const label = document.createElement('label'); label.textContent = 'Appearance';
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Appearance');
    modes.forEach(mode => { const option = document.createElement('option'); option.value = mode; option.textContent = mode[0].toUpperCase() + mode.slice(1); select.appendChild(option); });
    select.value = draftMode || (snapshot ? snapshot.mode : 'dark');
    select.addEventListener('change', () => { draftMode = select.value; }); label.appendChild(select);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Apply';
    button.addEventListener('click', () => save(select.value));
    const live = document.createElement('span'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    control.append(label, button, live); top.appendChild(control); sync();
  }
  async function request(method, mode) {
    const url = new URL(cfg.url, location.href);
    if (url.origin !== location.origin) throw new Error('Unavailable');
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
    try {
      const response = await fetch(url.href, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        signal: abort.signal, headers: { 'X-WP-Nonce': cfg.nonce, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ mode }) } : {}) });
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } finally { clearTimeout(timer); }
  }
  async function save(mode) {
    if (saving || restoring || !available || !snapshot || snapshot.state === 'invalid' || !modes.includes(mode)) return;
    saving = true; const mine = ++generation; status = 'Confirming preference...'; sync();
    try {
      const result = await request('POST', mode);
      if (mine !== generation) return;
      const observed = safe(result.ok ? result.data : result.data && result.data.data && result.data.data.snapshot);
      if (result.ok && observed && observed.state === 'valid' && observed.mode === mode) {
        snapshot = observed; cfg.snapshot = observed; draftMode = null; status = 'Preference confirmed.'; sync(true);
      } else if (result.status === 409 && observed) {
        snapshot = observed; cfg.snapshot = observed; draftMode = null; status = 'Preference changed or is unconfirmed. Choose and apply again.'; sync(true);
      } else if ([401, 403].includes(result.status)) {
        snapshot = null; cfg.snapshot = null; draftMode = null; available = false; status = 'Your session changed. Reload before changing appearance.'; sync(true);
      } else { status = 'Preference is unconfirmed. No retry was made.'; }
    } catch (_) { if (mine === generation) status = 'Preference is unconfirmed. No retry was made.'; }
    finally {
      saving = false;
      if (restoreRequested) { restoreRequested = false; refresh(true); }
      else {
        apply();
        if (mine === generation && status.includes('unconfirmed') && available) refresh(false);
      }
    }
  }
  async function refresh(conceal) {
    if (saving) {
      if (conceal) { restoreRequested = true; snapshot = null; cfg.snapshot = null; draftMode = null;
        restoring = true; available = false; status = 'Confirming appearance...'; apply(); }
      return;
    }
    const mine = ++generation;
    if (conceal) { snapshot = null; cfg.snapshot = null; draftMode = null; restoring = true; available = false; status = 'Confirming appearance...'; apply(); }
    try {
      const result = await request('GET');
      if (mine !== generation) return;
      const observed = result.ok ? safe(result.data) : null;
      if (observed) { snapshot = observed; cfg.snapshot = observed; draftMode = null; available = true; status = initialStatus(); sync(true); }
      else { snapshot = null; cfg.snapshot = null; draftMode = null; available = false; status = 'Appearance is unconfirmed. Reload to try again.'; sync(true); }
    } catch (_) { if (mine === generation) { available = false; status = 'Appearance is unconfirmed. Reload to try again.'; } }
    finally { if (mine === generation) { restoring = false; apply(); mount(); } }
  }
  function start() {
    apply(); mount();
    const content = document.getElementById('sos-content');
    if (content) { observer = new MutationObserver(mount); observer.observe(content, { childList: true, subtree: true }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  if (media) { if (media.addEventListener) media.addEventListener('change', apply); else if (media.addListener) media.addListener(apply); }
  window.addEventListener('hashchange', () => { apply(); mount(); });
  window.addEventListener('pagehide', () => { ++generation; snapshot = null; cfg.snapshot = null; draftMode = null; available = false; restoring = true; restoreRequested = false;
    root.removeAttribute(attribute); root.setAttribute('data-mmed-appearance-restoring', '1'); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(true); });
})();
