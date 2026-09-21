<?php
/** Optional Stage B submit-only return transport. It never bypasses quarantine. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

class MMPS_Return {
	const NS = 'mmed-ps-return/v1';

	public static function init() {
		if ( ! self::available() ) { return; }
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'no_store' ), 10, 3 );
	}

	public static function available() {
		if ( ! MMPS_Mission::auto_return_on() || MMPS_Mission::hard_disabled() ) { return false; }
		foreach ( MMPS_Mission::providers() as $provider ) {
			if ( in_array( $provider['autoReturn'], array( 'EXPERIMENTAL', 'VERIFIED' ), true ) && ! empty( $provider['verifiedAt'] ) && ! empty( $provider['reviewBy'] ) ) { return true; }
		}
		return false;
	}

	public static function routes() {
		register_rest_route( self::NS, '/submissions', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'submit' ), 'permission_callback' => '__return_true' ) );
	}

	public static function no_store( $response, $server, $request ) {
		if ( 0 === strpos( (string) $request->get_route(), '/' . self::NS ) && $response instanceof WP_HTTP_Response ) {
			$response->header( 'Cache-Control', 'no-store, private, max-age=0' ); $response->header( 'X-Robots-Tag', 'noindex, nofollow' ); $response->header( 'X-Content-Type-Options', 'nosniff' );
		}
		return $response;
	}

	protected static function refused() { return new WP_Error( 'mmps_return_refused', 'Submission was not accepted.', array( 'status' => 401 ) ); }

	protected static function throttle( $label, $value, $cap ) {
		$key = 'mmps_ret_' . $label . '_' . substr( hash( 'sha256', (string) $value ), 0, 32 );
		$count = absint( get_transient( $key ) ); if ( $count >= $cap ) { return false; }
		set_transient( $key, $count + 1, HOUR_IN_SECONDS ); return true;
	}

	public static function submit( $request ) {
		$length = absint( $request->get_header( 'content-length' ) );
		if ( $length > MMPS_Research::MAX_BYTES ) { return new WP_Error( 'mmps_return_size', 'Submission is too large.', array( 'status' => 413 ) ); }
		$type = strtolower( trim( (string) $request->get_header( 'content-type' ) ) );
		if ( 0 !== strpos( $type, 'text/markdown' ) && 0 !== strpos( $type, 'text/plain' ) ) { return self::refused(); }
		$auth = trim( (string) $request->get_header( 'authorization' ) );
		$capability = 0 === stripos( $auth, 'Bearer ' ) ? trim( substr( $auth, 7 ) ) : '';
		if ( ! preg_match( '/^MMRR1\.([A-Z2-7]{26})\.[A-Za-z0-9_-]{43}$/', $capability, $match ) ) { return self::refused(); }
		$ip = (string) ( $_SERVER['REMOTE_ADDR'] ?? 'unknown' );
		if ( ! self::throttle( 'ip', $ip, 60 ) || ! self::throttle( 'mid', $match[1], 10 ) ) { return self::refused(); }
		$mission = MMPS_Mission::verify_return_capability( $capability );
		if ( ! $mission || ! MMPS_Mission::consume_return( $mission ) ) { return self::refused(); }
		$bytes = (string) $request->get_body();
		if ( strlen( $bytes ) < MMPS_Research::MIN_BYTES || strlen( $bytes ) > MMPS_Research::MAX_BYTES ) { return new WP_Error( 'mmps_return_size', 'Submission size is invalid.', array( 'status' => 413 ) ); }
		$item = MMPS_Research::ingest_v2( absint( $mission['user_id'] ), $mission, $bytes, 'AUTO_RETURN', 'automatic-return.md' );
		if ( is_wp_error( $item ) ) { return $item; }
		$response = new WP_REST_Response( array( 'received' => true, 'status' => 'CHECKING' ), 202 );
		return $response;
	}
}
