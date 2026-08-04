<?php
/**
 * Plugin Name: MissionMed Timeline SSO
 * Description: Default-off Timeline identity, LearnDash eligibility, JWT, same-origin API gateway, and Matrix launch seam.
 * Version: 500.0.1
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
const MMTL_CONSENT_META = '_missionmed_timeline_remote_sync_consent';
const MMTL_CONSENT_AT_META = '_missionmed_timeline_remote_sync_consented_at';
const MMTL_REST_NAMESPACE = 'missionmed-timeline/v1';
const MMTL_REST_TOKEN_ROUTE = '/token';
const MMTL_COURSE_ID = 3893;
const MMTL_VERSION = '500.0.1';

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
    return new WP_Error('timeline_identity_unmapped', 'Timeline identity is not provisioned.', array('status' => 503));
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
    $access = mmtl_access_state(wp_get_current_user());
    return is_wp_error($access) ? $access : true;
}

function mmtl_token_endpoint($request) {
    $user = wp_get_current_user();
    $access = mmtl_access_state($user);
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

function mmtl_register_rest_routes() {
    register_rest_route(MMTL_REST_NAMESPACE, MMTL_REST_TOKEN_ROUTE, array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mmtl_token_endpoint',
        'permission_callback' => 'mmtl_token_permission',
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
    $access = mmtl_access_state($user);
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
        'api_base' => home_url($settings['base_path'] . 'api/v1'),
        'matrix_url' => $settings['matrix_url'],
        'base_path' => $settings['base_path'],
        'token_ttl_seconds' => (int) $settings['token_ttl_seconds'],
        'remote_sync_consent' => !empty($access['remote_sync_consent']),
        'remote_sync_allowed' => !empty($access['remote_sync_allowed']),
        'consent_version' => (string) $access['consent_version'],
        'user' => array(
            'wp_user_id' => (int) $user->ID,
            'principal_id' => $principal,
            'role' => (string) $access['role'],
        ),
    ));
}
add_action('wp_ajax_missionmed_timeline_bootstrap', 'mmtl_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_timeline_bootstrap', 'mmtl_ajax_bootstrap');

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
    if ($content_length > 2 * 1024 * 1024) {
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
    $args = array(
        'method' => $method,
        'timeout' => 20,
        'redirection' => 0,
        'reject_unsafe_urls' => true,
        'headers' => array(
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
            'X-Request-Id' => $request_id,
            'X-MissionMed-Timeline-Gateway' => 'wordpress',
            'X-MissionMed-Timeline-Gateway-Secret' => $gateway_secret,
        ),
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
    return is_user_logged_in() && !is_wp_error(mmtl_access_state(wp_get_current_user()));
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
