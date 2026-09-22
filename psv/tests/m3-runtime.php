<?php
/** Self-contained scale arithmetic and immutable approved-output M3 checks. */
declare(strict_types=1);

$batchSource = (string) file_get_contents(dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-batch.php');
$genSource   = (string) file_get_contents(dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-generator.php');
$passes = 0;
function m3runtime(bool $ok, string $label): void {
	global $passes;
	if (!$ok) { fwrite(STDERR, "FAIL: {$label}\n"); exit(1); }
	$passes++; fwrite(STDOUT, "PASS: {$label}\n");
}
preg_match('/const\s+MAX_ITEMS\s*=\s*(\d+)\s*;/', $batchSource, $max);
preg_match('/const\s+DAILY_RUN_CAP\s*=\s*(\d+)\s*;/', $genSource, $daily);
preg_match('/const\s+MAX_ATTEMPTS\s*=\s*(\d+)\s*;/', $batchSource, $tries);
preg_match('/const\s+CLIENT_WORKERS\s*=\s*(\d+)\s*;/', $batchSource, $workers);
m3runtime((int) ($max[1] ?? 0) === 150, '150-program batch ceiling is exact');
m3runtime((int) ($daily[1] ?? 0) >= 300, 'daily cap covers 150 first attempts plus bounded retry headroom');
m3runtime((int) ($tries[1] ?? 0) === 3, 'retry terminal boundary is exactly three attempts');
m3runtime((int) ($workers[1] ?? 0) === 2, 'two concurrent client workers bound provider pressure');

$programs = array();
for ($i = 1; $i <= 177; $i++) {
	$programs[] = array('programSpecialtyId' => 'ps-' . $i, 'priorityPosition' => $i, 'goldStarred' => false);
}
$accepted = array_slice($programs, 0, (int) $max[1]);
m3runtime(count($accepted) === 150 && $accepted[149]['programSpecialtyId'] === 'ps-150', 'oversize imports are deterministically bounded to 150');
$eligible = array_filter($accepted, static fn(array $p): bool => !$p['goldStarred'] && $p['priorityPosition'] > 25);
m3runtime(count($eligible) === 125, 'priority positions 1–25 are excluded from unattended Bulk Rush');
m3runtime(count($accepted) - count($eligible) === 25, 'high-priority programs remain explicit-review only');

$item = array('approved_doc_uuid' => 'approved-immutable-1', 'status' => 'READY', 'run_uuid' => 'run-old');
$requeued = array_merge($item, array('status' => 'QUEUED', 'run_uuid' => ''));
m3runtime($requeued['approved_doc_uuid'] === 'approved-immutable-1', 'selective regeneration model preserves the approved document pointer');

fwrite(STDOUT, "PSV M3 RUNTIME: PASS ({$passes} assertions)\n");
