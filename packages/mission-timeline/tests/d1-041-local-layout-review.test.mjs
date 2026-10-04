import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalLayoutReview,isLocalLayoutReviewLocation} from '../web/js/uxr-002/local-layout-review.js';
import {renderQualityGuardian,renderLocalLayoutReview,analyzeTimelineQuality} from '../web/js/uxr-002/quality-guardian.js';
import {projectLayoutCritic,LAYOUT_CRITIC_CONSENT_VERSION} from '../web/js/presentation/layout-critic-projection.js';

const digest='a'.repeat(64),location={protocol:'http:',hostname:'127.0.0.1'};
const capability={scope:'LOCAL_GEOMETRY_ONLY',providerConfigured:true,productionWrites:false,synthetic:false,consentVersion:LAYOUT_CRITIC_CONSENT_VERSION};
const providerReceipt={responseId:'resp_synthetic_test',model:'gpt-6.1-sol',store:false,receivedAt:'2026-10-04T00:00:00Z'};
const output={status:'COMPLETE',mode:'LOCAL_PROVIDER_AI',scope:'LOCAL_GEOMETRY_ONLY',synthetic:false,productionWrites:false,sourceUnchanged:true,sceneDigest:digest,recommendations:[{kind:'SET_EVENT_Y',targetId:'e0001',y:500,confidence:.9,reasonCode:'REDUCE_COLLISION'}],providerReceipt};
const response=(value,ok=true)=>({ok,json:async()=>structuredClone(value)});
function harness(overrides={}){
  const calls=[],states=[],store={document:{id:'synthetic-only',events:[],studentProfile:{fullName:'Synthetic Example'},metadata:{}},entitlement:{canMutate:true},replace(next,options){calls.push({next,options});this.document=next;return true;}};
  const options={location,fetchImpl:async(path)=>response(path.endsWith('capabilities')?capability:output),project:async()=>({input:{anonymousGeometry:true},sceneDigest:digest,localContext:{sourceDigest:digest,privateLabel:'DO NOT SEND'}}),validate:()=>{},apply:async doc=>({document:{...structuredClone(doc),presentationOverrides:{synthetic:true}},applied:1,rejected:[],before:{collisionCount:1},after:{collisionCount:0},sourceUnchanged:true}),onState:state=>states.push(state),...overrides};
  return {store,calls,states,controller:createLocalLayoutReview(store,options)};
}
test('041 local button requires loopback HTTP and verified server capability',async()=>{
  assert.equal(isLocalLayoutReviewLocation({protocol:'https:',hostname:'missionmed.com'}),false);
  assert.equal(isLocalLayoutReviewLocation({protocol:'http:',hostname:'localhost.evil.test'}),false);
  let requests=0;
  const h=harness({location:{protocol:'https:',hostname:'localhost'},fetchImpl:async()=>{requests++;throw Error();}});
  await h.controller.capabilities();await h.controller.review();assert.equal(requests,0);
  const bad=harness({fetchImpl:async()=>response({...capability,productionWrites:true})});
  await bad.controller.capabilities();assert.equal(bad.controller.state.available,false);
  assert.match(renderLocalLayoutReview({available:false,status:'UNAVAILABLE'}),/data-local-layout-review-start disabled/);
  assert.doesNotMatch(renderQualityGuardian(analyzeTimelineQuality(h.store.document)),/data-local-layout-review-start/);
});
test('041 click sends only geometry projection and checksum-bound consent; persists validated counts and receipt',async()=>{
  let body,header;
  const h=harness({fetchImpl:async(path,request)=>{if(path.endsWith('capabilities'))return response(capability);body=JSON.parse(request.body);header=request.headers;return response(output);}});
  await h.controller.capabilities();await h.controller.review();
  assert.deepEqual(Object.keys(body).sort(),['consent','projection','sceneDigest']);
  assert.deepEqual(body.consent,{version:LAYOUT_CRITIC_CONSENT_VERSION,sceneDigest:digest,geometryOnly:true});
  assert.equal(header['x-timeline-local-layout-critic'],'1');assert.doesNotMatch(JSON.stringify(body),/Synthetic Example|DO NOT SEND|studentProfile/);
  assert.equal(h.calls.length,1);assert.equal(h.store.document.metadata.qualityGuardian.localLayoutReview.applied,1);
  assert.equal(h.store.document.metadata.qualityGuardian.localLayoutReview.status,'APPLIED');
  assert.deepEqual(h.store.document.metadata.qualityGuardian.localLayoutReview.providerReceipt,providerReceipt);
  assert.equal(h.states.some(state=>state.busy&&state.status==='REVIEWING'),true);
  const html=renderLocalLayoutReview(h.controller.state);assert.match(html,/resp_synthetic_test/);assert.match(html,/1 \/ 1 \/ 0/);assert.match(html,/Biography, words, dates, photos and source files stay local/);
});
test('041 provider failures, missing receipts, stale digests and invalid recommendations leave source unchanged',async()=>{
  for(const value of [{status:'UNAVAILABLE'}, {...output,providerReceipt:null},{...output,sceneDigest:'b'.repeat(64)}]){
    const h=harness({fetchImpl:async(path)=>response(path.endsWith('capabilities')?capability:value,path.endsWith('capabilities')||value.status==='COMPLETE')});
    const before=JSON.stringify(h.store.document);await h.controller.capabilities();await h.controller.review();
    assert.equal(h.calls.length,0);assert.equal(JSON.stringify(h.store.document),before);assert.ok(['FAILED','STALE'].includes(h.controller.state.status));
  }
  let applied=false;const h=harness({validate:()=>{throw Error('invalid');},apply:async()=>{applied=true;}});
  await h.controller.capabilities();await h.controller.review();assert.equal(applied,false);assert.equal(h.calls.length,0);
});
test('041 disables repeated calls while awaiting provider and rejects changes made during apply',async()=>{
  let resolveRequest,posts=0;const wait=new Promise(resolve=>{resolveRequest=resolve;});
  const h=harness({fetchImpl:async(path)=>{if(path.endsWith('capabilities'))return response(capability);posts++;await wait;return response(output);}});
  await h.controller.capabilities();const pending=h.controller.review();await Promise.resolve();await h.controller.review();
  assert.equal(posts,1);assert.match(renderLocalLayoutReview(h.controller.state),/data-local-layout-review-start disabled/);
  resolveRequest();await pending;
  const changed=harness({apply:async doc=>{doc.revision=2;return {document:doc,applied:1,rejected:[],sourceUnchanged:true};}});
  await changed.controller.capabilities();await changed.controller.review();assert.equal(changed.controller.state.status,'STALE');assert.equal(changed.calls.length,0);
});
test('041 rejected safe-apply batch is truthfully reviewed without replacing the model',async()=>{
  const h=harness({apply:async doc=>({document:doc,applied:0,rejected:[{index:0,code:'LAYOUT_CRITIC_NO_SAFE_IMPROVEMENT'}],before:{collisionCount:1},after:{collisionCount:1},sourceUnchanged:true})});
  await h.controller.capabilities();await h.controller.review();assert.equal(h.calls.length,0);assert.equal(h.controller.state.status,'REVIEWED');assert.equal(h.controller.state.rejected,1);assert.ok(h.controller.state.receipt);
});
test('041 genuine projection of synthetic labels contains no raw biography, dates, labels, media or local alias mapping',async()=>{
  const doc={id:'synthetic-fixture',studentProfile:{fullName:'SYNTHETIC NAME SENTINEL'},events:[{id:'synthetic-event',title:'SYNTHETIC TITLE SENTINEL',institution:'SYNTHETIC INSTITUTION SENTINEL',categoryId:'work',startDate:'2020-01',endDate:'2021-01'}],advanced:{media:[],textBlocks:[],elements:[],groups:[]},theme:'keynote-classic'};
  const projection=await projectLayoutCritic(doc,{scope:'EVERYTHING',currentMonth:'2026-10'});
  const wire=JSON.stringify({projection:projection.input,sceneDigest:projection.sceneDigest});
  assert.doesNotMatch(wire,/SYNTHETIC|synthetic-event|2020-01|2021-01|localContext|data:image|https:/);
});
test('041 actual geometry validator and safe apply reject invalid output and later source changes',async()=>{
  for(const mode of ['invalid','stale','empty']){
    const h=harness({project:undefined,validate:undefined,apply:undefined,fetchImpl:async(path,request)=>{
      if(path.endsWith('capabilities'))return response(capability);
      const sent=JSON.parse(request.body);
      if(mode==='stale')h.store.document.studentProfile.fullName='Changed Synthetic Name';
      return response({...output,sceneDigest:sent.sceneDigest,recommendations:mode==='invalid'?[{kind:'DELETE_EVENT',targetId:'e0001'}]:[]});
    }});
    await h.controller.capabilities();await h.controller.review();
    assert.equal(h.calls.length,0);assert.equal(h.controller.state.status,mode==='stale'?'STALE':mode==='empty'?'REVIEWED':'FAILED');
  }
});
