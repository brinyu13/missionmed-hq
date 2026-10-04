import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountLocalLayoutReview407F} from '../web/js/407f-engineering-adapter.js';
import {LAYOUT_CRITIC_CONSENT_VERSION} from '../web/js/presentation/layout-critic-projection.js';

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
