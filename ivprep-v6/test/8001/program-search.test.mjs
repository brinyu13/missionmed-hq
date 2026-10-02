import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { IvocApi } from '../../public/ivoc-standalone/app/api.mjs';

const source = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('async function searchProgramPage('), source.indexOf('\nfunction renderEnvironmentStep('));
class Element {
  constructor(tag, cls, text = '') { this.tag = tag; this.className = cls; this.textContent = text; this.children = []; this.listeners = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
}
const all = node => [node, ...node.children.flatMap(all)];
const result = (page = 1, release = 'release-a') => ({ page, pageSize: 12, total: 44, totalPages: 4, registryReleaseId: release,
  records: [{ id: `program-${page}`, name: `Page ${page} program`, specialty: 'Radiation Oncology', state: 'NY', programType: 'University-based' }] });
function harness(programs = async input => result(input.page)) {
  const state = { view: 'newsession', wizardStep: 3, role: 'student', admission: { identity: { subject: 'wp:1' } },
    durableAvailable: true, durable: { programs }, programSearch: { status: 'idle' },
    wizard: { program: 'suny', programSpecialty: '', programState: '', programType: 'University', contextSources: [] } };
  let host, renders = 0, fns;
  const el = (...args) => new Element(...args);
  const render = () => { renders++; host = el('section'); fns.renderProgramStep(host); };
  fns = new Function('state', 'el', 'choiceButton', 'Option', 'WIZARD_STEPS', 'renderWizard', 'renderProgramCalendar', 'programSearchFailureCopy',
    `${code}; return { renderProgramStep, searchProgramPage };`)(state, el,
    ({ label, detail, className, onClick }) => { const node = el('button', className, label); node.detail = detail; node.listeners.click = onClick; return node; },
    function Option(text, value) { const node = el('option', '', text); node.value = value; return node; },
    [{}, {}, {}, { key: 'program' }], render, () => {}, () => 'Search unavailable');
  render();
  return { state, render, search: fns.searchProgramPage, nodes: () => all(host), renders: () => renders,
    button: name => all(host).find(n => n.tag === 'button' && n.textContent === name),
    input: () => all(host).find(n => n.tag === 'input'),
    text: () => all(host).map(n => n.textContent).join(' ') };
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('real program renderer pages with original filters, then selects exact later-page release and identity', async () => {
  const calls = [];
  const h = harness(async input => { calls.push(input); return result(input.page, `release-${input.page}`); });
  await h.button('Search verified programs').listeners.click();
  assert.match(h.text(), /44 verified results · Page 1 of 4/);
  assert.equal(h.button('Previous programs').disabled, true);
  await h.button('Next programs').listeners.click();
  assert.equal(calls[1].page, 2); assert.equal(calls[1].q, 'suny');
  assert.equal(calls[1].programType, 'University');
  await h.button('Page 2 program').listeners.click();
  assert.equal(h.state.wizard.programId, 'program-2');
  assert.equal(h.state.wizard.programReleaseId, 'release-2');
  assert.deepEqual(h.state.wizard.contextSources, ['RISE']);
  assert.match(h.text(), /Verified RISE program selected/);
  assert.equal(h.button('Next programs'), undefined);
  assert.ok(h.nodes().some(n => n.tag === 'option' && n.value === 'NY'));
  h.state.programSearch = { status: 'ready', ...result(4) }; h.render();
  assert.equal(h.button('Next programs').disabled, true);
  await h.button('Previous programs').listeners.click();
  assert.equal(calls.at(-1).page, 3);
});

test('editing filters removes stale visible results, selection and old result click authority', async () => {
  const h = harness(); await h.search();
  const stale = h.button('Page 1 program');
  const input = h.input(); input.value = 'changed'; input.listeners.input();
  assert.doesNotMatch(h.text(), /Page 1 program/);
  stale.listeners.click(); assert.equal(h.state.wizard.programId, null);
  await h.search(); h.button('Page 1 program').listeners.click();
  const selectedInput = h.input(); selectedInput.value = 'new name'; selectedInput.listeners.input();
  assert.equal(h.state.wizard.programVerified, false);
  assert.doesNotMatch(h.text(), /Verified RISE program selected/);
  assert.deepEqual(h.state.wizard.contextSources, []);
});

test('older search success/error cannot replace a newer search or cross actor/role/setup boundaries', async () => {
  for (const reject of [false, true]) {
    const old = deferred(); let count = 0;
    const h = harness(async () => ++count === 1 ? old.promise : result(2));
    const first = h.search();
    const input = h.input(); input.value = 'new'; input.listeners.input();
    await h.search(2); const accepted = h.state.programSearch;
    if (reject) old.reject(new Error('old failure')); else old.resolve(result(1));
    await first; assert.equal(h.state.programSearch, accepted);
  }
  for (const change of [h => { h.state.admission.identity.subject = 'wp:2'; }, h => { h.state.role = 'admin'; }, h => { h.state.wizard = { ...h.state.wizard }; }]) {
    const wait = deferred(), h = harness(() => wait.promise), pending = h.search();
    change(h); wait.resolve(result()); await pending;
    assert.equal(h.state.programSearch.status, 'idle');
    assert.doesNotMatch(h.text(), /Page 1 program/);
  }
});

test('search completion does not redraw the Builder over a different screen', async () => {
  const wait = deferred(), h = harness(() => wait.promise), pending = h.search();
  h.state.view = 'home'; const renders = h.renders(); wait.resolve(result()); await pending;
  assert.equal(h.renders(), renders);
});

test('production API adapter forwards page without changing same-origin credential boundary', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.match(url, /\/programs\/search\?q=suny&programType=University&page=3$/);
      assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
      return new Response(JSON.stringify(result(3)));
    };
    assert.equal((await new IvocApi().searchPrograms({ q: 'suny', programType: 'University', page: 3 })).page, 3);
  } finally { globalThis.fetch = original; }
});
