import test from 'node:test';
import assert from 'node:assert/strict';
import {traceSample} from '../../public/studio-fable/app/model/trace-reducer.mjs';
import {deriveDebrief} from '../../public/studio-fable/app/model/teaching.mjs';
import {projectDerivedPriority,projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';
import {SessionController} from '../../public/studio-fable/app/controller/session-controller.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';

const frame=(t,extra={})=>({t,speaking:true,state:'ANSWERING',
  speedWpm:{available:true,wordsPerMinute:140,score:5},...extra});
const speech=(count=9)=>Array.from({length:count},(_,i)=>traceSample(frame(i/2)));
const legacyHeld=()=>[
  ...Array.from({length:6},(_,i)=>traceSample(frame(i/2,{speedWpm:{available:true,wordsPerMinute:140,score:i<2?7.5:5}}))),
  traceSample(frame(3,{speaking:false,state:'LISTENING',speedWpm:{available:false,score:null}})),
  ...Array.from({length:53},(_,i)=>({...traceSample(frame(6+i/2,{speaking:false,state:'LISTENING'})),scores:{pace:5,volume:5,variety:5}})),
];
const evidence=samples=>({schema:'ivoc.fable51.evidence.v1',fixture:false,clock:'recording-observed',samples,events:[],
  debrief:{lane:'pace',text:'Pace left your range for 26 s at 00:06 (too slow).'}});

test('actual trace reducer withholds teaching scores when speech or a producer is unavailable',()=>{
  for(const extra of [{speaking:false},{speedWpm:{available:false,score:5}},
    {speedWpm:{available:true,wordsPerMinute:null,score:5}}]) assert.equal(traceSample(frame(0,extra)).scores.pace,null);
  const quiet=traceSample(frame(0,{speaking:false,volume:{available:true,normalized:.3,score:5},volumeModulation:{available:true,score:5}}));
  assert.deepEqual(quiet.scores,{pace:null,volume:null,variety:null});
});
test('legacy held listening scores cannot reproduce the false 26-second applicant correction',()=>{
  const d=deriveDebrief({samples:legacyHeld(),events:[],turns:[],calibrationUsed:false});
  assert.deepEqual(d.change,[]);assert.deepEqual(d.worked,[]);
  assert.ok(!d.facts.some(f=>f.lane==='hands'));
});
test('available continuous answering speech retains a seekable correction without a personal-range claim',()=>{
  const d=deriveDebrief({samples:speech(),events:[],turns:[],calibrationUsed:false});
  assert.equal(d.change[0].lane,'pace');assert.equal(d.change[0].at,0);
  assert.match(d.change[0].text,/displayed range for 4 s/);assert.doesNotMatch(d.change[0].text,/your range/);
});
test('quiet answering, listening, unavailable normalized evidence and signal gaps break correction runs',()=>{
  for(const boundary of [
    {speaking:false}, {state:'LISTENING'}, {pace:null}, {signalGap:true},
  ]){
    const samples=speech(13);samples[6]={...samples[6],...boundary};
    const d=deriveDebrief({samples,events:[],turns:[]});assert.deepEqual(d.change,[]);
  }
});
test('missing and reversed sample time cannot manufacture continuous correction duration',()=>{
  const samples=[...speech(6),...speech(6).map(s=>({...s,t:s.t+20}))];
  assert.deepEqual(deriveDebrief({samples,events:[]}).change,[]);
  const reversed=[...speech(6),...speech(6)];
  assert.deepEqual(deriveDebrief({samples:reversed,events:[]}).change,[]);
  assert.deepEqual(deriveDebrief({samples:speech(9).map(s=>({...s,t:s.t*2})),events:[]}).change,[]);
});
test('actual save decimation cannot turn omitted listening intervals into a continuous speech duration',()=>{
  const samples=Array.from({length:1201},(_,i)=>traceSample(frame(i/2,{
    state:i%2?'LISTENING':'ANSWERING',speaking:i%2===0,
    volume:{available:true,normalized:.3,score:5},volumeModulation:{available:true,score:5},
  })));
  assert.deepEqual(deriveDebrief({samples,events:[]}).change,[]);
  const sealed=sealDerivedEvidence({samples,events:[]});
  assert.equal(sealed.retention.decimated,true);assert.equal(sealed.samples.length,601);
  assert.ok(sealed.samples.every(s=>s.state==='ANSWERING'&&s.speaking));
  const priority=projectDerivedPriority(sealed,600);
  assert.match(priority.text,/100% of retained speech samples/);assert.doesNotMatch(priority.text,/for \d+ s/);
  const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const row={id,ownerSubject:'wp:1',state:'saved',recording:{id:'r1',status:'saved',durationMs:600000},
    results:{payload:{analytics:{fable:sealed}}}};
  const saved=projectSavedAttempt({persisted:true,session:row,sessionDetail:row},'wp:1');
  const debrief=deriveDebrief(saved);
  assert.equal(saved.priorityText,priority.text);
  for(const lane of ['pace','volume','variety']) {
    const correction=debrief.allChange.find(c=>c.lane===lane);
    assert.match(correction.text,/retained speech samples/);assert.doesNotMatch(correction.text,/for \d+ s/);
  }
});
test('volume and variety eligibility is independent and does not grade held quiet scores',()=>{
  const samples=Array.from({length:13},(_,i)=>traceSample(frame(i/2,{
    speedWpm:{available:false,score:5},volume:{available:true,normalized:.3,score:5},volumeModulation:{available:true,score:5},
  })));
  const d=deriveDebrief({samples,events:[]});assert.ok(d.allChange.some(c=>c.lane==='volume'));
  assert.ok(d.allChange.some(c=>c.lane==='variety'));assert.ok(!d.allChange.some(c=>c.lane==='pace'));
  assert.doesNotMatch(d.allChange.find(c=>c.lane==='volume').text,/your corridor/);
  const quiet=samples.map(s=>({...s,speaking:false}));assert.deepEqual(deriveDebrief({samples:quiet,events:[]}).facts,[]);
});
test('unavailable hands never become 100 percent visible and listening gestures are not answering gestures',()=>{
  const samples=speech(12).map(s=>({...s,hands:'UNAVAILABLE'}));
  assert.deepEqual(deriveDebrief({samples,events:[{kind:'gesture',state:'LISTENING',t:1}]}).worked,[]);
  const visible=samples.map(s=>({...s,hands:'BOTH'}));
  assert.ok(deriveDebrief({samples:visible,events:[]}).worked.some(w=>w.lane==='hands'));
  assert.ok(deriveDebrief({samples,events:[{kind:'gesture',state:'ANSWERING',t:1}]}).worked.some(w=>w.lane==='gestures'));
});
test('read-time derived priority rejects stale prose, unbound trace and out-of-recording samples',()=>{
  const f=evidence(legacyHeld());assert.equal(projectDerivedPriority(f,33),null);
  const valid=evidence(speech());assert.equal(projectDerivedPriority(valid,5).lane,'pace');
  for(const changed of [{fixture:true},{clock:'other'},{schema:'other'}])assert.equal(projectDerivedPriority({...valid,...changed},5),null);
  assert.equal(projectDerivedPriority(valid,null),null);
  assert.equal(projectDerivedPriority({...valid,samples:valid.samples.map(s=>({...s,t:s.t+100}))},5),null);
  assert.equal(f.debrief.text,'Pace left your range for 26 s at 00:06 (too slow).');
});
test('actual fresh library and saved-review projections agree without changing private canonical history',async()=>{
  const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',f=evidence(legacyHeld());
  const row={id,ownerSubject:'wp:1',state:'saved',questionId:'CORE-01',questionText:'Tell me about yourself.',
    endedAt:'2026-10-04T05:00:00Z',interviewerProvider:'openai-gpt-live',recording:{id:'r1',status:'saved',durationMs:33000},
    results:{payload:{analytics:{fable:f}}}};
  const c=new SessionController();c.account={subject:'wp:1',role:'admin',api:{bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}})}};
  c.durable={ready:true,library:async scope=>{assert.equal(scope,'own');return {sessions:[row]};}};
  const library=await c.library();assert.equal(library.attempts[0].priorityText,null);assert.equal(library.attempts[0].debriefLane,null);
  const detail=projectSavedAttempt({persisted:true,session:row,sessionDetail:row},'wp:1');assert.equal(detail.priorityText,null);
  assert.equal(projectSavedAttempt({persisted:true,session:row,sessionDetail:row},'wp:2'),null);
  assert.equal(row.results.payload.analytics.fable.debrief.text,f.debrief.text);
  row.results.payload.analytics.fable=evidence(speech());
  const fresh=await c.library();assert.match(fresh.attempts[0].priorityText,/displayed range/);
  assert.equal(fresh.attempts[0].debriefLane,'pace');
});
