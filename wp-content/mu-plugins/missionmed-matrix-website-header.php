<?php
/**
 * Plugin Name: MissionMed Matrix Website Header Exclusion
 * Description: Excludes the public website header from authenticated Matrix.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Match only the current authenticated principal on the canonical Matrix page. */
function missionmed_matrix_website_header_excluded() {
	if ( is_admin() || wp_doing_ajax() || ! is_page( 4243 ) ) {
		return false;
	}

	$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) : false;
	if ( '/member-dashboard' !== $path && '/member-dashboard/' !== $path ) {
		return false;
	}

	if ( ! defined( 'LOGGED_IN_COOKIE' ) || empty( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
		return false;
	}

	$cookie_user = wp_validate_auth_cookie( $_COOKIE[ LOGGED_IN_COOKIE ], 'logged_in' );
	return $cookie_user && (int) $cookie_user === (int) get_current_user_id();
}

add_filter(
	'wpcode_snippet_output',
	static function ( $output, $snippet ) {
		if ( ! is_object( $snippet ) || ! method_exists( $snippet, 'get_id' ) || 6023 !== (int) $snippet->get_id() ) {
			return $output;
		}

		return missionmed_matrix_website_header_excluded() ? '' : $output;
	},
	10,
	2
);

add_filter(
	'astra_header_display',
	static function ( $display ) {
		return missionmed_matrix_website_header_excluded() ? 'disabled' : $display;
	},
	10,
	1
);
