import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deviceControlsMarkup} from '../../public/studio-fable/app/adapters/device-controls.mjs';

const read=path=>readFileSync(new URL('../../public/studio-fable/'+path,import.meta.url),'utf8');
const room=read('app/room.mjs'),css=read('styles/room.css'),calibration=read('app/calibration.mjs');
const markup=room.slice(room.indexOf('  main.innerHTML = `'),room.indexOf('  const $='));
const count=(source,needle)=>source.split(needle).length-1;

test('the Room renders exactly one device-controls node, mounted by exactly one owner, outside the settings drawer and under the preview',()=>{
  assert.equal(count(markup,'deviceControlsMarkup('),1);
  assert.equal(count(room,'mountDeviceControls('),1);
  assert.ok(markup.includes(`<div class="readiness-dock" data-readiness-dock><details class="room-devices" id="room-devices" data-room-devices open><summary>Devices</summary>\${deviceControlsMarkup({variant:'room'})}</details>`));
  const stage=markup.indexOf('<div class="stage" id="stage"'),note=markup.indexOf('id="enter-note"'),under=markup.indexOf('<div class="under-stage" id="under-stage">'),dock=markup.indexOf('data-readiness-dock'),settings=markup.indexOf('<details class="room-settings" id="room-settings">'),panelEnd=markup.indexOf('</div></details>',settings);
  assert.ok(stage>0&&note>stage&&under>note&&dock>under&&settings>dock,'dock sits under the stage/under-stage row, before the settings drawer');
  assert.equal(markup.slice(settings,panelEnd).includes('deviceControlsMarkup('),false,'settings drawer no longer hosts a second device section');
  assert.equal(markup.slice(settings,panelEnd).includes('data-room-devices'),false);
});

test('switching still goes through the existing controller transaction with the same ownership guards',()=>{
  const connect=room.slice(room.indexOf('  async function connect(){'),room.indexOf('  const onFrame='));
  assert.ok(connect.includes("disposeDevices?.();disposeDevices=await mountDeviceControls(main.querySelector('[data-device-controls]'),{engine,video,getStream:()=>controller.stream,isCurrent:current,"));
  assert.ok(connect.includes("canSwitch:kind=>!starting&&!saving&&!finished&&(controller.phase==='READY'||(controller.phase==='LIVE'&&controller.canSwitchDevice(kind)))"));
  assert.ok(connect.includes("switchDevice:(kind,id)=>controller.switchDevice(kind,id)"));
  assert.ok(connect.includes('await awaitVisibleCamera(video,controller.stream,{isCurrent:current});'));
  assert.ok(connect.includes('assertMicrophoneReady(controller.stream,engine.audioContext);'));
  assert.ok(room.includes("main.querySelector('[data-room-devices]').open=false;"),'Start collapses the popover for the live cockpit');
  assert.equal(count(room,'getUserMedia'),0,'the Room never opens a second stream');
});

test('room variant markup keeps both labelled selects and the status line; the default variant is unchanged for calibration',()=>{
  const variant=deviceControlsMarkup({variant:'room'}),plain=deviceControlsMarkup();
  for(const source of [variant,plain]){
    assert.match(source,/<label class="field">Camera<select data-device-kind="camera" aria-label="Camera"><\/select><\/label>/);
    assert.match(source,/<label class="field">Microphone<select data-device-kind="microphone" aria-label="Microphone"><\/select><\/label>/);
    assert.match(source,/data-device-controls[^>]*hidden/);assert.match(source,/data-device-status/);
    assert.equal((source.match(/data-device-kind=/g)||[]).length,2);
  }
  assert.ok(variant.includes('data-device-variant="room"'));assert.equal(plain.includes('data-device-variant'),false);
  assert.ok(plain.includes('Choose your camera and microphone here.'));
  assert.ok(calibration.includes('${deviceControlsMarkup()}'));
});

test('readiness: pickers are an inline row under the preview; live: one click on Devices opens the same selects beside Settings',()=>{
  assert.match(css,/\.room\[data-phase="readiness"\] \.room-devices \{ position: static; \}/);
  assert.match(css,/\.room\[data-phase="readiness"\] \.room-devices > summary \{ display: none; \}/);
  assert.match(css,/\.room\[data-phase="readiness"\] \.room-devices > \[data-device-controls\] \{ position: static;[^}]*padding: 8px 12px;/);
  assert.match(css,/\.room\[data-phase="readiness"\] \.room-devices \.field \{ display: grid; grid-template-columns: auto minmax\(0, 1fr\);/);
  assert.match(css,/\.room-devices \{ position: absolute; right: 108px; bottom: 0; z-index: 8; \}/);
  assert.match(css,/\.room-devices > summary \{ cursor: pointer;[^}]*min-height: 40px;/);
  assert.match(css,/\.room-devices > \[data-device-controls\] \{ position: absolute; right: 0; bottom: 48px; width: min\(440px, calc\(100vw - 32px\)\);/);
  assert.match(css,/\.room-devices \[data-device-controls\] select \{ min-width: 0; width: 100%; \}/);
  assert.match(css,/\.room:not\(\[data-phase="readiness"\]\) \.under-stage \{ padding-right: 214px; \}/);
  assert.match(css,/\.room-settings \{ position: absolute; right: 0; bottom: 0; z-index: 8; \}/);
});

test('zero-document-scroll desktop contract survives the dock: the cockpit stays a fixed 100dvh grid and the dock is auto-row sized',()=>{
  assert.match(css,/body\[data-mode="room"\] \{ height: 100dvh; overflow: hidden; \}/);
  assert.match(css,/\.room\[data-cockpit="true"\] \{ height: 100dvh; min-height: 0; overflow: hidden;[^}]*grid-template-rows: 48px minmax\(0,1fr\) var\(--rec-h\); \}/);
  assert.match(css,/\.room\[data-cockpit="true"\] \.stage-col \{ grid-column: 2; grid-template-rows: minmax\(0,1fr\) 40px; gap: 8px; \}/);
  assert.match(css,/\.stage-col \{[^}]*grid-auto-rows: auto;/);
  assert.match(css,/\.room \.stage:has\(\.stage-enter\), \.cal \.stage:has\(\.stage-enter\) \{ min-height: 280px; \}/);
  assert.match(css,/1440×900 cockpit budget/);
  assert.match(css,/\.room:not\(\[data-phase="readiness"\]\) \.readiness-dock \{ display: contents; \}/);
  assert.match(css,/\.room\[data-phase="readiness"\] \.room-devices:has\(> \[data-device-controls\]\[hidden\]\) \{ display: none; \}/);
  const dock=css.slice(css.indexOf('/* ---------- Readiness dock'));
  assert.doesNotMatch(dock,/min-height:\s*\d{3,}px|height:\s*\d{3,}px/,'no fixed tall rows are introduced under the stage');
});
