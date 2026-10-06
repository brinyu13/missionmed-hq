import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {EmbodimentCommandQueue,PcmBatcher,EmbodimentRenderer,EMBODIMENT_START_TIMEOUT_MS,decodedAvatarFrame} from '../../public/capabilities/embodiment-renderer.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function videoFixture(){const video=new EventTarget();Object.assign(video,{paused:true,readyState:0,videoWidth:0,videoHeight:0,play:async()=>{video.paused=false;},pause:()=>{video.paused=true;},setAttribute(){},requestVideoFrameCallback:callback=>{video.frame=callback;return 7;},cancelVideoFrameCallback:()=>{video.cancelled=true;}});return video;}
test('avatar gate needs a presented decoded frame, not DOM, play or track subscription',async()=>{
  const video=videoFixture();let ready=false;const waiting=decodedAvatarFrame(video).then(e=>{ready=true;return e;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);
  video.frame(0,{presentedFrames:1});assert.equal(ready,false,'zero dimensions remain unavailable');
  Object.assign(video,{readyState:2,videoWidth:640,videoHeight:480});video.frame(1,{presentedFrames:1});
  const evidence=await waiting;assert.equal(evidence.signal,'REQUEST_VIDEO_FRAME_CALLBACK');assert.equal(evidence.width,640);assert.equal(video.cancelled,true);
});
test('decoded-frame failure, playback failure and cancellation clean callbacks and never become READY',async()=>{
  const missing=videoFixture();await assert.rejects(decodedAvatarFrame(missing,{timeoutMs:5}),e=>e.diagnostics.category==='DECODED_FRAME_FAILURE');assert.equal(missing.cancelled,true);
  const broken=videoFixture();broken.play=async()=>{throw new Error('PRIVATE_PLAYBACK_DETAILS');};await assert.rejects(decodedAvatarFrame(broken),e=>e.diagnostics.category==='DECODED_FRAME_FAILURE');
  const cancelled=videoFixture(),abort=new AbortController(),waiting=decodedAvatarFrame(cancelled,{signal:abort.signal});abort.abort();await assert.rejects(waiting,e=>e.diagnostics.category==='CLIENT_ABORT');assert.equal(cancelled.cancelled,true);
});
test('browser fallback requires playing, dimensions and current decoded data',async()=>{
  const video=videoFixture();video.requestVideoFrameCallback=undefined;let ready=false;const waiting=decodedAvatarFrame(video).then(e=>{ready=true;return e;});await new Promise(resolve=>setImmediate(resolve));
  video.dispatchEvent(new Event('playing'));assert.equal(ready,false);
  Object.assign(video,{readyState:2,videoWidth:640,videoHeight:480});video.dispatchEvent(new Event('playing'));assert.equal((await waiting).signal,'PLAYING_WITH_CURRENT_FRAME');
});
test('native client timeout/abort and HQ auth/validation failures remain distinguishable',async()=>{
  for(const [name,category] of [['TimeoutError','CLIENT_TIMEOUT'],['AbortError','CLIENT_ABORT']]){
    const renderer=new EmbodimentRenderer({AudioContextCtor:class {},fetchImpl:async()=>{throw Object.assign(new Error('PRIVATE'),{name});}});
    await assert.rejects(renderer.api('/start',{}),e=>e.diagnostics.category===category&&!e.message.includes('PRIVATE'));
  }
  for(const [status,category] of [[401,'HQ_AUTH_FAILURE'],[403,'HQ_AUTH_FAILURE'],[400,'HQ_VALIDATION_FAILURE']]){
    const renderer=new EmbodimentRenderer({AudioContextCtor:class {},fetchImpl:async()=>({ok:false,status,json:async()=>({error:'PRIVATE'})})});
    await assert.rejects(renderer.api('/start',{}),e=>e.diagnostics.category===category&&e.diagnostics.httpStatus===status&&!e.message.includes('PRIVATE'));
  }
});
test('browser fetch keeps its Window/global receiver, not the renderer instance',async()=>{
  const requests=[];
  const renderer=new EmbodimentRenderer({csrfToken:'test-csrf',sessionId:'canonical',AudioContextCtor:class {},
    fetchImpl:async function(url,options){assert.equal(this,globalThis,'Window.fetch rejects an EmbodimentRenderer receiver');requests.push({url,options});return {ok:true,json:async()=>({available:false})};}});
  assert.deepEqual(await renderer.api(''),{available:false});
  await renderer.api('/command',{sessionId:'canonical',command:'terminate'});
  assert.equal(requests[0].options.method,'GET');assert.equal(requests[0].options.credentials,'same-origin');
  assert.equal(requests[1].options.method,'POST');assert.equal(requests[1].options.headers['X-MMHQ-CSRF'],'test-csrf');
});
test('client response-body timeout/cancel is not swallowed as a successful empty ticket',async()=>{
  for(const [name,category] of [['TimeoutError','CLIENT_TIMEOUT'],['AbortError','CLIENT_ABORT'],['SyntaxError','HQ_RESPONSE_INVALID']]){
    const renderer=new EmbodimentRenderer({AudioContextCtor:class {},fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw Object.assign(new Error('PRIVATE_BODY'),{name});}})});
    await assert.rejects(renderer.api('/start',{}),e=>e.diagnostics.category===category&&!e.message.includes('PRIVATE_BODY'));
  }
});
test('start has a bounded orchestration timeout; commands remain short and no retry is issued',async()=>{
  const timeouts=[],calls=[];
  const renderer=new EmbodimentRenderer({AudioContextCtor:class {},sessionId:'canonical',
    timeoutSignal:ms=>{timeouts.push(ms);return new AbortController().signal;},
    fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({id:'attempt'})};}});
  await renderer.api('/start',{sessionId:'canonical'});
  await renderer.api('/command',{sessionId:'canonical',command:'terminate'});
  assert.equal(EMBODIMENT_START_TIMEOUT_MS,30000);assert.deepEqual(timeouts,[30000,5000]);
  assert.equal(calls.filter(c=>c.url.endsWith('/start')).length,1);
});
test('early cancellation terminates the exact reserved session even before a ticket, without another create',async()=>{
  const calls=[],renderer=new EmbodimentRenderer({AudioContextCtor:class {},sessionId:'canonical',
    fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({stopped:true,providerConfirmed:false})};}});
  renderer.startRequested=true;renderer.context={close:async()=>{}};
  await renderer.stop();assert.equal(renderer.closed,true);
  assert.deepEqual(calls.map(c=>c.body),[{sessionId:'canonical',command:'terminate'}]);
  renderer.ticket={id:'late-attempt'};
  await renderer.stop({late:true});
  assert.equal(calls.length,2);assert.equal(calls[1].body.id,'late-attempt');
  assert.ok(calls.every(c=>c.url.endsWith('/command')));
});
test('audio-driven avatar returns its stable silent output before generated A/V, allowing the sole opening turn',async()=>{
  const commands=[],nodes=[];
  const node=()=>({connect(){},disconnect(){}});
  const output={id:'stable-rendered'};
  class Context{
    sampleRate=16000;destination={};audioWorklet={addModule:async()=>{}};
    async resume(){}async close(){}
    createMediaStreamDestination(){return {...node(),stream:output};}
    createGain(){return {...node(),gain:{value:1}};}
    createMediaStreamSource(){return node();}
    createAnalyser(){return {...node(),getFloatTimeDomainData:a=>a.fill(0)};}
  }
  class Worklet{port={onmessage:null};constructor(){nodes.push(this);}connect(){}disconnect(){}}
  class Room{handlers={};on(event,callback){this.handlers[event]=callback;}async connect(){}async disconnect(){}}
  const host={dataset:{},replaceChildren(){}};
  const oldDocument=globalThis.document,oldStream=globalThis.MediaStream,avatar=videoFixture();
  globalThis.document={createElement:()=>avatar};globalThis.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
  const renderer=new EmbodimentRenderer({host,sessionId:'canonical',AudioContextCtor:Context,AudioWorkletNodeCtor:Worklet,
    loadSdk:async()=>({Room,RoomEvent:{TrackSubscribed:'track',Disconnected:'closed'}}),
    fetchImpl:async(url,options)=>{const body=options.body?JSON.parse(options.body):null;commands.push({url,body});return {ok:true,json:async()=>url.endsWith('/start')?{id:'attempt',publisherIdentity:'publisher',deadlineMs:Date.now()+45000}:url.includes('/status')?{closed:false}:{accepted:true}};}});
  try{
    assert.equal(await renderer.render({id:'native'},{ivocSessionId:'canonical'}),output);
    assert.equal(host.dataset.avatarState,'connecting');assert.equal(renderer.video,undefined);
    for(let i=0;i<3;i++)nodes[0].port.onmessage({data:{rms:0.04,pcm:new Int16Array(1280).fill(1).buffer}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(commands.filter(c=>c.url.endsWith('/start')).length,1);
    assert.equal(commands.some(c=>c.body?.command==='audio'),true);
    assert.equal(renderer.gain.gain.value,1);
    renderer.room.handlers.track({kind:'video',mediaStreamTrack:{}},null,{identity:'wrong-publisher'});
    assert.equal(renderer.video,undefined);
    renderer.room.handlers.track({kind:'video',mediaStreamTrack:{}},null,{identity:'publisher'});
    renderer.room.handlers.track({kind:'audio',mediaStreamTrack:{}},null,{identity:'publisher'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(renderer.diagnostics().visualReady,false);assert.equal(host.dataset.avatarState,'decoding');
    Object.assign(avatar,{readyState:2,videoWidth:640,videoHeight:480});avatar.frame(1,{presentedFrames:1});
    await renderer.waitForVisualReady();assert.equal(host.dataset.avatarState,'live');assert.equal(renderer.diagnostics().state,'EMBODIMENT_READY');
    assert.equal(renderer.diagnostics().audioBound,true);assert.equal(avatar.muted,true);
    assert.equal(renderer.destination.stream,output,'readiness does not replace the recorded single tap');
  }finally{await renderer.stop();if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldStream===undefined)delete globalThis.MediaStream;else globalThis.MediaStream=oldStream;}
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
test('sole opening drives audio-dependent avatar; decoded frame still gates startup after the stable recording tap',async()=>{
  const order=[],native={id:'native'},heard={id:'rendered'},microphone={kind:'audio',readyState:'live',enabled:true};let rendererStops=0;
  class Peer{constructor(){this.iceGatheringState='complete';}addTrack(){}createDataChannel(){return this.channel={readyState:'open',send:data=>order.push(JSON.parse(data).type),close(){}};}async createOffer(){return {sdp:'offer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(){queueMicrotask(()=>{this.channel.onmessage({data:JSON.stringify({type:'session.started'})});this.ontrack({track:{id:'one',kind:'audio'},streams:[native]});});}close(){}}
  const audio={srcObject:null,async play(){assert.equal(this.srcObject,heard);order.push('play');},pause(){order.push('pause');}};
  const visual=deferred();
  const renderer={transition(state){order.push(state);},waitForVisualReady(){return visual.promise;},async render(stream,{microphoneTrack,ivocSessionId}){assert.equal(stream,native);assert.equal(microphoneTrack,microphone);assert.equal(ivocSessionId,'canonical');order.push('render');return heard;},stop(){rendererStops++;order.push('mute');return Promise.resolve();}};
  const session=new LiveInterviewSession({audioElement:audio,audioRenderer:renderer,PeerConnection:Peer,
    createSession:async()=>({session:{id:'provider',model:'gpt-live-1'},transport:{sdp:'answer'},audioAuthority:{mode:'single',authority:'openai-gpt-live-native'}}),endSession:async()=>order.push('end-provider'),
    onAuthoritativeAudioStream:stream=>{assert.equal(stream,heard);order.push('record-tap');}});
  const starting=session.start({audioTrack:microphone,ivocSessionId:'canonical',openingQuestion:'Question?'});
  let ready=false;starting.then(()=>{ready=true;});
  while(!order.includes('play'))await new Promise(resolve=>setImmediate(resolve));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(order.filter(v=>v==='session.instructions.append').length,1,'without the real opening the provider cannot generate its first frame');
  assert.equal(ready,false,'track/transport/opening alone never claim visual readiness');
  assert.ok(order.indexOf('GPT_READY')<order.indexOf('render'));
  visual.resolve();await starting;
  assert.deepEqual(order.filter(v=>['render','record-tap','play','session.instructions.append'].includes(v)),['render','record-tap','play','session.instructions.append']);
  await session.stop();assert.equal(rendererStops,1);assert.ok(order.indexOf('mute')<order.indexOf('end-provider'));assert.equal(audio.srcObject,null);
});
test('missing decoded avatar after the opening fails startup and tears down the single audio owner',async()=>{
  const sent=[];let stopped=0,ended=0;
  class Peer{constructor(){this.iceGatheringState='complete';}addTrack(){}createDataChannel(){return this.channel={readyState:'open',send:raw=>sent.push(JSON.parse(raw)),close(){}};}async createOffer(){return {sdp:'offer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(){queueMicrotask(()=>{this.channel.onmessage({data:JSON.stringify({type:'session.started'})});this.ontrack({track:{id:'one',kind:'audio'},streams:[{}]});});}close(){}}
  const heard={},audio={srcObject:null,play:async()=>{},pause(){}},renderer={transition(){},render:async()=>heard,waitForVisualReady:async()=>{throw new Error('decoded frame unavailable');},stop:async()=>{stopped++;}};
  const session=new LiveInterviewSession({PeerConnection:Peer,audioElement:audio,audioRenderer:renderer,
    createSession:async()=>({session:{id:'provider',model:'gpt-live-1'},transport:{sdp:'answer'},audioAuthority:{mode:'single',authority:'openai-gpt-live-native'}}),endSession:async()=>{ended++;}});
  await assert.rejects(session.start({audioTrack:{kind:'audio',readyState:'live'},ivocSessionId:'canonical',openingQuestion:'Question?'}),/decoded frame unavailable/);
  assert.deepEqual(sent.map(e=>e.type),['session.instructions.append','session.close']);
  assert.equal(stopped,1);assert.equal(ended,1);assert.equal(audio.srcObject,null);assert.equal(session.state,'error');
});
test('presentation consumes renderer, preserves dominant host/self-view and never adds another audible element',async()=>{
  const read=path=>readFile(new URL(path,import.meta.url),'utf8');
  const renderer=await read('../../public/capabilities/embodiment-renderer.mjs');
  assert.match(renderer,/video\.muted=true/);assert.doesNotMatch(renderer.replace(/\/\/[^\n]*/g,''),/track\.attach\(/);assert.match(renderer,/gain\.connect\(this\.destination\)/);
  assert.match(renderer,/this\.gain\.gain\.value=0/);assert.match(renderer,/canary reached its 45-second limit/);
  const room=await read('../../public/studio-fable/app/room.mjs');assert.match(room,/data-embodiment-host/);assert.match(room,/wizard\.embodimentCanary=true/);assert.match(room,/audioRenderer,\.\.\.callbacks/);
  const worklet=await read('../../public/capabilities/embodiment-pcm-worklet.mjs');assert.match(worklet,/channel\.fill\(0\)/);assert.match(worklet,/Int16Array\(1280\)/);
  const live=await read('../../public/capabilities/live-interview.mjs');assert.match(live,/this\.audioRenderer\?40_000:START_TIMEOUT_MS/);
});
test('cancel before GPT session.started settles the ontrack wait without creating an avatar',async()=>{
  let peer,rendered=0;
  class Peer{constructor(){peer=this;this.iceGatheringState='complete';}addTrack(){}createDataChannel(){return this.channel={readyState:'open',send(){},close(){}};}async createOffer(){return {sdp:'offer'};}async setLocalDescription(d){this.localDescription=d;}async setRemoteDescription(){this.bound=this.ontrack({track:{id:'one',kind:'audio'},streams:[{id:'native'}]});}close(){}}
  const session=new LiveInterviewSession({audioElement:{pause(){}},audioRenderer:{transition(){},render(){rendered++;},stop:async()=>{}},PeerConnection:Peer,
    createSession:async()=>({session:{id:'provider',model:'gpt-live-1'},transport:{sdp:'answer'},audioAuthority:{mode:'single',authority:'openai-gpt-live-native'}}),endSession:async()=>{}});
  const starting=session.start({audioTrack:{kind:'audio',readyState:'live',enabled:true},ivocSessionId:'canonical',openingQuestion:'Question?'});starting.catch(()=>{});
  while(!peer?.bound)await new Promise(resolve=>setImmediate(resolve));
  await session.stop();await assert.rejects(starting,/stopped/);await peer.bound;
  assert.equal(rendered,0);assert.equal(session.startedReject,null);
});
