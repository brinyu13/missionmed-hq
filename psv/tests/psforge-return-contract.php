<?php
/** Focused contract for PSForge's owner-native Return to Matrix control. */
declare(strict_types=1);

$root = dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/';
$page = (string) file_get_contents($root . 'includes/class-mmps-page.php');
$ui = (string) file_get_contents($root . 'assets/mmps-app.js');
$css = (string) file_get_contents($root . 'assets/mmps-app.css');
$checks = [
	'exact immutable Matrix destination' => str_contains($page, "return 'https://missionmedinstitute.com/member-dashboard/#dashboard';") && !str_contains($page, "apply_filters( 'mmps_file_vault_url'"),
	'one semantic native header return' => substr_count($ui, 'data-matrix-return') >= 2 && str_contains($ui, '>Return to Matrix</span>') && str_contains($ui, 'aria-label="Return to Matrix Dashboard"'),
	'ordinary return stays a direct link' => str_contains($ui, "href=\"' + esc(cfg.backUrl) + '\"") && str_contains($ui, "window.location.assign(cfg.backUrl)"),
	'in-flight work fails closed' => str_contains($ui, 'function hasBusyWork()') && str_contains($ui, 'Please wait before returning to Matrix'),
	'local unsaved inputs are guarded' => str_contains($ui, 'function hasReturnDrafts()') && str_contains($ui, "f.source==='PASTED'") && str_contains($ui, "f.source==='UPLOADED'") && str_contains($ui, 'S.admin.importText.trim()'),
	'existing review draft policy is reused' => str_contains($ui, "reviewLeaveGuard(event,el,'external-link')") && str_contains($ui, 'Save edits and leave'),
	'cancel and confirmed leave are explicit' => str_contains($ui, '>Stay in PSForge</button>') && str_contains($ui, 'data-act="return-leave"'),
	'browser unload protection covers all private work' => str_contains($ui, 'hasReviewDrafts() || hasReturnDrafts() || hasBusyWork()'),
	'390px retains visible label' => str_contains($css, '@media (max-width:390px)') && str_contains($css, '.matrixBack span:last-child{display:inline}') && !str_contains($css, '.matrixBack span:last-child{display:none}'),
];
$fail = 0;
foreach ($checks as $label => $pass) {
	echo ($pass ? 'PASS: ' : 'FAIL: ') . $label . "\n";
	$fail += $pass ? 0 : 1;
}
echo 'PSFORGE RETURN CONTRACT: ' . ($fail ? 'FAIL' : 'PASS') . ' (' . (count($checks) - $fail) . ' passed, ' . $fail . " failed)\n";
exit($fail ? 1 : 0);
