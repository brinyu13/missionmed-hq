import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const APP_URL=process.env.D1_APP_URL;
const evidenceInput=process.env.D1_UXR_002_EVIDENCE;

if(!APP_URL)throw new Error("D1_APP_URL is required.");
if(!evidenceInput)throw new Error("D1_UXR_002_EVIDENCE is required.");
if(!path.isAbsolute(evidenceInput))throw new Error("D1_UXR_002_EVIDENCE must be an absolute path.");

const EVIDENCE=path.resolve(evidenceInput);
const SCREENSHOTS=path.join(EVIDENCE,"screenshots");
const RESULT_PATH=path.join(EVIDENCE,"uxr_002_design_freeze_results.json");
const APP_ORIGIN=new URL(APP_URL).origin;

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
  throw new Error(`Bundled Playwright could not be resolved.\n${failures.join("\n")}`);
}

function resolveSystemChrome(){
  const candidates=[
    process.env.D1_CHROME_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  const executablePath=candidates.find((candidate)=>fs.existsSync(candidate));
  if(!executablePath)throw new Error(`System Chrome was not found. Checked: ${candidates.join(", ")}`);
  return executablePath;
}

function channel(value){
  const normalized=value/255;
  return normalized<=0.04045?normalized/12.92:((normalized+0.055)/1.055)**2.4;
}

function parseColor(value){
  const text=String(value||"").trim();
  const hex=text.match(/^#([0-9a-f]{6})$/i);
  if(hex){
    const number=Number.parseInt(hex[1],16);
    return{r:(number>>16)&255,g:(number>>8)&255,b:number&255,a:1};
  }
  const rgb=text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if(!rgb)throw new Error(`Unsupported computed color: ${text}`);
  return{r:Number(rgb[1]),g:Number(rgb[2]),b:Number(rgb[3]),a:rgb[4]==null?1:Number(rgb[4])};
}

function colorHex(value){
  const {r,g,b}=parseColor(value);
  return`#${[r,g,b].map((part)=>Math.round(part).toString(16).padStart(2,"0")).join("").toUpperCase()}`;
}

function contrastRatio(foreground,background){
  const first=parseColor(foreground),second=parseColor(background);
  const firstLuminance=.2126*channel(first.r)+.7152*channel(first.g)+.0722*channel(first.b);
  const secondLuminance=.2126*channel(second.r)+.7152*channel(second.g)+.0722*channel(second.b);
  return(Number(((Math.max(firstLuminance,secondLuminance)+.05)/(Math.min(firstLuminance,secondLuminance)+.05)).toFixed(4)));
}

function serializeError(error){
  return{message:String(error?.message||error),stack:error?.stack||null};
}

const results=[];
const screenshots=[];
const contrastEvidence=[];
const microLabelEvidence=[];
const consoleErrors=[];
const pageErrors=[];
const requestErrors=[];
let browser=null;
let page=null;

async function test(id,name,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    results.push({id,name,status:"PASS",durationMs:Number((performance.now()-started).toFixed(2)),detail:detail??null});
  }catch(error){
    results.push({id,name,status:"FAIL",durationMs:Number((performance.now()-started).toFixed(2)),error:serializeError(error)});
  }
}

async function screenshot(name,label,{fullPage=true}={}){
  const target=path.join(SCREENSHOTS,name);
  await page.screenshot({path:target,fullPage});
  const bytes=fs.readFileSync(target);
  const entry={
    name,
    label,
    path:target,
    viewport:page.viewportSize(),
    bytes:bytes.byteLength,
    sha256:crypto.createHash("sha256").update(bytes).digest("hex")
  };
  screenshots.push(entry);
  return entry;
}

async function styleOf(locator){
  return locator.evaluate((node)=>{
    const style=getComputedStyle(node);
    return{
      backgroundColor:style.backgroundColor,
      color:style.color,
      borderColor:style.borderColor,
      borderStyle:style.borderStyle,
      borderWidth:style.borderWidth,
      boxShadow:style.boxShadow,
      opacity:style.opacity,
      outlineColor:style.outlineColor,
      outlineOffset:style.outlineOffset,
      outlineStyle:style.outlineStyle,
      outlineWidth:style.outlineWidth
    };
  });
}

function assertGoldTextPair(record,{minimum=4.5}={}){
  assert.equal(colorHex(record.backgroundColor),"#B98A2E",`${record.state} must preserve MissionMed gold`);
  assert.equal(colorHex(record.color),"#191C21",`${record.state} must use the approved gold text`);
  const ratio=contrastRatio(record.color,record.backgroundColor);
  assert.ok(ratio>=minimum,`${record.state} contrast ${ratio}:1 is below ${minimum}:1`);
  record.contrast=ratio;
  contrastEvidence.push(record);
}

async function installDeterministicAdapter(targetPage){
  await targetPage.addInitScript(()=>{
    const clone=(value)=>value==null?value:structuredClone(value);
    class DeterministicAdapter{
      constructor(){
        this.kind="UXR_002_PLAYWRIGHT_MEMORY";
        this.stores=new Map();
        this.failWrites=0;
        this.atomicWrites=0;
      }
      async open(){return this;}
      store(name){
        if(!this.stores.has(name))this.stores.set(name,new Map());
        return this.stores.get(name);
      }
      async get(store,key){return clone(this.store(store).get(key));}
      async put(store,value,key=value?.id){
        if(key==null)throw new Error("Persistence key is required.");
        this.store(store).set(key,clone(value));
        return clone(value);
      }
      async delete(store,key){this.store(store).delete(key);}
      async list(store,predicate=()=>true){return[...this.store(store).values()].map(clone).filter(predicate);}
      async clear(store){this.store(store).clear();}
      async atomicPut(entries){
        this.atomicWrites+=1;
        if(this.failWrites>0){
          this.failWrites-=1;
          throw new Error("DETERMINISTIC_SAVE_FAILURE");
        }
        for(const {store,key,value} of entries)this.store(store).set(key,clone(value));
      }
      failNextWrite(){this.failWrites+=1;}
    }
    window.__D1_UXR_002_TEST_ADAPTER=new DeterministicAdapter();
    window.D1_PERSISTENCE_ADAPTER=window.__D1_UXR_002_TEST_ADAPTER;
  });
}

async function waitForReady(){
  await page.goto(APP_URL,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>window.D1_UXR_002?.ready===true&&window.D1_UXR_002_TEST?.store);
  await page.waitForFunction(()=>document.querySelector("#app")?.getAttribute("aria-busy")===null);
}

async function navigate(route){
  await page.evaluate((target)=>window.D1_UXR_002_TEST.navigate(target),route);
  await page.waitForSelector(`[data-screen="${route}"]`);
}

async function resetDocument(){
  await page.evaluate(()=>window.D1_UXR_002_TEST.reset());
  await navigate("home");
  await page.waitForFunction(()=>window.D1_UXR_002_TEST.document.events.length===0);
  await page.evaluate(()=>window.D1_UXR_002_TEST.flush());
  await page.waitForFunction(()=>document.querySelector("[data-autosave]")?.textContent.trim()==="Saved just now");
}

async function inspectMicroLabels(route,viewportLabel){
  await navigate(route);
  const records=await page.locator(".micro-label,.journey-strip").evaluateAll((nodes,label)=>nodes.filter((node)=>{
    const style=getComputedStyle(node),box=node.getBoundingClientRect();
    return style.display!=="none"&&style.visibility!=="hidden"&&box.width>0&&box.height>0;
  }).map((node)=>{
    const style=getComputedStyle(node);
    let ancestor=node,background="rgba(0, 0, 0, 0)";
    while(ancestor){
      const candidate=getComputedStyle(ancestor).backgroundColor;
      const alpha=Number(candidate.match(/rgba?\([^)]*(?:,\s*|\/\s*)([\d.]+)\s*\)$/)?.[1]??(candidate.startsWith("rgb(")?1:0));
      if(alpha>=.99){background=candidate;break;}
      ancestor=ancestor.parentElement;
    }
    if(background==="rgba(0, 0, 0, 0)")background="rgb(247, 246, 243)";
    return{
      route:node.closest("[data-screen]")?.dataset.screen||null,
      viewport:label,
      text:node.textContent.trim(),
      className:node.className,
      fontSize:style.fontSize,
      fontWeight:style.fontWeight,
      color:style.color,
      background
    };
  }),viewportLabel);
  for(const record of records){
    assert.equal(record.fontSize,"11px",`${record.text} micro-label size`);
    assert.equal(record.fontWeight,"650",`${record.text} micro-label weight`);
    assert.equal(colorHex(record.color),"#565D66",`${record.text} must use approved ink.secondary`);
    record.contrast=contrastRatio(record.color,record.background);
    assert.ok(record.contrast>=4.5,`${record.text} micro-label contrast ${record.contrast}:1`);
    microLabelEvidence.push(record);
  }
  if(route==="home")assert.ok(records.length>=3,`${viewportLabel} Home must render its three current micro-label consumers`);
  return records;
}

async function run(){
  fs.mkdirSync(SCREENSHOTS,{recursive:true});
  const playwright=resolvePlaywright();
  const executablePath=resolveSystemChrome();
  const {chromium}=playwright.module;

  browser=await chromium.launch({headless:true,executablePath});
  const context=await browser.newContext({
    viewport:{width:1440,height:900},
    deviceScaleFactor:1,
    reducedMotion:"no-preference"
  });
  page=await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("console",(message)=>{
    if(message.type()==="error")consoleErrors.push({message:message.text(),location:message.location()});
  });
  page.on("pageerror",(error)=>pageErrors.push(serializeError(error)));
  page.on("requestfailed",(request)=>requestErrors.push({kind:"REQUEST_FAILED",url:request.url(),method:request.method(),detail:request.failure()?.errorText||"unknown"}));
  page.on("response",(response)=>{
    if(response.status()>=400)requestErrors.push({kind:"HTTP_ERROR",url:response.url(),method:response.request().method(),status:response.status()});
  });
  page.on("request",(request)=>{
    const url=request.url();
    if(!url.startsWith(`${APP_ORIGIN}/`)&&!url.startsWith("data:")&&!url.startsWith("blob:")){
      requestErrors.push({kind:"UNEXPECTED_ORIGIN",url,method:request.method()});
    }
  });
  await installDeterministicAdapter(page);
  await waitForReady();

  await test("AC1","Home satisfies the exact five-second contract",async()=>{
    await resetDocument();
    const home=page.locator('[data-screen="home"]');
    const heading="Turn your medical journey into an interview-ready timeline.";
    const subline="Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work.";
    const strip="1 · ADD YOUR JOURNEY\u00a0\u00a0\u00a02 · REFINE ON THE CANVAS\u00a0\u00a0\u00a03 · EXPORT FOR INTERVIEWS";
    await assert.doesNotReject(async()=>assert.equal(await home.locator("h1").textContent(),heading));
    assert.equal(await home.locator(".home-subline").textContent(),subline);
    assert.equal(await home.locator(".journey-strip").textContent(),strip);
    assert.equal(await home.locator(":scope .home-grid > section").count(),3);
    assert.equal(await home.locator(".home-build .button.primary").count(),1);
    assert.equal(await home.locator(".home-build .button.primary").textContent(),"Start building");
    assert.equal(await home.locator(".home-intake h2").textContent(),"Start from your CV or MyERAS");
    assert.equal(await home.locator(".home-intake .assurance").textContent(),"Nothing appears on your timeline until you approve it.");
    const matrix=page.getByRole("button",{name:"← Matrix"});
    await assert.doesNotReject(()=>matrix.waitFor({state:"visible"}));
    const box=await matrix.boundingBox();
    assert.ok(box&&box.x<=20&&box.y<56,"Matrix link must remain top-left");
    const goldDescendants=await home.locator(".home-build *").evaluateAll((nodes)=>nodes.filter((node)=>{
      const style=getComputedStyle(node),box=node.getBoundingClientRect();
      return box.width>0&&box.height>0&&style.backgroundColor==="rgb(185, 138, 46)";
    }).map((node)=>({tag:node.tagName,text:node.textContent.trim(),className:node.className})));
    assert.deepEqual(goldDescendants,[{tag:"BUTTON",text:"Start building",className:"button primary"}]);
    await screenshot("home-empty-1440.png","Home empty state at 1440px");
    return{heading,subline,strip,matrixBox:box,goldDescendants};
  });

  await test("AC2","Primary navigation contains exactly four frozen destinations",async()=>{
    const labels=await page.locator(".rail-nav .rail-item").allTextContents();
    assert.deepEqual(labels.map((value)=>value.trim()),["Home","Builder","Canvas","Export"]);
    assert.equal(await page.locator(".rail-nav .rail-item").count(),4);
    const routes=await page.locator(".rail-nav .rail-item").evaluateAll((nodes)=>nodes.map((node)=>node.dataset.route));
    assert.deepEqual(routes,["home","builder","canvas","export"]);
    const forbidden=["Review","Media","Advisor","Questions","Versions","Reference","Command"];
    for(const label of forbidden)assert.equal(await page.locator(".rail-nav .rail-item",{hasText:label}).count(),0,`${label} must not be in the rail`);
    return{labels:labels.map((value)=>value.trim()),routes};
  });

  await test("AC3","Removed shell, telemetry, and gamification UI is absent",async()=>{
    const selectors=[
      "#hudXp","#hudMp","#hudLevel","#hudAvatar",".xp-bar",".mp-counter",".level-hex",".avatar-hex",
      ".engine-status",".engine-chip",".draft-telemetry","#inspector","#inspector410","#evList",
      "#collisionPanel410","#firstUse410",".railFoot",".rail-footer"
    ];
    for(const selector of selectors)assert.equal(await page.locator(selector).count(),0,`${selector} must be absent`);
    assert.equal(await page.locator(".rail-nav footer").count(),0,"rail footer must be absent");
    const visibleText=await page.locator("body").innerText();
    for(const phrase of ["OP D1","TIMELINE ENGINE","AXIS AUTO-CALIBRATES","BLANK BUILDER DEFAULT","Draft status","KEYNOTE DUPE ENGINE"]){
      assert.doesNotMatch(visibleText,new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
    }
    return{checkedSelectors:selectors,checkedVisiblePhrases:6};
  });

  await test("AC4","Header exposes autosave and the correctly gated Export action",async()=>{
    await resetDocument();
    assert.equal((await page.locator("[data-autosave]").innerText()).trim(),"Saved just now");
    const exportButton=page.locator("[data-header-export]");
    assert.equal(await exportButton.isDisabled(),true);
    assert.equal(await exportButton.locator("xpath=..").getAttribute("title"),"Add at least one event first");
    await page.evaluate(()=>window.D1_UXR_002_TEST.setDocument({events:[{
      id:"education-1",
      title:"Medical Degree",
      categoryId:"education",
      eventType:"milestone",
      startDate:"2025-05",
      endDate:null,
      visibilityState:"INTERVIEWER_SAFE"
    }]}));
    await page.waitForFunction(()=>window.D1_UXR_002_TEST.document.events.length===1);
    assert.equal(await page.locator("[data-header-export]").isEnabled(),true);
    assert.equal(await page.locator("[data-header-export]").locator("xpath=..").getAttribute("title"),null);
    await screenshot("home-returning-export-enabled.png","Returning-user Home with Export enabled");
    await resetDocument();
    return{zeroEventTooltip:"Add at least one event first",enabledAtEvents:1};
  });

  await test("M2-RESUME","Returning Home continues in place and Start over versions before resetting",async()=>{
    await page.evaluate(()=>window.D1_UXR_002_TEST.setDocument({
      events:[{
        id:"education-returning",
        title:"Medical school",
        categoryId:"education",
        eventType:"duration",
        startDate:"2022-08",
        endDate:"2026-05",
        visibilityState:"INTERVIEWER_SAFE"
      }],
      builder:{step:4,skipped:[],touched:[]},
      intake:{candidates:[{id:"candidate-pending",decision:"pending"}]},
      preferences:{railPinned:false}
    }));
    await page.waitForFunction(()=>window.D1_UXR_002_TEST.document.events.length===1);
    assert.equal(await page.locator("[data-home-build]").textContent(),"Continue building");
    assert.equal(await page.locator("[data-start-over]").textContent(),"Start over");
    assert.equal(await page.locator("[data-review-suggestions]").textContent(),"1 suggestions to review");

    await page.locator("[data-home-build]").click();
    await page.waitForFunction(()=>document.querySelector('[data-screen="builder"]')&&window.D1_UXR_002_TEST.document.builder.step===4);
    await navigate("home");
    await page.locator("[data-start-over]").click();
    const dialog=page.getByRole("dialog",{name:"Start a new timeline?"});
    await assert.doesNotReject(()=>dialog.waitFor({state:"visible"}));
    assert.equal(await dialog.locator("p").textContent(),"Your current draft stays in History as a version. You can restore it anytime.");
    await dialog.getByRole("button",{name:"Save & start new"}).click();
    await page.waitForFunction(()=>document.querySelector('[data-screen="builder"]')&&window.D1_UXR_002_TEST.document.events.length===0);
    const versions=await page.evaluate(()=>window.D1_UXR_002_TEST.store.listVersions());
    assert.equal(versions.length,1);
    assert.match(versions[0].name,/^Before starting over · /);
    assert.equal(versions[0].kind,"automatic");
    assert.equal(versions[0].eventCount,1);
    assert.equal(versions[0].documentSnapshot.events[0].id,"education-returning");
    await resetDocument();
    return{continuedStep:4,automaticVersion:versions[0].name,eventCount:versions[0].eventCount};
  });

  await test("ADDENDUM-001","All approved rendered gold states satisfy the founder decision",async()=>{
    await resetDocument();
    const primary=page.locator(".home-build .button.primary");
    const defaultState={state:"default",...await styleOf(primary)};
    assertGoldTextPair(defaultState);
    assert.notEqual(colorHex(defaultState.borderColor),colorHex(defaultState.backgroundColor));

    await primary.hover();
    await page.waitForTimeout(220);
    const hoverState={state:"hover",...await styleOf(primary)};
    assertGoldTextPair(hoverState);
    assert.equal(colorHex(hoverState.borderColor),"#A67A26");

    await primary.evaluate((node)=>node.addEventListener("click",(event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();
    },{capture:true,once:true}));
    const box=await primary.boundingBox();
    assert.ok(box,"primary button must have a box");
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await page.waitForTimeout(180);
    const activeMatches=await primary.evaluate((node)=>node.matches(":active"));
    const activeState={state:"active",...await styleOf(primary)};
    await page.mouse.up();
    assert.equal(activeMatches,true);
    assertGoldTextPair(activeState);
    assert.equal(colorHex(activeState.borderColor),"#A67A26");

    await page.mouse.move(0,0);
    await page.keyboard.press("Tab");
    await primary.focus();
    assert.equal(await primary.evaluate((node)=>node.matches(":focus-visible")),true);
    const focusState={state:"focus",...await styleOf(primary)};
    assertGoldTextPair(focusState);
    assert.equal(colorHex(focusState.outlineColor),"#2F6FED");
    assert.equal(focusState.outlineWidth,"2px");
    assert.equal(focusState.outlineOffset,"2px");
    assert.equal(focusState.outlineStyle,"solid");
    focusState.focusContrastOnWhite=contrastRatio(focusState.outlineColor,"#FFFFFF");
    assert.ok(focusState.focusContrastOnWhite>=3);

    const disabled=page.locator("[data-header-export]");
    const disabledState={state:"disabled",...await styleOf(disabled)};
    disabledState.contrast=contrastRatio(disabledState.color,disabledState.backgroundColor);
    assert.equal(colorHex(disabledState.backgroundColor),"#E5DDCE");
    assert.equal(colorHex(disabledState.color),"#565D66");
    assert.ok(disabledState.contrast>=4.5);
    assert.notEqual(colorHex(disabledState.borderColor),colorHex(disabledState.backgroundColor));
    contrastEvidence.push(disabledState);

    await page.evaluate(()=>{
      const probe=document.createElement("button");
      probe.type="button";
      probe.className="button primary selected";
      probe.dataset.uxrGoldProbe="";
      probe.style.cssText="position:fixed;left:16px;bottom:16px;z-index:9999";
      probe.innerHTML='<svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2"/></svg><span>Selected</span>';
      document.body.append(probe);
    });
    const selectedProbe=page.locator("[data-uxr-gold-probe]");
    const selectedState={state:"selected",...await styleOf(selectedProbe)};
    assertGoldTextPair(selectedState);
    const iconStroke=await selectedProbe.locator("path").evaluate((node)=>getComputedStyle(node).stroke);
    assert.equal(colorHex(iconStroke),"#191C21","gold-state icon must inherit the approved text color");
    selectedState.iconStroke=iconStroke;
    await selectedProbe.evaluate((node)=>node.remove());
    return{states:contrastEvidence.filter((entry)=>["default","hover","active","focus","disabled","selected"].includes(entry.state))};
  });

  await test("AUTOSAVE","Saving, saved, failure, and retry states use the injected deterministic adapter",async()=>{
    await resetDocument();
    await page.evaluate(()=>window.D1_UXR_002_TEST.store.mutate("Autosave state probe",(document)=>{
      document.title="Autosave state probe";
    },{material:false}));
    assert.equal((await page.locator("[data-autosave]").innerText()).trim(),"Saving…");
    await page.evaluate(()=>window.D1_UXR_002_TEST.flush());
    await page.waitForFunction(()=>document.querySelector("[data-autosave]")?.textContent.trim()==="Saved just now");

    const failed=await page.evaluate(async()=>{
      window.__D1_UXR_002_TEST_ADAPTER.failNextWrite();
      window.D1_UXR_002_TEST.store.mutate("Autosave failure probe",(document)=>{
        document.title="Autosave failure probe";
      },{material:false});
      try{await window.D1_UXR_002_TEST.flush();return false;}
      catch{return true;}
    });
    assert.equal(failed,true);
    const retry=page.getByRole("button",{name:"Couldn't save — retry"});
    await retry.waitFor({state:"visible"});
    await screenshot("autosave-failure-retry.png","Autosave failure with retry action");
    await retry.click();
    await page.waitForFunction(()=>document.querySelector("[data-autosave]")?.textContent.trim()==="Saved just now");
    assert.equal((await page.locator("[data-autosave]").innerText()).trim(),"Saved just now");
    const adapterState=await page.evaluate(()=>({
      failWrites:window.__D1_UXR_002_TEST_ADAPTER.failWrites,
      atomicWrites:window.__D1_UXR_002_TEST_ADAPTER.atomicWrites
    }));
    assert.equal(adapterState.failWrites,0);
    return adapterState;
  });

  await test("ADDENDUM-002","Current Home and Builder micro-label consumers pass across responsive states",async()=>{
    const states=[
      {width:1440,height:900,label:"desktop"},
      {width:1023,height:900,label:"tablet"},
      {width:767,height:900,label:"phone"}
    ];
    const counts=[];
    for(const state of states){
      await page.setViewportSize({width:state.width,height:state.height});
      const homeRecords=await inspectMicroLabels("home",state.label);
      await screenshot(`home-${state.width}.png`,`Home at ${state.width}px`);
      const builderRecords=await inspectMicroLabels("builder",state.label);
      await screenshot(`builder-${state.width}.png`,`Builder Core Info at ${state.width}px`);
      counts.push({viewport:state.label,home:homeRecords.length,builder:builderRecords.length});
    }
    await page.setViewportSize({width:1440,height:900});
    await navigate("builder");
    return{counts,approvedColor:"#565D66",minimumContrast:4.5};
  });

  await test("MONTHFIELD-PARSE","MonthField accepts all four frozen typed forms",async()=>{
    await page.setViewportSize({width:1440,height:900});
    await navigate("builder");
    const cases=[
      {input:"6/2023",stored:"2023-06",display:"Jun 2023"},
      {input:"Jun 2023",stored:"2023-06",display:"Jun 2023"},
      {input:"June 2023",stored:"2023-06",display:"Jun 2023"},
      {input:"2023-06",stored:"2023-06",display:"Jun 2023"}
    ];
    for(const item of cases){
      const input=page.locator("#core-graduation-date");
      await input.fill(item.input);
      await input.press("Enter");
      await page.waitForFunction((expected)=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate===expected,item.stored);
      assert.equal(await page.locator("#core-graduation-date").inputValue(),item.display);
      assert.equal(await page.locator("#core-graduation-date-error").textContent(),"");
      assert.equal(await page.locator("#core-graduation-date").getAttribute("aria-invalid"),"false");
    }
    return{cases};
  });

  await test("MONTHFIELD-VALIDATION","MonthField exposes exact invalid and far-future messages",async()=>{
    const input=page.locator("#core-graduation-date");
    const prior=await page.evaluate(()=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate);
    await input.fill("June-ish 2023");
    await input.press("Enter");
    assert.equal(await page.locator("#core-graduation-date-error").textContent(),"Enter a month and year, like 'Jun 2023'.");
    assert.equal(await input.getAttribute("aria-invalid"),"true");
    assert.equal(await page.evaluate(()=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate),prior);

    const futureYear=await page.evaluate(()=>new Date().getFullYear()+7);
    await input.fill(`Jan ${futureYear}`);
    await input.press("Enter");
    await page.waitForFunction((expected)=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate===expected,`${futureYear}-01`);
    assert.equal(await page.locator("#core-graduation-date-error").textContent(),"That's more than 6 years out — double-check the year.");
    assert.equal(await page.locator("#core-graduation-date-error").getAttribute("class"),"field-error field-warning");
    assert.equal(await page.locator("#core-graduation-date").getAttribute("aria-invalid"),"false");
    return{invalid:"Enter a month and year, like 'Jun 2023'.",futureYear};
  });

  await test("MONTHFIELD-KEYBOARD","MonthField focuses selection and supports the frozen keyboard grid",async()=>{
    const input=page.locator("#core-graduation-date");
    await input.fill("Jun 2023");
    await input.press("Enter");
    await page.waitForFunction(()=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate==="2023-06");
    await page.waitForFunction(()=>document.querySelector("#core-graduation-date")?.value==="Jun 2023");
    await page.getByRole("button",{name:"Choose graduation date"}).click();
    const popover=page.locator('[data-month-field="core-graduation-date"] .month-popover');
    await assert.doesNotReject(()=>popover.waitFor({state:"visible"}));
    const selected=popover.locator('[data-month="6"][aria-selected="true"]');
    assert.equal(await selected.count(),1);
    assert.equal(await selected.evaluate((node)=>document.activeElement===node),true);
    const selectedStyle={state:"month-selected",...await styleOf(selected)};
    assertGoldTextPair(selectedStyle);

    await page.keyboard.press("ArrowRight");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.month),"7");
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.month),"11");
    await page.keyboard.press("Home");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.month),"1");
    await page.keyboard.press("End");
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.month),"12");
    await page.keyboard.press("Escape");
    assert.equal(await popover.isHidden(),true);
    assert.equal(await page.getByRole("button",{name:"Choose graduation date"}).evaluate((node)=>document.activeElement===node),true);

    await page.getByRole("button",{name:"Choose graduation date"}).click();
    await popover.locator('[data-month="9"]').click();
    await page.waitForFunction(()=>window.D1_UXR_002_TEST.document.studentProfile.graduationDate==="2023-09");
    assert.equal(await page.locator("#core-graduation-date").inputValue(),"Sep 2023");
    await page.waitForFunction(()=>document.activeElement?.id==="core-graduation-date");
    assert.equal(await page.locator("#core-graduation-date").evaluate((node)=>document.activeElement===node),true);
    await page.getByRole("button",{name:"Choose graduation date"}).click();
    assert.equal(await popover.locator('[data-month="9"][aria-selected="true"]').evaluate((node)=>document.activeElement===node),true);
    await page.waitForTimeout(250);
    assert.equal(await popover.evaluate((node)=>{
      const rect=node.getBoundingClientRect();
      const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
      return node.contains(hit);
    }),true);
    await screenshot("builder-month-field-selected.png","Builder MonthField selected-month and keyboard state");
    await page.keyboard.press("Escape");
    return{initialSelectedMonth:6,committedMonth:"2023-09"};
  });

  await test("RUNTIME","Candidate emits no console, page, request, or cross-origin errors",async()=>{
    assert.deepEqual(consoleErrors,[]);
    assert.deepEqual(pageErrors,[]);
    assert.deepEqual(requestErrors,[]);
    return{consoleErrors:0,pageErrors:0,requestErrors:0};
  });

  await context.close();
  return{
    playwrightSource:playwright.source,
    executablePath,
    browserVersion:browser.version()
  };
}

async function main(){
  let runtime=null;
  let fatal=null;
  try{runtime=await run();}
  catch(error){fatal=serializeError(error);}
  finally{
    if(browser)await browser.close().catch(()=>{});
    fs.mkdirSync(EVIDENCE,{recursive:true});
    const failed=results.filter((item)=>item.status==="FAIL").length+(fatal?1:0);
    const output={
      schemaVersion:"d1-uxr-002-m1-m2-browser.1",
      generatedAt:new Date().toISOString(),
      authority:[
        "D1-UXR-001",
      "D1-UXR-002-CONTRAST-ADDENDUM-001",
      "D1-UXR-002-CONTRAST-ADDENDUM-002",
      "D1-UXR-002-IMPLEMENTATION-AUTHORITY-ADDENDUM-001",
      "D1-UXR-002-EXECUTION-AMENDMENT-001",
      "D1-UXR-002-AUTONOMOUS-COMPLETION-DIRECTIVE-001"
      ],
      appUrl:APP_URL,
      evidencePath:EVIDENCE,
      runtime,
      summary:{total:results.length,passed:results.filter((item)=>item.status==="PASS").length,failed},
      results,
      contrastEvidence,
      microLabelEvidence,
      screenshots,
      consoleErrors,
      pageErrors,
      requestErrors,
      fatal
    };
    fs.writeFileSync(RESULT_PATH,`${JSON.stringify(output,null,2)}\n`);
    process.stdout.write(`${JSON.stringify(output.summary)}\n`);
    if(failed)process.exitCode=1;
  }
}

await main();
