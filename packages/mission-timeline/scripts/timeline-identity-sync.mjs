import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import pg from "pg";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const args = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.replace(/^--/, "").split("=");
  return [key, rest.join("=")];
}));
const mode = args.mode;
if (!new Set(["dry-run", "apply", "verify"]).has(mode)) throw new Error("MODE_MUST_BE_DRY_RUN_APPLY_OR_VERIFY");
if (!args.input) throw new Error("INPUT_REQUIRED");
if (mode === "apply" && !args["wp-plan-out"]) throw new Error("WP_PLAN_OUT_REQUIRED_FOR_APPLY");

const inputBytes = await readFile(args.input);
const input = JSON.parse(inputBytes.toString("utf8"));
if (input.schema_version !== "d1-411c-wp-identity-export.1" || input.course_id !== 3893 || !Array.isArray(input.records)) {
  throw new Error("IDENTITY_EXPORT_INVALID");
}

const seenWp = new Set();
const seenPrincipal = new Set();
for (const record of input.records) {
  if (!Number.isSafeInteger(record.wp_user_id) || record.wp_user_id < 1 || !UUID.test(record.timeline_principal_id)) {
    throw new Error("IDENTITY_RECORD_INVALID");
  }
  if (seenWp.has(record.wp_user_id) || seenPrincipal.has(record.timeline_principal_id)) throw new Error("IDENTITY_EXPORT_DUPLICATE");
  if (!new Set(["STUDENT", "PROGRAM_ADMIN"]).has(record.role)) throw new Error("IDENTITY_ROLE_INVALID");
  if (!(record.is_wordpress_administrator || record.has_learndash_3893_access)) throw new Error("IDENTITY_NOT_ELIGIBLE");
  if ((record.role === "PROGRAM_ADMIN") !== record.is_wordpress_administrator) throw new Error("IDENTITY_ROLE_CLAIM_MISMATCH");
  seenWp.add(record.wp_user_id);
  seenPrincipal.add(record.timeline_principal_id);
}

const required = (name, minimum = 1) => {
  const value = process.env[name]?.trim() ?? "";
  if (value.length < minimum) throw new Error(`${name}_REQUIRED`);
  return value;
};
const databaseUrl = required("DATABASE_URL");
const servicePrincipalId = required("TIMELINE_IDENTITY_SYNC_PRINCIPAL_ID");
if (!UUID.test(servicePrincipalId)) throw new Error("TIMELINE_IDENTITY_SYNC_PRINCIPAL_ID_INVALID");
const serviceWpUserId = Number(required("TIMELINE_IDENTITY_SYNC_WP_USER_ID"));
if (!Number.isSafeInteger(serviceWpUserId) || serviceWpUserId < 1) throw new Error("TIMELINE_IDENTITY_SYNC_WP_USER_ID_INVALID");
const runtimeRole = process.env.TIMELINE_IDENTITY_SYNC_ROLE?.trim() || "timeline_identity_sync";
if (!/^[a-z_][a-z0-9_]*$/.test(runtimeRole)) throw new Error("TIMELINE_IDENTITY_SYNC_ROLE_INVALID");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
const client = await pool.connect();
let transaction = false;
try {
  await client.query("BEGIN");
  transaction = true;
  await client.query("select pg_advisory_xact_lock(hashtext('missionmed:timeline:d1-411c:identity-sync'))");
  await client.query(`set local role ${runtimeRole}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({
    sub: servicePrincipalId,
    wp_user_id: serviceWpUserId,
    timeline_role: "SERVICE",
    program_ids: [],
    service_scopes: ["audit:read"],
  })]);
  const version = await client.query("select timeline.schema_version() as version");
  if (version.rows[0]?.version !== "d1-timeline-db-500.1") throw new Error("TIMELINE_SCHEMA_VERSION_MISMATCH");

  const principalIds = input.records.map((record) => record.timeline_principal_id);
  const wpUserIds = input.records.map((record) => record.wp_user_id);
  const existing = await client.query(
    `select id, wp_user_id, matrix_wp_user_id, role, status
     from timeline.principals
     where id = any($1::text[]) or wp_user_id = any($2::bigint[])`,
    [principalIds, wpUserIds],
  );
  const byId = new Map(existing.rows.map((row) => [row.id, row]));
  const byWp = new Map(existing.rows.map((row) => [Number(row.wp_user_id), row]));
  const classified = input.records.map((record) => {
    const idMatch = byId.get(record.timeline_principal_id);
    const wpMatch = byWp.get(record.wp_user_id);
    if (!idMatch && !wpMatch) return { state: "MISSING", record };
    if (
      idMatch && wpMatch && idMatch.id === wpMatch.id
      && Number(idMatch.wp_user_id) === record.wp_user_id
      && Number(idMatch.matrix_wp_user_id) === record.wp_user_id
      && idMatch.role === record.role
      && idMatch.status === "ACTIVE"
    ) return { state: "EXACT", record };
    return { state: "CONFLICT", record, existing: { by_id: idMatch ?? null, by_wp: wpMatch ?? null } };
  });
  const conflicts = classified.filter((item) => item.state === "CONFLICT");
  if (conflicts.length) throw new Error(`IDENTITY_CONFLICT:${JSON.stringify(conflicts)}`);
  if (mode === "verify" && classified.some((item) => item.state !== "EXACT")) throw new Error("IDENTITY_VERIFY_NOT_EXACT");

  if (mode === "apply") {
    for (const item of classified.filter((candidate) => candidate.state === "MISSING")) {
      const record = item.record;
      await client.query(
        `insert into timeline.principals (id, matrix_wp_user_id, wp_user_id, role, status)
         values ($1, $2, $2, $3, 'ACTIVE')`,
        [record.timeline_principal_id, record.wp_user_id, record.role],
      );
      for (const programId of [...new Set(record.program_ids ?? [])]) {
        await client.query(
          "insert into timeline.principal_programs (principal_id, program_id) values ($1, $2) on conflict do nothing",
          [record.timeline_principal_id, String(programId)],
        );
      }
      await client.query(
        `insert into timeline.audit_events
          (id, actor_id, action, resource_type, resource_id, outcome, request_id, metadata_json)
         values ($1, $2, 'PRINCIPAL_PROVISIONED', 'PRINCIPAL', $3, 'SUCCESS', $4, $5::jsonb)`,
        [
          `audit_${randomUUID()}`,
          servicePrincipalId,
          record.timeline_principal_id,
          `identity_sync_${randomUUID()}`,
          JSON.stringify({ wp_user_id: record.wp_user_id, role: record.role, course_id: 3893 }),
        ],
      );
    }
    await client.query("COMMIT");
    transaction = false;
    const plan = {
      schema_version: "d1-411c-wp-meta-plan.1",
      database_applied: true,
      source_sha256: createHash("sha256").update(inputBytes).digest("hex"),
      records: input.records.map(({ wp_user_id, timeline_principal_id }) => ({ wp_user_id, timeline_principal_id })),
    };
    const bytes = `${JSON.stringify(plan, null, 2)}\n`;
    await writeFile(args["wp-plan-out"], bytes, { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ ok: true, mode, exact: classified.filter((item) => item.state === "EXACT").length, inserted: classified.filter((item) => item.state === "MISSING").length, wp_plan_sha256: createHash("sha256").update(bytes).digest("hex") }));
  } else {
    await client.query("ROLLBACK");
    transaction = false;
    console.log(JSON.stringify({ ok: true, mode, exact: classified.filter((item) => item.state === "EXACT").length, missing: classified.filter((item) => item.state === "MISSING").length, conflicts: 0 }));
  }
} finally {
  if (transaction) await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
