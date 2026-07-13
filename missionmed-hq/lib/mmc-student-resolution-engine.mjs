export const STUDENT_RESOLUTION_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  PROBABLE: 'PROBABLE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  CONFLICT: 'CONFLICT',
  UNVERIFIED: 'UNVERIFIED',
});

const DEMO_FIXTURE_STUDENT_IDS = new Set([
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
]);

const RESOLUTION_THRESHOLDS = Object.freeze({
  meetingVerified: 0.84,
  meetingProbable: 0.68,
  studentVerified: 0.86,
  studentProbable: 0.72,
  overallVerified: 0.86,
  overallProbable: 0.72,
});

export function resolveStudentForSourceAsset(sourceAsset = {}, context = {}) {
  const evidence = extractCoachingAssetEvidence(sourceAsset);
  const meeting = resolveMeetingConfidence(sourceAsset, evidence);
  const student = resolveStudentConfidence(sourceAsset, context, evidence);
  const conflict = student.status === STUDENT_RESOLUTION_STATUS.CONFLICT;
  const confidence = conflict
    ? Math.min(meeting.confidence, student.confidence)
    : roundConfidence((meeting.confidence * 0.42) + (student.confidence * 0.58));
  const autoAttach = (
    !conflict &&
    meeting.status === STUDENT_RESOLUTION_STATUS.VERIFIED &&
    student.status === STUDENT_RESOLUTION_STATUS.VERIFIED &&
    confidence >= RESOLUTION_THRESHOLDS.overallVerified &&
    Boolean(student.suggested?.studentId) &&
    !student.suggested?.fixtureBlocked
  );
  const status = conflict
    ? STUDENT_RESOLUTION_STATUS.CONFLICT
    : autoAttach
      ? STUDENT_RESOLUTION_STATUS.VERIFIED
      : confidence >= RESOLUTION_THRESHOLDS.overallProbable && student.suggested?.studentId
        ? STUDENT_RESOLUTION_STATUS.PROBABLE
        : student.suggested?.studentId || evidence.nameCandidates.length
          ? STUDENT_RESOLUTION_STATUS.MANUAL_REVIEW
          : STUDENT_RESOLUTION_STATUS.UNVERIFIED;
  const reviewReasons = [
    ...meeting.reasons,
    ...student.reasons,
    ...(autoAttach ? [] : ['auto_attach_threshold_not_met']),
  ];

  return {
    version: 'MMC-504',
    status,
    confidence,
    autoAttach,
    sourceAsset: {
      id: sourceAsset.id || null,
      sourceSystem: sourceAsset.source_system || null,
      sourceId: sourceAsset.source_id || null,
      title: sourceAsset.asset_title || '',
    },
    meeting,
    student,
    overall: {
      status,
      confidence,
      autoAttach,
      reviewRequired: !autoAttach,
      reasons: uniqueStrings(reviewReasons),
    },
    review: {
      required: !autoAttach,
      queue: autoAttach ? 'auto_attach_ready' : 'student_resolution_review_queue',
      reasons: uniqueStrings(reviewReasons),
    },
    protections: {
      noProductionHydration: true,
      noCanonicalStudentDeclared: true,
      noNameOnlyAutoAttach: true,
      noFixtureAutoAttach: true,
      noDailyDrillsMutation: true,
    },
    evidence,
    generatedAt: new Date().toISOString(),
  };
}

export function dbStatusFromResolutionStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === STUDENT_RESOLUTION_STATUS.VERIFIED) return 'verified';
  if (normalized === STUDENT_RESOLUTION_STATUS.PROBABLE) return 'probable';
  if (normalized === STUDENT_RESOLUTION_STATUS.CONFLICT) return 'conflict';
  if (normalized === STUDENT_RESOLUTION_STATUS.UNVERIFIED) return 'unverified';
  return 'manual_review';
}

export function studentIdFromName(value = '') {
  return normalizeSlug(value);
}

export function extractCoachingAssetEvidence(sourceAsset = {}) {
  const metadata = sourceAsset.metadata && typeof sourceAsset.metadata === 'object' ? sourceAsset.metadata : {};
  const worker = metadata.worker && typeof metadata.worker === 'object' ? metadata.worker : {};
  const original = metadata.original_metadata && typeof metadata.original_metadata === 'object' ? metadata.original_metadata : {};
  const title = String(sourceAsset.asset_title || worker.parsed_name?.raw || sourceAsset.source_id || '').trim();
  const textPool = [
    title,
    sourceAsset.media_url,
    sourceAsset.transcript_pointer,
    ...sourceRefsAsStrings(sourceAsset.source_refs),
  ].filter(Boolean).join('\n');
  const dates = uniqueStrings([
    normalizeDate(sourceAsset.asset_date),
    normalizeDate(worker.parsed_name?.date),
    normalizeDate(original.meeting_date || original.asset_date),
    ...extractDatesFromText(textPool),
  ]);
  const explicitStudentIds = uniqueStrings([
    worker.student_id,
    original.mmc_student_id,
    original.student_id,
    metadata.student_id,
    metadata.mmc_student_id,
  ].map((value) => normalizeSlug(value)).filter(Boolean));
  const explicitSubjectRefs = uniqueStrings([
    original.subject_ref_id,
    original.assignment_id,
    metadata.subject_ref_id,
    metadata.assignment_id,
  ].filter(Boolean).map(String));
  const nameCandidates = uniqueByNormalizedName([
    {
      value: worker.parsed_name?.studentName,
      source: worker.parsed_name?.preferredPattern ? 'preferred_filename_pattern' : 'filename_name_segment',
      confidence: worker.parsed_name?.preferredPattern ? 0.76 : 0.54,
    },
    {
      value: original.student_name || original.studentName,
      source: 'metadata_student_name',
      confidence: 0.86,
    },
    {
      value: metadata.student_name || metadata.studentName,
      source: 'source_metadata_student_name',
      confidence: 0.82,
    },
    ...extractParticipantNames(title).map((name) => ({
      value: name,
      source: 'asset_title_participant_name',
      confidence: 0.62,
    })),
  ].filter((item) => item.value));

  return {
    title,
    titleKind: detectMeetingKind(title),
    dates,
    nameCandidates,
    explicitStudentIds,
    explicitSubjectRefs,
    hasRecordingPointer: Boolean(sourceAsset.media_url),
    hasTranscriptPointer: Boolean(sourceAsset.transcript_pointer),
    idempotencyKey: metadata.worker?.idempotency_key || sourceAsset.source_id || '',
    sourceSystem: sourceAsset.source_system || '',
    raw: {
      worker,
      original,
    },
  };
}

function resolveMeetingConfidence(sourceAsset, evidence) {
  const reasons = [];
  const pieces = [];
  let confidence = 0;

  const existingStatus = dbStatusFromResolutionStatus(sourceAsset.meeting_match_status).toUpperCase();
  if (existingStatus === 'VERIFIED') {
    confidence += 0.5;
    pieces.push({ kind: 'existing_meeting_status', status: 'verified', confidence: 0.5 });
  } else if (existingStatus === 'PROBABLE') {
    confidence += 0.34;
    pieces.push({ kind: 'existing_meeting_status', status: 'probable', confidence: 0.34 });
  }

  if (evidence.dates.length) {
    confidence += 0.3;
    pieces.push({ kind: 'date_evidence', value: evidence.dates[0], confidence: 0.3 });
  } else {
    reasons.push('meeting_date_missing');
  }

  if (evidence.titleKind) {
    confidence += 0.18;
    pieces.push({ kind: 'meeting_kind_evidence', value: evidence.titleKind, confidence: 0.18 });
  } else {
    reasons.push('meeting_kind_missing');
  }

  if (evidence.hasRecordingPointer) {
    confidence += 0.08;
    pieces.push({ kind: 'recording_pointer_present', confidence: 0.08 });
  }

  if (evidence.hasTranscriptPointer) {
    confidence += 0.08;
    pieces.push({ kind: 'transcript_pointer_present', confidence: 0.08 });
  }

  if (evidence.idempotencyKey) {
    confidence += 0.06;
    pieces.push({ kind: 'idempotency_key_present', confidence: 0.06 });
  }

  confidence = roundConfidence(confidence);
  const status = confidence >= RESOLUTION_THRESHOLDS.meetingVerified
    ? STUDENT_RESOLUTION_STATUS.VERIFIED
    : confidence >= RESOLUTION_THRESHOLDS.meetingProbable
      ? STUDENT_RESOLUTION_STATUS.PROBABLE
      : confidence > 0
        ? STUDENT_RESOLUTION_STATUS.MANUAL_REVIEW
        : STUDENT_RESOLUTION_STATUS.UNVERIFIED;
  if (status !== STUDENT_RESOLUTION_STATUS.VERIFIED) {
    reasons.push('meeting_identity_not_verified');
  }

  return {
    status,
    confidence,
    dates: evidence.dates,
    kind: evidence.titleKind || '',
    reasons: uniqueStrings(reasons),
    evidence: pieces,
  };
}

function resolveStudentConfidence(sourceAsset, context, evidence) {
  const identityReferences = Array.isArray(context.identityReferences) ? context.identityReferences : [];
  const mentorAssignments = Array.isArray(context.mentorAssignments) ? context.mentorAssignments : [];
  const activeAssignments = mentorAssignments.filter((assignment) => String(assignment.status || '').toLowerCase() === 'active');
  const candidates = identityReferences
    .map((reference) => scoreIdentityReference(reference, activeAssignments, sourceAsset, evidence))
    .filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);
  const reasons = [];

  if (!evidence.nameCandidates.length && !evidence.explicitStudentIds.length && !evidence.explicitSubjectRefs.length) {
    reasons.push('student_identity_evidence_missing');
  }

  if (!candidates.length) {
    if (evidence.nameCandidates.length) reasons.push('candidate_name_requires_manual_review');
    return {
      status: evidence.nameCandidates.length ? STUDENT_RESOLUTION_STATUS.MANUAL_REVIEW : STUDENT_RESOLUTION_STATUS.UNVERIFIED,
      confidence: evidence.nameCandidates.length ? 0.35 : 0,
      suggested: null,
      candidates: [],
      reasons: uniqueStrings(reasons),
      evidence: evidence.nameCandidates.map((item) => ({
        kind: item.source,
        value: item.value,
        confidence: item.confidence,
      })),
    };
  }

  const top = candidates[0];
  const second = candidates[1] || null;
  const conflict = second && top.confidence - second.confidence < 0.08;
  if (conflict) {
    reasons.push('multiple_student_candidates_with_close_confidence');
  }
  if (top.fixtureBlocked) {
    reasons.push('demo_fixture_auto_attach_blocked');
  }
  if (!top.strongEvidence) {
    reasons.push('strong_identity_evidence_missing');
  }
  if (!top.activeAssignment) {
    reasons.push('active_mentor_assignment_missing');
  }

  const status = conflict
    ? STUDENT_RESOLUTION_STATUS.CONFLICT
    : top.strongEvidence && top.activeAssignment && !top.fixtureBlocked && top.confidence >= RESOLUTION_THRESHOLDS.studentVerified
      ? STUDENT_RESOLUTION_STATUS.VERIFIED
      : top.confidence >= RESOLUTION_THRESHOLDS.studentProbable
        ? STUDENT_RESOLUTION_STATUS.PROBABLE
        : STUDENT_RESOLUTION_STATUS.MANUAL_REVIEW;

  return {
    status,
    confidence: top.confidence,
    suggested: top,
    candidates: candidates.slice(0, 5),
    reasons: uniqueStrings([...reasons, ...top.reasons]),
    evidence: top.evidence,
  };
}

function scoreIdentityReference(reference, activeAssignments, sourceAsset, evidence) {
  const referenceId = String(reference.id || '').trim();
  const anchorHash = normalizeSlug(reference.primary_anchor_hash || '');
  const metadata = reference.metadata && typeof reference.metadata === 'object' ? reference.metadata : {};
  const anchorSet = reference.anchor_set_json && typeof reference.anchor_set_json === 'object' ? reference.anchor_set_json : {};
  const names = uniqueByNormalizedName([
    metadata.student_name,
    metadata.studentName,
    metadata.display_name,
    metadata.name,
    anchorSet.student_name,
    anchorSet.display_name,
    titleFromSlug(anchorHash),
  ].filter(Boolean).map((value) => ({ value, source: 'identity_reference', confidence: 0.5 })));
  const studentId = normalizeSlug(metadata.student_id || metadata.local_student_id || anchorHash || referenceId);
  const explicitRefMatch = evidence.explicitSubjectRefs.some((value) => value === referenceId)
    || evidence.explicitSubjectRefs.some((value) => activeAssignments.some((assignment) => assignment.id === value && assignment.subject_ref_id === referenceId));
  const explicitStudentMatch = evidence.explicitStudentIds.includes(studentId) || evidence.explicitStudentIds.includes(anchorHash);
  const nameMatches = [];
  for (const sourceName of evidence.nameCandidates) {
    for (const refName of names) {
      if (normalizeName(sourceName.value) && normalizeName(sourceName.value) === normalizeName(refName.value)) {
        nameMatches.push({
          sourceName,
          refName,
          exact: true,
        });
      }
    }
    if (anchorHash && normalizeSlug(sourceName.value) === anchorHash) {
      nameMatches.push({
        sourceName,
        refName: { value: titleFromSlug(anchorHash), source: 'primary_anchor_hash', confidence: 0.45 },
        exact: true,
      });
    }
  }

  let confidence = 0;
  const scoreEvidence = [];
  const reasons = [];
  if (explicitRefMatch) {
    confidence += 0.82;
    scoreEvidence.push({ kind: 'explicit_subject_or_assignment_reference', confidence: 0.82 });
  }
  if (explicitStudentMatch) {
    confidence += 0.62;
    scoreEvidence.push({ kind: 'explicit_local_student_id_match', value: studentId, confidence: 0.62 });
  }
  if (nameMatches.length) {
    const bestName = nameMatches
      .map((item) => item.sourceName.confidence)
      .reduce((max, value) => Math.max(max, value), 0);
    const nameScore = bestName >= 0.8 ? 0.58 : 0.44;
    confidence += nameScore;
    scoreEvidence.push({
      kind: 'name_match_requires_provenance',
      value: nameMatches[0].sourceName.value,
      reference: nameMatches[0].refName.value,
      confidence: nameScore,
    });
  }

  const activeAssignment = activeAssignments.find((assignment) => assignment.subject_ref_id === referenceId) || null;
  if (activeAssignment) {
    confidence += 0.18;
    scoreEvidence.push({ kind: 'active_mmc_mentor_assignment', assignmentId: activeAssignment.id, confidence: 0.18 });
  }

  const referenceVerified = reference.reference_status === 'verified' || reference.review_status === 'verified';
  if (referenceVerified) {
    confidence += 0.18;
    scoreEvidence.push({ kind: 'verified_identity_reference', confidence: 0.18 });
  } else {
    reasons.push('identity_reference_not_verified');
  }

  const assignmentVerified = activeAssignment?.review_status === 'verified';
  if (assignmentVerified) {
    confidence += 0.08;
    scoreEvidence.push({ kind: 'verified_assignment_review', confidence: 0.08 });
  }

  const priorSourceLink = hasPriorSourceLink(sourceAsset, contextSourceAssets(sourceAsset), referenceId, studentId);
  if (priorSourceLink) {
    confidence += 0.14;
    scoreEvidence.push({ kind: 'prior_source_asset_link', confidence: 0.14 });
  }

  confidence = roundConfidence(Math.min(1, confidence));
  const strongEvidence = explicitRefMatch
    || (explicitStudentMatch && referenceVerified)
    || (nameMatches.length > 0 && referenceVerified && assignmentVerified);
  const fixtureBlocked = DEMO_FIXTURE_STUDENT_IDS.has(studentId);

  return {
    studentId,
    studentName: names[0]?.value || titleFromSlug(studentId) || studentId,
    subjectRefId: referenceId,
    assignmentId: activeAssignment?.id || null,
    confidence,
    strongEvidence,
    activeAssignment: Boolean(activeAssignment),
    referenceVerified,
    assignmentVerified,
    fixtureBlocked,
    reasons,
    evidence: scoreEvidence,
  };
}

function contextSourceAssets(sourceAsset) {
  const metadata = sourceAsset.metadata && typeof sourceAsset.metadata === 'object' ? sourceAsset.metadata : {};
  return Array.isArray(metadata.related_source_assets) ? metadata.related_source_assets : [];
}

function hasPriorSourceLink(sourceAsset, sourceAssets, subjectRefId, studentId) {
  const rows = Array.isArray(sourceAssets) ? sourceAssets : [];
  const currentId = sourceAsset.id || '';
  return rows.some((row) => {
    if (row.id && row.id === currentId) return false;
    const resolution = row.metadata?.student_resolution?.student?.suggested || {};
    return resolution.subjectRefId === subjectRefId || resolution.studentId === studentId;
  });
}

function extractParticipantNames(title = '') {
  const raw = String(title || '').trim();
  if (!raw) return [];
  const primary = raw.split(/\s+-\s+/u)[0] || raw;
  const patterns = [
    /^(.*?)\s*&\s*Dr\.?\s+Brian\b/iu,
    /^(.*?)\s+and\s+Dr\.?\s+Brian\b/iu,
    /^(.*?)\s+with\s+Dr\.?\s+Brian\b/iu,
    /^Dr\.?\s+Brian\s*&\s*(.*)$/iu,
    /^Dr\.?\s+Brian\s+and\s+(.*)$/iu,
  ];
  const names = [];
  for (const pattern of patterns) {
    const match = primary.match(pattern);
    if (match && match[1]) names.push(cleanCandidateName(match[1]));
  }
  const commaMatch = primary.match(/^([^,]+),\s*Dr\.?\s+Brian\b/iu);
  if (commaMatch?.[1]) names.push(cleanCandidateName(commaMatch[1]));
  return uniqueStrings(names.filter(Boolean));
}

function detectMeetingKind(value = '') {
  const normalized = String(value || '').toLowerCase();
  if (/1[-\s]?on[-\s]?1|one[-\s]?on[-\s]?one/u.test(normalized)) return '1-on-1 advising';
  if (/mentorship|mentor|advising|advisory|coaching/u.test(normalized)) return 'coaching';
  if (/mission residency/u.test(normalized)) return 'mission residency';
  return '';
}

function extractDatesFromText(value = '') {
  const text = String(value || '');
  const dates = [];
  for (const match of text.matchAll(/\b(20\d{2})[-_]?(\d{2})[-_]?(\d{2})\b/gu)) {
    dates.push(`${match[1]}-${match[2]}-${match[3]}`);
  }
  return dates.map(normalizeDate).filter(Boolean);
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.match(/^(20\d{2})(\d{2})(\d{2})$/u);
  const candidate = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : raw;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sourceRefsAsStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    return Object.values(item).filter((entry) => typeof entry === 'string');
  });
}

function uniqueByNormalizedName(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = cleanCandidateName(item.value);
    const key = normalizeName(value);
    if (!value || !key || seen.has(key)) continue;
    seen.add(key);
    result.push({ ...item, value });
  }
  return result;
}

function cleanCandidateName(value = '') {
  return String(value || '')
    .replace(/\.(mp4|mov|m4v|vtt|txt|json)$/iu, '')
    .replace(/\bMission\s+Residency\b/igu, '')
    .replace(/\b1[-\s]?on[-\s]?1\b/igu, '')
    .replace(/\bAdvising\b/igu, '')
    .replace(/\bMentorship\b/igu, '')
    .replace(/\bCoaching\b/igu, '')
    .replace(/\bDr\.?\s+Brian\b/igu, '')
    .replace(/\b20\d{6}\b/gu, '')
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/gu, '')
    .replace(/[_-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeName(value = '') {
  return cleanCandidateName(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function normalizeSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120);
}

function titleFromSlug(value = '') {
  return String(value || '')
    .split(/[-_.:]+/u)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function roundConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, Math.round(number * 10000) / 10000));
}

export function formatResolutionForReview(result) {
  const suggested = result?.student?.suggested || null;
  return {
    status: result?.status || STUDENT_RESOLUTION_STATUS.UNVERIFIED,
    confidence: result?.confidence || 0,
    autoAttach: Boolean(result?.autoAttach),
    suggestedStudentId: suggested?.studentId || '',
    suggestedStudentName: suggested?.studentName || '',
    suggestedSubjectRefId: suggested?.subjectRefId || '',
    suggestedAssignmentId: suggested?.assignmentId || '',
    meetingStatus: result?.meeting?.status || STUDENT_RESOLUTION_STATUS.UNVERIFIED,
    studentStatus: result?.student?.status || STUDENT_RESOLUTION_STATUS.UNVERIFIED,
    reasons: result?.review?.reasons || [],
    evidence: result?.student?.evidence || [],
    sourceAssetTitle: result?.sourceAsset?.title || '',
    runtime: 'MMC-504',
  };
}
