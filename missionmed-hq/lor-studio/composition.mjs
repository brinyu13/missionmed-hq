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
 * DR-133 governs the target: no implicit project identity, explicit configuration
 * only, fail closed when absent. Nothing here ever falls back to a default target.
 */

import { DeterministicAiProposalAdapter } from './adapters/deterministic-ai-provider.js';
import { resolveLorTargetBinding } from './adapters/lor-target-binding.mjs';
import { createLorApplicationAdapter } from './http/application-adapter.mjs';
import { SupabaseDurableRecommendationCaseRepository } from './repositories/supabase-durable-recommendation-case-repository.mjs';
import { AiProposalService, createAiDraftingService } from './services/ai-proposal-service.js';
import { RecommendationCaseService } from './services/recommendation-case-service.js';

/** Environment variable names carrying the explicit target configuration. Values are never logged. */
export const LOR_TARGET_ENV_KEYS = Object.freeze({
  schemaVersion: 'MMHQ_LOR_STUDIO_TARGET_SCHEMA_VERSION',
  ratified: 'MMHQ_LOR_STUDIO_TARGET_RATIFIED',
  decisionRecord: 'MMHQ_LOR_STUDIO_TARGET_DECISION_RECORD',
  environment: 'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT',
  provider: 'MMHQ_LOR_STUDIO_TARGET_PROVIDER',
  projectId: 'MMHQ_LOR_STUDIO_TARGET_PROJECT_ID',
  environmentId: 'MMHQ_LOR_STUDIO_TARGET_ENVIRONMENT_ID',
  serviceId: 'MMHQ_LOR_STUDIO_TARGET_SERVICE_ID',
  databaseName: 'MMHQ_LOR_STUDIO_TARGET_DATABASE_NAME',
  region: 'MMHQ_LOR_STUDIO_TARGET_REGION',
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
  AI_PROPOSAL_STORE_UNAVAILABLE: 'lor_ai_proposal_store_unavailable',
  AI_PROVIDER_UNAVAILABLE: 'lor_ai_provider_unavailable',
  ENTITLEMENT_PORT_UNAVAILABLE: 'lor_entitlement_port_unavailable',
  RUNTIME_READINESS_FAILED: 'lor_runtime_readiness_failed',
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

function closeRuntimeDependenciesSafely(runtimeDependencies) {
  if (!runtimeDependencies || typeof runtimeDependencies.close !== 'function') return;
  try {
    const settlement = runtimeDependencies.close();
    if (settlement && typeof settlement.catch === 'function') {
      void settlement.catch(() => {});
    }
  } catch {
    // Composition failures expose only the safe reason code below.
  }
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
  // Only a wholly absent configuration is the expected disabled state. If even
  // one key is present (including an explicit empty string), return the exact
  // partial shape so the resolver rejects it; no single identity field acts as
  // a sentinel and no missing value can be inferred from another one.
  if (Object.values(LOR_TARGET_ENV_KEYS).every((envKey) => env[envKey] === undefined)) {
    return null;
  }

  const configuration = {};
  for (const [key, envKey] of Object.entries(LOR_TARGET_ENV_KEYS)) {
    const raw = env[envKey];
    if (BOOLEAN_KEYS.has(key)) {
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
 * @param {(binding: object) => object} [options.runtimeDependencyFactory] production driver/scope factory
 * @param {(binding: object) => object} [options.durableRepositoryFactory]
 * @param {object|null} [options.testRepository] explicit non-durable repository, tests only
 * @param {boolean} [options.allowNonDurableForTests]
 * @param {object|null} [options.eventSink]
 * @param {object|null} [options.aiProposalStore] durable proposal store; absent means no drafting
 * @param {object|null} [options.aiProposalProvider] explicit production provider; deterministic only in non-durable tests
 * @param {() => Date} [options.clock]
 * @param {boolean} [options.requireCanary]
 */
export function createLorStudioApplication({
  targetConfiguration = null,
  entitlementPort = null,
  driver = null,
  scopeProvider = null,
  runtimeDependencyFactory = null,
  durableRepositoryFactory = null,
  testRepository = null,
  allowNonDurableForTests = false,
  eventSink = null,
  // The AI drafting plane, DR-119 clause 8. Both default to absent/deterministic on purpose -
  // see the store gate and the provider note below.
  aiProposalStore = null,
  aiProposalProvider = null,
  clock = () => new Date(),
  requireCanary = true,
  // Readiness assertions, both DEFAULT FALSE so the honest answer is the automatic one. They are
  // caller assertions rather than measurements - see the operational-readiness dependency probes,
  // which are not yet implemented - so nothing may set them true except a caller that genuinely
  // knows. Production composition never does.
  providersReady = false,
  allAcceptedFunctionsOperational = false,
} = {}) {
  if (!targetConfiguration) {
    return { application: null, reason: LOR_COMPOSITION_REASONS.TARGET_NOT_CONFIGURED };
  }

  // DR-133: the only route to a target identity. Denied identifiers, unratified
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

  let runtimeDependencies = null;
  try {
    let resolvedDriver = driver;
    let resolvedScopeProvider = scopeProvider;
    if (
      !testRepository
      && !durableRepositoryFactory
      && (!resolvedDriver || !resolvedScopeProvider)
      && typeof runtimeDependencyFactory === 'function'
    ) {
      runtimeDependencies = runtimeDependencyFactory(binding);
      if (
        !runtimeDependencies
        || typeof runtimeDependencies !== 'object'
        || typeof runtimeDependencies.driver !== 'object'
        || typeof runtimeDependencies.scopeProvider !== 'function'
      ) {
        throw new TypeError('Production runtime dependencies are incomplete');
      }
      resolvedDriver = runtimeDependencies.driver;
      resolvedScopeProvider = runtimeDependencies.scopeProvider;
    }

    let repository;
    if (testRepository) {
      // Tests supply an explicit non-durable repository. The adapter still enforces
      // allowNonDurableForTests, so this cannot silently become a production path.
      repository = testRepository;
    } else if (durableRepositoryFactory) {
      repository = durableRepositoryFactory(binding);
    } else if (resolvedDriver && resolvedScopeProvider) {
      repository = new SupabaseDurableRecommendationCaseRepository({
        binding,
        driver: resolvedDriver,
        scopeProvider: resolvedScopeProvider,
      });
    } else {
      // Production does not synthesize a target, SQL executor, scope provider, or credential.
      // When any one is absent the durable boundary remains visibly disabled.
      return { application: null, reason: LOR_COMPOSITION_REASONS.DURABLE_DRIVER_UNAVAILABLE, binding };
    }

    // AI DRAFTING PERSISTENCE, gated exactly as durability is gated above.
  //
    // `putProposal` and `attachDecision` are conditional atomic writes: they are what make a
  // proposal replayable under an idempotency key and what make "exactly one human decision"
    // enforceable inside the write rather than in a caller's read-then-write.
  //
    // Composing over a scratch in-memory store WOULD be wrong - a faculty writer's proposal and the
    // human decision recorded against it could vanish between two requests while the product
    // reported itself live - so an absent store still disables drafting outright.
  //
    // But it disables DRAFTING, not the product. Production additionally requires an explicit,
    // privacy-approved provider. The deterministic provider remains reachable only through the
    // explicit non-durable test gate and can never appear because a production store was bound.
    const proposalProvider = aiProposalProvider
      ?? (allowNonDurableForTests ? new DeterministicAiProposalAdapter() : null);
    const draftingAvailable = Boolean(aiProposalStore && proposalProvider);

    // The event sink is OMITTED, not passed as null: the service rejects a null sink, and its
    // durable branch forbids a sink outright because a durable repository commits state and
    // audit atomically in one transaction. A non-durable repository has no such transaction and
    // therefore does require one.
    const serviceOptions = { repository, entitlementPort, clock, requireCanary };
    if (eventSink) serviceOptions.eventSink = eventSink;
    const caseService = new RecommendationCaseService(serviceOptions);

    // Provider choice is a composition decision. AiProposalService continues to apply the same
    // grounding and connective checks to an explicitly injected production provider.
    const proposalService = proposalProvider
      ? new AiProposalService({ provider: proposalProvider, clock })
      : null;

    // `requireCanary` is the SAME value the case service received. Passing anything weaker here
    // would let a writer draft over a student whose canary consent the rest of the application
    // still demands - a quieter way of widening access than changing the policy.
    const aiDraftingService = draftingAvailable
      ? createAiDraftingService({
        proposalService,
        repository,
        entitlementPort,
        proposalStore: aiProposalStore,
        clock,
        requireCanary,
      })
      : null;

    const application = createLorApplicationAdapter({
      caseService,
      repository,
      // null, not omitted: the adapter treats an absent drafting service as
      // INTEGRATION_DISABLED on /ai-proposals only, leaving every other route live.
      aiDraftingService,
      allowNonDurableForTests,
      providersReady,
      allAcceptedFunctionsOperational,
    });
    return {
      application,
      binding,
      repository,
      caseService,
      aiDraftingService,
      draftingAvailable,
      runtimeDependencies,
      // Present only when drafting is off, so an operator sees the specific cause.
      ...(draftingAvailable
        ? {}
        : {
          draftingUnavailableReason: aiProposalStore
            ? LOR_COMPOSITION_REASONS.AI_PROVIDER_UNAVAILABLE
            : LOR_COMPOSITION_REASONS.AI_PROPOSAL_STORE_UNAVAILABLE,
        }),
    };
  } catch {
    closeRuntimeDependenciesSafely(runtimeDependencies);
    return {
      application: null,
      reason: LOR_COMPOSITION_REASONS.COMPOSITION_FAILED,
      binding,
    };
  }
}

async function closeRuntimeDependencies(runtimeDependencies) {
  if (!runtimeDependencies || typeof runtimeDependencies.close !== 'function') return;
  try {
    await runtimeDependencies.close();
  } catch {
    // Startup readiness exposes one constant reason only.
  }
}

/**
 * Production startup wrapper. Target and entitlement validation still happen
 * before the runtime factory is invoked. If a pool is allocated, one redacted
 * catalog-fingerprint probe must pass before the application is retained.
 */
export async function createReadinessGatedLorStudioApplication(options = {}) {
  const { signal = null, ...compositionOptions } = options;
  if (
    signal !== null
    && (
      typeof signal !== 'object'
      || typeof signal.addEventListener !== 'function'
      || typeof signal.removeEventListener !== 'function'
      || typeof signal.aborted !== 'boolean'
    )
  ) {
    return {
      application: null,
      reason: LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED,
    };
  }
  const composition = createLorStudioApplication(compositionOptions);
  if (composition.application === null) return composition;

  const dependencies = composition.runtimeDependencies;
  if (
    !dependencies
    || typeof dependencies !== 'object'
    || !dependencies.readiness
    || typeof dependencies.readiness.probe !== 'function'
    || typeof dependencies.close !== 'function'
  ) {
    await closeRuntimeDependencies(dependencies);
    return {
      application: null,
      binding: composition.binding,
      reason: LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED,
    };
  }

  let abortReadiness = null;
  try {
    if (signal?.aborted) throw new TypeError('startup aborted');
    const readiness = dependencies.readiness.probe();
    const receipt = signal
      ? await Promise.race([
        readiness,
        new Promise((_, reject) => {
          abortReadiness = () => reject(new TypeError('startup aborted'));
          signal.addEventListener('abort', abortReadiness, { once: true });
        }),
      ])
      : await readiness;
    const checks = receipt?.checks;
    if (
      receipt?.ready !== true
      || receipt?.reasonCode !== 'READY'
      || !checks
      || typeof checks !== 'object'
      || Array.isArray(checks)
      || Object.keys(checks).length < 1
      || Object.values(checks).some((value) => value !== true)
    ) {
      throw new TypeError('readiness rejected');
    }
    return composition;
  } catch {
    await closeRuntimeDependencies(dependencies);
    return {
      application: null,
      binding: composition.binding,
      reason: LOR_COMPOSITION_REASONS.RUNTIME_READINESS_FAILED,
    };
  } finally {
    if (abortReadiness) signal.removeEventListener('abort', abortReadiness);
  }
}

/**
 * One shutdown promise for signals, listen failures, and tests. HTTP admission
 * closes first; the database pool is attempted even if HTTP closure fails.
 */
export function createLorStudioShutdownCoordinator({
  closeHttp = async () => {},
  runtimeDependencies = null,
} = {}) {
  if (typeof closeHttp !== 'function') {
    throw new TypeError('closeHttp must be a function');
  }
  let shutdownPromise = null;
  return function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      let failed = false;
      try {
        await closeHttp();
      } catch {
        failed = true;
      }
      try {
        await runtimeDependencies?.close?.();
      } catch {
        failed = true;
      }
      if (failed) {
        throw new Error('LOR_RUNTIME_SHUTDOWN_FAILED');
      }
    })();
    return shutdownPromise;
  };
}
