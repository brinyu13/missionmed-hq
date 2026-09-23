<?php
/** Focused static contract for PSForge MyERAS AI, manual queue, and read-only double-check. */
declare(strict_types=1);
$root = dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/';
$rest = (string) file_get_contents($root . 'includes/class-mmps-rest.php');
$ui   = (string) file_get_contents($root . 'assets/mmps-app.js');
$css  = (string) file_get_contents($root . 'assets/mmps-app.css');
$pass = 0; $fail = 0;
function psf_check(bool $ok, string $label): void {
	global $pass, $fail;
	if ($ok) { $pass++; echo "PASS: $label\n"; }
	else { $fail++; fwrite(STDERR, "FAIL: $label\n"); }
}

psf_check(str_contains($rest, "array( '/library/myeras-package', 'POST', 'myeras_package' )") && str_contains($rest, "array( '/library/myeras-completion', 'POST', 'myeras_completion' )"), 'owner-gated package and return routes are registered');
psf_check(str_contains($rest, "'EXECUTE THIS MISSION.'") && str_contains($rest, "'DO NOT SUMMARIZE THESE INSTRUCTIONS.'") && str_contains($rest, "'DO NOT RETURN A PLAN INSTEAD OF EXECUTING.'"), 'executable mission starts with mandatory execution language');
psf_check(str_contains($rest, 'PASS 1 - CREATE + ASSIGN') && str_contains($rest, 'PASS 2 - START OVER AND READ BACK') && str_contains($rest, 'One unresolved program never stops the batch'), 'AI bulk mission requires fail-closed continuation and a fresh second pass');
psf_check(str_contains($rest, 'STRICTLY READ-ONLY') && str_contains($rest, 'Never silently repair a mismatch'), 'double-check mission has no mutation authority');
psf_check(str_contains($rest, 'NEVER APPLY, PAY, CERTIFY, SUBMIT, WITHDRAW, SIGNAL, OR MESSAGE') && str_contains($rest, 'Never modify LoRs, transcripts, photo'), 'absolute MyERAS safety boundary is embedded');
psf_check(str_contains($rest, "get_option( 'mmps_myeras_provider_config_v1'") && str_contains($rest, "'modelLabel' => 'Fable 5.1'") && str_contains($rest, "'modelLabel' => 'Astra 6'"), 'provider/model labels have sanitized configuration with safe defaults');
psf_check(str_contains($rest, "'EXECUTE_THIS_MISSION.md'") && str_contains($rest, "'CANONICAL_ASSIGNMENT_PLAN.json'") && str_contains($rest, "'RETURN_ARTIFACT_SCHEMA.json'") && str_contains($rest, "'statements/'"), 'one ZIP carries mission, canonical plan, exact bodies, and return contract');
psf_check(str_contains($rest, "wp_salt( 'nonce' )") && str_contains($rest, 'myeras_mission_id( self::uid()') && str_contains($rest, 'hash_equals( $mission_id'), 'return validation is owner- and exact-plan-bound without the Stage A key');
psf_check(str_contains($rest, 'mmps_myeras_completion_missing') && str_contains($rest, 'unexpected or duplicate assignment result') && str_contains($rest, '$allowed_creation') && str_contains($rest, '$allowed_content'), 'return validation rejects missing, duplicate, extra, and illegal-status results');
psf_check(str_contains($rest, '$correct_ok = ! empty( $item[\'assignmentEligible\'] )') && str_contains($rest, "'MATCH' === (string) \$result['normalizedContentCheck']") && str_contains($rest, "myeras_observed_equal( \$result['observedProgram'], \$item['programName'] )") && str_contains($rest, "myeras_observed_equal( \$result['observedStatementTitle'], \$item['myErasTitle'] )"), 'correct readback requires eligibility, assigned state, content match, and canonical observed identity');
psf_check(str_contains($rest, 'session[_ -]?cookie') && str_contains($rest, '<(?:script|iframe|object|embed|svg|math)'), 'return upload rejects credential/session indicators and active content');
psf_check(str_contains($rest, "'truthLabel' => 'AI-VERIFIED MYERAS READBACK'") && str_contains($rest, "'missionMedIndependentVerification' => false"), 'truth language never upgrades external AI readback to MissionMed verification');
psf_check(str_contains($ui, 'DO IT FOR ME') && str_contains($ui, 'I’LL DO IT MYSELF') && str_contains($ui, 'DOUBLE-CHECK ALL MY ASSIGNMENTS'), 'entry presents three obvious first-class choices');
psf_check(str_contains($ui, 'psforge-myeras-manual:') && str_contains($ui, 'saved.planSha256 === plan.planSha256') && str_contains($ui, "advanceManual('NEEDS_ATTENTION')"), 'manual queue survives reload only for the exact plan and can skip without stopping');
psf_check(str_contains($ui, 'COPY TITLE') && str_contains($ui, 'COPY STATEMENT') && str_contains($ui, 'I ASSIGNED IT'), 'manual queue exposes one-program-at-a-time large actions');
psf_check(str_contains($ui, 'Drop the PSForge completion file here') && str_contains($ui, "accept=\".md,text/markdown,text/plain\"") && str_contains($ui, 'Run Double-Check Again'), 'standalone completion return and rerun path are obvious');
psf_check(str_contains($ui, 'Waiting for your AI') && str_contains($ui, 'scroll-myeras-issues') && str_contains($ui, ' Issues</button>'), 'external work uses truthful waiting copy and a large issue-review action');
psf_check(str_contains($ui, 'Advanced · Technical Downloads') && str_contains($ui, 'Raw ERAS assignment manifest'), 'raw manifest is demoted under Advanced');
psf_check(str_contains($rest, 'https://myeras.aamc.org/') && !preg_match('#https://myeras\.aamc\.org/[A-Za-z0-9]#', $rest . $ui), 'only the verified official MyERAS root ships');
psf_check(str_contains($css, '.myerasChoices') && str_contains($css, '.manualSteps') && str_contains($css, '@media (max-width:860px)'), 'new paths have focused responsive presentation');

echo 'PSFORGE MYERAS CONTRACT: ' . ($fail ? 'FAIL' : 'PASS') . " ($pass passed, $fail failed)\n";
exit($fail ? 1 : 0);
