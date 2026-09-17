import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuestionPlatformServer } from '../src/server.mjs';
import {
  IDENTITY_CONTRACT_VERSION,
  REQUIRED_RELEASE_VALIDATION_CHECK_IDS,
} from '../src/contracts.mjs';
import { releaseValidationEvidenceHash } from '../src/exports.mjs';
import { QuestionPlatform } from '../src/platform.mjs';
import { sha256 } from '../src/hash.mjs';
import { MemoryRepository } from '../src/store.mjs';

const TRUSTED_ORIGIN = 'https://internal.missionmed.example';
const CSRF_TOKEN = 'synthetic-csrf-token-for-security-tests';

const actors = Object.freeze({
  admin: Object.freeze({ id: 'actor_admin_security', roles: ['platform_admin', 'editorial_reviewer', 'release_manager'] }),
  author: Object.freeze({ id: 'actor_author_security', roles: ['author'] }),
  editor: Object.freeze({ id: 'actor_editor_security', roles: ['editorial_reviewer'] }),
  reader: Object.freeze({ id: 'actor_reader_security', roles: ['read_only'] }),
  assembler: Object.freeze({ id: 'actor_assembler_security', roles: ['release_manager'] }),
  validator: Object.freeze({ id: 'actor_validator_security', roles: ['release_manager'] }),
  ratifier: Object.freeze({ id: 'actor_ratifier_security', roles: ['physician_reviewer'] }),
});

async function withServer(options, operation) {
  const server = createQuestionPlatformServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function identityContext(actor = actors.reader, overrides = {}) {
  const now = Date.now();
  const session = {
    id: 'session_security_fixture',
    expires_at: new Date(now + 60_000).toISOString(),
    validated_at: new Date(now).toISOString(),
    revoked: false,
    ...(overrides.session || {}),
  };
  const requestSecurity = {
    session_id: session.id,
    csrf_token: CSRF_TOKEN,
    trusted_origins: [TRUSTED_ORIGIN],
    ...(overrides.request_security || {}),
  };
  return {
    validated: true,
    actor,
    session,
    identity: {
      contract_version: IDENTITY_CONTRACT_VERSION,
      canonical_actor_id: actor.id,
      supabase_user_id: actor.id,
      active: true,
      revoked: false,
    },
    request_security: requestSecurity,
    ...overrides,
    ...(overrides.session === null ? { session: null } : { session }),
    ...(overrides.request_security === null ? { request_security: null } : { request_security: requestSecurity }),
  };
}

function mutationHeaders(overrides = {}) {
  return {
    'Content-Type': 'application/json',
    Origin: TRUSTED_ORIGIN,
    'X-CSRF-Token': CSRF_TOKEN,
    ...overrides,
  };
}

function syntheticDrills(suffix = 'security') {
  return {
    video_id: `video_${suffix}`,
    source_record_id: `src_${suffix}`,
    title: `Synthetic drill ${suffix}`,
    playback: {
      availability: 'available',
      url: `https://example.invalid/${suffix}/playback`,
      stream_id: null,
    },
    nodes: {
      availability: 'available',
      url: `https://example.invalid/${suffix}/nodes.json`,
    },
    transcript: { availability: 'missing', url: null },
    vtt: { availability: 'unknown', url: null },
    timestamp: { start_seconds: 10, end_seconds: 20 },
    rights_status: 'cleared_for',
    privacy_status: 'pass_with_redactions',
    source_hash: sha256(`source_${suffix}`),
    working_hash: sha256(`working_${suffix}`),
  };
}

function revisionPayload(suffix = 'security', overrides = {}) {
  return {
    item_id: `item_${suffix}`,
    concept_id: `concept_${suffix}`,
    source_ids: [`src_${suffix}`],
    evidence_claim_ids: [`claim_${suffix}`],
    prompt: `Which label matches synthetic fixture ${suffix}?`,
    choices: [
      { key: 'A', text: `Alpha ${suffix}`, why_tempting: 'Position lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_alpha' },
      { key: 'B', text: `Beta ${suffix}`, why_tempting: null, why_wrong: null, misconception_id: null },
      { key: 'C', text: `Gamma ${suffix}`, why_tempting: 'Adjacent lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_gamma' },
      { key: 'D', text: `Delta ${suffix}`, why_tempting: 'Ordering lure', why_wrong: 'Synthetic mismatch', misconception_id: 'miscon_delta' },
    ],
    answer: 'B',
    explanation: `SECRET_EXPLANATION_${suffix}`,
    correct_answer_rationale: `SECRET_CORRECT_RATIONALE_${suffix}`,
    topic: 'Synthetic security fixtures',
    subtopic: 'Authorization',
    drills: syntheticDrills(suffix),
    ...structuredClone(overrides),
  };
}

function seedRevisionDependencies(repository, suffix = 'security') {
  repository.create('concepts', { title: `Concept ${suffix}` }, { id: `concept_${suffix}` });
  repository.create('items', { item_type: 'single_best_answer' }, { id: `item_${suffix}` });
  repository.create('source_records', {
    source_type: 'AI_DRAFT',
    source_hash: sha256(`source_${suffix}`),
  }, { id: `src_${suffix}` });
  repository.create('evidence_claims', {
    status: 'fixture_only',
    source_record_ids: [`src_${suffix}`],
  }, { id: `claim_${suffix}` });
}

function seedAnswerBearingRevision(repository, suffix = 'read') {
  return repository.create('item_revisions', {
    ...revisionPayload(suffix),
    export_question_id: `I1Q-SECURITY-${suffix.toUpperCase()}`,
    author_actor_id: actors.author.id,
    revision_number: 1,
    workflow_status: 'draft',
    debug: {
      answerKey: 'B',
      solution: `SECRET_SOLUTION_${suffix}`,
    },
  }, { id: `itemrev_${suffix}`, actorId: actors.author.id });
}

function enableSyntheticFlag(repository, key) {
  repository.create('feature_flags', { key, enabled: true }, { id: `flag_${key}` });
}

function seedEditorialReview({ accepted = true, internalReviewEnabled = true } = {}) {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  seedRevisionDependencies(repository, 'review_content');
  const reviewer = platform.registerReviewer({
    actor_id: actors.editor.id,
    display_name: 'Synthetic Protected Content Reviewer',
    roles: ['editorial_reviewer'],
    credential: { type: 'editorial', status: 'verified' },
  }, actors.admin, { id: 'reviewer_protected_content' });
  const revision = platform.createRevision(
    revisionPayload('review_content'),
    actors.author,
    { idempotencyKey: 'protected-review-content-revision' },
  );
  platform.submitRevisionCandidate(revision.id, actors.author);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: reviewer.id,
    review_type: 'editorial',
  }, actors.admin);
  if (accepted) {
    platform.acceptReviewAssignment(assignment.id, actors.editor);
  }
  enableSyntheticFlag(repository, 'internal_platform_enabled');
  if (internalReviewEnabled) {
    enableSyntheticFlag(repository, 'internal_review_enabled');
  }
  return { repository, platform, revision, reviewer, assignment };
}

test('ordinary resource GET and list are answer-free and generic artifacts stay protected', async () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  const revision = seedAnswerBearingRevision(repository, 'read');
  repository.create('channel_artifacts', {
    release_id: 'release_read',
    channel: 'stat_dataset_questions',
    phase: 'server_only',
    payload: [{ answer: 'B', explanation: 'SECRET_ARTIFACT_EXPLANATION' }],
  }, { id: 'artifact_read' });

  assert.throws(() => platform.get('item_revisions', revision.id, actors.reader), /resource_not_permitted/);
  assert.equal(platform.list('item_revisions', {}, actors.reader).total, 0);
  for (const view of [platform.get('item_revisions', revision.id, actors.author)]) {
    const serialized = JSON.stringify(view);
    assert.equal(view.answer, undefined);
    assert.equal(view.explanation, undefined);
    assert.deepEqual(view.choices.map((choice) => Object.keys(choice)), [
      ['key', 'text'], ['key', 'text'], ['key', 'text'], ['key', 'text'],
    ]);
    assert.doesNotMatch(serialized, /SECRET_|answerKey|why_wrong|why_tempting|misconception_id/u);
  }
  assert.throws(
    () => platform.get('channel_artifacts', 'artifact_read', actors.assembler),
    /protected_route_required/,
  );
  enableSyntheticFlag(repository, 'stat_adapter_enabled');
  assert.equal(
    platform.artifactForPhase('release_read', 'stat_dataset_questions', null, actors.assembler).payload[0].answer,
    'B',
  );

  await withServer({
    platform,
    identityResolver: async () => identityContext(actors.reader),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/resources/item_revisions/${revision.id}`);
    assert.equal(response.status, 403);
  });
});

test('identity contract version and canonical actor are mandatory at the server boundary', async (t) => {
  const cases = [
    ['missing identity', { identity: null }],
    ['wrong version', { identity: {
      contract_version: 'i1q.identity.v0',
      canonical_actor_id: actors.reader.id,
      supabase_user_id: actors.reader.id,
      active: true,
      revoked: false,
    } }],
    ['wrong canonical actor', { identity: {
      contract_version: IDENTITY_CONTRACT_VERSION,
      canonical_actor_id: 'actor_other_security',
      supabase_user_id: actors.reader.id,
      active: true,
      revoked: false,
    } }],
  ];
  for (const [name, override] of cases) {
    await t.test(name, async () => {
      await withServer({
        identityResolver: async () => identityContext(actors.reader, override),
      }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/session`);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: 'authentication_required' });
      });
    });
  }
});

test('static serving rejects normalized paths outside the public directory', async () => {
  await withServer({ localDemo: true }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/..%2Fpublic_evil%2Findex.html`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found' });
  });
});

test('local demo is forbidden for normalized production environment values', () => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = ' Production ';
  try {
    assert.throws(
      () => createQuestionPlatformServer({ localDemo: true }),
      /local_demo_forbidden/,
    );
  } finally {
    if (original === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = original;
    }
  }
});

test('caller phase strings cannot unlock post-answer artifacts and participant proof is server supplied', async () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  repository.create('channel_artifacts', {
    release_id: 'release_phase',
    channel: 'stat_post_answer_debrief',
    phase: 'post_answer',
    payload: [{ answer: 'B', explanation: 'Synthetic debrief' }],
  }, { id: 'artifact_phase' });
  enableSyntheticFlag(repository, 'internal_platform_enabled');
  enableSyntheticFlag(repository, 'stat_adapter_enabled');

  assert.throws(
    () => platform.artifactForPhase(
      'release_phase',
      'stat_post_answer_debrief',
      'post_answer_finalized',
      actors.reader,
    ),
    /finalization_required/,
  );

  await withServer({
    platform,
    identityResolver: async () => identityContext(actors.reader),
  }, async (baseUrl) => {
    const spoofed = await fetch(`${baseUrl}/api/v1/releases/release_phase/artifacts/stat_post_answer_debrief?phase=post_answer_finalized`);
    assert.equal(spoofed.status, 403);
    assert.equal((await spoofed.json()).error, 'finalization_required');
  });

  await withServer({
    platform,
    identityResolver: async () => identityContext(actors.reader),
    finalizationResolver: async ({ identityContext: trustedIdentity, releaseId, channel }) => ({
      authorized: true,
      state: 'finalized',
      release_id: releaseId,
      channel,
      session_id: trustedIdentity.session.id,
      actor_id: trustedIdentity.actor.id,
      scope: 'participant',
    }),
  }, async (baseUrl) => {
    const authorized = await fetch(`${baseUrl}/api/v1/releases/release_phase/artifacts/stat_post_answer_debrief`);
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).payload[0].answer, 'B');
  });
});

test('review events reject administrator impersonation, assignment-type swaps, and revision hash swaps', () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  const revision = seedAnswerBearingRevision(repository, 'review');
  const reviewer = platform.registerReviewer({
    actor_id: actors.editor.id,
    display_name: 'Synthetic Editorial Reviewer',
    roles: ['editorial_reviewer'],
    credential: { type: 'editorial', status: 'verified' },
  }, actors.admin, { id: 'reviewer_editor_security' });
  platform.submitRevisionCandidate(revision.id, actors.author);
  const assignment = platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: reviewer.id,
    review_type: 'editorial',
  }, actors.admin);
  platform.acceptReviewAssignment(assignment.id, actors.editor);
  const baseEvent = {
    item_revision_id: revision.id,
    reviewer_id: reviewer.id,
    assignment_id: assignment.id,
    review_type: 'editorial',
    verdict: 'pass',
    to_status: 'candidate',
  };

  assert.throws(() => platform.submitReviewEvent(baseEvent, actors.admin), /reviewer_actor_mismatch/);
  assert.throws(() => platform.submitReviewEvent({
    ...baseEvent,
    exact_revision_hash: '0'.repeat(64),
  }, actors.editor), /review_revision_hash_mismatch/);

  const wrongTypeAssignment = repository.create('review_assignments', {
    item_revision_id: revision.id,
    reviewer_id: reviewer.id,
    reviewer_actor_id: reviewer.actor_id,
    review_type: 'medical',
    required_role: 'editorial_reviewer',
    exact_revision_hash: revision.content_hash,
    credential_status: 'not_applicable',
    credential_verification_id: null,
    state: 'accepted',
  }, { id: 'assign_wrong_type_security' });
  assert.throws(() => platform.submitReviewEvent({
    ...baseEvent,
    assignment_id: wrongTypeAssignment.id,
  }, actors.editor), /assignment_type_mismatch/);
});

test('self-asserted medical credentials stay unverified without the trusted verifier boundary', () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  const fabricated = platform.registerReviewer({
    actor_id: 'actor_fabricated_medical',
    display_name: 'Synthetic Unverified Medical Claim',
    roles: ['physician_reviewer'],
    credential: {
      type: 'md',
      status: 'verified',
      verification_id: 'caller-controlled',
      expires_at: '2099-01-01T00:00:00.000Z',
    },
  }, actors.admin, { id: 'reviewer_fabricated_medical' });
  assert.equal(fabricated.credential.status, 'unverified');
  assert.equal(fabricated.credential.verification_id, null);
  assert.throws(
    () => platform.assignGovernanceSlot('medical_governance_lead', fabricated.id, actors.admin),
    /medical_governance_credential_not_verified/,
  );

  const revision = seedAnswerBearingRevision(repository, 'fabricated');
  assert.throws(() => platform.createReviewAssignment({
    item_revision_id: revision.id,
    reviewer_id: fabricated.id,
    review_type: 'medical',
  }, actors.admin), /physician_credential_not_verified/);
});

test('release validation and ratification require exact evidence and independent actors', () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({
    repository,
    credentialVerifier: ({ subject_actor_id: subjectActorId, claimed_credential: credential }) => ({
      verified: true,
      subject_actor_id: subjectActorId,
      type: credential.type,
      verification_id: `synthetic-security-verification-${subjectActorId}`,
      verified_at: '2026-07-15T00:00:00.000Z',
      expires_at: '2099-01-01T00:00:00.000Z',
    }),
  });
  const governanceLead = platform.registerReviewer({
    actor_id: actors.ratifier.id,
    display_name: 'Synthetic Medical Governance Lead',
    roles: ['physician_reviewer'],
    credential: { type: 'md', status: 'verified', expires_at: '2099-01-01T00:00:00.000Z' },
  }, actors.admin, { id: 'reviewer_release_ratifier' });
  platform.assignGovernanceSlot('medical_governance_lead', governanceLead.id, actors.admin);
  const manifestHash = 'a'.repeat(64);
  const artifact = repository.create('channel_artifacts', {
    release_id: 'release_separation',
    channel: 'stat_pre_answer',
    phase: 'pre_answer',
    data_class: 'A',
    sha256: 'd'.repeat(64),
    record_count: 1,
    payload: [{ question_id: 'Q1' }],
  }, { id: 'artifact_separation' });
  const release = repository.create('release_snapshots', {
    release_id: 'release_separation',
    dataset_version: 'fixture_security_v1',
    state: 'assembled',
    item_revision_ids: [],
    release_membership: [],
    manifest: {
      manifest_hash: manifestHash,
      release_membership: [],
      artifact_hashes: [{
        channel: artifact.channel,
        phase: artifact.phase,
        data_class: artifact.data_class,
        sha256: artifact.sha256,
        record_count: artifact.record_count,
      }],
    },
    assembled_by_actor_id: actors.assembler.id,
  }, { id: 'release_separation', actorId: actors.assembler.id });
  const evidenceInput = {
    manifest_hash: manifestHash,
    evidence_hash: '',
    checks: REQUIRED_RELEASE_VALIDATION_CHECK_IDS.map((id) => ({ id, status: 'pass' })),
  };
  evidenceInput.evidence_hash = releaseValidationEvidenceHash({
    releaseId: release.id,
    manifestHash,
    artifacts: [artifact],
    checks: evidenceInput.checks,
  });

  assert.throws(() => platform.recordReleaseValidation(release.id, {
    ...evidenceInput,
    checks: evidenceInput.checks.slice(0, 5),
  }, actors.validator), /official_validator_checks_required/);
  assert.throws(() => platform.recordReleaseValidation(release.id, {
    ...evidenceInput,
    checks: [...evidenceInput.checks.slice(0, 5), evidenceInput.checks[0]],
  }, actors.validator), /official_validator_checks_required/);
  assert.throws(() => platform.recordReleaseValidation(release.id, {
    ...evidenceInput,
    evidence_hash: 'f'.repeat(64),
  }, actors.validator), /validator_evidence_hash_mismatch/);

  assert.throws(
    () => platform.recordReleaseValidation(release.id, evidenceInput, actors.assembler),
    /release_actor_separation_required/,
  );
  const evidence = platform.recordReleaseValidation(release.id, evidenceInput, actors.validator);
  assert.throws(() => platform.promoteRelease(release.id, {
    to_state: 'validated',
    manifest_hash: 'c'.repeat(64),
    validation_evidence_id: evidence.id,
  }, actors.validator), /manifest_hash_mismatch/);
  assert.throws(() => platform.promoteRelease(release.id, {
    to_state: 'validated',
    manifest_hash: manifestHash,
  }, actors.validator), /validator_evidence_required/);
  platform.promoteRelease(release.id, {
    to_state: 'validated',
    manifest_hash: manifestHash,
    validation_evidence_id: evidence.id,
  }, actors.validator);
  assert.throws(() => platform.promoteRelease(release.id, {
    to_state: 'ratified',
    manifest_hash: manifestHash,
    validation_evidence_id: evidence.id,
  }, actors.validator), /medical_governance_actor_mismatch/);
  platform.promoteRelease(release.id, {
    to_state: 'ratified',
    manifest_hash: manifestHash,
    validation_evidence_id: evidence.id,
  }, actors.ratifier);
  assert.throws(
    () => platform.setFeatureFlag('student_release_enabled', true, {}, actors.admin),
    /feature_flag_locked_off/,
  );
  assert.throws(
    () => platform.setFeatureFlag('student_content_enabled', true, {}, actors.admin),
    /feature_flag_locked_off/,
  );
});

test('resolver-backed mutations require a session-bound CSRF token and trusted Origin', async () => {
  const repository = new MemoryRepository();
  enableSyntheticFlag(repository, 'internal_platform_enabled');
  const platform = new QuestionPlatform({ repository });
  await withServer({
    platform,
    identityResolver: async () => identityContext(actors.admin),
  }, async (baseUrl) => {
    const body = JSON.stringify({ title: 'Synthetic CSRF concept' });
    const missingToken = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: mutationHeaders({ 'X-CSRF-Token': '' }),
      body,
    });
    assert.equal(missingToken.status, 403);
    assert.equal((await missingToken.json()).error, 'request_verification_failed');

    const mismatchedToken = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: mutationHeaders({ 'X-CSRF-Token': 'mismatched-csrf-token' }),
      body,
    });
    assert.equal(mismatchedToken.status, 403);

    const untrustedOrigin = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: mutationHeaders({ Origin: 'https://untrusted.example' }),
      body,
    });
    assert.equal(untrustedOrigin.status, 403);

    const accepted = await fetch(`${baseUrl}/api/v1/resources/concepts`, {
      method: 'POST',
      headers: mutationHeaders(),
      body,
    });
    assert.equal(accepted.status, 201);
  });
});

test('session bootstrap is available while internal platform and review routes stay feature gated', async () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  await withServer({
    platform,
    identityResolver: async () => identityContext(actors.admin),
  }, async (baseUrl) => {
    const sessionResponse = await fetch(`${baseUrl}/api/v1/session`);
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    assert.equal(session.actor.id, actors.admin.id);
    assert.equal(session.session.csrf_token, CSRF_TOKEN);

    const blockedDashboard = await fetch(`${baseUrl}/api/v1/dashboard`);
    assert.equal(blockedDashboard.status, 403);
    assert.equal((await blockedDashboard.json()).error, 'internal_platform_disabled');

    repository.create('feature_flags', {
      key: 'internal_platform_enabled',
      enabled: true,
    }, { id: 'flag_internal_platform_test' });
    const dashboard = await fetch(`${baseUrl}/api/v1/dashboard`);
    assert.equal(dashboard.status, 200);

    const blockedReview = await fetch(`${baseUrl}/api/v1/review-assignments`, {
      method: 'POST',
      headers: mutationHeaders(),
      body: '{}',
    });
    assert.equal(blockedReview.status, 403);
    assert.equal((await blockedReview.json()).error, 'internal_review_disabled');
  });
});

test('protected review content is feature gated and requires a canonical adapter', async () => {
  const seeded = seedEditorialReview({ internalReviewEnabled: false });
  const path = `/api/v1/item-revisions/${seeded.revision.id}/review-content?assignment_id=${seeded.assignment.id}&purpose=editorial_review`;
  await withServer({
    platform: seeded.platform,
    identityResolver: async () => identityContext(actors.editor),
    reviewContentResolver: async ({ itemRevisionId, assignmentId, purpose, actor }) => (
      seeded.platform.readAssignedReviewContent(itemRevisionId, assignmentId, purpose, actor)
    ),
  }, async (baseUrl) => {
    const blocked = await fetch(`${baseUrl}${path}`);
    assert.equal(blocked.status, 403);
    assert.deepEqual(await blocked.json(), { error: 'internal_review_disabled' });
  });

  enableSyntheticFlag(seeded.repository, 'internal_review_enabled');
  await withServer({
    platform: seeded.platform,
    identityResolver: async () => identityContext(actors.editor),
  }, async (baseUrl) => {
    const unavailable = await fetch(`${baseUrl}${path}`);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: 'internal_error' });
  });
});

test('protected review content is assignment scoped, closed world, and answer complete', async () => {
  const seeded = seedEditorialReview();
  const path = `/api/v1/item-revisions/${seeded.revision.id}/review-content?assignment_id=${seeded.assignment.id}&purpose=editorial_review`;
  const resolver = async ({ itemRevisionId, assignmentId, purpose, actor }) => (
    seeded.platform.readAssignedReviewContent(itemRevisionId, assignmentId, purpose, actor)
  );

  await withServer({
    platform: seeded.platform,
    identityResolver: async (request) => identityContext(
      request.headers['x-fixture-actor'] === 'wrong' ? actors.ratifier : actors.editor,
    ),
    reviewContentResolver: resolver,
  }, async (baseUrl) => {
    const accepted = await fetch(`${baseUrl}${path}`);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('cache-control'), 'no-store');
    const content = await accepted.json();
    assert.equal(content.answer, 'B');
    assert.equal(content.explanation, 'SECRET_EXPLANATION_review_content');
    assert.equal(content.correct_answer_rationale, 'SECRET_CORRECT_RATIONALE_review_content');
    assert.equal(content.choices.length, 4);
    assert.equal(content.choices.find((choice) => choice.key === 'A').why_wrong, 'Synthetic mismatch');
    assert.deepEqual(Object.keys(content).sort(), [
      'answer',
      'assignment_id',
      'choices',
      'correct_answer_rationale',
      'evidence_claim_ids',
      'exact_revision_hash',
      'explanation',
      'item_revision_id',
      'prompt',
      'review_type',
      'source_ids',
    ]);

    const wrongActor = await fetch(`${baseUrl}${path}`, { headers: { 'X-Fixture-Actor': 'wrong' } });
    assert.equal(wrongActor.status, 403);
    assert.deepEqual(await wrongActor.json(), { error: 'review_content_access_denied' });

    const wrongPurpose = await fetch(`${baseUrl}${path.replace('editorial_review', 'medical_review')}`);
    assert.equal(wrongPurpose.status, 403);
    assert.deepEqual(await wrongPurpose.json(), { error: 'review_content_access_denied' });

    const injected = await fetch(`${baseUrl}${path.replace(seeded.assignment.id, 'SECRET_UNKNOWN_ASSIGNMENT')}`);
    assert.equal(injected.status, 403);
    assert.doesNotMatch(JSON.stringify(await injected.json()), /SECRET_UNKNOWN_ASSIGNMENT/u);
  });

  const validPayload = seeded.platform.readAssignedReviewContent(
    seeded.revision.id,
    seeded.assignment.id,
    'editorial_review',
    actors.editor,
  );
  await withServer({
    platform: seeded.platform,
    identityResolver: async () => identityContext(actors.editor),
    reviewContentResolver: async () => ({ ...validPayload, private_debug: 'SECRET_ADAPTER_FIELD' }),
  }, async (baseUrl) => {
    const malformed = await fetch(`${baseUrl}${path}`);
    assert.equal(malformed.status, 500);
    const payload = await malformed.json();
    assert.deepEqual(payload, { error: 'internal_error' });
    assert.doesNotMatch(JSON.stringify(payload), /SECRET_ADAPTER_FIELD/u);
  });

  seeded.platform.submitReviewEvent({
    item_revision_id: seeded.revision.id,
    reviewer_id: seeded.reviewer.id,
    assignment_id: seeded.assignment.id,
    review_type: 'editorial',
    verdict: 'pass',
    to_status: 'medical_review',
  }, actors.editor);
  await withServer({
    platform: seeded.platform,
    identityResolver: async () => identityContext(actors.editor),
    reviewContentResolver: resolver,
  }, async (baseUrl) => {
    const completed = await fetch(`${baseUrl}${path}`);
    assert.equal(completed.status, 403);
    assert.deepEqual(await completed.json(), { error: 'review_content_access_denied' });
  });
});

test('open review assignments cannot read protected content', async () => {
  const seeded = seedEditorialReview({ accepted: false });
  const path = `/api/v1/item-revisions/${seeded.revision.id}/review-content?assignment_id=${seeded.assignment.id}&purpose=editorial_review`;
  await withServer({
    platform: seeded.platform,
    identityResolver: async () => identityContext(actors.editor),
    reviewContentResolver: async ({ itemRevisionId, assignmentId, purpose, actor }) => (
      seeded.platform.readAssignedReviewContent(itemRevisionId, assignmentId, purpose, actor)
    ),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'review_content_access_denied' });
  });
});

test('consumer artifacts require their exact adapter feature flag', () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  repository.create('channel_artifacts', {
    release_id: 'release_consumer_flag',
    channel: 'stat_pre_answer',
    phase: 'pre_answer',
    payload: [{ question_id: 'Q1', prompt: 'Synthetic?', choices: ['A', 'B', 'C', 'D'] }],
  }, { id: 'artifact_consumer_flag' });
  assert.throws(
    () => platform.artifactForPhase('release_consumer_flag', 'stat_pre_answer', null, actors.reader),
    /consumer_feature_flag_disabled/,
  );
});

test('expired, revoked, stale, missing-session, and outage identity contexts fail closed', async (t) => {
  const now = Date.now();
  const cases = [
    ['expired', identityContext(actors.reader, { session: { expires_at: new Date(now - 1_000).toISOString() } })],
    ['revoked', identityContext(actors.reader, { session: { revoked: true } })],
    ['stale', identityContext(actors.reader, { session: { validated_at: new Date(now - 10 * 60_000).toISOString() } })],
    ['missing session', identityContext(actors.reader, { session: null })],
    ['not explicitly validated', identityContext(actors.reader, { validated: false })],
  ];
  for (const [name, context] of cases) {
    await t.test(name, async () => {
      await withServer({ identityResolver: async () => context }, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/dashboard`);
        assert.equal(response.status, 401);
        assert.equal((await response.json()).error, 'authentication_required');
      });
    });
  }
  await t.test('adapter outage', async () => {
    await withServer({
      identityResolver: async () => {
        throw new Error('SECRET_ADAPTER_OUTAGE_DETAIL');
      },
    }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/dashboard`);
      assert.equal(response.status, 401);
      const payload = await response.json();
      assert.equal(payload.error, 'authentication_required');
      assert.doesNotMatch(JSON.stringify(payload), /SECRET_ADAPTER_OUTAGE_DETAIL/u);
    });
  });
});

test('local demo is prohibited in production and rejects forwarded proxy ambiguity', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => createQuestionPlatformServer({ localDemo: true }), /local_demo_forbidden/);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }

  await withServer({ localDemo: true }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: { 'X-Forwarded-For': '127.0.0.1' },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'production_identity_adapter_required');
  });
});

test('generic POST and PATCH reject sensitive mass assignment without echoing payloads', async () => {
  await withServer({
    identityResolver: async () => identityContext(actors.admin),
  }, async (baseUrl) => {
    const attacks = [
      ['POST', '/api/v1/resources/rights_records', { rights_status: 'cleared_for', secret: 'SECRET_RIGHTS_PAYLOAD' }],
      ['POST', '/api/v1/resources/privacy_redaction_records', { status: 'pass', secret: 'SECRET_PRIVACY_PAYLOAD' }],
      ['POST', '/api/v1/resources/evidence_claims', { status: 'verified', claim_text: 'SECRET_EVIDENCE_PAYLOAD' }],
      ['POST', '/api/v1/resources/reviewers', { roles: ['physician_reviewer'], credential: { status: 'verified' } }],
      ['POST', '/api/v1/resources/item_revisions', { answer: 'SECRET_ANSWER_PAYLOAD' }],
      ['POST', '/api/v1/resources/export_validation_results', { status: 'pass', evidence: 'SECRET_VALIDATOR_PAYLOAD' }],
      ['PATCH', '/api/v1/resources/inventory_sources/inventory_missing', { extraction_suitability: 'eligible', private_storage_ref: 'SECRET_SOURCE_PAYLOAD' }],
      ['PATCH', '/api/v1/resources/concepts/concept_missing', { answerKey: 'SECRET_ALIAS_PAYLOAD' }],
    ];
    for (const [method, path, body] of attacks) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: mutationHeaders({ 'If-Match': '0'.repeat(64) }),
        body: JSON.stringify(body),
      });
      assert.ok([403, 422].includes(response.status), `${method} ${path} returned ${response.status}`);
      const payload = await response.json();
      assert.doesNotMatch(JSON.stringify(payload), /SECRET_|verified|cleared_for|eligible/u);
    }
  });
});

test('platform assigns and persists a stable export ID while incomplete Drills metadata fails closed', () => {
  const repository = new MemoryRepository();
  const platform = new QuestionPlatform({ repository });
  seedRevisionDependencies(repository, 'stable');
  const revision = platform.createRevision(
    revisionPayload('stable'),
    actors.author,
    { idempotencyKey: 'stable-export-id' },
  );
  assert.match(revision.export_question_id, /^I1Q-[0-9A-F]{16}$/u);
  assert.equal(
    platform.createRevision(revisionPayload('stable'), actors.author, { idempotencyKey: 'stable-export-id' }).export_question_id,
    revision.export_question_id,
  );

  seedRevisionDependencies(repository, 'incomplete');
  const incomplete = revisionPayload('incomplete');
  delete incomplete.drills.nodes;
  assert.throws(
    () => platform.createRevision(incomplete, actors.author, { idempotencyKey: 'incomplete-drills' }),
    /nodes_availability_required/,
  );
  assert.equal(repository.list('item_revisions', {
    predicate: (row) => row.item_id === 'item_incomplete',
  }).total, 0);
});
