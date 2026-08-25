import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DENIED_TARGET_IDENTIFIERS,
  LOR_TARGET_BINDING_CONTRACT,
  LOR_TARGET_BINDING_SCHEMA,
  LOR_TARGET_IDENTITY_FIELDS,
  assertValidatedLorTargetBinding,
  isDeniedTargetIdentifier,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  SUPABASE_LOR_REPOSITORY_CONTRACT,
  SupabaseDurableRecommendationCaseRepository,
} from '../../lor-studio/repositories/supabase-durable-recommendation-case-repository.mjs';
import {
  SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT,
  SupabaseDurableFacultyInvitationRepository,
} from '../../lor-studio/repositories/supabase-durable-faculty-invitation-repository.mjs';

// DR-133. These identifiers are asserted ONLY as values that must be
// rejected. Nothing in this file may assert that either one is a reachable target.
const RANKLISTIQ_PRODUCTION_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const HISTORICAL_NO_TOUCH_BRANCH_ID = 'mftguikkftmrxjxrkdln';

/** A complete, explicitly ratified local target configuration. */
function localTargetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'local',
    provider: 'railway-postgres',
    projectId: 'lor-local-project-a',
    environmentId: 'lor-local-environment-a',
    serviceId: 'lor-local-service-a',
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/local',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
    ...overrides,
  };
}

function failClosedStatus(fn) {
  try {
    fn();
  } catch (error) {
    assert.equal(error.code, 'INTEGRATION_DISABLED');
    return error.details.status;
  }
  return assert.fail('expected the target binding to fail closed');
}

function durableCaseDriver() {
  return {
    atomicStateAndAudit: true,
    rlsEnforced: true,
    serverOnly: true,
    actorSafeCommands: true,
    async selectCase() { return null; },
    async readStudentSafeCase() { return null; },
    async readFacultyCaseProjection() { return null; },
    async readMentorCaseProjection() { return null; },
    async reserveCaseCreation() { return null; },
    async commitStudentCaseCreate() { return null; },
    async commitStudentBuilderAutosave() { return null; },
    async commitStudentBuilderComplete() { return null; },
    async commitStudentConsentReceipt() { return null; },
    async commitStudentWaiverReceipt() { return null; },
    async commitFacultyFinalDocumentRelease() { return null; },
    async executeAtomicCaseCommand() { return null; },
  };
}

function durableFacultyDriver() {
  return {
    atomicInvitationOtpAndAudit: true,
    databaseClock: true,
    rlsEnforced: true,
    serverOnly: true,
    async executeAtomicFacultyVerification() { return null; },
  };
}

test('absent target configuration fails closed and yields no project identity', () => {
  for (const absent of [undefined, null, '', 0, false, [], 'lor_studio', new Map()]) {
    const status = failClosedStatus(() => resolveLorTargetBinding(absent));
    assert.equal(status, 'TARGET_BINDING_CONFIGURATION_REQUIRED');
  }

  // The resolver must not expose a target through any call shape at all.
  assert.throws(() => resolveLorTargetBinding(), /integration is unavailable/u);
  assert.equal(failClosedStatus(() => resolveLorTargetBinding({})), 'TARGET_BINDING_CONFIGURATION_INCOMPLETE');
});

test('the module publishes no default or fallback target', () => {
  assert.equal(LOR_TARGET_BINDING_SCHEMA, 'missionmed.lor.target-binding.v2');
  assert.equal(LOR_TARGET_BINDING_CONTRACT.authority, 'DR-133');
  assert.equal(LOR_TARGET_BINDING_CONTRACT.provider, 'railway-postgres');
  assert.equal(LOR_TARGET_BINDING_CONTRACT.defaultTarget, null);
  assert.equal(LOR_TARGET_BINDING_CONTRACT.fallbackTarget, null);
  assert.equal(LOR_TARGET_BINDING_CONTRACT.selection, 'explicit_ratified_configuration_only');

  // Neither repository may re-publish a ready-made target descriptor.
  assert.equal(SUPABASE_LOR_REPOSITORY_CONTRACT.targets, undefined);
  assert.equal(SUPABASE_LOR_REPOSITORY_CONTRACT.rankListIqProjectRef, undefined);
  assert.equal(SUPABASE_LOR_REPOSITORY_CONTRACT.defaultTarget, null);
  assert.equal(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.targets, undefined);
  assert.equal(SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT.defaultTarget, null);

  const published = JSON.stringify([
    LOR_TARGET_BINDING_CONTRACT.selection,
    SUPABASE_LOR_REPOSITORY_CONTRACT,
    SUPABASE_DURABLE_FACULTY_INVITATION_CONTRACT,
  ]);
  assert.equal(published.includes(RANKLISTIQ_PRODUCTION_PROJECT_REF), false);
  assert.equal(published.includes(HISTORICAL_NO_TOUCH_BRANCH_ID), false);
});

test('partial and malformed target configuration fails closed', () => {
  // Every required key removed one at a time is a partial configuration.
  for (const key of Object.keys(localTargetConfiguration())) {
    const partial = localTargetConfiguration();
    delete partial[key];
    assert.equal(
      failClosedStatus(() => resolveLorTargetBinding(partial)),
      'TARGET_BINDING_CONFIGURATION_INCOMPLETE',
      `missing ${key} must fail closed`,
    );
  }

  // Unknown keys are rejected too, so nothing rides along unvalidated.
  assert.equal(
    failClosedStatus(() => resolveLorTargetBinding(localTargetConfiguration({ extraTarget: 'x' }))),
    'TARGET_BINDING_CONFIGURATION_INCOMPLETE',
  );

  const malformed = [
    [{ schemaVersion: 'missionmed.lor.target-binding.v0' }, 'TARGET_BINDING_SCHEMA_VERSION_INVALID'],
    [{ ratified: false }, 'TARGET_BINDING_NOT_RATIFIED'],
    [{ ratified: 'true' }, 'TARGET_BINDING_NOT_RATIFIED'],
    [{ ratified: undefined }, 'TARGET_BINDING_NOT_RATIFIED'],
    [{ decisionRecord: '' }, 'TARGET_BINDING_DECISION_RECORD_REQUIRED'],
    [{ decisionRecord: 'pending' }, 'TARGET_BINDING_DECISION_RECORD_REQUIRED'],
    [{ decisionRecord: 'DR-120' }, 'TARGET_BINDING_DECISION_RECORD_INVALID'],
    [{ providerResourceBound: false }, 'TARGET_BINDING_RESOURCE_UNVERIFIED'],
    [{ independentlyVerified: false }, 'TARGET_BINDING_RESOURCE_UNVERIFIED'],
    [{ environmentBound: false }, 'TARGET_BINDING_RESOURCE_UNVERIFIED'],
    [{ health: 'degraded' }, 'TARGET_BINDING_RESOURCE_UNVERIFIED'],
    [{ environment: 'preview' }, 'TARGET_BINDING_ENVIRONMENT_INVALID'],
    [{ environment: null }, 'TARGET_BINDING_ENVIRONMENT_INVALID'],
    [{ schema: 'public' }, 'TARGET_BINDING_SCHEMA_INVALID'],
    [{ provider: 'supabase' }, 'TARGET_BINDING_PROVIDER_INVALID'],
    [{ projectId: '' }, 'TARGET_BINDING_PROJECT_ID_INVALID'],
    [{ projectId: 'ab' }, 'TARGET_BINDING_PROJECT_ID_INVALID'],
    [{ projectId: 'Bad Ref' }, 'TARGET_BINDING_PROJECT_ID_INVALID'],
    [{ environmentId: '' }, 'TARGET_BINDING_ENVIRONMENT_ID_INVALID'],
    [{ serviceId: '' }, 'TARGET_BINDING_SERVICE_ID_INVALID'],
    [{ databaseName: '' }, 'TARGET_BINDING_DATABASE_NAME_INVALID'],
    [{ databaseName: 'Bad-Name' }, 'TARGET_BINDING_DATABASE_NAME_INVALID'],
    [{ region: '' }, 'TARGET_BINDING_REGION_INVALID'],
    [{ migrationLedger: null }, 'TARGET_BINDING_MIGRATION_LEDGER_REQUIRED'],
    [{ migrationLedger: '' }, 'TARGET_BINDING_MIGRATION_LEDGER_REQUIRED'],
    [{ dataCopied: true }, 'TARGET_BINDING_DATA_COPY_FORBIDDEN'],
    [{ productionDataBindingPassed: true }, 'TARGET_BINDING_PRODUCTION_EVIDENCE_MISMATCH'],
  ];
  for (const [override, expected] of malformed) {
    assert.equal(
      failClosedStatus(() => resolveLorTargetBinding(localTargetConfiguration(override))),
      expected,
      `${JSON.stringify(override)} must fail closed`,
    );
  }
});

test('a production-declared configuration still needs its own production evidence', () => {
  assert.equal(
    failClosedStatus(() => resolveLorTargetBinding(localTargetConfiguration({
      environment: 'production',
      productionDataBindingPassed: false,
    }))),
    'TARGET_BINDING_PRODUCTION_EVIDENCE_MISMATCH',
  );
});

test('local, test, staging, and production declarations each resolve only from complete v2 input', () => {
  for (const environment of ['local', 'test', 'staging', 'production']) {
    const binding = resolveLorTargetBinding(localTargetConfiguration({
      environment,
      projectId: `lor-${environment}-project`,
      environmentId: `lor-${environment}-environment`,
      serviceId: `lor-${environment}-service`,
      migrationLedger: `lor_studio/migrations/${environment}`,
      productionDataBindingPassed: environment === 'production',
    }));
    assert.equal(binding.environment, environment);
    assert.equal(binding.projectId, `lor-${environment}-project`);
    assert.equal(binding.provider, 'railway-postgres');
  }
});

test('an explicit ratified test target resolves to exactly what was configured', () => {
  const binding = resolveLorTargetBinding(localTargetConfiguration({
    environment: 'test',
    projectId: 'lor-test-project-b',
    environmentId: 'lor-test-environment-b',
    serviceId: 'lor-test-service-b',
    migrationLedger: 'lor_studio/migrations/test',
  }));

  assert.deepEqual({ ...binding }, {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    decisionRecord: 'DR-133',
    environment: 'test',
    provider: 'railway-postgres',
    projectId: 'lor-test-project-b',
    environmentId: 'lor-test-environment-b',
    serviceId: 'lor-test-service-b',
    databaseName: 'railway',
    region: 'us-west2',
    schema: 'lor_studio',
    migrationLedger: 'lor_studio/migrations/test',
  });
  assert.equal(Object.isFrozen(binding), true);

  // The exact DR-133 staging resource identity resolves without aliases.
  const staging = resolveLorTargetBinding(localTargetConfiguration({
    environment: 'staging',
    projectId: '29afe885-b9b1-425d-8fd8-8611cd275409',
    environmentId: 'f5705d38-393c-4176-9cc2-0d1dbad42c93',
    serviceId: 'b49a52e7-df15-4417-b67a-a64403aa5db7',
    databaseName: 'railway',
    region: 'us-west2',
    migrationLedger: 'lor_studio/migrations/staging',
  }));
  assert.equal(staging.projectId, '29afe885-b9b1-425d-8fd8-8611cd275409');
  assert.equal(staging.environmentId, 'f5705d38-393c-4176-9cc2-0d1dbad42c93');
  assert.equal(staging.serviceId, 'b49a52e7-df15-4417-b67a-a64403aa5db7');
  assert.equal(staging.environment, 'staging');
});

test('the RankListIQ production project cannot be reached by omission, default, or empty configuration', () => {
  const attempts = [
    () => resolveLorTargetBinding(),
    () => resolveLorTargetBinding(undefined),
    () => resolveLorTargetBinding(null),
    () => resolveLorTargetBinding({}),
    () => resolveLorTargetBinding(Object.create(null)),
    () => resolveLorTargetBinding({ environment: 'production' }),
    () => resolveLorTargetBinding({ ratified: true }),
  ];
  for (const attempt of attempts) {
    let resolved = null;
    assert.throws(() => { resolved = attempt(); }, /integration is unavailable/u);
    assert.equal(resolved, null, 'a failed resolution must not yield any binding');
  }
});

test('the historical production project and no-touch branch are denied even when passed explicitly', () => {
  assert.equal(isDeniedTargetIdentifier(RANKLISTIQ_PRODUCTION_PROJECT_REF), true);
  assert.equal(isDeniedTargetIdentifier(HISTORICAL_NO_TOUCH_BRANCH_ID), true);
  assert.equal(isDeniedTargetIdentifier('lor-local-target-a'), false);
  assert.equal(LOR_TARGET_BINDING_CONTRACT.deniedEvenWhenExplicit, true);
  assert.deepEqual(Object.keys(DENIED_TARGET_IDENTIFIERS).sort(), [
    RANKLISTIQ_PRODUCTION_PROJECT_REF,
    HISTORICAL_NO_TOUCH_BRANCH_ID,
  ].sort());

  // The exact production shape the repositories used to hard-code.
  assert.equal(
    failClosedStatus(() => resolveLorTargetBinding(localTargetConfiguration({
      environment: 'production',
      projectId: RANKLISTIQ_PRODUCTION_PROJECT_REF,
      productionDataBindingPassed: true,
      migrationLedger: 'lor_studio/migrations/production',
    }))),
    'TARGET_BINDING_DENIED_RANKLISTIQ_PRODUCTION_PROJECT',
  );

  // The exact staging shape the repositories used to hard-code.
  assert.equal(
    failClosedStatus(() => resolveLorTargetBinding(localTargetConfiguration({
      environment: 'staging',
      serviceId: HISTORICAL_NO_TOUCH_BRANCH_ID,
    }))),
    'TARGET_BINDING_DENIED_LOR_HISTORICAL_NO_TOUCH_BRANCH',
  );

  // A denied identifier hidden in any single identity field is still denied.
  assert.deepEqual(LOR_TARGET_BINDING_CONTRACT.identityFields, LOR_TARGET_IDENTITY_FIELDS);
  for (const field of LOR_TARGET_IDENTITY_FIELDS) {
    for (const denied of [RANKLISTIQ_PRODUCTION_PROJECT_REF, HISTORICAL_NO_TOUCH_BRANCH_ID]) {
      const status = failClosedStatus(
        () => resolveLorTargetBinding(localTargetConfiguration({ [field]: denied })),
      );
      assert.match(status, /^TARGET_BINDING_DENIED_/u, `${field}=${denied} must be denied`);
    }
  }
});

test('the case repository cannot be constructed without a validated binding', () => {
  const options = {
    driver: durableCaseDriver(),
    scopeProvider: () => null,
  };

  assert.throws(() => new SupabaseDurableRecommendationCaseRepository(), /integration is unavailable/u);
  assert.throws(
    () => new SupabaseDurableRecommendationCaseRepository({ ...options }),
    /integration is unavailable/u,
  );

  // A hand-rolled look-alike is not a binding, however complete it appears.
  for (const forged of [
    localTargetConfiguration(),
    { environment: 'production', projectId: RANKLISTIQ_PRODUCTION_PROJECT_REF, schema: 'lor_studio' },
    { ...resolveLorTargetBinding(localTargetConfiguration()) },
  ]) {
    const status = failClosedStatus(
      () => new SupabaseDurableRecommendationCaseRepository({ ...options, binding: forged }),
    );
    assert.equal(status, 'VALIDATED_TARGET_BINDING_REQUIRED');
  }

  const repository = new SupabaseDurableRecommendationCaseRepository({
    ...options,
    binding: resolveLorTargetBinding(localTargetConfiguration({ environment: 'test' })),
  });
  const persistence = repository.describePersistence();
  assert.equal(persistence.environment, 'test');
  assert.equal(persistence.productionEligible, false);
  assert.throws(() => repository.assertProductionReady(), /integration is unavailable/u);
});

test('the faculty repository cannot be constructed without a validated binding', () => {
  const options = {
    driver: durableFacultyDriver(),
    scopeProvider: () => null,
    verifiedContextProvider: () => null,
  };

  assert.throws(() => new SupabaseDurableFacultyInvitationRepository(), /integration is unavailable/u);
  assert.throws(
    () => new SupabaseDurableFacultyInvitationRepository({ ...options }),
    /integration is unavailable/u,
  );

  for (const forged of [
    localTargetConfiguration(),
    { environment: 'production', projectId: RANKLISTIQ_PRODUCTION_PROJECT_REF, schema: 'lor_studio' },
    { ...resolveLorTargetBinding(localTargetConfiguration()) },
  ]) {
    const status = failClosedStatus(
      () => new SupabaseDurableFacultyInvitationRepository({ ...options, binding: forged }),
    );
    assert.equal(status, 'VALIDATED_TARGET_BINDING_REQUIRED');
  }

  const repository = new SupabaseDurableFacultyInvitationRepository({
    ...options,
    binding: resolveLorTargetBinding(localTargetConfiguration({ environment: 'staging' })),
  });
  const persistence = repository.describePersistence();
  assert.equal(persistence.environment, 'staging');
  assert.equal(persistence.productionEligible, false);
  assert.throws(() => repository.assertProductionReady(), /integration is unavailable/u);
});

test('assertValidatedLorTargetBinding rejects everything it did not produce', () => {
  for (const candidate of [undefined, null, 0, '', 'binding', [], {}, localTargetConfiguration()]) {
    assert.throws(
      () => assertValidatedLorTargetBinding(candidate, 'lor_supabase_repository'),
      /integration is unavailable/u,
    );
  }
  const binding = resolveLorTargetBinding(localTargetConfiguration());
  assert.equal(assertValidatedLorTargetBinding(binding, 'lor_supabase_repository'), binding);
});
