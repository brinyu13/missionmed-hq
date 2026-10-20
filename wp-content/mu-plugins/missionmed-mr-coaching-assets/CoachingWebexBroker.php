<?php
declare(strict_types=1);
/** PRIVATE candidate. New coaching resources only; legacy broker untouched. */
require_once __DIR__ . '/CoachingProviderContainment.php';

function mmed_coaching_webex_scope(string $scopes): string {
    $parts = preg_split('/\s+/', trim($scopes));
    if (!in_array('meeting:recordings_write', $parts, true)) { $parts[] = 'meeting:recordings_write'; }
    return implode(' ', $parts);
}

function mmed_coaching_webex_register(): void {
    register_rest_route('missionmed-scheduler/v1', '/coaching/webex', [
        'methods' => 'POST', 'permission_callback' => 'mm_scheduler_webex_broker_can_access',
        'callback' => 'mmed_coaching_webex_request',
    ]);
}

/** Keep only this integration's reviewed OAuth pair authoritative after snippets. */
function mmed_coaching_webex_register_oauth(): void {
    register_rest_route('mmed/v1', '/admin/webex/auth-url', [
        'methods' => 'GET', 'permission_callback' => 'mm_scheduler_webex_admin_can_manage',
        'callback' => 'mm_scheduler_webex_admin_auth_url',
    ], true);
    register_rest_route('mmed/v1', '/admin/webex/callback', [
        'methods' => 'GET', 'permission_callback' => 'mm_scheduler_webex_admin_can_manage',
        'callback' => 'mm_scheduler_webex_admin_oauth_callback',
    ], true);
}

/** HMAC is checked by REST before this callback. Persisted binding, not the
 * incoming meeting id, determines EVERY destructive target. Client IDs/URLs
 * are never accepted. A crashed operation lock requires staff investigation.
 */
function mmed_coaching_webex_request($request) {
    $input = $request->get_json_params();
    if (!is_array($input) || array_diff(array_keys($input), ['action','appointment_id','unit_id','meeting','invitee'])
        || !in_array($input['action'] ?? '', ['create','recordings','revoke'], true)
        || !is_string($input['appointment_id'] ?? null) || !is_string($input['unit_id'] ?? null)
        || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/Di', $input['appointment_id'] ?? '')
        || !preg_match('/^coaching-unit:v1:[1-9][0-9]*:[1-9][0-9]*:(mock|strategy|debrief):[1-9][0-9]*$/D', $input['unit_id'] ?? '')) {
        return new WP_Error('coaching_provider_binding_invalid', 'Exact coaching appointment binding required.', ['status' => 400]);
    }
    $key = 'mmed_mr_coaching_provider_' . hash('sha256', $input['appointment_id']);
    $lock = $key . '_lock';
    if (!add_option($lock, ['created_at' => time()], '', false)) {
        return new WP_Error('coaching_provider_operation_locked', 'Provider operation is awaiting reconciliation.', ['status' => 409]);
    }
    try {
        $binding = get_option($key, null);
        $host = trim((string) get_option('mmed_webex_host_email', ''));
        if ($host === '' || !is_email($host)) { throw new DomainException('same_host_configuration_required'); }
        if ($binding !== null && (!is_array($binding)
            || ($binding['unit_id'] ?? null) !== $input['unit_id']
            || ($binding['appointment_id'] ?? null) !== $input['appointment_id']
            || ($binding['host'] ?? null) !== $host)) { throw new DomainException('owned_provider_binding_mismatch'); }
        $save = static function(array $value) use ($key): void {
            if (get_option($key, null) === null) { add_option($key, $value, '', false); }
            else { update_option($key, $value, false); }
            if (get_option($key, null) !== $value) { throw new DomainException('provider_binding_not_persisted'); }
        };
        if ($input['action'] === 'create') {
            if ($binding !== null) {
                if (($binding['revoked'] ?? true) || empty($binding['creation_result'])) { throw new DomainException('provider_creation_closed'); }
                return rest_ensure_response($binding['creation_result']);
            }
            if (!is_array($input['meeting'] ?? null) || !is_array($input['invitee'] ?? null)) { throw new DomainException('provider_creation_payload_required'); }
            // Persist initializing before external mutation; unknown outcome is
            // not retried and cannot create a second provider meeting.
            $binding = ['appointment_id' => $input['appointment_id'], 'unit_id' => $input['unit_id'],
                'host' => $host, 'revoked' => false, 'cleanup_state' => 'initializing', 'recording_ids' => []];
            $save($binding);
            $meeting = $input['meeting'];
            $result = mm_scheduler_webex_broker_rest_create_meeting([
                'title' => sanitize_text_field($meeting['title'] ?? ''),
                'start' => sanitize_text_field($meeting['start'] ?? ''),
                'end' => sanitize_text_field($meeting['end'] ?? ''),
                'timezone' => sanitize_text_field($meeting['timezone'] ?? 'America/New_York'),
                'auto_record' => mm_scheduler_webex_broker_truthy($meeting['enabledAutoRecordMeeting'] ?? false),
            ]);
            if (is_wp_error($result)) { return mm_scheduler_webex_broker_error($result, 'coaching_meeting_create_failed'); }
            // The legacy invitee helper sends provider emails unconditionally.
            // Coaching instead uses the canonical guarded notification outbox.
            $url = esc_url_raw($result['webLink'] ?? $result['joinWebUrl'] ?? '');
            $data = ['ok' => $url !== '', 'provider' => 'webex', 'id' => $result['id'] ?? '',
                'external_event_id' => $result['id'] ?? '', 'meeting_url' => $url,
                'invitee' => ['status' => 'suppressed', 'invitee_email_sent' => false]];
            if (empty($data['ok']) || !preg_match('/^[A-Za-z0-9_=-]{1,512}$/D', $data['id'] ?? '')) { throw new DomainException('provider_creation_unverified'); }
            // Retain the known ID even if same-host verification times out.
            // This is non-issuable until the verified creation result is saved.
            $binding['meeting_id'] = $data['id'];
            $binding['cleanup_state'] = 'created_unverified'; $save($binding);
            $detail = mmed_coaching_webex_api('GET', '/meetings/' . rawurlencode($data['id']));
            if ($detail['status'] !== 200 || strtolower((string) ($detail['body']['hostEmail'] ?? '')) !== strtolower($host)) {
                throw new DomainException('created_provider_same_host_unverified');
            }
            $binding['meeting_id'] = $data['id']; $binding['creation_result'] = $data;
            $binding['cleanup_state'] = 'active'; $save($binding);
            return rest_ensure_response($data);
        }
        if ($binding === null || empty($binding['meeting_id'])) { throw new DomainException('persisted_provider_binding_required'); }
        if ($input['action'] === 'revoke') {
            if (($binding['revoked'] ?? false) === true && ($binding['cleanup_state'] ?? '') === 'provider_resources_absent'
                && ($binding['cleanup_evidence']['meeting_absent'] ?? false) === true) {
                return rest_ensure_response(['ok' => true, 'evidence' => $binding['cleanup_evidence'], 'idempotent_replay' => true]);
            }
            $attempts = $binding['cleanup_attempts'] ?? 0;
            if (!is_int($attempts) || $attempts < 0 || $attempts >= 3) { throw new DomainException('provider_cleanup_bounded_staff_review'); }
            $binding['cleanup_attempts'] = $attempts + 1; $binding['revoked'] = true;
            $binding['cleanup_state'] = 'pending'; $save($binding);
            $policy = new CoachingProviderContainment(Closure::fromCallable('mmed_coaching_webex_api'), $save);
            return rest_ensure_response(['ok' => true, 'evidence' => $policy->revoke($binding, $input['appointment_id'], $input['unit_id'], $host)]);
        }
        if (($binding['revoked'] ?? true) === true || ($binding['cleanup_state'] ?? '') !== 'active'
            || empty($binding['creation_result'])) { throw new DomainException('provider_access_revoked_or_unverified'); }
        $listing = mmed_coaching_webex_api('GET', '/recordings?meetingId=' . rawurlencode($binding['meeting_id']) . '&max=100');
        if ($listing['status'] !== 200 || !is_array($listing['body']['items'] ?? null)
            || count($listing['body']['items']) > 20 || !empty($listing['next'])) { throw new DomainException('complete_recording_inventory_required'); }
        $recordings = [];
        foreach ($listing['body']['items'] as $raw) {
            if (!is_array($raw) || !preg_match('/^[A-Za-z0-9_=-]{1,512}$/D', $raw['id'] ?? '')
                || !in_array($binding['meeting_id'], [$raw['meetingId'] ?? null, $raw['scheduledMeetingId'] ?? null, $raw['meetingSeriesId'] ?? null], true)) {
                throw new DomainException('exact_recording_meeting_binding_required');
            }
            $binding['recording_ids'][] = $raw['id'];
            $recordings[] = mm_scheduler_webex_broker_normalize_recording($raw);
        }
        $binding['recording_ids'] = array_values(array_unique($binding['recording_ids']));
        $save($binding); // Never issue an unregistered copied playback link.
        return rest_ensure_response(['ok' => true, 'recordings' => $recordings, 'meeting_id' => $binding['meeting_id']]);
    } catch (Throwable $error) {
        // Do not disclose provider payloads/tokens/URLs in error responses.
        return new WP_Error('coaching_provider_review_required', 'Provider access requires secure staff review.', ['status' => 503]);
    } finally { delete_option($lock); }
}

function mmed_coaching_webex_api(string $method, string $path): array {
    if (!in_array($method, ['GET','DELETE'], true)
        || !preg_match('~^/(meetings/[A-Za-z0-9_%=-]+|recordings(?:/[A-Za-z0-9_%=-]+|\?meetingId=[A-Za-z0-9_%=-]+&max=100))$~D', $path)
        || mm_scheduler_webex_broker_api_base() !== 'https://webexapis.com/v1') {
        throw new DomainException('fixed_provider_endpoint_required');
    }
    $token = mm_scheduler_webex_broker_access_token();
    if (is_wp_error($token)) { throw new DomainException('provider_auth_unavailable'); }
    $response = wp_remote_request('https://webexapis.com/v1' . $path, [
        'method' => $method, 'redirection' => 0, 'timeout' => 20,
        'headers' => ['Authorization' => 'Bearer ' . $token, 'Accept' => 'application/json'],
        'limit_response_size' => 262144,
    ]);
    if (is_wp_error($response)) { throw new DomainException('provider_unavailable'); }
    $data = json_decode(wp_remote_retrieve_body($response), true);
    $link = wp_remote_retrieve_header($response, 'link');
    return ['status' => (int) wp_remote_retrieve_response_code($response),
        // Bounded one-page inventory: ANY Link header requires review rather
        // than risk accepting a partial inventory (quoted/unquoted/array).
        'body' => is_array($data) ? $data : [], 'next' => !empty($link)];
}
