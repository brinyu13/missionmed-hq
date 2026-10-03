import test from 'node:test';
import assert from 'node:assert/strict';
import {loadQuestions,queryQuestions} from '../../public/studio-fable/app/questions.mjs';
import * as corpus from '../../public/questions/question-store.mjs';
import {projectOwnRetry} from '../../public/studio-fable/app/adapters/retry.mjs';
import {toWizard,defaultSettings} from '../../public/studio-fable/app/settings/interviewer.mjs';
import {DurableStudioSession} from '../../public/studio/durable-session.mjs';
import {NativeInterviewObserver} from '../../public/studio-fable/app/brain/native-observer.mjs';
import {masteryState} from '../../public/studio-fable/app/model/teaching.mjs';
const id='f13869aa-2b3e-4b65-9f66-1288fb459444';
test('Custom selector includes the current governed admin_custom source',()=>{
  const q={question_id:'CUSTOM-1',canonical_text:'Current custom question',source:'admin_custom',tags:[]};
  assert.deepEqual(queryQuestions({questions:[q],filter:'custom'}),[q]);
});
test('current corpus keeps 193 IDs and applies fresh governance without cached/fictional fallback',async()=>{
  let calls=0;const account={mode:'REAL',api:{questions:async()=>{calls++;return{questions:calls===1?[]:[{questionId:'CORE-01',status:'hidden'}]};}}};
  const first=await loadQuestions({account,moduleLoader:async()=>corpus}),second=await loadQuestions({account,moduleLoader:async()=>corpus});
  assert.equal(first.questions.length,193);assert.equal(second.questions.length,192);assert.ok(!second.questions.some(q=>q.question_id==='CORE-01'));
  await assert.rejects(loadQuestions({account:{...account,api:{questions:async()=>{throw new Error('governance failure');}}},moduleLoader:async()=>corpus}),/governance failure/);
  await assert.rejects(loadQuestions({account,moduleLoader:async()=>{throw new Error('engine unavailable');}}),/engine unavailable/);
});
function saved(provider='openai-gpt-live'){
  const q=corpus.createDefaultQuestionStore().core()[0];
  return{reviewScope:'own',scopeSubject:'wp:1',sessionDetail:{id,state:'saved',ownerSubject:'wp:1',sessionType:'mock',questionId:q.question_id,questionText:q.canonical_text,
    interviewerProvider:provider,retryContext:{schema:'ivoc.retry-intent.v1',sourceSessionId:id,questionId:q.question_id,questionText:q.canonical_text,
      goal:'Full IV Simulation',interviewer:'Faculty',interviewerStyle:'Dove',pressurePractice:true,environment:'Webex',contextSources:['CV','StoryForge','RISE'],program:'Original program'}}};
}
test('Retry preserves canonical mode/question, refreshes context and requires renewed StoryForge/program selection',()=>{
  const catalog=corpus.createDefaultQuestionStore().all(),s=saved(),retry=projectOwnRetry(s,catalog,'wp:1');
  assert.equal(retry.intent.launchMode,'ai');assert.deepEqual(retry.intent.wizard.contextSources,['CV']);assert.equal(retry.intent.wizard.programVerified,false);
  const wizard=toWizard({...defaultSettings(),role:'Faculty',style:'Dove',pressure:true},{retry:retry.record,contextSources:retry.intent.wizard.contextSources});
  const input=new DurableStudioSession().sessionInput({question:retry.intent.question,interviewSet:[retry.intent.question],wizard,targetQuestions:1,interviewerProvider:'openai-gpt-live'});
  assert.equal(input.sessionType,'mock');assert.equal(input.retrySourceSessionId,id);assert.equal(input.questionText,retry.intent.question.canonical_text);assert.equal(input.context.environment,'Webex');
  assert.equal(projectOwnRetry(s,catalog,'wp:2'),null);assert.equal(projectOwnRetry({...s,reviewScope:'admin'},catalog,'wp:1'),null);
  assert.equal(projectOwnRetry(s,catalog.map(q=>q.question_id===retry.intent.question.question_id?{...q,canonical_text:'changed'}:q),'wp:1'),null);
});
test('native observer does not drive an 8-second script, timeout close or automatic teardown',()=>{
  let now=0;const observer=new NativeInterviewObserver({questions:corpus.createDefaultQuestionStore().core().slice(0,2),now:()=>now});
  observer.start();now=600000;assert.equal(observer.tick(),null);assert.equal(observer.snapshot().state,'QUESTION');
  assert.equal(observer.requestEnd('wrap').kind,'CLOSING_INVITE');assert.equal(observer.requestEnd('wrap'),null);
  observer.ingestFinal({speaker:'interviewer',text:'Do you have any questions for me?'});
  observer.ingestFinal({speaker:'applicant',text:'How do you support research?'});observer.ingestFinal({speaker:'interviewer',text:'I do not have verified facts about this program.'});
  observer.ingestFinal({speaker:'applicant',text:'What about teaching?'});assert.equal(observer.snapshot().closing.candidateQuestions.length,2);
  assert.equal(observer.tick(),null);assert.equal(observer.snapshot().state,'CANDIDATE_QUESTIONS');
});
test('coverage rings never turn missing metrics into Stable/mastery/priority-cleared evidence',()=>{
  const now=Date.now(),attempts=[0,1,2].map(i=>({questionId:'CORE-01',at:now-i*1000,priorityLane:i===0?null:'pace'}));
  assert.equal(masteryState(attempts,'CORE-01',now).state,'Rehearsed');assert.equal(masteryState(attempts,'CORE-01',now+22*86400000).state,'Not recent');
});
