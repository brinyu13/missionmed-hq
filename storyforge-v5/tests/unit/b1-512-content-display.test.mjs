import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ProductConfigurationError,
  contentDisplayForceOff,
  createProductConfigurationService,
  validateContentDisplay,
} from '../../server/product-configuration.mjs';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../infra/postgres/migrations/20260806190000_b1_512_concrete_configuration_media.sql', import.meta.url), 'utf8');

const payload = {
  taxonomy: {
    categories: [{ id: 'clinical', label: 'Clinical', sortOrder: 10, state: 'active', builtin: true }],
    intendedUses: [{ id: 'ps', label: 'Personal Statement', sortOrder: 10, state: 'active', builtin: true }],
  },
  sections: {
    storyCategories: { title: 'Story categories', helper: 'Choose a category.', mode: 'visible_optional' },
    intendedUses: { title: 'Intended uses', helper: 'Choose a use.', mode: 'visible_optional' },
    workingVersion: { title: 'Working version', helper: 'Edit your story.', mode: 'visible_required' },
    learningLesson: { title: 'Learning Lesson', helper: 'What did you learn?', mode: 'visible_optional' },
    reviewSubmission: { title: 'Submit for review', helper: 'Share with a reviewer.', mode: 'visible_optional' },
  },
  navigation: { interviewPrepVisible: false },
};

test('Content & Display accepts only the bounded structured contract', () => {
  assert.deepEqual(validateContentDisplay(payload), payload);
  assert.throws(
    () => validateContentDisplay({ ...payload, html: '<script>alert(1)</script>' }),
    (error) => error instanceof ProductConfigurationError && error.code === 'invalid_content_display',
  );
  assert.throws(
    () => validateContentDisplay({ ...payload, sections: { ...payload.sections, learningLesson: { ...payload.sections.learningLesson, title: '<b>Lesson</b>' } } }),
    (error) => error instanceof ProductConfigurationError && error.code === 'invalid_content_display',
  );
});

test('Content & Display administration is default-closed and requires eligible WordPress admin authority', async () => {
  assert.equal(contentDisplayForceOff({}), true);
  assert.equal(contentDisplayForceOff({ STORYFORGE_CONTENT_DISPLAY_FORCE_OFF: '0' }), false);
  const service = createProductConfigurationService({
    environment: { STORYFORGE_CONTENT_DISPLAY_FORCE_OFF: '0' },
    withIdentity: async (_identity, operation) => operation({ query: async () => ({ rows: [] }) }),
  });
  await assert.rejects(
    service.validate({ sub: '00000000-0000-4000-8000-000000000001', role: 'student', eligible: true }, { payload }),
    (error) => error.code === 'admin_required' && error.status === 403,
  );
});

test('Content & Display uses the existing renderer with preview, versioned publish, audit, and restore', () => {
  assert.match(app, /id="contentDisplayForm"/);
  assert.match(app, /Preview in this signed browser/);
  assert.match(app, /publishContentDisplay/);
  assert.match(app, /restoreContentDisplayDefaults/);
  assert.match(app, /presentationTaxonomy\('categories'/);
  assert.match(app, /presentationSection\('learningLesson'\)/);
  assert.match(migration, /row_version bigint NOT NULL/);
  assert.match(migration, /'configuration\.' \|\| p_action/);
  assert.match(migration, /p_action NOT IN \('publish', 'restore_default'\)/);
  assert.match(migration, /sf_storyforge_submission_configuration_guard/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
});
