import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, '..', '..', '..');
const contractPath = path.join(
  repositoryRoot,
  'wp-content',
  'mu-plugins',
  'missionmed-lor-studio-contract.php',
);
const phpProbe = spawnSync('php', ['--version'], { encoding: 'utf8' });
const phpAvailable = phpProbe.status === 0;

function phpProgram({ constants = '', producer = '', body }) {
  return `
define('ABSPATH', ${JSON.stringify(repositoryRoot + path.sep)});
${constants}
class WP_Error {
    public $code;
    public $message;
    public $data;
    public function __construct($code, $message, $data = array()) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }
    public function get_error_code() {
        return $this->code;
    }
}
class Lor_Test_Rest_Response {
    public $data;
    public $headers = array();
    public function __construct($data) {
        $this->data = $data;
    }
    public function header($name, $value) {
        $this->headers[$name] = $value;
    }
}
class Lor_Test_Rest_Request {
    public $route;
    public $client_assertions = array();
    public function __construct($route) {
        $this->route = $route;
    }
    public function get_route() {
        return $this->route;
    }
}
$GLOBALS['lor_actions'] = array();
$GLOBALS['lor_filters'] = array();
$GLOBALS['lor_routes'] = array();
$GLOBALS['lor_user_id'] = 123;
$GLOBALS['lor_meta'] = array();
function add_action($hook, $callback) {
    $GLOBALS['lor_actions'][$hook][] = $callback;
}
function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['lor_filters'][$hook][] = array($callback, $priority, $accepted_args);
}
function register_rest_route($namespace, $route, $arguments) {
    $GLOBALS['lor_routes'][] = array($namespace, $route, $arguments);
}
function wp_get_current_user() {
    return (object) array('ID' => $GLOBALS['lor_user_id']);
}
function is_user_logged_in() {
    return (int) $GLOBALS['lor_user_id'] > 0;
}
function get_user_meta($user_id, $key, $single) {
    return array_key_exists($key, $GLOBALS['lor_meta']) ? $GLOBALS['lor_meta'][$key] : '';
}
function is_wp_error($value) {
    return $value instanceof WP_Error;
}
function rest_ensure_response($value) {
    return new Lor_Test_Rest_Response($value);
}
function rest_convert_error_to_response($error) {
    return new Lor_Test_Rest_Response(array(
        'code' => $error->code,
        'message' => $error->message,
        'data' => $error->data,
    ));
}
${producer}
require ${JSON.stringify(contractPath)};
${body}
`;
}

function runPhp(program) {
  const result = spawnSync('php', ['-d', 'display_errors=1', '-r', program], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `PHP harness failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

const enabledConstants = `
define('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED', true);
define('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS', '4000');
define('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS', '360_match_mentorship');
define('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION', 'lor-consent-v1');
define('MMHQ_LOR_STUDIO_ENTITLEMENT_MAX_AGE_SECONDS', 300);
`;

const injectableProducer = `
function mmhq_cam_build_entitlement($user_id) {
    if (!empty($GLOBALS['lor_producer_throws'])) {
        throw new RuntimeException('producer unavailable');
    }
    $GLOBALS['lor_last_producer_user_id'] = $user_id;
    $entitlement = $GLOBALS['lor_entitlement'];
    if (is_array($entitlement)) {
        $entitlement['subject'] = array_key_exists('lor_producer_subject_override', $GLOBALS)
            ? $GLOBALS['lor_producer_subject_override']
            : 'wp:' . $user_id;
    }
    return $entitlement;
}
`;

test('candidate is isolated, current-user-only, and has no outbound or mutation seam', async () => {
  const source = await readFile(contractPath, 'utf8');

  assert.match(source, /missionmed\.lor\.wordpress-entitlement\.v1/u);
  assert.match(source, /'\/lor-studio\/identity-entitlement'/u);
  assert.match(source, /true === constant\('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED'\)/u);
  assert.match(source, /function mmhq_lor_studio_current_identity_entitlement\(\)/u);
  assert.match(source, /\$expected_subject !== \(\$entitlement\['subject'\] \?\? null\)/u);
  assert.match(source, /add_filter\('rest_post_dispatch', 'mmhq_lor_studio_contract_post_dispatch', 10, 3\)/u);
  assert.doesNotMatch(source, /\$_(?:GET|POST|REQUEST|COOKIE)/u);
  assert.doesNotMatch(source, /(?:get_param|get_json_params|get_body_params)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:wp_mail|mail|wp_remote_get|wp_remote_post|curl_exec)\s*\(/u);
  assert.doesNotMatch(source, /\b(?:add|update|delete|register)_user_meta\s*\(/u);
  assert.doesNotMatch(source, /add_filter\s*\(\s*['"](?:determine_current_user|rest_authentication_errors)/u);
  assert.doesNotMatch(source, /hash_hmac|openssl_encrypt|Authorization:\s*Bearer/iu);
});

test('feature-off default registers no REST route', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
mmhq_lor_studio_register_rest_contract();
echo json_encode(array(
    'enabled' => mmhq_lor_studio_contract_enabled(),
    'routes' => count($GLOBALS['lor_routes']),
    'filters' => count($GLOBALS['lor_filters']),
));
`,
  }));

  assert.deepEqual(result, { enabled: false, routes: 0, filters: 0 });
});

test('missing producer fails with one generic denial and no protected evidence', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    constants: enabledConstants,
    body: `
$GLOBALS['lor_meta'] = array(
    '_missionmed_lor_enabled' => '1',
    '_missionmed_lor_canary_enabled' => '1',
    '_missionmed_lor_consent_accepted' => '1',
    '_missionmed_lor_consent_version' => 'lor-consent-v1',
    '_missionmed_lor_consent_at' => gmdate('c', time() - 60),
);
$projection = mmhq_lor_studio_current_identity_entitlement();
echo json_encode(array(
    'is_error' => is_wp_error($projection),
    'code' => $projection->code,
    'message' => $projection->message,
    'data' => $projection->data,
));
`,
  }));

  assert.deepEqual(result, {
    is_error: true,
    code: 'missionmed_lor_contract_unavailable',
    message: 'LOR Studio access is unavailable.',
    data: { status: 403 },
  });
  assert.doesNotMatch(JSON.stringify(result), /wp:123|course|purchase|consent|revok/iu);
});

test('entitlement validation denies stale, malformed, inactive, revoked, expired, and purchase-invalid evidence', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    body: `
$now = strtotime('2026-08-09T16:00:00Z');
$base = array(
    'subject' => 'wp:123',
    'product' => 'cam',
    'source' => 'wordpress_learndash_handoff',
    'verified' => true,
    'trusted' => true,
    'active' => true,
    'status' => 'active',
    'course_ids' => array('4000'),
    'program_tier' => '360_match_mentorship',
    'restricted' => false,
    'revoked' => false,
    'current_access_verified' => true,
    'purchase_verified' => true,
    'expires_at' => '2026-08-09T17:00:00Z',
    'evaluated_at' => '2026-08-09T15:59:00Z',
);
$cases = array('valid' => $base);
$case = $base; unset($case['subject']); $cases['missing_subject'] = $case;
$case = $base; $case['subject'] = 'wp:999'; $cases['cross_subject_123_vs_999'] = $case;
$case = $base; unset($case['evaluated_at']); $cases['missing_evaluated_at'] = $case;
$case = $base; $case['evaluated_at'] = '2026-08-09T15:00:00Z'; $cases['stale'] = $case;
$case = $base; $case['evaluated_at'] = 'yesterday'; $cases['malformed_time'] = $case;
$case = $base; $case['evaluated_at'] = '2026-02-31T15:59:00Z'; $cases['invalid_calendar_time'] = $case;
$case = $base; $case['evaluated_at'] = '2026-08-09T16:01:00Z'; $cases['future_time'] = $case;
$case = $base; $case['verified'] = false; $cases['unverified'] = $case;
$case = $base; $case['trusted'] = false; $cases['untrusted'] = $case;
$case = $base; $case['active'] = false; $cases['inactive'] = $case;
$case = $base; $case['restricted'] = true; $cases['restricted'] = $case;
$case = $base; $case['revoked'] = true; $cases['revoked'] = $case;
$case = $base; $case['status'] = 'expired'; $cases['expired_status'] = $case;
$case = $base; $case['status'] = 'refunded'; $cases['refunded_status'] = $case;
$case = $base; $case['status'] = 'cancelled'; $cases['cancelled_status'] = $case;
$case = $base; $case['purchase_verified'] = false; $cases['purchase_invalid'] = $case;
$case = $base; $case['current_access_verified'] = false; $cases['access_invalid'] = $case;
$case = $base; $case['course_ids'] = array('4000', 'invalid'); $cases['malformed_courses'] = $case;
$case = $base; $case['course_ids'] = array('999999999999999999999999'); $cases['overflow_course'] = $case;
$case = $base; $case['course_ids'] = array('3893'); $cases['unverified_3893'] = $case;
$case = $base; $case['course_ids'] = array('4000', '3893'); $cases['mixed_unverified_3893'] = $case;
$case = $base; $case['program_tier'] = ''; $cases['unverified_tier'] = $case;
$case = $base; unset($case['expires_at']); $cases['missing_expiry_shape'] = $case;
$case = $base; $case['expires_at'] = 'not-an-instant'; $cases['malformed_expiry'] = $case;
$case = $base; $case['expires_at'] = '2026-08-09T15:59:00Z'; $cases['expired'] = $case;
$case = $base; $case['source'] = 'browser_assertion'; $cases['wrong_source'] = $case;
$out = array();
foreach ($cases as $name => $candidate) {
    $out[$name] = mmhq_lor_studio_entitlement_allows(
        $candidate,
        'wp:123',
        $now,
        array(4000),
        array('360_match_mentorship'),
        300
    );
}
echo json_encode($out);
`,
  }));

  assert.equal(result.valid, true);
  for (const [name, allowed] of Object.entries(result)) {
    if (name !== 'valid') {
      assert.equal(allowed, false, `${name} must fail closed`);
    }
  }
});

test('current wp:123 rejects producer wp:999, requires every LOR gate, and ignores client assertions', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    constants: enabledConstants,
    producer: injectableProducer,
    body: `
$GLOBALS['lor_meta'] = array(
    '_missionmed_lor_enabled' => '1',
    '_missionmed_lor_canary_enabled' => '1',
    '_missionmed_lor_consent_accepted' => '1',
    '_missionmed_lor_consent_version' => 'lor-consent-v1',
    '_missionmed_lor_consent_at' => gmdate('c', time() - 60),
    '_missionmed_lor_consent_revoked_at' => '',
    '_missionmed_lor_revoked_at' => '',
);
$GLOBALS['lor_entitlement'] = array(
    'product' => 'cam',
    'source' => 'wordpress_learndash_handoff',
    'verified' => true,
    'trusted' => true,
    'active' => true,
    'status' => 'active',
    'course_ids' => array('4000'),
    'program_tier' => '360_match_mentorship',
    'restricted' => false,
    'revoked' => false,
    'current_access_verified' => true,
    'purchase_verified' => true,
    'expires_at' => gmdate('c', time() + 3600),
    'evaluated_at' => gmdate('c', time() - 60),
);
$valid_meta = $GLOBALS['lor_meta'];
$projection = mmhq_lor_studio_current_identity_entitlement();
$request = new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/identity-entitlement');
$request->client_assertions = array(
    'user_id' => 999,
    'subject' => 'wp:999',
    'role' => 'administrator',
    'entitlement' => array('active' => true),
    'consent' => true,
);
$rest = mmhq_lor_studio_contract_rest_response($request);
$out = array(
    'projection' => $projection,
    'rest_projection' => $rest->data,
    'cache_control' => $rest->headers['Cache-Control'],
    'permission' => mmhq_lor_studio_contract_permission(),
    'producer_user_id' => $GLOBALS['lor_last_producer_user_id'],
);
foreach (array(
    '_missionmed_lor_enabled',
    '_missionmed_lor_canary_enabled',
    '_missionmed_lor_consent_accepted',
    '_missionmed_lor_consent_version',
    '_missionmed_lor_consent_at'
) as $key) {
    $GLOBALS['lor_meta'] = $valid_meta;
    unset($GLOBALS['lor_meta'][$key]);
    $denied = mmhq_lor_studio_current_identity_entitlement();
    $out['missing:' . $key] = is_wp_error($denied) ? $denied->code : 'admitted';
}
$GLOBALS['lor_meta'] = $valid_meta;
$GLOBALS['lor_meta']['_missionmed_lor_consent_revoked_at'] = gmdate('c', time() - 10);
$out['consent_revoked'] = is_wp_error(mmhq_lor_studio_current_identity_entitlement());
$GLOBALS['lor_meta'] = $valid_meta;
$GLOBALS['lor_meta']['_missionmed_lor_revoked_at'] = gmdate('c', time() - 10);
$out['lor_revoked'] = is_wp_error(mmhq_lor_studio_current_identity_entitlement());
$GLOBALS['lor_meta'] = $valid_meta;
$GLOBALS['lor_producer_subject_override'] = 'wp:999';
$out['cross_subject_current_123_producer_999'] = is_wp_error(
    mmhq_lor_studio_current_identity_entitlement()
);
unset($GLOBALS['lor_producer_subject_override']);
$GLOBALS['lor_user_id'] = 0;
$out['anonymous'] = is_wp_error(mmhq_lor_studio_current_identity_entitlement());
$GLOBALS['lor_user_id'] = 123;
$GLOBALS['lor_entitlement'] = 'malformed';
$out['malformed_producer'] = is_wp_error(mmhq_lor_studio_current_identity_entitlement());
$GLOBALS['lor_producer_throws'] = true;
$out['throwing_producer'] = is_wp_error(mmhq_lor_studio_current_identity_entitlement());
echo json_encode($out);
`,
  }));

  const expectedProjection = {
    contract: 'missionmed.lor.wordpress-entitlement.v1',
    subject: 'wp:123',
    admitted: true,
  };
  assert.deepEqual(result.projection, expectedProjection);
  assert.deepEqual(result.rest_projection, expectedProjection);
  assert.equal(result.cache_control, 'private, no-store, max-age=0');
  assert.equal(result.permission, true);
  assert.equal(result.producer_user_id, 123);
  for (const [name, value] of Object.entries(result)) {
    if (name.startsWith('missing:')) {
      assert.equal(value, 'missionmed_lor_contract_unavailable');
    }
  }
  assert.equal(result.consent_revoked, true);
  assert.equal(result.lor_revoked, true);
  assert.equal(result.cross_subject_current_123_producer_999, true);
  assert.equal(result.anonymous, true);
  assert.equal(result.malformed_producer, true);
  assert.equal(result.throwing_producer, true);
});

test('exact-route no-store invariant covers success, generic denial, and permission denial', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    constants: enabledConstants,
    producer: injectableProducer,
    body: `
$GLOBALS['lor_meta'] = array(
    '_missionmed_lor_enabled' => '1',
    '_missionmed_lor_canary_enabled' => '1',
    '_missionmed_lor_consent_accepted' => '1',
    '_missionmed_lor_consent_version' => 'lor-consent-v1',
    '_missionmed_lor_consent_at' => gmdate('c', time() - 60),
);
$GLOBALS['lor_entitlement'] = array(
    'product' => 'cam',
    'source' => 'wordpress_learndash_handoff',
    'verified' => true,
    'trusted' => true,
    'active' => true,
    'status' => 'active',
    'course_ids' => array('4000'),
    'program_tier' => '360_match_mentorship',
    'restricted' => false,
    'revoked' => false,
    'current_access_verified' => true,
    'purchase_verified' => true,
    'expires_at' => gmdate('c', time() + 3600),
    'evaluated_at' => gmdate('c', time() - 60),
);
$route_request = new Lor_Test_Rest_Request('/missionmed/v1/lor-studio/identity-entitlement');
$success = mmhq_lor_studio_contract_rest_response($route_request);
$success = mmhq_lor_studio_contract_post_dispatch($success, null, $route_request);
$GLOBALS['lor_producer_subject_override'] = 'wp:999';
$denial = mmhq_lor_studio_contract_rest_response($route_request);
$denial_was_error = is_wp_error($denial);
$denial = mmhq_lor_studio_contract_post_dispatch($denial, null, $route_request);
unset($GLOBALS['lor_producer_subject_override']);
$GLOBALS['lor_user_id'] = 0;
$permission_allowed = mmhq_lor_studio_contract_permission();
$permission_denial = new WP_Error('rest_forbidden', 'Forbidden.', array('status' => 401));
$permission_denial = mmhq_lor_studio_contract_post_dispatch(
    $permission_denial,
    null,
    $route_request
);
$unrelated_request = new Lor_Test_Rest_Request('/wp/v2/users');
$unrelated = new Lor_Test_Rest_Response(array('ok' => true));
$unrelated_after = mmhq_lor_studio_contract_post_dispatch($unrelated, null, $unrelated_request);
echo json_encode(array(
    'success_cache_control' => $success->headers['Cache-Control'],
    'denial_was_error' => $denial_was_error,
    'denial_code' => $denial->data['code'],
    'denial_cache_control' => $denial->headers['Cache-Control'],
    'permission_allowed' => $permission_allowed,
    'permission_code' => $permission_denial->data['code'],
    'permission_cache_control' => $permission_denial->headers['Cache-Control'],
    'unrelated_same_object' => $unrelated_after === $unrelated,
    'unrelated_headers' => $unrelated_after->headers,
));
`,
  }));

  assert.deepEqual(result, {
    success_cache_control: 'private, no-store, max-age=0',
    denial_was_error: true,
    denial_code: 'missionmed_lor_contract_unavailable',
    denial_cache_control: 'private, no-store, max-age=0',
    permission_allowed: false,
    permission_code: 'rest_forbidden',
    permission_cache_control: 'private, no-store, max-age=0',
    unrelated_same_object: true,
    unrelated_headers: [],
  });
});

test('course 3893 admits only when exact server configuration explicitly lists it', { skip: !phpAvailable }, () => {
  const constants = `
define('MMHQ_LOR_STUDIO_WORDPRESS_CONTRACT_ENABLED', true);
define('MMHQ_LOR_STUDIO_VERIFIED_COURSE_IDS', '3893');
define('MMHQ_LOR_STUDIO_VERIFIED_PROGRAM_TIERS', '360_match_mentorship');
define('MMHQ_LOR_STUDIO_REQUIRED_CONSENT_VERSION', 'lor-consent-v1');
`;
  const result = runPhp(phpProgram({
    constants,
    producer: injectableProducer,
    body: `
$GLOBALS['lor_meta'] = array(
    '_missionmed_lor_enabled' => '1',
    '_missionmed_lor_canary_enabled' => '1',
    '_missionmed_lor_consent_accepted' => '1',
    '_missionmed_lor_consent_version' => 'lor-consent-v1',
    '_missionmed_lor_consent_at' => gmdate('c', time() - 60),
);
$GLOBALS['lor_entitlement'] = array(
    'product' => 'cam',
    'source' => 'wordpress_learndash_handoff',
    'verified' => true,
    'trusted' => true,
    'active' => true,
    'status' => 'active',
    'course_ids' => array('3893'),
    'program_tier' => '360_match_mentorship',
    'restricted' => false,
    'revoked' => false,
    'current_access_verified' => true,
    'purchase_verified' => true,
    'expires_at' => '',
    'evaluated_at' => gmdate('c', time() - 60),
);
$projection = mmhq_lor_studio_current_identity_entitlement();
echo json_encode(array(
    'verified_course_ids' => mmhq_lor_studio_verified_course_ids(),
    'projection' => $projection,
));
`,
  }));

  assert.deepEqual(result.verified_course_ids, [3893]);
  assert.deepEqual(result.projection, {
    contract: 'missionmed.lor.wordpress-entitlement.v1',
    subject: 'wp:123',
    admitted: true,
  });
});

test('enabled route is singular, versioned, non-enumerating, and current-user protected', { skip: !phpAvailable }, () => {
  const result = runPhp(phpProgram({
    constants: enabledConstants,
    producer: injectableProducer,
    body: `
mmhq_lor_studio_register_rest_contract();
$route = $GLOBALS['lor_routes'][0];
echo json_encode(array(
    'count' => count($GLOBALS['lor_routes']),
    'namespace' => $route[0],
    'route' => $route[1],
    'methods' => $route[2]['methods'],
    'callback' => $route[2]['callback'],
    'permission_callback' => $route[2]['permission_callback'],
    'has_args' => array_key_exists('args', $route[2]),
    'post_dispatch_filters' => $GLOBALS['lor_filters']['rest_post_dispatch'],
));
`,
  }));

  assert.deepEqual(result, {
    count: 1,
    namespace: 'missionmed/v1',
    route: '/lor-studio/identity-entitlement',
    methods: 'GET',
    callback: 'mmhq_lor_studio_contract_rest_response',
    permission_callback: 'mmhq_lor_studio_contract_permission',
    has_args: false,
    post_dispatch_filters: [['mmhq_lor_studio_contract_post_dispatch', 10, 3]],
  });
});
