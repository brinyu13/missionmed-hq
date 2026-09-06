import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  DatabaseBoundPrivateStorageCapabilityProvider,
  PostgresEncryptedPrivateStorageDriver,
  createPostgresEncryptedPrivateStorageAdapter,
  createPostgresEncryptedPrivateStorageAdapterFromEnvironment,
} from '../../lor-studio/adapters/postgres-encrypted-private-storage.mjs';
import {
  DomainInvariantError,
  IdempotencyConflictError,
} from '../../lor-studio/domain/errors.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import {
  TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
  runWithTrustedRequestContext,
} from '../../lor-studio/security/trusted-request-context.mjs';

const NOW = '2026-08-26T12:00:00.000Z';
const BINDING = Object.freeze({
  bucket: 'lor-writer-depot',
  private: true,
  versioned: true,
  serverMediated: true,
  policyVerified: true,
  providerResourceBound: true,
  independentlyVerified: true,
  storageIdentity: 'railway-postgres:lor-private-artifacts:v1',
});

function trustedContext(actorRole = 'student', subject = 'wp:41') {
  return {
    schemaVersion: TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
    authenticatedSubject: subject,
    actorRole,
    sourceReferenceHash: actorRole === 'student' ? 'a'.repeat(64) : null,
    proofHash: actorRole === 'student' ? 'b'.repeat(64) : null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    clientAsserted: false,
  };
}

function accessDependencies({ actorRole = 'student', subject = 'wp:41', caseId = 'case-1' } = {}) {
  const actorResolver = {
    async resolve(request) {
      assert.deepEqual(request, { authenticatedSubject: subject, caseId });
      return {
        schemaVersion: 'missionmed.lor.actor-case-access.v1',
        authoritySource: 'database_verified_case_access',
        actorId: subject,
        actorRole,
        resourceStudentId: actorRole === 'student' ? subject : 'wp:41',
        caseId,
      };
    },
  };
  const scopeProvider = async (request) => ({
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: '00000000-0000-4000-8000-000000000001',
    authenticatedSubject: subject,
    actorId: subject,
    actorRole,
    resourceStudentId: actorRole === 'student' ? subject : 'wp:41',
    caseId: request.caseId,
    operation: request.operation,
    purpose: actorRole === 'student'
      ? (request.operation === 'read' ? 'student_case_read' : 'student_case_write')
      : 'faculty_private_edit',
    assignmentId: null,
    invitationId: actorRole === 'faculty' ? 'invitation-1' : null,
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
  });
  return { actorResolver, scopeProvider };
}

class MemoryCiphertextDatabaseDriver {
  constructor() {
    this.records = new Map();
    this.idempotency = new Map();
    this.putCalls = [];
    this.getCalls = [];
  }

  receipt(command, operation, record, replayed = false) {
    return {
      schemaVersion: 'missionmed.lor.private-storage-database-receipt.v1',
      operation,
      storageIdentity: command.storageIdentity,
      bucket: 'lor-writer-depot',
      caseId: command.caseId,
      objectId: command.objectId,
      objectKey: command.objectKey,
      versionId: record.versionId,
      contentClass: command.contentClass,
      purpose: command.purpose,
      contentType: record.contentType,
      checksum: record.checksum,
      byteLength: record.byteLength,
      capabilityId: command.capabilityId,
      evidenceId: command.evidenceId,
      receiptId: `receipt_${sha256(`${operation}:${record.versionId}:${command.capabilityId}`)}`,
      occurredAt: NOW,
      private: true,
      versionImmutable: true,
      policyChecked: true,
      replayed,
    };
  }

  async putEncryptedPrivateArtifactAtomic(command) {
    this.putCalls.push(structuredClone(command));
    const idempotencyScope = `${command.actorId}:${command.caseId}:${command.idempotencyKey}`;
    const existing = this.idempotency.get(idempotencyScope);
    if (existing) {
      if (existing.requestHash !== command.requestHash) {
        throw new IdempotencyConflictError({ idempotencyKey: command.idempotencyKey });
      }
      return this.receipt(command, 'put', existing.record, true);
    }
    const versionId = `version_${sha256(command.requestHash)}`;
    const key = `${command.caseId}:${command.objectId}:${versionId}`;
    const record = { ...structuredClone(command), versionId };
    this.records.set(key, record);
    this.idempotency.set(idempotencyScope, { requestHash: command.requestHash, record });
    return this.receipt(command, 'put', record);
  }

  async getEncryptedPrivateArtifactAtomic(command) {
    this.getCalls.push(structuredClone(command));
    const record = this.records.get(`${command.caseId}:${command.objectId}:${command.versionId}`);
    if (!record) throw Object.assign(new Error('LOR_PRIVATE_STORAGE_NOT_FOUND'), { code: 'P1503' });
    return {
      ...this.receipt(command, 'get', record),
      keyVersion: record.keyVersion,
      hkdfSaltBase64: record.hkdfSaltBase64,
      ivBase64: record.ivBase64,
      authTagBase64: record.authTagBase64,
      ciphertextBase64: record.ciphertextBase64,
      aadHash: record.aadHash,
      idempotencyKey: record.idempotencyKey,
    };
  }
}

function adapterHarness(overrides = {}) {
  const databaseDriver = overrides.databaseDriver ?? new MemoryCiphertextDatabaseDriver();
  const access = accessDependencies(overrides);
  let randomCounter = 1;
  const adapter = createPostgresEncryptedPrivateStorageAdapter({
    binding: BINDING,
    databaseDriver,
    ...access,
    kek: Buffer.alloc(32, 0x7a),
    keyVersion: 'railway-kek-2026-08-v1',
    clock: () => new Date(NOW),
    randomBytesFn(length) {
      return Buffer.alloc(length, randomCounter++);
    },
  });
  return { adapter, databaseDriver };
}

test('application encryption persists ciphertext only and round-trips one immutable version', async () => {
  const { adapter, databaseDriver } = adapterHarness();
  const plaintext = Buffer.from('PRIVATE STUDENT LOR MATERIAL', 'utf8');
  const stored = await runWithTrustedRequestContext(trustedContext(), () => adapter.put({
    caseId: 'case-1',
    objectId: 'student-draft-1',
    content: plaintext,
    contentType: 'text/plain',
    checksum: sha256(plaintext),
    contentClass: 'student_prepared',
    purpose: 'case_workflow',
    idempotencyKey: 'storage-put-1',
  }));
  assert.equal(stored.schemaVersion, 'missionmed.lor.private-storage-receipt.v1');
  assert.equal(stored.private, true);
  assert.equal(stored.immutableVersion, true);
  assert.equal(databaseDriver.putCalls.length, 1);
  const persistedCommand = databaseDriver.putCalls[0];
  assert.equal('content' in persistedCommand, false);
  assert.equal(JSON.stringify(persistedCommand).includes(plaintext.toString('utf8')), false);
  assert.notEqual(
    Buffer.from(persistedCommand.ciphertextBase64, 'base64').toString('utf8'),
    plaintext.toString('utf8'),
  );

  const versionId = [...databaseDriver.records.values()][0].versionId;
  const loaded = await runWithTrustedRequestContext(trustedContext(), () => adapter.get({
    caseId: 'case-1',
    objectId: 'student-draft-1',
    versionId,
    contentClass: 'student_prepared',
    purpose: 'case_workflow',
  }));
  assert.deepEqual(loaded.content, plaintext);
  assert.equal(loaded.contentType, 'text/plain');
  assert.equal(loaded.receipt.operation, 'get');
});

test('ciphertext, tag, metadata, wrong-key, and cross-case tampering fail closed', async () => {
  const { adapter, databaseDriver } = adapterHarness({ actorRole: 'faculty', subject: 'wp:88' });
  const plaintext = Buffer.from('faculty private draft', 'utf8');
  await runWithTrustedRequestContext(trustedContext('faculty', 'wp:88'), () => adapter.put({
    caseId: 'case-1',
    objectId: 'faculty-draft-1',
    content: plaintext,
    contentType: 'text/plain',
    checksum: sha256(plaintext),
    contentClass: 'faculty_private',
    purpose: 'faculty_review',
    idempotencyKey: 'faculty-storage-1',
  }));
  const record = [...databaseDriver.records.values()][0];
  const request = {
    caseId: 'case-1', objectId: 'faculty-draft-1', versionId: record.versionId,
    contentClass: 'faculty_private', purpose: 'faculty_review',
  };

  const ciphertext = Buffer.from(record.ciphertextBase64, 'base64');
  ciphertext[0] ^= 0x01;
  record.ciphertextBase64 = ciphertext.toString('base64');
  await assert.rejects(
    runWithTrustedRequestContext(
      trustedContext('faculty', 'wp:88'),
      () => adapter.get(request),
    ),
    DomainInvariantError,
  );
  ciphertext[0] ^= 0x01;
  record.ciphertextBase64 = ciphertext.toString('base64');
  const authTag = Buffer.from(record.authTagBase64, 'base64');
  authTag[0] ^= 0x01;
  record.authTagBase64 = authTag.toString('base64');
  await assert.rejects(
    runWithTrustedRequestContext(
      trustedContext('faculty', 'wp:88'),
      () => adapter.get(request),
    ),
    DomainInvariantError,
  );
  authTag[0] ^= 0x01;
  record.authTagBase64 = authTag.toString('base64');
  const originalAadHash = record.aadHash;
  record.aadHash = '0'.repeat(64);
  await assert.rejects(
    runWithTrustedRequestContext(
      trustedContext('faculty', 'wp:88'),
      () => adapter.get(request),
    ),
    DomainInvariantError,
  );
  record.aadHash = originalAadHash;

  const wrongKeyAdapter = createPostgresEncryptedPrivateStorageAdapter({
    binding: BINDING,
    databaseDriver,
    ...accessDependencies({ actorRole: 'faculty', subject: 'wp:88' }),
    kek: Buffer.alloc(32, 0x6b),
    keyVersion: 'railway-kek-2026-08-v1',
    clock: () => new Date(NOW),
  });
  await assert.rejects(
    runWithTrustedRequestContext(
      trustedContext('faculty', 'wp:88'),
      () => wrongKeyAdapter.get(request),
    ),
    DomainInvariantError,
  );

  const crossCaseProvider = new DatabaseBoundPrivateStorageCapabilityProvider({
    actorResolver: {
      async resolve() {
        return { actorId: 'wp:41', actorRole: 'student', caseId: 'different-case', resourceStudentId: 'wp:41' };
      },
    },
    scopeProvider: accessDependencies().scopeProvider,
    clock: () => new Date(NOW),
  });
  await assert.rejects(
    runWithTrustedRequestContext(trustedContext(), () => crossCaseProvider.resolveStorageCapability({
      caseId: 'case-1', objectId: 'student-draft-1', contentClass: 'student_prepared',
      purpose: 'case_workflow', operation: 'put',
    })),
    /Access denied/u,
  );
});

test('storage capability cannot be minted outside trusted request scope or for mentor/private mismatch', async () => {
  const access = accessDependencies();
  const provider = new DatabaseBoundPrivateStorageCapabilityProvider({
    ...access,
    clock: () => new Date(NOW),
  });
  await assert.rejects(provider.resolveStorageCapability({
    caseId: 'case-1', objectId: 'draft-1', contentClass: 'student_prepared',
    purpose: 'case_workflow', operation: 'put',
  }), (error) => error?.details?.status === 'TRUSTED_REQUEST_CONTEXT_REQUIRED');
  const mentorAccess = accessDependencies({ actorRole: 'mentor', subject: 'wp:77' });
  const mentorProvider = new DatabaseBoundPrivateStorageCapabilityProvider({
    ...mentorAccess,
    clock: () => new Date(NOW),
  });
  await assert.rejects(
    runWithTrustedRequestContext(trustedContext('mentor', 'wp:77'), () => (
      mentorProvider.resolveStorageCapability({
        caseId: 'case-1', objectId: 'draft-1', contentClass: 'faculty_private',
        purpose: 'faculty_review', operation: 'get', versionId: `version_${'a'.repeat(64)}`,
      })
    )),
    /Access denied/u,
  );
});

function request(method, body = null, headers = {}) {
  const stream = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = {
    ...(body === null ? {} : { 'content-type': 'application/json' }),
    ...headers,
  };
  return stream;
}

test('case-bound HTTP accepted functions invoke encrypted put/get and reject forged fields', async () => {
  const { adapter: privateStorageService, databaseDriver } = adapterHarness();
  const application = createLorApplicationAdapter({
    caseService: {},
    repository: { isDurable: true, durability: 'POSTGRESQL_RLS_ATOMIC' },
    privateStorageService,
  });
  const plaintext = Buffer.from('http private artifact', 'utf8');
  const invoke = (pathname, method, body, headers = {}) => runWithTrustedRequestContext(
    trustedContext(),
    () => application.handleRequest({
      request: request(method, body, headers),
      url: new URL(pathname, 'https://hq.example.test'),
      actor: { id: 'wp:41', role: 'student' },
    }),
  );
  const put = await invoke(
    '/api/lor-studio/cases/case-1/private-artifacts/student-draft-1',
    'POST',
    {
      checksum: sha256(plaintext),
      contentBase64: plaintext.toString('base64'),
      contentClass: 'student_prepared',
      contentType: 'text/plain',
      purpose: 'case_workflow',
    },
    { 'idempotency-key': 'http-storage-put-1' },
  );
  assert.equal(put.status, 201);
  assert.equal(put.body.receipt.private, true);
  const versionId = [...databaseDriver.records.values()][0].versionId;
  const get = await invoke(
    `/api/lor-studio/cases/case-1/private-artifacts/student-draft-1/versions/${versionId}?contentClass=student_prepared&purpose=case_workflow`,
    'GET',
    null,
  );
  assert.equal(get.status, 200);
  assert.deepEqual(get.binary.body, plaintext);
  assert.equal(get.binary.contentType, 'application/octet-stream');
  assert.equal(get.binary.sensitive, true);

  const forged = await invoke(
    '/api/lor-studio/cases/case-1/private-artifacts/student-draft-2',
    'POST',
    {
      checksum: sha256(plaintext), contentBase64: plaintext.toString('base64'),
      contentClass: 'student_prepared', contentType: 'text/plain', purpose: 'case_workflow',
      actorId: 'wp:999',
    },
    { 'idempotency-key': 'http-storage-forged' },
  );
  assert.equal(forged.status, 400);
  assert.equal(databaseDriver.putCalls.length, 1);
});

test('private artifact HTTP transport accepts a realistic body above the generic JSON cap', async () => {
  const { adapter: privateStorageService, databaseDriver } = adapterHarness();
  const application = createLorApplicationAdapter({
    caseService: {},
    repository: { isDurable: true, durability: 'POSTGRESQL_RLS_ATOMIC' },
    privateStorageService,
  });
  const plaintext = Buffer.alloc(300_000, 0x61);
  const result = await runWithTrustedRequestContext(trustedContext(), () => (
    application.handleRequest({
      request: request('POST', {
        checksum: sha256(plaintext),
        contentBase64: plaintext.toString('base64'),
        contentClass: 'student_prepared',
        contentType: 'application/octet-stream',
        purpose: 'case_workflow',
      }, { 'idempotency-key': 'http-storage-large-1' }),
      url: new URL(
        '/api/lor-studio/cases/case-1/private-artifacts/student-large-1',
        'https://hq.example.test',
      ),
      actor: { id: 'wp:41', role: 'student' },
    })
  ));
  assert.equal(result.status, 201);
  assert.equal(databaseDriver.putCalls[0].byteLength, plaintext.byteLength);
  plaintext.fill(0);
});

test('released binary storage requires exact non-null content hash and MIME commitments', async () => {
  const migration = await readFile(new URL(
    '../../scripts/lor-studio/migrations/20260826011300_f2_lor_1012_live_production_encrypted_private_storage_commands.sql',
    import.meta.url,
  ), 'utf8');
  assert.doesNotMatch(
    migration,
    /final_document_content_hash\s+IS\s+NULL\s+OR/iu,
  );
  assert.match(
    migration,
    /final_document_content_hash\s+IS\s+NOT\s+NULL[\s\S]*?final_document_content_hash\s*=\s*candidate_content_hash[\s\S]*?final_document_mime_type\s+IS\s+NOT\s+NULL[\s\S]*?final_document_mime_type\s*=\s*candidate_content_type/iu,
  );
  assert.match(
    migration,
    /final_document_content_hash\s+IS\s+NOT\s+NULL[\s\S]*?final_document_content_hash\s*=\s*stored_version\.content_hash[\s\S]*?final_document_mime_type\s+IS\s+NOT\s+NULL[\s\S]*?final_document_mime_type\s*=\s*stored_version\.content_type/iu,
  );
});

test('exact idempotent replay returns the immutable version and conflicting replay is rejected', async () => {
  const { adapter, databaseDriver } = adapterHarness();
  const firstContent = Buffer.from('immutable replay payload', 'utf8');
  const request = {
    caseId: 'case-1', objectId: 'student-replay-1', content: firstContent,
    contentType: 'text/plain', checksum: sha256(firstContent),
    contentClass: 'student_prepared', purpose: 'case_workflow',
    idempotencyKey: 'storage-replay-1',
  };
  const first = await runWithTrustedRequestContext(trustedContext(), () => adapter.put(request));
  const replay = await runWithTrustedRequestContext(trustedContext(), () => adapter.put(request));
  assert.equal(databaseDriver.records.size, 1);
  assert.equal(databaseDriver.putCalls.length, 2);
  assert.equal(replay.versionRef, first.versionRef);

  const differentContent = Buffer.from('conflicting replay payload', 'utf8');
  await assert.rejects(
    runWithTrustedRequestContext(trustedContext(), () => adapter.put({
      ...request,
      content: differentContent,
      checksum: sha256(differentContent),
    })),
    IdempotencyConflictError,
  );
  assert.equal(databaseDriver.records.size, 1);
});

test('failing HTTP storage write zeroes the decoded plaintext in a finally boundary', async () => {
  const databaseDriver = new MemoryCiphertextDatabaseDriver();
  databaseDriver.putEncryptedPrivateArtifactAtomic = async () => {
    throw new Error('synthetic database failure');
  };
  const { adapter: privateStorageService } = adapterHarness({ databaseDriver });
  const application = createLorApplicationAdapter({
    caseService: {},
    repository: { isDurable: true, durability: 'POSTGRESQL_RLS_ATOMIC' },
    privateStorageService,
  });
  const plaintext = Buffer.from('failure-only plaintext payload', 'utf8');
  const originalFill = Buffer.prototype.fill;
  let applicationBufferZeroed = false;
  Buffer.prototype.fill = function observedFill(value, ...args) {
    if (
      value === 0
      && this.byteLength === plaintext.byteLength
      && this.equals(plaintext)
      && String(new Error().stack).includes('lor-studio/http/application-adapter.mjs')
    ) applicationBufferZeroed = true;
    return Reflect.apply(originalFill, this, [value, ...args]);
  };
  try {
    const result = await runWithTrustedRequestContext(trustedContext(), () => (
      application.handleRequest({
        request: request('POST', {
          checksum: sha256(plaintext),
          contentBase64: plaintext.toString('base64'),
          contentClass: 'student_prepared',
          contentType: 'text/plain',
          purpose: 'case_workflow',
        }, { 'idempotency-key': 'http-storage-failure-1' }),
        url: new URL(
          '/api/lor-studio/cases/case-1/private-artifacts/student-failure-1',
          'https://hq.example.test',
        ),
        actor: { id: 'wp:41', role: 'student' },
      })
    ));
    assert.equal(result.status, 500);
  } finally {
    Buffer.prototype.fill = originalFill;
  }
  assert.equal(applicationBufferZeroed, true);
});

test('production environment factory requires six exact bindings and hides KEK material', () => {
  const encodedKek = Buffer.alloc(32, 0x4c).toString('base64');
  const environment = {
    MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64: encodedKek,
    MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION: 'railway-kek-2026-08-v1',
    MMHQ_LOR_PRIVATE_STORAGE_IDENTITY: 'railway-postgres:lor-private-artifacts:v1',
    MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED: 'true',
    MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED: 'true',
  };
  const databaseDriver = new MemoryCiphertextDatabaseDriver();
  const adapter = createPostgresEncryptedPrivateStorageAdapterFromEnvironment({
    binding: BINDING,
    databaseDriver,
    ...accessDependencies(),
    environment,
    clock: () => new Date(NOW),
  });
  assert.equal(adapter.durability, 'DURABLE_PROVIDER_BOUND');
  assert.equal(JSON.stringify(adapter).includes(encodedKek), false);

  assert.throws(
    () => createPostgresEncryptedPrivateStorageAdapterFromEnvironment({
      databaseDriver,
      ...accessDependencies(),
      environment: {
        ...environment,
        MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED: 'TRUE',
      },
      clock: () => new Date(NOW),
    }),
    (error) => error?.details?.status === 'PRIVATE_STORAGE_POLICY_PROOF_REQUIRED',
  );
  assert.throws(
    () => createPostgresEncryptedPrivateStorageAdapterFromEnvironment({
      binding: { ...BINDING, storageIdentity: 'different-provider' },
      databaseDriver,
      ...accessDependencies(),
      environment,
      clock: () => new Date(NOW),
    }),
    (error) => error?.details?.status === 'PRIVATE_BUCKET_BINDING_REQUIRED',
  );
});

test('KEK material is validated and never exposed on the storage driver surface', () => {
  const databaseDriver = new MemoryCiphertextDatabaseDriver();
  assert.throws(
    () => new PostgresEncryptedPrivateStorageDriver({
      databaseDriver, kek: Buffer.alloc(31), keyVersion: 'v1',
    }),
    /integration is unavailable/u,
  );
  const driver = new PostgresEncryptedPrivateStorageDriver({
    databaseDriver, kek: Buffer.alloc(32, 0x5a), keyVersion: 'v1',
  });
  assert.deepEqual(Object.keys(driver).sort(), [
    'databaseDriver', 'immutableVersions', 'keyVersion', 'privateOnly', 'randomBytesFn', 'serverOnly',
  ]);
  assert.equal(JSON.stringify(driver).includes(Buffer.alloc(32, 0x5a).toString('base64')), false);
});
