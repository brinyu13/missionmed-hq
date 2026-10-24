import { COACHING_CONFIG, derivePersonalCorridors } from '../analytics/coaching-config.mjs';

const FORBIDDEN_KEYS = /(?:pcm|sample|pixel|landmark|blendshape|transcript|image|video|audioBlob|raw)/i;

function safeDerivedRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Baseline must be an object.');
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new TypeError(`Raw or identifying baseline field rejected: ${key}`);
    if (child && typeof child === 'object') safeDerivedRecord(child);
  }
  return value;
}

const DEVICE_PROFILE_FIELDS = Object.freeze({
  root: new Set(['audio', 'video']),
  audio: new Set(['sampleRate', 'channelCount', 'echoCancellation', 'noiseSuppression', 'autoGainControl']),
  video: new Set(['width', 'height', 'frameRate']),
});

function safeDeviceProfile(value, scope = 'root') {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Device profile must be a derived object.');
  const allowed = DEVICE_PROFILE_FIELDS[scope];
  if (!allowed) throw new TypeError(`Unknown device profile scope rejected: ${scope}`);
  for (const [key, child] of Object.entries(value)) {
    if (!allowed.has(key)) throw new TypeError(`Identifying or unsupported device field rejected: ${key}`);
    if (child && typeof child === 'object') {
      if (scope !== 'root') throw new TypeError(`Nested device field rejected: ${key}`);
      safeDeviceProfile(child, key);
    }
    else if (child !== null && !['number', 'boolean'].includes(typeof child)) throw new TypeError('Device profile values must be derived scalars.');
  }
  return value;
}

export class BaselineStore {
  constructor({ storage = globalThis.localStorage, now = () => Date.now(), namespace = 'missionmed.ivprep.behavior-baseline' } = {}) {
    this.storage = storage;
    this.now = now;
    this.namespace = namespace;
  }

  #key(identityKey) {
    const admittedKey = String(identityKey || '');
    const wordpressSubject = /^wp:[1-9][0-9]{0,155}$/u.test(admittedKey);
    const opaqueSubject = /^[a-zA-Z0-9._:-]{8,160}$/u.test(admittedKey);
    if (!wordpressSubject && !opaqueSubject) throw new TypeError('Baseline identityKey must be an opaque admitted identifier.');
    return `${this.namespace}:${admittedKey}`;
  }

  save(identityKey, derived = {}, { deviceProfile = null } = {}) {
    safeDerivedRecord(derived);
    safeDeviceProfile(deviceProfile);
    const createdAtMs = Math.round(this.now());
    const record = {
      schemaVersion: 1,
      configVersion: COACHING_CONFIG.version,
      createdAtMs,
      staleAtMs: createdAtMs + COACHING_CONFIG.baseline.staleAfterDays * 86_400_000,
      derived: JSON.parse(JSON.stringify(derived)),
      corridors: derivePersonalCorridors(derived),
      deviceProfile: deviceProfile ? JSON.parse(JSON.stringify(deviceProfile)) : null,
    };
    this.storage.setItem(this.#key(identityKey), JSON.stringify(record));
    return Object.freeze(record);
  }

  load(identityKey, { deviceProfile = null } = {}) {
    safeDeviceProfile(deviceProfile);
    const raw = this.storage.getItem(this.#key(identityKey));
    if (!raw) return null;
    try {
      const record = JSON.parse(raw);
      safeDerivedRecord(record?.derived || {});
      if (record.schemaVersion !== 1 || record.configVersion !== COACHING_CONFIG.version || this.now() >= record.staleAtMs) {
        this.storage.removeItem(this.#key(identityKey));
        return null;
      }
      if (deviceProfile && JSON.stringify(record.deviceProfile) !== JSON.stringify(deviceProfile)) {
        this.storage.removeItem(this.#key(identityKey));
        return null;
      }
      return Object.freeze(record);
    } catch {
      this.storage.removeItem(this.#key(identityKey));
      return null;
    }
  }

  clear(identityKey) {
    this.storage.removeItem(this.#key(identityKey));
  }

  invalidateForDeviceChange(identityKey) { this.clear(identityKey); }
}
