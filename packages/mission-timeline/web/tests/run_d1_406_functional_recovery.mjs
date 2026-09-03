import {createRequire} from "node:module";
import {existsSync} from "node:fs";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8793/web/";

const {chromium}=require(playwrightRuntime);
const browserErrors=[];
const checks=[];

function assert(condition,message){
  if(!condition)throw new Error(message);
}

async function check(name,operation){
  const started=performance.now();
  try{
    const detail=await operation();
    checks.push({name,status:"PASS",durationMs:+(performance.now()-started).toFixed(1),detail:detail||null});
    console.log(`PASS ${name}`);
  }catch(error){
    checks.push({name,status:"FAIL",durationMs:+(performance.now()-started).toFixed(1),detail:String(error?.message||error)});
    console.log(`FAIL ${name}: ${String(error?.message||error)}`);
  }
}

async function waitForDomQuiet(selector,quietMs=300){
  await page.waitForFunction(({selector,quietMs})=>new Promise((resolve)=>{
    const root=document.querySelector(selector);
    if(!root){
      resolve(false);
      return;
    }
    let timer=0;
    const observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(done,quietMs);
    });
    const done=()=>{
      observer.disconnect();
      resolve(true);
    };
    observer.observe(root,{attributes:true,childList:true,subtree:true});
    timer=setTimeout(done,quietMs);
  }),{selector,quietMs});
}

assert(existsSync(chromeExecutable),`Chrome executable not found: ${chromeExecutable}`);
const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({
  viewport:{width:1440,height:1000},
  reducedMotion:"reduce",
  acceptDownloads:true
});
const page=await context.newPage();
page.on("pageerror",(error)=>browserErrors.push(`pageerror: ${error.message}`));
page.on("console",(message)=>{
  if(message.type()==="error")browserErrors.push(`console: ${message.text()}`);
});
page.on("requestfailed",(request)=>{
  browserErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText||"unknown"}`);
});

await page.goto(appUrl,{waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING&&!!window.D1_407F_TEST);

await check("canonical navigation is present in frozen order",async()=>{
  const labels=await page.locator("#rail [data-v]").allTextContents();
  assert(
    JSON.stringify(labels.map((label)=>label.trim()))===
      JSON.stringify(["Home","Builder","Edit Timeline","Media","Export"]),
    `unexpected navigation: ${labels.join(", ")}`
  );
  return labels.map((label)=>label.trim()).join(" > ");
});

await check("primary navigation exposes one current destination",async()=>{
  const routes=["command","builder","canvas","media","export"];
  for(const route of routes){
    await page.locator(`#rail [data-v="${route}"]`).click();
    const current=await page.locator('#rail [aria-current="page"]').getAttribute("data-v");
    assert(current===route,`expected aria-current on ${route}, received ${current}`);
    assert(await page.locator('#rail [aria-current="page"]').count()===1,"multiple current navigation destinations");
  }
  return "Home, Builder, Edit Timeline, Media, and Export each expose aria-current";
});

async function seedDurationEvents(count){
  await page.evaluate((eventCount)=>{
    const api=window.D1_407F_TEST;
    api.state.wiz.name="Browser Regression Student";
    api.state.wiz.school="Browser Regression Medical School";
    api.state.wiz.country="United States";
    api.state.wiz.grad="2024-05";
    api.state.user.events=Array.from({length:eventCount},(_,index)=>({
      id:`d1-406-browser-${eventCount}-${index}`,
      t:`Browser event ${index+1}`,
      cat:["work","cl","th","res"][index%4],
      mile:false,
      s:`${2020+(index%5)}-${String((index%9)+1).padStart(2,"0")}`,
      e:`${2020+(index%5)}-${String((index%9)+3).padStart(2,"0")}`,
      vis:"safe",
      loc:index%2?"Browser Hospital":"",
      origin:"d1-406-browser-regression",
      notes:"",
      lane:null
    }));
    api.renderAll();
  },count);
  await page.waitForFunction(
    (eventCount)=>window.D1_407F_ENGINEERING.store.document.events.length===eventCount,
    count
  );
  await page.evaluate(()=>window.D1_407F_ENGINEERING.applyDocument());
  await page.waitForFunction(()=>new Promise((resolve)=>
    requestAnimationFrame(()=>requestAnimationFrame(resolve))
  ));
}

for(const [count,expected] of [[3,"sparse"],[7,"medium"],[15,"dense"]]){
  await check(`${expected} persona uses intentional locked composition`,async()=>{
    await seedDurationEvents(count);
    await page.locator('#rail [data-v="builder"]').click();
    await page.waitForSelector('section.live [data-locked-407f-source-sha256]');
    const density=await page.locator('section.live [data-composition-density]').first().getAttribute("data-composition-density");
    assert(density===expected,`expected ${expected}, received ${density}`);
    const heights=await page.locator('section.live [data-event-kind="arrow"]').evaluateAll((nodes)=>
      nodes.map((node)=>getComputedStyle(node).height)
    );
    assert(heights.length===count,`expected ${count} arrows, received ${heights.length}`);
    assert(heights.every((height)=>height==="30px"),`canonical arrow height drifted: ${heights.join(", ")}`);
    return `${count} events, ${density}, ${heights.length} arrows`;
  });
}

await check("Home, Builder, Edit Timeline, and Export share the locked renderer",async()=>{
  const hashes=[];
  for(const route of ["command","builder","canvas","export"]){
    await page.locator(`#rail [data-v="${route}"]`).click();
    await page.waitForSelector('section.live [data-locked-407f-source-sha256]');
    hashes.push({
      route,
      hash:await page.locator('section.live [data-locked-407f-source-sha256]').first().getAttribute("data-locked-407f-source-sha256"),
      language:await page.locator('section.live [data-artifact-language]').first().getAttribute("data-artifact-language")
    });
  }
  assert(new Set(hashes.map(({hash})=>hash)).size===1,`renderer hashes differ: ${JSON.stringify(hashes)}`);
  assert(hashes.every(({language})=>language==="407f-powerpoint-keynote"),"artifact language drifted");
  return hashes;
});

await check("Builder static preview owners are valid and route by pointer and keyboard",async()=>{
  await page.locator('#rail [data-v="builder"]').click();
  await page.waitForSelector('[data-builder-preview-surface="embedded"] [data-builder-preview-owner]');
  const invalid=await page.evaluate(()=>[...document.querySelectorAll(
    '[data-builder-preview-surface="embedded"] [data-builder-preview-owner]'
  )].filter((node)=>
    !node.hasAttribute("data-builder-preview-proxied-source")&&
    !["0","-1"].includes(node.getAttribute("tabindex"))
  ).map((node)=>node.outerHTML));
  assert(invalid.length===0,`invalid owner markup: ${invalid.join("\n")}`);
  await page.locator('[data-builder-preview-surface="embedded"] [data-builder-preview-hit-proxy][data-owner-id="title"]').click({force:true});
  await page.waitForFunction(()=>document.activeElement?.matches?.('[data-core="name"]'));
  const profile=page.locator('[data-builder-preview-surface="embedded"] [data-builder-preview-hit-proxy][data-owner-id="profile"]');
  await profile.focus();
  await profile.press("Enter");
  await page.waitForFunction(()=>document.activeElement?.matches?.('[data-school-search],[data-core="school"]'));
  return "title pointer -> full name; profile Enter -> school registry";
});

await check("Builder and Full Preview owners have 44px effective targets",async()=>{
  const selector=':is([data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake],[data-builder-preview-owner])';
  const measure=async(surface)=>{
    await page.waitForFunction(({surface,selector})=>{
      const nodes=[...document.querySelectorAll(`${surface} ${selector}`)].filter(
        (node)=>!node.hasAttribute("data-builder-preview-proxied-source")&&(
          node.tagName==="BUTTON"||node.getAttribute("role")==="button"
        )
      );
      return nodes.length>0&&nodes.every((node)=>{
        const rect=node.getBoundingClientRect();
        return rect.width>=43.5&&rect.height>=43.5;
      });
    },{surface,selector},{timeout:2000}).catch(()=>{});
    return page.locator(`${surface} ${selector}`).evaluateAll((nodes)=>nodes.filter(
      (node)=>!node.hasAttribute("data-builder-preview-proxied-source")&&(
        node.tagName==="BUTTON"||node.getAttribute("role")==="button"
      )
    ).map((node)=>{
      const rect=node.getBoundingClientRect();
      const view=node.closest("section[data-view]");
      const preview=node.closest("[data-builder-preview-surface]");
      return{
        label:node.getAttribute("aria-label")||node.textContent?.trim()?.slice(0,40)||node.tagName,
        width:rect.width,
        height:rect.height,
        view:view?.dataset?.view||null,
        viewClass:view?.className||"",
        viewDisplay:view?getComputedStyle(view).display:null,
        previewDisplay:preview?getComputedStyle(preview).display:null,
        hostId:preview?.parentElement?.id||null,
        hostSignature:preview?.parentElement?.dataset?.builderPreviewSignature||null
      };
    }));
  };
  await page.locator('#rail [data-v="builder"]').click();
  const embedded=await measure('[data-builder-preview-surface="embedded"]');
  assert(embedded.length>0,"embedded preview has no interactive owners");
  assert(embedded.every(({width,height})=>width>=43.5&&height>=43.5),`undersized embedded owners: ${JSON.stringify(embedded.filter(({width,height})=>width<43.5||height<43.5))}`);
  await page.locator('#builderPreviewToggle').click();
  await page.waitForSelector('[data-builder-preview-surface="lightbox"]');
  const lightbox=await measure('[data-builder-preview-surface="lightbox"]');
  assert(lightbox.every(({width,height})=>width>=43.5&&height>=43.5),`undersized Full Preview owners: ${JSON.stringify(lightbox.filter(({width,height})=>width<43.5||height<43.5))}`);
  await page.locator('[data-builder-preview-close]').click();
  return `${embedded.length} embedded and ${lightbox.length} Full Preview owners meet 44px`;
});

await check("Canvas toolbar and direct-edit controls preserve separation and 44px targets",async()=>{
  await seedDurationEvents(7);
  await page.locator('#rail [data-v="canvas"]').click();
  await page.waitForSelector('[data-canvas-toolbar] [data-open-media-library]');
  const boxes=await page.evaluate(()=>{
    const rect=(selector)=>{
      const box=document.querySelector(selector)?.getBoundingClientRect();
      return box?{left:box.left,right:box.right,top:box.top,bottom:box.bottom,width:box.width,height:box.height}:null;
    };
    return{
      media:rect('[data-canvas-toolbar] [data-open-media-library]'),
      guided:rect('[data-canvas-action="guided"]'),
      advanced:rect('[data-canvas-action="advanced"]')
    };
  });
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  assert(boxes.media&&boxes.guided&&boxes.advanced,`missing toolbar controls: ${JSON.stringify(boxes)}`);
  assert(!intersects(boxes.media,boxes.guided)&&!intersects(boxes.media,boxes.advanced),`Media overlaps mode controls: ${JSON.stringify(boxes)}`);
  const canvasEventTargets='[data-canvas-effective-hit-proxy][data-canvas-event], [data-canvas-event]:not([data-canvas-effective-hit-source])';
  await page.waitForFunction((selector)=>{
    const nodes=[...document.querySelectorAll(selector)];
    return nodes.length>0&&nodes.every((node)=>{
      const rect=node.getBoundingClientRect();
      return rect.width>=43.5&&rect.height>=43.5;
    });
  },canvasEventTargets,{timeout:2000});
  const events=await page.locator(canvasEventTargets).evaluateAll((nodes)=>nodes.map((node)=>{
    const rect=node.getBoundingClientRect();
    return{width:rect.width,height:rect.height};
  }));
  assert(events.length>0,"Canvas has no effective event targets");
  assert(events.every(({width,height})=>width>=43.5&&height>=43.5),`undersized Canvas events: ${JSON.stringify(events)}`);
  const firstEventId=await page.locator(canvasEventTargets).first().getAttribute("data-event-id");
  assert(firstEventId,"Canvas target is missing its event identity");
  await page.locator(`[data-canvas-event][data-event-id="${firstEventId}"]:not([data-canvas-effective-hit-proxy])`).first().click();
  const handles=await page.locator('.guided-arrow-handles button').evaluateAll((nodes)=>nodes.map((node)=>{
    const rect=node.getBoundingClientRect();
    return{width:rect.width,height:rect.height};
  }));
  assert(handles.length===2,"guided arrow resize handles are missing");
  assert(handles.every(({width,height})=>width>=43.5&&height>=43.5),`undersized resize handles: ${JSON.stringify(handles)}`);
  return{toolbar:boxes,eventTargets:events.length,resizeHandles:handles};
});

await check("Advanced Text is visible, focused, selectable, and keyboard movable",async()=>{
  await page.evaluate(()=>{
    const engineering=window.D1_407F_ENGINEERING;
    engineering.store.replace({
      ...engineering.store.document,
      mode:"advanced",
      layoutLock:false,
      advanced:{...engineering.store.document.advanced,enteredBefore:true}
    },{label:"Browser test Advanced Studio",history:false});
    engineering.applyDocument();
  });
  await page.locator('#rail [data-v="canvas"]').click();
  await page.waitForSelector('[data-advanced-action="text"]');
  await page.locator('[data-advanced-action="text"]').click();
  await page.waitForSelector('[data-canvas-effective-hit-proxy][data-advanced-text]');
  const createdSource=page.locator('[data-canvas-effective-hit-source][data-advanced-text]').last();
  const createdTarget=page.locator('[data-canvas-effective-hit-proxy][data-advanced-text]').last();
  const before=await createdSource.evaluate((node)=>({
    text:node.textContent,
    x:Number(node.getAttribute("x")),
    width:node.getBoundingClientRect().width,
    height:node.getBoundingClientRect().height,
    active:document.activeElement?.matches?.('[data-advanced-text-content]')||false
  }));
  const targetSemantics=await createdTarget.evaluate((node)=>({
    tag:node.tagName,
    role:node.getAttribute("role"),
    tabindex:node.getAttribute("tabindex"),
    width:node.getBoundingClientRect().width,
    height:node.getBoundingClientRect().height
  }));
  assert(before.text==="Add your text",`unexpected created text: ${before.text}`);
  assert(before.width>0&&before.height>0,`Advanced Text is not visible: ${JSON.stringify(before)}`);
  assert(targetSemantics.tag==="BUTTON"&&targetSemantics.tabindex==="0",`Advanced Text is not keyboard selectable: ${JSON.stringify(targetSemantics)}`);
  assert(targetSemantics.width>=43.5&&targetSemantics.height>=43.5,`Advanced Text target is undersized: ${JSON.stringify(targetSemantics)}`);
  assert(before.active,"Advanced Text textarea was not focused");
  await createdTarget.focus();
  await createdTarget.press("ArrowRight");
  const afterX=Number(await page.locator('[data-canvas-effective-hit-source][data-advanced-text]').last().getAttribute("x"));
  assert(afterX===before.x+8,`Advanced Text did not move by 8px: ${before.x} -> ${afterX}`);
  return `${before.text}; visible ${before.width.toFixed(1)}x${before.height.toFixed(1)}; keyboard move ${before.x}->${afterX}`;
});

await check("Canvas undo restores data and updates both live regions",async()=>{
  await page.evaluate(()=>{
    const engineering=window.D1_407F_ENGINEERING;
    engineering.store.replace({...engineering.store.document,mode:"guided",layoutLock:true},{label:"Browser test Guided mode",history:false});
    engineering.applyDocument();
    engineering.canvas.setUiState((state)=>({...state,mode:"guided"}));
  });
  await seedDurationEvents(3);
  await page.locator('#rail [data-v="canvas"]').click();
  await waitForDomQuiet("#canvas407F");
  const first=page.locator('[data-canvas-effective-hit-proxy][data-canvas-event], [data-canvas-event]:not([data-canvas-effective-hit-source])').first();
  await first.waitFor({state:"visible"});
  const eventId=await first.getAttribute("data-event-id");
  assert(eventId,"Canvas target is missing its event identity");
  const selected=page.locator(`[data-canvas-effective-hit-proxy][data-event-id="${eventId}"], [data-canvas-event][data-event-id="${eventId}"]:not([data-canvas-effective-hit-source])`).first();
  await selected.focus();
  await page.waitForTimeout(50);
  const focusState=await page.evaluate(()=>({
    selectedEventId:window.D1_407F_ENGINEERING.canvas.state.selectedEventId,
    activeEventId:document.activeElement?.dataset?.eventId||"",
    activeTag:document.activeElement?.tagName||""
  }));
  assert(
    focusState.selectedEventId===eventId&&focusState.activeEventId===eventId,
    `Canvas focus did not settle on ${eventId}: ${JSON.stringify(focusState)}`
  );
  const before=await page.evaluate((id)=>window.D1_407F_ENGINEERING.store.document.events.find((event)=>event.id===id)?.startDate,eventId);
  await page.keyboard.press("ArrowRight");
  const moved=await page.evaluate((id)=>window.D1_407F_ENGINEERING.store.document.events.find((event)=>event.id===id)?.startDate,eventId);
  assert(moved!==before,`Canvas keyboard move did not change date: ${before}`);
  await page.keyboard.press("Meta+z");
  const restored=await page.evaluate((id)=>window.D1_407F_ENGINEERING.store.document.events.find((event)=>event.id===id)?.startDate,eventId);
  const canvasLive=await page.locator('[data-canvas-live]').textContent();
  const globalLive=await page.locator('#globalLive407F').textContent();
  assert(restored===before,`undo failed to restore ${before}: ${restored}`);
  assert(/Undid/.test(canvasLive||""),`Canvas live region is stale: ${canvasLive}`);
  assert(/Undid/.test(globalLive||""),`global live region is stale: ${globalLive}`);
  return `${before} -> ${moved} -> ${restored}; ${canvasLive}`;
});

await check("all five theme previews retain the locked renderer",async()=>{
  await page.locator('#rail [data-v="canvas"]').click();
  await page.waitForSelector('section.live [data-locked-407f-source-sha256]');
  await page.locator('[data-canvas-action="theme"]').click();
  await page.waitForSelector('[data-theme-picker]');
  const cards=await page.locator('[data-theme-picker] [data-select-theme]').count();
  const locked=await page.locator('[data-theme-picker] [data-locked-407f-source-sha256]').count();
  assert(cards===5,`expected five theme cards, received ${cards}`);
  assert(locked===5,`expected five locked theme previews, received ${locked}`);
  return `${cards} theme cards, ${locked} locked previews`;
});

await check("fresh browser errors are zero",async()=>{
  assert(browserErrors.length===0,browserErrors.join("\n"));
  return "0 page, console, and request errors";
});

await context.close();
await browser.close();

const failed=checks.filter(({status})=>status==="FAIL");
console.log(JSON.stringify({
  appUrl,
  generatedAt:new Date().toISOString(),
  passed:checks.length-failed.length,
  failed:failed.length,
  checks,
  browserErrors
},null,2));
if(failed.length)process.exitCode=1;
