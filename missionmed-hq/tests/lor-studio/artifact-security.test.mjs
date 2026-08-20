import assert from 'node:assert/strict';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MetadataOnlyEventBuffer, StaticEntitlementTestAdapter } from '../../lor-studio/adapters/test-adapters.js';
import { createAuditEvent, InMemoryAuditEventSink, redactForOperationalTelemetry } from '../../lor-studio/audit/audit-events.mjs';
import { authorizeArtifactAccess, buildWriterDepotRecord } from '../../lor-studio/documents/artifact-access-policy.mjs';
import { readZipEntries } from '../../lor-studio/documents/ooxml-zip.mjs';
import { renderRecommendationDocx, renderRecommendationPdf } from '../../lor-studio/documents/recommendation-artifacts.mjs';
import {
  BUILDER_STEPS,
  appendReceipt,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  completeBuilderStep,
  createRecommendationCase,
  releaseFinalDocument,
  setFacultyPrivateContent,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import { createLorStudioHealthSnapshot, evaluateLorStudioAlerts } from '../../lor-studio/observability/health.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import { ACTOR_ROLES, projectCaseForActor } from '../../lor-studio/security/authorization-policy.js';
import { createRecommendationArtifactService } from '../../lor-studio/services/artifact-service.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

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

test('PDF renderer transliterates non-ASCII names instead of mangling them', () => {
  // The base-14 PDF font is single-byte, so the output alphabet is ASCII. That must degrade by
  // TRANSLITERATION, not by destroying the name: the previous implementation ran NFKD and then
  // mapped every non-ASCII code point to '?', so the combining marks NFKD had just produced
  // became literal question marks and 'José Álvarez' rendered as 'Jose? A?lvarez'.
  const artifact = renderRecommendationPdf(model({
    studentDisplayName: 'José Álvarez',
    facultyDisplayName: 'François Müller-Lefèvre',
    sections: [{
      heading: 'Clinical Evaluation',
      paragraphs: ['Trained at Hôpital Saint-Louis — “excellent” throughout…'],
    }],
  }), { pdfApproved: true });
  const text = artifact.buffer.toString('latin1');

  assert.match(text, /Jose Alvarez/u, 'accented Latin names must transliterate to their base letters');
  assert.match(text, /Francois Muller-Lefevre/u);
  assert.match(text, /Hopital Saint-Louis/u);
  assert.match(text, /"excellent"/u, 'smart quotes must become ASCII quotes');
  assert.match(text, /\.\.\./u, 'an ellipsis must become three periods');

  // The specific regression: no stray '?' introduced where a letter was transliterated.
  assert.equal(/Jose\?|A\?lvarez|Mu\?ller|Lefe\?vre/u.test(text), false,
    'combining marks must be stripped, never rendered as question marks');
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

test('operational redaction gates numeric and boolean scalars by field name', () => {
  assert.deepEqual(redactForOperationalTelemetry({
    wpUserId: 4471,
    studentId: 90_210,
    isPaidAccount: true,
    latencyMs: 12,
    retryCount: 2,
    errorRate: 0.06,
    durable: true,
    killSwitch: false,
    nested: { wpUserId: 4471, mrn: 8_675_309, durationMs: 40, truncated: true },
    wpUserIds: [4471, 4472],
    counts: [1, 2],
  }), {
    wpUserId: '[REDACTED]',
    studentId: '[REDACTED]',
    isPaidAccount: '[REDACTED]',
    latencyMs: 12,
    retryCount: 2,
    errorRate: 0.06,
    durable: true,
    killSwitch: false,
    nested: { wpUserId: '[REDACTED]', mrn: '[REDACTED]', durationMs: 40, truncated: true },
    wpUserIds: ['[REDACTED]', '[REDACTED]'],
    counts: ['[REDACTED]', '[REDACTED]'],
  });
  assert.equal(redactForOperationalTelemetry(4471), '[REDACTED]');
  assert.deepEqual(redactForOperationalTelemetry({ latencyMs: Number.NaN }), { latencyMs: '[REDACTED]' });
});

test('audit actor roles cover every operational role the authorization policy recognizes', () => {
  for (const role of ACTOR_ROLES) {
    const event = createAuditEvent({
      type: 'artifact.accessed',
      actor: { id: `${role}-1`, role },
      caseId: 'case-100',
      outcome: 'success',
    });
    assert.equal(event.actorRole, role);
  }
  assert.throws(
    () => createAuditEvent({
      type: 'artifact.accessed',
      actor: { id: 'ghost-1', role: 'ghost' },
      caseId: 'case-100',
      outcome: 'success',
    }),
    /not allowlisted/u,
  );
});

// ---------------------------------------------------------------------------
// F2-LOR-1009 - the export delivery path.
//
// renderRecommendationDocx above is exercised against hand-built models. Everything below
// exercises the path a real request takes: an authenticated actor, a stored aggregate, the
// authorisation policy, the artifact-access policy, the renderer, the audit trail, and the HTTP
// route that returns the bytes. The promise being held is narrow and absolute - an export may
// never deliver something the case screen would refuse to show the same actor.
// ---------------------------------------------------------------------------

const EXPORT_STUDENT = Object.freeze({ id: 'student-1', role: 'student' });
const EXPORT_FACULTY = Object.freeze({ id: 'faculty-1', role: 'faculty' });
const EXPORT_T0 = new Date('2026-08-09T11:00:00.000Z');
const EXPORT_WAIVER_AT = new Date('2026-08-09T12:00:00.000Z');
const EXPORT_APPROVED_AT = '2026-08-09T14:30:00.000Z';
const EXPORT_RELEASED_AT = '2026-08-09T14:45:00.000Z';
const EXPORT_NOW = new Date('2026-08-09T15:00:00.000Z');
const EXPORT_FINAL_TEXT = 'FINAL LETTER WORDING the student is entitled to hold.';
const EXPORT_DRAFT_TEXT = 'FACULTY PRIVATE DRAFT that no student artifact may ever carry.';
const EXPORT_RECIPIENT_HASH = sha256('writer@example.test');
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const runtimePublicDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'public',
  'lor-studio',
);

/** Collects a real ServerResponse's bytes and headers so the delivered download can be inspected. */
class ExportMemoryResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 0;
    this.headers = {};
    this.chunks = [];
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  end(chunk, encoding, callback) {
    if (chunk) this.chunks.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
    return super.end(typeof encoding === 'function' ? encoding : callback);
  }

  get raw() {
    return Buffer.concat(this.chunks);
  }
}

function exportEligible(studentId, overrides = {}) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    ...overrides,
  };
}

function exportApproval(overrides = {}) {
  return {
    approved: true,
    approvedAt: EXPORT_APPROVED_AT,
    facultyId: 'faculty-1',
    signatureAttested: true,
    ...overrides,
  };
}

/**
 * The full revision chain of a case, built only from domain transitions, exactly as
 * tests/lor-studio/http-application.test.mjs builds it for release. A fixture may not hand-shape
 * an aggregate: the invariants these exports depend on are the same ones the aggregate enforces.
 */
function exportableRevisions({
  caseId = 'case-released',
  studentId = 'student-1',
  waived = false,
  waiverDecided = true,
  documentState = 'faculty_final',
  approval = exportApproval(),
  finalDocument = { id: 'document-1', text: EXPORT_FINAL_TEXT },
  released = true,
} = {}) {
  const revisions = [];
  let record = createRecommendationCase({
    id: caseId,
    studentId,
    now: EXPORT_T0,
    builderSessionId: `builder-${caseId}`,
  });
  revisions.push(record);
  const advance = (next) => {
    record = next;
    revisions.push(next);
  };
  if (waiverDecided) {
    advance(appendReceipt(record, {
      actorId: studentId,
      receiptType: 'waiver',
      receipt: createWaiverReceipt({
        id: `waiver-${caseId}`,
        caseId,
        studentId,
        waived,
        policyVersion: 'dr-119-v1',
        acknowledgment: waived ? 'I waive access.' : 'I retain access to the final letter.',
        recordedAt: EXPORT_WAIVER_AT,
      }),
      now: EXPORT_WAIVER_AT,
    }));
  }
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    advance(autosaveBuilderStep(record, { actorId: studentId, stepId, stepData: { index }, now: EXPORT_T0 }));
    advance(completeBuilderStep(record, { actorId: studentId, stepId, now: EXPORT_T0 }));
  }
  advance(bindFacultyInvitation(record, {
    actorId: studentId,
    invitationId: `invite-${caseId}`,
    recipientEmailHash: EXPORT_RECIPIENT_HASH,
    now: EXPORT_T0,
  }));
  advance(bindVerifiedFaculty(record, {
    actorId: 'faculty-1',
    invitationId: `invite-${caseId}`,
    facultyId: 'faculty-1',
    recipientEmailHash: EXPORT_RECIPIENT_HASH,
    now: EXPORT_T0,
  }));
  advance(transitionRecommendationCase(record, { actorId: 'faculty-1', toStatus: 'faculty_review', now: EXPORT_T0 }));
  if (finalDocument !== null) {
    advance(setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      draftText: EXPORT_DRAFT_TEXT,
      finalDocument,
      documentState,
      facultyApproval: approval,
      now: EXPORT_T0,
    }));
  }
  if (released) {
    advance(releaseFinalDocument(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      caseId,
      documentId: finalDocument.id,
      expectedRevision: record.revision,
      now: EXPORT_RELEASED_AT,
    }));
  }
  return revisions;
}

async function seedExportCase(repository, revisions) {
  const caseId = revisions[0].id;
  await repository.create(revisions[0], {
    idempotencyKey: `seed-${caseId}-0`,
    requestHash: sha256(`seed:${caseId}:0`),
  });
  for (let index = 1; index < revisions.length; index += 1) {
    await repository.save(revisions[index], {
      expectedRevision: index - 1,
      idempotencyKey: `seed-${caseId}-${index}`,
      requestHash: sha256(`seed:${caseId}:${index}`),
    });
  }
  return repository.getById(caseId);
}

function exportHarness({
  entitlements = [exportEligible('student-1'), exportEligible('student-2')],
  auditSink = null,
  requireCanary = true,
} = {}) {
  const repository = new InMemoryRecommendationCaseRepository();
  const entitlementPort = new StaticEntitlementTestAdapter(entitlements);
  const eventSink = new MetadataOnlyEventBuffer();
  let caseSequence = 0;
  const caseService = new RecommendationCaseService({
    repository,
    entitlementPort,
    eventSink,
    requireCanary,
    clock: () => EXPORT_NOW,
    caseIdFactory: () => `case-${++caseSequence}`,
    protectedIdFactory: () => 'builder-server-generated',
  });
  const adapter = createLorApplicationAdapter({
    caseService,
    repository,
    allowNonDurableForTests: true,
    artifactAuditSink: auditSink,
  });
  return { adapter, auditSink, caseService, entitlementPort, repository };
}

function exportRequest(method = 'GET') {
  const stream = Readable.from([]);
  stream.method = method;
  stream.headers = {};
  return stream;
}

async function exportCall(adapter, {
  caseId = 'case-released',
  actor = EXPORT_STUDENT,
  method = 'GET',
  search = '',
  path = 'final-document/export',
} = {}) {
  return adapter.handleRequest({
    request: exportRequest(method),
    url: new URL(`/api/lor-studio/cases/${caseId}/${path}${search}`, 'https://hq.example.test'),
    actor,
  });
}

function docxText(buffer) {
  return readZipEntries(buffer).get('word/document.xml').toString('utf8');
}

test('an entitled student exports the released letter as real DOCX bytes', async () => {
  const auditSink = new InMemoryAuditEventSink();
  const { adapter, repository } = exportHarness({ auditSink });
  await seedExportCase(repository, exportableRevisions());

  const response = await exportCall(adapter);
  assert.equal(response.status, 200);
  assert.equal(response.body, undefined, 'an export is delivered as bytes, never as a JSON body');
  assert.equal(response.binary.contentType, DOCX_MIME);
  assert.equal(response.binary.filename, 'lor-case-released-document-1.docx');
  assert.match(response.binary.filename, /^[A-Za-z0-9._-]+$/u, 'the filename must need no sanitising downstream');

  const buffer = response.binary.body;
  assert.equal(Buffer.isBuffer(buffer), true);
  assert.equal(buffer.subarray(0, 2).toString('ascii'), 'PK', 'the response must be a genuine ZIP container');
  const entries = readZipEntries(buffer);
  assert.deepEqual([...entries.keys()], [
    '[Content_Types].xml',
    '_rels/.rels',
    'docProps/core.xml',
    'word/document.xml',
    'word/styles.xml',
    'word/_rels/document.xml.rels',
  ]);
  const documentXml = entries.get('word/document.xml').toString('utf8');
  assert.match(documentXml, /FINAL LETTER WORDING the student is entitled to hold\./u);
  assert.match(documentXml, /Final wording approved and signature attested by faculty-1\./u);
  assert.doesNotMatch(documentXml, /FACULTY PRIVATE DRAFT/u, 'the student copy must carry no faculty-private wording');

  const events = auditSink.list();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'artifact.generated');
  assert.equal(events[0].outcome, 'success');
  assert.deepEqual(events[0].metadata, {
    action: 'export_final_document',
    artifactFormat: 'docx',
    result: 'student_visible',
  });
  assert.doesNotMatch(JSON.stringify(events[0]), /student-1|case-released|document-1/u);
});

test('the student export mirrors the projection exactly: no release, no bytes', async () => {
  const { adapter, repository } = exportHarness();
  const fixtures = [
    ['case-unreleased', exportableRevisions({ caseId: 'case-unreleased', released: false })],
    ['case-proposal', exportableRevisions({
      caseId: 'case-proposal',
      released: false,
      documentState: 'ai_proposal',
      approval: null,
    })],
    ['case-unapproved', exportableRevisions({
      caseId: 'case-unapproved',
      released: false,
      approval: exportApproval({ approved: false }),
    })],
    ['case-unattested', exportableRevisions({
      caseId: 'case-unattested',
      released: false,
      approval: exportApproval({ signatureAttested: false }),
    })],
    ['case-waived', exportableRevisions({ caseId: 'case-waived', waived: true, released: false })],
    ['case-undecided', exportableRevisions({ caseId: 'case-undecided', waiverDecided: false, released: false })],
    ['case-no-document', exportableRevisions({ caseId: 'case-no-document', finalDocument: null, released: false })],
  ];

  for (const [caseId, revisions] of fixtures) {
    await seedExportCase(repository, revisions);
    const projection = await adapter.handleRequest({
      request: exportRequest('GET'),
      url: new URL(`/api/lor-studio/cases/${caseId}`, 'https://hq.example.test'),
      actor: EXPORT_STUDENT,
    });
    assert.equal(projection.status, 200, `${caseId} must still be readable by its student`);
    assert.equal(projection.body.case.finalDocument, null, `${caseId} must hide the letter`);

    const exported = await exportCall(adapter, { caseId });
    assert.equal(exported.binary, undefined, `${caseId} must deliver no bytes`);
    assert.equal(exported.status, 404, `${caseId} must be refused`);
    assert.equal(exported.body.error, 'not_found');
  }
});

test('a waived student is refused the letter even when the artifact policy is asked directly', async () => {
  const { repository, entitlementPort } = exportHarness();
  await seedExportCase(repository, exportableRevisions({ caseId: 'case-waived', waived: true, released: false }));
  const artifacts = createRecommendationArtifactService({ repository, entitlementPort });
  await assert.rejects(
    () => artifacts.exportFinalDocumentArtifact({ actor: EXPORT_STUDENT, caseId: 'case-waived' }),
    (error) => error.code === 'AUTHORIZATION_DENIED'
      && error.details.reasonCode === 'WAIVED_OR_PRIVATE_ARTIFACT_FORBIDDEN',
  );
});

test('cross-case, foreign-actor, and unentitled exports are refused and indistinguishable', async () => {
  const { adapter, entitlementPort, repository } = exportHarness({
    entitlements: [exportEligible('student-1'), exportEligible('student-2', { active: false })],
  });
  await seedExportCase(repository, exportableRevisions());
  await seedExportCase(repository, exportableRevisions({
    caseId: 'case-student-2',
    studentId: 'student-2',
  }));

  const missing = await exportCall(adapter, { caseId: 'case-does-not-exist' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'not_found');
  assert.equal(missing.binary, undefined);

  const refusals = [
    ['another student', { id: 'student-2', role: 'student' }, 'case-released'],
    ['an unbound faculty writer', { id: 'faculty-9', role: 'faculty' }, 'case-released'],
    ['an unassigned mentor', { id: 'mentor-1', role: 'mentor' }, 'case-released'],
    ['a service principal', { id: 'service-1', role: 'service' }, 'case-released'],
    ['an operational admin', { id: 'admin-1', role: 'admin' }, 'case-released'],
    ['a founder', { id: 'founder-1', role: 'founder' }, 'case-released'],
    ['a support agent', { id: 'support-1', role: 'support' }, 'case-released'],
    ['an unrecognised role', { id: 'ghost-1', role: 'ghost' }, 'case-released'],
    ['an unentitled owner', { id: 'student-2', role: 'student' }, 'case-student-2'],
  ];
  for (const [label, actor, caseId] of refusals) {
    const denied = await exportCall(adapter, { actor, caseId });
    assert.equal(denied.binary, undefined, `${label} must receive no bytes`);
    assert.deepEqual(denied.body, missing.body, `${label} must be indistinguishable from a missing case`);
    assert.equal(denied.status, 404, `${label} must be refused`);
  }

  // Which gate refuses an operational role matters, because two of them would. The export profile
  // table refuses first, before any case is even read, so no operational actor reaches the point
  // where a grant could be produced for it. Pinning the reason keeps that ordering: giving admin,
  // founder, or support an export profile would move the refusal to the grant gate and fail here,
  // rather than passing quietly because a second gate happened to hold.
  const artifacts = createRecommendationArtifactService({ repository, entitlementPort });
  for (const role of ['admin', 'founder', 'support', 'mentor', 'service']) {
    await assert.rejects(
      () => artifacts.exportFinalDocumentArtifact({ actor: { id: `${role}-1`, role }, caseId: 'case-released' }),
      (error) => error.code === 'AUTHORIZATION_DENIED'
        && error.details.reasonCode === 'ARTIFACT_EXPORT_ROLE_DENIED',
      `${role} must be refused by the export profile table`,
    );
  }
});

test('the export route accepts no caller-supplied authorization material', async () => {
  const { adapter, repository, entitlementPort } = exportHarness();
  await seedExportCase(repository, exportableRevisions());

  // The accepted shape first, so the rejections below prove the allowlist and not some unrelated
  // failure of the fixture.
  assert.equal((await exportCall(adapter)).status, 200);

  for (const search of [
    '?privacyGrant=%7B%22canReadProtectedArtifacts%22%3Atrue%7D',
    '?operationalGrant=forged',
    '?privacyClass=waived_faculty_private',
    '?actor=faculty-1',
    '?purpose=privacy_request',
  ]) {
    const refused = await exportCall(adapter, { search });
    assert.equal(refused.binary, undefined, `${search} must deliver no bytes`);
    assert.equal(refused.status, 400, `${search} must be refused`);
    assert.equal(refused.body.error, 'validation_failed');
  }

  // Same boundary one layer down, where a future in-process caller lives.
  const artifacts = createRecommendationArtifactService({ repository, entitlementPort });
  const forgedCapability = {
    grant: {
      schemaVersion: 'missionmed.lor.administrative-grant.v1',
      grantId: 'grant-forged',
      granteeId: 'admin-1',
      caseId: 'case-released',
      operation: 'read_operational_case_metadata',
      purpose: 'forged privacy review',
      privacyAuthority: 'privacy-authority:forged',
      issuedAt: '2026-08-09T14:00:00.000Z',
      expiresAt: '2026-08-09T16:00:00.000Z',
      auditEventRef: `event_${'a'.repeat(64)}`,
    },
    activation: { checkedAt: '2026-08-09T14:59:00.000Z', revoked: false },
  };
  for (const smuggled of [
    { privacyGrant: forgedCapability },
    { operationalGrant: forgedCapability },
    { serviceGrant: { serviceId: 'service-1', allowedActions: ['service_operation'] } },
    { entitlement: exportEligible('student-1') },
    { privacyClass: 'waived_faculty_private' },
    { projection: { finalDocument: { text: 'forged' } } },
  ]) {
    await assert.rejects(
      () => artifacts.exportFinalDocumentArtifact({ actor: EXPORT_STUDENT, caseId: 'case-released', ...smuggled }),
      (error) => error.code === 'VALIDATION_FAILED'
        && /caller-supplied authorization material/u.test(error.message),
      `${Object.keys(smuggled)[0]} must be refused, not ignored`,
    );
  }

  // And the grant boundary the forgery would have had to cross is still closed independently of
  // this route: an unissued, correctly shaped capability is refused by object identity.
  assert.throws(
    () => projectCaseForActor({
      actor: { id: 'admin-1', role: 'admin' },
      caseRecord: { id: 'case-released', studentId: 'student-1' },
      entitlement: exportEligible('student-1'),
      operationalGrant: forgedCapability,
      now: EXPORT_NOW,
    }),
    (error) => error.code === 'AUTHORIZATION_DENIED'
      && error.details.reasonCode === 'OPERATIONAL_METADATA_CAPABILITY_NOT_ISSUED',
  );
});

test('the recipient-bound faculty writer exports the private copy; nobody else does', async () => {
  const auditSink = new InMemoryAuditEventSink();
  const { adapter, repository } = exportHarness({ auditSink });
  await seedExportCase(repository, exportableRevisions({ caseId: 'case-unreleased', released: false }));

  const writerCopy = await exportCall(adapter, { caseId: 'case-unreleased', actor: EXPORT_FACULTY });
  assert.equal(writerCopy.status, 200);
  assert.equal(writerCopy.binary.contentType, DOCX_MIME);
  assert.match(docxText(writerCopy.binary.body), /FINAL LETTER WORDING/u);
  assert.equal(auditSink.list().at(-1).metadata.result, 'faculty_owner');

  // The same document the writer just exported is still invisible to the student, because it was
  // never released. One authorised export must not become another.
  const studentAttempt = await exportCall(adapter, { caseId: 'case-unreleased', actor: EXPORT_STUDENT });
  assert.equal(studentAttempt.status, 404);
  assert.equal(studentAttempt.binary, undefined);
});

test('a faculty export of unapproved wording is refused with no bytes', async () => {
  const { adapter, repository } = exportHarness();
  await seedExportCase(repository, exportableRevisions({
    caseId: 'case-unapproved',
    released: false,
    approval: exportApproval({ approved: false }),
  }));
  await seedExportCase(repository, exportableRevisions({
    caseId: 'case-proposal',
    released: false,
    documentState: 'ai_proposal',
    approval: null,
  }));

  const unapproved = await exportCall(adapter, { caseId: 'case-unapproved', actor: EXPORT_FACULTY });
  assert.equal(unapproved.binary, undefined);
  assert.equal(unapproved.status, 409);
  assert.equal(unapproved.body.reasonCode, 'FINAL_DOCUMENT_NOT_APPROVED');

  const proposal = await exportCall(adapter, { caseId: 'case-proposal', actor: EXPORT_FACULTY });
  assert.equal(proposal.binary, undefined);
  assert.equal(proposal.status, 409);
  assert.equal(proposal.body.reasonCode, 'FINAL_DOCUMENT_NOT_FACULTY_FINAL');
});

test('a refused export is audited as a denial and delivers nothing', async () => {
  const auditSink = new InMemoryAuditEventSink();
  const { adapter, repository } = exportHarness({ auditSink });
  await seedExportCase(repository, exportableRevisions({ caseId: 'case-unreleased', released: false }));

  const denied = await exportCall(adapter, { caseId: 'case-unreleased' });
  assert.equal(denied.status, 404);
  const events = auditSink.list();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'artifact.denied');
  assert.equal(events[0].outcome, 'denied');
  assert.equal(events[0].metadata.reasonCode, 'FINAL_DOCUMENT_NOT_AVAILABLE_TO_ACTOR');
  assert.doesNotMatch(JSON.stringify(events), /student-1|case-unreleased/u);
});

test('an export that cannot be audited is not delivered', async () => {
  const { repository, entitlementPort } = exportHarness();
  await seedExportCase(repository, exportableRevisions());
  const artifacts = createRecommendationArtifactService({
    repository,
    entitlementPort,
    auditSink: {
      async emit(event) {
        if (event.type === 'artifact.generated') throw new Error('audit sink offline');
      },
    },
  });
  await assert.rejects(
    () => artifacts.exportFinalDocumentArtifact({ actor: EXPORT_STUDENT, caseId: 'case-released' }),
    (error) => error.code === 'INTEGRATION_DISABLED',
    'protected content must not leave the system unrecorded',
  );
});

test('the export route follows the existing case-route conventions', async () => {
  const { adapter, repository } = exportHarness();
  await seedExportCase(repository, exportableRevisions());

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await exportCall(adapter, { method });
    assert.equal(response.status, 405, `${method} must not be routed`);
    assert.equal(response.binary, undefined);
  }
  for (const path of ['final-document', 'final-document/export/again', 'final-document/exports']) {
    const response = await exportCall(adapter, { path });
    assert.equal(response.status, 404, `${path} must not be routed`);
    assert.equal(response.body.error, 'lor_route_not_found');
  }
  // The bare projection route must not swallow the export path and answer with JSON.
  const exported = await exportCall(adapter);
  assert.equal(exported.status, 200);
  assert.equal(exported.body, undefined);
});

test('the exported DOCX carries only provenance the aggregate actually holds', async () => {
  const { repository, entitlementPort } = exportHarness();
  const seeded = await seedExportCase(repository, exportableRevisions());
  const artifacts = createRecommendationArtifactService({ repository, entitlementPort });
  const exported = await artifacts.exportFinalDocumentArtifact({
    actor: EXPORT_STUDENT,
    caseId: 'case-released',
  });
  assert.equal(exported.artifact.provenanceCount >= 4, true);
  assert.equal(exported.artifact.privacyClass, 'nonwaived_student_visible');
  assert.equal(exported.artifact.sha256.length, 64);
  assert.equal(exported.exportIntent.purpose, 'student_copy');
  assert.equal(exported.exportIntent.destinationClass, 'actor_private_download');
  assert.equal(exported.exportIntent.remoteMutationPerformed, false);

  const core = readZipEntries(exported.artifact.buffer).get('docProps/core.xml').toString('utf8');
  assert.match(core, /case:case-released;privacy:nonwaived_student_visible/u);

  // The export is a pure read: the aggregate is byte-identical afterwards.
  assert.equal(
    JSON.stringify(await repository.getById('case-released')),
    JSON.stringify(seeded),
    'an export must never mutate the case',
  );
});

// The route above is proven at the application boundary. This one drives the REAL HTTP runtime,
// because "the adapter returned a Buffer" is not the same claim as "a browser receives a DOCX":
// the binary dispatch, the content-type allowlist, the download filename, and the protected
// response headers all live in http/runtime.mjs and none of them are exercised by the tests above.
test('the released letter reaches the wire as a protected DOCX download', async () => {
  const { adapter, repository } = exportHarness();
  await seedExportCase(repository, exportableRevisions());

  const studioRuntime = createLorStudioRuntime({
    publicDirectory: runtimePublicDirectory,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => EXPORT_NOW,
    entitlementResolver: {
      resolve: async () => ({
        available: true,
        sourceVerified: true,
        studentId: 'student-1',
        actorId: 'student-1',
        role: 'student',
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        revoked: false,
        canaryEnabled: true,
        canaryConsented: true,
      }),
    },
    validateCsrf: () => true,
    application: adapter,
  });

  const runtimeSession = {
    issuedAt: '2026-08-09T14:00:00.000Z',
    expiresAt: '2026-08-09T17:00:00.000Z',
    csrfToken: 'csrf-test-value',
    user: { id: 'student-1' },
  };

  const invokeRuntime = async (pathname) => {
    const response = new ExportMemoryResponse();
    await studioRuntime.handle(
      { method: 'GET', headers: {} },
      response,
      new URL(pathname, 'https://hq.example.test'),
      { session: runtimeSession },
    );
    if (response.statusCode !== 0 && !response.writableFinished) {
      await new Promise((resolve) => response.once('finish', resolve));
    }
    return response;
  };

  const delivered = await invokeRuntime('/api/lor-studio/cases/case-released/final-document/export');
  assert.equal(delivered.statusCode, 200);
  assert.equal(delivered.headers['Content-Type'], DOCX_MIME);
  assert.equal(
    delivered.headers['Content-Disposition'],
    'attachment; filename="lor-case-released-document-1.docx"; '
      + "filename*=UTF-8''lor-case-released-document-1.docx",
  );
  assert.equal(delivered.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(delivered.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(delivered.headers['X-Robots-Tag'], 'noindex, nofollow');
  const bytes = delivered.raw;
  assert.equal(Number(delivered.headers['Content-Length']), bytes.byteLength);
  assert.equal(bytes.subarray(0, 2).toString('ascii'), 'PK');
  assert.match(docxText(bytes), /FINAL LETTER WORDING the student is entitled to hold\./u);

  // A refusal on the same wire is JSON, not a zero-byte download that a browser would save.
  const refused = await invokeRuntime('/api/lor-studio/cases/case-absent/final-document/export');
  assert.equal(refused.statusCode, 404);
  assert.equal(refused.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(refused.headers['Content-Disposition'], undefined);
  assert.deepEqual(JSON.parse(refused.raw.toString('utf8')).error, 'not_found');
});

test('the artifact service defaults to the strictest canary requirement', async () => {
  // The adapter mirrors requireCanary from the case service only when it is an explicit boolean.
  // Absence must therefore mean "require it": an artifact service that evaluated entitlement with
  // a weaker canary requirement than the rest of the application would be a quiet way of widening
  // access without touching the policy.
  const repository = new InMemoryRecommendationCaseRepository();
  await seedExportCase(repository, exportableRevisions());
  const entitlementPort = new StaticEntitlementTestAdapter([
    exportEligible('student-1', { canaryEnabled: false, canaryConsented: false }),
  ]);

  const strict = createRecommendationArtifactService({ repository, entitlementPort });
  await assert.rejects(
    () => strict.exportFinalDocumentArtifact({ actor: EXPORT_STUDENT, caseId: 'case-released' }),
    (error) => error.code === 'AUTHORIZATION_DENIED' && error.details.reasonCode === 'CANARY_NOT_ENABLED',
  );

  // And an adapter built over a case service that never states the setting inherits that default
  // rather than silently coercing the absent value to false.
  const adapter = createLorApplicationAdapter({
    caseService: { entitlementPort },
    repository,
    allowNonDurableForTests: true,
  });
  const denied = await exportCall(adapter);
  assert.equal(denied.status, 404);
  assert.equal(denied.binary, undefined);

  // The same case exports cleanly once the entitlement genuinely carries canary consent, so the
  // refusals above are the canary gate and not a broken fixture.
  const permissive = createRecommendationArtifactService({
    repository,
    entitlementPort: new StaticEntitlementTestAdapter([exportEligible('student-1')]),
  });
  const exported = await permissive.exportFinalDocumentArtifact({
    actor: EXPORT_STUDENT,
    caseId: 'case-released',
  });
  assert.equal(exported.artifact.mimeType, DOCX_MIME);
});
