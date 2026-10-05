// Real disposable PG18 preservation rehearsal. Never a production test entrypoint.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID,createHash,webcrypto} from 'node:crypto';
import pg from 'pg';
import {readDisposableConnectionFile,assertDisposableTarget,qualifyDisposableConnection,localToolEnvironment} from '../../scripts/disposable-db-guard.mjs';
import {migrate,migrationManifest} from '../../scripts/migrate.mjs';
import {createDatabase} from '../../server/db.mjs';
import {createCommands} from '../../server/commands.mjs';
import {guardTests} from './guards.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseline='538e97fb13b268683ebacc39d2e80cf551b11b5b';
const connection=readDisposableConnectionFile(process.env.IIQ_RUNTIME_TEST_CONNECTION);
const directory=connection.directory,sha=x=>createHash('sha256').update(x).digest('hex');
const results=[],mapping={A:'Create interviews in schema N',B:'Migrate N to additive N+1',C:'Original interviews still exist',D:'Interview IDs unchanged',E:'Owner bindings unchanged',F:'Dates, wall times, timezones, UTC instants, folds and nulls unchanged',G:'Related events intact',H:'Cancel/restore history intact',I:'Added nullable fields are safe',J:'Old record opens in current approved UI',K:'Unchanged old runtime reads forward-schema data',L:'Student A is denied student B data',M:'Fixture/test/reset paths refuse production',N:'Migration and request replay preserve records',O:'Backup and isolated restore preserve representative records'};
async function check(group,name,fn){try{await fn();results.push({group,name,status:'PASS'});console.log('PASS '+group+' '+name);}catch(error){results.push({group,name,status:'FAIL',error:error.code||error.message});throw error;}}
const gate=(letter,fn)=>check('A-O',letter+': '+mapping[letter],fn);
const db=new pg.Client({connectionString:connection.adminDatabaseUrl});await db.connect();await qualifyDisposableConnection(db,connection.adminDatabaseUrl,{role:'iiq_test_admin'});
const database=createDatabase({databaseUrl:connection.databaseUrl});await qualifyDisposableConnection(database.pool,connection.databaseUrl,{role:'iiq_runtime_test'});
const config={coreOnly:true,publicOrigin:'https://missionmed.test'};
const commands=createCommands({database,owners:{},config,clock:()=>new Date('2026-10-03T12:00:00Z')});
const actors=['A','B'].map((name,i)=>({id:randomUUID(),wpUserId:900000001+i,displayName:'SYNTHETIC PRESERVATION '+name,firstName:name,role:'student',tier:'360',eligible:true,assignments:[],zone:'America/New_York'}));
const [A,B]=actors;let primary,eventId,originalRequest,before,oldDatabase,oldCommands,backupReceipt;
async function action(actor,command,data={},interviewId=null){const boot=await commands.bootstrap(actor),request={command,data,interviewId,expectedVersion:boot.version,requestId:randomUUID()};const response=await commands.execute(actor,request);return {request,response};}
async function rows(table,client=db){return (await client.query('SELECT to_jsonb(t) AS row FROM '+table+' t ORDER BY to_jsonb(t)::text')).rows.map(x=>x.row);}
async function coreSnapshot(){return {interviews:await rows('iiq.interviews'),events:await rows('iiq.related_events'),history:await rows('iiq.interview_history'),consents:await rows('iiq.consents')};}
async function fingerprint(client){const names=(await client.query("SELECT quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('iiq','iiq_migrations') AND c.relkind='r' ORDER BY name")).rows.map(x=>x.name);const tables=[];for(const name of names){const data=await rows(name,client);tables.push({table:name,count:data.length,sha256:sha(JSON.stringify(data))});}return {sha256:sha(JSON.stringify(tables)),tables};}
const common=row=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='compatibility_note'));
const migrationDir=path.join(directory,'candidate');
let failed;
try {
 await guardTests({connection,check});
 await gate('A',async()=>{
  for(const actor of actors)await commands.bootstrap(actor);
  const first=await action(A,'interview.create',{programName:'SYNTHETIC PRESERVE A first fold',track:'Categorical',deadline:'2026-10-30',schedule:{date:'2026-11-01',time:'01:30',zone:'America/New_York',fold:0,duration:75,travel_minutes:30,format:'virtual',joining:'Synthetic invitation only'}});primary=first.response.interviewId;originalRequest=first.request;
  await action(A,'interview.create',{programName:'SYNTHETIC PRESERVE A second fold',track:'Preliminary',schedule:{date:'2026-11-01',time:'01:30',zone:'America/New_York',fold:1,duration:45,format:'phone'}});
  await action(A,'interview.create',{programName:'SYNTHETIC PRESERVE A date only',schedule:{date:'2026-11-02',zone:'America/New_York'}});
  await action(B,'interview.create',{programName:'SYNTHETIC PRIVATE B',schedule:{date:'2026-11-03',time:'10:00',zone:'Asia/Kolkata',duration:60}});
  eventId=(await action(A,'event.create',{kind:'Social dinner',date:'2026-10-31',time:'18:30',zone:'America/New_York',duration_minutes:90,note:'SYNTHETIC related event note'},primary)).response.id;
  await action(A,'interview.lifecycle',{action:'cancel'},primary);await action(A,'interview.lifecycle',{action:'restore'},primary);
  await action(A,'event.update',{eventId,action:'cancel'},primary);await action(A,'event.update',{eventId,action:'restore'},primary);
  await database.withActor(A,c=>c.query("INSERT INTO iiq.consents(owner_id,scope,subject_ref,status,policy_version) VALUES($1,'preservation_rehearsal',$2,'active','SYNTHETIC_ONLY')",[A.id,primary]),{write:true});
  before=await coreSnapshot();assert.equal(before.interviews.length,4);assert.equal(before.events.length,1);assert.equal(before.consents.length,1);
 });
 await gate('B',async()=>{
  await fs.cp(path.join(root,'infra/postgres'),migrationDir,{recursive:true});
  await fs.writeFile(path.join(migrationDir,'migrations/20990101000100_preservation_nullable.sql'),'-- Synthetic local rehearsal only; never a production migration.\nBEGIN;\nSET LOCAL ROLE iiq_owner;\nALTER TABLE iiq.interviews ADD COLUMN compatibility_note text;\nCOMMIT;\n',{flag:'wx'});
  await migrate({connectionString:connection.adminDatabaseUrl,local:true,directory:migrationDir,log:()=>{}});
  assert.equal((await db.query("SELECT is_nullable,column_default FROM information_schema.columns WHERE table_schema='iiq' AND table_name='interviews' AND column_name='compatibility_note'")).rows[0].is_nullable,'YES');
 });
 await gate('C',async()=>assert.equal((await rows('iiq.interviews')).length,before.interviews.length));
 await gate('D',async()=>assert.deepEqual((await rows('iiq.interviews')).map(x=>x.id).sort(),before.interviews.map(x=>x.id).sort()));
 await gate('E',async()=>assert.deepEqual((await rows('iiq.interviews')).map(x=>[x.id,x.owner_id]).sort(),before.interviews.map(x=>[x.id,x.owner_id]).sort()));
 await gate('F',async()=>{
  assert.deepEqual((await rows('iiq.interviews')).map(common),before.interviews);
  const folds=before.interviews.filter(x=>x.local_time==='01:30:00');assert.equal(folds.length,2);assert.equal(Math.abs(Date.parse(folds[1].start_at)-Date.parse(folds[0].start_at)),3600000);
  assert.ok(before.interviews.some(x=>x.local_date&&x.local_time===null&&x.start_at===null));
 });
 await gate('G',async()=>assert.deepEqual(await rows('iiq.related_events'),before.events));
 await gate('H',async()=>{assert.deepEqual(await rows('iiq.interview_history'),before.history);assert.ok(before.history.some(x=>x.event_type==='Lifecycle: cancel'));assert.ok(before.history.some(x=>x.event_type==='Lifecycle: restore'));assert.deepEqual(await rows('iiq.consents'),before.consents);});
 await gate('I',async()=>{assert.ok((await rows('iiq.interviews')).every(x=>x.compatibility_note===null));assert.equal((await commands.bootstrap(A)).state.interviews.length,3);});
 await gate('J',async()=>{
  const require=createRequire(import.meta.url),{JSDOM}=require('jsdom');
  const html=await fs.readFile(path.join(root,'public/index.html'),'utf8'),source=(await fs.readFile(path.join(root,'public/app.js'),'utf8')).replace(/void boot\(\);\s*$/,'');
  const dom=new JSDOM(html,{url:'https://missionmed.test/interviewiq/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  try{Object.defineProperty(w,'crypto',{value:webcrypto});w.Headers=Headers;w.matchMedia=()=>({matches:true});w.HTMLElement.prototype.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=()=>{throw Error('Unexpected network in preservation UI test');};
   w.eval(source+'\nwindow.preservation={applyBootstrap,render,A,getS:()=>S};');const boot=await commands.bootstrap(A);w.preservation.applyBootstrap(boot);w.preservation.getS().ui.route='interviews';w.preservation.render();w.preservation.A['open-interview']({dataset:{id:primary}});
   assert.equal(w.preservation.getS().ui.open,primary);const room=w.document.querySelector('[data-view=interview]');assert.ok(room);assert.match(room.querySelector('.roomHead').textContent,/SYNTHETIC PRESERVE A first fold/);assert.ok(room.querySelector('.roomHead').textContent.includes(primary));assert.ok(room.querySelector('[data-section=schedule][data-id="'+primary+'"]'));
   w.preservation.A['open-section']({dataset:{id:primary,section:'schedule'}});assert.equal(w.preservation.getS().ui.section,'schedule');assert.equal(w.document.querySelector('#sd-date').value,'2026-11-01');assert.equal(w.document.querySelector('#sd-time').value,'01:30');assert.equal(w.document.querySelector('#sd-zone').value,'America/New_York');
  }finally{w.close();}
 });
 await gate('K',async()=>{
  const archiveRoot=path.join(directory,'unchanged-old-runtime');await fs.mkdir(archiveRoot,{mode:0o700});
  const archive=execFileSync('git',['archive','--format=tar',baseline,'interviewiq/server'],{cwd:path.dirname(root),maxBuffer:8*1024*1024});execFileSync('/usr/bin/tar',['-xf','-','-C',archiveRoot],{input:archive});
  const oldRoot=path.join(archiveRoot,'interviewiq');const nodeModules=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.resolve('pg')))));await fs.symlink(nodeModules,path.join(oldRoot,'node_modules'));
  for(const filename of ['server/db.mjs','server/commands.mjs','server/core-read-model.mjs','server/records.mjs'])assert.equal(sha(await fs.readFile(path.join(oldRoot,filename))),sha(execFileSync('git',['show',baseline+':interviewiq/'+filename],{cwd:root})));
  const oldDbModule=await import(pathToFileURL(path.join(oldRoot,'server/db.mjs'))),oldCommandModule=await import(pathToFileURL(path.join(oldRoot,'server/commands.mjs')));
  oldDatabase=oldDbModule.createDatabase({databaseUrl:connection.databaseUrl});await qualifyDisposableConnection(oldDatabase.pool,connection.databaseUrl,{role:'iiq_runtime_test'});await oldDatabase.verifyRuntimeRole();oldCommands=oldCommandModule.createCommands({database:oldDatabase,owners:{},config});
  const created=await action(A,'interview.create',{programName:'SYNTHETIC N+1 newly created',schedule:{date:'2026-11-07',time:'10:45',zone:'America/New_York'}});const newId=created.response.interviewId;
  await database.withActor(A,c=>c.query('UPDATE iiq.interviews SET compatibility_note=$2 WHERE id=$1',[newId,'SYNTHETIC optional forward data']),{write:true});
  const oldBoot=await oldCommands.bootstrap(A);assert.ok(oldBoot.state.interviews.find(x=>x.id===newId));assert.ok(oldBoot.state.interviews.find(x=>x.id===primary));
  await oldCommands.execute(A,{command:'interview.identity',interviewId:newId,data:{programName:'SYNTHETIC old app compatible edit'},requestId:randomUUID(),expectedVersion:oldBoot.version});
  assert.equal((await db.query('SELECT compatibility_note FROM iiq.interviews WHERE id=$1',[newId])).rows[0].compatibility_note,'SYNTHETIC optional forward data');
 });
 await gate('L',async()=>{
  const target=(await commands.bootstrap(B)).state.interviews[0].id;
  assert.equal((await database.withActor(A,c=>c.query('SELECT id FROM iiq.interviews WHERE id=$1',[target]))).rowCount,0);
  assert.equal((await database.withActor(A,c=>c.query("UPDATE iiq.interviews SET program_name='SYNTHETIC forbidden' WHERE id=$1",[target]),{write:true})).rowCount,0);
  await assert.rejects(action(A,'interview.identity',{programName:'forbidden'},target),e=>e.status===404);
 });
 await gate('M',async()=>{
  const entries=['tests/postgres/migrations.test.mjs','tests/postgres/security.test.mjs','tests/postgres/runtime-qualification.test.mjs','tests/domain-review/commands.test.mjs','tests/api/core-http.test.mjs','tests/recordings/postgres.mjs','tests/helpers/preview-server.mjs'];
  const env={...process.env,NODE_ENV:'production',IIQ_RUNTIME_TEST_CONNECTION:path.join(directory,'connection.json'),IIQ_RECORDING_TEST_CONNECTION:path.join(directory,'connection.json')};
  for(const entry of entries){const code='import pg from '+JSON.stringify(import.meta.resolve('pg'))+';pg.Client.prototype.connect=()=>{throw Error("NETWORK_ATTEMPT")};pg.Pool.prototype.connect=()=>{throw Error("NETWORK_ATTEMPT")};process.argv[2]='+JSON.stringify(path.join(directory,'connection.json'))+';try{await import('+JSON.stringify(pathToFileURL(path.join(root,entry)).href)+');process.exitCode=3}catch(e){if(!/Disposable harness/.test(e.message)){console.error(e.message);process.exitCode=4}}';const result=spawnSync(process.execPath,['--input-type=module','-'],{input:code,encoding:'utf8',env,timeout:10000});assert.equal(result.status,0,entry+': '+result.stderr);}
  const shell=spawnSync('/bin/bash',[path.join(root,'scripts/run-postgres-tests.sh')],{encoding:'utf8',env,timeout:10000});assert.notEqual(shell.status,0);assert.match(shell.stderr,/Disposable harness/);
  for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGSYSCONFDIR']){const poisoned=spawnSync('/bin/bash',[path.join(root,'scripts/run-postgres-tests.sh')],{encoding:'utf8',env:{...process.env,[key]:'synthetic-unroutable'},timeout:10000});assert.notEqual(poisoned.status,0);assert.match(poisoned.stderr,/Disposable harness/);}
  const duplicated=connection.adminDatabaseUrl+'&host=example.invalid';await assert.rejects(migrate({connectionString:duplicated,local:true}),/Disposable harness/);
 });
 await gate('N',async()=>{
  const prior=await fingerprint(db);await migrate({connectionString:connection.adminDatabaseUrl,local:true,directory:migrationDir,log:()=>{}});assert.deepEqual(await fingerprint(db),prior);
  const replay=await commands.execute(A,originalRequest);assert.equal(replay.replayed,true);assert.equal(replay.interviewId,primary);assert.deepEqual(await fingerprint(db),prior);
 });
 await gate('O',async()=>{
  const beforeBackup=await fingerprint(db),backup=path.join(directory,'preservation-synthetic.dump');
  execFileSync(path.join(connection.pgBin,'pg_dump'),['--format=custom','--file',backup,'--host',connection.directory+'/socket','--port','55432','--username','iiq_test_admin','iiq_test'],{env:localToolEnvironment()});await fs.chmod(backup,0o600);
  execFileSync(path.join(connection.pgBin,'createdb'),['--host',connection.directory+'/socket','--port','55432','--username','iiq_test_admin','iiq_test_restore'],{env:localToolEnvironment()});
  execFileSync(path.join(connection.pgBin,'pg_restore'),['--exit-on-error','--host',connection.directory+'/socket','--port','55432','--username','iiq_test_admin','--dbname','iiq_test_restore',backup],{env:localToolEnvironment()});
  const restoreURL=connection.adminDatabaseUrl.replace('/iiq_test?','/iiq_test_restore?');assertDisposableTarget(restoreURL,{role:'iiq_test_admin',database:'iiq_test_restore'});const restored=new pg.Client({connectionString:restoreURL});await restored.connect();
  try{await qualifyDisposableConnection(restored,restoreURL,{role:'iiq_test_admin',database:'iiq_test_restore'});const after=await fingerprint(restored);assert.deepEqual(after,beforeBackup);backupReceipt={sha256:sha(await fs.readFile(backup)),sourceFingerprint:beforeBackup.sha256,restoredFingerprint:after.sha256,tables:after.tables,disposableOnly:true};}finally{await restored.end();}
 });
 await check('LOI-compatibility','Preparation saves retain unknown and approved LOI anchors without Calendar changes',async()=>{
  const anchors=[null,'legacy',{type:'iiq.loi.revision',schemaVersion:1,state:'approved',text:'Synthetic exact approved letter',revisionId:randomUUID()},{type:'iiq.loi.revision',schemaVersion:99,unknown:'retain'}];
  await database.withActor(A,c=>c.query('INSERT INTO iiq.preparation(owner_id,interview_id,anchors) VALUES($1,$2,$3::jsonb) ON CONFLICT(interview_id) DO UPDATE SET anchors=EXCLUDED.anchors',[A.id,primary,JSON.stringify(anchors)]),{write:true});
  const calendarBefore={interviews:await rows('iiq.interviews'),events:await rows('iiq.related_events'),history:await rows('iiq.interview_history')};
  const full=createCommands({database,owners:{context:async()=>({})},config:{...config,coreOnly:false}}),v=(await full.bootstrap(A)).version;
  await full.execute(A,{command:'prep.save',interviewId:primary,data:{why:{text:'Synthetic subsequent Why Program',edited:true},questions:'Synthetic retained question'},expectedVersion:v,requestId:randomUUID()});
  assert.deepEqual((await database.withActor(A,c=>c.query('SELECT anchors FROM iiq.preparation WHERE owner_id=$1 AND interview_id=$2',[A.id,primary]))).rows[0].anchors,anchors);
  assert.deepEqual(await rows('iiq.interviews'),calendarBefore.interviews);assert.deepEqual(await rows('iiq.related_events'),calendarBefore.events);assert.deepEqual(await rows('iiq.interview_history'),calendarBefore.history);
 });
 await check('runtime-guard','DELETE privilege drift is refused and restored',async()=>{try{await db.query('GRANT DELETE ON iiq.interviews TO iiq_authenticated');await assert.rejects(database.verifyRuntimeRole(),e=>e.code==='unsafe_database_custody');}finally{await db.query('REVOKE DELETE ON iiq.interviews FROM iiq_authenticated');}assert.equal(await database.verifyRuntimeRole(),true);});
}catch(error){failed=error;console.error(error.stack||error.message);}
finally {
 await oldDatabase?.close();await database.close();await db.end();
 const groups={};for(const row of results){const group=groups[row.group]??={checks:0,passed:0,failed:0};group.checks++;group[row.status==='PASS'?'passed':'failed']++;}
 const gates=Object.fromEntries(Object.entries(mapping).map(([letter,description])=>[letter,{description,status:results.find(x=>x.group==='A-O'&&x.name.startsWith(letter+':'))?.status||'NOT_RUN'}]));
 const receipt={schema:'missionmed.interviewiq.preservation-tests.v1',status:failed?'FAIL':'PASS',observedAt:new Date().toISOString(),baselineCommit:baseline,environment:{syntheticOnly:true,unixSocketOnly:true,directory},groups,total:{checks:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length},gates,checks:results,backupRestore:backupReceipt||null,productionMutation:false,inheritedRegressionCountsIncluded:false,limitations:['UI functional DOM check uses actual approved app.js in JSDOM; no visual/browser acceptance claimed.','Old runtime is byte-verified baseline server code on real forward schema; no production rollback performed.']};
 const filename=path.join(directory,'preservation-receipt.json');await fs.writeFile(filename,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});console.log('PRESERVATION_RECEIPT='+filename);console.log(JSON.stringify({status:receipt.status,groups,total:receipt.total}));
}
if(failed)process.exitCode=1;
