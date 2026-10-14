<?php
/** Plugin Name: MissionMed Matrix Appearance V1
 * DR-443: isolated self-only preference and Dashboard-native first consumer.
 */
if (!defined('ABSPATH')) { exit; }

final class MMED_Matrix_Appearance_V1 {
    const KEY = '_mmed_matrix_appearance_v1';
    const ROUTE = '/mmed/v1/me/appearance';
    const MODES = array('dark', 'light', 'auto');

    public static function enabled() {
        return !defined('MMED_MATRIX_APPEARANCE_V1_DISABLED') || !MMED_MATRIX_APPEARANCE_V1_DISABLED;
    }
    public static function init() {
        add_action('rest_api_init', array(__CLASS__, 'routes'));
        add_filter('rest_post_dispatch', array(__CLASS__, 'response_headers'), 10, 3);
        add_action('template_redirect', array(__CLASS__, 'page_headers'), 1);
        add_action('wp_enqueue_scripts', array(__CLASS__, 'assets'), 120);
        add_action('wp_head', array(__CLASS__, 'head'), 1);
    }
    private static function error($code, $status, $snapshot = null) {
        $data = array('status' => $status);
        if ($snapshot !== null) { $data['snapshot'] = $snapshot; }
        return new WP_Error('mmed_appearance_' . $code, 'Appearance could not be confirmed. Please reload and try again.', $data);
    }
    public static function permission($request) {
        if (!self::enabled()) { return self::error('unavailable', 503); }
        $uid = get_current_user_id();
        $cookie = wp_validate_auth_cookie('', 'logged_in');
        if (!$uid || !is_user_logged_in() || (int) $cookie !== (int) $uid) { return self::error('auth_required', 401); }
        $nonce = $request->get_header('X-WP-Nonce');
        if (!$nonce || !wp_verify_nonce($nonce, 'wp_rest')) { return self::error('csrf_denied', 403); }
        if ($request->get_query_params()) { return self::error('invalid_request', 400); }
        if ($request->get_method() === 'GET') {
            return trim($request->get_body()) === '' ? true : self::error('invalid_request', 400);
        }
        if ($request->get_method() !== 'POST') { return self::error('invalid_request', 400); }
        $type = strtolower(trim(explode(';', (string) $request->get_header('content-type'))[0]));
        if ($type !== 'application/json') { return self::error('invalid_request', 400); }
        $body = json_decode($request->get_body());
        if (!is_object($body) || !($body instanceof stdClass)) { return self::error('invalid_request', 400); }
        $fields = get_object_vars($body);
        if (array_keys($fields) !== array('mode') || !is_string($fields['mode']) || !in_array($fields['mode'], self::MODES, true)) {
            return self::error('invalid_request', 400);
        }
        return true;
    }
    private static function value($mode, $state) {
        return array('contract' => 'matrix.appearance.preference.v1', 'version' => 1,
            'mode' => $mode, 'revision' => 'v1:' . ($state === 'valid' ? $mode : $state),
            'auto_policy' => 'os-browser', 'state' => $state);
    }
    public static function snapshot() {
        global $wpdb;
        $uid = get_current_user_id();
        if (!$uid) { return self::error('auth_required', 401); }
        // Native metadata cache only for this authenticated subject; no raw SQL.
        $wpdb->last_error = '';
        wp_cache_delete($uid, 'user_meta');
        $values = get_user_meta($uid, self::KEY, false);
        if ($wpdb->last_error !== '' || !is_array($values)) { return self::error('unavailable', 503); }
        if (!$values) { return self::value('dark', 'absent'); }
        foreach ($values as $v) {
            if (!is_string($v) || !in_array($v, self::MODES, true)) { return self::value('dark', 'invalid'); }
        }
        $unique = array_values(array_unique($values));
        return count($unique) === 1 ? self::value($unique[0], 'valid') : self::value('dark', 'ambiguous');
    }
    public static function get($request) {
        $allowed = self::permission($request);
        if (is_wp_error($allowed)) { return $allowed; }
        $snapshot = self::snapshot();
        return is_wp_error($snapshot) ? $snapshot : new WP_REST_Response($snapshot, 200);
    }
    public static function save($request) {
        $allowed = self::permission($request);
        if (is_wp_error($allowed)) { return $allowed; }
        $before = self::snapshot();
        if (is_wp_error($before)) { return $before; }
        if ($before['state'] === 'invalid') { return self::error('invalid_record', 409, $before); }
        $mode = json_decode($request->get_body())->mode;
        global $wpdb;
        $wpdb->last_error = '';
        // No caller-supplied subject/key, prev_value, CAS, lock or raw DB write.
        $result = update_user_meta(get_current_user_id(), self::KEY, $mode);
        $write_error = $wpdb->last_error !== '';
        $after = self::snapshot();
        if ($write_error || is_wp_error($after)) { return self::error('unavailable', 503); }
        if ($after['state'] === 'invalid') { return self::error('invalid_record', 409, $after); }
        if ($after['state'] === 'ambiguous' || ($after['state'] === 'valid' && $after['mode'] !== $mode)) {
            return self::error('superseded', 409, $after);
        }
        if ($after['state'] !== 'valid' || $after['mode'] !== $mode) { return self::error('unavailable', 503); }
        // A native false plus clean matching persisted readback is an unchanged
        // confirmed choice; never expose/claim that a new write occurred.
        return new WP_REST_Response($after, 200);
    }
    public static function routes() {
        register_rest_route('mmed/v1', '/me/appearance', array(
            array('methods' => 'GET', 'permission_callback' => array(__CLASS__, 'permission'), 'callback' => array(__CLASS__, 'get')),
            array('methods' => 'POST', 'permission_callback' => array(__CLASS__, 'permission'), 'callback' => array(__CLASS__, 'save'))
        ));
    }
    public static function response_headers($response, $server, $request) {
        if ($request->get_route() === self::ROUTE && $response instanceof WP_REST_Response) {
            $response->header('Cache-Control', 'private, no-store, max-age=0');
            $response->header('Vary', 'Cookie');
        }
        return $response;
    }
    public static function page() {
        if (!self::enabled() || !is_user_logged_in() || !get_current_user_id() ||
            (int) wp_validate_auth_cookie('', 'logged_in') !== (int) get_current_user_id()) { return false; }
        $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        return in_array($path, array('/member-dashboard', '/member-dashboard/'), true) &&
            class_exists('MMED_Dashboard_Experience') && MMED_Dashboard_Experience::resolve() === 'matrix2';
    }
    public static function page_headers() {
        if (self::page() && !headers_sent()) { nocache_headers(); header('Cache-Control: private, no-store, max-age=0'); header('Vary: Cookie', false); }
    }
    public static function assets() {
        if (!self::page()) { return; }
        $path = __DIR__ . '/missionmed-matrix-appearance-v1/dashboard.js';
        if (is_file($path)) {
            wp_enqueue_script('mmed-matrix-appearance-v1', content_url('/mu-plugins/missionmed-matrix-appearance-v1/dashboard.js'), array(), (string) filemtime($path), true);
        }
    }
    public static function head() {
        if (!self::page()) { return; }
        $css = __DIR__ . '/missionmed-matrix-appearance-v1/dashboard.css';
        if (!is_file($css)) { return; }
        $snapshot = self::snapshot();
        $cfg = array('url' => rest_url('mmed/v1/me/appearance'), 'nonce' => wp_create_nonce('wp_rest'),
            'available' => !is_wp_error($snapshot), 'snapshot' => is_wp_error($snapshot) ? null : $snapshot);
        echo '<style id="mmed-appearance-v1-critical" data-noptimize="1">' . file_get_contents($css) . '</style>';
        echo '<script id="mmed-appearance-v1-bootstrap" data-noptimize="1">window.mmedAppearanceV1=' .
            wp_json_encode($cfg, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) . ';' .
            '(function(){var c=window.mmedAppearanceV1,s=c.snapshot,m=s&&s.mode||"dark",q=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)");' .
            'function p(){if(location.hash&&location.hash!=="#dashboard")return;document.documentElement.setAttribute("data-mmed-dashboard-appearance",m==="auto"?(q&&q.matches?"dark":"light"):m);}' .
            'p();if(m==="auto"&&q){var f=function(){if(window.mmedAppearanceV1.snapshot)p();};if(q.addEventListener)q.addEventListener("change",f);else if(q.addListener)q.addListener(f);}})();</script>';
    }
}
MMED_Matrix_Appearance_V1::init();
