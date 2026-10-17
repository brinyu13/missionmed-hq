import { createHash } from 'node:crypto';

const permits = new WeakSet();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA = /^[0-9a-f]{64}$/u;
export const NATIVE_VOICE_MODEL = 'gpt-live-1';
export function nativeVoiceDenied() {
  return Object.assign(new Error('Native Voice requires a funded, verified server authorization.'), { code: 'ivoc_native_voice_authorization_required' });
}
export function trustedNativeVoiceAdmin(hqSession, subject) {
  return subject === 'wp:1' && hqSession?.user?.id === 1 && Array.isArray(hqSession.user.roles)
    && hqSession.user.roles.some(role => ['administrator', 'admin'].includes(String(role).toLowerCase()));
}
export function nativeCredentialFingerprint(key) {
  return createHash('sha256').update(String(key || '')).digest('hex');
}
export function consumeNativeCreatePermit(permit, credentialFingerprint, now = Date.now()) {
  if (!permit || !permits.has(permit)) throw nativeVoiceDenied();
  // Consume synchronously, including a later expiry/binding rejection. Never reusable.
  permits.delete(permit);
  if (permit.model !== NATIVE_VOICE_MODEL || permit.credentialFingerprint !== credentialFingerprint
    || now >= permit.deadlineMs || now >= permit.startupDeadlineMs) throw nativeVoiceDenied();
  return permit;
}
function identity(binding) {
  if (binding?.ownerSubject !== 'wp:1' || binding?.administrator !== true || !UUID.test(binding.ivocSessionId || '')
    || !SHA.test(binding.cookieFingerprint || '') || !SHA.test(binding.requestHash || '')
    || typeof binding.entitlementRevision !== 'string' || !binding.entitlementRevision
    || !SHA.test(binding.credentialFingerprint || '')) throw nativeVoiceDenied();
  return Object.freeze({ ...binding, model: NATIVE_VOICE_MODEL });
}
function receipt(value, binding, now) {
  if (!value || value.ok !== true || !UUID.test(value.reservation_id || '') || !UUID.test(value.generation || '')
    || value.owner_subject !== binding.ownerSubject || value.session_id !== binding.ivocSessionId
    || value.model !== NATIVE_VOICE_MODEL || value.credential_fingerprint !== binding.credentialFingerprint
    || !SHA.test(value.account_fingerprint || '') || value.hard_ceiling_verified !== true
    || !Number.isSafeInteger(value.cleanup_ms) || value.cleanup_ms < 1 || value.cleanup_ms > 60000
    || !Number.isSafeInteger(value.presence_ms) || value.presence_ms < 1
    || !Number.isSafeInteger(value.heartbeat_ms) || value.heartbeat_ms < 1 || value.heartbeat_ms * 2 > value.presence_ms) throw nativeVoiceDenied();
  const deadlineMs = Date.parse(value.deadline_at), startupDeadlineMs = Date.parse(value.startup_deadline_at);
  const presenceExpiresMs = Date.parse(value.presence_expires_at);
  if (![deadlineMs, startupDeadlineMs, presenceExpiresMs].every(Number.isFinite)
    || deadlineMs <= now || startupDeadlineMs <= now || presenceExpiresMs <= now || startupDeadlineMs > deadlineMs || presenceExpiresMs > deadlineMs) throw nativeVoiceDenied();
  return Object.freeze({ ...value, deadlineMs, startupDeadlineMs, presenceExpiresMs });
}

// No process environment switch or default allowance can arm this policy.
// All authorization is read from the private durable ledger; missing RPC/schema
// or an unarmed/stale grant denies before provider I/O. No caller can mint permits.
export function createNativeVoiceSpendPolicy({ store, now = () => Date.now() } = {}) {
  if (!store) throw new TypeError('Native Voice durable admission is unavailable.');
  const owned = new WeakMap();
  const check = reservation => { const binding = owned.get(reservation); if (!binding) throw nativeVoiceDenied(); return binding; };
  const quarantine = async (reservation, reason) => store.quarantine({ reservationId: reservation.reservation_id,
    ownerSubject: check(reservation).ownerSubject, reason });
  return Object.freeze({
    async reserve(input) {
      const binding = identity(input);
      const value = await store.reserve(binding);
      const reserved = receipt(value, binding, now());
      owned.set(reserved, binding);
      return reserved;
    },
    async claim(reservation, currentBinding) {
      const binding = check(reservation); const fresh = identity(currentBinding);
      if (JSON.stringify(fresh) !== JSON.stringify(binding)) throw nativeVoiceDenied();
      const claimed = await store.claimCreate({ reservationId: reservation.reservation_id, ...binding });
      if (claimed?.ok !== true || claimed.claimed !== true || claimed.reservation_id !== reservation.reservation_id
        || now() >= reservation.deadlineMs || now() >= reservation.startupDeadlineMs) throw nativeVoiceDenied();
      const permit = Object.freeze({ reservationId: reservation.reservation_id, model: NATIVE_VOICE_MODEL,
        credentialFingerprint: binding.credentialFingerprint, deadlineMs: reservation.deadlineMs,
        startupDeadlineMs: reservation.startupDeadlineMs });
      permits.add(permit);
      return permit;
    },
    async bind(reservation, providerSessionId) {
      check(reservation);
      const result = await store.bindProvider({ reservationId: reservation.reservation_id, providerSessionId });
      if (result?.ok !== true) throw nativeVoiceDenied();
      return result;
    },
    async presence(reservation, { generation, sequence }) {
      const binding = check(reservation);
      const value = await store.heartbeat({ reservationId: reservation.reservation_id, ownerSubject: binding.ownerSubject,
        generation, sequence });
      if (value?.ok !== true || value.reservation_id !== reservation.reservation_id
        || value.deadline_at !== reservation.deadline_at || Date.parse(value.presence_expires_at) > reservation.deadlineMs) throw nativeVoiceDenied();
      return value;
    },
    async requestEnd(reservation, reason) {
      check(reservation); return store.requestEnd({ reservationId: reservation.reservation_id, reason });
    },
    async evidence(reservation, event) {
      check(reservation);
      // Trusted observer calls this; browser events/transcripts never reach it.
      if (event.kind === 'terminal') return store.recordTerminal({ reservationId: reservation.reservation_id, ...event });
      if (event.kind === 'usage') return store.recordUsage({ reservationId: reservation.reservation_id, ...event });
      throw new TypeError('Native Voice evidence kind is invalid.');
    },
    quarantine,
  });
}
