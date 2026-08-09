import { ValidationError } from './errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  makeId,
  toIso,
} from './value-utils.js';

function sealReceipt(payload) {
  return deepFreeze({ ...payload, receiptHash: hashValue(payload) });
}

export function createConsentReceipt({
  id,
  caseId,
  studentId,
  scopes,
  policyVersion,
  recordedAt = new Date(),
  idFactory,
}) {
  assertNonEmptyString(caseId, 'caseId');
  assertNonEmptyString(studentId, 'studentId');
  assertNonEmptyString(policyVersion, 'policyVersion');
  if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some((scope) => typeof scope !== 'string')) {
    throw new ValidationError('Consent requires one or more explicit scopes');
  }
  const payload = {
    schemaVersion: 'missionmed.lor.consent-receipt.v1',
    id: id ?? makeId('consent', idFactory),
    caseId,
    actorId: studentId,
    scopes: [...new Set(scopes)].sort(),
    policyVersion,
    recordedAt: toIso(recordedAt, 'recordedAt'),
  };
  return sealReceipt(payload);
}

export function createWaiverReceipt({
  id,
  caseId,
  studentId,
  waived,
  policyVersion,
  priorReceiptId = null,
  acknowledgment,
  recordedAt = new Date(),
  idFactory,
}) {
  assertNonEmptyString(caseId, 'caseId');
  assertNonEmptyString(studentId, 'studentId');
  assertNonEmptyString(policyVersion, 'policyVersion');
  assertNonEmptyString(acknowledgment, 'acknowledgment', { maxLength: 2_000 });
  if (typeof waived !== 'boolean') throw new ValidationError('Waiver state must be explicit');
  if (priorReceiptId !== null) assertNonEmptyString(priorReceiptId, 'priorReceiptId');
  const payload = {
    schemaVersion: 'missionmed.lor.waiver-receipt.v1',
    id: id ?? makeId('waiver', idFactory),
    caseId,
    actorId: studentId,
    waived,
    policyVersion,
    priorReceiptId,
    acknowledgment,
    recordedAt: toIso(recordedAt, 'recordedAt'),
  };
  return sealReceipt(payload);
}

export function currentWaiverState(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return deepFreeze({ decided: false, waived: null, receiptId: null });
  }
  const knownIds = new Set();
  for (const [index, receipt] of receipts.entries()) {
    if (receipt.schemaVersion !== 'missionmed.lor.waiver-receipt.v1') {
      throw new ValidationError('Unsupported waiver receipt schema');
    }
    if (receipt.receiptHash !== hashValue(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptHash')))) {
      throw new ValidationError('Waiver receipt integrity check failed');
    }
    if (knownIds.has(receipt.id)) throw new ValidationError('Duplicate waiver receipt ID');
    if (index === 0 && receipt.priorReceiptId !== null) {
      throw new ValidationError('First waiver receipt cannot supersede another receipt');
    }
    if (index > 0 && receipt.priorReceiptId !== receipts[index - 1].id) {
      throw new ValidationError('Waiver changes must explicitly supersede the current receipt');
    }
    if (
      index > 0 &&
      new Date(receipt.recordedAt).valueOf() <= new Date(receipts[index - 1].recordedAt).valueOf()
    ) {
      throw new ValidationError('Waiver changes cannot be retroactively timestamped');
    }
    if (
      index > 0 &&
      (receipt.caseId !== receipts[0].caseId || receipt.actorId !== receipts[0].actorId)
    ) {
      throw new ValidationError('Waiver receipt chains cannot cross cases or students');
    }
    knownIds.add(receipt.id);
  }
  const latest = receipts.at(-1);
  return deepFreeze({ decided: true, waived: latest.waived, receiptId: latest.id });
}
