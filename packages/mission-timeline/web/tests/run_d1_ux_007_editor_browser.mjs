import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8792/web/?entitlement=administrator";
const captureDir=String(process.env.D1_CAPTURE_DIR||"").trim();
if(!captureDir)throw new Error("D1_CAPTURE_DIR is required.");
mkdirSync(captureDir,{recursive:true});
const {chromium}=require(playwrightRuntime);
const checks=[];
function assert(condition,message){if(!condition)throw new Error(message);}
async function check(name,operation){
  const started=performance.now();
  const detail=await operation();
  checks.push({name,status:"PASS",durationMs:+(performance.now()-started).toFixed(1),detail:detail||null});
  console.log(`PASS ${name}`);
}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({viewport:{width:1720,height:1050},reducedMotion:"reduce",acceptDownloads:true});
const page=await context.newPage();
page.setDefaultTimeout(5000);
const browserErrors=[];
page.on("pageerror",(error)=>browserErrors.push(`pageerror:${error.message}`));
page.on("console",(message)=>{if(message.type()==="error"&&!message.text().includes("favicon"))browserErrors.push(`console:${message.text()}`);});
await page.goto(appUrl,{waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
await page.evaluate(()=>{
  const api=window.D1_407F_ENGINEERING;
  const document=api.store.snapshot();
  document.mode="advanced";
  document.title="UX-007 Editor Interaction Proof";
  document.studentProfile={...document.studentProfile,fullName:"UX-007 Browser Student",specialtyGoal:"Internal Medicine"};
  document.events=[{id:"ux007-event",title:"Internal Medicine Residency Preparation",categoryId:"education",eventType:"duration",startDate:"2025-07",endDate:"2026-06",openEnded:false,visibilityState:"INTERVIEWER_SAFE",siteName:"MissionMed Institute",sourceType:"ux007",notes:"",lane:0,fields:{hiddenInActiveVariant:false}}];
  document.advanced={
    media:[],groups:[{id:"ux007-group",type:"group",label:"Story composition",locked:false,aspectLocked:true,children:[{type:"element",id:"ux007-shape"},{type:"text",id:"ux007-text"}]}],recentColors:[],background:{kind:"preset",preset:"gradient-dawn",dim:0},
    textBlocks:[{id:"ux007-text",type:"text",text:"Editable story",x:1080,y:500,width:320,height:90,font:"Inter",size:30,weight:700,color:"#17324A",alignment:"center",fitMode:"auto",minFontSize:10,lineHeight:1.2,verticalAlign:"center",locked:false,aspectLocked:false,layerIndex:5,zIndex:5,groupId:"ux007-group"}],
    elements:[
      {id:"ux007-shape",type:"element",kind:"rounded-rectangle",x:980,y:260,width:420,height:170,fill:"#F8F1E8",stroke:"#2C6E8F",label:"Story card",countryCode:"US",locked:false,aspectLocked:true,layerIndex:4,zIndex:4,groupId:"ux007-group"},
      {id:"ux007-icon",type:"element",kind:"hospital",x:1450,y:650,width:112,height:112,fill:"#2C6E8F",stroke:"#17324A",label:"Hospital",countryCode:"US",locked:false,aspectLocked:true,layerIndex:6,zIndex:6}
    ]
  };
  api.store.replace(document,{label:"UX-007 interaction fixture",history:false});
  api.applyDocument();
});
await page.locator('#rail [data-v="canvas"]').click();
await page.waitForFunction(()=>document.querySelector('#rail [aria-current="page"]')?.dataset.v==="canvas");
await page.waitForTimeout(1200);
const kernelBoot=await page.evaluate(()=>[...document.querySelectorAll('d1-timeline-kernel[data-surface="edit"]')].map((node)=>({
  visible:!!(node.offsetWidth||node.offsetHeight),...node.dataset
})));
assert(kernelBoot.some((item)=>item.visible&&item.ready==="true"),`edit kernel did not start: ${JSON.stringify(kernelBoot)}`);

const host=()=>page.locator('d1-timeline-kernel[data-surface="edit"][data-ready="true"]:visible').first();
const frame=()=>host().locator("iframe").contentFrame();
const object=(id)=>frame().locator(`[data-advanced-id="${id}"]`);
const geometry=async(id)=>page.evaluate((targetId)=>{
  const document=window.D1_407F_ENGINEERING.store.document;
  const item=[...(document.advanced?.media||[]),...(document.advanced?.textBlocks||[]),...(document.advanced?.elements||[])].find((entry)=>String(entry.id)===targetId);
  return item?{x:item.x,y:item.y,width:item.width,height:item.height,locked:item.locked,aspectLocked:item.aspectLocked,zIndex:item.zIndex,layerIndex:item.layerIndex,text:item.text}:null;
},id);
const dragLocator=async(locator,dx,dy)=>{
  const box=await locator.boundingBox();assert(box,"drag target has no bounds");
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:12});
  await page.mouse.up();
  await page.waitForTimeout(180);
};
const resize=async(id,handle,dx,dy)=>{
  await object(id).click();await page.waitForTimeout(100);
  await dragLocator(object(id).locator(`.d1411aHandle[data-handle="${handle}"]`),dx,dy);
};

await check("1 smooth pointer drag commits once",async()=>{
  const before=await geometry("ux007-icon");
  await dragLocator(object("ux007-icon"),90,-35);
  const after=await geometry("ux007-icon");
  assert(after.x!==before.x||after.y!==before.y,"pointer drag did not commit");
  return{before,after};
});

await check("2 proportional and freeform resize",async()=>{
  const before=await geometry("ux007-icon");
  await resize("ux007-icon","se",70,70);
  const proportional=await geometry("ux007-icon");
  assert(Math.abs(proportional.width/proportional.height-before.width/before.height)<.03,"corner resize lost aspect ratio");
  await object("ux007-icon").click();
  const aspect=page.locator('[data-advanced-aspect-lock][data-advanced-target-id="ux007-icon"]');
  await aspect.uncheck();
  await resize("ux007-icon","e",90,0);
  const freeform=await geometry("ux007-icon");
  assert(Math.abs(freeform.height-proportional.height)<2&&freeform.width>proportional.width,"unlocked side resize was not freeform");
  return{before,proportional,freeform};
});

await check("3 object lock blocks pointer mutation and unlock restores it",async()=>{
  await object("ux007-icon").click();
  await page.locator('[data-advanced-object-action="lock"][data-advanced-target-id="ux007-icon"]').click();
  const locked=await geometry("ux007-icon");
  await dragLocator(object("ux007-icon"),65,20);
  const afterAttempt=await geometry("ux007-icon");
  assert(afterAttempt.x===locked.x&&afterAttempt.y===locked.y,"locked object moved");
  await object("ux007-icon").click();
  await page.locator('[data-advanced-object-action="unlock"][data-advanced-target-id="ux007-icon"]').click();
  assert((await geometry("ux007-icon")).locked===false,"object did not unlock");
  return{locked:true,blocked:true,unlocked:true};
});

await check("4 direct inline text editing",async()=>{
  await frame().locator("body").evaluate((body)=>{
    const view=body.ownerDocument.defaultView;
    view.__ux007PointerTrace=[];
    for(const type of ["pointerdown","dblclick","focusin","focusout"]){
      body.ownerDocument.addEventListener(type,(event)=>view.__ux007PointerTrace.push({
        type,detail:event.detail,target:event.target?.className||event.target?.tagName,
        under:Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)
          ?body.ownerDocument.elementsFromPoint(event.clientX,event.clientY).map((node)=>node.className||node.tagName).slice(0,6)
          :[]
      }),{capture:true,once:false});
    }
  });
  await object("ux007-text").dblclick();
  await object("ux007-text").waitFor({state:"visible"});
  const editable=await object("ux007-text").getAttribute("contenteditable");
  const trace=await frame().locator("body").evaluate((body)=>({events:body.ownerDocument.defaultView.__ux007PointerTrace,active:body.ownerDocument.activeElement?.className||body.ownerDocument.activeElement?.tagName}));
  assert(editable==="true",`text did not enter direct editing: ${JSON.stringify(trace)}`);
  await page.keyboard.press("Meta+A");
  await page.keyboard.type("Edited directly on canvas");
  await page.keyboard.press("Meta+Enter");
  await page.waitForTimeout(180);
  const result=await geometry("ux007-text");
  assert(result.text==="Edited directly on canvas","direct text did not commit");
  return result.text;
});

await check("5 modifier multi-select, group, move, resize, and ungroup",async()=>{
  await object("ux007-shape").click();
  await frame().locator(".d1411aGroupBox").waitFor({state:"visible"});
  const groupBefore=await frame().locator(".d1411aGroupBox").boundingBox();
  await dragLocator(frame().locator(".d1411aGroupBox"),60,35);
  const moved=await frame().locator(".d1411aGroupBox").boundingBox();
  const movedMembers=await Promise.all([geometry("ux007-shape"),geometry("ux007-text")]);
  assert(moved.x!==groupBefore.x||moved.y!==groupBefore.y,`group did not move: ${JSON.stringify({groupBefore,moved,movedMembers})}`);
  await dragLocator(frame().locator('.d1411aGroupBox .d1411aHandle[data-handle="se"]'),80,45);
  const resized=await frame().locator(".d1411aGroupBox").boundingBox();
  assert(resized.width>moved.width&&resized.height>moved.height,`group did not resize: ${JSON.stringify({moved,resized})}`);
  await page.locator('[data-advanced-object-action="ungroup"]').click();
  await object("ux007-shape").click();
  await page.waitForTimeout(180);
  assert(await object("ux007-shape").getAttribute("data-selected")==="true","shape selection was not retained before modifier selection");
  await object("ux007-text").click({modifiers:["Shift"]});
  const groupControl=page.locator("[data-advanced-group-members]");
  try{await groupControl.waitFor({state:"visible",timeout:2000});}
  catch{
    const diagnostic=await page.evaluate(()=>({ui:window.D1_407F_ENGINEERING.canvasController?.getUiState?.()||null,advanced:window.D1_407F_ENGINEERING.store.document.advanced}));
    const selected=await frame().locator('.d1411aAdvanced[data-selected="true"]').evaluateAll((nodes)=>nodes.map((node)=>({type:node.dataset.advancedType,id:node.dataset.advancedId,groupId:node.dataset.groupId})));
    throw new Error(`shift multi-select did not expose Group: ${JSON.stringify({selected,diagnostic})}`);
  }
  await groupControl.click();
  await frame().locator(".d1411aGroupBox").waitFor({state:"visible"});
  await page.locator('[data-advanced-object-action="ungroup"]').click();
  const groups=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.groups.length);
  assert(groups===0,"multi-selected objects did not group and ungroup");
  return{moved:true,resized:true,multiSelected:true,grouped:true,ungrouped:true};
});

await check("6 click-to-add and rail-to-canvas drag",async()=>{
  assert(!page.isClosed(),"browser page closed before rail verification");
  assert(await page.locator('[data-advanced-panel="shapes"]').count()>0,"Shapes library control is absent after group operations");
  await page.locator('[data-advanced-panel="shapes"]').click();
  const rectangle=page.locator('[data-advanced-insert-asset][data-advanced-kind="rectangle"]').first();
  const before=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.elements.length);
  await rectangle.click();await page.waitForTimeout(150);
  const afterClick=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.advanced.elements.length);
  assert(afterClick===before+1,"click-to-add failed");
  await page.locator('[data-advanced-panel="elements"]').click();
  const railArrow=page.locator('[data-advanced-insert-asset][data-advanced-kind="arrow-right"]').first();
  const railBox=await railArrow.boundingBox();
  const boardBox=await frame().locator("#board").boundingBox();
  assert(railBox&&boardBox,"rail or protected canvas bounds unavailable");
  await page.mouse.move(railBox.x+railBox.width/2,railBox.y+railBox.height/2);
  await page.mouse.down();
  await page.mouse.move(boardBox.x+boardBox.width*(1500/1920),boardBox.y+boardBox.height*(820/1080),{steps:16});
  await page.mouse.up();
  await page.waitForTimeout(220);
  const state=await page.evaluate(()=>({
    count:window.D1_407F_ENGINEERING.store.document.advanced.elements.length,
    arrow:window.D1_407F_ENGINEERING.store.document.advanced.elements.find((item)=>item.kind==="arrow-right")||null
  }));
  assert(state.count===afterClick+1&&state.arrow,"rail drag/drop did not add an arrow");
  assert(Math.abs(state.arrow.x-1500)<50&&Math.abs(state.arrow.y-820)<50,`rail drop ignored the intended canvas position: ${JSON.stringify(state.arrow)}`);
  return{clickAdded:1,dragAdded:state.arrow.kind,position:{x:state.arrow.x,y:state.arrow.y}};
});

await check("7 working library panels and full flag architecture",async()=>{
  const result={};
  for(const panel of ["elements","shapes","icons","flags","text","backgrounds","brand"]){
    await page.locator(`[data-advanced-panel="${panel}"]`).click();
    result[panel]=panel==="backgrounds"
      ?await page.locator("[data-background-preset]").count()
      :await page.locator("[data-advanced-asset-rail] [data-advanced-insert-asset]").count();
  }
  assert(result.elements>5&&result.shapes>10&&result.icons>20&&result.flags>100&&result.text>=2&&result.backgrounds>=12&&result.brand>=1,"one or more visible library panels are empty or shallow");
  return result;
});

await check("8 zoom is viewport-only and keeps the canvas mounted",async()=>{
  const iframeBefore=await host().locator("iframe").evaluate((node)=>node.dataset.ux007Identity="preserved");
  const revisionBefore=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.revision);
  await page.locator('[data-canvas-zoom="in"]').click();
  await page.locator("[data-canvas-zoom-percent]").fill("135");
  await page.locator("[data-canvas-zoom-percent]").press("Enter");
  await page.locator('[data-canvas-zoom="fit"]').click();
  const state=await page.evaluate(()=>({revision:window.D1_407F_ENGINEERING.store.document.revision,loading:document.body.textContent.includes("LOADING CANONICAL TIMELINE")}));
  const preserved=await host().locator("iframe").getAttribute("data-ux007-identity");
  assert(preserved==="preserved"&&!state.loading&&state.revision===revisionBefore,"zoom remounted or mutated the Timeline document");
  return{mounted:true,documentRevisionStable:true};
});

await check("9 undo and redo direct manipulation",async()=>{
  const before=await geometry("ux007-icon");
  await object("ux007-icon").click();
  await page.waitForTimeout(100);
  // Earlier resize coverage can leave this object flush against the right edge.
  // Exercise history in the available direction so the gesture represents a real
  // mutation instead of a correctly clamped no-op.
  await dragLocator(object("ux007-icon"),-24,0);
  const moved=await geometry("ux007-icon");
  await page.locator('[data-canvas-action="undo"]').click();await page.waitForTimeout(120);
  const undone=await geometry("ux007-icon");
  await page.locator('[data-canvas-action="redo"]').click();await page.waitForTimeout(120);
  const redone=await geometry("ux007-icon");
  assert(moved.x!==before.x&&undone.x===before.x&&redone.x===moved.x,`undo/redo did not preserve direct manipulation history: ${JSON.stringify({before,moved,undone,redone})}`);
  return{before:before.x,moved:moved.x,undone:undone.x,redone:redone.x};
});

await host().screenshot({path:path.join(captureDir,"UX007_ADVANCED_STUDIO_AFTER.png")});
assert(browserErrors.length===0,browserErrors.join("\n"));
const receipt={generatedAt:new Date().toISOString(),appUrl,checks,browserErrors,passed:checks.length,failed:0};
writeFileSync(path.join(captureDir,"UX007_EDITOR_BROWSER_RECEIPT.json"),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));
await context.close();
await browser.close();
