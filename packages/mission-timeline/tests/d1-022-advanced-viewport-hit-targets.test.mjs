import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {advancedFrameScreenBounds022,createObjectUrlRegistry} from '../web/js/407f-engineering-adapter.js';
import {canvasEffectiveHitClipPath,canvasPaintHitPath} from '../web/js/uxr-002/canvas.js';
import {applyAdvancedObjectAction,createMediaElement} from '../web/js/uxr-002/advanced-studio.js';
import {defaultDocument} from '../web/js/uxr-002/store.js';

const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const start=source.indexOf('let viewportChangeFrame=0;');
const end=source.indexOf('/* ===================== AAA-019 — selection engine',start);
assert.ok(start>0&&end>start);
const viewportHandler=new Function('requestAnimationFrame','advancedPointer','cancelAdvancedGesture','canvasController',
  `let onAdvancedViewportChange;${source.slice(start,end)}return onAdvancedViewportChange;`);

for(const selection of [null,{type:'element',id:'rectangle'}])test(`viewport changes refresh settled hit geometry with ${selection?'an existing selection':'no selection'}`,()=>{
  let frameId=0,frames=[],proxyBox={left:1205,top:468,width:148,height:60};
  let paintedBox={...proxyBox},refreshes=0;
  const focus={name:'Zoom percent'},application={identity:'persistent canvas'},model=Object.freeze({revision:7});
  const raf=callback=>{frames.push(callback);return++frameId;};
  const controller={state:{advancedSelection:selection},refreshEffectiveHitTargets(){refreshes++;raf(()=>{proxyBox={...paintedBox};});},
    render(){throw new Error('Viewport repair must not remount the canvas');},setUiState(){throw new Error('Viewport repair must not mutate state');}};
  const handler=viewportHandler(raf,null,()=>{},controller);
  handler();handler();assert.equal(frames.length,1);assert.equal(refreshes,0);
  const flush=()=>{const pending=frames;frames=[];pending.forEach(callback=>callback());};
  flush();assert.equal(refreshes,1);
  // The browser's layout/ResizeObserver work settles before the queued geometry pass.
  paintedBox={left:986,top:470,width:482,height:195};flush();
  assert.deepEqual(proxyBox,paintedBox);assert.equal(focus.name,'Zoom percent');
  assert.equal(application.identity,'persistent canvas');assert.equal(model.revision,7);
  paintedBox={...paintedBox,left:686,top:270};handler();flush();flush();
  assert.deepEqual(proxyBox,paintedBox);assert.equal(refreshes,2);
});

test('viewport refresh retains cancellation of a gesture using the previous coordinate mapping',()=>{
  const frames=[];let cancelled=0,refreshed=0;
  const handler=viewportHandler(callback=>{frames.push(callback);return frames.length;},{moved:true},()=>{cancelled++;},{refreshEffectiveHitTargets(){refreshed++;}});
  handler();assert.equal(cancelled,1);frames.shift()();assert.equal(refreshed,1);
});

test('rotated Founder photo selection measures its canonical frame despite a landscape fill overflowing the SVG group',()=>{
  const angle=-10*Math.PI/180,scale=.5;
  const matrix={a:Math.cos(angle)*scale,b:Math.sin(angle)*scale,c:-Math.sin(angle)*scale,d:Math.cos(angle)*scale,e:410,f:210};
  const geometry=Object.freeze({x:599,y:776,width:176,height:235});
  const rect={getBBox:()=>geometry,getScreenCTM:()=>matrix};
  const frame=(fillAspect)=>({fillAspect,querySelector:selector=>{assert.equal(selector,'rect');return rect;},
    getBoundingClientRect(){throw new Error('Clipped fill overflow must not determine the frame bounds');}});
  const portrait=advancedFrameScreenBounds022(frame(.6));
  const landscape=advancedFrameScreenBounds022(frame(2));
  assert.deepEqual(landscape,portrait);
  const expectedWidth=scale*(176*Math.cos(angle)+235*Math.abs(Math.sin(angle)));
  const expectedHeight=scale*(235*Math.cos(angle)+176*Math.abs(Math.sin(angle)));
  assert.ok(Math.abs(landscape.width-expectedWidth)<1e-9);
  assert.ok(Math.abs(landscape.height-expectedHeight)<1e-9);
  assert.ok(landscape.width<110&&landscape.height<132);
  assert.equal(landscape.right,landscape.left+landscape.width);
  assert.equal(landscape.bottom,landscape.top+landscape.height);
});

test('frame bounds degrade to the actual rectangle when an SVG matrix is unavailable',()=>{
  const bounds={left:10,top:20,right:90,bottom:120,width:80,height:100};
  assert.equal(advancedFrameScreenBounds022({querySelector:()=>({getBoundingClientRect:()=>bounds})}),bounds);
  assert.equal(advancedFrameScreenBounds022({querySelector:()=>null}),null);
});

test('offscreen proxies and painted hit regions stay clipped to the stage rather than intercepting the sidebar',()=>{
  const root={left:100,top:100},stage={left:594,top:450,right:1280,bottom:900};
  const box={left:371,top:403,width:140,height:140};
  const target={querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:471,top:503,width:140,height:140})};
  assert.equal(canvasEffectiveHitClipPath(box,root,stage),'inset(0px 0px 0px 123px)');
  assert.equal(canvasPaintHitPath(target,box,root,stage),'M123 0h17v140h-17Z');
  assert.equal(canvasEffectiveHitClipPath({...box,left:100},root,stage),'inset(50%)');
  const above={...target,getBoundingClientRect:()=>({left:700,top:100,width:140,height:140})};
  assert.equal(canvasPaintHitPath(above,box,root,stage),'');
});

test('44px target expansion remains available inside the stage while expansion outside it is clipped',()=>{
  const root={left:100,top:100},stage={left:594,top:450,right:1280,bottom:900};
  assert.equal(canvasEffectiveHitClipPath({left:500,top:360,width:44,height:44},root,stage),'inset(0px 0px 0px 0px)');
  assert.equal(canvasEffectiveHitClipPath({left:484,top:340,width:44,height:44},root,stage),'inset(10px 0px 0px 10px)');
});

test('the actual keyboard duplicate seam hydrates a new media ID from its retained source and supports delete/restore without reload',async()=>{
  const blob=new Blob(['synthetic-owner-image'],{type:'image/png'}),registry=createObjectUrlRegistry();
  const timeline=defaultDocument();timeline.mode='advanced';timeline.layoutLock=false;
  const original=createMediaElement({id:'original-media',file:{name:'synthetic.png',size:blob.size,type:'image/png'},naturalWidth:264,naturalHeight:439});
  original.source={...original.source,blobKey:'original-media'};timeline.advanced.media=[original];
  let draws=0,hydration;
  const store={document:timeline,entitlement:{canMutate:true},adapter:{getBlob:async key=>key==='original-media'?blob:null},replace(document){this.document=document;}};
  registry.set(original.id,blob);
  const helperStart=source.indexOf('  const hydrateMissingAdvancedMedia=');
  const helperEnd=source.indexOf('  const renderResponsiveAdvancedBoard=',helperStart);
  const hydrate=new Function('mediaUrls','store','productionRuntime','announceGlobal','canvasController','renderHomePreview','renderBuilderEmbeddedPreview','toastStudentError',
    `${source.slice(helperStart,helperEnd)}return hydrateMissingAdvancedMedia;`)(registry,store,null,()=>{},{render(){draws++;}},()=>{},()=>{},error=>{throw error;});
  const duplicateStart=source.indexOf('    const duplicateAdvancedSelection=');
  const duplicateEnd=source.indexOf('    const explainLockedSelection=',duplicateStart);
  const duplicate=new Function('store','advancedCommandTargets','applyAdvancedObjectAction','uid','toastStudentError','commitAdvancedSelection','hydrateMissingAdvancedMedia',
    `${source.slice(duplicateStart,duplicateEnd)}return duplicateAdvancedSelection;`)(store,selection=>[selection],applyAdvancedObjectAction,()=> 'copied-media',error=>{throw error;},()=>{},()=>{hydration=hydrate();return hydration;});
  try{
    assert.equal(duplicate({type:'media',id:original.id}),true);await hydration;
    assert.ok(registry.get('copied-media'));assert.equal(draws,1);
    const duplicateSnapshot=structuredClone(store.document);
    store.document=applyAdvancedObjectAction(store.document,{type:'media',id:'copied-media'},'delete').document;
    registry.revoke('copied-media');store.document=duplicateSnapshot;await hydrate();
    assert.ok(registry.get('copied-media'));assert.equal(draws,2);
    assert.equal(store.document.advanced.media.find(item=>item.id==='copied-media').source.blobKey,'original-media');
  }finally{registry.revokeAll();}
});
