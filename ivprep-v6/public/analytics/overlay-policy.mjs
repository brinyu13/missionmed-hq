export const OVERLAY_POLICY_STORAGE_KEY = 'missionmed.ivprep.overlay-policy.local-alpha.v1';
export const OVERLAY_PREFERENCES_STORAGE_KEY = 'missionmed.ivprep.overlay-preferences.local-alpha.v1';

export const LOCAL_OVERLAY_AUTHORITY_COPY = Object.freeze([
  'LOCAL ALPHA',
  'THIS BROWSER ONLY',
  'NOT AUTHENTICATED OR SHARED',
]);

export const DEFAULT_OVERLAY_POLICY = Object.freeze({
  masterEnabled: false,
  studentAllowed: false,
});

export const DEFAULT_OVERLAY_PREFERENCES = Object.freeze({
  studentLiveFace: true,
  studentLiveBody: true,
  studentPlaybackFace: true,
  studentPlaybackBody: true,
  founderLiveFace: true,
  founderLiveBody: true,
  founderPlaybackFace: true,
  founderPlaybackBody: true,
  coachPlaybackFace: true,
  coachPlaybackBody: true,
});

const POLICY_KEYS = Object.freeze(Object.keys(DEFAULT_OVERLAY_POLICY));
const PREFERENCE_KEYS = Object.freeze(Object.keys(DEFAULT_OVERLAY_PREFERENCES));
const PREFERENCE_KEYS_BY_ROLE = Object.freeze({
  student: Object.freeze(['studentLiveFace', 'studentLiveBody', 'studentPlaybackFace', 'studentPlaybackBody']),
  admin: Object.freeze(['founderLiveFace', 'founderLiveBody', 'founderPlaybackFace', 'founderPlaybackBody']),
  coach: Object.freeze(['coachPlaybackFace', 'coachPlaybackBody']),
});

function booleanProjection(value, defaults, keys) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const projected = {};
  for (const key of keys) projected[key] = typeof source[key] === 'boolean' ? source[key] : defaults[key];
  return Object.freeze(projected);
}

function parseStoredBooleans(storage, key, defaults, keys) {
  try {
    if (!storage || typeof storage.getItem !== 'function') return booleanProjection(null, defaults, keys);
    const raw = storage.getItem(key);
    return booleanProjection(raw ? JSON.parse(raw) : null, defaults, keys);
  } catch {
    return booleanProjection(null, defaults, keys);
  }
}

function persistStoredBooleans(storage, key, value, defaults, keys) {
  const projected = booleanProjection(value, defaults, keys);
  try {
    if (storage && typeof storage.setItem === 'function') storage.setItem(key, JSON.stringify(projected));
  } catch {}
  return projected;
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function readOverlayPolicy(storage) {
  return parseStoredBooleans(storage === undefined ? browserStorage() : storage, OVERLAY_POLICY_STORAGE_KEY, DEFAULT_OVERLAY_POLICY, POLICY_KEYS);
}

export function readOverlayPreferences(storage) {
  return parseStoredBooleans(storage === undefined ? browserStorage() : storage, OVERLAY_PREFERENCES_STORAGE_KEY, DEFAULT_OVERLAY_PREFERENCES, PREFERENCE_KEYS);
}

export function persistedOverlaySettingsAreBooleanOnly(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value).every((entry) => typeof entry === 'boolean');
}

export function overlayPolicyForRole({ role, surface, policy = DEFAULT_OVERLAY_POLICY, preferences = DEFAULT_OVERLAY_PREFERENCES } = {}) {
  const safePolicy = booleanProjection(policy, DEFAULT_OVERLAY_POLICY, POLICY_KEYS);
  const safePreferences = booleanProjection(preferences, DEFAULT_OVERLAY_PREFERENCES, PREFERENCE_KEYS);
  const normalizedRole = ['student', 'coach', 'admin'].includes(role) ? role : 'unsupported';
  const normalizedSurface = ['live', 'playback'].includes(surface) ? surface : 'unsupported';
  const roleAllowed = normalizedSurface !== 'unsupported' && (normalizedRole === 'student'
    ? safePolicy.studentAllowed
    : normalizedRole === 'admin' || (normalizedRole === 'coach' && normalizedSurface === 'playback'));
  const allowed = safePolicy.masterEnabled && roleAllowed;
  let prefix = null;
  if (normalizedRole === 'student') prefix = normalizedSurface === 'live' ? 'studentLive' : 'studentPlayback';
  else if (normalizedRole === 'admin') prefix = normalizedSurface === 'live' ? 'founderLive' : 'founderPlayback';
  else if (normalizedRole === 'coach' && normalizedSurface === 'playback') prefix = 'coachPlayback';
  const faceEnabled = Boolean(allowed && prefix && safePreferences[`${prefix}Face`]);
  const bodyEnabled = Boolean(allowed && prefix && safePreferences[`${prefix}Body`]);
  let reason = 'available';
  if (!safePolicy.masterEnabled) reason = 'disabled_by_local_admin_master';
  else if (normalizedRole === 'student' && !safePolicy.studentAllowed) reason = 'student_overlay_disabled_by_local_admin';
  else if (!roleAllowed || !prefix) reason = 'role_or_surface_not_supported';
  else if (!faceEnabled && !bodyEnabled) reason = 'all_layers_hidden';
  return Object.freeze({
    allowed,
    overlayEnabled: Boolean(faceEnabled || bodyEnabled),
    faceEnabled,
    bodyEnabled,
    reason,
  });
}

export class LocalOverlaySettings extends EventTarget {
  constructor({ storage } = {}) {
    super();
    this.storage = storage === undefined ? browserStorage() : storage;
    this.currentPolicy = readOverlayPolicy(this.storage);
    this.currentPreferences = readOverlayPreferences(this.storage);
  }

  policy() {
    return this.currentPolicy;
  }

  preferences() {
    return this.currentPreferences;
  }

  layers(role, surface) {
    return overlayPolicyForRole({ role, surface, policy: this.currentPolicy, preferences: this.currentPreferences });
  }

  updatePolicy(patch, { role } = {}) {
    if (role !== 'admin') throw new DOMException('Only the local Admin Ops surface may change overlay policy.', 'NotAllowedError');
    const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    const next = { ...this.currentPolicy };
    for (const key of POLICY_KEYS) if (typeof source[key] === 'boolean') next[key] = source[key];
    this.currentPolicy = persistStoredBooleans(this.storage, OVERLAY_POLICY_STORAGE_KEY, next, DEFAULT_OVERLAY_POLICY, POLICY_KEYS);
    this.dispatchEvent(new Event('change'));
    return this.currentPolicy;
  }

  updatePreferences(patch, { role } = {}) {
    const allowedKeys = PREFERENCE_KEYS_BY_ROLE[role] || [];
    if (!allowedKeys.length) throw new DOMException('This role may not change local overlay preferences.', 'NotAllowedError');
    const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
    const next = { ...this.currentPreferences };
    for (const key of allowedKeys) if (typeof source[key] === 'boolean') next[key] = source[key];
    this.currentPreferences = persistStoredBooleans(this.storage, OVERLAY_PREFERENCES_STORAGE_KEY, next, DEFAULT_OVERLAY_PREFERENCES, PREFERENCE_KEYS);
    this.dispatchEvent(new Event('change'));
    return this.currentPreferences;
  }
}
