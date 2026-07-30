import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  BUILDER_PREVIEW_ZOOM_PRESETS,
  enhanceBuilderPreviewSvg,
  resolveBuilderPreviewOwner
} from "../web/js/uxr-002/builder-preview.js";
import {renderKeynoteClassicBoard} from "../web/js/uxr-002/board-renderer.js";
import {namespaceBoardSvg} from "../web/js/407f-engineering-adapter.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(
  new URL("js/407f-engineering-adapter.js",webRoot),
  "utf8"
);
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function event(overrides={}){
  return{
    id:"event",
    title:"Timeline event",
    categoryId:"work",
    eventType:"duration",
    startDate:"2023-01",
    endDate:"2023-06",
    openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",
    fields:{builderDomain:"work",builderEntryId:"work-entry"},
    ...overrides
  };
}

function documentWith(events){
  return{
    studentProfile:{
      fullName:"Amara Osei",
      interviewSeason:"2026-09"
    },
    metadata:{
      interview:{
        prog:"Mission University",
        date:"2026-09",
        label:"Interview"
      }
    },
    events
  };
}

test("M4 replaces the legacy Wizard renderer with one canonical shared preview mount",()=>{
  assert.doesNotMatch(index,/renderBoard\('boardWizard'/);
  assert.match(adapter,/advancedBoardRenderer\(store\.document,\{/);
  assert.match(adapter,/audience:"INTERVIEWER_SAFE"/);
  assert.match(adapter,/namespace:"d1-405-builder-embedded"/);
  assert.match(adapter,/namespace:"d1-405-builder-lightbox"/);
  assert.match(adapter,/mountBuilderPreview\(canvas,\{/);
});

test("M4 freezes the embedded and lightbox geometry to a true contained 16:9 board",()=>{
  assert.match(css,/\.builderPreviewViewport\{[\s\S]*?aspect-ratio:16\/9/);
  assert.match(css,/\.builderPreview407FViewport\{[\s\S]*?aspect-ratio:16\/9/);
  assert.match(css,/\.builderPreviewSurface svg\{[\s\S]*?height:100%[\s\S]*?width:100%/);
  assert.doesNotMatch(
    css,
    /\.builderPreviewViewport(?:\s|,)[\s\S]{0,220}min-height:(?:460|540)px/
  );
  assert.deepEqual(
    BUILDER_PREVIEW_ZOOM_PRESETS.map(({id})=>id),
    ["fit","100","150"]
  );
});

test("M4 preserves canonical 1920x1080 geometry and adds stable interactive ownership",()=>{
  const timeline=documentWith([
    event(),
    event({
      id:"exam-event",
      title:"Step 2 CK",
      categoryId:"exams",
      eventType:"milestone",
      startDate:"2024-06",
      endDate:null,
      fields:{builderDomain:"exams",builderEntryId:"exam-attempt-1"}
    })
  ]);
  const rendered=renderKeynoteClassicBoard(timeline,{currentMonth:"2026-07"});
  const svg=enhanceBuilderPreviewSvg(rendered.svg,timeline);
  assert.match(svg,/viewBox="0 0 1920 1080"/);
  assert.match(svg,/width="1920" height="1080"/);
  assert.match(svg,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(svg,/role="group"/);
  assert.match(
    svg,
    /data-event-id="event" data-builder-preview-event data-owner-kind="builder-entry" data-owner-id="work-entry" data-owner-order="\d+" role="button" tabindex="0"/
  );
  assert.match(
    svg,
    /data-event-id="exam-event" data-builder-preview-event data-owner-kind="exam-attempt" data-owner-id="exam-attempt-1" data-owner-order="\d+" role="button" tabindex="-1"/
  );
  assert.match(
    svg,
    /data-event-kind="interview-marker" data-builder-preview-interview data-owner-kind="interview-target"/
  );
});

test("M4 places the interview marker in chronological keyboard order",()=>{
  const timeline=documentWith([
    event({
      id:"later-event",
      startDate:"2027-01",
      endDate:"2027-06"
    })
  ]);
  timeline.metadata.interview.date="2026-09";
  const rendered=renderKeynoteClassicBoard(timeline,{currentMonth:"2027-07"});
  const svg=enhanceBuilderPreviewSvg(rendered.svg,timeline);
  assert.match(
    svg,
    /data-event-kind="interview-marker"[^>]*data-owner-order="0"[^>]*tabindex="0"/
  );
  assert.match(
    svg,
    /data-event-id="later-event"[^>]*data-owner-order="1"[^>]*tabindex="-1"/
  );
});

test("M4 namespaces SVG definitions without corrupting canonical event ownership IDs",()=>{
  const svg=namespaceBoardSvg(
    '<svg aria-labelledby="title"><title id="title">Timeline</title><g data-event-id="event-1"></g></svg>',
    "embedded"
  );
  assert.match(svg,/id="embedded-title"/);
  assert.match(svg,/aria-labelledby="embedded-title"/);
  assert.match(svg,/data-event-id="event-1"/);
  assert.doesNotMatch(svg,/data-event-id="embedded-event-1"/);
});

test("M4 resolves exact Core, exam, domain, publication, and interview owners without preview state",()=>{
  const events=[
    event({
      id:"education-core",
      categoryId:"education",
      eventType:"milestone",
      endDate:null,
      fields:{builderEntryId:"education"}
    }),
    event({
      id:"exam-event",
      categoryId:"exams",
      eventType:"milestone",
      endDate:null,
      fields:{builderDomain:"exams",builderEntryId:"exam-attempt-1"}
    }),
    event(),
    event({
      id:"research-base",
      categoryId:"research",
      fields:{builderDomain:"research",builderEntryId:"research-entry"}
    }),
    event({
      id:"publication-marker",
      categoryId:"research",
      eventType:"milestone",
      endDate:null,
      fields:{
        builderDomain:"research",
        builderEntryId:"research-entry",
        publicationMilestone:true
      }
    })
  ];
  const timeline=documentWith(events);
  assert.equal(resolveBuilderPreviewOwner(timeline,{
    ownerKind:"core-education",
    ownerId:"education",
    eventId:"education-core"
  }).step,1);
  assert.equal(resolveBuilderPreviewOwner(timeline,{
    ownerKind:"exam-attempt",
    ownerId:"exam-attempt-1",
    eventId:"exam-event"
  }).focusSelector,'[data-exam-card="exam-attempt-1"]');
  assert.deepEqual(
    {
      step:resolveBuilderPreviewOwner(timeline,{
        ownerKind:"builder-entry",
        ownerId:"work-entry",
        eventId:"event"
      }).step,
      eventId:resolveBuilderPreviewOwner(timeline,{
        ownerKind:"builder-entry",
        ownerId:"research-entry",
        eventId:"publication-marker"
      }).eventId
    },
    {step:4,eventId:"research-base"}
  );
  assert.equal(resolveBuilderPreviewOwner(timeline,{
    ownerKind:"interview-target",
    ownerId:"interview-target"
  }).step,7);
  assert.equal(resolveBuilderPreviewOwner(timeline,{
    ownerKind:"builder-entry",
    ownerId:"missing",
    eventId:"missing"
  }),null);
});

test("M4 uses one delegated pointer and keyboard activation path with roving focus and exact editor focus",()=>{
  assert.match(adapter,/document\.addEventListener\("click",onBuilderPreviewInteraction\)/);
  assert.match(adapter,/document\.addEventListener\("keydown",onBuilderPreviewInteraction\)/);
  assert.match(adapter,/\["Enter"," "\]\.includes\(event\.key\)/);
  assert.match(adapter,/moveBuilderPreviewFocus/);
  assert.match(adapter,/beginBuilderEntryEdit\(document,route\.eventId\)/);
  assert.match(adapter,/history:false,material:false/);
  assert.match(adapter,/data-exam-card=/);
  assert.match(adapter,/data-domain-form=/);
  assert.match(adapter,/button:not\(:disabled\):not\(\[data-exam-delete\]\)/);
});

test("M4 lightbox owns Fit, 100%, 150%, focus restoration, Escape, backdrop, and one zoom scrollport",()=>{
  assert.match(adapter,/BUILDER_PREVIEW_ZOOM_PRESETS\.map/);
  assert.match(adapter,/builderPreviewTrap=installFocusTrap/);
  assert.match(adapter,/onEscape:\(\)=>closeBuilderPreview\(\{restoreFocus:false\}\)/);
  assert.match(adapter,/onBuilderPreviewBackdrop/);
  assert.match(adapter,/previewBackgroundInert\(true\)/);
  assert.match(css,/builderPreview407FCanvas\[data-zoom-mode="percent"\]/);
  assert.match(css,/builderPreview407FViewport:has\(/);
});
