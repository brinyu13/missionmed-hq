import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AuthorizationDeniedError,
  DomainInvariantError,
  IdempotencyConflictError,
  IntegrationDisabledError,
  NotFoundError,
  ValidationError,
} from '../../lor-studio/domain/errors.js';
import { GROUNDING_MODEL_VERSION } from '../../lor-studio/domain/claim-validator.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';
import { AI_PROPOSAL_RECORD_SCHEMA } from '../../lor-studio/services/ai-proposal-service.js';
import {
  LOR_TARGET_BINDING_SCHEMA,
  resolveLorTargetBinding,
} from '../../lor-studio/adapters/lor-target-binding.mjs';
import {
  SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT,
  SupabaseDurableAiProposalStore,
} from '../../lor-studio/repositories/supabase-durable-ai-proposal-store.mjs';

const AT = '2026-08-25T20:00:00.000Z';
const CASE_ID = 'case-ai-durable-1';
const PROPOSAL_ID = 'proposal-ai-durable-1';
const IDEMPOTENCY_KEY = 'ai-request-1';
const REQUEST_HASH = sha256('ai-request-1');
const RESERVATION_ID = `ai_generation_reservation_${sha256('ai-generation-reservation')}`;
const FACT_ID = 'fact-rounds';
const FACT_HASH = sha256('The student arrived early for rounds.');
const TEXT = 'The student arrived early for rounds.';

function targetConfiguration(overrides = {}) {
  return {
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    ratified: true,
    decisionRecord: 'DR-133',
    environment: 'production',
    provider: 'railway-postgres',
    projectId: 'project-lor-production',
    environmentId: 'environment-lor-production',
    serviceId: 'service-lor-postgres',
    databaseName: 'lor_studio_production',
    region: 'us-east-1',
    schema: 'lor_studio',
    migrationLedger: 'lor-studio/migrations/ledger',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: true,
    ...overrides,
  };
}

function validBinding(overrides = {}) {
  return resolveLorTargetBinding(targetConfiguration(overrides));
}

function serverScope({ caseId = CASE_ID, operation = 'save', overrides = {} } = {}) {
  return {
    schemaVersion: 'missionmed.lor.server-query-scope.v1',
    authoritySource: 'server_verified_session_crosswalk',
    authenticated: true,
    roleVerified: true,
    authUid: 'railway-auth-user-202',
    authenticatedSubject: 'wp:202',
    actorId: 'wp:202',
    actorRole: 'faculty',
    resourceStudentId: 'wp:101',
    caseId,
    operation,
    purpose: 'faculty_private_edit',
    assignmentId: null,
    invitationId: 'faculty-invitation-1',
    administrativeGrantId: null,
    entitlementVerified: true,
    lorEnabled: true,
    canaryAuthorized: true,
    ...overrides,
  };
}

function proposalRecord({ id = PROPOSAL_ID, caseId = CASE_ID, requestedAt = AT } = {}) {
  const segments = [{
    kind: 'factual',
    text: TEXT,
    separator: 'paragraph',
    supportIds: [FACT_ID],
  }];
  const attestations = [{
    index: 0,
    kind: 'factual',
    supportIds: [FACT_ID],
    status: 'ENTAILED',
    verifierId: 'missionmed.entailment.verbatim.v1',
    rationaleCode: 'VERBATIM_MATCH',
    sourceHashes: [FACT_HASH],
  }];
  const sourceReferences = [{ id: FACT_ID, contentHash: FACT_HASH }];
  const groundingBase = {
    schemaVersion: GROUNDING_MODEL_VERSION,
    valid: true,
    claimCount: 1,
    segmentCount: 1,
    factualSegmentCount: 1,
    connectiveSegmentCount: 0,
    supportIds: [FACT_ID],
    segments,
    attestations,
  };
  const provenance = {
    schemaVersion: 'missionmed.lor.ai-proposal-provenance.v1',
    id,
    caseId,
    state: 'proposal',
    provider: 'openai',
    model: 'gpt-5.6-terra',
    templateVersion: 'missionmed.lor.draft-template.v1',
    templateHash: sha256('missionmed.lor.draft-template.v1'),
    sourceReferences,
    sourceSetHash: hashValue(sourceReferences),
    outputHash: sha256(TEXT),
    generatedAt: AT,
  };
  return {
    schemaVersion: AI_PROPOSAL_RECORD_SCHEMA,
    id,
    caseId,
    requestedBy: 'wp:202',
    requestedAt,
    state: 'proposal',
    humanDecisionRequired: true,
    text: TEXT,
    segments,
    claims: [{ text: TEXT, supportIds: [FACT_ID] }],
    grounding: {
      schemaVersion: GROUNDING_MODEL_VERSION,
      attestationHash: hashValue(groundingBase),
      factualSegmentCount: 1,
      connectiveSegmentCount: 0,
      supportIds: [FACT_ID],
      attestations,
    },
    provenance,
    fallbackUsed: false,
    decision: null,
    acceptedContent: null,
  };
}

function decidedRecord({ action = 'accepted', id = PROPOSAL_ID, caseId = CASE_ID } = {}) {
  const record = proposalRecord({ id, caseId });
  const decision = {
    schemaVersion: 'missionmed.lor.human-decision.v1',
    id: `decision-${id}`,
    caseId,
    proposalId: id,
    proposalOutputHash: record.provenance.outputHash,
    facultyId: 'wp:202',
    action,
    resultingTextHash: action === 'rejected' ? null : sha256(TEXT),
    decidedAt: AT,
  };
  return {
    ...record,
    state: 'decided',
    humanDecisionRequired: false,
    decision,
    acceptedContent: action === 'rejected' ? null : {
      origin: 'ai_proposal_accepted',
      text: TEXT,
      textHash: sha256(TEXT),
      supportIds: [FACT_ID],
      groundingAttestationHash: record.grounding.attestationHash,
      groundedAsAttested: true,
      proposalId: id,
      decisionId: decision.id,
      decidedAt: AT,
    },
  };
}

function bindings(record) {
  return {
    recordHash: hashValue(record),
    providerRunHash: hashValue(record.provenance),
    outputHash: record.provenance.outputHash,
    decisionHash: record.decision === null ? null : hashValue(record.decision),
    acceptedContentHash: record.acceptedContent === null ? null : hashValue(record.acceptedContent),
  };
}

function writeReceipt(command, { replayed = false, record = command.record, overrides = {} } = {}) {
  const stored = structuredClone(record);
  return {
    schemaVersion: SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.writeReceiptSchema,
    operation: command.operation,
    outcome: replayed ? 'replayed' : 'committed',
    writeApplied: !replayed,
    replayed,
    sameTransaction: true,
    databaseClockUsed: true,
    caseId: command.caseId,
    submittedProposalId: command.proposalId,
    proposalId: stored.id,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
    submittedRecordHash: command.recordHash,
    ...bindings(stored),
    transactionRef: `txn_${sha256('ai-store-transaction')}`,
    committedAt: AT,
    record: stored,
    ...overrides,
  };
}

function readReceipt(command, record = proposalRecord(), overrides = {}) {
  if (record === null) {
    return {
      schemaVersion: SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.readReceiptSchema,
      found: false,
      caseId: command.caseId,
      proposalId: command.proposalId,
      scopeHash: command.scopeHash,
      targetBindingHash: command.targetBindingHash,
      recordHash: null,
      providerRunHash: null,
      outputHash: null,
      decisionHash: null,
      acceptedContentHash: null,
      record: null,
      ...overrides,
    };
  }
  const stored = structuredClone(record);
  return {
    schemaVersion: SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.readReceiptSchema,
    found: true,
    caseId: command.caseId,
    proposalId: command.proposalId,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
    ...bindings(stored),
    record: stored,
    ...overrides,
  };
}

function errorReceipt(command, errorCode, overrides = {}) {
  return {
    schemaVersion: SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.errorReceiptSchema,
    operation: command.operation,
    errorCode,
    caseId: command.caseId,
    proposalId: command.proposalId,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
    ...overrides,
  };
}

function reservationReceipt(command, overrides = {}) {
  const status = command.operation === 'mark_generation_unknown' ? 'unknown' : 'pending';
  return {
    schemaVersion: SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.reservationReceiptSchema,
    reservationId: RESERVATION_ID,
    caseId: command.caseId,
    idempotencyKey: command.idempotencyKey,
    requestHash: command.requestHash,
    scopeHash: command.scopeHash,
    targetBindingHash: command.targetBindingHash,
    status,
    providerCallAuthorized: status === 'pending',
    replayed: false,
    proposalId: null,
    record: null,
    transactionRef: `txn_${sha256(`reservation:${status}`)}`,
    reservedAt: AT,
    settledAt: status === 'unknown' ? AT : null,
    ...overrides,
  };
}

function driverHarness(overrides = {}) {
  const calls = [];
  const driver = {
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    actorSafeReads: true,
    atomicProviderCallReservation: true,
    atomicProviderRunAndProposal: true,
    conditionalAtomicOneDecision: true,
    async reserveAiProposalGenerationAtomic(command) {
      calls.push({ method: 'reserveAiProposalGenerationAtomic', command });
      return reservationReceipt(command);
    },
    async markAiProposalGenerationUnknownAtomic(command) {
      calls.push({ method: 'markAiProposalGenerationUnknownAtomic', command });
      return reservationReceipt(command);
    },
    async persistProviderRunAndProposalAtomic(command) {
      calls.push({ method: 'persistProviderRunAndProposalAtomic', command });
      return writeReceipt(command);
    },
    async readActorSafeAiProposal(command) {
      calls.push({ method: 'readActorSafeAiProposal', command });
      return readReceipt(command);
    },
    async attachDecisionIfUndecidedAtomic(command) {
      calls.push({ method: 'attachDecisionIfUndecidedAtomic', command });
      return writeReceipt(command);
    },
    ...overrides,
  };
  return { driver, calls };
}

function storeHarness({ driverOverrides = {}, scopeProvider = null, binding = null } = {}) {
  const harness = driverHarness(driverOverrides);
  const scopeCalls = [];
  const provider = scopeProvider ?? (async (request) => {
    scopeCalls.push(structuredClone(request));
    return serverScope({ caseId: request.caseId, operation: request.operation });
  });
  const store = new SupabaseDurableAiProposalStore({
    binding: binding ?? validBinding(),
    driver: harness.driver,
    scopeProvider: provider,
  });
  return { store, calls: harness.calls, scopeCalls, driver: harness.driver };
}

function putRequest(record = proposalRecord()) {
  return { caseId: record.caseId, idempotencyKey: IDEMPOTENCY_KEY, requestHash: REQUEST_HASH, record };
}

function decisionRequest(record = decidedRecord()) {
  return {
    caseId: record.caseId,
    proposalId: record.id,
    idempotencyKey: 'ai-decision-1',
    requestHash: sha256('ai-decision-1'),
    record,
  };
}

test('durable AI proposal store rejects a hand-forged target binding and incomplete driver claims', () => {
  const binding = validBinding();
  const { driver } = driverHarness();
  assert.throws(
    () => new SupabaseDurableAiProposalStore({
      binding: structuredClone(binding),
      driver,
      scopeProvider: async () => serverScope(),
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'VALIDATED_TARGET_BINDING_REQUIRED',
  );
  for (const capability of SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.driverCapabilities) {
    assert.throws(
      () => new SupabaseDurableAiProposalStore({
        binding: validBinding(),
        driver: { ...driver, [capability]: false },
        scopeProvider: async () => serverScope(),
      }),
      (error) => error instanceof IntegrationDisabledError
        && error.details.status === 'ATOMIC_RLS_AI_PROPOSAL_DRIVER_REQUIRED',
    );
  }
});

test('generation reservation is actor-scoped, exact-shape, and precedes provider persistence', async () => {
  const { store, calls, scopeCalls } = storeHarness();
  const result = await store.reserveProposalGeneration({
    caseId: CASE_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
  });
  assert.equal(result.status, 'pending');
  assert.equal(result.providerCallAuthorized, true);
  assert.equal(result.replayed, false);
  assert.equal(result.record, null);
  assert.deepEqual(scopeCalls, [{ caseId: CASE_ID, operation: 'save' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'reserveAiProposalGenerationAtomic');
  assert.deepEqual(
    Object.keys(calls[0].command).sort(),
    SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.reservationCommandKeys,
  );
  assert.equal(calls[0].command.scopeHash, hashValue(calls[0].command.scope));
});

test('same generation reservation replays pending, accepted, or unknown without provider authority', async () => {
  for (const status of ['pending', 'accepted', 'unknown']) {
    const record = status === 'accepted' ? proposalRecord() : null;
    const { store } = storeHarness({
      driverOverrides: {
        async reserveAiProposalGenerationAtomic(command) {
          return reservationReceipt(command, {
            status,
            providerCallAuthorized: false,
            replayed: true,
            proposalId: record?.id ?? null,
            record,
            settledAt: status === 'pending' ? null : AT,
          });
        },
      },
    });
    const result = await store.reserveProposalGeneration({
      caseId: CASE_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      requestHash: REQUEST_HASH,
    });
    assert.equal(result.status, status);
    assert.equal(result.providerCallAuthorized, false);
    assert.equal(result.replayed, true);
    assert.equal(result.record?.id ?? null, record?.id ?? null);
  }
});

test('unknown transition is durable and cannot claim a proposal', async () => {
  const { store, calls } = storeHarness();
  const result = await store.markProposalGenerationUnknown({
    caseId: CASE_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
  });
  assert.equal(result.status, 'unknown');
  assert.equal(result.providerCallAuthorized, false);
  assert.equal(result.record, null);
  assert.equal(calls[0].method, 'markAiProposalGenerationUnknownAtomic');
});

test('putProposal validates the full record and makes the exact atomic provider-run driver call', async () => {
  const { store, calls, scopeCalls } = storeHarness();
  const record = proposalRecord();
  const result = await store.putProposal(putRequest(record));
  assert.deepEqual(result, { record, replayed: false });
  assert.deepEqual(scopeCalls, [{ caseId: CASE_ID, operation: 'save' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'persistProviderRunAndProposalAtomic');
  const command = calls[0].command;
  assert.deepEqual(Object.keys(command).sort(), SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.writeCommandKeys);
  assert.equal(command.schemaVersion, SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.driverCommandSchema);
  assert.equal(command.operation, 'put_proposal');
  assert.equal(command.expectedState, 'absent_or_same_idempotency');
  assert.equal(command.expectedOutputHash, null);
  assert.equal(command.expectedDecisionHash, null);
  assert.equal(command.recordHash, hashValue(record));
  assert.equal(command.providerRunHash, hashValue(record.provenance));
  assert.equal(command.scopeHash, hashValue(command.scope));
  assert.equal(command.targetBindingHash, hashValue(command.binding));
});

test('getProposal uses only an actor-safe case-bound read and accepts exact absence', async () => {
  const { store, calls, scopeCalls } = storeHarness({
    driverOverrides: {
      async readActorSafeAiProposal(command) {
        calls.push({ method: 'readActorSafeAiProposal', command });
        return readReceipt(command, null);
      },
    },
  });
  const result = await store.getProposal({ caseId: CASE_ID, proposalId: PROPOSAL_ID });
  assert.equal(result, null);
  assert.deepEqual(scopeCalls, [{ caseId: CASE_ID, operation: 'read' }]);
  assert.deepEqual(
    Object.keys(calls[0].command).sort(),
    SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.readCommandKeys,
  );
  assert.equal(calls[0].command.operation, 'get_proposal');
});

test('attachDecision submits a conditional one-decision command bound to the proposal output', async () => {
  const { store, calls } = storeHarness();
  const record = decidedRecord();
  const result = await store.attachDecision(decisionRequest(record));
  assert.deepEqual(result, { record, replayed: false });
  assert.equal(calls[0].method, 'attachDecisionIfUndecidedAtomic');
  assert.equal(calls[0].command.operation, 'attach_decision');
  assert.equal(calls[0].command.expectedState, 'proposal');
  assert.equal(calls[0].command.expectedOutputHash, record.provenance.outputHash);
  assert.equal(calls[0].command.expectedDecisionHash, null);
  assert.equal(calls[0].command.decisionHash, hashValue(record.decision));
  assert.equal(calls[0].command.acceptedContentHash, hashValue(record.acceptedContent));
});

test('store rejects malformed or non-faculty server scope before any driver call', async () => {
  for (const scope of [
    { ...serverScope(), actorRole: 'student' },
    { ...serverScope(), caseId: 'case-other' },
    { ...serverScope(), clientGrounding: [] },
    { ...serverScope(), invitationId: null },
  ]) {
    const { store, calls } = storeHarness({ scopeProvider: async () => scope });
    await assert.rejects(
      store.putProposal(putRequest()),
      (error) => error instanceof IntegrationDisabledError
        && error.details.status === 'VERIFIED_FACULTY_SCOPE_REQUIRED',
    );
    assert.equal(calls.length, 0);
  }
});

test('proposal requester and human decider must match the authenticated faculty scope', async () => {
  const put = proposalRecord();
  put.requestedBy = 'wp:303';
  const first = storeHarness();
  await assert.rejects(first.store.putProposal(putRequest(put)), AuthorizationDeniedError);
  assert.equal(first.calls.length, 0);

  const decided = decidedRecord();
  decided.decision.facultyId = 'wp:303';
  const second = storeHarness();
  await assert.rejects(second.store.attachDecision(decisionRequest(decided)), AuthorizationDeniedError);
  assert.equal(second.calls.length, 0);
});

test('store refuses extra client authorization or grounding fields on every public method', async () => {
  const { store, calls } = storeHarness();
  await assert.rejects(
    store.putProposal({ ...putRequest(), actorRole: 'faculty', grounding: {} }),
    ValidationError,
  );
  await assert.rejects(
    store.getProposal({ caseId: CASE_ID, proposalId: PROPOSAL_ID, grant: 'forged' }),
    ValidationError,
  );
  await assert.rejects(
    store.attachDecision({ ...decisionRequest(), authorization: { allowed: true } }),
    ValidationError,
  );
  assert.equal(calls.length, 0);
});

test('store refuses forged proposal, grounding, decision, and accepted-content hashes before persistence', async () => {
  const corruptions = [
    (record) => { record.provenance.outputHash = sha256('different output'); },
    (record) => { record.grounding.attestationHash = sha256('forged grounding'); },
    (record) => { record.provenance.sourceSetHash = sha256('forged sources'); },
    (record) => { record.provenance.templateHash = sha256('forged template'); },
  ];
  for (const corrupt of corruptions) {
    const record = proposalRecord();
    corrupt(record);
    const { store, calls } = storeHarness();
    await assert.rejects(store.putProposal(putRequest(record)), ValidationError);
    assert.equal(calls.length, 0);
  }
  const decided = decidedRecord();
  decided.acceptedContent.textHash = sha256('forged content');
  const { store, calls } = storeHarness();
  await assert.rejects(store.attachDecision(decisionRequest(decided)), ValidationError);
  assert.equal(calls.length, 0);
});

test('actor-safe reads fail closed on a wrong-case row or any forged hash receipt', async () => {
  const wrongCase = proposalRecord({ caseId: 'case-other' });
  const first = storeHarness({
    driverOverrides: {
      async readActorSafeAiProposal(command) {
        return readReceipt(command, wrongCase);
      },
    },
  });
  await assert.rejects(
    first.store.getProposal({ caseId: CASE_ID, proposalId: PROPOSAL_ID }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'ACTOR_SAFE_PROPOSAL_READ_INVALID',
  );

  const second = storeHarness({
    driverOverrides: {
      async readActorSafeAiProposal(command) {
        return readReceipt(command, proposalRecord(), { outputHash: sha256('forged') });
      },
    },
  });
  await assert.rejects(
    second.store.getProposal({ caseId: CASE_ID, proposalId: PROPOSAL_ID }),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'ACTOR_SAFE_PROPOSAL_READ_INVALID',
  );
});

test('hostile write receipts with extra keys, wrong hashes, or wrong request binding are fixed safe failures', async () => {
  const variants = [
    (command) => writeReceipt(command, { overrides: { leakedCredential: 'must-not-escape' } }),
    (command) => writeReceipt(command, { overrides: { recordHash: sha256('forged') } }),
    (command) => writeReceipt(command, { overrides: { requestHash: sha256('other request') } }),
    (command) => writeReceipt(command, { overrides: { databaseClockUsed: false } }),
  ];
  for (const makeReceipt of variants) {
    const { store } = storeHarness({
      driverOverrides: {
        async persistProviderRunAndProposalAtomic(command) {
          return makeReceipt(command);
        },
      },
    });
    await assert.rejects(store.putProposal(putRequest()), (error) => {
      assert.ok(error instanceof IntegrationDisabledError);
      assert.equal(error.details.status, 'ATOMIC_PROPOSAL_RECEIPT_INVALID');
      assert.doesNotMatch(JSON.stringify(error), /must-not-escape/u);
      return true;
    });
  }
});

test('identical-request replay may return the prior stored proposal but no mismatched request hash', async () => {
  const prior = proposalRecord({ id: 'proposal-prior-id', requestedAt: '2026-08-25T19:00:00.000Z' });
  const good = storeHarness({
    driverOverrides: {
      async persistProviderRunAndProposalAtomic(command) {
        return writeReceipt(command, { replayed: true, record: prior });
      },
    },
  });
  const replay = await good.store.putProposal(putRequest());
  assert.equal(replay.replayed, true);
  assert.equal(replay.record.id, prior.id);

  const bad = storeHarness({
    driverOverrides: {
      async persistProviderRunAndProposalAtomic(command) {
        return writeReceipt(command, {
          replayed: true,
          record: prior,
          overrides: { requestHash: sha256('not-the-request') },
        });
      },
    },
  });
  await assert.rejects(
    bad.store.putProposal(putRequest()),
    (error) => error instanceof IntegrationDisabledError
      && error.details.status === 'ATOMIC_PROPOSAL_RECEIPT_INVALID',
  );
});

test('exact database conflict receipts map to fixed idempotency, not-found, and one-decision errors', async () => {
  const idempotency = storeHarness({
    driverOverrides: {
      async persistProviderRunAndProposalAtomic(command) {
        return errorReceipt(command, 'IDEMPOTENCY_CONFLICT');
      },
    },
  });
  await assert.rejects(idempotency.store.putProposal(putRequest()), IdempotencyConflictError);

  const notFound = storeHarness({
    driverOverrides: {
      async attachDecisionIfUndecidedAtomic(command) {
        return errorReceipt(command, 'NOT_FOUND');
      },
    },
  });
  await assert.rejects(notFound.store.attachDecision(decisionRequest()), NotFoundError);

  for (const errorCode of ['AI_PROPOSAL_ALREADY_DECIDED', 'CONCURRENT_DECISION_CONFLICT']) {
    const conflict = storeHarness({
      driverOverrides: {
        async attachDecisionIfUndecidedAtomic(command) {
          return errorReceipt(command, errorCode);
        },
      },
    });
    await assert.rejects(conflict.store.attachDecision(decisionRequest()), (error) => {
      assert.ok(error instanceof DomainInvariantError);
      assert.equal(error.details.reasonCode, 'AI_PROPOSAL_ALREADY_DECIDED');
      assert.equal(error.details.proposalId, PROPOSAL_ID);
      return true;
    });
  }
});

test('driver exceptions are redacted into fixed safe failures and never leak protected values', async () => {
  const protectedValue = 'postgres://administrator:rotated-secret@example.invalid/lor';
  const { store } = storeHarness({
    driverOverrides: {
      async persistProviderRunAndProposalAtomic() {
        throw new Error(protectedValue);
      },
    },
  });
  await assert.rejects(store.putProposal(putRequest()), (error) => {
    assert.ok(error instanceof IntegrationDisabledError);
    assert.equal(error.details.status, 'ATOMIC_PROPOSAL_PERSISTENCE_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(error), /rotated-secret/u);
    assert.doesNotMatch(error.message, /administrator/u);
    return true;
  });
});

test('contract exports the reserve-before-provider ABI and no implicit target', () => {
  assert.deepEqual(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.driverMethods, {
    reserveProposalGeneration: 'reserveAiProposalGenerationAtomic',
    finalizeProposalGeneration: 'persistProviderRunAndProposalAtomic',
    markProposalGenerationUnknown: 'markAiProposalGenerationUnknownAtomic',
    putProposal: 'persistProviderRunAndProposalAtomic',
    getProposal: 'readActorSafeAiProposal',
    attachDecision: 'attachDecisionIfUndecidedAtomic',
  });
  assert.deepEqual(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.publicMethods, [
    'reserveProposalGeneration',
    'finalizeProposalGeneration',
    'markProposalGenerationUnknown',
    'putProposal',
    'getProposal',
    'attachDecision',
  ]);
  assert.equal(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.defaultTarget, null);
  assert.equal(Object.isFrozen(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT), true);
  assert.equal(Object.isFrozen(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.driverMethods), true);
  assert.equal(Object.isFrozen(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.writeCommandKeys), true);
  assert.equal(Object.isFrozen(SUPABASE_DURABLE_AI_PROPOSAL_STORE_CONTRACT.writeReceiptKeys), true);
});
