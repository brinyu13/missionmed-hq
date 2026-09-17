import {createTimelineDocumentFromLegacy,createVersionRecord,restoreLegacySnapshot} from "./state.js";
import {layoutTimeline,applyLayoutToLegacy,resetManualLayout} from "./layout-engine.js";
import {validateDocument} from "./validators.js";
import {FIXTURE_DEFINITIONS,loadFixtureById} from "./fixtures.js";
import {renderWarningPanel,renderVersionTools,markCrowdedElements} from "./renderers.js";

export function install407Bridge(api){
  if(!api)throw new Error("406A API missing; cannot install 407 bridge.");
  const ctx={api,document:null,layout:null,warnings:[],versions:api.state.__407Versions||[]};
  api.state.__407Versions=ctx.versions;
  const sync=()=>{
    ctx.document=createTimelineDocumentFromLegacy(api.state,api.CATS);
    ctx.layout=layoutTimeline(ctx.document);
    applyLayoutToLegacy(ctx.layout,api.state);
    ctx.warnings=validateDocument(ctx.document,ctx.layout);
    api.state.__407Document=ctx.document;
    api.state.__407Layout=ctx.layout;
    api.state.__407Warnings=ctx.warnings;
  };
  window.D1_407_HARDENING.beforeRenderAll=sync;
  window.D1_407_HARDENING.afterRenderAll=()=>injectDiagnostics(ctx);
  installDelegates(ctx);
  sync();
  exposeTestApi(ctx);
  api.renderAll();
}

function injectDiagnostics(ctx){
  const inspector=document.querySelector("#inspector");
  if(inspector&&!document.querySelector("#d1_407_warnings")){
    inspector.insertAdjacentHTML("beforeend",renderWarningPanel(ctx.warnings,ctx.layout));
  }
  const hist=document.querySelector("#histList");
  if(hist&&!document.querySelector("#d1_407_tools")){
    hist.insertAdjacentHTML("afterend",renderVersionTools(ctx.versions,FIXTURE_DEFINITIONS));
  }
  const msg=document.querySelector("#ctlMsg");
  if(msg&&ctx.layout?.stats){
    msg.textContent=`407 LAYOUT · ${ctx.layout.stats.visibleEvents} VISIBLE · ${ctx.layout.stats.laneCount} LANES · AXIS LOCKED TO MONTHS`;
  }
  markCrowdedElements(ctx.layout);
}

function installDelegates(ctx){
  if(window.__D1_407_DELEGATES)return;
  window.__D1_407_DELEGATES=true;
  document.addEventListener("click",(event)=>{
    const action=event.target.closest("[data-407-action]")?.dataset?.["407Action"];
    if(!action)return;
    if(action==="save-version")saveVersion(ctx,"407 manual version");
    if(action==="restore-version")restoreLatest(ctx);
    if(action==="export-json")downloadJson(ctx);
    if(action==="load-fixture")loadSelectedFixture(ctx);
    if(action==="reset-layout"){resetManualLayout(ctx.api.state);ctx.api.state.saved=false;ctx.api.renderAll();}
  });
  document.addEventListener("change",(event)=>{
    const file=event.target.closest("[data-407-file='import-json']")?.files?.[0];
    if(!file)return;
    file.text().then((text)=>importJson(ctx,text));
  });
}

function saveVersion(ctx,label){
  const version=createVersionRecord(label,ctx.document,ctx.api.state,ctx.api.CATS);
  ctx.versions.push(version);
  ctx.api.state.draft++;
  ctx.api.state.versions.push({v:`V${ctx.api.state.draft}`,t:label,n:ctx.document.events.length});
  ctx.api.state.saved=true;
  ctx.api.renderAll();
  return version;
}

function restoreLatest(ctx){
  const version=ctx.versions[ctx.versions.length-1];
  if(!version)return null;
  restoreLegacySnapshot(ctx.api.state,version.legacySnapshot,version.categorySnapshot,ctx.api.CATS);
  ctx.api.state.saved=true;
  ctx.api.renderAll();
  return version;
}

function exportJson(ctx){
  return JSON.stringify(ctx.document,null,2);
}

function downloadJson(ctx){
  const blob=new Blob([exportJson(ctx)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download="d1-timeline-document-sandbox.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),250);
}

function importJson(ctx,text){
  const doc=JSON.parse(text);
  ctx.api.state.user.events=(doc.events||[]).map((event)=>({
    id:event.id,
    t:event.title,
    cat:event.categoryId,
    mile:event.eventType==="milestone",
    s:event.startDate,
    e:event.eventType==="milestone"?null:event.endDate,
    vis:event.visibility||"public",
    loc:event.siteName||event.location||"",
    origin:event.sourceType||"json",
    notes:event.notes||"",
    lane:event.lane==null?null:event.lane,
    manualOffset:event.manualOffset||null,
    canonicalType:event.canonicalType||null,
    provenance:event.provenance||null,
    sourceCandidateId:event.sourceCandidateId||null,
    sourceDocumentIds:event.sourceDocumentIds||[],
    datePrecision:event.datePrecision||null,
    humanCorrection:event.humanCorrection||null,
    confidence:event.confidence||null
  }));
  if(doc.ingestion||doc.sourceDocuments||doc.extractionCandidates){
    ctx.api.state.__408Ingestion={
      schemaVersion:doc.ingestion?.schemaVersion||"d1-ingestion-408.1",
      parserVersion:doc.ingestion?.parserVersion||"408.1.0",
      status:doc.ingestion?.status||"READY_FOR_REVIEW",
      statusDetail:"Imported from a local TimelineDocument JSON snapshot.",
      activeDocumentId:doc.ingestion?.activeDocumentId||null,
      sourceDocuments:doc.sourceDocuments||[],
      documentPages:doc.documentPages||[],
      sourceBlocks:doc.sourceBlocks||[],
      extractionCandidates:doc.extractionCandidates||[],
      candidateDuplicateGroups:doc.candidateDuplicateGroups||[],
      candidateConflicts:doc.candidateConflicts||[],
      humanReviewActions:doc.humanReviewActions||[],
      timelineEventSourceLinks:doc.timelineEventSourceLinks||[],
      processingHistory:[],
      lastError:null,
      filters:{status:"ALL",confidence:"ALL",type:"ALL"},
      updatedAt:new Date().toISOString()
    };
  }
  ctx.api.state.mode="blank";
  ctx.api.state.sel=null;
  ctx.api.state.saved=false;
  ctx.api.renderAll();
  return doc;
}

function loadSelectedFixture(ctx){
  const select=document.querySelector("[data-407-action='fixture']");
  const id=select?.value||"fx5";
  return loadFixture(ctx,id);
}

function loadFixture(ctx,id){
  const {definition,events}=loadFixtureById(id);
  ctx.api.state.user={events,interview:{prog:"Fixture Review",date:"2026-12",label:`${definition.label.toUpperCase()} QA`}};
  ctx.api.state.mode="blank";
  ctx.api.state.safe=false;
  ctx.api.state.sel=null;
  ctx.api.state.saved=false;
  document.querySelectorAll("#modeSeg button").forEach((button)=>button.classList.toggle("on",button.dataset.m==="blank"));
  ctx.api.go("canvas");
  ctx.api.renderAll();
  return events;
}

function exposeTestApi(ctx){
  window.D1_407_TEST={
    version:"407",
    get document(){return ctx.document;},
    get layout(){return ctx.layout;},
    get warnings(){return ctx.warnings;},
    fixtures:FIXTURE_DEFINITIONS,
    sync:()=>{window.D1_407_HARDENING.beforeRenderAll();return ctx.document;},
    saveVersion:(label="407 test version")=>saveVersion(ctx,label),
    restoreLatest:()=>restoreLatest(ctx),
    exportDocumentJson:()=>exportJson(ctx),
    importDocumentJson:(text)=>importJson(ctx,text),
    loadFixture:(id)=>loadFixture(ctx,id),
    resetToDates:()=>{resetManualLayout(ctx.api.state);ctx.api.renderAll();},
    validate:()=>validateDocument(ctx.document,ctx.layout),
    layoutTimeline:(doc=ctx.document)=>layoutTimeline(doc)
  };
}
