import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createResearchJobStore,researchJobBody,researchJobDigest} from '../../server/research-job-store.mjs';
const binding={requestId:randomUUID(),demandId:randomUUID(),interviewId:randomUUID(),ownerId:randomUUID(),programId:'acgme-1400000001',registryReleaseId:'registry_2026'};
test('dispatch reconstructs frozen wire order regardless of jsonb object order',()=>{
 const reversed=Object.fromEntries(Object.entries(binding).reverse());
 const body=researchJobBody(reversed);
 assert.equal(body,JSON.stringify({...binding,kind:'program-gaps'}));
 assert.equal(researchJobDigest(reversed),createHash('sha256').update(body).digest('hex'));
 assert.notEqual(researchJobDigest(binding),researchJobDigest({...binding,registryReleaseId:'registry_2027'}));
});
for(const key of Object.keys(binding))for(const bad of [null,'',1,'<script>','a'.repeat(181)])
 test(`invalid ${key} ${String(bad).slice(0,10)} cannot serialize authority`,()=>assert.throws(()=>researchJobBody({...binding,[key]:bad}),/research_store_unavailable/));
for(const ending of ['\n','\r','\u2028','\u2029'])test(`terminal line break ${JSON.stringify(ending)} cannot alter any binding`,()=>{
 for(const key of Object.keys(binding))assert.throws(()=>researchJobBody({...binding,[key]:binding[key]+ending}),/research_store_unavailable/);
});
test('default disabled store does not touch any pool',async()=>{
 const store=await createResearchJobStore({}, {pool:{connect(){throw Error('must not connect');}}});
 assert.equal(await store.getCommittedDemand(binding),null);assert.equal(await store.consumeNonce({}),false);
});
test('enabled store requires dedicated pool',()=>assert.rejects(createResearchJobStore({enabled:true}),/research_store_unavailable/));
test('unqualified role rejects with sanitized error and rolls back',async()=>{
 const calls=[];
 await assert.rejects(createResearchJobStore({enabled:true},{pool:{connect:async()=>({
  query:async sql=>{calls.push(sql.text);return {rows:[]};},release:broken=>calls.push(['release',broken])
 })}}),/research_store_unavailable/);
 assert.ok(calls.includes('ROLLBACK'));assert.deepEqual(calls.at(-1),['release',false]);
 assert.ok(!calls.includes('SET LOCAL ROLE iiq_research_proof'));
});
test('failed rollback discards connection and never leaks DB details',async()=>{
 const released=[];
 await assert.rejects(createResearchJobStore({enabled:true},{pool:{connect:async()=>({
  query:async()=>{throw Error('PRIVATE_CONNECTION_DETAIL');},release:broken=>released.push(broken)
 })}}),e=>e.message==='research_store_unavailable');
 assert.deepEqual(released,[true]);
});

// Catalog doubles exercise qualification denials; actual PostgreSQL tests prove
// these privileges, RLS, role transitions and transaction behavior separately.
function catalogPool(change=()=>{}) {
 const allowed={actors:['id','wp_user_id'],interviews:['id','owner_id','program_id','status'],
  research_demands:['id','owner_id','interview_id','program_id','external_request_id'],
  research_job_grants:['request_id','owner_id','demand_id','interview_id','program_id','registry_release_id','request_sha256'],
  research_proof_nonces:['issuer','nonce','request_sha256','created_at','expires_at']};
 const columns=Object.entries(allowed).flatMap(([table,names])=>names.map(column=>({table_name:table,column_name:column,
  owner:'iiq_owner',kind:'r',rls:true,forced:true,persistence:'p',mutable:false,direct:false,
  readable:table!=='research_proof_nonces'||column==='nonce',insertable:table==='research_proof_nonces'})));
 change(columns);
 const safe={rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false};
 return {connect:async()=>({query:async request=>{
  const sql=request.text;
  if(sql.includes('FROM pg_roles'))return {rows:[{...safe,name:'proof_login',login:true,rolcanlogin:true,member:true,can_set:true,proof_member:false},
    {...safe,name:'iiq_research_proof',login:false,rolcanlogin:false,member:true,can_set:true,proof_member:true}]};
  if(sql.includes('FROM pg_auth_members'))return {rows:[{role:'iiq_research_proof',member:'proof_login',admin_option:false,inherit_option:false,set_option:true}]};
  if(sql.includes("FROM pg_namespace WHERE nspname='iiq'"))return {rows:[{owned:true,usable:true,writable:false,public:false}]};
  if(sql.includes('AS column_name'))return {rows:columns};
  if(sql.includes('FROM pg_proc'))return {rows:[{safe:true}]};
  return {rows:[]};
 },release(){}})};
}
test('positive catalog accepts exact permanent forced-RLS tables',()=>createResearchJobStore({enabled:true},{pool:catalogPool()}));
for(const name of ['actors','interviews','research_demands','research_job_grants','research_proof_nonces'])
 for(const kind of ['v','m','f','p'])test(`${name} cannot substitute relation kind ${kind}`,()=>assert.rejects(
  createResearchJobStore({enabled:true},{pool:catalogPool(rows=>rows.filter(r=>r.table_name===name).forEach(r=>{r.kind=kind;r.rls=false;r.forced=false;}))}),/research_store_unavailable/));
test('missing nonce insert-only column fails qualification',()=>assert.rejects(createResearchJobStore({enabled:true},{pool:catalogPool(rows=>{
 rows.splice(rows.findIndex(r=>r.table_name==='research_proof_nonces'&&r.column_name==='expires_at'),1);
})}),/research_store_unavailable/));
test('late pool acquisition is disposed without running any SQL',async()=>{
 let resolve;const sql=[],released=[];const pending=new Promise(r=>{resolve=r;});
 await assert.rejects(createResearchJobStore({enabled:true},{pool:{connect:()=>pending}}),/research_store_unavailable/);
 resolve({query:q=>sql.push(q),release:flag=>released.push(flag)});
 await new Promise(r=>setImmediate(r));assert.deepEqual(sql,[]);assert.deepEqual(released,[true]);
});
test('unresolved query reaches whole transaction deadline; no queued rollback or commit',async()=>{
 const calls=[],released=[];const started=performance.now();
 await assert.rejects(createResearchJobStore({enabled:true},{pool:{connect:async()=>({
  query:request=>{calls.push(request);return new Promise(()=>{});},release:flag=>released.push(flag)
 })}}),/research_store_unavailable/);
 assert.ok(performance.now()-started<6500);assert.deepEqual(calls.map(q=>q.text),['BEGIN']);
 assert.ok(calls[0].query_timeout>0&&calls[0].query_timeout<=5000);assert.deepEqual(released,[true]);
});
