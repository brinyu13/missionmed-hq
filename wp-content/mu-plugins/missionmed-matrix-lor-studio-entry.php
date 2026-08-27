<?php
/**
 * Govern the LOR Studio entry point inside the Matrix student runtime.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MMHQ_LOR_STUDIO_MATRIX_ROUTE          = 'lor-studio';
const MMHQ_LOR_STUDIO_MATRIX_LAUNCH_URL     = 'https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start';
const MMHQ_LOR_STUDIO_MATRIX_ASSET          = 'student-os.56c7c339ee12cdd0.js';
const MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET = 'student-os.809093d2b5b2bc05.js';

/**
 * Normalize a configured Matrix release mode.
 *
 * @param mixed $value Candidate mode.
 * @return string
 */
function mmhq_lor_studio_matrix_normalize_mode( $value ) {
	return is_string( $value ) && in_array( $value, array( 'off', 'canary', 'on' ), true ) ? $value : 'off';
}

/**
 * Return the server-configured Matrix release mode.
 *
 * @return string
 */
function mmhq_lor_studio_matrix_mode() {
	$value = defined( 'MMHQ_LOR_STUDIO_MATRIX_MODE' ) ? constant( 'MMHQ_LOR_STUDIO_MATRIX_MODE' ) : 'off';

	return mmhq_lor_studio_matrix_normalize_mode( $value );
}

/**
 * Decide whether a WordPress entitlement projection permits Matrix entry.
 *
 * @param mixed  $projection WordPress entitlement projection.
 * @param string $mode       Matrix release mode.
 * @return bool
 */
function mmhq_lor_studio_matrix_projection_allows( $projection, $mode ) {
	$mode = mmhq_lor_studio_matrix_normalize_mode( $mode );

	if ( 'off' === $mode || ! is_array( $projection ) ) {
		return false;
	}

	if ( 'missionmed.lor.wordpress-entitlement.v1' !== ( $projection['contract'] ?? null ) ) {
		return false;
	}

	if ( true !== ( $projection['admitted'] ?? null ) ) {
		return false;
	}

	if ( 'canary' === $mode ) {
		return true === ( $projection['canaryEnabled'] ?? null )
			&& true === ( $projection['canaryConsented'] ?? null );
	}

	return 'on' === $mode;
}

/**
 * Resolve the current identity exclusively through the WordPress LOR contract.
 *
 * @return bool
 */
function mmhq_lor_studio_matrix_current_user_allowed() {
	$mode = mmhq_lor_studio_matrix_mode();

	if ( 'off' === $mode || ! function_exists( 'mmhq_lor_studio_current_identity_entitlement' ) ) {
		return false;
	}

	try {
		$projection = mmhq_lor_studio_current_identity_entitlement();
	} catch ( Throwable $error ) {
		return false;
	}

	return mmhq_lor_studio_matrix_projection_allows( $projection, $mode );
}

/**
 * Build the complete browser-safe Matrix projection.
 *
 * @return array<string, bool|string>
 */
function mmhq_lor_studio_matrix_browser_projection() {
	return array(
		'allowed'   => mmhq_lor_studio_matrix_current_user_allowed(),
		'route'     => MMHQ_LOR_STUDIO_MATRIX_ROUTE,
		'launchUrl' => MMHQ_LOR_STUDIO_MATRIX_LAUNCH_URL,
	);
}

/**
 * Inject the LOR Studio projection before the Matrix student runtime executes.
 *
 * @return void
 */
function mmhq_lor_studio_matrix_enqueue_projection() {
	if ( ! function_exists( 'wp_script_is' ) || ! wp_script_is( 'mmed-student-os-js', 'enqueued' ) ) {
		return;
	}

	$encoded = wp_json_encode( mmhq_lor_studio_matrix_browser_projection(), JSON_UNESCAPED_SLASHES );
	if ( ! is_string( $encoded ) ) {
		return;
	}

	wp_add_inline_script(
		'mmed-student-os-js',
		'window.mmedLorStudioMatrixEntry=' . $encoded . ';',
		'before'
	);
}

/**
 * Select the LOR-aware immutable Matrix runtime only when it is present.
 *
 * @param mixed $current_asset Asset selected by the current runtime pin.
 * @return mixed
 */
function mmhq_lor_studio_matrix_runtime_asset( $current_asset ) {
	if ( MMHQ_LOR_STUDIO_MATRIX_FALLBACK_ASSET !== $current_asset ) {
		return $current_asset;
	}

	if ( defined( 'WP_PLUGIN_DIR' ) ) {
		$plugin_dir = WP_PLUGIN_DIR;
	} elseif ( defined( 'WP_CONTENT_DIR' ) ) {
		$plugin_dir = WP_CONTENT_DIR . '/plugins';
	} else {
		return $current_asset;
	}

	$candidate = $plugin_dir . '/missionmed-hub/assets/' . MMHQ_LOR_STUDIO_MATRIX_ASSET;

	return is_file( $candidate ) && ! is_link( $candidate ) ? MMHQ_LOR_STUDIO_MATRIX_ASSET : $current_asset;
}

/**
 * Remove the three superseded legacy LOR REST surfaces.
 *
 * @return void
 */
function mmhq_lor_studio_matrix_unregister_legacy_routes() {
	if ( ! function_exists( 'unregister_rest_route' ) ) {
		return;
	}

	foreach (
		array(
			'/lor',
			'/lor/(?P<id>\d+)',
			'/lor/(?P<id>\d+)/status',
		) as $route
	) {
		unregister_rest_route( 'mmed/v1', $route );
	}
}

add_filter( 'mmed_matrix_runtime_pinned_asset', 'mmhq_lor_studio_matrix_runtime_asset', 20, 1 );
add_action( 'wp_enqueue_scripts', 'mmhq_lor_studio_matrix_enqueue_projection', 100 );
add_action( 'rest_api_init', 'mmhq_lor_studio_matrix_unregister_legacy_routes', PHP_INT_MAX );
