// TL-AAA-STABILIZE-20261013: Guardian passes reuse identical compositions and painted
// resolutions. The memo is exact-key; results must be equal for repeated input, must not be
// shared across different measureText functions, and the report must not depend on whether
// the memo was warm.
import test from "node:test";
import assert from "node:assert/strict";
import {resolveFounderPresentationSvg,materialPresentationCollisions} from "../web/js/presentation/resolved-founder-presentation.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {analyzeTimelineQuality,applySafeQualityFixes,resolveConciseLabels} from "../web/js/uxr-002/quality-guardian.js";
import {defaultDocument,migrateDocument} from "../web/js/uxr-002/store.js";

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
const denseDocument=()=>cvDocument(8,{work:1,research:1});
const strip=(value)=>JSON.parse(JSON.stringify(value,(key,item)=>key==="checkedAt"?undefined:item));

test("resolving the same markup twice yields equal paint; a different measureText never shares a result",()=>{
  const rendered=serializeFounderPresentation(denseDocument(),{scope:"FULL_STORY"});
  const first=resolveFounderPresentationSvg(rendered.svg),second=resolveFounderPresentationSvg(rendered.svg);
  assert.deepEqual(second.nodes.map(n=>[n.id,n.kind,n.bounds]),first.nodes.map(n=>[n.id,n.kind,n.bounds]));
  assert.equal(materialPresentationCollisions(second).length,materialPresentationCollisions(first).length);
  const wide=(text,size)=>String(text).length*size*0.9;
  const measured=resolveFounderPresentationSvg(rendered.svg,{measureText:wide});
  assert.notEqual(measured,first,"a custom measureText is a different input");
  const widths=(paint)=>paint.nodes.filter(n=>n.kind==="text").map(n=>n.bounds.width);
  assert.notDeepEqual(widths(measured),widths(first));
  assert.deepEqual(widths(resolveFounderPresentationSvg(rendered.svg,{measureText:wide})),widths(measured));
});

test("a Guardian pass reports identically whether its memo is cold or warm, and safe fixes still qualify",()=>{
  const document=denseDocument();
  const cold=analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"});
  const warm=analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"});
  assert.deepEqual(strip(warm),strip(cold));
  assert.ok(cold.findings.some(f=>f.code==="TEXT_CONTAINER_OVERFLOW"),"eight two-month CV rotations beside a job and a research year overflow their full labels: "+cold.findings.map(f=>f.code).join(","));
  const resolved=resolveConciseLabels(document);
  assert.ok(resolved.proposals.length>0&&resolved.after<resolved.before,"concise labels reduce overflow");
  const fixed=applySafeQualityFixes(document,cold);
  assert.ok(fixed.changed);
  assert.deepEqual(strip(analyzeTimelineQuality(fixed.document,{stage:"AFTER_SAFE_FIX"})),strip(fixed.review));
  // The input document is never mutated by a pass.
  const snapshot=JSON.stringify(document);
  analyzeTimelineQuality(document,{stage:"BEFORE_EXPORT"});resolveConciseLabels(document);
  assert.equal(JSON.stringify(document),snapshot);
});
