import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {applyDocumentTo407FState} from '../web/js/407f-engineering-adapter.js';
import {normalizeExamDocument,updateBuilderExamAttempt,setBuilderExamSystem} from '../web/js/uxr-002/exam-integration.js';

const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/golden2-cv-exams.json',import.meta.url),'utf8'));
const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');

function stateFor(document){return applyDocumentTo407FState(document,{user:{},builder:{},profile:{},wiz:{}});}

test('021 actual golden2 canonical exams reach the actual inline cards with their systems selected',()=>{
  const document=structuredClone(fixture.document),before=JSON.stringify(document);
  assert.deepEqual(document.builder.examSystems,[],'Preserve the actual physical source defect');
  const state=stateFor(document);
  assert.deepEqual(state.builder.examSystems,['USMLE']);
  assert.equal(state.builder.exams.length,2);
  const context={state,EXAM_SYSTEMS_404:{USMLE:[{id:'step-1',label:'Step 1'},{id:'step-2-ck',label:'Step 2 CK'}]},esc:String,examDefinition404:record=>({label:record.name,passFailOnly:record.passFailOnly}),examOrdinal404:String,examError404:()=>'',dateControlMarkup404:options=>`<input value="${options.value}" data-date="${options.id}">`};
  vm.createContext(context);
  vm.runInContext(html.slice(html.indexOf('function examCard404(record){'),html.indexOf('function domainDefaults404(')),context);
  const rendered=vm.runInContext('examsMarkup404()',context);
  assert.match(rendered,/data-exam-system="USMLE" checked/);
  assert.equal((rendered.match(/data-exam-card=/g)||[]).length,2);
  assert.ok(!rendered.includes('No exams added yet.'));
  assert.match(rendered,/Step 1/);assert.match(rendered,/Step 2 CK/);assert.match(rendered,/value="251"/);
  assert.equal(state.builder.exams.find(record=>record.examId==='step-2-ck').result,'','The UI must not invent Passed for a numeric score');
  assert.equal(JSON.stringify(document),before,'Bridge projection is read-only');
});

test('021 exam normalization and edits retain source authority without generating duplicate public events',()=>{
  const document=structuredClone(fixture.document);
  document.exams.forEach(record=>{record.visibilityState='ADVISOR_ONLY';});
  document.events.forEach(event=>{event.visibilityState='ADVISOR_ONLY';});
  const originalEvents=JSON.stringify(document.events),originalRecords=structuredClone(document.exams);
  normalizeExamDocument(document);
  assert.deepEqual(document.builder.examSystems,['USMLE']);
  assert.equal(JSON.stringify(document.events),originalEvents);
  for(const before of originalRecords){
    const record=document.exams.find(item=>item.id===before.id);
    assert.equal(record.sourceType,'document-intake');
    assert.equal(record.sourceEventId,before.sourceEventId);
    assert.equal(record.visibilityState,'ADVISOR_ONLY');
    assert.deepEqual(record.provenance,before.provenance);
    assert.equal(record.attempt,undefined);assert.equal(record.attemptNumberUnconfirmed,true);
    assert.equal(record.showScoreOnTimeline,false);
  }
  const score=document.exams.find(record=>record.examId==='step-2-ck');
  updateBuilderExamAttempt(document,score.id,{score:'252'});
  assert.equal(document.exams.find(record=>record.id===score.id).score,'252');
  assert.equal(document.exams.find(record=>record.id===score.id).visibilityState,'ADVISOR_ONLY');
  assert.equal(JSON.stringify(document.events),originalEvents);
  setBuilderExamSystem(document,'USMLE',false);
  assert.deepEqual(stateFor(document).builder.examSystems,[],'An explicit system choice must remain respected');
  assert.equal(document.exams.length,2);
  setBuilderExamSystem(document,'USMLE',true);
  assert.deepEqual(stateFor(document).builder.examSystems,['USMLE']);
  assert.equal(JSON.stringify(document.events),originalEvents);
});

test('021 normalization preserves partial private enrichment of a manual exam without promoting it to public workflow facts',()=>{
  const source=fixture.document.exams[1];
  const authority={sourceType:'document-intake',sourceEventId:source.sourceEventId,visibilityState:'ADVISOR_ONLY',provenance:source.provenance};
  const document={id:'manual-enrichment',builder:{examSystems:['USMLE']},events:[],exams:[{id:'manual',system:'USMLE',examId:'step-2-ck',examDate:'2023-03',result:'Passed',score:'251',showScoreOnTimeline:false,fieldProvenance:{score:authority}}]};
  normalizeExamDocument(document);
  assert.equal(document.exams[0].id,'manual');assert.equal(document.exams[0].result,'Passed');
  assert.deepEqual(document.exams[0].fieldProvenance.score,authority);
  assert.equal(document.exams[0].sourceType,undefined);
  assert.equal(document.events.length,0);
});
