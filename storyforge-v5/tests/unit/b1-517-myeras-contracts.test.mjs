import assert from 'node:assert/strict';
import test from 'node:test';

import { createMyerasService, MyerasError } from '../../server/myeras.mjs';
import {
  CondensationError,
  condensationRedactionVersion,
  createCondensationService,
  redactCondensationInput,
} from '../../server/condensation.mjs';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const STORY_ID = '33333333-3333-4333-8333-333333333333';
const EXPERIENCE_ID = '44444444-4444-4444-8444-444444444444';
const STUDENT = Object.freeze({ sub: STUDENT_ID, role: 'student', eligible: true });
const ADMIN = Object.freeze({ sub: ADMIN_ID, role: 'admin', eligible: true });
const ENABLED_ENVIRONMENT = Object.freeze({
  STORYFORGE_ERAS_TAXONOMY_FORCE_OFF: 'false',
  STORYFORGE_MYERAS_WORKSPACE_FORCE_OFF: 'false',
  STORYFORGE_CLINICAL_CASE_METADATA_FORCE_OFF: 'false',
  STORYFORGE_USE_RANKING_FORCE_OFF: 'false',
  STORYFORGE_MYERAS_VERSIONS_FORCE_OFF: 'false',
  STORYFORGE_AI_CONDENSATION_FORCE_OFF: 'false',
});

function fixture(handler = () => ({ rows: [{ payload: { ok: true } }] })) {
  const calls = [];
  const withIdentity = async (identity, operation) => operation({
    async query(sql, values = []) {
      calls.push({ identity, sql: String(sql), values });
      return handler({ identity, sql: String(sql), values });
    },
  });
  return {
    calls,
    withIdentity,
    service: createMyerasService({ withIdentity, environment: ENABLED_ENVIRONMENT }),
  };
}

test('B1-517 capabilities are six independent booleans and condensation is provider-bound', async () => {
  const observed = fixture(({ sql }) => {
    if (sql.includes('jsonb_object_agg')) return { rows: [{ payload: {
      eras_taxonomy: true,
      myeras_workspace: true,
      clinical_case_metadata: false,
      use_ranking: true,
      myeras_versions: true,
      ai_condensation: true,
    } }] };
    return { rows: [] };
  });
  assert.deepEqual(await observed.service.capabilities(STUDENT), {
    erasTaxonomy: true,
    myerasWorkspace: true,
    clinicalCaseMetadata: false,
    useRanking: true,
    myerasVersions: true,
    aiCondensation: false,
  });
  assert.deepEqual(await createMyerasService({
    withIdentity: observed.withIdentity,
    condensationProviderAvailable: true,
    environment: ENABLED_ENVIRONMENT,
  }).capabilities(ADMIN), {
    erasTaxonomy: true,
    myerasWorkspace: true,
    clinicalCaseMetadata: false,
    useRanking: true,
    myerasVersions: true,
    aiCondensation: true,
  });
  assert.match(observed.calls.at(-1).sql, /sf_b1_517_admin_feature_enabled/);
});

test('B1-517 runtime kills default closed before capability database work', async () => {
  let calls = 0;
  const service = createMyerasService({
    withIdentity: async () => { calls += 1; throw new Error('must not execute'); },
  });
  assert.deepEqual(await service.capabilities(STUDENT), {
    erasTaxonomy: false,
    myerasWorkspace: false,
    clinicalCaseMetadata: false,
    useRanking: false,
    myerasVersions: false,
    aiCondensation: false,
  });
  assert.equal(calls, 0);
});

test('MyERAS workspace and mutation RPCs preserve signed actor and exact subject identifiers', async () => {
  const observed = fixture();
  await observed.service.workspace(STUDENT);
  await observed.service.workspace(ADMIN, STUDENT_ID);
  await observed.service.upsertExperience(STUDENT, null, {
    expectedVersion: 0,
    experience: {
      slotNo: 1,
      organization: 'MissionMed',
      experienceType: 'education_training',
      isCurrent: true,
      startMonth: '2026-07-01',
      descriptionText: 'Built a bounded learning workflow.',
    },
  });
  await observed.service.linkStory(STUDENT, EXPERIENCE_ID, STORY_ID, { linkRole: 'primary' });
  assert.deepEqual(observed.calls[0].values, [null]);
  assert.deepEqual(observed.calls[1].values, [STUDENT_ID]);
  assert.equal(observed.calls[0].identity, STUDENT);
  assert.equal(observed.calls[1].identity, ADMIN);
  assert.deepEqual(observed.calls.at(-1).values, [EXPERIENCE_ID, STORY_ID, 'primary']);
});

test('experience, clinical, tag, rank, and optimistic version inputs fail before database work', async () => {
  const observed = fixture();
  assert.throws(() => observed.service.upsertExperience(STUDENT, null, {
    expectedVersion: 0,
    experience: { organization: 'x', sql: 'no' },
  }), MyerasError);
  assert.throws(() => observed.service.upsertExperience(STUDENT, null, {
    expectedVersion: 0,
    experience: { organization: 'x', participationFrequency: 'Invented value' },
  }), MyerasError);
  assert.throws(() => observed.service.setClinicalCase(STUDENT, STORY_ID, {
    specialty: 'Pediatrics', patientContext: 'Identifiable detail', outcomeFocus: '',
    deidentConfirmed: false, expectedVersion: 0,
  }), /Confirm that clinical details are de-identified/);
  assert.throws(() => observed.service.setTags(STUDENT, STORY_ID, {
    profileKey: 'eras_2027', tags: [
      { dimension: 'setting', termId: 'urban' },
      { dimension: 'setting', termId: 'rural' },
    ],
  }), MyerasError);
  assert.throws(() => observed.service.setUseRank(STUDENT, STORY_ID, 'sql', {
    rank: 1, pinned: true, expectedVersion: 0,
  }), MyerasError);
  assert.throws(() => observed.service.setImpactful(STUDENT, {
    bodyText: 'x', sourceStoryId: STORY_ID, expectedVersion: -1,
  }), MyerasError);
  assert.equal(observed.calls.length, 0);
});

test('database denials are sanitized as uniform private not-found and conflict responses', async () => {
  const missing = fixture(() => { const error = new Error('private row detail'); error.code = 'P0002'; throw error; });
  await assert.rejects(
    () => missing.service.workspace(ADMIN, STUDENT_ID),
    (error) => error.code === 'myeras_not_found' && error.status === 404
      && !error.message.includes('private row detail'),
  );
  const stale = fixture(() => { const error = new Error('row version detail'); error.code = '40001'; throw error; });
  await assert.rejects(
    () => stale.service.setUseRank(STUDENT, STORY_ID, 'ps', { rank: 1, pinned: true, expectedVersion: 0 }),
    (error) => error.code === 'myeras_conflict' && error.status === 409,
  );
});

test('administrator feature controls accept only the six governed keys and bounded scopes', async () => {
  const observed = fixture();
  await observed.service.updateFeature(ADMIN, 'myeras_workspace', {
    scope: 'allowlist', allowlist: [STUDENT_ID], cohorts: [],
  });
  assert.deepEqual(observed.calls[0].values, ['myeras_workspace', 'allowlist', [STUDENT_ID], []]);
  assert.throws(() => observed.service.updateFeature(STUDENT, 'myeras_workspace', {
    scope: 'off', allowlist: [], cohorts: [],
  }), { code: 'admin_required', status: 403 });
  assert.throws(() => observed.service.updateFeature(ADMIN, 'story_versions', {
    scope: 'off', allowlist: [], cohorts: [],
  }), { code: 'invalid_feature_key' });
  assert.throws(() => observed.service.updateFeature(ADMIN, 'myeras_workspace', {
    scope: 'eligible_all', allowlist: [STUDENT_ID], cohorts: [],
  }), { code: 'invalid_feature_scope' });
  assert.equal(observed.calls.length, 1);
});

test('condensation is student-initiated, provider-off truthful, and redacts identifiers before egress', async () => {
  assert.equal(condensationRedactionVersion, 'b1-517-redaction-v1');
  const redacted = redactCondensationInput(
    'Patient context: Jane Doe, MRN: ABC-12345\nCall 212-555-0199 or jane@example.com.',
  );
  assert.equal(redacted.includes('ABC-12345'), false);
  assert.equal(redacted.includes('212-555-0199'), false);
  assert.equal(redacted.includes('jane@example.com'), false);
  assert.equal(redacted.includes('Jane Doe'), false);

  let queries = 0;
  const service = createCondensationService({
    configuration: { provider: 'none' },
    withIdentity: async (_identity, operation) => operation({
      query: async () => { queries += 1; return { rows: [{ enabled: true }] }; },
    }),
  });
  assert.equal(await service.capability(STUDENT), false);
  await assert.rejects(() => service.request(STUDENT, {
    mode: 'condense_experience', sourceText: 'A real story.', includePatientContext: false,
  }), (error) => error instanceof CondensationError
    && error.code === 'condensation_disabled'
    && error.message === 'The condensing assistant is not enabled.');
  assert.equal(queries, 0);
});
