<?php
/**
 * Plugin Name: MissionMed RLQ BFF
 * Description: WordPress session-backed BFF for RankListIQ persistence into Supabase.
 * Version: 1.0.0
 * Author: MissionMed Institute
 *
 * Internal Changelog
 * 2026-03-03 14:14 EST | Prompt #047 | Normalize boolean-like interview fields before Supabase upsert
 * - Added nullable boolean normalization for user_program_interviews payload values.
 * - Converts string markers (including "unknown") to null for boolean columns to prevent Postgres boolean syntax errors.
 * - Scope limited to user_program_interviews payload normalization only.
 * 2026-03-03 13:10 EST | Prompt #009 | Restored load response schema symmetry when no versionable snapshot found
 * - Updated load_user_payload() no-valid-snapshot return to include historical structure fields.
 * - Backward compatible: yes
 * - Endpoints unchanged: yes
 * - Response schema restored to historical structure
 * 2026-03-03 12:57 EST | Prompt #007 | Save/load version guard hardening for marker snapshot protection
 * - Hardened persist_payload() to insert ranklist_versions rows only for versionable workspace snapshots.
 * - Hardened load_user_payload() to scan latest 25 versions and select the most recent versionable snapshot.
 * - Added conservative snapshot-versionability rules that reject marker-only payloads and accept observed workspace keys.
 * - Backward compatible: yes
 * - Endpoints unchanged: yes
 * - Response schema unchanged: yes
 * 2026-03-02 | Prompt #020 | Backend-only version integrity hardening
 * - Tightened ranklist version insert guard so marker-only payloads are never versionable.
 * - Added debug-gated "version insert skipped" logging for non-versionable snapshots in persist_payload().
 * - Kept load response shape, auth, routes, constants, and frontend contracts unchanged.
 * 2026-03-02 | Prompt #1 | Prevent marker-only snapshots from becoming latest cloud version
 * - Added ranklist_snapshot_is_versionable() guard and applied it in persist_payload() so only real workspace snapshots create ranklist_versions rows.
 * - Updated load_user_payload() to fetch recent versions for the active ranklist and select the most recent versionable snapshot.
 * - Preserved save/auth/routes/constants and diagnostics; non-version sync writes still run profile/ranklist/interview upserts.
 * 2026-02-25 | Prompt #P82 | Bootstrap identity instrumentation
 * - Added WP_DEBUG-gated debug payload to /rlq/v1/bootstrap
 * - Logs current WP user, supabase UID, cookie keys, and PHP session ID
 * - No authentication or save logic modified
 * 2026-02-25 | Prompt #P82
 * - Made bootstrap profile upsert idempotent by making profile-by-id authoritative before insert.
 * - Removed bootstrap profile query pre-encoding so Supabase filters are encoded exactly once.
 * - Added 409 conflict recovery by re-fetching profile by id before returning insert failure.
 * 2026-02-24 | Prompt #139
 * - Enforced strict Supabase Auth FK model by provisioning/rehydrating auth.users UUIDs server-side.
 * - Added immutable canonical WP usermeta mapping key: missionmed_supabase_auth_uid.
 * - Added Supabase Admin API lookup/create flow on bootstrap/save path with race-safe re-checks.
 * - Added explicit cloud-unavailable REST responses when provisioning/admin API is unavailable.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Load the RankList service credential from process memory or its encrypted,
 * non-autoloaded WordPress option. Plaintext is never stored in source or DB.
 */
function missionmed_rlq_service_key() {
    $environment = getenv('MISSIONMED_SUPABASE_SERVICE_KEY');
    if (is_string($environment) && '' !== trim($environment)) {
        return trim($environment);
    }
    if (!function_exists('get_option') || !function_exists('sodium_crypto_secretbox_open')) {
        return '';
    }
    $stored = get_option('missionmed_rlq_service_key_v1', '');
    if (!is_string($stored) || 0 !== strpos($stored, 'v1:')) {
        return '';
    }
    $packed = base64_decode(substr($stored, 3), true);
    if (!is_string($packed) || strlen($packed) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES + SODIUM_CRYPTO_SECRETBOX_MACBYTES) {
        return '';
    }
    $nonce = substr($packed, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $ciphertext = substr($packed, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $root = defined('AUTH_KEY') ? (string) AUTH_KEY : (function_exists('wp_salt') ? (string) wp_salt('auth') : '');
    if ('' === $root) {
        return '';
    }
    $key = hash('sha256', $root . '|missionmed-rlq-service-key-v1', true);
    $plaintext = sodium_crypto_secretbox_open($ciphertext, $nonce, $key);
    return is_string($plaintext) ? trim($plaintext) : '';
}

// P84 – temporary bootstrap runtime debug logging
if (!defined('MISSIONMED_SUPABASE_URL')) {
    $mmed_supabase_url = getenv('MISSIONMED_SUPABASE_URL');
    define('MISSIONMED_SUPABASE_URL', is_string($mmed_supabase_url) && '' !== trim($mmed_supabase_url) ? trim($mmed_supabase_url) : 'https://fglyvdykwgbuivikqoah.supabase.co');
    unset($mmed_supabase_url);
}

if (!defined('MISSIONMED_SUPABASE_SERVICE_KEY')) {
    $mmed_supabase_service_key = missionmed_rlq_service_key();
    define('MISSIONMED_SUPABASE_SERVICE_KEY', $mmed_supabase_service_key);
    unset($mmed_supabase_service_key);
}

if (!class_exists('MissionMed_RLQ_BFF')) {
    final class MissionMed_RLQ_BFF {
        const REST_NAMESPACE = 'rlq/v1';
        const CANONICAL_ORIGIN = 'https://missionmedinstitute.com';

        const USER_META_SUPABASE_UID = 'missionmed_supabase_auth_uid';
        const USER_META_SUPABASE_UID_LEGACY = 'missionmed_rlq_supabase_uid';
        const USER_META_SUPABASE_UID_LOCK = 'missionmed_supabase_auth_uid_lock';
        const USER_META_ACTIVE_RANKLIST_ID = 'missionmed_rlq_active_ranklist_id';
        const USER_META_IDEMPOTENCY_PREFIX = 'missionmed_rlq_idempotency_';

        public static function init() {
            add_action('rest_api_init', array(__CLASS__, 'register_routes'));
            add_action('init', array(__CLASS__, 'maybe_set_rest_nonce_cookie'));
        }

        public static function maybe_set_rest_nonce_cookie() {
            if (is_admin() || !is_user_logged_in()) {
                return;
            }
            $nonce = wp_create_nonce('wp_rest');
            if (!$nonce || headers_sent()) {
                return;
            }
            setcookie(
                'mm_wp_rest_nonce',
                $nonce,
                time() + HOUR_IN_SECONDS,
                COOKIEPATH ? COOKIEPATH : '/',
                COOKIE_DOMAIN ? COOKIE_DOMAIN : '',
                is_ssl(),
                false
            );
            $_COOKIE['mm_wp_rest_nonce'] = $nonce;
        }

        public static function register_routes() {
            register_rest_route(
                self::REST_NAMESPACE,
                '/health',
                array(
                    array(
                        'methods'             => WP_REST_Server::READABLE,
                        'callback'            => array(__CLASS__, 'health_endpoint'),
                        'permission_callback' => '__return_true',
                    ),
                )
            );

            register_rest_route(
                self::REST_NAMESPACE,
                '/bootstrap',
                array(
                    array(
                        'methods'             => WP_REST_Server::READABLE,
                        'callback'            => array(__CLASS__, 'bootstrap_endpoint'),
                        'permission_callback' => function ( $request ) {
                            if ( ! is_user_logged_in() ) {
                                return new WP_Error(
                                    'rlq_not_logged_in',
                                    'WordPress login required.',
                                    array( 'status' => 401 )
                                );
                            }

                            if ( ! current_user_can( 'read' ) ) {
                                return new WP_Error(
                                    'rlq_forbidden',
                                    'Insufficient permissions.',
                                    array( 'status' => 403 )
                                );
                            }

                            return true;
                        },
                    ),
                )
            );

            register_rest_route(
                self::REST_NAMESPACE,
                '/load',
                array(
                    array(
                        'methods'             => WP_REST_Server::READABLE,
                        'callback'            => array(__CLASS__, 'load_endpoint'),
                        'permission_callback' => array(__CLASS__, 'permission_logged_in'),
                    ),
                )
            );

            register_rest_route(
                self::REST_NAMESPACE,
                '/save',
                array(
                    array(
                        'methods'             => WP_REST_Server::CREATABLE,
                        'callback'            => array(__CLASS__, 'save_endpoint'),
                        'permission_callback' => array(__CLASS__, 'permission_logged_in_with_nonce'),
                    ),
                )
            );
        }

        public static function permission_logged_in(WP_REST_Request $request) {
            $origin_check = self::validate_origin($request);
            if (is_wp_error($origin_check)) {
                return $origin_check;
            }
            if (!is_user_logged_in()) {
                return new WP_Error('rlq_not_logged_in', 'WordPress login required.', array('status' => 401));
            }
            return true;
        }

        public static function permission_logged_in_with_nonce(WP_REST_Request $request) {
            $logged_in = self::permission_logged_in($request);
            if (is_wp_error($logged_in)) {
                return $logged_in;
            }
            $nonce = (string) $request->get_header('x_wp_nonce');
            if (!$nonce) {
                return new WP_Error('rlq_nonce_missing', 'Missing WP REST nonce.', array('status' => 403));
            }
            if (!wp_verify_nonce($nonce, 'wp_rest')) {
                return new WP_Error('rlq_nonce_invalid', 'Invalid WP REST nonce.', array('status' => 403));
            }
            return true;
        }

        private static function validate_origin(WP_REST_Request $request) {
            $origin = trim((string) $request->get_header('origin'));
            if ($origin === '') {
                return true;
            }
            $origin = strtolower(untrailingslashit($origin));
            $expected = strtolower(untrailingslashit(self::CANONICAL_ORIGIN));
            if ($origin !== $expected) {
                return new WP_Error('rlq_bad_origin', 'Cross-origin request blocked.', array('status' => 403));
            }
            return true;
        }

        public static function health_endpoint(WP_REST_Request $request) {
            $origin_check = self::validate_origin($request);
            if (is_wp_error($origin_check)) {
                return $origin_check;
            }
            return rest_ensure_response(array(
                'ok' => true,
                'service' => 'missionmed-rlq-bff',
                'namespace' => self::REST_NAMESPACE,
                'server_time_utc' => gmdate('c'),
            ));
        }

        public static function bootstrap_endpoint(WP_REST_Request $request) {
            $diag = array();
            try {
                if (!is_object($request)) {
                    return new WP_Error('rlq_bad_request', 'Invalid REST request object.', array('status' => 400));
                }

                if (!function_exists('get_current_user_id')) {
                    return new WP_Error('rlq_wp_user_fn_missing', 'WordPress user helpers unavailable.', array('status' => 500));
                }

                $current_user_id = (int) get_current_user_id();
                if ($current_user_id <= 0) {
                    return new WP_Error('rlq_not_logged_in', 'WordPress login required.', array('status' => 401));
                }

                $user = wp_get_current_user();
                if (!is_object($user) || !isset($user->ID) || (int) $user->ID <= 0) {
                    return new WP_Error('rlq_not_logged_in', 'WordPress login required.', array('status' => 401));
                }

                $user_email = isset($user->user_email) ? (string) $user->user_email : '';
                $diag['wp_user_id'] = (int) $user->ID;
                $diag['wp_email'] = $user_email;

                $stored_uid = '';
                if (function_exists('get_user_meta')) {
                    $meta_probe = get_user_meta((int) $user->ID, self::USER_META_SUPABASE_UID, true);
                    if ($meta_probe !== null && !is_scalar($meta_probe) && !is_array($meta_probe)) {
                        return new WP_Error('rlq_bad_user_meta', 'Unexpected user meta shape.', array('status' => 500));
                    }
                    $stored_uid = is_scalar($meta_probe) ? (string) $meta_probe : '';
                }
                $diag['stored_uid'] = $stored_uid !== '' ? $stored_uid : null;

                $uid_result = self::get_or_create_supabase_uid($user);
                $diag['uid_result'] = is_wp_error($uid_result)
                    ? array('ok' => false, 'error' => (string) $uid_result->get_error_message())
                    : array('ok' => true, 'uid' => (string) $uid_result);
                if (is_wp_error($uid_result)) {
                    return new WP_REST_Response(array(
                        'ok' => false,
                        'code' => 'rlq_supabase_uid_failed',
                        'message' => (string) $uid_result->get_error_message(),
                        'context' => 'bootstrap',
                        'diagnostics' => $diag,
                    ), 200);
                }
                $supabase_uid = (string) $uid_result;

                $display_name = isset($user->display_name) ? (string) $user->display_name : '';
                $first_name = function_exists('get_user_meta') ? (string) get_user_meta((int) $user->ID, 'first_name', true) : '';
                $last_name = function_exists('get_user_meta') ? (string) get_user_meta((int) $user->ID, 'last_name', true) : '';

                $profile_created = true;
                $profile = null;
                $existing_profile = null;
                $profile_by_uid = null;

                if ($user_email !== '') {
                    $existing_profile_lookup = self::supabase_request(
                        'GET',
                        'profiles',
                        array(
                            'select' => 'id,wp_user_id,email,first_name,last_name,onboarding_complete,extra_data,updated_at',
                            'email' => 'eq.' . $user_email,
                            'limit' => 1,
                        )
                    );
                    $diag['profile_lookup_by_email'] = array(
                        'ok' => (bool) $existing_profile_lookup['ok'],
                        'status' => (int) $existing_profile_lookup['status'],
                    );
                    if (!$existing_profile_lookup['ok']) {
                        return new WP_REST_Response(array(
                            'ok' => false,
                            'code' => 'rlq_profile_lookup_failed',
                            'message' => (string) $existing_profile_lookup['error'],
                            'supabase_status' => (int) $existing_profile_lookup['status'],
                            'context' => 'bootstrap',
                            'diagnostics' => $diag,
                        ), 200);
                    }
                    $existing_profile = self::first_row($existing_profile_lookup['data']);
                    $diag['profile_lookup_by_email']['profile_id'] = (is_array($existing_profile) && !empty($existing_profile['id']))
                        ? (string) $existing_profile['id']
                        : null;
                    if (is_array($existing_profile) && !empty($existing_profile['id'])) {
                        $profile_created = false;
                    }
                }

                if (self::is_uuid($supabase_uid)) {
                    $profile_by_uid_lookup = self::supabase_request(
                        'GET',
                        'profiles',
                        array(
                            'select' => 'id,wp_user_id,email,first_name,last_name,onboarding_complete,extra_data,updated_at',
                            'id' => 'eq.' . $supabase_uid,
                            'limit' => 1,
                        )
                    );
                    $diag['profile_lookup_by_id'] = array(
                        'ok' => (bool) $profile_by_uid_lookup['ok'],
                        'status' => (int) $profile_by_uid_lookup['status'],
                    );
                    if ($profile_by_uid_lookup['ok']) {
                        $profile_by_uid = self::first_row($profile_by_uid_lookup['data']);
                        $diag['profile_lookup_by_id']['profile_id'] = (is_array($profile_by_uid) && !empty($profile_by_uid['id']))
                            ? (string) $profile_by_uid['id']
                            : null;
                    } else {
                        $diag['profile_lookup_by_id']['error'] = (string) $profile_by_uid_lookup['error'];
                    }
                } else {
                    $diag['profile_lookup_by_id'] = array('ok' => false, 'status' => 0, 'profile_id' => null);
                }

                $email_profile_id = (is_array($existing_profile) && !empty($existing_profile['id'])) ? (string) $existing_profile['id'] : '';
                $uid_profile_id = (is_array($profile_by_uid) && !empty($profile_by_uid['id'])) ? (string) $profile_by_uid['id'] : '';
                if ($uid_profile_id !== '') {
                    $existing_profile = $profile_by_uid;
                    $profile_created = false;
                }
                if ($uid_profile_id === '' && $email_profile_id !== '' && strcasecmp($email_profile_id, $supabase_uid) !== 0) {
                    $supabase_uid = $email_profile_id;
                    if (function_exists('update_user_meta')) {
                        update_user_meta((int) $user->ID, self::USER_META_SUPABASE_UID, $supabase_uid);
                    }
                    $diag['uid_normalized'] = true;
                    $diag['uid_normalized_to'] = $supabase_uid;
                }

                $profile_row = array(
                    'id' => $supabase_uid,
                    'wp_user_id' => (int) $user->ID,
                    'email' => $user_email,
                    'first_name' => $first_name,
                    'last_name' => $last_name,
                    'updated_at' => gmdate('c'),
                );

                if (defined('WP_DEBUG') && WP_DEBUG) {
                    error_log('[RLQ DEBUG] existing_profile: ' . print_r($existing_profile, true));
                    error_log('[RLQ DEBUG] profile_by_uid: ' . print_r($profile_by_uid, true));
                }
                if (is_array($existing_profile) && !empty($existing_profile['id'])) {
                    $existing_profile_id = (string) $existing_profile['id'];
                    $profile_patch_row = $profile_row;
                    unset($profile_patch_row['id']);

                    $profile_patch = self::supabase_request(
                        'PATCH',
                        'profiles',
                        array('id' => 'eq.' . $existing_profile_id),
                        $profile_patch_row,
                        'return=representation'
                    );

                    if (!$profile_patch['ok']) {
                        return new WP_REST_Response(array(
                            'ok' => false,
                            'code' => 'rlq_profile_patch_failed',
                            'message' => (string) $profile_patch['error'],
                            'supabase_status' => (int) $profile_patch['status'],
                            'context' => 'bootstrap',
                            'diagnostics' => $diag,
                        ), 200);
                    }

                    $profile = self::first_row($profile_patch['data']);
                    if (!is_array($profile)) {
                        $profile = array_merge(array('id' => $existing_profile_id), $profile_patch_row);
                    }
                    $profile_created = false;
                } else {
                    $profile_insert = self::supabase_request(
                        'POST',
                        'profiles',
                        array(),
                        array($profile_row),
                        'return=representation'
                    );

                    if ($profile_insert['ok']) {
                        $profile = self::first_row($profile_insert['data']);
                        if (!is_array($profile)) {
                            $profile = $profile_row;
                        }
                        $profile_created = true;
                    } else {
                        $profile_fallback = null;
                        if ((int) $profile_insert['status'] === 409 && self::is_uuid($supabase_uid)) {
                            $fallback_lookup = self::supabase_request(
                                'GET',
                                'profiles',
                                array(
                                    'select' => 'id,wp_user_id,email,first_name,last_name,onboarding_complete,extra_data,updated_at',
                                    'id' => 'eq.' . $supabase_uid,
                                    'limit' => 1,
                                )
                            );
                            if ($fallback_lookup['ok']) {
                                $profile_fallback = self::first_row($fallback_lookup['data']);
                            }
                        }
                        if (!is_array($profile_fallback) || empty($profile_fallback['id'])) {
                            if ((int) $profile_insert['status'] === 409 && $user_email !== '') {
                                $fallback_lookup = self::supabase_request(
                                    'GET',
                                    'profiles',
                                    array(
                                        'select' => 'id,wp_user_id,email,first_name,last_name,onboarding_complete,extra_data,updated_at',
                                        'email' => 'eq.' . $user_email,
                                        'limit' => 1,
                                    )
                                );
                                if ($fallback_lookup['ok']) {
                                    $profile_fallback = self::first_row($fallback_lookup['data']);
                                }
                            }
                        }
                        if (is_array($profile_fallback) && !empty($profile_fallback['id'])) {
                            $profile = $profile_fallback;
                            $profile_created = false;
                        } else {
                            return new WP_REST_Response(array(
                                'ok' => false,
                                'code' => 'rlq_profile_insert_failed',
                                'message' => (string) $profile_insert['error'],
                                'supabase_status' => (int) $profile_insert['status'],
                                'context' => 'bootstrap',
                                'diagnostics' => $diag,
                            ), 200);
                        }
                    }
                }

                $response = array(
                    'ok' => true,
                    'wp' => array(
                        'user_id' => (int) $user->ID,
                        'email' => $user_email,
                        'display_name' => $display_name,
                    ),
                    'nonce' => wp_create_nonce('wp_rest'),
                    'supabase_uid' => $supabase_uid,
                    'profile' => is_array($profile) ? $profile : array(),
                    'created' => (bool) $profile_created,
                    'diagnostics' => $diag,
                );

                if (defined('WP_DEBUG') && WP_DEBUG) {
                    $current_user_id = get_current_user_id();
                    $current_user = wp_get_current_user();
                    $cookie_snapshot = isset($_COOKIE) ? array_keys($_COOKIE) : array();
                    $php_session_id = function_exists('session_id') ? session_id() : null;

                    $response['debug'] = array(
                        'timestamp' => current_time('mysql'),
                        'wp_current_user' => array(
                            'user_id' => $current_user_id,
                            'email' => ($current_user && isset($current_user->user_email)) ? $current_user->user_email : null,
                            'roles' => ($current_user && isset($current_user->roles)) ? $current_user->roles : array(),
                        ),
                        'supabase_uid' => isset($supabase_uid) ? $supabase_uid : null,
                        'cookies_present' => $cookie_snapshot,
                        'php_session_id' => $php_session_id,
                    );

                    error_log('[RLQ BOOTSTRAP DEBUG] ' . wp_json_encode($response['debug']));
                }

                return rest_ensure_response($response);
            } catch (Throwable $e) {
                error_log('[RLQ] bootstrap_endpoint exception: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
                return new WP_REST_Response(array(
                    'error' => $e->getMessage(),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'diagnostics' => $diag,
                ), 500);
            }
        }

        public static function load_endpoint(WP_REST_Request $request) {
            $user = wp_get_current_user();
            if (!$user || !$user->ID) {
                return new WP_Error('rlq_not_logged_in', 'WordPress login required.', array('status' => 401));
            }

            $uid_result = self::get_or_create_supabase_uid($user);
            if (is_wp_error($uid_result)) {
                return self::cloud_unavailable_response($uid_result, 'load');
            }
            $supabase_uid = (string) $uid_result;

            $payload_result = self::load_user_payload($supabase_uid, (int) $user->ID);
            if (is_wp_error($payload_result)) {
                return $payload_result;
            }

            return rest_ensure_response(array(
                'ok' => true,
                'supabase_uid' => $supabase_uid,
                'data' => $payload_result,
            ));
        }

        public static function save_endpoint(WP_REST_Request $request) {
            error_log('RLQ VERSION MARKER 2249');
            $user = wp_get_current_user();
            if (!$user || !$user->ID) {
                return new WP_Error('rlq_not_logged_in', 'WordPress login required.', array('status' => 401));
            }

            $uid_result = self::get_or_create_supabase_uid($user);
            if (is_wp_error($uid_result)) {
                return self::cloud_unavailable_response($uid_result, 'save');
            }
            $supabase_uid = (string) $uid_result;

            $payload = $request->get_json_params();
            if (!is_array($payload)) {
                $payload = array();
            }

            $persist_result = self::persist_payload($payload, $user, $supabase_uid);
            if (is_wp_error($persist_result)) {
                return $persist_result;
            }

            return rest_ensure_response(array_merge(
                array('ok' => true, 'supabase_uid' => $supabase_uid),
                $persist_result
            ));
        }

        private static function persist_payload(array $payload, WP_User $user, $supabase_uid) {
            $timestamp = self::coerce_iso8601(isset($payload['timestamp']) ? $payload['timestamp'] : '');
            $profile_data = self::as_array(isset($payload['profile_data']) ? $payload['profile_data'] : array());
            $ranklist_snapshot = self::normalize_snapshot_payload_value(isset($payload['ranklist_snapshot']) ? $payload['ranklist_snapshot'] : array());
            $program_interviews = isset($payload['program_interviews']) && is_array($payload['program_interviews'])
                ? $payload['program_interviews']
                : array();
            $idempotency_key = substr(sanitize_text_field((string) (isset($payload['idempotency_key']) ? $payload['idempotency_key'] : '')), 0, 160);

            if ($idempotency_key !== '') {
                $idempotent = self::load_idempotent_save((int) $user->ID, $idempotency_key);
                if (is_array($idempotent) && !empty($idempotent['saved_at'])) {
                    $idempotent['idempotent_replay'] = true;
                    return $idempotent;
                }
            }

            $profile_sync = self::ensure_profile_row($user, $supabase_uid, $profile_data, $timestamp);
            if (is_wp_error($profile_sync)) {
                return $profile_sync;
            }

            $active_ranklist_id = self::resolve_ranklist_id((int) $user->ID, $ranklist_snapshot);
            $ranklist_row = array(
                'id' => $active_ranklist_id,
                'user_id' => $supabase_uid,
                'title' => self::clean_text(isset($ranklist_snapshot['title']) ? $ranklist_snapshot['title'] : 'My Rank List'),
                'specialty' => self::clean_nullable_text(isset($ranklist_snapshot['specialty']) ? $ranklist_snapshot['specialty'] : null),
                'cycle_year' => self::clean_nullable_int(isset($ranklist_snapshot['cycle_year']) ? $ranklist_snapshot['cycle_year'] : null),
                'updated_at' => $timestamp,
            );
            $ranklist_upsert = self::supabase_request(
                'POST',
                'ranklists',
                array('on_conflict' => 'id'),
                array($ranklist_row),
                'return=representation,resolution=merge-duplicates'
            );
            if (!$ranklist_upsert['ok']) {
                return new WP_Error('rlq_ranklist_upsert_failed', $ranklist_upsert['error'], array('status' => 500, 'supabase' => $ranklist_upsert));
            }
            update_user_meta((int) $user->ID, self::USER_META_ACTIVE_RANKLIST_ID, $active_ranklist_id);

            $should_insert_version = self::is_versionable_ranklist_snapshot($ranklist_snapshot);
            $version_id = null;
            if ($should_insert_version) {
                $version_id = wp_generate_uuid4();
                $version_label = self::clean_text(
                    isset($ranklist_snapshot['label']) ? $ranklist_snapshot['label']
                        : (isset($ranklist_snapshot['source']) ? $ranklist_snapshot['source'] : 'Manual Save')
                );
                $snapshot_payload = self::normalize_snapshot_payload_value(isset($ranklist_snapshot['snapshot']) ? $ranklist_snapshot['snapshot'] : $ranklist_snapshot);

                $version_row = array(
                    'ranklist_id' => $active_ranklist_id,
                    'created_by' => $supabase_uid,
                    'label' => $version_label,
                    'snapshot' => $snapshot_payload,
                    'created_at' => $timestamp,
                );

                $version_insert = self::supabase_request(
                    'POST',
                    'ranklist_versions',
                    array(),
                    array($version_row),
                    'return=representation'
                );

                if (!$version_insert['ok']) {
                    $fallback_row = array(
                        'ranklist_id' => $active_ranklist_id,
                        'created_by' => $supabase_uid,
                        'label' => $version_label,
                        'snapshot' => $snapshot_payload,
                        'created_at' => $timestamp,
                    );
                    $version_insert_fallback = self::supabase_request(
                        'POST',
                        'ranklist_versions',
                        array(),
                        array($fallback_row),
                        'return=representation'
                    );
                    if (!$version_insert_fallback['ok']) {
                        return new WP_Error('rlq_ranklist_version_insert_failed', $version_insert_fallback['error'], array('status' => 500, 'supabase' => $version_insert_fallback));
                    }
                }
            } else {
                if (defined('WP_DEBUG') && WP_DEBUG && !empty($ranklist_snapshot)) {
                    $keys = implode(',', array_slice(array_keys($ranklist_snapshot), 0, 12));
                    error_log("RLQ VERSION INSERT SKIPPED: non-versionable snapshot keys=" . $keys);
                }
            }

            $upsert_interviews = self::upsert_program_interviews($program_interviews, $supabase_uid, $timestamp);
            if (is_wp_error($upsert_interviews)) {
                return $upsert_interviews;
            }

            $response = array(
                'saved_at' => $timestamp,
                'ranklist_id' => $active_ranklist_id,
                'version_id' => $version_id,
            );

            if ($idempotency_key !== '') {
                self::store_idempotent_save((int) $user->ID, $idempotency_key, $response);
            }

            return $response;
        }

        private static function normalize_snapshot_payload_value($value) {
            if (is_array($value)) {
                return $value;
            }
            if (is_object($value)) {
                $decoded_object = json_decode(wp_json_encode($value), true);
                return is_array($decoded_object) ? $decoded_object : array();
            }
            if (is_string($value)) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    return $decoded;
                }
            }
            return array();
        }

        private static function is_versionable_ranklist_snapshot($ranklist_snapshot) {
            $ranklist_snapshot = self::normalize_snapshot_payload_value($ranklist_snapshot);
            if (!array_key_exists('snapshot', $ranklist_snapshot)) {
                return false;
            }
            $snapshot = self::normalize_snapshot_payload_value($ranklist_snapshot['snapshot']);
            if (empty($snapshot)) {
                return false;
            }

            $marker_keys = array('source', 'profile_link', 'sync', 'marker', 'ping');
            if (count($snapshot) === 1) {
                $single_key = (string) key($snapshot);
                if (in_array($single_key, $marker_keys, true)) {
                    return false;
                }
            }

            // Observed in RankListIQ payloads: kind/schemaVersion/uiPrefs/currentVersionId + nested snapshot/state/programs/factors/scores/notes.
            $workspace_key_allowlist = array(
                'kind',
                'schemaVersion',
                'snapshot',
                'state',
                'uiPrefs',
                'currentVersionId',
                'programs',
                'factors',
                'scores',
                'notes',
                'notes_advanced',
                'supplemental_lists',
                'profile_data',
                'candidate_profile',
            );

            $has_allowlisted_key = false;
            foreach ($workspace_key_allowlist as $allowed_key) {
                if (array_key_exists($allowed_key, $snapshot)) {
                    $has_allowlisted_key = true;
                    break;
                }
            }
            if (!$has_allowlisted_key) {
                return false;
            }

            $nested_snapshot = self::normalize_snapshot_payload_value(isset($snapshot['snapshot']) ? $snapshot['snapshot'] : array());
            $nested_state = self::normalize_snapshot_payload_value(isset($snapshot['state']) ? $snapshot['state'] : array());
            if (!empty($nested_snapshot) || !empty($nested_state)) {
                return true;
            }

            $legacy_workspace_keys = array(
                'programs',
                'factors',
                'scores',
                'notes',
                'notes_advanced',
                'supplemental_lists',
                'profile_data',
                'candidate_profile',
            );
            foreach ($legacy_workspace_keys as $legacy_key) {
                $candidate = self::normalize_snapshot_payload_value(isset($snapshot[$legacy_key]) ? $snapshot[$legacy_key] : array());
                if (!empty($candidate)) {
                    return true;
                }
            }

            return false;
        }

        private static function ranklist_snapshot_is_versionable($ranklist_snapshot) {
            return self::is_versionable_ranklist_snapshot($ranklist_snapshot);
        }

        private static function normalize_nullable_bool($value) {
            if ($value === true || $value === false) {
                return $value;
            }

            if ($value === 'true') {
                return true;
            }

            if ($value === 'false') {
                return false;
            }

            if ($value === 'unknown' || $value === '' || $value === null) {
                return null;
            }

            return null;
        }

        private static function upsert_program_interviews(array $rows, $supabase_uid, $timestamp) {
            if (empty($rows)) {
                return true;
            }
            $normalized = array();
            foreach ($rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $program_name = self::clean_text(isset($row['program_name']) ? $row['program_name'] : '');
                if ($program_name === '') {
                    continue;
                }
                $program_key = self::clean_text(isset($row['program_key']) ? $row['program_key'] : '');
                if ($program_key === '') {
                    $program_key = self::build_program_key($row);
                }
                $normalized[] = array(
                    'user_id' => $supabase_uid,
                    'program_key' => $program_key !== '' ? $program_key : null,
                    'program_name' => $program_name,
                    'program_id' => self::clean_nullable_text(isset($row['program_id']) ? $row['program_id'] : null),
                    'nrmp_program_code' => self::clean_nullable_text(isset($row['nrmp_program_code']) ? $row['nrmp_program_code'] : null),
                    'specialty' => self::clean_nullable_text(isset($row['specialty']) ? $row['specialty'] : null),
                    'match_cycle_year' => self::clean_nullable_int(isset($row['match_cycle_year']) ? $row['match_cycle_year'] : null),
                    'notes' => self::clean_nullable_text(isset($row['notes']) ? $row['notes'] : null),
                    'interview_performance_metrics' => self::as_array(isset($row['interview_performance_metrics']) ? $row['interview_performance_metrics'] : array()),
                    'interview_format' => self::clean_nullable_text(isset($row['interview_format']) ? $row['interview_format'] : null),
                    'interview_received' => self::coerce_nullable_bool(isset($row['interview_received']) ? $row['interview_received'] : null),
                    'applied_status' => self::clean_nullable_text(isset($row['applied_status']) ? $row['applied_status'] : null),
                    'signal_sent' => self::coerce_nullable_bool(isset($row['signal_sent']) ? $row['signal_sent'] : null),
                    'visa_status' => self::clean_nullable_text(isset($row['visa_status']) ? $row['visa_status'] : null),
                    'confidence_score' => self::clean_nullable_float(isset($row['confidence_score']) ? $row['confidence_score'] : null),
                    'ranked_position' => self::clean_nullable_int(isset($row['ranked_position']) ? $row['ranked_position'] : null),
                    // Normalize boolean fields to prevent Postgres boolean syntax errors
                    'final_match_flag' => self::coerce_nullable_bool(isset($row['final_match_flag']) ? $row['final_match_flag'] : null),
                    'updated_at' => $timestamp,
                );
            }

            if (empty($normalized)) {
                return true;
            }

            $primary = self::supabase_request(
                'POST',
                'user_program_interviews',
                array('on_conflict' => 'user_id,program_key,match_cycle_year'),
                $normalized,
                'return=representation,resolution=merge-duplicates'
            );
            if ($primary['ok']) {
                return true;
            }

            $fallback_rows = array();
            foreach ($normalized as $row) {
                unset($row['program_key']);
                $fallback_rows[] = $row;
            }
            $fallback = self::supabase_request(
                'POST',
                'user_program_interviews',
                array('on_conflict' => 'user_id,program_name,match_cycle_year'),
                $fallback_rows,
                'return=representation,resolution=merge-duplicates'
            );
            if ($fallback['ok']) {
                return true;
            }

            return new WP_Error('rlq_upi_upsert_failed', $fallback['error'], array('status' => 500, 'supabase' => $fallback));
        }

        private static function load_user_payload($supabase_uid, $wp_user_id) {
            $profile_res = self::supabase_request(
                'GET',
                'profiles',
                array(
                    'select' => 'id,wp_user_id,email,first_name,last_name,onboarding_complete,extra_data,updated_at',
                    'id' => 'eq.' . rawurlencode($supabase_uid),
                    'limit' => 1,
                )
            );
            if (!$profile_res['ok']) {
                return new WP_Error('rlq_profile_load_failed', $profile_res['error'], array('status' => 500, 'supabase' => $profile_res));
            }
            $profile = self::first_row($profile_res['data']);

            $ranklist_res = self::supabase_request(
                'GET',
                'ranklists',
                array(
                    'select' => 'id,user_id,title,specialty,cycle_year,updated_at,created_at',
                    'user_id' => 'eq.' . rawurlencode($supabase_uid),
                    'order' => 'updated_at.desc',
                    'limit' => 1,
                )
            );
            if (!$ranklist_res['ok']) {
                return new WP_Error('rlq_ranklist_load_failed', $ranklist_res['error'], array('status' => 500, 'supabase' => $ranklist_res));
            }
            $ranklist = self::first_row($ranklist_res['data']);
            $ranklist_id = is_array($ranklist) && !empty($ranklist['id']) ? (string) $ranklist['id'] : '';
            if (self::is_uuid($ranklist_id)) {
                update_user_meta((int) $wp_user_id, self::USER_META_ACTIVE_RANKLIST_ID, $ranklist_id);
            }

            $latest_version = null;
            $latest_ranklist_version = null;
            $headers = [
              'apikey'        => MISSIONMED_SUPABASE_SERVICE_KEY,
              'Authorization' => 'Bearer ' . MISSIONMED_SUPABASE_SERVICE_KEY,
              'Content-Type'  => 'application/json'
            ];

            $url = '';
            $versions_rows = array();
            if (self::is_uuid($ranklist_id)) {
                $version_url = MISSIONMED_SUPABASE_URL
                  . '/rest/v1/ranklist_versions'
                  . '?select=id,ranklist_id,label,snapshot,created_at,created_by'
                  . '&ranklist_id=eq.' . rawurlencode($ranklist_id)
                  . '&is_marker_only=eq.false'
                  . '&created_by=eq.' . rawurlencode($supabase_uid)
                  . '&order=created_at.desc,id.desc'
                  . '&limit=25';
                $url = $version_url;

                $response = wp_remote_get($version_url, [
                  'headers' => $headers,
                  'timeout' => 20
                ]);

                if (is_wp_error($response)) {
                    return new WP_Error('rlq_ranklist_version_load_failed', $response->get_error_message(), array('status' => 500, 'supabase' => $response));
                }

                $body = wp_remote_retrieve_body($response);
                $data = json_decode($body, true);
                $versions_rows = is_array($data) ? $data : array();
            }
            error_log("RLQ LOAD QUERY URL: " . $url);
            error_log("RLQ LOAD DEBUG supabase_uid: " . $supabase_uid);
            error_log("RLQ LOAD DEBUG versions found: " . count($versions_rows));
            if (!empty($versions_rows)) {
                foreach ($versions_rows as $v) {
                    $created_by = (is_array($v) && isset($v['created_by'])) ? $v['created_by'] : '';
                    $version_id = (is_array($v) && isset($v['id'])) ? $v['id'] : '';
                    error_log("RLQ LOAD VERSION ROW created_by=" . $created_by . " id=" . $version_id);
                }
            }

            foreach ($versions_rows as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $candidate = $row;
                $candidate_snapshot = self::normalize_snapshot_payload_value(isset($candidate['snapshot']) ? $candidate['snapshot'] : array());
                if (!self::is_versionable_ranklist_snapshot(array('snapshot' => $candidate_snapshot))) {
                    continue;
                }
                $candidate['snapshot'] = $candidate_snapshot;
                $latest_ranklist_version = $candidate;
                break;
            }

            if (is_array($latest_ranklist_version)) {
                $latest = $latest_ranklist_version;
                error_log("RLQ LOAD returning snapshot length: " . strlen(json_encode($latest['snapshot'])));
            }

            if (!is_array($latest_ranklist_version)) {
                return array(
                    'ok' => true,
                    'ranklist' => $ranklist,
                    'latest_version' => null,
                    'snapshot' => null,
                    'interviews' => isset($interviews) ? $interviews : array(),
                );
            }

            return array(
                'ok' => true,
                'version_id' => isset($latest_ranklist_version['id']) ? $latest_ranklist_version['id'] : null,
                'ranklist_id' => isset($latest_ranklist_version['ranklist_id']) ? $latest_ranklist_version['ranklist_id'] : null,
                'saved_at' => isset($latest_ranklist_version['created_at']) ? $latest_ranklist_version['created_at'] : null,
                'snapshot' => isset($latest_ranklist_version['snapshot']) ? $latest_ranklist_version['snapshot'] : null,
            );
        }

        private static function get_or_create_supabase_uid(WP_User $user) {
            $wp_user_id = (int) $user->ID;
            $email = sanitize_email((string) $user->user_email);
            if ($email === '') {
                return new WP_Error('rlq_supabase_email_missing', 'Cannot provision Supabase user without a valid email.', array('status' => 503));
            }

            $from_meta = self::read_canonical_supabase_uid($wp_user_id);
            if (self::is_uuid($from_meta)) {
                error_log('[RLQ] Supabase user reused: ' . $from_meta);
                return $from_meta;
            }

            $lock_acquired = add_user_meta($wp_user_id, self::USER_META_SUPABASE_UID_LOCK, (string) time(), true);
            if (!$lock_acquired) {
                for ($attempt = 0; $attempt < 10; $attempt++) {
                    usleep(150000);
                    $existing = self::read_canonical_supabase_uid($wp_user_id);
                    if (self::is_uuid($existing)) {
                        error_log('[RLQ] Supabase user reused: ' . $existing);
                        return $existing;
                    }
                }
            }

            try {
                $from_meta = self::read_canonical_supabase_uid($wp_user_id);
                if (self::is_uuid($from_meta)) {
                    error_log('[RLQ] Supabase user reused: ' . $from_meta);
                    return $from_meta;
                }

                $lookup_id = self::find_auth_user_by_email($email);
                if (is_wp_error($lookup_id)) {
                    return $lookup_id;
                }
                if (self::is_uuid($lookup_id)) {
                    $mapped = self::persist_user_auth_uid_mapping($wp_user_id, $lookup_id);
                    if (is_wp_error($mapped)) {
                        return $mapped;
                    }
                    error_log('[RLQ] Supabase user reused: ' . $mapped);
                    return $mapped;
                }

                $recheck_before_create = self::read_canonical_supabase_uid($wp_user_id);
                if (self::is_uuid($recheck_before_create)) {
                    error_log('[RLQ] Supabase user reused: ' . $recheck_before_create);
                    return $recheck_before_create;
                }

                $created_id = self::create_auth_user($email, $user);
                if (is_wp_error($created_id)) {
                    $lookup_after_create_error = self::find_auth_user_by_email($email);
                    if (!is_wp_error($lookup_after_create_error) && self::is_uuid($lookup_after_create_error)) {
                        $mapped_after_error = self::persist_user_auth_uid_mapping($wp_user_id, $lookup_after_create_error);
                        if (is_wp_error($mapped_after_error)) {
                            return $mapped_after_error;
                        }
                        error_log('[RLQ] Supabase user reused: ' . $mapped_after_error);
                        return $mapped_after_error;
                    }
                    return $created_id;
                }

                $mapped_created = self::persist_user_auth_uid_mapping($wp_user_id, $created_id);
                if (is_wp_error($mapped_created)) {
                    return $mapped_created;
                }
                error_log('[RLQ] Supabase user provisioned: ' . $mapped_created);
                return $mapped_created;
            } finally {
                if ($lock_acquired) {
                    delete_user_meta($wp_user_id, self::USER_META_SUPABASE_UID_LOCK);
                }
            }
        }

        private static function read_canonical_supabase_uid($wp_user_id) {
            $canonical = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true);
            if (self::is_uuid($canonical)) {
                return $canonical;
            }
            $legacy = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID_LEGACY, true);
            if (self::is_uuid($legacy)) {
                add_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, $legacy, true);
                $canonical_after_copy = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true);
                if (self::is_uuid($canonical_after_copy)) {
                    return $canonical_after_copy;
                }
                update_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, $legacy);
                return $legacy;
            }
            return '';
        }

        private static function persist_user_auth_uid_mapping($wp_user_id, $candidate_uid) {
            if (!self::is_uuid($candidate_uid)) {
                return new WP_Error('rlq_supabase_uid_invalid', 'Invalid Supabase auth UID.', array('status' => 503));
            }

            $existing = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true);
            if (self::is_uuid($existing)) {
                return $existing;
            }

            $added = add_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, $candidate_uid, true);
            if (!$added) {
                $race_existing = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true);
                if (self::is_uuid($race_existing)) {
                    return $race_existing;
                }
            }

            if (!self::is_uuid((string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true))) {
                update_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, $candidate_uid);
            }

            $stored = (string) get_user_meta((int) $wp_user_id, self::USER_META_SUPABASE_UID, true);
            if (!self::is_uuid($stored)) {
                return new WP_Error('rlq_supabase_uid_store_failed', 'Failed to persist Supabase auth UID mapping.', array('status' => 503));
            }
            return $stored;
        }

        private static function find_auth_user_by_email($email) {
            $email = strtolower(trim((string) $email));
            if ($email === '') {
                return new WP_Error('rlq_supabase_email_missing', 'Cannot query Supabase Auth without email.', array('status' => 503));
            }

            $query_attempts = array(
                array('email' => $email),
                array('filter' => 'email.eq.' . $email),
            );

            foreach ($query_attempts as $query) {
                $res = self::supabase_admin_request('GET', 'users', $query, null);
                if ($res['ok']) {
                    $found = self::extract_auth_uid_by_email($res['data'], $email);
                    if (self::is_uuid($found)) {
                        return $found;
                    }
                    continue;
                }
                if (!in_array((int) $res['status'], array(400, 404), true)) {
                    return new WP_Error('rlq_supabase_admin_lookup_failed', $res['error'], array('status' => 503, 'supabase' => $res));
                }
            }

            $list_res = self::supabase_admin_request('GET', 'users', array(), null);
            if (!$list_res['ok']) {
                return new WP_Error('rlq_supabase_admin_lookup_failed', $list_res['error'], array('status' => 503, 'supabase' => $list_res));
            }

            $found = self::extract_auth_uid_by_email($list_res['data'], $email);
            if (self::is_uuid($found)) {
                return $found;
            }

            $per_page = 200;
            for ($page = 2; $page <= 5; $page++) {
                $paged_res = self::supabase_admin_request('GET', 'users', array('page' => $page, 'per_page' => $per_page), null);
                if (!$paged_res['ok']) {
                    break;
                }
                $found = self::extract_auth_uid_by_email($paged_res['data'], $email);
                if (self::is_uuid($found)) {
                    return $found;
                }
                $users = self::extract_admin_users($paged_res['data']);
                if (count($users) < $per_page) {
                    break;
                }
            }

            return '';
        }

        private static function create_auth_user($email, WP_User $user) {
            $email = strtolower(trim((string) $email));
            if ($email === '') {
                return new WP_Error('rlq_supabase_email_missing', 'Cannot create Supabase Auth user without email.', array('status' => 503));
            }

            $create_payload = array(
                'email' => $email,
                'password' => wp_generate_password(40, true, true),
                'email_confirm' => true,
                'user_metadata' => array(
                    'wp_user_id' => (int) $user->ID,
                    'display_name' => (string) $user->display_name,
                ),
            );

            $create = self::supabase_admin_request('POST', 'users', array(), $create_payload);
            if (!$create['ok']) {
                return new WP_Error('rlq_supabase_admin_create_failed', $create['error'], array('status' => 503, 'supabase' => $create));
            }

            $created_uid = '';
            if (is_array($create['data']) && isset($create['data']['id'])) {
                $created_uid = (string) $create['data']['id'];
            } else {
                $created_uid = self::extract_auth_uid_by_email($create['data'], $email);
            }

            if (!self::is_uuid($created_uid)) {
                return new WP_Error('rlq_supabase_admin_create_failed', 'Supabase Auth user created but UUID missing in response.', array('status' => 503, 'supabase' => $create));
            }
            return $created_uid;
        }

        private static function extract_auth_uid_by_email($data, $email) {
            $target_email = strtolower(trim((string) $email));
            $users = self::extract_admin_users($data);
            foreach ($users as $user) {
                if (!is_array($user)) {
                    continue;
                }
                $candidate_email = strtolower(trim((string) (isset($user['email']) ? $user['email'] : '')));
                if ($candidate_email !== '' && $candidate_email === $target_email) {
                    $candidate_id = (string) (isset($user['id']) ? $user['id'] : '');
                    if (self::is_uuid($candidate_id)) {
                        return $candidate_id;
                    }
                }
            }
            return '';
        }

        private static function extract_admin_users($data) {
            if (!is_array($data)) {
                return array();
            }
            if (isset($data['users']) && is_array($data['users'])) {
                return $data['users'];
            }
            if (isset($data[0]) && is_array($data[0])) {
                return $data;
            }
            if (self::is_assoc($data) && isset($data['id'])) {
                return array($data);
            }
            return array();
        }

        private static function ensure_profile_row(WP_User $user, $supabase_uid, array $profile_data = array(), $timestamp = null) {
            $timestamp = $timestamp ? self::coerce_iso8601($timestamp) : gmdate('c');
            $row = array(
                'id' => $supabase_uid,
                'wp_user_id' => (int) $user->ID,
                'email' => (string) $user->user_email,
                'first_name' => (string) get_user_meta((int) $user->ID, 'first_name', true),
                'last_name' => (string) get_user_meta((int) $user->ID, 'last_name', true),
                'updated_at' => $timestamp,
            );

            if (isset($profile_data['first_name'])) {
                $row['first_name'] = self::clean_text($profile_data['first_name']);
            }
            if (isset($profile_data['last_name'])) {
                $row['last_name'] = self::clean_text($profile_data['last_name']);
            }
            if (isset($profile_data['email'])) {
                $row['email'] = sanitize_email((string) $profile_data['email']);
            }
            if (isset($profile_data['onboarding_complete'])) {
                $row['onboarding_complete'] = (bool) $profile_data['onboarding_complete'];
            }
            if (isset($profile_data['extra_data']) && is_array($profile_data['extra_data'])) {
                $row['extra_data'] = $profile_data['extra_data'];
            } else {
                $extra = array();
                foreach ($profile_data as $key => $value) {
                    if (in_array($key, array('id', 'wp_user_id', 'email', 'first_name', 'last_name', 'updated_at', 'onboarding_complete'), true)) {
                        continue;
                    }
                    $extra[$key] = $value;
                }
                if (!empty($extra)) {
                    $row['extra_data'] = $extra;
                }
            }

            $upsert = self::supabase_request(
                'POST',
                'profiles',
                array('on_conflict' => 'id'),
                array($row),
                'return=representation,resolution=merge-duplicates'
            );
            if (!$upsert['ok']) {
                return new WP_Error('rlq_profile_upsert_failed', $upsert['error'], array('status' => 500, 'supabase' => $upsert));
            }
            return true;
        }

        private static function resolve_ranklist_id($wp_user_id, array $ranklist_snapshot) {
            $candidate = isset($ranklist_snapshot['ranklist_id']) ? (string) $ranklist_snapshot['ranklist_id'] : '';
            if (self::is_uuid($candidate)) {
                return $candidate;
            }
            $from_meta = (string) get_user_meta((int) $wp_user_id, self::USER_META_ACTIVE_RANKLIST_ID, true);
            if (self::is_uuid($from_meta)) {
                return $from_meta;
            }
            return wp_generate_uuid4();
        }

        private static function cloud_unavailable_response(WP_Error $error, $context) {
            $status = 503;
            $codes = $error->get_error_codes();
            if (!empty($codes)) {
                $data = $error->get_error_data($codes[0]);
                if (is_array($data) && isset($data['status']) && is_numeric($data['status'])) {
                    $status = (int) $data['status'];
                }
            }
            if ($status < 400) {
                $status = 503;
            }
            return new WP_REST_Response(
                array(
                    'ok' => false,
                    'cloud_available' => false,
                    'code' => 'rlq_cloud_unavailable',
                    'context' => (string) $context,
                    'message' => (string) $error->get_error_message(),
                ),
                $status
            );
        }

        private static function load_idempotent_save($wp_user_id, $key) {
            $meta_key = self::USER_META_IDEMPOTENCY_PREFIX . md5($key);
            $value = get_user_meta((int) $wp_user_id, $meta_key, true);
            return is_array($value) ? $value : null;
        }

        private static function store_idempotent_save($wp_user_id, $key, array $payload) {
            $meta_key = self::USER_META_IDEMPOTENCY_PREFIX . md5($key);
            update_user_meta((int) $wp_user_id, $meta_key, $payload);
        }

        private static function build_program_key(array $row) {
            $id = self::clean_text(isset($row['program_id']) ? $row['program_id'] : '');
            if ($id !== '') {
                return $id;
            }
            $nrmp = self::clean_text(isset($row['nrmp_program_code']) ? $row['nrmp_program_code'] : '');
            if ($nrmp !== '') {
                return $nrmp;
            }
            $name = strtolower(trim(self::clean_text(isset($row['program_name']) ? $row['program_name'] : '')));
            if ($name !== '') {
                return preg_replace('/\s+/', ' ', $name);
            }
            return '';
        }

        private static function supabase_request($method, $path, array $query = array(), $body = null, $prefer = 'return=representation') {
            $base = rtrim((string) MISSIONMED_SUPABASE_URL, '/');
            $url = $base . '/rest/v1/' . ltrim($path, '/');
            if (!empty($query)) {
                $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
            }

            $headers = array(
                'apikey' => (string) MISSIONMED_SUPABASE_SERVICE_KEY,
                'Authorization' => 'Bearer ' . (string) MISSIONMED_SUPABASE_SERVICE_KEY,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'Prefer' => (string) $prefer,
            );

            $args = array(
                'method' => strtoupper((string) $method),
                'headers' => $headers,
                'timeout' => 25,
            );
            if ($body !== null) {
                $args['body'] = wp_json_encode($body);
            }

            $response = wp_remote_request($url, $args);
            if (is_wp_error($response)) {
                return array(
                    'ok' => false,
                    'status' => 0,
                    'error' => $response->get_error_message(),
                    'data' => null,
                    'raw' => null,
                );
            }

            $status = (int) wp_remote_retrieve_response_code($response);
            $raw = (string) wp_remote_retrieve_body($response);
            $decoded = json_decode($raw, true);
            $ok = $status >= 200 && $status < 300;

            return array(
                'ok' => $ok,
                'status' => $status,
                'error' => $ok ? null : self::extract_supabase_error($decoded, $raw, $status),
                'data' => $decoded,
                'raw' => $raw,
            );
        }

        private static function supabase_admin_request($method, $path, array $query = array(), $body = null) {
            $base = rtrim((string) MISSIONMED_SUPABASE_URL, '/');
            $url = $base . '/auth/v1/admin/' . ltrim($path, '/');
            if (!empty($query)) {
                $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
            }

            $headers = array(
                'apikey' => (string) MISSIONMED_SUPABASE_SERVICE_KEY,
                'Authorization' => 'Bearer ' . (string) MISSIONMED_SUPABASE_SERVICE_KEY,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            );

            $args = array(
                'method' => strtoupper((string) $method),
                'headers' => $headers,
                'timeout' => 25,
            );
            if ($body !== null) {
                $args['body'] = wp_json_encode($body);
            }

            $response = wp_remote_request($url, $args);
            if (is_wp_error($response)) {
                return array(
                    'ok' => false,
                    'status' => 0,
                    'error' => $response->get_error_message(),
                    'data' => null,
                    'raw' => null,
                );
            }

            $status = (int) wp_remote_retrieve_response_code($response);
            $raw = (string) wp_remote_retrieve_body($response);
            $decoded = json_decode($raw, true);
            $ok = $status >= 200 && $status < 300;

            return array(
                'ok' => $ok,
                'status' => $status,
                'error' => $ok ? null : self::extract_supabase_error($decoded, $raw, $status),
                'data' => $decoded,
                'raw' => $raw,
            );
        }

        private static function extract_supabase_error($decoded, $raw, $status) {
            if (is_array($decoded)) {
                if (isset($decoded['message'])) {
                    return (string) $decoded['message'];
                }
                if (isset($decoded[0]) && is_array($decoded[0]) && isset($decoded[0]['message'])) {
                    return (string) $decoded[0]['message'];
                }
                if (isset($decoded['error'])) {
                    return (string) $decoded['error'];
                }
            }
            if ($raw !== '') {
                return trim($raw);
            }
            return 'Supabase request failed (HTTP ' . (int) $status . ').';
        }

        private static function first_row($data) {
            if (is_array($data) && isset($data[0]) && is_array($data[0])) {
                return $data[0];
            }
            if (is_array($data) && !empty($data) && self::is_assoc($data)) {
                return $data;
            }
            return null;
        }

        private static function rows($data) {
            if (!is_array($data)) {
                return array();
            }
            if (isset($data[0])) {
                return $data;
            }
            if (self::is_assoc($data)) {
                return array($data);
            }
            return array();
        }

        private static function is_assoc(array $arr) {
            if ($arr === array()) {
                return false;
            }
            return array_keys($arr) !== range(0, count($arr) - 1);
        }

        private static function is_uuid($value) {
            return (bool) preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', (string) $value);
        }

        private static function clean_text($value) {
            return sanitize_text_field((string) $value);
        }

        private static function clean_nullable_text($value) {
            if ($value === null || $value === '') {
                return null;
            }
            $clean = sanitize_text_field((string) $value);
            return $clean === '' ? null : $clean;
        }

        private static function clean_nullable_int($value) {
            if ($value === null || $value === '') {
                return null;
            }
            if (!is_numeric($value)) {
                return null;
            }
            return (int) $value;
        }

        private static function clean_nullable_float($value) {
            if ($value === null || $value === '') {
                return null;
            }
            if (!is_numeric($value)) {
                return null;
            }
            return (float) $value;
        }

        private static function coerce_nullable_bool($value) {
            if ($value === null || $value === '') {
                return null;
            }

            if ($value === true || $value === false) {
                return $value;
            }

            $normalized = strtolower(trim((string)$value));

            if (in_array($normalized, ['true','1','yes'], true)) {
                return true;
            }

            if (in_array($normalized, ['false','0','no'], true)) {
                return false;
            }

            return null; // any other value including "unknown"
        }

        private static function as_array($value) {
            return is_array($value) ? $value : array();
        }

        private static function coerce_iso8601($value) {
            $ts = strtotime((string) $value);
            if (!$ts) {
                return gmdate('c');
            }
            return gmdate('c', $ts);
        }
    }
}

MissionMed_RLQ_BFF::init();
