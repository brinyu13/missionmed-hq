import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import pg from 'pg';
import {qualifyLocalHarness} from '../tools/migrate-interviewiq-owner.mjs';
import {createCommittedResearchProof} from '../adapters/interviewiq-job-auth.mjs';
import {createInterviewiqResearchAcceptance} from '../adapters/interviewiq-research-store.mjs';
import {createRiseResearchStore,subjectKey} from '../adapters/postgres-runtime.mjs';
import {DEEP_RESEARCH_DOMAIN_KEYS} from '../src/research-router.mjs';

const MIGRATION='20261004085448_iiq_1204_research_job_links.sql';
const HMAC='synthetic-subject-key-only-never-production-12345',PROOF='synthetic-proof-key-only-never-production-67890';
const RELEASE='synthetic-iiq-research-release',INDEX='a'.repeat(64),RIGHTS='b'.repeat(64);
const program=n=>({programSpecialtyId:`test-program-${n}`,designation:'Neurology',display:{state:'TX',programName:`Synthetic Program ${n}`},
  identifiers:[{namespace:'ACGME_PROGRAM',value:String(1854831078+n)}]});
const registry={registryReleaseId:RELEASE,programs:Array.from({length:12},(_,n)=>program(n))};
const config={enabled:true,registryIndex:registry,registrySha256:INDEX,authorizationSha256s:[RIGHTS],subjectHmacKey:HMAC};
async function input({wpUserId=90001,ownerId=randomUUID(),n=0,binding,clock=Date.now}={}) {
  binding??={requestId:randomUUID(),ownerId,demandId:randomUUID(),interviewId:randomUUID(),programId:program(n).programSpecialtyId,registryReleaseId:RELEASE};
  const bodyHash=createHash('sha256').update(JSON.stringify({...binding,kind:'program-gaps'})).digest('hex');
  const proof=await createCommittedResearchProof({enabled:true,proofSecret:PROOF,requestSecret:HMAC},{now:clock,fetchImpl:async(_url,o)=>{
    const r=JSON.parse(o.body),payload=JSON.stringify({...r,allowed:true,reason:'current_committed_demand',wpUserId,role:'student',tier:'360',exp:r.iat+30});
    return new Response(JSON.stringify({payload,signature:createHmac('sha256',PROOF).update(`iiq-job-proof-v1\nresponse\n${payload}`).digest('hex')}),{headers:{'Content-Type':'application/json'}});
  }})({binding,bodyHash,phase:'reserve'});
  return {ownerId:binding.ownerId,requestId:binding.requestId,binding,bodyHash,proof};
}

test('real isolated PostgreSQL preserves accounting, request identity and private links',async t=>{
  for(const name of ['DATABASE_URL','RISE_DATABASE_URL','PGHOST','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','RAILWAY_ENVIRONMENT_ID'])assert.ok(!process.env[name],`Refuse ${name}`);
  const bin='/opt/homebrew/opt/postgresql@18/bin/',directory=fs.mkdtempSync('/tmp/iiq-rise-test-');fs.chmodSync(directory,0o700);
  const socket=directory+'/socket';fs.mkdirSync(socket,{mode:0o700});const marker='iiq-test-'+randomUUID();
  const env={PATH:process.env.PATH,LANG:'C',LC_ALL:'C',PGHOST:socket,PGPORT:'55440',PGUSER:'postgres',PGDATABASE:'iiq_owner_synthetic'};
  const run=(cmd,args)=>execFileSync(bin+cmd,args,{env,stdio:['ignore','pipe','pipe'],timeout:30000});
  let started=false,admin,pool;
  try {
    run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8','-U','postgres']);
    run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-k ${socket} -h '' -p 55440 -c cluster_name=${marker}`,'-w','start']);started=true;
    run('createdb',['iiq_owner_synthetic']);
    const harnessPath=directory+'/harness.json';fs.writeFileSync(harnessPath,JSON.stringify({directory,host:socket,port:55440,database:'iiq_owner_synthetic',user:'postgres',marker,
      pid:Number(fs.readFileSync(directory+'/data/postmaster.pid','utf8').split('\n')[0]),createdAt:Date.now()}),{mode:0o600,flag:'wx'});
    const {connection}=qualifyLocalHarness(harnessPath);admin=new pg.Client(connection);await admin.connect();
    assert.equal((await admin.query('SELECT inet_server_addr() AS address')).rows[0].address,null);
    for(const file of ['005_rights_safe_runtime.sql','007_canonical_evidence_bridge.sql','008_on_demand_research.sql','009_research_provider_provenance.sql',
      '010_full_evidence_promotion.sql','011_provider_benchmark_on_demand_canary.sql','012_deep_research_dossier_v2.sql','013_application_intelligence_preferences.sql','014_six_specialty_research_scope.sql'])
      await admin.query(fs.readFileSync(new URL('../sql/'+file,import.meta.url),'utf8'));
    await admin.query('CREATE ROLE rise_app_login LOGIN; GRANT rise_app_runtime TO rise_app_login');
    await admin.query(`INSERT INTO rise_runtime.registry_releases(release_id,projection,api_index_sha256,index_manifest_sha256,program_count,rights_blocked_field_count,active)
      VALUES($1,'STUDENT_RIGHTS_SAFE_RISE',$2,$2,12,0,true)`,[RELEASE,INDEX]);
    await admin.query(`INSERT INTO rise_runtime.source_authorizations VALUES($1,'TEST',$2,$2,'government_public_domain_factual_projection','SYNTHETIC',current_date+1,NULL)`,[RELEASE,RIGHTS]);
    await admin.query(`UPDATE rise_runtime.research_router_settings SET global_enabled=true,student_enabled=true,emergency_kill_switch=false,
      canary_acgme_ids=$1,default_quota=5,primary_provider='RISE_REPLAY_TEST'`,[registry.programs.map(p=>p.identifiers[0].value)]);
    const sql=fs.readFileSync(new URL('../sql/'+MIGRATION,import.meta.url),'utf8');
    const before=await admin.query('SELECT to_jsonb(r) AS data FROM rise_runtime.registry_releases r');
    await admin.query(sql);
    await t.test('additive migration and repeated application preserve original rows',async()=>{
      assert.deepEqual((await admin.query('SELECT to_jsonb(r) AS data FROM rise_runtime.registry_releases r')).rows,before.rows);
      await assert.rejects(admin.query(sql));await admin.query('ROLLBACK');
      assert.deepEqual((await admin.query('SELECT to_jsonb(r) AS data FROM rise_runtime.registry_releases r')).rows,before.rows);
    });
    pool=new pg.Pool({...connection,user:'rise_app_login',connectionTimeoutMillis:1000,max:6});
    const store=createInterviewiqResearchAcceptance(config,{pool});
    const count=async table=>Number((await admin.query(`SELECT count(*)::int AS count FROM rise_runtime.${table}`)).rows[0].count);
    let first,outcome;
    await t.test('concurrent delivery reserves once and shares the exact existing quota identity',async()=>{
      first=await input();const results=await Promise.all([store.acceptJob(first),store.acceptJob(first)]);assert.deepEqual(results[0],results[1]);outcome=results[0];
      assert.equal(outcome.status,'QUEUED');assert.deepEqual(Object.keys(outcome).sort(),['jobId','status']);
      assert.equal(await count('research_jobs'),1);assert.equal(await count('iiq_research_job_links'),1);
      const generic=await createRiseResearchStore({pool,subjectHmacKey:HMAC});const quota=await generic.readQuota({subject:'wp:90001'});
      assert.equal(quota.reservedCount,1);assert.equal(quota.used,1);
      assert.equal((await admin.query('SELECT subject_key FROM rise_runtime.iiq_research_job_links')).rows[0].subject_key,subjectKey('wp:90001',HMAC));
    });
    await t.test('fresh factory and proof reconcile retained request after restart',async()=>{
      const fresh=await input({binding:first.binding});assert.deepEqual(await createInterviewiqResearchAcceptance(config,{pool}).acceptJob(fresh),outcome);
      assert.equal(await count('research_jobs'),1);assert.equal(await count('iiq_research_job_links'),1);
    });
    await t.test('changed binding or canonical WP account cannot rewrite old accounting',async()=>{
      for(const value of [await input({binding:{...first.binding,programId:program(1).programSpecialtyId}}),await input({binding:first.binding,wpUserId:90002})])
        await assert.rejects(store.acceptJob(value));
      assert.equal(await count('research_jobs'),1);assert.equal(await count('iiq_research_job_links'),1);
    });
    await t.test('second student shares active public program job without receiving requester data or charge',async()=>{
      const second=await input({wpUserId:90002});assert.deepEqual(await store.acceptJob(second),outcome);
      assert.equal(await count('iiq_research_job_links'),2);assert.equal(await count('research_jobs'),1);
      const row=(await admin.query('SELECT requester_subject_key FROM rise_runtime.research_jobs WHERE job_id=$1',[outcome.jobId])).rows[0];
      assert.equal(row.requester_subject_key,subjectKey('wp:90001',HMAC));
    });
    await t.test('private links enforce owner and quota identity even in storage-admin context',async()=>{
      const c=await pool.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('rise.is_admin','true',true),set_config('rise.subject_key',$1,true),set_config('rise.iiq_owner_id',$2,true)",[subjectKey('wp:90002',HMAC),first.ownerId]);
        assert.equal((await c.query('SELECT * FROM rise_runtime.iiq_research_job_links')).rowCount,0);await c.query('ROLLBACK');
        for(const verb of ['DELETE','UPDATE','TRUNCATE'])assert.equal((await c.query("SELECT has_table_privilege(current_user,'rise_runtime.iiq_research_job_links',$1) AS allowed",[verb])).rows[0].allowed,false);
      }finally{c.release();}
    });
    await t.test('replayed completed outcome uses current status with no second reservation',async()=>{
      await admin.query("UPDATE rise_runtime.research_jobs SET status='CANCELLED' WHERE job_id=$1",[outcome.jobId]);
      assert.deepEqual(await store.acceptJob(await input({binding:first.binding})),{jobId:outcome.jobId,status:'CANCELLED'});
      assert.equal(await count('iiq_research_job_links'),2);
    });
    await t.test('fresh complete dossier produces durable NO_OP with no new job or quota',async()=>{
      const matrix=Object.fromEntries(DEEP_RESEARCH_DOMAIN_KEYS.map(k=>[k,{state:'VERIFIED',summary:'Synthetic test evidence',sourceUrls:['https://example.org/test']} ]));
      await admin.query(`UPDATE rise_runtime.research_jobs SET status='COMPLETED',completion_matrix=$2::jsonb,completion_score=1,dossier_outcome='DEEP',research_timestamp=clock_timestamp(),completed_at=clock_timestamp() WHERE job_id=$1`,[outcome.jobId,JSON.stringify(matrix)]);
      const v=await input({wpUserId:90003});assert.deepEqual(await store.acceptJob(v),{jobId:null,status:'NO_OP'});
      assert.deepEqual(await store.acceptJob(await input({wpUserId:90003,binding:v.binding})),{jobId:null,status:'NO_OP'});
      assert.equal(await count('research_jobs'),1);assert.equal(await count('iiq_research_job_links'),3);
    });
    await t.test('pause, provider disable, and unknown entitlement scopes deny new effects',async()=>{
      for(const [change,repair] of [["student_enabled=false","student_enabled=true"],["global_enabled=false","global_enabled=true"],
        ["emergency_kill_switch=true","emergency_kill_switch=false"],["entitlement_scope=ARRAY['unknown']","entitlement_scope=ARRAY['rise:private-beta']"]]) {
        await admin.query('UPDATE rise_runtime.research_router_settings SET '+change);await assert.rejects(store.acceptJob(await input({n:1})));await admin.query('UPDATE rise_runtime.research_router_settings SET '+repair);
      }
      await admin.query("UPDATE rise_runtime.research_provider_routes SET enabled=false WHERE provider_key='RISE_REPLAY_TEST'");await assert.rejects(store.acceptJob(await input({n:1})));
      await admin.query("UPDATE rise_runtime.research_provider_routes SET enabled=true WHERE provider_key='RISE_REPLAY_TEST'");assert.equal(await count('research_jobs'),1);
    });
    await t.test('revoked, expired, inactive or mismatched release rights fail closed',async()=>{
      for(const [change,repair] of [["revoked_at=clock_timestamp()","revoked_at=NULL"],["valid_through=current_date-1","valid_through=current_date+1"]]) {
        await admin.query('UPDATE rise_runtime.source_authorizations SET '+change);await assert.rejects(store.acceptJob(await input({n:1})));await admin.query('UPDATE rise_runtime.source_authorizations SET '+repair);
      }
      await admin.query('UPDATE rise_runtime.registry_releases SET active=false');await assert.rejects(store.acceptJob(await input({n:1})));await admin.query('UPDATE rise_runtime.registry_releases SET active=true');
      await assert.rejects(createInterviewiqResearchAcceptance({...config,registrySha256:'c'.repeat(64)},{pool}).acceptJob(await input({n:1})));
      assert.equal(await count('research_jobs'),1);
    });
    await t.test('link insertion failure rolls back new job and quota atomically',async()=>{
      const snap=await count('research_jobs');const failingPool={async connect(){const c=await pool.connect();return {query:options=>{
        if(options.text?.includes('INSERT INTO rise_runtime.iiq_research_job_links'))throw Error('synthetic injected failure');return c.query(options);
      },release:bad=>c.release(bad)};}};
      await assert.rejects(createInterviewiqResearchAcceptance(config,{pool:failingPool}).acceptJob(await input({n:2,wpUserId:90004})));
      assert.equal(await count('research_jobs'),snap);assert.equal((await admin.query('SELECT * FROM rise_runtime.research_quota_ledgers WHERE subject_key=$1',[subjectKey('wp:90004',HMAC)])).rowCount,0);
    });
    await t.test('expired and cloned grants fail without adding data',async()=>{
      const tick=Date.now();let clock=tick;const v=await input({n:2,clock:()=>clock});clock=tick+31000;
      await assert.rejects(store.acceptJob(v));await assert.rejects(store.acceptJob({...first,proof:{...first.proof}}));assert.equal(await count('research_jobs'),1);
    });
    await t.test('rights fence holds release and revocation locks until transaction ends',async()=>{
      const c=await pool.connect();try{await c.query('BEGIN');assert.equal((await c.query('SELECT rise_runtime.iiq_lock_research_rights($1,$2,$3) AS current',[RELEASE,INDEX,[RIGHTS]])).rows[0].current,true);
        await admin.query("SET lock_timeout='100ms'");await assert.rejects(admin.query('UPDATE rise_runtime.source_authorizations SET revoked_at=clock_timestamp()'));await c.query('ROLLBACK');await admin.query("SET lock_timeout='0'");
      }finally{c.release();}
    });
    await t.test('function owner, body, permissions and private ledger are explicit',async()=>{
      const p=(await admin.query("SELECT p.proowner::regrole::text AS owner,prosecdef,provolatile,proconfig,prosrc FROM pg_proc p WHERE oid='rise_runtime.iiq_lock_research_rights(text,text,text[])'::regprocedure")).rows[0];
      assert.equal(p.owner,'postgres');assert.equal(p.prosecdef,true);assert.equal(p.provolatile,'v');assert.deepEqual(p.proconfig,['search_path=pg_catalog']);
      assert.equal(p.prosrc,sql.split('AS $rights$')[1].split('$rights$')[0]);
      assert.equal((await pool.query("SELECT has_table_privilege(current_user,'rise_runtime.iiq_research_link_migrations','SELECT,INSERT,UPDATE,DELETE') AS allowed")).rows[0].allowed,false);
    });
    await t.test('paid-path reservation uses existing budget and quota without calling a provider',async()=>{
      const provider=(await admin.query("SELECT provider_key FROM rise_runtime.research_provider_routes WHERE provider_key LIKE 'OPENAI_TERRA%' LIMIT 1")).rows[0]?.provider_key;
      assert.ok(provider);
      await admin.query(`UPDATE rise_runtime.research_provider_routes SET enabled=true,state='PRODUCTION_APPROVED',network_allowed=true,spend_allowed=true,
        budget_cap_usd=6,configuration=configuration||'{"reservationUsd":1}'::jsonb WHERE provider_key=$1`,[provider]);
      await admin.query('UPDATE rise_runtime.research_router_settings SET primary_provider=$1,budget_cap_usd=6',[provider]);
      const v=await input({n:3,wpUserId:90005});const paid=await store.acceptJob(v);
      assert.equal(paid.status,'QUEUED');const snap=(await admin.query('SELECT * FROM rise_runtime.research_spend_ledger WHERE job_id=$1',[paid.jobId])).rows;
      assert.equal(snap.length,1);assert.equal(snap[0].event_type,'RESERVE');assert.ok(Number(snap[0].amount_usd)>0);
      assert.deepEqual(await store.acceptJob(await input({n:3,wpUserId:90005,binding:v.binding})),paid);
      assert.deepEqual((await admin.query('SELECT * FROM rise_runtime.research_spend_ledger WHERE job_id=$1',[paid.jobId])).rows,snap);
      const jobs=await count('research_jobs');await admin.query('UPDATE rise_runtime.research_router_settings SET budget_cap_usd=reserved_spend_usd');
      await assert.rejects(store.acceptJob(await input({n:4,wpUserId:90006})));assert.equal(await count('research_jobs'),jobs);
      assert.equal((await admin.query('SELECT * FROM rise_runtime.research_quota_ledgers WHERE subject_key=$1',[subjectKey('wp:90006',HMAC)])).rowCount,0);
      await admin.query("UPDATE rise_runtime.research_router_settings SET primary_provider='RISE_REPLAY_TEST',budget_cap_usd=6");
    });
    await t.test('uncertain commit retry reads durable linkage instead of charging again',async()=>{
      let once=true;const ambiguous={async connect(){const c=await pool.connect();return {async query(options){const r=await c.query(options);
        if(options.text==='COMMIT'&&once){once=false;throw Error('synthetic lost commit response');}return r;},release:bad=>c.release(bad)};}};
      const v=await input({n:5,wpUserId:90007}),before=await count('research_jobs');
      await assert.rejects(createInterviewiqResearchAcceptance(config,{pool:ambiguous}).acceptJob(v));assert.equal(await count('research_jobs'),before+1);
      const answer=await store.acceptJob(await input({wpUserId:90007,binding:v.binding}));assert.equal(answer.status,'QUEUED');assert.equal(await count('research_jobs'),before+1);
    });
    await t.test('proof revoked by expiry during SQL rolls back before any commit',async()=>{
      let clock=Date.now();const v=await input({n:6,wpUserId:90008,clock:()=>clock});const before=await count('research_jobs');
      const delayed={async connect(){const c=await pool.connect();return {async query(options){const r=await c.query(options);
        if(options.text?.includes('INSERT INTO rise_runtime.iiq_research_job_links'))clock+=31000;return r;},release:bad=>c.release(bad)};}};
      await assert.rejects(createInterviewiqResearchAcceptance(config,{pool:delayed}).acceptJob(v));assert.equal(await count('research_jobs'),before);
    });
    await t.test('late pool acquisition is discarded and cannot issue a query',async()=>{
      let resolve,queries=0,discarded=false;const waiting=new Promise(r=>resolve=r),delayed={connect:()=>waiting},v=await input({n:7});
      const start=performance.now();await assert.rejects(createInterviewiqResearchAcceptance(config,{pool:delayed}).acceptJob(v));
      assert.ok(performance.now()-start<6500);resolve({query(){queries++;},release(bad){discarded=bad;}});
      await new Promise(r=>setImmediate(r));assert.equal(queries,0);assert.equal(discarded,true);
    });
    await t.test('runtime refuses policy, ACL and definer configuration drift',async()=>{
      const v=await input({n:8}),before=await count('research_jobs');
      await admin.query("ALTER POLICY iiq_research_link_read ON rise_runtime.iiq_research_job_links USING (true)");
      await assert.rejects(store.acceptJob(v));
      await admin.query("ALTER POLICY iiq_research_link_read ON rise_runtime.iiq_research_job_links USING (subject_key=current_setting('rise.subject_key',true) AND owner_id::text=current_setting('rise.iiq_owner_id',true))");
      await admin.query('GRANT SELECT ON rise_runtime.iiq_research_job_links TO PUBLIC');await assert.rejects(store.acceptJob(v));
      await admin.query('REVOKE SELECT ON rise_runtime.iiq_research_job_links FROM PUBLIC');
      await admin.query("ALTER FUNCTION rise_runtime.iiq_lock_research_rights(text,text,text[]) SET search_path=public");await assert.rejects(store.acceptJob(v));
      await admin.query("ALTER FUNCTION rise_runtime.iiq_lock_research_rights(text,text,text[]) SET search_path=pg_catalog");
      assert.equal(await count('research_jobs'),before);
      assert.equal((await store.acceptJob(await input({n:8}))).status,'QUEUED');
    });
    await t.test('caller mutation during an await cannot alter the signed persisted binding',async()=>{
      const v=await input({n:9,wpUserId:90009});v.binding={...v.binding};
      const mutating={async connect(){const c=await pool.connect();return {query(options){v.binding.programId=program(10).programSpecialtyId;return c.query(options);},release:bad=>c.release(bad)};}};
      await createInterviewiqResearchAcceptance(config,{pool:mutating}).acceptJob(v);
      const row=(await admin.query('SELECT program_id FROM rise_runtime.iiq_research_job_links WHERE owner_id=$1 AND request_id=$2',[v.ownerId,v.requestId])).rows[0];
      assert.equal(row.program_id,program(9).programSpecialtyId);
    });
    await t.test('unexpected insertion rule is rejected before any linked effect',async()=>{
      await admin.query('CREATE RULE synthetic_extra_effect AS ON INSERT TO rise_runtime.iiq_research_job_links DO ALSO NOTIFY synthetic_effect');
      await assert.rejects(store.acceptJob(await input({n:10})));await admin.query('DROP RULE synthetic_extra_effect ON rise_runtime.iiq_research_job_links');
    });
    await t.test('column-only mutation grant cannot evade immutable-history qualification',async()=>{
      await admin.query('GRANT UPDATE(request_sha256) ON rise_runtime.iiq_research_job_links TO rise_app_runtime');
      assert.equal((await pool.query("SELECT has_table_privilege(current_user,'rise_runtime.iiq_research_job_links','UPDATE') AS allowed")).rows[0].allowed,false);
      await assert.rejects(store.acceptJob(await input({n:10}))); // No restoration needed: this isolated cluster is stopped below.
    });
  }finally{if(pool)await pool.end();if(admin)await admin.end();if(started)run('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop']);t.diagnostic(JSON.stringify({localCluster:directory,stopped:started}));}
});
