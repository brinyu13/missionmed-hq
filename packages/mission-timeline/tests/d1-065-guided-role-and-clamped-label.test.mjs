// TL-AAA-STABILIZE-20261013 (Ismat core clerkships / first-class Volunteer):
//   1. A Guided Builder rotation or job is titled "Role · Institution" for its saved-entry
//      list. The Founder board paints the role inside the arrow and the institution beside
//      it, so the inside-arrow text must not repeat the institution. Six two-month core
//      clerkships in one year must compose with no overflowing label and no Guardian fix.
//   2. A span clamped to the left edge (it began before the Founder year domain) paints its
//      role beside the stub instead of overflowing inside it, so a pre-graduation Volunteer
//      experience never blocks export with text nothing can shorten.
import test from "node:test";
import assert from "node:assert/strict";
import {deriveFounderEventDisplay} from "../web/js/presentation/founder-display-rules.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {resolveFounderPresentationSvg,materialPresentationCollisions} from "../web/js/presentation/resolved-founder-presentation.js";
import {analyzeTimelineQuality,applySafeQualityFixes} from "../web/js/uxr-002/quality-guardian.js";
import {defaultDocument,migrateDocument} from "../web/js/uxr-002/store.js";
import {commitBuilderEntry,eventFromBuilderEntry} from "../web/js/uxr-002/builder.js";

function guidedDocument(){
  let seq=0;const idFactory=(prefix="id")=>`${prefix}-${String(++seq).padStart(4,"0")}`;
  const document=defaultDocument({id:"guided-core"});
  document.studentProfile.fullName="Guided Example";document.studentProfile.medicalSchool="Dhaka Medical College";document.studentProfile.degree="MBBS";document.studentProfile.graduationDate="2023-06";
  const hospitals=["Hackensack University Medical Center","Jersey Shore University Medical Center","Robert Wood Johnson University Hospital","Newark Beth Israel Medical Center","Saint Peter's University Hospital","Morristown Medical Center"];
  const specialties=["Internal Medicine","General Surgery","Pediatrics","Obstetrics and Gynecology","Psychiatry","Family Medicine"];
  hospitals.forEach((institution,i)=>{const mm=String(i*2+1).padStart(2,"0"),end=String(i*2+2).padStart(2,"0");
    const r=commitBuilderEntry(document,"clinical",{institution,specialty:specialties[i],specialtyId:"acgme:"+specialties[i].toLowerCase().replace(/[^a-z0-9]+/g,"-"),rotationType:"Clerkship (core)",city:"Newark",state:"NJ",rotationStartDate:`2024-${mm}-01`,rotationEndDate:`2024-${end}-28`,startDate:`2024-${mm}`,endDate:`2024-${end}`,rotationDatePrecision:"day",current:false,preceptor:"",lorStatus:"not-requested",notes:""},{idFactory});
    if(r?.ok===false)throw new Error(JSON.stringify(r));});
  const work=commitBuilderEntry(document,"work",{role:"Medical Officer",organization:"Square Hospital",country:"Bangladesh",city:"Dhaka",kind:"Clinical",startDate:"2023-08",endDate:"2023-12",current:false,description:""},{idFactory});
  if(work?.ok===false)throw new Error(JSON.stringify(work));
  return migrateDocument(document);
}
const overflowing=(paint)=>paint.nodes.filter(n=>n.kind==="text"&&n.sourceAttributes["data-text-overflow"]==="true");

test("Guided rotation and job titles keep 'Role · Institution', but the painted role is the role alone",()=>{
  const document=guidedDocument();
  const rotation=document.events.find(event=>event.categoryId==="clinical");
  assert.equal(rotation.title,"Internal Medicine · Hackensack University Medical Center","the saved-entry title is unchanged");
  const display=deriveFounderEventDisplay(document,rotation);
  assert.equal(display.role,"Internal Medicine");
  assert.equal(display.institution,"Hackensack University Medical Center");
  const job=document.events.find(event=>event.categoryId==="work");
  assert.equal(job.title,"Medical Officer · Square Hospital");
  assert.equal(deriveFounderEventDisplay(document,job).role,"Medical Officer");
  // A short-name institution is the suffix the Builder writes; it is removed too.
  const short=eventFromBuilderEntry("clinical",{institution:"Mount Sinai Hospital",institutionShortName:"Mount Sinai",specialty:"Pediatrics",rotationStartDate:"2025-10-01",rotationEndDate:"2025-10-28",startDate:"2025-10",endDate:"2025-10"},{entryId:"e",eventId:"short"});
  assert.equal(short.title,"Pediatrics · Mount Sinai");
  assert.equal(deriveFounderEventDisplay({events:[short]},short).role,"Pediatrics");
  // Titles that merely contain a separator, or a CV-imported title, are untouched.
  const imported={id:"cv",title:"Clinical Clerkship",siteName:"Jersey Shore University Medical Center",categoryId:"clinical",fields:{canonicalType:"CLERKSHIP",specialty:"Surgery"}};
  assert.equal(deriveFounderEventDisplay({events:[imported]},imported).role,"Clerkship");
  const custom={id:"custom",title:"Research · Teaching Fellow",siteName:"BSMMU",categoryId:"research",fields:{}};
  assert.equal(deriveFounderEventDisplay({events:[custom]},custom).role,"Research · Teaching Fellow");
  // A student's own display override still wins.
  assert.equal(deriveFounderEventDisplay({...document,presentationOverrides:{events:{[rotation.id]:{role:"IM"}}}},rotation).role,"IM");
});

test("six Guided core clerkships in one year compose with readable arrows and export-ready Guardian state",()=>{
  const document=guidedDocument();
  const rendered=serializeFounderPresentation(document,{scope:"FULL_STORY",currentMonth:"2026-10"});
  const paint=resolveFounderPresentationSvg(rendered.svg);
  // Only the longest specialty name can still exceed a two-month arrow; the Guardian offers
  // its Keynote short form ("OB/GYN"). Before this repair all six labels overflowed with no fix.
  assert.deepEqual(overflowing(paint).map(n=>n.text),["Obstetrics and Gynecology"]);
  assert.equal(materialPresentationCollisions(paint).length,0);
  const inside=paint.nodes.filter(n=>n.kind==="text"&&n.sourceAttributes["data-board-ink-role"]==="inside-arrow").map(n=>n.text);
  assert.deepEqual(inside.sort(),["Family Medicine","General Surgery","Internal Medicine","Medical Officer","Obstetrics and Gynecology","Pediatrics","Psychiatry"]);
  const report=analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"});
  const overflow=report.findings.find(f=>f.code==="TEXT_CONTAINER_OVERFLOW");
  assert.equal(overflow?.actionMode,"FIX_FOR_ME",report.findings.map(f=>f.code).join(","));
  const fixed=applySafeQualityFixes(document,report);
  assert.ok(fixed.changed);
  assert.equal(fixed.review.exportReady,true,fixed.review.findings.map(f=>f.code).join(","));
  const fixedPaint=resolveFounderPresentationSvg(serializeFounderPresentation(fixed.document,{scope:"FULL_STORY",currentMonth:"2026-10"}).svg);
  assert.equal(overflowing(fixedPaint).length,0);
  assert.ok(fixedPaint.nodes.some(n=>n.kind==="text"&&n.text==="OB/GYN"));
});

test("a Volunteer span clamped to the left edge paints its role beside the stub and never blocks export",()=>{
  const document=migrateDocument({...defaultDocument({id:"clamped"}),studentProfile:{fullName:"Clamped Example",medicalSchool:"Dhaka Medical College",degree:"MBBS",graduationDate:"2022-06"},
    events:[
      {id:"edu",title:"Medical Education",categoryId:"education",eventType:"duration",startDate:"2016-01",endDate:"2022-06",openEnded:false,visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"EDUCATION"}},
      {id:"degree",title:"M.B.,B.S.",categoryId:"education",eventType:"milestone",startDate:"2022-06",endDate:null,siteName:"Dhaka Medical College",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"MEDICAL_DEGREE"}},
      {id:"vol",title:"Volunteer",categoryId:"work",eventType:"duration",startDate:"2019-03",endDate:"2021-12",openEnded:false,siteName:"Red Crescent Society",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"VOLUNTEER_EXPERIENCE",experienceType:"Volunteer",organization:"Red Crescent Society",city:"Dhaka",country:"Bangladesh"}},
      {id:"work",title:"Medical Officer",categoryId:"work",eventType:"duration",startDate:"2022-08",endDate:"2023-12",openEnded:false,siteName:"Square Hospital",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"WORK_EXPERIENCE",city:"Dhaka",country:"Bangladesh"}}
    ]});
  const rendered=serializeFounderPresentation(document,{scope:"FULL_STORY",currentMonth:"2026-10"});
  const paint=resolveFounderPresentationSvg(rendered.svg);
  const label=paint.nodes.find(n=>n.kind==="text"&&n.semanticRef==="vol"&&/arrow/.test(n.sourceAttributes["data-board-ink-role"]||""));
  assert.ok(label,"the clamped Volunteer still paints its role");
  assert.equal(label.text,"Volunteer");
  assert.equal(label.sourceAttributes["data-arrow-label-placement"],"outside-right");
  assert.notEqual(label.sourceAttributes["data-text-overflow"],"true");
  assert.ok(label.bounds.x>=0&&label.bounds.x+label.bounds.width<=1920,"the role is on the page");
  assert.equal(overflowing(paint).length,0);
  assert.equal(materialPresentationCollisions(paint).length,0);
  // The Volunteer row is painted in the Volunteer key colour and the key lists it.
  assert.match(rendered.svg,/Volunteer<\/text>/);
  const report=analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"});
  assert.ok(!report.findings.some(f=>["TEXT_CONTAINER_OVERFLOW","PRESENTATION_TEXT_OFF_CANVAS"].includes(f.code)),report.findings.map(f=>f.code).join(","));
});

test("a Guided Volunteer entry carries the CV volunteer source facts and paints like an imported one",()=>{
  const document=defaultDocument({id:"guided-volunteer"});
  document.studentProfile.fullName="Guided Volunteer";document.studentProfile.medicalSchool="Dhaka Medical College";document.studentProfile.degree="MBBS";document.studentProfile.graduationDate="2022-06";
  let seq=0;const idFactory=(prefix="id")=>`${prefix}-${String(++seq).padStart(4,"0")}`;
  const saved=commitBuilderEntry(document,"work",{role:"Vaccination camp coordinator",organization:"Red Crescent Society",country:"Bangladesh",city:"Dhaka",kind:"Volunteer",startDate:"2020-01",endDate:"2020-06",current:false,description:""},{idFactory});
  assert.equal(saved.ok,true);
  const job=commitBuilderEntry(document,"work",{role:"Medical Officer",organization:"Square Hospital",country:"Bangladesh",city:"Dhaka",kind:"Clinical",startDate:"2022-08",endDate:"2023-12",current:false,description:""},{idFactory});
  assert.equal(job.ok,true);
  const event=document.events.find(item=>item.fields?.kind==="Volunteer");
  assert.equal(event.categoryId,"work","Volunteer stays a Work-domain record");
  assert.equal(event.fields.canonicalType,"VOLUNTEER_EXPERIENCE");
  assert.equal(event.fields.experienceType,"Volunteer");
  assert.equal(event.title,"Vaccination camp coordinator · Red Crescent Society","the saved-entry title keeps the student's wording");
  const migrated=migrateDocument(document);
  const display=deriveFounderEventDisplay(migrated,event);
  assert.equal(display.role,"Volunteer");
  assert.equal(display.categoryId,"volunteer");
  assert.equal(display.institution,"Red Crescent Society");
  const rendered=serializeFounderPresentation(migrated,{scope:"FULL_STORY",currentMonth:"2026-10"});
  const years=[...rendered.svg.matchAll(/data-axis-segment-id="(\d{4})"/g)].map(m=>m[1]);
  assert.equal(years[0],"2022","a pre-graduation volunteer span paints from the left edge instead of reopening 2020, exactly like a CV-imported one");
  assert.match(rendered.svg,/#307B72/i,"painted in the Volunteer key colour");
  const paint=resolveFounderPresentationSvg(rendered.svg);
  assert.equal(overflowing(paint).length,0);
  assert.equal(analyzeTimelineQuality(migrated,{stage:"BEFORE_EXPORT"}).exportReady,true);
  // Editing the same entry back to Clinical removes the volunteer facts and the key colour.
  const edited=commitBuilderEntry(document,"work",{role:"Vaccination camp coordinator",organization:"Red Crescent Society",country:"Bangladesh",city:"Dhaka",kind:"Clinical",startDate:"2020-01",endDate:"2020-06",current:false,description:""},{entryId:saved.entryId,idFactory});
  assert.equal(edited.ok,true);
  const reverted=document.events.find(item=>item.id===event.id);
  assert.equal(reverted.fields.canonicalType,undefined);
  assert.equal(deriveFounderEventDisplay(migrateDocument(document),reverted).categoryId,"work");
});

test("an arrow that begins in the first month of the year domain keeps its institution under the arrow, never one letter per line",()=>{
  const document=migrateDocument({...defaultDocument({id:"first-month"}),studentProfile:{fullName:"First Month",medicalSchool:"Harborview International Medical School",degree:"MD",graduationDate:"2023-05"},
    events:[
      {id:"edu",title:"Medical Education",categoryId:"education",eventType:"duration",startDate:"2017-08",endDate:"2023-05",openEnded:false,visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"EDUCATION"}},
      {id:"degree",title:"M.D.",categoryId:"education",eventType:"milestone",startDate:"2023-05",endDate:null,siteName:"Harborview International Medical School",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"MEDICAL_DEGREE"}},
      {id:"vol",title:"Volunteer",categoryId:"work",eventType:"duration",startDate:"2023-01",endDate:"2023-06",openEnded:false,siteName:"Red Crescent Society",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"VOLUNTEER_EXPERIENCE",experienceType:"Volunteer",organization:"Red Crescent Society",country:"Bangladesh"}},
      {id:"scribe",title:"Medical Scribe",categoryId:"work",eventType:"duration",startDate:"2023-11",endDate:"2024-07",openEnded:false,siteName:"Lakeside Emergency Associates",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"WORK_EXPERIENCE",city:"Chicago",state:"IL"}},
      {id:"obs",title:"Clinical Observership",categoryId:"clinical",eventType:"duration",startDate:"2024-02",endDate:"2024-03",openEnded:false,siteName:"Lakeside Community Hospital",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"OBSERVERSHIP",cityState:"Chicago, IL"}}
    ]});
  const rendered=serializeFounderPresentation(document,{scope:"FULL_STORY",currentMonth:"2026-10"});
  const paint=resolveFounderPresentationSvg(rendered.svg);
  const site=paint.nodes.filter(n=>n.kind==="text"&&n.semanticRef==="vol"&&/site|location/.test(n.sourceAttributes["data-board-ink-role"]||""));
  assert.ok(site.length,"the institution is painted");
  assert.ok(site.every(n=>n.sourceAttributes["data-text-overflow"]!=="true"&&!/\n/.test(n.text)),"no stacked single letters: "+site.map(n=>JSON.stringify(n.text)).join(" "));
  assert.ok(site.some(n=>/Red Crescent Society/.test(n.text)),"the full institution name is readable");
  assert.equal(overflowing(paint).length,0);
  assert.equal(analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"}).exportReady,true);
});
