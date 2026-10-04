// Synthetic owned socket harness only. No provider target or production cleanup.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {readDisposableConnectionFile,assertDisposableTarget,qualifyDisposableConnection} from '../../scripts/disposable-db-guard.mjs';
import {createDatabase} from '../../server/db.mjs';
import {ensureDemand} from '../../server/research-demand.mjs';
import {createResearchJobStore,researchJobBody,researchJobDigest} from '../../server/research-job-store.mjs';
const c=readDisposableConnectionFile(process.argv[2]);
const admin=new pg.Client({connectionString:c.adminDatabaseUrl});await admin.connect();
await qualifyDisposableConnection(admin,c.adminDatabaseUrl,{role:'iiq_test_admin'});
const database=createDatabase({databaseUrl:c.databaseUrl});
let pool,n=0;const test=async(name,fn)=>{await fn();console.log(`ok ${++n} - ${name}`);};
const a={id:randomUUID(),wpUserId:810001,role:'student',tier:'360',assignments:[],eligible:true};
const b={...a,id:randomUUID(),wpUserId:810002};
const ia=randomUUID(),ib=randomUUID();
const tx=(actor,fn)=>database.withActor(actor,fn,{write:true});
const qa=(sql,p=[])=>tx(a,db=>db.query(sql,p));
const asBinding=d=>({requestId:d.external_request_id,demandId:d.id,interviewId:d.interview_id,ownerId:d.owner_id,programId:d.program_id,registryReleaseId:'registry_A'});
const nonce=()=>({issuer:'rise-research-proof',nonce:randomUUID(),requestHash:'a'.repeat(64),expiresAt:new Date(Date.now()+90000).toISOString()});
let store,demand,binding;
try {
 await test('new proof role is NOLOGIN and no prior role adopted',async()=>{
  const role=(await admin.query("SELECT * FROM pg_roles WHERE rolname='iiq_research_proof'")).rows[0];
  assert.ok(role&&!role.rolcanlogin&&!role.rolinherit&&!role.rolsuper&&!role.rolbypassrls&&!role.rolcreaterole&&!role.rolcreatedb&&!role.rolreplication);
  assert.equal((await admin.query("SELECT * FROM pg_auth_members WHERE roleid='iiq_research_proof'::regrole OR member='iiq_research_proof'::regrole")).rowCount,0);
 });
 await admin.query('CREATE ROLE iiq_proof_test LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION; GRANT iiq_research_proof TO iiq_proof_test WITH INHERIT FALSE, SET TRUE');
 const url=new URL(c.databaseUrl);url.username='iiq_proof_test';
 assertDisposableTarget(url.href,{role:'iiq_proof_test'});
 pool=new pg.Pool({connectionString:url.href,max:4,connectionTimeoutMillis:2000});
 const q=await pool.connect();try{await qualifyDisposableConnection(q,url.href,{role:'iiq_proof_test'});}finally{q.release();}
 await test('unchanged API runtime guard accepts forward schema',()=>database.verifyRuntimeRole());
 await test('dedicated proof store qualifies; API pool cannot substitute',async()=>{
  store=await createResearchJobStore({enabled:true},{pool});
  await assert.rejects(createResearchJobStore({enabled:true},{pool:database.pool}),/research_store_unavailable/);
 });
 for(const [actor,id] of [[a,ia],[b,ib]])await tx(actor,async db=>{
  await db.query('INSERT INTO iiq.actors(id,wp_user_id) VALUES($1,$2)',[actor.id,actor.wpUserId]);
  await db.query('INSERT INTO iiq.interviews(id,owner_id,program_id,joining) VALUES($1,$2,$3,$4)',[id,actor.id,'program_A','PRIVATE_JOIN_CANARY']);
 });
 await test('legacy request creates no grant and retains five-field payload',async()=>{
  demand=await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id}));
  assert.equal((await qa('SELECT * FROM iiq.research_job_grants')).rowCount,0);
  const payload=(await qa('SELECT payload FROM iiq.outbox_events WHERE dedupe_key=$1',[`research:${demand.external_request_id}`])).rows[0].payload;
  assert.equal(Object.keys(payload).length,5);
  assert.equal(await store.getCommittedDemand(asBinding(demand)),null);
 });
 const legacy=demand;
 await test('verified release creates fresh generation and immutable grant atomically',async()=>{
  demand=await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_A'}));binding=asBinding(demand);
  assert.equal(demand.id,legacy.id);assert.notEqual(demand.external_request_id,legacy.external_request_id);
  const row=(await qa('SELECT * FROM iiq.research_job_grants WHERE request_id=$1',[binding.requestId])).rows[0];
  assert.equal(row.request_sha256,researchJobDigest(binding));
  const payload=(await qa('SELECT payload FROM iiq.outbox_events WHERE dedupe_key=$1',[`research:${binding.requestId}`])).rows[0].payload;
  assert.equal(researchJobBody(payload),researchJobBody(binding));
  assert.equal((await qa('SELECT * FROM iiq.outbox_events WHERE dedupe_key=$1',[`research:${legacy.external_request_id}`])).rowCount,1);
 });
 await test('current committed binding returns only minimized canonical identity',async()=>{
  assert.deepEqual(await store.getCommittedDemand(binding),{...binding,requestSha256:researchJobDigest(binding),wpUserId:a.wpUserId,lifecycle:'offered'});
 });
 await test('same pending generation/release coalesces without mutation',async()=>{
  assert.deepEqual(await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_A',refresh:true})),demand);
  assert.equal((await qa('SELECT * FROM iiq.research_job_grants')).rowCount,1);
 });
 await test('student B cannot read or insert student A grants',async()=>{
  assert.equal((await tx(b,db=>db.query('SELECT * FROM iiq.research_job_grants'))).rowCount,0);
  assert.equal((await tx(b,db=>db.query('INSERT INTO iiq.research_job_grants SELECT * FROM iiq.research_job_grants WHERE owner_id=$1',[a.id]))).rowCount,0);
  await assert.rejects(tx(b,db=>db.query(`INSERT INTO iiq.research_job_grants(request_id,owner_id,demand_id,interview_id,program_id,registry_release_id,request_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),a.id,demand.id,ia,'program_A','registry_A','a'.repeat(64)])),e=>e.code==='42501');
 });
 await test('owner cannot forge missing generation or mutate retained grant',async()=>{
  await assert.rejects(qa(`INSERT INTO iiq.research_job_grants(request_id,owner_id,demand_id,interview_id,program_id,registry_release_id,request_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)`,[randomUUID(),a.id,demand.id,ia,'program_A','registry_A','a'.repeat(64)]),e=>e.code==='42501');
  for(const sql of ['UPDATE iiq.research_job_grants SET registry_release_id=registry_release_id','DELETE FROM iiq.research_job_grants','SELECT * FROM iiq.research_proof_nonces'])await assert.rejects(qa(sql),e=>e.code==='42501');
 });
 await test('mismatched owner/program/release and unknown extra binding deny',async()=>{
  for(const change of [{ownerId:b.id},{programId:'program_B'},{registryReleaseId:'registry_B'},{requestId:randomUUID()},{session:'forged'}])assert.equal(await store.getCommittedDemand({...binding,...change}),null);
 });
 await test('proof role cannot read private columns/content, write interviews or execute helpers',async()=>{
  const client=await pool.connect();try{await client.query('SET ROLE iiq_research_proof');
   for(const sql of ['SELECT joining FROM iiq.interviews','SELECT display_name FROM iiq.actors','SELECT * FROM iiq.preparation','SELECT payload FROM iiq.outbox_events','SELECT iiq.actor_id()','UPDATE iiq.interviews SET status=status','DELETE FROM iiq.research_proof_nonces'])await assert.rejects(client.query(sql),e=>e.code==='42501');
   await client.query('RESET ROLE');
  }finally{client.release();}
 });
 await test('cancel/restore changes lifecycle without removing grant/history',async()=>{
  await qa("UPDATE iiq.interviews SET status='cancelled' WHERE id=$1",[ia]);assert.equal((await store.getCommittedDemand(binding)).lifecycle,'cancelled');
  await qa("UPDATE iiq.interviews SET status='offered' WHERE id=$1",[ia]);assert.equal((await store.getCommittedDemand(binding)).lifecycle,'offered');
 });
 await test('rollback rolls back demand generation, grant and outbox together',async()=>{
  await assert.rejects(tx(a,async db=>{await ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_B'});throw Error('synthetic_abort');}),/synthetic_abort/);
  assert.ok(await store.getCommittedDemand(binding));assert.equal((await qa('SELECT * FROM iiq.research_job_grants')).rowCount,1);
 });
 await test('new release replaces current generation but preserves all originals',async()=>{
  const next=await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_B'}));
  assert.equal(next.id,demand.id);assert.notEqual(next.external_request_id,demand.external_request_id);
  assert.equal(await store.getCommittedDemand(binding),null);
  binding={...asBinding(next),registryReleaseId:'registry_B'};
  assert.ok(await store.getCommittedDemand(binding));assert.equal((await qa('SELECT * FROM iiq.research_job_grants')).rowCount,2);
 });
 await test('retargeting interview invalidates stale generation before next demand update',async()=>{
  await qa("UPDATE iiq.interviews SET program_id='program_B' WHERE id=$1",[ia]);assert.equal(await store.getCommittedDemand(binding),null);
  await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_B'}));
  await qa("UPDATE iiq.interviews SET program_id='program_A' WHERE id=$1",[ia]);
  const next=await tx(a,db=>ensureDemand(db,{id:ia,owner_id:a.id},{registryReleaseId:'registry_B'}));
  assert.notEqual(next.external_request_id,binding.requestId);assert.equal(await store.getCommittedDemand(binding),null);
 });
 await test('nonce commit succeeds once; duplicate denies across reconnect',async()=>{
  const value=nonce();assert.equal(await store.consumeNonce(value),true);assert.equal(await store.consumeNonce(value),false);
  const second=await createResearchJobStore({enabled:true},{pool});assert.equal(await second.consumeNonce(value),false);
 });
 await test('concurrent same-nonce attempts commit exactly once',async()=>{
  const value=nonce();assert.equal((await Promise.all(Array.from({length:8},()=>store.consumeNonce(value)))).filter(Boolean).length,1);
 });
 await test('DB clock retains at least ninety seconds despite delayed client expiry',async()=>{
  const value={...nonce(),expiresAt:new Date(Date.now()+60000).toISOString()};assert.equal(await store.consumeNonce(value),true);
  const row=(await admin.query('SELECT extract(epoch FROM expires_at-created_at)::integer AS seconds FROM iiq.research_proof_nonces WHERE nonce=$1',[value.nonce])).rows[0];assert.equal(row.seconds,90);
 });
 await test('invalid, expired and excessively skewed nonce requests have no effect',async()=>{
  for(const change of [{issuer:'other'},{nonce:'invalid'},{requestHash:'x'},{expiresAt:new Date(Date.now()-1).toISOString()},{expiresAt:new Date(Date.now()+300000).toISOString()},{expiresAt:'garbage'},{extra:'bad'}])assert.equal(await store.consumeNonce({...nonce(),...change}),false);
 });
 await test('failed COMMIT never returns success; rollback permits clean retry',async()=>{
  let failCommit=false;const wrapped={connect:async()=>{const client=await pool.connect();return {query:async(sql,p)=>{if(sql.text==='COMMIT'&&failCommit)throw Error('synthetic_commit_failure');return client.query(sql,p);},release:x=>client.release(x)};}};
  const cautious=await createResearchJobStore({enabled:true},{pool:wrapped});const value=nonce();failCommit=true;
  assert.equal(await cautious.consumeNonce(value),false);failCommit=false;assert.equal(await cautious.consumeNonce(value),true);
 });
 await test('API additional proof membership remains rejected by unchanged runtime guard',async()=>{
  await admin.query('GRANT iiq_research_proof TO iiq_runtime_test WITH INHERIT FALSE, SET TRUE');
  try{await assert.rejects(database.verifyRuntimeRole(),e=>e.code==='unsafe_database_role');}finally{await admin.query('REVOKE iiq_research_proof FROM iiq_runtime_test');}
  await database.verifyRuntimeRole();
 });
 await test('proof privilege drift fails closed before consuming any nonce',async()=>{
  await admin.query('GRANT SELECT(joining) ON iiq.interviews TO iiq_research_proof');
  try{await assert.rejects(createResearchJobStore({enabled:true},{pool}),/research_store_unavailable/);assert.equal(await store.consumeNonce(nonce()),false);}finally{await admin.query('REVOKE SELECT(joining) ON iiq.interviews FROM iiq_research_proof');}
 });
 await test('proof login cannot hold grantable ADMIN OPTION membership',async()=>{
  await admin.query('GRANT iiq_research_proof TO iiq_proof_test WITH ADMIN TRUE, INHERIT FALSE, SET TRUE');
  try{await assert.rejects(createResearchJobStore({enabled:true},{pool}),/research_store_unavailable/);assert.equal(await store.consumeNonce(nonce()),false);}finally{await admin.query('GRANT iiq_research_proof TO iiq_proof_test WITH ADMIN FALSE, INHERIT FALSE, SET TRUE');}
  await createResearchJobStore({enabled:true},{pool});
 });
 console.log(`PASS ${n} committed grant/proof PostgreSQL groups; synthetic only.`);
}finally{await database.close();if(pool)await pool.end();await admin.end();}
