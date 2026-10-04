import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionController} from '../../public/studio-fable/app/controller/session-controller.mjs';
import {LiveAnalyticsMediaBridge} from '../../public/live-analytics/media-bridge.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {ConversationRecordingMix} from '../../public/capabilities/conversation-recording.mjs';
import {GptLiveInterviewer} from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
if(typeof CustomEvent==='undefined')globalThis.CustomEvent=class extends Event{constructor(name,{detail}={}){super(name);this.detail=detail;}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
class Track extends EventTarget {constructor(kind,id){super();Object.assign(this,{kind,id,readyState:'live',enabled:true,muted:false,stops:0});}stop(){this.stops++;this.readyState='ended';}getSettings(){return{deviceId:this.id};}}
class Stream {constructor(tracks=[]){this.tracks=[...tracks];}getTracks(){return [...this.tracks];}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}addTrack(t){this.tracks.push(t);}removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}}
class Node {constructor(stream){this.stream=stream;this.targets=new Set();}connect(target){this.targets.add(target);}disconnect(){this.targets.clear();}}
class Context {constructor(){this.state='running';this.sources=[];this.destination={speakers:true};}createMediaStreamSource(stream){const node=new Node(stream);this.sources.push(node);return node;}createMediaStreamDestination(){return new Node(new Stream([new Track('audio','stable-mix')]));}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}createAnalyser(){return new Node();}}
function cameraTap(raw){
  const output=new Track('video','stable-camera');return{stream:new Stream([output]),input:raw,closed:false,pending:null,
    assertHealthy(){if(this.closed)throw new Error('recording camera closed');},
    async prepareCamera(next){this.assertHealthy();const prior=this.input,tx={};this.pending=tx;let committed=false;
      return{commit:()=>{this.input=next;committed=true;},complete:()=>this.assertHealthy(),rollback:()=>{if(this.pending!==tx)return false;if(committed)this.input=prior;this.pending=null;return true;},release:()=>{if(this.pending===tx)this.pending=null;}};},
    destroy(){this.closed=true;output.stop();}};
}
async function fixture({captureWait=null,senderWait=null}={}){
  const old=new Track('audio','old-mic'),camera=new Track('video','old-camera'),freshMic=new Track('audio','new-mic'),freshCamera=new Track('video','new-camera');
  const stream=new Stream([old,camera]),context=new Context();let count=0;
  const bridge=new LiveAnalyticsMediaBridge({getUserMedia:async constraints=>{if(!count++)return stream;if(captureWait)await captureWait.promise;return new Stream([constraints.audio?freshMic:freshCamera]);},audioContextFactory:()=>context,
    pipelineFactory:()=>({session:{clock:{sessionMs:()=>100}},ensureSession(){return this.session;},beginAnswer(){},destroy(){}})});
  await bridge.requestMedia();bridge.ensureAnalytics();
  const video=cameraTap(camera),mix=new ConversationRecordingMix({candidateStream:stream,videoStream:video.stream,audioContext:context,MediaStreamCtor:Stream,retainCandidateAudio:true});
  const remote=new Track('audio','interviewer');mix.attachAuthoritativeAudio(new Stream([remote]));
  const sender={track:old,async replaceTrack(track){if(track===freshMic&&senderWait)await senderWait.promise;this.track=track;}};
  const native=new LiveInterviewSession({createSession(){},endSession:async()=>{},PeerConnection:class{}});native.state='active';native.peer={close(){this.closed=true;}};native.microphoneSender=sender;
  const live=new GptLiveInterviewer({account:{}});live.live=native;
  const c=new SessionController(),engine={stream,audioContext:context,async switchDevice(kind,id,coordinator){await bridge.switchDevice(kind,id,coordinator);coordinator.assertCurrent();return{cameraDeviceId:stream.getVideoTracks()[0].id,microphoneDeviceId:stream.getAudioTracks()[0].id};},
    async finish(){return{analytics:{schema:'ivoc.analytics.v1',durationMs:1000}};},destroy(){bridge.destroy();}};
  Object.assign(c,{engine,engineMode:'real',phase:'LIVE',mix,recordingVideo:video,live,durableActive:true,account:{subject:'wp:1',role:'admin'},video:{srcObject:stream},
    durable:{accountSession:{id:'one'},async finish(){return{session:{id:'one'},analytics:{schema:'ivoc.analytics.v1'}};},async abandon(){}}});
  return{c,bridge,engine,mix,video,native,live,sender,stream,old,camera,freshMic,freshCamera,remote,context};
}
test('actual Controller coordinates Bridge, native sender, conversation and candidate-only taps without changing recorders',async()=>{
  const f=await fixture(),output=f.mix.stream.getTracks(),candidate=f.mix.candidateAudioStream.getTracks(),clock=f.bridge.sessionClock;
  await f.c.switchDevice('microphone','new-mic');
  assert.equal(f.sender.track,f.freshMic);assert.equal(f.mix.candidateTrack,f.freshMic);assert.equal(f.old.stops,1);
  assert.deepEqual(f.mix.stream.getTracks(),output);assert.deepEqual(f.mix.candidateAudioStream.getTracks(),candidate);assert.equal(f.bridge.sessionClock,clock);
  assert.equal(f.remote.stops,0);assert.equal(f.context.sources.some(node=>node.targets.has(f.context.destination)),false);await f.c.release();
});
test('Controller camera replacement retargets stable recording input and capture but never changes the recorder output set',async()=>{
  const f=await fixture(),output=f.mix.stream.getTracks();await f.c.switchDevice('camera','new-camera');
  assert.equal(f.video.input,f.freshCamera);assert.equal(f.stream.getVideoTracks()[0],f.freshCamera);assert.equal(f.camera.stops,1);
  assert.deepEqual(f.mix.stream.getTracks(),output);assert.equal(f.sender.track,f.old);assert.equal(f.remote.stops,0);await f.c.release();
});
test('composite completion rejection restores every input before outgoing microphone retirement',async()=>{
  const f=await fixture(),prepare=f.mix.prepareCandidateMicrophone.bind(f.mix);
  f.mix.prepareCandidateMicrophone=track=>({...prepare(track),complete(){throw new Error('recording rejected');}});
  await assert.rejects(f.c.switchDevice('microphone','new-mic'),/recording rejected/);
  assert.equal(f.sender.track,f.old);assert.equal(f.mix.candidateTrack,f.old);assert.equal(f.stream.getAudioTracks()[0],f.old);
  assert.equal(f.old.stops,0);assert.equal(f.freshMic.stops,1);await f.c.release();
});
test('Finish does not wait for hardware permission and a late replacement cannot revive saved capture',async()=>{
  const wait=deferred(),f=await fixture({captureWait:wait}),changing=f.c.switchDevice('camera','new-camera');
  const rejected=assert.rejects(changing,/cancelled|lifecycle/);await tick();const saved=await f.c.finishSession({record:{mode:'mock'}});
  assert.equal(saved.persisted,true);assert.equal(f.c.phase,'SAVED');assert.equal(f.native.peer,null);
  wait.resolve();await rejected;assert.equal(f.freshCamera.stops,1);assert.equal(f.c.engine,null);assert.equal(f.c.deviceSwitchOperation,null);
});
test('Finish while RTC replaceTrack awaits closes its owner; late resolution never reconnects it',async()=>{
  const wait=deferred(),f=await fixture({senderWait:wait}),changing=f.c.switchDevice('microphone','new-mic');
  const rejected=assert.rejects(changing,/cancelled/);await tick();await f.c.finishSession({record:{mode:'mock'}});
  wait.resolve();await rejected;assert.equal(f.native.state,'closed');assert.equal(f.native.microphoneSender,null);assert.equal(f.freshMic.stops,1);assert.equal(f.c.engine,null);
});
test('failed RTC undo ends only the exact interviewer instead of leaving ended input as apparently healthy LIVE',async()=>{
  const f=await fixture();let stopped=0,message=null;const nativeStop=f.native.stop.bind(f.native);f.native.stop=async()=>{stopped++;return nativeStop();};
  const prepare=f.mix.prepareCandidateMicrophone.bind(f.mix);f.mix.prepareCandidateMicrophone=track=>({...prepare(track),complete(){throw new Error('reject completion');}});
  f.sender.replaceTrack=async track=>{if(track===f.old)throw new Error('undo failed');f.sender.track=track;};f.c.onDeviceFailure=text=>{message=text;};
  await assert.rejects(f.c.switchDevice('microphone','new-mic'),/undo failed/);
  assert.equal(stopped,1);assert.equal(f.native.state,'closed');assert.match(message,/disconnected/);assert.equal(f.mix.candidateTrack,f.old);assert.equal(f.old.stops,0);assert.equal(f.freshMic.stops,1);await f.c.release();
});
test('failed RTC undo during prepare also ends the exact provider and restores candidate-only recording input',async()=>{
  const f=await fixture();let message=null;
  f.sender.replaceTrack=async track=>{if(track===f.old)throw new Error('prepare undo failed');f.sender.track=track;throw new Error('prepare failed after replacing');};
  f.c.onDeviceFailure=text=>{message=text;};
  await assert.rejects(f.c.switchDevice('microphone','new-mic'),/prepare undo failed/);
  assert.equal(f.native.state,'closed');assert.match(message,/disconnected/);assert.equal(f.mix.candidateTrack,f.old);assert.equal(f.old.stops,0);assert.equal(f.freshMic.stops,1);await f.c.release();
});
test('unsupported stable video cannot silently switch camera during recording; microphone remains independently supported',async()=>{
  const f=await fixture();f.c.recordingVideo.destroy();f.c.recordingVideo=null;
  assert.equal(f.c.canSwitchDevice('camera'),false);assert.equal(f.c.canSwitchDevice('microphone'),true);
  await assert.rejects(f.c.switchDevice('camera','new-camera'),/before recording/);assert.equal(f.camera.stops,0);await f.c.release();
});
test('pure Self Practice stable microphone tap never adds interviewer output',async()=>{
  const f=await fixture();await f.live.stop();f.c.live=null;f.mix.remoteSource.disconnect();f.mix.remoteSource=null;f.mix.remoteTrackId=null;
  await f.c.switchDevice('microphone','new-mic');assert.equal(f.mix.remoteTrackId,null);assert.equal(f.mix.candidateTrack,f.freshMic);
  assert.equal(f.context.sources.some(node=>node.targets.has(f.context.destination)),false);await f.c.release();
});
test('generated camera startup and actual Durable candidate recorder use stable outputs, not raw input snapshots',async()=>{
  const camera=new Track('video','raw-camera'),mic=new Track('audio','raw-mic'),stream=new Stream([camera,mic]),context=new Context(),tap=cameraTap(camera),captures=[];
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:false},capabilities:{candidateAudioCapture:true}}),createSession:async()=>({id:'one'}),abandonSession:async()=>({})};
  const durable=new DurableStudioSession({api,MediaStreamCtor:Stream,recordingFactory:opts=>{captures.push(opts);return{recording:{id:'record-'+captures.length},startedAt:100,start:async()=>true,destroy(){}};}});await durable.bootstrap();
  const c=new SessionController({cameraFactory:async()=>tap,mixFactory:opts=>new ConversationRecordingMix({...opts,MediaStreamCtor:Stream})});
  Object.assign(c,{engine:{stream,audioContext:context,beginSession:async()=>{},destroy(){}},phase:'READY',account:{mode:'REAL',role:'student',subject:'wp:1',api},durable});
  await c.startSession({mode:'practice',question:{question_id:'CORE-01',canonical_text:'Question'},wizard:{},interviewSet:[],targetQuestions:1});
  assert.equal(c.phase,'LIVE');assert.equal(captures.length,2);assert.equal(captures[0].stream.getVideoTracks()[0],tap.stream.getVideoTracks()[0]);
  assert.deepEqual(captures[1].stream.getAudioTracks(),c.mix.candidateAudioStream.getAudioTracks());assert.notEqual(captures[1].stream.getAudioTracks()[0],mic);
  assert.equal(captures[1].stream.getVideoTracks().length,0);await c.release();
});
test('ended generated camera during awaited recording allocation cannot publish LIVE or start the provider',async()=>{
  const camera=new Track('video','raw'),mic=new Track('audio','mic'),stream=new Stream([camera,mic]),context=new Context(),tap=cameraTap(camera);let providerStarts=0,abandoned=0;
  const api={identity:{subject:'wp:1',admin:false},bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:false}})};
  const durable={ready:true,api,accountSession:null,recorder:{startedAt:100},prepare:async()=>{durable.accountSession={id:'one'};},start:async({assertCaptureReady})=>{tap.destroy();assertCaptureReady();},abandon:async()=>{abandoned++;}};
  const c=new SessionController({cameraFactory:async()=>tap,mixFactory:opts=>new ConversationRecordingMix({...opts,MediaStreamCtor:Stream}),liveFactory:()=>({connect:async()=>{providerStarts++;}})});
  Object.assign(c,{engine:{stream,audioContext:context,destroy(){}},phase:'READY',account:{mode:'REAL',role:'student',subject:'wp:1',api,liveInterviewAvailable:true},durable});
  await assert.rejects(c.startSession({mode:'mock',question:{question_id:'CORE-01'},wizard:{},interviewSet:[]}),/camera closed/);
  assert.equal(providerStarts,0);assert.equal(c.phase,'READY');assert.equal(abandoned,1);assert.equal(c.durableActive,false);assert.equal(c.recordingVideo,null);
});
test('device preferences remain subject-scoped and a removed saved device is not reacquired by exact id',async t=>{
  const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  t.after(()=>{for(const [name,value]of [['localStorage',oldStorage],['navigator',oldNavigator]]){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}});
  const values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{enumerateDevices:async()=>[{kind:'videoinput',deviceId:'present-camera'},{kind:'audioinput',deviceId:'present-mic'}]}}});
  const c=new SessionController();c.account={mode:'REAL',subject:'wp:1'};c.durable={ready:true};c.video={};c.audioElement={};
  c.persistDevicePreferences({cameraDeviceId:'gone-camera',microphoneDeviceId:'present-mic'});assert.equal(values.has('ivoc.fable.devices.v1:wp:1'),true);
  c.account.subject='wp:2';assert.deepEqual(c.devicePreferences(),{});c.account.subject='wp:1';let selected;
  c.engineFactory=async()=>({stream:new Stream([new Track('video','present-camera'),new Track('audio','present-mic')]),start:async input=>{selected=input;},destroy(){}});
  await c.acquire();assert.equal(selected.cameraDeviceId,'');assert.equal(selected.microphoneDeviceId,'present-mic');await c.release();
});
