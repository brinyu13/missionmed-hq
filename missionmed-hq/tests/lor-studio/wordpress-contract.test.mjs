import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..', '..', '..');
const contractPath = path.join(repositoryRoot, 'wp-content', 'mu-plugins', 'missionmed-lor-studio-contract.php');
const authHandoffPath = path.join(repositoryRoot, 'wp-content', 'mu-plugins', 'missionmed-hq-auth-handoff.php');
const phpAvailable = spawnSync('php', ['--version'], { encoding: 'utf8' }).status === 0;

const enabledConstants = `
define('MMHQ_HANDOFF_SECRET', '0123456789abcdef0123456789abcdef0123456789abcdef');
define('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED', true);
define('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS', '4000');
define('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS', '360_match_mentorship');
define('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION', 'lor-consent-v1');
define('MMHQ_LOR_STUDIO_ENTITLEMENT_MAX_AGE_SECONDS', 300);
`;

function phpProgram({ constants = enabledConstants, body }) {
  return `
define('ABSPATH', ${JSON.stringify(repositoryRoot + path.sep)});
${constants}
class WP_Error {
    public $code; public $message; public $data;
    public function __construct($code, $message, $data = array()) {
        $this->code = $code; $this->message = $message; $this->data = $data;
    }
    public function get_error_data() { return $this->data; }
}
class Lor_Test_Rest_Response {
    public $data; public $headers = array();
    public function __construct($data) { $this->data = $data; }
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class Lor_Test_Rest_Request {
    private $route; private $method; private $body; private $headers;
    public function __construct($route, $method = 'POST', $body = '', $headers = array()) {
        $this->route = $route; $this->method = $method; $this->body = $body; $this->headers = $headers;
    }
    public function get_route() { return $this->route; }
    public function get_method() { return $this->method; }
    public function get_body() { return $this->body; }
    public function get_header($name) {
        foreach ($this->headers as $key => $value) {
            if (strtolower($key) === strtolower($name)) return $value;
        }
        return '';
    }
}
class Lor_Test_Wpdb {
    public $options = 'wp_options';
    public function prepare($query, ...$args) { return array('query' => $query, 'args' => $args); }
    public function get_var($prepared) {
        $name = $prepared['args'][0] ?? '';
		$value = array_key_exists($name, $GLOBALS['lor_options']) ? $GLOBALS['lor_options'][$name] : null;
		if (!empty($GLOBALS['lor_after_get_var']) && is_callable($GLOBALS['lor_after_get_var'])) {
			$hook = $GLOBALS['lor_after_get_var'];
			$GLOBALS['lor_after_get_var'] = null;
			$hook($name, $value);
		}
		return $value;
    }
    public function query($prepared) {
		$is_orphan_timeout_delete = 0 === strpos($prepared['query'], 'DELETE timeout_row FROM ');
		if ($is_orphan_timeout_delete) {
			$value_name = $prepared['args'][0] ?? '';
			$timeout_name = $prepared['args'][1] ?? '';
			$expected_timeout = $prepared['args'][2] ?? '';
			foreach (array($value_name, $timeout_name) as $name) {
				$fail_once = array_search($name, $GLOBALS['lor_query_fail_once_names'], true);
				if (false !== $fail_once) {
					unset($GLOBALS['lor_query_fail_once_names'][$fail_once]);
					$GLOBALS['lor_query_fail_once_names'] = array_values($GLOBALS['lor_query_fail_once_names']);
					return false;
				}
				if (in_array($name, $GLOBALS['lor_query_fail_names'], true)) return false;
			}
			if (!empty($GLOBALS['lor_before_cas']) && is_callable($GLOBALS['lor_before_cas'])) {
				$hook = $GLOBALS['lor_before_cas'];
				$GLOBALS['lor_before_cas'] = null;
				$hook($timeout_name, $expected_timeout);
			}
			if (
				array_key_exists($value_name, $GLOBALS['lor_options'])
				|| !array_key_exists($timeout_name, $GLOBALS['lor_options'])
				|| $GLOBALS['lor_options'][$timeout_name] !== $expected_timeout
			) return 0;
			unset($GLOBALS['lor_options'][$timeout_name]);
			return 1;
		}
		$is_pair_delete = 0 === strpos($prepared['query'], 'DELETE value_row, timeout_row ');
		if ($is_pair_delete) {
			$timeout_name = $prepared['args'][0] ?? '';
			$expected_timeout = $prepared['args'][1] ?? '';
			$value_name = $prepared['args'][2] ?? '';
			$expected_value = $prepared['args'][3] ?? '';
			foreach (array($value_name, $timeout_name) as $name) {
				$fail_once = array_search($name, $GLOBALS['lor_query_fail_once_names'], true);
				if (false !== $fail_once) {
					unset($GLOBALS['lor_query_fail_once_names'][$fail_once]);
					$GLOBALS['lor_query_fail_once_names'] = array_values($GLOBALS['lor_query_fail_once_names']);
					return false;
				}
				if (in_array($name, $GLOBALS['lor_query_fail_names'], true)) return false;
			}
			if (!empty($GLOBALS['lor_before_pair_delete']) && is_callable($GLOBALS['lor_before_pair_delete'])) {
				$hook = $GLOBALS['lor_before_pair_delete'];
				$GLOBALS['lor_before_pair_delete'] = null;
				$hook($value_name, $expected_value, $timeout_name, $expected_timeout);
			}
			if (
				!array_key_exists($value_name, $GLOBALS['lor_options'])
				|| !array_key_exists($timeout_name, $GLOBALS['lor_options'])
				|| $GLOBALS['lor_options'][$value_name] !== $expected_value
				|| $GLOBALS['lor_options'][$timeout_name] !== $expected_timeout
			) return 0;
			unset($GLOBALS['lor_options'][$value_name], $GLOBALS['lor_options'][$timeout_name]);
			return 2;
		}
        $is_update = 0 === strpos($prepared['query'], 'UPDATE ');
        $replacement = $is_update ? ($prepared['args'][0] ?? '') : '';
        $name = $is_update ? ($prepared['args'][1] ?? '') : ($prepared['args'][0] ?? '');
        $expected = $is_update ? ($prepared['args'][2] ?? '') : ($prepared['args'][1] ?? '');
        $fail_once = array_search($name, $GLOBALS['lor_query_fail_once_names'], true);
        if (false !== $fail_once) {
            unset($GLOBALS['lor_query_fail_once_names'][$fail_once]);
            $GLOBALS['lor_query_fail_once_names'] = array_values($GLOBALS['lor_query_fail_once_names']);
            return false;
        }
        if (in_array($name, $GLOBALS['lor_query_fail_names'], true)) return false;
        if (!empty($GLOBALS['lor_before_cas']) && is_callable($GLOBALS['lor_before_cas'])) {
            $hook = $GLOBALS['lor_before_cas']; $GLOBALS['lor_before_cas'] = null; $hook($name, $expected);
        }
        if (!array_key_exists($name, $GLOBALS['lor_options']) || $GLOBALS['lor_options'][$name] !== $expected) return 0;
        if ($is_update) $GLOBALS['lor_options'][$name] = $replacement;
        else unset($GLOBALS['lor_options'][$name]);
        return 1;
    }
}
$GLOBALS['wpdb'] = new Lor_Test_Wpdb();
$GLOBALS['lor_actions'] = array(); $GLOBALS['lor_filters'] = array(); $GLOBALS['lor_routes'] = array();
$GLOBALS['lor_options'] = array(); $GLOBALS['lor_user_id'] = 123; $GLOBALS['lor_meta'] = array();
$GLOBALS['lor_user_login'] = 'student'; $GLOBALS['lor_manage_options'] = false;
$GLOBALS['lor_query_fail_names'] = array(); $GLOBALS['lor_query_fail_once_names'] = array();
$GLOBALS['lor_fail_add_contains'] = '';
$GLOBALS['lor_entitlement_calls'] = 0; $GLOBALS['lor_after_add_option'] = null;
$GLOBALS['lor_before_pair_delete'] = null;
$GLOBALS['lor_after_get_var'] = null;
function add_action($hook, $callback) { $GLOBALS['lor_actions'][$hook][] = $callback; }
function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['lor_filters'][$hook][] = array($callback, $priority, $accepted_args);
}
function register_rest_route($namespace, $route, $arguments) { $GLOBALS['lor_routes'][] = array($namespace, $route, $arguments); }
function __return_true() { return true; }
function wp_get_current_user() {
    return (object) array('ID' => $GLOBALS['lor_user_id'], 'user_email' => 'student@example.test', 'user_login' => $GLOBALS['lor_user_login'], 'display_name' => 'Student', 'roles' => array('subscriber'));
}
function is_user_logged_in() { return (int) $GLOBALS['lor_user_id'] > 0; }
function get_userdata($user_id) {
    return (int) $user_id === (int) $GLOBALS['lor_user_id'] ? wp_get_current_user() : false;
}
function user_can($user_id, $capability) {
    return (int) $user_id === (int) $GLOBALS['lor_user_id']
        && 'manage_options' === $capability
        && true === $GLOBALS['lor_manage_options'];
}
function get_user_meta($user_id, $key, $single) { return $GLOBALS['lor_meta'][$key] ?? ''; }
function is_wp_error($value) { return $value instanceof WP_Error; }
function rest_ensure_response($value) { return new Lor_Test_Rest_Response($value); }
function rest_convert_error_to_response($error) {
    return new Lor_Test_Rest_Response(array('code' => $error->code, 'message' => $error->message, 'data' => $error->data));
}
function wp_json_encode($value) { return json_encode($value, JSON_UNESCAPED_SLASHES); }
function esc_url_raw($value) { return filter_var($value, FILTER_VALIDATE_URL) ? $value : ''; }
function wp_parse_url($value, $component = -1) { return parse_url($value, $component); }
function mmhq_handoff_is_allowed_return_url($value) { return parse_url($value, PHP_URL_HOST) === 'missionmed.example.test'; }
function mmhq_handoff_secret() { return MMHQ_HANDOFF_SECRET; }
function wp_cache_delete($key, $group = '') { return true; }
function add_option($name, $value = '', $deprecated = '', $autoload = 'yes') {
    if ('' !== $GLOBALS['lor_fail_add_contains'] && false !== strpos($name, $GLOBALS['lor_fail_add_contains'])) return false;
    if (array_key_exists($name, $GLOBALS['lor_options'])) return false;
    $GLOBALS['lor_options'][$name] = is_string($value) ? $value : (string) $value;
    if (!empty($GLOBALS['lor_after_add_option']) && is_callable($GLOBALS['lor_after_add_option'])) {
        $hook = $GLOBALS['lor_after_add_option']; $GLOBALS['lor_after_add_option'] = null; $hook($name);
    }
    return true;
}
function delete_option($name) { if (!array_key_exists($name, $GLOBALS['lor_options'])) return false; unset($GLOBALS['lor_options'][$name]); return true; }
function mmhq_cam_build_entitlement($user_id) {
    $GLOBALS['lor_entitlement_calls']++;
    return $GLOBALS['lor_entitlement'];
}
function wp_using_ext_object_cache() { return true; }
function lor_headers($path, $raw_body, $nonce) {
    $timestamp = (string) time();
    $canonical = implode("\\n", array(
        'missionmed.lor.s2s.request.v1', 'POST', $path, hash('sha256', $raw_body),
        $timestamp, $nonce, 'lor-studio'
    ));
    $key = hash_hmac('sha256', 'missionmed.lor.s2s.key.v1', MMHQ_HANDOFF_SECRET, true);
    return array(
        'X-MissionMed-LOR-S2S-Timestamp' => $timestamp,
        'X-MissionMed-LOR-S2S-Nonce' => $nonce,
        'X-MissionMed-LOR-S2S-Audience' => 'lor-studio',
        'X-MissionMed-LOR-S2S-Signature' => 'v1=' . hash_hmac('sha256', $canonical, $key),
    );
}
function lor_valid_fixture() {
    $GLOBALS['lor_meta'] = array(
        '_missionmed_lor_enabled' => '1', '_missionmed_lor_canary_enabled' => '1',
        '_missionmed_lor_consent_accepted' => '1', '_missionmed_lor_consent_version' => 'lor-consent-v1',
        '_missionmed_lor_consent_at' => gmdate('c', time() - 60),
        '_missionmed_lor_consent_revoked_at' => '', '_missionmed_lor_revoked_at' => '',
    );
    $GLOBALS['lor_entitlement'] = array(
        'subject' => 'wp:123', 'product' => 'cam', 'source' => 'wordpress_learndash_handoff', 'verified' => true,
        'trusted' => true, 'active' => true, 'status' => 'active', 'course_ids' => array('4000'),
        'program_tier' => '360_match_mentorship', 'restricted' => false, 'revoked' => false,
        'current_access_verified' => true, 'purchase_verified' => true,
        'purchase_match_found' => true, 'enrollment_verified' => true,
        'authority_mode' => 'learndash_and_woocommerce',
        'expires_at' => gmdate('c', time() + 3600), 'evaluated_at' => gmdate('c', time() - 30),
    );
}
require ${JSON.stringify(contractPath)};
${body}
`;
}

function runPhp(program) {
  const result = spawnSync('php', ['-d', 'display_errors=1', '-r', program], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `PHP failed\nstdout:${result.stdout}\nstderr:${result.stderr}`);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('source exposes only signed POST routes, atomic exact CAS, and no browser grant', async () => {
  const source = await readFile(contractPath, 'utf8');
  assert.match(source, /\/lor-studio\/bootstrap\/redeem/u);
  assert.match(source, /\/lor-studio\/current-user-admission/u);
  assert.match(source, /\/lor-studio\/binding\/revoke/u);
  assert.match(source, /'methods' => 'POST'/u);
  assert.match(source, /BINARY option_value = BINARY %s/u);
  assert.match(source, /DELETE value_row, timeout_row FROM/u);
  assert.match(source, /DELETE timeout_row FROM/u);
  assert.match(source, /count\(\$kept\) >= 1024/u);
  assert.match(source, /mmhq_lor_transient_registry_v1/u);
  assert.match(source, /hash_equals\(\$expected_signature, \$signature\)/u);
  assert.match(source, /missionmed\.lor\.s2s\.key\.v1/u);
  assert.doesNotMatch(source, /lorAdmissionGrant|refresh_grant|Authorization:\s*Bearer/iu);
  assert.doesNotMatch(source, /DELETE[^\n]+LIKE|DELETE[^\n]+prefix/iu);
});

test('the live CAM entitlement producer binds its canonical WordPress subject', async () => {
  const source = await readFile(authHandoffPath, 'utf8');
  const start = source.indexOf('function mmhq_cam_build_entitlement($user_id)');
  const end = source.indexOf('function mmhq_cam_build_admin_override', start);
  assert.ok(start >= 0 && end > start);
  const producer = source.slice(start, end);
  assert.match(producer, /'subject'\s*=>\s*'wp:'\s*\.\s*absint\(\$user_id\)/u);
});

test('feature-off default registers no route; enabled mode registers exactly five POST routes', { skip: !phpAvailable }, () => {
  const off = runPhp(phpProgram({
    constants: '',
    body: `mmhq_lor_studio_register_rest_contract(); echo json_encode(array('routes' => count($GLOBALS['lor_routes']), 'enabled' => mmhq_lor_studio_contract_enabled()));`,
  }));
  assert.deepEqual(off, { routes: 0, enabled: false });
  const on = runPhp(phpProgram({
    body: `mmhq_lor_studio_register_rest_contract(); echo json_encode(array_map(function($route) { return array($route[0], $route[1], $route[2]['methods'], $route[2]['permission_callback']); }, $GLOBALS['lor_routes']));`,
  }));
  assert.deepEqual(on, [
    ['missionmed/v1', '/lor-studio/bootstrap/redeem', 'POST', '__return_true'],
    ['missionmed/v1', '/lor-studio/current-user-admission', 'POST', '__return_true'],
    ['missionmed/v1', '/lor-studio/binding/revoke', 'POST', '__return_true'],
    ['missionmed/v1', '/lor-studio/resource-student-entitlement', 'POST', '__return_true'],
    ['missionmed/v1', '/lor-studio/resource-student-entitlement/probe', 'POST', '__return_true'],
  ]);
});

test('one-time code redeems once, returns non-secret binding, and later admission reevaluates gates', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$issued = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$code_names = mmhq_lor_studio_transient_names('code_v1', hash('sha256', $issued['code']));
$redeem_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-bootstrap-redemption-request.v2',
    'audience' => 'lor-studio', 'identityClass' => 'student', 'code' => $issued['code'], 'stateHash' => $state, 'callback' => $callback,
));
$redeem = mmhq_lor_studio_bootstrap_redeem(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/bootstrap/redeem', 'POST', $redeem_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/bootstrap/redeem', $redeem_body, 'lorn1_' . str_repeat('n', 43))
));
$binding = $redeem->data['bindingId'];
$admit_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-admission-request.v2',
    'audience' => 'lor-studio', 'identityClass' => 'student', 'bindingId' => $binding, 'subject' => 'wp:123',
));
$admit = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/current-user-admission', 'POST', $admit_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $admit_body, 'lorn1_' . str_repeat('m', 43))
));
$GLOBALS['lor_meta']['_missionmed_lor_revoked_at'] = gmdate('c', time() - 1);
$revoked = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/current-user-admission', 'POST', $admit_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $admit_body, 'lorn1_' . str_repeat('r', 43))
));
$fresh_replay_headers = lor_headers('/wp-json/missionmed/v1/lor-studio/bootstrap/redeem', $redeem_body, 'lorn1_' . str_repeat('q', 43));
$code_replay = mmhq_lor_studio_bootstrap_redeem(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/bootstrap/redeem', 'POST', $redeem_body, $fresh_replay_headers));
$option_values = implode("\n", array_values($GLOBALS['lor_options']));
echo json_encode(array(
    'code_pattern' => preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', $issued['code']) === 1,
    'bootstrap' => $redeem->data, 'admission' => $admit->data,
    'revoked_code' => $revoked->code, 'replay_code' => $code_replay->code,
    'raw_code_stored' => strpos($option_values, $issued['code']) !== false,
    'code_value_exists' => array_key_exists($code_names[0], $GLOBALS['lor_options']),
    'code_timeout_exists' => array_key_exists($code_names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.equal(result.code_pattern, true);
  assert.equal(result.bootstrap.contract, 'missionmed.lor.wordpress-bootstrap-redemption.v2');
  assert.equal(result.bootstrap.identityClass, 'student');
  assert.match(result.bootstrap.bindingId, /^lorb1_[A-Za-z0-9_-]{43}$/u);
  assert.equal(result.bootstrap.subject, 'wp:123');
  assert.equal(result.admission.contract, 'missionmed.lor.wordpress-admission.v4');
  assert.equal(result.admission.identityClass, 'student');
  assert.equal(result.admission.admitted, true);
  assert.equal(result.admission.canaryEnabled, true);
  assert.equal(result.admission.canaryConsented, true);
  assert.equal(result.revoked_code, 'missionmed_lor_contract_unavailable');
  assert.equal(result.replay_code, 'missionmed_lor_contract_unavailable');
  assert.equal(result.raw_code_stored, false);
  assert.equal(result.code_value_exists, false);
  assert.equal(result.code_timeout_exists, false);
});

test('a real binding admits once, then rejects signature/body replay and a fresh wrong subject', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$issued = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$redeem_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-bootstrap-redemption-request.v2',
    'audience' => 'lor-studio', 'identityClass' => 'student', 'code' => $issued['code'], 'stateHash' => $state, 'callback' => $callback,
));
$redeem = mmhq_lor_studio_bootstrap_redeem(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/bootstrap/redeem', 'POST', $redeem_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/bootstrap/redeem', $redeem_body, 'lorn1_' . str_repeat('r', 43))
));
$binding = $redeem->data['bindingId'];
$body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-admission-request.v2', 'audience' => 'lor-studio',
    'identityClass' => 'student', 'bindingId' => $binding, 'subject' => 'wp:123',
));
$nonce = 'lorn1_' . str_repeat('z', 43);
$headers = lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $body, $nonce);
$tampered = $headers; $tampered['X-MissionMed-LOR-S2S-Signature'] = 'v1=' . str_repeat('0', 64);
$wrong_signature = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/current-user-admission', 'POST', $body, $tampered));
$first = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/current-user-admission', 'POST', $body, $headers));
$replay = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/current-user-admission', 'POST', $body, $headers));
$tampered_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-admission-request.v2', 'audience' => 'lor-studio',
    'identityClass' => 'student', 'bindingId' => $binding, 'subject' => 'wp:124',
));
$tampered_headers = lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $body, 'lorn1_' . str_repeat('t', 43));
$body_tamper = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/current-user-admission', 'POST', $tampered_body, $tampered_headers));
$wrong_subject_headers = lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $tampered_body, 'lorn1_' . str_repeat('w', 43));
$wrong_subject = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/current-user-admission', 'POST', $tampered_body, $wrong_subject_headers));
$nonce_names = mmhq_lor_studio_transient_names('nonce_v1', hash('sha256', $nonce));
echo json_encode(array(
    'wrong_signature' => $wrong_signature->code,
    'first_admitted' => $first->data['admitted'],
    'replay' => $replay->code,
    'body_tamper' => $body_tamper->code,
    'wrong_subject' => $wrong_subject->code,
    'nonce_value_exists' => array_key_exists($nonce_names[0], $GLOBALS['lor_options']),
    'nonce_timeout_exists' => array_key_exists($nonce_names[1], $GLOBALS['lor_options']),
    'entitlement_calls' => $GLOBALS['lor_entitlement_calls'],
));
`,
  }));
  assert.deepEqual(result, {
    wrong_signature: 'missionmed_lor_contract_unavailable',
    first_admitted: true,
    replay: 'missionmed_lor_contract_unavailable',
    body_tamper: 'missionmed_lor_contract_unavailable',
    wrong_subject: 'missionmed_lor_contract_unavailable',
    nonce_value_exists: true,
    nonce_timeout_exists: true,
    entitlement_calls: 3,
  });
});

test('binary CAS rejects case-only and trailing-space interleaving replacements', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$case_name = '_transient_mmhq_lor_code_v1_' . str_repeat('a', 64);
$space_name = '_transient_mmhq_lor_code_v1_' . str_repeat('b', 64);
$GLOBALS['lor_options'][$case_name] = 'ExactValue';
$GLOBALS['lor_options'][$space_name] = 'ExactValue';
$GLOBALS['lor_before_cas'] = function($option_name, $expected) { $GLOBALS['lor_options'][$option_name] = 'exactvalue'; };
$case_delete = mmhq_lor_studio_delete_exact_option($case_name, 'ExactValue');
$GLOBALS['lor_before_cas'] = function($option_name, $expected) { $GLOBALS['lor_options'][$option_name] = 'ExactValue '; };
$space_delete = mmhq_lor_studio_delete_exact_option($space_name, 'ExactValue');
echo json_encode(array(
    'case_delete' => $case_delete, 'case_value' => $GLOBALS['lor_options'][$case_name],
    'space_delete' => $space_delete, 'space_value' => $GLOBALS['lor_options'][$space_name],
));
`,
  }));
  assert.deepEqual(result, {
    case_delete: false,
    case_value: 'exactvalue',
    space_delete: false,
    space_value: 'ExactValue ',
  });
});

test('a live claim serializes concurrent same-subject issue-window writers', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$digest = hash('sha256', 'wp:123');
$names = mmhq_lor_studio_transient_names('issue_v1', $digest);
$record = array(
    'contract' => 'missionmed.lor.wordpress-bootstrap-issue-window.v1',
    'issuedAt' => time(), 'expiresAt' => time() + 60, 'epoch' => 'dr133-s2s-v1',
);
$second = null;
$GLOBALS['lor_after_add_option'] = function($option_name) use (&$second, $names, $digest, $record) {
    if ($option_name === $names[1]) {
        $second = mmhq_lor_studio_store_once('issue_v1', $digest, $record, time() + 60);
    }
};
$first = mmhq_lor_studio_store_once('issue_v1', $digest, $record, time() + 60);
$third = mmhq_lor_studio_store_once('issue_v1', $digest, $record, time() + 60);
$registry_name = mmhq_lor_studio_registry_name('issue_v1', $digest);
$registry = json_decode($GLOBALS['lor_options'][$registry_name], true);
$timeout = $GLOBALS['lor_options'][$names[1]] ?? '';
$stored_envelope = mmhq_lor_studio_decode_storage_envelope($GLOBALS['lor_options'][$names[0]] ?? '');
echo json_encode(array(
    'first' => $first, 'second' => $second, 'third' => $third,
    'value_exists' => array_key_exists($names[0], $GLOBALS['lor_options']),
    'timeout_exists' => array_key_exists($names[1], $GLOBALS['lor_options']),
    'timeout_finalized' => false === mmhq_lor_studio_claim_started_at($timeout) && (int) $timeout > time(),
    'record_exact' => is_array($stored_envelope) && $stored_envelope['record'] === $record,
    'registry_entries' => count($registry['entries']),
    'registry_value' => $registry['entries'][0]['valueName'],
));
`,
  }));
  assert.deepEqual(result, {
    first: true,
    second: false,
    third: false,
    value_exists: true,
    timeout_exists: true,
    timeout_finalized: true,
    record_exact: true,
    registry_entries: 1,
    registry_value: `_transient_mmhq_lor_issue_v1_${result.registry_value.slice(-64)}`,
  });
  assert.match(result.registry_value, /^_transient_mmhq_lor_issue_v1_[a-f0-9]{64}$/u);
});

test('partial code mint failure removes every transient pair without a broad delete', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$GLOBALS['lor_fail_add_contains'] = '_transient_mmhq_lor_code_v1_';
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$issued = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$transient_names = array_values(array_filter(array_keys($GLOBALS['lor_options']), function($name) {
    return 0 === strpos($name, '_transient_');
}));
$registry_names = array_values(array_filter(array_keys($GLOBALS['lor_options']), function($name) {
    return 0 === strpos($name, 'mmhq_lor_transient_registry_v1_');
}));
echo json_encode(array(
    'error' => $issued->code,
    'status' => $issued->get_error_data()['status'],
    'transient_names' => $transient_names,
    'registry_exists' => count($registry_names) > 0,
));
`,
  }));
  assert.deepEqual(result, {
    error: 'missionmed_lor_contract_unavailable',
    status: 503,
    transient_names: [],
    registry_exists: true,
  });
});

test('bounded registry prunes expired LOR pairs even with an external object cache', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$old_digest = str_repeat('a', 64);
$new_digest = 'aa' . str_repeat('b', 62);
$old_names = mmhq_lor_studio_transient_names('nonce_v1', $old_digest);
$new_names = mmhq_lor_studio_transient_names('nonce_v1', $new_digest);
$registry_name = mmhq_lor_studio_registry_name('nonce_v1', $old_digest);
$old_raw = '{"expired":true}';
$GLOBALS['lor_options'][$old_names[0]] = $old_raw;
$GLOBALS['lor_options'][$old_names[1]] = (string) (time() - 5);
$GLOBALS['lor_options'][$registry_name] = wp_json_encode(mmhq_lor_studio_registry_record(array(array(
    'valueName' => $old_names[0], 'timeoutName' => $old_names[1], 'expiresAt' => time() - 5,
	'valueHash' => hash('sha256', $old_raw),
))));
$stored = mmhq_lor_studio_store_once('nonce_v1', $new_digest, array('fresh' => true), time() + 60);
$registry = json_decode($GLOBALS['lor_options'][$registry_name], true);
echo json_encode(array(
    'external_cache' => wp_using_ext_object_cache(), 'stored' => $stored,
    'old_value' => array_key_exists($old_names[0], $GLOBALS['lor_options']),
    'old_timeout' => array_key_exists($old_names[1], $GLOBALS['lor_options']),
    'new_value' => array_key_exists($new_names[0], $GLOBALS['lor_options']),
    'new_timeout' => array_key_exists($new_names[1], $GLOBALS['lor_options']),
    'registry_count' => count($registry['entries']),
));
`,
  }));
  assert.deepEqual(result, {
    external_cache: true,
    stored: true,
    old_value: false,
    old_timeout: false,
    new_value: true,
    new_timeout: true,
    registry_count: 1,
  });
});

test('a full cleanup shard cannot exhaust an unrelated nonce shard', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$entries = array(); $expires = time() + 90;
for ($index = 0; $index < 1024; $index++) {
    $digest = 'aa' . str_pad(dechex($index), 62, '0', STR_PAD_LEFT);
    $names = mmhq_lor_studio_transient_names('nonce_v1', $digest);
    $GLOBALS['lor_options'][$names[0]] = '{"occupied":true}';
    $GLOBALS['lor_options'][$names[1]] = (string) $expires;
    $entries[] = array(
		'valueName' => $names[0], 'timeoutName' => $names[1], 'expiresAt' => $expires,
		'valueHash' => hash('sha256', '{"occupied":true}'),
	);
}
$full_registry = mmhq_lor_studio_registry_name('nonce_v1', str_repeat('a', 64));
$GLOBALS['lor_options'][$full_registry] = wp_json_encode(mmhq_lor_studio_registry_record($entries));
$clean_digest = 'bb' . str_repeat('c', 62);
$clean_registry = mmhq_lor_studio_registry_name('nonce_v1', $clean_digest);
$stored = mmhq_lor_studio_store_once('nonce_v1', $clean_digest, array('fresh' => true), $expires);
echo json_encode(array(
    'registries_distinct' => $full_registry !== $clean_registry,
    'stored' => $stored,
    'clean_registry_exists' => array_key_exists($clean_registry, $GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    registries_distinct: true,
    stored: true,
    clean_registry_exists: true,
  });
});

test('cleanup failure fails closed and removes the newly attempted exact pair', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$old_digest = str_repeat('c', 64);
$new_digest = 'cc' . str_repeat('d', 62);
$old_names = mmhq_lor_studio_transient_names('binding_v1', $old_digest);
$new_names = mmhq_lor_studio_transient_names('binding_v1', $new_digest);
$registry_name = mmhq_lor_studio_registry_name('binding_v1', $old_digest);
$old_raw = '{"expired":true}';
$GLOBALS['lor_options'][$old_names[0]] = $old_raw;
$GLOBALS['lor_options'][$old_names[1]] = (string) (time() - 5);
$GLOBALS['lor_options'][$registry_name] = wp_json_encode(mmhq_lor_studio_registry_record(array(array(
    'valueName' => $old_names[0], 'timeoutName' => $old_names[1], 'expiresAt' => time() - 5,
	'valueHash' => hash('sha256', $old_raw),
))));
$GLOBALS['lor_query_fail_names'][] = $old_names[0];
$stored = mmhq_lor_studio_store_once('binding_v1', $new_digest, array('fresh' => true), time() + 60);
echo json_encode(array(
    'stored' => $stored,
    'old_value' => array_key_exists($old_names[0], $GLOBALS['lor_options']),
    'old_timeout' => array_key_exists($old_names[1], $GLOBALS['lor_options']),
    'new_value' => array_key_exists($new_names[0], $GLOBALS['lor_options']),
    'new_timeout' => array_key_exists($new_names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    stored: false,
    old_value: true,
    old_timeout: true,
    new_value: false,
    new_timeout: false,
  });
});

test('a failed atomic pair delete preserves the complete live generation', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$old_digest = str_repeat('e', 64);
$new_digest = 'ee' . str_repeat('f', 62);
$old_names = mmhq_lor_studio_transient_names('binding_v1', $old_digest);
$new_names = mmhq_lor_studio_transient_names('binding_v1', $new_digest);
$old_record = array('binding' => 'old');
$old_expiry = time() + 8 * 60 * 60;
$old_raw = '';
$created = mmhq_lor_studio_store_once('binding_v1', $old_digest, $old_record, $old_expiry, $old_raw);
$GLOBALS['lor_query_fail_once_names'][] = $old_names[1];
$deleted = mmhq_lor_studio_delete_exact_pair('binding_v1', $old_digest, $old_raw);
$half_before = array(
    array_key_exists($old_names[0], $GLOBALS['lor_options']),
    array_key_exists($old_names[1], $GLOBALS['lor_options']),
);
$later = mmhq_lor_studio_store_once('binding_v1', $new_digest, array('fresh' => true), time() + 90);
$orphan_after_heal = array(
    array_key_exists($old_names[0], $GLOBALS['lor_options']),
    array_key_exists($old_names[1], $GLOBALS['lor_options']),
);
$retry = mmhq_lor_studio_store_once('binding_v1', $old_digest, array('binding' => 'replacement'), time() + 120);
echo json_encode(array(
    'created' => $created, 'deleted' => $deleted, 'half_before' => $half_before,
    'orphan_after_heal' => $orphan_after_heal,
    'later' => $later,
    'later_value' => array_key_exists($new_names[0], $GLOBALS['lor_options']),
    'later_timeout' => array_key_exists($new_names[1], $GLOBALS['lor_options']),
    'retry' => $retry,
    'retry_value' => array_key_exists($old_names[0], $GLOBALS['lor_options']),
    'retry_timeout' => array_key_exists($old_names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    created: true,
    deleted: false,
    half_before: [true, true],
    orphan_after_heal: [true, true],
    later: true,
    later_value: true,
    later_timeout: true,
    retry: false,
    retry_value: true,
    retry_timeout: true,
  });
});

test('stale registry cleanup adopts a recreated finalized generation instead of deleting it', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$first_digest = 'ab' . str_repeat('a', 62);
$second_digest = 'ab' . str_repeat('b', 62);
$first_names = mmhq_lor_studio_transient_names('nonce_v1', $first_digest);
$second_names = mmhq_lor_studio_transient_names('nonce_v1', $second_digest);
$registry_name = mmhq_lor_studio_registry_name('nonce_v1', $first_digest);
$old_expiry = time() - 5;
$old_raw = wp_json_encode(mmhq_lor_studio_storage_envelope(array('generation' => 'old'), $old_expiry));
$new_expiry = time() + 120;
$new_raw = wp_json_encode(mmhq_lor_studio_storage_envelope(array('generation' => 'new'), $new_expiry));
$GLOBALS['lor_options'][$first_names[0]] = $new_raw;
$GLOBALS['lor_options'][$first_names[1]] = (string) $new_expiry;
$GLOBALS['lor_options'][$registry_name] = wp_json_encode(mmhq_lor_studio_registry_record(array(array(
	'valueName' => $first_names[0], 'timeoutName' => $first_names[1],
	'expiresAt' => $old_expiry, 'valueHash' => hash('sha256', $old_raw),
))));
$stored = mmhq_lor_studio_store_once('nonce_v1', $second_digest, array('fresh' => true), time() + 90);
$registry = json_decode($GLOBALS['lor_options'][$registry_name], true);
$first_entry = null;
foreach ($registry['entries'] as $entry) {
	if ($entry['valueName'] === $first_names[0]) $first_entry = $entry;
}
echo json_encode(array(
	'stored' => $stored,
	'first_value_preserved' => ($GLOBALS['lor_options'][$first_names[0]] ?? '') === $new_raw,
	'first_timeout_preserved' => ($GLOBALS['lor_options'][$first_names[1]] ?? '') === (string) $new_expiry,
	'second_complete' => array_key_exists($second_names[0], $GLOBALS['lor_options'])
		&& array_key_exists($second_names[1], $GLOBALS['lor_options']),
	'registry_count' => count($registry['entries']),
	'adopted_hash' => is_array($first_entry) ? $first_entry['valueHash'] : '',
	'adopted_expiry' => is_array($first_entry) ? $first_entry['expiresAt'] : 0,
));
`,
  }));
  assert.deepEqual(result, {
    stored: true,
    first_value_preserved: true,
    first_timeout_preserved: true,
    second_complete: true,
    registry_count: 2,
    adopted_hash: result.adopted_hash,
    adopted_expiry: result.adopted_expiry,
  });
  assert.match(result.adopted_hash, /^[a-f0-9]{64}$/u);
  assert.ok(result.adopted_expiry > Math.floor(Date.now() / 1000));
});

test('atomic pair deletion cannot remove a same-expiry recreated generation', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$digest = str_repeat('d', 64);
$names = mmhq_lor_studio_transient_names('binding_v1', $digest);
$expiry = time() + 120;
$first_raw = '';
$created = mmhq_lor_studio_store_once('binding_v1', $digest, array('version' => 1), $expiry, $first_raw);
$replacement_raw = wp_json_encode(mmhq_lor_studio_storage_envelope(array('version' => 2), $expiry));
$GLOBALS['lor_before_pair_delete'] = function($value_name, $expected_value, $timeout_name, $expected_timeout) use ($replacement_raw, $expiry) {
	$GLOBALS['lor_options'][$value_name] = $replacement_raw;
	$GLOBALS['lor_options'][$timeout_name] = (string) $expiry;
};
$deleted = mmhq_lor_studio_delete_exact_pair('binding_v1', $digest, $first_raw);
list($record) = mmhq_lor_studio_read_record_by_digest('binding_v1', $digest);
echo json_encode(array(
	'created' => $created, 'deleted' => $deleted,
	'replacement_value_preserved' => ($GLOBALS['lor_options'][$names[0]] ?? '') === $replacement_raw,
	'replacement_timeout_preserved' => ($GLOBALS['lor_options'][$names[1]] ?? '') === (string) $expiry,
	'read_version' => is_array($record) ? $record['version'] : 0,
));
`,
  }));
  assert.deepEqual(result, {
    created: true,
    deleted: false,
    replacement_value_preserved: true,
    replacement_timeout_preserved: true,
    read_version: 2,
  });
});

test('same-second claim replacement has a distinct owner token and survives stale-owner cleanup', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$issued = time() - 31;
$first_claim = mmhq_lor_studio_claim_timeout_value($issued);
$second_claim = mmhq_lor_studio_claim_timeout_value($issued);
$digest = str_repeat('f', 64);
$names = mmhq_lor_studio_transient_names('issue_v1', $digest);
$GLOBALS['lor_options'][$names[1]] = $first_claim;
$GLOBALS['lor_before_cas'] = function($option_name, $expected) use ($names, $second_claim) {
	if ($option_name === $names[1]) $GLOBALS['lor_options'][$option_name] = $second_claim;
};
$prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
echo json_encode(array(
	'distinct' => $first_claim !== $second_claim,
	'first_started' => mmhq_lor_studio_claim_started_at($first_claim),
	'second_started' => mmhq_lor_studio_claim_started_at($second_claim),
	'prepared' => $prepared,
	'replacement_preserved' => ($GLOBALS['lor_options'][$names[1]] ?? '') === $second_claim,
));
`,
  }));
  assert.deepEqual(result, {
    distinct: true,
    first_started: result.first_started,
    second_started: result.second_started,
    prepared: false,
    replacement_preserved: true,
  });
  assert.equal(result.first_started, result.second_started);
  assert.ok(result.first_started > 0);
});

test('stale-claim cleanup cannot delete a pair finalized after observation', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$digest = str_repeat('e', 64);
$names = mmhq_lor_studio_transient_names('issue_v1', $digest);
$expiry = time() + 120;
$record = array('contract' => 'missionmed.lor.wordpress-bootstrap-issue-window.v1');
$value_raw = wp_json_encode(mmhq_lor_studio_storage_envelope($record, $expiry));
$stale_claim = mmhq_lor_studio_claim_timeout_value(time() - 31);
$GLOBALS['lor_options'][$names[0]] = $value_raw;
$GLOBALS['lor_options'][$names[1]] = $stale_claim;
$GLOBALS['lor_before_pair_delete'] = function($value_name, $expected_value, $timeout_name, $expected_timeout) use ($expiry) {
	$GLOBALS['lor_options'][$timeout_name] = (string) $expiry;
};
$prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
$registered = mmhq_lor_studio_register_transient_pair(
	'issue_v1', $digest, $names[0], $names[1], $expiry, hash('sha256', $value_raw)
);
$retry_prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
echo json_encode(array(
	'prepared' => $prepared,
	'pair_survives' => ($GLOBALS['lor_options'][$names[0]] ?? '') === $value_raw
		&& ($GLOBALS['lor_options'][$names[1]] ?? '') === (string) $expiry,
	'registered' => $registered,
	'retry_prepared' => $retry_prepared,
));
`,
  }));
  assert.deepEqual(result, {
    prepared: false,
    pair_survives: true,
    registered: true,
    retry_prepared: false,
  });
});

test('split observation cannot orphan a writer that finalizes between value and timeout reads', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$digest = str_repeat('c', 64);
$names = mmhq_lor_studio_transient_names('issue_v1', $digest);
$expiry = time() + 120;
$record = array('contract' => 'missionmed.lor.wordpress-bootstrap-issue-window.v1');
$value_raw = wp_json_encode(mmhq_lor_studio_storage_envelope($record, $expiry));
$GLOBALS['lor_options'][$names[1]] = mmhq_lor_studio_claim_timeout_value(time() - 31);
$GLOBALS['lor_after_get_var'] = function($option_name, $observed_value) use ($names, $value_raw, $expiry) {
	if ($option_name === $names[0] && null === $observed_value) {
		$GLOBALS['lor_options'][$names[0]] = $value_raw;
		$GLOBALS['lor_options'][$names[1]] = (string) $expiry;
	}
};
$prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
$registered = mmhq_lor_studio_register_transient_pair(
	'issue_v1', $digest, $names[0], $names[1], $expiry, hash('sha256', $value_raw)
);
$retry_prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
echo json_encode(array(
	'prepared' => $prepared,
	'pair_survives' => ($GLOBALS['lor_options'][$names[0]] ?? '') === $value_raw
		&& ($GLOBALS['lor_options'][$names[1]] ?? '') === (string) $expiry,
	'registered' => $registered,
	'retry_prepared' => $retry_prepared,
));
`,
  }));
  assert.deepEqual(result, {
    prepared: false,
    pair_survives: true,
    registered: true,
    retry_prepared: false,
  });
});

test('value collision cannot let a displaced writer delete the live claim and strand the value', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$digest = str_repeat('b', 64);
$names = mmhq_lor_studio_transient_names('issue_v1', $digest);
$expiry = time() + 120;
$intruder_raw = wp_json_encode(mmhq_lor_studio_storage_envelope(array('writer' => 'stale'), $expiry));
$GLOBALS['lor_after_add_option'] = function($option_name) use ($names, $intruder_raw) {
	if ($option_name === $names[1]) {
		$GLOBALS['lor_options'][$names[0]] = $intruder_raw;
	}
};
$stored = mmhq_lor_studio_store_once(
	'issue_v1',
	$digest,
	array('writer' => 'current'),
	$expiry
);
$claim = $GLOBALS['lor_options'][$names[1]] ?? '';
$claim_preserved = false !== mmhq_lor_studio_claim_started_at($claim);
$value_preserved = ($GLOBALS['lor_options'][$names[0]] ?? '') === $intruder_raw;
$value_only = array_key_exists($names[0], $GLOBALS['lor_options'])
	&& !array_key_exists($names[1], $GLOBALS['lor_options']);
if ($claim_preserved) {
	$GLOBALS['lor_options'][$names[1]] = '8'
		. str_pad((string) (time() - 31), 10, '0', STR_PAD_LEFT)
		. substr($claim, -8);
}
$prepared = mmhq_lor_studio_prepare_transient_slot('issue_v1', $digest);
echo json_encode(array(
	'stored' => $stored,
	'claim_preserved' => $claim_preserved,
	'value_preserved' => $value_preserved,
	'value_only' => $value_only,
	'prepared' => $prepared,
	'empty_after_recovery' => !array_key_exists($names[0], $GLOBALS['lor_options'])
		&& !array_key_exists($names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    stored: false,
    claim_preserved: true,
    value_preserved: true,
    value_only: false,
    prepared: true,
    empty_after_recovery: true,
  });
});

test('one active issue window rate-bounds a subject without minting another code', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$first = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$before = count($GLOBALS['lor_options']);
$second = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
echo json_encode(array(
    'first_code' => preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', $first['code']) === 1,
    'second_error' => $second->code,
    'second_status' => $second->get_error_data()['status'],
    'option_count_unchanged' => $before === count($GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    first_code: true,
    second_error: 'missionmed_lor_contract_unavailable',
    second_status: 503,
    option_count_unchanged: true,
  });
});

test('an expired deterministic issue window retries without unrelated traffic', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$first = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$issue_names = mmhq_lor_studio_transient_names('issue_v1', mmhq_lor_studio_identity_subject_digest('wp:123', 'student'));
$GLOBALS['lor_options'][$issue_names[1]] = (string) (time() - 1);
$second = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
echo json_encode(array(
    'first' => preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', $first['code']) === 1,
    'second' => preg_match('/^lorc1_[A-Za-z0-9_-]{43}$/D', $second['code']) === 1,
    'different' => $first['code'] !== $second['code'],
    'issue_value' => array_key_exists($issue_names[0], $GLOBALS['lor_options']),
    'issue_timeout' => array_key_exists($issue_names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.deepEqual(result, {
    first: true,
    second: true,
    different: true,
    issue_value: true,
    issue_timeout: true,
  });
});

test('signed revocation invalidates a copied binding and removes binding custody', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$state = str_repeat('a', 64);
$callback = 'https://missionmed.example.test/api/lor-studio/auth/callback?audience=lor-studio&state=' . $state;
$issued = mmhq_lor_studio_issue_browser_bootstrap_code(wp_get_current_user(), $callback);
$redeem_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-bootstrap-redemption-request.v2',
    'audience' => 'lor-studio', 'identityClass' => 'student', 'code' => $issued['code'], 'stateHash' => $state, 'callback' => $callback,
));
$redeem = mmhq_lor_studio_bootstrap_redeem(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/bootstrap/redeem', 'POST', $redeem_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/bootstrap/redeem', $redeem_body, 'lorn1_' . str_repeat('r', 43))
));
$binding = $redeem->data['bindingId'];
$admit_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-admission-request.v2', 'audience' => 'lor-studio',
    'identityClass' => 'student', 'bindingId' => $binding, 'subject' => 'wp:123',
));
$first = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/current-user-admission', 'POST', $admit_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $admit_body, 'lorn1_' . str_repeat('a', 43))
));
$revoke_body = wp_json_encode(array(
    'contract' => 'missionmed.lor.wordpress-binding-revocation-request.v2', 'audience' => 'lor-studio',
    'identityClass' => 'student', 'bindingId' => $binding, 'subject' => 'wp:123',
));
$revoke = mmhq_lor_studio_revoke_binding(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/binding/revoke', 'POST', $revoke_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/binding/revoke', $revoke_body, 'lorn1_' . str_repeat('v', 43))
));
$copied = mmhq_lor_studio_current_user_admission(new Lor_Test_Rest_Request(
    '/missionmed/v1/lor-studio/current-user-admission', 'POST', $admit_body,
    lor_headers('/wp-json/missionmed/v1/lor-studio/current-user-admission', $admit_body, 'lorn1_' . str_repeat('c', 43))
));
$binding_names = mmhq_lor_studio_transient_names('binding_v1', hash('sha256', $binding));
$index_names = mmhq_lor_studio_transient_names('binding_subject_v1', mmhq_lor_studio_identity_subject_digest('wp:123', 'student'));
echo json_encode(array(
    'first_admitted' => $first->data['admitted'],
    'revocation' => $revoke->data,
    'copied_error' => $copied->code,
    'binding_value' => array_key_exists($binding_names[0], $GLOBALS['lor_options']),
    'binding_timeout' => array_key_exists($binding_names[1], $GLOBALS['lor_options']),
    'index_value' => array_key_exists($index_names[0], $GLOBALS['lor_options']),
    'index_timeout' => array_key_exists($index_names[1], $GLOBALS['lor_options']),
));
`,
  }));
  assert.equal(result.first_admitted, true);
  assert.deepEqual(result.revocation, {
    contract: 'missionmed.lor.wordpress-binding-revocation.v2',
    audience: 'lor-studio',
    identityClass: 'student',
    subject: 'wp:123',
    bindingId: result.revocation.bindingId,
    revoked: true,
    revokedAt: result.revocation.revokedAt,
  });
  assert.match(result.revocation.bindingId, /^lorb1_[A-Za-z0-9_-]{43}$/u);
  assert.match(result.revocation.revokedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/u);
  assert.equal(result.copied_error, 'missionmed_lor_contract_unavailable');
  assert.deepEqual({
    binding_value: result.binding_value,
    binding_timeout: result.binding_timeout,
    index_value: result.index_value,
    index_timeout: result.index_timeout,
  }, {
    binding_value: false,
    binding_timeout: false,
    index_value: false,
    index_timeout: false,
  });
});

test('entitlement remains server-resolved, current, explicit-course, and gate complete', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$valid = mmhq_lor_studio_identity_entitlement_for_user(123);
$GLOBALS['lor_entitlement']['course_ids'] = array('3893');
$wrong_course = mmhq_lor_studio_identity_entitlement_for_user(123);
lor_valid_fixture(); unset($GLOBALS['lor_meta']['_missionmed_lor_consent_accepted']);
$missing_consent = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array(
    'valid' => $valid, 'wrong_course' => is_wp_error($wrong_course),
    'missing_consent' => $missing_consent,
));
`,
  }));
  assert.deepEqual(result.valid, {
    contract: 'missionmed.lor.wordpress-entitlement.v1',
    subject: 'wp:123',
    admitted: true,
    canaryEnabled: true,
    canaryConsented: true,
  });
  assert.equal(result.wrong_course, true);
  assert.equal(result.missing_consent.admitted, true);
  assert.equal(result.missing_consent.canaryEnabled, true);
  assert.equal(result.missing_consent.canaryConsented, false);
});

test('DR-145 direct LearnDash enrollment is exact and cannot be hybridized with commerce authority', { skip: !phpAvailable }, () => {
  const directConstants = enabledConstants
    .replace("define('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS', '4000');", "define('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS', '3893');")
    .replace("define('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS', '360_match_mentorship');", "define('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS', '360elite');");
  const result = runPhp(phpProgram({
    constants: directConstants,
    body: `
lor_valid_fixture();
$GLOBALS['lor_entitlement']['course_ids'] = array('3893');
$GLOBALS['lor_entitlement']['program_tier'] = '360elite';
$GLOBALS['lor_entitlement']['purchase_verified'] = false;
$GLOBALS['lor_entitlement']['purchase_match_found'] = false;
$GLOBALS['lor_entitlement']['enrollment_verified'] = true;
$GLOBALS['lor_entitlement']['authority_mode'] = 'learndash_current_access';
$direct = mmhq_lor_studio_identity_entitlement_for_user(123);

$GLOBALS['lor_entitlement']['purchase_match_found'] = true;
$hybrid_match = mmhq_lor_studio_identity_entitlement_for_user(123);
$GLOBALS['lor_entitlement']['purchase_match_found'] = false;
$GLOBALS['lor_entitlement']['enrollment_verified'] = false;
$unverified = mmhq_lor_studio_identity_entitlement_for_user(123);
$GLOBALS['lor_entitlement']['enrollment_verified'] = true;
$GLOBALS['lor_entitlement']['authority_mode'] = 'learndash_and_woocommerce';
$hybrid_mode = mmhq_lor_studio_identity_entitlement_for_user(123);
$GLOBALS['lor_entitlement']['authority_mode'] = 'learndash_current_access';
unset($GLOBALS['lor_entitlement']['purchase_match_found']);
$missing_axis = mmhq_lor_studio_identity_entitlement_for_user(123);

echo json_encode(array(
    'direct' => $direct,
    'hybrid_match' => is_wp_error($hybrid_match),
    'unverified' => is_wp_error($unverified),
    'hybrid_mode' => is_wp_error($hybrid_mode),
    'missing_axis' => is_wp_error($missing_axis),
));
`,
  }));
  assert.deepEqual(result, {
    direct: {
      contract: 'missionmed.lor.wordpress-entitlement.v1',
      subject: 'wp:123',
      admitted: true,
      canaryEnabled: true,
      canaryConsented: true,
    },
    hybrid_match: true,
    unverified: true,
    hybrid_mode: true,
    missing_axis: true,
  });
});

test('DR-145 Founder canary is exact, server-owned, gate-complete, and admin alone is denied', { skip: !phpAvailable }, () => {
  const founderConstants = `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', 'brinyu');
`;
  const result = runPhp(phpProgram({
    constants: founderConstants,
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = true;
$GLOBALS['lor_entitlement'] = null;
$accepted = mmhq_lor_studio_identity_entitlement_for_user(123);
$accepted_entitlement_calls = $GLOBALS['lor_entitlement_calls'];

lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'another_admin'; $GLOBALS['lor_manage_options'] = true;
$wrong_login = mmhq_lor_studio_identity_entitlement_for_user(123);

lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu'; $GLOBALS['lor_manage_options'] = false;
$no_capability = mmhq_lor_studio_identity_entitlement_for_user(123);

$GLOBALS['lor_meta'] = array(); $GLOBALS['lor_entitlement'] = null;
$GLOBALS['lor_user_login'] = 'brinyu'; $GLOBALS['lor_manage_options'] = true;
$admin_alone = mmhq_lor_studio_identity_entitlement_for_user(123);

lor_valid_fixture(); $GLOBALS['lor_entitlement'] = null;
unset($GLOBALS['lor_meta']['_missionmed_lor_canary_enabled']);
$no_membership = mmhq_lor_studio_identity_entitlement_for_user(123);

lor_valid_fixture(); $GLOBALS['lor_entitlement'] = null;
unset($GLOBALS['lor_meta']['_missionmed_lor_consent_accepted']);
$no_consent = mmhq_lor_studio_identity_entitlement_for_user(123);

lor_valid_fixture(); $GLOBALS['lor_entitlement'] = null;
$GLOBALS['lor_meta']['_missionmed_lor_revoked_at'] = gmdate('c', time() - 1);
$revoked = mmhq_lor_studio_identity_entitlement_for_user(123);

$gate_denials = array();
foreach (array(
    '_missionmed_lor_enabled',
    '_missionmed_lor_canary_enabled',
    '_missionmed_lor_consent_accepted',
    '_missionmed_lor_consent_version',
    '_missionmed_lor_consent_at',
) as $missing_key) {
    lor_valid_fixture();
    unset($GLOBALS['lor_meta'][$missing_key]);
    $gate_denials[$missing_key] = is_wp_error(mmhq_lor_studio_identity_entitlement_for_user(123));
}
foreach (array(
    '_missionmed_lor_revoked_at',
    '_missionmed_lor_consent_revoked_at',
) as $revoked_key) {
    lor_valid_fixture();
    $GLOBALS['lor_meta'][$revoked_key] = gmdate('c', time() - 1);
    $gate_denials[$revoked_key] = is_wp_error(mmhq_lor_studio_identity_entitlement_for_user(123));
}

echo json_encode(array(
    'accepted' => $accepted,
    'accepted_entitlement_calls' => $accepted_entitlement_calls,
    'wrong_login' => is_wp_error($wrong_login),
    'no_capability' => is_wp_error($no_capability),
    'admin_alone' => is_wp_error($admin_alone),
    'no_membership' => is_wp_error($no_membership),
    'no_consent' => is_wp_error($no_consent),
    'revoked' => is_wp_error($revoked),
    'gate_denials' => $gate_denials,
));
`,
  }));
  assert.deepEqual(result, {
    accepted: {
      contract: 'missionmed.lor.wordpress-entitlement.v1',
      subject: 'wp:123',
      admitted: true,
      canaryEnabled: true,
      canaryConsented: true,
    },
    accepted_entitlement_calls: 0,
    wrong_login: true,
    no_capability: true,
    admin_alone: true,
    no_membership: true,
    no_consent: true,
    revoked: true,
    gate_denials: {
      _missionmed_lor_enabled: true,
      _missionmed_lor_canary_enabled: true,
      _missionmed_lor_consent_accepted: true,
      _missionmed_lor_consent_version: true,
      _missionmed_lor_consent_at: true,
      _missionmed_lor_revoked_at: true,
      _missionmed_lor_consent_revoked_at: true,
    },
  });

  const wrongConfiguration = runPhp(phpProgram({
    constants: `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', 'another_admin');
`,
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = true;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection)));
`,
  }));
  assert.deepEqual(wrongConfiguration, { denied: true });

  for (const configuredLogin of ['BRINYU', ' brinyu', 'brinyu ', 'brinyu,other', '']) {
    const aliasedConfiguration = runPhp(phpProgram({
      constants: `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', ${JSON.stringify(configuredLogin)});
`,
      body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = true;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection)));
`,
    }));
    assert.deepEqual(aliasedConfiguration, { denied: true });

    const revokedCapabilityConfiguration = runPhp(phpProgram({
      constants: `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', ${JSON.stringify(configuredLogin)});
`,
      body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = false;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection), 'entitlement_calls' => $GLOBALS['lor_entitlement_calls']));
`,
    }));
    assert.deepEqual(revokedCapabilityConfiguration, { denied: true, entitlement_calls: 0 });
  }

  const missingConfiguration = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = true;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection)));
`,
  }));
  assert.deepEqual(missingConfiguration, { denied: true });

  const missingConfigurationAndCapability = runPhp(phpProgram({
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = false;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection), 'entitlement_calls' => $GLOBALS['lor_entitlement_calls']));
`,
  }));
  assert.deepEqual(missingConfigurationAndCapability, { denied: true, entitlement_calls: 0 });

  const nonStringConfiguration = runPhp(phpProgram({
    constants: `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', 123);
`,
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = true;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection)));
`,
  }));
  assert.deepEqual(nonStringConfiguration, { denied: true });

  const nonStringConfigurationAndCapability = runPhp(phpProgram({
    constants: `${enabledConstants}
define('MMHQ_LOR_STUDIO_FOUNDER_CANARY_LOGIN', 123);
`,
    body: `
lor_valid_fixture();
$GLOBALS['lor_user_login'] = 'brinyu';
$GLOBALS['lor_manage_options'] = false;
$projection = mmhq_lor_studio_identity_entitlement_for_user(123);
echo json_encode(array('denied' => is_wp_error($projection), 'entitlement_calls' => $GLOBALS['lor_entitlement_calls']));
`,
  }));
  assert.deepEqual(nonStringConfigurationAndCapability, { denied: true, entitlement_calls: 0 });
});

test('WordPress admission always emits actual canary facts and never applies release policy', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
lor_valid_fixture();
unset($GLOBALS['lor_meta']['_missionmed_lor_canary_enabled']);
$consented_nonmember = mmhq_lor_studio_identity_entitlement_for_user(123);
lor_valid_fixture();
unset($GLOBALS['lor_meta']['_missionmed_lor_consent_accepted']);
$member_without_consent = mmhq_lor_studio_identity_entitlement_for_user(123);
lor_valid_fixture();
unset($GLOBALS['lor_meta']['_missionmed_lor_canary_enabled']);
unset($GLOBALS['lor_meta']['_missionmed_lor_consent_accepted']);
unset($GLOBALS['lor_meta']['_missionmed_lor_consent_version']);
unset($GLOBALS['lor_meta']['_missionmed_lor_consent_at']);
$identity = mmhq_lor_studio_identity_entitlement_for_user(123);
$resource = mmhq_lor_studio_resource_student_entitlement_for_user(123);
$receipt = mmhq_lor_studio_receipt('wp:123', 'student', time() + 300, false, false);
$candidate = mmhq_lor_studio_faculty_candidate_identity_for_user(wp_get_current_user());
echo json_encode(array(
    'consented_nonmember' => $consented_nonmember,
    'member_without_consent' => $member_without_consent,
    'identity' => $identity,
    'resource' => $resource,
    'receipt' => $receipt,
    'candidate' => $candidate,
));
`,
  }));
  assert.equal(result.consented_nonmember.canaryEnabled, false);
  assert.equal(result.consented_nonmember.canaryConsented, true);
  assert.equal(result.member_without_consent.canaryEnabled, true);
  assert.equal(result.member_without_consent.canaryConsented, false);
  assert.deepEqual(result.identity, {
    contract: 'missionmed.lor.wordpress-entitlement.v1',
    subject: 'wp:123',
    admitted: true,
    canaryEnabled: false,
    canaryConsented: false,
  });
  assert.equal(result.resource.studentId, 'wp:123');
  assert.equal(result.resource.canaryEnabled, false);
  assert.equal(result.resource.canaryConsented, false);
  assert.equal(result.receipt.contract, 'missionmed.lor.wordpress-admission.v4');
  assert.equal(result.receipt.canaryEnabled, false);
  assert.equal(result.receipt.canaryConsented, false);
  assert.equal(result.candidate.identityClass, 'faculty_candidate');
  assert.equal(result.candidate.canaryEnabled, false);
  assert.equal(result.candidate.canaryConsented, false);
});

test('no-store applies to all five S2S routes and unrelated responses are byte-identical', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$routes = array(
    '/missionmed/v1/lor-studio/bootstrap/redeem',
    '/missionmed/v1/lor-studio/current-user-admission',
    '/missionmed/v1/lor-studio/binding/revoke',
    '/missionmed/v1/lor-studio/resource-student-entitlement',
    '/missionmed/v1/lor-studio/resource-student-entitlement/probe',
);
$headers = array();
foreach ($routes as $route) {
    $request = new Lor_Test_Rest_Request($route);
    $response = mmhq_lor_studio_contract_post_dispatch(new WP_Error('denied', 'Denied', array('status' => 403)), null, $request);
    $headers[] = $response->headers['Cache-Control'];
}
$unrelated = new Lor_Test_Rest_Response(array('ok' => true));
$same = mmhq_lor_studio_contract_post_dispatch($unrelated, null, new Lor_Test_Rest_Request('/wp/v2/users'));
echo json_encode(array('headers' => $headers, 'same' => $same === $unrelated, 'unrelated_headers' => $same->headers));
`,
  }));
  assert.deepEqual(result, {
    headers: [
      'private, no-store, max-age=0',
      'private, no-store, max-age=0',
      'private, no-store, max-age=0',
      'private, no-store, max-age=0',
      'private, no-store, max-age=0',
    ],
    same: true,
    unrelated_headers: [],
  });
});
