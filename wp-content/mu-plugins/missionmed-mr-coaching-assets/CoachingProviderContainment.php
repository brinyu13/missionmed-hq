<?php
declare(strict_types=1);

/** Private candidate: only newly owned, one-student coaching Webex resources.
 * Injected API returns ['status'=>int,'body'=>array]. Never accepts URLs/tokens.
 * The caller must hold an appointment-scoped lock, authenticate the existing
 * Scheduler service and derive revocation from canonical Woo/native usage.
 * This policy is NOT proof of live provider revocation.
 */
final class CoachingProviderContainment
{
    public function __construct(private Closure $api, private Closure $save) {}

    public function revoke(array $binding, string $appointmentId, string $unitId, string $host): array
    {
        if (!preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/Di', $appointmentId)
            || !preg_match('/^coaching-unit:v1:[1-9][0-9]*:[1-9][0-9]*:(mock|strategy|debrief):[1-9][0-9]*$/D', $unitId)
            || ($binding['appointment_id'] ?? null) !== $appointmentId
            || ($binding['unit_id'] ?? null) !== $unitId
            || !is_string($binding['host'] ?? null) || $host === ''
            || !hash_equals($binding['host'], $host)
            || !self::id($binding['meeting_id'] ?? null)
            || !is_array($binding['recording_ids'] ?? null)
            || count($binding['recording_ids']) > 20) {
            throw new DomainException('exact_owned_coaching_provider_binding_required');
        }
        // Tombstone FIRST. Any failure or process death keeps link issuance off.
        $binding['revoked'] = true;
        $binding['cleanup_state'] = 'pending';
        ($this->save)($binding);
        $meetingId = $binding['meeting_id'];
        $meetingPath = '/meetings/' . rawurlencode($meetingId);
        $meeting = $this->request('GET', $meetingPath);
        if (!in_array($meeting['status'], [404, 410], true)
            && ($meeting['status'] !== 200 || ($meeting['body']['id'] ?? null) !== $meetingId
                || strtolower((string) ($meeting['body']['hostEmail'] ?? '')) !== strtolower($host))) {
            throw new DomainException('provider_host_meeting_binding_required');
        }
        $recordingIds = [];
        foreach ($binding['recording_ids'] as $id) {
            if (!self::id($id) || isset($recordingIds[$id])) {
                throw new DomainException('exact_recording_ids_required');
            }
            $recordingIds[$id] = true;
        }

        // A bounded exact meeting-id lookup discovers recordings that were
        // created after the last student lookup. Never use title/fuzzy matches.
        $listing = $this->request('GET', '/recordings?meetingId=' . rawurlencode($meetingId) . '&max=100');
        if ($listing['status'] !== 200 || !is_array($listing['body']['items'] ?? null)
            || count($listing['body']['items']) > 20 || !empty($listing['next'])) {
            throw new DomainException('complete_provider_recording_inventory_required');
        }
        foreach ($listing['body']['items'] as $recording) {
            $id = $recording['id'] ?? null;
            if (!self::id($id) || !self::belongs($recording, $meetingId)) {
                throw new DomainException('ambiguous_provider_recording_binding');
            }
            $recordingIds[$id] = true;
        }
        $binding['recording_ids'] = array_keys($recordingIds);
        ($this->save)($binding);
        $beforeRecordings = [];
        foreach (array_keys($recordingIds) as $id) {
            $path = '/recordings/' . rawurlencode($id);
            $before = $this->request('GET', $path);
            if (!in_array($before['status'], [404, 410], true)) {
                if ($before['status'] !== 200 || !self::belongs($before['body'], $meetingId)
                    || (isset($before['body']['hostEmail']) && strtolower((string) $before['body']['hostEmail']) !== strtolower($host))) {
                    throw new DomainException('recording_ownership_not_verified');
                }
            }
            $beforeRecordings[$id] = $before;
        }
        // Preflight EVERY destructive target before deleting ANY resource.
        $results = [];
        foreach ($beforeRecordings as $id => $before) {
            $path = '/recordings/' . rawurlencode($id);
            if (!in_array($before['status'], [404, 410], true)) {
                $deleted = $this->request('DELETE', $path);
                if (!in_array($deleted['status'], [200, 202, 204, 404, 410], true)) {
                    throw new DomainException('provider_recording_revocation_failed');
                }
            }
            $after = $this->request('GET', $path);
            // Accepted/queued delete alone does not prove links inaccessible.
            if (!in_array($after['status'], [404, 410], true)) {
                throw new DomainException('provider_recording_revocation_not_confirmed');
            }
            $results[] = ['id_sha256' => hash('sha256', $id), 'provider_absent' => true];
        }
        $path = $meetingPath;
        if (!in_array($meeting['status'], [404, 410], true)) {
            $deleted = $this->request('DELETE', $path);
            if (!in_array($deleted['status'], [200, 202, 204, 404, 410], true)) {
                throw new DomainException('provider_meeting_revocation_failed');
            }
        }
        $after = $this->request('GET', $path);
        if (!in_array($after['status'], [404, 410], true)) {
            throw new DomainException('provider_meeting_revocation_not_confirmed');
        }
        $binding['cleanup_state'] = 'provider_resources_absent';
        $binding['cleanup_evidence'] = ['meeting_id_sha256' => hash('sha256', $meetingId),
            'meeting_absent' => true, 'recordings' => $results, 'checked_at' => gmdate('c')];
        ($this->save)($binding);
        return $binding['cleanup_evidence'];
    }

    private function request(string $method, string $path): array
    {
        $response = ($this->api)($method, $path);
        if (!is_array($response) || !is_int($response['status'] ?? null)
            || !is_array($response['body'] ?? null)) {
            throw new DomainException('provider_response_unavailable');
        }
        return $response;
    }
    private static function id($value): bool
    {
        return is_string($value) && strlen($value) >= 1 && strlen($value) <= 512
            && preg_match('/^[A-Za-z0-9_=-]+$/D', $value) === 1;
    }
    private static function belongs(array $recording, string $meetingId): bool
    {
        foreach (['meetingId', 'scheduledMeetingId', 'meetingSeriesId'] as $key) {
            if (($recording[$key] ?? null) === $meetingId) { return true; }
        }
        return false;
    }
}
