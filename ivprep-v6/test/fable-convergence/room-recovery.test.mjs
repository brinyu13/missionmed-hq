import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactRecorderLanes,LiveRecorder} from '../../public/studio-fable/app/instruments/flight-recorder.mjs';
import {COACHING_CONFIG,mapToLiveScale} from '../../public/analytics/coaching-config.mjs';
import {CALIBRATION} from '../../public/ivoc-standalone/app/data.mjs';

test('failed startup restores readiness rather than claiming an interviewer is listening',()=>{
  const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  function restoreReadinessPresence(){');
  const helper=source.slice(start,source.indexOf('  async function start(){',start));
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:''});return nodes.get(id);};
  const room={dataset:{phase:'live'}};$('presence').dataset.speaking='true';$('presence-state').textContent='listening';
  Function('room','$','mode','practiceQ',helper+'restoreReadinessPresence();')(room,$,'mock',{});
  assert.equal(room.dataset.phase,'readiness');assert.equal($('presence').dataset.speaking,'false');
  assert.equal($('presence-state').textContent,'waiting');assert.equal($('presence-sub').textContent,'Your interview has not started.');
  assert.match(source,/catch\(error\)\{if\(current\(\)\)\{restoreReadinessPresence\(\)/);
  assert.ok(source.includes("status.state==='active'&&started"),'GPT readiness alone must not imply the complete room is live');
  assert.ok(source.includes('Your connection changed before the interviewer was ready. The interview did not start.'));
});

test('failed self practice retains question identity without pretending a recording began',()=>{
  const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  function restoreReadinessPresence(){');
  const helper=source.slice(start,source.indexOf('  async function start(){',start));
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:''});return nodes.get(id);};
  Function('room','$','mode','practiceQ',helper+'restoreReadinessPresence();')({dataset:{}},$,'practice',{canonical_text:'Tell me about yourself.'});
  assert.equal($('presence-sub').textContent,'Your answer recording has not started.');
  assert.equal($('presence-line').textContent,'Tell me about yourself.');
});

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


// Execute the actual room functions with device/provider-free dependencies.
function startupHarness({ready=true,current=true,cameraError=new Error('Camera disconnected. Connect it again before starting.')}={}){
  const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const block=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
  const presenter=block('  function presentDeviceFailure(','  function captureReadiness()');
  const connectSource=block('  async function connect(){','  const onFrame=');
  const startSource=block('  function restoreReadinessPresence(){',"  $('connect-real').addEventListener");
  const readiness=block('onReadinessChanged:readiness=>{','},onChanged:').replace('onReadinessChanged:readiness=>{','function notifyReadiness(readiness){')+'}';
  const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:true,disabled:false,value:'voice',textContent:'',append(){},animate(){}});return nodes.get(id);};
  const calls={providers:0,begins:0,acquires:0,releases:0,captures:0};
  const env={ready,current,cameraError,release:()=>Promise.resolve(),camera:null};
  const engine={audioContext:{state:'running'},events:{addEventListener(){},removeEventListener(){}}};
  const stream={getVideoTracks:()=>[],getAudioTracks:()=>[]};
  const controller={engine,stream,video:{},mountVideo:()=>({}),acquire:async()=>{calls.acquires++;return engine;},release:()=>{calls.releases++;return env.release();},startSession:async()=>{calls.providers++;throw new Error('Unexpected provider');}};
  const run=Function('env','calls','controller','$','initialEngine',`
    let startupFailure=null,starting=false,started=false,deviceSwitching=false,saving=false,finished=false,engine=initialEngine,disposed=false;
    let interviewEmbodiment=null,initialPresentationMode=null,entryAbort=null,disposePrimary=null,founderQa=null,avatarDurationSeconds=0;
    const current=()=>env.current,preInterviewReady=()=>env.ready,avatarBlocked=()=>false,mode='mock',density='interview',settings={},session={},account={},durable={},practiceQ={},room={dataset:{}},main={querySelectorAll:()=>[]};
    const setDensityControls=()=>{},bindPrimaryRecovery=()=>()=>{},assertMicrophoneReady=()=>{},captureReadiness=()=>{calls.captures++;},startPreviewAnalytics=()=>{calls.begins++;},applyOverlays=()=>{},disposeEnvironment={refresh(){}},disposeDevices={refresh:async()=>{}};
    const document={createElement:()=>({})};
    const awaitVisibleCamera=()=>env.camera?env.camera():Promise.reject(env.cameraError);
    ${presenter}\n${connectSource}\n${startSource}\n${readiness}
    return {start,connect,notifyReadiness,failure:()=>startupFailure,starting:()=>starting};
  `)(env,calls,controller,$,engine);
  return{...run,env,calls,$,controller};
}
const flushStartup=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('actual Start preflight fallback reports camera failure with device-only recovery',async()=>{
  const f=startupHarness({ready:false});await f.start();await flushStartup();
  assert.equal(f.calls.acquires,1);assert.equal(f.calls.providers,0);assert.equal(f.calls.begins,0);
  assert.equal(f.$('enter-note').textContent,f.env.cameraError.message);
  assert.equal(f.$('connect-real').hidden,false);assert.equal(f.$('connect-real').disabled,false);
  assert.equal(f.$('start-session').disabled,true);assert.equal(f.starting(),false);
  f.notifyReadiness({message:'Later microphone notice'});assert.equal(f.$('enter-note').textContent,f.env.cameraError.message);
});
test('actual Start reports error before cleanup drains and explicit reconnect resets it',async()=>{
  const f=startupHarness();let finishRelease;f.env.release=()=>new Promise(resolve=>{finishRelease=resolve;});
  const pending=f.start();await flushStartup();
  assert.equal(f.calls.releases,1);assert.match(f.$('enter-note').textContent,/Interview did not start.*Camera disconnected/);
  assert.equal(f.$('connect-real').hidden,false);assert.equal(f.$('connect-real').disabled,true);assert.equal(f.$('start-session').disabled,true);
  const note=f.$('enter-note').textContent;f.notifyReadiness({message:'Microphone changed'});assert.equal(f.$('enter-note').textContent,note);
  finishRelease();await pending;assert.equal(f.$('connect-real').disabled,false);
  let finishCamera;f.env.camera=()=>new Promise(resolve=>{finishCamera=resolve;});
  const recovery=f.connect();await flushStartup();assert.equal(f.failure(),null);assert.match(f.$('enter-note').textContent,/Connecting your camera/);
  assert.equal(f.calls.providers,0);assert.equal(f.calls.begins,0);
  // Cancel the old room during device-only recovery; no replacement capture is touched.
  f.env.current=false;finishCamera();await recovery;assert.equal(f.calls.releases,1);assert.equal(f.calls.providers,0);
});
test('late camera rejection from stale room cannot change UI or release replacement',async()=>{
  const f=startupHarness();let rejectCamera;f.env.camera=()=>new Promise((_,reject)=>{rejectCamera=reject;});
  const pending=f.start();await flushStartup();const before=f.$('enter-note').textContent;
  f.env.current=false;f.controller.engine={replacement:true};rejectCamera(new Error('Late old camera error'));await pending;
  assert.equal(f.$('enter-note').textContent,before);assert.equal(f.calls.releases,0);assert.equal(f.calls.providers,0);assert.equal(f.calls.begins,0);
});
