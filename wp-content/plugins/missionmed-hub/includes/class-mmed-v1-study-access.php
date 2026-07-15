<?php
/**
 * Fail-closed V1 Study Schedule entitlement and authorization boundary.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Entitlement evidence source. */
interface MMED_V1_Study_Entitlement_Provider {
	/** @param int $user_id WordPress actor ID. @return mixed */
	public function claim( $user_id );
}

/** WordPress-owned runtime entitlement source. */
final class MMED_V1_Study_Runtime_Entitlement_Provider implements MMED_V1_Study_Entitlement_Provider {
	/** @return mixed */
	public function claim( $user_id ) {
		if ( ! function_exists( 'mmhq_cam_build_entitlement' ) ) {
			throw new RuntimeException( 'V1 entitlement source unavailable.' );
		}
		return mmhq_cam_build_entitlement( (int) $user_id );
	}
}

/** Explicit unavailable source used after invalid injection. */
final class MMED_V1_Study_Unavailable_Entitlement_Provider implements MMED_V1_Study_Entitlement_Provider {
	/** @return mixed */
	public function claim( $user_id ) {
		unset( $user_id );
		throw new RuntimeException( 'V1 entitlement source unavailable.' );
	}
}

/** Resolve the server-owned entitlement adapter. */
final class MMED_V1_Study_Entitlement_Provider_Resolver {
	/** @return MMED_V1_Study_Entitlement_Provider */
	public static function get() {
		$provider = new MMED_V1_Study_Runtime_Entitlement_Provider();
		if ( function_exists( 'apply_filters' ) ) {
			$provider = apply_filters( 'mmed_v1_study_entitlement_provider', $provider );
		}
		return $provider instanceof MMED_V1_Study_Entitlement_Provider
			? $provider
			: new MMED_V1_Study_Unavailable_Entitlement_Provider();
	}
}

/**
 * Normalize WordPress-owned 360 evidence without copying raw course or product
 * information into V1 responses, logs, or persistence.
 */
final class MMED_V1_Study_Entitlement {

	const MAX_CLAIM_AGE_SECONDS = 60;

	/**
	 * @param int                                     $user_id WordPress actor ID.
	 * @param int|null                                $now Deterministic Unix time.
	 * @param MMED_V1_Study_Entitlement_Provider|null $provider Optional source.
	 * @return array
	 */
	public static function evaluate( $user_id, $now = null, $provider = null ) {
		$user_id = function_exists( 'absint' ) ? absint( $user_id ) : abs( (int) $user_id );
		$now     = null === $now ? time() : (int) $now;
		$provider = $provider instanceof MMED_V1_Study_Entitlement_Provider
			? $provider
			: MMED_V1_Study_Entitlement_Provider_Resolver::get();

		if ( $user_id <= 0 ) {
			return self::denied( $user_id, 'entitlement_subject_invalid', true );
		}

		try {
			$claim = $provider->claim( $user_id );
		} catch ( Throwable $error ) {
			unset( $error );
			return self::denied( $user_id, 'entitlement_source_unavailable', true );
		}

		return self::evaluate_claim( $claim, $user_id, $now );
	}

	/**
	 * @param mixed $claim Server evidence candidate.
	 * @param int   $user_id WordPress actor ID.
	 * @param int   $now Deterministic Unix time.
	 * @return array
	 */
	public static function evaluate_claim( $claim, $user_id, $now ) {
		if (
			! is_array( $claim )
			|| 'cam' !== ( isset( $claim['product'] ) ? $claim['product'] : null )
			|| 'wordpress_learndash_handoff' !== ( isset( $claim['source'] ) ? $claim['source'] : null )
		) {
			return self::denied( $user_id, 'entitlement_claim_malformed', true );
		}

		$evaluated_at_raw = isset( $claim['evaluated_at'] ) && is_string( $claim['evaluated_at'] ) ? $claim['evaluated_at'] : '';
		$evaluated_at     = '' !== $evaluated_at_raw ? strtotime( $evaluated_at_raw ) : false;
		if ( false === $evaluated_at || $evaluated_at > $now || $evaluated_at < ( $now - self::MAX_CLAIM_AGE_SECONDS ) ) {
			return self::denied( $user_id, 'entitlement_claim_stale', false );
		}

		$expires_at_raw = isset( $claim['expires_at'] ) && is_string( $claim['expires_at'] ) ? trim( $claim['expires_at'] ) : '';
		$expires_at     = '' !== $expires_at_raw ? strtotime( $expires_at_raw ) : false;
		if ( '' !== $expires_at_raw && false === $expires_at ) {
			return self::denied( $user_id, 'entitlement_claim_malformed', true );
		}
		if ( false !== $expires_at && $expires_at <= $now ) {
			return self::denied( $user_id, 'entitlement_expired', false );
		}

		if ( empty( $claim['course_ids'] ) || ! is_array( $claim['course_ids'] ) ) {
			return self::denied( $user_id, 'entitlement_claim_malformed', true );
		}
		foreach ( $claim['course_ids'] as $course_id ) {
			if ( ! is_scalar( $course_id ) || (int) $course_id <= 0 ) {
				return self::denied( $user_id, 'entitlement_claim_malformed', true );
			}
		}

		$authority_mode = isset( $claim['authority_mode'] ) && is_string( $claim['authority_mode'] )
			? $claim['authority_mode']
			: '';
		$woo_authority  = 'learndash_and_woocommerce' === $authority_mode
			&& true === ( isset( $claim['purchase_verified'] ) ? $claim['purchase_verified'] : null )
			&& true === ( isset( $claim['purchase_match_found'] ) ? $claim['purchase_match_found'] : null );
		$legacy_authority = 'learndash_current_access' === $authority_mode
			&& false === ( isset( $claim['purchase_verified'] ) ? $claim['purchase_verified'] : null )
			&& false === ( isset( $claim['purchase_match_found'] ) ? $claim['purchase_match_found'] : null );

		$allowed = true === ( isset( $claim['active'] ) ? $claim['active'] : null )
			&& 'active' === ( isset( $claim['status'] ) ? $claim['status'] : null )
			&& true === ( isset( $claim['verified'] ) ? $claim['verified'] : null )
			&& true === ( isset( $claim['trusted'] ) ? $claim['trusted'] : null )
			&& true === ( isset( $claim['current_access_verified'] ) ? $claim['current_access_verified'] : null )
			&& true === ( isset( $claim['revocation_checked'] ) ? $claim['revocation_checked'] : null )
			&& true === ( isset( $claim['enrollment_verified'] ) ? $claim['enrollment_verified'] : null )
			&& false === ( isset( $claim['restricted'] ) ? $claim['restricted'] : null )
			&& false === ( isset( $claim['revoked'] ) ? $claim['revoked'] : null )
			&& ( $woo_authority || $legacy_authority );

		if ( ! $allowed ) {
			return self::denied( $user_id, 'entitlement_denied', false );
		}

		return array(
			'subject_id'       => (int) $user_id,
			'product_scope'    => 'v1_study_schedule_360',
			'allowed'          => true,
			'reason_code'      => 'entitlement_allowed',
			'authority_mode'   => $authority_mode,
			'evaluated_at'     => gmdate( 'c', $evaluated_at ),
			'expires_at'       => false === $expires_at ? '' : gmdate( 'c', $expires_at ),
			'contract_version' => MMED_V1_Study_Domain::CLAIM_CONTRACT_VERSION,
			'dependency_error' => false,
		);
	}

	/** @return array */
	private static function denied( $user_id, $reason_code, $dependency_error ) {
		return array(
			'subject_id'       => (int) $user_id,
			'product_scope'    => 'v1_study_schedule_360',
			'allowed'          => false,
			'reason_code'      => $reason_code,
			'authority_mode'   => '',
			'evaluated_at'     => '',
			'expires_at'       => '',
			'contract_version' => MMED_V1_Study_Domain::CLAIM_CONTRACT_VERSION,
			'dependency_error' => true === $dependency_error,
		);
	}
}

/** Server assignment authority. */
interface MMED_V1_Study_Assignment_Provider {
	/** @return bool */
	public function is_assigned( $mentor_id, $owner_id );
}

/** Deny-by-default assignment source until the mentor system adapter exists. */
final class MMED_V1_Study_Null_Assignment_Provider implements MMED_V1_Study_Assignment_Provider {
	/** @return bool */
	public function is_assigned( $mentor_id, $owner_id ) {
		unset( $mentor_id, $owner_id );
		return false;
	}
}

/** Resolve the assignment source without accepting client-supplied evidence. */
final class MMED_V1_Study_Assignment_Provider_Resolver {
	/** @return MMED_V1_Study_Assignment_Provider */
	public static function get() {
		$provider = new MMED_V1_Study_Null_Assignment_Provider();
		if ( function_exists( 'apply_filters' ) ) {
			$provider = apply_filters( 'mmed_v1_study_assignment_provider', $provider );
		}
		return $provider instanceof MMED_V1_Study_Assignment_Provider
			? $provider
			: new MMED_V1_Study_Null_Assignment_Provider();
	}
}

/** Four-stage server authorization for the V1 surface. */
final class MMED_V1_Study_Access {

	/**
	 * @param int                           $owner_id Server-derived learner owner.
	 * @param MMED_V1_Study_Repository|null $repository Optional binding.
	 * @param array|null                    $control Optional request-local control.
	 * @return array
	 */
	public static function mode_decision( $owner_id, $repository = null, $control = null ) {
		$control = is_array( $control ) ? $control : MMED_V1_Study_Control::read();
		if ( empty( $control['resolved'] ) || empty( $control['release'] ) ) {
			$reason = isset( $control['reason_code'] ) ? $control['reason_code'] : 'control_unresolved';
			return MMED_V1_Study_Domain::mode_failure( $reason );
		}

		$repository = $repository instanceof MMED_V1_Study_Repository
			? $repository
			: MMED_V1_Study_Repository_Provider::get( $control );
		if ( ! MMED_V1_Study_Repository_Provider::matches_control( $repository, $control ) ) {
			return MMED_V1_Study_Domain::mode_failure( 'store_provenance_mismatch' );
		}

		try {
			$binding   = $repository->binding_kind();
			$truth     = $repository->cutover_provenance( (int) $owner_id );
			$readers   = $repository->compatible_reader_versions();
		} catch ( Throwable $error ) {
			unset( $error );
			return MMED_V1_Study_Domain::mode_failure( 'repository_exception' );
		}

		return MMED_V1_Study_Domain::resolve_mode( $control['release'], $truth, $binding, $readers );
	}

	/** @return array */
	public static function bootstrap_decision( $repository = null, $now = null, $provider = null, $control = null ) {
		return self::decide(
			MMED_V1_Study_Domain::ACTION_PLAN_READ,
			null,
			array(),
			true,
			false,
			$repository,
			$now,
			$provider,
			null,
			$control
		);
	}

	/**
	 * @param string                                  $action Logical action.
	 * @param int|null                                $owner_id Server-derived owner.
	 * @param array                                   $fields Candidate command payload or field list.
	 * @param bool                                    $nonce_verified Explicit nonce result.
	 * @param MMED_V1_Study_Repository|null           $repository Optional binding.
	 * @param int|null                                $now Deterministic Unix time.
	 * @param MMED_V1_Study_Entitlement_Provider|null $provider Optional entitlement source.
	 * @param MMED_V1_Study_Assignment_Provider|null  $assignment_provider Optional assignment source.
	 * @param array|null                              $control Optional request-local control.
	 * @return array
	 */
	public static function authorize_rest( $action, $owner_id, $fields, $nonce_verified, $repository = null, $now = null, $provider = null, $assignment_provider = null, $control = null ) {
		return self::decide(
			$action,
			$owner_id,
			$fields,
			$nonce_verified,
			true,
			$repository,
			$now,
			$provider,
			$assignment_provider,
			$control
		);
	}

	/**
	 * Gate legacy Calendar-backed Study mutations before any Calendar lookup/DML.
	 *
	 * @return array
	 */
	public static function legacy_writer_decision( $owner_id, $repository = null, $control = null ) {
		if ( (int) $owner_id <= 0 ) {
			return self::denied( 'v1_dependency_unavailable', 503, 'owner_unavailable', 'unknown', null, '' );
		}

		$mode = self::mode_decision( (int) $owner_id, $repository, $control );
		if ( empty( $mode['resolved'] ) ) {
			return self::denied( 'v1_dependency_unavailable', 503, 'mode_unresolved', 'legacy', $mode, '' );
		}
		if ( empty( $mode['legacy_writer_allowed'] ) ) {
			return self::denied( 'v1_write_disabled', 409, 'legacy_write_disabled', 'legacy', $mode, '' );
		}

		return array(
			'allowed'     => true,
			'error_code'  => '',
			'status'      => 200,
			'reason_code' => 'legacy_write_allowed',
			'actor_kind'  => 'legacy',
			'action'      => 'legacy_write',
			'mode'        => $mode,
		);
	}

	/** @return array */
	private static function decide( $action, $owner_id, $fields, $nonce_verified, $require_nonce, $repository, $now, $provider, $assignment_provider, $control ) {
		$logged_in = function_exists( 'is_user_logged_in' ) && is_user_logged_in();
		$actor_id  = function_exists( 'get_current_user_id' ) ? (int) get_current_user_id() : 0;

		if ( ! $logged_in || $actor_id <= 0 ) {
			return self::denied( 'v1_unauthenticated', 401, 'unauthenticated', 'unknown', null, $action );
		}
		if ( $require_nonce && true !== $nonce_verified ) {
			return self::denied( 'v1_csrf_invalid', 403, 'csrf_invalid', 'unknown', null, $action );
		}
		if ( ! self::is_known_action( $action ) ) {
			return self::denied( 'v1_validation_failed', 422, 'unknown_action', 'unknown', null, $action );
		}

		$entitlement = MMED_V1_Study_Entitlement::evaluate( $actor_id, $now, $provider );
		$actor_kind  = self::actor_kind( $actor_id, $entitlement );
		if ( 'unknown' === $actor_kind ) {
			$status = ! empty( $entitlement['dependency_error'] ) ? 503 : 404;
			$code   = 503 === $status ? 'v1_dependency_unavailable' : 'v1_not_found';
			return self::denied( $code, $status, 'actor_unknown', $actor_kind, null, $action );
		}
		if ( 'learner' === $actor_kind && empty( $entitlement['allowed'] ) ) {
			if ( ! empty( $entitlement['dependency_error'] ) ) {
				return self::denied( 'v1_dependency_unavailable', 503, 'entitlement_unavailable', $actor_kind, null, $action );
			}
			return self::denied( 'v1_not_found', 404, 'not_found', $actor_kind, null, $action );
		}

		$owner_id = null === $owner_id && 'learner' === $actor_kind ? $actor_id : (int) $owner_id;
		if ( ! self::actor_action_allowed( $actor_kind, $action ) || $owner_id <= 0 ) {
			return self::denied( 'v1_not_found', 404, 'not_found', $actor_kind, null, $action );
		}
		if ( 'learner' === $actor_kind && $owner_id !== $actor_id ) {
			return self::denied( 'v1_not_found', 404, 'not_found', $actor_kind, null, $action );
		}
		if ( 'mentor' === $actor_kind ) {
			$assignment_provider = $assignment_provider instanceof MMED_V1_Study_Assignment_Provider
				? $assignment_provider
				: MMED_V1_Study_Assignment_Provider_Resolver::get();
			try {
				$assigned = true === $assignment_provider->is_assigned( $actor_id, $owner_id );
			} catch ( Throwable $error ) {
				unset( $error );
				$assigned = false;
			}
			if ( ! $assigned ) {
				return self::denied( 'v1_not_found', 404, 'not_found', $actor_kind, null, $action );
			}
		}

		$field_error = self::validate_fields( $action, $fields );
		if ( '' !== $field_error ) {
			return self::denied( 'v1_validation_failed', 422, $field_error, $actor_kind, null, $action );
		}

		$mode = self::mode_decision( $owner_id, $repository, $control );
		if ( empty( $mode['resolved'] ) ) {
			return self::denied( 'v1_dependency_unavailable', 503, 'mode_unresolved', $actor_kind, $mode, $action );
		}

		if ( MMED_V1_Study_Domain::ACTION_AUDIT_READ !== $action ) {
			if ( MMED_V1_Study_Domain::is_read_action( $action ) ) {
				if ( empty( $mode['exposure_allowed'] ) || empty( $mode['reader_allowed'] ) ) {
					return self::denied( 'v1_not_found', 404, 'not_found', $actor_kind, $mode, $action );
				}
			} elseif ( empty( $mode['exposure_allowed'] ) || empty( $mode['v1_writer_allowed'] ) ) {
				return self::denied( 'v1_write_disabled', 409, 'write_disabled', $actor_kind, $mode, $action );
			}
		}

		return array(
			'allowed'     => true,
			'error_code'  => '',
			'status'      => 200,
			'reason_code' => 'allowed',
			'actor_kind'  => $actor_kind,
			'actor_id'    => $actor_id,
			'owner_id'    => $owner_id,
			'action'      => $action,
			'mode'        => $mode,
			'entitlement' => $entitlement,
		);
	}

	/**
	 * Resolve actor kind only from capability, server role evidence, and the
	 * normalized entitlement. Unknown values stay unknown.
	 *
	 * @return string
	 */
	public static function actor_kind( $actor_id, $entitlement = null ) {
		if ( function_exists( 'user_can' ) && user_can( $actor_id, 'manage_options' ) ) {
			return 'administrator';
		}

		$kind = 'unknown';
		if ( function_exists( 'apply_filters' ) ) {
			$kind = apply_filters( 'mmed_v1_study_actor_kind', $kind, (int) $actor_id );
		}
		if ( 'mentor' === $kind ) {
			return 'mentor';
		}
		if ( 'learner' === $kind && is_array( $entitlement ) && ! empty( $entitlement['allowed'] ) ) {
			return 'learner';
		}
		return 'unknown';
	}

	/** @return bool */
	private static function actor_action_allowed( $actor_kind, $action ) {
		$learner_actions = array(
			MMED_V1_Study_Domain::ACTION_PLAN_READ,
			MMED_V1_Study_Domain::ACTION_PLAN_COMMAND,
			MMED_V1_Study_Domain::ACTION_IMPORT_PREVIEW,
			MMED_V1_Study_Domain::ACTION_IMPORT_COMMIT,
			MMED_V1_Study_Domain::ACTION_COMPLETE,
			MMED_V1_Study_Domain::ACTION_PARTIALLY_RESOLVE,
			MMED_V1_Study_Domain::ACTION_MOVE,
			MMED_V1_Study_Domain::ACTION_RESERVE,
			MMED_V1_Study_Domain::ACTION_RELEASE,
			MMED_V1_Study_Domain::ACTION_RECOVER,
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ,
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_RESOLVE,
		);
		$mentor_actions = array(
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ,
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_SUBMIT,
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_WITHDRAW,
		);

		return ( 'learner' === $actor_kind && in_array( $action, $learner_actions, true ) )
			|| ( 'mentor' === $actor_kind && in_array( $action, $mentor_actions, true ) )
			|| ( 'administrator' === $actor_kind && MMED_V1_Study_Domain::ACTION_AUDIT_READ === $action );
	}

	/** @return bool */
	private static function is_known_action( $action ) {
		return MMED_V1_Study_Domain::is_read_action( $action ) || MMED_V1_Study_Domain::is_write_action( $action );
	}

	/**
	 * Validate exact top-level command fields and reject nested authority keys.
	 *
	 * @return string Empty on success, structural reason otherwise.
	 */
	private static function validate_fields( $action, $fields ) {
		if ( ! is_array( $fields ) ) {
			return 'forbidden_field';
		}

		$keys = array();
		foreach ( $fields as $key => $value ) {
			if ( is_int( $key ) ) {
				if ( ! is_string( $value ) ) {
					return 'forbidden_field';
				}
				$keys[] = $value;
			} else {
				if ( ! is_string( $key ) ) {
					return 'forbidden_field';
				}
				$keys[] = $key;
			}
		}

		$allowed = self::allowed_fields( $action );
		foreach ( array_values( array_unique( $keys ) ) as $field ) {
			if ( ! in_array( $field, $allowed, true ) ) {
				return 'forbidden_field';
			}
		}

		return self::contains_authority_key( $fields ) ? 'forbidden_nested_authority' : '';
	}

	/** @return bool */
	private static function contains_authority_key( $value ) {
		if ( ! is_array( $value ) ) {
			return false;
		}
		$forbidden = array( 'owner_id', 'learner_id', 'actor_id', 'role', 'status', 'assignment', 'assignment_id', 'entitlement', 'mode' );
		foreach ( $value as $key => $child ) {
			if ( is_string( $key ) && in_array( $key, $forbidden, true ) ) {
				return true;
			}
			if ( is_array( $child ) && self::contains_authority_key( $child ) ) {
				return true;
			}
		}
		return false;
	}

	/** @return array */
	private static function allowed_fields( $action ) {
		$commands = array( 'idempotency_key', 'expected_revision', 'command', 'payload' );
		$map      = array(
			MMED_V1_Study_Domain::ACTION_PLAN_READ                => array(),
			MMED_V1_Study_Domain::ACTION_PLAN_COMMAND             => $commands,
			MMED_V1_Study_Domain::ACTION_IMPORT_PREVIEW           => array( 'source_version', 'selection' ),
			MMED_V1_Study_Domain::ACTION_IMPORT_COMMIT            => array( 'preview_token', 'expected_revision', 'idempotency_key' ),
			MMED_V1_Study_Domain::ACTION_COMPLETE                 => $commands,
			MMED_V1_Study_Domain::ACTION_PARTIALLY_RESOLVE        => $commands,
			MMED_V1_Study_Domain::ACTION_MOVE                     => $commands,
			MMED_V1_Study_Domain::ACTION_RESERVE                  => $commands,
			MMED_V1_Study_Domain::ACTION_RELEASE                  => $commands,
			MMED_V1_Study_Domain::ACTION_RECOVER                  => $commands,
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ     => array(),
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_SUBMIT   => array( 'proposal_type', 'payload' ),
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_WITHDRAW => array( 'expected_revision' ),
			MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_RESOLVE  => array( 'expected_revision', 'resolution', 'idempotency_key' ),
			MMED_V1_Study_Domain::ACTION_AUDIT_READ               => array(),
		);
		return isset( $map[ $action ] ) ? $map[ $action ] : array();
	}

	/** @return array */
	private static function denied( $error_code, $status, $reason_code, $actor_kind, $mode, $action ) {
		return array(
			'allowed'     => false,
			'error_code'  => $error_code,
			'status'      => (int) $status,
			'reason_code' => $reason_code,
			'actor_kind'  => $actor_kind,
			'action'      => is_string( $action ) ? $action : '',
			'mode'        => $mode,
		);
	}
}
