import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

import {
  STUDENT_FALLBACKS,
  isStudentSafe,
  studentAccessMessage,
  studentDiagnostic,
  studentError,
  studentMessage
} from "../web/js/uxr-002/student-language.js";
import {
  evaluateTimelineEntitlement,
  entitlementStatusMarkup,
  resolveConfiguredEntitlement
} from "../web/js/uxr-002/entitlement.js";
import {mediaLibraryMarkup} from "../web/js/uxr-002/media-library.js";
import {
  RESPONSIVE_BANNER,
  buildResponsiveModel,
  renderResponsiveNotice
} from "../web/js/uxr-002/responsive.js";
import {IntakeStateMachine} from "../web/js/uxr-002/intake.js";

const adapter=await readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
const index=await readFile(new URL("../web/index.html",import.meta.url),"utf8");

/* Every term the shell is not allowed to say to a student. */
const BANNED=[
  /\bcanonical\w*/i,
  /\bkernels?\b/i,
  /D1-409H/i,
  /D1-411A/i,
  /\bfingerprints?\b/i,
  /\bprincipals?\b/i,
  /\brenderers?\b/i,
  /\brevisions?\b/i,
  /\buuid\b/i,
  /SERVICE/,
  /\badapters?\b/i,
  /\bprojections?\b/i,
  /\bsurfaces?\b/i,
  /\btaxonom(?:y|ies)\b/i,
  /\bingestion\b/i,
  /\bprovenance\b/i,
  /\bentitlements?\b/i,
  /\brls\b/i,
  /object key/i,
  /signed url/i,
  /TEXT_FIT_UNRESOLVED/,
  /OBJECT_OUT_OF_BOUNDS/,
  /EXISTING_LAYOUT_OVERLAP_RECOVERED/,
  /ASSET_LOAD_FAILED/
];

const bannedTermIn=(text)=>BANNED.find((pattern)=>pattern.test(String(text||"")))||null;

test("E-05 the translation layer replaces internal error language and keeps the original for support",()=>{
  const cases=[
    "D1-411A kernel projection is unavailable.",
    "Protected D1-409H-A1 kernel was not loaded.",
    "Canonical timeline frame failed to load.",
    "IndexedDB transaction aborted.",
    "A generated Blob is required.",
    "406A API missing; cannot install 407 bridge.",
    "Timeline source authorization did not return an object ID."
  ];
  for(const raw of cases){
    const message=studentMessage(raw);
    assert.equal(bannedTermIn(message),null,`${raw} still leaks: ${message}`);
    assert.notEqual(message,raw);
    assert.match(message,/[a-z]\.$|[a-z]\.\s|again\.$/);
  }
  const error=Object.assign(new Error("D1-411A kernel projection is unavailable."),{
    code:"KERNEL_PROJECTION_UNAVAILABLE"
  });
  const translated=studentError(error,{context:"open"});
  assert.equal(bannedTermIn(translated.message),null);
  assert.equal(translated.diagnostic,"KERNEL_PROJECTION_UNAVAILABLE: D1-411A kernel projection is unavailable.");
  assert.equal(studentDiagnostic("plain failure"),"plain failure");
});

test("E-05 engine failure codes become the sentence a student can act on",()=>{
  assert.match(studentMessage({code:"TEXT_FIT_UNRESOLVED"}),/fits/i);
  assert.match(studentMessage({code:"OBJECT_OUT_OF_BOUNDS"}),/Move this item/i);
  assert.match(studentMessage({code:"EXISTING_LAYOUT_OVERLAP_RECOVERED"}),/kept your previous layout/i);
  assert.match(studentMessage({code:"ASSET_LOAD_FAILED"}),/image/i);
  assert.match(studentMessage({code:"INDEXED_DB_UNAVAILABLE"}),/saving on this device/i);
  for(const code of [
    "TEXT_FIT_UNRESOLVED",
    "OBJECT_OUT_OF_BOUNDS",
    "EXISTING_LAYOUT_OVERLAP_RECOVERED",
    "ASSET_LOAD_FAILED",
    "INDEXED_DB_UNAVAILABLE"
  ]){
    assert.equal(bannedTermIn(studentMessage({code})),null);
  }
  for(const fallback of Object.values(STUDENT_FALLBACKS))assert.equal(bannedTermIn(fallback),null);
});

test("E-05 messages that already speak to students pass through untouched",()=>{
  for(const safe of [
    "Choose a specialty.",
    "Keep the explanation to 240 characters.",
    "Timeline is still syncing. Try returning to Matrix again in a moment.",
    "Those items are too close together. We kept your last layout so you can move one and try again."
  ]){
    assert.equal(isStudentSafe(safe),true);
    assert.equal(studentMessage(safe),safe);
  }
});

test("E-05 no adapter call site toasts a raw error message any more",()=>{
  assert.doesNotMatch(adapter,/bridge\.toast\(String\(error\?\.message\|\|error\)\)/);
  assert.doesNotMatch(adapter,/bridge\.toast\(store\.entitlement\.reason\)/);
  assert.match(adapter,/const toastStudentError=\(error,context="generic"\)=>\{/);
  assert.match(adapter,/bridge\.toast\(translated\.message,\{tone:"danger",diagnostic:translated\.diagnostic\}\)/);
  /* The invariant is that every catch routes through the translator, not that there is
     some particular number of them - a new handler must not fail this test for existing. */
  assert.ok((adapter.match(/toastStudentError\(error/g)||[]).length>=29);
  const rawCatchToasts=adapter.match(/catch\s*\([^)]*\)\s*\{[^}]*bridge\.toast\([^)]*error[^)]*\)/g)||[];
  assert.deepEqual(rawCatchToasts,[],"a catch block must never toast the error itself");
});

test("E-04 denial banners, tooltips and toasts never repeat the configuration rule",()=>{
  const configured=resolveConfiguredEntitlement({userId:"u1",roles:["subscriber"]},{});
  assert.match(configured.reason,/WordPress/);
  const access=evaluateTimelineEntitlement({
    schemaVersion:"d1-405.timeline-entitlement.1",
    verified:true,
    eligible:configured.eligible,
    allowance:configured.allowance,
    currentUsage:0,
    reason:configured.reason,
    denialCode:configured.denialCode
  },{mode:"local",hasExistingTimeline:false});
  const status=entitlementStatusMarkup(access);
  assert.equal(bannedTermIn(status.reason),null);
  assert.doesNotMatch(status.reason,/WordPress|cohort|promotion|membership level/i);
  assert.match(status.reason,/Contact MissionMed/);
  assert.equal(status.diagnosticReason,configured.reason);
  for(const code of [
    "ENTITLEMENT_GLOBALLY_DISABLED",
    "NO_MATCHING_ENTITLEMENT",
    "ENTITLEMENT_EXPIRED",
    "ZERO_TIMELINE_ALLOWANCE",
    "TIMELINE_ALLOWANCE_REACHED",
    "PRODUCTION_ENTITLEMENT_UNVERIFIED",
    "UNKNOWN_FUTURE_CODE"
  ]){
    assert.equal(bannedTermIn(studentAccessMessage(code)),null,code);
  }
  assert.match(studentAccessMessage(""),/full access/i);
});

test("E-06 an adapter failure reaches the CV dropzone field error already in student language",async()=>{
  const boundary=/const studentSafeIntakeAdapter=Object\.freeze\(\{[\s\S]*?studentError\(error,\{context:"document"\}\)/;
  assert.match(adapter,boundary);
  assert.match(adapter,/adapter:studentSafeIntakeAdapter,/);

  const wrap=(inner)=>Object.freeze({...inner,async extract(input){
    try{return await inner.extract(input);}
    catch(error){
      if(error?.name==="AbortError")throw error;
      const translated=studentError(error,{context:"document"});
      const safe=new Error(translated.message);
      safe.code=translated.code||"DOCUMENT_UNREADABLE";
      safe.diagnostic=translated.diagnostic;
      throw safe;
    }
  }});
  const file={name:"cv.pdf",type:"application/pdf",size:2048};
  const run=async(intakeAdapter)=>{
    const machine=new IntakeStateMachine({adapter:intakeAdapter});
    machine.receiveFile(file);
    machine.setConsent(true);
    try{await machine.startExtraction();}catch{}
    return machine.snapshot();
  };
  const failure=Object.assign(new Error("D1-411A kernel projection is unavailable."),{
    code:"KERNEL_PROJECTION_UNAVAILABLE"
  });
  const bare=await run({async extract(){throw failure;}});
  assert.equal(bare.fileError,"D1-411A kernel projection is unavailable.");
  const guarded=await run(wrap({capability:{mode:"test"},async extract(){throw failure;}}));
  assert.equal(bannedTermIn(guarded.fileError),null);
  assert.match(guarded.fileError,/still getting ready/i);
});

test("E-07 the toast is a polite live region, and problems wait to be dismissed",()=>{
  assert.match(
    index,
    /<div id="toast" role="status" aria-live="polite" aria-atomic="true"><span id="toastText"><\/span><button type="button" id="toastDismiss" hidden>Dismiss<\/button><\/div>/
  );
  const start=index.indexOf("let toastT=null;");
  const end=index.indexOf("$('#toastDismiss').onclick=dismissToast;");
  assert.ok(start>=0&&end>start);
  const source=index.slice(start,end+"$('#toastDismiss').onclick=dismissToast;".length);

  const element=(id)=>{
    const node={id,textContent:"",hidden:false,dataset:{},classes:new Set()};
    node.classList={
      add:(name)=>node.classes.add(name),
      remove:(name)=>node.classes.delete(name),
      toggle:(name,on)=>{if(on)node.classes.add(name);else node.classes.delete(name);}
    };
    return node;
  };
  const nodes={"#toast":element("toast"),"#toastText":element("toastText"),"#toastDismiss":element("toastDismiss")};
  let scheduled=[];
  const api=new Function(
    "$","setTimeout","clearTimeout",
    `${source}\nreturn{toast,dismissToast};`
  )((selector)=>nodes[selector],(fn,ms)=>scheduled.push(ms),()=>{});

  api.toast("Timeline updated");
  assert.equal(nodes["#toastText"].textContent,"Timeline updated");
  assert.equal(nodes["#toastDismiss"].hidden,true);
  assert.deepEqual(scheduled,[2600]);

  scheduled=[];
  api.toast("We couldn't save just now.",{tone:"danger",diagnostic:"INDEXED_DB_UNAVAILABLE: IndexedDB request failed."});
  assert.equal(nodes["#toast"].classes.has("isPersistent"),true);
  assert.equal(nodes["#toastDismiss"].hidden,false);
  assert.deepEqual(scheduled,[]);
  assert.equal(nodes["#toast"].dataset.diagnostic,"INDEXED_DB_UNAVAILABLE: IndexedDB request failed.");

  api.dismissToast();
  assert.equal(nodes["#toast"].classes.has("on"),false);
  assert.equal(nodes["#toastDismiss"].hidden,true);
});

test("E-10 the small-screen notice is rendered wherever editing is switched off",()=>{
  assert.match(index,/<div id="canvasResponsiveNotice407F"><\/div>/);
  assert.match(adapter,/const renderCanvasResponsiveNotice=\(\)=>\{/);
  assert.match(adapter,/if\(view==="canvas"\)\{\s*renderCanvasResponsiveNotice\(\);/);
  assert.match(adapter,/canvasController\?\.setResponsiveWidth\(model\.viewport\.width\);\s*renderCanvasResponsiveNotice\(\);/);
  const phone=renderResponsiveNotice(buildResponsiveModel({width:375,height:812}),"canvas");
  assert.match(phone,/responsive407FBanner/);
  assert.match(phone,new RegExp(`>${RESPONSIVE_BANNER.replace(/\./g,"\\.")}<`));
  assert.equal(renderResponsiveNotice(buildResponsiveModel({width:1440,height:900}),"canvas"),"");
  assert.equal(bannedTermIn(RESPONSIVE_BANNER),null);
});

test("E-11 the boot gate speaks to students, times out, and offers a way forward",()=>{
  assert.match(index,/<div id="d1HydrationGate" role="status" aria-live="polite">Getting your timeline ready…<\/div>/);
  assert.doesNotMatch(index,/Loading local timeline/);
  const start=index.indexOf("(function(){\n  var armed=true");
  assert.ok(start>=0);
  const source=index.slice(start,index.indexOf("})();",start)+5);

  const build=(hydrating)=>{
    const gate={innerHTML:"",classes:new Set()};
    gate.classList={add:(name)=>gate.classes.add(name),contains:(name)=>gate.classes.has(name)};
    const root={classList:{contains:(name)=>hydrating&&name==="d1-hydrating"}};
    const listeners={};
    const timers=[];
    new Function("document","window","setTimeout","clearTimeout",source)(
      {
        getElementById:(id)=>id==="d1HydrationGate"?gate:{},
        addEventListener:(name,fn)=>{listeners[`document:${name}`]=fn;},
        documentElement:root
      },
      {addEventListener:(name,fn)=>{listeners[`window:${name}`]=fn;},location:{reload(){}}},
      (fn,ms)=>timers.push({fn,ms}),
      ()=>{}
    );
    return{gate,listeners,timers};
  };

  const stalled=build(true);
  assert.deepEqual(stalled.timers.map(({ms})=>ms),[15000]);
  stalled.timers[0].fn();
  assert.equal(stalled.gate.classes.has("d1Recovery"),true);
  const recoveryText=stalled.gate.innerHTML.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  assert.equal(bannedTermIn(recoveryText),null);
  assert.match(recoveryText,/still safe/);
  assert.match(recoveryText,/Try again/);

  const booted=build(true);
  booted.listeners["document:d1:407f-engineering-ready"]();
  booted.timers[0].fn();
  assert.equal(booted.gate.classes.has("d1Recovery"),false);

  const blocked=build(true);
  blocked.listeners["window:error"]({});
  assert.equal(blocked.timers.at(-1).ms,2500);
  blocked.timers.at(-1).fn();
  assert.equal(blocked.gate.classes.has("d1Recovery"),true);

  const live=build(false);
  live.listeners["window:unhandledrejection"]({});
  live.timers.at(-1).fn();
  assert.equal(live.gate.classes.has("d1Recovery"),false);
});

test("E-12 the media library calls an image an image",()=>{
  const asset={id:"a1",type:"media",fileType:"image",placed:false,source:{name:"rotation.png"}};
  for(const html of [mediaLibraryMarkup([asset],{resolveObjectUrl:()=>"blob:x"}),mediaLibraryMarkup([])]){
    const visible=html.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    assert.doesNotMatch(visible,/\basset\b/i);
    assert.equal(bannedTermIn(visible),null);
  }
  assert.match(mediaLibraryMarkup([asset]),/>Replace image</);
  assert.match(mediaLibraryMarkup([asset]),/>Delete image</);
  assert.doesNotMatch(adapter,/>Delete asset</);
  assert.doesNotMatch(adapter,/"Media asset replaced"/);
  assert.doesNotMatch(adapter,/"Media asset permanently deleted"/);
});

test("A8 the Advanced Studio text field puts the caret back after the inspector rebuild",()=>{
  assert.match(adapter,/onTextContent:\(text,target,event\)=>\{/);
  assert.match(adapter,/const caret=field\?\.selectionStart\?\?null;/);
  assert.match(
    adapter,
    /const restored=canvasHost\?\.querySelector\?\.\("\[data-advanced-text-content\]"\);[\s\S]*?restored\.setSelectionRange\?\.\(caret,caret\)/
  );
});

test("undo announcements no longer read out internal build labels",()=>{
  assert.doesNotMatch(adapter,/"407F canonical UI change"/);
  assert.doesNotMatch(adapter,/"407F page exit"/);
  assert.doesNotMatch(adapter,/"Normalize canonical exam workflow"/);
  const labels=new Set();
  for(const match of adapter.matchAll(/store\.(?:mutate|mutateWithBlobs)\(\s*"([^"]+)"/g))labels.add(match[1]);
  for(const match of adapter.matchAll(/label:\s*"([^"]+)"/g))labels.add(match[1]);
  assert.ok(labels.size>40);
  for(const label of labels)assert.equal(bannedTermIn(label),null,label);
});
