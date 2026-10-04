import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createRiseResearchJobTransport,parseResearchFlatJSON,deepResearchEnabled} from '../../server/research-dispatch.mjs';
import {researchJobDigest} from '../../server/research-job-store.mjs';
import {projectProgramResearch} from '../../server/rise-owner.mjs';
import {MRX_AREAS} from '../../server/research-standard.mjs';
const key='synthetic-request-'.repeat(3),mac=x=>createHmac('sha256',key).update(x).digest('hex'),sha=x=>createHash('sha256').update(x).digest('hex');
const binding={requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'synthetic-program',registryReleaseId:'synthetic-registry'};
const jobId=randomUUID(),clock=Date.now();
function transport(change=x=>x,options={}){return createRiseResearchJobTransport({enabled:true,requestSecret:key},{now:()=>clock,fetchImpl:async(url,init)=>{
 assert.equal(url,'https://missionmed-rise-production.up.railway.app/api/rise/v1/interviewiq/research-jobs');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.method,'POST');
 assert.equal(init.headers['X-MMED-IIQ-Job-Signature'],mac(`iiq-research-job-v1\nrequest\nrise-interviewiq-research-job\n${init.headers['X-MMED-IIQ-Job-Timestamp']}\n${init.headers['X-MMED-IIQ-Job-Nonce']}\nPOST\n/api/rise/v1/interviewiq/research-jobs\n${sha(init.body)}`));
 const r=change({audience:'rise-interviewiq-research-job',nonce:init.headers['X-MMED-IIQ-Job-Nonce'],request_sha256:sha(init.body),...binding,status:'QUEUED',jobId,iat:Math.floor(clock/1000),exp:Math.floor(clock/1000)+30});
 const payload=typeof r==='string'?r:JSON.stringify(r),envelope={payload,signature:mac(`iiq-research-job-v1\nresponse\n${payload}`)};
 return new Response(JSON.stringify(envelope),{headers:{'Content-Type':'application/json'}});
 },...options});}
test('exact bounded request and signed receipt',async()=>{const r=await transport()(binding,researchJobDigest(binding));assert.equal(r.status,'QUEUED');assert.equal(r.jobId,jobId);assert.deepEqual(r.binding,binding);});
for(const [name,change] of Object.entries({wrongOwner:r=>({...r,ownerId:randomUUID()}),wrongNonce:r=>({...r,nonce:randomUUID()}),wrongHash:r=>({...r,request_sha256:'a'.repeat(64)}),expired:r=>({...r,exp:r.iat}),future:r=>({...r,iat:r.iat+1}),unknownStatus:r=>({...r,status:'MAGIC'}),noJob:r=>({...r,jobId:null}),duplicate:r=>JSON.stringify(r).replace('"QUEUED"','"QUEUED","status":"COMPLETED"')}))test('reject '+name,()=>assert.rejects(transport(change)(binding,researchJobDigest(binding))));
test('default off and wrong digest never send',async()=>{let calls=0;const fetchImpl=()=>{calls++;throw Error('unexpected');};await assert.rejects(createRiseResearchJobTransport({}, {fetchImpl})(binding,researchJobDigest(binding)));await assert.rejects(transport(x=>x,{fetchImpl})(binding,'a'.repeat(64)));assert.equal(calls,0);});
test('same request retry preserves body and renews nonce',async()=>{const nonces=[];let body;const original=transport();await original(binding,researchJobDigest(binding));const fn=transport(x=>{nonces.push(x.nonce);return x;});await fn(binding,researchJobDigest(binding));await fn(binding,researchJobDigest(binding));assert.notEqual(nonces[0],nonces[1]);});
for(const raw of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"a":{"x":1}}','{"a":1}junk','{"__proto__":1}','{"a":NaN}'])test('flat parser rejects '+raw,()=>assert.throws(()=>parseResearchFlatJSON(raw,['a'])));
test('only exact currently eligible synthetic owner admitted',()=>{const a={id:binding.ownerId,eligible:true,role:'student',tier:'360'},c={deepResearch:{enabled:true,ownerId:binding.ownerId}};assert.equal(deepResearchEnabled(c,a),true);for(const delta of [{id:randomUUID()},{eligible:false},{role:'admin'},{tier:'free'}])assert.equal(deepResearchEnabled(c,{...a,...delta}),false);});
function projection(){const program={id:binding.programId,name:'Synthetic',track:'',registryReleaseId:binding.registryReleaseId};const coverage={programId:program.id,registryReleaseId:program.registryReleaseId,observedAt:new Date(clock).toISOString(),fields:Object.entries(MRX_AREAS).flatMap(([area,fields])=>fields.map(field=>({area,field,state:field==='research.visa'?'SUPPORTED':'UNKNOWN'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'))};coverage.receipt={sha256:sha(JSON.stringify(coverage)),publicRef:'rise-coverage-v1'};const fact={area:'visa',field:'research.visa',state:'SUPPORTED',claimRef:'rise-claim:'+sha('claim'),value:{sponsorship:'Program confirmation required'},retrievedAt:coverage.observedAt,asOf:null,sources:[{claimRef:'rise-claim:'+sha('original'),reviewRef:null,urls:['https://hospital.edu/residency'],retrievedAt:coverage.observedAt,reviewedAt:null}]};const body={schema:'rise-interviewiq-research-results-v1',coverage,facts:[fact]};return {program,input:{...body,receipt:{publicRef:'rise-results-v1',sha256:sha(JSON.stringify(body))}}};}
test('public factual reconstruction preserves exact wire receipt/value/provenance',()=>{const {program,input}=projection();assert.deepEqual(projectProgramResearch({...input,privateNotes:'hidden'},program,clock),input);});
for(const k of ['ownerId','WPUserID','privateNotes','secretKey','metadataBlob'])test('consumer denies nested private shape '+k,()=>{const {program,input}=projection();input.facts[0].value={detail:{[k]:'PRIVATE'}};assert.throws(()=>projectProgramResearch(input,program,clock));});
test('transport binds response to immutable sent identity across await',async()=>{
 const mutable={...binding},replacement=randomUUID();
 const fn=transport(r=>{mutable.ownerId=replacement;return {...r,ownerId:replacement};});
 await assert.rejects(fn(mutable,researchJobDigest(mutable)));
});
