import test from 'node:test';
import assert from 'node:assert/strict';
import {ownComparisonSelection,readOwnComparison,freshTeachingReplay} from '../../public/studio-fable/app/adapters/comparison-view-model.mjs';

// Synthetic structural fixtures only; not production speech/coaching acceptance.
function detail(id,startMs=1000,day=1){
  const binding={status:'SOURCE_BOUND',sourceRecordingId:'mic-'+id,replayRecordingId:'replay-'+id,
    assurance:'CLIENT_MIC_CAPTURE_DECLARATION',biometricIdentity:'UNVERIFIED'};
  return {id,ownerSubject:'wp:1',state:'saved',sessionType:'question',interviewerProvider:'missionmed-static',
    endedAt:`2026-10-0${day}T00:00:00Z`,questionId:'CORE-10',questionText:'Tell me about an error.',
    results:{schema:'ivoc.results.v1',schemaVersion:1,payload:{analytics:{schema:'ivoc.analytics.v1',schemaVersion:1}}},
    recording:{id:binding.replayRecordingId,sessionId:id,status:'saved',recordingRole:'conversation',durationMs:20_000},
    analysisAvailability:{status:'AVAILABLE',workflow:'SELF_PRACTICE',sessionId:id,replayRecordingId:binding.replayRecordingId},
    spine:{sourceBinding:binding,candidateAttribution:{status:'UNVERIFIED'},setupPrompt:{schema:'ivoc.self-practice-prompt.v1',
      workflow:'SELF_PRACTICE',approval:'ACTIVE_AT_SELECTION',questionId:'CORE-10',version:1,text:'Tell me about an error.'}},
    contextAnalysis:{sessionId:id,sourceBinding:binding,question:{questionId:'CORE-10',revision:1,canonicalText:'Tell me about an error.'},
      transcript:{status:'AVAILABLE',segments:[{id:'seg-1',startMs,endMs:startMs+1000,text:'I checked the dose.'}]},
      analysis:{status:'AVAILABLE',score:.75,coverage:.8,limitations:['Synthetic contract fixture; no quality acceptance.'],
        coachingPatterns:[{facet:'specificity',polarity:'weakness',text:'Name the action you took.',transcriptSegmentIds:['seg-1']}]}}};
}
function fixture(){
  const earlier=detail('earlier',1000,1),later=detail('later',7000,2),rows=[earlier,later],reads=[],signed=[];
  const controller={account:{subject:'wp:1'},durable:{},
    async library(){return {source:'account',sessions:rows};},
    async sessionDetail(id){reads.push(id);const row=rows.find(r=>r.id===id);return {persisted:true,session:row,sessionDetail:row};},
    async playbackUrl(attempt){signed.push(attempt.id);return {recordingId:attempt.recordingId,url:'/api/ivoc/v1/recordings/'+attempt.recordingId+'/playback?ticket=test'};}};
  return {controller,rows,reads,signed,earlier,later};
}
const selection={baselineId:'earlier',currentId:'later'};
test('explicit reviewed selection never falls back and only fresh unique own saved rows qualify',()=>{
  const f=fixture(),library={source:'account',sessions:f.rows};
  assert.equal(ownComparisonSelection(library,'wp:1',selection).baseline.id,'earlier');
  assert.equal(ownComparisonSelection(library,'wp:1',{...selection,currentId:'gone'}).current,null);
  assert.equal(ownComparisonSelection(library,'wp:1',{...selection,baselineId:'gone'}).baseline,null);
  assert.equal(ownComparisonSelection({...library,source:'fixture'},'wp:1',selection).current,null);
  const duplicated={source:'account',sessions:[...f.rows,{...f.later}]};
  assert.equal(ownComparisonSelection(duplicated,'wp:1',selection).current,null);
  assert.equal(ownComparisonSelection({source:'account',sessions:[f.earlier,{...f.later,ownerSubject:'wp:2'}]},'wp:1',selection).current,null);
});
test('comparison delegates exact own pair to source-bound teaching without modifying stored evidence',async()=>{
  const f=fixture(),original=structuredClone(f.rows),pair=await readOwnComparison(f.controller,selection);
  assert.equal(pair.teaching.available,true);assert.deepEqual(f.reads,['earlier','later']);
  assert.equal(pair.teaching.baseline.moments[0].startMs,1000);assert.equal(pair.teaching.current.moments[0].startMs,7000);
  assert.deepEqual(f.rows,original);assert.deepEqual(f.signed,[]);
});
test('missing pair and mismatched returned identities cannot display substituted comparisons',async()=>{
  const f=fixture();f.rows.pop();const pair=await readOwnComparison(f.controller,selection);
  assert.equal(pair.selection.current,null);assert.deepEqual(f.reads,[]);
  const g=fixture();g.controller.sessionDetail=async()=>({persisted:true,session:g.later,sessionDetail:g.later});
  const replaced=await readOwnComparison(g.controller,selection);assert.equal(replaced.a,null);assert.equal(replaced.teaching.available,false);
});
test('account, Durable, subject and route changes cancel late pair reads',async()=>{
  for(const change of ['account','durable','subject','route']){
    const f=fixture();let resolve,current=true;f.controller.library=()=>new Promise(r=>resolve=r);
    const pending=readOwnComparison(f.controller,{...selection,isCurrent:()=>current});
    if(change==='account')f.controller.account={subject:'wp:2'};
    if(change==='durable')f.controller.durable={};
    if(change==='subject')f.controller.account.subject='wp:2';
    if(change==='route')current=false;
    resolve({source:'account',sessions:f.rows});assert.equal(await pending,null,change);assert.deepEqual(f.reads,[]);
  }
});
async function replayRequest(f,sideKey='current'){
  const pair=await readOwnComparison(f.controller,selection),side=pair.teaching[sideKey];
  return {...selection,sideKey,side,moment:side.moments[0],pageUrl:'https://hq.test/iv-prep-on-call/candidate/'};
}
test('fresh cited replay returns exact private recording offset without starting playback',async()=>{
  const f=fixture(),request=await replayRequest(f),replay=await freshTeachingReplay(f.controller,request);
  assert.equal(replay.at,7);assert.equal(replay.sessionId,'later');assert.equal(replay.recordingId,'replay-later');
  assert.equal(new URL(replay.url).pathname,'/api/ivoc/v1/recordings/replay-later/playback');assert.deepEqual(f.signed,['later']);
});
test('stale citation, source identity, range and private origin fail closed before replay',async()=>{
  for(const change of ['range','ref','source','owner','origin','membership','prompt']){
    const f=fixture(),request=await replayRequest(f);
    if(change==='range')f.later.contextAnalysis.transcript.segments[0].startMs=8000;
    if(change==='ref')f.later.contextAnalysis.transcript.segments[0].id='other';
    if(change==='source')f.later.contextAnalysis.sourceBinding={...f.later.contextAnalysis.sourceBinding,sourceRecordingId:'new-source'};
    if(change==='owner')f.later.ownerSubject='wp:2';
    if(change==='origin')f.controller.playbackUrl=async()=>({recordingId:'replay-later',url:'https://other.test/api/ivoc/v1/recordings/replay-later/playback'});
    if(change==='membership')f.rows.pop();
    if(change==='prompt')f.later.spine.setupPrompt.version=2;
    assert.equal(await freshTeachingReplay(f.controller,request),null,change);
    if(change!=='origin')assert.deepEqual(f.signed,[],change);
  }
});
test('scope replacement during private URL acquisition cannot release old-account playback',async()=>{
  for(const change of ['account','durable','subject','route']){
    const f=fixture(),request=await replayRequest(f);let resolve,current=true;
    f.controller.playbackUrl=()=>new Promise(r=>resolve=r);
    const pending=freshTeachingReplay(f.controller,{...request,isCurrent:()=>current});
    while(!resolve)await new Promise(r=>setImmediate(r));
    if(change==='account')f.controller.account={subject:'wp:2'};
    if(change==='durable')f.controller.durable={};
    if(change==='subject')f.controller.account.subject='wp:2';
    if(change==='route')current=false;
    resolve({recordingId:'replay-later',url:'/api/ivoc/v1/recordings/replay-later/playback'});
    assert.equal(await pending,null,change);
  }
});
