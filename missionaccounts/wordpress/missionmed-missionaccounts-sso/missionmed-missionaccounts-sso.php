<?php
/**
 * Plugin Name: MissionMed MissionAccounts SSO
 * Description: Default-off WordPress session bridge and registered-user Matrix navigation seam for MyMissionMed Account.
 * Version: 0.2.0
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMA_OPTION = 'missionmed_missionaccounts_settings';
const MMA_RATE_KEYS_OPTION = 'missionmed_missionaccounts_rate_keys';
const MMA_REST_NAMESPACE = 'missionmed/v1';
const MMA_REST_ROUTE = '/missionaccounts/token';
const MMA_VERSION = '0.2.0';

function mma_defaults() {
    return array(
        'missionaccounts_enabled' => false,
        'allowed_user_ids' => array(),
        'app_role_overrides' => array(),
        'base_path' => '/missionaccounts/',
        'matrix_url' => home_url('/member-dashboard/'),
        'issuer' => home_url('/wp-json/' . MMA_REST_NAMESPACE . '/missionaccounts'),
        'audience' => 'missionaccounts',
        'token_ttl_seconds' => 120,
        'rate_limit_requests' => 20,
        'rate_limit_window_seconds' => 60,
        'matrix_menu_locations' => array('member-dashboard'),
    );
}

function mma_settings() {
    $stored = get_option(MMA_OPTION, array());
    $stored = is_array($stored) ? $stored : array();
    $settings = wp_parse_args($stored, mma_defaults());
    $settings['allowed_user_ids'] = array_values(array_unique(array_filter(array_map(
        'absint',
        (array) $settings['allowed_user_ids']
    ))));
    $overrides = array();
    foreach ((array) $settings['app_role_overrides'] as $user_id => $role) {
        $user_id = absint($user_id);
        $role = sanitize_key((string) $role);
        if ($user_id > 0 && in_array($role, array('student', 'missionaccounts_admin', 'founder'), true)) {
            $overrides[$user_id] = $role;
        }
    }
    $settings['app_role_overrides'] = $overrides;
    $settings['base_path'] = '/' . trim((string) $settings['base_path'], '/') . '/';
    $settings['token_ttl_seconds'] = max(60, min(300, absint($settings['token_ttl_seconds'])));
    $settings['rate_limit_requests'] = max(1, min(120, absint($settings['rate_limit_requests'])));
    $settings['rate_limit_window_seconds'] = max(10, min(300, absint($settings['rate_limit_window_seconds'])));
    $settings['matrix_menu_locations'] = array_values(array_filter(array_map(
        'sanitize_key',
        (array) $settings['matrix_menu_locations']
    )));
    return apply_filters('missionmed_missionaccounts_settings', $settings);
}

function mma_activate() {
    $settings = wp_parse_args((array) get_option(MMA_OPTION, array()), mma_defaults());
    $settings['missionaccounts_enabled'] = false;
    update_option(MMA_OPTION, $settings, false);
}
register_activation_hook(__FILE__, 'mma_activate');

function mma_deactivate() {
    $settings = mma_settings();
    $settings['missionaccounts_enabled'] = false;
    update_option(MMA_OPTION, $settings, false);
    foreach ((array) get_option(MMA_RATE_KEYS_OPTION, array()) as $key) {
        delete_transient((string) $key);
    }
    delete_option(MMA_RATE_KEYS_OPTION);
}
register_deactivation_hook(__FILE__, 'mma_deactivate');

function mma_user_is_allowlisted($user, $settings = null) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return false;
    }
    $settings = is_array($settings) ? $settings : mma_settings();
    return in_array((int) $user->ID, $settings['allowed_user_ids'], true);
}

function mma_course_option_id($key) {
    $fallback = function_exists('mmed_hub_default_option_value')
        ? mmed_hub_default_option_value($key)
        : 0;
    return absint(get_option($key, $fallback));
}

function mma_program_course_ids() {
    return array(
        'mission_residency' => array_values(array_filter(array(
            mma_course_option_id('mmed_course_360elite'),
            mma_course_option_id('mmed_course_complete'),
            mma_course_option_id('mmed_course_foundation'),
        ))),
        'examprep' => array_values(array_filter(array(
            mma_course_option_id('mmed_course_usmle'),
        ))),
        'clinicals' => array_values(array_filter(array(
            mma_course_option_id('mmed_course_usce'),
        ))),
    );
}

function mma_user_course_ids($user_id) {
    $user_id = absint($user_id);
    if (!$user_id) {
        return array();
    }
    if (class_exists('MMED_Access_Gate') && is_callable(array('MMED_Access_Gate', 'get_user_course_ids'))) {
        return array_values(array_unique(array_filter(array_map(
            'absint',
            (array) MMED_Access_Gate::get_user_course_ids($user_id)
        ))));
    }
    $course_ids = array();
    if (function_exists('learndash_user_get_enrolled_courses')) {
        $course_ids = (array) learndash_user_get_enrolled_courses($user_id);
    }
    if (function_exists('sfwd_lms_has_access')) {
        foreach (mma_program_course_ids() as $program_ids) {
            foreach ($program_ids as $course_id) {
                if (sfwd_lms_has_access($course_id, $user_id)) {
                    $course_ids[] = $course_id;
                }
            }
        }
    }
    return array_values(array_unique(array_filter(array_map('absint', $course_ids))));
}

function mma_program_access($user, $settings = null) {
    $registered = $user instanceof WP_User && $user->exists();
    $settings = is_array($settings) ? $settings : mma_settings();
    $course_ids = $registered ? mma_user_course_ids((int) $user->ID) : array();
    $program_ids = mma_program_course_ids();
    $enrolled = function ($key) use ($course_ids, $program_ids) {
        return !empty(array_intersect($course_ids, $program_ids[$key] ?? array()));
    };
    // The existing exact-user MissionAccounts grant is the current ExamPrep
    // authority while the canonical ExamPrep LearnDash option remains unset.
    $exact_examprep_grant = $registered
        && mma_user_is_allowlisted($user, $settings)
        && mma_product_user_id((int) $user->ID) !== '';
    $access = array(
        'registered' => $registered,
        'programs' => array(
            'mission_residency' => array('enrolled' => $enrolled('mission_residency')),
            'examprep' => array('enrolled' => $enrolled('examprep') || $exact_examprep_grant),
            'clinicals' => array('enrolled' => $enrolled('clinicals')),
        ),
    );
    $filtered = apply_filters('missionmed_missionaccounts_program_access', $access, $user);
    if (!is_array($filtered)) {
        return $access;
    }
    foreach (array('mission_residency', 'examprep', 'clinicals') as $program) {
        $access['programs'][$program]['enrolled'] = !empty($filtered['programs'][$program]['enrolled']);
    }
    return $access;
}

function mma_role_for_user($user, $settings = null) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return '';
    }
    $settings = is_array($settings) ? $settings : mma_settings();
    $native = 'registered';
    $override = sanitize_key((string) ($settings['app_role_overrides'][(int) $user->ID] ?? ''));
    if ($override === 'founder' && !user_can($user, 'manage_options')) {
        return $native;
    }
    if (mma_user_is_allowlisted($user, $settings)
        && in_array($override, array('missionaccounts_admin', 'founder'), true)) {
        return $override;
    }
    $program_access = mma_program_access($user, $settings);
    return !empty($program_access['programs']['examprep']['enrolled'])
        && mma_product_user_id((int) $user->ID) !== ''
        ? 'student'
        : $native;
}

function mma_access_state($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }
    $settings = mma_settings();
    if (empty($settings['missionaccounts_enabled'])) {
        return new WP_Error('missionaccounts_disabled', 'MissionAccounts is not enabled for this pilot.', array('status' => 403));
    }
    $role = mma_role_for_user($user, $settings);
    if (!in_array($role, array('registered', 'student', 'missionaccounts_admin', 'founder'), true)) {
        return new WP_Error('role_not_enabled', 'MissionAccounts is not enabled for this account role.', array('status' => 403));
    }
    $program_access = mma_program_access($user, $settings);
    if (empty($program_access['registered'])) {
        return new WP_Error('registration_required', 'A registered MissionMed account is required.', array('status' => 403));
    }
    $is_allowlisted = mma_user_is_allowlisted($user, $settings);
    $has_product_id = mma_product_user_id((int) $user->ID) !== '';
    $source = $is_allowlisted
        ? 'wordpress_exact_user_pilot_allowlist'
        : ($has_product_id ? 'missionaccounts_provisioned_user' : 'wordpress_registered_matrix_user');
    $entitlement = apply_filters('missionmed_missionaccounts_entitlement', array(
        'trusted' => true,
        'verified' => true,
        'active' => true,
        'status' => 'active',
        'source' => $source,
    ), $user, $role);
    if ($role !== 'registered' && (!is_array($entitlement)
        || empty($entitlement['trusted'])
        || empty($entitlement['verified'])
        || empty($entitlement['active']))) {
        return new WP_Error('eligibility_required', 'MissionAccounts access is not currently active.', array('status' => 403));
    }
    return array('role' => $role, 'entitlement' => $entitlement, 'program_access' => $program_access);
}

function mma_product_user_id($user_id) {
    $id = strtolower(trim((string) get_user_meta($user_id, '_missionmed_missionaccounts_user_id', true)));
    $id = (string) apply_filters('missionmed_missionaccounts_user_id', $id, $user_id);
    return preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $id)
        ? $id
        : '';
}

function mma_secret() {
    $secret = trim((string) getenv('MISSIONACCOUNTS_JWT_SECRET'));
    if ($secret === '' && defined('MISSIONACCOUNTS_JWT_SECRET')) {
        $secret = trim((string) MISSIONACCOUNTS_JWT_SECRET);
    }
    return (string) apply_filters('missionmed_missionaccounts_jwt_secret', $secret);
}

function mma_base64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function mma_registered_subject($user_id, $secret) {
    $hex = substr(hash_hmac('sha256', 'missionaccounts-registered|' . absint($user_id), $secret), 0, 32);
    $hex[12] = '4';
    $hex[16] = dechex((hexdec($hex[16]) & 3) | 8);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
        . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

function mma_issue_jwt($user, $access) {
    $settings = mma_settings();
    $secret = mma_secret();
    if (strlen($secret) < 32) {
        return new WP_Error('missionaccounts_signer_unavailable', 'MissionAccounts token signing is not configured.', array('status' => 503));
    }
    $subject = mma_product_user_id((int) $user->ID);
    if ($subject === '') {
        if (($access['role'] ?? '') === 'student') {
            return new WP_Error('missionaccounts_identity_unmapped', 'This MissionMed account is not mapped to MissionAccounts.', array('status' => 503));
        }
        $subject = mma_registered_subject((int) $user->ID, $secret);
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
        'email' => (string) $user->user_email,
        'app_role' => (string) $access['role'],
        'wordpress_admin' => user_can($user, 'manage_options'),
        'missionaccounts_eligible' => true,
        'program_access' => $access['program_access'],
    );
    $encoded_header = mma_base64url(wp_json_encode($header));
    $encoded_payload = mma_base64url(wp_json_encode($payload));
    $signed = $encoded_header . '.' . $encoded_payload;
    $signature = hash_hmac('sha256', $signed, $secret, true);
    return array(
        'token' => $signed . '.' . mma_base64url($signature),
        'expires_at' => $expires,
        'ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mma_allowed_origin() {
    return strtolower((string) wp_parse_url(home_url('/'), PHP_URL_SCHEME))
        . '://'
        . strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST))
        . (($port = wp_parse_url(home_url('/'), PHP_URL_PORT)) ? ':' . absint($port) : '');
}

function mma_verify_origin($request) {
    return mma_verify_origin_value((string) $request->get_header('origin'));
}

function mma_verify_origin_value($origin) {
    $origin = trim((string) $origin);
    if ($origin === '') {
        return true;
    }
    if (!hash_equals(mma_allowed_origin(), strtolower(rtrim($origin, '/')))) {
        return new WP_Error('origin_not_allowed', 'This origin may not request a MissionAccounts token.', array('status' => 403));
    }
    return true;
}

function mma_rate_limit($user_id) {
    $settings = mma_settings();
    $now = time();
    $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
    $key = 'mma_rl_' . substr(hash('sha256', $user_id . '|' . $ip), 0, 32);
    $state = get_transient($key);
    if (!is_array($state) || empty($state['reset']) || (int) $state['reset'] <= $now) {
        $state = array('count' => 0, 'reset' => $now + (int) $settings['rate_limit_window_seconds']);
    }
    $state['count'] = (int) $state['count'] + 1;
    set_transient($key, $state, max(1, (int) $state['reset'] - $now));
    $keys = array_values(array_unique(array_merge((array) get_option(MMA_RATE_KEYS_OPTION, array()), array($key))));
    update_option(MMA_RATE_KEYS_OPTION, array_slice($keys, -500), false);
    if ($state['count'] > (int) $settings['rate_limit_requests']) {
        return new WP_Error('missionaccounts_rate_limited', 'MissionAccounts token refresh is temporarily rate limited.', array(
            'status' => 429,
            'retry_after' => max(1, (int) $state['reset'] - $now),
        ));
    }
    return true;
}

function mma_no_store($response) {
    if ($response instanceof WP_REST_Response) {
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Pragma', 'no-cache');
        $response->header('Vary', 'Authorization, Cookie');
        $response->header('X-Accel-Expires', '0');
        $response->header('Surrogate-Control', 'no-store');
        $response->header('CDN-Cache-Control', 'no-store');
        $response->header('Cloudflare-CDN-Cache-Control', 'no-store');
    }
    return $response;
}

// Include denied token responses as well as successful issuance.
function mma_rest_private_response($response, $server, $request) {
    if ($request->get_route() === '/' . MMA_REST_NAMESPACE . MMA_REST_ROUTE) {
        return mma_no_store($response);
    }
    return $response;
}
add_filter('rest_post_dispatch', 'mma_rest_private_response', 10, 3);

function mma_token_endpoint($request) {
    $origin = mma_verify_origin($request);
    if (is_wp_error($origin)) {
        return $origin;
    }
    $nonce = trim((string) $request->get_header('x-wp-nonce'));
    if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('csrf_failed', 'A valid WordPress REST nonce is required.', array('status' => 403));
    }
    $user = wp_get_current_user();
    $access = mma_access_state($user);
    if (is_wp_error($access)) {
        return $access;
    }
    $rate = mma_rate_limit((int) $user->ID);
    if (is_wp_error($rate)) {
        return $rate;
    }
    $issued = mma_issue_jwt($user, $access);
    if (is_wp_error($issued)) {
        return $issued;
    }
    $issued['nonce'] = wp_create_nonce('wp_rest');
    return mma_no_store(new WP_REST_Response($issued, 200));
}

function mma_register_rest_routes() {
    register_rest_route(MMA_REST_NAMESPACE, MMA_REST_ROUTE, array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mma_token_endpoint',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'mma_register_rest_routes');

function mma_safe_return_url($raw) {
    $settings = mma_settings();
    $candidate = esc_url_raw((string) $raw);
    $prefix = mma_allowed_origin() . strtolower($settings['base_path']);
    return $candidate !== '' && str_starts_with(strtolower($candidate), $prefix)
        ? $candidate
        : home_url($settings['base_path']);
}

function mma_bootstrap_payload($return_to) {
    $settings = mma_settings();
    return array(
        'nonce' => wp_create_nonce('wp_rest'),
        // Keep the browser exchange on the already cache-excluded admin-ajax
        // action. Some production WordPress stacks reject cookie-authenticated
        // REST requests before the route callback can validate its own nonce.
        'token_endpoint' => add_query_arg(
            'action',
            'missionmed_missionaccounts_bootstrap',
            admin_url('admin-ajax.php')
        ),
        'matrix_url' => esc_url_raw((string) $settings['matrix_url']),
        'base_path' => (string) $settings['base_path'],
        'return_to' => mma_safe_return_url($return_to),
        'token_ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mma_ajax_bootstrap() {
    nocache_headers();
    if (!headers_sent()) {
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
        header('Vary: Authorization, Cookie', true);
        header('X-Accel-Expires: 0', true);
        header('Surrogate-Control: no-store', true);
        header('CDN-Cache-Control: no-store', true);
        header('Cloudflare-CDN-Cache-Control: no-store', true);
    }
    $return_to = isset($_GET['return_to']) ? wp_unslash($_GET['return_to']) : '';
    if (!is_user_logged_in()) {
        wp_send_json_error(array(
            'code' => 'session_required',
            'state' => 'session_ended',
            'message' => 'Your MissionMed session has ended.',
            'login_url' => wp_login_url(mma_safe_return_url($return_to)),
        ), 401);
    }
    $user = wp_get_current_user();
    $access = mma_access_state($user);
    if (is_wp_error($access)) {
        wp_send_json_error(array(
            'code' => $access->get_error_code(),
            'state' => 'access_unavailable',
            'message' => $access->get_error_message(),
        ), (int) ($access->get_error_data()['status'] ?? 403));
    }
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
        $origin = mma_verify_origin_value((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        if (is_wp_error($origin)) {
            wp_send_json_error(array(
                'code' => $origin->get_error_code(),
                'state' => 'access_unavailable',
                'message' => $origin->get_error_message(),
            ), (int) ($origin->get_error_data()['status'] ?? 403));
        }
        $nonce = trim((string) ($_SERVER['HTTP_X_WP_NONCE'] ?? ''));
        if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
            wp_send_json_error(array(
                'code' => 'csrf_failed',
                'state' => 'access_unavailable',
                'message' => 'A valid WordPress nonce is required.',
            ), 403);
        }
        $rate = mma_rate_limit((int) $user->ID);
        if (is_wp_error($rate)) {
            wp_send_json_error(array(
                'code' => $rate->get_error_code(),
                'state' => 'access_unavailable',
                'message' => $rate->get_error_message(),
            ), (int) ($rate->get_error_data()['status'] ?? 429));
        }
        $issued = mma_issue_jwt($user, $access);
        if (is_wp_error($issued)) {
            wp_send_json_error(array(
                'code' => $issued->get_error_code(),
                'state' => 'access_unavailable',
                'message' => $issued->get_error_message(),
            ), (int) ($issued->get_error_data()['status'] ?? 503));
        }
        $issued['nonce'] = wp_create_nonce('wp_rest');
        wp_send_json($issued, 200);
    }
    wp_send_json_success(array_merge(mma_bootstrap_payload($return_to), array(
        'user' => array(
            'wp_user_id' => (int) $user->ID,
            'display_name' => (string) $user->display_name,
            'role' => (string) $access['role'],
            'program_access' => $access['program_access'],
        ),
    )));
}
add_action('wp_ajax_missionmed_missionaccounts_bootstrap', 'mma_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_missionaccounts_bootstrap', 'mma_ajax_bootstrap');

function mma_user_can_enter() {
    return is_user_logged_in() && !is_wp_error(mma_access_state(wp_get_current_user()));
}

function mma_navigation_item($items) {
    if (!mma_user_can_enter()) {
        return $items;
    }
    $items = is_array($items) ? $items : array();
    $items[] = array(
        'id' => 'missionaccounts',
        'label' => 'MyMissionMed Account',
        'url' => home_url(mma_settings()['base_path']),
        'icon' => 'money-alt',
    );
    return $items;
}
add_filter('missionmed_matrix_navigation_items', 'mma_navigation_item');

function mma_dashboard_tile_item($tiles) {
    if (!mma_user_can_enter()) {
        return $tiles;
    }
    $tiles = is_array($tiles) ? $tiles : array();
    $tiles[] = array(
        'id' => 'missionaccounts',
        'label' => 'MyMissionMed Account',
        'subtitle' => 'Your MissionMed programs and account',
        'url' => home_url(mma_settings()['base_path']),
    );
    return $tiles;
}
add_filter('missionmed_matrix_dashboard_tiles', 'mma_dashboard_tile_item');

function mma_menu_items($items, $args) {
    if (!mma_user_can_enter()) {
        return $items;
    }
    $location = isset($args->theme_location) ? sanitize_key((string) $args->theme_location) : '';
    if (!in_array($location, mma_settings()['matrix_menu_locations'], true)) {
        return $items;
    }
    return $items . sprintf(
        '<li class="menu-item missionmed-missionaccounts-nav"><a href="%s">%s</a></li>',
        esc_url(home_url(mma_settings()['base_path'])),
        esc_html__('MyMissionMed Account', 'missionmed')
    );
}
add_filter('wp_nav_menu_items', 'mma_menu_items', 20, 2);

function mma_is_matrix_request() {
    $matrix_path = (string) wp_parse_url(mma_settings()['matrix_url'], PHP_URL_PATH);
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $request_path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    return $matrix_path !== '' && untrailingslashit($request_path) === untrailingslashit($matrix_path);
}

function mma_enqueue_matrix_launch_adapter() {
    if (!mma_is_matrix_request() || !mma_user_can_enter()) {
        return;
    }
    $handle = 'missionmed-missionaccounts-matrix-launch';
    // Match the proven Matrix launcher seam: load after the runtime has built
    // the sidebar, while the launcher's observer preserves later rerenders.
    wp_enqueue_script($handle, plugins_url('assets/matrix-launch.js', __FILE__), array(), MMA_VERSION, true);
    wp_add_inline_script($handle, 'window.MissionMedMissionAccountsLaunch=' . wp_json_encode(array(
        'target' => home_url(mma_settings()['base_path']),
    )) . ';', 'before');
}
add_action('wp_enqueue_scripts', 'mma_enqueue_matrix_launch_adapter', 30);

function mma_inject_matrix_module() {
    if (!mma_is_matrix_request() || !mma_user_can_enter()) {
        return;
    }
    $settings = mma_settings();
    $module = array(
        'id' => 'missionaccounts',
        'route' => 'missionaccounts',
        'label' => 'MyMissionMed Account',
        'icon' => 'MA',
        'section' => 'Account',
        'launch_url' => home_url($settings['base_path']),
    );
    echo '<script>(function(){var o=window.MMED_OS;if(o&&Array.isArray(o.modules)&&!o.modules.some(function(m){return m.id==="missionaccounts"})){o.modules.push(' . wp_json_encode($module) . ');}})();</script>' . "\n";
}
add_action('wp_footer', 'mma_inject_matrix_module', 5);
