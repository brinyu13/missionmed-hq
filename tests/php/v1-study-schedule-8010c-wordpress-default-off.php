<?php
/**
 * Disposable real-WordPress proof that the V1 Study Schedule runtime is inert
 * unless its exact source binding constant is true.
 */

declare(strict_types=1);

if ( ! defined( 'WPINC' ) ) {
	throw new RuntimeException( 'This fixture requires disposable WordPress.' );
}

function v1_8010c_default_off_expect( $condition, $label ) {
	if ( ! $condition ) {
		throw new RuntimeException( $label );
	}
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1_REPO_ROOT is required.' );
}

v1_8010c_default_off_expect(
	! defined( 'MMED_V1_STUDY_RUNTIME_BINDING' ),
	'default-off fixture must start without the runtime binding constant'
);

$v1_queries = array();
$query_filter = static function ( $query ) use ( &$v1_queries ) {
	if ( false !== stripos( (string) $query, 'mmed_v1ss_' ) ) {
		$v1_queries[] = (string) $query;
	}
	return $query;
};
add_filter( 'query', $query_filter );

try {
	require_once $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php';

	v1_8010c_default_off_expect( class_exists( 'MMED_V1_Study_Runtime', false ), 'plugin loads the runtime gate class' );
	v1_8010c_default_off_expect( false === MMED_V1_Study_Runtime::enabled(), 'runtime remains disabled without the exact binding constant' );
	v1_8010c_default_off_expect( ! class_exists( 'MMED_V1_Study_REST_API', false ), 'default-off boot does not load V1 REST' );
	v1_8010c_default_off_expect( ! class_exists( 'MMED_V1_Study_Loader', false ), 'default-off boot does not load the V1 browser loader' );
	v1_8010c_default_off_expect( ! class_exists( 'MMED_V1_Study_InnoDB_Repository', false ), 'default-off boot does not construct or load the physical repository' );
	v1_8010c_default_off_expect(
		false === has_action( 'rest_api_init', array( 'MMED_V1_Study_REST_API', 'register_routes' ) ),
		'default-off boot registers no V1 REST hook'
	);
	v1_8010c_default_off_expect(
		false === has_action( 'wp_enqueue_scripts', array( 'MMED_V1_Study_Loader', 'enqueue' ) ),
		'default-off boot registers no V1 asset hook'
	);

	do_action( 'rest_api_init' );
	$routes = rest_get_server()->get_routes();
	$v1_route = '/' . MMED_V1_Study_Release::REST_NAMESPACE . MMED_V1_Study_Release::BOOTSTRAP_ROUTE;
	v1_8010c_default_off_expect( ! isset( $routes[ $v1_route ] ), 'default-off WordPress exposes no V1 Study Schedule route' );
	v1_8010c_default_off_expect( array() === $v1_queries, 'default-off WordPress performs no V1 persistence query' );
} finally {
	remove_filter( 'query', $query_filter );
}

echo "V1 Study Schedule 8010C disposable WordPress default-off integration: ok\n";
