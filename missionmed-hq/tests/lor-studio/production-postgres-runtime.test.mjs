import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import test from 'node:test';
import { rootCertificates } from 'node:tls';

import {
  IntegrationDisabledError,
} from '../../lor-studio/domain/errors.js';
import {
  PRODUCTION_POSTGRES_RUNTIME_CONTRACT,
  createProductionPostgresRuntimeDependencies,
} from '../../lor-studio/adapters/production-postgres-runtime.mjs';
import {
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
  runWithTrustedRequestContext,
} from '../../lor-studio/security/trusted-request-context.mjs';
import {
  DR133_APPROVED_DEFINER_IDENTITIES,
  DR133_RELATIONS,
  DR133_RUNTIME_LOGIN,
  DR133_TARGET,
  expectedDr133Sentinel,
} from '../../scripts/lor-studio/railway-dr133-runner-core.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const BINDING_ID = `binding_${'c'.repeat(64)}`;
const AUTH_UID = '00000000-0000-4000-8000-000000000001';
const DEPLOYMENT_ID = '00000000-0000-4000-8000-000000000002';
const PASSWORD = 'd'.repeat(43);
const TEST_CA = rootCertificates.find((candidate) => {
  try {
    const certificate = new X509Certificate(candidate);
    const now = Date.now();
    return certificate.ca === true && certificate.checkIssued(certificate)
      && certificate.verify(certificate.publicKey)
      && Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo);
  } catch {
    return false;
  }
});
if (!TEST_CA) throw new Error('Node runtime has no valid self-signed test root CA');
const DEFINERS = [
  ...DR133_APPROVED_DEFINER_IDENTITIES,
  'ensure_student_auth_binding(text,text,text)',
  'resolve_faculty_case_scope(text,text,text)',
  'resolve_mentor_case_scope(text,text,text)',
  'revoke_student_auth_binding(text,text)',
].sort();
const APP_RELATION_PRIVILEGES = [
  'administrative_case_grant_revocations:SELECT:false',
  'administrative_case_grants:SELECT:false',
  'ai_generation_runs:INSERT:false',
  'ai_generation_runs:SELECT:false',
  'ai_letter_proposals:INSERT:false',
  'ai_letter_proposals:SELECT:false',
  'ai_proposal_decisions:SELECT:false',
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
].sort();
const APP_FUNCTION_PRIVILEGES = [
  ...DEFINERS,
  'ai_grounding_manifest_is_complete(jsonb)',
  'audit_event_is_metadata(jsonb)',
  'canonical_jsonb_sha256(jsonb)',
  'canonical_jsonb_text(jsonb)',
  'operational_content_context_allows(text,text,text[],text[])',
  'student_context_allows(text,text,uuid,text[])',
  'student_write_axes_satisfied()',
].map((identity) => `${identity}:EXECUTE:false`).sort();

function result(rows = []) {
  return { rows, fields: [] };
}

class FakePool {
  static instances = [];

  static behavior = {};

  constructor(options) {
    this.options = options;
    this.calls = [];
    this.connections = 0;
    this.releases = [];
    this.endCalls = 0;
    this.listeners = new Map();
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

  emit(event, error) {
    this.listeners.get(event)?.(error);
  }

  async connect() {
    if (FakePool.behavior.connectError) throw FakePool.behavior.connectError;
    this.connections += 1;
    const pool = this;
    return {
      async query(input) {
        pool.calls.push(input);
        if (FakePool.behavior.query) return FakePool.behavior.query(input, pool);
        return result();
      },
      release(...args) {
        pool.releases.push(args);
      },
    };
  }

  async end() {
    this.endCalls += 1;
    if (FakePool.behavior.end) return FakePool.behavior.end(this);
    return undefined;
  }
}

function resetPool(behavior = {}) {
  FakePool.instances = [];
  FakePool.behavior = behavior;
}

function binding() {
  return resolveLorTargetBinding({
    schemaVersion: 'missionmed.lor.target-binding.v2',
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'staging',
    provider: DR133_TARGET.provider,
    projectId: DR133_TARGET.projectId,
    environmentId: DR133_TARGET.environmentId,
    serviceId: DR133_TARGET.databaseServiceId,
    databaseName: DR133_TARGET.databaseName,
    region: DR133_TARGET.region,
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/staging',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
  });
}

function environment(overrides = {}) {
  return {
    LOR_DR133_RUNTIME_DATABASE_CA: TEST_CA,
    LOR_DR133_RUNTIME_DATABASE_URL:
      `postgresql://${DR133_RUNTIME_LOGIN}:${PASSWORD}`
      + `@${DR133_TARGET.databaseHost}:5432/${DR133_TARGET.databaseName}?sslmode=require`,
    RAILWAY_DEPLOYMENT_ID: DEPLOYMENT_ID,
    RAILWAY_ENVIRONMENT_ID: DR133_TARGET.environmentId,
    RAILWAY_ENVIRONMENT_NAME: DR133_TARGET.environmentName,
    RAILWAY_PROJECT_ID: DR133_TARGET.projectId,
    RAILWAY_REPLICA_REGION: DR133_TARGET.region,
    RAILWAY_SERVICE_ID: DR133_TARGET.executionServiceId,
    ...overrides,
  };
}

function runtime() {
  return createProductionPostgresRuntimeDependencies(binding(), {
    environment: environment(),
    PoolClass: FakePool,
  });
}

function context(overrides = {}) {
  return {
    schemaVersion: TRUSTED_REQUEST_CONTEXT_SCHEMA_VERSION,
    authenticatedSubject: 'wp:123',
    actorRole: 'student',
    sourceReferenceHash: HASH_A,
    proofHash: HASH_B,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    clientAsserted: false,
    ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.student-auth-binding-receipt.v1',
    studentAuthSubject: 'wp:123',
    studentAuthUid: AUTH_UID,
    bindingId: BINDING_ID,
    bindingSource: 'wordpress_verified_bootstrap',
    sourceReferenceHash: HASH_A,
    boundAt: '2026-08-25T12:00:00.000Z',
    expiresAt: null,
    replayed: false,
    ...overrides,
  };
}

function facultyScope(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: AUTH_UID,
    authenticatedSubject: 'wp:456',
    actorId: 'wp:456',
    actorRole: 'faculty',
    resourceStudentId: 'wp:123',
    caseId: 'case-1',
    operation: 'save',
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId: 'invitation-1',
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    ...overrides,
  };
}

function mentorScope(overrides = {}) {
  return {
    ...facultyScope(),
    authenticatedSubject: 'wp:789',
    actorId: 'wp:789',
    actorRole: 'mentor',
    operation: 'read',
    purpose: 'assigned_mentor_review',
    assignmentId: 'assignment-1',
    invitationId: null,
    ...overrides,
  };
}

function readinessRow(overrides = {}) {
  return {
    database_name: DR133_TARGET.databaseName,
    postgres_major: 16,
    current_user: 'lor_studio_app',
    session_user: DR133_RUNTIME_LOGIN,
    private_server_address: true,
    ssl_active: true,
    schema_sentinel: `${expectedDr133Sentinel()}|identityScope=20260825010300`,
    schema_owner: DR133_TARGET.databaseAdmin,
    relation_names: [...DR133_RELATIONS].sort(),
    relation_count: String(DR133_RELATIONS.length),
    forced_rls_count: String(DR133_RELATIONS.length),
    definer_identities: DEFINERS,
    definer_count: String(DEFINERS.length),
    definer_custody_safe: true,
    app_execute_count: String(DEFINERS.length),
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

function statusIs(status) {
  return (error) => error instanceof IntegrationDisabledError
    && error.details?.status === status;
}

function queryObjects(pool) {
  return pool.calls.filter((entry) => entry && typeof entry === 'object');
}

test('constructs one closure-private pool and exposes only the frozen runtime surface', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];

  assert.deepEqual(Object.keys(dependencies), ['driver', 'scopeProvider', 'readiness', 'close']);
  assert.equal(Object.isFrozen(dependencies), true);
  assert.equal(Object.isFrozen(dependencies.driver), true);
  assert.equal(Object.hasOwn(dependencies, 'pool'), false);
  assert.equal(Object.hasOwn(dependencies, 'executor'), false);
  assert.equal(pool.options.connectionString.includes(PASSWORD), true);
  assert.equal(pool.options.ssl.ca, new X509Certificate(TEST_CA).toString());
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(pool.options.ssl.minVersion, 'TLSv1.2');
  assert.equal(pool.options.enableChannelBinding, true);
  assert.equal(pool.options.max, 10);
  assert.equal(pool.listeners.has('error'), true);
  assert.doesNotMatch(JSON.stringify(dependencies), new RegExp(PASSWORD, 'u'));
  assert.equal(Object.isFrozen(PRODUCTION_POSTGRES_RUNTIME_CONTRACT.publicSurface), true);

  await dependencies.close();
});

test('rejects wrong Railway identity, extra LOR keys, malformed URL, and forged binding pre-pool', () => {
  resetPool();
  const cases = [
    environment({ RAILWAY_SERVICE_ID: DR133_TARGET.databaseServiceId }),
    environment({ LOR_DR133_DATABASE_URL: 'forbidden' }),
    environment({ LOR_DR133_RUNTIME_DATABASE_CA: 'not-a-certificate' }),
    environment({
      LOR_DR133_RUNTIME_DATABASE_URL:
        `postgresql://${DR133_RUNTIME_LOGIN}:${PASSWORD}@localhost:5432/railway?sslmode=require`,
    }),
  ];
  for (const candidate of cases) {
    assert.throws(
      () => createProductionPostgresRuntimeDependencies(binding(), {
        environment: candidate,
        PoolClass: FakePool,
      }),
      (error) => error instanceof IntegrationDisabledError,
    );
  }
  assert.throws(
    () => createProductionPostgresRuntimeDependencies({ ...binding() }, {
      environment: environment(),
      PoolClass: FakePool,
    }),
    statusIs('VALIDATED_TARGET_BINDING_REQUIRED'),
  );
  assert.equal(FakePool.instances.length, 0);
});

test('requires active trusted context and rejects request accessors before a connection', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];

  await assert.rejects(
    dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    }),
    statusIs('TRUSTED_REQUEST_CONTEXT_REQUIRED'),
  );

  const accessor = { operation: 'read', resourceStudentId: 'wp:123' };
  Object.defineProperty(accessor, 'caseId', {
    enumerable: true,
    get() {
      throw new Error('must not execute');
    },
  });
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider(accessor)),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );
  assert.equal(pool.connections, 0);
  await dependencies.close();
});

test('student binding uses exact 15-GUC ordering and returns a detached frozen scope', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
        return result([{ result: receipt() }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const scope = await runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
    caseId: 'case-1', operation: 'create', resourceStudentId: 'wp:123',
  }));
  const pool = FakePool.instances[0];
  const objects = queryObjects(pool);
  const gucs = objects.find((entry) => entry.text.includes("request.jwt.claim.sub"));
  const command = objects.find((entry) => entry.text.includes('ensure_student_auth_binding'));

  assert.deepEqual(gucs.values, [
    '', 'wp:123', 'service', 'wp:123', '', 'ensure_student_binding',
    'wordpress_verified_bootstrap', '', '', '', 'true', 'true', 'true',
    'wordpress-admission-v2', 'true',
  ]);
  assert.deepEqual(command.values, ['wp:123', HASH_A, HASH_B]);
  assert.equal(gucs.text.includes('wp:123'), false);
  assert.equal(command.text.includes(HASH_A), false);
  assert.equal(scope.actorRole, 'student');
  assert.equal(scope.resourceStudentId, 'wp:123');
  assert.equal(scope.purpose, 'student_case_write');
  assert.equal(Object.isFrozen(scope), true);
  assert.deepEqual(pool.calls.filter((entry) => typeof entry === 'string'), [
    'BEGIN ISOLATION LEVEL READ COMMITTED',
    'SET LOCAL ROLE lor_studio_app',
    'COMMIT',
  ]);
  assert.deepEqual(pool.releases, [[]]);
  await dependencies.close();
});

test('student subject mismatch and malformed database receipt fail closed', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
        return result([{ result: receipt({ unexpected: true }) }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const request = { caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:999' };
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider(request)),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  assert.equal(FakePool.instances[0].connections, 0);

  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );
  assert.equal(FakePool.instances[0].calls.includes('ROLLBACK'), true);
  assert.equal(FakePool.instances[0].calls.includes('COMMIT'), false);
  await dependencies.close();
});

test('faculty and mentor use database-resolved resource scope with exact GUCs', async () => {
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('resolve_faculty_case_scope')) {
        return result([{ result: facultyScope() }]);
      }
      if (typeof input !== 'string' && input.text.includes('resolve_mentor_case_scope')) {
        return result([{ result: mentorScope() }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const faculty = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:456',
      actorRole: 'faculty',
      sourceReferenceHash: null,
      proofHash: null,
    }),
    () => dependencies.scopeProvider({ caseId: 'case-1', operation: 'save' }),
  );
  const mentor = await runWithTrustedRequestContext(
    context({
      authenticatedSubject: 'wp:789',
      actorRole: 'mentor',
      sourceReferenceHash: null,
      proofHash: null,
    }),
    () => dependencies.scopeProvider({ caseId: 'case-1', operation: 'read' }),
  );
  const gucs = queryObjects(FakePool.instances[0])
    .filter((entry) => entry.text.includes("request.jwt.claim.sub"));

  assert.deepEqual(gucs[0].values, [
    '', 'wp:456', 'faculty', '', 'case-1', 'save', 'faculty_scope_resolution',
    '', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.deepEqual(gucs[1].values, [
    '', 'wp:789', 'mentor', '', 'case-1', 'read', 'mentor_scope_resolution',
    '', '', '', 'true', 'true', 'true', '', 'true',
  ]);
  assert.equal(faculty.resourceStudentId, 'wp:123');
  assert.equal(mentor.resourceStudentId, 'wp:123');
  assert.equal(faculty.invitationId, 'invitation-1');
  assert.equal(mentor.assignmentId, 'assignment-1');

  await assert.rejects(
    runWithTrustedRequestContext(
      context({
        authenticatedSubject: 'wp:456',
        actorRole: 'faculty',
        sourceReferenceHash: null,
        proofHash: null,
      }),
      () => dependencies.scopeProvider({
        caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
      }),
    ),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  await dependencies.close();
});

test('actor scopes reject null, malformed, mismatched, and forbidden operations', async () => {
  let returnedScope = null;
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('resolve_faculty_case_scope')) {
        return result([{ result: returnedScope }]);
      }
      if (typeof input !== 'string' && input.text.includes('resolve_mentor_case_scope')) {
        return result([{ result: returnedScope }]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const facultyContext = context({
    authenticatedSubject: 'wp:456',
    actorRole: 'faculty',
    sourceReferenceHash: null,
    proofHash: null,
  });
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );

  returnedScope = facultyScope({ unexpected: true });
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'save',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );

  returnedScope = facultyScope();
  const mentorContext = context({
    authenticatedSubject: 'wp:789',
    actorRole: 'mentor',
    sourceReferenceHash: null,
    proofHash: null,
  });
  await assert.rejects(
    runWithTrustedRequestContext(mentorContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read',
    })),
    statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED'),
  );

  const connectionsBeforeForbiddenOperations = FakePool.instances[0].connections;
  await assert.rejects(
    runWithTrustedRequestContext(facultyContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'create',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  await assert.rejects(
    runWithTrustedRequestContext(mentorContext, () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'save',
    })),
    (error) => error.code === 'AUTHORIZATION_DENIED',
  );
  assert.equal(FakePool.instances[0].connections, connectionsBeforeForbiddenOperations);
  assert.equal(
    FakePool.instances[0].calls.filter((entry) => entry === 'ROLLBACK').length,
    3,
  );
  assert.equal(FakePool.instances[0].calls.includes('COMMIT'), false);
  await dependencies.close();
});

test('database denials do not enumerate and all other failures are redacted', async () => {
  for (const code of ['P1101', 'P1201', 'P1102', 'P1205', '08006']) {
    const secret = `database-secret-${code}`;
    resetPool({
      query(input) {
        if (typeof input !== 'string' && input.text.includes('ensure_student_auth_binding')) {
          const error = new Error(secret);
          error.code = code;
          throw error;
        }
        return result();
      },
    });
    const dependencies = runtime();
    const operation = runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    }));
    if (['P1101', 'P1201'].includes(code)) {
      await assert.rejects(operation, (error) => error.code === 'AUTHORIZATION_DENIED'
        && !error.message.includes(secret));
    } else {
      await assert.rejects(operation, (error) => statusIs('RUNTIME_SCOPE_RESOLUTION_FAILED')(error)
        && !error.message.includes(secret));
    }
    const pool = FakePool.instances[0];
    assert.equal(pool.calls.includes('ROLLBACK'), true);
    assert.equal(pool.calls.includes('COMMIT'), false);
    assert.deepEqual(pool.releases, [[]]);
    await dependencies.close();
  }
});

test('readiness requires the exact DR-133 catalog fingerprint', async () => {
  let row = readinessRow();
  resetPool({
    query(input) {
      if (typeof input !== 'string' && input.text.includes('missionmed:dr133:lor-runtime-readiness')) {
        return result([row]);
      }
      return result();
    },
  });
  const dependencies = runtime();
  const ready = await dependencies.readiness.probe();
  assert.equal(ready.ready, true);
  assert.equal(ready.reasonCode, 'READY');
  assert.equal(Object.isFrozen(ready), true);
  assert.equal(Object.isFrozen(ready.checks), true);
  assert.equal(Object.values(ready.checks).every(Boolean), true);

  const drifts = [
    { postgres_major: 17 },
    { schema_sentinel: expectedDr133Sentinel() },
    { relation_names: [...DR133_RELATIONS].sort().slice(1) },
    { definer_custody_safe: false },
    { security_barrier_view_count: '0' },
    { runtime_membership_count: '2' },
    { runtime_owned_object_count: '1' },
    { app_owned_object_count: '1' },
    { app_schema_privileges: ['CREATE:false', 'USAGE:false'] },
    { unexpected_schema_acl_count: '1' },
    { unexpected_acl_grantee_count: '1' },
    { app_schema_create_denied: false },
    { app_relation_privileges: [...APP_RELATION_PRIVILEGES, 'faculty_private_content:SELECT:false'] },
    { runtime_relation_acl_count: '1' },
    { app_function_privileges: [...APP_FUNCTION_PRIVILEGES, 'unsafe_helper():EXECUTE:true'] },
    { runtime_function_acl_count: '1' },
    { unexpected_sequence_acl_count: '1' },
    { unexpected_column_acl_count: '1' },
  ];
  for (const drift of drifts) {
    row = readinessRow(drift);
    const observed = await dependencies.readiness.probe();
    assert.equal(observed.ready, false);
    assert.equal(observed.reasonCode, 'CATALOG_FINGERPRINT_MISMATCH');
  }
  await dependencies.close();
});

test('pool errors poison new work without exposing their message', async () => {
  resetPool();
  const dependencies = runtime();
  const pool = FakePool.instances[0];
  const secret = 'pool-secret-that-must-not-escape';
  pool.emit('error', new Error(secret));

  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    (error) => statusIs('RUNTIME_DATABASE_UNAVAILABLE')(error)
      && !error.message.includes(secret),
  );
  assert.equal(pool.connections, 0);
  assert.throws(
    () => dependencies.driver.selectCase({}),
    statusIs('RUNTIME_DATABASE_UNAVAILABLE'),
  );
  const readiness = await dependencies.readiness.probe();
  assert.equal(readiness.ready, false);
  assert.equal(readiness.reasonCode, 'DATABASE_UNAVAILABLE');
  await dependencies.close();
});

test('close is idempotent, rejects new work, and retains the listener through pool.end', async () => {
  let listenerPresentDuringEnd = false;
  resetPool({
    async end(pool) {
      listenerPresentDuringEnd = pool.listeners.has('error');
    },
  });
  const dependencies = runtime();
  const pool = FakePool.instances[0];
  const first = dependencies.close();
  const second = dependencies.close();
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(listenerPresentDuringEnd, true);
  assert.equal(pool.listeners.has('error'), false);
  assert.equal(pool.endCalls, 1);
  await assert.rejects(
    runWithTrustedRequestContext(context(), () => dependencies.scopeProvider({
      caseId: 'case-1', operation: 'read', resourceStudentId: 'wp:123',
    })),
    statusIs('RUNTIME_DATABASE_UNAVAILABLE'),
  );
  assert.equal(pool.connections, 0);
});

test('pool close and construction failures are redacted and clean up once', async () => {
  const secret = 'close-secret-that-must-not-escape';
  resetPool({
    async end() {
      throw new Error(secret);
    },
  });
  const dependencies = runtime();
  await assert.rejects(
    dependencies.close(),
    (error) => statusIs('POOL_CLOSE_FAILED')(error) && !error.message.includes(secret),
  );
  assert.equal(FakePool.instances[0].endCalls, 1);

  let ends = 0;
  class InvalidPool {
    connect() {}

    on() {}

    async end() {
      ends += 1;
    }
  }
  assert.throws(
    () => createProductionPostgresRuntimeDependencies(binding(), {
      environment: environment(),
      PoolClass: InvalidPool,
    }),
    statusIs('RUNTIME_DEPENDENCY_CONSTRUCTION_FAILED'),
  );
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(ends, 1);
});
