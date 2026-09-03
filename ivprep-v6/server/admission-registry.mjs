const MAX_REVOCATION_TTL_MS = 24 * 60 * 60 * 1000;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function requireSubject(value) {
  const subject = String(value || '').trim();
  if (!/^wp:[1-9][0-9]{0,19}$/u.test(subject)) {
    throw new TypeError('A stable WordPress subject is required.');
  }
  return subject;
}

function requireFingerprint(value) {
  const fingerprint = String(value || '').trim();
  if (!/^[a-f0-9]{64}$/u.test(fingerprint)) {
    throw new TypeError('A valid opaque cookie fingerprint is required.');
  }
  return fingerprint;
}

export class InMemoryAdmissionRegistry {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.entitlements = new Map();
    this.revocations = new Map();
    this.bindings = new Map();
    this.terminationHandlers = new Map();
    this.failedClosed = false;
  }

  grantSyntheticEntitlement(input = {}) {
    const subject = requireSubject(input.subject);
    const expiresAtMs = Number(input.expiresAtMs);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= this.now()) {
      throw new TypeError('A future entitlement expiry is required.');
    }
    const revision = String(input.revision || '').trim();
    if (!/^[A-Za-z0-9._:-]{1,80}$/u.test(revision)) {
      throw new TypeError('A bounded entitlement revision is required.');
    }
    const record = Object.freeze({
      subject,
      revision,
      expiresAtMs,
      founder: input.founder === true,
      voice: input.voice === true,
      video: input.video === true,
      grantedVideoSeconds: Math.max(0, Math.trunc(Number(input.grantedVideoSeconds) || 0)),
    });
    this.entitlements.set(subject, record);
    return clone(record);
  }

  revokeEntitlement(subject) {
    return this.entitlements.delete(requireSubject(subject));
  }

  entitlementFor(subject) {
    if (this.failedClosed) return null;
    const record = this.entitlements.get(requireSubject(subject));
    if (!record || record.expiresAtMs <= this.now()) return null;
    return clone(record);
  }

  bindInterview({ interviewId, subject, cookieFingerprint, entitlementRevision }) {
    const id = String(interviewId || '').trim();
    if (!/^[A-Za-z0-9._:-]{1,120}$/u.test(id)) throw new TypeError('A bounded interview identifier is required.');
    const binding = Object.freeze({
      interviewId: id,
      subject: requireSubject(subject),
      cookieFingerprint: requireFingerprint(cookieFingerprint),
      entitlementRevision: String(entitlementRevision || ''),
      terminationRequested: false,
      terminationReason: null,
    });
    this.bindings.set(id, binding);
    return clone(binding);
  }

  bindingFor(interviewId) {
    return clone(this.bindings.get(String(interviewId || '').trim()) || null);
  }

  setTerminationHandler(interviewId, handler) {
    const id = String(interviewId || '').trim();
    if (!this.bindings.has(id) || typeof handler !== 'function') throw new TypeError('A bound interview termination handler is required.');
    if (this.terminationHandlers.has(id)) throw new Error('A termination handler is already registered.');
    this.terminationHandlers.set(id, handler);
  }

  clearTerminationHandler(interviewId) {
    this.terminationHandlers.delete(String(interviewId || '').trim());
  }

  assertBinding({ interviewId, subject, cookieFingerprint, entitlementRevision }) {
    const binding = this.bindings.get(String(interviewId || '').trim());
    if (!binding) return { ok: false, code: 'ivprep_session_owner_changed' };
    const matches = binding.subject === requireSubject(subject)
      && binding.cookieFingerprint === requireFingerprint(cookieFingerprint)
      && binding.entitlementRevision === String(entitlementRevision || '')
      && binding.terminationRequested !== true;
    return matches ? { ok: true, binding: clone(binding) } : { ok: false, code: 'ivprep_session_owner_changed' };
  }

  recordLogout({ cookieFingerprint, reason = 'hq_logout' } = {}) {
    if (this.failedClosed) return { recorded: false, failClosed: true };
    try {
      const fingerprint = requireFingerprint(cookieFingerprint);
      const expiresAtMs = this.now() + MAX_REVOCATION_TTL_MS;
      const existing = this.revocations.get(fingerprint);
      if (!existing) this.revocations.set(fingerprint, Object.freeze({ fingerprint, reason: String(reason).slice(0, 40), expiresAtMs }));
      let terminationRequests = 0;
      for (const [id, binding] of this.bindings) {
        if (binding.cookieFingerprint !== fingerprint || binding.terminationRequested) continue;
        this.bindings.set(id, Object.freeze({ ...binding, terminationRequested: true, terminationReason: 'hq_logout' }));
        const handler = this.terminationHandlers.get(id);
        if (handler) {
          queueMicrotask(() => {
            Promise.resolve(handler('hq_logout')).catch(() => this.enterFailClosed());
          });
        }
        terminationRequests += 1;
      }
      return { recorded: true, duplicate: Boolean(existing), terminationRequests };
    } catch {
      this.failedClosed = true;
      return { recorded: false, failClosed: true };
    }
  }

  isRevoked(cookieFingerprint) {
    if (this.failedClosed) return true;
    let fingerprint;
    try { fingerprint = requireFingerprint(cookieFingerprint); }
    catch { return true; }
    const record = this.revocations.get(fingerprint);
    if (!record) return false;
    if (record.expiresAtMs <= this.now()) {
      this.revocations.delete(fingerprint);
      return false;
    }
    return true;
  }

  enterFailClosed() {
    this.failedClosed = true;
  }

  resetSyntheticState() {
    this.entitlements.clear();
    this.revocations.clear();
    this.bindings.clear();
    this.terminationHandlers.clear();
    this.failedClosed = false;
  }
}

export let admissionRegistry = new InMemoryAdmissionRegistry();

export function installAdmissionRegistry(nextRegistry) {
  if (!nextRegistry
    || typeof nextRegistry.entitlementFor !== 'function'
    || typeof nextRegistry.isRevoked !== 'function'
    || typeof nextRegistry.bindInterview !== 'function'
    || typeof nextRegistry.assertBinding !== 'function') {
    throw new TypeError('A complete IV Prep admission registry is required.');
  }
  admissionRegistry = nextRegistry;
  return admissionRegistry;
}
