<?php
/**
 * Plugin Name: MissionMed StoryForge SSO
 * Description: Default-off WordPress session bridge, entitlement gate, and Matrix navigation seam for StoryForge V5.
 * Version: 0.1.1
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMSF_OPTION = 'missionmed_storyforge_settings';
const MMSF_RATE_KEYS_OPTION = 'missionmed_storyforge_rate_keys';
const MMSF_REST_NAMESPACE = 'missionmed/v1';
const MMSF_REST_ROUTE = '/storyforge/token';
const MMSF_VERSION = '0.1.1';

function mmsf_defaults() {
    return array(
        'storyforge_enabled' => false,
        'allowed_user_ids' => array(),
        'app_role_overrides' => array(),
        'allowed_roles' => array('student', 'mentor', 'admin'),
        'allowed_cohorts' => array(),
        'base_path' => '/storyforge/',
        'matrix_url' => home_url('/member-dashboard/'),
        'issuer' => home_url('/wp-json/' . MMSF_REST_NAMESPACE . '/storyforge'),
        'audience' => 'storyforge',
        'token_ttl_seconds' => 120,
        'rate_limit_requests' => 20,
        'rate_limit_window_seconds' => 60,
        'matrix_menu_locations' => array('member-dashboard'),
    );
}

function mmsf_settings() {
    $stored = get_option(MMSF_OPTION, array());
    if (!is_array($stored)) {
        $stored = array();
    }
    $settings = wp_parse_args($stored, mmsf_defaults());
    $settings['allowed_roles'] = array_values(array_intersect(
        array('student', 'mentor', 'admin'),
        array_map('sanitize_key', (array) $settings['allowed_roles'])
    ));
    $settings['allowed_user_ids'] = array_values(array_unique(array_filter(array_map(
        'absint',
        (array) $settings['allowed_user_ids']
    ))));
    $role_overrides = array();
    foreach ((array) $settings['app_role_overrides'] as $user_id => $role) {
        $user_id = absint($user_id);
        $role = sanitize_key((string) $role);
        if ($user_id > 0 && in_array($role, array('student', 'mentor', 'admin'), true)) {
            $role_overrides[$user_id] = $role;
        }
    }
    $settings['app_role_overrides'] = $role_overrides;
    $settings['allowed_cohorts'] = array_values(array_filter(array_map(
        'sanitize_text_field',
        (array) $settings['allowed_cohorts']
    )));
    $settings['matrix_menu_locations'] = array_values(array_filter(array_map(
        'sanitize_key',
        (array) $settings['matrix_menu_locations']
    )));
    $settings['base_path'] = '/' . trim((string) $settings['base_path'], '/') . '/';
    $settings['token_ttl_seconds'] = max(60, min(300, absint($settings['token_ttl_seconds'])));
    if (
        wp_get_environment_type() === 'local'
        && defined('MISSIONMED_STORYFORGE_LOCAL_FIXTURES')
        && MISSIONMED_STORYFORGE_LOCAL_FIXTURES
    ) {
        $settings['token_ttl_seconds'] = max(5, min(300, absint($settings['token_ttl_seconds'])));
    }
    $settings['rate_limit_requests'] = max(1, min(120, absint($settings['rate_limit_requests'])));
    $settings['rate_limit_window_seconds'] = max(10, min(300, absint($settings['rate_limit_window_seconds'])));
    return apply_filters('missionmed_storyforge_settings', $settings);
}

function mmsf_activate() {
    $stored = get_option(MMSF_OPTION, array());
    $settings = is_array($stored) ? wp_parse_args($stored, mmsf_defaults()) : mmsf_defaults();
    $settings['storyforge_enabled'] = false;
    update_option(MMSF_OPTION, $settings, false);
}
register_activation_hook(__FILE__, 'mmsf_activate');

function mmsf_deactivate() {
    $settings = mmsf_settings();
    $settings['storyforge_enabled'] = false;
    update_option(MMSF_OPTION, $settings, false);

    $keys = get_option(MMSF_RATE_KEYS_OPTION, array());
    foreach ((array) $keys as $key) {
        delete_transient((string) $key);
    }
    delete_option(MMSF_RATE_KEYS_OPTION);
}
register_deactivation_hook(__FILE__, 'mmsf_deactivate');

function mmsf_bool($value) {
    if (is_bool($value)) {
        return $value;
    }
    return in_array(strtolower(trim((string) $value)), array('1', 'true', 'yes', 'on'), true);
}

function mmsf_native_role_for_user($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return '';
    }
    if (user_can($user, 'manage_options')) {
        return 'admin';
    }
    $roles = array_map('sanitize_key', (array) $user->roles);
    if (!empty(array_intersect($roles, array('mentor', 'advisor', 'coach')))) {
        return 'mentor';
    }
    return 'student';
}

function mmsf_user_is_allowlisted($user, $settings = null) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return false;
    }
    $settings = is_array($settings) ? $settings : mmsf_settings();
    return in_array((int) $user->ID, array_map('absint', (array) ($settings['allowed_user_ids'] ?? array())), true);
}

function mmsf_role_for_user($user, $settings = null) {
    $native_role = mmsf_native_role_for_user($user);
    if ($native_role === '') {
        return '';
    }
    $settings = is_array($settings) ? $settings : mmsf_settings();
    if (!mmsf_user_is_allowlisted($user, $settings)) {
        return $native_role;
    }
    $override = sanitize_key((string) ($settings['app_role_overrides'][(int) $user->ID] ?? ''));
    return in_array($override, array('student', 'mentor', 'admin'), true)
        ? $override
        : $native_role;
}

function mmsf_cohort_for_user($user_id) {
    $cohort = get_user_meta($user_id, '_missionmed_storyforge_cohort', true);
    if ($cohort === '') {
        $cohort = get_user_meta($user_id, '_mmed_cohort', true);
    }
    return sanitize_text_field((string) apply_filters(
        'missionmed_storyforge_user_cohort',
        $cohort,
        $user_id
    ));
}

function mmsf_assignment_student_ids($mentor_id) {
    $raw = get_user_meta($mentor_id, '_missionmed_storyforge_student_ids', true);
    $ids = is_array($raw) ? $raw : array_filter(array_map('trim', explode(',', (string) $raw)));
    $ids = array_values(array_filter(array_map('sanitize_text_field', $ids)));
    return apply_filters('missionmed_storyforge_mentor_student_ids', $ids, $mentor_id);
}

function mmsf_entitlement_for_user($user) {
    $role = mmsf_role_for_user($user);
    $native_role = mmsf_native_role_for_user($user);
    $entitlement = null;

    if ($native_role === 'admin') {
        $entitlement = array(
            'trusted' => true,
            'verified' => true,
            'active' => true,
            'status' => 'active',
            'source' => $role === 'admin'
                ? 'wordpress_admin_capability'
                : 'wordpress_exact_user_pilot_override',
        );
    } elseif ($role === 'mentor') {
        $assigned = mmsf_assignment_student_ids((int) $user->ID);
        $entitlement = array(
            'trusted' => true,
            'verified' => true,
            'active' => !empty($assigned),
            'status' => !empty($assigned) ? 'active' : 'unassigned',
            'source' => 'wordpress_mentor_assignments',
        );
    } elseif (function_exists('mmhq_cam_build_entitlement')) {
        $entitlement = mmhq_cam_build_entitlement((int) $user->ID);
    }

    if (
        $entitlement === null
        && wp_get_environment_type() === 'local'
        && defined('MISSIONMED_STORYFORGE_LOCAL_FIXTURES')
        && MISSIONMED_STORYFORGE_LOCAL_FIXTURES
    ) {
        $active = mmsf_bool(get_user_meta($user->ID, '_missionmed_storyforge_local_eligible', true));
        $entitlement = array(
            'trusted' => true,
            'verified' => true,
            'active' => $active,
            'status' => $active ? 'active' : 'revoked',
            'source' => 'local_fixture_only',
        );
    }

    $entitlement = apply_filters(
        'missionmed_storyforge_entitlement',
        $entitlement,
        $user,
        $role
    );
    if (!is_array($entitlement)) {
        return array(
            'trusted' => false,
            'verified' => false,
            'active' => false,
            'status' => 'source_unavailable',
            'source' => 'none',
        );
    }
    return wp_parse_args($entitlement, array(
        'trusted' => false,
        'verified' => false,
        'active' => false,
        'status' => 'not_eligible',
        'source' => 'unknown',
    ));
}

function mmsf_access_state($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }

    $settings = mmsf_settings();
    if (empty($settings['storyforge_enabled'])) {
        return new WP_Error('storyforge_disabled', 'StoryForge is not enabled for this pilot.', array('status' => 403));
    }

    $role = mmsf_role_for_user($user, $settings);
    $allowlisted = mmsf_user_is_allowlisted($user, $settings);
    if (!$allowlisted && $role !== 'student') {
        return new WP_Error(
            'user_not_enabled',
            'StoryForge is not enabled for this account.',
            array('status' => 403)
        );
    }

    if (!in_array($role, $settings['allowed_roles'], true)) {
        return new WP_Error('role_not_enabled', 'StoryForge is not enabled for this account role.', array('status' => 403));
    }

    $cohort = mmsf_cohort_for_user((int) $user->ID);
    if (
        $role === 'student'
        && $allowlisted
        && !empty($settings['allowed_cohorts'])
        && !in_array($cohort, $settings['allowed_cohorts'], true)
    ) {
        return new WP_Error('cohort_not_enabled', 'StoryForge is not enabled for this cohort.', array('status' => 403));
    }

    $entitlement = mmsf_entitlement_for_user($user);
    if (
        empty($entitlement['trusted'])
        || empty($entitlement['verified'])
        || empty($entitlement['active'])
    ) {
        $status = sanitize_key((string) $entitlement['status']);
        $code = in_array($status, array('revoked', 'restricted', 'expired', 'refunded', 'cancelled'), true)
            ? 'eligibility_revoked'
            : 'eligibility_required';
        return new WP_Error(
            $code,
            'Your MissionMed 360 access is not currently active.',
            array('status' => 403, 'entitlement_status' => $status)
        );
    }

    return array(
        'role' => $role,
        'cohort' => $cohort,
        'entitlement' => $entitlement,
    );
}

function mmsf_storyforge_user_id($user_id) {
    $id = strtolower(trim((string) get_user_meta($user_id, '_missionmed_storyforge_user_id', true)));
    $id = (string) apply_filters('missionmed_storyforge_user_id', $id, $user_id);
    return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $id)
        ? $id
        : '';
}

function mmsf_secret() {
    $secret = trim((string) getenv('STORYFORGE_JWT_SECRET'));
    if ($secret === '' && defined('STORYFORGE_JWT_SECRET')) {
        $secret = trim((string) STORYFORGE_JWT_SECRET);
    }
    return (string) apply_filters('missionmed_storyforge_jwt_secret', $secret);
}

function mmsf_base64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function mmsf_issue_jwt($user, $access) {
    $settings = mmsf_settings();
    $secret = mmsf_secret();
    if (strlen($secret) < 32) {
        return new WP_Error(
            'storyforge_signer_unavailable',
            'StoryForge token signing is not configured.',
            array('status' => 503)
        );
    }
    $subject = mmsf_storyforge_user_id((int) $user->ID);
    if ($subject === '') {
        return new WP_Error(
            'storyforge_identity_unmapped',
            'This MissionMed account is not mapped to StoryForge.',
            array('status' => 503)
        );
    }

    $now = time();
    $expires = $now + (int) $settings['token_ttl_seconds'];
    $header = array('alg' => 'HS256', 'typ' => 'JWT');
    $payload = array(
        'iss' => esc_url_raw((string) $settings['issuer']),
        'aud' => sanitize_text_field((string) $settings['audience']),
        'sub' => $subject,
        'iat' => $now,
        'nbf' => $now - 2,
        'exp' => $expires,
        'jti' => wp_generate_uuid4(),
        'wp_user_id' => (int) $user->ID,
        'name' => (string) $user->display_name,
        'first_name' => (string) $user->first_name,
        'username' => (string) $user->user_login,
        'app_role' => (string) $access['role'],
        'wordpress_admin' => user_can($user, 'manage_options'),
        'storyforge_eligible' => true,
    );
    if ($access['cohort'] !== '') {
        $payload['cohort'] = (string) $access['cohort'];
    }
    $encoded_header = mmsf_base64url(wp_json_encode($header));
    $encoded_payload = mmsf_base64url(wp_json_encode($payload));
    $signed = $encoded_header . '.' . $encoded_payload;
    $signature = hash_hmac('sha256', $signed, $secret, true);
    return array(
        'token' => $signed . '.' . mmsf_base64url($signature),
        'expires_at' => $expires,
        'ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mmsf_request_ip() {
    return isset($_SERVER['REMOTE_ADDR'])
        ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
        : '';
}

function mmsf_rate_limit($user_id) {
    $settings = mmsf_settings();
    $window = (int) $settings['rate_limit_window_seconds'];
    $limit = (int) $settings['rate_limit_requests'];
    $key = 'mmsf_rl_' . substr(hash('sha256', $user_id . '|' . mmsf_request_ip()), 0, 32);
    $now = time();
    $state = get_transient($key);
    if (!is_array($state) || empty($state['reset']) || (int) $state['reset'] <= $now) {
        $state = array('count' => 0, 'reset' => $now + $window);
    }
    $state['count'] = (int) $state['count'] + 1;
    set_transient($key, $state, max(1, (int) $state['reset'] - $now));

    $keys = array_values(array_unique(array_merge((array) get_option(MMSF_RATE_KEYS_OPTION, array()), array($key))));
    update_option(MMSF_RATE_KEYS_OPTION, array_slice($keys, -500), false);

    if ($state['count'] > $limit) {
        return new WP_Error(
            'storyforge_rate_limited',
            'StoryForge token refresh is temporarily rate limited.',
            array('status' => 429, 'retry_after' => max(1, (int) $state['reset'] - $now))
        );
    }
    return true;
}

function mmsf_allowed_origin() {
    return strtolower((string) wp_parse_url(home_url('/'), PHP_URL_SCHEME))
        . '://'
        . strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST))
        . (($port = wp_parse_url(home_url('/'), PHP_URL_PORT)) ? ':' . absint($port) : '');
}

function mmsf_verify_origin($request) {
    $origin = trim((string) $request->get_header('origin'));
    if ($origin === '') {
        return true;
    }
    $normalized = strtolower(rtrim($origin, '/'));
    if (!hash_equals(mmsf_allowed_origin(), $normalized)) {
        return new WP_Error('origin_not_allowed', 'This origin may not request a StoryForge token.', array('status' => 403));
    }
    return true;
}

function mmsf_no_store($response) {
    if ($response instanceof WP_REST_Response) {
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Pragma', 'no-cache');
    }
    return $response;
}

function mmsf_send_private_no_store_headers() {
    nocache_headers();
    if (!headers_sent()) {
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
    }
}

function mmsf_is_token_rest_request($request = null) {
    $expected_route = '/' . MMSF_REST_NAMESPACE . MMSF_REST_ROUTE;
    if (
        $request instanceof WP_REST_Request
        && untrailingslashit($request->get_route()) === untrailingslashit($expected_route)
    ) {
        return true;
    }
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $request_path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    $route_suffix = '/' . ltrim(MMSF_REST_NAMESPACE . MMSF_REST_ROUTE, '/');
    if (
        $request_path !== ''
        && str_ends_with(untrailingslashit($request_path), untrailingslashit($route_suffix))
    ) {
        return true;
    }
    $expected_path = (string) wp_parse_url(
        rest_url(MMSF_REST_NAMESPACE . MMSF_REST_ROUTE),
        PHP_URL_PATH
    );
    return $request_path !== ''
        && untrailingslashit($request_path) === untrailingslashit($expected_path);
}

function mmsf_rest_private_no_store($response, $server, $request) {
    unset($server);
    if (mmsf_is_token_rest_request($request) && $response instanceof WP_REST_Response) {
        $GLOBALS['mmsf_private_rest_response'] = true;
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Pragma', 'no-cache');
    }
    return $response;
}
add_filter('rest_post_dispatch', 'mmsf_rest_private_no_store', 10, 3);

function mmsf_rest_preserve_private_cache_headers($send_nocache_headers) {
    if (!empty($GLOBALS['mmsf_private_rest_response']) || mmsf_is_token_rest_request()) {
        if (!headers_sent()) {
            header('Cache-Control: no-store, private', true);
            header('Pragma: no-cache', true);
        }
        return false;
    }
    return $send_nocache_headers;
}
add_filter('rest_send_nocache_headers', 'mmsf_rest_preserve_private_cache_headers');

function mmsf_token_endpoint($request) {
    $origin = mmsf_verify_origin($request);
    if (is_wp_error($origin)) {
        return $origin;
    }

    $nonce = trim((string) $request->get_header('x-wp-nonce'));
    if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('csrf_failed', 'A valid WordPress REST nonce is required.', array('status' => 403));
    }

    $user = wp_get_current_user();
    $access = mmsf_access_state($user);
    if (is_wp_error($access)) {
        return $access;
    }

    $rate = mmsf_rate_limit((int) $user->ID);
    if (is_wp_error($rate)) {
        return $rate;
    }

    $issued = mmsf_issue_jwt($user, $access);
    if (is_wp_error($issued)) {
        return $issued;
    }
    $issued['nonce'] = wp_create_nonce('wp_rest');
    return mmsf_no_store(new WP_REST_Response($issued, 200));
}

function mmsf_register_rest_routes() {
    register_rest_route(MMSF_REST_NAMESPACE, MMSF_REST_ROUTE, array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mmsf_token_endpoint',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'mmsf_register_rest_routes');

function mmsf_safe_return_url($raw) {
    $settings = mmsf_settings();
    $candidate = esc_url_raw((string) $raw);
    $origin = mmsf_allowed_origin();
    if ($candidate === '' || !str_starts_with(strtolower($candidate), $origin . strtolower($settings['base_path']))) {
        return home_url($settings['base_path']);
    }
    return $candidate;
}

function mmsf_bootstrap_payload($return_to) {
    $settings = mmsf_settings();
    return array(
        'nonce' => wp_create_nonce('wp_rest'),
        'token_endpoint' => rest_url(MMSF_REST_NAMESPACE . MMSF_REST_ROUTE),
        'matrix_url' => esc_url_raw((string) $settings['matrix_url']),
        'base_path' => (string) $settings['base_path'],
        'return_to' => mmsf_safe_return_url($return_to),
        'token_ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mmsf_ajax_bootstrap() {
    mmsf_send_private_no_store_headers();
    $return_to = isset($_GET['return_to']) ? wp_unslash($_GET['return_to']) : '';
    if (!is_user_logged_in()) {
        $safe_return = mmsf_safe_return_url($return_to);
        wp_send_json_error(array(
            'code' => 'session_required',
            'state' => 'session_ended',
            'message' => 'Your MissionMed session has ended.',
            'login_url' => wp_login_url($safe_return),
        ), 401);
    }

    $user = wp_get_current_user();
    $access = mmsf_access_state($user);
    if (is_wp_error($access)) {
        wp_send_json_error(array(
            'code' => $access->get_error_code(),
            'state' => $access->get_error_code() === 'eligibility_revoked' ? 'eligibility_revoked' : 'access_unavailable',
            'message' => $access->get_error_message(),
        ), (int) ($access->get_error_data()['status'] ?? 403));
    }

    wp_send_json_success(array_merge(mmsf_bootstrap_payload($return_to), array(
        'user' => array(
            'wp_user_id' => (int) $user->ID,
            'display_name' => (string) $user->display_name,
            'role' => (string) $access['role'],
            'cohort' => (string) $access['cohort'],
        ),
    )));
}
add_action('wp_ajax_missionmed_storyforge_bootstrap', 'mmsf_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_storyforge_bootstrap', 'mmsf_ajax_bootstrap');

function mmsf_user_can_enter() {
    if (!is_user_logged_in()) {
        return false;
    }
    return !is_wp_error(mmsf_access_state(wp_get_current_user()));
}

function mmsf_is_matrix_request() {
    $matrix_path = (string) wp_parse_url(mmsf_settings()['matrix_url'], PHP_URL_PATH);
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $request_path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    return $matrix_path !== ''
        && untrailingslashit($request_path) === untrailingslashit($matrix_path);
}

function mmsf_enqueue_matrix_launch_adapter() {
    if (!mmsf_is_matrix_request() || !mmsf_user_can_enter()) {
        return;
    }
    $handle = 'missionmed-storyforge-matrix-launch';
    wp_enqueue_script(
        $handle,
        plugins_url('assets/matrix-launch.js', __FILE__),
        array(),
        MMSF_VERSION,
        false
    );
    wp_add_inline_script(
        $handle,
        'window.MissionMedStoryForgeLaunch=' . wp_json_encode(array(
            'target' => home_url(mmsf_settings()['base_path']),
            'matrixPath' => (string) wp_parse_url(mmsf_settings()['matrix_url'], PHP_URL_PATH),
        )) . ';',
        'before'
    );
}
add_action('wp_enqueue_scripts', 'mmsf_enqueue_matrix_launch_adapter', 30);

function mmsf_navigation_item($items) {
    if (!mmsf_user_can_enter()) {
        return $items;
    }
    $item = array(
        'id' => 'storyforge',
        'label' => 'StoryForge',
        'url' => home_url(mmsf_settings()['base_path']),
        'icon' => 'book-alt',
    );
    if (!is_array($items)) {
        $items = array();
    }
    $items[] = $item;
    return $items;
}
add_filter('missionmed_matrix_navigation_items', 'mmsf_navigation_item');

function mmsf_dashboard_tile_item($tiles) {
    if (!mmsf_user_can_enter()) {
        return $tiles;
    }
    if (!is_array($tiles)) {
        $tiles = array();
    }
    $tiles[] = array(
        'id' => 'storyforge',
        'label' => 'StoryForge',
        'subtitle' => 'Your story library',
        'url' => home_url(mmsf_settings()['base_path']),
    );
    return $tiles;
}
add_filter('missionmed_matrix_dashboard_tiles', 'mmsf_dashboard_tile_item');

function mmsf_menu_items($items, $args) {
    if (!mmsf_user_can_enter()) {
        return $items;
    }
    $location = isset($args->theme_location) ? sanitize_key((string) $args->theme_location) : '';
    if (!in_array($location, mmsf_settings()['matrix_menu_locations'], true)) {
        return $items;
    }
    return $items . sprintf(
        '<li class="menu-item menu-item-storyforge"><a href="%s">%s</a></li>',
        esc_url(home_url(mmsf_settings()['base_path'])),
        esc_html__('StoryForge', 'missionmed-storyforge-sso')
    );
}
add_filter('wp_nav_menu_items', 'mmsf_menu_items', 10, 2);

function mmsf_navigation_shortcode() {
    if (!mmsf_user_can_enter()) {
        return '';
    }
    return sprintf(
        '<a class="missionmed-storyforge-nav" href="%s">%s</a>',
        esc_url(home_url(mmsf_settings()['base_path'])),
        esc_html__('StoryForge', 'missionmed-storyforge-sso')
    );
}
add_shortcode('missionmed_storyforge_navigation', 'mmsf_navigation_shortcode');

function mmsf_tile_shortcode() {
    if (!mmsf_user_can_enter()) {
        return '';
    }
    return sprintf(
        '<a class="missionmed-storyforge-tile" href="%s"><strong>%s</strong><span>%s</span></a>',
        esc_url(home_url(mmsf_settings()['base_path'])),
        esc_html__('StoryForge', 'missionmed-storyforge-sso'),
        esc_html__('Your story library', 'missionmed-storyforge-sso')
    );
}
add_shortcode('missionmed_storyforge_dashboard_tile', 'mmsf_tile_shortcode');

function mmsf_assignment_rows() {
    $rows = array();
    $mentors = get_users(array('role__in' => array('mentor', 'advisor', 'coach')));
    foreach ($mentors as $mentor) {
        $mentor_sf_id = mmsf_storyforge_user_id((int) $mentor->ID);
        foreach (mmsf_assignment_student_ids((int) $mentor->ID) as $student_sf_id) {
            $rows[] = array(
                'mentor_id' => $mentor_sf_id,
                'student_id' => strtolower((string) $student_sf_id),
                'active' => true,
                'source' => 'wordpress_mentor_assignments',
            );
        }
    }
    return apply_filters('missionmed_storyforge_assignment_rows', $rows);
}
