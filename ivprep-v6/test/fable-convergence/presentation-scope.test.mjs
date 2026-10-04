import test from 'node:test';
import assert from 'node:assert/strict';
import {readOwnPresentation,saveOwnVisibility,presentationPreferences} from '../../public/studio-fable/app/adapters/own-presentation.mjs';
import {advancedEntryRole,reviewScopeLabel} from '../../public/studio/advanced-entry.mjs';
function setup() {
  let stored={scopeSubject:'wp:1',calibration:{version:7},visibility:{analyticsVisible:true,otherOwnerField:'preserve'},coachingEnabled:false,recordingDefault:false};
  const c={account:{mode:'REAL',subject:'wp:1',role:'admin',api:{
    identity:{subject:'wp:1',admin:true},
    bootstrap:async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true},preferences:stored}),
    mentorPriorities:async()=>({subjectId:'wp:1',priorities:[{text:'Name your contribution.'}]}),
    preferences:async()=>stored,savePreferences:async value=>(stored={scopeSubject:'wp:1',...value}),
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
test('preference reads and merges require the request-bound owner receipt, including ABA actor changes',async()=>{
  for(const operation of ['read','write'])for(const scopeSubject of [undefined,'wp:2']){
    const{c}=setup();let writes=0;c.account.api.preferences=async()=>({scopeSubject,visibility:{ivocFable:{favoriteQuestions:['CORE-02']}}});
    c.account.api.savePreferences=async()=>{writes++;return null;};
    await assert.rejects(operation==='read'?readOwnPresentation(c):saveOwnVisibility(c,{overlaysVisible:true}),/account.*changed/i);
    assert.equal(writes,0);
  }
});
test('preference reads recheck actual admission after the response, not the cached actor label',async()=>{
  const{c}=setup();let actor='wp:1';c.account.api.bootstrap=async()=>({entitlement:{admitted:true},identity:{subject:actor,admin:true}});
  c.account.api.preferences=async()=>{actor='wp:2';return{scopeSubject:'wp:1',visibility:{}};};
  await assert.rejects(readOwnPresentation(c),/access.*changed/i);
});
test('null preference GET during an ABA login uses the atomic admitted bootstrap projection',async()=>{
  const{c,stored}=setup();
  stored().visibility.ivocFable={favoriteQuestions:['CORE-02'],density:'interview'};
  // Another actor with no preferences can return null while bootstrap before
  // and after the request correctly identifies the original admitted actor.
  c.account.api.preferences=async()=>null;
  const read=await readOwnPresentation(c);
  assert.deepEqual(read.preferences.favoriteQuestions,['CORE-02']);
  assert.equal(read.preferences.density,'interview');
  await saveOwnVisibility(c,{overlaysVisible:true});
  assert.deepEqual(stored().calibration,{version:7});
  assert.equal(stored().visibility.otherOwnerField,'preserve');
  assert.deepEqual(stored().visibility.ivocFable.favoriteQuestions,['CORE-02']);
  assert.equal(stored().visibility.ivocFable.density,'interview');
  assert.equal(stored().coachingEnabled,false);assert.equal(stored().recordingDefault,false);
});
test('null preference GET cannot infer defaults from a bootstrap missing its preference projection',async()=>{
  for(const operation of ['read','write']){
    const{c}=setup();let writes=0;c.account.api.preferences=async()=>null;
    c.account.api.bootstrap=async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true}});
    c.account.api.savePreferences=async()=>{writes++;return null;};
    await assert.rejects(operation==='read'?readOwnPresentation(c):saveOwnVisibility(c,{overlaysVisible:true}),/preference.*unavailable/i);
    assert.equal(writes,0);
  }
});
test('a genuinely admitted account with no saved preferences retains default behavior',async()=>{
  const{c,stored}=setup();c.account.api.preferences=async()=>null;
  c.account.api.bootstrap=async()=>({entitlement:{admitted:true},identity:{subject:'wp:1',admin:true},preferences:null});
  assert.equal((await readOwnPresentation(c)).preferences.densityPersisted,false);
  await saveOwnVisibility(c,{overlaysVisible:true});
  assert.deepEqual(stored().calibration,{});assert.equal(stored().visibility.ivocFable.overlaysVisible,true);
});
test('preference writes are serialized fresh merges and preserve other subsystems',async()=>{
  const {c,stored}=setup();await Promise.all([saveOwnVisibility(c,{density:'interview'}),saveOwnVisibility(c,{overlaysVisible:true}),saveOwnVisibility(c,{favoriteQuestions:['CORE-01','CORE-01','bad id']})]);
  assert.deepEqual(stored().calibration,{version:7});assert.equal(stored().visibility.otherOwnerField,'preserve');
  assert.equal(stored().coachingEnabled,false);assert.equal(stored().recordingDefault,false);
  assert.deepEqual(presentationPreferences(stored()),{density:'interview',densityPersisted:true,overlaysVisible:true,overlayLayers:{face:true,bodyHands:true,position:true},favoriteQuestions:['CORE-01']});
  assert.equal(Object.hasOwn(stored().visibility.ivocFable,'densityPersisted'),false);
});
test('mock defaults remain distinct until density is explicitly saved',()=>{
  assert.equal(presentationPreferences({visibility:{analyticsVisible:true}}).densityPersisted,false);
  assert.equal(presentationPreferences({visibility:{ivocFable:{density:'coached'}}}).densityPersisted,true);
});
test('overlay layer writes merge independently without resetting visibility or density',async()=>{
  const {c,stored}=setup();await saveOwnVisibility(c,{overlaysVisible:true});
  await Promise.all([saveOwnVisibility(c,{overlayLayers:{face:false}}),saveOwnVisibility(c,{overlayLayers:{bodyHands:false,unexpected:true}})]);
  const result=presentationPreferences(stored());
  assert.deepEqual(result.overlayLayers,{face:false,bodyHands:false,position:true});
  assert.equal(result.overlaysVisible,true);assert.equal(result.densityPersisted,false);
  assert.equal(stored().visibility.otherOwnerField,'preserve');
  await saveOwnVisibility(c,{overlaysVisible:false});assert.deepEqual(presentationPreferences(stored()).overlayLayers,result.overlayLayers);
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
