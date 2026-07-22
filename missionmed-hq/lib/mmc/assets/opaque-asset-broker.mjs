import { createHash, randomBytes } from 'node:crypto';

import { ENVIRONMENT } from '../contracts/state-contract.mjs';
import { isStrictRfc3339 } from '../contracts/timestamp-contract.mjs';

const enumOf = (...values) => Object.freeze(Object.fromEntries(values.map((value) => [value, value])));

export const ASSET_KIND = enumOf('RECORDING', 'TRANSCRIPT', 'DOCUMENT');
export const AUTHORITY_GRANT_TYPE = enumOf('ACQUISITION', 'TRANSCRIPT_PROCESSING');
export const ASSET_HANDLE_STATE = enumOf('ACTIVE', 'REVOKED');

export const ASSET_BROKER_LIMITS = Object.freeze({
  DEFAULT_MAX_BYTE_LENGTH: 64 * 1024 * 1024,
  ABSOLUTE_MAX_BYTE_LENGTH: 1024 * 1024 * 1024,
  PREFIX_INSPECTION_BYTES: 512,
  IDENTIFIER_MAX_BYTES: 128,
});

const REGISTER_REQUEST_KEYS = Object.freeze([
  'requestId',
  'declaredMimeType',
  'declaredByteLength',
  'expectedSha256',
]);
const HANDLE_REQUEST_KEYS = Object.freeze(['handle']);
const REGISTER_CONTEXT_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'subjectLinkId',
  'assetKind',
  'sourceObjectId',
  'acquisitionGrant',
  'processingGrant',
]);
const OPEN_CONTEXT_KEYS = Object.freeze([
  'tenantId',
  'environment',
  'subjectLinkId',
  'assetKind',
  'acquisitionGrant',
  'processingGrant',
]);
const GRANT_KEYS = Object.freeze([
  'grantId',
  'grantType',
  'state',
  'tenantId',
  'environment',
  'subjectLinkId',
  'assetKind',
  'notBefore',
  'expiresAt',
]);
const BROKER_OPTION_KEYS = Object.freeze(['adapter', 'maxByteLength', 'authorizeGrant', 'clock']);
const ADAPTER_OPTION_KEYS = Object.freeze(['chunkSize']);
const PUT_OBJECT_KEYS = Object.freeze(['objectId', 'bytes']);
const OPEN_OBJECT_KEYS = Object.freeze(['objectId']);

const MIME_BY_KIND = Object.freeze({
  RECORDING: Object.freeze(['video/mp4']),
  TRANSCRIPT: Object.freeze(['text/vtt', 'text/plain']),
  DOCUMENT: Object.freeze(['application/pdf']),
});
const SAFE_MESSAGES = Object.freeze({
  MMC_ASSET_UNKNOWN_FIELD: 'The asset request contains an unsupported field.',
  MMC_ASSET_MISSING_FIELD: 'The asset request is incomplete.',
  MMC_ASSET_INVALID_SHAPE: 'The asset request has an invalid shape.',
  MMC_ASSET_INVALID_IDENTIFIER: 'The asset request contains an invalid identifier.',
  MMC_ASSET_INVALID_TIMESTAMP: 'The asset request contains an invalid timestamp.',
  MMC_ASSET_INVALID_INTEGER: 'The asset request contains an invalid bounded integer.',
  MMC_ASSET_NATIVE_PATH_ADAPTER_DISABLED: 'Native filesystem asset access is disabled.',
  MMC_ASSET_ADAPTER_DENIED: 'The asset adapter is not approved for this broker.',
  MMC_ASSET_ADAPTER_ENVIRONMENT_DENIED: 'The asset adapter is disabled for this environment.',
  MMC_ASSET_OBJECT_EXISTS: 'The immutable source object already exists.',
  MMC_ASSET_OBJECT_NOT_FOUND: 'The source object is unavailable.',
  MMC_ASSET_AUTHORITY_DENIED: 'Current asset authority is required.',
  MMC_ASSET_MIME_DENIED: 'The declared media type is not permitted for this asset kind.',
  MMC_ASSET_MAGIC_INVALID: 'The asset content does not match its declared media type.',
  MMC_ASSET_TOO_LARGE: 'The asset exceeds the bounded byte limit.',
  MMC_ASSET_SIZE_MISMATCH: 'The asset byte count does not match the declared value.',
  MMC_ASSET_HASH_MISMATCH: 'The asset integrity hash does not match the expected value.',
  MMC_ASSET_IDEMPOTENCY_CONFLICT: 'The asset request identifier is already bound to different source semantics.',
  MMC_ASSET_STREAM_INVALID: 'The asset stream is invalid.',
  MMC_ASSET_NOT_FOUND: 'The asset is unavailable.',
  MMC_ASSET_READ_DENIED: 'The asset cannot be read.',
});

const OPAQUE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const HANDLE_PATTERN = /^ast_[a-f0-9]{32}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;
const APPROVED_ADAPTER = Symbol('MMC_APPROVED_OPAQUE_OBJECT_ADAPTER');
const VERIFIED_AUTHORITY_GRANT = Symbol('MMC_VERIFIED_ASSET_AUTHORITY_GRANT');
const textEncoder = new TextEncoder();

export class OpaqueAssetBrokerError extends Error {
  constructor(code, field) {
    super(SAFE_MESSAGES[code] || 'The asset operation could not be completed safely.');
    this.name = 'OpaqueAssetBrokerError';
    this.code = code;
    this.field = field;
    this.retryable = false;
    this.stack = `${this.name}: ${this.message}`;
  }
}

export function createNativePathAdapter() {
  fail('MMC_ASSET_NATIVE_PATH_ADAPTER_DISABLED', 'asset adapter');
}

export function createServerAssetAuthorityIssuer() {
  return Object.freeze({
    issueGrant(input) {
      validateGrantShape(input);
      const grant = { ...input };
      Object.defineProperty(grant, VERIFIED_AUTHORITY_GRANT, { value: true });
      return Object.freeze(grant);
    },
  });
}

export function createInMemoryObjectAdapter(options = {}) {
  assertPlainRecord(options, 'adapter options');
  assertExactKeys(options, ADAPTER_OPTION_KEYS, 'adapter options');
  const chunkSize = options.chunkSize ?? 64 * 1024;
  assertBoundedInteger(chunkSize, 1, 1024 * 1024, 'adapter chunk size');
  const objects = new Map();

  const adapter = {
    [APPROVED_ADAPTER]: true,
    kind: 'IN_MEMORY_OBJECT',
    supportsEnvironment(environment) {
      return environment === ENVIRONMENT.FIXTURE || environment === ENVIRONMENT.LOCAL;
    },
    putObject(input) {
      assertPlainRecord(input, 'object adapter put');
      assertExactKeys(input, PUT_OBJECT_KEYS, 'object adapter put');
      assertRequiredKeys(input, PUT_OBJECT_KEYS, 'object adapter put');
      assertOpaqueIdentifier(input.objectId, 'source object identifier');
      if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength < 1) {
        fail('MMC_ASSET_STREAM_INVALID', 'source object bytes');
      }
      if (objects.has(input.objectId)) fail('MMC_ASSET_OBJECT_EXISTS', 'source object');
      const immutableCopy = Uint8Array.from(input.bytes);
      objects.set(input.objectId, immutableCopy);
      return Object.freeze({ objectId: input.objectId, byteLength: immutableCopy.byteLength });
    },
    async *openObject(input) {
      assertPlainRecord(input, 'object adapter open');
      assertExactKeys(input, OPEN_OBJECT_KEYS, 'object adapter open');
      assertRequiredKeys(input, OPEN_OBJECT_KEYS, 'object adapter open');
      assertOpaqueIdentifier(input.objectId, 'source object identifier');
      const bytes = objects.get(input.objectId);
      if (!bytes) fail('MMC_ASSET_OBJECT_NOT_FOUND', 'source object');
      for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        yield bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength));
      }
    },
  };

  return Object.freeze(adapter);
}

export function createOpaqueAssetBroker(options) {
  assertPlainRecord(options, 'asset broker options');
  assertExactKeys(options, BROKER_OPTION_KEYS, 'asset broker options');
  assertRequiredKeys(options, ['adapter'], 'asset broker options');
  const { adapter } = options;
  if (!adapter || adapter[APPROVED_ADAPTER] !== true || adapter.kind !== 'IN_MEMORY_OBJECT') {
    fail('MMC_ASSET_ADAPTER_DENIED', 'asset adapter');
  }
  const maxByteLength = options.maxByteLength ?? ASSET_BROKER_LIMITS.DEFAULT_MAX_BYTE_LENGTH;
  if (typeof options.authorizeGrant !== 'function') {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority adapter');
  }
  const authorizeGrant = options.authorizeGrant;
  if (options.clock !== undefined && typeof options.clock !== 'function') {
    fail('MMC_ASSET_INVALID_SHAPE', 'asset broker clock');
  }
  const clock = options.clock || (() => new Date());
  assertBoundedInteger(maxByteLength, 1, ASSET_BROKER_LIMITS.ABSOLUTE_MAX_BYTE_LENGTH, 'asset byte limit');

  const records = new Map();
  const registrationReceipts = new Map();
  const registrationLocks = new Map();
  const assetLocks = new Map();

  return Object.freeze({
    async registerAsset(request, context) {
      validateRegisterRequest(request, maxByteLength);
      validateRegisterContext(context, adapter);
      const initialRequest = captureRegisterRequest(request);
      const initialContext = captureContext(context, true);
      const idempotencyScope = createRegistrationScope(initialRequest, initialContext);
      const semanticHash = createRegistrationSemanticHash(initialRequest, initialContext);

      return withRegistrationLock(registrationLocks, idempotencyScope, async () => {
        validateRegisterRequest(request, maxByteLength);
        assertRegisterRequestUnchanged(request, initialRequest);
        validateRegisterContext(context, adapter);
        assertContextUnchanged(context, initialContext, true);
        await requireCurrentAuthority(context.acquisitionGrant, AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
        await requireCurrentAuthority(context.processingGrant, AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);
        validateMimeForKind(initialRequest.declaredMimeType, initialContext.assetKind);

        const existingReceipt = registrationReceipts.get(idempotencyScope);
        if (existingReceipt) {
          if (existingReceipt.semanticHash !== semanticHash) {
            fail('MMC_ASSET_IDEMPOTENCY_CONFLICT', 'asset request identifier');
          }
          return existingReceipt.result;
        }

        const inspection = await inspectObject({
          adapter,
          sourceObjectId: initialContext.sourceObjectId,
          mimeType: initialRequest.declaredMimeType,
          assetKind: initialContext.assetKind,
          maxByteLength,
          captureBytes: false,
        });
        assertInspectionMatchesRequest(inspection, initialRequest);

        validateRegisterRequest(request, maxByteLength);
        assertRegisterRequestUnchanged(request, initialRequest);
        validateRegisterContext(context, adapter);
        assertContextUnchanged(context, initialContext, true);
        await requireCurrentAuthority(context.acquisitionGrant, AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
        await requireCurrentAuthority(context.processingGrant, AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);

        const handle = createHandle(records);
        const metadata = freezeMetadata({
          handle,
          assetKind: initialContext.assetKind,
          mimeType: initialRequest.declaredMimeType,
          byteLength: inspection.byteLength,
          sha256: inspection.sha256,
          createdAt: readBrokerClock(clock),
          state: ASSET_HANDLE_STATE.ACTIVE,
        });
        const record = Object.freeze({
          handle,
          tenantId: initialContext.tenantId,
          environment: initialContext.environment,
          subjectLinkId: initialContext.subjectLinkId,
          assetKind: initialContext.assetKind,
          sourceObjectId: initialContext.sourceObjectId,
          metadata,
          revokedAt: null,
        });
        const result = Object.freeze({ handle, metadata });
        const receipt = Object.freeze({ semanticHash, result });
        try {
          records.set(handle, record);
          registrationReceipts.set(idempotencyScope, receipt);
        } catch (error) {
          records.delete(handle);
          registrationReceipts.delete(idempotencyScope);
          throw error;
        }
        return result;
      });
    },

    async openAsset(request, context) {
      validateHandleRequest(request);
      validateOpenContext(context, adapter);
      const initialContext = captureContext(context, false);
      const record = resolveBoundRecord(records, request.handle, context);
      await requireCurrentAuthority(context.acquisitionGrant, AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
      await requireCurrentAuthority(context.processingGrant, AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);
      if (record.revokedAt !== null || record.metadata.state !== ASSET_HANDLE_STATE.ACTIVE) {
        fail('MMC_ASSET_READ_DENIED', 'asset handle');
      }

      const inspection = await inspectObject({
        adapter,
        sourceObjectId: record.sourceObjectId,
        mimeType: record.metadata.mimeType,
        assetKind: record.assetKind,
        maxByteLength,
        captureBytes: true,
      });
      if (
        inspection.byteLength !== record.metadata.byteLength
        || inspection.sha256 !== record.metadata.sha256
      ) {
        fail('MMC_ASSET_HASH_MISMATCH', 'asset integrity');
      }

      const current = records.get(record.handle);
      if (!current || current.revokedAt !== null || current !== record) {
        fail('MMC_ASSET_READ_DENIED', 'asset handle');
      }
      validateOpenContext(context, adapter);
      assertContextUnchanged(context, initialContext, false);
      resolveBoundRecord(records, request.handle, context);
      await requireCurrentAuthority(context.acquisitionGrant, AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
      await requireCurrentAuthority(context.processingGrant, AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);
      // Processing bytes live behind a non-enumerable server/worker capability.
      // JSON/result serialization exposes only the opaque handle and safe metadata.
      const openResult = {
        handle: record.handle,
        metadata: record.metadata,
      };
      Object.defineProperty(openResult, 'readBytesForProcessing', {
        configurable: false,
        enumerable: false,
        writable: false,
        async value() {
          validateOpenContext(context, adapter);
          assertContextUnchanged(context, initialContext, false);
          const active = resolveBoundRecord(records, request.handle, context);
          if (active !== record || active.revokedAt !== null || active.metadata.state !== ASSET_HANDLE_STATE.ACTIVE) {
            fail('MMC_ASSET_READ_DENIED', 'asset handle');
          }
          await requireCurrentAuthority(context.acquisitionGrant, AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
          await requireCurrentAuthority(context.processingGrant, AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);
          return Uint8Array.from(inspection.bytes);
        },
      });
      return Object.freeze(openResult);
    },

    async revokeAsset(request, context) {
      validateHandleRequest(request);
      validateOpenContext(context, adapter);
      const handle = request.handle;
      const initialContext = captureContext(context, false);
      const initialAcquisitionGrant = context.acquisitionGrant;
      const initialProcessingGrant = context.processingGrant;
      return withRegistrationLock(assetLocks, `revoke:${handle}`, async () => {
        validateHandleRequest(request);
        if (request.handle !== handle) fail('MMC_ASSET_AUTHORITY_DENIED', 'asset operation request');
        validateOpenContext(context, adapter);
        assertContextUnchanged(context, initialContext, false);
        assertAuthorityReferencesUnchanged(
          context, initialAcquisitionGrant, initialProcessingGrant,
        );
        const record = resolveBoundRecord(records, handle, context);
        await requireCurrentAuthority(initialAcquisitionGrant,
          AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
        await requireCurrentAuthority(initialProcessingGrant,
          AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);

        validateOpenContext(context, adapter);
        assertContextUnchanged(context, initialContext, false);
        assertAuthorityReferencesUnchanged(
          context, initialAcquisitionGrant, initialProcessingGrant,
        );
        const current = resolveBoundRecord(records, handle, context);
        if (current !== record) {
          if (current.revokedAt !== null) {
            return Object.freeze({
              handle: current.handle,
              state: ASSET_HANDLE_STATE.REVOKED,
              revokedAt: current.revokedAt,
            });
          }
          fail('MMC_ASSET_AUTHORITY_DENIED', 'asset handle');
        }
        if (record.revokedAt !== null) {
          return Object.freeze({ handle: record.handle, state: ASSET_HANDLE_STATE.REVOKED, revokedAt: record.revokedAt });
        }

        await requireCurrentAuthority(initialAcquisitionGrant,
          AUTHORITY_GRANT_TYPE.ACQUISITION, context, authorizeGrant, clock);
        await requireCurrentAuthority(initialProcessingGrant,
          AUTHORITY_GRANT_TYPE.TRANSCRIPT_PROCESSING, context, authorizeGrant, clock);
        validateOpenContext(context, adapter);
        assertContextUnchanged(context, initialContext, false);
        assertAuthorityReferencesUnchanged(
          context, initialAcquisitionGrant, initialProcessingGrant,
        );
        if (records.get(handle) !== record) fail('MMC_ASSET_AUTHORITY_DENIED', 'asset handle');

        const revokedMetadata = freezeMetadata({
          ...record.metadata,
          state: ASSET_HANDLE_STATE.REVOKED,
        });
        const revokedAt = readBrokerClock(clock);
        const revokedRecord = Object.freeze({
          ...record,
          metadata: revokedMetadata,
          revokedAt,
        });
        records.set(record.handle, revokedRecord);
        return Object.freeze({ handle: record.handle, state: ASSET_HANDLE_STATE.REVOKED, revokedAt });
      });
    },
  });
}

function validateRegisterRequest(request, maxByteLength) {
  assertPlainRecord(request, 'asset register request');
  assertExactKeys(request, REGISTER_REQUEST_KEYS, 'asset register request');
  assertRequiredKeys(request, REGISTER_REQUEST_KEYS, 'asset register request');
  assertOpaqueIdentifier(request.requestId, 'asset request identifier');
  if (typeof request.declaredMimeType !== 'string' || !MIME_PATTERN.test(request.declaredMimeType)) {
    fail('MMC_ASSET_MIME_DENIED', 'declared media type');
  }
  assertBoundedInteger(
    request.declaredByteLength,
    1,
    ASSET_BROKER_LIMITS.ABSOLUTE_MAX_BYTE_LENGTH,
    'declared byte length',
  );
  if (request.declaredByteLength > maxByteLength) {
    fail('MMC_ASSET_TOO_LARGE', 'declared byte length');
  }
  if (typeof request.expectedSha256 !== 'string' || !SHA256_PATTERN.test(request.expectedSha256)) {
    fail('MMC_ASSET_HASH_MISMATCH', 'expected asset hash');
  }
}

function validateHandleRequest(request) {
  assertPlainRecord(request, 'asset handle request');
  assertExactKeys(request, HANDLE_REQUEST_KEYS, 'asset handle request');
  assertRequiredKeys(request, HANDLE_REQUEST_KEYS, 'asset handle request');
  if (typeof request.handle !== 'string' || !HANDLE_PATTERN.test(request.handle)) {
    fail('MMC_ASSET_NOT_FOUND', 'asset handle');
  }
}

function validateRegisterContext(context, adapter) {
  assertPlainRecord(context, 'asset register context');
  assertExactKeys(context, REGISTER_CONTEXT_KEYS, 'asset register context');
  assertRequiredKeys(context, REGISTER_CONTEXT_KEYS, 'asset register context');
  validateContextIdentity(context, adapter);
  assertOpaqueIdentifier(context.sourceObjectId, 'source object identifier');
}

function validateOpenContext(context, adapter) {
  assertPlainRecord(context, 'asset open context');
  assertExactKeys(context, OPEN_CONTEXT_KEYS, 'asset open context');
  assertRequiredKeys(context, OPEN_CONTEXT_KEYS, 'asset open context');
  validateContextIdentity(context, adapter);
}

function validateContextIdentity(context, adapter) {
  assertOpaqueIdentifier(context.tenantId, 'asset tenant');
  assertEnumValue(ENVIRONMENT, context.environment, 'asset environment');
  if (!adapter.supportsEnvironment(context.environment)) {
    fail('MMC_ASSET_ADAPTER_ENVIRONMENT_DENIED', 'asset environment');
  }
  assertOpaqueIdentifier(context.subjectLinkId, 'asset subject');
  assertEnumValue(ASSET_KIND, context.assetKind, 'asset kind');
}

function captureContext(context, includeSource) {
  const captured = {
    tenantId: context.tenantId,
    environment: context.environment,
    subjectLinkId: context.subjectLinkId,
    assetKind: context.assetKind,
  };
  if (includeSource) captured.sourceObjectId = context.sourceObjectId;
  return Object.freeze(captured);
}

function captureRegisterRequest(request) {
  return Object.freeze({
    requestId: request.requestId,
    declaredMimeType: request.declaredMimeType,
    declaredByteLength: request.declaredByteLength,
    expectedSha256: request.expectedSha256,
  });
}

function assertRegisterRequestUnchanged(request, initial) {
  if (
    request.requestId !== initial.requestId
    || request.declaredMimeType !== initial.declaredMimeType
    || request.declaredByteLength !== initial.declaredByteLength
    || request.expectedSha256 !== initial.expectedSha256
  ) {
    fail('MMC_ASSET_IDEMPOTENCY_CONFLICT', 'asset request mutation');
  }
}

function createRegistrationScope(request, context) {
  return JSON.stringify([
    context.tenantId,
    context.environment,
    context.subjectLinkId,
    context.assetKind,
    request.requestId,
  ]);
}

function createRegistrationSemanticHash(request, context) {
  return createHash('sha256').update(JSON.stringify({
    sourceObjectId: context.sourceObjectId,
    declaredMimeType: request.declaredMimeType,
    declaredByteLength: request.declaredByteLength,
    expectedSha256: request.expectedSha256,
  })).digest('hex');
}

async function withRegistrationLock(locks, key, callback) {
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  locks.set(key, current);
  await previous;
  try {
    return await callback();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

function assertContextUnchanged(context, initial, includeSource) {
  if (
    context.tenantId !== initial.tenantId
    || context.environment !== initial.environment
    || context.subjectLinkId !== initial.subjectLinkId
    || context.assetKind !== initial.assetKind
    || (includeSource && context.sourceObjectId !== initial.sourceObjectId)
  ) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset operation context');
  }
}

function assertAuthorityReferencesUnchanged(context, acquisitionGrant, processingGrant) {
  if (context.acquisitionGrant !== acquisitionGrant || context.processingGrant !== processingGrant) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority grant');
  }
}

function validateGrantShape(grant) {
  assertPlainRecord(grant, 'asset authority grant');
  assertExactKeys(grant, GRANT_KEYS, 'asset authority grant');
  assertRequiredKeys(grant, GRANT_KEYS, 'asset authority grant');
  assertOpaqueIdentifier(grant.grantId, 'asset authority grant identifier');
  assertEnumValue(AUTHORITY_GRANT_TYPE, grant.grantType, 'asset authority grant type');
  if (!['ACTIVE', 'REVOKED'].includes(grant.state)) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority grant state');
  }
  assertOpaqueIdentifier(grant.tenantId, 'asset authority tenant');
  assertEnumValue(ENVIRONMENT, grant.environment, 'asset authority environment');
  assertOpaqueIdentifier(grant.subjectLinkId, 'asset authority subject');
  assertEnumValue(ASSET_KIND, grant.assetKind, 'asset authority kind');
  assertRfc3339(grant.notBefore, 'asset authority start');
  assertRfc3339(grant.expiresAt, 'asset authority expiry');
}

async function requireCurrentAuthority(grant, requiredType, context, authorizeGrant, clock) {
  validateGrantShape(grant);
  if (grant[VERIFIED_AUTHORITY_GRANT] !== true || grant.grantType !== requiredType || grant.state !== 'ACTIVE') {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority grant');
  }
  if (
    grant.tenantId !== context.tenantId
    || grant.environment !== context.environment
    || grant.subjectLinkId !== context.subjectLinkId
    || grant.assetKind !== context.assetKind
  ) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority scope');
  }
  const now = Date.parse(readBrokerClock(clock));
  if (Date.parse(grant.notBefore) > now || Date.parse(grant.expiresAt) <= now) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority time');
  }
  if (await authorizeGrant({ grant, requiredType, context: captureContext(context, false) }) !== true) {
    fail('MMC_ASSET_AUTHORITY_DENIED', 'asset authority grant');
  }
}

function readBrokerClock(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('MMC_ASSET_INVALID_TIMESTAMP', 'asset broker clock');
  return date.toISOString();
}

function validateMimeForKind(mimeType, assetKind) {
  if (!MIME_BY_KIND[assetKind]?.includes(mimeType)) {
    fail('MMC_ASSET_MIME_DENIED', 'asset media type');
  }
}

async function inspectObject({ adapter, sourceObjectId, mimeType, assetKind, maxByteLength, captureBytes }) {
  const hash = createHash('sha256');
  const prefix = [];
  const chunks = captureBytes ? [] : null;
  let byteLength = 0;
  let textDecoder = null;
  if (mimeType === 'text/plain' || mimeType === 'text/vtt') {
    textDecoder = new TextDecoder('utf-8', { fatal: true });
  }

  let stream;
  try {
    stream = adapter.openObject({ objectId: sourceObjectId });
    for await (const chunk of stream) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength < 1) {
        fail('MMC_ASSET_STREAM_INVALID', 'asset stream');
      }
      byteLength += chunk.byteLength;
      if (byteLength > maxByteLength) fail('MMC_ASSET_TOO_LARGE', 'asset stream');
      hash.update(chunk);
      if (textDecoder) {
        if (chunk.includes(0)) fail('MMC_ASSET_MAGIC_INVALID', 'asset content');
        textDecoder.decode(chunk, { stream: true });
      }
      const remainingPrefix = ASSET_BROKER_LIMITS.PREFIX_INSPECTION_BYTES - prefix.length;
      if (remainingPrefix > 0) prefix.push(...chunk.subarray(0, remainingPrefix));
      if (chunks) chunks.push(Uint8Array.from(chunk));
    }
    if (textDecoder) textDecoder.decode();
  } catch (error) {
    if (error instanceof OpaqueAssetBrokerError) throw error;
    fail('MMC_ASSET_STREAM_INVALID', 'asset stream');
  }
  if (byteLength < 1) fail('MMC_ASSET_STREAM_INVALID', 'asset stream');

  validateMagicBytes(Uint8Array.from(prefix), mimeType, assetKind);
  return {
    byteLength,
    sha256: hash.digest('hex'),
    bytes: chunks ? concatenateChunks(chunks, byteLength) : null,
  };
}

function validateMagicBytes(prefix, mimeType, assetKind) {
  validateMimeForKind(mimeType, assetKind);
  if (mimeType === 'video/mp4') {
    if (prefix.byteLength < 12 || ascii(prefix.subarray(4, 8)) !== 'ftyp') {
      fail('MMC_ASSET_MAGIC_INVALID', 'asset content');
    }
    return;
  }
  if (mimeType === 'application/pdf') {
    if (prefix.byteLength < 5 || ascii(prefix.subarray(0, 5)) !== '%PDF-') {
      fail('MMC_ASSET_MAGIC_INVALID', 'asset content');
    }
    return;
  }
  if (mimeType === 'text/vtt') {
    const start = prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf ? 3 : 0;
    if (ascii(prefix.subarray(start, start + 6)) !== 'WEBVTT') {
      fail('MMC_ASSET_MAGIC_INVALID', 'asset content');
    }
    return;
  }
  if (mimeType === 'text/plain') {
    if (prefix.byteLength < 1 || prefix.includes(0)) fail('MMC_ASSET_MAGIC_INVALID', 'asset content');
    return;
  }
  fail('MMC_ASSET_MIME_DENIED', 'asset media type');
}

function assertInspectionMatchesRequest(inspection, request) {
  if (inspection.byteLength !== request.declaredByteLength) {
    fail('MMC_ASSET_SIZE_MISMATCH', 'asset byte length');
  }
  if (inspection.sha256 !== request.expectedSha256) {
    fail('MMC_ASSET_HASH_MISMATCH', 'asset integrity');
  }
}

function resolveBoundRecord(records, handle, context) {
  const record = records.get(handle);
  if (
    !record
    || record.tenantId !== context.tenantId
    || record.environment !== context.environment
    || record.subjectLinkId !== context.subjectLinkId
    || record.assetKind !== context.assetKind
  ) {
    fail('MMC_ASSET_NOT_FOUND', 'asset handle');
  }
  return record;
}

function createHandle(records) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const handle = `ast_${randomBytes(16).toString('hex')}`;
    if (!records.has(handle)) return handle;
  }
  fail('MMC_ASSET_STREAM_INVALID', 'asset handle generation');
}

function freezeMetadata(metadata) {
  const keys = ['handle', 'assetKind', 'mimeType', 'byteLength', 'sha256', 'createdAt', 'state'];
  assertExactKeys(metadata, keys, 'asset metadata');
  assertRequiredKeys(metadata, keys, 'asset metadata');
  return Object.freeze({
    handle: metadata.handle,
    assetKind: metadata.assetKind,
    mimeType: metadata.mimeType,
    byteLength: metadata.byteLength,
    sha256: metadata.sha256,
    createdAt: metadata.createdAt,
    state: metadata.state,
  });
}

function concatenateChunks(chunks, byteLength) {
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function ascii(bytes) {
  return String.fromCharCode(...bytes);
}

function assertPlainRecord(value, field) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('MMC_ASSET_INVALID_SHAPE', field);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail('MMC_ASSET_INVALID_SHAPE', field);
  }
}

function assertExactKeys(value, allowedKeys, field) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    fail('MMC_ASSET_UNKNOWN_FIELD', field);
  }
}

function assertRequiredKeys(value, requiredKeys, field) {
  if (requiredKeys.some((key) => !Object.hasOwn(value, key))) {
    fail('MMC_ASSET_MISSING_FIELD', field);
  }
}

function assertOpaqueIdentifier(value, field) {
  if (
    typeof value !== 'string'
    || textEncoder.encode(value).byteLength > ASSET_BROKER_LIMITS.IDENTIFIER_MAX_BYTES
    || !OPAQUE_IDENTIFIER_PATTERN.test(value)
  ) {
    fail('MMC_ASSET_INVALID_IDENTIFIER', field);
  }
}

function assertEnumValue(enumObject, value, field) {
  if (typeof value !== 'string' || !Object.hasOwn(enumObject, value)) {
    fail('MMC_ASSET_INVALID_SHAPE', field);
  }
}

function assertRfc3339(value, field) {
  if (!isStrictRfc3339(value)) {
    fail('MMC_ASSET_INVALID_TIMESTAMP', field);
  }
}

function assertBoundedInteger(value, minimum, maximum, field) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail('MMC_ASSET_INVALID_INTEGER', field);
  }
}

function fail(code, field) {
  throw new OpaqueAssetBrokerError(code, field);
}
