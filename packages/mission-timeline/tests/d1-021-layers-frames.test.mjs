import assert from 'node:assert/strict';
import test from 'node:test';
import {advancedLayerRows,renderLayersPanel,toggleAdvancedSelection,reorderAdvancedLayers,hitTestMediaFrames,fillCanonicalMediaFrame,planModeSwitch} from '../web/js/uxr-002/advanced-studio.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {sceneObjectById} from '../web/js/editor/scene-graph.js';
import {TimelineStore,defaultDocument} from '../web/js/uxr-002/store.js';
import {MemoryPersistenceAdapter} from '../web/js/persistence/memory-adapter.js';
const source=()=>({...defaultDocument(),mode:'advanced',layoutLock:false,events:[{id:'event-a',title:'Synthetic research',categoryId:'research',eventType:'duration',startDate:'2020-01',endDate:'2021-01'}],advanced:{media:[{id:'image-a',type:'media',kind:'image',source:{name:'synthetic.png',blobKey:'image-a'},placed:true,libraryAsset:true,x:100,y:100,width:300,height:180,rotation:10}],elements:[{id:'shape-a',kind:'rectangle',x:600,y:100,width:100,height:100}],textBlocks:[],groups:[]}});

test('Layers includes semantic events and nine canonical template objects without manufacturing scene geometry',()=>{
  const original=source(),before=structuredClone(original);
  const rows=advancedLayerRows(original);
  assert.equal(rows.length,12);
  assert.equal(rows.find(x=>x.id==='event-a').reorderable,false);
  assert.equal(rows.filter(x=>x.kind==='template').length,9);
  assert.equal(rows.filter(x=>x.type==='frame').length,5);
  assert.equal(rows.filter(x=>x.id==='image-a').length,1);
  assert.deepEqual(original,before);
  const html=renderLayersPanel(original,{type:'multi',members:[{type:'media',id:'image-a'},{type:'element',id:'shape-a'}]});
  assert.match(html,/aria-multiselectable="true"/);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,2);
  assert.match(html,/draggable="false"[^>]+data-advanced-layer-row="event:event-a"/);
});

test('Shift toggles Layers members and reduces selection accurately without mutating prior state',()=>{
  const a={type:'element',id:'a'},b={type:'element',id:'b'};
  const two=toggleAdvancedSelection(a,b,true);
  assert.deepEqual(two,{type:'multi',members:[a,b]});
  assert.deepEqual(toggleAdvancedSelection(two,a,true),b);
  assert.equal(toggleAdvancedSelection(a,a,true),null);
  assert.deepEqual(toggleAdvancedSelection(two,a,false),a);
  assert.deepEqual(two.members,[a,b]);
});

test('Layers reorder preserves canonical event geometry and source facts',()=>{
  const base=source();
  const placed=applySceneCommandToDocument(base,{kind:'geometry',target:{type:'event',id:'event-a'},geometry:{x:150,y:350,width:550,height:80,rotation:15},create:{type:'event',semanticRef:'event-a',aspectLocked:false,presentation:{eventType:'duration'}}}).document;
  const original=structuredClone(sceneObjectById(placed.advanced.scene,'event-a'));
  const result=reorderAdvancedLayers(placed,{type:'media',id:'image-a'},{type:'element',id:'shape-a'},'before');
  assert.equal(result.changed,true);
  assert.deepEqual(sceneObjectById(result.document.advanced.scene,'event-a').geometry,original.geometry);
  assert.deepEqual(result.document.events,placed.events);
  assert.deepEqual(result.document.advanced.media[0].source,placed.advanced.media[0].source);
  assert.equal(advancedLayerRows(result.document).find(x=>x.id==='event-a').reorderable,true);
  assert.equal(reorderAdvancedLayers(placed,{type:'frame',id:'profile'},{type:'media',id:'image-a'}).changed,false);
});

test('Frame hit detection follows Fit/100/150 screen transforms and excludes rotated bounding corners',()=>{
  for(const scale of [.43,1,1.5]){
    for(const degrees of [0,30,-35]){
      const theta=degrees*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
      const frame={slot:'photo1',geometry:{x:100,y:200,width:200,height:100},screenMatrix:{a:cos*scale,b:sin*scale,c:-sin*scale,d:cos*scale,e:700,f:240}};
      const screen=(x,y)=>({x:(cos*x-sin*y)*scale+700,y:(sin*x+cos*y)*scale+240});
      assert.equal(hitTestMediaFrames([frame],screen(200,250)),frame);
      assert.equal(hitTestMediaFrames([frame],screen(99,250)),null);
      assert.equal(hitTestMediaFrames([frame],screen(200,301)),null);
    }
  }
  assert.equal(hitTestMediaFrames([{geometry:{x:0,y:0,width:2,height:2},screenMatrix:{a:0,b:0,c:0,d:0,e:0,f:0}}],{x:0,y:0}),null);
});

test('Canvas image transfer fills one frame, retains upload bytes and creates one reversible store transaction',async()=>{
  const adapter=new MemoryPersistenceAdapter();
  const store=new TimelineStore({adapter,entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canCreate:true,canMutate:true,canExport:true,reason:'Synthetic test'}});
  try{
    await store.initialize();
    store.replace(source(),{history:false});
    const before=structuredClone(store.document),blob=new Blob(['synthetic'],{type:'image/png'});
    await adapter.putBlob('image-a',blob);
    const result=fillCanonicalMediaFrame(store.document,'profile','image-a',{id:'profile-fill',consumePlacement:true});
    assert.equal(result.changed,true);
    store.replace(result.document,{label:'Fill profile photo'});
    assert.equal(store.historyStatus().undoCount,1);
    assert.equal(store.document.mediaItems.length,1);
    assert.equal(store.document.mediaItems[0].mediaId,'image-a');
    assert.equal(store.document.advanced.media.length,1);
    assert.equal(store.document.advanced.media[0].placed,false);
    assert.deepEqual(store.document.events,before.events);
    assert.ok(await adapter.getBlob('image-a') instanceof Blob);
    store.undo();
    assert.equal(store.document.advanced.media[0].placed,true);
    assert.equal((store.document.mediaItems||[]).length,0);
    store.redo();
    assert.equal(store.document.mediaItems[0].placement,'profile');
    assert.ok(await adapter.getBlob('image-a') instanceof Blob);
  }finally{clearTimeout(store.timer);clearTimeout(store.entitlementTimer);}
});

test('Frame fill rejects locked/missing objects and library reuse preserves free placement',()=>{
  const original=source();
  assert.equal(fillCanonicalMediaFrame({...original,layoutLock:true},'profile','image-a',{id:'a'}).changed,false);
  assert.equal(fillCanonicalMediaFrame(original,'unknown','image-a',{id:'a'}).changed,false);
  assert.equal(fillCanonicalMediaFrame(original,'profile','missing',{id:'a'}).changed,false);
  const first=fillCanonicalMediaFrame(original,'photo1','image-a',{id:'first'}).document;
  const second=fillCanonicalMediaFrame(first,'photo1','image-a',{id:'replacement'}).document;
  assert.equal(second.mediaItems.length,1);
  assert.equal(second.advanced.media[0].placed,true);
  assert.deepEqual(second.advanced.media[0].source,original.advanced.media[0].source);
});

test('Advanced destination retains first-entry confirmation and safe repeat entry',()=>{
  const first=planModeSwitch({...defaultDocument(),mode:'guided'},'advanced');
  assert.equal(first.status,'confirmation-required');
  assert.equal(first.dialog.primary,'Enter Advanced Studio');
  assert.equal(planModeSwitch(source(),'advanced').status,'noop');
});
