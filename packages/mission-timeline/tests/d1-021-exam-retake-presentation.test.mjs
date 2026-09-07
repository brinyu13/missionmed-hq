import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDocument} from '../web/js/uxr-002/store.js';
import {setBuilderExamSystem,addBuilderExam,updateBuilderExamAttempt,normalizeExamDocument,examWorkflowFromDocument} from '../web/js/uxr-002/exam-integration.js';
import {validateExamAttempt} from '../web/js/uxr-002/exam-workflow.js';
import {validateExam,renderBuilder} from '../web/js/uxr-002/builder.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';

function retakeDocument(){
  const document=defaultDocument();
  setBuilderExamSystem(document,'USMLE',true);
  addBuilderExam(document,'USMLE','step-1');
  updateBuilderExamAttempt(document,document.exams[0].id,{result:'Failed',examDate:'2022-01',studyStartDate:'2021-01'});
  updateBuilderExamAttempt(document,document.exams[1].id,{result:'Passed',examDate:'2022-05',studyStartDate:'2022-02'});
  return document;
}

test('a passing retake replaces the earlier failed profile summary without deleting either attempt',()=>{
  const document=retakeDocument();
  const facts=structuredClone(document.exams);
  const rendered=serializeFounderPresentation(document,{currentMonth:'2026-09'});
  assert.equal(rendered.scene.profile.step1,'Passed (2nd attempt)');
  assert.deepEqual(document.exams,facts);
  assert.equal(document.events.filter(event=>event.eventType==='milestone').length,2);
  document.exams.reverse();
  assert.equal(serializeFounderPresentation(document,{currentMonth:'2026-09'}).scene.profile.step1,'Passed (2nd attempt)');
});

test('an entered retake study window replaces its inferred preparation window, including after normalization',()=>{
  const document=retakeDocument();
  for(let index=0;index<2;index++){
    const periods=document.events.filter(event=>event.eventType==='duration');
    assert.equal(periods.length,2);
    assert.equal(periods.filter(event=>event.startDate==='2022-02'&&event.endDate==='2022-05').length,1);
    assert.ok(periods.every(event=>event.studyPeriodKind==='entered'));
    normalizeExamDocument(document);
  }
});

test('a later private result cannot replace the public profile summary',()=>{
  const document=retakeDocument();
  const second=document.exams[1];
  const event=document.events.find(event=>event.eventType==='milestone'&&event.fields?.attemptNumber===2);
  second.sourceType='document-intake';second.sourceEventId=event.id;second.visibilityState='ADVISOR_ONLY';
  event.visibilityState='ADVISOR_ONLY';
  assert.equal(serializeFounderPresentation(document,{currentMonth:'2026-09'}).scene.profile.step1,'Failed');
});

test('a study start after its exam remains reviewable and cannot supersede the retake helper',()=>{
  const document=retakeDocument();
  updateBuilderExamAttempt(document,document.exams[1].id,{studyStartDate:'2022-06'});
  const attempt=examWorkflowFromDocument(document).exams[0].attempts[1];
  assert.equal(validateExamAttempt(attempt).valid,false);
  assert.equal(validateExamAttempt(attempt).studyPeriodStart.error,'Study start must be on or before the exam date.');
  assert.equal(document.exams[1].studyStartDate,'2022-06','do not silently correct an entered fact');
  assert.equal(validateExam(document.exams[1]).studyStartDate,'Study start must be on or before the exam date.');
  assert.match(renderBuilder({...document,builder:{...document.builder,step:2}}),/Study start must be on or before the exam date\./);
  assert.ok(document.events.some(event=>event.studyPeriodKind==='automatic-retake'));
  assert.ok(!document.events.some(event=>event.startDate==='2022-06'&&event.endDate==='2022-05'));
});
