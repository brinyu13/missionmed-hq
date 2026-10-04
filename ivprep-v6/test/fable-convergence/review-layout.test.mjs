import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../../public/studio-fable/styles/app.css',import.meta.url),'utf8');
const room=readFileSync(new URL('../../public/studio-fable/styles/room.css',import.meta.url),'utf8');

test('coaching evidence labels cannot inherit the Flight Recorder 150px grid track',()=>{
  const label=app.match(/\.evidence \.lane\s*\{([^}]*)\}/)?.[1];
  assert.ok(label);
  assert.match(label,/display:\s*block/);
  assert.match(label,/min-height:\s*0/);
  assert.doesNotMatch(label,/display:\s*none|width:\s*150px/);
});

test('Flight Recorder retains its own dimensional lane composition',()=>{
  assert.match(room,/\.lane\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*150px minmax\(0, 1fr\)/);
});

test('replay stage and grid children cannot transfer live-room viewport minimums into page overflow',()=>{
  assert.match(app,/\.film > \*\s*\{[^}]*min-width:\s*0/);
  assert.match(app,/\.film \.stage\s*\{[^}]*min-height:\s*0[^}]*max-height:\s*none/);
  assert.match(room,/\.film \.stage\s*\{[^}]*aspect-ratio:\s*16 \/ 9/);
});
