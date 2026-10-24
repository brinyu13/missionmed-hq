import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const host = process.env.D1_413_PGHOST || "127.0.0.1";
const port = process.env.D1_413_PGPORT || "55413";
const database = process.env.D1_413_PGDATABASE || "d1_413_primary";
const user = process.env.D1_413_PGUSER || process.env.USER || "brianb";
const output = process.env.D1_413_RLS_OUTPUT
  || "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/413/rls_matrix_413.json";

if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !database.startsWith('d1_413_')) {
  throw new Error("Refusing non-local or non-disposable PostgreSQL target");
}

const baseArgs = ["-h", host, "-p", port, "-U", user, "-d", database, "-v", "ON_ERROR_STOP=1", "-qAt"];
const results = [];
const grantId = "breakglass_grant_rls_413";
const grantorId = "platform_grantor_rls_413";
const artifactA = "artifact_rls_a_413";
const artifactB = "artifact_rls_b_413";
const exportA = "export_rls_a_413";

function sqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function rawSql(sql, { expectedFailure = false } = {}) {
  const started = performance.now();
  const run = spawnSync("psql", [...baseArgs, "-c", sql], { encoding: "utf8" });
  const value = {
    exitCode: run.status,
    stdout: (run.stdout || "").trim(),
    stderr: (run.stderr || "").trim(),
    durationMs: Number((performance.now() - started).toFixed(2)),
  };
  if (expectedFailure ? run.status === 0 : run.status !== 0) {
    throw new Error(`Unexpected SQL result: ${JSON.stringify(value)}`);
  }
  return value;
}

function runtimeSql(claims, sql, { expectedFailure = false, commit = false } = {}) {
  const wrapped = [
    "begin;",
    "set local role timeline_runtime_413;",
    `set local request.jwt.claims = '${sqlLiteral(JSON.stringify(claims))}';`,
    sql,
    commit ? "commit;" : "rollback;",
  ].join("\n");
  return rawSql(wrapped, { expectedFailure });
}

function claim(sub, role, programIds = [], extra = {}) {
  return { sub, timeline_role: role, program_ids: programIds, service_scopes: [], ...extra };
}

function check(name, operation, expected) {
  const started = performance.now();
  try {
    const run = operation();
    const actual = run.stdout.split("\n").filter(Boolean).at(-1) || "";
    const passed = expected instanceof RegExp ? expected.test(`${run.stderr}\n${actual}`) : actual === String(expected);
    results.push({ name, status: passed ? "PASS" : "FAIL", expected: String(expected), actual, durationMs: Number((performance.now() - started).toFixed(2)) });
  } catch (error) {
    results.push({ name, status: "FAIL", expected: String(expected), actual: error.message, durationMs: Number((performance.now() - started).toFixed(2)) });
  }
}

function cleanupFixtures() {
  rawSql(`
    delete from timeline.artifact_files where artifact_id in ('${artifactA}', '${artifactB}');
    delete from timeline.export_jobs where id = '${exportA}';
    delete from timeline.artifacts where id in ('${artifactA}', '${artifactB}');
    delete from timeline.audit_events where id = '${grantId}';
    delete from timeline.principals where id = '${grantorId}';
  `);
}

if (rawSql("select timeline.schema_version()").stdout !== "d1-timeline-db-413.2") {
  throw new Error("RLS matrix requires corrected schema version d1-timeline-db-413.2");
}
if (rawSql("select count(*) from timeline.documents where id in ('document_a','document_b')").stdout !== "2") {
  throw new Error("RLS matrix requires the disposable D1-413 seed");
}

cleanupFixtures();
rawSql(`insert into timeline.principals(id, matrix_wp_user_id, role, status) values ('${grantorId}', 413099, 'PLATFORM_ADMIN', 'ACTIVE')`);
const breakGlassExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const grantorClaims = claim(grantorId, "PLATFORM_ADMIN");
check("independent platform authority creates audited grant", () => runtimeSql(
  grantorClaims,
  `insert into timeline.audit_events(id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
   values ('${grantId}', '${grantorId}', 'BREAK_GLASS_GRANT', 'PRINCIPAL', 'platform_breakglass', 'ALLOW', 'request_grant_413',
     jsonb_build_object('subject_id', 'platform_breakglass', 'reason', 'incident-response', 'expires_at', '${breakGlassExpiry}'))
   returning id;`,
  { commit: true },
), grantId);

check("student owner reads own document", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 1);
check("student cannot read cross-student document", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "select count(*) from timeline.documents where id='document_b';"), 0);
check("unassigned same-program advisor denied", () => runtimeSql(claim("advisor_unassigned", "ADVISOR", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 0);
check("cross-program advisor denied", () => runtimeSql(claim("advisor_cross_program", "ADVISOR", ["program_b"]), "select count(*) from timeline.documents where id='document_a';"), 0);
check("assigned advisor reads assigned document", () => runtimeSql(claim("advisor_assigned", "ADVISOR", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 1);
check("program admin reads bounded program", () => runtimeSql(claim("program_admin_a", "PROGRAM_ADMIN", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 1);
check("program admin cannot read forged program", () => runtimeSql(claim("program_admin_a", "PROGRAM_ADMIN", ["program_a", "program_b"]), "select count(*) from timeline.documents where id='document_b';"), 0);
check("active faculty grant reads document", () => runtimeSql(claim("faculty_active", "FACULTY", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 1);
check("expired faculty grant denied", () => runtimeSql(claim("faculty_expired", "FACULTY", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 0);
check("service scope reads documents", () => runtimeSql(claim("service_export", "SERVICE", [], { service_scopes: ["document:read"] }), "select count(*) from timeline.documents where id in ('document_a','document_b');"), 2);
check("missing service scope denied", () => runtimeSql(claim("service_export", "SERVICE"), "select count(*) from timeline.documents where id='document_a';"), 0);
check("independently granted break glass reads", () => runtimeSql(claim("platform_breakglass", "PLATFORM_ADMIN", [], {
  break_glass_audit_id: grantId,
  break_glass_granted_by: grantorId,
  break_glass_reason: "incident-response",
  break_glass_expires_at: breakGlassExpiry,
}), "select count(*) from timeline.documents where id in ('document_a','document_b');"), 2);
check("forged grantor claim denied", () => runtimeSql(claim("platform_breakglass", "PLATFORM_ADMIN", [], {
  break_glass_audit_id: grantId,
  break_glass_granted_by: "platform_breakglass",
  break_glass_reason: "incident-response",
  break_glass_expires_at: breakGlassExpiry,
}), "select count(*) from timeline.documents where id='document_a';"), 0);
check("break glass without reason denied", () => runtimeSql(claim("platform_breakglass", "PLATFORM_ADMIN", [], {
  break_glass_audit_id: grantId,
  break_glass_granted_by: grantorId,
  break_glass_expires_at: breakGlassExpiry,
}), "select count(*) from timeline.documents where id='document_a';"), 0);
check("expired break glass denied", () => runtimeSql(claim("platform_breakglass", "PLATFORM_ADMIN", [], {
  break_glass_audit_id: grantId,
  break_glass_granted_by: grantorId,
  break_glass_reason: "incident-response",
  break_glass_expires_at: "2020-01-01T00:00:00.000Z",
}), "select count(*) from timeline.documents where id='document_a';"), 0);
check("caller cannot self-grant break glass", () => runtimeSql(
  claim("platform_breakglass", "PLATFORM_ADMIN"),
  `insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
   values ('self_grant_413','platform_breakglass','BREAK_GLASS_GRANT','PRINCIPAL','platform_breakglass','ALLOW','self_request',
     jsonb_build_object('subject_id','platform_breakglass','reason','self','expires_at','${breakGlassExpiry}'));`,
  { expectedFailure: true },
), /row-level security/i);
check("legacy self-auth ALLOW event denied", () => runtimeSql(
  claim("platform_breakglass", "PLATFORM_ADMIN"),
  `insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
   values ('legacy_self_allow_413','platform_breakglass','BREAK_GLASS_ACCESS','DOCUMENT_SET','*','ALLOW','self_request','{}');`,
  { expectedFailure: true },
), /row-level security/i);
check("forged role claim denied", () => runtimeSql(claim("student_a", "PROGRAM_ADMIN", ["program_a"]), "select count(*) from timeline.documents where id='document_a';"), 0);
check("forged program claim denied", () => runtimeSql(claim("program_admin_a", "PROGRAM_ADMIN", ["program_a", "program_b"]), "select count(*) from timeline.documents where id='document_b';"), 0);
check("anonymous claim denied", () => runtimeSql({}, "select count(*) from timeline.documents;"), 0);
check("suspended principal denied", () => runtimeSql(claim("student_suspended", "STUDENT", ["program_a"]), "select count(*) from timeline.documents where id='document_suspended';"), 0);
check("student sees shared comments only", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "select count(*) from timeline.comments where review_request_id='review_a1';"), 1);
check("assigned advisor sees advisor-only comments", () => runtimeSql(claim("advisor_assigned", "ADVISOR", ["program_a"]), "select count(*) from timeline.comments where review_request_id='review_a1';"), 2);
check("student cannot forge advisor comment role", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  "insert into timeline.comments(id,review_request_id,author_id,author_role,body_ciphertext,visibility) values ('forged_comment','review_a1','student_a','ADVISOR','ciphertext','SHARED');",
  { expectedFailure: true },
), /row-level security/i);
check("ordinary outbox insert returning succeeds", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  `insert into timeline.outbox_events(id,aggregate_id,event_type,payload_json,actor_id,document_id)
   values ('outbox_returning_413','document_a','timeline.document.versioned','{"documentId":"document_a"}','student_a','document_a') returning id;`,
), "outbox_returning_413");
check("ordinary audit insert returning succeeds", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  "insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id) values ('audit_returning_413','student_a','version:create','document','document_a','SUCCESS','request_413') returning id;",
), "audit_returning_413");
check("ordinary caller cannot enqueue unknown workflow event", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  `insert into timeline.outbox_events(id,aggregate_id,event_type,payload_json,actor_id,document_id)
   values ('outbox_forged_413','document_a','timeline.security.override','{"documentId":"document_a"}','student_a','document_a');`,
  { expectedFailure: true },
), /row-level security/i);
check("student object link isolation", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "select count(*) from timeline.media_objects where id='media_a';"), 1);
check("cross-student object link denied", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "select count(*) from timeline.media_objects where id='media_b';"), 0);
check("service cannot bind media owner to another student document", () => runtimeSql(
  claim("service_export", "SERVICE", [], { service_scopes: ["artifact:create"] }),
  "insert into timeline.media_objects(id,document_id,owner_principal_id,object_class,storage_key,mime_type,byte_size,content_sha256,visibility,status) values ('media_cross_owner_413','document_a','student_b','MEDIA','opaque/cross-owner-413','image/png',1,repeat('f',64),'STUDENT_ONLY','CONFIRMED'); set constraints all immediate;",
  { expectedFailure: true },
), /foreign key constraint/i);
check("approval event update immutable", () => runtimeSql(claim("advisor_assigned", "ADVISOR", ["program_a"]), "with changed as (update timeline.approval_events set reason='tampered' where id='approval_a1' returning 1) select count(*) from changed;"), 0);
check("approval event delete immutable", () => runtimeSql(claim("advisor_assigned", "ADVISOR", ["program_a"]), "with changed as (delete from timeline.approval_events where id='approval_a1' returning 1) select count(*) from changed;"), 0);
check("advisor cannot approve a forged content hash", () => runtimeSql(
  claim("advisor_assigned", "ADVISOR", ["program_a"]),
  `insert into timeline.approval_events(id,review_request_id,document_id,version_id,content_sha256,decision,actor_id,reason)
   values ('forged_approval','review_a1','document_a','version_a1',repeat('f',64),'APPROVED','advisor_assigned','forged');`,
  { expectedFailure: true },
), /row-level security/i);
check("student cannot forge owner on insert", () => runtimeSql(claim("student_a", "STUDENT", ["program_a"]), "insert into timeline.documents(id,owner_principal_id,program_id,schema_version,document_json) values ('forged_document','student_b','program_a','d1-timeline-document-409.1','{}');", { expectedFailure: true }), /row-level security/i);
check("student cannot insert into forged program", () => runtimeSql(claim("student_a", "STUDENT", ["program_a", "program_b"]), "insert into timeline.documents(id,owner_principal_id,program_id,schema_version,document_json) values ('forged_program_document','student_a','program_b','d1-timeline-document-409.1','{}');", { expectedFailure: true }), /row-level security/i);
check("public role has no schema access", () => rawSql("begin; set local role timeline_public_413; select count(*) from timeline.documents; rollback;", { expectedFailure: true }), /permission denied/i);
check("named version may preserve identical content hash", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  `insert into timeline.versions(id,document_id,revision,parent_version_id,label,snapshot_json,content_sha256,created_by)
   values ('version_a2_same_content','document_a',2,'version_a1','Named copy','{"id":"document_a","events":[]}',repeat('a',64),'student_a');
   select count(*) from timeline.versions where id='version_a2_same_content';`,
), 1);
check("document cannot point at another document version", () => runtimeSql(
  claim("student_a", "STUDENT", ["program_a"]),
  "update timeline.documents set current_version_id='version_b1' where id='document_a'; set constraints all immediate;",
  { expectedFailure: true },
), /foreign key constraint/i);

runtimeSql(claim("service_export", "SERVICE", [], { service_scopes: ["artifact:create"] }), `
  insert into timeline.artifacts(id,document_id,version_id,artifact_type,export_scope,manifest_json,content_sha256)
  values
    ('${artifactA}','document_a','version_a1','TIMELINE_SOURCE_JSON','SOURCE','{}',repeat('1',64)),
    ('${artifactB}','document_b','version_b1','TIMELINE_SOURCE_JSON','SOURCE','{}',repeat('2',64));
`, { commit: true });
runtimeSql(claim("student_a", "STUDENT", ["program_a"]), `
  insert into timeline.export_jobs(id,document_id,version_id,artifact_type,export_scope,renderer,status,requested_by,idempotency_key)
  values ('${exportA}','document_a','version_a1','TIMELINE_SOURCE_JSON','SOURCE','FIXTURE','QUEUED','student_a','export-rls-413');
`, { commit: true });
const artifactServiceClaims = claim("service_export", "SERVICE", [], { service_scopes: ["artifact:create", "document:read"] });
check("export accepts artifact bound to same document and version", () => runtimeSql(
  artifactServiceClaims,
  `update timeline.export_jobs set artifact_id='${artifactA}' where id='${exportA}'; set constraints all immediate; select artifact_id from timeline.export_jobs where id='${exportA}';`,
), artifactA);
check("export rejects artifact from another student document", () => runtimeSql(
  artifactServiceClaims,
  `update timeline.export_jobs set artifact_id='${artifactB}' where id='${exportA}'; set constraints all immediate;`,
  { expectedFailure: true },
), /foreign key constraint/i);
check("artifact file accepts object from same document", () => runtimeSql(
  artifactServiceClaims,
  `insert into timeline.artifact_files(artifact_id,document_id,version_id,role,object_id,filename,mime_type,byte_size,content_sha256)
   values ('${artifactA}','document_a','version_a1','PRIMARY','media_a','timeline.png','image/png',8,repeat('d',64));
   set constraints all immediate;
   select count(*) from timeline.artifact_files where artifact_id='${artifactA}';`,
), 1);
check("artifact file rejects object from another student document", () => runtimeSql(
  artifactServiceClaims,
  `insert into timeline.artifact_files(artifact_id,document_id,version_id,role,object_id,filename,mime_type,byte_size,content_sha256)
   values ('${artifactA}','document_a','version_a1','PRIMARY','media_b','timeline.png','image/png',8,repeat('e',64));
   set constraints all immediate;`,
  { expectedFailure: true },
), /foreign key constraint/i);
check("all protected tables enable RLS", () => rawSql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='timeline' and c.relkind='r' and c.relrowsecurity"), 19);
check("all protected tables force owner RLS", () => rawSql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='timeline' and c.relkind='r' and c.relforcerowsecurity"), 19);
check("runtime role is non-owner without bypass", () => rawSql("select count(*) from pg_roles r where r.rolname='timeline_runtime_413' and not r.rolsuper and not r.rolbypassrls and not r.rolcanlogin and not r.rolinherit"), 1);
check("schema version is explicit", () => rawSql("select timeline.schema_version()"), "d1-timeline-db-413.2");

cleanupFixtures();
check("RLS fixture cleanup leaves no rows", () => rawSql(`
  select
    (select count(*) from timeline.artifacts where id in ('${artifactA}','${artifactB}'))
    + (select count(*) from timeline.export_jobs where id='${exportA}')
    + (select count(*) from timeline.audit_events where id='${grantId}')
    + (select count(*) from timeline.principals where id='${grantorId}');
`), 0);

const summary = {
  total: results.length,
  passed: results.filter((result) => result.status === "PASS").length,
  failed: results.filter((result) => result.status === "FAIL").length,
};
const report = {
  schemaVersion: "d1-rls-matrix-413.2",
  generatedAt: new Date().toISOString(),
  target: { host, port: Number(port), database, disposable: true, runtimeRole: "timeline_runtime_413" },
  ownerConnectionUse: "fixture setup, semantic catalog inspection, and cleanup only",
  results,
  summary,
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n${output}\n`);
if (summary.failed > 0) process.exitCode = 1;
