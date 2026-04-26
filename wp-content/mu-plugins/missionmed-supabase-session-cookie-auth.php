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

if ( ! function_exists( 'mm_bridge_block_legacy_arena_auth_ajax' ) ) {
	/**
	 * Hard-disable legacy AJAX auth fallback used by older Arena clients.
	 *
	 * A legacy bypass can be re-enabled only with an explicit environment flag:
	 * MM_ENABLE_LEGACY_ARENA_AUTH_AJAX=true (default: disabled).
	 *
	 * @return void
	 */
	function mm_bridge_block_legacy_arena_auth_ajax() {
		$allow_legacy_ajax = defined( 'MM_ENABLE_LEGACY_ARENA_AUTH_AJAX' ) && true === MM_ENABLE_LEGACY_ARENA_AUTH_AJAX;
		if ( $allow_legacy_ajax ) {
			return;
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error(
				array(
					'code'    => 'mm_arena_auth_not_authenticated',
					'message' => 'User not authenticated',
				),
				401
			);
		}

		wp_send_json_error(
			array(
				'code'    => 'mm_arena_auth_deprecated',
				'message' => 'Legacy AJAX auth endpoint disabled. Use /wp-json/wp/v2/users/me.',
			),
			401
		);
	}
}

add_action( 'wp_ajax_nopriv_mm_arena_check_auth', 'mm_bridge_block_legacy_arena_auth_ajax', 0 );
add_action( 'wp_ajax_mm_arena_check_auth', 'mm_bridge_block_legacy_arena_auth_ajax', 0 );

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
