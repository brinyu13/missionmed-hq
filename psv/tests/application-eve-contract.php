<?php
/** Static release contract for the Application-Eve template/bulk/library/ERAS delta. */
$root = dirname( __DIR__, 2 );
$files = array(
	'region' => $root . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-region.php',
	'gen'    => $root . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-generator.php',
	'batch'  => $root . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-batch.php',
	'rest'   => $root . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-rest.php',
	'ui'     => $root . '/wp-content/plugins/missionmed-file-vault-ps/assets/mmps-app.js',
);
foreach ( $files as $key => $path ) {
	if ( ! is_readable( $path ) ) { fwrite( STDERR, "FAIL missing $key\n" ); exit( 1 ); }
	$files[ $key ] = file_get_contents( $path );
}
$checks = array(
	'exact standalone marker-pair parser is code owned' => false !== strpos( $files['region'], "if ( '***' === \$paragraph )" ),
	'blank Program Paragraph Here is a distinct full-paragraph mode' => false !== strpos( $files['region'], "'[Program Paragraph Here]'" ) && false !== strpos( $files['region'], "? 'BLANK' : 'SLOTTED'" ),
	'finished prose blocks marker, bracket and em-dash leakage' => false !== strpos( $files['gen'], 'TEMPLATE_MARKER_LEFT' ) && false !== strpos( $files['gen'], 'TEMPLATE_SLOT_LEFT' ) && false !== strpos( $files['gen'], 'EM_DASH' ),
	'bulk capacity is exactly 150' => false !== strpos( $files['batch'], 'const MAX_ITEMS       = 150;' ),
	'Gold Silver and ambiguous priority are fail-closed classifications' => false !== strpos( $files['batch'], "'class' => 'GOLD'" ) && false !== strpos( $files['batch'], "'class' => 'SILVER'" ) && false !== strpos( $files['batch'], "'class' => 'AMBIGUOUS'" ),
	'batch source is the authenticated student RISE list' => false !== strpos( $files['batch'], 'AUTHENTICATED_STUDENT_RISE_LIST' ),
	'Full Paragraph defaults to one recommended candidate' => false !== strpos( $files['batch'], "'RECOMMENDED_ONLY'" ),
	'five alternatives remain an explicit on-demand route' => false !== strpos( $files['rest'], '/alternatives' ) && false !== strpos( $files['batch'], "'FIVE'" ),
	'Top 3 Reasons retains evidence and provenance' => false !== strpos( $files['batch'], 'TOP_3_REASONS' ) && false !== strpos( $files['batch'], "'sourceAuthority'" ) && false !== strpos( $files['batch'], "'retrievedAt'" ),
	'ERAS manifest is versioned canonical JSON' => false !== strpos( $files['rest'], 'missionmed.psv.eras-assignment-manifest.v1' ),
	'MyERAS identity is unresolved rather than guessed' => false !== strpos( $files['rest'], "'myErasIdentity'    => null" ) && false !== strpos( $files['rest'], "'myErasIdentityStatus' => 'UNRESOLVED'" ),
	'assignment is prepare then explicit confirmation' => false !== strpos( $files['rest'], 'PREPARE_THEN_EXPLICIT_CONFIRMATION' ),
	'assignment mission forbids application and payment actions' => false !== strpos( $files['rest'], "array( 'APPLY', 'PAY', 'CERTIFY', 'SUBMIT', 'WITHDRAW', 'SIGNAL', 'MESSAGE' )" ),
	'student UI exposes both bulk modes and High Priority Review' => false !== strpos( $files['ui'], 'Full Paragraph' ) && false !== strpos( $files['ui'], 'Top 3 Reasons' ) && false !== strpos( $files['ui'], 'High Priority Review' ),
	'ROOT adoption clears stale batch state and batch opening rebinds the exact ROOT' => false !== strpos( $files['ui'], 'S.batch.current = null; S.batch.index = null;' ) && false !== strpos( $files['ui'], "api('GET', '/roots/' + job.rootId)" ),
	'bulk approval remains fail closed for Gold ambiguous and priority 1 through 25 rows' => false !== strpos( $files['rest'], "\$item['goldStarred'] || null === \$priority || (int) \$priority <= 25" ) && false !== strpos( $files['ui'], 'Number(item.priorityPosition) > 25' ),
	'library exposes deterministic ERAS manifest download' => false !== strpos( $files['ui'], 'ERAS assignment manifest' ),
);
$failed = 0;
foreach ( $checks as $name => $pass ) {
	echo ( $pass ? 'PASS: ' : 'FAIL: ' ) . $name . "\n";
	if ( ! $pass ) { $failed++; }
}
echo "PSV APPLICATION EVE CONTRACT: " . ( $failed ? 'FAIL' : 'PASS' ) . ' (' . ( count( $checks ) - $failed ) . '/' . count( $checks ) . ")\n";
exit( $failed ? 1 : 0 );
