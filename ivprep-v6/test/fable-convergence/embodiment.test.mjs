import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {EmbodimentCommandQueue,PcmBatcher,EmbodimentRenderer,EMBODIMENT_START_TIMEOUT_MS,decodedAvatarFrame} from '../../public/capabilities/embodiment-renderer.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {publicEmbodimentFailure} from '../../server/providers/lemonslice-embodiment.mjs';
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
test('native PCM is bound and transmitted during a slow LiveKit join; stable output still owns the sole opening',async()=>{
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
  const joined=deferred(),joining=deferred();
  class Room{handlers={};on(event,callback){this.handlers[event]=callback;}async connect(){joining.resolve();await joined.promise;}async disconnect(){}}
  const host={dataset:{},replaceChildren(){}};
  const oldDocument=globalThis.document,oldStream=globalThis.MediaStream,avatar=videoFixture();
  const pulls=[],returnedPlay=deferred();
  globalThis.document={createElement:tag=>{if(tag==='video')return avatar;const index=pulls.length,element={play:async()=>{assert.equal(element.muted,true);assert.equal(element.volume,0);if(index===1)await returnedPlay.promise;element.played=true;},pause:()=>{element.paused=true;}};pulls.push(element);return element;}};globalThis.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
  const renderer=new EmbodimentRenderer({host,sessionId:'canonical',AudioContextCtor:Context,AudioWorkletNodeCtor:Worklet,
    loadSdk:async()=>({Room,RoomEvent:{TrackSubscribed:'track',Disconnected:'closed'}}),
    fetchImpl:async(url,options)=>{const body=options.body?JSON.parse(options.body):null;commands.push({url,body});return {ok:true,json:async()=>url.endsWith('/start')?{id:'attempt',publisherIdentity:'publisher',deadlineMs:Date.now()+45000}:url.includes('/status')?{closed:false}:{accepted:true}};}});
  try{
    const rendering=renderer.render({id:'native'},{ivocSessionId:'canonical'});
    await joining.promise;
    assert.equal(renderer.inputBound,true,'viewer connection cannot gate native input');
    assert.equal(nodes.length,1);
    for(let i=0;i<3;i++)nodes[0].port.onmessage({data:{rms:0,pcm:new Int16Array(1280).buffer,generation:1}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(commands.some(c=>c.body?.command==='audio'),true,'real quiet PCM reaches transport before viewer join');
    assert.equal(renderer.signalEvidence.inputPeakRms,0,'quiet input is not promoted to spoken acceptance');
    joined.resolve();assert.equal(await rendering,output);
    assert.equal(pulls.length,1);assert.equal(pulls[0].srcObject.id,'native');assert.equal(pulls[0].played,true);
    assert.equal(host.dataset.avatarState,'connecting');assert.equal(renderer.video,undefined);
    for(let i=0;i<3;i++)nodes[0].port.onmessage({data:{rms:0.04,pcm:new Int16Array(1280).fill(1).buffer,generation:1}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(commands.filter(c=>c.url.endsWith('/start')).length,1);
    assert.equal(commands.some(c=>c.body?.command==='audio'),true);
    assert.equal(renderer.gain.gain.value,1);
    renderer.room.handlers.track({kind:'video',mediaStreamTrack:{}},null,{identity:'wrong-publisher'});
    assert.equal(renderer.video,undefined);
    renderer.room.handlers.track({kind:'video',mediaStreamTrack:{}},null,{identity:'publisher'});
    const returnedBinding=renderer.room.handlers.track({kind:'audio',mediaStreamTrack:{}},null,{identity:'publisher'});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(renderer.diagnostics().visualReady,false);assert.equal(host.dataset.avatarState,'decoding');
    Object.assign(avatar,{readyState:2,videoWidth:640,videoHeight:480});avatar.frame(1,{presentedFrames:1});
    await renderer.waitForVisualReady();assert.notEqual(host.dataset.avatarState,'live');assert.equal(renderer.diagnostics().audioBound,false);
    returnedPlay.resolve();await returnedBinding;
    assert.equal(host.dataset.avatarState,'live');assert.equal(renderer.diagnostics().state,'EMBODIMENT_READY');
    assert.equal(renderer.diagnostics().audioBound,true);assert.equal(avatar.muted,true);
    assert.equal(renderer.destination.stream,output,'readiness does not replace the recorded single tap');
    assert.equal(pulls.length,2);assert.equal(pulls[1].played,true);
  }finally{await renderer.stop();for(const pull of pulls){assert.equal(pull.paused,true);assert.equal(pull.srcObject,null);}if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldStream===undefined)delete globalThis.MediaStream;else globalThis.MediaStream=oldStream;}
});
test('silent remote playout rejection fails before provider creation and releases its binding',async()=>{
  const oldDocument=globalThis.document;let calls=0;
  const element={play:async()=>{throw new Error('private browser detail');},pause(){this.paused=true;}};
  globalThis.document={createElement:()=>element};
  class Context{sampleRate=16000;async resume(){}async close(){}createMediaStreamDestination(){return {stream:{}};}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
  const renderer=new EmbodimentRenderer({sessionId:'canonical',AudioContextCtor:Context,onDiagnostic:()=>{},fetchImpl:async()=>{calls++;throw new Error('must not create');}});
  try{await assert.rejects(renderer.render({},{ivocSessionId:'canonical'}),e=>e.diagnostics.category==='AUDIO_BIND_FAILURE');assert.equal(calls,0);assert.equal(element.paused,true);assert.equal(element.srcObject,null);}
  finally{await renderer.stop();if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
});
test('stop during pending remote play prevents late binding and never stops shared source tracks',async()=>{
  const oldDocument=globalThis.document,playing=deferred();let trackStops=0;
  const element={play:()=>playing.promise,pause(){this.paused=true;}};
  globalThis.document={createElement:()=>element};
  const renderer=new EmbodimentRenderer({AudioContextCtor:class{}});
  try{const pending=renderer.bindSilentRemotePlayout({getTracks:()=>[{stop:()=>trackStops++}]} );await renderer.stop();playing.resolve();await assert.rejects(pending,e=>e.diagnostics.category==='CLIENT_ABORT');assert.equal(element.srcObject,null);assert.equal(element.paused,true);assert.equal(trackStops,0);}
  finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
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
test('70s of PCM survives observed HTTP delay and jitter without loss, retry or backlog growth',async()=>{
  for(const latency of [()=>270,i=>i%7===0?500:300]){
    let clock=0,completion=null,maxPending=0;const expected=[],received=[],promises=[],faults=[],sequences=[];
    const queue=new EmbodimentCommandQueue(item=>{
      const audio=Buffer.from(item.audio,'base64');assert.ok(audio.length<=23040);
      received.push(audio);sequences.push(item.sequence);
      const wait=deferred();completion={at:clock+latency(received.length),resolve:wait.resolve};return wait.promise;
    },{onFailure:e=>faults.push(e)});
    let next=0;
    while(next<70000||completion){
      const producer=next<70000?next:Infinity;
      clock=Math.min(producer,completion?.at??Infinity);
      if(completion?.at===clock){const done=completion;completion=null;done.resolve({accepted:true});await new Promise(r=>setImmediate(r));}
      if(producer===clock){
        const pcm=Buffer.alloc(7680);for(let i=0;i<pcm.length;i++)pcm[i]=(next/240+i)%251;
        expected.push(pcm);promises.push(queue.push('audio',{audio:pcm.toString('base64')}));next+=240;
      }
      maxPending=Math.max(maxPending,queue.pending.length);
    }
    await Promise.all(promises);assert.deepEqual(faults,[]);assert.equal(queue.closed,false);
    assert.deepEqual(Buffer.concat(received),Buffer.concat(expected));assert.ok(maxPending<=3);
    assert.ok(received.length<expected.length,'catch-up consumes fewer HTTP requests, not fewer samples');
    assert.ok(sequences.every((n,i)=>i===0||n>sequences[i-1]));queue.close();
  }
});
test('catch-up preserves audio_end barriers, maximum payload and every waiter',async()=>{
  const first=deferred(),sent=[];
  const queue=new EmbodimentCommandQueue(async item=>{sent.push(item);if(sent.length===1)await first.promise;return {accepted:true};});
  const pcm=n=>({audio:Buffer.alloc(7680,n).toString('base64')});
  const waits=[queue.push('audio',pcm(1)),queue.push('audio',pcm(2)),queue.push('audio',pcm(3)),queue.push('audio_end'),queue.push('audio',pcm(4)),queue.push('audio',pcm(5))];
  first.resolve();assert.ok((await Promise.all(waits)).every(r=>r.accepted));
  assert.deepEqual(sent.map(i=>i.command),['audio','audio','audio_end','audio']);
  assert.deepEqual(sent.map(i=>i.sequence),[1,3,4,6]);
  assert.deepEqual(Buffer.from(sent[1].audio,'base64'),Buffer.concat([Buffer.alloc(7680,2),Buffer.alloc(7680,3)]));
  assert.equal(Buffer.from(sent[3].audio,'base64').length,15360);queue.close();
});
test('catch-up is capped at nine frames and all merged promises reject on one failed request',async()=>{
  const first=deferred(),sent=[],faults=[];
  const queue=new EmbodimentCommandQueue(async item=>{sent.push(item);if(sent.length===1)return first.promise;throw new Error('transport failed');},{onFailure:e=>faults.push(e)});
  const waits=Array.from({length:6},(_,i)=>queue.push('audio',{audio:Buffer.alloc(7680,i).toString('base64')}));
  const settled=Promise.allSettled(waits);first.resolve({accepted:true});const results=await settled;
  assert.equal(sent.length,2);assert.equal(Buffer.from(sent[1].audio,'base64').length,23040);
  assert.deepEqual(results.map(r=>r.status),['fulfilled','rejected','rejected','rejected','fulfilled','fulfilled']);
  assert.ok(results.slice(4).every(r=>r.value.discarded));assert.equal(faults.length,1);assert.equal(queue.closed,true);
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
  let micStops=0;microphone.stop=()=>{micStops++;};
  renderer.onFailure(new Error('Avatar playback stopped safely. Finish and save this attempt.'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(rendererStops,1);assert.ok(order.indexOf('mute')<order.indexOf('end-provider'));assert.equal(audio.srcObject,null);
  assert.equal(session.state,'closed');assert.equal(micStops,0);assert.equal(microphone.enabled,true);
  assert.equal(order.filter(v=>v==='play').length,1,'never fall back to another native audio output');
  const room=await readFile(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  assert.match(room,/status.state==='closed'&&started\)providerFailed\(\)/);
  assert.match(room,/Finish and save what you recorded/);
  const failureHandler=room.slice(room.indexOf('function providerFailed()'),room.indexOf('function renderPlan()'));
  assert.doesNotMatch(failureHandler,/controller\.(stop|finish)|\.disabled\s*=\s*true/,'generic visible guidance preserves user-owned Finish/save');
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
  assert.match(renderer,/this\.gain\.gain\.value=0/);assert.match(renderer,/configured interview time has ended/);
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

function lifecycleHarness({resume=async()=>{},connect=async()=>{},interrupt=async body=>({flushed:true,generation:body.generation}),ackWorklet=true}={}){
  const commands=[],workletMessages=[],counts={contexts:0,sdk:0,disconnects:0,trackStops:0};
  const node=()=>({connect(){},disconnect(){}}),output={getTracks:()=>[{stop(){counts.trackStops++;}}]};
  class Context{
    sampleRate=16000;destination={};audioWorklet={addModule:async()=>{}};
    constructor(){counts.contexts++;}resume=resume;async close(){}
    createMediaStreamDestination(){return {...node(),stream:output};}createGain(){return {...node(),gain:{value:1}};}
    createMediaStreamSource(){return node();}createAnalyser(){return {...node(),getFloatTimeDomainData:a=>a.fill(0)};}
  }
  class Worklet{port={onmessage:null,postMessage:data=>{workletMessages.push(data);if(ackWorklet)queueMicrotask(()=>this.port.onmessage?.({data:{command:'flushed',generation:data.generation}}));},close(){}};connect(){}disconnect(){}}
  class Room{on(){}connect=connect;async disconnect(){counts.disconnects++;}}
  const failures=[],receipts=[],renderer=new EmbodimentRenderer({host:{dataset:{},replaceChildren(){}},sessionId:'canonical',AudioContextCtor:Context,AudioWorkletNodeCtor:Worklet,onDiagnostic:r=>receipts.push(r),
    createAudioElement:()=>({play:async()=>{},pause(){}}),
    loadSdk:async()=>{counts.sdk++;return {Room,RoomEvent:{TrackSubscribed:'track',Disconnected:'closed',TrackUnsubscribed:'untrack'}};},onFailure:e=>failures.push(e),
    fetchImpl:async(url,options)=>{const body=options.body?JSON.parse(options.body):null;commands.push({url,body});
      const result=url.endsWith('/start')?{id:'attempt',publisherIdentity:'publisher',deadlineMs:Date.now()+45000}:body?.command==='interrupt'?await interrupt(body):url.includes('/status')?{closed:false}:{accepted:true};
      return {ok:true,json:async()=>result};}});
  const pcm=(rms=0,value=0,generation=renderer.pcmGeneration)=>renderer.extractor.port.onmessage?.({data:{rms,pcm:new Int16Array(1280).fill(value).buffer,generation}});
  return {renderer,counts,commands,workletMessages,failures,receipts,pcm,start:()=>renderer.render({id:'native'},{ivocSessionId:'canonical'})};
}

test('first failure receipt survives teardown, excludes secrets and labels the actual interruption input',async()=>{
  for(const trigger of ['candidate-transcript','local-microphone-vad']){
    const h=lifecycleHarness();await h.start();h.renderer.speaking=true;
    await h.renderer.interrupt(trigger);await h.renderer.stop();
    assert.equal(h.receipts.length,1);
    assert.equal(h.receipts[0].category,'NATIVE_PLAYBACK_BOUNDARY_UNAVAILABLE');
    assert.equal(h.receipts[0].interruptionTrigger,trigger);
    assert.equal(h.receipts[0].inputBound,true);
    const first=h.renderer.diagnostics().failureReceipt;
    h.renderer.captureFailure(new Error('SECRET token and transcript'));
    assert.equal(h.renderer.diagnostics().failureReceipt,first);
    assert.equal(h.commands.filter(c=>c.url.endsWith('/start')).length,1);
  }
  const h=lifecycleHarness();
  h.renderer.ticket={viewerToken:'SECRET',livekitUrl:'wss://private?token=SECRET'};
  h.renderer.captureFailure(Object.assign(new Error('SECRET'),{diagnostics:{category:'SECRET',boundary:'https://secret/',rawBody:'SECRET'}}));
  assert.equal(h.receipts[0].category,'UNCLASSIFIED_FAILURE');
  assert.equal(h.receipts[0].boundary,'IVOC_CLIENT');
  assert.doesNotMatch(JSON.stringify(h.receipts),/SECRET|wss:|https:|rawBody/);
  assert.equal(Object.isFrozen(h.receipts[0]),true);
});
test('signal evidence distinguishes silence from speech without retaining private PCM',async()=>{
  const h=lifecycleHarness();await h.start();
  try{
    for(let i=0;i<3;i++)h.pcm();
    assert.equal(h.renderer.diagnostics().signalEvidence.inputPeakRms,0);
    h.pcm(0.04,1234);for(let i=0;i<5;i++)h.pcm();
    const signal=h.renderer.diagnostics().signalEvidence;
    assert.deepEqual(signal,{inputFrames:9,inputPeakRms:0.04,returnedPeakRms:0,audioEnds:1});
    h.renderer.captureFailure({diagnostics:{category:'QUEUE_OVERFLOW',boundary:'AUDIO_TRANSPORT'}});
    assert.deepEqual(h.receipts[0].signalEvidence,signal);
    assert.equal(JSON.stringify(h.receipts[0]).includes('1234'),false);
    h.pcm(0.2,42);assert.equal(h.receipts[0].signalEvidence.inputFrames,9,'failure keeps a snapshot');
  }finally{await h.renderer.stop();}
});

test('disconnect classes remain distinct without creating a provider session',async()=>{
  for(const [category,boundary] of [['LIVEKIT_FAILURE','LIVEKIT_CONNECTED'],['DECODED_FRAME_FAILURE','AVATAR_DECODING'],['AUDIO_BIND_FAILURE','AUDIO_BINDING'],['QUEUE_OVERFLOW','AUDIO_TRANSPORT'],['PROVIDER_CLOSED','IVOC_SERVER'],['CANARY_DEADLINE','IVOC_CLIENT']]){
    const h=lifecycleHarness();h.renderer.onDiagnostic=r=>{h.receipts.push(r);throw new Error('observer failed');};
    h.renderer.fail(Object.assign(new Error('not logged'),{diagnostics:{category,boundary}}));
    await h.renderer.stop();
    assert.equal(h.renderer.closed,true);assert.equal(h.receipts.length,1);
    assert.equal(h.receipts[0].category,category);assert.equal(h.receipts[0].boundary,boundary);
    assert.equal(h.commands.length,0);
  }
});

test('first failure receipt preserves server-safe provider diagnostics without private fields',()=>{
  for(const category of ['PROVIDER_NETWORK','PROVIDER_DNS','PROVIDER_HTTP_4XX','PROVIDER_HTTP_5XX','PROVIDER_TIMEOUT','PROVIDER_CANCELLED','PROVIDER_RESPONSE_INVALID','LIVEKIT_FAILURE','LIVEKIT_TIMEOUT','AUDIO_TRANSPORT_FAILURE','STARTUP_CANCELLED','STARTUP_FAILED']){
    const d=publicEmbodimentFailure({category,boundary:'LEMONSLICE_API',httpStatus:503,startedAtMs:1000,finishedAtMs:1250,elapsedMs:250,responseClass:'JSON',reason:'SOCKET_HOST_REJECTED',url:'SECRET'});
    const h=lifecycleHarness();h.renderer.captureFailure({diagnostics:{...d,url:'SECRET',body:'SECRET'}});
    for(const [key,value] of Object.entries(d))assert.equal(h.receipts[0][key],value,key);
    assert.doesNotMatch(JSON.stringify(h.receipts),/SECRET|body|url/);
  }
});
test('cancelled renderer never allocates or continues startup after delayed audio resume',async()=>{
  const stopped=lifecycleHarness();await stopped.renderer.stop();await assert.rejects(stopped.start(),/client_abort/);assert.equal(stopped.counts.contexts,0);
  const gate=deferred(),h=lifecycleHarness({resume:()=>gate.promise});const starting=h.start();
  await h.renderer.stop();gate.resolve();await assert.rejects(starting,/client_abort/);
  assert.equal(h.counts.sdk,0);assert.equal(h.commands.length,0);
});
test('late LiveKit join after cancellation receives another exact disconnect without a second create',async()=>{
  const gate=deferred();let joining=false;const h=lifecycleHarness({connect:()=>{joining=true;return gate.promise;}});
  const starting=h.start();while(!joining)await new Promise(resolve=>setImmediate(resolve));
  await h.renderer.stop();assert.equal(h.counts.disconnects,1);gate.resolve();await assert.rejects(starting,/cancelled/);
  assert.equal(h.counts.disconnects,2);assert.equal(h.commands.filter(c=>c.url.endsWith('/start')).length,1);
});
test('worklet flush discards partial and posted old-generation PCM without an audible output',async()=>{
  let Processor;const messages=[];
  class Base{port={postMessage:message=>messages.push(message)};}
  runInNewContext(await readFile(new URL('../../public/capabilities/embodiment-pcm-worklet.mjs',import.meta.url),'utf8'),{AudioWorkletProcessor:Base,registerProcessor:(name,ctor)=>{Processor=ctor;}});
  const p=new Processor(),output=[[new Float32Array(128).fill(1)]];
  p.process([[new Float32Array(640).fill(1)]],output);assert.ok(output[0][0].every(v=>v===0));
  p.port.onmessage({data:{command:'flush',generation:2}});assert.equal(messages.at(-1).command,'flushed');
  p.process([[new Float32Array(1280).fill(-2)]],output);
  const frame=messages.at(-1);assert.equal(frame.generation,2);assert.ok(new Int16Array(frame.pcm).every(v=>v===-32768));
  p.port.onmessage({data:{command:'flush',generation:1}});assert.equal(p.generation,2);
});
test('native quiet gap and exact downstream flush cannot fabricate a safe GPT playback boundary',async()=>{
  const gate=deferred(),h=lifecycleHarness({interrupt:()=>gate.promise});await h.start();
  try{
    for(let i=0;i<3;i++)h.pcm(0.04,1);await new Promise(resolve=>setImmediate(resolve));
    const pending=h.renderer.interrupt();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.renderer.gain.gain.value,0);assert.deepEqual(h.workletMessages,[{command:'flush',generation:2}]);
    h.pcm(0.1,777,1); // queued old port message must never cross the generation fence
    for(let i=0;i<5;i++)h.pcm();assert.equal(h.renderer.holds,true);
    gate.resolve({flushed:true,generation:2});await pending;
    assert.equal(h.renderer.closed,true);assert.equal(h.renderer.gain.gain.value,0);
    for(let i=0;i<3;i++)h.pcm(0.04,222);await new Promise(resolve=>setImmediate(resolve));
    const frames=h.commands.filter(c=>c.body?.command==='audio').map(c=>new Int16Array(Uint8Array.from(Buffer.from(c.body.audio,'base64')).buffer));
    assert.ok(frames.every(f=>!f.includes(777)&&!f.includes(222)));
    assert.equal(h.failures[0].diagnostics.category,'NATIVE_PLAYBACK_BOUNDARY_UNAVAILABLE');
    assert.match(h.failures[0].message,/Finish and save/);
    assert.equal(h.renderer.diagnostics().nativePlaybackBoundary,'UNAVAILABLE');
    assert.equal(h.commands.filter(c=>c.url.endsWith('/start')).length,1);
  }finally{await h.renderer.stop();}
});
test('discarded or wrong-generation provider receipt never unmutes the shared playback and recording tap',async()=>{
  for(const receipt of [{discarded:true},{flushed:true,generation:1}]){
    const h=lifecycleHarness({interrupt:async()=>receipt});await h.start();h.renderer.speaking=true;
    await h.renderer.interrupt();assert.equal(h.renderer.closed,true);assert.equal(h.renderer.gain.gain.value,0);assert.equal(h.failures[0].diagnostics.category,'FLUSH_UNCONFIRMED');await h.renderer.stop();
  }
});
test('new speech before flush confirmation fails explicitly instead of silently discarding a new turn',async()=>{
  const gate=deferred(),h=lifecycleHarness({interrupt:()=>gate.promise});await h.start();h.renderer.speaking=true;
  const pending=h.renderer.interrupt();await new Promise(resolve=>setImmediate(resolve));
  for(let i=0;i<5;i++)h.pcm();h.pcm(0.04,222);
  assert.equal(h.renderer.closed,true);assert.equal(h.failures[0].diagnostics.category,'NATIVE_TURN_BOUNDARY_UNCONFIRMED');assert.equal(h.renderer.gain.gain.value,0);
  gate.resolve({flushed:true,generation:2});await pending;await h.renderer.stop();
});
test('missing worklet flush acknowledgement stays muted and fails within the bounded hold',async()=>{
  const h=lifecycleHarness({ackWorklet:false});await h.start();h.renderer.speaking=true;await h.renderer.interrupt();
  for(let i=0;i<5;i++)h.pcm();assert.equal(h.renderer.holds,true);assert.equal(h.renderer.gain.gain.value,0);
  await new Promise(resolve=>setTimeout(resolve,1550));assert.equal(h.renderer.closed,true);assert.equal(h.failures[0].diagnostics.category,'NATIVE_TURN_BOUNDARY_UNCONFIRMED');await h.renderer.stop();
});
test('short or immediate native speech during the muted flush window is an explicit failure, never a swallowed turn',async()=>{
  for(const quietFrames of [0,3]){
    const h=lifecycleHarness({ackWorklet:false});await h.start();h.renderer.speaking=true;await h.renderer.interrupt();
    for(let i=0;i<quietFrames;i++)h.pcm();h.pcm(0.04,222);
    assert.equal(h.renderer.closed,true);assert.equal(h.failures[0].diagnostics.category,'NATIVE_TURN_BOUNDARY_UNCONFIRMED');assert.equal(h.renderer.gain.gain.value,0);
    await h.renderer.stop();
  }
});
test('a caller cannot opt into unproven native response or cancellation guarantees',async()=>{
  const h=lifecycleHarness();
  await assert.rejects(h.renderer.render({}, {ivocSessionId:'canonical',nativePlaybackContract:{authority:'openai-gpt-live-native',transport:'webrtc',responseIdentity:true,cancellationAcknowledgment:true}}),/native_playback_contract_invalid/);
  assert.equal(h.counts.contexts,0);assert.equal(h.commands.length,0);
});
