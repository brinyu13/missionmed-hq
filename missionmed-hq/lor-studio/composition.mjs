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
import { createProductionOperationalReadiness } from './adapters/production-operational-readiness.mjs';
import { isAuthenticOpenAiGroundedProposalAdapter } from './adapters/openai-grounded-proposal-adapter.mjs';
import { isVerifiedPrivateVersionedStorageAdapter } from './adapters/private-versioned-storage-adapter.mjs';
import { isLorReleaseModeReadinessAccepted } from './adapters/release-mode-readiness.mjs';
import { createLorApplicationAdapter } from './http/application-adapter.mjs';
import { SupabaseDurableAiProposalStore } from './repositories/supabase-durable-ai-proposal-store.mjs';
import {
  SupabaseDurableArtifactAuditSink,
  isAuthenticDurableArtifactAuditSink,
} from './repositories/supabase-durable-artifact-audit-sink.mjs';
import { SupabaseDurableFacultyInvitationCommandRepository } from './repositories/supabase-durable-faculty-invitation-command-repository.mjs';
import { SupabaseDurableFacultyInvitationRepository } from './repositories/supabase-durable-faculty-invitation-repository.mjs';
import { SupabaseDurableRecommendationCaseRepository } from './repositories/supabase-durable-recommendation-case-repository.mjs';
import { AiProposalService, createAiDraftingService } from './services/ai-proposal-service.js';
import {
  DurableFacultyInvitationLifecycleService,
  isAuthenticDurableFacultyInvitationLifecycleService,
} from './services/durable-faculty-invitation-lifecycle-service.mjs';
import {
  DurableFacultyInvitationVerificationService,
  isAuthenticDurableFacultyInvitationVerificationService,
} from './services/durable-faculty-invitation-verification-service.mjs';
import { RecommendationCaseService } from './services/recommendation-case-service.js';
import { readFacultyCandidateCredentialContext } from './security/faculty-candidate-credential-context.mjs';

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

// Module-private capability. No external caller can manufacture the value that marks a graph as
// measured-ready; only createReadinessGatedLorStudioApplication receives it after validating the
// complete, fresh, exact-target dependency receipt. Caller booleans are intentionally ignored.
const MEASURED_OPERATIONAL_READINESS_AUTHORITY = Symbol('lor-measured-operational-readiness');

const OPERATIONAL_DEPENDENCY_NAMES = Object.freeze([
  'administrativeGrants',
  'ai',
  'audit',
  'backupRestore',
  'email',
  'entitlement',
  'hydration',
  'otp',
  'repository',
  'rls',
  'storage',
]);
const OPERATIONAL_DATABASE_GROUP_NAMES = Object.freeze([
  'auditCatalog',
  'database',
  'repository',
  'rls',
]);

function hasExactEnumerableStringKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedKeys.length
      || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return expectedKeys.every((key) => (
      descriptors[key]
      && Object.hasOwn(descriptors[key], 'value')
      && descriptors[key].enumerable === true
    ));
  } catch {
    return false;
  }
}

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

function supportsDurableAiProposalCommands(candidate) {
  return Boolean(
    candidate
    && candidate.rlsEnforced === true
    && candidate.serverOnly === true
    && candidate.databaseClock === true
    && candidate.actorSafeReads === true
    && candidate.atomicProviderCallReservation === true
    && candidate.atomicProviderRunAndProposal === true
    && candidate.conditionalAtomicOneDecision === true
    && typeof candidate.reserveAiProposalGenerationAtomic === 'function'
    && typeof candidate.markAiProposalGenerationUnknownAtomic === 'function'
    && typeof candidate.persistProviderRunAndProposalAtomic === 'function'
    && typeof candidate.readActorSafeAiProposal === 'function'
    && typeof candidate.attachDecisionIfUndecidedAtomic === 'function'
  );
}

function supportsDurableFacultyInvitationCommands(candidate) {
  return Boolean(
    candidate
    && candidate.rlsEnforced === true
    && candidate.serverOnly === true
    && candidate.databaseClock === true
    && candidate.atomicFacultyInvitationCommands === true
    && typeof candidate.issueFacultyInvitationAtomic === 'function'
    && typeof candidate.resendFacultyInvitationOtpAtomic === 'function'
    && typeof candidate.revokeFacultyInvitationAtomic === 'function'
    && typeof candidate.reserveFacultyInvitationDeliveryAtomic === 'function'
    && typeof candidate.markFacultyInvitationDeliveryUnknownAtomic === 'function'
    && typeof candidate.commitFacultyInvitationDeliveryAtomic === 'function'
    && typeof candidate.verifyFacultyInvitationAtomic === 'function'
  );
}

function supportsDurableArtifactAudit(candidate) {
  return Boolean(
    candidate
    && candidate.rlsEnforced === true
    && candidate.serverOnly === true
    && candidate.databaseClock === true
    && candidate.appendOnlyArtifactAudit === true
    && typeof candidate.appendArtifactExportAuditAtomic === 'function'
  );
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
 * @param {({ actorResolver: object }) => object} [options.entitlementPortFactory]
 * @param {object|null} [options.driver] durable case driver; absent means no durable repository
 * @param {object|null} [options.scopeProvider] RLS scope provider paired with the driver
 * @param {object|null} [options.boundRuntimeDependencies] already-constructed production runtime owner
 * @param {(binding: object) => object} [options.runtimeDependencyFactory] production driver/scope factory
 * @param {(binding: object) => object} [options.durableRepositoryFactory]
 * @param {object|null} [options.testRepository] explicit non-durable repository, tests only
 * @param {boolean} [options.allowNonDurableForTests]
 * @param {object|null} [options.eventSink]
 * @param {object|null} [options.aiProposalStore] durable proposal store; absent means no drafting
 * @param {object|null} [options.aiProposalProvider] explicit production provider; deterministic only in non-durable tests
 * @param {object|null} [options.facultyInvitationLifecycleService] durable invitation/email lifecycle
 * @param {object|null} [options.facultyInvitationVerificationService] durable candidate verification
 * @param {object|null} [options.facultyEmailPort] verified Postmark delivery adapter
 * @param {object|null} [options.facultyInvitationSecretDeriver] server-only HMAC secret derivation
 * @param {string|null} [options.invitationOrigin] exact HTTPS invitation origin
 * @param {Function|null} [options.candidateScopeProvider] verified candidate database scope provider
 * @param {Function|null} [options.candidateCredentialProvider] request-local sealed credential provider
 * @param {object|null} [options.privateStorageService] private immutable object storage surface
 * @param {object|null} [options.artifactAuditSink] durable actor/case-bound export audit sink
 * @param {() => Date} [options.clock]
 * @param {boolean} [options.requireCanary]
 */
export function createLorStudioApplication({
  targetConfiguration = null,
  entitlementPort = null,
  entitlementPortFactory = null,
  driver = null,
  scopeProvider = null,
  boundRuntimeDependencies = null,
  runtimeDependencyFactory = null,
  durableRepositoryFactory = null,
  testRepository = null,
  allowNonDurableForTests = false,
  eventSink = null,
  // The AI drafting plane, DR-119 clause 8. Both default to absent/deterministic on purpose -
  // see the store gate and the provider note below.
  aiProposalStore = null,
  aiProposalProvider = null,
  facultyInvitationLifecycleService = null,
  facultyInvitationVerificationService = null,
  facultyEmailPort = null,
  facultyInvitationSecretDeriver = null,
  invitationOrigin = null,
  candidateScopeProvider = null,
  candidateCredentialProvider = readFacultyCandidateCredentialContext,
  privateStorageService = null,
  artifactAuditSink = null,
  clock = () => new Date(),
  requireCanary = true,
  // Internal only. The module-private authority is supplied by the measured readiness wrapper;
  // any ordinary caller value is incapable of making the application live.
  operationalReadinessAuthority = null,
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

  if (
    (entitlementPort !== null
      && (!entitlementPort || typeof entitlementPort.getStudentEntitlement !== 'function'))
    || (entitlementPortFactory !== null && typeof entitlementPortFactory !== 'function')
    || (entitlementPort === null && entitlementPortFactory === null)
  ) {
    return { application: null, reason: LOR_COMPOSITION_REASONS.ENTITLEMENT_PORT_UNAVAILABLE, binding };
  }

  let runtimeDependencies = boundRuntimeDependencies;
  try {
    let resolvedDriver = driver;
    let resolvedScopeProvider = scopeProvider;
    let resolvedCandidateScopeProvider = candidateScopeProvider;
    let resolvedEntitlementPort = entitlementPort;
    if (runtimeDependencies !== null) {
      if (
        driver !== null
        || scopeProvider !== null
        || runtimeDependencyFactory !== null
        || !runtimeDependencies
        || typeof runtimeDependencies !== 'object'
        || typeof runtimeDependencies.driver !== 'object'
        || typeof runtimeDependencies.scopeProvider !== 'function'
      ) {
        throw new TypeError('Bound production runtime dependencies are invalid');
      }
      resolvedDriver = runtimeDependencies.driver;
      resolvedScopeProvider = runtimeDependencies.scopeProvider;
      resolvedCandidateScopeProvider = runtimeDependencies.candidateScopeProvider ?? null;
    }
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
      resolvedCandidateScopeProvider = runtimeDependencies.candidateScopeProvider ?? null;
    }

    if (resolvedEntitlementPort === null) {
      const actorResolver = runtimeDependencies?.actorResolver;
      if (!actorResolver || typeof actorResolver.resolve !== 'function') {
        throw new TypeError('Production actor resolver is unavailable');
      }
      resolvedEntitlementPort = entitlementPortFactory({ actorResolver });
      if (
        !resolvedEntitlementPort
        || typeof resolvedEntitlementPort.getStudentEntitlement !== 'function'
      ) {
        throw new TypeError('Production entitlement port factory returned an invalid port');
      }
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
    let resolvedAiProposalStore = aiProposalStore;
    if (
      !resolvedAiProposalStore
      && resolvedScopeProvider
      && supportsDurableAiProposalCommands(resolvedDriver)
    ) {
      resolvedAiProposalStore = new SupabaseDurableAiProposalStore({
        binding,
        driver: resolvedDriver,
        scopeProvider: resolvedScopeProvider,
      });
    }
    const proposalProvider = aiProposalProvider
      ?? (allowNonDurableForTests ? new DeterministicAiProposalAdapter() : null);
    const proposalStoreDurableEnough = Boolean(
      resolvedAiProposalStore
      && (allowNonDurableForTests || resolvedAiProposalStore.isDurable === true)
    );
    const draftingAvailable = Boolean(proposalStoreDurableEnough && proposalProvider);

    // The event sink is OMITTED, not passed as null: the service rejects a null sink, and its
    // durable branch forbids a sink outright because a durable repository commits state and
    // audit atomically in one transaction. A non-durable repository has no such transaction and
    // therefore does require one.
    const serviceOptions = {
      repository,
      entitlementPort: resolvedEntitlementPort,
      clock,
      requireCanary,
    };
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
        entitlementPort: resolvedEntitlementPort,
        proposalStore: resolvedAiProposalStore,
        clock,
        requireCanary,
      })
      : null;

    let resolvedFacultyInvitationLifecycleService = facultyInvitationLifecycleService;
    let facultyInvitationCommandRepository = null;
    if (
      !resolvedFacultyInvitationLifecycleService
      && facultyEmailPort
      && facultyInvitationSecretDeriver
      && typeof invitationOrigin === 'string'
      && resolvedScopeProvider
      && supportsDurableFacultyInvitationCommands(resolvedDriver)
    ) {
      facultyInvitationCommandRepository = new SupabaseDurableFacultyInvitationCommandRepository({
        binding,
        driver: resolvedDriver,
        scopeProvider: resolvedScopeProvider,
      });
      resolvedFacultyInvitationLifecycleService = new DurableFacultyInvitationLifecycleService({
        repository: facultyInvitationCommandRepository,
        emailPort: facultyEmailPort,
        secretDeriver: facultyInvitationSecretDeriver,
        invitationOrigin,
        clock,
      });
    }

    let resolvedFacultyInvitationVerificationService = facultyInvitationVerificationService;
    let facultyInvitationVerificationRepository = null;
    if (
      !resolvedFacultyInvitationVerificationService
      && typeof resolvedCandidateScopeProvider === 'function'
      && typeof candidateCredentialProvider === 'function'
      && supportsDurableFacultyInvitationCommands(resolvedDriver)
    ) {
      facultyInvitationVerificationRepository = new SupabaseDurableFacultyInvitationRepository({
        binding,
        driver: resolvedDriver,
        candidateScopeProvider: resolvedCandidateScopeProvider,
        candidateCredentialProvider,
      });
      resolvedFacultyInvitationVerificationService =
        new DurableFacultyInvitationVerificationService({
          repository: facultyInvitationVerificationRepository,
        });
    }

    let resolvedArtifactAuditSink = artifactAuditSink;
    if (
      !resolvedArtifactAuditSink
      && resolvedScopeProvider
      && supportsDurableArtifactAudit(resolvedDriver)
    ) {
      resolvedArtifactAuditSink = new SupabaseDurableArtifactAuditSink({
        binding,
        driver: resolvedDriver,
        scopeProvider: resolvedScopeProvider,
      });
    }

    const authenticProductionProviderGraph = Boolean(
      isAuthenticOpenAiGroundedProposalAdapter(proposalProvider)
      && isAuthenticDurableFacultyInvitationLifecycleService(
        resolvedFacultyInvitationLifecycleService,
      )
      && isAuthenticDurableFacultyInvitationVerificationService(
        resolvedFacultyInvitationVerificationService,
      )
      && isVerifiedPrivateVersionedStorageAdapter(privateStorageService)
      && isAuthenticDurableArtifactAuditSink(resolvedArtifactAuditSink)
    );

    const application = createLorApplicationAdapter({
      caseService,
      repository,
      // null, not omitted: the adapter treats an absent drafting service as
      // INTEGRATION_DISABLED on /ai-proposals only, leaving every other route live.
      aiDraftingService,
      facultyInvitationLifecycleService: resolvedFacultyInvitationLifecycleService,
      facultyInvitationVerificationService: resolvedFacultyInvitationVerificationService,
      privateStorageService,
      artifactAuditSink: resolvedArtifactAuditSink,
      allowNonDurableForTests,
      providersReady:
        operationalReadinessAuthority === MEASURED_OPERATIONAL_READINESS_AUTHORITY
        && authenticProductionProviderGraph,
      allAcceptedFunctionsOperational:
        operationalReadinessAuthority === MEASURED_OPERATIONAL_READINESS_AUTHORITY
        && authenticProductionProviderGraph,
    });
    return {
      application,
      binding,
      repository,
      caseService,
      aiDraftingService,
      aiProposalStore: resolvedAiProposalStore,
      draftingAvailable,
      facultyInvitationCommandRepository,
      facultyInvitationVerificationRepository,
      facultyInvitationLifecycleService: resolvedFacultyInvitationLifecycleService,
      facultyInvitationVerificationService: resolvedFacultyInvitationVerificationService,
      privateStorageService,
      artifactAuditSink: resolvedArtifactAuditSink,
      authenticProductionProviderGraph,
      runtimeDependencies,
      entitlementPort: resolvedEntitlementPort,
      // Present only when drafting is off, so an operator sees the specific cause.
      ...(draftingAvailable
        ? {}
        : {
          draftingUnavailableReason: proposalStoreDurableEnough
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
  const {
    signal = null,
    operationalReadinessFactory = undefined,
    providerReceipts = {},
    trustedProbeCoordinator = null,
    releaseFlags = null,
    ...compositionOptions
  } = options;
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
  if (
    operationalReadinessFactory !== undefined
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
    const productionReadinessRequired = composition.binding.environment === 'production';
    let readiness;
    if (productionReadinessRequired) {
      // Production readiness is intentionally not injectable. Accepting a caller-supplied
      // factory here would let an arbitrary structurally-green object mint the module-private
      // live authority below. The canonical coordinator validates the exact target and fresh
      // dependency receipts itself; tests exercise it through this same path.
      const coordinator = createProductionOperationalReadiness({
        binding: composition.binding,
        runtimeReadiness: dependencies.readiness,
        providerReceipts,
        trustedProbeCoordinator,
        flags: releaseFlags,
        clock: compositionOptions.clock,
      });
      if (!coordinator || typeof coordinator.snapshot !== 'function') {
        throw new TypeError('operational readiness coordinator invalid');
      }
      readiness = coordinator.snapshot();
    } else {
      readiness = dependencies.readiness.probe();
    }
    const receipt = signal
      ? await Promise.race([
        readiness,
        new Promise((_, reject) => {
          abortReadiness = () => reject(new TypeError('startup aborted'));
          signal.addEventListener('abort', abortReadiness, { once: true });
        }),
      ])
      : await readiness;
    if (productionReadinessRequired) {
      const dependencyStates = receipt?.dependencies;
      const databaseGroups = receipt?.databaseProbeGroups;
      if (
        !isLorReleaseModeReadinessAccepted(releaseFlags, receipt)
        || !hasExactEnumerableStringKeys(
          dependencyStates,
          OPERATIONAL_DEPENDENCY_NAMES,
        )
        || OPERATIONAL_DEPENDENCY_NAMES.some((name) => {
          const value = dependencyStates[name];
          return (
          !value
          || typeof value !== 'object'
          || value.state !== 'ready'
          || value.errorCode !== ''
          );
        })
        || !hasExactEnumerableStringKeys(
          databaseGroups,
          OPERATIONAL_DATABASE_GROUP_NAMES,
        )
        || OPERATIONAL_DATABASE_GROUP_NAMES.some((name) => databaseGroups[name] !== true)
      ) {
        throw new TypeError('operational readiness rejected');
      }
      // The first composition owns the one runtime dependency set. Recompose the pure
      // application graph over that SAME frozen driver/scope surface so measured readiness,
      // rather than caller booleans, is the only route to a live bootstrap. No second pool is
      // created and the original dependency set remains the shutdown owner.
      const liveComposition = createLorStudioApplication({
        ...compositionOptions,
        entitlementPort: composition.entitlementPort,
        entitlementPortFactory: null,
        runtimeDependencyFactory: null,
        boundRuntimeDependencies: dependencies,
        driver: null,
        scopeProvider: null,
        candidateScopeProvider: null,
        operationalReadinessAuthority: MEASURED_OPERATIONAL_READINESS_AUTHORITY,
      });
      if (liveComposition.application === null) {
        throw new TypeError('measured-ready composition failed');
      }
      const liveBootstrap = await liveComposition.application.getBootstrap();
      if (
        liveBootstrap?.operational !== true
        || liveBootstrap?.runtimeMode !== 'live'
        || liveBootstrap?.storageMode !== 'durable'
        || liveBootstrap?.providersReady !== true
        || liveBootstrap?.capabilities?.fullAcceptedFunctionSet !== true
      ) {
        throw new TypeError('measured-ready concrete application surfaces are incomplete');
      }
      return {
        ...liveComposition,
        runtimeDependencies: dependencies,
        operationalReadiness: receipt,
      };
    }

    const checks = receipt?.checks;
    if (
      receipt?.ready !== true
      || receipt?.reasonCode !== 'READY'
      || !checks
      || typeof checks !== 'object'
      || Array.isArray(checks)
      || Object.keys(checks).length < 1
      || Object.values(checks).some((value) => value !== true)
    ) throw new TypeError('readiness rejected');
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
