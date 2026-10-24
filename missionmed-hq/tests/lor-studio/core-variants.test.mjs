import assert from 'node:assert/strict';
import test from 'node:test';

import { createApplicantVariantSet } from '../../lor-studio/domain/applicant-variants.js';
import { ValidationError } from '../../lor-studio/domain/errors.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';

function variant(id, angle, text, evidenceId = 'evidence-1') {
  return {
    id,
    angle,
    text,
    evidenceReferences: [{ id: evidenceId, contentHash: sha256(`content:${evidenceId}`) }],
    claims: [{ text: `${angle} claim`, evidenceReferenceIds: [evidenceId] }],
  };
}

test('complete applicant sets contain three to five distinct evidence-grounded variants', () => {
  const set = createApplicantVariantSet({
    caseId: 'case-variants',
    createdAt: new Date('2026-08-09T16:00:00.000Z'),
    variants: [
      variant('variant-1', 'clinical_reasoning', 'Clinical reasoning wording.'),
      variant('variant-2', 'patient_communication', 'Patient communication wording.'),
      variant('variant-3', 'team_reliability', 'Team reliability wording.'),
      variant('variant-4', 'growth_and_reflection', 'Growth and reflection wording.'),
    ],
  });
  assert.equal(set.count, 4);
  assert.equal(set.complete, true);
  assert.ok(set.variants.every((item) => item.state === 'applicant_prepared'));
  assert.equal(new Set(set.variants.map((item) => item.textHash)).size, 4);
});

test('incomplete, duplicated, or unsupported applicant variants fail closed', () => {
  assert.throws(
    () => createApplicantVariantSet({
      caseId: 'case-variants',
      variants: [variant('v1', 'one', 'One.'), variant('v2', 'two', 'Two.')],
    }),
    ValidationError,
  );
  assert.throws(
    () => createApplicantVariantSet({
      caseId: 'case-variants',
      variants: [
        variant('v1', 'one', 'Same wording.'),
        variant('v2', 'two', 'Same wording.'),
        variant('v3', 'three', 'Different wording.'),
      ],
    }),
    /distinct wording/u,
  );
  const unsupported = variant('v1', 'one', 'One.');
  unsupported.claims[0].evidenceReferenceIds = ['unknown-evidence'];
  assert.throws(
    () => createApplicantVariantSet({
      caseId: 'case-variants',
      variants: [unsupported, variant('v2', 'two', 'Two.'), variant('v3', 'three', 'Three.')],
    }),
    /outside their immutable source set/u,
  );
});
