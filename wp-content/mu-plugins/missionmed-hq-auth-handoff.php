<?php
/**
 * Plugin Name: MissionMed HQ Auth Handoff
 * Description: WordPress -> Railway runtime auth handoff for Arena/STAT exchange bootstrap.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

const MMHQ_HANDOFF_ACTION = 'mmac_hq_auth_redirect';
const MMHQ_HANDOFF_TTL_SECONDS = 60;

function mmhq_handoff_secret(): string
{
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

function mmhq_handoff_default_final(): string
{
    return home_url('/arena?just_logged_in=1');
}

function mmhq_handoff_login_url(string $requestUri): string
{
    return add_query_arg(
        'redirect_to',
        rawurlencode($requestUri),
        home_url('/my-account/')
    );
}

function mmhq_handoff_allowed_return_hosts(): array
{
    $hosts = ['missionmed-hq-production.up.railway.app'];
    $wpHost = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if ($wpHost !== '') {
        $hosts[] = $wpHost;
    }
    if ($wpHost === 'missionmedinstitute.com') {
        $hosts[] = 'www.missionmedinstitute.com';
    }
    return array_values(array_unique(array_filter($hosts)));
}

function mmhq_handoff_is_allowed_return_url(string $url): bool
{
    if ($url === '') {
        return false;
    }
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    if ($host === '') {
        return false;
    }
    return in_array($host, mmhq_handoff_allowed_return_hosts(), true);
}

function mmhq_handoff_allowed_final_hosts(): array
{
    $hosts = ['missionmedinstitute.com', 'www.missionmedinstitute.com'];
    $wpHost = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if ($wpHost !== '') {
        $hosts[] = $wpHost;
    }
    return array_values(array_unique(array_filter($hosts)));
}

function mmhq_handoff_normalize_final(string $rawFinal): string
{
    $fallback = mmhq_handoff_default_final();
    $rawFinal = trim($rawFinal);
    if ($rawFinal === '') {
        return $fallback;
    }

    if (str_starts_with($rawFinal, '/')) {
        return home_url($rawFinal);
    }

    $candidate = esc_url_raw($rawFinal);
    if ($candidate === '') {
        return $fallback;
    }
    $host = strtolower((string) wp_parse_url($candidate, PHP_URL_HOST));
    if ($host === '' || !in_array($host, mmhq_handoff_allowed_final_hosts(), true)) {
        return $fallback;
    }
    return $candidate;
}

function mmhq_handoff_handle(): void
{
    $requestUri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';

    if (!is_user_logged_in()) {
        wp_safe_redirect(mmhq_handoff_login_url($requestUri));
        exit;
    }

    $secret = mmhq_handoff_secret();
    if ($secret === '') {
        status_header(503);
        wp_die('MissionMed handoff secret is not configured.');
    }

    $returnToRaw = isset($_GET['return_to']) ? (string) wp_unslash($_GET['return_to']) : '';
    $returnTo = esc_url_raw($returnToRaw);
    if (!mmhq_handoff_is_allowed_return_url($returnTo)) {
        status_header(400);
        wp_die('Invalid return_to target.');
    }

    $finalRaw = isset($_GET['final']) ? (string) wp_unslash($_GET['final']) : '';
    $final = mmhq_handoff_normalize_final($finalRaw);

    $wpUser = wp_get_current_user();
    $payload = [
        'wp_user_id' => (int) $wpUser->ID,
        'email' => (string) $wpUser->user_email,
        'username' => (string) $wpUser->user_login,
        'display_name' => (string) $wpUser->display_name,
        'roles' => array_values((array) $wpUser->roles),
        'iat' => time(),
        'exp' => time() + MMHQ_HANDOFF_TTL_SECONDS,
        'nonce' => wp_generate_uuid4(),
    ];

    $payloadJson = wp_json_encode($payload);
    if (!is_string($payloadJson) || $payloadJson === '') {
        status_header(500);
        wp_die('Failed to encode handoff payload.');
    }

    $body = rtrim(strtr(base64_encode($payloadJson), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $body, $secret);
    $token = $body . '.' . $signature;

    $target = add_query_arg(
        [
            'token' => $token,
            'final' => $final,
        ],
        $returnTo
    );

    wp_safe_redirect($target);
    exit;
}

add_action('admin_post_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle');
add_action('admin_post_nopriv_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle');
