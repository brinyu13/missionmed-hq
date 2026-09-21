<?php
/**
 * Access gate. Fail closed: anything unexpected means "not allowed".
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Gate {

	const OPTION_MODE         = 'mmed_ps_proto_mode';            // off | allowlist | members
	const OPTION_ALLOW_USERS  = 'mmed_ps_proto_allow_user_ids';  // int[]
	const OPTION_ALLOW_ADMINS = 'mmed_ps_proto_allow_admins';    // '1' | '0'

	/** Hard kill switch: wp-config constant. Nothing of PSV loads. */
	public static function hard_disabled() {
		return defined( 'MMED_PS_PROTO_DISABLE' ) && MMED_PS_PROTO_DISABLE;
	}

	public static function mode() {
		$mode = get_option( self::OPTION_MODE, 'off' );
		return in_array( $mode, array( 'allowlist', 'members' ), true ) ? $mode : 'off';
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
		$mode = self::mode();
		if ( ! $user_id || 'off' === $mode ) {
			return false;
		}
		if ( 'members' === $mode ) {
			return user_can( $user_id, 'manage_options' ) || self::current_360_member( $user_id );
		}
		return in_array( $user_id, self::allowed_user_ids(), true )
			|| ( '1' === (string) get_option( self::OPTION_ALLOW_ADMINS, '1' ) && user_can( $user_id, 'manage_options' ) );
	}

	/**
	 * Validate the canonical WordPress-owned MissionMed 360 entitlement claim.
	 * Roles, browser state and unverified membership labels never grant access.
	 */
	protected static function current_360_member( $user_id ) {
		if ( ! function_exists( 'mmhq_cam_build_entitlement' ) ) {
			return false;
		}

		try {
			$claim = mmhq_cam_build_entitlement( absint( $user_id ) );
		} catch ( \Throwable $e ) {
			return false;
		}
		if ( ! is_array( $claim ) ) {
			return false;
		}

		$expires_raw   = isset( $claim['expires_at'] ) ? trim( (string) $claim['expires_at'] ) : '';
		$expires_at    = '' === $expires_raw ? false : strtotime( $expires_raw );
		if ( '' !== $expires_raw && false === $expires_at ) {
			return false;
		}
		$authority_mode = sanitize_key( (string) ( $claim['authority_mode'] ?? '' ) );
		$verified_authority = (
			true === ( $claim['purchase_verified'] ?? false )
			&& true === ( $claim['purchase_match_found'] ?? false )
			&& true === ( $claim['enrollment_verified'] ?? false )
			&& 'learndash_and_woocommerce' === $authority_mode
		) || (
			false === ( $claim['purchase_verified'] ?? false )
			&& false === ( $claim['purchase_match_found'] ?? false )
			&& true === ( $claim['enrollment_verified'] ?? false )
			&& 'learndash_current_access' === $authority_mode
		);

		return true === ( $claim['active'] ?? false )
			&& 'active' === ( $claim['status'] ?? '' )
			&& true === ( $claim['verified'] ?? false )
			&& true === ( $claim['trusted'] ?? false )
			&& true === ( $claim['current_access_verified'] ?? false )
			&& true === ( $claim['revocation_checked'] ?? false )
			&& $verified_authority
			&& empty( $claim['restricted'] )
			&& empty( $claim['revoked'] )
			&& ( false === $expires_at || $expires_at > time() );
	}

	/**
	 * REST permission callback. Answers 404, not 403, so the feature is not
	 * disclosed to anyone outside authorized access.
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
