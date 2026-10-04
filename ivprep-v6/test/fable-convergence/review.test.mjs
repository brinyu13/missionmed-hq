import test from 'node:test';
import assert from 'node:assert/strict';
import {projectReplayTurns,projectSavedAttempt,validReplaySeek,privatePlaybackUrl,retainedEvidenceReport} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {bindOwnLibrary,bindOwnRow} from '../../public/studio-fable/app/adapters/own-scope.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {traceSample} from '../../public/studio-fable/app/model/trace-reducer.mjs';
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
test('retained report preserves earlier tracking when the final sample is unavailable',()=>{
  const a={persisted:true,fixture:false,traceUnavailable:false,durationS:10,
    samples:[{t:1,presence:'TRACKED',facing:35,hands:'NONE'},
      {t:2,presence:'TRACKED',facing:80,hands:'BOTH',speaking:true,state:'ANSWERING',wpm:160,loudness:-22,loudnessUnit:'dBFS',f0Hz:185},
      {t:3,presence:'UNAVAILABLE',facing:null,hands:'UNAVAILABLE'}],
    events:[{t:1,kind:'smile'},{t:2,kind:'nod'},{t:2,kind:'gesture'},{t:3,kind:'framing'}]};
  const report=retainedEvidenceReport(a),rows=report.groups.flatMap(g=>g.rows);
  assert.equal(rows.find(r=>r.label==='Face/head tracking').value,'2 tracked samples retained');
  assert.equal(rows.find(r=>r.label==='Head orientation proxy').value,'35–80 % camera-facing proxy · 2 retained samples');
  assert.equal(rows.find(r=>r.label==='Hand visibility').value,'1 with hands visible / 2 retained detection samples');
  assert.equal(rows.find(r=>r.label==='Voiced pitch').value,'185–185 Hz · 1 retained sample');
  assert.equal(rows.find(r=>r.label==='Framing observations').value,'1 event retained');
  assert.ok(report.available);assert.match(report.note,/not percentages of interview time/);
  const decimated=retainedEvidenceReport({...a,traceDecimated:true,samples:a.samples.map((s,i)=>({...s,t:i*4}))});
  assert.equal(decimated.groups[0].rows[0].value,'2 tracked samples retained');
  assert.doesNotMatch(JSON.stringify(decimated),/seconds|continuous|% of/);
});
test('retained report withholds fixtures, invalid times, unavailable tracking and non-candidate voice',()=>{
  const a={persisted:true,fixture:false,traceUnavailable:false,durationS:10,
    samples:[{t:1,presence:'SEARCHING',facing:0,hands:'UNAVAILABLE'},
      {t:2,presence:'TRACKED',facing:null,hands:'NONE'},
      {t:3,speaking:true,state:'LISTENING',wpm:170,f0Hz:180,loudness:-10,loudnessUnit:'dBFS'},
      {t:4,speaking:true,state:'ANSWERING',signalGap:true,wpm:170,f0Hz:180,loudness:-10,loudnessUnit:'dBFS'},
      {t:5,fixture:true,presence:'TRACKED',facing:90},
      {t:11,presence:'TRACKED',facing:90},{t:null,presence:'TRACKED',facing:90}],
    events:[{t:11,kind:'smile'},{t:1,kind:'smile',fixture:true}]};
  const rows=retainedEvidenceReport(a).groups.flatMap(g=>g.rows);
  assert.equal(rows.find(r=>r.label==='Face/head tracking').value,'1 tracked sample retained');
  for(const label of ['Head orientation proxy','Pace','Loudness (LUFS-K)','Volume (dBFS)','Voiced pitch'])assert.match(rows.find(r=>r.label===label).value,/Unavailable/);
  assert.equal(rows.find(r=>r.label==='Smile patterns').value,'No qualifying event retained');
  for(const change of [{persisted:false},{fixture:true},{traceUnavailable:true},{durationS:null}])assert.equal(retainedEvidenceReport({...a,...change}).available,false);
  assert.equal(retainedEvidenceReport(null).available,false);
});
test('producer loudness survives trace, sealing and owned review without mixing LUFS-K and dBFS',()=>{
  const samples=[[-24,'LUFS-K'],[-20,'LUFS-K'],[-14,'dBFS']].map(([value,unit],i)=>traceSample({
    t:i+1,speaking:true,state:'ANSWERING',volume:{available:true,normalized:.5,scientificValue:value,scientificUnit:unit}}));
  const evidence=sealDerivedEvidence({samples,events:[]});
  const row={id,ownerSubject:'wp:1',state:'saved',recording:{id:'r1',status:'saved',durationMs:5000},
    results:{payload:{analytics:{fable:evidence}}}};
  const admitted=projectSavedAttempt({persisted:true,session:row,sessionDetail:row},'wp:1');
  const voice=retainedEvidenceReport(admitted).groups.find(g=>g.label==='Captured candidate voice').rows;
  assert.equal(voice.find(r=>r.label==='Loudness (LUFS-K)').value,'-24.0–-20.0 LUFS-K · 2 retained samples');
  assert.equal(voice.find(r=>r.label==='Volume (dBFS)').value,'-14.0–-14.0 dBFS · 1 retained sample');
  assert.equal(retainedEvidenceReport(projectSavedAttempt({persisted:true,session:row,sessionDetail:row},'wp:2')).available,false);
});
