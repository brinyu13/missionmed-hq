<?php
/**
 * Plugin Name: MissionMed MissionAccounts Route
 * Description: Default-off, same-origin gateway from /missionaccounts/ to the isolated MissionAccounts service.
 * Version: 0.1.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: MissionMed
 *
 * Deployment note: this file is a candidate only. Do not install it until the
 * Matrix runtime lock, route authority, exact Railway origin, and rollback gate
 * are approved for MX-MISSIONACCOUNTS-5301P.
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMMA_ROUTE_VERSION = '0.1.0';
const MMMA_ROUTE_PREFIX = '/missionaccounts';
const MMMA_MAX_REQUEST_BYTES = 2097152;
const MMMA_MAX_RESPONSE_BYTES = 4194304;

function mmma_route_enabled() {
    $value = defined('MISSIONACCOUNTS_ROUTE_ENABLED')
        ? MISSIONACCOUNTS_ROUTE_ENABLED
        : getenv('MISSIONACCOUNTS_ROUTE_ENABLED');
    return $value === true
        || $value === 1
        || in_array(strtolower(trim((string) $value)), array('1', 'true', 'yes', 'on'), true);
}

function mmma_upstream_origin() {
    $value = defined('MISSIONACCOUNTS_RAILWAY_ORIGIN')
        ? (string) MISSIONACCOUNTS_RAILWAY_ORIGIN
        : (string) getenv('MISSIONACCOUNTS_RAILWAY_ORIGIN');
    $value = untrailingslashit(trim($value));
    $parts = wp_parse_url($value);
    if (!is_array($parts)
        || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
        || empty($parts['host'])
        || !empty($parts['user'])
        || !empty($parts['pass'])
        || !empty($parts['query'])
        || !empty($parts['fragment'])
        || !empty($parts['path'])) {
        return '';
    }
    return $value;
}

function mmma_request_path() {
    $raw = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $path = (string) wp_parse_url($raw, PHP_URL_PATH);
    return $path !== '' ? $path : '/';
}

function mmma_is_route_request($path = null) {
    $path = is_string($path) ? $path : mmma_request_path();
    return $path === MMMA_ROUTE_PREFIX || str_starts_with($path, MMMA_ROUTE_PREFIX . '/');
}

function mmma_reject_ambiguous_path($raw_uri, $path) {
    if (preg_match('/%(?:00|2f|5c|25)/i', (string) $raw_uri)) {
        return true;
    }
    if (str_contains($path, "\\") || str_contains($path, "\0") || preg_match('#(?:^|/)\.\.?(/|$)#', $path)) {
        return true;
    }
    return false;
}

function mmma_same_wordpress_origin($origin) {
    $origin = strtolower(rtrim(trim((string) $origin), '/'));
    if ($origin === '') {
        return true;
    }
    $home = wp_parse_url(home_url('/'));
    $expected = strtolower((string) ($home['scheme'] ?? '')) . '://'
        . strtolower((string) ($home['host'] ?? ''))
        . (!empty($home['port']) ? ':' . absint($home['port']) : '');
    return hash_equals($expected, $origin);
}

function mmma_json_error($status, $code, $message) {
    status_header($status);
    nocache_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private', true);
    header('X-Content-Type-Options: nosniff');
    echo wp_json_encode(array('code' => $code, 'message' => $message));
    exit;
}

function mmma_bearer_header() {
    $value = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) wp_unslash($_SERVER['HTTP_AUTHORIZATION'])) : '';
    return preg_match('/^Bearer\s+[A-Za-z0-9._~-]+$/', $value) ? $value : '';
}

function mmma_is_public_api($upstream_path, $method) {
    if ($method === 'GET' && in_array($upstream_path, array('/api/config', '/api/health'), true)) {
        return true;
    }
    return $method === 'POST' && $upstream_path === '/api/webhooks/stripe';
}

function mmma_forward_headers($upstream_path, $method) {
    $headers = array(
        'Accept' => isset($_SERVER['HTTP_ACCEPT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_ACCEPT'])) : 'application/json',
        'X-Forwarded-Host' => (string) wp_parse_url(home_url('/'), PHP_URL_HOST),
        'X-Forwarded-Proto' => is_ssl() ? 'https' : 'http',
        'X-MissionAccounts-Gateway' => MMMA_ROUTE_VERSION,
    );
    $bearer = mmma_bearer_header();
    if ($bearer !== '') {
        $headers['Authorization'] = $bearer;
    } elseif (str_starts_with($upstream_path, '/api/') && !mmma_is_public_api($upstream_path, $method)) {
        mmma_json_error(401, 'auth_required', 'A MissionAccounts bearer token is required.');
    }
    $bounded = array(
        'CONTENT_TYPE' => 'Content-Type',
        'HTTP_IDEMPOTENCY_KEY' => 'Idempotency-Key',
        'HTTP_X_REQUEST_ID' => 'X-Request-Id',
        'HTTP_STRIPE_SIGNATURE' => 'Stripe-Signature',
    );
    foreach ($bounded as $server_key => $header_name) {
        if (!empty($_SERVER[$server_key])) {
            $headers[$header_name] = sanitize_text_field(wp_unslash($_SERVER[$server_key]));
        }
    }
    return $headers;
}

function mmma_emit_response($response, $method, $upstream_path) {
    $status = (int) wp_remote_retrieve_response_code($response);
    if ($status < 100 || $status > 599) {
        mmma_json_error(502, 'upstream_invalid', 'MissionAccounts returned an invalid response.');
    }
    $body = (string) wp_remote_retrieve_body($response);
    if (strlen($body) > MMMA_MAX_RESPONSE_BYTES) {
        mmma_json_error(502, 'upstream_too_large', 'MissionAccounts returned an oversized response.');
    }
    $content_type = sanitize_text_field((string) wp_remote_retrieve_header($response, 'content-type'));
    $allowed_type = preg_match('#^(?:text/html|application/json|application/javascript|text/css|image/svg\+xml|font/woff2)(?:;|$)#i', $content_type);
    if (!$allowed_type) {
        $content_type = str_starts_with($upstream_path, '/api/')
            ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
    }
    status_header($status);
    header('Content-Type: ' . $content_type);
    header('X-Content-Type-Options: nosniff');
    header('X-MissionAccounts-Route: wordpress-gateway');
    if (str_starts_with($upstream_path, '/api/') || str_starts_with(strtolower($content_type), 'text/html')) {
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
        header('X-Robots-Tag: noindex, nofollow', true);
    } else {
        header('Cache-Control: no-cache', true);
    }
    if ($method !== 'HEAD') {
        echo $body;
    }
    exit;
}

function mmma_proxy_request() {
    // MX-MISSIONACCOUNTS-5400A-CONT: deny this gateway until the provider
    // cache exclusion and full cross-user acceptance matrix are verified.
    // This must precede the feature flag; disabling it must not fall through
    // to another WordPress handler. Direct Railway remains isolated/available.
    if (mmma_is_route_request()) {
        mmma_json_error(503, 'missionaccounts_temporarily_unavailable',
            'MissionAccounts is temporarily unavailable while access protection is verified.');
    }
    if (!mmma_route_enabled()) {
        return;
    }
    $path = mmma_request_path();
    if (!mmma_is_route_request($path)) {
        return;
    }
    $raw_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    if (mmma_reject_ambiguous_path($raw_uri, $path)) {
        mmma_json_error(400, 'invalid_path', 'The MissionAccounts route is invalid.');
    }
    if ($path === MMMA_ROUTE_PREFIX) {
        status_header(308);
        header('Location: ' . esc_url_raw(home_url(MMMA_ROUTE_PREFIX . '/')));
        header('Cache-Control: no-store, private');
        exit;
    }
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? wp_unslash($_SERVER['HTTP_ORIGIN']) : '';
    if (!mmma_same_wordpress_origin($origin)) {
        mmma_json_error(403, 'origin_not_allowed', 'This origin may not access MissionAccounts.');
    }
    $upstream = mmma_upstream_origin();
    if ($upstream === '') {
        mmma_json_error(503, 'route_unconfigured', 'MissionAccounts is not configured.');
    }
    $method = strtoupper(isset($_SERVER['REQUEST_METHOD']) ? (string) $_SERVER['REQUEST_METHOD'] : 'GET');
    if (!in_array($method, array('GET', 'HEAD', 'POST', 'DELETE'), true)) {
        mmma_json_error(405, 'method_not_allowed', 'This MissionAccounts method is not allowed.');
    }
    $content_length = isset($_SERVER['CONTENT_LENGTH']) ? absint($_SERVER['CONTENT_LENGTH']) : 0;
    if ($content_length > MMMA_MAX_REQUEST_BYTES) {
        mmma_json_error(413, 'request_too_large', 'The MissionAccounts request is too large.');
    }
    $upstream_path = substr($path, strlen(MMMA_ROUTE_PREFIX));
    $upstream_path = $upstream_path !== '' ? $upstream_path : '/';
    $query = (string) wp_parse_url($raw_uri, PHP_URL_QUERY);
    $url = $upstream . $upstream_path . ($query !== '' ? '?' . $query : '');
    $body = in_array($method, array('POST', 'DELETE'), true) ? (string) file_get_contents('php://input') : null;
    if ($body !== null && strlen($body) > MMMA_MAX_REQUEST_BYTES) {
        mmma_json_error(413, 'request_too_large', 'The MissionAccounts request is too large.');
    }
    $args = array(
        'method' => $method,
        'timeout' => 20,
        'redirection' => 0,
        'reject_unsafe_urls' => true,
        'headers' => mmma_forward_headers($upstream_path, $method),
    );
    if ($body !== null) {
        $args['body'] = $body;
    }
    $response = wp_remote_request($url, $args);
    if (is_wp_error($response)) {
        mmma_json_error(502, 'upstream_unavailable', 'MissionAccounts is temporarily unavailable.');
    }
    mmma_emit_response($response, $method, $upstream_path);
}
add_action('template_redirect', 'mmma_proxy_request', -1000);
