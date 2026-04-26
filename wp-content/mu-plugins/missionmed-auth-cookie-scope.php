<?php
/**
 * Plugin Name: MissionMed Auth Cookie Scope
 * Description: Enforces MissionMed auth cookie scope and SameSite policy for Safari-compatible /api/auth exchange.
 * Author: MissionMed
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_auth_cookie_scope_target_domain' ) ) {
	/**
	 * Return the canonical cookie domain for MissionMed auth cookies.
	 *
	 * @return string
	 */
	function mm_auth_cookie_scope_target_domain() {
		return '.missionmedinstitute.com';
	}
}

if ( ! function_exists( 'mm_auth_cookie_scope_site_matches' ) ) {
	/**
	 * Restrict header rewriting to MissionMed domains only.
	 *
	 * @return bool
	 */
	function mm_auth_cookie_scope_site_matches() {
		$host = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		$host = strtolower( trim( is_string( $host ) ? $host : '' ) );
		if ( '' === $host ) {
			return false;
		}

		if ( 'missionmedinstitute.com' === $host || 'www.missionmedinstitute.com' === $host ) {
			return true;
		}

		$suffix = '.missionmedinstitute.com';
		return strlen( $host ) > strlen( $suffix ) && substr( $host, -strlen( $suffix ) ) === $suffix;
	}
}

if ( ! function_exists( 'mm_auth_cookie_scope_is_target_cookie' ) ) {
	/**
	 * Determine whether this cookie is a WordPress auth/session cookie.
	 *
	 * @param string $cookie_name Cookie name.
	 * @return bool
	 */
	function mm_auth_cookie_scope_is_target_cookie( $cookie_name ) {
		$name = strtolower( trim( (string) $cookie_name ) );
		if ( '' === $name ) {
			return false;
		}

		return 0 === strpos( $name, 'wordpress_logged_in_' )
			|| 0 === strpos( $name, 'wordpress_sec_' )
			|| 0 === strpos( $name, 'wordpress_' );
	}
}

if ( ! function_exists( 'mm_auth_cookie_scope_rewrite_cookie_line' ) ) {
	/**
	 * Rewrite cookie attributes for MissionMed WordPress auth cookies.
	 *
	 * @param string $cookie_line Cookie line without "Set-Cookie:" prefix.
	 * @return string
	 */
	function mm_auth_cookie_scope_rewrite_cookie_line( $cookie_line ) {
		$raw = trim( (string) $cookie_line );
		if ( '' === $raw ) {
			return $raw;
		}

		$segments = array_values( array_filter( array_map( 'trim', explode( ';', $raw ) ), 'strlen' ) );
		if ( empty( $segments ) ) {
			return $raw;
		}

		$cookie_pair = array_shift( $segments );
		$equals_pos  = strpos( $cookie_pair, '=' );
		if ( false === $equals_pos ) {
			return $raw;
		}

		$cookie_name = substr( $cookie_pair, 0, $equals_pos );
		if ( ! mm_auth_cookie_scope_is_target_cookie( $cookie_name ) ) {
			return $raw;
		}

		$attributes = array();
		foreach ( $segments as $segment ) {
			$segment_lc = strtolower( trim( $segment ) );
			if ( '' === $segment_lc ) {
				continue;
			}

			if (
				0 === strpos( $segment_lc, 'domain=' ) ||
				0 === strpos( $segment_lc, 'path=' ) ||
				0 === strpos( $segment_lc, 'samesite=' ) ||
				'secure' === $segment_lc
			) {
				continue;
			}

			$attributes[] = $segment;
		}

		$attributes[] = 'Domain=' . mm_auth_cookie_scope_target_domain();
		$attributes[] = 'Path=/';
		$attributes[] = 'Secure';
		$attributes[] = 'SameSite=None';

		return $cookie_pair . '; ' . implode( '; ', $attributes );
	}
}

if ( ! function_exists( 'mm_auth_cookie_scope_rewrite_set_cookie_headers' ) ) {
	/**
	 * Rewrite outbound Set-Cookie headers for WordPress auth cookies.
	 *
	 * @return void
	 */
	function mm_auth_cookie_scope_rewrite_set_cookie_headers() {
		static $running = false;
		if ( $running || ! mm_auth_cookie_scope_site_matches() ) {
			return;
		}
		$running = true;

		$headers = headers_list();
		if ( empty( $headers ) || ! is_array( $headers ) ) {
			$running = false;
			return;
		}

		$cookies = array();
		foreach ( $headers as $header_line ) {
			if ( 0 !== stripos( (string) $header_line, 'Set-Cookie:' ) ) {
				continue;
			}
			$cookies[] = trim( substr( (string) $header_line, strlen( 'Set-Cookie:' ) ) );
		}

		if ( empty( $cookies ) ) {
			$running = false;
			return;
		}

		header_remove( 'Set-Cookie' );
		foreach ( $cookies as $cookie_line ) {
			$rewritten = mm_auth_cookie_scope_rewrite_cookie_line( $cookie_line );
			header( 'Set-Cookie: ' . $rewritten, false );
		}

		$running = false;
	}
}

if ( ! function_exists( 'mm_auth_cookie_scope_register_header_callback' ) ) {
	/**
	 * Register one global header callback for cookie rewriting.
	 *
	 * @return void
	 */
	function mm_auth_cookie_scope_register_header_callback() {
		static $registered = false;
		if ( $registered || ! function_exists( 'header_register_callback' ) ) {
			return;
		}

		header_register_callback( 'mm_auth_cookie_scope_rewrite_set_cookie_headers' );
		$registered = true;
	}
}

mm_auth_cookie_scope_register_header_callback();

