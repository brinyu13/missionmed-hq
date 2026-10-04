import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountLocalLayoutReview407F,applyHumanAxisPresentation407F} from '../web/js/407f-engineering-adapter.js';
import {LAYOUT_CRITIC_CONSENT_VERSION,projectLayoutCritic,applyLayoutRecommendations} from '../web/js/presentation/layout-critic-projection.js';
import {setAxisPresentationOverride,setAxisSegmentWeights,resetAxisPresentationOverride,renderAdvancedPresentationControls} from '../web/js/uxr-002/advanced-studio.js';
import {buildFounderPresentationScene,serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {applyLocalLayoutCriticSceneCommand,applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {TimelineStore,migrateDocument} from '../web/js/uxr-002/store.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

const location={protocol:'http:',hostname:'127.0.0.1'},digest='a'.repeat(64);
const capability={scope:'LOCAL_GEOMETRY_ONLY',providerConfigured:true,productionWrites:false,synthetic:false,consentVersion:LAYOUT_CRITIC_CONSENT_VERSION};
const receipt={responseId:'resp_synthetic_wiring_test',model:'gpt-6.1-sol',receivedAt:'2026-10-04T00:00:00Z',store:false};
const result={status:'COMPLETE',mode:'LOCAL_PROVIDER_AI',scope:'LOCAL_GEOMETRY_ONLY',synthetic:false,productionWrites:false,sourceUnchanged:true,sceneDigest:digest,providerReceipt:receipt,recommendations:[{kind:'SET_EVENT_Y',targetId:'e0001',y:500,reasonCode:'REDUCE_COLLISION',confidence:.9}]};
const response=value=>({ok:true,json:async()=>structuredClone(value)});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  // Only the local subsection is replaceable; existing dialog controls retain
  // their identity and listeners while capability/provider updates arrive.
  const close=new EventTarget(),fix=new EventTarget();let html='',button=new EventTarget();
  const section={set innerHTML(value){html=value;button=new EventTarget();},get innerHTML(){return html;},querySelector:()=>button};
  const dialog={isConnected:true,querySelector:selector=>selector==='[data-local-layout-review]'?section:selector==='[data-quality-close]'?close:fix};
  const store={document:{id:'synthetic-only',events:[],metadata:{}},entitlement:{canMutate:true},replacements:0,replace(doc){this.document=doc;this.replacements++;return true;}};
  const options={project:async()=>({input:{anonymousGeometry:true},sceneDigest:digest,localContext:{sourceDigest:digest,privateSource:'DO NOT SEND'}}),validate:()=>{},apply:async doc=>({document:{...structuredClone(doc),presentationOverrides:{synthetic:true}},applied:1,rejected:[],before:{collisionCount:1},after:{collisionCount:0},sourceUnchanged:true})};
  return {dialog,section,close,fix,store,options,click:()=>button.dispatchEvent(new Event('click'))};
}
test('044 active 407F dialog reaches shared local review helper and rebuilds handlers after an applied review',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  const active=source.slice(source.indexOf('const openQualityGuardian407F='),source.indexOf('const openQualityGuardian407F=')+15000);
  assert.match(active,/localLayoutReview:isLocalLayoutReviewLocation\(\)/);
  assert.match(active,/standardLocalLayoutReview=mountLocalLayoutReview407F\(dialog/);
  assert.match(active,/onApplied:\(\)=>\{\s*syncBridgeFromStore\(\);\s*report=analyzeTimelineQuality/);
  assert.match(active,/lastGuardianSource022=qualitySourceText022\(store.document\);\s*showGuardian\(\);/);
  assert.match(source,/standardLocalLayoutReview\?\.destroy\(\);/);
  assert.doesNotMatch(active,/openai\.com|authorization.*Bearer/);
});
test('044 opening checks capabilities only; explicit consent calls real controller transport and existing store persistence',async()=>{
  const f=fixture(),calls=[];let applied=0,closedClicks=0;
  f.close.addEventListener('click',()=>closedClicks++);
  const mounted=mountLocalLayoutReview407F(f.dialog,{store:f.store,location,onApplied:()=>applied++,controllerOptions:{...f.options,fetchImpl:async(path,request)=>{calls.push({path,request});return response(path.endsWith('capabilities')?capability:result);}}});
  await turn();assert.equal(calls.length,1);assert.equal(calls[0].request.method,'GET');assert.match(f.section.innerHTML,/Review layout with AI/);
  const originalFix=f.dialog.querySelector('[data-quality-fix]');f.click();await turn();
  assert.equal(calls.length,2);assert.equal(calls[1].request.method,'POST');
  const body=JSON.parse(calls[1].request.body);assert.deepEqual(body.consent,{version:LAYOUT_CRITIC_CONSENT_VERSION,sceneDigest:digest,geometryOnly:true});assert.doesNotMatch(calls[1].request.body,/privateSource|DO NOT SEND/);
  assert.equal(applied,1);assert.equal(f.store.replacements,1);assert.equal(f.store.document.metadata.qualityGuardian.localLayoutReview.applied,1);
  assert.equal(f.dialog.querySelector('[data-quality-fix]'),originalFix);f.close.dispatchEvent(new Event('click'));assert.equal(closedClicks,1);mounted.destroy();
});
test('044 production locations never check local capability or expose a transport',()=>{
  const f=fixture();let calls=0;
  assert.equal(mountLocalLayoutReview407F(f.dialog,{store:f.store,location:{protocol:'https:',hostname:'missionmed.com'},controllerOptions:{fetchImpl:()=>calls++}}),null);assert.equal(calls,0);
});
test('044 closing or removing dialog suppresses pending capabilities and prevents provider calls',async()=>{
  for(const detach of [false,true]){
    const f=fixture();let finish,calls=0;const pending=new Promise(resolve=>{finish=resolve;});
    const mounted=mountLocalLayoutReview407F(f.dialog,{store:f.store,location,controllerOptions:{fetchImpl:async()=>{calls++;await pending;return response(capability);}}});
    if(detach)f.dialog.isConnected=false;else mounted.destroy();finish();await turn();
    assert.equal(f.section.innerHTML,'');await mounted.controller.review();assert.equal(calls,1);assert.equal(f.store.replacements,0);
  }
});
test('044 closing after consent prevents a late provider response from applying',async()=>{
  const f=fixture();let finish;const pending=new Promise(resolve=>{finish=resolve;});
  const mounted=mountLocalLayoutReview407F(f.dialog,{store:f.store,location,controllerOptions:{...f.options,fetchImpl:async(path)=>{if(path.endsWith('capabilities'))return response(capability);await pending;return response(result);}}});
  await turn();f.click();await turn();assert.match(f.section.innerHTML,/Reviewing layout/);
  mounted.destroy();finish();await turn();assert.equal(f.store.replacements,0);
});
test('044 persisted receipt remains visible after capability refresh and synthetic output is never presented as genuine',async()=>{
  const f=fixture();f.store.document.metadata.qualityGuardian={localLayoutReview:{status:'APPLIED',providerReceipt:receipt,sceneDigest:digest,recommended:1,applied:1,rejected:0}};
  const mounted=mountLocalLayoutReview407F(f.dialog,{store:f.store,location,controllerOptions:{...f.options,fetchImpl:async path=>response(path.endsWith('capabilities')?capability:{...result,synthetic:true})}});
  await turn();assert.match(f.section.innerHTML,/resp_synthetic_wiring_test/);f.click();await turn();assert.match(f.section.innerHTML,/AI review failed/);assert.equal(f.store.replacements,0);assert.doesNotMatch(f.section.innerHTML,/resp_synthetic_wiring_test/);mounted.destroy();
});
const renderOptions={scope:'EVERYTHING',currentMonth:'2026-10'};
async function automaticAnchorFixture(){
  let document=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M02').document);
  document.mode='advanced';document.events=document.events.filter(event=>event.id==='work');
  document.events[0].startDate='2020-07';document.events[0].endDate='2021-03';
  const projection=await projectLayoutCritic(document,renderOptions),target=projection.localContext.targetMap.get('e0001');
  document=applyLocalLayoutCriticSceneCommand(document,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:{...target.geometry,y:450},
    create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:'duration',localLayoutCriticAuto:true}}},renderOptions).document;
  document.presentationOverrides.axis.localLayoutCriticAuto=true;
  return document;
}
const weighted=(document,left=8,right=1)=>{
  const range=setAxisPresentationOverride(document,{startYear:2020,endYear:2021,includeFuture:false});
  return setAxisSegmentWeights(range.document,[{id:'2020',weight:left},{id:'2021',weight:right}]);
};
test('044 public human axis pipeline reflows fractional-date AI x/width, preserves y/native height and saves the reflow',async()=>{
  const document=await automaticAnchorFixture(),original=JSON.stringify(document);
  const before=(await projectLayoutCritic(document,renderOptions)).input.targets[0].geometry;
  const edited=applyHumanAxisPresentation407F(document,weighted(document),renderOptions);
  assert.equal(edited.changed,true,edited.error);
  const projected=await projectLayoutCritic(edited.document,renderOptions),after=projected.input.targets[0].geometry;
  const start=39.36+1841.28*(8/9)*.5,end=39.36+1841.28*(8/9)+1841.28*(1/9)*(3/12);
  assert.ok(Math.abs(after.x-start)<.04,`${after.x} vs ${start}`);assert.ok(Math.abs(after.width-(end-start))<.04,`${after.width} vs ${end-start}`);
  assert.equal(after.y,before.y);assert.equal(after.height,before.height);assert.equal(after.rotation,before.rotation);
  assert.equal(projected.input.axis.editable,false,'human axis widths cannot be overridden by a subsequent critic');
  assert.equal(projected.input.targets[0].editable,true,'human year resize does not claim the AI-owned vertical placement');
  assert.equal(edited.document.advanced.scene.objects[0].presentation.localLayoutCriticAuto,true);
  assert.deepEqual(edited.document.events,document.events);assert.deepEqual(edited.document.studentProfile,document.studentProfile);assert.equal(JSON.stringify(document),original);
  const records=[];const store=new TimelineStore({adapter:{atomicPut:async entries=>records.push(...structuredClone(entries))},entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canMutate:true}});
  store.document=migrateDocument(document);store.replace(edited.document,{label:'Resize Timeline year boundary'});await store.saveNow('SYNTHETIC_AXIS_REFLOW_TEST');
  const saved=JSON.parse(JSON.stringify(records.find(entry=>entry.store==='documents').value.document));
  assert.deepEqual(saved.presentationOverrides.axis.segmentWeights,[{id:'2020',weight:8},{id:'2021',weight:1}]);
  const savedGeometry=(await projectLayoutCritic(saved,renderOptions)).input.targets[0].geometry;assert.deepEqual(savedGeometry,after);
  const reset=applyHumanAxisPresentation407F(saved,resetAxisPresentationOverride(saved),renderOptions);
  assert.equal(reset.changed,true);const resetGeometry=(await projectLayoutCritic(reset.document,renderOptions)).input.targets[0].geometry;
  assert.notEqual(resetGeometry.x,after.x);assert.equal(resetGeometry.y,after.y);assert.deepEqual(reset.document.events,saved.events);
});
test('044 human full geometry stays exact under fresh year weights, and critic reruns honor manual axis ownership',async()=>{
  let document=await automaticAnchorFixture();
  document.events.push({...structuredClone(document.events[0]),id:'human-work',title:'Other synthetic placement'});
  const geometry={x:1100,y:700,width:250,height:40,rotation:0};
  document=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'human-work'},geometry,create:{type:'event',semanticRef:'human-work',aspectLocked:false,presentation:{eventType:'duration'}}},renderOptions).document;
  const manual=document.advanced.scene.objects.find(object=>object.semanticRef==='human-work');
  const edited=applyHumanAxisPresentation407F(document,weighted(document),renderOptions);
  assert.equal(edited.changed,true,edited.error);assert.deepEqual(edited.document.advanced.scene.objects.find(object=>object.semanticRef==='human-work'),manual);
  const subsequent=applyHumanAxisPresentation407F(edited.document,weighted(edited.document,1,8),renderOptions);
  assert.equal(subsequent.changed,true);assert.deepEqual(subsequent.document.advanced.scene.objects.find(object=>object.semanticRef==='human-work'),manual);
  assert.deepEqual(subsequent.document.events,document.events);
  const p=await projectLayoutCritic(subsequent.document,renderOptions);
  const command={kind:'SET_YEAR_WEIGHTS',weights:p.input.axis.segments.map(segment=>({segmentId:segment.id,weight:1})),reasonCode:'BALANCE_SPACING',confidence:.8};
  const rejected=await applyLayoutRecommendations(subsequent.document,{sceneDigest:p.sceneDigest,recommendations:[command]},p.sceneDigest,{...renderOptions,sourceDigest:p.localContext.sourceDigest});
  assert.equal(rejected.applied,0);assert.ok(rejected.rejected.length);assert.deepEqual(rejected.document,subsequent.document);
});
test('044 kernel gestures, numeric axis controls and direct boundary drag all route through shared date reflow',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  assert.match(source,/result=range.changed\s*\?setAxisSegmentWeights\(range.document,detail.segmentWeights\)\s*:range;\s*result=finishHumanAxisEdit\(result\);/);
  assert.match(source,/onAxisWeightChange:[\s\S]*?applyPresentationControlResult\(\(\)=>finishHumanAxisEdit\(setAxisSegmentWeights/);
  assert.match(source,/const result=finishHumanAxisEdit\(setAxisSegmentWeights\(range.document,pending.preview\)\);/);
  for(const hook of ['onAxisChange','onAxisReset','onAxisWeightReset'])assert.match(source.slice(source.indexOf(hook+':'),source.indexOf(hook+':')+250),/finishHumanAxisEdit/);
});
test('044 actual kernel, numeric and pointer-release UI handlers save date-reflowed AI geometry',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  for(const path of ['kernel','numeric','pointer']){
    const original=await automaticAnchorFixture(),store={document:structuredClone(original),entitlement:{canMutate:true},replace(doc){this.document=JSON.parse(JSON.stringify(doc));}};
    let syncs=0;const sync=()=>syncs++,canvas={setUiState(){}},bridge={toast(){}};
    const finish=result=>applyHumanAxisPresentation407F(store.document,result,renderOptions);
    const weights=[{id:'2020',weight:8},{id:'2021',weight:1}];
    if(path==='kernel'){
      const begin=source.indexOf('const onKernelPresentationGesture=(event)=>')+'const onKernelPresentationGesture='.length;
      const expression=source.slice(begin,source.indexOf('onKernelPresentationEventGesture=',begin)).trim();
      const handler=new Function('store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','syncBridgeStateFromStore','canvasController','bridge','return '+expression)(store,finish,setAxisPresentationOverride,setAxisSegmentWeights,sync,canvas,bridge);
      handler({detail:{surface:'edit',kind:'axis-boundary',startYear:2020,endYear:2021,includeFuture:false,segmentWeights:weights}});
    }else if(path==='numeric'){
      const begin=source.indexOf('const advancedHooks=()=>({')+'const advancedHooks=()=>({'.length;
      const hooks=source.slice(begin,source.indexOf('onCategoryKeyChange:',begin));
      const apply=result=>{const ready=typeof result==='function'?result():result;if(ready.changed){store.replace(ready.document);sync();}};
      const handler=new Function('store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','resetAxisPresentationOverride','applyPresentationControlResult','return ({'+hooks+'});')(store,finish,setAxisPresentationOverride,setAxisSegmentWeights,resetAxisPresentationOverride,apply);
      handler.onAxisChange({startYear:2020,endYear:2021,includeFuture:false});handler.onAxisWeightChange('2020',8);handler.onAxisWeightChange('2021',1);
    }else{
      const begin=source.indexOf('if(axisPointer){',source.indexOf('const years=pending.preview')-1500);
      const branch=source.slice(begin,source.indexOf('if(railPointer){',begin));
      assert.ok(branch.includes('pending.preview'),'actual pointer release branch located');
      const segment=()=>({dataset:{advancedAxisDragging:'1'},removeAttribute(){}}),pending={left:segment(),right:segment(),preview:weights,moved:true};
      new Function('pending','event','store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','syncBridgeStateFromStore','canvasController','bridge','showAdvancedAxisBoundaryHandles','announceGlobal','let axisPointer=pending;'+branch)(pending,{type:'pointerup'},store,finish,setAxisPresentationOverride,setAxisSegmentWeights,sync,canvas,bridge,()=>{},()=>{});
    }
    assert.ok(syncs>0,path+' persisted through actual handler');
    const p=await projectLayoutCritic(store.document,renderOptions),geometry=p.input.targets[0].geometry;
    assert.ok(Math.abs(geometry.x-(39.36+1841.28*(8/9)*.5))<.04,path+' uses new year scale');
    assert.equal(geometry.y,450);assert.equal(p.input.axis.editable,false);assert.deepEqual(store.document.events,original.events);
  }
});
function profileOnlyEducationFixture(){
  const document=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M02').document);
  document.mode='advanced';document.events=[
    {...structuredClone(document.events[1]),id:'profile-education',categoryId:'education',title:'Synthetic education span',startDate:'2008-09',endDate:'2012-06',eventType:'duration'},
    {...structuredClone(document.events[1]),id:'displayed-work',title:'Synthetic displayed experience',startDate:'2012-07',endDate:'2026-03'},
    {...structuredClone(document.events[1]),id:'excluded-work',title:'Excluded synthetic work',startDate:'1990-01',endDate:'1991-01',visibilityState:'HIDDEN'}
  ];
  return document;
}
test('044 axis controls and range validation reuse displayed G4/visibility projection while genuine degree flags remain required',()=>{
  const document=profileOnlyEducationFixture(),before=JSON.stringify(document),scene=buildFounderPresentationScene(document,{scope:'EVERYTHING'});
  assert.equal(scene.span.firstYear,2012);assert.equal(scene.span.lastYear,2026);
  assert.equal(scene.profile.educationRecords[0].startDate,'2008-09');
  const controls=renderAdvancedPresentationControls(document);
  assert.match(controls,/value="2012" data-axis-override-field="startYear"/);assert.match(controls,/value="2026" data-axis-override-field="endYear"/);
  const range=setAxisPresentationOverride(document,{startYear:2012,endYear:2026,includeFuture:false});assert.equal(range.changed,true,range.error);assert.deepEqual(range.document.events,document.events);
  const degree={...structuredClone(document.events[0]),id:'actual-degree',eventType:'milestone',title:'Synthetic degree completion',startDate:'2010-06',endDate:null};
  const withDegree={...structuredClone(document),events:[...structuredClone(document.events),degree]};
  const invalid=setAxisPresentationOverride(withDegree,{startYear:2012,endYear:2026,includeFuture:false});assert.equal(invalid.changed,false);assert.match(invalid.error,/2010/);
  assert.equal(JSON.stringify(document),before);
});
test('044 actual pointer boundary with profile-only 2008 education persists visible 2012–2026 widths and preserves human/source geometry',async()=>{
  let document=profileOnlyEducationFixture();const p=await projectLayoutCritic(document,renderOptions),target=p.localContext.targetMap.get('e0001');
  document=applyLocalLayoutCriticSceneCommand(document,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:{...target.geometry,y:450},create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:'duration',localLayoutCriticAuto:true}}},renderOptions).document;
  document=resetAxisPresentationOverride(document).document;
  document.events.push({...structuredClone(document.events[1]),id:'human-event',title:'Human synthetic placement',startDate:'2024-01',endDate:'2025-01'});
  document=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'human-event'},geometry:{x:1100,y:700,width:250,height:40,rotation:0},create:{type:'event',semanticRef:'human-event',aspectLocked:false,presentation:{eventType:'duration'}}},renderOptions).document;
  document=resetAxisPresentationOverride(document).document;
  const human=structuredClone(document.advanced.scene.objects.find(object=>object.semanticRef==='human-event'));
  const records=[],store=new TimelineStore({adapter:{atomicPut:async entries=>records.push(...structuredClone(entries))},entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canMutate:true}});
  store.document=migrateDocument(document);const before=JSON.stringify(store.document.events),source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  const begin=source.indexOf('if(axisPointer){',source.indexOf('const years=pending.preview')-1500),branch=source.slice(begin,source.indexOf('if(railPointer){',begin));
  const weights=Array.from({length:15},(_,index)=>({id:String(2012+index),weight:index===11?2.25:index===12?1.25:1}));
  const segment=()=>({dataset:{advancedAxisDragging:'1'},removeAttribute(){}}),messages=[];
  new Function('pending','event','store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','syncBridgeStateFromStore','canvasController','bridge','showAdvancedAxisBoundaryHandles','announceGlobal','let axisPointer=pending;'+branch)({left:segment(),right:segment(),preview:weights,moved:true},{type:'pointerup'},store,result=>applyHumanAxisPresentation407F(store.document,result,renderOptions),setAxisPresentationOverride,setAxisSegmentWeights,()=>{},{setUiState(){}},{toast:message=>messages.push(message)},()=>{},()=>{});
  assert.deepEqual(store.document.presentationOverrides.axis.segmentWeights,weights);assert.ok(messages.includes('Year widths updated'));
  assert.equal(JSON.stringify(store.document.events),before);assert.deepEqual(store.document.advanced.scene.objects.find(object=>object.semanticRef==='human-event'),human);
  const geometry=store.document.advanced.scene.objects.find(object=>object.semanticRef==='displayed-work').geometry;assert.equal(geometry.y,450);
  await store.saveNow('SYNTHETIC_PROFILE_AXIS_TEST');const saved=JSON.parse(JSON.stringify(records.find(entry=>entry.store==='documents').value.document));
  assert.deepEqual(saved.presentationOverrides.axis.segmentWeights,weights);assert.deepEqual(saved.events,store.document.events);
  const savedProjection=await projectLayoutCritic(saved,renderOptions);assert.equal(savedProjection.input.axis.editable,false);assert.deepEqual(saved.advanced.scene.objects.find(object=>object.semanticRef==='human-event'),human);
});
test('044 invalid pointer range cannot enter the weight setter, mutate the document or announce success',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),begin=source.indexOf('if(axisPointer){',source.indexOf('const years=pending.preview')-1500),branch=source.slice(begin,source.indexOf('if(railPointer){',begin));
  const store={document:profileOnlyEducationFixture(),replace(){throw Error('Failed range must not replace');}},before=JSON.stringify(store.document),messages=[];
  const weights=Array.from({length:14},(_,index)=>({id:String(2013+index),weight:1})),segment=()=>({dataset:{},removeAttribute(){}});let weightCalls=0;
  new Function('pending','event','store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','syncBridgeStateFromStore','canvasController','bridge','showAdvancedAxisBoundaryHandles','announceGlobal','let axisPointer=pending;'+branch)({left:segment(),right:segment(),preview:weights,moved:true},{type:'pointerup'},store,result=>result,setAxisPresentationOverride,()=>{weightCalls++;throw Error('Invalid range reached weight setter');},()=>{},{setUiState(){}},{toast:message=>messages.push(message)},()=>{},message=>messages.push(message));
  assert.equal(weightCalls,0);assert.equal(JSON.stringify(store.document),before);assert.ok(messages.some(message=>message.includes('2012')));assert.ok(!messages.includes('Year widths updated'));
});
test('044 single-year actual SVG/control defaults and required-date validation do not inherit the legacy extra scene year',()=>{
  const document=profileOnlyEducationFixture();
  document.events=document.events.filter(event=>event.id==='displayed-work');document.events[0].startDate='2024-03';document.events[0].endDate='2024-10';
  const before=JSON.stringify(document),rendered=serializeFounderPresentation(document,renderOptions);
  assert.equal(rendered.scene.span.lastYear,2025,'legacy scene span remains a read-only implementation detail');
  assert.equal(rendered.scene.composedAxis.startYear,2024);assert.equal(rendered.scene.composedAxis.endYear,2024);
  assert.match(rendered.svg,/data-axis-segment-id="2024"/);assert.doesNotMatch(rendered.svg,/data-axis-segment-id="2025"/);
  const controls=renderAdvancedPresentationControls(document);
  assert.match(controls,/value="2024" data-axis-override-field="startYear"/);assert.match(controls,/value="2024" data-axis-override-field="endYear"/);
  const manual=setAxisPresentationOverride(document,{startYear:2024,endYear:2024,includeFuture:false});
  assert.equal(manual.changed,true,manual.error);assert.deepEqual(manual.document.events,document.events);
  const saved=migrateDocument(JSON.parse(JSON.stringify(manual.document))),manualRender=serializeFounderPresentation(saved,renderOptions);
  assert.equal(manualRender.scene.founderPresentation.axis.endYear,2024);assert.doesNotMatch(manualRender.svg,/data-axis-segment-id="2025"/);
  let authored=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'displayed-work'},geometry:{x:600,y:450,width:700,height:43.567795,rotation:0},create:{type:'event',semanticRef:'displayed-work',aspectLocked:false,presentation:{eventType:'duration'}}},renderOptions).document;
  authored=resetAxisPresentationOverride(authored).document;
  const authoredControls=renderAdvancedPresentationControls(authored);
  assert.match(authoredControls,/value="2024" data-axis-override-field="endYear"/,'authored geometry without a composed snapshot still uses painted year labels');
  assert.equal(JSON.stringify(document),before);
  const withFutureDegree=structuredClone(document);withFutureDegree.events.push({...structuredClone(document.events[0]),id:'actual-degree',categoryId:'education',eventType:'milestone',startDate:'2025-06',endDate:null});
  const rejected=setAxisPresentationOverride(withFutureDegree,{startYear:2024,endYear:2024,includeFuture:false});assert.equal(rejected.changed,false);assert.match(rejected.error,/2025/);
});
test('044 automatic control defaults follow canonical contextual year allocation without making it a required fact',()=>{
  const document=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M14').document);document.mode='advanced';
  const rendered=serializeFounderPresentation(document,renderOptions),controls=renderAdvancedPresentationControls(document),axis=rendered.scene.composedAxis;
  assert.ok(axis);assert.match(controls,new RegExp(`value="${axis.startYear}" data-axis-override-field="startYear"`));assert.match(controls,new RegExp(`value="${axis.endYear}" data-axis-override-field="endYear"`));
  const narrow=setAxisPresentationOverride(document,{startYear:2023,endYear:2023,includeFuture:false});assert.equal(narrow.changed,true,narrow.error);assert.deepEqual(narrow.document.events,document.events);
});
