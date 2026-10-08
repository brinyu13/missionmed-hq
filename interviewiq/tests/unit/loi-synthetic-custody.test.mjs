import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {normalizeLoiParagraphs,syntheticLoiCustodyAllowed,syntheticRejectedWire,SYNTHETIC_LOI_DIAGNOSTIC_REQUEST,createNativeLoiProseComposer,LOI_CANARY_OWNER,LOI_MODEL,PARAGRAPH_SCHEMA} from '../../server/loi-openai.mjs';
import {configuration,request} from '../helpers/loi-single-provider.mjs';
const input=JSON.parse(fs.readFileSync(new URL('../fixtures/loi-fictional-quality-02.json',import.meta.url))).input;
const actor={id:LOI_CANARY_OWNER,wpUserId:1397,role:'student',tier:'ivprep_complete',eligible:true};
const subject={interviewId:'1d50f55a-bbcf-4d77-a6aa-dfed1f00d9ae'},id=SYNTHETIC_LOI_DIAGNOSTIC_REQUEST;
const wire=()=>({schema:PARAGRAPH_SCHEMA,candidates:[{approach:'DIRECT_CONCISE',paragraphs:[{text:'Dear Program Leadership,',refs:[]},{text:'Your program offers 999 research awards.',refs:input.refs.map(r=>r.ref)},{text:'Thank you for your consideration.',refs:[]}],fitLinks:[{evidenceRef:'evidence:0',reasonRef:'reason:0'}]}]});
test('only exact synthetic ownership, subject, request and confirmed input may retain diagnostics',()=>{
 assert.equal(syntheticLoiCustodyAllowed(actor,subject,id,input),true);
 for(const change of [{id:'11111111-1111-4111-8111-111111111111'},{wpUserId:2468},{role:'admin'},{tier:'360'},{eligible:false}])assert.equal(syntheticLoiCustodyAllowed({...actor,...change},subject,id,input),false);
 assert.equal(syntheticLoiCustodyAllowed(actor,{interviewId:'11111111-1111-4111-8111-111111111111'},id,input),false);
 assert.equal(syntheticLoiCustodyAllowed(actor,subject,'11111111-1111-4111-8111-111111111111',input),false);
});
for(const field of Object.keys(input))test('changed '+field+' cannot enable custody',()=>{const altered=structuredClone(input);altered[field]={changed:true};assert.equal(syntheticLoiCustodyAllowed(actor,subject,id,altered),false);assert.equal(syntheticRejectedWire(wire(),altered,id),null);});
test('custody stores only bounded strict authored wire and immutable digest, never arbitrary response fields',()=>{
 const w=wire(),r=syntheticRejectedWire(w,input,id);assert.equal(r.schema,'iiq-synthetic-rejected-wire-v1');assert.deepEqual(r.wire,w);assert.match(r.outputSha256,/^[a-f0-9]{64}$/);w.candidates[0].paragraphs[1].text='mutated';assert.notEqual(r.wire.candidates[0].paragraphs[1].text,'mutated');
 assert.equal(syntheticRejectedWire({...wire(),headers:{authorization:'secret'}},input,id),null);
 const huge=wire();huge.candidates[0].paragraphs[1].text='x'.repeat(40000);assert.equal(syntheticRejectedWire(huge,input,id),null);
 assert.equal(syntheticRejectedWire(wire(),input,'11111111-1111-4111-8111-111111111111'),null);
});
async function attempt({diagnostic=id,secret=false,formatting=false}={}){const c=configuration(),w=wire(),passes=[];if(formatting)w.candidates[0].paragraphs[1].text+='\nExtra sentence.';if(secret)w.candidates[0].paragraphs[1].text+=' '+c.loiOpenai.apiKey;let calls=0;const composer=createNativeLoiProseComposer(c,{fetchImpl:async(_url,o)=>{calls++;const b=JSON.parse(o.body);assert.equal(b.store,false);assert.deepEqual(b.tools,[]);return new Response(JSON.stringify({object:'response',model:LOI_MODEL,service_tier:'default',status:'completed',error:null,incomplete_details:null,usage:{input_tokens:200,output_tokens:50,total_tokens:250,output_tokens_details:{reasoning_tokens:0}},output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(w),annotations:[]}]}]}),{headers:{'Content-Type':'application/json'}});}});let error;try{await composer.compose({...request(input,c),diagnosticRequestId:diagnostic,recordPass:async p=>passes.push(p)});}catch(e){error=e;}assert.ok(error);assert.equal(calls,1);assert.equal(passes.length,2);return error;}
test('rejected synthetic prose is retained privately without changing rejection or paid-pass accounting',async()=>{const e=await attempt();assert.equal(e.code,'LOI_PROVIDER_FAILED');assert.deepEqual(e.syntheticRejectedWire.wire,wire());assert.equal(e.syntheticRejectedWire.outputSha256,e.loiDiagnostic.outputSha256);assert.equal(e.validatedUsage.passes.length,1);});
test('non-allowlisted requests and any echoed secure key retain no raw custody',async()=>{for(const options of [{diagnostic:'11111111-1111-4111-8111-111111111111'},{secret:true}])assert.equal((await attempt(options)).syntheticRejectedWire,undefined);});
test('public generation and replay projection excludes private diagnostics/custody',()=>{const source=fs.readFileSync(new URL('../../server/loi-generation.mjs',import.meta.url),'utf8');const start=source.indexOf('function publicResult('),end=source.indexOf('\n',start);const fn=new Function(source.slice(start,end)+';return publicResult;')();const result=fn({generationId:'test',input:{approaches:[],refs:[]},subject},{status:'STANDARD_FALLBACK',proposals:[],diagnostic:{code:'test'},syntheticRejectedWire:{wire:'PRIVATE_SYNTHETIC_ONLY'}},true);assert.equal(result.syntheticRejectedWire,undefined);assert.equal(result.diagnostic,undefined);assert.ok(!JSON.stringify(result).includes('PRIVATE_SYNTHETIC_ONLY'));});

test('synthetic custody preserves trace-invalid wire without admitting it',()=>{
 for(const mutate of [w=>w.candidates[0].paragraphs[1].text+='\nExtra sentence.',w=>w.candidates[0].paragraphs[1].refs=['unknown'],w=>w.candidates[0].paragraphs[1].text=' padded ']){
  const w=wire();mutate(w);const r=syntheticRejectedWire(w,input,id);assert.deepEqual(r.wire,w);assert.throws(()=>normalizeLoiParagraphs(w,input));
 }
});
test('synthetic diagnostic shape rejects nested or arbitrary fields',()=>{
 for(const mutate of [w=>w.candidates[0].headers={authorization:'no'},w=>w.candidates[0].paragraphs[0].secret='no',w=>w.candidates[0].paragraphs[0].refs=[{value:'no'}],w=>w.candidates[0].fitLinks[0].headers='no']){
 const w=wire();mutate(w);assert.equal(syntheticRejectedWire(w,input,id),null);
 }
});
test('previous consumed synthetic diagnostic request cannot retain another wire',()=>{
 assert.equal(syntheticRejectedWire(wire(),input,'dfcbda50-ddeb-4d0e-9cf4-74f3f05f2b20'),null);
});

test('provider trace-invalid wire is captured before unchanged normalizer rejects it',async()=>{const e=await attempt({formatting:true});assert.equal(e.loiDiagnostic.code,'loi_composition_trace');assert.ok(e.syntheticRejectedWire.wire.candidates[0].paragraphs[1].text.includes('\n'));assert.equal(e.code,'LOI_PROVIDER_FAILED');});

test('raw synthetic custody preserves duplicate source IDs while normalization deduplicates',()=>{const w=wire();w.candidates[0].paragraphs[1].refs=['program','program'];const r=syntheticRejectedWire(w,input,id);assert.deepEqual(r.wire,w);assert.deepEqual(normalizeLoiParagraphs(w,input).candidates[0].claims[1].refs,['program']);});
