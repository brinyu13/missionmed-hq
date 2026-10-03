// Founder amendment B — Selected Question Tray + "ADD / CHANGE QUESTIONS" selector drawer.
// Scales to the full 193-question library: search, eight filters, reorder, remove, preview, select.
// Question identities are the store's own `question_id`s; nothing here mints or renames one.
import { FILTERS, queryQuestions, CATEGORY_LABELS } from '../questions.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tagLine = (q) => (q.tags || []).slice(0, 2).map((t) => CATEGORY_LABELS[t] || t).join(' · ');

// Tray: compact list of selected questions with reorder/remove + the single entry point to the selector.
export function trayMarkup(set, { closingNote = true, max = 30 } = {}) {
  return `<div class="tray" id="tray" aria-label="Selected questions">
    <ol class="tray-list" id="tray-list">${set.map((q, i) => `<li class="tray-row" data-id="${esc(q.question_id)}"><span class="n">${i + 1}</span><span class="txt">${esc(q.canonical_text)}</span><span class="tray-actions"><button type="button" class="ctl-icon" data-up="${i}" aria-label="Move question ${i + 1} up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="ctl-icon" data-down="${i}" aria-label="Move question ${i + 1} down" ${i === set.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="ctl-icon" data-remove="${i}" aria-label="Remove question ${i + 1}">✕</button></span></li>`).join('')}
    ${closingNote ? `<li class="tray-row closing"><span class="n">+</span><span class="txt">Closing: "Do you have any questions for me?" <small>reserved for your questions, then a sign-off</small></span></li>` : ''}</ol>
    <div class="tray-foot"><span class="t-tech">${set.length} of ${max} selected</span><button type="button" class="btn btn-secondary" id="open-selector">+ Add / change questions</button></div>
  </div>`;
}

export function mountTray(host, set, { onChange }) {
  host.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.up != null) { const i = Number(b.dataset.up); if (i > 0) [set[i - 1], set[i]] = [set[i], set[i - 1]]; onChange(); }
    else if (b.dataset.down != null) { const i = Number(b.dataset.down); if (i < set.length - 1) [set[i + 1], set[i]] = [set[i], set[i + 1]]; onChange(); }
    else if (b.dataset.remove != null) { set.splice(Number(b.dataset.remove), 1); onChange(); }
  });
}

// Selector: a dedicated drawer (no page scroll; the list scrolls inside).
export function openSelector({ questions, store, set, attempts = [], max = 30, single = false, onDone }) {
  let filter = 'recommended'; let search = ''; let preview = null;
  const drawer = document.createElement('div'); drawer.className = 'drawer-backdrop'; drawer.id = 'selector';
  const selected = () => new Set(set.map((q) => q.question_id));
  const draw = () => {
    const rows = queryQuestions({ questions, store, filter, search, attempts });
    const sel = selected();
    drawer.innerHTML = `<div class="housing drawer" role="dialog" aria-modal="true" aria-labelledby="selector-title">
      <header class="drawer-head"><div><div class="t-kick gold">${single ? 'Choose the question' : 'Add / change questions'}</div><h2 class="t-h2" id="selector-title">${questions.length} canonical questions</h2></div><button type="button" class="btn btn-quiet" id="selector-close" aria-label="Close">Done</button></header>
      <div class="drawer-tools"><input class="search" id="selector-search" type="search" placeholder="Search text, tag or ID…" value="${esc(search)}" aria-label="Search questions"><div class="q-filter" role="group" aria-label="Filters">${FILTERS.map((f) => `<button type="button" data-filter="${f.id}" aria-pressed="${filter === f.id}" title="${esc(f.hint || '')}">${f.label}</button>`).join('')}</div></div>
      <div class="drawer-body">
        <div class="q-list" role="listbox" aria-label="Questions" id="selector-list">${rows.map((q) => `<div class="q-row ${sel.has(q.question_id) ? 'picked' : ''}" data-q="${esc(q.question_id)}"><button type="button" class="q-pick" data-pick="${esc(q.question_id)}" aria-pressed="${sel.has(q.question_id)}"><strong>${esc(q.canonical_text)}</strong><small>${tagLine(q)}${q.core_priority ? ' · Core' : ''}${q.behavioral ? ' · behavioral' : ''}</small></button><button type="button" class="ctl-icon" data-preview="${esc(q.question_id)}" aria-label="Preview">i</button></div>`).join('') || '<p class="note">No questions match.</p>'}</div>
        <aside class="drawer-side"><div class="t-label">${single ? 'Selected' : `Selected · ${set.length} of ${max}`}</div><ol class="mini-tray">${set.map((q) => `<li>${esc(q.canonical_text)}</li>`).join('') || '<li class="note">Nothing selected yet.</li>'}</ol>${preview ? `<div class="preview"><div class="t-label">Preview</div><p>${esc(preview.canonical_text)}</p><small class="t-tech">${esc(preview.question_id)} · ${(preview.tags || []).map((t) => CATEGORY_LABELS[t] || t).join(', ')} · difficulty ${preview.difficulty ?? '–'}${preview.followup_eligible ? ' · follow-up eligible' : ''}</small></div>` : ''}</aside>
      </div>
      <footer class="drawer-foot"><span class="t-tech">${single ? 'One question for this rep.' : 'Order is the interview order. Core first is only a default.'}</span><button type="button" class="btn btn-primary" id="selector-done">Use these ${single ? '' : `${set.length} question${set.length === 1 ? '' : 's'}`} ▸</button></footer>
    </div>`;
    const input = drawer.querySelector('#selector-search'); input.addEventListener('input', (e) => { search = e.target.value; draw(); const i = drawer.querySelector('#selector-search'); i.focus(); i.setSelectionRange(search.length, search.length); });
    if (!search) drawer.querySelector('#selector-search').focus({ preventScroll: true });
  };
  drawer.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) { if (e.target === drawer) close(); return; }
    if (b.dataset.filter) { filter = b.dataset.filter; draw(); return; }
    if (b.dataset.preview) { preview = questions.find((q) => q.question_id === b.dataset.preview) || null; draw(); return; }
    if (b.dataset.pick) {
      const q = questions.find((x) => x.question_id === b.dataset.pick); if (!q) return;
      const idx = set.findIndex((x) => x.question_id === q.question_id);
      if (single) { set.splice(0, set.length, q); }
      else if (idx >= 0) set.splice(idx, 1);
      else if (set.length < max) set.push(q);
      draw(); return;
    }
    if (b.id === 'selector-close' || b.id === 'selector-done') close();
  });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() { document.removeEventListener('keydown', onKey); drawer.remove(); onDone?.(set); }
  document.body.append(drawer); draw();
  return close;
}
