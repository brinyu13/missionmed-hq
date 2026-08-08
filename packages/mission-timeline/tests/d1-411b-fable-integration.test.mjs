import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import test from "node:test";

globalThis.window=globalThis;
const {projectTimelineDocument}=await import(
  "../web/js/d1-411a/domain-visual-adapter.js?d1-411b-contract"
);
const {createD1411AKernelManager}=await import(
  "../web/js/d1-411a/kernel-host.js?d1-411b-contract"
);
const {
  createAdvancedElement,
  createTextBlock,
  groupAdvancedObjects,
  ungroupAdvancedObjects,
  setAdvancedObjectLock,
  setAdvancedObjectAspectLock,
  ADVANCED_BUILT_IN_ASSETS
}=await import("../web/js/uxr-002/advanced-studio.js?rc1-editor-ux-004");

const webRoot=new URL("../web/",import.meta.url);

function sha256(bytes){return createHash("sha256").update(bytes).digest("hex");}

function timeline(){
  return{
    schemaVersion:"d1-timeline-document/1",
    id:"timeline-d1-411b",
    ownerId:"student-7",
    title:"Timeline: Dr. Fable Integration",
    studentProfile:{
      fullName:"Dr. Fable Integration",
      currentUsWorkAuthorization:"Permanent Resident",
      specialtyGoal:"Internal Medicine"
    },
    events:[
      {id:"degree",title:"Medical Degree",categoryId:"education",eventType:"duration",startDate:"2018-08",endDate:"2022-05",visibilityState:"INTERVIEWER_SAFE",fields:{}},
      {id:"step-2",title:"Step 2 CK",categoryId:"exams",eventType:"milestone",startDate:"2022-09",visibilityState:"INTERVIEWER_SAFE",fields:{}},
      {id:"rotation",title:"Internal Medicine Rotation",categoryId:"clinical",eventType:"duration",startDate:"2023-01",endDate:"2023-03",visibilityState:"ADVISOR_ONLY",fields:{}},
      {id:"research",title:"Outcomes Research",categoryId:"research",eventType:"duration",startDate:"2023-02",endDate:"2024-01",visibilityState:"INTERVIEWER_SAFE",fields:{}}
    ],
    exams:[],
    advanced:{media:[]},
    metadata:{interview:{}},
    presentationOverrides:{}
  };
}

test("D1-411B matches the Founder-authorized D1-411A protected presentation hashes",async()=>{
  const files={
    "D1-409H_FINAL_VISUAL_MASTER.html":"bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24",
    "D1-409H_VISUAL_MASTER.css":"4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7",
    "D1-409H_VISUAL_MASTER.js":"ed46fdf21588554aaaadbeaebacd81321177d45ad357c7e8cb8570a20786cb32"
  };
  for(const [name,expected] of Object.entries(files)){
    const bytes=await readFile(new URL(`presentation/d1-409h-a1/${name}`,webRoot));
    assert.equal(sha256(bytes),expected,name);
  }
});

test("D1-411B domain adapter maps TimelineDocument into the exact Fable render schema",()=>{
  const projected=projectTimelineDocument(timeline(),{revision:7,audience:"EVERYTHING"});
  assert.equal(projected.visualDocument.schemaVersion,"d1-411a/timeline-visual-document/1");
  assert.equal(projected.model.schemaVersion,"d1-409h-render-model/1");
  assert.equal(projected.model.documentId,"timeline-d1-411b");
  assert.equal(projected.model.revision,7);
  assert.deepEqual(projected.model.events.map(({id,cat})=>[id,cat]),[
    ["ev-degree","work"],
    ["ev-rotation","usce"],
    ["ev-research","res"]
  ]);
  assert.deepEqual(projected.model.flags.map(({id})=>id),["fl-step-2"]);
});

test("D1-411B preserves long visa values while fitting the protected profile photo exclusion",()=>{
  const document=timeline();
  document.studentProfile.currentUsWorkAuthorization="Permanent Resident / Green Card";
  const projection=projectTimelineDocument(document,{revision:1,audience:"EVERYTHING"});
  assert.equal(projection.visualDocument.student.visaStatus,"Permanent Resident\n/ Green Card");
  assert.equal(projection.model.profile.visaStatus,"Permanent Resident\n/ Green Card");
  assert.equal(document.studentProfile.currentUsWorkAuthorization,"Permanent Resident / Green Card");
});

test("D1-411B audience projection never sends advisor-only events to interviewer-safe rendering",()=>{
  const projected=projectTimelineDocument(timeline(),{audience:"INTERVIEWER_SAFE"});
  assert.equal(projected.model.events.some(({id})=>id==="ev-rotation"),false);
  assert.equal(projected.visualToDomain.get("ev-degree"),"degree");
  assert.equal(projected.domainToVisual.get("research"),"ev-research");
});

test("D1-411B media projection fails closed without a SHA-256-bound supported image",()=>{
  const document=timeline();
  document.advanced.media=[{
    id:"photo-unverified",type:"media",placed:true,
    source:{src:"blob:local-photo",type:"image/png",name:"photo.png"}
  }];
  const projected=projectTimelineDocument(document,{audience:"EVERYTHING"});
  assert.equal(projected.model.photos.length,0);
  assert.ok(projected.warnings.includes("MEDIA_HASH_UNAVAILABLE:photo-unverified"));
  assert.deepEqual(projected.dropped,[{id:"photo-unverified",reason:"unverified-media"}]);
});

test("D1-411B one kernel manager reuses an identical projection across surfaces",()=>{
  const manager=createD1411AKernelManager();
  const document=timeline();
  const home=manager.render(document,{surface:"home",audience:"EVERYTHING"});
  const builder=manager.render(document,{surface:"builder",audience:"EVERYTHING"});
  assert.equal(home.kind,"d1-411a-kernel");
  assert.equal(builder.kind,"d1-411a-kernel");
  assert.notEqual(home.projection,builder.projection);
  assert.deepEqual(home.projection.model,builder.projection.model);
  assert.equal(home.projection.model.revision,builder.projection.model.revision);
  assert.match(home.html,/data-surface="home"/);
  assert.match(builder.html,/data-surface="builder"/);
});

test("D1-411B assigns distinct render revisions to rapid mutations sharing updatedAt",()=>{
  const manager=createD1411AKernelManager();
  const first=timeline();
  first.updatedAt="2031-04-05T12:00:00.000Z";
  const second=structuredClone(first);
  second.events[0].title="Medical Degree — updated immediately";
  const before=manager.render(first,{surface:"edit",audience:"EVERYTHING"});
  const after=manager.render(second,{surface:"edit",audience:"EVERYTHING"});
  assert.notEqual(before.projection.model.revision,after.projection.model.revision);
  assert.notEqual(
    before.html.match(/data-kernel-token="([^"]+)/)?.[1],
    undefined
  );
  assert.equal(after.projection.model.events[0].t,"Medical Degree — updated immediately");
});

test("D1-411B empty audience state does not invoke a fallback renderer",()=>{
  const manager=createD1411AKernelManager();
  const document=timeline();
  document.events.forEach((event)=>{event.visibilityState="ADVISOR_ONLY";});
  const rendered=manager.render(document,{surface:"home",audience:"INTERVIEWER_SAFE"});
  assert.equal(rendered.kind,"d1-411a-empty");
  assert.doesNotMatch(rendered.html,/d1-timeline-kernel/);
  assert.match(rendered.html,/No timeline events are visible for this audience/);
});

test("D1-411B fails soft before the protected kernel for a milestone-only timeline",()=>{
  const manager=createD1411AKernelManager();
  const document=timeline();
  document.events=document.events.filter((event)=>event.eventType==="milestone");
  const rendered=manager.render(document,{surface:"edit",audience:"EVERYTHING"});
  assert.equal(rendered.projection.model.events.length,0);
  assert.equal(rendered.projection.model.flags.length,1);
  assert.equal(rendered.kind,"d1-411a-empty");
  assert.doesNotMatch(rendered.html,/d1-timeline-kernel/);
  assert.match(rendered.html,/No timeline events are visible for this audience/);
});

test("D1-411B active application routes five product surfaces and export through the same kernel",async()=>{
  const source=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
  assert.match(source,/createD1411AKernelManager\(\{/);
  assert.match(source,/createD1411AKernelExportAdapter\(\{kernelManager\}\)/);
  for(const surface of ["home","builder","full-preview","edit","export"]){
    assert.match(source,new RegExp(`surface[:=][^\\n]{0,80}["']${surface}["']|["']${surface}["'][^\\n]{0,80}surface`),surface);
  }
  assert.doesNotMatch(source,/createLocalExportAdapter\(/);
});

test("D1-411B kernel host destroys discarded kernels and exports from committed DOM",async()=>{
  const source=await readFile(new URL("js/d1-411a/kernel-host.js",webRoot),"utf8");
  assert.match(source,/this\._kernel\?\.destroy\?\.\(\)/);
  assert.match(source,/await element\.exportBoard\(\{/);
  assert.match(source,/renderer:"D1-409H-A1"/);
  assert.match(source,/format:format==="pdf"\?"png":format/);
  assert.match(source,/buildImagePdf\(\[/);
  assert.doesNotMatch(source,/serializeKeynoteClassicSvg|renderKeynoteClassicBoard/);
});

test("D1-411B direct presentation editor exposes only implemented handles and persists through the adapter",async()=>{
  const host=await readFile(new URL("js/d1-411a/kernel-host.js",webRoot),"utf8");
  const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
  assert.match(host,/_applyPresentationOverrides\(childDocument,record\)/);
  assert.match(host,/for\(const handle of \["w","e"\]\)/);
  assert.match(host,/marker\.dataset\.handle="se"/);
  assert.match(host,/data-axis-boundary-index/);
  assert.match(host,/new CustomEvent\("d1-411a:presentation-gesture"/);
  assert.match(adapter,/addEventListener\("d1-411a:presentation-gesture",onKernelPresentationGesture\)/);
  assert.match(adapter,/setAxisSegmentWeights\(range\.document,detail\.segmentWeights\)/);
  assert.match(adapter,/setColorKeyGeometryPresentationOverride\(store\.document,detail\.geometry\|\|\{\}\)/);
  assert.match(adapter,/selectedEventId:null,detailsEventId:null,advancedSelection:selection/);
});

test("D1-411B Advanced object pointer contract shows transient snap guides without rotation",async()=>{
  const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
  const styles=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");
  assert.match(adapter,/snapAdvancedObjectToBoard\(next,\{/);
  assert.match(adapter,/dataset\.advancedAlignmentGuides="true"/);
  assert.match(adapter,/dataset\.advancedAlignmentGuide="vertical"/);
  assert.match(adapter,/dataset\.advancedAlignmentGuide="horizontal"/);
  assert.match(adapter,/clearAdvancedAlignmentGuides\(pointer\.svg\)/);
  assert.match(adapter,/addEventListener\("pointercancel",onAdvancedPointerUp\)/);
  assert.match(styles,/\[data-advanced-alignment-guide\]/);
  assert.doesNotMatch(adapter,/advancedPointer[^\n]{0,120}rotat/i);
});

test("RC1 editor asset rail uses real local vector objects and supports durable grouping",()=>{
  const document=timeline();
  document.mode="advanced";
  document.advanced={
    media:[],
    textBlocks:[createTextBlock({id:"caption",text:"Caption",x:250,y:240,width:220,height:60})],
    elements:[createAdvancedElement({id:"callout",kind:"callout",x:180,y:180,width:360,height:150})],
    groups:[]
  };
  assert.ok(ADVANCED_BUILT_IN_ASSETS.shapes.some(({kind})=>kind==="callout"));
  assert.ok(ADVANCED_BUILT_IN_ASSETS.icons.some(({kind})=>kind==="hospital"));
  assert.ok(ADVANCED_BUILT_IN_ASSETS.flags.some(({kind})=>kind==="country-flag"));
  const grouped=groupAdvancedObjects(document,[
    {type:"element",id:"callout"},
    {type:"text",id:"caption"}
  ],{id:"caption-group"});
  assert.equal(grouped.changed,true);
  assert.equal(grouped.document.advanced.groups[0].children.length,2);
  assert.equal(grouped.document.advanced.elements[0].groupId,"caption-group");
  const locked=setAdvancedObjectLock(grouped.document,{type:"group",id:"caption-group"},true);
  assert.equal(locked.advanced.groups[0].locked,true);
  const proportionsUnlocked=setAdvancedObjectAspectLock(locked,{type:"group",id:"caption-group"},false);
  assert.equal(proportionsUnlocked.advanced.groups[0].locked,true);
  assert.equal(proportionsUnlocked.advanced.groups[0].aspectLocked,false);
  const ungrouped=ungroupAdvancedObjects(locked,"caption-group");
  assert.equal(ungrouped.changed,true);
  assert.equal(ungrouped.document.advanced.groups.length,0);
  assert.equal("groupId" in ungrouped.document.advanced.elements[0],false);
});

test("RC1 Brand library inserts an app-owned wordmark instead of a fake upload control",()=>{
  const wordmark=ADVANCED_BUILT_IN_ASSETS.brand.find(({id})=>id==="missionmed");
  assert.deepEqual(wordmark,{
    id:"missionmed",
    label:"MissionMed wordmark",
    symbol:"MM",
    kind:"missionmed-wordmark"
  });
  const object=createAdvancedElement({id:"brand-proof",kind:wordmark.kind,label:wordmark.label});
  assert.equal(object.kind,"missionmed-wordmark");
  assert.equal(object.width,320);
  assert.equal(object.height,88);
});

test("RC1 rail pointer bridge targets the protected shadow iframe and uses the declared asset action",async()=>{
  const adapter=await readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  assert.match(adapter,/dataset\.advancedAction\|\|"asset"/);
  assert.match(adapter,/shadowRoot\s*\?\.querySelector\?\.\("iframe"\)/);
  assert.match(adapter,/railAsset\.setPointerCapture\?\.\(event\.pointerId\)/);
  assert.doesNotMatch(adapter,/dataset\.advancedInsertAsset\|\|"asset"/);
});

test("RC1 protected text overlay enters direct edit before selection reconciliation",async()=>{
  const host=await readFile(new URL("../web/js/d1-411a/kernel-host.js",import.meta.url),"utf8");
  assert.match(host,/const beginTextEdit=\(node\)=>/);
  assert.match(host,/event\.detail>=2/);
  assert.match(host,/contentEditable="true"/);
  assert.match(host,/role","textbox"/);
  assert.match(host,/d1-411a:advanced-text-editing/);
  assert.match(host,/const snapMove=\(next,currentGesture\)=>/);
  assert.match(host,/d1411aSnapGuide/);
  assert.match(host,/profile-card-move/);
  assert.match(host,/profile-card-resize/);
  assert.match(host,/profileGeometry/);
  assert.match(host,/layoutRetryCount<4/);
  assert.match(host,/advancedBackgroundCss\(advanced\.background,record\.resolveObjectUrl\)/);
  assert.match(host,/if\(background\)board\.style\.background=background/);
  assert.match(host,/item\.kind==="missionmed-wordmark"/);
  assert.match(host,/overlay\.append\(style\)/);
  assert.doesNotMatch(host,/childDocument\.head\.append\(style\)/);
});

test("D1-411B server keeps top-level framing denied and allows only the protected same-origin kernel",async()=>{
  const source=await readFile(new URL("../scripts/serve.mjs",webRoot),"utf8");
  assert.match(source,/frame-ancestors 'none'/);
  assert.match(source,/pathname\.startsWith\("\/web\/presentation\/d1-409h-a1\/"\)/);
  assert.match(source,/frame-ancestors 'self'/);
  assert.match(source,/"x-frame-options": "SAMEORIGIN"/);
});
