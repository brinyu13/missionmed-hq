import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../../public/studio-fable/styles/app.css',import.meta.url),'utf8');
const selector=readFileSync(new URL('../../public/studio-fable/app/questions/selector.mjs',import.meta.url),'utf8');

test('narrow drawer preserves all filters in one reachable scrolling row, not seven list-consuming rows',()=>{
  const rules=css.slice(css.lastIndexOf('@media (max-width: 760px)'));
  assert.match(rules,/\.drawer-tools \.q-filter\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(rules,/\.drawer-tools \.q-filter\s*\{[^}]*min-width:\s*0/);
  assert.match(rules,/\.drawer-tools \.q-filter\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(rules,/\.drawer-tools \.q-filter button\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(rules,/\.drawer-tools \.q-filter button\s*\{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(rules,/display:\s*none|pointer-events:\s*none|overflow-x:\s*hidden/);
});

test('drawer retains canonical exploration, accessible filters, preview and done actions',()=>{
  assert.match(selector,/FILTERS\.map\(/);
  assert.match(selector,/role="group" aria-label="Filters"/);
  assert.match(selector,/aria-pressed=/);
  assert.match(selector,/role="listbox" aria-label="Questions"/);
  assert.match(selector,/data-preview=/);
  assert.match(selector,/id="selector-done"/);
});
