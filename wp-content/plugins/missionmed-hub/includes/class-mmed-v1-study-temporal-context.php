<?php
/**
 * Server-owned civil-time context for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Build exact Week envelopes from the WordPress site timezone. */
final class MMED_V1_Study_Temporal_Context {

	/** @return array */
	public static function for_week( $week_start ) {
		$timezone = self::timezone();
		$profile_version = 'site-tz-' . substr( hash( 'sha256', $timezone ), 0, 16 );
		$tzdb = function_exists( 'timezone_version_get' ) ? (string) timezone_version_get() : '';
		$tzdb_version = '' === $tzdb ? 'system-tzdb' : 'php-tzdb-' . preg_replace( '/[^A-Za-z0-9._:-]/', '-', $tzdb );
		return MMED_V1_Study_Week_Domain::temporal_envelope( $week_start, $timezone, $profile_version, $tzdb_version );
	}

	/** @return string */
	public static function current_week_start() {
		$zone = new DateTimeZone( self::timezone() );
		$today = new DateTimeImmutable( 'now', $zone );
		$offset = (int) $today->format( 'N' ) - 1;
		return $today->modify( '-' . $offset . ' days' )->format( 'Y-m-d' );
	}

	/** @return string */
	public static function today() {
		return ( new DateTimeImmutable( 'now', new DateTimeZone( self::timezone() ) ) )->format( 'Y-m-d' );
	}

	/** @return string */
	public static function timezone() {
		$value = function_exists( 'wp_timezone_string' ) ? (string) wp_timezone_string() : '';
		if ( '' === $value && function_exists( 'get_option' ) ) {
			$value = (string) get_option( 'timezone_string', '' );
		}
		if ( '' === $value ) {
			$value = 'UTC';
		}
		try {
			$zone = new DateTimeZone( $value );
		} catch ( Throwable $error ) {
			unset( $error );
			throw new RuntimeException( 'V1 learner timezone is unavailable.' );
		}
		if ( $zone->getName() !== $value && 'UTC' !== $value ) {
			throw new RuntimeException( 'V1 learner timezone is unavailable.' );
		}
		return $value;
	}
}
