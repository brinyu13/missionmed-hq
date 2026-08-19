/**
 * LOR Studio composition root.
 *
 * The production mount previously constructed the runtime WITHOUT an `application`, so
 * `application` defaulted to null and every /api/lor-studio/* request returned
 * 503 lor_application_unavailable. The entire domain, service, security, and repository
 * layer was unreachable by real users despite being implemented and tested.
 *
 * Worse, that gap was invisible: every test built its own runtime, so the suite would have
 * stayed green if the production mount had been deleted outright. This module exists so the
 * dependency graph is constructed in ONE place that both server.mjs and the integration tests
 * exercise, which makes "is the application actually wired?" a testable question.
 *
 * DR-119 clause 7 governs the target: no implicit project identity, explicit configuration
 * only, fail closed when absent. Nothing here ever falls back to a default target.
 */

import { resolveLorTargetBinding } from './adapters/lor-target-binding.mjs';
import { createLorApplicationAdapter } from './http/application-adapter.mjs';
import { RecommendationCaseService } from './services/recommendation-case-service.js';

/** Environment variable names carrying the explicit target configuration. Values are never logged. */
export const LOR_TARGET_ENV_KEYS = Object.freeze({
  schemaVersion: 'MMHQ_LOR_STUDIO_TARGET_SCHEMA_VERSION',
  ratified: 'MMHQ_LOR_STUDIO_TARGET_RATIFIED',
  decisionRecord: 'MMHQ_LOR_STUDIO_TARGET_DECISION_RECORD',
  environment: 'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT',
  projectRef: 'MMHQ_LOR_STUDIO_TARGET_PROJECT_REF',
  parentProjectRef: 'MMHQ_LOR_STUDIO_TARGET_PARENT_PROJECT_REF',
  branchName: 'MMHQ_LOR_STUDIO_TARGET_BRANCH_NAME',
  branchId: 'MMHQ_LOR_STUDIO_TARGET_BRANCH_ID',
  schema: 'MMHQ_LOR_STUDIO_TARGET_SCHEMA',
  migrationLedger: 'MMHQ_LOR_STUDIO_TARGET_MIGRATION_LEDGER',
  providerResourceBound: 'MMHQ_LOR_STUDIO_TARGET_PROVIDER_RESOURCE_BOUND',
  independentlyVerified: 'MMHQ_LOR_STUDIO_TARGET_INDEPENDENTLY_VERIFIED',
  health: 'MMHQ_LOR_STUDIO_TARGET_HEALTH',
  environmentBound: 'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_BOUND',
  dataCopied: 'MMHQ_LOR_STUDIO_TARGET_DATA_COPIED',
  productionDataBindingPassed: 'MMHQ_LOR_STUDIO_TARGET_PRODUCTION_DATA_BINDING_PASSED',
});

/** Reasons composition can decline, surfaced to operators. None leaks a configured value. */
export const LOR_COMPOSITION_REASONS = Object.freeze({
  TARGET_NOT_CONFIGURED: 'lor_target_not_configured',
  TARGET_REJECTED: 'lor_target_rejected',
  DURABLE_DRIVER_UNAVAILABLE: 'lor_durable_driver_unavailable',
  ENTITLEMENT_PORT_UNAVAILABLE: 'lor_entitlement_port_unavailable',
  COMPOSITION_FAILED: 'lor_composition_failed',
});

const BOOLEAN_KEYS = new Set([
  'ratified', 'providerResourceBound', 'independentlyVerified',
  'environmentBound', 'dataCopied', 'productionDataBindingPassed',
]);

/** Strict booleans only: an unset or unrecognised value must not read as true. */
function readBoolean(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw; // preserved verbatim so the resolver rejects it rather than us coercing
}

/**
 * Read an explicit target configuration from the environment.
 *
 * Returns null when the configuration is absent. Absence is a normal, expected production
 * state today - the LOR database target has not been ratified - and it must fail closed
 * rather than resolve to anything.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, unknown> | null}
 */
export function readLorTargetConfiguration(env = process.env) {
  // The project ref is the sentinel: with no target named, there is nothing to validate.
  if (!env[LOR_TARGET_ENV_KEYS.projectRef]) return null;

  const configuration = {};
  for (const [key, envKey] of Object.entries(LOR_TARGET_ENV_KEYS)) {
    const raw = env[envKey];
    if (key === 'parentProjectRef') {
      configuration[key] = raw === undefined || raw === '' ? null : raw;
    } else if (BOOLEAN_KEYS.has(key)) {
      configuration[key] = readBoolean(raw);
    } else {
      configuration[key] = raw;
    }
  }
  return configuration;
}

/**
 * Construct the LOR Studio application.
 *
 * Returns `{ application, binding }` on success, or `{ application: null, reason, detail }`
 * when composition cannot proceed. It never throws for an expected unconfigured state, because
 * the server must still start and serve every other MissionMed route.
 *
 * @param {object} options
 * @param {Record<string, unknown> | null} [options.targetConfiguration]
 * @param {object} [options.entitlementPort]
 * @param {object|null} [options.driver] durable case driver; absent means no durable repository
 * @param {object|null} [options.scopeProvider] RLS scope provider paired with the driver
 * @param {(binding: object) => object} [options.durableRepositoryFactory]
 * @param {object|null} [options.testRepository] explicit non-durable repository, tests only
 * @param {boolean} [options.allowNonDurableForTests]
 * @param {object|null} [options.eventSink]
 * @param {() => Date} [options.clock]
 * @param {boolean} [options.requireCanary]
 */
export function createLorStudioApplication({
  targetConfiguration = null,
  entitlementPort = null,
  driver = null,
  scopeProvider = null,
  durableRepositoryFactory = null,
  testRepository = null,
  allowNonDurableForTests = false,
  eventSink = null,
  clock = () => new Date(),
  requireCanary = true,
} = {}) {
  if (!targetConfiguration) {
    return { application: null, reason: LOR_COMPOSITION_REASONS.TARGET_NOT_CONFIGURED };
  }

  // DR-119 clause 7: the only route to a target identity. Denied identifiers, unratified
  // configurations, and partial configurations all throw here rather than resolving.
  let binding;
  try {
    binding = resolveLorTargetBinding(targetConfiguration);
  } catch (error) {
    return {
      application: null,
      reason: LOR_COMPOSITION_REASONS.TARGET_REJECTED,
      detail: error?.details?.status ?? error?.code ?? 'unknown',
    };
  }

  if (!entitlementPort || typeof entitlementPort.getStudentEntitlement !== 'function') {
    return { application: null, reason: LOR_COMPOSITION_REASONS.ENTITLEMENT_PORT_UNAVAILABLE, binding };
  }

  let repository;
  if (testRepository) {
    // Tests supply an explicit non-durable repository. The adapter still enforces
    // allowNonDurableForTests, so this cannot silently become a production path.
    repository = testRepository;
  } else if (durableRepositoryFactory) {
    repository = durableRepositoryFactory(binding);
  } else if (driver && scopeProvider) {
    return { application: null, reason: LOR_COMPOSITION_REASONS.DURABLE_DRIVER_UNAVAILABLE, binding };
  } else {
    // No atomic RLS driver implementation exists yet, so no durable repository can be built.
    // This is the honest current production state: the wiring below is complete and proven by
    // integration tests, and it will construct a durable application unchanged the moment a
    // driver and a ratified target exist.
    return { application: null, reason: LOR_COMPOSITION_REASONS.DURABLE_DRIVER_UNAVAILABLE, binding };
  }

  try {
    // The event sink is OMITTED, not passed as null: the service rejects a null sink, and its
    // durable branch forbids a sink outright because a durable repository commits state and
    // audit atomically in one transaction. A non-durable repository has no such transaction and
    // therefore does require one.
    const serviceOptions = { repository, entitlementPort, clock, requireCanary };
    if (eventSink) serviceOptions.eventSink = eventSink;
    const caseService = new RecommendationCaseService(serviceOptions);
    const application = createLorApplicationAdapter({
      caseService,
      repository,
      allowNonDurableForTests,
    });
    return { application, binding, repository, caseService };
  } catch (error) {
    return {
      application: null,
      reason: LOR_COMPOSITION_REASONS.COMPOSITION_FAILED,
      detail: error?.message ?? 'unknown',
      binding,
    };
  }
}
