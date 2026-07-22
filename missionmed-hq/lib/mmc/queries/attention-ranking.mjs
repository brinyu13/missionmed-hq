const CATEGORY_ORDER = Object.freeze({
  PRIVACY_SAFETY_DECISION: 0,
  AUTHORITATIVE_DEADLINE: 1,
  OVERDUE_MENTOR_PROMISE: 2,
  SCHEDULED_CALL_PREP: 3,
  STUDENT_COMMITMENT_FOLLOW_THROUGH: 4,
  REVIEW_WAIT: 5,
  DATA_SUFFICIENCY: 6,
});

export function rankMentorAttention(items, options = {}) {
  const now = dateValue(options.now || new Date());
  const open = [...items]
    .filter((item) => isAttentionVisible(item, now))
    .sort(compareAttention);

  const byObject = new Map();
  for (const item of open) {
    const key = `${item.subjectLinkId}\u001f${item.sourceObjectId || item.id}`;
    if (!byObject.has(key)) byObject.set(key, item);
  }

  const collapsed = [...byObject.values()].sort(compareAttention);
  const firstTier = [];
  const remaining = [];
  const initialSubjects = new Set();

  for (const item of collapsed) {
    const safety = item.category === 'PRIVACY_SAFETY_DECISION';
    if (firstTier.length < 3 && (safety || !initialSubjects.has(item.subjectLinkId))) {
      firstTier.push(item);
      if (!safety) initialSubjects.add(item.subjectLinkId);
    } else {
      remaining.push(item);
    }
  }

  return Object.freeze([...firstTier, ...remaining].slice(0, 7).map((item) => Object.freeze({ ...item })));
}

export function isAttentionVisible(item, nowInput = new Date()) {
  const now = dateValue(nowInput);
  if (!['DEFERRED', 'DISMISSED'].includes(item.disposition)) return true;
  if (Number(item.sourceVersion) > Number(item.dispositionSourceVersion || 0)) return true;
  const expiresAt = Date.parse(item.dispositionExpiresAt || '');
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function compareAttention(left, right) {
  const category = (CATEGORY_ORDER[left.category] ?? 99) - (CATEGORY_ORDER[right.category] ?? 99);
  if (category) return category;
  const due = nullableTime(left.dueAt) - nullableTime(right.dueAt);
  if (due) return due;
  const firstObserved = nullableTime(left.firstObservedAt) - nullableTime(right.firstObservedAt);
  if (firstObserved) return firstObserved;
  return String(left.id).localeCompare(String(right.id), 'en');
}

function nullableTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function dateValue(value) {
  const parsed = value instanceof Date ? value.valueOf()
    : (typeof value === 'number' ? value : Date.parse(value));
  if (!Number.isFinite(parsed)) throw new TypeError('Attention ranking requires a valid clock value.');
  return parsed;
}

export const MENTOR_ATTENTION_CATEGORY_ORDER = CATEGORY_ORDER;
