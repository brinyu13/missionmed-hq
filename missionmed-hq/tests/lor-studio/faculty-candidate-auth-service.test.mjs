import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IntegrationDisabledError,
  InvitationDeniedError,
} from '../../lor-studio/domain/errors.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import {
  DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT,
  DurableFacultyCandidateAuthService,
  isAuthenticDurableFacultyCandidateAuthService,
} from '../../lor-studio/services/durable-faculty-candidate-auth-service.mjs';
import { resolveLorTargetBinding } from '../../lor-studio/adapters/lor-target-binding.mjs';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const EXPIRES_AT = new Date(NOW.getTime() + 10 * 60 * 1_000).toISOString();
const RAW_TOKEN = Buffer.alloc(32, 0x42).toString('base64url');
const TOKEN_HASH = sha256(RAW_TOKEN);
const SECRET_KEY = Buffer.alloc(32, 0x73);
const INVITATION_ID = 'invite_candidate-auth-1';
const CASE_ID = 'case_candidate-auth-1';

function targetBinding() {
  return resolveLorTargetBinding({
    schemaVersion: 'missionmed.lor.target-binding.v2',
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
  });
}

function secretBinding() {
  return Object.freeze({
    schemaVersion: 'missionmed.lor.faculty-invitation-secret-binding.v1',
    providerResourceBound: true,
    independentlyVerified: true,
    serverSideSecret: true,
    keyVersion: 'candidate-auth-test-v1',
  });
}

function keyProvider(key = SECRET_KEY) {
  const calls = [];
  return {
    calls,
    serverOnly: true,
    async getKey(request) {
      calls.push(structuredClone(request));
      return Buffer.from(key);
    },
  };
}

function durableDriver({
  tokenHash = TOKEN_HASH,
  requiresOtpVerification = true,
} = {}) {
  const calls = [];
  const reservations = new Map();
  let transaction = 100;
  return {
    calls,
    reservations,
    rlsEnforced: true,
    serverOnly: true,
    databaseClock: true,
    atomicFacultyCandidateHandoffs: true,
    async reserveFacultyCandidateAuthHandoffAtomic(command) {
      calls.push(['reserve', command]);
      if (command.tokenHash !== tokenHash) throw new InvitationDeniedError();
      const reservation = {
        invitationId: command.invitationId,
        tokenHash: command.tokenHash,
        flowNonceHash: command.flowNonceHash,
        issuedAt: NOW.toISOString(),
        expiresAt: EXPIRES_AT,
        redeemed: false,
      };
      reservations.set(command.flowNonceHash, reservation);
      return {
        schemaVersion: 'missionmed.lor.faculty-candidate-auth-reservation-receipt.v1',
        action: 'faculty.candidate_handoff.reserve',
        reserved: true,
        replayed: false,
        invitationId: reservation.invitationId,
        caseId: CASE_ID,
        requiresOtpVerification,
        tokenHash: reservation.tokenHash,
        flowNonceHash: reservation.flowNonceHash,
        issuedAt: reservation.issuedAt,
        expiresAt: reservation.expiresAt,
        transactionId: String(transaction++),
      };
    },
    async redeemFacultyCandidateAuthHandoffAtomic(command) {
      calls.push(['redeem', command]);
      const reservation = reservations.get(command.flowNonceHash);
      if (
        !reservation
        || reservation.redeemed
        || reservation.invitationId !== command.invitationId
        || reservation.tokenHash !== command.tokenHash
        || reservation.issuedAt !== command.issuedAt
        || reservation.expiresAt !== command.expiresAt
      ) throw new InvitationDeniedError();
      reservation.redeemed = true;
      return {
        schemaVersion: 'missionmed.lor.faculty-candidate-auth-redemption-receipt.v1',
        action: 'faculty.candidate_handoff.redeem',
        redeemed: true,
        replayed: false,
        invitationId: reservation.invitationId,
        caseId: CASE_ID,
        requiresOtpVerification,
        tokenHash: reservation.tokenHash,
        flowNonceHash: reservation.flowNonceHash,
        authenticatedSubject: command.authenticatedSubject,
        issuedAt: reservation.issuedAt,
        expiresAt: reservation.expiresAt,
        transactionId: String(transaction++),
      };
    },
  };
}

function harness({
  clock = () => NOW,
  driver = durableDriver(),
  keys = keyProvider(),
  nonceByte = 0x31,
  ivByte = 0x22,
} = {}) {
  const binding = targetBinding();
  const service = new DurableFacultyCandidateAuthService({
    binding,
    driver,
    secretBinding: secretBinding(),
    keyProvider: keys,
    clock,
    nonceFactory: (length) => Buffer.alloc(length, nonceByte),
    ivFactory: (length) => Buffer.alloc(length, ivByte),
  });
  return { binding, driver, keys, service };
}

function invitationDenied(error) {
  return error instanceof InvitationDeniedError
    && error.code === 'INVITATION_DENIED'
    && error.details?.reasonCode === 'INVITATION_DENIED';
}

test('durable exchange hashes the token, seals only hash-bound state, and redeems once', async () => {
  const { binding, driver, keys, service } = harness();
  const handoff = await service.exchangeInvitationToken({
    invitationId: INVITATION_ID,
    rawToken: RAW_TOKEN,
  });

  assert.deepEqual(Object.keys(handoff), [
    'schemaVersion',
    'authoritySource',
    'invitationId',
    'sealedHandoff',
    'issuedAt',
    'expiresAt',
    'singlePurpose',
    'clientAsserted',
  ]);
  assert.equal(handoff.schemaVersion, 'missionmed.lor.faculty-candidate-auth-handoff.v1');
  assert.equal(handoff.authoritySource, 'server_verified_invitation_token_exchange');
  assert.equal(handoff.invitationId, INVITATION_ID);
  assert.match(handoff.sealedHandoff, /^lorch1\.[^.]+\.[^.]+\.[^.]+$/u);
  assert.equal(handoff.issuedAt, NOW.toISOString());
  assert.equal(handoff.expiresAt, EXPIRES_AT);
  assert.equal(handoff.singlePurpose, true);
  assert.equal(handoff.clientAsserted, false);
  assert.equal(Object.isFrozen(handoff), true);

  const [reserveAction, reserveCommand] = driver.calls[0];
  assert.equal(reserveAction, 'reserve');
  assert.equal(reserveCommand.binding, binding);
  assert.equal(reserveCommand.invitationId, INVITATION_ID);
  assert.equal(reserveCommand.tokenHash, TOKEN_HASH);
  assert.equal(reserveCommand.flowNonceHash, sha256(Buffer.alloc(32, 0x31)));
  assert.equal(reserveCommand.maximumLifetimeSeconds, 600);
  assert.equal(JSON.stringify(reserveCommand).includes(RAW_TOKEN), false);
  assert.equal(JSON.stringify(handoff).includes(RAW_TOKEN), false);
  assert.deepEqual(keys.calls, [{
    keyVersion: 'candidate-auth-test-v1',
    purpose: 'lor_faculty_invitation_hmac',
  }]);

  const metadata = await service.inspectSealedHandoff({
    sealedHandoff: handoff.sealedHandoff,
  });
  assert.deepEqual({ ...metadata }, {
    schemaVersion: 'missionmed.lor.faculty-candidate-auth-handoff-metadata.v1',
    authoritySource: 'server_verified_sealed_candidate_cookie',
    identityClass: 'faculty_candidate',
    invitationId: INVITATION_ID,
    issuedAt: NOW.toISOString(),
    expiresAt: EXPIRES_AT,
    singlePurpose: true,
    clientAsserted: false,
  });
  assert.equal(Object.isFrozen(metadata), true);
  assert.equal(JSON.stringify(metadata).includes(RAW_TOKEN), false);
  assert.equal(JSON.stringify(metadata).includes(TOKEN_HASH), false);
  assert.equal(driver.calls.length, 1, 'inspection must not consume durable state');
  assert.equal(keys.calls.length, 2);

  const credential = await service.redeemSealedHandoff({
    authenticatedSubject: 'wp:43',
    invitationId: INVITATION_ID,
    sealedHandoff: handoff.sealedHandoff,
  });
  assert.deepEqual({ ...credential }, {
    schemaVersion: 'missionmed.lor.faculty-candidate-credential.v1',
    authoritySource: 'server_verified_sealed_candidate_cookie',
    authenticatedSubject: 'wp:43',
    invitationId: INVITATION_ID,
    caseId: CASE_ID,
    requiresOtpVerification: true,
    tokenHash: TOKEN_HASH,
    flowNonceHash: reserveCommand.flowNonceHash,
    issuedAt: NOW.toISOString(),
    expiresAt: EXPIRES_AT,
    clientAsserted: false,
  });
  assert.equal(Object.getPrototypeOf(credential), null);
  assert.equal(Object.isFrozen(credential), true);
  assert.equal(JSON.stringify(credential).includes(RAW_TOKEN), false);

  const [, redeemCommand] = driver.calls[1];
  assert.equal(redeemCommand.authenticatedSubject, 'wp:43');
  assert.equal(redeemCommand.invitationId, INVITATION_ID);
  assert.equal(redeemCommand.tokenHash, TOKEN_HASH);
  assert.equal(redeemCommand.flowNonceHash, reserveCommand.flowNonceHash);
  assert.equal(JSON.stringify(redeemCommand).includes(RAW_TOKEN), false);
  assert.equal(keys.calls.length, 3);

  await assert.rejects(
    service.redeemSealedHandoff({
      authenticatedSubject: 'wp:43',
      invitationId: INVITATION_ID,
      sealedHandoff: handoff.sealedHandoff,
    }),
    invitationDenied,
  );
  assert.equal(driver.calls.filter(([action]) => action === 'redeem').length, 2);
});

test('durable verified re-entry stays subject-bound while skipping a second OTP ceremony', async () => {
  const { service } = harness({
    driver: durableDriver({ requiresOtpVerification: false }),
  });
  const handoff = await service.exchangeInvitationToken({
    invitationId: INVITATION_ID,
    rawToken: RAW_TOKEN,
  });
  const credential = await service.redeemSealedHandoff({
    authenticatedSubject: 'wp:43',
    invitationId: INVITATION_ID,
    sealedHandoff: handoff.sealedHandoff,
  });
  assert.equal(credential.caseId, CASE_ID);
  assert.equal(credential.requiresOtpVerification, false);
  assert.equal(credential.authenticatedSubject, 'wp:43');
  assert.equal(Object.isFrozen(credential), true);
});

test('sealed-handoff inspection is authenticated, non-consuming, fresh, and metadata-only', async () => {
  const { driver, service } = harness();
  const handoff = await service.exchangeInvitationToken({
    invitationId: INVITATION_ID,
    rawToken: RAW_TOKEN,
  });
  const inspection = { sealedHandoff: handoff.sealedHandoff };
  const first = await service.inspectSealedHandoff(inspection);
  const second = await service.inspectSealedHandoff(inspection);
  assert.deepEqual(second, first);
  assert.equal(driver.calls.filter(([action]) => action === 'redeem').length, 0);

  const parts = handoff.sealedHandoff.split('.');
  parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith('a') ? 'b' : 'a'}`;
  await assert.rejects(
    service.inspectSealedHandoff({ sealedHandoff: parts.join('.') }),
    invitationDenied,
  );
  await assert.rejects(
    service.inspectSealedHandoff({
      sealedHandoff: handoff.sealedHandoff,
      invitationId: INVITATION_ID,
    }),
    invitationDenied,
  );

  const expired = harness({ clock: () => new Date(EXPIRES_AT) }).service;
  await assert.rejects(expired.inspectSealedHandoff(inspection), invitationDenied);
  assert.equal(driver.calls.filter(([action]) => action === 'redeem').length, 0);
});

test('concurrent redemption delegates a single atomic winner to durable state', async () => {
  const { service } = harness();
  const handoff = await service.exchangeInvitationToken({
    invitationId: INVITATION_ID,
    rawToken: RAW_TOKEN,
  });
  const request = {
    authenticatedSubject: 'wp:43',
    invitationId: INVITATION_ID,
    sealedHandoff: handoff.sealedHandoff,
  };
  const results = await Promise.allSettled([
    service.redeemSealedHandoff(request),
    service.redeemSealedHandoff(request),
  ]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = results.find(({ status }) => status === 'rejected');
  assert.equal(invitationDenied(rejected.reason), true);
});

test('every invitation-state denial is opaque and raw secrets never enter the error surface', async () => {
  const denials = [
    new InvitationDeniedError('TOKEN_MISMATCH'),
    new InvitationDeniedError('INVITATION_EXPIRED'),
    new InvitationDeniedError('INVITATION_REVOKED'),
    new InvitationDeniedError('INVITATION_ALREADY_USED'),
  ];
  for (const sourceError of denials) {
    const driver = durableDriver();
    driver.reserveFacultyCandidateAuthHandoffAtomic = async (command) => {
      driver.calls.push(['reserve', structuredClone(command)]);
      throw sourceError;
    };
    const { service } = harness({ driver });
    await assert.rejects(
      service.exchangeInvitationToken({ invitationId: INVITATION_ID, rawToken: RAW_TOKEN }),
      (error) => invitationDenied(error)
        && !JSON.stringify(error).includes(sourceError.details.reasonCode)
        && !JSON.stringify(error).includes(RAW_TOKEN),
    );
    assert.equal(JSON.stringify(driver.calls).includes(RAW_TOKEN), false);
  }
});

test('malformed, accessor, and extra-field exchange requests fail before key or database access', async () => {
  const { driver, keys, service } = harness();
  const accessor = { invitationId: INVITATION_ID };
  Object.defineProperty(accessor, 'rawToken', {
    enumerable: true,
    get() {
      throw new Error(RAW_TOKEN);
    },
  });
  const attempts = [
    null,
    {},
    { invitationId: INVITATION_ID, rawToken: 'short' },
    { invitationId: '../invite', rawToken: RAW_TOKEN },
    { invitationId: INVITATION_ID, rawToken: `${RAW_TOKEN.slice(0, -1)}+` },
    { invitationId: INVITATION_ID, rawToken: RAW_TOKEN, actorId: 'wp:43' },
    Object.assign(Object.create({ inherited: true }), {
      invitationId: INVITATION_ID,
      rawToken: RAW_TOKEN,
    }),
    accessor,
  ];
  for (const attempt of attempts) {
    await assert.rejects(
      service.exchangeInvitationToken(attempt),
      (error) => invitationDenied(error)
        && !String(error.message).includes(RAW_TOKEN)
        && !JSON.stringify(error).includes(RAW_TOKEN),
    );
  }
  assert.equal(driver.calls.length, 0);
  assert.equal(keys.calls.length, 0);
});

test('tampering, path mismatch, invalid subjects, expiry, and key rotation deny before redemption', async () => {
  let now = NOW;
  const { driver, service } = harness({ clock: () => now });
  const handoff = await service.exchangeInvitationToken({
    invitationId: INVITATION_ID,
    rawToken: RAW_TOKEN,
  });
  const parts = handoff.sealedHandoff.split('.');
  const tampered = [...parts];
  tampered[2] = `${tampered[2].slice(0, -1)}${tampered[2].endsWith('A') ? 'B' : 'A'}`;
  const attempts = [
    { authenticatedSubject: '43', invitationId: INVITATION_ID, sealedHandoff: handoff.sealedHandoff },
    { authenticatedSubject: 'wp:043', invitationId: INVITATION_ID, sealedHandoff: handoff.sealedHandoff },
    { authenticatedSubject: 'wp:43', invitationId: 'invite_other', sealedHandoff: handoff.sealedHandoff },
    { authenticatedSubject: 'wp:43', invitationId: INVITATION_ID, sealedHandoff: tampered.join('.') },
    { authenticatedSubject: 'wp:43', invitationId: INVITATION_ID, sealedHandoff: handoff.sealedHandoff, role: 'faculty' },
  ];
  for (const attempt of attempts) {
    await assert.rejects(service.redeemSealedHandoff(attempt), invitationDenied);
  }
  assert.equal(driver.calls.filter(([action]) => action === 'redeem').length, 0);

  now = new Date(EXPIRES_AT);
  await assert.rejects(
    service.redeemSealedHandoff({
      authenticatedSubject: 'wp:43',
      invitationId: INVITATION_ID,
      sealedHandoff: handoff.sealedHandoff,
    }),
    invitationDenied,
  );
  assert.equal(driver.calls.filter(([action]) => action === 'redeem').length, 0);

  const rotated = harness({ keys: keyProvider(Buffer.alloc(32, 0x74)) }).service;
  await assert.rejects(
    rotated.redeemSealedHandoff({
      authenticatedSubject: 'wp:43',
      invitationId: INVITATION_ID,
      sealedHandoff: handoff.sealedHandoff,
    }),
    invitationDenied,
  );
});

test('invalid database receipts and untrusted dependencies fail closed without a fallback', async () => {
  const malformedDriver = durableDriver();
  malformedDriver.reserveFacultyCandidateAuthHandoffAtomic = async (command) => ({
    schemaVersion: 'attacker.receipt',
    invitationId: command.invitationId,
  });
  await assert.rejects(
    harness({ driver: malformedDriver }).service.exchangeInvitationToken({
      invitationId: INVITATION_ID,
      rawToken: RAW_TOKEN,
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details?.status === 'CANDIDATE_HANDOFF_RESERVATION_RECEIPT_INVALID',
  );

  for (const override of [
    { driver: {} },
    { driver: { ...durableDriver(), databaseClock: false } },
    { keys: { serverOnly: false, async getKey() { return SECRET_KEY; } } },
    { keys: { serverOnly: true } },
  ]) {
    assert.throws(
      () => harness(override),
      (error) => error instanceof IntegrationDisabledError,
    );
  }
  assert.throws(
    () => new DurableFacultyCandidateAuthService({
      binding: targetBinding(),
      driver: durableDriver(),
      secretBinding: secretBinding(),
      keyProvider: keyProvider(),
      maximumLifetimeSeconds: 901,
    }),
    (error) => error instanceof IntegrationDisabledError
      && error.details?.status === 'HANDOFF_LIFETIME_INVALID',
  );
});

test('service authenticity and published contract preserve the durable-only boundary', () => {
  const { service } = harness();
  assert.equal(isAuthenticDurableFacultyCandidateAuthService(service), true);
  assert.equal(isAuthenticDurableFacultyCandidateAuthService({
    exchangeInvitationToken: service.exchangeInvitationToken,
    redeemSealedHandoff: service.redeemSealedHandoff,
  }), false);
  assert.equal(Object.isFrozen(service), true);
  assert.equal(Object.isFrozen(DurableFacultyCandidateAuthService.prototype), true);
  assert.deepEqual(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.driverMethods, [
    'reserveFacultyCandidateAuthHandoffAtomic',
    'redeemFacultyCandidateAuthHandoffAtomic',
  ]);
  assert.deepEqual(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.databaseFunctions, [
    'reserve_faculty_candidate_auth_handoff(text,text,text,integer)',
    'redeem_faculty_candidate_auth_handoff(text,text,text,text,timestamptz,timestamptz)',
  ]);
  assert.equal(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.freshnessAuthority, 'database_clock');
  assert.equal(
    DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.replayProtection,
    'atomic_database_reservation_and_single_redemption',
  );
  assert.equal(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.rawTokenInSealedPayload, false);
  assert.equal(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.rawTokenInDatabaseCommand, false);
  assert.equal(DURABLE_FACULTY_CANDIDATE_AUTH_CONTRACT.inMemoryProductionFallback, false);
});
