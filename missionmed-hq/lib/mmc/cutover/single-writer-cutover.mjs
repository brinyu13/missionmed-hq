import crypto from 'node:crypto';

import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';

const CUTOVER_STATES = new Set(['SEALED_NO_WRITER', 'SHADOW_READS', 'V1_FROZEN', 'V2_WRITER', 'FORWARD_REPAIR']);
const FEATURE_PLANES = Object.freeze(['reads', 'commands', 'ingest', 'aiProposal', 'operationalPromotion', 'studentPublication']);

export class SingleWriterCutover {
  #state;
  #clock;
  #idFactory;
  #tail = Promise.resolve();

  constructor(options = {}) {
    this.#clock = options.clock || (() => new Date());
    this.#idFactory = options.idFactory || (() => crypto.randomUUID());
    this.#state = {
      tenantId: opaque(options.tenantId || 'tenant_fixture_006', 'tenant id'),
      environment: requireEnvironment(options.environment || 'LOCAL'),
      state: 'SEALED_NO_WRITER',
      generation: 0,
      lockId: null,
      reconciliation: null,
      drainEpoch: 0,
      inflightV1Commands: 0,
      inflightV2Commands: 0,
      acknowledgedV2Writes: 0,
      featureGates: Object.fromEntries(FEATURE_PLANES.map((plane) => [plane, false])),
      audit: [],
    };
  }

  snapshot() {
    return structuredClone(this.#state);
  }

  async beginShadow(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'SEALED_NO_WRITER');
      draft.state = 'SHADOW_READS';
      draft.reconciliation = validateReconciliation(input, draft, this.#clock);
      draft.featureGates.reads = true;
      record(draft, 'CUTOVER_SHADOW_STARTED', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async updateReconciliation(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      if (!['SHADOW_READS', 'V1_FROZEN'].includes(draft.state)) invalidState('Reconciliation is not accepted in this state.');
      draft.reconciliation = validateReconciliation(input, draft, this.#clock);
      record(draft, 'CUTOVER_RECONCILIATION_RECORDED', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async freezeV1(input = {}, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'SHADOW_READS');
      requireExactReconciliation(draft.reconciliation);
      if (!Number.isSafeInteger(input.inflightV1Commands) || input.inflightV1Commands < 0) {
        throw new MmcHttpError(422, 'CUTOVER_INFLIGHT_INVALID', 'The in-flight v1 command count is invalid.');
      }
      draft.inflightV1Commands = input.inflightV1Commands;
      draft.state = 'V1_FROZEN';
      draft.generation += 1;
      draft.drainEpoch = 0;
      draft.reconciliation = null;
      draft.lockId = `cutover_${this.#idFactory()}`;
      record(draft, 'CUTOVER_V1_FROZEN', principal.id, this.#clock, this.#idFactory);
      return Object.freeze({ ...publicState(draft), lockId: draft.lockId });
    });
  }

  async markDrained(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'V1_FROZEN');
      assertLock(draft, input);
      const v1 = boundedCount(input.inflightV1Commands, 'v1 in-flight commands');
      const v2 = boundedCount(input.inflightV2Commands, 'v2 in-flight commands');
      draft.inflightV1Commands = v1;
      draft.inflightV2Commands = v2;
      draft.drainEpoch += 1;
      draft.reconciliation = null;
      record(draft, 'CUTOVER_DRAIN_RECORDED', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async switchToV2(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'V1_FROZEN');
      assertLock(draft, input);
      if (draft.inflightV1Commands !== 0 || draft.inflightV2Commands !== 0) {
        throw new MmcHttpError(409, 'CUTOVER_NOT_DRAINED', 'The writer cannot switch while commands remain in flight.');
      }
      requireFreshExactReconciliation(draft);
      draft.state = 'V2_WRITER';
      draft.generation += 1;
      draft.featureGates.commands = false;
      record(draft, 'CUTOVER_V2_WRITER_ENABLED', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async recordAcknowledgedV2Write(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'V2_WRITER');
      assertLock(draft, input);
      const commandId = opaque(input.commandId, 'command id');
      draft.acknowledgedV2Writes += 1;
      record(draft, 'CUTOVER_V2_WRITE_ACKNOWLEDGED', principal.id, this.#clock, this.#idFactory, { commandId });
      return Object.freeze({ state: draft.state, acknowledgedV2Writes: draft.acknowledgedV2Writes });
    });
  }

  async rollbackBeforeAcknowledgedV2Write(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      if (!['V1_FROZEN', 'V2_WRITER'].includes(draft.state)) invalidState('A pre-write rollback is not available in this state.');
      assertLock(draft, input);
      if (draft.acknowledgedV2Writes > 0) {
        throw new MmcHttpError(409, 'V2_FORWARD_REPAIR_REQUIRED',
          'Acknowledged v2 writes exist; rollback to the v1 writer would fork truth.');
      }
      draft.state = 'SEALED_NO_WRITER';
      draft.generation += 1;
      draft.lockId = null;
      draft.reconciliation = null;
      draft.drainEpoch = 0;
      draft.featureGates = Object.fromEntries(FEATURE_PLANES.map((plane) => [plane, false]));
      record(draft, 'CUTOVER_ROLLED_BACK_PREWRITE', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async enterForwardRepair(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      requireState(draft, 'V2_WRITER');
      assertLock(draft, input);
      if (draft.acknowledgedV2Writes < 1) {
        throw new MmcHttpError(409, 'FORWARD_REPAIR_NOT_REQUIRED', 'No acknowledged v2 write requires forward repair.');
      }
      draft.state = 'FORWARD_REPAIR';
      draft.featureGates.commands = false;
      draft.featureGates.ingest = false;
      draft.featureGates.aiProposal = false;
      draft.featureGates.operationalPromotion = false;
      draft.featureGates.studentPublication = false;
      record(draft, 'CUTOVER_FORWARD_REPAIR_ENTERED', principal.id, this.#clock, this.#idFactory);
      return publicState(draft);
    });
  }

  async setFeaturePlane(input, context = {}) {
    return this.#transition(context, (draft, principal) => {
      if (!FEATURE_PLANES.includes(input?.plane) || typeof input?.enabled !== 'boolean') {
        throw new MmcHttpError(422, 'FEATURE_PLANE_INVALID', 'The feature plane request is invalid.');
      }
      if (input.enabled && draft.state !== 'V2_WRITER') {
        throw new MmcHttpError(409, 'FEATURE_PLANE_CUTOVER_REQUIRED', 'A feature plane cannot be enabled before the v2 writer is authoritative.');
      }
      const prerequisites = {
        commands: ['reads'], ingest: ['reads', 'commands'], aiProposal: ['reads', 'commands', 'ingest'],
        operationalPromotion: ['reads', 'commands', 'ingest', 'aiProposal'],
        studentPublication: ['reads', 'commands', 'ingest', 'aiProposal', 'operationalPromotion'],
      };
      if (input.enabled && (prerequisites[input.plane] || []).some((plane) => !draft.featureGates[plane])) {
        throw new MmcHttpError(409, 'FEATURE_PLANE_PREREQUISITE', 'Feature planes must be enabled in the approved sequence.');
      }
      if (!input.enabled) {
        const index = FEATURE_PLANES.indexOf(input.plane);
        for (const plane of FEATURE_PLANES.slice(index)) draft.featureGates[plane] = false;
      } else {
        draft.featureGates[input.plane] = true;
      }
      record(draft, 'CUTOVER_FEATURE_PLANE_CHANGED', principal.id, this.#clock, this.#idFactory,
        { plane: input.plane, enabled: input.enabled });
      return publicState(draft);
    });
  }

  assertWriter(version) {
    if (version === 'v2' && this.#state.state === 'V2_WRITER') return true;
    throw new MmcHttpError(409, 'WRITER_NOT_AUTHORITATIVE', 'This writer is not authoritative for the environment.');
  }

  assertScope(tenantId, environment) {
    if (this.#state.tenantId !== tenantId || this.#state.environment !== environment) {
      throw new MmcHttpError(409, 'CUTOVER_SCOPE_MISMATCH', 'Cutover authority does not match the exact tenant and environment.');
    }
    return true;
  }

  assertFeaturePlane(plane) {
    if (!FEATURE_PLANES.includes(plane) || this.#state.featureGates[plane] !== true) {
      throw new MmcHttpError(503, 'FEATURE_PLANE_DISABLED', 'The requested MMC v2 feature plane is disabled.');
    }
    return true;
  }

  async runV2Command(input, context = {}, execute) {
    const principal = requireCommandPrincipal(context.principal);
    const tenantId = opaque(input?.tenantId, 'tenant id');
    const environment = requireEnvironment(input?.environment);
    const commandId = opaque(input?.commandId, 'command id');
    if (typeof execute !== 'function') throw new TypeError('A v2 command transaction is required.');

    const previous = this.#tail;
    let release;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      if (principal.tenantId !== tenantId || principal.environment !== environment) {
        throw new MmcHttpError(403, 'CUTOVER_COMMAND_SCOPE_MISMATCH',
          'The command principal is not scoped to the requested tenant and environment.');
      }
      this.assertScope(principal.tenantId, principal.environment);
      this.assertScope(tenantId, environment);
      this.assertWriter('v2');
      this.assertFeaturePlane('commands');
      this.#state.inflightV2Commands += 1;
      try {
        const result = await execute();
        if (result?.status === 'COMMITTED' && result.replayed !== true) {
          this.#state.acknowledgedV2Writes += 1;
          record(this.#state, 'CUTOVER_V2_WRITE_ACKNOWLEDGED', principal.id, this.#clock, this.#idFactory, { commandId });
        }
        return result;
      } finally {
        this.#state.inflightV2Commands -= 1;
      }
    } finally {
      release();
    }
  }

  async #transition(context, callback) {
    const principal = requireOperator(context.principal);
    const previous = this.#tail;
    let release;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      if (principal.tenantId !== this.#state.tenantId || principal.environment !== this.#state.environment) {
        throw new MmcHttpError(403, 'CUTOVER_OPERATOR_SCOPE_MISMATCH',
          'The operator is not scoped to this cutover authority.');
      }
      const draft = structuredClone(this.#state);
      const result = callback(draft, principal);
      if (!CUTOVER_STATES.has(draft.state)) throw new TypeError('Invalid cutover state.');
      this.#state = draft;
      return result;
    } finally {
      release();
    }
  }
}

function validateReconciliation(input, draft, clock) {
  const fields = ['v1Count', 'v2Count', 'v1Hash', 'v2Hash'];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(input, key))) {
    throw new MmcHttpError(422, 'RECONCILIATION_INVALID', 'The reconciliation record is invalid.');
  }
  const checkedAt = clock().toISOString();
  return Object.freeze({
    v1Count: boundedCount(input.v1Count, 'v1 count'), v2Count: boundedCount(input.v2Count, 'v2 count'),
    v1Hash: hash(input.v1Hash), v2Hash: hash(input.v2Hash), checkedAt,
    cutoverGeneration: draft.generation,
    stateAtCheck: draft.state,
    drainEpoch: draft.drainEpoch,
    inflightV1AtCheck: draft.inflightV1Commands,
    inflightV2AtCheck: draft.inflightV2Commands,
  });
}

function requireExactReconciliation(value) {
  if (!value || value.v1Count !== value.v2Count || value.v1Hash !== value.v2Hash) {
    throw new MmcHttpError(409, 'CUTOVER_RECONCILIATION_MISMATCH', 'The v1 and v2 snapshots do not reconcile exactly.');
  }
}

function requireFreshExactReconciliation(draft) {
  requireExactReconciliation(draft.reconciliation);
  const value = draft.reconciliation;
  if (value.stateAtCheck !== 'V1_FROZEN'
    || value.cutoverGeneration !== draft.generation
    || value.drainEpoch !== draft.drainEpoch
    || value.inflightV1AtCheck !== draft.inflightV1Commands
    || value.inflightV2AtCheck !== draft.inflightV2Commands
    || value.inflightV1AtCheck !== 0
    || value.inflightV2AtCheck !== 0) {
    throw new MmcHttpError(409, 'CUTOVER_RECONCILIATION_STALE',
      'A fresh exact reconciliation is required after freeze and drain.');
  }
}

function requireOperator(principal) {
  if (!principal?.id || !principal?.tenantId || !principal?.environment || !principal?.capabilities) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'A valid MMC principal is required.');
  }
  assertCapability(principal, MMC_CAPABILITIES.OPERATIONS);
  return principal;
}

function requireCommandPrincipal(principal) {
  if (!principal?.id || !principal?.tenantId || !principal?.environment || !principal?.capabilities) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'A valid MMC principal is required.');
  }
  assertCapability(principal, MMC_CAPABILITIES.COMMAND);
  return principal;
}

function requireEnvironment(value) {
  const environment = String(value || '').trim().toUpperCase();
  if (!['FIXTURE', 'LOCAL', 'STAGING', 'LIVE'].includes(environment)) {
    throw new MmcHttpError(422, 'CUTOVER_ENVIRONMENT_INVALID', 'The cutover environment is invalid.');
  }
  return environment;
}

function assertLock(draft, input) {
  if (!draft.lockId || input?.lockId !== draft.lockId || input?.expectedGeneration !== draft.generation) {
    throw new MmcHttpError(409, 'STALE_CUTOVER_LOCK', 'The cutover lock or generation is stale.');
  }
}

function requireState(draft, expected) {
  if (draft.state !== expected) invalidState(`Expected ${expected}; found ${draft.state}.`);
}

function invalidState(message) {
  throw new MmcHttpError(409, 'CUTOVER_STATE_INVALID', message);
}

function boundedCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new MmcHttpError(422, 'CUTOVER_COUNT_INVALID', `${label} is invalid.`);
  return value;
}

function hash(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(text)) throw new MmcHttpError(422, 'CUTOVER_HASH_INVALID', 'The reconciliation hash is invalid.');
  return text;
}

function opaque(value, label) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(text)) throw new MmcHttpError(422, 'CUTOVER_IDENTIFIER_INVALID', `${label} is invalid.`);
  return text;
}

function record(draft, type, principalId, clock, idFactory, detail = {}) {
  draft.audit.push(Object.freeze({ id: `audit_${idFactory()}`, type, principalId, occurredAt: clock().toISOString(), ...detail }));
}

function publicState(draft) {
  return Object.freeze({
    tenantId: draft.tenantId, environment: draft.environment,
    state: draft.state, generation: draft.generation, reconciliation: draft.reconciliation,
    inflightV1Commands: draft.inflightV1Commands, inflightV2Commands: draft.inflightV2Commands,
    acknowledgedV2Writes: draft.acknowledgedV2Writes, featureGates: { ...draft.featureGates },
  });
}

export const MMC_CUTOVER_STATES = Object.freeze([...CUTOVER_STATES]);
export const MMC_FEATURE_PLANES = FEATURE_PLANES;
