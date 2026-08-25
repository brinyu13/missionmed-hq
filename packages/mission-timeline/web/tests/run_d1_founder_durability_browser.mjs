import {spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||
  "http://127.0.0.1:8796/web/?entitlement=administrator";
const captureDir=process.env.D1_CAPTURE_DIR||
  "/private/tmp/d1-founder-durability-015";
const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const initialMedia=path.join(packageRoot,"web/tests/fixtures/media/synthetic_story_2.webp");
const replacementMedia=path.join(
  packageRoot,"web/assets/founder_keynote_2024/flags/USA-Flag.H03-10831.png"
);
mkdirSync(captureDir,{recursive:true});

const focusedSuites=[
  "tests/d1-founder-reanchor-scene-editor.test.mjs",
  "tests/d1-500-rc1-media-resilience.test.mjs",
  "tests/hybrid-indexeddb.test.mjs",
  "tests/d1-411c-production-runtime.test.mjs"
];
const unit=spawnSync(process.execPath,["--test",...focusedSuites],{
  cwd:packageRoot,encoding:"utf8",maxBuffer:10*1024*1024
});
const unitOutput=`${unit.stdout||""}${unit.stderr||""}`;
const unitOutputPath=path.join(captureDir,"FOCUSED_DURABILITY_TESTS.tap");
writeFileSync(unitOutputPath,unitOutput);
if(unit.status!==0)throw new Error(`Focused durability suites failed. See ${unitOutputPath}`);

const unitSummary={
  status:"PASS",
  suites:focusedSuites,
  tests:Number(unitOutput.match(/ℹ tests (\d+)/)?.[1]||0),
  passed:Number(unitOutput.match(/ℹ pass (\d+)/)?.[1]||0),
  failed:Number(unitOutput.match(/ℹ fail (\d+)/)?.[1]||0),
  output:unitOutputPath
};

const {chromium}=require(playwrightRuntime);
const checks=[];
const browserErrors=[];
const screenshots=[];
let screenshotIndex=0;

function invariant(condition,message){
  if(!condition)throw new Error(message);
}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({
  viewport:{width:1720,height:1050},
  reducedMotion:"reduce",
  acceptDownloads:true
});
let page=await context.newPage();

function bindPage(nextPage){
  nextPage.setDefaultTimeout(8000);
  nextPage.on("pageerror",(error)=>browserErrors.push(`pageerror:${error.message}`));
  nextPage.on("console",(message)=>{
    if(message.type()==="error"&&!message.text().includes("favicon")){
      browserErrors.push(`console:${message.text()}`);
    }
  });
}
bindPage(page);

async function screenshot(label){
  const file=path.join(
    captureDir,`${String(++screenshotIndex).padStart(2,"0")}-${label}.png`
  );
  await page.screenshot({path:file,fullPage:true});
  screenshots.push(file);
  return file;
}

async function check(name,proofKind,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    const result={
      name,proofKind,status:"PASS",
      durationMs:+(performance.now()-started).toFixed(1),detail:detail??null
    };
    checks.push(result);
    console.log(`PASS ${name}`);
    return result;
  }catch(error){
    let failureScreenshot=null;
    try{failureScreenshot=await screenshot(`failure-${checks.length+1}`);}catch{}
    const result={
      name,proofKind,status:"FAIL",
      durationMs:+(performance.now()-started).toFixed(1),
      error:String(error?.stack||error),failureScreenshot
    };
    checks.push(result);
    console.error(`FAIL ${name}: ${error?.message||error}`);
    return result;
  }finally{
    try{await page.mouse.up();}catch{}
  }
}

async function openApp(target=page){
  await target.goto(appUrl,{waitUntil:"networkidle"});
  await target.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
}

const svg=()=>page.locator('.canvas-screen svg[data-founder-serializer]').first();
const shape=(id)=>page.locator(
  `.canvas-screen svg [data-advanced-element="${id}"], `+
  `[data-canvas-effective-hit-proxy][data-advanced-element="${id}"]`
).last();
const textObject=(id)=>page.locator(
  `.canvas-screen svg [data-advanced-text="${id}"], `+
  `[data-canvas-effective-hit-proxy][data-advanced-text="${id}"]`
).last();

async function gotoView(view){
  await page.locator(`#rail [data-v="${view}"]`).click();
  await page.waitForFunction(
    (expected)=>document.querySelector('#rail [aria-current="page"]')?.dataset.v===expected,
    view
  );
}

async function drag(locator,dx,dy){
  const box=await locator.boundingBox();
  invariant(box,"A visible drag target was required.");
  const start={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x+dx,start.y+dy,{steps:16});
  await page.mouse.up();
  await page.waitForTimeout(180);
}

async function persistentSnapshot(){
  return page.evaluate(async()=>{
    const api=window.D1_407F_ENGINEERING;
    const timeline=structuredClone(api.store.document);
    const record=await api.store.adapter.get("documents",timeline.id);
    const versions=await api.store.listVersions();
    const media=(timeline.advanced?.media||[]).map((item)=>({
      id:item.id,placed:item.placed!==false,name:item.source?.name||null,
      blobKey:item.source?.blobKey||null,objectId:item.source?.objectId||null,
      source:item.source||null
    }));
    return{
      documentId:timeline.id,
      title:timeline.title,
      groupCount:timeline.advanced?.groups?.length||0,
      groups:timeline.advanced?.groups||[],
      sceneGroups:timeline.advanced?.scene?.groups||[],
      elements:timeline.advanced?.elements||[],
      textBlocks:timeline.advanced?.textBlocks||[],
      versions:versions.map(({id,name,kind,createdAt})=>({id,name,kind,createdAt})),
      media,
      documentJson:JSON.stringify(timeline),
      recordJson:JSON.stringify(record?.document||null)
    };
  });
}

await openApp();
await page.evaluate(()=>{
  const api=window.D1_407F_ENGINEERING;
  const timeline=api.store.snapshot();
  timeline.mode="advanced";
  timeline.layoutLock=false;
  timeline.title="Founder durability synthetic proof";
  timeline.events=[{
    id:"durability-event",title:"Synthetic durability event",categoryId:"research",
    eventType:"duration",startDate:"2022-07",endDate:"2024-06",openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",siteName:"Synthetic University",
    sourceType:"browser-proof",notes:"Synthetic test data only",lane:0,fields:{}
  }];
  timeline.advanced={
    ...(timeline.advanced||{}),media:[],groups:[],recentColors:[],
    background:{kind:"preset",preset:"founder-keynote-2024",dim:0},
    textBlocks:[{
      id:"durability-text",type:"text",text:"Durable grouped text",x:1120,y:310,
      width:320,height:96,font:"Inter",size:28,weight:700,color:"#17324A",
      alignment:"center",fitMode:"auto",minFontSize:10,lineHeight:1.2,
      verticalAlign:"center",locked:false,aspectLocked:false,layerIndex:5,zIndex:5,
      groupId:null
    }],
    elements:[{
      id:"durability-shape",type:"element",kind:"rounded-rectangle",
      x:1060,y:260,width:440,height:190,fill:"#F8F1E8",stroke:"#2C6E8F",
      label:"Durable group card",countryCode:"US",locked:false,aspectLocked:true,
      layerIndex:4,zIndex:4,groupId:null
    }],
    scene:undefined
  };
  api.store.replace(timeline,{label:"Seed durability proof",history:false});
  api.applyDocument();
});

await check("visible group geometry and named history persist across a full refresh","UI",async()=>{
  await gotoView("canvas");
  await svg().waitFor({state:"visible"});
  await shape("durability-shape").click({position:{x:24,y:24}});
  await textObject("durability-text").click({modifiers:["Shift"]});
  const groupButton=page.locator("[data-advanced-group-members]");
  await groupButton.waitFor({state:"visible"});
  await groupButton.click();
  await page.waitForFunction(
    ()=>window.D1_407F_ENGINEERING.store.document.advanced.groups.length===1
  );
  const beforeMove=await persistentSnapshot();
  const groupId=beforeMove.groups[0].id;
  await shape("durability-shape").click({position:{x:24,y:24}});
  await page.locator(
    `[data-advanced-direct-selection="true"][data-advanced-target-type="group"]`+
    `[data-advanced-target-id="${groupId}"]`
  ).waitFor({state:"visible"});
  await drag(shape("durability-shape"),52,31);
  const moved=await persistentSnapshot();
  invariant(
    moved.elements[0].x!==beforeMove.elements[0].x&&
    moved.textBlocks[0].x!==beforeMove.textBlocks[0].x,
    "The real grouped composition did not move as one object."
  );

  await page.locator('[data-canvas-action="history"]').click();
  await page.locator('[data-canvas-action="save-version"]').click();
  await page.locator("#history-version-name").fill("Durability checkpoint");
  await page.locator("[data-history-name-form]").evaluate((form)=>
    form.dispatchEvent(new SubmitEvent("submit",{bubbles:true,cancelable:true}))
  );
  await page.waitForFunction(async()=>
    (await window.D1_407F_ENGINEERING.store.listVersions())
      .some(({name})=>name==="Durability checkpoint")
  );
  await page.evaluate(()=>window.D1_407F_ENGINEERING.store.saveNow("DURABILITY_REFRESH"));
  const saved=await persistentSnapshot();
  await screenshot("scene-group-history-before-refresh");

  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await gotoView("canvas");
  await svg().waitFor({state:"visible"});
  const reloaded=await persistentSnapshot();
  invariant(reloaded.groupCount===1&&reloaded.sceneGroups.length===1,
    `Group graph did not survive refresh: ${JSON.stringify(reloaded.groups)}`);
  invariant(
    reloaded.elements[0].groupId===groupId&&reloaded.textBlocks[0].groupId===groupId,
    "Grouped children lost their durable membership."
  );
  invariant(
    reloaded.elements[0].x===saved.elements[0].x&&
    reloaded.textBlocks[0].x===saved.textBlocks[0].x,
    "Grouped presentation geometry changed during refresh."
  );
  await page.locator('[data-canvas-action="history"]').click();
  const visibleVersion=page.locator(".history-version-row",{hasText:"Durability checkpoint"});
  await visibleVersion.waitFor({state:"visible"});
  await screenshot("scene-group-history-after-refresh");
  return{
    documentId:saved.documentId,groupId,
    geometry:{
      shape:{x:saved.elements[0].x,y:saved.elements[0].y},
      text:{x:saved.textBlocks[0].x,y:saved.textBlocks[0].y}
    },
    namedVersion:"Durability checkpoint",refresh:true
  };
});

let mediaId="";
await check("real Media upload reloads from IndexedDB without a persisted blob URL","UI",async()=>{
  await gotoView("media");
  await page.locator("#media407F [data-media-upload]").setInputFiles(initialMedia);
  await page.waitForFunction(()=>
    window.D1_407F_ENGINEERING.store.document.advanced.media.length===1
  );
  mediaId=await page.evaluate(()=>
    window.D1_407F_ENGINEERING.store.document.advanced.media[0].id
  );
  const card=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await card.waitFor({state:"visible"});
  await card.locator(`[data-media-place="${mediaId}"]`).click();
  await page.waitForFunction((id)=>
    window.D1_407F_ENGINEERING.store.document.advanced.media
      .find((item)=>item.id===id)?.placed===true,
    mediaId
  );
  await page.evaluate(()=>window.D1_407F_ENGINEERING.store.saveNow("DURABILITY_MEDIA_UPLOAD"));
  const before=await persistentSnapshot();
  const item=before.media.find(({id})=>id===mediaId);
  invariant(item?.blobKey===mediaId&&item.objectId===null,
    `Local browser proof did not use an IndexedDB blob key: ${JSON.stringify(item)}`);
  invariant(!before.documentJson.includes("blob:")&&!before.recordJson.includes("blob:"),
    "A transient object URL entered persistent Timeline state.");
  const transientBefore=await card.locator("img").getAttribute("src");
  invariant(String(transientBefore).startsWith("blob:"),
    "The visible local preview did not use its expected ephemeral object URL.");
  await screenshot("media-uploaded-and-placed");

  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await gotoView("media");
  const reloadedCard=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await reloadedCard.waitFor({state:"visible"});
  await reloadedCard.locator("img").waitFor({state:"visible"});
  const after=await persistentSnapshot();
  invariant(after.media.find(({id})=>id===mediaId)?.placed===true,
    "The placed media state did not survive refresh.");
  invariant(!after.documentJson.includes("blob:")&&!after.recordJson.includes("blob:"),
    "Reload persisted an ephemeral object URL.");
  const blobPresent=await page.evaluate(async(id)=>
    (await window.D1_407F_ENGINEERING.store.adapter.getBlob(id)) instanceof Blob,
    mediaId
  );
  invariant(blobPresent,"The uploaded image bytes were not durable in the local recovery cache.");
  await screenshot("media-rehydrated-after-refresh");
  return{
    mediaId,source:item.source,persistentBlobUrl:false,
    ephemeralPreviewUrl:true,blobBytesRehydrated:true,refresh:true
  };
});

await check("visible remove-from-canvas persists while the reusable Media asset remains","UI",async()=>{
  const card=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await card.locator(`[data-media-unplace="${mediaId}"]`).click();
  await page.waitForFunction((id)=>
    window.D1_407F_ENGINEERING.store.document.advanced.media
      .find((item)=>item.id===id)?.placed===false,
    mediaId
  );
  await page.evaluate(()=>window.D1_407F_ENGINEERING.store.saveNow("DURABILITY_MEDIA_UNPLACE"));
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await gotoView("media");
  const reloaded=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await reloaded.waitFor({state:"visible"});
  await reloaded.locator(`[data-media-place="${mediaId}"]`).waitFor({state:"visible"});
  const state=await persistentSnapshot();
  invariant(state.media.find(({id})=>id===mediaId)?.placed===false,
    "Remove-from-canvas state did not survive refresh.");
  return{mediaId,placed:false,libraryAssetRetained:true,refresh:true};
});

await check("visible media replacement survives refresh with new bytes and no blob URL in state","UI",async()=>{
  let card=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await card.locator(`[data-media-place="${mediaId}"]`).click();
  await page.waitForFunction((id)=>
    window.D1_407F_ENGINEERING.store.document.advanced.media
      .find((item)=>item.id===id)?.placed===true,
    mediaId
  );
  const chooserPromise=page.waitForEvent("filechooser");
  await card.locator(`[data-media-replace="${mediaId}"]`).click();
  const chooser=await chooserPromise;
  await chooser.setFiles(replacementMedia);
  await page.waitForFunction(({id,name})=>
    window.D1_407F_ENGINEERING.store.document.advanced.media
      .find((item)=>item.id===id)?.source?.name===name,
    {id:mediaId,name:path.basename(replacementMedia)}
  );
  const replaced=await persistentSnapshot();
  const source=replaced.media.find(({id})=>id===mediaId)?.source;
  invariant(source?.blobKey===mediaId&&source?.name===path.basename(replacementMedia),
    `Replacement did not retain the durable asset identity: ${JSON.stringify(source)}`);
  invariant(!replaced.documentJson.includes("blob:")&&!replaced.recordJson.includes("blob:"),
    "Replacement persisted an object URL.");
  await screenshot("media-replaced-before-refresh");

  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await gotoView("media");
  card=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await card.waitFor({state:"visible"});
  await card.locator("img").waitFor({state:"visible"});
  const reloaded=await persistentSnapshot();
  invariant(
    reloaded.media.find(({id})=>id===mediaId)?.name===path.basename(replacementMedia),
    "Replacement metadata did not survive refresh."
  );
  invariant(!reloaded.documentJson.includes("blob:")&&!reloaded.recordJson.includes("blob:"),
    "Reload after replacement persisted an object URL.");
  await screenshot("media-replaced-after-refresh");
  return{
    mediaId,replacementName:path.basename(replacementMedia),
    sameDurableAssetId:true,persistentBlobUrl:false,refresh:true
  };
});

await check("visible media deletion removes metadata and cached bytes across refresh","UI",async()=>{
  const card=page.locator(`#media407F [data-media-asset="${mediaId}"]`);
  await card.locator(`[data-media-delete="${mediaId}"]`).click();
  const dialog=page.locator("[data-media-delete-dialog]");
  await dialog.waitFor({state:"visible"});
  await dialog.locator("[data-media-delete-confirm]").click();
  await page.waitForFunction((id)=>
    !window.D1_407F_ENGINEERING.store.document.advanced.media.some((item)=>item.id===id),
    mediaId
  );
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await gotoView("media");
  invariant(await page.locator(`#media407F [data-media-asset="${mediaId}"]`).count()===0,
    "Deleted media returned after refresh.");
  const durable=await persistentSnapshot();
  const blob=await page.evaluate(async(id)=>
    await window.D1_407F_ENGINEERING.store.adapter.getBlob(id),
    mediaId
  );
  invariant(!durable.media.some(({id})=>id===mediaId)&&blob===null,
    "Deleted media metadata or cached bytes remained after refresh.");
  invariant(!durable.documentJson.includes("blob:")&&!durable.recordJson.includes("blob:"),
    "Final persistent state contains an object URL.");
  await screenshot("media-deleted-after-refresh");
  return{mediaId,metadataRemoved:true,cachedBytesRemoved:true,refresh:true};
});

await check("a new top-level page in the same browser context restores scene, group, and history","UI",async()=>{
  const prior=await persistentSnapshot();
  await page.close();
  page=await context.newPage();
  bindPage(page);
  await openApp();
  await gotoView("canvas");
  await svg().waitFor({state:"visible"});
  const restored=await persistentSnapshot();
  invariant(restored.documentId===prior.documentId,"A new page selected a different local document.");
  invariant(restored.groupCount===1&&restored.sceneGroups.length===1,
    "The scene group did not restore in the new page session.");
  invariant(restored.versions.some(({name})=>name==="Durability checkpoint"),
    "Named history did not restore in the new page session.");
  invariant(restored.media.length===0,"Deleted media returned in the new page session.");
  await screenshot("new-page-session-restored");
  return{
    documentId:restored.documentId,groupCount:restored.groupCount,
    namedVersion:"Durability checkpoint",mediaCount:restored.media.length
  };
});

const serviceProof={
  crossDeviceHydration:{
    proofKind:"ADAPTER_SERVICE",
    suite:"tests/d1-411c-production-runtime.test.mjs",
    assertion:"Authoritative save hydrates a clean second IndexedDB device context.",
    status:"PASS"
  },
  staleWrite:{
    proofKind:"ADAPTER_SERVICE",
    suite:"tests/d1-411c-production-runtime.test.mjs",
    assertion:"A base-revision-zero stale write receives REVISION_CONFLICT/409 and cannot replace revision 1.",
    status:"PASS"
  },
  conflictPreservation:{
    proofKind:"ADAPTER_SERVICE",
    suite:"tests/hybrid-indexeddb.test.mjs",
    assertion:"Divergent authoritative reload preserves the local pending copy, records the server snapshot, and remains CONFLICT until explicit recovery.",
    status:"PASS",
    resolutionExercised:false
  },
  privateMediaContract:{
    proofKind:"ADAPTER_SERVICE",
    suite:"tests/d1-500-rc1-media-resilience.test.mjs",
    assertion:"Production document media contains only durable objectId/checksum; replacement/deletion retires only unreferenced private objects.",
    status:"PASS"
  }
};

const result={
  generatedAt:new Date().toISOString(),
  appUrl,captureDir,
  scope:"D1 Founder Re-anchor 015 · durability unit 21 · no production/provider mutation",
  summary:{
    status:checks.every(({status})=>status==="PASS")&&browserErrors.length===0?"PASS":"FAIL",
    uiPassed:checks.filter(({status,proofKind})=>status==="PASS"&&proofKind==="UI").length,
    uiFailed:checks.filter(({status,proofKind})=>status==="FAIL"&&proofKind==="UI").length,
    focusedUnitTests:unitSummary,
    productionMutation:false,
    conflictResolutionExercised:false
  },
  uiProof:checks,
  adapterServiceProof:serviceProof,
  browserErrors:[...new Set(browserErrors)],
  screenshots,
  limitations:[
    "Cross-device remote hydration is adapter/service proof against a production-like fake authority; no production account or provider was touched.",
    "The visible media journey proves browser IndexedDB reload, replacement, removal, and deletion. The production private-object contract is independently proven at the adapter boundary.",
    "The synthetic conflict was not resolved; both copies remain preserved by the tested conflict law."
  ]
};
const receiptPath=path.join(captureDir,"D1_FOUNDER_DURABILITY_015_RECEIPT.json");
writeFileSync(receiptPath,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify({receiptPath,...result.summary}));
await browser.close();
if(result.summary.status!=="PASS")process.exitCode=1;
