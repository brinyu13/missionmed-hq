import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../../../wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php', import.meta.url),
  'utf8',
);

test('IVOC token bridge is server-only and reuses current StoryForge authorization', () => {
  assert.match(source, /MMSF_IVOC_SERVICE_TOKEN_ROUTE = '\/storyforge\/ivoc-token'/);
  assert.match(source, /hash_equals\('ivoc', \$consumer\)/);
  assert.match(source, /get_header\('authorization'\)/);
  assert.match(source, /\^\(Basic\|Bearer\)\\s\+\\S\+\$/);
  assert.match(source, /get_header\('origin'\).*!== ''/s);
  assert.match(source, /mmsf_access_state\(\$user\)/);
  assert.match(source, /mmsf_rate_limit\(\(int\) \$user->ID\)/);
  assert.match(source, /mmsf_issue_jwt\(\$user, \$access\)/);
  assert.match(source, /mmsf_no_store\(new WP_REST_Response\(\$issued, 200\)\)/);
});

test('IVOC token bridge does not accept the browser nonce as service authority', () => {
  const start = source.indexOf('function mmsf_ivoc_service_token_endpoint');
  const end = source.indexOf('function mmsf_register_rest_routes', start);
  const endpoint = source.slice(start, end);
  assert.doesNotMatch(endpoint, /x-wp-nonce|wp_verify_nonce|wp_create_nonce/);
  assert.match(endpoint, /wp_get_current_user\(\)/);
});
