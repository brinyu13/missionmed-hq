import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {createMedicalSchoolProvider} from "../web/js/uxr-002/medical-school-registry.js";
import {QUALITY_GUARDIAN_BASES,analyzeTimelineQuality,renderQualityGuardian} from "../web/js/uxr-002/quality-guardian.js";
import {EXTRACTION_STATUSES} from "../web/js/uxr-002/intake.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {photoFrameGeometry} from "../web/js/uxr-002/locked-407f-export.js";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const us=JSON.parse(await read("../web/data/medical-schools/us-dapip-2026-07-30.json"));
const global=JSON.parse(await read("../web/data/medical-schools/global-wikidata-2026-08-24.json"));
const supplement=JSON.parse(await read("../web/data/medical-schools/global-img-supplement-2026-09-05.json"));
const css=await read("../web/styles/407f-upgrade.css");
const adapter=await read("../web/js/407f-engineering-adapter.js");
const canvas=await read("../web/js/uxr-002/canvas.js");
const renderer=await read("../web/js/uxr-002/locked-407f-export.js");
const studio=await read("../web/js/uxr-002/advanced-studio.js");
const html=await read("../web/index.html");

/* ---------- Global IMG school search (10) ---------- */

test("AAA-019 curated IMG supplement is identity-only and makes the common IMG schools findable",async()=>{
  assert.equal(supplement.manifest.kind,"curated-supplement");
  assert.equal(supplement.manifest.verification_law.identity_only,true);
  assert.equal(supplement.manifest.verification_law.accreditation_asserted,false);
  assert.ok(supplement.records.length>=120);
  assert.equal(supplement.records.every((record)=>record.analytics_eligible===false),true);
  assert.equal(supplement.records.every((record)=>record.verification_status==="curated-identity-unverified-accreditation"),true);
  assert.equal(new Set(supplement.records.map((record)=>record.canonical_school_id)).size,supplement.records.length,"ids are unique");
  // Every override targets a canonical name that really exists in the Wikidata set.
  const wikidataNames=new Set(global.records.map((record)=>record.canonical_name));
  const overrides=supplement.manifest.overrides.by_canonical_name;
  for(const name of [...Object.keys(overrides.aliases),...Object.keys(overrides.cities)]){
    assert.ok(wikidataNames.has(name),`override target must exist: ${name}`);
  }
  const provider=createMedicalSchoolProvider({
    urls:["us","global","supplement"],
    fetcher:async(url)=>({us,global,supplement})[url]
  });
  const expect=async(query,pattern,country)=>{
    const [first]=await provider.search(query,{limit:1});
    assert.match(first?.canonical_name||"",pattern,`${query} → ${first?.canonical_name}`);
    if(country)assert.equal(first.country,country);
  };
  await expect("Semmelweis",/Semmelweis/,"Hungary");
  await expect("Debrecen",/Debrecen/,"Hungary");
  await expect("Carol Davila",/Carol Davila/,"Romania");
  await expect("Karolinska",/Karolinska/,"Sweden");
  await expect("Sapienza",/Sapienza/,"Italy");
  await expect("UBA",/Buenos Aires/,"Argentina");
  await expect("AUC",/American University of the Caribbean/,"Sint Maarten");
  await expect("Saba",/Saba University/);
  await expect("SGU",/Saint George's University School of Medicine/,"Grenada");
  await expect("Pecs",/Pécs/,"Hungary");
  // City overrides correct a wrong Wikidata city without changing the identity.
  const [trinity]=await provider.search("Trinity School of Medicine",{limit:1});
  assert.equal(trinity.city,"Ratho Mill");
  assert.ok(trinity.canonical_school_id.startsWith("mm-school-wikidata-"));
  const metadata=await provider.metadata();
  assert.equal(metadata.sourceCount,3);
  assert.ok(metadata.countryCount>=130);
});

test("AAA-019 the supplement is a registered runtime asset in both build pipelines",async()=>{
  for(const script of ["../scripts/build-static.mjs","../scripts/build-wordpress-runtime.mjs"]){
    assert.match(await read(script),/data\/medical-schools\/global-img-supplement-2026-09-05\.json/);
  }
});

/* ---------- Real AI / Guardian (08) ---------- */

test("AAA-019 Guardian chips read SOURCE FACT / MISSIONMED RULE / AI REVIEW / FOUNDER STANDARD and never claim AI without a provider result",()=>{
  assert.deepEqual(Object.values(QUALITY_GUARDIAN_BASES),["SOURCE FACT","MISSIONMED RULE","AI REVIEW","FOUNDER STANDARD"]);
  const report=analyzeTimelineQuality({
    events:[{id:"a",title:"Award",categoryId:"work",eventType:"milestone",startDate:"2025-06",endDate:"2024-06",visibilityState:"INTERVIEWER_SAFE",sourceType:"ai",confidence:.2,provenance:[]}],
    advanced:{background:null}
  });
  const rendered=renderQualityGuardian(report,{viewer:"student"});
  assert.match(rendered,/SOURCE FACT/);
  assert.match(rendered,/FOUNDER STANDARD/);
  assert.doesNotMatch(rendered,/AI REVIEW/);
  assert.doesNotMatch(rendered,/AI INFERENCE|PRESENTATION RECOMMENDATION/);
});

/* ---------- Real-time preview loading states (11) ---------- */

test("AAA-019 extraction narration speaks the student's language, in order, without engineering vocabulary",()=>{
  assert.deepEqual(EXTRACTION_STATUSES,[
    "Reading your CV…",
    "Finding your education and training…",
    "Matching dates…",
    "Organizing your experiences…",
    "Building your Timeline…",
    "Checking spacing and readability…"
  ]);
  for(const status of EXTRACTION_STATUSES)assert.doesNotMatch(status,/pars|token|OCR|adapter|extract|JSON|API/i);
});

/* ---------- Media, frames, crop (06) ---------- */

test("AAA-019 Founder frames are real objects: every slot is addressable, filled frames crop in SVG, geometry overrides are clamped",()=>{
  const svg=serializeFounderPresentation({
    version:1,events:[],studentProfile:{fullName:"Synthetic Student"},
    mediaItems:[{id:"m1",type:"photo",placement:"photo2",url:"data:image/png;base64,AAAA",crop:{x:70,y:30,zoom:2},naturalAspect:1.5}]
  },{scope:"INTERVIEWER_SAFE",currentMonth:"2027-01"}).svg;
  for(const slot of ["profile","photo1","photo2","photo3","logo"]){
    assert.match(svg,new RegExp(`data-frame-slot="${slot}"`),slot);
  }
  assert.match(svg,/data-frame-slot="photo2" data-media-state="filled" data-media-id="m1"/);
  assert.match(svg,/data-crop-zoom="2" data-crop-x="70" data-crop-y="30"/);
  assert.match(svg,/data-frame-slot="photo1" data-media-state="empty"/);
  const moved=photoFrameGeometry({founderPresentation:{photoFrames:{"2":{x:-50,y:2000,width:9999,height:10,rotation:400}}}},1);
  assert.equal(moved.x,0);
  assert.equal(moved.width,1920);
  assert.equal(moved.height,60);
  assert.equal(moved.y,1020);
  assert.equal(moved.rotation,45);
  // Nested crop viewports mean layers must be appended before the outer </svg>, not the first one.
  assert.match(renderer,/lastIndexOf\("<\/svg>"\)/);
});

/* ---------- Editor interaction repairs (05) + Canva parity (03) ---------- */

test("AAA-019 the selection engine owns every Canva keyboard verb and the context menu / quick-bar dispatch through it",()=>{
  for(const symbol of [
    "nudgeAdvancedSelection","layerAdvancedSelection","duplicateAdvancedSelection","deleteAdvancedSelection",
    "groupAdvancedSelection","ungroupAdvancedSelection","lockAdvancedSelection","copyAdvancedSelection",
    "pasteAdvancedClipboard","beginAdvancedTextEdit","openAdvancedContextMenu","mountAdvancedQuickBar",
    "beginAdvancedCrop","commitAdvancedCrop","cancelAdvancedCrop","fillAdvancedFrame","clearAdvancedFrame"
  ])assert.match(adapter,new RegExp(`const ${symbol}=`),symbol);
  // Escape must reach the engine even when the canvas kernel already handled the key.
  assert.match(adapter,/onAdvancedSelectionKeyDown\(event,\{force:true\}\)/);
  assert.match(adapter,/event\.__advancedSelectionHandled/);
  // Right-click is captured on the canvas host, not the document, so the browser menu never wins on the board.
  assert.match(adapter,/canvasHost\.addEventListener\("contextmenu",onAdvancedContextMenu,true\)/);
  // A rail tile drag never captures the pointer (capture would swallow the drop target).
  assert.doesNotMatch(adapter,/data-advanced-insert-asset[\s\S]{0,400}setPointerCapture/);
});

test("AAA-019 in-place text editing hides the SVG glyphs under a geometry-matched editor and commits on focus-out",()=>{
  assert.match(canvas,/data-advanced-text-editing-style/);
  assert.match(canvas,/\[data-advanced-text="\$\{escapeHtml\(block\.id\)\}"\]\{opacity:0\}/);
  assert.match(canvas,/data-canvas-text-done/);
  assert.match(canvas,/onFocusOut/);
  assert.match(css,/container-type:inline-size/);
});

test("AAA-019 Layers panel lists board objects with reorder and the selection drawer keeps the browsed panel open",()=>{
  assert.match(studio,/\{id:"layers",label:"Layers",icon:"≡"\}/);
  assert.match(studio,/export function advancedLayerRows/);
  assert.match(studio,/data-advanced-selection-drawer/);
  assert.match(studio,/onLayerReorder/);
});

/* ---------- StoryForge shell polish (02/08) ---------- */

test("AAA-019 CTA hit-area law: the parallelogram is decoration on ::before, the button keeps its rectangle and is its own containing block",()=>{
  assert.match(css,/\.btnD,button\.btnD,label\.btnD,a\.btnD\{[^}]*clip-path:none/);
  assert.match(css,/\.btnD,button\.btnD,label\.btnD,a\.btnD\{[^}]*position:relative/);
  assert.match(css,/\.btnD::before\{[^}]*clip-path:polygon\(6% 0,100% 0,94% 100%,0 100%\)/);
  // The MEDIA launcher used to reset position:static, which let ::before span the toolbar.
  assert.doesNotMatch(css,/\.media407FCanvasLauncher\{[^}]*position:static/);
  // Application chrome is not text-selectable — a drag across the header or rail never selects copy.
  assert.match(css,/\.d1404Header,\n#rail,\n\.canvas407FHost \.canvas-toolbar\{\n  -webkit-user-select:none;\n  user-select:none;/);
});

test("AAA-019 Home always shows the canonical board and the Rescue front door",()=>{
  assert.match(html,/id="homeRescue"/);
  assert.match(html,/id="homeRescueFile"/);
  assert.match(html,/Your board is ready\./);
  assert.match(adapter,/renderHomePreview/);
});

/* ---------- Canva smart guides (03) ---------- */

test("AAA-019 a dragged object snaps to peer edges and centres, board wins ties, and guides report the peer line",async()=>{
  const {snapAdvancedObjectToBoard}=await import("../web/js/uxr-002/advanced-studio.js");
  const dragged={id:"a",x:507,y:300,width:200,height:100};
  const peer={x:500,y:600,width:300,height:120};
  const snapped=snapAdvancedObjectToBoard(dragged,{peers:[peer],threshold:12});
  assert.equal(snapped.element.x,500,"left edge aligns with the peer's left edge");
  assert.equal(snapped.guides.vertical.target,"object-vertical");
  assert.equal(snapped.guides.vertical.position,500);
  assert.equal(snapped.guides.horizontal,null,"no horizontal candidate within threshold");
  const centred=snapAdvancedObjectToBoard({id:"b",x:855,y:100,width:200,height:100},{peers:[{x:600,y:0,width:710,height:50}],threshold:12});
  // The dragged centre (955) already sits on the peer's centre (955, delta 0); the board centre (960, delta 5) is further, so the peer guide is reported and nothing moves.
  assert.equal(centred.element.x,855);
  assert.equal(centred.guides.vertical.target,"object-vertical");
  const unchanged=snapAdvancedObjectToBoard({id:"c",x:300,y:300,width:100,height:100},{peers:[{x:900,y:900,width:50,height:50}],threshold:12});
  assert.equal(unchanged.element.x,300);
  assert.equal(unchanged.guides.vertical,null);
  assert.match(adapter,/peers:advancedSnapPeers\(advancedPointer\)/);
});
