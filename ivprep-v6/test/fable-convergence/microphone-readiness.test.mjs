import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionController} from '../../public/studio-fable/app/controller/session-controller.mjs';
import {mountDeviceControls} from '../../public/studio-fable/app/adapters/device-controls.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}};
const policy={schema:'ivoc.interview-policy.v1',version:4,maxFollowUpsPerAnswer:2,defaultFollowUpDepth:1,defaultPressureEnabled:false};
function harness(changeAt=null,change=()=>{}){
  const mic=Object.assign(new EventTarget(),{readyState:'live',enabled:true,muted:false});
  const context=Object.assign(new EventTarget(),{state:'running'});
  const camera={readyState:'live',enabled:true,muted:false};
  const stream={getAudioTracks:()=>[mic],getVideoTracks:()=>[camera]},calls={reads:0,prepares:0,recorders:0,begins:0,providers:0,stops:0,abandons:0,mixes:0};
  const mutate=boundary=>{if(changeAt===boundary)change({mic,context,engine});};
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>{mutate('admission'+(++calls.reads));return{entitlement:{admitted:true},identity:api.identity,interviewPolicy:policy};}};
  const durable={ready:true,api,accountSession:null,recorder:null,
    async prepare(){calls.prepares++;this.accountSession={id:'unit-session'};mutate('prepare');},
    async start(){calls.recorders++;this.recorder={startedAt:100};mutate('record');},
    async abandon(){calls.abandons++;this.accountSession=null;}};
  const engine={stream,audioContext:context,beginSession:async()=>{calls.begins++;mutate('measurement');}};
  const controller=new SessionController({mixFactory:()=>{calls.mixes++;mutate('mix');return null;},liveFactory:()=>({connect:async()=>{calls.providers++;mutate('provider');},stop:async()=>{calls.stops++;}})});
  controller.account={mode:'REAL',subject:'wp:1',role:'student',api,durable,liveInterviewAvailable:true,interviewPolicy:policy};
  controller.durable=durable;controller.engine=engine;controller.phase='READY';
  const input={mode:'mock',question:{question_id:'CORE-01',canonical_text:'Tell me about yourself.'},interviewSet:[],wizard:{interviewPolicyVersion:4,followUpDepth:1,maxFollowUps:4},targetQuestions:1};
  return{controller,input,mic,context,stream,engine,calls};
}
for(const [name,change]of [['ended',f=>{f.mic.readyState='ended';}],['disabled',f=>{f.mic.enabled=false;}],['muted',f=>{f.mic.muted=true;}],['audio paused',f=>{f.context.state='suspended';}],['audio absent',f=>{f.engine.audioContext=null;}]]){
  test('actual controller refuses '+name+' microphone before preparation/recording/provider',async()=>{
    const f=harness();change(f);await assert.rejects(f.controller.startSession(f.input),/microphone|audio/i);
    assert.equal(f.calls.prepares,0);assert.equal(f.calls.recorders,0);assert.equal(f.calls.providers,0);assert.equal(f.controller.phase,'READY');
  });
}
for(const boundary of ['admission1','prepare','admission2'])test('microphone ending during '+boundary+' cannot reach recording or provider',async()=>{
  const f=harness(boundary,({mic})=>{mic.readyState='ended';});
  await assert.rejects(f.controller.startSession(f.input),/microphone/i);
  assert.equal(f.calls.recorders,0);assert.equal(f.calls.mixes,0);assert.equal(f.calls.providers,0);assert.equal(f.controller.phase,'READY');
  if(boundary==='admission1')assert.equal(f.calls.prepares,0);else assert.equal(f.calls.abandons,1);
});
for(const boundary of ['record','measurement'])test('microphone lost during '+boundary+' drains existing recording without starting provider',async()=>{
  const f=harness(boundary,({mic})=>{mic.muted=true;});
  await assert.rejects(f.controller.startSession(f.input),/microphone/i);
  assert.equal(f.calls.recorders,1);assert.equal(f.calls.providers,0);assert.equal(f.calls.abandons,1);assert.equal(f.controller.phase,'READY');assert.equal(f.controller.durableActive,false);
});
test('same capture/audio-context owner must survive awaited preparation',async()=>{
  const f=harness('prepare',({engine})=>{engine.stream={getAudioTracks:()=>[{readyState:'live',enabled:true,muted:false}]};});
  await assert.rejects(f.controller.startSession(f.input),/changed|reconnect/i);assert.equal(f.calls.recorders,0);assert.equal(f.calls.providers,0);
});
test('track replacement inside the same stream is rejected before recorder/provider',async()=>{
  const f=harness('prepare',({engine})=>{engine.stream.getAudioTracks=()=>[{readyState:'live',enabled:true,muted:false}];});
  await assert.rejects(f.controller.startSession(f.input),/setup changed/i);assert.equal(f.calls.recorders,0);assert.equal(f.calls.providers,0);
});
test('a second healthy track cannot disguise the unusable authoritative first microphone',async()=>{
  const f=harness();f.mic.readyState='ended';f.stream.getAudioTracks=()=>[f.mic,{readyState:'live',enabled:true,muted:false}];
  await assert.rejects(f.controller.startSession(f.input),/microphone/i);assert.equal(f.calls.prepares,0);assert.equal(f.calls.providers,0);
});
test('input lost during synchronous mix creation cannot start the recorder',async()=>{
  const f=harness('mix',({mic})=>{mic.readyState='ended';});await assert.rejects(f.controller.startSession(f.input),/microphone/i);
  assert.equal(f.calls.recorders,0);assert.equal(f.calls.providers,0);
});
test('input lost during provider connection closes that owner without claiming LIVE',async()=>{
  const f=harness('provider',({mic})=>{mic.readyState='ended';});await assert.rejects(f.controller.startSession(f.input),/microphone/i);
  assert.equal(f.calls.providers,1);assert.equal(f.calls.stops,1);assert.equal(f.calls.abandons,1);assert.equal(f.controller.phase,'READY');
});
test('healthy owned input reaches the existing mock engine once',async()=>{
  const f=harness();await f.controller.startSession(f.input);
  assert.equal(f.calls.prepares,1);assert.equal(f.calls.recorders,1);assert.equal(f.calls.providers,1);assert.equal(f.controller.phase,'LIVE');assert.equal(f.controller.stream,f.stream);
});
test('actual Durable/AccountRecording allocation wait rechecks input before MediaRecorder starts',async t=>{
  const f=harness(),previous=globalThis.MediaRecorder;let allocations=0,captures=0;
  t.after(()=>{globalThis.MediaRecorder=previous;});
  globalThis.MediaRecorder=class extends EventTarget{static isTypeSupported(){return true;}start(){captures++;}stop(){}};
  const api={...f.controller.account.api,createSession:async()=>({id:'unit-durable'}),abandonSession:async()=>{},createRecording:async()=>{allocations++;f.mic.readyState='ended';return{id:'unit-recording'};}};
  const durable=new DurableStudioSession({api});await durable.bootstrap();
  Object.assign(f.controller.account,{api,durable});f.controller.durable=durable;
  await assert.rejects(f.controller.startSession(f.input),/microphone/i);
  assert.equal(allocations,1);assert.equal(captures,0);assert.equal(f.calls.providers,0);assert.equal(f.controller.phase,'READY');assert.equal(durable.recorder,null);
});
test('Reconnect resumes/replaces input through the existing capture owner, never a second engine',async()=>{
  const f=harness();let resumes=0,switches=0;
  f.engine.resumeInputAudio=()=>{resumes++;};f.engine.real={currentDevices:()=>({microphoneDeviceId:'selected-mic'})};
  f.engine.switchDevice=async(kind,id)=>{assert.equal(kind,'microphone');assert.equal(id,'selected-mic');switches++;f.mic.readyState='live';};
  f.mic.readyState='ended';assert.equal(await f.controller.acquire(),f.engine);assert.equal(switches,1);assert.equal(resumes,1);
  assert.equal(await f.controller.acquire(),f.engine);assert.equal(switches,1);assert.equal(resumes,2);
});
function hostFixture(){
  const status={textContent:''},selects=['camera','microphone'].map(kind=>Object.assign(new EventTarget(),{dataset:{deviceKind:kind},options:[],replaceChildren(){this.options=[];},append(row){this.options.push(row);}}));
  return{status,selects,host:{ownerDocument:{createElement:()=>({})},querySelector:()=>status,querySelectorAll:()=>selects}};
}
test('ended mic during the final awaited device refresh cannot overwrite invalidation with cached success',async()=>{
  const f=harness(),{host,selects,status}=hostFixture(),updates=[];let refreshes=0,releaseRefresh,enteredRefresh;
  const pending=new Promise(resolve=>{releaseRefresh=resolve;}),entered=new Promise(resolve=>{enteredRefresh=resolve;});
  f.engine.real={currentDevices:()=>({})};
  const dispose=await mountDeviceControls(host,{engine:f.engine,getStream:()=>f.stream,mediaDevices:{enumerateDevices:async()=>{if(++refreshes===2){enteredRefresh();await pending;}return[{kind:'audioinput',deviceId:'mic'}];}},
    switchDevice:async()=>{},verifyVisible:async()=>{},onSwitching:(switching,ready)=>updates.push({switching,ready}),onReadinessChanged:readiness=>updates.push({invalidated:readiness.ready})});
  selects[1].value='mic';selects[1].dispatchEvent(new Event('change'));await entered;
  f.mic.readyState='ended';f.mic.dispatchEvent(new Event('ended'));releaseRefresh();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(updates.at(-1).switching,false);assert.equal(updates.at(-1).ready,false);assert.match(status.textContent,/microphone is not ready/);dispose();
});
test('preflight ended/mute/context/device events invalidate readiness; never rewind LIVE or disposed input',async()=>{
  const f=harness(),{host,status}=hostFixture(),devices=Object.assign(new EventTarget(),{enumerateDevices:async()=>[]});
  f.engine.real={currentDevices:()=>({})};const updates=[];let preflight=true;
  const dispose=await mountDeviceControls(host,{engine:f.engine,getStream:()=>f.engine.stream,mediaDevices:devices,canSwitch:()=>preflight,
    onReadinessChanged:readiness=>updates.push(readiness)});
  f.mic.muted=true;f.mic.dispatchEvent(new Event('mute'));assert.equal(updates.length,1);assert.equal(updates[0].ready,false);assert.match(status.textContent,/microphone/i);
  f.mic.muted=false;f.mic.dispatchEvent(new Event('unmute'));assert.equal(updates.length,1,'unmute does not auto-approve the camera preview');
  f.context.state='suspended';f.context.dispatchEvent(new Event('statechange'));assert.equal(updates.length,2);assert.match(status.textContent,/audio/i);
  f.context.state='running';f.mic.enabled=false;devices.dispatchEvent(new Event('devicechange'));assert.equal(updates.length,3);
  await new Promise(resolve=>setImmediate(resolve));
  preflight=false;const before=updates.length;f.mic.readyState='ended';f.mic.dispatchEvent(new Event('ended'));assert.equal(updates.length,before);
  preflight=true;dispose();f.mic.dispatchEvent(new Event('ended'));devices.dispatchEvent(new Event('devicechange'));assert.equal(updates.length,before);
});


function cameraWaitHarness(source){
  const helper=source.slice(source.indexOf('function waitForCameraBoundary('),source.indexOf('export async function awaitVisibleCamera('));
  let now=0,next=0;const timeouts=new Map(),intervals=new Map();
  const wait=Function('performance','setTimeout','clearTimeout','setInterval','clearInterval',helper+'return waitForCameraBoundary;')(
    {now:()=>now},fn=>{timeouts.set(++next,fn);return next;},id=>timeouts.delete(id),fn=>{intervals.set(++next,fn);return next;},id=>intervals.delete(id));
  return{wait,expire(){now=5000;for(const fn of [...timeouts.values()])fn();},clear(){assert.equal(timeouts.size,0);assert.equal(intervals.size,0);}};
}
test('camera wait settles success/rejection/cancellation and clears timers',async()=>{
  const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../public/studio-fable/app/adapters/media-readiness.mjs',import.meta.url),'utf8');
  for(const kind of ['success','rejection','cancel']){
    const f=cameraWaitHarness(source),error=new Error('Playback rejected');
    const promise=kind==='success'?Promise.resolve('playing'):kind==='rejection'?Promise.reject(error):new Promise(()=>{});
    const pending=f.wait(promise,5000,()=>kind!=='cancel');
    if(kind==='success')assert.equal(await pending,'playing');else await assert.rejects(pending,kind==='cancel'?/cancelled/:error);
    f.clear();
  }
});
for(const late of ['resolve','reject'])test('camera deadline observes late '+late+' without resettling or retaining timers',async()=>{
  const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../public/studio-fable/app/adapters/media-readiness.mjs',import.meta.url),'utf8');
  const f=cameraWaitHarness(source);let resolvePlay,rejectPlay;
  const play=new Promise((resolve,reject)=>{resolvePlay=resolve;rejectPlay=reject;});
  const pending=f.wait(play,5000,()=>true);f.expire();await assert.rejects(pending,/did not become ready in time/);f.clear();
  if(late==='resolve')resolvePlay('late playing');else rejectPlay(new Error('late rejection'));
  await Promise.resolve();await Promise.resolve();f.clear();await assert.rejects(pending,/did not become ready in time/);
});
