import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionController} from '../../public/studio-fable/app/controller/session-controller.mjs';
import {state} from '../../public/studio-fable/app/state.mjs';
const id='f13869aa-2b3e-4b65-9f66-1288fb459444';
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
function harness({bootstrap,library,session,playback}={}){
  const c=new SessionController();const reads={library:0,session:0,playback:0};
  c.account={subject:'wp:1',role:'admin',api:{identity:{subject:'wp:1',admin:true},bootstrap:bootstrap||(async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}}))}};
  c.durable={ready:true,library:async scope=>{reads.library++;assert.equal(scope,'own');return library?library():{scopeSubject:'wp:1',sessions:[{id,state:'saved',recording:{id:'r1',status:'saved'}}]};},
    api:{session:async()=>{reads.session++;return session?session():{id,state:'saved',recording:{id:'r1',status:'saved'}};}},
    playback:async()=>{reads.playback++;return playback?playback():{url:'https://example.invalid/private'};}};
  return{c,reads};
}
test('revoked admission and changed role fail before own-library or detail reads',async()=>{
  for(const identity of [{subject:'wp:1',admin:false},{subject:'wp:2',admin:true}]){
    const{c,reads}=harness({bootstrap:async()=>({entitlement:{admitted:true},identity})});
    state.attempts=[{id}];await assert.rejects(c.sessionDetail(id),/access changed/);assert.equal(reads.library,0);assert.equal(reads.session,0);assert.deepEqual(state.attempts,[]);
  }
  const{c,reads}=harness({bootstrap:async()=>({entitlement:{admitted:false},identity:{subject:'wp:1',admin:true}})});
  await assert.rejects(c.library(),/access changed/);assert.equal(reads.library,0);
});
test('own membership is mandatory before an Admin-capable detail read',async()=>{
  const{c,reads}=harness({library:async()=>({scopeSubject:'wp:1',sessions:[]})});assert.equal(await c.sessionDetail(id),null);assert.equal(reads.session,0);
});
test('account replacement during detail read rejects stale data, even for the same subject',async()=>{
  const wait=deferred();const{c}=harness({session:async()=>{await wait.promise;return{id,state:'saved',recording:{id:'r1'}};}});
  const result=c.sessionDetail(id);await new Promise(resolve=>setImmediate(resolve));c.account={...c.account};wait.resolve();assert.equal(await result,null);
});
test('late private playback link is discarded after account/review change',async()=>{
  const wait=deferred();const{c,reads}=harness({playback:async()=>{await wait.promise;return{url:'https://example.invalid/private'};}});
  const result=c.playbackUrl({id,ownerSubject:'wp:1',recordingId:'r1'});await new Promise(resolve=>setImmediate(resolve));assert.equal(reads.playback,1);
  c.account={...c.account,subject:'wp:2'};wait.resolve();await assert.rejects(result,/Account or review changed/);
});
test('derived presentation metadata cannot replace canonical account/session identity',async()=>{
  const{c}=harness({library:async()=>({scopeSubject:'wp:1',sessions:[{id,state:'saved',createdAt:'bad date',recording:{id:'r1',status:'saved'},
    results:{payload:{analytics:{fable:{id:'wrong',ownerSubject:'wp:2',persisted:false,remote:{id:'wrong'}}}}}}]})});
  const result=await c.library();assert.equal(result.attempts[0].id,id);assert.equal(result.attempts[0].ownerSubject,'wp:1');assert.equal(result.attempts[0].persisted,true);
  assert.equal(result.attempts[0].remote.id,id);assert.equal(result.attempts[0].at,null);
});
test('retained microphone retry requires fresh own saved membership and exact retained session',async()=>{
  const{c}=harness();let retries=0;c.phase='SAVED';
  Object.assign(c.durable,{candidateRetry:{sessionId:id},candidateRecorder:{},retryCandidateAudio:async()=>{retries++;return{retried:true};}});
  assert.equal(c.candidateAudioRetryAvailable('another-session'),false);
  assert.equal((await c.retryCandidateAudio(id)).retried,true);assert.equal(retries,1);
  c.phase='LIVE';await assert.rejects(c.retryCandidateAudio(id),/unavailable/);assert.equal(retries,1);
  c.phase='SAVED';c.durable.library=async()=>({scopeSubject:'wp:1',sessions:[]});
  await assert.rejects(c.retryCandidateAudio(id),/current saved account/);assert.equal(retries,1);
});
test('revoked admission or account replacement cannot retry another owner microphone blob',async()=>{
  const wait=deferred(),{c}=harness({library:async()=>{await wait.promise;return{scopeSubject:'wp:1',sessions:[{id,state:'saved'}]};}});let retries=0;c.phase='SAVED';
  Object.assign(c.durable,{candidateRetry:{sessionId:id},candidateRecorder:{},retryCandidateAudio:async()=>{retries++;return{retried:true};}});
  const result=c.retryCandidateAudio(id);await new Promise(resolve=>setImmediate(resolve));c.account={...c.account,subject:'wp:2'};wait.resolve();
  assert.equal(await result,null);assert.equal(retries,0);
});
test('own-library publication rechecks admission after an intervening cookie actor change',async()=>{
  let actor='wp:1';const{c}=harness({bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:actor,admin:true}}),
    library:async()=>{actor='wp:2';return{scopeSubject:'wp:1',sessions:[{id,state:'saved'}]};}});
  state.attempts=[{id}];await assert.rejects(c.library(),/account.*changed/i);assert.deepEqual(state.attempts,[]);
});
test('own-library request receipt rejects another actor even when the cookie changes back (ABA)',async()=>{
  const{c}=harness({library:async()=>({scopeSubject:'wp:2',sessions:[{id,state:'saved',results:{payload:{}}}]})});
  state.attempts=[{id}];await assert.rejects(c.library(),/account.*changed/i);assert.deepEqual(state.attempts,[]);
});
test('owner-omitted library rows cannot be bound without an exact server own-scope receipt',async()=>{
  for(const scopeSubject of [undefined,null,'wp:0','wp:2']){
    const{c}=harness({library:async()=>({scopeSubject,sessions:[{id,state:'saved'}]})});
    await assert.rejects(c.library(),/account.*changed/i);
  }
});
test('detail and signed playback publication reject a cookie actor change during their final read',async()=>{
  for(const operation of ['detail','playback']){
    let actor='wp:1';const{c}=harness({bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:actor,admin:true}}),
      session:async()=>{if(operation==='detail')actor='wp:2';return{id,state:'saved',recording:{id:'r1'}};},
      playback:async()=>{actor='wp:2';return{url:'https://example.invalid/private'};}});
    await assert.rejects(operation==='detail'?c.sessionDetail(id):c.playbackUrl({id,ownerSubject:'wp:1',recordingId:'r1'}),/account.*changed/i);
  }
});
test('in-place API or role replacement cannot publish an old own-library response',async()=>{
  for(const replacement of ['api','role','durable-api']){
    const{c}=harness({library:async()=>{if(replacement==='api')c.account.api={};else if(replacement==='role')c.account.role='student';else c.durable.api={};
      return{scopeSubject:'wp:1',sessions:[{id,state:'saved'}]};}});
    assert.equal(await c.freshOwnLibrary(),null);
  }
});
