<?php
/**
 * Plugin Name: MissionMed Timeline SSO
 * Description: Default-off Timeline identity, LearnDash eligibility, JWT, same-origin API gateway, and Matrix launch seam.
 * Version: 500.0.4
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMTL_OPTION = 'missionmed_timeline_settings';
const MMTL_RATE_KEYS_OPTION = 'missionmed_timeline_rate_keys';
const MMTL_PRINCIPAL_META = '_missionmed_timeline_principal_id';
const MMTL_SYNTHETIC_TEST_META = '_missionmed_timeline_synthetic_test';
const MMTL_CONSENT_META = '_missionmed_timeline_remote_sync_consent';
const MMTL_CONSENT_AT_META = '_missionmed_timeline_remote_sync_consented_at';
const MMTL_REST_NAMESPACE = 'missionmed-timeline/v1';
const MMTL_REST_TOKEN_ROUTE = '/token';
const MMTL_REST_FILEVAULT_SOURCES_ROUTE = '/file-vault/sources';
const MMTL_COURSE_ID = 3893;
const MMTL_VERSION = '500.0.5';
const MMTL_PRINCIPAL_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
// Smart Fill is bounded by the browser parser that reads the handed-off bytes, not by the
// larger Timeline SOURCE custody ceiling, so the chooser and the transfer agree on one limit.
const MMTL_FILEVAULT_SMART_FILL_MAX_BYTES = 20 * 1024 * 1024;

function mmtl_defaults() {
    return array(
        'timeline_enabled' => false,
        'rollout_stage' => 'off',
        'canary_wp_user_ids' => array(),
        'eligibility_verified' => false,
        'entitlement_version' => '',
        'consent_version' => 'd1-500-v1',
        'base_path' => '/timeline/',
        'matrix_url' => home_url('/member-dashboard/'),
        'api_origin' => '',
        'issuer' => home_url('/timeline/'),
        'audience' => 'mission-timeline',
        'active_key_id' => 'timeline-v1',
        'token_ttl_seconds' => 120,
        'rate_limit_requests' => 30,
        'rate_limit_window_seconds' => 60,
        'matrix_menu_locations' => array('member-dashboard'),
    );
}

function mmtl_settings() {
    $stored = get_option(MMTL_OPTION, array());
    $settings = wp_parse_args(is_array($stored) ? $stored : array(), mmtl_defaults());
    $settings['timeline_enabled'] = mmtl_bool($settings['timeline_enabled']);
    $settings['rollout_stage'] = in_array((string) ($settings['rollout_stage'] ?? 'off'), array('off', 'canary', 'eligible_360'), true)
        ? (string) $settings['rollout_stage']
        : 'off';
    $settings['canary_wp_user_ids'] = array_slice(array_values(array_unique(array_filter(array_map(
        'absint',
        (array) ($settings['canary_wp_user_ids'] ?? array())
    )))), 0, 10);
    $settings['eligibility_verified'] = mmtl_bool($settings['eligibility_verified'] ?? false);
    $settings['entitlement_version'] = sanitize_text_field((string) ($settings['entitlement_version'] ?? ''));
    $settings['consent_version'] = sanitize_key((string) ($settings['consent_version'] ?? 'd1-500-v1'));
    $settings['base_path'] = '/' . trim((string) $settings['base_path'], '/') . '/';
    $settings['matrix_url'] = esc_url_raw((string) $settings['matrix_url']);
    $settings['api_origin'] = untrailingslashit(esc_url_raw((string) $settings['api_origin']));
    $settings['issuer'] = esc_url_raw((string) $settings['issuer']);
    $settings['audience'] = sanitize_text_field((string) $settings['audience']);
    $settings['active_key_id'] = sanitize_key((string) $settings['active_key_id']);
    $settings['token_ttl_seconds'] = max(60, min(300, absint($settings['token_ttl_seconds'])));
    $settings['rate_limit_requests'] = max(1, min(120, absint($settings['rate_limit_requests'])));
    $settings['rate_limit_window_seconds'] = max(10, min(300, absint($settings['rate_limit_window_seconds'])));
    $settings['matrix_menu_locations'] = array_values(array_filter(array_map(
        'sanitize_key',
        (array) $settings['matrix_menu_locations']
    )));
    return apply_filters('missionmed_timeline_settings', $settings);
}

function mmtl_activate() {
    $stored = get_option(MMTL_OPTION, array());
    $settings = wp_parse_args(is_array($stored) ? $stored : array(), mmtl_defaults());
    $settings['timeline_enabled'] = false;
    $settings['rollout_stage'] = 'off';
    update_option(MMTL_OPTION, $settings, false);
    mmtl_register_rewrites();
    flush_rewrite_rules(false);
}
register_activation_hook(__FILE__, 'mmtl_activate');

function mmtl_deactivate() {
    $settings = mmtl_settings();
    $settings['timeline_enabled'] = false;
    $settings['rollout_stage'] = 'off';
    update_option(MMTL_OPTION, $settings, false);
    foreach ((array) get_option(MMTL_RATE_KEYS_OPTION, array()) as $key) {
        delete_transient((string) $key);
    }
    delete_option(MMTL_RATE_KEYS_OPTION);
    flush_rewrite_rules(false);
}
register_deactivation_hook(__FILE__, 'mmtl_deactivate');

function mmtl_bool($value) {
    return is_bool($value)
        ? $value
        : in_array(strtolower(trim((string) $value)), array('1', 'true', 'yes', 'on'), true);
}

function mmtl_is_administrator($user) {
    return $user instanceof WP_User && $user->exists() && user_can($user, 'manage_options');
}

function mmtl_has_course_access($user_id) {
    if (!function_exists('sfwd_lms_has_access')) {
        return false;
    }
    return sfwd_lms_has_access(MMTL_COURSE_ID, absint($user_id)) === true;
}

function mmtl_remote_sync_consent($user_id, $settings) {
    $version = sanitize_key((string) ($settings['consent_version'] ?? ''));
    $recorded_version = sanitize_key((string) get_user_meta(absint($user_id), MMTL_CONSENT_META, true));
    $recorded_at = sanitize_text_field((string) get_user_meta(absint($user_id), MMTL_CONSENT_AT_META, true));
    $timestamp = $recorded_at === '' ? false : strtotime($recorded_at);
    $granted = $version !== '' && hash_equals($version, $recorded_version)
        && $timestamp !== false && $timestamp <= time();
    return array('granted' => $granted, 'version' => $version, 'recorded_at' => $granted ? gmdate('c', $timestamp) : '');
}

function mmtl_eligibility_state($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }
    $settings = mmtl_settings();
    if (empty($settings['timeline_enabled']) || $settings['rollout_stage'] === 'off') {
        return new WP_Error('timeline_disabled', 'Timeline is not enabled for this beta.', array('status' => 403));
    }
    $administrator = mmtl_is_administrator($user);
    $course_access = mmtl_has_course_access((int) $user->ID);
    $canary = in_array((int) $user->ID, $settings['canary_wp_user_ids'], true);
    if ($settings['rollout_stage'] === 'canary' && !$canary) {
        return new WP_Error('canary_access_required', 'Timeline canary access is required.', array('status' => 403));
    }
    if ($settings['rollout_stage'] === 'canary' && !$administrator && empty($settings['eligibility_verified'])) {
        return new WP_Error('eligibility_unverified', 'Timeline 360 eligibility is not verified.', array('status' => 503));
    }
    if ($settings['rollout_stage'] === 'canary' && !$administrator && !$course_access) {
        return new WP_Error(
            'eligibility_required',
            'Active MissionMed 360 course access is required.',
            array('status' => 403, 'course_id' => MMTL_COURSE_ID)
        );
    }
    if ($settings['rollout_stage'] === 'eligible_360' && $administrator && !$canary) {
        return new WP_Error('administrator_approval_required', 'Timeline administrator access is not approved.', array('status' => 403));
    }
    if ($settings['rollout_stage'] === 'eligible_360' && !$administrator && empty($settings['eligibility_verified'])) {
        return new WP_Error('eligibility_unverified', 'Timeline 360 eligibility is not verified.', array('status' => 503));
    }
    if ($settings['rollout_stage'] === 'eligible_360' && !$administrator && !$course_access) {
        return new WP_Error(
            'eligibility_required',
            'Active MissionMed 360 course access is required.',
            array('status' => 403, 'course_id' => MMTL_COURSE_ID)
        );
    }
    $consent = mmtl_remote_sync_consent((int) $user->ID, $settings);
    return array(
        'role' => $administrator ? 'PROGRAM_ADMIN' : 'STUDENT',
        'administrator' => $administrator,
        'course_access' => $course_access,
        'course_id' => MMTL_COURSE_ID,
        'rollout_stage' => $settings['rollout_stage'],
        'entitlement_version' => $settings['entitlement_version'],
        'remote_sync_consent' => !$administrator && !empty($consent['granted']),
        'remote_sync_allowed' => $administrator || !empty($consent['granted']),
        'consent_version' => (string) $consent['version'],
        'consented_at' => (string) $consent['recorded_at'],
    );
}

function mmtl_access_state($user) {
    $access = mmtl_eligibility_state($user);
    if (is_wp_error($access)) {
        return $access;
    }
    if (empty($access['administrator']) && empty($access['remote_sync_consent'])) {
        return new WP_Error('remote_sync_consent_required', 'Timeline remote-save consent is required.', array('status' => 403));
    }
    return $access;
}

function mmtl_record_remote_sync_consent($user_id) {
    $user_id = absint($user_id);
    $settings = mmtl_settings();
    $version = sanitize_key((string) ($settings['consent_version'] ?? ''));
    if ($user_id < 1 || $version === '') {
        return new WP_Error('timeline_consent_configuration_invalid', 'Timeline consent is not configured.', array('status' => 503));
    }
    $recorded_at = gmdate('c');
    update_user_meta($user_id, MMTL_CONSENT_META, $version);
    update_user_meta($user_id, MMTL_CONSENT_AT_META, $recorded_at);
    $consent = mmtl_remote_sync_consent($user_id, $settings);
    if (empty($consent['granted'])) {
        delete_user_meta($user_id, MMTL_CONSENT_META, $version);
        delete_user_meta($user_id, MMTL_CONSENT_AT_META, $recorded_at);
        return new WP_Error('timeline_consent_record_failed', 'Timeline consent could not be recorded.', array('status' => 503));
    }
    return $consent;
}

function mmtl_withdraw_remote_sync_consent($user_id) {
    $user_id = absint($user_id);
    delete_user_meta($user_id, MMTL_CONSENT_META);
    delete_user_meta($user_id, MMTL_CONSENT_AT_META);
    return empty(mmtl_remote_sync_consent($user_id, mmtl_settings())['granted']);
}

function mmtl_valid_uuid($value) {
    return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', (string) $value) === 1;
}

function mmtl_uuid_v5($namespace, $name) {
    $namespace_hex = str_replace('-', '', strtolower(trim((string) $namespace)));
    if (strlen($namespace_hex) !== 32 || !ctype_xdigit($namespace_hex)) {
        return '';
    }
    $hash = sha1(pack('H*', $namespace_hex) . (string) $name);
    $time_hi = (hexdec(substr($hash, 12, 4)) & 0x0fff) | 0x5000;
    $clock_seq = (hexdec(substr($hash, 16, 4)) & 0x3fff) | 0x8000;
    return substr($hash, 0, 8) . '-'
        . substr($hash, 8, 4) . '-'
        . sprintf('%04x', $time_hi) . '-'
        . sprintf('%04x', $clock_seq) . '-'
        . substr($hash, 20, 12);
}

function mmtl_derived_principal_for_user($user_id) {
    $user_id = absint($user_id);
    if ($user_id < 1) {
        return '';
    }
    return mmtl_uuid_v5(MMTL_PRINCIPAL_NAMESPACE, 'missionmedinstitute.com/timeline/wp-user/' . $user_id);
}

function mmtl_principal_for_user($user_id) {
    $user_id = absint($user_id);
    if ($user_id < 1) {
        return new WP_Error('timeline_identity_invalid', 'Timeline identity is invalid.', array('status' => 500));
    }
    $existing = strtolower(trim((string) get_user_meta($user_id, MMTL_PRINCIPAL_META, true)));
    if ($existing !== '') {
        return mmtl_valid_uuid($existing)
            ? $existing
            : new WP_Error('timeline_identity_conflict', 'Timeline identity mapping is invalid.', array('status' => 503));
    }
    $derived = mmtl_derived_principal_for_user($user_id);
    return mmtl_valid_uuid($derived)
        ? $derived
        : new WP_Error('timeline_identity_invalid', 'Timeline identity is invalid.', array('status' => 500));
}

function mmtl_secret() {
    $secret = trim((string) getenv('MISSIONMED_TIMELINE_JWT_SECRET'));
    if ($secret === '' && defined('MISSIONMED_TIMELINE_JWT_SECRET')) {
        $secret = trim((string) MISSIONMED_TIMELINE_JWT_SECRET);
    }
    return (string) apply_filters('missionmed_timeline_jwt_secret', $secret);
}

function mmtl_gateway_secret() {
    $secret = trim((string) getenv('MISSIONMED_TIMELINE_GATEWAY_SECRET'));
    if ($secret === '' && defined('MISSIONMED_TIMELINE_GATEWAY_SECRET')) {
        $secret = trim((string) MISSIONMED_TIMELINE_GATEWAY_SECRET);
    }
    return (string) apply_filters('missionmed_timeline_gateway_secret', $secret);
}

function mmtl_base64url_encode($value) {
    return rtrim(strtr(base64_encode((string) $value), '+/', '-_'), '=');
}

function mmtl_base64url_decode($value) {
    $value = strtr((string) $value, '-_', '+/');
    $padding = strlen($value) % 4;
    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }
    return base64_decode($value, true);
}

function mmtl_issue_jwt($user, $access) {
    $settings = mmtl_settings();
    $secret = mmtl_secret();
    if (strlen($secret) < 32) {
        return new WP_Error('timeline_signer_unavailable', 'Timeline token signing is not configured.', array('status' => 503));
    }
    $principal = mmtl_principal_for_user((int) $user->ID);
    if (is_wp_error($principal)) {
        return $principal;
    }
    $now = time();
    $expires = $now + (int) $settings['token_ttl_seconds'];
    $header = array('alg' => 'HS256', 'typ' => 'JWT', 'kid' => (string) $settings['active_key_id']);
    $payload = array(
        'iss' => (string) $settings['issuer'],
        'aud' => (string) $settings['audience'],
        'sub' => $principal,
        'iat' => $now,
        'nbf' => $now - 2,
        'exp' => $expires,
        'jti' => wp_generate_uuid4(),
        'wp_user_id' => (int) $user->ID,
        'timeline_role' => (string) $access['role'],
        'timeline_eligible' => true,
        'timeline_admin' => !empty($access['administrator']),
        'is_wordpress_administrator' => !empty($access['administrator']),
        'has_learndash_3893_access' => !empty($access['course_access']),
        'course_id' => MMTL_COURSE_ID,
        'timeline_rollout_stage' => (string) $access['rollout_stage'],
        'entitlement_version' => (string) $access['entitlement_version'],
        'timeline_remote_sync_consent' => !empty($access['remote_sync_consent']),
        'timeline_remote_sync_allowed' => !empty($access['remote_sync_allowed']),
        'timeline_consent_version' => (string) $access['consent_version'],
    );
    $encoded_header = mmtl_base64url_encode(wp_json_encode($header));
    $encoded_payload = mmtl_base64url_encode(wp_json_encode($payload));
    $signed = $encoded_header . '.' . $encoded_payload;
    $signature = hash_hmac('sha256', $signed, $secret, true);
    return array(
        'token' => $signed . '.' . mmtl_base64url_encode($signature),
        'expires_at' => $expires,
        'ttl_seconds' => (int) $settings['token_ttl_seconds'],
        'principal_id' => $principal,
    );
}

function mmtl_verify_jwt($token, $expected_principal, $expected_wp_user_id, $access) {
    $segments = explode('.', trim((string) $token));
    if (count($segments) !== 3) {
        return new WP_Error('timeline_token_invalid', 'Timeline token is invalid.', array('status' => 401));
    }
    list($encoded_header, $encoded_payload, $encoded_signature) = $segments;
    $secret = mmtl_secret();
    if (strlen($secret) < 32) {
        return new WP_Error('timeline_signer_unavailable', 'Timeline token signing is not configured.', array('status' => 503));
    }
    $expected_signature = hash_hmac('sha256', $encoded_header . '.' . $encoded_payload, $secret, true);
    $actual_signature = mmtl_base64url_decode($encoded_signature);
    if (!is_string($actual_signature) || !hash_equals($expected_signature, $actual_signature)) {
        return new WP_Error('timeline_token_invalid', 'Timeline token is invalid.', array('status' => 401));
    }
    $header = json_decode((string) mmtl_base64url_decode($encoded_header), true);
    $claims = json_decode((string) mmtl_base64url_decode($encoded_payload), true);
    $settings = mmtl_settings();
    $now = time();
    if (
        !is_array($header) || ($header['alg'] ?? '') !== 'HS256' || ($header['typ'] ?? '') !== 'JWT'
        || !hash_equals((string) $settings['active_key_id'], (string) ($header['kid'] ?? ''))
        || !is_array($claims)
        || !hash_equals((string) $settings['issuer'], (string) ($claims['iss'] ?? ''))
        || !hash_equals((string) $settings['audience'], (string) ($claims['aud'] ?? ''))
        || !hash_equals((string) $expected_principal, (string) ($claims['sub'] ?? ''))
        || (int) ($claims['wp_user_id'] ?? 0) !== absint($expected_wp_user_id)
        || empty($claims['timeline_eligible'])
        || (bool) ($claims['is_wordpress_administrator'] ?? false) !== !empty($access['administrator'])
        || (bool) ($claims['has_learndash_3893_access'] ?? false) !== !empty($access['course_access'])
        || (int) ($claims['course_id'] ?? 0) !== MMTL_COURSE_ID
        || !hash_equals((string) $access['rollout_stage'], (string) ($claims['timeline_rollout_stage'] ?? ''))
        || !hash_equals((string) $access['entitlement_version'], (string) ($claims['entitlement_version'] ?? ''))
        || (bool) ($claims['timeline_remote_sync_consent'] ?? false) !== !empty($access['remote_sync_consent'])
        || (bool) ($claims['timeline_remote_sync_allowed'] ?? false) !== !empty($access['remote_sync_allowed'])
        || !hash_equals((string) $access['consent_version'], (string) ($claims['timeline_consent_version'] ?? ''))
        || (int) ($claims['nbf'] ?? 0) > $now + 5
        || (int) ($claims['exp'] ?? 0) <= $now
        || !mmtl_valid_uuid((string) ($claims['jti'] ?? ''))
    ) {
        return new WP_Error('timeline_token_invalid', 'Timeline token is invalid.', array('status' => 401));
    }
    return $claims;
}

function mmtl_request_ip() {
    return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
}

function mmtl_rate_limit($user_id) {
    $settings = mmtl_settings();
    $key = 'mmtl_rl_' . substr(hash('sha256', absint($user_id) . '|' . mmtl_request_ip()), 0, 32);
    $now = time();
    $window = (int) $settings['rate_limit_window_seconds'];
    $state = get_transient($key);
    if (!is_array($state) || (int) ($state['reset'] ?? 0) <= $now) {
        $state = array('count' => 0, 'reset' => $now + $window);
    }
    $state['count'] = (int) $state['count'] + 1;
    set_transient($key, $state, max(1, (int) $state['reset'] - $now));
    $keys = array_values(array_unique(array_merge((array) get_option(MMTL_RATE_KEYS_OPTION, array()), array($key))));
    update_option(MMTL_RATE_KEYS_OPTION, array_slice($keys, -500), false);
    if ($state['count'] > (int) $settings['rate_limit_requests']) {
        return new WP_Error(
            'timeline_rate_limited',
            'Timeline token refresh is temporarily rate limited.',
            array('status' => 429, 'retry_after' => max(1, (int) $state['reset'] - $now))
        );
    }
    return true;
}

function mmtl_allowed_origin() {
    $home = home_url('/');
    return strtolower((string) wp_parse_url($home, PHP_URL_SCHEME)) . '://' .
        strtolower((string) wp_parse_url($home, PHP_URL_HOST)) .
        (($port = wp_parse_url($home, PHP_URL_PORT)) ? ':' . absint($port) : '');
}

function mmtl_verify_origin_header($origin) {
    $origin = trim((string) $origin);
    if ($origin === '') {
        return true;
    }
    return hash_equals(mmtl_allowed_origin(), strtolower(rtrim($origin, '/')));
}

function mmtl_private_headers() {
    nocache_headers();
    if (!headers_sent()) {
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
    }
}

function mmtl_login_url($return_to) {
    $matrix_url = mmtl_settings()['matrix_url'];
    return add_query_arg('timeline_return_to', esc_url_raw((string) $return_to), $matrix_url);
}

function mmtl_token_permission($request) {
    if (!is_user_logged_in()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }
    if (!mmtl_verify_origin_header($request->get_header('origin'))) {
        return new WP_Error('origin_not_allowed', 'This origin may not request a Timeline token.', array('status' => 403));
    }
    $nonce = trim((string) $request->get_header('x-wp-nonce'));
    if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('csrf_failed', 'A valid WordPress REST nonce is required.', array('status' => 403));
    }
    $access = mmtl_eligibility_state(wp_get_current_user());
    return is_wp_error($access) ? $access : true;
}

function mmtl_token_endpoint($request) {
    $user = wp_get_current_user();
    $access = mmtl_eligibility_state($user);
    if (is_wp_error($access)) {
        return $access;
    }
    $rate = mmtl_rate_limit((int) $user->ID);
    if (is_wp_error($rate)) {
        return $rate;
    }
    $issued = mmtl_issue_jwt($user, $access);
    if (is_wp_error($issued)) {
        return $issued;
    }
    $issued['nonce'] = wp_create_nonce('wp_rest');
    $response = new WP_REST_Response($issued, 200);
    $response->header('Cache-Control', 'no-store, private');
    $response->header('Pragma', 'no-cache');
    return $response;
}

/**
 * Restrict File Vault source reads to the same active Timeline authority used
 * by remote persistence. This endpoint never accepts a user or owner override.
 */
function mmtl_filevault_source_permission($request) {
    if (!is_user_logged_in()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }
    if (!mmtl_verify_origin_header($request->get_header('origin'))) {
        return new WP_Error('origin_not_allowed', 'This origin may not read Timeline source documents.', array('status' => 403));
    }
    $nonce = trim((string) $request->get_header('x-wp-nonce'));
    if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('csrf_failed', 'A valid WordPress REST nonce is required.', array('status' => 403));
    }
    $user = wp_get_current_user();
    $access = mmtl_access_state($user);
    if (is_wp_error($access)) {
        return $access;
    }
    $principal = mmtl_principal_for_user((int) $user->ID);
    return is_wp_error($principal) ? $principal : true;
}

function mmtl_filevault_source_response($data, $status = 200) {
    $response = new WP_REST_Response($data, absint($status));
    $response->header('Cache-Control', 'no-store, private');
    $response->header('Pragma', 'no-cache');
    return $response;
}

function mmtl_filevault_source_error($code, $message, $status) {
    return new WP_Error(sanitize_key($code), (string) $message, array('status' => absint($status)));
}

/**
 * Dispatch the already-registered File Vault V1 read contract without
 * exposing its storage implementation or accepting cross-user parameters.
 */
function mmtl_filevault_source_dispatch($path, $params = array()) {
    $routes = rest_get_server()->get_routes();
    if (!isset($routes['/mmed/v1/files'])) {
        return mmtl_filevault_source_error(
            'timeline_filevault_unavailable',
            'File Vault is temporarily unavailable. You can still upload a CV from this device.',
            503
        );
    }
    $request = new WP_REST_Request('GET', $path);
    foreach ($params as $key => $value) {
        $request->set_param(sanitize_key($key), sanitize_text_field((string) $value));
    }
    $response = rest_do_request($request);
    if (is_wp_error($response)) {
        return mmtl_filevault_source_error(
            'timeline_filevault_unavailable',
            'File Vault is temporarily unavailable. You can still upload a CV from this device.',
            503
        );
    }
    $status = (int) $response->get_status();
    if ($status < 200 || $status >= 300) {
        return mmtl_filevault_source_error(
            $status === 404 ? 'timeline_filevault_source_not_found' : 'timeline_filevault_unavailable',
            $status === 404
                ? 'That File Vault document is not available.'
                : 'File Vault is temporarily unavailable. You can still upload a CV from this device.',
            $status === 404 ? 404 : 503
        );
    }
    $data = $response->get_data();
    return is_array($data) ? $data : array();
}

function mmtl_filevault_source_allowed_type($value) {
    return in_array(sanitize_key((string) $value), array(
        'cv',
        'personal_statement',
        'certificate',
        'application',
        'other',
    ), true);
}

/**
 * One predicate for "Smart Fill will actually accept this". The chooser and the ingestion
 * route must agree, or the list offers documents the very next click provably rejects.
 */
function mmtl_filevault_source_smart_fill_ready($descriptor) {
    return is_array($descriptor)
        && in_array((string) $descriptor['mimeType'], array(
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ), true)
        && ($descriptor['sizeBytes'] === null
            || ($descriptor['sizeBytes'] > 0 && $descriptor['sizeBytes'] <= MMTL_FILEVAULT_SMART_FILL_MAX_BYTES));
}

/**
 * Return a storage-opaque descriptor. Signed URLs, object keys, document
 * contents, comments, advisor notes, and unrelated metadata are never copied.
 */
function mmtl_filevault_source_descriptor($record, $owner_id, $require_version = false) {
    if (!is_array($record) || absint($record['owner_id'] ?? 0) !== absint($owner_id)) {
        return null;
    }
    $id = sanitize_text_field((string) ($record['id'] ?? ''));
    $version_id = sanitize_text_field((string) ($record['current_version_id'] ?? ''));
    $document_type = sanitize_key((string) ($record['document_type'] ?? ''));
    if (!preg_match('/^[0-9a-fA-F-]{8,64}$/', $id) || !mmtl_filevault_source_allowed_type($document_type)) {
        return null;
    }
    $version = null;
    foreach ((array) ($record['versions'] ?? array()) as $candidate) {
        if (is_array($candidate) && hash_equals($version_id, sanitize_text_field((string) ($candidate['id'] ?? '')))) {
            $version = $candidate;
            break;
        }
    }
    if ($require_version && ($version_id === '' || !is_array($version) || empty($version['upload_confirmed']))) {
        return null;
    }
    $name = sanitize_file_name((string) ($record['original_filename'] ?? ''));
    if ($name === '') {
        $name = sanitize_text_field((string) ($record['display_name'] ?? $record['canonical_name'] ?? 'MissionMed document'));
    }
    return array(
        'id' => $id,
        'name' => $name,
        'provider' => 'missionmed-filevault-v1',
        'documentType' => $document_type,
        'versionId' => $version_id,
        'mimeType' => sanitize_text_field((string) ($version['mime_type'] ?? '')),
        'sizeBytes' => isset($version['file_size']) ? absint($version['file_size']) : null,
        'updatedAt' => sanitize_text_field((string) ($record['updated_at'] ?? '')),
    );
}

function mmtl_filevault_sources_endpoint($request) {
    $upstream = mmtl_filevault_source_dispatch('/mmed/v1/files');
    if (is_wp_error($upstream)) {
        return $upstream;
    }
    $owner_id = get_current_user_id();
    $query = trim(sanitize_text_field((string) $request->get_param('query')));
    $query = function_exists('mb_substr') ? mb_substr($query, 0, 80) : substr($query, 0, 80);
    $documents = array();
    $detail_lookups = 0;
    foreach ((array) ($upstream['files'] ?? array()) as $record) {
        $descriptor = mmtl_filevault_source_descriptor($record, $owner_id, true);
        if ($descriptor === null
            && $detail_lookups < 20
            && is_array($record)
            && !isset($record['versions'])
            && absint($record['owner_id'] ?? 0) === absint($owner_id)) {
            $detail_lookups++;
            // A summary listing that omits per-version detail would otherwise hide every
            // document, so resolve those candidates through the same owner-scoped detail read.
            $id = sanitize_text_field((string) ($record['id'] ?? ''));
            if (preg_match('/^[0-9a-fA-F-]{8,64}$/', $id)) {
                $detail = mmtl_filevault_source_dispatch('/mmed/v1/files/' . rawurlencode($id));
                $descriptor = is_wp_error($detail)
                    ? null
                    : mmtl_filevault_source_descriptor($detail['file'] ?? $detail, $owner_id, true);
            }
        }
        if ($descriptor === null
            || !mmtl_filevault_source_smart_fill_ready($descriptor)
            || ($query !== '' && stripos($descriptor['name'], $query) === false)) {
            continue;
        }
        $documents[] = $descriptor;
        if (count($documents) >= 20) {
            break;
        }
    }
    return mmtl_filevault_source_response(array('documents' => $documents));
}

function mmtl_filevault_source_endpoint($request) {
    $id = sanitize_text_field((string) $request['id']);
    if (!preg_match('/^[0-9a-fA-F-]{8,64}$/', $id)) {
        return mmtl_filevault_source_error('timeline_filevault_source_not_found', 'That File Vault document is not available.', 404);
    }
    $upstream = mmtl_filevault_source_dispatch('/mmed/v1/files/' . rawurlencode($id));
    if (is_wp_error($upstream)) {
        return $upstream;
    }
    $descriptor = mmtl_filevault_source_descriptor($upstream['file'] ?? $upstream, get_current_user_id(), true);
    return $descriptor === null
        ? mmtl_filevault_source_error('timeline_filevault_source_not_found', 'That File Vault document is not available.', 404)
        : mmtl_filevault_source_response(array('document' => $descriptor));
}

/**
 * Transfer one exact File Vault version into Timeline private SOURCE custody.
 * The signed File Vault URL is consumed only inside WordPress and is never
 * returned to the browser, persisted, logged, or copied into Timeline state.
 */
function mmtl_filevault_ingestion_endpoint($request) {
    $id = sanitize_text_field((string) $request['id']);
    $params = $request->get_json_params();
    $timeline_document_id = sanitize_text_field((string) ($params['timelineDocumentId'] ?? ''));
    $requested_version_id = sanitize_text_field((string) ($params['versionId'] ?? ''));
    if (!preg_match('/^[0-9a-fA-F-]{8,64}$/', $id)
        || !preg_match('/^[-_a-zA-Z0-9]{8,128}$/', $timeline_document_id)
        || !preg_match('/^[0-9a-fA-F-]{8,64}$/', $requested_version_id)) {
        return mmtl_filevault_source_error('timeline_filevault_source_not_found', 'That File Vault document is not available.', 404);
    }
    $detail = mmtl_filevault_source_dispatch('/mmed/v1/files/' . rawurlencode($id));
    if (is_wp_error($detail)) {
        return $detail;
    }
    $descriptor = mmtl_filevault_source_descriptor($detail['file'] ?? $detail, get_current_user_id(), true);
    if ($descriptor === null || !hash_equals((string) $descriptor['versionId'], $requested_version_id)) {
        return mmtl_filevault_source_error('timeline_filevault_source_not_found', 'That File Vault document is not available.', 404);
    }
    if (!mmtl_filevault_source_smart_fill_ready($descriptor)) {
        return in_array((string) $descriptor['mimeType'], array(
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ), true)
            ? mmtl_filevault_source_error(
                'timeline_filevault_source_size_denied',
                sprintf('Smart Fill reads documents up to %d MB. You can still upload a smaller CV from this device.', MMTL_FILEVAULT_SMART_FILL_MAX_BYTES / 1024 / 1024),
                413
            )
            : mmtl_filevault_source_error('timeline_filevault_source_type_denied', 'Choose a PDF or DOCX document for Smart Fill.', 415);
    }
    $download = mmtl_filevault_source_dispatch('/mmed/v1/files/' . rawurlencode($id) . '/download');
    $download_url = is_wp_error($download) ? '' : esc_url_raw((string) ($download['url'] ?? ''));
    if ($download_url === '' || !wp_http_validate_url($download_url) || strtolower((string) wp_parse_url($download_url, PHP_URL_SCHEME)) !== 'https') {
        return mmtl_filevault_source_error('timeline_filevault_unavailable', 'File Vault is temporarily unavailable. You can still upload a CV from this device.', 503);
    }
    $source_response = wp_remote_get($download_url, array(
        'timeout' => 30,
        'redirection' => 0,
        'reject_unsafe_urls' => true,
        'limit_response_size' => MMTL_FILEVAULT_SMART_FILL_MAX_BYTES + 1,
    ));
    if (is_wp_error($source_response) || (int) wp_remote_retrieve_response_code($source_response) !== 200) {
        return mmtl_filevault_source_error('timeline_filevault_unavailable', 'File Vault is temporarily unavailable. You can still upload a CV from this device.', 503);
    }
    $bytes = (string) wp_remote_retrieve_body($source_response);
    $byte_size = strlen($bytes);
    if ($byte_size < 1 || $byte_size > MMTL_FILEVAULT_SMART_FILL_MAX_BYTES) {
        return mmtl_filevault_source_error(
            'timeline_filevault_source_size_denied',
            sprintf('Smart Fill reads documents up to %d MB. You can still upload a smaller CV from this device.', MMTL_FILEVAULT_SMART_FILL_MAX_BYTES / 1024 / 1024),
            413
        );
    }
    $sha256 = hash('sha256', $bytes);
    $user = wp_get_current_user();
    $access = mmtl_access_state($user);
    $issued = is_wp_error($access) ? $access : mmtl_issue_jwt($user, $access);
    $settings = mmtl_settings();
    $gateway_secret = mmtl_gateway_secret();
    if (is_wp_error($issued) || $settings['api_origin'] === '' || !wp_http_validate_url($settings['api_origin']) || strlen($gateway_secret) < 32) {
        return mmtl_filevault_source_error('timeline_api_unavailable', 'Timeline Smart Fill is temporarily unavailable. You can still upload a CV from this device.', 503);
    }
    $target = $settings['api_origin'] . '/v1/documents/' . rawurlencode($timeline_document_id) . '/file-vault/ingestions';
    $timeline_response = wp_remote_request($target, array(
        'method' => 'POST',
        'timeout' => 45,
        'redirection' => 0,
        'reject_unsafe_urls' => true,
        'headers' => array(
            'Authorization' => 'Bearer ' . $issued['token'],
            'Content-Type' => (string) $descriptor['mimeType'],
            'Content-Length' => (string) $byte_size,
            'X-Content-Sha256' => $sha256,
            'X-File-Vault-Id' => $id,
            'X-File-Vault-Version' => $requested_version_id,
            'X-Request-Id' => wp_generate_uuid4(),
            'X-MissionMed-Timeline-Gateway' => 'wordpress',
            'X-MissionMed-Timeline-Gateway-Secret' => $gateway_secret,
        ),
        'body' => $bytes,
    ));
    $status = is_wp_error($timeline_response) ? 0 : (int) wp_remote_retrieve_response_code($timeline_response);
    $payload = $status > 0 ? json_decode((string) wp_remote_retrieve_body($timeline_response), true) : null;
    if ($status < 200 || $status >= 300 || !is_array($payload) || empty($payload['source']['objectId'])) {
        // A rejected transfer must not read as a generic outage: the student needs to know
        // whether the document was too large or the wrong type before they retry it.
        if ($status === 413) {
            return mmtl_filevault_source_error(
                'timeline_filevault_source_size_denied',
                sprintf('Smart Fill reads documents up to %d MB. You can still upload a smaller CV from this device.', MMTL_FILEVAULT_SMART_FILL_MAX_BYTES / 1024 / 1024),
                413
            );
        }
        if ($status === 415) {
            return mmtl_filevault_source_error('timeline_filevault_source_type_denied', 'Choose a PDF or DOCX document for Smart Fill.', 415);
        }
        if ($status === 404) {
            return mmtl_filevault_source_error('timeline_filevault_source_not_found', 'That File Vault document is not available.', 404);
        }
        return mmtl_filevault_source_error('timeline_filevault_ingestion_failed', 'Timeline could not safely import that File Vault document. You can still upload it from this device.', 503);
    }
    return mmtl_filevault_source_response(array(
        'document' => $descriptor,
        'source' => array(
            'objectId' => sanitize_text_field((string) $payload['source']['objectId']),
            'sha256' => $sha256,
            'mimeType' => (string) $descriptor['mimeType'],
            'byteSize' => $byte_size,
        ),
        'contentBase64' => base64_encode($bytes),
    ), 201);
}

function mmtl_register_rest_routes() {
    register_rest_route(MMTL_REST_NAMESPACE, MMTL_REST_TOKEN_ROUTE, array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mmtl_token_endpoint',
        'permission_callback' => 'mmtl_token_permission',
    ));
    register_rest_route(MMTL_REST_NAMESPACE, MMTL_REST_FILEVAULT_SOURCES_ROUTE, array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mmtl_filevault_sources_endpoint',
        'permission_callback' => 'mmtl_filevault_source_permission',
        'args' => array(
            'query' => array('sanitize_callback' => 'sanitize_text_field'),
        ),
    ));
    register_rest_route(MMTL_REST_NAMESPACE, MMTL_REST_FILEVAULT_SOURCES_ROUTE . '/(?P<id>[0-9a-fA-F-]{8,64})', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'mmtl_filevault_source_endpoint',
        'permission_callback' => 'mmtl_filevault_source_permission',
    ));
    register_rest_route(MMTL_REST_NAMESPACE, MMTL_REST_FILEVAULT_SOURCES_ROUTE . '/(?P<id>[0-9a-fA-F-]{8,64})/ingestions', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mmtl_filevault_ingestion_endpoint',
        'permission_callback' => 'mmtl_filevault_source_permission',
    ));
}
add_action('rest_api_init', 'mmtl_register_rest_routes');

function mmtl_ajax_bootstrap() {
    mmtl_private_headers();
    if (!is_user_logged_in()) {
        wp_send_json_error(array(
            'code' => 'session_required',
            'message' => 'Your MissionMed session has ended.',
            'login_url' => mmtl_login_url(home_url(mmtl_settings()['base_path'])),
        ), 401);
    }
    $user = wp_get_current_user();
    $access = mmtl_eligibility_state($user);
    if (is_wp_error($access)) {
        wp_send_json_error(array('code' => $access->get_error_code(), 'message' => $access->get_error_message()), (int) ($access->get_error_data()['status'] ?? 403));
    }
    $principal = mmtl_principal_for_user((int) $user->ID);
    if (is_wp_error($principal)) {
        wp_send_json_error(array('code' => $principal->get_error_code(), 'message' => $principal->get_error_message()), (int) ($principal->get_error_data()['status'] ?? 503));
    }
    $settings = mmtl_settings();
    wp_send_json_success(array(
        'nonce' => wp_create_nonce('wp_rest'),
        'token_endpoint' => rest_url(MMTL_REST_NAMESPACE . MMTL_REST_TOKEN_ROUTE),
        'file_vault_source_endpoint' => rest_url(MMTL_REST_NAMESPACE . MMTL_REST_FILEVAULT_SOURCES_ROUTE),
        'api_base' => home_url($settings['base_path'] . 'api/v1'),
        'matrix_url' => $settings['matrix_url'],
        'base_path' => $settings['base_path'],
        'token_ttl_seconds' => (int) $settings['token_ttl_seconds'],
        'remote_sync_consent' => !empty($access['remote_sync_consent']),
        'remote_sync_allowed' => !empty($access['remote_sync_allowed']),
        'consent_required' => empty($access['administrator']) && empty($access['remote_sync_consent']),
        'consent_version' => (string) $access['consent_version'],
        'consent_nonce' => wp_create_nonce('missionmed_timeline_remote_sync_consent'),
        'consent_action' => home_url($settings['base_path']),
        'consent_endpoint' => admin_url('admin-ajax.php'),
        'user' => array(
            'wp_user_id' => (int) $user->ID,
            'principal_id' => $principal,
            'role' => (string) $access['role'],
            'synthetic_fixture' => get_user_meta((int) $user->ID, MMTL_SYNTHETIC_TEST_META, true) === '1',
        ),
    ));
}
add_action('wp_ajax_missionmed_timeline_bootstrap', 'mmtl_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_timeline_bootstrap', 'mmtl_ajax_bootstrap');

function mmtl_ajax_consent() {
    mmtl_private_headers();
    if (!is_user_logged_in()) {
        wp_send_json_error(array('code' => 'session_required', 'message' => 'Your MissionMed session has ended.'), 401);
    }
    if (!mmtl_verify_origin_header($_SERVER['HTTP_ORIGIN'] ?? '')) {
        wp_send_json_error(array('code' => 'csrf_failed', 'message' => 'A valid MissionMed consent request is required.'), 403);
    }
    $nonce = sanitize_text_field((string) wp_unslash($_POST['_wpnonce'] ?? ''));
    if (!wp_verify_nonce($nonce, 'missionmed_timeline_remote_sync_consent')) {
        wp_send_json_error(array('code' => 'csrf_failed', 'message' => 'A valid MissionMed consent request is required.'), 403);
    }
    $user = wp_get_current_user();
    $eligibility = mmtl_eligibility_state($user);
    if (is_wp_error($eligibility)) {
        wp_send_json_error(array('code' => $eligibility->get_error_code(), 'message' => $eligibility->get_error_message()), (int) ($eligibility->get_error_data()['status'] ?? 403));
    }
    if (!empty($eligibility['administrator'])) {
        wp_send_json_error(array('code' => 'timeline_consent_not_applicable', 'message' => 'Administrator consent is not required.'), 400);
    }
    $action = sanitize_key((string) wp_unslash($_POST['timeline_remote_sync_action'] ?? ''));
    if ($action === 'grant') {
        if ((string) wp_unslash($_POST['timeline_remote_sync_consent'] ?? '') !== 'grant') {
            wp_send_json_error(array('code' => 'timeline_consent_confirmation_required', 'message' => 'Confirm remote save to continue.'), 400);
        }
        $recorded = mmtl_record_remote_sync_consent((int) $user->ID);
        if (is_wp_error($recorded)) {
            wp_send_json_error(array('code' => $recorded->get_error_code(), 'message' => $recorded->get_error_message()), (int) ($recorded->get_error_data()['status'] ?? 503));
        }
        wp_send_json_success(array('remote_sync_consent' => true));
    }
    if ($action === 'withdraw') {
        if (!mmtl_withdraw_remote_sync_consent((int) $user->ID)) {
            wp_send_json_error(array('code' => 'timeline_consent_withdrawal_failed', 'message' => 'Secure saving could not be turned off.'), 503);
        }
        wp_send_json_success(array('remote_sync_consent' => false));
    }
    wp_send_json_error(array('code' => 'timeline_consent_action_invalid', 'message' => 'Choose a valid secure-saving action.'), 400);
}
add_action('wp_ajax_missionmed_timeline_consent', 'mmtl_ajax_consent');

function mmtl_register_rewrites() {
    add_rewrite_rule('^timeline/api/(v1(?:/.*)?)$', 'index.php?missionmed_timeline_api=$matches[1]', 'top');
}
add_action('init', 'mmtl_register_rewrites');

function mmtl_query_vars($vars) {
    $vars[] = 'missionmed_timeline_api';
    return $vars;
}
add_filter('query_vars', 'mmtl_query_vars');

function mmtl_gateway_authorization() {
    $header = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) wp_unslash($_SERVER['HTTP_AUTHORIZATION'])) : '';
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = trim((string) ($headers['Authorization'] ?? $headers['authorization'] ?? ''));
    }
    return preg_match('/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/', $header, $matches)
        ? $matches[1]
        : '';
}

function mmtl_gateway_error($code, $message, $status) {
    mmtl_private_headers();
    status_header(absint($status));
    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode(array('error' => array('code' => sanitize_key($code), 'message' => (string) $message)));
    exit;
}

function mmtl_proxy_api_request() {
    $path = (string) get_query_var('missionmed_timeline_api', '');
    if ($path === '') {
        return;
    }
    if (!is_user_logged_in()) {
        mmtl_gateway_error('session_required', 'Your MissionMed session has ended.', 401);
    }
    if (!mmtl_verify_origin_header($_SERVER['HTTP_ORIGIN'] ?? '')) {
        mmtl_gateway_error('origin_not_allowed', 'This origin may not use the Timeline API.', 403);
    }
    $user = wp_get_current_user();
    $access = mmtl_access_state($user);
    if (is_wp_error($access)) {
        mmtl_gateway_error($access->get_error_code(), $access->get_error_message(), (int) ($access->get_error_data()['status'] ?? 403));
    }
    $principal = mmtl_principal_for_user((int) $user->ID);
    if (is_wp_error($principal)) {
        mmtl_gateway_error($principal->get_error_code(), $principal->get_error_message(), (int) ($principal->get_error_data()['status'] ?? 503));
    }
    $token = mmtl_gateway_authorization();
    if ($token === '' || is_wp_error(mmtl_verify_jwt($token, $principal, (int) $user->ID, $access))) {
        mmtl_gateway_error('timeline_token_invalid', 'Timeline token is invalid.', 401);
    }
    if (!preg_match('#^v1(?:/[A-Za-z0-9._~-]+)*$#', $path)) {
        mmtl_gateway_error('route_invalid', 'Timeline API route is invalid.', 404);
    }
    $settings = mmtl_settings();
    if ($settings['api_origin'] === '' || !wp_http_validate_url($settings['api_origin'])) {
        mmtl_gateway_error('timeline_api_unavailable', 'Timeline API is not configured.', 503);
    }
    $gateway_secret = mmtl_gateway_secret();
    if (strlen($gateway_secret) < 32) {
        mmtl_gateway_error('timeline_gateway_unavailable', 'Timeline gateway is not configured.', 503);
    }
    $method = strtoupper(sanitize_text_field($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, array('GET', 'POST', 'PUT', 'PATCH', 'DELETE'), true)) {
        mmtl_gateway_error('method_not_allowed', 'Timeline API method is not allowed.', 405);
    }
    $content_length = absint($_SERVER['CONTENT_LENGTH'] ?? 0);
    $is_media_upload = $method === 'POST' && $path === 'v1/objects/upload';
    $max_request_bytes = $is_media_upload ? 15 * 1024 * 1024 : 2 * 1024 * 1024;
    if ($content_length > $max_request_bytes) {
        mmtl_gateway_error('request_too_large', 'Timeline request is too large.', 413);
    }
    $target = $settings['api_origin'] . '/' . $path;
    $query = array();
    foreach ($_GET as $key => $value) {
        if ($key === 'missionmed_timeline_api' || is_array($value)) {
            continue;
        }
        $query[sanitize_key($key)] = sanitize_text_field(wp_unslash($value));
    }
    if (!empty($query)) {
        $target = add_query_arg($query, $target);
    }
    $request_id = sanitize_text_field($_SERVER['HTTP_X_REQUEST_ID'] ?? wp_generate_uuid4());
    $is_ai_route = preg_match('#/(?:quality/analyze|intake/(?:analyze|rescue))$#', $path) === 1;
    $content_type = 'application/json';
    if ($is_media_upload) {
        $content_type = strtolower(trim((string) wp_unslash($_SERVER['CONTENT_TYPE'] ?? '')));
        if (!in_array($content_type, array('image/png', 'image/jpeg', 'image/webp', 'image/gif'), true)) {
            mmtl_gateway_error('object_upload_type_denied', 'Choose a PNG, JPG, WEBP, or GIF image.', 415);
        }
    }
    $outbound_headers = array(
        'Authorization' => 'Bearer ' . $token,
        'Content-Type' => $content_type,
        'X-Request-Id' => $request_id,
        'X-MissionMed-Timeline-Gateway' => 'wordpress',
        'X-MissionMed-Timeline-Gateway-Secret' => $gateway_secret,
    );
    if ($is_ai_route && get_user_meta((int) $user->ID, MMTL_SYNTHETIC_TEST_META, true) === '1') {
        $outbound_headers['X-Timeline-Synthetic-Fixture'] = '1';
    }
    if ($is_media_upload) {
        $document_id = sanitize_text_field((string) wp_unslash($_SERVER['HTTP_X_TIMELINE_DOCUMENT_ID'] ?? ''));
        $object_class = strtoupper(sanitize_key((string) wp_unslash($_SERVER['HTTP_X_TIMELINE_OBJECT_CLASS'] ?? '')));
        $content_sha256 = strtolower(sanitize_text_field((string) wp_unslash($_SERVER['HTTP_X_CONTENT_SHA256'] ?? '')));
        if (!preg_match('/^timeline_[A-Za-z0-9._~-]{1,160}$/', $document_id) || $object_class !== 'MEDIA' || !preg_match('/^[a-f0-9]{64}$/', $content_sha256)) {
            mmtl_gateway_error('object_upload_metadata_invalid', 'Timeline media metadata is invalid.', 400);
        }
        $outbound_headers['X-Timeline-Document-Id'] = $document_id;
        $outbound_headers['X-Timeline-Object-Class'] = $object_class;
        $outbound_headers['X-Content-Sha256'] = $content_sha256;
    }
    $args = array(
        'method' => $method,
        'timeout' => ($is_ai_route || $is_media_upload) ? 60 : 20,
        'redirection' => 0,
        'reject_unsafe_urls' => true,
        'headers' => $outbound_headers,
    );
    if (!in_array($method, array('GET', 'DELETE'), true)) {
        $args['body'] = file_get_contents('php://input');
    }
    $response = wp_remote_request($target, $args);
    if (is_wp_error($response)) {
        mmtl_gateway_error('timeline_api_unavailable', 'Timeline API is temporarily unavailable.', 503);
    }
    mmtl_private_headers();
    status_header((int) wp_remote_retrieve_response_code($response));
    foreach (array('content-type', 'etag', 'retry-after', 'x-request-id') as $name) {
        $value = wp_remote_retrieve_header($response, $name);
        if ($value !== '') {
            header($name . ': ' . sanitize_text_field((string) $value), true);
        }
    }
    echo wp_remote_retrieve_body($response);
    exit;
}
add_action('template_redirect', 'mmtl_proxy_api_request', 0);

function mmtl_user_can_enter() {
    return is_user_logged_in() && !is_wp_error(mmtl_eligibility_state(wp_get_current_user()));
}

function mmtl_is_matrix_request() {
    $matrix_path = (string) wp_parse_url(mmtl_settings()['matrix_url'], PHP_URL_PATH);
    $request_path = (string) wp_parse_url(esc_url_raw(wp_unslash($_SERVER['REQUEST_URI'] ?? '')), PHP_URL_PATH);
    return $matrix_path !== '' && untrailingslashit($request_path) === untrailingslashit($matrix_path);
}

function mmtl_enqueue_matrix_launch_adapter() {
    if (!mmtl_is_matrix_request() || !mmtl_user_can_enter()) {
        return;
    }
    $handle = 'missionmed-timeline-matrix-launch';
    wp_enqueue_script($handle, plugins_url('assets/matrix-launch.js', __FILE__), array(), MMTL_VERSION, false);
    wp_add_inline_script($handle, 'window.MissionMedTimelineLaunch=' . wp_json_encode(array(
        'target' => home_url(mmtl_settings()['base_path']),
        'matrixPath' => (string) wp_parse_url(mmtl_settings()['matrix_url'], PHP_URL_PATH),
    )) . ';', 'before');
}
add_action('wp_enqueue_scripts', 'mmtl_enqueue_matrix_launch_adapter', 30);

function mmtl_render_matrix_launch_adapter_fallback() {
    $handle = 'missionmed-timeline-matrix-launch';
    if (!mmtl_is_matrix_request() || !mmtl_user_can_enter() || wp_script_is($handle, 'done')) {
        return;
    }
    $config = wp_json_encode(array(
        'target' => home_url(mmtl_settings()['base_path']),
        'matrixPath' => (string) wp_parse_url(mmtl_settings()['matrix_url'], PHP_URL_PATH),
    ));
    $source = plugins_url('assets/matrix-launch.js', __FILE__);
    echo '<script>window.MissionMedTimelineLaunch=' . $config . ';</script>';
    echo '<script src="' . esc_url($source) . '?ver=' . esc_attr(MMTL_VERSION) . '"></script>';
}
add_action('wp_footer', 'mmtl_render_matrix_launch_adapter_fallback', 1);

function mmtl_navigation_item($items) {
    if (!mmtl_user_can_enter()) {
        return $items;
    }
    $items[] = array(
        'id' => 'timeline',
        'label' => 'Timeline',
        'url' => home_url(mmtl_settings()['base_path']),
        'icon' => 'timeline',
    );
    return $items;
}
add_filter('missionmed_matrix_product_navigation', 'mmtl_navigation_item');
