import { createHash, createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import {
  evaluateResearchEligibility,
  normalizeProviderRoute,
  normalizeResearchControls,
  publicResearchControls,
  researchDedupeKey,
} from "../src/research-router.mjs";

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

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function stableDatabaseId(prefix, value) {
  return `${prefix}_${sha256(value).slice(0, 32)}`;
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
  // FK to registry_programs was dropped 2026-09-01 (rise_app_runtime lacks ALTER TABLE).
  // Server validates program existence via byProgramSpecialtyId before any write.
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
  await pool.query("SELECT 1 FROM rise_runtime.canonical_evidence_claims LIMIT 1");
  return {
    scope: "durable_private",
    canonicalPromotionMode: "live",
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
          const sourceId = stableDatabaseId("rise_src", `STUDENT_INTEL:${submissionId}`);
          const claimCanonical = {
            subjectId: before.programSpecialtyId,
            field: input.canonicalField,
            value: input.canonicalValue,
            provider: "STUDENT_INTEL",
            providerRunId: submissionId,
            sourceType: "verified_student_intel_promotion",
            sourceUrl: before.source?.url ?? null,
            retrievedAt: before.lastVerificationAttemptAt ?? new Date().toISOString(),
            publicationState: "PRIVATE_BETA",
            reviewState: "APPROVED",
          };
          const contentSha256 = sha256(claimCanonical);
          await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_sources (
              source_id, provider, provider_run_id, source_type, source_url,
              retrieved_at, rights_state, exposure_state, metadata
            ) VALUES ($1, 'STUDENT_INTEL', $2, 'verified_student_intel_promotion', $3, $4, 'APPROVED', 'PRIVATE_BETA', $5::jsonb)
            ON CONFLICT (source_id) DO NOTHING
          `, [
            sourceId, submissionId, before.source?.url ?? null,
            before.lastVerificationAttemptAt ?? new Date().toISOString(),
            JSON.stringify({ studentIntelSubmissionId: submissionId, originalClaimPreserved: true }),
          ]);
          await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_claims (
              claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
              publication_state, review_state, conflict_state, source_id, source_locator,
              observed_period, retrieved_at, content_sha256
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'missionmed_verified',
                      'PRIVATE_BETA', 'APPROVED', 'NONE', $6, $7, $8::jsonb, $9, $10)
            ON CONFLICT (content_sha256) DO NOTHING
          `, [
            stableDatabaseId("rise_claim", contentSha256), before.programSpecialtyId, input.canonicalField,
            JSON.stringify({ state: "known", value: input.canonicalValue }), JSON.stringify(input.canonicalValue),
            sourceId, before.source?.url ?? null,
            JSON.stringify({ kind: "student_observation", observedOn: before.observedOn }),
            before.lastVerificationAttemptAt ?? new Date().toISOString(), contentSha256,
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

export async function createRiseFilterIntelligenceStore({
  pool = databasePool(),
  cacheTtlMs = 30_000,
} = {}) {
  await pool.query("SELECT 1 FROM rise_runtime.canonical_evidence_claims LIMIT 1");
  await pool.query("SELECT 1 FROM rise_runtime.canonical_current_facts LIMIT 1");
  const systemKey = "0".repeat(64);
  let cached = null;
  let cachedAt = 0;
  return {
    scope: "durable_canonical_projection",
    async read() {
      const now = Date.now();
      if (cached && now - cachedAt < cacheTtlMs) return structuredClone(cached);
      try {
        const result = await withSubject(pool, systemKey, async (client) => {
          const [coverage, facts] = await Promise.all([
            client.query(`
              SELECT
                s.metadata->>'acgmeId' AS "acgmeId",
                array_agg(DISTINCT c.field ORDER BY c.field)
                  FILTER (WHERE c.review_state = 'APPROVED'
                    AND c.conflict_state <> 'CONFLICTING'
                    AND c.publication_state IN ('STUDENT_VISIBLE', 'PRIVATE_BETA')) AS fields,
                array_agg(DISTINCT c.field ORDER BY c.field)
                  FILTER (WHERE c.review_state <> 'APPROVED'
                    OR c.conflict_state = 'CONFLICTING'
                    OR c.publication_state NOT IN ('STUDENT_VISIBLE', 'PRIVATE_BETA')) AS "pendingFields",
                count(*)::integer AS "claimCount"
              FROM rise_runtime.canonical_evidence_sources s
              JOIN rise_runtime.canonical_evidence_claims c USING (source_id)
              WHERE s.source_type = 'completed_research_factory'
                AND s.metadata->>'acgmeId' ~ '^[0-9]{10}$'
              GROUP BY s.metadata->>'acgmeId'
              ORDER BY s.metadata->>'acgmeId'
            `),
            client.query(`
              SELECT
                subject_id AS "subjectId",
                s.metadata->>'acgmeId' AS "acgmeId",
                field,
                knowledge,
                canonical_value AS "canonicalValue",
                f.publication_state AS "publicationState",
                f.retrieved_at AS "retrievedAt",
                s.provider,
                s.source_url AS "sourceUrl",
                s.source_locator AS "sourceLocator"
              FROM rise_runtime.canonical_current_facts f
              JOIN rise_runtime.canonical_evidence_sources s USING (source_id)
              ORDER BY subject_id, field
            `),
          ]);
          return {
            researchCoverage: coverage.rows.map((row) => ({
              ...row,
              fields: row.fields ?? [],
              pendingFields: row.pendingFields ?? [],
            })),
            currentFacts: facts.rows,
          };
        }, { isAdmin: true });
        cached = result;
        cachedAt = now;
        return structuredClone(result);
      } catch (error) {
        if (cached) return structuredClone(cached);
        throw error;
      }
    },
    async readProgram({ programId, acgmeId }) {
      return withSubject(pool, systemKey, async (client) => {
        const [facts, pending] = await Promise.all([
          client.query(`
            SELECT
              f.subject_id AS "subjectId",
              s.metadata->>'acgmeId' AS "acgmeId",
              f.field,
              f.knowledge,
              f.canonical_value AS "canonicalValue",
              f.publication_state AS "publicationState",
              f.retrieved_at AS "retrievedAt",
              s.provider,
              s.source_url AS "sourceUrl",
              s.source_locator AS "sourceLocator"
            FROM rise_runtime.canonical_current_facts f
            JOIN rise_runtime.canonical_evidence_sources s USING (source_id)
            WHERE f.subject_id = $1 OR s.metadata->>'acgmeId' = $2
            ORDER BY f.field, f.retrieved_at DESC
          `, [programId, acgmeId]),
          client.query(`
            SELECT
              c.field,
              count(*)::integer AS "claimCount",
              array_agg(DISTINCT c.review_state ORDER BY c.review_state) AS "reviewStates",
              array_agg(DISTINCT s.provider ORDER BY s.provider) AS providers,
              max(c.retrieved_at) AS "latestRetrievedAt"
            FROM rise_runtime.canonical_evidence_sources s
            JOIN rise_runtime.canonical_evidence_claims c USING (source_id)
            WHERE s.source_type = 'completed_research_factory'
              AND s.metadata->>'acgmeId' = $1
              AND (c.review_state <> 'APPROVED'
                OR c.conflict_state = 'CONFLICTING'
                OR c.publication_state NOT IN ('STUDENT_VISIBLE', 'PRIVATE_BETA'))
            GROUP BY c.field
            ORDER BY c.field
          `, [acgmeId]),
        ]);
        return {
          currentFacts: facts.rows,
          pendingEvidence: {
            fields: pending.rows,
            claimCount: pending.rows.reduce((sum, row) => sum + Number(row.claimCount ?? 0), 0),
          },
        };
      }, { isAdmin: true });
    },
  };
}

export async function createRiseCanonicalEvidenceStore({ pool = databasePool() } = {}) {
  await pool.query("SELECT 1 FROM rise_runtime.canonical_evidence_claims LIMIT 1");
  const systemKey = "0".repeat(64);
  return {
    scope: "durable_canonical_evidence",
    async ingestSoapDataset({ release, claims, sourceFile, sourceFileSha256 }) {
      if (release?.counts?.sourceRows !== 925 || release?.identities?.length !== 886 || claims?.length !== 925) {
        throw new Error("SOAP canonical backfill count contract drifted");
      }
      if (!/^[a-f0-9]{64}$/.test(String(sourceFileSha256 ?? ""))) {
        throw new Error("SOAP canonical backfill requires the pinned source SHA-256");
      }
      const providerRunId = "P1_RISE_SOAP_2026_CLOSURE_006";
      const idempotencyKey = sha256(`NRMP_SOAP_CLOSURE\0${providerRunId}\0${sourceFileSha256}`);
      return withSubject(pool, systemKey, async (client) => {
        const run = await client.query(`
          INSERT INTO rise_runtime.provider_ingest_runs (
            idempotency_key, provider, campaign_id, acgme_id, source_file,
            source_file_sha256, staged_at, status, new_spend_usd, claim_count
          ) VALUES ($1, 'NRMP_SOAP_CLOSURE', 'P1-RISE-5008-SOAP-2026', NULL, $2, $3,
                    $4, 'INGESTED', 0, $5)
          ON CONFLICT (idempotency_key) DO UPDATE SET
            replay_count = rise_runtime.provider_ingest_runs.replay_count + 1
          RETURNING ingest_run_id, (xmax = 0) AS inserted, replay_count
        `, [idempotencyKey, sourceFile, sourceFileSha256, release.source.retrievedAt, claims.length]);
        await client.query(`
          INSERT INTO rise_runtime.canonical_evidence_sources (
            source_id, provider, provider_run_id, source_type, source_file_sha256,
            source_locator, retrieved_at, rights_state, exposure_state, metadata
          ) VALUES ('rise_src_soap_2026', 'NRMP_SOAP_CLOSURE', $1,
                    'historical_match_cycle_result', $2, $3, $4,
                    'APPROVED', 'PRIVATE_BETA', $5::jsonb)
          ON CONFLICT (source_id) DO NOTHING
        `, [
          providerRunId, sourceFileSha256, sourceFile, release.source.retrievedAt,
          JSON.stringify({
            cycle: 2026,
            sourceRows: release.counts.sourceRows,
            exactAcgmeMatches: release.counts.exactAcgmeMatches,
            reviewRequired: release.counts.reviewRequired,
            newSpendUsd: 0,
          }),
        ]);
        let insertedClaims = 0;
        for (const claim of claims) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_claims (
              claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
              publication_state, review_state, conflict_state, source_id, source_locator,
              observed_period, retrieved_at, content_sha256
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9,
                      'rise_src_soap_2026', $10, $11::jsonb, $12, $13)
            ON CONFLICT (content_sha256) DO NOTHING
          `, [
            claim.id, claim.subjectId, claim.field, JSON.stringify(claim.knowledge), JSON.stringify(claim.value),
            claim.assertionClass, claim.publicationState, claim.reviewState, claim.conflictState,
            claim.sourceLocator, JSON.stringify(claim.observedPeriod), claim.retrievedAt, claim.contentSha256,
          ]);
          insertedClaims += result.rowCount;
        }
        let upsertedIdentities = 0;
        for (const identity of release.identities) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_program_identities (
              program_identity_id, acgme_id, program_specialty_id, program_name, institution,
              city, state, specialty, reconciliation_status, exposure_state, source_id, content_sha256
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                      'rise_src_soap_2026', $11)
            ON CONFLICT (acgme_id) DO UPDATE SET
              program_specialty_id = EXCLUDED.program_specialty_id,
              program_name = EXCLUDED.program_name,
              institution = EXCLUDED.institution,
              city = EXCLUDED.city,
              state = EXCLUDED.state,
              specialty = EXCLUDED.specialty,
              reconciliation_status = EXCLUDED.reconciliation_status,
              exposure_state = EXCLUDED.exposure_state,
              source_id = EXCLUDED.source_id,
              content_sha256 = EXCLUDED.content_sha256,
              updated_at = now()
          `, [
            identity.programIdentityId, identity.acgmeId, identity.programSpecialtyId,
            identity.programName, identity.institution, identity.city || null, identity.state,
            identity.specialty, identity.reconciliationStatus, identity.exposureState, identity.contentSha256,
          ]);
          upsertedIdentities += result.rowCount;
        }
        return {
          ingestRunId: run.rows[0].ingest_run_id,
          insertedRun: run.rows[0].inserted,
          replayCount: run.rows[0].replay_count,
          insertedClaims,
          claimCount: claims.length,
          upsertedIdentities,
          identityCount: release.identities.length,
          newSpendUsd: 0,
        };
      }, { isAdmin: true });
    },
    async ingestProviderRecord({ ingest }) {
      return withSubject(pool, systemKey, async (client) => {
        const sourceId = stableDatabaseId("rise_src", `${ingest.provider}:${ingest.providerRunId}`);
        const identity = await client.query(`
          SELECT program_identity_id AS "programIdentityId"
          FROM rise_runtime.canonical_program_identities
          WHERE acgme_id = $1
          LIMIT 1
        `, [ingest.acgmeId]);
        const canonicalSubjectId = identity.rows[0]?.programIdentityId ?? null;
        const run = await client.query(`
          INSERT INTO rise_runtime.provider_ingest_runs (
            idempotency_key, provider, campaign_id, acgme_id, source_file,
            source_file_sha256, staged_at, status, new_spend_usd, claim_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INGESTED', 0, $8)
          ON CONFLICT (idempotency_key) DO UPDATE SET replay_count = rise_runtime.provider_ingest_runs.replay_count + 1
          RETURNING ingest_run_id, (xmax = 0) AS inserted, replay_count
        `, [
          ingest.idempotencyKey, ingest.provider, ingest.campaignId, ingest.acgmeId,
          ingest.sourceFile, ingest.sourceFileSha256, ingest.stagedAt, ingest.claims.length,
        ]);
        await client.query(`
          INSERT INTO rise_runtime.canonical_evidence_sources (
            source_id, provider, provider_run_id, source_type, source_file_sha256,
            source_locator, retrieved_at, rights_state, exposure_state, metadata
          ) VALUES ($1, $2, $3, 'completed_research_factory', $4, $5, $6, 'REVIEW_REQUIRED', 'INTERNAL_ONLY', $7::jsonb)
          ON CONFLICT (source_id) DO NOTHING
        `, [
          sourceId, ingest.provider, ingest.providerRunId, ingest.sourceFileSha256,
          ingest.sourceFile, ingest.stagedAt,
          JSON.stringify({ campaignId: ingest.campaignId, acgmeId: ingest.acgmeId, newSpendUsd: 0 }),
        ]);
        let insertedClaims = 0;
        for (const claim of ingest.claims) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_claims (
              claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
              publication_state, review_state, conflict_state, source_id, source_locator,
              observed_period, retrieved_at, content_sha256
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14)
            ON CONFLICT (content_sha256) DO NOTHING
          `, [
            claim.id, canonicalSubjectId ?? claim.subjectId, claim.field, JSON.stringify(claim.knowledge), JSON.stringify(claim.value),
            claim.assertionClass, claim.publicationState, claim.reviewState, claim.conflictState,
            sourceId, claim.sourceLocator, JSON.stringify(claim.observedPeriod), claim.retrievedAt, claim.contentSha256,
          ]);
          insertedClaims += result.rowCount;
        }
        return {
          ingestRunId: run.rows[0].ingest_run_id,
          insertedRun: run.rows[0].inserted,
          replayCount: run.rows[0].replay_count,
          insertedClaims,
          claimCount: ingest.claims.length,
        };
      }, { isAdmin: true });
    },
    async upsertProgramIdentity(identity) {
      return withSubject(pool, systemKey, async (client) => {
        const result = await client.query(`
          INSERT INTO rise_runtime.canonical_program_identities (
            program_identity_id, acgme_id, program_specialty_id, program_name, institution,
            city, state, specialty, reconciliation_status, exposure_state, source_id, content_sha256
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (acgme_id) DO UPDATE SET
            program_specialty_id = EXCLUDED.program_specialty_id,
            program_name = EXCLUDED.program_name,
            institution = EXCLUDED.institution,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            specialty = EXCLUDED.specialty,
            reconciliation_status = EXCLUDED.reconciliation_status,
            exposure_state = EXCLUDED.exposure_state,
            source_id = EXCLUDED.source_id,
            content_sha256 = EXCLUDED.content_sha256,
            updated_at = now()
          RETURNING program_identity_id AS "programIdentityId", exposure_state AS "exposureState"
        `, [
          identity.programIdentityId, identity.acgmeId, identity.programSpecialtyId,
          identity.programName, identity.institution, identity.city || null, identity.state,
          identity.specialty, identity.reconciliationStatus, identity.exposureState,
          identity.sourceId, identity.contentSha256,
        ]);
        return result.rows[0];
      }, { isAdmin: true });
    },
  };
}

function researchControlRecord(row) {
  return {
    revision: Number(row.revision),
    globalEnabled: row.globalEnabled,
    studentEnabled: row.studentEnabled,
    emergencyKillSwitch: row.emergencyKillSwitch,
    specialtyScope: row.specialtyScope,
    stateScope: row.stateScope,
    canaryMode: row.canaryMode,
    canaryProgramIds: row.canaryProgramIds,
    entitlementScope: row.entitlementScope,
    subjectAllowlistHashes: row.subjectAllowlistHashes,
    defaultQuota: row.defaultQuota,
    quotaWindowDays: row.quotaWindowDays,
    budgetCapUsd: Number(row.budgetCapUsd),
    actualSpendUsd: Number(row.actualSpendUsd),
    concurrencyCap: row.concurrencyCap,
    primaryProvider: row.primaryProvider,
    fallbackProvider: row.fallbackProvider,
    escalationProvider: row.escalationProvider,
    updatedAt: row.updatedAt,
  };
}

function researchProviderRecord(row) {
  return {
    providerKey: row.providerKey,
    modelKey: row.modelKey,
    state: row.state,
    enabled: row.enabled,
    networkAllowed: row.networkAllowed,
    spendAllowed: row.spendAllowed,
    budgetCapUsd: Number(row.budgetCapUsd),
    actualSpendUsd: Number(row.actualSpendUsd),
    concurrencyCap: row.concurrencyCap,
    revision: Number(row.revision),
    updatedAt: row.updatedAt,
  };
}

function researchJobRecord(row, { admin = false } = {}) {
  if (!row) return null;
  const record = {
    jobId: row.jobId,
    programSpecialtyId: row.programSpecialtyId,
    acgmeId: row.acgmeId,
    specialty: row.specialty,
    state: row.state,
    requestSource: row.requestSource,
    taskClass: row.taskClass,
    status: row.status,
    providerKey: row.providerKey,
    modelKey: row.modelKey,
    routerRevision: Number(row.routerRevision),
    quotaWindowStart: row.quotaWindowStart,
    estimatedCostUsd: Number(row.estimatedCostUsd),
    actualCostUsd: row.actualCostUsd === null ? null : Number(row.actualCostUsd),
    attemptCount: row.attemptCount,
    resultSummary: row.resultSummary,
    errorCode: row.errorCode,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (admin) {
    record.workerId = row.workerId;
    record.leaseExpiresAt = row.leaseExpiresAt;
    record.heartbeatAt = row.heartbeatAt;
    record.errorSummary = row.errorSummary;
    record.canonicalIngestRunId = row.canonicalIngestRunId;
  }
  return record;
}

const RESEARCH_CONTROL_PROJECTION = `
  revision,
  global_enabled AS "globalEnabled",
  student_enabled AS "studentEnabled",
  emergency_kill_switch AS "emergencyKillSwitch",
  specialty_scope AS "specialtyScope",
  state_scope AS "stateScope",
  canary_mode AS "canaryMode",
  canary_acgme_ids AS "canaryProgramIds",
  entitlement_scope AS "entitlementScope",
  subject_allowlist_hashes AS "subjectAllowlistHashes",
  default_quota AS "defaultQuota",
  quota_window_days AS "quotaWindowDays",
  budget_cap_usd AS "budgetCapUsd",
  actual_spend_usd AS "actualSpendUsd",
  concurrency_cap AS "concurrencyCap",
  primary_provider AS "primaryProvider",
  fallback_provider AS "fallbackProvider",
  escalation_provider AS "escalationProvider",
  updated_at AS "updatedAt"
`;

const RESEARCH_PROVIDER_PROJECTION = `
  provider_key AS "providerKey",
  model_key AS "modelKey",
  state,
  enabled,
  network_allowed AS "networkAllowed",
  spend_allowed AS "spendAllowed",
  budget_cap_usd AS "budgetCapUsd",
  actual_spend_usd AS "actualSpendUsd",
  concurrency_cap AS "concurrencyCap",
  revision,
  updated_at AS "updatedAt"
`;

const RESEARCH_JOB_PROJECTION = `
  job_id AS "jobId",
  program_specialty_id AS "programSpecialtyId",
  acgme_id AS "acgmeId",
  specialty,
  state_code AS state,
  request_source AS "requestSource",
  task_class AS "taskClass",
  status,
  provider_key AS "providerKey",
  model_key AS "modelKey",
  router_revision AS "routerRevision",
  quota_window_start::text AS "quotaWindowStart",
  estimated_cost_usd AS "estimatedCostUsd",
  actual_cost_usd AS "actualCostUsd",
  attempt_count AS "attemptCount",
  worker_id AS "workerId",
  lease_expires_at AS "leaseExpiresAt",
  heartbeat_at AS "heartbeatAt",
  result_summary AS "resultSummary",
  canonical_ingest_run_id AS "canonicalIngestRunId",
  error_code AS "errorCode",
  error_summary AS "errorSummary",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function readResearchControls(client, { lock = false } = {}) {
  const controls = await client.query(`
    SELECT ${RESEARCH_CONTROL_PROJECTION}
    FROM rise_runtime.research_router_settings
    WHERE control_id = true
    ${lock ? "FOR UPDATE" : ""}
  `);
  if (controls.rowCount !== 1) throw new Error("RISE research router singleton is unavailable");
  const providers = await client.query(`
    SELECT ${RESEARCH_PROVIDER_PROJECTION}
    FROM rise_runtime.research_provider_routes
    ORDER BY provider_key
  `);
  return {
    controls: researchControlRecord(controls.rows[0]),
    providers: providers.rows.map(researchProviderRecord),
  };
}

function researchStoreError(code, message, status = 409, details) {
  return Object.assign(new Error(message), { code, status, details });
}

export async function createRiseResearchStore({
  pool = databasePool(),
  subjectHmacKey = process.env.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY,
} = {}) {
  const hmacKey = requiredString(subjectHmacKey, "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY", 32);
  await pool.query("SELECT 1 FROM rise_runtime.research_router_settings LIMIT 1");
  await pool.query("SELECT 1 FROM rise_runtime.research_jobs LIMIT 1");
  const systemKey = "0".repeat(64);
  return {
    scope: "durable_private_research",
    async health() {
      return withSubject(pool, systemKey, async (client) => {
        const control = await client.query(`
          SELECT revision, global_enabled AS "globalEnabled",
                 student_enabled AS "studentEnabled",
                 emergency_kill_switch AS "emergencyKillSwitch"
          FROM rise_runtime.research_router_settings WHERE control_id = true
        `);
        const jobs = await client.query(`
          SELECT
            count(*)::integer AS total,
            count(*) FILTER (WHERE status IN ('QUEUED', 'LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING'))::integer AS active
          FROM rise_runtime.research_jobs
        `);
        return { ...control.rows[0], ...jobs.rows[0], storage: "production_postgres" };
      }, { isAdmin: true });
    },
    async readControls() {
      return withSubject(pool, systemKey, async (client) => {
        const result = await readResearchControls(client);
        return {
          controls: publicResearchControls(result.controls, result.providers),
          revision: result.controls.revision,
          providers: result.providers,
        };
      }, { isAdmin: true });
    },
    async updateControls({ actorSubject, expectedRevision, input, reason = "" }) {
      const actorKey = subjectKey(actorSubject, hmacKey);
      return withSubject(pool, actorKey, async (client) => {
        const before = await readResearchControls(client, { lock: true });
        if (Number(expectedRevision) !== before.controls.revision) {
          throw researchStoreError("RESEARCH_CONTROL_CONFLICT", "Research router settings changed; reload before saving", 409, {
            currentRevision: before.controls.revision,
          });
        }
        const controls = normalizeResearchControls({
          ...input,
          canaryProgramIds: input?.canaryProgramIds ?? before.controls.canaryProgramIds,
          subjectAllowlistHashes: input?.subjectAllowlistHashes ?? before.controls.subjectAllowlistHashes,
        });
        const knownProviders = new Set(before.providers.map((provider) => provider.providerKey));
        for (const provider of [controls.primaryProvider, controls.fallbackProvider, controls.escalationProvider].filter(Boolean)) {
          if (!knownProviders.has(provider)) {
            throw researchStoreError("RESEARCH_PROVIDER_UNKNOWN", "Research route references an unknown provider");
          }
        }
        if (controls.budgetCapUsd !== 0) {
          throw researchStoreError("RESEARCH_BUDGET_NOT_AUTHORIZED", "P1-RISE-5012A permits zero unapproved provider spend only");
        }
        const updated = await client.query(`
          UPDATE rise_runtime.research_router_settings SET
            revision = revision + 1,
            global_enabled = $1,
            student_enabled = $2,
            emergency_kill_switch = $3,
            specialty_scope = $4::text[],
            state_scope = $5::text[],
            canary_mode = $6,
            canary_acgme_ids = $7::text[],
            entitlement_scope = $8::text[],
            subject_allowlist_hashes = $9::char(64)[],
            default_quota = $10,
            quota_window_days = $11,
            budget_cap_usd = $12,
            concurrency_cap = $13,
            primary_provider = $14,
            fallback_provider = $15,
            escalation_provider = $16,
            updated_by_subject_key = $17,
            updated_at = now()
          WHERE control_id = true AND revision = $18
          RETURNING ${RESEARCH_CONTROL_PROJECTION}
        `, [
          controls.globalEnabled, controls.studentEnabled, controls.emergencyKillSwitch,
          controls.specialtyScope, controls.stateScope, controls.canaryMode, controls.canaryProgramIds,
          controls.entitlementScope, controls.subjectAllowlistHashes, controls.defaultQuota, controls.quotaWindowDays,
          controls.budgetCapUsd, controls.concurrencyCap, controls.primaryProvider,
          controls.fallbackProvider, controls.escalationProvider, actorKey, before.controls.revision,
        ]);
        if (updated.rowCount !== 1) throw researchStoreError("RESEARCH_CONTROL_CONFLICT", "Research router settings changed during save");
        const after = researchControlRecord(updated.rows[0]);
        await client.query(`
          INSERT INTO rise_runtime.research_control_audit_events (
            actor_subject_key, action, target_type, target_id, before_state, after_state, reason
          ) VALUES ($1, 'UPDATE_ROUTER', 'ROUTER', 'PRIMARY', $2::jsonb, $3::jsonb, $4)
        `, [actorKey, JSON.stringify(publicResearchControls(before.controls, before.providers)), JSON.stringify(publicResearchControls(after, before.providers)), String(reason).slice(0, 1000)]);
        return { controls: publicResearchControls(after, before.providers), revision: after.revision };
      }, { isAdmin: true });
    },
    async updateProvider({ actorSubject, providerKey, expectedRevision, input, reason = "" }) {
      const actorKey = subjectKey(actorSubject, hmacKey);
      const route = normalizeProviderRoute({ ...input, providerKey });
      if (route.providerKey !== "RISE_REPLAY_TEST" && (route.enabled || route.state !== "PAUSED")) {
        throw researchStoreError("RESEARCH_PROVIDER_NOT_AUTHORIZED", "Real provider activation requires separate exact approval");
      }
      return withSubject(pool, actorKey, async (client) => {
        const current = await client.query(`
          SELECT ${RESEARCH_PROVIDER_PROJECTION}
          FROM rise_runtime.research_provider_routes
          WHERE provider_key = $1
          FOR UPDATE
        `, [route.providerKey]);
        if (current.rowCount !== 1) throw researchStoreError("RESEARCH_PROVIDER_UNKNOWN", "Research provider is not registered", 404);
        const before = researchProviderRecord(current.rows[0]);
        if (Number(expectedRevision) !== before.revision) {
          throw researchStoreError("RESEARCH_CONTROL_CONFLICT", "Research provider changed; reload before saving", 409, {
            currentRevision: before.revision,
          });
        }
        const updated = await client.query(`
          UPDATE rise_runtime.research_provider_routes SET
            model_key = $2,
            state = $3,
            enabled = $4,
            network_allowed = $5,
            spend_allowed = $6,
            budget_cap_usd = $7,
            concurrency_cap = $8,
            revision = revision + 1,
            updated_by_subject_key = $9,
            updated_at = now()
          WHERE provider_key = $1 AND revision = $10
          RETURNING ${RESEARCH_PROVIDER_PROJECTION}
        `, [
          route.providerKey, route.modelKey, route.state, route.enabled,
          route.networkAllowed, route.spendAllowed, route.budgetCapUsd,
          route.concurrencyCap, actorKey, before.revision,
        ]);
        if (updated.rowCount !== 1) throw researchStoreError("RESEARCH_CONTROL_CONFLICT", "Research provider changed during save");
        const after = researchProviderRecord(updated.rows[0]);
        await client.query(`
          INSERT INTO rise_runtime.research_control_audit_events (
            actor_subject_key, action, target_type, target_id, before_state, after_state, reason
          ) VALUES ($1, 'UPDATE_PROVIDER', 'PROVIDER', $2, $3::jsonb, $4::jsonb, $5)
        `, [actorKey, route.providerKey, JSON.stringify(before), JSON.stringify(after), String(reason).slice(0, 1000)]);
        return after;
      }, { isAdmin: true });
    },
    async eligibility({ subject, session, program, source = "STUDENT" }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const { controls, providers } = await readResearchControls(client);
        const eligibility = evaluateResearchEligibility({ program, session, controls, subjectHash: key, source });
        const provider = providers.find((candidate) => candidate.providerKey === controls.primaryProvider) ?? null;
        if (!provider?.enabled) eligibility.reasons.push("PROVIDER_DISABLED");
        if (provider?.providerKey !== "RISE_REPLAY_TEST") eligibility.reasons.push("REAL_PROVIDER_NOT_AUTHORIZED");
        eligibility.eligible = eligibility.reasons.length === 0;
        return {
          ...eligibility,
          controls: publicResearchControls(controls, providers),
          provider: provider ? { providerKey: provider.providerKey, state: provider.state, enabled: provider.enabled } : null,
        };
      }, { isAdmin: true });
    },
    async reserveJob({ subject, session, releaseId, program, source = "STUDENT" }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const { controls, providers } = await readResearchControls(client, { lock: true });
        const eligibility = evaluateResearchEligibility({ program, session, controls, subjectHash: key, source });
        if (!eligibility.eligible) {
          throw researchStoreError("RESEARCH_NOT_ELIGIBLE", "This program is outside the active research canary", 403, {
            reasons: eligibility.reasons,
          });
        }
        const provider = providers.find((candidate) => candidate.providerKey === controls.primaryProvider);
        if (!provider?.enabled) throw researchStoreError("RESEARCH_PROVIDER_DISABLED", "The selected research provider is paused");
        if (provider.providerKey !== "RISE_REPLAY_TEST" || provider.state !== "TEST_ONLY" || provider.networkAllowed || provider.spendAllowed) {
          throw researchStoreError("RESEARCH_PROVIDER_NOT_AUTHORIZED", "Only the zero-spend replay adapter is authorized");
        }
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [eligibility.scope.programSpecialtyId]);
        const existing = await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION}
          FROM rise_runtime.research_jobs
          WHERE program_specialty_id = $1
            AND task_class = 'PROGRAM_DEEP_RESEARCH'
            AND created_at >= now() - make_interval(days => $2)
            AND status NOT IN ('FAILED', 'CANCELLED', 'REFUNDED')
          ORDER BY created_at DESC
          LIMIT 1
        `, [eligibility.scope.programSpecialtyId, controls.quotaWindowDays]);
        if (existing.rowCount === 1) {
          return { job: researchJobRecord(existing.rows[0]), deduplicated: true, quotaReserved: false };
        }
        let quota = await client.query(`
          SELECT subject_key, window_start::text AS "windowStart", window_end::text AS "windowEnd",
                 quota_limit AS "quotaLimit", reserved_count AS "reservedCount",
                 consumed_count AS "consumedCount", refunded_count AS "refundedCount"
          FROM rise_runtime.research_quota_ledgers
          WHERE subject_key = $1 AND current_date >= window_start AND current_date < window_end
          ORDER BY window_start DESC
          LIMIT 1
          FOR UPDATE
        `, [key]);
        if (quota.rowCount === 0) {
          quota = await client.query(`
            INSERT INTO rise_runtime.research_quota_ledgers (
              subject_key, window_start, window_end, quota_limit
            ) VALUES ($1, current_date, current_date + $2::integer, $3)
            RETURNING subject_key, window_start::text AS "windowStart", window_end::text AS "windowEnd",
                      quota_limit AS "quotaLimit", reserved_count AS "reservedCount",
                      consumed_count AS "consumedCount", refunded_count AS "refundedCount"
          `, [key, controls.quotaWindowDays, controls.defaultQuota]);
        }
        const ledger = quota.rows[0];
        if (ledger.reservedCount + ledger.consumedCount >= ledger.quotaLimit) {
          throw researchStoreError("RESEARCH_QUOTA_EXHAUSTED", "The current research quota is exhausted", 429, {
            windowEnd: ledger.windowEnd,
          });
        }
        const dedupeKey = researchDedupeKey({
          programSpecialtyId: eligibility.scope.programSpecialtyId,
          providerKey: provider.providerKey,
          windowKey: ledger.windowStart,
        });
        const inserted = await client.query(`
          INSERT INTO rise_runtime.research_jobs (
            dedupe_key, release_id, program_specialty_id, acgme_id, specialty, state_code,
            requester_subject_key, request_source, provider_key, model_key, router_revision,
            quota_window_start, estimated_cost_usd
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [
          dedupeKey, releaseId, eligibility.scope.programSpecialtyId, eligibility.scope.acgmeId,
          eligibility.scope.specialty, eligibility.scope.state, key, eligibility.source,
          provider.providerKey, provider.modelKey, controls.revision, ledger.windowStart,
        ]);
        await client.query(`
          UPDATE rise_runtime.research_quota_ledgers
          SET reserved_count = reserved_count + 1, updated_at = now()
          WHERE subject_key = $1 AND window_start = $2
        `, [key, ledger.windowStart]);
        await client.query(`
          INSERT INTO rise_runtime.research_control_audit_events (
            actor_subject_key, action, target_type, target_id, after_state, reason
          ) VALUES ($1, 'RESERVE_JOB', 'JOB', $2, $3::jsonb, 'zero-spend canary reservation')
        `, [key, inserted.rows[0].jobId, JSON.stringify(researchJobRecord(inserted.rows[0]))]);
        return { job: researchJobRecord(inserted.rows[0]), deduplicated: false, quotaReserved: true };
      }, { isAdmin: true });
    },
    async listJobs({ subject, isAdmin = false, limit = 100 }) {
      const key = subjectKey(subject, hmacKey);
      const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION}
          FROM rise_runtime.research_jobs
          ${isAdmin ? "" : "WHERE requester_subject_key = $1"}
          ORDER BY created_at DESC
          LIMIT $${isAdmin ? "1" : "2"}
        `, isAdmin ? [safeLimit] : [key, safeLimit]);
        return result.rows.map((row) => researchJobRecord(row, { admin: isAdmin }));
      }, { isAdmin });
    },
    async claimNextJob({ workerId, leaseSeconds = 45 }) {
      const safeWorkerId = requiredString(workerId, "workerId").slice(0, 128);
      return withSubject(pool, systemKey, async (client) => {
        const { controls, providers } = await readResearchControls(client, { lock: true });
        if (!controls.globalEnabled || controls.emergencyKillSwitch) return null;
        const provider = providers.find((candidate) => candidate.providerKey === controls.primaryProvider);
        if (
          !provider?.enabled || provider.providerKey !== "RISE_REPLAY_TEST" || provider.state !== "TEST_ONLY"
          || provider.networkAllowed || provider.spendAllowed
        ) return null;
        await client.query(`
          UPDATE rise_runtime.research_jobs
          SET status = CASE WHEN attempt_count >= 3 THEN 'REFUNDED' ELSE 'QUEUED' END,
              error_code = CASE WHEN attempt_count >= 3 THEN 'WORKER_LEASE_EXHAUSTED' ELSE error_code END,
              error_summary = CASE WHEN attempt_count >= 3 THEN 'Worker lease expired three times' ELSE error_summary END,
              lease_token = NULL, lease_expires_at = NULL, worker_id = NULL, heartbeat_at = NULL,
              updated_at = now()
          WHERE status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at <= now()
        `);
        const active = await client.query(`
          SELECT count(*)::integer AS count
          FROM rise_runtime.research_jobs
          WHERE status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
        `);
        if (active.rows[0].count >= Math.min(controls.concurrencyCap, provider.concurrencyCap)) return null;
        const selected = await client.query(`
          SELECT job_id
          FROM rise_runtime.research_jobs
          WHERE status = 'QUEUED' AND provider_key = $1
          ORDER BY created_at, job_id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `, [provider.providerKey]);
        if (selected.rowCount === 0) return null;
        const leaseToken = randomUUID();
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = 'LEASED', worker_id = $2, lease_token = $3,
            lease_expires_at = now() + make_interval(secs => $4),
            heartbeat_at = now(), attempt_count = attempt_count + 1, updated_at = now()
          WHERE job_id = $1
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [selected.rows[0].job_id, safeWorkerId, leaseToken, Math.min(300, Math.max(15, Number(leaseSeconds) || 45))]);
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id
          ) VALUES ($1, $2, $3, $4, 'LEASED', $5)
        `, [updated.rows[0].jobId, updated.rows[0].attemptCount, updated.rows[0].providerKey, updated.rows[0].modelKey, safeWorkerId]);
        return { job: researchJobRecord(updated.rows[0], { admin: true }), leaseToken };
      }, { isAdmin: true });
    },
    async transitionJob({ jobId, leaseToken, workerId, status }) {
      if (!new Set(["RUNNING", "NORMALIZING", "PROMOTING"]).has(status)) {
        throw researchStoreError("RESEARCH_JOB_TRANSITION_INVALID", "Research job transition is invalid");
      }
      return withSubject(pool, systemKey, async (client) => {
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = $4, heartbeat_at = now(), lease_expires_at = now() + interval '45 seconds', updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, status]);
        if (updated.rowCount !== 1) throw researchStoreError("RESEARCH_JOB_LEASE_LOST", "Research worker lease is no longer valid", 409);
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (job_id, attempt_number, status) DO NOTHING
        `, [jobId, updated.rows[0].attemptCount, updated.rows[0].providerKey, updated.rows[0].modelKey, status, workerId]);
        return researchJobRecord(updated.rows[0], { admin: true });
      }, { isAdmin: true });
    },
    async heartbeatJob({ jobId, leaseToken, workerId, leaseSeconds = 45 }) {
      return withSubject(pool, systemKey, async (client) => {
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            heartbeat_at = now(), lease_expires_at = now() + make_interval(secs => $4), updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, Math.min(300, Math.max(15, Number(leaseSeconds) || 45))]);
        if (updated.rowCount !== 1) throw researchStoreError("RESEARCH_JOB_LEASE_LOST", "Research worker lease is no longer valid", 409);
        return researchJobRecord(updated.rows[0], { admin: true });
      }, { isAdmin: true });
    },
    async completeJob({ jobId, leaseToken, workerId, status = "COMPLETED", resultSummary, canonicalIngestRunId = null }) {
      if (!new Set(["COMPLETED", "NEEDS_REVIEW"]).has(status)) {
        throw researchStoreError("RESEARCH_JOB_TRANSITION_INVALID", "Research completion state is invalid");
      }
      return withSubject(pool, systemKey, async (client) => {
        const selected = await client.query(`
          SELECT requester_subject_key, quota_window_start, attempt_count, provider_key, model_key
          FROM rise_runtime.research_jobs
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
          FOR UPDATE
        `, [jobId, leaseToken, workerId]);
        if (selected.rowCount !== 1) throw researchStoreError("RESEARCH_JOB_LEASE_LOST", "Research worker lease is no longer valid", 409);
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = $4, result_summary = $5::jsonb, canonical_ingest_run_id = $6,
            actual_cost_usd = 0, completed_at = now(), lease_token = NULL,
            lease_expires_at = NULL, heartbeat_at = now(), updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, status, JSON.stringify(resultSummary ?? {}), canonicalIngestRunId]);
        const job = updated.rows[0];
        await client.query(`
          UPDATE rise_runtime.research_quota_ledgers
          SET reserved_count = reserved_count - 1, consumed_count = consumed_count + 1, updated_at = now()
          WHERE subject_key = $1 AND window_start = $2 AND reserved_count > 0
        `, [selected.rows[0].requester_subject_key, selected.rows[0].quota_window_start]);
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id,
            metadata, finished_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
          ON CONFLICT (job_id, attempt_number, status) DO NOTHING
        `, [jobId, job.attemptCount, job.providerKey, job.modelKey, status, workerId, JSON.stringify({ newSpendUsd: 0, canonicalIngestRunId })]);
        return researchJobRecord(job, { admin: true });
      }, { isAdmin: true });
    },
    async failJob({ jobId, leaseToken, workerId, errorCode = "REPLAY_ADAPTER_FAILED", errorSummary = "Research replay failed" }) {
      return withSubject(pool, systemKey, async (client) => {
        const selected = await client.query(`
          SELECT requester_subject_key, quota_window_start, attempt_count, provider_key, model_key
          FROM rise_runtime.research_jobs
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
          FOR UPDATE
        `, [jobId, leaseToken, workerId]);
        if (selected.rowCount !== 1) return null;
        const safeCode = /^[A-Z0-9_]{1,64}$/.test(String(errorCode)) ? String(errorCode) : "RESEARCH_JOB_FAILED";
        const safeSummary = String(errorSummary ?? "Research job failed").slice(0, 1000);
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = 'REFUNDED', error_code = $4, error_summary = $5,
            actual_cost_usd = 0, completed_at = now(), lease_token = NULL,
            lease_expires_at = NULL, heartbeat_at = now(), updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, safeCode, safeSummary]);
        await client.query(`
          UPDATE rise_runtime.research_quota_ledgers
          SET reserved_count = reserved_count - 1, refunded_count = refunded_count + 1, updated_at = now()
          WHERE subject_key = $1 AND window_start = $2 AND reserved_count > 0
        `, [selected.rows[0].requester_subject_key, selected.rows[0].quota_window_start]);
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id,
            error_code, metadata, finished_at
          ) VALUES ($1, $2, $3, $4, 'REFUNDED', $5, $6, '{"newSpendUsd":0}'::jsonb, now())
          ON CONFLICT (job_id, attempt_number, status) DO NOTHING
        `, [jobId, selected.rows[0].attempt_count, selected.rows[0].provider_key, selected.rows[0].model_key, workerId, safeCode]);
        return researchJobRecord(updated.rows[0], { admin: true });
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
  const bridge = await pool.query("SELECT to_regclass('rise_runtime.release_source_rights') AS relation");
  const hasBridgeRights = Boolean(bridge.rows[0]?.relation);
  return {
    scope: "shared_durable_current",
    async assertCurrent({ registryReleaseId, authorizationSha256s }) {
      const expected = [...new Set((authorizationSha256s ?? []).map(String))].sort();
      const relation = hasBridgeRights ? `
        SELECT authorization_sha256, decision_record_id, revoked_at, valid_through
        FROM rise_runtime.source_authorizations
        WHERE release_id = $1
        UNION
        SELECT authorization_sha256, decision_record_id, revoked_at, valid_through
        FROM rise_runtime.release_source_rights
        WHERE release_id = $1
      ` : `
        SELECT authorization_sha256, decision_record_id, revoked_at, valid_through
        FROM rise_runtime.source_authorizations
        WHERE release_id = $1
      `;
      const result = await pool.query(`
        SELECT a.authorization_sha256, a.decision_record_id
        FROM rise_runtime.registry_releases r
        JOIN (${relation}) a ON true
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
