<?php
/**
 * Plugin Name: MissionMed HomeBase SSO
 * Description: Default-off WordPress session bridge, entitlement gate, and Matrix navigation seam for HomeBase V5.
 * Version: 0.1.2
 * Requires at least: 6.5
 * Requires PHP: 8.1
 * Author: MissionMed
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMHB_OPTION = 'missionmed_homebase_settings';
const MMHB_RATE_KEYS_OPTION = 'missionmed_homebase_rate_keys';
const MMHB_REST_NAMESPACE = 'missionmed/v1';
const MMHB_REST_ROUTE = '/homebase/token';
const MMHB_VERSION = '0.1.2';

function mmhb_defaults() {
    return array(
        'homebase_enabled' => false,
        'allowed_user_ids' => array(),
        'app_role_overrides' => array(),
        'allowed_roles' => array('student', 'mentor', 'admin'),
        'allowed_cohorts' => array(),
        'base_path' => '/homebase/',
        'matrix_url' => home_url('/member-dashboard/'),
        'issuer' => home_url('/wp-json/' . MMHB_REST_NAMESPACE . '/homebase'),
        'audience' => 'homebase',
        'token_ttl_seconds' => 120,
        'rate_limit_requests' => 20,
        'rate_limit_window_seconds' => 60,
        'matrix_menu_locations' => array('member-dashboard'),
    );
}

function mmhb_settings() {
    $stored = get_option(MMHB_OPTION, array());
    if (!is_array($stored)) {
        $stored = array();
    }
    $settings = wp_parse_args($stored, mmhb_defaults());
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
        && defined('MISSIONMED_HOMEBASE_LOCAL_FIXTURES')
        && MISSIONMED_HOMEBASE_LOCAL_FIXTURES
    ) {
        $settings['token_ttl_seconds'] = max(5, min(300, absint($settings['token_ttl_seconds'])));
    }
    $settings['rate_limit_requests'] = max(1, min(120, absint($settings['rate_limit_requests'])));
    $settings['rate_limit_window_seconds'] = max(10, min(300, absint($settings['rate_limit_window_seconds'])));
    return apply_filters('missionmed_homebase_settings', $settings);
}

function mmhb_activate() {
    $stored = get_option(MMHB_OPTION, array());
    $settings = is_array($stored) ? wp_parse_args($stored, mmhb_defaults()) : mmhb_defaults();
    $settings['homebase_enabled'] = false;
    update_option(MMHB_OPTION, $settings, false);
}
register_activation_hook(__FILE__, 'mmhb_activate');

function mmhb_deactivate() {
    $settings = mmhb_settings();
    $settings['homebase_enabled'] = false;
    update_option(MMHB_OPTION, $settings, false);

    $keys = get_option(MMHB_RATE_KEYS_OPTION, array());
    foreach ((array) $keys as $key) {
        delete_transient((string) $key);
    }
    delete_option(MMHB_RATE_KEYS_OPTION);
}
register_deactivation_hook(__FILE__, 'mmhb_deactivate');

function mmhb_bool($value) {
    if (is_bool($value)) {
        return $value;
    }
    return in_array(strtolower(trim((string) $value)), array('1', 'true', 'yes', 'on'), true);
}

function mmhb_native_role_for_user($user) {
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

function mmhb_user_is_allowlisted($user, $settings = null) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return false;
    }
    $settings = is_array($settings) ? $settings : mmhb_settings();
    return in_array((int) $user->ID, array_map('absint', (array) ($settings['allowed_user_ids'] ?? array())), true);
}

function mmhb_role_for_user($user, $settings = null) {
    $native_role = mmhb_native_role_for_user($user);
    if ($native_role === '') {
        return '';
    }
    $settings = is_array($settings) ? $settings : mmhb_settings();
    if (!mmhb_user_is_allowlisted($user, $settings)) {
        return $native_role;
    }
    $override = sanitize_key((string) ($settings['app_role_overrides'][(int) $user->ID] ?? ''));
    return in_array($override, array('student', 'mentor', 'admin'), true)
        ? $override
        : $native_role;
}

function mmhb_cohort_for_user($user_id) {
    $cohort = get_user_meta($user_id, '_missionmed_homebase_cohort', true);
    if ($cohort === '') {
        $cohort = get_user_meta($user_id, '_mmed_cohort', true);
    }
    return sanitize_text_field((string) apply_filters(
        'missionmed_homebase_user_cohort',
        $cohort,
        $user_id
    ));
}

function mmhb_assignment_student_ids($mentor_id) {
    $raw = get_user_meta($mentor_id, '_missionmed_homebase_student_ids', true);
    $ids = is_array($raw) ? $raw : array_filter(array_map('trim', explode(',', (string) $raw)));
    $ids = array_values(array_filter(array_map('sanitize_text_field', $ids)));
    return apply_filters('missionmed_homebase_mentor_student_ids', $ids, $mentor_id);
}

function mmhb_entitlement_for_user($user) {
    $role = mmhb_role_for_user($user);
    $native_role = mmhb_native_role_for_user($user);
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
        $assigned = mmhb_assignment_student_ids((int) $user->ID);
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
        && defined('MISSIONMED_HOMEBASE_LOCAL_FIXTURES')
        && MISSIONMED_HOMEBASE_LOCAL_FIXTURES
    ) {
        $active = mmhb_bool(get_user_meta($user->ID, '_missionmed_homebase_local_eligible', true));
        $entitlement = array(
            'trusted' => true,
            'verified' => true,
            'active' => $active,
            'status' => $active ? 'active' : 'revoked',
            'source' => 'local_fixture_only',
        );
    }

    $entitlement = apply_filters(
        'missionmed_homebase_entitlement',
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

function mmhb_access_state($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return new WP_Error('session_required', 'Your MissionMed session has ended.', array('status' => 401));
    }

    $settings = mmhb_settings();
    if (empty($settings['homebase_enabled'])) {
        return new WP_Error('homebase_disabled', 'HomeBase is not enabled for this pilot.', array('status' => 403));
    }

    $role = mmhb_role_for_user($user, $settings);
    $allowlisted = mmhb_user_is_allowlisted($user, $settings);
    if (!$allowlisted) {
        return new WP_Error(
            'user_not_enabled',
            'HomeBase is not enabled for this account.',
            array('status' => 403)
        );
    }

    if (!in_array($role, $settings['allowed_roles'], true)) {
        return new WP_Error('role_not_enabled', 'HomeBase is not enabled for this account role.', array('status' => 403));
    }

    $cohort = mmhb_cohort_for_user((int) $user->ID);
    if (
        $role === 'student'
        && $allowlisted
        && !empty($settings['allowed_cohorts'])
        && !in_array($cohort, $settings['allowed_cohorts'], true)
    ) {
        return new WP_Error('cohort_not_enabled', 'HomeBase is not enabled for this cohort.', array('status' => 403));
    }

    $entitlement = mmhb_entitlement_for_user($user);
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

function mmhb_homebase_user_id($user_id) {
    $id = strtolower(trim((string) get_user_meta($user_id, '_missionmed_homebase_user_id', true)));
    $id = (string) apply_filters('missionmed_homebase_user_id', $id, $user_id);
    if (preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $id)) {
        return $id;
    }

    // Stable, non-reversible RFC 4122 v5 subject derived from the WordPress
    // authority. This avoids a production-blocking user-meta mutation while
    // keeping raw WordPress identifiers out of HomeBase primary keys.
    $namespace = hex2bin('5f3a16dfec7f5a04a47fc962a0d6f2d8');
    $hash = sha1($namespace . home_url('/') . '|wp-user|' . absint($user_id));
    $hash[12] = '5';
    $hash[16] = dechex((hexdec($hash[16]) & 0x3) | 0x8);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hash, 0, 8),
        substr($hash, 8, 4),
        substr($hash, 12, 4),
        substr($hash, 16, 4),
        substr($hash, 20, 12)
    );
}

function mmhb_secret() {
    $secret = trim((string) getenv('HOMEBASE_JWT_SECRET'));
    if ($secret === '' && defined('HOMEBASE_JWT_SECRET')) {
        $secret = trim((string) HOMEBASE_JWT_SECRET);
    }
    return (string) apply_filters('missionmed_homebase_jwt_secret', $secret);
}

function mmhb_base64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

/**
 * Accept only the canonical public CDN used by Arena's R2 avatar objects.
 * HomeBase never receives an R2 object key or any avatar write authority.
 */
function mmhb_safe_arena_avatar_url($raw) {
    $url = esc_url_raw((string) $raw, array('https'));
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    $allowed = (array) apply_filters(
        'missionmed_homebase_arena_avatar_hosts',
        array('cdn.missionmedinstitute.com')
    );
    $allowed = array_values(array_unique(array_filter(array_map(
        static fn($value) => strtolower(trim((string) $value)),
        $allowed
    ))));
    return $url !== '' && in_array($host, $allowed, true) ? $url : '';
}

/**
 * Resolve active Arena Lobby avatars for WordPress users through the existing
 * WordPress-to-Supabase identity bridge. The query is read-only and returns a
 * bounded safe projection of active user_avatars rows only.
 */
function mmhb_arena_avatar_projections($wp_user_ids) {
    $result = array();
    if (
        !class_exists('MMED_Supabase_Bridge')
        || !MMED_Supabase_Bridge::configured()
        || !defined('MMED_SUPABASE_URL')
    ) {
        return $result;
    }

    $uuid_to_wp = array();
    foreach (array_values(array_unique(array_map('absint', (array) $wp_user_ids))) as $wp_user_id) {
        if ($wp_user_id < 1) {
            continue;
        }
        $uuid = strtolower(trim((string) MMED_Supabase_Bridge::get_supabase_uuid($wp_user_id)));
        if (MMED_Supabase_Bridge::is_valid_uuid($uuid)) {
            $uuid_to_wp[$uuid] = $wp_user_id;
        }
    }
    if (empty($uuid_to_wp)) {
        return $result;
    }

    $headers = MMED_Supabase_Bridge::get_supabase_client_headers();
    if (empty($headers)) {
        return $result;
    }
    foreach (array_chunk(array_keys($uuid_to_wp), 75) as $uuid_chunk) {
        $url = add_query_arg(array(
            'user_id' => 'in.(' . implode(',', $uuid_chunk) . ')',
            'is_active' => 'eq.true',
            'select' => 'id,user_id,avatar_url,thumbnail_url,is_active,created_at',
            'order' => 'created_at.desc',
        ), untrailingslashit((string) MMED_SUPABASE_URL) . '/rest/v1/user_avatars');
        $response = wp_remote_get($url, array('timeout' => 12, 'headers' => $headers));
        if (is_wp_error($response) || (int) wp_remote_retrieve_response_code($response) !== 200) {
            continue;
        }
        $rows = json_decode((string) wp_remote_retrieve_body($response), true);
        if (!is_array($rows)) {
            continue;
        }
        foreach ($rows as $row) {
            $uuid = strtolower(trim((string) ($row['user_id'] ?? '')));
            $wp_user_id = $uuid_to_wp[$uuid] ?? 0;
            if ($wp_user_id < 1 || isset($result[$wp_user_id]) || empty($row['is_active'])) {
                continue;
            }
            $avatar_id = strtolower(trim((string) ($row['id'] ?? '')));
            $thumbnail = mmhb_safe_arena_avatar_url($row['thumbnail_url'] ?? $row['avatar_url'] ?? '');
            $avatar_url = mmhb_safe_arena_avatar_url($row['avatar_url'] ?? '');
            if (!MMED_Supabase_Bridge::is_valid_uuid($avatar_id) || $thumbnail === '') {
                continue;
            }
            $result[$wp_user_id] = array(
                'source' => 'arena_lobby',
                'active_avatar_id' => $avatar_id,
                'avatar_thumbnail_url' => $thumbnail,
                'avatar_url' => $avatar_url,
            );
        }
    }
    return $result;
}

function mmhb_arena_avatar_for_user($wp_user_id) {
    $projections = mmhb_arena_avatar_projections(array($wp_user_id));
    return is_array($projections[(int) $wp_user_id] ?? null)
        ? $projections[(int) $wp_user_id]
        : array();
}

function mmhb_issue_jwt($user, $access) {
    $settings = mmhb_settings();
    $secret = mmhb_secret();
    if (strlen($secret) < 32) {
        return new WP_Error(
            'homebase_signer_unavailable',
            'HomeBase token signing is not configured.',
            array('status' => 503)
        );
    }
    $subject = mmhb_homebase_user_id((int) $user->ID);
    if ($subject === '') {
        return new WP_Error(
            'homebase_identity_unmapped',
            'This MissionMed account is not mapped to HomeBase.',
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
        'email' => (string) $user->user_email,
        'app_role' => (string) $access['role'],
        'wordpress_admin' => user_can($user, 'manage_options'),
        'homebase_eligible' => true,
    );
    if ($access['cohort'] !== '') {
        $payload['cohort'] = (string) $access['cohort'];
    }
    $avatar = mmhb_arena_avatar_for_user((int) $user->ID);
    if (!empty($avatar['avatar_thumbnail_url'])) {
        $payload['avatar_thumbnail_url'] = (string) $avatar['avatar_thumbnail_url'];
        $payload['avatar_url'] = (string) ($avatar['avatar_url'] ?? '');
        $payload['active_avatar_id'] = (string) ($avatar['active_avatar_id'] ?? '');
    }
    $encoded_header = mmhb_base64url(wp_json_encode($header));
    $encoded_payload = mmhb_base64url(wp_json_encode($payload));
    $signed = $encoded_header . '.' . $encoded_payload;
    $signature = hash_hmac('sha256', $signed, $secret, true);
    return array(
        'token' => $signed . '.' . mmhb_base64url($signature),
        'expires_at' => $expires,
        'ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mmhb_request_ip() {
    return isset($_SERVER['REMOTE_ADDR'])
        ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
        : '';
}

function mmhb_rate_limit($user_id) {
    $settings = mmhb_settings();
    $window = (int) $settings['rate_limit_window_seconds'];
    $limit = (int) $settings['rate_limit_requests'];
    $key = 'mmhb_rl_' . substr(hash('sha256', $user_id . '|' . mmhb_request_ip()), 0, 32);
    $now = time();
    $state = get_transient($key);
    if (!is_array($state) || empty($state['reset']) || (int) $state['reset'] <= $now) {
        $state = array('count' => 0, 'reset' => $now + $window);
    }
    $state['count'] = (int) $state['count'] + 1;
    set_transient($key, $state, max(1, (int) $state['reset'] - $now));

    $keys = array_values(array_unique(array_merge((array) get_option(MMHB_RATE_KEYS_OPTION, array()), array($key))));
    update_option(MMHB_RATE_KEYS_OPTION, array_slice($keys, -500), false);

    if ($state['count'] > $limit) {
        return new WP_Error(
            'homebase_rate_limited',
            'HomeBase token refresh is temporarily rate limited.',
            array('status' => 429, 'retry_after' => max(1, (int) $state['reset'] - $now))
        );
    }
    return true;
}

function mmhb_allowed_origin() {
    return strtolower((string) wp_parse_url(home_url('/'), PHP_URL_SCHEME))
        . '://'
        . strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST))
        . (($port = wp_parse_url(home_url('/'), PHP_URL_PORT)) ? ':' . absint($port) : '');
}

function mmhb_verify_origin($request) {
    $origin = trim((string) $request->get_header('origin'));
    if ($origin === '') {
        return true;
    }
    $normalized = strtolower(rtrim($origin, '/'));
    if (!hash_equals(mmhb_allowed_origin(), $normalized)) {
        return new WP_Error('origin_not_allowed', 'This origin may not request a HomeBase token.', array('status' => 403));
    }
    return true;
}

function mmhb_no_store($response) {
    if ($response instanceof WP_REST_Response) {
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Pragma', 'no-cache');
    }
    return $response;
}

function mmhb_send_private_no_store_headers() {
    nocache_headers();
    if (!headers_sent()) {
        header('Cache-Control: no-store, private', true);
        header('Pragma: no-cache', true);
    }
}

function mmhb_is_token_rest_request($request = null) {
    $expected_route = '/' . MMHB_REST_NAMESPACE . MMHB_REST_ROUTE;
    if (
        $request instanceof WP_REST_Request
        && untrailingslashit($request->get_route()) === untrailingslashit($expected_route)
    ) {
        return true;
    }
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $request_path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    $route_suffix = '/' . ltrim(MMHB_REST_NAMESPACE . MMHB_REST_ROUTE, '/');
    if (
        $request_path !== ''
        && str_ends_with(untrailingslashit($request_path), untrailingslashit($route_suffix))
    ) {
        return true;
    }
    $expected_path = (string) wp_parse_url(
        rest_url(MMHB_REST_NAMESPACE . MMHB_REST_ROUTE),
        PHP_URL_PATH
    );
    return $request_path !== ''
        && untrailingslashit($request_path) === untrailingslashit($expected_path);
}

function mmhb_rest_private_no_store($response, $server, $request) {
    unset($server);
    if (mmhb_is_token_rest_request($request) && $response instanceof WP_REST_Response) {
        $GLOBALS['mmhb_private_rest_response'] = true;
        $response->header('Cache-Control', 'no-store, private');
        $response->header('Pragma', 'no-cache');
    }
    return $response;
}
add_filter('rest_post_dispatch', 'mmhb_rest_private_no_store', 10, 3);

function mmhb_rest_preserve_private_cache_headers($send_nocache_headers) {
    if (!empty($GLOBALS['mmhb_private_rest_response']) || mmhb_is_token_rest_request()) {
        if (!headers_sent()) {
            header('Cache-Control: no-store, private', true);
            header('Pragma: no-cache', true);
        }
        return false;
    }
    return $send_nocache_headers;
}
add_filter('rest_send_nocache_headers', 'mmhb_rest_preserve_private_cache_headers');

function mmhb_token_endpoint($request) {
    $origin = mmhb_verify_origin($request);
    if (is_wp_error($origin)) {
        return $origin;
    }

    $nonce = trim((string) $request->get_header('x-wp-nonce'));
    if ($nonce === '' || !wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('csrf_failed', 'A valid WordPress REST nonce is required.', array('status' => 403));
    }

    $user = wp_get_current_user();
    $access = mmhb_access_state($user);
    if (is_wp_error($access)) {
        return $access;
    }

    $rate = mmhb_rate_limit((int) $user->ID);
    if (is_wp_error($rate)) {
        return $rate;
    }

    $issued = mmhb_issue_jwt($user, $access);
    if (is_wp_error($issued)) {
        return $issued;
    }
    $issued['nonce'] = wp_create_nonce('wp_rest');
    return mmhb_no_store(new WP_REST_Response($issued, 200));
}

function mmhb_register_rest_routes() {
    register_rest_route(MMHB_REST_NAMESPACE, MMHB_REST_ROUTE, array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'mmhb_token_endpoint',
        'permission_callback' => '__return_true',
    ));
}
add_action('rest_api_init', 'mmhb_register_rest_routes');

function mmhb_safe_return_url($raw) {
    $settings = mmhb_settings();
    $candidate = esc_url_raw((string) $raw);
    $origin = mmhb_allowed_origin();
    if ($candidate === '' || !str_starts_with(strtolower($candidate), $origin . strtolower($settings['base_path']))) {
        return home_url($settings['base_path']);
    }
    return $candidate;
}

function mmhb_bootstrap_payload($return_to) {
    $settings = mmhb_settings();
    return array(
        'nonce' => wp_create_nonce('wp_rest'),
        'token_endpoint' => rest_url(MMHB_REST_NAMESPACE . MMHB_REST_ROUTE),
        'matrix_url' => esc_url_raw((string) $settings['matrix_url']),
        'base_path' => (string) $settings['base_path'],
        'return_to' => mmhb_safe_return_url($return_to),
        'token_ttl_seconds' => (int) $settings['token_ttl_seconds'],
    );
}

function mmhb_ajax_bootstrap() {
    mmhb_send_private_no_store_headers();
    $return_to = isset($_GET['return_to']) ? wp_unslash($_GET['return_to']) : '';
    if (!is_user_logged_in()) {
        $safe_return = mmhb_safe_return_url($return_to);
        wp_send_json_error(array(
            'code' => 'session_required',
            'state' => 'session_ended',
            'message' => 'Your MissionMed session has ended.',
            'login_url' => wp_login_url($safe_return),
        ), 401);
    }

    $user = wp_get_current_user();
    $access = mmhb_access_state($user);
    if (is_wp_error($access)) {
        wp_send_json_error(array(
            'code' => $access->get_error_code(),
            'state' => $access->get_error_code() === 'eligibility_revoked' ? 'eligibility_revoked' : 'access_unavailable',
            'message' => $access->get_error_message(),
        ), (int) ($access->get_error_data()['status'] ?? 403));
    }

    wp_send_json_success(array_merge(mmhb_bootstrap_payload($return_to), array(
        'user' => array(
            'wp_user_id' => (int) $user->ID,
            'display_name' => (string) $user->display_name,
            'role' => (string) $access['role'],
            'cohort' => (string) $access['cohort'],
        ),
    )));
}
add_action('wp_ajax_missionmed_homebase_bootstrap', 'mmhb_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_homebase_bootstrap', 'mmhb_ajax_bootstrap');

function mmhb_user_can_enter() {
    if (!is_user_logged_in()) {
        return false;
    }
    return !is_wp_error(mmhb_access_state(wp_get_current_user()));
}

function mmhb_is_matrix_request() {
    $matrix_path = (string) wp_parse_url(mmhb_settings()['matrix_url'], PHP_URL_PATH);
    $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
    $request_path = (string) wp_parse_url(esc_url_raw($request_uri), PHP_URL_PATH);
    return $matrix_path !== ''
        && untrailingslashit($request_path) === untrailingslashit($matrix_path);
}

function mmhb_enqueue_matrix_launch_adapter() {
    if (!mmhb_is_matrix_request() || !mmhb_user_can_enter()) {
        return;
    }
    $handle = 'missionmed-homebase-matrix-launch';
    wp_enqueue_script(
        $handle,
        plugins_url('assets/matrix-launch.js', __FILE__),
        array(),
        MMHB_VERSION,
        false
    );
    wp_add_inline_script(
        $handle,
        'window.MissionMedHomeBaseLaunch=' . wp_json_encode(array(
            'target' => home_url(mmhb_settings()['base_path']),
            'matrixPath' => (string) wp_parse_url(mmhb_settings()['matrix_url'], PHP_URL_PATH),
        )) . ';',
        'before'
    );
}
add_action('wp_enqueue_scripts', 'mmhb_enqueue_matrix_launch_adapter', 30);

function mmhb_navigation_item($items) {
    if (!mmhb_user_can_enter()) {
        return $items;
    }
    $item = array(
        'id' => 'homebase',
        'label' => 'HomeBase',
        'url' => home_url(mmhb_settings()['base_path']),
        'icon' => 'book-alt',
    );
    if (!is_array($items)) {
        $items = array();
    }
    $items[] = $item;
    return $items;
}
add_filter('missionmed_matrix_navigation_items', 'mmhb_navigation_item');

function mmhb_dashboard_tile_item($tiles) {
    if (!mmhb_user_can_enter()) {
        return $tiles;
    }
    if (!is_array($tiles)) {
        $tiles = array();
    }
    $tiles[] = array(
        'id' => 'homebase',
        'label' => 'HomeBase',
        'subtitle' => 'Your session HomeBase',
        'url' => home_url(mmhb_settings()['base_path']),
    );
    return $tiles;
}
add_filter('missionmed_matrix_dashboard_tiles', 'mmhb_dashboard_tile_item');

function mmhb_menu_items($items, $args) {
    if (!mmhb_user_can_enter()) {
        return $items;
    }
    $location = isset($args->theme_location) ? sanitize_key((string) $args->theme_location) : '';
    if (!in_array($location, mmhb_settings()['matrix_menu_locations'], true)) {
        return $items;
    }
    return $items . sprintf(
        '<li class="menu-item menu-item-homebase"><a href="%s">%s</a></li>',
        esc_url(home_url(mmhb_settings()['base_path'])),
        esc_html__('HomeBase', 'missionmed-homebase-sso')
    );
}
add_filter('wp_nav_menu_items', 'mmhb_menu_items', 10, 2);

function mmhb_navigation_shortcode() {
    if (!mmhb_user_can_enter()) {
        return '';
    }
    return sprintf(
        '<a class="missionmed-homebase-nav" href="%s">%s</a>',
        esc_url(home_url(mmhb_settings()['base_path'])),
        esc_html__('HomeBase', 'missionmed-homebase-sso')
    );
}
add_shortcode('missionmed_homebase_navigation', 'mmhb_navigation_shortcode');

function mmhb_tile_shortcode() {
    if (!mmhb_user_can_enter()) {
        return '';
    }
    return sprintf(
        '<a class="missionmed-homebase-tile" href="%s"><strong>%s</strong><span>%s</span></a>',
        esc_url(home_url(mmhb_settings()['base_path'])),
        esc_html__('HomeBase', 'missionmed-homebase-sso'),
        esc_html__('Your session HomeBase', 'missionmed-homebase-sso')
    );
}
add_shortcode('missionmed_homebase_dashboard_tile', 'mmhb_tile_shortcode');

function mmhb_assignment_rows() {
    $rows = array();
    $mentors = get_users(array('role__in' => array('mentor', 'advisor', 'coach')));
    foreach ($mentors as $mentor) {
        $mentor_sf_id = mmhb_homebase_user_id((int) $mentor->ID);
        foreach (mmhb_assignment_student_ids((int) $mentor->ID) as $student_sf_id) {
            $rows[] = array(
                'mentor_id' => $mentor_sf_id,
                'student_id' => strtolower((string) $student_sf_id),
                'active' => true,
                'source' => 'wordpress_mentor_assignments',
            );
        }
    }
    return apply_filters('missionmed_homebase_assignment_rows', $rows);
}
