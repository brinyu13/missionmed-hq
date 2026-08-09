import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuditEvent, InMemoryAuditEventSink, redactForOperationalTelemetry } from '../../lor-studio/audit/audit-events.mjs';
import { authorizeArtifactAccess, buildWriterDepotRecord } from '../../lor-studio/documents/artifact-access-policy.mjs';
import { readZipEntries } from '../../lor-studio/documents/ooxml-zip.mjs';
import { renderRecommendationDocx, renderRecommendationPdf } from '../../lor-studio/documents/recommendation-artifacts.mjs';
import { createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import { createLorStudioHealthSnapshot, evaluateLorStudioAlerts } from '../../lor-studio/observability/health.mjs';

function model(overrides = {}) {
  return {
    caseId: 'case-100',
    title: 'Letter of Recommendation',
    studentDisplayName: 'Example Student',
    facultyDisplayName: 'Example Faculty',
    documentState: 'faculty_final',
    privacyClass: 'waived_faculty_private',
    containsWaivedContent: true,
    containsFacultyPrivateContent: true,
    facultyApproval: {
      approved: true,
      signatureAttested: true,
      approvedAt: '2026-08-09T16:00:00.000Z',
    },
    sections: [
      {
        heading: 'Clinical Evaluation',
        paragraphs: [
          'The applicant demonstrated reliable clinical reasoning and a consistent commitment to patient care.',
          'This final language is owned and approved by the faculty writer.',
        ],
      },
    ],
    provenance: [{ sourceType: 'structured_experience', sourceRef: 'experience-ref-1' }],
    ...overrides,
  };
}

test('DOCX renderer emits a genuine OOXML package with final faculty wording', () => {
  const artifact = renderRecommendationDocx(model());
  assert.equal(artifact.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(artifact.buffer.subarray(0, 2).toString('ascii'), 'PK');
  assert.equal(artifact.sha256.length, 64);
  const entries = readZipEntries(artifact.buffer);
  assert.deepEqual([...entries.keys()], [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/core.xml',
    'word/document.xml',
    'word/styles.xml',
    'word/_rels/document.xml.rels',
  ]);
  const documentXml = entries.get('word/document.xml').toString('utf8');
  assert.match(documentXml, /The applicant demonstrated reliable clinical reasoning/u);
  assert.match(documentXml, /Final wording approved and signature attested/u);
  assert.doesNotMatch(documentXml, /<script>/u);
});

test('artifact renderers escape markup and reject non-final or unapproved output', () => {
  const escaped = renderRecommendationDocx(model({
    sections: [{ heading: '<script>Heading</script>', paragraphs: ['A & B < C'] }],
  }));
  const documentXml = readZipEntries(escaped.buffer).get('word/document.xml').toString('utf8');
  assert.match(documentXml, /&lt;script&gt;Heading&lt;\/script&gt;/u);
  assert.match(documentXml, /A &amp; B &lt; C/u);

  assert.throws(() => renderRecommendationDocx(model({ documentState: 'ai_proposal' })), /faculty-final/u);
  assert.throws(() => renderRecommendationDocx(model({ facultyApproval: { approved: false } })), /Faculty approval/u);
  assert.throws(() => renderRecommendationPdf(model()), /explicit approved-output/u);
});

test('PDF renderer emits a structurally complete PDF only after explicit approval', () => {
  const artifact = renderRecommendationPdf(model(), { pdfApproved: true });
  const text = artifact.buffer.toString('latin1');
  assert.equal(artifact.mimeType, 'application/pdf');
  assert.match(text, /^%PDF-1\.7/u);
  assert.match(text, /xref\n0 /u);
  assert.match(text, /\/Type \/Catalog/u);
  assert.match(text, /Final wording approved and signature attested/u);
  assert.match(text, /%%EOF\n$/u);
  const declaredXref = Number(text.match(/startxref\n(\d+)\n%%EOF/u)?.[1]);
  assert.equal(text.slice(declaredXref, declaredXref + 4), 'xref');
});

test('student artifact projection structurally denies waived and faculty-private output', () => {
  const recordedAt = new Date('2026-08-09T12:00:00.000Z');
  const waivedReceipt = createWaiverReceipt({
    id: 'waiver-1',
    caseId: 'case-100',
    studentId: 'student-1',
    waived: true,
    policyVersion: 'dr-019-v1',
    acknowledgment: 'I knowingly waive access.',
    recordedAt,
  });
  const caseRecord = {
    id: 'case-100',
    studentId: 'student-1',
    faculty: { facultyId: 'faculty-1', verifiedAt: recordedAt.toISOString() },
    waiverReceipts: [waivedReceipt],
  };
  const privateArtifact = { caseId: 'case-100', privacyClass: 'waived_faculty_private' };
  assert.deepEqual(
    authorizeArtifactAccess({ actor: { id: 'student-1', role: 'student' }, artifact: privateArtifact, caseRecord }),
    { allowed: false, error: 'waived_or_private_artifact_forbidden' },
  );
  assert.equal(
    authorizeArtifactAccess({ actor: { id: 'faculty-1', role: 'faculty' }, artifact: privateArtifact, caseRecord }).allowed,
    true,
  );
  assert.equal(
    authorizeArtifactAccess({ actor: { id: 'faculty-2', role: 'faculty' }, artifact: privateArtifact, caseRecord }).allowed,
    false,
  );
  assert.equal(
    authorizeArtifactAccess({ actor: { id: 'admin-1', role: 'admin' }, artifact: privateArtifact, caseRecord }).allowed,
    false,
  );
  assert.equal(
    authorizeArtifactAccess({
      actor: { id: 'admin-1', role: 'admin' },
      artifact: privateArtifact,
      caseRecord,
      now: recordedAt,
      privacyGrant: {
        caseId: 'case-100',
        granteeId: 'admin-1',
        canReadProtectedArtifacts: true,
        purpose: 'documented privacy incident review',
        writtenAuthorizationReceiptId: 'authorization-receipt-1',
        auditReceiptId: 'audit-receipt-1',
        expiresAt: '2026-08-09T13:00:00.000Z',
        revokedAt: null,
      },
    }).allowed,
    true,
  );

  const mislabeledArtifact = { caseId: 'case-100', privacyClass: 'nonwaived_student_visible' };
  assert.deepEqual(
    authorizeArtifactAccess({
      actor: { id: 'student-1', role: 'student' },
      artifact: mislabeledArtifact,
      caseRecord,
    }),
    { allowed: false, error: 'waived_or_private_artifact_forbidden' },
  );
  assert.equal(
    authorizeArtifactAccess({
      actor: { id: 'admin-1', role: 'admin' },
      artifact: privateArtifact,
      caseRecord,
      now: recordedAt,
      privacyGrant: {
        caseId: 'case-100',
        granteeId: 'another-admin',
        canReadProtectedArtifacts: true,
        purpose: 'privacy review',
        writtenAuthorizationReceiptId: 'authorization-receipt-1',
        auditReceiptId: 'audit-receipt-1',
        expiresAt: '2026-08-09T13:00:00.000Z',
      },
    }).allowed,
    false,
  );
});

test('student artifact access requires an integrity-checked explicit nonwaiver', () => {
  const artifact = { caseId: 'case-101', privacyClass: 'nonwaived_student_visible' };
  const base = {
    id: 'case-101',
    studentId: 'student-1',
    faculty: { facultyId: 'faculty-1', verifiedAt: '2026-08-09T12:00:00.000Z' },
  };
  assert.equal(authorizeArtifactAccess({
    actor: { id: 'student-1', role: 'student' },
    artifact,
    caseRecord: { ...base, waiverReceipts: [] },
  }).allowed, false);

  const nonwaiver = createWaiverReceipt({
    id: 'waiver-2',
    caseId: 'case-101',
    studentId: 'student-1',
    waived: false,
    policyVersion: 'dr-019-v1',
    acknowledgment: 'I explicitly retain access.',
    recordedAt: new Date('2026-08-09T12:00:00.000Z'),
  });
  assert.equal(authorizeArtifactAccess({
    actor: { id: 'student-1', role: 'student' },
    artifact,
    caseRecord: { ...base, waiverReceipts: [nonwaiver] },
  }).allowed, true);
});

test('student-visible artifact creation rejects protected content flags', () => {
  assert.throws(
    () => renderRecommendationDocx(model({ privacyClass: 'nonwaived_student_visible' })),
    /cannot contain waived or faculty-private content/u,
  );
  const visible = renderRecommendationDocx(model({
    privacyClass: 'nonwaived_student_visible',
    containsWaivedContent: false,
    containsFacultyPrivateContent: false,
  }));
  assert.equal(visible.privacyClass, 'nonwaived_student_visible');
});

test('Writer Depot records require private encrypted versioned storage receipts', () => {
  const artifact = renderRecommendationDocx(model());
  const caseRecord = { id: 'case-100' };
  assert.throws(
    () => buildWriterDepotRecord({ artifact, storageReceipt: { objectKey: 'lor/case-100/file.docx' }, caseRecord }),
    /private, encrypted, versioned/u,
  );
  assert.throws(
    () => buildWriterDepotRecord({
      artifact,
      storageReceipt: { objectKey: '../file.docx', versionId: 'v1', private: true, encrypted: true },
      caseRecord,
    }),
    /Unsafe Writer Depot/u,
  );
  const record = buildWriterDepotRecord({
    artifact,
    storageReceipt: { objectKey: 'lor/case-100/file.docx', versionId: 'v1', private: true, encrypted: true },
    caseRecord,
    now: new Date('2026-08-09T16:00:00.000Z'),
  });
  assert.equal(record.accessMode, 'server_authorized_private');
  assert.equal(record.artifactSha256, artifact.sha256);
});

test('audit events preserve accountability without raw identifiers or protected content', async () => {
  const event = createAuditEvent({
    type: 'artifact.denied',
    actor: { id: 'student-private-id', role: 'student' },
    caseId: 'case-private-id',
    targetId: 'artifact-private-id',
    outcome: 'denied',
    metadata: { reasonCode: 'waived_or_private_artifact_forbidden', artifactFormat: 'docx' },
    at: new Date('2026-08-09T16:00:00.000Z'),
  });
  const serialized = JSON.stringify(event);
  assert.doesNotMatch(serialized, /student-private-id|case-private-id|artifact-private-id/u);
  assert.match(serialized, /waived_or_private_artifact_forbidden/u);
  assert.throws(
    () => createAuditEvent({
      type: 'artifact.generated',
      actor: { id: 'faculty-1', role: 'faculty' },
      caseId: 'case-1',
      outcome: 'success',
      metadata: { letterText: 'protected text' },
    }),
    /not allowlisted/u,
  );
  const sink = new InMemoryAuditEventSink();
  const receipt = await sink.emit(event);
  assert.equal(receipt.durability, 'NON_DURABLE_TEST_ONLY');
  assert.equal(sink.list().length, 1);
});

test('operational redaction removes common content and credential fields recursively', () => {
  assert.deepEqual(redactForOperationalTelemetry({
    errorCode: 'provider_timeout',
    email: 'private@example.test',
    message: 'The student described protected patient details.',
    nested: { promptText: 'protected', latencyMs: 12, status: 'degraded' },
  }), {
    errorCode: 'provider_timeout',
    email: '[REDACTED]',
    message: '[REDACTED]',
    nested: { promptText: '[REDACTED]', latencyMs: 12, status: 'degraded' },
  });
});

test('health never reports operational without durable storage and every required dependency', () => {
  const base = {
    flags: { enabled: true, killSwitch: false },
    storage: { state: 'ready', durable: true },
    entitlement: { state: 'ready' },
    aiProvider: { state: 'unavailable' },
    documentProvider: { state: 'ready' },
    emailProvider: { state: 'ready' },
    auditSink: { state: 'ready' },
    at: new Date('2026-08-09T16:00:00.000Z'),
  };
  const degraded = createLorStudioHealthSnapshot(base);
  assert.equal(degraded.status, 'degraded');
  assert.equal(degraded.reason, 'non_ai_fallback_required');
  assert.equal(degraded.productionOperational, true);

  const nondurable = createLorStudioHealthSnapshot({ ...base, storage: { state: 'ready', durable: false } });
  assert.equal(nondurable.status, 'blocked');
  assert.equal(nondurable.productionOperational, false);

  const killed = createLorStudioHealthSnapshot({ ...base, flags: { enabled: true, killSwitch: true } });
  assert.equal(killed.status, 'paused');
  assert.equal(killed.productionOperational, false);
});

test('alert decisions use low-cardinality aggregate metrics only', () => {
  assert.deepEqual(evaluateLorStudioAlerts({
    authDenialRate: 0.4,
    errorRate: 0.06,
    p95LatencyMs: 3_000,
    staleWriteRate: 0,
    artifactFailureRate: 0.03,
  }), [
    { code: 'lor_error_rate_high', severity: 'critical' },
    { code: 'lor_latency_high', severity: 'warning' },
    { code: 'lor_artifact_failures_high', severity: 'critical' },
    { code: 'lor_auth_denial_rate_high', severity: 'warning' },
  ]);
  assert.throws(() => evaluateLorStudioAlerts({ errorRate: -1 }), /nonnegative aggregates/u);
});
