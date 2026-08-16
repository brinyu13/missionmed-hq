import { createHash, randomUUID } from 'node:crypto';

import { installAdmissionRegistry, InMemoryAdmissionRegistry } from '../admission-registry.mjs';
import {
  FounderPaidTestGate,
  FOUNDER_TEST_AGENT_ID,
  FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
  FOUNDER_TEST_PLAN,
  founderTestPlanFor,
} from '../founder-paid-test-gate.mjs';
import { createLiveKitSessionCoordinator } from './livekit-session-coordinator.mjs';
import { PROFILE_B, PROFILE_B_AGENT_NAME, ProviderSessionController } from './provider-session-controller.mjs';

const PRODUCT_PROJECT_REF = 'tufzqxeucfugdovtjyqk';
const PRODUCT_URL = `https://${PRODUCT_PROJECT_REF}.supabase.co`;
const TERMINAL_STATES = new Set(['CLOSED', 'FAILED_CLOSED']);
const SAFE_VOICES = new Set(['marin', 'coral', 'shimmer']);
const TABLES = new Set([
  'ivprep_cookie_revocations',
  'ivprep_entitlements',
  'ivprep_interview_bindings',
  'ivprep_provider_control',
  'ivprep_provider_reservations',
]);
const RPCS = new Set([
  'ivprep_bind_provider_dispatch',
  'ivprep_claim_provider_job',
  'ivprep_mark_provider_media_ready',
  'ivprep_mark_provider_worker_joined',
  'ivprep_observe_provider_termination',
  'ivprep_reconcile_provider_job',
  'ivprep_refund_provider_before_job',
  'ivprep_request_provider_termination',
  'ivprep_reserve_provider_test',
  'ivprep_trip_provider_kill_switch',
]);

function exactProjectUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.origin === PRODUCT_URL && url.pathname === '/' && !url.search && !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function exactHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function exactSubject(value) {
  const subject = String(value || '').trim();
  return /^wp:[1-9][0-9]{0,19}$/u.test(subject) ? subject : null;
}

function exactId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{1,120}$/u.test(id) ? id : null;
}

function exactHash(value) {
  const hash = String(value || '').trim();
  return /^[a-f0-9]{64}$/u.test(hash) ? hash : null;
}

function exactCsvSubjects(value) {
  const subjects = new Set();
  for (const token of String(value || '').split(',')) {
    const normalized = token.trim();
    if (!normalized) continue;
    const subject = normalized.startsWith('wp:') ? normalized : `wp:${normalized}`;
    if (!exactSubject(subject)) throw new Error('IV Prep canary subject allowlist is invalid.');
    subjects.add(subject);
  }
  return subjects;
}

function boundedReason(value, fallback = 'hosted_runtime') {
  const reason = String(value || fallback).toLowerCase().replace(/[^a-z0-9_]/gu, '_').slice(0, 40);
  return /^[a-z0-9_]{1,40}$/u.test(reason) ? reason : fallback;
}

function logMilestone(code, detail = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(detail)) {
    if (['reservationId', 'dispatchId', 'state', 'reason', 'workerRegistered'].includes(key)) safe[key] = value;
  }
  console.info(JSON.stringify({ subsystem: 'ivprep_3472a', milestone: code, ...safe }));
}

export class IvPrepSupabaseRest {
  constructor({ url, serviceRoleKey, fetchImpl = fetch, timeoutMs = 4_000 } = {}) {
    this.url = exactProjectUrl(url);
    this.key = String(serviceRoleKey || '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = Math.max(500, Math.min(5_000, Number(timeoutMs) || 0));
    if (!this.url || this.key.length < 24 || typeof this.fetchImpl !== 'function') {
      throw new Error('The exact IV Prep Supabase server binding is unavailable.');
    }
  }

  async request(path, { method = 'GET', body = null, prefer = null } = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.includes('://')) {
      throw new Error('IV Prep database request path is invalid.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('ivprep_database_timeout'), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.url}/rest/v1${path}`, {
        method,
        redirect: 'error',
        cache: 'no-store',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(prefer ? { Prefer: prefer } : {}),
        },
        body: body == null ? null : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok || text.length > 64 * 1024) throw new Error('IV Prep database operation failed closed.');
      if (!text) return null;
      const value = JSON.parse(text);
      if (value == null) throw new Error('IV Prep database response is invalid.');
      return value;
    } catch {
      throw new Error('IV Prep database operation failed closed.');
    } finally {
      clearTimeout(timer);
    }
  }

  table(name, query = '', options = {}) {
    if (!TABLES.has(name) || (query && !query.startsWith('?'))) throw new Error('IV Prep table operation is not approved.');
    return this.request(`/${name}${query}`, options);
  }

  rpc(name, input) {
    if (!RPCS.has(name)) throw new Error('IV Prep RPC operation is not approved.');
    return this.request(`/rpc/${name}`, { method: 'POST', body: input });
  }
}

export class SupabaseAdmissionRegistry extends InMemoryAdmissionRegistry {
  constructor({ rest, founderSubjects, adminSubjects, videoEnabled = false, now = () => Date.now() } = {}) {
    super({ now });
    this.rest = rest;
    this.founderSubjects = founderSubjects;
    this.adminSubjects = adminSubjects;
    this.videoEnabled = videoEnabled === true;
  }

  async bootstrapEntitlements() {
    const expiresAt = new Date(this.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const subject of new Set([...this.founderSubjects, ...this.adminSubjects])) {
      const founder = this.founderSubjects.has(subject);
      const existing = await this.rest.table(
        'ivprep_entitlements',
        `?subject=eq.${encodeURIComponent(subject)}&select=subject,granted_video_seconds&limit=1`,
      );
      const common = {
        revision: 'hosted-3472a-v1',
        founder,
        voice_enabled: true,
        video_enabled: this.videoEnabled,
        expires_at: expiresAt,
        updated_at: new Date(this.now()).toISOString(),
      };
      if (Array.isArray(existing) && existing[0]?.subject === subject) {
        await this.rest.table('ivprep_entitlements', `?subject=eq.${encodeURIComponent(subject)}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: {
            ...common,
            ...(founder ? {
              granted_video_seconds: Math.max(
                Number(existing[0].granted_video_seconds) || 0,
                FOUNDER_TEST_PLAN.reduce((total, entry) => total + entry.maxSeconds, 0),
              ),
            } : {}),
          },
        });
      } else {
        await this.rest.table('ivprep_entitlements', '', {
          method: 'POST',
          prefer: 'return=minimal',
          body: {
            subject,
            ...common,
            granted_video_seconds: founder
              ? FOUNDER_TEST_PLAN.reduce((total, entry) => total + entry.maxSeconds, 0)
              : 0,
            consumed_video_seconds: 0,
            reserved_video_seconds: 0,
          },
        });
      }
    }
  }

  async refreshSubject({ hqSession, cookieFingerprint } = {}) {
    const subject = exactSubject(`wp:${Number(hqSession?.user?.id)}`);
    if (!subject || (!this.founderSubjects.has(subject) && !this.adminSubjects.has(subject))) {
      if (subject) this.revokeEntitlement(subject);
      return false;
    }
    if (!exactHash(cookieFingerprint)) return false;
    const revoked = await this.rest.table(
      'ivprep_cookie_revocations',
      `?cookie_fingerprint=eq.${encodeURIComponent(cookieFingerprint)}&expires_at=gt.${encodeURIComponent(new Date(this.now()).toISOString())}&select=cookie_fingerprint&limit=1`,
    );
    if (Array.isArray(revoked) && revoked.length) {
      super.recordLogout({ cookieFingerprint, reason: 'durable_revocation' });
      return false;
    }
    const rows = await this.rest.table(
      'ivprep_entitlements',
      `?subject=eq.${encodeURIComponent(subject)}&select=subject,revision,founder,voice_enabled,video_enabled,granted_video_seconds,expires_at&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const expiresAtMs = Date.parse(String(row?.expires_at || ''));
    if (row?.subject !== subject || !Number.isFinite(expiresAtMs) || expiresAtMs <= this.now() || row.voice_enabled !== true) {
      this.revokeEntitlement(subject);
      return false;
    }
    this.grantSyntheticEntitlement({
      subject,
      revision: row.revision,
      expiresAtMs,
      founder: row.founder === true && this.founderSubjects.has(subject),
      voice: true,
      video: row.video_enabled === true && this.videoEnabled,
      grantedVideoSeconds: Number(row.granted_video_seconds) || 0,
    });
    return true;
  }

  async bindInterview(input) {
    const binding = super.bindInterview(input);
    await this.rest.table('ivprep_interview_bindings', '?on_conflict=interview_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        interview_id: binding.interviewId,
        subject: binding.subject,
        cookie_fingerprint: binding.cookieFingerprint,
        entitlement_revision: binding.entitlementRevision,
        termination_requested: false,
        termination_reason: null,
        updated_at: new Date(this.now()).toISOString(),
      },
    });
    return binding;
  }

  recordLogout(input = {}) {
    const result = super.recordLogout(input);
    if (!result.recorded) return result;
    const fingerprint = String(input.cookieFingerprint || '');
    void (async () => {
      try {
        await this.rest.table('ivprep_cookie_revocations', '?on_conflict=cookie_fingerprint', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: {
            cookie_fingerprint: fingerprint,
            reason: boundedReason(input.reason, 'hq_logout'),
            expires_at: new Date(this.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        });
        await this.rest.table(
          'ivprep_interview_bindings',
          `?cookie_fingerprint=eq.${encodeURIComponent(fingerprint)}&termination_requested=is.false`,
          {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: { termination_requested: true, termination_reason: 'hq_logout', updated_at: new Date(this.now()).toISOString() },
          },
        );
      } catch {
        this.enterFailClosed();
        console.error('IVPREP_DURABLE_LOGOUT_FAILED_CLOSED');
      }
    })();
    return result;
  }
}

export class SupabaseVideoEntitlementStore {
  constructor({ rest } = {}) {
    this.rest = rest;
    this.reservations = new Map();
  }

  async reserve({ subject, interviewId, requestedSeconds, idempotencyKey, testNo, entitlementRevision } = {}) {
    const reservationId = `ivpr-${randomUUID()}`;
    const nonce = createHash('sha256')
      .update('missionmed.ivprep.reservation.v1\0')
      .update(reservationId).update('\0').update(String(idempotencyKey || ''))
      .digest('hex');
    const participantIdentity = `ivp-${nonce.slice(0, 48)}`;
    const rows = await this.rest.rpc('ivprep_reserve_provider_test', {
      p_reservation_id: reservationId,
      p_interview_id: interviewId,
      p_subject: subject,
      p_entitlement_revision: entitlementRevision,
      p_test_number: testNo,
      p_reserved_seconds: requestedSeconds,
      p_reservation_nonce: nonce,
      p_participant_identity: participantIdentity,
      p_profile: PROFILE_B,
      p_agent_name: PROFILE_B_AGENT_NAME,
    });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row?.reservation_id !== reservationId || row?.reservation_nonce !== nonce
      || row?.participant_identity !== participantIdentity || Number(row?.reserved_seconds) !== requestedSeconds) {
      return Object.freeze({ ok: false, status: 503, code: 'ivprep_unavailable' });
    }
    const reservation = Object.freeze({
      id: reservationId,
      subject,
      interviewId,
      reservedSeconds: requestedSeconds,
      state: row.reservation_state,
    });
    this.reservations.set(reservationId, { reservation, nonce });
    logMilestone('reservation_created', { reservationId, state: row.reservation_state });
    return Object.freeze({ ok: true, status: 201, reservation, reservationNonce: nonce, participantIdentity });
  }

  async refundBeforeProviderStart(reservationId, { dispatchDeleted = false } = {}) {
    const record = this.reservations.get(String(reservationId || ''));
    if (!record) throw new Error('Durable reservation binding is unavailable.');
    const result = await this.rest.rpc('ivprep_refund_provider_before_job', {
      p_reservation_id: record.reservation.id,
      p_reservation_nonce: record.nonce,
      p_subject: record.reservation.subject,
      p_dispatch_deleted: dispatchDeleted === true,
    });
    if (result !== true) throw new Error('Durable pre-job refund failed closed.');
    return Object.freeze({ state: 'CLOSED' });
  }

  async bindProvider() {
    return Object.freeze({ state: 'DURABLE_WORKER_BOUND' });
  }

  async reconcile() {
    return Object.freeze({ state: 'DURABLE_WORKER_RECONCILED' });
  }
}

async function readReservation(rest, reservationNonce) {
  const rows = await rest.table(
    'ivprep_provider_reservations',
    `?reservation_nonce=eq.${encodeURIComponent(reservationNonce)}&select=reservation_id,subject,state,test_number,reserved_seconds,room_name,dispatch_id,livekit_job_id,participant_identity,provider_create_attempted,provider_session_hash,termination_requested,termination_reason,termination_accepted,provider_terminal_status,provider_native_cost,cost_evidence,local_elapsed_ms,unknown_remote_create,cleanup_failure_codes,worker_joined_at,media_ready_at&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function waitForReservation(rest, reservationNonce, predicate, { timeoutMs = 20_000, signal = null } = {}) {
  const started = Date.now();
  while (!signal?.aborted && Date.now() - started < timeoutMs) {
    const row = await readReservation(rest, reservationNonce);
    if (row && predicate(row)) return row;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 250);
      signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Durable observation aborted.')); }, { once: true });
    });
  }
  throw new Error('Durable provider observation timed out.');
}

export function createSupabaseHqWorkerAdapter({ rest, healthUrl, fetchImpl = fetch } = {}) {
  const exactHealth = exactHttpsUrl(healthUrl);
  if (!exactHealth) throw new Error('The exact hosted worker health URL is unavailable.');
  return Object.freeze({
    async assertReady() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      try {
        const response = await fetchImpl(exactHealth, { redirect: 'error', cache: 'no-store', signal: controller.signal });
        const text = await response.text();
        if (text.length > 4_096) return Object.freeze({ ok: false });
        const value = JSON.parse(text);
        const shape = value && typeof value === 'object' && !Array.isArray(value)
          && Object.keys(value).sort().join(',') === 'agent,ok,profile,providerSessionsCreated,workerRegistered';
        return Object.freeze({
          ok: response.ok && shape && value.ok === true && value.workerRegistered === true
            && value.profile === PROFILE_B && value.agent === FOUNDER_TEST_AGENT_ID
            && Number(value.providerSessionsCreated) === 0,
        });
      } catch {
        return Object.freeze({ ok: false });
      } finally {
        clearTimeout(timer);
      }
    },
    async armJob(input) {
      const plan = founderTestPlanFor(input.testNo);
      return Object.freeze({
        ok: Boolean(exactId(input.reservationId) && exactHash(input.reservationNonce)
          && exactId(input.roomName) && exactId(input.participantIdentity)
          && input.avatarParticipantIdentity === FOUNDER_TEST_AVATAR_PARTICIPANT_ID
          && input.agentName === PROFILE_B_AGENT_NAME && input.profile === PROFILE_B
          && SAFE_VOICES.has(input.voice) && plan?.maxSeconds === Number(input.maxSeconds)),
      });
    },
    async bindDispatch(input) {
      const ok = await rest.rpc('ivprep_bind_provider_dispatch', {
        p_reservation_nonce: input.reservationNonce,
        p_dispatch_id: input.dispatchId,
        p_room_name: input.roomName,
        p_agent_name: PROFILE_B_AGENT_NAME,
      });
      logMilestone('dispatch_bound', { reservationId: input.reservationId, dispatchId: input.dispatchId });
      return Object.freeze({ ok: ok === true });
    },
    async recordBrowserMediaReady(input) {
      const row = await readReservation(rest, input.reservationNonce);
      if (!row?.livekit_job_id) return Object.freeze({ accepted: false });
      const accepted = await rest.rpc('ivprep_mark_provider_media_ready', {
        p_reservation_id: input.reservationId,
        p_subject: input.subject,
        p_cookie_fingerprint: input.cookieFingerprint,
        p_entitlement_revision: input.entitlementRevision,
        p_job_id: row.livekit_job_id,
        p_dispatch_id: input.dispatchId,
        p_browser_video_decoded: input.videoDecoded === true,
        p_browser_audio_playable: input.audioPlayable === true,
        p_audio_authority: input.audioAuthority,
      });
      if (accepted === true) logMilestone('browser_media_ready', { reservationId: input.reservationId });
      return Object.freeze({ accepted: accepted === true });
    },
    async awaitMediaReady(input) {
      const row = await waitForReservation(rest, input.reservationNonce, (value) => value.state === 'MEDIA_READY');
      return Object.freeze({
        roomName: row.room_name,
        dispatchId: row.dispatch_id,
        reservationNonce: input.reservationNonce,
        participantIdentity: row.participant_identity,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        agentJoined: true,
        avatarCreateObserved: row.provider_create_attempted === true,
        avatarJoined: Boolean(row.worker_joined_at),
        agentSessionStarted: Boolean(row.worker_joined_at),
        browserVideoDecoded: true,
        browserAudioPlayable: true,
        audioAuthority: 'avatar-livekit',
        mediaReady: true,
        providerSessionHash: row.provider_session_hash,
      });
    },
    async requestStop(input) {
      const row = await readReservation(rest, input.reservationNonce);
      if (['RESERVED', 'DISPATCHED'].includes(row?.state) && !row?.livekit_job_id) {
        return Object.freeze({ accepted: false, preJob: true });
      }
      const accepted = await rest.rpc('ivprep_request_provider_termination', {
        p_reservation_id: input.reservationId,
        p_reservation_nonce: input.reservationNonce,
        p_reason: boundedReason(input.reason, 'hq_stop'),
      });
      return Object.freeze({ accepted: accepted === true, preJob: false });
    },
    async awaitReconciliation(input) {
      const row = await waitForReservation(rest, input.reservationNonce, (value) => TERMINAL_STATES.has(value.state));
      return Object.freeze({
        roomName: row.room_name,
        dispatchId: row.dispatch_id,
        reservationNonce: input.reservationNonce,
        participantIdentity: row.participant_identity,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        providerCreateAttempted: row.provider_create_attempted === true,
        providerSessionHash: row.provider_session_hash,
        terminationConfirmed: row.state === 'CLOSED' && row.termination_accepted === true,
        reconciled: row.state === 'CLOSED',
        providerStatus: row.provider_terminal_status ? {
          terminal: row.provider_terminal_status === 'COMPLETED',
          status: row.provider_terminal_status,
          nativeCost: row.provider_native_cost == null ? null : Number(row.provider_native_cost),
          costEvidence: row.cost_evidence,
        } : null,
        localElapsedSeconds: Math.max(0, Number(row.local_elapsed_ms) || 0) / 1000,
        cleanupFailures: Array.isArray(row.cleanup_failure_codes) ? row.cleanup_failure_codes : [],
      });
    },
    close: async () => {},
  });
}

export function createSupabaseWorkerGate({ rest, voice } = {}) {
  if (!SAFE_VOICES.has(voice)) throw new Error('The hosted Realtime voice is invalid.');
  return Object.freeze({
    async claimJob(input) {
      const rows = await rest.rpc('ivprep_claim_provider_job', {
        p_reservation_nonce: input.reservationNonce,
        p_job_id: input.jobId,
        p_dispatch_id: input.dispatchId,
        p_room_name: input.roomName,
        p_agent_name: input.agentName,
      });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return Object.freeze({ ok: false });
      const reservation = await readReservation(rest, input.reservationNonce);
      const plan = founderTestPlanFor(reservation?.test_number);
      if (!reservation
        || reservation.reservation_id !== row.reservation_id
        || plan?.maxSeconds !== Number(reservation.reserved_seconds)) {
        return Object.freeze({ ok: false });
      }
      logMilestone('worker_job_claimed', { reservationId: row.reservation_id, dispatchId: row.dispatch_id });
      return Object.freeze({
        ok: true,
        reconciliationReady: true,
        reservationId: row.reservation_id,
        participantIdentity: row.participant_identity,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        reservationNonce: row.reservation_nonce,
        dispatchId: row.dispatch_id,
        roomName: row.room_name,
        agentName: row.agent_name,
        profile: PROFILE_B,
        voice,
        testNo: plan.testNo,
        maxSeconds: plan.maxSeconds,
      });
    },
    async waitForTermination(input) {
      while (!input.signal?.aborted) {
        const rows = await rest.rpc('ivprep_observe_provider_termination', {
          p_reservation_id: input.reservationId,
          p_reservation_nonce: input.reservationNonce,
          p_job_id: input.jobId,
          p_dispatch_id: input.dispatchId,
        });
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) throw new Error('Durable termination observation failed closed.');
        if (row.requested === true) return Object.freeze({ ok: true, requested: true, reason: row.reason });
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 250);
          input.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Durable termination observation aborted.')); }, { once: true });
        });
      }
      throw new Error('Durable termination observation aborted.');
    },
    async markWorkerJoined(input) {
      const ok = await rest.rpc('ivprep_mark_provider_worker_joined', {
        p_reservation_id: input.reservationId,
        p_reservation_nonce: input.reservationNonce,
        p_job_id: input.jobId,
        p_dispatch_id: input.dispatchId,
        p_room_name: input.roomName,
        p_provider_session_hash: input.providerSessionHash,
      });
      if (ok === true) logMilestone('provider_worker_joined', { reservationId: input.reservationId });
      return Object.freeze({ ok: ok === true });
    },
    async reconcileJob(input) {
      const status = String(input.providerStatus?.status || 'UNRESOLVED').toUpperCase();
      const reservation = await readReservation(rest, input.reservationNonce);
      const plan = founderTestPlanFor(reservation?.test_number);
      if (!plan || plan.maxSeconds !== Number(reservation?.reserved_seconds)) {
        throw new Error('Durable Founder test plan evidence is unavailable.');
      }
      const ok = await rest.rpc('ivprep_reconcile_provider_job', {
        p_reservation_id: input.reservationId,
        p_reservation_nonce: input.reservationNonce,
        p_job_id: input.jobId,
        p_dispatch_id: input.dispatchId,
        p_provider_create_attempted: input.providerCreateAttempted === true,
        p_provider_session_hash: input.providerSessionHash || null,
        p_termination_accepted: input.terminationAccepted === true,
        p_provider_terminal_status: ['COMPLETED', 'TIMED_OUT', 'FAILED'].includes(status) ? status : 'UNRESOLVED',
        p_provider_native_cost: Number.isFinite(Number(input.cost?.providerNativeCost)) ? Number(input.cost.providerNativeCost) : null,
        p_cost_evidence: input.cost?.costEvidence || 'UNRESOLVED',
        p_local_elapsed_ms: Math.round(Math.max(0, Math.min(plan.maxSeconds, Number(input.cost?.localElapsedSeconds) || 0)) * 1000),
        p_unknown_remote_create: input.unknownRemoteCreate === true,
        p_cleanup_failure_codes: Array.isArray(input.cleanupFailures) ? input.cleanupFailures.slice(0, 8) : [],
      });
      logMilestone(ok === true ? 'provider_reconciled' : 'provider_reconciliation_failed_closed', { reservationId: input.reservationId });
      return Object.freeze({ ok: ok === true });
    },
  });
}

export function createSupabaseWorkerGateFromEnvironment(environment = process.env) {
  if (environment.IVPREP_HOSTED_RUNTIME !== 'true') return null;
  const rest = new IvPrepSupabaseRest({
    url: environment.IVPREP_SUPABASE_URL,
    serviceRoleKey: environment.IVPREP_SUPABASE_SERVICE_ROLE_KEY,
  });
  return createSupabaseWorkerGate({ rest, voice: environment.IVPREP_REALTIME_VOICE });
}

export async function createHostedHqDependenciesFromEnvironment(environment = process.env) {
  if (environment.IVPREP_HOSTED_RUNTIME !== 'true') return null;
  const videoEnabled = environment.IVPREP_VIDEO_ENABLED === 'true';
  const paidEnabled = environment.IVPREP_PAID_TEST1_ENABLED === 'true';
  const founderSubjects = exactCsvSubjects(environment.IVPREP_FOUNDER_WP_USER_IDS);
  const adminSubjects = exactCsvSubjects(environment.IVPREP_ADMIN_WP_USER_IDS);
  if (!founderSubjects.size || (paidEnabled && !videoEnabled)) {
    throw new Error('The exact IV Prep hosted admission policy is unavailable.');
  }
  const rest = new IvPrepSupabaseRest({
    url: environment.IVPREP_SUPABASE_URL,
    serviceRoleKey: environment.IVPREP_SUPABASE_SERVICE_ROLE_KEY,
  });
  const registry = new SupabaseAdmissionRegistry({ rest, founderSubjects, adminSubjects, videoEnabled });
  await registry.bootstrapEntitlements();
  installAdmissionRegistry(registry);
  const worker = createSupabaseHqWorkerAdapter({ rest, healthUrl: environment.IVPREP_WORKER_HEALTH_URL });
  const runtimeState = async () => {
    const readiness = await worker.assertReady();
    return Object.freeze({
      mode: 'hosted',
      workerRegistrationState: readiness.ok ? 'READY' : 'UNAVAILABLE',
      providerSessionsCreatedAtReadiness: 0,
      paidProviderCreationEnabled: paidEnabled,
    });
  };
  if (!paidEnabled) {
    return Object.freeze({
      registry,
      flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: false }),
      paidTestGate: null,
      providerControllerFactory: null,
      liveKitSignalOrigin: null,
      runtimeState,
    });
  }
  const livekit = await createLiveKitSessionCoordinator({
    url: environment.LIVEKIT_URL,
    apiKey: environment.LIVEKIT_API_KEY,
    apiSecret: environment.LIVEKIT_API_SECRET,
  });
  const paidTestGate = new FounderPaidTestGate({ testPlan: FOUNDER_TEST_PLAN });
  const armed = paidTestGate.armInfrastructure({
    terminationArmed: true,
    reconciliationArmed: true,
    singleSessionEnforced: true,
    zeroRetry: true,
    zeroReconnect: true,
    zeroRecreation: true,
  });
  if (!armed.ok) throw new Error('Hosted paid-test infrastructure failed closed.');
  const entitlementStore = new SupabaseVideoEntitlementStore({ rest });
  const providerControllerFactory = ({ paidTestAuthorization }) => new ProviderSessionController({
    entitlementStore,
    room: livekit.room,
    participant: livekit.participant,
    dispatch: livekit.dispatch,
    worker,
    maxSeconds: paidTestAuthorization.maxSeconds,
    testPlan: FOUNDER_TEST_PLAN,
    onTerminal: (evidence) => paidTestGate.finish(evidence),
  });
  return Object.freeze({
    registry,
    flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: true }),
    paidTestGate,
    providerControllerFactory,
    liveKitSignalOrigin: livekit.signalOrigin,
    runtimeState,
  });
}

export const IVPREP_PRODUCT_PROJECT_REF = PRODUCT_PROJECT_REF;
