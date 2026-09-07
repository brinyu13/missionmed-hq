import test from 'node:test';
import assert from 'node:assert/strict';
import {familyRuntimeSnapshot022,installFamilyRuntime022} from '../web/js/production/family-runtime-022.js';
const runtime={authClient:{bootstrapState:{role:'STUDENT',principalId:'student-022',displayName:'Synthetic Student'},locked:false},remotePersistenceAllowed:true};
test('family runtime needs a server acknowledgement and no pending local save to show synced',()=>{
  const input={runtime,saveStatus:'saved',remoteStatus:{state:'SYNCED'}};
  assert.equal(familyRuntimeSnapshot022(input).sync.state,'loading');
  const acknowledged={...input,acknowledgement:{updatedAt:new Date().toISOString()}};
  assert.equal(familyRuntimeSnapshot022(acknowledged).sync.state,'synced');
  assert.equal(familyRuntimeSnapshot022({...acknowledged,saveStatus:'saving'}).sync.state,'saving');
  assert.equal(familyRuntimeSnapshot022({...acknowledged,remoteStatus:{state:'CONFLICT'}}).sync.state,'conflict');
  assert.equal(familyRuntimeSnapshot022({...acknowledged,online:false}).sync.state,'offline');
});
test('a known remote conflict remains actionable through local save errors and offline state',()=>{
  for(const saveStatus of ['saving','saved','error'])for(const online of [true,false]){
    assert.equal(familyRuntimeSnapshot022({runtime,saveStatus,online,remoteStatus:{state:'CONFLICT'}}).sync.state,'conflict');
  }
  assert.equal(familyRuntimeSnapshot022({runtime,saveStatus:'saved',remoteStatus:{state:'SYNCING'}}).sync.state,'saving');
});
test('family recovery action is single-flight and cannot run after the session locks',async()=>{
  let calls=0,complete;
  const pending=new Promise(resolve=>{complete=resolve;});
  const currentRuntime={...runtime,adapter:{getSyncStatus:()=>({state:'CONFLICT'})},authClient:{...runtime.authClient,subscribeClaims:()=>()=>{}}};
  const store={document:{id:'synthetic-022'},saveStatus:'error',adapter:{get:async()=>null},subscribe:()=>()=>{}};
  const documentObject={getElementById:()=>null,addEventListener(){},removeEventListener(){},dispatchEvent(){}};
  const windowObject={navigator:{onLine:true},addEventListener(){},removeEventListener(){}};
  const facade=installFamilyRuntime022({runtime:currentRuntime,store,bridge:{},documentObject,windowObject,recoverSave:async()=>{calls++;await pending;}});
  const first=facade.handleAction('recover-save');
  assert.equal(facade.getSnapshot().sync.recovering,true);
  assert.equal(facade.handleAction('recover-save'),undefined);
  await Promise.resolve();assert.equal(calls,1);
  complete();await first;assert.equal(facade.getSnapshot().sync.recovering,false);
  currentRuntime.authClient.locked=true;
  assert.equal(facade.handleAction('recover-save'),undefined);assert.equal(calls,1);
  facade.destroy();
});
test('local fixtures and selected admin students preserve separate identities',()=>{
  assert.equal(familyRuntimeSnapshot022({saveStatus:'saved'}).mode,'local-fixture');
  const admin={...runtime,subject:{principalId:'subject-022',displayName:'Synthetic Subject',canEdit:true},authClient:{bootstrapState:{role:'PROGRAM_ADMIN',adminWorkspace:true,principalId:'founder-022',displayName:'Founder'}}};
  const snapshot=familyRuntimeSnapshot022({runtime:admin});assert.equal(snapshot.session.actor.id,'founder-022');assert.equal(snapshot.session.subject.id,'subject-022');
  admin.authClient.locked=true;assert.equal(familyRuntimeSnapshot022({runtime:admin}).session.status,'denied');
});
