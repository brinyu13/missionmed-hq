import test from "node:test";
import assert from "node:assert/strict";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {fillCanonicalMediaFrame,CANONICAL_MEDIA_FRAME_SLOTS} from "../web/js/uxr-002/advanced-studio.js";
import {captureMediaUploadBinding407F} from "../web/js/407f-engineering-adapter.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {applyActiveSpecialtyVariant,setVariantInterviewTarget,activeSpecialtyVariant,createSpecialtyVariant,switchSpecialtyVariant,syncInterviewLogoWell} from "../web/js/uxr-002/specialty-variants.js";
import {exportSlotOptions} from "../web/js/uxr-002/export-adapter.js";
import {isTimelineQaAccount,timelineAdminRosterCounts} from "../web/js/production/admin-workspace-022.js";

function timeline(){
  const document=defaultDocument({id:"doc-slots"});
  document.studentProfile.fullName="Avery Lane Synthetic";
  document.studentProfile.graduationDate="2026-05";
  document.events=[
    {id:"edu",title:"Medical Education",categoryId:"education",eventType:"duration",startDate:"2019-08",endDate:"2026-01",siteName:"Synthetic Medical College",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"EDUCATION"}},
    {id:"obs",title:"Clinical Observership",categoryId:"clinical",eventType:"duration",startDate:"2026-03",endDate:"2026-04",siteName:"Synthetic General Hospital",visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType:"OBSERVERSHIP",city:"Pittsburgh",state:"PA"}}
  ];
  document.metadata={renderCurrentMonth:"2026-10"};
  return document;
}
const slots=(svg)=>[...svg.matchAll(/data-frame-slot="([a-z0-9]+)"/g)].map((match)=>match[1]);

test("the five template slots and the interview ribbon are painted on every surface; prompts are labelled on screen and in the editable deck, blank in print",()=>{
  const document=timeline();
  const hidden=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE"}).svg;
  assert.equal(slots(hidden).length,0,"the default stays as before: empty frames are not painted unless asked");
  const labelled=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true}).svg;
  assert.deepEqual([...new Set(slots(labelled))].sort(),["logo","photo1","photo2","photo3","profile"]);
  for(const prompt of ["DROP PHOTO 1","DROP PHOTO 2","DROP PHOTO 3","PROFILE PHOTO","PROGRAM LOGO","Date pending","YOUR BIG INTERVIEW"])assert.ok(labelled.includes(prompt),prompt);
  const print=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true,emptySlotStyle:"print"}).svg;
  assert.deepEqual([...new Set(slots(print))].sort(),["logo","photo1","photo2","photo3","profile"],"print keeps the frames");
  for(const prompt of ["DROP PHOTO","PROFILE PHOTO","PROGRAM LOGO","Date pending"])assert.ok(!print.includes(prompt),`print omits the prompt ${prompt}`);
  assert.ok(print.includes("YOUR BIG INTERVIEW"),"the ribbon itself is template furniture");
  assert.ok(print.includes('data-photo-aperture="true" data-media-state="empty"'),"blank apertures remain for the printed polaroids");
});

test("a specific interview target paints the program name and date on the ribbon",()=>{
  const document=timeline();
  document.metadata.interview={programName:"Synthetic Medical Center IM",date:"2026-11-14",prog:"Synthetic Medical Center IM"};
  document.studentProfile.interviewSeason="2026-11";
  const svg=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true,emptySlotStyle:"print"}).svg;
  assert.ok(svg.includes("SYNTHETIC MEDICAL CENTER IM"));
  assert.ok(svg.includes("Interview · Nov 14, 2026"),"the scheduled date is shown on the ribbon");
});

test("canonical frames can be filled on the guided Timeline without an Advanced unlock, while free placement still requires it",()=>{
  const document={...defaultDocument({id:"doc-fill"}),mode:"guided",layoutLock:true,advanced:{media:[{id:"image-a",type:"media",kind:"image",source:{name:"synthetic.png",blobKey:"image-a"},libraryAsset:true,placed:false,x:0,y:0,width:300,height:180}],textBlocks:[],elements:[],groups:[]}};
  assert.equal(fillCanonicalMediaFrame(document,"photo1","image-a",{id:"frame-1"}).changed,false,"the Advanced contract is unchanged: a locked layout refuses by default");
  const filled=fillCanonicalMediaFrame(document,"photo1","image-a",{id:"frame-1",allowLocked:true});
  assert.equal(filled.changed,true);
  assert.equal(filled.document.mediaItems[0].placement,CANONICAL_MEDIA_FRAME_SLOTS.photo1.placement);
  assert.equal(filled.document.layoutLock,true,"filling a fixed frame never unlocks the layout");
  const store={document:{id:"doc-fill",studentOwnerId:"owner",mode:"guided",layoutLock:true},entitlement:{canMutate:true}};
  const binding=captureMediaUploadBinding407F(store,{frameSlot:"profile"});
  assert.equal(binding.frameSlot,"profile");
  assert.throws(()=>captureMediaUploadBinding407F(store,{placement:{x:100,y:100}}),/Unlock the canvas/);
  assert.throws(()=>captureMediaUploadBinding407F({...store,document:{...store.document,mode:"advanced",layoutLock:true}},{frameSlot:"profile"}),/Unlock the canvas|unavailable or locked/,"the Advanced canvas keeps its lock protection");
  assert.throws(()=>captureMediaUploadBinding407F(store,{frameSlot:"photo9"}),/unavailable or locked/);
});

test("the interview target's logo lives in the ribbon's logo well once that frame is filled; the free placement only serves an empty well",()=>{
  const base={...defaultDocument({id:"doc-logo"}),mode:"guided",layoutLock:true,advanced:{media:[{id:"logo-a",type:"media",kind:"image",source:{name:"logo.png",blobKey:"logo-a"},libraryAsset:true,placed:false,x:0,y:0,width:300,height:180}],textBlocks:[],elements:[],groups:[]}};
  const active=activeSpecialtyVariant(base);
  setVariantInterviewTarget(base,active.id,{...active.interviewTarget,mode:"specific",programName:"Synthetic Medical Center IM",interviewDate:"2026-11-14",logoMediaId:"logo-a"});
  const well=(base.mediaItems||[]).filter((item)=>item.placement==="ribbon");
  assert.deepEqual(well.map((item)=>item.mediaId),["logo-a"],"saving the destination's logo fills the well");
  const projected=applyActiveSpecialtyVariant(base);
  assert.equal(projected.advanced.media.find((item)=>item.id==="logo-a").placed,false,"the older free placement yields to the filled well");
  const legacy=structuredClone(base);legacy.mediaItems=[];
  assert.equal(applyActiveSpecialtyVariant(legacy).advanced.media.find((item)=>item.id==="logo-a").placed,true,"a document whose well was never synced keeps the free placement until the next target save");
  const svg=serializeFounderPresentation({...projected,events:timeline().events,studentProfile:{...projected.studentProfile,fullName:"Avery Lane Synthetic",graduationDate:"2026-05"},metadata:{...projected.metadata,renderCurrentMonth:"2026-10"}},{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true,mediaById:new Map([[well[0].id,"data:image/png;base64,iVBORw0KGgo="]])}).svg;
  assert.equal((svg.match(/data-program-logo="true"/g)||[]).length,1,"exactly one logo image is painted, inside the well");
  assert.ok(svg.includes('data-frame-slot="logo" data-media-state="filled"'));
});

const PIXEL="data:image/png;base64,iVBORw0KGgo=";
function destinationDocument(){
  const document={...timeline(),mode:"guided",layoutLock:true};
  document.advanced={...(document.advanced||{}),media:[
    {id:"logo-a",type:"media",kind:"image",source:{name:"a.png",blobKey:"logo-a"},libraryAsset:true,placed:false,x:0,y:0,width:300,height:180},
    {id:"logo-b",type:"media",kind:"image",source:{name:"b.png",blobKey:"logo-b"},libraryAsset:true,placed:false,x:0,y:0,width:300,height:180}
  ]};
  return document;
}
const wellLogo=(document)=>(applyActiveSpecialtyVariant(document).mediaItems||[]).filter((item)=>item.placement==="ribbon").map((item)=>item.mediaId);
const render=(document)=>serializeFounderPresentation(applyActiveSpecialtyVariant(document),{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true,mediaById:new Map((applyActiveSpecialtyVariant(document).mediaItems||[]).map((item)=>[item.id,PIXEL]))}).svg;

test("the Interview Day block is destination-specific: switching Program A → Program B leaves no stale program, date or logo",()=>{
  const document=destinationDocument();
  const a=activeSpecialtyVariant(document);
  setVariantInterviewTarget(document,a.id,{...a.interviewTarget,mode:"specific",programName:"Program A Internal Medicine",interviewDate:"2026-11-14",logoMediaId:"logo-a"});
  assert.deepEqual(wellLogo(document),["logo-a"],"the well carries A's logo once A's target is saved");
  let svg=render(document);
  assert.ok(svg.includes("PROGRAM A INTERNAL MEDICINE")&&svg.includes("Interview · Nov 14, 2026"));
  assert.equal((svg.match(/data-program-logo="true"/g)||[]).length,1);
  const created=createSpecialtyVariant(document,{specialtyId:"acgme:family-medicine",specialtyLabel:"Family Medicine",name:"Program B timeline"});
  assert.equal(created.ok,true);
  assert.deepEqual(wellLogo(document),[],"a new destination starts with an empty well; A's logo does not follow it");
  svg=render(document);
  assert.ok(!svg.includes("PROGRAM A")&&!svg.includes("Nov 14, 2026")&&!svg.includes('data-program-logo="true"'),"no stale Program A identity, date or logo");
  const b=activeSpecialtyVariant(document);
  setVariantInterviewTarget(document,b.id,{...b.interviewTarget,mode:"specific",programName:"Program B Family Medicine",interviewDate:"2026-12-02",logoMediaId:"logo-b"});
  assert.deepEqual(wellLogo(document),["logo-b"]);
  svg=render(document);
  assert.ok(svg.includes("PROGRAM B FAMILY MEDICINE")&&svg.includes("Interview · Dec 2, 2026")&&!svg.includes("PROGRAM A")&&!svg.includes("Nov 14, 2026"));
  assert.equal((svg.match(/data-program-logo="true"/g)||[]).length,1,"exactly B's logo");
  assert.ok(svg.includes('data-media-id="frame-logo-'+b.id+'-logo-b"'),"the painted logo is B's asset");
  assert.equal(switchSpecialtyVariant(document,a.id).ok,true);
  assert.deepEqual(wellLogo(document),["logo-a"],"switching back restores A's logo, not B's");
  svg=render(document);
  assert.ok(svg.includes("PROGRAM A INTERNAL MEDICINE")&&!svg.includes("PROGRAM B")&&!svg.includes("Dec 2, 2026"));
  // The non-mutating projection also protects a document whose persisted well still holds another destination's logo.
  const stale=structuredClone(document);
  stale.mediaItems=[...stale.mediaItems,{id:"frame-logo-stale",type:"logo",placement:"ribbon",mediaId:"logo-b",source:{name:"b.png",blobKey:"logo-b"},visibilityState:"INTERVIEWER_SAFE"}];
  assert.deepEqual(wellLogo(stale),["logo-a"],"another destination's logo is never projected");
  assert.equal(syncInterviewLogoWell(stale),true,"and the persisted sync removes it");
});

test("final PDF and PNG omit unfilled slots and their instructional wording; the editable deck keeps them as placeholders",()=>{
  assert.deepEqual(exportSlotOptions("PPTX"),{showEmptySlots:true,emptySlotStyle:"labelled"});
  assert.deepEqual(exportSlotOptions("PDF"),{showEmptySlots:false});
  assert.deepEqual(exportSlotOptions("PNG"),{showEmptySlots:false});
  const document=timeline();
  const final=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",...exportSlotOptions("PDF")}).svg;
  for(const wording of ["DROP PHOTO","PROFILE PHOTO","PROGRAM LOGO","Date pending"])assert.ok(!final.includes(wording),`final PDF never says ${wording}`);
  assert.equal(slots(final).length,0,"no empty frame is painted on the final page");
  assert.ok(!final.includes("YOUR BIG INTERVIEW"),"with no interview destination the final page carries no empty Interview Day block (live V1 behaviour)");
  const withTarget=timeline();withTarget.metadata.interview={programName:"Synthetic Medical Center IM",date:"2026-11-14",prog:"Synthetic Medical Center IM"};withTarget.studentProfile.interviewSeason="2026-11";
  const targeted=serializeFounderPresentation(withTarget,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",...exportSlotOptions("PDF")}).svg;
  assert.ok(targeted.includes("YOUR BIG INTERVIEW")&&targeted.includes("SYNTHETIC MEDICAL CENTER IM")&&targeted.includes("Interview · Nov 14, 2026"),"a chosen destination's program and date print");
  assert.ok(!targeted.includes("PROGRAM LOGO"),"an unfilled logo well prints the program name, never the prompt");
  const deck=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",...exportSlotOptions("PPTX")}).svg;
  for(const wording of ["DROP PHOTO 1","PROFILE PHOTO","PROGRAM LOGO"])assert.ok(deck.includes(wording),`the editable deck keeps ${wording}`);
});

test("photo and profile frames can only be filled from this document's own media library",()=>{
  const document={...defaultDocument({id:"doc-own"}),mode:"guided",layoutLock:true,advanced:{media:[{id:"mine",type:"media",kind:"image",source:{name:"mine.png",blobKey:"mine"},libraryAsset:true,placed:false,x:0,y:0,width:300,height:180}],textBlocks:[],elements:[],groups:[]}};
  assert.equal(fillCanonicalMediaFrame(document,"profile","someone-elses-asset",{id:"frame-x",allowLocked:true}).changed,false,"an asset that is not in this document's library is refused");
  const filled=fillCanonicalMediaFrame(document,"profile","mine",{id:"frame-profile-1",allowLocked:true});
  assert.equal(filled.changed,true);
  assert.equal(filled.document.mediaItems[0].mediaId,"mine");
  assert.equal(filled.document.mediaItems[0].source.blobKey,"mine","the frame binds to the asset's own blob key, which the export resolver re-verifies against the current document");
});

test("the admin roster names authorized QA accounts and never counts them as real students",()=>{
  assert.equal(isTimelineQaAccount("iiq1203_discovery_qa_20261003@example.invalid"),true);
  assert.equal(isTimelineQaAccount("student@example.com"),false);
  assert.equal(isTimelineQaAccount(""),false);
  const counts=timelineAdminRosterCounts({total:3,students:[{qaAccount:false},{qaAccount:true},{qaAccount:false}]});
  assert.deepEqual(counts,{qaAccounts:1,realStudents:2,pageOnly:false});
  assert.equal(timelineAdminRosterCounts({total:40,students:[{qaAccount:true}]}).pageOnly,true);
});
