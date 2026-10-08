import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_CATEGORIES, APPROVAL_STATES, IDENTITY_CONFIDENCE, LICENSE_STATES, MEDIA_SCHEMA,
  parseMediaCandidate, canTransition, transitionMedia, heroEligible, heroFor, programMediaProjection, PROMOTION_PROPOSAL,
} from '../../server/program-media.mjs';

const base = () => ({
  sourceUrl: 'https://www.example-hospital.org/about/campus',
  publisher: 'Example Hospital',
  assetRef: 'https://cdn.example-hospital.org/images/main-entrance.jpg',
  programId: 'rise_example_im_cat',
  registryReleaseId: 'registry-v1',
  category: 'INSTITUTION_EXTERIOR',
  caption: 'Main entrance',
  alt: 'Main entrance of Example Hospital',
  verifiedAt: '2026-10-01',
  identityConfidence: 'VERIFIED',
  licenseState: 'PUBLISHER_TERMS',
});

// ── constants ───────────────────────────────────────────────────────
test('constants are frozen and contain expected members', () => {
  assert.ok(Object.isFrozen(MEDIA_CATEGORIES) && MEDIA_CATEGORIES.includes('INSTITUTION_EXTERIOR'));
  assert.ok(Object.isFrozen(APPROVAL_STATES) && APPROVAL_STATES.includes('APPROVED') && APPROVAL_STATES.includes('CANDIDATE'));
  assert.ok(IDENTITY_CONFIDENCE.includes('VERIFIED') && LICENSE_STATES.includes('NOT_PERMITTED'));
  assert.equal(MEDIA_SCHEMA, 'iiq-program-media-candidate-v1');
});

// ── parseMediaCandidate ─────────────────────────────────────────────
test('parseMediaCandidate accepts a complete candidate and defaults approval to CANDIDATE', () => {
  const c = parseMediaCandidate(base());
  assert.equal(c.schema, MEDIA_SCHEMA);
  assert.equal(c.approvalState, 'CANDIDATE');
  assert.equal(c.discoveredBy, 'RESEARCH');
  assert.ok(Object.isFrozen(c));
});

test('parseMediaCandidate preserves provenance fields verbatim', () => {
  const c = parseMediaCandidate(base());
  assert.equal(c.sourceUrl, 'https://www.example-hospital.org/about/campus');
  assert.equal(c.publisher, 'Example Hospital');
  assert.equal(c.assetRef, 'https://cdn.example-hospital.org/images/main-entrance.jpg');
  assert.equal(c.programId, 'rise_example_im_cat');
  assert.equal(c.verifiedAt, '2026-10-01');
  assert.equal(c.licenseState, 'PUBLISHER_TERMS');
});

test('parseMediaCandidate rejects http (non-https) asset and source URLs', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), assetRef: 'http://cdn.example.org/a.jpg' }), { code: 'invalid_url' });
  assert.throws(() => parseMediaCandidate({ ...base(), sourceUrl: 'ftp://example.org' }), { code: 'invalid_url' });
  assert.throws(() => parseMediaCandidate({ ...base(), sourceUrl: 'not a url' }), { code: 'invalid_url' });
});

test('parseMediaCandidate rejects URLs with embedded credentials', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), assetRef: 'https://user:pw@cdn.example.org/a.jpg' }), { code: 'invalid_url' });
});

test('parseMediaCandidate requires a canonical RISE program identifier', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), programId: 'Mayo Clinic' }), { code: 'invalid_identifier' });
  assert.throws(() => parseMediaCandidate({ ...base(), programId: '' }), { code: 'invalid_identifier' });
  assert.throws(() => parseMediaCandidate({ ...base(), programId: undefined }), { code: 'invalid_identifier' });
});

test('parseMediaCandidate requires YYYY-MM-DD verification date', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), verifiedAt: '10/01/2026' }), { code: 'invalid_date' });
  assert.throws(() => parseMediaCandidate({ ...base(), verifiedAt: '2026-13-45' }), { code: 'invalid_date' });
});

test('parseMediaCandidate rejects unknown category and unexpected fields', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), category: 'SELFIE' }), { code: 'invalid_choice' });
  assert.throws(() => parseMediaCandidate({ ...base(), extra: true }), { code: 'unexpected_fields' });
});

test('parseMediaCandidate requires alt text and publisher', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), alt: '' }), { code: 'invalid_text' });
  assert.throws(() => parseMediaCandidate({ ...base(), publisher: '   ' }), { code: 'invalid_text' });
});

test('parseMediaCandidate refuses to record APPROVED without verified identity or known license', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), approvalState: 'APPROVED', identityConfidence: 'LOW' }), { code: 'media_not_approvable' });
  assert.throws(() => parseMediaCandidate({ ...base(), approvalState: 'APPROVED', licenseState: 'UNKNOWN' }), { code: 'media_not_approvable' });
  assert.throws(() => parseMediaCandidate({ ...base(), approvalState: 'APPROVED', licenseState: 'NOT_PERMITTED' }), { code: 'media_not_approvable' });
  assert.doesNotThrow(() => parseMediaCandidate({ ...base(), approvalState: 'APPROVED' }));
});

test('parseMediaCandidate rejects wrong schema and prototype-pollution keys', () => {
  assert.throws(() => parseMediaCandidate({ ...base(), schema: 'other' }), { code: 'invalid_schema' });
  assert.throws(() => parseMediaCandidate(JSON.parse('{"__proto__":{"x":1}}')), { code: 'invalid_object' });
});

// ── transitions ─────────────────────────────────────────────────────
test('canTransition encodes the approval state machine', () => {
  assert.equal(canTransition('CANDIDATE', 'UNDER_REVIEW'), true);
  assert.equal(canTransition('CANDIDATE', 'APPROVED'), false, 'no direct candidate→approved');
  assert.equal(canTransition('UNDER_REVIEW', 'APPROVED'), true);
  assert.equal(canTransition('APPROVED', 'WITHDRAWN'), true);
  assert.equal(canTransition('WITHDRAWN', 'APPROVED'), false);
  assert.equal(canTransition('nope', 'APPROVED'), false);
});

test('transitionMedia requires a named human decision', () => {
  const c = parseMediaCandidate(base());
  assert.throws(() => transitionMedia(c, 'UNDER_REVIEW'), { code: 'decision_required' });
  assert.throws(() => transitionMedia(c, 'UNDER_REVIEW', { decidedBy: '  ' }), { code: 'decision_required' });
});

test('transitionMedia enforces legal transitions with 409', () => {
  const c = parseMediaCandidate(base());
  assert.throws(() => transitionMedia(c, 'APPROVED', { decidedBy: 'admin' }), { code: 'invalid_transition', status: 409 });
});

test('transitionMedia records the decision and new state without mutating the input', () => {
  const c = parseMediaCandidate(base());
  const r = transitionMedia(c, 'UNDER_REVIEW', { decidedBy: 'Dr Brian', reason: 'looks right' });
  assert.equal(r.approvalState, 'UNDER_REVIEW');
  assert.equal(c.approvalState, 'CANDIDATE');
  assert.deepEqual(r.decision, { by: 'Dr Brian', reason: 'looks right', from: 'CANDIDATE', to: 'UNDER_REVIEW' });
  const a = transitionMedia(r, 'APPROVED', { decidedBy: 'Dr Brian' });
  assert.equal(a.approvalState, 'APPROVED');
});

test('transitionMedia refuses APPROVED when identity or license is not established', () => {
  const c = transitionMedia(parseMediaCandidate({ ...base(), identityConfidence: 'MEDIUM' }), 'UNDER_REVIEW', { decidedBy: 'a' });
  assert.throws(() => transitionMedia(c, 'APPROVED', { decidedBy: 'a' }), { code: 'media_not_approvable' });
});

// ── hero projection ─────────────────────────────────────────────────
test('heroEligible only for approved institution exteriors matched to the exact program', () => {
  const approved = parseMediaCandidate({ ...base(), approvalState: 'APPROVED' });
  assert.equal(heroEligible(approved, 'rise_example_im_cat'), true);
  assert.equal(heroEligible(approved, 'rise_other_program'), false, 'never an unrelated hospital');
  assert.equal(heroEligible(parseMediaCandidate(base()), 'rise_example_im_cat'), false, 'candidate not approved');
  assert.equal(heroEligible(parseMediaCandidate({ ...base(), approvalState: 'APPROVED', category: 'LOGO' }), 'rise_example_im_cat'), false);
  assert.equal(heroEligible(null, 'rise_example_im_cat'), false);
});

test('heroFor returns the best eligible hero with provenance and null when none', () => {
  const a = parseMediaCandidate({ ...base(), approvalState: 'APPROVED', identityConfidence: 'HIGH', verifiedAt: '2026-09-01' });
  const b = parseMediaCandidate({ ...base(), approvalState: 'APPROVED', identityConfidence: 'VERIFIED', verifiedAt: '2026-08-01', assetRef: 'https://cdn.example-hospital.org/images/b.jpg' });
  const h = heroFor([a, b], 'rise_example_im_cat');
  assert.equal(h.url, 'https://cdn.example-hospital.org/images/b.jpg', 'VERIFIED outranks HIGH');
  assert.equal(h.publisher, 'Example Hospital');
  assert.equal(h.sourceUrl, base().sourceUrl);
  assert.equal(heroFor([parseMediaCandidate(base())], 'rise_example_im_cat'), null);
  assert.equal(heroFor(null, 'rise_example_im_cat'), null);
});

test('programMediaProjection groups approved heroes by program and skips the rest', () => {
  const ok = parseMediaCandidate({ ...base(), approvalState: 'APPROVED' });
  const other = parseMediaCandidate({ ...base(), approvalState: 'APPROVED', programId: 'rise_other_program' });
  const pending = parseMediaCandidate(base());
  const p = programMediaProjection([ok, other, pending, null]);
  assert.deepEqual(Object.keys(p).sort(), ['rise_example_im_cat', 'rise_other_program']);
  assert.equal(p.rise_example_im_cat.length, 1);
  assert.equal(Object.getPrototypeOf(p), null);
});

// ── promotion proposal ──────────────────────────────────────────────
test('PROMOTION_PROPOSAL documents the protected owner action and is not wired', () => {
  assert.equal(PROMOTION_PROPOSAL.owner, 'RISE');
  assert.ok(PROMOTION_PROPOSAL.status.startsWith('SOURCE_CANDIDATE_DEFAULT_OFF'));
  assert.ok(PROMOTION_PROPOSAL.payload.includes('decision') && PROMOTION_PROPOSAL.payload.includes('sourceUrl'));
  assert.ok(Object.isFrozen(PROMOTION_PROPOSAL));
});
