import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';

/**
 * DR-119 clause 7 - explicit, configuration-driven, validated, fail-closed LOR
 * Studio target binding.
 *
 * Before this adapter the durable repositories carried the Supabase target
 * identity as module constants, so the ONLY reachable production target was the
 * RankListIQ production project. There is now no default, no fallback, and no
 * ambient target: a binding exists only when a caller supplies a complete,
 * ratified target configuration and this resolver validates every field of it.
 */

export const LOR_TARGET_BINDING_SCHEMA = 'missionmed.lor.target-binding.v1';
export const LOR_TARGET_BINDING_INTEGRATION = 'lor_target_binding';

const LOR_SCHEMA = 'lor_studio';
const ENVIRONMENTS = new Set(['local', 'test', 'staging', 'production']);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/u;
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,62}$/u;
const MIGRATION_LEDGER_PATTERN = /^[a-z0-9][a-z0-9._/-]{2,127}$/u;
const DECISION_RECORD_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,6}$/u;

/**
 * Identifiers that can never be selected as a LOR Studio target by this
 * resolver.
 *
 * `fglyvdykwgbuivikqoah` is the RankListIQ PRODUCTION project - live Arena/STAT
 * data that LOR Studio has never been ratified to write to. `mftguikkftmrxjxrkdln`
 * is the historical `lor-staging` child that the LOR product passport declares
 * "historical no-touch and not a release target".
 *
 * These fail closed even when passed EXPLICITLY. Binding LOR Studio to either
 * one is a separately ratified founder decision and is outside the authority of
 * DR-119 clause 7 to enable; re-enabling them requires amending this denylist
 * under that later decision, not passing them through at a call site.
 */
export const DENIED_TARGET_IDENTIFIERS = deepFreeze({
  fglyvdykwgbuivikqoah: 'RANKLISTIQ_PRODUCTION_PROJECT',
  mftguikkftmrxjxrkdln: 'LOR_HISTORICAL_NO_TOUCH_BRANCH',
});

const IDENTITY_FIELDS = Object.freeze(['projectRef', 'parentProjectRef', 'branchId', 'branchName']);

const CONFIGURATION_KEYS = new Set([
  'branchId',
  'branchName',
  'dataCopied',
  'decisionRecord',
  'environment',
  'environmentBound',
  'health',
  'independentlyVerified',
  'migrationLedger',
  'parentProjectRef',
  'productionDataBindingPassed',
  'projectRef',
  'providerResourceBound',
  'ratified',
  'schema',
  'schemaVersion',
]);

/**
 * Bindings this module actually validated. Membership cannot be forged from a
 * call site: a hand-built object that merely *looks* like a binding is not in
 * this set, so repositories cannot be handed an unvalidated target.
 */
const VALIDATED_BINDINGS = new WeakSet();

/**
 * @typedef {object} LorTargetConfiguration
 * @property {string} schemaVersion
 * @property {boolean} ratified
 * @property {string} decisionRecord
 * @property {string} environment
 * @property {string} projectRef
 * @property {string | null} parentProjectRef
 * @property {string} branchName
 * @property {string} branchId
 * @property {string} schema
 * @property {string} migrationLedger
 * @property {boolean} providerResourceBound
 * @property {boolean} independentlyVerified
 * @property {string} health
 * @property {boolean} environmentBound
 * @property {boolean} dataCopied
 * @property {boolean} productionDataBindingPassed
 */

function failClosed(status) {
  throw new IntegrationDisabledError(LOR_TARGET_BINDING_INTEGRATION, status);
}

function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function assertPattern(value, pattern, status) {
  if (typeof value !== 'string' || !pattern.test(value)) failClosed(status);
  return value;
}

/** Every identity string is checked, so a denied ref cannot hide in any field. */
function assertNotDenied(configuration) {
  for (const field of IDENTITY_FIELDS) {
    const value = configuration[field];
    if (typeof value === 'string' && Object.hasOwn(DENIED_TARGET_IDENTIFIERS, value)) {
      failClosed(`TARGET_BINDING_DENIED_${DENIED_TARGET_IDENTIFIERS[value]}`);
    }
  }
}

/**
 * Resolve an explicit, ratified LOR Studio target configuration into a validated
 * binding. Throws on absent, partial, malformed, unratified, or denied
 * configuration. It never returns a default and never infers a target.
 *
 * @param {LorTargetConfiguration} [rawConfiguration]
 * @returns {Readonly<Record<string, unknown>>}
 */
export function resolveLorTargetBinding(rawConfiguration) {
  // No argument, null, or a non-plain object is a hard stop. There is deliberately
  // no `configuration = DEFAULT_TARGET` here and there must never be one.
  if (!isPlainObject(rawConfiguration)) failClosed('TARGET_BINDING_CONFIGURATION_REQUIRED');
  if (!hasExactKeys(rawConfiguration, CONFIGURATION_KEYS)) {
    failClosed('TARGET_BINDING_CONFIGURATION_INCOMPLETE');
  }

  // SNAPSHOT BEFORE VALIDATING. Reading the caller's object more than once is a
  // time-of-check/time-of-use hole: a configuration whose `projectRef` is an accessor
  // (or a Proxy) can return a benign value to the denylist check and the denied
  // RankListIQ production ref to the binding constructor afterwards. Every subsequent
  // read below is from this inert plain-data copy, so each field is read exactly once
  // from the caller and can never change underneath the checks.
  const configuration = {};
  for (const key of CONFIGURATION_KEYS) configuration[key] = rawConfiguration[key];

  // Denied identities are rejected before any other coherence check, so a
  // well-formed configuration cannot buy its way past the denylist.
  assertNotDenied(configuration);

  if (configuration.schemaVersion !== LOR_TARGET_BINDING_SCHEMA) {
    failClosed('TARGET_BINDING_SCHEMA_VERSION_INVALID');
  }
  if (configuration.ratified !== true) failClosed('TARGET_BINDING_NOT_RATIFIED');
  assertPattern(
    configuration.decisionRecord,
    DECISION_RECORD_PATTERN,
    'TARGET_BINDING_DECISION_RECORD_REQUIRED',
  );

  if (
    configuration.providerResourceBound !== true
    || configuration.independentlyVerified !== true
    || configuration.environmentBound !== true
    || configuration.health !== 'ready'
  ) {
    failClosed('TARGET_BINDING_RESOURCE_UNVERIFIED');
  }

  if (!ENVIRONMENTS.has(configuration.environment)) failClosed('TARGET_BINDING_ENVIRONMENT_INVALID');
  if (configuration.schema !== LOR_SCHEMA) failClosed('TARGET_BINDING_SCHEMA_INVALID');

  assertPattern(configuration.projectRef, IDENTIFIER_PATTERN, 'TARGET_BINDING_PROJECT_REF_INVALID');
  assertPattern(configuration.branchId, IDENTIFIER_PATTERN, 'TARGET_BINDING_BRANCH_ID_INVALID');
  assertPattern(configuration.branchName, BRANCH_NAME_PATTERN, 'TARGET_BINDING_BRANCH_NAME_INVALID');
  assertPattern(
    configuration.migrationLedger,
    MIGRATION_LEDGER_PATTERN,
    'TARGET_BINDING_MIGRATION_LEDGER_REQUIRED',
  );
  if (configuration.parentProjectRef !== null) {
    assertPattern(
      configuration.parentProjectRef,
      IDENTIFIER_PATTERN,
      'TARGET_BINDING_PARENT_PROJECT_REF_INVALID',
    );
    if (configuration.parentProjectRef === configuration.projectRef) {
      failClosed('TARGET_BINDING_PARENT_PROJECT_REF_INVALID');
    }
  }

  // A Supabase branch is itself addressed by a project ref, so the target's own
  // branch id and project ref must be the same resource. A configuration that
  // names one project but points writes at a different branch is ambiguous about
  // where DDL lands, which is exactly the hazard this clause closes.
  if (configuration.branchId !== configuration.projectRef) {
    failClosed('TARGET_BINDING_BRANCH_IDENTITY_MISMATCH');
  }

  // LOR Studio never binds a target seeded from copied production data.
  if (configuration.dataCopied !== false) failClosed('TARGET_BINDING_DATA_COPY_FORBIDDEN');

  // The production data binding flag must match the declared environment exactly,
  // so it can neither be omitted for production nor smuggled onto a lower target.
  if (configuration.productionDataBindingPassed !== (configuration.environment === 'production')) {
    failClosed('TARGET_BINDING_PRODUCTION_EVIDENCE_MISMATCH');
  }

  const binding = deepFreeze({
    schemaVersion: LOR_TARGET_BINDING_SCHEMA,
    decisionRecord: configuration.decisionRecord,
    environment: configuration.environment,
    projectRef: configuration.projectRef,
    parentProjectRef: configuration.parentProjectRef,
    branchName: configuration.branchName,
    branchId: configuration.branchId,
    schema: configuration.schema,
    migrationLedger: configuration.migrationLedger,
  });
  // Belt and braces: re-run the denylist against the CONSTRUCTED, frozen binding, not the
  // caller's input. If any identity field still resolves to a denied target at this point,
  // nothing is registered and no binding escapes.
  assertNotDenied(binding);
  VALIDATED_BINDINGS.add(binding);
  return /** @type {Readonly<Record<string, unknown>>} */ (binding);
}

/**
 * Gate used by the durable repositories. Only an object this module produced
 * satisfies it, so a repository cannot be constructed against a target that was
 * never validated.
 *
 * @param {unknown} binding
 * @param {string} integration - repository integration name, for the error code
 * @returns {Readonly<Record<string, unknown>>}
 */
export function assertValidatedLorTargetBinding(binding, integration) {
  if (!binding || typeof binding !== 'object' || !VALIDATED_BINDINGS.has(binding)) {
    throw new IntegrationDisabledError(integration, 'VALIDATED_TARGET_BINDING_REQUIRED');
  }
  return /** @type {Readonly<Record<string, unknown>>} */ (binding);
}

/** @param {unknown} value */
export function isDeniedTargetIdentifier(value) {
  return typeof value === 'string' && Object.hasOwn(DENIED_TARGET_IDENTIFIERS, value);
}

export const LOR_TARGET_BINDING_CONTRACT = deepFreeze({
  schemaVersion: LOR_TARGET_BINDING_SCHEMA,
  authority: 'DR-119',
  selection: 'explicit_ratified_configuration_only',
  defaultTarget: null,
  fallbackTarget: null,
  environments: [...ENVIRONMENTS],
  schema: LOR_SCHEMA,
  requiredConfigurationKeys: [...CONFIGURATION_KEYS].sort(),
  deniedIdentifiers: DENIED_TARGET_IDENTIFIERS,
  deniedEvenWhenExplicit: true,
  bindingProof: 'module_private_validated_binding_registry',
});
