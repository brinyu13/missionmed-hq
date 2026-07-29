import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitingExamStoryChecks,
  buildCompletenessSummary,
  computeStoryChecks,
  gapStoryChecks,
  overlapStoryChecks,
  renderReviewFinish
} from "../web/js/uxr-002/review.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const fixedNow=new Date("2026-07-29T12:00:00.000Z");

test("M7 completeness renders six frozen domains with complete, started, skipped, and empty states",()=>{
  const document=defaultDocument();
  document.studentProfile.fullName="Amara Osei";
  document.builder.touched=[1,2,4];
  document.builder.skipped=[4];
  document.exams=[{id:"exam-1",name:"Step 2 CK",result:"Passed"}];
  document.events=[
    {
      id:"rotation",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2024-01",
      endDate:"2024-02",
      fields:{builderDomain:"clinical",builderEntryId:"clinical-1"}
    },
    {
      id:"research",
      categoryId:"research",
      eventType:"duration",
      startDate:"2024-03",
      endDate:"2024-06",
      fields:{builderDomain:"research",builderEntryId:"research-1"}
    }
  ];
  assert.deepEqual(
    buildCompletenessSummary(document).map(({label,count,state})=>({label,count,state})),
    [
      {label:"Core Info",count:0,state:"started"},
      {label:"Exams",count:1,state:"complete"},
      {label:"US Clinical Rotations",count:1,state:"complete"},
      {label:"Work Experience",count:0,state:"skipped"},
      {label:"Research",count:1,state:"complete"},
      {label:"Personal",count:0,state:"empty"}
    ]
  );
});

test("M7 gap checks use uncovered months, merge overlapping coverage, and link the later owner",()=>{
  const checks=gapStoryChecks([
    {id:"school",categoryId:"education",eventType:"duration",startDate:"2020-01",endDate:"2021-12"},
    {id:"research",categoryId:"research",eventType:"duration",startDate:"2021-06",endDate:"2022-03"},
    {id:"rotation",categoryId:"clinical",eventType:"duration",startDate:"2022-10",endDate:"2023-01"}
  ],{now:fixedNow});
  assert.equal(checks.length,1);
  assert.equal(checks[0].count,6);
  assert.equal(checks[0].message,"There's a 6-month gap in 2022. Interviewers ask about gaps — add what happened, or be ready to talk about it.");
  assert.deepEqual(checks[0].target,{step:3,eventId:"rotation"});
});

test("M7 overlap checks report one neutral row per contiguous >2-arrow run at its peak",()=>{
  const checks=overlapStoryChecks([
    {id:"school",categoryId:"education",eventType:"duration",startDate:"2023-01",endDate:"2023-12"},
    {id:"work",categoryId:"work",eventType:"duration",startDate:"2023-03",endDate:"2023-08"},
    {id:"research",categoryId:"research",eventType:"duration",startDate:"2023-04",endDate:"2023-09"},
    {id:"rotation",categoryId:"clinical",eventType:"duration",startDate:"2023-06",endDate:"2023-07"},
    {id:"flag",categoryId:"exams",eventType:"milestone",startDate:"2023-06"}
  ],{now:fixedNow});
  assert.equal(checks.length,1);
  assert.equal(checks[0].count,4);
  assert.equal(checks[0].month,"2023-06");
  assert.equal(checks[0].message,"You have 4 things running at once in Jun 2023. That's a strength — check the labels read clearly.");
  assert.deepEqual(checks[0].target,{step:1,eventId:"school"});
});

test("M7 awaiting checks use only exams whose result is awaiting",()=>{
  assert.deepEqual(awaitingExamStoryChecks([
    {id:"one",name:"Step 2 CK",result:"Awaiting result"},
    {id:"two",name:"Level 2-CE",result:"Passed"}
  ]),[{
    id:"awaiting-one",
    type:"awaiting-exam",
    message:"Step 2 CK result pending — update it when it arrives.",
    target:{step:2,examId:"one"}
  }]);
});

test("M7 combined checks and markup contain exactly the frozen check classes and working targets",()=>{
  const document=defaultDocument();
  document.events=[
    {id:"first",categoryId:"education",eventType:"duration",startDate:"2019-01",endDate:"2019-12"},
    {id:"later",categoryId:"work",eventType:"duration",startDate:"2020-07",endDate:"2021-01"}
  ];
  document.exams=[{id:"pending",name:"Step 3",result:"Awaiting result"}];
  const checks=computeStoryChecks(document,{now:fixedNow});
  assert.deepEqual(checks.map((check)=>check.type),["gap","awaiting-exam"]);

  const html=renderReviewFinish(document,{now:fixedNow});
  assert.equal((html.match(/class="review-row /g)||[]).length,6);
  assert.match(html,/<h2 id="review-completeness-title">Completeness summary<\/h2>/);
  assert.match(html,/<h2 id="review-story-checks-title">Story checks<\/h2>/);
  assert.match(html,/data-story-check="gap"/);
  assert.match(html,/data-review-step="4" data-review-event="later"/);
  assert.match(html,/data-story-check="awaiting-exam"/);
  assert.match(html,/data-review-step="2" data-review-exam="pending"/);
  assert.match(html,/>Open my canvas →<\/button>/);
  assert.match(html,/>Export now<\/button>/);
  assert.doesNotMatch(html,/alarm|warning|error/i);
});
