<?php
/**
 * Plugin Name: MissionMed RISE SSO
 * Description: Browser-redirect WordPress to MissionMed HQ audience=rise handoff.
 * Version: 2.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function mmrise_sso_beta_course_ids() {
    return array(3893, 3646);
}

function mmrise_sso_user_is_admin($user) {
    return $user instanceof WP_User && (
        user_can($user, 'manage_options') ||
        in_array('administrator', array_map('strtolower', (array) $user->roles), true)
    );
}

function mmrise_sso_user_beta_course_ids($user_id) {
    $granted = array();
    foreach (mmrise_sso_beta_course_ids() as $course_id) {
        $has_access = function_exists('sfwd_lms_has_access')
            ? sfwd_lms_has_access((int) $course_id, (int) $user_id)
            : false;
        if ($has_access) {
            $granted[] = (int) $course_id;
        }
    }
    return $granted;
}

function mmrise_sso_user_allowed($user) {
    if (!($user instanceof WP_User) || (int) $user->ID < 1) {
        return false;
    }
    if (class_exists('MMED_Access_Gate') && method_exists('MMED_Access_Gate', 'user_can_access_app')) {
        return MMED_Access_Gate::user_can_access_app((int) $user->ID, 'rise');
    }
    return mmrise_sso_user_is_admin($user) || count(mmrise_sso_user_beta_course_ids((int) $user->ID)) > 0;
}

function mmrise_sso_secret() {
    $environment = trim((string) getenv('MMHQ_HANDOFF_SECRET'));
    if ($environment !== '') {
        return $environment;
    }
    return defined('MMHQ_HANDOFF_SECRET') ? trim((string) MMHQ_HANDOFF_SECRET) : '';
}

function mmrise_sso_hq_origin() {
    $configured = defined('MMED_RISE_HQ_ORIGIN')
        ? trim((string) MMED_RISE_HQ_ORIGIN)
        : 'https://missionmed-hq-production.up.railway.app';
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

function mmrise_sso_final_url() {
    $raw = isset($_GET['final']) ? (string) wp_unslash($_GET['final']) : '/rise/';
    $path = (string) wp_parse_url($raw, PHP_URL_PATH);
    if ($path !== '/rise/' && $path !== '/rise') {
        $path = '/rise/';
    }
    return home_url($path);
}

function mmrise_sso_set_cookie($name, $value, $expires, $http_only) {
    return setcookie($name, $value, array(
        'expires' => $expires,
        'path' => '/',
        'secure' => is_ssl(),
        'httponly' => (bool) $http_only,
        'samesite' => 'Lax',
    ));
}

function mmrise_sso_handle() {
    if (!is_user_logged_in()) {
        wp_safe_redirect(wp_login_url(mmrise_sso_final_url()));
        exit;
    }
    $secret = mmrise_sso_secret();
    $origin = mmrise_sso_hq_origin();
    if ($secret === '' || $origin === '') {
        status_header(503);
        wp_die('RISE authentication is not configured.');
    }

    $user = wp_get_current_user();
    $beta_course_ids = mmrise_sso_user_beta_course_ids((int) $user->ID);
    if (!mmrise_sso_user_allowed($user)) {
        status_header(403);
		wp_die('RISE access is unavailable for this account.');
    }
    $payload = array(
        'wp_user_id' => (int) $user->ID,
        'email' => (string) $user->user_email,
        'username' => (string) $user->user_login,
        'display_name' => (string) $user->display_name,
        'roles' => array_values((array) $user->roles),
        'rise_beta_access' => true,
        'rise_beta_course_ids' => $beta_course_ids,
        'rise_beta_entitlements' => array('FULL_RISE_BETA_ACCESS'),
        'auth_audience' => 'rise',
        'iat' => time(),
        'exp' => time() + 120,
        'nonce' => wp_generate_uuid4(),
    );
    $json = wp_json_encode($payload);
    if (!is_string($json) || $json === '') {
        status_header(500);
        wp_die('RISE authentication payload could not be created.');
    }
    $body = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    $token = $body . '.' . hash_hmac('sha256', $body, $secret);

    $callback = add_query_arg(
        array('action' => 'mmed_rise_auth_callback'),
        admin_url('admin-post.php')
    );
    $endpoint = add_query_arg(
        array('audience' => 'rise', 'token' => $token, 'final' => $callback),
        $origin . '/api/auth/session'
    );

    // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect
    wp_redirect($endpoint);
    exit;
}

function mmrise_sso_callback() {
    if (!is_user_logged_in()) {
        wp_safe_redirect(wp_login_url(home_url('/rise/')));
        exit;
    }
    $rise_session = isset($_GET['rise_session']) ? (string) wp_unslash($_GET['rise_session']) : '';
    if ($rise_session === '' || strlen($rise_session) > 16384) {
        status_header(503);
        wp_die('RISE authentication session was not returned.');
    }
    mmrise_sso_set_cookie('mmhq_rise_session', $rise_session, time() + 28800, true);
    mmrise_sso_set_cookie('mmed_rise_session_ready', '1', time() + 28800, true);
    mmrise_sso_set_cookie('mmed_rise_wp_nonce', wp_create_nonce('wp_rest'), time() + 43200, false);
    wp_safe_redirect(mmrise_sso_final_url());
    exit;
}

add_action('admin_post_mmed_rise_auth_redirect', 'mmrise_sso_handle', 1);
add_action('admin_post_nopriv_mmed_rise_auth_redirect', 'mmrise_sso_handle', 1);
add_action('admin_post_mmed_rise_auth_callback', 'mmrise_sso_callback', 1);
add_action('admin_post_nopriv_mmed_rise_auth_callback', 'mmrise_sso_callback', 1);
