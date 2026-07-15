<?php
/**
 * Isolated 8010E E2 command-service contracts.
 *
 * This source registers no hook, route, option, filter, repository provider, or
 * runtime binding. A physical repository and an explicit fence must be injected
 * by synthetic tests. E3 owns the production Calendar/V1 shared owner fence.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Stable content-free command failure. */
final class MMED_V1_Study_Command_Exception extends RuntimeException {

	/** @var string */
	private $reason_code;

	/** @param string $reason_code Stable non-sensitive reason. */
	public function __construct( $reason_code ) {
		parent::__construct( (string) $reason_code );
		$this->reason_code = (string) $reason_code;
	}

	/** @return string */
	public function reason_code() {
		return $this->reason_code;
	}
}

/** Separate write boundary; the accepted 8010C repository remains read-only. */
interface MMED_V1_Study_Command_Repository {

	/**
	 * Execute one raw decoded command under a server-owned identity and envelope.
	 *
	 * @return array Exact internal service result.
	 */
	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
}

/**
 * Explicit transaction seam for the ordered E3 control and Calendar locks.
 *
 * E2 accepts only SCOPE_SYNTHETIC_ISOLATED. No null/default implementation is
 * supplied, so the command writer cannot become a runtime writer accidentally.
 */
interface MMED_V1_Study_Command_Fence {

	const SCOPE_SYNTHETIC_ISOLATED = 'synthetic-isolated-e2';

	/** @return string */
	public function scope();

	/** Lock exact release/control rows shared before the owner Plan row. @return bool */
	public function lock_control_rows( $database, $connection_id, $owner_id );

	/** Lock relevant Calendar Study rows in ascending identity order. @return bool */
	public function lock_calendar_rows( $database, $connection_id, $owner_id );
}

/**
 * Typed, synthetic-only E3 shared-owner arbiter seam.
 *
 * This does not weaken or replace the accepted E2 fence. Implementations must
 * return the exact scope below and expose the authority and Calendar snapshot
 * obtained on the same transaction/connection as the two inherited locks.
 */
interface MMED_V1_Study_Shared_Owner_Arbiter extends MMED_V1_Study_Command_Fence {

	const SCOPE_SYNTHETIC_SHARED_OWNER = 'synthetic-isolated-e3-shared-owner';

	/** @return array|null Content-free locked authority evidence. */
	public function locked_authority();

	/** @return array|null Content-free locked Calendar census. */
	public function locked_calendar_snapshot();
}

/** Injectable UUID-v4 source; production uses only the CSPRNG implementation. */
interface MMED_V1_Study_UUID_Source {

	/** @return string Lowercase UUID v4. */
	public function next_uuid();
}

/** Cryptographically secure server UUID source. */
final class MMED_V1_Study_CSPRNG_UUID_Source implements MMED_V1_Study_UUID_Source {

	/** @return string */
	public function next_uuid() {
		$bytes = random_bytes( 16 );
		$bytes[6] = chr( ( ord( $bytes[6] ) & 0x0f ) | 0x40 );
		$bytes[8] = chr( ( ord( $bytes[8] ) & 0x3f ) | 0x80 );
		return MMED_V1_Study_Week_Domain::binary_to_uuid( $bytes );
	}
}

/** Content-free service facade over the separately typed command repository. */
final class MMED_V1_Study_Command_Service {

	/** @var MMED_V1_Study_Command_Repository */
	private $repository;

	/** @param MMED_V1_Study_Command_Repository $repository Explicit writer. */
	public function __construct( $repository ) {
		if ( ! $repository instanceof MMED_V1_Study_Command_Repository ) {
			throw new InvalidArgumentException( 'V1 command repository is invalid.' );
		}
		$this->repository = $repository;
	}

	/**
	 * @param mixed  $candidate Decoded exact request body.
	 * @param int    $owner_id Server-derived learner owner.
	 * @param int    $actor_id Server-derived WordPress actor.
	 * @param string $actor_kind Server-owned role.
	 * @param array  $temporal_envelope Current server-issued Week context.
	 * @return array
	 */
	public function execute( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		try {
			$result = $this->repository->commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
			if ( ! self::valid_success( $result ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			return $result;
		} catch ( MMED_V1_Study_Command_Exception $error ) {
			return self::failure( $error->reason_code() );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			return self::failure( $error->reason_code(), $error->safe_context() );
		} catch ( Throwable $error ) {
			unset( $error );
			return self::failure( 'dependency_unavailable' );
		}
	}

	/** @return bool */
	private static function valid_success( $result ) {
		if ( ! is_array( $result ) ) {
			return false;
		}
		$keys = array_keys( $result );
		sort( $keys, SORT_STRING );
		if ( array( 'ok', 'reason_code', 'replayed', 'result', 'status' ) !== $keys ) {
			return false;
		}
		if (
			true !== $result['ok']
			|| 'ok' !== $result['reason_code']
			|| ! is_bool( $result['replayed'] )
			|| ! is_array( $result['result'] )
			|| 200 !== $result['status']
		) {
			return false;
		}
		try {
			MMED_V1_Study_Week_Command_State::assert_command_result( $result['result'] );
			return true;
		} catch ( Throwable $error ) {
			unset( $error );
			return false;
		}
	}

	/** @return array */
	private static function failure( $reason_code, $safe_context = array() ) {
		$allowed = array(
			'actor_owner_invalid', 'block_collision', 'block_limit_exceeded', 'block_not_found',
			'command_body_shape', 'command_unknown', 'create_payload_shape', 'delete_payload_shape',
			'dst_fold_choice_required', 'dst_fold_choice_unexpected', 'dst_gap', 'duration_invalid',
				'activity_duration_too_short', 'activity_source_owned', 'activity_type_invalid', 'fixed_anchor_immutable',
				'fold_invalid',
				'idempotency_conflict', 'idempotency_key_invalid', 'move_payload_shape', 'no_state_change',
				'local_date_invalid', 'local_time_invalid', 'outside_display_window', 'outside_selected_week',
				'priority_invalid', 'resize_payload_shape', 'revision_exhausted',
				'revision_invalid', 'stale_revision', 'temporal_context_stale', 'title_invalid',
				'uuid_invalid', 'week_limit_exceeded',
		);
		if ( ! in_array( $reason_code, $allowed, true ) ) {
			$reason_code = 'dependency_unavailable';
		}
		$status = in_array( $reason_code, array( 'block_not_found' ), true ) ? 404 : 422;
		if ( in_array( $reason_code, array( 'block_collision', 'idempotency_conflict', 'no_state_change', 'stale_revision' ), true ) ) {
			$status = 409;
		}
		if ( 'dependency_unavailable' === $reason_code ) {
			$status = 503;
		}
		$result = null;
		if ( 'dst_gap' === $reason_code && is_array( $safe_context ) ) {
			$suggestion = $safe_context['suggested_slot'] ?? null;
			$keys = is_array( $suggestion ) ? array_keys( $suggestion ) : array();
			sort( $keys, SORT_STRING );
			if (
				array( 'fold_required', 'local_date', 'local_time' ) === $keys
				&& is_bool( $suggestion['fold_required'] )
				&& is_string( $suggestion['local_date'] )
				&& 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/D', $suggestion['local_date'] )
				&& is_string( $suggestion['local_time'] )
				&& 1 === preg_match( '/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/D', $suggestion['local_time'] )
			) {
				$result = array( 'suggested_slot' => $suggestion );
			}
		}
		if ( 'dst_gap' === $reason_code && null === $result ) {
			$reason_code = 'dependency_unavailable';
			$status = 503;
		}
		return array(
			'ok'          => false,
			'reason_code' => $reason_code,
			'replayed'    => false,
			'result'      => $result,
			'status'      => $status,
		);
	}
}
