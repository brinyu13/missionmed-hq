import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hydrateIntakeState,IntakeStateMachine,applyApprovalBatchToDocument,intakeDocumentType,buildApprovalBatch,createIntakeState} from '../web/js/uxr-002/intake.js';
const source=new URL('../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022/evidence/canary-execution/022-be026e5a64ebd9ed/roundtrip-companion/roundtrip022-6e7d95a679f2ff9c42c72800c97c8e08/012-synthetic-document.json',import.meta.url);
const bytes=readFileSync(source);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'0e72230af2ae328f68bdcc027eabc4d5212e4eef4b7bc621c95b0137f298c110');
const fixed=()=>new Date('2026-09-07T10:00:00.000Z');
test('actual RT012 Rescue with stale CV upload guess records current Rescue in document, machine and saved version while retaining genuine CV',async()=>{
  const doc=JSON.parse(bytes),beforeEvents=structuredClone(doc.events),state=hydrateIntakeState(doc.intake,{existingEvents:doc.events});
  assert.equal(state.detectedType,'CV');assert.equal(state.file.timelineRescue,true);assert.equal(state.extraction.parser.effectiveType,'TIMELINE_RESCUE');
  assert.equal(state.candidates.length,9);const cv=structuredClone(state.lastAcceptedCvImport);assert.equal(cv.documentType,'CV');
  for(const c of state.candidates)c.decision='merge';
  const machine=new IntakeStateMachine({initialState:state,existingEvents:doc.events,narrationDelay:null,clock:fixed}),versions=[];
  await machine.approveAccepted({saveVersion:async(name)=>versions.push(name),applyBatch:async batch=>applyApprovalBatchToDocument(doc,batch)});
  const result=machine.snapshot();assert.equal(result.approval.applied,true);assert.equal(doc.events.length,9);
  for(const intake of [result,doc.intake]){assert.equal(intake.lastImport.documentType,'TIMELINE_RESCUE');assert.equal(intake.lastImport.analysis.effectiveType,'TIMELINE_RESCUE');assert.deepEqual(intake.lastAcceptedCvImport,cv);}
  assert.deepEqual(versions,['Before Timeline Rescue import · Sep 7, 2026']);assert.equal(result.approval.versionName,versions[0]);
  const facts=events=>events.map(({id,title,startDate,endDate,eventType,openEnded})=>({id,title,startDate,endDate,eventType,openEnded}));
  assert.deepEqual(facts(doc.events),facts(beforeEvents));assert.equal(result.lastImport.mergedCount,9);assert.equal(result.lastImport.addedCount,0);
});
for(const [name,state,expected] of [
  ['file marker',{file:{timelineRescue:true},detectedType:'CV'},'TIMELINE_RESCUE'],
  ['current parser',{detectedType:'CV',extraction:{parser:{effectiveType:'TIMELINE_RESCUE'}}},'TIMELINE_RESCUE'],
  ['source descriptor',{detectedType:'CV',extraction:{sourceDocument:{effectiveType:'TIMELINE_RESCUE'}}},'TIMELINE_RESCUE'],
  ['completed CV source overrides stale upload guess',{detectedType:'TIMELINE_RESCUE',extraction:{parser:{effectiveType:'CV'}}},'CV'],
  ['ordinary CV',{detectedType:'CV'},'CV'],
  ['resume display alias',{detectedType:'Résumé'},'RESUME'],
  ['MyERAS display alias',{detectedType:'MyERAS export'},'MYERAS'],
  ['unknown current source does not inherit CV guess',{detectedType:'CV',extraction:{parser:{effectiveType:'UNKNOWN'}}},'UNKNOWN'],
  ['prior Rescue history is not current source',{detectedType:'CV',lastImport:{documentType:'TIMELINE_RESCUE'}},'CV'],
])test(`current import type uses ${name}`,()=>assert.equal(intakeDocumentType(state),expected));
test('ordinary CV version wording stays unchanged and other known source versions are truthful',()=>{
  const state=createIntakeState({candidates:[{id:'c',title:'Research',categoryId:'research',startDate:'2020-01',endDate:'2020-12',decision:'accepted',provenance:[{sourceExcerpt:'Research 2020'}]}]});state.stage='review';
  for(const [detectedType,label] of [['CV','CV'],['Résumé','résumé'],['MyERAS export','MyERAS']]){state.detectedType=detectedType;assert.equal(buildApprovalBatch(state,[],{clock:fixed}).version.name,`Before ${label} import · Sep 7, 2026`);}
});
