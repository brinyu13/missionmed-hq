export const ROSTER_VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROBABLE: 'PROBABLE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CONFLICT: 'CONFLICT',
  UNVERIFIED: 'UNVERIFIED',
});

export const ROSTER_SOURCE_INVENTORY = Object.freeze([
  {
    id: 'mmc_identity_bridge',
    label: 'Existing MMC Identity References + Mentor Assignments',
    priority: 1,
    sourceSystem: 'mmc.identity_references',
    readPath: 'same-origin /api/mmc/persistence and RLS-scoped mmc.identity_references + mmc.mentor_assignments',
    status: 'VERIFIED',
    writeBoundary: 'MMC-owned identity_references and mentor_assignments only after verification',
    autoPromotion: 'strong_anchor',
    notes: 'This is the strongest local authority already approved by MMC-505.',
  },
  {
    id: 'wordpress_user',
    label: 'WordPress User',
    priority: 2,
    sourceSystem: 'wordpress',
    readPath: 'approved WordPress-authenticated read-only user/profile evidence envelope',
    status: 'UNVERIFIED',
    writeBoundary: 'No WordPress writes; evidence snapshot only',
    autoPromotion: 'strong_anchor_when_approved_read_only',
    notes: 'Requires least-privilege read path. Email/name alone cannot verify a student.',
  },
  {
    id: 'learndash_enrollment',
    label: 'LearnDash Enrollment',
    priority: 2,
    sourceSystem: 'learndash',
    readPath: 'approved WordPress/LearnDash read-only enrollment evidence envelope',
    status: 'UNVERIFIED',
    writeBoundary: 'No LearnDash writes; evidence snapshot only',
    autoPromotion: 'strong_anchor_when_approved_read_only',
    notes: 'Independent from the WordPress user profile only when enrollment/course source evidence is present.',
  },
  {
    id: 'matrix_profile',
    label: 'Matrix Profile / Student Profile',
    priority: 3,
    sourceSystem: 'matrix_profile',
    readPath: 'approved Matrix profile read-only route; auth-gated in prior probes',
    status: 'UNVERIFIED',
    writeBoundary: 'No Profile writes; evidence snapshot only',
    autoPromotion: 'strong_anchor_when_approved_read_only',
    notes: 'Payload shape remains unverified until approved credentialed read access is available.',
  },
  {
    id: 'scheduler_student',
    label: 'Scheduler Student / Appointment',
    priority: 4,
    sourceSystem: 'scheduler',
    readPath: 'approved no-write Scheduler appointment/student read path only',
    status: 'UNVERIFIED',
    writeBoundary: 'No booking/cancel/reschedule/sync/cache mutation',
    autoPromotion: 'strong_anchor_when_no_write_read_is_verified',
    notes: 'Calendar/Scheduler evidence must not use hidden-write endpoints.',
  },
  {
    id: 'crm_person',
    label: 'CRM Person / Student Profile',
    priority: 5,
    sourceSystem: 'crm',
    readPath: 'approved least-privilege CRM/person read-only evidence envelope',
    status: 'UNVERIFIED',
    writeBoundary: 'No CRM writes; evidence snapshot only',
    autoPromotion: 'strong_anchor_when_approved_read_only',
    notes: 'Useful as a second independent anchor when row identity is readable.',
  },
  {
    id: 'calendar_title_date',
    label: 'Calendar Title + Date',
    priority: 6,
    sourceSystem: 'calendar',
    readPath: 'supporting title/date evidence only from no-sync Calendar reads',
    status: 'LIKELY',
    writeBoundary: 'No Calendar sync/cache/write route',
    autoPromotion: 'supporting_only',
    notes: 'Never sufficient by itself for student identity.',
  },
  {
    id: 'webex_title_date',
    label: 'Webex Title + Date',
    priority: 6,
    sourceSystem: 'webex',
    readPath: 'supporting title/date evidence only; no Webex API work in MMC-506',
    status: 'UNVERIFIED',
    writeBoundary: 'No Webex mutation, no recording/transcript hydration',
    autoPromotion: 'supporting_only',
    notes: 'Never sufficient by itself for student identity.',
  },
]);

const WEAK_ANCHOR_TYPES = new Set([
  'display_name',
  'name',
  'student_name',
  'email',
  'email_hash',
  'title',
  'title_date',
  'meeting_title',
  'calendar_title_date',
  'webex_title_date',
]);

const SUPPORTING_SOURCE_SYSTEMS = new Set([
  'calendar',
  'webex',
  'calendar_title_date',
  'webex_title_date',
  'meeting_title',
  'drop_zone_filename',
  'filename',
]);

const FIXTURE_STUDENT_IDS = new Set([
  'amara',
  'amara-okafor',
  'raj',
  'raj-patel',
  'mei',
  'mei-ling',
  'mei-ling-chen',
  'diego',
  'diego-ramirez',
  'yuki',
  'yuki-tanaka',
  'fatima',
  'fatima-al-hassan',
]);

const AUTO_VERIFY_THRESHOLD = 0.86;
const PROBABLE_THRESHOLD = 0.72;

export function listRosterVerificationSources() {
  return ROSTER_SOURCE_INVENTORY.map((source) => ({ ...source }));
}

export function rosterStudentIdFromName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120);
}

export function normalizeRosterEvidence(evidence = []) {
  return (Array.isArray(evidence) ? evidence : [])
    .map((item) => normalizeEvidenceItem(item))
    .filter(Boolean);
}

export function verifyRosterCandidate(candidate = {}, options = {}) {
  const studentId = rosterStudentIdFromName(candidate.studentId || candidate.student_id || candidate.localStudentId || '');
  const studentName = String(candidate.studentName || candidate.student_name || titleFromLocalId(studentId)).trim();
  const evidence = normalizeRosterEvidence([
    ...(Array.isArray(candidate.evidence) ? candidate.evidence : []),
    ...(Array.isArray(candidate.sourceEvidence) ? candidate.sourceEvidence : []),
    ...(Array.isArray(candidate.source_evidence) ? candidate.source_evidence : []),
  ]);
  const adminApproval = Boolean(options.adminApproval || candidate.adminApproval || candidate.admin_approval);
  const reasons = [];
  const conflicts = detectConflicts(studentId, evidence);
  const strongAnchors = evidence.filter((item) => item.strong === true && item.studentId === studentId);
  const independentStrongSystems = uniqueStrings(strongAnchors.map((item) => item.independenceKey));
  const supportingEvidence = evidence.filter((item) => item.strong !== true && item.studentId === studentId);
  const fixtureBlocked = FIXTURE_STUDENT_IDS.has(studentId);

  if (!studentId) reasons.push('student_id_missing');
  if (!evidence.length) reasons.push('verified_roster_evidence_missing');
  if (!strongAnchors.length) reasons.push('strong_identity_anchor_missing');
  if (independentStrongSystems.length < 2) reasons.push('two_independent_strong_anchors_missing');
  if (fixtureBlocked) reasons.push('fixture_student_blocked');
  if (conflicts.length) reasons.push('conflicting_student_identity_evidence');

  const strongConfidence = strongAnchors.length
    ? average(strongAnchors.map((item) => item.confidence))
    : 0;
  const supportingConfidence = supportingEvidence.length
    ? average(supportingEvidence.map((item) => item.confidence)) * 0.08
    : 0;
  const confidence = roundConfidence(Math.min(1, strongConfidence + supportingConfidence));

  const autoPromote = Boolean(
    studentId &&
    !fixtureBlocked &&
    !conflicts.length &&
    independentStrongSystems.length >= 2 &&
    confidence >= AUTO_VERIFY_THRESHOLD,
  );
  const adminApprovedPromotion = Boolean(
    studentId &&
    adminApproval &&
    !fixtureBlocked &&
    !conflicts.length &&
    strongAnchors.length >= 1,
  );

  const status = conflicts.length
    ? ROSTER_VERIFICATION_STATUS.CONFLICT
    : autoPromote || adminApprovedPromotion
      ? ROSTER_VERIFICATION_STATUS.VERIFIED
      : confidence >= PROBABLE_THRESHOLD && studentId
        ? ROSTER_VERIFICATION_STATUS.PROBABLE
        : evidence.length || studentId
          ? ROSTER_VERIFICATION_STATUS.MANUAL_REVIEW
          : ROSTER_VERIFICATION_STATUS.UNVERIFIED;

  return {
    version: 'MMC-506',
    status,
    studentId,
    studentName,
    confidence: autoPromote || adminApprovedPromotion
      ? Math.max(confidence, adminApprovedPromotion ? 0.9 : AUTO_VERIFY_THRESHOLD)
      : confidence,
    autoPromote,
    adminApproved: adminApprovedPromotion,
    requiresReview: !(autoPromote || adminApprovedPromotion),
    sourceInventory: listRosterVerificationSources(),
    strongAnchors,
    supportingEvidence,
    independentStrongAnchors: independentStrongSystems.length,
    conflicts,
    reasons: uniqueStrings(reasons),
    evidence,
    protections: {
      noProductionWrite: true,
      noFixturePromotion: true,
      noNameOnlyPromotion: true,
      noEmailOnlyPromotion: true,
      calendarWebexSupportingOnly: true,
      serviceRoleRuntime: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeRosterVerificationForReview(result = {}) {
  return {
    status: result.status || ROSTER_VERIFICATION_STATUS.UNVERIFIED,
    studentId: result.studentId || '',
    studentName: result.studentName || '',
    confidence: Number(result.confidence || 0),
    autoPromote: result.autoPromote === true,
    adminApproved: result.adminApproved === true,
    requiresReview: result.requiresReview !== false,
    strongAnchors: Array.isArray(result.strongAnchors) ? result.strongAnchors.length : 0,
    independentStrongAnchors: Number(result.independentStrongAnchors || 0),
    supportingEvidence: Array.isArray(result.supportingEvidence) ? result.supportingEvidence.length : 0,
    conflicts: Array.isArray(result.conflicts) ? result.conflicts.length : 0,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
  };
}

function normalizeEvidenceItem(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const sourceSystem = String(item.sourceSystem || item.source_system || item.system || '').trim().toLowerCase();
  const anchorType = String(item.anchorType || item.anchor_type || item.type || '').trim().toLowerCase();
  const anchorValue = String(item.anchorValue || item.anchor_value || item.value || '').trim();
  const studentId = rosterStudentIdFromName(item.studentId || item.student_id || item.localStudentId || '');
  if (!sourceSystem && !anchorType && !anchorValue && !studentId) return null;
  const weak = WEAK_ANCHOR_TYPES.has(anchorType) || SUPPORTING_SOURCE_SYSTEMS.has(sourceSystem);
  const confidence = clamp01(item.confidence ?? item.score ?? 0.5);
  const independenceKey = independenceKeyFor(sourceSystem, anchorType);
  return {
    sourceSystem: sourceSystem || 'unknown',
    anchorType: anchorType || 'unknown',
    anchorValue,
    studentId,
    studentName: String(item.studentName || item.student_name || titleFromLocalId(studentId)).trim(),
    confidence,
    strong: Boolean(studentId && anchorValue && !weak),
    supportingOnly: weak,
    independenceKey,
    evidenceStatus: String(item.status || item.evidenceStatus || item.evidence_status || 'UNVERIFIED').trim().toUpperCase(),
    readPath: String(item.readPath || item.read_path || '').trim(),
    provenance: item.provenance && typeof item.provenance === 'object' ? item.provenance : {},
  };
}

function independenceKeyFor(sourceSystem, anchorType) {
  if (sourceSystem === 'wordpress_user' || sourceSystem === 'wordpress') return 'wordpress_user';
  if (sourceSystem === 'learndash' || sourceSystem === 'learndash_enrollment') return 'learndash_enrollment';
  if (sourceSystem === 'matrix_profile' || sourceSystem === 'profile') return 'matrix_profile';
  if (sourceSystem === 'scheduler' || sourceSystem === 'scheduler_student') return 'scheduler_student';
  if (sourceSystem === 'crm' || sourceSystem === 'crm_person') return 'crm_person';
  if (sourceSystem === 'mmc' || sourceSystem === 'mmc_identity_reference' || sourceSystem === 'mmc.identity_references') return 'mmc_identity_bridge';
  return `${sourceSystem || 'unknown'}:${anchorType || 'unknown'}`;
}

function detectConflicts(targetStudentId, evidence) {
  const nonTarget = evidence.filter((item) => item.studentId && targetStudentId && item.studentId !== targetStudentId);
  const byAnchor = new Map();
  for (const item of evidence) {
    const key = `${item.sourceSystem}|${item.anchorType}|${item.anchorValue}`;
    if (!item.anchorValue || !item.studentId) continue;
    const previous = byAnchor.get(key);
    if (previous && previous.studentId !== item.studentId) {
      nonTarget.push(item);
      nonTarget.push(previous);
    }
    byAnchor.set(key, item);
  }
  return uniqueBy(nonTarget, (item) => `${item.sourceSystem}|${item.anchorType}|${item.anchorValue}|${item.studentId}`);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function average(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function roundConfidence(value) {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function titleFromLocalId(value = '') {
  return String(value || '')
    .replace(/[_:.-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ') || 'Reviewed Student';
}
