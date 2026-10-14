// TL-AAA-STABILIZE-20261013 (no student work lost): an explicit entry save is committed to
// local storage immediately rather than after the typing debounce, the tab-hidden hook commits
// and syncs while the page is alive, and the remote sync cannot be starved by continuous editing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {TimelineStore} from "../web/js/uxr-002/store.js";
import {MemoryPersistenceAdapter} from "../web/js/persistence/memory-adapter.js";
import {AUTOSAVE_DELAY} from "../web/js/uxr-002/constants.js";
import {HybridIndexedDbAdapter} from "../matrix/hybrid-indexeddb-adapter.js";

const nativeSetTimeout=globalThis.setTimeout;
globalThis.setTimeout=(callback,delay,...args)=>{const timer=nativeSetTimeout(callback,delay,...args);if(Number(delay)>10000)timer.unref?.();return timer;};

function entitled(store){
  store.setEntitlement({schemaVersion:"d1-405.timeline-entitlement.1",verified:true,access:"FULL",canRead:true,canCreate:true,canMutate:true,canExport:true,mode:"production",denialCode:"",reason:"ok",expiresAt:new Date(Date.now()+120000).toISOString()},{emit:false});
  return store;
}
const sleep=(ms)=>new Promise((resolve)=>nativeSetTimeout(resolve,ms));

test("an explicit save persists at once; a typing edit keeps the autosave debounce",async()=>{
  const adapter=new MemoryPersistenceAdapter();const puts=[];
  const nativePut=adapter.atomicPut.bind(adapter);adapter.atomicPut=async(entries)=>{puts.push(entries.map(e=>e.value?.reason).filter(Boolean));return nativePut(entries);};
  const store=entitled(new TimelineStore({adapter}));
  store.mutate("Add rotation",(document)=>{document.events.push({id:"r1",categoryId:"clinical",title:"IM",eventType:"duration",startDate:"2025-01",endDate:"2025-02"});},{persist:"now"});
  await sleep(60);
  assert.ok(puts.some(reasons=>reasons.includes("ENTRY_SAVED")),"explicit save committed before the debounce elapsed: "+JSON.stringify(puts));
  puts.length=0;
  store.mutate("Type a draft",(document)=>{document.title="Typing…";});
  await sleep(60);
  assert.equal(puts.length,0,"a typing edit is still debounced");
  await sleep(AUTOSAVE_DELAY+200);
  assert.ok(puts.some(reasons=>reasons.includes("AUTOSAVE")));
});

test("remote sync is flushed within the bounded deadline even while edits keep arriving",async()=>{
  const adapter=Object.create(HybridIndexedDbAdapter.prototype);
  adapter.remoteSyncConsent=true;adapter.flushTimer=null;adapter.flushDeadline=0;
  const flushes=[];adapter.flush=async()=>{flushes.push(Date.now());};
  HybridIndexedDbAdapter.FLUSH_MAX_WAIT_MS=600;
  const started=Date.now();
  for(let i=0;i<8;i++){adapter.scheduleFlush(400);await sleep(150);}  // reschedules every 150 ms for 1.2 s
  await sleep(500);
  assert.ok(flushes.length>=1,"a flush happened although every reschedule was shorter than the trailing delay");
  assert.ok(flushes[0]-started<=700,`first flush waited ${flushes[0]-started}ms`);
  assert.equal(adapter.flushDeadline,0,"deadline cleared after the flush");
});

test("the production shell commits and syncs when the tab is hidden, and explicit saves use persist:now",()=>{
  const adapter=fs.readFileSync(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  assert.match(adapter,/document\.addEventListener\("visibilitychange",\(\)=>\{\n\s*if\(document\.visibilityState!=="hidden"\|\|store\.entitlement\.canMutate!==true\)return;\n\s*const pending=store\.flushPendingSave\("PAGE_HIDDEN"\);/);
  assert.equal((adapter.match(/persist:render\?"now":"scheduled"/g)||[]).length,1,"the domain commit path persists explicit saves at once");
  assert.match(adapter,/\},\{emit:render\}\);\n\s*\/\/ An explicit exam save[^\n]*\n\s*if\(render\)store\.flushPendingSave\("ENTRY_SAVED"\)/);
  const builder=fs.readFileSync(new URL("../web/js/uxr-002/builder.js",import.meta.url),"utf8");
  assert.match(builder,/commitBuilderEntry\(document,domain,draft,\{idFactory\}\);\n\s*\},\{persist:"now"\}\);/);
});
