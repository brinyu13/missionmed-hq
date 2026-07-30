import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  apply407FStateToDocument,
  applyDocumentTo407FState
} from "../web/js/407f-engineering-adapter.js";
import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  setBuilderExamSystem,
  updateBuilderExamAttempt
} from "../web/js/uxr-002/exam-integration.js";

const indexPath=new URL("../web/index.html",import.meta.url);
const stylePath=new URL("../web/styles/407f-upgrade.css",import.meta.url);

test("M4 renders independent USMLE and COMLEX selection with add-via-chip exams",async()=>{
  const html=await readFile(indexPath,"utf8");
  assert.match(html,/const EXAM_SYSTEMS_404=\{[\s\S]*USMLE:[\s\S]*'COMLEX-USA':/);
  assert.match(html,/data-exam-system=/);
  assert.match(html,/data-exam-add-system=/);
  assert.match(html,/Choose USMLE, COMLEX, or both\./);
  assert.match(html,/No exams added yet\./);
});

test("M4 keeps result and score primary, dates secondary, with frozen copy",async()=>{
  const html=await readFile(indexPath,"utf8");
  const card=html.slice(html.indexOf("function examCard404"),html.indexOf("function examsMarkup404"));
  assert.ok(card.indexOf("builderExamPrimary")<card.indexOf("builderExamSecondary"));
  assert.match(card,/Passed','Failed','Awaiting result/);
  assert.match(card,/Score <em>Optional/);
  assert.match(card,/Exam date \(taken\)/);
  assert.match(card,/label:'Started studying',optional:true/);
  assert.match(card,/Show score on timeline/);
});

test("M4 reuses the engineering workflow for automatic attempts and provisional study periods",()=>{
  const document={builder:{examSystems:[]},exams:[],events:[]};
  setBuilderExamSystem(document,"USMLE",true);
  addBuilderExam(document,"USMLE","step-2-ck");
  const first=document.exams[0];
  updateBuilderExamAttempt(document,first.id,{
    result:"Failed",
    score:"214",
    examDate:"2024-01"
  });

  assert.equal(document.exams.length,2);
  assert.equal(document.exams[1].attempt,2);
  assert.equal(document.exams[1].automatic,true);
  const provisional=document.events.find((event)=>event.fields?.provisional);
  assert.equal(provisional.title,"Step 2 CK — preparing for retake");
  assert.equal(provisional.startDate,"2024-02");
  assert.equal(provisional.endDate,"2024-05");
  assert.equal(provisional.outlineStyle,"dashed");
  assert.equal(provisional.actionChip.label,"Set retake date");

  updateBuilderExamAttempt(document,document.exams[1].id,{examDate:"2024-07"});
  const closed=document.events.find((event)=>event.fields?.studyPeriod);
  assert.equal(closed.endDate,"2024-07");
  assert.equal(closed.provisional,false);
  assert.equal(closed.outlineStyle,"solid");

  deleteBuilderExamAttempt(document,document.exams[0].id);
  assert.equal(document.events.some((event)=>event.fields?.provisional),false);
});

test("M4 adapter preserves exam records and renders failed/provisional signals in 407F",async()=>{
  const document={
    studentProfile:{},
    builder:{step:2,examSystems:["USMLE"]},
    exams:[{id:"exam-1",system:"USMLE",examId:"step-2-ck",attempt:1,result:"Failed"}],
    events:[{
      id:"failed-flag",
      title:"Step 2 CK",
      categoryId:"exams",
      eventType:"milestone",
      startDate:"2024-01",
      visibilityState:"INTERVIEWER_SAFE",
      dangerDot:true,
      sourceType:"exam-workflow",
      fields:{builderDomain:"exams"}
    }],
    metadata:{}
  };
  const state={
    user:{events:[],interview:{}},
    profile:{},
    wiz:{},
    builder:{step:1},
    media:{},
    canvasTheme:"keynote"
  };
  applyDocumentTo407FState(document,state);
  assert.deepEqual(state.builder.examSystems,["USMLE"]);
  assert.equal(state.builder.exams[0].result,"Failed");
  assert.equal(state.user.events[0].fields.dangerDot,true);

  const roundTrip={studentProfile:{},metadata:{},builder:{},exams:[]};
  apply407FStateToDocument(state,roundTrip);
  assert.equal(roundTrip.builder.step,2);
  assert.deepEqual(roundTrip.builder.examSystems,["USMLE"]);
  assert.equal(roundTrip.exams[0].id,"exam-1");

  const [html,css]=await Promise.all([
    readFile(indexPath,"utf8"),
    readFile(stylePath,"utf8")
  ]);
  assert.match(html,/failedExamDot/);
  assert.match(html,/data-retake-target=/);
  assert.match(css,/\.arrow\.examStudy\.provisional/);
  assert.match(css,/\.retakeChip/);
});
