import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
const guard = source.slice(source.indexOf('function matrixHref()'), source.indexOf('function firstName()'));
const busy = source.slice(source.indexOf('async function withBusy('), source.indexOf('\nfunction ', source.indexOf('async function withBusy(')));
const selectors = ['data-submit-task', 'data-add-student-form', 'data-save-student', 'data-add-file',
  'data-create-task-form', 'data-create-alert-form', 'data-add-category-form', 'data-add-item-form'];

function fixture() {
  const handlers = {};
  const notices = [];
  const forms = [];
  let confirms = 0;
  let approved = false;
  const link = { target: '', hasAttribute: () => false };
  const context = vm.createContext({ state: { busy: false, config: { matrixBaseUrl: 'https://example.invalid' } },
    document: { addEventListener: (name, fn) => { handlers[name] = fn; } },
    window: { confirm: () => { confirms++; return approved; } },
    notify: (message) => notices.push(message),
    $$: (selector) => forms.filter((form) => selector.includes(`form[${form.selector}]`)),
    HTMLFormElement: { prototype: { reset() { this.elements = structuredClone(this.defaults); } } },
  });
  vm.runInContext(guard + '\n' + busy, context);
  function event(overrides = {}) {
    return { button: 0, defaultPrevented: false, target: { closest: () => link },
      preventDefault() { this.defaultPrevented = true; }, ...overrides };
  }
  function form(selector = selectors[0]) {
    const defaults = [
      { tagName: 'INPUT', name: 'title', type: 'text', value: 'Synthetic' },
      { tagName: 'TEXTAREA', name: 'note', type: 'textarea', value: '' },
      { tagName: 'INPUT', name: 'due', type: 'date', value: '2026-10-14' },
      { tagName: 'INPUT', name: 'required', type: 'checkbox', checked: true },
      { tagName: 'SELECT', name: 'members', type: 'select-multiple', options: [{ selected: true }, { selected: false }] },
    ];
    const result = { selector, defaults, elements: structuredClone(defaults),
      cloneNode() { return { defaults: structuredClone(this.defaults), elements: structuredClone(this.elements) }; } };
    forms.push(result);
    return result;
  }
  return { context, handlers, forms, notices, event, form, link,
    confirms: () => confirms, approve: () => { approved = true; } };
}

test('exact native Matrix target ignores server configuration', () => {
  assert.equal(fixture().context.matrixHref(), 'https://missionmedinstitute.com/member-dashboard/#dashboard');
});

for (const selector of selectors) test(`${selector}: dirty cancel, revert and approved discard`, () => {
  const f = fixture(); const form = f.form(selector);
  let e = f.event(); f.handlers.click(e); assert.equal(e.defaultPrevented, false); assert.equal(f.confirms(), 0);
  form.elements[1].value = 'Synthetic unsaved note';
  const before = structuredClone(form.elements);
  e = f.event(); f.handlers.pointerdown(e); assert.equal(e.defaultPrevented, true);
  e = f.event(); f.handlers.click(e); assert.equal(e.defaultPrevented, true);
  assert.deepEqual(form.elements, before); assert.equal(f.forms[0], form);
  f.approve(); e = f.event(); f.handlers.click(e); assert.equal(e.defaultPrevented, false);
  form.elements[1].value = ''; assert.equal(f.context.hasUnsavedReturnForms(), false);
});

test('date, checkbox and multiselect changes are detected and reversible', () => {
  const f = fixture(); const form = f.form();
  for (const edit of [() => { form.elements[2].value = '2026-10-15'; },
    () => { form.elements[3].checked = false; }, () => { form.elements[4].options[1].selected = true; }]) {
    edit(); assert.equal(f.context.hasUnsavedReturnForms(), true);
    form.elements = structuredClone(form.defaults); assert.equal(f.context.hasUnsavedReturnForms(), false);
  }
});

test('ephemeral search/filter is excluded; modified and new-tab activation preserve original tab', () => {
  const f = fixture(); f.form('data-roster-search').elements[0].value = 'filter';
  assert.equal(f.context.hasUnsavedReturnForms(), false);
  f.form().elements[0].value = 'unsaved'; f.context.state.busy = true;
  for (const override of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const e = f.event(override); f.handlers.click(e); assert.equal(e.defaultPrevented, false);
  }
  f.link.target = '_blank'; const e = f.event(); f.handlers.click(e);
  assert.equal(e.defaultPrevented, false); assert.equal(f.confirms(), 0); assert.equal(f.notices.length, 0);
});

for (const result of ['success', 'write-failure', 'refresh-failure']) test(`pending ${result}: no duplicate work; mounted edits remain dirty`, async () => {
  const f = fixture(); const form = f.form();
  form.elements[0].value = 'Synthetic pending draft';
  let finish; let writes = 0; let refreshes = 0;
  const pending = new Promise((resolve) => { finish = resolve; });
  const saving = f.context.withBusy(async () => {
    writes++; await pending;
    if (result === 'write-failure') throw new Error('Synthetic write failure');
    refreshes++;
    if (result === 'refresh-failure') throw new Error('Synthetic refresh failure');
  });
  form.elements[1].value = 'Synthetic edit while pending';
  const e = f.event({ detail: 0 }); f.handlers.click(e);
  assert.equal(e.defaultPrevented, true); assert.equal(f.confirms(), 0);
  assert.match(f.notices[0], /wait/); assert.equal(writes, 1);
  finish(); await saving;
  assert.equal(f.context.state.busy, false); assert.equal(f.context.hasUnsavedReturnForms(), true);
  assert.equal(writes, 1); assert.equal(refreshes, result === 'write-failure' ? 0 : 1);
  if (result === 'success') { f.forms.length = 0; f.form(); assert.equal(f.context.hasUnsavedReturnForms(), false); }
});

test('one Return presentation per shell/gate, retry removes old header action, full mobile label', () => {
  const shell = source.slice(source.indexOf('function renderShell()'), source.indexOf('function clearOverlays()'));
  const lockout = source.slice(source.indexOf('function renderLockout('), source.indexOf('function renderStartupFailure()'));
  const failure = source.slice(source.indexOf('function renderStartupFailure()'), source.indexOf('function dismissOpening()'));
  assert.equal((shell.match(/<a[^>]*data-return-matrix/g) || []).length, 1);
  for (const markup of [shell, lockout, failure]) assert.match(markup, /Return to Matrix/);
  assert.match(failure, /hdr\.querySelector\('\[data-return-matrix\]'\)\?\.remove\(\)/);
  const css = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /storyforgeMatrixBack span:last-child\{display:none/);
  assert.match(css, /storyforgeMatrixBack:focus-visible/);
  assert.doesNotMatch(guard, /beforeunload|localStorage|sessionStorage|api\./);
});
