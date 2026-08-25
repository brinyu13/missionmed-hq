import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8796/web/?entitlement=administrator";
const captureDir=process.env.D1_CAPTURE_DIR||"/private/tmp/d1-founder-shared-editor-proof-015";
mkdirSync(captureDir,{recursive:true});

const {chromium}=require(playwrightRuntime);
const checks=[];
const browserErrors=[];
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
const page=await context.newPage();
page.setDefaultTimeout(6500);
page.on("pageerror",(error)=>browserErrors.push(`pageerror:${error.message}`));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("favicon")){
    browserErrors.push(`console:${message.text()}`);
  }
});

async function screenshot(label){
  const file=path.join(captureDir,`${String(++screenshotIndex).padStart(2,"0")}-${label}.png`);
  await page.screenshot({path:file,fullPage:true});
  return file;
}

async function check(name,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    const receipt={name,status:"PASS",durationMs:+(performance.now()-started).toFixed(1),detail:detail??null};
    checks.push(receipt);
    console.log(`PASS ${name}`);
    return receipt;
  }catch(error){
    let failureScreenshot=null;
    try{failureScreenshot=await screenshot(`failure-${checks.length+1}`);}catch{}
    const receipt={
      name,status:"FAIL",durationMs:+(performance.now()-started).toFixed(1),
      error:String(error?.stack||error),failureScreenshot
    };
    checks.push(receipt);
    console.error(`FAIL ${name}: ${error?.message||error}`);
    return receipt;
  }finally{
    try{await page.mouse.up();}catch{}
  }
}

const svg=()=>page.locator('.canvas-screen svg[data-founder-serializer]').first();
// Small SVG labels receive a 44px effective hit target. It is appended after the
// source node, so last() resolves to the real user hit target when present and
// falls back to the SVG source for objects that are already large enough.
const element=(id)=>page.locator(
  `.canvas-screen svg [data-advanced-element="${id}"], [data-canvas-effective-hit-proxy][data-advanced-element="${id}"]`
).last();
const textObject=(id)=>page.locator(
  `.canvas-screen svg [data-advanced-text="${id}"], [data-canvas-effective-hit-proxy][data-advanced-text="${id}"]`
).last();
const directSelection=(type,id)=>page.locator(
  `[data-advanced-direct-selection="true"][data-advanced-target-type="${type}"][data-advanced-target-id="${id}"]`
).first();
const directHandle=(type,id,handle)=>directSelection(type,id).locator(
  `[data-advanced-direct-handle="${handle}"]`
).first();

async function geometry(type,id){
  return page.evaluate(({type,id})=>{
    const document=window.D1_407F_ENGINEERING.store.document;
    if(type==="color-key")return{
      x:37,y:350,width:247,height:277,
      ...(document.presentationOverrides?.colorKeyGeometry||{})
    };
    if(type==="profile")return{
      x:30,y:677,width:512,height:375,
      ...(document.presentationOverrides?.profileGeometry||{})
    };
    const source=type==="text"
      ?document.advanced?.textBlocks
      :type==="media"
        ?document.advanced?.media
        :document.advanced?.elements;
    const item=(source||[]).find((candidate)=>String(candidate.id)===String(id));
    return item?{
      x:item.x,y:item.y,width:item.width,height:item.height,
      locked:item.locked===true,aspectLocked:item.aspectLocked!==false,
      zIndex:item.zIndex,layerIndex:item.layerIndex,text:item.text,groupId:item.groupId||null
    }:null;
  },{type,id});
}

async function select(target,type,id){
  await target.click({position:{x:Math.max(2,(await target.boundingBox())?.width/2||2),y:Math.max(2,(await target.boundingBox())?.height/2||2)}});
  await directSelection(type,id).waitFor({state:"visible"});
}

async function dragLocator(locator,dx,dy,{steps=12,inspect}={}){
  const box=await locator.boundingBox();
  invariant(box,`drag target has no bounds: ${await locator.evaluateAll((nodes)=>nodes.length)}`);
  const start={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x+dx,start.y+dy,{steps});
  let observation=null;
  if(inspect)observation=await inspect();
  await page.mouse.up();
  await page.waitForTimeout(180);
  return observation;
}

async function resizeObject(type,id,handle,dx,dy){
  const target=type==="element"?element(id):textObject(id);
  await select(target,type,id);
  await dragLocator(directHandle(type,id,handle),dx,dy);
}

await page.goto(appUrl,{waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
await page.evaluate(()=>{
  const api=window.D1_407F_ENGINEERING;
  const document=api.store.snapshot();
  document.mode="advanced";
  document.layoutLock=false;
  document.title="Founder Shared SVG Editor Browser Proof";
  document.studentProfile={
    ...document.studentProfile,
    fullName:"Synthetic Founder Proxy",
    specialtyGoal:"Internal Medicine",
    medicalSchool:"Synthetic Global Medical School",
    medicalSchoolCountry:"Canada"
  };
  document.events=[{
    id:"proof-event",title:"Synthetic clinical experience",categoryId:"usce",
    eventType:"duration",startDate:"2024-07",endDate:"2025-06",openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",siteName:"Synthetic Hospital",sourceType:"browser-proof",
    notes:"Synthetic test data only",lane:0,fields:{hiddenInActiveVariant:false}
  }];
  document.presentationOverrides={};
  document.advanced={
    ...(document.advanced||{}),
    media:[],groups:[],recentColors:[],
    background:{kind:"preset",preset:"founder-keynote-2024",dim:0},
    textBlocks:[{
      id:"proof-text",type:"text",text:"Editable synthetic story",x:1090,y:350,
      width:300,height:96,font:"Inter",size:28,weight:700,color:"#17324A",
      alignment:"center",fitMode:"auto",minFontSize:10,lineHeight:1.2,
      verticalAlign:"center",locked:false,aspectLocked:false,layerIndex:5,zIndex:5,groupId:null
    }],
    elements:[
      {id:"proof-shape",type:"element",kind:"rounded-rectangle",x:990,y:150,width:420,height:150,
        fill:"#F8F1E8",stroke:"#2C6E8F",label:"Synthetic story card",countryCode:"US",
        locked:false,aspectLocked:true,layerIndex:4,zIndex:4,groupId:null},
      {id:"proof-icon",type:"element",kind:"hospital",x:1460,y:140,width:160,height:120,
        fill:"#2C6E8F",stroke:"#17324A",label:"Synthetic hospital",countryCode:"US",
        locked:false,aspectLocked:true,layerIndex:1,zIndex:1,groupId:null}
    ],
    scene:undefined
  };
  api.store.replace(document,{label:"Founder shared editor synthetic proof",history:false});
  api.applyDocument();
});
await page.locator('#rail [data-v="canvas"]').click();
await page.waitForFunction(()=>document.querySelector('#rail [aria-current="page"]')?.dataset.v==="canvas");
await svg().waitFor({state:"visible"});
await element("proof-icon").waitFor({state:"visible"});
await page.waitForTimeout(500);
const initialScreenshot=await screenshot("initial-founder-shared-editor");

await check("shared Founder SVG is the live Advanced edit surface",async()=>{
  const state=await page.evaluate(()=>({
    svgCount:document.querySelectorAll('.canvas-screen svg[data-founder-serializer]').length,
    iframeCount:document.querySelectorAll('d1-timeline-kernel[data-surface="edit"] iframe').length,
    presentationKernel:document.querySelector('.canvas-application')?.dataset.presentationKernel||null,
    loading:document.body.textContent.includes("LOADING CANONICAL TIMELINE")
  }));
  invariant(state.svgCount===1&&state.iframeCount===0&&!state.loading,`wrong edit surface: ${JSON.stringify(state)}`);
  return state;
});

await check("two real assets add from the rail, including physical rail drag",async()=>{
  await page.locator('[data-advanced-panel="shapes"]').click();
  const rectangle=page.locator('[data-advanced-insert-asset][data-advanced-kind="rectangle"]').first();
  const before=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.elements.length);
  await rectangle.click();
  await page.waitForTimeout(180);
  const afterClick=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.elements.length);
  invariant(afterClick===before+1,`click-to-add count ${before} -> ${afterClick}`);

  await page.locator('[data-advanced-panel="elements"]').click();
  const arrow=page.locator('[data-advanced-insert-asset][data-advanced-kind="arrow-right"]').first();
  const railBox=await arrow.boundingBox();
  const svgBox=await svg().boundingBox();
  invariant(railBox&&svgBox,"rail or Founder SVG bounds unavailable");
  const drop={x:svgBox.x+svgBox.width*.72,y:svgBox.y+svgBox.height*.78};
  await page.mouse.move(railBox.x+railBox.width/2,railBox.y+railBox.height/2);
  await page.mouse.down();
  await page.mouse.move(drop.x,drop.y,{steps:18});
  await page.mouse.up();
  await page.waitForTimeout(240);
  const result=await page.evaluate(()=>{
    const elements=window.D1_407F_ENGINEERING.store.document.advanced.elements;
    return{count:elements.length,arrow:elements.filter((item)=>item.kind==="arrow-right").at(-1)||null};
  });
  invariant(result.count===afterClick+1&&result.arrow,`physical rail drag failed: ${JSON.stringify(result)}`);
  invariant(Math.abs(result.arrow.x-1382)<90&&Math.abs(result.arrow.y-842)<90,
    `rail drop position was not honored: ${JSON.stringify(result.arrow)}`);
  return{clickAdded:true,physicalDragAdded:true,dropGeometry:result.arrow};
});

await check("direct text editing commits through the visible canvas editor",async()=>{
  await textObject("proof-text").dblclick();
  const editor=page.locator('[data-advanced-inline-text-form][data-advanced-target-id="proof-text"]');
  await editor.waitFor({state:"visible"});
  const input=editor.locator("[data-advanced-inline-text-input]");
  await input.fill("Edited directly in the Founder canvas");
  await editor.locator('button[type="submit"]').click();
  await page.waitForTimeout(180);
  const after=await geometry("text","proof-text");
  invariant(after?.text==="Edited directly in the Founder canvas",`text did not commit: ${JSON.stringify(after)}`);
  return after.text;
});

await check("all eight resize handles mutate geometry and aspect lock toggles",async()=>{
  const receipts=[];
  const deltas={nw:[-8,-6],n:[0,-7],ne:[8,-6],e:[8,0],se:[8,6],s:[0,7],sw:[-8,6],w:[-8,0]};
  for(const handle of ["nw","n","ne","e","se","s","sw","w"]){
    const before=await geometry("element","proof-icon");
    await resizeObject("element","proof-icon",handle,...deltas[handle]);
    const after=await geometry("element","proof-icon");
    invariant(after.width!==before.width||after.height!==before.height||after.x!==before.x||after.y!==before.y,
      `${handle} handle did not mutate geometry`);
    receipts.push({handle,before,after});
  }
  await select(element("proof-icon"),"element","proof-icon");
  const aspect=page.locator('[data-advanced-aspect-lock][data-advanced-target-id="proof-icon"]');
  await aspect.uncheck();
  const freeBefore=await geometry("element","proof-icon");
  await resizeObject("element","proof-icon","e",28,0);
  const freeAfter=await geometry("element","proof-icon");
  invariant(Math.abs(freeAfter.height-freeBefore.height)<.01&&freeAfter.width>freeBefore.width,
    `unlocked east resize was not freeform: ${JSON.stringify({freeBefore,freeAfter})}`);
  await select(element("proof-icon"),"element","proof-icon");
  await aspect.check();
  const lockedBefore=await geometry("element","proof-icon");
  await resizeObject("element","proof-icon","se",24,18);
  const lockedAfter=await geometry("element","proof-icon");
  const ratioBefore=lockedBefore.width/lockedBefore.height;
  const ratioAfter=lockedAfter.width/lockedAfter.height;
  invariant(Math.abs(ratioAfter-ratioBefore)<.02,
    `locked resize lost proportions: ${JSON.stringify({lockedBefore,lockedAfter})}`);
  return{handles:receipts.map(({handle})=>handle),freeform:{freeBefore,freeAfter},locked:{lockedBefore,lockedAfter}};
});

await check("object layer control changes persisted stacking order",async()=>{
  await select(element("proof-icon"),"element","proof-icon");
  const layerBefore=await page.evaluate(()=>{
    const timelineDocument=window.D1_407F_ENGINEERING.store.document;
    return{
      scene:(timelineDocument.advanced.scene?.objects||[]).map(({id,z})=>({id,z})).sort((a,b)=>a.z-b.z),
      dom:[...globalThis.document.querySelectorAll('.canvas-screen svg [data-scene-object]')].map((node)=>({id:node.dataset.sceneObject,z:Number(node.dataset.sceneZ)}))
    };
  });
  await page.locator('[data-advanced-object-action="bring-forward"][data-advanced-target-id="proof-icon"]').click();
  await page.waitForTimeout(160);
  const layerForward=await page.evaluate(()=>{
    const timelineDocument=window.D1_407F_ENGINEERING.store.document;
    return{
      scene:(timelineDocument.advanced.scene?.objects||[]).map(({id,z})=>({id,z})).sort((a,b)=>a.z-b.z),
      dom:[...globalThis.document.querySelectorAll('.canvas-screen svg [data-scene-object]')].map((node)=>({id:node.dataset.sceneObject,z:Number(node.dataset.sceneZ)}))
    };
  });
  const order=(snapshot)=>snapshot.scene.map(({id})=>id);
  invariant(JSON.stringify(order(layerForward))!==JSON.stringify(order(layerBefore)),
    `bring-forward did not change global order: ${JSON.stringify({layerBefore,layerForward})}`);
  await select(element("proof-icon"),"element","proof-icon");
  await page.locator('[data-advanced-object-action="send-backward"][data-advanced-target-id="proof-icon"]').click();
  await page.waitForTimeout(160);
  const layerRestored=await page.evaluate(()=>{
    const timelineDocument=window.D1_407F_ENGINEERING.store.document;
    return{
      scene:(timelineDocument.advanced.scene?.objects||[]).map(({id,z})=>({id,z})).sort((a,b)=>a.z-b.z),
      dom:[...globalThis.document.querySelectorAll('.canvas-screen svg [data-scene-object]')].map((node)=>({id:node.dataset.sceneObject,z:Number(node.dataset.sceneZ)}))
    };
  });
  invariant(JSON.stringify(order(layerRestored))===JSON.stringify(order(layerBefore)),
    `send-backward did not restore global order: ${JSON.stringify({layerBefore,layerForward,layerRestored})}`);
  return{layerBefore,layerForward,layerRestored};
});

await check("object lock blocks drag and unlock restores manipulation",async()=>{
  await select(element("proof-icon"),"element","proof-icon");
  await page.locator('[data-advanced-object-action="lock"][data-advanced-target-id="proof-icon"]').click();
  const locked=await geometry("element","proof-icon");
  const lockedTarget=element("proof-icon");
  await dragLocator(lockedTarget,40,20);
  const blocked=await geometry("element","proof-icon");
  invariant(locked.locked&&blocked.x===locked.x&&blocked.y===locked.y,"locked object moved");
  await lockedTarget.click();
  await page.locator('[data-advanced-object-action="unlock"][data-advanced-target-id="proof-icon"]').click();
  invariant((await geometry("element","proof-icon")).locked===false,"unlock did not persist");
  return{locked:true,blocked:true,unlocked:true};
});

await check("object center snapping shows both temporary guides and commits",async()=>{
  const current=await geometry("element","proof-icon");
  const svgBox=await svg().boundingBox();
  const objectBox=await element("proof-icon").boundingBox();
  invariant(svgBox&&objectBox,"snap geometry unavailable");
  const targetModel={x:960-current.width/2,y:540-current.height/2};
  const dx=(targetModel.x-current.x)*svgBox.width/1920;
  const dy=(targetModel.y-current.y)*svgBox.height/1080;
  const guideCount=await dragLocator(element("proof-icon"),dx,dy,{
    steps:18,
    inspect:()=>page.locator('[data-advanced-alignment-guide]').count()
  });
  const snapped=await geometry("element","proof-icon");
  invariant(guideCount>=2,`center snap did not show both guides (${guideCount})`);
  invariant(Math.abs(snapped.x+snapped.width/2-960)<.5&&Math.abs(snapped.y+snapped.height/2-540)<.5,
    `object did not snap to center: ${JSON.stringify(snapped)}`);
  return{guideCount,snapped};
});

await check("shift multi-select, Group, group move/resize, undo/redo, and Ungroup",async()=>{
  await element("proof-shape").click();
  await textObject("proof-text").click({modifiers:["Shift"]});
  const groupButton=page.locator("[data-advanced-group-members]");
  await groupButton.waitFor({state:"visible"});
  await groupButton.click();
  await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.advanced.groups.length===1);
  const groupId=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.groups[0].id);
  const beforeMembers=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);

  await element("proof-shape").click();
  await directSelection("group",groupId).waitFor({state:"visible"});
  await dragLocator(element("proof-shape"),52,31);
  const movedMembers=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);
  invariant(movedMembers.every((item,index)=>item.x!==beforeMembers[index].x||item.y!==beforeMembers[index].y),
    `group move did not move every member: ${JSON.stringify({beforeMembers,movedMembers})}`);

  await element("proof-shape").click();
  await directSelection("group",groupId).waitFor({state:"visible"});
  await dragLocator(directHandle("group",groupId,"se"),48,32);
  const resizedMembers=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);
  invariant(resizedMembers.some((item,index)=>item.width!==movedMembers[index].width||item.height!==movedMembers[index].height),
    `group resize did not resize members: ${JSON.stringify({movedMembers,resizedMembers})}`);

  await page.locator('[data-canvas-action="undo"]').click();
  await page.waitForTimeout(180);
  const undone=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);
  await page.locator('[data-canvas-action="redo"]').click();
  await page.waitForTimeout(180);
  const redone=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);
  invariant(undone.some((item,index)=>item.width!==redone[index].width||item.height!==redone[index].height),"undo did not reverse group resize");
  invariant(redone.every((item,index)=>Math.abs(item.width-resizedMembers[index].width)<.01&&Math.abs(item.height-resizedMembers[index].height)<.01),
    `redo did not restore group resize: ${JSON.stringify({resizedMembers,redone})}`);

  await element("proof-shape").click();
  await page.locator(`[data-advanced-object-action="ungroup"][data-advanced-target-id="${groupId}"]`).click();
  await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.advanced.groups.length===0);
  const ungrouped=await Promise.all([geometry("element","proof-shape"),geometry("text","proof-text")]);
  invariant(ungrouped.every((item)=>item.groupId===null),`member groupId survived ungroup: ${JSON.stringify(ungrouped)}`);
  return{groupId,beforeMembers,movedMembers,resizedMembers,undo:true,redo:true,ungroup:true};
});

await check("Color Key directly moves and resizes as one composition",async()=>{
  const target=page.locator('.canvas-screen svg[data-founder-serializer] [data-artifact-chrome="color-key"]').first();
  const before=await geometry("color-key","color-key");
  await target.click();
  await directSelection("color-key","color-key").waitFor({state:"visible"});
  await dragLocator(target,58,-24);
  const moved=await geometry("color-key","color-key");
  invariant(moved.x!==before.x||moved.y!==before.y,`Color Key did not move: ${JSON.stringify({before,moved})}`);
  await target.click();
  await directSelection("color-key","color-key").waitFor({state:"visible"});
  await dragLocator(directHandle("color-key","color-key","se"),24,18);
  const resized=await geometry("color-key","color-key");
  invariant(resized.width!==moved.width||resized.height!==moved.height,`Color Key did not resize: ${JSON.stringify({moved,resized})}`);
  return{before,moved,resized};
});

await check("profile card directly moves and resizes as one composition",async()=>{
  const target=page.locator('.canvas-screen svg[data-founder-serializer] [data-artifact-chrome="profile"]').first();
  const before=await geometry("profile","profile");
  await target.click();
  await directSelection("profile","profile").waitFor({state:"visible"});
  await dragLocator(target,180,0);
  const moved=await geometry("profile","profile");
  invariant(moved.x!==before.x||moved.y!==before.y,`profile did not move: ${JSON.stringify({before,moved})}`);
  await target.click();
  await directSelection("profile","profile").waitFor({state:"visible"});
  await dragLocator(directHandle("profile","profile","se"),20,10);
  const resized=await geometry("profile","profile");
  invariant(resized.width!==moved.width||resized.height!==moved.height,`profile did not resize: ${JSON.stringify({moved,resized})}`);
  return{before,moved,resized};
});

await check("year-axis boundary changes adjacent weights live without remount",async()=>{
  const axisSegment=page.locator('.canvas-screen svg[data-founder-serializer] [data-axis-hit-target]').first();
  const axisBox=await axisSegment.boundingBox();
  invariant(axisBox,"year-axis segment has no bounds");
  await axisSegment.click({position:{x:Math.max(2,Math.min(axisBox.width-2,axisBox.width*.35)),y:Math.max(2,axisBox.height*.5)}});
  const handle=page.locator('[data-advanced-axis-boundary-handle]').first();
  await handle.waitFor({state:"visible"});
  const before=await page.evaluate(()=>{
    window.__axisProofSvg=document.querySelector('.canvas-screen svg[data-founder-serializer]');
    const weights=[...window.__axisProofSvg.querySelectorAll('[data-axis-segment-id]')].map((node)=>({
      id:node.dataset.axisSegmentId,weight:Number(node.dataset.axisSegmentWeight)||1
    }));
    return{weights,history:window.D1_407F_ENGINEERING.store.historyStatus()};
  });
  const box=await handle.boundingBox();
  invariant(box,"axis boundary handle has no bounds");
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+34,box.y+box.height/2,{steps:12});
  const live=await page.evaluate(()=>({
    same:window.__axisProofSvg===document.querySelector('.canvas-screen svg[data-founder-serializer]'),
    dragging:document.querySelectorAll('[data-advanced-axis-dragging]').length
  }));
  await page.mouse.up();
  await page.waitForTimeout(180);
  const committed=await page.evaluate(()=>({
    axis:window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis||null,
    history:window.D1_407F_ENGINEERING.store.historyStatus()
  }));
  invariant(live.same&&live.dragging===2,`axis did not update live on the mounted SVG: ${JSON.stringify(live)}`);
  invariant(committed.axis?.mode==="manual"&&committed.axis.segmentWeights?.length>=2,"axis weights did not persist");
  invariant(Math.abs(committed.axis.segmentWeights[0].weight-before.weights[0].weight)>.01,"axis boundary did not change its adjacent weights");
  const sumBefore=before.weights[0].weight+before.weights[1].weight;
  const sumAfter=committed.axis.segmentWeights[0].weight+committed.axis.segmentWeights[1].weight;
  invariant(Math.abs(sumAfter-sumBefore)<.000001,`axis pair total changed: ${sumBefore} -> ${sumAfter}`);
  invariant(committed.history.undoCount===before.history.undoCount+1,
    `axis gesture did not produce exactly one undoable commit: ${before.history.undoCount} -> ${committed.history.undoCount}`);

  await page.locator('[data-canvas-action="undo"]').click();
  await page.waitForTimeout(160);
  const undone=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis||null);
  await page.locator('[data-canvas-action="redo"]').click();
  await page.waitForTimeout(160);
  const redone=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis||null);
  invariant(JSON.stringify(undone?.segmentWeights||null)!==JSON.stringify(committed.axis.segmentWeights),"axis undo did not reverse weights");
  invariant(JSON.stringify(redone?.segmentWeights||null)===JSON.stringify(committed.axis.segmentWeights),"axis redo did not restore weights");

  await page.evaluate(()=>window.D1_407F_ENGINEERING.store.saveNow("FOUNDER_SHARED_EDITOR_BROWSER_PROOF"));
  await page.reload({waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await page.locator('#rail [data-v="canvas"]').click();
  await svg().waitFor({state:"visible"});
  const reloaded=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis||null);
  invariant(JSON.stringify(reloaded?.segmentWeights||null)===JSON.stringify(committed.axis.segmentWeights),"axis weights did not survive reload");
  return{before,live,committed:committed.axis,sumBefore,sumAfter,undo:true,redo:true,reloaded:true};
});

await check("zoom preserves the mounted Founder SVG node and selection",async()=>{
  await select(element("proof-shape"),"element","proof-shape");
  const before=await page.evaluate(()=>{
    window.__founderProofSvg=document.querySelector('.canvas-screen svg[data-founder-serializer]');
    window.__founderProofSvg.dataset.founderProofIdentity="same-node";
    return{
      revision:window.D1_407F_ENGINEERING.store.document.revision,
      selected:window.D1_407F_ENGINEERING.canvasController?.getUiState?.().advancedSelection||null
    };
  });
  await page.locator('[data-canvas-zoom="in"]').click();
  await page.locator('[data-canvas-zoom-percent]').fill("135");
  await page.locator('[data-canvas-zoom-percent]').press("Enter");
  await page.locator('[data-canvas-zoom="fit"]').click();
  const after=await page.evaluate(()=>({
    same:window.__founderProofSvg===document.querySelector('.canvas-screen svg[data-founder-serializer]'),
    marker:document.querySelector('.canvas-screen svg[data-founder-serializer]')?.dataset.founderProofIdentity||null,
    revision:window.D1_407F_ENGINEERING.store.document.revision,
    selected:window.D1_407F_ENGINEERING.canvasController?.getUiState?.().advancedSelection||null,
    loading:document.body.textContent.includes("LOADING CANONICAL TIMELINE")
  }));
  invariant(after.same&&after.marker==="same-node"&&after.revision===before.revision&&!after.loading,
    `zoom remounted or mutated the canvas: ${JSON.stringify({before,after})}`);
  const selectedOverlay=await directSelection("element","proof-shape").count();
  invariant(selectedOverlay===1,`zoom lost the visible selection overlay: ${selectedOverlay}`);
  return{before,after};
});

const finalScreenshot=await screenshot("final-founder-shared-editor");
const result={
  generatedAt:new Date().toISOString(),
  appUrl,
  captureDir,
  initialScreenshot,
  finalScreenshot,
  summary:{
    passed:checks.filter(({status})=>status==="PASS").length,
    failed:checks.filter(({status})=>status==="FAIL").length,
    total:checks.length
  },
  checks,
  browserErrors:[...new Set(browserErrors)]
};
writeFileSync(path.join(captureDir,"D1_FOUNDER_SHARED_EDITOR_BROWSER_RECEIPT.json"),`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result.summary));
await browser.close();
if(result.summary.failed||result.browserErrors.length)process.exitCode=1;
