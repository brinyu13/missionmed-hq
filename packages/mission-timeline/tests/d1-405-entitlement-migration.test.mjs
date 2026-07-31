import assert from "node:assert/strict";
import test from "node:test";

import {
  ENTITLEMENT_ACCESS,
  UNLIMITED_TIMELINES,
  createLocalEntitlementAdapter,
  createProductionEntitlementBoundaryAdapter,
  evaluateTimelineEntitlement,
  localEntitlementScenarioFromLocation,
  resolveConfiguredEntitlement
} from "../web/js/uxr-002/entitlement.js";
import {
  TimelineEntitlementError,
  TimelineStore,
  migrateDocument
} from "../web/js/uxr-002/store.js";
import {
  buildExportScreenModel,
  executeExportRequest
} from "../web/js/uxr-002/export-screen.js";

class CountingAdapter{
  constructor(){
    this.kind="m11-counting-memory";
    this.stores=new Map();
    this.writes=0;
    this.deletes=0;
  }
  bucket(name){
    if(!this.stores.has(name))this.stores.set(name,new Map());
    return this.stores.get(name);
  }
  async open(){return this;}
  async get(name,key){return structuredClone(this.bucket(name).get(key)||null);}
  async list(name,predicate=()=>true){
    return[...this.bucket(name).values()]
      .map((value)=>structuredClone(value))
      .filter(predicate);
  }
  async atomicPut(entries){
    this.writes+=1;
    for(const {store,key,value} of entries){
      this.bucket(store).set(key,structuredClone(value));
    }
  }
  async put(name,value){
    this.writes+=1;
    this.bucket(name).set(value.id,structuredClone(value));
  }
  async delete(name,key){
    this.deletes+=1;
    this.bucket(name).delete(key);
  }
  async putBlob(key,blob,metadata){
    this.writes+=1;
    this.bucket("blobs").set(key,{id:key,blob,metadata});
  }
}

test("M11 configured eligibility supports administrator, 360, user, cohort, promotion, and default denial",()=>{
  const configuration={
    individualUsers:{
      "student-override":{enabled:true,allowance:2,reason:"Founder-approved override."}
    },
    cohorts:{"launch-cohort":1},
    promotions:{"summer-promo":3}
  };
  assert.deepEqual(
    resolveConfiguredEntitlement({roles:["Administrator"]},configuration),
    {
      eligible:true,
      allowance:UNLIMITED_TIMELINES,
      source:"wordpress-role",
      reason:"Eligible WordPress role: administrator."
    }
  );
  assert.equal(
    resolveConfiguredEntitlement(
      {memberships:["360-Match-Mentorship"]},
      configuration
    ).allowance,
    1
  );
  assert.equal(
    resolveConfiguredEntitlement({userId:"student-override"},configuration).allowance,
    2
  );
  assert.equal(
    resolveConfiguredEntitlement({cohorts:["launch-cohort"]},configuration).allowance,
    1
  );
  assert.equal(
    resolveConfiguredEntitlement({promotions:["summer-promo"]},configuration).allowance,
    3
  );
  assert.equal(resolveConfiguredEntitlement({},configuration).eligible,false);
});

test("M11 access evaluation covers zero, exact, unlimited, removed, and production fail-closed states",()=>{
  const full=evaluateTimelineEntitlement({
    verified:true,enabled:true,eligible:true,allowance:1,currentUsage:0
  },{hasExistingTimeline:false});
  assert.equal(full.access,ENTITLEMENT_ACCESS.FULL);
  assert.equal(full.canCreate,true);
  assert.equal(full.canMutate,true);
  assert.equal(full.canExport,true);

  const exact=evaluateTimelineEntitlement({
    verified:true,enabled:true,eligible:true,allowance:1,currentUsage:1
  },{hasExistingTimeline:true});
  assert.equal(exact.access,ENTITLEMENT_ACCESS.FULL);
  assert.equal(exact.canCreate,false);
  assert.equal(exact.canMutate,true);

  const zero=evaluateTimelineEntitlement({
    verified:true,enabled:true,eligible:true,allowance:0,currentUsage:0
  },{hasExistingTimeline:true});
  assert.equal(zero.access,ENTITLEMENT_ACCESS.READ_ONLY);
  assert.equal(zero.canMutate,false);
  assert.equal(zero.destructiveEffects,false);

  const unlimited=evaluateTimelineEntitlement({
    verified:true,enabled:true,eligible:true,
    allowance:UNLIMITED_TIMELINES,currentUsage:12
  },{hasExistingTimeline:true});
  assert.equal(unlimited.unlimited,true);
  assert.equal(unlimited.canCreate,true);

  const removed=evaluateTimelineEntitlement({
    verified:true,enabled:false,eligible:false,allowance:1,currentUsage:1
  },{hasExistingTimeline:true});
  assert.equal(removed.access,ENTITLEMENT_ACCESS.READ_ONLY);
  assert.equal(removed.canExport,false);

  const failClosed=evaluateTimelineEntitlement({
    verified:false,enabled:true,eligible:true,allowance:UNLIMITED_TIMELINES
  },{mode:"production",hasExistingTimeline:false});
  assert.equal(failClosed.access,ENTITLEMENT_ACCESS.DENIED);
  assert.equal(failClosed.canCreate,false);
  assert.match(failClosed.reason,/could not be verified/i);

  const malformedProduction=evaluateTimelineEntitlement({
    schemaVersion:"d1-405.timeline-entitlement.1",
    verified:true,
    enabled:true,
    eligible:true,
    allowance:1,
    currentUsage:0,
    verifiedAt:"2026-01-01T00:00:00.000Z",
    expiresAt:"not-a-date",
    principalId:"wp:42",
    issuer:"missionmed-bff",
    audience:"timeline",
    decisionId:"decision-1"
  },{
    mode:"production",
    hasExistingTimeline:false,
    now:new Date("2026-01-01T00:01:00.000Z")
  });
  assert.equal(malformedProduction.access,ENTITLEMENT_ACCESS.DENIED);
  assert.equal(
    malformedProduction.denialCode,
    "PRODUCTION_ENTITLEMENT_MALFORMED"
  );

  const boundProduction=evaluateTimelineEntitlement({
    schemaVersion:"d1-405.timeline-entitlement.1",
    verified:true,
    enabled:true,
    eligible:true,
    allowance:1,
    currentUsage:0,
    verifiedAt:"2026-01-01T00:00:00.000Z",
    expiresAt:"2026-01-01T01:00:00.000Z",
    principalId:"wp:42",
    issuer:"missionmed-bff",
    audience:"timeline",
    membershipVersion:"membership-v7",
    decisionId:"decision-2"
  },{
    mode:"production",
    hasExistingTimeline:false,
    now:new Date("2026-01-01T00:01:00.000Z"),
    expectedBinding:{
      principalId:"wp:42",
      issuer:"missionmed-bff",
      audience:"timeline",
      membershipVersion:"membership-v7"
    }
  });
  assert.equal(boundProduction.access,ENTITLEMENT_ACCESS.FULL);

  const mismatchedProduction=evaluateTimelineEntitlement({
    schemaVersion:"d1-405.timeline-entitlement.1",
    verified:true,
    enabled:true,
    eligible:true,
    allowance:1,
    currentUsage:0,
    verifiedAt:"2026-01-01T00:00:00.000Z",
    expiresAt:"2026-01-01T01:00:00.000Z",
    principalId:"attacker",
    issuer:"anything",
    audience:"anything",
    membershipVersion:"stale",
    decisionId:"decision-3"
  },{
    mode:"production",
    hasExistingTimeline:false,
    now:new Date("2026-01-01T00:01:00.000Z"),
    expectedBinding:{
      principalId:"wp:42",
      issuer:"missionmed-bff",
      audience:"timeline",
      membershipVersion:"membership-v7"
    }
  });
  assert.equal(mismatchedProduction.access,ENTITLEMENT_ACCESS.DENIED);
  assert.equal(
    mismatchedProduction.denialCode,
    "PRODUCTION_ENTITLEMENT_MALFORMED"
  );
});

test("M11 configuration honors global disable, explicit deny, expiry, and normalized keys",()=>{
  const globallyDisabled=resolveConfiguredEntitlement(
    {roles:["administrator"]},
    {enabled:false}
  );
  assert.equal(globallyDisabled.eligible,false);
  assert.equal(globallyDisabled.denialCode,"ENTITLEMENT_GLOBALLY_DISABLED");

  const denied=resolveConfiguredEntitlement(
    {userId:"Student-A",roles:["administrator"]},
    {individualUsers:{"student-a":{enabled:false,allowance:4,reason:"Suspended."}}}
  );
  assert.equal(denied.eligible,false);
  assert.equal(denied.source,"individual-user");

  const numericZeroOverride=resolveConfiguredEntitlement(
    {userId:"Student-Zero",roles:["administrator"]},
    {individualUsers:{"student-zero":0}}
  );
  assert.equal(numericZeroOverride.source,"individual-user");
  assert.equal(numericZeroOverride.eligible,true);
  assert.equal(numericZeroOverride.allowance,0);

  const expired=resolveConfiguredEntitlement(
    {promotions:["Launch-Promo"]},
    {promotions:{"launch-promo":{
      allowance:2,
      expiresAt:"2025-01-01T00:00:00.000Z"
    }}},
    {now:new Date("2026-01-01T00:00:00.000Z")}
  );
  assert.equal(expired.eligible,false);
  assert.equal(expired.allowance,2);

  const highest=resolveConfiguredEntitlement(
    {roles:["administrator","timeline-editor"]},
    {
      eligibleRoles:["administrator","timeline-editor"],
      roleAllowances:{
        administrator:UNLIMITED_TIMELINES,
        "timeline-editor":4
      }
    }
  );
  assert.equal(highest.allowance,UNLIMITED_TIMELINES);

  const validMembershipWins=resolveConfiguredEntitlement(
    {
      roles:["administrator"],
      memberships:["360-match-mentorship"]
    },
    {
      roleAllowances:{
        administrator:{
          allowance:UNLIMITED_TIMELINES,
          expiresAt:"2025-01-01T00:00:00.000Z"
        }
      },
      membershipAllowances:{"360-match-mentorship":1}
    },
    {now:new Date("2026-01-01T00:00:00.000Z")}
  );
  assert.equal(validMembershipWins.eligible,true);
  assert.equal(validMembershipWins.source,"membership-level");
  assert.equal(validMembershipWins.allowance,1);

  const malformedPromotion=resolveConfiguredEntitlement(
    {promotions:["malformed"]},
    {promotions:{malformed:{allowance:2,expiresAt:"not-a-date"}}}
  );
  assert.equal(malformedPromotion.eligible,false);
});

test("M11 local and production adapters are truthful and local scenarios cannot activate off localhost",async()=>{
  const admin=await createLocalEntitlementAdapter({
    scenario:"administrator"
  }).resolve();
  assert.equal(admin.allowance,UNLIMITED_TIMELINES);
  assert.equal(admin.source,"local-entitlement-adapter");
  assert.equal(
    createLocalEntitlementAdapter().metadata.productionWrites,
    false
  );
  const unavailable=await createProductionEntitlementBoundaryAdapter().resolve();
  assert.equal(unavailable.verified,false);
  assert.equal(unavailable.enabled,false);
  assert.equal(
    localEntitlementScenarioFromLocation({
      hostname:"localhost",
      search:"?entitlement=removed"
    }),
    "removed"
  );
  assert.equal(
    localEntitlementScenarioFromLocation({
      hostname:"timeline.missionmed.app",
      search:"?entitlement=administrator"
    }),
    null
  );
});

test("M11 TimelineStore enforces read-only at mutation, creation, version, undo, and save boundaries without deleting data",async()=>{
  const store=new TimelineStore({adapter:{}});
  store.document.events=[{
    id:"preserved",
    title:"Preserved event",
    categoryId:"education",
    eventType:"milestone",
    startDate:"2025-01",
    visibilityState:"INTERVIEWER_SAFE"
  }];
  const before=structuredClone(store.document);
  store.setEntitlement(evaluateTimelineEntitlement({
    verified:true,
    enabled:false,
    eligible:false,
    allowance:1,
    currentUsage:1,
    reason:"Access removed."
  },{hasExistingTimeline:true}));
  for(const action of [
    ()=>store.mutate("blocked",(document)=>document.events.splice(0)),
    ()=>store.undo(),
    ()=>store.redo(),
    ()=>store.saveNow(),
    ()=>store.saveVersion("blocked"),
    ()=>store.startNewTimeline()
  ]){
    await assert.rejects(
      Promise.resolve().then(action),
      (error)=>error instanceof TimelineEntitlementError&&
        error.code==="TIMELINE_ENTITLEMENT_REQUIRED"
    );
  }
  assert.deepEqual(store.document,before);
});

test("M11 TimelineStore rechecks expiry and async version writes at the persistence boundary",async()=>{
  let nowMs=Date.parse("2032-01-01T00:00:00.000Z");
  const expiring=evaluateTimelineEntitlement({
    verified:true,
    enabled:true,
    eligible:true,
    allowance:1,
    currentUsage:0,
    expiresAt:"2032-01-01T01:00:00.000Z"
  },{
    now:new Date(nowMs),
    hasExistingTimeline:true
  });
  const store=new TimelineStore({
    adapter:new CountingAdapter(),
    clock:()=>new Date(nowMs),
    entitlement:expiring
  });
  nowMs=Date.parse("2032-01-01T01:00:00.000Z");
  assert.throws(
    ()=>store.mutate("expired",()=>{}),
    TimelineEntitlementError
  );
  assert.equal(store.entitlement.access,ENTITLEMENT_ACCESS.READ_ONLY);
  assert.equal(store.entitlement.readOnly,true);
  assert.equal(store.entitlement.denied,false);
  assert.equal(store.entitlement.denialCode,"ENTITLEMENT_EXPIRED");
  clearTimeout(store.entitlementTimer);

  const adapter=new CountingAdapter();
  adapter.bucket("versions").set("version-1",{
    id:"version-1",
    documentId:"d1-uxr-002-local-timeline",
    name:"Before"
  });
  const full=evaluateTimelineEntitlement({
    verified:true,enabled:true,eligible:true,allowance:1,currentUsage:0
  },{hasExistingTimeline:true});
  let revokingStore;
  const originalGet=adapter.get.bind(adapter);
  adapter.get=async(name,key)=>{
    const value=await originalGet(name,key);
    if(name==="versions"){
      revokingStore.setEntitlement(evaluateTimelineEntitlement({
        verified:true,
        enabled:false,
        eligible:false,
        allowance:1,
        currentUsage:1,
        reason:"Access removed."
      },{hasExistingTimeline:true}));
    }
    return value;
  };
  revokingStore=new TimelineStore({adapter,entitlement:full});
  await assert.rejects(
    revokingStore.renameVersion("version-1","After"),
    TimelineEntitlementError
  );
  assert.equal(adapter.writes,0);
  assert.equal(
    (await originalGet("versions","version-1")).name,
    "Before"
  );
});

test("M11 pending and denied bootstrap performs zero writes and all former direct write seams fail closed",async()=>{
  const adapter=new CountingAdapter();
  const pending=new TimelineStore({adapter});
  const initialized=await pending.initialize();
  assert.equal(initialized.restored,false);
  assert.equal(adapter.writes,0);
  pending.setEntitlement({
    access:"FULL",
    verified:true,
    canRead:true,
    canCreate:true,
    canMutate:true,
    canExport:true
  });
  assert.equal(pending.entitlement.access,ENTITLEMENT_ACCESS.DENIED);
  assert.equal(pending.entitlement.canMutate,false);
  assert.equal(pending.entitlement.denialCode,"ENTITLEMENT_CONTRACT_INVALID");
  pending.setEntitlement(evaluateTimelineEntitlement({
    verified:false,
    enabled:false,
    eligible:false,
    allowance:0,
    currentUsage:0
  },{mode:"production",hasExistingTimeline:false}));
  for(const action of [
    ()=>pending.renameVersion("missing","Blocked"),
    ()=>pending.deleteVersion("missing"),
    ()=>pending.putSyncRecord({id:"blocked"}),
    ()=>pending.putBlob("blocked",new Blob(["x"]),{})
  ]){
    await assert.rejects(action,TimelineEntitlementError);
  }
  assert.equal(adapter.writes,0);
  assert.equal(adapter.deletes,0);
  assert.equal(
    [...adapter.stores.values()].reduce((sum,bucket)=>sum+bucket.size,0),
    0
  );

  const exactAdapter=new CountingAdapter();
  const exactStore=new TimelineStore({
    adapter:exactAdapter,
    entitlement:evaluateTimelineEntitlement({
      verified:true,
      enabled:true,
      eligible:true,
      allowance:1,
      currentUsage:1
    },{hasExistingTimeline:false})
  });
  const exactInit=await exactStore.initialize();
  assert.equal(exactInit.restored,false);
  assert.equal(exactStore.entitlement.access,ENTITLEMENT_ACCESS.DENIED);
  assert.equal(exactStore.entitlement.canMutate,false);
  assert.equal(exactStore.entitlement.canExport,false);
  assert.equal(exactStore.entitlement.canCreate,false);
  assert.equal(exactAdapter.writes,0);
});

test("M11 authorized edits near expiry checkpoint before the entitlement timer",async()=>{
  let nowMs=Date.parse("2032-01-01T00:59:59.500Z");
  const adapter=new CountingAdapter();
  const store=new TimelineStore({
    adapter,
    clock:()=>new Date(nowMs),
    entitlement:evaluateTimelineEntitlement({
      verified:true,
      enabled:true,
      eligible:true,
      allowance:1,
      currentUsage:1,
      expiresAt:"2032-01-01T01:00:00.000Z"
    },{
      now:new Date(nowMs),
      hasExistingTimeline:true
    })
  });
  store.mutate("valid pre-expiry edit",(document)=>{
    document.title="Saved before expiry";
  });
  await new Promise((resolve)=>setTimeout(resolve,10));
  assert.equal(adapter.writes,1);
  assert.equal(store.saveStatus,"saved");
  nowMs=Date.parse("2032-01-01T01:00:00.000Z");
  store.refreshEntitlementExpiry();
  assert.equal(store.entitlement.readOnly,true);
  clearTimeout(store.entitlementTimer);
});

test("M11 queued pre-expiry edits complete behind a slow local checkpoint",async()=>{
  let nowMs=Date.parse("2032-01-01T00:59:59.000Z");
  const adapter=new CountingAdapter();
  const baseAtomicPut=adapter.atomicPut.bind(adapter);
  let releaseFirst;
  const firstGate=new Promise((resolve)=>{releaseFirst=resolve;});
  let calls=0;
  adapter.atomicPut=async(entries)=>{
    calls+=1;
    if(calls===1)await firstGate;
    return baseAtomicPut(entries);
  };
  const store=new TimelineStore({
    adapter,
    clock:()=>new Date(nowMs),
    entitlement:evaluateTimelineEntitlement({
      verified:true,
      enabled:true,
      eligible:true,
      allowance:1,
      currentUsage:1,
      expiresAt:"2032-01-01T01:00:00.000Z"
    },{
      now:new Date(nowMs),
      hasExistingTimeline:true
    })
  });
  store.mutate("first authorized edit",(document)=>{
    document.title="first";
  });
  await new Promise((resolve)=>setTimeout(resolve,10));
  nowMs=Date.parse("2032-01-01T00:59:59.500Z");
  store.mutate("second authorized edit",(document)=>{
    document.title="second";
  });
  await new Promise((resolve)=>setTimeout(resolve,10));
  nowMs=Date.parse("2032-01-01T01:00:00.000Z");
  store.refreshEntitlementExpiry();
  releaseFirst();
  await store.pendingSave;
  const saved=await adapter.get("documents",store.document.id);
  assert.equal(adapter.writes,2);
  assert.equal(saved.document.title,"second");
  assert.equal(store.document.title,"second");
  assert.equal(store.entitlement.access,ENTITLEMENT_ACCESS.READ_ONLY);
  assert.equal(store.saveStatus,"saved");
  clearTimeout(store.entitlementTimer);
});

test("M11 accepted pre-expiry edit persists when the event loop resumes after expiry",async()=>{
  let nowMs=Date.parse("2032-01-01T00:59:59.500Z");
  const adapter=new CountingAdapter();
  const store=new TimelineStore({
    adapter,
    clock:()=>new Date(nowMs),
    entitlement:evaluateTimelineEntitlement({
      verified:true,
      enabled:true,
      eligible:true,
      allowance:1,
      currentUsage:1,
      expiresAt:"2032-01-01T01:00:00.000Z"
    },{
      now:new Date(nowMs),
      hasExistingTimeline:true
    })
  });
  store.mutate("accepted before a stalled event loop",(document)=>{
    document.title="durable accepted edit";
  });
  nowMs=Date.parse("2032-01-01T01:00:00.000Z");
  store.refreshEntitlementExpiry();
  await new Promise((resolve)=>setTimeout(resolve,10));
  const saved=await adapter.get("documents",store.document.id);
  assert.equal(adapter.writes,1);
  assert.equal(saved.document.title,"durable accepted edit");
  assert.equal(store.entitlement.access,ENTITLEMENT_ACCESS.READ_ONLY);
  assert.equal(store.saveStatus,"saved");
  clearTimeout(store.entitlementTimer);
});

test("M11 export model and installed action fail closed when access cannot be verified",()=>{
  const model=buildExportScreenModel({
    studentProfile:{fullName:"Amara Osei"},
    events:[{id:"event-1"}]
  },{},{
    entitlement:{
      access:"READ_ONLY",
      canMutate:false,
      canExport:false,
      reason:"Access removed."
    }
  });
  assert.equal(model.controlsDisabled,true);
  assert.equal(model.exportActionDisabled,true);
  assert.equal(model.entitlementBlocked,true);
  assert.match(model.entitlementReason,/removed/i);
});

test("M11 export reauthorizes after generation and refuses download after access removal",async()=>{
  let allowed=true;
  let downloads=0;
  await assert.rejects(
    executeExportRequest({
      contract:"D1-UXR-002-EXPORT-REQUEST-V1",
      filename:"blocked.png",
      version:{label:"Blocked",kind:"automatic"}
    },{
      adapter:{
        id:"m11-revocation-proof",
        executionMode:"local",
        async generate(){
          allowed=false;
          return{bytes:1};
        },
        async download(){
          downloads+=1;
          return{downloaded:true};
        }
      },
      authorize:async()=>allowed,
      requestVersion:async()=>{}
    }),
    (error)=>error.code==="EXPORT_ENTITLEMENT_REQUIRED"
  );
  assert.equal(downloads,0);
});

test("M11 D1-404 migration preserves all domains, IDs, geometry, themes, advanced content, advisor, history, versions, and export state",()=>{
  const legacy={
    schemaVersion:"d1-404.1",
    id:"legacy-complete",
    title:"Complete legacy timeline",
    studentProfile:{
      name:"Amara Osei",
      medicalSchool:"Mission University",
      specialtyGoal:"Internal Medicine",
      degree:"MD"
    },
    builder:{step:7,touched:["core","exams"]},
    theme:"horizon",
    mode:"advanced",
    layoutLock:false,
    events:[
      {
        id:"education-1",t:"Medical school",cat:"th",s:"2021-01",e:"2025-05",
        x:120,y:240,width:500,height:44
      },
      {id:"exam-1",t:"Step 2 CK",cat:"usmle",s:"2024-05",mile:true},
      {id:"rotation-1",t:"Rotation",cat:"cl",s:"2024-06",e:"2024-07"},
      {id:"work-1",t:"Work",cat:"work",s:"2020-01",e:"2020-12"},
      {id:"research-1",t:"Research",cat:"res",s:"2023-01",e:"2023-12"},
      {id:"personal-1",t:"Service",cat:"personal",s:"2022-08",mile:true}
    ],
    exams:[{id:"exam-record",system:"USMLE",examId:"step-2-ck",score:"250"}],
    advanced:{
      enteredBefore:true,
      background:{kind:"flat-color",color:"#112233"},
      media:[{id:"media-1",name:"logo.webp"}],
      textBlocks:[{id:"text-1",text:"Context"}],
      recentColors:["#112233"]
    },
    advisorReview:{
      status:"approved",
      approvedAt:"2026-01-02T00:00:00.000Z",
      comments:[{id:"comment-1",body:"Approved"}]
    },
    metadata:{
      interview:{
        prog:"Mission Residency",
        date:"2026-10-20",
        location:"Boston, MA",
        label:"Interview"
      }
    },
    history:[{label:"Legacy edit"}],
    versions:[{id:"version-1"}],
    exportState:{audience:"INTERVIEWER_SAFE",formatId:"pdf-letter-landscape"}
  };
  const migrated=migrateDocument(legacy);
  assert.equal(migrated.id,legacy.id);
  assert.equal(migrated.studentProfile.fullName,"Amara Osei");
  assert.deepEqual(migrated.events.map(({id})=>id),legacy.events.map(({id})=>id));
  assert.deepEqual(
    migrated.events[0],
    expectPreservedGeometry(migrated.events[0])
  );
  assert.deepEqual(migrated.exams,legacy.exams);
  assert.equal(migrated.theme,"horizon");
  assert.equal(migrated.mode,"advanced");
  assert.equal(migrated.layoutLock,false);
  assert.deepEqual(migrated.advanced.media,legacy.advanced.media);
  assert.deepEqual(migrated.advisor.comments,legacy.advisorReview.comments);
  assert.deepEqual(migrated.history,legacy.history);
  assert.deepEqual(migrated.versions,legacy.versions);
  assert.deepEqual(migrated.exportState,legacy.exportState);
  assert.equal(migrated.specialtyVariants.variants.length,1);
  assert.equal(
    migrated.specialtyVariants.variants[0].specialty.label,
    "Internal Medicine"
  );
  assert.equal(
    migrated.specialtyVariants.variants[0].interviewTarget.programName,
    "Mission Residency"
  );
  assert.equal(
    migrated.events.some((event)=>event.fields?.lorSubmitted===true),
    false
  );
  assert.equal(
    migrated.metadata.compatibilityMigration.unknownFieldsPolicy,
    "preserved-uninterpreted"
  );
  assert.equal(
    migrated.metadata.compatibilityMigration.fabricatedLorStatus,
    false
  );
});

function expectPreservedGeometry(event){
  assert.equal(event.x,120);
  assert.equal(event.y,240);
  assert.equal(event.width,500);
  assert.equal(event.height,44);
  assert.deepEqual(
    event.fields.migrationUnknownFields.sort(),
    ["height","width","x","y"]
  );
  return event;
}

test("M11 empty legacy documents migrate to a safe specialty state without fabricating facts",()=>{
  const migrated=migrateDocument({
    schemaVersion:"d1-404.1",
    id:"empty-legacy",
    events:[]
  });
  assert.equal(migrated.events.length,0);
  assert.equal(migrated.specialtyVariants.variants.length,1);
  assert.equal(migrated.specialtyVariants.variants[0].specialty.id,"");
  assert.equal(migrated.specialtyVariants.variants[0].interviewTarget.mode,"general");
  assert.equal(migrated.events.some((event)=>event.fields?.lorSubmitted),false);
});

test("M11 migration is pure, idempotent, and lossless for unknown category and specialty fields",()=>{
  const legacy={
    schemaVersion:"d1-404.1",
    id:"sentinel-rich",
    categories:[{id:"custom-category",name:"Custom"}],
    events:[{
      title:"Unknown category item",
      categoryId:"custom-category",
      startDate:"2024-02",
      customGeometry:{x:91,y:37}
    }],
    specialtyVariants:{
      futureRoot:"retained",
      activeVariantId:"variant-1",
      variants:[{
        id:"variant-1",
        futureVariant:"retained",
        specialty:{id:"acgme:140",label:"Internal Medicine",futureSpecialty:7},
        interviewTarget:{
          mode:"specific",
          programId:"program-1",
          programName:"Mission Residency",
          futureInterview:8
        }
      }]
    }
  };
  const input=structuredClone(legacy);
  const once=migrateDocument(legacy);
  const twice=migrateDocument(once);
  assert.deepEqual(legacy,input);
  assert.deepEqual(twice,once);
  assert.equal(once.events[0].id,"legacy-event-1");
  assert.equal(
    once.events[0].fields.migrationOriginalCategoryId,
    "custom-category"
  );
  assert.equal(
    once.categories.some(({id})=>id==="custom-category"),
    true
  );
  assert.equal(once.specialtyVariants.futureRoot,"retained");
  assert.equal(once.specialtyVariants.variants[0].futureVariant,"retained");
  assert.equal(
    once.specialtyVariants.variants[0].specialty.futureSpecialty,
    7
  );
  assert.equal(
    once.specialtyVariants.variants[0].interviewTarget.futureInterview,
    8
  );
});

test("M11 migration uses deterministic dates and conservative milestone, visibility, draft, and LOR evidence defaults",()=>{
  const source={
    schemaVersion:"d1-404.1",
    id:"migration-safety",
    builder:{drafts:{clinical:{startDate:"2025-01"}}},
    events:[
      {
        id:"milestone",
        eventType:"milestone",
        title:"Milestone",
        startDate:"2025-01",
        visibilityState:"future-private"
      },
      {
        id:"target-lor",
        categoryId:"clinical",
        title:"Rotation",
        startDate:"2025-02",
        fields:{
          lorStatusesByTarget:{"acgme:140":"submitted-to-eras"}
        }
      }
    ]
  };
  const first=migrateDocument(source);
  const second=migrateDocument(source);
  assert.deepEqual(first,second);
  assert.equal(first.createdAt,"1970-01-01T00:00:00.000Z");
  assert.equal(first.updatedAt,"1970-01-01T00:00:00.000Z");
  assert.equal(first.events[0].openEnded,false);
  assert.equal(first.events[0].visibilityState,"HIDDEN");
  assert.equal(
    first.events[0].fields.migrationOriginalVisibility,
    "future-private"
  );
  assert.equal(first.builder.drafts.clinical.lorStatus,"unknown");
  assert.equal(first.events[1].fields.lorStatus,"unknown");
  assert.equal(
    first.events[1].fields.lorMigrationEvidence.submittedToEras,
    null
  );
  assert.equal(
    first.events[1].fields.lorStatusesByTarget["acgme:140"],
    "submitted-to-eras"
  );
});
