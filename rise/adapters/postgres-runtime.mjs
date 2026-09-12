import { createHash, createHmac, randomUUID } from "node:crypto";
import pg from "pg";
import {
  AUTHORIZED_COMBINED_SPEND_USD,
  AUTHORIZED_PROVIDER_KEYS,
  DEEP_RESEARCH_DOSSIER_V2,
  DEEP_RESEARCH_DOMAIN_KEYS,
  classifyDossierRequest,
  evaluateResearchEligibility,
  normalizeProviderRoute,
  normalizeResearchControls,
  programDescriptor,
  publicResearchControls,
  researchDedupeKey,
  studentResearchStatus,
} from "../src/research-router.mjs";
import { APPLICATION_CARD_FIELDS, APPLICATION_PRIORITY_KEYS } from "../src/application-intelligence.mjs";

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

export function databaseEvidenceSourceUrl(values = []) {
  return values.find((value) => (
    typeof value === "string" && value.startsWith("https://") && value.length <= 2048
  )) ?? null;
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

function boundedUniqueList(values, allowed, { minimum, maximum, fallback }) {
  if (!Array.isArray(values)) return [...fallback];
  const result = [...new Set(values.map((value) => String(value ?? "").trim()).filter((value) => allowed.includes(value)))];
  return result.length >= minimum && result.length <= maximum ? result : [...fallback];
}

export async function createRiseApplicationIntelligenceStore({
  pool = databasePool(),
  subjectHmacKey = process.env.RISE_STUDENT_STATE_SUBJECT_HMAC_KEY,
} = {}) {
  const hmacKey = requiredString(subjectHmacKey, "RISE_STUDENT_STATE_SUBJECT_HMAC_KEY", 32);
  await pool.query("SELECT 1 FROM rise_runtime.student_application_preferences LIMIT 1");
  await pool.query("SELECT 1 FROM rise_runtime.application_intelligence_events LIMIT 1");
  const defaultRecord = Object.freeze({
    personalizationEnabled: true,
    priorities: ["visa", "exams", "yog", "usce", "research_depth"],
    cardFields: ["visa", "exams", "yog", "usce", "composition", "research_depth"],
  });
  return {
    scope: "durable_private",
    async readPreferences({ subject }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          SELECT personalization_enabled AS "personalizationEnabled", priorities,
                 card_fields AS "cardFields", updated_at AS "updatedAt"
          FROM rise_runtime.student_application_preferences WHERE subject_key=$1
        `, [key]);
        return result.rows[0] ?? { ...defaultRecord, priorities: [...defaultRecord.priorities], cardFields: [...defaultRecord.cardFields] };
      });
    },
    async writePreferences({ subject, personalizationEnabled, priorities, cardFields }) {
      const key = subjectKey(subject, hmacKey);
      const safePriorities = boundedUniqueList(priorities, APPLICATION_PRIORITY_KEYS, { minimum: 1, maximum: 5, fallback: defaultRecord.priorities });
      const safeCardFields = boundedUniqueList(cardFields, APPLICATION_CARD_FIELDS, { minimum: 3, maximum: 8, fallback: defaultRecord.cardFields });
      return withSubject(pool, key, async (client) => {
        const result = await client.query(`
          INSERT INTO rise_runtime.student_application_preferences (
            subject_key, personalization_enabled, priorities, card_fields
          ) VALUES ($1,$2,$3::text[],$4::text[])
          ON CONFLICT (subject_key) DO UPDATE SET
            personalization_enabled=excluded.personalization_enabled,
            priorities=excluded.priorities, card_fields=excluded.card_fields, updated_at=now()
          RETURNING personalization_enabled AS "personalizationEnabled", priorities,
                    card_fields AS "cardFields", updated_at AS "updatedAt"
        `, [key, personalizationEnabled !== false, safePriorities, safeCardFields]);
        return result.rows[0];
      });
    },
    async recordEvent({ subject, eventType, programSpecialtyId = null, dimension = null }) {
      const key = subjectKey(subject, hmacKey);
      const valid = new Set([
        "SEARCH_USED", "FILTER_APPLIED", "SAME_SCHOOL_FILTER", "SAME_COUNTRY_FILTER",
        "PERSONALIZATION_ENABLED", "PROGRAM_FILE_OPENED", "RESEARCH_MODAL_OPENED",
        "RESEARCH_REQUEST_SUBMITTED", "RESEARCH_REQUEST_NO_OP", "PROGRAM_SAVED", "COMPARE_USED",
      ]);
      if (!valid.has(eventType)) throw new Error("Invalid application-intelligence event");
      const safeDimension = dimension == null ? null : String(dimension).trim().slice(0, 64) || null;
      return withSubject(pool, key, async (client) => {
        await client.query(`
          INSERT INTO rise_runtime.application_intelligence_events (
            subject_key,event_type,program_specialty_id,dimension,metadata
          ) VALUES ($1,$2,$3,$4,'{}'::jsonb)
        `, [key, eventType, programSpecialtyId, safeDimension]);
        return { recorded: true };
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
  await pool.query("SELECT 1 FROM rise_runtime.evidence_claim_review_current LIMIT 1");
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
          const coverage = await client.query(`
              SELECT
                s.metadata->>'acgmeId' AS "acgmeId",
                array_agg(DISTINCT c.field ORDER BY c.field)
                  FILTER (WHERE r.disposition = 'APPROVED_CURRENT') AS fields,
                array_agg(DISTINCT c.field ORDER BY c.field)
                  FILTER (WHERE r.disposition IS NULL OR r.disposition IN (
                    'CONFLICT_REQUIRES_REVIEW', 'IDENTITY_AMBIGUITY'
                  )) AS "pendingFields",
                count(*)::integer AS "claimCount"
              FROM rise_runtime.canonical_evidence_sources s
              JOIN rise_runtime.canonical_evidence_claims c USING (source_id)
              LEFT JOIN LATERAL (
                SELECT e.disposition
                FROM rise_runtime.evidence_claim_review_events e
                WHERE e.source_claim_id = c.claim_id
                ORDER BY e.created_at DESC, e.review_id DESC
                LIMIT 1
              ) r ON true
              WHERE s.source_type = 'completed_research_factory'
                AND s.metadata->>'acgmeId' ~ '^[0-9]{10}$'
              GROUP BY s.metadata->>'acgmeId'
              ORDER BY s.metadata->>'acgmeId'
            `);
          const facts = await client.query(`
              WITH promoted_source_urls AS MATERIALIZED (
                SELECT
                  l.promoted_claim_id,
                  array_agg(DISTINCT u.url ORDER BY u.url) AS source_urls
                FROM rise_runtime.canonical_claim_promotion_lineage l
                JOIN LATERAL (
                  SELECT e.source_urls
                  FROM rise_runtime.evidence_claim_review_events e
                  WHERE e.source_claim_id = l.source_claim_id
                  ORDER BY e.created_at DESC, e.review_id DESC
                  LIMIT 1
                ) latest ON true
                CROSS JOIN LATERAL jsonb_array_elements_text(latest.source_urls) u(url)
                GROUP BY l.promoted_claim_id
              )
              SELECT
                subject_id AS "subjectId",
                coalesce(s.metadata->>'acgmeId', i.acgme_id::text) AS "acgmeId",
                field,
                knowledge,
                canonical_value AS "canonicalValue",
                f.publication_state AS "publicationState",
                f.retrieved_at AS "retrievedAt",
                s.provider,
                coalesce(links.source_urls[1], s.source_url) AS "sourceUrl",
                coalesce(links.source_urls, array_remove(ARRAY[s.source_url], NULL)) AS "sourceUrls",
                s.source_locator AS "sourceLocator"
              FROM rise_runtime.canonical_current_facts f
              JOIN rise_runtime.canonical_evidence_sources s USING (source_id)
              LEFT JOIN rise_runtime.canonical_program_identities i
                ON i.program_identity_id = f.subject_id
              LEFT JOIN promoted_source_urls links ON links.promoted_claim_id = f.claim_id
              ORDER BY subject_id, field
            `);
          const dossiers = await client.query(`
              SELECT DISTINCT ON (acgme_id)
                acgme_id AS "acgmeId",
                status,
                completion_matrix AS "completionMatrix",
                completion_score AS "completionScore",
                dossier_outcome AS "dossierOutcome",
                research_timestamp AS "researchTimestamp"
              FROM rise_runtime.research_jobs
              WHERE contract_version = $1
                AND status IN ('COMPLETED', 'PARTIAL')
              ORDER BY acgme_id, research_timestamp DESC NULLS LAST, created_at DESC
            `, [DEEP_RESEARCH_DOSSIER_V2.contractVersion]);
          return {
            researchCoverage: coverage.rows.map((row) => ({
              ...row,
              fields: row.fields ?? [],
              pendingFields: row.pendingFields ?? [],
            })),
            currentFacts: facts.rows,
            dossiers: dossiers.rows.map((row) => ({
              ...row,
              completionScore: Number(row.completionScore ?? 0),
            })),
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
        const [facts, pending, dossier, domains] = await Promise.all([
          client.query(`
            SELECT
              f.subject_id AS "subjectId",
              coalesce(s.metadata->>'acgmeId', i.acgme_id::text) AS "acgmeId",
              f.field,
              f.knowledge,
              f.canonical_value AS "canonicalValue",
              f.publication_state AS "publicationState",
              f.retrieved_at AS "retrievedAt",
              s.provider,
              coalesce(links.source_urls[1], s.source_url) AS "sourceUrl",
              coalesce(links.source_urls, array_remove(ARRAY[s.source_url], NULL)) AS "sourceUrls",
              s.source_locator AS "sourceLocator"
            FROM rise_runtime.canonical_current_facts f
            JOIN rise_runtime.canonical_evidence_sources s USING (source_id)
            LEFT JOIN rise_runtime.canonical_program_identities i
              ON i.program_identity_id = f.subject_id
            LEFT JOIN LATERAL (
              SELECT array_agg(DISTINCT u.url ORDER BY u.url) AS source_urls
              FROM rise_runtime.canonical_claim_promotion_lineage l
              JOIN rise_runtime.evidence_claim_review_current r ON r.source_claim_id = l.source_claim_id
              CROSS JOIN LATERAL jsonb_array_elements_text(r.source_urls) u(url)
              WHERE l.promoted_claim_id = f.claim_id
            ) links ON true
            WHERE f.subject_id = $1 OR coalesce(s.metadata->>'acgmeId', i.acgme_id::text) = $2
            ORDER BY f.field, f.retrieved_at DESC
          `, [programId, acgmeId]),
          client.query(`
            SELECT
              c.field,
              count(*)::integer AS "claimCount",
              array_agg(DISTINCT c.review_state ORDER BY c.review_state) AS "reviewStates",
              array_agg(DISTINCT coalesce(r.disposition, 'WITHOUT_FINAL_DISPOSITION') ORDER BY coalesce(r.disposition, 'WITHOUT_FINAL_DISPOSITION')) AS dispositions,
              array_agg(DISTINCT s.provider ORDER BY s.provider) AS providers,
              max(c.retrieved_at) AS "latestRetrievedAt"
            FROM rise_runtime.canonical_evidence_sources s
            JOIN rise_runtime.canonical_evidence_claims c USING (source_id)
            LEFT JOIN rise_runtime.evidence_claim_review_current r ON r.source_claim_id = c.claim_id
            WHERE s.source_type = 'completed_research_factory'
              AND s.metadata->>'acgmeId' = $1
              AND (r.disposition IS NULL OR r.disposition <> 'APPROVED_CURRENT')
            GROUP BY c.field
            ORDER BY c.field
          `, [acgmeId]),
          client.query(`
            SELECT contract_version AS "contractVersion",
                   result_schema_version AS "resultSchemaVersion",
                   request_class AS "requestClass",
                   required_domains AS "requiredDomains",
                   requested_fields AS "requestedFields",
                   completion_matrix AS "completionMatrix",
                   completion_score AS "completionScore",
                   dossier_outcome AS "dossierOutcome",
                   research_timestamp AS "researchTimestamp",
                   status, created_at AS "submittedAt", updated_at AS "lastStatusUpdate"
            FROM rise_runtime.research_jobs
            WHERE acgme_id = $1 AND contract_version = $2
              AND status IN ('COMPLETED', 'PARTIAL')
            ORDER BY research_timestamp DESC NULLS LAST, created_at DESC
            LIMIT 1
          `, [acgmeId, DEEP_RESEARCH_DOSSIER_V2.contractVersion]),
          client.query(`
            SELECT DISTINCT ON (c.field)
              c.field,
              coalesce(r.normalized_value, c.canonical_value) AS value,
              coalesce(r.disposition, 'WITHOUT_FINAL_DISPOSITION') AS disposition,
              r.reason_code AS reason,
              coalesce(r.source_urls, '[]'::jsonb) AS "sourceUrls",
              c.retrieved_at AS "retrievedAt"
            FROM rise_runtime.canonical_evidence_sources s
            JOIN rise_runtime.canonical_evidence_claims c USING (source_id)
            LEFT JOIN rise_runtime.evidence_claim_review_current r ON r.source_claim_id = c.claim_id
            WHERE s.source_type = 'completed_research_factory'
              AND s.metadata->>'acgmeId' = $1
              AND c.field LIKE 'research.domain.%'
            ORDER BY c.field, c.retrieved_at DESC, c.claim_id DESC
          `, [acgmeId]),
        ]);
        return {
          currentFacts: facts.rows,
          pendingEvidence: {
            fields: pending.rows,
            claimCount: pending.rows.reduce((sum, row) => sum + Number(row.claimCount ?? 0), 0),
          },
          dossier: dossier.rows[0] ? {
            ...dossier.rows[0],
            completionScore: Number(dossier.rows[0].completionScore ?? 0),
            status: studentResearchStatus(dossier.rows[0].status),
          } : null,
          domainStatuses: domains.rows,
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INGESTED', $8, $9)
          ON CONFLICT (idempotency_key) DO UPDATE SET replay_count = rise_runtime.provider_ingest_runs.replay_count + 1
          RETURNING ingest_run_id, (xmax = 0) AS inserted, replay_count
        `, [
          ingest.idempotencyKey, ingest.provider, ingest.campaignId, ingest.acgmeId,
          ingest.sourceFile, ingest.sourceFileSha256, ingest.stagedAt,
          Number(ingest.newSpendUsd ?? 0), ingest.claims.length,
        ]);
        await client.query(`
          INSERT INTO rise_runtime.canonical_evidence_sources (
            source_id, provider, provider_run_id, source_type, source_file_sha256,
            source_url, source_locator, retrieved_at, rights_state, exposure_state, metadata
          ) VALUES ($1, $2, $3, 'completed_research_factory', $4, $5, $6, $7, 'REVIEW_REQUIRED', 'INTERNAL_ONLY', $8::jsonb)
          ON CONFLICT (source_id) DO NOTHING
        `, [
          sourceId, ingest.provider, ingest.providerRunId, ingest.sourceFileSha256,
          databaseEvidenceSourceUrl(ingest.claims.flatMap((claim) => claim.sourceUrls ?? [])),
          ingest.sourceFile, ingest.stagedAt,
          JSON.stringify({
            campaignId: ingest.campaignId, acgmeId: ingest.acgmeId,
            newSpendUsd: Number(ingest.newSpendUsd ?? 0), providerKey: ingest.providerKey ?? null,
            modelKey: ingest.modelKey ?? null,
            claimSourceUrlCount: new Set(ingest.claims.flatMap((claim) => claim.sourceUrls ?? [])).size,
          }),
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
          newSpendUsd: Number(ingest.newSpendUsd ?? 0),
        };
      }, { isAdmin: true });
    },
    async ensureReviewIdentitySource({
      retrievedAt,
      sourceId = "rise_src_p1_rise_5012d_review",
      ticket = "P1-RISE-5012D",
      sourceLocator = "P1-RISE-5012D/registry-identity-reconciliation",
    }) {
      const timestamp = requiredString(retrievedAt, "retrievedAt");
      return withSubject(pool, systemKey, async (client) => {
        await client.query(`
          INSERT INTO rise_runtime.canonical_evidence_sources (
            source_id, provider, provider_run_id, source_type, source_locator, retrieved_at,
            rights_state, exposure_state, metadata
          ) VALUES ($1,'MISSIONMED_REVIEW',$2,
                    'canonical_review_promotion',$3,$4,
                    'APPROVED','PRIVATE_BETA',$5::jsonb)
          ON CONFLICT (source_id) DO NOTHING
        `, [sourceId, ticket, sourceLocator, timestamp,
          JSON.stringify({ registryIdentityBridge: true, newProviderSpendUsd: 0, ticket })]);
        return { sourceId };
      }, { isAdmin: true });
    },
    async upsertProgramIdentities(identities) {
      return withSubject(pool, systemKey, async (client) => {
        let upserted = 0;
        for (const batch of chunks(identities)) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_program_identities (
              program_identity_id, acgme_id, program_specialty_id, program_name, institution,
              city, state, specialty, reconciliation_status, exposure_state, source_id, content_sha256
            ) SELECT x.program_identity_id, x.acgme_id, x.program_specialty_id, x.program_name,
                     x.institution, x.city, x.state, x.specialty, 'EXACT_ACGME_MATCH',
                     'PRIVATE_BETA', x.source_id, x.content_sha256
              FROM jsonb_to_recordset($1::jsonb) AS x(
                program_identity_id text, acgme_id char(10), program_specialty_id text,
                program_name text, institution text, city text, state text, specialty text,
                source_id text, content_sha256 char(64)
              ) ON CONFLICT (acgme_id) DO UPDATE SET
                program_specialty_id=EXCLUDED.program_specialty_id,
                program_name=EXCLUDED.program_name, institution=EXCLUDED.institution,
                city=EXCLUDED.city, state=EXCLUDED.state, specialty=EXCLUDED.specialty,
                reconciliation_status='EXACT_ACGME_MATCH', exposure_state='PRIVATE_BETA',
                source_id=EXCLUDED.source_id, content_sha256=EXCLUDED.content_sha256, updated_at=now()
          `, [JSON.stringify(batch.map((identity) => ({
            program_identity_id: identity.programIdentityId, acgme_id: identity.acgmeId,
            program_specialty_id: identity.programSpecialtyId, program_name: identity.programName,
            institution: identity.institution, city: identity.city || null, state: identity.state,
            specialty: identity.specialty, source_id: identity.sourceId, content_sha256: identity.contentSha256,
          })))]);
          upserted += result.rowCount;
        }
        return { upserted };
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

function chunks(values, size = 250) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function reviewEvent(decision, actorSubjectKey, reviewedAt) {
  const decisionSha256 = sha256({
    sourceClaimId: decision.claimId, disposition: decision.disposition, reason: decision.reason,
    ruleVersion: decision.ruleVersion, normalizedValue: decision.normalizedValue,
    sourceUrls: decision.sourceUrls ?? [], overridesReviewId: decision.overridesReviewId ?? null,
  });
  return {
    reviewId: stableDatabaseId("rise_review", decisionSha256),
    sourceClaimId: decision.claimId,
    disposition: decision.disposition,
    reasonCode: decision.reason,
    ruleVersion: decision.ruleVersion,
    normalizedValue: decision.normalizedValue ?? null,
    sourceUrls: decision.sourceUrls ?? [],
    qualityScore: Number(decision.qualityScore ?? 0),
    actorSubjectKey,
    decisionSha256,
    overridesReviewId: decision.overridesReviewId ?? null,
    createdAt: reviewedAt,
  };
}

export async function createRiseEvidenceReviewStore({ pool = databasePool() } = {}) {
  await pool.query("SELECT 1 FROM rise_runtime.evidence_claim_review_events LIMIT 1");
  const systemKey = "0".repeat(64);
  return {
    scope: "durable_canonical_review",
    async existingClaimIds(claimIds) {
      return withSubject(pool, systemKey, async (client) => {
        const found = new Set();
        for (const batch of chunks([...new Set(claimIds.map(String))], 1_000)) {
          const result = await client.query(`
            SELECT claim_id AS "claimId" FROM rise_runtime.canonical_evidence_claims
            WHERE claim_id = ANY($1::text[])
          `, [batch]);
          for (const row of result.rows) found.add(row.claimId);
        }
        return found;
      }, { isAdmin: true });
    },
    async resolvedAcgmeIds(acgmeIds) {
      return withSubject(pool, systemKey, async (client) => {
        const result = await client.query(`
          SELECT acgme_id::text AS "acgmeId"
          FROM rise_runtime.canonical_program_identities
          WHERE acgme_id = ANY($1::text[]) AND reconciliation_status = 'EXACT_ACGME_MATCH'
        `, [[...new Set(acgmeIds.map(String))]]);
        return new Set(result.rows.map((row) => row.acgmeId));
      }, { isAdmin: true });
    },
    async applyCorpus({
      review,
      actorSubject = "P1-RISE-5012D",
      reviewedAt,
      ticket = "P1-RISE-5012D",
      promotionSourceId = "rise_src_p1_rise_5012d_review",
    }) {
      const timestamp = requiredString(reviewedAt, "reviewedAt");
      if (!Number.isFinite(Date.parse(timestamp))) throw new Error("reviewedAt must be an ISO timestamp");
      const actorSubjectKey = sha256(`rise-evidence-review\0${actorSubject}`);
      const events = review.decisions.map((decision) => reviewEvent(decision, actorSubjectKey, timestamp));
      const eventByClaim = new Map(events.map((event) => [event.sourceClaimId, event]));
      return withSubject(pool, systemKey, async (client) => {
        let insertedReviews = 0;
        for (const batch of chunks(events)) {
          const result = await client.query(`
            INSERT INTO rise_runtime.evidence_claim_review_events (
              review_id, source_claim_id, disposition, reason_code, rule_version,
              normalized_value, source_urls, quality_score, actor_subject_key, decision_sha256,
              overrides_review_id, created_at
            )
            SELECT x.review_id, x.source_claim_id, x.disposition, x.reason_code, x.rule_version,
                   x.normalized_value, x.source_urls, x.quality_score, x.actor_subject_key, x.decision_sha256,
                   x.overrides_review_id, x.created_at
            FROM jsonb_to_recordset($1::jsonb) AS x(
              review_id text, source_claim_id text, disposition text, reason_code text, rule_version text,
              normalized_value jsonb, source_urls jsonb, quality_score integer,
              actor_subject_key char(64), decision_sha256 char(64), overrides_review_id text, created_at timestamptz
            ) ON CONFLICT (decision_sha256) DO NOTHING
          `, [JSON.stringify(batch.map((event) => ({
            review_id: event.reviewId, source_claim_id: event.sourceClaimId, disposition: event.disposition,
            reason_code: event.reasonCode, rule_version: event.ruleVersion, normalized_value: event.normalizedValue,
            source_urls: event.sourceUrls, quality_score: event.qualityScore, actor_subject_key: event.actorSubjectKey,
            decision_sha256: event.decisionSha256, overrides_review_id: event.overridesReviewId, created_at: event.createdAt,
          })))]);
          insertedReviews += result.rowCount;
        }
        const acgmeIds = [...new Set(review.promotions.map((promotion) => promotion.acgmeId))];
        const identities = await client.query(`
          SELECT acgme_id::text AS "acgmeId", program_identity_id AS "subjectId"
          FROM rise_runtime.canonical_program_identities WHERE acgme_id = ANY($1::text[])
        `, [acgmeIds]);
        const subjectByAcgme = new Map(identities.rows.map((row) => [row.acgmeId, row.subjectId]));
        if (subjectByAcgme.size !== acgmeIds.length) throw new Error("Promotion set contains unresolved canonical identities");
        await client.query(`
          INSERT INTO rise_runtime.canonical_evidence_sources (
            source_id, provider, provider_run_id, source_type, source_locator, retrieved_at,
            rights_state, exposure_state, metadata
          ) VALUES ($1, 'MISSIONMED_REVIEW', $2, 'canonical_review_promotion',
                    $3, $4, 'APPROVED', 'PRIVATE_BETA', $5::jsonb)
          ON CONFLICT (source_id) DO NOTHING
        `, [promotionSourceId, ticket, `${ticket}/review-factory`, timestamp,
          JSON.stringify({ ruleVersion: review.ruleVersion, newProviderSpendUsd: 0, ticket })]);
        const promotionRows = review.promotions.map((promotion) => {
          const subjectId = subjectByAcgme.get(promotion.acgmeId);
          const valueSha256 = sha256(promotion.canonicalValue);
          const claimId = stableDatabaseId("rise_claim", `${ticket}:${subjectId}:${promotion.field}:${valueSha256}`);
          return {
            claim_id: claimId, subject_id: subjectId, field: promotion.field,
            knowledge: { state: "known", value: promotion.canonicalValue }, canonical_value: promotion.canonicalValue,
            source_id: promotionSourceId, source_locator: `${ticket}/${promotion.acgmeId}/${promotion.field}`,
            observed_period: { kind: "reviewed_snapshot", label: timestamp.slice(0, 10) }, retrieved_at: timestamp,
            content_sha256: sha256({ ticket, subjectId, field: promotion.field, value: promotion.canonicalValue }),
            supersedes_claim_id: promotion.sourceClaimIds[0], source_claim_ids: promotion.sourceClaimIds,
          };
        });
        let insertedPromotions = 0;
        for (const batch of chunks(promotionRows)) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_claims (
              claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
              publication_state, review_state, conflict_state, source_id, source_locator,
              observed_period, retrieved_at, content_sha256, supersedes_claim_id
            )
            SELECT x.claim_id, x.subject_id, x.field, x.knowledge, x.canonical_value,
                   'source_attributed_reconciled', 'PRIVATE_BETA', 'APPROVED', 'RESOLVED',
                   x.source_id, x.source_locator, x.observed_period, x.retrieved_at,
                   x.content_sha256, x.supersedes_claim_id
            FROM jsonb_to_recordset($1::jsonb) AS x(
              claim_id text, subject_id text, field text, knowledge jsonb, canonical_value jsonb,
              source_id text, source_locator text, observed_period jsonb, retrieved_at timestamptz,
              content_sha256 char(64), supersedes_claim_id text
            ) ON CONFLICT (content_sha256) DO NOTHING
          `, [JSON.stringify(batch)]);
          insertedPromotions += result.rowCount;
        }
        const lineage = promotionRows.flatMap((promotion) => promotion.source_claim_ids.map((sourceClaimId, index) => ({
          promoted_claim_id: promotion.claim_id, source_claim_id: sourceClaimId,
          review_id: eventByClaim.get(sourceClaimId)?.reviewId, contributor_order: index,
        }))).filter((row) => row.review_id);
        let insertedLineage = 0;
        for (const batch of chunks(lineage)) {
          const result = await client.query(`
            INSERT INTO rise_runtime.canonical_claim_promotion_lineage (
              promoted_claim_id, source_claim_id, review_id, contributor_order
            ) SELECT x.promoted_claim_id, x.source_claim_id, x.review_id, x.contributor_order
              FROM jsonb_to_recordset($1::jsonb) AS x(
                promoted_claim_id text, source_claim_id text, review_id text, contributor_order integer
              ) ON CONFLICT (promoted_claim_id, source_claim_id) DO NOTHING
          `, [JSON.stringify(batch)]);
          insertedLineage += result.rowCount;
        }
        return { insertedReviews, insertedPromotions, insertedLineage, reviewCount: events.length, promotionCount: promotionRows.length };
      }, { isAdmin: true });
    },
    async supersedeLegacyClaims({ currentClaimIds, actorSubject = "P1-RISE-5012D", reviewedAt }) {
      const timestamp = requiredString(reviewedAt, "reviewedAt");
      if (!Number.isFinite(Date.parse(timestamp))) throw new Error("reviewedAt must be an ISO timestamp");
      const actorSubjectKey = sha256(`rise-evidence-review\0${actorSubject}`);
      return withSubject(pool, systemKey, async (client) => {
        const result = await client.query(`
          SELECT c.claim_id AS "claimId", c.canonical_value AS value,
                 array_remove(ARRAY[s.source_url], NULL) AS "sourceUrls"
          FROM rise_runtime.canonical_evidence_claims c
          JOIN rise_runtime.canonical_evidence_sources s USING(source_id)
          LEFT JOIN rise_runtime.evidence_claim_review_current r ON r.source_claim_id=c.claim_id
          WHERE s.source_type='completed_research_factory'
            AND NOT (c.claim_id = ANY($1::text[]))
            AND r.source_claim_id IS NULL
          ORDER BY c.claim_id
        `, [[...new Set(currentClaimIds.map(String))]]);
        const events = result.rows.map((row) => reviewEvent({
          claimId: row.claimId,
          disposition: "SUPERSEDED",
          reason: "LEGACY_PROVIDER_CLAIM_SUPERSEDED_BY_5012D_REVIEW",
          ruleVersion: "rise.review.5012d.1",
          normalizedValue: row.value,
          sourceUrls: row.sourceUrls ?? [],
          qualityScore: 0,
        }, actorSubjectKey, timestamp));
        let insertedReviews = 0;
        for (const batch of chunks(events)) {
          const inserted = await client.query(`
            INSERT INTO rise_runtime.evidence_claim_review_events (
              review_id, source_claim_id, disposition, reason_code, rule_version,
              normalized_value, source_urls, quality_score, actor_subject_key, decision_sha256,
              overrides_review_id, created_at
            ) SELECT x.review_id, x.source_claim_id, x.disposition, x.reason_code, x.rule_version,
                     x.normalized_value, x.source_urls, x.quality_score, x.actor_subject_key, x.decision_sha256,
                     x.overrides_review_id, x.created_at
              FROM jsonb_to_recordset($1::jsonb) AS x(
                review_id text, source_claim_id text, disposition text, reason_code text, rule_version text,
                normalized_value jsonb, source_urls jsonb, quality_score integer,
                actor_subject_key char(64), decision_sha256 char(64), overrides_review_id text, created_at timestamptz
              ) ON CONFLICT (decision_sha256) DO NOTHING
          `, [JSON.stringify(batch.map((event) => ({
            review_id: event.reviewId, source_claim_id: event.sourceClaimId, disposition: event.disposition,
            reason_code: event.reasonCode, rule_version: event.ruleVersion, normalized_value: event.normalizedValue,
            source_urls: event.sourceUrls, quality_score: event.qualityScore, actor_subject_key: event.actorSubjectKey,
            decision_sha256: event.decisionSha256, overrides_review_id: event.overridesReviewId, created_at: event.createdAt,
          })))]);
          insertedReviews += inserted.rowCount;
        }
        return { legacyClaims: events.length, insertedReviews };
      }, { isAdmin: true });
    },
    async stats() {
      return withSubject(pool, systemKey, async (client) => {
        const totals = await client.query(`SELECT count(*)::integer AS total FROM rise_runtime.canonical_evidence_claims c JOIN rise_runtime.canonical_evidence_sources s USING(source_id) WHERE s.source_type='completed_research_factory'`);
        const providers = await client.query(`SELECT s.provider, count(*)::integer AS claims FROM rise_runtime.canonical_evidence_claims c JOIN rise_runtime.canonical_evidence_sources s USING(source_id) WHERE s.source_type='completed_research_factory' GROUP BY s.provider ORDER BY s.provider`);
        const dispositions = await client.query(`SELECT coalesce(r.disposition, 'WITHOUT_FINAL_DISPOSITION') AS disposition, count(*)::integer AS claims FROM rise_runtime.canonical_evidence_claims c JOIN rise_runtime.canonical_evidence_sources s USING(source_id) LEFT JOIN rise_runtime.evidence_claim_review_current r ON r.source_claim_id=c.claim_id WHERE s.source_type='completed_research_factory' GROUP BY coalesce(r.disposition, 'WITHOUT_FINAL_DISPOSITION') ORDER BY disposition`);
        const visible = await client.query(`SELECT count(*)::integer AS visible FROM rise_runtime.canonical_current_facts f JOIN rise_runtime.canonical_evidence_sources s USING(source_id) WHERE s.source_type='canonical_review_promotion'`);
        return { totalClaims: totals.rows[0].total, providers: providers.rows, dispositions: dispositions.rows, visiblePromotions: visible.rows[0].visible };
      }, { isAdmin: true });
    },
    async listExceptions({ disposition = null, limit = 100 } = {}) {
      return withSubject(pool, systemKey, async (client) => {
        const result = await client.query(`
          SELECT r.review_id AS "reviewId", r.source_claim_id AS "claimId", r.disposition,
                 r.reason_code AS reason, r.rule_version AS "ruleVersion", r.normalized_value AS value,
                 r.source_urls AS "sourceUrls", s.provider, s.metadata->>'acgmeId' AS "acgmeId", c.field,
                 i.program_name AS "programName", r.created_at AS "reviewedAt"
          FROM rise_runtime.evidence_claim_review_current r
          JOIN rise_runtime.canonical_evidence_claims c ON c.claim_id=r.source_claim_id
          JOIN rise_runtime.canonical_evidence_sources s USING(source_id)
          LEFT JOIN rise_runtime.canonical_program_identities i ON i.program_identity_id=c.subject_id
          WHERE s.source_type='completed_research_factory'
            AND r.disposition NOT IN ('APPROVED_CURRENT','APPROVED_HISTORICAL','RESEARCHED_NOT_FOUND','SUPERSEDED')
            AND ($1::text IS NULL OR r.disposition=$1)
          ORDER BY r.disposition, i.program_name, c.field, c.claim_id LIMIT $2
        `, [disposition, Math.max(1, Math.min(Number(limit) || 100, 250))]);
        return result.rows;
      }, { isAdmin: true });
    },
    async manualDecision({ claimId, disposition, reason, actorSubject }) {
      const allowed = new Set([
        "APPROVED_CURRENT", "APPROVED_HISTORICAL", "RESEARCHED_NOT_FOUND",
        "CONFLICT_REQUIRES_REVIEW", "INSUFFICIENT_EVIDENCE", "STALE_NEEDS_REFRESH",
      ]);
      const nextDisposition = requiredString(disposition, "disposition").toUpperCase();
      const safeReason = requiredString(reason, "reason").slice(0, 480);
      if (!allowed.has(nextDisposition)) throw new Error("Unsupported manual evidence disposition");
      const actorSubjectKey = sha256("rise-evidence-review\0" + requiredString(actorSubject, "actorSubject"));
      return withSubject(pool, actorSubjectKey, async (client) => {
        const current = await client.query(`
          SELECT r.review_id AS "reviewId", r.disposition, r.normalized_value AS value,
                 r.source_urls AS "sourceUrls", r.quality_score AS "qualityScore",
                 c.claim_id AS "claimId", c.field, c.subject_id AS "subjectId",
                 i.acgme_id::text AS "acgmeId"
          FROM rise_runtime.evidence_claim_review_current r
          JOIN rise_runtime.canonical_evidence_claims c ON c.claim_id=r.source_claim_id
          JOIN rise_runtime.canonical_program_identities i ON i.program_identity_id=c.subject_id
          WHERE c.claim_id=$1
          FOR UPDATE OF c
        `, [claimId]);
        if (current.rowCount !== 1) throw researchStoreError("EVIDENCE_CLAIM_NOT_FOUND", "Evidence claim is not available for review", 404);
        const row = current.rows[0];
        if (row.disposition === "APPROVED_CURRENT") {
          throw researchStoreError("EVIDENCE_ALREADY_LIVE", "A live approved claim cannot be demoted through the exception queue", 409);
        }
        if (nextDisposition === "APPROVED_CURRENT"
          && (row.value == null || !Array.isArray(row.sourceUrls) || row.sourceUrls.length === 0)) {
          throw researchStoreError("EVIDENCE_APPROVAL_UNSUPPORTED", "Approval requires a normalized value and at least one preserved source URL", 409);
        }
        const timestamp = new Date().toISOString();
        const event = reviewEvent({
          claimId: row.claimId, disposition: nextDisposition, reason: "manual:" + safeReason,
          ruleVersion: "5012d.manual.1", normalizedValue: row.value,
          sourceUrls: row.sourceUrls ?? [], qualityScore: row.qualityScore,
          overridesReviewId: row.reviewId,
        }, actorSubjectKey, timestamp);
        await client.query(`
          INSERT INTO rise_runtime.evidence_claim_review_events (
            review_id, source_claim_id, disposition, reason_code, rule_version,
            normalized_value, source_urls, quality_score, actor_subject_key, decision_sha256,
            overrides_review_id, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12)
        `, [event.reviewId, event.sourceClaimId, event.disposition, event.reasonCode, event.ruleVersion,
          JSON.stringify(event.normalizedValue), JSON.stringify(event.sourceUrls), event.qualityScore,
          event.actorSubjectKey, event.decisionSha256, event.overridesReviewId, event.createdAt]);
        if (nextDisposition === "APPROVED_CURRENT") {
          const sourceId = "rise_src_p1_rise_5012d_review";
          await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_sources (
              source_id, provider, provider_run_id, source_type, source_locator, retrieved_at,
              rights_state, exposure_state, metadata
            ) VALUES ($1,'MISSIONMED_REVIEW','P1-RISE-5012D','canonical_review_promotion',
                      'P1-RISE-5012D/manual-review',$2,'APPROVED','PRIVATE_BETA',$3::jsonb)
            ON CONFLICT (source_id) DO NOTHING
          `, [sourceId, timestamp, JSON.stringify({ ruleVersion: "5012d.manual.1", newProviderSpendUsd: 0 })]);
          const valueSha256 = sha256(row.value);
          const promotedClaimId = stableDatabaseId("rise_claim", "5012d:" + row.subjectId + ":" + row.field + ":" + valueSha256);
          const contentSha256 = sha256({ ticket: "P1-RISE-5012D", subjectId: row.subjectId, field: row.field, value: row.value });
          await client.query(`
            INSERT INTO rise_runtime.canonical_evidence_claims (
              claim_id, subject_id, field, knowledge, canonical_value, assertion_class,
              publication_state, review_state, conflict_state, source_id, source_locator,
              observed_period, retrieved_at, content_sha256, supersedes_claim_id
            ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,'source_attributed_reconciled',
                      'PRIVATE_BETA','APPROVED','RESOLVED',$6,$7,$8::jsonb,$9,$10,$11)
            ON CONFLICT (content_sha256) DO NOTHING
          `, [promotedClaimId, row.subjectId, row.field, JSON.stringify({ state: "known", value: row.value }),
            JSON.stringify(row.value), sourceId, "P1-RISE-5012D/" + row.acgmeId + "/" + row.field,
            JSON.stringify({ kind: "reviewed_snapshot", label: timestamp.slice(0, 10) }), timestamp,
            contentSha256, row.claimId]);
          await client.query(`
            INSERT INTO rise_runtime.canonical_claim_promotion_lineage (
              promoted_claim_id, source_claim_id, review_id, contributor_order
            ) VALUES ($1,$2,$3,0)
            ON CONFLICT (promoted_claim_id, source_claim_id) DO NOTHING
          `, [promotedClaimId, row.claimId, event.reviewId]);
        }
        return { claimId: row.claimId, disposition: nextDisposition, reviewId: event.reviewId, reviewedAt: timestamp };
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
    reservedSpendUsd: Number(row.reservedSpendUsd ?? 0),
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
    reservedSpendUsd: Number(row.reservedSpendUsd ?? 0),
    concurrencyCap: row.concurrencyCap,
    configuration: row.configuration ?? {},
    revision: Number(row.revision),
    updatedAt: row.updatedAt,
  };
}

function researchJobRecord(row, { admin = false } = {}) {
  if (!row) return null;
  const record = {
    programSpecialtyId: row.programSpecialtyId,
    acgmeId: row.acgmeId,
    specialty: row.specialty,
    state: row.state,
    status: row.status,
    studentStatus: studentResearchStatus(row.status),
    requestClass: row.requestClass ?? row.taskPayload?.requestClass ?? null,
    contractVersion: row.contractVersion ?? row.taskPayload?.contractVersion ?? null,
    dossierOutcome: row.dossierOutcome ?? null,
    completionScore: row.completionScore === null || row.completionScore === undefined
      ? null : Number(row.completionScore),
    researchTimestamp: row.researchTimestamp ?? null,
    completedAt: row.completedAt,
    submittedAt: row.createdAt,
    lastStatusUpdate: row.updatedAt,
  };
  if (admin) Object.assign(record, {
    jobId: row.jobId,
    requestSource: row.requestSource,
    taskClass: row.taskClass,
    taskPayload: row.taskPayload ?? {},
    benchmarkBatchKey: row.benchmarkBatchKey ?? null,
    benchmarkBaseline: row.benchmarkBaseline ?? null,
    providerKey: row.providerKey,
    modelKey: row.modelKey,
    routerRevision: Number(row.routerRevision),
    quotaWindowStart: row.quotaWindowStart,
    estimatedCostUsd: Number(row.estimatedCostUsd),
    actualCostUsd: row.actualCostUsd === null ? null : Number(row.actualCostUsd),
    attemptCount: row.attemptCount,
    resultSummary: row.resultSummary,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    workerId: row.workerId,
    leaseExpiresAt: row.leaseExpiresAt,
    heartbeatAt: row.heartbeatAt,
    errorSummary: row.errorSummary,
    canonicalIngestRunId: row.canonicalIngestRunId,
    resultSchemaVersion: row.resultSchemaVersion ?? null,
    requiredDomains: row.requiredDomains ?? [],
    requestedFields: row.requestedFields ?? [],
    completionMatrix: row.completionMatrix ?? {},
    rootJobId: row.rootJobId ?? null,
    parentJobId: row.parentJobId ?? null,
    stageOrdinal: row.stageOrdinal === null || row.stageOrdinal === undefined ? null : Number(row.stageOrdinal),
    researchStage: row.researchStage ?? null,
  });
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
  reserved_spend_usd AS "reservedSpendUsd",
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
  reserved_spend_usd AS "reservedSpendUsd",
  concurrency_cap AS "concurrencyCap",
  configuration,
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
  task_payload AS "taskPayload",
  contract_version AS "contractVersion",
  result_schema_version AS "resultSchemaVersion",
  request_class AS "requestClass",
  required_domains AS "requiredDomains",
  requested_fields AS "requestedFields",
  completion_matrix AS "completionMatrix",
  completion_score AS "completionScore",
  dossier_outcome AS "dossierOutcome",
  research_timestamp AS "researchTimestamp",
  root_job_id AS "rootJobId",
  parent_job_id AS "parentJobId",
  stage_ordinal AS "stageOrdinal",
  research_stage AS "researchStage",
  student_charge_key AS "studentChargeKey",
  benchmark_batch_key AS "benchmarkBatchKey",
  benchmark_baseline AS "benchmarkBaseline",
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

const AUTHORIZED_PAID_RESEARCH_PROVIDERS = new Set(AUTHORIZED_PROVIDER_KEYS);

function providerReservationUsd(provider) {
  const value = Number(provider?.configuration?.reservationUsd ?? 0);
  if (!Number.isFinite(value) || value <= 0 || value > AUTHORIZED_COMBINED_SPEND_USD) {
    throw researchStoreError("RESEARCH_PROVIDER_COST_INVALID", "The provider cost reservation is invalid");
  }
  return Math.ceil(value * 10_000) / 10_000;
}

function isReplayRoute(provider) {
  // 5012A legacy invariant remains exact for replay jobs: actual_cost_usd = 0.
  return provider?.providerKey === "RISE_REPLAY_TEST"
    && provider.state === "TEST_ONLY" && provider.enabled
    && !provider.networkAllowed && !provider.spendAllowed;
}

function isPaidRoute(provider, states = ["PRODUCTION_APPROVED"]) {
  return AUTHORIZED_PAID_RESEARCH_PROVIDERS.has(provider?.providerKey)
    && states.includes(provider.state) && provider.enabled
    && provider.networkAllowed && provider.spendAllowed;
}

function programResearchPayload(program, routing = null) {
  return {
    programName: String(program?.display?.programName ?? "").slice(0, 256),
    institution: String(program?.display?.institution ?? "").slice(0, 256),
    city: String(program?.display?.city ?? "").slice(0, 128),
    officialUrls: [...new Set((program?.source?.urls ?? []).filter((url) => String(url).startsWith("https://")))].slice(0, 8),
    contractId: DEEP_RESEARCH_DOSSIER_V2.contractId,
    contractVersion: DEEP_RESEARCH_DOSSIER_V2.contractVersion,
    resultSchemaVersion: DEEP_RESEARCH_DOSSIER_V2.resultSchemaVersion,
    requestClass: routing?.requestClass ?? "FULL",
    requiredDomains: [...DEEP_RESEARCH_DOMAIN_KEYS],
    requestedDomains: routing?.requestedDomains ?? [...DEEP_RESEARCH_DOMAIN_KEYS],
    requestedFields: routing?.requestedFields ?? DEEP_RESEARCH_DOSSIER_V2.domains.flatMap((domain) => domain.fields),
    baselineCompletionMatrix: routing?.completion?.matrix ?? {},
  };
}

function quotaRecord(row, controls) {
  const quotaLimit = Number(row?.quotaLimit ?? controls.defaultQuota);
  const reservedCount = Number(row?.reservedCount ?? 0);
  const consumedCount = Number(row?.consumedCount ?? 0);
  return {
    windowStart: row?.windowStart ?? new Date().toISOString().slice(0, 10),
    windowEnd: row?.windowEnd ?? null,
    quotaLimit,
    reservedCount,
    consumedCount,
    refundedCount: Number(row?.refundedCount ?? 0),
    used: reservedCount + consumedCount,
    remaining: Math.max(0, quotaLimit - reservedCount - consumedCount),
  };
}

async function readResearchQuota(client, subjectKeyValue, controls, { lock = false } = {}) {
  const result = await client.query(`
    SELECT window_start::text AS "windowStart", window_end::text AS "windowEnd",
           quota_limit AS "quotaLimit", reserved_count AS "reservedCount",
           consumed_count AS "consumedCount", refunded_count AS "refundedCount"
    FROM rise_runtime.research_quota_ledgers
    WHERE subject_key = $1 AND current_date >= window_start AND current_date < window_end
    ORDER BY window_start DESC LIMIT 1
    ${lock ? "FOR UPDATE" : ""}
  `, [subjectKeyValue]);
  const row = result.rows[0];
  if (!row) return quotaRecord(row, controls);
  // The control-plane default is the current entitlement truth. Existing
  // ledgers are reconciled on reservation, so eligibility/readback must show
  // the same effective limit instead of a stale pre-activation value.
  return quotaRecord({
    ...row,
    quotaLimit: Math.max(
      Number(controls.defaultQuota),
      Number(row.reservedCount || 0) + Number(row.consumedCount || 0),
    ),
  }, controls);
}

async function readDossierContext(client, acgmeId) {
  const [latest, fields] = await Promise.all([
    client.query(`
      SELECT completion_matrix AS "completionMatrix", research_timestamp AS "researchTimestamp",
             completion_score AS "completionScore", dossier_outcome AS "dossierOutcome",
             status, completed_at AS "completedAt"
      FROM rise_runtime.research_jobs
      WHERE acgme_id = $1 AND contract_version = $2 AND status IN ('COMPLETED','PARTIAL')
      ORDER BY research_timestamp DESC NULLS LAST, completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `, [acgmeId, DEEP_RESEARCH_DOSSIER_V2.contractVersion]),
    client.query(`
      SELECT array_agg(DISTINCT f.field ORDER BY f.field) AS fields
      FROM rise_runtime.canonical_current_facts f
      LEFT JOIN rise_runtime.canonical_program_identities i ON i.program_identity_id = f.subject_id
      LEFT JOIN rise_runtime.canonical_evidence_sources s ON s.source_id = f.source_id
      WHERE coalesce(i.acgme_id::text, s.metadata->>'acgmeId') = $1
    `, [acgmeId]),
  ]);
  const row = latest.rows[0] ?? {};
  const routing = classifyDossierRequest({
    completionMatrix: row.completionMatrix ?? {},
    approvedFields: fields.rows[0]?.fields ?? [],
    researchedAt: row.researchTimestamp ?? row.completedAt ?? null,
  });
  return {
    ...routing,
    prior: latest.rows[0] ? {
      status: studentResearchStatus(row.status),
      completionScore: Number(row.completionScore ?? routing.completion.completionScore),
      dossierOutcome: row.dossierOutcome ?? routing.completion.outcome,
      researchTimestamp: row.researchTimestamp ?? row.completedAt ?? null,
    } : null,
  };
}

async function reserveResearchSpend(client, { jobId, provider, estimatedCostUsd }) {
  if (estimatedCostUsd === 0) return;
  const router = await client.query(`
    UPDATE rise_runtime.research_router_settings
    SET reserved_spend_usd = reserved_spend_usd + $1, updated_at = now()
    WHERE control_id = true
      AND actual_spend_usd + reserved_spend_usd + $1 <= budget_cap_usd
      AND budget_cap_usd <= $2
    RETURNING actual_spend_usd AS actual, reserved_spend_usd AS reserved
  `, [estimatedCostUsd, AUTHORIZED_COMBINED_SPEND_USD]);
  if (router.rowCount !== 1) throw researchStoreError("RESEARCH_BUDGET_EXHAUSTED", "The combined OpenAI research budget is exhausted", 409);
  const route = await client.query(`
    UPDATE rise_runtime.research_provider_routes
    SET reserved_spend_usd = reserved_spend_usd + $2, updated_at = now()
    WHERE provider_key = $1
      AND actual_spend_usd + reserved_spend_usd + $2 <= budget_cap_usd
    RETURNING actual_spend_usd AS actual, reserved_spend_usd AS reserved
  `, [provider.providerKey, estimatedCostUsd]);
  if (route.rowCount !== 1) throw researchStoreError("RESEARCH_PROVIDER_BUDGET_EXHAUSTED", "The provider research budget is exhausted", 409);
  const eventKey = sha256(`P1-RISE-5012E\0RESERVE\0${jobId}\0${estimatedCostUsd}`);
  await client.query(`
    INSERT INTO rise_runtime.research_spend_ledger (
      event_key, job_id, provider_key, model_key, event_type, amount_usd,
      cumulative_actual_usd, cumulative_reserved_usd, usage
    ) VALUES ($1,$2,$3,$4,'RESERVE',$5,$6,$7,'{}'::jsonb)
    ON CONFLICT (event_key) DO NOTHING
  `, [eventKey, jobId, provider.providerKey, provider.modelKey, estimatedCostUsd,
    Number(router.rows[0].actual), Number(router.rows[0].reserved)]);
}

async function reconcileResearchSpend(client, {
  jobId, providerKey, modelKey, estimatedCostUsd, actualCostUsd,
  usage = {}, providerResponseId = null, unknown = false,
}) {
  const estimated = Number(estimatedCostUsd ?? 0);
  const actual = Math.ceil(Math.max(0, Number(actualCostUsd ?? 0)) * 10_000) / 10_000;
  if (actual > AUTHORIZED_COMBINED_SPEND_USD) {
    throw researchStoreError("RESEARCH_ACTUAL_COST_INVALID", "Provider cost exceeds the authorized combined cap");
  }
  if (estimated === 0 && actual === 0) return;
  const router = await client.query(`
    UPDATE rise_runtime.research_router_settings
    SET reserved_spend_usd = reserved_spend_usd - $1,
        actual_spend_usd = actual_spend_usd + $2,
        updated_at = now()
    WHERE control_id = true AND reserved_spend_usd >= $1
      AND actual_spend_usd + reserved_spend_usd - $1 + $2 <= budget_cap_usd
      AND budget_cap_usd <= $3
    RETURNING actual_spend_usd AS actual, reserved_spend_usd AS reserved
  `, [estimated, actual, AUTHORIZED_COMBINED_SPEND_USD]);
  if (router.rowCount !== 1) throw researchStoreError("RESEARCH_COST_RECONCILIATION_FAILED", "Combined cost reconciliation failed closed");
  const route = await client.query(`
    UPDATE rise_runtime.research_provider_routes
    SET reserved_spend_usd = reserved_spend_usd - $2,
        actual_spend_usd = actual_spend_usd + $3,
        updated_at = now()
    WHERE provider_key = $1 AND reserved_spend_usd >= $2
      AND actual_spend_usd + reserved_spend_usd - $2 + $3 <= budget_cap_usd
    RETURNING actual_spend_usd AS actual, reserved_spend_usd AS reserved
  `, [providerKey, estimated, actual]);
  if (route.rowCount !== 1) throw researchStoreError("RESEARCH_PROVIDER_COST_RECONCILIATION_FAILED", "Provider cost reconciliation failed closed");
  const eventType = unknown ? "UNKNOWN_COST_CHARGE" : (actual === 0 ? "RELEASE" : "RECONCILE");
  const eventKey = sha256(`P1-RISE-5012E\0${eventType}\0${jobId}\0${actual}`);
  await client.query(`
    INSERT INTO rise_runtime.research_spend_ledger (
      event_key, job_id, provider_key, model_key, event_type, amount_usd,
      cumulative_actual_usd, cumulative_reserved_usd, usage, provider_response_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
    ON CONFLICT (event_key) DO NOTHING
  `, [eventKey, jobId, providerKey, modelKey, eventType, actual,
    Number(router.rows[0].actual), Number(router.rows[0].reserved), JSON.stringify(usage ?? {}), providerResponseId]);
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
                 emergency_kill_switch AS "emergencyKillSwitch",
                 actual_spend_usd AS "actualSpendUsd",
                 reserved_spend_usd AS "reservedSpendUsd"
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
        if (controls.budgetCapUsd > AUTHORIZED_COMBINED_SPEND_USD
          || controls.budgetCapUsd < before.controls.actualSpendUsd + before.controls.reservedSpendUsd) {
          throw researchStoreError("RESEARCH_BUDGET_NOT_AUTHORIZED", "The RISE research budget must preserve current spend and remain within the $12.00 authorization");
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
      if (route.providerKey !== "RISE_REPLAY_TEST" && !AUTHORIZED_PAID_RESEARCH_PROVIDERS.has(route.providerKey)
        && (route.enabled || route.state !== "PAUSED")) {
        throw researchStoreError("RESEARCH_PROVIDER_NOT_AUTHORIZED", "Only the authorized OpenAI Terra and Sol routes may be activated");
      }
      if (AUTHORIZED_PAID_RESEARCH_PROVIDERS.has(route.providerKey) && route.budgetCapUsd > 6) {
        throw researchStoreError("RESEARCH_PROVIDER_BUDGET_NOT_AUTHORIZED", "Each authorized OpenAI route is capped at $6.00");
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
        if (!(isReplayRoute(provider) || isPaidRoute(provider))) eligibility.reasons.push("PROVIDER_NOT_PRODUCTION_APPROVED");
        eligibility.eligible = eligibility.reasons.length === 0;
        const dossier = eligibility.scope.acgmeId
          ? await readDossierContext(client, eligibility.scope.acgmeId)
          : classifyDossierRequest();
        const active = eligibility.scope.programSpecialtyId ? await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION}
          FROM rise_runtime.research_jobs
          WHERE program_specialty_id = $1 AND task_class = 'PROGRAM_DEEP_RESEARCH'
            AND status IN ('QUEUED','LEASED','RUNNING','NORMALIZING','PROMOTING','NEEDS_REVIEW')
          ORDER BY created_at DESC LIMIT 1
        `, [eligibility.scope.programSpecialtyId]) : { rows: [] };
        const quota = await readResearchQuota(client, key, controls);
        return {
          ...eligibility,
          requestClass: active.rows[0] ? "ACTIVE" : dossier.requestClass,
          requestedDomains: dossier.requestedDomains,
          requestedFields: dossier.requestedFields,
          dossier: dossier.prior ?? {
            completionScore: dossier.completion.completionScore,
            dossierOutcome: dossier.completion.outcome,
            researchTimestamp: null,
          },
          activeJob: researchJobRecord(active.rows[0]),
          quota,
          chargeRequired: !active.rows[0] && dossier.requestClass !== "NO_OP",
        };
      }, { isAdmin: true });
    },
    async readQuota({ subject }) {
      const key = subjectKey(subject, hmacKey);
      return withSubject(pool, key, async (client) => {
        const { controls } = await readResearchControls(client);
        return readResearchQuota(client, key, controls);
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
        if (!(isReplayRoute(provider) || isPaidRoute(provider))) {
          throw researchStoreError("RESEARCH_PROVIDER_NOT_AUTHORIZED", "The selected provider is not production-approved for on-demand research");
        }
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [eligibility.scope.programSpecialtyId]);
        const existing = await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION}
          FROM rise_runtime.research_jobs
          WHERE program_specialty_id = $1
            AND task_class = 'PROGRAM_DEEP_RESEARCH'
            AND status IN ('QUEUED','LEASED','RUNNING','NORMALIZING','PROMOTING','NEEDS_REVIEW')
          ORDER BY created_at DESC
          LIMIT 1
        `, [eligibility.scope.programSpecialtyId]);
        if (existing.rowCount === 1) {
          return {
            job: researchJobRecord(existing.rows[0]), deduplicated: true, quotaReserved: false,
            requestClass: "ACTIVE", quota: await readResearchQuota(client, key, controls),
          };
        }
        const routing = await readDossierContext(client, eligibility.scope.acgmeId);
        if (routing.requestClass === "NO_OP") {
          return {
            job: null, deduplicated: true, noOp: true, quotaReserved: false,
            requestClass: "NO_OP", dossier: routing.prior,
            quota: await readResearchQuota(client, key, controls),
          };
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
        } else {
          quota = await client.query(`
            UPDATE rise_runtime.research_quota_ledgers
            SET quota_limit = greatest($2::integer, reserved_count + consumed_count), updated_at = now()
            WHERE subject_key = $1 AND window_start = $3::date
            RETURNING subject_key, window_start::text AS "windowStart", window_end::text AS "windowEnd",
                      quota_limit AS "quotaLimit", reserved_count AS "reservedCount",
                      consumed_count AS "consumedCount", refunded_count AS "refundedCount"
          `, [key, controls.defaultQuota, quota.rows[0].windowStart]);
        }
        const ledger = quota.rows[0];
        const beforeQuota = quotaRecord(ledger, controls);
        if (beforeQuota.used >= beforeQuota.quotaLimit) {
          throw researchStoreError("RESEARCH_QUOTA_EXHAUSTED", "The current research quota is exhausted", 429, {
            windowEnd: beforeQuota.windowEnd,
          });
        }
        const dedupeKey = researchDedupeKey({
          programSpecialtyId: eligibility.scope.programSpecialtyId,
          taskClass: `PROGRAM_${routing.requestClass}_RESEARCH`,
          providerKey: provider.providerKey,
          windowKey: sha256(`${ledger.windowStart}\0${routing.requestedDomains.join(",")}`).slice(0, 32),
        });
        const estimatedCostUsd = isReplayRoute(provider) ? 0 : providerReservationUsd(provider);
        const jobId = randomUUID();
        const inserted = await client.query(`
          INSERT INTO rise_runtime.research_jobs (
            job_id, dedupe_key, release_id, program_specialty_id, acgme_id, specialty, state_code,
            requester_subject_key, request_source, provider_key, model_key, router_revision,
            quota_window_start, estimated_cost_usd, task_payload, contract_version,
            result_schema_version, request_class, required_domains, requested_fields,
            completion_matrix, completion_score, dossier_outcome,
            root_job_id, parent_job_id, stage_ordinal, research_stage, student_charge_key
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,
                    $19::text[],$20::text[],$21::jsonb,$22,$23,$1,NULL,1,$24,$8)
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [
          jobId, dedupeKey, releaseId, eligibility.scope.programSpecialtyId, eligibility.scope.acgmeId,
          eligibility.scope.specialty, eligibility.scope.state, key, eligibility.source,
          provider.providerKey, provider.modelKey, controls.revision, ledger.windowStart,
          estimatedCostUsd, JSON.stringify(programResearchPayload(program, routing)),
          DEEP_RESEARCH_DOSSIER_V2.contractVersion, DEEP_RESEARCH_DOSSIER_V2.resultSchemaVersion,
          routing.requestClass, DEEP_RESEARCH_DOMAIN_KEYS, routing.requestedFields,
          JSON.stringify(routing.completion.matrix), routing.completion.completionScore, routing.completion.outcome,
          routing.requestClass === "FULL" ? "TERRA_FULL" : "TERRA_DELTA",
        ]);
        await reserveResearchSpend(client, { jobId, provider, estimatedCostUsd });
        await client.query(`
          UPDATE rise_runtime.research_quota_ledgers
          SET reserved_count = reserved_count + 1, updated_at = now()
          WHERE subject_key = $1 AND window_start = $2
        `, [key, ledger.windowStart]);
        await client.query(`
          INSERT INTO rise_runtime.research_control_audit_events (
            actor_subject_key, action, target_type, target_id, after_state, reason
          ) VALUES ($1, 'RESERVE_JOB', 'JOB', $2, $3::jsonb, 'P1-RISE-5012F dossier v2 bounded canary reservation')
        `, [key, inserted.rows[0].jobId, JSON.stringify(researchJobRecord(inserted.rows[0], { admin: true }))]);
        return {
          job: researchJobRecord(inserted.rows[0]), deduplicated: false, quotaReserved: true,
          requestClass: routing.requestClass,
          quota: { ...beforeQuota, reservedCount: beforeQuota.reservedCount + 1, used: beforeQuota.used + 1, remaining: beforeQuota.remaining - 1 },
        };
      }, { isAdmin: true });
    },
    async reserveBenchmarkJobs({ subject, releaseId, programs, providerKeys, batchKey }) {
      const key = subjectKey(subject, hmacKey);
      const safeBatchKey = requiredString(batchKey, "benchmark batch key").slice(0, 64);
      if (!Array.isArray(programs) || programs.length < 1 || programs.length > 12) {
        throw researchStoreError("RESEARCH_BENCHMARK_SCOPE_INVALID", "Benchmark scope must contain 1 to 12 programs");
      }
      const requestedProviders = [...new Set(providerKeys ?? [])];
      if (!requestedProviders.length || requestedProviders.some((providerKey) => !AUTHORIZED_PAID_RESEARCH_PROVIDERS.has(providerKey))) {
        throw researchStoreError("RESEARCH_BENCHMARK_PROVIDER_INVALID", "Benchmark providers must be authorized Terra or Sol routes");
      }
      return withSubject(pool, key, async (client) => {
        const { controls, providers: routes } = await readResearchControls(client, { lock: true });
        if (!controls.globalEnabled || controls.emergencyKillSwitch) {
          throw researchStoreError("RESEARCH_BENCHMARK_PAUSED", "Benchmark execution requires the global router enabled with the kill switch clear");
        }
        const routesByKey = new Map(routes.map((route) => [route.providerKey, route]));
        for (const providerKey of requestedProviders) {
          if (!isPaidRoute(routesByKey.get(providerKey), ["BENCHMARKING", "PRODUCTION_APPROVED"])) {
            throw researchStoreError("RESEARCH_BENCHMARK_PROVIDER_PAUSED", `${providerKey} is not enabled for benchmarking`);
          }
        }
        await client.query(`
          INSERT INTO rise_runtime.research_quota_ledgers (
            subject_key, window_start, window_end, quota_limit
          ) VALUES ($1, current_date, current_date + $2::integer, 100)
          ON CONFLICT (subject_key, window_start) DO NOTHING
        `, [key, controls.quotaWindowDays]);
        const jobs = [];
        for (const program of programs) {
          const descriptor = programDescriptor(program);
          if (!descriptor.programSpecialtyId || !descriptor.acgmeId || !descriptor.state) {
            throw researchStoreError("RESEARCH_BENCHMARK_IDENTITY_INVALID", "Benchmark program identity is incomplete");
          }
          for (const providerKey of requestedProviders) {
            const provider = routesByKey.get(providerKey);
            const windowKey = sha256(safeBatchKey).slice(0, 32);
            const dedupeKey = researchDedupeKey({
              programSpecialtyId: descriptor.programSpecialtyId,
              taskClass: "PROVIDER_BENCHMARK",
              providerKey,
              windowKey,
            });
            const existing = await client.query(`
              SELECT ${RESEARCH_JOB_PROJECTION} FROM rise_runtime.research_jobs
              WHERE dedupe_key = $1 LIMIT 1
            `, [dedupeKey]);
            if (existing.rowCount === 1) {
              jobs.push(researchJobRecord(existing.rows[0], { admin: true }));
              continue;
            }
            const estimatedCostUsd = providerReservationUsd(provider);
            const jobId = randomUUID();
            const inserted = await client.query(`
              INSERT INTO rise_runtime.research_jobs (
                job_id, dedupe_key, release_id, program_specialty_id, acgme_id, specialty, state_code,
                requester_subject_key, request_source, task_class, status, provider_key, model_key,
                router_revision, quota_window_start, estimated_cost_usd, task_payload,
                benchmark_batch_key, benchmark_baseline
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ADMIN','PROVIDER_BENCHMARK','QUEUED',$9,$10,$11,
                        current_date,$12,$13::jsonb,$14,$15::jsonb)
              RETURNING ${RESEARCH_JOB_PROJECTION}
            `, [
              jobId, dedupeKey, releaseId, descriptor.programSpecialtyId, descriptor.acgmeId,
              descriptor.specialty, descriptor.state, key, providerKey, provider.modelKey,
              controls.revision, estimatedCostUsd, JSON.stringify(programResearchPayload(program)), safeBatchKey,
              JSON.stringify({ source: "FROZEN_PARALLEL", acgmeId: descriptor.acgmeId, immutable: true }),
            ]);
            await reserveResearchSpend(client, { jobId, provider, estimatedCostUsd });
            jobs.push(researchJobRecord(inserted.rows[0], { admin: true }));
          }
        }
        return { batchKey: safeBatchKey, jobs };
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
        const expired = await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION}, requester_subject_key AS "requesterSubjectKey"
          FROM rise_runtime.research_jobs
          WHERE status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at <= now()
          FOR UPDATE
        `);
        for (const row of expired.rows) {
          if (row.attemptCount < 3) {
            await client.query(`
              UPDATE rise_runtime.research_jobs SET status='QUEUED', lease_token=NULL,
                lease_expires_at=NULL, worker_id=NULL, heartbeat_at=NULL, updated_at=now()
              WHERE job_id=$1
            `, [row.jobId]);
            continue;
          }
          await client.query(`
            UPDATE rise_runtime.research_jobs SET status='REFUNDED', error_code='WORKER_LEASE_EXHAUSTED',
              error_summary='Worker lease expired three times', actual_cost_usd=0, completed_at=now(),
              lease_token=NULL, lease_expires_at=NULL, worker_id=NULL, heartbeat_at=NULL, updated_at=now()
            WHERE job_id=$1
          `, [row.jobId]);
          if (row.taskClass === "PROGRAM_DEEP_RESEARCH") {
            await client.query(`
              UPDATE rise_runtime.research_quota_ledgers
              SET reserved_count=reserved_count-1, refunded_count=refunded_count+1, updated_at=now()
              WHERE subject_key=$1 AND window_start=$2 AND reserved_count>0
            `, [row.requesterSubjectKey, row.quotaWindowStart]);
          }
          await reconcileResearchSpend(client, {
            jobId: row.jobId, providerKey: row.providerKey, modelKey: row.modelKey,
            estimatedCostUsd: row.estimatedCostUsd, actualCostUsd: 0,
          });
        }
        const active = await client.query(`
          SELECT count(*)::integer AS count
          FROM rise_runtime.research_jobs
          WHERE status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
        `);
        if (active.rows[0].count >= controls.concurrencyCap) return null;
        const selected = await client.query(`
          SELECT j.job_id, j.provider_key AS "providerKey", p.concurrency_cap AS "providerConcurrencyCap"
          FROM rise_runtime.research_jobs j
          JOIN rise_runtime.research_provider_routes p USING(provider_key)
          WHERE j.status = 'QUEUED' AND p.enabled = true
            AND (
              (j.task_class = 'PROVIDER_BENCHMARK' AND p.provider_key IN ('OPENAI_TERRA','OPENAI_SOL')
                AND p.state IN ('BENCHMARKING','PRODUCTION_APPROVED') AND p.network_allowed AND p.spend_allowed)
              OR
              (j.task_class = 'PROGRAM_DEEP_RESEARCH' AND j.provider_key = ANY($1::text[]) AND (
                (p.provider_key = 'RISE_REPLAY_TEST' AND p.state='TEST_ONLY' AND NOT p.network_allowed AND NOT p.spend_allowed)
                OR (p.provider_key IN ('OPENAI_TERRA','OPENAI_SOL') AND p.state='PRODUCTION_APPROVED' AND p.network_allowed AND p.spend_allowed)
              ))
            )
          ORDER BY CASE WHEN j.task_class='PROVIDER_BENCHMARK' THEN 0 ELSE 1 END, j.created_at, j.job_id
          LIMIT 1
          FOR UPDATE OF j SKIP LOCKED -- queue safety contract: FOR UPDATE SKIP LOCKED
        `, [[controls.primaryProvider, controls.fallbackProvider, controls.escalationProvider].filter(Boolean)]);
        if (selected.rowCount === 0) return null;
        const selectedProvider = providers.find((provider) => provider.providerKey === selected.rows[0].providerKey);
        if (!selectedProvider) return null;
        const providerActive = await client.query(`
          SELECT count(*)::integer AS count FROM rise_runtime.research_jobs
          WHERE provider_key=$1 AND status IN ('LEASED','RUNNING','NORMALIZING','PROMOTING')
            AND lease_expires_at > now()
        `, [selectedProvider.providerKey]);
        if (providerActive.rows[0].count >= selected.rows[0].providerConcurrencyCap) return null;
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
    async transitionJob({ jobId, leaseToken, workerId, status, leaseSeconds = 180 }) {
      if (!new Set(["RUNNING", "NORMALIZING", "PROMOTING"]).has(status)) {
        throw researchStoreError("RESEARCH_JOB_TRANSITION_INVALID", "Research job transition is invalid");
      }
      return withSubject(pool, systemKey, async (client) => {
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = $4, heartbeat_at = now(), lease_expires_at = now() + make_interval(secs => $5), updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, status, Math.min(300, Math.max(15, Number(leaseSeconds) || 180))]);
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
    async completeJob({
      jobId, leaseToken, workerId, status = "COMPLETED", resultSummary,
      canonicalIngestRunId = null, actualCostUsd = 0, usage = {}, providerResponseId = null,
      dossier = null,
    }) {
      if (!new Set(["COMPLETED", "PARTIAL", "NEEDS_REVIEW"]).has(status)) {
        throw researchStoreError("RESEARCH_JOB_TRANSITION_INVALID", "Research completion state is invalid");
      }
      return withSubject(pool, systemKey, async (client) => {
        const selected = await client.query(`
          SELECT requester_subject_key, quota_window_start, attempt_count, provider_key, model_key,
                 task_class, estimated_cost_usd, contract_version, task_payload,
                 root_job_id, stage_ordinal
          FROM rise_runtime.research_jobs
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
            AND lease_expires_at > now()
          FOR UPDATE
        `, [jobId, leaseToken, workerId]);
        if (selected.rowCount !== 1) throw researchStoreError("RESEARCH_JOB_LEASE_LOST", "Research worker lease is no longer valid", 409);
        await reconcileResearchSpend(client, {
          jobId, providerKey: selected.rows[0].provider_key, modelKey: selected.rows[0].model_key,
          estimatedCostUsd: selected.rows[0].estimated_cost_usd, actualCostUsd,
          usage, providerResponseId,
        });
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = $4, result_summary = $5::jsonb, canonical_ingest_run_id = $6,
            actual_cost_usd = $7, completed_at = now(), lease_token = NULL,
            lease_expires_at = NULL, heartbeat_at = now(), updated_at = now(),
            completion_matrix = coalesce($8::jsonb, completion_matrix),
            completion_score = coalesce($9::numeric, completion_score),
            dossier_outcome = coalesce($10, dossier_outcome),
            research_timestamp = coalesce($11::timestamptz, research_timestamp),
            result_schema_version = coalesce($12, result_schema_version)
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [
          jobId, leaseToken, workerId, status, JSON.stringify(resultSummary ?? {}), canonicalIngestRunId, actualCostUsd,
          dossier?.completionMatrix ? JSON.stringify(dossier.completionMatrix) : null,
          dossier?.completionScore ?? null, dossier?.dossierOutcome ?? null,
          dossier?.researchTimestamp ?? null, dossier?.resultSchemaVersion ?? null,
        ]);
        const job = updated.rows[0];
        if (selected.rows[0].task_class === "PROGRAM_DEEP_RESEARCH"
          && (selected.rows[0].stage_ordinal === null || Number(selected.rows[0].stage_ordinal) === 1)) {
          await client.query(`
            UPDATE rise_runtime.research_quota_ledgers
            SET reserved_count = reserved_count - 1, consumed_count = consumed_count + 1, updated_at = now()
            WHERE subject_key = $1 AND window_start = $2 AND reserved_count > 0
          `, [selected.rows[0].requester_subject_key, selected.rows[0].quota_window_start]);
        }
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id,
            metadata, finished_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
          ON CONFLICT (job_id, attempt_number, status) DO NOTHING
        `, [jobId, job.attemptCount, job.providerKey, job.modelKey, status, workerId,
          JSON.stringify({
            newSpendUsd: Number(actualCostUsd ?? 0), canonicalIngestRunId, providerResponseId, usage,
            contractVersion: job.contractVersion, resultSchemaVersion: job.resultSchemaVersion,
            requestClass: job.requestClass, dossierOutcome: job.dossierOutcome,
          })]);
        return researchJobRecord(job, { admin: true });
      }, { isAdmin: true });
    },
    async scheduleFollowup({ completedJob }) {
      if (!completedJob?.jobId || completedJob.status !== "PARTIAL") {
        return { scheduled: false, reason: "NOT_PARTIAL" };
      }
      return withSubject(pool, systemKey, async (client) => {
        const parentResult = await client.query(`
          SELECT ${RESEARCH_JOB_PROJECTION},
                 requester_subject_key AS "requesterSubjectKey",
                 release_id AS "releaseId"
          FROM rise_runtime.research_jobs
          WHERE job_id = $1 AND task_class = 'PROGRAM_DEEP_RESEARCH'
            AND status = 'PARTIAL'
          FOR UPDATE
        `, [completedJob.jobId]);
        if (parentResult.rowCount !== 1) return { scheduled: false, reason: "PARENT_NOT_PARTIAL" };
        const parent = parentResult.rows[0];
        const stageOrdinal = Number(parent.stageOrdinal ?? 1);
        if (stageOrdinal >= 3) return { scheduled: false, reason: "TERMINAL_STAGE" };
        if (!new Set(["TERRA_FULL", "TERRA_DELTA"]).has(parent.researchStage)) {
          return { scheduled: false, reason: parent.researchStage === "SOL_CRITICAL_RESIDUE" ? "TERMINAL_STAGE" : "LEGACY_JOB" };
        }

        const { controls, providers } = await readResearchControls(client, { lock: true });
        if (!controls.globalEnabled || controls.emergencyKillSwitch
          || (parent.requestSource === "STUDENT" && !controls.studentEnabled)) {
          return { scheduled: false, reason: "ROUTER_PAUSED" };
        }

        const routing = classifyDossierRequest({
          completionMatrix: parent.completionMatrix ?? {},
          researchedAt: parent.researchTimestamp ?? parent.completedAt ?? null,
        });
        if (routing.requestClass === "NO_OP" || !routing.requestedDomains.length) {
          return { scheduled: false, reason: "NO_RESIDUE" };
        }

        const nextStageOrdinal = stageOrdinal + 1;
        const nextStage = parent.researchStage === "TERRA_FULL" ? "TERRA_DELTA" : "SOL_CRITICAL_RESIDUE";
        const providerKey = nextStage === "TERRA_DELTA" ? "OPENAI_TERRA" : "OPENAI_SOL";
        const provider = providers.find((candidate) => candidate.providerKey === providerKey);
        if (!isPaidRoute(provider)) return { scheduled: false, reason: `${providerKey}_NOT_APPROVED` };

        let requestedDomains = routing.requestedDomains;
        if (nextStage === "SOL_CRITICAL_RESIDUE") {
          const criticalDomains = new Set(DEEP_RESEARCH_DOSSIER_V2.domains
            .filter((domain) => domain.critical).map((domain) => domain.key));
          requestedDomains = routing.requestedDomains.filter((domain) => criticalDomains.has(domain));
          if (!requestedDomains.length) return { scheduled: false, reason: "NO_CRITICAL_RESIDUE" };
        }
        const requestedFields = [...new Set(DEEP_RESEARCH_DOSSIER_V2.domains
          .filter((domain) => requestedDomains.includes(domain.key))
          .flatMap((domain) => domain.fields))];
        if (!requestedFields.length) return { scheduled: false, reason: "NO_REQUESTED_FIELDS" };

        const rootJobId = parent.rootJobId ?? parent.jobId;
        const childJobId = randomUUID();
        const estimatedCostUsd = providerReservationUsd(provider);
        const taskPayload = {
          ...(parent.taskPayload ?? {}),
          requestClass: "DELTA",
          requestedDomains,
          requestedFields,
          baselineCompletionMatrix: parent.completionMatrix ?? {},
          parentJobId: parent.jobId,
          rootJobId,
          researchStage: nextStage,
        };
        const dedupeKey = researchDedupeKey({
          programSpecialtyId: parent.programSpecialtyId,
          taskClass: `PROGRAM_DEEP_RESEARCH_${nextStage}`,
          providerKey,
          windowKey: rootJobId,
        });
        const inserted = await client.query(`
          INSERT INTO rise_runtime.research_jobs (
            job_id, dedupe_key, release_id, program_specialty_id, acgme_id, specialty, state_code,
            requester_subject_key, request_source, provider_key, model_key, router_revision,
            quota_window_start, estimated_cost_usd, task_payload, contract_version,
            result_schema_version, request_class, required_domains, requested_fields,
            completion_matrix, completion_score, dossier_outcome,
            root_job_id, parent_job_id, stage_ordinal, research_stage, student_charge_key
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,'DELTA',
            $18::text[],$19::text[],$20::jsonb,$21,$22,$23,$24,$25,$26,$27
          )
          ON CONFLICT (root_job_id, stage_ordinal) WHERE root_job_id IS NOT NULL DO NOTHING
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [
          childJobId, dedupeKey, parent.releaseId, parent.programSpecialtyId, parent.acgmeId,
          parent.specialty, parent.state, parent.requesterSubjectKey, parent.requestSource,
          provider.providerKey, provider.modelKey, controls.revision, parent.quotaWindowStart,
          estimatedCostUsd, JSON.stringify(taskPayload), DEEP_RESEARCH_DOSSIER_V2.contractVersion,
          DEEP_RESEARCH_DOSSIER_V2.resultSchemaVersion, DEEP_RESEARCH_DOMAIN_KEYS,
          requestedFields, JSON.stringify(parent.completionMatrix ?? {}), parent.completionScore,
          parent.dossierOutcome, rootJobId, parent.jobId, nextStageOrdinal, nextStage,
          parent.studentChargeKey ?? parent.requesterSubjectKey,
        ]);
        if (inserted.rowCount !== 1) return { scheduled: false, reason: "ALREADY_SCHEDULED" };
        await reserveResearchSpend(client, { jobId: childJobId, provider, estimatedCostUsd });
        await client.query(`
          INSERT INTO rise_runtime.research_control_audit_events (
            actor_subject_key, action, target_type, target_id, after_state, reason
          ) VALUES ($1, 'RESERVE_JOB', 'JOB', $2, $3::jsonb,
                    'P1-RISE-5012H automatic dossier residue continuation; root quota charged once')
        `, [systemKey, childJobId, JSON.stringify(researchJobRecord(inserted.rows[0], { admin: true }))]);
        return { scheduled: true, job: researchJobRecord(inserted.rows[0], { admin: true }) };
      }, { isAdmin: true });
    },
    async failJob({
      jobId, leaseToken, workerId, errorCode = "REPLAY_ADAPTER_FAILED", errorSummary = "Research replay failed",
      actualCostUsd = 0, usage = {}, providerResponseId = null, unknownCost = false,
    }) {
      return withSubject(pool, systemKey, async (client) => {
        const selected = await client.query(`
          SELECT requester_subject_key, quota_window_start, attempt_count, provider_key, model_key,
                 task_class, estimated_cost_usd, stage_ordinal
          FROM rise_runtime.research_jobs
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
            AND status IN ('LEASED', 'RUNNING', 'NORMALIZING', 'PROMOTING')
          FOR UPDATE
        `, [jobId, leaseToken, workerId]);
        if (selected.rowCount !== 1) return null;
        const safeCode = /^[A-Z0-9_]{1,64}$/.test(String(errorCode)) ? String(errorCode) : "RESEARCH_JOB_FAILED";
        const safeSummary = String(errorSummary ?? "Research job failed").slice(0, 1000);
        const reconciledCost = unknownCost
          ? Number(selected.rows[0].estimated_cost_usd)
          : Number(actualCostUsd ?? 0);
        await reconcileResearchSpend(client, {
          jobId, providerKey: selected.rows[0].provider_key, modelKey: selected.rows[0].model_key,
          estimatedCostUsd: selected.rows[0].estimated_cost_usd, actualCostUsd: reconciledCost,
          usage, providerResponseId, unknown: unknownCost,
        });
        const updated = await client.query(`
          UPDATE rise_runtime.research_jobs SET
            status = 'REFUNDED', error_code = $4, error_summary = $5,
            actual_cost_usd = $6, completed_at = now(), lease_token = NULL,
            lease_expires_at = NULL, heartbeat_at = now(), updated_at = now()
          WHERE job_id = $1 AND lease_token = $2 AND worker_id = $3
          RETURNING ${RESEARCH_JOB_PROJECTION}
        `, [jobId, leaseToken, workerId, safeCode, safeSummary, reconciledCost]);
        if (selected.rows[0].task_class === "PROGRAM_DEEP_RESEARCH"
          && (selected.rows[0].stage_ordinal === null || Number(selected.rows[0].stage_ordinal) === 1)) {
          await client.query(`
            UPDATE rise_runtime.research_quota_ledgers
            SET reserved_count = reserved_count - 1, refunded_count = refunded_count + 1, updated_at = now()
            WHERE subject_key = $1 AND window_start = $2 AND reserved_count > 0
          `, [selected.rows[0].requester_subject_key, selected.rows[0].quota_window_start]);
        }
        await client.query(`
          INSERT INTO rise_runtime.research_job_attempts (
            job_id, attempt_number, provider_key, model_key, status, worker_id,
            error_code, metadata, finished_at
          ) VALUES ($1, $2, $3, $4, 'REFUNDED', $5, $6, $7::jsonb, now())
          ON CONFLICT (job_id, attempt_number, status) DO NOTHING
        `, [jobId, selected.rows[0].attempt_count, selected.rows[0].provider_key, selected.rows[0].model_key,
          workerId, safeCode, JSON.stringify({ newSpendUsd: reconciledCost, providerResponseId, usage, unknownCost })]);
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
