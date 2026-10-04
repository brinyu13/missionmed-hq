import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {performance} from 'node:perf_hooks';
import {applySafeQualityFixes} from '../web/js/uxr-002/quality-guardian.js';
import {analyzeCollisionLayout} from '../web/js/editor/collision-engine-410.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {locked407FMilestoneGeometry} from '../web/js/uxr-002/locked-407f-export.js';

const source=readFileSync(new URL('../web/js/uxr-002/quality-guardian.js',import.meta.url),'utf8');
const helperStart=source.indexOf('const MAX_LAYOUT_SEARCH_CANDIDATES=');
assert.ok(helperStart>=0,'The synchronous fix needs an explicit finite candidate budget.');
const helpers=source.slice(helperStart,source.indexOf('export function applySafeQualityFixes',helperStart));

function datedEvent(index,milestone=index<18){
 const startDate=milestone?`2023-${String(index%6+3).padStart(2,'0')}-19`:`${2020+index%5}-01-19`;
 const endDate=milestone?null:`${2020+index%5}-11-21`;
 return{id:`synthetic-${index}`,title:milestone
  ?`Synthetic documented milestone ${index} with a complete long source label and reviewed context`
  :`Synthetic longitudinal work role ${index} with a complete long source label`,
  categoryId:milestone?'personal':'work',eventType:milestone?'milestone':'duration',
  startDate,endDate,visibilityState:'INTERVIEWER_SAFE',sourceType:'document-intake',
  fields:{datePrecision:{start:'DAY',end:milestone?null:'DAY'},sourceDateWording:{start:{raw:startDate,normalizedMonth:startDate,precision:'DAY'},end:endDate?{raw:endDate,normalizedMonth:endDate,precision:'DAY'}:null}},
  provenance:[{sourceDocumentId:'synthetic-only',sourceExcerpt:`Synthetic evidence ${index}`}]};
}
function document(events=Array.from({length:25},(_,i)=>datedEvent(i))){
 return{id:'synthetic-guardian-25',events,studentProfile:{fullName:'Synthetic Avery'},exams:[],
  theme:'keynote-classic',metadata:{renderCurrentMonth:'2026-10'},
  advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[],groups:[]}};
}

// Count real analysis and scene-command invocations without changing the public
// production API. The extracted helpers are the exact checked-in implementation.
function measuredSearch(input,analyze=analyzeCollisionLayout){
 const working=structuredClone(input),counts={analyses:0,commands:0,scenes:0};
 const context={document:working,safeArray:value=>Array.isArray(value)?value:[],clone:structuredClone,
  analyzeCollisionLayout:(...args)=>{counts.analyses++;return analyze(...args);},
  serializeFounderPresentation:(...args)=>{counts.scenes++;return serializeFounderPresentation(...args);},
  applySceneCommandToDocument:(...args)=>{counts.commands++;return applySceneCommandToDocument(...args);},
  locked407FMilestoneGeometry};
 const start=performance.now(),result=runInNewContext(helpers+'\nautoArrangeWithoutWorsening(document);',context);
 return{result,document:working,counts,elapsedMs:performance.now()-start};
}
const collisionFix={findings:[{actionMode:'FIX_FOR_ME',fixKind:'AUTO_ARRANGE_EVENTS'}]};

test('25 source-shaped dated events use bounded real work and never worsen measured collisions',t=>{
 const input=document(),before=JSON.stringify(input),measured=measuredSearch(input);
 assert.equal(input.events.length,25);assert.equal(input.events.filter(event=>event.eventType==='milestone').length,18);
 assert.ok(measured.counts.analyses<=9,`Unbounded collision analyses: ${measured.counts.analyses}`);
 assert.ok(measured.counts.commands<=8,`Unbounded scene commands: ${measured.counts.commands}`);
 assert.ok(measured.counts.scenes<=measured.counts.commands+1,'Reuse unchanged milestone scenes rather than serializing each flag.');
 const after=analyzeCollisionLayout(measured.document,{scope:'FULL_STORY'}).stats.collisionCount;
 assert.equal(measured.result.after,after);
 assert.ok(after<=measured.result.before);
 if(measured.result.changed)assert.ok(after<measured.result.before);
 assert.deepEqual(measured.document.events,input.events,'Ineffective lane values and every source date, title, precision and provenance stay unchanged.');
 assert.deepEqual(measured.document.studentProfile,input.studentProfile);
 assert.deepEqual(measured.document.exams,input.exams);
 assert.equal(JSON.stringify(input),before);
 t.diagnostic(JSON.stringify({eventCount:25,...measured.counts,elapsedMs:Math.round(measured.elapsedMs),before:measured.result.before,after}));
});

test('public Fix for me preserves all source facts and returns a deterministic bounded proposal',t=>{
 const input=document(),before=JSON.stringify(input),start=performance.now();
 const first=applySafeQualityFixes(input,collisionFix),elapsedMs=performance.now()-start;
 assert.deepEqual(first.document.events,input.events);assert.deepEqual(first.document.studentProfile,input.studentProfile);
 assert.deepEqual(first.document.exams,input.exams);
 assert.equal(first.semanticFieldsChanged,false);assert.equal(first.biographyFieldsChanged,false);
 const originalCount=analyzeCollisionLayout(input,{scope:'FULL_STORY'}).stats.collisionCount;
 const finalCount=analyzeCollisionLayout(first.document,{scope:'FULL_STORY'}).stats.collisionCount;
 assert.ok(finalCount<=originalCount);
 if(first.changed)assert.ok(finalCount<originalCount);
 const second=applySafeQualityFixes(input,collisionFix);
 assert.deepEqual(second.document,first.document);
 assert.equal(JSON.stringify(input),before);
 t.diagnostic(JSON.stringify({publicFixElapsedMs:Math.round(elapsedMs),before:originalCount,after:finalCount}));
});

test('an exhausted renderer-effective lane budget leaves equal or worse candidates unchanged',()=>{
 const input=document(Array.from({length:25},(_,i)=>({...datedEvent(i,false),lane:0,manualOffset:{laneLocked:true,x:0,y:0}})));
 const immutableReview={stats:{collisionCount:1},warnings:[],fixedRegions:[],boxes:input.events.map(event=>({id:event.id,kind:'event'}))};
 const measured=measuredSearch(input,()=>immutableReview);
 assert.ok(measured.counts.analyses<=9,'The shared budget is independent of the number of locked durations.');
 assert.ok(measured.counts.analyses>1,'Renderer-effective candidates must still be measured.');
 assert.equal(measured.result.changed,false);assert.equal(measured.result.before,1);assert.equal(measured.result.after,1);
 assert.deepEqual(measured.document,input,'Every rejected trial restores its lane and preserves manualOffset.');
});

test('ineffective lanes and explicit Advanced event geometry never enter the lane search',()=>{
 const events=[datedEvent(0),datedEvent(18,false),{...datedEvent(19,false),id:'authored-duration',lane:0,manualOffset:{laneLocked:true}},
  {...datedEvent(20,false),id:'education-duration',categoryId:'education',lane:0,manualOffset:{laneLocked:true}},
  {...datedEvent(21,false),id:'explanation-duration',lane:0,manualOffset:{laneLocked:true},fields:{builderDomain:'explanation'}}];
 let input=document(events);
 input=applySceneCommandToDocument(input,{kind:'geometry',target:{type:'event',id:'authored-duration'},geometry:{x:900,y:480,width:220,height:35,rotation:0},create:{type:'event',semanticRef:'authored-duration',presentation:{eventType:'duration'}}},{scope:'FULL_STORY'}).document;
 const object=input.advanced.scene.objects.find(item=>item.semanticRef==='authored-duration');object.locked=true;
 const immutableReview={stats:{collisionCount:1},warnings:[],fixedRegions:[],boxes:events.map(event=>({id:event.id,kind:'event'}))};
 const measured=measuredSearch(input,()=>immutableReview);
 assert.equal(measured.counts.analyses,1,'None of these lane values controls the rendered event position.');
 assert.equal(measured.counts.commands,0);assert.equal(measured.result.changed,false);
 assert.deepEqual(measured.document,input);
});
