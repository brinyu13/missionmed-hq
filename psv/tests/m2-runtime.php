<?php
/** Self-contained runtime tests for PSV M2 candidate validation and ROOT integrity. */
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');

class WP_Error {
	private string $code;
	private string $message;
	public function __construct(string $code, string $message, array $data = array()) { $this->code = $code; $this->message = $message; }
	public function get_error_code(): string { return $this->code; }
	public function get_error_message(): string { return $this->message; }
}
function is_wp_error($value): bool { return $value instanceof WP_Error; }
function wp_list_pluck(array $list, string $field): array { return array_values(array_map(static fn(array $row) => $row[$field] ?? null, $list)); }
function get_transient(string $key) { return false; }
function get_userdata(int $id) { return false; }
function wp_json_encode($value): string { return (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }

$plugin = dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/';
require $plugin . 'class-mmps-region.php';
require $plugin . 'class-mmps-generator.php';
require $plugin . 'class-mmps-provider.php';

$passes = 0;
function check(bool $condition, string $label): void {
	global $passes;
	if (!$condition) { fwrite(STDERR, "FAIL: {$label}\n"); exit(1); }
	$passes++;
	fwrite(STDOUT, "PASS: {$label}\n");
}

$paragraphs = array(
	'During residency preparation, I learned to listen before deciding what a patient needed. That habit made my clinical work more deliberate and helped me recognize how much good medicine depends on trust.',
	'I carried that approach into a quality project, where careful measurement and steady collaboration mattered more than a dramatic solution. The work taught me to ask useful questions and remain accountable to the people affected by each decision.',
	'I am seeking a residency program where rigorous teaching, thoughtful teamwork, and service can shape the physician I am becoming.',
	'I hope to become an internist who pairs careful clinical judgment with practical improvement work. I want my training to deepen both my independence and my responsibility to the communities I serve.',
);
$region = MMPS_Region::build($paragraphs, 'REPLACE_PARAGRAPH', 2);
check(!is_wp_error($region), 'authorized region builds');
$root = array('id' => 7, 'specialtyLabel' => 'Internal Medicine', 'paragraphs' => $paragraphs, 'region' => $region, 'isSynthetic' => true);
$nameFact = array('factId' => 'F-name', 'category' => 'identity', 'label' => 'Program name', 'text' => 'The program is Lakeview Internal Medicine Residency.');
$locationFact = array('factId' => 'F-location', 'category' => 'identity', 'label' => 'Location', 'text' => 'The program is located in Harbor City.');
$plan = array('tierEffective' => 'ESSENTIAL', 'allowedFacts' => array($nameFact, $locationFact), 'studentFacts' => array());
$bundle = array(
	'program' => array('programName' => 'Lakeview Internal Medicine Residency', 'institution' => 'Lakeview', 'city' => 'Harbor City', 'state' => ''),
	'nameForms' => array('Lakeview Internal Medicine Residency', 'Lakeview'),
);

$bodies = array(
	'TRAINING_ENVIRONMENT' => array(
		'The training environment I value is one where careful decisions grow from close observation, direct feedback, and shared responsibility.',
		'Lakeview Internal Medicine Residency offers the setting in which I can carry that deliberate approach into the daily work of residency.',
		'I hope to learn with colleagues who make each other more thoughtful while contributing the steady curiosity and accountability that have shaped my work so far.',
	),
	'STUDENT_GOAL_FORWARD' => array(
		'I hope to become an internist who can pair sound clinical judgment with practical improvement work that patients can feel in their care.',
		'At Lakeview Internal Medicine Residency, I would continue moving toward that goal through the discipline of residency and the perspective gained from caring for a new community.',
		'I would bring an instinct to listen first, ask useful questions, and stay responsible for what follows.',
	),
	'RESEARCH_FELLOWSHIP' => array(
		'My quality project showed me that inquiry matters most when it remains close to the people affected by the answer.',
		'I would carry that habit of careful measurement to Lakeview Internal Medicine Residency, approaching clinical questions with the same patience I bring to the bedside.',
		'That continuity between investigation and care would help me grow without separating improvement work from the relationships that give it purpose.',
	),
	'LOCATION_PROGRAM_TYPE' => array(
		'Training in Harbor City would place my next stage of learning in a community whose needs I would first approach by listening.',
		'Lakeview Internal Medicine Residency would give me a new setting in which to practice the deliberate teamwork and accountability I have come to value.',
		'I would enter that community ready to learn its priorities rather than assume them, and ready to contribute through consistent clinical work.',
	),
	'BALANCED_QUIET_SPECIFIC' => array(
		'I am drawn to Lakeview Internal Medicine Residency because it offers a place to continue the kind of measured, collaborative work described throughout this statement.',
		'I want residency to make my judgment more independent while keeping me attentive to the people and systems around each patient.',
		'I would bring curiosity, follow-through, and a willingness to revise my thinking when the work asks for it.',
	),
);

$candidates = array();
foreach ($bodies as $id => $parts) {
	$segments = array(
		array('text' => $parts[0], 'kind' => 'student_link', 'fact_ids' => array()),
		array('text' => $parts[1], 'kind' => 'program_fact', 'fact_ids' => array('F-name')),
		array('text' => $parts[2], 'kind' => 'student_link', 'fact_ids' => array()),
	);
	$candidates[] = array(
		'candidate_id' => $id,
		'replacement_region' => implode(' ', $parts),
		'segments' => $segments,
		'facts_used' => array('F-name'),
		'strategy' => $id,
		'rhetorical_focus' => 'Distinct fixture for ' . $id,
		'self_check' => array('name_swap_would_still_work' => false, 'possible_unsupported_claims' => array(), 'generic_phrases' => array()),
	);
}
$set = array('recommended_candidate_id' => 'BALANCED_QUIET_SPECIFIC', 'candidates' => $candidates);
$validation = MMPS_Generator::validate_candidate_set($set, $bundle, $plan, $root);
check(empty($validation['blocking']), 'five distinct candidates pass deterministic evidence checks');
check(count($validation['validCandidateIds']) === 5, 'all five candidates receive individual valid results');
check($validation['recommendedCandidateId'] === 'BALANCED_QUIET_SPECIFIC', 'recommended candidate is explicit and stable');

$selected = MMPS_Generator::candidate_by_id($set, 'STUDENT_GOAL_FORWARD');
check(is_array($selected) && $selected['strategy'] === 'STUDENT_GOAL_FORWARD', 'server resolves selected candidate by allowlisted id');
$rebuilt = MMPS_Region::reconstruct($paragraphs, $region, $selected['replacement_region']);
check(true === MMPS_Region::verify_protected($rebuilt, $region), 'selected candidate reconstructs with protected ROOT unchanged');
$rebuilt[0] .= ' tampered';
check(is_wp_error(MMPS_Region::verify_protected($rebuilt, $region)), 'protected ROOT drift fails closed');

$duplicate = $set;
$duplicate['candidates'][1]['replacement_region'] = $duplicate['candidates'][0]['replacement_region'];
$duplicate['candidates'][1]['segments'] = $duplicate['candidates'][0]['segments'];
$bad = MMPS_Generator::validate_candidate_set($duplicate, $bundle, $plan, $root);
check(in_array('CANDIDATES_TOO_SIMILAR', wp_list_pluck($bad['blocking'], 'code'), true), 'near-duplicate alternatives are blocked');

$sharedOpening = $set;
$sharedOpening['candidates'][1]['segments'][0] = $sharedOpening['candidates'][0]['segments'][0];
$sharedOpening['candidates'][1]['replacement_region'] = implode(' ', wp_list_pluck($sharedOpening['candidates'][1]['segments'], 'text'));
$sharedOpeningCheck = MMPS_Generator::validate_candidate_set($sharedOpening, $bundle, $plan, $root);
check(in_array('CANDIDATES_TOO_SIMILAR', wp_list_pluck($sharedOpeningCheck['blocking'], 'code'), true), 'shared opening scaffold is blocked even when the remaining wording differs');

$longName = 'HCA Florida Healthcare University School of Medicine Graduate Medical Education Tampa South Brandon Hospital Program';
$longBundle = $bundle;
$longBundle['program']['programName'] = $longName;
$longBundle['program']['institution'] = 'HCA Florida Healthcare University School of Medicine';
$longBundle['nameForms'] = array($longName);
$longPlan = $plan;
$longPlan['allowedFacts'][0]['text'] = 'The program is ' . $longName . '.';
$longNameSet = $set;
foreach ($longNameSet['candidates'] as &$candidate) {
	$candidate['replacement_region'] = str_replace('Lakeview Internal Medicine Residency', $longName, $candidate['replacement_region']);
	foreach ($candidate['segments'] as &$segment) {
		$segment['text'] = str_replace('Lakeview Internal Medicine Residency', $longName, $segment['text']);
	}
	unset($segment);
}
unset($candidate);
$longNameCheck = MMPS_Generator::validate_candidate_set($longNameSet, $longBundle, $longPlan, $root);
check(empty($longNameCheck['blocking']), 'required long program name is excluded from copied-scaffold diversity checks');

$evidenceText = 'The cardiology fellowship accepts applicants after completing three years of internal medicine residency.';
$evidenceFact = array('factId' => 'F-deep', 'category' => 'fellowship', 'label' => 'Cardiology fellowship eligibility', 'text' => $evidenceText);
$evidenceBundle = $bundle;
$evidenceBundle['deepFacts'] = array($evidenceFact);
$evidencePlan = $plan;
$evidencePlan['allowedFacts'][] = $evidenceFact;
$evidenceSet = $set;
foreach ($evidenceSet['candidates'] as &$candidate) {
	$factSegment = array('text' => $evidenceText, 'kind' => 'program_fact', 'fact_ids' => array('F-deep'));
	array_splice($candidate['segments'], 1, 0, array($factSegment));
	$candidate['replacement_region'] = implode(' ', wp_list_pluck($candidate['segments'], 'text'));
	$candidate['facts_used'][] = 'F-deep';
}
unset($candidate);
$evidenceCheck = MMPS_Generator::validate_candidate_set($evidenceSet, $evidenceBundle, $evidencePlan, $root);
check(empty($evidenceCheck['blocking']), 'shared verified evidence literal is excluded from copied-scaffold diversity checks');

$unallowedEvidenceSet = $evidenceSet;
foreach ($unallowedEvidenceSet['candidates'] as &$candidate) {
	$candidate['segments'][1]['fact_ids'] = array('F-name');
	$candidate['facts_used'] = array('F-name');
}
unset($candidate);
$unallowedEvidenceCheck = MMPS_Generator::validate_candidate_set($unallowedEvidenceSet, $evidenceBundle, $plan, $root);
check(in_array('CANDIDATES_TOO_SIMILAR', wp_list_pluck($unallowedEvidenceCheck['blocking'], 'code'), true), 'an unselected bundle fact cannot be normalized as authorized evidence');

$select = new ReflectionMethod(MMPS_Generator::class, 'with_selected_candidate');
if (PHP_VERSION_ID < 80100) { $select->setAccessible(true); }
$badOutput = $select->invoke(null, $duplicate, 'BALANCED_QUIET_SPECIFIC');
$badRun = array(
	'run_uuid' => '00000000-0000-4000-8000-000000000001', 'status' => 'NEEDS_ATTENTION',
	'tier_requested' => 'ESSENTIAL', 'tier_effective' => 'ESSENTIAL', 'strategy_key' => 'BALANCED_QUIET_SPECIFIC',
	'provider' => 'simulator', 'model' => 'offline-simulator', 'validation' => $bad,
);
$previewBundle = $bundle + array('evidenceQuality' => array('label' => 'ESSENTIAL_ONLY'), 'bundleSha256' => str_repeat('a', 64));
$previewPlan = $plan + array('reasons' => array());
$badPreview = MMPS_Generator::preview($badRun, $root, $previewBundle, $previewPlan, $badOutput);
check(!empty($badPreview['validation']['blocking']) && empty($badPreview['selectedValidation']['blocking']) && $badPreview['canApprove'] === false, 'set-level failure remains visible even when the recommended candidate passes individually');

$simulated = MMPS_Provider_Simulator::complete(array(
	'program' => $bundle['program'],
	'allowed_facts' => array(array('fact_id' => 'F-name', 'label' => 'Program name', 'text' => $nameFact['text'])),
	'requested_strategies' => array_map(static fn($key, $description) => array('key' => $key, 'description' => $description), array_keys(MMPS_Generator::strategies()), MMPS_Generator::strategies()),
));
$simValidation = MMPS_Generator::validate_candidate_set($simulated['json'], $bundle, $plan, $root);
check(empty($simValidation['blocking']) && count($simValidation['validCandidateIds']) === 5, 'simulator emits a valid and meaningfully distinct five-candidate set');

fwrite(STDOUT, "PSV M2 RUNTIME: PASS ({$passes} assertions)\n");
