import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pluginPath = path.join(repoRoot, 'wp-content', 'mu-plugins', 'missionmed-hq-auth-handoff.php');

test('WordPress USCE relay is administrator-only, exact-target, and fragment-only', async () => {
  const source = await readFile(pluginPath, 'utf8');

  assert.match(source, /Version:\s+1\.0\.7/u);
  assert.match(source, /define\('MMHQ_USCE_ADMIN_HANDOFF_ACTION', 'mmhq_usce_admin_auth_relay'\)/u);
  assert.match(source, /define\('MMHQ_USCE_ADMIN_CDN_URL', 'https:\/\/cdn\.missionmedinstitute\.com\/html-system\/LIVE\/usce_admin\.html'\)/u);
  assert.match(source, /current_user_can\('manage_options'\)/u);
  assert.match(source, /\$target\['path'\].*\$allowed\['path'\]/su);
  assert.match(source, /!empty\(\$target\['fragment'\]\)/u);
  assert.match(source, /mmhq_handoff_build_token_payload\(wp_get_current_user\(\), 'hq', ''\)/u);
  assert.match(source, /#mmhq_handoff_token=/u);
  assert.match(source, /add_action\('admin_post_' \. MMHQ_USCE_ADMIN_HANDOFF_ACTION, 'mmhq_usce_admin_handoff_handle', 1\)/u);
  assert.match(source, /add_action\('admin_post_nopriv_' \. MMHQ_USCE_ADMIN_HANDOFF_ACTION, 'mmhq_usce_admin_handoff_handle', 1\)/u);

  const usceHandler = source.slice(
    source.indexOf('function mmhq_usce_admin_handoff_handle()'),
    source.indexOf('function mmhq_cam_logout_nonce_option_name'),
  );
  assert.doesNotMatch(usceHandler, /add_query_arg\([^)]*token/su);
});
