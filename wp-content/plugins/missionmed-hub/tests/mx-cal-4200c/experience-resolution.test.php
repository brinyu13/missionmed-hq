<?php
declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );
function sanitize_key( $value ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) );
}

require_once dirname( __DIR__, 2 ) . '/includes/class-mmed-calendar-experience.php';

$cases = array(
	array( true, 'storyforge', 'storyforge', true, 'classic', 'force classic wins' ),
	array( false, 'storyforge', 'classic', true, 'storyforge', 'valid user preference wins' ),
	array( false, '', 'storyforge', true, 'storyforge', 'Founder default is StoryForge' ),
	array( false, '', '', true, 'classic', 'Classic is final fallback' ),
	array( false, 'storyforge', 'storyforge', false, 'classic', 'disabled V2 falls back independently' ),
);

foreach ( $cases as $case ) {
	list( $force, $user, $default, $enabled, $expected, $label ) = $case;
	$actual = MMED_Calendar_Experience::resolve_values( $force, $user, $default, $enabled );
	if ( $actual !== $expected ) {
		fwrite( STDERR, "FAIL {$label}: expected {$expected}, got {$actual}\n" );
		exit( 1 );
	}
}

echo "PASS experience precedence and fallback\n";

