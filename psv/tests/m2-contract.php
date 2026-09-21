<?php
/**
 * PSV M2 static contract and security gate.
 *
 * This test deliberately does not load WordPress. It inspects the tracked
 * plugin source and fails closed until the M2 multi-candidate writing and
 * selection contract is present end to end.
 */

declare(strict_types=1);

$repoRoot   = dirname(__DIR__, 2);
$pluginRoot = $repoRoot . '/wp-content/plugins/missionmed-file-vault-ps';
$paths      = array(
	'generator' => $pluginRoot . '/includes/class-mmps-generator.php',
	'provider'  => $pluginRoot . '/includes/class-mmps-provider.php',
	'region'    => $pluginRoot . '/includes/class-mmps-region.php',
	'rest'      => $pluginRoot . '/includes/class-mmps-rest.php',
	'store'     => $pluginRoot . '/includes/class-mmps-store.php',
	'ui'        => $pluginRoot . '/assets/mmps-app.js',
);

$failures = array();
$passes   = 0;

function contract_assert(bool $condition, string $label, string $detail): void {
	global $failures, $passes;
	if ($condition) {
		$passes++;
		fwrite(STDOUT, "PASS: {$label}\n");
		return;
	}
	$failures[] = $label . ' — ' . $detail;
	fwrite(STDERR, "FAIL: {$label} — {$detail}\n");
}

function read_contract_file(string $path, string $label): string {
	if (!is_file($path) || !is_readable($path)) {
		contract_assert(false, "tracked {$label} source exists", $path);
		return '';
	}
	$contents = file_get_contents($path);
	if (!is_string($contents)) {
		contract_assert(false, "tracked {$label} source is readable", $path);
		return '';
	}
	contract_assert(true, "tracked {$label} source exists", $path);
	return $contents;
}

/** Remove PHP comments while retaining executable code and string literals. */
function executable_php(string $source): string {
	$out = '';
	foreach (token_get_all($source) as $token) {
		if (is_array($token)) {
			if (in_array($token[0], array(T_COMMENT, T_DOC_COMMENT), true)) {
				continue;
			}
			$out .= $token[1];
			continue;
		}
		$out .= $token;
	}
	return $out;
}

function has_pattern(string $pattern, string $source): bool {
	return 1 === preg_match($pattern, $source);
}

/** Extract one public static method without requiring the PHP file. */
function public_static_method(string $source, string $name): string {
	$pattern = '/public\s+static\s+function\s+' . preg_quote($name, '/')
		. '\s*\([^)]*\)\s*\{.*?(?=\n\s*(?:public|protected|private)\s+static\s+function|\n\})/s';
	return preg_match($pattern, $source, $match) ? $match[0] : '';
}

$source = array();
foreach ($paths as $name => $path) {
	$source[$name] = read_contract_file($path, $name);
}

$generator = executable_php($source['generator']);
$provider  = executable_php($source['provider']);
$region    = executable_php($source['region']);
$rest      = executable_php($source['rest']);
$store     = executable_php($source['store']);
$ui        = $source['ui'];
$save      = public_static_method($rest, 'save');

contract_assert(
	has_pattern('/const\s+PROMPT_VERSION\s*=\s*[\'\"]mmps-prompt\.v2[\'\"]\s*;/', $generator),
	'PROMPT_VERSION is mmps-prompt.v2',
	'M2 must make the prompt contract visibly versioned and auditable.'
);

contract_assert(
	has_pattern('/[\'\"]root_paragraphs[\'\"]\s*=>\s*array_values\s*\(\s*\$paras\s*\)/s', $generator)
		&& has_pattern('/wp_json_encode\s*\(\s*\$user_payload\s*\)/', $provider),
	'provider receives the complete ordered ROOT context',
	'The payload must carry every ROOT paragraph, and the provider adapter must send that complete payload.'
);

$systemPrompt = public_static_method($generator, 'system_prompt');
contract_assert(
	has_pattern('/(?:write|return|generate)[^\n\'\"]{0,100}only(?:\s+\w+){0,4}\s+(?:authorized|confirmed|selected|editable|explicitly\s+marked)[^\n\'\"]{0,40}region|region[- ]only/is', $systemPrompt),
	'prompt explicitly limits writing to the authorized region',
	'An implicit one-paragraph convention is insufficient; the v2 prompt must state the region-only write boundary.'
);
contract_assert(
	has_pattern('/(?:do not|never|must not)\s+(?:rewrite|change|edit|modify)[^\n\'\"]{0,160}(?:protected|locked|other)[^\n\'\"]{0,80}(?:paragraph|root)/is', $systemPrompt),
	'prompt explicitly forbids protected ROOT rewriting',
	'The provider instruction must separately prohibit edits to locked/protected ROOT paragraphs.'
);

contract_assert(
	has_pattern('/[\'\"]required[\'\"]\s*=>\s*array\s*\([^)]*[\'\"]recommended_candidate_id[\'\"][^)]*[\'\"]candidates[\'\"]/s', $generator)
		&& has_pattern('/[\'\"]candidates[\'\"]\s*=>\s*array\s*\([^)]*[\'\"]type[\'\"]\s*=>\s*[\'\"]array[\'\"]/s', $generator),
	'one candidate set is returned with its recommendation',
	'M2 output must group all alternatives in one top-level candidates array and identify the recommended member.'
);
contract_assert(
	has_pattern('/[\'\"]minItems[\'\"]\s*=>\s*[45]\b/', $generator)
		&& has_pattern('/[\'\"]maxItems[\'\"]\s*=>\s*5\b/', $generator),
	'candidate set requires four to five alternatives',
	'The structured output schema must enforce both the lower and upper bounds.'
);
contract_assert(
	has_pattern('/[\'\"]candidate_id[\'\"]/', $generator)
		&& has_pattern('/[\'\"]strategy(?:_key)?[\'\"]/', $generator)
		&& has_pattern('/(?:distinct|different|unique|one candidate for every)[^\n\'\"]{0,140}(?:strateg|rhetorical)|(?:strateg|rhetorical)[^\n\'\"]{0,140}(?:distinct|different|unique)/i', $generator),
	'candidate alternatives use distinct named strategies',
	'Each candidate needs its own identifier and strategy key, plus an explicit distinct-strategy invariant.'
);

contract_assert(
	has_pattern('/[\'\"]recommended_candidate_id[\'\"]/', $generator)
		&& has_pattern('/selected_candidate_id|selectedCandidateId/', $generator . $rest . $store . $ui),
	'recommended and selected candidate identifiers are explicit',
	'The recommendation and the user selection must be represented by identifiers, never array position alone.'
);
contract_assert(
	has_pattern('/[\'\"]candidate_id[\'\"]\s*=>\s*array\s*\([^)]*[\'\"]enum[\'\"]\s*=>\s*array_keys\s*\(\s*self::strategies\s*\(\s*\)\s*\)/s', $generator)
		|| has_pattern('/(?:candidate.{0,500}hash\s*\(\s*[\'\"]sha256[\'\"]|hash\s*\(\s*[\'\"]sha256[\'\"].{0,500}candidate)/is', $generator),
	'candidate identifiers are derived deterministically',
	'Candidate identity must be stable across retries/reloads and derived server-side from canonical inputs.'
);

contract_assert(
	has_pattern('/[\'\"](?:validation|candidate_validations|candidateValidations)[\'\"]/', $generator)
		&& (
			has_pattern('/validate_candidate/', $generator)
			|| has_pattern('/foreach\s*\([^)]*(?:candidates|candidate)[^)]*\).*?self::validate/s', $generator)
		),
	'every candidate has an individual validation result',
	'M2 must validate alternatives separately rather than applying one aggregate verdict to the set.'
);

contract_assert(
	$save !== ''
		&& has_pattern('/selected_candidate_id|selectedCandidateId/', $save)
		&& (
			has_pattern('/select_candidate|candidate_by_id/', $save . $generator . $store)
			|| (
				has_pattern('/[\'\"]candidates[\'\"]/', $save)
				&& has_pattern('/[\'\"]candidate_id[\'\"]/', $save)
			)
		),
	'library save resolves the selected candidate server-side',
	'The save route must accept a candidate ID and resolve it from the stored run/candidate set on the server.'
);
contract_assert(
	has_pattern('/validation[^\n]{0,80}promptVersion/', $save)
		&& has_pattern('/mmps-prompt\.v1/', $save),
	'legacy M1 runs retain truthful v1 prompt provenance',
	'An M1 run saved after upgrade must not be mislabeled as having used the M2 prompt.'
);
contract_assert(
	$save !== '' && !has_pattern('/\$params\s*\[\s*[\'\"](?:regionText|replacementRegion|replacement_region|fullText)[\'\"]\s*\]/', $save),
	'library save does not trust client-supplied statement prose',
	'The selected replacement/full statement must come from the stored validated candidate, not request text.'
);

contract_assert(
	$save !== ''
		&& has_pattern('/MMPS_Region::reconstruct\s*\(/', $save)
		&& has_pattern('/MMPS_Region::verify_protected\s*\(/', $save)
		&& has_pattern('/function\s+verify_protected\s*\(/', $region),
	'selected candidate is reconstructed with protected ROOT verification',
	'Save must reconstruct from ROOT plus the chosen region and re-run protected-paragraph integrity checks.'
);

contract_assert(
	has_pattern('/MMED_PS_PROTO_ALLOW_REAL_ROOT_AI/', $provider)
		&& has_pattern('/!\s*\$root\s*\[\s*[\'\"]isSynthetic[\'\"]\s*\].{0,240}mmps_privacy_gate/is', $generator),
	'real-student AI privacy gate remains fail-closed',
	'M2 must retain the server constant and refuse non-synthetic provider calls unless explicitly authorized.'
);

contract_assert(
	has_pattern('/real_root_allowed_for\s*\(/', $provider . $generator)
		&& has_pattern('/MMED_PS_PROTO_REAL_ROOT_CANARY_ROOT_SHA256/', $provider)
		&& has_pattern('/MMED_PS_PROTO_REAL_ROOT_CANARY_PROGRAM_ID/', $provider)
		&& has_pattern('/REAL_ROOT_CANARY/', $provider . $generator),
	'real-ROOT canary is bound to an exact server-side tuple',
	'The canary must bind user, ROOT hash, specialty, region and one program without opening the broad gate.'
);

contract_assert(
	has_pattern('/mmps_canary_no_batch/', $rest)
		&& has_pattern('/mmps_canary_review_only/', $rest)
		&& has_pattern('/count_provider_runs\s*\(/', $generator . $store)
		&& has_pattern('/provider\s*<>\s*[\'\"]none[\'\"]/', $store)
		&& has_pattern('/canaryReviewOnly/', $ui),
	'real-ROOT canary remains review-only',
	'Batch creation and library save must fail closed, while a no-provider research stop must not consume the one authorized canary generation.'
);

contract_assert(
	has_pattern('/credit_balance_exhausted/', $provider)
		&& has_pattern('/mmps_provider_credits/', $provider)
		&& has_pattern('/mmps_provider_rate/', $provider),
	'provider distinguishes exhausted project credits from transient rate limiting',
	'A billing gate requires project-owner action and must not be presented as a retryable rate limit.'
);

contract_assert(
	has_pattern('/selectedCandidateId|selected_candidate_id/', $ui)
		&& has_pattern('/data-act=[\'\"](?:select-candidate|choose-candidate)[\'\"]|data-candidate-id=/', $ui),
	'UI provides an explicit alternative-selection control',
	'The browser must let the user choose one candidate by ID instead of silently accepting the first output.'
);
contract_assert(
	has_pattern('/recommended/i', $ui)
		&& has_pattern('/candidate|alternative/i', $ui),
	'UI identifies the recommended alternative without hiding other choices',
	'The recommended/default option and the remaining alternatives must all be visible to the user.'
);
contract_assert(
	has_pattern('/(?:runId|run_id)[^\n]{0,180}(?:selectedCandidateId|selected_candidate_id)|(?:selectedCandidateId|selected_candidate_id)[^\n]{0,180}(?:runId|run_id)/', $ui),
	'UI sends run ID plus selected candidate ID when saving',
	'The server needs both identifiers to bind the save to the stored validated candidate set.'
);

if ($failures) {
	fwrite(STDERR, "\nPSV M2 CONTRACT: FAIL (" . count($failures) . " failed, {$passes} passed)\n");
	exit(1);
}

fwrite(STDOUT, "\nPSV M2 CONTRACT: PASS ({$passes} assertions)\n");
exit(0);
