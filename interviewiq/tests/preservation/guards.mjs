import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import {validateDisposableURL,assertDisposableTarget,qualifyDisposableConnection,localToolEnvironment} from '../../scripts/disposable-db-guard.mjs';
import {classifyAdditive,verifyPreservationEvidence,verifyMigrationPolicy,BASELINE_TABLES} from '../../scripts/migration-preservation-gate.mjs';
import {transactionBody,assertProductionBootstrap,assertProductionTransport,INITIAL_BOOTSTRAP_SHA256} from '../../scripts/migrate.mjs';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export async function guardTests({connection,check}) {
 const url=connection.adminDatabaseUrl,base='postgresql://iiq_test_admin@localhost/iiq_test',socket=new URL(url).searchParams.get('host');
 await check('guard','qualified local URL and effective pg parser agree',()=>assert.equal(assertDisposableTarget(url).socket,socket));
 const cases=[
 ['production NODE_ENV',url,{NODE_ENV:'production'}],['runtime database environment',url,{INTERVIEWIQ_DATABASE_URL:'redacted-production-reference'}],
 ['provider context',url,{RAILWAY_PROJECT_ID:'synthetic-provider-context'}],['database password environment',url,{PGPASSWORD:'synthetic-only'}],
 ...['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGSYSCONFDIR','PGPASSFILE','PGSSLMODE'].map(key=>[key+' libpq override',url,{[key]:'synthetic-only'}]),
 ['remote PGHOST',url,{PGHOST:'example.invalid'}],['remote PGDATABASE',url,{PGDATABASE:'railway'}],
 ['wrong protocol',url.replace('postgresql:','https:')],['remote authority',url.replace('@localhost/','@example.invalid/')],
 ['wrong database',url.replace('/iiq_test?','/railway?')],['wrong login',url.replace('iiq_test_admin@','postgres@')],
 ['embedded password',url.replace('iiq_test_admin@','iiq_test_admin:synthetic@')],
 ['duplicate host',url+'&host=example.invalid'],['duplicate port',url+'&port=5432'],['unknown hostaddr',url+'&hostaddr=127.0.0.1'],
 ['connection options',url+'&options=-csearch_path%3Dpublic'],['wrong socket port',url.replace('port=55432','port=5432')],
 ['loose socket prefix',base+'?host=/tmp/iiq-pg18.fake/remote/socket&port=55432'],['fragment',url+'#ignored']
 ];
 for(const [name,value,environment={}]of cases)await check('guard',name+' is refused before connection',()=>assert.throws(()=>validateDisposableURL(value,{environment}),/Disposable harness/));
 await check('guard','missing harness custody marker is refused',async()=>{const directory=await fs.mkdtemp('/tmp/iiq-pg18.');await fs.mkdir(directory+'/socket',{mode:0o700});assert.throws(()=>assertDisposableTarget(base+'?host='+directory+'/socket&port=55432'),/Disposable harness/);});
 await check('guard','wrong live PostgreSQL cluster identity is refused',()=>assert.rejects(qualifyDisposableConnection({query:async()=>({rows:[{database:'iiq_test',username:'iiq_test_admin',major:18,cluster:'wrong',unix_socket:true}]})},url),/Disposable harness/));
 await check('guard','libpq child environment excludes all inherited PG parameters',()=>{const safe=localToolEnvironment({PATH:'/synthetic',PGHOST:socket,PGPORT:'55432',PGUSER:'iiq_test_admin',PGDATABASE:'iiq_test'});assert.equal(Object.keys(safe).some(key=>/^PG/.test(key)),false);assert.equal(safe.LC_ALL,'C');});
 await check('policy','production bootstrap is immutable and virgin-target only',()=>{assertProductionBootstrap(INITIAL_BOOTSTRAP_SHA256);assert.throws(()=>assertProductionBootstrap('f'.repeat(64)),/immutable/);assert.throws(()=>assertProductionBootstrap(INITIAL_BOOTSTRAP_SHA256,{ledgerExists:true}),/existing/);assert.throws(()=>assertProductionBootstrap(INITIAL_BOOTSTRAP_SHA256,{schemaExists:true}),/existing/);});
 for(const [name,urlValue,ssl,environment]of [
 ['disabled URL','postgresql://postgres@example.invalid/railway?sslmode=disable',{rejectUnauthorized:true},{}],
 ['require URL','postgresql://postgres@example.invalid/railway?sslmode=require',{rejectUnauthorized:true},{}],
 ['absent effective TLS','postgresql://postgres@example.invalid/railway',false,{}],
 ['disabled certificate check','postgresql://postgres@example.invalid/railway',{rejectUnauthorized:false},{}],
 ['global TLS bypass','postgresql://postgres@example.invalid/railway',{rejectUnauthorized:true},{NODE_TLS_REJECT_UNAUTHORIZED:'0'}],
 ['unreviewed startup options','postgresql://postgres@example.invalid/railway',{rejectUnauthorized:true},{PGOPTIONS:'-c search_path=public'}]
 ])await check('transport',name+' fails before connection',()=>assert.throws(()=>assertProductionTransport(new pg.Client({connectionString:urlValue,ssl}),urlValue,{environment}),/verified TLS/));
 await check('transport','strict effective TLS without URL override remains compatible',()=>{const urlValue='postgresql://postgres@example.invalid/railway',client=new pg.Client({connectionString:urlValue,ssl:{rejectUnauthorized:true,ca:'SYNTHETIC-PUBLIC-CA'}});assertProductionTransport(client,urlValue,{environment:{}});});
 const additive='BEGIN; SET LOCAL ROLE iiq_owner; ALTER TABLE iiq.interviews ADD COLUMN compatibility_note text; COMMIT;';
 await check('policy','nullable addition is explicitly additive',()=>assert.equal(classifyAdditive(transactionBody(additive)).additiveOnly,true));
 for(const [name,sql]of [
 ['DROP','DROP TABLE iiq.interviews'],['DELETE','DELETE FROM iiq.interviews'],['TRUNCATE','TRUNCATE iiq.interviews'],
 ['rename','ALTER TABLE iiq.interviews RENAME TO interviews_old'],['type rewrite','ALTER TABLE iiq.interviews ALTER COLUMN program_name TYPE varchar(10)'],
 ['NOT NULL','ALTER TABLE iiq.interviews ADD COLUMN unsafe text NOT NULL'],['data default','ALTER TABLE iiq.interviews ADD COLUMN unsafe text DEFAULT random()'],
 ['dynamic execution',"DO $$ BEGIN EXECUTE 'DELETE FROM iiq.interviews'; END $$"],['COPY','COPY iiq.interviews FROM PROGRAM $$unsafe$$'],
 ['DML CTE','WITH removed AS (DELETE FROM iiq.interviews RETURNING *) SELECT * FROM removed'],['arbitrary SELECT','SELECT dangerous_function()']
 ])await check('policy',name+' cannot be labeled additive',()=>assert.equal(classifyAdditive(sql+';').additiveOnly,false));
 for(const control of ['COMMIT','ROLLBACK','BEGIN','SAVEPOINT escape','RELEASE escape','START TRANSACTION'])await check('policy','embedded '+control+' cannot escape migration transaction',()=>assert.throws(()=>transactionBody('BEGIN; '+control+'; ALTER TABLE iiq.interviews ADD COLUMN x text; COMMIT;'),/embedded transaction control/));
 await check('policy','unterminated SQL body fails closed',()=>assert.throws(()=>classifyAdditive('DO $$ BEGIN'),/unterminated/));
 await check('policy','inert commented destructive words do not become executable',()=>assert.equal(classifyAdditive('-- DROP TABLE iiq.interviews;\nALTER TABLE iiq.interviews ADD COLUMN safe text;').additiveOnly,true));
 const directory=path.join(connection.directory,'guard-evidence');await fs.mkdir(directory,{mode:0o700});
 const bytes=Buffer.from('PGDMP-SYNTHETIC-UNIT-CANARY-NOT-A-REAL-BACKUP');const backup=path.join(directory,'unit.dump');await fs.writeFile(backup,bytes,{mode:0o600});
 const now=new Date().toISOString(),fingerprint=sha('synthetic-records'),counts=Object.fromEntries(BASELINE_TABLES.map(name=>[name,name==='iiq_migrations.applied'?1:0]));counts['iiq.actors']=2;counts['iiq.interviews']=3;counts['iiq.related_events']=1;counts['iiq.interview_history']=3;
 const evidence={schema:'missionmed.interviewiq.preservation-evidence.v1',status:'PASS',target:{host:'example.invalid',port:5432,database:'production-test-contract',serverMajor:18},backup:{path:backup,sha256:sha(bytes),bytes:bytes.length,format:'custom',capturedAt:now,snapshotConsistent:true},restore:{completedAt:now,sourceBackupSha256:sha(bytes),destination:{host:socket,database:'iiq_test_restore',serverMajor:18,unixSocketOnly:true,disposable:true},sourceCounts:counts,restoredCounts:counts,sourceFingerprint:fingerprint,restoredFingerprint:fingerprint,recordsPreserved:true,migrationLedgerPreserved:true,integrity:{orphan_interviews:0,orphan_events:0,orphan_history:0,unvalidated_constraints:0},tableFingerprints:BASELINE_TABLES.map(table=>({table,row_count:counts[table],aggregate_sha256:fingerprint}))}};
 let sequence=0;
 async function approvalFor(value=evidence){const filename=path.join(directory,'evidence-'+(++sequence)+'.json'),text=JSON.stringify(value);await fs.writeFile(filename,text,{mode:0o600});return {target:evidence.target,policy:'additive-only',preservationEvidence:{path:filename,sha256:sha(text)}};}
 const approval=await approvalFor();
 await check('evidence','exact backup/evidence receipt contract accepted (synthetic unit only)',()=>verifyPreservationEvidence(approval));
 for(const [name,change]of [
 ['wrong target',e=>e.target.host='other.invalid'],['stale backup',e=>e.backup.capturedAt='2020-01-01T00:00:00Z'],
 ['wrong restore backup',e=>e.restore.sourceBackupSha256='0'.repeat(64)],['wrong restored fingerprint',e=>e.restore.restoredFingerprint='0'.repeat(64)],
 ['changed counts',e=>e.restore.restoredCounts={...counts,'iiq.interviews':1}],
 ['missing ledger preservation',e=>e.restore.migrationLedgerPreserved=false],['inconsistent snapshot',e=>e.backup.snapshotConsistent=false],
 ['missing whole table count',e=>{delete e.restore.sourceCounts['iiq.debriefs'];delete e.restore.restoredCounts['iiq.debriefs'];}],
 ['missing table fingerprint',e=>e.restore.tableFingerprints.pop()],['orphan integrity',e=>e.restore.integrity.orphan_events=1],['nonlocal restore',e=>e.restore.destination.host='example.invalid'],
 ['false restore status',e=>e.restore.recordsPreserved=false],['altered backup size',e=>e.backup.bytes=1]
 ])await check('evidence',name+' is refused',async()=>{const modified=structuredClone(evidence);change(modified);await assert.rejects(verifyPreservationEvidence(await approvalFor(modified)));});
 await check('evidence','changed receipt bytes are refused',()=>assert.rejects(verifyPreservationEvidence({...approval,preservationEvidence:{...approval.preservationEvidence,sha256:'0'.repeat(64)}}),/checksum mismatch/));
 const destructive={name:'20990101000200_synthetic_contract.sql',sha256:sha('BEGIN; DELETE FROM iiq.interviews; COMMIT;'),sql:'BEGIN; DELETE FROM iiq.interviews; COMMIT;'};
 await check('policy','unknown/destructive SQL requires exact Founder authorization',()=>assert.rejects(verifyMigrationPolicy(approval,[destructive],{bodyOf:transactionBody}),/explicit Founder authorization/));
 await check('policy','synthetic exact Founder authorization contract is hash-bound (no execution)',async()=>{
  const permission={schema:'missionmed.interviewiq.destructive-migration-authorization.v1',status:'APPROVED',authorizedBy:'Brian',explicitPermission:'DESTRUCTIVE_MIGRATION_AUTHORIZED',authorityRef:'SYNTHETIC UNIT TEST ONLY',authorizedAt:now,target:evidence.target,preservationEvidenceSha256:approval.preservationEvidence.sha256,migrations:[{name:destructive.name,sha256:destructive.sha256}]};
  permission.materials={};
  for(const kind of ['inventory','rationale','alternatives','rollbackForwardRepair','dryRun']){const material={schema:'missionmed.interviewiq.destructive-migration-material.v1',kind,target:evidence.target,migrations:permission.migrations,preservationEvidenceSha256:approval.preservationEvidence.sha256,details:'SYNTHETIC UNIT CONTRACT ONLY; no authorization or migration execution',...(kind==='dryRun'?{status:'PASS',completedAt:now,destination:evidence.restore.destination}:{})};const filename=path.join(directory,'synthetic-'+kind+'.json'),text=JSON.stringify(material);await fs.writeFile(filename,text,{mode:0o600});permission.materials[kind]={path:filename,sha256:sha(text)};}
  const filename=path.join(directory,'synthetic-permission.json'),text=JSON.stringify(permission);await fs.writeFile(filename,text,{mode:0o600});
  const reviewed={...approval,founderAuthorization:{path:filename,sha256:sha(text)}};
  assert.equal((await verifyMigrationPolicy(reviewed,[destructive],{bodyOf:transactionBody})).additiveOnly,false);
  for(const kind of Object.keys(permission.materials)){const missing=structuredClone(permission);delete missing.materials[kind];const filename=path.join(directory,'missing-'+kind+'.json'),text=JSON.stringify(missing);await fs.writeFile(filename,text,{mode:0o600});await assert.rejects(verifyMigrationPolicy({...approval,founderAuthorization:{path:filename,sha256:sha(text)}},[destructive],{bodyOf:transactionBody}),/material/);}
  await assert.rejects(verifyMigrationPolicy(reviewed,[{...destructive,sha256:'f'.repeat(64)}],{bodyOf:transactionBody}),/does not bind/);
 });
}
