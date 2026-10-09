import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {avatarAdmissionReady,refreshAvatarAdmission,interviewPresenceCue,AVATAR_UNAVAILABLE} from '../../public/studio-fable/app/adapters/avatar-admission.mjs';
const ready={schema:'ivoc.founder-qa.v1',available:true,enabled:true,sourceIntegrity:true,maxSeconds:170};
test('Founder avatar admission is explicit and fails closed for exhausted, disabled, stale and malformed capability',()=>{
  assert.equal(avatarAdmissionReady(ready),true);
  for(const cap of [null,{}, {...ready,available:false},{...ready,enabled:false},{...ready,sourceIntegrity:false},{...ready,maxSeconds:0},{...ready,maxSeconds:'170'}])assert.equal(avatarAdmissionReady(cap),false);
});
test('deliberate Start refresh is one read-only same-origin request, never a provider create or retry',async()=>{
  let count=0;
  const result=await refreshAvatarAdmission(async function(url,options){count++;assert.equal(this,globalThis);assert.equal(url,'/api/ivoc/v1/admin/embodiment-canary');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);return {ok:true,json:async()=>ready};});
  assert.equal(count,1);assert.deepEqual(result,ready);
});
test('stale admission and every failed refresh reject instead of downgrading to voice-only',async()=>{
  for(const fn of [async()=>({ok:true,json:async()=>({...ready,available:false})}),async()=>({ok:false}),async()=>{throw new Error('private diagnostic');},async()=>({ok:true,json:async()=>{throw new Error('private body');}})]){
    let calls=0;await assert.rejects(refreshAvatarAdmission(async(...args)=>{calls++;return fn(...args);}),e=>!e.message.includes('private')&&/Avatar/.test(e.message));assert.equal(calls,1);
  }
});
test('interviewer speech has precedence over microphone energy; no premature listening cue during startup',()=>{
  assert.equal(interviewPresenceCue({connecting:true,interviewerSpeaking:true,candidateSpeaking:true,avatar:true}),'connecting interviewer');
  assert.equal(interviewPresenceCue({interviewerSpeaking:true,candidateSpeaking:true,avatar:true}),'interviewer speaking · please listen');
  assert.equal(interviewPresenceCue({candidateSpeaking:true,avatar:true}),'listening to you');
  assert.equal(interviewPresenceCue({avatar:true}),'wait for spoken question');
});
test('real Room wires the fresh gate before context/session creation and preserves non-Founder flow',()=>{
  const room=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  assert.ok(room.includes("account?.role==='admin'&&account?.subject==='wp:1'"));
  assert.ok(room.includes('Boolean(founderQa&&!avatarAdmissionReady(founderQa))'));
  assert.ok(room.includes("$('start-session').disabled=avatarBlocked()"));
  const start=room.slice(room.indexOf('  async function start(){'));
  assert.ok(start.indexOf('await refreshAvatarAdmission()')<start.indexOf('await liveContext('));
  assert.ok(start.indexOf('await refreshAvatarAdmission()')<start.indexOf('await controller.startSession('));
  assert.ok(start.includes('if(founderQa){'));
  assert.ok(start.includes('Math.min(avatarDurationSeconds,fresh.maxSeconds)'));
  assert.equal(room.includes('This interview uses the voice interviewer.'),false);
  assert.ok(room.includes('if(!founderQa||started)'));
  assert.ok(AVATAR_UNAVAILABLE.includes('No avatar interview will start'));
  assert.ok(room.includes('interviewPresenceCue({interviewerSpeaking,candidateSpeaking:f.speaking'));
});
