import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectReadinessLines,readinessLinesMarkup,mountReadinessLines} from '../../public/studio-fable/app/adapters/readiness-status.mjs';

const read=path=>readFileSync(new URL('../../public/studio-fable/'+path,import.meta.url),'utf8');
const room=read('app/room.mjs'),css=read('styles/room.css');
const byId=rows=>Object.fromEntries(rows.map(row=>[row.id,row]));

test('three lines follow the existing gating state: idle → checking → ready, and attention routes to the named device only',()=>{
  let rows=byId(projectReadinessLines({mode:'mock',liveInterviewAvailable:true}));
  assert.deepEqual([rows.camera.state,rows.microphone.state,rows.interviewer.state],['idle','idle','ready']);
  assert.equal(rows.camera.text,'Not connected yet');assert.equal(rows.interviewer.text,'Interviewer joins when you start');
  rows=byId(projectReadinessLines({checking:true}));assert.equal(rows.camera.state,'checking');assert.equal(rows.microphone.text,'Checking microphone…');
  rows=byId(projectReadinessLines({previewReady:true,note:'The camera preview is black. Choose another camera.'}));
  assert.equal(rows.camera.state,'ready');assert.equal(rows.microphone.state,'ready','an admitted preview is truthful even if an old note lingers');
  rows=byId(projectReadinessLines({note:'The camera preview is black. Choose another camera.',rechecked:true}));
  assert.equal(rows.camera.state,'attention');assert.equal(rows.microphone.state,'idle');assert.equal(rows.microphone.text,'Not confirmed · check the preview again');
  rows=byId(projectReadinessLines({note:'Your microphone is not ready. Reconnect it or choose a microphone below before starting.'}));
  assert.equal(rows.microphone.state,'attention');assert.equal(rows.camera.state,'idle');
  rows=byId(projectReadinessLines({note:'Your connection changed before the interviewer was ready. The interview did not start.',rechecked:true}));
  assert.equal(rows.camera.state,'idle');assert.equal(rows.microphone.state,'idle','an unrelated failure never blames a device');
  rows=byId(projectReadinessLines({mode:'mock',liveInterviewAvailable:false}));assert.equal(rows.interviewer.state,'attention');assert.match(rows.interviewer.text,/unavailable/);
  rows=byId(projectReadinessLines({mode:'mock',liveInterviewAvailable:'true'}));assert.equal(rows.interviewer.state,'attention','only the literal boolean counts');
  assert.equal(byId(projectReadinessLines({mode:'practice'})).interviewer.text,'Self practice · no interviewer');
});

test('markup escapes and exposes three labelled rows',()=>{
  const markup=readinessLinesMarkup(projectReadinessLines({mode:'mock',liveInterviewAvailable:true}));
  assert.match(markup,/<ul class="readiness-lines" id="readiness-lines" aria-label="Readiness">/);
  assert.equal((markup.match(/<li data-readiness-line="/g)||[]).length,3);
  assert.ok(readinessLinesMarkup([{id:'camera',state:'idle',text:'<b>x</b>'}]).includes('&lt;b&gt;x&lt;/b&gt;'));
});

function dom(){
  const rows=['camera','microphone','interviewer'].map(id=>({dataset:{},glyph:{textContent:''},text:{textContent:''},querySelector(sel){return sel==='i'?this.glyph:this.text;},id}));
  const host={querySelector:selector=>rows.find(row=>selector.includes('"'+row.id+'"'))||null};
  const stage={dataset:{previewReady:'false'}},connect={disabled:false,textContent:'Connect camera + mic'},note={hidden:false,textContent:''},room={dataset:{phase:'readiness'}},devices={open:false};
  const observers=[];class Observer{constructor(fn){this.fn=fn;this.targets=[];this.disconnected=false;observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){this.disconnected=true;}}
  return{rows,host,stage,connect,note,room,devices,observers,Observer,fire:()=>observers.forEach(o=>o.fn())};
}
test('mounted lines repaint from the room DOM, keep readiness pickers open, never touch Start, and disconnect on dispose',()=>{
  const d=dom();
  const dispose=mountReadinessLines(d.host,{room:d.room,stage:d.stage,note:d.note,connect:d.connect,devices:d.devices,mode:'mock',liveInterviewAvailable:true,MutationObserverCtor:d.Observer});
  assert.equal(d.rows[0].dataset.state,'idle');assert.equal(d.devices.open,true,'readiness forces the inline picker open');
  assert.equal(d.observers.length,1);assert.deepEqual(d.observers[0].targets.map(t=>t.target),[d.stage,d.connect,d.note,d.room]);
  d.connect.disabled=true;d.fire();assert.equal(d.rows[0].dataset.state,'checking');assert.equal(d.rows[1].text.textContent,'Checking microphone…');
  d.connect.disabled=false;d.note.textContent='The camera preview is black. Choose another camera.';d.connect.textContent='Check preview again';d.fire();
  assert.equal(d.rows[0].dataset.state,'attention');assert.equal(d.rows[1].text.textContent,'Not confirmed · check the preview again');
  d.stage.dataset.previewReady='true';d.fire();assert.equal(d.rows[0].dataset.state,'ready');assert.equal(d.rows[0].glyph.textContent,'✓');
  d.room.dataset.phase='live';d.devices.open=false;d.fire();assert.equal(d.devices.open,false,'live keeps the popover closed until the student clicks Devices');
  d.note.hidden=true;d.stage.dataset.previewReady='false';d.fire();assert.equal(d.rows[0].dataset.state,'idle');
  dispose();assert.equal(d.observers[0].disconnected,true);
  assert.equal(typeof mountReadinessLines(null),'function');
  const quiet=dom();mountReadinessLines(quiet.host,{stage:quiet.stage,connect:quiet.connect,MutationObserverCtor:null});assert.equal(quiet.observers.length,0);
});

test('actual Room mounts the lines after its instruments, disposes them on leave, and keeps the gating predicates',()=>{
  assert.ok(room.includes("import {projectReadinessLines,readinessLinesMarkup,mountReadinessLines} from './adapters/readiness-status.mjs';"));
  assert.ok(room.includes("${readinessLinesMarkup(projectReadinessLines({mode,liveInterviewAvailable:account?.liveInterviewAvailable===true}))}"));
  const mount=room.indexOf("const disposeReadinessLines=mountReadinessLines($('readiness-lines'),{room,stage:$('stage'),note:$('enter-note'),connect:$('connect-real'),devices:null,mode,liveInterviewAvailable:account?.liveInterviewAvailable===true});");
  assert.ok(mount>room.indexOf('  applyOverlays();renderPlan();renderTranscript();'));
  assert.ok(room.includes('return ()=>{disposed=true;entryAbort?.abort();disposeReadinessLines();disposeEnvironment();'));
  // Start stays disabled until the real visible frame and microphone are admitted; the lines only read that state.
  const connect=room.slice(room.indexOf('  async function connect(){'),room.indexOf('  const onFrame='));
  assert.ok(connect.includes("$('stage').dataset.previewReady='false';$('start-session').disabled=true;"));
  assert.ok(connect.includes("await awaitVisibleCamera(video,controller.stream,{isCurrent:current});"));
  assert.ok(connect.includes("assertMicrophoneReady(controller.stream,engine.audioContext);\n      $('stage').dataset.previewReady='true';\n      $('start-session').disabled=avatarBlocked();"));
  const start=room.slice(room.indexOf('  async function start(){'),room.indexOf("  $('connect-real').addEventListener"));
  assert.ok(start.includes('await awaitVisibleCamera(controller.video,controller.stream,{isCurrent:current});'));
  assert.ok(start.includes('assertMicrophoneReady(controller.stream,engine.audioContext);'));
  assert.equal(read('app/adapters/readiness-status.mjs').includes('start-session'),false,'the status adapter never reaches for Start');
});

test('enter overlay copy is short: priority line plus the two actions; the connect instructions moved into the readiness lines',()=>{
  const markup=room.slice(room.indexOf('<div class="stage-enter" id="enter">'),room.indexOf('<p class="note readiness-status" id="enter-note"'));
  assert.equal(markup.includes('Connect your camera and microphone. Check your visible preview'),false);
  assert.match(markup,/<p>\$\{mode === 'mock' \? `Priority: /);
  assert.ok(markup.includes('id="connect-real" hidden>Reconnect devices</button>'));
  assert.ok(markup.includes('id="start-session" disabled>'));
  assert.ok(markup.includes("mode==='mock'&&account?.mode==='REAL'&&account.role==='admin'?"),'admin voice audition stays collapsed in its details');
  assert.match(css,/\.room:not\(\[data-phase="readiness"\]\) \.readiness-lines \{ display: none; \}/);
  assert.match(css,/\.readiness-lines li\[data-state="ready"\] i \{ background: var\(--ok\);/);
});
