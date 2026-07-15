<?php
/**
 * Immutable 8010C release descriptors and read-only control provenance.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Source-owned identifiers for the default-hidden V1 integration seam. */
final class MMED_V1_Study_Release {

	const RELEASE_ID       = 'V1-STUDY-SCHEDULE-8010C';
	const CONTRACT_VERSION = 1;
	const CONTROL_VERSION  = 1;

	const REST_NAMESPACE = 'missionmed-study-schedule/v1';
	const BOOTSTRAP_ROUTE = '/bootstrap';

	const STORE_OPTION   = 'mmed_v1_study_store_provenance_v1';
	const RELEASE_OPTION = 'mmed_v1_study_release_provenance_v1';

	const LOADER_ASSET  = 'v1-study-loader.3306a14e53f00510.js';
	const LOADER_SHA256 = '3306a14e53f0051051511ccf31e638e5411f43dd7574fcdccb007a76c163aa37';
	const STYLE_ASSET   = 'v1-study-loader.8f5fec1fc495e441.css';
	const STYLE_SHA256  = '8f5fec1fc495e441bdd29b0a3cee675b7396e83463acd0c67f0c8970e92f266b';
	const MANIFEST_ASSET = 'v1-study-release.c711b79e783160d9.json';
	const RELEASE_SHA256 = 'c711b79e783160d9f2cbbbcc4682c289958b1f5a80df1b5a881e2d8e882511bc';

	/**
	 * Canonical, independently hashable release manifest payload.
	 *
	 * The checked-in JSON asset is exactly this object encoded without escaped
	 * slashes and followed by one newline. It intentionally excludes its own
	 * filename and digest so the fingerprint is reproducible and non-circular.
	 *
	 * @return array
	 */
	public static function manifest_descriptor() {
		return array(
			'bootstrap_route'  => self::BOOTSTRAP_ROUTE,
			'contract_version' => self::CONTRACT_VERSION,
			'control_version'  => self::CONTROL_VERSION,
			'javascript'       => array(
				'asset'  => self::LOADER_ASSET,
				'sha256' => self::LOADER_SHA256,
			),
			'release_id'       => self::RELEASE_ID,
			'release_option'   => self::RELEASE_OPTION,
			'rest_namespace'   => self::REST_NAMESPACE,
			'store_option'     => self::STORE_OPTION,
			'stylesheet'       => array(
				'asset'  => self::STYLE_ASSET,
				'sha256' => self::STYLE_SHA256,
			),
		);
	}

	/** @return array */
	public static function loader_descriptor() {
		return array(
			'release_id'     => self::RELEASE_ID,
			'release_sha256' => self::RELEASE_SHA256,
			'manifest'       => array(
				'asset'  => self::MANIFEST_ASSET,
				'sha256' => self::RELEASE_SHA256,
			),
			'javascript'     => array(
				'asset'  => self::LOADER_ASSET,
				'sha256' => self::LOADER_SHA256,
			),
			'stylesheet'     => array(
				'asset'  => self::STYLE_ASSET,
				'sha256' => self::STYLE_SHA256,
			),
		);
	}
}

/** Validate the two versioned release records without writing WordPress. */
final class MMED_V1_Study_Control {

	/** @return array */
	public static function read() {
		if ( ! function_exists( 'get_option' ) ) {
			return self::unresolved( 'control_source_unavailable' );
		}
		return self::from_records(
			get_option( MMED_V1_Study_Release::STORE_OPTION, null ),
			get_option( MMED_V1_Study_Release::RELEASE_OPTION, null )
		);
	}

	/**
	 * @param mixed $store_record Store provenance candidate.
	 * @param mixed $release_record Release provenance candidate.
	 * @return array
	 */
	public static function from_records( $store_record, $release_record ) {
		$store = self::validate_store( $store_record );
		if ( empty( $store['valid'] ) ) {
			return self::unresolved( $store['reason_code'] );
		}

		$release = self::validate_release( $release_record );
		if ( empty( $release['valid'] ) ) {
			return self::unresolved( $release['reason_code'] );
		}
		if ( $store['record']['generation'] !== $release['record']['generation'] ) {
			return self::unresolved( 'control_generation_mismatch' );
		}

		return array(
			'resolved'    => true,
			'reason_code' => 'control_resolved',
			'store'       => $store['record'],
			'release'     => $release['record'],
		);
	}

	/** @return array */
	private static function validate_store( $candidate ) {
		$required = array( 'contract_version', 'state', 'generation' );
		$allowed  = array_merge( $required, array( 'store_id', 'commissioned_at' ) );
		if ( ! self::valid_keys( $candidate, $required, $allowed ) ) {
			return self::invalid_record( 'store_provenance_missing' );
		}

		if (
			! is_int( $candidate['contract_version'] )
			|| MMED_V1_Study_Release::CONTROL_VERSION !== $candidate['contract_version']
			|| ! is_int( $candidate['generation'] )
			|| $candidate['generation'] < 1
			|| ! is_string( $candidate['state'] )
			|| ! in_array( $candidate['state'], array( 'never_commissioned', 'commissioned' ), true )
		) {
			return self::invalid_record( 'store_provenance_invalid' );
		}

		if ( 'never_commissioned' === $candidate['state'] ) {
			if ( array_key_exists( 'store_id', $candidate ) || array_key_exists( 'commissioned_at', $candidate ) ) {
				return self::invalid_record( 'store_provenance_invalid' );
			}
			return array(
				'valid'  => true,
				'record' => array(
					'contract_version' => $candidate['contract_version'],
					'state'            => $candidate['state'],
					'generation'       => $candidate['generation'],
					'store_id'         => null,
					'commissioned_at'  => null,
				),
			);
		}

		if (
			! isset( $candidate['store_id'], $candidate['commissioned_at'] )
			|| ! is_string( $candidate['store_id'] )
			|| ! preg_match( '/^[A-Za-z0-9_.:-]{1,128}$/', $candidate['store_id'] )
			|| ! self::valid_timestamp( $candidate['commissioned_at'] )
		) {
			return self::invalid_record( 'store_provenance_invalid' );
		}

		return array(
			'valid'  => true,
			'record' => array(
				'contract_version' => $candidate['contract_version'],
				'state'            => $candidate['state'],
				'generation'       => $candidate['generation'],
				'store_id'         => $candidate['store_id'],
				'commissioned_at'  => $candidate['commissioned_at'],
			),
		);
	}

	/** @return array */
	private static function validate_release( $candidate ) {
		$required = array(
			'contract_version',
			'generation',
			'mode',
			'exposure',
			'decision_12_state',
			'stop',
			'release_digest',
			'current_reader_version',
			'previous_reader_version',
			'effective_at',
			'reason',
		);
		$allowed = array_merge( $required, array( 'policy_version' ) );
		if ( ! self::valid_keys( $candidate, $required, $allowed ) ) {
			return self::invalid_record( 'release_provenance_missing' );
		}

		$previous = $candidate['previous_reader_version'];
		if (
			! is_int( $candidate['contract_version'] )
			|| MMED_V1_Study_Release::CONTROL_VERSION !== $candidate['contract_version']
			|| ! is_int( $candidate['generation'] )
			|| $candidate['generation'] < 1
			|| ! MMED_V1_Study_Domain::is_mode( $candidate['mode'] )
			|| ! is_bool( $candidate['exposure'] )
			|| ! in_array( $candidate['decision_12_state'], array( 'hold', 'approved' ), true )
			|| ! is_bool( $candidate['stop'] )
			|| ! is_string( $candidate['release_digest'] )
			|| MMED_V1_Study_Release::RELEASE_SHA256 !== $candidate['release_digest']
			|| ! self::valid_reader( $candidate['current_reader_version'] )
			|| ( null !== $previous && ! self::valid_reader( $previous ) )
			|| $candidate['current_reader_version'] === $previous
			|| ! self::valid_timestamp( $candidate['effective_at'] )
			|| ! is_string( $candidate['reason'] )
			|| ! preg_match( '/^[A-Za-z0-9_.:-]{1,128}$/', $candidate['reason'] )
		) {
			return self::invalid_record( 'release_provenance_invalid' );
		}

		$policy_present = array_key_exists( 'policy_version', $candidate );
		if (
			( 'hold' === $candidate['decision_12_state'] && $policy_present )
			|| (
				'approved' === $candidate['decision_12_state']
				&& (
					! $policy_present
					|| ! is_string( $candidate['policy_version'] )
					|| ! preg_match( '/^[A-Za-z0-9_.:-]{1,128}$/', $candidate['policy_version'] )
				)
			)
		) {
			return self::invalid_record( 'release_provenance_invalid' );
		}

		return array(
			'valid'  => true,
			'record' => array(
				'contract_version'        => $candidate['contract_version'],
				'generation'              => $candidate['generation'],
				'mode'                    => $candidate['mode'],
				'exposure'                => $candidate['exposure'],
				'decision_12_state'       => $candidate['decision_12_state'],
				'policy_version'          => $policy_present ? $candidate['policy_version'] : null,
				'stop'                    => $candidate['stop'],
				'release_digest'          => $candidate['release_digest'],
				'current_reader_version'  => $candidate['current_reader_version'],
				'previous_reader_version' => $previous,
				'effective_at'            => $candidate['effective_at'],
				'reason'                  => $candidate['reason'],
			),
		);
	}

	/** @return bool */
	private static function valid_keys( $candidate, $required, $allowed ) {
		if ( ! is_array( $candidate ) ) {
			return false;
		}
		foreach ( $required as $key ) {
			if ( ! array_key_exists( $key, $candidate ) ) {
				return false;
			}
		}
		foreach ( array_keys( $candidate ) as $key ) {
			if ( ! is_string( $key ) || ! in_array( $key, $allowed, true ) ) {
				return false;
			}
		}
		return true;
	}

	/** @return bool */
	private static function valid_reader( $reader ) {
		return is_string( $reader ) && 1 === preg_match( '/^[A-Za-z0-9_.:-]{1,64}$/', $reader );
	}

	/** @return bool */
	private static function valid_timestamp( $value ) {
		return is_string( $value )
			&& 1 === preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/', $value )
			&& false !== strtotime( $value );
	}

	/** @return array */
	private static function invalid_record( $reason_code ) {
		return array( 'valid' => false, 'reason_code' => $reason_code );
	}

	/** @return array */
	private static function unresolved( $reason_code ) {
		return array(
			'resolved'    => false,
			'reason_code' => $reason_code,
			'store'       => null,
			'release'     => array(
				'decision_12_state' => 'hold',
				'exposure'          => false,
				'stop'              => true,
			),
		);
	}
}
