import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createIvocProjectionService,
  ivocProjectionPolicy,
} from '../../server/ivoc-projection.mjs';

const STUDENT = Object.freeze({
  sub: '11111111-1111-4111-8111-111111111111',
  wpUserId: 1101,
  role: 'student',
  eligible: true,
});
const STORY = '33333333-3333-4333-8333-333333333333';
const CONSENT = '44444444-4444-4444-8444-444444444444';

function service(payload, { queryError = null } = {}) {
  return createIvocProjectionService({
    withIdentity: async (identity, operation) => {
      assert.equal(identity, STUDENT);
      return operation({
        async query(sql, values) {
          if (queryError) throw queryError;
          if (String(sql).includes('sf_decide_ivoc_projection_consent')) {
            return { rows: [{ payload: { consentId: CONSENT, values } }] };
          }
          return { rows: [{ payload }] };
        },
      });
    },
  });
}

function ownerPayload(overrides = {}) {
  return {
    policyVersion: ivocProjectionPolicy.version,
    stories: [{
      storyId: STORY,
      consentId: CONSENT,
      version: 7,
      title: 'Night shift turnaround',
      themes: ['teamwork', 'communication'],
      summary: 'I stabilized a difficult handoff by clarifying roles, closing two safety gaps, and confirming shared ownership.',
      consentedAt: '2026-09-21T01:00:00.000Z',
      maturity: { mentorScore: 5, reviewSuitability: 'interview_only' },
      applicability: [{
        questionId: '55555555-5555-4555-8555-555555555555',
        canonicalKey: 'BEHAVIORAL-TEAMWORK-01',
        family: 'behavioral',
        question: 'Tell me about a difficult team situation.',
      }],
      tips: [{
        noteId: '66666666-6666-4666-8666-666666666666',
        body: 'Lead with your role, then name the safety outcome.',
        publishedAt: '2026-09-20T22:00:00.000Z',
      }],
      ...overrides,
    }],
  };
}

test('same-owner approved projection is minimized, consent-bound, and deterministic', async () => {
  const projection = await service(ownerPayload()).read(STUDENT);
  assert.equal(projection.subject_id, 'wp:1101');
  assert.equal(projection.owner_app, 'storyforge');
  assert.equal(projection.projection_type, 'storyforge.approved_stories');
  assert.equal(projection.authorization.basis, 'student_consent');
  assert.equal(projection.payload.stories[0].tips.length, 1);
  assert.match(projection.source_receipt.hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(projection.payload), /original_text|current_text|recording|transcript|internal_only/u);
});

test('absent, revoked, or stale owner state returns no projection', async () => {
  assert.equal(await service(null).read(STUDENT), null);
  assert.equal(await service({ policyVersion: ivocProjectionPolicy.version, stories: [] }).read(STUDENT), null);
});

test('grant is version-bound and summary-bounded', async () => {
  const output = await service(null).consent(STUDENT, {
    storyId: STORY,
    expectedVersion: 7,
    decision: 'grant',
    summary: 'A concise approved summary.',
    includeStudentVisibleTips: true,
  });
  assert.deepEqual(output.values, [STORY, 7, 'grant', 'A concise approved summary.', true]);
  await assert.rejects(
    service(null).consent(STUDENT, {
      storyId: STORY,
      expectedVersion: 7,
      decision: 'grant',
      summary: Array.from({ length: 61 }, () => 'word').join(' '),
      includeStudentVisibleTips: false,
    }),
    { code: 'invalid_ivoc_consent' },
  );
});

test('wrong owner and stale version fail closed', async () => {
  await assert.rejects(
    service(null, { queryError: Object.assign(new Error('denied'), { code: '42501' }) }).consent(STUDENT, {
      storyId: STORY, expectedVersion: 7, decision: 'grant',
      summary: 'Approved summary.', includeStudentVisibleTips: false,
    }),
    { code: 'ivoc_projection_denied', status: 403 },
  );
  await assert.rejects(
    service(null, { queryError: Object.assign(new Error('stale'), { code: '40001' }) }).consent(STUDENT, {
      storyId: STORY, expectedVersion: 6, decision: 'revoke',
      summary: '', includeStudentVisibleTips: false,
    }),
    { code: 'ivoc_projection_conflict', status: 409 },
  );
});

test('malformed owner output and non-student actors are denied', async () => {
  await assert.rejects(service(ownerPayload({ summary: Array.from({ length: 61 }, () => 'word').join(' ') })).read(STUDENT), {
    code: 'ivoc_projection_malformed', status: 502,
  });
  await assert.rejects(service(ownerPayload()).read({ ...STUDENT, role: 'mentor' }), {
    code: 'student_required', status: 403,
  });
});

test('route and migration expose only the bounded owner contract', async () => {
  const app = await readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8');
  const migration = await readFile(
    new URL('../../infra/postgres/migrations/20260921010000_b1_5021_ivoc_approved_story_projection.sql', import.meta.url),
    'utf8',
  );
  assert.match(app, /GET' && url\.pathname === '\/api\/ivoc\/projection'/);
  assert.match(app, /POST' && url\.pathname === '\/api\/ivoc\/consent'/);
  assert.match(migration, /sf_ivoc_projection_consents_append_only/);
  assert.match(migration, /story\.row_version = consent\.story_row_version/);
  assert.match(migration, /publication\.destination = 'iv_prep_on_call'/);
  assert.match(migration, /note\.state = 'published'/);
  assert.match(migration, /NOT note\.internal_only/);
  assert.doesNotMatch(migration, /original_text|current_text|sf_audio_assets|sf_recording_sessions/u);
});
