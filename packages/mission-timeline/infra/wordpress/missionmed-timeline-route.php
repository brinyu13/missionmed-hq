<?php
/**
 * Plugin Name: MissionMed Timeline Route
 * Description: Authenticated /timeline/ route backed by a Timeline-owned execution-private release bundle.
 * Version: 500.0.0
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
const MMTLR_RUNTIME_SCHEMA = 'd1-500-wordpress-runtime.1';

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

function mmtlr_runtime_root() {
    return __DIR__ . DIRECTORY_SEPARATOR . 'missionmed-timeline-runtime';
}

function mmtlr_bundle() {
    $runtime = mmtlr_runtime_root();
    $releases = realpath($runtime . DIRECTORY_SEPARATOR . 'releases');
    $selected = realpath($runtime . DIRECTORY_SEPARATOR . 'current');
    if (!$releases || !$selected || !str_starts_with($selected . DIRECTORY_SEPARATOR, $releases . DIRECTORY_SEPARATOR)) {
        return new WP_Error('timeline_release_unavailable', 'Timeline release is unavailable.', array('status' => 503));
    }
    $bundle_file = $selected . DIRECTORY_SEPARATOR . 'release.php';
    if (!is_file($bundle_file) || is_link($bundle_file) || !is_readable($bundle_file)) {
        return new WP_Error('timeline_release_unavailable', 'Timeline release is unavailable.', array('status' => 503));
    }
    $bundle = include $bundle_file;
    if (
        !is_array($bundle)
        || ($bundle['schema_version'] ?? '') !== MMTLR_RUNTIME_SCHEMA
        || !preg_match('/^timeline-wp-[a-f0-9]{16}$/', (string) ($bundle['release_id'] ?? ''))
        || !preg_match('/^timeline-[a-f0-9]{16}$/', (string) ($bundle['source_release_id'] ?? ''))
        || !preg_match('/^[a-f0-9]{40}$/', (string) ($bundle['source_commit'] ?? ''))
        || !is_array($bundle['index'] ?? null)
        || !is_array($bundle['assets'] ?? null)
    ) {
        return new WP_Error('timeline_release_invalid', 'Timeline release is invalid.', array('status' => 503));
    }
    return $bundle;
}

function mmtlr_decode_entry($entry, $alias = '') {
    if (
        !is_array($entry)
        || ($entry['encoding'] ?? '') !== 'base64'
        || !preg_match('/^[a-f0-9]{64}$/', (string) ($entry['sha256'] ?? ''))
        || !is_int($entry['bytes'] ?? null)
        || (int) $entry['bytes'] < 0
        || !is_string($entry['content_type'] ?? null)
        || !is_string($entry['data'] ?? null)
    ) {
        return null;
    }
    $bytes = base64_decode($entry['data'], true);
    if (!is_string($bytes) || strlen($bytes) !== (int) $entry['bytes'] || !hash_equals((string) $entry['sha256'], hash('sha256', $bytes))) {
        return null;
    }
    if ($alias !== '' && (!preg_match('/^[a-f0-9]{12}$/', $alias) || !hash_equals($alias, substr((string) $entry['sha256'], 0, 12)))) {
        return null;
    }
    $allowed = array('text/html; charset=utf-8', 'text/css; charset=utf-8', 'text/javascript; charset=utf-8', 'application/json', 'text/plain; charset=utf-8', 'font/woff2', 'image/png', 'image/jpeg', 'image/webp');
    return in_array((string) $entry['content_type'], $allowed, true) ? $bytes : null;
}

function mmtlr_headers($bundle, $content_type, $immutable) {
    if ($immutable) {
        header('Cache-Control: public, max-age=31536000, immutable', true);
    } else {
        nocache_headers();
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
    }
    header('Surrogate-Control: no-store', true);
    header('CDN-Cache-Control: no-store', true);
    header('Content-Type: ' . $content_type, true);
    header('Content-Security-Policy: default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'self\'; frame-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'self\'; form-action \'self\'', true);
    header('Referrer-Policy: no-referrer', true);
    header('X-Content-Type-Options: nosniff', true);
    header('X-Frame-Options: SAMEORIGIN', true);
    header('Permissions-Policy: camera=(), geolocation=(), microphone=()', true);
    header('X-Robots-Tag: noindex, nofollow, noarchive', true);
    header('X-MissionMed-Timeline-Route: wordpress-runtime-bundle', true);
    header('X-MissionMed-Timeline-Release: ' . (string) $bundle['release_id'], true);
}

function mmtlr_render_consent($user) {
    $eligibility = function_exists('mmtl_eligibility_state') ? mmtl_eligibility_state($user) : new WP_Error(
        'timeline_identity_gateway_unavailable',
        'Timeline identity gateway is unavailable.',
        array('status' => 503)
    );
    if (is_wp_error($eligibility)) {
        mmtlr_error((int) ($eligibility->get_error_data()['status'] ?? 403), $eligibility->get_error_code(), $eligibility->get_error_message());
    }
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method === 'POST') {
        $nonce = sanitize_text_field((string) wp_unslash($_POST['_wpnonce'] ?? ''));
        if (!mmtl_verify_origin_header($_SERVER['HTTP_ORIGIN'] ?? '') || !wp_verify_nonce($nonce, 'missionmed_timeline_remote_sync_consent')) {
            mmtlr_error(403, 'csrf_failed', 'A valid MissionMed consent request is required.');
        }
        if ((string) wp_unslash($_POST['timeline_remote_sync_consent'] ?? '') !== 'grant') {
            mmtlr_error(400, 'timeline_consent_confirmation_required', 'Confirm remote save to continue.');
        }
        $recorded = mmtl_record_remote_sync_consent((int) $user->ID);
        if (is_wp_error($recorded)) {
            mmtlr_error((int) ($recorded->get_error_data()['status'] ?? 503), $recorded->get_error_code(), $recorded->get_error_message());
        }
        wp_safe_redirect(home_url(MMTLR_BASE_PATH), 303);
        exit;
    }
    if ($method !== 'GET' && $method !== 'HEAD') {
        mmtlr_error(405, 'method_not_allowed', 'Timeline consent method is not allowed.');
    }
    $settings = mmtl_settings();
    $nonce = wp_create_nonce('missionmed_timeline_remote_sync_consent');
    $matrix_url = esc_url((string) $settings['matrix_url']);
    $action = esc_url(home_url(MMTLR_BASE_PATH));
    $content = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Timeline secure save consent</title><style>body{margin:0;background:#090e18;color:#f7f8fb;font:16px/1.55 system-ui,sans-serif}'
        . 'main{max-width:640px;margin:10vh auto;padding:36px;background:#111827;border:1px solid #29354d;border-radius:16px}'
        . 'h1{font-size:28px;margin:0 0 14px}.detail{color:#bcc6d8}.choice{display:flex;gap:12px;margin:24px 0}'
        . 'button{background:#ff9a56;color:#10131c;border:0;padding:14px 22px;font-weight:800;cursor:pointer}'
        . 'a{color:#7ad8f7}</style></head><body><main><h1>Save your Timeline securely</h1>'
        . '<p class="detail">Timeline Builder can store the information you enter on MissionMed systems so it is available after you sign out and on your other authorized devices. Only you and specifically authorized MissionMed administrators can access it.</p>'
        . '<form method="post" action="' . $action . '"><input type="hidden" name="_wpnonce" value="' . esc_attr($nonce) . '">'
        . '<label class="choice"><input required type="checkbox" name="timeline_remote_sync_consent" value="grant">'
        . '<span>I consent to secure remote saving for Timeline Builder. Consent version: ' . esc_html((string) $settings['consent_version']) . '.</span></label>'
        . '<button type="submit">Agree and open Timeline Builder</button></form><p><a href="' . $matrix_url . '">Return to Matrix without enabling Timeline</a></p>'
        . '</main></body></html>';
    while (ob_get_level() > 0) {
        if (!@ob_end_clean()) break;
    }
    nocache_headers();
    header('Cache-Control: no-store, private', true);
    header('Content-Type: text/html; charset=utf-8', true);
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'", true);
    header('Referrer-Policy: no-referrer', true);
    header('X-Content-Type-Options: nosniff', true);
    header('X-Robots-Tag: noindex, nofollow, noarchive', true);
    if ($method !== 'HEAD') echo $content;
    exit;
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
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, array('GET', 'HEAD', 'POST'), true)) {
        mmtlr_error(405, 'method_not_allowed', 'Timeline route method is not allowed.');
    }
    if (!mmtlr_is_canonical_host()) {
        mmtlr_error(421, 'canonical_host_required', 'Timeline must be opened on the canonical MissionMed host.');
    }
    if (!is_user_logged_in()) {
        $return_to = home_url(MMTLR_BASE_PATH);
        $login_url = function_exists('mmtl_login_url') ? mmtl_login_url($return_to) : home_url('/member-dashboard/');
        wp_safe_redirect($login_url, 302);
        exit;
    }
    if (!function_exists('mmtl_access_state')) {
        mmtlr_error(503, 'timeline_identity_gateway_unavailable', 'Timeline identity gateway is unavailable.');
    }
    $access = mmtl_access_state(wp_get_current_user());
    if (is_wp_error($access)) {
        if ($access->get_error_code() === 'remote_sync_consent_required') {
            mmtlr_render_consent(wp_get_current_user());
        }
        mmtlr_error((int) ($access->get_error_data()['status'] ?? 403), $access->get_error_code(), $access->get_error_message());
    }
    if ($method === 'POST') {
        mmtlr_error(405, 'method_not_allowed', 'Timeline route method is not allowed.');
    }
    $bundle = mmtlr_bundle();
    if (is_wp_error($bundle)) {
        mmtlr_error((int) ($bundle->get_error_data()['status'] ?? 503), $bundle->get_error_code(), $bundle->get_error_message());
    }
    $relative = substr($path, strlen(MMTLR_BASE_PATH));
    if (preg_match('#^_asset/([a-f0-9]{12})$#', $relative, $matches)) {
        $alias = $matches[1];
        $entry = $bundle['assets'][$alias] ?? null;
        $bytes = mmtlr_decode_entry($entry, $alias);
        if (!is_string($bytes)) {
            mmtlr_error(404, 'timeline_asset_not_found', 'Timeline asset was not found.');
        }
        while (ob_get_level() > 0) {
            if (!@ob_end_clean()) break;
        }
        status_header(200);
        mmtlr_headers($bundle, (string) $entry['content_type'], true);
        header('Content-Length: ' . strlen($bytes), true);
        if ($method !== 'HEAD') echo $bytes;
        exit;
    }
    if ($relative !== '' && (strlen($relative) > 2048 || preg_match('/[\x00-\x1F\x7F]/', $relative) || str_contains($relative, '.'))) {
        mmtlr_error(404, 'timeline_route_not_found', 'Timeline route was not found.');
    }
    $entry = $bundle['index'];
    $bytes = mmtlr_decode_entry($entry);
    if (!is_string($bytes)) {
        mmtlr_error(503, 'timeline_release_integrity_failed', 'Timeline release integrity check failed.');
    }
    while (ob_get_level() > 0) {
        if (!@ob_end_clean()) break;
    }
    status_header(200);
    mmtlr_headers($bundle, (string) $entry['content_type'], false);
    header('Content-Length: ' . strlen($bytes), true);
    if ($method !== 'HEAD') echo $bytes;
    exit;
}
add_action('template_redirect', 'mmtlr_serve', -20);
