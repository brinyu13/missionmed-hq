<?php
/** PSV M4 static research quarantine and RISE-authority contract gate. */
declare(strict_types=1);

$repo = dirname(__DIR__, 2);
$root = $repo . '/wp-content/plugins/missionmed-file-vault-ps';
$research = (string) file_get_contents($root . '/includes/class-mmps-research.php');
$rest = (string) file_get_contents($root . '/includes/class-mmps-rest.php');
$install = (string) file_get_contents($root . '/includes/class-mmps-install.php');
$ui = (string) file_get_contents($root . '/assets/mmps-app.js');
$provider = (string) file_get_contents($root . '/includes/class-mmps-provider.php');
$all = $research . $rest . $install . $ui . $provider;
$pass = 0; $fail = array();
function m4check(bool $ok, string $label, string $why): void {
	global $pass, $fail;
	if ($ok) { $pass++; fwrite(STDOUT, "PASS: {$label}\n"); return; }
	$fail[] = $label; fwrite(STDERR, "FAIL: {$label} — {$why}\n");
}
m4check(str_contains($research, "const SCHEMA    = 'missionmed.rise.research-artifact.v1'"), 'artifact schema is explicit and versioned', 'Research handoffs need a stable contract.');
m4check((bool) preg_match('/const\s+MAX_BYTES\s*=\s*262144/', $research) && str_contains($research, "'md' !== strtolower"), 'upload type and size are bounded', 'Only small Markdown evidence artifacts are accepted.');
m4check(str_contains($research, 'QUARANTINED_REJECTED') && str_contains($research, 'VALIDATED_PENDING_RISE_OWNER'), 'validation never implies RISE acceptance', 'The status model must retain the owner gate.');
m4check(str_contains($research, 'PROMPT_INJECTION_TEXT') && str_contains($research, 'ACTIVE_CONTENT') && str_contains($research, 'APPLICANT_DATA'), 'active content, injection text and applicant data fail validation', 'Uploaded agent output is untrusted.');
m4check(str_contains($research, 'FILTER_VALIDATE_URL') && str_contains($research, "'https' !==") && str_contains($research, 'SOURCE_BLOCKED'), 'every fact has constrained provenance', 'Facts need HTTPS provenance and blocked peer/social sources.');
m4check(str_contains($research, 'PROGRAM_OFFICIAL') && str_contains($research, 'SPONSOR_OFFICIAL') && str_contains($research, 'ACGME_PUBLIC'), 'source authority types are allowlisted', 'Unbounded source classes cannot enter the owner handoff.');
m4check(str_contains($research, 'program_specialty_id') && str_contains($research, 'acgme_id') && str_contains($research, 'program_name'), 'uploaded identity is matched to current RISE identity', 'A file cannot be attached to the wrong program.');
m4check(str_contains($install, "table( 'research_artifacts' )") && str_contains($install, 'artifact_markdown longtext'), 'raw files stay in an isolated PSV quarantine table', 'No File Vault or RISE table may hold unaccepted uploads.');
m4check(str_contains($rest, '/research-artifacts') && str_contains($rest, 'research_upload') && str_contains($rest, 'research_download'), 'owner-scoped upload and validated handoff routes are registered', 'M4 requires upload and RISE-owner handoff.');
m4check(str_contains($rest, "'riseHydrated' => false") && str_contains($rest, 'RISE-owner intake contract'), 'REST response says RISE is not hydrated', 'The UX must not overclaim acceptance.');
m4check(!preg_match('/(?:INSERT|UPDATE|DELETE)\s+[^\n;]*rise/i', $all), 'PSV contains no direct RISE write', 'Hydration belongs to the RISE owner contract.');
m4check(str_contains($ui, 'Write an Essential version instead') && str_contains($ui, 'data-research-file'), 'Essential fallback and upload remain simultaneously available', 'Research cannot block immediate safe output.');
m4check(str_contains($ui, 'PSV cannot hydrate RISE directly') && str_contains($ui, 'File validated · awaiting RISE acceptance'), 'UI exposes the quarantine and owner boundary', 'Students must see the true state.');
m4check(str_contains($provider, "'members' === MMPS_Gate::mode()") && str_contains($provider, 'MMPS_Gate::user_allowed') && str_contains($provider, 'MMPS_Region::root_still_matches'), 'research preserves entitled real-ROOT and confirmed-region enforcement', 'Research work cannot weaken ROOT privacy or region authority.');

if ($fail) { fwrite(STDERR, "\nPSV M4 CONTRACT: FAIL (" . count($fail) . " failed, {$pass} passed)\n"); exit(1); }
fwrite(STDOUT, "\nPSV M4 CONTRACT: PASS ({$pass} assertions)\n");
