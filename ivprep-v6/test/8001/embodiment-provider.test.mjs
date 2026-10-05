import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {createEmbodimentCanary,embodimentCanaryConfig,EMBODIMENT_CREATE_TIMEOUT_MS} from '../../server/providers/lemonslice-embodiment.mjs';
const ID='00000000-0000-4000-8000-000000000001';
const env={IVOC_LEMONSLICE_CANARY_ENABLED:'true',IVOC_LEMONSLICE_CANARY_SESSION_ID:ID,IVOC_LEMONSLICE_CANARY_BUDGET_USD:'1',
  LEMONSLICE_API_KEY:'test-only',LIVEKIT_API_KEY:'test-only',LIVEKIT_API_SECRET:'test-only',LIVEKIT_URL:'wss://test.livekit.cloud'};
function harness(overrides={}){
  const calls=[],commands=[],grants=[],timers=[],receipts=[];let time=1000;let claimed=false;
  const roomService={createRoom:async options=>calls.push({room:options}),deleteRoom:async room=>calls.push({deleted:room})};
  class AccessToken{constructor(key,secret,options){this.options=options;}addGrant(grant){grants.push({options:this.options,grant});}async toJwt(){return 'scoped-test-token';}}
  class Socket extends EventEmitter{readyState=1;bufferedAmount=0;constructor(){super();queueMicrotask(()=>this.emit('open'));}send(data){const event=JSON.parse(data);commands.push(event);if(event.command==='interrupt')queueMicrotask(()=>this.emit('message',JSON.stringify({command:'playback_finished',interrupted:true,playback_position:0.8})));}close(){this.readyState=3;}}
  const manager=createEmbodimentCanary({env,now:()=>time,setTimer:(callback,ms)=>{const timer={callback,ms};timers.push(timer);return timer;},clearTimer:timer=>{if(timer)timer.cleared=true;},
    claim:async()=>{if(claimed)throw new Error('consumed');claimed=true;},recordReceipt:async(id,receipt)=>receipts.push(receipt),
    socketFactory:()=>new Socket(),livekitFactory:async()=>({AccessToken,roomService}),
    fetchImpl:async(url,options)=>{calls.push({url,body:options.body?JSON.parse(options.body):null});return {ok:true,json:async()=>url.endsWith('/control')?{success:true}:options.method==='GET'?{session_status:'COMPLETED'}:{session_id:'provider-1',websocket_address:'wss://live.lemonslice.com/test'}};},...overrides});
  return {manager,calls,commands,grants,timers,receipts,advance:ms=>time+=ms};
}
test('canary is default-off, fixed-budget, fixed-session and contains no credentials',()=>{
  assert.equal(embodimentCanaryConfig().available,false);
  for(const patch of [{IVOC_LEMONSLICE_CANARY_BUDGET_USD:'0.1'},{IVOC_LEMONSLICE_CANARY_BUDGET_USD:'2'},{IVOC_LEMONSLICE_CANARY_SESSION_ID:'bad'},{LIVEKIT_URL:'wss://evil.test/path'},{LEMONSLICE_API_KEY:''}])assert.equal(embodimentCanaryConfig({...env,...patch}).available,false);
  const config=embodimentCanaryConfig(env);assert.equal(config.available,true);assert.equal(config.maxSessions,1);assert.equal(config.maxSeconds,45);assert.equal(JSON.stringify(config).includes('test-only'),false);
});
test('one reserved session uses audio-driven API, subscribe-only viewer, exact cleanup and no retries',async()=>{
  const h=harness();await assert.rejects(h.manager.start({actor:'wp:42',sessionId:ID}),/not_authorized/);assert.equal(h.calls.length,0);
  const ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const request=h.calls.find(c=>c.body?.transport_type);assert.equal(request.body.transport_type,'websocket-livekit');assert.equal(request.body.idle_timeout,15);assert.equal(request.body.edit_image,false);
  assert.equal(request.body.agent_prompt,undefined);assert.equal(request.body.llm,undefined);assert.equal(request.body.tts,undefined);
  const viewer=h.grants.find(g=>g.options.identity==='ivoc-founder-viewer');assert.equal(viewer.grant.canPublish,false);assert.equal(viewer.grant.canPublishData,false);assert.equal(viewer.grant.canSubscribe,true);
  const command=body=>h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,...body});
  await command({command:'audio',generation:1,sequence:1,audio:Buffer.alloc(2560).toString('base64')});
  await command({command:'audio_end',generation:1,sequence:2});
  assert.equal(h.commands[0].sampleRate,16000);assert.equal(h.commands[0].encoding,'PCM16');
  assert.equal((await command({command:'interrupt',generation:2,sequence:3})).flushed,true);
  await assert.rejects(command({command:'audio',generation:1,sequence:4,audio:'AAA='}),/stale_frame/);
  await assert.rejects(command({command:'audio',generation:3,sequence:4,audio:'AAA='}),/stale_frame/);
  const stopped=await command({command:'terminate'});assert.equal(stopped.providerConfirmed,true);assert.equal(h.receipts.length,1);
  assert.equal((await command({command:'terminate'})).providerConfirmed,true);assert.equal(h.receipts.length,1);
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
  assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
});
test('hard deadline rejects further input without another session',async()=>{
  const h=harness();const ticket=await h.manager.start({actor:'wp:1',sessionId:ID});h.advance(45000);
  await assert.rejects(h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,command:'audio',generation:1,sequence:1,audio:'AAA='}),/stopped/);
  await h.timers.find(t=>t.ms===45000).callback();
  await h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,command:'terminate'});
  assert.equal(h.receipts[0].reason,'hard_deadline');assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
});
test('aggregate PCM cannot exceed 45 seconds even if the clock has not advanced',async()=>{
  const h=harness();const ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const audio=Buffer.alloc(9600).toString('base64');
  for(let sequence=1;sequence<=150;sequence++)await h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,command:'audio',generation:1,sequence,audio});
  await assert.rejects(h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,command:'audio',generation:1,sequence:151,audio}),/input_limit/);
  assert.equal(h.receipts[0].reason,'input_budget');assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
});
test('a new generation is fenced until interrupted playback is actually acknowledged',async()=>{
  let socket;
  class DelayedSocket extends EventEmitter{readyState=1;bufferedAmount=0;constructor(){super();queueMicrotask(()=>this.emit('open'));}send(){}close(){this.readyState=3;}}
  const h=harness({socketFactory:()=>socket=new DelayedSocket()});const ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const command=body=>h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,...body});
  await command({command:'audio',generation:1,sequence:1,audio:'AAA='});
  const flushing=command({command:'interrupt',generation:2,sequence:2});
  await assert.rejects(command({command:'audio',generation:2,sequence:3,audio:'AAA='}),/flush_pending/);
  socket.emit('message',JSON.stringify({command:'playback_finished',interrupted:true,playback_position:0.1}));
  assert.equal((await flushing).flushed,true);
  assert.equal((await command({command:'audio',generation:2,sequence:3,audio:'AAA='})).accepted,true);
  await command({command:'terminate'});
});
test('late creation after stop terminates its exact ID even when its socket URL is invalid',async()=>{
  let resolveCreate;const calls=[];
  const h=harness({fetchImpl:async(url,options)=>{calls.push(url);return {ok:true,json:async()=>options.method==='POST'&&!url.endsWith('/control')?await new Promise(resolve=>{resolveCreate=resolve;}):url.endsWith('/control')?{success:true}:{session_status:'COMPLETED'}};}});
  const starting=h.manager.start({actor:'wp:1',sessionId:ID});
  while(!resolveCreate)await new Promise(resolve=>setImmediate(resolve));
  h.timers.find(t=>t.ms===45000).callback();
  resolveCreate({session_id:'late-known',websocket_address:'wss://attacker.test/never-connect'});
  await assert.rejects(starting,/stopped/);
  assert.equal(calls.filter(url=>url.endsWith('/late-known/control')).length,1);
  assert.equal(h.receipts.at(-1).providerConfirmed,true);
});
test('untrusted websocket address fails closed and terminates the exact known provider',async()=>{
  const calls=[];const h=harness({fetchImpl:async(url,options)=>{calls.push(url);return {ok:true,json:async()=>url.endsWith('/control')?{success:true}:options.method==='GET'?{session_status:'COMPLETED'}:{session_id:'provider-known',websocket_address:'wss://attacker.test/steal'}};}});
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/transport_invalid/);
  assert.equal(calls.some(url=>url.endsWith('/provider-known/control')),true);
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
test('reservation delay cannot move the 45-second deadline or reach paid creation',async()=>{
  let h;
  h=harness({claim:async()=>h.advance(45000)});
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/stopped/);
  assert.equal(h.calls.some(c=>c.body?.transport_type),false);assert.equal(h.calls.some(c=>c.room),false);
  const status=h.manager.status({actor:'wp:1',sessionId:ID});
  assert.equal(status.closed,true);assert.equal(status.providerCreateAttempted,false);
  assert.equal(status.failure.boundary,'RESERVATION');
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
test('startup receipts distinguish pre-provider LiveKit failure from an unknown provider-create outcome',async()=>{
  const failure=()=>Object.assign(new Error('private-provider-detail'),{name:'TimeoutError'});
  const room=harness({livekitFactory:async()=>({roomService:{createRoom:async()=>{throw failure();},deleteRoom:async()=>{}}})});
  await assert.rejects(room.manager.start({actor:'wp:1',sessionId:ID}),/private-provider-detail/);
  const before=room.manager.status({actor:'wp:1',sessionId:ID});
  assert.deepEqual(before.failure,{boundary:'LIVEKIT',code:'TIMEOUT',httpStatus:null});
  assert.equal(before.providerCreateAttempted,false);assert.equal(room.calls.some(c=>c.body?.transport_type),false);
  const timeouts=[];
  const provider=harness({timeoutSignal:ms=>{timeouts.push(ms);return new AbortController().signal;},fetchImpl:async()=>{throw failure();}});
  await assert.rejects(provider.manager.start({actor:'wp:1',sessionId:ID}),/private-provider-detail/);
  const after=provider.manager.status({actor:'wp:1',sessionId:ID});
  assert.deepEqual(after.failure,{boundary:'LEMONSLICE_API',code:'TIMEOUT',httpStatus:null});
  assert.equal(after.providerCreateAttempted,true);assert.equal(after.providerSessionId,null);
  assert.equal(EMBODIMENT_CREATE_TIMEOUT_MS,15000);assert.deepEqual(timeouts,[15000]);
  assert.equal(JSON.stringify(after).includes('private-provider-detail'),false);
  await assert.rejects(provider.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
test('late LiveKit room creation after cancellation is deleted without reaching paid creation',async()=>{
  let resolveRoom,exists=false;const deletions=[];
  const h=harness({livekitFactory:async()=>({roomService:{
    createRoom:async()=>{await new Promise(resolve=>{resolveRoom=resolve;});exists=true;},
    deleteRoom:async room=>{deletions.push(room);exists=false;},
  }})});
  const starting=h.manager.start({actor:'wp:1',sessionId:ID});
  while(!resolveRoom)await new Promise(resolve=>setImmediate(resolve));
  await h.manager.command({actor:'wp:1',sessionId:ID,command:'terminate'});
  resolveRoom();await assert.rejects(starting,/stopped/);
  assert.equal(exists,false);assert.equal(deletions.length,2);
  assert.equal(h.calls.some(c=>c.body?.transport_type),false);
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
