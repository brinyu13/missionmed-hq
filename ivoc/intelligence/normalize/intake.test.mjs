import assert from 'node:assert/strict';
import test from 'node:test';
import { intakeProjections, IntakeError, SUPPORTED_PROJECTION_TYPES } from './intake.mjs';
import { fixture } from '../test-helpers.mjs';

const NOW = '2026-09-18T12:00:00.000Z';
const SUBJECT = 'stu-fixture-0001';
const ALL = ['projections.filevault-cv.v1.json', 'projections.filevault-ps.v1.json', 'projections.filevault-mspe.v1.json',
  'projections.rise-program.v1.json', 'projections.storyforge.v1.json', 'projections.mcc-priorities.v1.json', 'projections.ivoc-longitudinal.v1.json'];

test('intake normalizes every supported projection type with provenance', async () => {
  const projections = await Promise.all(ALL.map(fixture));
  const result = intakeProjections(projections, { subject_id: SUBJECT, now: NOW });
  assert.equal(result.receipts.length, 7);
  assert.ok(result.facts.length >= 15);
  for (const fact of result.facts) {
    assert.equal(fact.subject_id, SUBJECT);
    assert.ok(fact.provenance.source_receipt_hash);
    assert.ok(result.receipts.some((r) => r.projection_id === fact.provenance.projection_id && r.source_version === fact.provenance.source_version));
  }
  assert.equal(result.program.program_ref, 'prog-cedar-valley-im');
  assert.equal(result.documents.length, 3);
  assert.ok(SUPPORTED_PROJECTION_TYPES.includes('filevault.document_projection'));
});

test('prohibited and unknown attributes are dropped and logged, never stored', async () => {
  const cv = await fixture('projections.filevault-cv.v1.json');
  const result = intakeProjections([cv], { subject_id: SUBJECT, now: NOW });
  const e7 = result.excluded.find((x) => x.normalized_key.endsWith(':entry:e7'));
  assert.deepEqual(e7.excluded, { ethnicity: 'prohibited_attribute', favorite_color: 'not_in_closed_schema' });
  assert.ok(!JSON.stringify(result.facts).includes('should-be-dropped'));
  const exam = result.facts.find((f) => f.fact_type === 'exam');
  assert.equal(exam.sensitivity, 'restricted');
  const obs = result.facts.find((f) => f.fact_type === 'clinical_experience');
  assert.equal(obs.attributes.duration_months, 2);
});

test('consent and sourcing laws: pending stories, unsourced program facts, non-recurring patterns are dropped', async () => {
  const [sf, rise, lon, mcc] = await Promise.all(['projections.storyforge.v1.json', 'projections.rise-program.v1.json', 'projections.ivoc-longitudinal.v1.json', 'projections.mcc-priorities.v1.json'].map(fixture));
  const result = intakeProjections([sf, rise, lon, mcc], { subject_id: SUBJECT, now: NOW });
  assert.equal(result.facts.filter((f) => f.fact_type === 'story_theme').length, 1);
  assert.ok(result.dropped_items.some((d) => d.reason === 'story_consent_not_granted'));
  assert.ok(result.dropped_items.some((d) => d.reason === 'unsourced_program_fact'));
  assert.ok(result.dropped_items.some((d) => d.reason === 'not_recurring'));
  const note = result.facts.find((f) => f.fact_type === 'mentor_priority' && f.attributes.visibility === 'mentor_only');
  assert.equal(note.student_visible, false);
  assert.equal(note.sensitivity, 'guarded');
  const noConsentBasis = structuredClone(sf);
  noConsentBasis.authorization = { basis: 'owner_policy', scope: ['stories'] };
  const r2 = intakeProjections([noConsentBasis], { subject_id: SUBJECT, now: NOW });
  assert.equal(r2.facts.length, 0);
  assert.ok(r2.dropped_items.some((d) => d.reason === 'storyforge_requires_student_consent_basis'));
});

test('fails closed: other subject, malformed envelope, unsupported type, duplicates, bad inputs', async () => {
  const cv = await fixture('projections.filevault-cv.v1.json');
  const other = await fixture('projections.other-subject.v1.json');
  assert.throws(() => intakeProjections([cv, other], { subject_id: SUBJECT, now: NOW }), (e) => e instanceof IntakeError && e.code === 'subject_mismatch');
  assert.throws(() => intakeProjections([{ ...cv, source_receipt: undefined }], { subject_id: SUBJECT, now: NOW }), (e) => e.code === 'malformed_projection');
  assert.throws(() => intakeProjections([{ ...cv, projection_type: 'unknown.thing' }], { subject_id: SUBJECT, now: NOW }), (e) => e.code === 'unsupported_projection_type');
  assert.throws(() => intakeProjections([cv, cv], { subject_id: SUBJECT, now: NOW }), (e) => e.code === 'duplicate_projection');
  assert.throws(() => intakeProjections('nope', { subject_id: SUBJECT, now: NOW }), (e) => e.code === 'invalid_input');
  assert.throws(() => intakeProjections([cv], { subject_id: SUBJECT, now: 'yesterday' }), (e) => e.code === 'invalid_input');
  const broken = structuredClone(cv);
  broken.payload.entries[0].entry_type = 'not_a_type';
  assert.throws(() => intakeProjections([broken], { subject_id: SUBJECT, now: NOW }), (e) => e.code === 'normalization_failed');
});

test('revocation, unavailability and freshness are honoured', async () => {
  const cv = await fixture('projections.filevault-cv.v1.json');
  const ps = await fixture('projections.filevault-ps.v1.json');
  const revoked = intakeProjections([cv, ps], { subject_id: SUBJECT, now: NOW, revoked: [cv.projection_id] });
  assert.deepEqual(revoked.dropped, [{ projection_id: cv.projection_id, reason: 'revoked' }]);
  assert.ok(revoked.facts.every((f) => f.provenance.projection_id !== cv.projection_id));
  const unavailable = structuredClone(ps);
  unavailable.degraded = { state: 'unavailable', reason: 'owner offline' };
  assert.equal(intakeProjections([unavailable], { subject_id: SUBJECT, now: NOW }).facts.length, 0);
  const stale = intakeProjections([cv], { subject_id: SUBJECT, now: '2027-06-01T00:00:00.000Z' });
  assert.ok(stale.facts.every((f) => f.stale === true));
  assert.equal(stale.receipts[0].degraded.state, 'stale');
});
