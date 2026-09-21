<?php
/** PSV P1 discovery and writer-quality static contract gate. */
$root = dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps';
$bundle = (string) file_get_contents( $root . '/includes/class-mmps-evidence-bundle.php' );
$rest = (string) file_get_contents( $root . '/includes/class-mmps-rest.php' );
$generator = (string) file_get_contents( $root . '/includes/class-mmps-generator.php' );
$ui = (string) file_get_contents( $root . '/assets/mmps-app.js' );
$plugin = (string) file_get_contents( $root . '/missionmed-file-vault-ps.php' );
$pass = 0;
$fail = 0;
function p1check( $ok, $label ) {
	global $pass, $fail;
	$ok ? $pass++ : $fail++;
	echo ( $ok ? 'PASS: ' : 'FAIL: ' ) . $label . "\n";
}
p1check( str_contains( $plugin, 'Version: 1.1.0' ) && str_contains( $plugin, "define( 'MMED_PSV_VERSION', '1.1.0' )" ), 'P1 has one auditable release version' );
p1check( str_contains( $bundle, "'specialty'" ) && str_contains( $bundle, "'jurisdiction'" ) && str_contains( $bundle, "'includeCombined' => 'false'" ), 'RISE search receives exact specialty and state filters and excludes combined specialties by default' );
p1check( str_contains( $rest, 'mmps_search_filter_required' ) && str_contains( $rest, 'mmps_search_state' ), 'server validates filtered browsing and state input' );
p1check( str_contains( $ui, 'data-search-specialty' ) && str_contains( $ui, 'data-search-state' ) && str_contains( $ui, "S.root.specialtyLabel" ), 'program discovery exposes specialty and state with ROOT-specialty defaulting' );
p1check( str_contains( $ui, "identity.designation" ) && str_contains( $ui, "'ACGME ' + identity.acgmeId" ), 'every program result exposes specialty and verified ACGME identity' );
p1check( str_contains( $ui, "act === 'clear-search'" ) && str_contains( $ui, 'function clearSearch()' ), 'filters have an explicit clear path' );
p1check( str_contains( $generator, "const PROMPT_VERSION = 'mmps-prompt.v3'" ) && str_contains( $generator, "'editorial_objective'" ), 'writer quality uses a new explicit editorial contract' );
p1check( str_contains( $generator, 'strongest one to three verified details' ) && str_contains( $generator, 'deep_max_program_facts' ), 'prompt bounds fact density instead of inserting a catalogue' );
p1check( str_contains( $generator, 'may not share a sentence scaffold' ) && str_contains( $generator, 'silently edit each candidate once' ), 'five alternatives require structural differentiation and an editorial pass' );
p1check( str_contains( $generator, 'complete residency Personal Statement as READ-ONLY context' ) && str_contains( $generator, 'write only a replacement' ), 'whole-ROOT read and exact-region write boundary remains explicit' );
echo "PSV P1 CONTRACT: " . ( $fail ? 'FAIL' : 'PASS' ) . " ($pass passed, $fail failed)\n";
exit( $fail ? 1 : 0 );
