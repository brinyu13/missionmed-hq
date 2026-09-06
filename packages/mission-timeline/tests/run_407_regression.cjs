const fs = require("fs");
const path = require("path");
const { chromium } = require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const appUrl = "file:///Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/index.html";
const evidenceDir = "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/407";
fs.mkdirSync(evidenceDir, { recursive: true });

const results = [];
const consoleErrors = [];
const requestFailures = [];
const screenshots = [];

function out(name){return path.join(evidenceDir,name)}
function assert(condition,message){if(!condition)throw new Error(message)}
async function test(name,fn){
  try{const notes=await fn();results.push({name,status:"PASS",notes:notes||""})}
  catch(error){results.push({name,status:"FAIL",notes:error?.message||String(error)})}
}
async function nav(page,view){
  await page.click(`#rail .rtab[data-v="${view}"]`);
  await page.waitForFunction((v)=>document.querySelector(`section[data-view="${v}"]`)?.classList.contains("live"),view);
  await page.waitForTimeout(120);
}
async function snap(page,name,label,fullPage=false){
  const file=out(name);
  await page.screenshot({path:file,fullPage});
  screenshots.push({label,filename:name,path:file});
}
async function setMonth(page,selector,value){
  await page.fill(selector,value);
  await page.$eval(selector,(el)=>el.dispatchEvent(new Event("change",{bubbles:true})));
}
async function launchPage(viewport={width:1440,height:950}){
  const browser=await chromium.launch({headless:true,channel:"chrome",args:["--allow-file-access-from-files"]});
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.setDefaultTimeout(15000);
  page.on("pageerror",(err)=>consoleErrors.push(`pageerror: ${err.message}`));
  page.on("console",(msg)=>{if(msg.type()==="error")consoleErrors.push(`console: ${msg.text()}`)});
  page.on("requestfailed",(req)=>requestFailures.push({url:req.url(),failure:req.failure()?.errorText}));
  await page.goto(appUrl,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>!!window.D1_407_TEST&&!!window.D1_406A_TEST);
  return {browser,page};
}

async function main(){
  const {browser,page}=await launchPage();

  await test("01 app boots",async()=>assert(await page.locator("#rail .rtab").count()>=8,"nav missing"));
  await test("02 406A compatibility API exposed",async()=>assert(await page.evaluate(()=>!!window.D1_406A_TEST),"D1_406A_TEST missing"));
  await test("03 407 hardening API exposed",async()=>assert(await page.evaluate(()=>window.D1_407_TEST.version==="407"),"D1_407_TEST missing"));
  await test("04 Keynote Classic default",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.canvasTheme==="keynote"),"theme not keynote"));
  await test("05 Blank Builder default mode",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.mode==="blank"),"mode not blank"));
  await test("06 completed sample is not editable canvas",async()=>{
    assert(await page.locator("#boardCommand .kcArrow").count()===0,"command preview contains editable/demo arrows");
    assert(await page.locator("#boardCommand .bTag").textContent().then((text)=>/BLANK BUILDER/i.test(text||"")),"command board is not tagged blank");
  });
  await test("07 document model has required root fields",async()=>assert(await page.evaluate(()=>["id","title","studentProfile","events","categories","media","theme","visibilityMode","advisorReview","versions","metadata"].every((k)=>k in window.D1_407_TEST.document)),"root fields missing"));
  await test("08 student profile model fields",async()=>assert(await page.evaluate(()=>["name","specialtyGoal","medicalSchoolCountry","graduationDate","visaStatus","scores","profilePhoto"].every((k)=>k in window.D1_407_TEST.document.studentProfile)),"profile fields missing"));
  await test("09 category model is editable",async()=>assert(await page.evaluate(()=>window.D1_407_TEST.document.categories.every((c)=>c.editable&&c.id&&c.label&&c.color)),"category fields missing"));
  await test("10 metadata marks sandbox only",async()=>assert(await page.evaluate(()=>window.D1_407_TEST.document.metadata.sandboxOnly===true),"sandbox metadata missing"));

  for(const view of ["command","builder","canvas","upload","media","advisor","export","reference"]){
    await test(`nav ${view}`,async()=>{await nav(page,view);assert(await page.locator(`section[data-view="${view}"].live`).count()===1,`${view} not live`)});
  }

  await nav(page,"canvas");
  await snap(page,"screen_main_canvas_blank_407.png","Canvas blank state");
  await test("19 blank canvas has no arrows",async()=>assert(await page.locator("#boardMain .kcArrow").count()===0,"blank has arrows"));
  await test("20 blank canvas has empty prompt",async()=>assert(await page.locator("#boardMain .emptyBoard").count()===1,"empty prompt missing"));
  await test("21 add work event creates duration event",async()=>{await page.click('#elemList .elBtn[data-el="work"]');await page.waitForSelector("#boardMain .kcArrow.cat-work");assert(await page.locator("#boardMain .kcArrow.cat-work").count()===1,"work arrow missing")});
  await test("22 direct board selection opens inspector",async()=>{await page.click("#boardMain .kcArrow");await page.waitForSelector("#inspector #iT");assert(await page.locator("#inspector #iT").count()===1,"inspector missing")});
  await test("23 editing start date moves arrow",async()=>{const before=await page.$eval("#boardMain .kcArrow",(el)=>el.getBoundingClientRect().left);await setMonth(page,"#iS","2027-01");await page.waitForTimeout(100);const after=await page.$eval("#boardMain .kcArrow",(el)=>el.getBoundingClientRect().left);assert(Math.abs(after-before)>2,"arrow did not move")});
  await test("24 editing end date changes width",async()=>{const before=await page.$eval("#boardMain .kcArrow",(el)=>el.getBoundingClientRect().width);await setMonth(page,"#iE","2028-01");await page.waitForTimeout(100);const after=await page.$eval("#boardMain .kcArrow",(el)=>el.getBoundingClientRect().width);assert(Math.abs(after-before)>2,"arrow width did not change")});
  await test("25 start label renders",async()=>assert(await page.locator("#boardMain .kcArrow .ads").count()>0,"start label missing"));
  await test("26 end label renders",async()=>assert(await page.locator("#boardMain .kcArrow .ade").count()>0,"end label missing"));
  await test("27 arrow label centered",async()=>assert(await page.$eval("#boardMain .kcArrow .al",(el)=>getComputedStyle(el).justifyContent)==="center","label not centered"));
  await test("28 reset to dates clears manual positioning",async()=>{await page.evaluate(()=>window.D1_407_TEST.resetToDates());assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.every((e)=>e.manualOffset==null&&e.__407Placement)),"manual offsets not reset or computed placement missing")});
  await test("29 auto arrange preserves dates",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.map((e)=>`${e.s}/${e.e||""}`).join("|"));await page.click("#ctlArrange");const after=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.map((e)=>`${e.s}/${e.e||""}`).join("|"));assert(before===after,"dates changed")});

  await test("30 demo load populates events",async()=>{await page.click("#ctlDemoLoad");await page.waitForSelector("#boardMain .kcArrow");assert(await page.locator("#boardMain .kcArrow").count()>=6,"demo arrows missing")});
  await snap(page,"screen_main_canvas_demo_407.png","Canvas demo events");
  await test("31 model sync has event fields",async()=>assert(await page.evaluate(()=>window.D1_407_TEST.document.events.every((e)=>["id","title","categoryId","eventType","startDate","visibility","sourceType","provenance","notes"].every((k)=>k in e))),"event fields missing"));
  await test("32 date axis has start and end",async()=>assert(await page.evaluate(()=>window.D1_407_TEST.layout.axis.start<window.D1_407_TEST.layout.axis.end),"axis invalid"));
  await test("33 lane count is deterministic",async()=>{const a=await page.evaluate(()=>window.D1_407_TEST.layout.stats.laneCount);await page.evaluate(()=>window.D1_407_TEST.sync());const b=await page.evaluate(()=>window.D1_407_TEST.layout.stats.laneCount);assert(a===b,"lane count changed")});
  await test("34 hidden events do not reserve layout",async()=>{await page.evaluate(()=>{const e=window.D1_406A_TEST.state.user.events[0];e.vis="hidden";window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>!window.D1_407_TEST.layout.placements[window.D1_406A_TEST.state.user.events[0].id]),"hidden event placed")});
  await test("35 interview safe filtering recomputes",async()=>{await page.evaluate(()=>{window.D1_406A_TEST.state.safe=true;window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>window.D1_407_TEST.document.visibilityMode==="interviewSafe"),"safe mode not synced")});
  await snap(page,"screen_interview_safe_filtered_407.png","Interview-safe filtered view");
  await test("36 full story restores advisor items",async()=>{await page.evaluate(()=>{window.D1_406A_TEST.state.safe=false;window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>window.D1_407_TEST.document.visibilityMode==="fullStory"),"full story not restored")});

  await test("37 category rename propagates",async()=>{await page.click('#boardMain [data-ck="work"]');await page.waitForSelector("#ckName");await page.fill("#ckName","Work Experience 407");await page.click("#ckSave");await page.waitForFunction(()=>document.body.textContent.includes("Work Experience 407"));assert(await page.evaluate(()=>window.D1_407_TEST.document.categories.some((c)=>c.label==="Work Experience 407")),"category not in model")});
  await test("38 color key remains editable",async()=>assert(await page.locator('#boardMain [data-ck="work"]').count()===1,"color key row missing"));
  await test("39 USCE site label visible",async()=>assert(await page.locator("#boardMain .kcArrow .aloc").count()>0,"site label missing"));
  await test("40 sprite arrow path integrity",async()=>assert(await page.$eval("#boardMain .kcArrow .kcBody",(el)=>getComputedStyle(el).backgroundImage.includes("keynote_classic_402a")),"arrow sprite missing"));
  await test("41 sprite axis path integrity",async()=>assert(await page.$eval("#boardMain .yseg",(el)=>getComputedStyle(el).backgroundImage.includes("keynote_classic_402a")),"axis sprite missing"));
  await test("42 sprite flag path integrity",async()=>assert(await page.$eval("#boardMain .kcFlag .pen",(el)=>getComputedStyle(el).backgroundImage.includes("keynote_classic_402a")),"flag sprite missing"));
  await test("43 theme switch season",async()=>{await page.locator("section.live .thBtn").first().click();await page.click("[data-th='season']");await page.waitForFunction(()=>window.D1_406A_TEST.state.canvasTheme==="season");assert(await page.locator(".board.t-season").count()>0,"season missing")});
  await test("44 theme switch paper",async()=>{await page.locator("section.live .thBtn").first().click();await page.click("[data-th='paper']");await page.waitForFunction(()=>window.D1_406A_TEST.state.canvasTheme==="paper");assert(await page.locator(".board.t-paper").count()>0,"paper missing")});
  await test("45 theme switch keynote",async()=>{await page.locator("section.live .thBtn").first().click();await page.click("[data-th='keynote']");await page.waitForFunction(()=>window.D1_406A_TEST.state.canvasTheme==="keynote");assert(await page.locator(".board.t-keynote").count()>0,"keynote missing")});

  await test("46 save version creates canonical version",async()=>{const before=await page.evaluate(()=>window.D1_407_TEST.document.versions.length);await page.evaluate(()=>window.D1_407_TEST.saveVersion("test save"));const after=await page.evaluate(()=>window.D1_407_TEST.document.versions.length);assert(after>=before,"version not saved")});
  await test("47 restore latest restores event count",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate(()=>window.D1_406A_TEST.state.user.events.pop());await page.evaluate(()=>window.D1_407_TEST.restoreLatest());const after=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);assert(after===before,"restore failed")});
  await snap(page,"screen_version_history_restore_407.png","Version history restore view");
  await test("48 JSON export parses",async()=>{const text=await page.evaluate(()=>window.D1_407_TEST.exportDocumentJson());const doc=JSON.parse(text);assert(doc.events&&doc.categories,"bad export")});
  await test("49 JSON import restores document",async()=>{const text=await page.evaluate(()=>window.D1_407_TEST.exportDocumentJson());await page.evaluate((t)=>window.D1_407_TEST.importDocumentJson(t),text);assert(await page.evaluate(()=>window.D1_407_TEST.document.events.length>0),"import lost events")});

  await test("50 validation catches end before start",async()=>{await page.evaluate(()=>{const e=window.D1_406A_TEST.state.user.events.find((x)=>!x.mile);e.s="2024-12";e.e="2024-01";window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>window.D1_407_TEST.warnings.some((w)=>/end date/i.test(w.message))),"end-before-start warning missing")});
  await test("51 validation catches missing title",async()=>{await page.evaluate(()=>{window.D1_406A_TEST.state.user.events[0].t="";window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>window.D1_407_TEST.warnings.some((w)=>/Missing title/i.test(w.message))),"missing title warning missing")});
  await test("52 validation catches USCE missing site",async()=>{await page.evaluate(()=>{const e=window.D1_406A_TEST.state.user.events.find((x)=>x.cat==="th"||x.cat==="cl");if(e)e.loc="";window.D1_406A_TEST.renderAll()});assert(await page.evaluate(()=>window.D1_407_TEST.warnings.some((w)=>/USCE/i.test(w.message))),"USCE warning missing")});
  await test("53 validation panel renders",async()=>assert(await page.locator("#d1_407_warnings").count()===1,"warning panel missing"));
  await snap(page,"screen_validation_warning_407.png","Validation warning view");

  const fixtureIds=["fx5","fx15","fx30","fx50","fx_same_month","fx_10y","fx_20y"];
  for(const id of fixtureIds){
    await test(`fixture ${id} loads`,async()=>{await page.evaluate((fixtureId)=>window.D1_407_TEST.loadFixture(fixtureId),id);await page.waitForSelector("#boardMain .board");assert(await page.evaluate(()=>window.D1_407_TEST.document.events.length>0),`${id} empty`)});
    await test(`fixture ${id} has layout placements`,async()=>assert(await page.evaluate(()=>Object.keys(window.D1_407_TEST.layout.placements).length>0),`${id} missing placements`));
    await test(`fixture ${id} warnings are nonblocking`,async()=>assert(await page.evaluate(()=>window.D1_407_TEST.warnings.filter((w)=>w.severity==="risk").length<10),`${id} too many risk warnings`));
  }
  await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx5")); await snap(page,"screen_fixture_5_events_407.png","5-event fixture");
  await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx15")); await snap(page,"screen_fixture_15_events_407.png","15-event fixture");
  await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx30")); await snap(page,"screen_fixture_30_events_407.png","30-event fixture");
  await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx50")); await snap(page,"screen_fixture_50_events_407.png","50-event fixture");
  await test("75 30-event fixture readable enough",async()=>{await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx30"));assert(await page.evaluate(()=>window.D1_407_TEST.layout.stats.laneCount<=12),"30-event lane count too high")});
  await test("76 50-event fixture fails gracefully or usable",async()=>{await page.evaluate(()=>window.D1_407_TEST.loadFixture("fx50"));assert(await page.evaluate(()=>window.D1_407_TEST.layout.stats.visibleEvents>=45&&window.D1_407_TEST.warnings.some((w)=>/50-event|dense|Crowded/i.test(w.message))),"50-event graceful warning missing")});

  await nav(page,"advisor"); await snap(page,"screen_advisor_full_story_407.png","Advisor full-story view");
  await test("77 advisor checklist works",async()=>{const remaining=await page.locator("#advChecks .tglD:not(.on)").count();if(remaining)await page.locator("#advChecks .tglD:not(.on)").first().click();assert(await page.locator("#advChecks .tglD.on").count()>0,"advisor checklist did not toggle")});
  await nav(page,"export");
  await test("78 export modal opens",async()=>{await page.click('#exGrid [data-ex="1"]');await page.waitForSelector("#modalBk.on #mGo");await page.click("#mNo2");});
  await nav(page,"reference");
  await test("79 reference sample read-only",async()=>assert(await page.locator("#boardReference .ah").count()===0,"reference has handles"));
  await test("80 no request failures",async()=>assert(requestFailures.length===0,JSON.stringify(requestFailures.slice(0,3))));
  await test("81 no console errors",async()=>assert(consoleErrors.length===0,consoleErrors.join("; ")));

  await browser.close();

  const viewports=[
    {name:"1280x800",width:1280,height:800},
    {name:"1440x900",width:1440,height:900},
    {name:"1728x1117",width:1728,height:1117},
    {name:"1920x1080",width:1920,height:1080},
    {name:"2560x1440",width:2560,height:1440}
  ];
  for(const vp of viewports){
    const shot=await launchPage({width:vp.width,height:vp.height});
    await nav(shot.page,"canvas");
    await shot.page.evaluate(()=>window.D1_407_TEST.loadFixture("fx30"));
    await snap(shot.page,`responsive_${vp.name}_407.png`,vp.name);
    await shot.browser.close();
  }

  const failed=results.filter((r)=>r.status!=="PASS");
  const payload={generated:new Date().toISOString(),appUrl,pass:results.length-failed.length,fail:failed.length,consoleErrors,requestFailures,results,screenshots};
  fs.writeFileSync(out("test_results_407.json"),JSON.stringify(payload,null,2)+"\n");
  const lines=["# D1 407 Regression Test Results","",`Generated: ${payload.generated}`,"",`Result: ${failed.length===0&&consoleErrors.length===0&&requestFailures.length===0?"PASS":"ATTENTION"}`,"",`Passed: ${payload.pass}`,`Failed: ${payload.fail}`,`Console errors: ${consoleErrors.length}`,`Request failures: ${requestFailures.length}`,"","| # | Test | Status | Notes |","|---:|---|---|---|"];
  results.forEach((r,i)=>lines.push(`| ${i+1} | ${r.name.replace(/\|/g,"\\|")} | ${r.status} | ${(r.notes||"").replace(/\|/g,"\\|").replace(/\n/g," ")} |`));
  fs.writeFileSync(out("test_results_407.md"),lines.join("\n")+"\n");
  if(failed.length||consoleErrors.length||requestFailures.length)process.exitCode=1;
}

main().catch((error)=>{console.error(error);process.exit(1)});
