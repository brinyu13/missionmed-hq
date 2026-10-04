import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveAnalyticsMediaBridge} from '../../public/live-analytics/media-bridge.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {ConversationRecordingMix} from '../../public/capabilities/conversation-recording.mjs';

class Track extends EventTarget {
  constructor(kind,id){super();Object.assign(this,{kind,id,label:id,readyState:'live',enabled:true,muted:false,stops:0});}
  getSettings(){return{deviceId:this.id};}
  stop(){this.stops++;this.readyState='ended';}
}
class Stream {
  constructor(tracks=[]){this.tracks=[...tracks];}
  getTracks(){return[...this.tracks];}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}
  getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}
  addTrack(t){if(!this.tracks.includes(t))this.tracks.push(t);}
  removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}
}
class Node {
  constructor(stream=null){this.stream=stream;this.targets=new Set();this.disconnections=0;this.fftSize=2048;}
  connect(target){this.targets.add(target);}
  disconnect(){this.targets.clear();this.disconnections++;}
}
class Context {
  constructor(){this.state='running';this.sources=[];this.sinks=[];this.destination={speakers:true};this.rejectGraph=false;}
  resume(){return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  createMediaStreamSource(stream){if(this.rejectGraph&&stream.getAudioTracks()[0]?.id==='new-mic')throw new Error('graph rejected');const n=new Node(stream);this.sources.push(n);return n;}
  createMediaStreamDestination(){const n=new Node(new Stream([new Track('audio','sink-'+this.sinks.length)]));this.sinks.push(n);return n;}
  createAnalyser(){return new Node();}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
async function fixture({captureWait=null,senderWait=null,rejectSender=false}={}){
  const old=new Track('audio','old-mic'),fresh=new Track('audio','new-mic'),camera=new Track('video','camera'),remote=new Track('audio','interviewer');
  const stream=new Stream([camera,old]),context=new Context(),clock={sessionMs:()=>100};
  const pipeline={session:{clock},ensureSession(){return this.session;},beginAnswer(){},destroy(){}};
  let captures=0;
  const bridge=new LiveAnalyticsMediaBridge({audioContextFactory:()=>context,pipelineFactory:()=>pipeline,mediaDevices:null,
    getUserMedia:async()=>{if(++captures===1)return stream;if(captureWait)await captureWait.promise;return new Stream([fresh]);}});
  await bridge.requestMedia();bridge.ensureAnalytics();
  const mix=new ConversationRecordingMix({candidateStream:stream,audioContext:context,MediaStreamCtor:Stream,retainCandidateAudio:true});
  mix.attachAuthoritativeAudio(new Stream([remote]));
  const sender={track:old,calls:[],async replaceTrack(t){this.calls.push(t);if(t===fresh&&senderWait)await senderWait.promise;if(t===fresh&&rejectSender)throw new Error('sender rejected');this.track=t;}};
  const peer={closed:false,close(){this.closed=true;}};
  const native=new LiveInterviewSession({createSession(){},endSession:async()=>{},PeerConnection:class{}});
  native.peer=peer;native.state='active';native.microphoneSender=sender;
  let current=true;
  const assertCurrent=()=>{if(!current)throw new Error('owner cancelled');};
  const coordinator={assertCurrent,async prepareReplacement({kind,incoming}){
    assert.equal(kind,'audio');const recording=mix.prepareCandidateMicrophone(incoming);let microphone;
    try{microphone=await native.prepareMicrophoneReplacement(incoming,{isCurrent:()=>current});}
    catch(e){recording.rollback();throw e;}
    return{commit(){microphone.commit();recording.commit();},async rollback(){recording.rollback();await microphone.rollback();},complete(){recording.complete();microphone.complete();},release(){recording.release();microphone.release();}};
  }};
  return{old,fresh,camera,remote,stream,context,clock,pipeline,bridge,mix,sender,peer,native,coordinator,cancel(){current=false;}};
}
test('actual bridge + native sender + two recording taps change input atomically without changing output tracks or clock',async()=>{
  const f=await fixture(),recorded=f.mix.stream.getTracks(),candidate=f.mix.candidateAudioStream?.getTracks(),remoteSource=f.mix.remoteSource;
  await f.bridge.replaceTrack('microphone','new-mic',f.coordinator);
  assert.equal(f.sender.track,f.fresh,'interviewer must receive the selected microphone');
  assert.equal(f.mix.candidateSource.stream.getAudioTracks()[0],f.fresh,'conversation recorder must receive the selected microphone');
  assert.deepEqual(f.mix.stream.getTracks(),recorded);assert.deepEqual(f.mix.candidateAudioStream.getTracks(),candidate);
  assert.equal(f.mix.remoteSource,remoteSource);assert.equal(f.mix.remoteTrackId,'interviewer');
  assert.deepEqual([...f.mix.candidateSource.targets],[f.mix.destination,f.mix.candidateDestination]);
  assert.deepEqual([...f.mix.remoteSource.targets],[f.mix.destination],'candidate-only tap excludes interviewer');
  assert.equal(f.context.sources.some(n=>n.targets.has(f.context.destination)),false);
  assert.equal(f.bridge.media.stream,f.stream);assert.equal(f.bridge.analyticsPipeline,f.pipeline);assert.equal(f.bridge.sessionClock,f.clock);
  assert.equal(f.old.stops,1);assert.equal(f.fresh.stops,0);assert.equal(f.camera.stops,0);assert.equal(f.remote.stops,0);
  f.mix.destroy();f.bridge.destroy();
});
for(const failure of ['sender','graph'])test(failure+' rejection retains original capture, provider input and recording',async()=>{
  const f=await fixture({rejectSender:failure==='sender'});if(failure==='graph')f.context.rejectGraph=true;
  const original=f.mix.candidateSource;
  await assert.rejects(f.bridge.replaceTrack('microphone','new-mic',f.coordinator),/rejected/);
  assert.equal(f.bridge.media.microphoneTrack,f.old);assert.deepEqual(f.stream.getAudioTracks(),[f.old]);assert.equal(f.sender.track,f.old);
  assert.equal(f.mix.candidateSource,original);assert.equal(original.targets.has(f.mix.destination),true);
  assert.equal(f.old.stops,0);assert.equal(f.fresh.stops,1);assert.equal(f.mix.remoteTrackId,'interviewer');
  f.mix.destroy();f.bridge.destroy();
});
test('Finish while native replacement awaits rejects late publication and never reconnects a closed provider',async()=>{
  const wait=deferred(),f=await fixture({senderWait:wait});
  const operation=f.bridge.replaceTrack('microphone','new-mic',f.coordinator);const rejected=assert.rejects(operation,/cancelled|lifecycle|closed/);
  for(let n=0;f.sender.calls.length===0&&n<30;n++)await new Promise(r=>setImmediate(r));
  assert.equal(f.sender.calls.length,1);f.cancel();await f.native.stop();f.mix.destroy();f.bridge.stopMedia();wait.resolve();await rejected;
  assert.equal(f.bridge.media.stream,null);assert.equal(f.fresh.stops,1);assert.equal(f.old.stops,1);assert.equal(f.peer.closed,true);
  assert.equal(f.sender.calls.length,1,'late completion must not restore a microphone to a closed peer');
  assert.equal(f.context.sources.every(n=>n.targets.size===0),true);
});
test('Finish while hardware acquisition awaits stops late fresh input without touching a new owner',async()=>{
  const wait=deferred(),f=await fixture({captureWait:wait});
  const operation=f.bridge.replaceTrack('microphone','new-mic',f.coordinator);const rejected=assert.rejects(operation,/lifecycle/);
  await new Promise(r=>setImmediate(r));f.cancel();f.bridge.stopMedia();f.mix.destroy();await f.native.stop();wait.resolve();await rejected;
  assert.equal(f.bridge.media.stream,null);assert.equal(f.fresh.stops,1);assert.equal(f.sender.calls.length,0);
});
test('closed/muted replacement is rejected before retargeting any consumer',async()=>{
  const f=await fixture();f.fresh.muted=true;
  await assert.rejects(f.bridge.replaceTrack('microphone','new-mic',f.coordinator),/microphone|usable/);
  assert.equal(f.sender.calls.length,0);assert.equal(f.old.stops,0);assert.equal(f.fresh.stops,1);
  f.mix.destroy();f.bridge.destroy();
});
test('completed or stale recording rollback cannot disconnect the active candidate taps',async()=>{
  const f=await fixture();
  const prior=f.mix.prepareCandidateMicrophone(f.fresh);prior.commit();prior.complete();prior.release();
  const active=f.mix.candidateSource;
  assert.equal(prior.rollback(),false);assert.equal(active.targets.size,2);
  const newer=f.mix.prepareCandidateMicrophone(new Track('audio','third-mic'));
  assert.equal(prior.rollback(),false);assert.equal(active.targets.size,2);
  newer.rollback();assert.equal(active.targets.size,2);
  f.mix.destroy();f.bridge.destroy();
});
for(const participant of ['recording','native'])test('partial '+participant+' completion retains rollback ownership for every consumer',async()=>{
  const f=await fixture(),source=f.mix.candidateSource;
  const owner=participant==='recording'?f.mix:f.native;
  const name=participant==='recording'?'prepareCandidateMicrophone':'prepareMicrophoneReplacement';
  const original=owner[name].bind(owner);
  const wrap=tx=>({...tx,complete(){tx.complete();throw new Error('partial completion rejected');}});
  owner[name]=participant==='recording'?track=>wrap(original(track)):async(...args)=>wrap(await original(...args));
  await assert.rejects(f.bridge.replaceTrack('microphone','new-mic',f.coordinator),/partial completion rejected/);
  assert.equal(f.old.stops,0);assert.equal(f.fresh.stops,1);assert.equal(f.sender.track,f.old);
  assert.equal(f.bridge.media.microphoneTrack,f.old);assert.deepEqual(f.stream.getAudioTracks(),[f.old]);
  assert.equal(f.mix.candidateSource,source);assert.equal(source.targets.size,2);
  assert.equal(f.mix.candidateReplacement,null);assert.equal(f.native.microphoneReplacement,null);
  f.mix.destroy();f.bridge.destroy();
});
test('a rejected completion rolls back before the old input is irreversibly stopped',async()=>{
  const f=await fixture(),source=f.mix.candidateSource,prepare=f.coordinator.prepareReplacement;
  f.coordinator.prepareReplacement=async input=>({...await prepare(input),complete(){throw new Error('finalizer rejected');}});
  await assert.rejects(f.bridge.replaceTrack('microphone','new-mic',f.coordinator),/finalizer rejected/);
  assert.equal(f.old.stops,0);assert.equal(f.fresh.stops,1);assert.equal(f.sender.track,f.old);
  assert.equal(f.bridge.media.microphoneTrack,f.old);assert.deepEqual(f.stream.getAudioTracks(),[f.old]);
  assert.equal(f.mix.candidateSource,source);assert.equal(source.targets.size,2);
  f.mix.destroy();f.bridge.destroy();
});
