import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAT_DATASET_FIELDS,
} from '../src/contracts.mjs';
import {
  buildReleaseArtifacts,
  projectStatDatasetQuestion,
  scanForAnswerLeak,
} from '../src/exports.mjs';
import { canonicalJson, sha256, statPackHash } from '../src/hash.mjs';
import {
  detectQuestionCandidates,
  normalizeTranscriptArtifact,
  validateDraftCandidate,
  VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES,
} from '../src/pipeline.mjs';
import { QuestionPlatform } from '../src/platform.mjs';
import {
  REQUIRED_PRIVACY_EVALUATION_CLASSES,
  scorePrivacyAggregate,
} from '../src/privacy.mjs';
import { MemoryRepository } from '../src/store.mjs';

const actors = {
  admin: { id: 'actor_admin', roles: ['platform_admin', 'release_manager', 'author'] },
  author: { id: 'actor_author', roles: ['author'] },
  editor: { id: 'actor_editor', roles: ['editorial_reviewer'] },
  physician: { id: 'actor_physician', roles: ['physician_reviewer'] },
  validator: { id: 'actor_validator', roles: ['release_manager'] },
  ratifier: { id: 'actor_ratifier', roles: ['release_manager'] },
  publisher: { id: 'actor_publisher', roles: ['release_manager'] },
  reader: { id: 'actor_reader', roles: ['read_only'] },
};

function seedPlatform() {
  const repository = new MemoryRepository({ clock: () => '2026-07-13T12:00:00.000Z' });
  const platform = new QuestionPlatform({
    repository,
    credentialVerifier: ({ subject_actor_id: subjectActorId, claimed_credential: claimedCredential }) => ({
      verified: true,
      subject_actor_id: subjectActorId,
      type: claimedCredential.type,
      verification_id: `synthetic-verification-${subjectActorId}`,
      verified_at: '2026-07-13T12:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
    }),
  });
  platform.registerReviewer({
    actor_id: actors.editor.id,
    display_name: 'Synthetic Editor',
    roles: ['editorial_reviewer'],
    credential: { type: 'editorial', status: 'verified' },
  }, actors.admin, { id: 'reviewer_editor' });
  platform.registerReviewer({
    actor_id: actors.physician.id,
    display_name: 'Synthetic Physician',
    roles: ['physician_reviewer'],
    credential: { type: 'md', status: 'verified', expires_at: '2099-01-01T00:00:00.000Z' },
  }, actors.admin, { id: 'reviewer_physician' });
  platform.create('concepts', { title: 'Synthetic concept' }, actors.admin, { id: 'concept_test' });
  platform.create('variant_groups', { concept_id: 'concept_test', form: 'recall' }, actors.admin, { id: 'vg_test' });
  platform.create('items', { variant_group_id: 'vg_test', item_type: 'single_best_answer' }, actors.admin, { id: 'item_test' });
  repository.create('rights_records', {
    rights_status: 'cleared_for',
    allowed_uses: ['synthetic_fixture'],
  }, { id: 'rights_test', actorId: actors.admin.id });
  repository.create('privacy_redaction_records', {
    status: 'pass',
    required_class_metrics: {},
  }, { id: 'redact_test', actorId: actors.admin.id });
  repository.create('source_records', {
    source_type: 'AI_DRAFT',
    title: 'Synthetic source',
    source_hash: sha256('synthetic source'),
    rights_record_id: 'rights_test',
    privacy_redaction_record_id: 'redact_test',
  }, { id: 'src_test', actorId: actors.admin.id });
  repository.create('evidence_claims', {
    claim_text: 'Synthetic fixture maps square to beta.',
    authority_class: 'fixture_only',
    status: 'verified',
    source_record_ids: ['src_test'],
    expires_at: '2099-01-01T00:00:00.000Z',
  }, { id: 'claim_test', actorId: actors.admin.id });
  const revision = platform.createRevision({
    item_id: 'item_test',
    concept_id: 'concept_test',
    source_ids: ['src_test'],
    evidence_claim_ids: ['claim_test'],
    export_question_id: 'I1Q-PLATFORM-TEST-0001',
    prompt: 'Which label matches the square synthetic sample?',
    choices: [
      { key: 'A', text: 'Label alpha', why_tempting: 'Position bias', why_wrong: 'Not in fixture key', misconception_id: 'miscon_position' },
      { key: 'B', text: 'Label beta', why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'C', text: 'Label gamma', why_tempting: 'Adjacent row', why_wrong: 'Different row', misconception_id: 'miscon_adjacent' },
      { key: 'D', text: 'Label delta', why_tempting: 'Similar code', why_wrong: 'Different code', misconception_id: 'miscon_similar' },
    ],
    answer: 'B',
    explanation: 'The synthetic fixture maps square to label beta.',
    correct_answer_rationale: 'The fixture key identifies beta.',
    topic: 'Synthetic fixtures',
    subtopic: 'Classification',
    drills: {
      video_id: 'video_test',
      source_record_id: 'src_test',
      title: 'Synthetic platform test drill',
      playback: { availability: 'available', url: 'https://example.invalid/test/playback', stream_id: null },
      nodes: { availability: 'available', url: 'https://example.invalid/test/nodes.json' },
      transcript: { availability: 'missing', url: null },
      vtt: { availability: 'unknown', url: null },
      timestamp: { start_seconds: 0, end_seconds: 5 },
      rights_status: 'cleared_for',
      privacy_status: 'pass',
      source_hash: sha256('synthetic source'),
      working_hash: sha256('synthetic working source'),
    },
  }, actors.author, { idempotencyKey: 'revision-1' });
  return { platform, revision };
}

function passEditorial(platform, revision) {
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_editor',
    review_type: 'editorial',
  }, actors.admin);
  for (const toStatus of ['candidate', 'editorial_review', 'medical_review']) {
    platform.submitReviewEvent({
      item_revision_id: revision.id,
      reviewer_id: 'reviewer_editor',
      assignment_id: assignment.id,
      review_type: 'editorial',
      verdict: 'pass',
      to_status: toStatus,
      structured_findings: {},
    }, actors.editor);
  }
}

test('canonical hashing normalizes Unicode and object key order', () => {
  const left = { b: 'e\u0301', a: ['x', 1] };
  const right = { a: ['x', 1], b: '\u00e9' };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(sha256(left), sha256(right));
});

test('STAT fixed hash vector remains frozen', () => {
  assert.equal(statPackHash({
    datasetVersion: 'v4',
    questionIds: ['Q1', 'Q2', 'Q3'],
    choicesOrder: [
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
    ],
  }), '9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f');
});

test('STAT server projection is field-for-field exact', () => {
  const { revision } = seedPlatform();
  const row = projectStatDatasetQuestion({ revision, datasetVersion: 'i1q_fixture_v1', questionId: 'I1Q-000001' });
  assert.deepEqual(Object.keys(row), STAT_DATASET_FIELDS);
  assert.equal(row.answer, 'B');
});

test('single manifest emits answer-free pre-answer artifact', () => {
  const { revision } = seedPlatform();
  const first = buildReleaseArtifacts({ releaseId: 'release_a', datasetVersion: 'fixture_v1', revisions: [revision] });
  const second = buildReleaseArtifacts({ releaseId: 'release_a', datasetVersion: 'fixture_v1', revisions: [revision] });
  assert.equal(first.manifest.manifest_hash, second.manifest.manifest_hash);
  const preAnswer = first.artifacts.find((artifact) => artifact.channel === 'stat_pre_answer');
  assert.deepEqual(scanForAnswerLeak(preAnswer.payload), []);
  assert.equal(first.artifacts.filter((artifact) => artifact.channel === 'stat_dataset_questions').length, 1);
});

test('small privacy mechanics fixtures are class-complete but cannot claim release PASS', () => {
  const labels = REQUIRED_PRIVACY_EVALUATION_CLASSES
    .map((privacyClass, index) => ({ id: `label_${index}`, privacy_class: privacyClass }));
  const detections = labels.map((label) => ({ label_id: label.id, privacy_class: label.privacy_class }));
  const evaluated_counts = Object.fromEntries(
    REQUIRED_PRIVACY_EVALUATION_CLASSES.map((privacyClass) => [privacyClass, 1]),
  );
  const scored = scorePrivacyAggregate({ labels, detections, evaluated_counts });
  assert.equal(scored.status, 'INCOMPLETE');
  assert.deepEqual(Object.keys(scored.required_classes), REQUIRED_PRIVACY_EVALUATION_CLASSES);
  assert.equal(typeof scored.required_classes.PATIENT_DIRECT_IDENTIFIER.recall, 'number');
  assert.ok(scored.required_classes.PATIENT_DIRECT_IDENTIFIER.incomplete_reasons.includes('GOLD_MINIMUM_NOT_MET'));
});

test('missing required privacy class has explicit zero-denominator behavior', () => {
  const labels = REQUIRED_PRIVACY_EVALUATION_CLASSES
    .filter((privacyClass) => privacyClass !== 'PATIENT_DIRECT_IDENTIFIER')
    .map((privacyClass, index) => ({ id: `label_${index}`, privacy_class: privacyClass }));
  const evaluated_counts = Object.fromEntries(
    REQUIRED_PRIVACY_EVALUATION_CLASSES.map((privacyClass) => [privacyClass, 1]),
  );
  const scored = scorePrivacyAggregate({ labels, detections: [], evaluated_counts });
  assert.equal(scored.status, 'INCOMPLETE');
  assert.equal(scored.required_classes.PATIENT_DIRECT_IDENTIFIER.denominator, 0);
  assert.equal(scored.required_classes.PATIENT_DIRECT_IDENTIFIER.recall, 0);
  assert.ok(scored.required_classes.PATIENT_DIRECT_IDENTIFIER.incomplete_reasons.includes('ZERO_GOLD_POSITIVES'));
});

test('item revisions and audit events are immutable and audit chain verifies', () => {
  const { platform, revision } = seedPlatform();
  assert.throws(() => platform.update('item_revisions', revision.id, { prompt: 'Changed' }, actors.admin), /workflow_endpoint_required|immutable_entity/);
  assert.equal(platform.repository.verifyAuditChain(), true);
});

test('idempotent revision creation returns one exact result', () => {
  const { platform, revision } = seedPlatform();
  const page = platform.list('item_revisions', {}, actors.reader);
  assert.equal(page.total, 1);
  assert.equal(page.rows[0].id, revision.id);
});

test('workflow-managed entities reject generic create and update bypasses', () => {
  const { platform, revision } = seedPlatform();
  assert.throws(() => platform.create('review_events', { forged: true }, actors.admin), /workflow_endpoint_required/);
  assert.throws(() => platform.create('feature_flags', { key: 'student_release_enabled', enabled: true }, actors.admin), /workflow_endpoint_required/);
  assert.throws(() => platform.update('item_revisions', revision.id, { workflow_status: 'approved' }, actors.admin), /workflow_endpoint_required/);
});

test('private source references are hidden from ordinary internal readers', () => {
  const { platform } = seedPlatform();
  platform.repository.update('source_records', 'src_test', { private_storage_ref: 'private://fixture' }, { actorId: actors.admin.id });
  const readerView = platform.get('source_records', 'src_test', actors.reader);
  const adminView = platform.get('source_records', 'src_test', actors.admin);
  assert.equal(readerView.private_storage_ref, undefined);
  assert.equal(adminView.private_storage_ref, 'private://fixture');
});

test('medical approval cannot occur before editorial review', () => {
  const { platform, revision } = seedPlatform();
  platform.assignGovernanceSlot('medical_governance_lead', 'reviewer_physician', actors.admin);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    review_type: 'medical',
  }, actors.admin);
  assert.throws(() => platform.submitReviewEvent({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    assignment_id: assignment.id,
    review_type: 'medical',
    verdict: 'pass',
    to_status: 'approved',
  }, actors.physician), /illegal_revision_transition|medical_review_requires_editorial_pass/);
});

test('unassigned medical governance blocks exact approval', () => {
  const { platform, revision } = seedPlatform();
  passEditorial(platform, revision);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    review_type: 'medical',
  }, actors.admin);
  assert.throws(() => platform.submitReviewEvent({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    assignment_id: assignment.id,
    review_type: 'medical',
    verdict: 'pass',
    to_status: 'approved',
  }, actors.physician), /medical_governance_lead_unassigned/);
});

test('credentialed exact-revision approval enables assembly but not publication', () => {
  const { platform, revision } = seedPlatform();
  passEditorial(platform, revision);
  platform.assignGovernanceSlot('medical_governance_lead', 'reviewer_physician', actors.admin);
  platform.assignGovernanceSlot('release_manager', 'reviewer_editor', actors.admin);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    review_type: 'medical',
  }, actors.admin);
  platform.submitReviewEvent({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    assignment_id: assignment.id,
    review_type: 'medical',
    verdict: 'pass',
    to_status: 'approved',
  }, actors.physician);
  const assembled = platform.assembleRelease({ datasetVersion: 'fixture_v1', itemRevisionIds: [revision.id] }, actors.admin);
  assert.equal(assembled.release.state, 'assembled');
  assert.deepEqual(assembled.release.release_membership, assembled.release.manifest.release_membership);
  assert.equal(assembled.release.release_membership[0].question_id, revision.export_question_id);
  assert.equal(assembled.artifacts.some((artifact) => Object.hasOwn(artifact, 'payload')), false);
  const validation = platform.recordReleaseValidation(assembled.release.id, {
    manifest_hash: assembled.release.manifest.manifest_hash,
    evidence_hash: sha256('synthetic release validation evidence'),
    checks: [{ id: 'synthetic_release_suite', status: 'pass' }],
  }, actors.validator);
  platform.promoteRelease(assembled.release.id, {
    to_state: 'validated',
    manifest_hash: assembled.release.manifest.manifest_hash,
    validation_evidence_id: validation.id,
  }, actors.validator);
  platform.promoteRelease(assembled.release.id, {
    to_state: 'ratified',
    manifest_hash: assembled.release.manifest.manifest_hash,
    validation_evidence_id: validation.id,
  }, actors.ratifier);
  assert.throws(() => platform.promoteRelease(assembled.release.id, {
    to_state: 'published',
    manifest_hash: assembled.release.manifest.manifest_hash,
    validation_evidence_id: validation.id,
  }, actors.publisher), /student_release_feature_flag_disabled/);
  assert.throws(() => platform.artifactForPhase(assembled.release.id, 'stat_post_answer_debrief', 'pre_answer', actors.admin), /finalization_required/);
});

test('retracted claims and restricted rights block release assembly', () => {
  const { platform, revision } = seedPlatform();
  passEditorial(platform, revision);
  platform.assignGovernanceSlot('medical_governance_lead', 'reviewer_physician', actors.admin);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    review_type: 'medical',
  }, actors.admin);
  platform.submitReviewEvent({
    item_revision_id: revision.id,
    reviewer_id: 'reviewer_physician',
    assignment_id: assignment.id,
    review_type: 'medical',
    verdict: 'pass',
    to_status: 'approved',
  }, actors.physician);
  platform.repository.update('evidence_claims', 'claim_test', { status: 'retracted' }, { actorId: actors.admin.id });
  assert.throws(() => platform.assembleRelease({ datasetVersion: 'fixture_bad_claim', itemRevisionIds: [revision.id] }, actors.admin), /claim_not_verified/);
  platform.repository.update('evidence_claims', 'claim_test', { status: 'verified' }, { actorId: actors.admin.id });
  platform.repository.update('rights_records', 'rights_test', { rights_status: 'restricted' }, { actorId: actors.admin.id });
  assert.throws(() => platform.assembleRelease({ datasetVersion: 'fixture_bad_rights', itemRevisionIds: [revision.id] }, actors.admin), /source_rights_not_cleared/);
});

test('pipeline normalizes, redacts, and never auto-approves', () => {
  const speakerLabel = 'SYNTHETIC_PLATFORM_DRJ_LABEL';
  const segments = normalizeTranscriptArtifact({
    drj_speaker_labels: [speakerLabel],
    video_id: 'video_fixture',
    transcript_id: 'transcript_fixture',
    source_attribution: 'verified_drj',
    source_hash: sha256('fixture source'),
    working_source_ref: `working_source_ref_${sha256('fixture working mapping').slice(0, 20)}`,
    segments: [{
      text: 'Which [PATIENT_IDENTIFIER:SYNTHETIC_PATIENT] coded symbol applies?',
      start_time: 0,
      end_time: 4,
      speaker: speakerLabel,
      speaker_attribution: 'verified_drj',
      speaker_evidence: {
        authority_class: VERIFIED_DRJ_SPEAKER_AUTHORITY_CLASSES[0],
        mapping_sha256: sha256('synthetic platform speaker mapping'),
      },
      speaker_role: 'drj',
    }],
  });
  assert.match(segments[0].redacted_text, /REDACTED_PATIENT_DIRECT_IDENTIFIER/);
  const candidates = detectQuestionCandidates(segments, {
    classifyMedical: () => ({ medical: true, confidence: 0.9 }),
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].lineage, 'AI_DRAFT_NOT_MEDICALLY_VALIDATED');
  assert.deepEqual(validateDraftCandidate(candidates[0]), []);
});

test('nested answer aliases are detected in pre-answer payloads', () => {
  assert.deepEqual(scanForAnswerLeak({ debug: { answerKey: 'B' } }), ['$.debug.answerKey']);
  assert.deepEqual(scanForAnswerLeak({ choices: ['A', 'B'] }), []);
});
