import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  compareExactDates,
  exactDateFieldMarkup,
  formatExactDate,
  monthFromExactDate,
  parseExactDate,
  shiftExactDateByMonths
} from "../web/js/uxr-002/exact-date-field.js";
import {monthFieldMarkup} from "../web/js/uxr-002/month-field.js";
import {projectRotationDates} from "../web/js/uxr-002/builder.js";
import {
  beginCanvasDrag,
  updateCanvasDrag
} from "../web/js/uxr-002/canvas.js";
import {migrateDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(
  new URL("js/407f-engineering-adapter.js",webRoot),
  "utf8"
);
const exactDateSource=await readFile(
  new URL("js/uxr-002/exact-date-field.js",webRoot),
  "utf8"
);
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

test("M5 exact dates accept ISO and unambiguous month names without accepting locale-ambiguous numeric dates",()=>{
  assert.equal(parseExactDate("2024-02-29"),"2024-02-29");
  assert.equal(parseExactDate("Feb 29, 2024"),"2024-02-29");
  assert.equal(parseExactDate("29 February 2024"),"2024-02-29");
  assert.equal(parseExactDate("2023-02-29"),null);
  assert.equal(parseExactDate("06/15/2023"),null);
  assert.equal(formatExactDate("2025-06-09",{locale:"en-US"}),"Jun 9, 2025");
  assert.equal(monthFromExactDate("2025-06-09"),"2025-06");
  assert.equal(compareExactDates("2025-06-09","2025-07-04"),-1);
});

test("M5 month shifting preserves exact-day intent and clamps end-of-month safely",()=>{
  assert.equal(shiftExactDateByMonths("2023-01-31",1),"2023-02-28");
  assert.equal(shiftExactDateByMonths("2024-01-31",1),"2024-02-29");
  assert.equal(shiftExactDateByMonths("2024-03-31",-1),"2024-02-29");
  assert.equal(shiftExactDateByMonths("not-a-date",1),null);
});

test("M5 shared controls expose custom calendar semantics, typed fallbacks, and independent errors",()=>{
  const month=monthFieldMarkup({
    id:"exam-date",
    label:"Exam date",
    value:"2024-01",
    required:true,
    inputAttributes:{"data-exam-field":"examDate"},
    errorAttributes:{"data-exam-error":"examDate"}
  });
  assert.match(month,/type="text"/);
  assert.doesNotMatch(month,/type="month"/);
  assert.match(month,/aria-controls="exam-date-popover"/);
  assert.match(month,/role="dialog" aria-label="Choose month and year"/);
  assert.match(month,/role="row"/);
  assert.match(month,/role="gridcell"/);
  assert.match(month,/data-exam-field="examDate"/);
  assert.match(month,/data-exam-error="examDate"/);

  const exact=exactDateFieldMarkup({
    id:"rotation-start",
    label:"Start date",
    value:"2025-06-09",
    required:true,
    help:"Exact day required.",
    inputAttributes:{"data-domain-date":"rotationStartDate"},
    error:"Required.",
    errorAttributes:{"data-domain-error":"rotationStartDate"}
  });
  assert.match(exact,/type="text"/);
  assert.doesNotMatch(exact,/type="date"/);
  assert.match(exact,/value="Jun 9, 2025"/);
  assert.match(exact,/aria-controls="rotation-start-popover"/);
  assert.match(exact,/role="dialog" aria-label="Choose start date"/);
  assert.match(exact,/role="grid"/);
  assert.equal((exact.match(/role="row"/g)||[]).length,6);
  assert.equal((exact.match(/role="gridcell"/g)||[]).length,42);
  assert.match(exact,/aria-invalid="true"/);
  assert.match(exact,/data-domain-error="rotationStartDate"/);
});

test("M5 rotation projection stores exact ISO days additively while preserving the month-axis contract",()=>{
  assert.deepEqual(projectRotationDates({
    rotationStartDate:"Jun 9, 2025",
    rotationEndDate:"2025-07-04",
    startDate:"2020-01",
    endDate:"2020-02",
    current:false
  }),{
    rotationStartDate:"2025-06-09",
    rotationEndDate:"2025-07-04",
    rotationDatePrecision:"day",
    startDate:"2025-06",
    endDate:"2025-07"
  });
  assert.deepEqual(projectRotationDates({
    startDate:"2025-06",
    endDate:"2025-07",
    current:false
  }),{
    rotationStartDate:null,
    rotationEndDate:null,
    rotationDatePrecision:"month-legacy",
    startDate:"2025-06",
    endDate:"2025-07"
  });
});

test("M5 migration marks legacy rotations without fabricating exact days",()=>{
  const migrated=migrateDocument({
    events:[{
      id:"legacy-rotation",
      title:"Internal medicine",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2025-06",
      endDate:"2025-07",
      openEnded:false,
      fields:{builderDomain:"clinical"}
    }],
    builder:{
      drafts:{
        clinical:{startDate:"2026-01",endDate:"2026-02"}
      }
    }
  });
  const event=migrated.events[0];
  assert.equal(event.fields.rotationStartDate,null);
  assert.equal(event.fields.rotationEndDate,null);
  assert.equal(event.fields.rotationDatePrecision,"month-legacy");
  assert.equal(migrated.builder.drafts.clinical.rotationStartDate,null);
  assert.equal(migrated.builder.drafts.clinical.rotationEndDate,null);
  assert.equal(migrated.builder.drafts.clinical.rotationDatePrecision,"month-legacy");
});

test("M5 Canvas move and resize keep clinical exact dates synchronized with month-axis changes",()=>{
  const document={
    events:[{
      id:"rotation",
      title:"Internal medicine",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2024-01",
      endDate:"2024-02",
      openEnded:false,
      lane:0,
      fields:{
        builderDomain:"clinical",
        rotationStartDate:"2024-01-31",
        rotationEndDate:"2024-02-29",
        rotationDatePrecision:"day"
      }
    }]
  };
  const moved=updateCanvasDrag(
    beginCanvasDrag(document,"rotation",{kind:"move",currentMonth:"2026-07"}),
    {monthDelta:1}
  );
  assert.equal(moved.preview.startDate,"2024-02");
  assert.equal(moved.preview.endDate,"2024-03");
  assert.equal(moved.preview.fields.rotationStartDate,"2024-02-29");
  assert.equal(moved.preview.fields.rotationEndDate,"2024-03-29");

  const resized=updateCanvasDrag(
    beginCanvasDrag(document,"rotation",{kind:"resize-end",currentMonth:"2026-07"}),
    {monthDelta:-2}
  );
  assert.equal(resized.preview.endDate,resized.preview.startDate);
  assert.equal(
    resized.preview.fields.rotationEndDate,
    resized.preview.fields.rotationStartDate
  );
});

test("M5 integrates the shared controls across the active 407F Builder and Canvas without a parallel shell",()=>{
  assert.match(index,/dateControlMarkup404\(\{precision:'month',id:'core-graduation-407f'/);
  assert.match(index,/precision:'day',required:true,help:startHelp/);
  for(const domain of ["work","research","personal"]){
    assert.match(index,new RegExp(`domainDateControl404\\('${domain}'`));
  }
  assert.match(index,/document\.addEventListener\('d1:date-commit'/);
  assert.match(adapter,/api\.dateControls=Object\.freeze/);
  assert.match(adapter,/installExactDateFields/);
  assert.match(adapter,/installMonthFields/);
  assert.match(adapter,/data-canvas-rotation-date/);
});

test("M5 date control styling preserves 407F identity, 44px targets, visible focus, and approved gold text",()=>{
  assert.match(css,/\.month-trigger,\s*\.exact-date-trigger\{[\s\S]*?min-height:44px[\s\S]*?min-width:44px/);
  assert.match(css,/\.month-popover,\s*\.exact-date-popover\{[\s\S]*?background:#0b111d/);
  assert.match(css,/\.month-trigger:focus-visible,[\s\S]*?outline:2px solid var\(--cy\)/);
  assert.match(css,/aria-selected="true"[\s\S]*?color:#191c21/i);
  assert.match(css,/@media\(max-width:767px\)/);
  assert.match(exactDateSource,/bottom="calc\(68px \+ env\(safe-area-inset-bottom, 0px\)\)"/);
});
