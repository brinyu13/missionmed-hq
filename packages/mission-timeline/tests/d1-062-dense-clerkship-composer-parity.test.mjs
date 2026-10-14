// TL-AAA-STABILIZE-20261013 (Ismat): saving several core clerkships froze the page.
// The repair touched only main-thread scheduling and solver bookkeeping, never the
// Founder composition itself. This test pins both halves:
//   1. the composed Founder SVG for deterministic 1..12-clerkship documents is byte-identical
//      to the pre-repair composer (SHA-256 recorded from the untouched release source);
//   2. the production adapter no longer forces a full recomposition on a draft blur or
//      composes the hidden canvas twice per saved rotation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {defaultDocument,migrateDocument} from "../web/js/uxr-002/store.js";

// Recorded from the release composer (web source 18487406281ae12d58c82604746c12a07f4cde61 lineage)
// with the deterministic CV-import-style documents below (titles such as "Clinical Clerkship" with
// the institution as siteName, exactly as the CV reader stores them). Regenerate only with a
// Founder-approved composer change. Guided "Role · Institution" titles, spans clamped before the
// year domain and arrows that begin in the domain's first month are intentionally repaired in this
// mission and covered by d1-065 instead (the search explores first-month placements, so a mixed
// document with an early-March span is excluded from this parity set).
const GOLDEN={
  "cv-clerkships-1":"c2cbd3b3840d7216",
  "cv-clerkships-2":"18589fab11a490cb",
  "cv-clerkships-3":"68a5f8196e490629",
  "cv-clerkships-4":"30fd2f1e43268083",
  "cv-clerkships-5":"fbb868af43b69277",
  "cv-clerkships-6":"7240049dc9ebd67a",
  "cv-clerkships-8":"636b7034353a6006",
  "cv-clerkships-10":"35a52aa259232d42",
  "cv-clerkships-12":"22784285b20b0306",
  "cv-mixed-6c-2v-1w-1r":"4e798d6958b6ecb6"
};

function cvDocument(n,{volunteer=0,work=0,research=0}={}){
  const document=defaultDocument({id:`cv-${n}-${volunteer}-${work}-${research}`});
  document.studentProfile.fullName="Ismat Example";document.studentProfile.medicalSchool="Dhaka Medical College";document.studentProfile.degree="MBBS";document.studentProfile.graduationDate="2022-06";
  const hospitals=["Hackensack University Medical Center","Jersey Shore University Medical Center","Robert Wood Johnson University Hospital","Newark Beth Israel Medical Center","Saint Peter's University Hospital","Morristown Medical Center","Overlook Medical Center","Cooper University Hospital","Jefferson Health","Mount Sinai Hospital","NYU Langone Health","Northwell Health"];
  const cities=["Hackensack, NJ","Neptune, NJ","New Brunswick, NJ","Newark, NJ","New Brunswick, NJ","Morristown, NJ","Summit, NJ","Camden, NJ","Philadelphia, PA","New York, NY","New York, NY","Manhasset, NY"];
  const kinds=[["Clinical Clerkship","CLERKSHIP"],["Clinical Observership","OBSERVERSHIP"],["Clinical Elective","USCE_TEACHING_HOSPITAL"]];
  const events=[
    {id:"edu",title:"Medical Education",categoryId:"education",eventType:"duration",startDate:"2016-01",endDate:"2022-06",openEnded:false,visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"EDUCATION"}},
    {id:"degree",title:"M.B.,B.S.",categoryId:"education",eventType:"milestone",startDate:"2022-06",endDate:null,siteName:"Dhaka Medical College",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"MEDICAL_DEGREE"}},
    {id:"ecfmg",title:"ECFMG Certification",categoryId:"exams",eventType:"milestone",startDate:"2025-05",endDate:null,visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"ECFMG_CERTIFICATION"}}
  ];
  for(let i=0;i<n;i++){const start=2024*12+i*2,[title,canonicalType]=kinds[i%3];const y=s=>`${Math.floor(s/12)}-${String(s%12+1).padStart(2,"0")}`;
    events.push({id:`rot-${i+1}`,title,categoryId:"clinical",eventType:"duration",startDate:y(start),endDate:y(start+1),openEnded:false,siteName:hospitals[i%hospitals.length],visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType,cityState:cities[i%cities.length]}});}
  for(let i=0;i<volunteer;i++)events.push({id:`vol-${i+1}`,title:"Volunteer",categoryId:"work",eventType:"duration",startDate:`202${i+2}-03`,endDate:`202${i+2}-09`,openEnded:false,siteName:"Red Crescent Society",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"VOLUNTEER_EXPERIENCE",experienceType:"Volunteer",organization:"Red Crescent Society",city:"Dhaka",country:"Bangladesh"}});
  for(let i=0;i<work;i++)events.push({id:`work-${i+1}`,title:"Medical Officer",categoryId:"work",eventType:"duration",startDate:`202${i+2}-08`,endDate:`202${i+3}-01`,openEnded:false,siteName:"Square Hospital",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"WORK_EXPERIENCE",city:"Dhaka",country:"Bangladesh"}});
  for(let i=0;i<research;i++)events.push({id:`res-${i+1}`,title:"Research Assistant",categoryId:"research",eventType:"duration",startDate:`202${i+2}-07`,endDate:`202${i+3}-06`,openEnded:false,siteName:"Bangabandhu Sheikh Mujib Medical University",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"RESEARCH_EXPERIENCE",city:"Dhaka",country:"Bangladesh"}});
  document.events=events;
  return migrateDocument(document);
}
const compose=(document)=>serializeFounderPresentation(document,{audience:"INTERVIEWER_SAFE",currentMonth:"2026-10",resourceNamespace:"bench",showEmptySlots:true,emptySlotStyle:"labelled",mediaById:new Map()}).svg;
const sha=(svg)=>createHash("sha256").update(svg).digest("hex").slice(0,16);

test("dense clerkship documents compose byte-identically to the release composer",()=>{
  const corpus=[1,2,3,4,5,6,8,10,12].map((n)=>[`cv-clerkships-${n}`,cvDocument(n)]);
  corpus.push(["cv-mixed-6c-2v-1w-1r",cvDocument(6,{volunteer:2,work:1,research:1})]);
  for(const [name,document] of corpus){
    assert.equal(sha(compose(document)),GOLDEN[name],`${name} composition drifted from the release composer`);
  }
});

test("twelve saved clerkships still compose within a student-tolerable bound",()=>{
  const document=cvDocument(12);
  compose(document); // warm
  const started=performance.now();compose(document);const elapsed=performance.now()-started;
  // Pre-repair this document cost well over this bound on the production path (two full
  // compositions per save plus a forced recomposition on every draft blur).
  assert.ok(elapsed<8000,`12-clerkship composition took ${Math.round(elapsed)}ms`);
});

test("the production adapter no longer forces recomposition on draft commits or composes the hidden canvas twice",()=>{
  const source=fs.readFileSync(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  const domain=source.match(/const commitDomainMutationNow=\(label,mutation,\{render=true\}=\{\}\)=>\{([\s\S]*?)\n  \};/);
  const exam=source.match(/const commitExamMutationNow=\(label,mutation,\{render=true\}=\{\}\)=>\{([\s\S]*?)\n  \};/);
  assert.ok(domain&&exam,"production commit seams are present");
  for(const [name,body] of [["domain",domain[1]],["exam",exam[1]]]){
    assert.doesNotMatch(body,/queueBuilderEmbeddedPreview\(\{force:true\}\)/,`${name} commit must not force a full recomposition`);
    assert.match(body,/if\(bridge\.state\.view==="canvas"\)renderCanvasForDocument\(\)/,`${name} commit composes the canvas only while it is shown`);
  }
  // Entering Edit Timeline after wizard saves recomposes the canvas exactly when it is stale.
  assert.match(source,/if\(view==="canvas"\)\{\n\s*renderCanvasResponsiveNotice\(\);\n\s*renderCanvasIfStale\(\);/);
  assert.match(source,/const renderCanvasIfStale=\(\)=>\{if\(canvasController&&timelineRenderSignature\(store\.document\)!==canvasComposedSignature\)renderCanvasForDocument\(\);\};/);
  // The preview queue coalesces bursts and marks the wizard busy while it recomposes.
  assert.match(source,/builderPreviewForcePending=builderPreviewForcePending\|\|force;/);
  assert.match(source,/host\.dataset\.builderPreviewUpdating="true";host\.setAttribute\("aria-busy","true"\)/);
  // The signature gate must consider every composer input that a Guided save can change.
  const signature=source.match(/export function timelineRenderSignature\(document\)\{\n  return JSON\.stringify\(\{([\s\S]*?)\n  \}\);/);
  assert.ok(signature,"render signature seam present");
  for(const field of ["exams","layoutLock","rotationLor","examReviewCorrections","aiExamReviewQueue","presentationMonth"])assert.match(signature[1],new RegExp(`\\b${field}\\b`),`render signature covers ${field}`);
});
