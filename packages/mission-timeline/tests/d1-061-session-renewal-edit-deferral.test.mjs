// TL-AAA-STABILIZE-20261013 (Silma): an edit refused while the 120 s session token is being
// renewed is kept, renewal is requested at once, the student is told, and the kept edit
// replays when the renewed claims arrive. Uses the actual adapter seams.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {TimelineStore,TimelineEntitlementError} from "../web/js/uxr-002/store.js";
import {MemoryPersistenceAdapter} from "../web/js/persistence/memory-adapter.js";
import {studentError} from "../web/js/uxr-002/student-language.js";

// Long-lived store timers (entitlement expiry, autosave) must not pin the test process.
const nativeSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(callback,delay,...args)=>{const timer=nativeSetTimeout(callback,delay,...args);if(Number(delay)>10000)timer.unref?.();return timer;};
const source=fs.readFileSync(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
const seam=source.match(/const deferredSessionEdits=\[\];([\s\S]*?)const replayDeferredSessionEdits=\(\)=>\{([\s\S]*?)\n  \};/);
assert.ok(seam,"Use the actual deferral seam from the production adapter");
const body=`const deferredSessionEdits=[];${seam[1]}const replayDeferredSessionEdits=()=>{${seam[2]}\n  };return {runOrDeferSessionEdit,replayDeferredSessionEdits,deferredSessionEdits,awaitSessionRenewal};`;
const wire=new Function("store","bridge","productionRuntime","toastStudentError","syncBridgeFromStore","Date",body);

function harness({now=Date.UTC(2032,0,1)}={}){
  const store=new TimelineStore({adapter:new MemoryPersistenceAdapter(),clock:()=>new Date(now)});
  const entitlement=(expiresAt)=>({schemaVersion:"d1-405.timeline-entitlement.1",verified:true,access:"FULL",canRead:true,canCreate:true,canMutate:true,canExport:true,mode:"production",denialCode:"",reason:"ok",expiresAt});
  store.setEntitlement(entitlement(new Date(now+120000).toISOString()),{emit:false});
  const toasts=[];const refreshes=[];const syncs=[];
  const bridge={toast:(message,options)=>toasts.push({message,...(options||{})})};
  const client={locked:false,closed:false,refreshToken(){refreshes.push(Date.now());return Promise.resolve("token");}};
  const toastStudentError=(error,context)=>{const t=studentError(error,{context});toasts.push({message:t.message,tone:"danger",code:t.code});return t.message;};
  const api=wire(store,bridge,{authClient:client},toastStudentError,()=>syncs.push(1),Date);
  return {store,toasts,refreshes,syncs,api,entitlement,expire(){store.setEntitlement({...store.entitlement,expiresAt:new Date(now-1).toISOString()},{emit:false});},renew(){store.setEntitlement(entitlement(new Date(now+120000).toISOString()));api.replayDeferredSessionEdits();}};
}

test("an edit refused during session renewal is kept, renewal requested, student told plainly, and replayed after renewal",()=>{
  const h=harness();
  h.expire();
  const outcome=h.api.runOrDeferSessionEdit(()=>h.store.mutate("Add rotation",(document)=>{document.events.push({id:"r1",categoryId:"clinical",title:"IM clerkship",eventType:"duration",startDate:"2025-01",endDate:"2025-02"});}),{label:"Add rotation",onDeferred:()=>({ok:false,deferred:true,errors:{}})});
  assert.deepEqual(outcome,{ok:false,deferred:true,errors:{}});
  assert.equal(h.store.document.events.length,0,"the refused edit did not half-apply");
  assert.equal(h.store.entitlement.denialCode,"SESSION_VERIFICATION_EXPIRED");
  assert.equal(h.refreshes.length,1,"renewal requested immediately");
  assert.equal(h.api.deferredSessionEdits.length,1);
  assert.match(h.toasts.at(-1).message,/session needs to reconnect/);
  assert.match(h.toasts.at(-1).message,/kept this change/);
  assert.doesNotMatch(h.toasts.at(-1).message,/Contact MissionMed|membership|read-only/);
  h.renew();
  assert.equal(h.store.document.events.length,1,"the kept edit replayed after renewal");
  assert.equal(h.api.deferredSessionEdits.length,0);
  assert.equal(h.syncs.length,1,"surfaces refreshed after replay");
  assert.match(h.toasts.at(-1).message,/Session reconnected/);
});

test("errors other than session renewal still surface normally and nothing is queued",()=>{
  const h=harness();
  assert.throws(()=>h.api.runOrDeferSessionEdit(()=>{throw new TypeError("boom");}),/boom/);
  assert.equal(h.api.deferredSessionEdits.length,0);
  h.store.setEntitlement({...h.store.entitlement,access:"READ_ONLY",canMutate:false,denialCode:"ENTITLEMENT_INELIGIBLE",reason:"ineligible"},{emit:false});
  assert.throws(()=>h.api.runOrDeferSessionEdit(()=>h.store.mutate("x",(d)=>{d.title="y";})),(error)=>error instanceof TimelineEntitlementError&&error.sessionRenewalPending===false);
  assert.equal(h.api.deferredSessionEdits.length,0,"a real entitlement denial is never queued for replay");
});

test("awaitSessionRenewal resolves once claims return and gives up on real revocation",async()=>{
  const h=harness();
  h.expire();
  const pending=h.api.awaitSessionRenewal({timeoutMs:3000});
  await new Promise((resolve)=>setTimeout(resolve,200));
  h.renew();
  assert.equal(await pending,true);
  h.expire();
  const revoked=h.api.awaitSessionRenewal({timeoutMs:1500});
  await new Promise((resolve)=>setTimeout(resolve,200));
  h.store.setEntitlement({...h.store.entitlement,access:"DENIED",canMutate:false,denialCode:"ENTITLEMENT_DENIED",reason:"revoked"});
  assert.equal(await revoked,false);
});

test("the store attaches the denial behind a refused edit so student language distinguishes renewal from lost membership",()=>{
  const h=harness();
  h.expire();
  let caught=null;
  try{h.store.mutate("x",(d)=>{d.title="y";});}catch(error){caught=error;}
  assert.ok(caught instanceof TimelineEntitlementError);
  assert.equal(caught.denialCode,"SESSION_VERIFICATION_EXPIRED");
  assert.equal(caught.sessionRenewalPending,true);
  assert.match(studentError(caught).message,/session needs to reconnect/);
  assert.match(studentError({code:"TIMELINE_ENTITLEMENT_REQUIRED"}).message,/read-only/);
});
