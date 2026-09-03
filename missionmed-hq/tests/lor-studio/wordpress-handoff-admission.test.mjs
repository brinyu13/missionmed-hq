import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..', '..', '..');
const handoffPath = path.join(repositoryRoot, 'wp-content', 'mu-plugins', 'missionmed-hq-auth-handoff.php');
const phpAvailable = spawnSync('php', ['--version'], { encoding: 'utf8' }).status === 0;

function harness({ audience = '', callbackAudience = audience === 'lor-studio' ? 'lor-studio' : '', issue = 'success' } = {}) {
  const callback = callbackAudience === 'lor-studio'
    ? `https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/callback?audience=lor-studio&state=${'a'.repeat(64)}`
    : 'https://missionmed-hq-production.up.railway.app/api/auth/session';
  return `
define('ABSPATH', ${JSON.stringify(repositoryRoot + path.sep)});
define('MMHQ_HANDOFF_SECRET', '0123456789abcdef0123456789abcdef0123456789abcdef');
$_SERVER['REQUEST_URI'] = '/wp-admin/admin-post.php?action=mmac_hq_auth_redirect';
$_GET = array('return_to' => ${JSON.stringify(callback)}${audience ? `, 'audience' => ${JSON.stringify(audience)}` : ''});
class WP_Error {
    public $data;
    public function __construct($data = array()) { $this->data = $data; }
    public function get_error_data() { return $this->data; }
}
$GLOBALS['lor_status'] = null; $GLOBALS['lor_nocache'] = 0;
function add_action($hook, $callback, $priority = 10) {}
function add_filter($hook, $callback, $priority = 10) {}
function apply_filters($hook, $value) { return $value; }
function is_user_logged_in() { return true; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_unslash($value) { return $value; }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim((string) $value); }
function absint($value) { return abs((int) $value); }
function esc_url_raw($value) { return $value; }
function wp_parse_url($value, $component = -1) { return parse_url($value, $component); }
function home_url($path = '/') { return 'https://missionmedinstitute.com' . $path; }
function wp_login_url($redirect = '') { return 'https://missionmedinstitute.com/wp-login.php?redirect_to=' . rawurlencode($redirect); }
function wp_generate_uuid4() { return '11111111-1111-4111-8111-111111111111'; }
function get_user_meta($user_id, $key, $single = false) { return ''; }
function user_can($user_id, $capability) { return false; }
function wp_json_encode($value) { return json_encode($value, JSON_UNESCAPED_SLASHES); }
function status_header($status) { $GLOBALS['lor_status'] = $status; }
function nocache_headers() { $GLOBALS['lor_nocache']++; }
function wp_die($message) { echo json_encode(array('die' => $message, 'status' => $GLOBALS['lor_status'], 'nocache' => $GLOBALS['lor_nocache'])); exit; }
function wp_get_current_user() { return (object) array(
    'ID' => 123, 'user_email' => 'student@example.test', 'user_login' => 'student',
    'display_name' => 'Student', 'roles' => array('subscriber')
); }
function add_query_arg($arguments, $url) {
    $parts = parse_url($url); $query = array();
    if (!empty($parts['query'])) parse_str($parts['query'], $query);
    foreach ($arguments as $key => $value) $query[$key] = $value;
    return $parts['scheme'] . '://' . $parts['host'] . ($parts['path'] ?? '/') . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
}
function wp_safe_redirect($target, $status = 302) { echo json_encode(array('target' => $target, 'status' => $status, 'nocache' => $GLOBALS['lor_nocache'])); }
function wp_redirect($target, $status = 302, $by = '') { echo json_encode(array('target' => $target, 'status' => $status, 'nocache' => $GLOBALS['lor_nocache'])); }
${issue === 'success' ? `function mmhq_lor_studio_issue_browser_bootstrap_code($user, $callback) { return array('code' => 'lorc1_' . str_repeat('c', 43), 'callback' => $callback); }` : ''}
${issue === 'error503' ? `function mmhq_lor_studio_issue_browser_bootstrap_code($user, $callback) { return new WP_Error(array('status' => 503)); }` : ''}
require ${JSON.stringify(handoffPath)};
mmhq_handoff_handle();
`;
}

function runPhp(program) {
  const result = spawnSync('php', ['-d', 'display_errors=1', '-r', program], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('source grafts the exact LOR branch onto the live hardened handoff without weakening shared auth', async () => {
  const source = await readFile(handoffPath, 'utf8');
  const lorBranch = source.indexOf("if ('lor-studio' === $audience_raw)");
  const genericPayload = source.indexOf('$payload = mmhq_handoff_build_token_payload($wp_user, $audience, $handoff_state);');
  assert.ok(lorBranch > 0 && genericPayload > lorBranch);
  assert.match(source, /\* Version: 1\.0\.5/u);
  assert.match(source, /function mmhq_handoff_limit_endpoint_plugins/u);
  assert.match(source, /function mmhq_handoff_is_allowed_cam_return_url/u);
  assert.match(source, /MMHQ_HANDOFF_LOGIN_STATE_COOKIE/u);
  assert.match(source, /\$scheme !== 'https'/u);
  assert.match(source.slice(0, lorBranch), /isset\(\$_GET\['audience'\]\) && is_string\(\$_GET\['audience'\]\)/u);
  assert.match(source.slice(lorBranch, genericPayload), /mmhq_lor_studio_issue_browser_bootstrap_code/u);
  assert.doesNotMatch(source.slice(lorBranch, genericPayload), /user_email|display_name|roles|hash_hmac/u);
});

test('exact LOR audience redirects with one opaque code and no identity evidence', { skip: !phpAvailable }, () => {
  const result = runPhp(harness({ audience: 'lor-studio' }));
  const target = new URL(result.target);
  assert.equal(result.status, 303);
  assert.equal(result.nocache, 1);
  assert.equal(target.pathname, '/api/lor-studio/auth/callback');
  assert.equal(target.searchParams.get('audience'), 'lor-studio');
  assert.equal(target.searchParams.get('state'), 'a'.repeat(64));
  assert.equal(target.searchParams.get('code'), `lorc1_${'c'.repeat(43)}`);
  assert.equal(target.searchParams.has('token'), false);
  assert.doesNotMatch(result.target, /student@example|wp_user_id|roles/iu);
});

test('missing LOR issuer fails closed as 503 and never falls through to generic handoff', { skip: !phpAvailable }, () => {
  const result = runPhp(harness({ audience: 'lor-studio', issue: 'missing' }));
  assert.deepEqual(result, { die: 'LOR Studio access is unavailable.', status: 503, nocache: 0 });
});

test('issuer storage failure preserves generic message and 503 semantics', { skip: !phpAvailable }, () => {
  const result = runPhp(harness({ audience: 'lor-studio', issue: 'error503' }));
  assert.deepEqual(result, { die: 'LOR Studio access is unavailable.', status: 503, nocache: 0 });
});

test('one-sided LOR audience signals fail closed before the generic identity-token path', { skip: !phpAvailable }, () => {
  const missingOuter = runPhp(harness({ callbackAudience: 'lor-studio' }));
  assert.deepEqual(missingOuter, { die: 'Invalid LOR Studio handoff target.', status: 400, nocache: 0 });

  const missingCallback = runPhp(harness({ audience: 'lor-studio', callbackAudience: '' }));
  assert.deepEqual(missingCallback, { die: 'Invalid LOR Studio handoff target.', status: 400, nocache: 0 });
});

test('non-LOR request preserves the existing generic token/final behavior', { skip: !phpAvailable }, () => {
  const result = runPhp(harness());
  const target = new URL(result.target);
  assert.equal(result.status, 302);
  assert.equal(result.nocache, 0);
  assert.ok(target.searchParams.get('token'));
  assert.equal(target.searchParams.has('code'), false);
  assert.equal(target.searchParams.get('final'), 'https://missionmedinstitute.com/arena?just_logged_in=1');
});

test('padded and non-string audiences remain on the generic path without warnings', { skip: !phpAvailable }, () => {
  for (const audience of [' lor-studio ', ['lor-studio']]) {
    const result = runPhp(harness({ audience }));
    const target = new URL(result.target);
    assert.equal(result.status, 302);
    assert.equal(result.nocache, 0);
    assert.ok(target.searchParams.get('token'));
    assert.equal(target.searchParams.has('code'), false);
  }
});
