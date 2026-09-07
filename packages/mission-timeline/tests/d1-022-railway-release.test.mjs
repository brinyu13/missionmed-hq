import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import pg from 'pg';
import {MIGRATIONS_022,checkedMigrationBodies,assertBaseline,assertLogin,runDatabaseOperation} from '../scripts/railway-database-022.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const entries=await Promise.all(MIGRATIONS_022.map(async([name])=>({name,sql:await readFile(join(root,'database/migrations',name),'utf8')})));
test('Reviewed migration set rejects omission, reordering, extra SQL and changed bytes',()=>{
  assert.equal(checkedMigrationBodies(entries).length,entries.length);
  assert.throws(()=>checkedMigrationBodies(entries.slice(1)),/MIGRATION_SET_DENIED/);
  assert.throws(()=>checkedMigrationBodies([...entries].reverse()),/MIGRATION_BYTES_DENIED/);
  assert.throws(()=>checkedMigrationBodies(entries.map((x,i)=>i?x:{...x,sql:x.sql+' select 1;'})),/MIGRATION_BYTES_DENIED/);
});
test('Database baseline refuses wrong target, prior objects and an unreviewed ledger',()=>{
  const good={database:'railway',operator:'postgres',schema_owner:'postgres',schema_version:'d1-timeline-db-500.1',new_tables_absent:true,login_absent:true,issuer_absent:true,admin_workflow_absent:true,bookkeeping_tables:[]};
  assert.doesNotThrow(()=>assertBaseline(good));
  for(const changed of [{database:'sibling'},{operator:'owner'},{schema_owner:'sibling'},{schema_version:'different'},{new_tables_absent:false},{issuer_absent:false},{login_absent:false},{admin_workflow_absent:false},{bookkeeping_tables:['public.existing_ledger']}])assert.throws(()=>assertBaseline({...good,...changed}),/DATABASE_BASELINE_CHANGED/);
});
test('Restricted login refuses inherited, grantable, extra or privileged roles',()=>{
  const row={rolname:'timeline_api_login_022',rolcanlogin:true,rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false};
  const members=['timeline_authenticated','timeline_grant_authority','timeline_identity_sync'].map(role=>({role,inherit_option:false,set_option:true,admin_option:false}));
  assert.doesNotThrow(()=>assertLogin(row,members));
  for(const key of ['rolinherit','rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'])assert.throws(()=>assertLogin({...row,[key]:true},members),/LOGIN_ATTRIBUTES_DENIED/);
  for(const changed of [{inherit_option:true},{admin_option:true},{set_option:false},{role:'postgres'}])assert.throws(()=>assertLogin(row,members.map((x,i)=>i?x:{...x,...changed})),/LOGIN_MEMBERSHIPS_DENIED/);
});
test('Actual PostgreSQL18 remote helper applies atomically, verifies NOINHERIT and refuses replay',async()=>{
  const bin='/opt/homebrew/opt/postgresql@18/bin';
  const dir=await mkdtemp(join(tmpdir(),'d1-022-release-pg-'));const data=join(dir,'data');let started=false;let owner;
  const command=(name,args)=>execFileSync(join(bin,name),args,{stdio:['ignore','pipe','pipe']});
  const password='s'.repeat(64); // Disposable synthetic input only; never a production credential.
  const url=(user,pass='')=>`postgresql://${user}${pass?':'+pass:''}@localhost:57622/railway?host=${encodeURIComponent(dir)}`;
  try{
    command('initdb',['-D',data,'--auth=trust','--username=postgres','--no-locale']);
    const hba=join(data,'pg_hba.conf');await writeFile(hba,'local railway timeline_api_login_022 scram-sha-256\n'+await readFile(hba,'utf8'));
    command('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-o',`-h '' -k ${dir} -p 57622`,'-w','start']);started=true;
    command('createdb',['-h',dir,'-p','57622','-U','postgres','railway']);
    const base=['database/migrations/202607150001_timeline_v1.sql','database/disposable/seed_413.sql','database/migrations/202607150002_timeline_v1_413_hardening.sql','database/migrations/202608020003_d1_411c_identity_and_admin_grants.sql','database/roles/202608020001_d1_411c_runtime_roles.sql','database/migrations/202608040004_d1_500_grant_hardening.sql','database/roles/202608040002_d1_500_runtime_roles.sql','database/migrations/20260805223000_rc1_first_use_identity_provisioning.sql'];
    for(const rel of base)command('psql',['-h',dir,'-p','57622','-U','postgres','-d','railway','-v','ON_ERROR_STOP=1','-f',join(root,rel)]);
    owner=new pg.Client({connectionString:url('postgres')});await owner.connect();
    assertBaseline((await runDatabaseOperation({action:'inspect'},pg,url('postgres'))).baseline);
    const expectedSystemIdentifier=(await runDatabaseOperation({action:'inspect'},pg,url('postgres'))).baseline.system_identifier;
    const input={action:'apply',migrations:entries,password,replacementUrl:url('timeline_api_login_022',password),expectedSystemIdentifier};
    await assert.rejects(runDatabaseOperation({...input,password:"bad'password"},pg,url('postgres')),/PASSWORD_INPUT_DENIED/);
    await assert.rejects(runDatabaseOperation({...input,expectedSystemIdentifier:'1'},pg,url('postgres')),/DATABASE_CLUSTER_IDENTITY_CHANGED/);
    assertBaseline((await runDatabaseOperation({action:'inspect'},pg,url('postgres'))).baseline);
    await owner.query("alter table timeline.principals add constraint synthetic_atomic_failure check(id<>'timeline_admin_authority_022')");
    await assert.rejects(runDatabaseOperation(input,pg,url('postgres')),error=>error.code==='23514');
    assertBaseline((await runDatabaseOperation({action:'inspect'},pg,url('postgres'))).baseline);
    await owner.query('alter table timeline.principals drop constraint synthetic_atomic_failure');
    const result=await runDatabaseOperation(input,pg,url('postgres'));
    assert.equal(result.status,'PASS');assert.equal(result.ambient_access_denied,true);assert.equal(result.schema_version,'d1-timeline-db-500.1');assert.equal(result.migrations.length,entries.length);
    await assert.rejects(runDatabaseOperation(input,pg,url('postgres')),/DATABASE_BASELINE_CHANGED/);
    const count=(await owner.query("select count(*)::int as n from timeline.principals where id='timeline_admin_authority_022'")).rows[0].n;assert.equal(count,1);
    assert.equal((await runDatabaseOperation({action:'verify',replacementUrl:url('timeline_api_login_022',password)},pg,url('postgres'))).status,'PASS');
    const wrongPassword=new pg.Client({connectionString:url('timeline_api_login_022','wrong-disposable-input')});
    try{await assert.rejects(wrongPassword.connect(),error=>error.code==='28P01');}finally{await wrongPassword.end();}
    const log=await readFile(join(dir,'postgres.log'),'utf8');assert.equal(log.includes(password),false,'No password persisted to PostgreSQL diagnostic log');
  }finally{
    await owner?.end();if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);await rm(dir,{recursive:true,force:true});
  }
});
test('Actual Python operator denies foreign targets, unsafe URLs, absent execution and enabled admission',()=>{
  const source=`import importlib.util,json\nfrom pathlib import Path\np=Path('scripts/railway-release-022.py')\ns=importlib.util.spec_from_file_location('release022',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nassert m.replacement_url('postgresql://postgres:old@postgres.railway.internal:5432/railway?sslmode=require','s'*64).endswith('@postgres.railway.internal:5432/railway?sslmode=require')\nfor value in ['postgresql://postgres:x@public.example/railway','postgresql://postgres:x@postgres.railway.internal/other','postgresql://other:x@postgres.railway.internal/railway']:\n try:m.replacement_url(value,'s'*64);raise AssertionError('accepted wrong DB')\n except m.Denied:pass\ntry:m.operate({},'/tmp/never.json',False);raise AssertionError('missing execution')\nexcept m.Denied as e:assert str(e)=='EXPLICIT_EXECUTION_REQUIRED'\nfor value in [{'enabled':False},{'exists':True,'enabled':True,'stage':'canary'},{'exists':True,'enabled':False,'stage':'canary'}]:\n m.execute=lambda *a,**k:json.dumps(value).encode()\n try:m.admission_off();raise AssertionError('accepted unsafe admission')\n except m.Denied:pass\nm.execute=lambda *a,**k:json.dumps({'exists':True,'enabled':False,'stage':'off'}).encode()\nm.admission_off()\nprint('PASS')\n`;
  assert.equal(execFileSync('python3',['-B','-c',source],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),'PASS');
});
