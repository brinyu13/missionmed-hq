import test from 'node:test';
import assert from 'node:assert/strict';
import {projectReplayTurns,projectSavedAttempt,validReplaySeek,privatePlaybackUrl} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {bindOwnLibrary,bindOwnRow} from '../../public/studio-fable/app/adapters/own-scope.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
const id='f13869aa-2b3e-4b65-9f66-1288fb459444';
test('own library omitted owner display binds only to admitted scope; explicit mismatch fails',()=>{
  assert.equal(bindOwnRow({id},'wp:1').ownerSubject,'wp:1');assert.equal(bindOwnRow({id,ownerSubject:'wp:2'},'wp:1'),null);
  assert.equal(bindOwnRow({id},'anonymous'),null);assert.equal(bindOwnLibrary({sessions:[{id},{id:'other',ownerSubject:'wp:2'}]},'wp:1').sessions.length,1);
});
test('older own saved attempt needs no Fable trace and rejects wrong private recording',()=>{
  const row={id,ownerSubject:'wp:1',state:'saved',recording:{id:'r1',status:'saved',durationMs:9000},results:{payload:{analytics:{events:[]}}}};
  const saved={persisted:true,session:row,sessionDetail:row};const a=projectSavedAttempt(saved,'wp:1');
  assert.equal(a.recordingId,'r1');assert.equal(a.traceUnavailable,true);assert.equal(a.durationS,9);
  assert.equal(projectSavedAttempt(saved,'wp:2'),null);
  assert.equal(projectSavedAttempt({...saved,sessionDetail:{...row,recording:{...row.recording,id:'r2'}}},'wp:1').recordingId,null);
});
test('repeated canonical wording keeps unique turn identities and distinct seek ranges',()=>{
  const detail={id,spine:{candidateAttribution:{status:'VERIFIED'},turns:[1,7].map((n,i)=>({speaker:'student',startMs:n*1000,endMs:n*1000+500,
    transcript:{canonical_ref:'transcript#seg-'+i,text:'Yes.'}}))}};
  assert.deepEqual(projectReplayTurns(detail,9000).map(t=>t.t),[1,7]);
  detail.spine.turns[1].transcript.canonical_ref='transcript#seg-0';
  assert.deepEqual(projectReplayTurns(detail,9000).map(t=>t.t),[null,null]);
});
test('repeated provisional receipts keep distinct IDs, never join by text',()=>{
  const detail={id,results:{payload:{liveConversation:{clock:'recording-observed',timingBasis:'MESSAGE_RECEIPT',sessionId:id,
    turns:[1,7].map(n=>({id:'receipt-'+n,speaker:'student',text:'Yes.',startMs:n*1000,endMs:n*1000+1}))}}}};
  assert.deepEqual(projectReplayTurns(detail,9000).map(t=>t.t),[1,7]);
  detail.results.payload.liveConversation.turns[0].startMs=null;
  assert.equal(projectReplayTurns(detail,9000)[0].t,null);
  detail.results.payload.liveConversation.sessionId='wrong';assert.ok(projectReplayTurns(detail,9000).every(t=>t.t===null));
});
test('missing and out-of-range replay times never become zero',()=>{
  for(const value of [null,undefined,'',-1,10,NaN])assert.equal(validReplaySeek(value,9),null);
  assert.equal(validReplaySeek(0,9),0);assert.equal(validReplaySeek('7',9),7);
});
test('Film Room consumes the actual HQ relative private-playback contract without broadening it',()=>{
  const page='https://hq.test/iv-prep-on-call/candidate/#/film/'+id;
  const path='/api/ivoc/v1/recordings/'+id+'/playback?token=opaque-test-ticket&expires=123';
  const signed={recordingId:id,url:path};
  assert.equal(privatePlaybackUrl(signed,id,page),'https://hq.test'+path);
  assert.equal(privatePlaybackUrl({...signed,url:'https://hq.test'+path},id,page),'https://hq.test'+path);
  for(const url of ['javascript:alert(1)','data:video/webm;base64,AA','https://other.test'+path,'/api/ivoc/v1/recordings/other/playback','https://user:pass@hq.test'+path])
    assert.equal(privatePlaybackUrl({...signed,url},id,page),null);
  assert.equal(privatePlaybackUrl({...signed,recordingId:'other'},id,page),null);
  assert.equal(privatePlaybackUrl(signed,id,'http://hq.test/'),null);
  assert.equal(privatePlaybackUrl(signed,id,'http://127.0.0.1:7002/'),'http://127.0.0.1:7002'+path);
});
test('derived trace is scalar, bounded and does not duplicate private transcript/raw meshes',()=>{
  const evidence=sealDerivedEvidence({samples:Array.from({length:7200},(_,i)=>({t:i/2,vol:.4,state:'ANSWERING',landmarks:[{x:1,y:2}]})),
    events:Array.from({length:2000},(_,i)=>({t:i,kind:'cue',label:'a'.repeat(5000)})),turns:[{text:'private full transcript'}],conductor:{hooks:[{report:'raw context'}]}});
  assert.ok(evidence.samples.length<=1200);assert.ok(evidence.events.length<=512);assert.ok(JSON.stringify(evidence).length<512*1024);
  assert.equal(evidence.samples[0].landmarks,undefined);assert.deepEqual(evidence.turns,[]);assert.equal(evidence.conductor,null);
  assert.equal(evidence.retention.decimated,true);
});
