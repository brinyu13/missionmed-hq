<?php
/**
 * Plugin Name: MissionMed InterviewIQ Gateway
 * Description: Default-off isolated /interviewiq/ immutable UI and private API gateway.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }
if (!function_exists('mmiiq_enabled')) { require_once __DIR__ . '/missionmed-interviewiq-sso.php'; }

function mmiiqg_error($status, $code) {
    mmiiq_private_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode(array('error' => array('code' => $code,
        'message' => $status === 401 ? 'Sign in to MissionMed to continue.' : 'InterviewIQ could not complete this request.')));
    exit;
}

/** Only a pinned HTTPS origin is accepted; no URL credentials, path or query. */
function mmiiqg_origin() {
    $raw = mmiiq_setting('INTERVIEWIQ_API_ORIGIN');
    $parts = wp_parse_url($raw);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
        || isset($parts['port']) || !in_array($parts['path'] ?? '', array('', '/'), true)
        || !preg_match('/^interviewiq(?:-[a-z0-9]+)*\.up\.railway\.app$/D', $parts['host'])
        || in_array($parts['host'], array('missionmed-hq-production.up.railway.app',
            'storyforge-v5-api-production.up.railway.app'), true)) { return ''; }
    return 'https://' . $parts['host'];
}

function mmiiqg_path($request_uri) {
    if (!is_string($request_uri) || strlen($request_uri) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $request_uri)) { return false; }
    $parts = wp_parse_url($request_uri);
    if (!is_array($parts) || isset($parts['scheme']) || isset($parts['host']) || isset($parts['fragment'])) { return false; }
    $path = $parts['path'] ?? '';
    if (!preg_match('#^/interviewiq(?:/[A-Za-z0-9._/-]*)?$#D', $path)
        || strpos($path, '//') !== false || preg_match('#/(?:\.|\.\.)(?:/|$)#D', $path)) { return false; }
    return $path;
}

/** Explicit API contract, independent of whichever routes a sibling implements. */
function mmiiqg_api_route($method, $path) {
    if ($method === 'GET' && $path === '/interviewiq/api/bootstrap') { return array('target' => '/api/bootstrap', 'max_bytes' => 0); }
    if ($method === 'GET' && $path === '/interviewiq/api/programs') { return array('target' => '/api/programs', 'max_bytes' => 0, 'query' => 'q'); }
    if ($method === 'POST' && $path === '/interviewiq/api/commands') { return array('target' => '/api/commands', 'max_bytes' => 1048576); }
    if ($method === 'POST' && $path === '/interviewiq/api/recordings') { return array('target' => '/api/recordings', 'max_bytes' => 16384); }
    if (preg_match('#^/interviewiq/api/recordings/([a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})(?:/(segments|finish|cancel|retry|pause|resume))?$#D', $path, $match)) {
        $action = $match[2] ?? '';
        if (($method === 'GET' && $action === '') || ($method === 'POST' && $action !== '')) {
            return array('target' => substr($path, strlen('/interviewiq')),
                'max_bytes' => $action === 'segments' ? 1572864 : 16384);
        }
    }
    return null;
}

function mmiiqg_query($route, $raw) {
    if ($raw === '') { return ''; }
    if (($route['query'] ?? '') !== 'q' || !is_string($raw) || strlen($raw) > 3074
        || !preg_match('/^q=([^&]*)$/D', $raw, $match) || preg_match('/%(?![a-fA-F0-9]{2})/', $raw)) { return false; }
    $q = urldecode($match[1]);
    if (!preg_match('//u', $q) || mb_strlen($q, 'UTF-8') > 256 || preg_match('/[\x00-\x1f\x7f]/', $q)) { return false; }
    return '?q=' . rawurlencode($q);
}

/**
 * release.php is deployment-owned generated PHP returning a manifest. The only
 * permitted symlink is current -> a direct child of releases. Every served file
 * is size/hash verified and must remain inside that immutable release.
 */
function mmiiqg_read_release($runtime_root = null, $release_id = null) {
    $root = $runtime_root ?? (__DIR__ . '/missionmed-interviewiq-runtime');
    if (!is_dir($root) || is_link($root) || !is_dir($root . '/releases') || is_link($root . '/releases')
        || ($release_id === null && !is_link($root . '/current'))
        || ($release_id !== null && (!is_string($release_id) || !preg_match('/^[a-f0-9]{40,64}$/D', $release_id)))) { return null; }
    $releases = realpath($root . '/releases');
    $candidate = $release_id === null ? $root . '/current' : $root . '/releases/' . $release_id;
    if ($release_id !== null && is_link($candidate)) { return null; }
    $current = realpath($candidate);
    if ($releases === false || $current === false || dirname($current) !== $releases
        || !preg_match('/^[a-f0-9]{40,64}$/D', basename($current))) { return null; }
    $manifest_path = $current . '/release.php';
    if (!is_file($manifest_path) || is_link($manifest_path) || filesize($manifest_path) > 262144) { return null; }
    try { $manifest = require $manifest_path; } catch (Throwable $error) { return null; }
    if (!is_array($manifest) || ($manifest['schema'] ?? '') !== 'missionmed.interviewiq.release.v1'
        || ($manifest['release_id'] ?? '') !== basename($current) || !is_array($manifest['assets'] ?? null)
        || !isset($manifest['assets']['index.html']) || count($manifest['assets']) > 500) { return null; }
    return array('root' => $current, 'manifest' => $manifest);
}

/** Extensionless aliases avoid front-server static-file interception; no generic file mapping. */
function mmiiqg_versioned_asset_relative($relative) {
    if ($relative === 'styles') { return 'styles.css'; }
    if ($relative === 'app') { return 'app.js'; }
    return $relative;
}

function mmiiqg_asset($release, $relative) {
    if (!is_array($release) || !is_string($relative)
        || !preg_match('#^[A-Za-z0-9_-][A-Za-z0-9_./-]*$#D', $relative)
        || strpos($relative, '..') !== false || strpos($relative, '//') !== false) { return null; }
    $types = array('html' => 'text/html; charset=utf-8', 'js' => 'text/javascript; charset=utf-8',
        'mjs' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8',
        'woff2' => 'font/woff2', 'woff' => 'font/woff', 'png' => 'image/png',
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon', 'json' => 'application/json; charset=utf-8');
    $ext = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
    if (!isset($types[$ext])) { return null; }
    $entry = $release['manifest']['assets'][$relative] ?? null;
    if (!is_array($entry) || !is_string($entry['sha256'] ?? null)
        || !preg_match('/^[a-f0-9]{64}$/D', $entry['sha256']) || !is_int($entry['bytes'] ?? null)
        || $entry['bytes'] < 1 || $entry['bytes'] > 16777216) { return null; }
    $path = $release['root'] . '/' . $relative;
    $actual = realpath($path);
    if ($actual === false || !is_file($actual) || is_link($path)
        || strpos($actual, $release['root'] . '/') !== 0 || filesize($actual) !== $entry['bytes']
        || !hash_equals($entry['sha256'], hash_file('sha256', $actual))) { return null; }
    return array('path' => $actual, 'type' => $types[$ext], 'sha256' => $entry['sha256']);
}

function mmiiqg_security_headers() {
    mmiiq_private_headers();
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    header('Permissions-Policy: microphone=(self), camera=()');
    header('X-Frame-Options: DENY');
    header('Cross-Origin-Resource-Policy: same-origin');
}

function mmiiqg_proxy($route, $method) {
    if (isset($_SERVER['HTTP_X_MMED_IIQ_GATEWAY'])) { mmiiqg_error(400, 'reserved_header'); }
    $actor = mmiiq_browser_identity(false);
    if (is_wp_error($actor)) { mmiiqg_error((int) ($actor->get_error_data()['status'] ?? 403), $actor->get_error_code()); }
    if ($method !== 'GET') {
        $check = mmiiq_browser_request(true);
        if (is_wp_error($check)) { mmiiqg_error((int) ($check->get_error_data()['status'] ?? 403), $check->get_error_code()); }
    }
    $origin = mmiiqg_origin();
    $gateway_secret = mmiiq_setting('INTERVIEWIQ_GATEWAY_SECRET');
    if ($origin === '' || strlen($gateway_secret) < 32) { mmiiqg_error(503, 'origin_unconfigured'); }
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!mmiiq_browser_bearer_valid($authorization, $actor)) {
        mmiiqg_error(401, 'auth_required');
    }
    $query = mmiiqg_query($route, $_SERVER['QUERY_STRING'] ?? '');
    if ($query === false) { mmiiqg_error(400, 'query_not_supported'); }
    $body = '';
    $content_type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($method !== 'GET') {
        if ($content_type !== 'application/json') { mmiiqg_error(415, 'content_type_not_supported'); }
        if (isset($_SERVER['CONTENT_LENGTH']) && (!ctype_digit((string) $_SERVER['CONTENT_LENGTH'])
            || (int) $_SERVER['CONTENT_LENGTH'] > $route['max_bytes'])) { mmiiqg_error(413, 'request_too_large'); }
        $input = fopen('php://input', 'rb');
        $body = $input ? stream_get_contents($input, $route['max_bytes'] + 1) : false;
        if ($input) { fclose($input); }
        if (!is_string($body) || strlen($body) > $route['max_bytes']) { mmiiqg_error(413, 'request_too_large'); }
    }
    $headers = array('Accept' => 'application/json', 'Authorization' => $authorization,
        'Origin' => mmiiq_wp_origin(), 'X-MMED-IIQ-Gateway' => $gateway_secret);
    if ($method !== 'GET') { $headers['Content-Type'] = $content_type; }
    foreach (array('Idempotency-Key' => 'HTTP_IDEMPOTENCY_KEY') as $name => $server_key) {
        $value = $_SERVER[$server_key] ?? '';
        if ($value !== '' && is_string($value) && preg_match('/^[A-Za-z0-9_.:-]{1,120}$/D', $value)) { $headers[$name] = $value; }
    }
    $result = wp_remote_request($origin . $route['target'] . $query, array('method' => $method, 'headers' => $headers,
        'body' => $body, 'timeout' => 45, 'redirection' => 0, 'sslverify' => true,
        'reject_unsafe_urls' => true, 'limit_response_size' => 4194305, 'cookies' => array()));
    if (is_wp_error($result)) { mmiiqg_error(502, 'api_unavailable'); }
    $status = (int) wp_remote_retrieve_response_code($result);
    $response_body = wp_remote_retrieve_body($result);
    $type = (string) wp_remote_retrieve_header($result, 'content-type');
    if ($status < 200 || $status >= 600 || ($status >= 300 && $status < 400)
        || !is_string($response_body) || strlen($response_body) > 4194304
        || strtolower(trim(explode(';', $type)[0])) !== 'application/json') { mmiiqg_error(502, 'api_response_invalid'); }
    mmiiqg_security_headers();
    status_header($status);
    header('Content-Type: application/json; charset=utf-8');
    echo $response_body;
    exit;
}

function mmiiqg_handle() {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    // Siblings remain outside this hook, including similarly named routes.
    if (!is_string($uri) || !preg_match('#^/interviewiq(?:/|\?|$)#', $uri)) { return; }
    if (!defined('DONOTCACHEPAGE')) { define('DONOTCACHEPAGE', true); }
    if (!defined('DONOTCACHEDB')) { define('DONOTCACHEDB', true); }
    if (!mmiiq_enabled() || !mmiiq_secrets_ready() || mmiiq_wp_origin() === '') { mmiiqg_error(503, 'interviewiq_disabled_or_unconfigured'); }
    $path = mmiiqg_path($uri);
    if ($path === false) { mmiiqg_error(400, 'request_target_invalid'); }
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($path === '/interviewiq') {
        if (!in_array($method, array('GET', 'HEAD'), true)) { mmiiqg_error(405, 'method_not_allowed'); }
        mmiiq_private_headers();
        wp_safe_redirect('/interviewiq/', 302); exit;
    }
    if (strpos($path, '/interviewiq/api/') === 0) {
        $route = mmiiqg_api_route($method, $path);
        if (!$route) { mmiiqg_error(404, 'not_found'); }
        mmiiqg_proxy($route, $method); return;
    }
    if (!in_array($method, array('GET', 'HEAD'), true)) { mmiiqg_error(405, 'method_not_allowed'); }
    // Authenticated UI assets only. Bootstrap will provision the separate IIQ UUID.
    $user = wp_get_current_user();
    if (!($user instanceof WP_User) || !$user->exists()) {
        mmiiq_private_headers();
        wp_safe_redirect(wp_login_url(home_url('/interviewiq/')), 302); exit;
    }
    $grant = mmiiq_access_for_user($user);
    if (is_wp_error($grant)) {
        $status = (int) ($grant->get_error_data()['status'] ?? 403);
        if ($status === 403 && $path === '/interviewiq/') {
            mmiiqg_security_headers(); status_header(403); header('Content-Type: text/html; charset=utf-8');
            echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InterviewIQ access</title><body style="margin:0;background:#090d14;color:#edf0fa;font:18px system-ui;padding:8vh 8vw"><main style="max-width:42rem"><p style="color:#ffb336;font-weight:800">MissionMed / InterviewIQ</p><h1>InterviewIQ is not available for this account.</h1><p>The Calendar is currently available to eligible 360 and IV Prep Complete students. Your current enrollment is checked each time you enter.</p><p><a style="color:#ffb336" href="/member-dashboard/">Back to Matrix</a></p></main></body></html>'; exit;
        }
        mmiiqg_error($status, $grant->get_error_code());
    }
    $relative = $path === '/interviewiq/' ? 'index.html' : substr($path, strlen('/interviewiq/'));
    $release_id = null;
    if (preg_match('#^releases/([a-f0-9]{40,64})/(.+)$#D', $relative, $versioned)) {
        $release_id = $versioned[1]; $relative = mmiiqg_versioned_asset_relative($versioned[2]);
    }
    $release = mmiiqg_read_release(null, $release_id);
    $asset = mmiiqg_asset($release, $relative);
    if (!$asset) { mmiiqg_error(503, 'release_unavailable'); }
    mmiiqg_security_headers();
    status_header(200);
    header('Content-Type: ' . $asset['type']);
    header('X-InterviewIQ-Release: ' . $release['manifest']['release_id']);
    header('Content-Length: ' . filesize($asset['path']));
    if ($method !== 'HEAD') { readfile($asset['path']); }
    exit;
}
add_action('parse_request', 'mmiiqg_handle', -1000);
