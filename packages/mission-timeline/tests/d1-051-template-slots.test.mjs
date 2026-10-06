import test from "node:test";
import assert from "node:assert/strict";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {fillCanonicalMediaFrame,CANONICAL_MEDIA_FRAME_SLOTS} from "../web/js/uxr-002/advanced-studio.js";
import {captureMediaUploadBinding407F} from "../web/js/407f-engineering-adapter.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {applyActiveSpecialtyVariant,setVariantInterviewTarget,activeSpecialtyVariant} from "../web/js/uxr-002/specialty-variants.js";

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
  const free=applyActiveSpecialtyVariant(base);
  assert.equal(free.advanced.media.find((item)=>item.id==="logo-a").placed,true,"an empty well keeps the existing free placement");
  const filled=fillCanonicalMediaFrame(base,"logo","logo-a",{id:"frame-logo-1",allowLocked:true}).document;
  const projected=applyActiveSpecialtyVariant(filled);
  assert.equal(projected.advanced.media.find((item)=>item.id==="logo-a").placed,false,"the free placement yields to the filled well");
  const svg=serializeFounderPresentation({...projected,events:timeline().events,studentProfile:{...projected.studentProfile,fullName:"Avery Lane Synthetic",graduationDate:"2026-05"},metadata:{...projected.metadata,renderCurrentMonth:"2026-10"}},{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE",showEmptySlots:true,mediaById:new Map([["frame-logo-1","data:image/png;base64,iVBORw0KGgo="]])}).svg;
  assert.equal((svg.match(/data-program-logo="true"/g)||[]).length,1,"exactly one logo image is painted, inside the well");
  assert.ok(svg.includes('data-frame-slot="logo" data-media-state="filled"'));
});
