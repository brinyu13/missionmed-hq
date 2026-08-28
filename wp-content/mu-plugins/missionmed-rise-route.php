<?php
/**
 * Plugin Name: MissionMed RISE Route
 * Description: Bounded same-origin reverse proxy for /rise/ and /api/rise/v1/.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function mmrise_route_path() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '/';
    $path = (string) wp_parse_url($request_uri, PHP_URL_PATH);
    return rawurldecode($path ?: '/');
}

function mmrise_route_matches($path) {
    return $path === '/rise' || strpos($path, '/rise/') === 0 || strpos($path, '/api/rise/v1/') === 0;
}

function mmrise_route_origin() {
    if (!defined('MMED_RISE_ORIGIN')) {
        return '';
    }
    $configured = trim((string) MMED_RISE_ORIGIN);
    $parts = wp_parse_url($configured);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
        return '';
    }
    if (!empty($parts['user']) || !empty($parts['pass']) || !empty($parts['query']) || !empty($parts['fragment'])) {
        return '';
    }
    $path = isset($parts['path']) ? rtrim((string) $parts['path'], '/') : '';
    if ($path !== '') {
        return '';
    }
    return 'https://' . strtolower((string) $parts['host']) . (isset($parts['port']) ? ':' . (int) $parts['port'] : '');
}

function mmrise_route_cookie_header() {
    $allowed = array();
    foreach ($_COOKIE as $name => $value) {
        $name = (string) $name;
        if (
            $name === 'mmhq_session' || $name === 'mmed_rise_wp_nonce' ||
            strpos($name, 'wordpress_') === 0 || strpos($name, 'wordpress_logged_in_') === 0 ||
            strpos($name, 'wordpress_sec_') === 0
        ) {
            $allowed[] = $name . '=' . rawurlencode((string) $value);
        }
    }
    return implode('; ', $allowed);
}

function mmrise_route_json_error($status, $code, $message) {
    status_header((int) $status);
    nocache_headers();
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode(array('error' => array('code' => $code, 'message' => $message)));
    exit;
}

function mmrise_route_handle() {
    $path = mmrise_route_path();
    if (!mmrise_route_matches($path)) {
        return;
    }
    $is_health = $path === '/api/rise/v1/health';
    $is_api = strpos($path, '/api/rise/v1/') === 0;
    if (!$is_health && !is_user_logged_in()) {
        if ($is_api) {
            mmrise_route_json_error(401, 'UNAUTHENTICATED', 'A MissionMed login is required.');
        }
        wp_safe_redirect(wp_login_url(home_url('/rise/')));
        exit;
    }
    if (!$is_health && empty($_COOKIE['mmhq_session'])) {
        if ($is_api) {
            mmrise_route_json_error(401, 'RISE_SESSION_REQUIRED', 'The RISE audience session must be established.');
        }
        wp_safe_redirect(add_query_arg(
            array('action' => 'mmed_rise_auth_redirect', 'final' => '/rise/'),
            admin_url('admin-post.php')
        ));
        exit;
    }
    $origin = mmrise_route_origin();
    if ($origin === '') {
        mmrise_route_json_error(503, 'RISE_ROUTE_UNCONFIGURED', 'The isolated RISE origin is not configured.');
    }
    if (!$is_health && is_user_logged_in() && !headers_sent()) {
        setcookie('mmed_rise_wp_nonce', wp_create_nonce('wp_rest'), array(
            'expires' => time() + 43200,
            'path' => '/',
            'secure' => is_ssl(),
            'httponly' => false,
            'samesite' => 'Lax',
        ));
    }
    $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : $path;
    $target = $origin . $request_uri;
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
    $headers = array(
        'Accept' => isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '*/*',
        'Cookie' => mmrise_route_cookie_header(),
        'X-Forwarded-Host' => (string) wp_parse_url(home_url('/'), PHP_URL_HOST),
        'X-Forwarded-Proto' => 'https',
    );
    if (isset($_SERVER['CONTENT_TYPE'])) {
        $headers['Content-Type'] = (string) $_SERVER['CONTENT_TYPE'];
    }
    if (isset($_SERVER['HTTP_X_RISE_CSRF'])) {
        $headers['X-RISE-CSRF'] = (string) $_SERVER['HTTP_X_RISE_CSRF'];
    }
    if (isset($_SERVER['HTTP_X_WP_NONCE'])) {
        $headers['X-WP-Nonce'] = (string) $_SERVER['HTTP_X_WP_NONCE'];
    }
    $body = in_array($method, array('POST', 'PUT', 'PATCH', 'DELETE'), true)
        ? file_get_contents('php://input')
        : null;
    $response = wp_remote_request($target, array(
        'method' => $method,
        'timeout' => 30,
        'redirection' => 0,
        'sslverify' => true,
        'headers' => $headers,
        'body' => $body,
        'limit_response_size' => 3 * 1024 * 1024,
    ));
    if (is_wp_error($response)) {
        mmrise_route_json_error(502, 'RISE_UPSTREAM_UNAVAILABLE', 'The isolated RISE service is unavailable.');
    }
    $status = (int) wp_remote_retrieve_response_code($response);
    status_header($status > 0 ? $status : 502);
    foreach (array(
        'content-type',
        'cache-control',
        'etag',
        'x-request-id',
        'content-security-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'permissions-policy',
        'referrer-policy',
        'x-content-type-options',
        'x-frame-options',
    ) as $header_name) {
        $header_value = wp_remote_retrieve_header($response, $header_name);
        if ($header_value !== '' && strpos((string) $header_value, "\r") === false && strpos((string) $header_value, "\n") === false) {
            header($header_name . ': ' . (string) $header_value, true);
        }
    }
    header('X-MissionMed-RISE-Proxy: 1');
    if ($method !== 'HEAD') {
        echo (string) wp_remote_retrieve_body($response);
    }
    exit;
}

add_action('parse_request', 'mmrise_route_handle', 0);
