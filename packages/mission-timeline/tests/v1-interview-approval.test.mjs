import {readFile} from 'node:fs/promises';
import {reflectInterviewApprovalSync407F} from '../web/js/407f-engineering-adapter.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {mountInterviewApprovalV1} from '../web/js/production/interview-approval-v1.js';
import {TimelineProductionAuthClient} from '../web/js/production/timeline-auth-client.js';
import {TimelineStore} from '../web/js/uxr-002/store.js';
import {MemoryPersistenceAdapter} from '../web/js/persistence/memory-adapter.js';

class Node {
  constructor(tag,ownerDocument){this.tag=tag;this.ownerDocument=ownerDocument;this.children=[];this.textContent='';this.value='';this.listeners={};}
  setAttribute(){}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(name,handler){this.listeners[name]=handler;}
  all(tag){return [this,...this.children.flatMap(child=>child.all(tag))].filter(node=>node.tag===tag);}
  text(){return [this.textContent,...this.children.map(child=>child.text())].join(' ');}
}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}
function fixture({admin=true,actualStore=false}={}){
  const dom={createElement(tag){return new Node(tag,dom);}},host=new Node('host',dom);
  let document={id:'timeline_test',studentOwnerId:'student1',title:'Saved timeline',events:[]};
  const trace=[],server={documentId:'timeline_test',currentRevision:3,currentVersionId:'version3',currentContentSha256:'a'.repeat(64),status:'UNREVIEWED',reviewId:null,decision:null,canDecide:admin};
  const api={configured:true,bootstrapState:{principalId:admin?'admin1':'student1',adminWorkspace:admin},claims:{sub:admin?'admin1':'student1',timeline_role:admin?'PROGRAM_ADMIN':'STUDENT',is_wordpress_administrator:admin,timeline_admin_workspace:admin,exp:9999999999},subjectWpUserId:11,
    adminSubjectGrant:{documentId:'timeline_test',principalId:'student1',wpUserId:11,expiresAt:9999999999999},
    subscribeClaims(callback){this.onClaims=callback;return()=>{};},
    async getApproval(){trace.push('GET');return structuredClone(server);},
    async requestReview(id,versionId){trace.push('REQUEST');return{id:'review3',documentId:id,versionId,versionHash:server.currentContentSha256};},
    async decideReview(id,decision,baseRevision,note){trace.push(['DECIDE',id,decision,baseRevision,note]);Object.assign(server,{status:decision,reviewId:id,decision:{decision,versionId:'version3',revision:3,contentSha256:'a'.repeat(64),actorId:'admin1',timestamp:'2026-10-05T12:00:00Z',note:note||null}});}
  };
  const adapter=Object.assign(new MemoryPersistenceAdapter(),{async flush(){trace.push('REMOTE_FLUSH');return{pending:0};},getSyncStatus(){return{state:'SYNCED',pending:0};},async getRemoteRevision(){return 3;}});
  const store=actualStore?new TimelineStore({adapter,documentId:'timeline_test',entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true}})
    :{state:{persistence:{dirty:false}},async flush(){trace.push('LOCAL_FLUSH');},subscribe(callback){this.onChange=callback;callback(this.state.persistence);return()=>{};}};
  if(actualStore){store.document={...store.document,...document};store.saveStatus='saved';const save=store.saveNow.bind(store);store.saveNow=async reason=>{trace.push(['SAVE_NOW',reason]);return save(reason);};}
  let onEdit;const controller=mountInterviewApprovalV1({host,runtime:{authClient:api,adapter},store,getDocument:()=>actualStore?store.document:document,subscribeEdits(fn){onEdit=fn;return()=>{};}});
  return {controller,api,adapter,store,host,server,trace,edit(){if(actualStore){store.mutate('Synthetic source edit',doc=>{doc.title+=' edited';});clearTimeout(store.timer);}else{document.title+=' edited';onEdit();}},switch(){if(actualStore){store.document={...store.document,id:'timeline_other',studentOwnerId:'student2'};store.emit();}else{document={...document,id:'timeline_other',studentOwnerId:'student2'};store.onChange(store.state.persistence);}}};
}

test('V1 actions flush local and remote saves, verify revision, then read server result',async()=>{
  const f=fixture();await f.controller.refresh();await f.controller.decide('APPROVED','');
  assert.deepEqual(f.trace,['GET','LOCAL_FLUSH','REMOTE_FLUSH','GET','REQUEST',['DECIDE','review3','APPROVED',3,''],'GET']);
  assert.equal(f.controller.getState().receipt.status,'APPROVED');assert.match(f.host.text(),/Approved for interview use/);
  await f.controller.decide('CHANGES_REQUESTED','Clarify dates.');assert.equal(f.trace.filter(value=>value==='REQUEST').length,1);
  assert.equal(f.controller.getState().receipt.status,'CHANGES_REQUESTED');
});
test('V1 student readback has no actions even if server display flag is true',async()=>{
  const f=fixture({admin:false});f.server.canDecide=true;await f.controller.refresh();
  assert.deepEqual(f.host.all('button').map(node=>node.textContent),['Refresh review status']);
  await assert.rejects(f.controller.decide('APPROVED'),{code:'APPROVAL_ADMIN_REQUIRED'});
});
test('V1 rejects stale async readback after source edit or selected-student switch',async()=>{
  for(const change of ['edit','switch']){const f=fixture(),pending=deferred();f.api.getApproval=()=>pending.promise;
    const read=f.controller.refresh();f[change]();pending.resolve(structuredClone(f.server));
    await assert.rejects(read,{code:'APPROVAL_CONTEXT_CHANGED'});assert.equal(f.controller.getState().receipt,null);
  }
});
test('V1 discards an old readback after a newer refresh',async()=>{
  const f=fixture(),pending=deferred();let count=0;f.api.getApproval=()=>++count===1?pending.promise:Promise.resolve({...f.server,status:'NEEDS_REVIEW'});
  const old=f.controller.refresh();await f.controller.refresh();pending.resolve(f.server);assert.equal(await old,null);
  assert.equal(f.controller.getState().receipt.status,'NEEDS_REVIEW');
});
test('V1 unavailable assignment, failed save, and server revision conflict never approve locally',async()=>{
  for(const mode of ['assignment','offline','revision']){const f=fixture();await f.controller.refresh();
    if(mode==='assignment')f.api.requestReview=async()=>{throw Object.assign(new Error('No active advisor assignment exists.'),{code:'ADVISOR_NOT_ASSIGNED'});};
    if(mode==='offline')f.adapter.getSyncStatus=()=>({state:'OFFLINE',pending:1});
    if(mode==='revision')f.adapter.getRemoteRevision=async()=>2;
    await assert.rejects(f.controller.decide('APPROVED'));assert.equal(f.controller.getState().receipt,null);
    assert.equal(f.trace.some(value=>Array.isArray(value)&&value[0]==='DECIDE'),false);
    if(mode==='assignment')assert.match(f.host.text(),/No active advisor assignment/);
  }
});
test('V1 source edit during decision drops its response and aborts subsequent write',async()=>{
  const f=fixture();await f.controller.refresh();const pending=deferred();f.api.requestReview=()=>pending.promise;
  const decision=f.controller.decide('APPROVED');await new Promise(resolve=>setImmediate(resolve));f.edit();
  pending.resolve({id:'review3',documentId:'timeline_test',versionId:'version3',versionHash:'a'.repeat(64)});
  await assert.rejects(decision,{code:'APPROVAL_CONTEXT_CHANGED'});assert.equal(f.controller.getState().receipt,null);
  assert.equal(f.trace.some(value=>Array.isArray(value)&&value[0]==='DECIDE'),false);
});
test('V1 never accepts approval for another revision or renders note as HTML',async()=>{
  const f=fixture();f.server.status='APPROVED';f.server.decision={decision:'APPROVED',versionId:'version2',revision:2,contentSha256:'a'.repeat(64)};
  await assert.rejects(f.controller.refresh(),{code:'APPROVAL_RESPONSE_INVALID'});assert.equal(f.controller.getState().receipt,null);
  f.server.status='CHANGES_REQUESTED';f.server.decision={decision:'CHANGES_REQUESTED',versionId:'version3',revision:3,actorId:'admin1',timestamp:'now',note:'<script>synthetic</script>'};await f.controller.refresh();
  assert.match(f.host.text(),/<script>synthetic<\/script>/);assert.equal(f.host.all('script').length,0);
});
test('V1 auth wrappers use existing authenticated request and bind decision revision',async()=>{
  const client=Object.create(TimelineProductionAuthClient.prototype),calls=[];client.request=(path,options)=>{calls.push([path,options]);};
  client.getApproval('doc/id');client.requestReview('doc/id','version1');client.decideReview('review/id','APPROVED',3,'');
  assert.deepEqual(calls,[['/documents/doc%2Fid/approval',undefined],['/documents/doc%2Fid/reviews',{method:'POST',body:{versionId:'version1'}}],['/reviews/review%2Fid/decision',{method:'POST',body:{decision:'APPROVED',baseRevision:3,reason:''}}]]);
});

test('V1 background refresh cannot race an in-progress decision or reuse stale account errors',async()=>{
  const f=fixture();await f.controller.refresh();const pending=deferred();f.api.requestReview=()=>pending.promise;
  const decision=f.controller.decide('APPROVED');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await f.controller.refresh(),null);f.switch();
  pending.resolve({id:'review3',documentId:'timeline_test',versionId:'version3',versionHash:'a'.repeat(64)});
  await assert.rejects(decision,{code:'APPROVAL_CONTEXT_CHANGED'});assert.equal(f.controller.getState().receipt,null);
  assert.match(f.controller.getState().error,/selected Timeline changed/);
});

test('V1 actual TimelineStore uses saveNow and immediately invalidates approval on a real mutate emission',async()=>{
  const f=fixture({actualStore:true});assert.equal(typeof f.store.flush,'undefined');assert.equal(f.store.state,undefined);
  await f.controller.refresh();await f.controller.decide('APPROVED','Actual store interface');
  assert.deepEqual(f.trace.find(value=>Array.isArray(value)&&value[0]==='SAVE_NOW'),['SAVE_NOW','BEFORE_ADVISOR_DECISION']);
  assert.equal((await f.adapter.get('documents','timeline_test')).document.title,'Saved timeline');
  assert.equal(f.controller.getState().receipt.status,'APPROVED');
  f.edit();assert.equal(f.store.saveStatus,'saving');assert.equal(f.controller.getState().receipt,null);
  assert.doesNotMatch(f.host.text(),/Approved for interview use/);
  await assert.rejects(f.controller.refresh(),{code:'APPROVAL_UNSAVED'});f.controller.dispose();
});
test('V1 actual TimelineStore save error aborts approval and selection emission clears receipts',async()=>{
  const f=fixture({actualStore:true});await f.controller.refresh();f.adapter.simulateWriteFailure();
  await assert.rejects(f.controller.decide('APPROVED'),/SIMULATED_PERSISTENCE_FAILURE/);
  assert.equal(f.store.saveStatus,'error');assert.equal(f.controller.getState().receipt,null);
  assert.equal(f.trace.some(value=>Array.isArray(value)&&value[0]==='DECIDE'),false);
  f.store.saveStatus='saved';f.store.saveError=null;await f.controller.refresh();f.switch();
  assert.equal(f.controller.getState().receipt,null);assert.match(f.controller.getState().error,/selected Timeline changed/);f.controller.dispose();
});
test('V1 actual store source edit rejects an in-flight read before the server receipt can reappear',async()=>{
  const f=fixture({actualStore:true}),pending=deferred();f.api.getApproval=()=>pending.promise;
  const read=f.controller.refresh();f.edit();pending.resolve(f.server);
  await assert.rejects(read,{code:'APPROVAL_CONTEXT_CHANGED'});assert.equal(f.controller.getState().receipt,null);f.controller.dispose();
});

test('V1 actual locally saved edits with remote pending never restore an old server approval on manual refresh',async()=>{
  const f=fixture({actualStore:true});await f.controller.refresh();await f.controller.decide('APPROVED');
  f.edit();await f.store.saveNow('LOCAL_ONLY_SAVE');assert.equal(f.store.saveStatus,'saved');
  f.adapter.getSyncStatus=()=>({state:'SYNC_PENDING',pending:1});const reads=f.trace.filter(value=>value==='GET').length;
  await assert.rejects(f.controller.refresh(),{code:'APPROVAL_SYNC_REQUIRED'});
  assert.equal(f.trace.filter(value=>value==='GET').length,reads);assert.equal(f.controller.getState().receipt,null);
  assert.doesNotMatch(f.host.text(),/Approved for interview use/);f.controller.dispose();
});
test('V1 owning sync listener immediately clears displayed receipts on pending, offline and conflict events',async()=>{
  for(const state of ['SYNC_PENDING','SYNCING','OFFLINE','CONFLICT']){
    const f=fixture({actualStore:true});await f.controller.refresh();await f.controller.decide('APPROVED');
    f.controller.handleSyncStatus({syncState:state,pending:1});
    assert.equal(f.controller.getState().receipt,null);assert.doesNotMatch(f.host.text(),/Approved for interview use/);f.controller.dispose();
  }
});
test('V1 manual refresh rechecks pending sync and acknowledged revision after server GET',async()=>{
  for(const mode of ['offline','pending','revision']){
    const f=fixture({actualStore:true});const get=f.api.getApproval;
    f.api.getApproval=async()=>{const value=await get();
      if(mode==='offline')f.adapter.getSyncStatus=()=>({state:'OFFLINE',pending:0});
      if(mode==='pending')f.adapter.getSyncStatus=()=>({state:'SYNC_PENDING',pending:1});
      if(mode==='revision')f.adapter.getRemoteRevision=async()=>4;
      return value;
    };
    await assert.rejects(f.controller.refresh(),{code:mode==='revision'?'REVISION_CONFLICT':'APPROVAL_SYNC_REQUIRED'});
    assert.equal(f.controller.getState().receipt,null);f.controller.dispose();
  }
});
test('V1 secure startup with no remote revision cannot display a server approval',async()=>{
  const f=fixture({actualStore:true});f.adapter.getRemoteRevision=async()=>null;
  await assert.rejects(f.controller.refresh(),{code:'APPROVAL_SYNC_REQUIRED'});
  assert.equal(f.controller.getState().receipt,null);assert.equal(f.trace.includes('GET'),false);f.controller.dispose();
});
test('V1 expected pending sync emissions during its own save do not cancel the genuine decision',async()=>{
  const f=fixture({actualStore:true});await f.controller.refresh();const atomic=f.adapter.atomicPut.bind(f.adapter);
  f.adapter.atomicPut=async entries=>{f.controller.handleSyncStatus({syncState:'SYNC_PENDING',pending:1});return atomic(entries);};
  f.adapter.flush=async()=>{f.controller.handleSyncStatus({syncState:'SYNCING',pending:1});return{pending:0};};
  await f.controller.decide('APPROVED');assert.equal(f.controller.getState().receipt.status,'APPROVED');f.controller.dispose();
});

// Exercise the actual owning adapter sync callback with the real approval UI and TimelineStore.
test('V1 owning adapter sync wiring clears every pending receipt and refreshes only acknowledged current source',async()=>{
  const f=fixture({actualStore:true});await f.controller.refresh();await f.controller.decide('APPROVED');
  f.adapter.getSyncStatus=()=>({state:'OFFLINE',pending:1});
  await reflectInterviewApprovalSync407F(f.controller,{syncState:'OFFLINE',pending:1},f.store);
  assert.equal(f.controller.getState().receipt,null);assert.doesNotMatch(f.host.text(),/Approved for interview use/);
  f.edit();await f.store.saveNow('EDITED_CURRENT_REVISION');
  f.server.currentRevision=4;f.server.currentVersionId='version4';f.server.currentContentSha256='b'.repeat(64);f.server.status='NEEDS_REVIEW';f.server.decision=null;
  f.adapter.getRemoteRevision=async()=>4;f.adapter.getSyncStatus=()=>({state:'SYNCED',pending:0});
  await reflectInterviewApprovalSync407F(f.controller,{syncState:'SYNCED',pending:0},f.store);
  assert.equal(f.controller.getState().receipt.status,'NEEDS_REVIEW');f.controller.dispose();
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  const sync=source.slice(source.indexOf('const onRemoteSyncStatus='),source.indexOf('const runtimeDatasets='));
  assert.match(sync,/reflectInterviewApprovalSync407F\(interviewApprovalV1,remoteSyncStatus,store\)/);
  assert.match(source,/if\(productionRuntime\)\{\s*const header=document.querySelector\("\.d1404Header"\)/);
  assert.match(source,/interviewApprovalV1\?\.dispose\(\)/);
});
