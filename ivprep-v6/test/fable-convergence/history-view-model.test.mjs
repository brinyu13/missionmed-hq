import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterOwnAttempts,ownHistoryProgress,formatHistoryEvidence} from '../../public/studio-fable/app/adapters/history-view-model.mjs';
import {closingLedger} from '../../public/studio-fable/app/model/teaching.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';
const make=(id,subject='wp:1',extra={})=>({id,ownerSubject:subject,state:'saved',questionId:'CORE-01',questionText:'Tell me about yourself.',recording:{durationMs:20000},...extra});
const library=(rows)=>({source:'account',sessions:rows,attempts:rows.filter(r=>r.state==='saved').map(r=>({id:r.id,ownerSubject:r.ownerSubject,at:1,mode:'mock',...r.fable}))});
test('own history keeps exact fresh membership and never substitutes another owner',()=>{
  const lib=library([make('a'),make('b','wp:2')]);lib.attempts.push({id:'unlisted',ownerSubject:'wp:1'});
  assert.deepEqual(filterOwnAttempts(lib,'wp:1').map(a=>a.id),['a']);
  assert.deepEqual(filterOwnAttempts(lib,'wp:2').map(a=>a.id),['b']);
  assert.deepEqual(filterOwnAttempts(lib,null),[]);
  assert.equal(ownHistoryProgress({...lib,source:'fixture'},'wp:1').model.totals.savedSessions,0);
  assert.equal(filterOwnAttempts(library([make('a'),make('a','wp:2')]),'wp:1').length,0);
});
test('question/mode/evidence filters use the canonical Answer History receipt, never trace guesses',()=>{
  const lib=library([make('a','wp:1',{answerHistory:{transcriptAvailable:true,supportedObservationCount:2}}),make('b','wp:1')]);
  assert.deepEqual(filterOwnAttempts(lib,'wp:1',{query:'CORE-01',evidence:'semantic'}).map(a=>a.id),['a']);
  assert.deepEqual(filterOwnAttempts(lib,'wp:1',{evidence:'pending'}).map(a=>a.id),['b']);
  assert.equal(filterOwnAttempts(lib,'wp:1',{query:'other question'}).length,0);
  assert.equal(filterOwnAttempts(lib,'wp:1',{mode:'practice'}).length,0);
});
test('progress reuses student-safe longitudinal observations and separates missing close evidence',()=>{
  const a=make('a','wp:1',{fable:{closing:{status:'delivered'}},results:{payload:{analytics:{studentEvents:[
    {maturity:'VALIDATED_STUDENT_SAFE',metric:'captured_level_dbfs',observation:{value:-18}},
    {maturity:'UNVALIDATED',metric:'answer_duration_ms',observation:{value:25000}}]}}}});
  const progress=ownHistoryProgress(library([a,make('b'),make('c','wp:2'),make('d','wp:1',{state:'active'}),make('e','wp:1',{state:'abandoned'})]),'wp:1');
  assert.equal(progress.model.totals.recordedMs,40000);assert.equal(progress.model.totals.uniqueQuestions,1);
  assert.equal(progress.model.attempts[0].metrics.capturedLevelDbfs,-18);
  assert.equal(progress.model.attempts[0].metrics.answerDurationMs,null);
  assert.deepEqual(progress.closing,{reached:1,observed:1,unverified:1});
  assert.deepEqual(progress.unfinished.map(r=>r.id),['d']);
  assert.equal(formatHistoryEvidence(null,'ms'),'Unavailable');assert.equal(formatHistoryEvidence(0,'fraction'),'0.0%');
  assert.equal(ownHistoryProgress(library([make('a','wp:1',{recording:{durationMs:null}})]),'wp:1').durationAvailable,false);
});
test('native observed closing survives sealing and owned cold review into Progress without claiming audibility',()=>{
  for(const closeSent of [0,1]){
    const closing=closingLedger({closing:{reached:true,delivery:'observed_fragment',candidateQuestions:[]},closeSent});
    const evidence=JSON.parse(JSON.stringify(sealDerivedEvidence({closing})));
    const row=make('native-observed');
    const detail={...row,interviewerProvider:'openai-gpt-live',results:{payload:{analytics:{fable:evidence}}}};
    const attempt=projectSavedAttempt({persisted:true,session:row,sessionDetail:detail},'wp:1');
    assert.equal(attempt.closing.status,'observed');
    assert.match(attempt.closing.label,/confirm in replay/);
    assert.equal(attempt.closing.closeDelivered,closeSent>0);
    const unknown=make('unknown','wp:1',{fable:{closing:{status:'future-status'}}});
    const foreign=make('foreign','wp:2',{fable:{closing}});
    const lib=library([row,unknown,foreign]);lib.attempts[0]=attempt;
    assert.deepEqual(ownHistoryProgress(lib,'wp:1').closing,{reached:1,observed:1,unverified:1});
  }
});
const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
const begin=source.indexOf('async function renderProgress('),end=source.indexOf('// ---------- Router',begin);
const functionSource=source.slice(begin,end);
for(const change of ['stable','other-account','same-subject-replacement','durable-replacement','stale-route'])test('actual Progress await chain rejects '+change+' scope replacement',async()=>{
  let release,current=true;
  const wait=new Promise(resolve=>release=resolve),account={subject:'wp:1'};
  const controller={account,durable:{},library:async()=>({source:'account',attempts:[],sessions:[{id:'fictional-a',ownerSubject:'wp:1',state:'saved',questionId:'CORE-01',questionText:'FICTIONAL OWNER A PRIVATE TITLE',endedAt:'2026-10-03T12:00:00Z',recording:{durationMs:20000}}]})};
  const main={innerHTML:'untouched'};
  const scope={controller,filterOwnAttempts,ownHistoryProgress,formatHistoryEvidence,loadQuestions:({account:captured})=>{assert.equal(captured,account);return wait;},main,fmtDate:String,fmtDur:String,streak:()=>0,masteryState:()=>({segments:0,state:'Unpracticed'}),esc:String,guarded:()=>true};
  const render=new Function(...Object.keys(scope),functionSource+'\nreturn renderProgress;')(...Object.values(scope));
  const pending=render(()=>current);await new Promise(resolve=>setImmediate(resolve));
  if(change==='other-account')controller.account={subject:'wp:2'};
  if(change==='same-subject-replacement')controller.account={subject:'wp:1'};
  if(change==='durable-replacement')controller.durable={};
  if(change==='stale-route')current=false;
  release({questions:[]});await pending;
  assert.equal(main.innerHTML.includes('FICTIONAL OWNER A PRIVATE TITLE'),change==='stable');
  if(change!=='stable')assert.equal(main.innerHTML,'untouched');
});
