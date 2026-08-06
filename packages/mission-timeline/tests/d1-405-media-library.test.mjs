import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {renderAdvancedBoard} from "../web/js/uxr-002/advanced-board.js";
import {PRIMARY_NAV_ITEMS} from "../web/js/uxr-002/constants.js";
import {
  createMediaLibraryAsset,
  mediaKindForFile,
  mediaLibraryMarkup,
  nudgeMediaLibraryAsset,
  placeMediaLibraryAsset,
  removeMediaLibraryAsset,
  replaceMediaLibraryAsset,
  unplaceMediaLibraryAsset
} from "../web/js/uxr-002/media-library.js";
import {MemoryPersistenceAdapter} from "../web/js/persistence/memory-adapter.js";
import {buildResponsiveModel} from "../web/js/uxr-002/responsive.js";
import {TimelineStore,defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const FULL_ENTITLEMENT=Object.freeze({
  schemaVersion:"d1-405.timeline-entitlement.1",
  access:"FULL",verified:true,canRead:true,canCreate:true,canMutate:true,
  canExport:true,reason:"Verified test entitlement."
});
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(
  new URL("js/407f-engineering-adapter.js",webRoot),
  "utf8"
);
const css=await readFile(new URL("styles/407f-upgrade.css",webRoot),"utf8");

function file(name,type,size=1024){
  return{name,type,size};
}

test("Founder Media accepts PNG, JPG, WEBP, and GIF through the retained local asset model",()=>{
  for(const [name,type,kind] of [
    ["photo.png","image/png","image"],
    ["photo.jpg","image/jpeg","image"],
    ["photo.webp","image/webp","image"],
    ["motion.gif","image/gif","gif"]
  ]){
    const input=file(name,type);
    assert.equal(mediaKindForFile(input),kind);
    const asset=createMediaLibraryAsset({
      id:`asset-${kind}-${name}`,
      file:input,
      naturalWidth:1200,
      naturalHeight:800
    });
    assert.equal(asset.libraryAsset,true);
    assert.equal(asset.guidedVisible,true);
    assert.equal(asset.placed,false);
    assert.equal(asset.source.localOnly,true);
    assert.equal(asset.source.name,name);
  }
});

test("Founder Media places an existing asset reference without duplicating storage or collection records",()=>{
  const asset=createMediaLibraryAsset({
    id:"asset-1",
    file:file("photo.webp","image/webp"),
    naturalWidth:1200,
    naturalHeight:800
  });
  const placed=placeMediaLibraryAsset([asset],"asset-1",{x:1910,y:1070});
  assert.equal(placed.changed,true);
  assert.equal(placed.media.length,1);
  assert.equal(placed.media[0].id,"asset-1");
  assert.equal(placed.media[0].placed,true);
  assert.equal(placed.media[0].guidedVisible,true);
  assert.ok(placed.media[0].x+placed.media[0].width<=1920);
  assert.ok(placed.media[0].y+placed.media[0].height<=1080);

  const unplaced=unplaceMediaLibraryAsset(placed.media,"asset-1");
  assert.equal(unplaced.changed,true);
  assert.equal(unplaced.media[0].placed,false);
  assert.deepEqual(removeMediaLibraryAsset(unplaced.media,"asset-1"),[]);
});

test("Founder Media renders one draggable library with keyboard-equivalent placement actions",()=>{
  const asset=createMediaLibraryAsset({
    id:"asset-1",
    file:file("rotation-photo.png","image/png")
  });
  const html=mediaLibraryMarkup([asset],{
    resolveObjectUrl:()=>"blob:missionmed-local"
  });
  assert.match(html,/draggable="true"/);
  assert.match(html,/data-media-asset="asset-1"/);
  assert.match(html,/data-media-place="asset-1"/);
  assert.match(html,/keyboard placement at the timeline center/);
  assert.match(html,/blob:missionmed-local/);
  assert.match(html,/PNG, JPG, WEBP, or GIF/);
  assert.doesNotMatch(html,/tabindex="0"/);
  assert.match(html,/data-media-replace="asset-1"/);
  assert.match(html,/data-media-delete="asset-1"/);
  assert.doesNotMatch(html,/cloud|upload anywhere|server/i);
});

test("Founder Media replacement preserves placement while swapping the asset source",()=>{
  const original=createMediaLibraryAsset({
    id:"replace-asset",
    file:file("original.png","image/png"),
    naturalWidth:1200,
    naturalHeight:800,
    layerIndex:4
  });
  const placed=placeMediaLibraryAsset([original],"replace-asset",{x:800,y:420});
  const replacement=createMediaLibraryAsset({
    id:"replace-asset",
    file:file("replacement.webp","image/webp"),
    naturalWidth:1600,
    naturalHeight:900
  });
  replacement.source={
    name:"replacement.webp",
    type:"image/webp",
    size:1024,
    objectId:"object_replacement",
    contentSha256:"a".repeat(64),
    localOnly:false,
    url:null
  };
  const result=replaceMediaLibraryAsset(
    placed.media,
    "replace-asset",
    replacement
  );
  assert.equal(result.changed,true);
  assert.equal(result.media.length,1);
  assert.equal(result.media[0].id,"replace-asset");
  assert.equal(result.media[0].placed,true);
  assert.equal(result.media[0].x,placed.media[0].x);
  assert.equal(result.media[0].y,placed.media[0].y);
  assert.equal(result.media[0].width,placed.media[0].width);
  assert.equal(result.media[0].height,placed.media[0].width/(16/9));
  assert.equal(result.media[0].layerIndex,4);
  assert.equal(result.media[0].source.objectId,"object_replacement");
  assert.equal("blobKey" in result.media[0].source,false);
});

test("production Media truthfully describes private cross-device persistence",()=>{
  const html=mediaLibraryMarkup([],{durableOnline:true});
  assert.match(html,/PRIVATE MEDIA/);
  assert.match(html,/securely synced across your authorized devices/);
  assert.doesNotMatch(html,/stored only on this device/);
});

test("Founder Media keyboard nudges can position a placed asset without new records or blobs",()=>{
  const asset=createMediaLibraryAsset({
    id:"nudge-asset",
    file:file("photo.png","image/png")
  });
  const placed=placeMediaLibraryAsset([asset],"nudge-asset",{x:960,y:540});
  const moved=nudgeMediaLibraryAsset(placed.media,"nudge-asset","right");
  assert.equal(moved.changed,true);
  assert.equal(moved.media.length,1);
  assert.equal(moved.media[0].id,"nudge-asset");
  assert.equal(moved.media[0].x,placed.media[0].x+8);
  const html=mediaLibraryMarkup(moved.media);
  assert.match(html,/data-media-nudge="left"/);
  assert.match(html,/data-media-nudge="right"/);
  assert.match(html,/role="group" aria-label="Position photo.png"/);
});

test("Founder Media includes compatible retained Advanced assets and pauses GIF markup for reduced motion",()=>{
  const asset=createMediaLibraryAsset({
    id:"advanced-asset",
    file:file("motion.gif","image/gif")
  });
  delete asset.libraryAsset;
  delete asset.placed;
  const html=mediaLibraryMarkup([asset],{
    resolveObjectUrl:()=>"blob:animated",
    reducedMotion:true
  });
  assert.match(html,/data-media-asset="advanced-asset"/);
  assert.match(html,/GIF · MOTION PAUSED/);
  assert.doesNotMatch(html,/src="blob:animated"/);
});

test("Founder Media overlays only explicitly placed shared-library assets in Guided mode",()=>{
  const document=defaultDocument();
  const placed=createMediaLibraryAsset({
    id:"guided-media",
    file:file("photo.png","image/png")
  });
  placed.placed=true;
  placed.x=100;
  placed.y=120;
  document.advanced.media.push(placed,{
    ...placed,
    id:"advanced-only",
    guidedVisible:false
  });
  const rendered=renderAdvancedBoard(document,{currentMonth:"2026-07"},{
    resolveObjectUrl:(id)=>`blob:${id}`
  });
  assert.match(rendered.svg,/data-guided-media-layer="true"/);
  assert.match(rendered.svg,/data-advanced-media="guided-media"/);
  assert.doesNotMatch(rendered.svg,/data-advanced-media="advanced-only"/);
  assert.equal(rendered.advanced.guidedMediaCount,1);
});

test("Founder Media pauses placed GIFs in Guided and Advanced board rendering under reduced motion",()=>{
  const document=defaultDocument();
  const gif=createMediaLibraryAsset({
    id:"placed-gif",
    file:file("motion.gif","image/gif")
  });
  gif.placed=true;
  gif.guidedVisible=true;
  document.advanced.media.push(gif);
  const guided=renderAdvancedBoard(
    document,
    {currentMonth:"2026-07",reducedMotion:true},
    {resolveObjectUrl:()=>"blob:animated"}
  );
  assert.match(guided.svg,/data-media-motion-paused="true"/);
  assert.doesNotMatch(guided.svg,/href="blob:animated"/);
  document.mode="advanced";
  const advanced=renderAdvancedBoard(
    document,
    {currentMonth:"2026-07",reducedMotion:true},
    {resolveObjectUrl:()=>"blob:animated"}
  );
  assert.match(advanced.svg,/data-media-motion-paused="true"/);
  assert.doesNotMatch(advanced.svg,/href="blob:animated"/);
});

test("Founder Media is the fifth primary destination and remains functional at every responsive tier",()=>{
  const rail=index.slice(index.indexOf('<nav id="rail"'),index.indexOf("</nav>"));
  const labels=["Home","Builder","Edit Timeline","Media","Export"];
  assert.deepEqual(PRIMARY_NAV_ITEMS.map(({label})=>label),labels);
  let cursor=-1;
  for(const label of labels){
    const next=rail.indexOf(`>${label}<`);
    assert.ok(next>cursor,`${label} navigation order drifted`);
    cursor=next;
  }
  for(const width of [1440,1280,1024,1023,768,767,390]){
    const model=buildResponsiveModel({width,height:900});
    assert.equal(model.navigation.itemCount,5);
    assert.deepEqual(model.navigation.labels,labels);
    assert.equal(model.screens.media.functional,true);
    assert.equal(model.screens.media.contentMode,"full");
  }
});

test("Founder Media uses one local persistence collection and one drag/drop seam for Builder and Edit Timeline",()=>{
  assert.match(index,/id="media407F"/);
  assert.match(index,/id="mediaDrawer407F"/);
  assert.match(index,/data-open-media-library/);
  assert.match(adapter,/document\.advanced\.media\.push\(\.\.\.additions\)/);
  assert.match(adapter,/application\/x-missionmed-media-id/);
  assert.match(adapter,/closest\?\.\("#boardWizard, #canvas407F"\)/);
  assert.match(adapter,/store\.mutateWithBlobs/);
  assert.match(adapter,/store\.adapter\.deleteBlob/);
  assert.match(adapter,/private-media-retirement:/);
  assert.match(adapter,/processDurableMediaRetirements/);
  assert.match(adapter,/document\.addEventListener\("dragleave",onMediaLibraryDragLeave\)/);
  assert.match(adapter,/document\.addEventListener\("dragend",onMediaLibraryDragEnd\)/);
  assert.match(adapter,/querySelectorAll\("\[data-media-drop-active\]"\)/);
  assert.doesNotMatch(adapter,/fetch\([^)]*media|XMLHttpRequest|cloudStorage/i);
});

test("Founder Media route and blob metadata commit share active authority and one atomic transaction",async()=>{
  const memory=new MemoryPersistenceAdapter();
  const store=new TimelineStore({adapter:memory,entitlement:FULL_ENTITLEMENT});
  await store.initialize();
  assert.equal(store.navigate("media"),true);
  const blob=new Blob(["missionmed"],{type:"image/png"});
  const asset={
    id:"atomic-media",
    type:"media",
    source:{name:"atomic.png",type:"image/png",size:blob.size,blobKey:"atomic-media"},
    placed:false,
    libraryAsset:true
  };
  await store.mutateWithBlobs(
    "Add Media assets",
    (document)=>document.advanced.media.push(asset),
    {
      blobs:[{
        key:"atomic-media",
        blob,
        metadata:{kind:"media-library",localOnly:true}
      }]
    }
  );
  assert.equal(store.document.advanced.media.length,1);
  assert.ok(await memory.getBlob("atomic-media") instanceof Blob);
  store.undo();
  assert.equal(store.document.advanced.media.length,0);
  assert.ok(
    await memory.getBlob("atomic-media") instanceof Blob,
    "undo history must retain the source bytes"
  );
  store.redo();
  assert.equal(store.document.advanced.media[0].id,"atomic-media");
  clearTimeout(store.timer);
});

test("Founder Media atomic upload failure restores metadata and writes no orphan blob",async()=>{
  const memory=new MemoryPersistenceAdapter();
  const store=new TimelineStore({adapter:memory,entitlement:FULL_ENTITLEMENT});
  await store.initialize();
  const atomicPut=memory.atomicPut.bind(memory);
  memory.atomicPut=async(entries)=>{
    if(entries.some(({store})=>store==="blobs")){
      throw new Error("SIMULATED_ASSET_TRANSACTION_FAILURE");
    }
    return atomicPut(entries);
  };
  const before=structuredClone(store.document);
  await assert.rejects(
    store.mutateWithBlobs(
      "Add Media assets",
      (document)=>document.advanced.media.push({
        id:"failed-media",
        type:"media",
        source:{blobKey:"failed-media"}
      }),
      {
        blobs:[{
          key:"failed-media",
          blob:new Blob(["failed"],{type:"image/png"})
        }]
      }
    ),
    /SIMULATED_ASSET_TRANSACTION_FAILURE/
  );
  assert.deepEqual(store.document,before);
  assert.equal(await memory.getBlob("failed-media"),null);
});

test("Founder Media retains 407F hierarchy, 44px actions, non-modal drawer access, and visible drop feedback",()=>{
  assert.match(css,/\.media407FPageHeader\{[\s\S]*?linear-gradient\(145deg,#141d30,#0b101a\)/);
  assert.match(css,/\.media407FPageHeader\{[\s\S]*?position:static[\s\S]*?backdrop-filter:none/);
  assert.match(css,/\.media407FActions button\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.media407FUpload\{[\s\S]*?min-height:44px/);
  assert.match(css,/\[data-open-media-library\],[\s\S]*?\[data-close-media-library\]\{[\s\S]*?min-height:44px/);
  assert.match(css,/\.media407FDrawer\{[\s\S]*?left:190px[\s\S]*?position:fixed/);
  assert.match(css,/\.media407FDrawer>header\{[\s\S]*?background:transparent[\s\S]*?position:static/);
  assert.match(css,/DROP TO PLACE ON TIMELINE/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(index,/aria-modal="false"/);
  assert.match(index,/data-open-media-library aria-controls="mediaDrawer407F" aria-expanded="false" aria-haspopup="dialog"/);
  assert.match(adapter,/announceGlobal\("Media placed on timeline"\)/);
  assert.match(adapter,/live\.textContent="";[\s\S]*?queueMicrotask/);
  assert.match(adapter,/announceGlobal\(`\$\{file\.name\} could not be added:/);
  assert.match(adapter,/const mediaFocusState=/);
  assert.match(adapter,/onMotionChange:\(motion\)=>\{[\s\S]*?renderMediaLibrarySurfaces\(\)[\s\S]*?canvasController\?\.render\(\)/);
  assert.match(adapter,/if\(!\["builder","canvas"\]\.includes\(view\)\)closeMediaLibrary\(\)/);
  assert.match(css,/max-height:calc\(100vh - 152px\)/);
  assert.match(css,/\.media407FNudges\{[\s\S]*?grid-template-columns:repeat\(4,44px\)/);
});

test("Founder step navigation keeps its layout while gaining tactile 407F state treatment",()=>{
  assert.match(css,/#builderStepper\{[\s\S]*?grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.match(css,/\.builderStep\{[\s\S]*?linear-gradient\(180deg/);
  assert.match(css,/\.builderStep::before\{[\s\S]*?radial-gradient/);
  assert.match(css,/\.builderStep:hover\{[\s\S]*?translateY\(-1px\)/);
  assert.match(css,/\.builderStep:active\{[\s\S]*?translateY\(1px\)/);
  assert.match(css,/\.builderStep\.current \.builderStepNumber\{[\s\S]*?background:linear-gradient\(145deg,var\(--em\),var\(--em2\)\)[\s\S]*?color:#191c21/);
  assert.match(css,/\.builderStep\[data-state="complete"\] \.builderStepGlyph\{[\s\S]*?color:var\(--gn\)/);
  assert.match(css,/\.builderStep:focus-visible\{[\s\S]*?outline:2px solid var\(--cy\)/);
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.builderStep/);
});
