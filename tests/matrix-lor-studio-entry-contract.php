<?php
/**
 * Standalone contract tests for the Matrix LOR Studio entry controller.
 */

$matrix_lor_fixture_root = sys_get_temp_dir() . '/missionmed-matrix-lor-studio-entry-' . getmypid();

define( 'ABSPATH', __DIR__ . '/' );
define( 'WP_PLUGIN_DIR', $matrix_lor_fixture_root . '/plugins' );

$GLOBALS['matrix_lor_actions']             = array();
$GLOBALS['matrix_lor_filters']             = array();
$GLOBALS['matrix_lor_inline_scripts']      = array();
$GLOBALS['matrix_lor_unregistered_routes'] = array();
$GLOBALS['matrix_lor_script_enqueued']     = false;
$GLOBALS['matrix_lor_entitlement_calls']   = 0;
$GLOBALS['matrix_lor_entitlement']         = array(
	'contract'          => 'missionmed.lor.wordpress-entitlement.v1',
	'admitted'          => true,
	'canaryEnabled'     => true,
	'canaryConsented'   => true,
	'subject'            => 'wp:17',
);

/**
 * Capture action registration.
 */
function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['matrix_lor_actions'][] = array( $hook, $callback, $priority, $accepted_args );
}

/**
 * Capture filter registration.
 */
function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['matrix_lor_filters'][] = array( $hook, $callback, $priority, $accepted_args );
}

/**
 * Report the controlled script enqueue state.
 */
function wp_script_is( $handle, $status = 'enqueued' ) {
	return 'mmed-student-os-js' === $handle
		&& 'enqueued' === $status
		&& true === $GLOBALS['matrix_lor_script_enqueued'];
}

/**
 * Encode a browser projection using WordPress-compatible semantics.
 */
function wp_json_encode( $value, $flags = 0, $depth = 512 ) {
	return json_encode( $value, $flags, $depth );
}

/**
 * Capture inline script injection.
 */
function wp_add_inline_script( $handle, $data, $position = 'after' ) {
	$GLOBALS['matrix_lor_inline_scripts'][] = array( $handle, $data, $position );

	return true;
}

/**
 * Capture REST route removal.
 */
function unregister_rest_route( $namespace, $route, $override = false ) {
	$GLOBALS['matrix_lor_unregistered_routes'][] = array( $namespace, $route, $override );

	return true;
}

/**
 * Provide the sole simulated WordPress entitlement projection.
 */
function mmhq_lor_studio_current_identity_entitlement() {
	++$GLOBALS['matrix_lor_entitlement_calls'];

	return $GLOBALS['matrix_lor_entitlement'];
}

require_once dirname( __DIR__ ) . '/wp-content/mu-plugins/missionmed-matrix-lor-studio-entry.php';

$checks = 0;

/**
 * Fail the contract immediately on a false assertion.
 */
function matrix_lor_assert( $condition, $message ) {
	global $checks;
	++$checks;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

/**
 * Remove only the isolated fixture paths created by this test.
 */
function matrix_lor_cleanup_fixture() {
	$asset_dir = WP_PLUGIN_DIR . '/missionmed-hub/assets';
	foreach (
		array(
			$asset_dir . '/' . MMHQ_LOR_STUDIO_MATRIX_ASSET,
			$asset_dir . '/successor-target.js',
		) as $file
	) {
		if ( is_file( $file ) || is_link( $file ) ) {
			unlink( $file );
		}
	}
	if ( is_dir( $asset_dir ) ) {
		rmdir( $asset_dir );
	}
	if ( is_dir( WP_PLUGIN_DIR . '/missionmed-hub' ) ) {
		rmdir( WP_PLUGIN_DIR . '/missionmed-hub' );
	}
	if ( is_dir( WP_PLUGIN_DIR ) ) {
		rmdir( WP_PLUGIN_DIR );
	}
	$root = dirname( WP_PLUGIN_DIR );
	if ( is_dir( $root ) ) {
		rmdir( $root );
	}
}

register_shutdown_function( 'matrix_lor_cleanup_fixture' );

matrix_lor_assert( 'student-os.56c7c339ee12cdd0.js' === MMHQ_LOR_STUDIO_MATRIX_ASSET, 'successor immutable asset is exact' );
matrix_lor_assert( 'student-os.809093d2b5b2bc05.js' === MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET, 'fallback immutable asset is exact' );
matrix_lor_assert( 'lor-studio' === MMHQ_LOR_STUDIO_MATRIX_ROUTE, 'Matrix route is exact' );
matrix_lor_assert( 'https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start' === MMHQ_LOR_STUDIO_MATRIX_LAUNCH_URL, 'launch URL is exact' );

foreach ( array( 'off', 'canary', 'on' ) as $mode ) {
	matrix_lor_assert( $mode === mmhq_lor_studio_matrix_normalize_mode( $mode ), "exact {$mode} mode survives normalization" );
}
foreach ( array( null, false, true, 0, 1, '', 'OFF', 'Canary', 'on ', ' on', "on\n", 'beta', '1', array() ) as $invalid_mode ) {
	matrix_lor_assert( 'off' === mmhq_lor_studio_matrix_normalize_mode( $invalid_mode ), 'invalid mode fails closed' );
}
matrix_lor_assert( 'off' === mmhq_lor_studio_matrix_mode(), 'undefined mode defaults off' );
matrix_lor_assert( false === mmhq_lor_studio_matrix_current_user_allowed(), 'default-off wrapper denies entry' );
matrix_lor_assert( 0 === $GLOBALS['matrix_lor_entitlement_calls'], 'default-off wrapper does not query entitlement' );

$valid_projection = array(
	'contract'          => 'missionmed.lor.wordpress-entitlement.v1',
	'admitted'          => true,
	'canaryEnabled'     => true,
	'canaryConsented'   => true,
	'subject'            => 'wp:17',
);
matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $valid_projection, 'off' ), 'off denies a valid projection' );
matrix_lor_assert( true === mmhq_lor_studio_matrix_projection_allows( $valid_projection, 'on' ), 'on admits an exact valid projection' );
matrix_lor_assert( true === mmhq_lor_studio_matrix_projection_allows( $valid_projection, 'canary' ), 'canary admits exact consent booleans' );

$invalid_projection = $valid_projection;
$invalid_projection['contract'] = 'missionmed.lor.wordpress-entitlement.v0';
matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $invalid_projection, 'on' ), 'wrong contract is rejected' );
foreach ( array( 1, 'true', '1', false, null ) as $invalid_admitted ) {
	$invalid_projection              = $valid_projection;
	$invalid_projection['admitted'] = $invalid_admitted;
	matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $invalid_projection, 'on' ), 'non-true admitted value is rejected' );
}
foreach ( array( 'canaryEnabled', 'canaryConsented' ) as $boolean_key ) {
	foreach ( array( 1, 'true', '1', false, null ) as $invalid_boolean ) {
		$invalid_projection                 = $valid_projection;
		$invalid_projection[ $boolean_key ] = $invalid_boolean;
		matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $invalid_projection, 'canary' ), "non-true {$boolean_key} is rejected" );
	}
	$invalid_projection = $valid_projection;
	unset( $invalid_projection[ $boolean_key ] );
	matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $invalid_projection, 'canary' ), "missing {$boolean_key} is rejected" );
}
matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( null, 'on' ), 'non-array projection is rejected' );
matrix_lor_assert( false === mmhq_lor_studio_matrix_projection_allows( $valid_projection, 'invalid' ), 'invalid release mode is rejected' );

$browser_projection = mmhq_lor_studio_matrix_browser_projection();
matrix_lor_assert( array( 'allowed', 'route', 'launchUrl' ) === array_keys( $browser_projection ), 'browser projection contains exactly three ordered keys' );
matrix_lor_assert( false === $browser_projection['allowed'], 'browser projection exposes an exact boolean denial by default' );
matrix_lor_assert( 'lor-studio' === $browser_projection['route'], 'browser projection exposes the exact route' );
matrix_lor_assert( MMHQ_LOR_STUDIO_MATRIX_LAUNCH_URL === $browser_projection['launchUrl'], 'browser projection exposes the exact launch URL' );
matrix_lor_assert( 0 === $GLOBALS['matrix_lor_entitlement_calls'], 'browser projection remains fail-closed without querying entitlement' );

mmhq_lor_studio_matrix_enqueue_projection();
matrix_lor_assert( array() === $GLOBALS['matrix_lor_inline_scripts'], 'projection is not injected before the Matrix handle is enqueued' );
$GLOBALS['matrix_lor_script_enqueued'] = true;
mmhq_lor_studio_matrix_enqueue_projection();
matrix_lor_assert( 1 === count( $GLOBALS['matrix_lor_inline_scripts'] ), 'projection is injected exactly once for an enqueued Matrix handle' );
$expected_inline = 'window.mmedLorStudioMatrixEntry={"allowed":false,"route":"lor-studio","launchUrl":"https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start"};';
matrix_lor_assert(
	array( 'mmed-student-os-js', $expected_inline, 'before' ) === $GLOBALS['matrix_lor_inline_scripts'][0],
	'projection is injected before the exact Matrix handle with only the three-key JSON'
);

$expected_filters = array(
	array( 'mmed_matrix_runtime_pinned_asset', 'mmhq_lor_studio_matrix_runtime_asset', 20, 1 ),
);
$expected_actions = array(
	array( 'wp_enqueue_scripts', 'mmhq_lor_studio_matrix_enqueue_projection', 100, 1 ),
	array( 'rest_api_init', 'mmhq_lor_studio_matrix_unregister_legacy_routes', PHP_INT_MAX, 1 ),
);
matrix_lor_assert( $expected_filters === $GLOBALS['matrix_lor_filters'], 'runtime pin filter registration is exact' );
matrix_lor_assert( $expected_actions === $GLOBALS['matrix_lor_actions'], 'action registrations and priorities are exact' );

matrix_lor_assert(
	MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET === mmhq_lor_studio_matrix_runtime_asset( MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET ),
	'absent successor preserves the current 809093 runtime'
);
$asset_dir = WP_PLUGIN_DIR . '/missionmed-hub/assets';
matrix_lor_assert( mkdir( $asset_dir, 0700, true ), 'isolated asset fixture directory is created' );
$candidate = $asset_dir . '/' . MMHQ_LOR_STUDIO_MATRIX_ASSET;
matrix_lor_assert( false !== file_put_contents( $candidate, 'immutable-successor' ), 'regular successor fixture is created' );
matrix_lor_assert(
	MMHQ_LOR_STUDIO_MATRIX_ASSET === mmhq_lor_studio_matrix_runtime_asset( MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET ),
	'present regular successor overrides the current 809093 runtime'
);
matrix_lor_assert( 'student-os.unrelated000000.js' === mmhq_lor_studio_matrix_runtime_asset( 'student-os.unrelated000000.js' ), 'unrelated runtime selection is preserved' );
matrix_lor_assert( unlink( $candidate ), 'regular successor fixture is removed' );
$symlink_target = $asset_dir . '/successor-target.js';
matrix_lor_assert( false !== file_put_contents( $symlink_target, 'symlink-target' ), 'symlink target fixture is created' );
matrix_lor_assert( symlink( $symlink_target, $candidate ), 'successor symlink fixture is created' );
matrix_lor_assert(
	MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET === mmhq_lor_studio_matrix_runtime_asset( MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET ),
	'symlink successor fails closed to the current 809093 runtime'
);

mmhq_lor_studio_matrix_unregister_legacy_routes();
$expected_routes = array(
	array( 'mmed/v1', '/lor', false ),
	array( 'mmed/v1', '/lor/(?P<id>\d+)', false ),
	array( 'mmed/v1', '/lor/(?P<id>\d+)/status', false ),
);
matrix_lor_assert( $expected_routes === $GLOBALS['matrix_lor_unregistered_routes'], 'exactly the three legacy LOR routes are unregistered in order' );

$source = file_get_contents( dirname( __DIR__ ) . '/wp-content/mu-plugins/missionmed-matrix-lor-studio-entry.php' );
matrix_lor_assert( is_string( $source ), 'controller source is readable for static safety checks' );
foreach (
	array(
		'current_user_can',
		'user_can',
		'manage_options',
		'is_admin',
		'wp_get_current_user',
		'get_user_meta',
		'mmhq_cam_build_entitlement',
		'mmhq_lor_studio_identity_entitlement_for_user',
		'get_option',
		'$_GET',
		'$_POST',
		'$_REQUEST',
		'$_COOKIE',
	) as $forbidden_source
) {
	matrix_lor_assert( false === strpos( $source, $forbidden_source ), "controller excludes forbidden authority source {$forbidden_source}" );
}
matrix_lor_assert( 0 === preg_match( '/\bregister_rest_route\s*\(/', $source ), 'controller registers no REST route' );
matrix_lor_assert( 1 === preg_match_all( '/unregister_rest_route\s*\(/', $source ), 'controller has one bounded REST unregistration call site' );
matrix_lor_assert( 1 === preg_match_all( '/mmhq_lor_studio_current_identity_entitlement\s*\(/', $source ), 'controller invokes only the current-identity entitlement contract once' );
matrix_lor_assert( false === strpos( $source, 'window.MMED_OS.lorStudio' ), 'deprecated nested Matrix projection is absent' );
matrix_lor_assert( 1 === substr_count( $source, 'window.mmedLorStudioMatrixEntry=' ), 'exact Matrix projection global is assigned once' );

fwrite( STDOUT, "PASS: {$checks} Matrix LOR Studio entry contract checks\n" );
