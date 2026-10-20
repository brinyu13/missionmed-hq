<?php
declare(strict_types=1);
require __DIR__ . '/../wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingProviderContainment.php';
$count = 0;
function expect(bool $yes, string $label): void { global $count; if (!$yes) { throw new RuntimeException($label); } ++$count; }
$base = ['appointment_id' => '11111111-2222-4333-8444-555555555555',
    'unit_id' => 'coaching-unit:v1:123:456:mock:1', 'host' => 'host@example.test',
    'meeting_id' => 'OWNED_MEETING', 'recording_ids' => ['OWNED_RECORDING']];
function runCase(array $binding, string $scenario = ''): array {
    $calls = []; $saves = []; $gone = [];
    $api = function (string $method, string $path) use (&$calls, &$gone, $scenario): array {
        $calls[] = [$method, $path];
        if (str_contains($path, '?')) {
            return ['status' => $scenario === 'outage' ? 503 : 200,
                'body' => ['items' => $scenario === 'foreign_listing' ? [['id' => 'FOREIGN', 'meetingId' => 'OTHER']] : []],
                'next' => $scenario === 'pagination' ? 'next' : null];
        }
        if ($method === 'DELETE') {
            if ($scenario === 'permission') { return ['status' => 403, 'body' => []]; }
            if ($scenario !== 'async_delete') { $gone[$path] = true; }
            return ['status' => 204, 'body' => []];
        }
        if (isset($gone[$path]) || $scenario === 'already_absent') { return ['status' => 404, 'body' => []]; }
        return ['status' => 200, 'body' => str_starts_with($path, '/recordings/')
            ? ['id' => 'OWNED_RECORDING', 'meetingId' => $scenario === 'foreign_detail' ? 'OTHER' : 'OWNED_MEETING']
            : ['id' => 'OWNED_MEETING', 'hostEmail' => $scenario === 'wrong_host' ? 'other@example.test' : 'host@example.test']];
    };
    $policy = new CoachingProviderContainment($api, function (array $value) use (&$saves): void { $saves[] = $value; });
    try { $result = $policy->revoke($binding, '11111111-2222-4333-8444-555555555555', 'coaching-unit:v1:123:456:mock:1', 'host@example.test');
        return ['ok' => true, 'result' => $result, 'calls' => $calls, 'saves' => $saves];
    } catch (DomainException $error) { return ['ok' => false, 'error' => $error->getMessage(), 'calls' => $calls, 'saves' => $saves]; }
}
$r = runCase($base);
expect($r['ok'] && $r['result']['meeting_absent'] === true, 'exact owned provider resources deleted and independently GET absent');
expect($r['saves'][0]['revoked'] === true && $r['saves'][0]['cleanup_state'] === 'pending', 'tombstone persisted before first provider call');
expect($r['result']['recordings'][0]['provider_absent'] === true, 'recording GET absent required');
expect(count(array_filter($r['calls'], fn($x) => $x[0] === 'DELETE')) === 2, 'only exact owned meeting and recording deleted');
expect(!str_contains(json_encode($r['result']), 'host@example'), 'no host email in safe cleanup evidence');
foreach (['outage', 'permission', 'pagination', 'foreign_listing', 'foreign_detail', 'async_delete', 'wrong_host'] as $case) {
    $r = runCase($base, $case);
    expect(!$r['ok'], $case . ' cannot certify cleanup');
    expect($r['saves'][0]['revoked'] === true, $case . ' leaves access tombstoned');
    if (in_array($case, ['foreign_listing', 'foreign_detail', 'pagination', 'outage', 'wrong_host'], true)) {
        expect(!array_filter($r['calls'], fn($x) => $x[0] === 'DELETE'), $case . ' performs no destructive provider call');
    }
}
$r = runCase($base, 'already_absent');
expect($r['ok'] && !array_filter($r['calls'], fn($x) => $x[0] === 'DELETE'), 'replay absent resources needs no destructive repeat');
foreach (['appointment_id' => 'another', 'unit_id' => 'coaching-unit:v1:999:456:mock:1', 'meeting_id' => '../foreign', 'host' => 'other@example.test'] as $key => $bad) {
    $r = runCase(array_replace($base, [$key => $bad]));
    expect(!$r['ok'] && !$r['calls'], $key . ' mismatch blocked before provider request');
}
expect(!runCase(array_replace($base, ['recording_ids' => ['OWNED_RECORDING', 'OWNED_RECORDING']]))['ok'], 'duplicate recording rejected');
echo 'PASS ' . $count . " provider policy assertions; SYNTHETIC ONLY, no network or production changes\n";
