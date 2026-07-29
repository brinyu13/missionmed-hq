import assert from "node:assert/strict";
import test from "node:test";

import {AUTOSAVE_DELAY,HISTORY_LIMIT} from "../web/js/uxr-002/constants.js";
import {TimelineStore,migrateDocument} from "../web/js/uxr-002/store.js";
import {contrastRatio,formatMonth,parseMonth} from "../web/js/uxr-002/utils.js";

class MemoryAdapter{
  constructor(){
    this.kind="deterministic-memory";
    this.openCount=0;
    this.stores=new Map();
    this.atomicBatches=[];
    this.putCalls=[];
  }

  bucket(store){
    if(!this.stores.has(store))this.stores.set(store,new Map());
    return this.stores.get(store);
  }

  seed(store,key,value){
    this.bucket(store).set(key,structuredClone(value));
    return this;
  }

  async open(){
    this.openCount+=1;
    return this;
  }

  async get(store,key){
    const value=this.bucket(store).get(key);
    return value===undefined?null:structuredClone(value);
  }

  async atomicPut(operations){
    const snapshot=operations.map((operation)=>structuredClone(operation));
    this.atomicBatches.push(snapshot);
    for(const {store,key,value} of snapshot)this.bucket(store).set(key,structuredClone(value));
  }

  async put(store,value){
    const snapshot=structuredClone(value);
    this.putCalls.push({store,value:snapshot});
    this.bucket(store).set(snapshot.id,snapshot);
    return snapshot;
  }

  async list(store,predicate=()=>true){
    return [...this.bucket(store).values()].map((value)=>structuredClone(value)).filter(predicate);
  }
}

function advancingClock(iso="2032-06-01T12:00:00.000Z"){
  let value=Date.parse(iso);
  return()=>new Date(value++);
}

function clearScheduledSave(store){
  clearTimeout(store.timer);
  store.timer=null;
}

test("parseMonth and formatMonth accept every frozen input form",()=>{
  const accepted=[
    ["6/2023","2023-06"],
    ["Jun 2023","2023-06"],
    ["June 2023","2023-06"],
    ["2023-06","2023-06"],
    ["  june 2023  ","2023-06"],
    ["06/2023","2023-06"]
  ];

  for(const [input,canonical] of accepted){
    assert.equal(parseMonth(input),canonical,input);
    assert.equal(formatMonth(input),"Jun 2023",input);
  }
});

test("parseMonth and formatMonth reject missing, impossible, malformed, and near-match values",()=>{
  const invalid=[
    null,
    "",
    "   ",
    "0/2023",
    "13/2023",
    "2023-00",
    "2023-13",
    "2023/06",
    "June 23",
    "2023",
    "not a date",
    "Juno 2023",
    "June 2023 extra"
  ];

  for(const input of invalid){
    assert.equal(parseMonth(input),null,String(input));
    assert.equal(formatMonth(input),"",String(input));
  }
});

test("candidate contrast calculations reproduce Founder Addenda 001 and 002",()=>{
  assert.deepEqual(
    {
      whiteOnGold:contrastRatio("#FFFFFF","#B98A2E"),
      inkOnGold:contrastRatio("#191C21","#B98A2E"),
      whiteOnGoldHover:contrastRatio("#FFFFFF","#A67A26")
    },
    {
      whiteOnGold:3.1168,
      inkOnGold:5.4805,
      whiteOnGoldHover:3.8651
    },
    "D1-UXR-002-CONTRAST-ADDENDUM-001"
  );
  assert.ok(contrastRatio("#191C21","#B98A2E")>=4.5);
  assert.ok(contrastRatio("#FFFFFF","#B98A2E")<4.5);

  assert.deepEqual(
    {
      tertiaryOnWhite:contrastRatio("#8A9099","#FFFFFF"),
      tertiaryOnShell:contrastRatio("#8A9099","#F7F6F3"),
      secondaryOnWhite:contrastRatio("#565D66","#FFFFFF"),
      secondaryOnShell:contrastRatio("#565D66","#F7F6F3")
    },
    {
      tertiaryOnWhite:3.216,
      tertiaryOnShell:2.9757,
      secondaryOnWhite:6.6597,
      secondaryOnShell:6.1622
    },
    "D1-UXR-002-CONTRAST-ADDENDUM-002"
  );
  assert.ok(contrastRatio("#565D66","#FFFFFF")>=4.5);
  assert.ok(contrastRatio("#565D66","#F7F6F3")>=4.5);
  assert.ok(contrastRatio("#8A9099","#FFFFFF")<4.5);
  assert.ok(contrastRatio("#8A9099","#F7F6F3")<4.5);
});

test("initialization creates one durable atomic draft and restores it without rewriting",async()=>{
  const adapter=new MemoryAdapter();
  const first=new TimelineStore({adapter,clock:advancingClock()});
  const firstResult=await first.initialize();

  assert.deepEqual(firstResult,{
    restored:false,
    adapter:"deterministic-memory",
    documentId:"d1-uxr-002-local-timeline"
  });
  assert.equal(adapter.openCount,1);
  assert.equal(adapter.atomicBatches.length,1);
  assert.deepEqual(
    adapter.atomicBatches[0].map(({store,key})=>({store,key})),
    [
      {store:"documents",key:"d1-uxr-002-local-timeline"},
      {store:"checkpoints",key:adapter.atomicBatches[0][1].key},
      {store:"settings",key:"uxr-002-active-document"}
    ]
  );
  assert.equal(adapter.atomicBatches[0][0].value.reason,"INITIAL_DURABLE_DRAFT");
  assert.equal(
    (await adapter.get("settings","uxr-002-active-document")).documentId,
    "d1-uxr-002-local-timeline"
  );
  assert.equal(
    (await adapter.get("documents","d1-uxr-002-local-timeline")).document.schemaVersion,
    "d1-uxr-002.1"
  );

  const second=new TimelineStore({adapter,clock:advancingClock("2032-06-02T12:00:00.000Z")});
  const secondResult=await second.initialize();
  assert.equal(secondResult.restored,true);
  assert.equal(second.document.id,first.document.id);
  assert.equal(second.document.createdAt,first.document.createdAt);
  assert.equal(adapter.openCount,2);
  assert.equal(adapter.atomicBatches.length,1,"restoring a durable draft must not create a redundant write");
});

test("a no-op mutation changes no timestamp, history, save state, sequence, or persistence",async()=>{
  const adapter=new MemoryAdapter();
  const store=new TimelineStore({adapter,clock:advancingClock()});
  await store.initialize();
  const before=store.snapshot();
  const batchCount=adapter.atomicBatches.length;
  const saveSequence=store.saveSequence;

  const changed=store.mutate("No-op",(document)=>{
    const original=document.title;
    document.title="temporary";
    document.title=original;
  });

  assert.equal(changed,false);
  assert.deepEqual(store.document,before);
  assert.equal(store.document.updatedAt,before.updatedAt);
  assert.deepEqual(store.historyStatus(),{
    undoCount:0,
    redoCount:0,
    canUndo:false,
    canRedo:false,
    undoLabel:null,
    redoLabel:null
  });
  assert.equal(store.saveStatus,"saved");
  assert.equal(store.saveSequence,saveSequence);
  assert.equal(store.timer,null);
  assert.equal(adapter.atomicBatches.length,batchCount);
});

test("history retains only the latest 50 material mutations",async()=>{
  assert.equal(HISTORY_LIMIT,50);
  const adapter=new MemoryAdapter();
  const store=new TimelineStore({adapter,clock:advancingClock()});
  await store.initialize();

  for(let index=1;index<=55;index+=1){
    assert.equal(
      store.mutate(`Edit ${index}`,(document)=>{document.title=`Timeline ${index}`;}),
      true
    );
  }
  clearScheduledSave(store);

  assert.equal(store.undoStack.length,50);
  assert.equal(store.undoStack[0].label,"Edit 6");
  assert.equal(store.undoStack.at(-1).label,"Edit 55");
  assert.deepEqual(store.historyStatus(),{
    undoCount:50,
    redoCount:0,
    canUndo:true,
    canRedo:false,
    undoLabel:"Edit 55",
    redoLabel:null
  });
});

test("undo and redo restore document snapshots and maintain both history stacks",async()=>{
  const adapter=new MemoryAdapter();
  const store=new TimelineStore({adapter,clock:advancingClock()});
  await store.initialize();
  const originalTitle=store.document.title;

  store.mutate("First title",(document)=>{document.title="First";});
  store.mutate("Second title",(document)=>{document.title="Second";});
  clearScheduledSave(store);
  assert.equal(store.document.title,"Second");

  const undone=store.undo();
  clearScheduledSave(store);
  assert.equal(undone.label,"Second title");
  assert.equal(store.document.title,"First");
  assert.deepEqual(store.historyStatus(),{
    undoCount:1,
    redoCount:1,
    canUndo:true,
    canRedo:true,
    undoLabel:"First title",
    redoLabel:"Second title"
  });

  const redone=store.redo();
  clearScheduledSave(store);
  assert.equal(redone.label,"Second title");
  assert.equal(store.document.title,"Second");
  assert.deepEqual(store.historyStatus(),{
    undoCount:2,
    redoCount:0,
    canUndo:true,
    canRedo:false,
    undoLabel:"Second title",
    redoLabel:null
  });

  store.undo();
  clearScheduledSave(store);
  store.undo();
  clearScheduledSave(store);
  assert.equal(store.document.title,originalTitle);
  assert.equal(store.undo(),null);
});

test("autosave waits exactly 800ms and then persists one atomic candidate snapshot",async(t)=>{
  assert.equal(AUTOSAVE_DELAY,800);
  t.mock.timers.enable({apis:["setTimeout"]});
  const adapter=new MemoryAdapter();
  const store=new TimelineStore({adapter,clock:advancingClock()});
  await store.initialize();
  adapter.atomicBatches.length=0;

  store.mutate("Autosaved title",(document)=>{document.title="Autosaved";});
  assert.equal(store.saveStatus,"saving");
  assert.equal(adapter.atomicBatches.length,0);

  t.mock.timers.tick(799);
  await Promise.resolve();
  assert.equal(adapter.atomicBatches.length,0,"autosave must not run before 800ms");

  t.mock.timers.tick(1);
  if(store.pendingSave)await store.pendingSave;
  assert.equal(adapter.atomicBatches.length,1);
  assert.equal(adapter.atomicBatches[0][0].value.reason,"AUTOSAVE");
  assert.equal(adapter.atomicBatches[0][0].value.document.title,"Autosaved");
  assert.deepEqual(
    adapter.atomicBatches[0].map(({store:storeName})=>storeName),
    ["documents","checkpoints","settings"]
  );
  assert.equal(store.saveStatus,"saved");
  assert.equal(store.saveError,null);
});

test("legacy category aliases and compact date fields migrate into the canonical schema",()=>{
  const updatedAt="2025-01-02T03:04:05.000Z";
  const aliases=[
    ["th","education"],
    ["usmle","exams"],
    ["cl","clinical"],
    ["res","research"],
    ["work","work"],
    ["personal","personal"],
    ["unknown","personal"]
  ];
  const legacy={
    schemaVersion:"d1-410-legacy",
    id:"legacy-timeline",
    studentProfile:{name:"Amara Osei"},
    metadata:{updatedAt},
    events:aliases.map(([cat],index)=>({
      id:`legacy-${index}`,
      t:`Legacy ${index}`,
      cat,
      s:`20${10+index}-01`,
      e:`20${10+index}-12`,
      loc:`Site ${index}`,
      origin:"legacy-import",
      vis:index===1?"advisor":"interviewer"
    }))
  };

  const migrated=migrateDocument({document:legacy});
  assert.equal(migrated.schemaVersion,"d1-uxr-002.1");
  assert.equal(migrated.id,"legacy-timeline");
  assert.equal(migrated.studentProfile.fullName,"Amara Osei");
  assert.equal(migrated.updatedAt,updatedAt);
  assert.equal(migrated.metadata.sourceSchema,"d1-410-legacy");
  assert.deepEqual(migrated.events.map(({categoryId})=>categoryId),aliases.map(([,expected])=>expected));
  assert.deepEqual(
    migrated.events.map(({title,startDate,endDate})=>({title,startDate,endDate})),
    aliases.map((_,index)=>({
      title:`Legacy ${index}`,
      startDate:`20${10+index}-01`,
      endDate:`20${10+index}-12`
    }))
  );
  assert.equal(migrated.events[1].visibilityState,"ADVISOR_ONLY");
  assert.equal(migrated.events[0].visibilityState,"INTERVIEWER_SAFE");
  assert.equal(migrated.events[0].siteName,"Site 0");
  assert.equal(migrated.events[0].sourceType,"legacy-import");
  assert.ok(migrated.categories.some(({id,label})=>id==="education"&&label==="Education"));
});
