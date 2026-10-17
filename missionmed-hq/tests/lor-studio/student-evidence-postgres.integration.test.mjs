import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import pg from 'pg';

import {
  createAtomicRlsCaseDriver,
} from '../../lor-studio/adapters/atomic-rls-case-driver.mjs';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  NODE_POSTGRES_DATABASE_ROLE,
  createNodePostgresExecutor,
} from '../../lor-studio/adapters/node-postgres-executor.mjs';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { SupabaseDurableRecommendationCaseRepository } from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';
import {
  createDisposablePostgresHarness,
} from '../../scripts/lor-studio/postgres-harness.mjs';

const { Pool } = pg;
const RUN_REAL_MATRIX = process.env.LOR_RUN_REAL_POSTGRES_MATRIX === '1';
const TOOLCHAINS = Object.freeze([
  Object.freeze({ major: 16, root: '/opt/homebrew/opt/postgresql@16/bin' }),
  Object.freeze({ major: 18, root: '/opt/homebrew/opt/postgresql@18/bin' }),
]);
const MIGRATION_NAMES = Object.freeze([
  '20260820180700_f2_lor_1012_schema_foundation.sql',
  '20260820180800_f2_lor_1012_rls_projection_grants.sql',
  '20260825010200_f2_lor_1012_identity_scope_commands.sql',
  '20260825010400_f2_lor_1012_faculty_invitation_commands.sql',
  '20260825010600_f2_lor_1012_faculty_private_export_commands.sql',
  '20260825010800_f2_lor_1012_ai_proposal_commands.sql',
  '20260825011000_f2_lor_1012_student_evidence_commands.sql',
]);
const migrationsDirectory = new URL('../../scripts/lor-studio/migrations/', import.meta.url);
const evidenceRollbackPath = new URL(
  '../../scripts/lor-studio/rollbacks/20260825011000_f2_lor_1012_student_evidence_commands.rollback.sql',
  import.meta.url,
);

const STUDENT_ID = 'wp:401';
const AUTH_UID = '445fb648-06cf-46f1-ac4d-f1924cbaff19';
const CASE_ID = 'case_evidence_real_pg_0001';
const CREATED_AT = '2026-08-25T01:00:00.000Z';
const FACULTY_ID = 'wp:402';
const FACULTY_AUTH_UID = 'c5eefb8e-433e-4cf9-a958-25725d09309b';
const FACULTY_INVITATION_ID = 'invitation_evidence_real_pg_0001';
const FACULTY_CHALLENGE_ID = 'challenge_evidence_real_pg_0001';
const BINDING = resolveLorTargetBinding({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'staging',
  provider: 'railway-postgres',
  projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
  environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
  serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
  databaseName: 'railway',
  region: 'us-west2',
  schema: 'lor_studio',
  migrationLedger: 'lor_studio/migrations/disposable-local',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
});

function binaries(root) {
  return Object.freeze({
    initdb: path.join(root, 'initdb'),
    pgCtl: path.join(root, 'pg_ctl'),
    createdb: path.join(root, 'createdb'),
    psql: path.join(root, 'psql'),
  });
}

function scope({ caseId, operation, resourceStudentId = STUDENT_ID }) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: STUDENT_ID,
    actorId: STUDENT_ID,
    actorRole: 'student',
    resourceStudentId,
    caseId,
    operation,
    purpose: operation === 'read' ? 'student_case_read' : 'student_case_write',
    assignmentId: null,
    invitationId: null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

function facultyScope({ caseId, operation, resourceStudentId = STUDENT_ID }) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: FACULTY_AUTH_UID,
    authenticatedSubject: FACULTY_ID,
    actorId: FACULTY_ID,
    actorRole: 'faculty',
    resourceStudentId,
    caseId,
    operation,
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId: FACULTY_INVITATION_ID,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  };
}

function clock() {
  let tick = 0;
  return () => new Date(Date.parse(CREATED_AT) + (tick++ * 1_000));
}

async function applyForward(harness) {
  for (const name of MIGRATION_NAMES) {
    await harness.applySqlFile(path.resolve(migrationsDirectory.pathname, name));
  }
}

async function withHarness(toolchain, operation) {
  for (const binary of Object.values(binaries(toolchain.root))) await access(binary);
  const harness = createDisposablePostgresHarness({
    binaries: binaries(toolchain.root),
    startupTimeoutMs: 30_000,
    shutdownTimeoutMs: 15_000,
  });
  let running = false;
  let pool;
  try {
    await harness.start();
    running = true;
    pool = new Pool({
      ...harness.connectionOptions(),
      max: 2,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 5_000,
    });
    await operation({ harness, pool });
  } finally {
    if (pool) await pool.end();
    if (running) await harness.stop();
  }
}

async function seedStudentBinding(pool) {
  await pool.query({
    text: `INSERT INTO lor_studio.student_auth_bindings
      (binding_id, student_auth_subject, student_auth_uid, binding_source,
       source_reference_hash, proof_hash, bound_at, expires_at, created_at)
      VALUES ($1, $2, $3::uuid, 'wordpress_verified_bootstrap', $4, $5,
        $6::timestamptz, NULL, $6::timestamptz)`,
    values: [
      'binding_evidence_real_pg_0001',
      STUDENT_ID,
      AUTH_UID,
      sha256('synthetic-evidence-binding-source'),
      sha256('synthetic-evidence-binding-proof'),
      CREATED_AT,
    ],
  });
}

function createService(pool) {
  const executor = createNodePostgresExecutor({
    pool,
    databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  const repository = new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider: async (request) => scope(request),
  });
  return new RecommendationCaseService({
    repository,
    entitlementPort: {
      async getStudentEntitlement() {
        return {
          studentId: STUDENT_ID,
          producerStatus: 'VERIFIED',
          revoked: false,
          active: true,
          tier: 'tier3_360',
          lorEnabled: true,
        };
      },
    },
    clock: clock(),
    caseIdFactory: () => CASE_ID,
    protectedIdFactory: () => 'evidence_real_pg_builder_0001',
  });
}

function createFacultyRepository(pool) {
  const executor = createNodePostgresExecutor({
    pool,
    databaseRole: NODE_POSTGRES_DATABASE_ROLE,
  });
  const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
  return new SupabaseDurableRecommendationCaseRepository({
    binding: BINDING,
    driver,
    scopeProvider: async (request) => facultyScope(request),
  });
}

async function seedFacultyDraftingProof(pool) {
  // Privileged disposable-local fixture only. It proves database authorization semantics and
  // makes no claim that invitation delivery or the OTP provider is bound in production.
  const recipientEmailHash = sha256('synthetic-evidence-faculty-recipient');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [audit] } = await client.query({
      text: `SELECT event_ref
        FROM lor_studio.recommendation_case_audit_events
        WHERE case_id = $1 AND student_auth_subject = $2
        ORDER BY revision DESC, event_ref DESC
        LIMIT 1`,
      values: [CASE_ID, STUDENT_ID],
    });
    assert.ok(audit?.event_ref);
    await client.query({
      text: `INSERT INTO lor_studio.faculty_invitations (
        invitation_id, case_id, student_auth_subject, faculty_auth_subject,
        faculty_auth_uid, recipient_email_hash, token_hash, revision,
        failed_attempts, max_attempts, attempt_window_ms, lockout_ms,
        attempt_window_started_at, locked_until, last_failure_code,
        created_at, expires_at, used_at, revoked_at, updated_at
      ) VALUES (
        $1, $2, $3, NULL, NULL, $4, $5, 0,
        0, 3, 600000, 600000, NULL, NULL, NULL,
        '2026-08-25T01:01:00.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz,
        NULL, NULL, '2026-08-25T01:01:00.000Z'::timestamptz
      )`,
      values: [
        FACULTY_INVITATION_ID, CASE_ID, STUDENT_ID, recipientEmailHash,
        sha256('synthetic-evidence-faculty-invitation-token'),
      ],
    });
    await client.query({
      text: `INSERT INTO lor_studio.faculty_otp_challenges (
        challenge_id, invitation_id, case_id, student_auth_subject,
        recipient_email_hash, otp_code_hash, issued_at, expires_at, challenge_hash
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        '2026-08-25T01:01:10.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz, $7
      )`,
      values: [
        FACULTY_CHALLENGE_ID, FACULTY_INVITATION_ID, CASE_ID, STUDENT_ID,
        recipientEmailHash, sha256('synthetic-evidence-faculty-otp'),
        sha256('synthetic-evidence-faculty-challenge'),
      ],
    });
    await client.query({
      text: `UPDATE lor_studio.faculty_invitations
        SET faculty_auth_subject = $1,
            faculty_auth_uid = $2::uuid,
            revision = revision + 1,
            used_at = '2026-08-25T01:01:30.000Z'::timestamptz,
            updated_at = '2026-08-25T01:01:30.000Z'::timestamptz
        WHERE invitation_id = $3`,
      values: [FACULTY_ID, FACULTY_AUTH_UID, FACULTY_INVITATION_ID],
    });
    await client.query({
      text: `INSERT INTO lor_studio.faculty_otp_verification_receipts (
        receipt_id, challenge_id, invitation_id, case_id, student_auth_subject,
        faculty_auth_subject, faculty_auth_uid, recipient_email_hash, otp_proof_ref,
        otp_verified_at, otp_expires_at, otp_revoked, principal_authority,
        invitation_used_at, audit_event_ref, transaction_id, receipt_hash, committed_at
      ) VALUES (
        'otp_receipt_evidence_real_pg_0001', $1, $2, $3, $4,
        $5, $6::uuid, $7, $8,
        '2026-08-25T01:01:20.000Z'::timestamptz,
        '2099-01-01T00:00:00.000Z'::timestamptz, false,
        'database_verified_otp_challenge',
        '2026-08-25T01:01:30.000Z'::timestamptz, $9,
        pg_catalog.pg_current_xact_id()::text, $10,
        pg_catalog.transaction_timestamp()
      )`,
      values: [
        FACULTY_CHALLENGE_ID, FACULTY_INVITATION_ID, CASE_ID, STUDENT_ID,
        FACULTY_ID, FACULTY_AUTH_UID, recipientEmailHash,
        sha256('synthetic-evidence-faculty-otp-proof'), audit.event_ref,
        sha256('synthetic-evidence-faculty-verification-receipt'),
      ],
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  return recipientEmailHash;
}

async function completeEligibleBuilder(service) {
  const actor = { id: STUDENT_ID, role: 'student' };
  let stage = 'case.create';
  let state;
  try {
    state = await service.createCase({
      actor,
      idempotencyKey: 'evidence-real-pg-create',
    });
    const stepData = {
      case_basics: { summary: 'Synthetic application evidence.' },
      writer_relationship: { writerRole: 'Synthetic attending' },
      evidence_selection: {
        priorityEvidence: `${STUDENT_ID} led a quality effort with student@example.test.`,
        evidenceSummary: 'Details were posted at https://example.test/private.',
      },
      timeline_highlights: {
        standoutMoment: 'Contact 212-555-1212 only for this synthetic fixture.',
        timelineSummary: 'Synthetic identifier 123-45-6789 must not survive publication.',
      },
      writer_preferences: { tonePreference: 'Specific and direct' },
      consent_and_waiver: {
        understanding: 'I explicitly consent to grounded drafting from these selected facts.',
      },
    };
    let command = 0;
    for (const [stepId, data] of Object.entries(stepData)) {
      stage = `${stepId}.autosave`;
      state = await service.autosaveBuilder({
        caseId: CASE_ID,
        actor,
        expectedRevision: state.revision,
        idempotencyKey: `evidence-real-pg-${command++}-autosave`,
        stepId,
        stepData: data,
      });
      stage = `${stepId}.complete`;
      state = await service.completeBuilderStep({
        caseId: CASE_ID,
        actor,
        expectedRevision: state.revision,
        idempotencyKey: `evidence-real-pg-${command++}-complete`,
        stepId,
      });
    }
    stage = 'consent.record';
    return await service.recordReceipt({
      caseId: CASE_ID,
      actor,
      expectedRevision: state.revision,
      idempotencyKey: 'evidence-real-pg-consent',
      receiptType: 'consent',
      receiptData: {
        scopes: ['builder_autosave', 'faculty_handoff', 'ai_drafting', 'evidence_grounding'],
        policyVersion: 'dr-133-identified-education-record-v1',
      },
    });
  } catch (error) {
    throw new Error(`Synthetic evidence fixture failed at ${stage}`, { cause: error });
  }
}

test('student evidence publication is DB-derived, direct-identifier-redacted, latest-consent-bound, replay-safe, and RLS-bound', {
  skip: RUN_REAL_MATRIX ? false : 'set LOR_RUN_REAL_POSTGRES_MATRIX=1',
  timeout: 120_000,
}, async (matrix) => {
  for (const toolchain of TOOLCHAINS) {
    await matrix.test(`PostgreSQL ${toolchain.major} evidence custody`, {
      timeout: 60_000,
    }, async () => {
      await withHarness(toolchain, async ({ harness, pool }) => {
        await applyForward(harness);
        await seedStudentBinding(pool);
        const service = createService(pool);
        const eligible = await completeEligibleBuilder(service);
        const expectedRevision = eligible.revision;
        const command = {
          caseId: CASE_ID,
          actor: { id: STUDENT_ID, role: 'student' },
          expectedRevision,
          idempotencyKey: 'evidence-real-pg-publish',
        };
        const published = await service.publishStudentEvidence(command);

        assert.equal(published.revision, expectedRevision + 1);
        assert.equal(published.studentEvidence.length, 4);
        const serializedEvidence = JSON.stringify(published.studentEvidence);
        for (const forbidden of [
          STUDENT_ID,
          'student@example.test',
          'https://example.test/private',
          '212-555-1212',
          '123-45-6789',
        ]) assert.equal(serializedEvidence.includes(forbidden), false, forbidden);
        for (const evidence of published.studentEvidence) {
          assert.match(evidence.id, /^evidence_[a-f0-9]{64}$/u);
          assert.equal(evidence.caseId, CASE_ID);
          assert.equal(evidence.contentHash, sha256(evidence.text));
          assert.match(evidence.consentReceiptId, /^consent_[A-Za-z0-9-]+$/u);
        }

        const replay = await service.publishStudentEvidence(command);
        assert.deepEqual(replay, published);

        const { rows: [custody] } = await pool.query({
          text: `SELECT
            pg_catalog.count(*)::integer AS evidence_count,
            pg_catalog.bool_and(
              evidence_record_hash = lor_studio.canonical_jsonb_sha256(evidence_record)
              AND provenance_hash = lor_studio.canonical_jsonb_sha256(provenance)
              AND content_hash = pg_catalog.encode(
                pg_catalog.sha256(pg_catalog.convert_to(deidentified_text, 'UTF8')), 'hex'
              )
              AND audit.transaction_id = evidence.transaction_id
              AND protected.transaction_id = evidence.transaction_id
              AND write_receipt.transaction_id = evidence.transaction_id
            ) AS custody_valid
          FROM lor_studio.student_evidence_records AS evidence
          JOIN lor_studio.recommendation_case_audit_events AS audit
            ON audit.event_ref = evidence.audit_event_ref
          JOIN lor_studio.recommendation_case_protected_revision_states AS protected
            ON protected.case_id = evidence.case_id
           AND protected.revision = evidence.published_revision
          JOIN lor_studio.recommendation_case_write_receipts AS write_receipt
            ON write_receipt.case_id = evidence.case_id
           AND write_receipt.revision = evidence.published_revision
           AND write_receipt.command_type = 'student.evidence.publish'
          WHERE evidence.case_id = $1`,
          values: [CASE_ID],
        });
        assert.deepEqual(custody, { evidence_count: 4, custody_valid: true });

        const recipientEmailHash = await seedFacultyDraftingProof(pool);
        const facultyRepository = createFacultyRepository(pool);
        const facultyContext = await facultyRepository.readFacultyDraftingContext({
          caseId: CASE_ID,
          actorId: FACULTY_ID,
        });
        assert.deepEqual(facultyContext.consentReceipts, [{
          id: published.consentReceipts.at(-1).id,
        }]);
        assert.equal(facultyContext.faculty.recipientEmailHash, recipientEmailHash);
        assert.deepEqual(facultyContext.studentEvidence, published.studentEvidence);

        const withdrawn = await service.recordReceipt({
          caseId: CASE_ID,
          actor: { id: STUDENT_ID, role: 'student' },
          expectedRevision: published.revision,
          idempotencyKey: 'evidence-real-pg-consent-withdrawal',
          receiptType: 'consent',
          receiptData: {
            scopes: ['consent_withdrawn'],
            policyVersion: 'dr-133-identified-education-record-v1',
          },
        });
        assert.deepEqual(withdrawn.consentReceipts.at(-1).scopes, ['consent_withdrawn']);
        await assert.rejects(
          () => facultyRepository.readFacultyDraftingContext({
            caseId: CASE_ID,
            actorId: FACULTY_ID,
          }),
          (error) => error?.code === 'AUTHORIZATION_DENIED',
        );

        const executor = createNodePostgresExecutor({
          pool,
          databaseRole: NODE_POSTGRES_DATABASE_ROLE,
        });
        const driver = createAtomicRlsCaseDriver({ binding: BINDING, executor });
        const deniedIdempotencyKey = 'evidence-real-pg-publish-after-withdrawal';
        await assert.rejects(
          () => driver.commitStudentEvidencePublication({
            binding: BINDING,
            scope: scope({ caseId: CASE_ID, operation: 'save' }),
            expectedRevision: withdrawn.revision,
            idempotencyKey: deniedIdempotencyKey,
            requestHash: hashValue({
              operation: 'student.evidence.publish',
              caseId: CASE_ID,
              actorId: STUDENT_ID,
              payload: {},
            }),
            event: createMetadataServiceEvent({
              eventId: 'evidence-real-pg-denied-event',
              eventType: 'student.material_updated',
              caseId: CASE_ID,
              actorId: STUDENT_ID,
              actorRole: 'student',
              correlationId: sha256(deniedIdempotencyKey).slice(0, 32),
              revision: withdrawn.revision + 1,
              occurredAt: '2026-08-25T03:00:00.000Z',
            }),
          }),
          (error) => error?.code === 'AUTHORIZATION_DENIED',
        );
        const { rows: [withdrawalProof] } = await pool.query({
          text: `SELECT
            (SELECT scopes FROM lor_studio.consent_receipts
              WHERE case_id = $1 AND student_auth_subject = $2
              ORDER BY case_revision DESC, recorded_at DESC, receipt_id DESC
              LIMIT 1) AS latest_scopes,
            (SELECT count(*)::integer FROM lor_studio.student_evidence_records
              WHERE case_id = $1) AS evidence_count,
            NOT EXISTS (
              SELECT 1 FROM lor_studio.recommendation_case_write_receipts
              WHERE case_id = $1 AND idempotency_key = $3
            ) AS denied_write_absent`,
          values: [CASE_ID, STUDENT_ID, deniedIdempotencyKey],
        });
        assert.deepEqual(withdrawalProof, {
          latest_scopes: ['consent_withdrawn'],
          evidence_count: 4,
          denied_write_absent: true,
        });

        const appClient = await pool.connect();
        try {
          await appClient.query('BEGIN');
          await appClient.query('SET LOCAL ROLE lor_studio_app');
          await assert.rejects(
            () => appClient.query('INSERT INTO lor_studio.student_evidence_records DEFAULT VALUES'),
            (error) => error?.code === '42501',
          );
        } finally {
          await appClient.query('ROLLBACK').catch(() => {});
          appClient.release();
        }

        await assert.rejects(
          () => harness.applySqlFile(evidenceRollbackPath.pathname),
          (error) => error?.code === 'SQL_FILE_APPLY_FAILED',
        );
      });
    });
  }
});
