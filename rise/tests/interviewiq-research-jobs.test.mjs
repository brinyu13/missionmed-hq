import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createInterviewiqResearchJobs} from '../src/interviewiq-research-jobs.mjs';
const NOW=1791103000000,REQUEST='synthetic-job-request-secret-123456789',PROOF='synthetic-job-proof-secret-987654321';
const CONFIG={enabled:true,requestSecret:REQUEST,proofSecret:PROOF};
const B={requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'acgme:001.im',registryReleaseId:'registry-test-v1'};
const PATH='/api/rise/v1/interviewiq/research-jobs',sha=x=>createHash('sha256').update(x).digest('hex'),mac=(k,x)=>createHmac('sha256',k).update(x).digest('hex');
function request(){const nonce=randomUUID(),body=Buffer.from(JSON.stringify({...B,kind:'program-gaps'}));return {method:'POST',url:PATH,body,rawHeaders:['Content-Type','application/json',
 'X-MMED-IIQ-Job-Timestamp',String(NOW/1000),'X-MMED-IIQ-Job-Nonce',nonce,'X-MMED-IIQ-Job-Signature',mac(REQUEST,`iiq-research-job-v1\nrequest\nrise-interviewiq-research-job\n${NOW/1000}\n${nonce}\nPOST\n${PATH}\n${sha(body)}`)]};}
function setup({config=CONFIG,editProof=p=>p,registry,rights,accept,omit}={}) {
 let reads=0,rightReads=0;const accepted=[],nonces=new Set(),jobId=randomUUID();
 const deps={now:()=>NOW,consumeNonce:async p=>{if(nonces.has(p.nonce))return false;nonces.add(p.nonce);return true;},
  getRegistry:async()=>registry?registry(++reads):{registryReleaseId:B.registryReleaseId,programs:[{programSpecialtyId:B.programId,private:'NEVER SEND'}]},
  assertSourceRights:async()=>({current:rights?rights(++rightReads):true}),
  acceptJob:async value=>{accepted.push(value);return accept?accept(value):{jobId,status:'QUEUED',private:'NEVER SEND'};},
  fetchImpl:async(_url,o)=>{const r=JSON.parse(o.body),payload=JSON.stringify(editProof({...r,allowed:true,reason:'current_committed_demand',wpUserId:90001,role:'student',tier:'360',exp:r.iat+30}));
   return new Response(JSON.stringify({payload,signature:mac(PROOF,`iiq-job-proof-v1\nresponse\n${payload}`)}),{headers:{'Content-Type':'application/json'}});}
 };if(omit)delete deps[omit];return {accepted,jobId,handler:createInterviewiqResearchJobs(config,deps)};
}
test('qualified synthetic acceptance signs exact minimal response without forwarding private registry fields',async()=>{
 const s=setup(),r=request(),result=await s.handler(r);assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'no-store');
 assert.equal(s.accepted.length,1);const {proof,...accepted}=s.accepted[0];assert.deepEqual(accepted,{ownerId:B.ownerId,requestId:B.requestId,bodyHash:sha(r.body),binding:B});assert.equal(proof.principal.wpUserId,90001);
 const p=JSON.parse(result.body.payload);assert.equal(p.jobId,s.jobId);assert.equal(p.status,'QUEUED');
 assert.equal(result.body.signature,mac(REQUEST,`iiq-research-job-v1\nresponse\n${result.body.payload}`));
 assert.doesNotMatch(JSON.stringify(result),/NEVER SEND|private|session|wp_user/);
});
for(const omit of ['consumeNonce','getRegistry','assertSourceRights','acceptJob'])test(`missing ${omit} never accepts`,async()=>{
 const s=setup({omit});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,0);
});
test('default disabled never accepts',async()=>{const s=setup({config:{}});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,0);});
test('revoked signed current entitlement denies before acceptance',async()=>{const s=setup({editProof:p=>({...p,allowed:false})});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,0);});
for(const at of [1,3,5])test(`rights drift at check ${at} cannot sign success`,async()=>{
 const s=setup({rights:n=>n<at});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,at===5?1:0);
});
for(const at of [2,3])test(`rights revoked during awaited registry read ${at} deny before accept or receipt`,async()=>{
 let valid=true;const s=setup({rights:()=>valid,registry:async n=>{
  await new Promise(r=>setImmediate(r));if(n===at)valid=false;
  return {registryReleaseId:B.registryReleaseId,programs:[{programSpecialtyId:B.programId}]};
 }});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,at===3?1:0);
});
for(const at of [1,2,3])test(`registry release drift at boundary ${at} cannot sign stale receipt`,async()=>{
 const s=setup({registry:n=>({registryReleaseId:n<at?B.registryReleaseId:'changed',programs:[{programSpecialtyId:B.programId}]})});
 assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,at===3?1:0);
});
for(const programs of [[],[{programSpecialtyId:B.programId},{programSpecialtyId:B.programId}],[{programSpecialtyId:'other'}]])test('missing or ambiguous canonical program denies before acceptance',async()=>{
 const s=setup({registry:()=>({registryReleaseId:B.registryReleaseId,programs})});assert.equal((await s.handler(request())).status,503);assert.equal(s.accepted.length,0);
});
for(const result of [{jobId:randomUUID(),status:'INVENTED'},{jobId:null,status:'COMPLETED'},{jobId:'https://bad',status:'QUEUED'},null])test('invalid actual store result cannot fabricate receipt',async()=>{
 const s=setup({accept:()=>result});assert.equal((await s.handler(request())).status,503);
});
for(const status of ['QUEUED','LEASED','RUNNING','NORMALIZING','PROMOTING','NEEDS_REVIEW','COMPLETED','PARTIAL','FAILED','REFUNDED','CANCELLED','PAUSED','NO_OP'])test(`explicit ${status} projection`,async()=>{
 const s=setup({accept:()=>({status,jobId:status==='NO_OP'?null:randomUUID()})});assert.equal(JSON.parse((await s.handler(request())).body.payload).status,status);
});
test('same HTTP nonce cannot accept twice',async()=>{const s=setup(),r=request();assert.equal((await s.handler(r)).status,200);assert.equal((await s.handler(r)).status,503);assert.equal(s.accepted.length,1);});
test('durable store error is sanitized, never false successful research',async()=>{const s=setup({accept:()=>{throw Error('PRIVATE DATABASE DETAIL');}});assert.deepEqual(await s.handler(request()),{status:503,headers:{'Cache-Control':'no-store'},body:{error:'interviewiq_job_unavailable'}});});
test('whole receiver deadline prevents later registry completion from accepting work',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;}),s=setup({registry:()=>pending}),start=performance.now();
 assert.equal((await s.handler(request())).status,503);assert.ok(performance.now()-start<12000);
 resolve({registryReleaseId:B.registryReleaseId,programs:[{programSpecialtyId:B.programId}]});
 await new Promise(r=>setImmediate(r));assert.equal(s.accepted.length,0);
});
test('late store result cannot fabricate successful or cancelled work after timeout',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;}),s=setup({accept:()=>pending});
 const response=await s.handler(request());assert.equal(response.status,503);assert.equal(s.accepted.length,1);
 resolve({status:'COMPLETED',jobId:randomUUID()});await new Promise(r=>setImmediate(r));
 assert.deepEqual(response.body,{error:'interviewiq_job_unavailable'});
});
