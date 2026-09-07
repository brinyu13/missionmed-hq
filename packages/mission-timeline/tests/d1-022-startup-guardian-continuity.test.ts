import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import 'fake-indexeddb/auto';
import {ProviderAuthenticityService022} from '../src/intelligence/provider-authenticity-022.js';
import {attachProviderReceipt,getProviderReceipt} from '../src/intelligence/provider-receipt.js';
import {canonicalServerQuality022,completeServerQuality022} from '../src/intelligence/server-quality-022.js';
import {TimelineService} from '../src/domain/timeline-service.js';
import {InMemoryTimelineRepository} from '../src/persistence/repository.js';
import {student} from './fixtures.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {TimelineStore,defaultDocument} from '../web/js/uxr-002/store.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {HybridIndexedDbAdapter} from '../matrix/hybrid-indexeddb-adapter.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {restoreAuthenticatedGuardianOnBoot022,persistedIntakeState,initializeCompatibilityProjection022,persistExportStateChange022} from '../web/js/407f-engineering-adapter.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {reconcileRestoredProviderTruth022} from '../web/js/production/provider-receipt-022.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {restoreServerGuardian022} from '../web/js/production/quality-state-022.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {analyzeTimelineQuality,mergeAiQualityAnalysis} from '../web/js/uxr-002/quality-guardian.js';
// @ts-expect-error Existing JavaScript production boundary has no declaration file.
import {applyApprovalBatchToDocument} from '../web/js/uxr-002/intake.js';
const adapterSource=fs.readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const entitlement={schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true,reason:'Local fixture only'};
const authority=new ProviderAuthenticityService022('local-unit',new Map([['local-unit',new TextEncoder().encode('local-test-fixture-key-not-a-production-secret')]]));
async function setup(){
 const service=new TimelineService(new InMemoryTimelineRepository(),()=>new Date(),authority);
 const initial=defaultDocument();Object.assign(initial,{id:'timeline_startup_guardian',schemaVersion:'d1-timeline-document-409.1',revision:0,studentOwnerId:student.principalId,programId:student.programIds[0],events:[]});
 const created=await service.createDocument(student,{id:initial.id,title:initial.title,programId:initial.programId,document:initial});
 const d:any=created.document;
 const transport=attachProviderReceipt({},new Response('{}'),{id:'resp_local_unit_only',model:'local-test-model'},'local request','{}');
 const analysis:any={status:'COMPLETE',mode:'SERVER_AI',provider:'openai',model:'local-test-model',schemaVersion:'d1-timeline-quality-ai.1',promptVersion:'local-test',standardVersion:'local-test',findings:[],unresolvedQuestions:[],providerReceipt:getProviderReceipt(transport)};
 const serverQuality:any=completeServerQuality022(canonicalServerQuality022(d),analysis);
 const proof=authority.sign(d,'GUARDIAN',{...analysis,serverQuality})!;assert.ok(proof);
 d.metadata={...d.metadata,qualityReport022:{...serverQuality,ai:{...serverQuality.ai,providerAuthenticity:proof}}};
 await service.createVersion(student,d.id,0,d,'Local signed receipt fixture');
 const authenticated:any=(await service.getDocument(student,d.id)).document;
 const writes:any[]=[];
 const api={configured:true,createVersion:async(id:string,base:number,snapshot:any,label:string)=>{writes.push(structuredClone(snapshot));return service.createVersion(student,id,base,snapshot,label);}};
 const adapter=new HybridIndexedDbAdapter({name:'startup-guardian-'+crypto.randomUUID(),apiClient:api,programId:d.programId,remoteSyncConsent:false});await adapter.open();
 await adapter.hydrateAuthoritative([{store:'documents',key:d.id,value:{id:d.id,document:authenticated,sequence:authenticated.revision,savedAt:authenticated.updatedAt}},{store:'settings',key:'uxr-002-active-document',value:{id:'uxr-002-active-document',documentId:d.id}},{store:'settings',key:'remote-revision:'+d.id,value:{id:'remote-revision:'+d.id,documentId:d.id,revision:authenticated.revision}}]);
 const store=new TimelineStore({adapter,entitlement});await store.initialize();adapter.setRemoteSyncConsent(true);clearTimeout(adapter.flushTimer);
 return{store,adapter,authenticated,writes,service,async flush(){await store.flushPendingSave('LOCAL_TEST_EXIT');clearTimeout(adapter.flushTimer);await adapter.flush();},async current(){return(await service.getDocument(student,d.id)).document as any;},close(){clearTimeout(store.timer);clearTimeout(store.entitlementTimer);adapter.close();}};
}
function reconcileHarness(store:any){
 const context:any={booting:true,applying:false,pending:false,lastState:'initial',store,queueMicrotask,reflectStoreStatus(){},stableState:(s:any)=>JSON.stringify(s),bridge:{state:{view:'command',title:'Display initial'},renderAll(){}},apply407FStateToDocument:(state:any,d:any)=>{d.title=state.title;},applyDocumentTo407FState(){},applyEntitlementSurface(){},canvasController:null};
 vm.createContext(context);const start=adapterSource.indexOf('  const reconcile=(event)=>{'),end=adapterSource.indexOf('\n  document.addEventListener("d1:407f-rendered",reconcile);',start);assert.ok(start>0&&end>start);vm.runInContext(adapterSource.slice(start,end)+'\nglobalThis.runReconcile=reconcile;',context);return context;
}
test('R3 race reproducer: an interim save loses server receipt even if local asynchronous restore later succeeds',async()=>{const x=await setup();try{
 reconcileRestoredProviderTruth022(x.store.document,x.authenticated);assert.equal(x.store.document.metadata.qualityReport022,undefined);
 const pending=restoreServerGuardian022(x.store.document,x.authenticated,{analyze:analyzeTimelineQuality,merge:mergeAiQualityAnalysis});
 x.store.mutate('Controlled interim boot snapshot',(d:any)=>{d.metadata.localBootProjection=true;},{history:false,material:false});await x.flush();
 const restored=await pending;assert.ok(restored);x.store.document.metadata.qualityReport022=restored.report;
 assert.ok(x.store.document.metadata.qualityReport022.ai.providerAuthenticity);assert.equal((await x.current()).metadata.qualityReport022.ai,undefined);
 }finally{x.close();}});
test('Awaited authenticated restoration survives actual Hybrid save, server verification and second-reader reload',async()=>{const x=await setup();try{
 const restored=await restoreAuthenticatedGuardianOnBoot022(x.store.document,x.authenticated);assert.ok(restored);const signature=x.store.document.metadata.qualityReport022.ai.providerAuthenticity.signature;
 assert.equal(x.store.timer,null);initializeCompatibilityProjection022(x.store,{production:true,restored:true,canCreate:true});
 assert.equal(persistExportStateChange022(x.store,{formatId:'pdf-letter-landscape'},'preview-ready'),false);await x.flush();assert.equal(x.writes.length,0);
 persistExportStateChange022(x.store,{formatId:'pdf-letter-landscape'},'format');await x.flush();assert.equal(x.writes.length,1);
 const remote=await x.current();assert.equal(remote.metadata.qualityReport022.ai.providerAuthenticity.signature,signature);
 const second=structuredClone(remote);assert.ok(await restoreAuthenticatedGuardianOnBoot022(second,remote));assert.equal(second.metadata.qualityReport022.ai.providerAuthenticity.signature,signature);
 }finally{x.close();}});
test('Actual bootstrap reconciliation handler ignores render projections until baseline is captured; subsequent user edit persists',async()=>{const x=await setup();try{
 await restoreAuthenticatedGuardianOnBoot022(x.store.document,x.authenticated);const h=reconcileHarness(x.store);
 h.runReconcile();await Promise.resolve();await x.flush();assert.equal(x.writes.length,0);assert.equal(x.store.timer,null);
 h.lastState=h.stableState(h.bridge.state);h.booting=false;h.runReconcile();await Promise.resolve();await x.flush();assert.equal(x.writes.length,0);
 h.bridge.state.title='Explicit user edit';h.runReconcile();await Promise.resolve();await x.flush();assert.equal(x.writes.length,1);assert.equal((await x.current()).title,'Explicit user edit');assert.equal((await x.current()).metadata.qualityReport022.ai,undefined,'Changed facts must invalidate the old signed review');
 assert.match(adapterSource,/bridge\.renderAll\(\);\s*\/\/ Rehydration[\s\S]*?lastState=stableState\(bridge\.state\);\s*booting=false;\s*document\.documentElement\.classList\.remove/);
 }finally{x.close();}});
test('Revoked mutation permission cannot turn a post-bootstrap render into a save',async()=>{const x=await setup();try{
 await restoreAuthenticatedGuardianOnBoot022(x.store.document,x.authenticated);x.store.setEntitlement({...entitlement,access:'READ_ONLY',canMutate:false});const h=reconcileHarness(x.store);h.booting=false;h.runReconcile();await Promise.resolve();await x.flush();assert.equal(x.writes.length,0);
 }finally{x.close();}});
test('Fresh authenticated server result is mandatory: foreign subject and stripped forged receipt do not restore AI',async()=>{const x=await setup();try{
 const foreign=structuredClone(x.authenticated);foreign.studentOwnerId='other-owner';assert.equal(await restoreAuthenticatedGuardianOnBoot022(structuredClone(x.authenticated),foreign),null);
 const forged=structuredClone(x.authenticated);forged.metadata.qualityReport022.ai.providerAuthenticity.signature='a'.repeat(64);
 await x.service.createVersion(student,forged.id,forged.revision,forged,'Local forged input test');const clean=await x.current();assert.equal(await restoreAuthenticatedGuardianOnBoot022(structuredClone(x.authenticated),clean),null);assert.equal(clean.metadata.qualityReport022.ai,undefined);
 }finally{x.close();}});
for(const mutation of ['title','id','studentOwnerId'])test('Restoration rejects '+mutation+' changes while fingerprint is pending',async()=>{const x=await setup();const original=crypto.subtle.digest;let release!:()=>void;const gate=new Promise<void>(r=>release=r);try{
 (crypto.subtle as any).digest=async function(...args:any[]){await gate;return original.apply(this,args as any);};
 const local=structuredClone(x.authenticated),pending=restoreAuthenticatedGuardianOnBoot022(local,x.authenticated);local[mutation]='Changed while pending';release();assert.equal(await pending,null);assert.equal(local.metadata.qualityReport022,undefined);
 }finally{(crypto.subtle as any).digest=original;release();x.close();}});
test('Actual apply receipt survives DONE notification, with reset/new upload and explicit incoming receipt respected',()=>{
 const d:any={events:[],studentProfile:{},builder:{},intake:{stage:'review',lastImport:null}};
 const batch={history:{undoSteps:1},version:{requiredBeforeMutation:true},additions:[{id:'source-event',title:'Controlled CV experience',startDate:'2023-01',endDate:'2023-02',categoryId:'work',eventType:'duration',sourceType:'document-intake',provenance:[{sourceSha256:'a'.repeat(64),sourceExcerpt:'Controlled CV experience'}]}],merges:[],remainingCandidates:[],qualitySuggestions:[],sourceDocument:{name:'controlled.pdf'},acceptedCount:1,addedCount:1,mergedCount:0,createdAt:'2026-09-07T00:00:00.000Z',acceptedCandidates:[{id:'candidate',title:'Controlled CV experience'}],analysis:{mode:'LOCAL_LIMITED'}};
 applyApprovalBatchToDocument(d,batch);const receipt=structuredClone(d.intake.lastImport),events=structuredClone(d.events);
 const completed=persistedIntakeState({stage:'done',lastImport:null,candidates:[{decision:'accepted'}]},d.intake);assert.deepEqual(completed.lastImport,receipt);assert.notEqual(completed.lastImport,d.intake.lastImport);assert.deepEqual(completed.candidates,[]);assert.deepEqual(d.events,events);
 assert.equal(persistedIntakeState({stage:'upload',lastImport:null,candidates:[]},d.intake).lastImport,null);
 assert.equal(persistedIntakeState({stage:'review',lastImport:null,candidates:[]},d.intake).lastImport,null);
 assert.deepEqual(persistedIntakeState({stage:'done',lastImport:{new:true},candidates:[]},d.intake).lastImport,{new:true});
 assert.equal(persistedIntakeState({stage:'done',lastImport:null,candidates:[]},{}).lastImport,null);
});
test('Initial intake subscription is presentation only; the adapter persists later notifications with actual prior receipt',()=>{
 assert.match(adapterSource,/let initialIntakeNotification022=true;[\s\S]*?const initial=initialIntakeNotification022;[\s\S]*?initialIntakeNotification022=false;[\s\S]*?if\(!initial&&store\.entitlement\.canMutate===true\)[\s\S]*?document\.intake=persistedIntakeState\(state,document\.intake\)/);
 assert.ok(adapterSource.indexOf('initialGuardianRestore022=await restoreAuthenticatedGuardianOnBoot022')<adapterSource.indexOf('document.addEventListener("d1:407f-rendered",reconcile)'));
 assert.doesNotMatch(adapterSource,/if\(authoritativeDocument022\)restoreServerGuardian022/);
});
