import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createInterviewiqJobAuthenticator,createCommittedResearchProof,IIQ_JOB_PATH,IIQ_JOB_BINDING} from '../adapters/interviewiq-job-auth.mjs';
const NOW=1791103000000,REQUEST='synthetic-job-request-secret-123456789',PROOF='synthetic-job-proof-secret-987654321';
const CONFIG={enabled:true,requestSecret:REQUEST,proofSecret:PROOF};
const BINDING={requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'acgme:001.im',registryReleaseId:'registry-test-v1'};
const sha=x=>createHash('sha256').update(x).digest('hex'),mac=(k,x)=>createHmac('sha256',k).update(x).digest('hex');
function request({body=Buffer.from(JSON.stringify({...BINDING,kind:'program-gaps'})),timestamp=String(NOW/1000),nonce=randomUUID()}={}) {
 const canonical=`iiq-research-job-v1\nrequest\nrise-interviewiq-research-job\n${timestamp}\n${nonce}\nPOST\n${IIQ_JOB_PATH}\n${sha(body)}`;
 return {method:'POST',url:IIQ_JOB_PATH,body,rawHeaders:['Content-Type','application/json','X-MMED-IIQ-Job-Timestamp',timestamp,
  'X-MMED-IIQ-Job-Nonce',nonce,'X-MMED-IIQ-Job-Signature',mac(REQUEST,canonical)]};
}
function authSetup(config=CONFIG) {
 const nonces=new Set(),calls=[];return {calls,auth:createInterviewiqJobAuthenticator(config,{now:()=>NOW,consumeNonce:async value=>{
  calls.push(value);if(nonces.has(value.nonce))return false;nonces.add(value.nonce);return true;
 }})};
}
test('signed request binds frozen identities; canonical nonce hash differs from raw body hash',async()=>{
 const s=authSetup(),r=request(),a=await s.auth(r);assert.deepEqual(a.binding,BINDING);assert.equal(a.bodyHash,sha(r.body));
 const canonical=`iiq-research-job-v1\nrequest\nrise-interviewiq-research-job\n${NOW/1000}\n${r.rawHeaders[5]}\nPOST\n${IIQ_JOB_PATH}\n${sha(r.body)}`;
 assert.equal(s.calls[0].requestHash,sha(canonical));assert.notEqual(s.calls[0].requestHash,a.bodyHash);
 assert.equal(s.calls[0].issuer,'interviewiq');assert.equal(s.calls[0].expiresAt,new Date(NOW+90000).toISOString());
 const reply=a.signReceipt({status:'QUEUED',jobId:randomUUID(),proofExpiresAt:NOW/1000+30});
 assert.equal(reply.signature,mac(REQUEST,`iiq-research-job-v1\nresponse\n${reply.payload}`));
 const p=JSON.parse(reply.payload);for(const k of IIQ_JOB_BINDING)assert.equal(p[k],BINDING[k]);assert.equal(p.nonce,r.rawHeaders[5]);assert.equal(p.request_sha256,sha(r.body));
 assert.doesNotMatch(JSON.stringify(p),/session|cookie|wp_user_id|PRIVATE/);
 await assert.rejects(s.auth(r));assert.equal(s.calls.length,2);
});
for(const [name,edit] of Object.entries({
 method:r=>r.method='GET',query:r=>r.url+='?x=1',path:r=>r.url+='/',duplicate:r=>r.rawHeaders.push('x-mmed-iiq-job-nonce',randomUUID()),
 origin:r=>r.rawHeaders.push('Origin','https://example.org'),cookie:r=>r.rawHeaders.push('Cookie','test=1'),authorization:r=>r.rawHeaders.push('Authorization','Bearer synthetic'),
 actor:r=>r.rawHeaders.push('X-MMED-IIQ-Actor','synthetic'),override:r=>r.rawHeaders.push('X-HTTP-Method-Override','POST'),chunked:r=>r.rawHeaders.push('Transfer-Encoding','chunked'),
 encoding:r=>r.rawHeaders.push('Content-Encoding','gzip'),wrongLength:r=>r.rawHeaders.push('Content-Length','1'),duplicateContentType:r=>r.rawHeaders.push('content-type','application/json'),
 contentType:r=>r.rawHeaders[1]='text/plain',signature:r=>r.rawHeaders[7]='0'.repeat(64),nonce:r=>r.rawHeaders[5]='bad',timestamp:r=>r.rawHeaders[3]='1',
 newlineHeader:r=>r.rawHeaders[5]+='\n',badHeaderName:r=>r.rawHeaders.push('Bad Header','value'),unknownSecurity:r=>r.rawHeaders.push('X-MMED-Consumer','iiq'),
 missing:r=>r.rawHeaders.splice(4,2),nonBuffer:r=>r.body=r.body.toString(),empty:r=>r.body=Buffer.alloc(0),oversize:r=>r.body=Buffer.alloc(16385),
}))test(`reject ${name} before durable nonce`,async()=>{const s=authSetup(),r=request();edit(r);await assert.rejects(s.auth(r));assert.equal(s.calls.length,0);});
for(const timestamp of [String(NOW/1000-31),String(NOW/1000+31),String(NOW/1000)+'\n'])test(`reject signed timestamp ${JSON.stringify(timestamp)}`,async()=>{
 const s=authSetup();await assert.rejects(s.auth(request({timestamp})));assert.equal(s.calls.length,0);
});
for(const key of IIQ_JOB_BINDING)for(const suffix of ['\n','\r','\u2028','\u2029'])test(`exact ${key} rejects suffix ${JSON.stringify(suffix)}`,async()=>{
 const s=authSetup();await assert.rejects(s.auth(request({body:Buffer.from(JSON.stringify({...BINDING,[key]:BINDING[key]+suffix,kind:'program-gaps'}))})));assert.equal(s.calls.length,0);
});
for(const raw of [JSON.stringify({...BINDING,kind:'private-preparation'}),JSON.stringify({...BINDING,kind:'program-gaps',privateStory:'PRIVATE'}),
 JSON.stringify({...BINDING,kind:'program-gaps'}).replace('"kind":','"k\\u0069nd":"program-gaps","kind":'),
 JSON.stringify({...BINDING,kind:'program-gaps'}).replace('"programId":','"programId":"other","programId":')])test('invalid signed shape denied before nonce',async()=>{
 const s=authSetup();await assert.rejects(s.auth(request({body:Buffer.from(raw)})));assert.equal(s.calls.length,0);
});
test('malformed UTF8 with correct HMAC denies before nonce',async()=>{const s=authSetup();await assert.rejects(s.auth(request({body:Buffer.from([0xff,0xfe])})));assert.equal(s.calls.length,0);});
for(const config of [{}, {...CONFIG,enabled:false},{...CONFIG,proofSecret:REQUEST},{...CONFIG,requestSecret:'short'},{...CONFIG,otherSecrets:[REQUEST]},{...CONFIG,otherSecrets:[PROOF]}])
 test('disabled, incomplete or reused credentials fail closed',async()=>{const s=authSetup(config);await assert.rejects(s.auth(request()));assert.equal(s.calls.length,0);});

function proofSetup({edit=x=>x,fetchOverride}={}) {
 const calls=[];let clock=NOW;
 const fetchImpl=fetchOverride??(async(url,options)=>{
  calls.push({url,options});assert.equal(url,'https://interviewiq-production-2016.up.railway.app/api/owner/rise/research-authority');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
  assert.equal(options.headers['X-MMED-IIQ-Job-Proof'],mac(PROOF,`iiq-job-proof-v1\nrequest\n${options.body}`));
  const req=JSON.parse(options.body),payload=JSON.stringify(edit({...req,allowed:true,reason:'current_committed_demand',exp:req.iat+30}));
  return new Response(JSON.stringify({payload,signature:mac(PROOF,`iiq-job-proof-v1\nresponse\n${payload}`)}),{headers:{'Content-Type':'application/json'}});
 });
 return {calls,setClock:x=>clock=x,proof:createCommittedResearchProof(CONFIG,{now:()=>clock,fetchImpl})};
}
const proofInput={binding:BINDING,bodyHash:'b'.repeat(64),phase:'reserve'};
for(const phase of ['reserve','start','publish'])test(`fresh ${phase} callback uses actual A7 directional wire`,async()=>{
 const s=proofSetup(),p=await s.proof({...proofInput,phase});p.assertFresh();const sent=JSON.parse(s.calls[0].options.body);
 assert.deepEqual(Object.keys(sent),['audience','nonce','iat','phase',...IIQ_JOB_BINDING,'request_sha256']);assert.equal(sent.phase,phase);
 s.setClock(NOW+30000);assert.throws(p.assertFresh);
});
for(const [key,bad] of Object.entries({audience:'wrong',nonce:randomUUID(),iat:NOW/1000+1,phase:'publish',requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'other',registryReleaseId:'old',request_sha256:'a'.repeat(64),allowed:false,reason:'anything',exp:NOW/1000+31}))
 test(`signed proof mismatch ${key} denied`,()=>assert.rejects(proofSetup({edit:p=>({...p,[key]:bad})}).proof(proofInput)));
test('signed escaped duplicate response field rejected',async()=>{
 const s=proofSetup({fetchOverride:async(_url,options)=>{
  const req=JSON.parse(options.body),payload=JSON.stringify({...req,allowed:true,reason:'current_committed_demand',exp:req.iat+30}).replace('"allowed":','"all\\u006fwed":true,"allowed":');
  return new Response(JSON.stringify({payload,signature:mac(PROOF,`iiq-job-proof-v1\nresponse\n${payload}`)}),{headers:{'Content-Type':'application/json'}});
 }});await assert.rejects(s.proof(proofInput));
});
for(const response of [()=>new Response('x',{status:403}),()=>({ok:true,redirected:true}),()=>new Response('x',{headers:{'Content-Type':'text/plain'}}),
 ()=>new Response('x'.repeat(16385),{headers:{'Content-Type':'application/json'}})])test('invalid proof response is unavailable',()=>assert.rejects(proofSetup({fetchOverride:async()=>response()}).proof(proofInput)));
test('proof fetch deadline aborts stalled request',async()=>{
 let signal;const s=proofSetup({fetchOverride:async(_url,o)=>{signal=o.signal;return new Promise(()=>{});}});const at=performance.now();
 await assert.rejects(s.proof(proofInput));assert.ok(performance.now()-at<6500);assert.equal(signal.aborted,true);
});
test('proof streaming deadline cancels stalled body',async()=>{
 let cancelled=false;const s=proofSetup({fetchOverride:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}})});
 await assert.rejects(s.proof(proofInput));assert.equal(cancelled,true);
});
