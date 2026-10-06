import assert from 'node:assert/strict';
import test from 'node:test';
import {applySceneCommandToDocument,applyLocalLayoutCriticSceneCommand,executeSceneCommand} from '../web/js/editor/scene-commands.js';
import {projectLayoutCritic,applyLayoutRecommendations} from '../web/js/presentation/layout-critic-projection.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

// Synthetic unit inputs only: no provider transport or private applicant facts.
const options={scope:'EVERYTHING',currentMonth:'2026-10'};
const fresh=()=>{const d=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M02').document);d.events=d.events.filter(e=>e.id==='work');d.mode='advanced';return d;};
const object=d=>d.advanced.scene.objects.find(item=>item.semanticRef==='work');
const move=(p,y)=>({kind:'SET_EVENT_Y',targetId:p.input.targets[0].id,y,reasonCode:'REDUCE_COLLISION',confidence:.8});
const output=(p,ops)=>({sceneDigest:p.sceneDigest,recommendations:ops});
async function automatic(){
 let d=fresh();const p=await projectLayoutCritic(d,options),t=p.localContext.targetMap.get('e0001');
 d=applyLocalLayoutCriticSceneCommand(d,{kind:'geometry',target:{type:'event',id:t.objectId},geometry:{...t.geometry,y:400},create:{type:'event',semanticRef:t.eventId,aspectLocked:false,presentation:{eventType:'duration'}}},options).document;
 d.presentationOverrides.axis.localLayoutCriticAuto=true;
 return d;
}
function obstacle(d,y){const a=object(d);d.advanced.textBlocks=[{id:'unit-obstacle',text:'Synthetic obstacle',x:a.geometry.x+40,y:y+a.geometry.height/2,width:180,height:30,size:18,font:'Arial'}];return d;}

test('human event geometry revokes ownership; future critic and weights preserve the takeover',async()=>{
 const before=await automatic(),original=JSON.stringify(before),a=object(before);
 const human=applySceneCommandToDocument(before,{kind:'geometry',target:{type:'event',id:a.id},geometry:{...a.geometry,y:300},origin:'local layout critic'}, {...options,origin:'local layout critic'}).document;
 assert.equal(JSON.stringify(before),original);assert.equal(object(human).geometry.y,300);assert.equal(object(human).presentation.localLayoutCriticAuto,undefined);
 const p=await projectLayoutCritic(human,options);assert.equal(p.input.targets[0].editable,false);assert.equal(p.input.axis.editable,false);
 const weights={kind:'SET_YEAR_WEIGHTS',weights:p.input.axis.segments.map(s=>({segmentId:s.id,weight:2})),reasonCode:'BALANCE_SPACING',confidence:.8};
 const applied=await applyLayoutRecommendations(human,output(p,[move(p,400),weights]),p.sceneDigest,options);
 assert.equal(applied.applied,0);assert.equal(applied.rejected.length,2);assert.equal(applied.document,human);assert.equal(object(applied.document).geometry.y,300);
 assert.throws(()=>applyLocalLayoutCriticSceneCommand(human,{kind:'geometry',target:{type:'event',id:a.id},geometry:{...a.geometry,y:400}},options),/authored geometry/);
 assert.deepEqual(human.events,before.events);
});

test('human group transform revokes every child; ungroup cannot resurrect critic ownership',async()=>{
 let d=await automatic();const a=object(d);
 d=applySceneCommandToDocument(d,{kind:'add',object:{id:'unit-text',type:'text',geometry:{x:1200,y:400,width:120,height:30,rotation:0},presentation:{text:'Unit annotation'}}},options).document;
 d=applySceneCommandToDocument(d,{kind:'group',id:'unit-group',members:[{type:'event',id:a.id},{type:'text',id:'unit-text'}]},options).document;
 // Use a saved automatic member marker to exercise group-transform revocation
 // independently of the earlier grouping takeover.
 d.advanced.scene.objects.find(o=>o.id===a.id).presentation.localLayoutCriticAuto=true;
 const transformed=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'group',id:'unit-group'},geometry:{x:800,y:500,width:600,height:80,rotation:0}},options).document;
 assert.equal(object(transformed).presentation.localLayoutCriticAuto,undefined);
 const ungrouped=applySceneCommandToDocument(transformed,{kind:'ungroup',target:{type:'group',id:'unit-group'}},options).document;
 const p=await projectLayoutCritic(ungrouped,options);assert.equal(p.input.targets[0].editable,false);assert.equal(p.input.axis.editable,false);
 assert.notEqual(object(ungrouped).geometry.y,400);assert.deepEqual(ungrouped.events,d.events);
});

test('ordinary UI creation and duplication cannot grant automatic ownership',async()=>{
 const d=fresh(),p=await projectLayoutCritic(d,options),t=p.localContext.targetMap.get('e0001');
 const placed=applySceneCommandToDocument(d,{kind:'geometry',origin:'local layout critic',target:{type:'event',id:t.objectId},geometry:t.geometry,create:{type:'event',semanticRef:t.eventId,aspectLocked:false,presentation:{eventType:'duration',localLayoutCriticAuto:true}}},{...options,origin:'local layout critic'}).document;
 assert.equal(object(placed).presentation.localLayoutCriticAuto,undefined);assert.equal((await projectLayoutCritic(placed,options)).input.targets[0].editable,false);
 const owned=await automatic(),a=object(owned);
 const duplicated=executeSceneCommand(owned.advanced.scene,{kind:'duplicate',target:{type:'event',id:a.id},id:'human-copy'});
 assert.equal(duplicated.scene.objects.find(o=>o.id==='human-copy').presentation.localLayoutCriticAuto,undefined);
 assert.equal(duplicated.scene.objects.find(o=>o.id===a.id).presentation.localLayoutCriticAuto,true);
});

test('new automatic scene and subsequent approved critic adjustments retain ownership',async()=>{
 let d=obstacle(await automatic(),400);
 for(const y of [300,500]){
  // Deterministic reflow may clear overlap first; the measured residual
  // crowding still exercises a genuine safe improvement, never a fake result.
  const p=await projectLayoutCritic(d,options);assert.equal(p.input.targets[0].editable,true);assert.ok(p.input.safety.collisionCount+p.input.safety.crowdingCount>0);
  const applied=await applyLayoutRecommendations(d,output(p,[move(p,y)]),p.sceneDigest,options);
  assert.equal(applied.applied,1,JSON.stringify(applied.rejected));assert.equal(object(applied.document).presentation.localLayoutCriticAuto,true);assert.equal(object(applied.document).geometry.y,y);
  assert.deepEqual(applied.document.events,d.events);d=obstacle(applied.document,y);
 }
});

test('critic origin cannot bypass locked targets, target type or source identity',async()=>{
 const d=await automatic(),a=object(d);a.locked=true;
 const locked=applyLocalLayoutCriticSceneCommand(d,{kind:'geometry',target:{type:'event',id:a.id},geometry:{...a.geometry,y:300}},options);assert.equal(locked.changed,false);assert.equal(locked.document,d);
 assert.throws(()=>applyLocalLayoutCriticSceneCommand(d,{kind:'geometry',target:{type:'group',id:'unit-group'},geometry:a.geometry}),/native event geometry/);
 assert.throws(()=>applyLocalLayoutCriticSceneCommand(fresh(),{kind:'geometry',target:{type:'event',id:'fake'},geometry:a.geometry,create:{type:'event',semanticRef:'missing'}}),/existing semantic event/);
});


test('first approved critic movement creates automatic geometry without a UI ownership flag',async()=>{
 const d=fresh(),initial=await projectLayoutCritic(d,options),t=initial.localContext.targetMap.get('e0001');
 d.advanced.textBlocks=[{id:'unit-first-obstacle',text:'Synthetic obstacle',x:t.geometry.x+40,y:t.geometry.y,width:180,height:30,size:18,font:'Arial'}];
 const p=await projectLayoutCritic(d,options);const initialTotal=p.input.safety.collisionCount+p.input.safety.crowdingCount;assert.ok(initialTotal>0);
 const applied=await applyLayoutRecommendations(d,output(p,[move(p,400)]),p.sceneDigest,options);
 assert.equal(applied.applied,1,JSON.stringify(applied.rejected));assert.equal(object(applied.document).presentation.localLayoutCriticAuto,true);
 const after=await projectLayoutCritic(applied.document,options);assert.ok(after.input.safety.collisionCount+after.input.safety.crowdingCount<initialTotal);
 assert.equal(after.input.targets[0].editable,true);assert.deepEqual(applied.document.events,d.events);
 const locked=structuredClone(applied.document);locked.layoutLock=true;const a=object(locked);
 assert.throws(()=>applyLocalLayoutCriticSceneCommand(locked,{kind:'geometry',target:{type:'event',id:a.id},geometry:{...a.geometry,y:300}},options),/globally locked/);
});


test('Fix for me releases unsafe year-drag Y retention without changing manual ownership source or year geometry',async()=>{
 const {reflowRetainedAutomaticRows}=await import('../web/js/uxr-002/quality-guardian.js');
 let d=await automatic();const a=object(d);delete a.presentation.localLayoutCriticYExplicit;a.presentation.localLayoutCriticYRetained=true;
 d=obstacle(d,a.geometry.y);const source=structuredClone(d.events),axis=structuredClone(d.presentationOverrides.axis),fixed=structuredClone(d.advanced.textBlocks);
 const result=reflowRetainedAutomaticRows(d);assert.equal(result.changed,true);assert.ok(result.after.collisions<result.before.collisions);assert.equal(result.after.chronology,0);
 assert.deepEqual(d.events,source);assert.deepEqual(d.presentationOverrides.axis,axis);assert.deepEqual(d.advanced.textBlocks,fixed);assert.equal(object(d).presentation.localLayoutCriticYRetained,undefined);
 for(const setup of [x=>delete x.presentation.localLayoutCriticAuto,x=>x.locked=true]){
  const blocked=await automatic(),owned=object(blocked);owned.presentation.localLayoutCriticYRetained=true;setup(owned);const original=JSON.stringify(blocked);assert.equal(reflowRetainedAutomaticRows(blocked).changed,false);assert.equal(JSON.stringify(blocked),original);
 }
});

test('explicit Fix for me can release prior AI-owned Y but never a later human takeover',async()=>{
 const {reflowRetainedAutomaticRows}=await import('../web/js/uxr-002/quality-guardian.js');
 const d=await automatic();object(d).presentation.localLayoutCriticYExplicit=true;obstacle(d,object(d).geometry.y);
 const source=structuredClone(d.events),geometry=structuredClone(object(d).geometry);assert.equal(reflowRetainedAutomaticRows(d).changed,true);assert.equal(object(d).presentation.localLayoutCriticYExplicit,undefined);assert.deepEqual(object(d).geometry,geometry);assert.deepEqual(d.events,source);
 const human=await automatic();delete object(human).presentation.localLayoutCriticAuto;obstacle(human,object(human).geometry.y);const before=JSON.stringify(human);assert.equal(reflowRetainedAutomaticRows(human).changed,false);assert.equal(JSON.stringify(human),before);
});


test('painted proposal chronology includes fixed human neighbors and rejects a new automatic floater',async()=>{
 const {paintedDurationInversions,qualifyRenderedLayoutImprovement}=await import('../web/js/uxr-002/quality-guardian.js');
 const {serializeFounderPresentation}=await import('../web/js/presentation/founder-presentation-serializer.js');
 let d=fresh();const early={...d.events[0],id:'early',startDate:'2024-01',endDate:'2024-03'},late={...d.events[0],id:'late',startDate:'2024-05',endDate:'2024-08'};d.events=[early,late];
 for(const [id,x,y] of [['early',1000,400],['late',1300,550]])d=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id},geometry:{x,y,width:180,height:44,rotation:0},create:{type:'event',semanticRef:id,aspectLocked:false,presentation:{eventType:'duration'}}},options).document;
 const a=d.advanced.scene.objects.find(o=>o.semanticRef==='early');a.presentation.localLayoutCriticAuto=true;a.presentation.localLayoutCriticYExplicit=true;
 const before=serializeFounderPresentation(d,options),changed=structuredClone(d);changed.advanced.scene.objects.find(o=>o.semanticRef==='early').geometry.y=700;
 const after=serializeFounderPresentation(changed,options);
 assert.deepEqual(paintedDurationInversions(before),[]);assert.ok(paintedDurationInversions(after).includes('early|late'));
 assert.equal(qualifyRenderedLayoutImprovement(before,after,{beforeDocument:d,afterDocument:changed}).reasonCode,'LAYOUT_PROPOSAL_CHRONOLOGY_WORSENED');
 assert.deepEqual(changed.events,d.events);assert.equal(changed.advanced.scene.objects.find(o=>o.semanticRef==='late').geometry.y,550);
 // Same-start events may separate vertically without an invented date order.
 const same={...after,scene:{...after.scene,arrows:after.scene.arrows.map(o=>({...o,startDate:'2024-05',startMonth:'2024-05'}))}};assert.deepEqual(paintedDurationInversions(same),[]);
 // The diagnostic preserves an existing human exception unchanged; acceptance
 // compares pair identities instead of invalidating manual ownership globally.
 assert.deepEqual(paintedDurationInversions(after),paintedDurationInversions(serializeFounderPresentation(changed,options)));
});
