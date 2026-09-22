<?php
/**
 * Plugin Name: MissionMed File Vault · Program-Specific PS
 * Description: Program-specific Personal Statement writing for administrators and current MissionMed 360 members. Uses verified RISE evidence while preserving ROOT integrity and student isolation.
 * Version: 1.4.3
 * Author: MissionMed
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( defined( 'MMED_PSV_VERSION' ) || class_exists( 'MMPS_Gate', false ) ) {
	return; // A second copy must never redeclare anything.
}

define( 'MMED_PSV_VERSION', '1.4.3' );
define( 'MMPS_PATH', plugin_dir_path( __FILE__ ) );
define( 'MMPS_URL', plugin_dir_url( __FILE__ ) );
define( 'MMPS_REST_NS', 'mmed-ps-proto/v1' );
define( 'MMPS_QUERY_VAR', 'mmed_ps_proto' );

/*
 * Blast-radius rule: if any product file is missing, corrupted or throws,
 * PSV goes inert and the rest of the site carries on untouched.
 * (PHP 7+ raises ParseError from require, so even a damaged upload is caught.)
 */
/** On PHP 7 a missing file makes require fatal (not catchable), so readability is checked first. */
if ( ! function_exists( 'mmps_require' ) ) {
function mmps_require( $part ) {
	$file = MMPS_PATH . 'includes/class-mmps-' . $part . '.php';
	if ( ! is_readable( $file ) ) {
		throw new \RuntimeException( 'missing ' . $part );
	}
	require_once $file;
}
}

try {
	mmps_require( 'gate' );
	mmps_require( 'install' );
} catch ( \Throwable $e ) {
	error_log( 'MMPS inert: ' . get_class( $e ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
	return;
}

register_activation_hook( __FILE__, array( 'MMPS_Install', 'activate' ) );

/*
 * Everything else loads on plugins_loaded, late, and only when the hard kill
 * switch is off. WordPress loads this plugin before missionmed-hub
 * alphabetically, so nothing here may reference File Vault classes at include
	 * time. If File Vault is absent, direct upload or pasted ROOT intake remains
	 * available; it never fatals.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( MMPS_Gate::hard_disabled() ) {
			return;
		}
		try {
			foreach ( array( 'store', 'docx', 'region', 'root-source', 'rise-client', 'evidence-bundle', 'tiers', 'provider', 'prompts', 'generator', 'batch', 'research', 'mission', 'return', 'similarity', 'edit', 'rest', 'page' ) as $part ) {
				mmps_require( $part );
			}
			MMPS_Rest::init();
			MMPS_Return::init();
			MMPS_Page::init();
		} catch ( \Throwable $e ) {
			error_log( 'MMPS inert: ' . get_class( $e ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
		}
	},
	99
);
