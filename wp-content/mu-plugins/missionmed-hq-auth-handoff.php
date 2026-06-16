<?php
/**
 * Plugin Name: MissionMed HQ Auth Handoff
 * Description: WordPress -> Railway runtime auth handoff for Arena/STAT exchange bootstrap.
 * Version: 1.0.1
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('MMHQ_HANDOFF_ACTION')) {
    define('MMHQ_HANDOFF_ACTION', 'mmac_hq_auth_redirect');
}
if (!defined('MMHQ_HANDOFF_TTL_SECONDS')) {
    define('MMHQ_HANDOFF_TTL_SECONDS', 60);
}

function mmhq_handoff_secret() {
    $env = trim((string) getenv('MMHQ_HANDOFF_SECRET'));
    if ($env !== '') {
        return $env;
    }
    if (defined('MMHQ_HANDOFF_SECRET')) {
        $constant = trim((string) MMHQ_HANDOFF_SECRET);
        if ($constant !== '') {
            return $constant;
        }
    }
    return '';
}

function mmhq_handoff_default_final() {
    return home_url('/arena?just_logged_in=1');
}

function mmhq_handoff_login_url($request_uri) {
    return add_query_arg(
        'redirect_to',
        rawurlencode((string) $request_uri),
        home_url('/my-account/')
    );
}

function mmhq_handoff_allowed_return_hosts() {
    $hosts = array('missionmed-hq-production.up.railway.app');
    $wp_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if ($wp_host !== '') {
        $hosts[] = $wp_host;
    }
    if ($wp_host === 'missionmedinstitute.com') {
        $hosts[] = 'www.missionmedinstitute.com';
    }
    return array_values(array_unique(array_filter($hosts)));
}

function mmhq_handoff_is_allowed_return_url($url) {
    $url = (string) $url;
    if ($url === '') {
        return false;
    }
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    if ($host === '') {
        return false;
    }
    return in_array($host, mmhq_handoff_allowed_return_hosts(), true);
}

function mmhq_handoff_allowed_final_hosts() {
    $hosts = array('missionmedinstitute.com', 'www.missionmedinstitute.com');
    $wp_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if ($wp_host !== '') {
        $hosts[] = $wp_host;
    }
    return array_values(array_unique(array_filter($hosts)));
}

function mmhq_handoff_starts_with_slash($value) {
    $value = (string) $value;
    return isset($value[0]) && $value[0] === '/';
}

function mmhq_handoff_normalize_final($raw_final) {
    $fallback = mmhq_handoff_default_final();
    $raw_final = trim((string) $raw_final);
    if ($raw_final === '') {
        return $fallback;
    }

    if (mmhq_handoff_starts_with_slash($raw_final)) {
        return home_url($raw_final);
    }

    $candidate = esc_url_raw($raw_final);
    if ($candidate === '') {
        return $fallback;
    }

    $host = strtolower((string) wp_parse_url($candidate, PHP_URL_HOST));
    if ($host === '' || !in_array($host, mmhq_handoff_allowed_final_hosts(), true)) {
        return $fallback;
    }

    return $candidate;
}

function mmhq_handoff_build_token_payload($wp_user) {
    return array(
        'wp_user_id' => (int) $wp_user->ID,
        'email' => (string) $wp_user->user_email,
        'username' => (string) $wp_user->user_login,
        'display_name' => (string) $wp_user->display_name,
        'roles' => array_values((array) $wp_user->roles),
        'iat' => time(),
        'exp' => time() + (int) MMHQ_HANDOFF_TTL_SECONDS,
        'nonce' => wp_generate_uuid4(),
    );
}

function mmhq_handoff_handle() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';

    if (!is_user_logged_in()) {
        wp_safe_redirect(mmhq_handoff_login_url($request_uri));
        exit;
    }

    $secret = mmhq_handoff_secret();
    if ($secret === '') {
        status_header(503);
        wp_die('MissionMed handoff secret is not configured.');
    }

    $return_to_raw = isset($_GET['return_to']) ? (string) wp_unslash($_GET['return_to']) : '';
    $return_to = esc_url_raw($return_to_raw);
    if (!mmhq_handoff_is_allowed_return_url($return_to)) {
        status_header(400);
        wp_die('Invalid return_to target.');
    }

    $final_raw = isset($_GET['final']) ? (string) wp_unslash($_GET['final']) : '';
    $final = mmhq_handoff_normalize_final($final_raw);

    $wp_user = wp_get_current_user();
    $payload = mmhq_handoff_build_token_payload($wp_user);
    $payload_json = wp_json_encode($payload);
    if (!is_string($payload_json) || $payload_json === '') {
        status_header(500);
        wp_die('Failed to encode handoff payload.');
    }

    $body = rtrim(strtr(base64_encode($payload_json), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $body, $secret);
    $token = $body . '.' . $signature;

    $target = add_query_arg(
        array(
            'token' => $token,
            'final' => $final,
        ),
        $return_to
    );

    wp_safe_redirect($target);
    exit;
}

// Priority 1: must run before MissionMed Command Center plugin's
// handle_hq_auth_redirect handler (registered at default priority 10).
// Our handler issues wp_safe_redirect() + exit so the Command Center
// handler is bypassed, which is intentional. The Command Center handler
// signs with wp_salt('auth') which Railway cannot reproduce; this plugin
// signs with MMHQ_HANDOFF_SECRET which Railway shares.
add_action('admin_post_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle', 1);
add_action('admin_post_nopriv_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle', 1);
