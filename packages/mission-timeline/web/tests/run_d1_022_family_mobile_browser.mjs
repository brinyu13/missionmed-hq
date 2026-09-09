import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {mkdirSync,readFileSync,statSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8793/web/?entitlement=eligible-360";
const captureDir=process.env.D1_CAPTURE_DIR||"/private/tmp/d1-022-family-mobile-browser";
mkdirSync(captureDir,{recursive:true});

const {chromium}=require(playwrightRuntime);
const checks=[];
const screenshots=[];
const browserErrors=[];
let screenshotIndex=0;

function invariant(condition,message){if(!condition)throw new Error(message);}
function artifact(name){return path.join(captureDir,name);}
function sha256(file){return createHash("sha256").update(readFileSync(file)).digest("hex");}

async function capture(page,label){
  const file=artifact(`${String(++screenshotIndex).padStart(2,"0")}-${label}.png`);
  await page.screenshot({path:file,fullPage:true});
  screenshots.push(file);
  return file;
}

async function runCheck(name,proofKind,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    checks.push({name,proofKind,status:"PASS",durationMs:+(performance.now()-started).toFixed(1),detail:detail??null});
    console.log(`PASS ${name}`);
  }catch(error){
    checks.push({name,proofKind,status:"FAIL",durationMs:+(performance.now()-started).toFixed(1),error:String(error?.stack||error)});
    console.error(`FAIL ${name}: ${error?.message||error}`);
  }
}

function bindPage(page){
  page.setDefaultTimeout(15000);
  page.on("pageerror",error=>browserErrors.push(`pageerror:${error.message}`));
  page.on("console",message=>{
    if(message.type()==="error"&&!message.text().includes("favicon"))browserErrors.push(`console:${message.text()}`);
  });
}

async function openApp(page){
  await page.goto(appUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&document.body.classList.contains("family022"));
  const skip=page.locator(".family022Skip");
  if(await skip.count()&&await skip.isVisible())await skip.click({force:true}).catch(()=>{});
}

async function horizontalLayout(page){
  return page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    documentWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
    mainWidth:document.querySelector("main")?.scrollWidth||0
  }));
}

async function minimumVisibleTarget(page,selector){
  return page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>{
    const style=getComputedStyle(node),box=node.getBoundingClientRect();
    return style.visibility!=="hidden"&&style.display!=="none"&&box.width>0&&box.height>0;
  }).map(node=>({text:node.textContent.trim().slice(0,80),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));
}

async function seedTimeline(page){
  await page.evaluate(()=>{
    const api=window.D1_407F_ENGINEERING,document=api.store.snapshot();
    document.title="Synthetic family browser proof";
    document.studentProfile={...(document.studentProfile||{}),fullName:"Synthetic Family Student",medicalSchool:"Synthetic Medical School",medicalSchoolCountry:"Canada",degree:"MD",specialtyGoal:"Internal Medicine"};
    document.events=[{id:"family-mobile-event",title:"Synthetic clinical rotation",categoryId:"clinical",eventType:"duration",startDate:"2024-01",endDate:"2024-06",openEnded:false,visibilityState:"INTERVIEWER_SAFE",siteName:"Synthetic Hospital",sourceType:"browser-proof",notes:"Synthetic test data only",lane:0,fields:{}}];
    api.store.replace(document,{label:"Family browser proof",history:false});
    api.applyDocument();
  });
  await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.events.length===1);
}

async function verifyStudentPhone(browser,width,height){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce"});
  const page=await context.newPage();bindPage(page);await openApp(page);
  await runCheck(`${width}px title and four-intent Home`,"UI",async()=>{
    invariant(await page.title()==="Timeline Builder · MissionMed","Timeline title is not installed.");
    invariant(await page.locator("#homeTitle[aria-label='Timeline Builder']").isVisible(),"Timeline Builder Home title is missing.");
    const intents=await page.locator("#homeIntake,#homeBuild,.prototype021RescueLink,#homeFileVault").allTextContents();
    invariant(intents.length===4&&["Build from my CV","Continue my Timeline","I already have a Timeline","Choose from File Vault"].every(label=>intents.includes(label)),`Home intents are incomplete: ${JSON.stringify(intents)}`);
    const primary=await page.locator("#rail > [data-v]:visible,#rail > .family022Tools > summary:visible").allTextContents();
    invariant(JSON.stringify(primary)===JSON.stringify(["Home","My Timeline","Export","Tools"]),`Phone navigation is not progressive: ${JSON.stringify(primary)}`);
    const layout=await horizontalLayout(page);invariant(layout.documentWidth<=layout.viewport+1&&layout.bodyWidth<=layout.viewport+1,`Home overflows horizontally: ${JSON.stringify(layout)}`);
    const targets=await minimumVisibleTarget(page,"#rail > [data-v],#rail > .family022Tools > summary,#homeIntake,#homeBuild,.prototype021RescueLink,#homeFileVault");
    invariant(targets.every(({height})=>height>=44),`A visible Home action is smaller than 44px: ${JSON.stringify(targets)}`);
    await capture(page,`student-home-${width}`);
    return{intents,primary,layout,minimumHeight:Math.min(...targets.map(({height})=>height))};
  });
  await runCheck(`${width}px intent routing and progressive Tools`,"INTERACTION",async()=>{
    await page.locator("#homeIntake").click();
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.bridge.state.view==="intake");
    invariant(await page.locator('section[data-view="intake"] h1').first().isVisible(),"Build from my CV did not reach intake.");
    await page.locator('#rail [data-v="command"]').click();
    await page.locator("#rail .family022Tools > summary").click();
    const tools=await page.locator("#rail .family022ToolsList [data-v]:visible,#rail .family022ToolsList [data-quality-guardian-open]:visible").allTextContents();
    invariant(["Advanced Studio","Rescue","Media library"].every(label=>tools.includes(label))&&tools.some(label=>label.includes("Guardian")),`Tools are incomplete: ${JSON.stringify(tools)}`);
    await page.keyboard.press("Escape");
    invariant(!(await page.locator("#rail .family022Tools").evaluate(node=>node.open)),"Escape did not close Tools.");
    return{tools};
  });
  await runCheck(`${width}px returning Timeline and Export composition`,"UI",async()=>{
    await seedTimeline(page);
    await page.locator('#rail [data-v="command"]').click();
    invariant(await page.locator("#homeBuild").isEnabled(),"Continue my Timeline stayed disabled after a real event.");
    invariant(await page.locator(".family022Continuity").isVisible(),"Recent Timeline continuity is missing.");
    await page.locator('#rail [data-v="export"]').click();
    const proceed=page.locator("[data-quality-continue-export]");
    await proceed.waitFor({state:"visible"});
    await proceed.click();
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.bridge.state.view==="export");
    invariant(await page.locator(".export-screen svg[data-founder-serializer]").first().isVisible(),"Mobile Export preview is missing.");
    const formats=await page.locator(".export-format-option").count();
    const keynotePath=await page.locator(".export022Keynote").isVisible();
    invariant(formats===5&&keynotePath,`Export presents ${formats} file formats and Keynote pathway=${keynotePath}.`);
    const layout=await horizontalLayout(page);invariant(layout.documentWidth<=layout.viewport+1&&layout.bodyWidth<=layout.viewport+1,`Export overflows horizontally: ${JSON.stringify(layout)}`);
    await capture(page,`student-export-${width}`);
    return{formats,keynotePath,layout};
  });
  await context.close();
}

async function verifyAdminPresentation(browser,{width,height,label}){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:"reduce"});
  const page=await context.newPage();bindPage(page);await openApp(page);
  await runCheck(`${label} Admin workspace responsive presentation`,"SYNTHETIC_UI_ONLY",async()=>{
    await page.evaluate(async()=>{
      const {mountTimelineAdminWorkspace}=await import("/web/js/production/admin-workspace-022.js");
      const host=document.getElementById("timelineAdmin022");
      document.querySelectorAll("main > section[data-view]").forEach(section=>section.classList.remove("live"));
      host.classList.add("live");document.body.classList.add("family022AdminLanding");
      document.querySelectorAll("#rail > [data-v],#rail > .family022Tools").forEach(item=>{item.hidden=true;});
      document.querySelectorAll("#rail > .family022AdminNav").forEach(item=>{item.hidden=false;});
      const role=document.querySelector("[data-family-role]"),actor=document.querySelector("[data-family-actor]");
      if(role)role.textContent="Administrator";if(actor)actor.textContent="Synthetic UI proof";
      const metrics={eligible:438,never_started:91,cv_imported:237,draft:184,needs_review:39,guardian_issues:22,ready:76,recently_exported:18,recently_active:104};
      const row=(wpUserId,displayName,patch={})=>({wpUserId,displayName,email:`synthetic-${wpUserId}@example.invalid`,program:"MissionMed 360",sessions:["Synthetic 2026"],eligible:true,documentId:`synthetic-${wpUserId}`,status:"DRAFT",cvStatus:"IMPORTED",eventCount:9,lastActivity:"2026-09-08T18:00:00Z",guardianStatus:"ISSUES",guardianIssueCount:2,exportReadiness:"NEEDS_REVIEW",lastExport:null,canOpen:true,filters:{draft:true,cv_imported:true},...patch});
      const payload={source:"learndash-course-3893",verifiedAt:"2026-09-08T18:01:00Z",metrics,students:[row(900001,"Synthetic Review Student"),row(900002,"Synthetic Ready Student",{status:"APPROVED",guardianStatus:"CHECKED",guardianIssueCount:0,exportReadiness:"READY",lastExport:"2026-09-08T17:00:00Z"})],sessions:["Synthetic 2026"],total:2,page:1,pageSize:25};
      window.__D1_ADMIN_UI_CONTROLLER=mountTimelineAdminWorkspace(host,{authClient:{listAdminStudents:async()=>payload},onOpenStudent:()=>{}});
      await window.__D1_ADMIN_UI_CONTROLLER.ready;
    });
    await page.locator("[data-admin022-title]").waitFor({state:"visible"});
    invariant(await page.locator("[data-admin022-metric]").count()===9,"Admin Home is missing required metrics.");
    invariant(await page.locator("[data-admin022-query]").isVisible(),"Admin search is missing.");
    invariant(await page.locator("[data-admin022-filter]").isVisible()&&await page.locator("[data-admin022-session]").isVisible(),"Admin filters are missing.");
    invariant(await page.locator("[data-admin022-open]").count()===2,"Admin roster rows are missing.");
    const layout=await horizontalLayout(page);invariant(layout.documentWidth<=layout.viewport+1&&layout.bodyWidth<=layout.viewport+1,`Admin workspace overflows: ${JSON.stringify(layout)}`);
    const targets=await minimumVisibleTarget(page,"#timelineAdmin022 button,#timelineAdmin022 input,#timelineAdmin022 select,#timelineAdmin022 summary");
    if(width<=650)invariant(targets.every(({height})=>height>=44),`A visible Admin action is smaller than 44px: ${JSON.stringify(targets)}`);
    const student=await page.locator(".tl-admin022-student").first().textContent();
    for(const field of ["Timeline","CV / source","Events","Guardian","Export","Last active","Open Timeline"])invariant(student.includes(field),`Admin row omitted ${field}.`);
    await capture(page,`admin-${label}`);
    return{metrics:9,rows:2,layout,minimumTargetHeight:Math.min(...targets.map(({height})=>height),Infinity),source:"SYNTHETIC_UI_ONLY; production roster authority is tested separately"};
  });
  await page.evaluate(()=>window.__D1_ADMIN_UI_CONTROLLER?.destroy?.());
  await context.close();
}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
try{
  await verifyStudentPhone(browser,390,844);
  await verifyStudentPhone(browser,320,720);
  await verifyAdminPresentation(browser,{width:1440,height:1000,label:"desktop"});
  await verifyAdminPresentation(browser,{width:390,height:844,label:"390"});
  await verifyAdminPresentation(browser,{width:320,height:720,label:"320"});
}finally{
  await browser.close();
}

const failures=checks.filter(check=>check.status!=="PASS");
const artifacts=Object.fromEntries(screenshots.map(file=>[path.basename(file),{path:file,bytes:statSync(file).size,sha256:sha256(file)}]));
const receipt={
  result:failures.length||browserErrors.length?"FAIL":"PASS",
  generatedAt:new Date().toISOString(),appUrl,chromeExecutable,
  proofBoundary:{student:"real local StoryForge-family runtime and interactions",admin:"synthetic UI fixture only; no roster or authorization claim",productionMutation:false},
  checks,browserErrors,artifacts
};
writeFileSync(artifact("D1_022_FAMILY_MOBILE_BROWSER_RECEIPT.json"),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));
if(receipt.result!=="PASS")process.exitCode=1;
