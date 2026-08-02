<?php
/**
 * Plugin Name: MissionMed Timeline Route
 * Description: Canonical immutable /timeline/ release route for the controlled Timeline beta.
 * Version: 0.1.0
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if (!defined('ABSPATH')) {
    exit;
}
if (defined('MISSIONMED_TIMELINE_ROUTE_ENABLED') && !MISSIONMED_TIMELINE_ROUTE_ENABLED) {
    return;
}

const MMTLR_BASE_PATH = '/timeline/';

function mmtlr_request_path() {
    $request_uri = (string) wp_unslash($_SERVER['REQUEST_URI'] ?? '');
    $path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    $home_path = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
    if ($home_path !== '' && $home_path !== '/' && str_starts_with($path, rtrim($home_path, '/') . '/')) {
        $path = substr($path, strlen(rtrim($home_path, '/')));
    }
    return $path ?: '/';
}

function mmtlr_is_canonical_host() {
    $home = wp_parse_url(home_url('/'));
    $expected = strtolower((string) ($home['host'] ?? '')) . (!empty($home['port']) ? ':' . absint($home['port']) : '');
    $incoming = strtolower(trim((string) wp_unslash($_SERVER['HTTP_HOST'] ?? '')));
    return $expected !== '' && preg_match('/^[a-z0-9.-]+(?::[0-9]{1,5})?$/', $incoming) && hash_equals($expected, $incoming);
}

function mmtlr_error($status, $code, $message) {
    while (ob_get_level() > 0) {
        if (!@ob_end_clean()) break;
    }
    status_header(absint($status));
    nocache_headers();
    header('Cache-Control: no-store, private', true);
    header('Content-Type: application/json; charset=utf-8', true);
    header('X-Content-Type-Options: nosniff', true);
    echo wp_json_encode(array('error' => array('code' => sanitize_key($code), 'message' => (string) $message)));
    exit;
}

function mmtlr_release_root() {
    if (!defined('MISSIONMED_TIMELINE_RELEASE_ROOT')) {
        return '';
    }
    $configured = rtrim((string) MISSIONMED_TIMELINE_RELEASE_ROOT, DIRECTORY_SEPARATOR);
    if ($configured === '' || !str_starts_with($configured, DIRECTORY_SEPARATOR)) {
        return '';
    }
    return $configured;
}

function mmtlr_manifest() {
    $root = mmtlr_release_root();
    $current = realpath($root . DIRECTORY_SEPARATOR . 'current');
    $releases = realpath($root . DIRECTORY_SEPARATOR . 'releases');
    if (!$current || !$releases || !str_starts_with($current . DIRECTORY_SEPARATOR, $releases . DIRECTORY_SEPARATOR)) {
        return new WP_Error('timeline_release_unavailable', 'Timeline release is unavailable.', array('status' => 503));
    }
    $manifest_path = $current . DIRECTORY_SEPARATOR . 'release-manifest.json';
    $bytes = is_readable($manifest_path) ? file_get_contents($manifest_path) : false;
    $manifest = is_string($bytes) ? json_decode($bytes, true) : null;
    if (!is_array($manifest) || ($manifest['schema_version'] ?? '') !== 'd1-411c-release-manifest.1' || !is_array($manifest['files'] ?? null)) {
        return new WP_Error('timeline_release_invalid', 'Timeline release is invalid.', array('status' => 503));
    }
    return array('root' => $current, 'manifest' => $manifest);
}

function mmtlr_send_security_headers($content_type) {
    nocache_headers();
    header('Cache-Control: no-store, private', true);
    header('Pragma: no-cache', true);
    header('Surrogate-Control: no-store', true);
    header('CDN-Cache-Control: no-store', true);
    header('Content-Type: ' . $content_type, true);
    header('Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'self\'; frame-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'self\'; form-action \'self\'', true);
    header('Referrer-Policy: no-referrer', true);
    header('X-Content-Type-Options: nosniff', true);
    header('X-Frame-Options: SAMEORIGIN', true);
    header('Permissions-Policy: camera=(), geolocation=(), microphone=()', true);
    header('X-Robots-Tag: noindex, nofollow, noarchive', true);
    header('X-MissionMed-Timeline-Route: wordpress-immutable-release', true);
}

function mmtlr_serve() {
    $path = mmtlr_request_path();
    if ($path === rtrim(MMTLR_BASE_PATH, '/')) {
        wp_safe_redirect(home_url(MMTLR_BASE_PATH), 308);
        exit;
    }
    if (!str_starts_with($path, MMTLR_BASE_PATH) || str_starts_with($path, MMTLR_BASE_PATH . 'api/')) {
        return;
    }
    if (!mmtlr_is_canonical_host()) {
        mmtlr_error(421, 'canonical_host_required', 'Timeline must be opened on the canonical MissionMed host.');
    }
    if (!is_user_logged_in()) {
        wp_safe_redirect(wp_login_url(home_url(MMTLR_BASE_PATH)), 302);
        exit;
    }
    if (!function_exists('mmtl_access_state')) {
        mmtlr_error(503, 'timeline_identity_gateway_unavailable', 'Timeline identity gateway is unavailable.');
    }
    $access = mmtl_access_state(wp_get_current_user());
    if (is_wp_error($access)) {
        mmtlr_error((int) ($access->get_error_data()['status'] ?? 403), $access->get_error_code(), $access->get_error_message());
    }
    $relative = substr($path, strlen(MMTLR_BASE_PATH));
    $relative = $relative === '' ? 'index.html' : rawurldecode($relative);
    if (strlen($relative) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $relative) || preg_match('#(^|/)\.\.?(/|$)#', $relative)) {
        mmtlr_error(400, 'timeline_asset_path_invalid', 'Timeline asset path is invalid.');
    }
    $release = mmtlr_manifest();
    if (is_wp_error($release)) {
        mmtlr_error((int) $release->get_error_data()['status'], $release->get_error_code(), $release->get_error_message());
    }
    $entry = $release['manifest']['files'][$relative] ?? null;
    if (!is_array($entry) || !preg_match('/^[a-f0-9]{64}$/', (string) ($entry['sha256'] ?? ''))) {
        mmtlr_error(404, 'timeline_asset_not_found', 'Timeline asset was not found.');
    }
    $file = realpath($release['root'] . DIRECTORY_SEPARATOR . $relative);
    if (!$file || !str_starts_with($file, $release['root'] . DIRECTORY_SEPARATOR) || !is_file($file)) {
        mmtlr_error(404, 'timeline_asset_not_found', 'Timeline asset was not found.');
    }
    $size = filesize($file);
    if ($size !== (int) $entry['bytes'] || !hash_equals((string) $entry['sha256'], hash_file('sha256', $file))) {
        mmtlr_error(503, 'timeline_asset_integrity_failed', 'Timeline release integrity check failed.');
    }
    while (ob_get_level() > 0) {
        if (!@ob_end_clean()) break;
    }
    mmtlr_send_security_headers((string) $entry['content_type']);
    header('Content-Length: ' . $size, true);
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'HEAD') {
        readfile($file);
    }
    exit;
}
add_action('template_redirect', 'mmtlr_serve', -20);
