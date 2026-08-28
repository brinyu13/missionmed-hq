<?php
// Local integration fixture: exercises the real RISE route handler while
// replacing only the WordPress HTTP transport with a deterministic upstream.

define('ABSPATH', __DIR__ . '/');
define('MMED_RISE_ORIGIN', 'https://rise-upstream.invalid');

function wp_unslash($value) { return $value; }
function wp_parse_url($value, $component = -1) { return parse_url($value, $component); }
function is_user_logged_in() { return true; }
function wp_safe_redirect($value) { header('Location: ' . $value, true, 302); }
function wp_login_url($value) { return '/login?next=' . rawurlencode($value); }
function home_url($value = '/') { return 'https://missionmedinstitute.com' . $value; }
function add_query_arg($values, $url) { return $url . '?' . http_build_query($values); }
function admin_url($value) { return 'https://missionmedinstitute.com/wp-admin/' . ltrim($value, '/'); }
function wp_create_nonce($value) { return 'fixture-nonce'; }
function is_ssl() { return true; }
function is_wp_error($value) { return false; }
function status_header($status) { http_response_code($status); }
function nocache_headers() { header('Cache-Control: no-store', true); }
function wp_json_encode($value) { return json_encode($value); }
function add_action($name, $callback, $priority = 10) {}

function wp_remote_request($url, $options) {
    return array(
        'response' => array('code' => 200),
        'headers' => array(
            'content-type' => 'text/html; charset=utf-8',
            'cache-control' => 'private, no-store',
            'etag' => '"rise-fixture"',
            'x-request-id' => 'rise-fixture-request',
            'content-security-policy' => "default-src 'self'; frame-ancestors 'none'",
            'cross-origin-opener-policy' => 'same-origin',
            'cross-origin-resource-policy' => 'same-origin',
            'permissions-policy' => 'camera=(), microphone=(), geolocation=(), payment=()',
            'referrer-policy' => 'strict-origin-when-cross-origin',
            'x-content-type-options' => 'nosniff',
            'x-frame-options' => 'DENY',
            'set-cookie' => 'must-not-forward=1',
            'connection' => 'keep-alive',
        ),
        'body' => '<!doctype html><title>RISE proxy fixture</title>',
    );
}

function wp_remote_retrieve_response_code($response) { return $response['response']['code']; }
function wp_remote_retrieve_header($response, $name) { return $response['headers'][strtolower($name)] ?? ''; }
function wp_remote_retrieve_body($response) { return $response['body']; }

$_COOKIE['mmhq_session'] = 'fixture-session';
require getenv('RISE_ROUTE_PLUGIN_PATH');
mmrise_route_handle();
