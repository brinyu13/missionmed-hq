import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createInterviewiqAuthenticator,parseInterviewiqRoute,strictFlatJson} from '../adapters/interviewiq-auth.mjs';
import {createInterviewiqOwner} from '../src/interviewiq-owner.mjs';
import {DEEP_RESEARCH_DOSSIER_V2} from '../src/research-router.mjs';

const SECRET='synthetic-request-key-not-for-production-123';
const PROOF='synthetic-proof-key-not-for-production-456';
const NOW=1791088000000;
const sha=x=>createHash('sha256').update(x).digest('hex');
const mac=(key,x)=>createHmac('sha256',key).update(x).digest('hex');
const PATH='/api/rise/v1/interviewiq/programs?q=&page=1&pageSize=20';
const ACTOR={subject:'11111111-1111-4111-8111-111111111111',wp_user_id:123,session_verifier:'a'.repeat(64),auth_role:'student',auth_tier:'360'};
const CONFIG={enabled:true,requestSecret:SECRET,proofSecret:PROOF};
function request({path=PATH,actor=ACTOR,rawActor=JSON.stringify(actor),time=NOW/1000,nonce=randomUUID()}={}) {
  const canonical=`iiq-owner-v1\nrise\n${time}\n${nonce}\nGET\n${path}\n${sha('')}\n${sha(rawActor)}`;
  return {method:'GET',url:path,body:Buffer.alloc(0),rawHeaders:['X-MMED-IIQ-Owner','rise','X-MMED-IIQ-Timestamp',String(time),
    'X-MMED-IIQ-Nonce',nonce,'X-MMED-IIQ-Actor',Buffer.from(rawActor).toString('base64url'),'X-MMED-IIQ-Signature',mac(SECRET,canonical)]};
}
function setup({mutateProof=x=>x,fetchOverride,rights,registry,readCoverage,config=CONFIG}={}) {
  // In-memory nonce store is ONLY an offline fixture. Production composition
  // cannot rely on this test for PostgreSQL replay/restore acceptance.
  const nonces=new Set(),proofs=[],admissions=[];
  const dependencies={now:()=>NOW,readCoverage,consumeNonce:async p=>{admissions.push(p);if(nonces.has(p.nonce))return false;nonces.add(p.nonce);return true;},
    assertSourceRights:rights??(async()=>({current:true})),getRegistry:registry??(async()=>({registryReleaseId:'registry-synthetic-v1',programs:[
      {programSpecialtyId:'acgme:001.im',display:{programName:'Synthetic Residency',track:'Internal Medicine'},privateStudent:'NEVER RETURN',facts:['UNVALIDATED']},
      {programSpecialtyId:'acgme:002.im',display:{programName:'Other Synthetic Residency'}}]})),
    fetchImpl:fetchOverride??(async(url,options)=>{
      assert.equal(url,'https://missionmedinstitute.com/wp-json/missionmed/v1/interviewiq-owner/rise/introspect');
      assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
      assert.equal(options.headers['X-MMED-IIQ-Owner-Proof'],mac(PROOF,`iiq-owner-proof-v1\nrequest\n${options.body}`));
      const p=JSON.parse(options.body);proofs.push(p);
      const body=JSON.stringify(mutateProof({audience:p.audience,nonce:p.nonce,request_sha256:p.request_sha256,subject:p.subject,
        wp_user_id:p.wp_user_id,session_verifier:p.session_verifier,allowed:true,role:ACTOR.auth_role,tier:ACTOR.auth_tier,iat:NOW/1000,exp:NOW/1000+30},proofs.length));
      return new Response(body,{headers:{'Content-Type':'application/json','X-MMED-IIQ-Owner-Proof':mac(PROOF,`iiq-owner-proof-v1\nresponse\n${body}`)}});
    })};
  return {dependencies,proofs,admissions,handler:createInterviewiqOwner(config,dependencies)};
}

test('search returns only canonical identities and checks fresh proof twice',async()=>{
  const s=setup(),r=request(),result=await s.handler(r);assert.equal(result.status,200);assert.equal(result.body.programs.length,2);
  assert.deepEqual(Object.keys(result.body.programs[0]),['id','name','track','registryReleaseId']);
  assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(s.proofs.length,2);
  assert.notEqual(s.proofs[0].nonce,s.proofs[1].nonce);assert.equal(s.proofs[0].request_sha256,s.proofs[1].request_sha256);
  const canonical=`iiq-owner-v1\nrise\n${r.rawHeaders[3]}\n${r.rawHeaders[5]}\nGET\n${r.url}\n${sha('')}\n${sha(JSON.stringify(ACTOR))}`;
  assert.equal(s.proofs[0].request_sha256,sha(canonical));assert.notEqual(s.proofs[0].request_sha256,sha(''));
  assert.equal(s.admissions[0].expiresAt,new Date(NOW+90000).toISOString());
  assert.doesNotMatch(JSON.stringify(result),/session_verifier|NEVER RETURN|UNVALIDATED|wp_user_id/);
});
test('detail uses canonical encoded id; missing id truthful',async()=>{
  const s=setup();assert.equal((await s.handler(request({path:'/api/rise/v1/interviewiq/programs/acgme%3A001.im'}))).body.id,'acgme:001.im');
  assert.equal((await s.handler(request({path:'/api/rise/v1/interviewiq/programs/unknown'}))).status,404);
});
test('replayed authenticated nonce denied without another proof',async()=>{
  const s=setup(),r=request();assert.equal((await s.handler(r)).status,200);assert.equal((await s.handler(r)).status,503);assert.equal(s.proofs.length,2);
});
for(const [name,edit] of Object.entries({
  'duplicate header':r=>r.rawHeaders.push('x-mmed-iiq-owner','rise'),
  'comma header':r=>r.rawHeaders[1]='rise,rise',
  'array header':r=>r.rawHeaders[1]=['rise'],
  'bad signature':r=>r.rawHeaders[9]='b'.repeat(64),
  'owner mismatch':r=>r.rawHeaders[1]='ivoc',
  'missing header':r=>r.rawHeaders.splice(8,2),
  'bad nonce':r=>r.rawHeaders[5]='not-a-uuid',
  'body bytes':r=>r.body=Buffer.from('x'),
  'missing raw body':r=>delete r.body,
  'wrong method':r=>r.method='POST',
  'base64 padding':r=>r.rawHeaders[7]+='=',
  'origin':r=>r.rawHeaders.push('Origin','https://example.com'),
  'cookie':r=>r.rawHeaders.push('Cookie','synthetic=1'),
  'bearer':r=>r.rawHeaders.push('Authorization','Bearer synthetic'),
  'consumer':r=>r.rawHeaders.push('X-MMED-Consumer','ivoc'),
}))test(`reject ${name} before durable admission`,async()=>{const s=setup(),r=request();edit(r);assert.equal((await s.handler(r)).status,503);assert.equal(s.admissions.length,0);});
for(const path of [PATH+'&q=other',PATH+'&extra=1',PATH.replace('page=1','page=01'),PATH.replace('pageSize=20','pageSize=21'),
  '/api/rise/v1/interviewiq/programs/..','/api/rise/v1/interviewiq/programs/https%3A%2F%2Fbad',
  '/api/rise/v1/interviewiq/programs/acgme%3a001.im','/api/rise/v1/interviewiq/programs/acgme:001.im',
  PATH.replace('q=','q=%00'),PATH.replace('q=','q='+('x'.repeat(257)))]) {
  test(`canonical route rejects ${path.slice(0,100)}`,()=>assert.throws(()=>parseInterviewiqRoute('GET',path)));
}
test('canonical Unicode search accepted',()=>assert.equal(parseInterviewiqRoute('GET',PATH.replace('q=','q=Montr%C3%A9al+%26+IM')).q,'Montréal & IM'));
test('canonical maximum Unicode and star searches accepted',()=>{
  for(const q of ['界'.repeat(256),'*']) {
    const path='/api/rise/v1/interviewiq/programs?'+new URLSearchParams({q,page:'1',pageSize:'20'});
    assert.equal(parseInterviewiqRoute('GET',path).q,q);
  }
});
for(const [name,actor] of Object.entries({mentor:{...ACTOR,auth_role:'mentor',auth_tier:'assigned_mentor'},
  mismatch:{...ACTOR,auth_role:'admin'},unknown:{...ACTOR,extra:1},id:{...ACTOR,subject:'wrong'},wp:{...ACTOR,wp_user_id:'123'},verifier:{...ACTOR,session_verifier:'raw-token'}}))
  test(`invalid actor ${name}`,async()=>{const s=setup();assert.equal((await s.handler(request({actor}))).status,503);assert.equal(s.admissions.length,0);});
test('duplicate escaped JSON authority keys denied',async()=>{
  const raw=JSON.stringify(ACTOR).replace('"wp_user_id":123','"wp_user_id":999,"wp_user_\\u0069d":123');
  const s=setup();assert.equal((await s.handler(request({rawActor:raw}))).status,503);assert.equal(s.admissions.length,0);
  assert.throws(()=>strictFlatJson('{"key":"value", "key":"value"}',['key']));
});
test('stale timestamp denied',async()=>{const s=setup();assert.equal((await s.handler(request({time:NOW/1000-31}))).status,503);});
for(const [key,value] of Object.entries({allowed:false,role:'admin',tier:'none',subject:'22222222-2222-4222-8222-222222222222',
  wp_user_id:456,session_verifier:'b'.repeat(64),request_sha256:'b'.repeat(64),nonce:randomUUID(),audience:'other',iat:NOW/1000+1,exp:NOW/1000+31}))
  test(`signed proof ${key} mismatch denied`,async()=>{const s=setup({mutateProof:p=>({...p,[key]:value})});assert.equal((await s.handler(request())).status,503);});
for(const [role,tier] of [['admin','admin'],['student','ivprep_complete']])test(`current ${role}/${tier} admitted without impersonation`,async()=>{
  const s=setup({mutateProof:p=>({...p,role,tier})});assert.equal((await s.handler(request({actor:{...ACTOR,auth_role:role,auth_tier:tier}}))).status,200);
});
test('revocation during registry read denies response',async()=>{
  const s=setup({mutateProof:(p,n)=>({...p,allowed:n===1})});assert.equal((await s.handler(request())).status,503);assert.equal(s.proofs.length,2);
});
test('source rights lost during read denies response',async()=>{
  let n=0;const s=setup({rights:async()=>({current:++n===1})});assert.equal((await s.handler(request())).status,503);
});
test('source rights revoked during final proof denies response',async()=>{
  let current=true;const s=setup({rights:async()=>({current}),mutateProof:(p,n)=>{if(n===2)current=false;return p;}});
  assert.equal((await s.handler(request())).status,503);assert.equal(s.proofs.length,2);
});
test('slow final source check cannot outlive proof expiry',async()=>{
  let time=NOW,calls=0;const s=setup({rights:async()=>{if(++calls===3)time+=31000;return {current:true};}});
  s.dependencies.now=()=>time;
  assert.equal((await createInterviewiqOwner(CONFIG,s.dependencies)(request())).status,503);
});
test('source rights outage and absent dependency fail closed',async()=>{
  const s=setup({rights:async()=>{throw Error('private rights failure');}});assert.equal((await s.handler(request())).status,503);
  for(const dependency of ['getRegistry','assertSourceRights','consumeNonce']) {
    const d={...setup().dependencies,[dependency]:undefined};assert.equal((await createInterviewiqOwner(CONFIG,d)(request())).status,503);
  }
});
test('default off and reused key fail closed',async()=>{
  for(const config of [{},{...CONFIG,enabled:false},{...CONFIG,proofSecret:SECRET}])assert.equal((await setup({config}).handler(request())).status,503);
});

function coverage({programId,registryReleaseId}){
  const body={programId,registryReleaseId,observedAt:new Date(NOW).toISOString(),fields:DEEP_RESEARCH_DOSSIER_V2.domains.flatMap(d=>d.fields.map(field=>({area:d.key,field,state:'UNKNOWN'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'))};
  return {...body,receipt:{sha256:sha(JSON.stringify(body)),publicRef:'rise-coverage-v1'}};
}
const detail='/api/rise/v1/interviewiq/programs/acgme%3A001.im';
test('coverage is opt-in, detail-only and public-projected after current proof',async()=>{
  const calls=[];const readCoverage=async input=>{calls.push(input);return {...coverage(input),private:'PRIVATE_SENTINEL'};};
  const off=setup({readCoverage});assert.equal((await off.handler(request({path:detail}))).body.researchCoverage,undefined);assert.equal(calls.length,0);
  const on=setup({config:{...CONFIG,coverageEnabled:true},readCoverage});
  assert.equal((await on.handler(request())).status,200);assert.equal(calls.length,0);
  const result=await on.handler(request({path:detail}));assert.equal(result.status,200);assert.equal(result.body.researchCoverage.fields.length,21);
  assert.deepEqual(calls,[{programId:'acgme:001.im',registryReleaseId:'registry-synthetic-v1'}]);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_SENTINEL|session_verifier|wp_user_id/);
  assert.equal((await on.handler(request({path:'/api/rise/v1/interviewiq/programs/missing'}))).status,404);assert.equal(calls.length,1);
});
for(const [label,mutate] of [
  ['program',c=>c.programId='wrong'],['release',c=>c.registryReleaseId='wrong'],['incomplete',c=>c.fields.pop()],
  ['duplicate',c=>c.fields[0]=c.fields[1]],['stale',c=>c.observedAt=new Date(NOW-300001).toISOString()],
  ['private receipt',c=>c.receipt.publicRef='/private/receipt'],['digest',c=>c.receipt.sha256='b'.repeat(64)],
])test(`owner rejects ${label} coverage without fallback`,async()=>{
  const s=setup({config:{...CONFIG,coverageEnabled:true},readCoverage:async input=>{const c=coverage(input);mutate(c);return c;}});
  const result=await s.handler(request({path:detail}));assert.equal(result.status,503);assert.deepEqual(result.body,{error:'interviewiq_owner_unavailable'});
});
test('missing coverage reader and malformed feature flag deny',async()=>{
  for(const coverageEnabled of [true,'true',1]){
    const s=setup({config:{...CONFIG,coverageEnabled}});assert.equal((await s.handler(request({path:detail}))).status,503);
  }
});
test('student or rights revocation during coverage prevents response',async()=>{
  const student=setup({config:{...CONFIG,coverageEnabled:true},readCoverage:async input=>coverage(input),mutateProof:(p,n)=>({...p,allowed:n===1})});
  assert.equal((await student.handler(request({path:detail}))).status,503);
  let current=true;
  const rights=setup({config:{...CONFIG,coverageEnabled:true},rights:async()=>({current}),readCoverage:async input=>{current=false;return coverage(input);}});
  assert.equal((await rights.handler(request({path:detail}))).status,503);
});
for(const [role,tier] of [['admin','admin'],['student','ivprep_complete']])test(`coverage retains ${role}/${tier} current owner context`,async()=>{
  const s=setup({config:{...CONFIG,coverageEnabled:true},readCoverage:async input=>coverage(input),mutateProof:p=>({...p,role,tier})});
  assert.equal((await s.handler(request({path:detail,actor:{...ACTOR,auth_role:role,auth_tier:tier}}))).status,200);
});
test('store failure denies before proof',async()=>{
  const s=setup();s.dependencies.consumeNonce=async()=>{throw Error('store down');};
  assert.equal((await createInterviewiqOwner(CONFIG,s.dependencies)(request())).status,503);assert.equal(s.proofs.length,0);
});
test('duplicate registry identity fails closed',async()=>{
  const s=setup({registry:async()=>({registryReleaseId:'test',programs:[1,2].map(()=>({programSpecialtyId:'same',display:{programName:'Same'}}))})});
  assert.equal((await s.handler(request())).status,503);
});
test('network, redirect, oversized body, unsigned response denied',async()=>{
  for(const fetchOverride of [async()=>{throw Error('private error');},async()=>new Response('{}',{status:302}),
    async()=>new Response('x'.repeat(16385),{headers:{'Content-Type':'application/json'}}),
    async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})]) {
    const result=await setup({fetchOverride}).handler(request());assert.deepEqual(result.body,{error:'interviewiq_owner_unavailable'});assert.equal(result.status,503);
  }
});
test('stalled proof response body is bounded by deadline',async()=>{
  const start=Date.now(),s=setup({fetchOverride:async()=>new Response(new ReadableStream({start(){}}),{headers:{'Content-Type':'application/json'}})});
  assert.equal((await s.handler(request())).status,503);assert.ok(Date.now()-start>=4900);assert.ok(Date.now()-start<7000);
});
test('auth result never serializes private actor or proof material',async()=>{
  const s=setup(),auth=await createInterviewiqAuthenticator(CONFIG,s.dependencies)(request());
  assert.deepEqual(Object.keys(auth),['route','recheck','assertFresh']);assert.doesNotMatch(JSON.stringify(auth),/session_verifier|11111111|wp_user_id/);
});
