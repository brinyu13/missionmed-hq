import { createHmac } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const MAX_POOL_SIZE = 8;
let sharedPool;

function requiredString(value, name, minimumLength = 1) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < minimumLength) throw new Error(`${name} is required`);
  return normalized;
}

export function buildDatabasePoolConfiguration({
  databaseUrl = process.env.RISE_DATABASE_URL,
  sslMode = process.env.RISE_DATABASE_SSL_MODE ?? "require",
} = {}) {
  const connectionString = requiredString(databaseUrl, "RISE_DATABASE_URL");
  const parsed = new URL(connectionString);
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password) {
    throw new Error("RISE_DATABASE_URL must be an authenticated PostgreSQL URL");
  }
  if (!new Set(["require", "disable"]).has(sslMode)) throw new Error("RISE_DATABASE_SSL_MODE must be require or disable");
  // pg-connection-string treats URL-level SSL options as authoritative and can
  // override the explicit Pool SSL object. RISE validates TLS independently,
  // so remove every query parameter before handing the URL to pg.
  parsed.search = "";
  return {
    connectionString: parsed.toString(),
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    application_name: "missionmed-rise",
    ssl: sslMode === "require" ? { rejectUnauthorized: false } : false,
  };
}

function databasePool(options = {}) {
  if (sharedPool) return sharedPool;
  sharedPool = new Pool(buildDatabasePoolConfiguration(options));
  sharedPool.on("error", () => {});
  return sharedPool;
}

function subjectKey(subject, key) {
  return createHmac("sha256", key)
    .update("rise-student-state-v1\0")
    .update(String(subject))
    .digest("hex");
}

async function withSubject(pool, key, operation) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('rise.subject_key', $1, true)", [key]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function createRiseStudentStore({
  pool = databasePool(),
  subjectHmacKey = process.env.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY,
} = {}) {
  const hmacKey = requiredString(subjectHmacKey, "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY", 32);
  await pool.query("SELECT 1 FROM rise_runtime.registry_releases LIMIT 1");
  return {
    scope: "durable_private",
    async list({ subject }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT program_specialty_id AS "programSpecialtyId", state, notes, updated_at AS "updatedAt"
          FROM rise_runtime.student_program_states
          WHERE subject_key = $1
          ORDER BY program_specialty_id
        `, [key]);
        return result.rows;
      });
    },
    async put({ subject, releaseId, programSpecialtyId, state, notes }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          INSERT INTO rise_runtime.student_program_states (
            subject_key, release_id, program_specialty_id, state, notes
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (subject_key, program_specialty_id) DO UPDATE SET
            release_id = EXCLUDED.release_id,
            state = EXCLUDED.state,
            notes = EXCLUDED.notes,
            updated_at = now()
          RETURNING program_specialty_id AS "programSpecialtyId", state, notes, updated_at AS "updatedAt"
        `, [key, releaseId, programSpecialtyId, state, notes]);
        return result.rows[0];
      });
    },
    async delete({ subject, programSpecialtyId }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          DELETE FROM rise_runtime.student_program_states
          WHERE subject_key = $1 AND program_specialty_id = $2
        `, [key, programSpecialtyId]);
        return result.rowCount > 0;
      });
    },
  };
}

async function consumeBudget(pool, key, cost, limit) {
  const result = await pool.query(`
    INSERT INTO rise_runtime.request_budget_windows (budget_key, window_start, request_cost)
    VALUES ($1, date_trunc('minute', now()), $2)
    ON CONFLICT (budget_key, window_start) DO UPDATE SET
      request_cost = rise_runtime.request_budget_windows.request_cost + EXCLUDED.request_cost
    RETURNING request_cost
  `, [key, cost]);
  return Number(result.rows[0].request_cost) <= limit;
}

export async function createRiseAbuseController({ pool = databasePool() } = {}) {
  await pool.query("SELECT 1 FROM rise_runtime.request_budget_windows LIMIT 1");
  return {
    scope: "shared_durable",
    async allowPreAuth({ cost = 1 }) {
      return consumeBudget(pool, "preauth:global", Math.max(1, Number(cost) || 1), 20_000);
    },
    async allowAuthenticatedSubject({ subjectKey: key, cost = 1 }) {
      if (!/^[a-f0-9]{32}$/.test(String(key))) return false;
      return consumeBudget(pool, `subject:${key}`, Math.max(1, Number(cost) || 1), 240);
    },
  };
}

export async function createRiseSourceRightsController({ pool = databasePool() } = {}) {
  await pool.query("SELECT 1 FROM rise_runtime.source_authorizations LIMIT 1");
  return {
    scope: "shared_durable_current",
    async assertCurrent({ registryReleaseId, authorizationSha256s }) {
      const expected = [...new Set((authorizationSha256s ?? []).map(String))].sort();
      const result = await pool.query(`
        SELECT a.authorization_sha256, a.decision_record_id
        FROM rise_runtime.registry_releases r
        JOIN rise_runtime.source_authorizations a ON a.release_id = r.release_id
        WHERE r.release_id = $1
          AND r.active = true
          AND a.revoked_at IS NULL
          AND a.valid_through >= current_date
        ORDER BY a.authorization_sha256
      `, [registryReleaseId]);
      const actual = result.rows.map((row) => row.authorization_sha256);
      if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) return false;
      return {
        current: true,
        decisionId: result.rows.map((row) => row.decision_record_id).join(","),
      };
    },
  };
}
