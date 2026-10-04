import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../../public/studio-fable/styles/room.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../../public/studio-fable/app/calibration.mjs',import.meta.url),'utf8');
const cockpit=css.slice(css.indexOf('/* Calibration cockpit */'),css.indexOf('/* Film room */'));
const rule=selector=>cockpit.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*\\{([^}]+)\\}'))?.[1]||'';

test('calibration center cannot grow into the voice rail from intrinsic prompt/media width',()=>{
  const center=rule('.cal-stage-col');
  assert.match(center,/min-width:\s*0/);
  assert.match(center,/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(cockpit,/\.cal > \*, \.cal-stage-col > \*\s*\{[^}]*min-width:\s*0/);
});
test('extra readiness controls use implicit auto rows, not an obsolete fourth 150px row',()=>{
  const center=rule('.cal-stage-col');
  assert.match(center,/grid-template-rows:\s*auto minmax\(180px,\s*1fr\);/);
  assert.match(center,/grid-auto-rows:\s*auto/);
  assert.match(center,/overflow:\s*auto/);
  assert.doesNotMatch(center,/grid-template-rows:[^;]*150px/);
});
test('stacked rehearsal grows naturally instead of stranding controls below a viewport-locked row',()=>{
  const tablet=css.slice(css.indexOf('@media (max-width: 1100px)'),css.indexOf('@media (max-width: 760px)'));
  assert.match(tablet,/\.cal-screen\s*\{[^}]*height:\s*auto/);
  assert.match(tablet,/\.cal\s*\{[^}]*grid-template-columns:\s*1fr/);
});
test('containment preserves the approved rehearsal, real video and all measurement/action surfaces',()=>{
  for(const token of ['cal-steps','cal-prompt','id="stage"','deviceControlsMarkup()','deviceReadinessMarkup()','id="next-step"','id="skip-step"','id="recorder"','rightRailMarkup()'])assert.ok(source.includes(token),token);
  assert.match(cockpit,/\.cal \.stage video\s*\{[^}]*object-fit:\s*contain/);
});
