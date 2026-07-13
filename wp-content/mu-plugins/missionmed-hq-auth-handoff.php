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
if (!defined('MMHQ_HANDOFF_LOGIN_STATE_COOKIE')) {
    define('MMHQ_HANDOFF_LOGIN_STATE_COOKIE', 'mmhq_handoff_login_state');
}

if (defined('MMHQ_CAM_STAGING_MEMORY_LIMIT')) {
    $mmhq_staging_memory_limit = trim((string) MMHQ_CAM_STAGING_MEMORY_LIMIT);
    if (preg_match('/^[0-9]+[MG]$/i', $mmhq_staging_memory_limit)) {
        @ini_set('memory_limit', $mmhq_staging_memory_limit);
    }
    unset($mmhq_staging_memory_limit);
}

function mmhq_handoff_is_endpoint_request() {
    $script = isset($_SERVER['SCRIPT_NAME']) ? basename((string) wp_unslash($_SERVER['SCRIPT_NAME'])) : '';
    $action = isset($_REQUEST['action']) ? sanitize_key(wp_unslash($_REQUEST['action'])) : '';
    $public = isset($_GET['mmhq_handoff']) ? sanitize_key(wp_unslash($_GET['mmhq_handoff'])) : '';
    return ('admin-post.php' === $script && MMHQ_HANDOFF_ACTION === $action) || '1' === $public;
}

function mmhq_handoff_is_login_request() {
    $script = isset($_SERVER['SCRIPT_NAME']) ? basename((string) wp_unslash($_SERVER['SCRIPT_NAME'])) : '';
    $redirect_to = isset($_REQUEST['redirect_to']) ? (string) wp_unslash($_REQUEST['redirect_to']) : '';
    $decoded = rawurldecode($redirect_to);
    return 'wp-login.php' === $script && (
        false !== strpos($decoded, 'action=' . MMHQ_HANDOFF_ACTION)
        || false !== strpos($decoded, 'mmhq_handoff=1')
        || !empty($_COOKIE[MMHQ_HANDOFF_LOGIN_STATE_COOKIE])
    );
}

function mmhq_handoff_limit_endpoint_plugins($plugins) {
    if (!is_array($plugins)) {
        return $plugins;
    }

    if (mmhq_handoff_is_login_request()) {
        return array();
    }
    if (!mmhq_handoff_is_endpoint_request()) {
        return $plugins;
    }

    $required = array(
        'woocommerce/woocommerce.php',
        'woocommerce-subscriptions/woocommerce-subscriptions.php',
        'sfwd-lms/sfwd_lms.php',
    );
    return array_values(array_filter($required, function ($plugin) use ($plugins) {
        return in_array($plugin, $plugins, true);
    }));
}
add_filter('option_active_plugins', 'mmhq_handoff_limit_endpoint_plugins', PHP_INT_MIN);

if (mmhq_handoff_is_endpoint_request()) {
    // LearnDash and WooCommerce can exceed the default 256 MB worker ceiling together.
    @ini_set('memory_limit', '384M');
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

function mmhq_handoff_set_login_state($request_uri) {
    $secret = mmhq_handoff_secret();
    if ($secret === '') {
        return;
    }

    $payload = wp_json_encode(array(
        'redirect' => (string) $request_uri,
        'exp' => time() + 300,
    ));
    if (!is_string($payload) || $payload === '') {
        return;
    }

    $body = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    $state = $body . '.' . hash_hmac('sha256', $body, $secret);
    setcookie(MMHQ_HANDOFF_LOGIN_STATE_COOKIE, $state, array(
        'expires' => time() + 300,
        'path' => '/',
        'secure' => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ));
}

function mmhq_handoff_read_login_state() {
    $state = isset($_COOKIE[MMHQ_HANDOFF_LOGIN_STATE_COOKIE]) ? (string) wp_unslash($_COOKIE[MMHQ_HANDOFF_LOGIN_STATE_COOKIE]) : '';
    $secret = mmhq_handoff_secret();
    if ($state === '' || $secret === '') {
        return '';
    }

    $parts = explode('.', $state, 2);
    if (count($parts) !== 2 || !preg_match('/^[A-Za-z0-9_-]+$/', $parts[0]) || !preg_match('/^[a-f0-9]{64}$/i', $parts[1])) {
        return '';
    }
    if (!hash_equals(hash_hmac('sha256', $parts[0], $secret), strtolower($parts[1]))) {
        return '';
    }

    $encoded = strtr($parts[0], '-_', '+/');
    $padding = strlen($encoded) % 4;
    if ($padding > 0) {
        $encoded .= str_repeat('=', 4 - $padding);
    }
    $payload = json_decode((string) base64_decode($encoded, true), true);
    if (!is_array($payload) || (int) ($payload['exp'] ?? 0) < time()) {
        return '';
    }
    return (string) ($payload['redirect'] ?? '');
}

function mmhq_handoff_clear_login_state() {
    setcookie(MMHQ_HANDOFF_LOGIN_STATE_COOKIE, '', array(
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => is_ssl(),
        'httponly' => true,
        'samesite' => 'Lax',
    ));
}

function mmhq_handoff_default_final() {
    return home_url('/arena?just_logged_in=1');
}

function mmhq_handoff_login_url($request_uri) {
    return wp_login_url((string) $request_uri);
}

function mmhq_handoff_allowed_return_hosts() {
    $hosts = array('missionmed-hq-production.up.railway.app');
    $hosts = array_merge($hosts, mmhq_handoff_csv_setting('MMHQ_HANDOFF_ALLOWED_RETURN_HOSTS', 'MMHQ_HANDOFF_ALLOWED_RETURN_HOSTS', ''));
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
    $hosts = array_merge($hosts, mmhq_handoff_csv_setting('MMHQ_HANDOFF_ALLOWED_FINAL_HOSTS', 'MMHQ_HANDOFF_ALLOWED_FINAL_HOSTS', ''));
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

function mmhq_handoff_csv_setting($env_name, $constant_name, $fallback) {
    $raw = trim((string) getenv($env_name));
    if ($raw === '' && defined($constant_name)) {
        $raw = trim((string) constant($constant_name));
    }
    if ($raw === '') {
        $raw = (string) $fallback;
    }
    return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

function mmhq_cam_360_course_ids() {
    return array_map('absint', mmhq_handoff_csv_setting('MMHQ_CAM_360_COURSE_IDS', 'MMHQ_CAM_360_COURSE_IDS', '3893'));
}

function mmhq_cam_360_program_tiers() {
    return array_map('sanitize_key', mmhq_handoff_csv_setting('MMHQ_CAM_360_PROGRAM_TIERS', 'MMHQ_CAM_360_PROGRAM_TIERS', '360elite,360elite_onboarding,360_match_mentorship'));
}

function mmhq_cam_360_product_ids() {
    $configured = array_map('absint', mmhq_handoff_csv_setting('MMHQ_CAM_360_PRODUCT_IDS', 'MMHQ_CAM_360_PRODUCT_IDS', '3575,5511'));

    if (class_exists('MMED_Access_Audit') && method_exists('MMED_Access_Audit', 'get_program_mappings') && method_exists('MMED_Access_Audit', 'get_mapping_product_ids')) {
        $mappings = MMED_Access_Audit::get_program_mappings();
        if (is_array($mappings) && !empty($mappings['360elite'])) {
            $configured = array_merge($configured, MMED_Access_Audit::get_mapping_product_ids($mappings['360elite']));
        }
    }

    return array_values(array_unique(array_filter(array_map('absint', $configured))));
}

function mmhq_cam_truthy_meta($user_id, $keys) {
    foreach ($keys as $key) {
        $value = get_user_meta($user_id, $key, true);
        if (is_bool($value)) {
            if ($value) {
                return true;
            }
            continue;
        }
        $normalized = strtolower(trim((string) $value));
        if ($normalized !== '' && !in_array($normalized, array('0', 'false', 'no', 'off'), true)) {
            return true;
        }
    }
    return false;
}

function mmhq_cam_restricted($user_id) {
    $restricted = mmhq_cam_truthy_meta(
        $user_id,
        array(
            '_mmed_drj_restricted',
            'mmed_drj_restricted',
            '_missionmed_drj_restricted',
            '_mmed_storyforge_restricted',
            '_mmed_access_overlay_drj_restricted',
        )
    );
    return (bool) apply_filters('mmhq_cam_restricted', $restricted, $user_id);
}

function mmhq_cam_order_item_product_ids($item) {
    $product_ids = array();
    if (is_object($item) && method_exists($item, 'get_product_id')) {
        $product_ids[] = (int) $item->get_product_id();
    }
    if (is_object($item) && method_exists($item, 'get_variation_id')) {
        $product_ids[] = (int) $item->get_variation_id();
    }
    return array_values(array_unique(array_filter(array_map('absint', $product_ids))));
}

function mmhq_cam_purchase_state($user_id) {
    $allowed_products = mmhq_cam_360_product_ids();
    if (empty($allowed_products) || !function_exists('wc_get_orders')) {
        return array('source_available' => false, 'verified' => false, 'refunded' => false, 'cancelled' => false);
    }

    $orders = wc_get_orders(array(
        'customer_id' => absint($user_id),
        'status'      => array('processing', 'completed', 'refunded', 'cancelled', 'failed'),
        'limit'       => -1,
    ));
    if (!is_array($orders)) {
        return array('source_available' => false, 'verified' => false, 'refunded' => false, 'cancelled' => false);
    }

    $matched_refund = false;
    $matched_cancelled = false;
    foreach ($orders as $order) {
        if (!is_object($order) || !method_exists($order, 'get_items')) {
            continue;
        }

        $matches_product = false;
        foreach ((array) $order->get_items() as $item) {
            if (!empty(array_intersect($allowed_products, mmhq_cam_order_item_product_ids($item)))) {
                $matches_product = true;
                break;
            }
        }
        if (!$matches_product) {
            continue;
        }

        $order_status = method_exists($order, 'get_status') ? sanitize_key((string) $order->get_status()) : '';
        $has_refund = 'refunded' === $order_status
            || (method_exists($order, 'get_total_refunded') && (float) $order->get_total_refunded() > 0);
        if ($has_refund) {
            $matched_refund = true;
            continue;
        }
        if (in_array($order_status, array('cancelled', 'failed'), true)) {
            $matched_cancelled = true;
            continue;
        }
        if ('' !== $order_status && !in_array($order_status, array('processing', 'completed'), true)) {
            continue;
        }

        return array('source_available' => true, 'verified' => true, 'refunded' => false, 'cancelled' => false);
    }

    return array(
        'source_available' => true,
        'verified' => false,
        'refunded' => $matched_refund,
        'cancelled' => $matched_cancelled,
    );
}

function mmhq_cam_enrolled_course_ids($user_id) {
    if (!function_exists('learndash_user_get_enrolled_courses')) {
        return array();
    }
    $course_ids = learndash_user_get_enrolled_courses($user_id);
    if (!is_array($course_ids)) {
        return array();
    }
    return array_values(array_unique(array_filter(array_map('absint', $course_ids))));
}

function mmhq_cam_historical_course_ids($user_id) {
    $historical = array();
    foreach (mmhq_cam_360_course_ids() as $course_id) {
        if (
            get_user_meta($user_id, 'learndash_course_' . $course_id . '_enrolled_at', true)
            || get_user_meta($user_id, 'course_' . $course_id . '_access_from', true)
        ) {
            $historical[] = $course_id;
        }
    }
    return array_values(array_unique(array_filter(array_map('absint', $historical))));
}

function mmhq_cam_course_state($user_id) {
    if (!function_exists('learndash_user_get_enrolled_courses') || !function_exists('sfwd_lms_has_access')) {
        return array(
            'source_available' => false,
            'current_course_ids' => array(),
            'expired_course_ids' => array(),
            'revoked' => false,
            'expires_at' => '',
        );
    }

    $allowed_courses = mmhq_cam_360_course_ids();
    $enrolled_courses = array_values(array_intersect($allowed_courses, mmhq_cam_enrolled_course_ids($user_id)));
    $historical_courses = array_values(array_unique(array_merge(
        $enrolled_courses,
        array_values(array_intersect($allowed_courses, mmhq_cam_historical_course_ids($user_id)))
    )));
    $current_courses = array();
    $expired_courses = array();
    $expires_at = '';
    $expired_from_meta = function_exists('learndash_get_expired_user_courses_from_meta')
        ? array_map('absint', (array) learndash_get_expired_user_courses_from_meta($user_id))
        : array();

    foreach ($enrolled_courses as $course_id) {
        $expired = function_exists('ld_course_access_expired')
            ? (bool) ld_course_access_expired($course_id, $user_id)
            : in_array($course_id, $expired_from_meta, true);
        if ($expired) {
            $expired_courses[] = $course_id;
            continue;
        }
        if (!sfwd_lms_has_access($course_id, $user_id)) {
            continue;
        }

        $current_courses[] = $course_id;
        if (function_exists('ld_course_access_expires_on')) {
            $expires_on = (int) ld_course_access_expires_on($course_id, $user_id);
            if ($expires_on > 0 && ($expires_at === '' || $expires_on < strtotime($expires_at))) {
                $expires_at = gmdate('c', $expires_on);
            }
        }
    }

    return array(
        'source_available' => true,
        'current_course_ids' => array_values(array_unique($current_courses)),
        'expired_course_ids' => array_values(array_unique($expired_courses)),
        'revoked' => !empty($historical_courses) && empty($current_courses) && empty($expired_courses),
        'expires_at' => $expires_at,
    );
}

function mmhq_cam_build_entitlement($user_id) {
    $allowed_tiers = mmhq_cam_360_program_tiers();
    $course_state = mmhq_cam_course_state($user_id);
    $purchase_state = mmhq_cam_purchase_state($user_id);
    $program_tier = sanitize_key((string) get_user_meta($user_id, '_mmed_program_tier', true));
    $matched_tier = in_array($program_tier, $allowed_tiers, true) ? $program_tier : '';
    $restricted = mmhq_cam_restricted($user_id);
    $expired = !empty($course_state['expired_course_ids']);
    $revoked = !$restricted && !$expired && (
        !empty($course_state['revoked'])
        || (!empty($course_state['current_course_ids']) && !empty($purchase_state['source_available']) && empty($purchase_state['verified']))
    );
    $source_available = !empty($course_state['source_available']) && !empty($purchase_state['source_available']);
    $active = !$restricted
        && !$expired
        && !$revoked
        && $source_available
        && !empty($course_state['current_course_ids'])
        && !empty($purchase_state['verified']);

    if ($restricted) {
        $status = 'restricted';
    } elseif ($expired) {
        $status = 'expired';
    } elseif (!empty($purchase_state['refunded'])) {
        $status = 'refunded';
    } elseif (!empty($purchase_state['cancelled'])) {
        $status = 'cancelled';
    } elseif ($revoked) {
        $status = 'revoked';
    } elseif (!$source_available) {
        $status = 'source_unavailable';
    } else {
        $status = $active ? 'active' : 'not_eligible';
    }

    return array(
        'product' => 'cam',
        'source' => 'wordpress_learndash_handoff',
        'verified' => $source_available,
        'trusted' => true,
        'active' => $active,
        'status' => $status,
        'course_ids' => array_map('strval', $course_state['current_course_ids']),
        'program_tier' => $matched_tier,
        'restricted' => $restricted,
        'revoked' => $revoked,
        'current_access_verified' => !empty($course_state['source_available']),
        'purchase_verified' => !empty($purchase_state['verified']),
        'expires_at' => (string) $course_state['expires_at'],
        'evaluated_at' => gmdate('c'),
    );
}

function mmhq_handoff_build_token_payload($wp_user) {
    return array(
        'wp_user_id' => (int) $wp_user->ID,
        'email' => (string) $wp_user->user_email,
        'username' => (string) $wp_user->user_login,
        'display_name' => (string) $wp_user->display_name,
        'roles' => array_values((array) $wp_user->roles),
        'cam_entitlement' => mmhq_cam_build_entitlement((int) $wp_user->ID),
        'iat' => time(),
        'exp' => time() + (int) MMHQ_HANDOFF_TTL_SECONDS,
        'nonce' => wp_generate_uuid4(),
    );
}

function mmhq_handoff_handle() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';

    if (!is_user_logged_in()) {
        mmhq_handoff_set_login_state($request_uri);
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

    wp_redirect($target, 302, 'MissionMed HQ Handoff');
    exit;
}

function mmhq_handoff_maybe_handle_public_route() {
    if (mmhq_handoff_is_endpoint_request() && (!isset($_REQUEST['action']) || MMHQ_HANDOFF_ACTION !== sanitize_key(wp_unslash($_REQUEST['action'])))) {
        mmhq_handoff_handle();
    }
}
add_action('init', 'mmhq_handoff_maybe_handle_public_route', 99);

function mmhq_handoff_preserve_login_redirect($redirect_to, $requested) {
    $decoded = rawurldecode((string) $requested);
    if (
        false === strpos($decoded, 'action=' . MMHQ_HANDOFF_ACTION)
        && false === strpos($decoded, 'mmhq_handoff=1')
    ) {
        return $redirect_to;
    }
    return wp_validate_redirect((string) $requested, $redirect_to);
}

function mmhq_handoff_redirect_after_login($user_login, $user) {
    $requested = isset($_REQUEST['redirect_to']) ? (string) wp_unslash($_REQUEST['redirect_to']) : '';
    $state_redirect = mmhq_handoff_read_login_state();
    if ($state_redirect !== '') {
        $requested = $state_redirect;
    }
    $decoded = rawurldecode($requested);
    if (
        false === strpos($decoded, 'action=' . MMHQ_HANDOFF_ACTION)
        && false === strpos($decoded, 'mmhq_handoff=1')
    ) {
        return;
    }

    $target = wp_validate_redirect($requested, '');
    if ($target !== '') {
        mmhq_handoff_clear_login_state();
        wp_safe_redirect($target);
        exit;
    }
}
add_action('wp_login', 'mmhq_handoff_redirect_after_login', PHP_INT_MAX, 2);

function mmhq_handoff_register_login_redirect_guard() {
    add_filter('login_redirect', 'mmhq_handoff_preserve_login_redirect', PHP_INT_MAX, 2);
}
add_action('wp_loaded', 'mmhq_handoff_register_login_redirect_guard', PHP_INT_MAX);

// Priority 1: must run before MissionMed Command Center plugin's
// handle_hq_auth_redirect handler (registered at default priority 10).
// Our handler issues wp_safe_redirect() + exit so the Command Center
// handler is bypassed, which is intentional. The Command Center handler
// signs with wp_salt('auth') which Railway cannot reproduce; this plugin
// signs with MMHQ_HANDOFF_SECRET which Railway shares.
add_action('admin_post_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle', 1);
add_action('admin_post_nopriv_' . MMHQ_HANDOFF_ACTION, 'mmhq_handoff_handle', 1);
