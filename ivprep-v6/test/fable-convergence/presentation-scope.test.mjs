import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnPresentation,saveOwnVisibility,presentationPreferences} from '../../public/studio-fable/app/adapters/own-presentation.mjs';
import {advancedEntryRole,reviewScopeLabel} from '../../public/studio/advanced-entry.mjs';
function setup() {
  let stored={calibration:{version:7},visibility:{analyticsVisible:true,otherOwnerField:'preserve'},coachingEnabled:false,recordingDefault:false};
  const c={account:{mode:'REAL',subject:'wp:1',role:'admin',api:{
    bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}}),
    mentorPriorities:async()=>({subjectId:'wp:1',priorities:[{text:'Name your contribution.'}]}),
    preferences:async()=>stored,savePreferences:async value=>(stored=value),
  }}};
  return {c,stored:()=>stored};
}
test('Home/Practice priorities come only from fresh admitted own subject',async()=>{
  const {c}=setup();assert.equal((await readOwnPresentation(c)).mentorPriority,'Name your contribution.');
  c.account.api.mentorPriorities=async()=>({subjectId:'wp:2',priorities:[{text:'Not yours'}]});
  await assert.rejects(readOwnPresentation(c),/account changed/);
  c.account.api.bootstrap=async()=>({entitlement:{admitted:false},identity:{subject:'wp:1',admin:true}});
  await assert.rejects(readOwnPresentation(c),/access changed/);
});
test('preference writes are serialized fresh merges and preserve other subsystems',async()=>{
  const {c,stored}=setup();await Promise.all([saveOwnVisibility(c,{density:'interview'}),saveOwnVisibility(c,{overlaysVisible:true}),saveOwnVisibility(c,{favoriteQuestions:['CORE-01','CORE-01','bad id']})]);
  assert.deepEqual(stored().calibration,{version:7});assert.equal(stored().visibility.otherOwnerField,'preserve');
  assert.equal(stored().coachingEnabled,false);assert.equal(stored().recordingDefault,false);
  assert.deepEqual(presentationPreferences(stored()),{density:'interview',densityPersisted:true,overlaysVisible:true,favoriteQuestions:['CORE-01']});
  assert.equal(Object.hasOwn(stored().visibility.ivocFable,'densityPersisted'),false);
});
test('mock defaults remain distinct until density is explicitly saved',()=>{
  assert.equal(presentationPreferences({visibility:{analyticsVisible:true}}).densityPersisted,false);
  assert.equal(presentationPreferences({visibility:{ivocFable:{density:'coached'}}}).densityPersisted,true);
});
test('favorites and overlay writes cannot silently change the default mock density',async()=>{
  const {c,stored}=setup();await saveOwnVisibility(c,{favoriteQuestions:['CORE-01'],overlaysVisible:true});
  assert.equal(presentationPreferences(stored()).densityPersisted,false);
  assert.equal(Object.hasOwn(stored().visibility.ivocFable,'density'),false);
  assert.equal(stored().visibility.analyticsVisible,true);
});
test('explicit default reset removes only the density override',async()=>{
  const {c,stored}=setup();await saveOwnVisibility(c,{density:'interview',overlaysVisible:true,favoriteQuestions:['CORE-01']});
  const result=await saveOwnVisibility(c,{density:'default'});
  assert.equal(result.densityPersisted,false);assert.equal(result.density,'coached');
  assert.equal(stored().visibility.analyticsVisible,true);
  assert.equal(stored().visibility.ivocFable.overlaysVisible,true);
  assert.deepEqual(stored().visibility.ivocFable.favoriteQuestions,['CORE-01']);
  assert.equal(stored().visibility.otherOwnerField,'preserve');
});
test('late preference/mentor responses and queued writes cannot cross account or view',async()=>{
  const {c}=setup();let resolve,writes=0;const wait=new Promise(r=>resolve=r);
  c.account.api.preferences=async()=>{await wait;return null;};
  c.account.api.savePreferences=async()=>{writes++;return null;};
  const reading=readOwnPresentation(c),writing=saveOwnVisibility(c,{overlaysVisible:true});
  await new Promise(r=>setImmediate(r));c.account={...c.account,subject:'wp:2'};resolve();
  assert.equal(await reading,null);assert.equal(await writing,null);assert.equal(writes,0);
});
test('explicit Admin entry selects only an already admitted presentation role',()=>{
  assert.equal(advancedEntryRole('#mentor?view=admin',new Set(['student'])),'student');
  assert.equal(advancedEntryRole('#mentor',new Set(['student','admin'])),'student');
  assert.equal(advancedEntryRole('#mentor?view=admin',new Set(['student','admin'])),'admin');
  assert.equal(advancedEntryRole('#mentor?view=admin&subject=wp:2',new Set(['admin'])),'student');
});
test('persistent review label separates actor and selected owner; drops stale scope',()=>{
  const input={identity:{displayName:'Actor',subject:'wp:1'},role:'admin',selected:{subject:'wp:2',displayName:'Owner'},saved:{reviewScope:'admin',session:{ownerSubject:'wp:2'}},view:'filmroom'};
  assert.match(reviewScopeLabel(input),/Actor.*Admin.*Reviewing: Owner.*wp:2/);
  assert.doesNotMatch(reviewScopeLabel({...input,role:'student'}),/Reviewing/);
  assert.doesNotMatch(reviewScopeLabel({...input,saved:{reviewScope:'admin',session:{ownerSubject:'wp:3'}}}),/Owner|wp:2/);
});
