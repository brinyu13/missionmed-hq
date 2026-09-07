import assert from "node:assert/strict";
import test from "node:test";
import { qualitySourceText022, qualitySourceSha022, QUALITY_SOURCE_EXCLUDED_FIELDS_022 } from "../src/admin/quality-fingerprint.js";
import { adminRosterStatus } from "../src/admin/postgres-admin-service.js";

const browser = await import(new URL("../web/js/production/quality-state-022.js", import.meta.url).href);
const source = { profile: { name: "Synthetic profile" }, events: [{id:"event",title:"Synthetic experience",categoryId:"education",startDate:"2024-01"}], advanced:{media:[{id:"media",objectId:"owned-reference",frame:{x:1,y:2},sourceUrl:"blob:local-test",resolvedUrl:"https://temporary.invalid",previewUrl:"blob:temporary"}]}, metadata:{qualitySummary022:{}}, revision:1 };

test("022 browser and server review fingerprints match exactly, including Unicode keys and transient media",async()=>{
 assert.deepEqual(QUALITY_SOURCE_EXCLUDED_FIELDS_022,browser.QUALITY_IGNORED_FIELDS_022);
 for(const value of [source,{},null,{"Z":1,"a":2,"é":3,"_":4,"A":5,values:["blob:raw-array",undefined,null,{url:"blob:ignored",previewUrl:"https://ephemeral.invalid"}]}]){
  assert.equal(qualitySourceText022(value),browser.qualitySourceText022(value));
  assert.equal(qualitySourceSha022(value),await browser.qualitySourceSha022(value));
 }
});
test("022 sync bookkeeping/export history do not erase review; facts, references and geometry do",()=>{
 const original=qualitySourceSha022(source);
 for(const change of [{...source,revision:500,metadata:{lastExport022:{filename:"synthetic.png"}}},{...source,advanced:{media:[{...source.advanced.media[0],sourceUrl:"blob:second-device",resolvedUrl:"https://different.invalid"}]}}])assert.equal(qualitySourceSha022(change),original);
 for(const change of [{...source,events:[{...source.events[0],title:"Changed factual title"}]},{...source,advanced:{media:[{...source.advanced.media[0],objectId:"different-owned-reference"}]}},{...source,advanced:{media:[{...source.advanced.media[0],frame:{x:2,y:2}}]}}])assert.notEqual(qualitySourceSha022(change),original);
});
test("022 admin readiness recomputes rules when no authentic AI report exists",()=>{
 const now=new Date("2026-09-07T01:00:00Z");
 const row={document_id:"synthetic-doc",principal_status:"ACTIVE",document_status:"DRAFT",quality_source:source,quality_summary:{checkedAt:"2026-09-07T00:59:00Z",sourceSha256:qualitySourceSha022(source),issueCount:0,exportReady:true},current_revision:999};
 assert.equal(adminRosterStatus(42,row,now).exportReadiness,"NEEDS_REVIEW");
 assert.equal(adminRosterStatus(42,row,now).guardianBasis,"MISSIONMED_RULE");
 for(const change of [{...row,quality_summary:{...row.quality_summary,sourceSha256:"a".repeat(64)}},{...row,quality_summary:{...row.quality_summary,checkedAt:"2026-09-07T02:00:00Z"}},{...row,quality_source:undefined},{...row,quality_summary:{documentRevision:999,checkedAt:"2026-09-07T00:59:00Z",issueCount:0,exportReady:true}}])assert.equal(adminRosterStatus(42,change,now).exportReadiness,change.quality_source?"NEEDS_REVIEW":"NOT_CHECKED");
});

test("022 fingerprints bind semantic metadata, accepted source items and the resolved month",async()=>{
 const original=qualitySourceSha022(source);
 for(const change of [
  {...source,metadata:{interview:{date:"2027-01",programName:"Synthetic clinic"}}},
  {...source,metadata:{renderCurrentMonth:"2027-02"}},
  {...source,metadata:{qualityGuardian:{confirmedExceptions:["finding-test"]}}},
  {...source,intake:{candidates:[{id:"accepted-test",title:"Accepted source title",decision:"accepted"}]}}
 ]){assert.notEqual(qualitySourceSha022(change),original);assert.equal(qualitySourceSha022(change),await browser.qualitySourceSha022(change));}
 const projection=await import(new URL('../web/js/production/quality-source-projection-022.js',import.meta.url).href);
 const ongoing={...source,events:[{...source.events[0],openEnded:true}]};
 assert.notDeepEqual(projection.projectQualitySource022(ongoing,new Date('2026-09-30T23:59:59Z')),projection.projectQualitySource022(ongoing,new Date('2026-10-01T00:00:00Z')));
});
