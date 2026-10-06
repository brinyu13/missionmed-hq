// Winning Fable donor e88e799: offline fictional teaching-rule QA only.
// This pure detector does not control the native realtime InterviewBrain.
import { detectHooks } from './brain/hook-detector.mjs';
import { controller as sharedController } from './controller/session-controller.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]));
const noop = () => {};

export async function mountBaitLab(main, {
  controller = sharedController,
  isCurrent = () => true,
  getAccount = () => controller.account,
  loadFixtures = () => import('../fixtures/hooks/hook-fixtures.mjs'),
} = {}) {
  const account = getAccount(), subject = account?.subject;
  let disposed = false;
  const current = () => !disposed && isCurrent() && getAccount() === account
    && account?.subject === subject && account?.role === 'admin';
  if (!isCurrent()) return noop;
  if (account?.mode !== 'REAL' || account?.role !== 'admin'
    || !/^wp:[1-9][0-9]*$/.test(String(subject || '')) || typeof account.api?.bootstrap !== 'function') {
    throw new Error('Bait Lab requires your current admitted Admin account.');
  }
  // Never import the fictional fixtures or render this Admin surface from cached
  // role alone. A replacement actor/view invalidates every asynchronous boundary.
  const fresh = await account.api.bootstrap();
  if (!current()) return noop;
  if (fresh?.entitlement?.admitted !== true || fresh?.identity?.subject !== subject
    || fresh?.identity?.admin !== true) throw new Error('Admin access changed. Return to Matrix and sign in again.');
  const { HOOK_FIXTURES } = await loadFixtures();
  if (!current()) return noop;
  if (!Array.isArray(HOOK_FIXTURES) || HOOK_FIXTURES.length !== 39) throw new Error('The fictional Bait Lab fixtures are unavailable.');

  let selected = HOOK_FIXTURES[0];
  main.innerHTML = `
    <div class="bait-lab" data-bait-lab>
    <div class="screen-head"><div><div class="t-kick gold">Admin · OFFLINE FICTIONAL TEACHING-RULE QA</div><h1 class="t-hero">Bottom <em>lining.</em></h1><p class="t-edit">Bait Lab runs the deterministic hook detector (ivoc.hook-detector.v1) on 39 fictional answers. Edit a fictional answer to inspect hook categories, six-factor scores, rule decisions and follow-up templates.</p><p class="note">This offline teaching-rule harness does not control or certify the native realtime InterviewBrain. No camera, microphone, provider session, account session or saved Results are created. Use fictional text only; edits stay on this page and are cleared when you leave.</p></div><span class="chip">${HOOK_FIXTURES.length} fictional fixtures</span></div>
    <div class="two-col">
      <section class="housing panel"><div class="q-list" id="bait-list">${HOOK_FIXTURES.map((f) => `<button type="button" class="q-row" data-id="${esc(f.id)}" aria-pressed="${f === selected}"><div><strong style="font-size:14px">${esc(f.id)} · ${esc(f.label)}</strong><small>${esc(f.question.text)} · expect ${esc(f.expect.decision)}</small></div><span class="chip ${f.id.startsWith('HK-P') ? 'ok' : f.id.startsWith('HK-N') ? '' : 'cyan'}">${f.id.startsWith('HK-P') ? 'bait' : f.id.startsWith('HK-N') ? 'no bait' : 'edge'}</span></button>`).join('')}</div></section>
      <aside class="housing panel" style="position:sticky;top:78px"><label class="t-label" for="bait-text">Fictional answer (editable)</label><textarea id="bait-text" style="width:100%;min-height:120px;margin:8px 0 12px;padding:10px 12px;border-radius:10px;background:#080d19;border:1px solid var(--line);color:var(--ink);font:400 14px/1.45 var(--font-editorial)"></textarea><div id="bait-report" aria-live="polite"></div></aside>
    </div></div>`;
  const lab = main.querySelector('[data-bait-lab]'), ta = lab.querySelector('#bait-text');
  const list = lab.querySelector('#bait-list'), output = lab.querySelector('#bait-report');
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    list.removeEventListener('click', choose);
    ta.removeEventListener('input', draw);
    ta.value = ''; output.innerHTML = ''; lab.remove();
  };
  const draw = () => {
    if (!current()) { dispose(); return; }
    const report = detectHooks({ question: selected.question, answer: ta.value, priorTurns: selected.priorTurns || [], context: selected.context || {}, policy: selected.policy || {} });
    const pass = report.decision === selected.expect.decision;
    output.innerHTML = `
      <div class="t-kick">Offline rule decision</div><h3 class="t-h2" style="margin:4px 0 10px;color:${report.decision === 'FOLLOW_HOOK' ? 'var(--teal)' : report.decision === 'MOVE_ON' ? 'var(--dim)' : 'var(--gold-flat)'}">${esc(report.decision)}${report.blockedBy ? ` · blocked by ${esc(report.blockedBy)}` : ''}</h3>
      ${report.primary ? `<p class="t-edit">Hook: <q>${esc(report.primary.span.text)}</q> · ${esc(report.primary.categoryName)}</p><p class="t-edit">Offline follow-up template: <strong>${esc(report.primary.suggestedFollowUp)}</strong></p>` : '<p class="t-edit">No hook to follow.</p>'}
      <p class="note">reasons: ${esc(report.reasons.join(', '))} · flags: ${esc(Object.entries(report.flags).filter(([, v]) => v === true).map(([k]) => k).join(', ') || 'none')} · fixture decision expectation ${pass ? '<span class="chip ok">matches</span>' : '<span class="chip warn">differs (edited text?)</span>'}</p>
      <details class="expert" open><summary>All candidates (${report.hooks.length})</summary><table>${report.hooks.map((h) => `<tr><td>${esc(h.category)} <small>${esc(h.span.text.slice(0, 70))}</small>${h.guarded ? ' <span class="chip bad">guarded</span>' : ''}${h.resolvedInAnswer ? ' <span class="chip">resolved</span>' : ''}${h.deferred ? ' <span class="chip">deferred</span>' : ''}</td><td>${h.total.toFixed(2)} <small style="color:var(--dim)">d${h.scores.dangling} s${h.scores.specificity} r${h.scores.relevance} v${h.scores.resolvability} a${h.scores.salience} i${h.scores.intent}</small></td></tr>`).join('') || '<tr><td>none</td><td></td></tr>'}</table></details>`;
  };
  const choose = (e) => {
    if (!current()) { dispose(); return; }
    const b = e.target.closest('[data-id]'); if (!b) return;
    const fixture = HOOK_FIXTURES.find((f) => f.id === b.dataset.id); if (!fixture) return;
    selected = fixture;
    lab.querySelectorAll('[data-id]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ta.value = selected.answer; draw();
  };
  ta.value = selected.answer;
  list.addEventListener('click', choose); ta.addEventListener('input', draw); draw();
  return dispose;
}
