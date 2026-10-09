import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../../public/studio-fable/styles/room.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../../public/studio-fable/app/calibration.mjs',import.meta.url),'utf8');
const cockpit=css.slice(css.indexOf('/* Calibration cockpit */'),css.indexOf('/* Film room */'));
const rule=selector=>cockpit.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^}]+)\\}'))?.[1]||'';

test('return-to-setup stays inside the header, preserving the three-row calibration grid',()=>{
  assert.match(source,/<div class="screen-head"><div><a [^>]*id="return-setup"/);
  assert.doesNotMatch(source,/<section class="cal-screen">\s*<a/);
  assert.match(source,/returnToMock\)\{\$\('return-setup'\)\.hidden=false/);
});

test('calibration center cannot grow into the voice rail from intrinsic prompt/media width',()=>{
  const center=rule('.cal-stage-col');
  assert.match(center,/min-width:\s*0/);
  assert.match(center,/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(cockpit,/\.cal > \*, \.cal-stage-col > \*\s*\{[^}]*min-width:\s*0/);
});
test('calibration has one primary scroll owner and natural rows, not nested locked regions',()=>{
  const center=rule('.cal-stage-col');
  assert.match(center,/grid-auto-rows:\s*auto/);
  assert.match(center,/overflow:\s*visible/);
  assert.match(rule('.cal-screen'),/height:\s*auto/);
  assert.match(rule('.cal-lower-wrap[open]'),/overflow:\s*visible/);
  assert.doesNotMatch(center,/grid-template-rows:[^;]*150px/);
});
test('stacked rehearsal grows naturally instead of stranding controls below a viewport-locked row',()=>{
  const tablet=css.slice(css.indexOf('@media (max-width: 1100px)'),css.indexOf('@media (max-width: 760px)'));
  assert.match(tablet,/\.cal-screen\s*\{[^}]*height:\s*auto/);
  assert.match(tablet,/\.cal\s*\{[^}]*grid-template-columns:\s*1fr/);
});
test('containment preserves the approved rehearsal, real video and all measurement/action surfaces',()=>{
  for(const token of ['cal-steps','cal-prompt','id="stage"','deviceControlsMarkup()','deviceReadinessMarkup({fullPanels:true})','id="next-step"','id="skip-step"','id="recorder"','rightRailMarkup()'])assert.ok(source.includes(token),token);
  assert.match(cockpit,/\.cal \.stage video\s*\{[^}]*object-fit:\s*contain/);
});
test('camera and microphone fields cannot inherit the general 360px secondary-column layout',()=>{
  const picker=rule('.cal [data-device-controls] .two-col');
  assert.match(picker,/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  const select=rule('.cal [data-device-controls] select');
  assert.match(select,/min-width:\s*0/);
  assert.match(select,/width:\s*100%/);
});
