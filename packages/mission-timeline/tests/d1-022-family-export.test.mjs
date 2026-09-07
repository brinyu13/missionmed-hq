import assert from "node:assert/strict";
import test from "node:test";
import {familyPresentationSnapshot} from "../web/js/family-022.js";
import {buildExportReadiness, renderExportScreen, installExportScreen, EXPORT_FORMATS, EXPORT_FORMAT_PRESENTATION} from "../web/js/uxr-002/export-screen.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const actor={id:"wp-founder-022",displayName:"Dr Brian",initials:"BB"};
const authenticated={status:"authenticated",actor,capabilities:{adminWorkspace:true}};
const receipt={responseId:"resp_synthetic_unit_022",model:"unit-test-model",store:false,inputSha256:"a".repeat(64),outputSha256:"b".repeat(64)};
function fixture(){const doc=defaultDocument();doc.revision=9;doc.studentProfile.fullName="Synthetic Reviewer";doc.events=[{id:"education-022",title:"Synthetic medical degree",categoryId:"education",eventType:"duration",startDate:"2020-01",endDate:"2024-01",visibilityState:"INTERVIEWER_SAFE"}];return doc;}
function report(){return {schemaVersion:"d1-timeline-quality-guardian.1",generatedFromRevision:9,state:"READY",findings:[],ai:{status:"COMPLETE",providerReceipt:receipt}};}

test("022 role presentation ignores browser lenses and unauthenticated capability claims",()=>{
 for(const session of [{status:"denied",actor,capabilities:{adminWorkspace:true}},{status:"authenticated",role:"admin",actor},{status:"authenticated",actor:{displayName:"Dr Brian"},capabilities:{adminWorkspace:true}}]){
  const state=familyPresentationSnapshot({session,role:"admin",admin:true,prototypeLens:"founder"});
  assert.equal(state.admin,false);assert.equal(state.subject,null);
 }
 assert.equal(familyPresentationSnapshot({session:authenticated}).admin,true);
});

test("022 selected-student presentation retains the actual administrator actor",()=>{
 const subject={id:"wp-synthetic-student-022",displayName:"Synthetic Student",initials:"SS",canEdit:false};
 const state=familyPresentationSnapshot({session:{...authenticated,subject}});
 assert.equal(state.actor.id,actor.id);assert.equal(state.subject.id,subject.id);assert.equal(state.roleLabel,"Administrator");
 assert.equal(familyPresentationSnapshot({session:{...authenticated,capabilities:{},subject}}).subject,null);
});

test("022 cloud sync wording requires an authenticated principal and a server acknowledgement",()=>{
 const sync={state:"synced",acknowledgedAt:"2026-09-07T10:00:00Z"};
 assert.equal(familyPresentationSnapshot({session:authenticated,sync}).syncLabel,"Saved & synced");
 for(const snapshot of [{sync},{session:authenticated,sync:{state:"synced"}},{session:authenticated,sync:{state:"synced",acknowledgedAt:"bad-date"}},{session:authenticated,sync:{state:"saving",acknowledgedAt:sync.acknowledgedAt}}]){
  assert.equal(familyPresentationSnapshot(snapshot).synced,false);
  assert.notEqual(familyPresentationSnapshot(snapshot).syncLabel,"Saved & synced");
 }
 assert.equal(familyPresentationSnapshot({session:authenticated,sync:{state:"conflict"}}).syncLabel,"Save conflict · review needed");
});

test("022 local diagnostic presentation requires the actual local fixture context",()=>{
 assert.equal(familyPresentationSnapshot({mode:"local-fixture"}).local,false);
 assert.equal(familyPresentationSnapshot({mode:"production"},{localFixture:true}).local,false);
 assert.equal(familyPresentationSnapshot({mode:"local-fixture"},{localFixture:true}).local,true);
});

test("022 Export rejects absent or stale Guardian readiness after any document revision",()=>{
 const doc=fixture();assert.equal(buildExportReadiness(doc).state,"UNCHECKED");
 const quality=report();assert.equal(buildExportReadiness(doc,quality).ai,true);
 doc.revision++;const stale=buildExportReadiness(doc,quality);assert.equal(stale.state,"UNCHECKED");assert.equal(stale.ai,false);assert.deepEqual(stale.findings,[]);
});

test("022 Export requires complete provider evidence before displaying AI review",()=>{
 const doc=fixture();
 for(const patch of [{store:true},{responseId:""},{model:""},{inputSha256:"abc"},{outputSha256:""}]){
  const quality=report();quality.ai.providerReceipt={...receipt,...patch};quality.findings=[{basis:"AI REVIEW",message:"Unverified AI wording",section:"CONTENT"}];
  assert.equal(buildExportReadiness(doc,quality).ai,false);
  const html=renderExportScreen(doc,{readiness:quality});assert.doesNotMatch(html,/AI review receipt|Unverified AI wording/);
 }
 const quality=report();quality.ai.status="UNAVAILABLE";assert.equal(buildExportReadiness(doc,quality).ai,false);
});

test("022 Export retains export blockers with direct Guardian review and keeps source facts unchanged",()=>{
 const doc=fixture(),before=structuredClone(doc),quality=report();quality.state="BLOCKED";quality.findings=[{id:"rule-022",basis:"MISSIONMED RULE",section:"EXPORT",severity:"BLOCK_EXPORT",actionMode:"REVIEW",message:"Review the missing student detail."}];
 const html=renderExportScreen(doc,{readiness:quality});assert.match(html,/Review the missing student detail/);assert.match(html,/data-export-quality-finding="rule-022"/);assert.match(html,/Review in Guardian/);assert.deepEqual(doc,before);
});

test("022 Export presents every real format and an honest editable PowerPoint-to-Keynote pathway",()=>{
 const doc=fixture(),html=renderExportScreen(doc,{previewHtml:'<svg data-synthetic-preview="true"></svg>'});
 assert.equal((html.match(/name="export-format"/g)||[]).length,5);
 for(const format of EXPORT_FORMATS){assert.ok(EXPORT_FORMAT_PRESENTATION[format.id]);assert.ok(html.includes(`value="${format.id}"`));}
 assert.ok(html.indexOf("data-synthetic-preview")<html.indexOf("Choose your format"));
 assert.match(html,/data-export-keynote-select/);assert.match(html,/The browser downloads \.pptx/);assert.match(html,/A native \.key file is created by Keynote when you save it/);
 assert.match(html,/data-export-progress hidden/);assert.match(html,/data-quality-guardian-open="true"/);
});

test("022 export history displays only completed downloads and safely escapes names",()=>{
 const html=renderExportScreen(fixture(),{exportHistory:[{downloaded:true,filename:"<synthetic>.png",exportedAt:"2026-09-07T10:00:00Z"},{downloaded:false,filename:"failed.png",exportedAt:"2026-09-07T10:00:00Z"},{downloaded:true,filename:"invalid.png",exportedAt:"invalid"}]});
 assert.match(html,/&lt;synthetic&gt;\.png/);assert.doesNotMatch(html,/failed\.png|invalid\.png/);
});


class ExportButton022{
 constructor(){this.listeners=new Map();this.disabled=false;this.textContent="Export PNG";}
 addEventListener(type,handler){this.listeners.set(type,handler);}
 setAttribute(){}
 async click(){await this.listeners.get("click")?.({currentTarget:this});}
}
function installDownloadCase({executionMode="local",onExportComplete=()=>{},downloaded=true,requestVersion=async()=>{}}={}){
 const button=new ExportButton022(),messages=[],progress={hidden:true};
 const root={querySelector:(selector)=>selector==="[data-export-action]"?button:selector==="[data-export-progress]"?progress:null,querySelectorAll:()=>[]};
 installExportScreen(root,fixture(),{entitlement:{canExport:true,canMutate:true},exportAdapter:{executionMode,generate:async()=>({}),download:async()=>({downloaded})},requestVersion,onExportComplete,toast:(message)=>messages.push(message)});
 return {button,messages,progress};
}

test("022 export completion callback runs only after a verified downloaded result",async()=>{
 let received=null;const actual=installDownloadCase({onExportComplete:async(result)=>{assert.equal(actual.progress.hidden,false);received=result;}});await actual.button.click();
 assert.equal(received.completed,true);assert.equal(received.metadata.downloaded,true);assert.equal(actual.progress.hidden,true);
 for(const options of [{executionMode:"simulated"},{downloaded:false}]){
  let callbacks=0;const incomplete=installDownloadCase({...options,onExportComplete:()=>{callbacks++;}});await incomplete.button.click();assert.equal(callbacks,0);
 }
});

test("022 history sync failure preserves a completed download and reports the separate problem",async()=>{
 const result=installDownloadCase({onExportComplete:async()=>{throw new Error("synthetic history unavailable");}});await result.button.click();
 assert.match(result.messages[0],/^Exported · /);assert.equal(result.messages[1],"File downloaded. Export history could not sync.");assert.ok(!result.messages.includes("Export failed — try again"));assert.equal(result.button.disabled,false);assert.equal(result.progress.hidden,true);
});


test("022 version persistence failure after a download never claims the file failed",async()=>{
 let callbacks=0;const result=installDownloadCase({requestVersion:async()=>{throw new Error("synthetic saved version failed");},onExportComplete:()=>{callbacks++;}});await result.button.click();
 assert.deepEqual(result.messages,["File downloaded. Its saved version needs attention."]);assert.equal(callbacks,0);assert.equal(result.button.disabled,false);
});


test("022 a verified current content fingerprint preserves Guardian across server save revisions",()=>{
 const doc=fixture(),quality=report();doc.revision=71;
 assert.equal(buildExportReadiness(doc,quality).current,false);
 assert.equal(buildExportReadiness(doc,quality,{readinessCurrent:true}).ai,true);
 assert.match(renderExportScreen(doc,{readiness:quality,readinessCurrent:true}),/AI review receipt/);
 assert.doesNotMatch(renderExportScreen(doc,{readiness:quality,readinessCurrent:false}),/AI review receipt/);
 doc.revision=quality.generatedFromRevision;
 assert.equal(buildExportReadiness(doc,quality,{readinessCurrent:false}).state,"UNCHECKED");
 quality.ai.providerReceipt={...receipt,store:true};assert.equal(buildExportReadiness(doc,quality,{readinessCurrent:true}).ai,false);
});
