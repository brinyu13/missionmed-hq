#!/usr/bin/env node

import { createHash, createHmac, randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import https from 'node:https';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNTIME_HOST = 'mmvs-backend-production.up.railway.app';
const CDN_HOST = 'cdn.missionmedinstitute.com';
const RUNTIME_PATHS = new Set(['/health', '/videos', '/api/drills']);
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);
const HANDOFF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = Object.freeze({
  concurrency: 3,
  delayMs: 300,
  timeoutMs: 15_000,
  maxListBytes: 64 * 1024 * 1024,
  maxArtifactBytes: 32 * 1024 * 1024,
});

const LIMITS = Object.freeze({
  concurrency: [1, 8],
  delayMs: [100, 5_000],
  timeoutMs: [1_000, 60_000],
  maxListBytes: [1_024, 128 * 1024 * 1024],
  maxArtifactBytes: [1_024, 64 * 1024 * 1024],
});

const LIST_SOURCES = Object.freeze([
  Object.freeze({
    sourceClass: 'runtime_video_registry',
    url: new URL(`https://${RUNTIME_HOST}/videos`),
  }),
  Object.freeze({
    sourceClass: 'runtime_drill_registry',
    url: new URL(`https://${RUNTIME_HOST}/api/drills`),
  }),
]);

const HEALTH_SOURCE = Object.freeze({
  sourceClass: 'runtime_health',
  url: new URL(`https://${RUNTIME_HOST}/health`),
});

const ID_FIELDS = Object.freeze(['video_id', 'videoId', 'id']);
const ARTIFACT_IDENTITY_FIELDS = Object.freeze([
  'video_id',
  'videoId',
  'asset_id',
  'assetId',
  'source_id',
  'sourceId',
]);
const TRANSCRIPT_FIELDS = Object.freeze(['transcript_url', 'transcriptUrl']);
const NODES_FIELDS = Object.freeze(['nodes_url', 'nodesUrl']);
const SPEAKER_FIELDS = new Set(['speaker', 'speaker_label', 'speakerLabel', 'role']);
const TIMESTAMP_FIELDS = new Set([
  'start',
  'end',
  'start_time',
  'end_time',
  'startTime',
  'endTime',
  'timestamp',
  'time',
]);

const SAFE_ERROR_CODES = new Set([
  'argument_rejected',
  'artifact_reference_rejected',
  'body_cap_exceeded',
  'content_encoding_rejected',
  'content_length_mismatch',
  'content_length_required',
  'entity_binding_mismatch',
  'input_rejected',
  'internal_failure',
  'json_rejected',
  'not_found',
  'mime_rejected',
  'opaque_id_rejected',
  'output_rejected',
  'pagination_rejected',
  'redirect_rejected',
  'runtime_target_rejected',
  'schema_rejected',
  'server_status_rejected',
  'status_rejected',
  'timeout',
  'transport_failure',
]);

class ProbeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProbeError';
    this.code = code;
  }
}

function fail(code) {
  throw new ProbeError(code);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function keyedDigest(aliasKey, domain, value) {
  if (!Buffer.isBuffer(aliasKey) || aliasKey.length < 32) fail('internal_failure');
  return createHmac('sha256', aliasKey).update(`${domain}\0${value}`).digest('hex');
}

function sourceAlias(value, aliasKey) {
  return `source_hmac_sha256_${keyedDigest(aliasKey, 'missionmed-source-v2', value)}`;
}

function entityAlias(value, aliasKey) {
  return `entity_hmac_sha256_${keyedDigest(aliasKey, 'missionmed-entity-v2', value)}`;
}

function setRoot(values, domain, aliasKey) {
  const leaves = [...new Set(values)]
    .map((value) => keyedDigest(aliasKey, `${domain}:leaf`, value))
    .sort();
  return sha256(`${domain}:root\0${leaves.join('\n')}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBoundedInteger(raw, name, [minimum, maximum]) {
  if (!/^\d+$/.test(String(raw ?? ''))) fail('argument_rejected');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail('argument_rejected');
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    ...DEFAULTS,
    dryRun: false,
    help: false,
    output: null,
    registryInput: null,
  };

  const valueOptions = new Map([
    ['--output', 'output'],
    ['--registry-input', 'registryInput'],
    ['--concurrency', 'concurrency'],
    ['--delay-ms', 'delayMs'],
    ['--timeout-ms', 'timeoutMs'],
    ['--max-list-bytes', 'maxListBytes'],
    ['--max-artifact-bytes', 'maxArtifactBytes'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--dry-run' || arg === '--self-test') {
      options.dryRun = true;
      continue;
    }

    const equalsAt = arg.indexOf('=');
    const flag = equalsAt === -1 ? arg : arg.slice(0, equalsAt);
    if (!valueOptions.has(flag)) fail('argument_rejected');
    const key = valueOptions.get(flag);
    const value = equalsAt === -1 ? argv[++index] : arg.slice(equalsAt + 1);
    if (value === undefined || value === '') fail('argument_rejected');
    options[key] = value;
  }

  for (const name of ['concurrency', 'delayMs', 'timeoutMs', 'maxListBytes', 'maxArtifactBytes']) {
    options[name] = parseBoundedInteger(options[name], name, LIMITS[name]);
  }

  if (!options.help && !options.dryRun && !options.output) fail('argument_rejected');
  if (options.dryRun && (options.output || options.registryInput)) fail('argument_rejected');
  return options;
}

function printHelp() {
  process.stdout.write([
    'Sanitized, zero-retention MissionMed runtime corpus probe',
    '',
    'Usage:',
    '  node <probe-tool> --output <report.json> [options]',
    '  node <probe-tool> --dry-run',
    '',
    'Options:',
    '  --output <report.json>          Atomic sanitized report destination.',
    '  --registry-input <json>         Optional local registry reconciliation input.',
    '  --concurrency <1..8>            Artifact probe worker limit.',
    '  --delay-ms <100..5000>          Minimum delay between network starts.',
    '  --timeout-ms <1000..60000>      Per-request timeout.',
    '  --max-list-bytes <n>            Runtime-list and local-input body cap.',
    '  --max-artifact-bytes <n>        Transcript or nodes body cap.',
    '  --dry-run, --self-test          Offline invariant test; no network or files.',
    '  --help                          Show this help.',
    '',
    'The live mode uses read-only requests, rejects redirects, and emits no raw corpus data.',
  ].join('\n') + '\n');
}

function controlledErrorClass(error) {
  if (error instanceof ProbeError && SAFE_ERROR_CODES.has(error.code)) return error.code;
  if (error && error.code === 'PROBE_TIMEOUT') return 'timeout';
  return 'transport_failure';
}

function assertNetworkTarget(url, method, purpose) {
  if (!(url instanceof URL) || !ALLOWED_METHODS.has(method)) fail('runtime_target_rejected');
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port) {
    fail('runtime_target_rejected');
  }

  if (purpose === 'runtime') {
    if (method !== 'GET' || url.hostname !== RUNTIME_HOST || url.search) {
      fail('runtime_target_rejected');
    }
    if (!RUNTIME_PATHS.has(url.pathname)) fail('runtime_target_rejected');
    return;
  }

  if (purpose === 'artifact') {
    if (url.hostname !== CDN_HOST || url.search) fail('artifact_reference_rejected');
    const rawPath = url.pathname.toLowerCase();
    if (!rawPath.endsWith('.json') || /%2f|%5c/.test(rawPath) || rawPath.includes('\\')) {
      fail('artifact_reference_rejected');
    }
    const decodedSegments = url.pathname.split('/').map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        fail('artifact_reference_rejected');
      }
    });
    if (decodedSegments.some((segment) => segment === '.' || segment === '..')) {
      fail('artifact_reference_rejected');
    }
    return;
  }

  fail('runtime_target_rejected');
}

function validateArtifactReference(raw) {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 4_096) {
    fail('artifact_reference_rejected');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail('artifact_reference_rejected');
  }
  assertNetworkTarget(url, 'HEAD', 'artifact');
  return url;
}

function documentedArtifactReference(opaqueId, artifactClass) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._~-]{0,255}$/.test(opaqueId)) return null;
  const artifact = artifactClass === 'transcript_json'
    ? 'transcript'
    : artifactClass === 'nodes_json' ? 'nodes' : null;
  if (!artifact) fail('internal_failure');
  const url = new URL(
    `https://${CDN_HOST}/videos/v2/usmle/${encodeURIComponent(opaqueId)}.${artifact}.json`,
  );
  assertNetworkTarget(url, 'HEAD', 'artifact');
  return url.href;
}

function headerValue(value) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

function classifyMime(raw, allowText) {
  if (typeof raw !== 'string') fail('mime_rejected');
  const mime = raw.split(';', 1)[0].trim().toLowerCase();
  if (mime === 'application/json' || mime === 'text/json' || mime.endsWith('+json')) {
    return 'json';
  }
  if (allowText && mime === 'text/plain') return 'plain_text';
  fail('mime_rejected');
}

function parseContentLength(raw, required, maximum) {
  if (raw === null) {
    if (required) fail('content_length_required');
    return null;
  }
  if (!/^\d+$/.test(raw)) fail('content_length_required');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail('body_cap_exceeded');
  }
  return value;
}

function createRateLimiter(delayMs) {
  let nextStart = 0;
  let chain = Promise.resolve();
  return {
    take() {
      const slot = chain.then(async () => {
        const waitMs = Math.max(0, nextStart - Date.now());
        if (waitMs > 0) await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
        nextStart = Date.now() + delayMs;
      });
      chain = slot.catch(() => {});
      return slot;
    },
  };
}

async function requestBody(url, {
  method,
  purpose,
  maximumBytes,
  timeoutMs,
  limiter,
  networkState,
  requireContentLength = false,
  expectedLength = null,
  allowText = false,
}) {
  assertNetworkTarget(url, method, purpose);
  await limiter.take();
  networkState.requests += 1;

  return new Promise((resolveRequest, rejectRequest) => {
    let settled = false;
    let deadline = null;
    const settleReject = (error) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      rejectRequest(error);
    };
    const settleResolve = (value) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      resolveRequest(value);
    };

    const request = https.request({
      protocol: 'https:',
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: {
        Accept: allowText ? 'application/json, text/plain;q=0.5' : 'application/json',
        'Accept-Encoding': 'identity',
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.destroy();
        settleReject(new ProbeError('redirect_rejected'));
        return;
      }
      if (status === 404) {
        response.destroy();
        settleReject(new ProbeError('not_found'));
        return;
      }
      if (status >= 500 && status <= 599) {
        response.destroy();
        settleReject(new ProbeError('server_status_rejected'));
        return;
      }
      if (status !== 200) {
        response.destroy();
        settleReject(new ProbeError('status_rejected'));
        return;
      }

      let mimeClass;
      let declaredLength;
      try {
        const encoding = headerValue(response.headers['content-encoding']);
        if (encoding && encoding.toLowerCase() !== 'identity') {
          fail('content_encoding_rejected');
        }
        mimeClass = classifyMime(headerValue(response.headers['content-type']), allowText);
        declaredLength = parseContentLength(
          headerValue(response.headers['content-length']),
          requireContentLength,
          maximumBytes,
        );
        if (expectedLength !== null && declaredLength !== expectedLength) {
          fail('content_length_mismatch');
        }
      } catch (error) {
        response.destroy();
        settleReject(error);
        return;
      }

      if (method === 'HEAD') {
        response.resume();
        settleResolve({ body: null, byteCount: 0, declaredLength, mimeClass });
        return;
      }

      const chunks = [];
      let byteCount = 0;
      response.on('data', (chunk) => {
        if (settled) return;
        byteCount += chunk.length;
        if (byteCount > maximumBytes) {
          response.destroy();
          settleReject(new ProbeError('body_cap_exceeded'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', () => settleReject(new ProbeError('transport_failure')));
      response.on('end', () => {
        if (settled) return;
        if (declaredLength !== null && byteCount !== declaredLength) {
          settleReject(new ProbeError('content_length_mismatch'));
          return;
        }
        settleResolve({
          body: Buffer.concat(chunks, byteCount),
          byteCount,
          declaredLength,
          mimeClass,
        });
      });
    });

    deadline = setTimeout(() => {
      const error = new Error('timeout');
      error.code = 'PROBE_TIMEOUT';
      request.destroy(error);
    }, timeoutMs);
    request.on('error', (error) => settleReject(error));
    request.end();
  });
}

function schemaDigest(value, depth = 0) {
  if (depth > 64) fail('schema_rejected');
  if (value === null) return sha256('null');
  if (Array.isArray(value)) {
    const childShapes = [...new Set(value.map((item) => schemaDigest(item, depth + 1)))].sort();
    return sha256(`array\0${childShapes.join('\n')}`);
  }
  switch (typeof value) {
    case 'string':
      return sha256('string');
    case 'number':
      return sha256(Number.isInteger(value) ? 'integer' : 'number');
    case 'boolean':
      return sha256('boolean');
    case 'object': {
      const parts = Object.keys(value).sort().map((key) => (
        `${sha256(`schema-key\0${key}`)}:${schemaDigest(value[key], depth + 1)}`
      ));
      return sha256(`object\0${parts.join('\n')}`);
    }
    default:
      return sha256('unsupported');
  }
}

function locateList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!isPlainObject(payload)) fail('schema_rejected');

  for (const key of ['videos', 'drills', 'items', 'results', 'data']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (isPlainObject(payload.data)) {
    for (const key of ['videos', 'drills', 'items', 'results']) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }
  fail('schema_rejected');
}

function assertUnpaginated(payload, recordCount) {
  if (!isPlainObject(payload)) return;
  const containers = [payload];
  if (isPlainObject(payload.meta)) containers.push(payload.meta);
  if (isPlainObject(payload.pagination)) containers.push(payload.pagination);

  for (const container of containers) {
    if (container.has_more === true || container.hasMore === true) fail('pagination_rejected');
    for (const key of ['next', 'next_cursor', 'nextCursor']) {
      if (container[key] !== undefined && container[key] !== null && container[key] !== '') {
        fail('pagination_rejected');
      }
    }
    for (const key of ['total', 'total_count', 'totalCount']) {
      const total = container[key];
      if (Number.isFinite(total) && total > recordCount) fail('pagination_rejected');
    }
  }
}

function normalizeOpaqueId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function extractOpaqueId(record) {
  for (const field of ID_FIELDS) {
    const normalized = normalizeOpaqueId(record[field]);
    if (normalized) return normalized;
  }
  return null;
}

function extractDivision(record) {
  if (typeof record.division === 'string') return record.division;
  if (isPlainObject(record.metadata) && typeof record.metadata.division === 'string') {
    return record.metadata.division;
  }
  return null;
}

function getOrCreateEntry(entries, id) {
  if (!entries.has(id)) {
    entries.set(id, {
      candidate: false,
      transcriptReferences: new Set(),
      nodesReferences: new Set(),
    });
  }
  return entries.get(id);
}

function addArtifactReferences(set, record, fields) {
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === 'string' && raw.trim()) set.add(raw.trim());
  }
}

function recordValuePresent(record, fields) {
  const metadata = isPlainObject(record.metadata) ? record.metadata : {};
  return fields.some((field) => {
    const value = record[field] ?? metadata[field];
    return (typeof value === 'string' && value.trim() !== '')
      || (typeof value === 'number' && Number.isFinite(value));
  });
}

function summarizeRecords(records, aliasKey) {
  const entries = new Map();
  let invalidRecordCount = 0;
  let missingOpaqueIdCount = 0;
  let duplicateOpaqueIdCount = 0;
  let candidateRowCount = 0;
  const candidateMetadataPresence = {
    direct_transcript_reference_count: 0,
    direct_nodes_reference_count: 0,
    transcript_locator_count: 0,
    nodes_locator_count: 0,
    cloud_video_locator_count: 0,
    stream_locator_count: 0,
    active_status_count: 0,
  };

  for (const record of records) {
    if (!isPlainObject(record)) {
      invalidRecordCount += 1;
      continue;
    }
    const id = extractOpaqueId(record);
    if (!id) {
      missingOpaqueIdCount += 1;
      continue;
    }
    if (entries.has(id)) duplicateOpaqueIdCount += 1;
    const entry = getOrCreateEntry(entries, id);
    const division = extractDivision(record);
    if (typeof division === 'string' && division.trim().toLowerCase() === 'usmle') {
      entry.candidate = true;
      candidateRowCount += 1;
      if (recordValuePresent(record, TRANSCRIPT_FIELDS)) {
        candidateMetadataPresence.direct_transcript_reference_count += 1;
      }
      if (recordValuePresent(record, NODES_FIELDS)) {
        candidateMetadataPresence.direct_nodes_reference_count += 1;
      }
      if (recordValuePresent(record, ['transcript_path', 'transcriptPath'])) {
        candidateMetadataPresence.transcript_locator_count += 1;
      }
      if (recordValuePresent(record, ['nodes_path', 'nodesPath'])) {
        candidateMetadataPresence.nodes_locator_count += 1;
      }
      if (recordValuePresent(record, ['cloud_video_path', 'cloudVideoPath', 'object_key'])) {
        candidateMetadataPresence.cloud_video_locator_count += 1;
      }
      if (recordValuePresent(record, ['stream_id', 'streamId', 'stream_uid', 'streamUid'])) {
        candidateMetadataPresence.stream_locator_count += 1;
      }
      const rawStatus = record.status ?? (isPlainObject(record.metadata) ? record.metadata.status : null);
      if (typeof rawStatus === 'string' && rawStatus.trim().toLowerCase() === 'active') {
        candidateMetadataPresence.active_status_count += 1;
      }
    }
    addArtifactReferences(entry.transcriptReferences, record, TRANSCRIPT_FIELDS);
    addArtifactReferences(entry.nodesReferences, record, NODES_FIELDS);
  }

  const ids = [...entries.keys()];
  const candidateIds = ids.filter((id) => entries.get(id).candidate);
  return {
    entries,
    statistics: {
      record_count: records.length,
      opaque_id_count: ids.length,
      opaque_id_set_root: setRoot(ids, 'missionmed-opaque-id-set-v2', aliasKey),
      candidate_row_count: candidateRowCount,
      candidate_opaque_id_count: candidateIds.length,
      candidate_opaque_id_set_root: setRoot(
        candidateIds,
        'missionmed-candidate-id-set-v2',
        aliasKey,
      ),
      candidate_metadata_presence: candidateMetadataPresence,
      duplicate_opaque_id_count: duplicateOpaqueIdCount,
      invalid_record_count: invalidRecordCount,
      missing_opaque_id_count: missingOpaqueIdCount,
    },
  };
}

async function scanRuntimeList(source, passIndex, options, context) {
  const safeBase = {
    pass_index: passIndex,
    source_alias: sourceAlias(source.url.href, context.aliasKey),
    source_class: source.sourceClass,
  };

  let response;
  try {
    response = await requestBody(source.url, {
      method: 'GET',
      purpose: 'runtime',
      maximumBytes: options.maxListBytes,
      timeoutMs: options.timeoutMs,
      limiter: context.limiter,
      networkState: context.networkState,
    });
  } catch (error) {
    return {
      safe: { ...safeBase, availability: 'rejected', error_class: controlledErrorClass(error) },
      entries: new Map(),
    };
  }

  const bodyReceiptHash = sha256(response.body);
  let payload;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
  } catch {
    return {
      safe: {
        ...safeBase,
        availability: 'rejected',
        error_class: 'json_rejected',
        body_receipt_hash: bodyReceiptHash,
        byte_count: response.byteCount,
      },
      entries: new Map(),
    };
  }

  try {
    const records = locateList(payload);
    assertUnpaginated(payload, records.length);
    const summary = summarizeRecords(records, context.aliasKey);
    return {
      safe: {
        ...safeBase,
        availability: 'observed',
        body_receipt_hash: bodyReceiptHash,
        byte_count: response.byteCount,
        mime_class: response.mimeClass,
        schema_fingerprint: schemaDigest(payload),
        ...summary.statistics,
      },
      entries: summary.entries,
    };
  } catch (error) {
    return {
      safe: {
        ...safeBase,
        availability: 'rejected',
        error_class: controlledErrorClass(error),
        body_receipt_hash: bodyReceiptHash,
        byte_count: response.byteCount,
      },
      entries: new Map(),
    };
  }
}

async function probeHealth(options, context) {
  const safeBase = {
    source_alias: sourceAlias(HEALTH_SOURCE.url.href, context.aliasKey),
    source_class: HEALTH_SOURCE.sourceClass,
  };
  try {
    const response = await requestBody(HEALTH_SOURCE.url, {
      method: 'GET',
      purpose: 'runtime',
      maximumBytes: 64 * 1024,
      timeoutMs: options.timeoutMs,
      limiter: context.limiter,
      networkState: context.networkState,
      allowText: true,
    });
    const safe = {
      ...safeBase,
      availability: 'observed',
      body_receipt_hash: sha256(response.body),
      byte_count: response.byteCount,
      mime_class: response.mimeClass,
    };
    if (response.mimeClass === 'json') {
      try {
        safe.schema_fingerprint = schemaDigest(JSON.parse(response.body.toString('utf8')));
      } catch {
        safe.availability = 'rejected';
        safe.error_class = 'json_rejected';
      }
    }
    return safe;
  } catch (error) {
    return { ...safeBase, availability: 'rejected', error_class: controlledErrorClass(error) };
  }
}

function mergeEntryMaps(scans) {
  const merged = new Map();
  for (const scan of scans) {
    for (const [id, sourceEntry] of scan.entries) {
      const target = getOrCreateEntry(merged, id);
      target.candidate ||= sourceEntry.candidate;
      for (const ref of sourceEntry.transcriptReferences) target.transcriptReferences.add(ref);
      for (const ref of sourceEntry.nodesReferences) target.nodesReferences.add(ref);
    }
  }
  return merged;
}

function stabilityFor(source, scans, aliasKey) {
  const sourceScans = scans.filter((scan) => scan.safe.source_class === source.sourceClass);
  const observed = sourceScans.length === 2
    && sourceScans.every((scan) => scan.safe.availability === 'observed');
  return {
    source_alias: sourceAlias(source.url.href, aliasKey),
    source_class: source.sourceClass,
    pass_receipts: sourceScans.map((scan) => scan.safe),
    opaque_id_set_stable: observed
      && sourceScans[0].safe.opaque_id_set_root === sourceScans[1].safe.opaque_id_set_root,
    candidate_opaque_id_set_stable: observed
      && sourceScans[0].safe.candidate_opaque_id_set_root
        === sourceScans[1].safe.candidate_opaque_id_set_root,
    body_receipt_stable: observed
      && sourceScans[0].safe.body_receipt_hash === sourceScans[1].safe.body_receipt_hash,
  };
}

function artifactRecordArray(payload, artifactClass) {
  if (Array.isArray(payload)) {
    return { records: payload, schemaClass: 'direct_array', identityContainers: [] };
  }
  if (!isPlainObject(payload)) {
    return { records: null, schemaClass: 'unsupported_scalar', identityContainers: [] };
  }

  const keys = artifactClass === 'transcript_json'
    ? ['segments', 'transcript', 'chunks', 'data']
    : ['drill_nodes', 'drillNodes', 'nodes', 'segments', 'data'];
  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return {
        records: payload[key],
        schemaClass: 'recognized_wrapper',
        identityContainers: [payload],
      };
    }
    if (isPlainObject(payload[key])) {
      for (const nested of keys) {
        if (Array.isArray(payload[key][nested])) {
          return {
            records: payload[key][nested],
            schemaClass: 'recognized_nested_wrapper',
            identityContainers: [payload, payload[key]],
          };
        }
      }
    }
  }
  return { records: null, schemaClass: 'unrecognized_object', identityContainers: [payload] };
}

function artifactIdentityBinding(
  payload,
  expectedOpaqueId,
  primaryRecords,
  identityContainers = [],
) {
  const declared = new Set();
  const collectFromObject = (value) => {
    if (!isPlainObject(value)) return;
    for (const field of ARTIFACT_IDENTITY_FIELDS) {
      const normalized = normalizeOpaqueId(value[field]);
      if (normalized) declared.add(normalized);
    }
    if (isPlainObject(value.metadata)) {
      for (const field of ARTIFACT_IDENTITY_FIELDS) {
        const normalized = normalizeOpaqueId(value.metadata[field]);
        if (normalized) declared.add(normalized);
      }
    }
  };

  collectFromObject(payload);
  for (const container of identityContainers) collectFromObject(container);
  for (const record of primaryRecords) collectFromObject(record);
  if (declared.size === 0) {
    return { binding_class: 'locator_only', declared_identity_count: 0 };
  }
  if ([...declared].some((value) => value !== expectedOpaqueId)) {
    fail('entity_binding_mismatch');
  }
  return { binding_class: 'locator_and_payload', declared_identity_count: declared.size };
}

function artifactMetrics(payload, artifactClass, aliasKey, expectedOpaqueId) {
  const primary = artifactRecordArray(payload, artifactClass);
  if (!primary.records) fail('schema_rejected');
  const identityBinding = artifactIdentityBinding(
    payload,
    expectedOpaqueId,
    primary.records,
    primary.identityContainers,
  );

  const speakerLabels = new Set();
  let timestampCount = 0;
  let chunkCount = 0;
  let visited = 0;
  let primaryRecordsWithTimestamp = 0;

  for (const record of primary.records) {
    if (!isPlainObject(record)) continue;
    const hasTimestamp = Object.entries(record).some(([key, value]) => (
      TIMESTAMP_FIELDS.has(key)
      && (typeof value === 'string' || typeof value === 'number')
      && String(value).trim() !== ''
    ));
    if (hasTimestamp) primaryRecordsWithTimestamp += 1;
  }

  const walk = (value, keyHint = null, depth = 0) => {
    if (depth > 64 || visited > 2_000_000) fail('schema_rejected');
    visited += 1;
    if (Array.isArray(value)) {
      if (keyHint === 'chunks') chunkCount += value.length;
      for (const item of value) walk(item, null, depth + 1);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (SPEAKER_FIELDS.has(key) && typeof child === 'string' && child.trim()) {
        speakerLabels.add(child.trim());
      }
      if (TIMESTAMP_FIELDS.has(key)
        && (typeof child === 'string' || typeof child === 'number')
        && String(child).trim() !== '') {
        timestampCount += 1;
      }
      walk(child, key, depth + 1);
    }
  };
  walk(payload);

  return {
    schema_class: primary.schemaClass,
    ...identityBinding,
    segment_count: primary.records.length,
    chunk_count: chunkCount,
    timestamp_count: timestampCount,
    primary_records_with_timestamp_count: primaryRecordsWithTimestamp,
    primary_record_timestamp_coverage_ratio: primary.records.length === 0
      ? 0
      : Number((primaryRecordsWithTimestamp / primary.records.length).toFixed(6)),
    speaker_label_count: speakerLabels.size,
    speaker_label_set_root: setRoot(
      speakerLabels,
      'missionmed-speaker-label-set-v2',
      aliasKey,
    ),
  };
}

function resolvePinnedArtifactReference(job) {
  if (!job.derivedReference) fail('opaque_id_rejected');
  const derivedUrl = validateArtifactReference(job.derivedReference);
  const canonicalDirect = new Map();
  let rejectedDirectCount = 0;
  for (const raw of job.directReferences) {
    try {
      const url = validateArtifactReference(raw);
      canonicalDirect.set(url.href, url);
    } catch {
      rejectedDirectCount += 1;
    }
  }
  if (rejectedDirectCount > 0) {
    return { url: derivedUrl, referenceIntegrity: 'direct_reference_rejected' };
  }
  if (canonicalDirect.size === 0) {
    return { url: derivedUrl, referenceIntegrity: 'documented_derivation_only' };
  }
  if (canonicalDirect.size !== 1 || !canonicalDirect.has(derivedUrl.href)) {
    return { url: derivedUrl, referenceIntegrity: 'direct_reference_conflict' };
  }
  return { url: derivedUrl, referenceIntegrity: 'direct_reference_corroborated' };
}

async function probeArtifact(job, options, context) {
  let safeBase = {
    entity_alias: entityAlias(job.id, context.aliasKey),
    artifact_class: job.artifactClass,
    reference_basis: job.referenceBasis,
  };
  if (!job.derivationEligible) {
    return { ...safeBase, availability: 'rejected', error_class: 'opaque_id_rejected' };
  }
  let resolved;
  try {
    resolved = resolvePinnedArtifactReference(job);
  } catch (error) {
    return { ...safeBase, availability: 'rejected', error_class: controlledErrorClass(error) };
  }
  safeBase = { ...safeBase, reference_integrity: resolved.referenceIntegrity };

  const artifactSourceAlias = sourceAlias(resolved.url.href, context.aliasKey);
  let head;
  try {
    head = await requestBody(resolved.url, {
      method: 'HEAD',
      purpose: 'artifact',
      maximumBytes: options.maxArtifactBytes,
      timeoutMs: options.timeoutMs,
      limiter: context.limiter,
      networkState: context.networkState,
      requireContentLength: true,
    });
  } catch (error) {
    return {
      ...safeBase,
      source_alias: artifactSourceAlias,
      availability: 'rejected',
      rejection_stage: 'head',
      error_class: controlledErrorClass(error),
    };
  }

  let response;
  try {
    response = await requestBody(resolved.url, {
      method: 'GET',
      purpose: 'artifact',
      maximumBytes: options.maxArtifactBytes,
      timeoutMs: options.timeoutMs,
      limiter: context.limiter,
      networkState: context.networkState,
      requireContentLength: true,
      expectedLength: head.declaredLength,
    });
  } catch (error) {
    return {
      ...safeBase,
      source_alias: artifactSourceAlias,
      availability: 'rejected',
      rejection_stage: 'get',
      declared_byte_count: head.declaredLength,
      error_class: controlledErrorClass(error),
    };
  }

  const receipt = {
    content_hash: sha256(response.body),
    byte_count: response.byteCount,
    mime_class: response.mimeClass,
  };
  let payload;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
  } catch {
    return {
      ...safeBase,
      source_alias: artifactSourceAlias,
      availability: 'rejected',
      rejection_stage: 'json',
      error_class: 'json_rejected',
      receipt,
    };
  }

  try {
    const metrics = artifactMetrics(
      payload,
      job.artifactClass,
      context.aliasKey,
      job.id,
    );
    return {
      ...safeBase,
      source_alias: artifactSourceAlias,
      availability: 'available',
      receipt: {
        ...receipt,
        schema_fingerprint: schemaDigest(payload),
        ...metrics,
      },
    };
  } catch (error) {
    let schemaFingerprint = null;
    try {
      schemaFingerprint = schemaDigest(payload);
    } catch {
      // The safe rejection class below is sufficient; never retain the rejected body.
    }
    return {
      ...safeBase,
      source_alias: artifactSourceAlias,
      availability: 'rejected',
      rejection_stage: 'schema',
      error_class: controlledErrorClass(error),
      receipt: {
        ...receipt,
        schema_fingerprint: schemaFingerprint,
      },
    };
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function duplicateClusters(inventory) {
  const byHash = new Map();
  for (const item of inventory) {
    if (item.availability !== 'available' || !item.receipt?.content_hash) continue;
    if (!byHash.has(item.receipt.content_hash)) byHash.set(item.receipt.content_hash, []);
    byHash.get(item.receipt.content_hash).push({
      entity_alias: item.entity_alias,
      artifact_class: item.artifact_class,
    });
  }
  return [...byHash.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([contentHash, members]) => ({
      content_hash: contentHash,
      member_count: members.length,
      members: members.sort((left, right) => (
        `${left.entity_alias}:${left.artifact_class}`
          .localeCompare(`${right.entity_alias}:${right.artifact_class}`)
      )),
    }))
    .sort((left, right) => left.content_hash.localeCompare(right.content_hash));
}

function artifactClassSummaries(inventory) {
  return ['transcript_json', 'nodes_json'].map((artifactClass) => {
    const members = inventory.filter((item) => item.artifact_class === artifactClass);
    const available = members.filter((item) => item.availability === 'available');
    return {
      artifact_class: artifactClass,
      expected_count: members.length,
      available_count: available.length,
      rejected_count: members.filter((item) => item.availability === 'rejected').length,
      absent_from_registry_count: members.filter(
        (item) => item.availability === 'absent_from_registry',
      ).length,
      locator_only_binding_count: available.filter(
        (item) => item.receipt?.binding_class === 'locator_only',
      ).length,
      locator_and_payload_binding_count: available.filter(
        (item) => item.receipt?.binding_class === 'locator_and_payload',
      ).length,
      unique_content_hash_count: new Set(
        available.map((item) => item.receipt.content_hash),
      ).size,
      primary_record_count_sum: available.reduce(
        (sum, item) => sum + (item.receipt?.segment_count ?? 0),
        0,
      ),
      primary_records_with_timestamp_count_sum: available.reduce(
        (sum, item) => sum + (item.receipt?.primary_records_with_timestamp_count ?? 0),
        0,
      ),
    };
  });
}

async function readLocalRegistry(pathValue, options, aliasKey) {
  const safeBase = {
    provided: true,
    source_alias: sourceAlias('caller-provided-local-registry', aliasKey),
    source_class: 'local_registry_input',
  };
  let handle;
  try {
    handle = await open(resolve(pathValue), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > options.maxListBytes) fail('input_rejected');
    const body = await handle.readFile();
    if (body.length > options.maxListBytes) fail('input_rejected');
    const bodyReceiptHash = sha256(body);
    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      return {
        safe: {
          ...safeBase,
          availability: 'rejected',
          error_class: 'json_rejected',
          body_receipt_hash: bodyReceiptHash,
          byte_count: body.length,
        },
        entries: new Map(),
      };
    }
    const records = locateList(payload);
    assertUnpaginated(payload, records.length);
    const summary = summarizeRecords(records, aliasKey);
    return {
      safe: {
        ...safeBase,
        availability: 'observed',
        body_receipt_hash: bodyReceiptHash,
        byte_count: body.length,
        schema_fingerprint: schemaDigest(payload),
        ...summary.statistics,
      },
      entries: summary.entries,
    };
  } catch (error) {
    return {
      safe: { ...safeBase, availability: 'rejected', error_class: controlledErrorClass(error) },
      entries: new Map(),
    };
  } finally {
    await handle?.close().catch(() => {});
  }
}

function reconcileLocal(localScan, liveEntries, aliasKey) {
  if (!localScan || localScan.safe.availability !== 'observed') return localScan?.safe ?? { provided: false };
  const localIds = new Set(localScan.entries.keys());
  const liveIds = new Set(liveEntries.keys());
  const intersection = [...localIds].filter((id) => liveIds.has(id));
  const localOnly = [...localIds].filter((id) => !liveIds.has(id));
  const liveOnly = [...liveIds].filter((id) => !localIds.has(id));
  return {
    ...localScan.safe,
    reconciliation: {
      intersection_count: intersection.length,
      intersection_set_root: setRoot(
        intersection,
        'missionmed-reconciliation-intersection-v2',
        aliasKey,
      ),
      local_only_count: localOnly.length,
      local_only_set_root: setRoot(localOnly, 'missionmed-reconciliation-local-only-v2', aliasKey),
      live_only_count: liveOnly.length,
      live_only_set_root: setRoot(liveOnly, 'missionmed-reconciliation-live-only-v2', aliasKey),
    },
  };
}

function reconcileConsumerProjection(candidateIds, scans, aliasKey) {
  const candidateSet = new Set(candidateIds);
  const consumerEntries = mergeEntryMaps(
    scans.filter((scan) => scan.safe.source_class === 'runtime_drill_registry'),
  );
  const consumerSet = new Set(consumerEntries.keys());
  const intersection = [...candidateSet].filter((id) => consumerSet.has(id));
  const candidateOnly = [...candidateSet].filter((id) => !consumerSet.has(id));
  const consumerOnly = [...consumerSet].filter((id) => !candidateSet.has(id));
  return {
    candidate_count: candidateSet.size,
    consumer_projection_count: consumerSet.size,
    intersection_count: intersection.length,
    intersection_set_root: setRoot(
      intersection,
      'missionmed-candidate-consumer-intersection-v1',
      aliasKey,
    ),
    candidate_only_count: candidateOnly.length,
    candidate_only_set_root: setRoot(
      candidateOnly,
      'missionmed-candidate-only-v1',
      aliasKey,
    ),
    consumer_only_count: consumerOnly.length,
    consumer_only_set_root: setRoot(
      consumerOnly,
      'missionmed-consumer-only-v1',
      aliasKey,
    ),
    authority_boundary: 'consumer_projection_is_not_a_corpus_universe',
  };
}

function reconcileCandidateSurfaces(candidateIds, scans, localScan, aliasKey) {
  const liveSet = new Set(candidateIds);
  const consumerSet = new Set(mergeEntryMaps(
    scans.filter((scan) => scan.safe.source_class === 'runtime_drill_registry'),
  ).keys());
  const localSet = new Set(
    localScan?.safe.availability === 'observed'
      ? [...localScan.entries]
        .filter(([, entry]) => entry.candidate)
        .map(([id]) => id)
      : [],
  );

  const bucket = (name, values) => ({
    membership_class: name,
    count: values.length,
    set_root: setRoot(values, `missionmed-three-surface-${name}-v1`, aliasKey),
  });
  const liveConsumerLocal = [...liveSet].filter(
    (id) => consumerSet.has(id) && localSet.has(id),
  );
  const liveConsumerNotLocal = [...liveSet].filter(
    (id) => consumerSet.has(id) && !localSet.has(id),
  );
  const liveLocalNotConsumer = [...liveSet].filter(
    (id) => localSet.has(id) && !consumerSet.has(id),
  );
  const liveOnly = [...liveSet].filter(
    (id) => !consumerSet.has(id) && !localSet.has(id),
  );
  const consumerNotLive = [...consumerSet].filter((id) => !liveSet.has(id));
  const localNotLive = [...localSet].filter((id) => !liveSet.has(id));

  return {
    live_candidate_count: liveSet.size,
    consumer_projection_count: consumerSet.size,
    local_candidate_count: localSet.size,
    local_registry_provided: localScan?.safe.availability === 'observed',
    membership_buckets: [
      bucket('live_consumer_local', liveConsumerLocal),
      bucket('live_consumer_not_local', liveConsumerNotLocal),
      bucket('live_local_not_consumer', liveLocalNotConsumer),
      bucket('live_only', liveOnly),
      bucket('consumer_not_live', consumerNotLive),
      bucket('local_not_live', localNotLive),
    ],
  };
}

async function assertOutputPath(pathValue) {
  const rootReal = await realpath(HANDOFF_ROOT);
  const output = resolve(pathValue);
  if (extname(output).toLowerCase() !== '.json') fail('output_rejected');
  const parentReal = await realpath(dirname(output));
  const relation = relative(rootReal, parentReal);
  if (relation === '..' || relation.startsWith(`..${sep}`) || resolve(output) === rootReal) {
    fail('output_rejected');
  }
  try {
    const existing = await lstat(output);
    if (!existing.isFile() || existing.isSymbolicLink()) fail('output_rejected');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return output;
}

async function atomicWriteSanitized(pathValue, serialized) {
  const output = await assertOutputPath(pathValue);
  const temporary = resolve(
    dirname(output),
    `.sanitized-probe-${process.pid}-${randomBytes(8).toString('hex')}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(serialized, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, output);
  } catch (error) {
    await handle?.close().catch(() => {});
    try {
      const cleanup = await open(temporary, 'r+');
      await cleanup.truncate(0);
      await cleanup.close();
      await unlink(temporary);
    } catch {
      // The temporary file may not have been created or may already have been renamed.
    }
    fail(error instanceof ProbeError ? error.code : 'output_rejected');
  }
}

function assertSanitizedSerialization(serialized) {
  if (serialized.includes('https://') || serialized.includes('http://')) fail('internal_failure');
  if (serialized.includes(RUNTIME_HOST) || serialized.includes(CDN_HOST)) fail('internal_failure');
  for (const forbiddenKey of [
    '"title"',
    '"url"',
    '"filename"',
    '"path"',
    '"speaker"',
    '"text"',
    '"token"',
    '"headers"',
    '"body"',
  ]) {
    if (serialized.includes(forbiddenKey)) fail('internal_failure');
  }
}

function assertRawValuesAbsent(serialized, rawValues) {
  for (const raw of rawValues) {
    if (typeof raw !== 'string' || !raw) continue;
    if (serialized.includes(JSON.stringify(raw))) fail('internal_failure');
  }
}

async function runProbe(options) {
  await assertOutputPath(options.output);
  const context = {
    limiter: createRateLimiter(options.delayMs),
    networkState: { requests: 0 },
    aliasKey: randomBytes(32),
  };

  const healthReceipt = await probeHealth(options, context);
  const scans = [];
  for (let passIndex = 1; passIndex <= 2; passIndex += 1) {
    for (const source of LIST_SOURCES) {
      scans.push(await scanRuntimeList(source, passIndex, options, context));
    }
  }

  const mergedEntries = mergeEntryMaps(scans);
  const candidateIds = [...mergedEntries]
    .filter(([, entry]) => entry.candidate)
    .map(([id]) => id)
    .sort();

  const jobs = [];
  for (const id of candidateIds) {
    const entry = mergedEntries.get(id);
    for (const [artifactClass, directReferences] of [
      ['transcript_json', entry.transcriptReferences],
      ['nodes_json', entry.nodesReferences],
    ]) {
      const derivedReference = documentedArtifactReference(id, artifactClass);
      let referenceBasis = 'absent';
      if (directReferences.size > 0 && derivedReference) {
        referenceBasis = 'direct_plus_documented_runtime_derivation';
      } else if (directReferences.size > 0) {
        referenceBasis = 'direct_registry_reference';
      } else if (derivedReference) {
        referenceBasis = 'documented_runtime_derivation';
      }
      jobs.push({
        id,
        artifactClass,
        directReferences: new Set(directReferences),
        derivedReference,
        referenceBasis,
        derivationEligible: derivedReference !== null,
      });
    }
  }
  const inventory = await mapLimit(
    jobs,
    options.concurrency,
    (job) => probeArtifact(job, options, context),
  );
  inventory.sort((left, right) => (
    `${left.entity_alias}:${left.artifact_class}`
      .localeCompare(`${right.entity_alias}:${right.artifact_class}`)
  ));

  const localScan = options.registryInput
    ? await readLocalRegistry(options.registryInput, options, context.aliasKey)
    : null;
  const endpointStability = LIST_SOURCES.map(
    (source) => stabilityFor(source, scans, context.aliasKey),
  );
  const availableCount = inventory.filter((item) => item.availability === 'available').length;
  const rejectedCount = inventory.filter((item) => item.availability === 'rejected').length;
  const absentCount = inventory.filter((item) => item.availability === 'absent_from_registry').length;

  const report = {
    schema_version: 'missionmed.sanitized-runtime-corpus-probe.v1',
    generated_at: new Date().toISOString(),
    execution: {
      mode: 'live_read_only_zero_retention',
      network_method_classes: ['GET', 'HEAD'],
      redirect_policy: 'reject',
      raw_retention: 'none',
      network_request_count: context.networkState.requests,
      list_scan_pass_count: 2,
      bounded_concurrency: options.concurrency,
      minimum_request_start_delay_ms: options.delayMs,
    },
    aliasing: {
      scheme: 'per_run_hmac_sha256',
      key_retention: 'none',
      cross_run_alias_correlation: false,
      content_hash_scope: 'byte_identity_only',
    },
    authority_status: {
      corpus_authority: 'not_established_by_probe_alone',
      speaker_authority: 'not_established_by_probe',
      medical_review_status: 'not_inferred',
    },
    candidate_policy: {
      classification: 'unratified_candidate_universe',
      predicate: 'division_equals_usmle_case_folded_exact',
      ratified: false,
    },
    health_receipt: healthReceipt,
    runtime_inventory: endpointStability,
    candidate_universe: {
      classification: 'unratified_candidate_universe',
      opaque_id_count: candidateIds.length,
      opaque_id_set_root: setRoot(
        candidateIds,
        'missionmed-candidate-union-v2',
        context.aliasKey,
      ),
      all_endpoint_opaque_id_sets_stable: endpointStability.every(
        (entry) => entry.opaque_id_set_stable,
      ),
      all_endpoint_candidate_sets_stable: endpointStability.every(
        (entry) => entry.candidate_opaque_id_set_stable,
      ),
    },
    candidate_consumer_projection_reconciliation: reconcileConsumerProjection(
      candidateIds,
      scans,
      context.aliasKey,
    ),
    candidate_three_surface_reconciliation: reconcileCandidateSurfaces(
      candidateIds,
      scans,
      localScan,
      context.aliasKey,
    ),
    local_registry_reconciliation: reconcileLocal(localScan, mergedEntries, context.aliasKey),
    artifact_summary: {
      expected_artifact_count: jobs.length,
      available_count: availableCount,
      rejected_count: rejectedCount,
      absent_from_registry_count: absentCount,
      duplicate_cluster_count: duplicateClusters(inventory).length,
      documented_derivation_only_count: inventory.filter(
        (item) => item.reference_basis === 'documented_runtime_derivation',
      ).length,
      direct_plus_documented_derivation_count: inventory.filter(
        (item) => item.reference_basis === 'direct_plus_documented_runtime_derivation',
      ).length,
      direct_reference_rejected_count: inventory.filter(
        (item) => item.reference_integrity === 'direct_reference_rejected',
      ).length,
      direct_reference_conflict_count: inventory.filter(
        (item) => item.reference_integrity === 'direct_reference_conflict',
      ).length,
      by_artifact_class: artifactClassSummaries(inventory),
    },
    artifact_inventory: inventory,
    duplicate_clusters: duplicateClusters(inventory),
    overclaim_boundaries: [
      'The division predicate defines an unratified candidate universe, not a canonical corpus.',
      'Documented CDN derivation tests artifact presence; it does not ratify source membership.',
      'Two stable opaque-ID observations do not prove historical or upstream completeness.',
      'Artifact availability and structural metrics do not establish speaker identity or authority.',
      'Content hashes and duplicate clusters indicate byte identity only, not semantic equivalence.',
      'No transcript or nodes text, raw registry body, source location, or credential was retained.',
      'No extraction, question generation, medical approval, or production mutation was performed.',
    ],
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  assertSanitizedSerialization(serialized);
  assertRawValuesAbsent(serialized, candidateIds);
  context.aliasKey.fill(0);
  await atomicWriteSanitized(options.output, serialized);
  process.stdout.write(`${JSON.stringify({
    result: 'written',
    network_request_count: context.networkState.requests,
    candidate_count: candidateIds.length,
    available_artifact_count: availableCount,
  })}\n`);
}

function runSelfTest() {
  const networkState = { requests: 0 };
  let checkCount = 0;
  const check = (condition) => {
    checkCount += 1;
    if (!condition) fail('internal_failure');
  };

  assertNetworkTarget(new URL(`https://${RUNTIME_HOST}/videos`), 'GET', 'runtime');
  check(true);
  try {
    assertNetworkTarget(new URL(`https://${RUNTIME_HOST}/videos/detail`), 'GET', 'runtime');
    check(false);
  } catch (error) {
    check(controlledErrorClass(error) === 'runtime_target_rejected');
  }
  try {
    assertNetworkTarget(new URL(`https://${RUNTIME_HOST}/videos`), 'POST', 'runtime');
    check(false);
  } catch (error) {
    check(controlledErrorClass(error) === 'runtime_target_rejected');
  }
  const artifact = validateArtifactReference(`https://${CDN_HOST}/synthetic/transcript.json`);
  check(artifact.hostname === CDN_HOST);
  try {
    validateArtifactReference(`https://${CDN_HOST}/synthetic/transcript.json?search=1`);
    check(false);
  } catch (error) {
    check(controlledErrorClass(error) === 'artifact_reference_rejected');
  }

  const syntheticId = 'synthetic-opaque-id-never-emit';
  const syntheticSpeaker = 'synthetic-speaker-never-emit';
  const aliasKey = Buffer.alloc(32, 7);
  const summary = summarizeRecords([{
    video_id: syntheticId,
    division: 'USMLE',
    transcript_url: `https://${CDN_HOST}/synthetic/transcript.json`,
  }], aliasKey);
  check(summary.statistics.candidate_opaque_id_count === 1);
  check(!JSON.stringify(summary.statistics).includes(syntheticId));
  const differentlyKeyedSummary = summarizeRecords([{
    video_id: syntheticId,
    division: 'USMLE',
  }], Buffer.alloc(32, 8));
  check(
    summary.statistics.opaque_id_set_root
      !== differentlyKeyedSummary.statistics.opaque_id_set_root,
  );
  const derivedArtifact = documentedArtifactReference(syntheticId, 'transcript_json');
  check(typeof derivedArtifact === 'string' && derivedArtifact.includes('/videos/v2/usmle/'));
  const metrics = artifactMetrics([{
    start_time: 1,
    end_time: 2,
    speaker: syntheticSpeaker,
    text: 'synthetic text never emit',
  }], 'transcript_json', aliasKey, syntheticId);
  check(metrics.segment_count === 1 && metrics.timestamp_count === 2);
  check(!JSON.stringify(metrics).includes(syntheticSpeaker));
  try {
    artifactMetrics({
      video_id: 'different-synthetic-id',
      segments: [],
    }, 'transcript_json', aliasKey, syntheticId);
    check(false);
  } catch (error) {
    check(controlledErrorClass(error) === 'entity_binding_mismatch');
  }
  try {
    artifactMetrics({
      data: {
        videoId: 'different-nested-synthetic-id',
        segments: [],
      },
    }, 'transcript_json', aliasKey, syntheticId);
    check(false);
  } catch (error) {
    check(controlledErrorClass(error) === 'entity_binding_mismatch');
  }
  check(networkState.requests === 0);
  aliasKey.fill(0);

  process.stdout.write(`${JSON.stringify({
    mode: 'dry_run',
    result: 'pass',
    network_requests: 0,
    file_writes: 0,
    check_count: checkCount,
  })}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.dryRun) {
    runSelfTest();
    return;
  }
  await runProbe(options);
}

try {
  await main();
} catch (error) {
  const errorClass = error instanceof ProbeError
    ? controlledErrorClass(error)
    : 'internal_failure';
  process.stderr.write(`${JSON.stringify({ result: 'failed', error_class: errorClass })}\n`);
  process.exitCode = 1;
}
