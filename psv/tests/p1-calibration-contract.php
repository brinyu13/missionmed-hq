<?php
/** Frozen, redacted P1 writer calibration receipt contract. */
$path = __DIR__ . '/fixtures/p1-writer-calibration.v1.json';
$raw = (string) file_get_contents( $path );
$data = json_decode( $raw, true );
$fail = 0;
function calibration_check( $ok, $label ) {
	global $fail;
	if ( ! $ok ) { $fail++; }
	echo ( $ok ? 'PASS: ' : 'FAIL: ' ) . $label . "\n";
}
calibration_check( is_array( $data ) && 'p1-writer-calibration.v1' === ( $data['schemaVersion'] ?? '' ), 'calibration receipt is valid JSON with an explicit schema' );
calibration_check( 'mmps-prompt.v5' === ( $data['promptVersion'] ?? '' ) && 'low' === ( $data['reasoningEffort'] ?? '' ), 'receipt identifies the frozen runtime prompt and model effort' );
calibration_check( false === ( $data['fixtureProseRetained'] ?? true ) && false === ( $data['candidateProseRetained'] ?? true ) && false === ( $data['providerStore'] ?? true ), 'receipt retains no student or candidate prose and records store false' );
$baseline = end( $data['iterations'] );
$profiles = (array) ( $baseline['profiles'] ?? array() );
calibration_check( 'FOUNDER_ACCEPTED_BASELINE' === ( $baseline['result'] ?? '' ) && 3 === count( $profiles ), 'Founder token-economy steer freezes the bounded three-profile baseline' );
calibration_check( 0 === array_sum( array_map( function ( $profile ) { return (int) ( $profile['deterministicBlockingCount'] ?? 99 ); }, $profiles ) ), 'all frozen candidates passed deterministic safety and grounding gates' );
calibration_check( 15 === array_sum( array_map( function ( $profile ) { return (int) ( $profile['candidateCount'] ?? 0 ); }, $profiles ) ), 'calibration covered fifteen generated candidates' );
calibration_check( 'PASS' === ( $profiles[0]['rubricStatus'] ?? '' ) && 'PASS' === ( $profiles[1]['rubricStatus'] ?? '' ), 'strong Deep and moderate profiles passed every editorial rubric dimension' );
calibration_check( 'ACCEPTED_BASELINE_LIMIT' === ( $profiles[2]['rubricStatus'] ?? '' ) && array( 'GENERIC', 'TEMPLATED' ) === ( $profiles[2]['issueCodes'] ?? array() ), 'Essential weakness is explicit rather than falsely reported as a pass' );
calibration_check( false === stripos( $raw, 'api_key' ) && false === stripos( $raw, 'bearer ' ) && false === stripos( $raw, 'replacement_region' ) && false === stripos( $raw, 'root_paragraphs' ), 'receipt contains no secret field or prose-bearing payload field' );
echo 'PSV P1 CALIBRATION CONTRACT: ' . ( $fail ? 'FAIL' : 'PASS' ) . "\n";
exit( $fail ? 1 : 0 );
