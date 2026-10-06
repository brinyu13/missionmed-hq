import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {createEmbodimentCanary,embodimentCanaryConfig,EMBODIMENT_CREATE_TIMEOUT_MS,publicEmbodimentFailure} from '../../server/providers/lemonslice-embodiment.mjs';
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
test('malformed and non-object socket payloads cannot throw or acknowledge interrupted playback',async()=>{
  let socket;
  class ManualSocket extends EventEmitter{readyState=1;bufferedAmount=0;constructor(){super();queueMicrotask(()=>this.emit('open'));}send(){}close(){this.readyState=3;}}
  const h=harness({socketFactory:()=>socket=new ManualSocket()});const ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const command=body=>h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,...body});
  await command({command:'audio',generation:1,sequence:1,audio:'AAA='});
  let acknowledged=false;
  const flushing=command({command:'interrupt',generation:2,sequence:2}).then(result=>{acknowledged=true;return result;});
  for(const payload of ['PRIVATE_INVALID_JSON','null','true','42','"playback_finished"','[]','[{"command":"playback_finished","interrupted":true}]','{}','{"command":"unknown","interrupted":true}','{"command":"heartbeat_ack"}']){
    assert.doesNotThrow(()=>socket.emit('message',Buffer.from(payload)));
    assert.equal(h.manager.status({actor:'wp:1',sessionId:ID}).playback,null);
  }
  await new Promise(resolve=>setImmediate(resolve));assert.equal(acknowledged,false);
  await assert.rejects(command({command:'audio',generation:2,sequence:3,audio:'AAA='}),/flush_pending/);
  socket.emit('message',Buffer.from(JSON.stringify({command:'playback_finished',interrupted:true,playback_position:0.1})));
  assert.equal((await flushing).flushed,true);
  assert.deepEqual(h.manager.status({actor:'wp:1',sessionId:ID}).playback,{interrupted:true,positionSeconds:0.1,observedAtMs:1000});
  await command({command:'audio',generation:2,sequence:3,audio:'AAA='});
  socket.emit('message',JSON.stringify({command:'playback_finished',interrupted:false,playback_position:0.2}));
  assert.deepEqual(h.manager.status({actor:'wp:1',sessionId:ID}).playback,{interrupted:false,positionSeconds:0.2,observedAtMs:1000});
  assert.equal((await command({command:'terminate'})).providerConfirmed,true);
  assert.equal(h.receipts.at(-1).failure,null);assert.equal(JSON.stringify(h.receipts).includes('PRIVATE_INVALID_JSON'),false);
  assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
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
test('post-create rejection preserves real HTTP/timing and a secret-free validation reason without relaxing socket policy',async()=>{
  for(const [address,reason] of [[undefined,'SOCKET_ADDRESS_MISSING'],['PRIVATE_SOCKET','SOCKET_ADDRESS_MALFORMED'],
    ['https://live.lemonslice.com/PRIVATE_SOCKET','SOCKET_PROTOCOL_REJECTED'],
    ['wss://PRIVATE_USER:PRIVATE_SECRET@live.lemonslice.com/tunnel','SOCKET_CREDENTIALS_REJECTED'],
    ['wss://unverified-vendor.test/tunnel?PRIVATE_SOCKET','SOCKET_HOST_REJECTED']]){
    const calls=[];let h,socketCreated=false;
    h=harness({socketFactory:()=>{socketCreated=true;throw new Error('must not connect');},fetchImpl:async(url,options)=>{
      calls.push(url);
      if(url.endsWith('/control'))return {ok:true,json:async()=>({success:true})};
      if(options.method==='GET')return {ok:true,json:async()=>({session_status:'COMPLETED'})};
      h.advance(4962);
      return {ok:true,status:201,headers:{get:()=> 'application/json'},json:async()=>({session_id:'provider-known',websocket_address:address,privateField:'PRIVATE_BODY'})};
    }});
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),error=>{
      assert.equal(error.status,502);assert.equal(error.diagnostics.httpStatus,201);
      assert.equal(error.diagnostics.category,'PROVIDER_RESPONSE_INVALID');assert.equal(error.diagnostics.reason,reason);
      assert.equal(error.diagnostics.elapsedMs,4962);assert.equal(error.diagnostics.responseClass,'JSON');return true;
    });
    const status=h.manager.status({actor:'wp:1',sessionId:ID});
    assert.equal(status.providerSessionId,'provider-known');assert.equal(status.stopReceipt.providerConfirmed,true);
    assert.equal(status.failure.reason,reason);assert.equal(socketCreated,false);
    assert.equal(calls.filter(url=>url.endsWith('/sessions')).length,1);
    assert.equal(calls.filter(url=>url.endsWith('/provider-known/control')).length,1);
    assert.equal(JSON.stringify(status).includes('PRIVATE_'),false);
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
  }
});
test('public response reasons are a closed vocabulary, never raw returned addresses',()=>{
  const safe=publicEmbodimentFailure({boundary:'LEMONSLICE_API',category:'PROVIDER_RESPONSE_INVALID',reason:'wss://PRIVATE_TOKEN@host/tunnel',url:'PRIVATE_URL'});
  assert.equal(safe.reason,undefined);assert.equal(JSON.stringify(safe).includes('PRIVATE_'),false);
});
test('successful null JSON retains actual provider response metadata and fails closed without a socket or retry',async()=>{
  let h,socketCreated=false,creates=0;
  h=harness({socketFactory:()=>{socketCreated=true;throw new Error('must not connect');},fetchImpl:async()=>{
    creates++;h.advance(123);
    return {ok:true,status:201,headers:{get:()=> 'application/json'},json:async()=>null};
  }});
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),error=>{
    assert.equal(error.diagnostics.reason,'SESSION_ID_INVALID');assert.equal(error.diagnostics.httpStatus,201);
    assert.equal(error.diagnostics.responseClass,'JSON');assert.equal(error.diagnostics.elapsedMs,123);return true;
  });
  assert.equal(socketCreated,false);assert.equal(creates,1);
  const status=h.manager.status({actor:'wp:1',sessionId:ID});assert.equal(status.closed,true);
  assert.equal(status.providerSessionId,null);assert.equal(status.stopReceipt.providerConfirmed,false);
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
  await assert.rejects(room.manager.start({actor:'wp:1',sessionId:ID}),/ivoc_embodiment_start_failed/);
  const before=room.manager.status({actor:'wp:1',sessionId:ID});
  assert.equal(before.failure.boundary,'LIVEKIT');assert.equal(before.failure.category,'LIVEKIT_TIMEOUT');assert.equal(before.failure.httpStatus,null);
  assert.equal(before.providerCreateAttempted,false);assert.equal(room.calls.some(c=>c.body?.transport_type),false);
  const timeouts=[];
  const provider=harness({timeoutSignal:ms=>{timeouts.push(ms);return new AbortController().signal;},fetchImpl:async()=>{throw failure();}});
  await assert.rejects(provider.manager.start({actor:'wp:1',sessionId:ID}),/ivoc_embodiment_provider_unavailable/);
  const after=provider.manager.status({actor:'wp:1',sessionId:ID});
  assert.equal(after.failure.boundary,'LEMONSLICE_API');assert.equal(after.failure.category,'PROVIDER_TIMEOUT');assert.equal(after.failure.httpStatus,null);
  assert.equal(after.providerCreateAttempted,true);assert.equal(after.providerSessionId,null);
  assert.equal(EMBODIMENT_CREATE_TIMEOUT_MS,15000);assert.deepEqual(timeouts,[15000]);
  assert.equal(JSON.stringify(after).includes('private-provider-detail'),false);
  await assert.rejects(provider.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
test('provider HTTP category/status and timing survive without reading a private response body',async()=>{
  for(const status of [400,401,402,403,429,500,503]){
    let h,bodyRead=false;
    h=harness({fetchImpl:async()=>{h.advance(321);return {ok:false,status,headers:{get:()=> 'application/json'},json:async()=>{bodyRead=true;return {secret:'MUST_NOT_ESCAPE'};}};}});
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),error=>{
      assert.equal(error.status,502);assert.equal(error.diagnostics.httpStatus,status);assert.equal(error.diagnostics.category,status>=500?'PROVIDER_HTTP_5XX':'PROVIDER_HTTP_4XX');return true;
    });
    const failure=h.manager.status({actor:'wp:1',sessionId:ID}).failure;
    assert.equal(failure.elapsedMs,321);assert.equal(failure.responseClass,'JSON');assert.equal(bodyRead,false);
    assert.equal(JSON.stringify(h.receipts).includes('MUST_NOT_ESCAPE'),false);
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
  }
});
test('provider timeout, explicit cancellation, DNS and network faults remain distinct and secret-free',async()=>{
  for(const [name,code,category] of [['TimeoutError',null,'PROVIDER_TIMEOUT'],['AbortError',null,'PROVIDER_CANCELLED'],['TypeError','ENOTFOUND','PROVIDER_DNS'],['TypeError','ECONNRESET','PROVIDER_NETWORK']]){
    const h=harness({fetchImpl:async()=>{throw Object.assign(new Error('PRIVATE_TOKEN_AND_URL'),{name,cause:{code}});}});
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),e=>e.diagnostics.category===category);
    const evidence=h.manager.status({actor:'wp:1',sessionId:ID});assert.equal(evidence.providerCreateAttempted,true);assert.equal(evidence.providerSessionId,null);
    assert.equal(JSON.stringify(evidence).includes('PRIVATE_TOKEN_AND_URL'),false);
  }
});
test('server transport readiness never claims decoded avatar readiness, and teardown retains stage evidence',async()=>{
  const h=harness(),ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const status=h.manager.status({actor:'wp:1',sessionId:ID});assert.equal(status.boundary,'TRANSPORT_READY');
  assert.ok(status.transitions.some(r=>r.state==='EMBODIMENT_SESSION_CREATED'));
  assert.ok(status.transitions.every(r=>r.owner&&Number.isFinite(r.startedAtMs)&&r.cleanup==='EXACT_SESSION_AND_ROOM'));
  assert.equal(status.transitions.some(r=>r.state==='EMBODIMENT_READY'),false);
  await h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,command:'terminate'});
  assert.deepEqual(h.receipts[0].transitions,status.transitions);
});
test('timeouts and cancellation while consuming provider JSON retain the original boundary',async()=>{
  for(const [name,category] of [['TimeoutError','PROVIDER_TIMEOUT'],['AbortError','PROVIDER_CANCELLED']]){
    const h=harness({fetchImpl:async()=>({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>{throw Object.assign(new Error('PRIVATE_BODY'),{name});}})});
    await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),e=>e.diagnostics.category===category&&e.diagnostics.httpStatus===200);
    assert.equal(h.receipts.at(-1).failure.category,category);assert.equal(JSON.stringify(h.receipts).includes('PRIVATE_BODY'),false);
  }
});
test('socket failure retains transport diagnostics in durable cleanup rather than becoming cancellation',async()=>{
  const receipts=[];
  class Broken extends EventEmitter{readyState=0;constructor(){super();queueMicrotask(()=>this.emit('error',new Error('PRIVATE_SOCKET')));}close(){this.readyState=3;}}
  const h=harness({socketFactory:()=>new Broken(),recordReceipt:async(_,receipt)=>receipts.push(JSON.parse(JSON.stringify(receipt)))});
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),e=>e.diagnostics.category==='AUDIO_TRANSPORT_FAILURE');
  assert.equal(receipts.at(-1).failure.category,'AUDIO_TRANSPORT_FAILURE');assert.equal(receipts.at(-1).failure.boundary,'AUDIO_TRANSPORT');
  assert.equal(JSON.stringify(receipts).includes('PRIVATE_SOCKET'),false);assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
  await assert.rejects(h.manager.start({actor:'wp:1',sessionId:ID}),/consumed/);
});
test('unconfirmed interrupt fails closed; no new generation resumes and no second provider create occurs',async()=>{
  class NoAck extends EventEmitter{readyState=1;bufferedAmount=0;constructor(){super();queueMicrotask(()=>this.emit('open'));}send(){}close(){this.readyState=3;}}
  const h=harness({socketFactory:()=>new NoAck()}),ticket=await h.manager.start({actor:'wp:1',sessionId:ID});
  const command=body=>h.manager.command({actor:'wp:1',sessionId:ID,id:ticket.id,...body});
  await command({command:'audio',generation:1,sequence:1,audio:'AAA='});
  const interrupt=command({command:'interrupt',generation:2,sequence:2});
  h.timers.find(t=>t.ms===1500).callback();await assert.rejects(interrupt,/flush_unconfirmed/);
  await assert.rejects(command({command:'audio',generation:2,sequence:3,audio:'AAA='}),/stopped/);
  assert.equal(h.calls.filter(c=>c.body?.transport_type).length,1);
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
