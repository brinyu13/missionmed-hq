export const ANSWER_ASSET_SCHEMA = 'ivoc.answer_asset.v1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBJECT = /^wp:[1-9][0-9]{0,19}$/u;
const STATUSES = new Set(['private', 'match_bridge_ready', 'revoked']);
const AUDIENCES = new Set(['student', 'mentor', 'match_bridge']);

function text(value, label, minimum, maximum) {
  const normalized = String(value || '').trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new TypeError(`${label}_invalid`);
  }
  return normalized;
}

function uuid(value, label) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID.test(normalized)) throw new TypeError(`${label}_invalid`);
  return normalized;
}

function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label}_invalid`);
  return value;
}

function normalizeConsent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join(',') !== 'granted,grantedAt,scope') {
    throw new TypeError('answer_asset_consent_invalid');
  }
  if (typeof value.granted !== 'boolean' || value.scope !== 'bounded_clip') {
    throw new TypeError('answer_asset_consent_invalid');
  }
  let grantedAt = null;
  if (value.granted) {
    const parsed = Date.parse(value.grantedAt);
    if (!Number.isFinite(parsed)) throw new TypeError('answer_asset_consent_invalid');
    grantedAt = new Date(parsed).toISOString();
  } else if (value.grantedAt !== null) {
    throw new TypeError('answer_asset_consent_invalid');
  }
  return Object.freeze({ granted: value.granted, scope: 'bounded_clip', grantedAt });
}

export function normalizeAnswerAssetWrite(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('answer_asset_input_invalid');
  }
  const status = String(value.status || '').trim().toLowerCase();
  const audiences = Array.isArray(value.audiences)
    ? [...new Set(value.audiences.map((item) => String(item || '').trim().toLowerCase()))].sort()
    : [];
  const consent = normalizeConsent(value.consent);
  const startMs = integer(value.startMs, 'answer_asset_start');
  const endMs = integer(value.endMs, 'answer_asset_end');
  const expectedVersion = integer(value.expectedVersion, 'answer_asset_expected_version');
  if (!STATUSES.has(status) || endMs <= startMs
      || audiences.length > 3 || audiences.some((item) => !AUDIENCES.has(item))
      || typeof value.strongestAnswer !== 'boolean') {
    throw new TypeError('answer_asset_input_invalid');
  }
  if (status === 'private' && (!audiences.includes('student')
      || audiences.includes('match_bridge') || consent.granted)) {
    throw new TypeError('answer_asset_private_audience_invalid');
  }
  if (status === 'match_bridge_ready' && (!audiences.includes('student')
      || !audiences.includes('match_bridge') || !consent.granted)) {
    throw new TypeError('answer_asset_consent_required');
  }
  if (status === 'revoked' && audiences.length !== 0) {
    throw new TypeError('answer_asset_revoked_audience_invalid');
  }
  return Object.freeze({
    schema: ANSWER_ASSET_SCHEMA,
    assetId: uuid(value.assetId, 'answer_asset_id'),
    expectedVersion,
    ownerSubject: text(value.ownerSubject, 'answer_asset_owner', 4, 32),
    sessionId: uuid(value.sessionId, 'answer_asset_session'),
    recordingId: uuid(value.recordingId, 'answer_asset_recording'),
    answerSegmentId: text(value.answerSegmentId, 'answer_asset_segment', 1, 160),
    questionId: text(value.questionId, 'answer_asset_question', 1, 120),
    title: text(value.title, 'answer_asset_title', 3, 160),
    startMs, endMs, status, audiences: Object.freeze(audiences), consent,
    strongestAnswer: value.strongestAnswer,
    changeReason: text(value.changeReason, 'answer_asset_change_reason', 3, 400),
  });
}

export function assertAnswerAssetOwner(asset, actor) {
  const subject = String(actor || '').trim();
  if (!SUBJECT.test(subject) || asset.ownerSubject !== subject) {
    throw new TypeError('answer_asset_owner_invalid');
  }
  return asset;
}
