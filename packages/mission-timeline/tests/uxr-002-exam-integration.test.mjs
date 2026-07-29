import assert from "node:assert/strict";
import test from "node:test";

import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  examWorkflowFromDocument,
  finalizeBuilderExams,
  normalizeExamDocument,
  setBuilderExamSystem,
  updateBuilderExamAttempt
} from "../web/js/uxr-002/exam-integration.js";
import {renderKeynoteClassicBoard} from "../web/js/uxr-002/board-renderer.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

test("M5/M6 integration keeps independent system selection and adds no exam until a chip is used",()=>{
  const document=defaultDocument();
  setBuilderExamSystem(document,"USMLE",true);
  setBuilderExamSystem(document,"COMLEX-USA",true);
  assert.deepEqual(document.builder.examSystems,["USMLE","COMLEX-USA"]);
  assert.deepEqual(document.exams,[]);
  assert.deepEqual(document.events,[]);

  addBuilderExam(document,"USMLE","step-2-ck");
  assert.equal(document.exams.length,1);
  assert.equal(document.exams[0].name,"Step 2 CK");
  assert.equal(document.exams[0].attempt,1);
  assert.equal(document.events.length,0,"an incomplete card must not project a timeline event");
});

test("M5/M6 integration applies the failed-attempt transition atomically to cards and projected board events",()=>{
  const document=defaultDocument();
  setBuilderExamSystem(document,"USMLE",true);
  addBuilderExam(document,"USMLE","step-2-ck");
  const first=document.exams[0].id;
  updateBuilderExamAttempt(document,first,{
    result:"Failed",
    score:"214",
    examDate:"2024-01",
    showScoreOnTimeline:true
  });

  assert.equal(document.exams.length,2);
  assert.deepEqual(document.exams.map(({attempt,automatic})=>({attempt,automatic})),[
    {attempt:1,automatic:false},
    {attempt:2,automatic:true}
  ]);
  assert.equal(document.exams[0].showScoreOnTimeline,false);
  assert.equal(document.exams[1].id,"exam-usmle-step-2-ck-attempt-2");

  const milestone=document.events.find((event)=>event.eventType==="milestone");
  const study=document.events.find((event)=>event.eventType==="duration");
  assert.equal(milestone.dangerDot,true);
  assert.equal(milestone.title,"Step 2 CK");
  assert.deepEqual({
    title:study.title,
    startDate:study.startDate,
    endDate:study.endDate,
    provisional:study.provisional,
    isStudyPeriod:study.isStudyPeriod,
    outlineStyle:study.outlineStyle,
    chip:study.actionChip.label
  },{
    title:"Step 2 CK — preparing for retake",
    startDate:"2024-02",
    endDate:"2024-05",
    provisional:true,
    isStudyPeriod:true,
    outlineStyle:"dashed",
    chip:"Set retake date"
  });
});

test("M5/M6 integration closes the provisional period when the retake date is entered",()=>{
  const document=defaultDocument();
  setBuilderExamSystem(document,"COMLEX-USA",true);
  addBuilderExam(document,"COMLEX-USA","level-2-ce");
  updateBuilderExamAttempt(document,document.exams[0].id,{result:"Failed",examDate:"2023-03"});
  updateBuilderExamAttempt(document,document.exams[1].id,{examDate:"2023-09"});
  const study=document.events.find((event)=>event.studyPeriodKind==="automatic-retake");
  assert.equal(study.endDate,"2023-09");
  assert.equal(study.provisional,false);
  assert.equal(study.outlineStyle,"solid");
  assert.equal(study.actionChip,null);
  assert.equal(document.exams[1].result,"","a date must not infer a retake result");
});

test("M5/M6 integration persists deterministically through flat-record round trips",()=>{
  const document=defaultDocument();
  setBuilderExamSystem(document,"USMLE",true);
  addBuilderExam(document,"USMLE","step-3");
  updateBuilderExamAttempt(document,document.exams[0].id,{result:"Awaiting result",examDate:"2026-06"});
  const before=structuredClone(document);
  const workflow=examWorkflowFromDocument(document);
  assert.equal(workflow.exams[0].attempts[0].result,"Awaiting result");
  normalizeExamDocument(document);
  assert.deepEqual(document.exams,before.exams);
  assert.deepEqual(document.events,before.events);
});

test("the integrated board renders the neutral failed dot, hatched provisional period, and Set retake date chip",()=>{
  const document=defaultDocument();
  document.studentProfile.fullName="Amara Osei";
  document.events.push({
    id:"school",
    title:"Medical school",
    categoryId:"education",
    eventType:"duration",
    startDate:"2021-01",
    endDate:"2023-12",
    visibilityState:"INTERVIEWER_SAFE"
  });
  setBuilderExamSystem(document,"USMLE",true);
  addBuilderExam(document,"USMLE","step-2-ck");
  updateBuilderExamAttempt(document,document.exams[0].id,{result:"Failed",examDate:"2024-01"});
  const {svg}=renderKeynoteClassicBoard(document,{currentMonth:"2026-07"});
  assert.match(svg,/data-failed-attempt-dot="true"/);
  assert.match(svg,/data-study="true"/);
  assert.match(svg,/stroke-dasharray="8 6"/);
  assert.match(svg,/data-study-action-chip="exam-usmle-step-2-ck-attempt-2"/);
  assert.match(svg,/>Set retake date<\/text>/);
});

test("M5/M6 integration delete renumbers attempts and finalization drops an empty automatic card but keeps its provisional study period",()=>{
  const document=defaultDocument();
  setBuilderExamSystem(document,"USMLE",true);
  addBuilderExam(document,"USMLE","step-2-ck");
  updateBuilderExamAttempt(document,document.exams[0].id,{result:"Failed",examDate:"2024-01"});
  finalizeBuilderExams(document);
  assert.equal(document.exams.length,1,"the empty automatic retake card is dropped at finish");
  assert.equal(document.events.some((event)=>event.studyPeriodKind==="automatic-retake"),true);
  assert.equal(document.events.find((event)=>event.studyPeriodKind==="automatic-retake").provisional,true);

  deleteBuilderExamAttempt(document,document.exams[0].id);
  assert.equal(document.exams.length,0);
  assert.equal(document.events.filter((event)=>event.sourceType==="exam-workflow").length,0);
});
