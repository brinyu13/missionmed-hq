<?php
/**
 * Plugin Name: MissionMed File Vault · Program-Specific PS (Prototype)
 * Description: PSV-PROTOTYPE-0001. Isolated, allowlisted vertical slice of the Program-Specific Personal Statement workflow behind File Vault. Own tables, own REST namespace, own page. Edits no File Vault or RISE file. Disable by deactivating, or define MMED_PS_PROTO_DISABLE.
 * Version: 0.5.6
 * Author: MissionMed
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( defined( 'MMPS_VERSION' ) || class_exists( 'MMPS_Gate', false ) ) {
	return; // A second copy of the prototype must never redeclare anything.
}

define( 'MMPS_VERSION', '0.5.6' );
define( 'MMPS_PATH', plugin_dir_path( __FILE__ ) );
define( 'MMPS_URL', plugin_dir_url( __FILE__ ) );
define( 'MMPS_REST_NS', 'mmed-ps-proto/v1' );
define( 'MMPS_QUERY_VAR', 'mmed_ps_proto' );

/*
 * Blast-radius rule: if any prototype file is missing, corrupted or throws,
 * the prototype goes inert and the rest of the site carries on untouched.
 * (PHP 7+ raises ParseError from require, so even a damaged upload is caught.)
 */
/** On PHP 7 a missing file makes require fatal (not catchable), so readability is checked first. */
function mmps_require( $part ) {
	$file = MMPS_PATH . 'includes/class-mmps-' . $part . '.php';
	if ( ! is_readable( $file ) ) {
		throw new \RuntimeException( 'missing ' . $part );
	}
	require_once $file;
}

try {
	mmps_require( 'gate' );
	mmps_require( 'install' );
} catch ( \Throwable $e ) {
	error_log( 'MMPS prototype inert: ' . get_class( $e ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
	return;
}

register_activation_hook( __FILE__, array( 'MMPS_Install', 'activate' ) );

/*
 * Everything else loads on plugins_loaded, late, and only when the hard kill
 * switch is off. WordPress loads this plugin before missionmed-hub
 * alphabetically, so nothing here may reference File Vault classes at include
 * time. If File Vault is absent the prototype still works with the synthetic
 * or pasted ROOT; it never fatals.
 */
add_action(
	'plugins_loaded',
	function () {
		if ( MMPS_Gate::hard_disabled() ) {
			return;
		}
		try {
			foreach ( array( 'store', 'docx', 'region', 'root-source', 'rise-client', 'evidence-bundle', 'tiers', 'provider', 'generator', 'batch', 'research', 'similarity', 'rest', 'page' ) as $part ) {
				mmps_require( $part );
			}
			MMPS_Rest::init();
			MMPS_Page::init();
		} catch ( \Throwable $e ) {
			error_log( 'MMPS prototype inert: ' . get_class( $e ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
		}
	},
	99
);
