import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

import {
  PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT,
  createProductionRuntimeAssembly,
} from '../../lor-studio/adapters/production-runtime-assembly.mjs';
import { LOR_TARGET_BINDING_SCHEMA } from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  BackupRestoreCheckAdapter,
} from '../../lor-studio/adapters/operational-readiness-adapters.mjs';
import {
  PRODUCTION_RUNTIME_TARGET_ENV_KEYS,
  PRODUCTION_RUNTIME_TARGET_SCHEMA,
} from '../../lor-studio/adapters/production-runtime-target.mjs';
import {
  WORDPRESS_LOR_SESSION_IDENTITY_CLASS_FIELD,
} from '../../lor-studio/adapters/wordpress-current-user-admission.mjs';
import {
  WORDPRESS_LOR_ADMISSION_CONTRACT,
  WORDPRESS_LOR_BINDING_PROVENANCE,
  WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER,
  WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_CONTRACT,
  WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT,
  WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
} from '../../lor-studio/adapters/wordpress-lor-s2s-protocol.mjs';
import { IntegrationDisabledError } from '../../lor-studio/domain/errors.js';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import {
  DR133_RELATIONS,
  DR133_RUNTIME_LOGIN,
  DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
  DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  DR133_TARGET,
  expectedDr133SuccessorSentinel,
} from '../../scripts/lor-studio/railway-dr133-production-runner-core.mjs';
import { signedOpenAiPrivacyEnvironment } from './fixtures/signed-openai-privacy-attestations.mjs';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const DATABASE_PASSWORD = 'bounded-assembly-database-password';
const OPENAI_TOKEN = 'sk-proj-bounded-assembly-token';
const POSTMARK_TOKEN = 'postmark-bounded-assembly-token';
const INVITATION_KEY = Buffer.alloc(32, 17).toString('base64url');
const STORAGE_KEY = Buffer.alloc(32, 19).toString('base64');
const PRODUCTION_CA = await readFile(
  new URL('./dr133-production-root-ca.pem', import.meta.url),
  'utf8',
);
const DEPLOYMENT_ID = '00000000-0000-4000-8000-000000000101';
const ACTOR_CASE_ID = 'case-production-1';
const ACTOR_SUBJECT = 'wp:41';
const RESOURCE_STUDENT_ID = 'wp:42';

const BASE_RELATION_PRIVILEGES = [
  'administrative_case_grant_revocations:SELECT:false',
  'administrative_case_grants:SELECT:false',
  'consent_receipts:SELECT:false',
  'deletion_hold_releases:INSERT:false',
  'deletion_hold_releases:SELECT:false',
  'deletion_intents:INSERT:false',
  'deletion_intents:SELECT:false',
  'deletion_receipts:INSERT:false',
  'deletion_receipts:SELECT:false',
  'recommendation_case_audit_events:INSERT:false',
  'recommendation_case_audit_events:SELECT:false',
  'recommendation_case_creation_reservations:INSERT:false',
  'recommendation_case_creation_reservations:SELECT:false',
  'recommendation_cases:SELECT:false',
  'released_student_documents:SELECT:false',
  'student_auth_binding_revocations:SELECT:false',
  'student_auth_bindings:SELECT:false',
  'student_recommendation_case_projection:SELECT:false',
  'waiver_receipts:SELECT:false',
  'writer_depot_artifacts:SELECT:false',
];
const APP_RELATION_PRIVILEGES = [...BASE_RELATION_PRIVILEGES].sort();
const HELPER_FUNCTION_PRIVILEGES = [
  'ai_grounding_manifest_is_complete(jsonb)',
  'audit_event_is_metadata(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'canonical_jsonb_text(jsonb)',
  'operational_content_context_allows(text,text,text[],text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
];
const APP_FUNCTION_PRIVILEGES = [
  ...DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
  ...HELPER_FUNCTION_PRIVILEGES,
].map((identity) => `${identity}:EXECUTE:false`).sort();

function result(rows = []) {
  return { rows, fields: [] };
}

function transportReadinessRow(overrides = {}) {
  return {
    database_name: DR133_TARGET.databaseName,
    postgres_major: 18,
    current_user: DR133_RUNTIME_LOGIN,
    session_user: DR133_RUNTIME_LOGIN,
    private_server_address: true,
    ssl_active: true,
    ...overrides,
  };
}

class FakePool {
  static instances = [];

  static providerFailure = false;

  constructor(options) {
    this.options = options;
    this.endCalls = 0;
    this.listeners = new Map();
    this.queries = [];
    this.connections = 0;
    this.releases = [];
    FakePool.instances.push(this);
  }

  on(event, listener) {
    this.listeners.set(event, listener);
    return this;
  }

  removeListener(event, listener) {
    if (this.listeners.get(event) === listener) this.listeners.delete(event);
    return this;
  }

  async connect() {
    const pool = this;
    this.connections += 1;
    return {
      async query(input) {
        pool.queries.push(input);
        const text = typeof input === 'string' ? input : String(input?.text ?? '');
        if (text.includes('missionmed:dr133:lor-runtime-transport-readiness')) {
          return result([transportReadinessRow()]);
        }
        if (text.includes('lor-runtime-readiness-v2')) return result([readinessRow()]);
        if (text.includes('resolve_lor_actor_case_access')) {
          return result([{ result: Object.freeze({
            schemaVersion: 'missionmed.lor.actor-case-access.v1',
            actorId: ACTOR_SUBJECT,
            actorRole: 'faculty',
            authoritySource: 'database_verified_case_access',
            caseId: ACTOR_CASE_ID,
            resourceStudentId: RESOURCE_STUDENT_ID,
          }) }]);
        }
        return result();
      },
      release(...args) { pool.releases.push(args); },
    };
  }

  async end() {
    this.endCalls += 1;
  }
}

function resetPool() {
  FakePool.instances = [];
  FakePool.providerFailure = false;
}

function targetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'production',
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/production',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: true,
    ...overrides,
  };
}

function environment(overrides = {}) {
  return {
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.schemaVersion]: PRODUCTION_RUNTIME_TARGET_SCHEMA,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.environmentName]: DR133_TARGET.environmentName,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.executionServiceId]: DR133_TARGET.applicationServiceId,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseHost]: DR133_TARGET.databaseHost,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.databaseAdmin]: DR133_TARGET.databaseAdmin,
    [PRODUCTION_RUNTIME_TARGET_ENV_KEYS.runtimeLogin]: DR133_RUNTIME_LOGIN,
    LOR_DR133_RUNTIME_DATABASE_CA: PRODUCTION_CA,
    LOR_DR133_RUNTIME_DATABASE_URL:
      `postgresql://${DR133_RUNTIME_LOGIN}:${DATABASE_PASSWORD}`
      + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`,
    RAILWAY_DEPLOYMENT_ID: DEPLOYMENT_ID,
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_REPLICA_REGION: DR133_TARGET.region,
    RAILWAY_SERVICE_ID: DR133_TARGET.applicationServiceId,
    MMHQ_LOR_OPENAI_API_KEY: OPENAI_TOKEN,
    MMHQ_LOR_OPENAI_PROJECT_ID: 'proj_UTCDEhLVMT6aQnCXnBElihZT',
    ...signedOpenAiPrivacyEnvironment('proj_UTCDEhLVMT6aQnCXnBElihZT'),
    MMHQ_LOR_POSTMARK_SERVER_TOKEN: POSTMARK_TOKEN,
    MMHQ_LOR_POSTMARK_SERVER_ID: 'lor-assembly-server',
    MMHQ_LOR_POSTMARK_FROM_EMAIL: 'letters@example.test',
    MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL: 'support@example.test',
    MMHQ_LOR_INVITATION_ORIGIN: 'https://hq.example.test',
    MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED: 'true',
    MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED: 'true',
    MMHQ_LOR_INVITATION_HMAC_KEY: INVITATION_KEY,
    MMHQ_LOR_INVITATION_HMAC_KEY_VERSION: 'lor-assembly-v1',
    MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED: 'true',
    MMHQ_LOR_PRIVATE_STORAGE_KEK_BASE64: STORAGE_KEY,
    MMHQ_LOR_PRIVATE_STORAGE_KEY_VERSION: 'lor-storage-assembly-v1',
    MMHQ_LOR_PRIVATE_STORAGE_IDENTITY: 'postgres-production-assembly',
    MMHQ_LOR_PRIVATE_STORAGE_PROVIDER_RESOURCE_BOUND: 'true',
    MMHQ_LOR_PRIVATE_STORAGE_POLICY_VERIFIED: 'true',
    MMHQ_LOR_PRIVATE_STORAGE_INDEPENDENTLY_VERIFIED: 'true',
    ...overrides,
  };
}

function readinessRow(overrides = {}) {
  return {
    database_name: DR133_TARGET.databaseName,
    postgres_major: 18,
    current_user: 'lor_studio_app',
    session_user: DR133_RUNTIME_LOGIN,
    schema_sentinel: expectedDr133SuccessorSentinel(),
    schema_owner: DR133_TARGET.databaseAdmin,
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES,
    definer_count: String(DR133_SUCCESSOR_APPROVED_DEFINER_IDENTITIES.length),
    definer_custody_safe: true,
    app_execute_count: String(DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES.length),
    app_execute_identities: DR133_SUCCESSOR_APP_EXECUTABLE_DEFINER_IDENTITIES,
    pre_evidence_app_execute_denied: true,
    pre_evidence_public_execute_denied: true,
    public_function_execute_count: '0',
    public_relation_privilege_count: '0',
    view_count: '1',
    view_identity: 'student_recommendation_case_projection@postgres',
    security_invoker_view_count: '1',
    security_barrier_view_count: '1',
    app_role_safe: true,
    command_owner_role_safe: true,
    runtime_role_safe: true,
    runtime_membership_safe: true,
    runtime_membership_count: '1',
    runtime_owned_object_count: '0',
    app_owned_object_count: '0',
    runtime_default_acl_count: '0',
    app_relation_privileges: APP_RELATION_PRIVILEGES,
    runtime_relation_acl_count: '0',
    app_function_privileges: APP_FUNCTION_PRIVILEGES,
    runtime_function_acl_count: '0',
    unexpected_sequence_acl_count: '0',
    unexpected_column_acl_count: '0',
    app_schema_privileges: ['USAGE:false'],
    unexpected_schema_acl_count: '0',
    unexpected_acl_grantee_count: '0',
    app_schema_create_denied: true,
    runtime_schema_create_denied: true,
    app_schema_usage: true,
    ...overrides,
  };
}

function jsonResponse(url, payload, status = 200) {
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    redirected: false,
    headers: new Headers({ 'content-type': 'application/json' }),
    async text() { return JSON.stringify(payload); },
  };
}

function providerFetch({ fail = false } = {}) {
  return async (url) => {
    if (fail) return jsonResponse(url, { error: 'unavailable' }, 503);
    if (url.endsWith('/v1/models')) {
      return jsonResponse(url, { object: 'list', data: [{ id: 'gpt-5.6-terra' }] });
    }
    return jsonResponse(url, {
      Alias: 'lor-faculty-invitation-v1',
      Active: true,
      AssociatedServerId: 'lor-assembly-server',
    });
  };
}

function backupRestoreAdapter() {
  return new BackupRestoreCheckAdapter({
    binding: {
      providerResourceBound: true,
      independentlyVerified: true,
      syntheticOnly: true,
      isolatedRestoreTarget: true,
      databaseAndAuditTogether: true,
      storageVersionManifest: true,
    },
    checker: {
      async runCheck(request) {
        assert.equal(request.syntheticOnly, true);
        assert.equal(request.metadataOnly, true);
        return { passed: true, errorCode: '' };
      },
    },
    clock: () => NOW,
  });
}

function resourceEntitlementResolver(calls, entitlementOverrides = {}) {
  return Object.freeze({
    signedS2s: true,
    async resolve(request) {
      calls.push(Object.freeze({ kind: 'resolve', ...request }));
      return Object.freeze({
        contract: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_CONTRACT,
        audience: 'lor-studio',
        requesterSubject: request.authenticatedSubject,
        actorRole: request.actorRole,
        active: true,
        canaryConsented: true,
        canaryEnabled: true,
        lorEnabled: true,
        producerStatus: WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER,
        revoked: false,
        studentId: request.studentId,
        tier: 'tier3_360',
        metadataOnly: true,
        evaluatedAt: '2026-08-26T11:59:30.000Z',
        expiresAt: '2026-08-26T12:03:30.000Z',
        ...entitlementOverrides,
      });
    },
    async probe({ signal } = {}) {
      assert.equal(signal instanceof AbortSignal, true);
      calls.push(Object.freeze({ kind: 'probe', metadataOnly: true }));
      return Object.freeze({
        contract: WORDPRESS_LOR_RESOURCE_STUDENT_ENTITLEMENT_PROBE_CONTRACT,
        audience: 'lor-studio',
        ready: true,
        metadataOnly: true,
        producerStatus: WORDPRESS_LOR_RESOURCE_ENTITLEMENT_PRODUCER,
        evaluatedAt: '2026-08-26T11:59:30.000Z',
        expiresAt: '2026-08-26T12:03:30.000Z',
      });
    },
  });
}

function wordpressS2sClient(admissions, resourceResolver, admissionOverrides = {}) {
  return Object.freeze({
    async admit(request) {
      admissions.push(Object.freeze({ ...request }));
      return Object.freeze({
        contract: WORDPRESS_LOR_ADMISSION_CONTRACT,
        subject: request.subject,
        identityClass: request.identityClass,
        admitted: true,
        canaryEnabled: true,
        canaryConsented: true,
        evaluatedAt: '2026-08-26T11:59:30.000Z',
        expiresAt: '2026-08-26T12:03:30.000Z',
        ...admissionOverrides,
      });
    },
    getResourceStudentEntitlement: resourceResolver.resolve,
    probeResourceStudentEntitlement: resourceResolver.probe,
    async redeemBootstrap() { throw new Error('not called by assembly'); },
    resourceEntitlementPort: resourceResolver,
    async revokeBinding() { throw new Error('not called by assembly'); },
  });
}

function releaseFlags(overrides = {}) {
  return Object.freeze({ enabled: true, killSwitch: false, requireCanary: true, ...overrides });
}

function assemblyOptions(overrides = {}) {
  const entitlementCalls = [];
  const admissions = [];
  const resourceResolver = resourceEntitlementResolver(entitlementCalls);
  return {
    targetConfiguration: targetConfiguration(),
    releaseFlags: releaseFlags(),
    wordpressS2sClient: wordpressS2sClient(admissions, resourceResolver),
    resourceEntitlementResolver: resourceResolver,
    backupRestoreAdapter: backupRestoreAdapter(),
    environment: environment(),
    fetchImplementation: providerFetch(),
    clock: () => NOW,
    poolClass: FakePool,
    probeTimeoutMilliseconds: 500,
    ...overrides,
    testObservations: { entitlementCalls, admissions },
  };
}

function withoutTestObservations(options) {
  const { testObservations, ...assembly } = options;
  return { assembly, testObservations };
}

function statusIs(status) {
  return (error) => error instanceof IntegrationDisabledError
    && error.details?.integration === 'lor_production_runtime_assembly'
    && error.details?.status === status;
}

test('assembles one production pool, exact nine live probes, shared flags, and actor-bound admission', async () => {
  resetPool();
  const { assembly: options, testObservations } = withoutTestObservations(assemblyOptions());
  const assembled = await createProductionRuntimeAssembly(options);

  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0].connections, 6);
  assert.ok(
    FakePool.instances[0].queries[0].text
      .includes('missionmed:dr133:lor-runtime-transport-readiness'),
  );
  assert.equal(FakePool.instances[0].queries[1], 'BEGIN ISOLATION LEVEL READ COMMITTED');
  assert.deepEqual(FakePool.instances[0].releases[0], []);
  assert.equal(Object.isFrozen(assembled), true);
  assert.deepEqual(Object.keys(assembled), [
    'composition',
    'admission',
    'candidateAuthService',
    'resourceEntitlementResolver',
  ]);
  assert.equal(Object.isFrozen(assembled.composition), true);
  assert.equal(assembled.composition.runtimeDependencies.close instanceof Function, true);
  assert.equal(assembled.composition.entitlementPort, assembled.admission);
  assert.equal(assembled.composition.caseService.requireCanary, options.releaseFlags.requireCanary);
  assert.equal(assembled.composition.operationalReadiness.status, 'ready');
  assert.equal(assembled.composition.operationalReadiness.productionOperational, true);
  assert.deepEqual(
    Object.keys(assembled.composition.operationalReadiness.dependencies).sort(),
    [
      'administrativeGrants', 'ai', 'audit', 'backupRestore', 'email', 'entitlement',
      'hydration', 'otp', 'repository', 'rls', 'storage',
    ],
  );
  assert.deepEqual(testObservations.entitlementCalls[0], {
    kind: 'probe',
    metadataOnly: true,
  });

  const projection = await assembled.admission.resolve({
    subject: ACTOR_SUBJECT,
    session: {
      user: { id: 41 },
      lorAdmissionBindingId: `lorb1_${'a'.repeat(43)}`,
      lorAdmissionBindingProvenance: WORDPRESS_LOR_BINDING_PROVENANCE,
      lorAdmissionBindingExpiresAt: '2026-08-26T13:00:00.000Z',
      [WORDPRESS_LOR_SESSION_IDENTITY_CLASS_FIELD]: WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    },
    request: { url: `/api/lor-studio/cases/${ACTOR_CASE_ID}` },
  });
  assert.equal(projection.role, 'faculty');
  assert.equal(projection.studentId, RESOURCE_STUDENT_ID);
  assert.deepEqual(testObservations.admissions, [{
    bindingId: `lorb1_${'a'.repeat(43)}`,
    subject: ACTOR_SUBJECT,
    identityClass: WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
  }]);
  assert.deepEqual(testObservations.entitlementCalls.at(-1), {
    kind: 'resolve',
    authenticatedSubject: ACTOR_SUBJECT,
    actorRole: 'faculty',
    studentId: RESOURCE_STUDENT_ID,
  });

  const serialized = JSON.stringify(assembled);
  for (const secret of [DATABASE_PASSWORD, OPENAI_TOKEN, POSTMARK_TOKEN, INVITATION_KEY, STORAGE_KEY]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.doesNotMatch(serialized, /api[_-]?key|password|private_storage_kek|server_token/iu);

  await assembled.composition.runtimeDependencies.close();
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('canonical dark mode retains the dependency-verified graph while public LOR routes stay 404', async () => {
  resetPool();
  const darkFlags = releaseFlags({ enabled: false, killSwitch: true, requireCanary: true });
  const { assembly } = withoutTestObservations(assemblyOptions({ releaseFlags: darkFlags }));
  const assembled = await createProductionRuntimeAssembly(assembly);

  assert.equal(assembled.composition.operationalReadiness.status, 'closed');
  assert.equal(assembled.composition.operationalReadiness.reason, 'feature_disabled');
  assert.equal(assembled.composition.operationalReadiness.productionOperational, false);
  assert.ok(Object.values(assembled.composition.operationalReadiness.dependencies)
    .every((dependency) => dependency.state === 'ready'));
  assert.ok(Object.values(assembled.composition.operationalReadiness.databaseProbeGroups)
    .every((ready) => ready === true));

  const runtime = createLorStudioRuntime({
    publicDirectory: '/tmp/lor-production-dark-test',
    flags: darkFlags,
    entitlementResolver: assembled.admission,
    application: assembled.composition.application,
    candidateAuthStartService: assembled.candidateAuthService,
    validateCsrf: () => true,
  });
  const request = Readable.from([]);
  request.method = 'POST';
  request.headers = {};
  request.url = '/api/lor-studio/auth/candidate/start';
  const response = {
    statusCode: 0,
    chunks: [],
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); },
  };
  const handled = await runtime.handle(
    request,
    response,
    new URL(request.url, 'https://hq.example.test'),
    { session: null },
  );
  assert.equal(handled, true);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(JSON.parse(Buffer.concat(response.chunks).toString('utf8')), {
    error: 'lor_feature_disabled',
  });

  await assembled.composition.runtimeDependencies.close();
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('full rollout shares requireCanary=false with case services and WordPress admission', async () => {
  resetPool();
  const rolloutFlags = releaseFlags({ requireCanary: false });
  const options = assemblyOptions({ releaseFlags: rolloutFlags });
  const entitlementCalls = [];
  const admissions = [];
  const rolloutResolver = resourceEntitlementResolver(entitlementCalls, {
    canaryConsented: false,
    canaryEnabled: false,
  });
  options.resourceEntitlementResolver = rolloutResolver;
  options.wordpressS2sClient = wordpressS2sClient(admissions, rolloutResolver, {
    canaryConsented: false,
    canaryEnabled: false,
  });
  const { assembly } = withoutTestObservations(options);
  const assembled = await createProductionRuntimeAssembly(assembly);

  assert.equal(assembled.composition.operationalReadiness.status, 'ready');
  assert.equal(assembled.composition.operationalReadiness.productionOperational, true);
  assert.equal(assembled.composition.caseService.requireCanary, false);
  const projection = await assembled.admission.resolve({
    subject: ACTOR_SUBJECT,
    session: {
      user: { id: 41 },
      lorAdmissionBindingId: `lorb1_${'a'.repeat(43)}`,
      lorAdmissionBindingProvenance: WORDPRESS_LOR_BINDING_PROVENANCE,
      lorAdmissionBindingExpiresAt: '2026-08-26T13:00:00.000Z',
      [WORDPRESS_LOR_SESSION_IDENTITY_CLASS_FIELD]: WORDPRESS_LOR_STUDENT_IDENTITY_CLASS,
    },
    request: { url: `/api/lor-studio/cases/${ACTOR_CASE_ID}` },
  });
  assert.equal(projection.canaryEnabled, false);
  assert.equal(projection.canaryConsented, false);

  await assembled.composition.runtimeDependencies.close();
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('pre-wrapper provider binding failure closes the single database owner exactly once', async () => {
  resetPool();
  const options = assemblyOptions({
    environment: environment({ MMHQ_LOR_OPENAI_API_KEY: '' }),
  });
  const { assembly } = withoutTestObservations(options);
  await assert.rejects(createProductionRuntimeAssembly(assembly), statusIs('ASSEMBLY_PREPARATION_FAILED'));
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('live provider probe failure fails closed and the readiness wrapper closes one pool once', async () => {
  resetPool();
  const { assembly } = withoutTestObservations(assemblyOptions({
    fetchImplementation: providerFetch({ fail: true }),
  }));
  await assert.rejects(createProductionRuntimeAssembly(assembly), statusIs('RUNTIME_READINESS_FAILED'));
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('dark mode still requires every live provider probe and closes on failure', async () => {
  resetPool();
  const { assembly } = withoutTestObservations(assemblyOptions({
    releaseFlags: releaseFlags({ enabled: false, killSwitch: true, requireCanary: true }),
    fetchImplementation: providerFetch({ fail: true }),
  }));
  await assert.rejects(createProductionRuntimeAssembly(assembly), statusIs('RUNTIME_READINESS_FAILED'));
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('caller-supplied administrative and hydration surfaces are rejected before allocation', async () => {
  resetPool();
  const base = withoutTestObservations(assemblyOptions()).assembly;
  const copiedReadinessLookAlike = Object.freeze({
    async probe() {
      return Object.freeze({ ready: true });
    },
  });
  const copiedApplicationLookAlike = Object.freeze({
    async getBootstrap() {
      return Object.freeze({ operational: true });
    },
    async handleRequest() {
      return Object.freeze({ status: 200 });
    },
  });

  for (const extra of [
    { administrativeGrantRepository: copiedReadinessLookAlike },
    { hydrationAdapter: copiedApplicationLookAlike },
    { administrativeGrantsReadiness: Object.freeze({ ...copiedReadinessLookAlike }) },
    { hydrationApplication: Object.freeze({ ...copiedApplicationLookAlike }) },
  ]) {
    await assert.rejects(
      createProductionRuntimeAssembly({ ...base, ...extra }),
      statusIs('OPTIONS_INVALID'),
    );
  }
  assert.equal(FakePool.instances.length, 0);
});

test('a plain backup adapter look-alike cannot replace its authenticated surface', async () => {
  resetPool();
  const { assembly } = withoutTestObservations(assemblyOptions({
    backupRestoreAdapter: Object.freeze({
      describePlan() {},
      async runSyntheticRehearsal() {},
    }),
  }));
  await assert.rejects(
    createProductionRuntimeAssembly(assembly),
    statusIs('ASSEMBLY_PREPARATION_FAILED'),
  );
  assert.equal(FakePool.instances.length, 1);
  assert.equal(FakePool.instances[0].endCalls, 1);
});

test('caller-supplied coordinator/provider/storage shortcuts and target fallback are rejected', async () => {
  resetPool();
  const base = withoutTestObservations(assemblyOptions()).assembly;
  for (const extra of [
    { trustedProbeCoordinator: Object.freeze({ targetBound: true }) },
    { providerRuntime: Object.freeze({}) },
    { storageAdapter: Object.freeze({}) },
  ]) {
    await assert.rejects(
      createProductionRuntimeAssembly({ ...base, ...extra }),
      statusIs('OPTIONS_INVALID'),
    );
  }
  assert.equal(FakePool.instances.length, 0);

  await assert.rejects(
    createProductionRuntimeAssembly({
      ...base,
      targetConfiguration: targetConfiguration({
        environment: 'staging',
        productionDataBindingPassed: false,
      }),
    }),
    statusIs('EXACT_DR133_PRODUCTION_TARGET_REQUIRED'),
  );
  assert.equal(FakePool.instances.length, 0);
});

test('release flags are an exact frozen shared contract and cannot be widened', async () => {
  resetPool();
  const base = withoutTestObservations(assemblyOptions()).assembly;
  await assert.rejects(
    createProductionRuntimeAssembly({
      ...base,
      releaseFlags: { enabled: true, killSwitch: false, requireCanary: true },
    }),
    statusIs('RELEASE_FLAGS_INVALID'),
  );
  await assert.rejects(
    createProductionRuntimeAssembly({
      ...base,
      releaseFlags: Object.freeze({
        enabled: true,
        killSwitch: false,
        requireCanary: true,
        providersReady: true,
      }),
    }),
    statusIs('RELEASE_FLAGS_INVALID'),
  );
  assert.equal(FakePool.instances.length, 0);
  for (const contradictory of [
    { enabled: true, killSwitch: true, requireCanary: true },
    { enabled: false, killSwitch: false, requireCanary: true },
    { enabled: false, killSwitch: true, requireCanary: false },
  ]) {
    await assert.rejects(
      createProductionRuntimeAssembly({
        ...base,
        releaseFlags: Object.freeze(contradictory),
      }),
      statusIs('RUNTIME_READINESS_FAILED'),
    );
    assert.equal(FakePool.instances.at(-1).endCalls, 1);
  }
  assert.equal(FakePool.instances.length, 3);
});

test('contract exposes no fallback, no caller coordinator, and no readiness hydration', () => {
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.databasePoolCount, 1);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.fallback, null);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.callerCoordinatorAccepted, false);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.callerProviderRuntimeAccepted, false);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.callerAdministrativeGrantSurfaceAccepted, false);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.callerHydrationSurfaceAccepted, false);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.hydrationDuringReadiness, false);
  assert.equal(PRODUCTION_RUNTIME_ASSEMBLY_CONTRACT.secretOutput, 'prohibited');
});
