<?php
/**
 * Plugin Name: MissionMed RISE SSO
 * Description: Verified server-side WordPress to MissionMed HQ audience=rise handoff.
 * Version: 2.0.1
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

// DR-361: read current owner policy; never grant access or create a session.
function mmrise_ivoc_eligibility_permission($request) {
    $body = (string) $request->get_body();
    $secret = mmrise_sso_secret();
    $signature = (string) $request->get_header('x-mmed-rise-proof');
    if (strlen($secret) < 32 || strlen($body) > 1024
        || $request->get_method() !== 'POST' || $request->get_header('origin')
        || !preg_match('/^[a-f0-9]{64}$/D', $signature)
        || !hash_equals(hash_hmac('sha256', "mmrise-ivoc-eligibility-request-v1\n" . $body, $secret), $signature)) {
        return new WP_Error('rise_proof_denied', 'Unauthorized owner proof.', array('status' => 403));
    }
    $value = json_decode($body, true);
    if (!is_array($value) || ($value['audience'] ?? '') !== 'ivoc-rise-owner-projection'
        || !is_string($value['subject'] ?? null) || !preg_match('/^wp:[1-9][0-9]{0,14}$/D', $value['subject'])
        || !is_string($value['nonce'] ?? null) || !preg_match('/^[0-9a-f-]{36}$/D', $value['nonce'])
        || !is_int($value['iat'] ?? null) || $value['iat'] > time() + 5 || $value['iat'] < time() - 30) {
        return new WP_Error('rise_proof_denied', 'Invalid owner proof.', array('status' => 403));
    }
    return true;
}

function mmrise_ivoc_eligibility($request) {
    $permission = mmrise_ivoc_eligibility_permission($request);
    if ($permission !== true) return $permission;
    // This new proof must never drop the current owner's restriction overlay.
    // Preserve legacy direct SSO behavior, but do not use its fallback here.
    if (!class_exists('MMED_Access_Gate') || !method_exists('MMED_Access_Gate', 'user_can_access_app')) {
        return new WP_Error('rise_owner_unavailable', 'Current RISE authority unavailable.', array('status' => 503));
    }
    $value = json_decode((string) $request->get_body(), true);
    $user = get_user_by('id', (int) substr($value['subject'], 3));
    $allowed = $user instanceof WP_User && mmrise_sso_user_allowed($user) === true;
    $payload = wp_json_encode(array(
        'subject' => $value['subject'],
        'audience' => 'ivoc-rise-owner-projection',
        'nonce' => $value['nonce'],
        'source' => 'wordpress_current_rise_owner',
        'allowed' => $allowed,
        'admin' => $allowed && user_can($user, 'manage_options'),
        'iat' => time(),
        'exp' => time() + 30,
    ));
    $response = new WP_REST_Response(array(
        'payload' => $payload,
        'signature' => hash_hmac('sha256', "mmrise-ivoc-eligibility-response-v1\n" . $payload, mmrise_sso_secret()),
    ), 200);
    $response->header('Cache-Control', 'private, no-store, max-age=0');
    return $response;
}

add_action('rest_api_init', static function () {
    register_rest_route('missionmed-rise/v1', '/ivoc-eligibility', array(
        'methods' => 'POST',
        'permission_callback' => 'mmrise_ivoc_eligibility_permission',
        'callback' => 'mmrise_ivoc_eligibility',
    ));
});

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

    $endpoint = add_query_arg(
        array('audience' => 'rise', 'token' => $token),
        $origin . '/api/auth/session'
    );
    $response = wp_remote_get($endpoint, array(
        'timeout' => 15,
        'redirection' => 0,
        'sslverify' => true,
        'headers' => array('Accept' => 'application/json'),
    ));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        status_header(503);
        wp_die('RISE authentication is temporarily unavailable.');
    }
    $response_payload = json_decode((string) wp_remote_retrieve_body($response), true);
    if (
        !is_array($response_payload) || ($response_payload['authenticated'] ?? false) !== true ||
        ($response_payload['authAudience'] ?? '') !== 'rise' ||
        (string) ($response_payload['user']['id'] ?? '') !== (string) $user->ID
    ) {
        status_header(503);
        wp_die('RISE authentication response could not be verified.');
    }
    $set_cookie = wp_remote_retrieve_header($response, 'set-cookie');
    $set_cookie = is_array($set_cookie) ? implode(', ', $set_cookie) : (string) $set_cookie;
    if (!preg_match('/(?:^|[,\s])mmhq_session=([^;\s,]+)/', $set_cookie, $matches)) {
        status_header(503);
        wp_die('RISE authentication session was not returned.');
    }
    $session_cookie = rawurldecode((string) $matches[1]);
    if ($session_cookie === '' || strlen($session_cookie) > 16384) {
        status_header(503);
        wp_die('RISE authentication session was invalid.');
    }
    // A distinct browser cookie prevents Matrix/HQ audience sessions from
    // overwriting the RISE session. The route proxy renames it to the exact
    // mmhq_session cookie expected by HQ on the server-to-server request.
    mmrise_sso_set_cookie('mmhq_rise_session', $session_cookie, time() + 28800, true);
    mmrise_sso_set_cookie('mmed_rise_session_ready', '1', time() + 28800, true);
    mmrise_sso_set_cookie('mmed_rise_wp_nonce', wp_create_nonce('wp_rest'), time() + 43200, false);
    wp_safe_redirect(mmrise_sso_final_url());
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
