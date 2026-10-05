import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountLocalLayoutReview407F,applyHumanAxisPresentation407F,advancedEventGeometry407F,advancedEventCreation407F,timelineRenderSignature} from '../web/js/407f-engineering-adapter.js';
import {LAYOUT_CRITIC_CONSENT_VERSION,projectLayoutCritic,applyLayoutRecommendations} from '../web/js/presentation/layout-critic-projection.js';
import {setAxisPresentationOverride,setAxisSegmentWeights,resetAxisPresentationOverride,renderAdvancedPresentationControls,resetAdvancedEventLayout,constrainAdvancedObjectToBoard} from '../web/js/uxr-002/advanced-studio.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {buildFounderPresentationScene,serializeFounderPresentation,founderMilestoneTemplateGeometry,violatesFounderTemplateBand} from '../web/js/presentation/founder-presentation-serializer.js';
import {applyLocalLayoutCriticSceneCommand,applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {TimelineStore,migrateDocument} from '../web/js/uxr-002/store.js';
import {projectSceneGraphToLegacy} from '../web/js/editor/scene-graph.js';
import {locked407FMilestoneGeometry} from '../web/js/uxr-002/locked-407f-export.js';
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
function longMilestoneFixture(){
  const document=profileOnlyEducationFixture();document.events=document.events.filter(event=>event.id==='displayed-work');
  document.events.push({...structuredClone(document.events[0]),id:'long-publication',categoryId:'research',eventType:'milestone',startDate:'2018-06',endDate:null,title:'Synthetic publication with a long descriptive title about longitudinal clinical outcomes and complete source wording',siteName:'Synthetic Journal of Clinical Outcomes and Longitudinal Research'});
  return document;
}
test('044 native long-label milestone acquisition never uses painted group bounds as scalable 50 by 64 flag geometry',()=>{
  const document=longMilestoneFixture(),before=JSON.stringify(document),source={dataset:{eventKind:'flag'},getBBox:()=>({x:300,y:40,width:1100,height:160}),querySelector:()=>null};
  const geometry=advancedEventGeometry407F(document,'long-publication',source,renderOptions);
  assert.equal(geometry.width,50);assert.equal(geometry.height,64);assert.equal(JSON.stringify(document),before,'selection does not materialize a scene override');
  const native=serializeFounderPresentation(document,renderOptions),paint=svg=>resolveFounderPresentationSvg(svg).nodes.filter(node=>node.semanticRef==='long-publication'&&node.kind==='text');
  const moved=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'long-publication'},geometry:{...geometry,y:geometry.y+5},create:{type:'event',semanticRef:'long-publication',aspectLocked:false,presentation:{eventType:'milestone'}}},renderOptions);
  assert.equal(moved.changed,true);const resetAxis=resetAxisPresentationOverride(moved.document).document,after=serializeFounderPresentation(resetAxis,renderOptions);
  const text=node=>({text:node.text,fontSize:node.fontSize,fontFamily:node.fontFamily,width:node.bounds.width});
  assert.deepEqual(paint(after.svg).map(text),paint(native.svg).map(text),'title, institution and date typography never stretch after first move or axis reset');
  assert.deepEqual(resetAxis.events,document.events);assert.equal(resetAxis.advanced.scene.objects.find(object=>object.semanticRef==='long-publication').geometry.width,50);
  const durationBody={getBBox:()=>({x:120,y:400,width:650,height:43.567795})},durationSource={dataset:{eventKind:'arrow'},querySelector:()=>durationBody};
  assert.deepEqual(advancedEventGeometry407F(document,'displayed-work',durationSource,renderOptions),{x:120,y:400,width:650,height:43.567795,rotation:0,locked:false,aspectLocked:false});
  const authored=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'long-publication'},geometry:{x:700,y:65,width:85,height:78,rotation:8},create:{type:'event',semanticRef:'long-publication',aspectLocked:false,presentation:{eventType:'milestone'}}},renderOptions).document;
  const stored=authored.advanced.scene.objects.find(object=>object.semanticRef==='long-publication').geometry;
  const preserved=advancedEventGeometry407F(authored,'long-publication',source,renderOptions);
  for(const field of ['x','y','width','height','rotation'])assert.equal(preserved[field],stored[field],'authored '+field+' preserved');
});
test('044 reset event layout removes only chosen visual placement and preserves source facts, photos, axis and other manual geometry',()=>{
  let document=longMilestoneFixture();
  document=setAxisPresentationOverride(document,{startYear:2012,endYear:2026,includeFuture:false}).document;
  for(const [id,geometry] of [['long-publication',{x:350,y:60,width:900,height:160,rotation:0}],['displayed-work',{x:100,y:600,width:800,height:43.567795,rotation:0}]])document=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id},geometry,create:{type:'event',semanticRef:id,aspectLocked:false,presentation:{eventType:id==='long-publication'?'milestone':'duration'}}},renderOptions).document;
  document.events.find(event=>event.id==='long-publication').manualOffset={x:20,y:15,laneLocked:true};
  document.presentationOverrides.photoFrames={1:{x:1100,y:600,width:240,height:180,rotation:6}};
  document.mediaItems=[{id:'synthetic-photo',placement:'photo1',visibilityState:'INTERVIEWER_SAFE',source:{fixture:'local-only'}}];
  const before=JSON.stringify(document),other=structuredClone(document.advanced.scene.objects.find(object=>object.semanticRef==='displayed-work')),axis=structuredClone(document.presentationOverrides.axis);
  const reset=resetAdvancedEventLayout(document,'long-publication');assert.equal(reset.changed,true);assert.equal(reset.mutation.undoSteps,1);
  assert.ok(!reset.document.advanced.scene.objects.some(object=>object.semanticRef==='long-publication'));
  assert.deepEqual(reset.document.advanced.scene.objects.find(object=>object.semanticRef==='displayed-work'),other);assert.deepEqual(reset.document.presentationOverrides.axis,axis);
  assert.deepEqual(reset.document.mediaItems,document.mediaItems);assert.deepEqual(reset.document.presentationOverrides.photoFrames,document.presentationOverrides.photoFrames);
  const facts=events=>events.map(({manualOffset,...event})=>event);assert.deepEqual(facts(reset.document.events),facts(document.events));assert.equal(JSON.stringify(document),before);
  const native=advancedEventGeometry407F(reset.document,'long-publication',{dataset:{eventKind:'flag'}},renderOptions);assert.equal(native.width,50);assert.equal(native.height,64);
  assert.equal(resetAdvancedEventLayout(reset.document,'long-publication').changed,false);
  const locked=structuredClone(document);locked.advanced.scene.objects.find(object=>object.semanticRef==='long-publication').locked=true;assert.equal(resetAdvancedEventLayout(locked,'long-publication').changed,false);
});
test('044 active native acquisition and reset event action are wired through actual Advanced controls',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  assert.match(source,/const eventPresentationItem=\(id\)=>\{[\s\S]*?advancedEventGeometry407F/);
  assert.match(source,/!\["group","event"\]\.includes\(object.type\)/,'pointer start cannot replace event geometry with a painted label group bbox');
  assert.match(source,/if\(target.type==="event"\)return\[\{action:"reset-event-layout",label:"Reset event layout"/);
  assert.match(source,/if\(selection.type==="event"\)return\[\{action:"reset-event-layout"/);
  const begin=source.indexOf('case"reset-event-layout":{')+'case"reset-event-layout":'.length,end=source.indexOf('case"duplicate":',begin),action=source.slice(begin,end).trim();
  let document=longMilestoneFixture();document.events.find(event=>event.id==='long-publication').manualOffset={x:100};
  const store={document,entitlement:{canMutate:true},replace(next){this.document=next;}},target={type:'event',id:'long-publication'};let sync=0,selected=0;
  const executed=new Function('target','selection','store','resetAdvancedEventLayout','bridge','syncBridgeStateFromStore','commitAdvancedSelection',action)(target,target,store,resetAdvancedEventLayout,{toast(){}},()=>sync++,()=>selected++);
  assert.equal(executed,true);assert.equal(sync,1);assert.equal(selected,1);assert.ok(!store.document.events.find(event=>event.id==='long-publication').manualOffset);
  store.entitlement.canMutate=false;assert.equal(new Function('target','selection','store','resetAdvancedEventLayout','bridge','syncBridgeStateFromStore','commitAdvancedSelection',action)(target,target,store,resetAdvancedEventLayout,{toast(){}},()=>{},()=>{}),false);
});
test('044 actual pointer geometry acquisition retains the native flag box despite an enormous painted label bbox',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),begin=source.indexOf('const geometryElement=object.type==="event"'),end=source.indexOf('const resizeZone=',begin);
  const document=longMilestoneFixture(),svg={getBoundingClientRect:()=>({width:960,height:540})};
  const node={dataset:{eventKind:'flag'},querySelector:()=>null,closest:()=>svg,getBoundingClientRect:()=>({left:100,top:20,right:900,bottom:100,width:800,height:80}),getBBox:()=>({x:200,y:40,width:1600,height:160}),hasAttribute:()=>false};
  const geometry=advancedEventGeometry407F(document,'long-publication',node,renderOptions),object={type:'event',id:'long-publication',item:geometry,element:node};
  const bounds=new Function('object','clearAdvancedAlignmentGuides',source.slice(begin,end)+'return modelBounds;')(object,()=>{});
  assert.deepEqual(bounds,{x:geometry.x,y:geometry.y,width:50,height:64});assert.equal(object.item.width,50);assert.equal(object.item.height,64);
});
test('044 native geometry cache reuses the same painted source and invalidates for changed timeline or owner',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),begin=source.indexOf('const nativeEventGeometryCache='),end=source.indexOf('const advancedObjectForTarget=',begin);
  const store={document:longMilestoneFixture()},node={};let calls=0;
  const item=new Function('store','canvasHost','advancedEventSelector','timelineRenderSignature','advancedEventGeometry407F','currentMonth','liveMediaById','clone',source.slice(begin,end)+'return eventPresentationItem;')(store,{querySelector:()=>node},id=>id,timelineRenderSignature,()=>{calls++;return{x:100,y:50,width:50,height:64,rotation:0};},()=>renderOptions.currentMonth,()=>new Map(),structuredClone);
  item('long-publication');item('long-publication');assert.equal(calls,1);
  store.document.events[1].title+=' Revised';item('long-publication');assert.equal(calls,2);
  store.document.studentOwnerId='other-synthetic-owner';item('long-publication');assert.equal(calls,3);
});

function resolvedLongDegreeFixture(){
  const document=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M02').document);
  document.mode='advanced';document.layoutLock=false;
  document.events[0].startDate='2025-06';
  document.events[0].title='Synthetic medical degree with complete longitudinal professional education source wording';
  document.events[0].siteName='Synthetic International Medical University';
  document.events[1].startDate='2020-01';document.events[1].endDate='2026-03';
  const label=document.events[0].title+' — '+document.events[0].siteName;
  // Deterministic synthetic font metrics reproduce the independent 957px case.
  const options={...renderOptions,measureText:(text,size=18)=>String(text).length*(956.5/label.length)*(size/18)};
  return {document,options};
}
function flagPaint(document,id,options){
  const rendered=serializeFounderPresentation(document,options),paint=resolveFounderPresentationSvg(rendered.svg,{measureText:options.measureText});
  const texts=paint.nodes.filter(node=>node.semanticRef===id&&node.kind==='text');
  const labels=texts.filter(node=>node.sourceAttributes['data-board-ink-role']==='flag-label');
  return {rendered,paint,texts,labels,template:founderMilestoneTemplateGeometry(rendered.scene,paint).find(item=>item.eventId===id)};
}
function executeFirstEventEdit(source,path,document,id,geometry,options,kind='move'){
  const preview=kind==='resize'?{...geometry,width:geometry.width+5,height:geometry.height+5}:{...geometry,y:geometry.y+5};
  const store={document:structuredClone(document),entitlement:{canMutate:true},replace(next){this.document=next;}};
  const beginMedia=source.indexOf('const liveMediaById=')+'const liveMediaById='.length;
  const mediaExpression=source.slice(beginMedia,source.indexOf('const hydrateMissingAdvancedMedia=',beginMedia)).trim();
  const resolveMedia=new Function('mediaUrls','return '+mediaExpression)(options.mediaUrls||new Map());
  const mediaCalls=[];
  const liveMediaById=timeline=>{assert.ok(timeline?.events,'actual handler must supply its timeline to hydration');mediaCalls.push(timeline);return resolveMedia(timeline);};
  const create=(doc,eventId,actualOptions)=>{
    assert.equal(actualOptions.currentMonth,options.currentMonth);
    assert.deepEqual(actualOptions.mediaById,resolveMedia(doc),'actual handler options match live media for the same timeline');
    assert.equal(mediaCalls.at(-1),doc,'hydration uses the exact document passed to creation');
    // Only deterministic font metrics are supplied by the fixture. Media and
    // current-month options must come from the actual handler, without fallback.
    return advancedEventCreation407F(doc,eventId,{measureText:options.measureText,...actualOptions});
  };
  const apply=(doc,command)=>applySceneCommandToDocument(doc,command,options);
  if(path==='kernel'){
    const begin=source.indexOf('onKernelPresentationEventGesture=(event)=>')+'onKernelPresentationEventGesture='.length;
    const expression=source.slice(begin,source.indexOf('const reselectAdvancedKernel=',begin)).trim();
    new Function('store','applySceneCommandToDocument','advancedEventCreation407F','currentMonth','liveMediaById','syncBridgeStateFromStore','bridge','return '+expression)(store,apply,create,()=>options.currentMonth,liveMediaById,()=>{},{toast(){}})({detail:{surface:'edit',domainId:id,kind,geometry:preview}});
  }else if(path==='keyboard'){
    const begin=source.indexOf('const nudgeAdvancedSelection=')+'const nudgeAdvancedSelection='.length;
    const expression=source.slice(begin,source.indexOf('const layerAdvancedSelection=',begin)).trim();
    new Function('store','advancedItemFor','selectionIsLocked','constrainAdvancedObjectToBoard','applySceneCommandToDocument','advancedEventCreation407F','currentMonth','liveMediaById','commitAdvancedSelection','return '+expression)(store,()=>geometry,()=>false,constrainAdvancedObjectToBoard,apply,create,()=>options.currentMonth,liveMediaById,()=>{})({type:'event',id},{x:kind==='resize'?5:0,y:5},{resize:kind==='resize'});
  }else if(path==='rotate'){
    const start=source.indexOf('const rotateHandle=event.target'),begin=source.indexOf('const result=applySceneCommandToDocument',start);
    const branch=source.slice(begin,source.indexOf('\n        }\n        syncBridgeStateFromStore()',begin));
    new Function('store','object','rotation','applySceneCommandToDocument','advancedEventCreation407F','currentMonth','liveMediaById',branch)(store,{type:'event',id,item:geometry},15,apply,create,()=>options.currentMonth,liveMediaById);
  }else{
    const begin=source.indexOf('const label=pointer.kind===',source.indexOf('const pointer=advancedPointer;',source.indexOf('const years=pending.preview')));
    const end=source.indexOf('const railPayload=',begin),branch=source.slice(begin,end).trim().replace(/};$/,'');
    new Function('store','pointer','applySceneCommandToDocument','advancedEventCreation407F','currentMonth','liveMediaById','syncBridgeStateFromStore','canvasController','showAdvancedDirectSelection','bridge','announceGlobal',branch)(store,{type:'event',id,kind,preview,original:geometry},apply,create,()=>options.currentMonth,liveMediaById,()=>{},{setUiState(){}},()=>{},{toast(){}},()=>{});
  }
  return store.document;
}
test('044 all four actual first-edit creation paths retain resolved 957px flipped native packing and pole mapping',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
  const {document,options}=resolvedLongDegreeFixture(),before=JSON.stringify(document),native=flagPaint(document,'degree',options);
  assert.deepEqual(native.rendered.scene.autoFlagLabels.get('degree'),{width:957,flip:true});assert.equal(native.labels.length,1);assert.equal(native.template.poleFootY,125);
  const geometry=advancedEventGeometry407F(document,'degree',{dataset:{eventKind:'flag'}},options);
  for(const path of ['kernel','keyboard','rotate','pointer']){
    const edited=executeFirstEventEdit(source,path,document,'degree',geometry,options),paint=flagPaint(edited,'degree',options);
    const object=edited.advanced.scene.objects.find(item=>item.semanticRef==='degree');
    assert.deepEqual(object.presentation.flagLabelLayout,{width:957,flip:true},path);assert.deepEqual(object.presentation.nativeFlagPole,{anchor:'native'});
    assert.ok(!object.presentation.localLayoutCriticAuto);assert.equal(object.geometry.width,50);assert.equal(object.geometry.height,64);
    assert.equal(paint.labels.length,1,path+' does not rewrap a source label');
    assert.deepEqual(paint.texts.map(node=>[node.text,Math.round(node.fontSize*1e9)/1e9,node.fontFamily]),native.texts.map(node=>[node.text,Math.round(node.fontSize*1e9)/1e9,node.fontFamily]));
    if(path!=='rotate'){
      assert.equal(paint.labels[0].bounds.width,native.labels[0].bounds.width,path+' preserves exact painted label width');
      assert.equal(paint.template.poleFootY,125,path+' remains axis anchored');
      assert.ok(Math.abs(paint.template.bodyBottom-native.template.bodyBottom-5)<.01,path+' moves the body by only the requested delta');
    }else{
      assert.notEqual(paint.template.poleFootY,125,'rotation really transforms the endpoint');
      assert.equal(violatesFounderTemplateBand(paint.template),true,'preserved pole shape cannot bypass the native template guard');
    }
    assert.deepEqual(edited.events,document.events);assert.deepEqual(edited.studentProfile,document.studentProfile);
  }
  assert.equal(JSON.stringify(document),before);
});
test('044 native first resize retains packing and actual study attachment; old authored geometry is not reinterpreted',()=>{
  const {document,options}=resolvedLongDegreeFixture(),geometry=advancedEventGeometry407F(document,'degree',{dataset:{eventKind:'flag'}},options);
  const resized=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'degree'},geometry:{...geometry,width:60,height:80},create:advancedEventCreation407F(document,'degree',options)},options).document;
  const paint=flagPaint(resized,'degree',options);assert.equal(paint.labels.length,1);assert.equal(paint.template.poleFootY,125);
  const attached=structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id==='M01').document);attached.mode='advanced';attached.layoutLock=false;
  attached.events.find(event=>event.id==='study').fields={attemptId:'synthetic-attempt',isStudyPeriod:true};
  attached.events.find(event=>event.id==='exam').fields={attemptId:'synthetic-attempt',result:'Passed'};
  const native=flagPaint(attached,'exam',renderOptions);assert.equal(native.template.kind,'EXAM_RESULT');assert.notEqual(native.template.attachmentY,125);
  const examGeometry=advancedEventGeometry407F(attached,'exam',{dataset:{eventKind:'flag'}},renderOptions);
  const moved=applySceneCommandToDocument(attached,{kind:'geometry',target:{type:'event',id:'exam'},geometry:{...examGeometry,y:examGeometry.y+5},create:advancedEventCreation407F(attached,'exam',renderOptions)},renderOptions).document;
  const result=flagPaint(moved,'exam',renderOptions);assert.equal(result.template.poleFootY,native.template.poleFootY);assert.equal(result.template.poleFootY,result.template.attachmentY);assert.deepEqual(moved.events,attached.events);
  const studyMoved=applySceneCommandToDocument(moved,{kind:'geometry',target:{type:'event',id:'study'},geometry:{x:800,y:480,width:250,height:43.567795,rotation:0},create:advancedEventCreation407F(moved,'study',renderOptions)},renderOptions).document;
  const updatedStudy=flagPaint(studyMoved,'exam',renderOptions);assert.equal(updatedStudy.template.poleFootY,480);assert.equal(updatedStudy.template.poleFootY,updatedStudy.template.attachmentY,'native attachment follows its actual study geometry');
  const authored=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'degree'},geometry:{x:1100,y:65,width:85,height:78,rotation:8},create:{type:'event',semanticRef:'degree',aspectLocked:false,presentation:{eventType:'milestone',flagLabelLayout:{width:320,flip:false}}}},options).document;
  const original=structuredClone(authored.advanced.scene.objects.find(item=>item.semanticRef==='degree'));
  const second=applySceneCommandToDocument(authored,{kind:'geometry',target:{type:'event',id:'degree'},geometry:{...original.geometry,y:70},create:advancedEventCreation407F(authored,'degree',options)},options).document;
  const updated=second.advanced.scene.objects.find(item=>item.semanticRef==='degree');assert.deepEqual(updated.presentation,original.presentation);assert.ok(!updated.presentation.nativeFlagPole);
});

test('044 actual kernel, keyboard and pointer first resizes preserve native packing and axis endpoint',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),{document,options}=resolvedLongDegreeFixture();
  const geometry=advancedEventGeometry407F(document,'degree',{dataset:{eventKind:'flag'}},options);
  for(const path of ['kernel','keyboard','pointer']){
    const edited=executeFirstEventEdit(source,path,document,'degree',geometry,options,'resize'),paint=flagPaint(edited,'degree',options);
    const object=edited.advanced.scene.objects.find(item=>item.semanticRef==='degree');
    assert.deepEqual(object.presentation.flagLabelLayout,{width:957,flip:true});assert.equal(paint.labels.length,1,path);
    assert.equal(object.geometry.width,55);assert.equal(object.geometry.height,69);assert.ok(Math.abs(paint.template.poleFootY-125)<1e-9);
    assert.deepEqual(edited.events,document.events);assert.ok(!object.presentation.localLayoutCriticAuto);
  }
});
test('044 native metadata does not alter unrelated manual geometry, photos, axis or source and survives serialization',async()=>{
  const {document,options}=resolvedLongDegreeFixture();
  let working=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'work'},geometry:{x:180,y:400,width:1200,height:43.567795,rotation:0},create:{type:'event',semanticRef:'work',aspectLocked:false,presentation:{eventType:'duration'}}},options).document;
  working.presentationOverrides.photoFrames={1:{x:1200,y:600,width:240,height:180,rotation:8}};
  working.mediaItems=[{id:'synthetic-local-photo',placement:'photo1',visibilityState:'INTERVIEWER_SAFE',source:{fixture:'local-only'}}];
  const geometry=advancedEventGeometry407F(working,'degree',{dataset:{eventKind:'flag'}},options),before=JSON.stringify(working);
  const edited=applySceneCommandToDocument(working,{kind:'geometry',target:{type:'event',id:'degree'},geometry:{...geometry,y:geometry.y+5},create:advancedEventCreation407F(working,'degree',options)},options).document;
  assert.deepEqual(edited.presentationOverrides,working.presentationOverrides);assert.deepEqual(edited.mediaItems,working.mediaItems);
  assert.deepEqual(edited.advanced.scene.objects.find(item=>item.semanticRef==='work'),working.advanced.scene.objects.find(item=>item.semanticRef==='work'));
  assert.deepEqual(edited.events,working.events);assert.deepEqual(edited.studentProfile,working.studentProfile);assert.equal(JSON.stringify(working),before);
  const records=[],store=new TimelineStore({adapter:{atomicPut:async entries=>records.push(...structuredClone(entries))},entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canMutate:true}});
  store.document=migrateDocument(edited);await store.saveNow('SYNTHETIC_FIRST_FLAG_EDIT');
  const saved=JSON.parse(JSON.stringify(records.find(entry=>entry.store==='documents').value.document));
  assert.deepEqual(saved.advanced.scene.objects.find(item=>item.semanticRef==='degree').presentation,edited.advanced.scene.objects.find(item=>item.semanticRef==='degree').presentation);
  assert.deepEqual(saved.events,store.document.events);assert.equal(flagPaint(saved,'degree',options).template.poleFootY,125);
});

test('044 hydrated synthetic photo affects visible packing and all four actual creation handlers retain those media options',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),{document,options}=resolvedLongDegreeFixture();
  document.mediaItems=[{id:'synthetic-photo',placement:'photo1',visibilityState:'INTERVIEWER_SAFE'}];
  document.presentationOverrides={photoFrames:{1:{x:400,y:30,width:300,height:90,rotation:0}}};
  options.mediaUrls=new Map([['synthetic-photo','blob:synthetic-local-only']]);
  const begin=source.indexOf('const liveMediaById=')+'const liveMediaById='.length;
  const hydrate=new Function('mediaUrls','return '+source.slice(begin,source.indexOf('const hydrateMissingAdvancedMedia=',begin)).trim())(options.mediaUrls);
  options.mediaById=hydrate(document);assert.equal(options.mediaById.size,1);assert.equal(hydrate().size,0,'missing timeline reproduces the reviewed defect');
  const before=JSON.stringify(document),visible=flagPaint(document,'degree',options),empty=flagPaint(document,'degree',{...options,mediaById:hydrate()});
  assert.deepEqual(visible.rendered.scene.autoFlagLabels.get('degree'),{width:420,flip:false});
  assert.deepEqual(empty.rendered.scene.autoFlagLabels.get('degree'),{width:957,flip:true});
  const geometry=advancedEventGeometry407F(document,'degree',{dataset:{eventKind:'flag'}},options);
  assert.ok(Math.abs(geometry.y-54.88)<.02,'native acquisition matches hydrated visible packing');
  assert.equal(JSON.stringify(document),before,'selection remains a read without scene creation');
  for(const path of ['kernel','keyboard','rotate','pointer']){
    const edited=executeFirstEventEdit(source,path,document,'degree',geometry,options),paint=flagPaint(edited,'degree',options);
    const object=edited.advanced.scene.objects.find(item=>item.semanticRef==='degree');
    assert.deepEqual(object.presentation.flagLabelLayout,{width:420,flip:false},path+' captures the hydrated donor scene');
    assert.deepEqual(object.presentation.nativeFlagPole,{anchor:'native'});assert.ok(!object.presentation.localLayoutCriticAuto);
    assert.equal(object.geometry.width,50);assert.equal(object.geometry.height,64);assert.equal(paint.labels.length,visible.labels.length);
    assert.deepEqual(paint.texts.map(node=>[node.text,Math.round(node.fontSize*1e9)/1e9,node.fontFamily]),visible.texts.map(node=>[node.text,Math.round(node.fontSize*1e9)/1e9,node.fontFamily]));
    if(path!=='rotate'){
      assert.equal(paint.template.poleFootY,125);assert.ok(Math.abs(paint.template.bodyBottom-visible.template.bodyBottom-5)<.01);
      assert.deepEqual(paint.labels.map(node=>node.bounds.width),visible.labels.map(node=>node.bounds.width));
    }else assert.equal(violatesFounderTemplateBand(paint.template),true);
    assert.deepEqual(edited.events,document.events);assert.deepEqual(edited.mediaItems,document.mediaItems);assert.deepEqual(edited.presentationOverrides.photoFrames,document.presentationOverrides.photoFrames);
  }
  assert.equal(JSON.stringify(document),before);
});

async function retainedCriticAxisFixture(){
  const {document,options}=resolvedLongDegreeFixture();
  document.mediaItems=[{id:'density-photo',placement:'photo1',visibilityState:'INTERVIEWER_SAFE',crop:{x:.1,y:.2,width:.7,height:.6}}];
  document.presentationOverrides={photoFrames:{1:{x:400,y:30,width:300,height:90,rotation:0}}};
  options.mediaById=new Map([['density-photo','blob:synthetic-density-only']]);
  const projection=await projectLayoutCritic(document,options);let adopted=structuredClone(document);
  for(const target of projection.localContext.targetMap.values()){
    if(!target.editable)continue;
    const label=projection.localContext.scene.autoFlagLabels?.get(target.eventId);
    adopted=applyLocalLayoutCriticSceneCommand(adopted,{kind:'geometry',target:{type:'event',id:target.objectId},geometry:target.geometry,
      create:{type:'event',semanticRef:target.eventId,aspectLocked:false,presentation:{eventType:target.kind==='MILESTONE'?'milestone':'duration',localLayoutCriticAuto:true,...(target.kind==='MILESTONE'?{guardianAnchor:'axis',flagLabelLayout:structuredClone(label)}:{})}}},options).document;
  }
  adopted.presentationOverrides.axis.localLayoutCriticAuto=true;
  return {document:adopted,options};
}
function assertCriticDateMapping(document,options){
  const rendered=serializeFounderPresentation(document,options),axis=rendered.scene.composedAxis||rendered.scene.founderPresentation.axis;
  const total=axis.segmentWeights.reduce((sum,item)=>sum+item.weight,0),at=month=>{
    const [year,number]=month.split('-').map(Number),index=axis.segmentWeights.findIndex(item=>Number(item.id)===year);
    return 39.36+1841.28*(axis.segmentWeights.slice(0,index).reduce((sum,item)=>sum+item.weight,0)+axis.segmentWeights[index].weight*(number-1)/12)/total;
  };
  const paint=resolveFounderPresentationSvg(rendered.svg,{measureText:options.measureText});
  for(const object of document.advanced.scene.objects.filter(item=>item.type==='event'&&item.presentation.localLayoutCriticAuto===true&&!item.locked)){
    const event=document.events.find(event=>event.id===object.semanticRef),flag=rendered.scene.flags.find(flag=>flag.id===event.id);
    const geometry=flag?locked407FMilestoneGeometry(rendered.scene,event.id):paint.nodes.find(node=>node.semanticRef===event.id&&node.sourceAttributes['data-continuous-duration-arrow']).bounds;
    assert.ok(Math.abs(geometry.x-at(event.startDate))<.04,event.id+' starts at its fractional date');
    assert.ok(Math.abs(object.geometry.x-geometry.x)<.04,event.id+' stored and painted x agree');
    if(!flag){
      const end=rendered.scene.arrows.find(arrow=>arrow.id===event.id).endMonth,[year,month]=end.split('-').map(Number);
      const after=month===12?`${year+1}-01`:`${year}-${String(month+1).padStart(2,'0')}`;
      const endpoint=month===12&&Number(axis.segmentWeights.at(-1).id)===year?1880.64:at(after);
      assert.ok(Math.abs(geometry.width-(endpoint-at(event.startDate)))<.04);assert.ok(Math.abs(object.geometry.width-geometry.width)<.04);
    }
  }
  return {rendered,paint,axis};
}
test('044 actual human boundary and Reset automatic restore density for retained critic anchors and survive save/reopen',async()=>{
  const source=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),fixture=await retainedCriticAxisFixture();
  const records=[],store=new TimelineStore({adapter:{atomicPut:async entries=>records.push(...structuredClone(entries))},entitlement:{schemaVersion:'d1-405.timeline-entitlement.1',access:'FULL',verified:true,canRead:true,canMutate:true}});
  store.document=migrateDocument(fixture.document);const original=structuredClone(store.document),options=fixture.options;
  const poses=new Map(original.advanced.scene.objects.map(object=>[object.semanticRef,structuredClone(object.geometry)]));
  const beforePaint=flagPaint(store.document,'degree',options);
  const finish=result=>applyHumanAxisPresentation407F(store.document,result,options);
  const beginKernel=source.indexOf('const onKernelPresentationGesture=(event)=>')+'const onKernelPresentationGesture='.length;
  const kernel=source.slice(beginKernel,source.indexOf('onKernelPresentationEventGesture=',beginKernel)).trim();
  const weights=Array.from({length:7},(_,index)=>({id:String(2020+index),weight:index===5?8:1}));
  new Function('store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','syncBridgeStateFromStore','canvasController','bridge','return '+kernel)(store,finish,setAxisPresentationOverride,setAxisSegmentWeights,()=>{},{setUiState(){}},{toast(){}})({detail:{surface:'edit',kind:'axis-boundary',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:weights}});
  assert.deepEqual(store.document.presentationOverrides.axis.segmentWeights,weights);assertCriticDateMapping(store.document,options);
  const beginHooks=source.indexOf('const advancedHooks=()=>({')+'const advancedHooks=()=>({'.length;
  const hooks=source.slice(beginHooks,source.indexOf('onCategoryKeyChange:',beginHooks));
  const apply=result=>{const next=typeof result==='function'?result():result;if(next.changed)store.replace(next.document,{label:next.mutation?.label||'Synthetic axis test'});};
  const controls=new Function('store','finishHumanAxisEdit','setAxisPresentationOverride','setAxisSegmentWeights','resetAxisPresentationOverride','applyPresentationControlResult','return ({'+hooks+'});')(store,finish,setAxisPresentationOverride,setAxisSegmentWeights,resetAxisPresentationOverride,apply);
  controls.onAxisReset();assert.equal(store.document.presentationOverrides.axis,undefined,'Reset remains automatic after date reflow');
  const restored=assertCriticDateMapping(store.document,options),effective=restored.axis.segmentWeights.map(item=>item.weight);
  assert.ok(Math.max(...effective)-Math.min(...effective)>.1,'AI-owned geometry does not turn the automatic year ribbon uniform');
  assert.match(renderAdvancedPresentationControls(store.document),/data-axis-override-mode><option value="automatic" selected>/);
  for(const object of store.document.advanced.scene.objects){
    const pose=poses.get(object.semanticRef);for(const key of ['y','height','rotation'])assert.equal(object.geometry[key],pose[key]);
    assert.equal(object.presentation.localLayoutCriticAuto,true);
  }
  const afterPaint=flagPaint(store.document,'degree',options);assert.equal(afterPaint.template.poleFootY,125);
  assert.deepEqual(afterPaint.texts.map(node=>[node.text,node.fontSize,node.fontFamily]),beforePaint.texts.map(node=>[node.text,node.fontSize,node.fontFamily]));
  assert.deepEqual(store.document.events,original.events);assert.deepEqual(store.document.mediaItems,original.mediaItems);assert.deepEqual(store.document.presentationOverrides.photoFrames,original.presentationOverrides.photoFrames);
  await store.saveNow('SYNTHETIC_AI_AXIS_RESET');const saved=JSON.parse(JSON.stringify(records.find(entry=>entry.store==='documents').value.document));
  assert.equal(saved.presentationOverrides.axis,undefined);assert.deepEqual(saved.events,store.document.events);assert.deepEqual(saved.mediaItems,store.document.mediaItems);
  const reopened=assertCriticDateMapping(saved,options);assert.deepEqual(reopened.axis,restored.axis);assert.equal(reopened.rendered.svg,restored.rendered.svg);
});
test('044 axis reset never reinterprets human, unmarked, object-locked or globally locked event geometry',async()=>{
  const {document,options}=await retainedCriticAxisFixture();
  for(const protection of ['human','unmarked','object-lock','global-lock','manual-offset','group-lock']){
    const input=structuredClone(document),object=input.advanced.scene.objects.find(item=>item.semanticRef==='work');
    if(protection==='human'||protection==='unmarked')delete object.presentation.localLayoutCriticAuto;
    if(protection==='human')object.geometry={x:900,y:650,width:350,height:40,rotation:7};
    if(protection==='object-lock')object.locked=true;
    if(protection==='global-lock')input.layoutLock=true;
    if(protection==='manual-offset')input.events.find(event=>event.id==='work').manualOffset={x:10,y:5,laneLocked:true};
    if(protection==='group-lock'){input.advanced.scene.groups=[{id:'synthetic-locked-group',childIds:input.advanced.scene.objects.map(item=>item.id),locked:true,aspectLocked:true}];for(const item of input.advanced.scene.objects)item.groupId='synthetic-locked-group';input.advanced=projectSceneGraphToLegacy(input.advanced,input.advanced.scene);}
    const before=structuredClone(object),events=structuredClone(input.events),previous=resolveFounderPresentationSvg(serializeFounderPresentation(input,options).svg,{measureText:options.measureText}).nodes.find(node=>node.semanticRef==='work'&&node.sourceAttributes['data-continuous-duration-arrow']),reset=applyHumanAxisPresentation407F(input,resetAxisPresentationOverride(input),options);
    assert.equal(reset.changed,true,reset.error);assert.deepEqual(reset.document.advanced.scene.objects.find(item=>item.id===before.id),before,protection);
    const rendered=serializeFounderPresentation(reset.document,options),paint=resolveFounderPresentationSvg(rendered.svg,{measureText:options.measureText});
    const body=paint.nodes.find(node=>node.semanticRef==='work'&&node.sourceAttributes['data-continuous-duration-arrow']);
    assert.deepEqual(body.bounds,previous.bounds,protection+' keeps actual authored paint geometry');assert.deepEqual(body.commands,previous.commands);
    assert.deepEqual(reset.document.events,events);assert.deepEqual(reset.document.mediaItems,input.mediaItems);assert.deepEqual(reset.document.presentationOverrides.photoFrames,input.presentationOverrides.photoFrames);
  }
});
