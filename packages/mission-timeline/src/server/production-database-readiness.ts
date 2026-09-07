import type { PostgresPool, PostgresTransactionClient } from "../persistence/postgres/types.js";

async function inspectAs<T>(pool: PostgresPool, role: string, claims: Record<string, unknown>, inspect: (client: PostgresTransactionClient) => Promise<T>): Promise<T> {
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new TypeError("TIMELINE_RUNTIME_ROLE_INVALID");
  const client = await pool.connect(); let begun = false;
  try {
    await client.query("begin read only"); begun = true;
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims)]);
    await client.query("set local statement_timeout = '3500ms'");
    const result = await inspect(client);
    await client.query("commit"); begun = false; return result;
  } finally {
    if (begun) await client.query("rollback").catch(() => {});
    client.release();
  }
}

/** All startup observations run under the same explicit roles used by requests.
 * A NOINHERIT login needs no direct Timeline schema or table permissions. */
export async function assertProductionDatabaseReadiness(pool: PostgresPool, runtimeRole = "timeline_authenticated"): Promise<void> {
  await inspectAs(pool, runtimeRole, {}, async client => {
    const schema = await client.query<{ admin_grants_ready: boolean; standards_ready: boolean }>("select to_regclass('timeline.admin_resource_grants') is not null as admin_grants_ready, to_regclass('timeline.founder_standard_revisions') is not null and to_regclass('timeline.founder_standard_decisions') is not null as standards_ready");
    if (schema.rows[0]?.admin_grants_ready !== true) throw new Error("TIMELINE_PRODUCTION_SCHEMA_INCOMPLETE");
    if (schema.rows[0]?.standards_ready !== true) throw new Error("TIMELINE_FOUNDER_STANDARD_SCHEMA_INCOMPLETE");
  });
  await inspectAs(pool, "timeline_grant_authority", { sub: "timeline_admin_authority_022", timeline_role: "SERVICE", program_ids: [], service_scopes: ["audit:read"] }, async client => {
    const result = await client.query<{ ready: boolean }>("select exists(select 1 from timeline.principals where id='timeline_admin_authority_022' and wp_user_id=-22022 and role='SERVICE' and status='ACTIVE') as ready");
    if (result.rows[0]?.ready !== true) throw new Error("TIMELINE_ADMIN_AUTHORITY_INCOMPLETE");
  });
}

export async function readProductionDatabaseHealth(pool: PostgresPool, runtimeRole = "timeline_authenticated"): Promise<{ schemaVersion: string }> {
  return inspectAs(pool, runtimeRole, {}, async client => {
    const result = await client.query<{ schema_version: string }>("select timeline.schema_version() as schema_version");
    return { schemaVersion: String(result.rows[0]?.schema_version ?? "") };
  });
}
