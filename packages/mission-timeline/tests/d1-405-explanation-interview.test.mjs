import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  EXPLANATION_TEXT_MAX,
  createExplanation,
  deleteExplanation,
  moveExplanation,
  resizeExplanation,
  updateExplanation
} from "../web/js/uxr-002/explanation.js";
import {
  createFixtureMatrixCalendarAdapter,
  createUnavailableMatrixCalendarAdapter
} from "../web/js/uxr-002/matrix-calendar-adapter.js";
import {
  activeSpecialtyVariant,
  applyActiveSpecialtyVariant,
  ensureSpecialtyVariants,
  setVariantInterviewTarget
} from "../web/js/uxr-002/specialty-variants.js";
import {
  renderKeynoteClassicBoard
} from "../web/js/uxr-002/board-renderer.js";
import {createAdvancedBoardRenderer} from "../web/js/uxr-002/advanced-board.js";
import {buildExportPreviewInput} from "../web/js/uxr-002/export-screen.js";
import {contrastRatio} from "../web/js/uxr-002/utils.js";

function fixture(){
  return{
    id:"m9-timeline",
    studentProfile:{
      fullName:"Avery Student",
      specialtyGoal:"Internal Medicine",
      interviewSeason:""
    },
    builder:{
      targetSpecialtyId:"acgme:internal-medicine",
      targetSpecialtyLabel:"Internal Medicine"
    },
    theme:"keynote-classic",
    mode:"guided",
    metadata:{interview:{}},
    advanced:{media:[]},
    events:[{
      id:"rotation-one",
      title:"Internal Medicine Rotation",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2025-06",
      endDate:"2025-07",
      visibilityState:"INTERVIEWER_SAFE",
      fields:{builderEntryId:"rotation-one"}
    }]
  };
}

test("M9 creates a bounded explanation without becoming a drawing system",()=>{
  const document=fixture();
  const created=createExplanation(document,{
    text:"Clarifies the transition from clinical work to a focused rotation.",
    startDate:"2025-06",
    target:{kind:"event",eventId:"rotation-one"}
  });
  assert.equal(created.ok,true);
  assert.equal(document.events.length,2);
  assert.equal(created.event.fields.builderDomain,"explanation");
  assert.equal(created.event.fields.leaderEnabled,true);
  assert.equal(
    createExplanation(document,{
      text:"x".repeat(EXPLANATION_TEXT_MAX+1),
      startDate:"2025-06"
    }).code,
    "EXPLANATION_TEXT_TOO_LONG"
  );
});

test("M9 explanation move, resize, details, and delete are bounded and factual-safe",()=>{
  const document=fixture();
  const created=createExplanation(document,{
    text:"A concise explanation.",
    startDate:"2025-06",
    target:{kind:"coordinate",x:960,y:540}
  }).event;
  moveExplanation(document,created.id,{x:-1000,y:9000});
  resizeExplanation(document,created.id,{width:9000,height:2});
  const updated=updateExplanation(document,created.id,{
    text:"Updated concise explanation.",
    target:{kind:"date",date:"2025-07"},
    leaderEnabled:false
  }).event;
  assert.equal(updated.fields.x,96);
  assert.equal(updated.fields.y,904);
  assert.equal(updated.fields.width,520);
  assert.equal(updated.fields.height,96);
  assert.equal(updated.fields.target.date,"2025-07");
  assert.equal(document.events[0].title,"Internal Medicine Rotation");
  assert.equal(deleteExplanation(document,created.id),true);
  assert.equal(document.events.length,1);
});

test("M9 renders a readable theme-aware explanation card and leader in export",()=>{
  const document=fixture();
  createExplanation(document,{
    text:"Explains a brief transition before the rotation.",
    startDate:"2025-06",
    target:{kind:"event",eventId:"rotation-one"}
  });
  const rendered=renderKeynoteClassicBoard(document,{currentMonth:"2026-07"});
  assert.match(rendered.svg,/data-event-kind="explanation"/);
  assert.match(rendered.svg,/data-explanation-card="true"/);
  assert.match(rendered.svg,/data-explanation-leader="true"/);
  assert.match(rendered.svg,/Explains a brief transition/);
  assert.match(rendered.svg,/fill="#F4F7FF"/);
  assert.ok(contrastRatio("#F4F7FF","#111827")>=4.5);
  const exportInput=buildExportPreviewInput(document,{audience:"INTERVIEWER_SAFE"});
  assert.equal(exportInput.timeline.events.length,2);
});

test("M9 stores interview details and program-logo reference only on the active variant",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  const variant=activeSpecialtyVariant(document);
  document.advanced.media.push({
    id:"logo-one",
    source:{name:"program.webp",type:"image/webp",localOnly:true},
    placed:false
  });
  const result=setVariantInterviewTarget(document,variant.id,{
    mode:"specific",
    programName:"Mission University Residency",
    specialtyId:"acgme:internal-medicine",
    specialtyLabel:"Internal Medicine",
    interviewDate:"2026-10-14",
    location:"Boston, MA",
    label:"Mission interview",
    logoMediaId:"logo-one",
    logoFit:"contain",
    logoX:1500,
    logoY:120,
    logoWidth:200,
    logoHeight:100
  });
  assert.equal(result.ok,true);
  const projected=applyActiveSpecialtyVariant(document);
  assert.equal(projected.metadata.interview.prog,"Mission University Residency");
  assert.equal(projected.metadata.interview.date,"2026-10-14");
  assert.equal(projected.metadata.interview.logoMediaId,"logo-one");
  assert.equal(projected.advanced.media[0].placed,true);
  assert.equal(projected.advanced.media[0].role,"interview-program-logo");
  assert.equal(projected.advanced.media[0].guidedVisible,true);
  assert.equal(document.advanced.media[0].placed,false);
  const renderer=createAdvancedBoardRenderer({
    resolveObjectUrl:(id)=>id==="logo-one"
      ?"data:image/webp;base64,UklGRg=="
      :""
  });
  const rendered=renderer(projected,{currentMonth:"2026-07"});
  assert.match(rendered.svg,/data-guided-media-layer="true"/);
  assert.match(rendered.svg,/data-advanced-media="logo-one"/);
  assert.match(rendered.svg,/preserveAspectRatio="xMidYMid meet"/);
});

test("M9 interview target appears in the rendered board and export input",()=>{
  const document=fixture();
  ensureSpecialtyVariants(document);
  const variant=activeSpecialtyVariant(document);
  setVariantInterviewTarget(document,variant.id,{
    mode:"specific",
    programName:"Mission University Residency",
    specialtyLabel:"Internal Medicine",
    interviewDate:"2026-10-14",
    location:"Boston, MA",
    label:"Mission interview"
  });
  const projected=applyActiveSpecialtyVariant(document);
  const rendered=renderKeynoteClassicBoard(projected,{currentMonth:"2026-07"});
  assert.match(rendered.svg,/data-event-kind="interview-marker"/);
  assert.match(rendered.svg,/Mission interview/);
  assert.match(rendered.svg,/Boston, MA/);
  const input=buildExportPreviewInput(projected,{});
  assert.equal(input.rendererOptions.interviewMonth,"2026-10-14");
  assert.equal(input.rendererOptions.interviewTarget.prog,"Mission University Residency");
});

test("M9 Matrix Calendar runtime is truthful and fixtures stay local-only",async()=>{
  const unavailable=await createUnavailableMatrixCalendarAdapter()
    .listScheduledInterviews();
  assert.equal(unavailable.status,"unavailable");
  assert.equal(unavailable.live,false);
  assert.deepEqual(unavailable.interviews,[]);
  assert.match(unavailable.message,/not connected in this local review/i);
  const fixture=await createFixtureMatrixCalendarAdapter([{
    id:"calendar-1",
    program:"Mission University",
    specialty:"Internal Medicine",
    dateTime:"2026-10-14T14:00:00-04:00",
    location:"Boston, MA",
    meeting:"Private meeting details"
  }]).listScheduledInterviews();
  assert.equal(fixture.status,"ready");
  assert.equal(fixture.live,false);
  assert.equal(fixture.interviews[0].category,"Scheduled Interviews");
  assert.equal(fixture.interviews[0].calendarEventId,"calendar-1");
});

test("M9 active 407F UI exposes controlled workflows and local logo reuse",async()=>{
  const [html,adapter,css]=await Promise.all([
    readFile(new URL("../web/index.html",import.meta.url),"utf8"),
    readFile(
      new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
      "utf8"
    ),
    readFile(new URL("../web/styles/407f-upgrade.css",import.meta.url),"utf8")
  ]);
  assert.match(html,/id="explanationBuilder407F"/);
  assert.match(html,/id="interviewConfig407F"/);
  assert.match(adapter,/BOUNDED ANNOTATION/);
  assert.match(adapter,/General timeline/);
  assert.match(adapter,/Specific interview/);
  assert.match(adapter,/LOCAL REVIEW · NO LIVE CONNECTION/);
  assert.match(adapter,/image\/png,image\/jpeg,image\/webp/);
  assert.match(adapter,/document\.advanced\.media\.push\(asset\)/);
  assert.match(adapter,/setVariantInterviewTarget/);
  assert.match(adapter,/advancedBoardRenderer\(timelineWithLorPresentation\(document\)/);
  assert.match(adapter,/panelAttributes\("coordinate"\)/);
  assert.match(adapter,/data-explanation-target-x/);
  assert.match(adapter,/data-explanation-target-y/);
  assert.match(adapter,/control\.setAttribute\("aria-invalid","true"\)/);
  assert.match(adapter,/data-interview-logo-error role="alert"/);
  assert.match(css,/\.m9BuilderTool\{/);
  assert.match(css,/\.m9BuilderTool input,[\s\S]*?min-height:44px/);
  assert.match(css,/\.m9BuilderTool \.canvas407FDetailCheck input,[\s\S]*?accent-color:var\(--gd\)/);
  assert.match(css,/input\[type="month"\]::\-webkit-calendar-picker-indicator/);
  assert.match(css,/\.m9ModeChoice input\[type="radio"\]\{[\s\S]*?appearance:none/);
  assert.match(css,/\.m9LogoUpload\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.m9LogoUpload:focus-within/);
});
