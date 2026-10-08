import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFounderQa} from '../../server/providers/founder-qa-policy.mjs';
import {verifyQaRelease} from '../../server/providers/release-identity.mjs';
import {recoverEmbodimentSession} from '../../server/providers/lemonslice-embodiment.mjs';
const ID='00000000-0000-4000-8000-000000000001',ID2='00000000-0000-4000-8000-000000000002';
const source='a'.repeat(40),manifestSha256='b'.repeat(64),actor='wp:1';
function harness({policy={},beforeCreate=async()=>{},...options}={}){
  let time=1000,seq=0;
  let row={id:1,revision:0,state:{enabled:true,source,manifestSha256,overageOffVerified:true,expiresAt:10000000,
    budgetSeconds:3000,maxSessions:3,reservedSeconds:0,sessionCount:0,attempts:[],active:null,...policy}};
  const timers=[],creates=[],stops=[],recoveries=[];
  const db={single:async path=>path.startsWith('ivoc_founder_qa')?structuredClone(row):{id:ID,owner_subject:actor,session_type:'mock',state:'active',recording_enabled:true,interviewer_provider:'openai-gpt-live',context:{embodimentCanary:true,embodimentDurationSeconds:900}},
    update:async(path,value)=>{if(Number(/revision=eq\.(\d+)/.exec(path)[1])!==row.revision)return null;row={id:1,...structuredClone(value)};return structuredClone(row);}};
  const factory=o=>{
    let sid,id;
    return {start:async input=>{sid=input.sessionId;id=`attempt-${++seq}`;await o.claim({actor,sessionId:sid,attemptId:id,deadlineMs:time+900000});await beforeCreate();await o.beforeProviderCreate();creates.push(sid);await o.onProviderCreated({providerSessionId:`provider-${seq}`});return {id,sessionId:sid,deadlineMs:time+900000,maxSeconds:o.configOverride.maxSeconds};},
      command:async()=>{stops.push(sid);await o.recordReceipt(sid,{cleanupConfirmed:true,providerConfirmed:true,roomConfirmed:true,providerCreateAttempted:true});return {stopped:true};},status:()=>({closed:false})};
  };
  const inputs={env:{IVOC_LEMONSLICE_FOUNDER_QA_ENABLED:'true',LEMONSLICE_API_KEY:'test',LIVEKIT_API_KEY:'test',LIVEKIT_API_SECRET:'test',LIVEKIT_URL:'wss://test.livekit.cloud'},db,now:()=>time,release:{ok:true,source,manifestSha256},
    setTimer:(f,ms)=>{const t={f,ms};timers.push(t);return t;},clearTimer:t=>{if(t)t.cleared=true;},
    claimSession:async()=>{},controllerFactory:factory,
    recoverSession:async input=>{recoveries.push(input);return {cleanupConfirmed:true,providerConfirmed:true,roomConfirmed:true};},...options};
  return {qa:createFounderQa(inputs),restart:()=>createFounderQa(inputs),db,creates,stops,timers,recoveries,
    state:()=>row.state,advance:ms=>time+=ms,edit:f=>f(row.state)};
}
test('Founder-only admission and normal duration, no permission inferred from client flag',async()=>{
  const h=harness();for(const who of ['wp:2','wp:142','student',null])await assert.rejects(h.qa.start({actor:who,sessionId:ID}),/founder/);
  assert.equal(h.creates.length,0);
  const t=await h.qa.start({actor,sessionId:ID});assert.equal(t.maxSeconds,900);assert.equal(t.founderQa,true);
  assert.equal(h.state().reservedSeconds,915);assert.equal(h.state().sessionCount,1);
});
test('cross-process CAS admits at most one active Mock; duplicate does not erase original claim',async()=>{
  const h=harness(),second=h.restart();
  const settled=await Promise.allSettled([h.qa.start({actor,sessionId:ID}),second.start({actor,sessionId:ID2})]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.creates.length,1);assert.ok(h.state().active);
});
test('deliberate second Mock allowed only after terminal and room proof; same Mock never retried',async()=>{
  const h=harness();await h.qa.start({actor,sessionId:ID});
  await assert.rejects(h.qa.start({actor,sessionId:ID2}));assert.ok(h.state().active);
  await h.qa.command({actor,sessionId:ID,command:'terminate'});assert.equal(h.state().active,null);
  await assert.rejects(h.qa.start({actor,sessionId:ID}));
  await h.qa.start({actor,sessionId:ID2});assert.equal(h.creates.length,2);assert.equal(h.state().reservedSeconds,1830);
});
test('disabled, expired, source mismatch, billing unverified and insufficient aggregate budget deny before create',async()=>{
  for(const policy of [{enabled:false},{expiresAt:999},{source:'c'.repeat(40)},{manifestSha256:'c'.repeat(64)},{overageOffVerified:false},{budgetSeconds:914},{maxSessions:0}]){
    const h=harness({policy});await assert.rejects(h.qa.start({actor,sessionId:ID}));assert.equal(h.creates.length,0);
  }
  const h=harness({release:{ok:false}});assert.equal((await h.qa.config()).available,false);await assert.rejects(h.qa.start({actor,sessionId:ID}));
});
test('kill is durable, terminates local exact session, and cannot be cleared by restart',async()=>{
  const h=harness();await h.qa.start({actor,sessionId:ID});await h.qa.kill();assert.equal(h.stops.length,1);assert.equal(h.state().enabled,false);
  await assert.rejects(h.restart().start({actor,sessionId:ID2}));assert.equal(h.creates.length,1);
});
test('15-second browser-liveness expiry terminates without any replacement create',async()=>{
  const h=harness();await h.qa.start({actor,sessionId:ID});h.advance(15001);
  await h.timers.find(t=>t.ms===3000).f();
  // Timer callback is deliberately fire-and-forget in production.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.stops.length,1);assert.equal(h.creates.length,1);
});
test('restart recovery waits for stale ownership and performs cleanup only',async()=>{
  const h=harness();await h.qa.start({actor,sessionId:ID});const restarted=h.restart();
  await restarted.recover();assert.equal(h.recoveries.length,0);
  h.advance(15001);await restarted.recover();assert.equal(h.recoveries.length,1);assert.equal(h.recoveries[0].providerSessionId,'provider-1');
  assert.equal(h.state().active,null);assert.equal(h.state().enabled,false);assert.equal(h.creates.length,1);
});
test('unknown cleanup retains reservation and disables further sessions',async()=>{
  const h=harness({recoverSession:async()=>({providerConfirmed:false,roomConfirmed:true,cleanupConfirmed:false})});
  await h.qa.start({actor,sessionId:ID});h.advance(15001);await h.restart().recover();
  assert.equal(h.state().enabled,false);assert.ok(h.state().active);await assert.rejects(h.restart().start({actor,sessionId:ID2}));
});
test('kill still attempts exact local termination when durable disable cannot be written',async()=>{
  const h=harness();await h.qa.start({actor,sessionId:ID});
  h.db.update=async()=>{throw new Error('database_unavailable');};
  await assert.rejects(h.qa.kill());assert.deepEqual(h.stops,[ID]);assert.equal(h.creates.length,1);
});
test('crash with unknown provider ID still removes exact room, never invents terminal provider proof',async()=>{
  const deleted=[],listed=[];let network=0;
  const result=await recoverEmbodimentSession({env:{},sessionId:ID,providerSessionId:null,
    fetchImpl:async()=>{network++;throw new Error('no network allowed');},
    livekitFactory:async()=>({roomService:{deleteRoom:async id=>deleted.push(id),listRooms:async ids=>{listed.push(ids);return [];}}})});
  assert.deepEqual(deleted,[`ivoc-embodiment-${ID}`]);assert.deepEqual(listed,[[`ivoc-embodiment-${ID}`]]);
  assert.equal(network,0);assert.equal(result.roomConfirmed,true);assert.equal(result.cleanupConfirmed,false);assert.equal(result.providerConfirmed,false);
});
test('missing provider configuration denies before reservation',async()=>{
  const h=harness({env:{IVOC_LEMONSLICE_FOUNDER_QA_ENABLED:'true'}});
  assert.equal((await h.qa.config()).available,false);await assert.rejects(h.qa.start({actor,sessionId:ID}));assert.equal(h.creates.length,0);
});
test('cross-process kill fences a suspended startup before the paid create boundary',async()=>{
  let resume,reached;
  const gate=new Promise(resolve=>{resume=resolve;}),arrived=new Promise(resolve=>{reached=resolve;});
  const h=harness({beforeCreate:async()=>{reached();await gate;},recoverSession:async()=>({roomConfirmed:true,providerConfirmed:false,cleanupConfirmed:false})});
  const pending=h.qa.start({actor,sessionId:ID});await arrived;
  await h.restart().kill();resume();await assert.rejects(pending,/stopped/);
  assert.equal(h.creates.length,0);assert.equal(h.state().enabled,false);assert.equal(h.state().sessionCount,1);
});
test('artifact pin verifies actual module bytes, not linked-branch or env source alone',()=>{
  const hash=x=>createHash('sha256').update(x).digest('hex'),files=Array.from({length:10},(_,i)=>({path:`file${i}.mjs`,sha256:hash('source')}));
  const raw=Buffer.from(JSON.stringify({source,files}));const env={IVOC_QA_SOURCE_SHA:source,IVOC_QA_MANIFEST_SHA256:hash(raw)};
  const read=path=>path.endsWith('release-identity.json')?raw:Buffer.from('source');
  assert.equal(verifyQaRelease({env,read}).ok,true);
  assert.equal(verifyQaRelease({env:{...env,IVOC_QA_SOURCE_SHA:'c'.repeat(40)},read}).ok,false);
  assert.equal(verifyQaRelease({env,read:path=>path.endsWith('release-identity.json')?raw:Buffer.from('stale')}).ok,false);
});
