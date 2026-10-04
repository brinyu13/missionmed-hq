import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountDeviceControls} from '../../public/studio-fable/app/adapters/device-controls.mjs';
import {assertMicrophoneReady} from '../../public/studio-fable/app/adapters/media-readiness.mjs';
import {readMicrophoneLevel,projectDeviceReadiness,mountDeviceReadiness,createPreviewSampler} from '../../public/studio-fable/app/adapters/device-readiness.mjs';
import {LiveMetricProjector} from '../../public/live-analytics/live-metric-projector.mjs';
import {COACHING_CONFIG,mapToLiveScale} from '../../public/analytics/coaching-config.mjs';
import {CALIBRATION} from '../../public/ivoc-standalone/app/data.mjs';

const read=path=>readFileSync(new URL('../../public/studio-fable/'+path,import.meta.url),'utf8');
const room=read('app/room.mjs'),calibration=read('app/calibration.mjs');
const section=(source,from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const black='The camera preview is black. Choose another camera.';
function fixture(){
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{dataset:{},hidden:false,disabled:false,textContent:'',removed:0,remove(){this.removed++;}});return elements.get(id);};
  const selects=[{disabled:false,options:[{}]},{disabled:false,options:[{}]}];
  const host={hidden:true},stream={getAudioTracks:()=>[{readyState:'live',enabled:true,muted:false}]};
  let options=null,current=true,visible=false,acquires=0;
  const engine={audioContext:{state:'running'},events:{adds:0,addEventListener(){this.adds++;}},begins:0,beginAnswer(){this.begins++;},setOverlayVisibility(){}};
  const scope={current:()=>current,$:element,main:{querySelector:()=>host,querySelectorAll:()=>selects},
    controller:{phase:'READY',stream,mountVideo:()=>({}),acquire:async()=>{acquires++;return engine;},switchDevice:async()=>{}},
    mountDeviceControls:async(_host,input)=>{options=input;host.hidden=false;return()=>{};},
    awaitVisibleCamera:async()=>{if(!visible)throw new Error(black);},assertMicrophoneReady,bindPrimaryRecovery:()=>()=>{},
    engine:null,disposePrimary:null,disposeDevices:null,verifiedCapture:null,deviceReadiness:{refresh(){},reset(){}},deviceSwitching:false,starting:false,started:false,saving:false,finished:false,disposed:false,connecting:false,
    state:{calibration:{old:true}},commit(){},setDensityControls(){},applyOverlays(){},
  };
  vm.createContext(scope);
  return{scope,element,selects,host,engine,options:()=>options,setVisible:value=>{visible=value;},setCurrent:value=>{current=value;},acquires:()=>acquires};
}
function roomFixture(){
  const f=fixture();
  vm.runInContext(section(room,'  async function connect(){','  const onFrame=')+';this.connect=connect;',f.scope);
  return f;
}
test('actual Room connect exposes camera selection after black preview, with Start still disabled',async()=>{
  const f=roomFixture();await f.scope.connect();
  assert.equal(f.host.hidden,false);assert.ok(f.options());assert.equal(f.element('start-session').disabled,true);
  assert.equal(f.element('stage').dataset.previewReady,'false');assert.equal(f.element('enter-note').textContent,black);
  assert.ok(f.selects.every(select=>!select.disabled));assert.equal(f.options().canSwitch(),true);
  f.options().onSwitching(true);assert.equal(f.element('start-session').disabled,true);
  f.options().onChanged();assert.equal(f.scope.state.calibration,null);
  f.options().onSwitching(false,false);assert.equal(f.element('start-session').disabled,true);
  f.options().onSwitching(false,true);assert.equal(f.element('start-session').disabled,false);
  assert.equal(f.element('stage').dataset.previewReady,'true');assert.match(f.element('enter-note').textContent,/Preview visible/);
});
test('actual Room stale connect cannot publish readiness after the camera wait',async()=>{
  const f=roomFixture();f.scope.awaitVisibleCamera=async()=>{f.setCurrent(false);};await f.scope.connect();
  assert.equal(f.element('start-session').disabled,true);assert.equal(f.element('stage').dataset.previewReady,'false');
});
test('actual Room readiness callback disables Start with recovery copy, but never rewinds a live session',async()=>{
  const f=roomFixture();f.setVisible(true);await f.scope.connect();assert.equal(f.element('start-session').disabled,false);
  f.options().onReadinessChanged({ready:false,message:'Your microphone disconnected. Reconnect it.'});
  assert.equal(f.element('start-session').disabled,true);assert.equal(f.element('stage').dataset.previewReady,'false');assert.match(f.element('enter-note').textContent,/microphone disconnected/);
  f.scope.started=true;f.element('stage').dataset.previewReady='true';f.element('enter-note').textContent='Live interview';
  f.options().onReadinessChanged({ready:false,message:'Disconnected'});assert.equal(f.element('stage').dataset.previewReady,'true');assert.equal(f.element('enter-note').textContent,'Live interview');
});
function calibrationFixture(){
  const f=fixture();Object.assign(f.scope,{ctx:{started:false,volSeen:new Set()},resolved:{},steps:[
    {id:'devices',resolves:['readiness'],check:(_frame,ctx)=>ctx.started},
    {id:'frame',resolves:['framing'],check:frame=>frame?.tracked===true},
    {id:'seal',resolves:[],check:()=>true}],stepIndex:0,latest:null,lastT:0,timer:null,
    frameListener(){},history:{samples:[],lastT:-Infinity},recorder:{setData(){},tick(){}},
    renderCalibrationRecord(){},renderSteps(){},calibrationStatus:()=>'',intervals:0,setInterval:()=>++f.scope.intervals});
  vm.runInContext(section(calibration,'  function evaluate() {','  const frameListener=')+';this.begin=begin;this.evaluate=evaluate;evaluate();',f.scope);
  return f;
}
test('actual Calibration initial black recovery starts measurement once, only after verified switch',async()=>{
  const f=calibrationFixture();await f.scope.begin();
  assert.equal(f.host.hidden,false);assert.equal(f.element('next-step').disabled,true);assert.equal(f.scope.ctx.started,false);
  assert.equal(f.scope.intervals,0);assert.equal(f.engine.begins,0);assert.equal(f.options().canSwitch(),true);
  f.options().onSwitching(true);f.options().onChanged();f.options().onSwitching(false,false);
  assert.equal(f.scope.resolved.readiness,undefined);assert.equal(f.element('next-step').disabled,true);
  assert.equal(f.scope.intervals,0);assert.equal(f.element('enter').removed,0);
  f.options().onSwitching(true);f.options().onChanged();f.options().onSwitching(false,true);
  assert.equal(f.scope.ctx.started,true);assert.equal(f.scope.resolved.readiness,'resolved');assert.equal(f.scope.stepIndex,1);
  assert.equal(f.scope.intervals,1);assert.equal(f.engine.events.adds,1);assert.equal(f.engine.begins,1);
  f.options().onSwitching(true);f.options().onChanged();f.options().onSwitching(false,true);
  assert.equal(f.scope.intervals,1);assert.equal(f.engine.events.adds,1);assert.equal(f.engine.begins,2);
});
test('Calibration cannot advance from stale instrument success when a replacement device failed',async()=>{
  const f=calibrationFixture();f.setVisible(true);await f.scope.begin();
  f.scope.latest={tracked:true};f.scope.evaluate();assert.equal(f.element('next-step').disabled,false);
  f.options().onSwitching(true);f.options().onSwitching(false,false);f.scope.evaluate();
  assert.equal(f.element('next-step').disabled,true);assert.equal(f.scope.ctx.started,false);
  assert.equal(f.element('step-state').textContent,'Waiting');
  assert.equal(f.element('enter-note').hidden,false);assert.equal(f.scope.resolved.readiness,undefined);
  f.scope.stepIndex=2;f.scope.evaluate();assert.equal(f.element('next-step').disabled,true);
});
function deviceHost(){
  const status={textContent:''},selects=['camera','microphone'].map(kind=>({dataset:{deviceKind:kind},options:[],disabled:false,listeners:new Map(),
    addEventListener(type,listener){this.listeners.set(type,listener);},removeEventListener(type){this.listeners.delete(type);},
    replaceChildren(){this.options=[];},append(option){this.options.push(option);}}));
  return{status,selects,host:{hidden:true,ownerDocument:{createElement:()=>({})},querySelector:()=>status,querySelectorAll:()=>selects}};
}
test('real device control verifies exact switched capture and microphone; never enables failed or disposed recovery',async()=>{
  const {host,selects,status}=deviceHost(),calls=[],states=[];let visible=false,mic=true,current=true;
  const track={readyState:'live',enabled:true,muted:false},stream={getAudioTracks:()=>{track.muted=!mic;return[track];}},video={};
  const dispose=await mountDeviceControls(host,{engine:{audioContext:{state:'running'},real:{currentDevices:()=>({cameraDeviceId:'camera',microphoneDeviceId:'mic'})}},video,getStream:()=>stream,isCurrent:()=>current,
    mediaDevices:{enumerateDevices:async()=>[{kind:'videoinput',deviceId:'camera',label:'Physical camera'},{kind:'audioinput',deviceId:'mic',label:'Microphone'}]},
    switchDevice:async(kind,id)=>{calls.push([kind,id]);},onSwitching:(value,ready)=>states.push([value,ready]),
    verifyVisible:async(actualVideo,actualStream)=>{assert.equal(actualVideo,video);assert.equal(actualStream,stream);if(!visible)throw new Error(black);}});
  const camera=selects[0];camera.value='camera';const change=()=>camera.listeners.get('change')({currentTarget:camera});
  await change();assert.equal(host.hidden,false);assert.equal(status.textContent,black);assert.equal(states.at(-1)[1],false);
  visible=true;mic=false;await change();assert.match(status.textContent,/microphone is not ready/);assert.equal(states.at(-1)[1],false);
  mic=true;await change();assert.equal(states.at(-1)[1],true);assert.equal(calls.length,3);
  current=false;await change();assert.equal(calls.length,3);dispose();assert.equal(camera.listeners.size,0);
});
test('readiness error is outside the video overlay and oversized preflight controls remain scrollable',()=>{
  for(const source of [room,calibration])assert.match(source,/<\/div>\s*<p class="note readiness-status" id="enter-note" role="status" aria-live="polite">/);
  assert.match(read('styles/room.css'),/\.stage-enter \{[^}]*place-items: safe center;[^}]*overflow: auto;/);
  assert.match(read('styles/room.css'),/\.room \.stage:has\(\.stage-enter\), \.cal \.stage:has\(\.stage-enter\) \{ min-height: 280px; \}/);
});
test('disposed device controls cannot publish readiness after their final awaited device refresh',async()=>{
  const {host,selects}=deviceHost(),states=[];let refreshes=0,releaseRefresh,enteredRefresh;
  const refreshEntered=new Promise(resolve=>{enteredRefresh=resolve;});
  const pendingRefresh=new Promise(resolve=>{releaseRefresh=resolve;});
  const track={readyState:'live',enabled:true,muted:false},stream={getAudioTracks:()=>[track]};
  const dispose=await mountDeviceControls(host,{engine:{audioContext:{state:'running'},real:{currentDevices:()=>({})}},video:{},getStream:()=>stream,
    mediaDevices:{enumerateDevices:async()=>{if(++refreshes===2){enteredRefresh();await pendingRefresh;}return[{kind:'videoinput',deviceId:'camera'}];}},
    switchDevice:async()=>{},verifyVisible:async()=>{},onSwitching:(value,ready)=>states.push([value,ready])});
  const camera=selects[0];camera.value='camera';const change=camera.listeners.get('change')({currentTarget:camera});
  await refreshEntered;dispose();releaseRefresh();await change;
  assert.deepEqual(states,[[true,undefined]]);
});

function measuredCapture(){
  const camera={readyState:'live',enabled:true,muted:false},microphone={readyState:'live',enabled:true,muted:false};
  const stream={getVideoTracks:()=>[camera],getAudioTracks:()=>[microphone]},context={state:'running'};
  let amplitude=.5,fail=false,visionAt=null,sessionAt=0;
  const analyser={fftSize:32,getFloatTimeDomainData(values){if(fail)throw new Error('closed');values.fill(amplitude);}};
  const diagnostics={active:true,workerReady:true};
  const engine={audioContext:context,events:new EventTarget(),real:{clock:{sessionMs:()=>sessionAt},projector:{get latest(){return{clock:{lastAcceptedAtMs:{vision:visionAt}}};}},bridge:{media:{stream,AC:context,mic:{},analyser}},pipeline:{diagnostics:()=>diagnostics}}};
  const video={srcObject:stream,paused:false,readyState:4,videoWidth:640,videoHeight:480};
  return{camera,microphone,stream,context,analyser,diagnostics,engine,video,setVision:(at,current=at)=>{visionAt=at;sessionAt=current;},setAmplitude:v=>{amplitude=v;},fail:()=>{fail=true;}};
}
test('input meter reads existing analyser dBFS/peak; silence is not unavailable and failures never show fake zero',()=>{
  const f=measuredCapture(),buffer=new Float32Array(32);
  const first=readMicrophoneLevel(f.engine,f.stream,buffer);
  assert.equal(first.state,'measured');assert.ok(Math.abs(first.dbfs+6.0206)<.0001);assert.equal(first.peak,.5);
  f.setAmplitude(.25);assert.ok(readMicrophoneLevel(f.engine,f.stream,buffer).level<first.level);
  f.setAmplitude(0);assert.deepEqual(readMicrophoneLevel(f.engine,f.stream,buffer),{state:'silent',dbfs:-Infinity,peak:0,level:0});
  f.microphone.muted=true;assert.deepEqual(readMicrophoneLevel(f.engine,f.stream,buffer),{state:'unavailable'});
  f.microphone.muted=false;f.context.state='suspended';assert.equal(readMicrophoneLevel(f.engine,f.stream,buffer).state,'unavailable');
  f.context.state='running';f.engine.real.bridge.media.AC={state:'running'};assert.equal(readMicrophoneLevel(f.engine,f.stream).state,'unavailable');
  f.engine.real.bridge.media.AC=f.context;f.setAmplitude(NaN);assert.equal(readMicrophoneLevel(f.engine,f.stream).state,'unavailable');
  f.setAmplitude(.5);f.fail();assert.equal(readMicrophoneLevel(f.engine,f.stream).state,'unavailable');
});
test('checklist separates pixel receipt, worker readiness, person presence and current microphone; Student/Admin copy is distinct',()=>{
  const f=measuredCapture(),input={stream:f.stream,context:f.context,video:f.video,diagnostics:f.diagnostics,audioGraphReady:true};
  const byId=rows=>Object.fromEntries(rows.map(row=>[row.id,row]));
  let rows=byId(projectDeviceReadiness(input));
  assert.equal(rows.camera.state,'resolved');assert.equal(rows.preview.state,'not');assert.equal(rows.vision.state,'resolved');assert.equal(rows.face.state,'not');assert.equal(rows.body.state,'not');
  assert.equal(rows.processing.label,'Microphone processing');assert.equal(rows.processing.text,'Ready');assert.equal(rows.vision.label,'Visual coaching');
  rows=byId(projectDeviceReadiness({...input,previewVerified:true,admin:true}));
  assert.equal(rows.preview.state,'resolved');assert.equal(rows.processing.label,'Audio context');assert.equal(rows.processing.text,'RUNNING');assert.equal(rows.vision.label,'Vision worker');assert.equal(rows.face.label,'Face landmarks');
  rows=byId(projectDeviceReadiness({...input,previewVerified:true,frame:{headFace:{presence:'TRACKED'},bodyHands:{inFrame:true,handsAvailable:true,handsVisible:true}}}));
  assert.equal(rows.face.state,'resolved');assert.equal(rows.body.state,'resolved');
  rows=byId(projectDeviceReadiness({...input,audioGraphReady:false}));assert.equal(rows.microphone.state,'resolved');assert.equal(rows.processing.state,'not');
  rows=byId(projectDeviceReadiness({...input,diagnostics:{active:true,workerReady:false,workerErrors:['bounded error']}}));assert.equal(rows.vision.state,'not');assert.match(rows.vision.text,/temporarily unavailable/);
  f.microphone.readyState='ended';rows=byId(projectDeviceReadiness({...input,previewVerified:true}));assert.equal(rows.microphone.state,'not');assert.equal(rows.camera.state,'resolved');
  f.camera.muted=true;rows=byId(projectDeviceReadiness({...input,previewVerified:true}));assert.equal(rows.camera.state,'not');assert.equal(rows.preview.state,'not');assert.equal(rows.vision.state,'not');
});
function readinessHost(){
  const node=()=>({children:[],dataset:{},hidden:false,value:0,textContent:'',append(...items){this.children.push(...items);},querySelector(selector){return this.children.find(child=>child.dataset.readinessRow===selector.match(/="(.*?)"/)?.[1]);}});
  const meter=node(),readout=node(),rows=node(),map={'[data-mic-meter]':meter,'[data-mic-readout]':readout,'[data-readiness-rows]':rows};
  return{meter,readout,rows,host:{ownerDocument:{createElement:node},querySelector:selector=>map[selector]}};
}
test('mounted preflight meter/checklist refresh, expire stale tracking, clear switched capture, and never publish after disposal',()=>{
  const f=measuredCapture(),dom=readinessHost();let engine=f.engine,stream=f.stream,video=f.video,time=0,tick=null,current=true,switching=false,verified=false,cancelled=0,lit=true,samples=0;
  const mounted=mountDeviceReadiness(dom.host,{getEngine:()=>engine,getStream:()=>stream,getVideo:()=>video,isCurrent:()=>current,isSwitching:()=>switching,previewVerified:()=>verified,
    samplePreview:actual=>{assert.equal(actual,video);samples++;return lit;},onCaptureInvalidated:()=>{verified=false;},now:()=>time,schedule:fn=>{tick=fn;return 123;},cancel:id=>{assert.equal(id,123);cancelled++;}});
  assert.match(dom.readout.textContent,/-6\.0 dBFS · peak 0\.500/);assert.equal(dom.meter.hidden,false);
  verified=true;tick();const row=id=>dom.rows.children.find(n=>n.dataset.readinessRow===id);
  assert.equal(row('preview').dataset.state,'resolved');
  tick();assert.equal(samples,1);lit=false;time=500;tick();assert.equal(row('preview').dataset.state,'not');lit=true;time=1000;tick();assert.equal(row('preview').dataset.state,'resolved');
  const emit=detail=>{const event=new Event('frame');Object.defineProperty(event,'detail',{value:detail});engine.events.dispatchEvent(event);};
  f.setVision(1000);emit({headFace:{presence:'TRACKED'},bodyHands:{inFrame:true,handsAvailable:true,handsVisible:true}});tick();assert.equal(row('face').dataset.state,'resolved');assert.equal(row('body').dataset.state,'resolved');
  time=1800;emit({headFace:{presence:'TRACKED'},bodyHands:{inFrame:true,handsAvailable:true,handsVisible:true}});tick();assert.equal(row('face').dataset.state,'resolved'); // repeated audio does not renew the vision receipt
  time=2001;tick();assert.equal(row('face').dataset.state,'not');assert.equal(row('body').dataset.state,'not');
  f.setAmplitude(0);tick();assert.match(dom.readout.textContent,/SILENT/);assert.equal(dom.meter.hidden,false);
  switching=true;mounted.reset();tick();assert.equal(dom.meter.hidden,true);assert.match(dom.readout.textContent,/Checking/);assert.equal(row('preview').dataset.state,'not');
  const replacement=measuredCapture();engine=replacement.engine;stream=replacement.stream;video=replacement.video;switching=false;tick();assert.equal(row('preview').dataset.state,'not');
  verified=true;tick();assert.equal(row('preview').dataset.state,'resolved');assert.equal(row('face').dataset.state,'not');
  engine.real.pipeline.diagnostics=()=>{throw new Error('unavailable');};tick();assert.equal(row('vision').dataset.state,'not');
  replacement.microphone.enabled=false;tick();assert.equal(dom.meter.hidden,true);assert.match(dom.readout.textContent,/UNAVAILABLE/);
  const before=dom.readout.textContent;current=false;replacement.microphone.enabled=true;tick();assert.equal(dom.readout.textContent,before);
  mounted.dispose();assert.equal(cancelled,1);current=true;replacement.setAmplitude(.1);tick();assert.equal(dom.readout.textContent,before);
});
test('preview status uses the existing local pixel aggregate; no dimensions-only success or stored raw frame',()=>{
  let brightness=0,drawn=null;const pixels=new Uint8ClampedArray(64*48*4),canvas={getContext:()=>({drawImage:video=>{drawn=video;},getImageData:()=>{pixels.fill(brightness);return{data:pixels};}})};
  const sample=createPreviewSampler({createElement:tag=>{assert.equal(tag,'canvas');return canvas;}}),video={};
  assert.equal(sample(video),false);brightness=80;assert.equal(sample(video),true);assert.equal(drawn,video);
  sample.dispose();assert.equal(canvas.width,0);assert.equal(canvas.height,0);
});
test('actual Calibration mounts the read-only view before pixel verification; only authenticated Admin gets diagnostic copy',async()=>{
  assert.match(calibration,/\$\{deviceReadinessMarkup\(\)\}/);
  const f=calibrationFixture();let captured;
  f.scope.mountDeviceReadiness=(_host,options)=>{captured=options;return f.scope.deviceReadiness;};
  vm.runInContext(section(calibration,'  const deviceReadiness=','  function renderCalibrationRecord()'),f.scope);
  f.scope.deviceReadiness.reset=()=>captured.onCaptureInvalidated();
  f.scope.controller.account={role:'student',subject:'wp:fixture',api:{identity:{subject:'wp:fixture',admin:false}}};assert.equal(captured.isAdmin(),false);
  f.scope.controller.account.role='admin';assert.equal(captured.isAdmin(),false);
  f.scope.controller.account.api.identity.admin=true;assert.equal(captured.isAdmin(),true);
  f.scope.controller.account.api.identity.subject='wp:other';assert.equal(captured.isAdmin(),false);
  await f.scope.begin();assert.equal(captured.previewVerified(),false);assert.ok(f.scope.engine);
  f.options().onSwitching(false,true);assert.equal(captured.previewVerified(),true); // existing verified recovery callback
  f.options().onSwitching(true);assert.equal(captured.previewVerified(),false);
});
test('actual projector/mapFrame audio cannot renew old vision; same-engine camera replacement requires fresh vision',()=>{
  const source=readFileSync(new URL('../../public/ivoc-standalone/app/real-runtime.mjs',import.meta.url),'utf8');
  const scope={CALIBRATION,COACHING_CONFIG,mapToLiveScale};vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('const clamp ='),source.indexOf('export class RealAnalyticsEngine'))+'\nthis.mapFrame=({'+section(source,'  mapFrame(snapshot','  clearOverlay()')+'}).mapFrame;',scope);
  const projector=new LiveMetricProjector(),runtime={t:0,latest:null,latestAudioSpeaking:false,behavior:{latest:{}},faceBaselineState:{},wordTimingState:{}};
  const f=measuredCapture(),dom=readinessHost();let time=0,stream=f.stream,verified=false;
  f.engine.real.projector=projector;f.engine.real.clock={sessionMs:()=>time};
  const mounted=mountDeviceReadiness(dom.host,{getEngine:()=>f.engine,getStream:()=>stream,getVideo:()=>f.video,previewVerified:()=>verified,onCaptureInvalidated:()=>{verified=false;},now:()=>time,schedule:()=>1,cancel(){},samplePreview:()=>true});
  const row=id=>dom.rows.children.find(n=>n.dataset.readinessRow===id);
  function publish(detail){time=detail.atMs;runtime.t=time;runtime.latest=scope.mapFrame.call(runtime,projector.ingest(detail),{});const event=new Event('frame');Object.defineProperty(event,'detail',{value:runtime.latest});f.engine.events.dispatchEvent(event);mounted.refresh();}
  const vision=atMs=>({modality:'vision',atMs,primaryLock:{state:'PRIMARY_LOCKED'},geometry:{primaryAssociated:true,face:{present:true},pose:{upperBodyPresent:true},hands:{left:{present:true},right:{present:true}}}});
  verified=true;publish(vision(0));assert.equal(row('face').dataset.state,'resolved');assert.equal(row('body').dataset.state,'resolved');
  publish({modality:'audio',atMs:2000});assert.equal(projector.latest.clock.lastAcceptedAtMs.vision,0);assert.equal(row('face').dataset.state,'not');assert.equal(row('body').dataset.state,'not');
  publish({modality:'audio',atMs:10000});assert.equal(row('face').dataset.state,'not');assert.equal(row('body').dataset.state,'not');
  publish(vision(10100));assert.equal(row('face').dataset.state,'resolved');
  const replacement=measuredCapture();stream=replacement.stream;f.engine.real.bridge.media={...f.engine.real.bridge.media,stream};f.video.srcObject=stream;mounted.refresh();verified=true;
  publish({modality:'audio',atMs:10200});assert.equal(row('face').dataset.state,'not');assert.equal(row('body').dataset.state,'not');
  publish(vision(10300));assert.equal(row('face').dataset.state,'resolved');assert.equal(row('body').dataset.state,'resolved');mounted.dispose();
});
