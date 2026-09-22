<?php
// Validator scenarios from the adversarial review. LOCAL HARNESS ONLY.
$_SERVER['HTTP_HOST']='127.0.0.1:8088';$_SERVER['REQUEST_URI']='/';$harness_root=getenv('MMPS_HARNESS_ROOT')?:'/home/claude/wpdev';require $harness_root.'/site/wp-load.php';
$root = array( 'paragraphs' => array( 'I cooked in the kitchen of a district hospital for 12 months.', 'Second paragraph about patients who lack access.', 'I hope to train at your program.' ), 'specialtyLabel' => 'Internal Medicine' );
$F = function ( $id, $label, $text, $cat = 'identity' ) { return array( 'factId' => $id, 'label' => $label, 'text' => $text, 'category' => $cat ); };
$bundle = array( 'nameForms' => array( "St. Christopher's Hospital Internal Medicine Residency", "St. Christopher's Hospital", 'Cleveland Clinic Foundation' ), 'program' => array( 'programName' => "St. Christopher's Hospital Internal Medicine Residency", 'city' => 'Philadelphia', 'state' => 'PA', 'programSpecialtyId' => 'x' ) );
$plan = array( 'tierEffective' => 'DEEP', 'allowedFacts' => array( $F( 'F-name', 'Program name', "The program is St. Christopher's Hospital Internal Medicine Residency." ), $F( 'F-pd', 'Program director', 'The current program director is Dr. Marisol Ventresca, MD, MPH.' ), $F( 'F-qi', 'QI', 'Required QI project with a 4-week block in PGY-2', 'research' ) ), 'studentFacts' => array( array( 'id' => 'S-research', 'text' => 'The applicant says research matters to them.' ) ) );
$run = function ( $segments, $extra = '' ) use ( $bundle, $plan, $root ) {
	$text = implode( ' ', array_map( function ( $s ) { return $s['text']; }, $segments ) ) . $extra;
	$v = MMPS_Generator::validate( array( 'replacement_region' => $text, 'segments' => $segments, 'facts_used' => array(), 'self_check' => array() ), $bundle, $plan, $root, array() );
	return array_map( function ( $f ) { return $f['code'] . ':' . $f['message']; }, $v['blocking'] );
};
$name = array( 'text' => "I hope to train at St. Christopher\u{2019}s Hospital.", 'kind' => 'program_fact', 'fact_ids' => array( 'F-name' ) );
$S = function ( $t ) { return array( 'text' => $t, 'kind' => 'student_link', 'fact_ids' => array() ); };
$P = function ( $t, $ids ) { return array( 'text' => $t, 'kind' => 'program_fact', 'fact_ids' => $ids ); };
$cases = array(
	array( 'curly apostrophe still names the program; supported PD; clean', array( $name, $P( 'It is led by Dr. Marisol Ventresca.', array( 'F-pd' ) ) ), array() ),
	array( 'short unsupported name "Dr. Amy Lee"', array( $name, $S( 'I admire the work of Dr. Amy Lee there.' ) ), array( 'UNSUPPORTED_NAME' ) ),
	array( '"Dr. Wei Chen" must not pass because ROOT says "kitchen"', array( $name, $S( 'I spoke with Dr. Wei Chen about it.' ) ), array( 'UNSUPPORTED_NAME' ) ),
	array( 'accented name "Dr. José Núñez"', array( $name, $S( 'I have followed Dr. José Núñez for years.' ) ), array( 'UNSUPPORTED_NAME' ) ),
	array( 'single proper noun "Harvard" mid-sentence', array( $name, $S( 'It reminds me of Harvard in its rigor.' ) ), array( 'UNSUPPORTED_NAME' ) ),
	array( 'sentence-initial multiword proper noun', array( $name, $S( 'Mayo Clinic shaped my thinking.' ) ), array( 'UNSUPPORTED_NAME' ) ),
	array( 'numbers and acronyms must be whole tokens ("1" vs ROOT "12"; "ICU" unsupported)', array( $name, $P( 'It has 3 campuses and 1 ICU.', array( 'F-name' ) ) ), array( 'UNSUPPORTED_NUMBER', 'UNSUPPORTED_NAME' ) ),
	array( 'supported number and acronym from a fact', array( $name, $P( 'Residents complete a QI project in a 4-week block in PGY-2.', array( 'F-qi' ) ) ), array() ),
	array( 'possessive of a supported name', array( $name, $S( "I value Cleveland Clinic Foundation's approach, as I wrote above." ) ), array() ),
	array( '"without a mentor" and "lack access" are about the applicant, not the program', array( $name, $S( 'I could not have done this without a mentor, and I care about patients who lack access.' ) ), array() ),
	array( 'absence about the program', array( $name, $S( 'Although the program does not have a cardiology fellowship, I would thrive.' ) ), array( 'ABSENCE_OR_COMPARISON' ) ),
	array( 'comparison', array( $name, $S( 'It is better than the others I have seen.' ) ), array( 'ABSENCE_OR_COMPARISON' ) ),
	array( 'student_link may cite a student fact id', array( $name, array( 'text' => 'Research matters to me.', 'kind' => 'student_link', 'fact_ids' => array( 'S-research' ) ) ), array() ),
	array( 'unknown fact id', array( $name, $P( 'It has a track.', array( 'F-nope' ) ) ), array( 'UNKNOWN_FACT_ID', 'FACT_WITHOUT_EVIDENCE' ) ),
	array( 'ordinary sentence-initial capital is not a proper noun', array( $name, $S( 'Training there would let me keep measuring gaps.' ) ), array() ),
	array( 'invented family tie', array( $name, $S( 'It is close to my family.' ) ), array( 'INVENTED_PERSONAL_TIE' ) ),
	array( 'leftover placeholder', array( $name, $S( 'I, [[APPLICANT_0]], would be glad to join.' ) ), array( 'PLACEHOLDER_LEFT', 'TEMPLATE_SLOT_LEFT', 'UNSUPPORTED_NUMBER' ) ),
);
$fail = 0;
foreach ( $cases as $c ) {
	$codes = array_values( array_unique( array_map( function ( $x ) { return strtok( $x, ':' ); }, $run( $c[1] ) ) ) );
	sort( $codes ); $want = $c[2]; sort( $want );
	$ok = $codes === $want; $fail += $ok ? 0 : 1;
	echo ( $ok ? 'PASS ' : 'FAIL ' ) . $c[0] . ( $ok ? '' : '  got=' . implode( ',', $codes ) . ' want=' . implode( ',', $want ) ) . "\n";
}
// a sentence outside the segments must be caught
$codes = $run( array( $name ), ' It has a new cardiac hospital with robotic surgery.' );
$ok = (bool) preg_grep( '/^SEGMENTS_MISMATCH/', $codes ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "sentence outside segments is blocking\n";
$candidate = function ( $id, $segments ) {
	return array( 'candidate_id' => $id, 'strategy' => $id, 'replacement_region' => implode( ' ', array_map( function ( $segment ) { return $segment['text']; }, $segments ) ), 'segments' => $segments, 'facts_used' => array(), 'root_anchor_terms' => array(), 'rhetorical_focus' => $id, 'self_check' => array() );
};
$candidate_set = MMPS_Generator::validate_candidate_set(
	array(
		'recommended_candidate_id' => 'TRAINING_ENVIRONMENT',
		'candidates' => array(
			$candidate( 'TRAINING_ENVIRONMENT', array( $name, $S( 'I spoke with Dr. Amy Lee about it.' ) ) ),
			$candidate( 'BALANCED_QUIET_SPECIFIC', array( array( 'text' => "St. Christopher's Hospital Internal Medicine Residency would give that work a concrete setting.", 'kind' => 'program_fact', 'fact_ids' => array( 'F-name' ) ), $S( 'The district hospital taught me to keep careful attention close to practical work.' ) ) ),
		),
	),
	$bundle,
	$plan,
	$root,
	array(),
	array( 'TRAINING_ENVIRONMENT', 'BALANCED_QUIET_SPECIFIC' )
);
$ok = array( 'BALANCED_QUIET_SPECIFIC' ) === $candidate_set['validCandidateIds'] && 'BALANCED_QUIET_SPECIFIC' === $candidate_set['recommendedCandidateId'] && ! empty( $candidate_set['candidateResults']['TRAINING_ENVIRONMENT']['blocking'] ) && empty( $candidate_set['candidateResults']['BALANCED_QUIET_SPECIFIC']['blocking'] ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "candidate-specific failure preserves clean alternative and rebinds recommendation\n";
// redaction: unicode names, no substring damage, fail closed shape
$ref = new ReflectionClass( 'MMPS_Generator' ); $red = $ref->getMethod( 'redact' ); $red->setAccessible( true ); $res = $ref->getMethod( 'restore' ); $res->setAccessible( true );
$uid = wp_insert_user( array( 'user_login' => 'u' . wp_rand(), 'user_pass' => wp_generate_password(), 'first_name' => 'Łukasz', 'last_name' => 'Ann', 'display_name' => 'Łukasz "Luke" Ann' ) );
$payload = array( 'root_paragraphs' => array( 'I am Łukasz Ann. My plan changed annually. ŁUKASZ wrote this.' ) );
$out = $red->invoke( null, $payload, $uid ); $txt = $out['root_paragraphs'][0];
$ok = false === mb_stripos( $txt, 'ukasz' ) && false !== strpos( $txt, 'annually' ) && ! preg_match( '/\bAnn\b/', $txt ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "redaction: unicode first name, whole-word last name, 'annually' untouched -> $txt\n";
$back = $res->invoke( null, array( 'replacement_region' => 'I, [[APPLICANT_0]], and [[APPLICANT_1]].' ), $uid );
$ok = false === strpos( $back['replacement_region'], '[[APPLICANT_' ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "restore: placeholders restored even with quotes in the display name -> {$back['replacement_region']}\n";
require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user( $uid );
// year-only dates never look fresh
$b = MMPS_Evidence_Bundle::project( array( 'program' => array( 'programSpecialtyId' => 'p', 'display' => array( 'programName' => 'Test Program Name' ), 'fields' => array() ), 'research' => array( 'currentFacts' => array( array( 'field' => 'research.curriculum', 'provider' => 'X', 'retrievedAt' => '2019', 'sourceUrl' => 'https://a.example/x', 'canonicalValue' => array( 'curriculum' => array( array( 'title' => 'Old thing' ) ) ) ), array( 'field' => 'research.leadership', 'provider' => 'X', 'retrievedAt' => gmdate( 'c' ), 'sourceUrl' => 'https://a.example/l', 'canonicalValue' => array( 'leadership' => array( array( 'name' => 'Dr. Fellow Person', 'role' => 'Fellowship Program Director' ) ) ) ) ) ) ) );
$ok = 0 === count( $b['deepFacts'] ) && 'STALE' === $b['exclusions'][0]['code'] && empty( $b['essential']['programDirector'] ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "year-only date is not fresh; fellowship program director is not the PD\n";
$tracked = MMPS_Evidence_Bundle::project( array( 'program' => array( 'programSpecialtyId' => 'tracked', 'designation' => 'Internal Medicine', 'display' => array( 'programName' => 'Very Long University Medical Center Internal Medicine Residency' ), 'identifiers' => array( array( 'namespace' => 'ACGME_PROGRAM', 'value' => '1403521316' ) ), 'tracks' => array( array( 'programType' => 'Categorical', 'nrmpCode' => '1516140C0', 'code' => 'MUST_NOT_BE_USED' ) ), 'fields' => array(), 'source' => array() ), 'research' => array() ) );
$ok = 'Categorical' === $tracked['program']['trainingType'] && '1516140C0' === $tracked['program']['nrmpCode'] && 'RESOLVED' === $tracked['program']['nrmpTrackStatus'] && 1 === count( $tracked['program']['trackIdentities'] ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "RISE track contract consumes only explicit authoritative NRMP fields\n";
$rest_ref = new ReflectionClass( 'MMPS_Rest' );
$eras_hash = $rest_ref->getMethod( 'eras_normalized_hash' ); $eras_hash->setAccessible( true );
$left_hash = $eras_hash->invoke( null, "Applicant\u{2019}s sentence.  \r\n\r\nSecond paragraph.\r\n" );
$right_hash = $eras_hash->invoke( null, "Applicant's sentence.\n\nSecond paragraph." );
$changed_hash = $eras_hash->invoke( null, "Applicant's changed sentence.\n\nSecond paragraph." );
$ok = hash_equals( $left_hash, $right_hash ) && ! hash_equals( $left_hash, $changed_hash ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "ERAS normalization covers proven apostrophe/line-ending whitespace only and preserves substantive differences\n";
$title_method = $rest_ref->getMethod( 'myeras_title' ); $title_method->setAccessible( true );
$title = $title_method->invoke( null, 'Very Long University Medical Center Internal Medicine Residency', 'Internal Medicine', 'Categorical', '1516140C0', '1403521316' );
$ok = mb_strlen( $title ) <= 50 && false !== strpos( $title, 'IM Cat' ) && false !== strpos( $title, '1516140C0' ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "MyERAS title is deterministic, track-aware and at most 50 characters: $title\n";
$manifest_method = $rest_ref->getMethod( 'assignment_manifest_payload' ); $manifest_method->setAccessible( true );
$manifest = $manifest_method->invoke( null, array( array( 'docUuid' => 'doc-1', 'programSpecialtyId' => 'tracked', 'programName' => 'Very Long University Medical Center Internal Medicine Residency', 'specialtyLabel' => 'Internal Medicine', 'acgmeId' => '1403521316', 'versionNumber' => 1, 'status' => 'APPROVED', 'title' => 'File Vault title remains separate', 'fullText' => "Applicant\u{2019}s sentence.\n\nSecond paragraph.", 'fullTextSha256' => str_repeat( 'a', 64 ), 'metadata' => array( 'trainingType' => 'Categorical', 'trainingTypes' => array( 'Categorical' ), 'trainingTypeStatus' => 'RESOLVED', 'nrmpCode' => '1516140C0', 'nrmpCodes' => array( '1516140C0' ), 'nrmpTrackStatus' => 'RESOLVED' ) ) ), 3 );
$manifest_item = $manifest['items'][0];
$ok = 'missionmed.psv.eras-assignment-manifest.v2' === $manifest['schema'] && '1516140C0' === $manifest_item['nrmpCode'] && 'File Vault title remains separate' === $manifest_item['statementTitle'] && mb_strlen( $manifest_item['myErasTitle'] ) <= 50 && 'UNRESOLVED' === $manifest_item['myErasIdentityStatus'] && false === $manifest_item['assignmentEligible'] && 'NEEDS_ATTENTION' === $manifest_item['assignmentStatus'] && in_array( 'MYERAS_IDENTITY_UNRESOLVED', $manifest_item['identityAttentionReasons'], true ) && 1 === preg_match( '/^[a-f0-9]{64}$/D', $manifest_item['erasNormalizedTextSha256'] ); $fail += $ok ? 0 : 1; echo ( $ok ? 'PASS ' : 'FAIL ' ) . "manifest keeps identities separate and marks unresolved MyERAS rows NEEDS_ATTENTION\n";
echo "\n" . ( $fail ? "$fail FAILED" : 'all validator scenarios passed' ) . "\n"; exit( $fail ? 1 : 0 );
