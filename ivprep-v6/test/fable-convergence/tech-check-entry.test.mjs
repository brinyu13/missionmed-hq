import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {preInterviewReady} from '../../public/studio-fable/app/adapters/interview-entry.mjs';
const read=path=>readFileSync(new URL('../../public/studio-fable/'+path,import.meta.url),'utf8');
test('preflight is capture/subject bound, ephemeral, and rejects replaced or ended devices',()=>{
  const camera={readyState:'live',enabled:true,muted:false},mic={...camera};
  const controller={engine:{},durable:{},stream:{getVideoTracks:()=>[camera],getAudioTracks:()=>[mic]},account:{subject:'wp:fixture'},phase:'READY'};
  const receipt={engine:controller.engine,durable:controller.durable,account:controller.account,camera,microphone:mic,stream:controller.stream,subject:controller.account.subject,previewVerified:true,exercisesAttempted:false};
  assert.equal(preInterviewReady(receipt,controller),true);
  for(const bad of [null,{...receipt,subject:'wp:other'},{...receipt,stream:{}},{...receipt,engine:{}},{...receipt,camera:{...camera}},{...receipt,microphone:{...mic}},{...receipt,account:{...controller.account}},{...receipt,durable:{}},{...receipt,previewVerified:false}])assert.equal(preInterviewReady(bad,controller),false);
  const account=controller.account;controller.account={...account};assert.equal(preInterviewReady(receipt,controller),false);controller.account=account;
  controller.stream.getVideoTracks=()=>[{...camera}];assert.equal(preInterviewReady(receipt,controller),false);controller.stream.getVideoTracks=()=>[camera];
  mic.readyState='ended';assert.equal(preInterviewReady(receipt,controller),false);mic.readyState='live';
  camera.muted=true;assert.equal(preInterviewReady(receipt,controller),false);camera.muted=false;
  controller.phase='LIVE';assert.equal(preInterviewReady(receipt,controller),false);
});
test('normal Practice/Mock enter Room directly; optional calibration never starts interview/provider/recording',()=>{
  const main=read('app/main.mjs'),cal=read('app/calibration.mjs'),room=read('app/room.mjs');
  for(const mode of ['practice','mock'])assert.ok(main.includes("#/room?mode="+mode));
  assert.doesNotMatch(main,/entryPath==='room'&&!preInterviewReady/);
  assert.ok(main.includes('TEST CAMERA, MIC &amp; ANALYTICS'));
  assert.doesNotMatch(cal,/stepIndex!==steps.length-1|exercisesAttempted:true/);
  assert.match(cal,/continue-interview'\)\.addEventListener\('click',\(\)=>\{if\(current\(\)\)location.hash=returnHash/);
  assert.match(cal,/continue-interview'\)\.disabled=false/);
  assert.match(room,/if\(!preInterviewReady\(session.preflight,controller\)\)\{void connect\(\);return;\}/);
  assert.match(cal,/engine\.beginAnswer\(\)/);assert.match(cal,/engine\.events\.addEventListener\('frame',frameListener\)/);
  assert.doesNotMatch(cal,/startSession|new EmbodimentRenderer|\/embodiment-canary\/start/);
  assert.match(room,/void connect\(\); \/\/ reuse/);
  assert.doesNotMatch(room,/Check preview again/);
});
test('optional Back/Skip/exercise navigation never grants readiness or saves an unmeasured calibration',()=>{
  const cal=read('app/calibration.mjs');
  assert.match(cal,/id="back-step"/);assert.match(cal,/id="skip-step">Skip step/);
  assert.match(cal,/measured=s.resolves.length>0&&s.resolves.every\(key=>resolved\[key\]==='resolved'\)/);
  const skip=cal.slice(cal.indexOf("$('skip-step').addEventListener"),cal.indexOf('  renderSteps(); evaluate();'));
  assert.doesNotMatch(skip,/!ctx.started|sealCalibration|onReady/);
  assert.match(skip,/resolved\[key\]='not'/);
});
test('Room registers cleanup before pending media readiness and stale disposer cannot release another owner',()=>{
  const source=read('app/room.mjs');
  assert.match(source,/void connect\(\); \/\/ reuse/);
  const begin=source.lastIndexOf('  return ()=>{disposed=true;'),end=source.indexOf('\n}',begin);
  let released=0,aborted=0;
  const engine={},account={},durable={};
  const scope={engine,account,durable,controller:{engine,account,durable,navigationLocked:false,release:()=>released++},finished:false,disposed:false,entryAbort:{abort:()=>aborted++},disposeReadinessLines:()=>{},disposeEnvironment:()=>{},disposeDevices:()=>{},disposePrimary:()=>{},detach:()=>{},recorder:{destroy:()=>{}},document:{querySelector:()=>null}};
  const cleanup=runInNewContext('(function(){'+source.slice(begin,end)+'})()',scope);
  scope.controller.engine={};cleanup();assert.equal(released,0);assert.equal(aborted,1);
  scope.controller.engine=engine;cleanup();assert.equal(released,1);
});
test('actual Room measurements update before Start but cannot persist rehearsal evidence',()=>{
  const source=read('app/room.mjs');let measured=0,saved=0;
  const scope={engine:{},deviceSwitching:false,saving:false,disposed:false,started:false,roomFault:null,
    rails:{ingest:()=>measured++},history:{push:()=>saved++}};
  const start=source.indexOf('  const onFrame='),end=source.indexOf('  const onState=',start);
  const onFrame=runInNewContext(source.slice(start,end)+'\nonFrame',scope);
  onFrame({detail:{volume:{available:true}}});assert.equal(measured,1);assert.equal(saved,0);
  scope.deviceSwitching=true;onFrame({detail:{}});assert.equal(measured,1);
});
test('visibility and producer recovery cannot replace or clear provider/device faults',()=>{
  const source=read('app/room.mjs');
  const begin=source.indexOf('  const onState='),end=source.indexOf('  const onWord=',begin);
  const scope={saving:false,disposed:false,started:true,roomFault:null,mark:()=>{}};
  const onState=runInNewContext(source.slice(begin,end)+'\nonState',scope);
  for(const fault of [{message:'Interviewer disconnected',providerFailed:true},{message:'Device transaction failed',deviceFailed:true}]){
    scope.roomFault=fault;
    for(const detail of [{state:'partial',subsystem:'visibility',message:'document_hidden'},{state:'unavailable',subsystem:'audio'},{state:'recovering',subsystem:'vision'},{state:'recovered',subsystem:'visibility'},{state:'recovered',subsystem:'audio'},{state:'running'}]){onState({detail});assert.equal(scope.roomFault,fault);}
  }
  scope.roomFault=null;onState({detail:{state:'partial',subsystem:'visibility',message:'document_hidden'}});
  onState({detail:{state:'recovered',subsystem:'audio'}});assert.equal(scope.roomFault.detail,'document_hidden');
  onState({detail:{state:'recovered',subsystem:'visibility'}});assert.equal(scope.roomFault,null);
});
