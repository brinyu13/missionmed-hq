import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactRecorderLanes,LiveRecorder} from '../../public/studio-fable/app/instruments/flight-recorder.mjs';
import {COACHING_CONFIG,mapToLiveScale} from '../../public/analytics/coaching-config.mjs';
import {CALIBRATION} from '../../public/ivoc-standalone/app/data.mjs';

test('compact recovered deck exposes all non-voice lanes without inventing observations',()=>{
  const empty=compactRecorderLanes([],[]);
  assert.equal(empty.length,11);assert.ok(empty.every(l=>!l.bands?.length&&!l.marks?.length));
  const samples=[{t:1,state:'LISTENING',hands:'UNAVAILABLE',presence:'SEARCHING',signalGap:true},
    {t:1.5,state:'ANSWERING',hands:'BOTH',presence:'TRACKED',signalGap:false},
    {t:3,state:'ANSWERING',hands:'BOTH',presence:'TRACKED',signalGap:false}];
  const events=[{t:1.6,kind:'hook',label:'Possible hook: research'}, {t:2,kind:'followup',label:'Matching follow-up text'},
    {t:2.5,kind:'framing',label:'CENTERED'}, {t:0,kind:'recording',label:'Recording started'}];
  const lanes=compactRecorderLanes(samples,events);
  assert.equal(lanes.find(l=>l.name==='Hooks').marks[0].t,1.6);
  assert.equal(lanes.find(l=>l.name==='Smiles').marks.length,0);
  assert.equal(lanes.find(l=>l.name==='Hands').bands.length,3,'missing intervals remain unfilled');
  assert.equal(lanes.find(l=>l.name==='Framing / presence').marks[0].value,'CENTERED');
  assert.equal(lanes.find(l=>l.name==='Question / turn').marks[0].t,2);
});

test('actual live canvas draws recovered solid bands and lane names at cockpit size',()=>{
  const labels=[],blocks=[];
  const ctx=new Proxy({fillText:text=>labels.push(text),fillRect:(...rect)=>blocks.push(rect)},
    {get:(target,key)=>target[key]||(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const canvas={clientWidth:1440,clientHeight:60,getContext:()=>ctx},eventsCanvas={...canvas,clientHeight:106};
  const root={querySelector:key=>key==='#fr-canvas'?canvas:key==='#fr-events'?eventsCanvas:key==='#fr-clock'?{}:null};
  const previous={addEventListener:globalThis.addEventListener,removeEventListener:globalThis.removeEventListener,devicePixelRatio:globalThis.devicePixelRatio};
  globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};globalThis.devicePixelRatio=1;
  let recorder;
  try{recorder=new LiveRecorder(root);recorder.setData([{t:1,state:'ANSWERING',hands:'BOTH',presence:'TRACKED',signalGap:false,pitch:null,scores:{volume:7}}],[{t:1,kind:'smile'}]);recorder.tick(2);
    for(const name of compactRecorderLanes([],[]).map(l=>l.name))assert.ok(labels.includes(name),name);
    assert.ok(blocks.some(rect=>rect[2]===4),'events are filled blocks');
    eventsCanvas.clientHeight=120;recorder.tick(3);
    assert.equal(eventsCanvas.height,120,'height-only viewport changes resize the backing canvas');
  }finally{recorder?.destroy();Object.assign(globalThis,previous);}
});

test('missing orientation is unavailable, not a fabricated zero-percent facing value',()=>{
  const source=readFileSync(new URL('../../public/ivoc-standalone/app/real-runtime.mjs',import.meta.url),'utf8');
  const helpers=source.slice(source.indexOf('const clamp'),source.indexOf('export class RealAnalyticsEngine'));
  const start=source.indexOf('  mapFrame('),method=source.slice(start,source.indexOf('\n  clearOverlay()',start));
  const map=Function('COACHING_CONFIG','mapToLiveScale','CALIBRATION',helpers+'return {'+method+'};')(COACHING_CONFIG,mapToLiveScale,CALIBRATION).mapFrame;
  const owner={t:0,latest:null,latestAudioSpeaking:false,wordTimingState:{},faceBaselineState:{}};
  assert.equal(map.call(owner,{metrics:{HEAD_FACE:{facePresent:true}}},{}).headFace.cameraFacingPct,null);
});

test('room retains capture owner and moves setup into one settings popover',()=>{
  const room=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../public/studio-fable/styles/room.css',import.meta.url),'utf8');
  assert.ok(room.includes('data-phase="readiness"'));assert.ok(room.includes("room.dataset.phase='live'"));
  assert.ok(room.includes('data-embodiment-host'));assert.ok(room.includes('id="room-settings"'));
  assert.equal((room.match(/id="end"/g)||[]).length,1);
  assert.ok(room.includes("controller.mountVideo($('stage'),$('overlay'))"));
  assert.match(css,/height: 100dvh; min-height: 0; overflow: hidden/);
  assert.match(css,/\.room-settings-panel[^}]*position: absolute/);
  assert.match(css,/\.room\[data-cockpit="true"\]\[data-density="interview"\] \.rail \{ display: none; \}/);
  assert.match(css,/\.room\[data-cockpit="true"\]\[data-density="interview"\] \.recorder-body[^}]*display: none/);
  assert.match(css,/@media \(min-width: 1101px\) and \(max-height: 759px\)[\s\S]*?body\[data-mode="room"\] \{ height: auto; overflow: auto; \}/);
});
