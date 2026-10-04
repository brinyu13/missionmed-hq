import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {recoverOpenAiResearchResponse,createOpenAiResearchProvider} from '../adapters/openai-research-provider.mjs';
const job={jobId:'synthetic-only',acgmeId:'1854831078',specialty:'Child Neurology',state:'TX',taskClass:'PROGRAM_DEEP_RESEARCH',programSpecialtyId:'synthetic-program',taskPayload:{requestedDomains:['visa'],requestedFields:['research.visa']}};
const url='https://example.edu/residency/visa';
function payload(){return {id:'resp_synthetic_a13',status:'completed',model:'gpt-5.6-terra',usage:{input_tokens:100,output_tokens:30},output:[{type:'web_search_call',action:{sources:[{url}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({program_identity:{acgme_id:job.acgmeId,program_name:"Synthetic",institution:"Synthetic",specialty:job.specialty,state:job.state},completion_matrix:{visa:{state:'VERIFIED',summary:'Published policy',source_urls:[url]}},findings:[{field:'visa',status:'FOUND',summary:'Published J1',value_json:'{"j1":true}',source_urls:[url]}],research_summary:'Synthetic published policy'})}]}]};}
function receipt(value=payload(),raw){const bytes=raw??Buffer.from(' \n'+JSON.stringify(value)+'\n');return {rawBodyBase64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex'),receivedAt:'2026-10-04T12:00:00.000Z',httpStatus:200,providerKey:'OPENAI_TERRA',modelKey:'gpt-5.6-terra'};}
const run=r=>recoverOpenAiResearchResponse({job,providerKey:'OPENAI_TERRA',receipt:r});
test('offline recovery retains exact original byte digest, time, claim IDs and usage across replay',()=>{
 const r=receipt(),before=structuredClone(r),first=run(r),second=run(r);
 assert.deepEqual(first,second);assert.deepEqual(r,before);assert.equal(first.ingest.sourceFileSha256,r.sha256);
 assert.equal(first.ingest.stagedAt,r.receivedAt);assert.equal(first.ingest.claims[0].retrievedAt,r.receivedAt);
 assert.equal(first.costBasis,'configured_estimate');assert.equal(first.usage.input_tokens,100);assert.equal(first.providerResponseId,'resp_synthetic_a13');
});
test('recovery never reaches fetch or reads an API credential',()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('network forbidden');};
 try{assert.equal(run(receipt()).findingCount,1);}finally{globalThis.fetch=original;}
});
for(const [name,change] of Object.entries({hash:r=>r.sha256='0'.repeat(64),base64:r=>r.rawBodyBase64+=' ',empty:r=>r.rawBodyBase64='',provider:r=>r.providerKey='OPENAI_SOL',model:r=>r.modelKey='other',status:r=>r.httpStatus='200',time:r=>r.receivedAt='yesterday',timestamp:r=>r.receivedAt='2026-10-04',huge:r=>r.rawBodyBase64='A'.repeat(12*1024*1024)}))test('receipt denies '+name,()=>{const r=receipt();change(r);assert.throws(()=>run(r),e=>e.costKnown===false && e.message==='Research provider recovery execution failed');});
for(const [name,change] of Object.entries({incomplete:p=>p.status='incomplete',model:p=>p.model='other',missingUsage:p=>delete p.usage,negativeUsage:p=>p.usage.input_tokens=-1,invalidId:p=>p.id='not-response-id',output:p=>p.output={}}))test('provider payload denies '+name,()=>{const p=payload();change(p);assert.throws(()=>run(receipt(p)));});
test('invalid UTF8 never becomes replacement characters in canonical claims',()=>{assert.throws(()=>run(receipt(null,Buffer.from([0xff,0x7b,0x7d]))));});
test('HTTP rejection preserves sanitized status and unknown usage without raw error leakage',()=>{
 assert.throws(()=>run({...receipt({error:{message:'PRIVATE provider secret'}}),httpStatus:429}),e=>e.httpStatus===429&&e.code==='OPENAI_PROVIDER_HTTP_ERROR'&&!e.costKnown&&!e.message.includes('PRIVATE'));
});
test('identity mismatch retains observed usage, never succeeds',()=>{
 const p=payload(),v=JSON.parse(p.output[1].content[0].text);v.program_identity.acgme_id='wrong';p.output[1].content[0].text=JSON.stringify(v);
 assert.throws(()=>run(receipt(p)),e=>e.code==='OPENAI_IDENTITY_MISMATCH'&&e.costKnown&&e.actualCostUsd>0);
});
test('strict field provenance never falls back to unrelated dossier sources',()=>{
 const p=payload(),v=JSON.parse(p.output[1].content[0].text);v.findings[0].source_urls=['https://not-cited.example/fact'];p.output[1].content[0].text=JSON.stringify(v);
 const result=run(receipt(p));assert.deepEqual(result.ingest.claims[0].sourceUrls,[]);assert.equal(result.ingest.claims[0].reviewState,'PENDING');
});
test('real execution checkpoint and offline replay produce identical canonical ingest with only one dispatch',async()=>{
 let calls=0,saved;const provider=createOpenAiResearchProvider({providerKey:'OPENAI_TERRA',apiKey:'synthetic',fetchImpl:async()=>{calls++;return new Response(' \n'+JSON.stringify(payload())+'\n');}});
 const live=await provider.execute({job,recovery:{signal:new AbortController().signal,checkpointResponse:async r=>{saved=r;}}});
 const replay=run(saved);assert.deepEqual(live.ingest,replay.ingest);assert.deepEqual(live.completionMatrix,replay.completionMatrix);assert.equal(calls,1);
});
for(const [name,change] of Object.entries({duplicate:v=>v.findings.push({...v.findings[0]}),unrequested:v=>v.findings[0].field='leadership',badJson:v=>v.findings[0].value_json='{',badStatus:v=>v.findings[0].status='MADE_UP',sourceObject:v=>v.findings[0].source_urls=[{}],badMatrix:v=>v.completion_matrix.visa.source_urls=null}))test('strict structured finding denies '+name,()=>{const p=payload(),v=JSON.parse(p.output[1].content[0].text);change(v);p.output[1].content[0].text=JSON.stringify(v);assert.throws(()=>run(receipt(p)));});
test('conflicting and researched-not-found findings keep their review semantics',()=>{for(const [status,state] of [['CONFLICT','CONFLICT'],['NOT_FOUND','RESEARCHED_NOT_FOUND']]){const p=payload(),v=JSON.parse(p.output[1].content[0].text);v.findings[0].status=status;p.output[1].content[0].text=JSON.stringify(v);assert.equal(run(receipt(p)).ingest.claims[0].evidenceState,state);}});

for(const key of ['__proto__','constructor','toString'])test('inherited provider key is never a provider '+key,()=>{const r=receipt();delete r.modelKey;r.providerKey=key;assert.throws(()=>recoverOpenAiResearchResponse({job,providerKey:key,receipt:r}));assert.throws(()=>createOpenAiResearchProvider({providerKey:key,apiKey:'synthetic'}));});
for(const key of ['specialty','state','program_name','institution'])test('structured identity requires consistent '+key,()=>{const p=payload(),v=JSON.parse(p.output[1].content[0].text);v.program_identity[key]=['specialty','state'].includes(key)?'OTHER':'';p.output[1].content[0].text=JSON.stringify(v);assert.throws(()=>run(receipt(p)),{code:'OPENAI_IDENTITY_MISMATCH'});});
test('caller mutation during provider await cannot move frozen canonical job or task',async()=>{const input=structuredClone(job);let saved;const provider=createOpenAiResearchProvider({providerKey:'OPENAI_TERRA',apiKey:'synthetic',fetchImpl:async()=>{input.programSpecialtyId='wrong-program';input.specialty='Other';input.taskPayload.requestedFields=['research.leadership'];return new Response(JSON.stringify(payload()));}});const result=await provider.execute({job:input,recovery:{signal:new AbortController().signal,checkpointResponse:async r=>{saved=r;}}});assert.equal(result.programSpecialtyId,job.programSpecialtyId);assert.equal(result.specialty,job.specialty);assert.deepEqual(result.requestedFields,job.taskPayload.requestedFields);assert.deepEqual(result.ingest,run(saved).ingest);});
