const fs=require("fs");
const path=require("path");
const {chromium}=require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL="file:///Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/index.html";
const ROOT="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const EVIDENCE=path.join(ROOT,"evidence/409");
const MEDIA=path.join(ROOT,"app_demo_401/tests/fixtures/media");
const screenshots=[];
const consoleErrors=[];
const requestFailures=[];
const unexpectedRequests=[];
let browser;

fs.mkdirSync(EVIDENCE,{recursive:true});

function writeJson(name,value){fs.writeFileSync(path.join(EVIDENCE,name),JSON.stringify(value,null,2)+"\n");}
async function launch(viewport={width:1440,height:1000}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,acceptDownloads:false});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror",(error)=>consoleErrors.push(error.message));
  page.on("console",(message)=>{if(message.type()==="error")consoleErrors.push(message.text());});
  page.on("requestfailed",(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText}));
  page.on("request",(request)=>{const url=request.url();if(!url.startsWith("file:")&&!url.startsWith("data:")&&!url.startsWith("blob:"))unexpectedRequests.push(url);});
  await page.goto(APP_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.D1_409_READY===true&&window.D1_409_TEST?.ready===true);
  return {context,page};
}
async function nav(page,view){await page.click('#rail .rtab[data-v="'+view+'"]');await page.waitForFunction((name)=>document.querySelector('section[data-view="'+name+'"]')?.classList.contains("live"),view);await page.waitForTimeout(450);}
async function snap(page,name,label,{fullPage=false}={}){await page.waitForTimeout(450);const target=path.join(EVIDENCE,name);await page.screenshot({path:target,fullPage});screenshots.push({name,label,path:target,viewport:page.viewportSize(),fullPage});return target;}
async function close(pair){await pair.context.close();}
async function approveAll(page){
  await page.evaluate(async()=>{
    const api=window.D1_409_TEST,review=api.context.advisor;
    review.state.changeRequests.filter((item)=>item.state==="OPEN").forEach((item)=>review.resolveChangeRequest(item.id));
    review.state.checklist.forEach((item)=>review.setChecklist(item.id,true));
    const input=api.classes.AdvisorReviewManager.fingerprintInput(api.document),digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)),hash=[...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,"0")).join("");
    ["interviewerSafe","fullStory","export"].forEach((scope)=>review.approve(scope,hash));api.context.api.renderAll();await api.saveDraft("EVIDENCE_APPROVAL");
  });
}

async function persistedAndRecoveryEvidence(){
  let pair=await launch(),page=pair.page;
  await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});
  const before=await page.evaluate(()=>({eventCount:window.D1_409_TEST.document.events.length,sequence:window.D1_409_TEST.state.persistence.saveSequence,documentId:window.D1_409_TEST.document.id}));
  await page.reload();await page.waitForFunction(()=>window.D1_409_READY===true);await nav(page,"canvas");
  const after=await page.evaluate(()=>({eventCount:window.D1_409_TEST.document.events.length,sequence:window.D1_409_TEST.state.persistence.saveSequence,documentId:window.D1_409_TEST.document.id,restored:window.D1_409_TEST.initialized.restored}));
  await snap(page,"persisted_draft_reload_409.png","Draft restored from IndexedDB after reload");
  writeJson("persisted_reload_evidence_409.json",{before,after,passed:before.eventCount===after.eventCount&&before.documentId===after.documentId&&after.restored});
  await close(pair);

  pair=await launch();page=pair.page;
  await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});
  await page.evaluate(async()=>{const api=window.D1_409_TEST,id=api.document.id,record=await api.context.adapter.get("documents",id);await api.context.adapter.put("documents",{...record,document:{id,schemaVersion:"MALFORMED_PARTIAL_WRITE"}});});
  await page.reload();await page.waitForFunction(()=>window.D1_409_READY===true);await nav(page,"versions");
  const recovery=await page.evaluate(()=>({initialized:window.D1_409_TEST.initialized,recovery:window.D1_409_TEST.state.recovery,persistence:window.D1_409_TEST.state.persistence,eventCount:window.D1_409_TEST.document.events.length}));
  await snap(page,"crash_recovery_409.png","Malformed write recovered from valid checkpoint");
  writeJson("crash_recovery_evidence_409.json",recovery);
  await close(pair);
}

async function mediaAndAdvisorEvidence(){
  let pair=await launch(),page=pair.page;await nav(page,"media");
  await page.evaluate(()=>{const input=document.querySelector("#mediaFile409");input.dataset.placement="photo0";input.dataset.type="photo";input.dataset.visibility="FULL_STORY";});
  await page.setInputFiles("#mediaFile409",path.join(MEDIA,"synthetic_story_1.png"));await page.waitForFunction(()=>window.D1_409_TEST.state.mediaItems.length===1);
  await page.click('[data-409-action="media-edit"]');await page.waitForFunction(()=>document.querySelector("#modalBk")?.classList.contains("on"));
  await snap(page,"media_editor_modal_409.png","Local media crop, zoom, rotation, alt text, and visibility editor");
  await close(pair);

  pair=await launch();page=pair.page;await page.evaluate(()=>window.D1_406A_TEST.loadDemoIntoUser());await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});await nav(page,"advisor");
  await page.click("#advChanges");await page.fill("#changeRequest409","Confirm the chronology and privacy scope for this event.");await page.click('[data-409-action="advisor-request-confirm"]');
  await page.locator("#advisorWorkflow409").scrollIntoViewIfNeeded();await snap(page,"advisor_changes_requested_409.png","Persisted advisor changes-requested state");
  const changes=await page.evaluate(()=>structuredClone(window.D1_409_TEST.context.advisor.state));writeJson("advisor_changes_requested_state_409.json",changes);
  await approveAll(page);await page.locator("#advisorWorkflow409").scrollIntoViewIfNeeded();await snap(page,"advisor_approved_scoped_409.png","Three persisted fingerprint-bound advisor approvals");
  await close(pair);
}

async function vaultScenario(mode,name,{failV2=false}={}){
  const pair=await launch({width:1440,height:1050}),page=pair.page;await page.evaluate(()=>window.D1_406A_TEST.loadDemoIntoUser());await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});
  const data=await page.evaluate(async({mode,failV2})=>{
    const api=window.D1_409_TEST,generated=await api.generateJson({download:false});api.context.bridge.setMode(mode);if(failV2)api.context.v2.injectFailure("createTimelineArtifact","SIMULATED_V2_OUTAGE");const save=await api.context.bridge.saveArtifact(generated.artifact);let reconciliation=null;if(!failV2)reconciliation=await api.context.bridge.reconcile(generated.artifact);api.context.api.renderAll();return {mode,save,reconciliation,artifact:generated.artifact,state:structuredClone(api.state.fileVault),legacyCapabilities:api.context.legacy.inspectCapabilities(),v2Capabilities:api.context.v2.inspectCapabilities(),productionRequestCount:api.productionRequestCount};
  },{mode,failV2});
  await nav(page,"export");await page.locator("#fileVault409").scrollIntoViewIfNeeded();await snap(page,name,"Mock FileVault "+mode+(failV2?" partial failure":""));await close(pair);return data;
}

async function fileVaultEvidence(){
  const disabledPair=await launch({width:1440,height:1050}),disabledPage=disabledPair.page;await disabledPage.evaluate(()=>window.D1_409_TEST.generateJson({download:false}));await nav(disabledPage,"export");await disabledPage.locator("#fileVault409").scrollIntoViewIfNeeded();await snap(disabledPage,"filevault_mock_status_409.png","Mock-only FileVault status with production writes disabled");await close(disabledPair);
  const fixtures=[];
  fixtures.push(await vaultScenario("LEGACY_ONLY","filevault_legacy_only_409.png"));
  fixtures.push(await vaultScenario("V2_ONLY","filevault_v2_only_409.png"));
  fixtures.push(await vaultScenario("DUAL_WRITE","filevault_dual_sync_success_409.png"));
  fixtures.push(await vaultScenario("DUAL_WRITE","filevault_partial_sync_failure_409.png",{failV2:true}));
  writeJson("filevault_adapter_fixtures_409.json",fixtures.map(({artifact,...fixture})=>fixture));
  writeJson("dual_write_reconciliation_fixtures_409.json",fixtures.filter((item)=>item.mode==="DUAL_WRITE").map(({artifact,...fixture})=>fixture));
  writeJson("timeline_artifact_representative_fixture_409.json",fixtures[0].artifact);
  const legacy=fixtures[0].legacyCapabilities,v2=fixtures[0].v2Capabilities,fields=[...new Set([...Object.keys(legacy),...Object.keys(v2)])];
  const lines=["capability\tlegacy_mock\tv2_mock\tstatus",...fields.map((field)=>[field,String(legacy[field]),String(v2[field]),field==="productionWrite"?"FORCED_FALSE":legacy[field]===null||v2[field]===null?"UNKNOWN_OR_UNVERIFIED":"DECLARED_MOCK_CAPABILITY"].join("\t"))];
  fs.writeFileSync(path.join(EVIDENCE,"legacy_v2_capability_mapping_409.tsv"),lines.join("\n")+"\n");
}

async function versionMigrationAndDeletionEvidence(){
  let pair=await launch(),page=pair.page;await page.evaluate(()=>window.D1_406A_TEST.loadDemoIntoUser());await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});const versionId=await page.evaluate(()=>window.D1_409_TEST.saveVersion("Before synthetic change").then((item)=>item.id));await page.evaluate(()=>window.D1_406A_TEST.addElement("res"));await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});await nav(page,"versions");await page.waitForSelector('[data-409-action="version-compare"][data-id="'+versionId+'"]');await page.click('[data-409-action="version-compare"][data-id="'+versionId+'"]');await page.waitForFunction(()=>document.querySelector("#modalBk")?.classList.contains("on"));await snap(page,"version_comparison_409.png","Named-version comparison with event delta");await close(pair);

  pair=await launch();page=pair.page;const migration=await page.evaluate(()=>window.D1_409_TEST.importTimeline({schemaVersion:"d1-timeline-document-409.1",id:"migration-warning-evidence",title:"Migration Warning Evidence",events:[{id:"m-e1",title:"Imported Event",startDate:"2024-01",endDate:"2024-02",sourceType:"upload"}],timelineEventSourceLinks:[{eventId:"m-e1",sourceDocumentId:"missing-source"}],sourceDocuments:[]}));await nav(page,"versions");await page.locator("#migration409").scrollIntoViewIfNeeded();await snap(page,"migration_warning_409.png","Import migration report with missing-source warning");writeJson("migration_warning_evidence_409.json",migration.report);await close(pair);

  pair=await launch();page=pair.page;await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});await nav(page,"versions");await page.click('[data-409-action="erase-draft"]');await page.waitForFunction(()=>document.querySelector("#deleteDraftPhrase409"));const preview=await page.evaluate(()=>window.D1_409_TEST.previewDeleteDraft(window.D1_409_TEST.document.id));await snap(page,"entire_draft_delete_preview_409.png","Full local-draft deletion preview and confirmation gate");writeJson("retention_delete_preview_409.json",preview);await close(pair);
}

async function main(){
  browser=await chromium.launch({headless:true,channel:"chrome",args:["--allow-file-access-from-files"]});
  await persistedAndRecoveryEvidence();await mediaAndAdvisorEvidence();await fileVaultEvidence();await versionMigrationAndDeletionEvidence();
  await browser.close();
  writeJson("state_screenshot_manifest_409.json",{generatedAt:new Date().toISOString(),screenshots,consoleErrors,requestFailures,unexpectedRequests:[...new Set(unexpectedRequests)]});
  if(consoleErrors.length||requestFailures.length||unexpectedRequests.length)process.exitCode=1;
  console.log(JSON.stringify({screenshots:screenshots.length,consoleErrors:consoleErrors.length,requestFailures:requestFailures.length,unexpectedRequests:new Set(unexpectedRequests).size}));
}

main().catch(async(error)=>{console.error(error);try{await browser?.close();}catch{}process.exitCode=1;});
