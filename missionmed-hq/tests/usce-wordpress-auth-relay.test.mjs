import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pluginPath = path.join(repoRoot, 'wp-content', 'mu-plugins', 'missionmed-hq-auth-handoff.php');
const usceAdminPath = path.join(repoRoot, 'LIVE', 'usce_admin.html');

test('WordPress USCE relay is administrator-only, exact-target, and fragment-only', async () => {
  const source = await readFile(pluginPath, 'utf8');

  assert.match(source, /Version:\s+1\.0\.10/u);
  assert.match(source, /define\('MMHQ_USCE_ADMIN_HANDOFF_ACTION', 'mmhq_usce_admin_auth_relay'\)/u);
  assert.match(source, /define\('MMHQ_USCE_ADMIN_CDN_URL', 'https:\/\/cdn\.missionmedinstitute\.com\/html-system\/LIVE\/usce_admin\.html'\)/u);
  assert.match(source, /current_user_can\('manage_options'\)/u);
  assert.match(source, /\$target\['path'\].*\$allowed\['path'\]/su);
  assert.match(source, /!empty\(\$target\['fragment'\]\)/u);
  assert.match(source, /mmhq_handoff_build_token_payload\(wp_get_current_user\(\), 'hq', ''\)/u);
  assert.match(source, /#mmhq_handoff_token=/u);
  assert.match(source, /define\('MMHQ_USCE_ADMIN_ASSET_VERSION', '41456a69f527'\)/u);
  assert.match(source, /function mmhq_usce_admin_autohandoff_content\(\$content\)/u);
  assert.match(source, /is_page\('usce-admin'\)/u);
  assert.match(source, /esc_url\(mmhq_usce_admin_entry_url\(\)\)/u);
  assert.match(source, /add_filter\('the_content', 'mmhq_usce_admin_autohandoff_content', PHP_INT_MAX\)/u);
  assert.match(source, /add_action\('admin_post_' \. MMHQ_USCE_ADMIN_HANDOFF_ACTION, 'mmhq_usce_admin_handoff_handle', 1\)/u);
  assert.match(source, /add_action\('admin_post_nopriv_' \. MMHQ_USCE_ADMIN_HANDOFF_ACTION, 'mmhq_usce_admin_handoff_handle', 1\)/u);

  const publicRouteHandler = source.slice(
    source.indexOf('function mmhq_handoff_maybe_handle_public_route()'),
    source.indexOf("add_action('init', 'mmhq_handoff_maybe_handle_public_route'"),
  );
  assert.match(publicRouteHandler, /'1' === \$public && '' === \$action/u);
  assert.doesNotMatch(publicRouteHandler, /mmhq_handoff_is_endpoint_request/u);

  const usceHandler = source.slice(
    source.indexOf('function mmhq_usce_admin_handoff_handle()'),
    source.indexOf('function mmhq_cam_logout_nonce_option_name'),
  );
  assert.match(usceHandler, /USCE administrator access is required[\s\S]*array\('response' => 403\)/u);
  assert.doesNotMatch(usceHandler, /add_query_arg\([^)]*token/su);
});

test('USCE admin runtime uses the scoped WordPress relay fallback', async () => {
  const source = await readFile(usceAdminPath, 'utf8');

  assert.match(
    source,
    /apiBase:\s*'https:\/\/missionmed-usce-gateway-production\.up\.railway\.app'/u,
  );
  assert.match(
    source,
    /authRelayEndpoint:\s*'https:\/\/missionmedinstitute\.com\/wp-admin\/admin-post\.php\?action=mmhq_usce_admin_auth_relay'/u,
  );
  assert.match(source, /authAudience:\s*'hq'/u);
  assert.doesNotMatch(source, /authRelayEndpoint:\s*'\/api\/usce\/admin\/auth\/relay'/u);
});
