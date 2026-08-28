import { createHmac } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const MAX_POOL_SIZE = 8;
const BETA_NOTICE_VERSION = "rise-private-beta-notice-2026-08-28";
const INTEL_STATUSES = [
  "STUDENT_REPORT", "VERIFICATION_PENDING", "VERIFIED_BY_MISSIONMED", "PARTIALLY_VERIFIED",
  "COULD_NOT_VERIFY", "CONFLICTING", "OUTDATED", "REJECTED_HIDDEN",
];
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

async function withSubject(pool, key, operation, { isAdmin = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('rise.subject_key', $1, true)", [key]);
    await client.query("SELECT set_config('rise.is_admin', $1, true)", [isAdmin ? "true" : "false"]);
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

const PUBLIC_INTEL_PROJECTION = `
  s.submission_id AS "submissionId",
  s.program_specialty_id AS "programSpecialtyId",
  s.category,
  s.display_claim AS claim,
  s.observed_on::text AS "observedOn",
  s.created_at AS "submittedAt",
  s.status,
  CASE WHEN s.anonymous_to_students THEN 'Anonymous MissionMed Student' ELSE s.public_contributor_name END AS contributor,
  s.public_admin_notation AS "adminNotation",
  s.featured,
  s.high_priority AS "highPriority",
  s.corroboration_count AS "corroborationCount",
  src.source
`;

const ADMIN_INTEL_PROJECTION = `
  ${PUBLIC_INTEL_PROJECTION},
  s.original_claim AS "originalClaim",
  s.context_notes AS "contextNotes",
  ident.subject_ref AS "submitterSubject",
  ident.display_name AS "submitterDisplayName",
  s.anonymous_to_students AS "anonymousToStudents",
  s.visible,
  s.moderation_locked AS "moderationLocked",
  s.deleted_at AS "deletedAt",
  s.last_verification_attempt_at AS "lastVerificationAttemptAt",
  s.next_eligible_verification_at AS "nextEligibleVerificationAt"
`;

const INTEL_PROJECTION_JOINS = `
  LEFT JOIN rise_runtime.student_intel_submitter_identities ident
    ON ident.subject_key = s.submitter_subject_key
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object(
      'kind', source_kind,
      'url', source_url,
      'label', source_label
    ) AS source
    FROM rise_runtime.student_intel_sources
    WHERE submission_id = s.submission_id
    ORDER BY created_at, source_id
    LIMIT 1
  ) src ON true
`;

async function readIntelRecord(client, submissionId, { admin = false } = {}) {
  const result = await client.query(`
    SELECT ${admin ? ADMIN_INTEL_PROJECTION : PUBLIC_INTEL_PROJECTION}
    FROM rise_runtime.student_intel_submissions s
    ${INTEL_PROJECTION_JOINS}
    WHERE s.submission_id = $1
  `, [submissionId]);
  return result.rows[0] ?? null;
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

export async function createRiseStudentIntelStore({
  pool = databasePool(),
  subjectHmacKey = process.env.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY,
} = {}) {
  const hmacKey = requiredString(subjectHmacKey, "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY", 32);
  await pool.query("SELECT 1 FROM rise_runtime.student_intel_submissions LIMIT 1");
  return {
    scope: "durable_private",
    canonicalPromotionMode: "staging_only",
    async betaNotice({ subject }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT notice_version AS version
          FROM rise_runtime.beta_notice_acknowledgments
          WHERE subject_key = $1 AND notice_version = $2
        `, [key, BETA_NOTICE_VERSION]);
        return { version: BETA_NOTICE_VERSION, acknowledged: result.rowCount === 1 };
      });
    },
    async acknowledgeBetaNotice({ subject }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        await client.query(`
          INSERT INTO rise_runtime.beta_notice_acknowledgments (subject_key, notice_version)
          VALUES ($1, $2)
          ON CONFLICT (subject_key) DO UPDATE SET
            notice_version = EXCLUDED.notice_version,
            acknowledged_at = now()
        `, [key, BETA_NOTICE_VERSION]);
        return { version: BETA_NOTICE_VERSION, acknowledged: true };
      });
    },
    async listProgram({ subject, isAdmin, programSpecialtyId }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT ${isAdmin ? ADMIN_INTEL_PROJECTION : PUBLIC_INTEL_PROJECTION}
          FROM rise_runtime.student_intel_submissions s
          ${INTEL_PROJECTION_JOINS}
          WHERE s.program_specialty_id = $1
          ORDER BY s.featured DESC, s.created_at DESC, s.submission_id
        `, [programSpecialtyId]);
        return result.rows;
      }, { isAdmin });
    },
    async submit({ subject, displayName, releaseId, programSpecialtyId, input }) {
      const key = subjectKey(subject, hmacKey);
      const safeDisplayName = requiredString(displayName || "MissionMed Student", "submitter display name").slice(0, 120);
      return withSubject(pool, key, async (client) => {
        await client.query(`
          INSERT INTO rise_runtime.student_intel_submitter_identities (
            subject_key, subject_ref, display_name
          ) VALUES ($1, $2, $3)
          ON CONFLICT (subject_key) DO UPDATE SET
            subject_ref = EXCLUDED.subject_ref,
            display_name = EXCLUDED.display_name,
            updated_at = now()
        `, [key, requiredString(subject, "submitter subject").slice(0, 256), safeDisplayName]);
        const inserted = await client.query(`
          INSERT INTO rise_runtime.student_intel_submissions (
            release_id, program_specialty_id, submitter_subject_key,
            public_contributor_name, anonymous_to_students, category,
            original_claim, display_claim, context_notes, observed_on, high_priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
          RETURNING submission_id
        `, [
          releaseId, programSpecialtyId, key, input.anonymousToStudents ? null : safeDisplayName,
          input.anonymousToStudents, input.category, input.claim, input.contextNotes,
          input.observedOn, input.highPriority,
        ]);
        const submissionId = inserted.rows[0].submission_id;
        await client.query(`
          INSERT INTO rise_runtime.student_intel_sources (
            submission_id, source_kind, source_url, source_label
          ) VALUES ($1, $2, $3, $4)
        `, [submissionId, input.source.kind, input.source.url, input.source.label]);
        return readIntelRecord(client, submissionId);
      });
    },
    async corroborate({ subject, submissionId }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const visible = await client.query(`
          SELECT submitter_subject_key, corroboration_count
          FROM rise_runtime.student_intel_submissions
          WHERE submission_id = $1 AND visible = true AND deleted_at IS NULL AND status <> 'REJECTED_HIDDEN'
        `, [submissionId]);
        if (!visible.rowCount) return null;
        if (visible.rows[0].submitter_subject_key === key) {
          return { submissionId, corroborationCount: visible.rows[0].corroboration_count };
        }
        await client.query(`
            INSERT INTO rise_runtime.student_intel_corroborations (submission_id, corroborator_subject_key)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [submissionId, key]);
        const count = await client.query(`
          SELECT corroboration_count AS count
          FROM rise_runtime.student_intel_submissions
          WHERE submission_id = $1
        `, [submissionId]);
        return { submissionId, corroborationCount: count.rows[0].count };
      });
    },
    async adminList({ subject = "rise-admin" } = {}) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT ${ADMIN_INTEL_PROJECTION}
          FROM rise_runtime.student_intel_submissions s
          ${INTEL_PROJECTION_JOINS}
          ORDER BY s.created_at DESC, s.submission_id
        `);
        return result.rows;
      }, { isAdmin: true });
    },
    async moderate({ actorSubject, submissionId, action, input }) {
      const key = subjectKey(actorSubject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const locked = await client.query(`
          SELECT submission_id
          FROM rise_runtime.student_intel_submissions
          WHERE submission_id = $1
          FOR UPDATE
        `, [submissionId]);
        if (!locked.rowCount) return null;
        const before = await readIntelRecord(client, submissionId, { admin: true });
        if (action === "PROMOTE_CANONICAL" && before.status !== "VERIFIED_BY_MISSIONMED") {
          const error = new Error("Only MissionMed-verified Student Intel may be promoted");
          error.code = "INTEL_PROMOTION_NOT_VERIFIED";
          throw error;
        }
        await client.query(`
          UPDATE rise_runtime.student_intel_submissions SET
            display_claim = CASE WHEN $2 = 'EDIT_DISPLAY' THEN $3 ELSE display_claim END,
            public_admin_notation = CASE WHEN $2 = 'ANNOTATE' THEN $4 ELSE public_admin_notation END,
            featured = CASE WHEN $2 = 'FEATURE' THEN $5 ELSE featured END,
            visible = CASE WHEN $2 IN ('HIDE', 'REJECT', 'DELETE') THEN false WHEN $2 = 'UNHIDE' THEN true ELSE visible END,
            moderation_locked = CASE WHEN $2 IN ('REQUEST_CLARIFICATION', 'REJECT', 'DELETE') THEN true ELSE moderation_locked END,
            status = CASE
              WHEN $2 = 'UNHIDE' AND status = 'REJECTED_HIDDEN' THEN 'VERIFICATION_PENDING'
              WHEN $2 IN ('REJECT', 'DELETE') THEN 'REJECTED_HIDDEN'
              WHEN $2 = 'MARK_OUTDATED' THEN 'OUTDATED'
              WHEN $2 = 'MARK_CONFLICTING' THEN 'CONFLICTING'
              WHEN $2 = 'MARK_VERIFIED' THEN 'VERIFIED_BY_MISSIONMED'
              WHEN $2 = 'MARK_PARTIAL' THEN 'PARTIALLY_VERIFIED'
              WHEN $2 = 'COULD_NOT_VERIFY' THEN 'COULD_NOT_VERIFY'
              WHEN $2 = 'SEND_TO_VERIFICATION' THEN 'VERIFICATION_PENDING'
              ELSE status
            END,
            last_verification_attempt_at = CASE
              WHEN $2 IN ('MARK_VERIFIED', 'MARK_PARTIAL', 'COULD_NOT_VERIFY', 'MARK_CONFLICTING') THEN now()
              ELSE last_verification_attempt_at
            END,
            deleted_at = CASE WHEN $2 = 'DELETE' THEN now() ELSE deleted_at END,
            updated_at = now()
          WHERE submission_id = $1
        `, [submissionId, action, input.displayClaim, input.adminNotation, input.featured !== false]);
        if (action === "PROMOTE_CANONICAL") {
          await client.query(`
            INSERT INTO rise_runtime.student_intel_canonical_promotions (
              submission_id, canonical_field, canonical_value, source_url, verified_at,
              verification_method, provenance, actor_subject_ref, conflict_state
            ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8, 'NONE')
          `, [
            submissionId, input.canonicalField, JSON.stringify(input.canonicalValue), before.source?.url ?? null,
            before.lastVerificationAttemptAt ?? new Date().toISOString(), "explicit_missionmed_admin_promotion",
            JSON.stringify({ studentIntelSubmissionId: submissionId, originalClaimPreserved: true }),
            requiredString(actorSubject, "actor subject").slice(0, 256),
          ]);
        }
        const after = await readIntelRecord(client, submissionId, { admin: true });
        await client.query(`
          INSERT INTO rise_runtime.student_intel_moderation_events (
            submission_id, actor_subject_ref, action, reason, before_state, after_state
          ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        `, [
          submissionId, requiredString(actorSubject, "actor subject").slice(0, 256), action, input.reason,
          JSON.stringify(before), JSON.stringify(after),
        ]);
        return after;
      }, { isAdmin: true });
    },
    async audit({ subject = "rise-admin", submissionId }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT event_id AS "eventId", submission_id AS "submissionId",
                 actor_subject_ref AS "actorSubject", action, reason,
                 before_state AS before, after_state AS after, created_at AS "createdAt"
          FROM rise_runtime.student_intel_moderation_events
          WHERE submission_id = $1
          ORDER BY event_id
        `, [submissionId]);
        return result.rows;
      }, { isAdmin: true });
    },
    async analytics({ subject = "rise-admin" } = {}) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT status, count(*)::integer AS count
          FROM rise_runtime.student_intel_submissions
          GROUP BY status
        `);
        const counts = Object.fromEntries(INTEL_STATUSES.map((status) => [status, 0]));
        for (const row of result.rows) counts[row.status] = row.count;
        const totals = await client.query(`
          SELECT count(*)::integer AS total,
                 count(*) FILTER (WHERE created_at >= now() - interval '7 days')::integer AS "newThisWeek",
                 count(*) FILTER (WHERE high_priority = true AND deleted_at IS NULL)::integer AS "highPriority"
          FROM rise_runtime.student_intel_submissions
        `);
        const spend = await client.query(`
          SELECT COALESCE(sum(actual_cost), 0)::float8 AS cost,
                 count(*) FILTER (WHERE status = 'INGESTED')::integer AS ingested,
                 count(*) FILTER (WHERE status IN ('INGESTED', 'NEEDS_REVIEW', 'PARTIAL', 'FAILED'))::integer AS completed
          FROM rise_runtime.student_intel_verification_runs
        `);
        const completed = spend.rows[0].completed;
        const topPrograms = await client.query(`
          SELECT program_specialty_id AS "programSpecialtyId", count(*)::integer AS count
          FROM rise_runtime.student_intel_submissions
          GROUP BY program_specialty_id
          ORDER BY count DESC, program_specialty_id
          LIMIT 5
        `);
        const topCategories = await client.query(`
          SELECT category, count(*)::integer AS count
          FROM rise_runtime.student_intel_submissions
          GROUP BY category
          ORDER BY count DESC, category
          LIMIT 5
        `);
        return {
          ...totals.rows[0], counts, verificationCost: spend.rows[0].cost,
          verificationYield: completed ? spend.rows[0].ingested / completed : null,
          topPrograms: topPrograms.rows, topCategories: topCategories.rows,
        };
      }, { isAdmin: true });
    },
    async verificationPreview({ subject = "rise-admin" } = {}) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT ${ADMIN_INTEL_PROJECTION}
          FROM rise_runtime.student_intel_submissions s
          ${INTEL_PROJECTION_JOINS}
          WHERE s.status IN ('VERIFICATION_PENDING', 'CONFLICTING')
            AND s.deleted_at IS NULL
            AND (s.next_eligible_verification_at IS NULL OR s.next_eligible_verification_at <= now())
          ORDER BY s.high_priority DESC, s.created_at, s.submission_id
        `);
        return {
          connected: false,
          budgetStatus: "UNAVAILABLE",
          paidSubmissionAuthorized: false,
          taskClass: "RISE_STUDENT_INTEL_CLAIM_VERIFICATION",
          queueClasses: ["HIGH_PRIORITY", "TWICE_MONTHLY"],
          cadence: { timezone: "America/New_York", daysOfMonth: [1, 15], active: false },
          selectedProduct: null,
          selectedProcessor: null,
          submissions: result.rows,
          estimatedCost: null,
          routerPolicy: "P1-RISE-PARALLEL-COST-QUALITY-OPTIMIZATION-007",
          suppliedUrlFirst: true,
        };
      }, { isAdmin: true });
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
