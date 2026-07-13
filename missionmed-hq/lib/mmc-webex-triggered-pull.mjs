import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_WEBEX_API_BASE = 'https://webexapis.com/v1';
export const DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH = '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes';
export const SUPPORTED_WEBEX_TRIGGER_CODES = Object.freeze(['[MM-ADV]', '[MM-GRP]', '[MM-MOCK]', '[MM-PS]', '[MM-IGNORE]']);
export const DEFAULT_WEBEX_ALLOWED_TRIGGERS = Object.freeze(['[MM-ADV]']);

const WEBEX_RECORDING_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v']);
const WEBEX_TRANSCRIPT_EXTENSIONS = new Set(['.vtt', '.txt', '.json']);

export function getWebexTriggerPullConfig(env = process.env) {
  const accessToken = readFirstEnv(env, [
    'MMHQ_MMC_WEBEX_ACCESS_TOKEN',
    'MMHQ_WEBEX_ACCESS_TOKEN',
    'SCHEDULER_WEBEX_ACCESS_TOKEN',
    'MMED_WEBEX_ACCESS_TOKEN',
    'WEBEX_ACCESS_TOKEN',
  ]);
  const apiBase = normalizeUrl(readFirstEnv(env, [
    'MMHQ_MMC_WEBEX_API_BASE',
    'SCHEDULER_WEBEX_API_BASE',
    'WEBEX_API_BASE',
  ]) || DEFAULT_WEBEX_API_BASE);
  const hostEmail = readFirstEnv(env, [
    'MMHQ_MMC_WEBEX_HOST_EMAIL',
    'SCHEDULER_WEBEX_HOST_EMAIL',
    'MMED_WEBEX_HOST_EMAIL',
    'WEBEX_HOST_EMAIL',
  ]);
  const allowedTriggers = normalizeTriggerList(readFirstEnv(env, ['MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS']) || DEFAULT_WEBEX_ALLOWED_TRIGGERS);
  const dropZonePath = path.resolve(String(
    readFirstEnv(env, ['MMHQ_MMC_WEBEX_DROP_ZONE_PATH']) || DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH,
  ).trim());
  const pullEnabled = parseBoolean(readFirstEnv(env, ['MMHQ_MMC_WEBEX_PULL_ENABLED']), false);

  return {
    ok: true,
    status: accessToken ? 'VERIFIED' : 'UNVERIFIED',
    mode: 'webex-triggered-recording-pull',
    apiBase,
    hostEmail: hostEmail || '',
    tokenConfigured: Boolean(accessToken),
    pullEnabled,
    dropZonePath,
    allowedTriggers,
    supportedTriggers: [...SUPPORTED_WEBEX_TRIGGER_CODES],
    defaultAllowedTriggers: [...DEFAULT_WEBEX_ALLOWED_TRIGGERS],
    protections: buildProtections(),
  };
}

export function normalizeTriggerList(value) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const normalized = rawItems
    .map(normalizeTriggerCode)
    .filter(Boolean)
    .filter((code) => SUPPORTED_WEBEX_TRIGGER_CODES.includes(code));
  const unique = [...new Set(normalized)];
  return unique.length ? unique : [...DEFAULT_WEBEX_ALLOWED_TRIGGERS];
}

export function classifyWebexRecordingTitle(title, options = {}) {
  const allowedTriggers = normalizeTriggerList(options.allowedTriggers || DEFAULT_WEBEX_ALLOWED_TRIGGERS);
  const titleText = String(title || '').trim();
  const codes = [...titleText.matchAll(/\[(MM-[A-Z0-9_-]+)\]/giu)]
    .map((match) => normalizeTriggerCode(match[1]))
    .filter(Boolean);
  const uniqueCodes = [...new Set(codes)];

  if (uniqueCodes.includes('[MM-IGNORE]')) {
    return {
      allowed: false,
      ignored: true,
      status: 'IGNORED',
      reason: 'explicit_ignore_trigger',
      triggerCodes: uniqueCodes,
      matchedAllowedTriggers: [],
      requiredDefaultTrigger: '[MM-ADV]',
    };
  }

  const matchedAllowedTriggers = uniqueCodes.filter((code) => allowedTriggers.includes(code));
  if (matchedAllowedTriggers.length) {
    return {
      allowed: true,
      ignored: false,
      status: 'ALLOWED',
      reason: 'allowed_trigger',
      triggerCodes: uniqueCodes,
      matchedAllowedTriggers,
      requiredDefaultTrigger: '[MM-ADV]',
    };
  }

  if (!uniqueCodes.length) {
    return {
      allowed: false,
      ignored: true,
      status: 'IGNORED',
      reason: 'missing_trigger',
      triggerCodes: [],
      matchedAllowedTriggers: [],
      requiredDefaultTrigger: '[MM-ADV]',
    };
  }

  return {
    allowed: false,
    ignored: true,
    status: 'IGNORED',
    reason: 'trigger_not_allowed',
    triggerCodes: uniqueCodes,
    matchedAllowedTriggers: [],
    requiredDefaultTrigger: '[MM-ADV]',
  };
}

export async function listWebexRecordings(options = {}) {
  const env = options.env || process.env;
  const token = String(options.accessToken || readWebexToken(env) || '').trim();
  const config = getWebexTriggerPullConfig(env);
  const allowedTriggers = normalizeTriggerList(options.allowedTriggers || config.allowedTriggers);
  if (!token) {
    return {
      ok: true,
      status: 'UNVERIFIED',
      mode: 'webex-recording-inventory',
      configured: false,
      message: 'No approved Webex read-only token is configured for MMC.',
      allowedTriggers,
      data: [],
      allowed: [],
      ignored: [],
      protections: buildProtections(),
    };
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Webex inventory requires fetch support.');
  }

  const apiBase = normalizeUrl(options.apiBase || config.apiBase);
  const requestUrl = buildWebexRecordingsUrl(apiBase, {
    from: options.from,
    to: options.to,
    hostEmail: options.hostEmail || config.hostEmail,
    meetingId: options.meetingId,
    max: options.max || options.limit,
  });
  const response = await fetchImpl(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(`Webex recording inventory failed with HTTP ${response.status}.`);
    error.statusCode = response.status === 401 || response.status === 403 ? 403 : 502;
    error.code = 'webex_inventory_failed';
    error.detail = detail.slice(0, 240);
    throw error;
  }
  const payload = await response.json();
  const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  const normalized = rawItems
    .map((item) => normalizeWebexRecording(item, { allowedTriggers }))
    .filter(Boolean)
    .slice(0, clampInteger(options.limit || options.max, 100, 1, 500));
  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'webex-recording-inventory',
    configured: true,
    allowedTriggers,
    total: normalized.length,
    allowed: normalized.filter((item) => item.trigger.allowed).map(redactWebexRecordingForResponse),
    ignored: normalized.filter((item) => !item.trigger.allowed).map(redactWebexRecordingForResponse),
    data: normalized.map(redactWebexRecordingForResponse),
    protections: buildProtections(),
  };
}

export async function pullTriggeredWebexRecordings(options = {}) {
  const env = options.env || process.env;
  const token = String(options.accessToken || readWebexToken(env) || '').trim();
  const config = getWebexTriggerPullConfig(env);
  const allowedTriggers = normalizeTriggerList(options.allowedTriggers || config.allowedTriggers);
  const dropZonePath = path.resolve(String(options.dropZonePath || config.dropZonePath || DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH));
  const pullEnabled = options.pullEnabled === true || config.pullEnabled === true || options.force === true;
  if (!token) {
    return {
      ok: false,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-pull',
      error: 'webex_token_missing',
      message: 'No approved Webex read-only token is configured for MMC.',
      allowedTriggers,
      dropZonePath,
      staged: [],
      ignored: [],
      protections: buildProtections(),
    };
  }
  if (!pullEnabled) {
    return {
      ok: false,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-pull',
      error: 'webex_pull_not_enabled',
      message: 'Webex download pull is disabled until MMHQ_MMC_WEBEX_PULL_ENABLED=true or a scoped force flag is supplied.',
      allowedTriggers,
      dropZonePath,
      staged: [],
      ignored: [],
      protections: buildProtections(),
    };
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const inventory = options.inventory || await listWebexRecordings({
    ...options,
    env,
    accessToken: token,
    allowedTriggers,
    fetchImpl,
  });
  const records = inventory.rawData || [];
  const rawRecords = records.length
    ? records
    : await listWebexRecordingsRaw({
      ...options,
      env,
      accessToken: token,
      allowedTriggers,
      fetchImpl,
    });
  const allowed = rawRecords.filter((record) => record.trigger.allowed);
  const ignored = rawRecords.filter((record) => !record.trigger.allowed).map(redactWebexRecordingForResponse);
  const staged = [];
  const skipped = [];
  await mkdir(dropZonePath, { recursive: true });

  for (const record of allowed.slice(0, clampInteger(options.limit, 10, 1, 50))) {
    const detailed = await fetchWebexRecordingDetail(record, {
      ...options,
      env,
      accessToken: token,
      allowedTriggers,
      fetchImpl,
    });
    const recordingUrl = detailed.recordingDownloadUrl || detailed.downloadUrl;
    if (!recordingUrl) {
      skipped.push({
        recordingId: record.id,
        title: record.title,
        reason: 'recording_download_url_missing',
      });
      continue;
    }
    const transcriptUrl = detailed.transcriptDownloadUrl || detailed.transcriptUrl;
    const stem = buildStagingStem(detailed);
    const videoPath = path.join(dropZonePath, `${stem}${extensionFromUrl(recordingUrl, '.mp4', WEBEX_RECORDING_EXTENSIONS)}`);
    const transcriptPath = transcriptUrl
      ? path.join(dropZonePath, `${stem}${extensionFromUrl(transcriptUrl, '.vtt', WEBEX_TRANSCRIPT_EXTENSIONS)}`)
      : '';
    const metadataPath = path.join(dropZonePath, `${stem}.metadata.json`);
    const videoDownload = await downloadWebexAsset(fetchImpl, recordingUrl, token);
    await writeAtomic(videoPath, videoDownload.buffer);
    let transcriptDownload = null;
    if (transcriptUrl) {
      transcriptDownload = await downloadWebexAsset(fetchImpl, transcriptUrl, token);
      await writeAtomic(transcriptPath, transcriptDownload.buffer);
    }
    const metadata = buildStagingMetadata(detailed, {
      videoPath,
      transcriptPath,
      videoSha256: sha256(videoDownload.buffer),
      transcriptSha256: transcriptDownload ? sha256(transcriptDownload.buffer) : '',
      allowedTriggers,
    });
    await writeAtomic(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    staged.push({
      recordingId: detailed.id,
      title: detailed.title,
      trigger: detailed.trigger,
      videoPath,
      transcriptPath,
      metadataPath,
      completePair: Boolean(transcriptPath),
      videoSha256: metadata.video_sha256,
      transcriptSha256: metadata.transcript_sha256,
    });
  }

  return {
    ok: true,
    status: 'VERIFIED',
    mode: 'webex-triggered-pull',
    allowedTriggers,
    dropZonePath,
    staged,
    skipped,
    ignored,
    protections: buildProtections(),
  };
}

export async function listWebexRecordingsRaw(options = {}) {
  const env = options.env || process.env;
  const token = String(options.accessToken || readWebexToken(env) || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = getWebexTriggerPullConfig(env);
  const allowedTriggers = normalizeTriggerList(options.allowedTriggers || config.allowedTriggers);
  if (!token) return [];
  const apiBase = normalizeUrl(options.apiBase || config.apiBase);
  const requestUrl = buildWebexRecordingsUrl(apiBase, {
    from: options.from,
    to: options.to,
    hostEmail: options.hostEmail || config.hostEmail,
    meetingId: options.meetingId,
    max: options.max || options.limit,
  });
  const response = await fetchImpl(requestUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    const error = new Error(`Webex recording inventory failed with HTTP ${response.status}.`);
    error.statusCode = response.status === 401 || response.status === 403 ? 403 : 502;
    error.code = 'webex_inventory_failed';
    throw error;
  }
  const payload = await response.json();
  const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return rawItems.map((item) => normalizeWebexRecording(item, { allowedTriggers })).filter(Boolean);
}

export function normalizeWebexRecording(item = {}, options = {}) {
  const allowedTriggers = normalizeTriggerList(options.allowedTriggers || DEFAULT_WEBEX_ALLOWED_TRIGGERS);
  const id = String(item.id || item.recordingId || item.recording_id || '').trim();
  const title = String(item.topic || item.title || item.meetingTitle || item.name || '').trim();
  if (!id && !title) return null;
  const temporaryLinks = item.temporaryDirectDownloadLinks || item.temporary_direct_download_links || {};
  const recordingDownloadUrl = firstUrl([
    item.downloadUrl,
    item.downloadURL,
    item.download_url,
    item.videoFile,
    item.video_file,
    temporaryLinks.recordingDownloadLink,
    temporaryLinks.recordingFile,
    temporaryLinks.videoFile,
    temporaryLinks.videoDownloadLink,
    temporaryLinks.mp4,
  ]);
  const transcriptDownloadUrl = findTranscriptUrl(item);
  const playbackUrl = firstUrl([
    item.playbackUrl,
    item.playbackURL,
    item.playback_url,
    temporaryLinks.recordingPlaybackLink,
    temporaryLinks.playbackUrl,
  ]);

  return {
    id,
    title,
    meetingId: String(item.meetingId || item.meetingID || item.meeting_id || '').trim(),
    hostEmail: String(item.hostEmail || item.host_email || '').trim(),
    createdTime: String(item.createTime || item.createdTime || item.created || item.startTime || item.start_time || '').trim(),
    durationSeconds: Number(item.durationSeconds || item.duration || 0) || 0,
    sizeBytes: Number(item.sizeBytes || item.fileSize || item.file_size || 0) || 0,
    serviceType: String(item.serviceType || item.service_type || '').trim(),
    recordingDownloadUrl,
    downloadUrl: recordingDownloadUrl,
    transcriptDownloadUrl,
    transcriptUrl: transcriptDownloadUrl,
    playbackUrl,
    hasRecordingDownloadUrl: Boolean(recordingDownloadUrl),
    hasTranscriptUrl: Boolean(transcriptDownloadUrl),
    trigger: classifyWebexRecordingTitle(title, { allowedTriggers }),
    raw: item,
  };
}

export function redactWebexRecordingForResponse(recording = {}) {
  return {
    id: recording.id || '',
    title: recording.title || '',
    meetingId: recording.meetingId || '',
    hostEmail: recording.hostEmail || '',
    createdTime: recording.createdTime || '',
    durationSeconds: Number(recording.durationSeconds || 0),
    sizeBytes: Number(recording.sizeBytes || 0),
    serviceType: recording.serviceType || '',
    hasRecordingDownloadUrl: Boolean(recording.hasRecordingDownloadUrl || recording.recordingDownloadUrl || recording.downloadUrl),
    hasTranscriptUrl: Boolean(recording.hasTranscriptUrl || recording.transcriptDownloadUrl || recording.transcriptUrl),
    hasPlaybackUrl: Boolean(recording.playbackUrl),
    trigger: recording.trigger || classifyWebexRecordingTitle(recording.title || ''),
  };
}

function readWebexToken(env) {
  return readFirstEnv(env, [
    'MMHQ_MMC_WEBEX_ACCESS_TOKEN',
    'MMHQ_WEBEX_ACCESS_TOKEN',
    'SCHEDULER_WEBEX_ACCESS_TOKEN',
    'MMED_WEBEX_ACCESS_TOKEN',
    'WEBEX_ACCESS_TOKEN',
  ]);
}

function readFirstEnv(env, keys) {
  for (const key of keys) {
    const value = env?.[key];
    if (String(value || '').trim()) return String(value).trim();
  }
  return '';
}

function normalizeTriggerCode(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/^\[/u, '').replace(/\]$/u, '');
  if (!/^MM-[A-Z0-9_-]+$/u.test(raw)) return '';
  return `[${raw}]`;
}

function normalizeUrl(value) {
  return String(value || DEFAULT_WEBEX_API_BASE).trim().replace(/\/+$/u, '');
}

function parseBoolean(value, fallback) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function buildWebexRecordingsUrl(apiBase, params) {
  const url = new URL(`${apiBase}/recordings`);
  const queryMap = {
    from: params.from,
    to: params.to,
    hostEmail: params.hostEmail,
    meetingId: params.meetingId,
    max: params.max,
  };
  for (const [key, value] of Object.entries(queryMap)) {
    const normalized = String(value || '').trim();
    if (normalized) url.searchParams.set(key, normalized);
  }
  return url;
}

async function fetchWebexRecordingDetail(record, options = {}) {
  const token = String(options.accessToken || readWebexToken(options.env || process.env) || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = getWebexTriggerPullConfig(options.env || process.env);
  const apiBase = normalizeUrl(options.apiBase || config.apiBase);
  if (!record.id) return record;
  const response = await fetchImpl(`${apiBase}/recordings/${encodeURIComponent(record.id)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    if (record.recordingDownloadUrl || record.transcriptDownloadUrl) return record;
    const error = new Error(`Webex recording detail failed with HTTP ${response.status}.`);
    error.statusCode = response.status === 401 || response.status === 403 ? 403 : 502;
    error.code = 'webex_recording_detail_failed';
    throw error;
  }
  const payload = await response.json();
  return normalizeWebexRecording({
    ...record.raw,
    ...payload,
    id: payload.id || record.id,
    topic: payload.topic || payload.title || record.title,
  }, { allowedTriggers: options.allowedTriggers || config.allowedTriggers });
}

async function downloadWebexAsset(fetchImpl, url, token) {
  const headers = {};
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('webexapis.com')) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Let fetch surface malformed URLs.
  }
  const response = await fetchImpl(url, { method: 'GET', headers });
  if (!response.ok) {
    const error = new Error(`Webex asset download failed with HTTP ${response.status}.`);
    error.statusCode = response.status === 401 || response.status === 403 ? 403 : 502;
    error.code = 'webex_asset_download_failed';
    throw error;
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers?.get?.('content-type') || '',
  };
}

async function writeAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content);
  await rename(tmpPath, filePath);
}

function buildStagingStem(record) {
  const datePrefix = normalizeDatePrefix(record.createdTime) || 'undated';
  const title = String(record.title || record.id || 'webex-recording')
    .replace(/\[(MM-[A-Z0-9_-]+)\]/giu, '')
    .trim();
  const safeTitle = sanitizeFilename(title || 'webex-recording').slice(0, 110) || 'webex-recording';
  const idSuffix = sanitizeFilename(String(record.id || sha256(title).slice(0, 10))).slice(0, 24);
  return `${datePrefix}__${safeTitle}__Webex__${idSuffix}`;
}

function buildStagingMetadata(record, options) {
  return {
    source_system: 'webex_recording',
    source_id: record.id,
    webex_recording_id: record.id,
    webex_meeting_id: record.meetingId || null,
    webex_topic: record.title || null,
    asset_title: record.title || null,
    asset_date: normalizeDatePrefix(record.createdTime) || null,
    host_email: record.hostEmail || null,
    trigger_codes: record.trigger?.triggerCodes || [],
    matched_allowed_triggers: record.trigger?.matchedAllowedTriggers || [],
    allowed_triggers: options.allowedTriggers,
    meeting_match_status: 'manual_review',
    subject_match_status: 'manual_review',
    review_status: 'unreviewed',
    student_identity_policy: 'manual_review_required',
    no_name_only_auto_attach: true,
    no_fixture_fallback: true,
    video_sha256: options.videoSha256,
    transcript_sha256: options.transcriptSha256 || null,
    video_path: options.videoPath,
    transcript_path: options.transcriptPath || null,
    pulled_by: 'MMC-507 Webex triggered recording pull',
    pulled_at: new Date().toISOString(),
    protections: buildProtections(),
  };
}

function findTranscriptUrl(value, depth = 0) {
  if (depth > 5 || value == null) return '';
  if (typeof value === 'string') {
    return looksLikeTranscriptUrl(value) ? value : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTranscriptUrl(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/transcript|caption|vtt|subtitle|text/iu.test(key)) {
        const direct = firstUrl([item]);
        if (direct) return direct;
      }
      const nested = findTranscriptUrl(item, depth + 1);
      if (nested) return nested;
    }
  }
  return '';
}

function firstUrl(values) {
  for (const value of values) {
    if (typeof value === 'string' && /^https?:\/\//iu.test(value.trim())) return value.trim();
  }
  return '';
}

function looksLikeTranscriptUrl(value) {
  const raw = String(value || '').trim();
  return /^https?:\/\//iu.test(raw) && /transcript|caption|vtt|subtitle|\.vtt|\.txt|\.json/iu.test(raw);
}

function extensionFromUrl(value, fallback, allowed) {
  try {
    const parsed = new URL(value);
    const ext = path.extname(parsed.pathname).toLowerCase();
    return allowed.has(ext) ? ext : fallback;
  } catch {
    return fallback;
  }
}

function normalizeDatePrefix(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sanitizeFilename(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w .+-]+/gu, ' ')
    .replace(/\s+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function buildProtections() {
  return {
    webexWrites: false,
    webexMutations: false,
    dailyDrillsWatcherStarted: false,
    videoRegistryWritten: false,
    r2Touched: false,
    streamTouched: false,
    schedulerTouched: false,
    calendarTouched: false,
    productionDeploy: false,
  };
}
