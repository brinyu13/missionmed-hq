const QA_ALLOWLIST_FLAG = 'USCE_POSTMARK_QA_RECIPIENT_ALLOWLIST';
const APPROVED_QA_RECIPIENT = 'info+usce-qa-20261002@missionmedinstitute.com';

function blocked(httpStatus, error, message) {
  return { ok: false, httpStatus, error, message, retryable: false };
}

export function validateUscePostmarkQaRecipient({ toEmail, subject, body } = {}) {
  const configured = process.env[QA_ALLOWLIST_FLAG];
  // Deliberate variable deletion is the normal-production release step.
  // A configured empty value is invalid and never removes the restriction.
  if (configured === undefined) return { ok: true, qa_only: false };
  if (typeof configured !== 'string' || /[\r\n]/u.test(configured)
    || configured.trim().toLowerCase() !== APPROVED_QA_RECIPIENT) {
    return blocked(503, 'usce_qa_recipient_policy_invalid',
      'The USCE test-recipient restriction is invalid. Nothing was sent.');
  }
  if (typeof toEmail !== 'string' || /[\r\n<>,;]/u.test(toEmail)
    || toEmail.trim().toLowerCase() !== APPROVED_QA_RECIPIENT) {
    return blocked(403, 'usce_qa_recipient_blocked',
      'Live USCE email is restricted to the approved test inbox. Nothing was sent.');
  }
  const prefix = /^\[USCE QA TEST\](?:\s|$)/iu;
  if (typeof subject !== 'string' || typeof body !== 'string'
    || !prefix.test(subject.trim()) || !prefix.test(body.trim())) {
    return blocked(400, 'usce_qa_label_required',
      'Test email requires [USCE QA TEST] at the start of its subject and body. Nothing was sent.');
  }
  return { ok: true, qa_only: true };
}
