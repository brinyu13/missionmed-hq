<?php
/**
 * Plugin Name: MissionMed Login Flow Restore
 * Description: Enforces post-login redirect_to handling for WordPress and WooCommerce flows with same-domain hardening.
 * Author: MissionMed
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'mm_auth_redirect_fix_resolve_requested_redirect' ) ) {
	/**
	 * Resolve requested redirect target from known login payload keys.
	 *
	 * Supports:
	 * - redirect_to (wp-login style)
	 * - redirect (WooCommerce account form style)
	 */
	function mm_auth_redirect_fix_resolve_requested_redirect() {
		$keys = array( 'redirect_to', 'redirect' );
		foreach ( $keys as $key ) {
			if ( ! isset( $_REQUEST[ $key ] ) ) {
				continue;
			}
			$raw = wp_unslash( $_REQUEST[ $key ] );
			if ( is_string( $raw ) && '' !== trim( $raw ) ) {
				return trim( $raw );
			}
		}
		return '';
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_host_is_allowed' ) ) {
	/**
	 * Allow only same-domain hosts for absolute redirects.
	 *
	 * @param string $host Parsed redirect host.
	 * @return bool
	 */
	function mm_auth_redirect_fix_host_is_allowed( $host ) {
		$host = strtolower( trim( (string) $host ) );
		if ( '' === $host ) {
			return true;
		}

		if ( 'missionmed-hq-production.up.railway.app' === $host ) {
			return true;
		}

		if ( 'missionmedinstitute.com' === $host || 'www.missionmedinstitute.com' === $host ) {
			return true;
		}

		$needle = '.missionmedinstitute.com';
		$host_len = strlen( $host );
		$needle_len = strlen( $needle );
		if ( $host_len > $needle_len && substr( $host, -1 * $needle_len ) === $needle ) {
			return true;
		}

		return false;
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_allowed_redirect_hosts' ) ) {
	/**
	 * Extend core safe-redirect host allowlist with approved HQ domain.
	 *
	 * @param array<int, string> $hosts Allowed hosts.
	 * @return array<int, string>
	 */
	function mm_auth_redirect_fix_allowed_redirect_hosts( $hosts ) {
		$hosts[] = 'missionmed-hq-production.up.railway.app';
		return array_values( array_unique( array_map( 'strtolower', array_filter( (array) $hosts ) ) ) );
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_sanitize_redirect' ) ) {
	/**
	 * Sanitize redirect target and force same-domain fallback.
	 *
	 * @param string $raw_redirect Redirect target.
	 * @return string
	 */
	function mm_auth_redirect_fix_sanitize_redirect( $raw_redirect ) {
		$redirect = trim( (string) $raw_redirect );
		if ( '' === $redirect ) {
			return home_url( '/' );
		}

		if ( 0 === strpos( $redirect, '//' ) ) {
			return home_url( '/' );
		}

		if ( 0 === strpos( $redirect, '/' ) ) {
			return esc_url_raw( home_url( $redirect ) );
		}

		$parsed = wp_parse_url( $redirect );
		if ( ! is_array( $parsed ) ) {
			return home_url( '/' );
		}

		$host = isset( $parsed['host'] ) ? (string) $parsed['host'] : '';
		if ( ! mm_auth_redirect_fix_host_is_allowed( $host ) ) {
			return home_url( '/' );
		}

		$validated = wp_validate_redirect( $redirect, home_url( '/' ) );
		return esc_url_raw( $validated );
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_login_redirect' ) ) {
	/**
	 * WordPress core login redirect filter.
	 *
	 * @param string           $redirect_to Redirect target after prior filters.
	 * @param string           $requested   Requested redirect from core flow.
	 * @param WP_User|WP_Error $user        Authenticated user or WP_Error.
	 * @return string
	 */
	function mm_auth_redirect_fix_login_redirect( $redirect_to, $requested, $user ) {
		if ( ! ( $user instanceof WP_User ) ) {
			return $redirect_to;
		}

		$explicit_redirect = mm_auth_redirect_fix_resolve_requested_redirect();
		if ( '' !== $explicit_redirect ) {
			return mm_auth_redirect_fix_sanitize_redirect( $explicit_redirect );
		}

		if ( is_string( $requested ) && '' !== trim( $requested ) ) {
			return mm_auth_redirect_fix_sanitize_redirect( $requested );
		}

		return $redirect_to;
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_woocommerce_login_redirect' ) ) {
	/**
	 * WooCommerce account-form login redirect filter.
	 *
	 * @param string   $redirect Redirect target selected by WooCommerce.
	 * @param WP_User  $user     Authenticated user.
	 * @return string
	 */
	function mm_auth_redirect_fix_woocommerce_login_redirect( $redirect, $user ) {
		if ( ! ( $user instanceof WP_User ) ) {
			return $redirect;
		}

		$explicit_redirect = mm_auth_redirect_fix_resolve_requested_redirect();
		if ( '' !== $explicit_redirect ) {
			return mm_auth_redirect_fix_sanitize_redirect( $explicit_redirect );
		}

		return mm_auth_redirect_fix_sanitize_redirect( $redirect );
	}
}

if ( ! function_exists( 'mm_auth_redirect_fix_has_redirect_sentinel' ) ) {
	/**
	 * Detect whether a URL (raw or encoded) already carries redirected=1.
	 *
	 * @param string $value Raw URL or query fragment.
	 * @return bool
	 */
	function mm_auth_redirect_fix_has_redirect_sentinel( $value ) {
		if ( ! is_string( $value ) ) {
			return false;
		}

		$raw = trim( $value );
		if ( '' === $raw ) {
			return false;
		}

		if ( false !== strpos( $raw, 'redirected=1' ) ) {
			return true;
		}

		$decoded = rawurldecode( $raw );
		if ( false !== strpos( $decoded, 'redirected=1' ) ) {
			return true;
		}

		$query = wp_parse_url( $raw, PHP_URL_QUERY );
		if ( is_string( $query ) && '' !== $query ) {
			$query_args = array();
			wp_parse_str( $query, $query_args );
			if ( isset( $query_args['redirected'] ) && '1' === (string) $query_args['redirected'] ) {
				return true;
			}
		}

		return false;
	}
}

add_filter( 'login_redirect', 'mm_auth_redirect_fix_login_redirect', PHP_INT_MAX, 3 );
add_filter( 'woocommerce_login_redirect', 'mm_auth_redirect_fix_woocommerce_login_redirect', PHP_INT_MAX, 2 );
add_filter( 'allowed_redirect_hosts', 'mm_auth_redirect_fix_allowed_redirect_hosts', PHP_INT_MAX );

add_action(
	'template_redirect',
	static function () {
		// Only run for logged-in users.
		if ( ! is_user_logged_in() ) {
			return;
		}

		// Only run on the WooCommerce My Account page.
		if ( ! function_exists( 'is_account_page' ) || ! is_account_page() ) {
			return;
		}

		// Must have redirect_to param.
		if ( empty( $_REQUEST['redirect_to'] ) ) {
			return;
		}

		$target = wp_unslash( $_REQUEST['redirect_to'] );
		if ( ! is_string( $target ) || '' === trim( $target ) ) {
			return;
		}
		$target = trim( $target );

		// Prevent infinite loop.
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? (string) $_SERVER['REQUEST_URI'] : '';
		if ( mm_auth_redirect_fix_has_redirect_sentinel( $request_uri ) ) {
			return;
		}

		// AUTH LOOP FIX: also inspect redirect_to target (handles URL-encoded redirected=1).
		if ( mm_auth_redirect_fix_has_redirect_sentinel( $target ) ) {
			return;
		}

		// Allow only safe targets.
		$is_safe_target = false;
		if ( 0 === strpos( $target, '/' ) ) {
			$is_safe_target = true;
		} else {
			$parts = wp_parse_url( $target );
			$host  = ( is_array( $parts ) && isset( $parts['host'] ) ) ? (string) $parts['host'] : '';
			if ( mm_auth_redirect_fix_host_is_allowed( $host ) ) {
				$is_safe_target = true;
			}
		}

		if ( ! $is_safe_target ) {
			return;
		}

		wp_safe_redirect( add_query_arg( 'redirected', '1', $target ) );
		exit;
	},
	PHP_INT_MAX
);
