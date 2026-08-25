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
  AI_PROPOSAL_STORE_UNAVAILABLE: 'lor_ai_proposal_store_unavailable',
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
 * @param {object|null} [options.aiProposalStore] durable proposal store; absent means no drafting
 * @param {object|null} [options.aiProposalProvider] proposal provider; defaults to the deterministic one
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

  try {
    let repository;
    if (testRepository) {
      // Tests supply an explicit non-durable repository. The adapter still enforces
      // allowNonDurableForTests, so this cannot silently become a production path.
      repository = testRepository;
    } else if (durableRepositoryFactory) {
      repository = durableRepositoryFactory(binding);
    } else if (driver && scopeProvider) {
      repository = new SupabaseDurableRecommendationCaseRepository({
        binding,
        driver,
        scopeProvider,
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
  // enforceable inside the write rather than in a caller's read-then-write. No durable
  // implementation of that contract exists yet, in the same sense that no atomic RLS case driver
  // exists yet.
  //
  // Composing over a scratch in-memory store WOULD be wrong - a faculty writer's proposal and the
  // human decision recorded against it could vanish between two requests while the product
  // reported itself live - so an absent store still disables drafting outright.
  //
  // But it disables DRAFTING, not the product. Declining the whole composition here made an
  // unconfigured drafting plane fatal to case creation, the builder, receipts and release, none
  // of which touch a proposal: it took the E2E student journey down the moment it landed. Blast
  // radius belongs to the feature that is missing its dependency. The adapter already answers
  // /ai-proposals with 503 INTEGRATION_DISABLED when no drafting service is supplied, which is
  // the correct visible behaviour; the reason is reported on the composition result so an
  // operator learns the specific cause rather than inferring it from a generic 503.
  const draftingAvailable = Boolean(aiProposalStore);

    // The event sink is OMITTED, not passed as null: the service rejects a null sink, and its
    // durable branch forbids a sink outright because a durable repository commits state and
    // audit atomically in one transaction. A non-durable repository has no such transaction and
    // therefore does require one.
    const serviceOptions = { repository, entitlementPort, clock, requireCanary };
    if (eventSink) serviceOptions.eventSink = eventSink;
    const caseService = new RecommendationCaseService(serviceOptions);

    // THE PROVIDER IS CHOSEN HERE, and it is the deterministic local adapter.
    //
    // ai-proposal-service.js states plainly that it never constructs a provider, and the HTTP
    // adapter states plainly that it never picks one either, because choosing one is a
    // composition decision. This is that decision, and it is the conservative one: the
    // deterministic adapter reproduces approved evidence verbatim, holds no credential, reads no
    // environment key, and opens no socket (`externalNetworkUsed: false`). Binding a network
    // model would need a credential, a data-processing decision, and a retention decision that
    // no decision record has made, so nothing here reaches for one.
    //
    // The grounding gate does not soften because the provider is tame: AiProposalService still
    // runs the entailment and connective checks over whatever the provider returns, so the
    // moment a ratified provider replaces this line the same invariant covers it unchanged.
    const proposalService = new AiProposalService({
      provider: aiProposalProvider ?? new DeterministicAiProposalAdapter(),
      clock,
    });

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
      // Present only when drafting is off, so an operator sees the specific cause.
      ...(draftingAvailable
        ? {}
        : { draftingUnavailableReason: LOR_COMPOSITION_REASONS.AI_PROPOSAL_STORE_UNAVAILABLE }),
    };
  } catch {
    return {
      application: null,
      reason: LOR_COMPOSITION_REASONS.COMPOSITION_FAILED,
      binding,
    };
  }
}
