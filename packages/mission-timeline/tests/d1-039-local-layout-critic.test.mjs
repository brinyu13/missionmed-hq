import assert from 'node:assert/strict';
import test from 'node:test';
import {projectLayoutCritic,applyLayoutRecommendations,layoutCriticDigest,measureLayoutCriticSafety,validateLayoutCriticInput,validateLayoutRecommendations,LAYOUT_CRITIC_CONSENT_VERSION} from '../web/js/presentation/layout-critic-projection.js';
import {createLocalLayoutCritic,LOCAL_LAYOUT_CRITIC_PATH,LOCAL_LAYOUT_CRITIC_OUTPUT_SCHEMA} from '../scripts/local-layout-critic.mjs';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

// All inputs here are explicit synthetic unit fixtures. Network is injected;
// tests never use an environment provider key, applicant file or live provider.
const options={scope:'EVERYTHING',currentMonth:'2026-10'};
const fresh=(id='M02')=>structuredClone(FOUNDER_2025_MATRIX.find(item=>item.id===id).document);
const minimal=()=>{const document=fresh();document.events=document.events.filter(event=>event.id==='work');return document;};
const consent=p=>({projection:p.input,sceneDigest:p.sceneDigest,consent:{version:LAYOUT_CRITIC_CONSENT_VERSION,sceneDigest:p.sceneDigest,geometryOnly:true}});
const result=(p,recommendations=[])=>({sceneDigest:p.sceneDigest,recommendations});
const move=(p,y=300)=>({kind:'SET_EVENT_Y',targetId:p.input.targets[0].id,y,reasonCode:'REDUCE_COLLISION',confidence:.8});
const mockKey='local-test-placeholder-not-a-real-key';
function provider(p,{recommendations=[],responseId='resp_local_unit',model='gpt-6.1-sol',status=200}={}){
  const calls=[],receipts=[];
  const service=createLocalLayoutCritic({apiKey:mockKey,fetchImpl:async (url,init)=>{
    calls.push({url,init});return new Response(JSON.stringify({id:responseId,model,status:'completed',output_text:JSON.stringify(result(p,recommendations))}),{status,headers:{'x-request-id':'request_local_unit'}});
  },saveReceipt:async receipt=>{receipts.push(receipt);}});
  return {service,calls,receipts};
}
const parts=(id,groupId,role,bounds,kind='BODY')=>({id,groupId,role,kind,bounds:{rotation:0,...bounds},fontSize:0,lineHeight:0,characterCount:0,overflow:false});
const paint=document=>resolveFounderPresentationSvg(serializeFounderPresentation(document,options).svg);

test('geometry projection omits biography, raw identifiers, media sources and labels, binding exact minimized measures',async()=>{
  const document=minimal(),sentinel='UNIT_PRIVATE_CONTENT_SENTINEL';document.id=sentinel;document.studentProfile.fullName=sentinel;
  document.events[0].id=sentinel;document.events[0].title=sentinel;document.events[0].siteName=sentinel;
  document.events[0].provenance=[{sourceExcerpt:sentinel,sourceUrl:'https://unit-private.invalid/'+sentinel}];
  document.advanced.textBlocks=[{id:sentinel,text:sentinel,x:1200,y:500,width:350,height:30,size:18,font:'Arial'}];
  const before=JSON.stringify(document),p=await projectLayoutCritic(document,options),json=JSON.stringify(consent(p));
  assert.ok(!json.includes(sentinel));assert.ok(!json.includes('https://'));assert.ok(!json.includes('Medical Officer'));
  assert.equal(p.sceneDigest,await layoutCriticDigest(p.input));assert.equal(JSON.stringify(document),before);
  assert.ok(p.localContext.targetMap.get('e0001').eventId===sentinel);
  assert.ok(p.input.parts.some(part=>part.kind==='TEXT'&&part.characterCount===sentinel.length));
  assert.equal(validateLayoutCriticInput(p.input),p.input);
  for(const location of ['root','part','target','axis']){
    const changed=structuredClone(p.input);(location==='root'?changed:location==='part'?changed.parts[0]:location==='target'?changed.targets[0]:changed.axis).rawLabel=sentinel;
    assert.throws(()=>validateLayoutCriticInput(changed),{code:'LAYOUT_CRITIC_INPUT_INVALID'});
  }
  const changed=minimal();changed.events[0].title='Different synthetic label length';
  assert.notEqual((await projectLayoutCritic(changed,options)).sceneDigest,(await projectLayoutCritic(minimal(),options)).sceneDigest);
});

test('consent version, geometry-only scope and exact digest are enforced before provider calls',async()=>{
  const p=await projectLayoutCritic(minimal(),options),{service,calls}=provider(p);
  for(const change of [input=>delete input.consent,input=>input.consent.version='old',input=>input.consent.geometryOnly=false,input=>input.sceneDigest='0'.repeat(64),input=>input.consent.sceneDigest='0'.repeat(64),input=>input.document={events:[]}]){
    const input=consent(p);change(input);await assert.rejects(()=>service.analyze(input),error=>error.code.startsWith('LAYOUT_CRITIC_'));
  }
  assert.equal(calls.length,0);
  const noKey=createLocalLayoutCritic({apiKey:'',fetchImpl:async()=>{throw Error('must not run');},saveReceipt:async()=>{}});
  await assert.rejects(()=>noKey.analyze(consent(p)),{code:'LAYOUT_CRITIC_PROVIDER_UNAVAILABLE'});
});

test('real transport uses documented Sol6.1 high, strict structured outputs, store:false and private digest/count receipt',async()=>{
  const p=await projectLayoutCritic(minimal(),options),{service,calls,receipts}=provider(p);
  const response=await service.analyze(consent(p));assert.equal(response.status,'COMPLETE');assert.equal(response.synthetic,false);
  assert.equal(response.mode,'LOCAL_PROVIDER_AI');assert.equal(response.recommendationCount,0);assert.equal(response.sourceUnchanged,true);
  const request=JSON.parse(calls[0].init.body);assert.equal(calls[0].url,'https://api.openai.com/v1/responses');assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.reasoning.effort,'high');assert.equal(request.store,false);assert.equal(request.text.format.strict,true);
  assert.deepEqual(request.text.format.schema,LOCAL_LAYOUT_CRITIC_OUTPUT_SCHEMA);
  assert.ok(!calls[0].init.body.includes('Medical Officer'));assert.ok(!calls[0].init.body.includes('Morgan Lake'));
  assert.equal(response.providerReceipt.responseId,'resp_local_unit');assert.equal(response.providerReceipt.store,false);
  assert.match(response.providerReceipt.inputSha256,/^[a-f0-9]{64}$/);assert.match(response.providerReceipt.outputSha256,/^[a-f0-9]{64}$/);
  assert.equal(receipts.length,1);assert.equal(receipts[0].sceneDigest,p.sceneDigest);assert.equal(receipts[0].counts.recommendations,0);assert.equal(receipts[0].productionWrites,false);
  assert.ok(!JSON.stringify(receipts).includes('Medical Officer'));
});

test('missing receipt, unexpected model, invalid output, refusal, failure and timeout never complete or save evidence',async()=>{
  const p=await projectLayoutCritic(minimal(),options);
  for(const config of [{responseId:null},{model:'other-model'},{status:503}]){
    const {service,receipts}=provider(p,config);await assert.rejects(()=>service.analyze(consent(p)),error=>error.code.startsWith('LAYOUT_CRITIC_'));assert.equal(receipts.length,0);
  }
  for(const responseBody of [{id:'resp_refusal',model:'gpt-6.1-sol',output:[]},{id:'resp_bad',model:'gpt-6.1-sol',output_text:'not-json'},{id:'resp_bad',model:'gpt-6.1-sol',output_text:JSON.stringify({sceneDigest:p.sceneDigest,recommendations:[{kind:'SET_TITLE',text:'INVENTED_UNIT_BIOGRAPHY'}]})}]){
    let saved=0;const service=createLocalLayoutCritic({apiKey:mockKey,fetchImpl:async()=>new Response(JSON.stringify(responseBody)),saveReceipt:async()=>saved++});
    await assert.rejects(()=>service.analyze(consent(p)));assert.equal(saved,0);
  }
  let saved=0;const timeout=createLocalLayoutCritic({apiKey:mockKey,timeoutMs:5,fetchImpl:async (_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true})),saveReceipt:async()=>saved++});
  await assert.rejects(()=>timeout.analyze(consent(p)),{code:'LAYOUT_CRITIC_PROVIDER_TIMEOUT'});assert.equal(saved,0);
});

test('capability GET uses same-origin fetch metadata; POST still requires exact Origin and request header',async()=>{
  const p=await projectLayoutCritic(minimal(),options),{service,calls}=provider(p);
  async function invoke({method='POST',path=LOCAL_LAYOUT_CRITIC_PATH,headers={},remote='127.0.0.1',body=consent(p)}={}){
    const request={method,headers:{host:'127.0.0.1:8906',origin:'http://127.0.0.1:8906','content-type':'application/json','x-timeline-local-layout-critic':'1',...headers},socket:{remoteAddress:remote},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}};
    let status,payload;const response={writeHead(value){status=value;},end(value){payload=JSON.parse(value);}};
    const handled=await service.handler(request,response,new URL('http://127.0.0.1:8906'+path));return{handled,status,payload};
  }
  const capability=await invoke({method:'GET',path:LOCAL_LAYOUT_CRITIC_PATH+'/capabilities',headers:{origin:undefined,'sec-fetch-site':'same-origin'}});
  assert.equal(capability.status,200);assert.equal(capability.payload.providerConfigured,true);assert.equal(capability.payload.synthetic,false);assert.equal(calls.length,0);
  for(const denied of [{headers:{origin:undefined,'sec-fetch-site':'same-origin'}},{headers:{origin:'https://other.invalid'}},{headers:{host:'outside.invalid:8906'}},{remote:'192.0.2.1'},{headers:{'x-timeline-local-layout-critic':'wrong'}}])assert.equal((await invoke(denied)).status,403);
  assert.equal(calls.length,0);
  const accepted=await invoke();assert.equal(accepted.status,200);assert.equal(accepted.payload.status,'COMPLETE');assert.equal(calls.length,1);
});

test('painted flag body, date and label crossings count against ribbon; same-group intentional layering is exempt',()=>{
  const axis=parts('p0001','g0001','AXIS',{x:0,y:144,width:1920,height:32});
  for(const kind of ['BODY','TEXT','IMAGE']){
    const crossing=parts('p0002','g0002','EVENT',{x:400,y:155,width:50,height:25},kind);
    assert.equal(measureLayoutCriticSafety([axis,crossing]).axisOverlapCount,1);
  }
  const group=parts('p0003','g0002','EVENT',{x:400,y:155,width:50,height:25},'TEXT');
  assert.equal(measureLayoutCriticSafety([group,{...group,id:'p0004'}]).collisionCount,0);
  assert.equal(measureLayoutCriticSafety([parts('p0001','g0001','EVENT',{x:1900,y:100,width:100,height:50,rotation:20})]).offCanvasCount,1);
});

test('unknown targets, arbitrary fields, invalid weights and manual/locked/attached placements are rejected',async()=>{
  const p=await projectLayoutCritic(minimal(),options);
  for(const op of [{...move(p),targetId:'e9999'},{...move(p),x:100},{...move(p),y:Infinity},{kind:'SET_TITLE',title:'fiction',reasonCode:'REDUCE_COLLISION',confidence:1}])assert.throws(()=>validateLayoutRecommendations(p.input,result(p,[op]),p.sceneDigest));
  const weights={kind:'SET_YEAR_WEIGHTS',weights:p.input.axis.segments.map(segment=>({segmentId:segment.id,weight:1})),reasonCode:'BALANCE_SPACING',confidence:.7};
  assert.doesNotThrow(()=>validateLayoutRecommendations(p.input,result(p,[weights]),p.sceneDigest));
  weights.weights[0].weight=9;assert.throws(()=>validateLayoutRecommendations(p.input,result(p,[weights]),p.sceneDigest));
  for(const alter of [document=>document.layoutLock=true,document=>document.events[0].manualOffset={y:25},document=>document.events[0].manualOffset={laneLocked:true}]){
    const document=minimal();alter(document);const projected=await projectLayoutCritic(document,options);
    assert.equal(projected.input.targets[0].editable,false);assert.throws(()=>validateLayoutRecommendations(projected.input,result(projected,[move(projected)]),projected.sceneDigest));
  }
  const document=minimal();const placed=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:'work'},geometry:{x:800,y:300,width:400,height:43.567795,rotation:0},create:{type:'event',semanticRef:'work',aspectLocked:false,presentation:{eventType:'duration'}}}).document;
  const authored=await projectLayoutCritic(placed,options);assert.equal(authored.input.targets[0].editable,false);assert.equal(authored.input.axis.editable,false);
});

test('stale source/geometry rejection and unsafe/no-improvement results leave originals unchanged',async()=>{
  const document=minimal(),before=JSON.stringify(document),p=await projectLayoutCritic(document,options);
  await assert.rejects(()=>applyLayoutRecommendations(document,result(p,[move(p)]),'0'.repeat(64),options),{code:'LAYOUT_CRITIC_STALE_SCENE'});
  const changed=structuredClone(document);changed.events[0].notes='Same-layout synthetic factual correction';
  await assert.rejects(()=>applyLayoutRecommendations(changed,result(p,[move(p)]),p.sceneDigest,{...options,sourceDigest:p.localContext.sourceDigest}),{code:'LAYOUT_CRITIC_STALE_SCENE'});
  const unsafe=await applyLayoutRecommendations(document,result(p,[move(p,1050)]),p.sceneDigest,{...options,sourceDigest:p.localContext.sourceDigest});
  assert.equal(unsafe.applied,0);assert.ok(unsafe.rejected.length);assert.equal(unsafe.sourceUnchanged,true);assert.equal(unsafe.document,document);assert.equal(JSON.stringify(document),before);
  const empty=await applyLayoutRecommendations(document,result(p),p.sceneDigest,options);assert.equal(empty.applied,0);assert.equal(empty.sourceUnchanged,true);
});

async function generatedCollision(two=false){
  let document=minimal();document.mode='advanced';
  if(two)document.events.push({...structuredClone(document.events[0]),id:'work-other',title:'Other synthetic work'});
  const first=await projectLayoutCritic(document,options),target=first.localContext.targetMap.get('e0001');
  // A prior critic-owned automatic anchor is not a user-authored placement.
  // This synthetic same-geometry state deliberately contains a real collision.
  for(const entry of first.localContext.targetMap.values())document=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:entry.objectId},geometry:{...entry.geometry,...(entry.eventId===target.eventId?{y:300}:{})},
    create:{type:'event',semanticRef:entry.eventId,aspectLocked:false,presentation:{eventType:'duration',localLayoutCriticAuto:true}}},options).document;
  if(document.presentationOverrides?.axis)document.presentationOverrides.axis.localLayoutCriticAuto=true;
  document.advanced.textBlocks=[{id:'synthetic-obstacle',text:'Synthetic obstacle',x:target.geometry.x+40,y:300,width:180,height:30,size:18,font:'Arial'}];
  return document;
}
test('safe proposal survives an unsafe independent candidate; native shape, semantics and unrelated text remain exact',async()=>{
  const document=await generatedCollision(true),before=JSON.stringify(document),p=await projectLayoutCritic(document,options);
  assert.ok(p.input.safety.collisionCount>0);
  const proposals=[{...move(p,1050),targetId:'e0002'},move(p,400)];
  assert.doesNotThrow(()=>validateLayoutRecommendations(p.input,result(p,proposals),p.sceneDigest));
  const accepted=await applyLayoutRecommendations(document,result(p,proposals),p.sceneDigest,{...options,sourceDigest:p.localContext.sourceDigest});
  assert.equal(accepted.applied,1);assert.equal(accepted.rejected.length,1);assert.equal(accepted.rejected[0].index,0);assert.equal(accepted.candidatesEvaluated,2);
  assert.equal(accepted.sourceUnchanged,true);assert.equal(JSON.stringify(document),before);
  assert.deepEqual(accepted.document.events,document.events);assert.deepEqual(accepted.document.studentProfile,document.studentProfile);assert.deepEqual(accepted.document.advanced.textBlocks,document.advanced.textBlocks);
  const beforePaint=paint(document),afterPaint=paint(accepted.document),arrow=nodes=>nodes.nodes.find(node=>node.sourceAttributes['data-continuous-duration-arrow']);
  const a=arrow(beforePaint),b=arrow(afterPaint);assert.ok(Math.abs(a.bounds.x-b.bounds.x)<.04);assert.ok(Math.abs(a.bounds.width-b.bounds.width)<.04);assert.ok(Math.abs(a.bounds.height-b.bounds.height)<.04);assert.equal(a.commands.length,b.commands.length);
  assert.ok(accepted.after.collisionCount<accepted.before.collisionCount);assert.ok(accepted.after.crowdingCount<=accepted.before.crowdingCount);
});

test('candidate composition budget is eight, with truthful per-proposal rejection counts',async()=>{
  const document=await generatedCollision(),p=await projectLayoutCritic(document,options),operations=Array.from({length:30},()=>move(p,1050));
  const checked=await applyLayoutRecommendations(document,result(p,operations),p.sceneDigest,options);
  assert.equal(checked.applied,0);assert.equal(checked.candidatesEvaluated,8);assert.equal(checked.rejected.length,30);
  assert.equal(checked.rejected.filter(item=>item.code==='LAYOUT_CRITIC_CANDIDATE_BUDGET').length,22);assert.equal(checked.sourceUnchanged,true);
});

test('year weights reflow true fractional-month x positions and width while preserving y, source dates and unrelated manual text',async()=>{
  const document=await generatedCollision(),before=JSON.stringify(document),p=await projectLayoutCritic(document,options);
  assert.equal(p.input.axis.editable,true);
  const weights={kind:'SET_YEAR_WEIGHTS',weights:p.input.axis.segments.map((segment,index)=>({segmentId:segment.id,weight:index?1:8})),reasonCode:'REDUCE_COLLISION',confidence:.8};
  const accepted=await applyLayoutRecommendations(document,result(p,[weights]),p.sceneDigest,options);
  assert.equal(accepted.applied,1,JSON.stringify(accepted.rejected));assert.equal(accepted.after.collisionCount,0);
  const next=await projectLayoutCritic(accepted.document,options),a=p.input.targets[0].geometry,b=next.input.targets[0].geometry;
  assert.notEqual(a.x,b.x);assert.notEqual(a.width,b.width);assert.ok(Math.abs(a.y-b.y)<.04);assert.ok(Math.abs(a.height-b.height)<.04);
  // July is halfway through the first year, independently of event wording.
  const expectedX=Math.floor((39.36+1841.28*(8/9)*.5)*64)/64;
  assert.ok(Math.abs(b.x-expectedX)<.04,`${b.x} vs ${expectedX}`);
  assert.deepEqual(accepted.document.events,document.events);assert.deepEqual(accepted.document.advanced.textBlocks,document.advanced.textBlocks);assert.equal(JSON.stringify(document),before);
  assert.equal(next.input.targets[0].editable,true,'automatic anchor is never relabeled as a user lock');
});

test('global Guided layout lock permits truthful read-only review and rejects every applying operation',async()=>{
  const document=minimal();document.layoutLock=true;const before=JSON.stringify(document),p=await projectLayoutCritic(document,options);
  assert.ok(p.input.targets.every(target=>!target.editable));assert.equal(p.input.axis.editable,false);
  const {service}=provider(p);const analysis=await service.analyze(consent(p));assert.equal(analysis.status,'COMPLETE');assert.equal(analysis.recommendationCount,0);
  const noOp=await applyLayoutRecommendations(document,{sceneDigest:analysis.sceneDigest,recommendations:analysis.recommendations},p.sceneDigest,options);
  assert.equal(noOp.applied,0);assert.equal(noOp.sourceUnchanged,true);assert.equal(JSON.stringify(document),before);
  assert.throws(()=>validateLayoutRecommendations(p.input,result(p,[move(p)]),p.sceneDigest),{code:'LAYOUT_CRITIC_OPERATION_REJECTED'});
});
