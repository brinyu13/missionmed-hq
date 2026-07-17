import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = await mkdtemp(path.join(os.tmpdir(), "cie-postgres-"));
const data = path.join(directory, "data");
const socket = path.join(directory, "socket");
const port = 56000 + (process.pid % 1000);
const checks = [];
let started = false;

function run(command, args, options = {}) {
  const { expectFailure = false, label = null, ...spawnOptions } = options;
  const result = spawnSync(command, args, { encoding: "utf8", ...spawnOptions });
  if (expectFailure) {
    if (result.status === 0) throw new Error(`${label || command} unexpectedly succeeded`);
    checks.push({ name: label, status: "PASS", expected_failure: true });
    return result;
  }
  if (result.status !== 0) throw new Error(`${label || command} failed: ${(result.stderr || result.stdout || "").trim()}`);
  if (label) checks.push({ name: label, status: "PASS" });
  return result;
}

function psql(args, options = {}) {
  return run("psql", ["-X", "-h", socket, "-p", String(port), "-d", "postgres", ...args], options);
}

try {
  await mkdir(socket);
  run("initdb", ["-D", data, "-A", "trust", "--no-locale", "--encoding=UTF8"], { label: "postgres_init" });
  run("pg_ctl", ["-D", data, "-o", `-F -k ${socket} -p ${port} -c listen_addresses=''`, "-w", "start"], { label: "postgres_start", stdio: "ignore" });
  started = true;
  psql(["-v", "ON_ERROR_STOP=1", "-c", "create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key);"], { label: "supabase_stub" });
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(root, "migrations/20260717090000_y1_cie_c0_foundation.sql")], { label: "foundation_migration" });
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(root, "migrations/20260717091000_y1_cie_c0_runtime_integrity.sql")], { label: "integrity_migration" });

  const capabilityCount = Number(psql(["-Atqc", "select count(*) from cie.capability_registry"], { label: "capability_registry_count" }).stdout.trim());
  if (capabilityCount !== 8) throw new Error(`Expected 8 capabilities, found ${capabilityCount}`);
  const inactiveWrites = Number(psql(["-Atqc", "select count(*) from cie.capability_registry where activation_state='INACTIVE' and accepted_writes"], { label: "future_write_gate" }).stdout.trim());
  if (inactiveWrites !== 0) throw new Error("Inactive capability accepts writes");
  const forcedRls = Number(psql(["-Atqc", "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='cie' and c.relkind='r' and c.relforcerowsecurity"], { label: "forced_rls_inventory" }).stdout.trim());
  if (forcedRls !== 13) throw new Error(`Expected FORCE RLS on 13 tables, found ${forcedRls}`);

  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role authenticated; insert into cie.sessions(owner_user_id,external_session_ref,mode_ref,clock) values ('00000000-0000-0000-0000-000000000001','forbidden','M1','{}');"], { label: "authenticated_direct_dml_denied", expectFailure: true });

  const seed = `
    insert into auth.users(id) values
      ('00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000002');
    insert into cie.sessions(id,owner_user_id,external_session_ref,mode_ref,clock) values
      ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','session-a','M1','{}'),
      ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','session-b','M1','{}');
    insert into cie.track_items(
      track_item_id,item_revision,supersedes_item_revision,session_id,owner_user_id,segment_id,
      media_revision_ref,kind,range_kind,t0_ms,t1_ms,payload_schema_version,payload,provenance,
      author,visibility,content_hash,event_seq
    ) values (
      '30000000-0000-0000-0000-000000000003',1,null,
      '10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',
      'segment_1','media_1','event','POINT',0,0,'cie.event.v1','{}','{}','{}','private',repeat('a',64),1
    );
  `;
  psql(["-v", "ON_ERROR_STOP=1", "-c", seed], { label: "integrity_fixture_seed" });
  const drift = `insert into cie.track_items(
      track_item_id,item_revision,supersedes_item_revision,session_id,owner_user_id,segment_id,
      media_revision_ref,kind,range_kind,t0_ms,t1_ms,payload_schema_version,payload,provenance,
      author,visibility,content_hash,event_seq
    ) values (
      '30000000-0000-0000-0000-000000000003',2,1,
      '20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',
      'segment_2','media_2','event','POINT',0,0,'cie.event.v1','{}','{}','{}','private',repeat('b',64),1
    );`;
  psql(["-v", "ON_ERROR_STOP=1", "-c", drift], { label: "cross_owner_revision_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "update cie.track_items set payload='{\"changed\":true}' where track_item_id='30000000-0000-0000-0000-000000000003';"], { label: "append_only_update_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "insert into cie.deletion_jobs(session_id,owner_user_id,state,request_hash,idempotency_key,requested_at) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','COMPLETE',repeat('c',64),'invalid-complete',now());"], { label: "false_deletion_completion_denied", expectFailure: true });

  const evidence = {
    ticket: "Y1-CIE-C0-0001",
    status: "PASS",
    postgres: run("postgres", ["--version"]).stdout.trim(),
    capability_count: capabilityCount,
    inactive_capabilities_accepting_writes: inactiveWrites,
    force_rls_table_count: forcedRls,
    checks
  };
  if (process.env.CIE_EVIDENCE_PATH) await writeFile(process.env.CIE_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  await rm(directory, { recursive: true, force: true });
}
