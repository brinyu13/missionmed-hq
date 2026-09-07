import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeCollisionLayout,deterministicAutoArrange} from '../web/js/editor/collision-engine-410.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';

function timeline(){return{id:'collision-021',revision:1,theme:'keynote-classic',studentProfile:{},categories:[],events:[{id:'event-1',title:'Research Assistant',categoryId:'research',eventType:'duration',startDate:'2021-03',endDate:'2022-12',visibilityState:'INTERVIEWER_SAFE'}],advanced:{media:[],textBlocks:[],elements:[],groups:[]}};}
function place(document,id,geometry){return applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id},geometry,create:{type:'event',semanticRef:id,aspectLocked:false,presentation:{eventType:'duration'}},label:'Synthetic collision placement'}).document;}
const fixedText=(_text,size)=>size*4;
const analyze=document=>analyzeCollisionLayout(document,{scope:'FULL_STORY',measureText:fixedText,currentMonth:'2026-09'});

test('021 empty Founder has no fake furniture collisions and fixed regions come from canonical paint',()=>{
  const d=timeline();d.events=[];
  const result=analyze(d);
  assert.equal(result.geometrySource,'d1-founder-resolved-svg/1');
  assert.equal(result.stats.collisionCount,0);
  assert.deepEqual(result.warnings,[]);
  assert.equal(result.fixedRegions.find(region=>region.id==='furniture:profile').x,13);
  assert.equal(result.fixedRegions.find(region=>region.id==='furniture:profile').y,661);
  assert.ok(!result.fixedRegions.some(region=>/advisor-pin|sticky-note/.test(region.id)));
});

test('021 event move changes collision exactly where canonical SVG paints it and never changes facts',()=>{
  const original=timeline();
  const overlapping=place(original,'event-1',{x:100,y:710,width:250,height:40,rotation:0});
  assert.deepEqual(overlapping.events,original.events);
  const before=analyze(overlapping);
  assert.ok(before.warnings.some(w=>w.code==='RESERVED_REGION_COLLISION'&&w.elementIds.includes('furniture:profile')));
  const moved=place(overlapping,'event-1',{x:1300,y:500,width:250,height:40,rotation:0});
  const after=analyze(moved);
  assert.ok(!after.warnings.some(w=>w.elementIds.includes('furniture:profile')));
  const projection=resolveFounderPresentationSvg(serializeFounderPresentation(moved,{scope:'FULL_STORY',currentMonth:'2026-09'}).svg,{measureText:fixedText});
  const arrow=projection.nodes.find(node=>node.semanticRef==='event-1'&&node.sourceAttributes['data-continuous-duration-arrow']);
  const collisionPart=after.boxes[0].parts.find(part=>part.id===arrow.id);
  assert.equal(collisionPart.x,arrow.bounds.x);
  assert.equal(collisionPart.y,arrow.bounds.y);
  assert.equal(collisionPart.w,arrow.bounds.width);
  assert.equal(collisionPart.h,arrow.bounds.height);
  assert.deepEqual(moved.events,original.events);
});

test('021 furniture overrides and canvas objects share collision projection',()=>{
  let d=place(timeline(),'event-1',{x:1300,y:500,width:250,height:40,rotation:0});
  const clean=analyze(d);
  assert.ok(!clean.warnings.some(w=>w.elementIds.includes('furniture:profile')));
  d.presentationOverrides={profileGeometry:{x:1200,y:480,width:545,height:410}};
  assert.ok(analyze(d).warnings.some(w=>w.elementIds.includes('furniture:profile')));
  d.presentationOverrides={};
  d.advanced.elements=[{id:'story-note',kind:'rectangle',x:1300,y:500,width:200,height:80,fill:'#ffffff'}];
  assert.ok(analyze(d).warnings.some(w=>w.code==='CANVAS_OBJECT_COLLISION'&&w.elementIds.includes('object:story-note')));
  d.advanced.elements[0].x=1600;d.advanced.elements[0].y=800;
  assert.ok(!analyze(d).warnings.some(w=>w.code==='CANVAS_OBJECT_COLLISION'));
});

test('021 actual date-label overlap and privacy filtering use rendered event geometry',()=>{
  let d=timeline();
  d.events.push({...d.events[0],id:'event-2',title:'Clinical Elective',categoryId:'clinical'});
  d=place(d,'event-1',{x:800,y:500,width:250,height:40,rotation:0});
  d=place(d,'event-2',{x:800,y:477,width:250,height:12,rotation:0});
  assert.ok(analyze(d).warnings.some(w=>w.code==='DATE_LABEL_COLLISION'));
  d.events[1].visibilityState='HIDDEN';
  assert.equal(analyze(d).stats.visibleEvents,1);
  assert.ok(analyze(d).warnings.every(w=>!w.elementIds.includes('event-2')));
  delete d.events[0].visibilityState;
  assert.equal(analyze(d).stats.visibleEvents,1,'Visibility counting follows the canonical renderer default as well as explicit scope');
});

test('021 deterministic auto-arrange preserves its existing chronology and lane-lock semantics',()=>{
  const events=[{id:'locked',startDate:'2021-01',endDate:'2021-06',lane:2,manualOffset:{laneLocked:true}},{id:'early',startDate:'2021-01',endDate:'2021-03'},{id:'later',startDate:'2021-04',endDate:'2021-07'}];
  events.forEach(event=>{event.visibilityState='INTERVIEWER_SAFE';});
  const facts=events.map(({lane,...event})=>structuredClone(event));
  const result=deterministicAutoArrange(events);
  assert.equal(events[0].lane,2);
  assert.equal(events[1].lane,0);
  assert.equal(events[2].lane,0);
  assert.equal(result.placed,3);
  assert.deepEqual(events.map(({lane,...event})=>event),facts);
});

test('021 event rotation is measured from actual rotated paint rather than unrotated model boxes',()=>{
  const d=place(timeline(),'event-1',{x:1200,y:450,width:250,height:40,rotation:0});
  const before=analyze(d);
  const rotated=place(d,'event-1',{x:1200,y:450,width:250,height:40,rotation:30});
  const result=analyze(rotated);
  assert.notEqual(result.boxes[0].h,before.boxes[0].h);
  assert.ok(result.boxes[0].parts.some(part=>Math.abs(part.rotation-30)<1e-8));
  const projection=resolveFounderPresentationSvg(serializeFounderPresentation(rotated,{scope:'FULL_STORY',currentMonth:'2026-09'}).svg,{measureText:fixedText});
  const arrow=projection.nodes.find(node=>node.semanticRef==='event-1'&&node.sourceAttributes['data-continuous-duration-arrow']);
  const part=result.boxes[0].parts.find(item=>item.id===arrow.id);
  assert.ok(Math.abs(part.x-arrow.bounds.x)<1e-8);
  assert.ok(Math.abs(part.y-arrow.bounds.y)<1e-8);
  assert.ok(Math.abs(part.w-arrow.bounds.width)<1e-8);
  assert.ok(Math.abs(part.h-arrow.bounds.height)<1e-8);
});
