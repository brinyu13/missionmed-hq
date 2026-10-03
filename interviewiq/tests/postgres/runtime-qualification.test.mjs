// Deliberately changes and restores roles/ACLs in a disposable synthetic DB.
// Run separately from other suites so no request observes a drift probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import {createDatabase} from '../../server/db.mjs';
import {readDisposableConnectionFile,qualifyDisposableConnection} from '../../scripts/disposable-db-guard.mjs';

const file=process.env.IIQ_RUNTIME_TEST_CONNECTION;
assert.match(file||'',/^\/tmp\/iiq-pg18\.[A-Za-z0-9]+\/connection\.json$/);
const connection=readDisposableConnectionFile(file);
assert.equal(connection.syntheticOnly,true);assert.equal(connection.unixSocketOnly,true);
for(const value of [connection.databaseUrl,connection.adminDatabaseUrl]) {
  const url=new URL(value);assert.equal(url.pathname,'/iiq_test');
  assert.equal(url.searchParams.get('host'),connection.directory+'/socket');
}
const database=createDatabase({databaseUrl:connection.databaseUrl});
const admin=new pg.Client({connectionString:connection.adminDatabaseUrl});
await admin.connect();
await qualifyDisposableConnection(admin,connection.adminDatabaseUrl,{role:'iiq_test_admin'});
await qualifyDisposableConnection(database.pool,connection.databaseUrl,{role:'iiq_runtime_test'});
const runtime=new URL(connection.databaseUrl).username;
assert.equal(runtime,'iiq_runtime_test');
async function drift(apply,restore,code='unsafe_database_role') {
  try {await admin.query(apply);await assert.rejects(database.verifyRuntimeRole(),e=>e.code===code);}
  finally {await admin.query(restore);}
  assert.equal(await database.verifyRuntimeRole(),true);
}
try {
  await test('normal NOINHERIT runtime and effective role pass catalog qualification',async()=>assert.equal(await database.verifyRuntimeRole(),true));
  for(const [unsafe,safe] of [['BYPASSRLS','NOBYPASSRLS'],['SUPERUSER','NOSUPERUSER'],['LOGIN','NOLOGIN'],['INHERIT','NOINHERIT'],['CREATEDB','NOCREATEDB'],['CREATEROLE','NOCREATEROLE'],['REPLICATION','NOREPLICATION']])
    await test(`effective application role drift ${unsafe} fails startup`,()=>drift(`ALTER ROLE iiq_authenticated ${unsafe}`,`ALTER ROLE iiq_authenticated ${safe}`));
  await test('runtime implicit inheritance is rejected',()=>drift('ALTER ROLE iiq_runtime_test INHERIT','ALTER ROLE iiq_runtime_test NOINHERIT'));
  await test('schema-owner membership is rejected',()=>drift('GRANT iiq_owner TO iiq_runtime_test WITH INHERIT FALSE, SET TRUE','REVOKE iiq_owner FROM iiq_runtime_test'));
  await test('worker membership is rejected',()=>drift('GRANT iiq_worker TO iiq_runtime_test WITH INHERIT FALSE, SET TRUE','REVOKE iiq_worker FROM iiq_runtime_test'));
  await test('unexpected indirect membership is rejected even with SET disabled',async()=>{
    await admin.query('CREATE ROLE iiq_test_unexpected NOLOGIN NOINHERIT NOBYPASSRLS');
    try {await drift('GRANT iiq_test_unexpected TO iiq_authenticated WITH INHERIT FALSE, SET FALSE','REVOKE iiq_test_unexpected FROM iiq_authenticated');}
    finally {await admin.query('DROP ROLE iiq_test_unexpected');}
  });
  await test('missing effective SET permission is rejected',()=>drift('GRANT iiq_authenticated TO iiq_runtime_test WITH SET FALSE','GRANT iiq_authenticated TO iiq_runtime_test WITH SET TRUE'));
  await test('elevated schema owner is rejected',()=>drift('ALTER ROLE iiq_owner BYPASSRLS','ALTER ROLE iiq_owner NOBYPASSRLS'));
  await test('unexpected effective schema CREATE is rejected',()=>drift('GRANT CREATE ON SCHEMA iiq TO iiq_authenticated','REVOKE CREATE ON SCHEMA iiq FROM iiq_authenticated','unsafe_database_custody'));
  await test('public schema access drift is rejected',()=>drift('GRANT USAGE ON SCHEMA iiq TO PUBLIC','REVOKE USAGE ON SCHEMA iiq FROM PUBLIC','unsafe_database_custody'));
  await test('disabled RLS is rejected',()=>drift('ALTER TABLE iiq.interviews DISABLE ROW LEVEL SECURITY','ALTER TABLE iiq.interviews ENABLE ROW LEVEL SECURITY','unsafe_database_custody'));
  await test('removed forced RLS is rejected',()=>drift('ALTER TABLE iiq.interviews NO FORCE ROW LEVEL SECURITY','ALTER TABLE iiq.interviews FORCE ROW LEVEL SECURITY','unsafe_database_custody'));
  await test('effective TRUNCATE bypass privilege is rejected',()=>drift('GRANT TRUNCATE ON iiq.interviews TO iiq_authenticated','REVOKE TRUNCATE ON iiq.interviews FROM iiq_authenticated','unsafe_database_custody'));
  await test('effective DELETE privilege drift is rejected',()=>drift('GRANT DELETE ON iiq.interviews TO iiq_authenticated','REVOKE DELETE ON iiq.interviews FROM iiq_authenticated','unsafe_database_custody'));
  await test('unexpected direct login SELECT is rejected',()=>drift('GRANT SELECT ON iiq.interviews TO iiq_runtime_test','REVOKE SELECT ON iiq.interviews FROM iiq_runtime_test','unsafe_database_custody'));
  await test('PUBLIC function execution is rejected',()=>drift('GRANT EXECUTE ON FUNCTION iiq.publish_report(uuid,text,jsonb) TO PUBLIC','REVOKE EXECUTE ON FUNCTION iiq.publish_report(uuid,text,jsonb) FROM PUBLIC','unsafe_database_custody'));
} finally {await database.close();await admin.end();}
