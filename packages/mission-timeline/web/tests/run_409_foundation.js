const fs=require("fs");
const path=require("path");
const {chromium}=require("/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const APP_URL="file:///Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/app_demo_401/index.html";
const ROOT="/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE";
const EVIDENCE=path.join(ROOT,"evidence/409");
const EXPORTS=path.join(EVIDENCE,"exports");
const MEDIA=path.join(ROOT,"app_demo_401/tests/fixtures/media");
fs.mkdirSync(EXPORTS,{recursive:true});

const results=[];
const consoleErrors=[];
const requestFailures=[];
const unexpectedRequests=[];
const screenshots=[];
const performanceResults={};
let browser;

function assert(condition,message){if(!condition)throw new Error(message);}
async function test(name,operation){
  const started=Date.now();
  try{const notes=await operation();results.push({name,status:"PASS",durationMs:Date.now()-started,notes:notes||""});}
  catch(error){results.push({name,status:"FAIL",durationMs:Date.now()-started,notes:error?.message||String(error)});}
}
async function launch(viewport={width:1440,height:950}){
  const started=Date.now();
  const context=await browser.newContext({viewport,deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror",(error)=>consoleErrors.push("pageerror: "+error.message));
  page.on("console",(message)=>{if(message.type()==="error")consoleErrors.push("console: "+message.text());});
  page.on("requestfailed",(request)=>requestFailures.push({url:request.url(),failure:request.failure()?.errorText}));
  page.on("request",(request)=>{const url=request.url();if(!url.startsWith("file:")&&!url.startsWith("data:")&&!url.startsWith("blob:"))unexpectedRequests.push(url);});
  await page.goto(APP_URL,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>window.D1_409_READY===true&&window.D1_409_TEST?.ready===true);
  const durationMs=Date.now()-started,samples=performanceResults.startup?.samples||[];samples.push(durationMs);performanceResults.startup={samples,minMs:Math.min(...samples),maxMs:Math.max(...samples),meanMs:samples.reduce((sum,value)=>sum+value,0)/samples.length};
  return {context,page};
}
async function close(pair){await pair.context.close();}
async function nav(page,view){await page.click('#rail .rtab[data-v="'+view+'"]');await page.waitForFunction((name)=>document.querySelector('section[data-view="'+name+'"]')?.classList.contains("live"),view);}
async function snap(page,name,label,fullPage=false){
  await page.waitForTimeout(450);
  const target=path.join(EVIDENCE,name);await page.screenshot({path:target,fullPage});screenshots.push({name,label,path:target,viewport:page.viewportSize()});return target;
}
function pngDimensions(buffer){assert(buffer.slice(1,4).toString()==="PNG","PNG signature missing");return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};}
function sha256(buffer){return require("crypto").createHash("sha256").update(buffer).digest("hex");}
async function exportBlob(page,key,kind,fileName,width=1920){
  const started=Date.now();
  const payload=await page.evaluate(async({key,kind,width})=>{
    const api=window.D1_409_TEST;let result;
    if(kind==="png")result=await api.generatePng(key,{width,download:false});
    else if(kind==="pdf")result=await api.generatePdf(key,{width,download:false});
    else if(kind==="json")result=await api.generateJson({download:false});
    else result=await api.generateArchive({download:false});
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(result.blob);});
    return {data,filename:result.filename,size:result.blob.size,type:result.blob.type,record:result.record,artifact:result.artifact,eventCount:result.eventCount||0};
  },{key,kind,width});
  const buffer=Buffer.from(payload.data,"base64"),target=path.join(EXPORTS,fileName);fs.writeFileSync(target,buffer);
  return {...payload,buffer,target,sha256:sha256(buffer),durationMs:Date.now()-started};
}
async function approveAll(page){
  await page.evaluate(async()=>{
    const api=window.D1_409_TEST,review=api.context.advisor;
    review.state.changeRequests.filter((item)=>item.state==="OPEN").forEach((item)=>review.resolveChangeRequest(item.id));
    review.state.checklist.forEach((item)=>review.setChecklist(item.id,true));
    const input=api.classes.AdvisorReviewManager.fingerprintInput(api.document);
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
    const hash=[...new Uint8Array(digest)].map((value)=>value.toString(16).padStart(2,"0")).join("");
    ["interviewerSafe","fullStory","export"].forEach((scope)=>review.approve(scope,hash));
    api.context.api.renderAll();
    await api.saveDraft("TEST_APPROVAL");
  });
}

async function runBootAndMigration(){
  const pair=await launch(),page=pair.page;
  await test("409 compatibility API boots",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.version==="409.1"),"409 API missing"));
  await test("409 canonical schema is active",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.schemaVersion==="d1-timeline-document-409.1"),"schema mismatch"));
  await test("IndexedDB is the default persistence adapter",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.adapter==="INDEXED_DB"),"IndexedDB not active"));
  await test("bridge starts disabled",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.fileVault.mode==="DISABLED"),"bridge not disabled"));
  await test("bridge is explicitly mock only",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.bridge.state.mockOnly===true),"mock label missing"));
  await test("zero production requests at boot",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.productionRequestCount===0),"production request recorded"));
  await test("blank builder remains default",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.mode==="blank"&&window.D1_406A_TEST.state.user.events.length===0),"blank default regressed"));
  await test("Keynote Classic remains default",async()=>assert(await page.evaluate(()=>window.D1_406A_TEST.state.canvasTheme==="keynote"),"theme regressed"));
  await test("Reference Sample remains read only",async()=>{await nav(page,"reference");assert(await page.locator("#boardReference .ah").count()===0,"reference became editable");});
  await test("Versions workspace is reachable",async()=>{await nav(page,"versions");assert(await page.locator('section[data-view="versions"].live').count()===1,"versions nav failed");});
  await test("canonical document has 409 persistence roots",async()=>assert(await page.evaluate(()=>["mediaItems","advisorReview","exportRecords","timelineArtifacts","fileVault","persistence","recovery","migrationMetadata","retention"].every((key)=>key in window.D1_409_TEST.document)),"409 roots missing"));
  await test("source metadata marks sandbox only",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.document.metadata.sandboxOnly===true),"sandbox marker missing"));
  await test("cloud retention is none",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.retention.cloudRetention==="NONE_IN_D1_409"),"cloud retention contract wrong"));
  await test("raw PDF bytes are not retained by default",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.retention.rawPdfBytes==="NOT_RETAINED_AFTER_LOCAL_PARSE"),"raw PDF policy wrong"));

  const capabilityFields=["supportsVersioning","supportsPreview","supportsStructuredMetadata","supportsSearchIndex","supportsAdvisorComments","supportsProvenance","supportsSoftDelete","supportsPermanentDelete","supportsArtifactRelations","supportsAuditHistory","productionWrite"];
  for(const generation of ["legacyCapabilities","v2Capabilities"]){
    for(const field of capabilityFields)await test(generation+" declares "+field,async()=>assert(await page.evaluate(({generation,field})=>Object.prototype.hasOwnProperty.call(window.D1_409_TEST.pure[generation](),field),{generation,field}),"capability omitted"));
  }

  const visibilityCases=[["public","INTERVIEWER_SAFE"],["full","FULL_STORY"],["advisor","ADVISOR_ONLY"],["student","STUDENT_ONLY"],["hidden","HIDDEN"]];
  for(const [legacy,expected] of visibilityCases)await test("migration normalizes "+legacy+" visibility",async()=>assert(await page.evaluate(({legacy,expected})=>{const result=window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-408.1",events:[{id:"e",title:"Event",startDate:"2024-01",endDate:"2024-02",visibility:legacy}]});return result.ok&&result.document.events[0].visibilityState===expected;},{legacy,expected}),"visibility migration failed"));
  await test("408 document migrates forward",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-408.1",id:"old",events:[]}).document.schemaVersion==="d1-timeline-document-409.1"),"408 migration failed"));
  await test("partial advisor review is normalized",async()=>assert(await page.evaluate(()=>{const review=window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"partial-review",events:[],advisorReview:{}}).document.advisorReview;return review.checklist.length===4&&Object.prototype.hasOwnProperty.call(review.approvals,"interviewerSafe");}),"partial advisor review remained malformed"));
  await test("407 document migrates where safe",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-407",id:"old407",events:[{t:"Work",s:"2020-01",e:"2020-02",vis:"public"}]}).document.events.length===1),"407 migration failed"));
  await test("unknown fields are preserved",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-408.1",id:"x",events:[],customRoot:{safe:true}}).document.extensions.unmappedImportFields.customRoot.safe),"unknown field dropped"));
  await test("unsupported future schema is rejected",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-410.1"}).ok===false),"future schema accepted"));
  await test("malformed JSON is rejected",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput("{not json").report.status==="REJECTED"),"malformed JSON accepted"));
  await test("malformed import does not replace current draft",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.document.id);await page.evaluate(()=>window.D1_409_TEST.importTimeline("{broken"));assert(await page.evaluate(()=>window.D1_409_TEST.document.id)===before,"current draft replaced");});
  await test("artifact companion document imports",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({artifactSchemaVersion:"d1-timeline-artifact-409.1",companionDocument:{schemaVersion:"d1-timeline-document-409.1",id:"companion",events:[]}}).document.id==="companion"),"artifact companion failed"));
  await test("partial media metadata is preserved",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"media",events:[],mediaItems:[{id:"m1",placement:"photo0"}]}).document.mediaItems[0].id==="m1"),"partial media dropped"));
  await test("missing source document warning is explicit",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"source",events:[],timelineEventSourceLinks:[{eventId:"e"}]}).report.warnings.some((item)=>/no source documents/i.test(item))),"missing source warning absent"));
  await test("missing provenance is marked",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"prov",events:[{id:"e",title:"Imported",startDate:"2020-01",endDate:"2020-02",sourceType:"upload"}]}).document.events[0].provenanceMissing===true),"missing provenance unmarked"));
  await test("orphaned advisor comment is marked",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"comment",events:[],advisorReview:{comments:[{id:"c",timelineEventId:"missing"}]}}).document.advisorReview.comments[0].orphaned===true),"orphan comment unmarked"));
  await test("orphaned FileVault link is marked",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"vault",events:[],fileVault:{links:[{id:"link"}]}}).document.fileVault.links[0].orphaned===true),"orphan vault link unmarked"));
  await test("duplicate artifact ID is preserved and flagged",async()=>assert(await page.evaluate(()=>{const result=window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-409.1",id:"dup",events:[],timelineArtifacts:[{artifactId:"a"},{artifactId:"a"}]});return result.document.timelineArtifacts.length===2&&result.document.timelineArtifacts[1].duplicateArtifactId===true;}),"duplicate artifact handling wrong"));
  await test("migration report records normalized event count",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.migrateTimelineInput({schemaVersion:"d1-timeline-document-408.1",events:[{title:"A",startDate:"2020-01"}]}).report.changes.some((item)=>/Normalized 1 events/.test(item))),"migration report incomplete"));
  await close(pair);
}

async function runPersistenceAndRecovery(){
  const pair=await launch(),page=pair.page;
  await nav(page,"canvas");
  await test("initial durable draft is saved",async()=>assert(await page.evaluate(()=>!!window.D1_409_TEST.state.persistence.lastSavedAt),"initial save missing"));
  await test("editing marks the draft dirty",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===true);});
  await test("autosave clears dirty state",async()=>await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false&&window.D1_409_TEST.state.persistence.saveSequence>=2,{timeout:5000}));
  await test("autosave creates a checkpoint",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.recovery.available&&!!window.D1_409_TEST.state.recovery.lastCheckpointAt),"checkpoint missing"));
  const eventCount=await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length);
  await test("draft survives browser reload",async()=>{await page.reload();await page.waitForFunction(()=>window.D1_409_READY===true);assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===eventCount,"events lost on reload");});
  await test("reload reports restored state",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.initialized.restored===true),"restore flag missing"));
  await test("explicit Save Draft increments sequence",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.state.persistence.saveSequence),started=Date.now();await page.evaluate(()=>window.D1_409_TEST.saveDraft("EXPLICIT_TEST"));performanceResults.explicit_save={durationMs:Date.now()-started};assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.saveSequence)>before,"sequence did not increase");});
  let versionId;
  await test("Save as Version creates named version",async()=>{versionId=await page.evaluate(async()=>{const version=await window.D1_409_TEST.saveVersion("Before title edit");return version.id;});assert(!!versionId,"version ID missing");});
  await test("named version persists in IndexedDB",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.listVersions().then((items)=>items.some((item)=>item.label==="Before title edit"))),"version not persisted"));
  await test("version content hash is SHA-256",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.listVersions().then((items)=>/^[a-f0-9]{64}$/.test(items[0].contentHash))),"version hash missing"));
  await test("version comparison reports added event",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("res"));await page.waitForTimeout(50);const diff=await page.evaluate((id)=>window.D1_409_TEST.compareVersion(id),versionId);assert(diff.eventsAdded.length===1,"added event not reported");});
  await test("version comparison reports media and comment deltas",async()=>{const diff=await page.evaluate((id)=>window.D1_409_TEST.compareVersion(id),versionId);assert(Array.isArray(diff.mediaAdded)&&Number.isFinite(diff.advisorCommentDelta),"extended diff missing");});
  await test("restore replaces the changed draft",async()=>{const started=Date.now();await page.evaluate((id)=>window.D1_409_TEST.restoreVersion(id),versionId);performanceResults.version_restore={durationMs:Date.now()-started};assert(await page.evaluate(()=>window.D1_406A_TEST.state.user.events.length)===eventCount,"version restore failed");});
  await test("restore creates a new recovery checkpoint",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.persistence.recovery.list(window.D1_409_TEST.document.id).then((items)=>items.length>=2)),"restore checkpoint missing"));
  let duplicateId;
  await test("duplicate draft creates deterministic local identity",async()=>{duplicateId=await page.evaluate(()=>window.D1_409_TEST.duplicateDraft("Synthetic copy").then((record)=>record.id));assert(duplicateId&&duplicateId!=="d1-sandbox-doc","duplicate identity wrong");});
  await test("duplicate appears in local draft list",async()=>assert(await page.evaluate((id)=>window.D1_409_TEST.listDrafts().then((items)=>items.some((item)=>item.id===id)),duplicateId),"duplicate not listed"));
  await test("switch draft opens duplicate",async()=>{await page.evaluate((id)=>window.D1_409_TEST.switchDraft(id),duplicateId);assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.activeDocumentId)===duplicateId,"switch failed");});
  await test("rename draft persists",async()=>{await page.evaluate(()=>window.D1_409_TEST.context.persistence.renameDraft("Renamed synthetic draft"));assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.draftName)==="Renamed synthetic draft","rename failed");});
  await test("archive draft persists",async()=>{await page.evaluate(()=>window.D1_409_TEST.context.persistence.archiveDraft(true));assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.archived===true),"archive failed");});
  await test("unarchive draft persists",async()=>{await page.evaluate(()=>window.D1_409_TEST.context.persistence.archiveDraft(false));assert(await page.evaluate(()=>window.D1_409_TEST.state.persistence.archived===false),"unarchive failed");});
  await test("delete requires confirmation",async()=>{const result=await page.evaluate((id)=>window.D1_409_TEST.context.persistence.deleteDraft(id),duplicateId);assert(result.requiresConfirmation===true,"delete confirmation contract failed");});
  await test("deletion preview names deleted and preserved records",async()=>{const preview=await page.evaluate((id)=>window.D1_409_TEST.previewDeleteDraft(id),duplicateId);assert(preview.willDelete.drafts===1&&preview.willNotDelete.some((item)=>/outside this browser sandbox/.test(item)),"deletion preview incomplete");});
  await test("confirmed delete removes duplicate",async()=>{await page.evaluate(async(id)=>{await window.D1_409_TEST.switchDraft("d1-sandbox-doc");await window.D1_409_TEST.deleteDraft(id,{confirmed:true});},duplicateId);assert(!(await page.evaluate((id)=>window.D1_409_TEST.listDrafts().then((items)=>items.some((item)=>item.id===id)),duplicateId)),"confirmed delete failed");});
  await test("entire-draft erase control is visible",async()=>{await nav(page,"versions");assert(await page.locator('[data-409-action="erase-draft"]').count()===1,"erase draft control missing");});

  await test("write failure leaves draft dirty",async()=>assert(await page.evaluate(async()=>{
    const A=window.D1_409_TEST.classes.MemoryPersistenceAdapter,M=window.D1_409_TEST.classes.TimelinePersistenceManager,R=window.D1_409_TEST.classes.AdvisorReviewManager;
    const adapter=new A(),state={activeDocumentId:"failure",advisorReview:null,persistence:{activeDocumentId:"failure",dirty:true}},review=new R(state);
    const doc={schemaVersion:"d1-timeline-document-409.1",id:"failure",title:"Failure",events:[],categories:[],mediaItems:[],advisorReview:review.state,metadata:{}};
    const manager=new M({adapter,state,documentProvider:()=>doc,applyDocument:()=>{},advisorManager:review});await adapter.open();adapter.simulateWriteFailure();
    try{await manager.saveDraft();return false;}catch{return state.persistence.dirty===true&&/SIMULATED/.test(state.persistence.lastSaveError);}
  }),"failure incorrectly marked saved"));
  await test("atomic failure writes no partial document",async()=>assert(await page.evaluate(async()=>{
    const A=window.D1_409_TEST.classes.MemoryPersistenceAdapter;const adapter=new A();await adapter.open();adapter.simulateWriteFailure();
    try{await adapter.atomicPut([{store:"documents",key:"a",value:{id:"a"}},{store:"checkpoints",key:"b",value:{id:"b"}}]);}catch{}
    return (await adapter.list("documents")).length===0&&(await adapter.list("checkpoints")).length===0;
  }),"partial write remained"));
  await test("malformed stored draft recovers from checkpoint",async()=>assert(await page.evaluate(async()=>{
    const A=window.D1_409_TEST.classes.MemoryPersistenceAdapter,M=window.D1_409_TEST.classes.TimelinePersistenceManager,R=window.D1_409_TEST.classes.AdvisorReviewManager;
    const adapter=new A();await adapter.open();const valid={schemaVersion:"d1-timeline-document-409.1",id:"recover",title:"Recovered",events:[],categories:[],mediaItems:[],advisorReview:{},metadata:{}};
    await adapter.put("documents",{id:"recover",document:{schemaVersion:"broken"},savedAt:"2026-01-01T00:00:00.000Z"});
    await adapter.put("checkpoints",{id:"cp",documentId:"recover",sequence:2,createdAt:"2026-01-02T00:00:00.000Z",valid:true,document:valid});
    await adapter.put("settings",{id:"active-document",documentId:"recover"});
    const state={activeDocumentId:"recover",advisorReview:null,persistence:{activeDocumentId:"recover"}},review=new R(state);let applied=null;
    const manager=new M({adapter,state,documentProvider:()=>applied||valid,applyDocument:(doc)=>{applied=doc;},advisorManager:review});
    const result=await manager.initialize();return result.restored&&applied?.title==="Recovered"&&state.recovery.available;
  }),"checkpoint recovery failed"));
  await test("recovery never overwrites a newer valid save",async()=>assert(await page.evaluate(async()=>{
    const A=window.D1_409_TEST.classes.MemoryPersistenceAdapter;const adapter=new A();await adapter.open();
    const doc={id:"newer"};await adapter.put("checkpoints",{id:"old",documentId:"newer",sequence:1,createdAt:"2026-01-01T00:00:00.000Z",valid:true,document:doc});
    const manager=new (window.D1_409_TEST.context.persistence.recovery.constructor)(adapter);
    return (await manager.recover("newer",{savedAt:"2026-01-02T00:00:00.000Z"})).reason==="CURRENT_IS_NEWER";
  }),"older checkpoint overwrote current"));
  await test("purge page text keeps accepted events",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.document.events.length);await page.evaluate(()=>window.D1_409_TEST.context.persistence.purgeExtractedPageText());assert(await page.evaluate(()=>window.D1_409_TEST.document.events.length)===before,"purge deleted events");});
  await close(pair);
}

async function runMedia(){
  const pair=await launch(),page=pair.page;await nav(page,"media");
  const files=[
    ["photo0","photo","FULL_STORY","synthetic_story_1.png"],
    ["photo1","photo","INTERVIEWER_SAFE","synthetic_story_2.webp"],
    ["profile","profilePhoto","ADVISOR_ONLY","synthetic_profile.jpg"],
    ["ribbon","logo","INTERVIEWER_SAFE","synthetic_program_logo.png"],
    ["personal0","personalImage","FULL_STORY","synthetic_personal.png"]
  ];
  for(const [placement,type,visibility,name] of files){
    await test("local media accepts "+name,async()=>{
      await page.evaluate(({placement,type,visibility})=>{const input=document.querySelector("#mediaFile409");input.dataset.placement=placement;input.dataset.type=type;input.dataset.visibility=visibility;},{placement,type,visibility});
      await page.setInputFiles("#mediaFile409",path.join(MEDIA,name));
      await page.waitForFunction((placement)=>window.D1_409_TEST.state.mediaItems.some((item)=>item.placement===placement),placement);
    });
  }
  await test("JPEG metadata is retained",async()=>assert(await page.evaluate(()=>{const item=window.D1_409_TEST.state.mediaItems.find((value)=>value.placement==="profile");return item.mimeType==="image/jpeg"&&item.width===720&&item.height===720;}),"JPEG metadata wrong"));
  await test("PNG metadata is retained",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.find((value)=>value.placement==="photo0").mimeType==="image/png"),"PNG metadata wrong"));
  await test("WebP metadata is retained",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.find((value)=>value.placement==="photo1").mimeType==="image/webp"),"WebP metadata wrong"));
  await test("media content hash is SHA-256",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.every((item)=>/^[a-f0-9]{64}$/.test(item.contentHash))),"media hash missing"));
  await test("local thumbnails are generated",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.every((item)=>String(item.thumbnail).startsWith("data:image/jpeg"))),"thumbnail missing"));
  await test("media provenance says no transmission",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.every((item)=>item.localProvenance.transmission==="NONE")),"transmission contract wrong"));
  await test("crop values are bounded",async()=>assert(await page.evaluate(()=>{const m=window.D1_409_TEST.context.media,item=m.list()[0];m.update(item.id,{crop:{x:-40,y:150,zoom:9,rotation:80}});return item.crop.x===0&&item.crop.y===100&&item.crop.zoom===3&&item.crop.rotation===15;}),"crop bounds failed"));
  await test("alt text persists",async()=>assert(await page.evaluate(()=>{const m=window.D1_409_TEST.context.media,item=m.list()[0];m.update(item.id,{altText:"Synthetic timeline photo"});return item.altText==="Synthetic timeline photo";}),"alt text failed"));
  await test("media visibility persists",async()=>assert(await page.evaluate(()=>{const m=window.D1_409_TEST.context.media,item=m.list()[0];m.update(item.id,{visibility:"STUDENT_ONLY"});return item.visibility==="STUDENT_ONLY";}),"visibility failed"));
  for(const count of [3,4,5])await test(count+"-photo layout is supported",async()=>assert(await page.evaluate((count)=>window.D1_409_TEST.context.media.setPhotoCount(count)===count,count),"photo layout failed"));
  await test("media blobs are stored separately",async()=>assert(await page.evaluate(async()=>{const item=window.D1_409_TEST.state.mediaItems[0];return (await window.D1_409_TEST.context.adapter.getBlob(item.id)) instanceof Blob;}),"blob not persisted"));
  await test("media survives reload",async()=>{const count=await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.length);await page.reload();await page.waitForFunction(()=>window.D1_409_READY===true);assert(await page.evaluate(()=>window.D1_409_TEST.state.mediaItems.length)===count,"media metadata lost");});
  await nav(page,"media");
  await test("persisted media blob survives reload",async()=>assert(await page.evaluate(async()=>{const item=window.D1_409_TEST.state.mediaItems[0];return (await window.D1_409_TEST.context.media.blob(item.id)) instanceof Blob;}),"persisted blob missing"));
  await test("object URL is created locally",async()=>assert(await page.evaluate(async()=>String(await window.D1_409_TEST.context.media.objectUrl(window.D1_409_TEST.state.mediaItems[0].id)).startsWith("blob:")),"object URL missing"));
  await test("object URL cleanup is counted",async()=>assert(await page.evaluate(()=>{const manager=window.D1_409_TEST.context.media,id=window.D1_409_TEST.state.mediaItems[0].id;const before=manager.revokedObjectUrlCount;manager.revoke(id);return manager.revokedObjectUrlCount===before+1;}),"object URL not revoked"));
  await test("unsupported media is rejected before decode",async()=>assert(await page.evaluate(async()=>{try{await window.D1_409_TEST.context.media.addFile(new File(["text"],"bad.gif",{type:"image/gif"}));return false;}catch(error){return error.codes?.includes("UNSUPPORTED_MEDIA_TYPE");}}),"unsupported media accepted"));
  await test("oversized media is rejected before decode",async()=>assert(await page.evaluate(async()=>{try{await window.D1_409_TEST.context.media.addFile(new File([new Uint8Array(5*1024*1024+1)],"large.png",{type:"image/png"}));return false;}catch(error){return error.codes?.includes("MEDIA_TOO_LARGE");}}),"oversized media accepted"));
  await test("undersized media is rejected",async()=>assert(await page.evaluate(async()=>{const canvas=document.createElement("canvas");canvas.width=32;canvas.height=32;const blob=await new Promise((resolve)=>canvas.toBlob(resolve));const file=new File([blob],"tiny.png",{type:"image/png"});try{await window.D1_409_TEST.context.media.addFile(file);return false;}catch(error){return error.codes?.includes("MEDIA_DIMENSIONS_TOO_SMALL");}}),"tiny media accepted"));
  await test("interviewer media filter excludes private media",async()=>assert(await page.evaluate(()=>{const safe=window.D1_409_TEST.pure.mediaForScope(window.D1_409_TEST.document,"INTERVIEWER_SAFE");return safe.every((item)=>item.visibility==="INTERVIEWER_SAFE");}),"private media leaked"));
  await test("advisor media filter includes advisor photo",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.pure.mediaForScope(window.D1_409_TEST.document,"ADVISOR_PACKET").some((item)=>item.visibility==="ADVISOR_ONLY")),"advisor photo missing"));
  await test("hidden media never enters any export scope",async()=>assert(await page.evaluate(()=>{const doc=window.D1_409_TEST.document;doc.mediaItems.push({id:"hidden-media",visibility:"HIDDEN"});return ["INTERVIEWER_SAFE","FULL_STORY","ADVISOR_PACKET","STUDENT"].every((scope)=>!window.D1_409_TEST.pure.mediaForScope(doc,scope).some((item)=>item.id==="hidden-media"));}),"hidden media leaked"));
  await snap(page,"media_editing_409.png","Real local media editing");
  await close(pair);
}

async function runAdvisorAndExports(){
  const pair=await launch(),page=pair.page;
  await page.evaluate(()=>window.D1_406A_TEST.loadDemoIntoUser());
  await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});
  for(const [placement,type,visibility,name] of [["photo0","photo","INTERVIEWER_SAFE","synthetic_story_1.png"],["photo1","photo","FULL_STORY","synthetic_story_2.webp"],["profile","profilePhoto","ADVISOR_ONLY","synthetic_profile.jpg"]]){
    await page.evaluate(({placement,type,visibility})=>{const input=document.querySelector("#mediaFile409");input.dataset.placement=placement;input.dataset.type=type;input.dataset.visibility=visibility;},{placement,type,visibility});
    await page.setInputFiles("#mediaFile409",path.join(MEDIA,name));await page.waitForFunction((placement)=>window.D1_409_TEST.state.mediaItems.some((item)=>item.placement===placement),placement);
  }
  await page.waitForFunction(()=>window.D1_409_TEST.state.persistence.dirty===false,{timeout:5000});
  await nav(page,"advisor");
  await test("advisor starts unreviewed",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.status)==="UNREVIEWED","initial advisor state wrong"));
  await test("advisor checklist has canonical items",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.checklist.length===4),"checklist wrong"));
  for(const id of ["chronology","privacy","story","questions"])await test("advisor checklist persists "+id,async()=>assert(await page.evaluate((id)=>{const manager=window.D1_409_TEST.context.advisor;manager.setChecklist(id,true);return manager.state.checklist.find((item)=>item.id===id).complete;},id),"checklist did not update"));
  await test("general advisor comment persists",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.addComment({body:"Clarify the transition to USCE."}).body.includes("USCE")),"comment failed"));
  const eventId=await page.evaluate(()=>window.D1_409_TEST.document.events[0].id);
  let commentId;
  await test("event-pinned comment persists",async()=>{commentId=await page.evaluate((eventId)=>window.D1_409_TEST.context.advisor.addComment({body:"Prepare a concise answer.",timelineEventId:eventId}).id,eventId);assert(!!commentId,"pinned comment ID missing");});
  await test("student acknowledgement is recorded",async()=>assert(await page.evaluate((id)=>window.D1_409_TEST.context.advisor.acknowledgeComment(id).studentAcknowledged,commentId),"acknowledgement failed"));
  await test("comment resolution is recorded",async()=>assert(await page.evaluate((id)=>window.D1_409_TEST.context.advisor.resolveComment(id).resolved,commentId),"comment resolution failed"));
  let requestId;
  await test("change request sets changes-requested state",async()=>{requestId=await page.evaluate((eventId)=>window.D1_409_TEST.context.advisor.requestChanges({body:"Confirm this date.",timelineEventId:eventId}).id,eventId);assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.status)==="CHANGES_REQUESTED","status not updated");});
  await test("student acknowledges change request",async()=>assert(await page.evaluate((id)=>window.D1_409_TEST.context.advisor.acknowledgeChangeRequest(id).studentAcknowledged,requestId),"request acknowledgement failed"));
  await test("open change request blocks approval",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.canApprove()===false),"approval not blocked"));
  await test("resolved change request clears blocker",async()=>{await page.evaluate((id)=>window.D1_409_TEST.context.advisor.resolveChangeRequest(id),requestId);assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.canApprove()===true),"approval still blocked");});
  await test("interviewer-safe export is blocked before approval",async()=>assert(await page.evaluate(async()=>{try{await window.D1_409_TEST.generatePng("INTERVIEWER_SAFE_PNG",{width:640});return false;}catch(error){return error.code==="EXPORT_APPROVAL_REQUIRED";}}),"approval bypassed"));
  await approveAll(page);
  for(const scope of ["interviewerSafe","fullStory","export"])await test(scope+" approval is fingerprint-bound",async()=>assert(await page.evaluate((scope)=>window.D1_409_TEST.context.advisor.exportGate(scope),scope),"approval gate false"));
  await test("advisor audit captures approvals",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.auditHistory.filter((item)=>item.action==="APPROVED").length===3),"approval audit missing"));
  await test("advisor state survives reload",async()=>{const before=await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.comments.length);await page.reload();await page.waitForFunction(()=>window.D1_409_READY===true);assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.comments.length)===before,"advisor comments lost");});
  await test("material timeline edit revokes approvals",async()=>{await page.evaluate(()=>window.D1_406A_TEST.addElement("work"));await page.waitForFunction(()=>window.D1_409_TEST.context.advisor.state.status==="NEEDS_REREVIEW",{timeout:5000});assert(await page.evaluate(()=>Object.values(window.D1_409_TEST.context.advisor.state.approvals).every((item)=>item.state==="REVOKED")),"approvals not revoked");});
  await test("comment-only edit does not invalidate approval fingerprint",async()=>{await approveAll(page);await page.evaluate(()=>window.D1_409_TEST.context.advisor.addComment({body:"Non-material coaching note."}));await page.waitForTimeout(800);assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.exportGate("export")),"comment invalidated approval");});
  await test("manual revocation is explicit",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.revokeApprovals("MANUAL_REVOCATION")===3),"manual revocation count wrong"));
  await approveAll(page);
  await snap(page,"advisor_approved_409.png","Persisted advisor approval");

  await test("five-state event visibility filters exactly",async()=>assert(await page.evaluate(()=>{
    const base={categoryId:"work",eventType:"duration",startDate:"2024-01",endDate:"2024-02"},doc={events:[
      {...base,id:"safe",visibilityState:"INTERVIEWER_SAFE"},{...base,id:"full",visibilityState:"FULL_STORY"},{...base,id:"advisor",visibilityState:"ADVISOR_ONLY"},{...base,id:"student",visibilityState:"STUDENT_ONLY"},{...base,id:"hidden",visibilityState:"HIDDEN"}
    ]};
    const fn=window.D1_409_TEST.pure.eventsForScope;
    return fn(doc,"INTERVIEWER_SAFE").map((x)=>x.id).join(",")==="safe"&&fn(doc,"FULL_STORY").map((x)=>x.id).join(",")==="safe,full"&&fn(doc,"ADVISOR_PACKET").map((x)=>x.id).join(",")==="safe,full,advisor"&&fn(doc,"STUDENT").map((x)=>x.id).join(",")==="safe,full,advisor,student";
  }),"visibility matrix wrong"));

  const safe1920=await exportBlob(page,"INTERVIEWER_SAFE_PNG","png","interviewer_safe_1920x1080_409.png",1920);
  const full1920=await exportBlob(page,"FULL_STORY_PNG","png","full_story_1920x1080_409.png",1920);
  const safe2560=await exportBlob(page,"INTERVIEWER_SAFE_PNG","png","interviewer_safe_2560x1440_409.png",2560);
  const printPdf=await exportBlob(page,"PRINT_PDF","pdf","print_ready_409.pdf",2560);
  const advisorPdf=await exportBlob(page,"ADVISOR_PACKET_PDF","pdf","advisor_packet_409.pdf",1920);
  const timelineJson=await exportBlob(page,"SOURCE_JSON","json","timeline_document_sanitized_409.json");
  const archive=await exportBlob(page,"ARCHIVE","zip","student_archive_409.zip");
  performanceResults.exports={interviewerSafePngMs:safe1920.durationMs,fullStoryPngMs:full1920.durationMs,interviewerSafe2560PngMs:safe2560.durationMs,printPdfMs:printPdf.durationMs,advisorPacketPdfMs:advisorPdf.durationMs,timelineJsonMs:timelineJson.durationMs,studentArchiveMs:archive.durationMs};
  fs.writeFileSync(path.join(EXPORTS,"timeline_artifact_interviewer_safe_409.json"),JSON.stringify(safe1920.artifact,null,2)+"\n");

  await test("interviewer-safe PNG is a real PNG",async()=>assert(safe1920.buffer.slice(0,8).toString("hex")==="89504e470d0a1a0a","PNG signature wrong"));
  await test("interviewer-safe PNG is 1920x1080",async()=>{const size=pngDimensions(safe1920.buffer);assert(size.width===1920&&size.height===1080,"safe dimensions wrong");});
  await test("full-story PNG is a real PNG",async()=>assert(full1920.buffer.slice(0,8).toString("hex")==="89504e470d0a1a0a","full PNG signature wrong"));
  await test("full-story PNG is 1920x1080",async()=>{const size=pngDimensions(full1920.buffer);assert(size.width===1920&&size.height===1080,"full dimensions wrong");});
  await test("high-resolution PNG is 2560x1440",async()=>{const size=pngDimensions(safe2560.buffer);assert(size.width===2560&&size.height===1440,"high-res dimensions wrong");});
  await test("safe and full PNG hashes differ when scope differs",async()=>assert(safe1920.sha256!==full1920.sha256,"scope exports unexpectedly identical"));
  await test("print PDF has valid header and trailer",async()=>assert(printPdf.buffer.slice(0,8).toString().startsWith("%PDF-1.4")&&printPdf.buffer.includes(Buffer.from("%%EOF")),"print PDF invalid"));
  await test("advisor packet PDF has valid header and trailer",async()=>assert(advisorPdf.buffer.slice(0,8).toString().startsWith("%PDF-1.4")&&advisorPdf.buffer.includes(Buffer.from("%%EOF")),"advisor PDF invalid"));
  await test("print PDF has one page",async()=>assert((printPdf.buffer.toString("latin1").match(/\/Type \/Page\b/g)||[]).length===1,"print page count wrong"));
  await test("advisor packet PDF has two pages",async()=>assert((advisorPdf.buffer.toString("latin1").match(/\/Type \/Page\b/g)||[]).length===2,"advisor packet page count wrong"));
  await test("advisor packet overflow fixture is exercised",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.advisor.state.auditHistory.length>6),"advisor audit fixture did not exercise overflow"));
  await test("Timeline JSON parses",async()=>assert(JSON.parse(timelineJson.buffer.toString()).schemaVersion==="d1-timeline-document-409.1","JSON invalid"));
  await test("Timeline JSON excludes raw page text",async()=>{const doc=JSON.parse(timelineJson.buffer.toString());assert(doc.metadata.rawSourceTextIncluded===false&&doc.sourceBlocks.length===0&&doc.documentPages.every((item)=>!Object.prototype.hasOwnProperty.call(item,"text")),"raw text leaked");});
  await test("Timeline JSON strips provenance source excerpts",async()=>{const doc=JSON.parse(timelineJson.buffer.toString());assert(doc.extractionCandidates.every((candidate)=>(candidate.provenance||[]).every((item)=>!item.sourceExcerpt)),"provenance excerpt leaked");});
  await test("sanitizer removes nested 408 source payloads",async()=>assert(await page.evaluate(()=>{const clean=window.D1_409_TEST.pure.sanitizeDocumentForExport({events:[{id:"e",provenance:[{sourceExcerpt:"PRIVATE_EVENT_SOURCE"}],humanCorrection:{originalExtraction:{rawText:"PRIVATE_CORRECTION_SOURCE"}}}],extractionCandidates:[{id:"c",originalExtraction:{rawText:"PRIVATE_CANDIDATE_SOURCE"},provenance:[{sourceExcerpt:"PRIVATE_CANDIDATE_EXCERPT"}]}],documentPages:[{id:"p",text:"PRIVATE_PAGE_TEXT"}],sourceBlocks:[{id:"b",text:"PRIVATE_BLOCK_TEXT"}],metadata:{}});const text=JSON.stringify(clean);return !text.includes("PRIVATE_")&&clean.metadata.rawSourceTextIncluded===false;}),"nested source payload leaked"));
  await test("student archive is a real ZIP",async()=>assert(archive.buffer.slice(0,4).toString("hex")==="504b0304"&&archive.buffer.includes(Buffer.from("timeline-document.json")),"ZIP invalid"));
  await test("student archive includes TimelineArtifact index",async()=>assert(archive.buffer.includes(Buffer.from("timeline-artifacts.json")),"artifact index missing"));
  await test("student archive contains persisted local media",async()=>assert(archive.buffer.includes(Buffer.from("media/"))&&archive.buffer.includes(Buffer.from("synthetic_story_1.png"))&&archive.buffer.includes(Buffer.from("synthetic_profile.jpg")),"archive media entries missing"));
  await test("artifact manifest validates",async()=>assert(await page.evaluate((artifact)=>window.D1_409_TEST.pure.validateTimelineArtifact(artifact).valid,safe1920.artifact),"artifact invalid"));
  await test("artifact content hash matches PNG bytes",async()=>assert(safe1920.artifact.contentHash===safe1920.sha256,"artifact hash mismatch"));
  await test("artifact idempotency key is deterministic",async()=>assert(safe1920.artifact.artifactId===safe1920.artifact.idempotencyKey,"idempotency mismatch"));
  await test("artifact captures document and version identity",async()=>assert(safe1920.artifact.timelineDocumentId&&safe1920.artifact.timelineVersionId,"artifact identity missing"));
  await test("artifact captures approval state",async()=>assert(safe1920.artifact.approvalState.approvals.export.state==="APPROVED","approval state missing"));
  await test("artifact metadata contains no raw source text",async()=>assert(!/sourceExcerpt|rawText|pageText/.test(JSON.stringify(safe1920.artifact)),"raw source text in artifact"));
  await test("export records persist",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.state.exportRecords.length)>=7,"export records missing"));
  await test("export blobs persist separately",async()=>assert(await page.evaluate(async()=>{const record=window.D1_409_TEST.state.exportRecords[0];return (await window.D1_409_TEST.context.adapter.getBlob("export:"+record.id)) instanceof Blob;}),"export blob missing"));
  await test("irrelevant UI state does not change material export hash input",async()=>assert(await page.evaluate(async()=>{const engine=window.D1_409_TEST.context.exportEngine,a=await engine.contentHashForCurrent();window.D1_406A_TEST.state.view="media";const b=await engine.contentHashForCurrent();return a===b;}),"UI state changed hash"));
  await test("material title change changes export hash input",async()=>assert(await page.evaluate(async()=>{const engine=window.D1_409_TEST.context.exportEngine,a=await engine.contentHashForCurrent();window.D1_406A_TEST.state.profile.name="Dr. Material Change";const b=await engine.contentHashForCurrent();return a!==b;}),"material change did not change hash"));
  await nav(page,"export");await snap(page,"export_records_409.png","Real local export records");
  await close(pair);
  return {safeArtifact:safe1920.artifact,fullArtifact:full1920.artifact};
}

async function runFileVault(artifacts){
  const pair=await launch(),page=pair.page;
  await test("disabled bridge performs zero writes",async()=>assert(await page.evaluate(async(artifact)=>{const bridge=window.D1_409_TEST.context.bridge;const result=await bridge.saveArtifact(artifact);return result.status==="DISABLED"&&result.writes===0&&bridge.legacy.records.size===0&&bridge.v2.records.size===0;},artifacts.safeArtifact),"disabled bridge wrote"));
  await test("disabled bridge records an honest audit",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.bridge.state.syncHistory.some((item)=>item.action==="WRITE_SKIPPED_DISABLED")),"disabled audit missing"));
  await test("legacy-only mode writes only legacy mock",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST;api.context.bridge.setMode(api.modes.LEGACY_ONLY);const result=await api.context.bridge.saveArtifact(artifact);return result.status==="SYNCED"&&api.context.legacy.records.size===1&&api.context.v2.records.size===0;},artifacts.safeArtifact),"legacy mode wrong"));
  await test("legacy idempotency prevents duplicate document",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST,before=api.context.legacy.records.size;const result=await api.context.bridge.saveArtifact(artifact);return api.context.legacy.records.size===before&&result.writes[0].idempotentReplay===true;},artifacts.safeArtifact),"legacy duplicate created"));
  await test("legacy repeated artifact does not increment version",async()=>assert(await page.evaluate(()=>[...window.D1_409_TEST.context.legacy.records.values()][0].version===1),"legacy version incremented on replay"));
  await test("legacy adapter exposes partial verified mapping",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.legacy.evidence.status==="VERIFIED_SANDBOX_EVIDENCE_OF_LIVE_V1"),"legacy evidence wrong"));
  await test("legacy delete remains explicitly unknown",async()=>assert(await page.evaluate(async()=>{try{await window.D1_409_TEST.context.legacy.deleteArtifact("x");return false;}catch(error){return error.message==="LEGACY_DELETE_ENDPOINT_UNKNOWN";}}),"legacy delete invented"));
  await test("v2 adapter is labeled proposed",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.context.v2.evidence.status==="PROPOSED_PENDING_RATIFICATION"),"v2 evidence overstated"));
  await test("v2-only mode writes only v2 mock",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST;const state={mode:api.modes.V2_ONLY,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});const result=await bridge.saveArtifact(artifact);return result.status==="SYNCED"&&bridge.legacy.records.size===0&&bridge.v2.records.size===1;},artifacts.safeArtifact),"v2 mode wrong"));
  await test("dual-write creates corresponding mock records",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST,state={mode:api.modes.DUAL_WRITE,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});const result=await bridge.saveArtifact(artifact);window.__dual409=bridge;return result.status==="SYNCED"&&bridge.legacy.records.size===1&&bridge.v2.records.size===1&&state.links.length===1;},artifacts.safeArtifact),"dual write wrong"));
  await test("dual-write relation tracks both references",async()=>assert(await page.evaluate(()=>{const link=window.__dual409.state.links[0];return !!link.legacyReference&&!!link.v2Reference&&link.logicalKey.includes("TIMELINE_INTERVIEWER_SAFE_PNG");}),"dual relation missing"));
  await test("dual reconciliation reports both match",async()=>assert(await page.evaluate((artifact)=>window.__dual409.reconcile(artifact).then((result)=>result.state==="BOTH_MATCH"),artifacts.safeArtifact),"dual reconcile wrong"));
  await test("new material artifact becomes a corresponding version",async()=>assert(await page.evaluate(async({first,second})=>{const bridge=window.__dual409;const revised={...second,timelineDocumentId:first.timelineDocumentId,artifactType:first.artifactType};const result=await bridge.saveArtifact(revised);const versions=[...bridge.legacy.records.values()][0].version;return result.status==="SYNCED"&&bridge.state.links.length===1&&versions===2;},{first:artifacts.safeArtifact,second:artifacts.fullArtifact}),"version correspondence failed"));
  await test("partial dual-write failure is visible",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST,state={mode:api.modes.DUAL_WRITE,links:[],syncHistory:[]},v2=new api.classes.FileVaultV2Adapter();v2.injectFailure("createTimelineArtifact","V2_OFFLINE");const bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2,state});const result=await bridge.saveArtifact(artifact);window.__partial409=bridge;return result.status==="PARTIAL_FAILURE"&&result.writes.some((item)=>item.status==="FAILED")&&state.status==="PARTIAL_FAILURE";},artifacts.safeArtifact),"partial failure hidden"));
  await test("partial failure retains successful legacy link",async()=>assert(await page.evaluate(()=>{const link=window.__partial409.state.links[0];return !!link.legacyReference&&!link.v2Reference;}),"successful link lost"));
  await test("partial failure is recoverable by retry",async()=>assert(await page.evaluate(async(artifact)=>{const result=await window.__partial409.saveArtifact(artifact);return result.status==="SYNCED"&&result.writes.every((item)=>item.status==="SUCCESS");},artifacts.safeArtifact),"retry failed"));
  await test("retry does not duplicate successful legacy record",async()=>assert(await page.evaluate(()=>window.__partial409.legacy.records.size===1),"legacy duplicate after retry"));
  await test("read-legacy-write-v2 writes only v2 for a new link",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST,state={mode:api.modes.READ_LEGACY_WRITE_V2,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});await bridge.saveArtifact(artifact);return bridge.legacy.records.size===0&&bridge.v2.records.size===1;},artifacts.safeArtifact),"migration mode wrong"));
  await test("local-only reconcile is explicit",async()=>assert(await page.evaluate(async(artifact)=>{const api=window.D1_409_TEST,state={mode:api.modes.DISABLED,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});return (await bridge.reconcile(artifact)).state==="LOCAL_ONLY";},artifacts.safeArtifact),"local-only state hidden"));
  await test("owner identity is preserved in mock record",async()=>assert(await page.evaluate((artifact)=>{const row=[...window.__dual409.legacy.records.values()][0];return row.ownerId===artifact.studentOwnerId;},artifacts.safeArtifact),"owner mapping lost"));
  await test("adapter contracts make no network requests",async()=>assert(await page.evaluate(()=>window.D1_409_TEST.productionRequestCount===0&&window.__dual409.legacy.networkRequestCount===0&&window.__dual409.v2.networkRequestCount===0),"network count changed"));
  await nav(page,"export");
  await test("FileVault UI says mock connection",async()=>assert((await page.locator("#fileVault409").innerText()).includes("MOCK FILEVAULT CONNECTION"),"mock label absent"));
  await test("FileVault UI says no production write",async()=>assert((await page.locator("#fileVault409").innerText()).includes("NO PRODUCTION WRITE"),"no-write label absent"));
  await snap(page,"filevault_mock_disabled_409.png","Mock FileVault disabled state");
  await page.selectOption("#vaultMode409","DUAL_WRITE");
  await snap(page,"filevault_mock_dual_409.png","Mock FileVault dual-write mode");
  await close(pair);
}

async function runPerformanceAndDensity(){
  const pair=await launch({width:1728,height:1117}),page=pair.page;
  const memoryStart=await page.evaluate(()=>performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null);
  for(const fixtureId of ["fx5","fx15","fx30","fx50","fx_same_month","fx_10y","fx_20y"]){
    await test("performance fixture "+fixtureId+" renders",async()=>{
      const metric=await page.evaluate((id)=>{const start=performance.now();window.D1_407_TEST.loadFixture(id);return {durationMs:performance.now()-start,events:window.D1_409_TEST.document.events.length,lanes:window.D1_407_TEST.layout.stats.laneCount};},fixtureId);
      performanceResults["render_"+fixtureId]=metric;assert(metric.events>0&&metric.durationMs<2500,"fixture render too slow");
    });
  }
  await test("100-event timeline renders without crash",async()=>{
    const metric=await page.evaluate(()=>{const base=window.D1_406A_TEST.state.demo.events,start=performance.now();window.D1_406A_TEST.state.user.events=Array.from({length:100},(_,index)=>({...base[index%base.length],id:"perf-"+index,s:String(2000+Math.floor(index/12))+"-"+String(index%12+1).padStart(2,"0"),e:String(2000+Math.floor(index/12))+"-"+String(index%12+1).padStart(2,"0")}));window.D1_406A_TEST.state.mode="blank";window.D1_406A_TEST.renderAll();return {durationMs:performance.now()-start,placements:Object.keys(window.D1_407_TEST.layout.placements).length};});
    performanceResults.render_100_events=metric;assert(metric.placements===100&&metric.durationMs<3500,"100-event render failed");
  });
  await test("162 ingestion candidates remain renderable",async()=>{
    const metric=await page.evaluate((count)=>{const state=window.D1_408_TEST.state,sample={id:"sample",title:"Synthetic candidate",siteName:"Test Site",organization:"Test Site",section:"experiences",startDate:"2020-01",endDate:"2020-03",timelineKind:"duration",categoryId:"work",canonicalType:"WORK_EXPERIENCE",candidateKind:"NORMAL",reviewStatus:"PENDING",visibilityRecommendation:"INTERVIEWER_SAFE",confidence:{level:"HIGH",score:90},provenance:[{fileName:"synthetic.pdf",pageNumber:1,sourceExcerpt:"Synthetic safe fixture"}],inferredFields:[],originalExtraction:{rawText:"Synthetic safe fixture"},mappingRationale:"Synthetic performance fixture"};state.sourceDocuments=[{id:"doc",fileName:"synthetic.pdf",status:"EXTRACTED",detectedType:"cv",effectiveType:"cv",pageCount:10,charCount:1000}];state.extractionCandidates=Array.from({length:count},(_,index)=>({...sample,id:"candidate-"+index,title:"Synthetic candidate "+index}));const start=performance.now();window.D1_408_TEST.ui.render(state);return {durationMs:performance.now()-start,cards:document.querySelectorAll("[data-candidate-card]").length};},162);
    performanceResults.render_162_candidates=metric;assert(metric.cards===162&&metric.durationMs<3500,"162 candidates unusable");
  });
  await test("500 ingestion candidates remain renderable",async()=>{
    const metric=await page.evaluate((count)=>{const state=window.D1_408_TEST.state,sample=state.extractionCandidates[0];state.extractionCandidates=Array.from({length:count},(_,index)=>({...sample,id:"candidate500-"+index,title:"Candidate "+index}));const start=performance.now();window.D1_408_TEST.ui.render(state);return {durationMs:performance.now()-start,cards:document.querySelectorAll("[data-candidate-card]").length};},500);
    performanceResults.render_500_candidates=metric;assert(metric.cards===500&&metric.durationMs<5000,"500 candidates unusable");
  });
  await nav(page,"review");await snap(page,"long_document_review_500_409.png","500-candidate long document review",true);
  await test("25 named versions persist and list",async()=>{
    const metric=await page.evaluate(async()=>{const api=window.D1_409_TEST,start=performance.now();for(let index=0;index<25;index++)await api.saveVersion("Performance version "+index);const items=await api.listVersions();return {durationMs:performance.now()-start,count:items.length};});
    performanceResults.save_25_versions=metric;assert(metric.count===25&&metric.durationMs<5000,"25-version workflow failed");
  });
  await test("100 advisor comments remain addressable",async()=>{
    const metric=await page.evaluate(()=>{const review=window.D1_409_TEST.context.advisor,start=performance.now();for(let index=0;index<100;index++)review.addComment({body:"Synthetic advisor comment "+index});window.D1_406A_TEST.renderAll();return {durationMs:performance.now()-start,count:review.state.comments.length};});
    performanceResults.render_100_comments=metric;assert(metric.count===100&&metric.durationMs<3500,"100 comments unusable");
  });
  await test("50 media metadata items remain addressable",async()=>{
    const metric=await page.evaluate(()=>{const manager=window.D1_409_TEST.context.media,start=performance.now();for(let index=0;index<50;index++)manager.addSynthetic({id:"synthetic-media-"+index,type:"photo",placement:"perf"+index,sourceFilename:"synthetic-"+index+".png",mimeType:"image/png",size:100,width:100,height:100,contentHash:String(index).padStart(64,"0"),thumbnail:null,visibility:"FULL_STORY"});window.D1_406A_TEST.renderAll();return {durationMs:performance.now()-start,count:manager.list().length};});
    performanceResults.render_50_media=metric;assert(metric.count===50&&metric.durationMs<3500,"50 media items unusable");
  });
  await test("repeated save cycles remain stable",async()=>{
    const metric=await page.evaluate(async()=>{const api=window.D1_409_TEST,start=performance.now();for(let index=0;index<20;index++)await api.saveDraft("REPEAT_"+index);return {durationMs:performance.now()-start,sequence:api.state.persistence.saveSequence};});
    performanceResults.repeat_20_saves=metric;assert(metric.sequence>=20&&metric.durationMs<6000,"save cycles failed");
  });
  await test("version comparison remains responsive at 25 versions",async()=>{
    const metric=await page.evaluate(async()=>{const api=window.D1_409_TEST,version=(await api.listVersions())[12],start=performance.now();const diff=await api.compareVersion(version.id);return {durationMs:performance.now()-start,versionId:diff.versionId};});
    performanceResults.version_compare=metric;assert(metric.versionId&&metric.durationMs<1500,"version comparison slow");
  });
  await test("50 mock reconciliations remain stable",async()=>assert(await page.evaluate(async()=>{
    const api=window.D1_409_TEST,artifact={artifactId:"perf-artifact",artifactType:"TIMELINE_SOURCE_JSON",timelineDocumentId:"perf",idempotencyKey:"perf-key",contentHash:"a".repeat(64),studentOwnerId:"owner"},state={mode:api.modes.DUAL_WRITE,links:[],syncHistory:[]},bridge=new api.classes.FileVaultBridge({legacy:new api.classes.LegacyFileVaultAdapter(),v2:new api.classes.FileVaultV2Adapter(),state});await bridge.saveArtifact(artifact);const start=performance.now();for(let index=0;index<50;index++)await bridge.reconcile(artifact);window.__reconcileDuration409=performance.now()-start;return state.syncHistory.filter((item)=>item.action==="RECONCILE").length===50&&window.__reconcileDuration409<2500;
  }),"reconciliation loop failed"));
  performanceResults.reconcile_50=await page.evaluate(()=>({durationMs:window.__reconcileDuration409,count:50}));
  await test("canvas render duration is measured",async()=>assert(Number.isFinite(performanceResults.render_100_events.durationMs),"render metric missing"));
  await test("persistence load duration is measured",async()=>{const metric=await page.evaluate(async()=>{const start=performance.now();await window.D1_409_TEST.context.adapter.get("documents",window.D1_409_TEST.document.id);return performance.now()-start;});performanceResults.persistence_load={durationMs:metric};assert(metric>=0,"load metric missing");});
  await test("browser memory metric is recorded when available",async()=>{const memoryEnd=await page.evaluate(()=>performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize}:null);performanceResults.browser_memory=memoryStart&&memoryEnd?{start:memoryStart,end:memoryEnd,usedHeapDelta:memoryEnd.usedJSHeapSize-memoryStart.usedJSHeapSize}:{available:false};assert(!!performanceResults.browser_memory,"memory result missing");});
  await close(pair);
}

async function runAccessibilityAndVisualQa(){
  const pair=await launch({width:1440,height:900}),page=pair.page;
  await test("all navigation targets resolve",async()=>{for(const view of ["command","builder","canvas","upload","review","media","advisor","versions","export","reference"])await nav(page,view);});
  await test("navigation exposes current page state",async()=>assert(await page.locator('#rail .rtab[aria-current="page"]').count()===1,"aria-current missing"));
  await test("status region is live",async()=>assert(await page.locator("#statusLive409").getAttribute("aria-live")==="polite","live status missing"));
  await test("modal declares dialog semantics",async()=>assert(await page.locator("#modalBk").getAttribute("role")==="dialog"&&await page.locator("#modalBk").getAttribute("aria-modal")==="true","dialog semantics missing"));
  await nav(page,"versions");
  await test("409 modal receives initial keyboard focus",async()=>{await page.click('section[data-view="versions"] [data-409-action="save-version-menu"]');await page.waitForFunction(()=>document.activeElement?.id==="versionName409");});
  await test("409 modal traps Tab focus",async()=>{await page.locator("#modalIn button").last().focus();await page.keyboard.press("Tab");assert(await page.evaluate(()=>document.activeElement?.id==="versionName409"),"focus escaped modal");});
  await test("Escape closes 409 modal and restores focus",async()=>{await page.keyboard.press("Escape");assert(await page.locator("#modalBk.on").count()===0,"modal stayed open");assert(await page.evaluate(()=>document.activeElement?.closest('section[data-view="versions"]')&&document.activeElement?.dataset?.["409Action"]==="save-version-menu"),"focus not restored");});
  await test("visible focus style exists",async()=>assert(await page.evaluate(()=>{const walk=(rules)=>[...rules].flatMap((rule)=>{let nested=[];try{if(rule.styleSheet?.cssRules)nested=nested.concat(walk(rule.styleSheet.cssRules));if(rule.cssRules)nested=nested.concat(walk(rule.cssRules));}catch{}return[rule.cssText||"",...nested];});const rules=[...document.styleSheets].flatMap((sheet)=>{try{return walk(sheet.cssRules);}catch{return[];}}).join(" ");return rules.includes(":focus-visible")&&rules.includes("outline");}),"focus style missing"));
  await test("reduced-motion rule exists",async()=>assert(await page.evaluate(()=>{const walk=(rules)=>[...rules].flatMap((rule)=>{let nested=[];try{if(rule.styleSheet?.cssRules)nested=nested.concat(walk(rule.styleSheet.cssRules));if(rule.cssRules)nested=nested.concat(walk(rule.cssRules));}catch{}return[rule.cssText||"",...nested];});return[...document.styleSheets].flatMap((sheet)=>{try{return walk(sheet.cssRules);}catch{return[];}}).join(" ").includes("prefers-reduced-motion");}),"reduced motion missing"));
  await test("core controls have accessible names",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll("button")].filter((button)=>button.offsetParent!==null).every((button)=>button.getAttribute("aria-label")||button.title||button.textContent.trim())),"unnamed button found"));
  await test("visible form controls are labeled",async()=>assert(await page.evaluate(()=>[...document.querySelectorAll("input:not([type=hidden]),select,textarea")].filter((control)=>control.offsetParent!==null).every((control)=>control.closest("label")||control.getAttribute("aria-label")||document.querySelector('label[for="'+control.id+'"]'))),"unlabeled control found"));
  await test("small action buttons meet 36px minimum",async()=>assert(await page.evaluate(()=>Math.min(...[...document.querySelectorAll(".btnD.sm")].filter((node)=>node.offsetParent!==null).map((node)=>node.getBoundingClientRect().height))>=35),"small target too short"));
  await test("advisor toggles have text labels",async()=>{await nav(page,"advisor");assert(await page.evaluate(()=>[...document.querySelectorAll("#advChecks button.tglD")].every((node)=>node.getAttribute("aria-label"))),"toggle label missing");});
  await test("advisor state uses text as well as color",async()=>assert((await page.locator("#advisorWorkflow409").innerText()).includes("UNREVIEWED"),"advisor state only colored"));
  await test("FileVault state uses text as well as color",async()=>{await nav(page,"export");assert((await page.locator("#fileVault409").innerText()).includes("NO PRODUCTION WRITE"),"FileVault state only colored");});
  await test("UI has no em or en dash characters",async()=>assert(await page.evaluate(()=>!/[—–]/.test(document.body.innerText)),"dash rule violated"));
  await test("no production URL is embedded in app source",async()=>assert(await page.evaluate(()=>![...document.scripts].some((script)=>script.src.startsWith("http"))&&![...document.querySelectorAll("a")].some((link)=>link.href.startsWith("http"))),"production URL found"));
  await test("200 percent CSS zoom keeps core workspace reachable",async()=>{await page.evaluate(()=>document.documentElement.style.zoom="2");await nav(page,"versions");assert(await page.locator('section[data-view="versions"].live').count()===1,"zoom broke workspace");await snap(page,"zoom_200_versions_409.png","Versions at 200 percent zoom",true);await page.evaluate(()=>document.documentElement.style.zoom="1");});

  const viewports=[
    [1280,800,"command","empty_command_1280x800_409.png"],
    [1440,900,"media","media_1440x900_409.png"],
    [1728,1117,"advisor","advisor_1728x1117_409.png"],
    [1920,1080,"export","export_1920x1080_409.png"],
    [2560,1440,"canvas","dense_canvas_2560x1440_409.png"],
    [900,1100,"versions","versions_900x1100_409.png"],
    [768,1024,"review","review_768x1024_409.png"]
  ];
  for(const [width,height,view,name] of viewports){
    await page.setViewportSize({width,height});await nav(page,view);
    await test("responsive "+width+"x"+height+" keeps "+view+" reachable",async()=>assert(await page.locator('section[data-view="'+view+'"].live').count()===1,"responsive view missing"));
    await snap(page,name,view+" at "+width+"x"+height,false);
  }
  await test("light-on-light title contrast is absent",async()=>assert(await page.evaluate(()=>{return [...document.querySelectorAll(".trow .bigt")].filter((node)=>node.offsetParent!==null).every((node)=>{const color=getComputedStyle(node).color,background=getComputedStyle(node.closest(".trow")).backgroundColor;return color!==background;});}),"title contrast failure"));
  await test("core pages have no horizontal document overflow at tablet width",async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),"horizontal overflow"));
  await close(pair);
}

function writeReports(){
  const passed=results.filter((item)=>item.status==="PASS").length,failed=results.length-passed;
  const payload={generatedAt:new Date().toISOString(),total:results.length,passed,failed,consoleErrors,requestFailures,unexpectedRequests:[...new Set(unexpectedRequests)],results,screenshots};
  fs.writeFileSync(path.join(EVIDENCE,"test_results_409.json"),JSON.stringify(payload,null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"performance_results_409.json"),JSON.stringify(performanceResults,null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"viewport_manifest_409.json"),JSON.stringify({generatedAt:payload.generatedAt,screenshots},null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"console_error_audit_409.json"),JSON.stringify({errors:consoleErrors,count:consoleErrors.length},null,2)+"\n");
  fs.writeFileSync(path.join(EVIDENCE,"network_request_audit_409.json"),JSON.stringify({requestFailures,unexpectedRequests:[...new Set(unexpectedRequests)]},null,2)+"\n");
  const lines=["# D1-409 Foundation Test Results","","- Total: "+results.length,"- Passed: "+passed,"- Failed: "+failed,"- Console errors: "+consoleErrors.length,"- Request failures: "+requestFailures.length,"- Unexpected network requests: "+new Set(unexpectedRequests).size,"","| Status | Test | Duration | Notes |","|---|---|---:|---|"];
  results.forEach((item)=>lines.push("| "+item.status+" | "+item.name.replace(/\|/g,"/")+" | "+item.durationMs+" ms | "+String(item.notes||"").replace(/\|/g,"/").replace(/\n/g," ")+" |"));
  fs.writeFileSync(path.join(EVIDENCE,"test_results_409.md"),lines.join("\n")+"\n");
  return payload;
}

async function main(){
  browser=await chromium.launch({headless:true,channel:"chrome",args:["--allow-file-access-from-files"]});
  await runBootAndMigration();
  await runPersistenceAndRecovery();
  await runMedia();
  const artifacts=await runAdvisorAndExports();
  await runFileVault(artifacts);
  await runPerformanceAndDensity();
  await runAccessibilityAndVisualQa();
  await test("zero console errors",async()=>assert(consoleErrors.length===0,consoleErrors.slice(0,5).join("; ")));
  await test("zero request failures",async()=>assert(requestFailures.length===0,JSON.stringify(requestFailures.slice(0,5))));
  await test("zero unexpected network requests",async()=>assert(new Set(unexpectedRequests).size===0,[...new Set(unexpectedRequests)].slice(0,5).join("; ")));
  await browser.close();
  const payload=writeReports();
  console.log(JSON.stringify({total:payload.total,passed:payload.passed,failed:payload.failed,consoleErrors:payload.consoleErrors.length,requestFailures:payload.requestFailures.length,unexpectedRequests:payload.unexpectedRequests.length,screenshots:payload.screenshots.length}));
  if(payload.failed)process.exitCode=1;
}

main().catch(async(error)=>{
  console.error(error);
  try{await browser?.close();}catch{}
  writeReports();
  process.exitCode=1;
});
