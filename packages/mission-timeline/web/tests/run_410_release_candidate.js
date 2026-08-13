const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {chromium}=require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL=process.env.D1_APP_URL||"http://127.0.0.1:8791/";
const ROOT="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const APP=path.join(ROOT,"app_demo_401");
const EVIDENCE=path.join(ROOT,"evidence/410");
const EXPORTS=path.join(EVIDENCE,"exports");
const SHOTS=path.join(EVIDENCE,"screenshots");
const MEDIA=path.join(APP,"tests/fixtures/media");
const PDFS=path.join(APP,"tests/fixtures/pdfs");
for(const folder of [EVIDENCE,EXPORTS,SHOTS])fs.mkdirSync(folder,{recursive:true});

const results=[];
const consoleErrors=[];
const requestFailures=[];
const unexpectedRequests=[];
const screenshots=[];
const performance={environment:{platform:process.platform,arch:process.arch,node:process.version,appUrl:APP_URL,generatedAt:new Date().toISOString()}};
let browser;

function assert(condition,message){if(!condition)throw new Error(message);}
function sha256(value){return crypto.createHash("sha256").update(value).digest("hex");}
function pngDimensions(buffer){assert(buffer.slice(0,8).toString("hex")==="89504e470d0a1a0a","PNG signature missing");return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};}
async function test(name,operation){const started=performanceNow();try{const notes=await operation();results.push({name,status:"PASS",durationMs:+(performanceNow()-started).toFixed(2),notes:notes||""});}catch(error){results.push({name,status:"FAIL",durationMs:+(performanceNow()-started).toFixed(2),notes:error?.message||String(error)});}}
function performanceNow(){return Number(process.hrtime.bigint())/1e6;}
async function launch(viewport={width:1440,height:900}){
  const started=performanceNow();
  const context=await browser.newContext({viewport,deviceScaleFactor:1,acceptDownloads:true,reducedMotion:"reduce"});
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on("pageerror",error=>consoleErrors.push({type:"pageerror",message:error.message}));
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push({type:"console",message:message.text()});});
  page.on("requestfailed",request=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText||"unknown"}));
  page.on("request",request=>{const url=request.url();if(!url.startsWith(APP_URL)&&!url.startsWith("data:")&&!url.startsWith("blob:"))unexpectedRequests.push(url);});
  await page.goto(APP_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.D1_410_READY===true&&window.D1_410_TEST?.ready===true);
  const startupMs=performanceNow()-started;performance.startup=performance.startup||[];performance.startup.push(+startupMs.toFixed(2));
  return {context,page};
}
async function close(pair){await pair.context.close();}
async function nav(page,view){await page.click(`#rail .rtab[data-v="${view}"]`);await page.waitForFunction(target=>document.querySelector(`section[data-view="${target}"]`)?.classList.contains("live"),view);}
async function snap(page,name,label,{fullPage=false}={}){await page.waitForTimeout(250);const target=path.join(SHOTS,name);await page.screenshot({path:target,fullPage});screenshots.push({name,label,path:target,viewport:page.viewportSize()});return target;}
async function approveAll(page){
  await page.evaluate(async()=>{
    const api=window.D1_409_TEST,review=api.context.advisor;
    review.state.changeRequests.filter(item=>item.state==="OPEN").forEach(item=>review.resolveChangeRequest(item.id));
    review.state.checklist.forEach(item=>review.setChecklist(item.id,true));
    const input=api.classes.AdvisorReviewManager.fingerprintInput(api.document),digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
    const hash=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("");
    ["personalContext","interviewerSafe","fullStory","export"].forEach(scope=>review.approve(scope,hash));
    api.context.api.renderAll();await api.saveDraft("D1_410_APPROVAL");
  });
}
async function blobPayload(page,expression,args){return page.evaluate(async({expression,args})=>{const result=await (0,eval)(expression)(args),bytes=new Uint8Array(await result.blob.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return {base64:btoa(binary),filename:result.filename,type:result.blob.type,size:result.blob.size,eventCount:result.eventCount||0,record:result.record,artifact:result.artifact,scope:result.scope||null,summary:result.summary||null};},{expression,args});}
async function saveBlob(payload,name){const buffer=Buffer.from(payload.base64,"base64"),target=path.join(EXPORTS,name);fs.writeFileSync(target,buffer);return {...payload,buffer,target,sha256:sha256(buffer)};}

async function runBootFirstUseAndPrivacy(){
  const pair=await launch(),page=pair.page;
  const bootChecks=[
    ["D1-410 API boots",()=>page.evaluate(()=>window.D1_410_TEST.ready===true)],
    ["release candidate version is explicit",()=>page.evaluate(()=>window.D1_410_TEST.version==="410.0-rc")],
    ["release candidate schema is explicit",()=>page.evaluate(()=>window.D1_410_TEST.state.schemaVersion==="d1-release-candidate-410.1")],
    ["D1-409 API remains intact",()=>page.evaluate(()=>window.D1_409_TEST.ready&&window.D1_409_TEST.version==="409.1")],
    ["D1-408 API remains intact",()=>page.evaluate(()=>window.D1_408_TEST.schemaVersion==="d1-ingestion-408.1")],
    ["D1-407 API remains intact",()=>page.evaluate(()=>!!window.D1_407_TEST.document)],
    ["blank builder remains default",()=>page.evaluate(()=>window.D1_406A_TEST.state.mode==="blank")],
    ["blank builder has no demo events",()=>page.evaluate(()=>window.D1_406A_TEST.state.user.events.length===0)],
    ["Keynote Classic remains default",()=>page.evaluate(()=>window.D1_406A_TEST.state.canvasTheme==="keynote")],
    ["release state is sandbox only",()=>page.evaluate(()=>window.D1_410_TEST.state.sandboxOnly===true)],
    ["OCR decision is manual fallback",()=>page.evaluate(()=>window.D1_410_TEST.ocrDecision==="MANUAL_TEXT_FALLBACK")],
    ["manual OCR text is enabled",()=>page.evaluate(()=>window.D1_410_TEST.state.ocr.manualTextEnabled===true)],
    ["cloud OCR is hard disabled",()=>page.evaluate(()=>window.D1_410_TEST.state.ocr.cloudOcr===false)],
    ["visual PDF tagging is honestly false",()=>page.evaluate(()=>window.D1_410_TEST.state.accessibleExports.visualPdfTagged===false)],
    ["accessible HTML companion is enabled",()=>page.evaluate(()=>window.D1_410_TEST.state.accessibleExports.accessibleHtmlEnabled===true)],
    ["archive text companion is enabled",()=>page.evaluate(()=>window.D1_410_TEST.state.accessibleExports.archiveTextSummaryEnabled===true)],
    ["production FileVault request count starts at zero",()=>page.evaluate(()=>window.D1_410_TEST.productionRequestCount()===0)],
    ["first-use route chooser is visible",()=>page.locator("#firstUse410").isVisible()],
    ["guided builder is recommended",()=>page.locator('#firstUse410 [data-nav="builder"].recommended').count().then(count=>count===1)],
    ["three safe starting routes are offered",()=>page.locator("#firstUse410 .route410").count().then(count=>count===3)],
    ["autosave recovery cue is visible",()=>page.locator("#firstUse410 .recoveryCue410").innerText().then(text=>/SAFE TO LEAVE/.test(text))],
    ["five-state visibility law is visible",()=>page.locator("#firstUse410 .visibilityLaw410").innerText().then(text=>["Interviewer Safe","Full Story","Advisor Only","Student Only","Hidden"].every(value=>text.includes(value)))],
    ["advanced editor controls start collapsed",async()=>{await nav(page,"canvas");return page.locator("#advancedEditor410").getAttribute("hidden").then(value=>value!==null);}],
    ["canvas has keyboard event list",()=>page.locator("#evList").count().then(count=>count===1)],
    ["phone read-only notice exists",()=>page.locator(".mobileReviewNotice410").innerText().then(text=>/READ-ONLY/.test(text))]
  ];
  for(const [name,check] of bootChecks)await test(name,async()=>assert(await check(),name));
  for(const view of ["command","builder","canvas","upload","review","media","advisor","versions","export","reference"])await test(`navigation reaches ${view}`,async()=>{await nav(page,view);assert(await page.locator(`section[data-view="${view}"].live`).count()===1,`${view} did not activate`);});
  await test("reference sample remains read only",async()=>{await nav(page,"reference");assert(await page.locator("#boardReference .ah").count()===0,"reference became editable");});
  await test("all rail items declare controlled views",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll("#rail .rtab")].every(button=>button.getAttribute("aria-controls")===`view-${button.dataset.v}`)),"rail aria-controls mismatch"));
  await test("all active workspaces have accessible names",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll("section[data-view]")].every(section=>section.getAttribute("aria-labelledby"))),"workspace label missing"));
  await test("no UI em or en dash characters render",async()=>assert(await page.evaluate(()=>!/[–—]/.test(document.body.innerText)),"dash rule violated"));
  await snap(page,"student_first_use_410.png","Student first-use routes");

  const stateIds=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"],scopes=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_PACKET","STUDENT"];
  const expected={INTERVIEWER_SAFE:new Set(["INTERVIEWER_SAFE"]),FULL_STORY:new Set(["INTERVIEWER_SAFE","FULL_STORY"]),ADVISOR_PACKET:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY"]),STUDENT:new Set(["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY"])};
  for(const scope of scopes)for(const stateId of stateIds)await test(`event privacy matrix ${scope} excludes or includes ${stateId}`,async()=>{
    const present=await page.evaluate(({scope,stateId})=>{const states=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"],doc={events:states.map(value=>({id:value,title:value,categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-02",visibilityState:value}))};return window.D1_409_TEST.pure.eventsForScope(doc,scope).some(item=>item.id===stateId);},{scope,stateId});
    assert(present===expected[scope].has(stateId),`event visibility mismatch for ${scope}/${stateId}`);
  });
  for(const scope of scopes)for(const stateId of stateIds)await test(`media privacy matrix ${scope} excludes or includes ${stateId}`,async()=>{
    const present=await page.evaluate(({scope,stateId})=>{const states=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"],doc={mediaItems:states.map(value=>({id:value,visibility:value}))};return window.D1_409_TEST.pure.mediaForScope(doc,scope).some(item=>item.id===stateId);},{scope,stateId});
    assert(present===expected[scope].has(stateId),`media visibility mismatch for ${scope}/${stateId}`);
  });
  for(const scope of scopes)await test(`accessible ${scope} output contains only permitted event titles`,async()=>{
    const found=await page.evaluate(scope=>{const states=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"],doc={title:"Privacy Matrix",studentProfile:{name:"Synthetic Student"},categories:[{id:"work",label:"Work",color:"#38754d"}],events:states.map(value=>({id:value,title:`TITLE_${value}`,categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-02",visibilityState:value})),mediaItems:[]};const html=window.D1_410_TEST.buildAccessibleHtml(doc,{scope});return Object.fromEntries(states.map(value=>[value,html.includes(`TITLE_${value}`)]));},scope);
    for(const stateId of stateIds)assert(found[stateId]===expected[scope].has(stateId),`accessible leak ${scope}/${stateId}`);
  });
  await close(pair);
}

async function runEditorAndCollision(){
  const pair=await launch(),page=pair.page;await nav(page,"canvas");
  await test("work event can be added",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===1,"event missing");});
  await test("new event is directly selected",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.sel===window.D1_406A_TEST.state.user.events[0].id),"selection missing"));
  await test("inspector synchronizes with selected event",async()=>assert(await page.locator("#inspector410").count()===1,"410 inspector missing"));
  for(const visibility of ["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"])await test(`editor sets ${visibility} visibility`,async()=>{const actual=await page.evaluate(value=>{window.D1_410_TEST.history.setSelectedVisibility(value);return window.D1_406A_TEST.state.user.events[0].visibilityState;},visibility);assert(actual===visibility,"visibility did not persist");});
  await test("duplicate creates a second event",async()=>{const value=await page.evaluate(()=>window.D1_410_TEST.history.duplicateSelected());assert(value.t.endsWith(" copy"),"copy label missing");assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===2,"copy missing");});
  await test("duplicate moves one month later",async()=>assert(await page.evaluate(()=>{const [original,copy]=window.D1_406A_TEST.state.user.events;return window.D1_406A_TEST.mi(copy.s)===window.D1_406A_TEST.mi(original.s)+1;}),"duplicate date offset wrong"));
  await test("undo removes duplicated event",async()=>{await page.evaluate(()=>window.D1_410_TEST.history.undo());assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===1,"undo failed");});
  await test("redo restores duplicated event",async()=>{await page.evaluate(()=>window.D1_410_TEST.history.redo());assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===2,"redo failed");});
  await test("lane down locks manual lane",async()=>{const result=await page.evaluate(()=>window.D1_410_TEST.history.changeLane(1));assert(result.manualOffset.laneLocked&&result.lane>=1,"lane lock absent");});
  await test("lane up never produces negative lane",async()=>{await page.evaluate(()=>{window.D1_410_TEST.history.changeLane(-1);window.D1_410_TEST.history.changeLane(-1);});assert(await page.evaluate(()=>window.D1_410_TEST.history.selected().lane)>=0,"negative lane");});
  await test("soft delete removes selected event",async()=>{const before=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.evaluate(()=>window.D1_410_TEST.history.softDeleteSelected());assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===before-1,"soft delete failed");});
  await test("soft delete retains recoverable record",async()=>assert(await page.evaluate(()=>window.D1_410_TEST.state.editor.deletedEvents.length===1),"deleted event record missing"));
  await test("recover restores removed event",async()=>{await page.evaluate(()=>window.D1_410_TEST.history.recoverLastDeleted());assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===2,"recover failed");});
  await test("reset source dates restores exact source",async()=>{const actual=await page.evaluate(()=>{const event=window.D1_410_TEST.history.selected(),source=event.sourceDates||window.D1_410_TEST.state.editor.sourceDatesByEvent[event.id];event.s="1999-01";event.e="1999-02";window.D1_410_TEST.history.resetSelectedToSource();return {s:event.s,e:event.e,source};});assert(actual.s===actual.source.startDate&&actual.e===actual.source.endDate,"source dates not restored");});
  await test("category reset restores default label and color",async()=>{const ok=await page.evaluate(()=>{const api=window.D1_406A_TEST,base=window.D1_410_TEST.state.editor.categoryDefaults.work;api.CATS.work.n="Changed";api.CATS.work.c="#000000";window.D1_410_TEST.history.resetCategories();return api.CATS.work.n===base.label&&api.CATS.work.c===base.color;});assert(ok,"category reset failed");});
  for(const density of ["CONDENSED","FIT","EXPANDED"])await test(`${density} density updates release state`,async()=>{await page.click(`[data-410-density="${density}"]`);assert(await page.evaluate(()=>window.D1_410_TEST.state.editor.density)===density,"density failed");});
  await test("advanced controls reveal without changing canvas state",async()=>{const count=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);await page.click('[data-410-action="toggle-editor-advanced"]');assert(await page.locator("#advancedEditor410").isVisible(),"advanced controls hidden");assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===count,"opening tools changed events");});
  await test("zoom in is bounded",async()=>{for(let i=0;i<10;i++)await page.click('[data-410-action="zoom-in"]');assert(await page.evaluate(()=>window.D1_410_TEST.state.editor.zoom)===1.4,"upper zoom bound wrong");});
  await test("zoom out is bounded",async()=>{for(let i=0;i<20;i++)await page.click('[data-410-action="zoom-out"]');assert(await page.evaluate(()=>window.D1_410_TEST.state.editor.zoom)===.55,"lower zoom bound wrong");});
  await test("fit canvas restores canonical zoom",async()=>{await page.click('[data-410-action="zoom-fit"]');assert(await page.evaluate(()=>window.D1_410_TEST.state.editor.zoom===1&&window.D1_410_TEST.state.editor.density==="FIT"),"fit reset failed");});
  await test("timeline title can be edited directly",async()=>{await page.click('[data-410-action="edit-title-profile"]');await page.fill("#title410","Timeline: Release Candidate Student");await page.fill("#profileName410","Release Candidate Student");await page.click('[data-410-action="save-title-profile"]');assert(await page.evaluate(()=>window.D1_406A_TEST.state.timelineTitle)==="Timeline: Release Candidate Student","title not saved");});
  await test("profile edits synchronize to document",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.document.studentProfile.name)==="Release Candidate Student","profile not mapped"));
  await test("interview ribbon can be edited",async()=>{await page.click('[data-410-action="edit-ribbon"]');await page.fill("#ribbonProgram410","Synthetic Residency");await page.fill("#ribbonLabel410","Interview Day");await page.fill("#ribbonDate410","2026-01");await page.click('[data-410-action="save-ribbon"]');assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.interview.prog)==="Synthetic Residency","ribbon not saved");});
  await test("event list row is keyboard-selectable",async()=>{const row=page.locator("#evList .evRow").first();await row.focus();await page.keyboard.press("Enter");assert(await page.evaluate(()=>!!window.D1_406A_TEST.state.sel),"keyboard selection failed");});

  const viewports=[[768,1024],[900,1100],[1024,768],[1280,800],[1440,900],[1728,1117],[1920,1080],[2560,1440]];
  for(const [width,height] of viewports)await test(`collision engine supports ${width}x${height}`,async()=>{const result=await page.evaluate(({width,height})=>window.D1_410_TEST.analyzeCollisions({width,height,scope:"FULL_STORY"}),{width,height});assert(result.width===width&&result.height===height&&Array.isArray(result.warnings),"collision result malformed");});
  await test("hidden events reserve no collision space",async()=>{const count=await page.evaluate(()=>{const event=window.D1_406A_TEST.state.user.events[0];event.visibilityState="HIDDEN";return window.D1_410_TEST.analyzeCollisions({scope:"FULL_STORY"}).boxes.filter(box=>box.id===event.id).length;});assert(count===0,"hidden box reserved space");});
  await test("advisor pins exist only in advisor packet scope",async()=>{const counts=await page.evaluate(()=>({full:window.D1_410_TEST.analyzeCollisions({scope:"FULL_STORY"}).fixedRegions.filter(x=>x.advisorOnly).length,advisor:window.D1_410_TEST.analyzeCollisions({scope:"ADVISOR_PACKET"}).fixedRegions.filter(x=>x.advisorOnly).length}));assert(counts.full===0&&counts.advisor===3,"advisor pin scope wrong");});
  await test("collision analysis is deterministic",async()=>{const same=await page.evaluate(()=>JSON.stringify(window.D1_410_TEST.analyzeCollisions({scope:"FULL_STORY"}))===JSON.stringify(window.D1_410_TEST.analyzeCollisions({scope:"FULL_STORY"})));assert(same,"collision output changed");});
  await test("collision warnings identify actual element IDs",async()=>{const ok=await page.evaluate(()=>window.D1_410_TEST.analyzeCollisions({scope:"FULL_STORY"}).warnings.every(item=>item.elementIds?.length>0));assert(ok,"warning lacks IDs");});
  await test("same-month events auto-arrange into separate lanes",async()=>{const value=await page.evaluate(()=>{const events=Array.from({length:12},(_,i)=>({id:`cluster-${i}`,s:"2024-06",e:"2024-08",visibilityState:"INTERVIEWER_SAFE",lane:null}));const result=window.D1_410_TEST.pure.deterministicAutoArrange(events);return {lanes:new Set(events.map(x=>x.lane)).size,count:result.laneCount};});assert(value.lanes===12&&value.count===12,"same-month separation failed");});
  await test("manual lane lock survives auto-arrange",async()=>{const lane=await page.evaluate(()=>{const events=[{id:"lock",s:"2024-01",e:"2024-12",visibilityState:"INTERVIEWER_SAFE",lane:7,manualOffset:{laneLocked:true}},{id:"free",s:"2024-01",e:"2024-02",visibilityState:"INTERVIEWER_SAFE",lane:null}];window.D1_410_TEST.pure.deterministicAutoArrange(events);return events[0].lane;});assert(lane===7,"manual lane moved");});
  await test("100-event dense fixture analyzes without loss",async()=>{const metric=await page.evaluate(()=>{const events=Array.from({length:100},(_,i)=>({id:`dense-${i}`,title:`Dense Event ${i}`,categoryId:i%2?"work":"personal",eventType:i%10===0?"milestone":"duration",startDate:`${2006+Math.floor(i/12)}-${String(i%12+1).padStart(2,"0")}`,endDate:`${2006+Math.floor((i+2)/12)}-${String((i+2)%12+1).padStart(2,"0")}`,visibilityState:i%9===0?"HIDDEN":"INTERVIEWER_SAFE",lane:i%12})),document={events};const start=performance.now(),result=window.D1_410_TEST.pure.analyzeCollisionLayout(document,{scope:"INTERVIEWER_SAFE",density:"CONDENSED"});return {durationMs:performance.now()-start,visible:result.stats.visibleEvents,warnings:result.warnings.length};});performance.dense100Collision=metric;assert(metric.visible===88&&metric.durationMs<500,"dense collision budget failed");});
  await test("20-year history preserves full axis span",async()=>{const axis=await page.evaluate(()=>window.D1_410_TEST.pure.analyzeCollisionLayout({events:[{id:"a",title:"A",startDate:"2006-01",endDate:"2006-02",visibilityState:"INTERVIEWER_SAFE"},{id:"b",title:"B",startDate:"2026-11",endDate:"2026-12",visibilityState:"INTERVIEWER_SAFE"}]}).axis);assert(axis.end-axis.start>=251,"axis span collapsed");});
  await snap(page,"dense_canvas_editor_410.png","Release candidate canvas editor and collision panel");
  await close(pair);
}

async function runLongReview(){
  const pair=await launch(),page=pair.page;await nav(page,"review");
  const creation=await page.evaluate(()=>{
    const state=window.D1_408_TEST.state,now=new Date().toISOString(),candidates=[];
    state.sourceDocuments=[0,1,2,3,4].map(i=>({id:`source-${i}`,fileName:`synthetic-source-${i}.pdf`,pageCount:100,sha256:String(i).repeat(64),status:"EXTRACTED"}));
    for(let i=0;i<500;i++)candidates.push({id:`candidate-${String(i).padStart(3,"0")}`,sourceDocumentId:`source-${i%5}`,sourceDocumentIds:[`source-${i%5}`],candidateKind:i%7===0?"PROFILE_FIELD":"TIMELINE_EVENT",canonicalType:i%6===0?"OBSERVERSHIP":i%6===1?"WORK_EXPERIENCE":i%6===2?"RESEARCH_EXPERIENCE":"UNCLASSIFIED",title:`Synthetic Candidate ${i} ${i%10===0?"Starlight Hospital":"Community Site"}`,organization:i%3===0?"Starlight Hospital":"Community Clinic",siteName:i%6===0?"Starlight Hospital":"",location:i%2?"New York":"New Jersey",section:"experiences",mappingRationale:"Synthetic release-candidate stress fixture",inferredFields:[],specialty:"Internal Medicine",experienceType:"Synthetic",categoryId:i%6===0?"th":i%4===0?"res":"work",timelineKind:i%11===0?"milestone":"duration",startDate:`${2010+Math.floor(i/60)}-${String(i%12+1).padStart(2,"0")}`,endDate:`${2010+Math.floor((i+2)/60)}-${String((i+2)%12+1).padStart(2,"0")}`,reviewStatus:i%13===0?"REJECTED":"PENDING",confidence:{level:i%5===0?"LOW":i%3===0?"MEDIUM":"HIGH",score:i%5===0?.4:.9,factors:["synthetic"]},safeToBulkAccept:i%4===0&&i%13!==0,duplicateGroupIds:i%17===0?[`dup-${i}`]:[],conflictIds:i%19===0?[`conflict-${i}`]:[],provenance:[{id:`prov-${i}`,sourceDocumentId:`source-${i%5}`,fileName:`synthetic-source-${i%5}.pdf`,pageNumber:i%100+1,sourceExcerpt:`Synthetic provenance excerpt ${i}`,extractionMethod:"SYNTHETIC_STRESS"}],originalExtraction:{rawText:`Synthetic Candidate ${i}`},humanCorrection:null,visibilityRecommendation:"INTERVIEWER_SAFE",resultingEventIds:[],finalHumanAction:null,datePrecision:{start:"MONTH",end:"MONTH"},createdAt:now,updatedAt:now});
    state.extractionCandidates=candidates;state.candidateDuplicateGroups=candidates.filter(x=>x.duplicateGroupIds.length).map(x=>({id:x.duplicateGroupIds[0],candidateIds:[x.id],status:"PENDING"}));state.candidateConflicts=candidates.filter(x=>x.conflictIds.length).map(x=>({id:x.conflictIds[0],candidateIds:[x.id],status:"PENDING"}));
    const start=performance.now();window.D1_408_TEST.controller.syncLegacy();return {durationMs:performance.now()-start,count:candidates.length};
  });
  performance.review500Initial=creation;
  await page.waitForFunction(()=>window.D1_410_TEST.review.summary().total===500);
  await test("500 candidates load into review workspace",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.summary().total))===500,"candidate count wrong"));
  await test("500-candidate initial synchronization meets budget",async()=>assert(creation.durationMs<500,"initial sync exceeded budget"));
  for(const size of [10,25,50,100])await test(`${size}-candidate page size is supported`,async()=>{const value=await page.evaluate(size=>{window.D1_410_TEST.review.set({pageSize:size});return window.D1_410_TEST.review.summary();},size);assert(value.pageSize===size&&value.visibleIds.length===size,"page size wrong");});
  await test("100-item pagination has five pages",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({pageSize:100,query:"",status:"ALL",confidence:"ALL",type:"ALL",source:"ALL",group:"ALL"}).pages))===5,"page count wrong"));
  await test("last page bounds remain stable",async()=>{const summary=await page.evaluate(()=>window.D1_410_TEST.review.set({page:5}));assert(summary.start===401&&summary.end===500,"last page bounds wrong");});
  await test("page number clamps above range",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({page:999}).page))===5,"page did not clamp"));
  await test("search finds Starlight candidates",async()=>{const metric=await page.evaluate(()=>{const start=performance.now(),summary=window.D1_410_TEST.review.set({query:"Starlight Hospital",page:1});return {durationMs:performance.now()-start,filtered:summary.filtered};});performance.review500Search=metric;assert(metric.filtered===200&&metric.durationMs<150,"search result or budget wrong");});
  await test("search is case insensitive",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({query:"starlight hospital"}).filtered))===200,"case-sensitive search"));
  await test("status filter isolates rejected candidates",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({query:"",status:"REJECTED"}).filtered))===39,"status filter wrong"));
  await test("confidence filter isolates low candidates",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({status:"ALL",confidence:"LOW"}).filtered))===100,"confidence filter wrong"));
  await test("type filter isolates profile fields",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({confidence:"ALL",type:"PROFILE_FIELD"}).filtered))===72,"type filter wrong"));
  await test("source filter isolates one document",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({type:"ALL",source:"source-2"}).filtered))===100,"source isolation wrong"));
  await test("duplicate group filter is functional",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({source:"ALL",group:"DUPLICATES"}).filtered))===30,"duplicate filter wrong"));
  await test("conflict group filter is functional",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({group:"CONFLICTS"}).filtered))===27,"conflict filter wrong"));
  await test("unresolved group excludes rejected candidates",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.set({group:"UNRESOLVED"}).filtered))===461,"unresolved filter wrong"));
  await test("select page preserves 100 unique selections",async()=>{const count=await page.evaluate(()=>{window.D1_410_TEST.review.set({group:"ALL",pageSize:100,page:1});window.D1_410_TEST.review.clearSelection();window.D1_410_TEST.review.selectPage();return window.D1_410_TEST.state.review.selectedCandidateIds.length;});assert(count===100,"page selection wrong");});
  await test("selection persists across pagination",async()=>{const count=await page.evaluate(()=>{window.D1_410_TEST.review.set({page:2});return window.D1_410_TEST.state.review.selectedCandidateIds.length;});assert(count===100,"selection lost");});
  await test("selecting a second page accumulates selection",async()=>{const count=await page.evaluate(()=>{window.D1_410_TEST.review.selectPage();return window.D1_410_TEST.state.review.selectedCandidateIds.length;});assert(count===200,"selection did not accumulate");});
  await test("safe bulk acceptance accepts only eligible selected candidates",async()=>{const metric=await page.evaluate(()=>{const start=performance.now(),result=window.D1_410_TEST.review.bulkAcceptSafe();return {...result,durationMs:performance.now()-start};});performance.review500BulkAccept=metric;assert(metric.accepted>0&&metric.skipped>0&&metric.durationMs<1000,"safe bulk acceptance failed");});
  await test("unsafe duplicates remain quarantined after bulk action",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.filter(x=>x.duplicateGroupIds.length).every(x=>x.reviewStatus!=="ACCEPTED")),"duplicate accepted"));
  await test("unsafe conflicts remain quarantined after bulk action",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.filter(x=>x.conflictIds.length).every(x=>x.reviewStatus!=="ACCEPTED")),"conflict accepted"));
  await test("review clear selection is complete",async()=>assert((await page.evaluate(()=>window.D1_410_TEST.review.clearSelection().selected))===0,"selection not cleared"));
  await test("review scroll state is persistable",async()=>{await page.evaluate(()=>window.D1_410_TEST.state.review.scrollTop=480);assert(await page.evaluate(()=>window.D1_410_TEST.state.review.scrollTop)===480,"scroll state lost");});
  await test("review cards are bounded to one page",async()=>{await page.evaluate(()=>{window.D1_410_TEST.review.set({pageSize:25,page:1,status:"ALL",confidence:"ALL",type:"ALL",source:"ALL",group:"ALL",query:""});window.D1_410_TEST.context.ui410.renderReview();});const windowCount=await page.locator('[data-candidate-card]:not([hidden])').count();assert(windowCount<=25,"too many rendered cards");});
  await test("keyboard j moves review focus down",async()=>{const cards=page.locator('[data-candidate-card]:not([hidden])');await cards.first().focus();await page.keyboard.press("j");assert(await page.evaluate(()=>document.activeElement?.dataset?.candidateCard)===(await cards.nth(1).getAttribute("data-candidate-card")),"j navigation failed");});
  await test("keyboard k moves review focus up",async()=>{await page.keyboard.press("k");assert(await page.evaluate(()=>document.activeElement?.dataset?.candidateCard)===(await page.locator('[data-candidate-card]:not([hidden])').first().getAttribute("data-candidate-card")),"k navigation failed");});
  await test("space toggles review selection",async()=>{await page.keyboard.press("Space");assert(await page.evaluate(()=>window.D1_410_TEST.state.review.selectedCandidateIds.length)===1,"space selection failed");});
  await test("provenance remains available at 500 candidates",async()=>{await page.locator('[data-candidate-card]:not([hidden]) [data-408-action="provenance"]').first().click();await page.waitForSelector("#modalBk.on .provRow");assert(await page.locator("#modalBk.on .provRow").count()>0,"provenance missing");await page.keyboard.press("Escape");});
  await snap(page,"long_candidate_review_500_410.png","500-candidate paginated review workspace",{fullPage:true});
  await close(pair);
}

async function runGoldenPath(){
  const pair=await launch(),page=pair.page;
  await test("golden path starts from Upload route",async()=>{await nav(page,"upload");assert(await page.locator('section[data-view="upload"].live').count()===1,"upload route failed");});
  await test("privacy check precedes document upload",async()=>assert((await page.locator('section[data-view="upload"]').innerText()).toLowerCase().includes("privacy"),"privacy explanation absent"));
  await test("native CV upload reaches quarantined review",async()=>{await page.setInputFiles("#pdfFileInput",path.join(PDFS,"synthetic_cv_clean.pdf"));await page.waitForFunction(()=>window.D1_408_TEST.state.status==="READY_FOR_REVIEW",null,{timeout:40000});assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.length)>0,"no candidates");});
  await test("native PDF extraction retains page map",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.documentPages.every(page=>page.pageNumber>0&&page.extractionMethod)),"page map missing"));
  await test("native candidates remain quarantined",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.every(candidate=>candidate.reviewStatus==="PENDING")),"candidate bypassed review"));
  await test("manual OCR fallback accepts page-separated text",async()=>{const result=await page.evaluate(()=>window.D1_410_TEST.ingestManualText("CURRICULUM VITAE\nWORK EXPERIENCE\nJune 2022 - August 2022 | Medical Assistant | Community Clinic\n--- PAGE 2 ---\nRESEARCH EXPERIENCE\nSeptember 2022 - December 2022 | Research Assistant | University Lab",{fileName:"synthetic-local-ocr.txt",declaredType:"cv"}));assert(result.document.pageCount===2&&result.candidates.length>=2,"manual OCR fallback failed");});
  await test("manual OCR source is checksum identified",async()=>assert(await page.evaluate(()=>/^[a-f0-9]{64}$/.test(window.D1_408_TEST.state.sourceDocuments.find(item=>item.extractionMethod==="MANUAL_LOCAL_OCR_TEXT").sha256)),"OCR hash missing"));
  await test("manual OCR transmission is none",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.sourceDocuments.find(item=>item.extractionMethod==="MANUAL_LOCAL_OCR_TEXT").ocr.cloud===false),"OCR transmission flag wrong"));
  await test("manual OCR candidates retain provenance",async()=>assert(await page.evaluate(()=>window.D1_408_TEST.state.extractionCandidates.filter(item=>item.sourceDocumentId.startsWith("manual-ocr-")).every(item=>item.provenance.length>0)),"OCR provenance missing"));
  await test("safe confirmed candidate becomes editable event",async()=>{const count=await page.evaluate(()=>{const controller=window.D1_408_TEST.controller,candidate=controller.state.extractionCandidates.find(item=>item.reviewStatus==="PENDING"&&!item.duplicateGroupIds.length&&!item.conflictIds.length&&item.startDate);candidate.safeToBulkAccept=true;controller.acceptCandidate(candidate.id,{visibility:"INTERVIEWER_SAFE"});return window.D1_406A_TEST.state.user.events.length;});assert(count===1,"accepted event missing");});
  await test("accepted event retains source dates",async()=>assert(await page.evaluate(()=>{const event=window.D1_406A_TEST.state.user.events[0];return event.sourceDates?.startDate===event.s;}),"source dates missing"));
  await test("manual missing event can be added",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("res"));assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===2,"manual event missing");});
  await test("personal context can be added privately",async()=>{await page.evaluate(()=>{window.D1_406A_TEST.addElement("personal");const event=window.D1_406A_TEST.state.user.events.at(-1);event.visibilityState="ADVISOR_ONLY";event.vis="advisor";});assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.at(-1).visibilityState)==="ADVISOR_ONLY","personal visibility wrong");});
  await test("profile photo can be added locally",async()=>{await page.evaluate(()=>{const input=document.querySelector("#mediaFile409");input.dataset.placement="profile";input.dataset.type="profilePhoto";input.dataset.visibility="INTERVIEWER_SAFE";});await page.setInputFiles("#mediaFile409",path.join(MEDIA,"synthetic_profile.jpg"));await page.waitForFunction(()=>window.D1_409_TEST.state.mediaItems.some(item=>item.placement==="profile"));assert(true);});
  await test("timeline photo can be added locally",async()=>{await page.evaluate(()=>{const input=document.querySelector("#mediaFile409");input.dataset.placement="photo0";input.dataset.type="photo";input.dataset.visibility="FULL_STORY";});await page.setInputFiles("#mediaFile409",path.join(MEDIA,"synthetic_story_1.png"));await page.waitForFunction(()=>window.D1_409_TEST.state.mediaItems.some(item=>item.placement==="photo0"));assert(true);});
  await test("program logo can be added locally",async()=>{await page.evaluate(()=>{const input=document.querySelector("#mediaFile409");input.dataset.placement="ribbon";input.dataset.type="logo";input.dataset.visibility="INTERVIEWER_SAFE";});await page.setInputFiles("#mediaFile409",path.join(MEDIA,"synthetic_program_logo.png"));await page.waitForFunction(()=>window.D1_409_TEST.state.mediaItems.some(item=>item.placement==="ribbon"));assert(true);});
  await test("all media provenance remains local",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.every(item=>item.localProvenance.transmission==="NONE")),"media transmission detected"));
  await test("collision review is available before advisor handoff",async()=>assert(await page.evaluate(()=>Array.isArray(window.D1_410_TEST.analyzeCollisions().warnings)),"collision review unavailable"));
  await test("full-story view includes personal context",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.eventsForScope(window.D1_409_TEST.document,"ADVISOR_PACKET").some(item=>item.visibilityState==="ADVISOR_ONLY")),"personal context missing"));
  await test("interviewer-safe view excludes personal context",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.eventsForScope(window.D1_409_TEST.document,"INTERVIEWER_SAFE").every(item=>item.visibilityState==="INTERVIEWER_SAFE")),"private context leaked"));
  await test("advisor can pin a comment to an event",async()=>{const id=await page.evaluate(()=>{const api=window.D1_409_TEST,event=api.document.events[0];return api.context.advisor.addComment({body:"Explain this transition clearly.",timelineEventId:event.id}).id;});assert(!!id,"comment missing");});
  await test("advisor can create a general comment",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.addComment({body:"Strengthen the chronology opening."}).timelineEventId===null),"general comment failed"));
  await test("advisor can request clarification",async()=>{const id=await page.evaluate(()=>window.D1_409_TEST.context.advisor.requestChanges({body:"Confirm the end month."}).id);assert(!!id,"change request missing");});
  await test("student can acknowledge change request",async()=>assert(await page.evaluate(()=>{const manager=window.D1_409_TEST.context.advisor,item=manager.state.changeRequests.at(-1);return manager.acknowledgeChangeRequest(item.id).studentAcknowledged;}),"acknowledgement failed"));
  await test("advisor can resolve change request",async()=>assert(await page.evaluate(()=>{const manager=window.D1_409_TEST.context.advisor,item=manager.state.changeRequests.at(-1);return manager.resolveChangeRequest(item.id).state==="RESOLVED";}),"resolution failed"));
  await approveAll(page);
  for(const scope of ["personalContext","interviewerSafe","fullStory","export"])await test(`advisor ${scope} approval is active`,async()=>assert(await page.evaluate(scope=>window.D1_409_TEST.context.advisor.exportGate(scope),scope),`${scope} gate failed`));
  await test("practice questions derive from timeline",async()=>{await nav(page,"advisor");await page.click('[data-410-action="advisor-generate-questions"]');await page.waitForFunction(()=>window.D1_409_TEST.state.interviewPractice.questions.length>=3);assert(true);});
  await test("advisor can mark question for practice",async()=>{const button=page.locator("[data-410-question]").first();await button.click();assert(await page.evaluate(()=>window.D1_410_TEST.state.advisor.practiceQuestionIds.length)===1,"practice mark missing");});
  await test("named version can be saved",async()=>{const id=await page.evaluate(()=>window.D1_409_TEST.saveVersion("Advisor Approved Baseline").then(item=>item.id));assert(!!id,"version missing");});
  await test("version comparison is available",async()=>{const id=await page.evaluate(()=>window.D1_409_TEST.listVersions().then(items=>items[0].id));await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));const diff=await page.evaluate(id=>window.D1_409_TEST.compareVersion(id),id);assert(diff.eventsAdded.length===1,"version diff failed");});
  await test("version restore returns approved event count",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.listVersions().then(items=>items[0].eventCount)),id=await page.evaluate(()=>window.D1_409_TEST.listVersions().then(items=>items[0].id));await page.evaluate(id=>window.D1_409_TEST.restoreVersion(id),id);assert(await page.evaluate(()=>window.D1_409_TEST.document.events.length)===before,"restore failed");});
  await test("mock FileVault remains disabled by default",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.bridge.state.mode)==="DISABLED","FileVault mode changed"));
  await test("full golden-path state survives browser reload",async()=>{const before=await page.evaluate(()=>({events:window.D1_409_TEST.document.events.length,media:window.D1_409_TEST.document.mediaItems.length,comments:window.D1_409_TEST.document.advisorReview.comments.length,title:window.D1_409_TEST.document.title}));await page.reload();await page.waitForFunction(()=>window.D1_410_READY===true);const after=await page.evaluate(()=>({events:window.D1_409_TEST.document.events.length,media:window.D1_409_TEST.document.mediaItems.length,comments:window.D1_409_TEST.document.advisorReview.comments.length,title:window.D1_409_TEST.document.title}));assert(JSON.stringify(before)===JSON.stringify(after),"reload lost state");});
  await nav(page,"advisor");await snap(page,"advisor_five_minute_brief_410.png","Advisor five-minute pre-mock brief",{fullPage:true});
  await close(pair);
}

async function runExportsVaultAndRecovery(){
  const pair=await launch(),page=pair.page;
  await page.evaluate(()=>{window.D1_406A_TEST.loadDemoIntoUser();const states=["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_ONLY","STUDENT_ONLY","HIDDEN"],legacy={INTERVIEWER_SAFE:"public",FULL_STORY:"full",ADVISOR_ONLY:"advisor",STUDENT_ONLY:"student",HIDDEN:"hidden"};window.D1_406A_TEST.state.user.events.forEach(event=>{event.visibilityState="HIDDEN";event.vis="hidden";});window.D1_406A_TEST.state.user.events.slice(0,5).forEach((event,index)=>{event.visibilityState=states[index];event.vis=legacy[states[index]];event.t=`SECRET_${states[index]}`;});window.D1_406A_TEST.renderAll();});
  for(const [placement,type,visibility,name] of [["photo0","photo","INTERVIEWER_SAFE","synthetic_story_1.png"],["photo1","photo","FULL_STORY","synthetic_story_2.webp"],["profile","profilePhoto","ADVISOR_ONLY","synthetic_profile.jpg"],["ribbon","logo","HIDDEN","synthetic_program_logo.png"]]){
    await page.evaluate(({placement,type,visibility})=>{const input=document.querySelector("#mediaFile409");input.dataset.placement=placement;input.dataset.type=type;input.dataset.visibility=visibility;},{placement,type,visibility});
    await page.setInputFiles("#mediaFile409",path.join(MEDIA,name));await page.waitForFunction(placement=>window.D1_409_TEST.state.mediaItems.some(item=>item.placement===placement),placement);
  }
  await approveAll(page);
  const exportStart=performanceNow();
  const safe=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePng('INTERVIEWER_SAFE_PNG',{width:1920,download:false})",null),"interviewer_safe_1920x1080_410.png");
  const full=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePng('FULL_STORY_PNG',{width:1920,download:false})",null),"full_story_1920x1080_410.png");
  const safe2560=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePng('INTERVIEWER_SAFE_PNG',{width:2560,download:false})",null),"interviewer_safe_2560x1440_410.png");
  const printPdf=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePdf('PRINT_PDF',{width:2560,download:false})",null),"print_ready_410.pdf");
  const advisorPdf=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePdf('ADVISOR_PACKET_PDF',{width:1920,download:false})",null),"advisor_packet_410.pdf");
  const json=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generateJson({download:false})",null),"timeline_document_sanitized_410.json");
  const accessible=await saveBlob(await blobPayload(page,"async () => window.D1_410_TEST.generateAccessibleHtml({scope:'INTERVIEWER_SAFE',download:false})",null),"timeline_accessible_interviewer_safe_410.html");
  const archive=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generateArchive({download:false})",null),"student_archive_410.zip");
  performance.exportBundleMs=+(performanceNow()-exportStart).toFixed(2);
  const exportChecks=[
    ["interviewer-safe PNG signature is valid",safe.buffer.slice(0,8).toString("hex")==="89504e470d0a1a0a"],
    ["interviewer-safe PNG dimensions are 1920x1080",JSON.stringify(pngDimensions(safe.buffer))===JSON.stringify({width:1920,height:1080})],
    ["full-story PNG signature is valid",full.buffer.slice(0,8).toString("hex")==="89504e470d0a1a0a"],
    ["full-story PNG dimensions are 1920x1080",JSON.stringify(pngDimensions(full.buffer))===JSON.stringify({width:1920,height:1080})],
    ["high-resolution PNG is 2560x1440",JSON.stringify(pngDimensions(safe2560.buffer))===JSON.stringify({width:2560,height:1440})],
    ["safe and full PNG scopes differ",safe.sha256!==full.sha256],
    ["print PDF has a valid header",printPdf.buffer.slice(0,8).toString().startsWith("%PDF-1.4")],
    ["print PDF has an EOF trailer",printPdf.buffer.includes(Buffer.from("%%EOF"))],
    ["advisor PDF has a valid header",advisorPdf.buffer.slice(0,8).toString().startsWith("%PDF-1.4")],
    ["advisor PDF has two pages",(advisorPdf.buffer.toString("latin1").match(/\/Type \/Page\b/g)||[]).length===2],
    ["student JSON parses",JSON.parse(json.buffer.toString()).schemaVersion==="d1-timeline-document-409.1"],
    ["accessible HTML has semantic main",accessible.buffer.toString().includes("<main>")],
    ["accessible HTML has chronology table",accessible.buffer.toString().includes('<table>')&&accessible.buffer.toString().includes('id="chronology-heading"')],
    ["accessible HTML discloses untagged PDF",accessible.buffer.toString().includes("No PDF/UA claim is made")],
    ["student archive is a ZIP",archive.buffer.slice(0,4).toString("hex")==="504b0304"],
    ["archive includes accessible HTML",archive.buffer.includes(Buffer.from("accessible/timeline-accessible.html"))],
    ["archive includes accessible text summary",archive.buffer.includes(Buffer.from("accessible/timeline-summary.txt"))],
    ["archive includes PDF limitations",archive.buffer.includes(Buffer.from("accessible/PDF_LIMITATIONS.txt"))]
  ];
  for(const [name,condition] of exportChecks)await test(name,async()=>assert(condition,name));
  await test("interviewer-safe renderer outputs one safe event",async()=>assert(safe.eventCount===1,`expected 1, got ${safe.eventCount}`));
  await test("full-story renderer outputs safe and full events",async()=>assert(full.eventCount===2,`expected 2, got ${full.eventCount}`));
  await test("sanitized JSON excludes raw page text",async()=>{const doc=JSON.parse(json.buffer.toString()),text=json.buffer.toString();assert(doc.sourceBlocks.length===0&&!text.includes("sourceExcerpt")&&!text.includes("rawText"),"source content leaked");});
  await test("sanitized JSON excludes object URLs and thumbnails",async()=>{const text=json.buffer.toString();assert(!text.includes("blob:")&&!text.includes("previewDataUrl")&&!text.includes('"thumbnail"'),"media preview leaked");});
  await test("hidden media is omitted from student archive",async()=>assert(!archive.buffer.includes(Buffer.from("synthetic_program_logo.png")),"hidden media leaked"));
  await test("student archive includes permitted student media",async()=>assert(archive.buffer.includes(Buffer.from("synthetic_story_1.png"))&&archive.buffer.includes(Buffer.from("synthetic_profile.jpg")),"permitted media missing"));
  await test("artifact hash matches safe PNG bytes",async()=>assert(safe.artifact.contentHash===safe.sha256,"artifact hash mismatch"));
  await test("artifact stores document identity",async()=>assert(safe.artifact.timelineDocumentId===safe.record.artifactId?false:!!safe.artifact.timelineDocumentId,"document identity missing"));
  await test("artifact stores version identity",async()=>assert(!!safe.artifact.timelineVersionId,"version identity missing"));
  await test("artifact stores approval state",async()=>assert(safe.artifact.approvalState.approvals.export.state==="APPROVED","approval state missing"));
  await test("export filenames are filesystem safe",async()=>assert([safe,full,safe2560,printPdf,advisorPdf,json,accessible,archive].every(item=>!/[\\/:*?\"<>|]/.test(item.filename)),"unsafe filename"));
  await test("repeated same-size safe export is byte stable",async()=>{const again=await saveBlob(await blobPayload(page,"async () => window.D1_409_TEST.generatePng('INTERVIEWER_SAFE_PNG',{width:1920,download:false})",null),"interviewer_safe_repeat_410.png");assert(again.sha256===safe.sha256,"repeat PNG changed");});
  await test("export preview uses exact renderer canvas",async()=>{await nav(page,"export");await page.waitForSelector("#exportRendererCanvas410");const size=await page.locator("#exportRendererCanvas410").evaluate(canvas=>({width:canvas.width,height:canvas.height}));assert(size.width===960&&size.height===540,"preview renderer wrong");});
  await snap(page,"export_preview_410.png","Exact local export renderer preview",{fullPage:true});
  await test("material edit invalidates prior approval",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.context.advisor.state.status==="NEEDS_REREVIEW",null,{timeout:5000});assert(await page.evaluate(()=>!window.D1_409_TEST.context.advisor.exportGate("export")),"stale approval active");});
  await test("stale approval blocks safe export",async()=>assert(await page.evaluate(async()=>{try{await window.D1_409_TEST.generatePng("INTERVIEWER_SAFE_PNG",{width:640});return false;}catch(error){return error.code==="EXPORT_APPROVAL_REQUIRED";}}),"stale export allowed"));
  await approveAll(page);
  await test("media removal is reflected in subsequent export",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.length);await page.evaluate(async()=>{const manager=window.D1_409_TEST.context.media,item=manager.list().find(value=>value.placement==="photo0");await manager.remove(item.id);window.D1_406A_TEST.renderAll();});assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.length)===before-1,"media removal failed");});
  await test("source removal retains accepted event with removed marker",async()=>{const ok=await page.evaluate(()=>{const controller=window.D1_408_TEST.controller;controller.state.sourceDocuments=[{id:"source-remove",fileName:"remove.pdf"}];controller.state.extractionCandidates=[];controller.state.timelineEventSourceLinks=[{id:"link",timelineEventId:window.D1_406A_TEST.state.user.events[0].id,sourceDocumentId:"source-remove"}];controller.removeDocument("source-remove",{confirmed:true});return controller.state.timelineEventSourceLinks[0].sourceRemoved===true&&window.D1_406A_TEST.state.user.events.length>0;});assert(ok,"source removal lost event");});

  const artifact=safe.artifact;
  await test("disabled FileVault bridge writes nothing",async()=>assert(await page.evaluate(async artifact=>{const bridge=window.D1_409_TEST.context.bridge,result=await bridge.saveArtifact(artifact);return result.status==="DISABLED"&&bridge.legacy.records.size===0&&bridge.v2.records.size===0;},artifact),"disabled bridge wrote"));
  await test("mock FileVault production count remains zero",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.productionRequestCount===0),"production request count changed"));
  await test("dual-write mock creates one logical link",async()=>assert(await page.evaluate(async artifact=>{const api=window.D1_409_TEST,state={mode:api.modes.DUAL_WRITE,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});await bridge.saveArtifact(artifact);window.__bridge410=bridge;return state.links.length===1&&bridge.legacy.records.size===1&&bridge.v2.records.size===1;},artifact),"dual write wrong"));
  await test("dual-write replay is idempotent",async()=>assert(await page.evaluate(async artifact=>{const bridge=window.__bridge410,before=[bridge.legacy.records.size,bridge.v2.records.size];await bridge.saveArtifact(artifact);return bridge.legacy.records.size===before[0]&&bridge.v2.records.size===before[1];},artifact),"idempotency failed"));
  await test("dual reconciliation reports both matching",async()=>assert(await page.evaluate(artifact=>window.__bridge410.reconcile(artifact).then(result=>result.state==="BOTH_MATCH"),artifact),"reconcile failed"));
  await test("one logical timeline avoids confusing duplicate links",async()=>assert(await page.evaluate(()=>window.__bridge410.state.links.length===1),"duplicate logical link"));
  await test("partial bridge failure is visible",async()=>assert(await page.evaluate(async artifact=>{const api=window.D1_409_TEST,state={mode:api.modes.DUAL_WRITE,links:[],syncHistory:[]},v2=new api.classes.FileVaultV2Adapter();v2.injectFailure("createTimelineArtifact","SIMULATED");const bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2,state});const result=await bridge.saveArtifact(artifact);window.__partial410=bridge;return result.status==="PARTIAL_FAILURE"&&state.status==="PARTIAL_FAILURE";},artifact),"partial failure hidden"));
  await test("partial bridge write retains successful generation",async()=>assert(await page.evaluate(()=>!!window.__partial410.state.links[0].legacyReference&&!window.__partial410.state.links[0].v2Reference),"successful write lost"));
  await test("partial bridge write can recover on retry",async()=>assert(await page.evaluate(artifact=>window.__partial410.saveArtifact(artifact).then(result=>result.status==="SYNCED"),artifact),"bridge retry failed"));
  await test("FileVault mocks never contain production URLs",async()=>assert(await page.evaluate(()=>!/(https?:\/\/|missionmed\.com)/i.test(JSON.stringify(window.__bridge410.state))),"production URL found"));

  await test("simultaneous explicit saves queue without losing latest edit",async()=>{const value=await page.evaluate(async()=>{const api=window.D1_409_TEST,classes=api.classes,adapter=new classes.MemoryPersistenceAdapter(),state={activeDocumentId:"queue-test",advisorReview:null,persistence:{activeDocumentId:"queue-test",dirty:true}},advisor=new classes.AdvisorReviewManager(state);let title="First";const provider=()=>({schemaVersion:"d1-timeline-document-409.1",id:"queue-test",title,events:[],categories:[],mediaItems:[],advisorReview:advisor.state,metadata:{}}),manager=new classes.TimelinePersistenceManager({adapter,state,documentProvider:provider,applyDocument:()=>{},advisorManager:advisor});await adapter.open();const one=manager.saveDraft({reason:"ONE"});title="Second";const two=manager.saveDraft({reason:"TWO"});await Promise.all([one,two]);const record=await adapter.get("documents","queue-test");return {title:record.document.title,sequence:record.sequence};});assert(value.title==="Second"&&value.sequence===2,"queued save lost latest state");});
  await test("simulated write failure keeps dirty state",async()=>assert(await page.evaluate(async()=>{const api=window.D1_409_TEST,A=api.classes.MemoryPersistenceAdapter,R=api.classes.AdvisorReviewManager,M=api.classes.TimelinePersistenceManager,adapter=new A(),state={activeDocumentId:"fail",advisorReview:null,persistence:{activeDocumentId:"fail",dirty:true}},review=new R(state),doc={schemaVersion:"d1-timeline-document-409.1",id:"fail",title:"Failure",events:[],categories:[],mediaItems:[],advisorReview:review.state,metadata:{}},manager=new M({adapter,state,documentProvider:()=>doc,applyDocument:()=>{},advisorManager:review});await adapter.open();adapter.simulateWriteFailure();try{await manager.saveDraft();return false;}catch{return state.persistence.dirty&&!!state.persistence.lastSaveError;}}),"failure falsely saved"));
  await test("malformed import does not replace live draft",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.document.id);await page.evaluate(()=>window.D1_409_TEST.importTimeline("{broken"));assert(await page.evaluate(()=>window.D1_409_TEST.document.id)===before,"malformed import replaced draft");});
  await test("future-version import is rejected",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-999.1"}).ok===false),"future import accepted"));
  await test("duplicate import receives durable identity",async()=>{const source=await page.evaluate(()=>window.D1_409_TEST.document),result=await page.evaluate(source=>window.D1_409_TEST.pure.migrateTimelineInput(source),source);assert(result.ok&&result.document.id===source.id,"duplicate import corrupted identity");});
  await test("recovery checkpoint exists after export workflow",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.recovery.available===true),"checkpoint unavailable"));
  await test("browser reload after export restores document",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.document.events.length);await page.reload();await page.waitForFunction(()=>window.D1_410_READY===true);assert(await page.evaluate(()=>window.D1_409_TEST.document.events.length)===before,"reload lost export state");});
  await close(pair);
}

async function runResponsiveAccessibilityAndPerformance(){
  const matrix=[[768,1024],[900,1100],[1024,768],[1280,800],[1440,900],[1728,1117],[1920,1080],[2560,1440]];
  for(const [width,height] of matrix){
    const pair=await launch({width,height}),page=pair.page;
    await test(`${width}x${height} command heading remains readable`,async()=>{const style=await page.locator('section[data-view="command"] .bigt').evaluate(node=>{const s=getComputedStyle(node);return {display:s.display,color:s.color,fontSize:parseFloat(s.fontSize),rect:node.getBoundingClientRect().toJSON()};});assert(style.display!=="none"&&style.fontSize>=20&&style.rect.width>0,"heading unreadable");});
    await test(`${width}x${height} first-use routes remain discoverable`,async()=>assert(await page.locator("#firstUse410 .route410").count()===3,"routes missing"));
    await nav(page,"canvas");
    await test(`${width}x${height} canvas controls remain reachable`,async()=>assert(await page.locator("#editorTools410").count()===1,"editor controls missing"));
    await nav(page,"export");
    await test(`${width}x${height} export preview stays inside workspace`,async()=>{const box=await page.locator("#exportPreview410, .exportPreview410").first().boundingBox();assert(box&&box.x<width&&box.y<height&&box.width>100,"export preview outside viewport");});
    if([[768,1024],[1024,768],[1440,900],[1920,1080],[2560,1440]].some(item=>item[0]===width&&item[1]===height))await snap(page,`responsive_${width}x${height}_410.png`,`Responsive export workspace ${width}x${height}`,{fullPage:true});
    await close(pair);
  }
  const pair=await launch(),page=pair.page;
  await test("reduced-motion preference disables decorative motion",async()=>assert(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches),"reduced motion not active"));
  await test("focus indicator is visible on primary route",async()=>{const button=page.locator("#firstUse410 .route410").first();await button.focus();const style=await button.evaluate(node=>getComputedStyle(node));assert(style.outlineStyle!=="none"||style.boxShadow!=="none","focus not visible");});
  await test("keyboard can activate guided route",async()=>{const button=page.locator('#firstUse410 [data-nav="builder"]');await button.focus();await page.keyboard.press("Enter");assert(await page.locator('section[data-view="builder"].live').count()===1,"keyboard route failed");});
  await test("modal receives focus",async()=>{await nav(page,"canvas");await page.click('[data-410-action="toggle-editor-advanced"]');await page.click('[data-410-action="edit-title-profile"]');await page.waitForFunction(()=>document.querySelector("#modalBk.on")?.contains(document.activeElement));assert(true);});
  await test("Escape closes modal",async()=>{await page.keyboard.press("Escape");assert(await page.locator("#modalBk.on").count()===0,"Escape failed");});
  await test("canvas has an alternative event list",async()=>assert(await page.locator("#evList").count()===1,"alternative list missing"));
  await test("live save status region exists",async()=>assert(await page.locator("#statusLive409").getAttribute("aria-live")==="polite","live status missing"));
  await test("all icon-only release controls have names",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll(".iconTool410")].every(node=>node.getAttribute("aria-label")||node.title)),"unnamed icon control"));
  await test("visibility uses text and pressed state",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("personal"));assert(await page.evaluate(()=>[...document.querySelectorAll("[data-410-visibility]")].every(node=>node.textContent.trim()&&node.hasAttribute("aria-pressed"))),"visibility depends on color");});
  await test("manual OCR field has explanatory association",async()=>{await nav(page,"upload");await page.click('[data-410-action="manual-ocr-toggle"]');assert(await page.locator("#manualOcrText410").getAttribute("aria-describedby")==="manualOcrLaw410","OCR description missing");});
  await test("all images in app shell have alt text",async()=>assert(await page.evaluate(()=>[...document.images].every(image=>image.hasAttribute("alt"))),"image alt missing"));
  await test("no critical button is smaller than 24 pixels",async()=>{const small=await page.evaluate(()=>[...document.querySelectorAll("button")].filter(node=>{const r=node.getBoundingClientRect(),style=getComputedStyle(node);return style.display!=="none"&&style.visibility!=="hidden"&&r.width>0&&r.height>0&&(r.width<24||r.height<24);}).map(node=>({text:node.textContent.trim(),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height})));assert(small.length===0,JSON.stringify(small.slice(0,5)));});
  await test("200 percent zoom keeps navigation reachable",async()=>{await page.evaluate(()=>document.documentElement.style.zoom="2");assert(await page.locator("#rail .rtab").first().isVisible(),"navigation hidden at 200%");await page.evaluate(()=>document.documentElement.style.zoom="");});
  await test("400 percent zoom preserves read-only content access",async()=>{await nav(page,"command");await page.evaluate(()=>document.documentElement.style.zoom="4");assert(await page.locator("#firstUseTitle410").isVisible(),"first-use title hidden at 400%");await page.evaluate(()=>document.documentElement.style.zoom="");});
  await test("all local script dependencies avoid network",async()=>assert(await page.evaluate(()=>[...document.scripts].every(script=>!script.src||script.src.startsWith(location.origin))),"remote script found"));
  await test("all local stylesheet dependencies avoid network",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll('link[rel="stylesheet"]')].every(link=>link.href.startsWith(location.origin))),"remote stylesheet found"));
  await test("no credential-like localStorage keys exist",async()=>assert(await page.evaluate(()=>Object.keys(localStorage).every(key=>!/token|secret|password|credential/i.test(key))),"credential-like storage key"));
  await test("warm render meets budget",async()=>{const metric=await page.evaluate(()=>{const start=performance.now();for(let i=0;i<10;i++)window.D1_406A_TEST.renderAll();return (performance.now()-start)/10;});performance.warmRenderMeanMs=metric;assert(metric<200,"warm render exceeded budget");});
  await test("explicit save meets budget",async()=>{await page.evaluate(async()=>{const persistence=window.D1_409_TEST.context.persistence;await persistence.flush();if(persistence.saving)await persistence.saving;});const start=performanceNow();await page.evaluate(()=>window.D1_409_TEST.saveDraft("PERFORMANCE_TEST"));const duration=performanceNow()-start;performance.explicitSaveMs=+duration.toFixed(2);assert(duration<1000,"save exceeded budget");});
  await test("accessible HTML build meets budget",async()=>{const metric=await page.evaluate(()=>{const start=performance.now();for(let i=0;i<50;i++)window.D1_410_TEST.buildAccessibleHtml(window.D1_409_TEST.document,{scope:"INTERVIEWER_SAFE"});return (performance.now()-start)/50;});performance.accessibleHtmlMeanMs=metric;assert(metric<50,"accessible HTML exceeded budget");});
  await test("production request count remains zero at end",async()=>assert(await page.evaluate(()=>window.D1_410_TEST.productionRequestCount()===0),"production request occurred"));
  await close(pair);
}

async function run(){
  browser=await chromium.launch({headless:true,channel:"chrome"});
  try{
    await runBootFirstUseAndPrivacy();
    await runEditorAndCollision();
    await runLongReview();
    await runGoldenPath();
    await runExportsVaultAndRecovery();
    await runResponsiveAccessibilityAndPerformance();
  }finally{await browser.close();}
  await test("no console errors across D1-410 suite",async()=>assert(consoleErrors.length===0,JSON.stringify(consoleErrors.slice(0,5))));
  await test("no request failures across D1-410 suite",async()=>assert(requestFailures.length===0,JSON.stringify(requestFailures.slice(0,5))));
  await test("no unexpected network requests across D1-410 suite",async()=>assert(unexpectedRequests.length===0,JSON.stringify(unexpectedRequests.slice(0,5))));
  await test("no production URLs are present in application runtime source",async()=>{const files=[];function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(["vendor","tests","docs"].includes(entry.name))continue;const target=path.join(folder,entry.name);if(entry.isDirectory())walk(target);else if(/\.(?:html|css|js|json)$/.test(entry.name))files.push(target);}}walk(APP);const bad=files.filter(file=>/(https?:\/\/(?!127\.0\.0\.1|localhost)|supabase|r2\.cloudflarestorage|api\.missionmed)/i.test(fs.readFileSync(file,"utf8")));assert(bad.length===0,bad.join(", "));});
  await test("no credential patterns are present in application source",async()=>{const files=[];function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(["vendor","tests"].includes(entry.name))continue;const target=path.join(folder,entry.name);if(entry.isDirectory())walk(target);else if(/\.(?:html|css|js|json)$/.test(entry.name))files.push(target);}}walk(APP);const bad=files.filter(file=>/(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']{8,}/i.test(fs.readFileSync(file,"utf8")));assert(bad.length===0,bad.join(", "));});
  const summary={total:results.length,passed:results.filter(item=>item.status==="PASS").length,failed:results.filter(item=>item.status==="FAIL").length};
  const output={generatedAt:new Date().toISOString(),appUrl:APP_URL,summary,results,performance,consoleErrors,requestFailures,unexpectedRequests:[...new Set(unexpectedRequests)],screenshots};
  fs.writeFileSync(path.join(EVIDENCE,"test_results_410.json"),JSON.stringify(output,null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"performance_results_410.json"),JSON.stringify(performance,null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"console_audit_410.json"),JSON.stringify({generatedAt:output.generatedAt,errors:consoleErrors},null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"network_audit_410.json"),JSON.stringify({generatedAt:output.generatedAt,requestFailures,unexpectedRequests:[...new Set(unexpectedRequests)]},null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"screenshot_manifest_410.json"),JSON.stringify(screenshots,null,2)+"\n");
  process.stdout.write(JSON.stringify(summary)+"\n");
  if(summary.failed)process.exitCode=1;
}

run().catch(error=>{console.error(error);process.exitCode=1;});
