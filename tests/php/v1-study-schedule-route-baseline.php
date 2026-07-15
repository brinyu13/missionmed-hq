<?php
/**
 * Fixture-only characterization of the legacy Study REST registration boundary.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

final class WP_REST_Server {
	const READABLE  = 'GET';
	const CREATABLE = 'POST';
	const EDITABLE  = 'PUT,PATCH';
	const DELETABLE = 'DELETE';
}

$GLOBALS['v1_registered_routes'] = array();
$GLOBALS['v1_logged_in']         = false;

function register_rest_route( string $namespace, string $route, array $args ): void {
	$GLOBALS['v1_registered_routes'][ $namespace . $route ] = $args;
}

function is_user_logged_in(): bool {
	return true === $GLOBALS['v1_logged_in'];
}

function expect_same( $expected, $actual, string $label ): void {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php';

MMED_REST_API::register_routes();

$collection = $GLOBALS['v1_registered_routes']['mmed/v1/study-blocks'] ?? null;
$item       = $GLOBALS['v1_registered_routes']['mmed/v1/study-blocks/(?P<id>\d+)'] ?? null;

expect_same( true, is_array( $collection ), 'legacy Study collection route is registered' );
expect_same( true, is_array( $item ), 'legacy Study item route is registered' );

foreach ( array_merge( $collection, $item ) as $endpoint ) {
	$callback = $endpoint['permission_callback'] ?? null;
	expect_same( array( 'MMED_REST_API', 'can_access' ), $callback, 'legacy Study permission remains login-only' );
}

expect_same( false, MMED_REST_API::can_access(), 'anonymous access is denied' );
$GLOBALS['v1_logged_in'] = true;
expect_same( true, MMED_REST_API::can_access(), 'any logged-in user currently passes' );

echo "legacy Study route baseline: ok\n";
