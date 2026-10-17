<?php
/**
 * MissionMed Supabase session bridge auth shim.
 *
 * Scope:
 * - Applies ONLY to POST /wp-json/missionmed/v1/supabase-session
 * - Bypasses REST nonce checks for this route only
 * - Requires a valid WordPress logged-in cookie session
 * - Returns mm_bridge_not_authenticated (401) when no valid user session exists
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_bridge_is_supabase_session_post_request' ) ) {
	/**
	 * Detect the exact bridge route request shape from globals.
	 *
	 * @return bool
	 */
	function mm_bridge_is_supabase_session_post_request() {
		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
			return false;
		}

		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : '';
		if ( 'POST' !== $method ) {
			return false;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( (string) $_SERVER['REQUEST_URI'] ) : '';
		$path        = wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( ! is_string( $path ) || '' === $path ) {
			return false;
		}

		return '/wp-json/missionmed/v1/supabase-session' === rtrim( $path, '/' );
	}
}

if ( ! function_exists( 'mm_bridge_resolve_cookie_user' ) ) {
	/**
	 * Resolve authenticated user from current user or logged_in cookie.
	 *
	 * @return WP_User|null
	 */
	function mm_bridge_resolve_cookie_user() {
		$current = wp_get_current_user();
		if ( $current instanceof WP_User && ! empty( $current->ID ) ) {
			return $current;
		}

		$user_id = wp_validate_auth_cookie( '', 'logged_in' );
		if ( ! $user_id ) {
			return null;
		}

		$user = get_userdata( (int) $user_id );
		if ( ! ( $user instanceof WP_User ) || empty( $user->ID ) ) {
			return null;
		}

		wp_set_current_user( (int) $user->ID );
		return $user;
	}
}

add_filter(
	'rest_cookie_check_errors',
	static function( $result ) {
		if ( ! mm_bridge_is_supabase_session_post_request() ) {
			return $result;
		}

		/*
		 * Bridge route uses first-party logged_in cookie auth; nonce checks are
		 * bypassed for this single endpoint only.
		 */
		return true;
	},
	1
);

add_filter(
	'rest_authentication_errors',
	static function( $result ) {
		if ( ! mm_bridge_is_supabase_session_post_request() ) {
			return $result;
		}

		$user = mm_bridge_resolve_cookie_user();
		if ( $user instanceof WP_User ) {
			return true;
		}

		return new WP_Error(
			'mm_bridge_not_authenticated',
			'User not authenticated',
			array( 'status' => 401 )
		);
	},
	1
);

add_filter(
	'rest_pre_dispatch',
	static function( $response, $server, $request ) {
		if ( ! ( $request instanceof WP_REST_Request ) ) {
			return $response;
		}

		if ( '/missionmed/v1/supabase-session' !== $request->get_route() ) {
			return $response;
		}

		if ( 'POST' !== strtoupper( (string) $request->get_method() ) ) {
			return $response;
		}

		$user = mm_bridge_resolve_cookie_user();
		if ( $user instanceof WP_User ) {
			return $response;
		}

		return new WP_Error(
			'mm_bridge_not_authenticated',
			'User not authenticated',
			array( 'status' => 401 )
		);
	},
	10,
	3
);
