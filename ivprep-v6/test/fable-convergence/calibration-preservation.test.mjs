import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CalibrationResolutionStore,bindPrimaryRecovery} from '../../public/studio-fable/app/adapters/engine-adapter.mjs';
import {BaselineStore} from '../../public/live-analytics/baseline-store.mjs';
import {LiveAnalyticsMediaBridge} from '../../public/live-analytics/media-bridge.mjs';
import {PrimaryIntervieweeLock,primaryLockDiagnostic} from '../../public/analytics/primary-interviewee-lock.mjs';
import {COACHING_CONFIG} from '../../public/analytics/coaching-config.mjs';

if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){},getElementById(){return null;}};
const subject='wp:7';
const deviceProfile={audio:{sampleRate:48000,channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:{width:1280,height:720,frameRate:30}};
const derived={pitchMedianHz:160,speechLufsK:-20,wordsPerMinute:145,smileBaseline:.2};
const statuses={readiness:'resolved',framing:'resolved',faceBaseline:'partial',smile:'not',nods:'resolved',hands:'resolved',gesture:'partial',volume:'resolved',pitch:'resolved',pace:'not',volumeRange:'partial',pauseHold:'not',paceRange:'not'};
function fixture(){
  const data=new Map();let now=1700000000000;
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const baselines=new BaselineStore({storage,now:()=>now}),resolutions=new CalibrationResolutionStore({storage,now:()=>now});
  const record=baselines.save(subject,derived,{deviceProfile});
  return{data,storage,baselines,resolutions,record,advance:ms=>{now+=ms;}};
}
test('R139 saves only allowlisted resolution labels and the actual BaselineStore binding',()=>{
  const f=fixture();const saved=f.resolutions.save(subject,f.record,{...statuses,rawLandmarks:[1,2],transcript:'private',deviceId:'private'});
  assert.deepEqual(saved.resolved,statuses);assert.equal(saved.at,f.record.createdAtMs);assert.equal(saved.staleAt,f.record.staleAtMs);
  assert.deepEqual(saved.corridors,f.record.corridors);assert.equal(saved.fixture,false);
  const metadata=JSON.parse(f.data.get(f.resolutions.key(subject)));
  assert.deepEqual(Object.keys(metadata),['schema','binding','resolved']);
  assert.deepEqual(metadata.binding,{subject,configVersion:COACHING_CONFIG.version,createdAtMs:f.record.createdAtMs,staleAtMs:f.record.staleAtMs,deviceProfile});
  assert.ok(!/landmark|transcript|deviceId|pitchMedian|speechLufs|wordsPerMinute|smileBaseline/.test(JSON.stringify(metadata)));
});
test('R139 cold reload restores labels only beside a matching freshly loaded real baseline',()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);
  const coldBaseline=new BaselineStore({storage:f.storage,now:()=>f.record.createdAtMs+10}).load(subject,{deviceProfile});
  const cold=new CalibrationResolutionStore({storage:f.storage,now:()=>f.record.createdAtMs+10});
  assert.deepEqual(cold.load(subject,coldBaseline,{deviceProfile}).resolved,statuses);
  assert.equal(cold.load(subject,null,{deviceProfile}),null);assert.equal(f.data.has(cold.key(subject)),false);
});
test('R139 a real baseline alone does not manufacture saved resolution labels',()=>{
  const f=fixture();assert.equal(f.resolutions.load(subject,f.record,{deviceProfile}),null);
});
test('R139 metadata copied to a different admitted subject is rejected',()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);
  const other=f.baselines.save('wp:8',derived,{deviceProfile});
  f.storage.setItem(f.resolutions.key('wp:8'),f.storage.getItem(f.resolutions.key(subject)));
  assert.equal(f.resolutions.load('wp:8',other,{deviceProfile}),null);
  assert.ok(f.resolutions.load(subject,f.record,{deviceProfile}));
  assert.throws(()=>f.resolutions.save('anonymous',f.record,statuses),/current device-bound/);
});
test('R139 new baseline timestamps cannot inherit the previous resolution record',()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);f.advance(1000);
  const replacement=f.baselines.save(subject,derived,{deviceProfile});
  assert.equal(f.resolutions.load(subject,replacement,{deviceProfile}),null);
  assert.equal(f.storage.getItem(f.resolutions.key(subject)),null);
});
test('R139 successful device invalidation and expiry remove the authority to show old labels',()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);f.baselines.invalidateForDeviceChange(subject);
  assert.equal(f.resolutions.load(subject,f.baselines.load(subject,{deviceProfile}),{deviceProfile}),null);
  const expired=fixture();expired.resolutions.save(subject,expired.record,statuses);
  expired.advance(COACHING_CONFIG.baseline.staleAfterDays*86400000);
  assert.equal(expired.baselines.load(subject,{deviceProfile}),null);
  assert.equal(expired.resolutions.load(subject,expired.record,{deviceProfile}),null);
});
for(const [label,change]of [
  ['changed device profile',record=>({...record,deviceProfile:{...deviceProfile,video:{...deviceProfile.video,width:640}}})],
  ['obsolete config',record=>({...record,configVersion:'obsolete'})],
  ['future timestamp',record=>({...record,createdAtMs:record.createdAtMs+1000,staleAtMs:record.staleAtMs+1000})],
  ['altered expiry',record=>({...record,staleAtMs:record.staleAtMs+1})],
  ['identifying device data',record=>({...record,deviceProfile:{...deviceProfile,video:{...deviceProfile.video,deviceId:'private'}}})],
])test('R139 rejects '+label,()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);
  assert.equal(f.resolutions.load(subject,change(f.record),{deviceProfile}),null);
  assert.equal(f.storage.getItem(f.resolutions.key(subject)),null);
});
for(const [label,change]of [
  ['unknown/raw metadata',record=>({...record,rawLandmarks:[1]})],
  ['unknown/raw resolutions',record=>({...record,resolved:{...record.resolved,transcript:'private'}})],
  ['invented resolution value',record=>({...record,resolved:{readiness:'verified'}})],
  ['non-object resolutions',record=>({...record,resolved:1})],
  ['tampered subject binding',record=>({...record,binding:{...record.binding,subject:'wp:8'}})],
])test('R139 rejects persisted '+label,()=>{
  const f=fixture();f.resolutions.save(subject,f.record,statuses);const key=f.resolutions.key(subject);
  f.storage.setItem(key,JSON.stringify(change(JSON.parse(f.storage.getItem(key)))));
  assert.equal(f.resolutions.load(subject,f.record,{deviceProfile}),null);assert.equal(f.storage.getItem(key),null);
});
test('R139 a failed resolution write cannot report a successful seal',()=>{
  const f=fixture();const store=new CalibrationResolutionStore({storage:{getItem:()=>null,setItem(){},removeItem(){}},now:()=>f.record.createdAtMs});
  assert.throws(()=>store.save(subject,f.record,statuses),/could not be saved/);
});

function recoveryHost(){
  const button=new EventTarget();button.disabled=false;const copy={textContent:''};
  return{button,copy,host:{hidden:true,querySelector:selector=>selector==='[data-reselect-primary]'?button:copy}};
}
const face=(center=.5)=>({left:center-.09,top:.26,width:.18,height:.24});
test('R036 control uses the actual pipeline reselect command; real lock stays withheld until stable reacquisition',()=>{
  let now=100;const bridge=new LiveAnalyticsMediaBridge({now:()=>now}),pipeline=bridge.ensureAnalytics();
  pipeline.beginAnswer();const tracker=new PrimaryIntervieweeLock();
  tracker.update({atMs:0,candidates:[face()]});tracker.update({atMs:650,candidates:[face()]});
  tracker.update({atMs:900,candidates:[face(.82)]});const required=tracker.update({atMs:3650,candidates:[face(.82)]});
  assert.equal(required.selectionRequired,true);assert.equal(required.primaryUsable,false);
  const send=lock=>pipeline.onFaceWorkerMessage({type:'primary-lock',generation:pipeline.generation,answerEpoch:pipeline.answerEpoch,visionEpoch:pipeline.visionEpoch,primaryLock:primaryLockDiagnostic(lock)},pipeline.generation);
  send(required);const messages=[];
  pipeline.faceWorker={terminate(){},postMessage(message){messages.push(message);if(message.type==='reselect-primary'){
    const lock=tracker.restartSelection(message.timestampMs);
    pipeline.onFaceWorkerMessage({...message,type:'primary-selection-restarted',primaryLock:primaryLockDiagnostic(lock)},pipeline.generation);
  }}};
  const {host,button,copy}=recoveryHost();let calls=0;
  const engine={events:pipeline,real:{pipeline},reselectPrimary(){calls++;return pipeline.reselectPrimary();}};
  const dispose=bindPrimaryRecovery(host,{engine});
  assert.equal(host.hidden,false);assert.equal(button.disabled,false);assert.match(copy.textContent,/withheld/);
  now=4100;button.dispatchEvent(new Event('click'));
  assert.equal(calls,1);assert.equal(messages[0].type,'reselect-primary');assert.equal(messages[0].generation,pipeline.generation);
  assert.equal(messages[0].answerEpoch,pipeline.answerEpoch);assert.equal(button.disabled,true);
  assert.equal(tracker.snapshot(4000).primaryUsable,false,'the control does not fabricate primary-person evidence');
  button.dispatchEvent(new Event('click'));assert.equal(calls,1);
  send(tracker.update({atMs:4000,candidates:[face()]}));assert.equal(host.hidden,false);assert.equal(button.disabled,true);
  const stable=tracker.update({atMs:4650,candidates:[face()]});send(stable);
  assert.equal(stable.primaryUsable,true);assert.equal(host.hidden,true);dispose();pipeline.destroy();
});
test('R036 ignores unrelated states, stale routes and disposed listeners',()=>{
  const {host,button}=recoveryHost(),events=new EventTarget();let current=true,calls=0;
  const engine={events,reselectPrimary(){calls++;return true;}};
  const emit=detail=>events.dispatchEvent(new CustomEvent('state',{detail}));
  const dispose=bindPrimaryRecovery(host,{engine,isCurrent:()=>current});
  emit({state:'running',primaryLock:{selectionRequired:true}});assert.equal(host.hidden,true);
  emit({state:'primary-lock',primaryLock:{state:'PRIMARY_SELECTION_REQUIRED',selectionRequired:false}});assert.equal(host.hidden,false);
  current=false;button.dispatchEvent(new Event('click'));assert.equal(calls,0);
  emit({state:'primary-lock',primaryLock:{state:'PRIMARY_LOCKED'}});assert.equal(host.hidden,false);
  dispose();current=true;emit({state:'primary-lock',primaryLock:{selectionRequired:true}});button.dispatchEvent(new Event('click'));
  assert.equal(host.hidden,true);assert.equal(calls,0);
});
test('R036 unavailable selection never claims a restarted or recovered person lock',()=>{
  const {host,button,copy}=recoveryHost(),events=new EventTarget();
  const engine={events,reselectPrimary:()=>false,real:{pipeline:{diagnostics:()=>({primaryLock:{selectionRequired:true}})}}};
  const dispose=bindPrimaryRecovery(host,{engine});button.dispatchEvent(new Event('click'));
  assert.equal(host.hidden,false);assert.equal(button.disabled,false);assert.match(copy.textContent,/not ready/);assert.match(copy.textContent,/withheld/);dispose();
});
test('Room/Calibration consumers bind contextual recovery, device-verified saved labels and account presentation writes',async()=>{
  const [room,calibration,adapter]=await Promise.all(['room.mjs','calibration.mjs','adapters/engine-adapter.mjs'].map(path=>readFile(new URL('../../public/studio-fable/app/'+path,import.meta.url),'utf8')));
  for(const source of [room,calibration]){assert.match(source,/bindPrimaryRecovery\(\$\('primary-recovery'\)/);assert.match(source,/disposePrimary\?\.\(\)/);}
  assert.match(calibration,/state\.calibration=engine\?\.calibrationResolution\|\|null/);
  assert.match(calibration,/labels belong to your saved account\/device baseline, not this new rehearsal/);
  assert.match(adapter,/baselines\.invalidateForDeviceChange\(subject\);resolutions\.clear\(subject\)/);
  assert.match(room,/saveOwnVisibility\(controller,patch,\{isCurrent:current\}\)/);
  assert.match(room,/saveVisibility\(\{density\}\)/);assert.match(room,/saveVisibility\(\{overlaysVisible\}\)/);
  assert.match(room,/mode==='mock'&&!state\.preferences\?\.densityPersisted\?'interview'/);
  assert.match(room,/state\.preferences\.densityPersisted=saved\.densityPersisted===true/);
  assert.match(room,/state\.preferences\?\.overlaysVisible===true/);assert.match(room,/account preference could not be saved/);
  assert.match(room,/observer\?\.ingestFinal\(\{speaker,text,identity:event\.identity\|\|null,sessionId:controller\.durable\.accountSession\?\.id\|\|null\}\)/);
  assert.match(room,/started&&snap\.finalObservationCount===0&&snap\.fragmentTextObservationCount===0\?snap\.N\+' questions planned'/);
  assert.match(room,/onTranscriptFragment\(event\)[\s\S]*?observer\.ingestFragment\(event\)/);
});
