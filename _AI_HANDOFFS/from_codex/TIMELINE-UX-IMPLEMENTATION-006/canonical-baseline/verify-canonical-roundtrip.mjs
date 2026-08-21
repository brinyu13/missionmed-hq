import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const runtimeRoot="/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const {chromium}=require(`${runtimeRoot}/playwright`);
const sharp=require(`${runtimeRoot}/sharp`);
const pixelmatch=require(`${runtimeRoot}/pixelmatch`).default;
const chromeExecutable="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8793/web/?matrixAppMode=local&returnUrl=%2Fmatrix%2Fdemo%2F&entitlement=administrator";
const outputDir=path.resolve(process.env.D1_CAPTURE_DIR||path.dirname(new URL(import.meta.url).pathname));
const acceptedReference=path.resolve("_AI_HANDOFFS/from_codex/TIMELINE-RC1-STABILIZATION-001/recovery-003/evidence/d1-411a-local-browser-valid/D1-411B_FULL_PREVIEW_ARTIFACT.png");
mkdirSync(outputDir,{recursive:true});

function assert(condition,message){if(!condition)throw new Error(message);}
function sha256(file){return createHash("sha256").update(readFileSync(file)).digest("hex");}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));
  return value;
}
function digest(value){return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");}

async function normalizedPixels(file){
  return sharp(file).resize(960,540,{fit:"fill"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
}
async function compareImages(reference,candidate){
  const [a,b]=await Promise.all([normalizedPixels(reference),normalizedPixels(candidate)]);
  const pixels=a.info.width*a.info.height;
  const diffPixels=pixelmatch(a.data,b.data,null,a.info.width,a.info.height,{threshold:0.12,includeAA:false});
  return{reference:path.basename(reference),candidate:path.basename(candidate),diffPixels,totalPixels:pixels,diffRatio:+(diffPixels/pixels).toFixed(8),similarity:+(1-diffPixels/pixels).toFixed(8)};
}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({viewport:{width:1680,height:1000},reducedMotion:"reduce",acceptDownloads:true});
const page=await context.newPage();
const browserErrors=[];
page.on("pageerror",(error)=>browserErrors.push(`pageerror: ${error.message}`));
page.on("console",(message)=>{if(message.type()==="error"&&!message.text().includes("favicon"))browserErrors.push(`console: ${message.text()}`);});
page.on("requestfailed",(request)=>{
  const reason=request.failure()?.errorText||"unknown";
  if(reason.includes("ERR_ABORTED")&&request.url().includes("/presentation/d1-409h-a1/"))return;
  browserErrors.push(`requestfailed: ${request.url()} ${reason}`);
});

const boot=async()=>{
  await page.goto(appUrl,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&!!window.D1_407F_TEST);
};
const navigate=async(route)=>{
  await page.locator(`#rail [data-v="${route}"]`).click();
  await page.waitForFunction((expected)=>document.querySelector('#rail [aria-current="page"]')?.dataset.v===expected,route);
};
const kernel=async(surface)=>{
  const host=page.locator(`d1-timeline-kernel[data-surface="${surface}"]:visible`).first();
  await host.waitFor({state:"visible",timeout:12000});
  await page.waitForFunction((expected)=>{
    const candidate=[...document.querySelectorAll(`d1-timeline-kernel[data-surface="${expected}"]`)].find((node)=>node.offsetWidth||node.offsetHeight);
    return candidate?.dataset.ready==="true";
  },surface,{timeout:12000});
  assert(await host.getAttribute("data-protected-kernel")==="D1-409H-A1",`${surface} did not use D1-409H-A1`);
  return host;
};
const evidence=async(host)=>{
  const frame=host.locator("iframe").contentFrame();
  const hostData=await host.evaluate((element)=>({
    fingerprint:element.dataset.fingerprint,
    renderId:element.dataset.renderId,
    protectedKernel:element.dataset.protectedKernel,
    projectionWarnings:element.dataset.projectionWarnings||"",
    source:element.shadowRoot?.querySelector("iframe")?.src||""
  }));
  const visual=await frame.locator("#board").evaluate((board)=>{
    const snapshot=board.ownerDocument.defaultView.D1409H.getSnapshot();
    if(snapshot)delete snapshot.revision;
    const css=getComputedStyle(board);
    return{
      visualModel:snapshot,
      backgroundImage:css.backgroundImage,
      backgroundColor:css.backgroundColor,
      className:board.className,
      width:board.offsetWidth,
      height:board.offsetHeight,
      title:board.querySelector("#plaque")?.textContent?.trim()||"",
      axis:[...board.querySelectorAll("#axis .yseg span")].map((node)=>node.textContent.trim()),
      arrows:board.querySelectorAll(".arrow[data-object-id]").length,
      colorKeyRows:board.querySelectorAll("#key .row").length,
      profilePresent:!!board.querySelector("#profile")
    };
  });
  return{host:hostData,visual,visualDigest:digest(visual)};
};
const captureBoard=async(host,name)=>{
  const file=path.join(outputDir,name);
  await host.locator("iframe").contentFrame().locator("#board").screenshot({path:file});
  return file;
};
const capturePage=async(name)=>{
  const file=path.join(outputDir,name);
  await page.screenshot({path:file,fullPage:true});
  return file;
};
const openFullPreview=async()=>{
  await navigate("builder");
  await page.locator("#builderPreviewToggle").click();
  return kernel("full-preview");
};

await boot();
await page.evaluate(async()=>{
  const api=window.D1_407F_ENGINEERING;
  const document=api.store.snapshot();
  document.title="Browser Kernel Student";
  document.mode="advanced";
  document.studentProfile={
    ...document.studentProfile,
    fullName:"Browser Kernel Student",
    medicalSchool:"MissionMed Medical School",
    medicalSchoolCountry:"United States",
    graduationDate:"2024-05",
    specialtyGoal:"Internal Medicine"
  };
  document.metadata={...document.metadata,stickyNote:"",interview:{prog:"",specialty:"",date:"",dateDisplay:"",label:""}};
  document.events=Array.from({length:7},(_,index)=>({
    id:`d1-411b-browser-${index}`,
    title:`Event ${index+1}`,
    categoryId:["work","clinical","education","research","exams","personal"][index%6],
    eventType:"duration",
    startDate:`${2010+index}-${String(index%9+1).padStart(2,"0")}`,
    endDate:`${2010+index}-${String(index%9+3).padStart(2,"0")}`,
    openEnded:false,
    visibilityState:"INTERVIEWER_SAFE",
    siteName:"",
    sourceType:"d1-411b-browser",
    notes:"",
    lane:index%7,
    fields:{hiddenInActiveVariant:false}
  }));
  document.advanced={media:[],recentColors:[],background:null,groups:[],textBlocks:[],elements:[],enteredBefore:true};
  delete document.presentationOverrides;
  api.store.replace(document,{label:"CANONICAL VISUAL REGRESSION FIXTURE",history:false});
  api.applyDocument();
  await api.store.saveNow("CANONICAL_VISUAL_REGRESSION_FIXTURE");
});

const stateBefore=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.snapshot());
const stateBeforeDigest=digest(stateBefore);
let host=await openFullPreview();
const baseline=await evidence(host);
const baselineFile=await captureBoard(host,"01_CANONICAL_BASELINE_BEFORE_EDITOR.png");
await page.locator("[data-builder-preview-close]").click();

await navigate("canvas");
host=await kernel("edit");
const editorEntry=await evidence(host);
const editorFile=await captureBoard(host,"02_CANONICAL_EDITOR_ENTRY_NO_EDITS.png");
const editorPageFile=await capturePage("02A_CANONICAL_EDITOR_ENTRY_NO_EDITS_FULL_UI.png");
const panelIds=await page.locator("[data-advanced-panel]").evaluateAll((nodes)=>nodes.filter((node)=>node.offsetWidth||node.offsetHeight).map((node)=>node.dataset.advancedPanel));
for(const panelId of panelIds)await page.locator(`[data-advanced-panel="${panelId}"]`).click();
for(const zoom of ["100","150","fit"]){
  await page.locator(`[data-canvas-zoom="${zoom}"]`).click();
  await page.waitForFunction((value)=>document.querySelector(`[data-canvas-zoom="${value}"]`)?.getAttribute("aria-pressed")==="true",zoom);
}
const hostAfterNavigation=await kernel("edit");
const afterPanelZoom=await evidence(hostAfterNavigation);
await page.evaluate(()=>window.D1_407F_ENGINEERING.store.saveNow("CANONICAL_NO_EDIT_ROUNDTRIP"));
await page.waitForTimeout(350);

await page.reload({waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&!!window.D1_407F_TEST);
const matrixTarget=await page.locator("#matrixBack").getAttribute("href");
assert(matrixTarget==="/matrix/demo/",`unexpected Matrix return target: ${matrixTarget}`);
await page.goto(new URL(matrixTarget,appUrl).href,{waitUntil:"domcontentloaded"});
await page.goBack({waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&!!window.D1_407F_TEST);
const stateAfter=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.snapshot());
const stateAfterDigest=digest(stateAfter);
host=await openFullPreview();
const afterReload=await evidence(host);
const reloadFile=await captureBoard(host,"03_CANONICAL_AFTER_SAVE_RELOAD_MATRIX_RETURN.png");
await page.locator("[data-builder-preview-close]").click();

await navigate("export");
host=await kernel("export");
const exportPreview=await evidence(host);
const exportPreviewFile=await captureBoard(host,"04_CANONICAL_EXPORT_PREVIEW.png");
const exportPageFile=await capturePage("04A_CANONICAL_EXPORT_PREVIEW_FULL_UI.png");
const exportButton=page.locator("[data-export-action]");
const [png]=await Promise.all([page.waitForEvent("download",{timeout:120000}),exportButton.click()]);
const pngFile=path.join(outputDir,"05_CANONICAL_EXPORT_1920x1080.png");
await png.saveAs(pngFile);
await page.locator('[name="export-format"][value="pdf-letter-landscape"]').check();
const suggestion=page.locator("[data-export-suggestion-dismiss]");
if(await suggestion.count())await suggestion.click();
const [letter]=await Promise.all([page.waitForEvent("download",{timeout:120000}),exportButton.click()]);
const letterFile=path.join(outputDir,"06_CANONICAL_EXPORT_LETTER.pdf");
await letter.saveAs(letterFile);
await page.locator('[name="export-format"][value="pdf-a4-landscape"]').check();
const [a4]=await Promise.all([page.waitForEvent("download",{timeout:120000}),exportButton.click()]);
const a4File=path.join(outputDir,"07_CANONICAL_EXPORT_A4.pdf");
await a4.saveAs(a4File);

const models=[baseline,editorEntry,afterPanelZoom,afterReload,exportPreview];
assert(new Set(models.map((item)=>item.visualDigest)).size===1,"Canonical visual model drifted during the no-edit roundtrip");
const comparisons=[];
for(const file of [editorFile,reloadFile,exportPreviewFile,pngFile,acceptedReference])comparisons.push(await compareImages(baselineFile,file));
assert(browserErrors.length===0,browserErrors.join("\n"));

const receipt={
  generatedAt:new Date().toISOString(),
  fixture:{id:"CANONICAL VISUAL REGRESSION FIXTURE",immutableDuringTest:true,source:"D1-409H-A1 plus deterministic seven-event D1-411B representative fixture"},
  appUrl,
  sourceCommit:"14fb4dd3258fb8bf920910fc066495e9835503f5",
  protectedKernel:"D1-409H-A1",
  matrixTarget,
  panelsVisited:panelIds,
  zoomSequence:["100","150","fit"],
  stateBeforeDigest,
  stateAfterDigest,
  stateDigestStable:stateBeforeDigest===stateAfterDigest,
  visualDigest:baseline.visualDigest,
  rendererFingerprints:Object.fromEntries([
    ["baseline",baseline.host.fingerprint],
    ["editorEntry",editorEntry.host.fingerprint],
    ["afterPanelZoom",afterPanelZoom.host.fingerprint],
    ["afterReload",afterReload.host.fingerprint],
    ["exportPreview",exportPreview.host.fingerprint]
  ]),
  modelDigestStable:new Set(models.map((item)=>item.visualDigest)).size===1,
  rendererFingerprintStableWithinEquivalentViews:baseline.host.fingerprint===afterReload.host.fingerprint,
  evidence:{baseline,editorEntry,afterPanelZoom,afterReload,exportPreview},
  comparisons,
  browserErrors,
  artifacts:[baselineFile,editorFile,editorPageFile,reloadFile,exportPreviewFile,exportPageFile,pngFile,letterFile,a4File].map((file)=>({file:path.basename(file),sha256:sha256(file)}))
};
writeFileSync(path.join(outputDir,"CANONICAL_ROUNDTRIP_RECEIPT.json"),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));
await context.close();
await browser.close();
