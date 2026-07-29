import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  buildCompletenessSummary,
  computeStoryChecks
} from "../web/js/uxr-002/review.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");

function sourceBetween(start,end){
  const from=index.indexOf(start);
  const to=index.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return index.slice(from,to);
}

function duration(id,title,startDate,endDate,categoryId,step){
  const domain={1:"core",2:"exams",3:"clinical",4:"work",5:"research",6:"personal"}[step];
  return{
    id,
    title,
    categoryId,
    eventType:"duration",
    startDate,
    endDate,
    openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",
    fields:{builderDomain:domain,builderEntryId:`entry-${id}`}
  };
}

test("407F Step 7 renders the exact completeness, story-check, and action hierarchy",()=>{
  const source=sourceBetween("function reviewFinishMarkup404(","function builderPlaceholderMarkup(");
  assert.match(source,/Completeness summary/);
  assert.match(source,/Story checks/);
  assert.match(source,/OPEN MY CANVAS →/);
  assert.match(source,/EXPORT NOW/);
  assert.match(source,/review\.completeness\.map/);
  assert.match(source,/review\.checks\.map/);
  assert.match(source,/data-review-step=/);
  assert.match(source,/data-review-event=/);
  assert.match(source,/data-review-exam=/);
  assert.match(
    index,
    /if\(step===7\)return reviewFinishMarkup404\(\)/
  );
});

test("407F adapter reuses the retained review engine and maps Core/touched state into it",()=>{
  assert.match(adapter,/buildCompletenessSummary/);
  assert.match(adapter,/computeStoryChecks/);
  assert.match(adapter,/api\.review=Object\.freeze\(\{/);
  assert.match(adapter,/completeness:buildCompletenessSummary\(current\)/);
  assert.match(adapter,/checks:computeStoryChecks\(current/);
  assert.match(adapter,/medicalSchool:state\.wiz\?\.school/);
  assert.match(adapter,/graduationDate:state\.wiz\?\.grad/);
  assert.match(adapter,/degree:state\.wiz\?\.degree/);
  assert.match(adapter,/touched:Object\.entries\(state\.builder\?\.touched\|\|\{\}\)/);
});

test("completeness has exactly six frozen rows and preserves complete, started, skipped, and empty states",()=>{
  const document=defaultDocument();
  document.studentProfile={
    ...document.studentProfile,
    fullName:"Amara Osei",
    medicalSchool:"Test Medical School",
    medicalSchoolCountry:"Ghana",
    graduationDate:"2023-05",
    degree:"MBBS"
  };
  document.builder.touched=[4];
  document.builder.skipped=[6];
  document.exams=[{id:"exam-1",system:"USMLE",examId:"step-2-ck",result:"Passed",examDate:"2024-01"}];
  document.events.push(duration("clinical-1","Internal Medicine · MGH","2023-06","2023-08","clinical",3));

  const rows=buildCompletenessSummary(document);
  assert.equal(rows.length,6);
  assert.deepEqual(rows.map(({label})=>label),[
    "Core Info","Exams","US Clinical Rotations","Work Experience","Research","Personal"
  ]);
  assert.deepEqual(rows.map(({state})=>state),[
    "complete","complete","complete","started","empty","skipped"
  ]);
});

test("review snapshot computes only the three frozen neutral story-check types",()=>{
  const document=defaultDocument();
  document.events=[
    duration("early","Early work","2020-01","2020-02","work",4),
    duration("late","Late work","2021-01","2021-12","work",4),
    duration("research","Research","2021-03","2021-11","research",5),
    duration("clinical","Clinical","2021-05","2021-10","clinical",3)
  ];
  document.exams=[{
    id:"exam-awaiting",
    system:"USMLE",
    examId:"step-2-ck",
    name:"Step 2 CK",
    result:"Awaiting result",
    examDate:"2024-01"
  }];
  const checks=computeStoryChecks(document,{now:new Date("2021-12-01T00:00:00Z")});
  assert.deepEqual(new Set(checks.map(({type})=>type)),new Set([
    "gap","overlap","awaiting-exam"
  ]));
  assert.ok(checks.find(({type})=>type==="gap")?.message.includes("Interviewers ask about gaps"));
  assert.ok(checks.find(({type})=>type==="overlap")?.message.includes("That's a strength"));
  assert.equal(
    checks.find(({type})=>type==="awaiting-exam")?.message,
    "Step 2 CK result pending — update it when it arrives."
  );
});

test("Review links jump to owning Builder entries and actions route without gating",()=>{
  const handlers=sourceBetween(
    "document.addEventListener('click',e=>{\n  const typeaheadChoice",
    "document.addEventListener('mousedown'"
  );
  assert.match(handlers,/const reviewJump=e\.target\.closest\('\[data-review-step\]'\)/);
  assert.match(handlers,/runDomainAction404\('edit',reviewJump\.dataset\.reviewEvent\)/);
  assert.match(handlers,/state\.builder\.step=step;renderBuilder404\(\)/);
  assert.match(handlers,/if\(reviewCanvas\)\{state\.mode='blank';go\('canvas'\);return\}/);
  assert.match(handlers,/if\(reviewExport\)\{go\('export'\);return\}/);
  assert.doesNotMatch(
    sourceBetween("function reviewFinishMarkup404(","function builderPlaceholderMarkup("),
    /disabled/
  );
});
