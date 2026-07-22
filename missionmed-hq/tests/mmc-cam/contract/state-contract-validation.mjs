import assert from 'node:assert/strict';

import {
  ENVIRONMENT,
  FRESHNESS,
  MMC_CONTRACT_LIMITS,
  MMC_STATE_ENUMS,
  SECTION_STATE,
  buildQueryEnvelope,
  buildSafeErrorEnvelope,
  validateQueryEnvelope,
  validateSafeErrorEnvelope,
} from '../../../lib/mmc/contracts/state-contract.mjs';

const AS_OF = '2026-07-15T12:00:00.000Z';
const CORRELATION_ID = 'corr_006_state_0001';

for (const enumObject of Object.values(MMC_STATE_ENUMS)) {
  assert.equal(Object.isFrozen(enumObject), true, 'Every orthogonal state enum must be frozen.');
}
assert.equal(Object.isFrozen(MMC_STATE_ENUMS), true, 'The state enum registry must be frozen.');

for (const asOf of [
  '2026-02-29T12:00:00.000Z',
  '2026-07-15T12:00:00.000+14:01',
]) {
  assert.throws(
    () => buildQueryEnvelope({
      data: {},
      meta: {
        environment: 'LOCAL',
        asOf,
        freshness: 'CURRENT',
        sections: {},
        correlationId: CORRELATION_ID,
      },
    }),
    (error) => error?.code === 'MMC_CONTRACT_INVALID_TIMESTAMP',
    `State timestamps must reject invalid calendar/offset value ${asOf}.`,
  );
}

const partial = buildQueryEnvelope({
  data: {
    overview: { studentLabel: 'Synthetic Student', nextAction: 'Review the bounded evidence.' },
    history: null,
    dependencies: null,
  },
  meta: {
    environment: ENVIRONMENT.LOCAL,
    asOf: AS_OF,
    freshness: FRESHNESS.CURRENT,
    sections: {
      overview: SECTION_STATE.AVAILABLE,
      history: SECTION_STATE.PARTIAL,
      dependencies: SECTION_STATE.UNAVAILABLE,
    },
    correlationId: CORRELATION_ID,
  },
});

assert.equal(validateQueryEnvelope(partial), true);
assert.deepEqual(partial.data.overview, {
  studentLabel: 'Synthetic Student',
  nextAction: 'Review the bounded evidence.',
});
assert.equal(partial.data.history, null, 'A missing section must not erase available section data.');
assert.equal(partial.data.dependencies, null);
assert.equal(partial.meta.sections.overview, 'AVAILABLE');
assert.equal(partial.meta.sections.history, 'PARTIAL');
assert.equal(partial.meta.sections.dependencies, 'UNAVAILABLE');
assert.equal(Object.isFrozen(partial), true);
assert.equal(Object.isFrozen(partial.data.overview), true);

const authoritativeEmpty = buildQueryEnvelope({
  data: { items: [], total: 0 },
  meta: {
    environment: 'LOCAL',
    asOf: AS_OF,
    freshness: 'CURRENT',
    sections: { items: 'EMPTY' },
    correlationId: 'corr_006_empty_0001',
  },
});
assert.deepEqual(authoritativeEmpty.data, { items: [], total: 0 });
assert.equal(authoritativeEmpty.meta.sections.items, 'EMPTY');

const revoked = buildQueryEnvelope({
  data: { assignment: null },
  meta: {
    environment: 'LOCAL',
    asOf: AS_OF,
    freshness: 'CURRENT',
    sections: { assignment: 'REVOKED' },
    correlationId: 'corr_006_revoked_0001',
  },
});
assert.equal(revoked.meta.sections.assignment, 'REVOKED');
assert.equal(revoked.data.assignment, null);

assert.throws(
  () => buildQueryEnvelope({
    data: {},
    meta: {
      environment: 'PRODUCTION',
      asOf: AS_OF,
      freshness: 'CURRENT',
      sections: { overview: 'AVAILABLE' },
      correlationId: CORRELATION_ID,
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_INVALID_ENUM',
  'Unknown environment states must fail closed.',
);

assert.throws(
  () => buildQueryEnvelope({
    data: {},
    meta: {
      environment: 'LOCAL',
      asOf: AS_OF,
      freshness: 'CURRENT',
      sections: { overview: 'LOADING' },
      correlationId: CORRELATION_ID,
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_INVALID_ENUM',
  'Unknown section states must fail closed.',
);

assert.throws(
  () => buildQueryEnvelope({
    data: {},
    debug: true,
    meta: {
      environment: 'LOCAL',
      asOf: AS_OF,
      freshness: 'CURRENT',
      sections: { overview: 'AVAILABLE' },
      correlationId: CORRELATION_ID,
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_UNKNOWN_FIELD',
  'Unknown query envelope fields must fail closed.',
);

assert.throws(
  () => buildQueryEnvelope({
    data: {},
    meta: {
      environment: 'LOCAL',
      asOf: AS_OF,
      freshness: 'CURRENT',
      sections: { overview: 'AVAILABLE' },
      correlationId: CORRELATION_ID,
      authorization: 'caller-authored',
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_UNKNOWN_FIELD',
  'Caller-authored authority metadata must not enter the query contract.',
);

const rtlCharacter = 'س';
const rtlBytes = new TextEncoder().encode(rtlCharacter).byteLength;
assert.equal(MMC_CONTRACT_LIMITS.PLAIN_TEXT_MAX_BYTES % rtlBytes, 0);
const boundedRtlText = rtlCharacter.repeat(MMC_CONTRACT_LIMITS.PLAIN_TEXT_MAX_BYTES / rtlBytes);
const rtlEnvelope = buildQueryEnvelope({
  data: { guidance: boundedRtlText },
  meta: {
    environment: 'FIXTURE',
    asOf: AS_OF,
    freshness: 'CURRENT',
    sections: { guidance: 'AVAILABLE' },
    correlationId: 'corr_006_rtl_text_0001',
  },
});
assert.equal(rtlEnvelope.data.guidance, boundedRtlText, 'Bounded RTL text must round-trip without mutation.');

assert.throws(
  () => buildQueryEnvelope({
    data: { guidance: `${boundedRtlText}${rtlCharacter}` },
    meta: {
      environment: 'FIXTURE',
      asOf: AS_OF,
      freshness: 'CURRENT',
      sections: { guidance: 'AVAILABLE' },
      correlationId: 'corr_006_rtl_text_0002',
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_LIMIT_EXCEEDED',
  'Text beyond the UTF-8 byte boundary must fail closed.',
);

const unsafeErrorMessage = [
  'Unable to inspect /Users/example/private/session.txt.',
  'token=not-a-real-secret-fixture',
  'See https://provider.invalid/private.',
  'Provider payload: {"private":"synthetic student fixture"}',
].join(' ');
const safeError = buildSafeErrorEnvelope({
  code: 'DEPENDENCY_UNAVAILABLE',
  message: unsafeErrorMessage,
  retryable: true,
  correlationId: 'corr_006_error_0001',
  diagnosticId: 'diag_006_error_0001',
  retryAfterSeconds: 30,
});

assert.equal(validateSafeErrorEnvelope(safeError), true);
assert.equal(safeError.error.code, 'DEPENDENCY_UNAVAILABLE');
assert.equal(safeError.error.retryable, true);
assert.equal(safeError.error.retryAfterSeconds, 30);
assert.match(safeError.error.message, /\[redacted-path\]/u);
assert.match(safeError.error.message, /\[redacted-secret\]/u);
assert.match(safeError.error.message, /\[redacted-url\]/u);
assert.match(safeError.error.message, /\[redacted-provider-payload\]/u);
assert.doesNotMatch(safeError.error.message, /\/Users\/example/u);
assert.doesNotMatch(safeError.error.message, /not-a-real-secret-fixture/u);
assert.doesNotMatch(safeError.error.message, /provider\.invalid/u);
assert.doesNotMatch(safeError.error.message, /synthetic student fixture/u);
assert.equal(Object.hasOwn(safeError.error, 'stack'), false);
assert.equal(Object.hasOwn(safeError.error, 'cause'), false);

const safeConflict = buildSafeErrorEnvelope({
  code: 'VERSION_CONFLICT',
  message: 'The target version changed.',
  retryable: false,
  correlationId: 'corr_006_error_conflict',
  conflict: { expectedVersion: 4, currentVersion: 5, resolution: 'COMPARE_AND_REAPPLY' },
});
assert.deepEqual(safeConflict.error.conflict, {
  expectedVersion: 4, currentVersion: 5, resolution: 'COMPARE_AND_REAPPLY',
});

assert.throws(
  () => buildSafeErrorEnvelope({
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'A bounded dependency is unavailable.',
    retryable: false,
    correlationId: 'corr_006_error_0002',
    providerPayload: { private: true },
  }),
  (error) => error?.code === 'MMC_CONTRACT_UNKNOWN_FIELD',
  'Provider/private payload fields must fail closed.',
);

assert.throws(
  () => validateSafeErrorEnvelope({
    error: {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Unable to read /Users/example/private/source.txt.',
      retryable: false,
      correlationId: 'corr_006_error_0003',
    },
  }),
  (error) => error?.code === 'MMC_CONTRACT_UNSAFE_TEXT',
  'Validation must reject an error envelope that bypassed redaction.',
);

console.log(JSON.stringify({
  result: 'MMC v2 state contract validation passed',
  orthogonalEnums: Object.keys(MMC_STATE_ENUMS).length,
  sectionStates: Object.values(SECTION_STATE),
  partialPreserved: true,
  authoritativeEmpty: true,
  revokedState: true,
  rtlBoundaryBytes: MMC_CONTRACT_LIMITS.PLAIN_TEXT_MAX_BYTES,
  safeErrorRedaction: true,
  safeVersionConflict: true,
}, null, 2));
