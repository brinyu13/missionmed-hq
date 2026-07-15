<?php
/**
 * Fixture-only characterization of Calendar's explicit private audience seam.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

function sanitize_key( $value ): string { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ) ?? ''; }
function absint( $value ): int { return abs( (int) $value ); }

$GLOBALS['v1_test_admin'] = true;
function current_user_can( string $capability ): bool { return 'manage_options' === $capability && true === $GLOBALS['v1_test_admin']; }

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php';

final class V1_Test_Calendar_Engine extends MMED_Calendar_Engine {
	public static function resolve( array $raw, int $owner, string $source = 'manual' ): int {
		return parent::resolve_event_user_id( $raw, $owner, $source );
	}
}

function expect_same( $expected, $actual, string $label ): void {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

expect_same( 42, V1_Test_Calendar_Engine::resolve( array( 'audience' => 'private' ), 42 ), 'admin explicit private stays owned' );
expect_same( 0, V1_Test_Calendar_Engine::resolve( array(), 42 ), 'existing admin manual default remains global' );
expect_same( 0, V1_Test_Calendar_Engine::resolve( array( 'audience' => 'all_students' ), 42 ), 'explicit global remains global' );

$GLOBALS['v1_test_admin'] = false;
expect_same( 42, V1_Test_Calendar_Engine::resolve( array(), 42 ), 'learner event remains owned' );

echo "Calendar private audience seam: ok\n";
