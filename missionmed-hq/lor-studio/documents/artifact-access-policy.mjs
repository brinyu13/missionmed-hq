import { currentWaiverState } from '../domain/receipts.js';

const PRIVATE_CLASSES = new Set(['waived_faculty_private', 'faculty_private']);
const STUDENT_VISIBLE_CLASS = 'nonwaived_student_visible';

/**
 * @typedef {{ id?: string, role?: string }} ArtifactActor
 */

/**
 * @typedef {{
 *   id?: string,
 *   studentId?: string,
 *   faculty?: { facultyId?: string | null, verifiedAt?: string | null },
 *   waiverReceipts?: Array<Record<string, unknown>>,
 * }} ArtifactCaseRecord
 */

/**
 * @typedef {{
 *   caseId?: string,
 *   sha256?: string,
 *   mimeType?: string,
 *   privacyClass?: string,
 * }} ArtifactMetadata
 */

/**
 * @typedef {{
 *   caseId?: string,
 *   granteeId?: string,
 *   canReadProtectedArtifacts?: boolean,
 *   purpose?: string,
 *   writtenAuthorizationReceiptId?: string,
 *   auditReceiptId?: string,
 *   revokedAt?: Date | string | null,
 *   expiresAt?: Date | string | number,
 * }} AdminPrivacyGrant
 */

/**
 * @typedef {{
 *   objectKey?: string,
 *   versionId?: string,
 *   private?: boolean,
 *   encrypted?: boolean,
 * }} PrivateStorageReceipt
 */

function deny(error) {
  return Object.freeze({ allowed: false, error });
}

function resolveWaiverState(caseRecord) {
  try {
    return currentWaiverState(caseRecord?.waiverReceipts);
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   actor: ArtifactActor,
 *   caseRecord: ArtifactCaseRecord,
 *   privacyGrant: AdminPrivacyGrant | null,
 *   now: Date | string | number,
 * }} options
 */
function validAdminPrivacyGrant({ actor, caseRecord, privacyGrant, now }) {
  const expiresAt = Date.parse(String(privacyGrant?.expiresAt || ''));
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return privacyGrant?.caseId === caseRecord.id
    && privacyGrant?.granteeId === actor.id
    && privacyGrant?.canReadProtectedArtifacts === true
    && typeof privacyGrant?.purpose === 'string'
    && privacyGrant.purpose.trim().length > 0
    && typeof privacyGrant?.writtenAuthorizationReceiptId === 'string'
    && privacyGrant.writtenAuthorizationReceiptId.trim().length > 0
    && typeof privacyGrant?.auditReceiptId === 'string'
    && privacyGrant.auditReceiptId.trim().length > 0
    && privacyGrant?.revokedAt == null
    && Number.isFinite(expiresAt)
    && Number.isFinite(nowMs)
    && expiresAt > nowMs;
}

/**
 * @param {{
 *   actor?: ArtifactActor,
 *   artifact?: ArtifactMetadata,
 *   caseRecord?: ArtifactCaseRecord,
 *   privacyGrant?: AdminPrivacyGrant | null,
 *   now?: Date | string | number,
 * }} [options]
 */
export function authorizeArtifactAccess({
  actor,
  artifact,
  caseRecord,
  privacyGrant = null,
  now = new Date(),
} = {}) {
  if (!actor?.id || !actor?.role || !artifact?.privacyClass || !caseRecord?.studentId) {
    return deny('artifact_access_context_incomplete');
  }
  if (String(artifact.caseId || '') !== String(caseRecord.id || '')) return deny('artifact_case_mismatch');

  if (actor.role === 'student') {
    if (String(actor.id) !== String(caseRecord.studentId)) return deny('student_case_forbidden');
    const waiver = resolveWaiverState(caseRecord);
    if (!waiver?.decided) return deny('waiver_state_unresolved');
    if (waiver.waived === true || PRIVATE_CLASSES.has(artifact.privacyClass)) {
      return deny('waived_or_private_artifact_forbidden');
    }
    if (artifact.privacyClass !== STUDENT_VISIBLE_CLASS) return deny('artifact_privacy_class_forbidden');
    return Object.freeze({ allowed: true, projection: 'student_visible' });
  }

  if (actor.role === 'faculty') {
    if (
      String(actor.id) !== String(caseRecord.faculty?.facultyId || '')
      || !caseRecord.faculty?.verifiedAt
    ) return deny('faculty_case_forbidden');
    return Object.freeze({ allowed: true, projection: 'faculty_owner' });
  }

  if (actor.role === 'admin') {
    if (!validAdminPrivacyGrant({ actor, caseRecord, privacyGrant, now })) {
      return deny('admin_privacy_grant_required');
    }
    return Object.freeze({ allowed: true, projection: 'authorized_admin' });
  }

  return deny('artifact_role_forbidden');
}

/**
 * @param {{
 *   artifact?: ArtifactMetadata,
 *   storageReceipt?: PrivateStorageReceipt,
 *   caseRecord?: ArtifactCaseRecord,
 *   now?: Date,
 * }} [options]
 */
export function buildWriterDepotRecord({ artifact, storageReceipt, caseRecord, now = new Date() } = {}) {
  if (!artifact?.sha256 || !artifact?.mimeType || !artifact?.privacyClass || !artifact?.caseId) {
    throw new Error('Complete artifact metadata is required.');
  }
  if (String(artifact.caseId) !== String(caseRecord?.id || '')) throw new Error('Artifact case mismatch.');
  const objectKey = String(storageReceipt?.objectKey || '').trim();
  const versionId = String(storageReceipt?.versionId || '').trim();
  if (!objectKey || !versionId || storageReceipt?.private !== true || storageReceipt?.encrypted !== true) {
    throw new Error('A private, encrypted, versioned storage receipt is required.');
  }
  if (objectKey.includes('..') || objectKey.startsWith('/') || objectKey.includes('\\')) {
    throw new Error('Unsafe Writer Depot object key.');
  }
  return Object.freeze({
    caseId: artifact.caseId,
    artifactSha256: artifact.sha256,
    mimeType: artifact.mimeType,
    privacyClass: artifact.privacyClass,
    objectKey,
    storageVersionId: versionId,
    createdAt: now.toISOString(),
    accessMode: 'server_authorized_private',
  });
}
