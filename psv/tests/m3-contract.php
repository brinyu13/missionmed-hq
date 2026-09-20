<?php
/** PSV M3 static batch, export, isolation, and privacy contract gate. */
declare(strict_types=1);

$repo       = dirname(__DIR__, 2);
$plugin     = $repo . '/wp-content/plugins/missionmed-file-vault-ps';
$files      = array(
	'batch'   => $plugin . '/includes/class-mmps-batch.php',
	'install' => $plugin . '/includes/class-mmps-install.php',
	'gen'     => $plugin . '/includes/class-mmps-generator.php',
	'rest'    => $plugin . '/includes/class-mmps-rest.php',
	'store'   => $plugin . '/includes/class-mmps-store.php',
	'ui'      => $plugin . '/assets/mmps-app.js',
);
$src = array();
$fail = array();
$pass = 0;

function m3check(bool $ok, string $label, string $why): void {
	global $fail, $pass;
	if ($ok) { $pass++; fwrite(STDOUT, "PASS: {$label}\n"); return; }
	$fail[] = $label . ' — ' . $why;
	fwrite(STDERR, "FAIL: {$label} — {$why}\n");
}
foreach ($files as $name => $path) {
	$src[$name] = is_readable($path) ? (string) file_get_contents($path) : '';
	m3check($src[$name] !== '', "tracked {$name} source exists", $path);
}
$all = implode("\n", $src);

m3check((bool) preg_match('/const\s+MAX_ITEMS\s*=\s*100\s*;/', $src['batch']), 'batch accepts 100 programs', 'M3 must support the Founder-required 50–100+ scale.');
m3check((bool) preg_match('/const\s+DAILY_RUN_CAP\s*=\s*(?:1[5-9][0-9]|[2-9][0-9]{2,})\s*;/', $src['gen']), 'daily ceiling accommodates a full batch and retries', 'A 100-item batch must not dead-end at the former 60-run prototype cap.');
m3check((bool) preg_match('/const\s+CLIENT_WORKERS\s*=\s*2\s*;/', $src['batch']), 'browser concurrency is explicitly bounded', 'Client workers must remain small and auditable.');
m3check(str_contains($src['batch'], 'active_items < %d') && str_contains($src['batch'], 'saturated') && str_contains($src['batch'], 'release_slot'), 'server enforces the two-worker concurrency ceiling', 'Multiple tabs and direct requests must not exceed the client worker limit.');
m3check((bool) preg_match('/const\s+MAX_ATTEMPTS\s*=\s*3\s*;/', $src['batch']) && str_contains($src['batch'], 'attempt_count < max_attempts'), 'retry budget is durable and capped', 'Retries must not loop indefinitely.');
m3check(str_contains($src['batch'], "status='PROCESSING'") && str_contains($src['batch'], 'lock_token') && str_contains($src['batch'], 'locked_until'), 'items use atomic claim leases', 'Concurrent clients need a durable claim boundary.');
m3check(str_contains($src['batch'], 'recover_stale') && str_contains($src['batch'], 'STALE_LOCK_RECOVERED'), 'stale item locks recover safely', 'Interrupted browsers must be resumable.');
m3check(str_contains($src['store'], 'reserve_provider_attempt') && str_contains($src['install'], 'user_day_slot') && str_contains($src['batch'], 'DAILY_CAP_PAUSED'), 'all provider calls are metered and cap exhaustion pauses without retry loss', 'Failed provider calls must count, while a daily cap must preserve queued work.');
m3check(str_contains($src['install'], 'UNIQUE KEY idempotency_key') && str_contains($src['store'], 'get_run_by_idempotency') && str_contains($src['gen'], 'preview_from_stored'), 'provider work is idempotent across retries', 'The same durable item key must reuse the stored run.');
m3check(substr_count($src['batch'], 'user_id') >= 20 && str_contains($src['store'], 'documents_for_export'), 'batch and export queries are owner scoped', 'No cross-student job or document lookup is permitted.');
m3check(str_contains($src['rest'], '/rise/my-program-index') && !preg_match('/(?:notes|student_note|personal_note)[\'\"]?\s*=>/', $src['rest']), 'RISE import excludes student notes', 'Only minimal program identifiers and rank signals may cross the transport boundary.');
m3check(str_contains($src['rest'], '/batch/jobs') && str_contains($src['rest'], '/process') && str_contains($src['rest'], '/approve-ready'), 'resumable batch REST surface is registered', 'Create, resume/process, and exception-free approval paths are required.');
m3check(str_contains($src['batch'], 'START TRANSACTION') && str_contains($src['batch'], 'ROLLBACK') && str_contains($src['batch'], 'mmps_batch_item_create'), 'batch creation is atomic and checks every item insert', 'A partial job must never be returned.');
m3check(str_contains($src['gen'], 'mmps_run_store') && str_contains($src['batch'], 'mmps_batch_result_persist'), 'run and item persistence failures fail closed', 'READY may only reference a durably stored run.');
m3check(str_contains($src['rest'], 'mmps_run_saved_different_candidate'), 'default approval cannot relabel a saved alternative', 'Candidate provenance must survive automation.');
m3check(str_contains($src['rest'], '/library/bulk-download') && str_contains($src['rest'], 'ZipArchive') && str_contains($src['rest'], 'MANIFEST'), 'selected and Download All ZIP export is implemented', 'Bulk output needs a manifest and server-created archive.');
m3check(str_contains($src['batch'], 'approvedPreserved') && !str_contains($src['batch'], "'approved_doc_uuid' => ''"), 'selective regeneration preserves approved documents', 'A requeue must never erase the last approved output.');
m3check(str_contains($src['ui'], 'function runBatch') && str_contains($src['ui'], 'function stopBatch') && str_contains($src['ui'], 'function worker'), 'UI supports pause, resume, and bounded workers', 'Long jobs must survive reloads and be user-controllable.');
m3check(str_contains($all, 'MMED_PS_PROTO_ALLOW_REAL_ROOT_AI'), 'real-student AI privacy gate remains present', 'M3 scale must not silently open the privacy gate.');
m3check(!preg_match('/class-mmed-file-vault-v2\.php|class-mmed-file-vault-repository\.php/', $all), 'M3 does not edit protected File Vault implementation paths', 'PSV remains isolated until an owner contract is approved.');

if ($fail) {
	fwrite(STDERR, "\nPSV M3 CONTRACT: FAIL (" . count($fail) . " failed, {$pass} passed)\n");
	exit(1);
}
fwrite(STDOUT, "\nPSV M3 CONTRACT: PASS ({$pass} assertions)\n");
