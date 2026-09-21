<?php
/** PSV P1 discovery and writer-quality static contract gate. */
$root = dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps';
$bundle = (string) file_get_contents( $root . '/includes/class-mmps-evidence-bundle.php' );
$rest = (string) file_get_contents( $root . '/includes/class-mmps-rest.php' );
$generator = (string) file_get_contents( $root . '/includes/class-mmps-generator.php' );
$provider = (string) file_get_contents( $root . '/includes/class-mmps-provider.php' );
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
p1check( str_contains( $ui, "identity.designation || ''" ) && ! str_contains( $ui, "identity.designation || (S.root" ) && str_contains( $ui, "'ACGME ' + identity.acgmeId" ), 'program rows never infer a missing specialty from the ROOT' );
p1check( str_contains( $bundle, "'' === \$identity['programSpecialtyId']" ) && str_contains( $bundle, "\$identity['designation'] !== trim" ), 'mismatched or incomplete upstream program identities fail closed' );
p1check( str_contains( $ui, "act === 'clear-search'" ) && str_contains( $ui, 'function clearSearch()' ), 'filters have an explicit clear path' );
p1check( str_contains( $generator, "const PROMPT_VERSION = 'mmps-prompt.v5'" ) && str_contains( $generator, "'editorial_objective'" ), 'writer quality uses a new explicit editorial contract' );
p1check( str_contains( $generator, 'strongest one to three verified details' ) && str_contains( $generator, 'deep_max_program_facts' ), 'prompt bounds fact density instead of inserting a catalogue' );
p1check( str_contains( $generator, 'do not repeat a clause of four or more consecutive words' ) && str_contains( $generator, 'silently edit each candidate once' ), 'five alternatives require structural differentiation and an editorial pass' );
p1check( str_contains( $generator, 'generic claim about growth, service, learning, curiosity or contribution is not an applicant anchor' ) && str_contains( $generator, 'both a program-name swap and an applicant swap' ), 'writer requires ROOT-specific anchors and rejects stock applicant language' );
p1check( str_contains( $generator, "'target_words'" ) && str_contains( $generator, "'transition_contract'" ) && str_contains( $generator, 'two-sided transition test' ), 'writer has a concise two-sided transition contract' );
p1check( str_contains( $generator, "'root_anchor_terms'" ) && str_contains( $generator, "'ROOT_ANCHOR_REQUIRED'" ) && str_contains( $generator, "'requireRootAnchors'" ), 'real-provider candidates must prove distinct protected-ROOT anchors' );
p1check( str_contains( $provider, "'timeout'     => 70" ) && str_contains( $provider, 'below the observed ~100 s edge ceiling' ), 'real provider has bounded headroom for five structured candidates' );
p1check( str_contains( $provider, "'effort' => 'low'" ) && str_contains( $provider, 'server validators carry quality' ), 'provider latency is bounded without weakening deterministic quality gates' );
p1check( str_contains( $generator, 'complete residency Personal Statement as READ-ONLY context' ) && str_contains( $generator, 'write only a replacement' ), 'whole-ROOT read and exact-region write boundary remains explicit' );
echo "PSV P1 CONTRACT: " . ( $fail ? 'FAIL' : 'PASS' ) . " ($pass passed, $fail failed)\n";
exit( $fail ? 1 : 0 );
