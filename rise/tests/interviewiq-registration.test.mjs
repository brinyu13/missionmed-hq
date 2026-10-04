import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {registerInterviewiqCurrentRights,qualifyRegistrationBundle,registrationState,MIGRATION} from '../tools/register-interviewiq-current-rights.mjs';
import {qualifyLocalHarness,catalogHash,migrateInterviewiqOwner} from '../tools/migrate-interviewiq-owner.mjs';
import {createRiseSourceRightsController} from '../adapters/postgres-runtime.mjs';

// Explicit read-only artifact inputs; never a database URL. The retained bundle
// is the approved source-controlled public program release, not a student dump.
// These tests fail if custody is absent; they do not silently substitute fixtures.
test('A6 real local PostgreSQL metadata-only registration and preservation',async t=>{
  for(const key of ['DATABASE_URL','RISE_DATABASE_URL','PGHOST','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','RAILWAY_ENVIRONMENT_ID'])
    assert.equal(Boolean(process.env[key]),false,`Refusing ambient ${key}`);
  const bundleDirectory=process.env.IIQ_RISE_TEST_BUNDLE,grantPath=process.env.IIQ_RISE_TEST_GRANT,preimagePath=process.env.IIQ_RISE_TEST_PREIMAGE;
  assert.ok(bundleDirectory&&grantPath&&preimagePath,'Explicit retained read-only bundle/grant/preimage paths are required.');
  const preimageBytes=fs.readFileSync(preimagePath);
  assert.equal(createHash('sha256').update(preimageBytes).digest('hex'),'1aab79762ef857266c7fda27793b1cf0a1e3ada76e151a07f28995a6fbab861e');
  const preimage=JSON.parse(preimageBytes),bin='/opt/homebrew/opt/postgresql@18/bin/';
  const directory=fs.mkdtempSync('/tmp/iiq-rise-test-');fs.chmodSync(directory,0o700);
  const socket=directory+'/socket';fs.mkdirSync(socket,{mode:0o700});
  const marker='iiq-test-'+randomUUID(),harnessPath=directory+'/harness.json';
  const env={PATH:process.env.PATH,LANG:'C',LC_ALL:'C',PGHOST:socket,PGPORT:'55440',PGUSER:'postgres',PGDATABASE:'iiq_owner_synthetic'};
  const run=(name,args)=>execFileSync(bin+name,args,{env,stdio:['ignore','pipe','pipe'],timeout:30000});
  let started=false,admin,pool;
  const options={harnessPath,bundleDirectory,grantPath};
  try{
    run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8','-U','postgres']);started=true;
    run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-k ${socket} -h '' -p 55440 -c cluster_name=${marker}`,'-w','start']);
    run('createdb',['iiq_owner_synthetic']);
    const pid=Number(fs.readFileSync(directory+'/data/postmaster.pid','utf8').split('\n')[0]);
    fs.writeFileSync(harnessPath,JSON.stringify({directory,host:socket,port:55440,database:'iiq_owner_synthetic',user:'postgres',marker,pid,createdAt:Date.now()}),{flag:'wx',mode:0o600});
    const qualified=qualifyLocalHarness(harnessPath);admin=new pg.Client(qualified.connection);await admin.connect();
    await admin.query("SET timezone='UTC'; SET datestyle='ISO,YMD'");
    assert.equal((await admin.query('SELECT inet_server_addr() AS address')).rows[0].address,null);
    for(const file of ['005_rights_safe_runtime.sql','007_canonical_evidence_bridge.sql'])await admin.query(fs.readFileSync(new URL('../sql/'+file,import.meta.url),'utf8'));
    await admin.query('CREATE ROLE rise_app_login LOGIN; GRANT rise_app_runtime TO rise_app_login');
    await migrateInterviewiqOwner({harnessPath});
    const a4History=(await admin.query('SELECT to_jsonb(r) AS row FROM rise_runtime.iiq_owner_migrations r')).rows;
    for(const r of preimage.releases)await admin.query(`INSERT INTO rise_runtime.registry_releases SELECT * FROM jsonb_populate_record(NULL::rise_runtime.registry_releases,$1::jsonb)`,[JSON.stringify(r)]);
    for(const r of preimage.rights)await admin.query(`INSERT INTO rise_runtime.release_source_rights SELECT * FROM jsonb_populate_record(NULL::rise_runtime.release_source_rights,$1::jsonb)`,[JSON.stringify(r)]);
    const old=preimage.releases.find(r=>r.active).release_id,release='rise_registry_acgme_2026-09-20_50d08ea6f2da';
    await admin.query(`INSERT INTO rise_runtime.registry_programs VALUES($1,'synthetic-retained-program','{"canonicalId":"synthetic-retained-program"}');`,[old]);
    await admin.query(`INSERT INTO rise_runtime.student_program_states(subject_key,release_id,program_specialty_id,state,notes)
      VALUES(repeat('1',64),$1,'synthetic-retained-program','SAVED','Synthetic retained private note')`,[old]);
    const protectedRows=async()=>({programs:(await admin.query('SELECT to_jsonb(r) AS row FROM rise_runtime.registry_programs r')).rows,
      students:(await admin.query('SELECT to_jsonb(r) AS row FROM rise_runtime.student_program_states r')).rows});
    const protectedBefore=await protectedRows(),before=await registrationState(admin);
    assert.equal(catalogHash(before),'01f9d1b43b912d84cf4d9e4213d5baf9291c0f36bb7e6509f8e23a01dc4080bc');
    pool=new pg.Pool({...qualified.connection,user:'rise_app_login',connectionTimeoutMillis:1500});
    const controller=await createRiseSourceRightsController({pool});
    await t.test('actual original reader accepts original current rights',async()=>{
      assert.equal((await controller.assertCurrent({registryReleaseId:old,authorizationSha256s:preimage.rights.map(r=>r.authorization_sha256)})).current,true);
    });
    await t.test('production mode and ambient routing fail closed',async()=>{
      await assert.rejects(registerInterviewiqCurrentRights({...options,mode:'production'}));
      process.env.PGHOST='production.invalid';try{await assert.rejects(registerInterviewiqCurrentRights(options));}finally{delete process.env.PGHOST;}
      assert.deepEqual(await registrationState(admin),before);
    });
    await t.test('wrong grant and altered bundle reject before SQL',async()=>{
      const wrongGrant=directory+'/wrong-grant.png';fs.writeFileSync(wrongGrant,'not the approved grant',{mode:0o600});
      assert.throws(()=>qualifyRegistrationBundle({bundleDirectory,grantPath:wrongGrant}));
      const wrongBundle=directory+'/wrong-bundle';fs.mkdirSync(wrongBundle,{mode:0o700});fs.writeFileSync(wrongBundle+'/api-index.json','{}',{mode:0o600});
      assert.throws(()=>qualifyRegistrationBundle({bundleDirectory:wrongBundle,grantPath}));
      assert.deepEqual(await registrationState(admin),before);
    });
    await t.test('unexpected active state refuses repair or history adoption',async()=>{
      await admin.query('UPDATE rise_runtime.registry_releases SET active=false WHERE release_id=$1',[old]);
      const altered=await registrationState(admin);await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await registrationState(admin),altered);
      await admin.query('UPDATE rise_runtime.registry_releases SET active=true WHERE release_id=$1',[old]);
    });
    await t.test('collision with existing history view is not adopted',async()=>{
      await admin.query('CREATE VIEW rise_runtime.iiq_registry_registration_history AS SELECT 1 AS placeholder');
      await assert.rejects(registerInterviewiqCurrentRights(options));
      await admin.query('ALTER VIEW rise_runtime.iiq_registry_registration_history RENAME TO synthetic_registration_collision');
      assert.deepEqual(await registrationState(admin),before);
    });
    await t.test('successful malicious trigger is refused before side effects',async()=>{
      await admin.query(`CREATE FUNCTION rise_runtime.synthetic_registration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE rise_runtime.student_program_states SET notes='synthetic corrupted'; RETURN NEW; END $$;
        CREATE TRIGGER synthetic_registration_failure AFTER INSERT ON rise_runtime.registry_releases FOR EACH ROW EXECUTE FUNCTION rise_runtime.synthetic_registration_failure()`);
      await assert.rejects(registerInterviewiqCurrentRights(options));
      assert.equal((await admin.query("SELECT to_regclass('rise_runtime.iiq_registry_registration_history') AS relation")).rows[0].relation,null);
      const checks=(await admin.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='registry_releases_projection_check'")).rows;
      assert.equal(checks[0].definition,"CHECK ((projection = 'STUDENT_RIGHTS_SAFE_RISE'::text))");
      assert.deepEqual(await registrationState(admin),before);assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('DROP TRIGGER synthetic_registration_failure ON rise_runtime.registry_releases');
    });
    await t.test('unexpected default ACL causes actual post-DDL rollback',async()=>{
      await admin.query('CREATE ROLE synthetic_extra NOLOGIN; ALTER DEFAULT PRIVILEGES IN SCHEMA rise_runtime GRANT SELECT ON TABLES TO synthetic_extra');
      await assert.rejects(registerInterviewiqCurrentRights(options));
      assert.equal((await admin.query("SELECT to_regclass('rise_runtime.iiq_registry_registration_history') AS relation")).rows[0].relation,null);
      assert.equal((await admin.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='registry_releases_projection_check'")).rows[0].definition,"CHECK ((projection = 'STUDENT_RIGHTS_SAFE_RISE'::text))");
      assert.deepEqual(await registrationState(admin),before);assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('ALTER DEFAULT PRIVILEGES IN SCHEMA rise_runtime REVOKE SELECT ON TABLES FROM synthetic_extra');
    });
    await t.test('unexpected rewrite rule and dangerous default are refused',async()=>{
      await admin.query('CREATE RULE synthetic_side_effect AS ON INSERT TO rise_runtime.registry_releases DO ALSO UPDATE rise_runtime.student_program_states SET notes=\'rule-corruption\'');
      await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('DROP RULE synthetic_side_effect ON rise_runtime.registry_releases');
      await admin.query(`CREATE FUNCTION rise_runtime.synthetic_created_at() RETURNS timestamptz LANGUAGE plpgsql AS $$ BEGIN UPDATE rise_runtime.student_program_states SET notes='default-corruption'; RETURN now(); END $$;
        ALTER TABLE rise_runtime.registry_releases ALTER COLUMN created_at SET DEFAULT rise_runtime.synthetic_created_at()`);
      await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('ALTER TABLE rise_runtime.registry_releases ALTER COLUMN created_at SET DEFAULT now()');
    });
    await t.test('enabled event trigger blocks all registration DDL',async()=>{
      await admin.query(`CREATE FUNCTION rise_runtime.synthetic_ddl_hook() RETURNS event_trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE rise_runtime.student_program_states SET notes='ddl-corruption'; END $$;
        CREATE EVENT TRIGGER synthetic_ddl_hook ON ddl_command_start EXECUTE FUNCTION rise_runtime.synthetic_ddl_hook()`);
      await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('DROP EVENT TRIGGER synthetic_ddl_hook');
    });
    await t.test('unexpected ACL, policy, CHECK and index drift fail closed',async()=>{
      const changes=[
        ['GRANT SELECT ON rise_runtime.registry_releases TO synthetic_extra','REVOKE SELECT ON rise_runtime.registry_releases FROM synthetic_extra'],
        ['CREATE POLICY synthetic_policy ON rise_runtime.release_source_rights FOR SELECT TO PUBLIC USING(true)','DROP POLICY synthetic_policy ON rise_runtime.release_source_rights'],
        ['ALTER TABLE rise_runtime.registry_releases ADD CONSTRAINT synthetic_check CHECK(program_count>=0)','ALTER TABLE rise_runtime.registry_releases DROP CONSTRAINT synthetic_check'],
        ['CREATE INDEX synthetic_index ON rise_runtime.registry_releases(program_count)','DROP INDEX rise_runtime.synthetic_index'],
      ];
      for(const [alter,repair] of changes){
        await admin.query(alter);
        try{await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await registrationState(admin),before);assert.deepEqual(await protectedRows(),protectedBefore);}
        finally{await admin.query(repair);}
      }
    });
    await t.test('bounded current registration preserves programs/students and old rows',async()=>{
      const result=await registerInterviewiqCurrentRights(options);assert.equal(result.status,'applied');assert.equal(result.migration,MIGRATION);assert.equal(result.programRowsImported,0);
      assert.deepEqual(await protectedRows(),protectedBefore);
      const after=await registrationState(admin);assert.equal(after.releases.length,3);assert.equal(after.rights.length,3);
      for(const r of before.releases)assert.deepEqual(after.releases.find(a=>a.release_id===r.release_id),r.release_id===old?{...r,active:false}:r);
      for(const r of before.rights)assert.deepEqual(after.rights.find(a=>a.release_id===r.release_id&&a.source===r.source),r);
    });
    await t.test('original controller reads forward schema and exact new current rights',async()=>{
      assert.equal((await controller.assertCurrent({registryReleaseId:release,authorizationSha256s:['274a40ec17e34402ee3e73dda81271dc03482659a971fa08f46cfc8bfbdc23bf']})).current,true);
      assert.equal(await controller.assertCurrent({registryReleaseId:old,authorizationSha256s:preimage.rights.map(r=>r.authorization_sha256)}),false);
    });
    await t.test('repeat registration is unchanged and does not duplicate history',async()=>{
      const current=await registrationState(admin);assert.equal((await registerInterviewiqCurrentRights(options)).status,'unchanged');assert.deepEqual(await registrationState(admin),current);
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM rise_runtime.iiq_registry_registration_history')).rows[0].n,1);
      assert.deepEqual(await protectedRows(),protectedBefore);
    });
    await t.test('A4 nonce migration still replays and its history remains exact',async()=>{
      assert.equal((await migrateInterviewiqOwner({harnessPath})).status,'unchanged');
      assert.deepEqual((await admin.query('SELECT to_jsonb(r) AS row FROM rise_runtime.iiq_owner_migrations r')).rows,a4History);
    });
    await t.test('unlogged history is never accepted as durable',async()=>{
      await admin.query('ALTER TABLE rise_runtime.iiq_registry_registration_history SET UNLOGGED');
      await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await protectedRows(),protectedBefore);
      await admin.query('ALTER TABLE rise_runtime.iiq_registry_registration_history SET LOGGED');
    });
    await t.test('constraint alias on another table cannot mask missing target guard',async()=>{
      await admin.query(`ALTER TABLE rise_runtime.registry_releases DROP CONSTRAINT registry_releases_projection_check;
        CREATE TABLE rise_runtime.synthetic_constraint_alias(projection text CONSTRAINT registry_releases_projection_check CHECK (projection IN ('STUDENT_RIGHTS_SAFE_RISE','SOURCE_CONTROLLED_REGISTRY')))`);
      await assert.rejects(registerInterviewiqCurrentRights(options));
      await admin.query("ALTER TABLE rise_runtime.registry_releases ADD CONSTRAINT registry_releases_projection_check CHECK (projection IN ('STUDENT_RIGHTS_SAFE_RISE','SOURCE_CONTROLLED_REGISTRY'))");
      assert.equal((await registerInterviewiqCurrentRights(options)).status,'unchanged');
    });
    await t.test('runtime cannot read or write registration history',async()=>{
      for(const sql of ['SELECT * FROM rise_runtime.iiq_registry_registration_history','DELETE FROM rise_runtime.iiq_registry_registration_history',
        'TRUNCATE rise_runtime.iiq_registry_registration_history','UPDATE rise_runtime.iiq_registry_registration_history SET name=name'])await assert.rejects(pool.query(sql),e=>e.code==='42501');
    });
    await t.test('revoked current grant stays revoked and replay fails',async()=>{
      await admin.query('UPDATE rise_runtime.release_source_rights SET revoked_at=now() WHERE release_id=$1',[release]);const revoked=await registrationState(admin);
      await assert.rejects(registerInterviewiqCurrentRights(options));assert.deepEqual(await registrationState(admin),revoked);
      assert.equal(await controller.assertCurrent({registryReleaseId:release,authorizationSha256s:['274a40ec17e34402ee3e73dda81271dc03482659a971fa08f46cfc8bfbdc23bf']}),false);
      assert.deepEqual(await protectedRows(),protectedBefore);
    });
  }finally{
    if(pool)await pool.end();if(admin)await admin.end();
    if(started){run('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop']);t.diagnostic(JSON.stringify({localCluster:directory,stopped:true}));}
    // Retain the guarded synthetic cluster as evidence; no deletion cleanup.
  }
});
