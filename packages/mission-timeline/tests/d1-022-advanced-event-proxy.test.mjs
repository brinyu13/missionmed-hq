import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {installCanvas,createCanvasState} from '../web/js/uxr-002/canvas.js';
import {defaultDocument} from '../web/js/uxr-002/store.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {constrainAdvancedObjectToBoard,resizeMediaElement,moveMediaElement} from '../web/js/uxr-002/advanced-studio.js';

const adapter=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
function section(start,end){const a=adapter.indexOf(start),b=adapter.indexOf(end,a);assert.ok(a>=0&&b>a);return adapter.slice(a,b);}
function fixture(mode='advanced'){
  const d=defaultDocument();d.mode=mode;d.layoutLock=false;d.preferences.advancedFreePlacementInitialized=true;
  d.events=[{id:'synthetic-arrow',title:'Synthetic Volunteer',categoryId:'work',eventType:'duration',startDate:'2019-01',endDate:'2021-12',openEnded:false,visibilityState:'INTERVIEWER_SAFE',fields:{organization:'Synthetic Clinic'},provenance:[{kind:'SOURCE_FACT',reference:'synthetic-cv-v1'}]}];
  return d;
}
class Store{
  constructor(mode='advanced'){this.document=fixture(mode);this.entitlement={canMutate:true};this.entries=[];}
  mutate(label,fn){const before=structuredClone(this.document);fn(this.document);if(JSON.stringify(before)===JSON.stringify(this.document))return false;this.entries.push({before,label});return true;}
  replace(d,{label}){this.entries.push({before:structuredClone(this.document),label});this.document=d;}
  undo(){const entry=this.entries.pop();if(entry)this.document=entry.before;return entry;}
  historyStatus(){return{canUndo:!!this.entries.length};}
}
class Root{
  constructor(){this.listeners=new Map();this.dataset={};this.innerHTML='';}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  querySelector(){return null;}
}
const eventTarget={dataset:{eventId:'synthetic-arrow',eventKind:'arrow'},matches:()=>false,closest(selector){return ['[data-canvas-event]','.canvas-application','.canvas-application,[data-canvas-event],[data-context-toolbar]'].includes(selector)?this:null;},getBoundingClientRect:()=>({width:1920,height:1080})};
function input(extra={}){return{target:eventTarget,key:'ArrowRight',button:0,clientX:100,clientY:100,preventDefault(){this.prevented=true;},...extra};}

for(const mode of ['guided','advanced'])test(`actual delegated ${mode} event click, focus, double click and arrow keys use their mode's owner`,()=>{
  const root=new Root(),store=new Store(mode),before=structuredClone(store.document.events);
  const priorDocument=globalThis.document;globalThis.document={addEventListener(){},removeEventListener(){}};
  const controller=installCanvas(root,store,{state:{...createCanvasState({mode}),entitlementEditable:true},currentMonth:()=> '2026-07'});
  root.listeners.get('focusin')(input());root.listeners.get('click')(input());
  assert.equal(controller.state.selectedEventId,mode==='guided'?'synthetic-arrow':null);
  root.listeners.get('dblclick')(input());
  assert.equal(Boolean(controller.state.inlineEdit),mode==='guided');
  controller.setUiState({inlineEdit:null,selectedEventId:'synthetic-arrow'});
  root.listeners.get('keydown')(input());
  if(mode==='guided'){assert.notDeepEqual(store.document.events,before);assert.equal(store.document.events[0].startDate,'2019-02');}
  else{assert.deepEqual(store.document.events,before);assert.equal(store.entries.length,0);assert.doesNotMatch(root.innerHTML,/data-selection-handles/);}
  controller.destroy();globalThis.document=priorDocument;
});

for(const scenario of ['guided','advanced','read-only','mode-change-before-move','mode-change-before-release'])test(`actual delegated pointer transaction: ${scenario}`,()=>{
  const root=new Root(),store=new Store(scenario==='advanced'?'advanced':'guided');
  const originalGlobal=globalThis.document,globalListeners=new Map();
  globalThis.document={addEventListener:(k,v)=>globalListeners.set(k,v),removeEventListener:k=>globalListeners.delete(k)};
  const controller=installCanvas(root,store,{state:{...createCanvasState({mode:store.document.mode}),entitlementEditable:scenario!=='read-only'},currentMonth:()=> '2026-07'});
  const before=structuredClone(store.document.events);
  try{
    root.listeners.get('pointerdown')(input());
    if(scenario==='mode-change-before-move')store.document.mode='advanced';
    globalListeners.get('pointermove')(input({clientX:180}));
    if(scenario==='mode-change-before-release')store.document.mode='advanced';
    globalListeners.get('pointerup')();
    if(scenario==='guided'){assert.notDeepEqual(store.document.events,before);assert.equal(store.entries.length,1);}
    else{assert.deepEqual(store.document.events,before);assert.equal(store.entries.length,0);assert.equal(controller.state.drag,null);}
  }finally{controller.destroy();globalThis.document=originalGlobal;}
});

const resolveFactory=new Function('store','canvasHost','sceneVisualNode','clone','advancedGroupObject','advancedFrameNode',
  section('    const advancedEventSelector=','    const restoreAdvancedObjectFocus=')+'return {advancedObjectForTarget,advancedEventSelector};');
for(const kind of ['arrow','flag'])test(`actual ${kind} paint proxy resolves the token-paired SVG geometry, excluding other hit proxies`,()=>{
  const store=new Store(),queries=[];
  const source={identity:'SVG source',closest:()=>null};
  const proxy={dataset:{eventId:'synthetic-arrow',eventKind:kind,canvasEffectiveHitToken:'pair-17'},hasAttribute:k=>k==='data-canvas-effective-hit-proxy',closest(selector){return selector.startsWith('[data-event-kind="arrow"]')?this:null;}};
  const host={querySelector(selector){queries.push(selector);return selector.includes('data-canvas-effective-hit-token="pair-17"')?source:null;}};
  const {advancedObjectForTarget,advancedEventSelector}=resolveFactory(store,host,n=>n,structuredClone,()=>null,()=>null);
  const result=advancedObjectForTarget(proxy);assert.equal(result.element,source);assert.equal(result.id,'synthetic-arrow');assert.equal(result.type,'event');assert.equal(queries.length,1);
  assert.match(advancedEventSelector('synthetic-arrow'),/:not\(\[data-canvas-effective-hit-proxy\]\)/);
  store.document.events=[];assert.equal(advancedObjectForTarget(proxy),null);
});
test('a stale proxy without an SVG source fails closed instead of measuring its expanded rectangle',()=>{
  const proxy={dataset:{eventId:'synthetic-arrow',eventKind:'arrow',canvasEffectiveHitToken:'removed'},hasAttribute:()=>true,closest(selector){return selector.startsWith('[data-event-kind="arrow"]')?this:null;}};
  const {advancedObjectForTarget}=resolveFactory(new Store(),{querySelector:()=>null},n=>n,structuredClone,()=>null,()=>null);
  assert.equal(advancedObjectForTarget(proxy),null);
});

const nudgeFactory=new Function('store','canvasHost','clone','applySceneCommandToDocument','constrainAdvancedObjectToBoard','resizeMediaElement','moveMediaElement','advancedGroupMembers','commitAdvancedSelection','explainLockedSelection',
  section('    const advancedEventSelector=','    const advancedSourceElement=')+
  section('    const eventPresentationItem=','    const advancedObjectForTarget=')+
  section('    const advancedLeafMembers=','    const commitAdvancedSelection=')+
  section('    const nudgeAdvancedSelection=','    const layerAdvancedSelection=')+'return nudgeAdvancedSelection;');
function nudgeHarness(){
  const store=new Store();let selections=0;
  const visual={getBBox:()=>({x:300,y:220,width:420,height:30})};
  const nudge=nudgeFactory(store,{querySelector:()=>({querySelector:()=>visual})},structuredClone,applySceneCommandToDocument,constrainAdvancedObjectToBoard,resizeMediaElement,moveMediaElement,()=>[],()=>selections++,()=>false);
  return{store,nudge,selections:()=>selections};
}
test('keyboard move materializes only event presentation, retains a thin arrow, and supports one-step Undo',()=>{
  const {store,nudge,selections}=nudgeHarness(),before=structuredClone(store.document),target={type:'event',id:'synthetic-arrow'};
  assert.equal(nudge(target,{x:10,y:0}),true);
  assert.deepEqual(store.document.events,before.events);assert.deepEqual(store.document.advanced.scene.objects[0].geometry,{x:310,y:220,width:420,height:30,rotation:0});
  assert.equal(selections(),1);assert.equal(store.entries.length,1);store.undo();assert.deepEqual(store.document,before);
});
test('keyboard Alt-resize uses persisted presentation geometry and keeps source facts and provenance intact',()=>{
  const {store,nudge}=nudgeHarness(),before=structuredClone(store.document.events),target={type:'event',id:'synthetic-arrow'};
  nudge(target,{x:10,y:0});nudge(target,{x:1,y:0},{resize:true});
  assert.deepEqual(store.document.events,before);assert.equal(store.document.advanced.scene.objects[0].geometry.width,421);assert.equal(store.document.advanced.scene.objects[0].geometry.height,30);assert.equal(store.entries.length,2);
});
for(const denial of ['read-only','layout-lock','object-lock'])test(`event keyboard geometry denies ${denial}`,()=>{
  const {store,nudge}=nudgeHarness(),target={type:'event',id:'synthetic-arrow'};nudge(target,{x:1,y:0});
  if(denial==='read-only')store.entitlement.canMutate=false;
  if(denial==='layout-lock')store.document.layoutLock=true;
  if(denial==='object-lock')store.document.advanced.scene.objects[0].locked=true;
  const before=structuredClone(store.document),count=store.entries.length;
  assert.equal(nudge(target,{x:10,y:10}),false);assert.deepEqual(store.document,before);assert.equal(store.entries.length,count);
});

const pointerFactory=new Function('store','canvasController','pointer','selectionIsLocked','document','callbacks',
  `let advancedPointer=pointer;let onAdvancedPointerDown,onAdvancedPointerMove,onAdvancedPointerUp;
   const advancedCrop=null,marqueePointer=null,axisPointer=null,railPointer=null;
   const advancedCropPointerMove=()=>false,advancedCropPointerUp=()=>false;
   const clearAdvancedFrameDropTarget=callbacks.clearFrame,clearAdvancedAlignmentGuides=callbacks.clearGuides,
     syncAdvancedSelectionChrome=callbacks.sync,announceGlobal=()=>{};
   ${section('    const canEditAdvancedGeometry=','    /* AAA-019 (Canva D2):')}
   ${section('    const cancelAdvancedGesture=','    const trackAdvancedSelectionChrome=')}
   ${section('    onAdvancedPointerMove=','    const railPayload=')}
   return {down:onAdvancedPointerDown,move:onAdvancedPointerMove,up:onAdvancedPointerUp,pending:()=>advancedPointer};`);
function pointerHarness(){
  const store=new Store(),controller={state:{entitlementEditable:true,responsive:{viewOnly:false}}};
  const node={dataset:{advancedDragging:'move',advancedResizeHandle:'move'},transform:'translate(60 20)',setAttribute(k,v){assert.equal(k,'transform');this.transform=v;},removeAttribute(k){assert.equal(k,'transform');this.transform=null;}};
  let locked=false,clearedFrame=0,clearedGuides=0,synced=0;
  const pointer={type:'event',id:'synthetic-arrow',modeAtPress:'advanced',moved:true,element:node,originalTransform:'translate(5 8)',svg:{}};
  const handlers=pointerFactory(store,controller,pointer,()=>locked,{querySelectorAll:()=>[]},{clearFrame:()=>clearedFrame++,clearGuides:()=>clearedGuides++,sync:()=>synced++});
  return{store,controller,node,handlers,lock:()=>locked=true,cleanup:()=>({clearedFrame,clearedGuides,synced})};
}
for(const boundary of ['move','up'])for(const denial of ['read-only','canvas-read-only','responsive-read-only','layout-lock','mode-change','object-lock'])test(`actual Advanced ${boundary} cancels and restores an in-flight preview after ${denial}`,()=>{
  const h=pointerHarness();
  if(denial==='read-only')h.store.entitlement.canMutate=false;
  if(denial==='canvas-read-only')h.controller.state.entitlementEditable=false;
  if(denial==='responsive-read-only')h.controller.state.responsive.viewOnly=true;
  if(denial==='layout-lock')h.store.document.layoutLock=true;
  if(denial==='mode-change')h.store.document.mode='guided';
  if(denial==='object-lock')h.lock();
  const before=structuredClone(h.store.document);
  h.handlers[boundary](input());
  assert.equal(h.handlers.pending(),null);assert.equal(h.node.transform,'translate(5 8)');assert.deepEqual(h.node.dataset,{});
  assert.deepEqual(h.store.document,before);assert.equal(h.store.entries.length,0);assert.deepEqual(h.cleanup(),{clearedFrame:1,clearedGuides:1,synced:1});
});
for(const denial of ['read-only','canvas-read-only','responsive-read-only'])test(`actual Advanced pointerdown never starts a preview or inline submit when ${denial}`,()=>{
  const h=pointerHarness();
  if(denial==='read-only')h.store.entitlement.canMutate=false;
  if(denial==='canvas-read-only')h.controller.state.entitlementEditable=false;
  if(denial==='responsive-read-only')h.controller.state.responsive.viewOnly=true;
  h.controller.state.advancedTextEdit={id:'existing-draft'};
  const before=h.handlers.pending();h.handlers.down({get target(){throw new Error('Read-only pointer must stop before mutable target processing');}});
  assert.equal(h.handlers.pending(),before);assert.deepEqual(h.cleanup(),{clearedFrame:0,clearedGuides:0,synced:0});assert.equal(h.store.entries.length,0);
});

function noteStore(mode='advanced'){
  const store=new Store(mode);store.document.events[0].fields={builderDomain:'explanation',elementType:'explanation',explanationText:'Synthetic explanation',x:1200,y:580,width:300,height:160,leaderEnabled:false};return store;
}
function noteFacts(events){return events.map(event=>{const copy=structuredClone(event);for(const key of ['x','y','width','height'])delete copy.fields[key];return copy;});}
for(const mode of ['guided','advanced'])test(`existing ${mode} explanation selection and keyboard free move/resize preserve every source fact`,()=>{
  const root=new Root(),store=noteStore(mode),prior=globalThis.document;globalThis.document={addEventListener(){},removeEventListener(){}};
  const controller=installCanvas(root,store,{state:{...createCanvasState({mode}),entitlementEditable:true},currentMonth:()=> '2026-07'});
  const before=structuredClone(store.document.events);
  try{
    root.listeners.get('focusin')(input());root.listeners.get('click')(input());assert.equal(controller.state.selectedEventId,'synthetic-arrow');assert.match(root.innerHTML,/data-drag-kind="free-resize"/);
    root.listeners.get('keydown')(input());assert.equal(store.document.events[0].fields.x,1216);
    root.listeners.get('keydown')(input({key:'ArrowDown',shiftKey:true}));assert.equal(store.document.events[0].fields.height,176);assert.deepEqual(noteFacts(store.document.events),noteFacts(before));
    store.undo();store.undo();assert.deepEqual(store.document.events,before);
  }finally{controller.destroy();globalThis.document=prior;}
});
for(const scenario of ['normal','read-only-at-start','locked-at-start','revoke-before-move','revoke-before-release','lock-before-move','lock-before-release'])test(`Advanced explanation pointer exception preserves bounds/facts safely: ${scenario}`,()=>{
  const root=new Root(),store=noteStore(),prior=globalThis.document,listeners=new Map();globalThis.document={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
  const controller=installCanvas(root,store,{state:{...createCanvasState({mode:'advanced'}),entitlementEditable:true},currentMonth:()=> '2026-07'});
  if(scenario==='read-only-at-start')store.entitlement.canMutate=false;
  if(scenario==='locked-at-start')store.document.layoutLock=true;
  const before=structuredClone(store.document.events);
  try{
    root.listeners.get('pointerdown')(input());
    if(scenario==='revoke-before-move')store.entitlement.canMutate=false;
    if(scenario==='lock-before-move')store.document.layoutLock=true;
    listeners.get('pointermove')(input({clientX:145,clientY:125}));
    if(scenario==='revoke-before-release')store.entitlement.canMutate=false;
    if(scenario==='lock-before-release')store.document.layoutLock=true;
    listeners.get('pointerup')();
    if(scenario==='normal'){assert.equal(store.document.events[0].fields.x,1245);assert.equal(store.document.events[0].fields.y,605);assert.deepEqual(noteFacts(store.document.events),noteFacts(before));assert.equal(store.entries.length,1);store.undo();}
    assert.deepEqual(store.document.events,before);assert.equal(store.entries.length,0);assert.equal(controller.state.drag,null);
  }finally{controller.destroy();globalThis.document=prior;}
});
