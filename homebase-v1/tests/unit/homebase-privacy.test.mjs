import test from 'node:test';
import assert from 'node:assert/strict';

process.env.HOMEBASE_DATABASE_URL ||= 'postgres://localhost:5432/homebase_test_placeholder';
process.env.HOMEBASE_JWT_ISSUER ||= 'http://127.0.0.1:4190';

const { classProgressStudentView, safeClassAvatarUrl } = await import('../../server/app.mjs');

test('Class Progress emits only the approved student-safe projection', () => {
  const source = {
    id: '31111111-1111-4111-8111-111111111111',
    first_name: 'Fixture',
    last_name: 'Student',
    photo_url: 'https://cdn.missionmedinstitute.com/avatars/fixture.png',
    ps_stage: 4,
    email: 'private@example.invalid',
    username: 'private-login',
    wp_user_id: 999,
    admin_note: 'private note',
    identity_note: 'private identity evidence',
    current_status: 'private status',
    deadline: '2026-09-30',
  };
  const view = classProgressStudentView(source, new Map([
    ['profile-photo', 'completed'],
    ['personal-statement', 'in_review'],
  ]));
  assert.deepEqual(Object.keys(view).sort(), [
    'avatarUrl', 'displayName', 'items', 'psStage', 'psStageLabel',
  ]);
  assert.equal(view.displayName, 'Fixture Student');
  assert.equal(view.psStageLabel, 'Advanced Draft');
  assert.deepEqual(view.items, {
    'profile-photo': 'completed',
    'personal-statement': 'in_review',
  });
  for (const forbidden of ['id', 'email', 'username', 'wpUserId', 'adminNote', 'identityNote', 'deadline']) {
    assert.equal(Object.hasOwn(view, forbidden), false);
  }
});

test('Class Progress rejects non-canonical avatar hosts', () => {
  assert.equal(safeClassAvatarUrl('https://cdn.missionmedinstitute.com/a.png'), 'https://cdn.missionmedinstitute.com/a.png');
  assert.equal(safeClassAvatarUrl('https://example.invalid/private.png'), '');
  assert.equal(safeClassAvatarUrl('javascript:alert(1)'), '');
});
