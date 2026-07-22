import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export const DEFAULT_WEBEX_API_BASE = 'https://webexapis.com/v1';
export const DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH = '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes';
export const SUPPORTED_WEBEX_TRIGGER_CODES = Object.freeze(['[MM-ADV]', '[MM-GRP]', '[MM-MOCK]', '[MM-PS]', '[MM-IGNORE]']);
export const DEFAULT_WEBEX_ALLOWED_TRIGGERS = Object.freeze(['[MM-ADV]']);
export const MAX_WEBEX_JSON_BYTES = 2 * 1024 * 1024;
export const MAX_WEBEX_RECORDING_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_WEBEX_TRANSCRIPT_BYTES = 25 * 1024 * 1024;

const WEBEX_RECORDING_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v']);
const WEBEX_TRANSCRIPT_EXTENSIONS = new Set(['.vtt', '.txt', '.json']);
const MAX_WEBEX_METADATA_BYTES = 1024 * 1024;
const APPROVED_WEBEX_API_ORIGIN = new URL(DEFAULT_WEBEX_API_BASE).origin;

export function getWebexTriggerPullConfig(env = process.env) {
  const config = readWebexRuntimeConfig(env);

  return {
    ok: config.ok,
    status: config.ok && config.enabled && config.tokenConfigured ? 'VERIFIED' : 'UNVERIFIED',
    mode: 'webex-triggered-recording-pull',
    enabled: config.enabled,
    apiConfigured: config.ok,
    apiOrigin: config.ok ? config.apiOrigin : '',
    hostEmailConfigured: Boolean(config.hostEmail),
    tokenConfigured: config.tokenConfigured,
    pullEnabled: config.enabled && config.pullEnabled,
    dropZoneConfigured: Boolean(config.dropZonePath),
    allowedTriggers: config.allowedTriggers,
    supportedTriggers: [...SUPPORTED_WEBEX_TRIGGER_CODES],
    defaultAllowedTriggers: [...DEFAULT_WEBEX_ALLOWED_TRIGGERS],
    ...(config.ok ? {} : { error: config.error }),
    protections: buildProtections(),
  };
}

export function normalizeTriggerList(value) {
  const normalized = parseTriggerList(value);
  return normalized.length ? normalized : [...DEFAULT_WEBEX_ALLOWED_TRIGGERS];
}

function parseTriggerList(value) {
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
  return [...new Set(normalized)];
}

export function classifyWebexRecordingTitle(title, options = {}) {
  const allowedTriggers = Object.prototype.hasOwnProperty.call(options, 'allowedTriggers')
    ? parseTriggerList(options.allowedTriggers)
    : [...DEFAULT_WEBEX_ALLOWED_TRIGGERS];
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
  const config = readWebexRuntimeConfig(env);
  assertValidRuntimeConfig(config);
  const allowedTriggers = resolveAllowedTriggers(options.allowedTriggers, config.allowedTriggers);
  if (!config.enabled) {
    return {
      ok: true,
      status: 'UNVERIFIED',
      mode: 'webex-recording-inventory',
      configured: false,
      error: 'webex_integration_disabled',
      message: 'MMC Webex access is disabled.',
      allowedTriggers,
      data: [],
      allowed: [],
      ignored: [],
      protections: buildProtections(),
    };
  }
  if (!config.accessToken) {
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
    throw webexError('webex_fetch_unavailable', 'MMC Webex fetch support is unavailable.', 503);
  }

  const requestUrl = buildWebexRecordingsUrl(config.apiBase, {
    from: options.from,
    to: options.to,
    hostEmail: config.hostEmail,
    meetingId: options.meetingId,
    max: options.max || options.limit,
  });
  const payload = await fetchWebexApiJson(fetchImpl, requestUrl, config, 'webex_inventory_failed');
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
  const config = readWebexRuntimeConfig(env);
  assertValidRuntimeConfig(config);
  const allowedTriggers = resolveAllowedTriggers(options.allowedTriggers, config.allowedTriggers);
  const dropZonePath = resolveDropZonePath(options, config);
  if (!config.enabled) {
    return createPullResponse({
      ok: false,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-pull',
      error: 'webex_integration_disabled',
      message: 'MMC Webex access is disabled.',
      allowedTriggers,
      staged: [],
      ignored: [],
      protections: buildProtections(),
    }, dropZonePath);
  }
  if (!config.accessToken) {
    return createPullResponse({
      ok: false,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-pull',
      error: 'webex_token_missing',
      message: 'No approved Webex read-only token is configured for MMC.',
      allowedTriggers,
      staged: [],
      ignored: [],
      protections: buildProtections(),
    }, dropZonePath);
  }
  if (!config.pullEnabled) {
    return createPullResponse({
      ok: false,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-pull',
      error: 'webex_pull_not_enabled',
      message: 'MMC Webex download pull is disabled.',
      allowedTriggers,
      staged: [],
      ignored: [],
      protections: buildProtections(),
    }, dropZonePath);
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw webexError('webex_fetch_unavailable', 'MMC Webex fetch support is unavailable.', 503);
  }
  const fixtureContext = buildFixtureContext(options, dropZonePath);
  const stagingGuard = await prepareStagingRoot(dropZonePath, fixtureContext);
  const allowedAssetOrigins = resolveAllowedAssetOrigins(config, fixtureContext);
  const rawRecords = await listWebexRecordingsRaw({
    env,
    allowedTriggers,
    fetchImpl,
    from: options.from,
    to: options.to,
    meetingId: options.meetingId,
    limit: options.limit,
  });
  const allowed = rawRecords.filter((record) => record.trigger.allowed);
  const ignored = rawRecords.filter((record) => !record.trigger.allowed).map(redactWebexRecordingForResponse);
  const staged = [];
  const skipped = [];

  for (const record of allowed.slice(0, clampInteger(options.limit, 10, 1, 50))) {
    const detailed = await fetchWebexRecordingDetail(record, {
      config,
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
    const recordingAssetUrl = validateWebexAssetUrl(recordingUrl, allowedAssetOrigins);
    const transcriptAssetUrl = transcriptUrl
      ? validateWebexAssetUrl(transcriptUrl, allowedAssetOrigins)
      : null;
    const stem = buildStagingStem(detailed);
    const videoPath = path.join(stagingGuard.path, `${stem}${extensionFromUrl(recordingAssetUrl.href, '.mp4', WEBEX_RECORDING_EXTENSIONS)}`);
    const transcriptPath = transcriptAssetUrl
      ? path.join(stagingGuard.path, `${stem}${extensionFromUrl(transcriptAssetUrl.href, '.vtt', WEBEX_TRANSCRIPT_EXTENSIONS)}`)
      : '';
    const metadataPath = path.join(stagingGuard.path, `${stem}.metadata.json`);
    const createdPaths = [];
    let videoDownload;
    let transcriptDownload = null;
    try {
      videoDownload = await downloadWebexAssetToFile(fetchImpl, recordingAssetUrl, config, videoPath, {
        maxBytes: MAX_WEBEX_RECORDING_BYTES,
        stagingGuard,
      });
      createdPaths.push(videoPath);
      if (transcriptAssetUrl) {
        transcriptDownload = await downloadWebexAssetToFile(fetchImpl, transcriptAssetUrl, config, transcriptPath, {
          maxBytes: MAX_WEBEX_TRANSCRIPT_BYTES,
          stagingGuard,
        });
        createdPaths.push(transcriptPath);
      }
      const metadata = buildStagingMetadata(detailed, {
        videoPath,
        transcriptPath,
        videoSha256: videoDownload.sha256,
        transcriptSha256: transcriptDownload?.sha256 || '',
        allowedTriggers,
      });
      await writeAtomicNoReplace(
        metadataPath,
        `${JSON.stringify(metadata, null, 2)}\n`,
        MAX_WEBEX_METADATA_BYTES,
        stagingGuard,
      );
      createdPaths.push(metadataPath);
    } catch (error) {
      await cleanupCreatedPaths(createdPaths);
      throw sanitizeWebexError(error);
    }
    staged.push({
      recordingId: detailed.id,
      title: detailed.title,
      trigger: detailed.trigger,
      videoFilename: path.basename(videoPath),
      transcriptFilename: transcriptPath ? path.basename(transcriptPath) : '',
      metadataFilename: path.basename(metadataPath),
      completePair: Boolean(transcriptPath),
      videoSha256: videoDownload.sha256,
      transcriptSha256: transcriptDownload?.sha256 || '',
    });
  }

  return createPullResponse({
    ok: true,
    status: 'VERIFIED',
    mode: 'webex-triggered-pull',
    allowedTriggers,
    staged,
    skipped,
    ignored,
    protections: buildProtections(),
  }, dropZonePath);
}

export async function listWebexRecordingsRaw(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = readWebexRuntimeConfig(env);
  assertValidRuntimeConfig(config);
  const allowedTriggers = resolveAllowedTriggers(options.allowedTriggers, config.allowedTriggers);
  if (!config.enabled || !config.accessToken) return [];
  if (typeof fetchImpl !== 'function') {
    throw webexError('webex_fetch_unavailable', 'MMC Webex fetch support is unavailable.', 503);
  }
  const requestUrl = buildWebexRecordingsUrl(config.apiBase, {
    from: options.from,
    to: options.to,
    hostEmail: config.hostEmail,
    meetingId: options.meetingId,
    max: options.max || options.limit,
  });
  const payload = await fetchWebexApiJson(fetchImpl, requestUrl, config, 'webex_inventory_failed');
  const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
  return rawItems.map((item) => normalizeWebexRecording(item, { allowedTriggers })).filter(Boolean);
}

export function normalizeWebexRecording(item = {}, options = {}) {
  const allowedTriggers = Object.prototype.hasOwnProperty.call(options, 'allowedTriggers')
    ? parseTriggerList(options.allowedTriggers)
    : [...DEFAULT_WEBEX_ALLOWED_TRIGGERS];
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

function normalizeTriggerCode(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/^\[/u, '').replace(/\]$/u, '');
  if (!/^MM-[A-Z0-9_-]+$/u.test(raw)) return '';
  return `[${raw}]`;
}

function parseBoolean(value, fallback) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function readWebexRuntimeConfig(env = {}) {
  const enabled = parseBoolean(env.MMHQ_MMC_WEBEX_ENABLED, false);
  const pullEnabled = parseBoolean(env.MMHQ_MMC_WEBEX_PULL_ENABLED, false);
  const accessToken = String(env.MMHQ_MMC_WEBEX_ACCESS_TOKEN || '').trim();
  const hostEmail = String(env.MMHQ_MMC_WEBEX_HOST_EMAIL || '').trim();
  const allowedTriggers = normalizeTriggerList(env.MMHQ_MMC_WEBEX_ALLOWED_TRIGGERS || DEFAULT_WEBEX_ALLOWED_TRIGGERS);
  const dropZonePath = path.resolve(String(
    env.MMHQ_MMC_WEBEX_DROP_ZONE_PATH || DEFAULT_WEBEX_TRIGGER_DROP_ZONE_PATH,
  ).trim());
  const base = {
    enabled,
    pullEnabled,
    accessToken,
    tokenConfigured: Boolean(accessToken),
    hostEmail,
    allowedTriggers,
    dropZonePath,
  };

  try {
    const api = validateWebexApiBase(env.MMHQ_MMC_WEBEX_API_BASE || DEFAULT_WEBEX_API_BASE);
    return {
      ...base,
      ok: true,
      error: '',
      apiBase: api.base,
      apiOrigin: api.origin,
      allowedAssetOrigins: parseConfiguredDownloadOrigins(env.MMHQ_MMC_WEBEX_DOWNLOAD_ORIGINS, api.origin),
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: String(error?.code || 'webex_config_invalid'),
      apiBase: '',
      apiOrigin: '',
      allowedAssetOrigins: new Set(),
    };
  }
}

function validateWebexApiBase(value) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw webexError('webex_api_origin_invalid', 'MMC Webex API configuration is invalid.', 503);
  }
  const pathname = parsed.pathname.replace(/\/+$/u, '') || '/';
  if (
    parsed.protocol !== 'https:'
    || parsed.origin !== APPROVED_WEBEX_API_ORIGIN
    || pathname !== '/v1'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw webexError('webex_api_origin_invalid', 'MMC Webex API configuration is invalid.', 503);
  }
  return { base: `${APPROVED_WEBEX_API_ORIGIN}/v1`, origin: APPROVED_WEBEX_API_ORIGIN };
}

function parseConfiguredDownloadOrigins(value, apiOrigin) {
  const origins = new Set([apiOrigin]);
  const entries = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    origins.add(validateExactHttpsOrigin(entry, 'webex_download_origin_invalid'));
  }
  return origins;
}

function validateExactHttpsOrigin(value, errorCode) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw webexError(errorCode, 'MMC Webex origin configuration is invalid.', 503);
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw webexError(errorCode, 'MMC Webex origin configuration is invalid.', 503);
  }
  return parsed.origin;
}

function assertValidRuntimeConfig(config) {
  if (!config.ok) {
    throw webexError(config.error || 'webex_config_invalid', 'MMC Webex configuration is invalid.', 503);
  }
}

function resolveAllowedTriggers(requestedValue, configuredAllowedTriggers) {
  const configured = parseTriggerList(configuredAllowedTriggers);
  if (requestedValue == null) return configured;
  const requested = parseTriggerList(requestedValue);
  return requested.filter((code) => configured.includes(code));
}

function resolveDropZonePath(options, config) {
  const configuredPath = path.resolve(config.dropZonePath);
  const requestedValue = String(options.dropZonePath || '').trim();
  if (!requestedValue) return configuredPath;
  const requestedPath = path.resolve(requestedValue);
  if (requestedPath === configuredPath) return configuredPath;
  if (options.fixtureMode !== true) return configuredPath;
  if (!isPathInside(os.tmpdir(), requestedPath)) {
    throw webexError('webex_fixture_root_rejected', 'MMC Webex fixture root is invalid.', 400);
  }
  return requestedPath;
}

function buildFixtureContext(options, dropZonePath) {
  if (options.fixtureMode !== true) return { enabled: false, allowedOrigins: [] };
  if (!isPathInside(os.tmpdir(), dropZonePath)) {
    throw webexError('webex_fixture_root_rejected', 'MMC Webex fixture root is invalid.', 400);
  }
  const values = Array.isArray(options.fixtureDownloadOrigins)
    ? options.fixtureDownloadOrigins
    : String(options.fixtureDownloadOrigins || '').split(',');
  const allowedOrigins = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => {
      const origin = validateExactHttpsOrigin(value, 'webex_fixture_origin_invalid');
      const hostname = new URL(origin).hostname;
      if (!hostname.endsWith('.test')) {
        throw webexError('webex_fixture_origin_invalid', 'MMC Webex fixture origin is invalid.', 400);
      }
      return origin;
    });
  return { enabled: true, allowedOrigins };
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function prepareStagingRoot(dropZonePath, fixtureContext) {
  const resolvedPath = path.resolve(dropZonePath);
  if (fixtureContext.enabled) {
    await assertNoSymlinkComponents(os.tmpdir(), resolvedPath);
  }
  await safeMkdir(resolvedPath);
  const rootEntry = await safeLstat(resolvedPath);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
  }
  const realPath = await safeRealpath(resolvedPath);
  let fixtureRootRealPath = null;
  if (fixtureContext.enabled) {
    fixtureRootRealPath = await safeRealpath(os.tmpdir());
    if (!isPathInside(fixtureRootRealPath, realPath)) {
      throw webexError('webex_fixture_root_rejected', 'MMC Webex fixture root is invalid.', 400);
    }
  }
  return Object.freeze({
    path: resolvedPath,
    realPath,
    device: rootEntry.dev,
    inode: rootEntry.ino,
    fixtureRootRealPath,
  });
}

async function assertNoSymlinkComponents(parentPath, childPath) {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  if (!isPathInside(parent, child)) {
    throw webexError('webex_fixture_root_rejected', 'MMC Webex fixture root is invalid.', 400);
  }
  const relative = path.relative(parent, child);
  let cursor = parent;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    try {
      const entry = await lstat(cursor);
      if (entry.isSymbolicLink()) {
        throw webexError('webex_staging_symlink_rejected', 'MMC Webex staging symlinks are forbidden.', 400);
      }
      if (!entry.isDirectory()) {
        throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
      }
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      if (String(error?.code || '').startsWith('webex_')) throw error;
      throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
    }
  }
}

async function assertStagingTarget(guard, targetPath) {
  if (!guard || typeof guard !== 'object') {
    throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
  }
  const resolvedTarget = path.resolve(targetPath);
  if (path.dirname(resolvedTarget) !== guard.path || path.basename(resolvedTarget) !== path.basename(targetPath)) {
    throw webexError('webex_staging_target_rejected', 'MMC Webex staging target is invalid.', 400);
  }
  const rootEntry = await safeLstat(guard.path);
  const currentRealPath = await safeRealpath(guard.path);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()
    || rootEntry.dev !== guard.device || rootEntry.ino !== guard.inode
    || currentRealPath !== guard.realPath
    || (guard.fixtureRootRealPath && !isPathInside(guard.fixtureRootRealPath, currentRealPath))) {
    throw webexError('webex_staging_root_changed', 'MMC Webex staging root changed during transfer.', 409);
  }
}

async function safeLstat(targetPath) {
  try {
    return await lstat(targetPath);
  } catch {
    throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
  }
}

async function safeRealpath(targetPath) {
  try {
    return await realpath(targetPath);
  } catch {
    throw webexError('webex_staging_root_rejected', 'MMC Webex staging root is invalid.', 400);
  }
}

function resolveAllowedAssetOrigins(config, fixtureContext) {
  const origins = new Set(config.allowedAssetOrigins);
  for (const origin of fixtureContext.allowedOrigins) origins.add(origin);
  return origins;
}

function validateWebexAssetUrl(value, allowedOrigins) {
  let parsed;
  try {
    parsed = new URL(String(value || '').trim());
  } catch {
    throw webexError('webex_asset_url_invalid', 'MMC Webex asset URL is invalid.', 502);
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.hash
    || !allowedOrigins.has(parsed.origin)
  ) {
    throw webexError('webex_asset_origin_rejected', 'MMC Webex asset origin was rejected.', 502);
  }
  return parsed;
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
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = options.config;
  if (!record.id) return record;
  const requestUrl = new URL(`${config.apiBase}/recordings/${encodeURIComponent(record.id)}`);
  const payload = await fetchWebexApiJson(fetchImpl, requestUrl, config, 'webex_recording_detail_failed');
  return normalizeWebexRecording({
    ...record.raw,
    ...payload,
    id: payload.id || record.id,
    topic: payload.topic || payload.title || record.title,
  }, { allowedTriggers: options.allowedTriggers });
}

async function fetchWebexApiJson(fetchImpl, requestUrl, config, failureCode) {
  const parsed = requestUrl instanceof URL ? requestUrl : new URL(requestUrl);
  if (parsed.protocol !== 'https:' || parsed.origin !== config.apiOrigin) {
    throw webexError('webex_api_origin_rejected', 'MMC Webex API origin was rejected.', 502);
  }
  const response = await safeFetch(fetchImpl, parsed.href, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/json',
    },
  }, failureCode);
  rejectRedirectResponse(response);
  if (!response.ok) {
    throw webexError(
      failureCode,
      'MMC Webex provider request failed.',
      response.status === 401 || response.status === 403 ? 403 : 502,
    );
  }
  try {
    return await readBoundedJsonResponse(response, MAX_WEBEX_JSON_BYTES);
  } catch (error) {
    if (String(error?.code || '').startsWith('webex_')) throw error;
    throw webexError('webex_response_invalid', 'MMC Webex response was invalid.', 502);
  }
}

async function downloadWebexAssetToFile(fetchImpl, assetUrl, config, filePath, options) {
  const headers = {};
  if (assetUrl.origin === config.apiOrigin) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }
  const response = await safeFetch(fetchImpl, assetUrl.href, {
    method: 'GET',
    redirect: 'manual',
    headers,
  }, 'webex_asset_download_failed');
  rejectRedirectResponse(response);
  if (!response.ok) {
    throw webexError(
      'webex_asset_download_failed',
      'MMC Webex asset download failed.',
      response.status === 401 || response.status === 403 ? 403 : 502,
    );
  }
  return streamResponseToFile(response, filePath, options.maxBytes, options.stagingGuard);
}

async function safeFetch(fetchImpl, url, init, failureCode) {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw webexError(failureCode, 'MMC Webex provider request failed.', 502);
  }
}

function rejectRedirectResponse(response) {
  const status = Number(response?.status || 0);
  if ((status >= 300 && status < 400) || response?.type === 'opaqueredirect') {
    throw webexError('webex_redirect_rejected', 'MMC Webex redirect was rejected.', 502);
  }
}

async function readBoundedJsonResponse(response, maxBytes) {
  assertContentLengthWithinLimit(response, maxBytes, 'webex_json_too_large');
  let text;
  if (response.body?.getReader) {
    const buffer = await readBoundedResponseBuffer(response, maxBytes, 'webex_json_too_large');
    text = buffer.toString('utf8');
  } else if (typeof response.text === 'function') {
    text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw webexError('webex_json_too_large', 'MMC Webex JSON response exceeded its limit.', 502);
    }
  } else {
    throw webexError('webex_response_invalid', 'MMC Webex response was invalid.', 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw webexError('webex_response_invalid', 'MMC Webex response was invalid.', 502);
  }
}

async function readBoundedResponseBuffer(response, maxBytes, errorCode) {
  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value || []);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel?.().catch(() => {});
      throw webexError(errorCode, 'MMC Webex response exceeded its limit.', 502);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, totalBytes);
}

async function streamResponseToFile(response, filePath, maxBytes, stagingGuard) {
  assertContentLengthWithinLimit(response, maxBytes, 'webex_asset_too_large');
  await assertStagingTarget(stagingGuard, filePath);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  let handle;
  let linked = false;
  try {
    handle = await open(tmpPath, 'wx', 0o600);
    const digest = crypto.createHash('sha256');
    let totalBytes = 0;
    const writeChunk = async (value) => {
      const chunk = Buffer.from(value || []);
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        throw webexError('webex_asset_too_large', 'MMC Webex asset exceeded its limit.', 502);
      }
      digest.update(chunk);
      await writeAll(handle, chunk);
    };

    if (response.body?.getReader) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writeChunk(value);
        }
      } catch (error) {
        await reader.cancel?.().catch(() => {});
        throw error;
      }
    } else if (typeof response.arrayBuffer === 'function') {
      await writeChunk(Buffer.from(await response.arrayBuffer()));
    } else {
      throw webexError('webex_response_invalid', 'MMC Webex response was invalid.', 502);
    }
    await handle.sync();
    await handle.close();
    handle = null;
    await assertStagingTarget(stagingGuard, filePath);
    await link(tmpPath, filePath);
    linked = true;
    await unlink(tmpPath).catch(() => {});
    return {
      bytes: totalBytes,
      sha256: digest.digest('hex'),
      contentType: String(response.headers?.get?.('content-type') || '').slice(0, 120),
    };
  } catch (error) {
    await handle?.close().catch(() => {});
    if (!linked) await unlink(tmpPath).catch(() => {});
    if (error?.code === 'EEXIST') {
      throw webexError('webex_stage_conflict', 'MMC Webex staging target already exists.', 409);
    }
    throw sanitizeWebexError(error);
  }
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.byteLength) {
    const { bytesWritten } = await handle.write(buffer, offset, buffer.byteLength - offset);
    if (!bytesWritten) throw webexError('webex_stage_failed', 'MMC Webex staging failed.', 500);
    offset += bytesWritten;
  }
}

async function writeAtomicNoReplace(filePath, content, maxBytes, stagingGuard) {
  const buffer = Buffer.from(content);
  if (buffer.byteLength > maxBytes) {
    throw webexError('webex_metadata_too_large', 'MMC Webex metadata exceeded its limit.', 500);
  }
  const response = {
    status: 200,
    ok: true,
    headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(buffer.byteLength) : '' },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
  return streamResponseToFile(response, filePath, maxBytes, stagingGuard);
}

function assertContentLengthWithinLimit(response, maxBytes, errorCode) {
  const raw = String(response.headers?.get?.('content-length') || '').trim();
  if (!/^\d+$/u.test(raw)) return;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length > maxBytes) {
    throw webexError(errorCode, 'MMC Webex response exceeded its limit.', 502);
  }
}

async function cleanupCreatedPaths(paths) {
  await Promise.all(paths.map((filePath) => unlink(filePath).catch(() => {})));
}

async function safeMkdir(directoryPath) {
  try {
    await mkdir(directoryPath, { recursive: true });
  } catch {
    throw webexError('webex_stage_failed', 'MMC Webex staging failed.', 500);
  }
}

function createPullResponse(payload, dropZonePath) {
  Object.defineProperty(payload, 'dropZonePath', {
    value: dropZonePath,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return payload;
}

function sanitizeWebexError(error) {
  if (String(error?.code || '').startsWith('webex_')) return error;
  return webexError('webex_stage_failed', 'MMC Webex staging failed.', 500);
}

function webexError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
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
    stagingSymlinkConfinement: true,
  };
}
