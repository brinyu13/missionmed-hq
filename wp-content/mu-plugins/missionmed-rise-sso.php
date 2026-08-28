<?php
/**
 * Plugin Name: MissionMed RISE SSO
 * Description: Server-side WordPress to MissionMed HQ audience=rise handoff.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
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
    $payload = array(
        'wp_user_id' => (int) $user->ID,
        'email' => (string) $user->user_email,
        'username' => (string) $user->user_login,
        'display_name' => (string) $user->display_name,
        'roles' => array_values((array) $user->roles),
        'auth_audience' => 'rise',
        'iat' => time(),
        'exp' => time() + 60,
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

add_action('admin_post_mmed_rise_auth_redirect', 'mmrise_sso_handle', 1);
add_action('admin_post_nopriv_mmed_rise_auth_redirect', 'mmrise_sso_handle', 1);
