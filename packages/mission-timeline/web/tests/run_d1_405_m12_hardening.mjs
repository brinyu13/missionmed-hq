import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const require=createRequire(import.meta.url);
const WORKTREE_ROOT=path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const APP_URL=process.env.D1_APP_URL||
  "http://127.0.0.1:8793/web/?entitlement=administrator";
const EVIDENCE=path.resolve(
  process.env.D1_M12_EVIDENCE||
  path.join(
    WORKTREE_ROOT,
    "_AI_HANDOFFS/from_codex/D1-405_TIMELINE_LAUNCH_REFINEMENT/m12"
  )
);
const SCREENSHOTS=path.join(EVIDENCE,"screenshots");
const RESULT_PATH=path.join(EVIDENCE,"D1-405-M12-hardening-results.json");
const EXACT_WIDTHS=[1600,1440,1439,1280,1279,1024,1023,768,767];
const PERFORMANCE_BUDGETS=Object.freeze({
  initialReady:2500,
  routeTransition:500,
  builderPreview:500,
  specialtySwitch:500,
  medicalSchoolSearch:250,
  themePreview:500,
  fullPreview:500,
  exportPreview:500,
  autosave:1400
});

function resolvePlaywright(){
  const candidates=[
    process.env.D1_PLAYWRIGHT_PATH,
    "playwright",
    "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ].filter(Boolean);
  const failures=[];
  for(const candidate of candidates){
    try{return{module:require(candidate),source:candidate};}
    catch(error){failures.push(`${candidate}: ${error?.message||error}`);}
  }
  throw new Error(`Playwright unavailable.\n${failures.join("\n")}`);
}

function resolveChrome(){
  const candidates=[
    process.env.D1_CHROME_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  const executablePath=candidates.find((candidate)=>fs.existsSync(candidate));
  if(!executablePath)throw new Error(`Chrome unavailable: ${candidates.join(", ")}`);
  return executablePath;
}

function serializeError(error){
  return{
    message:String(error?.message||error),
    stack:String(error?.stack||"")
  };
}

function sha256(value){
  return crypto.createHash("sha256").update(value).digest("hex");
}

fs.mkdirSync(SCREENSHOTS,{recursive:true});

const {module:{chromium},source:playwrightSource}=resolvePlaywright();
const executablePath=resolveChrome();
const results=[];
const screenshots=[];
const performanceEvidence={};
const browserErrors=[];
const browserWarnings=[];
const pageErrors=[];
const unhandledRejections=[];
const requestFailures=[];
const httpErrors=[];
const unexpectedRequests=[];
const unsafeRequests=[];
const appOrigin=new URL(APP_URL).origin;
let browser;

async function test(id,name,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    results.push({
      id,
      name,
      status:"PASS",
      durationMs:Number((performance.now()-started).toFixed(2)),
      detail:detail??null
    });
  }catch(error){
    results.push({
      id,
      name,
      status:"FAIL",
      durationMs:Number((performance.now()-started).toFixed(2)),
      error:serializeError(error)
    });
  }
}

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function openPage({
  width=1440,
  height=1000,
  hasTouch=false,
  reducedMotion="reduce",
  forcedColors="none"
}={}){
  const context=await browser.newContext({
    viewport:{width,height},
    deviceScaleFactor:1,
    hasTouch,
    reducedMotion,
    forcedColors,
    acceptDownloads:false
  });
  const page=await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.exposeFunction("__d1RecordUnhandledRejection",(message)=>{
    unhandledRejections.push({width,message:String(message),url:page.url()});
  });
  await page.addInitScript(()=>{
    window.addEventListener("unhandledrejection",(event)=>{
      window.__d1RecordUnhandledRejection?.(
        String(event.reason?.message||event.reason||"Unhandled rejection")
      );
    });
  });
  page.on("console",(message)=>{
    const record={
      width,
      message:message.text(),
      url:page.url()
    };
    if(message.type()==="error")browserErrors.push(record);
    if(message.type()==="warning")browserWarnings.push(record);
  });
  page.on("pageerror",(error)=>pageErrors.push({
    width,
    message:String(error?.message||error),
    url:page.url()
  }));
  page.on("requestfailed",(request)=>requestFailures.push({
    width,
    url:request.url(),
    failure:request.failure()?.errorText||"unknown"
  }));
  page.on("response",(response)=>{
    if(response.status()>=400)httpErrors.push({
      width,
      status:response.status(),
      url:response.url()
    });
  });
  page.on("request",(request)=>{
    const url=request.url();
    const method=request.method().toUpperCase();
    if(
      (url.startsWith("http:")||url.startsWith("https:"))&&
      !["GET","HEAD"].includes(method)
    )unsafeRequests.push({width,url,method});
    if(url.startsWith("data:")||url.startsWith("blob:"))return;
    let origin="";
    try{origin=new URL(url).origin;}catch{}
    if(origin!==appOrigin)unexpectedRequests.push({width,url});
  });
  const started=performance.now();
  await page.goto(APP_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>
    Boolean(window.D1_407F_ENGINEERING?.store)&&
    window.D1_407F_ENGINEERING.store.entitlement?.access==="FULL"
  );
  await page.waitForFunction(()=>
    !document.documentElement.classList.contains("d1-hydrating")
  );
  await page.waitForFunction(()=>{
    const heading=document.querySelector("section[data-view].live h1");
    if(!heading)return false;
    const style=getComputedStyle(heading);
    return style.display!=="none"&&
      style.visibility!=="hidden"&&
      heading.getClientRects().length>0;
  });
  const initialReady=performance.now()-started;
  return{context,page,initialReady};
}

async function closePage(pair){
  await pair.context.close();
}

async function route(page,id){
  const started=performance.now();
  await page.locator(`#rail [data-v="${id}"]`).click();
  await page.waitForFunction((routeId)=>
    document.querySelector(`section[data-view="${routeId}"]`)?.classList
      .contains("live"),
  id);
  await page.waitForTimeout(50);
  return performance.now()-started;
}

async function capture(page,name,label){
  const target=path.join(SCREENSHOTS,name);
  await page.screenshot({path:target,fullPage:false});
  const bytes=fs.readFileSync(target);
  screenshots.push({
    name,
    label,
    path:target,
    viewport:page.viewportSize(),
    bytes:bytes.byteLength,
    sha256:sha256(bytes)
  });
}

async function accessibilitySnapshot(page){
  return page.evaluate(()=>{
    const visible=(element)=>{
      if(!(element instanceof Element))return false;
      const style=getComputedStyle(element);
      if(style.display==="none"||style.visibility==="hidden")return false;
      return Boolean(
        element.getClientRects().length||
        element instanceof SVGElement
      );
    };
    const active=document.querySelector("section[data-view].live");
    const text=(element)=>String(element?.textContent||"")
      .replace(/\s+/g," ")
      .trim();
    const labelledBy=(element)=>String(
      element.getAttribute("aria-labelledby")||""
    ).split(/\s+/).filter(Boolean).map((id)=>text(document.getElementById(id)))
      .filter(Boolean).join(" ");
    const accessibleName=(element)=>
      String(element.getAttribute("aria-label")||"").trim()||
      labelledBy(element)||
      String(element.getAttribute("title")||"").trim()||
      text(element)||
      (element instanceof HTMLInputElement
        ?String(element.value||element.placeholder||"").trim()
        :"");
    const ids=[...document.querySelectorAll("[id]")]
      .map((element)=>element.id);
    const duplicateIds=[...new Set(ids.filter(
      (id,index)=>ids.indexOf(id)!==index
    ))];
    const controls=active?[...active.querySelectorAll(
      "button,a[href],input,select,textarea,[role='button'],[role='tab']"
    )].filter(visible):[];
    const unnamedControls=controls.filter(
      (element)=>!accessibleName(element)
    ).map((element)=>element.outerHTML.slice(0,240));
    const formControls=active?[...active.querySelectorAll(
      "input:not([type='hidden']),select,textarea"
    )].filter(visible):[];
    const unlabeledInputs=formControls.filter((element)=>
      !element.labels?.length&&
      !element.getAttribute("aria-label")&&
      !element.getAttribute("aria-labelledby")&&
      !element.getAttribute("title")
    ).map((element)=>element.outerHTML.slice(0,240));
    const missingImageAlternatives=active?[...active.querySelectorAll("img")]
      .filter(visible)
      .filter((image)=>
        !image.hasAttribute("alt")&&
        image.getAttribute("role")!=="presentation"&&
        image.getAttribute("aria-hidden")!=="true"
      ).map((image)=>image.outerHTML.slice(0,240)):[];
    const visibleH1s=active?[...active.querySelectorAll("h1")]
      .filter(visible).map(text):[];
    return{
      route:active?.dataset.view||null,
      visibleH1s,
      duplicateIds,
      unnamedControls,
      unlabeledInputs,
      missingImageAlternatives,
      liveRegions:active?[...active.querySelectorAll(
        "[aria-live],[role='status'],[role='alert']"
      )].length:0,
      viewport:{width:innerWidth,height:innerHeight},
      documentOverflow:document.documentElement.scrollWidth-innerWidth
    };
  });
}

async function assertRouteAccessibility(page,routeId){
  const snapshot=await accessibilitySnapshot(page);
  assert(snapshot.route===routeId,`Expected ${routeId}; got ${snapshot.route}`);
  assert(
    snapshot.visibleH1s.length===1,
    `${routeId} visible h1 count ${snapshot.visibleH1s.length}: ${snapshot.visibleH1s.join(" | ")}`
  );
  assert(
    snapshot.duplicateIds.length===0,
    `${routeId} duplicate IDs: ${snapshot.duplicateIds.join(", ")}`
  );
  assert(
    snapshot.unnamedControls.length===0,
    `${routeId} unnamed controls: ${snapshot.unnamedControls.join(" | ")}`
  );
  assert(
    snapshot.unlabeledInputs.length===0,
    `${routeId} unlabeled inputs: ${snapshot.unlabeledInputs.join(" | ")}`
  );
  assert(
    snapshot.missingImageAlternatives.length===0,
    `${routeId} images without alternatives: ${snapshot.missingImageAlternatives.join(" | ")}`
  );
  return snapshot;
}

async function runResponsiveMatrix(){
  for(const width of EXACT_WIDTHS){
    const pair=await openPage({
      width,
      height:width<=768?960:1000,
      hasTouch:width<=1023
    });
    const {page}=pair;
    performanceEvidence[`initialReady-${width}`]=Number(
      pair.initialReady.toFixed(2)
    );
    await test(
      `M12-R-${width}`,
      `responsive boundary ${width}px`,
      async()=>{
        const model=await page.evaluate(()=>window.D1_407F_ENGINEERING.responsive);
        assert(model.viewport.width===width,`Responsive model width ${model.viewport.width}`);
        const expectedTier=width>=1440
          ?"full"
          :width>=1280
            ?"compressed"
            :width>=1024
              ?"desktop-overlay"
            :width>=768
              ?"tablet"
              :"phone";
        assert(model.tier.id===expectedTier,`Expected ${expectedTier}; got ${model.tier.id}`);
        const snapshot=await assertRouteAccessibility(page,"command");
        assert(snapshot.documentOverflow<=1,`Document overflow ${snapshot.documentOverflow}px`);
        return{tier:model.tier.id,contentMode:model.screens.home.contentMode};
      }
    );
    await route(page,"builder");
    await test(
      `M12-RB-${width}`,
      `Builder remains operable at ${width}px`,
      async()=>{
        const snapshot=await assertRouteAccessibility(page,"builder");
        const model=await page.evaluate(()=>window.D1_407F_ENGINEERING.responsive);
        return{
          h1:snapshot.visibleH1s[0],
          contentMode:model.screens.builder.contentMode
        };
      }
    );
    if([1600,1440,1023,767].includes(width)){
      await capture(
        page,
        `D1-405-M12-responsive-${width}.png`,
        `Builder at ${width}px`
      );
    }
    await closePage(pair);
  }
}

async function runRouteAndInteractionAudit(){
  const pair=await openPage({width:1440,height:1000});
  const {page}=pair;
  performanceEvidence.initialReady=Number(pair.initialReady.toFixed(2));
  await page.evaluate(()=>{
    window.D1_407F_TEST.fixtureSet("student");
    window.D1_407F_TEST.renderAll();
  });
  await page.waitForTimeout(100);

  const routes=["command","builder","canvas","media","export"];
  for(const routeId of routes){
    const duration=routeId==="command"?0:await route(page,routeId);
    performanceEvidence[`route-${routeId}`]=Number(duration.toFixed(2));
    await test(
      `M12-A11Y-${routeId}`,
      `${routeId} route accessibility`,
      ()=>assertRouteAccessibility(page,routeId)
    );
  }

  await route(page,"builder");
  await page.locator('[data-builder-step="1"]').click();
  await page.waitForTimeout(50);
  await test("M12-K-SCHOOL","medical-school keyboard search",async()=>{
    const input=page.locator("[data-school-search]");
    assert(await input.count()===1,"Medical-school input missing");
    const started=performance.now();
    await input.fill("harvard");
    await page.waitForTimeout(30);
    performanceEvidence.medicalSchoolSearch=Number(
      (performance.now()-started).toFixed(2)
    );
    await input.press("ArrowDown");
    await input.press("Escape");
    return{durationMs:performanceEvidence.medicalSchoolSearch};
  });

  await test("M12-K-SPECIALTY","specialty timeline keyboard switch",async()=>{
    const select=page.locator("[data-specialty-variant-select]");
    assert(await select.count()===1,"Specialty timeline switcher missing");
    const started=performance.now();
    await select.focus();
    await select.press("ArrowDown");
    await select.press("ArrowUp");
    performanceEvidence.specialtySwitch=Number(
      (performance.now()-started).toFixed(2)
    );
    return{durationMs:performanceEvidence.specialtySwitch};
  });

  await test("M12-K-PREVIEW","full preview trap, Escape, and opener focus",async()=>{
    const opener=page.locator("#builderPreviewToggle");
    const started=performance.now();
    await opener.click();
    await page.locator("[data-builder-preview-sheet]").waitFor();
    performanceEvidence.fullPreview=Number(
      (performance.now()-started).toFixed(2)
    );
    assert(
      await page.locator("[data-builder-preview-sheet] :focus").count()===1,
      "Full preview did not own focus"
    );
    await page.keyboard.press("Escape");
    await page.locator("[data-builder-preview-sheet]").waitFor({state:"hidden"});
    await page.waitForFunction(()=>
      document.activeElement?.id==="builderPreviewToggle"
    );
    assert(await opener.evaluate((element)=>document.activeElement===element),"Preview focus did not restore");
    return{durationMs:performanceEvidence.fullPreview};
  });

  await route(page,"canvas");
  await test("M12-K-THEME","theme preview focus and Escape",async()=>{
    const trigger=page.locator('[data-canvas-action="theme"]');
    const started=performance.now();
    await trigger.click();
    await page.locator("[data-theme-picker]").waitFor();
    performanceEvidence.themePreview=Number(
      (performance.now()-started).toFixed(2)
    );
    await page.keyboard.press("Escape");
    assert(await trigger.evaluate((element)=>document.activeElement===element),"Theme focus did not restore");
    return{durationMs:performanceEvidence.themePreview};
  });

  await test("M12-AUTOSAVE","authorized autosave reaches durable saved state",async()=>{
    const started=performance.now();
    await page.evaluate(()=>{
      const store=window.D1_407F_ENGINEERING.store;
      store.mutate("M12 performance checkpoint",(document)=>{
        document.metadata={
          ...(document.metadata||{}),
          m12PerformanceCheckpoint:true
        };
      },{material:false});
    });
    await page.waitForFunction(()=>
      window.D1_407F_ENGINEERING.store.saveStatus==="saved"
    );
    performanceEvidence.autosave=Number(
      (performance.now()-started).toFixed(2)
    );
    return{durationMs:performanceEvidence.autosave};
  });

  await test("M12-BFCACHE","exit persistence re-arms after a BFCache restore",async()=>{
    const calls=await page.evaluate(async()=>{
      const store=window.D1_407F_ENGINEERING.store;
      const original=store.flushPendingSave;
      let count=0;
      store.flushPendingSave=async()=>{count+=1;};
      window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));
      window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}));
      window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}));
      await Promise.resolve();
      store.flushPendingSave=original;
      return count;
    });
    assert(calls===2,`Expected two exit flushes; got ${calls}`);
    return{flushCalls:calls};
  });

  await route(page,"export");
  await test("M12-P-EXPORT","export preview settles within budget",async()=>{
    const started=performance.now();
    await page.locator("[data-export-preview]").waitFor();
    performanceEvidence.exportPreview=Number(
      (performance.now()-started).toFixed(2)
    );
    return{durationMs:performanceEvidence.exportPreview};
  });

  await capture(page,"D1-405-M12-export-desktop.png","Export at 1440px");
  await closePage(pair);
}

async function runMediaPreferenceAudit(){
  for(const mode of [
    {id:"reduced",reducedMotion:"reduce",forcedColors:"none"},
    {id:"forced-colors",reducedMotion:"no-preference",forcedColors:"active"}
  ]){
    const pair=await openPage({
      width:1440,
      height:1000,
      reducedMotion:mode.reducedMotion,
      forcedColors:mode.forcedColors
    });
    await test(
      `M12-MEDIA-${mode.id}`,
      `${mode.id} preference is reflected`,
      async()=>{
        const result=await pair.page.evaluate(()=>({
          reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,
          forced:matchMedia("(forced-colors: active)").matches,
          runtimeReduced:window.D1_407F_ENGINEERING.responsive.motion.reduced
        }));
        if(mode.id==="reduced"){
          assert(result.reduced&&result.runtimeReduced,"Reduced motion was not applied");
        }else{
          assert(result.forced,"Forced colors was not applied");
        }
        return result;
      }
    );
    await closePage(pair);
  }
}

async function run(){
  browser=await chromium.launch({
    executablePath,
    headless:true,
    args:["--disable-background-networking","--disable-component-update"]
  });
  try{
    await runResponsiveMatrix();
    await runRouteAndInteractionAudit();
    await runMediaPreferenceAudit();
  }finally{
    await browser.close();
  }

  for(const [name,budget] of Object.entries(PERFORMANCE_BUDGETS)){
    const values=name==="routeTransition"
      ?Object.entries(performanceEvidence)
        .filter(([key])=>key.startsWith("route-"))
        .map(([,value])=>value)
      :name==="builderPreview"
        ?Object.entries(performanceEvidence)
          .filter(([key])=>key.startsWith("route-builder"))
          .map(([,value])=>value)
        :name==="initialReady"
          ?Object.entries(performanceEvidence)
            .filter(([key])=>key.startsWith("initialReady"))
            .map(([,value])=>value)
          :[performanceEvidence[name]].filter(Number.isFinite);
    await test(`M12-PERF-${name}`,`${name} remains within ${budget}ms`,()=>{
      assert(values.length>0,`No performance evidence for ${name}`);
      const maximum=Math.max(...values);
      assert(maximum<=budget,`${name} ${maximum}ms exceeds ${budget}ms`);
      return{budgetMs:budget,maximumMs:maximum,samples:values};
    });
  }

  await test("M12-CLEAN-CONSOLE","browser console and page errors remain zero",()=>{
    assert(browserErrors.length===0,JSON.stringify(browserErrors));
    assert(browserWarnings.length===0,JSON.stringify(browserWarnings));
    assert(pageErrors.length===0,JSON.stringify(pageErrors));
    assert(unhandledRejections.length===0,JSON.stringify(unhandledRejections));
    return{
      browserErrors:0,
      browserWarnings:0,
      pageErrors:0,
      unhandledRejections:0
    };
  });
  await test("M12-CLEAN-NETWORK","request failures and unexpected origins remain zero",()=>{
    assert(requestFailures.length===0,JSON.stringify(requestFailures));
    assert(httpErrors.length===0,JSON.stringify(httpErrors));
    assert(unexpectedRequests.length===0,JSON.stringify(unexpectedRequests));
    assert(unsafeRequests.length===0,JSON.stringify(unsafeRequests));
    return{
      requestFailures:0,
      httpErrors:0,
      unexpectedRequests:0,
      unsafeRequests:0
    };
  });

  const report={
    schemaVersion:"d1-405.m12-hardening-results.1",
    generatedAt:new Date().toISOString(),
    appUrl:APP_URL,
    appOrigin,
    playwrightSource,
    executablePath,
    exactWidths:EXACT_WIDTHS,
    performanceBudgets:PERFORMANCE_BUDGETS,
    performanceEvidence,
    results,
    screenshots,
    browserErrors,
    browserWarnings,
    pageErrors,
    unhandledRejections,
    requestFailures,
    httpErrors,
    unexpectedRequests,
    unsafeRequests,
    summary:{
      passed:results.filter(({status})=>status==="PASS").length,
      failed:results.filter(({status})=>status==="FAIL").length
    }
  };
  fs.writeFileSync(RESULT_PATH,`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({
    resultPath:RESULT_PATH,
    summary:report.summary,
    screenshots:screenshots.length
  },null,2));
  if(report.summary.failed)process.exitCode=1;
}

await run();
