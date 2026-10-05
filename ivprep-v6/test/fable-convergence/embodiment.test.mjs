import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {EmbodimentCommandQueue,PcmBatcher,EmbodimentRenderer} from '../../public/capabilities/embodiment-renderer.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
test('browser fetch keeps its Window/global receiver, not the renderer instance',async()=>{
  const requests=[];
  const renderer=new EmbodimentRenderer({csrfToken:'test-csrf',sessionId:'canonical',AudioContextCtor:class {},
    fetchImpl:async function(url,options){assert.equal(this,globalThis,'Window.fetch rejects an EmbodimentRenderer receiver');requests.push({url,options});return {ok:true,json:async()=>({available:false})};}});
  assert.deepEqual(await renderer.api(''),{available:false});
  await renderer.api('/command',{sessionId:'canonical',command:'terminate'});
  assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.credentials,'same-origin');
  assert.equal(requests[1].options.method,'POST');assert.equal(requests[1].options.headers['X-MMHQ-CSRF'],'test-csrf');
});
test('bounded PCM batches preserve quiet speech and all 480ms of a pause, clearing only explicit interruption',()=>{
  const emitted=[];const batcher=new PcmBatcher(bytes=>emitted.push(new Int16Array(bytes)));
  const frames=Array.from({length:6},(_,i)=>new Int16Array(1280).fill(i===0?1:0));
  for(const frame of frames)batcher.push(frame.buffer);
  assert.equal(emitted.reduce((n,p)=>n+p.length,0),6*1280);assert.equal(emitted[0][0],1);
  batcher.push(new Int16Array(1280).fill(123).buffer);batcher.clear();batcher.flush();assert.equal(emitted.length,2);
});
test('interrupt discards unsent PCM and serializes a fresh generation after in-flight delivery',async()=>{
  const first=deferred(),sent=[];const queue=new EmbodimentCommandQueue(async item=>{sent.push({...item,resolve:undefined,reject:undefined});if(sent.length===1)await first.promise;return {ok:true};});
  const one=queue.push('audio',{audio:'first'}),stale=queue.push('audio',{audio:'unheard'});const flushing=queue.interrupt();
  assert.equal((await stale).discarded,true);first.resolve();await one;await flushing;
  assert.deepEqual(sent.map(v=>[v.command,v.generation]),[['audio',1],['interrupt',2]]);assert.equal(sent.some(v=>v.audio==='unheard'),false);
  await queue.push('audio',{audio:'new'});assert.equal(sent.at(-1).generation,2);queue.close();await assert.rejects(queue.push('audio'),/stopped/);
});
test('backpressure fails closed instead of retaining an unbounded delayed interview',async()=>{
  const first=deferred(),faults=[];const queue=new EmbodimentCommandQueue(()=>first.promise,{maxQueued:1,onFailure:e=>faults.push(e.message)});
  const inflight=queue.push('audio'),pending=queue.push('audio');await assert.rejects(queue.push('audio'),/queue limit/);assert.equal(queue.closed,true);assert.equal(faults.length,1);assert.equal((await pending).discarded,true);first.resolve();await inflight;
});
test('native input remains silent; only rendered stable output is recorded before audible playback',async()=>{
  const order=[],native={id:'native'},heard={id:'rendered'},microphone={kind:'audio',readyState:'live',enabled:true};let rendererStops=0;
  class Peer{constructor(){this.iceGatheringState='complete';}addTrack(){}createDataChannel(){return this.channel={readyState:'open',send:data=>order.push(JSON.parse(data).type),close(){}};}async createOffer(){return {sdp:'offer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(){queueMicrotask(()=>{this.channel.onmessage({data:JSON.stringify({type:'session.started'})});this.ontrack({track:{id:'one',kind:'audio'},streams:[native]});});}close(){}}
  const audio={srcObject:null,async play(){assert.equal(this.srcObject,heard);order.push('play');},pause(){order.push('pause');}};
  const renderer={async render(stream,{microphoneTrack,ivocSessionId}){assert.equal(stream,native);assert.equal(microphoneTrack,microphone);assert.equal(ivocSessionId,'canonical');order.push('render');return heard;},stop(){rendererStops++;order.push('mute');return Promise.resolve();}};
  const session=new LiveInterviewSession({audioElement:audio,audioRenderer:renderer,PeerConnection:Peer,
    createSession:async()=>({session:{id:'provider',model:'gpt-live-1'},transport:{sdp:'answer'},audioAuthority:{mode:'single',authority:'openai-gpt-live-native'}}),endSession:async()=>order.push('end-provider'),
    onAuthoritativeAudioStream:stream=>{assert.equal(stream,heard);order.push('record-tap');}});
  await session.start({audioTrack:microphone,ivocSessionId:'canonical',openingQuestion:'Question?'});
  assert.deepEqual(order.slice(0,4),['render','record-tap','play','session.instructions.append']);
  await session.stop();assert.equal(rendererStops,1);assert.ok(order.indexOf('mute')<order.indexOf('end-provider'));assert.equal(audio.srcObject,null);
});
test('presentation consumes renderer, preserves dominant host/self-view and never adds another audible element',async()=>{
  const read=path=>readFile(new URL(path,import.meta.url),'utf8');
  const renderer=await read('../../public/capabilities/embodiment-renderer.mjs');
  assert.match(renderer,/video\.muted=true/);assert.doesNotMatch(renderer.replace(/\/\/[^\n]*/g,''),/track\.attach\(/);assert.match(renderer,/gain\.connect\(this\.destination\)/);
  assert.match(renderer,/this\.gain\.gain\.value=0/);assert.match(renderer,/canary reached its 45-second limit/);
  const room=await read('../../public/studio-fable/app/room.mjs');assert.match(room,/data-embodiment-host/);assert.match(room,/wizard\.embodimentCanary=true/);assert.match(room,/audioRenderer,\.\.\.callbacks/);
  const worklet=await read('../../public/capabilities/embodiment-pcm-worklet.mjs');assert.match(worklet,/channel\.fill\(0\)/);assert.match(worklet,/Int16Array\(1280\)/);
});
