import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import { currentWaiverState } from '../domain/receipts.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  canonicalize,
  deepFreeze,
  toIso,
} from '../domain/value-utils.js';
import { assertProjectionOmitsFacultyPrivateContent } from '../security/authorization-policy.js';
import { OPERATIONAL_READINESS_CONTRACT } from './operational-readiness-adapters.mjs';

const ROLE_PROJECTION_SCHEMAS = Object.freeze({
  admin: 'missionmed.lor.operational-projection.v1',
  faculty: 'missionmed.lor.faculty-projection.v1',
  founder: 'missionmed.lor.operational-projection.v1',
  mentor: 'missionmed.lor.mentor-projection.v1',
  service: 'missionmed.lor.service-projection.v1',
  student: 'missionmed.lor.student-projection.v1',
  support: 'missionmed.lor.operational-projection.v1',
});
const FORBIDDEN_MARKER_KEYS = /^(?:demo|fixture|fixtureData|localStorage|prototypeState|synthetic|syntheticData)$/u;
const PROJECTION_FIELDS = Object.freeze({
  'missionmed.lor.faculty-projection.v1': Object.freeze([
    'schemaVersion',
    'caseId',
    'revision',
    'status',
    'studentShared',
    'facultyPrivate',
    'delivery',
  ]),
  'missionmed.lor.mentor-projection.v1': Object.freeze([
    'schemaVersion',
    'caseId',
    'status',
    'strategyStatus',
    'nextMilestone',
    'deliveryStatus',
  ]),
  'missionmed.lor.operational-projection.v1': Object.freeze([
    'schemaVersion',
    'caseId',
    'status',
    'revision',
    'createdAt',
    'updatedAt',
    'closedAt',
    'builderProgress',
    'deliveryStatus',
  ]),
  'missionmed.lor.service-projection.v1': Object.freeze([
    'schemaVersion',
    'caseId',
    'status',
    'revision',
    'grantedPurpose',
  ]),
  'missionmed.lor.student-projection.v1': Object.freeze([
    'schemaVersion',
    'caseId',
    'revision',
    'status',
    'builder',
    'studentEvidence',
    'applicantOptions',
    'consentReceipts',
    'waiverReceipts',
    'delivery',
    'finalDocument',
  ]),
});
const RESERVED_ROLE_FIELDS = new Set([
  'administrativeGrantId',
  'applicantOptions',
  'assignmentId',
  'builder',
  'builderProgress',
  'consentReceipts',
  'deliveryStatus',
  'facultyPrivate',
  'finalDocument',
  'grantId',
  'grantedPurpose',
  'invitationId',
  'nextMilestone',
  'serviceGrant',
  'strategyStatus',
  'studentEvidence',
  'studentShared',
  'waiverReceipts',
  'waiverState',
]);
const NORMALIZED_RESERVED_ROLE_FIELDS = new Set(
  [...RESERVED_ROLE_FIELDS].map((field) => field.replace(/[^A-Za-z0-9]/gu, '').toLowerCase()),
);

/**
 * @typedef {object} ProductionBootstrapLoader
 * @property {string} [source]
 * @property {boolean} [fixtureBacked]
 * @property {(request: {mode: 'production', caseId: string}) => Promise<Record<string, unknown> | null | undefined>} load
 */

/**
 * @typedef {object} ProductionDependencyHealth
 * @property {boolean} [metadataOnly]
 * @property {() => Promise<Record<string, unknown> | null | undefined>} snapshot
 */

/**
 * @typedef {object} ProductionProjectionLoader
 * @property {string} [source]
 * @property {boolean} [fixtureBacked]
 * @property {(binding: Record<string, unknown>) => Promise<Record<string, unknown> | null | undefined>} loadProductionProjection
 */

/**
 * @typedef {object} ProductionProjectionUi
 * @property {string} [presentationIsolation]
 * @property {boolean} [usesLocalStorage]
 * @property {boolean} [canRevealPrototype]
 * @property {(request: {reasonCode: string, revealPrototype: false}) => Promise<unknown>} block
 * @property {(projection: unknown, context: Record<string, unknown>) => Promise<unknown>} renderProductionProjection
 */

/**
 * @typedef {object} ProductionHydrationOptions
 * @property {ProductionBootstrapLoader | null} [bootstrapLoader]
 * @property {ProductionDependencyHealth | null} [dependencyHealth]
 * @property {ProductionProjectionLoader | null} [projectionLoader]
 * @property {ProductionProjectionUi | null} [ui]
 * @property {() => Date | string | number} [clock]
 */

/** @typedef {{caseId?: string}} ProductionHydrationRequest */

function projectionPathAllowed(actorRole, path) {
  const joined = path.join('.');
  const allowed = {
    admin: new Set(['builderProgress', 'deliveryStatus']),
    faculty: new Set([
      'studentShared',
      'studentShared.applicantOptions',
      'studentShared.consentReceipts',
      'studentShared.waiverState',
      'facultyPrivate',
      'facultyPrivate.answers',
      'facultyPrivate.notes',
      'facultyPrivate.draftText',
      'facultyPrivate.finalDocument',
    ]),
    founder: new Set(['builderProgress', 'deliveryStatus']),
    mentor: new Set(['strategyStatus', 'nextMilestone', 'deliveryStatus']),
    service: new Set(['grantedPurpose']),
    student: new Set([
      'applicantOptions',
      'builder',
      'consentReceipts',
      'finalDocument',
      'studentEvidence',
      'waiverReceipts',
    ]),
    support: new Set(['builderProgress', 'deliveryStatus']),
  };
  return allowed[actorRole]?.has(joined) === true;
}

function keyLooksPrivate(key) {
  const normalized = key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
  return normalized.includes('private')
    || normalized.includes('structuralwaivermaterial')
    || normalized.includes('facultydraft')
    || normalized.includes('facultynote')
    || normalized.includes('facultyanswer')
    || normalized.includes('unreleasedletter')
    || ['answers', 'drafttext', 'lettercontent', 'notes'].includes(normalized);
}

function assertNoNestedRoleOrPrivateStructures(value, actorRole, path = [], depth = 0) {
  if (depth > 20) throw new ValidationError('Projection is too deeply nested');
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      assertNoNestedRoleOrPrivateStructures(child, actorRole, [...path, String(index)], depth + 1);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    const allowed = projectionPathAllowed(actorRole, nextPath);
    const normalizedKey = key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
    if ((NORMALIZED_RESERVED_ROLE_FIELDS.has(normalizedKey) || keyLooksPrivate(key)) && !allowed) {
      throw new ValidationError('Projection contains a nested private or cross-role structure', {
        field: nextPath.join('.'),
      });
    }
    assertNoNestedRoleOrPrivateStructures(child, actorRole, nextPath, depth + 1);
  }
}

function assertExactObject(value, fields, fieldName) {
  assertPlainObject(value, fieldName);
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ValidationError(`${fieldName} does not match its privacy allowlist`, { fieldName });
  }
  return value;
}

function assertAllowedObject(value, fields, fieldName) {
  assertPlainObject(value, fieldName);
  if (Object.keys(value).some((field) => !fields.includes(field))) {
    throw new ValidationError(`${fieldName} contains a field outside its privacy allowlist`, { fieldName });
  }
  return value;
}

function assertNonNegativeRevision(value, fieldName = 'projection.revision') {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${fieldName} must be a non-negative integer`, { fieldName });
  }
}

function assertNullableString(value, fieldName) {
  if (value !== null && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string or null`, { fieldName });
  }
}

function assertArray(value, fieldName) {
  if (!Array.isArray(value)) throw new ValidationError(`${fieldName} must be an array`, { fieldName });
}

function assertObjectArray(value, fieldName) {
  assertArray(value, fieldName);
  value.forEach((item, index) => assertPlainObject(item, `${fieldName}[${index}]`));
}

function parseCanonicalIso(value, fieldName) {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`, { fieldName });
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new ValidationError(`${fieldName} must be a canonical ISO timestamp`, { fieldName });
  }
  return timestamp;
}

function assertDelivery(delivery, fieldName) {
  assertExactObject(delivery, ['status', 'destinationClass', 'deliveredAt'], fieldName);
  assertNonEmptyString(delivery.status, `${fieldName}.status`, { maxLength: 100 });
  assertNullableString(delivery.destinationClass, `${fieldName}.destinationClass`);
  assertNullableString(delivery.deliveredAt, `${fieldName}.deliveredAt`);
}

function assertConsentReceipt(receipt, caseId, fieldName, expectedActorId = null) {
  assertExactObject(
    receipt,
    ['schemaVersion', 'id', 'caseId', 'actorId', 'scopes', 'policyVersion', 'recordedAt', 'receiptHash'],
    fieldName,
  );
  if (
    receipt.schemaVersion !== 'missionmed.lor.consent-receipt.v1'
    || receipt.caseId !== caseId
    || !/^wp:[1-9][0-9]*$/u.test(receipt.actorId ?? '')
    || (expectedActorId !== null && receipt.actorId !== expectedActorId)
    || !Array.isArray(receipt.scopes)
    || receipt.scopes.length === 0
    || receipt.scopes.some((scope) => typeof scope !== 'string' || scope.trim() === '')
    || typeof receipt.id !== 'string'
    || receipt.id.trim() === ''
    || typeof receipt.policyVersion !== 'string'
    || receipt.policyVersion.trim() === ''
    || typeof receipt.receiptHash !== 'string'
  ) {
    throw new ValidationError(`${fieldName} is not a case-bound consent receipt`, { fieldName });
  }
  parseCanonicalIso(receipt.recordedAt, `${fieldName}.recordedAt`);
}

function assertWaiverReceipt(receipt, caseId, actorId, fieldName) {
  assertExactObject(
    receipt,
    [
      'schemaVersion',
      'id',
      'caseId',
      'actorId',
      'waived',
      'policyVersion',
      'priorReceiptId',
      'acknowledgment',
      'recordedAt',
      'receiptHash',
    ],
    fieldName,
  );
  if (
    receipt.schemaVersion !== 'missionmed.lor.waiver-receipt.v1'
    || receipt.caseId !== caseId
    || receipt.actorId !== actorId
    || typeof receipt.waived !== 'boolean'
    || typeof receipt.id !== 'string'
    || receipt.id.trim() === ''
    || typeof receipt.policyVersion !== 'string'
    || receipt.policyVersion.trim() === ''
    || (receipt.priorReceiptId !== null && typeof receipt.priorReceiptId !== 'string')
    || typeof receipt.acknowledgment !== 'string'
    || receipt.acknowledgment.trim() === ''
    || typeof receipt.receiptHash !== 'string'
  ) {
    throw new ValidationError(`${fieldName} is not a case- and actor-bound waiver receipt`, { fieldName });
  }
  parseCanonicalIso(receipt.recordedAt, `${fieldName}.recordedAt`);
}

function assertStudentBuilder(builder) {
  assertExactObject(
    builder,
    ['sessionId', 'totalSteps', 'completedStepIds', 'currentStepId', 'stepData', 'autosavedAt'],
    'projection.builder',
  );
  assertNonEmptyString(builder.sessionId, 'projection.builder.sessionId', { maxLength: 200 });
  if (builder.totalSteps !== 8 || !Array.isArray(builder.completedStepIds)) {
    throw new ValidationError('projection.builder must retain the canonical eight-step shape');
  }
  if (builder.completedStepIds.some((stepId) => typeof stepId !== 'string' || stepId.trim() === '')) {
    throw new ValidationError('projection.builder.completedStepIds must contain string identifiers only');
  }
  if (builder.currentStepId !== null && typeof builder.currentStepId !== 'string') {
    throw new ValidationError('projection.builder.currentStepId must be a string or null');
  }
  assertPlainObject(builder.stepData, 'projection.builder.stepData');
  assertNullableString(builder.autosavedAt, 'projection.builder.autosavedAt');
}

function assertStudentProjection(projection, binding, nowMs) {
  assertExactObject(
    projection,
    PROJECTION_FIELDS['missionmed.lor.student-projection.v1'],
    'student projection',
  );
  assertNonNegativeRevision(projection.revision);
  assertNonEmptyString(projection.status, 'projection.status', { maxLength: 100 });
  assertStudentBuilder(projection.builder);
  assertObjectArray(projection.studentEvidence, 'projection.studentEvidence');
  assertObjectArray(projection.applicantOptions, 'projection.applicantOptions');
  assertArray(projection.consentReceipts, 'projection.consentReceipts');
  assertArray(projection.waiverReceipts, 'projection.waiverReceipts');
  projection.consentReceipts.forEach((receipt, index) => {
    assertConsentReceipt(
      receipt,
      projection.caseId,
      `projection.consentReceipts[${index}]`,
      binding.actorId,
    );
  });
  projection.waiverReceipts.forEach((receipt, index) => {
    assertWaiverReceipt(
      receipt,
      projection.caseId,
      binding.actorId,
      `projection.waiverReceipts[${index}]`,
    );
  });
  const waiverState = currentWaiverState(projection.waiverReceipts);
  assertDelivery(projection.delivery, 'projection.delivery');
  if (projection.finalDocument !== null) {
    assertExactObject(
      projection.finalDocument,
      ['id', 'text', 'contentHash', 'mimeType', 'releasedToStudentAt'],
      'projection.finalDocument',
    );
    const releasedAt = parseCanonicalIso(
      projection.finalDocument.releasedToStudentAt,
      'projection.finalDocument.releasedToStudentAt',
    );
    const latestWaiverReceipt = projection.waiverReceipts.at(-1);
    const latestWaiverRecordedAt = latestWaiverReceipt
      ? parseCanonicalIso(latestWaiverReceipt.recordedAt, 'latest waiver receipt recordedAt')
      : Number.NaN;
    if (
      waiverState.decided !== true
      || waiverState.waived !== false
      || typeof projection.finalDocument.text !== 'string'
      || projection.finalDocument.text.trim() === ''
      || releasedAt > nowMs
      || !Number.isFinite(latestWaiverRecordedAt)
      || releasedAt < latestWaiverRecordedAt
    ) {
      throw new ValidationError(
        'Student letter content requires a current, non-waived, explicitly released document',
      );
    }
    assertNullableString(projection.finalDocument.id, 'projection.finalDocument.id');
    assertNullableString(projection.finalDocument.contentHash, 'projection.finalDocument.contentHash');
    assertNullableString(projection.finalDocument.mimeType, 'projection.finalDocument.mimeType');
  }
  assertProjectionOmitsFacultyPrivateContent(projection);
}

function assertFacultyProjection(projection) {
  assertExactObject(
    projection,
    PROJECTION_FIELDS['missionmed.lor.faculty-projection.v1'],
    'faculty projection',
  );
  assertNonNegativeRevision(projection.revision);
  assertNonEmptyString(projection.status, 'projection.status', { maxLength: 100 });
  assertExactObject(
    projection.studentShared,
    ['evidence', 'applicantOptions', 'consentReceipts', 'waiverState'],
    'projection.studentShared',
  );
  assertObjectArray(projection.studentShared.evidence, 'projection.studentShared.evidence');
  assertObjectArray(
    projection.studentShared.applicantOptions,
    'projection.studentShared.applicantOptions',
  );
  assertArray(projection.studentShared.consentReceipts, 'projection.studentShared.consentReceipts');
  projection.studentShared.consentReceipts.forEach((receipt, index) => {
    assertConsentReceipt(receipt, projection.caseId, `projection.studentShared.consentReceipts[${index}]`);
  });
  assertExactObject(
    projection.studentShared.waiverState,
    ['decided', 'waived', 'receiptId'],
    'projection.studentShared.waiverState',
  );
  if (
    typeof projection.studentShared.waiverState.decided !== 'boolean'
    || (
      projection.studentShared.waiverState.decided === false
      && (
        projection.studentShared.waiverState.waived !== null
        || projection.studentShared.waiverState.receiptId !== null
      )
    )
    || (
      projection.studentShared.waiverState.decided === true
      && (
        typeof projection.studentShared.waiverState.waived !== 'boolean'
        || typeof projection.studentShared.waiverState.receiptId !== 'string'
        || projection.studentShared.waiverState.receiptId.trim() === ''
      )
    )
  ) {
    throw new ValidationError('projection.studentShared.waiverState is invalid');
  }
  assertNullableString(projection.studentShared.waiverState.receiptId, 'projection.studentShared.waiverState.receiptId');
  assertExactObject(
    projection.facultyPrivate,
    ['answers', 'notes', 'draftText', 'finalDocument'],
    'projection.facultyPrivate',
  );
  assertObjectArray(projection.facultyPrivate.answers, 'projection.facultyPrivate.answers');
  assertObjectArray(projection.facultyPrivate.notes, 'projection.facultyPrivate.notes');
  assertNullableString(projection.facultyPrivate.draftText, 'projection.facultyPrivate.draftText');
  if (projection.facultyPrivate.finalDocument !== null) {
    assertAllowedObject(
      projection.facultyPrivate.finalDocument,
      ['id', 'text', 'contentHash', 'mimeType', 'releasedToStudentAt'],
      'projection.facultyPrivate.finalDocument',
    );
    for (const field of ['id', 'text', 'contentHash', 'mimeType', 'releasedToStudentAt']) {
      if (field in projection.facultyPrivate.finalDocument) {
        assertNullableString(
          projection.facultyPrivate.finalDocument[field],
          `projection.facultyPrivate.finalDocument.${field}`,
        );
      }
    }
  }
  assertDelivery(projection.delivery, 'projection.delivery');
}

function assertMentorProjection(projection) {
  assertExactObject(
    projection,
    PROJECTION_FIELDS['missionmed.lor.mentor-projection.v1'],
    'mentor projection',
  );
  assertNonEmptyString(projection.status, 'projection.status', { maxLength: 100 });
  assertNullableString(projection.strategyStatus, 'projection.strategyStatus');
  assertNullableString(projection.nextMilestone, 'projection.nextMilestone');
  assertNullableString(projection.deliveryStatus, 'projection.deliveryStatus');
}

function assertOperationalProjection(projection) {
  assertExactObject(
    projection,
    PROJECTION_FIELDS['missionmed.lor.operational-projection.v1'],
    'operational projection',
  );
  assertNonNegativeRevision(projection.revision);
  assertNonEmptyString(projection.status, 'projection.status', { maxLength: 100 });
  assertNullableString(projection.createdAt, 'projection.createdAt');
  assertNullableString(projection.updatedAt, 'projection.updatedAt');
  assertNullableString(projection.closedAt, 'projection.closedAt');
  assertNullableString(projection.deliveryStatus, 'projection.deliveryStatus');
  assertExactObject(
    projection.builderProgress,
    ['sessionId', 'completedSteps', 'totalSteps', 'percent', 'nextStepId', 'autosavedAt'],
    'projection.builderProgress',
  );
  assertNonEmptyString(
    projection.builderProgress.sessionId,
    'projection.builderProgress.sessionId',
    { maxLength: 200 },
  );
  if (
    !Number.isSafeInteger(projection.builderProgress.completedSteps)
    || !Number.isSafeInteger(projection.builderProgress.totalSteps)
    || !Number.isSafeInteger(projection.builderProgress.percent)
    || projection.builderProgress.completedSteps < 0
    || projection.builderProgress.totalSteps !== 8
    || projection.builderProgress.completedSteps > projection.builderProgress.totalSteps
    || projection.builderProgress.percent < 0
    || projection.builderProgress.percent > 100
  ) {
    throw new ValidationError('projection.builderProgress must contain numeric metadata only');
  }
  assertNullableString(projection.builderProgress.nextStepId, 'projection.builderProgress.nextStepId');
  assertNullableString(projection.builderProgress.autosavedAt, 'projection.builderProgress.autosavedAt');
}

function assertServiceProjection(projection) {
  assertExactObject(
    projection,
    PROJECTION_FIELDS['missionmed.lor.service-projection.v1'],
    'service projection',
  );
  assertNonNegativeRevision(projection.revision);
  assertNonEmptyString(projection.status, 'projection.status', { maxLength: 100 });
  assertNonEmptyString(projection.grantedPurpose, 'projection.grantedPurpose', { maxLength: 160 });
}

function assertRoleProjectionShape(projection, binding, nowMs) {
  if (binding.actorRole === 'student') assertStudentProjection(projection, binding, nowMs);
  else if (binding.actorRole === 'faculty') assertFacultyProjection(projection);
  else if (binding.actorRole === 'mentor') assertMentorProjection(projection);
  else if (['admin', 'founder', 'support'].includes(binding.actorRole)) assertOperationalProjection(projection);
  else if (binding.actorRole === 'service') assertServiceProjection(projection);
  else throw new ValidationError('Hydration actor role is not supported');
  assertNoNestedRoleOrPrivateStructures(projection, binding.actorRole);
}

function assertDependency(value, method, name) {
  if (!value || typeof value[method] !== 'function') {
    throw new IntegrationDisabledError('lor_production_hydration', `${name.toUpperCase()}_REQUIRED`);
  }
  return value;
}

function assertProductionUi(ui) {
  assertDependency(ui, 'block', 'ui_block');
  assertDependency(ui, 'renderProductionProjection', 'ui_render');
  if (
    ui.presentationIsolation !== 'production_projection_only'
    || ui.usesLocalStorage !== false
    || ui.canRevealPrototype !== false
  ) {
    throw new IntegrationDisabledError('lor_production_hydration', 'PRODUCTION_UI_ISOLATION_REQUIRED');
  }
  return ui;
}

function assertNoPrototypeMarkers(value, depth = 0) {
  if (depth > 20) throw new ValidationError('Hydration payload is too deeply nested');
  if (Array.isArray(value)) {
    for (const item of value) assertNoPrototypeMarkers(item, depth + 1);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_MARKER_KEYS.test(key)) {
      throw new ValidationError('Production hydration payload contains a prototype marker', { field: key });
    }
    assertNoPrototypeMarkers(child, depth + 1);
  }
}

function assertLiveBootstrap(payload, requestedCaseId) {
  assertNoPrototypeMarkers(payload);
  const actorId = String(payload?.actorId || '').trim();
  const actorRole = String(payload?.actorRole || '').trim();
  const expectedProjectionSchema = ROLE_PROJECTION_SCHEMAS[actorRole];
  if (
    !payload
    || payload.operational !== true
    || payload.runtimeMode !== 'live'
    || payload.storageMode !== 'durable'
    || payload.providersReady !== true
    || payload.allDependenciesReady !== true
    || payload.fixtureBacked === true
    || payload.authenticated !== true
    || payload.authorizationSource !== 'server_verified_session_crosswalk'
    || !actorId
    || !expectedProjectionSchema
    || payload.caseId !== requestedCaseId
    || payload.projectionSchema !== expectedProjectionSchema
  ) {
    throw new IntegrationDisabledError('lor_production_hydration', 'LIVE_BOOTSTRAP_REQUIRED');
  }
  return deepFreeze({
    actorId,
    actorRole,
    caseId: requestedCaseId,
    projectionSchema: expectedProjectionSchema,
  });
}

function assertReadyHealth(snapshot) {
  assertNoPrototypeMarkers(snapshot);
  const dependencyNames = Object.keys(snapshot?.dependencies || {}).sort();
  const expectedNames = [...OPERATIONAL_READINESS_CONTRACT.dependencies].sort();
  if (
    !snapshot
    || snapshot.schemaVersion !== 'missionmed.lor.dependency-health.v1'
    || snapshot.status !== 'ready'
    || snapshot.productionOperational !== true
    || !snapshot.dependencies
    || JSON.stringify(dependencyNames) !== JSON.stringify(expectedNames)
    || Object.values(snapshot.dependencies).some((dependency) => dependency?.state !== 'ready')
  ) {
    throw new IntegrationDisabledError('lor_production_hydration', 'ALL_DEPENDENCIES_READY_REQUIRED');
  }
}

function assertProductionProjection(envelope, binding, nowMs) {
  assertNoPrototypeMarkers(envelope);
  const projection = envelope?.projection;
  if (
    !envelope
    || envelope.schemaVersion !== 'missionmed.lor.hydration-envelope.v1'
    || envelope.authorizationSource !== 'server_authorization_policy'
    || envelope.actorId !== binding.actorId
    || envelope.actorRole !== binding.actorRole
    || envelope.caseId !== binding.caseId
    || envelope.projectionSchema !== binding.projectionSchema
    || !projection
    || projection.schemaVersion !== binding.projectionSchema
    || projection.caseId !== binding.caseId
  ) {
    throw new ValidationError('Durable case projection authorization envelope is invalid');
  }
  const isolatedProjection = structuredClone(projection);
  canonicalize(isolatedProjection);
  assertRoleProjectionShape(isolatedProjection, binding, nowMs);
  return deepFreeze(isolatedProjection);
}

export class ProductionHydrationAdapter {
  /** @param {ProductionHydrationOptions} [options] */
  constructor({ bootstrapLoader, dependencyHealth, projectionLoader, ui, clock } = {}) {
    this.bootstrapLoader = assertDependency(bootstrapLoader, 'load', 'bootstrap_loader');
    this.dependencyHealth = assertDependency(dependencyHealth, 'snapshot', 'dependency_health');
    this.projectionLoader = assertDependency(projectionLoader, 'loadProductionProjection', 'projection_loader');
    if (
      projectionLoader.source !== 'durable_repository'
      || projectionLoader.fixtureBacked !== false
    ) {
      throw new IntegrationDisabledError('lor_production_hydration', 'DURABLE_PROJECTION_LOADER_REQUIRED');
    }
    if (
      bootstrapLoader.source !== 'protected_lor_bootstrap'
      || bootstrapLoader.fixtureBacked !== false
      || dependencyHealth.metadataOnly !== true
    ) {
      throw new IntegrationDisabledError('lor_production_hydration', 'VERIFIED_BOOTSTRAP_AND_HEALTH_REQUIRED');
    }
    if (typeof clock !== 'function') {
      throw new IntegrationDisabledError('lor_production_hydration', 'TRUSTED_CLOCK_REQUIRED');
    }
    this.clock = clock;
    this.ui = assertProductionUi(ui);
    Object.freeze(this);
  }

  /** @param {ProductionHydrationRequest} [request] */
  async hydrate({ caseId } = {}) {
    assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
    await this.ui.block({ reasonCode: 'HYDRATION_PENDING', revealPrototype: false });
    try {
      const nowMs = Date.parse(toIso(this.clock(), 'clock'));
      const bootstrap = await this.bootstrapLoader.load({ mode: 'production', caseId });
      const actorBinding = assertLiveBootstrap(bootstrap, caseId);
      const health = await this.dependencyHealth.snapshot();
      assertReadyHealth(health);
      const envelope = await this.projectionLoader.loadProductionProjection(actorBinding);
      const projection = assertProductionProjection(envelope, actorBinding, nowMs);
      await this.ui.renderProductionProjection(projection, {
        runtimeMode: 'live',
        actorRole: actorBinding.actorRole,
        projectionSchema: actorBinding.projectionSchema,
        revealPrototype: false,
        persistToLocalStorage: false,
      });
      return deepFreeze({
        hydrated: true,
        runtimeMode: 'live',
        caseId,
        fixtureRevealed: false,
        localStorageUsed: false,
      });
    } catch {
      await this.ui.block({ reasonCode: 'HYDRATION_BLOCKED', revealPrototype: false });
      return deepFreeze({
        hydrated: false,
        runtimeMode: 'unavailable',
        caseId,
        reasonCode: 'HYDRATION_BLOCKED',
        fixtureRevealed: false,
        localStorageUsed: false,
      });
    }
  }
}

export const PRODUCTION_HYDRATION_CONTRACT = deepFreeze({
  source: 'durable_production_projection_only',
  revealOrder: 'bootstrap_then_all_dependencies_then_projection_then_render',
  projectionBoundary: 'exact_role_schema_privacy_allowlist',
  studentLetterBoundary: 'case_actor_waiver_bound_release_not_after_trusted_clock',
  studentStructuralWaiverMaterial: 'denied_at_any_depth',
  syntheticFixtureReveal: false,
  localStorageUse: false,
});
