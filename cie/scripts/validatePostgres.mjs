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
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(root, "migrations/20260717100000_y1_cie_c0_authority_proof.sql")], { label: "authority_proof_migration" });

  const capabilityCount = Number(psql(["-Atqc", "select count(*) from cie.capability_registry"], { label: "capability_registry_count" }).stdout.trim());
  if (capabilityCount !== 8) throw new Error(`Expected 8 capabilities, found ${capabilityCount}`);
  const inactiveWrites = Number(psql(["-Atqc", "select count(*) from cie.capability_registry where activation_state='INACTIVE' and accepted_writes"], { label: "future_write_gate" }).stdout.trim());
  if (inactiveWrites !== 0) throw new Error("Inactive capability accepts writes");
  const forcedRls = Number(psql(["-Atqc", "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='cie' and c.relkind='r' and c.relforcerowsecurity"], { label: "forced_rls_inventory" }).stdout.trim());
  if (forcedRls !== 14) throw new Error(`Expected FORCE RLS on 14 tables, found ${forcedRls}`);

  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role authenticated; insert into cie.sessions(owner_user_id,external_session_ref,mode_ref,clock) values ('00000000-0000-4000-8000-000000000001','forbidden','M1','{}');"], { label: "authenticated_direct_dml_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role authenticated; select cie.purge_session_artifacts_v1('40000000-0000-4000-8000-000000000004');"], { label: "authenticated_internal_command_denied", expectFailure: true });

  const sentinel = "SENSITIVE_DELETION_SENTINEL";
  const seed = `
    insert into auth.users(id) values
      ('00000000-0000-4000-8000-000000000001'),
      ('00000000-0000-4000-8000-000000000002'),
      ('00000000-0000-4000-8000-000000000003'),
      ('00000000-0000-4000-8000-000000000004');
    insert into cie.sessions(id,owner_user_id,external_session_ref,mode_ref,media_revision_ref,clock) values
      ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','${sentinel}','M1','media_1','{"sentinel":"${sentinel}"}'),
      ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','session-b','M1','media_2','{}');
    insert into cie.consent_receipts(
      id,session_id,owner_user_id,purpose,granted,authority_ref,authority_session_ref,policy_version,
      policy_text_hash,locale,retention_policy_ref,scope,recorded_at,receipt_revision
    ) values (
      '50000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      'evidence_storage',true,'fixture-authority','fixture-session','v1',repeat('a',64),'en-US','fixture-retention','{"sentinel":"${sentinel}"}',now(),1
    ),(
      '50000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      'mentor_sharing',true,'fixture-authority','fixture-session','v1',repeat('b',64),'en-US','fixture-retention','{}',now(),1
    );
    insert into cie.skill_snapshots(
      id,owner_user_id,skill_id,skill_version,publication_seq,full_card,render_subset,evidence_tier,source_authority,content_hash
    ) values (
      '60000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','CIE-D4-FIX-001','v1.0',1,'{}','{}','T1','{}',repeat('c',64)
    ),(
      '60000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','CIE-D4-FIX-002','v1.0',2,'{}','{}','T1','{}',repeat('6',64)
    );
    insert into cie.track_items(
      track_item_id,item_revision,supersedes_item_revision,session_id,owner_user_id,segment_id,media_revision_ref,
      kind,range_kind,t0_ms,t1_ms,payload_schema_version,payload,provenance,author,visibility,consent_receipt_ids,content_hash,event_seq
    ) values
      ('30000000-0000-4000-8000-000000000001',1,null,'10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','segment_1','media_1','moment','SPAN',100,200,'cie.moment.v1','{"sentinel":"${sentinel}"}','{}','{}','mentor',array['50000000-0000-4000-8000-000000000005'::uuid,'50000000-0000-4000-8000-000000000006'::uuid],repeat('d',64),1),
      ('30000000-0000-4000-8000-000000000002',1,null,'10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','segment_1','media_1','priority','POINT',0,0,'cie.priority.v1','{}','{}','{}','private',array['50000000-0000-4000-8000-000000000005'::uuid],repeat('e',64),2),
      ('30000000-0000-4000-8000-000000000003',1,null,'10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','segment_1','media_1','opportunity','SPAN',100,200,'cie.opportunity.v1','{"sentinel":"${sentinel}"}','{}','{}','mentor',array['50000000-0000-4000-8000-000000000005'::uuid,'50000000-0000-4000-8000-000000000006'::uuid],repeat('f',64),3);
    insert into cie.moments(
      id,session_id,owner_user_id,track_item_id,track_item_revision,segment_id,media_revision_ref,t0_ms,t1_ms,source,type,label,note,
      visibility,consent_receipt_ids,provenance,author,content_hash
    ) values (
      '70000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',1,'segment_1','media_1',100,200,'student','self-selected','Fixture','${sentinel}',
      'mentor',array['50000000-0000-4000-8000-000000000005'::uuid,'50000000-0000-4000-8000-000000000006'::uuid],'{}','{}',repeat('1',64)
    );
    insert into cie.session_priorities(
      session_id,owner_user_id,spotlight_snapshot_id,supporting_snapshot_id,spotlight_lifecycle,supporting_lifecycle,
      track_item_id,track_item_revision,consent_receipt_id,review_moment_id
    ) values (
      '10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000007','ACTIVE_SPOTLIGHT','CONSOLIDATING',
      '30000000-0000-4000-8000-000000000002',1,'50000000-0000-4000-8000-000000000005','70000000-0000-4000-8000-000000000007'
    );
    insert into cie.opportunities(
      id,session_id,owner_user_id,track_item_id,track_item_revision,segment_id,media_revision_ref,skill_snapshot_id,t0_ms,t1_ms,
      source,type,evidence_note,context,uncertainty,status,visibility,consent_receipt_ids,evidence_claim,coaching_claim,status_history,author,
      source_moment_id,reviewer,student_visible,content_hash
    ) values (
      '80000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000003',1,'segment_1','media_1','60000000-0000-4000-8000-000000000006',100,200,
      'mentor-manual','missed_clarifying_question','${sentinel}','{"sentinel":"${sentinel}"}','low','approved','mentor',
      array['50000000-0000-4000-8000-000000000005'::uuid,'50000000-0000-4000-8000-000000000006'::uuid],'{}','{}','[]','{}',
      '70000000-0000-4000-8000-000000000007','{}',false,repeat('2',64)
    );
    insert into cie.visibility_grants(
      id,session_id,owner_user_id,grantee_user_id,scope,authority_ref,authority_session_ref,issued_at,artifact_type,artifact_id,
      consent_receipt_id,row_version,content_hash
    ) values (
      '90000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000003','review','fixture-authority','fixture-session',now(),'moment','70000000-0000-4000-8000-000000000007',
      '50000000-0000-4000-8000-000000000006',1,repeat('3',64)
    );
    insert into cie.mutation_receipts(
      id,owner_user_id,session_id,operation,idempotency_key,request_hash,request_id,correlation_id,state,response
    ) values (
      'a0000000-0000-4000-8000-00000000000a','00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
      'create_moment','sentinel-receipt',repeat('4',64),'fixture-request','fixture-correlation','completed','{"sentinel":"${sentinel}"}'
    );
    insert into cie.deletion_jobs(id,session_id,owner_user_id,state,request_hash,idempotency_key,requested_at) values (
      '40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
      'TOMBSTONED',repeat('5',64),'fixture-delete',now()
    );
    insert into cie.deletion_steps(job_id,resource_class,state)
      select '40000000-0000-4000-8000-000000000004', resource_class, 'PENDING'
      from unnest(array['visibility_grants','opportunities','moments','track_items','session_priorities','consent_receipts','mutation_receipts','future_derived_artifacts','cam_media_revision','audit_finalization']) resource_class;
    update cie.sessions set state='DELETING',row_version=row_version+1 where id='10000000-0000-4000-8000-000000000001';
  `;
  psql(["-v", "ON_ERROR_STOP=1", "-c", seed], { label: "canonical_integrity_fixture_seed" });

  const crossOwnerMoment = `insert into cie.moments(
    id,session_id,owner_user_id,track_item_id,track_item_revision,segment_id,media_revision_ref,t0_ms,t1_ms,source,type,label,visibility,provenance,author,content_hash
  ) values (
    '71000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',1,'segment_1','media_1',100,200,'student','forged','Forged','private','{}','{}',repeat('9',64)
  );`;
  psql(["-v", "ON_ERROR_STOP=1", "-c", crossOwnerMoment], { label: "cross_owner_moment_track_binding_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "insert into cie.visibility_grants(id,session_id,owner_user_id,grantee_user_id,scope,authority_ref,authority_session_ref,issued_at,artifact_type,artifact_id,consent_receipt_id,content_hash) values ('91000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','review','fixture','fixture-session',now(),'session','10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000006',repeat('8',64));"], { label: "session_wide_grant_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "insert into cie.moments(id,session_id,owner_user_id,track_item_id,track_item_revision,segment_id,media_revision_ref,t0_ms,t1_ms,source,type,label,visibility,provenance,author,content_hash) values ('72000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'segment_1','media_1',110,190,'mentor','mentor-note','Forged mentor Moment','mentor','{}','{}',repeat('7',64));"], { label: "mentor_moment_without_review_source_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "update cie.session_priorities set supporting_snapshot_id=null,supporting_lifecycle=null where session_id='10000000-0000-4000-8000-000000000001';"], { label: "one_slot_priority_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "update cie.track_items set payload='{\"changed\":true}' where track_item_id='30000000-0000-4000-8000-000000000001';"], { label: "append_only_update_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "insert into cie.deletion_steps(job_id,resource_class,state,proof_hash,verified_at) values ('40000000-0000-4000-8000-000000000004','forged_audit','VERIFIED_PRESERVED',repeat('e',64),now());"], { label: "preserved_non_audit_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select set_config('cie.deletion_session_id','10000000-0000-4000-8000-000000000001',true); delete from cie.moments where session_id='10000000-0000-4000-8000-000000000001';"], { label: "executor_guc_dml_bypass_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000004','cam_media_revision',repeat('8',64),repeat('a',64),'fixture-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes');"], { label: "executor_attestation_registration_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_verifier; select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004','unsupported_class',repeat('8',64),repeat('b',64),'fixture-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes');"], { label: "wrong_attestation_class_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_verifier; select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000003','4fffffff-0000-4000-8000-000000000004','cam_media_revision',repeat('8',64),repeat('c',64),'fixture-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes');"], { label: "wrong_attestation_job_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_verifier; select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','cam_media_revision',repeat('8',64),repeat('d',64),'fixture-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()-interval '1 second');"], { label: "expired_attestation_denied", expectFailure: true });

  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.purge_session_artifacts_v1('40000000-0000-4000-8000-000000000004');"], { label: "sql_deletion_purge_command" });
  const residualBeforeFinalize = Number(psql(["-Atqc", `select
    (select count(*) from cie.moments where session_id='10000000-0000-4000-8000-000000000001') +
    (select count(*) from cie.opportunities where session_id='10000000-0000-4000-8000-000000000001') +
    (select count(*) from cie.track_items where session_id='10000000-0000-4000-8000-000000000001') +
    (select count(*) from cie.consent_receipts where session_id='10000000-0000-4000-8000-000000000001') +
    (select count(*) from cie.mutation_receipts where session_id='10000000-0000-4000-8000-000000000001' and response is not null)`], { label: "sql_local_absence_scan" }).stdout.trim());
  if (residualBeforeFinalize !== 0) throw new Error(`CIE local deletion left ${residualBeforeFinalize} sensitive rows`);
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_verifier; select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000004','cam_media_revision',repeat('8',64),repeat('a',64),'fixture-deletion-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes'); select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000011','40000000-0000-4000-8000-000000000004','audit_finalization',repeat('9',64),repeat('b',64),'fixture-deletion-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes'); select cie.register_deletion_attestation_v1('c0000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000004','audit_finalization',repeat('9',64),repeat('c',64),'different-verifier','fixture-authority-session','00000000-0000-4000-8000-000000000004',now()+interval '5 minutes');"], { label: "trusted_attestation_registration" });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','cfffffff-0000-4000-8000-000000000010','cfffffff-0000-4000-8000-000000000011','b0000000-0000-4000-8000-00000000000b','fixture-finalize','fixture-correlation');"], { label: "unattested_finalize_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000011','c0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-00000000000b','fixture-finalize','fixture-correlation');"], { label: "wrong_attestation_resource_binding_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000012','b0000000-0000-4000-8000-00000000000b','fixture-finalize','fixture-correlation');"], { label: "mismatched_attestation_authority_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "insert into cie.deletion_steps(job_id,resource_class,state) values ('40000000-0000-4000-8000-000000000004','unexpected_resource','PENDING');"], { label: "unexpected_deletion_resource_fixture" });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-00000000000b','fixture-finalize','fixture-correlation');"], { label: "unexpected_deletion_resource_denied", expectFailure: true });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "delete from cie.deletion_steps where job_id='40000000-0000-4000-8000-000000000004' and resource_class='unexpected_resource';"], { label: "unexpected_deletion_resource_cleanup" });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select (cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-00000000000b','fixture-finalize','fixture-correlation')).state;"], { label: "sql_deletion_finalize_command" });
  psql(["-v", "ON_ERROR_STOP=1", "-c", "set role cie_deletion_executor; select cie.finalize_session_deletion_v1('40000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000010','c0000000-0000-4000-8000-000000000011','b1000000-0000-4000-8000-00000000000b','fixture-replay','fixture-correlation');"], { label: "consumed_attestation_replay_denied", expectFailure: true });

  const consumedAttestations = Number(psql(["-Atqc", "select count(*) from cie.deletion_attestations where job_id='40000000-0000-4000-8000-000000000004' and consumed_at is not null"], { label: "attestation_consumption_verified" }).stdout.trim());
  if (consumedAttestations !== 2) throw new Error(`Expected two consumed attestations, found ${consumedAttestations}`);
  const auditActor = psql(["-Atqc", "select actor_user_id from cie.audit_events where id='b0000000-0000-4000-8000-00000000000b'"], { label: "trusted_worker_audit_actor" }).stdout.trim();
  if (auditActor !== "00000000-0000-4000-8000-000000000004") throw new Error(`Deletion audit actor was misattributed: ${auditActor}`);

  const sentinelMatches = Number(psql(["-Atqc", `select
    (select count(*) from cie.sessions where row_to_json(sessions)::text like '%${sentinel}%') +
    (select count(*) from cie.mutation_receipts where row_to_json(mutation_receipts)::text like '%${sentinel}%') +
    (select count(*) from cie.audit_events where row_to_json(audit_events)::text like '%${sentinel}%')`], { label: "sql_full_sentinel_scan" }).stdout.trim());
  if (sentinelMatches !== 0) throw new Error(`CIE deletion retained ${sentinelMatches} sentinel copies`);
  const terminalState = psql(["-Atqc", "select s.state||':'||j.state||':'||(s.clock is null)::text||':'||(s.external_session_ref is null)::text from cie.sessions s join cie.deletion_jobs j on j.session_id=s.id where s.id='10000000-0000-4000-8000-000000000001'"], { label: "sql_terminal_deletion_state" }).stdout.trim();
  if (terminalState !== "DELETED:COMPLETE:true:true") throw new Error(`Unexpected terminal deletion state: ${terminalState}`);

  const evidence = {
    ticket: "Y1-CIE-C0-0001",
    status: "PASS",
    postgres: run("postgres", ["--version"]).stdout.trim(),
    capability_count: capabilityCount,
    inactive_capabilities_accepting_writes: inactiveWrites,
    force_rls_table_count: forcedRls,
    consumed_attestation_count: consumedAttestations,
    deletion_audit_actor: auditActor,
    sentinel_matches_after_deletion: sentinelMatches,
    checks
  };
  if (process.env.CIE_EVIDENCE_PATH) await writeFile(process.env.CIE_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { stdio: "ignore" });
  await rm(directory, { recursive: true, force: true });
}
