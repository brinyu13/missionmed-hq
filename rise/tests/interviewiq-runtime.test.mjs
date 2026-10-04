import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {createInterviewiqStore} from '../adapters/interviewiq-store.mjs';
import {MIGRATION,migrateInterviewiqOwner,qualifyLocalHarness,qualifyProductionEvidence,transactionBody} from '../tools/migrate-interviewiq-owner.mjs';

test('guarded real PostgreSQL replay, migration and preservation',async t=>{
  // No caller-selected database URL is accepted. Even a valid fixture refuses
  // ambient production routing before constructing its first client.
  for(const key of ['DATABASE_URL','RISE_DATABASE_URL','PGHOST','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS','RAILWAY_ENVIRONMENT_ID'])
    assert.equal(Boolean(process.env[key]),false,`Refusing ambient ${key}`);
  const bin='/opt/homebrew/opt/postgresql@18/bin/';
  const directory=fs.mkdtempSync('/tmp/iiq-rise-test-');fs.chmodSync(directory,0o700);
  const socket=directory+'/socket';fs.mkdirSync(socket,{mode:0o700});
  const marker='iiq-test-'+randomUUID(),manifest=directory+'/harness.json';
  const env={PATH:process.env.PATH,LANG:'C',LC_ALL:'C',PGHOST:socket,PGPORT:'55440',PGUSER:'postgres',PGDATABASE:'iiq_owner_synthetic'};
  const run=(name,args)=>execFileSync(bin+name,args,{env,stdio:['ignore','pipe','pipe'],timeout:30000});
  assert.match(run('postgres',['--version']).toString(),/18\./);
  let started=false,admin,pool;
  try {
    run('initdb',['-D',directory+'/data','-A','trust','--no-locale','--encoding=UTF8','-U','postgres']);
    started=true;
    run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-k ${socket} -h '' -p 55440 -c cluster_name=${marker}`,'-w','start']);
    const pid=Number(fs.readFileSync(directory+'/data/postmaster.pid','utf8').split('\n')[0]);assert.ok(pid>1);process.kill(pid,0);
    run('createdb',['iiq_owner_synthetic']);
    fs.writeFileSync(manifest,JSON.stringify({directory,host:socket,port:55440,database:'iiq_owner_synthetic',user:'postgres',marker,pid,createdAt:Date.now()}),{flag:'wx',mode:0o600});
    const qualified=qualifyLocalHarness(manifest);
    admin=new pg.Client(qualified.connection);await admin.connect();
    const identity=(await admin.query("SELECT inet_server_addr() AS address,current_database() AS database,current_setting('cluster_name') AS marker")).rows[0];
    assert.deepEqual(identity,{address:null,database:'iiq_owner_synthetic',marker});
    await admin.query(`CREATE ROLE rise_app_runtime NOLOGIN; CREATE ROLE rise_app_login LOGIN;
      GRANT rise_app_runtime TO rise_app_login; CREATE SCHEMA rise_runtime AUTHORIZATION postgres;
      GRANT USAGE ON SCHEMA rise_runtime TO rise_app_runtime;
      CREATE TABLE rise_runtime.protected_synthetic(id uuid PRIMARY KEY,owner uuid NOT NULL,content jsonb NOT NULL);
      INSERT INTO rise_runtime.protected_synthetic VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
        '{"date":"2026-11-01","time":"01:30","timezone":"America/New_York","fold":1,"history":["created","cancelled","restored"],"relatedEvent":"synthetic-1"}');`);
    const protectedBefore=(await admin.query('SELECT * FROM rise_runtime.protected_synthetic')).rows;
    const options={harnessPath:manifest};
    const original=fs.readFileSync(new URL('../sql/'+MIGRATION,import.meta.url),'utf8');
    const fixtureSql=(label,contents)=>{
      const folder=path.join(directory,label);fs.mkdirSync(folder,{mode:0o700});
      const file=path.join(folder,MIGRATION);fs.writeFileSync(file,contents,{mode:0o600});return file;
    };
    await t.test('harness refuses network paths and ambient production selection',()=>{
      assert.throws(()=>qualifyLocalHarness('/tmp/not-a-harness.json'));
      process.env.PGHOST='production.invalid';try{assert.throws(()=>qualifyLocalHarness(manifest));}finally{delete process.env.PGHOST;}
      assert.throws(()=>transactionBody(original.replace('COMMIT;','COMMIT; BEGIN; COMMIT;')));
      for(const control of ['END;','END TRANSACTION;','ABORT;','START TRANSACTION;','END /* alias */;',"SELECT '$mask$'; END; SELECT '$mask$';",'SELECT 1 AS é$mask$; END; SELECT 1 AS é$mask$;'])
        assert.throws(()=>transactionBody(original.replace('COMMIT;',()=>control+'\nCOMMIT;')));
    });
    await t.test('default production migration is closed without exact evidence',async()=>{
      await assert.rejects(migrateInterviewiqOwner({mode:'production',connectionString:'postgresql://synthetic:synthetic@production.invalid/db'}));
    });
    await t.test('production evidence requires pinned receipts and retained fresh dump, not flags',()=>{
      const hash=value=>createHash('sha256').update(value).digest('hex');
      const evidence=(name,value)=>{
        const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
        const file=path.join(directory,name);fs.writeFileSync(file,bytes,{mode:0o600});return {path:file,sha256:hash(bytes)};
      };
      const sqlHash=hash(original),capturedAt=Date.now()/1000;
      const backup={...evidence('synthetic.dump',Buffer.from('PGDMP-synthetic-evidence-only')),bytes:29,snapshotConsistent:true,capturedAt};
      backup.bytes=fs.statSync(backup.path).size;
      const target={project:'c0113625-951e-46ab-939b-dd57acc0e87c',environment:'549d6597-1962-44cb-b0f5-7d88bd025e31',service:'58236876-7616-4a6b-9792-bfdb114b51d8'};
      const sourceReceipt=evidence('source.json',{...target,identity:{database:'railway'},backup});
      const repairedRestoreReceipt=evidence('restore.json',{status:'PASS',localServerStopped:true,backup,restore:{recordsAndCanonicalRelationshipsPreserved:true,rolesOwnersAclRlsConstraintsPoliciesPreserved:true,sourceFingerprint:'synthetic',restoredFingerprint:'synthetic'}});
      const review={approved:true,allTableRowsMatch:true,rolesOwnersAclRlsConstraintsPoliciesMatch:true,productionWrites:0,localRestore:{independentPgCtlStatus:'NO_SERVER_RUNNING'},sourceReceipt,repairedRestoreReceipt,dump:backup,sourceFingerprint:'synthetic',restoredFingerprint:'synthetic'};
      const approval={...target,sqlSha256:sqlHash,backupSha256:backup.sha256,backupCapturedAt:capturedAt*1000,
        recoveryReview:evidence('review.json',review),sqlReview:evidence('sql-review.json',{approved:true,sqlSha256:sqlHash,migration:MIGRATION,productionDdlApproved:true})};
      assert.equal(qualifyProductionEvidence(approval,sqlHash),true);
      assert.throws(()=>qualifyProductionEvidence({...approval,recoveryReview:undefined,backupRestoreVerified:true},sqlHash));
      assert.throws(()=>qualifyProductionEvidence({...approval,environment:'wrong'},sqlHash));
      assert.throws(()=>qualifyProductionEvidence({...approval,sqlSha256:'f'.repeat(64)},sqlHash));
      assert.throws(()=>qualifyProductionEvidence({...approval,backupCapturedAt:Date.now()-86400001},sqlHash));
      fs.appendFileSync(backup.path,'tampered');assert.throws(()=>qualifyProductionEvidence(approval,sqlHash));
    });
    await t.test('relation-name collision including a view blocks bootstrap',async()=>{
      await admin.query('CREATE VIEW rise_runtime.iiq_owner_migrations AS SELECT 1 AS example');
      await assert.rejects(migrateInterviewiqOwner(options));
      await admin.query('ALTER VIEW rise_runtime.iiq_owner_migrations RENAME TO synthetic_collision_preserved');
    });
    await t.test('failed transaction leaves no nonce table or ledger',async()=>{
      const sqlPath=fixtureSql('failure',original.replace('COMMIT;','SELECT 1/0;\nCOMMIT;'));
      await assert.rejects(migrateInterviewiqOwner({...options,sqlPath}));
      const names=(await admin.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND relname IN ('iiq_owner_request_nonces','iiq_owner_migrations')")).rows;
      assert.equal(names.length,0);assert.deepEqual((await admin.query('SELECT * FROM rise_runtime.protected_synthetic')).rows,protectedBefore);
    });
    await t.test('first migration cannot bless altered column or constraint definitions',async()=>{
      for(const [label,sql] of [
        ['type',original.replace('nonce uuid NOT NULL','nonce text NOT NULL')],
        ['retention',original.replace("interval '90 seconds'","interval '1 second'")],
      ]) {
        await assert.rejects(migrateInterviewiqOwner({...options,sqlPath:fixtureSql(label,sql)}));
        assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rise_runtime' AND c.relname=ANY($1)",[['iiq_owner_migrations','iiq_owner_request_nonces']])).rows[0].n,0);
      }
    });
    await t.test('unexpected inherited runtime privileges refuse migration',async()=>{
      await admin.query('GRANT pg_monitor TO rise_app_runtime');
      try {await assert.rejects(migrateInterviewiqOwner(options));}
      finally {await admin.query('REVOKE pg_monitor FROM rise_app_runtime');}
    });
    await t.test('additive migration preserves prior canonical record exactly',async()=>{
      assert.equal((await migrateInterviewiqOwner(options)).status,'applied');
      assert.deepEqual((await admin.query('SELECT * FROM rise_runtime.protected_synthetic')).rows,protectedBefore);
      const ledger=(await admin.query('SELECT name FROM rise_runtime.iiq_owner_migrations')).rows;assert.deepEqual(ledger,[{name:MIGRATION}]);
    });
    await t.test('identical migration replay is a no-op',async()=>{
      assert.equal((await migrateInterviewiqOwner(options)).status,'unchanged');
      assert.equal((await admin.query('SELECT count(*)::int AS count FROM rise_runtime.iiq_owner_migrations')).rows[0].count,1);
    });
    await t.test('checksum drift cannot rewrite applied history',async()=>{
      const sqlPath=fixtureSql('drift',original+'\n-- different bytes\n');
      await assert.rejects(migrateInterviewiqOwner({...options,sqlPath}));
      assert.equal((await migrateInterviewiqOwner(options)).status,'unchanged');
    });
    const poolConfig={...qualified.connection,user:'rise_app_login',max:8,connectionTimeoutMillis:1500};
    pool=new pg.Pool(poolConfig);
    let store=createInterviewiqStore({enabled:true,pool});
    const nonce={issuer:'interviewiq',nonce:randomUUID(),requestHash:'a'.repeat(64),expiresAt:new Date(Date.now()+90000).toISOString()};
    await t.test('32 simultaneous replay contenders have exactly one winner',async()=>{
      const results=await Promise.all(Array.from({length:32},()=>store.consumeNonce(nonce)));
      assert.equal(results.filter(Boolean).length,1);
      const row=(await admin.query('SELECT request_sha256,extract(epoch from expires_at-created_at) AS retention FROM rise_runtime.iiq_owner_request_nonces WHERE nonce=$1',[nonce.nonce])).rows[0];
      assert.equal(row.request_sha256,nonce.requestHash);assert.ok(Number(row.retention)>=90);
    });
    await t.test('same nonce with changed request never overwrites history',async()=>{
      assert.equal(await store.consumeNonce({...nonce,requestHash:'b'.repeat(64)}),false);
      assert.equal((await admin.query('SELECT request_sha256 FROM rise_runtime.iiq_owner_request_nonces WHERE nonce=$1',[nonce.nonce])).rows[0].request_sha256,'a'.repeat(64));
    });
    await t.test('new client and adapter retain durable replay denial',async()=>{
      await pool.end();pool=new pg.Pool(poolConfig);store=createInterviewiqStore({enabled:true,pool});
      assert.equal(await store.consumeNonce(nonce),false);
    });
    await t.test('separate valid requests remain independent',async()=>{
      const results=await Promise.all(Array.from({length:12},()=>store.consumeNonce({...nonce,nonce:randomUUID()})));
      assert.equal(results.filter(Boolean).length,12);
    });
    await t.test('expired nonce history still denies reuse with a fresh expiry',async()=>{
      const expiredNonce=randomUUID();
      await admin.query(`INSERT INTO rise_runtime.iiq_owner_request_nonces VALUES('interviewiq',$1,$2,clock_timestamp()-interval '180 seconds',clock_timestamp()-interval '60 seconds')`,[expiredNonce,nonce.requestHash]);
      assert.equal(await store.consumeNonce({...nonce,nonce:expiredNonce,expiresAt:new Date(Date.now()+90000).toISOString()}),false);
    });
    await t.test('disabled, malformed and wrong issuer fail closed without writes',async()=>{
      const before=(await admin.query('SELECT count(*)::int AS n FROM rise_runtime.iiq_owner_request_nonces')).rows[0].n;
      for(const input of [{...nonce,issuer:'other'},{...nonce,requestHash:'wrong'},{...nonce,extra:true},{...nonce,expiresAt:new Date(0).toISOString()}])assert.equal(await store.consumeNonce(input),false);
      assert.equal(await createInterviewiqStore({pool}).consumeNonce({...nonce,nonce:randomUUID()}),false);
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM rise_runtime.iiq_owner_request_nonces')).rows[0].n,before);
    });
    await t.test('runtime cannot mutate replay history or access migration ledger',async()=>{
      const runtime=new pg.Client(poolConfig);await runtime.connect();
      try {
        for(const text of ['UPDATE rise_runtime.iiq_owner_request_nonces SET request_sha256=request_sha256',
          'DELETE FROM rise_runtime.iiq_owner_request_nonces','TRUNCATE rise_runtime.iiq_owner_request_nonces',
          'SELECT * FROM rise_runtime.iiq_owner_migrations',"INSERT INTO rise_runtime.iiq_owner_migrations(name,sql_sha256,schema_sha256) VALUES('x','x','x')"])
          await assert.rejects(runtime.query(text),error=>error.code==='42501');
      } finally {await runtime.end();}
    });
    await t.test('anonymous database role has no replay access',async()=>{
      await admin.query('CREATE ROLE iiq_public_probe NOLOGIN; SET ROLE iiq_public_probe');
      try {await assert.rejects(admin.query('SELECT * FROM rise_runtime.iiq_owner_request_nonces'),e=>e.code==='42501');}
      finally {await admin.query('RESET ROLE');}
    });
    await t.test('application rollback leaves current history readable',async()=>{
      assert.equal(await createInterviewiqStore({enabled:false,pool}).consumeNonce({...nonce,nonce:randomUUID()}),false);
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM rise_runtime.iiq_owner_request_nonces')).rows[0].n,14);
      assert.deepEqual((await admin.query('SELECT * FROM rise_runtime.protected_synthetic')).rows,protectedBefore);
    });
    await t.test('catalog drift blocks migration replay without repairing data',async()=>{
      await admin.query('ALTER TABLE rise_runtime.iiq_owner_request_nonces ADD COLUMN synthetic_nullable text');
      await assert.rejects(migrateInterviewiqOwner(options));
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM rise_runtime.iiq_owner_request_nonces')).rows[0].n,14);
    });
    await t.test('partial state is not silently bootstrapped',async()=>{
      await admin.query('ALTER TABLE rise_runtime.iiq_owner_migrations RENAME TO synthetic_ledger_preserved');
      await assert.rejects(migrateInterviewiqOwner(options));
      assert.equal((await admin.query('SELECT count(*)::int AS n FROM rise_runtime.synthetic_ledger_preserved')).rows[0].n,1);
    });
  } finally {
    if(pool)await pool.end();if(admin)await admin.end();
    if(started)run('pg_ctl',['-D',directory+'/data','-m','fast','-w','stop']);
  }
});

test('nonce success requires commit and failed rollback discards connection',async()=>{
  const input={issuer:'interviewiq',nonce:randomUUID(),requestHash:'c'.repeat(64),expiresAt:new Date(Date.now()+90000).toISOString()};
  let released,committed=false;
  const client={query:async({text})=>{
    if(text==='COMMIT'){committed=true;throw Error('synthetic commit outage');}
    if(text==='ROLLBACK')throw Error('synthetic broken connection');
    return {rowCount:1};
  },release:discard=>{released=discard;}};
  const store=createInterviewiqStore({enabled:true,pool:{options:{connectionTimeoutMillis:1000},connect:async()=>client}});
  assert.equal(await store.consumeNonce(input),false);assert.equal(committed,true);assert.equal(released,true);
});
