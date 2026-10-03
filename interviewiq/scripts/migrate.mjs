#!/usr/bin/env node
// Only this dedicated migration connection may own schema objects. The API's
// runtime connection never runs this script and never receives owner membership.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {assertDisposableTarget,qualifyDisposableConnection} from './disposable-db-guard.mjs';
import {assertNoTransactionEscape,verifyPreservationEvidence,verifyMigrationPolicy} from './migration-preservation-gate.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=message=>{throw new Error(message);};
export const INITIAL_BOOTSTRAP_SHA256='0abf9e462826e345941ee449bd659b2542fcc43abd8b173a93ff3320ccc902cb';
export function assertProductionBootstrap(checksum,{ledgerExists=false,schemaExists=false}={}) {
  if(checksum!==INITIAL_BOOTSTRAP_SHA256)fail('Production bootstrap must match immutable initial bytes');
  if(ledgerExists||schemaExists)fail('Production bootstrap is forbidden on an existing product schema or ledger');
}
export function assertProductionTransport(client,connectionString,{environment=process.env}={}) {
  const mode=new URL(connectionString).searchParams.get('sslmode'),ssl=client.connectionParameters.ssl;
  if((mode&&mode!=='verify-full')||environment.NODE_TLS_REJECT_UNAUTHORIZED==='0'||environment.PGOPTIONS||client.connectionParameters.options||
    !ssl||(typeof ssl==='object'&&ssl.rejectUnauthorized===false))fail('Production migration requires verified TLS without unsafe overrides');
}
export async function migrationManifest(directory=path.join(root,'infra/postgres')) {
  const bootstrap=await fs.readFile(path.join(directory,'bootstrap.sql'),'utf8');
  const names=(await fs.readdir(path.join(directory,'migrations'))).filter(n=>n.endsWith('.sql')).sort();
  if(!names.length||names.some(n=>!/^\d{14}_[a-z0-9_]+\.sql$/.test(n))||new Set(names.map(n=>n.slice(0,14))).size!==names.length)fail('Invalid or duplicate migration timestamp');
  const migrations=[];
  for(const name of names) {const sql=await fs.readFile(path.join(directory,'migrations',name),'utf8');migrations.push({name,sha256:sha(sql),sql});}
  return {bootstrap:{name:'bootstrap.sql',sha256:sha(bootstrap),sql:bootstrap},migrations};
}
export function transactionBody(sql) {
  // Strip only the outer explicit transaction. Transaction-local role/config and
  // ledger insertion then commit together; an error rolls back both DDL and ledger.
  const withoutComments=sql.replace(/^(?:\s*--[^\n]*\n)+/,'');
  if(!/^\s*BEGIN\s*;/i.test(withoutComments)||!/COMMIT\s*;\s*$/i.test(withoutComments))fail('Migration must have explicit outer BEGIN/COMMIT');
  const body=withoutComments.replace(/^\s*BEGIN\s*;/i,'').replace(/COMMIT\s*;\s*$/i,'');
  assertNoTransactionEscape(body);
  return body;
}
export async function migrate({connectionString,local=false,bootstrap=false,approvalPath,directory,log=console.log}) {
  if(!connectionString)fail('IIQ_MIGRATION_DATABASE_URL is required');
  const url=new URL(connectionString);
  const manifest=await migrationManifest(directory);
  let approval;
  if(local) {
    assertDisposableTarget(connectionString,{role:'iiq_test_admin'});
  } else {
    if(!['postgresql:','postgres:'].includes(url.protocol)||url.hash||[...url.searchParams.keys()].some(key=>key!=='sslmode')||url.searchParams.getAll('sslmode').length>1)fail('Production connection must not override approved target through URL options');
    if(!approvalPath)fail('Independent migration approval receipt is required');
    approval=JSON.parse(await fs.readFile(approvalPath,'utf8'));
    if(approval.status!=='APPROVED'||!approval.reviewedBy||!approval.reviewedAt||!approval.authorityRef||!approval.target)fail('Incomplete independent approval receipt');
    if(approval.bootstrapSha256!==manifest.bootstrap.sha256||JSON.stringify(approval.migrations)!==JSON.stringify(manifest.migrations.map(({name,sha256})=>({name,sha256}))))fail('Approval hashes do not match candidate migration bytes');
    if(bootstrap&&approval.allowBootstrap!==true)fail('Bootstrap is not approved');
    if(bootstrap)assertProductionBootstrap(manifest.bootstrap.sha256);
    if(approval.target.host!==url.hostname||String(approval.target.port)!==(url.port||'5432')||approval.target.database!==decodeURIComponent(url.pathname.slice(1))||approval.target.migrationUser!==decodeURIComponent(url.username))fail('Connection target does not match approval');
    if(!Array.isArray(approval.expectedAppliedMigrations))fail('Exact expected applied migration history is required');
    await verifyPreservationEvidence(approval);
  }
  const client=new pg.Client({connectionString,application_name:'iiq-reviewed-migration',connectionTimeoutMillis:10000});
  if(!local)assertProductionTransport(client,connectionString);
  await client.connect();let locked=false;
  try {
    if(local)await qualifyDisposableConnection(client,connectionString,{role:'iiq_test_admin'});
    const {rows:[identity]}=await client.query("SELECT current_database() AS database,current_user AS migration_user,current_setting('server_version_num')::integer/10000 AS major");
    if(local&&identity.database!=='iiq_test')fail('Unexpected local database identity');
    if(!local&&(identity.database!==approval.target.database||identity.migration_user!==approval.target.migrationUser||identity.major!==approval.target.serverMajor))fail('Actual database identity/version does not match approval');
    await client.query("SET lock_timeout='10s'; SET statement_timeout='60s'");
    const {rows:[lock]}=await client.query("SELECT pg_try_advisory_lock(hashtextextended('iiq:reviewed:migrations',0)) AS acquired");
    if(!lock.acquired)fail('Another migration runner holds the target lease');locked=true;
    // Inspect immutable history and candidate policy before any persistent write,
    // including migration-ledger initialization or bootstrap.
    const {rows:[ledger]}=await client.query("SELECT to_regclass('iiq_migrations.applied') IS NOT NULL AS exists, to_regnamespace('iiq') IS NOT NULL AS schema_exists");
    if(!local&&bootstrap)assertProductionBootstrap(manifest.bootstrap.sha256,{ledgerExists:ledger.exists,schemaExists:ledger.schema_exists});
    let applied=[];
    if(ledger.exists){
      const {rows:[owner]}=await client.query("SELECT nspowner::regrole::text AS owner FROM pg_namespace WHERE nspname='iiq_migrations'");
      if(owner.owner!==identity.migration_user)fail('Migration ledger owner mismatch');
      applied=(await client.query('SELECT name,sha256 FROM iiq_migrations.applied ORDER BY name')).rows;
    }
    for(const row of applied) {const candidate=manifest.migrations.find(m=>m.name===row.name);if(!candidate||candidate.sha256!==row.sha256)fail('Applied migration custody differs; never rewrite applied history');}
    const pending=manifest.migrations.filter(m=>!applied.some(row=>row.name===m.name));
    if(!local){
      if(JSON.stringify(applied)!==JSON.stringify(approval.expectedAppliedMigrations))fail('Actual migration history differs from reviewed preimage');
      await verifyMigrationPolicy(approval,pending,{bodyOf:transactionBody});
    }
    if(!ledger.exists){await client.query('BEGIN');try {
      await client.query('CREATE SCHEMA IF NOT EXISTS iiq_migrations');
      const {rows:[owner]}=await client.query("SELECT nspowner::regrole::text AS owner FROM pg_namespace WHERE nspname='iiq_migrations'");
      if(owner.owner!==identity.migration_user)fail('Migration ledger owner mismatch');
      await client.query('REVOKE ALL ON SCHEMA iiq_migrations FROM PUBLIC');
      await client.query('CREATE TABLE IF NOT EXISTS iiq_migrations.applied(name text PRIMARY KEY,sha256 text NOT NULL CHECK(sha256 ~ \'^[0-9a-f]{64}$\'),applied_at timestamptz NOT NULL DEFAULT now())');
      await client.query('REVOKE ALL ON iiq_migrations.applied FROM PUBLIC');
      await client.query('COMMIT');
    } catch(e){await client.query('ROLLBACK');throw e;}}
    if(bootstrap){await client.query(manifest.bootstrap.sql);log(`Bootstrap verified: ${manifest.bootstrap.sha256}`);}
    for(const migration of manifest.migrations) {
      if(applied.some(row=>row.name===migration.name)){log(`Unchanged: ${migration.name}`);continue;}
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL search_path=pg_catalog');
        await client.query(transactionBody(migration.sql));
        await client.query('RESET ROLE');
        await client.query('INSERT INTO iiq_migrations.applied(name,sha256) VALUES($1,$2)',[migration.name,migration.sha256]);
        await client.query('COMMIT');log(`Applied: ${migration.name} ${migration.sha256}`);
      } catch(e){await client.query('ROLLBACK');throw e;}
    }
    return {applied:manifest.migrations.length,identity};
  } finally {if(locked)await client.query("SELECT pg_advisory_unlock(hashtextextended('iiq:reviewed:migrations',0))").catch(()=>{});await client.end();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=new Set(process.argv.slice(2));
    if([...args].some(a=>!['--local','--bootstrap','--manifest'].includes(a)))fail('Unknown migration option');
    if(args.has('--manifest')){const m=await migrationManifest();console.log(JSON.stringify({bootstrapSha256:m.bootstrap.sha256,migrations:m.migrations.map(({name,sha256})=>({name,sha256}))},null,2));}
    else await migrate({connectionString:process.env.IIQ_MIGRATION_DATABASE_URL,local:args.has('--local'),bootstrap:args.has('--bootstrap'),approvalPath:process.env.IIQ_MIGRATION_APPROVAL_FILE});
  } catch(error) {console.error(`Migration stopped: ${error.code||'validation_error'} ${error.code?'No changes from the failed migration were committed.':error.message}`);process.exitCode=1;}
}
