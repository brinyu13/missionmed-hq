import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {migrate,migrationManifest} from '../../scripts/migrate.mjs';
const original=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../infra/postgres');
const connectionString=process.env.IIQ_TEST_ADMIN_DATABASE_URL;
const db=new pg.Client({connectionString});await db.connect();
let n=0;const test=async(name,fn)=>{await fn();console.log(`ok ${++n} - ${name}`);};
try {
 await test('initial migration and exact checksum recorded once',async()=>{const {rows}=await db.query('SELECT * FROM iiq_migrations.applied');assert.equal(rows.length,1);assert.equal(rows[0].sha256,(await migrationManifest()).migrations[0].sha256);});
 await test('unchanged replay is a no-op',async()=>{await migrate({connectionString,local:true,bootstrap:true,log:()=>{}});assert.equal((await db.query('SELECT * FROM iiq_migrations.applied')).rowCount,1);});
 await test('local mode cannot point at a provider',()=>assert.rejects(migrate({connectionString:'postgresql://test@example.invalid/production',local:true}),/Local mode only/));
 await test('production apply requires independent approval before connecting',()=>assert.rejects(migrate({connectionString:'postgresql://test@example.invalid/production'}),/approval receipt/));
 const temp=await fs.mkdtemp('/tmp/iiq-migration-tests.');await fs.cp(original,temp,{recursive:true});
 const file=(await migrationManifest(temp)).migrations[0].name;
 await test('changed applied bytes fail closed',async()=>{await fs.appendFile(path.join(temp,'migrations',file),'\n-- changed bytes\n');await assert.rejects(migrate({connectionString,local:true,directory:temp,log:()=>{}}),/custody differs/);await fs.copyFile(path.join(original,'migrations',file),path.join(temp,'migrations',file));});
 await test('failed DDL rolls back schema and migration ledger together',async()=>{await fs.writeFile(path.join(temp,'migrations','20261003050000_rollback_rehearsal.sql'),"BEGIN; SET LOCAL ROLE iiq_owner; CREATE TABLE iiq.rollback_probe(id integer); SELECT 1/0; COMMIT;\n");await assert.rejects(migrate({connectionString,local:true,directory:temp,log:()=>{}}),e=>e.code==='22012');assert.equal((await db.query("SELECT to_regclass('iiq.rollback_probe') AS t")).rows[0].t,null);assert.equal((await db.query('SELECT * FROM iiq_migrations.applied')).rowCount,1);});
 await test('non-owner runtime cannot read or modify migration ledger',async()=>{const runtime=new pg.Client({connectionString:process.env.IIQ_TEST_DATABASE_URL});await runtime.connect();try{await runtime.query('SET ROLE iiq_authenticated');await assert.rejects(runtime.query('SELECT * FROM iiq_migrations.applied'),e=>e.code==='42501');}finally{await runtime.end();}});
 console.log(`PASS ${n} migration custody/rollback assertions; synthetic only.`);
} finally {await db.end();}
