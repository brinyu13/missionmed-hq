<?php
/**
 * Plugin Name: MissionMed InterviewIQ SSO
 * Description: Isolated, default-off InterviewIQ identity and current-session proof.
 * Version: 1.0.0
 *
 * IIQ-1200 / DR-364, DR-365. No existing identity, role, enrollment or StoryForge
 * mapping is changed. The only provisioning write is an IIQ-owned UUID binding.
 */
if (!defined('ABSPATH')) { exit; }

function mmiiq_setting($name, $default = '') {
    $value = getenv($name);
    if ($value === false || $value === '') { $stored = get_option('missionmed_interviewiq_settings', array());
        $value = defined($name) ? constant($name) : (is_array($stored) ? ($stored[$name] ?? $default) : $default); }
    return is_scalar($value) ? trim((string) $value) : '';
}

function mmiiq_enabled() {
    return mmiiq_setting('INTERVIEWIQ_ENABLED', 'false') === 'true';
}

function mmiiq_error($code, $status = 403) {
    $messages = array(401 => 'Your MissionMed session has ended. Sign in again.',
        403 => 'InterviewIQ access is unavailable for this account.',
        405 => 'This request method is unavailable.',
        409 => 'The account binding requires reconciliation.',
        429 => 'Please wait before requesting another session.',
        503 => 'InterviewIQ authentication is temporarily unavailable.');
    return new WP_Error($code, $messages[$status] ?? 'The request could not be completed.', array('status' => $status));
}

function mmiiq_uuid($value) {
    return is_string($value) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $value) === 1;
}

function mmiiq_wp_origin() {
    $url = wp_parse_url(home_url('/'));
    if (!is_array($url) || ($url['scheme'] ?? '') !== 'https' || empty($url['host'])
        || isset($url['user']) || isset($url['pass'])) { return ''; }
    $origin = 'https://' . strtolower($url['host']) . (isset($url['port']) ? ':' . (int) $url['port'] : '');
    $configured = mmiiq_setting('INTERVIEWIQ_WP_ORIGIN', $origin);
    return hash_equals($origin, $configured) ? $origin : '';
}

function mmiiq_secrets_ready() {
    $jwt = mmiiq_setting('INTERVIEWIQ_JWT_SECRET');
    $proof = mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET');
    return strlen($jwt) >= 32 && strlen($proof) >= 32 && !hash_equals($jwt, $proof);
}

function mmiiq_origin_allowed($origin) {
    $expected = mmiiq_wp_origin();
    return $expected !== '' && is_string($origin) && hash_equals($expected, $origin);
}

/** Current owner policy, never the browser's persona or a cached UI tier. */
function mmiiq_access_for_user($user) {
    if (!($user instanceof WP_User) || !$user->exists()) { return mmiiq_error('session_required', 401); }
    if (user_can($user, 'manage_options')) {
        return array('role' => 'admin', 'tier' => 'admin', 'assignment_student_ids' => array());
    }
    if (!function_exists('mmhq_cam_restricted') || mmhq_cam_restricted((int) $user->ID)) {
        return mmiiq_error('owner_restricted_or_unavailable');
    }
    $roles = array_map('strtolower', (array) $user->roles);
    if (array_intersect($roles, array('mentor', 'advisor', 'coach'))) {
        if (mmiiq_setting('INTERVIEWIQ_LAUNCH_MODE', 'core') !== 'full') { return mmiiq_error('mentor_coming_soon'); }
        if (!function_exists('mmsf_assignment_student_ids')) { return mmiiq_error('assignment_owner_unavailable', 503); }
        $ids = mmsf_assignment_student_ids((int) $user->ID);
        if (!is_array($ids) || !$ids || count($ids) > 1000) { return mmiiq_error('mentor_unassigned'); }
        foreach ($ids as $id) { if (!mmiiq_uuid($id)) { return mmiiq_error('assignment_owner_invalid', 503); } }
        return array('role' => 'mentor', 'tier' => 'assigned_mentor',
            'assignment_student_ids' => array_values(array_unique($ids)));
    }
    if (!class_exists('MMED_Access_Gate') || !method_exists('MMED_Access_Gate', 'get_full_access_course_ids')
        || !function_exists('sfwd_lms_has_access') || !function_exists('ld_course_access_expired')) {
        return mmiiq_error('enrollment_owner_unavailable', 503);
    }
    $full_ids = array_map('intval', MMED_Access_Gate::get_full_access_course_ids());
    $current = static function ($option) use ($user, $full_ids) {
        $fallback = function_exists('mmed_hub_default_option_value') ? mmed_hub_default_option_value($option) : 0;
        $course = (int) get_option($option, $fallback);
        return $course > 0 && in_array($course, $full_ids, true)
            && sfwd_lms_has_access($course, (int) $user->ID)
            && !ld_course_access_expired($course, (int) $user->ID);
    };
    if ($current('mmed_course_360elite') && function_exists('mmhq_cam_build_entitlement')) {
        $grant = mmhq_cam_build_entitlement((int) $user->ID);
        if (is_array($grant) && !empty($grant['trusted']) && !empty($grant['verified']) && !empty($grant['active'])) {
            return array('role' => 'student', 'tier' => '360', 'assignment_student_ids' => array());
        }
    }
    if ($current('mmed_course_complete')) {
        return array('role' => 'student', 'tier' => 'ivprep_complete', 'assignment_student_ids' => array());
    }
    return mmiiq_error('eligibility_required');
}

/** Preserve canonical StoryForge IDs; only the separate IIQ meta may be created. */
function mmiiq_uuid_owned_only_by($uuid, $user_id) {
    if (!mmiiq_uuid($uuid) || !function_exists('get_users')) { return false; }
    $owners = get_users(array('fields' => 'ID', 'number' => 2, 'count_total' => false,
        'meta_query' => array('relation' => 'OR',
            array('key' => '_missionmed_storyforge_user_id', 'value' => $uuid, 'compare' => '='),
            array('key' => '_missionmed_interviewiq_user_id', 'value' => $uuid, 'compare' => '='))));
    if (!is_array($owners)) { return false; }
    foreach ($owners as $owner) { if ((int) $owner !== (int) $user_id) { return false; } }
    return true;
}

function mmiiq_actor_uuid($user_id, $provision = false) {
    $sf = function_exists('mmsf_storyforge_user_id')
        ? mmsf_storyforge_user_id($user_id) : get_user_meta($user_id, '_missionmed_storyforge_user_id', true);
    $sf = is_string($sf) ? strtolower(trim($sf)) : '';
    $own = get_user_meta($user_id, '_missionmed_interviewiq_user_id', true);
    $own = is_string($own) ? strtolower(trim($own)) : '';
    if (($sf !== '' && !mmiiq_uuid($sf)) || ($own !== '' && !mmiiq_uuid($own))
        || ($sf !== '' && $own !== '' && !hash_equals($sf, $own))) {
        return mmiiq_error('identity_binding_conflict', 409);
    }
    if (($sf !== '' && !mmiiq_uuid_owned_only_by($sf, $user_id))
        || ($own !== '' && !mmiiq_uuid_owned_only_by($own, $user_id))) {
        return mmiiq_error('identity_binding_conflict', 409);
    }
    if ($own !== '') { return $own; }
    if (!$provision) { return $sf !== '' ? $sf : mmiiq_error('identity_unmapped', 503); }
    $candidate = $sf !== '' ? $sf : strtolower(wp_generate_uuid4());
    if (!mmiiq_uuid($candidate)) { return mmiiq_error('identity_owner_unavailable', 503); }
    add_user_meta($user_id, '_missionmed_interviewiq_user_id', $candidate, true);
    $saved = get_user_meta($user_id, '_missionmed_interviewiq_user_id', true);
    if (!mmiiq_uuid($saved) || ($sf !== '' && !hash_equals($sf, $saved)) || !mmiiq_uuid_owned_only_by($saved, $user_id)) {
        return mmiiq_error('identity_binding_conflict', 409);
    }
    return $saved;
}

/**
 * The current owner backend stores SHA-256 token verifiers, not raw tokens.
 * An unknown backend fails closed. No session data leaves this function.
 */
function mmiiq_session_active($user_id, $verifier, $now = null) {
    if (!is_int($user_id) || $user_id < 1 || !is_string($verifier)
        || !preg_match('/^[a-f0-9]{64}$/D', $verifier) || !class_exists('WP_Session_Tokens')) { return false; }
    if (get_class(WP_Session_Tokens::get_instance($user_id)) !== 'WP_User_Meta_Session_Tokens') { return false; }
    $sessions = get_user_meta($user_id, 'session_tokens', true);
    $entry = is_array($sessions) ? ($sessions[$verifier] ?? null) : null;
    $expiry = is_int($entry) ? $entry : (is_array($entry) ? ($entry['expiration'] ?? null) : null);
    return is_int($expiry) && $expiry > ($now ?? time());
}

function mmiiq_browser_identity($provision = false) {
    if (!mmiiq_enabled() || !mmiiq_secrets_ready() || mmiiq_wp_origin() === '') {
        return mmiiq_error('interviewiq_disabled_or_unconfigured', 503);
    }
    $user = wp_get_current_user();
    $grant = mmiiq_access_for_user($user);
    if (is_wp_error($grant)) { return $grant; }
    $token = wp_get_session_token();
    if (!is_string($token) || $token === '') { return mmiiq_error('session_required', 401); }
    $verifier = hash('sha256', $token);
    if (!mmiiq_session_active((int) $user->ID, $verifier)) { return mmiiq_error('session_revoked', 401); }
    $id = mmiiq_actor_uuid((int) $user->ID, $provision);
    if (is_wp_error($id)) { return $id; }
    return array('id' => $id, 'wp_user_id' => (int) $user->ID,
        'role' => $grant['role'], 'tier' => $grant['tier'],
        'display_name' => mb_substr((string) $user->display_name, 0, 120),
        'session_verifier' => $verifier);
}

function mmiiq_public_actor($actor) {
    return array_intersect_key($actor, array_flip(array('id', 'wp_user_id', 'role', 'tier', 'display_name')));
}

function mmiiq_b64url($value) { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }

function mmiiq_issue_token($actor, $now = null) {
    if (!mmiiq_secrets_ready() || mmiiq_wp_origin() === '' || !mmiiq_uuid($actor['id'] ?? null)
        || !in_array($actor['role'] ?? '', array('student', 'mentor', 'admin'), true)
        || !mmiiq_session_active($actor['wp_user_id'] ?? null, $actor['session_verifier'] ?? null)) {
        return mmiiq_error('session_required', 401);
    }
    $now = $now ?? time();
    $payload = array('iss' => mmiiq_wp_origin(), 'aud' => 'interviewiq', 'sub' => $actor['id'],
        'wp_user_id' => $actor['wp_user_id'], 'app_role' => $actor['role'], 'tier' => $actor['tier'],
        'name' => (string) ($actor['display_name'] ?? ''),
        'interviewiq_eligible' => true, 'session_verifier' => $actor['session_verifier'],
        'jti' => strtolower(wp_generate_uuid4()), 'iat' => $now, 'nbf' => $now - 2, 'exp' => $now + 60);
    $unsigned = mmiiq_b64url(wp_json_encode(array('alg' => 'HS256', 'typ' => 'JWT')))
        . '.' . mmiiq_b64url(wp_json_encode($payload));
    return array('token' => $unsigned . '.' . mmiiq_b64url(hash_hmac('sha256', $unsigned, mmiiq_setting('INTERVIEWIQ_JWT_SECRET'), true)),
        'expires_at' => $now + 60, 'ttl_seconds' => 60,
        'nonce' => wp_create_nonce('missionmed_interviewiq'), 'actor' => mmiiq_public_actor($actor));
}

/** Bind the browser bearer to its independently authenticated WP cookie. */
function mmiiq_browser_bearer_valid($authorization, $actor, $now = null) {
    if (!is_string($authorization) || strlen($authorization) > 16384 || !is_array($actor)
        || !preg_match('/^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/D', $authorization, $parts)) { return false; }
    $signature = mmiiq_b64url(hash_hmac('sha256', $parts[1] . '.' . $parts[2], mmiiq_setting('INTERVIEWIQ_JWT_SECRET'), true));
    if (!hash_equals($signature, $parts[3])) { return false; }
    $decode = static function ($part) {
        $raw = base64_decode(strtr($part, '-_', '+/'), true);
        return is_string($raw) && mmiiq_b64url($raw) === $part ? json_decode($raw, true) : null;
    };
    $header = $decode($parts[1]); $claims = $decode($parts[2]);
    if (!is_array($header) || count($header) !== 2 || ($header['alg'] ?? '') !== 'HS256'
        || ($header['typ'] ?? '') !== 'JWT' || !is_array($claims)) { return false; }
    $now = $now ?? time();
    foreach (array('iat', 'nbf', 'exp', 'wp_user_id') as $field) { if (!is_int($claims[$field] ?? null)) { return false; } }
    return ($claims['iss'] ?? '') === mmiiq_wp_origin() && ($claims['aud'] ?? '') === 'interviewiq'
        && ($claims['sub'] ?? '') === ($actor['id'] ?? null) && $claims['wp_user_id'] === ($actor['wp_user_id'] ?? null)
        && ($claims['session_verifier'] ?? '') === ($actor['session_verifier'] ?? null)
        && ($claims['app_role'] ?? '') === ($actor['role'] ?? null) && ($claims['tier'] ?? '') === ($actor['tier'] ?? null)
        && ($claims['interviewiq_eligible'] ?? false) === true && mmiiq_uuid($claims['jti'] ?? null)
        && $claims['iat'] <= $now + 5 && $claims['nbf'] <= $now + 5 && $claims['exp'] > $now
        && $claims['exp'] > $claims['iat'] && $claims['exp'] - $claims['iat'] <= 90;
}

function mmiiq_private_headers() {
    if (headers_sent()) { return; }
    header('Cache-Control: private, no-store, no-cache, max-age=0, must-revalidate');
    header('Pragma: no-cache');
    header('Vary: Cookie, Authorization');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Robots-Tag: noindex, nofollow, noarchive');
}

function mmiiq_ajax_response($result) {
    mmiiq_private_headers();
    if (is_wp_error($result)) {
        wp_send_json(array('error' => array('code' => $result->get_error_code(), 'message' => $result->get_error_message())),
            (int) ($result->get_error_data()['status'] ?? 403));
    }
    wp_send_json($result, 200);
}

function mmiiq_browser_request($require_nonce) {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { return mmiiq_error('method_not_allowed', 405); }
    if (!mmiiq_origin_allowed($_SERVER['HTTP_ORIGIN'] ?? '')) { return mmiiq_error('origin_not_allowed'); }
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($site !== '' && $site !== 'same-origin') { return mmiiq_error('origin_not_allowed'); }
    if ($require_nonce && !wp_verify_nonce($_SERVER['HTTP_X_IIQ_NONCE'] ?? '', 'missionmed_interviewiq')) {
        return mmiiq_error('csrf_failed');
    }
    return true;
}

function mmiiq_ajax_bootstrap() {
    $permission = mmiiq_browser_request(false);
    if (is_wp_error($permission)) { mmiiq_ajax_response($permission); return; }
    $actor = mmiiq_browser_identity(true);
    if (is_wp_error($actor)) { mmiiq_ajax_response($actor); return; }
    mmiiq_ajax_response(array('nonce' => wp_create_nonce('missionmed_interviewiq'),
        'token_endpoint' => '/wp-admin/admin-ajax.php?action=missionmed_interviewiq_token',
        'api_base' => '/interviewiq/api', 'expires_in' => 60, 'actor' => mmiiq_public_actor($actor)));
}

function mmiiq_ajax_token() {
    $permission = mmiiq_browser_request(true);
    if (is_wp_error($permission)) { mmiiq_ajax_response($permission); return; }
    $actor = mmiiq_browser_identity(true);
    mmiiq_ajax_response(is_wp_error($actor) ? $actor : mmiiq_issue_token($actor));
}

/** Validate a server-only request without accepting any client role/assignment. */
function mmiiq_introspection_permission($request) {
    if (!mmiiq_enabled() || !mmiiq_secrets_ready() || mmiiq_wp_origin() === '') {
        return mmiiq_error('interviewiq_disabled_or_unconfigured', 503);
    }
    $body = (string) $request->get_body();
    $signature = (string) $request->get_header('x-mmed-iiq-proof');
    if ($request->get_method() !== 'POST' || $request->get_header('origin') !== ''
        || strlen($body) > 4096 || strlen($body) < 2 || !preg_match('/^[a-f0-9]{64}$/D', $signature)
        || !hash_equals(hash_hmac('sha256', "mmiiq-introspection-request-v1\n" . $body,
            mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET')), $signature)) {
        return mmiiq_error('owner_proof_denied');
    }
    $input = json_decode($body, true);
    if (!is_array($input)) { return mmiiq_error('owner_proof_invalid'); }
    $keys = array_keys($input); sort($keys);
    $required = array('audience', 'iat', 'nonce', 'session_verifier', 'subject', 'wp_user_id');
    $with_action = array_merge(array('action'), $required);
    if (($keys !== $required && $keys !== $with_action)
        || (array_key_exists('action', $input) && (!is_string($input['action']) || strlen($input['action']) > 200
            || !preg_match('#^(GET|POST|PUT|PATCH|DELETE) /api/[A-Za-z0-9_./-]+$#D', $input['action'])))
        || $input['audience'] !== 'interviewiq-owner-introspection' || !mmiiq_uuid($input['subject'])
        || !mmiiq_uuid($input['nonce']) || !is_int($input['wp_user_id']) || $input['wp_user_id'] < 1
        || !is_string($input['session_verifier']) || !preg_match('/^[a-f0-9]{64}$/D', $input['session_verifier'])
        || !is_int($input['iat']) || $input['iat'] > time() + 5 || $input['iat'] < time() - 30) {
        return mmiiq_error('owner_proof_invalid');
    }
    return true;
}

function mmiiq_introspection($request) {
    $permission = mmiiq_introspection_permission($request);
    if ($permission !== true) { return $permission; }
    $input = json_decode((string) $request->get_body(), true);
    $active = mmiiq_session_active($input['wp_user_id'], $input['session_verifier']);
    $user = $active ? get_user_by('id', $input['wp_user_id']) : false;
    $grant = mmiiq_access_for_user($user);
    $uuid = $active ? mmiiq_actor_uuid($input['wp_user_id'], false) : null;
    $allowed = $active && !is_wp_error($grant) && is_string($uuid) && hash_equals($input['subject'], $uuid);
    $now = time();
    $payload = wp_json_encode(array('audience' => 'interviewiq-owner-introspection',
        'subject' => $input['subject'], 'wp_user_id' => $input['wp_user_id'],
        'session_verifier' => $input['session_verifier'], 'nonce' => $input['nonce'],
        'request_sha256' => hash('sha256', (string) $request->get_body()),
        'source' => 'wordpress_current_interviewiq_owner', 'allowed' => $allowed,
        'role' => $allowed ? $grant['role'] : null, 'tier' => $allowed ? $grant['tier'] : null,
        'assignment_student_ids' => $allowed && $grant['role'] === 'mentor' ? $grant['assignment_student_ids'] : array(),
        'iat' => $now, 'exp' => $now + 30));
    $response = new WP_REST_Response(array('payload' => $payload,
        'signature' => hash_hmac('sha256', "mmiiq-introspection-response-v1\n" . $payload,
            mmiiq_setting('INTERVIEWIQ_OWNER_PROOF_SECRET'))), 200);
    $response->header('Cache-Control', 'private, no-store, no-cache, max-age=0');
    $response->header('Vary', 'Authorization');
    return $response;
}

function mmiiq_register_rest() {
    register_rest_route('missionmed-interviewiq/v1', '/introspect', array('methods' => 'POST',
        'permission_callback' => 'mmiiq_introspection_permission', 'callback' => 'mmiiq_introspection'));
}
add_action('rest_api_init', 'mmiiq_register_rest');
add_action('wp_ajax_missionmed_interviewiq_bootstrap', 'mmiiq_ajax_bootstrap');
add_action('wp_ajax_nopriv_missionmed_interviewiq_bootstrap', 'mmiiq_ajax_bootstrap');
add_action('wp_ajax_missionmed_interviewiq_token', 'mmiiq_ajax_token');
add_action('wp_ajax_nopriv_missionmed_interviewiq_token', 'mmiiq_ajax_token');
