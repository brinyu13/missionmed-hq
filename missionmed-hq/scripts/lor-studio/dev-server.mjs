/**
 * LOR Studio local verification server. TEST ONLY.
 *
 * Boots the REAL createLorStudioRuntime with an application from the REAL composition root, so a
 * browser can exercise the mounted product end to end. It exists because API tests cannot prove
 * the frontend hydration path - only a browser can.
 *
 * SAFETY. This process injects a fixed test session and a static entitlement, which is exactly the
 * thing that must never reach production. It therefore refuses to start unless
 * LOR_STUDIO_DEV_SERVER=1 is set explicitly, binds loopback only, and uses an explicit
 * non-production target configuration. Nothing in the product imports this file; it is invoked
 * only by hand or by a browser verification run.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLorStudioApplication } from '../../lor-studio/composition.mjs';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import { DeterministicAiProposalAdapter } from '../../lor-studio/adapters/deterministic-ai-provider.js';
import {
  MetadataOnlyEventBuffer,
  StaticEntitlementTestAdapter,
} from '../../lor-studio/adapters/test-adapters.js';
import { IdempotencyConflictError, NotFoundError } from '../../lor-studio/domain/errors.js';
import { aiProposalAlreadyDecided } from '../../lor-studio/services/ai-proposal-service.js';

if (process.env.LOR_STUDIO_DEV_SERVER !== '1') {
  console.error('Refusing to start: set LOR_STUDIO_DEV_SERVER=1 to run the local verification server.');
  process.exit(2);
}

const SUBJECT = process.env.LOR_STUDIO_DEV_SUBJECT || 'wp:1';
const PORT = Number(process.env.LOR_STUDIO_DEV_PORT || 8181);

/** Explicit, ratified, NON-denied local target. There is deliberately no default. */
const TARGET_CONFIGURATION = {
  schemaVersion: 'missionmed.lor.target-binding.v2',
  ratified: true,
  decisionRecord: 'DR-133',
  environment: 'local',
  provider: 'railway-postgres',
  projectId: 'lor-local-verification-project',
  environmentId: 'lor-local-verification-environment',
  serviceId: 'lor-local-verification-service',
  databaseName: 'railway',
  region: 'us-west2',
  schema: 'lor_studio',
  migrationLedger: 'lor-local-verification-ledger',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
};

/**
 * A repository that satisfies the DURABLE contract in memory.
 *
 * Why this exists: the bootstrap route refuses live mode unless the repository reports
 * isDurable === true, and the frontend adapter only hydrates when the server reports operational.
 * So a non-durable repository can never exercise the hydration path at all - the browser would
 * only ever see the unavailable card, and the frontend would remain unprovable.
 *
 * This is NOT a durability claim and must never be mistaken for one. It has no transaction, no
 * RLS, and no storage; it satisfies the SHAPE of the durable contract so the wiring above it can
 * be exercised. Real durability still requires the atomic RLS driver and an explicitly validated
 * Railway PostgreSQL target. It lives in scripts/, is imported by no product code, and the process
 * refuses to start without an explicit opt-in flag.
 */
class LocalVerificationDurableRepository {
  constructor() {
    this.isDurable = true;
    this.atomicStateAndEvent = true;
    this.durability = 'LOCAL_VERIFICATION_NOT_DURABLE_IN_FACT';
    this.inner = new InMemoryRecommendationCaseRepository();
  }

  async getById(caseId) {
    return this.inner.getById(caseId);
  }

  async reserveCaseCreation(request) {
    return this.inner.reserveCaseCreation(request);
  }

  async commitWithEvent(transaction) {
    const metadata = {
      idempotencyKey: transaction.idempotencyKey,
      requestHash: transaction.requestHash,
    };
    return transaction.operation === 'create'
      ? this.inner.create(transaction.record, metadata)
      : this.inner.save(transaction.record, { expectedRevision: transaction.expectedRevision, ...metadata });
  }

  describePersistence() {
    return { environment: 'local', productionEligible: false, durability: this.durability };
  }

  assertProductionReady() {
    throw new Error('LocalVerificationDurableRepository is never production ready.');
  }
}

/**
 * The AI proposal store contract, in memory. LOCAL VERIFICATION ONLY.
 *
 * Same standing as LocalVerificationDurableRepository above, and the same warning: this is NOT
 * persistence. It satisfies the SHAPE of the conditional-atomic-write contract so a browser can
 * drive draft -> read -> decide, and it loses every proposal when the process exits.
 *
 * The two conditional writes are honoured rather than approximated, because approximating them
 * is precisely how a local server teaches the wrong lesson about the contract:
 *
 *   putProposal    - replays on a repeat of (caseId, idempotencyKey) with the same requestHash,
 *                    conflicts on a different one, and refuses a record that arrives decided.
 *   attachDecision - tests "still undecided" INSIDE the write. A read-then-write here would let
 *                    two concurrent decisions both observe null and both commit, which is the
 *                    one thing the store exists to prevent.
 */
class LocalVerificationAiProposalStore {
  constructor() {
    this.isDurable = false;
    this.durability = 'LOCAL_VERIFICATION_NOT_DURABLE_IN_FACT';
    this.records = new Map();
    this.idempotency = new Map();
  }

  static key(caseId, id) {
    return `${caseId} ${id}`;
  }

  #replay(caseId, idempotencyKey, requestHash) {
    const reserved = this.idempotency.get(LocalVerificationAiProposalStore.key(caseId, idempotencyKey));
    if (!reserved) return null;
    if (reserved.requestHash !== requestHash) throw new IdempotencyConflictError({ idempotencyKey });
    const stored = this.records.get(LocalVerificationAiProposalStore.key(caseId, reserved.proposalId));
    return { record: structuredClone(stored), replayed: true };
  }

  #reserve(caseId, idempotencyKey, requestHash, proposalId) {
    this.idempotency.set(
      LocalVerificationAiProposalStore.key(caseId, idempotencyKey),
      { requestHash, proposalId },
    );
  }

  async putProposal({ caseId, idempotencyKey, requestHash, record }) {
    // A proposal may never arrive already decided: the decision is a separate, human act.
    if (record.decision !== null || record.acceptedContent !== null) {
      throw new Error('A stored AI proposal may not arrive already decided');
    }
    const replay = this.#replay(caseId, idempotencyKey, requestHash);
    if (replay) return replay;
    this.#reserve(caseId, idempotencyKey, requestHash, record.id);
    this.records.set(LocalVerificationAiProposalStore.key(caseId, record.id), structuredClone(record));
    return { record: structuredClone(record), replayed: false };
  }

  async getProposal({ caseId, proposalId }) {
    const stored = this.records.get(LocalVerificationAiProposalStore.key(caseId, proposalId));
    return stored ? structuredClone(stored) : null;
  }

  async attachDecision({ caseId, proposalId, idempotencyKey, requestHash, record }) {
    const replay = this.#replay(caseId, idempotencyKey, requestHash);
    if (replay) return replay;
    const key = LocalVerificationAiProposalStore.key(caseId, proposalId);
    const stored = this.records.get(key);
    if (!stored) throw new NotFoundError('ai_proposal', proposalId);
    if (stored.decision !== null) throw aiProposalAlreadyDecided(proposalId);
    this.#reserve(caseId, idempotencyKey, requestHash, proposalId);
    this.records.set(key, structuredClone(record));
    return { record: structuredClone(record), replayed: false };
  }
}

function entitlementRecord(studentId) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'LOCAL_VERIFICATION_ONLY',
  };
}

const composed = createLorStudioApplication({
  targetConfiguration: TARGET_CONFIGURATION,
  entitlementPort: new StaticEntitlementTestAdapter([entitlementRecord(SUBJECT)]),
  // The durable branch of RecommendationCaseService forbids an event sink, because a durable
  // repository commits state and audit atomically in one transaction.
  testRepository: new LocalVerificationDurableRepository(),
  // AI drafting, exercisable in a browser. The store is the in-memory one above; the provider is
  // the deterministic local adapter - the same one the composition root defaults to - named here
  // so the local server's provider choice is visible at its own composition site rather than
  // inherited silently. Neither binds a credential nor opens a socket.
  aiProposalStore: new LocalVerificationAiProposalStore(),
  aiProposalProvider: new DeterministicAiProposalAdapter(),
  // Asserted true ONLY here, so the browser can exercise the hydration path. These are caller
  // assertions, not measurements - the dependency probes that would measure them are unbuilt.
  // Production composition leaves both false, which is why production still declines.
  providersReady: true,
  allAcceptedFunctionsOperational: true,
});

if (!composed.application) {
  console.error(`Composition declined: ${composed.reason}${composed.detail ? ` (${composed.detail})` : ''}`);
  process.exit(1);
}

const runtime = createLorStudioRuntime({
  publicDirectory: path.join(fileURLToPath(new URL('../../public/', import.meta.url)), 'lor-studio'),
  flags: { enabled: true, killSwitch: false, requireCanary: false },
  entitlementResolver: {
    async resolve() {
      // Flat contract: evaluateLorEntitlement reads these off the resolved object directly and
      // then requires actorId to equal the authenticated subject.
      return {
        available: true,
        sourceVerified: true,
        revoked: false,
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        canaryEnabled: true,
        canaryConsented: true,
        studentId: SUBJECT,
        actorId: SUBJECT,
      };
    },
  },
  application: composed.application,
  // Local verification only. Production CSRF validation is unchanged and lives in server.mjs.
  validateCsrf: () => true,
});

function devSession() {
  const now = Date.now();
  return {
    user: { id: SUBJECT, role: 'student' },
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 60 * 60_000).toISOString(),
    csrfToken: 'local-verification-csrf',
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://127.0.0.1:${PORT}`);
  try {
    const handled = await runtime.handle(request, response, url, { session: devSession() });
    if (handled) return;
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(500, { 'content-type': 'application/json' });
    }
    response.end(JSON.stringify({ error: 'dev_server_failure', message: String(error?.message || error) }));
    return;
  }
  response.writeHead(302, { location: '/lor-studio' });
  response.end();
});

// Loopback only - never expose this process on a routable interface.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`LOR Studio local verification server: http://127.0.0.1:${PORT}/lor-studio`);
  console.log(`  subject: ${SUBJECT}   target: ${TARGET_CONFIGURATION.projectId} (${TARGET_CONFIGURATION.environment})`);
  console.log('  TEST ONLY - fixed session, static entitlement, non-durable repository and proposal store.');
});
