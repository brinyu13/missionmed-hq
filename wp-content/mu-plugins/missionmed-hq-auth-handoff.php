<?php
/**
 * Plugin Name: MissionMed HQ Auth Handoff
 * Description: WordPress -> Railway runtime auth handoff for Arena/STAT exchange bootstrap.
 * Version: 1.0.5
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
if (!defined('MMHQ_CAM_ADMIN_TTL_SECONDS')) {
    define('MMHQ_CAM_ADMIN_TTL_SECONDS', 900);
}
if (!defined('MMHQ_CAM_AUTHORITY_TTL_SECONDS')) {
    define('MMHQ_CAM_AUTHORITY_TTL_SECONDS', 300);
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
    $hosts = array(
        'missionmed-hq-production.up.railway.app',
        'cam-hq-production-cam-production.up.railway.app',
    );
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
    $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    $port = wp_parse_url($url, PHP_URL_PORT);
    $user = (string) wp_parse_url($url, PHP_URL_USER);
    $pass = (string) wp_parse_url($url, PHP_URL_PASS);
    if ($scheme !== 'https' || $host === '' || $user !== '' || $pass !== '' || ($port !== null && (int) $port !== 443)) {
        return false;
    }
    return in_array($host, mmhq_handoff_allowed_return_hosts(), true);
}

function mmhq_handoff_is_allowed_cam_return_url($url) {
    if (!mmhq_handoff_is_allowed_return_url($url)) {
        return false;
    }

    $path = (string) wp_parse_url((string) $url, PHP_URL_PATH);
    $query = (string) wp_parse_url((string) $url, PHP_URL_QUERY);
    $values = array();
    parse_str($query, $values);
    $allowed_keys = array('audience', 'final', 'state');

    if ('/api/auth/session' !== rtrim($path, '/')) {
        return false;
    }
    if ('cam' !== sanitize_key((string) ($values['audience'] ?? ''))) {
        return false;
    }
    foreach (array_keys($values) as $key) {
        if (!in_array((string) $key, $allowed_keys, true)) {
            return false;
        }
    }
    if (isset($values['state']) && !preg_match('/^[A-Za-z0-9_-]{32,96}$/', (string) $values['state'])) {
        return false;
    }
    return true;
}

function mmhq_handoff_state_from_return_url($url) {
    $query = (string) wp_parse_url((string) $url, PHP_URL_QUERY);
    if ($query === '') {
        return '';
    }
    $values = array();
    parse_str($query, $values);
    $state = isset($values['state']) ? (string) $values['state'] : '';
    return preg_match('/^[A-Za-z0-9_-]{32,96}$/', $state) ? $state : '';
}

function mmhq_cam_is_allowed_logout_return_url($url) {
    if (!mmhq_handoff_is_allowed_return_url($url)) {
        return false;
    }

    $path = (string) wp_parse_url((string) $url, PHP_URL_PATH);
    $query = (string) wp_parse_url((string) $url, PHP_URL_QUERY);
    $fragment = (string) wp_parse_url((string) $url, PHP_URL_FRAGMENT);
    return '/cam' === rtrim($path, '/') && '' === $query && '' === $fragment;
}

function mmhq_handoff_allowed_final_hosts() {
    $hosts = array(
        'missionmedinstitute.com',
        'www.missionmedinstitute.com',
        'missionmed-hq-production.up.railway.app',
        'cam-hq-production-cam-production.up.railway.app',
    );
    $hosts = array_merge($hosts, mmhq_handoff_csv_setting('MMHQ_HANDOFF_ALLOWED_FINAL_HOSTS', 'MMHQ_HANDOFF_ALLOWED_FINAL_HOSTS', ''));
    $wp_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    if ($wp_host !== '') {
        $hosts[] = $wp_host;
    }
    return array_values(array_unique(array_filter($hosts)));
}

function mmhq_handoff_nested_hq_final($return_to, $audience = '') {
    if (sanitize_key((string) $audience) !== '') {
        return '';
    }
    if (!mmhq_handoff_is_allowed_return_url($return_to)) {
        return '';
    }

    $host = strtolower((string) wp_parse_url((string) $return_to, PHP_URL_HOST));
    $path = rtrim((string) wp_parse_url((string) $return_to, PHP_URL_PATH), '/');
    $query = (string) wp_parse_url((string) $return_to, PHP_URL_QUERY);
    $fragment = (string) wp_parse_url((string) $return_to, PHP_URL_FRAGMENT);
    if (
        $host !== 'missionmed-hq-production.up.railway.app'
        || $path !== '/api/auth/session'
        || $query === ''
        || $fragment !== ''
    ) {
        return '';
    }

    $values = array();
    parse_str($query, $values);
    if (array_keys($values) !== array('final')) {
        return '';
    }
    return is_string($values['final']) ? $values['final'] : '';
}

function mmhq_handoff_is_allowed_cam_final_url($url) {
    $url = (string) $url;
    $scheme = strtolower((string) wp_parse_url($url, PHP_URL_SCHEME));
    $host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));
    $path = (string) wp_parse_url($url, PHP_URL_PATH);
    $query = (string) wp_parse_url($url, PHP_URL_QUERY);
    $fragment = (string) wp_parse_url($url, PHP_URL_FRAGMENT);
    $port = wp_parse_url($url, PHP_URL_PORT);
    $user = (string) wp_parse_url($url, PHP_URL_USER);
    $pass = (string) wp_parse_url($url, PHP_URL_PASS);
    if (
        $scheme !== 'https'
        || $host !== 'cam-hq-production-cam-production.up.railway.app'
        || $path !== '/cam/'
        || $fragment !== ''
        || $user !== ''
        || $pass !== ''
        || ($port !== null && (int) $port !== 443)
    ) {
        return false;
    }

    $values = array();
    parse_str($query, $values);
    foreach (array_keys($values) as $key) {
        if (!in_array((string) $key, array('entry', 'return_to'), true)) {
            return false;
        }
    }
    if ($query === '') {
        return true;
    }

    $entry = sanitize_key((string) ($values['entry'] ?? ''));
    $return_to = esc_url_raw((string) ($values['return_to'] ?? ''));
    if (!in_array($entry, array('matrix', 'arena'), true) || $return_to === '') {
        return false;
    }
    $return_scheme = strtolower((string) wp_parse_url($return_to, PHP_URL_SCHEME));
    $return_host = strtolower((string) wp_parse_url($return_to, PHP_URL_HOST));
    $return_path = rtrim((string) wp_parse_url($return_to, PHP_URL_PATH), '/');
    $return_query = (string) wp_parse_url($return_to, PHP_URL_QUERY);
    $return_fragment = (string) wp_parse_url($return_to, PHP_URL_FRAGMENT);
    $expected_path = $entry === 'matrix' ? '/member-dashboard' : '/arena';
    return $return_scheme === 'https'
        && in_array($return_host, array('missionmedinstitute.com', 'www.missionmedinstitute.com'), true)
        && $return_path === $expected_path
        && $return_query === ''
        && ($entry === 'matrix' ? in_array($return_fragment, array('', 'dashboard'), true) : $return_fragment === '');
}

function mmhq_handoff_starts_with_slash($value) {
    $value = (string) $value;
    return isset($value[0]) && $value[0] === '/';
}

function mmhq_handoff_normalize_final($raw_final, $audience = '') {
    $is_cam = 'cam' === sanitize_key((string) $audience);
    $fallback = $is_cam
        ? 'https://cam-hq-production-cam-production.up.railway.app/cam/'
        : mmhq_handoff_default_final();
    $raw_final = trim((string) $raw_final);
    if ($raw_final === '') {
        return $fallback;
    }

    if (mmhq_handoff_starts_with_slash($raw_final)) {
        return $is_cam ? '' : home_url($raw_final);
    }

    $candidate = esc_url_raw($raw_final);
    if ($candidate === '') {
        return $is_cam ? '' : $fallback;
    }

    $scheme = strtolower((string) wp_parse_url($candidate, PHP_URL_SCHEME));
    $host = strtolower((string) wp_parse_url($candidate, PHP_URL_HOST));
    $port = wp_parse_url($candidate, PHP_URL_PORT);
    $user = (string) wp_parse_url($candidate, PHP_URL_USER);
    $pass = (string) wp_parse_url($candidate, PHP_URL_PASS);
    if (
        $scheme !== 'https'
        || $host === ''
        || $user !== ''
        || $pass !== ''
        || ($port !== null && (int) $port !== 443)
        || !in_array($host, mmhq_handoff_allowed_final_hosts(), true)
    ) {
        return $is_cam ? '' : $fallback;
    }
    if ($is_cam && !mmhq_handoff_is_allowed_cam_final_url($candidate)) {
        return '';
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
        return array('source_available' => false, 'matched' => false, 'verified' => false, 'refunded' => false, 'cancelled' => false, 'pending' => false);
    }

    $user = function_exists('get_userdata') ? get_userdata(absint($user_id)) : null;
    $orders_by_id = array();
    $base_query = array(
        'status' => array('pending', 'on-hold', 'processing', 'completed', 'refunded', 'cancelled', 'failed'),
        'limit' => -1,
    );
    $queries = array(array('customer_id' => absint($user_id)));
    if (is_object($user) && isset($user->user_email) && trim((string) $user->user_email) !== '') {
        $queries[] = array('billing_email' => (string) $user->user_email);
    }

    foreach ($queries as $identity_query) {
        $orders = wc_get_orders(array_merge($base_query, $identity_query));
        if (!is_array($orders)) {
            return array('source_available' => false, 'matched' => false, 'verified' => false, 'refunded' => false, 'cancelled' => false, 'pending' => false);
        }
        foreach ($orders as $order) {
            if (!is_object($order)) {
                continue;
            }
            $order_id = method_exists($order, 'get_id') ? absint($order->get_id()) : 0;
            $orders_by_id[$order_id > 0 ? $order_id : spl_object_hash($order)] = $order;
        }
    }

    $matched = false;
    $matched_active = false;
    $matched_refund = false;
    $matched_cancelled = false;
    $matched_pending = false;
    foreach ($orders_by_id as $order) {
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
        $matched = true;

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
        if (in_array($order_status, array('pending', 'on-hold'), true)) {
            $matched_pending = true;
            continue;
        }
        if (in_array($order_status, array('', 'processing', 'completed'), true)) {
            $matched_active = true;
        }
    }

    return array(
        'source_available' => true,
        'matched' => $matched,
        'verified' => $matched_active,
        'refunded' => !$matched_active && $matched_refund,
        'cancelled' => !$matched_active && !$matched_refund && $matched_cancelled,
        'pending' => !$matched_active && !$matched_refund && !$matched_cancelled && $matched_pending,
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
    $source_available = !empty($course_state['source_available']) && !empty($purchase_state['source_available']);
    $current_enrollment = $source_available && !empty($course_state['current_course_ids']);
    $purchase_disqualified = !empty($purchase_state['refunded']) || !empty($purchase_state['cancelled']) || !empty($purchase_state['pending']);
    $purchase_verified = !empty($purchase_state['verified']);
    $legacy_enrollment = $current_enrollment && empty($purchase_state['matched']);
    $enrollment_verified = $current_enrollment && ($purchase_verified || $legacy_enrollment) && !$purchase_disqualified;
    $authority_mode = $purchase_verified
        ? 'learndash_and_woocommerce'
        : ($legacy_enrollment && !$purchase_disqualified ? 'learndash_current_access' : '');
    $revoked = !$restricted && !$expired && !empty($course_state['revoked']);
    $active = !$restricted
        && !$expired
        && !$revoked
        && $source_available
        && $enrollment_verified
        && $authority_mode !== '';

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

    $authority_ttl = min(900, max(60, absint(MMHQ_CAM_AUTHORITY_TTL_SECONDS)));

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
        'purchase_verified' => $purchase_verified,
        'purchase_match_found' => !empty($purchase_state['matched']),
        'enrollment_verified' => $enrollment_verified,
        'authority_mode' => $authority_mode,
        'revocation_checked' => $source_available,
        'expires_at' => (string) $course_state['expires_at'],
        'authority_expires_at' => gmdate('c', time() + $authority_ttl),
        'evaluated_at' => gmdate('c'),
    );
}

function mmhq_cam_build_admin_override($wp_user) {
    $user_id = is_object($wp_user) && isset($wp_user->ID) ? absint($wp_user->ID) : 0;
    $is_administrator = $user_id > 0 && user_can($user_id, 'manage_options');
    $ttl = min(3600, max(60, absint(MMHQ_CAM_ADMIN_TTL_SECONDS)));
    $reviewer_label = is_object($wp_user) && isset($wp_user->display_name)
        ? sanitize_text_field((string) $wp_user->display_name)
        : '';

    return array(
        'product' => 'cam',
        'allowed' => $is_administrator,
        'capability' => 'manage_options',
        'verified' => true,
        'trusted' => true,
        'source' => 'wordpress_learndash_handoff',
        'reviewer_label' => $is_administrator && $reviewer_label !== '' ? $reviewer_label : 'MissionMed reviewer',
        'revoked' => !$is_administrator,
        'evaluated_at' => gmdate('c'),
        'expires_at' => gmdate('c', time() + $ttl),
    );
}

function mmhq_handoff_build_token_payload($wp_user, $audience = '', $handoff_state = '') {
    return array(
        'wp_user_id' => (int) $wp_user->ID,
        'email' => (string) $wp_user->user_email,
        'username' => (string) $wp_user->user_login,
        'display_name' => (string) $wp_user->display_name,
        'roles' => array_values((array) $wp_user->roles),
        'cam_entitlement' => mmhq_cam_build_entitlement((int) $wp_user->ID),
        'cam_admin_override' => mmhq_cam_build_admin_override($wp_user),
        'aud' => sanitize_key((string) $audience),
        'iat' => time(),
        'exp' => time() + (int) MMHQ_HANDOFF_TTL_SECONDS,
        'nonce' => wp_generate_uuid4(),
        'handoff_state' => 'cam' === sanitize_key((string) $audience) ? (string) $handoff_state : '',
    );
}

function mmhq_handoff_audience_from_return_url($url) {
    $query = (string) wp_parse_url((string) $url, PHP_URL_QUERY);
    if ($query === '') {
        return '';
    }
    $values = array();
    parse_str($query, $values);
    return sanitize_key((string) ($values['audience'] ?? ''));
}

function mmhq_handoff_post_assertion($target, $token, $final) {
    $target = esc_url_raw((string) $target);
    if (!mmhq_handoff_is_allowed_return_url($target)) {
        status_header(400);
        wp_die('Invalid handoff target.');
    }

    $nonce = wp_generate_password(24, false, false);
    $parts = wp_parse_url($target);
    $origin = 'https://' . strtolower((string) ($parts['host'] ?? ''));
    if (!empty($parts['port']) && (int) $parts['port'] !== 443) {
        $origin .= ':' . absint($parts['port']);
    }

    status_header(200);
    nocache_headers();
    header('Referrer-Policy: no-referrer');
    header("Content-Security-Policy: default-src 'none'; base-uri 'none'; form-action " . $origin . "; script-src 'nonce-" . $nonce . "'");
    echo '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>MissionMed secure handoff</title></head><body>';
    echo '<form id="mmhq-handoff" method="post" action="' . esc_url($target) . '">';
    echo '<input type="hidden" name="token" value="' . esc_attr((string) $token) . '">';
    echo '<input type="hidden" name="final" value="' . esc_attr((string) $final) . '">';
    echo '<noscript><button type="submit">Continue to MissionMed</button></noscript></form>';
    echo '<script nonce="' . esc_attr($nonce) . '">document.getElementById("mmhq-handoff").submit();</script></body></html>';
    exit;
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

    $wp_user = wp_get_current_user();
    $audience = mmhq_handoff_audience_from_return_url($return_to);
    if ('cam' === $audience && !mmhq_handoff_is_allowed_cam_return_url($return_to)) {
        status_header(400);
        wp_die('Invalid CAM handoff target.');
    }

    // LOR Studio uses an exact audience on both the outer request and the
    // callback. Any one-sided LOR signal is a downgrade attempt and fails
    // closed before the established CAM/Arena/HQ token path can run.
    $audience_raw = isset($_GET['audience']) && is_string($_GET['audience'])
        ? wp_unslash($_GET['audience'])
        : '';
    if ('lor-studio' === $audience_raw) {
        if ('lor-studio' !== $audience) {
            status_header(400);
            wp_die('Invalid LOR Studio handoff target.');
        }
        if (!function_exists('mmhq_lor_studio_issue_browser_bootstrap_code')) {
            status_header(503);
            wp_die('LOR Studio access is unavailable.');
        }

        // The browser receives only a short-lived opaque one-time code. The
        // signed S2S redemption keeps identity and entitlement evidence off
        // the URL and out of browser-readable storage.
        $identity_class = 'student';
        if (isset($_GET['identity_class'])) {
            $identity_class = is_string($_GET['identity_class'])
                ? (string) wp_unslash($_GET['identity_class'])
                : '';
        }
        if (!in_array($identity_class, array('student', 'faculty_candidate'), true)) {
            status_header(403);
            wp_die('LOR Studio access is unavailable.');
        }

        $issued = mmhq_lor_studio_issue_browser_bootstrap_code(
            $wp_user,
            $return_to,
            $identity_class
        );
        if (is_wp_error($issued) || !is_array($issued) || empty($issued['code']) || empty($issued['callback'])) {
            $failure_status = 403;
            if (is_wp_error($issued) && method_exists($issued, 'get_error_data')) {
                $failure_data = $issued->get_error_data();
                if (is_array($failure_data) && 503 === ($failure_data['status'] ?? null)) {
                    $failure_status = 503;
                }
            }
            status_header($failure_status);
            wp_die('LOR Studio access is unavailable.');
        }

        $target = add_query_arg(array('code' => $issued['code']), $issued['callback']);
        if (function_exists('nocache_headers')) {
            nocache_headers();
        }
        wp_safe_redirect($target, 303);
        exit;
    }
    if ('lor-studio' === $audience) {
        status_header(400);
        wp_die('Invalid LOR Studio handoff target.');
    }
    $final_raw = isset($_GET['final']) ? (string) wp_unslash($_GET['final']) : '';
    if (trim($final_raw) === '') {
        $final_raw = mmhq_handoff_nested_hq_final($return_to, $audience);
    }
    $final = mmhq_handoff_normalize_final($final_raw, $audience);
    if ('cam' === $audience && $final === '') {
        status_header(400);
        wp_die('Invalid CAM final target.');
    }
    $handoff_state = 'cam' === $audience ? mmhq_handoff_state_from_return_url($return_to) : '';
    $payload = mmhq_handoff_build_token_payload($wp_user, $audience, $handoff_state);
    $payload_json = wp_json_encode($payload);
    if (!is_string($payload_json) || $payload_json === '') {
        status_header(500);
        wp_die('Failed to encode handoff payload.');
    }

    $body = rtrim(strtr(base64_encode($payload_json), '+/', '-_'), '=');
    $signature = hash_hmac('sha256', $body, $secret);
    $token = $body . '.' . $signature;

    // The current HQ does not emit state and still expects the legacy GET
    // transport. The hardened HQ emits state, which upgrades CAM to POST
    // without creating a broken intermediate deployment window.
    if ('cam' === $audience && $handoff_state !== '') {
        mmhq_handoff_post_assertion($return_to, $token, $final);
    }

    // Preserve the established non-CAM Arena/STAT handoff contract. Those
    // runtimes do not accept a form POST. State-bearing CAM callbacks use the
    // hardened POST above; state-less CAM callbacks exist only for rollout
    // compatibility with the previous HQ and are rejected by the new HQ.
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

function mmhq_cam_logout_nonce_option_name($nonce) {
    return 'mmhq_cam_logout_nonce_' . hash('sha256', (string) $nonce);
}

function mmhq_cam_cleanup_logout_nonce($option_name) {
    $option_name = sanitize_key((string) $option_name);
    if (strpos($option_name, 'mmhq_cam_logout_nonce_') !== 0) {
        return;
    }
    delete_option($option_name);
}
add_action('mmhq_cam_cleanup_logout_nonce', 'mmhq_cam_cleanup_logout_nonce', 10, 1);

function mmhq_cam_consume_logout_nonce($nonce, $expires_at) {
    $option_name = mmhq_cam_logout_nonce_option_name($nonce);
    if (!add_option($option_name, (int) $expires_at, '', 'no')) {
        return false;
    }
    wp_schedule_single_event(max(time() + 60, (int) $expires_at + 60), 'mmhq_cam_cleanup_logout_nonce', array($option_name));
    return true;
}

function mmhq_cam_verify_logout_state($state, $return_to) {
    $secret = mmhq_handoff_secret();
    $parts = explode('.', (string) $state, 2);
    if ($secret === '' || count($parts) !== 2 || !preg_match('/^[A-Za-z0-9_-]+$/', $parts[0]) || !preg_match('/^[a-f0-9]{64}$/i', $parts[1])) {
        return false;
    }
    if (!hash_equals(hash_hmac('sha256', $parts[0], $secret), strtolower($parts[1]))) {
        return false;
    }

    $encoded = strtr($parts[0], '-_', '+/');
    $padding = strlen($encoded) % 4;
    if ($padding > 0) {
        $encoded .= str_repeat('=', 4 - $padding);
    }
    $payload = json_decode((string) base64_decode($encoded, true), true);
    $now = time();
    if (
        !is_array($payload)
        || 'cam_logout' !== (string) ($payload['action'] ?? '')
        || (int) ($payload['iat'] ?? 0) > $now + 30
        || (int) ($payload['exp'] ?? 0) < $now
        || (int) ($payload['exp'] ?? 0) - (int) ($payload['iat'] ?? 0) > 60
        || !hash_equals((string) ($payload['return_to'] ?? ''), (string) $return_to)
        || !preg_match('/^[0-9a-f-]{36}$/i', (string) ($payload['nonce'] ?? ''))
        || (int) ($payload['wp_user_id'] ?? 0) <= 0
        || (int) get_current_user_id() !== (int) ($payload['wp_user_id'] ?? 0)
    ) {
        return false;
    }
    return mmhq_cam_consume_logout_nonce((string) $payload['nonce'], (int) $payload['exp']);
}

function mmhq_cam_logout_handle() {
    if (!isset($_GET['mmhq_cam_logout']) || '1' !== sanitize_key(wp_unslash($_GET['mmhq_cam_logout']))) {
        return;
    }

    $return_to = isset($_GET['return_to']) ? esc_url_raw((string) wp_unslash($_GET['return_to'])) : '';
    $state = isset($_GET['state']) ? (string) wp_unslash($_GET['state']) : '';
    if (!mmhq_cam_is_allowed_logout_return_url($return_to) || !mmhq_cam_verify_logout_state($state, $return_to)) {
        status_header(400);
        wp_die('Invalid CAM logout request.');
    }

    wp_logout();
    mmhq_handoff_clear_login_state();
    wp_redirect($return_to, 302, 'MissionMed CAM Logout');
    exit;
}
add_action('init', 'mmhq_cam_logout_handle', 1);

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
