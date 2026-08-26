import { createAuditEvent } from '../audit/audit-events.mjs';
import { authorizeArtifactAccess } from '../documents/artifact-access-policy.mjs';
import { renderRecommendationDocx } from '../documents/recommendation-artifacts.mjs';
import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IntegrationDisabledError,
  ValidationError,
} from '../domain/errors.js';
import { finalDocumentContentHash } from '../domain/recommendation-case.js';
import { currentWaiverState } from '../domain/receipts.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  deepFreeze,
  hashValue,
  makeId,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { resolveTrustedStudentAuthorization } from '../security/authorization-policy.js';
import { planCaseExport } from './export-service.js';
import { assertPort } from './ports.js';

/**
 * The delivery path for the final recommendation artifact.
 *
 * documents/recommendation-artifacts.mjs could already render a genuine OOXML DOCX, and
 * services/export-service.js could already plan an authorised export, but nothing joined them:
 * there was no producer that turned a recommendation-case aggregate into the artifact model the
 * renderer demands. This module is that producer, and it is deliberately the ONLY place where
 * one is built, so every rule about who may hold a letter is enforced in one auditable sequence:
 *
 *   planCaseExport  -> role/purpose/destination pairing + projectCaseForActor (the same
 *                      authorisation every read route runs; entitlement, ownership, faculty
 *                      recipient binding, canary requirement)
 *   authorizeArtifactAccess -> the artifact-level gate: waiver decided, not waived, privacy
 *                      class permitted for this actor
 *   render          -> renderRecommendationDocx, which independently refuses anything that is
 *                      not faculty-final, approved, and signature-attested
 *   audit           -> artifact.generated / artifact.denied
 *
 * Three properties are worth stating plainly, because they are the ones a future change is most
 * likely to erode:
 *
 * 1. THE LETTER TEXT IS READ OUT OF THE AUTHORISED PROJECTION, NEVER OUT OF THE AGGREGATE.
 *    A student's DOCX is built from `projection.finalDocument`, which authorization-policy.js
 *    populates only when a release record exists and the student did not waive access. There is
 *    therefore no second definition of "released" to drift: an unreleased or waived letter is
 *    absent from the projection, so there is literally nothing to render and the export fails
 *    closed. An export can never show a student something the case screen would hide.
 *
 * 2. NO CALLER-SUPPLIED AUTHORISATION MATERIAL IS ACCEPTED, EVER. The request shape is an exact
 *    two-key allowlist. A `privacyGrant`, `operationalGrant`, `serviceGrant`, `entitlement`, or
 *    `projection` arriving from a caller is rejected outright rather than forwarded, so the
 *    administrative-grant forgery boundary closed in the grant repository cannot be reopened
 *    through this door. Operational roles are not exported at all (see EXPORT_PROFILES): the
 *    operational projection contains no letter, and issuing a content grant is a decision for
 *    the grant repository and its privacy authority, not for an export route.
 *
 * 3. A SUCCESSFUL EXPORT THAT CANNOT BE AUDITED DOES NOT HAPPEN. Protected content leaving the
 *    system is exactly the event an audit trail exists for, so a failing sink fails the export.
 */

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ARTIFACT_FORMAT = 'docx';
const EXPORT_ACTION = 'export_final_document';

// recommendation-artifacts.mjs validates every paragraph with the default 12_000-character
// bound and caps sections at 40. Chunking here keeps a long but legitimate letter renderable;
// exceeding the paragraph cap fails closed rather than silently truncating a legal document.
const MAX_PARAGRAPH_CHARACTERS = 12_000;
const MAX_PARAGRAPHS = 2_000;
const MAX_EVIDENCE_PROVENANCE = 20;

/**
 * @typedef {object} ExportProfile
 * @property {string} purpose
 * @property {string} destinationClass
 * @property {string} privacyClass
 * @property {string} expectedProjection
 * @property {boolean} facultyPrivateCopy
 * @property {string} sectionHeading
 * @property {(projection: Record<string, any>) => (Record<string, any> | null)} readFinalDocument
 */

/**
 * The complete set of export profiles. A role that is absent here cannot export at all.
 *
 * purpose/destinationClass are the pairs export-service.js already declares for the role
 * (ROLE_EXPORT_RULES); they are stated here rather than accepted from a caller so no request can
 * choose a wider destination than its role permits.
 *
 * `readFinalDocument` names WHERE in the authorised projection the wording comes from. That
 * indirection is the point: it makes "the artifact carries exactly what this actor is permitted
 * to read" a structural property rather than a comment.
 */
/** @type {Readonly<Record<string, ExportProfile>>} */
const EXPORT_PROFILES = Object.freeze({
  student: Object.freeze({
    purpose: 'student_copy',
    destinationClass: 'actor_private_download',
    privacyClass: 'nonwaived_student_visible',
    expectedProjection: 'student_visible',
    facultyPrivateCopy: false,
    sectionHeading: 'Final recommendation',
    /** @param {Record<string, any>} projection */
    readFinalDocument: (projection) => projection?.finalDocument ?? null,
  }),
  faculty: Object.freeze({
    purpose: 'faculty_review',
    destinationClass: 'faculty_private_workspace',
    // The renderer allows exactly two privacy classes, and the writer's own copy is the private
    // one. The label is the policy's name for "not student-visible"; it does not assert that the
    // student waived, and nothing downstream reads it as that.
    privacyClass: 'waived_faculty_private',
    expectedProjection: 'faculty_owner',
    facultyPrivateCopy: true,
    sectionHeading: 'Faculty-final wording',
    /** @param {Record<string, any>} projection */
    readFinalDocument: (projection) => projection?.facultyPrivate?.finalDocument ?? null,
  }),
});

const ALLOWED_REQUEST_FIELDS = Object.freeze(['actor', 'caseId']);

/**
 * @typedef {{ id?: string, role?: string }} ArtifactExportActor
 */

/**
 * @typedef {object} ArtifactExportRequest
 * @property {ArtifactExportActor} actor
 * @property {string} caseId
 */

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function chunkParagraph(value) {
  const text = String(value).trim();
  if (text.length <= MAX_PARAGRAPH_CHARACTERS) return text ? [text] : [];
  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_PARAGRAPH_CHARACTERS) {
    const boundary = remaining.lastIndexOf(' ', MAX_PARAGRAPH_CHARACTERS);
    const cut = boundary > 0 ? boundary : MAX_PARAGRAPH_CHARACTERS;
    const head = remaining.slice(0, cut).trim();
    if (head) chunks.push(head);
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/**
 * Blank-line separated blocks become paragraphs; single newlines stay inside a paragraph because
 * the renderer already emits them as line breaks. Nothing is reflowed and nothing is dropped.
 *
 * @param {unknown} text
 * @returns {string[]}
 */
function letterParagraphs(text) {
  const paragraphs = String(text)
    .split(/\r?\n[ \t]*\r?\n/u)
    .flatMap(chunkParagraph);
  if (paragraphs.length === 0) {
    throw new ValidationError('The final document has no renderable wording');
  }
  if (paragraphs.length > MAX_PARAGRAPHS) {
    throw new ValidationError('The final document has too many paragraphs to render as an artifact');
  }
  return paragraphs;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function usableReference(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Provenance is drawn from the records that actually produced this artifact - the case, the
 * document and its content hash, the approval, the waiver decision the release relied on, the
 * release itself, and any student evidence the case carries. Nothing is invented: an entry whose
 * source reference does not exist on the aggregate is omitted rather than filled in.
 *
 * @param {{ caseRecord: Record<string, any>, finalDocument: Record<string, any> | null, waiver: Record<string, any> }} input
 */
function buildProvenance({ caseRecord, finalDocument, waiver }) {
  const lifecycle = caseRecord.finalDocumentState ?? {};
  const release = lifecycle.release ?? null;
  const evidence = Array.isArray(caseRecord.studentEvidence)
    ? caseRecord.studentEvidence.slice(0, MAX_EVIDENCE_PROVENANCE)
    : [];
  const candidates = [
    { sourceType: 'recommendation_case', sourceRef: caseRecord.id },
    { sourceType: 'final_document', sourceRef: finalDocument?.id },
    {
      sourceType: 'final_document_content_hash',
      sourceRef: release?.documentHash ?? finalDocumentContentHash(finalDocument ?? null),
    },
    { sourceType: 'faculty_approval', sourceRef: lifecycle.facultyApproval?.approvedAt },
    { sourceType: 'waiver_receipt', sourceRef: waiver?.receiptId },
    { sourceType: 'final_document_release', sourceRef: release?.releasedAt },
    ...evidence.map((item) => ({ sourceType: item?.sourceType, sourceRef: item?.id })),
  ];
  const provenance = candidates.filter(
    (item) => usableReference(item.sourceType) && usableReference(item.sourceRef),
  );
  if (provenance.length === 0) {
    throw new ValidationError('A final recommendation artifact requires evidence provenance');
  }
  return provenance;
}

/**
 * Build the artifact model renderRecommendationDocx demands.
 *
 * Every field is READ, never asserted. `documentState` and `facultyApproval` come from the
 * aggregate's own final-document lifecycle, so a document that is not faculty-final, approved,
 * and signature-attested reaches the renderer in exactly that state and is refused there - the
 * model producer does not get to decide that a document is releasable.
 *
 * @param {{
 *   caseRecord: Record<string, any>,
 *   projection: Record<string, any>,
 *   profile: ExportProfile,
 * }} input
 */
function buildArtifactModel({ caseRecord, projection, profile }) {
  const finalDocument = profile.readFinalDocument(projection);
  if (!finalDocument || typeof finalDocument.text !== 'string' || finalDocument.text.trim() === '') {
    // For a student this is the release/waiver gate speaking: authorization-policy.js omits
    // finalDocument from the projection unless a release record exists and access was retained.
    throw new AuthorizationDeniedError('FINAL_DOCUMENT_NOT_AVAILABLE_TO_ACTOR');
  }
  const lifecycle = caseRecord.finalDocumentState ?? {};
  const approval = lifecycle.facultyApproval ?? null;
  // The renderer refuses both of these itself and remains the authority; restating them here only
  // changes WHICH failure the caller sees. Without it a faculty writer asking for a document that
  // is still a proposal would get an opaque 500 instead of the honest answer that the wording is
  // not final. The actor has already cleared both authorisation gates by this point, so naming
  // the document's own state reveals nothing they are not entitled to know.
  if (lifecycle.documentState !== 'faculty_final') {
    throw new DomainInvariantError(
      'Only faculty-final wording may be exported as a release artifact',
      { reasonCode: 'FINAL_DOCUMENT_NOT_FACULTY_FINAL' },
    );
  }
  if (approval?.approved !== true || approval?.signatureAttested !== true) {
    throw new DomainInvariantError(
      'Faculty approval and signature attestation are required before export',
      { reasonCode: 'FINAL_DOCUMENT_NOT_APPROVED' },
    );
  }
  const waiver = currentWaiverState(caseRecord.waiverReceipts);
  return {
    caseId: caseRecord.id,
    title: 'Letter of Recommendation',
    documentState: lifecycle.documentState ?? null,
    privacyClass: profile.privacyClass,
    // Computed from the recorded waiver decision rather than asserted. A student-visible artifact
    // built over a waived case therefore fails inside validateModel, which is a second,
    // independent refusal behind authorizeArtifactAccess.
    containsWaivedContent: waiver.waived === true,
    containsFacultyPrivateContent: profile.facultyPrivateCopy === true,
    facultyApproval: approval === null ? null : {
      approved: approval.approved,
      signatureAttested: approval.signatureAttested,
      approvedAt: approval.approvedAt,
    },
    sections: [{
      heading: profile.sectionHeading,
      paragraphs: letterParagraphs(finalDocument.text),
    }],
    provenance: buildProvenance({ caseRecord, finalDocument, waiver }),
  };
}

function hasExactKeys(value, fields) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((key) => fields.includes(key));
}

function assertActorSafeExportDto(value, { actor, caseId }) {
  const fields = [
    'schemaVersion', 'caseId', 'studentId', 'actorRef', 'actorRole', 'revision',
    'finalDocument', 'documentState', 'facultyApproval', 'waiverState', 'release',
    'exportProjection',
  ];
  if (!hasExactKeys(value, fields)) {
    throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_DTO_INVALID');
  }
  if (
    value.schemaVersion !== 'missionmed.lor.final-document-export.v1'
    || value.caseId !== caseId
    || value.actorRole !== actor.role
    || value.actorRef !== `actor_${sha256(`lor-studio:actor:${actor.id}`)}`
    || value.exportProjection !== (actor.role === 'student' ? 'student_visible' : 'faculty_owner')
    || !Number.isSafeInteger(value.revision)
    || value.revision < 0
    || (actor.role === 'student' && value.studentId !== actor.id)
  ) throw new AuthorizationDeniedError('ACTOR_SAFE_EXPORT_DTO_SCOPE_INVALID');

  const waiver = value.waiverState;
  if (
    !hasExactKeys(waiver, ['decided', 'receiptId', 'waived'])
    || typeof waiver.decided !== 'boolean'
    || (waiver.decided === false && (waiver.receiptId !== null || waiver.waived !== null))
    || (waiver.decided === true && (
      typeof waiver.receiptId !== 'string'
      || waiver.receiptId.length === 0
      || typeof waiver.waived !== 'boolean'
    ))
  ) throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_WAIVER_INVALID');

  const document = value.finalDocument;
  if (document !== null) {
    if (!hasExactKeys(
      document,
      ['contentHash', 'id', 'mimeType', 'releasedToStudentAt', 'text'],
    )) throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_DOCUMENT_INVALID');
    for (const field of ['contentHash', 'id', 'mimeType', 'releasedToStudentAt', 'text']) {
      if (document[field] !== null && typeof document[field] !== 'string') {
        throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_DOCUMENT_INVALID');
      }
    }
    if (document.contentHash !== null && !/^[a-f0-9]{64}$/u.test(document.contentHash)) {
      throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_DOCUMENT_INVALID');
    }
    if (document.releasedToStudentAt !== null) {
      toIso(document.releasedToStudentAt, 'finalDocument.releasedToStudentAt');
    }
  }

  const approval = value.facultyApproval;
  if (approval !== null) {
    if (
      !hasExactKeys(approval, ['approved', 'approvedAt', 'facultyRef', 'signatureAttested'])
      || typeof approval.approved !== 'boolean'
      || typeof approval.signatureAttested !== 'boolean'
      || !/^faculty_[a-f0-9]{64}$/u.test(approval.facultyRef ?? '')
    ) throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_APPROVAL_INVALID');
    toIso(approval.approvedAt, 'facultyApproval.approvedAt');
  }

  const release = value.release;
  if (release !== null) {
    if (!hasExactKeys(
      release,
      ['documentHash', 'documentId', 'releasedAt', 'releasedAtRevision', 'waiverReceiptId'],
    )) throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_RELEASE_INVALID');
    if (
      !/^[a-f0-9]{64}$/u.test(release.documentHash ?? '')
      || typeof release.documentId !== 'string'
      || release.documentId.length === 0
      || typeof release.waiverReceiptId !== 'string'
      || release.waiverReceiptId.length === 0
      || !Number.isSafeInteger(release.releasedAtRevision)
      || release.releasedAtRevision < 0
      || release.releasedAtRevision > value.revision
      || document === null
      || release.documentId !== document.id
      || release.documentHash !== finalDocumentContentHash(document)
      || toIso(release.releasedAt, 'release.releasedAt') !== document.releasedToStudentAt
    ) throw new IntegrationDisabledError('lor_artifact_export', 'ACTOR_SAFE_EXPORT_RELEASE_INVALID');
  }
  if (
    actor.role === 'student'
    && (
      document === null
      || waiver.decided !== true
      || waiver.waived !== false
      || release === null
    )
  ) throw new AuthorizationDeniedError('FINAL_DOCUMENT_NOT_AVAILABLE_TO_ACTOR');
  return deepFreeze(structuredClone(value));
}

function buildActorSafeArtifactModel({ exportDto, actor, profile }) {
  const finalDocument = exportDto.finalDocument;
  if (!finalDocument || typeof finalDocument.text !== 'string' || finalDocument.text.trim() === '') {
    throw new AuthorizationDeniedError('FINAL_DOCUMENT_NOT_AVAILABLE_TO_ACTOR');
  }
  if (exportDto.documentState !== 'faculty_final') {
    throw new DomainInvariantError(
      'Only faculty-final wording may be exported as a release artifact',
      { reasonCode: 'FINAL_DOCUMENT_NOT_FACULTY_FINAL' },
    );
  }
  const approval = exportDto.facultyApproval;
  if (approval?.approved !== true || approval.signatureAttested !== true) {
    throw new DomainInvariantError(
      'Faculty approval and signature attestation are required before export',
      { reasonCode: 'FINAL_DOCUMENT_NOT_APPROVED' },
    );
  }
  const candidates = [
    { sourceType: 'recommendation_case', sourceRef: exportDto.caseId },
    { sourceType: 'final_document', sourceRef: finalDocument.id },
    {
      sourceType: 'final_document_content_hash',
      sourceRef: exportDto.release?.documentHash ?? finalDocumentContentHash(finalDocument),
    },
    { sourceType: 'faculty_approval', sourceRef: approval.approvedAt },
    { sourceType: 'waiver_receipt', sourceRef: exportDto.waiverState.receiptId },
    { sourceType: 'final_document_release', sourceRef: exportDto.release?.releasedAt },
  ];
  return {
    caseId: exportDto.caseId,
    title: 'Letter of Recommendation',
    documentState: exportDto.documentState,
    privacyClass: profile.privacyClass,
    containsWaivedContent: exportDto.waiverState.waived === true,
    containsFacultyPrivateContent: profile.facultyPrivateCopy === true,
    facultyApproval: {
      approved: approval.approved,
      signatureAttested: approval.signatureAttested,
      approvedAt: approval.approvedAt,
    },
    sections: [{
      heading: profile.sectionHeading,
      paragraphs: letterParagraphs(finalDocument.text),
    }],
    provenance: candidates.filter(
      (item) => usableReference(item.sourceType) && usableReference(item.sourceRef),
    ),
  };
}

function buildActorSafeExportIntent({ exportDto, actor, profile, at, idFactory }) {
  return deepFreeze({
    schemaVersion: 'missionmed.lor.export-intent.v1',
    id: makeId('export', idFactory),
    actorId: actor.id,
    actorRole: actor.role,
    caseId: exportDto.caseId,
    projectionHash: hashValue(exportDto),
    destinationClass: profile.destinationClass,
    purpose: profile.purpose,
    plannedAt: toIso(at, 'now'),
    remoteMutationPerformed: false,
  });
}

function artifactFilename() {
  // Case and document identifiers remain in the server-side export intent and audit receipt. A
  // download name is forwarded with the file, so it must not become a second portable identifier.
  return `letter-of-recommendation.${ARTIFACT_FORMAT}`;
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function denialReasonCode(error) {
  const raw = String(
    /** @type {any} */ (error)?.details?.reasonCode
      || /** @type {any} */ (error)?.code
      || 'INTERNAL_ERROR',
  );
  return raw.slice(0, 120);
}

/**
 * @typedef {object} RecommendationArtifactServiceOptions
 * @property {{ isDurable?: boolean, getById?: (caseId: string) => Promise<Record<string, any>>, readFinalDocumentExport?: (input: {caseId: string, actorId: string, actorRole: string}) => Promise<unknown> }} repository
 * @property {{ getStudentEntitlement: (input: { studentId: string }) => Promise<any> }} entitlementPort
 * @property {{ emit: (event: unknown, context?: {actorId?: string, actorRole?: string, caseId?: string}) => Promise<unknown>, isDurable?: boolean, serverOnly?: boolean, actorCaseBound?: boolean, appendOnly?: boolean } | null} [auditSink]
 * @property {() => Date | string | number} [clock]
 * @property {boolean} [requireCanary]
 * @property {() => string} [idFactory]
 */

/**
 * @param {RecommendationArtifactServiceOptions} options
 */
export function createRecommendationArtifactService({
  repository,
  entitlementPort,
  auditSink = null,
  clock = () => new Date(),
  // Defaults to the strictest setting. An artifact service that evaluated entitlement with a
  // weaker canary requirement than the case service would be a quieter way of widening access
  // than changing the policy, so absence means "require it".
  requireCanary = true,
  idFactory,
} = /** @type {any} */ ({})) {
  const durableRepository = repository?.isDurable === true;
  assertPort(
    repository,
    durableRepository ? ['readFinalDocumentExport'] : ['getById'],
    'repository',
  );
  assertPort(entitlementPort, ['getStudentEntitlement'], 'entitlementPort');
  if (auditSink !== null && auditSink !== undefined) assertPort(auditSink, ['emit'], 'auditSink');
  if (typeof clock !== 'function') throw new TypeError('clock must be a server-side function');
  if (typeof requireCanary !== 'boolean') throw new TypeError('requireCanary must be an explicit boolean');
  const sink = auditSink ?? null;
  const durableAuditBound = Boolean(
    sink
    && sink.isDurable === true
    && sink.serverOnly === true
    && sink.actorCaseBound === true
    && sink.appendOnly === true
  );

  /**
   * A denial is enforced by the error that follows whether or not it could be recorded, and a
   * failing sink must not become a different, more informative response than the denial itself.
   *
   * @param {{ actor: ArtifactExportActor, caseId: unknown, reasonCode: string, at: Date }} input
   */
  async function auditDenial({ actor, caseId, reasonCode, at }) {
    if (!sink) return;
    try {
      await sink.emit(
        createAuditEvent({
          type: 'artifact.denied',
          actor: { id: actor?.id, role: actor?.role },
          caseId: String(caseId ?? ''),
          outcome: 'denied',
          metadata: { action: EXPORT_ACTION, artifactFormat: ARTIFACT_FORMAT, reasonCode },
          at,
        }),
        {
          actorId: actor?.id,
          actorRole: actor?.role,
          caseId: String(caseId ?? ''),
        },
      );
    } catch {
      // Intentionally swallowed: see above.
    }
  }

  /**
   * @param {{ actor: ArtifactExportActor, caseId: string, targetId: string, result: string, artifactSha256: string, releaseDocumentHash: string | null, sourceRevision: number, at: Date }} input
   */
  async function auditGeneration({
    actor,
    caseId,
    targetId,
    result,
    artifactSha256,
    releaseDocumentHash,
    sourceRevision,
    at,
  }) {
    const event = createAuditEvent({
      type: 'artifact.generated',
      actor: { id: actor.id, role: actor.role },
      caseId,
      targetId,
      outcome: 'success',
      metadata: {
        action: EXPORT_ACTION,
        artifactFormat: ARTIFACT_FORMAT,
        result,
        artifactSha256,
        releaseDocumentHash,
        sourceRevision,
      },
      at,
    });
    if (!sink || (durableRepository && !durableAuditBound)) {
      if (durableRepository) {
        throw new IntegrationDisabledError('lor_artifact_audit_sink', 'AUDIT_SINK_REQUIRED');
      }
      return Object.freeze({ event, receipt: null });
    }
    let receipt;
    try {
      receipt = await sink.emit(event, {
        actorId: actor.id,
        actorRole: actor.role,
        caseId,
      });
    } catch {
      // Protected content is about to leave the system. If that cannot be recorded, it does not
      // leave: an unauditable release of a recommendation letter is not a degraded success.
      throw new IntegrationDisabledError('lor_artifact_audit_sink', 'AUDIT_SINK_FAIL_CLOSED');
    }
    return Object.freeze({ event, receipt: receipt ?? null });
  }

  /**
   * Render the authorised DOCX for one actor and one case.
   *
   * @param {ArtifactExportRequest} input
   */
  async function exportFinalDocumentArtifact(input) {
    const request = assertPlainObject(input, 'artifact export input');
    const unexpectedKeys = Object.keys(request).filter((key) => !ALLOWED_REQUEST_FIELDS.includes(key));
    if (unexpectedKeys.length > 0) {
      // Named explicitly because this is the forgery boundary: grants, entitlements, projections,
      // and privacy classes are resolved server-side from the stored case, and a caller that
      // supplies one is refused rather than having it ignored.
      throw new ValidationError('Artifact export accepts no caller-supplied authorization material');
    }
    const { actor, caseId } = request;
    // Normalised once, so every gate below - the export intent, the artifact policy, and both
    // audit events - reasons about the same instant, and a clock that returns something other
    // than a Date is refused here rather than silently reinterpreted downstream.
    const at = new Date(toIso(clock(), 'artifact export clock'));

    try {
      assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
      const profile = typeof actor?.role === 'string' ? EXPORT_PROFILES[actor.role] : undefined;
      if (!profile || typeof actor?.id !== 'string' || actor.id.trim() === '') {
        throw new AuthorizationDeniedError('ARTIFACT_EXPORT_ROLE_DENIED');
      }

      if (durableRepository) {
        const exportDto = assertActorSafeExportDto(
          await /** @type {Function} */ (repository.readFinalDocumentExport)({
            caseId,
            actorId: actor.id,
            actorRole: actor.role,
          }),
          { actor, caseId },
        );
        const entitlement = await entitlementPort.getStudentEntitlement({
          studentId: exportDto.studentId,
        });
        resolveTrustedStudentAuthorization(entitlement, {
          studentId: exportDto.studentId,
          requireCanary,
        });
        const exportIntent = buildActorSafeExportIntent({
          exportDto,
          actor,
          profile,
          at,
          idFactory,
        });
        const artifact = renderRecommendationDocx(
          buildActorSafeArtifactModel({ exportDto, actor, profile }),
        );
        if (artifact.mimeType !== DOCX_MIME_TYPE) {
          throw new ValidationError('The rendered artifact did not carry the expected DOCX media type');
        }
        const documentId = exportDto.finalDocument?.id ?? exportDto.caseId;
        const audit = await auditGeneration({
          actor,
          caseId: exportDto.caseId,
          targetId: String(documentId),
          result: exportDto.exportProjection,
          artifactSha256: artifact.sha256,
          releaseDocumentHash: exportDto.release?.documentHash ?? null,
          sourceRevision: exportDto.revision,
          at,
        });
        return Object.freeze({
          artifact,
          filename: artifactFilename(),
          exportIntent,
          auditEvent: audit.event,
          auditReceipt: audit.receipt,
        });
      }

      const caseRecord = await repository.getById(caseId);
      const entitlement = await entitlementPort.getStudentEntitlement({
        studentId: caseRecord.studentId,
      });

      // Authorisation gate 1: the same projection every read route serves, produced under the
      // same policy. serviceGrant and operationalGrant are deliberately NOT forwarded - neither
      // role exports, and there is no caller-supplied capability to forward in the first place.
      const { exportIntent, projection } = planCaseExport({
        // The intent identifier is minted inside planCaseExport. It is passed as undefined rather
        // than omitted so this call site cannot quietly acquire the ability to choose one.
        id: undefined,
        caseRecord,
        actor,
        entitlement,
        purpose: profile.purpose,
        destinationClass: profile.destinationClass,
        requireCanary,
        now: at,
        idFactory,
      });

      // Authorisation gate 2: the artifact-level policy. For a student this re-reads the waiver
      // chain and the privacy class independently of the projection that produced the wording.
      const access = authorizeArtifactAccess({
        actor,
        artifact: {
          caseId: caseRecord.id,
          privacyClass: profile.privacyClass,
          mimeType: DOCX_MIME_TYPE,
        },
        caseRecord,
        privacyGrant: null,
        now: at,
      });
      if (access.allowed !== true) {
        throw new AuthorizationDeniedError(String(access.error || 'ARTIFACT_ACCESS_DENIED').toUpperCase());
      }
      if (access.projection !== profile.expectedProjection) {
        throw new AuthorizationDeniedError('ARTIFACT_PROJECTION_MISMATCH');
      }

      const model = buildArtifactModel({ caseRecord, projection, profile });
      // Gate 3 lives inside the renderer: faculty-final wording, approval, signature attestation,
      // an approved privacy class, and no protected content in a student-visible artifact.
      const artifact = renderRecommendationDocx(model);
      if (artifact.mimeType !== DOCX_MIME_TYPE) {
        throw new ValidationError('The rendered artifact did not carry the expected DOCX media type');
      }

      const documentId = profile.readFinalDocument(projection)?.id ?? caseRecord.id;
      const audit = await auditGeneration({
        actor,
        caseId: caseRecord.id,
        targetId: String(documentId),
        result: String(access.projection),
        artifactSha256: artifact.sha256,
        releaseDocumentHash: caseRecord.finalDocumentState?.release?.documentHash ?? null,
        sourceRevision: caseRecord.revision,
        at,
      });

      return Object.freeze({
        artifact,
        filename: artifactFilename(),
        exportIntent,
        auditEvent: audit.event,
        auditReceipt: audit.receipt,
      });
    } catch (error) {
      await auditDenial({ actor, caseId, reasonCode: denialReasonCode(error), at });
      throw error;
    }
  }

  return Object.freeze({
    artifactMimeType: DOCX_MIME_TYPE,
    auditMode: durableRepository && durableAuditBound
      ? 'durable_actor_case_bound_append_only'
      : durableRepository
        ? 'unavailable'
        : 'non_durable_test_only',
    exportFinalDocumentArtifact,
  });
}
