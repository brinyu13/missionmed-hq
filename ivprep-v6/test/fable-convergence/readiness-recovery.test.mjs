import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountDeviceControls} from '../../public/studio-fable/app/adapters/device-controls.mjs';

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
  const engine={events:{adds:0,addEventListener(){this.adds++;}},begins:0,beginAnswer(){this.begins++;},setOverlayVisibility(){}};
  const scope={current:()=>current,$:element,main:{querySelector:()=>host,querySelectorAll:()=>selects},
    controller:{phase:'READY',stream,mountVideo:()=>({}),acquire:async()=>{acquires++;return engine;},switchDevice:async()=>{}},
    mountDeviceControls:async(_host,input)=>{options=input;host.hidden=false;return()=>{};},
    awaitVisibleCamera:async()=>{if(!visible)throw new Error(black);},bindPrimaryRecovery:()=>()=>{},
    engine:null,disposePrimary:null,disposeDevices:null,deviceSwitching:false,starting:false,started:false,disposed:false,connecting:false,
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
  const stream={getAudioTracks:()=>[{readyState:'live',enabled:true,muted:!mic}]},video={};
  const dispose=await mountDeviceControls(host,{engine:{real:{currentDevices:()=>({cameraDeviceId:'camera',microphoneDeviceId:'mic'})}},video,getStream:()=>stream,isCurrent:()=>current,
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
});
test('disposed device controls cannot publish readiness after their final awaited device refresh',async()=>{
  const {host,selects}=deviceHost(),states=[];let refreshes=0,releaseRefresh,enteredRefresh;
  const refreshEntered=new Promise(resolve=>{enteredRefresh=resolve;});
  const pendingRefresh=new Promise(resolve=>{releaseRefresh=resolve;});
  const dispose=await mountDeviceControls(host,{engine:{real:{currentDevices:()=>({})}},video:{},getStream:()=>({getAudioTracks:()=>[{readyState:'live',enabled:true,muted:false}]}),
    mediaDevices:{enumerateDevices:async()=>{if(++refreshes===2){enteredRefresh();await pendingRefresh;}return[{kind:'videoinput',deviceId:'camera'}];}},
    switchDevice:async()=>{},verifyVisible:async()=>{},onSwitching:(value,ready)=>states.push([value,ready])});
  const camera=selects[0];camera.value='camera';const change=camera.listeners.get('change')({currentTarget:camera});
  await refreshEntered;dispose();releaseRefresh();await change;
  assert.deepEqual(states,[[true,undefined]]);
});
