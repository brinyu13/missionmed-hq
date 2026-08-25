import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  FOUNDER_COLOR_KEY_ROWS,
  FOUNDER_KEYNOTE_CONTRACT,
  FOUNDER_KEYNOTE_GOLDEN_NAMESPACE
} from "../web/js/presentation/founder-keynote-contract.js";
import {
  FOUNDER_PRESENTATION_SERIALIZER,
  serializeFounderPresentation,
  serializeFounderPresentationAsync
} from "../web/js/presentation/founder-presentation-serializer.js";
import {
  TIMELINE_SCENE_SCHEMA,
  TIMELINE_SCENE_VERSION
} from "../web/js/editor/scene-graph.js";
import {timelineLastGoodRenderCache} from "../web/js/presentation/last-good-render-cache.js";
import {canonicalBoardPreview} from "../web/js/uxr-002/preview.js";

const fixtureRoot=new URL("./fixtures/d1-timeline-founder-reanchor-015/",import.meta.url);
const fixtureBytes=await readFile(new URL("synthetic-founder-geometry.json",fixtureRoot));
const fixture=JSON.parse(fixtureBytes);
const manifest=JSON.parse(await readFile(new URL("manifest.json",fixtureRoot),"utf8"));
const boardBytes=await readFile(new URL(
  "../web/assets/founder_keynote_2024/background/Magnetboard-1920-107.jpg",
  import.meta.url
));
const usaFlagBytes=await readFile(new URL(
  "../web/assets/founder_keynote_2024/flags/USA-Flag.H03-10831.png",
  import.meta.url
));
const sha256=(value)=>createHash("sha256").update(value).digest("hex");

test("Founder golden namespace binds synthetic geometry to immutable Keynote evidence without publishing imagery",()=>{
  assert.equal(FOUNDER_KEYNOTE_CONTRACT.namespace,FOUNDER_KEYNOTE_GOLDEN_NAMESPACE);
  assert.deepEqual(FOUNDER_KEYNOTE_CONTRACT.canvas,{
    width:1920,
    height:1080,
    orientation:"landscape"
  });
  assert.equal(manifest.authority.sourceSha256,FOUNDER_KEYNOTE_CONTRACT.source.sha256);
  assert.equal(manifest.authority.verifiedPngSha256,FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pngSha256);
  assert.equal(manifest.authority.verifiedPdfSha256,FOUNDER_KEYNOTE_CONTRACT.verifiedEvidence.pdfSha256);
  assert.equal(manifest.authority.boardAsset.path,FOUNDER_KEYNOTE_CONTRACT.assets.board.publicPath);
  assert.equal(manifest.authority.boardAsset.sha256,FOUNDER_KEYNOTE_CONTRACT.assets.board.sha256);
  assert.equal(sha256(boardBytes),FOUNDER_KEYNOTE_CONTRACT.assets.board.sha256);
  assert.equal(manifest.authority.usaFlagAsset.path,FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.publicPath);
  assert.equal(manifest.authority.usaFlagAsset.sha256,FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.sha256);
  assert.equal(sha256(usaFlagBytes),FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.sha256);
  assert.equal(sha256(fixtureBytes),manifest.fixture.sha256);
  assert.equal(manifest.fixture.contentPolicy,"SYNTHETIC_ONLY");
  assert.equal(manifest.fixture.founderImageryPublished,false);
  assert.equal(manifest.acceptance.founderVisualAcceptanceRequired,true);
  assert.equal(manifest.acceptance.pixelFidelityClaim,false);
});

test("one deterministic portable serializer supplies preview/export composition defaults",()=>{
  const first=serializeFounderPresentation(fixture,{
    scope:"INTERVIEWER_SAFE",
    currentMonth:"2027-01"
  });
  const second=serializeFounderPresentation(fixture,{
    scope:"INTERVIEWER_SAFE",
    currentMonth:"2027-01"
  });
  assert.equal(first.serializer,FOUNDER_PRESENTATION_SERIALIZER);
  assert.equal(first.svg,second.svg);
  assert.equal(sha256(first.svg),manifest.serializer.syntheticSvgSha256);
  assert.match(first.svg,/viewBox="0 0 1920 1080"/);
  assert.match(first.svg,/data-founder-canvas="1920x1080"/);
  assert.match(first.svg,new RegExp(`data-founder-keynote-source-sha256="${FOUNDER_KEYNOTE_CONTRACT.source.sha256}"`));
  assert.match(first.svg,/data-board-background="true"/);
  assert.match(first.svg,/data-founder-board-template="true"/);
  assert.match(first.svg,new RegExp(`data-founder-board-asset-sha256="${FOUNDER_KEYNOTE_CONTRACT.assets.board.sha256}"`));
  assert.match(first.svg,/data-axis-language="407f-powerpoint"/);
  assert.match(first.svg,/data-continuous-duration-arrow="true"/);
  assert.match(first.svg,/data-founder-milestone-style="usa"/);
  assert.match(first.svg,new RegExp(`data-founder-usa-flag-asset-sha256="${FOUNDER_KEYNOTE_CONTRACT.assets.usaFlag.sha256}"`));
  assert.match(first.svg,/data-founder-geometry="648,0,596,83"/);
  assert.match(first.svg,/data-founder-geometry="37,350,247,277"/);
  assert.match(first.svg,/data-founder-geometry="30,677,512,375"/);
  assert.match(first.svg,/data-founder-geometry="599,776,176,235,-10"/);
  assert.match(first.svg,/data-founder-geometry="753,884,223,140,-6"/);
  assert.match(first.svg,/data-founder-geometry="992,878,233,175,0"/);
  assert.match(first.svg,/M[^ ]+ 125H/);
  assert.match(first.svg,/font-family="'American Typewriter',Rockwell,'Courier New',serif" font-size="36"/);
  assert.match(first.svg,/font-family="Futura,'Trebuchet MS',Arial,sans-serif" font-size="23"/);
  assert.match(first.svg,/font-family="Baskerville,'Iowan Old Style','Times New Roman',serif" font-size="18"/);
  assert.equal((first.svg.match(/data-color-key-row=/g)||[]).length,FOUNDER_COLOR_KEY_ROWS.length);
  const keyOrder=[...first.svg.matchAll(/data-category-id="([^"]+)"/g)].map((match)=>match[1]);
  assert.deepEqual(keyOrder.slice(0,6),[
    "work","personal","exams","clinical-hospital","clinical-clinic","research"
  ]);
  assert.match(first.svg,/data-canonical-row-count="6"/);
  assert.match(first.svg,/data-artifact-chrome="profile"/);
  assert.equal((first.svg.match(/data-artifact-photo-frame=/g)||[]).length,3);
  assert.doesNotMatch(first.svg,/<foreignObject/);
});

test("mounted Founder surfaces namespace SVG resources without changing deterministic export defaults",()=>{
  const edit=serializeFounderPresentation(fixture,{
    scope:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    resourceNamespace:"timeline-edit"
  });
  const exportPreview=serializeFounderPresentation(fixture,{
    scope:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    resourceNamespace:"timeline-export"
  });
  assert.match(edit.svg,/id="d1406-timeline-edit-board"/);
  assert.match(edit.svg,/fill="url\(#d1406-timeline-edit-board\)"/);
  assert.match(edit.svg,/id="d1406-timeline-edit-axis"/);
  assert.match(edit.svg,/fill="url\(#d1406-timeline-edit-axis\)"/);
  assert.match(exportPreview.svg,/id="d1406-timeline-export-board"/);
  assert.match(exportPreview.svg,/fill="url\(#d1406-timeline-export-board\)"/);
  assert.notEqual(edit.svg,exportPreview.svg);
  assert.equal(
    serializeFounderPresentation(fixture,{scope:"INTERVIEWER_SAFE",currentMonth:"2027-01"}).svg,
    serializeFounderPresentation(fixture,{scope:"INTERVIEWER_SAFE",currentMonth:"2027-01"}).svg
  );
});

test("real media occupies canonical profile, photo, and logo slots while missing media remains fail-soft",async()=>{
  const media="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrWQAAAAASUVORK5CYII=";
  const document={
    ...fixture,
    mediaItems:[
      {id:"profile",type:"profilePhoto",visibility:"INTERVIEWER_SAFE",durableUrl:media},
      {id:"photo-1",type:"photo",placement:"photo0",visibility:"INTERVIEWER_SAFE",durableUrl:media},
      {id:"logo",type:"logo",visibility:"INTERVIEWER_SAFE",durableUrl:media},
      {id:"private-photo",type:"photo",visibility:"ADVISOR_ONLY",durableUrl:media}
    ]
  };
  const rendered=serializeFounderPresentation(document,{scope:"INTERVIEWER_SAFE",currentMonth:"2027-01"});
  assert.match(rendered.svg,/data-media-id="profile"/);
  assert.match(rendered.svg,/data-media-id="photo-1"/);
  assert.match(rendered.svg,/data-media-id="logo"/);
  assert.doesNotMatch(rendered.svg,/data-media-id="private-photo"/);

  const failed=await serializeFounderPresentationAsync(document,{
    scope:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    mediaResolver:async()=>{throw new Error("synthetic missing object");}
  });
  assert.match(failed.svg,/data-artifact-photo-frame="1"/);
  assert.match(failed.svg,/data-artifact-chrome="profile"/);
  assert.match(failed.svg,/data-board-background="true"/);
});

test("canonical preview mounts the shared serializer and retains the last complete board after a failed update",()=>{
  const surfaceKey="founder-reanchor-last-good-test";
  timelineLastGoodRenderCache.clear(surfaceKey);
  const rendered=serializeFounderPresentation(fixture,{
    audience:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    resourceNamespace:`preview-${surfaceKey}`
  });
  const ready=canonicalBoardPreview(fixture,{
    audience:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    surfaceKey
  });
  assert.ok(ready.includes(rendered.svg));
  assert.match(ready,/data-render-state="ready"/);

  const invalid={
    ...fixture,
    events:[...fixture.events,{
      id:"invalid-category",
      title:"Invalid",
      categoryId:"not-a-category",
      eventType:"duration",
      startDate:"2026-01",
      endDate:"2026-02",
      visibilityState:"INTERVIEWER_SAFE"
    }]
  };
  const recovered=canonicalBoardPreview(invalid,{
    audience:"INTERVIEWER_SAFE",
    currentMonth:"2027-01",
    surfaceKey
  });
  assert.match(recovered,/data-render-state="last-good"/);
  assert.match(recovered,/Keeping your last complete preview/);
  assert.ok(recovered.includes(rendered.svg));
  assert.doesNotMatch(recovered,/LOADING CANONICAL TIMELINE/i);
  timelineLastGoodRenderCache.clear(surfaceKey);
});

test("one Founder projection carries presentation overrides and freeform scene objects into preview/export SVG",()=>{
  const eventId=fixture.events[0].id;
  const document={
    ...fixture,
    presentationOverrides:{
      axis:{
        mode:"manual",startYear:2018,endYear:2025,includeFuture:true,
        segmentWeights:[
          "2018","2019","2020","2021","2022","2023","2024","2025","FUTURE"
        ].map((id,index)=>({id,weight:index===2?2:1}))
      },
      categoryKey:FOUNDER_COLOR_KEY_ROWS.map((row)=>row.id==="work"
        ?{...row,label:"My Work",color:"#112233"}:row),
      colorKeyGeometry:{x:900,y:600,width:400,height:350},
      profileGeometry:{x:1200,y:600,width:600,height:400}
    },
    advanced:{
      textBlocks:[{
        id:"advanced-text-proof",text:"Shared projection proof",x:100,y:210,
        width:300,height:80,size:24,color:"#191C21"
      }],
      elements:[{
        id:"advanced-shape-proof",kind:"rounded-rectangle",x:460,y:210,
        width:180,height:100,fill:"#2C6E8F",stroke:"#17324A"
      }],
      media:[],groups:[],
      scene:{
        schema:TIMELINE_SCENE_SCHEMA,
        version:TIMELINE_SCENE_VERSION,
        revision:1,
        board:{width:1920,height:1080},
        objects:[{
          id:"event-geometry-proof",type:"event",semanticRef:eventId,
          geometry:{x:1200,y:700,width:400,height:350,rotation:0},
          locked:false,aspectLocked:false,z:0,groupId:null,presentation:{}
        }],
        groups:[],legacyDigest:""
      }
    }
  };
  const rendered=serializeFounderPresentation(document,{
    scope:"INTERVIEWER_SAFE",currentMonth:"2027-01"
  });
  assert.match(rendered.svg,/data-axis-segment-id="2018"/);
  assert.match(rendered.svg,/data-axis-segment-id="2020" data-axis-segment-weight="2"/);
  assert.match(rendered.svg,/data-category-id="work"[^>]*>[\s\S]*?fill="#112233"[\s\S]*?>My Work</);
  assert.match(rendered.svg,/data-artifact-chrome="color-key"[^>]*data-founder-geometry="900,600,400,350"/);
  assert.match(rendered.svg,/data-artifact-chrome="profile"[^>]*data-founder-geometry="1200,600,600,400"/);
  assert.match(rendered.svg,/data-scene-object="advanced-text-proof"/);
  assert.match(rendered.svg,/Shared projection<\/tspan><tspan[^>]*>proof/);
  assert.match(rendered.svg,/data-scene-object="advanced-shape-proof"/);
  assert.match(rendered.svg,new RegExp(`data-event-id="${eventId}"[\\s\\S]*?M1200 700H`));
});

test("both browser export paths are wired to the Founder serializer rather than a parallel visual renderer",async()=>{
  const legacyExport=await readFile(new URL("../web/js/export/timeline-canvas-renderer.js",import.meta.url),"utf8");
  const currentExport=await readFile(new URL("../web/js/uxr-002/export-adapter.js",import.meta.url),"utf8");
  const staticBuilder=await readFile(new URL("../scripts/build-static.mjs",import.meta.url),"utf8");
  const wordpressBuilder=await readFile(new URL("../scripts/build-wordpress-runtime.mjs",import.meta.url),"utf8");
  const integratedAdapter=await readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  assert.match(legacyExport,/serializeFounderPresentationAsync/);
  assert.match(legacyExport,/rasterizePresentationSvg/);
  assert.match(currentExport,/serializeFounderPresentationAsync/);
  assert.match(currentExport,/rasterizePresentationSvg/);
  assert.doesNotMatch(currentExport,/serializeLocked407FPortableSvg/);
  assert.doesNotMatch(currentExport,/portableAdvancedLayers|createAdvancedBoardRenderer/);
  assert.match(integratedAdapter,/serializeFounderPresentation/);
  assert.match(integratedAdapter,/createLocalExportAdapter/);
  assert.match(integratedAdapter,/kind:"founder-shared-presentation"/);
  assert.doesNotMatch(integratedAdapter,/return kernelManager\.render\(projected/);
  assert.match(integratedAdapter,/D1-TIMELINE-FOUNDER-REANCHOR-015\+DR-127/);
  for(const builder of [staticBuilder,wordpressBuilder]){
    assert.match(builder,/Object\.values\(FOUNDER_KEYNOTE_CONTRACT\.assets\)/);
    assert.match(builder,/TIMELINE_SOURCE_BOUND_ASSET_HASH_MISMATCH/);
    assert.match(builder,/global-wikidata-2026-08-24\.json/);
  }
});
