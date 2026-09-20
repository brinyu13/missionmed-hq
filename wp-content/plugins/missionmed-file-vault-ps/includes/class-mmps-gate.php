<?php
/**
 * Access gate. Fail closed: anything unexpected means "not allowed".
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Gate {

	const OPTION_MODE         = 'mmed_ps_proto_mode';            // off | allowlist
	const OPTION_ALLOW_USERS  = 'mmed_ps_proto_allow_user_ids';  // int[]
	const OPTION_ALLOW_ADMINS = 'mmed_ps_proto_allow_admins';    // '1' | '0'

	/** Hard kill switch: wp-config constant. Nothing of the prototype loads. */
	public static function hard_disabled() {
		return defined( 'MMED_PS_PROTO_DISABLE' ) && MMED_PS_PROTO_DISABLE;
	}

	public static function mode() {
		$mode = get_option( self::OPTION_MODE, 'off' );
		return 'allowlist' === $mode ? 'allowlist' : 'off';
	}

	/** Explicit user ids from the wp-config constant and the option, merged. */
	public static function allowed_user_ids() {
		$ids = array();
		if ( defined( 'MMED_PS_PROTO_ALLOW_USER_IDS' ) ) {
			$ids = array_merge( $ids, preg_split( '/[\s,]+/', (string) MMED_PS_PROTO_ALLOW_USER_IDS ) );
		}
		$ids = array_merge( $ids, (array) get_option( self::OPTION_ALLOW_USERS, array() ) );
		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
	}

	public static function user_allowed( $user_id = 0 ) {
		if ( self::hard_disabled() ) {
			return false;
		}
		// Cheapest first: anonymous visitors cost no database read at all.
		$user_id = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( ! $user_id || 'allowlist' !== self::mode() ) {
			return false;
		}
		if ( in_array( $user_id, self::allowed_user_ids(), true ) ) {
			return true;
		}
		return '1' === (string) get_option( self::OPTION_ALLOW_ADMINS, '1' ) && user_can( $user_id, 'manage_options' );
	}

	/**
	 * REST permission callback. Answers 404, not 403, so the feature is not
	 * disclosed to anyone outside the allowlist.
	 */
	public static function rest_permission( $request ) {
		if ( ! is_user_logged_in() || ! self::user_allowed() ) {
			return new WP_Error( 'rest_no_route', 'No route was found matching the URL and request method.', array( 'status' => 404 ) );
		}
		if ( 'GET' !== $request->get_method() && ! self::same_origin() ) {
			return new WP_Error( 'mmps_bad_origin', 'Cross-origin request refused.', array( 'status' => 403 ) );
		}
		return true;
	}

	protected static function same_origin() {
		$site = wp_parse_url( home_url( '/' ), PHP_URL_HOST );
		foreach ( array( 'HTTP_ORIGIN', 'HTTP_REFERER' ) as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$host = wp_parse_url( (string) wp_unslash( $_SERVER[ $key ] ), PHP_URL_HOST );
				return $host && strtolower( $host ) === strtolower( (string) $site );
			}
		}
		return false;
	}

	public static function testing() {
		return defined( 'MMED_PS_PROTO_TESTING' ) && MMED_PS_PROTO_TESTING;
	}
}
