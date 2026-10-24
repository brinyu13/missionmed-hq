import { createHash, randomUUID } from 'node:crypto';

export const FOUNDER_TEST_NUMBER = 1;
export const FOUNDER_TEST_MAX_SECONDS = 45;
export const FOUNDER_TEST_PLAN = Object.freeze([
  Object.freeze({ testNo: 1, maxSeconds: 45 }),
  Object.freeze({ testNo: 2, maxSeconds: 45 }),
  Object.freeze({ testNo: 3, maxSeconds: 59 }),
]);
export const FOUNDER_TEST_AGENT_ID = 'agent_9bdfc50ec0086043';
export const FOUNDER_TEST_AVATAR_PARTICIPANT_ID = 'ivprep-3441r-lemonslice-avatar';
export const FOUNDER_TEST_PROFILE = 'PROFILE_B_OPENAI_NATIVE_AUDIO';
export const FOUNDER_TEST_VOICES = Object.freeze(new Set(['marin', 'coral', 'shimmer']));

const MAX_AUTHORIZATION_TTL_MS = 5 * 60 * 1000;

export function founderTestPlanFor(testNo) {
  return FOUNDER_TEST_PLAN.find((entry) => entry.testNo === Number(testNo)) || null;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function denied(code, status = 403) {
  return Object.freeze({ ok: false, status, code });
}

function exactId(value, label) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,160}$/u.test(id)) throw new TypeError(`${label} is invalid.`);
  return id;
}

function exactVoice(value) {
  const voice = String(value || '').trim();
  return FOUNDER_TEST_VOICES.has(voice) ? voice : null;
}

export class FounderPaidTestGate {
  constructor({
    now = () => Date.now(),
    idFactory = () => randomUUID(),
    authorizationTtlMs = MAX_AUTHORIZATION_TTL_MS,
    testPlan = [FOUNDER_TEST_PLAN[0]],
  } = {}) {
    const normalizedPlan = Array.isArray(testPlan)
      ? testPlan.map((entry) => founderTestPlanFor(entry?.testNo))
      : [];
    if (!normalizedPlan.length
      || normalizedPlan.some((entry, index) => !entry || entry.testNo !== index + 1)
      || new Set(normalizedPlan.map((entry) => entry.testNo)).size !== normalizedPlan.length) {
      throw new TypeError('Founder paid-test plan is invalid.');
    }
    this.now = now;
    this.idFactory = idFactory;
    this.authorizationTtlMs = Math.min(MAX_AUTHORIZATION_TTL_MS, Math.max(10_000, Math.trunc(authorizationTtlMs)));
    this.testPlan = Object.freeze([...normalizedPlan]);
    this.infrastructure = null;
    this.authorization = null;
    this.testIndex = 0;
    this.completedTests = [];
    this.terminal = null;
    this.killSwitch = false;
  }

  armInfrastructure(input = {}) {
    if (this.infrastructure || this.authorization || this.terminal) throw new Error('Founder proof infrastructure can be armed only once.');
    if (input.terminationArmed !== true
      || input.reconciliationArmed !== true
      || input.singleSessionEnforced !== true
      || input.zeroRetry !== true
      || input.zeroReconnect !== true
      || input.zeroRecreation !== true) {
      this.killSwitch = true;
      return denied('ivprep_provider_safety_unarmed', 503);
    }
    this.infrastructure = Object.freeze({
      terminationArmed: true,
      reconciliationArmed: true,
      singleSessionEnforced: true,
      zeroRetry: true,
      zeroReconnect: true,
      zeroRecreation: true,
    });
    return Object.freeze({ ok: true });
  }

  publicState({ admission } = {}) {
    const current = this.testPlan[this.testIndex] || null;
    return Object.freeze({
      enabled: admission?.ok === true
        && admission.entitlement?.founder === true
        && admission.entitlement?.video === true
        && Boolean(this.infrastructure)
        && !this.killSwitch
        && !this.terminal
        && Boolean(current),
      agentId: FOUNDER_TEST_AGENT_ID,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      profile: FOUNDER_TEST_PROFILE,
      testNo: current?.testNo || this.testPlan.at(-1).testNo,
      maximumSeconds: current?.maxSeconds || this.testPlan.at(-1).maxSeconds,
      remainingTests: Math.max(0, this.testPlan.length - this.testIndex),
      completedTests: Object.freeze(this.completedTests.map((entry) => Object.freeze({ ...entry }))),
      voices: Object.freeze([...FOUNDER_TEST_VOICES]),
      state: this.killSwitch ? 'FAILED_CLOSED' : (this.terminal ? 'TERMINAL' : (this.authorization?.consumedAtMs ? 'CONSUMED' : (this.authorization ? 'AUTHORIZED' : 'READY'))),
    });
  }

  issue({ admission, idempotencyKey, agentId, profile, voice, maxSeconds } = {}) {
    const current = this.testPlan[this.testIndex] || null;
    if (this.killSwitch || !this.infrastructure || this.terminal || !current) return denied('ivprep_paid_test_unavailable', 503);
    if (admission?.ok !== true || admission.entitlement?.founder !== true || admission.entitlement?.video !== true) {
      return denied('ivprep_founder_authorization_required');
    }
    let requestKey;
    try { requestKey = exactId(idempotencyKey, 'Authorization idempotency key'); }
    catch { return denied('ivprep_invalid_request', 400); }
    const selectedVoice = exactVoice(voice);
    if (agentId !== FOUNDER_TEST_AGENT_ID
      || profile !== FOUNDER_TEST_PROFILE
      || !selectedVoice
      || Number(maxSeconds) !== current.maxSeconds) {
      return denied('ivprep_paid_test_contract_mismatch');
    }
    const requestHash = hash({
      subject: admission.subject,
      cookieFingerprint: admission.cookieFingerprint,
      entitlementRevision: admission.entitlement.revision,
      agentId,
      profile,
      voice: selectedVoice,
      maxSeconds: current.maxSeconds,
      testNo: current.testNo,
    });
    if (this.authorization) {
      if (this.authorization.idempotencyKey === requestKey && this.authorization.requestHash === requestHash) {
        return Object.freeze({ ok: true, status: 200, authorization: this.#publicAuthorization(this.authorization) });
      }
      return denied('ivprep_paid_test_authorization_exists', 409);
    }
    const issuedAtMs = this.now();
    const authorization = {
      id: exactId(this.idFactory(), 'Authorization identifier'),
      idempotencyKey: requestKey,
      requestHash,
      subject: admission.subject,
      cookieFingerprint: admission.cookieFingerprint,
      entitlementRevision: admission.entitlement.revision,
      agentId: FOUNDER_TEST_AGENT_ID,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      profile: FOUNDER_TEST_PROFILE,
      voice: selectedVoice,
      maxSeconds: current.maxSeconds,
      testNo: current.testNo,
      issuedAtMs,
      expiresAtMs: issuedAtMs + this.authorizationTtlMs,
      consumedAtMs: null,
      interviewId: null,
      startIdempotencyKey: null,
    };
    this.authorization = authorization;
    return Object.freeze({ ok: true, status: 201, authorization: this.#publicAuthorization(authorization) });
  }

  consume({ admission, authorizationId, interviewId, idempotencyKey, agentId, profile, voice, maxSeconds } = {}) {
    if (this.killSwitch || !this.infrastructure || this.terminal) return denied('ivprep_paid_test_unavailable', 503);
    const authorization = this.authorization;
    if (!authorization) return denied('ivprep_paid_test_authorization_required');
    if (authorization.consumedAtMs != null) return denied('ivprep_paid_test_authorization_consumed', 409);
    if (authorization.expiresAtMs <= this.now()) {
      this.terminal = Object.freeze({ state: 'EXPIRED', atMs: this.now() });
      return denied('ivprep_paid_test_authorization_expired', 409);
    }
    if (admission?.ok !== true
      || admission.entitlement?.founder !== true
      || admission.entitlement?.video !== true
      || authorization.id !== authorizationId
      || authorization.subject !== admission.subject
      || authorization.cookieFingerprint !== admission.cookieFingerprint
      || authorization.entitlementRevision !== admission.entitlement.revision
      || authorization.agentId !== agentId
      || authorization.profile !== profile
      || authorization.voice !== exactVoice(voice)
      || authorization.maxSeconds !== Number(maxSeconds)) {
      return denied('ivprep_paid_test_contract_mismatch');
    }
    let interview;
    let startKey;
    try {
      interview = exactId(interviewId, 'Interview identifier');
      startKey = exactId(idempotencyKey, 'Start idempotency key');
    } catch {
      return denied('ivprep_invalid_request', 400);
    }
    authorization.consumedAtMs = this.now();
    authorization.interviewId = interview;
    authorization.startIdempotencyKey = startKey;
    const receipt = Object.freeze({
      authorized: true,
      consumed: true,
      authorizationId: authorization.id,
      authorizationBinding: hash({
        requestHash: authorization.requestHash,
        interviewId: interview,
        idempotencyKey: startKey,
        consumedAtMs: authorization.consumedAtMs,
      }),
      subject: authorization.subject,
      cookieFingerprint: authorization.cookieFingerprint,
      entitlementRevision: authorization.entitlementRevision,
      interviewId: interview,
      idempotencyKey: startKey,
      agentId: authorization.agentId,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      profile: authorization.profile,
      voice: authorization.voice,
      maxSeconds: authorization.maxSeconds,
      testNo: authorization.testNo,
      terminationArmed: this.infrastructure.terminationArmed,
      reconciliationArmed: this.infrastructure.reconciliationArmed,
      zeroRetry: this.infrastructure.zeroRetry,
      zeroReconnect: this.infrastructure.zeroReconnect,
      zeroRecreation: this.infrastructure.zeroRecreation,
    });
    return Object.freeze({ ok: true, status: 200, receipt });
  }

  finish({ authorizationId, providerCreateAttempted, terminationConfirmed, reconciliationConfirmed, reason = 'terminal' } = {}) {
    if (!this.authorization?.consumedAtMs || this.authorization.id !== authorizationId || this.terminal) {
      this.killSwitch = true;
      return denied('ivprep_paid_test_terminal_mismatch', 503);
    }
    const safe = terminationConfirmed === true && reconciliationConfirmed === true;
    if (!safe) this.killSwitch = true;
    const evidence = Object.freeze({
      state: safe ? 'CLOSED' : 'FAILED_CLOSED',
      atMs: this.now(),
      testNo: this.authorization.testNo,
      maxSeconds: this.authorization.maxSeconds,
      providerCreateAttempted: providerCreateAttempted === true,
      terminationConfirmed: terminationConfirmed === true,
      reconciliationConfirmed: reconciliationConfirmed === true,
      reason: String(reason || 'terminal').slice(0, 40),
    });
    if (!safe) {
      this.terminal = evidence;
      return Object.freeze({ ok: false, state: this.terminal.state });
    }
    this.completedTests.push(evidence);
    if (this.testIndex < this.testPlan.length - 1) {
      this.testIndex += 1;
      this.authorization = null;
      return Object.freeze({ ok: true, state: 'READY', nextTestNo: this.testPlan[this.testIndex].testNo });
    }
    this.testIndex = this.testPlan.length;
    this.terminal = evidence;
    return Object.freeze({ ok: true, state: this.terminal.state });
  }

  failClosed(reason = 'safety_uncertain') {
    this.killSwitch = true;
    if (!this.terminal) this.terminal = Object.freeze({ state: 'FAILED_CLOSED', atMs: this.now(), reason: String(reason).slice(0, 40) });
  }

  #publicAuthorization(authorization) {
    return Object.freeze({
      id: authorization.id,
      agentId: authorization.agentId,
      profile: authorization.profile,
      voice: authorization.voice,
      maxSeconds: authorization.maxSeconds,
      testNo: authorization.testNo,
      expiresAt: new Date(authorization.expiresAtMs).toISOString(),
      consumed: authorization.consumedAtMs != null,
    });
  }
}
