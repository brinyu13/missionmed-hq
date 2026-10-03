<?php
/** Deterministic contract tests; no WordPress, provider or real-account access. */
define('ABSPATH', __DIR__ . '/fixture-wordpress/');
putenv('INTERVIEWIQ_LAUNCH_MODE=full');
class WP_Error {
    public function __construct(public $code, public $message, public $data = array()) {}
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Response {
    public $headers = array();
    public function __construct(public $data, public $status = 200) {}
    public function header($name, $value) { $this->headers[$name] = $value; }
}
class WP_User {
    public function __construct(public $ID, public $roles = array('student'), public $display_name = 'Synthetic Student', public $admin = false) {}
    public function exists() { return $this->ID > 0; }
}
class WP_User_Meta_Session_Tokens {}
class Unknown_Session_Backend {}
class WP_Session_Tokens {
    public static function get_instance($id) { return $GLOBALS['unknown_backend'] ? new Unknown_Session_Backend() : new WP_User_Meta_Session_Tokens(); }
}
class MMED_Access_Gate { public static function get_full_access_course_ids() { return array(3893, 5227); } }
class Request {
    public function __construct(public $body, public $headers = array(), public $method = 'POST') {}
    public function get_body() { return $this->body; }
    public function get_header($name) { return $this->headers[strtolower($name)] ?? null; }
    public function get_method() { return $this->method; }
}
function is_wp_error($v) { return $v instanceof WP_Error; }
function add_action($hook, $callback, $priority = 10) { $GLOBALS['actions'][] = array($hook, $callback, $priority); }
function register_rest_route($ns, $path, $config) { $GLOBALS['rest_routes'][] = array($ns, $path, $config); }
function wp_parse_url($v) { return parse_url($v); }
function home_url($v) { return $GLOBALS['wp_origin'] . $v; }
function wp_json_encode($v) { return json_encode($v, JSON_UNESCAPED_SLASHES); }
function wp_generate_uuid4() { return '77777777-7777-4777-8777-777777777777'; }
function wp_create_nonce($action) { return $action === 'missionmed_interviewiq' ? 'synthetic-wp-nonce' : ''; }
function wp_verify_nonce($nonce, $action) { return $nonce === wp_create_nonce($action); }
function wp_get_session_token() { return $GLOBALS['raw_session']; }
function wp_get_current_user() { return $GLOBALS['current_user']; }
function get_user_by($field, $id) { return $GLOBALS['users'][$id] ?? false; }
function get_users($args) {
    $uuid = $args['meta_query'][0]['value']; $owners = array();
    foreach ($GLOBALS['meta'] as $id => $meta) {
        if (($meta['_missionmed_storyforge_user_id'] ?? '') === $uuid || ($meta['_missionmed_interviewiq_user_id'] ?? '') === $uuid) { $owners[] = $id; }
    }
    return array_slice($owners, 0, 2);
}
function user_can($user, $cap) { return $user->admin && $cap === 'manage_options'; }
function get_user_meta($id, $key, $single) { return $GLOBALS['meta'][$id][$key] ?? ''; }
function add_user_meta($id, $key, $value, $unique) {
    $GLOBALS['meta_writes'][] = $key;
    if (!isset($GLOBALS['meta'][$id][$key])) { $GLOBALS['meta'][$id][$key] = $GLOBALS['race_uuid'] ?? $value; return true; }
    return false;
}
function get_option($key, $default = null) { return array('mmed_course_360elite' => 3893, 'mmed_course_complete' => 5227)[$key] ?? $default; }
function sfwd_lms_has_access($course, $id) { return in_array($course, $GLOBALS['courses'][$id] ?? array(), true); }
function ld_course_access_expired($course, $id) { return in_array($course, $GLOBALS['expired'][$id] ?? array(), true); }
function mmhq_cam_restricted($id) { return in_array($id, $GLOBALS['restricted'], true); }
function mmhq_cam_build_entitlement($id) { return $GLOBALS['grants'][$id] ?? array(); }
function mmsf_assignment_student_ids($id) { return $GLOBALS['assignments'][$id] ?? array(); }
function mmsf_storyforge_user_id($id) { return get_user_meta($id, '_missionmed_storyforge_user_id', true); }

require __DIR__ . '/../../infra/wordpress/missionmed-interviewiq-sso.php';
require __DIR__ . '/../../infra/wordpress/missionmed-interviewiq-route.php';

$tests = array();
function check($name, $fn) { global $tests; $tests[] = array($name, $fn); }
function ok($value, $message = 'assertion failed') { if (!$value) { throw new Exception($message); } }
function eq($actual, $expected) { ok($actual === $expected, 'values differ'); }
function error_code($result, $code) { ok(is_wp_error($result)); eq($result->get_error_code(), $code); }
function reset_state() {
    $GLOBALS['wp_origin'] = 'https://missionmedinstitute.com';
    $GLOBALS['raw_session'] = 'synthetic-session-token-no-production-value';
    $GLOBALS['unknown_backend'] = false;
    $GLOBALS['current_user'] = new WP_User(42);
    $GLOBALS['users'] = array(42 => $GLOBALS['current_user'], 43 => new WP_User(43));
    $GLOBALS['meta'] = array(42 => array('_missionmed_storyforge_user_id' => '11111111-1111-4111-8111-111111111111',
        'session_tokens' => array(hash('sha256', $GLOBALS['raw_session']) => array('expiration' => time() + 3600))));
    $GLOBALS['meta_writes'] = array();
    $GLOBALS['courses'] = array(42 => array(3893));
    $GLOBALS['expired'] = $GLOBALS['restricted'] = $GLOBALS['assignments'] = array();
    $GLOBALS['grants'] = array(42 => array('trusted' => true, 'verified' => true, 'active' => true));
    unset($GLOBALS['race_uuid']);
    putenv('INTERVIEWIQ_ENABLED=true');
    putenv('INTERVIEWIQ_JWT_SECRET=synthetic-jwt-key-only-for-local-tests-aaaaaaaa');
    putenv('INTERVIEWIQ_OWNER_PROOF_SECRET=synthetic-proof-key-only-for-local-tests-bbbbbbbb');
    putenv('INTERVIEWIQ_WP_ORIGIN');
    putenv('INTERVIEWIQ_API_ORIGIN=https://interviewiq-production.up.railway.app');
    putenv('INTERVIEWIQ_GATEWAY_SECRET=synthetic-gateway-key-only-for-local-tests-cccccc');
    $_SERVER = array('REQUEST_METHOD' => 'POST', 'HTTP_ORIGIN' => $GLOBALS['wp_origin'],
        'HTTP_SEC_FETCH_SITE' => 'same-origin', 'HTTP_X_IIQ_NONCE' => 'synthetic-wp-nonce');
}
function proof_input($patch = array()) {
    return array_merge(array('audience' => 'interviewiq-owner-introspection',
        'subject' => '11111111-1111-4111-8111-111111111111', 'wp_user_id' => 42,
        'session_verifier' => hash('sha256', $GLOBALS['raw_session']),
        'nonce' => '22222222-2222-4222-8222-222222222222', 'iat' => time()), $patch);
}
function signed_request($input, $headers = array(), $method = 'POST') {
    $body = wp_json_encode($input);
    return new Request($body, array_merge(array('x-mmed-iiq-proof' => hash_hmac('sha256',
        "mmiiq-introspection-request-v1\n" . $body, mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET'))), $headers), $method);
}
function proof_payload($request) {
    $response = mmiiq_introspection($request);
    ok($response instanceof WP_REST_Response);
    eq($response->headers['Cache-Control'], 'private, no-store, no-cache, max-age=0');
    eq($response->data['signature'], hash_hmac('sha256', "mmiiq-introspection-response-v1\n" . $response->data['payload'], mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET')));
    return json_decode($response->data['payload'], true);
}
function with_release($fn) {
    $root = sys_get_temp_dir() . '/iiq-wordpress-test-' . bin2hex(random_bytes(8));
    $id = str_repeat('a', 40); $release = $root . '/releases/' . $id;
    mkdir($release, 0700, true);
    $contents = array('index.html' => '<!doctype html><title>Synthetic IIQ test</title>', 'app.mjs' => 'export const fixture = true;');
    $assets = array();
    foreach ($contents as $path => $content) {
        file_put_contents($release . '/' . $path, $content);
        $assets[$path] = array('sha256' => hash('sha256', $content), 'bytes' => strlen($content));
    }
    $manifest = array('schema' => 'missionmed.interviewiq.release.v1', 'release_id' => $id, 'assets' => $assets);
    file_put_contents($release . '/release.php', '<?php return ' . var_export($manifest, true) . ';');
    symlink('releases/' . $id, $root . '/current');
    try { $fn($root, $id, $release); }
    finally {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $item) { if ($item->isDir() && !$item->isLink()) { rmdir($item->getPathname()); } else { unlink($item->getPathname()); } }
        rmdir($root);
    }
}

check('feature is off when flag absent', function () { putenv('INTERVIEWIQ_ENABLED'); eq(mmiiq_enabled(), false); error_code(mmiiq_browser_identity(), 'interviewiq_disabled_or_unconfigured'); });
check('missing signing configuration fails closed', function () { putenv('INTERVIEWIQ_JWT_SECRET'); error_code(mmiiq_browser_identity(), 'interviewiq_disabled_or_unconfigured'); });
check('separate proof and JWT domains require separate keys', function () { putenv('INTERVIEWIQ_OWNER_PROOF_SECRET=' . mmiiq_setting('INTERVIEWIQ_JWT_SECRET')); eq(mmiiq_secrets_ready(), false); });
check('issuer cannot be silently repointed', function () { putenv('INTERVIEWIQ_WP_ORIGIN=https://other.invalid'); eq(mmiiq_wp_origin(), ''); });
check('HTTP WordPress origin fails closed', function () { $GLOBALS['wp_origin'] = 'http://missionmedinstitute.com'; eq(mmiiq_wp_origin(), ''); });
check('anonymous user is denied', function () { error_code(mmiiq_access_for_user(new WP_User(0)), 'session_required'); });
check('administrator capability is live authority', function () { $u = new WP_User(1, array('student'), 'Admin', true); eq(mmiiq_access_for_user($u)['role'], 'admin'); });
check('role name alone cannot spoof administrator capability', function () { $u = new WP_User(43, array('administrator')); error_code(mmiiq_access_for_user($u), 'eligibility_required'); });
check('current verified 360 enrollment passes', function () { eq(mmiiq_access_for_user($GLOBALS['current_user'])['tier'], '360'); });
check('360 purchase/current authority denial is preserved', function () { $GLOBALS['grants'][42]['active'] = false; error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'eligibility_required'); });
check('expired current course denies access', function () { $GLOBALS['expired'][42] = array(3893); error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'eligibility_required'); });
check('IV Prep Complete gets protected access independently', function () { $GLOBALS['courses'][42] = array(5227); $GLOBALS['grants'][42] = array(); eq(mmiiq_access_for_user($GLOBALS['current_user'])['tier'], 'ivprep_complete'); });
check('unrelated course does not grant access', function () { $GLOBALS['courses'][42] = array(3646); error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'eligibility_required'); });
check('restricted access overlays current enrollment', function () { $GLOBALS['restricted'] = array(42); error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'owner_restricted_or_unavailable'); });
check('unassigned mentor denied even when enrolled', function () { $GLOBALS['current_user']->roles = array('mentor'); error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'mentor_unassigned'); });
check('assigned mentor gets only owner UUID assignments', function () { $GLOBALS['current_user']->roles = array('mentor'); $GLOBALS['assignments'][42] = array('33333333-3333-4333-8333-333333333333'); eq(mmiiq_access_for_user($GLOBALS['current_user'])['assignment_student_ids'], $GLOBALS['assignments'][42]); });
check('invalid assignment fails closed', function () { $GLOBALS['current_user']->roles = array('mentor'); $GLOBALS['assignments'][42] = array('wp:43'); error_code(mmiiq_access_for_user($GLOBALS['current_user']), 'assignment_owner_invalid'); });
check('canonical StoryForge UUID is preserved and only IIQ meta written', function () { eq(mmiiq_actor_uuid(42, true), '11111111-1111-4111-8111-111111111111'); eq($GLOBALS['meta_writes'], array('_missionmed_interviewiq_user_id')); });
check('unmapped eligible actor receives separate IIQ UUID', function () { unset($GLOBALS['meta'][42]['_missionmed_storyforge_user_id']); eq(mmiiq_actor_uuid(42, true), '77777777-7777-4777-8777-777777777777'); ok(!isset($GLOBALS['meta'][42]['_missionmed_storyforge_user_id'])); });
check('read-only introspection does not provision missing UUID', function () { unset($GLOBALS['meta'][42]['_missionmed_storyforge_user_id']); error_code(mmiiq_actor_uuid(42, false), 'identity_unmapped'); eq($GLOBALS['meta_writes'], array()); });
check('identity conflict cannot silently switch account', function () { $GLOBALS['meta'][42]['_missionmed_interviewiq_user_id'] = '44444444-4444-4444-8444-444444444444'; error_code(mmiiq_actor_uuid(42, true), 'identity_binding_conflict'); });
check('concurrent provisioning cannot replace canonical StoryForge ID', function () { $GLOBALS['race_uuid'] = '44444444-4444-4444-8444-444444444444'; error_code(mmiiq_actor_uuid(42, true), 'identity_binding_conflict'); });
check('invalid stored UUID never becomes token subject', function () { $GLOBALS['meta'][42]['_missionmed_interviewiq_user_id'] = 'not-a-uuid'; error_code(mmiiq_actor_uuid(42, true), 'identity_binding_conflict'); });
check('duplicate canonical UUID across WP accounts fails closed', function () { $GLOBALS['meta'][43]['_missionmed_storyforge_user_id'] = $GLOBALS['meta'][42]['_missionmed_storyforge_user_id']; error_code(mmiiq_actor_uuid(42, true), 'identity_binding_conflict'); });
check('IIQ-only duplicate UUID across WP accounts fails closed', function () { $GLOBALS['meta'][43]['_missionmed_interviewiq_user_id'] = $GLOBALS['meta'][42]['_missionmed_storyforge_user_id']; eq(proof_payload(signed_request(proof_input()))['allowed'], false); });
check('current live WordPress session passes', function () { ok(mmiiq_session_active(42, hash('sha256', $GLOBALS['raw_session']))); });
check('logout invalidates current session immediately', function () { $hash = hash('sha256', $GLOBALS['raw_session']); unset($GLOBALS['meta'][42]['session_tokens'][$hash]); eq(mmiiq_session_active(42, $hash), false); error_code(mmiiq_browser_identity(), 'session_revoked'); });
check('session expiration enforced', function () { $hash = hash('sha256', $GLOBALS['raw_session']); $GLOBALS['meta'][42]['session_tokens'][$hash]['expiration'] = time() - 1; eq(mmiiq_session_active(42, $hash), false); });
check('unknown session backend fails closed', function () { $GLOBALS['unknown_backend'] = true; eq(mmiiq_session_active(42, hash('sha256', $GLOBALS['raw_session'])), false); });
check('raw cookie token is not accepted as a verifier', function () { eq(mmiiq_session_active(42, $GLOBALS['raw_session']), false); });
check('token requires actual current session', function () { $GLOBALS['raw_session'] = ''; error_code(mmiiq_browser_identity(), 'session_required'); });
check('public actor projection excludes session verifier', function () { $actor = mmiiq_browser_identity(); ok(!array_key_exists('session_verifier', mmiiq_public_actor($actor))); });
check('JWT uses dedicated audience and bounded signed claims', function () {
    $actor = mmiiq_browser_identity(); $issued = mmiiq_issue_token($actor); ok(!is_wp_error($issued));
    $parts = explode('.', $issued['token']); $claims = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    eq($claims['aud'], 'interviewiq'); eq($claims['iss'], $GLOBALS['wp_origin']); eq($claims['exp'] - $claims['iat'], 60);
    eq($claims['sub'], $actor['id']); eq($claims['app_role'], 'student'); eq($claims['interviewiq_eligible'], true);
    eq($parts[2], mmiiq_b64url(hash_hmac('sha256', $parts[0] . '.' . $parts[1], mmiiq_setting('INTERVIEWIQ_JWT_SECRET'), true)));
    ok(strpos(json_encode($claims), $GLOBALS['raw_session']) === false);
});
check('valid bearer is bound to current cookie actor', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor)['token']; ok(mmiiq_browser_bearer_valid('Bearer ' . $token, $actor)); });
check('another account bearer cannot cross current cookie boundary', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor)['token']; $other = array_merge($actor, array('id' => '33333333-3333-4333-8333-333333333333', 'wp_user_id' => 43)); eq(mmiiq_browser_bearer_valid('Bearer ' . $token, $other), false); });
check('same account bearer from another session cannot cross cookie boundary', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor)['token']; $other = array_merge($actor, array('session_verifier' => str_repeat('a', 64))); eq(mmiiq_browser_bearer_valid('Bearer ' . $token, $other), false); });
check('bearer role downgrade forces refresh', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor)['token']; eq(mmiiq_browser_bearer_valid('Bearer ' . $token, array_merge($actor, array('role' => 'admin'))), false); });
check('bearer expiry is enforced at gateway', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor, time() - 61)['token']; eq(mmiiq_browser_bearer_valid('Bearer ' . $token, $actor), false); });
check('bearer signature tampering fails gateway validation', function () { $actor = mmiiq_browser_identity(); $token = mmiiq_issue_token($actor)['token']; eq(mmiiq_browser_bearer_valid('Bearer ' . $token . 'a', $actor), false); });
check('same-origin browser bootstrap permitted', function () { eq(mmiiq_browser_request(false), true); });
check('cross-origin bootstrap denied', function () { $_SERVER['HTTP_ORIGIN'] = 'https://attacker.invalid'; error_code(mmiiq_browser_request(false), 'origin_not_allowed'); });
check('same-site sibling cannot mint token', function () { $_SERVER['HTTP_SEC_FETCH_SITE'] = 'same-site'; error_code(mmiiq_browser_request(true), 'origin_not_allowed'); });
check('token refresh nonce required', function () { unset($_SERVER['HTTP_X_IIQ_NONCE']); error_code(mmiiq_browser_request(true), 'csrf_failed'); });
check('bootstrap refuses GET', function () { $_SERVER['REQUEST_METHOD'] = 'GET'; error_code(mmiiq_browser_request(false), 'method_not_allowed'); });
check('valid owner proof rechecks state and binds request bytes', function () {
    $request = signed_request(proof_input(array('action' => 'GET /api/bootstrap'))); $p = proof_payload($request);
    eq($p['allowed'], true); eq($p['role'], 'student'); eq($p['tier'], '360'); eq($p['exp'] - $p['iat'], 30);
    eq($p['request_sha256'], hash('sha256', $request->body)); eq($p['session_verifier'], proof_input()['session_verifier']);
    eq($GLOBALS['meta_writes'], array());
});
check('server proof accepts absent Origin represented by WordPress null', function () { $r = signed_request(proof_input()); eq($r->get_header('origin'), null); eq(mmiiq_introspection_permission($r), true); });
check('server proof accepts an empty Origin header', function () { eq(mmiiq_introspection_permission(signed_request(proof_input(), array('origin' => ''))), true); });
check('server proof not callable from browser', function () { foreach (array($GLOBALS['wp_origin'], 'https://attacker.invalid', 'null') as $origin) { error_code(mmiiq_introspection_permission(signed_request(proof_input(), array('origin' => $origin))), 'owner_proof_denied'); } });
check('owner proof rejects tampered body', function () { $r = signed_request(proof_input()); $r->body .= ' '; error_code(mmiiq_introspection_permission($r), 'owner_proof_denied'); });
check('owner proof rejects wrong signing domain', function () { $r = signed_request(proof_input()); $r->headers['x-mmed-iiq-proof'] = hash_hmac('sha256', $r->body, mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET')); error_code(mmiiq_introspection_permission($r), 'owner_proof_denied'); });
check('owner proof rejects stale request', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('iat' => time() - 31)))), 'owner_proof_invalid'); });
check('owner proof rejects future request', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('iat' => time() + 6)))), 'owner_proof_invalid'); });
check('owner proof rejects other audience', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('audience' => 'storyforge')))), 'owner_proof_invalid'); });
check('owner proof rejects injected role', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('role' => 'admin')))), 'owner_proof_invalid'); });
check('owner proof rejects malformed action', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('action' => 'POST https://other.invalid')))), 'owner_proof_invalid'); });
check('owner proof rejects null action', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('action' => null)))), 'owner_proof_invalid'); });
check('owner proof rejects string WP ID', function () { error_code(mmiiq_introspection_permission(signed_request(proof_input(array('wp_user_id' => '42')))), 'owner_proof_invalid'); });
check('signed cross-subject request is denied without identity data', function () { $p = proof_payload(signed_request(proof_input(array('subject' => '33333333-3333-4333-8333-333333333333')))); eq($p['allowed'], false); eq($p['role'], null); eq($p['assignment_student_ids'], array()); });
check('proof replay after logout returns denied', function () { $request = signed_request(proof_input()); eq(proof_payload($request)['allowed'], true); $GLOBALS['meta'][42]['session_tokens'] = array(); $p = proof_payload($request); eq($p['allowed'], false); });
check('revoked enrollment is observed in next proof', function () { $request = signed_request(proof_input()); eq(proof_payload($request)['allowed'], true); $GLOBALS['courses'][42] = array(); eq(proof_payload($request)['allowed'], false); });
check('role downgrade appears in fresh proof', function () { $GLOBALS['current_user']->admin = true; $request = signed_request(proof_input()); eq(proof_payload($request)['role'], 'admin'); $GLOBALS['current_user']->admin = false; eq(proof_payload($request)['role'], 'student'); });
check('assignment revocation appears in fresh proof', function () { $GLOBALS['current_user']->roles = array('mentor'); $GLOBALS['assignments'][42] = array('33333333-3333-4333-8333-333333333333'); $r = signed_request(proof_input()); eq(count(proof_payload($r)['assignment_student_ids']), 1); $GLOBALS['assignments'][42] = array(); eq(proof_payload($r)['allowed'], false); });
check('unknown actor cannot obtain identity mapping through proof', function () { $p = proof_payload(signed_request(proof_input(array('wp_user_id' => 999)))); eq($p['allowed'], false); eq($p['role'], null); });
check('oversized signed owner request rejected', function () { $input = proof_input(array('extra' => str_repeat('a', 5000))); error_code(mmiiq_introspection_permission(signed_request($input)), 'owner_proof_denied'); });
check('gateway accepts isolated pinned Railway origin', function () { eq(mmiiqg_origin(), 'https://interviewiq-production.up.railway.app'); });
check('gateway rejects shared HQ target', function () { putenv('INTERVIEWIQ_API_ORIGIN=https://missionmed-hq-production.up.railway.app'); eq(mmiiqg_origin(), ''); });
check('gateway rejects StoryForge target', function () { putenv('INTERVIEWIQ_API_ORIGIN=https://storyforge-v5-api-production.up.railway.app'); eq(mmiiqg_origin(), ''); });
check('gateway rejects embedded URL credentials', function () { putenv('INTERVIEWIQ_API_ORIGIN=https://user:pass@interviewiq-production.up.railway.app'); eq(mmiiqg_origin(), ''); });
check('gateway rejects URL path and query', function () { putenv('INTERVIEWIQ_API_ORIGIN=https://interviewiq-production.up.railway.app/api?x=1'); eq(mmiiqg_origin(), ''); });
check('gateway rejects arbitrary host and insecure origin', function () { foreach (array('https://example.com', 'http://interviewiq-production.up.railway.app') as $v) { putenv('INTERVIEWIQ_API_ORIGIN=' . $v); eq(mmiiqg_origin(), ''); } });
check('gateway owns only exact InterviewIQ path', function () { eq(mmiiqg_path('/interviewiq/'), '/interviewiq/'); eq(mmiiqg_path('/storyforge/'), false); eq(mmiiqg_path('/interviewiq-other/'), false); });
check('gateway rejects encoded/traversal and malformed paths', function () { foreach (array('/interviewiq/../wp-config.php', '/interviewiq/%2e%2e/file', '/interviewiq//file', '/interviewiq/a\\b', '/interviewiq/a#b') as $p) { eq(mmiiqg_path($p), false); } });
check('gateway API allowlist excludes sibling and arbitrary routes', function () { eq(mmiiqg_api_route('GET', '/interviewiq/api/bootstrap')['target'], '/api/bootstrap'); eq(mmiiqg_api_route('POST', '/interviewiq/api/commands')['target'], '/api/commands'); eq(mmiiqg_api_route('GET', '/interviewiq/api/admin/users'), null); eq(mmiiqg_api_route('DELETE', '/interviewiq/api/bootstrap'), null); });
check('gateway audio path and JSON upload bound are explicit', function () { $p = '/interviewiq/api/recordings/11111111-1111-4111-8111-111111111111/segments'; eq(mmiiqg_api_route('POST', $p)['max_bytes'], 1572864); eq(mmiiqg_api_route('GET', $p), null); });
check('gateway pause and resume are explicit mutations', function () { foreach (array('pause', 'resume') as $action) { $p = '/interviewiq/api/recordings/11111111-1111-4111-8111-111111111111/' . $action; ok(mmiiqg_api_route('POST', $p)); eq(mmiiqg_api_route('GET', $p), null); } });
check('program search forwards only bounded canonical q', function () { $r = mmiiqg_api_route('GET', '/interviewiq/api/programs'); eq(mmiiqg_query($r, 'q=New+York'), '?q=New%20York'); eq(mmiiqg_query($r, 'q=' . str_repeat('a', 257)), false); });
check('program query cannot smuggle additional fields or credentials', function () { $r = mmiiqg_api_route('GET', '/interviewiq/api/programs'); foreach (array('q=a&q=b', 'q=x&token=bad', 'token=bad', 'q=%00', 'q=%zz') as $q) { eq(mmiiqg_query($r, $q), false); } });
check('bootstrap rejects all query parameters', function () { eq(mmiiqg_query(mmiiqg_api_route('GET', '/interviewiq/api/bootstrap'), 'q=a'), false); });
check('missing immutable release cannot serve fallback UI', function () { eq(mmiiqg_read_release(__DIR__ . '/absent-runtime'), null); });
check('immutable manifest serves only matching file bytes', function () { with_release(function ($root) { $r = mmiiqg_read_release($root); ok($r); ok(mmiiqg_asset($r, 'index.html')); ok(mmiiqg_asset($r, 'app.mjs')); eq(mmiiqg_asset($r, 'other.mjs'), null); }); });
check('post-seal asset mutation is refused', function () { with_release(function ($root, $id, $dir) { $r = mmiiqg_read_release($root); file_put_contents($dir . '/app.mjs', 'export const fixture = false;'); clearstatcache(); eq(mmiiqg_asset($r, 'app.mjs'), null); }); });
check('versioned assets remain independent of current pointer', function () { with_release(function ($root, $id) { unlink($root . '/current'); symlink('releases/' . str_repeat('b', 40), $root . '/current'); eq(mmiiqg_read_release($root), null); ok(mmiiqg_asset(mmiiqg_read_release($root, $id), 'app.mjs')); }); });
check('release symlink cannot escape immutable releases root', function () { with_release(function ($root) { unlink($root . '/current'); symlink(sys_get_temp_dir(), $root . '/current'); eq(mmiiqg_read_release($root), null); }); });
check('release manifest PHP is never a public static asset', function () { with_release(function ($root) { eq(mmiiqg_asset(mmiiqg_read_release($root), 'release.php'), null); }); });
check('asset traversal and symlink escapes are refused', function () { with_release(function ($root, $id, $dir) { $r = mmiiqg_read_release($root); eq(mmiiqg_asset($r, '../release.php'), null); unlink($dir . '/app.mjs'); symlink(__FILE__, $dir . '/app.mjs'); eq(mmiiqg_asset($r, 'app.mjs'), null); }); });
check('invalid manifest cannot execute a fallback release', function () { with_release(function ($root, $id, $dir) { file_put_contents($dir . '/release.php', '<?php return null;'); eq(mmiiqg_read_release($root), null); }); });
check('malformed manifest fails closed without uncaught parse error', function () { with_release(function ($root, $id, $dir) { file_put_contents($dir . '/release.php', '<?php return [;'); eq(mmiiqg_read_release($root), null); }); });

if (defined('IIQ_TEST_FIXTURE_ONLY') && IIQ_TEST_FIXTURE_ONLY) { return; }

$results = array();
foreach ($tests as [$name, $fn]) {
    reset_state();
    try { $fn(); $results[] = array('name' => $name, 'pass' => true); }
    catch (Throwable $error) { $results[] = array('name' => $name, 'pass' => false, 'error' => $error->getMessage()); }
}
$failed = array_values(array_filter($results, static fn($r) => !$r['pass']));
echo json_encode(array('suite' => 'isolated-wordpress-auth-gateway', 'passed' => count($results) - count($failed),
    'failed' => count($failed), 'tests' => $results), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
exit($failed ? 1 : 0);
