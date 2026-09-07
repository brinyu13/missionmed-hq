import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {register} from 'tsx/esm/api';

const unregister=register();
const {registeredSyntheticReviewDocument,syntheticQualityReviewPayload,handleLocalSyntheticIntelligence}=await import('../scripts/local-synthetic-intelligence-021.mjs');
await unregister();
const digest=value=>createHash('sha256').update(value).digest('hex');
const sourceSha256='d261c62ac4e71f123cc048d1db096af04126032ac4830ef6c8f8cacd09f4a81d';
const base=()=>({id:'registered_synthetic',revision:1,theme:'keynote-classic',studentProfile:{fullName:'Synthetic Person'},events:[{id:'event-1',title:'Synthetic Research',categoryId:'research',startDate:'2021-03',endDate:'2022-12',visibilityState:'ADVISOR_ONLY',provenance:[]}],advanced:{background:{kind:'theme'},media:[],textBlocks:[],elements:[]}});
function registered(document=base(),override={}){
  const bytes=Buffer.from(JSON.stringify(document));
  const manifest={files:[{kind:'DOCUMENT',path:'/operator/synthetic.json',sha256:digest(bytes),sourceSha256,...override}]};
  return{manifestPath:'/operator/manifest.json',read:async path=>path==='/operator/manifest.json'?JSON.stringify(manifest):bytes};
}
function mockRequest(body,headers={}){
  return{method:'POST',headers:{host:'127.0.0.1:8792',origin:'http://127.0.0.1:8792','content-type':'application/json','x-timeline-synthetic-fixture':'021',...headers},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}};
}
async function invoke(body,headers={}){
  let status=0,payload=null;
  const response={writeHead(value){status=value;},end(value){payload=JSON.parse(value);}};
  await handleLocalSyntheticIntelligence(mockRequest(body,headers),response,new URL('http://127.0.0.1:8792/api/prototype-021/quality'),{});
  return{status,payload};
}

test('021 a known synthetic CV checksum cannot authorize unrelated biography before any provider request',async()=>{
  const originalFetch=globalThis.fetch;let providerCalls=0;
  globalThis.fetch=async()=>{providerCalls++;throw new Error('Provider must not be reached');};
  try{
    const result=await invoke({consentVersion:'d1-021-synthetic-provider-review-1',sourceSha256,document:{id:'private_unregistered',events:[{id:'private',title:'UNREGISTERED_PRIVATE_BIOGRAPHY',startDate:'2026-01'}]}});
    assert.equal(result.status,403);
    assert.equal(result.payload.error.code,'SYNTHETIC_DOCUMENT_NOT_REGISTERED');
    assert.match(result.payload.error.message,/local synthetic prototype/);
    assert.equal(providerCalls,0);
    assert.ok(!JSON.stringify(result.payload).includes('UNREGISTERED_PRIVATE_BIOGRAPHY'));
  }finally{globalThis.fetch=originalFetch;}
});

test('021 operator registration permits layout edits but every provider-visible factual change requires new registration',async()=>{
  const original=base(),input={sourceSha256,document:structuredClone(original)};
  input.document.revision=25;input.document.events[0].lane=4;input.document.events[0].manualOffset={x:40,y:60};input.document.zoom=1.7;
  const accepted=await registeredSyntheticReviewDocument(input,registered(original));
  assert.equal(accepted.registration.binding,'EXACT_PROVIDER_VISIBLE_EVENT_FACTS');
  for(const [key,value] of [['id','new-id'],['title','Different biography'],['categoryId','work'],['startDate','2021-04'],['endDate','2023-01'],['visibilityState','INTERVIEWER_SAFE']]){
    const changed=structuredClone(input);changed.document.events[0][key]=value;
    await assert.rejects(()=>registeredSyntheticReviewDocument(changed,registered(original)),error=>error.code==='SYNTHETIC_DOCUMENT_NOT_REGISTERED',key);
  }
  const extra=structuredClone(input);extra.document.events.push({...extra.document.events[0],id:'extra'});
  await assert.rejects(()=>registeredSyntheticReviewDocument(extra,registered(original)),error=>error.code==='SYNTHETIC_DOCUMENT_NOT_REGISTERED');
  await assert.rejects(()=>registeredSyntheticReviewDocument({...input,sourceSha256:'f'.repeat(64)},registered(original)),error=>error.code==='SYNTHETIC_DOCUMENT_NOT_REGISTERED');
  await assert.rejects(()=>registeredSyntheticReviewDocument(input,registered(original,{sha256:'0'.repeat(64)})),error=>error.code==='SYNTHETIC_DOCUMENT_HASH_CHANGED');
});

test('021 current layout findings and media counts reach review without arbitrary Advanced/profile text or request metadata',async()=>{
  const original=base(),current=structuredClone(original),secret='UNREGISTERED_PRIVATE_TEXT';
  current.id=secret;current.studentProfile.fullName=secret;current.theme=secret;
  current.advanced.background.kind=secret;
  current.advanced.textBlocks=[{id:secret,text:secret,x:1900,y:1000,width:400,height:200,size:24}];
  current.advanced.media=[{id:secret,name:secret,x:20,y:20,width:100,height:100}];
  current.deterministicFindings=[{message:secret}];
  const accepted=await registeredSyntheticReviewDocument({sourceSha256,document:current},registered(original));
  const payload=syntheticQualityReviewPayload(current,accepted.document);
  assert.ok(!JSON.stringify(payload).includes(secret));
  assert.equal(payload.document.id,original.id);
  assert.equal(payload.document.advanced.media.length,1);
  assert.equal(payload.document.advanced.textBlocks.length,1);
  assert.ok(payload.findings.some(finding=>finding.code==='OFF_CANVAS_OBJECT'));
  assert.ok(payload.findings.every(finding=>/^MissionMed local rule: [A-Z0-9_]+\.$/.test(finding.message)));
  assert.ok(payload.findings.every(finding=>finding.elementIds.every(id=>id==='event-1')));
});

test('021 loopback request origin and explicit synthetic header remain mandatory',async()=>{
  const body={sourceSha256,document:base(),consentVersion:'d1-021-synthetic-provider-review-1'};
  assert.equal((await invoke(body,{origin:'https://outside.example'})).payload.error.code,'LOCAL_ORIGIN_REQUIRED');
  assert.equal((await invoke(body,{host:'outside.example:8792'})).payload.error.code,'LOCAL_ORIGIN_REQUIRED');
  assert.equal((await invoke(body,{'x-timeline-synthetic-fixture':'wrong'})).payload.error.code,'LOCAL_SYNTHETIC_REQUEST_REQUIRED');
});
