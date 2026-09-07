import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createIntakeState,buildApprovalBatch,applyApprovalBatchToDocument,renderIntake,transitionIntake,hydrateIntakeState} from '../web/js/uxr-002/intake.js';

function mergedState({additions=0,repeatTarget=false}={}){
  const existingEvents=Array.from({length:9},(_,i)=>({id:`event-${i}`,title:`Synthetic experience ${i}`,categoryId:'work',eventType:'duration',startDate:`2023-${String(i+1).padStart(2,'0')}`,endDate:`2023-${String(i+1).padStart(2,'0')}`,visibilityState:'INTERVIEWER_SAFE',provenance:[]}));
  const candidates=existingEvents.map((event,i)=>({...event,id:`candidate-${i}`,confidence:.99}));
  if(repeatTarget)candidates.push({...candidates[0],id:'same-target-extra'});
  for(let i=0;i<additions;i++)candidates.push({id:`new-${i}`,title:`New synthetic role ${i}`,categoryId:'work',eventType:'duration',startDate:'2024-01',endDate:'2024-02',confidence:.99});
  const state=createIntakeState({candidates,existingEvents});state.stage='review';
  state.candidates.forEach(candidate=>candidate.decision=candidate.duplicate?'merge':'accepted');
  return{state,existingEvents};
}

test('021 nine reuploaded duplicate merges say Update/Updated and retain nine canonical events',()=>{
  const {state,existingEvents}=mergedState();
  assert.match(renderIntake(state,{existingEvents}),/Update 9 existing events →/);
  const batch=buildApprovalBatch(state,existingEvents),document={events:structuredClone(existingEvents),studentProfile:{}};
  const result=applyApprovalBatchToDocument(document,batch);
  assert.equal(batch.addedCount,0);assert.equal(batch.mergedCount,9);assert.equal(document.events.length,9);
  const done=transitionIntake(state,{type:'APPROVAL_SUCCEEDED',...result,fileName:'duplicate.pdf'});
  assert.match(renderIntake(done),/Updated 9 events from duplicate.pdf/);
  assert.doesNotMatch(renderIntake(done),/Added 9 events/);
  const reloaded=hydrateIntakeState({...document.intake,stage:'done',approval:{applied:true}});
  assert.match(renderIntake(reloaded),/Updated 9 events/);
});

test('021 mixed additions and repeated merge targets report actual added and updated event counts',()=>{
  const {state,existingEvents}=mergedState({additions:1,repeatTarget:true});
  assert.match(renderIntake(state,{existingEvents}),/Add 1 and update 9 events →/);
  const batch=buildApprovalBatch(state,existingEvents),document={events:structuredClone(existingEvents)};
  const result=applyApprovalBatchToDocument(document,batch);
  assert.equal(batch.acceptedCount,11);assert.equal(result.addedCount,1);assert.equal(result.mergedCount,9);assert.equal(document.events.length,10);
  const done=transitionIntake(state,{type:'APPROVAL_SUCCEEDED',...result});
  assert.match(renderIntake(done),/Added 1 and updated 9 events/);
});

test('021 exact nine accepted rules-only CV facts survive identical reupload, including milestone null ends and YEAR precision',async()=>{
  const {events}=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-astra-021/rulesaudit-nine-accepted-events.json',import.meta.url),'utf8'));
  const document={events:structuredClone(events)};
  const candidates=events.map(event=>({...structuredClone(event),id:event.provenance[0].extractionCandidateId,
    sourceSnippet:event.provenance.map(item=>item.sourceExcerpt||item.sourceSnippet).filter(Boolean).join('\n'),confidence:.99}));
  const state=createIntakeState({candidates,existingEvents:events});state.stage='review';state.file={name:'synthetic-cv.pdf'};
  assert.equal(state.candidates.length,9);assert.ok(state.candidates.every(candidate=>candidate.duplicate));
  state.candidates.forEach(candidate=>candidate.decision='merge');
  applyApprovalBatchToDocument(document,buildApprovalBatch(state,document.events));
  assert.deepEqual(document.events,events,'All nine complete event records, including title, kind, source precision, notes and provenance, stay identical');
  assert.equal(document.events.filter(event=>event.eventType==='milestone'&&event.endDate===null).length,3);
  applyApprovalBatchToDocument(document,buildApprovalBatch(state,document.events));
  assert.deepEqual(document.events,events,'A second identical merge is also idempotent');
});

test('021 merging genuinely additional source evidence preserves both excerpts and expands a duration',()=>{
  const event={id:'existing',title:'Research assistant',categoryId:'research',eventType:'duration',startDate:'2022-03',endDate:'2022-08',openEnded:false,provenance:[{id:'evidence-one',sourceSha256:'a'.repeat(64),sourceExcerpt:'March through August'}],notes:''};
  const candidate={...event,id:'new-candidate',startDate:'2022-01',endDate:'2022-12',provenance:[{id:'evidence-two',sourceSha256:'b'.repeat(64),sourceExcerpt:'January through December'}],sourceSnippet:'January through December'};
  const state=createIntakeState({candidates:[candidate],existingEvents:[event]});state.stage='review';state.candidates[0].decision='merge';
  const document={events:[structuredClone(event)]};applyApprovalBatchToDocument(document,buildApprovalBatch(state,document.events));
  assert.equal(document.events[0].startDate,'2022-01');assert.equal(document.events[0].endDate,'2022-12');
  assert.equal(document.events[0].provenance.length,2);assert.equal(document.events[0].notes,'January through December');
});
