/**
 * Exact release-mode/readiness coupling for the production LOR graph.
 *
 * Provider and database dependency validation remains the responsibility of the
 * readiness coordinator and composition root. This predicate answers only the
 * narrower question: does the readiness receipt describe the one state permitted
 * by the exact release flags?
 */

const RELEASE_FLAG_KEYS = new Set(['enabled', 'killSwitch', 'requireCanary']);
const READINESS_KEYS = new Set(['productionOperational', 'reason', 'status']);
const RELEASE_FLAG_ENVIRONMENT = Object.freeze({
  enabled: 'MMHQ_LOR_STUDIO_ENABLED',
  killSwitch: 'MMHQ_LOR_STUDIO_KILL_SWITCH',
  requireCanary: 'MMHQ_LOR_STUDIO_REQUIRE_CANARY',
});
const CANONICAL_DARK_FLAGS = Object.freeze({
  enabled: false,
  killSwitch: true,
  requireCanary: true,
});

export const LOR_RELEASE_MODE_READINESS = Object.freeze({
  ACTIVE_READY: 'active-ready',
  DARK_CLOSED: 'dark-closed',
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

function exactDataSnapshot(value, expectedKeys, { allowAdditional = false } = {}) {
  if (!isPlainObject(value)) return null;
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  if (
    (!allowAdditional && keys.length !== expectedKeys.size)
    || keys.some((key) => typeof key !== 'string')
    || [...expectedKeys].some((key) => !keys.includes(key))
  ) return null;
  const snapshot = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.enumerable !== true
    ) return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function exactEnvironmentValue(descriptors, key) {
  const descriptor = descriptors[key];
  if (descriptor === undefined) return Object.freeze({ valid: true, value: undefined });
  if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
    return Object.freeze({ valid: false, value: undefined });
  }
  return Object.freeze({ valid: true, value: descriptor.value });
}

function canonicalBoolean(raw, fallback) {
  if (raw === undefined) return Object.freeze({ valid: true, value: fallback });
  if (raw === 'true') return Object.freeze({ valid: true, value: true });
  if (raw === 'false') return Object.freeze({ valid: true, value: false });
  return Object.freeze({ valid: false, value: fallback });
}

export function isLorReleaseModeDark(rawFlags) {
  const flags = exactDataSnapshot(rawFlags, RELEASE_FLAG_KEYS);
  return Boolean(
    flags
    && flags.enabled === false
    && flags.killSwitch === true
    && flags.requireCanary === true
  );
}

/**
 * Read only canonical `true` and `false` environment literals. Any malformed,
 * accessor-backed, or contradictory state collapses the complete release mode
 * to the canonical dark flags; a malformed axis can never leave the other two
 * axes active.
 */
export function readExactLorReleaseFlags(rawEnvironment = {}) {
  if (!rawEnvironment || typeof rawEnvironment !== 'object' || Array.isArray(rawEnvironment)) {
    return CANONICAL_DARK_FLAGS;
  }
  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(rawEnvironment);
  } catch {
    return CANONICAL_DARK_FLAGS;
  }
  const parsed = {};
  for (const [flag, environmentKey] of Object.entries(RELEASE_FLAG_ENVIRONMENT)) {
    const raw = exactEnvironmentValue(descriptors, environmentKey);
    const fallback = flag === 'enabled' ? false : true;
    const value = canonicalBoolean(raw.value, fallback);
    if (!raw.valid || !value.valid) return CANONICAL_DARK_FLAGS;
    parsed[flag] = value.value;
  }
  const flags = Object.freeze(parsed);
  const active = flags.enabled === true && flags.killSwitch === false;
  return active || isLorReleaseModeDark(flags) ? flags : CANONICAL_DARK_FLAGS;
}

/**
 * Resolve one of the two accepted production release states, or null.
 *
 * Active canary and full rollout both use the active-ready state; the exact
 * boolean `requireCanary` remains shared by every service. A dark graph is
 * accepted only with the canonical fail-closed flags used by the release
 * orchestrator. Accessors, proxies that throw, partial shapes, extra flag keys,
 * string booleans, and internally contradictory readiness receipts are denied.
 */
export function resolveLorReleaseModeReadiness(rawFlags, rawReadiness) {
  const flags = exactDataSnapshot(rawFlags, RELEASE_FLAG_KEYS);
  const readiness = exactDataSnapshot(rawReadiness, READINESS_KEYS, {
    allowAdditional: true,
  });
  if (
    !flags
    || !readiness
    || typeof flags.enabled !== 'boolean'
    || typeof flags.killSwitch !== 'boolean'
    || typeof flags.requireCanary !== 'boolean'
    || typeof readiness.productionOperational !== 'boolean'
    || typeof readiness.reason !== 'string'
    || typeof readiness.status !== 'string'
  ) return null;

  if (
    flags.enabled === true
    && flags.killSwitch === false
    && readiness.status === 'ready'
    && readiness.reason === 'all_dependencies_ready'
    && readiness.productionOperational === true
  ) return LOR_RELEASE_MODE_READINESS.ACTIVE_READY;

  if (
    isLorReleaseModeDark(flags)
    && readiness.status === 'closed'
    && readiness.reason === 'feature_disabled'
    && readiness.productionOperational === false
  ) return LOR_RELEASE_MODE_READINESS.DARK_CLOSED;

  return null;
}

export function isLorReleaseModeReadinessAccepted(rawFlags, rawReadiness) {
  return resolveLorReleaseModeReadiness(rawFlags, rawReadiness) !== null;
}

export const LOR_RELEASE_MODE_READINESS_CONTRACT = Object.freeze({
  activeReady: Object.freeze({
    enabled: true,
    killSwitch: false,
    requireCanary: 'boolean',
    status: 'ready',
    reason: 'all_dependencies_ready',
    productionOperational: true,
  }),
  darkClosed: Object.freeze({
    enabled: false,
    killSwitch: true,
    requireCanary: true,
    status: 'closed',
    reason: 'feature_disabled',
    productionOperational: false,
  }),
  environmentLiterals: Object.freeze(['false', 'true']),
  malformedEnvironment: 'canonical_dark',
  contradictoryFlags: 'canonical_dark',
  dependencyValidation: 'required_separately_complete_exact_and_ready',
});
