import { ValidationError } from './errors.js';
import { assertNonEmptyString, deepFreeze, makeId, toIso } from './value-utils.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

export const RETENTION_POLICY = deepFreeze({
  routineMonthsAfterClosure: 12,
  essentialYearsAfterClosure: 7,
  privilegedSecurityMonths: 24,
  recoverableBackupDeletionDaysMaximum: 35,
  eligibleDeletionCompletionDays: 30,
});

const ARTIFACT_CLASSIFICATION = deepFreeze({
  draft: 'routine_12_month',
  source_selection: 'routine_12_month',
  consent_receipt: 'routine_12_month',
  collaboration: 'routine_12_month',
  routine_operational_log: 'routine_12_month',
  final_letter_provenance: 'essential_7_year',
  faculty_approval_receipt: 'essential_7_year',
  delivery_metadata: 'essential_7_year',
  essential_audit_evidence: 'essential_7_year',
  security_audit: 'privileged_security_24_month',
  privileged_access_audit: 'privileged_security_24_month',
});

function addUtcMonths(dateValue, months) {
  const date = new Date(dateValue);
  const targetMonthStart = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
  const daysInTargetMonth = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const result = new Date(targetMonthStart.valueOf());
  result.setUTCDate(Math.min(date.getUTCDate(), daysInTargetMonth));
  return result;
}

function addUtcYears(dateValue, years) {
  return addUtcMonths(dateValue, years * 12);
}

export function classifyRetentionArtifact(artifactKind) {
  assertNonEmptyString(artifactKind, 'artifactKind');
  const classification = ARTIFACT_CLASSIFICATION[artifactKind];
  if (!classification) throw new ValidationError('Unknown retention artifact kind', { artifactKind });
  return classification;
}

export function retentionDeadline({ artifactKind, closedAt, recordedAt }) {
  const classification = classifyRetentionArtifact(artifactKind);
  if (classification === 'routine_12_month') {
    if (!closedAt) return null;
    return addUtcMonths(toIso(closedAt, 'closedAt'), RETENTION_POLICY.routineMonthsAfterClosure).toISOString();
  }
  if (classification === 'essential_7_year') {
    if (!closedAt) return null;
    return addUtcYears(toIso(closedAt, 'closedAt'), RETENTION_POLICY.essentialYearsAfterClosure).toISOString();
  }
  return addUtcMonths(
    toIso(recordedAt, 'recordedAt'),
    RETENTION_POLICY.privilegedSecurityMonths,
  ).toISOString();
}

export function evaluateRetention({
  artifactKind,
  closedAt = null,
  recordedAt,
  now = new Date(),
  legalHold = false,
}) {
  const classification = classifyRetentionArtifact(artifactKind);
  const deadline = retentionDeadline({ artifactKind, closedAt, recordedAt });
  const isOpenWorkingArtifact = deadline === null;
  const expired = deadline !== null && new Date(now).valueOf() >= new Date(deadline).valueOf();
  return deepFreeze({
    classification,
    deadline,
    disposition: legalHold
      ? 'retain_legal_hold'
      : isOpenWorkingArtifact
        ? 'retain_open_case'
        : expired
          ? 'eligible_for_verified_deletion'
          : 'retain_until_deadline',
  });
}

export function createDeletionIntent({
  id,
  caseId,
  requesterId,
  requestedAt = new Date(),
  legalHold = false,
  exceptionReason = null,
  idFactory,
}) {
  assertNonEmptyString(caseId, 'caseId');
  assertNonEmptyString(requesterId, 'requesterId');
  if (legalHold && !exceptionReason) {
    throw new ValidationError('A legal-hold deletion exception requires a reason');
  }
  const requested = new Date(toIso(requestedAt, 'requestedAt'));
  const due = new Date(requested.valueOf() + RETENTION_POLICY.eligibleDeletionCompletionDays * DAY_MS);
  return deepFreeze({
    schemaVersion: 'missionmed.lor.deletion-intent.v1',
    id: id ?? makeId('deletion', idFactory),
    caseId,
    requesterId,
    requestedAt: requested.toISOString(),
    dueBy: due.toISOString(),
    status: legalHold ? 'blocked_by_legal_hold' : 'pending_verified_deletion',
    legalHold,
    exceptionReason,
    remoteMutationPerformed: false,
  });
}

export function backupDeletionDeadline(deletedAt) {
  const deleted = new Date(toIso(deletedAt, 'deletedAt'));
  return new Date(
    deleted.valueOf() + RETENTION_POLICY.recoverableBackupDeletionDaysMaximum * DAY_MS,
  ).toISOString();
}
