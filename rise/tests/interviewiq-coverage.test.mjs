import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createInterviewiqCoverageReader,projectInterviewiqCoverage} from '../adapters/interviewiq-coverage.mjs';
import {qualifyLocalHarness} from '../tools/migrate-interviewiq-owner.mjs';
import {DEEP_RESEARCH_DOSSIER_V2} from '../src/research-router.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const programId='synthetic:program',registryReleaseId='synthetic-registry';
function fixtureCoverage(){
  const body={programId,registryReleaseId,observedAt:new Date().toISOString(),fields:DEEP_RESEARCH_DOSSIER_V2.domains.flatMap(d=>d.fields.map(field=>({area:d.key,field,state:'UNKNOWN'}))).sort((a,b)=>a.field.localeCompare(b.field,'en'))};
  return {...body,receipt:{sha256:sha(JSON.stringify(body)),publicRef:'rise-coverage-v1'}};
}
test('projection excludes arbitrary reader metadata and validates exact complete current binding',()=>{
  const c=fixtureCoverage(),context={programId,registryReleaseId};
  assert.deepEqual(projectInterviewiqCoverage({...c,private:'DO_NOT_EXPORT',fields:c.fields.map(x=>({...x,private:'DO_NOT_EXPORT'}))},context),c);
  for(const change of [x=>x.programId='other',x=>x.registryReleaseId='other',x=>x.fields.pop(),x=>x.fields[0]=x.fields[1],
    x=>x.fields[0].state='PENDING',x=>x.fields[0].area=['identity_structure'],x=>x.observedAt=new Date(Date.now()-300001).toISOString(),
    x=>x.observedAt=new Date(Date.now()+60000).toISOString(),x=>x.receipt.sha256='a'.repeat(64),x=>x.receipt.publicRef='/private/path']){
    const x=structuredClone(c);change(x);assert.throws(()=>projectInterviewiqCoverage(x,context),/interviewiq_coverage_unavailable/);
  }
});
test('default off or invalid pool cannot acquire a connection',async()=>{
  let calls=0;const pool={connect(){calls++;throw Error('DO_NOT_EXPORT');},options:{connectionTimeoutMillis:5000}};
  for(const config of [{},{pool},{enabled:'true',pool},{enabled:true,pool:{...pool,options:{}}}])
    await assert.rejects(createInterviewiqCoverageReader(config)({programId,registryReleaseId}),/interviewiq_coverage_unavailable/);
  assert.equal(calls,0);
});
test('late acquisition and never-settling query/rollback are bounded and discarded',async()=>{
  const releases=[];let resolveConnect;
  const late=createInterviewiqCoverageReader({enabled:true,pool:{options:{connectionTimeoutMillis:5000},connect:()=>new Promise(r=>{resolveConnect=r;})}});
  await assert.rejects(late({programId,registryReleaseId}),/interviewiq_coverage_unavailable/);
  resolveConnect({release:x=>releases.push(x)});await new Promise(r=>setImmediate(r));assert.deepEqual(releases,[true]);
  let n=0;const client={query:()=>++n===1?Promise.resolve({}):n===2?Promise.reject(Error('PRIVATE_SENTINEL')):new Promise(()=>{}),release:x=>releases.push(x)};
  const read=createInterviewiqCoverageReader({enabled:true,pool:{options:{connectionTimeoutMillis:5000},connect:async()=>client}});
  const start=Date.now();await assert.rejects(read({programId,registryReleaseId}),{message:'interviewiq_coverage_unavailable'});
  assert.ok(Date.now()-start<6500);assert.deepEqual(releases,[true,true]);
});

test('guarded PostgreSQL18 canonical coverage preserves rows and current review boundaries',async t=>{
  for(const key of ['DATABASE_URL','RISE_DATABASE_URL','PGHOST','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','RAILWAY_ENVIRONMENT_ID'])assert.equal(Boolean(process.env[key]),false,key);
  const bin='/opt/homebrew/opt/postgresql@18/bin/',directory=fs.mkdtempSync('/tmp/iiq-rise-test-');fs.chmodSync(directory,0o700);
  const socket=directory+'/socket';fs.mkdirSync(socket,{mode:0o700});const marker='iiq-test-'+randomUUID();
  const env={PATH:process.env.PATH,LANG:'C',LC_ALL:'C',PGHOST:socket,PGPORT:'55440',PGUSER:'postgres',PGDATABASE:'iiq_owner_synthetic'};
  const run=(name,args)=>execFileSync(bin+name,args,{env,stdio:['ignore','pipe','pipe'],timeout:30000});
  let started=false,admin,pool;
  try{
    assert.match(run('postgres',['--version']).toString(),/18\./);
    run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8','-U','postgres']);started=true;
    run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-k ${socket} -h '' -p 55440 -c cluster_name=${marker}`,'-w','start']);
    run('createdb',['iiq_owner_synthetic']);const pid=Number(fs.readFileSync(directory+'/data/postmaster.pid','utf8').split('\n')[0]);process.kill(pid,0);
    const manifest=directory+'/harness.json';fs.writeFileSync(manifest,JSON.stringify({directory,host:socket,port:55440,database:'iiq_owner_synthetic',user:'postgres',marker,pid,createdAt:Date.now()}),{mode:0o600,flag:'wx'});
    admin=new pg.Client(qualifyLocalHarness(manifest).connection);await admin.connect();
    await admin.query(`CREATE ROLE rise_app_runtime NOLOGIN; CREATE ROLE rise_app_login LOGIN; GRANT rise_app_runtime TO rise_app_login;
      CREATE SCHEMA rise_runtime AUTHORIZATION postgres; GRANT USAGE ON SCHEMA rise_runtime TO rise_app_runtime;
      CREATE TABLE rise_runtime.registry_releases(release_id text PRIMARY KEY);`);
    for(const name of ['007_canonical_evidence_bridge.sql','010_full_evidence_promotion.sql'])await admin.query(fs.readFileSync(new URL('../sql/'+name,import.meta.url),'utf8'));
    pool=new pg.Pool({host:socket,port:55440,database:'iiq_owner_synthetic',user:'rise_app_login',connectionTimeoutMillis:5000,max:1});
    const read=createInterviewiqCoverageReader({enabled:true,pool});const get=async id=>read({programId:id??programId,registryReleaseId});
    const state=async field=>(await get()).fields.find(x=>x.field===field).state;
    const date=days=>new Date(Date.now()-days*86400000).toISOString();let serial=0;
    async function source({provider='PARALLEL',url='https://residency.hospital.edu/evidence',days=0,exposure='PRIVATE_BETA',rights='APPROVED',type='public_primary'}={}){
      const id='s'+(++serial);await admin.query(`INSERT INTO rise_runtime.canonical_evidence_sources(source_id,provider,provider_run_id,source_type,source_url,retrieved_at,rights_state,exposure_state,metadata)
        VALUES($1,$2,$1,$3,$4,$5,$6,$7,'{"private":"PRIVATE_SENTINEL"}')`,[id,provider,type,url,date(days),rights,exposure]);return id;
    }
    async function claim(field,{subject=programId,days=0,known=true,review='APPROVED',publication='PRIVATE_BETA',conflict='NONE',sourceId,claimId,retrievedAt,createdAt}={}){
      sourceId??=await source({days});const id=claimId??'c'+(++serial);
      await admin.query(`INSERT INTO rise_runtime.canonical_evidence_claims(claim_id,subject_id,field,knowledge,canonical_value,assertion_class,publication_state,review_state,conflict_state,source_id,retrieved_at,content_sha256,created_at)
        VALUES($1,$2,$3,$4::jsonb,'{"private":"PRIVATE_SENTINEL"}','source_attributed',$5,$6,$7,$8,$9,$10,$11)`,
      [id,subject,field,JSON.stringify({state:known?'known':'unknown',value:'PRIVATE_SENTINEL'}),publication,review,conflict,sourceId,retrievedAt??date(days),sha(id),createdAt??date(0)]);return id;
    }
    async function review(claimId,{disposition='APPROVED_CURRENT',urls=['https://residency.hospital.edu/evidence'],time=Date.now()}={}){
      const id='r'+(++serial);await admin.query(`INSERT INTO rise_runtime.evidence_claim_review_events(review_id,source_claim_id,disposition,reason_code,rule_version,normalized_value,source_urls,quality_score,actor_subject_key,decision_sha256,created_at)
        VALUES($1,$2,$3,'synthetic','v1','{"private":"PRIVATE_SENTINEL"}',$4::jsonb,10,$5,$6,$7)`,[id,claimId,disposition,JSON.stringify(urls),'a'.repeat(64),sha(id),new Date(time).toISOString()]);return id;
    }
    async function promotion(field,{originalField=field,subject=programId,originalDays=0}={}){
      const original=await claim(originalField,{subject,days:originalDays,review:'PENDING',publication:'INTERNAL_ONLY'}),reviewId=await review(original);
      const sourceId=await source({provider:'MISSIONMED_REVIEW',url:null,type:'canonical_review_promotion'}),promoted=await claim(field,{sourceId});
      await admin.query('INSERT INTO rise_runtime.canonical_claim_promotion_lineage(promoted_claim_id,source_claim_id,review_id,contributor_order) VALUES($1,$2,$3,0)',[promoted,original,reviewId]);return original;
    }
    await t.test('empty canonical database returns21explicitUNKNOWN without private values',async()=>{
      const c=await get();assert.equal(c.fields.length,21);assert.ok(c.fields.every(f=>f.state==='UNKNOWN'));assert.doesNotMatch(JSON.stringify(c),/PRIVATE_SENTINEL|claim_id|source_url|actor|subject/);
    });
    await t.test('approved current direct evidence isSUPPORTED and original retrieval controlsSTALE',async()=>{
      await claim('research.visa');assert.equal(await state('research.visa'),'SUPPORTED');
      await claim('research.curriculum',{sourceId:await source({days:121})});assert.equal(await state('research.curriculum'),'STALE');
      await claim('research.abim',{sourceId:await source({url:'https://router.home.arpa/private'})});assert.equal(await state('research.abim'),'WEAK');
      await claim('research.core_faculty',{sourceId:await source({days:-1})});assert.equal(await state('research.core_faculty'),'WEAK');
    });
    await t.test('pending/private/student-intel and different subjects cannot influence output',async()=>{
      await claim('research.outcomes',{publication:'INTERNAL_ONLY',review:'PENDING'});
      await claim('research.outcomes',{sourceId:await source({provider:'STUDENT_INTEL'})});
      await claim('research.outcomes',{subject:'other'});assert.equal(await state('research.outcomes'),'UNKNOWN');
      assert.ok((await get('other-unrelated')).fields.every(x=>x.state==='UNKNOWN'));
    });
    await t.test('explicit newer public conflict survives existing current fact',async()=>{
      const conflict=await claim('research.visa',{conflict:'CONFLICTING'});assert.equal(await state('research.visa'),'CONFLICTED');
      await review(conflict,{disposition:'SUPERSEDED'});assert.equal(await state('research.visa'),'SUPPORTED');
      await review(conflict,{disposition:'CONFLICT_REQUIRES_REVIEW'});assert.equal(await state('research.visa'),'CONFLICTED');
      await review(conflict,{disposition:'APPROVED_CURRENT'});assert.equal(await state('research.visa'),'SUPPORTED');
    });
    await t.test('promotion resolves approved provenance and retains underlying age',async()=>{
      await promotion('research.program_overview');assert.equal(await state('research.program_overview'),'SUPPORTED');
      await promotion('research.salary_benefits',{originalDays:121});assert.equal(await state('research.salary_benefits'),'STALE');
    });
    await t.test('latest review overrides older approval without fallback',async()=>{
      const a=await promotion('research.research_opportunities');assert.equal(await state('research.research_opportunities'),'SUPPORTED');
      await review(a,{disposition:'CONFLICT_REQUIRES_REVIEW'});assert.equal(await state('research.research_opportunities'),'CONFLICTED');
      const b=await promotion('research.leadership');await review(b,{disposition:'STALE_NEEDS_REFRESH'});assert.equal(await state('research.leadership'),'STALE');
      const c=await promotion('research.culture');await review(c,{disposition:'SUPERSEDED'});assert.equal(await state('research.culture'),'WEAK');
    });
    await t.test('latest review also governs direct published claims',async()=>{
      const c=await claim('research.do_accessibility');assert.equal(await state('research.do_accessibility'),'SUPPORTED');
      await review(c,{disposition:'SUPERSEDED'});assert.equal(await state('research.do_accessibility'),'WEAK');
      await review(c,{disposition:'STALE_NEEDS_REFRESH'});assert.equal(await state('research.do_accessibility'),'STALE');
      await review(c,{disposition:'CONFLICT_REQUIRES_REVIEW'});assert.equal(await state('research.do_accessibility'),'CONFLICTED');
    });
    await t.test('tied claim timestamps follow canonical view claim-ID ascending order',async()=>{
      const time=date(1),sourceId=await source({days:1});
      for(const [claimId,known] of [['tie-a',true],['tie-z',false]])await claim('research.img_accessibility',{claimId,known,sourceId,retrievedAt:time,createdAt:time});
      const {rows:[canonical]}=await admin.query("SELECT claim_id,knowledge->>'state' AS state FROM rise_runtime.canonical_current_facts WHERE subject_id=$1 AND field='research.img_accessibility'",[programId]);
      assert.deepEqual(canonical,{claim_id:'tie-a',state:'known'});assert.equal(await state('research.img_accessibility'),'SUPPORTED');
    });
    await t.test('cross-field and cross-subject lineage never supports evidence',async()=>{
      await promotion('research.fellowship_inventory',{originalField:'research.visa'});assert.equal(await state('research.fellowship_inventory'),'WEAK');
      await promotion('research.resident_roster',{subject:'private-other'});assert.equal(await state('research.resident_roster'),'WEAK');
    });
    await t.test('nested promotion cannot refresh an old original through intermediate timestamps',async()=>{
      const field='research.resident_medical_schools';await promotion(field,{originalDays:121});assert.equal(await state(field),'STALE');
      const {rows:[parent]}=await admin.query('SELECT claim_id FROM rise_runtime.canonical_current_facts WHERE subject_id=$1 AND field=$2',[programId,field]);
      const reviewId=await review(parent.claim_id),sourceId=await source({provider:'MISSIONMED_REVIEW',type:'canonical_review_promotion',url:null});
      const promoted=await claim(field,{sourceId});
      await admin.query('INSERT INTO rise_runtime.canonical_claim_promotion_lineage(promoted_claim_id,source_claim_id,review_id,contributor_order) VALUES($1,$2,$3,0)',[promoted,parent.claim_id,reviewId]);
      assert.equal(await state(field),'WEAK');
    });
    await t.test('exact canonical identity alias accepted; name-only and unresolved alias ignored',async()=>{
      const s=await source();await admin.query(`INSERT INTO rise_runtime.canonical_program_identities(program_identity_id,acgme_id,program_specialty_id,program_name,institution,state,specialty,reconciliation_status,exposure_state,source_id,content_sha256)
        VALUES('alias','1234567890',$1,'Same name','Synthetic','NY','IM','EXACT_ACGME_MATCH','PRIVATE_BETA',$2,$3)`,[programId,s,sha('identity')]);
      await claim('research.application_requirements',{subject:'alias'});assert.equal(await state('research.application_requirements'),'SUPPORTED');
      await admin.query(`INSERT INTO rise_runtime.canonical_program_identities(program_identity_id,acgme_id,program_specialty_id,program_name,institution,state,specialty,reconciliation_status,exposure_state,source_id,content_sha256)
        VALUES('unresolved-alias','1234567891','unresolved-program','Same name','Synthetic','NY','IM','REVIEW_REQUIRED','INTERNAL_ONLY',$1,$2)`,[s,sha('unresolved')]);
      await claim('research.application_requirements',{subject:'unresolved-alias'});
      assert.ok((await get('unresolved-program')).fields.every(x=>x.state==='UNKNOWN'));
    });
    await t.test('read-only transaction rejects mutation and all protected rows remain identical',async()=>{
      const before=(await admin.query("SELECT md5(string_agg(row_to_json(c)::text,',' ORDER BY claim_id)) AS h FROM rise_runtime.canonical_evidence_claims c")).rows;
      let sawReadOnly=false;const wrapped={options:pool.options,async connect(){const c=await pool.connect();return {release:x=>c.release(x),async query(q){
        if(q.text.startsWith('WITH subjects')){
          const check=await c.query('SHOW transaction_read_only');sawReadOnly=check.rows[0].transaction_read_only==='on';
          await c.query('SAVEPOINT readonly_probe');
          await assert.rejects(c.query('INSERT INTO rise_runtime.canonical_evidence_claims DEFAULT VALUES'),{code:'25006'});
          await c.query('ROLLBACK TO SAVEPOINT readonly_probe');
        }
        return c.query(q);
      }};}};
      await createInterviewiqCoverageReader({enabled:true,pool:wrapped})({programId,registryReleaseId});assert.equal(sawReadOnly,true);
      assert.deepEqual((await admin.query("SELECT md5(string_agg(row_to_json(c)::text,',' ORDER BY claim_id)) AS h FROM rise_runtime.canonical_evidence_claims c")).rows,before);
    });
    await t.test('catalog drift fails closed, never syntheticUNKNOWN',async()=>{
      await admin.query('ALTER TABLE rise_runtime.canonical_evidence_sources NO FORCE ROW LEVEL SECURITY');
      await assert.rejects(get(),{message:'interviewiq_coverage_unavailable'});
      await admin.query('ALTER TABLE rise_runtime.canonical_evidence_sources FORCE ROW LEVEL SECURITY');
    });
    await t.test('unexpected elevated runtime role denies',async()=>{
      await admin.query('ALTER ROLE rise_app_runtime BYPASSRLS');
      await assert.rejects(get(),{message:'interviewiq_coverage_unavailable'});
      await admin.query('ALTER ROLE rise_app_runtime NOBYPASSRLS');
    });
  }finally{
    if(pool)await pool.end();if(admin)await admin.end();if(started)run('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop']);
    try{run('pg_ctl',['-D',directory+'/data','status']);assert.fail('synthetic server still running');}catch(error){assert.equal(error.status,3);}
  }
});
