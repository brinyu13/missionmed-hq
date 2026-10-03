<?php
/** Loopback-only synthetic protocol harness. This file is never packaged. */
if (PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', array('127.0.0.1', '::1'), true)) {
    http_response_code(403); exit;
}
define('IIQ_TEST_FIXTURE_ONLY', true);
require __DIR__ . '/auth-gateway.test.php';
$server = $_SERVER;
reset_state();
$_SERVER = $server;
if (isset($_SERVER['HTTP_X_FIXTURE_ANONYMOUS'])) { $GLOBALS['current_user'] = new WP_User(0); }
if (isset($_SERVER['HTTP_X_FIXTURE_LOGOUT'])) { $GLOBALS['meta'][42]['session_tokens'] = array(); }
if (isset($_SERVER['HTTP_X_FIXTURE_DISABLED'])) { putenv('INTERVIEWIQ_ENABLED=false'); }

function status_header($code) { http_response_code($code); }
function wp_send_json($value, $status) { http_response_code($status); header('Content-Type: application/json'); echo json_encode($value); exit; }
function wp_safe_redirect($url, $status) { http_response_code($status); header('Location: ' . $url); }
function wp_login_url($url) { return 'https://missionmedinstitute.com/my-account/?redirect_to=' . rawurlencode($url); }
function wp_remote_request($url, $options) {
    $body = json_encode(array('ok' => true, 'forwarded' => array('url' => $url, 'method' => $options['method'],
        'origin' => $options['headers']['Origin'],
        'gatewayMatched' => hash_equals(mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET'), $options['headers']['X-MMED-IIQ-Gateway'] ?? ''),
        'authorizationPresent' => isset($options['headers']['Authorization']),
        'cookiesEmpty' => $options['cookies'] === array(), 'redirects' => $options['redirection'],
        'body' => json_decode($options['body'], true))));
    $mode = $_SERVER['HTTP_X_FIXTURE_UPSTREAM'] ?? '';
    return array('response' => array('code' => $mode === 'redirect' ? 302 : 200),
        'headers' => array('content-type' => $mode === 'html' ? 'text/html' : 'application/json'),
        'body' => $body);
}
function wp_remote_retrieve_response_code($v) { return $v['response']['code']; }
function wp_remote_retrieve_body($v) { return $v['body']; }
function wp_remote_retrieve_header($v, $key) { return $v['headers'][$key] ?? ''; }

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/wp-admin/admin-ajax.php') {
    if (($_GET['action'] ?? '') === 'missionmed_interviewiq_bootstrap') { mmiiq_ajax_bootstrap(); }
    if (($_GET['action'] ?? '') === 'missionmed_interviewiq_token') { mmiiq_ajax_token(); }
}
if ($path === '/wp-json/missionmed-interviewiq/v1/introspect') {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    $result = mmiiq_introspection(new Request(file_get_contents('php://input'), $headers, $_SERVER['REQUEST_METHOD']));
    if (is_wp_error($result)) { mmiiq_ajax_response($result); }
    foreach ($result->headers as $name => $value) { header($name . ': ' . $value); }
    wp_send_json($result->data, $result->status);
}
mmiiqg_handle();
http_response_code(404); echo '{}';
