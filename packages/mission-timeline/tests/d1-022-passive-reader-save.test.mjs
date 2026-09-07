import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {TimelineStore,defaultDocument} from '../web/js/uxr-002/store.js';
import {HybridIndexedDbAdapter} from '../matrix/hybrid-indexeddb-adapter.js';
import {initializeCompatibilityProjection022,persistExportStateChange022} from '../web/js/407f-engineering-adapter.js';
const entitlement={schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true,reason:'Controlled local access'};
function fixture(){const doc=defaultDocument();Object.assign(doc,{id:'timeline_passive_reader',revision:21,schemaVersion:'d1-timeline-document-409.1',studentOwnerId:'controlled',programId:'controlled',updatedAt:'2026-09-07T05:42:16.494Z',events:[{id:'rotation',title:'Controlled clinical rotation',categoryId:'clinical',eventType:'duration',startDate:'2023-01',endDate:'2023-02',openEnded:false,fields:{siteName:'Controlled institution'}}],exams:[{id:'exam1',system:'USMLE',examId:'step-1',attemptNumber:1,date:'2022-11',result:'pass',score:null,sourceType:'document-intake'}]});return doc;}
function server(document=fixture()){let revision=document.revision;const writes=[];return{writes,get revision(){return revision;},api:{configured:true,async createVersion(id,base,snapshot,label){if(base!==revision)throw Object.assign(Error('Current server version differs'),{status:409,code:'REVISION_CONFLICT'});revision++;writes.push({id,base,snapshot:structuredClone(snapshot),label});return{revision};}}};}
async function reader(remote,doc=fixture()){
 const adapter=new HybridIndexedDbAdapter({name:'passive-reader-'+crypto.randomUUID(),apiClient:remote.api,programId:'controlled',remoteSyncConsent:false});await adapter.open();
 await adapter.hydrateAuthoritative([{store:'documents',key:doc.id,value:{id:doc.id,document:doc,sequence:doc.revision,savedAt:doc.updatedAt}},{store:'settings',key:'uxr-002-active-document',value:{id:'uxr-002-active-document',documentId:doc.id}},{store:'settings',key:'remote-revision:'+doc.id,value:{id:'remote-revision:'+doc.id,documentId:doc.id,revision:doc.revision,updatedAt:doc.updatedAt}}]);
 const store=new TimelineStore({adapter,entitlement});const init=await store.initialize();adapter.setRemoteSyncConsent(true);clearTimeout(adapter.flushTimer);
 initializeCompatibilityProjection022(store,{production:true,restored:init.restored,canCreate:true});
 return{store,adapter,close(){clearTimeout(store.timer);clearTimeout(store.entitlementTimer);adapter.close();}};
}
async function persist(r,reason='TEST_EDIT'){await r.store.saveNow(reason);clearTimeout(r.adapter.flushTimer);return r.adapter.flush();}
test('Restored reader normalizes display but clean load, preview and exit never advance remote revision',async()=>{const remote=server(),r=await reader(remote);try{
 assert.equal(r.store.document.events[0].fields.lorStatus,'unknown');assert.equal(r.store.document.exams[0].automatic,false);assert.equal(r.store.document.updatedAt,fixture().updatedAt);
 assert.equal(r.store.saveStatus,'saved');assert.equal(r.store.timer,null);
 for(const reason of ['preview-loading','preview-ready','preview-error'])assert.equal(persistExportStateChange022(r.store,{previewStatus:reason},reason),false);
 assert.equal(await r.store.flushPendingSave('PAGE_EXIT'),null);await r.adapter.flush();assert.equal(remote.revision,21);assert.equal(remote.writes.length,0);assert.equal((await r.adapter.pending()).length,0);assert.equal(r.store.document.exportState,undefined);
 }finally{r.close();}});
test('Passive separate browser leaves first browser base valid; next real edit persists compatibility fields',async()=>{const remote=server(),a=await reader(remote),b=await reader(remote);try{
 await b.store.flushPendingSave('RETURN_TO_MATRIX');await b.adapter.flush();assert.equal(remote.revision,21);
 a.store.mutate('Student title edit',d=>{d.title='Student chose this title';});await persist(a);
 assert.equal(remote.revision,22);assert.equal(remote.writes.length,1);assert.equal(remote.writes[0].base,21);assert.equal(remote.writes[0].snapshot.title,'Student chose this title');assert.equal(remote.writes[0].snapshot.events[0].fields.lorStatus,'unknown');assert.equal(remote.writes[0].snapshot.exams[0].automatic,false);assert.equal(remote.writes[0].snapshot.events[0].startDate,'2023-01');assert.equal(a.adapter.getSyncStatus().state,'SYNCED');
 }finally{a.close();b.close();}});
test('Real edits in both browsers continue to produce an explicit revision conflict',async()=>{const remote=server(),a=await reader(remote),b=await reader(remote);try{
 b.store.mutate('Second browser explicit edit',d=>{d.title='Student edit B';});await persist(b);
 a.store.mutate('First browser explicit edit',d=>{d.title='Student edit A';});await persist(a);
 assert.equal(remote.revision,22);assert.equal(a.adapter.getSyncStatus().state,'CONFLICT');assert.equal((await a.adapter.pending())[0].document.title,'Student edit A');
 }finally{a.close();b.close();}});
test('Every actual export setting/action still persists through the normal save queue',async()=>{const remote=server(),r=await reader(remote);try{
 for(const [i,reason] of ['format','audience','audience-detail','print-margins','advisor-paper-suggestion','export-start','export-finish'].entries()){
  assert.equal(persistExportStateChange022(r.store,{formatId:'png-1920x1080',chosenRevision:i,exporting:reason==='export-start'},reason),true);await persist(r);assert.equal(remote.writes.at(-1).snapshot.exportState.chosenRevision,i);
 }
 assert.equal(remote.writes.length,7);assert.equal(r.adapter.getSyncStatus().state,'SYNCED');
 }finally{r.close();}});
test('Dirty page exit persists once; another clean exit does not create a duplicate remote version',async()=>{const remote=server(),r=await reader(remote);try{
 r.store.mutate('Student advanced edit',d=>{d.mode='advanced';});await r.store.flushPendingSave('PAGE_EXIT');clearTimeout(r.adapter.flushTimer);await r.adapter.flush();assert.equal(remote.writes.length,1);assert.equal(remote.writes[0].snapshot.mode,'advanced');
 assert.equal(await r.store.flushPendingSave('PAGE_EXIT'),null);await r.adapter.flush();assert.equal(remote.writes.length,1);
 }finally{r.close();}});
test('Exit during an already-started local save retains the same promise without queuing another checkpoint',async()=>{const remote=server(),r=await reader(remote);try{
 let release;const gate=new Promise(resolve=>{release=resolve;});const original=r.adapter.atomicPut.bind(r.adapter);let count=0;r.adapter.atomicPut=async entries=>{count++;await gate;return original(entries);};
 r.store.mutate('Accepted pending edit',d=>{d.title='Pending local edit';});const save=r.store.saveNow('EXPLICIT_SAVE');const held=r.store.pendingSave;assert.equal(r.store.flushPendingSave('PAGE_EXIT'),held);release();await save;clearTimeout(r.adapter.flushTimer);await r.adapter.flush();assert.equal(count,1);assert.equal(remote.writes.length,1);
 }finally{r.close();}});
test('Local/new document normalization retains ordinary mutation persistence',async()=>{const remote=server(),r=await reader(remote);try{
 delete r.store.document.exams[0].automatic;initializeCompatibilityProjection022(r.store,{production:false,restored:true,canCreate:true});assert.equal(r.store.saveStatus,'saving');await persist(r);assert.equal(remote.writes[0].snapshot.exams[0].automatic,false);
 }finally{r.close();}});
