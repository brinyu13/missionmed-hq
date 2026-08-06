import {createRequire} from "node:module";
import {existsSync,mkdirSync,readFileSync,statSync} from "node:fs";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8793/web/";
const captureDir=String(process.env.D1_CAPTURE_DIR||"").trim();
if(captureDir)mkdirSync(captureDir,{recursive:true});
const {chromium}=require(playwrightRuntime);

const allPersonas=[
  {id:"administrator",scenario:"administrator",writable:true,expectedAccess:"FULL"},
  {id:"eligible-360",scenario:"eligible-360",writable:true,expectedAccess:"FULL"},
  {id:"removed",scenario:"removed",writable:false,expectedAccess:"READ_ONLY",prepare:true}
];
const personaFilter=String(process.env.D1_PERSONA||"").trim();
const personas=personaFilter
  ?allPersonas.filter(({id})=>id===personaFilter)
  :allPersonas;
const checks=[];

function assert(condition,message){if(!condition)throw new Error(message);}

async function runCheck(persona,name,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    checks.push({persona:persona.id,name,status:"PASS",durationMs:+(performance.now()-started).toFixed(1),detail:detail||null});
    console.log(`PASS [${persona.id}] ${name}`);
  }catch(error){
    checks.push({persona:persona.id,name,status:"FAIL",durationMs:+(performance.now()-started).toFixed(1),detail:String(error?.message||error)});
    console.log(`FAIL [${persona.id}] ${name}: ${String(error?.message||error)}`);
  }
}

async function boot(page,scenario){
  await page.goto(`${appUrl}?entitlement=${encodeURIComponent(scenario)}`,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&!!window.D1_407F_TEST);
}

async function seed(page,count,{persist=false,label="Browser kernel fixture"}={}){
  await page.waitForTimeout(35);
  await page.evaluate(async({count,persist,label})=>{
    const api=window.D1_407F_ENGINEERING;
    const document=api.store.snapshot();
    document.title="Browser Kernel Student";
    document.studentProfile={
      ...document.studentProfile,
      fullName:"Browser Kernel Student",
      medicalSchool:"MissionMed Medical School",
      medicalSchoolCountry:"United States",
      graduationDate:"2024-05",
      specialtyGoal:"Internal Medicine"
    };
    document.metadata={
      ...document.metadata,
      stickyNote:"",
      interview:{prog:"",specialty:"",date:"",dateDisplay:"",label:""}
    };
    const dense=[
      ["Internship","work","2011-08","2012-08",0,"UK"],
      ["General Practice","work","2013-03","2014-09",0,"UK"],
      ["Step 1","exams","2016-01","2016-11",1,""],
      ["Step 2 CK","exams","2017-01","2017-11",1,""],
      ["Research Asst","research","2016-06","2017-02",2,""],
      ["Volunteer EMT","personal","2015-09","2016-06",3,""],
      ["IM Observer","clinical","2018-01","2018-05",2,"SUNY Upstate, NY"],
      ["IM Extern","clinical","2018-04","2018-06",3,"Jersey Shore, NJ"],
      ["FM Observer","clinical","2017-06","2017-09",5,"Newark, NJ"],
      ["IM Externship","clinical","2018-11","2020-02",4,"Mt Sinai, NY"],
      ["Raising Daughter","personal","2017-01","2020-12",6,""],
      ["Covid-19 Contact Tracing","work","2020-02","2020-12",5,""],
      ["Team 11","research","2020-09","2020-12",6,"Larkin Hosp, FL"]
    ];
    const rows=count===13
      ?dense
      :Array.from({length:count},(_,index)=>[
        `Event ${index+1}`,
        ["work","clinical","education","research","exams","personal"][index%6],
        `${2010+index}-${String(index%9+1).padStart(2,"0")}`,
        `${2010+index}-${String(index%9+3).padStart(2,"0")}`,
        index%7,
        ""
      ]);
    document.events=rows.map(([title,categoryId,startDate,endDate,lane,siteName],index)=>({
      id:`d1-411b-browser-${index}`,title,categoryId,eventType:"duration",
      startDate,endDate,openEnded:false,visibilityState:"INTERVIEWER_SAFE",
      siteName,sourceType:"d1-411b-browser",notes:"",lane,
      fields:{hiddenInActiveVariant:false}
    }));
    api.store.replace(document,{label,history:false});
    api.applyDocument();
    if(persist)await api.store.saveNow("D1_411B_BROWSER_FIXTURE");
  },{count,persist,label});
  await page.waitForFunction((count)=>window.D1_407F_ENGINEERING.store.document.events.length===count,count);
  await page.waitForTimeout(60);
}

async function navigate(page,route){
  await page.locator(`#rail [data-v="${route}"]`).click();
  await page.waitForFunction((route)=>document.querySelector('#rail [aria-current="page"]')?.dataset.v===route,route);
}

async function kernel(page,surface,{visible=true}={}){
  const selector=`d1-timeline-kernel[data-surface="${surface}"]`;
  const locator=visible?page.locator(`${selector}:visible`).first():page.locator(selector).first();
  await locator.waitFor({state:"visible",timeout:12000});
  await page.waitForFunction(({surface,visible})=>{
    const candidates=[...document.querySelectorAll(`d1-timeline-kernel[data-surface="${surface}"]`)];
    const element=candidates.find((node)=>!visible||!!(node.offsetWidth||node.offsetHeight));
    return element?.dataset.ready==="true"||Boolean(element?.dataset.error);
  },{surface,visible},{timeout:12000});
  const state=await locator.evaluate((element)=>({...element.dataset}));
  assert(state.ready==="true"&&state.protectedKernel==="D1-409H-A1",`kernel ${surface} failed: ${JSON.stringify(state)}`);
  return locator;
}

async function kernelEvidence(host){
  const frame=host.locator("iframe").contentFrame();
  const hostData=await host.evaluate((element)=>({
    surface:element.dataset.surface,
    fingerprint:element.dataset.fingerprint,
    renderId:element.dataset.renderId,
    protectedKernel:element.dataset.protectedKernel,
    projectionWarnings:element.dataset.projectionWarnings,
    width:element.clientWidth,
    height:element.clientHeight,
    src:element.shadowRoot?.querySelector("iframe")?.src||""
  }));
  const child=await frame.locator("#board").evaluate((board)=>({
    arrows:board.querySelectorAll(".arrow[data-object-id]").length,
    flags:board.querySelectorAll(".flag[data-object-id]").length,
    photos:board.querySelectorAll(".photoTile[data-object-id]").length,
    axis:board.querySelectorAll("#axis").length,
    hitTargets:board.querySelectorAll("[data-d1-411a-hit]").length,
    diagnostics:board.ownerDocument.defaultView.D1409H.diagnostics(),
    visualModel:JSON.stringify((()=>{
      const snapshot=board.ownerDocument.defaultView.D1409H.getSnapshot();
      if(snapshot)delete snapshot.revision;
      return snapshot;
    })())
  }));
  return{host:hostData,child,frame};
}

assert(existsSync(chromeExecutable),`Chrome executable not found: ${chromeExecutable}`);
const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});

for(const persona of personas){
  const browserErrors=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce",acceptDownloads:true});
  const page=await context.newPage();
  page.on("pageerror",(error)=>browserErrors.push(`pageerror: ${error.message}`));
  page.on("console",(message)=>{if(message.type()==="error")browserErrors.push(`console: ${message.text()}`);});
  page.on("requestfailed",(request)=>{
    const reason=request.failure()?.errorText||"unknown";
    if(reason.includes("ERR_ABORTED")&&request.url().includes("/presentation/d1-409h-a1/"))return;
    browserErrors.push(`requestfailed: ${request.url()} ${reason}`);
  });
  page.on("response",(response)=>{
    if(response.status()>=400&&!/favicon\.ico(?:\?|$)/.test(response.url())){
      browserErrors.push(`http-${response.status()}: ${response.url()}`);
    }
  });

  if(persona.prepare){
    await boot(page,"administrator");
    await seed(page,7,{persist:true,label:"Prepare removed-access fixture"});
  }
  await boot(page,persona.scenario);
  if(!persona.prepare)await seed(page,7,{persist:true});

  await runCheck(persona,"1 · runtime, persona, and canonical navigation",async()=>{
    const result=await page.evaluate(()=>({
      access:window.D1_407F_ENGINEERING.store.entitlement.access,
      canMutate:window.D1_407F_ENGINEERING.store.entitlement.canMutate,
      labels:[...document.querySelectorAll("#rail [data-v]")].map((node)=>node.textContent.trim()),
      current:document.querySelectorAll('#rail [aria-current="page"]').length,
      duplicateIds:[...document.querySelectorAll("[id]")].map((node)=>node.id).filter((id,index,all)=>all.indexOf(id)!==index)
    }));
    assert(result.access===persona.expectedAccess,`expected ${persona.expectedAccess}, received ${result.access}`);
    assert(result.canMutate===persona.writable,`mutation capability mismatch: ${result.canMutate}`);
    assert(JSON.stringify(result.labels)===JSON.stringify(["Home","Builder","Edit Timeline","Media","Export"]),`navigation drift: ${result.labels.join(", ")}`);
    assert(result.current===1,"expected exactly one aria-current destination");
    assert(result.duplicateIds.length===0,`duplicate ids: ${result.duplicateIds.join(", ")}`);
    return result;
  });

  await runCheck(persona,"2 · protected-kernel authority and fallback exclusion",async()=>{
    await navigate(page,"builder");
    const host=await kernel(page,"builder");
    const evidence=await kernelEvidence(host);
    assert(evidence.host.src.includes("/presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html"),`unexpected master: ${evidence.host.src}`);
    assert(evidence.child.diagnostics.kernelId==="D1-409H-A1","diagnostics kernel mismatch");
    assert(evidence.child.diagnostics.lastError===null,`kernel error: ${evidence.child.diagnostics.lastError}`);
    assert(evidence.child.axis===1,`expected one axis, received ${evidence.child.axis}`);
    assert(await page.locator('section.live [data-presentation-kernel="legacy"]').count()===0,"active legacy renderer marker found");
    return{fingerprint:evidence.host.fingerprint,counts:evidence.child.diagnostics.counts};
  });

  await runCheck(persona,"3 · sparse, medium, dense, and adaptive-axis rendering",async()=>{
    const counts=persona.writable?[3,7,13]:[7];
    const rendered=[];
    for(const count of counts){
      if(persona.writable)await seed(page,count);
      await navigate(page,"builder");
      const evidence=await kernelEvidence(await kernel(page,"builder"));
      assert(evidence.child.arrows===count,`expected ${count} arrows, received ${evidence.child.arrows}`);
      assert(evidence.child.axis===1,"adaptive axis is missing or duplicated");
      const collisionWarnings=(evidence.child.diagnostics.warnings||[]).filter((warning)=>
        /COLLISION|OUT_OF_BOUNDS|TEXT_FIT/i.test(String(warning))
      );
      assert(collisionWarnings.length===0,`dense render warnings: ${collisionWarnings.join(", ")}`);
      rendered.push({count,fingerprint:evidence.host.fingerprint,collisionWarnings:0});
    }
    if(persona.writable)await seed(page,7);
    return rendered;
  });

  await runCheck(persona,"4 · five-surface single-kernel parity",async()=>{
    const fingerprints=[];
    const visualModels=[];
    await navigate(page,"command");
    let surfaceHost=await kernel(page,"home");
    let surfaceEvidence=await kernelEvidence(surfaceHost);
    fingerprints.push(surfaceEvidence.host.fingerprint);
    visualModels.push(surfaceEvidence.child.visualModel);
    if(captureDir&&persona.id==="administrator"){
      await page.screenshot({path:`${captureDir}/D1-411B_HOME.png`,fullPage:true});
      await surfaceHost.screenshot({path:`${captureDir}/D1-411B_HOME_ARTIFACT.png`});
    }
    await navigate(page,"builder");
    surfaceHost=await kernel(page,"builder");
    surfaceEvidence=await kernelEvidence(surfaceHost);
    fingerprints.push(surfaceEvidence.host.fingerprint);
    visualModels.push(surfaceEvidence.child.visualModel);
    if(captureDir&&persona.id==="administrator")await page.screenshot({path:`${captureDir}/D1-411B_BUILDER.png`,fullPage:true});
    await page.locator("#builderPreviewToggle").click();
    surfaceHost=await kernel(page,"full-preview");
    surfaceEvidence=await kernelEvidence(surfaceHost);
    fingerprints.push(surfaceEvidence.host.fingerprint);
    visualModels.push(surfaceEvidence.child.visualModel);
    if(captureDir&&persona.id==="administrator"){
      await page.screenshot({path:`${captureDir}/D1-411B_FULL_PREVIEW.png`,fullPage:true});
      await surfaceHost.screenshot({path:`${captureDir}/D1-411B_FULL_PREVIEW_ARTIFACT.png`});
    }
    await page.locator("[data-builder-preview-close]").click();
    await navigate(page,"canvas");
    surfaceHost=await kernel(page,"edit");
    surfaceEvidence=await kernelEvidence(surfaceHost);
    fingerprints.push(surfaceEvidence.host.fingerprint);
    visualModels.push(surfaceEvidence.child.visualModel);
    if(captureDir&&persona.id==="administrator")await page.screenshot({path:`${captureDir}/D1-411B_EDIT_TIMELINE.png`,fullPage:true});
    await navigate(page,"export");
    surfaceHost=await kernel(page,"export");
    surfaceEvidence=await kernelEvidence(surfaceHost);
    fingerprints.push(surfaceEvidence.host.fingerprint);
    visualModels.push(surfaceEvidence.child.visualModel);
    if(captureDir&&persona.id==="administrator"){
      await page.screenshot({path:`${captureDir}/D1-411B_EXPORT.png`,fullPage:true});
      await surfaceHost.screenshot({path:`${captureDir}/D1-411B_EXPORT_ARTIFACT.png`});
    }
    assert(new Set(visualModels).size===1,"surface presentation models diverged");
    return{surfaces:5,presentationModels:new Set(visualModels).size,fingerprints:[...new Set(fingerprints)]};
  });

  await runCheck(persona,"5 · hydration, rerender, and lifecycle stability",async()=>{
    await navigate(page,"builder");
    const initialHost=await kernel(page,"builder");
    const before=(await kernelEvidence(initialHost)).host.fingerprint;
    const nonvisualProbe=await page.evaluate((writable)=>{
      window.__d1411PreviewBefore=document.querySelector('d1-timeline-kernel[data-surface="builder"]');
      try{
        window.D1_407F_ENGINEERING.store.mutate(
          "Nonvisual save-status probe",
          (document)=>{document.metadata.nonvisualSaveProbe=(document.metadata.nonvisualSaveProbe||0)+1;},
          {history:false,material:false}
        );
        return{mutated:true,error:""};
      }catch(error){
        return{mutated:false,error:String(error?.code||error?.name||error)};
      }
    },persona.writable);
    if(persona.writable)assert(nonvisualProbe.mutated,"writable nonvisual probe was rejected");
    else assert(!nonvisualProbe.mutated&&/ENTITLEMENT|TimelineEntitlementError/i.test(nonvisualProbe.error),"read-only nonvisual probe did not fail closed");
    await page.waitForTimeout(120);
    assert(await page.evaluate(()=>window.__d1411PreviewBefore===document.querySelector('d1-timeline-kernel[data-surface="builder"]')),"nonvisual save replaced the last-good preview");
    assert(await initialHost.evaluate((element)=>element.dataset.ready==="true"&&element.shadowRoot?.querySelector("[data-loading]")?.checkVisibility()===false),"nonvisual save exposed the loading replacement");
    await page.evaluate(()=>{window.D1_407F_ENGINEERING.applyDocument();window.D1_407F_ENGINEERING.applyDocument();});
    const afterEvidence=await kernelEvidence(await kernel(page,"builder"));
    assert(afterEvidence.host.fingerprint===before,"unchanged document fingerprint changed");
    assert(afterEvidence.child.axis===1,"rerender duplicated the axis");
    assert(await page.locator('section.live d1-timeline-kernel[data-surface="builder"]').count()===1,"stale Builder kernel remained mounted");
    await navigate(page,"command");
    assert(await page.locator('section.live d1-timeline-kernel[data-surface="builder"]').count()===0,"disconnected Builder kernel remained live");
    return{fingerprint:before,axis:afterEvidence.child.axis};
  });

  await runCheck(persona,"6 · Builder semantic click-to-edit",async()=>{
    await navigate(page,"builder");
    const evidence=await kernelEvidence(await kernel(page,"builder"));
    const before=await page.evaluate(()=>JSON.stringify(window.D1_407F_ENGINEERING.store.document.events.map(
      ({id,title,categoryId,startDate,endDate})=>({id,title,categoryId,startDate,endDate})
    )));
    const hits=evidence.frame.locator("[data-d1-411a-hit]");
    if(!persona.writable){
      assert(await hits.count()===0,"read-only Builder exposed interaction proxies");
      return"read-only preview exposes no mutation targets";
    }
    await hits.first().waitFor({state:"visible",timeout:1200});
    assert(await hits.count()>=7,"Builder interaction proxies are missing");
    await hits.first().click();
    await page.waitForTimeout(150);
    const after=await page.evaluate(()=>JSON.stringify(window.D1_407F_ENGINEERING.store.document.events.map(
      ({id,title,categoryId,startDate,endDate})=>({id,title,categoryId,startDate,endDate})
    )));
    assert(after===before,"selection mutated event data");
    assert(await page.locator('#rail [aria-current="page"][data-v="builder"]').count()===1,"event did not route to Builder");
    return"visual id resolved to domain event without data mutation";
  });

  await runCheck(persona,"7 · Full Preview focus, keyboard, and 44px targets",async()=>{
    await navigate(page,"builder");
    const opener=page.locator("#builderPreviewToggle");
    await opener.click();
    const evidence=await kernelEvidence(await kernel(page,"full-preview"));
    const hits=evidence.frame.locator("[data-d1-411a-hit]");
    if(persona.writable){
      const boxes=await hits.evaluateAll((nodes)=>nodes.map((node)=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height,tabindex:node.tabIndex};}));
      assert(boxes.length>=7,"Full Preview has no interaction targets");
      assert(boxes.every(({width,height})=>width>=43.5&&height>=43.5),`undersized targets: ${JSON.stringify(boxes)}`);
      await hits.first().focus();
      await hits.first().press("ArrowRight");
      assert(await hits.evaluateAll((nodes)=>nodes.filter((node)=>node.tabIndex===0).length)===1,"roving tabindex is invalid");
    }else assert(await hits.count()===0,"read-only Full Preview exposed interaction proxies");
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-builder-preview-surface="lightbox"]',{state:"hidden"});
    assert(await opener.evaluate((node)=>document.activeElement===node),"focus was not restored to the Full Preview opener");
    return persona.writable?"targets >=44px; roving focus and Escape passed":"read-only semantics and Escape passed";
  });

  await runCheck(persona,"8 · Edit Timeline selection and details continuity",async()=>{
    await navigate(page,"canvas");
    const evidence=await kernelEvidence(await kernel(page,"edit"));
    const hits=evidence.frame.locator("[data-d1-411a-hit]");
    if(!persona.writable){
      assert(await hits.count()===0,"read-only Edit Timeline exposed proxies");
      assert(await page.locator('[data-screen="canvas"][data-view-only="true"]').count()===1,"read-only Canvas contract missing");
      return"read-only Canvas blocks selection and mutation";
    }
    await hits.first().click();
    const sheet=page.locator("[data-details-sheet]");
    await sheet.waitFor({state:"visible"});
    const eventId=await sheet.getAttribute("data-event-id");
    assert(eventId==="d1-411b-browser-0",`wrong domain event selected: ${eventId}`);
    const title=sheet.locator('[data-canvas-detail-key="title"]');
    await title.fill("Event 1 · edited");
    await sheet.locator("[data-canvas-details-save]").click();
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.events[0]?.title.includes("edited"));
    return{eventId,title:"Event 1 · edited"};
  });

  await runCheck(persona,"9 · direct keyboard move, resize, undo, and redo",async()=>{
    await navigate(page,"canvas");
    let evidence=await kernelEvidence(await kernel(page,"edit"));
    if(!persona.writable){
      const before=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.events[0].startDate);
      assert(await evidence.frame.locator("[data-d1-411a-hit]").count()===0,"read-only gesture proxy exists");
      assert(await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.events[0].startDate)===before,"read-only date changed");
      return"read-only dates and history unchanged";
    }
    const before=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.events[0].startDate);
    let hit=evidence.frame.locator("[data-d1-411a-hit]").first();
    await hit.focus();
    await hit.press("Shift+ArrowRight");
    await page.waitForFunction((before)=>window.D1_407F_ENGINEERING.store.document.events[0].startDate!==before,before);
    const moved=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.events[0].startDate);
    evidence=await kernelEvidence(await kernel(page,"edit"));
    hit=evidence.frame.locator("[data-d1-411a-hit]").first();
    await hit.focus();
    await hit.press("Meta+z");
    await page.waitForFunction((before)=>window.D1_407F_ENGINEERING.store.document.events[0].startDate===before,before);
    evidence=await kernelEvidence(await kernel(page,"edit"));
    hit=evidence.frame.locator("[data-d1-411a-hit]").first();
    await hit.focus();
    await hit.press("Meta+Shift+z");
    await page.waitForFunction((moved)=>window.D1_407F_ENGINEERING.store.document.events[0].startDate===moved,moved);
    return{before,moved,undo:before,redo:moved};
  });

  await runCheck(persona,"10 · shared Media projection fails closed without verified bytes",async()=>{
    if(!persona.writable)return"read-only Media mutation is unavailable";
    await page.evaluate(()=>{
      const api=window.D1_407F_ENGINEERING;
      const document=api.store.snapshot();
      document.advanced={...document.advanced,media:[...(document.advanced?.media||[]),{
        id:"unverified-browser-media",type:"media",role:"photo",placed:true,
        source:{src:"data:image/png;base64,iVBORw0KGgo=",mime:"image/png",contentSha256:""}
      }]};
      api.store.replace(document,{label:"Add unverified browser media",history:false});
      api.applyDocument();
    });
    await navigate(page,"builder");
    const evidence=await kernelEvidence(await kernel(page,"builder"));
    assert(evidence.child.photos===0,"unverified media entered the protected kernel");
    const projectionWarnings=JSON.parse(evidence.host.projectionWarnings||"[]");
    assert(projectionWarnings.some((warning)=>String(warning).includes("MEDIA_HASH_UNAVAILABLE")),`missing fail-closed warning: ${JSON.stringify(projectionWarnings)}`);
    await page.evaluate(()=>{
      const api=window.D1_407F_ENGINEERING;
      const document=api.store.snapshot();
      document.advanced.media=(document.advanced?.media||[]).filter((item)=>item.id!=="unverified-browser-media");
      api.store.replace(document,{label:"Remove unverified browser media",history:false});
      api.applyDocument();
    });
    return"unverified media omitted with explicit warning";
  });

  await runCheck(persona,"11 · autosave, reload, history, and persistence",async()=>{
    const before=await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.metadata?.browserPersistenceProbe||"");
    if(persona.writable){
      await page.evaluate(async()=>{
        const api=window.D1_407F_ENGINEERING;
        api.store.mutate("Browser persistence probe",(document)=>{document.metadata.browserPersistenceProbe="persisted";});
        await api.store.saveNow("D1_411B_BROWSER_PERSISTENCE");
      });
      await page.reload({waitUntil:"networkidle"});
      await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
      assert(await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.metadata?.browserPersistenceProbe)==="persisted","reload lost the saved mutation");
      return"saved mutation restored after reload";
    }
    const denied=await page.evaluate(()=>{
      try{window.D1_407F_ENGINEERING.store.mutate("Denied mutation",(document)=>{document.metadata.browserPersistenceProbe="changed";});return false;}catch{return true;}
    });
    assert(denied,"read-only store accepted a mutation");
    assert(await page.evaluate(()=>window.D1_407F_ENGINEERING.store.document.metadata?.browserPersistenceProbe||"")===before,"read-only document changed");
    return"read-only mutation rejected and persistence unchanged";
  });

  await runCheck(persona,"12 · responsive, reduced-motion, and accessibility",async()=>{
    await page.setViewportSize({width:390,height:844});
    await navigate(page,"builder");
    const host=await kernel(page,"builder");
    const box=await host.boundingBox();
    assert(box&&Math.abs(box.width/box.height-16/9)<0.03,`kernel aspect ratio drifted: ${JSON.stringify(box)}`);
    const motion=await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches);
    assert(motion,"reduced-motion preference was not observed");
    assert(await page.locator('section.live h1,section.live [role="heading"][aria-level="1"]').count()>=1,"active screen heading missing");
    await page.setViewportSize({width:1440,height:1000});
    return{viewport:"390x844",ratio:+(box.width/box.height).toFixed(4),reducedMotion:motion};
  });

  await runCheck(persona,"13 · Advanced manual axis and fixed-six color key",async()=>{
    if(!persona.writable)return"read-only persona has no Advanced presentation controls";
    await navigate(page,"canvas");
    await page.evaluate(()=>{
      const api=window.D1_407F_ENGINEERING;
      const document=api.store.snapshot();
      document.mode="advanced";
      document.advanced={...(document.advanced||{}),enteredBefore:true};
      api.store.replace(document,{label:"Enter Advanced presentation proof",history:false});
      api.applyDocument();
    });
    const mode=page.locator("[data-axis-override-mode]");
    await mode.waitFor({state:"visible"});
    await mode.selectOption("manual");
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis?.mode==="manual");
    await page.locator('[data-axis-override-field="startYear"]').fill("2008");
    await page.locator('[data-axis-override-field="startYear"]').press("Tab");
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis?.startYear===2008);
    let evidence=await kernelEvidence(await kernel(page,"edit"));
    const axisLabels=await evidence.frame.locator("#axis .yseg span").allTextContents();
    assert(axisLabels[0]==="2008",`manual axis did not render 2008: ${axisLabels.join(",")}`);
    const education=page.locator('[data-category-key-id="education"]');
    const fittedLabel="Medical training milestones 2026";
    await education.locator('[data-category-key-field="label"]').fill(fittedLabel);
    await education.locator('[data-category-key-field="label"]').press("Tab");
    await education.locator('[data-category-key-field="color"]').fill("#123abc");
    await education.locator('[data-category-key-field="color"]').press("Tab");
    await page.waitForFunction(()=>window.D1_407F_ENGINEERING.store.document.presentationOverrides?.categoryKey?.[0]?.color==="#123ABC");
    const advancedHost=await kernel(page,"edit");
    evidence=await kernelEvidence(advancedHost);
    const key=await evidence.frame.locator("#key").evaluate((node)=>({
      rows:node.querySelectorAll(".row").length,
      labels:[...node.querySelectorAll(".row span")].map((item)=>item.textContent),
      colors:[...node.querySelectorAll(".row .sw")].map((item)=>getComputedStyle(item).backgroundColor),
      sizes:[...node.querySelectorAll(".row span")].map((item)=>getComputedStyle(item).fontSize)
    }));
    assert(key.rows===6,`expected six key rows, received ${key.rows}`);
    assert(key.labels[0]===fittedLabel,`category label not rendered: ${key.labels[0]}`);
    assert(key.colors[0]==="rgb(18, 58, 188)",`category color not rendered: ${key.colors[0]}`);
    assert(key.sizes[0]==="16px",`long category label did not use deterministic fit: ${key.sizes[0]}`);
    if(captureDir&&persona.id==="administrator"){
      await page.screenshot({path:`${captureDir}/D1-411A_ADVANCED_CONTROLS.png`,fullPage:true});
      await advancedHost.screenshot({path:`${captureDir}/D1-411A_MANUAL_AXIS_COLOR_KEY_ARTIFACT.png`});
    }
    await page.locator("[data-category-key-reset]").click();
    await page.locator("[data-axis-override-reset]").click();
    await page.waitForFunction(()=>!window.D1_407F_ENGINEERING.store.document.presentationOverrides?.categoryKey&&!window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis);
    evidence=await kernelEvidence(await kernel(page,"edit"));
    assert(await evidence.frame.locator("#key .row").count()===5,"reset did not restore accepted five-row key");
    await mode.selectOption("manual");
    await page.locator('[data-axis-override-field="startYear"]').fill("2008");
    await page.locator('[data-axis-override-field="startYear"]').press("Tab");
    await education.locator('[data-category-key-field="label"]').fill(fittedLabel);
    await education.locator('[data-category-key-field="label"]').press("Tab");
    await education.locator('[data-category-key-field="color"]').fill("#123abc");
    await education.locator('[data-category-key-field="color"]').press("Tab");
    await page.waitForFunction(()=>
      window.D1_407F_ENGINEERING.store.document.presentationOverrides?.axis?.startYear===2008&&
      window.D1_407F_ENGINEERING.store.document.presentationOverrides?.categoryKey?.[0]?.color==="#123ABC"
    );
    return{manualAxisStart:2008,fixedCategoryOrder:6,resetRows:5,customStateRestoredForExport:true};
  });

  await runCheck(persona,"14 · same-DOM PNG/PDF export and fresh browser errors",async()=>{
    await navigate(page,"export");
    const host=await kernel(page,"export");
    const fingerprint=await host.getAttribute("data-fingerprint");
    const button=page.locator("[data-export-action]");
    const exportDurations={};
    if(!persona.writable){
      assert(await button.isDisabled(),"read-only Export action is enabled");
    }else{
      const pngStarted=performance.now();
      const [png]=await Promise.all([
        page.waitForEvent("download",{timeout:30000}),
        button.click()
      ]);
      exportDurations.pngMs=+(performance.now()-pngStarted).toFixed(1);
      assert(png.suggestedFilename().endsWith(".png"),`unexpected PNG filename: ${png.suggestedFilename()}`);
      const pngPath=await png.path();
      assert(pngPath&&statSync(pngPath).size>1000,"PNG export is empty");
      if(captureDir&&persona.id==="administrator")await png.saveAs(`${captureDir}/D1-411B_EXPORT_1920x1080.png`);
      if(persona.id==="administrator"){
        await page.locator('[name="export-format"][value="pdf-letter-landscape"]').check();
        const suggestion=page.locator("[data-export-suggestion-dismiss]");
        if(await suggestion.count())await suggestion.click();
        const letterStarted=performance.now();
        const [pdf]=await Promise.all([
          page.waitForEvent("download",{timeout:60000}),
          page.locator("[data-export-action]").click()
        ]);
        exportDurations.letterPdfMs=+(performance.now()-letterStarted).toFixed(1);
        assert(pdf.suggestedFilename().endsWith(".pdf"),`unexpected PDF filename: ${pdf.suggestedFilename()}`);
        const pdfPath=await pdf.path();
        assert(pdfPath&&statSync(pdfPath).size>1000,"PDF export is empty");
        const letterBytes=readFileSync(pdfPath).toString("latin1");
        assert(letterBytes.includes("/MediaBox [0 0 792 612]"),"Letter export is not a true Letter landscape page");
        assert(letterBytes.includes("792 0 0 445.5 0 83.25 cm"),"Letter export stretched the canonical 16:9 board");
        if(captureDir)await pdf.saveAs(`${captureDir}/D1-411B_EXPORT_LETTER.pdf`);
        await page.locator('[name="export-format"][value="pdf-a4-landscape"]').check();
        const a4Started=performance.now();
        const [a4]=await Promise.all([
          page.waitForEvent("download",{timeout:60000}),
          page.locator("[data-export-action]").click()
        ]);
        exportDurations.a4PdfMs=+(performance.now()-a4Started).toFixed(1);
        const a4Path=await a4.path();
        assert(a4Path&&statSync(a4Path).size>1000,"A4 PDF export is empty");
        const a4Bytes=readFileSync(a4Path).toString("latin1");
        assert(a4Bytes.includes("/MediaBox [0 0 841.89 595.28]"),"A4 export is not a true A4 landscape page");
        assert(/841\.89 0 0 473\.56312\d* 0 60\.85843\d* cm/.test(a4Bytes),"A4 export stretched the canonical 16:9 board");
        if(captureDir)await a4.saveAs(`${captureDir}/D1-411B_EXPORT_A4.pdf`);
      }
      const currentExportHost=await kernel(page,"export");
      assert(await currentExportHost.getAttribute("data-protected-kernel")==="D1-409H-A1","Export preview left the protected kernel after download");
    }
    assert(browserErrors.length===0,browserErrors.join("\n"));
    return persona.writable?{fingerprint,downloads:persona.id==="administrator"?["png","letter-pdf","a4-pdf"]:["png"],durations:exportDurations,browserErrors:0}:{fingerprint,downloads:[],browserErrors:0};
  });

  await context.close();
}

await browser.close();
const failed=checks.filter(({status})=>status==="FAIL");
const summary={
  appUrl,
  generatedAt:new Date().toISOString(),
  personas:personas.map(({id})=>id),
  workflowsPerPersona:14,
  expected:personas.length*14,
  passed:checks.length-failed.length,
  failed:failed.length,
  checks
};
console.log(JSON.stringify(summary,null,2));
if(failed.length)process.exitCode=1;
