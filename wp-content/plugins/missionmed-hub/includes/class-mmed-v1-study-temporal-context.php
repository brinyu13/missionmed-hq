<?php
/**
 * Server-owned civil-time context for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Server-owned source for one learner's civil-time profile. */
interface MMED_V1_Study_Timezone_Provider {
	/** @return array */
	public function profile( $owner_id );
}

/** Read an explicit learner profile, with the WordPress site zone as fallback. */
final class MMED_V1_Study_Runtime_Timezone_Provider implements MMED_V1_Study_Timezone_Provider {

	const USER_META_KEY = '_mmed_v1_study_timezone';

	/** @return array */
	public function profile( $owner_id ) {
		$owner_id = (int) $owner_id;
		$value = null;
		$source = 'site';
		if ( $owner_id > 0 && function_exists( 'get_user_meta' ) ) {
			$candidate = get_user_meta( $owner_id, self::USER_META_KEY, true );
			if ( is_string( $candidate ) && '' !== trim( $candidate ) ) {
				$value = trim( $candidate );
				$source = 'learner';
			}
		}
		if ( null === $value ) {
			$value = MMED_V1_Study_Temporal_Context::site_timezone();
		}
		$value = MMED_V1_Study_Temporal_Context::normalize_timezone( $value );
		return array(
			'profile_version' => $source . '-tz-v1-' . substr( hash( 'sha256', $value ), 0, 16 ),
			'source'          => $source,
			'timezone'        => $value,
		);
	}
}

/** Build exact Week envelopes from a server-owned learner profile. */
final class MMED_V1_Study_Temporal_Context {

	/** @return array */
	public static function for_week( $week_start, $owner_id = 0, $provider = null ) {
		$profile = self::profile( $owner_id, $provider );
		$tzdb = function_exists( 'timezone_version_get' ) ? (string) timezone_version_get() : '';
		$tzdb_version = '' === $tzdb ? 'system-tzdb' : 'php-tzdb-' . preg_replace( '/[^A-Za-z0-9._:-]/', '-', $tzdb );
		return MMED_V1_Study_Week_Domain::temporal_envelope( $week_start, $profile['timezone'], $profile['profile_version'], $tzdb_version );
	}

	/** @return string */
	public static function current_week_start( $owner_id = 0, $provider = null ) {
		$zone = new DateTimeZone( self::profile( $owner_id, $provider )['timezone'] );
		$today = new DateTimeImmutable( 'now', $zone );
		$offset = (int) $today->format( 'N' ) - 1;
		return $today->modify( '-' . $offset . ' days' )->format( 'Y-m-d' );
	}

	/** @return string */
	public static function today( $owner_id = 0, $provider = null ) {
		return ( new DateTimeImmutable( 'now', new DateTimeZone( self::profile( $owner_id, $provider )['timezone'] ) ) )->format( 'Y-m-d' );
	}

	/** @return string */
	public static function timezone() {
		return self::site_timezone();
	}

	/** @return array */
	public static function profile( $owner_id = 0, $provider = null ) {
		$provider = $provider instanceof MMED_V1_Study_Timezone_Provider
			? $provider
			: new MMED_V1_Study_Runtime_Timezone_Provider();
		$profile = $provider->profile( (int) $owner_id );
		$keys = is_array( $profile ) ? array_keys( $profile ) : array();
		sort( $keys, SORT_STRING );
		if (
			array( 'profile_version', 'source', 'timezone' ) !== $keys
			|| ! is_string( $profile['profile_version'] )
			|| 1 !== preg_match( '/^[A-Za-z0-9._:-]{1,64}$/D', $profile['profile_version'] )
			|| ! in_array( $profile['source'], array( 'learner', 'site' ), true )
		) {
			throw new RuntimeException( 'V1 learner timezone profile is unavailable.' );
		}
		$profile['timezone'] = self::normalize_timezone( $profile['timezone'] );
		return $profile;
	}

	/** @return string */
	public static function site_timezone() {
		$value = function_exists( 'wp_timezone_string' ) ? (string) wp_timezone_string() : '';
		if ( '' === $value && function_exists( 'get_option' ) ) {
			$value = (string) get_option( 'timezone_string', '' );
		}
		if ( '' === $value ) {
			$value = 'UTC';
		}
		return self::normalize_timezone( $value );
	}

	/** @return string */
	public static function normalize_timezone( $value ) {
		if ( ! is_string( $value ) || strlen( $value ) < 1 || strlen( $value ) > 64 ) {
			throw new RuntimeException( 'V1 learner timezone is unavailable.' );
		}
		if ( '+00:00' === $value || '-00:00' === $value ) {
			$value = 'UTC';
		}
		try {
			return MMED_V1_Study_Week_Domain::normalize_timezone( $value );
		} catch ( Throwable $error ) {
			unset( $error );
			throw new RuntimeException( 'V1 learner timezone is unavailable.' );
		}
	}
}
