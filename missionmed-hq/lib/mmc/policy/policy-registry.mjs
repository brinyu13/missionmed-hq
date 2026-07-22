import crypto from 'node:crypto';

import { canonicalize } from '../contracts/command-contract.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';

const POLICY_KINDS = new Set([
  'ADVISING',
  'EVIDENCE',
  'IDENTITY',
  'ACQUISITION',
  'TRANSCRIPT_PROCESSING',
  'AI_TRANSFER',
  'PUBLICATION',
  'RETENTION',
]);

export class PolicyRegistry {
  #versions = new Map();
  #active = new Map();
  #audit = [];
  #clock;

  constructor(options = {}) {
    this.#clock = options.clock || (() => new Date());
  }

  register(input, context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.POLICY_MANAGE);
    const policy = validatePolicy(input, principal, this.#clock().toISOString());
    const key = policyVersionKey(policy.tenantId, policy.environment, policy.id);
    if (this.#versions.has(key)) {
      throw new MmcHttpError(409, 'POLICY_VERSION_EXISTS', 'This immutable policy version already exists.');
    }
    this.#versions.set(key, policy);
    this.#audit.push(deepFreeze({
      action: 'POLICY_REGISTERED', policyId: policy.id, tenantId: policy.tenantId,
      environment: policy.environment, principalId: principal.id, occurredAt: this.#clock().toISOString(),
    }));
    return structuredClone(policy);
  }

  activate(policyId, context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.POLICY_MANAGE);
    const policy = this.#versions.get(policyVersionKey(
      principal.tenantId, principal.environment, String(policyId || ''),
    ));
    if (!policy) {
      throw new MmcHttpError(404, 'POLICY_NOT_FOUND', 'The policy version was not found.');
    }
    const key = policyScope(policy);
    this.#active.set(key, policy.id);
    const activatedAt = this.#clock().toISOString();
    this.#audit.push(deepFreeze({
      action: 'POLICY_ACTIVATED', policyId: policy.id, tenantId: policy.tenantId,
      environment: policy.environment, principalId: principal.id, occurredAt: activatedAt,
    }));
    return Object.freeze({ policyId: policy.id, state: 'ACTIVE', activatedAt });
  }

  requireActive({ tenantId, environment, kind, policyId }) {
    const scope = [tenantId, environment, kind].join('\u001f');
    if (this.#active.get(scope) !== policyId) {
      throw new MmcHttpError(409, 'POLICY_VERSION_NOT_ACTIVE', 'The required policy version is not active for this scope.');
    }
    const policy = this.#versions.get(policyVersionKey(tenantId, environment, policyId));
    if (!policy) throw new MmcHttpError(409, 'POLICY_VERSION_NOT_ACTIVE', 'The required policy version is unavailable.');
    return structuredClone(policy);
  }

  get(policyId, context = {}) {
    const principal = requirePrincipal(context.principal);
    const policy = this.#versions.get(policyVersionKey(
      principal.tenantId, principal.environment, String(policyId || ''),
    ));
    return policy ? structuredClone(policy) : null;
  }

  auditSnapshot(context = {}) {
    const principal = requirePrincipal(context.principal);
    assertCapability(principal, MMC_CAPABILITIES.POLICY_MANAGE);
    return structuredClone(this.#audit.filter((entry) => (
      entry.tenantId === principal.tenantId && entry.environment === principal.environment
    )));
  }
}

function validatePolicy(input, principal, createdAt) {
  assertExact(input, ['id', 'kind', 'version', 'rules', 'purpose']);
  const id = opaque(input.id, 'policy id');
  const kind = String(input.kind || '').trim();
  if (!POLICY_KINDS.has(kind)) invalid('POLICY_KIND_INVALID', 'The policy kind is invalid.');
  if (!Number.isSafeInteger(input.version) || input.version < 1) invalid('POLICY_VERSION_INVALID', 'The policy version is invalid.');
  const purpose = boundedText(input.purpose, 3, 500, 'policy purpose');
  const rules = canonicalize(input.rules);
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) invalid('POLICY_RULES_INVALID', 'Policy rules must be an object.');
  if (Buffer.byteLength(JSON.stringify(rules), 'utf8') > 64 * 1024) invalid('POLICY_RULES_TOO_LARGE', 'Policy rules are too large.');
  const semanticHash = crypto.createHash('sha256').update(JSON.stringify(canonicalize({ kind, version: input.version, rules, purpose }))).digest('hex');
  return deepFreeze({
    id, tenantId: principal.tenantId, environment: principal.environment, kind,
    version: input.version, rules, purpose, semanticHash, createdBy: principal.id, createdAt,
  });
}

function policyScope(policy) {
  return [policy.tenantId, policy.environment, policy.kind].join('\u001f');
}

function policyVersionKey(tenantId, environment, policyId) {
  return [String(tenantId || ''), String(environment || ''), String(policyId || '')].join('\u001f');
}

function requirePrincipal(principal) {
  if (typeof principal?.id !== 'string' || !principal.id.trim()
    || typeof principal?.tenantId !== 'string' || !principal.tenantId.trim()
    || typeof principal?.environment !== 'string' || !principal.environment.trim()
    || !Array.isArray(principal.capabilities)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'A valid MMC principal is required.');
  }
  return principal;
}

function assertExact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) {
    invalid('POLICY_FIELDS_INVALID', 'The policy fields are invalid.');
  }
}

function opaque(value, label) {
  if (typeof value !== 'string') invalid('POLICY_IDENTIFIER_INVALID', `${label} is invalid.`);
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(text)) invalid('POLICY_IDENTIFIER_INVALID', `${label} is invalid.`);
  return text;
}

function boundedText(value, min, max, label) {
  if (typeof value !== 'string') invalid('POLICY_TEXT_INVALID', `${label} is invalid.`);
  const text = value.normalize('NFC').trim();
  if (text.length < min || text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) invalid('POLICY_TEXT_INVALID', `${label} is invalid.`);
  return text;
}

function invalid(code, message) {
  throw new MmcHttpError(422, code, message);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

export const MMC_POLICY_KINDS = Object.freeze([...POLICY_KINDS]);
