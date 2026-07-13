import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_COACHING_DROP_ZONE_PATH = '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVideos';
const KNOWN_TYPO_DROP_ZONE_PATH = '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes';
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v']);
const TRANSCRIPT_EXTENSIONS = new Set(['.vtt', '.txt', '.json']);
const DEFAULT_MIN_STABLE_AGE_MS = 30_000;

export function getCoachingImportWorkerStatus(options = {}) {
  const dropZonePath = resolveCoachingDropZonePath(options);
  const dropZoneExists = existsSync(dropZonePath);
  const typoSiblingExists = dropZonePath !== KNOWN_TYPO_DROP_ZONE_PATH && existsSync(KNOWN_TYPO_DROP_ZONE_PATH);
  let scanStats = {
    completePairs: 0,
    reviewRequired: 0,
    incompleteGroups: 0,
  };

  if (dropZoneExists) {
    const scan = scanCoachingDropZone({
      ...options,
      limit: options.statusScanLimit || 50,
      includeIncomplete: true,
      minStableAgeMs: options.minStableAgeMs ?? 0,
    });
    scanStats = {
      completePairs: scan.candidates.length,
      reviewRequired: scan.candidates.filter((item) => item.reviewRequired).length,
      incompleteGroups: scan.incomplete.length,
    };
  }

  return {
    ok: true,
    status: dropZoneExists ? 'VERIFIED' : 'UNVERIFIED',
    mode: 'dedicated-coaching-import-worker',
    dropZone: {
      path: dropZonePath,
      exists: dropZoneExists,
      knownTypoSiblingPath: KNOWN_TYPO_DROP_ZONE_PATH,
      knownTypoSiblingExists: typoSiblingExists,
    },
    accepted: {
      video: [...VIDEO_EXTENSIONS],
      transcript: [...TRANSCRIPT_EXTENSIONS],
      metadata: ['.metadata.json', '__metadata.json', '_metadata.json'],
    },
    scanStats,
    protections: {
      dailyDrillsWatcherImported: false,
      dailyDrillsWatcherStarted: false,
      videoRegistryWritten: false,
      r2Touched: false,
      streamTouched: false,
      schedulerTouched: false,
      calendarTouched: false,
    },
  };
}

export function scanCoachingDropZone(options = {}) {
  const dropZonePath = resolveCoachingDropZonePath(options);
  const minStableAgeMs = clampInteger(options.minStableAgeMs ?? process.env.MMHQ_MMC_COACHING_WORKER_MIN_STABLE_AGE_MS, DEFAULT_MIN_STABLE_AGE_MS, 0, 86_400_000);
  const limit = clampInteger(options.limit, 50, 1, 500);
  const includeIncomplete = Boolean(options.includeIncomplete);

  if (!existsSync(dropZonePath)) {
    return {
      ok: true,
      status: 'UNVERIFIED',
      source: 'MissionWebexVideos drop zone',
      dropZonePath,
      candidates: [],
      incomplete: [],
      warnings: [`Drop zone does not exist: ${dropZonePath}`],
      protections: buildWorkerProtections(),
    };
  }

  const files = listDropZoneFiles(dropZonePath);
  const groups = groupAssetFiles(dropZonePath, files);
  const candidates = [];
  const incomplete = [];

  for (const group of groups) {
    const candidate = buildCandidateFromGroup(dropZonePath, group, minStableAgeMs);
    if (candidate.complete && candidates.length < limit) {
      candidates.push(candidate);
    } else if (!candidate.complete && includeIncomplete) {
      incomplete.push(candidate);
    }
  }

  return {
    ok: true,
    status: 'VERIFIED',
    source: 'MissionWebexVideos drop zone',
    dropZonePath,
    minStableAgeMs,
    totalGroups: groups.length,
    candidates,
    incomplete,
    warnings: [],
    protections: buildWorkerProtections(),
  };
}

function resolveCoachingDropZonePath(options = {}) {
  return path.resolve(String(
    options.dropZonePath ||
    process.env.MMHQ_MMC_COACHING_DROP_ZONE_PATH ||
    DEFAULT_COACHING_DROP_ZONE_PATH,
  ).trim());
}

function listDropZoneFiles(root) {
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext) || TRANSCRIPT_EXTENSIONS.has(ext)) {
        result.push(fullPath);
      }
    }
  }
  return result.sort((left, right) => left.localeCompare(right));
}

function groupAssetFiles(root, files) {
  const groups = new Map();
  for (const filePath of files) {
    const parsed = path.parse(filePath);
    const ext = parsed.ext.toLowerCase();
    const metadata = isMetadataJson(parsed.base);
    const base = metadata ? stripMetadataSuffix(parsed.name) : parsed.name;
    const key = path.join(path.relative(root, parsed.dir), base).replaceAll(path.sep, '/');
    const group = groups.get(key) || {
      key,
      stem: base,
      directory: parsed.dir,
      video: null,
      transcript: null,
      metadata: null,
      extras: [],
    };

    if (metadata) {
      group.metadata = chooseNewest(group.metadata, filePath);
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      group.video = chooseNewest(group.video, filePath);
    } else if (TRANSCRIPT_EXTENSIONS.has(ext)) {
      group.transcript = chooseNewest(group.transcript, filePath);
    } else {
      group.extras.push(filePath);
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function buildCandidateFromGroup(root, group, minStableAgeMs) {
  const videoInfo = group.video ? fileInfo(root, group.video, minStableAgeMs) : null;
  const transcriptInfo = group.transcript ? fileInfo(root, group.transcript, minStableAgeMs) : null;
  const metadataInfo = group.metadata ? fileInfo(root, group.metadata, minStableAgeMs) : null;
  const metadata = metadataInfo ? readMetadataJson(metadataInfo.path) : {};
  const parsedName = parseCoachingAssetName(group.stem);
  const complete = Boolean(videoInfo && transcriptInfo && videoInfo.stable && transcriptInfo.stable);
  const lineageHash = complete
    ? sha256(['coaching_drop_zone', videoInfo.relativePath, videoInfo.sha256, transcriptInfo.relativePath, transcriptInfo.sha256].join('|'))
    : '';
  const sourceId = lineageHash || sha256(['coaching_drop_zone_incomplete', group.key, videoInfo?.relativePath || '', transcriptInfo?.relativePath || ''].join('|'));
  const resolution = resolveCandidateConfidence({ parsedName, metadata, complete });

  return {
    complete,
    idempotencyKey: sourceId,
    sourceSystem: 'coaching_drop_zone',
    sourceId,
    assetTitle: buildAssetTitle(parsedName, metadata, group.stem),
    assetDate: normalizeDate(metadata.asset_date || metadata.meeting_date || parsedName.date),
    mediaPath: videoInfo?.path || '',
    transcriptPath: transcriptInfo?.path || '',
    metadataPath: metadataInfo?.path || '',
    video: videoInfo,
    transcript: transcriptInfo,
    metadataFile: metadataInfo,
    parsedName,
    metadata,
    meetingMatchStatus: resolution.meetingMatchStatus,
    meetingMatchConfidence: resolution.meetingMatchConfidence,
    subjectMatchStatus: resolution.subjectMatchStatus,
    subjectMatchConfidence: resolution.subjectMatchConfidence,
    reviewRequired: resolution.reviewRequired,
    reviewReasons: resolution.reviewReasons,
    studentId: sanitizeLocalId(metadata.mmc_student_id || metadata.student_id || ''),
    sessionLocalId: sanitizeLocalId(metadata.mmc_session_id || metadata.session_id || ''),
    autoAnalyze: Boolean(metadata.auto_analyze),
    protections: buildWorkerProtections(),
  };
}

function resolveCandidateConfidence({ parsedName, metadata, complete }) {
  const reviewReasons = [];
  let meetingMatchStatus = 'manual_review';
  let meetingMatchConfidence = 0;
  let subjectMatchStatus = 'manual_review';
  let subjectMatchConfidence = 0;

  if (!complete) {
    reviewReasons.push('missing_or_unstable_media_transcript_pair');
  }

  if (complete && metadata.meeting_match_status === 'verified') {
    meetingMatchStatus = 'verified';
    meetingMatchConfidence = 1;
  } else if (complete && parsedName.date && parsedName.kind) {
    meetingMatchStatus = 'probable';
    meetingMatchConfidence = parsedName.sessionCode ? 0.86 : 0.78;
  } else if (complete && parsedName.date) {
    meetingMatchStatus = 'probable';
    meetingMatchConfidence = 0.66;
    reviewReasons.push('meeting_kind_or_session_code_missing');
  } else {
    meetingMatchStatus = complete ? 'manual_review' : 'unverified';
    meetingMatchConfidence = complete ? 0.35 : 0;
    reviewReasons.push('meeting_date_not_deterministic');
  }

  if (metadata.subject_match_status === 'verified' || metadata.subject_ref_id || metadata.assignment_id) {
    subjectMatchStatus = 'verified';
    subjectMatchConfidence = 1;
  } else if (metadata.mmc_student_id || metadata.student_id) {
    subjectMatchStatus = 'probable';
    subjectMatchConfidence = 0.8;
  } else if (parsedName.studentName) {
    subjectMatchStatus = 'manual_review';
    subjectMatchConfidence = 0.45;
    reviewReasons.push('student_name_in_filename_requires_manual_review');
  } else {
    subjectMatchStatus = 'unverified';
    subjectMatchConfidence = 0;
    reviewReasons.push('student_identity_missing');
  }

  return {
    meetingMatchStatus,
    meetingMatchConfidence,
    subjectMatchStatus,
    subjectMatchConfidence,
    reviewRequired: meetingMatchStatus === 'manual_review' || subjectMatchStatus === 'manual_review' || subjectMatchStatus === 'unverified' || reviewReasons.length > 0,
    reviewReasons: [...new Set(reviewReasons)],
  };
}

function fileInfo(root, filePath, minStableAgeMs) {
  const stats = statSync(filePath);
  const ageMs = Date.now() - stats.mtimeMs;
  return {
    path: filePath,
    relativePath: path.relative(root, filePath).replaceAll(path.sep, '/'),
    sizeBytes: stats.size,
    mtime: stats.mtime.toISOString(),
    stable: stats.size > 0 && ageMs >= minStableAgeMs,
    ageMs,
    sha256: stats.size > 0 ? hashFile(filePath) : '',
  };
}

function readMetadataJson(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseCoachingAssetName(stem) {
  const parts = String(stem || '').split('__').map((part) => part.trim()).filter(Boolean);
  const date = /^\d{4}-\d{2}-\d{2}$/u.test(parts[0] || '') ? parts[0] : '';
  const offset = date ? 1 : 0;
  const studentName = parts[offset] ? parts[offset].replaceAll('_', ' ') : '';
  const kind = parts[offset + 1] || '';
  const sessionCode = parts[offset + 2] || '';
  return {
    raw: stem,
    date,
    studentName,
    kind,
    sessionCode,
    preferredPattern: Boolean(date && studentName && kind),
  };
}

function buildAssetTitle(parsedName, metadata, fallback) {
  const explicit = String(metadata.asset_title || metadata.title || '').trim();
  if (explicit) return explicit.slice(0, 240);
  const parts = [parsedName.date, parsedName.studentName, parsedName.kind, parsedName.sessionCode].filter(Boolean);
  return (parts.length ? parts.join(' · ') : fallback || 'Coaching import candidate').slice(0, 240);
}

function chooseNewest(current, candidate) {
  if (!current) return candidate;
  return statSync(candidate).mtimeMs > statSync(current).mtimeMs ? candidate : current;
}

function isMetadataJson(filename) {
  const lower = String(filename || '').toLowerCase();
  return lower.endsWith('.metadata.json') || lower.endsWith('__metadata.json') || lower.endsWith('_metadata.json');
}

function stripMetadataSuffix(stem) {
  return String(stem || '').replace(/(?:\.metadata|__metadata|_metadata)$/iu, '');
}

function normalizeDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function sanitizeLocalId(value = '') {
  return String(value || '').trim().replace(/[^\w:.-]/gu, '-').slice(0, 120);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function buildWorkerProtections() {
  return {
    dailyDrillsWatcherImported: false,
    dailyDrillsWatcherStarted: false,
    videoRegistryWritten: false,
    r2Touched: false,
    streamTouched: false,
    productionSupabaseTouched: false,
  };
}
