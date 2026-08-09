import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8792/web/?matrixAppMode=local&returnUrl=%2Fmatrix%2Fdemo%2F";
const captureDir=process.env.D1_CAPTURE_DIR;
if(!captureDir)throw new Error("D1_CAPTURE_DIR is required.");
mkdirSync(captureDir,{recursive:true});
const {chromium}=require(playwrightRuntime);

function assert(condition,message){if(!condition)throw new Error(message);}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({
  viewport:{width:1680,height:1000},
  reducedMotion:"reduce",
  acceptDownloads:true
});
const page=await context.newPage();
const consoleErrors=[];
page.on("pageerror",(error)=>consoleErrors.push(`pageerror: ${error.message}`));
page.on("console",(message)=>{
  if(message.type()!=="error")return;
  const location=message.location?.()||{};
  if(String(location.url||"").endsWith("/favicon.ico"))return;
  consoleErrors.push(`console: ${message.text()}${location.url?` (${location.url})`:""}`);
});
await page.goto(appUrl,{waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);

await page.evaluate(()=>{
  const api=window.D1_407F_ENGINEERING;
  const document=api.store.snapshot();
  document.mode="advanced";
  document.title="RC1 Export Fidelity Proof";
  document.studentProfile={
    ...document.studentProfile,
    fullName:"Dr. RC1 Export Proof",
    currentUsWorkAuthorization:"Permanent Resident / Green Card",
    specialtyGoal:"Internal Medicine"
  };
  document.events=[{
    id:"rc1-export-event",title:"Internal Medicine Residency Preparation",
    categoryId:"education",eventType:"duration",startDate:"2025-07",endDate:"2026-06",
    openEnded:false,visibilityState:"INTERVIEWER_SAFE",siteName:"MissionMed Institute",
    sourceType:"rc1-export-proof",notes:"",lane:0,fields:{hiddenInActiveVariant:false}
  }];
  document.advanced={
    media:[],recentColors:[],
    background:{kind:"preset",preset:"gradient-dawn",dim:0},
    groups:[{
      id:"rc1-proof-group",type:"group",label:"Proof composition",locked:false,
      aspectLocked:true,children:[
        {type:"element",id:"rc1-proof-card"},{type:"text",id:"rc1-proof-text"}
      ]
    }],
    textBlocks:[{
      id:"rc1-proof-text",type:"text",text:"Interview-ready RC1",x:1110,y:330,
      width:430,height:76,font:"Inter",size:34,weight:800,color:"#17324A",
      alignment:"center",locked:false,aspectLocked:false,layerIndex:6,groupId:"rc1-proof-group"
    }],
    elements:[
      {id:"rc1-proof-card",type:"element",kind:"rounded-rectangle",x:1060,y:285,width:530,height:170,fill:"#F8F1E8",stroke:"#2C6E8F",label:"",countryCode:"US",locked:false,aspectLocked:true,layerIndex:5,groupId:"rc1-proof-group"},
      {id:"rc1-proof-brand",type:"element",kind:"missionmed-wordmark",x:1130,y:520,width:360,height:99,fill:"#0B1320",stroke:"#2B3A50",label:"MissionMed wordmark",countryCode:"US",locked:false,aspectLocked:true,layerIndex:7},
      {id:"rc1-proof-flag",type:"element",kind:"country-flag",x:1010,y:690,width:120,height:120,fill:"#FFFFFF",stroke:"#17324A",label:"United States",countryCode:"US",locked:false,aspectLocked:true,layerIndex:8},
      {id:"rc1-proof-hospital",type:"element",kind:"hospital",x:1210,y:690,width:120,height:120,fill:"#2C6E8F",stroke:"#17324A",label:"Hospital",countryCode:"US",locked:false,aspectLocked:true,layerIndex:9},
      {id:"rc1-proof-arrow",type:"element",kind:"arrow-right",x:1410,y:700,width:220,height:96,fill:"#D8892F",stroke:"#17324A",label:"",countryCode:"US",locked:false,aspectLocked:true,layerIndex:10}
    ]
  };
  api.store.replace(document,{label:"RC1 export fidelity browser fixture",history:false});
  api.applyDocument();
});

const navigate=async(route)=>{
  await page.locator(`#rail [data-v="${route}"]`).click();
  await page.waitForFunction((expected)=>document.querySelector('#rail [aria-current="page"]')?.dataset.v===expected,route);
};
const kernel=async(surface)=>{
  const host=page.locator(`d1-timeline-kernel[data-surface="${surface}"]:visible`).first();
  await host.waitFor({state:"visible",timeout:12000});
  await page.waitForFunction((expected)=>{
    const host=[...document.querySelectorAll(`d1-timeline-kernel[data-surface="${expected}"]`)].find((node)=>node.offsetWidth||node.offsetHeight);
    return host?.dataset.ready==="true";
  },surface,{timeout:12000});
  return host;
};
const inspect=async(host)=>{
  const frame=host.locator("iframe").contentFrame();
  return frame.locator("#board").evaluate((board)=>({
    background:getComputedStyle(board).backgroundImage||getComputedStyle(board).backgroundColor,
    advancedObjects:board.querySelectorAll("#d1411a-advanced-overlay .d1411aAdvanced").length,
    text:board.textContent.includes("Interview-ready RC1"),
    wordmark:board.querySelector('[data-advanced-kind="missionmed-wordmark"]')?.textContent.trim()||"",
    flag:board.querySelector('[data-advanced-kind="country-flag"]')?.textContent.trim()||""
  }));
};

await navigate("canvas");
const editHost=await kernel("edit");
const editState=await inspect(editHost);
assert(editState.advancedObjects===6,`Expected 6 editable objects, received ${editState.advancedObjects}.`);
assert(editState.background.includes("linear-gradient"),`Advanced background missing: ${editState.background}`);
assert(editState.text&&editState.wordmark.includes("MissionMed")&&editState.flag,"Advanced composition is incomplete.");
await editHost.locator("iframe").contentFrame().locator("#board").screenshot({path:path.join(captureDir,"RC1_EDITOR_CANVAS.png")});

await navigate("export");
let exportHost=await kernel("export");
const exportState=await inspect(exportHost);
assert(JSON.stringify(exportState)===JSON.stringify(editState),`Edit/export DOM mismatch: ${JSON.stringify({editState,exportState})}`);
await exportHost.locator("iframe").contentFrame().locator("#board").screenshot({path:path.join(captureDir,"RC1_EXPORT_PREVIEW.png")});

const button=page.locator("[data-export-action]");
const [png]=await Promise.all([page.waitForEvent("download",{timeout:120000}),button.click()]);
await png.saveAs(path.join(captureDir,"RC1_TIMELINE_1920x1080.png"));

await page.locator('[name="export-format"][value="pdf-letter-landscape"]').check();
const suggestion=page.locator("[data-export-suggestion-dismiss]");
if(await suggestion.count())await suggestion.click();
const [letter]=await Promise.all([page.waitForEvent("download",{timeout:120000}),page.locator("[data-export-action]").click()]);
await letter.saveAs(path.join(captureDir,"RC1_TIMELINE_LETTER.pdf"));

await page.locator('[name="export-format"][value="pdf-a4-landscape"]').check();
const [a4]=await Promise.all([page.waitForEvent("download",{timeout:120000}),page.locator("[data-export-action]").click()]);
await a4.saveAs(path.join(captureDir,"RC1_TIMELINE_A4.pdf"));

assert(consoleErrors.length===0,consoleErrors.join("\n"));
const receipt={
  generatedAt:new Date().toISOString(),appUrl,chromeExecutable,
  editState,exportState,consoleErrors,
  artifacts:["RC1_EDITOR_CANVAS.png","RC1_EXPORT_PREVIEW.png","RC1_TIMELINE_1920x1080.png","RC1_TIMELINE_LETTER.pdf","RC1_TIMELINE_A4.pdf"]
};
writeFileSync(path.join(captureDir,"RC1_EXPORT_BROWSER_RECEIPT.json"),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));
await context.close();
await browser.close();
