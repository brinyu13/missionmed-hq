import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.HOMEBASE_DATABASE_URL ||= 'postgres://localhost:5432/homebase_test_placeholder';
process.env.HOMEBASE_JWT_ISSUER ||= 'http://127.0.0.1:4190';

const { PS_STAGES } = await import('../../server/app.mjs');
const { verifyToken } = await import('../../server/auth.mjs');

test('PS state machine preserves the legacy eight stages in order', () => {
  assert.equal(PS_STAGES.length, 8);
  PS_STAGES.forEach((meta, index) => {
    assert.equal(meta.stage, index);
    assert.ok(meta.admin.length > 0);
    assert.ok(meta.student.length > 0);
  });
  assert.equal(PS_STAGES[0].student, 'Getting Started');
  assert.equal(PS_STAGES[4].student, 'Advanced Draft');
  assert.equal(PS_STAGES[7].admin, 'Final completed');
});

test('verifyToken refuses a missing bearer token', async () => {
  await assert.rejects(() => verifyToken(''), (error) => {
    assert.equal(error.code, 'auth_required');
    return true;
  });
});

test('verifyToken refuses a malformed token', async () => {
  await assert.rejects(() => verifyToken('not-a-jwt'));
});

test('WordPress bridge and route retain the HomeBase-only access seams', async () => {
  const packageRoot = new URL('../..', import.meta.url);
  const repositoryRoot = new URL('../', packageRoot);
  const [plugin, launch, route] = await Promise.all([
    readFile(new URL('wp-content/plugins/missionmed-homebase-sso/missionmed-homebase-sso.php', repositoryRoot), 'utf8'),
    readFile(new URL('wp-content/plugins/missionmed-homebase-sso/assets/matrix-launch.js', repositoryRoot), 'utf8'),
    readFile(new URL('infra/wordpress/missionmed-homebase-route.php', packageRoot), 'utf8'),
  ]);
  assert.match(plugin, /if\s*\(\s*!\$allowlisted\s*\)\s*\{/);
  assert.doesNotMatch(plugin, /!\$allowlisted\s*&&\s*\$role/);
  assert.match(launch, /MissionMedHomeBaseLaunch/);
  assert.match(launch, /#homebase/);
  assert.doesNotMatch(launch, /StoryForge|#storyforge/i);
  assert.match(route, /function mmhbr_feature_enabled\(\)/);
  assert.match(route, /function_exists\( 'mmhb_settings' \)/);
  assert.doesNotMatch(route, /mmsf_|api\/recordings|guest_contribution|postmark/i);
});
