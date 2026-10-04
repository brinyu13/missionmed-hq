<?php
/** Dedicated, default-off InterviewIQ -> RISE current-session proof. */
if (!defined('ABSPATH')) { exit; }

function mmiiq_rise_setting($key, $fallback = '') {
    if (defined($key)) { $value = constant($key); return $value === false ? $fallback : $value; }
    $value = getenv($key);
    if ($value !== false) { return $value; }
    // Dedicated server-only settings follow the existing MissionMed option pattern.
    // Provisioning must keep this option nonautoloaded; this reader never writes it.
    $allowed = array('RISE_IIQ_ENABLED', 'RISE_IIQ_OWNER_PROOF_SECRET', 'RISE_IIQ_OWNER_REQUEST_SECRET',
        'RISE_IIQ_JOB_ENABLED', 'RISE_IIQ_JOB_ELIGIBILITY_SECRET', 'RISE_IIQ_JOB_REQUEST_SECRET', 'RISE_IIQ_JOB_PROOF_SECRET');
    if (!in_array($key, $allowed, true) || !function_exists('get_option')) { return $fallback; }
    $stored = get_option('missionmed_rise_interviewiq_settings', array());
    return is_array($stored) && array_key_exists($key, $stored) && is_scalar($stored[$key]) ? $stored[$key] : $fallback;
}
function mmiiq_rise_error() { return new WP_Error('interviewiq_owner_unavailable', 'Owner proof unavailable.', array('status' => 403)); }
function mmiiq_rise_uuid($x) { return is_string($x) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $x); }
function mmiiq_rise_hex($x) { return is_string($x) && preg_match('/^[a-f0-9]{64}$/D', $x); }

function mmiiq_rise_flat_json($raw, $keys) {
    if (!is_string($raw) || strlen($raw) > 16384) { return false; }
    $object = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE || !($object instanceof stdClass)) { return false; }
    $data = get_object_vars($object);
    if (count($data) !== count($keys) || array_diff(array_keys($data), $keys)) { return false; }
    foreach ($data as $value) { if (is_array($value) || is_object($value)) { return false; } }
    preg_match_all('/"(?:[^"\\\\]|\\\\.)*"/s', $raw, $matches, PREG_OFFSET_CAPTURE);
    $seen = array();
    foreach ($matches[0] as $match) {
        if (!preg_match('/^\s*:/', substr($raw, $match[1] + strlen($match[0])))) { continue; }
        $key = json_decode($match[0], true);
        if (!is_string($key) || !in_array($key, $keys, true) || isset($seen[$key])) { return false; }
        $seen[$key] = true;
    }
    return count($seen) === count($keys) ? $data : false;
}

function mmiiq_rise_action($action) {
    $prefix = 'GET /api/rise/v1/interviewiq/programs';
    if (!is_string($action) || strlen($action) > 4100 || strpos($action, $prefix) !== 0) { return false; }
    $suffix = substr($action, strlen($prefix));
    if (substr($suffix, 0, 1) === '/') {
        $encoded = substr($suffix, 1); $id = rawurldecode($encoded);
        return preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/D', $id) && rawurlencode($id) === $encoded;
    }
    if (!preg_match('/^\?q=([^&]*)&page=([1-9][0-9]{0,4})&pageSize=([1-9][0-9]?)$/D', $suffix, $m)) { return false; }
    $q = urldecode($m[1]);
    if (!function_exists('iconv') || !preg_match('//u', $q) || preg_match('/[\x00-\x1f\x7f]/', $q) || strlen(iconv('UTF-8', 'UTF-16LE', $q)) > 512) { return false; }
    return str_replace('%2A', '*', urlencode($q)) === $m[1] && (int) $m[2] <= 10000 && (int) $m[3] <= 20;
}

// REST's default encoding is not the signed representation. Only this dedicated
// response class is emitted verbatim by the scoped serve hook below.
class MMIIQ_Rise_Proof_Response extends WP_REST_Response {
    private $wire;
    public function __construct($payload, $secret) {
        $this->wire = wp_json_encode($payload);
        parent::__construct($payload, 200, array('Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store',
            'X-MMED-IIQ-Owner-Proof' => hash_hmac('sha256', "iiq-owner-proof-v1\nresponse\n" . $this->wire, $secret)));
    }
    public function wire() { return $this->wire; }
}
function mmiiq_rise_serve($served, $result, $request, $server) {
    if (!$served && $request->get_route() === '/missionmed/v1/interviewiq-owner/rise/introspect' && $result instanceof MMIIQ_Rise_Proof_Response) {
        echo $result->wire();
        return true;
    }
    return $served;
}

function mmiiq_rise_introspect($request) {
    try {
        $enabled = mmiiq_rise_setting('RISE_IIQ_ENABLED', false);
        $secret = mmiiq_rise_setting('RISE_IIQ_OWNER_PROOF_SECRET');
        if (!in_array($enabled, array(true, 'true', '1'), true) || !is_string($secret) || strlen($secret) < 32 || $request->get_method() !== 'POST' ||
            $request->get_route() !== '/missionmed/v1/interviewiq-owner/rise/introspect' || $request->get_query_params() !== array()) { return mmiiq_rise_error(); }
        $headers = $request->get_headers(); $signature = null;
        $media = null;
        foreach ($headers as $key => $values) {
            $name = strtolower(str_replace('_', '-', $key));
            if (in_array($name, array('origin', 'cookie', 'authorization', 'x-mmed-consumer', 'x-http-method-override', 'x-method-override'), true)) { return mmiiq_rise_error(); }
            if ($name === 'content-type') {
                if ($media !== null || !is_array($values) || count($values) !== 1 || !is_string($values[0]) ||
                    !preg_match('/^application\/json(?:\s*;\s*charset=utf-8)?$/iD', $values[0])) { return mmiiq_rise_error(); }
                $media = $values[0];
            }
            if ($name === 'x-mmed-iiq-owner-proof') {
                if ($signature !== null || !is_array($values) || count($values) !== 1 || !mmiiq_rise_hex($values[0])) { return mmiiq_rise_error(); }
                $signature = $values[0];
            }
        }
        $raw = $request->get_body();
        if ($media === null || !is_string($raw) || strlen($raw) > 16384 || !is_string($signature) ||
            !hash_equals(hash_hmac('sha256', "iiq-owner-proof-v1\nrequest\n" . $raw, $secret), $signature)) { return mmiiq_rise_error(); }
        $p = mmiiq_rise_flat_json($raw, array('audience', 'nonce', 'subject', 'wp_user_id', 'session_verifier', 'action', 'request_sha256'));
        if (!$p || $p['audience'] !== 'interviewiq-rise-owner-proof' || !mmiiq_rise_uuid($p['nonce']) || !mmiiq_rise_uuid($p['subject']) ||
            !is_int($p['wp_user_id']) || $p['wp_user_id'] < 1 || !mmiiq_rise_hex($p['session_verifier']) || !mmiiq_rise_hex($p['request_sha256']) || !mmiiq_rise_action($p['action'])) { return mmiiq_rise_error(); }
        foreach (array('mmiiq_access_for_user', 'mmiiq_actor_uuid', 'mmiiq_session_active', 'mmhq_cam_restricted') as $dependency) {
            if (!function_exists($dependency)) { return mmiiq_rise_error(); }
        }
        // add_option() is an upsert, not a replay-safe insert-only operation.
        // Require the canonical options unique(option_name) index at activation.
        // No cache, update or deletion path; retention exceeds 90 seconds.
        global $wpdb;
        if (!is_object($wpdb) || !isset($wpdb->options) || !is_string($wpdb->options) ||
            !preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->options)) { return mmiiq_rise_error(); }
        $nonce_key = '_mmiiq_rise_proof_' . hash('sha256', $p['audience'] . ':' . $p['nonce']);
        $claim = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, %s)",
            $nonce_key, (string) (time() + 90), 'no'));
        if ($claim !== 1) { return mmiiq_rise_error(); }
        $id = $p['wp_user_id'];
        if (mmhq_cam_restricted($id) || !mmiiq_session_active($id, $p['session_verifier'])) { return mmiiq_rise_error(); }
        $subject = mmiiq_actor_uuid($id, false);
        if (!is_string($subject) || !hash_equals($p['subject'], $subject)) { return mmiiq_rise_error(); }
        $grant = mmiiq_access_for_user(get_user_by('id', $id));
        if (is_wp_error($grant) || !is_array($grant)) { return mmiiq_rise_error(); }
        $role = $grant['role'] ?? ''; $tier = $grant['tier'] ?? '';
        if (!(($role === 'admin' && $tier === 'admin') || ($role === 'student' && in_array($tier, array('360', 'ivprep_complete'), true)))) { return mmiiq_rise_error(); }
        $now = time();
        return new MMIIQ_Rise_Proof_Response(array('audience' => $p['audience'], 'nonce' => $p['nonce'], 'request_sha256' => $p['request_sha256'],
            'subject' => $subject, 'wp_user_id' => $id, 'session_verifier' => $p['session_verifier'], 'allowed' => true,
            'role' => $role, 'tier' => $tier, 'iat' => $now, 'exp' => $now + 30), $secret);
    } catch (Throwable $error) { return mmiiq_rise_error(); }
}
// Public-program jobs have separate service authority. They never authenticate
// a browser, retain a session verifier, or grant access to private student work.
function mmiiq_rise_job_introspect($request) {
    try {
        $enabled = mmiiq_rise_setting('RISE_IIQ_JOB_ENABLED', false);
        $secret = mmiiq_rise_setting('RISE_IIQ_JOB_ELIGIBILITY_SECRET');
        if (!in_array($enabled, array(true, 'true', '1'), true) || !is_string($secret) || strlen($secret) < 32 || strlen($secret) > 1024 ||
            $request->get_method() !== 'POST' || $request->get_route() !== '/missionmed/v1/interviewiq-owner/rise/job-introspect' ||
            $request->get_query_params() !== array()) { return mmiiq_rise_error(); }
        // The canonical issuer uses env-first, then constants/options, and trims
        // values. Its own resolver is required; a different precedence can hide
        // an active key collision behind an unused configuration value.
        if (!function_exists('mmiiq_setting')) { return mmiiq_rise_error(); }
        foreach (array('INTERVIEWIQ_JWT_SECRET', 'INTERVIEWIQ_OWNER_PROOF_SECRET', 'INTERVIEWIQ_GATEWAY_SECRET') as $key) {
            $other = mmiiq_setting($key);
            if (!is_string($other) || strlen($other) < 32 || hash_equals($secret, $other)) { return mmiiq_rise_error(); }
        }
        foreach (array('RISE_IIQ_OWNER_PROOF_SECRET', 'RISE_IIQ_OWNER_REQUEST_SECRET', 'RISE_IIQ_JOB_REQUEST_SECRET', 'RISE_IIQ_JOB_PROOF_SECRET', 'MMED_JWT_SECRET') as $key) {
            $other = mmiiq_rise_setting($key);
            if (!is_string($other) || ($other !== '' && hash_equals($secret, $other))) { return mmiiq_rise_error(); }
        }
        $raw = $request->get_body(); $headers = $request->get_headers(); $normalized = array();
        if (!is_string($raw) || strlen($raw) < 1 || strlen($raw) > 16384 || !is_array($headers) || count($headers) > 50) { return mmiiq_rise_error(); }
        foreach ($headers as $key => $values) {
            if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]+$/D', $key) || !is_array($values) || count($values) !== 1 ||
                !is_string($values[0]) || preg_match('/[\x00-\x1f\x7f]/', $values[0])) { return mmiiq_rise_error(); }
            $name = strtolower(str_replace('_', '-', $key));
            if (isset($normalized[$name]) || in_array($name, array('origin', 'cookie', 'cookie2', 'authorization', 'proxy-authorization',
                'transfer-encoding', 'content-encoding', 'expect', 'x-http-method-override', 'x-method-override', 'x-http-method'), true) ||
                (strpos($name, 'x-mmed-') === 0 && $name !== 'x-mmed-iiq-job-eligibility')) { return mmiiq_rise_error(); }
            $normalized[$name] = $values[0];
        }
        $signature = $normalized['x-mmed-iiq-job-eligibility'] ?? null;
        if (!preg_match('/^application\/json(?:\s*;\s*charset=utf-8)?$/iD', $normalized['content-type'] ?? '') ||
            (isset($normalized['content-length']) && $normalized['content-length'] !== (string) strlen($raw)) || !mmiiq_rise_hex($signature) ||
            !hash_equals(hash_hmac('sha256', "iiq-job-eligibility-v1\nrequest\n" . $raw, $secret), $signature)) { return mmiiq_rise_error(); }
        $keys = array('audience', 'nonce', 'iat', 'subject', 'wp_user_id', 'requestId', 'demandId', 'interviewId', 'programId', 'registryReleaseId', 'phase', 'request_sha256');
        $p = mmiiq_rise_flat_json($raw, $keys); $now = time();
        if (!$p || $p['audience'] !== 'interviewiq-rise-job-proof' || !is_int($p['iat']) || abs($now - $p['iat']) > 30 || $p['iat'] + 30 <= $now ||
            !is_int($p['wp_user_id']) || $p['wp_user_id'] < 1 || $p['wp_user_id'] > 9007199254740991 || !mmiiq_rise_hex($p['request_sha256']) ||
            !in_array($p['phase'], array('reserve', 'start', 'publish'), true)) { return mmiiq_rise_error(); }
        foreach (array('nonce', 'subject', 'requestId', 'demandId', 'interviewId') as $key) {
            if (!mmiiq_rise_uuid($p[$key])) { return mmiiq_rise_error(); }
        }
        foreach (array('programId', 'registryReleaseId') as $key) {
            if (!is_string($p[$key]) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/D', $p[$key])) { return mmiiq_rise_error(); }
        }
        foreach (array('mmiiq_access_for_user', 'mmiiq_actor_uuid', 'mmhq_cam_restricted', 'get_user_by') as $dependency) {
            if (!function_exists($dependency)) { return mmiiq_rise_error(); }
        }
        global $wpdb;
        if (!is_object($wpdb) || !isset($wpdb->options) || !is_string($wpdb->options) || !preg_match('/^[A-Za-z0-9_]+$/D', $wpdb->options)) { return mmiiq_rise_error(); }
        $nonce_key = '_mmiiq_rise_job_' . hash('sha256', $p['audience'] . ':' . $p['nonce']);
        $claim = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->options} (option_name, option_value, autoload) VALUES (%s, %s, %s)",
            $nonce_key, (string) ($now + 90), 'no'));
        if ($claim !== 1) { return mmiiq_rise_error(); }
        $id = $p['wp_user_id'];
        // Explicit false is required: absent/unknown restriction state cannot
        // take the administrator early-return path in the eligibility helper.
        if (mmhq_cam_restricted($id) !== false) { return mmiiq_rise_error(); }
        $user = get_user_by('id', $id);
        if (!($user instanceof WP_User) || (int) $user->ID !== $id || !$user->exists()) { return mmiiq_rise_error(); }
        $subject = mmiiq_actor_uuid($id, false);
        if (!is_string($subject) || !hash_equals($p['subject'], $subject)) { return mmiiq_rise_error(); }
        $grant = mmiiq_access_for_user($user);
        if (is_wp_error($grant) || !is_array($grant)) { return mmiiq_rise_error(); }
        $role = $grant['role'] ?? ''; $tier = $grant['tier'] ?? '';
        if (!(($role === 'admin' && $tier === 'admin') || ($role === 'student' && in_array($tier, array('360', 'ivprep_complete'), true)))) { return mmiiq_rise_error(); }
        $now = time(); $exp = min($p['iat'] + 30, $now + 30);
        if ($exp <= $now || $exp <= $p['iat'] || abs($now - $p['iat']) > 30) { return mmiiq_rise_error(); }
        $payload = wp_json_encode(array_merge($p, array('allowed' => true, 'role' => $role, 'tier' => $tier, 'exp' => $exp)));
        if (!is_string($payload)) { return mmiiq_rise_error(); }
        return new WP_REST_Response(array('payload' => $payload, 'signature' => hash_hmac('sha256', "iiq-job-eligibility-v1\nresponse\n" . $payload, $secret)),
            200, array('Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store'));
    } catch (Throwable $error) { return mmiiq_rise_error(); }
}

add_action('rest_api_init', static function () {
    register_rest_route('missionmed/v1', '/interviewiq-owner/rise/introspect', array('methods' => 'POST',
        'callback' => 'mmiiq_rise_introspect', 'permission_callback' => '__return_true'));
    register_rest_route('missionmed/v1', '/interviewiq-owner/rise/job-introspect', array('methods' => 'POST',
        'callback' => 'mmiiq_rise_job_introspect', 'permission_callback' => '__return_true'));
});
add_filter('rest_pre_serve_request', 'mmiiq_rise_serve', 10, 4);
