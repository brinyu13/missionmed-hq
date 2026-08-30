/* ============================================================
   3528B — App runtime: state, router, spatial focus (controller
   grammar), nav rail, toasts, whisper, modal.
   ============================================================ */
import { EnvironmentLayer } from './env.mjs';
import { STUDENT } from './data.mjs';
import { MENU_SCREENS } from './menus.mjs';
import { LIVE_SCREENS } from './live.mjs';
import { POST_SCREENS } from './post.mjs';

/* ---------- persisted UI state ---------- */
const UI_KEY = 'ivoc.ui.v2';
function loadUi() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch { return {}; }
}
export const ui = Object.assign({ railMin: false, reducedMotion: false, coaching: true, recording: true, analyticsVisible: true, favorites: null, lastRoute: null }, loadUi());
export function saveUi() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* private mode */ }
}

const DRAFT_KEY = 'ivoc.setupDraft.v2';
export const draft = (() => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch { return {}; }
})();
export function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { }
}

/* last completed session snapshot (results/replay source) */
export const session = { last: null };

/* ---------- environment ---------- */
export const env = new EnvironmentLayer(document.getElementById('env'));
env.setReduced(ui.reducedMotion);
if (ui.reducedMotion) document.documentElement.dataset.reducedMotion = '1';
export function setReducedMotion(on) {
  ui.reducedMotion = on; saveUi();
  env.setReduced(on);
  if (on) document.documentElement.dataset.reducedMotion = '1';
  else delete document.documentElement.dataset.reducedMotion;
  document.getElementById('world').classList.toggle('drift', !on && world.classList.contains('on'));
}

const world = document.getElementById('world');
export function setWorld(image, drift = true) {
  if (image) {
    world.style.backgroundImage = `url("${image}")`;
    world.classList.add('on');
    world.classList.toggle('drift', drift && !ui.reducedMotion);
  } else {
    world.classList.remove('on', 'drift');
  }
}

/* ---------- toasts ---------- */
export function toast(msg, kind = 'info', ms = 4000) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast t-${kind}`;
  el.innerHTML = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 240); }, ms);
}

/* ---------- coaching whisper (one at a time) ---------- */
const whisperHost = document.getElementById('whisper');
let whisperTimer = null;
export function whisper(text, { ok = false, arrow = null } = {}) {
  clearTimeout(whisperTimer);
  if (!text) { whisperHost.innerHTML = ''; return; }
  whisperHost.innerHTML = `<div class="whisper-card${ok ? ' ok' : ''}">${arrow ? `<span class="warr">${arrow}</span>` : ''}<span>${text}</span></div>`;
  whisperTimer = setTimeout(() => { whisperHost.innerHTML = ''; }, 3400);
}

/* ---------- modal ---------- */
export function confirmModal({ title, body, okLabel = 'CONFIRM', okClass = 'btn-gold', cancelLabel = 'CANCEL' }) {
  return new Promise(res => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal"><h3>${title}</h3><p>${body}</p>
      <div class="row"><button class="btn btn-quiet" data-x="0">${cancelLabel}</button>
      <button class="btn ${okClass}" data-x="1">${okLabel}</button></div></div>`;
    back.addEventListener('click', e => {
      const b = e.target.closest('[data-x]');
      if (b) { back.remove(); res(b.dataset.x === '1'); }
      else if (e.target === back) { back.remove(); res(false); }
    });
    document.body.appendChild(back);
    back.querySelector('.btn-quiet').focus();
  });
}

/* ---------- spatial focus: keyboard = controller ---------- */
export const focusCtl = {
  current: null,
  set(el) {
    if (this.current) this.current.classList.remove('is-focused');
    this.current = el || null;
    if (el) {
      el.classList.add('is-focused');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: ui.reducedMotion ? 'auto' : 'smooth' });
    }
  },
  candidates() {
    return [...document.querySelectorAll('[data-focusable]')].filter(el => el.offsetParent !== null && !el.disabled);
  },
  move(dir) {
    const all = this.candidates();
    if (!all.length) return;
    if (!this.current || !all.includes(this.current)) { this.set(all[0]); return; }
    const r = this.current.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of all) {
      if (el === this.current) continue;
      const b = el.getBoundingClientRect();
      const bx = b.x + b.width / 2, by = b.y + b.height / 2;
      const dx = bx - cx, dy = by - cy;
      let axial, cross;
      if (dir === 'right') { if (dx <= 8) continue; axial = dx; cross = Math.abs(dy); }
      else if (dir === 'left') { if (dx >= -8) continue; axial = -dx; cross = Math.abs(dy); }
      else if (dir === 'down') { if (dy <= 8) continue; axial = dy; cross = Math.abs(dx); }
      else { if (dy >= -8) continue; axial = -dy; cross = Math.abs(dx); }
      const score = axial + cross * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.set(best);
  },
  activate() {
    if (this.current) this.current.click();
  },
};

addEventListener('keydown', e => {
  if (e.target instanceof Element && e.target.matches('input, textarea, select')) return;
  const map = { ArrowRight: 'right', ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up' };
  if (map[e.key]) { e.preventDefault(); focusCtl.move(map[e.key]); }
  else if (e.key === 'Enter') { if (focusCtl.current) { e.preventDefault(); focusCtl.activate(); } }
  else if (e.key === 'Escape' || e.key === 'Backspace') {
    if (document.querySelector('.modal-back')) return;
    const def = SCREENS[currentRoute.name];
    if (currentScreenApi && currentScreenApi.onEscape) { e.preventDefault(); currentScreenApi.onEscape(); }
    else if (def && def.back) { e.preventDefault(); go(def.back); }
  }
});
addEventListener('pointermove', () => { if (focusCtl.current) focusCtl.set(null); }, { passive: true });

/* ---------- nav rail ---------- */
const NAV = [
  { route: 'home', label: 'Home', icon: 'M3 11.5 12 4l9 7.5M5.5 10v9h13v-9' },
  { route: 'practice', label: 'Practice', icon: 'M7 4.5v15l12-7.5z' },
  { route: 'questions', label: 'Interview', icon: 'M4 5h16v10H9l-5 4zM9 9h6' },
  { route: 'library', label: 'Video Library', icon: 'M3 6h14v12H3zM17 10l4-2.5v9L17 14' },
  { route: 'results', label: 'Results', icon: 'M4 20V9m5.5 11V4M15 20v-7m5 7V7' },
  { route: 'progress', label: 'Progress', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { route: 'mentor', label: 'Mentor Review', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0M16 14l2 2 4-4' },
  { route: 'settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zm8-3a8 8 0 01-.2 1.8l2 1.6-2 3.4-2.4-1a8 8 0 01-3 1.8L14 22h-4l-.4-2.4a8 8 0 01-3-1.8l-2.4 1-2-3.4 2-1.6A8 8 0 014 12a8 8 0 01.2-1.8l-2-1.6 2-3.4 2.4 1a8 8 0 013-1.8L10 2h4l.4 2.4a8 8 0 013 1.8l2.4-1 2 3.4-2 1.6c.13.58.2 1.18.2 1.8z' },
];

const rail = document.getElementById('rail');
function icon(d, size = 21) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
function renderRail() {
  rail.className = ui.railMin ? 'min' : '';
  rail.innerHTML = `
    <div class="rail-brand">
      <div class="rail-logo">MM</div>
      <div><b>IV PREP ON-CALL</b><small>Interview Arena</small></div>
    </div>
    <div class="rail-items">
      <div class="rail-slider" style="opacity:0"></div>
      ${NAV.map(n => `<button class="rail-item" data-nav="${n.route}" data-focusable title="${n.label}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}
    </div>
    <div class="rail-foot">
      <div class="rail-id">
        <div class="rail-avatar">DB</div>
        <div><b>${STUDENT.name}</b><small>${STUDENT.role}</small></div>
      </div>
      <div class="rail-ent">ENTITLED · ${STUDENT.entitlement}</div>
      <button class="rail-collapse" data-collapse>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>
        <span>COLLAPSE</span>
      </button>
    </div>`;
  rail.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) go(nav.dataset.nav);
    if (e.target.closest('[data-collapse]')) {
      ui.railMin = !ui.railMin; saveUi();
      rail.classList.toggle('min', ui.railMin);
      requestAnimationFrame(() => setTimeout(syncRail, 240));
    }
  });
}
function syncRail() {
  const name = currentRoute.hilite || currentRoute.name;
  const items = rail.querySelectorAll('.rail-item');
  const slider = rail.querySelector('.rail-slider');
  let onEl = null;
  items.forEach(el => {
    const on = el.dataset.nav === name;
    el.classList.toggle('on', on);
    if (on) onEl = el;
  });
  if (onEl && slider) {
    const parentR = onEl.parentElement.getBoundingClientRect();
    const r = onEl.getBoundingClientRect();
    slider.style.top = `${r.top - parentR.top + (r.height - 30) / 2}px`;
    slider.style.opacity = '1';
  } else if (slider) slider.style.opacity = '0';
}

/* ---------- router ---------- */
export const SCREENS = { ...MENU_SCREENS, ...LIVE_SCREENS, ...POST_SCREENS };
const stage = document.getElementById('stage');
export let currentRoute = { name: null, param: null };
let currentScreenApi = null;
let navDir = 1;

export function go(route, param = null) {
  const target = `#/${route}${param ? '/' + param : ''}`;
  if (location.hash === target) { renderRoute(); return; }
  location.hash = target;
}

function parseHash() {
  const h = location.hash.replace(/^#\//, '');
  const [name, param] = h.split('/');
  return { name: name || 'home', param: param || null };
}

const ORDER = ['home', 'practice', 'questions', 'setup', 'ready', 'live', 'processing', 'results', 'library', 'progress', 'mentor', 'settings'];

async function renderRoute() {
  const next = parseHash();
  if (!SCREENS[next.name]) { go('home'); return; }
  const prevIdx = ORDER.indexOf(currentRoute.name);
  const nextIdx = ORDER.indexOf(next.name);
  navDir = prevIdx >= 0 && nextIdx >= 0 && nextIdx < prevIdx ? -1 : 1;

  if (currentScreenApi && currentScreenApi.destroy) { try { currentScreenApi.destroy(); } catch { } }
  whisper(null);
  const def = SCREENS[next.name];
  currentRoute = { name: next.name, param: next.param, hilite: def.hilite };

  // environment + world
  if (def.env === false) { env.setEnabled(false); } else { env.setEnabled(true); env.setTheme(def.envTheme || 'lobby'); }
  setWorld(def.world || null);
  rail.classList.toggle('min', !!def.railMin || ui.railMin);

  stage.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'screen' + (navDir === -1 ? ' nav-back' : '');
  stage.appendChild(el);
  currentScreenApi = await def.render(el, { param: next.param }) || {};
  syncRail();

  if (next.name !== 'live') { ui.lastRoute = location.hash; saveUi(); }

  // land focus on the screen's preferred tile
  const pref = el.querySelector('[data-autofocus]') || el.querySelector('[data-focusable]');
  focusCtl.set(null);
  if (def.autoFocus !== false && pref) focusCtl.set(pref);
}

addEventListener('hashchange', renderRoute);

/* ---------- boot ---------- */
renderRail();
const devMode = new URLSearchParams(location.search).has('dev');
if (!location.hash || location.hash === '#/') {
  const last = ui.lastRoute;
  location.hash = last && last !== '#/live' ? last : '#/home';
} else if (location.hash === '#/live') {
  if (devMode) {
    // dev/QA only: allow direct room entry with a seeded draft
    if (!draft.qids || !draft.qids.length) { draft.mode = 'question'; draft.qids = ['q1']; }
  } else {
    // refresh during live = interruption → recovery
    location.hash = '#/recovery';
  }
}
renderRoute();
