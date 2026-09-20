<?php
/**
 * CURRENT TRANSPORT for the ProgramEvidenceBundle v1 contract (replaceable).
 *
 * Server-side GETs to the isolated RISE origin carrying ONLY the signed-in
 * user's own RISE audience session, exactly as the RISE proxy mu-plugin does.
 * No WordPress cookie is forwarded, no machine credential exists, nothing is
 * ever written to RISE, and no statement text is ever sent to RISE.
 *
 * When RISE ships a native `/me/ps-evidence` route (PSV-0002 PKT-3), replace
 * this class and keep MMPS_Evidence_Bundle's output contract unchanged.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Rise_Client {

	const TRANSPORT = 'FILE_VAULT_SESSION_FORWARDED_GET_V1';

	public static function origin() {
		if ( MMPS_Gate::testing() && defined( 'MMED_PS_PROTO_TEST_RISE_ORIGIN' ) ) {
			return rtrim( (string) MMED_PS_PROTO_TEST_RISE_ORIGIN, '/' );
		}
		if ( ! defined( 'MMED_RISE_ORIGIN' ) ) {
			return '';
		}
		$parts = wp_parse_url( trim( (string) MMED_RISE_ORIGIN ) );
		if ( ! is_array( $parts ) || 'https' !== ( $parts['scheme'] ?? '' ) || empty( $parts['host'] ) ) {
			return '';
		}
		if ( ! empty( $parts['user'] ) || ! empty( $parts['pass'] ) || ! empty( $parts['query'] ) || ! empty( $parts['fragment'] ) || '' !== rtrim( (string) ( $parts['path'] ?? '' ), '/' ) ) {
			return '';
		}
		return 'https://' . strtolower( (string) $parts['host'] ) . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' );
	}

	public static function session_present() {
		return ! empty( $_COOKIE['mmhq_rise_session'] );
	}

	public static function status() {
		return array(
			'configured'     => '' !== self::origin(),
			'sessionPresent' => self::session_present(),
			'openRiseUrl'    => home_url( '/rise/' ),
			'transport'      => self::TRANSPORT,
		);
	}

	/**
	 * @param string $path  Absolute API path beginning with /api/rise/v1/.
	 * @param array  $query Query arguments.
	 * @return array|WP_Error Decoded JSON.
	 */
	public static function get( $path, $query = array() ) {
		if ( 0 !== strpos( $path, '/api/rise/v1/' ) ) {
			return new WP_Error( 'mmps_rise_path', 'Refused: not a RISE API path.', array( 'status' => 500 ) );
		}
		$origin = self::origin();
		if ( '' === $origin ) {
			return new WP_Error( 'mmps_rise_unconfigured', 'RISE is not configured on this site.', array( 'status' => 503 ) );
		}
		if ( ! self::session_present() ) {
			return new WP_Error( 'mmps_rise_session_required', 'Open RISE once in this browser so your RISE session exists, then try again.', array( 'status' => 409 ) );
		}
		$url = $origin . $path . ( $query ? '?' . http_build_query( $query, '', '&', PHP_QUERY_RFC3986 ) : '' );
		$response = wp_remote_request(
			$url,
			array(
				'method'              => 'GET',
				'timeout'             => 6,    // A slow RISE must never hold a PHP worker.
				'redirection'         => 0,
				'sslverify'           => true,
				'limit_response_size' => 4 * 1024 * 1024,
				'headers'             => array(
					'Accept'            => 'application/json',
					'Cookie'            => 'mmhq_session=' . rawurlencode( (string) wp_unslash( $_COOKIE['mmhq_rise_session'] ) ),
					'X-Forwarded-Host'  => (string) wp_parse_url( home_url( '/' ), PHP_URL_HOST ),
					'X-Forwarded-Proto' => 'https',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'mmps_rise_upstream', 'RISE did not answer. Try again in a moment.', array( 'status' => 502 ) );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 401 === $code || 403 === $code ) {
			return new WP_Error( 'mmps_rise_session_required', 'Your RISE session has ended. Open RISE once in this browser, then try again.', array( 'status' => 409 ) );
		}
		if ( 404 === $code ) {
			return new WP_Error( 'mmps_rise_not_found', 'RISE does not know that program.', array( 'status' => 404 ) );
		}
		if ( 200 !== $code ) {
			return new WP_Error( 'mmps_rise_upstream', 'RISE answered with an error (' . $code . ').', array( 'status' => 502 ) );
		}
		$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		return is_array( $data ) ? $data : new WP_Error( 'mmps_rise_upstream', 'RISE answered with something unreadable.', array( 'status' => 502 ) );
	}
}
