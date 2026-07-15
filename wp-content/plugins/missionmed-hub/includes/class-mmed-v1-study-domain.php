<?php
/**
 * Pure release-mode and action vocabulary for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Pure V1 contract values. This class has no WordPress or persistence calls.
 */
final class MMED_V1_Study_Domain {

	const CONTRACT_VERSION       = 1;
	const CLAIM_CONTRACT_VERSION = 1;

	const MODE_LEGACY_PRECUTOVER  = 'LEGACY_PRECUTOVER';
	const MODE_ACTIVE_READ_WRITE  = 'V1_ACTIVE_READ_WRITE';
	const MODE_DEGRADED_READ_ONLY = 'V1_DEGRADED_READ_ONLY';
	const MODE_HIDDEN_NO_TRUTH    = 'V1_HIDDEN_NO_TRUTH';

	const TRUTH_ABSENT  = 'absent';
	const TRUTH_PRESENT = 'present';
	const TRUTH_UNKNOWN = 'unknown';

	const BINDING_NEVER_COMMISSIONED = 'never_commissioned';
	const BINDING_READY              = 'ready';
	const BINDING_UNAVAILABLE        = 'unavailable';

	const ACTION_PLAN_READ                = 'plan_read';
	const ACTION_PLAN_COMMAND             = 'plan_command';
	const ACTION_IMPORT_PREVIEW           = 'import_preview';
	const ACTION_IMPORT_COMMIT            = 'import_commit';
	const ACTION_COMPLETE                 = 'complete';
	const ACTION_PARTIALLY_RESOLVE        = 'partially_resolve';
	const ACTION_MOVE                     = 'move';
	const ACTION_RESERVE                  = 'reserve';
	const ACTION_RELEASE                  = 'release';
	const ACTION_RECOVER                  = 'recover';
	const ACTION_MENTOR_PROPOSAL_READ     = 'mentor_proposal_read';
	const ACTION_MENTOR_PROPOSAL_SUBMIT   = 'mentor_proposal_submit';
	const ACTION_MENTOR_PROPOSAL_WITHDRAW = 'mentor_proposal_withdraw';
	const ACTION_MENTOR_PROPOSAL_RESOLVE  = 'mentor_proposal_resolve';
	const ACTION_AUDIT_READ               = 'audit_read';

	/**
	 * Return whether a string is one of the four Decision 13 modes.
	 *
	 * @param mixed $mode Candidate mode.
	 * @return bool
	 */
	public static function is_mode( $mode ) {
		return is_string( $mode ) && in_array(
			$mode,
			array(
				self::MODE_LEGACY_PRECUTOVER,
				self::MODE_ACTIVE_READ_WRITE,
				self::MODE_DEGRADED_READ_ONLY,
				self::MODE_HIDDEN_NO_TRUTH,
			),
			true
		);
	}

	/**
	 * Return whether an action reads Plan or proposal truth.
	 *
	 * @param mixed $action Candidate action.
	 * @return bool
	 */
	public static function is_read_action( $action ) {
		return in_array(
			$action,
			array(
				self::ACTION_PLAN_READ,
				self::ACTION_MENTOR_PROPOSAL_READ,
				self::ACTION_AUDIT_READ,
			),
			true
		);
	}

	/**
	 * Return whether an action can mutate truth or submit a proposal.
	 *
	 * @param mixed $action Candidate action.
	 * @return bool
	 */
	public static function is_write_action( $action ) {
		return in_array(
			$action,
			array(
				self::ACTION_PLAN_COMMAND,
				self::ACTION_IMPORT_PREVIEW,
				self::ACTION_IMPORT_COMMIT,
				self::ACTION_COMPLETE,
				self::ACTION_PARTIALLY_RESOLVE,
				self::ACTION_MOVE,
				self::ACTION_RESERVE,
				self::ACTION_RELEASE,
				self::ACTION_RECOVER,
				self::ACTION_MENTOR_PROPOSAL_SUBMIT,
				self::ACTION_MENTOR_PROPOSAL_WITHDRAW,
				self::ACTION_MENTOR_PROPOSAL_RESOLVE,
			),
			true
		);
	}

	/**
	 * Resolve the four-state release contract from validated server evidence.
	 *
	 * A present watermark can never return to a legacy or hidden writer state.
	 * It is readable only through the exact current or actual N-1 reader named by
	 * the release control. An absent watermark may retain the legacy writer, but
	 * only when absence is positively established by an available repository.
	 *
	 * @param array  $release Validated release control record.
	 * @param array  $provenance Repository cutover provenance.
	 * @param string $binding_kind Repository binding state.
	 * @param array  $repository_readers Reader versions supported by the binding.
	 * @return array
	 */
	public static function resolve_mode( $release, $provenance, $binding_kind, $repository_readers ) {
		$release = self::normalize_release( $release );
		if ( empty( $release['valid'] ) ) {
			return self::mode_failure( 'release_control_invalid' );
		}

		$truth = self::normalize_provenance( $provenance );
		if ( empty( $truth['valid'] ) ) {
			return self::mode_failure( $truth['reason_code'] );
		}

		if ( ! in_array( $binding_kind, array( self::BINDING_NEVER_COMMISSIONED, self::BINDING_READY ), true ) ) {
			return self::mode_failure( 'repository_unavailable' );
		}

		$repository_readers = self::normalize_readers( $repository_readers );
		$current_reader     = $release['current_reader_version'];
		$previous_reader    = $release['previous_reader_version'];
		$release_readers    = array( $current_reader );
		if ( null !== $previous_reader ) {
			$release_readers[] = $previous_reader;
		}
		$compatible_readers = array_values( array_intersect( $release_readers, $repository_readers ) );

		if ( self::TRUTH_PRESENT === $truth['state'] ) {
			if ( self::BINDING_READY !== $binding_kind ) {
				return self::mode_failure( 'repository_unavailable_after_watermark' );
			}

			$truth_reader = $truth['schema_version'];
			if ( ! in_array( $truth_reader, $compatible_readers, true ) ) {
				return self::mode_failure( 'reader_unavailable' );
			}

			if (
				self::MODE_ACTIVE_READ_WRITE === $release['mode']
				&& $current_reader === $truth_reader
				&& true === $release['exposure']
				&& 'approved' === $release['decision_12_state']
				&& true !== $release['stop']
			) {
				return self::mode_success(
					self::MODE_ACTIVE_READ_WRITE,
					true,
					true,
					$truth_reader,
					true,
					false,
					'active_after_watermark'
				);
			}

			return self::mode_success(
				self::MODE_DEGRADED_READ_ONLY,
				true,
				true,
				$truth_reader,
				false,
				false,
				'degraded_after_watermark'
			);
		}

		if ( true === $release['stop'] ) {
			return self::mode_success(
				self::MODE_HIDDEN_NO_TRUTH,
				false,
				false,
				null,
				false,
				false,
				'stopped_before_watermark'
			);
		}

		if ( self::MODE_LEGACY_PRECUTOVER === $release['mode'] ) {
			return self::mode_success(
				self::MODE_LEGACY_PRECUTOVER,
				false,
				false,
				null,
				false,
				true,
				'legacy_precutover'
			);
		}

		if (
			self::MODE_ACTIVE_READ_WRITE === $release['mode']
			&& self::BINDING_READY === $binding_kind
			&& in_array( $current_reader, $compatible_readers, true )
			&& true === $release['exposure']
			&& 'approved' === $release['decision_12_state']
		) {
			return self::mode_success(
				self::MODE_ACTIVE_READ_WRITE,
				true,
				true,
				$current_reader,
				true,
				false,
				'active_before_first_operation'
			);
		}

		return self::mode_success(
			self::MODE_HIDDEN_NO_TRUTH,
			false,
			false,
			null,
			false,
			true,
			'hidden_no_truth'
		);
	}

	/** @return array */
	private static function normalize_release( $release ) {
		if ( ! is_array( $release ) ) {
			return array( 'valid' => false );
		}

		$mode        = isset( $release['mode'] ) ? $release['mode'] : null;
		$current     = isset( $release['current_reader_version'] ) ? $release['current_reader_version'] : null;
		$previous    = array_key_exists( 'previous_reader_version', $release ) ? $release['previous_reader_version'] : null;
		$decision_12 = isset( $release['decision_12_state'] ) ? $release['decision_12_state'] : null;

		if (
			! self::is_mode( $mode )
			|| ! self::is_reader( $current )
			|| ( null !== $previous && ! self::is_reader( $previous ) )
			|| $current === $previous
			|| ! isset( $release['exposure'] )
			|| ! is_bool( $release['exposure'] )
			|| ! isset( $release['stop'] )
			|| ! is_bool( $release['stop'] )
			|| ! in_array( $decision_12, array( 'hold', 'approved' ), true )
		) {
			return array( 'valid' => false );
		}

		return array(
			'valid'                   => true,
			'mode'                    => $mode,
			'exposure'                => $release['exposure'],
			'decision_12_state'       => $decision_12,
			'stop'                    => $release['stop'],
			'current_reader_version'  => $current,
			'previous_reader_version' => $previous,
		);
	}

	/** @return array */
	private static function normalize_provenance( $provenance ) {
		if ( ! is_array( $provenance ) || ! isset( $provenance['state'] ) ) {
			return array( 'valid' => false, 'reason_code' => 'truth_unknown' );
		}

		$state      = $provenance['state'];
		$schema     = array_key_exists( 'schema_version', $provenance ) ? $provenance['schema_version'] : null;
		$watermark  = isset( $provenance['watermark_evidence'] ) ? $provenance['watermark_evidence'] : false;

		if ( self::TRUTH_UNKNOWN === $state ) {
			return array( 'valid' => false, 'reason_code' => 'truth_unknown' );
		}

		if ( self::TRUTH_ABSENT === $state && null === $schema && false === $watermark ) {
			return array(
				'valid'          => true,
				'state'          => self::TRUTH_ABSENT,
				'schema_version' => null,
			);
		}

		if ( self::TRUTH_PRESENT === $state && self::is_reader( $schema ) && true === $watermark ) {
			return array(
				'valid'          => true,
				'state'          => self::TRUTH_PRESENT,
				'schema_version' => $schema,
			);
		}

		return array( 'valid' => false, 'reason_code' => 'truth_provenance_invalid' );
	}

	/** @return array */
	private static function normalize_readers( $readers ) {
		if ( ! is_array( $readers ) ) {
			return array();
		}

		$normalized = array();
		foreach ( $readers as $reader ) {
			if ( self::is_reader( $reader ) && ! in_array( $reader, $normalized, true ) ) {
				$normalized[] = $reader;
			}
		}
		return $normalized;
	}

	/** @return bool */
	private static function is_reader( $reader ) {
		return is_string( $reader ) && 1 === preg_match( '/^[A-Za-z0-9_.:-]{1,64}$/', $reader );
	}

	/** @return array */
	private static function mode_success( $mode, $exposure_allowed, $reader_allowed, $reader_version, $v1_writer_allowed, $legacy_writer_allowed, $reason_code ) {
		return array(
			'resolved'              => true,
			'mode'                  => $mode,
			'exposure_allowed'      => (bool) $exposure_allowed,
			'reader_allowed'        => (bool) $reader_allowed,
			'reader_version'        => $reader_version,
			'reader_versions'       => null === $reader_version ? array() : array( $reader_version ),
			'v1_writer_allowed'     => (bool) $v1_writer_allowed,
			'legacy_writer_allowed' => (bool) $legacy_writer_allowed,
			'reason_code'           => $reason_code,
		);
	}

	/** @return array */
	public static function mode_failure( $reason_code ) {
		return array(
			'resolved'              => false,
			'mode'                  => null,
			'exposure_allowed'      => false,
			'reader_allowed'        => false,
			'reader_version'        => null,
			'reader_versions'       => array(),
			'v1_writer_allowed'     => false,
			'legacy_writer_allowed' => false,
			'reason_code'           => $reason_code,
		);
	}
}
