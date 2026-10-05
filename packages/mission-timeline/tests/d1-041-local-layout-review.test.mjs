import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalLayoutReview,isLocalLayoutReviewLocation} from '../web/js/uxr-002/local-layout-review.js';
import {renderQualityGuardian,renderLocalLayoutReview,analyzeTimelineQuality,qualifyRenderedLayoutImprovement} from '../web/js/uxr-002/quality-guardian.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
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


// Actual synthetic renders, with no provider or applicant material.
const proposalDocument=()=>({id:'synthetic-proposal',studentProfile:{fullName:'Synthetic Example'},events:[{id:'synthetic-work',title:'Work',siteName:'Synthetic Site',categoryId:'work',eventType:'duration',startDate:'2020-01',endDate:'2021-01',visibilityState:'INTERVIEWER_SAFE'}],exams:[],theme:'keynote-classic',advanced:{media:[],elements:[],groups:[],textBlocks:[{id:'synthetic-note-a',text:'Synthetic note A',x:1100,y:850,width:300,height:40,size:18,font:'Arial'},{id:'synthetic-note-b',text:'Synthetic note B',x:1100,y:850,width:300,height:40,size:18,font:'Arial'}]}});
const proposalRender=d=>serializeFounderPresentation(d,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
const qualify=(before,after)=>qualifyRenderedLayoutImprovement(proposalRender(before),proposalRender(after),{beforeDocument:before,afterDocument:after});
const clearProposal=before=>{const after=structuredClone(before);after.advanced.textBlocks[1].y=920;return after;};

test('041 rendered proposal rejects bad-to-bad tiny change and qualifies collision-to-clear without source mutation',()=>{
 const before=proposalDocument(),snapshot=JSON.stringify(before),minor=structuredClone(before);minor.advanced.textBlocks[1].y+=1;
 const bad=qualify(before,minor);
 assert.equal(bad.qualified,false);assert.equal(bad.reasonCode,'LAYOUT_PROPOSAL_HARD_ERRORS_REMAIN');assert.ok(bad.after.materialCollisionCount>0);
 const after=clearProposal(before),good=qualify(before,after);
 assert.equal(good.qualified,true);assert.equal(good.mechanicalOnly,true);assert.equal(good.sourceUnchanged,true);assert.equal(good.geometryChanged,true);
 assert.ok(good.before.collisionCount>good.after.collisionCount);assert.equal(good.after.collisionCount,0);assert.equal(JSON.stringify(before),snapshot);
});

test('041 rendered proposal rejects identical and mechanically equal minor moves',()=>{
 const clear=clearProposal(proposalDocument()),same=qualify(clear,structuredClone(clear));
 assert.equal(same.qualified,false);assert.equal(same.reasonCode,'LAYOUT_PROPOSAL_UNCHANGED');
 const minor=structuredClone(clear);minor.advanced.textBlocks[1].y+=1;
 const equal=qualify(clear,minor);assert.equal(equal.geometryChanged,true);assert.equal(equal.qualified,false);assert.equal(equal.reasonCode,'LAYOUT_PROPOSAL_NO_MATERIAL_IMPROVEMENT');
});

test('041 source edits and unverified source never qualify as presentation improvements',()=>{
 for(const alter of [d=>d.events[0].title='Rewritten source',d=>d.events[0].startDate='2019-01',d=>d.studentProfile.fullName='Changed identity',d=>d.advanced.textBlocks[0].text='Changed authored note']){
  const before=proposalDocument(),after=clearProposal(before);alter(after);
  const result=qualify(before,after);assert.equal(result.qualified,false);assert.equal(result.reasonCode,'LAYOUT_PROPOSAL_SOURCE_CHANGED');
 }
 const d=proposalDocument();assert.equal(qualifyRenderedLayoutImprovement(proposalRender(d),proposalRender(clearProposal(d))).reasonCode,'LAYOUT_PROPOSAL_SOURCE_UNVERIFIED');
});

test('041 clipping, native-band failure and unreadable painted text reject cleared collisions',()=>{
 const before=proposalDocument(),clipped=clearProposal(before);clipped.advanced.textBlocks[1].x=1900;
 const clip=qualify(before,clipped);assert.equal(clip.qualified,false);assert.ok(clip.after.offCanvasCount>0);
 const small=proposalDocument();small.advanced.textBlocks.forEach(note=>note.size=8);
 const unreadable=qualify(small,clearProposal(small));assert.equal(unreadable.qualified,false);assert.ok(unreadable.after.unreadableCount>0);
 const band=applySceneCommandToDocument(clearProposal(before),{kind:'geometry',target:{type:'event',id:'synthetic-work'},geometry:{x:700,y:100,width:400,height:44},create:{type:'event',semanticRef:'synthetic-work',aspectLocked:false,presentation:{eventType:'duration'}}});
 assert.equal(band.changed,true);
 const native=qualify(before,band.document);assert.equal(native.qualified,false);assert.ok(native.after.templateViolationCount>0);
});

test('041 unresolved or vanished media cannot qualify as a safe improvement',()=>{
 const before=proposalDocument();before.mediaItems=[{id:'synthetic-image',type:'profilePhoto',placement:'profile',visibilityState:'INTERVIEWER_SAFE'}];
 const after=clearProposal(before),result=qualify(before,after);
 assert.equal(result.qualified,false);assert.equal(result.reasonCode,'TIMELINE_EXPORT_MISSING_FIELDS');
});
