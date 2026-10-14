// TL-AAA-STABILIZE-20261013 — Volunteer is a first-class category everywhere a
// student chooses a category, persisted as Work + volunteer source facts.
import assert from "node:assert/strict";
import test from "node:test";
import {IntakeStateMachine,applyApprovalBatchToDocument,renderIntake} from "../web/js/uxr-002/intake.js";
import {CATEGORIES} from "../web/js/uxr-002/constants.js";
import {categoriesWithVolunteer,chooserCategoryId,isVolunteerRecord,resolveChosenCategory,VOLUNTEER_CATEGORY_ID} from "../web/js/uxr-002/volunteer-category.js";
import {addCanvasEvent,swapCanvasEventCategory,renderAddEventPopover,createCanvasState} from "../web/js/uxr-002/canvas.js";
import {commitBuilderEntry,beginBuilderEntryEdit} from "../web/js/uxr-002/builder.js";
import {defaultDocument,migrateDocument} from "../web/js/uxr-002/store.js";
import {computeFounderCategoryKey,deriveFounderEventDisplay} from "../web/js/presentation/founder-display-rules.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {analyzeTimelineQuality} from "../web/js/uxr-002/quality-guardian.js";

const fixedClock=()=>new Date("2026-10-13T16:00:00.000Z");
function candidate(overrides={}){
  return{id:"cand-1",categoryId:"work",title:"Clinic volunteer",startDate:"2022-01",endDate:"2022-06",eventType:"duration",confidence:"high",
    sourceSnippet:"Volunteered at a family clinic from January through June.",fields:{organization:"Example Community Clinic"},...overrides};
}
async function reviewMachine(candidates,existingEvents=[]){
  const machine=new IntakeStateMachine({adapter:{capability:{mode:"local-test-adapter",productionReady:false,simulated:true,source:"synthetic-test"},async extract(){return{readable:true,candidates};}},existingEvents,clock:fixedClock,idFactory:(prefix)=>`${prefix}-generated`});
  machine.receiveFile({name:"Synthetic_CV.pdf",type:"application/pdf",size:1024,lastModified:1});machine.setConsent(true);await machine.startExtraction();return machine;
}
const storeFor=(document)=>({document,mutate(label,operation){operation(document);return true;}});

test("the review category chooser offers Volunteer after Work and shows it selected for imported volunteer work",async()=>{
  const choices=categoriesWithVolunteer(CATEGORIES).map(({id})=>id);
  assert.deepEqual(choices,["education","exams","clinical","work","volunteer","research","personal"]);
  const machine=await reviewMachine([candidate({fields:{organization:"Red Crescent",canonicalType:"VOLUNTEER_EXPERIENCE",experienceType:"Volunteer"}})]);
  machine.toggleEdit("cand-1");
  const html=renderIntake(machine.snapshot());
  assert.match(html,/<option value="volunteer" selected>Volunteer<\/option>/);
  assert.equal(chooserCategoryId(machine.snapshot().candidates[0]),VOLUNTEER_CATEGORY_ID);
});

test("choosing Volunteer in review persists Work + volunteer facts; choosing Work again removes the marker; approval paints the Volunteer key",async()=>{
  const machine=await reviewMachine([candidate()]);
  machine.editCandidate("cand-1",{categoryId:"volunteer"});
  let reviewed=machine.snapshot().candidates[0];
  assert.equal(reviewed.categoryId,"work");
  assert.equal(reviewed.fields.canonicalType,"VOLUNTEER_EXPERIENCE");
  assert.equal(reviewed.fields.experienceType,"Volunteer");
  assert.equal(reviewed.fields.categoryConfirmed,true);
  assert.equal(isVolunteerRecord(reviewed),true);
  machine.editCandidate("cand-1",{categoryId:"work"});
  reviewed=machine.snapshot().candidates[0];
  assert.equal(reviewed.categoryId,"work");
  assert.equal(reviewed.fields.canonicalType,"WORK_EXPERIENCE");
  assert.equal(isVolunteerRecord(reviewed),false);
  machine.editCandidate("cand-1",{categoryId:"volunteer"});
  machine.decideCandidate("cand-1","accepted");
  const document=migrateDocument(defaultDocument({id:"doc-volunteer"}));
  document.studentProfile.fullName="Synthetic Volunteer Student";
  await machine.approveAccepted({async saveVersion(){},async applyBatch(batch){return applyApprovalBatchToDocument(document,batch);}});
  const event=document.events.find((item)=>item.title==="Clinic volunteer");
  assert.ok(event,"approved volunteer candidate becomes an event");
  assert.equal(event.categoryId,"work");
  assert.equal(deriveFounderEventDisplay(document,event).categoryId,"volunteer");
  assert.ok(computeFounderCategoryKey(document).some((row)=>row.id==="volunteer"&&row.label==="Volunteer"),"dynamic key carries the Volunteer row");
  const {svg}=serializeFounderPresentation(document,{audience:"INTERVIEWER_SAFE",currentMonth:"2026-10",showEmptySlots:true,mediaById:new Map()});
  assert.match(svg,new RegExp(`data-event-kind="arrow" data-event-id="${event.id}"`));
  assert.match(svg,/stop-color="#307B72"/,"the arrow is painted in the Volunteer key colour");
  assert.match(svg,/data-board-ink-role="inside-arrow"[^>]*>Volunteer</,"the inside role reads Volunteer");
  assert.match(svg,/Volunteer<\/text>/);
  assert.doesNotMatch(analyzeTimelineQuality(document).findings.map((f)=>f.code).join(","),/CATEGORY/);
});

test("Edit Timeline canvas: Volunteer can be added and swapped, and swapping away clears the stale Volunteer override",()=>{
  const document=migrateDocument(defaultDocument({id:"doc-canvas"}));
  const store=storeFor(document);
  assert.match(renderAddEventPopover({...createCanvasState(),addEventOpen:true,entitlementEditable:true}),/data-add-category="volunteer"/);
  const added=addCanvasEvent(store,"volunteer",{idFactory:()=>"event-volunteer"});
  assert.equal(added.event.categoryId,"work");
  assert.equal(added.event.fields.canonicalType,"VOLUNTEER_EXPERIENCE");
  assert.equal(added.event.eventType,"duration");
  assert.equal(deriveFounderEventDisplay(document,added.event).categoryId,"volunteer");
  const swapped=swapCanvasEventCategory(store,"event-volunteer","research");
  assert.equal(swapped.categoryId,"research");
  const target=document.events.find(({id})=>id==="event-volunteer");
  assert.equal(target.categoryId,"research");
  assert.equal(isVolunteerRecord(target),false);
  assert.equal(deriveFounderEventDisplay(document,target).categoryId,"research");
  const back=swapCanvasEventCategory(store,"event-volunteer","volunteer");
  assert.equal(back.categoryId,"work");
  assert.equal(deriveFounderEventDisplay(document,target).categoryId,"volunteer");
});

test("Guided Mode work entry: Kind=Volunteer paints Volunteer; editing the kind back to Clinical removes the stale override",()=>{
  const document=migrateDocument(defaultDocument({id:"doc-builder"}));
  const draft={role:"Community health volunteer",organization:"Red Crescent Society",country:"Bangladesh",city:"Dhaka",kind:"Volunteer",startDate:"2021-03",endDate:"2021-09",current:false,description:""};
  const added=commitBuilderEntry(document,"work",draft,{idFactory:()=>"entry-v"});
  assert.equal(added.ok,true);
  assert.equal(document.presentationOverrides.events[added.event.id].categoryId,"volunteer");
  assert.equal(deriveFounderEventDisplay(document,added.event).categoryId,"volunteer");
  assert.equal(beginBuilderEntryEdit(document,added.event.id),true);
  const edited=commitBuilderEntry(document,"work",{...document.builder.drafts.work,kind:"Clinical"},{idFactory:()=>"entry-v"});
  assert.equal(edited.ok,true);
  assert.equal(document.presentationOverrides.events[edited.event.id]?.categoryId,undefined);
  assert.equal(deriveFounderEventDisplay(document,edited.event).categoryId,"work");
});

test("existing Work records are never reclassified unless the student chooses Volunteer",()=>{
  const work={id:"w1",categoryId:"work",title:"Medical officer",fields:{organization:"Square Hospital",canonicalType:"WORK_EXPERIENCE"}};
  assert.equal(isVolunteerRecord(work),false);
  assert.equal(chooserCategoryId(work),"work");
  const unchanged=resolveChosenCategory("work",work);
  assert.equal(unchanged.categoryId,"work");
  assert.deepEqual(unchanged.fields,work.fields);
});

// Release blocker: choosing a category and reviewing facts is one submitted edit.
test("Volunteer category normalization preserves simultaneous reviewed source corrections",async()=>{
  for(const selected of["volunteer","work","research"]){
    const machine=await reviewMachine([candidate({fields:{organization:"Original Clinic",canonicalType:"VOLUNTEER_EXPERIENCE",experienceType:"Volunteer"}})]);
    const before=machine.snapshot().candidates[0];
    machine.editCandidate("cand-1",{categoryId:selected,fields:{organization:"Reviewed Clinic",location:"Reviewed location"}});
    const after=machine.snapshot().candidates[0];
    assert.equal(after.fields.organization,"Reviewed Clinic",selected);
    assert.equal(after.fields.location,"Reviewed location",selected);
    assert.equal(after.title,before.title);
    assert.equal(after.startDate,before.startDate);
    assert.equal(after.endDate,before.endDate);
    assert.equal(after.sourceSnippet,before.sourceSnippet);
    assert.equal(after.categoryId,selected==="volunteer"?"work":selected);
    assert.equal(isVolunteerRecord(after),selected==="volunteer");
    assert.equal(before.fields.organization,"Original Clinic","previous source state remains immutable");
  }
});
