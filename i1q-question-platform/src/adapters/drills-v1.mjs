import {
  DRILLS_ADAPTER_VERSION,
  DRILLS_ALLOWED_PRIVACY_STATES,
  DRILLS_ALLOWED_RIGHTS_STATES,
  SOURCE_AVAILABILITY_STATES,
} from '../contracts.mjs';

const AVAILABILITY = new Set(SOURCE_AVAILABILITY_STATES);
const RIGHTS = new Set(DRILLS_ALLOWED_RIGHTS_STATES);
const PRIVACY = new Set(DRILLS_ALLOWED_PRIVACY_STATES);
const SHA256_HEX = /^[0-9a-f]{64}$/u;

function contractError(code, field = null) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 422;
  if (field) error.field = field;
  return error;
}

function requireString(value, code) {
  if (typeof value !== 'string' || !value.trim()) throw contractError(code);
  return value.trim();
}

function requireHash(value, code) {
  if (typeof value !== 'string' || !SHA256_HEX.test(value)) throw contractError(code);
  return value;
}

function normalizeAsset(asset, name, { allowStreamId = false } = {}) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    throw contractError(`${name}_availability_required`);
  }
  const availability = asset.availability;
  if (!AVAILABILITY.has(availability)) throw contractError(`${name}_availability_invalid`);
  const url = typeof asset.url === 'string' && asset.url.trim() ? asset.url.trim() : null;
  const streamId = allowStreamId && typeof asset.stream_id === 'string' && asset.stream_id.trim()
    ? asset.stream_id.trim()
    : null;
  if (availability === 'available' && !url && !streamId) {
    throw contractError(`${name}_location_required`);
  }
  if (availability !== 'available' && (url || streamId)) {
    throw contractError(`${name}_unavailable_location_forbidden`);
  }
  return allowStreamId
    ? { availability, url, stream_id: streamId }
    : { availability, url };
}

function normalizeTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'object' || Array.isArray(timestamp)) {
    throw contractError('timestamp_linkage_required');
  }
  const start = timestamp.start_seconds;
  const end = timestamp.end_seconds;
  if (!Number.isFinite(start) || start < 0) throw contractError('timestamp_start_invalid');
  if (!Number.isFinite(end) || end < start) throw contractError('timestamp_end_invalid');
  return { start_seconds: start, end_seconds: end };
}

export function projectDrillsAdapter({ revision, releaseId }) {
  if (!revision || typeof revision !== 'object' || Array.isArray(revision)) {
    throw contractError('revision_required');
  }
  const source = revision.drills;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw contractError('drills_projection_required');
  }

  const playback = normalizeAsset(source.playback, 'playback', { allowStreamId: true });
  const nodes = normalizeAsset(source.nodes, 'nodes');
  const transcript = normalizeAsset(source.transcript, 'transcript');
  const vtt = normalizeAsset(source.vtt, 'vtt');
  if (playback.availability !== 'available') throw contractError('playback_unavailable');
  if (nodes.availability !== 'available') throw contractError('nodes_unavailable');
  if (!RIGHTS.has(source.rights_status)) throw contractError('drills_rights_not_cleared');
  if (!PRIVACY.has(source.privacy_status)) throw contractError('drills_privacy_not_cleared');

  return {
    contract_version: DRILLS_ADAPTER_VERSION,
    release_id: requireString(releaseId, 'release_id_required'),
    item_revision_id: requireString(revision.id, 'item_revision_id_required'),
    video_id: requireString(source.video_id, 'video_id_required'),
    source_record_id: requireString(source.source_record_id, 'source_record_id_required'),
    title: requireString(source.title, 'drills_title_required'),
    prompt: requireString(revision.prompt, 'revision_prompt_required'),
    concept_id: requireString(revision.concept_id, 'concept_id_required'),
    playback,
    nodes,
    transcript,
    vtt,
    timestamp: normalizeTimestamp(source.timestamp),
    rights_status: source.rights_status,
    privacy_status: source.privacy_status,
    source_hash: requireHash(source.source_hash, 'source_hash_required'),
    working_hash: requireHash(source.working_hash, 'working_hash_required'),
  };
}

export function validateDailyRegistryRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw contractError('ROW_NOT_OBJECT');
  const required = ['video_id', 'title', 'playback_url', 'nodes_url', 'transcript_url'];
  for (const field of required) {
    if (typeof row[field] !== 'string' || !row[field].trim()) {
      throw contractError('ROW_BAD_REQUIRED', field);
    }
  }
  return row;
}
