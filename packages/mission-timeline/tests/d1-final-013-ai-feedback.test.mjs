import assert from "node:assert/strict";
import test from "node:test";

import {
  TIMELINE_AI_FEEDBACK_PIPELINE,
  appendTimelineAiFeedback,
  classifyTimelineAiCandidateOutcome,
  feedbackForCuration
} from "../web/js/uxr-002/ai-feedback.js";

test("AI candidate outcomes distinguish true semantic edits from unchanged acceptance",()=>{
  const candidate={
    title:"Research Fellow",categoryId:"research",startDate:"2021-01",endDate:"2022-01",
    fields:{aiOriginalSemantic:{title:"Research Fellow",categoryId:"research",startDate:"2021-01",endDate:"2022-01"}}
  };
  assert.equal(classifyTimelineAiCandidateOutcome(candidate,"accepted"),"ACCEPTED");
  assert.equal(classifyTimelineAiCandidateOutcome(candidate,"merge"),"ACCEPTED");
  assert.equal(classifyTimelineAiCandidateOutcome({...candidate,title:"Cardiology Research Fellow"},"accepted"),"MODIFIED");
  assert.equal(classifyTimelineAiCandidateOutcome(candidate,"rejected"),"REJECTED");
});

test("013 feedback record captures the required structured outcome without source content",()=>{
  const document={id:"timeline_test",events:[]};
  const record=appendTimelineAiFeedback(document,{
    workflow:"CV_SMART_FILL",
    workflowVersion:"d1-timeline-cv-ai.1",
    modelVersion:"gpt-test-pinned",
    suggestionId:"candidate-award-1",
    suggestionType:"CATEGORY_REVIEW",
    confidence:.82,
    outcome:"MODIFIED",
    correctedCategory:"education",
    correctedStartDate:"2019-01",
    correctedEndDate:null,
    layoutFix:null,
    actorKind:"STUDENT",
    finalCanonicalReference:"event:event-award-1@revision:12"
  },{now:()=>"2026-08-20T20:00:00.000Z",id:()=>"feedback-1"});
  assert.equal(record.modified,true);
  assert.equal(record.accepted,false);
  assert.equal(record.rejected,false);
  assert.equal(record.correctedCategory,"education");
  assert.equal(record.correctedStartDate,"2019-01");
  assert.equal(record.trainingEligible,false);
  assert.deepEqual(document.aiFeedbackPolicy.pipeline,[...TIMELINE_AI_FEEDBACK_PIPELINE]);
  assert.equal(document.aiFeedbackPolicy.automaticTraining,false);
  assert.doesNotMatch(JSON.stringify(record),/Dean|CV body|source excerpt/i);
});

test("Founder and mentor corrections remain distinguishable and no action auto-trains",()=>{
  const document={};
  for(const actorKind of ["FOUNDER","MENTOR"]){
    appendTimelineAiFeedback(document,{
      workflow:"QUALITY_GUARDIAN",
      workflowVersion:"d1-timeline-quality-guardian-ai.1",
      modelVersion:"gpt-test-pinned",
      suggestionId:`layout-${actorKind.toLowerCase()}`,
      suggestionType:"LAYOUT_FIX",
      confidence:.91,
      outcome:actorKind==="FOUNDER"?"ACCEPTED":"REJECTED",
      layoutFix:"AUTO_ARRANGE_EVENTS",
      layoutFixAccepted:actorKind==="FOUNDER",
      actorKind,
      finalCanonicalReference:"document:timeline_test@revision:13"
    });
  }
  const records=feedbackForCuration(document);
  assert.deepEqual(records.map(({actorKind})=>actorKind),["FOUNDER","MENTOR"]);
  assert.ok(records.every(({trainingEligible})=>trainingEligible===false));
  assert.ok(records.every(({curationStatus})=>curationStatus==="UNREVIEWED"));
});

test("feedback validates outcome, confidence, dates, and canonical reference",()=>{
  const base={
    workflow:"TIMELINE_RESCUE",workflowVersion:"rescue-v1",modelVersion:"model-v1",
    suggestionId:"rescue-1",suggestionType:"DATE_REVIEW",confidence:.5,outcome:"REJECTED",
    actorKind:"STUDENT",finalCanonicalReference:"document:test@revision:1"
  };
  assert.throws(()=>appendTimelineAiFeedback({}, {...base,confidence:2}),/CONFIDENCE/);
  assert.throws(()=>appendTimelineAiFeedback({}, {...base,outcome:"IGNORED"}),/OUTCOME/);
  assert.throws(()=>appendTimelineAiFeedback({}, {...base,correctedStartDate:"someday"}),/DATE/);
  assert.throws(()=>appendTimelineAiFeedback({}, {...base,finalCanonicalReference:""}),/CANONICAL_REFERENCE/);
});

test("feedback history is bounded to the most recent 500 owner-document records",()=>{
  const document={aiFeedback:Array.from({length:500},(_,index)=>({id:`prior-${index}`}))};
  appendTimelineAiFeedback(document,{
    workflow:"QUALITY_GUARDIAN",workflowVersion:"qg-v1",modelVersion:"model-v1",
    suggestionId:"new",suggestionType:"EXPORT_REVIEW",confidence:.8,outcome:"ACCEPTED",
    actorKind:"STUDENT",finalCanonicalReference:"document:test@revision:2"
  },{id:()=>"latest",now:()=>"2026-08-20T20:00:00.000Z"});
  assert.equal(document.aiFeedback.length,500);
  assert.equal(document.aiFeedback[0].id,"prior-1");
  assert.equal(document.aiFeedback.at(-1).id,"latest");
});
