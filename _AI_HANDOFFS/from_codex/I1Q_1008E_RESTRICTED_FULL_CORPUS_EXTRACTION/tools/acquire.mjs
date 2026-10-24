#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import https from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_RESTRICTED_BOUNDARY,
  DEFAULT_WORKTREE_ROOT,
  DEFAULT_ALIAS_MAP_RELATIVE_PATH,
  assertAliasMapIntegrity,
  atomicWriteRestrictedFile,
  getOrCreateOpaqueAlias,
  getOrCreateOpaqueAliases,
  postflightRestrictedBoundary,
  preflightRestrictedBoundary,
  readRestrictedFile,
  readRestrictedJson,
  writeRestrictedJson,
} from './boundary.mjs';
import {
  contentAddressedEnvelope,
  deterministicId,
  sha256,
  stableHash,
  verifyContentAddressedEnvelope,
} from './canonical.mjs';
import { parseArtifactBuffer } from './parsers.mjs';

export const ACQUISITION_SCHEMA = 'missionmed.i1q1008e.restricted_acquisition_state.v1';
export const APPROVED_TARGETS_HASH =
  '98049a4872a62a47e5619f7b98b3db27a9bd9aa1b95641a322835e410d84997a';
export const PREDECESSOR_RECEIPT_SHA256 =
  '2c662642392f7fb4435c05ffb517f73c38bd8530065a3cb9044d2283189a252e';
export const PREDECESSOR_COMMIT = '9af94d976572b20540d006084ef2c34eb3b3b9a5';

const MODULE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTUAL_WORKTREE_ROOT = resolve(MODULE_ROOT, '../../..');
const DEFAULT_TARGETS_RELATIVE_PATH = 'state/acquisition-targets.json';
const DEFAULT_STATE_RELATIVE_PATH = 'state/acquisition-state.json';
const DEFAULT_RECEIPT_RELATIVE_PATH = 'audit/acquisition-receipt.json';
const REVOCATION_RECEIPT_RELATIVE_PATH = 'audit/acquisition-revocation.json';
const BOUNDARY_DECISION_RELATIVE_PATH = 'audit/boundary-decision.json';
const NETWORK_TARGET_APPROVAL_RELATIVE_PATH = 'audit/network-target-approval.json';
const BOUNDARY_DECISION_SHA256 =
  '3a80f9f30d2eb3f51cca470886ed12d8d457b9a83638f1771b1974dd6b1d881f';
export const NETWORK_TARGET_APPROVAL_SHA256 =
  '4030577a7f48969171b8a036844a8aacb9dd837cb47ab8232ce0cd72a33e1b48';
const AUTHORITY_TICKET_SHA256 =
  '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03';
const PREDECESSOR_RECEIPT_PATH = resolve(
  MODULE_ROOT,
  '..',
  'I1Q_1008D_CANONICAL_CORPUS_DISCOVERY',
  'evidence',
  'runtime_corpus_probe.json',
);

const EXPECTED = Object.freeze({
  liveRecords: 313,
  candidates: 105,
  consumerProjection: 97,
  transcripts: 97,
  nodes: 99,
  paired: 97,
  nodesOnly: 2,
  neither: 6,
  documentedDerivationOnly: 12,
  directReferenceRejected: 2,
  directReferenceCorroborated: 196,
  directReferenceConflict: 0,
});
export const APPROVED_NETWORK_TARGET_SEMANTICS = Object.freeze({
  approved_at: '2026-07-17T13:10:53Z',
  expected_denominators: Object.freeze({
    live_records: 313,
    candidate_records: 105,
    consumer_projection: 97,
    transcript_available: 97,
    nodes_available: 99,
    paired: 97,
    nodes_only: 2,
    neither: 6,
  }),
  expected_reference_matrix: Object.freeze({
    direct_reference_corroborated_available: 196,
    documented_derivation_only_not_available: 12,
    direct_reference_rejected_not_available: 2,
    direct_reference_conflict: 0,
  }),
  safe_output_rule:
    'Only aggregate, content-addressed, nonidentifying receipts may cross into the Git-safe handoff tree.',
  revocation_conditions: Object.freeze([
    'boundary or target hash drift',
    'denominator or reference-matrix drift',
    'unexpected redirect, authentication request, or non-404 network failure',
    'permission, alias-map, parser, or provenance-integrity failure',
    'any raw identifier, locator, speaker label, or corpus text detected outside the restricted boundary',
  ]),
});
const DEFAULTS = Object.freeze({
  concurrency: 3,
  delayMs: 300,
  timeoutMs: 15_000,
  maxListBytes: 64 * 1024 * 1024,
  maxArtifactBytes: 32 * 1024 * 1024,
  maxAttempts: 3,
  batchSize: 12,
});
const LIMITS = Object.freeze({
  concurrency: [1, 8],
  delayMs: [100, 5_000],
  timeoutMs: [1_000, 60_000],
  maxListBytes: [1_024, 128 * 1024 * 1024],
  maxArtifactBytes: [1_024, 64 * 1024 * 1024],
  maxAttempts: [1, 4],
  batchSize: [1, 32],
});
const ID_FIELDS = Object.freeze(['video_id', 'videoId', 'id']);
const IDENTITY_FIELDS = Object.freeze([
  'video_id', 'videoId', 'asset_id', 'assetId', 'source_id', 'sourceId',
]);
const TRANSCRIPT_FIELDS = Object.freeze(['transcript_url', 'transcriptUrl']);
const NODES_FIELDS = Object.freeze(['nodes_url', 'nodesUrl']);
const TRANSIENT_CODES = new Set(['timeout', 'transport_failure', 'server_status_rejected']);
const SAFE_CODES = new Set([
  'argument_rejected', 'artifact_identity_mismatch', 'artifact_reference_rejected',
  'approval_rejected', 'approval_revoked', 'body_cap_exceeded', 'boundary_rejected', 'config_rejected',
  'content_encoding_rejected', 'content_length_mismatch', 'content_length_required',
  'corpus_denominator_drift', 'internal_failure', 'json_rejected', 'mime_rejected',
  'not_found', 'pagination_rejected', 'predecessor_hash_mismatch',
  'predecessor_receipt_rejected', 'redirect_rejected', 'resume_state_rejected',
  'schema_rejected', 'server_status_rejected', 'status_rejected', 'timeout',
  'transport_failure',
]);

export class AcquisitionError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'internal_failure';
    super(safeCode);
    this.name = 'AcquisitionError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new AcquisitionError(code);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function parseBoundedInteger(raw, [minimum, maximum]) {
  if (!/^\d+$/u.test(String(raw ?? ''))) fail('argument_rejected');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail('argument_rejected');
  }
  return value;
}

export function parseArgs(argv) {
  const options = {
    ...DEFAULTS,
    boundaryRoot: DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot: DEFAULT_WORKTREE_ROOT,
    dryRun: false,
    help: false,
  };
  const valueOptions = new Map([
    ['--boundary-root', 'boundaryRoot'],
    ['--worktree-root', 'worktreeRoot'],
    ['--concurrency', 'concurrency'],
    ['--delay-ms', 'delayMs'],
    ['--timeout-ms', 'timeoutMs'],
    ['--max-list-bytes', 'maxListBytes'],
    ['--max-artifact-bytes', 'maxArtifactBytes'],
    ['--max-attempts', 'maxAttempts'],
    ['--batch-size', 'batchSize'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (raw === '--dry-run' || raw === '--self-test') {
      options.dryRun = true;
      continue;
    }
    if (raw === '--help' || raw === '-h') {
      options.help = true;
      continue;
    }
    const equalsAt = raw.indexOf('=');
    const flag = equalsAt === -1 ? raw : raw.slice(0, equalsAt);
    if (!valueOptions.has(flag)) fail('argument_rejected');
    const value = equalsAt === -1 ? argv[++index] : raw.slice(equalsAt + 1);
    if (value === undefined || value === '') fail('argument_rejected');
    options[valueOptions.get(flag)] = value;
  }
  for (const key of Object.keys(LIMITS)) options[key] = parseBoundedInteger(options[key], LIMITS[key]);
  return options;
}

function controlledError(error) {
  if (error instanceof AcquisitionError) return error.code;
  if (error?.name === 'BoundaryError') return 'boundary_rejected';
  if (error?.code === 'REQUEST_TIMEOUT') return 'timeout';
  return 'transport_failure';
}

async function revokeAcquisition(context, {
  phase,
  artifactAlias = null,
  controlledErrorClass,
  attemptNumber = null,
}) {
  const state = context?.revocation;
  if (!state) fail('internal_failure');
  if (!state.revoked) {
    state.revoked = true;
    state.phase = phase;
    state.artifactAlias = artifactAlias;
    state.controlledErrorClass = controlledErrorClass;
    state.attemptNumber = attemptNumber;
    state.requestCountAtRevocation = context.network.request_count;
    for (const request of state.activeRequests) {
      request.destroy(new AcquisitionError('approval_revoked'));
    }
    const receipt = contentAddressedEnvelope({
      schema_version: 'missionmed.i1q1008e.restricted_acquisition_revocation.v1',
      receipt_id: deterministicId(
        'receipt', 'acquisition-revocation', phase, artifactAlias,
        controlledErrorClass, state.requestCountAtRevocation,
      ),
      invocation_ordinal: context.invocationOrdinal,
      phase,
      artifact_alias: artifactAlias,
      controlled_error_class: controlledErrorClass,
      attempt_number: attemptNumber,
      network_request_count_at_revocation: state.requestCountAtRevocation,
      no_further_request_starts: true,
      pending_requests_aborted: true,
      raw_error_message_persisted: false,
      raw_identifier_or_locator_persisted: false,
      network_target_approval_sha256: NETWORK_TARGET_APPROVAL_SHA256,
      approved_targets_hash: APPROVED_TARGETS_HASH,
    });
    state.receiptPromise = writeRestrictedJson(REVOCATION_RECEIPT_RELATIVE_PATH, receipt, {
      boundaryRoot: context.options.boundaryRoot,
      worktreeRoot: context.options.worktreeRoot,
    });
  }
  await state.receiptPromise;
}

function requestStartAllowed(revocationContext) {
  return !revocationContext?.revocation?.revoked;
}

export function artifactFailureDisposition({
  stage,
  controlledErrorClass,
  completedAttemptCount = 0,
  failedAttemptCount = 1,
}) {
  if (!['HEAD', 'GET'].includes(stage)
      || !SAFE_CODES.has(controlledErrorClass)
      || !Number.isSafeInteger(completedAttemptCount)
      || completedAttemptCount < 0
      || !Number.isSafeInteger(failedAttemptCount)
      || failedAttemptCount < 1) fail('argument_rejected');
  return Object.freeze({
    availability: stage === 'HEAD' && controlledErrorClass === 'not_found'
      ? 'NOT_AVAILABLE' : 'FAILED_WITH_PROVEN_BLOCKER',
    rejection_stage: stage,
    controlled_error_class: controlledErrorClass,
    attempt_count: completedAttemptCount + failedAttemptCount,
  });
}

export function cumulativeArtifactAttemptCount(priorResult, currentAttemptCount) {
  if (!Number.isSafeInteger(currentAttemptCount) || currentAttemptCount < 1) {
    fail('argument_rejected');
  }
  const priorAttemptCount = priorResult === null || priorResult === undefined
    ? 0 : Number(priorResult.attempt_count);
  if (!Number.isSafeInteger(priorAttemptCount) || priorAttemptCount < 0) {
    fail('resume_state_rejected');
  }
  const total = priorAttemptCount + currentAttemptCount;
  if (!Number.isSafeInteger(total)) fail('resume_state_rejected');
  return total;
}

export function expectedArtifactAvailability(referenceIntegrityClass) {
  if (referenceIntegrityClass === 'DIRECT_REFERENCE_CORROBORATED') return 'AVAILABLE';
  if (referenceIntegrityClass === 'DOCUMENTED_DERIVATION_ONLY'
      || referenceIntegrityClass === 'DIRECT_REFERENCE_REJECTED') return 'NOT_AVAILABLE';
  fail('corpus_denominator_drift');
}

export function artifactHeadTransition(referenceIntegrityClass, observedHeadOutcome) {
  if (!['HEAD_200', 'HEAD_404'].includes(observedHeadOutcome)) fail('argument_rejected');
  const expectedAvailability = expectedArtifactAvailability(referenceIntegrityClass);
  if (observedHeadOutcome === 'HEAD_200') {
    return expectedAvailability === 'AVAILABLE'
      ? 'PROCEED_TO_GET' : 'REVOKE_AVAILABILITY_MISMATCH';
  }
  return expectedAvailability === 'NOT_AVAILABLE'
    ? 'TERMINAL_EXPECTED_ABSENCE' : 'REVOKE_AVAILABILITY_MISMATCH';
}

export function artifactResultExpectationValid(result) {
  if (!isPlainObject(result)) return false;
  try {
    return result.expected_availability
      === expectedArtifactAvailability(result.direct_reference_integrity);
  } catch {
    return false;
  }
}

function assertExactKeys(value, keys) {
  if (!isPlainObject(value)) fail('config_rejected');
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
      || actual.some((key, index) => key !== expected[index])) fail('config_rejected');
}

function parseOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('config_rejected');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
      || url.search || url.hash || url.pathname !== '/') fail('config_rejected');
  return url;
}

function validatePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.includes('?')
      || value.includes('#') || value.includes('\\') || /%2f|%5c/iu.test(value)) {
    fail('config_rejected');
  }
  const parts = value.split('/');
  if (parts.some((part) => part === '.' || part === '..')) fail('config_rejected');
  return value;
}

export function validateTargetsConfig(value) {
  assertExactKeys(value, [
    'schema_version', 'runtime_origin', 'health_path', 'video_registry_path',
    'drill_registry_path', 'artifact_origin', 'artifact_path_template',
    'candidate_division',
  ]);
  if (stableHash(value) !== APPROVED_TARGETS_HASH
      || value.schema_version !== 'missionmed.i1q1008e.restricted_acquisition_targets.v1') {
    fail('config_rejected');
  }
  const runtimeOrigin = parseOrigin(value.runtime_origin);
  const artifactOrigin = parseOrigin(value.artifact_origin);
  const healthPath = validatePath(value.health_path);
  const videoRegistryPath = validatePath(value.video_registry_path);
  const drillRegistryPath = validatePath(value.drill_registry_path);
  const template = validatePath(value.artifact_path_template);
  if ((template.match(/\{id\}/gu) ?? []).length !== 1
      || (template.match(/\{artifact\}/gu) ?? []).length !== 1
      || template.replace('{id}', '').replace('{artifact}', '').includes('{')) fail('config_rejected');
  if (typeof value.candidate_division !== 'string'
      || value.candidate_division !== value.candidate_division.trim().toLowerCase()
      || !/^[a-z0-9_-]{1,32}$/u.test(value.candidate_division)) fail('config_rejected');
  return Object.freeze({
    ...value,
    runtimeOrigin,
    artifactOrigin,
    healthPath,
    videoRegistryPath,
    drillRegistryPath,
    template,
  });
}

const NETWORK_APPROVAL_KEYS = Object.freeze([
  'schema_version', 'ticket', 'approved_at', 'decision', 'authority_scope',
  'boundary_decision_sha256', 'ticket_instruction_sha256',
  'approved_targets_canonical_sha256', 'predecessor_commit',
  'predecessor_receipt_sha256', 'network_controls', 'expected_denominators',
  'expected_reference_matrix', 'safe_output_rule', 'revocation_conditions',
]);

export function validateNetworkTargetApprovalBytes(bytes, {
  expectedByteSha256 = NETWORK_TARGET_APPROVAL_SHA256,
  expectedApprovedTargetsHash = APPROVED_TARGETS_HASH,
} = {}) {
  if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)
      || !/^[a-f0-9]{64}$/u.test(expectedByteSha256)
      || !/^[a-f0-9]{64}$/u.test(expectedApprovedTargetsHash)) fail('approval_rejected');
  const byteHash = sha256(bytes);
  let approval;
  try {
    approval = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    fail('approval_rejected');
  }
  try {
    assertExactKeys(approval, NETWORK_APPROVAL_KEYS);
  } catch {
    fail('approval_rejected');
  }
  let exactNestedSemantics = false;
  try {
    assertExactKeys(approval.network_controls, [
      'methods', 'redirect_policy', 'compression_policy', 'concurrency', 'delay_ms',
      'timeout_ms', 'max_attempts', 'credentials_permitted',
      'unapproved_targets_permitted',
    ]);
    assertExactKeys(
      approval.expected_denominators,
      Object.keys(APPROVED_NETWORK_TARGET_SEMANTICS.expected_denominators),
    );
    assertExactKeys(
      approval.expected_reference_matrix,
      Object.keys(APPROVED_NETWORK_TARGET_SEMANTICS.expected_reference_matrix),
    );
    exactNestedSemantics = true;
  } catch {
    fail('approval_rejected');
  }
  if (byteHash !== expectedByteSha256
      || approval.schema_version !== 'missionmed.i1q1008e.network_target_approval.v1'
      || approval.ticket !== 'I1Q-1008E'
      || approval.approved_at !== APPROVED_NETWORK_TARGET_SEMANTICS.approved_at
      || approval.decision !== 'APPROVED_FOR_RESTRICTED_ACQUISITION_ONLY'
      || approval.authority_scope
        !== 'internal restricted extraction; no release, production mutation, approval decision, or final assessment content'
      || approval.boundary_decision_sha256 !== BOUNDARY_DECISION_SHA256
      || approval.ticket_instruction_sha256 !== AUTHORITY_TICKET_SHA256
      || approval.approved_targets_canonical_sha256 !== expectedApprovedTargetsHash
      || approval.predecessor_commit !== PREDECESSOR_COMMIT
      || approval.predecessor_receipt_sha256 !== PREDECESSOR_RECEIPT_SHA256
      || !exactNestedSemantics
      || !isPlainObject(approval.network_controls)
      || !Array.isArray(approval.network_controls.methods)
      || stableHash([...approval.network_controls.methods].sort()) !== stableHash(['GET', 'HEAD'])
      || approval.network_controls.redirect_policy !== 'REJECT'
      || approval.network_controls.compression_policy !== 'IDENTITY_ONLY'
      || approval.network_controls.concurrency !== DEFAULTS.concurrency
      || approval.network_controls.delay_ms !== DEFAULTS.delayMs
      || approval.network_controls.timeout_ms !== DEFAULTS.timeoutMs
      || approval.network_controls.max_attempts !== DEFAULTS.maxAttempts
      || approval.network_controls.credentials_permitted !== false
      || approval.network_controls.unapproved_targets_permitted !== false
      || stableHash(approval.expected_denominators)
        !== stableHash(APPROVED_NETWORK_TARGET_SEMANTICS.expected_denominators)
      || stableHash(approval.expected_reference_matrix)
        !== stableHash(APPROVED_NETWORK_TARGET_SEMANTICS.expected_reference_matrix)
      || approval.safe_output_rule !== APPROVED_NETWORK_TARGET_SEMANTICS.safe_output_rule
      || stableHash(approval.revocation_conditions)
        !== stableHash(APPROVED_NETWORK_TARGET_SEMANTICS.revocation_conditions)) {
    fail('approval_rejected');
  }
  return Object.freeze({ approval, byte_sha256: byteHash });
}

function runtimeUrl(config, path) {
  if (![config.healthPath, config.videoRegistryPath, config.drillRegistryPath].includes(path)) {
    fail('artifact_reference_rejected');
  }
  const url = new URL(path, config.runtimeOrigin);
  if (url.origin !== config.runtimeOrigin.origin || url.pathname !== path
      || url.search || url.hash) fail('artifact_reference_rejected');
  return url;
}

function normalizeRawId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) return null;
  return normalized;
}

function artifactUrl(config, rawId, artifactClass) {
  if (typeof rawId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._~-]{0,255}$/u.test(rawId)) {
    fail('artifact_reference_rejected');
  }
  const suffix = artifactClass === 'transcript_json'
    ? 'transcript' : artifactClass === 'nodes_json' ? 'nodes' : null;
  if (!suffix) fail('artifact_reference_rejected');
  const path = config.template
    .replace('{id}', encodeURIComponent(rawId))
    .replace('{artifact}', suffix);
  validatePath(path);
  const url = new URL(path, config.artifactOrigin);
  if (url.origin !== config.artifactOrigin.origin || url.pathname !== path
      || url.search || url.hash || !url.pathname.endsWith('.json')) {
    fail('artifact_reference_rejected');
  }
  return url;
}

function headerValue(value) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return typeof value === 'string' ? value : null;
}

function classifyMime(value, allowText = false) {
  if (typeof value !== 'string') fail('mime_rejected');
  const mime = value.split(';', 1)[0].trim().toLowerCase();
  if (mime === 'application/json' || mime === 'text/json' || mime.endsWith('+json')) return 'json';
  if (allowText && mime === 'text/plain') return 'plain_text';
  fail('mime_rejected');
}

function parseContentLength(value, maximumBytes, required) {
  if (value === null) {
    if (required) fail('content_length_required');
    return null;
  }
  if (!/^\d+$/u.test(value)) fail('content_length_required');
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) fail('body_cap_exceeded');
  return length;
}

function createRateLimiter(delayMs) {
  let chain = Promise.resolve();
  let nextStart = 0;
  return {
    take() {
      const slot = chain.then(async () => {
        const wait = Math.max(0, nextStart - Date.now());
        if (wait > 0) await new Promise((resolveWait) => setTimeout(resolveWait, wait));
        nextStart = Date.now() + delayMs;
      });
      chain = slot.catch(() => {});
      return slot;
    },
  };
}

async function requestOnce(url, {
  method, purpose, config, maximumBytes, timeoutMs, limiter, network,
  requireContentLength = false, expectedLength = null,
  allowText = false, revocationContext = null,
}) {
  if (!['GET', 'HEAD'].includes(method)) fail('artifact_reference_rejected');
  if (purpose === 'runtime') runtimeUrl(config, url.pathname);
  else if (purpose === 'artifact') {
    if (url.origin !== config.artifactOrigin.origin || !url.pathname.endsWith('.json')) {
      fail('artifact_reference_rejected');
    }
  } else fail('artifact_reference_rejected');
  if (!requestStartAllowed(revocationContext)) fail('approval_revoked');
  await limiter.take();
  if (!requestStartAllowed(revocationContext)) fail('approval_revoked');
  network.request_count += 1;
  return new Promise((resolveRequest, rejectRequest) => {
    let settled = false;
    let deadline = null;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      revocationContext?.revocation?.activeRequests.delete(request);
      callback(value);
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
        settle(rejectRequest, new AcquisitionError('redirect_rejected'));
        return;
      }
      if (status === 404) {
        response.destroy();
        settle(rejectRequest, new AcquisitionError('not_found'));
        return;
      }
      if (status >= 500 && status <= 599) {
        response.destroy();
        settle(rejectRequest, new AcquisitionError('server_status_rejected'));
        return;
      }
      if (status !== 200) {
        response.destroy();
        settle(rejectRequest, new AcquisitionError('status_rejected'));
        return;
      }
      let declaredLength;
      try {
        const encoding = headerValue(response.headers['content-encoding']);
        if (encoding && encoding.toLowerCase() !== 'identity') fail('content_encoding_rejected');
        classifyMime(headerValue(response.headers['content-type']), allowText);
        declaredLength = parseContentLength(
          headerValue(response.headers['content-length']), maximumBytes, requireContentLength,
        );
        if (expectedLength !== null && declaredLength !== expectedLength) fail('content_length_mismatch');
      } catch (error) {
        response.destroy();
        settle(rejectRequest, error);
        return;
      }
      if (method === 'HEAD') {
        response.resume();
        settle(resolveRequest, { body: null, byteCount: 0, declaredLength });
        return;
      }
      const chunks = [];
      let byteCount = 0;
      response.on('data', (chunk) => {
        if (settled) return;
        byteCount += chunk.length;
        if (byteCount > maximumBytes) {
          response.destroy();
          settle(rejectRequest, new AcquisitionError('body_cap_exceeded'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('error', () => settle(rejectRequest, new AcquisitionError('transport_failure')));
      response.on('end', () => {
        if (declaredLength !== null && declaredLength !== byteCount) {
          settle(rejectRequest, new AcquisitionError('content_length_mismatch'));
          return;
        }
        settle(resolveRequest, {
          body: Buffer.concat(chunks, byteCount), byteCount, declaredLength,
        });
      });
    });
    deadline = setTimeout(() => {
      const error = new Error('controlled timeout');
      error.code = 'REQUEST_TIMEOUT';
      request.destroy(error);
    }, timeoutMs);
    revocationContext?.revocation?.activeRequests.add(request);
    request.on('error', (error) => settle(rejectRequest, error));
    request.end();
  });
}

async function requestWithRetry(url, options, retryEvents, retryContext) {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (!requestStartAllowed(options.revocationContext)) fail('approval_revoked');
    try {
      const result = await requestOnce(url, options);
      if (!requestStartAllowed(options.revocationContext)) fail('approval_revoked');
      return { ...result, attemptCount: attempt };
    } catch (error) {
      const code = controlledError(error);
      if (!requestStartAllowed(options.revocationContext)) {
        const revoked = new AcquisitionError('approval_revoked');
        revoked.attemptCount = attempt;
        throw revoked;
      }
      const retry = TRANSIENT_CODES.has(code) && attempt < options.maxAttempts;
      retryEvents.push({
        phase: retryContext.phase,
        artifact_alias: retryContext.artifactAlias ?? null,
        invocation_ordinal: retryContext.invocationOrdinal,
        attempt_number: attempt,
        controlled_error_class: code,
        recovery_action: retry ? 'BOUNDED_RETRY' : 'NONE',
      });
      if (!retry) {
        const expectedArtifactAbsence = retryContext.phase === 'ARTIFACT_HEAD'
          && code === 'not_found'
          && artifactHeadTransition(
            retryContext.referenceIntegrityClass,
            'HEAD_404',
          ) === 'TERMINAL_EXPECTED_ABSENCE';
        if (!expectedArtifactAbsence) {
          await revokeAcquisition(options.revocationContext, {
            phase: retryContext.phase,
            artifactAlias: retryContext.artifactAlias ?? null,
            controlledErrorClass: code,
            attemptNumber: attempt,
          });
          const revoked = new AcquisitionError('approval_revoked');
          revoked.attemptCount = attempt;
          throw revoked;
        }
        const controlled = new AcquisitionError(code);
        controlled.attemptCount = attempt;
        throw controlled;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, Math.min(2_000, 200 * (2 ** (attempt - 1)))));
    }
  }
  fail('internal_failure');
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
  const containers = [payload, payload.meta, payload.pagination].filter(isPlainObject);
  for (const container of containers) {
    if (container.has_more === true || container.hasMore === true) fail('pagination_rejected');
    for (const key of ['next', 'next_cursor', 'nextCursor']) {
      if (container[key] !== undefined && container[key] !== null && container[key] !== '') {
        fail('pagination_rejected');
      }
    }
    for (const key of ['total', 'total_count', 'totalCount']) {
      if (Number.isFinite(container[key]) && container[key] > recordCount) fail('pagination_rejected');
    }
  }
}

function rawIdFor(record) {
  if (!isPlainObject(record)) return null;
  for (const field of ID_FIELDS) {
    const value = normalizeRawId(record[field]);
    if (value) return value;
  }
  return null;
}

function divisionFor(record) {
  if (typeof record?.division === 'string') return record.division;
  if (isPlainObject(record?.metadata) && typeof record.metadata.division === 'string') {
    return record.metadata.division;
  }
  return null;
}

function referenceValues(record, fields) {
  const output = [];
  for (const container of [record, isPlainObject(record?.metadata) ? record.metadata : null]) {
    if (!container) continue;
    for (const field of fields) {
      if (typeof container[field] === 'string' && container[field].trim()) {
        output.push(container[field].trim());
      }
    }
  }
  return uniqueSorted(output);
}

export function summarizeRegistryPayload(payload, candidateDivision) {
  const records = locateList(payload);
  assertUnpaginated(payload, records.length);
  const entries = new Map();
  let invalidRecordCount = 0;
  for (const record of records) {
    const rawId = rawIdFor(record);
    if (!rawId) {
      invalidRecordCount += 1;
      continue;
    }
    const prior = entries.get(rawId) ?? {
      raw_id: rawId,
      candidate: false,
      transcript_references: [],
      nodes_references: [],
    };
    prior.candidate ||= String(divisionFor(record) ?? '').trim().toLowerCase() === candidateDivision;
    prior.transcript_references = uniqueSorted([
      ...prior.transcript_references, ...referenceValues(record, TRANSCRIPT_FIELDS),
    ]);
    prior.nodes_references = uniqueSorted([
      ...prior.nodes_references, ...referenceValues(record, NODES_FIELDS),
    ]);
    entries.set(rawId, prior);
  }
  return { records, entries, invalidRecordCount };
}

async function readRuntimeList(path, passIndex, config, options, context) {
  const response = await requestWithRetry(runtimeUrl(config, path), {
    method: 'GET', purpose: 'runtime', config,
    maximumBytes: options.maxListBytes, timeoutMs: options.timeoutMs,
    limiter: context.limiter, network: context.network, maxAttempts: options.maxAttempts,
    revocationContext: context,
  }, context.retryEvents, {
    phase: `LIST_PASS_${passIndex}`,
    invocationOrdinal: context.invocationOrdinal,
  });
  let payload;
  let summary;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
    summary = summarizeRegistryPayload(payload, config.candidate_division);
  } catch (error) {
    const code = error instanceof AcquisitionError ? error.code : 'json_rejected';
    await revokeAcquisition(context, {
      phase: `LIST_PASS_${passIndex}_VALIDATION`,
      controlledErrorClass: code,
    });
    fail('approval_revoked');
  }
  const snapshotAlias = await getOrCreateOpaqueAlias(`registry:${path}:pass:${passIndex}`, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot, namespace: 'artifact',
  });
  await atomicWriteRestrictedFile(`raw/${snapshotAlias}.json`, response.body, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  return {
    path_class: path === config.videoRegistryPath ? 'VIDEO_REGISTRY' : 'DRILL_REGISTRY',
    pass_index: passIndex,
    snapshot_artifact_alias: snapshotAlias,
    body_hash: sha256(response.body),
    byte_count: response.byteCount,
    record_count: summary.records.length,
    invalid_record_count: summary.invalidRecordCount,
    entries: summary.entries,
  };
}

function mergeEntries(scans) {
  const merged = new Map();
  for (const scan of scans) {
    for (const [rawId, entry] of scan.entries) {
      const target = merged.get(rawId) ?? {
        raw_id: rawId, candidate: false, transcript_references: [], nodes_references: [],
      };
      target.candidate ||= entry.candidate;
      target.transcript_references = uniqueSorted([
        ...target.transcript_references, ...entry.transcript_references,
      ]);
      target.nodes_references = uniqueSorted([
        ...target.nodes_references, ...entry.nodes_references,
      ]);
      merged.set(rawId, target);
    }
  }
  return merged;
}

function scanStability(scans, pathClass) {
  const selected = scans.filter((scan) => scan.path_class === pathClass);
  if (selected.length !== 2) fail('corpus_denominator_drift');
  const idSets = selected.map((scan) => uniqueSorted([...scan.entries.keys()]));
  if (selected[0].body_hash !== selected[1].body_hash
      || stableHash(idSets[0]) !== stableHash(idSets[1])) fail('corpus_denominator_drift');
  return {
    path_class: pathClass,
    pass_count: 2,
    body_stable: true,
    id_set_stable: true,
    record_count: selected[0].record_count,
    snapshot_artifact_aliases: selected.map((scan) => scan.snapshot_artifact_alias),
    body_hashes: selected.map((scan) => scan.body_hash),
  };
}

function collectIdentity(payload, maximumVisited = 2_000_000) {
  const identities = new Set();
  let visited = 0;
  const walk = (value, depth = 0) => {
    if (depth > 64 || visited > maximumVisited) fail('schema_rejected');
    visited += 1;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, depth + 1);
      return;
    }
    if (!isPlainObject(value)) return;
    for (const field of IDENTITY_FIELDS) {
      const identity = normalizeRawId(value[field]);
      if (identity) identities.add(identity);
    }
    for (const child of Object.values(value)) {
      if (Array.isArray(child) || isPlainObject(child)) walk(child, depth + 1);
    }
  };
  walk(payload);
  return identities;
}

function directReferenceIntegrity(references, derivedUrl) {
  let rejected = 0;
  const accepted = new Set();
  for (const raw of references) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password || url.port
          || url.search || url.hash || url.href !== derivedUrl.href) rejected += 1;
      else accepted.add(url.href);
    } catch {
      rejected += 1;
    }
  }
  if (rejected > 0) return 'DIRECT_REFERENCE_REJECTED';
  if (accepted.size === 0) return 'DOCUMENTED_DERIVATION_ONLY';
  if (accepted.size === 1 && accepted.has(derivedUrl.href)) return 'DIRECT_REFERENCE_CORROBORATED';
  return 'DIRECT_REFERENCE_CONFLICT';
}

async function reusableResult(job, prior, config, options) {
  const referenceIntegrityClass = directReferenceIntegrity(
    job.directReferences, artifactUrl(config, job.rawId, job.artifactClass),
  );
  const expectedAvailability = expectedArtifactAvailability(referenceIntegrityClass);
  if (!prior || prior.availability !== 'AVAILABLE' || prior.artifact_alias !== job.artifactAlias
      || prior.artifact_class !== job.artifactClass || prior.raw_id !== job.rawId
      || prior.source_alias !== job.sourceAlias
      || prior.canonical_locator !== artifactUrl(config, job.rawId, job.artifactClass).href
      || prior.direct_reference_integrity !== referenceIntegrityClass
      || prior.expected_availability !== expectedAvailability) return null;
  try {
    const body = await readRestrictedFile(`raw/${job.artifactAlias}.json`, {
      boundaryRoot: options.boundaryRoot,
      worktreeRoot: options.worktreeRoot,
      maximumBytes: options.maxArtifactBytes,
    });
    if (sha256(body) !== prior.content_hash || body.length !== prior.byte_count) return null;
    parseArtifactBuffer(body, job.artifactClass, prior.content_hash);
    const payload = JSON.parse(body.toString('utf8'));
    const identities = collectIdentity(payload);
    if ([...identities].some((identity) => identity !== job.rawId)) return null;
    return { ...prior, resume_reused: true };
  } catch {
    return null;
  }
}

async function acquireArtifact(job, config, options, context, prior) {
  const reusable = await reusableResult(job, prior, config, options);
  if (reusable) return reusable;
  const priorAttemptCount = prior ? Number(prior.attempt_count) : 0;
  if (!Number.isSafeInteger(priorAttemptCount) || priorAttemptCount < 0) {
    fail('resume_state_rejected');
  }
  const url = artifactUrl(config, job.rawId, job.artifactClass);
  const referenceIntegrityClass = directReferenceIntegrity(job.directReferences, url);
  const expectedAvailability = expectedArtifactAvailability(referenceIntegrityClass);
  const base = {
    raw_id: job.rawId,
    source_alias: job.sourceAlias,
    artifact_alias: job.artifactAlias,
    artifact_class: job.artifactClass,
    canonical_locator: url.href,
    direct_reference_integrity: referenceIntegrityClass,
    expected_availability: expectedAvailability,
  };
  let head;
  try {
    head = await requestWithRetry(url, {
      method: 'HEAD', purpose: 'artifact', config,
      maximumBytes: options.maxArtifactBytes, timeoutMs: options.timeoutMs,
      limiter: context.limiter, network: context.network, maxAttempts: options.maxAttempts,
      requireContentLength: true,
      revocationContext: context,
    }, context.retryEvents, {
      phase: 'ARTIFACT_HEAD', artifactAlias: job.artifactAlias,
      invocationOrdinal: context.invocationOrdinal,
      referenceIntegrityClass,
    });
  } catch (error) {
    if (context.revocation.revoked || error?.code === 'approval_revoked') throw error;
    const code = controlledError(error);
    return {
      ...base,
      ...artifactFailureDisposition({
        stage: 'HEAD', controlledErrorClass: code,
        completedAttemptCount: priorAttemptCount,
        failedAttemptCount: Number(error?.attemptCount ?? 1),
      }),
    };
  }
  if (artifactHeadTransition(referenceIntegrityClass, 'HEAD_200')
      !== 'PROCEED_TO_GET') {
    await revokeAcquisition(context, {
      phase: 'ARTIFACT_HEAD_AVAILABILITY_VALIDATION',
      artifactAlias: job.artifactAlias,
      controlledErrorClass: 'corpus_denominator_drift',
      attemptNumber: head.attemptCount,
    });
    fail('approval_revoked');
  }
  let response;
  try {
    response = await requestWithRetry(url, {
      method: 'GET', purpose: 'artifact', config,
      maximumBytes: options.maxArtifactBytes, timeoutMs: options.timeoutMs,
      limiter: context.limiter, network: context.network, maxAttempts: options.maxAttempts,
      requireContentLength: true, expectedLength: head.declaredLength,
      revocationContext: context,
    }, context.retryEvents, {
      phase: 'ARTIFACT_GET', artifactAlias: job.artifactAlias,
      invocationOrdinal: context.invocationOrdinal,
    });
  } catch (error) {
    if (context.revocation.revoked || error?.code === 'approval_revoked') throw error;
    return {
      ...base,
      ...artifactFailureDisposition({
        stage: 'GET', controlledErrorClass: controlledError(error),
        completedAttemptCount: priorAttemptCount + head.attemptCount,
        failedAttemptCount: Number(error?.attemptCount ?? 1),
      }),
      declared_byte_count: head.declaredLength,
    };
  }
  const contentHash = sha256(response.body);
  let payload;
  let parsed;
  try {
    payload = JSON.parse(response.body.toString('utf8'));
    parsed = parseArtifactBuffer(response.body, job.artifactClass, contentHash);
    const identities = collectIdentity(payload);
    if ([...identities].some((identity) => identity !== job.rawId)) fail('artifact_identity_mismatch');
  } catch (error) {
    await atomicWriteRestrictedFile(`quarantine/${job.artifactAlias}.json`, response.body, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    await revokeAcquisition(context, {
      phase: 'ARTIFACT_VALIDATION',
      artifactAlias: job.artifactAlias,
      controlledErrorClass: error instanceof AcquisitionError ? error.code : 'schema_rejected',
      attemptNumber: head.attemptCount + response.attemptCount,
    });
    fail('approval_revoked');
  }
  await atomicWriteRestrictedFile(`raw/${job.artifactAlias}.json`, response.body, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  return {
    ...base,
    availability: 'AVAILABLE',
    content_hash: contentHash,
    byte_count: response.byteCount,
    parser_version: parsed.parser_version,
    schema_class: parsed.schema_class,
    primary_record_count: parsed.record_count,
    records_with_text_count: parsed.records_with_text_count,
    records_with_timestamp_count: parsed.records_with_timestamp_count,
    identity_binding: collectIdentity(payload).size > 0 ? 'LOCATOR_AND_PAYLOAD' : 'LOCATOR_ONLY',
    attempt_count: cumulativeArtifactAttemptCount(
      prior, head.attemptCount + response.attemptCount,
    ),
    resume_reused: false,
  };
}

async function acquireArtifactSafely(job, config, options, context, prior) {
  try {
    return await acquireArtifact(job, config, options, context, prior);
  } catch (error) {
    if (context.revocation.revoked || error?.code === 'approval_revoked') throw error;
    try {
      await revokeAcquisition(context, {
        phase: error?.name === 'BoundaryError'
          ? 'ARTIFACT_BOUNDARY_WRITE' : 'ARTIFACT_WORKER',
        artifactAlias: job.artifactAlias,
        controlledErrorClass: controlledError(error),
      });
    } catch {
      // The abort flag and active-request destruction happen before protected
      // receipt persistence, so a boundary write failure cannot reopen I/O.
    }
    throw error;
  }
}

export async function mapLimitFailFast(items, limit, worker, { abortState = null } = {}) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      if (abortState?.revoked) return;
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function predecessorHashSets() {
  const bytes = await readFile(PREDECESSOR_RECEIPT_PATH);
  if (sha256(bytes) !== PREDECESSOR_RECEIPT_SHA256) fail('predecessor_receipt_rejected');
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('predecessor_receipt_rejected');
  }
  const result = { transcript_json: [], nodes_json: [] };
  for (const item of receipt.artifact_inventory ?? []) {
    if (item.availability !== 'available') continue;
    if (!(item.artifact_class in result) || !/^[a-f0-9]{64}$/u.test(item.receipt?.content_hash ?? '')) {
      fail('predecessor_receipt_rejected');
    }
    result[item.artifact_class].push(item.receipt.content_hash);
  }
  result.transcript_json = uniqueSorted(result.transcript_json);
  result.nodes_json = uniqueSorted(result.nodes_json);
  if (result.transcript_json.length !== EXPECTED.transcripts
      || result.nodes_json.length !== EXPECTED.nodes
      || new Set([...result.transcript_json, ...result.nodes_json]).size
        !== EXPECTED.transcripts + EXPECTED.nodes) fail('predecessor_receipt_rejected');
  return result;
}

function exactHashSetMatch(results, expected) {
  const actual = uniqueSorted(results.filter((item) => item.availability === 'AVAILABLE')
    .map((item) => item.content_hash));
  return actual.length === expected.length && actual.every((hash, index) => hash === expected[index]);
}

function artifactCounts(results) {
  const transcripts = results.filter((item) => item.artifact_class === 'transcript_json');
  const nodes = results.filter((item) => item.artifact_class === 'nodes_json');
  const bySource = new Map();
  for (const item of results) {
    const row = bySource.get(item.source_alias) ?? { transcript: false, nodes: false };
    if (item.artifact_class === 'transcript_json') row.transcript = item.availability === 'AVAILABLE';
    else row.nodes = item.availability === 'AVAILABLE';
    bySource.set(item.source_alias, row);
  }
  return {
    transcript_available: transcripts.filter((item) => item.availability === 'AVAILABLE').length,
    nodes_available: nodes.filter((item) => item.availability === 'AVAILABLE').length,
    paired: [...bySource.values()].filter((row) => row.transcript && row.nodes).length,
    nodes_only: [...bySource.values()].filter((row) => !row.transcript && row.nodes).length,
    neither: [...bySource.values()].filter((row) => !row.transcript && !row.nodes).length,
  };
}

function buildRoster(candidateIds, sourceAliases, results, predecessorSets) {
  const byKey = new Map(results.map((item) => [`${item.raw_id}\0${item.artifact_class}`, item]));
  return candidateIds.map((rawId, index) => {
    const transcript = byKey.get(`${rawId}\0transcript_json`);
    const nodes = byKey.get(`${rawId}\0nodes_json`);
    return {
      roster_position: index + 1,
      raw_id: rawId,
      source_alias: sourceAliases[index],
      transcript_artifact_alias: transcript.artifact_alias,
      transcript_locator: transcript.canonical_locator,
      transcript_hash: transcript.content_hash ?? null,
      transcript_availability: transcript.availability,
      transcript_predecessor_hash_match: transcript.content_hash
        ? predecessorSets.transcript_json.includes(transcript.content_hash) : false,
      nodes_artifact_alias: nodes.artifact_alias,
      nodes_locator: nodes.canonical_locator,
      nodes_hash: nodes.content_hash ?? null,
      nodes_availability: nodes.availability,
      nodes_predecessor_hash_match: nodes.content_hash
        ? predecessorSets.nodes_json.includes(nodes.content_hash) : false,
      processing_status: 'PENDING_EXTRACTION',
    };
  });
}

async function writeState(state, options) {
  const envelope = contentAddressedEnvelope(state);
  await writeRestrictedJson(DEFAULT_STATE_RELATIVE_PATH, envelope, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  return envelope;
}

async function loadPriorState(options) {
  try {
    const state = await readRestrictedJson(DEFAULT_STATE_RELATIVE_PATH, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
    if (!verifyContentAddressedEnvelope(state)
        || state.schema_version !== ACQUISITION_SCHEMA
        || state.approved_targets_hash !== APPROVED_TARGETS_HASH
        || state.predecessor_commit !== PREDECESSOR_COMMIT
        || state.predecessor_receipt_sha256 !== PREDECESSOR_RECEIPT_SHA256
        || state.network_target_approval_sha256 !== NETWORK_TARGET_APPROVAL_SHA256
        || typeof state.extraction_run_id !== 'string'
        || !Array.isArray(state.raw_candidate_ids)
        || !Array.isArray(state.consumer_projection_raw_ids)
        || !Array.isArray(state.artifact_results)
        || !Array.isArray(state.retry_events)
        || !Number.isSafeInteger(state.acquisition_invocation_ordinal)
        || state.acquisition_invocation_ordinal < 1
        || !Number.isSafeInteger(state.acquisition_cursor)
        || typeof state.acquisition_complete !== 'boolean') fail('resume_state_rejected');
    return state;
  } catch (error) {
    if (error?.code === 'boundary_missing') return null;
    if (error instanceof AcquisitionError) throw error;
    if (error?.name === 'BoundaryError' && error.code === 'boundary_missing') return null;
    throw error;
  }
}

function executionControls(options) {
  return {
    methods: ['GET', 'HEAD'], redirect_policy: 'REJECT', compression_policy: 'IDENTITY_ONLY',
    concurrency: options.concurrency, delay_ms: options.delayMs, timeout_ms: options.timeoutMs,
    max_list_bytes: options.maxListBytes, max_artifact_bytes: options.maxArtifactBytes,
    max_attempts: options.maxAttempts, batch_size: options.batchSize,
  };
}

function exactSortedUnique(values, expected) {
  return Array.isArray(values)
    && values.length === new Set(values).size
    && values.every((value, index) => value === [...values].sort()[index])
    && stableHash(values) === stableHash(expected);
}

function referenceIntegrityCounts(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function assertExpectedReferenceBasis(jobs, config) {
  const values = jobs.map((job) => directReferenceIntegrity(
    job.directReferences, artifactUrl(config, job.rawId, job.artifactClass),
  ));
  const counts = referenceIntegrityCounts(values);
  if ((counts.get('DIRECT_REFERENCE_CORROBORATED') ?? 0) !== EXPECTED.directReferenceCorroborated
      || (counts.get('DOCUMENTED_DERIVATION_ONLY') ?? 0) !== EXPECTED.documentedDerivationOnly
      || (counts.get('DIRECT_REFERENCE_REJECTED') ?? 0) !== EXPECTED.directReferenceRejected
      || (counts.get('DIRECT_REFERENCE_CONFLICT') ?? 0) !== EXPECTED.directReferenceConflict
      || [...counts.values()].reduce((sum, value) => sum + value, 0) !== jobs.length) {
    fail('corpus_denominator_drift');
  }
}

function assertExpectedFinalMatrix(results) {
  if (results.some((item) => !artifactResultExpectationValid(item))) {
    fail('corpus_denominator_drift');
  }
  const matrix = referenceIntegrityCounts(results.map(
    (item) => `${item.direct_reference_integrity}:${item.availability}`,
  ));
  const expected = new Map([
    ['DIRECT_REFERENCE_CORROBORATED:AVAILABLE', EXPECTED.directReferenceCorroborated],
    ['DOCUMENTED_DERIVATION_ONLY:NOT_AVAILABLE', EXPECTED.documentedDerivationOnly],
    ['DIRECT_REFERENCE_REJECTED:NOT_AVAILABLE', EXPECTED.directReferenceRejected],
  ]);
  if (matrix.size !== expected.size
      || [...expected].some(([key, count]) => matrix.get(key) !== count)
      || results.filter((item) => item.availability === 'NOT_AVAILABLE').some((item) => (
        item.rejection_stage !== 'HEAD' || item.controlled_error_class !== 'not_found'
      ))) fail('corpus_denominator_drift');
  const identity = referenceIntegrityCounts(results.filter(
    (item) => item.availability === 'AVAILABLE',
  ).map((item) => `${item.artifact_class}:${item.identity_binding}`));
  if (identity.size !== 3
      || identity.get('transcript_json:LOCATOR_AND_PAYLOAD') !== 97
      || identity.get('nodes_json:LOCATOR_AND_PAYLOAD') !== 97
      || identity.get('nodes_json:LOCATOR_ONLY') !== 2) fail('artifact_identity_mismatch');
}

function validRetryEvents(events, jobs, options, maximumInvocationOrdinal) {
  const aliases = new Set(jobs.map((job) => job.artifactAlias));
  const eventKeys = new Set();
  return events.every((event) => {
    if (!event || typeof event.phase !== 'string') return false;
    const key = `${event.phase}\0${event.artifact_alias ?? ''}\0${event.invocation_ordinal}\0${event.attempt_number}`;
    if (eventKeys.has(key)) return false;
    eventKeys.add(key);
    return (
    (event.artifact_alias === null || aliases.has(event.artifact_alias))
    && Number.isSafeInteger(event.invocation_ordinal)
    && event.invocation_ordinal >= 1
    && event.invocation_ordinal <= maximumInvocationOrdinal
    && Number.isSafeInteger(event.attempt_number)
    && event.attempt_number >= 1
    && event.attempt_number <= options.maxAttempts
    && SAFE_CODES.has(event.controlled_error_class)
    && ['BOUNDED_RETRY', 'NONE'].includes(event.recovery_action)
    );
  });
}

function validatePriorStateAgainstRun(state, {
  candidateIds, drillIds, jobs, extractionRunId, config, options,
  aliasMapHash, boundaryDecisionHash, networkTargetApprovalHash,
}) {
  if (!state) return;
  if (state.extraction_run_id !== extractionRunId
      || state.alias_map_sha256 !== aliasMapHash
      || state.boundary_decision_sha256 !== boundaryDecisionHash
      || state.network_target_approval_sha256 !== networkTargetApprovalHash
      || stableHash(state.execution_controls) !== stableHash(executionControls(options))
      || !exactSortedUnique(state.raw_candidate_ids, candidateIds)
      || !exactSortedUnique(state.consumer_projection_raw_ids, drillIds)
      || state.consumer_projection_raw_ids.some((id) => !state.raw_candidate_ids.includes(id))
      || state.artifact_results.length !== state.acquisition_cursor
      || state.acquisition_cursor < 0
      || state.acquisition_cursor > jobs.length
      || !validRetryEvents(
        state.retry_events, jobs, options, state.acquisition_invocation_ordinal,
      )) fail('resume_state_rejected');
  const expectedByKey = new Map(jobs.map((job) => [`${job.rawId}\0${job.artifactClass}`, job]));
  const seenKeys = new Set();
  const seenAliases = new Set();
  for (const item of state.artifact_results) {
    const key = `${item.raw_id}\0${item.artifact_class}`;
    const job = expectedByKey.get(key);
    const expectedReferenceIntegrity = job ? directReferenceIntegrity(
      job.directReferences, artifactUrl(config, job.rawId, job.artifactClass),
    ) : null;
    if (!job || seenKeys.has(key) || seenAliases.has(item.artifact_alias)
        || item.source_alias !== job.sourceAlias
        || item.artifact_alias !== job.artifactAlias
        || item.canonical_locator !== artifactUrl(config, job.rawId, job.artifactClass).href
        || item.direct_reference_integrity !== expectedReferenceIntegrity
        || !artifactResultExpectationValid(item)
        || !Number.isSafeInteger(item.attempt_count)
        || item.attempt_count < 1
        ) fail('resume_state_rejected');
    seenKeys.add(key);
    seenAliases.add(item.artifact_alias);
    if (item.availability === 'AVAILABLE') {
      if (!/^[a-f0-9]{64}$/u.test(item.content_hash ?? '')
          || !Number.isSafeInteger(item.byte_count) || item.byte_count < 0
          || typeof item.parser_version !== 'string'
          || !Number.isSafeInteger(item.primary_record_count)
          || !['LOCATOR_AND_PAYLOAD', 'LOCATOR_ONLY'].includes(item.identity_binding)) {
        fail('resume_state_rejected');
      }
    } else if (item.availability === 'NOT_AVAILABLE') {
      if (item.rejection_stage !== 'HEAD' || item.controlled_error_class !== 'not_found') {
        fail('resume_state_rejected');
      }
    } else if (item.availability === 'FAILED_WITH_PROVEN_BLOCKER') {
      if (!['HEAD', 'GET', 'LOCATOR_OR_WORKER'].includes(item.rejection_stage)
          || !SAFE_CODES.has(item.controlled_error_class)) fail('resume_state_rejected');
    } else if (item.availability === 'QUARANTINED') {
      if (item.rejection_stage !== 'VALIDATION'
          || !/^[a-f0-9]{64}$/u.test(item.content_hash ?? '')) fail('resume_state_rejected');
    } else fail('resume_state_rejected');
  }
  if (state.acquisition_complete) {
    if (state.artifact_results.length !== jobs.length
        || !Array.isArray(state.roster) || state.roster.length !== EXPECTED.candidates
        || state.predecessor_class_hash_set_match?.transcript_json !== true
        || state.predecessor_class_hash_set_match?.nodes_json !== true) fail('resume_state_rejected');
    assertExpectedFinalMatrix(state.artifact_results);
    const counts = artifactCounts(state.artifact_results);
    if (stableHash(counts) !== stableHash(state.denominator_counts)) fail('resume_state_rejected');
  }
}

export async function runAcquisition(options) {
  if (resolve(options.boundaryRoot) !== resolve(DEFAULT_RESTRICTED_BOUNDARY)
      || resolve(options.worktreeRoot) !== ACTUAL_WORKTREE_ROOT) fail('boundary_rejected');
  await preflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
  });
  const boundaryDecisionBytes = await readRestrictedFile(BOUNDARY_DECISION_RELATIVE_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
    maximumBytes: 1024 * 1024,
  });
  const boundaryDecisionHash = sha256(boundaryDecisionBytes);
  let boundaryDecision;
  try {
    boundaryDecision = JSON.parse(boundaryDecisionBytes.toString('utf8'));
  } catch {
    fail('boundary_rejected');
  }
  if (boundaryDecisionHash !== BOUNDARY_DECISION_SHA256
      || boundaryDecision.schema_version !== 'missionmed.i1q.1008e.restricted_boundary_decision.v1'
      || boundaryDecision.mission_id !== 'I1Q-1008E'
      || boundaryDecision.authority?.ticket_sha256
        !== '99a5c0d9f13c77fbcd20fbd57a6e1186fdf467f35e3657269fe99b23efeddb03'
      || boundaryDecision.sentinel_verdict !== 'SIGNOFF_WITH_CONDITIONS'
      || boundaryDecision.keys_directory_policy !== 'MUST_REMAIN_EMPTY'
      || boundaryDecision.release_authority !== false
      || boundaryDecision.medical_approval_authority !== false
      || boundaryDecision.student_access_authority !== false) fail('boundary_rejected');
  const networkTargetApproval = validateNetworkTargetApprovalBytes(
    await readRestrictedFile(NETWORK_TARGET_APPROVAL_RELATIVE_PATH, {
      boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
      maximumBytes: 1024 * 1024,
    }),
  );
  if (options.concurrency !== networkTargetApproval.approval.network_controls.concurrency
      || options.delayMs !== networkTargetApproval.approval.network_controls.delay_ms
      || options.timeoutMs !== networkTargetApproval.approval.network_controls.timeout_ms
      || options.maxAttempts !== networkTargetApproval.approval.network_controls.max_attempts) {
    fail('approval_rejected');
  }
  const config = validateTargetsConfig(await readRestrictedJson(DEFAULT_TARGETS_RELATIVE_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
  }));
  const predecessorSets = await predecessorHashSets();
  const priorState = await loadPriorState(options);
  const invocationOrdinal = Number(priorState?.acquisition_invocation_ordinal ?? 0) + 1;
  if (!Number.isSafeInteger(invocationOrdinal) || invocationOrdinal < 1) {
    fail('resume_state_rejected');
  }
  const context = {
    limiter: createRateLimiter(options.delayMs),
    network: { request_count: 0 },
    retryEvents: [...(priorState?.retry_events ?? [])],
    invocationOrdinal,
    options,
    revocation: {
      revoked: false,
      activeRequests: new Set(),
      receiptPromise: null,
    },
  };
  const health = await requestWithRetry(runtimeUrl(config, config.healthPath), {
    method: 'GET', purpose: 'runtime', config,
    maximumBytes: 64 * 1024, timeoutMs: options.timeoutMs,
    limiter: context.limiter, network: context.network, maxAttempts: options.maxAttempts,
    allowText: true, revocationContext: context,
  }, context.retryEvents, { phase: 'HEALTH', invocationOrdinal });
  const scans = [];
  for (let passIndex = 1; passIndex <= 2; passIndex += 1) {
    scans.push(await readRuntimeList(config.videoRegistryPath, passIndex, config, options, context));
    scans.push(await readRuntimeList(config.drillRegistryPath, passIndex, config, options, context));
  }
  const videoStability = scanStability(scans, 'VIDEO_REGISTRY');
  const drillStability = scanStability(scans, 'DRILL_REGISTRY');
  const merged = mergeEntries(scans);
  const candidateIds = [...merged.values()].filter((entry) => entry.candidate)
    .map((entry) => entry.raw_id).sort();
  const drillIds = uniqueSorted([...scans.find((scan) => (
    scan.path_class === 'DRILL_REGISTRY' && scan.pass_index === 1
  )).entries.keys()]);
  if (videoStability.record_count !== EXPECTED.liveRecords
      || candidateIds.length !== EXPECTED.candidates
      || drillIds.length !== EXPECTED.consumerProjection) fail('corpus_denominator_drift');

  const sourceAliases = await getOrCreateOpaqueAliases(candidateIds, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot, namespace: 'source',
  });
  const artifactRawKeys = candidateIds.flatMap((rawId) => [
    `transcript_json:${rawId}`, `nodes_json:${rawId}`,
  ]);
  const artifactAliases = await getOrCreateOpaqueAliases(artifactRawKeys, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot, namespace: 'artifact',
  });
  const extractionRunId = await getOrCreateOpaqueAlias('I1Q-1008E-observed-corpus-run', {
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot, namespace: 'run',
  });
  const jobs = [];
  let aliasIndex = 0;
  for (let index = 0; index < candidateIds.length; index += 1) {
    const rawId = candidateIds[index];
    const entry = merged.get(rawId);
    for (const [artifactClass, references] of [
      ['transcript_json', entry.transcript_references],
      ['nodes_json', entry.nodes_references],
    ]) {
      jobs.push({
        rawId,
        sourceAlias: sourceAliases[index],
        artifactAlias: artifactAliases[aliasIndex++],
        artifactClass,
        directReferences: references,
      });
    }
  }
  assertExpectedReferenceBasis(jobs, config);
  const aliasMapHash = sha256(await readRestrictedFile(DEFAULT_ALIAS_MAP_RELATIVE_PATH, {
    boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT,
    maximumBytes: 16 * 1024 * 1024,
  }));
  validatePriorStateAgainstRun(priorState, {
    candidateIds, drillIds, jobs, extractionRunId, config, options,
    aliasMapHash, boundaryDecisionHash,
    networkTargetApprovalHash: networkTargetApproval.byte_sha256,
  });
  const priorByKey = new Map((priorState?.artifact_results ?? []).map((item) => [
    `${item.raw_id}\0${item.artifact_class}`, item,
  ]));
  const results = [];
  for (let offset = 0; offset < jobs.length; offset += options.batchSize) {
    const batch = jobs.slice(offset, offset + options.batchSize);
    const batchResults = await mapLimitFailFast(batch, options.concurrency, (job) => (
      acquireArtifactSafely(
        job, config, options, context, priorByKey.get(`${job.rawId}\0${job.artifactClass}`),
      )
    ), { abortState: context.revocation });
    results.push(...batchResults);
    const interimState = {
      schema_version: ACQUISITION_SCHEMA,
      extraction_run_id: extractionRunId,
      approved_targets_hash: APPROVED_TARGETS_HASH,
      predecessor_commit: PREDECESSOR_COMMIT,
      predecessor_receipt_sha256: PREDECESSOR_RECEIPT_SHA256,
      boundary_decision_sha256: boundaryDecisionHash,
      network_target_approval_sha256: networkTargetApproval.byte_sha256,
      alias_map_sha256: aliasMapHash,
      execution_controls: executionControls(options),
      runtime_receipts: {
        health_body_hash: sha256(health.body),
        health_byte_count: health.byteCount,
        video_stability: videoStability,
        drill_stability: drillStability,
      },
      raw_candidate_ids: candidateIds,
      consumer_projection_raw_ids: drillIds,
      artifact_results: results,
      retry_events: context.retryEvents,
      acquisition_invocation_ordinal: invocationOrdinal,
      acquisition_cursor: Math.min(jobs.length, offset + batch.length),
      acquisition_complete: false,
    };
    await writeState(interimState, options);
    await postflightRestrictedBoundary({
      boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
    });
  }
  results.sort((left, right) => (
    `${left.source_alias}:${left.artifact_class}`.localeCompare(`${right.source_alias}:${right.artifact_class}`)
  ));
  const counts = artifactCounts(results);
  const transcriptResults = results.filter((item) => item.artifact_class === 'transcript_json');
  const nodesResults = results.filter((item) => item.artifact_class === 'nodes_json');
  const transcriptHashMatch = exactHashSetMatch(transcriptResults, predecessorSets.transcript_json);
  const nodesHashMatch = exactHashSetMatch(nodesResults, predecessorSets.nodes_json);
  const denominatorsMatch = counts.transcript_available === EXPECTED.transcripts
    && counts.nodes_available === EXPECTED.nodes
    && counts.paired === EXPECTED.paired
    && counts.nodes_only === EXPECTED.nodesOnly
    && counts.neither === EXPECTED.neither;
  assertExpectedFinalMatrix(results);
  const roster = buildRoster(candidateIds, sourceAliases, results, predecessorSets);
  const finalState = {
    schema_version: ACQUISITION_SCHEMA,
    extraction_run_id: extractionRunId,
    approved_targets_hash: APPROVED_TARGETS_HASH,
    predecessor_commit: PREDECESSOR_COMMIT,
    predecessor_receipt_sha256: PREDECESSOR_RECEIPT_SHA256,
    boundary_decision_sha256: boundaryDecisionHash,
    network_target_approval_sha256: networkTargetApproval.byte_sha256,
    alias_map_sha256: aliasMapHash,
    execution_controls: executionControls(options),
    runtime_receipts: {
      health_body_hash: sha256(health.body), health_byte_count: health.byteCount,
      video_stability: videoStability, drill_stability: drillStability,
      network_request_count: context.network.request_count,
    },
    raw_candidate_ids: candidateIds,
    consumer_projection_raw_ids: drillIds,
    roster,
    artifact_results: results,
    retry_events: context.retryEvents,
    acquisition_invocation_ordinal: invocationOrdinal,
    acquisition_cursor: jobs.length,
    acquisition_complete: denominatorsMatch && transcriptHashMatch && nodesHashMatch,
    denominator_counts: counts,
    predecessor_class_hash_set_match: {
      transcript_json: transcriptHashMatch,
      nodes_json: nodesHashMatch,
    },
  };
  const persistedFinalState = await writeState(finalState, options);
  await writeRestrictedJson(DEFAULT_RECEIPT_RELATIVE_PATH, contentAddressedEnvelope({
    schema_version: 'missionmed.i1q1008e.restricted_acquisition_receipt.v1',
    extraction_run_id: extractionRunId,
    approved_targets_hash: APPROVED_TARGETS_HASH,
    predecessor_commit: PREDECESSOR_COMMIT,
    predecessor_receipt_sha256: PREDECESSOR_RECEIPT_SHA256,
    boundary_decision_sha256: boundaryDecisionHash,
    network_target_approval_sha256: networkTargetApproval.byte_sha256,
    alias_map_sha256: aliasMapHash,
    acquisition_state_hash: persistedFinalState.content_hash,
    candidate_count: candidateIds.length,
    consumer_projection_count: drillIds.length,
    counts,
    predecessor_class_hash_set_match: finalState.predecessor_class_hash_set_match,
    artifact_result_root: stableHash(results.map((item) => ({
      artifact_alias: item.artifact_alias,
      artifact_class: item.artifact_class,
      direct_reference_integrity: item.direct_reference_integrity,
      expected_availability: item.expected_availability,
      availability: item.availability,
      content_hash: item.content_hash ?? null,
    }))),
    retry_count: context.retryEvents.filter((item) => item.recovery_action === 'BOUNDED_RETRY').length,
    acquisition_invocation_ordinal: invocationOrdinal,
    acquisition_complete: finalState.acquisition_complete,
  }), { boundaryRoot: options.boundaryRoot, worktreeRoot: ACTUAL_WORKTREE_ROOT });
  await assertAliasMapIntegrity({
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  await postflightRestrictedBoundary({
    boundaryRoot: options.boundaryRoot, worktreeRoot: options.worktreeRoot,
  });
  if (!denominatorsMatch) fail('corpus_denominator_drift');
  if (!transcriptHashMatch || !nodesHashMatch) fail('predecessor_hash_mismatch');
  return {
    result: 'pass',
    candidate_count: candidateIds.length,
    consumer_projection_count: drillIds.length,
    transcript_available_count: counts.transcript_available,
    nodes_available_count: counts.nodes_available,
    paired_count: counts.paired,
    nodes_only_count: counts.nodes_only,
    neither_count: counts.neither,
    class_hash_sets_match: true,
    acquisition_complete: true,
    network_request_count: context.network.request_count,
    resume_reused_count: results.filter((item) => item.resume_reused).length,
    retry_count: context.retryEvents.filter((item) => item.recovery_action === 'BOUNDED_RETRY').length,
  };
}

function selfTest() {
  let checks = 0;
  const check = (condition) => {
    checks += 1;
    if (!condition) fail('internal_failure');
  };
  const synthetic = summarizeRegistryPayload({ data: [{
    videoId: 'synthetic-id', division: 'USMLE',
  }] }, 'usmle');
  check(synthetic.records.length === 1);
  check(synthetic.entries.get('synthetic-id').candidate === true);
  check(parseArgs(['--dry-run']).dryRun === true);
  try {
    parseArgs(['--concurrency', '99']);
    check(false);
  } catch (error) {
    check(error.code === 'argument_rejected');
  }
  check(sha256('synthetic').length === 64);
  return { mode: 'dry_run', result: 'pass', check_count: checks, network_requests: 0, file_writes: 0 };
}

function printHelp() {
  process.stdout.write([
    'I1Q-1008E restricted observed-corpus acquisition',
    'Usage: node tools/acquire.mjs [bounded options]',
    '       node tools/acquire.mjs --dry-run',
    'All live targets are read from a hash-pinned protected configuration.',
  ].join('\n') + '\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const result = options.dryRun ? selfTest() : await runAcquisition(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ result: 'fail', error_code: controlledError(error) })}\n`);
    process.exitCode = 1;
  });
}
