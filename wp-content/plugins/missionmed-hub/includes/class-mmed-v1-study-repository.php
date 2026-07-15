<?php
/**
 * Read-only repository boundary for V1 Study Schedule 8010C.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Plan repository contract. Physical WordPress/InnoDB details belong in 8010D.
 *
 * 8010C deliberately defines no commit method, so no repository implementation
 * in this slice can become a canonical writer by accident.
 */
interface MMED_V1_Study_Repository {

	/** @return string */
	public function binding_kind();

	/**
	 * Return physical store commissioning identity independent of release mode.
	 *
	 * @return array
	 */
	public function store_provenance();

	/**
	 * Return positive absent/present provenance or explicit unknown evidence.
	 *
	 * @param int $owner_id Server-derived learner owner.
	 * @return array
	 */
	public function cutover_provenance( $owner_id );

	/** @return array */
	public function compatible_reader_versions();

	/**
	 * Read through one explicitly selected release reader.
	 *
	 * @param int    $owner_id Server-derived learner owner.
	 * @param string $reader_version Selected reader contract.
	 * @return array
	 */
	public function load( $owner_id, $reader_version );
}

/**
 * Default 8010C binding. It cannot create, read, or replace Plan truth.
 */
final class MMED_V1_Study_Null_Repository implements MMED_V1_Study_Repository {

	/** @var array */
	private $control;

	/**
	 * @param array $control Validated or unresolved release control.
	 */
	public function __construct( $control ) {
		$this->control = is_array( $control ) ? $control : array( 'resolved' => false );
	}

	/** @return string */
	public function binding_kind() {
		if ( empty( $this->control['resolved'] ) || empty( $this->control['store']['state'] ) ) {
			return MMED_V1_Study_Domain::BINDING_UNAVAILABLE;
		}

		return 'never_commissioned' === $this->control['store']['state']
			? MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED
			: MMED_V1_Study_Domain::BINDING_UNAVAILABLE;
	}

	/** @return array */
	public function store_provenance() {
		if ( MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED === $this->binding_kind() ) {
			return array(
				'state'      => 'never_commissioned',
				'store_id'   => null,
				'generation' => (int) $this->control['store']['generation'],
			);
		}
		return array(
			'state'      => 'unknown',
			'store_id'   => null,
			'generation' => null,
		);
	}

	/**
	 * Only durable never-commissioned control permits a positive absence result.
	 *
	 * @param int $owner_id Server-derived learner owner.
	 * @return array
	 */
	public function cutover_provenance( $owner_id ) {
		if ( (int) $owner_id <= 0 || MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED !== $this->binding_kind() ) {
			return array(
				'state'              => MMED_V1_Study_Domain::TRUTH_UNKNOWN,
				'schema_version'     => null,
				'watermark_evidence' => false,
			);
		}

		return array(
			'state'              => MMED_V1_Study_Domain::TRUTH_ABSENT,
			'schema_version'     => null,
			'watermark_evidence' => false,
		);
	}

	/** @return array */
	public function compatible_reader_versions() {
		return array();
	}

	/**
	 * Null reads are explicit and never fall back to Calendar or legacy Study.
	 *
	 * @param int    $owner_id Server-derived learner owner.
	 * @param string $reader_version Requested reader.
	 * @return array
	 */
	public function load( $owner_id, $reader_version ) {
		unset( $owner_id, $reader_version );
		$never_commissioned = MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED === $this->binding_kind();
		return array(
			'ok'          => false,
			'reason_code' => $never_commissioned ? 'no_truth' : 'dependency_unavailable',
			'plan'        => null,
		);
	}
}

/**
 * Resolve the repository from durable store control. Injection cannot override
 * missing control or turn never-commissioned provenance into a real store.
 */
final class MMED_V1_Study_Repository_Provider {

	/**
	 * @param array|null $control Optional already-read control for one request.
	 * @return MMED_V1_Study_Repository
	 */
	public static function get( $control = null ) {
		$control    = is_array( $control ) ? $control : MMED_V1_Study_Control::read();
		$repository = new MMED_V1_Study_Null_Repository( $control );

		if ( empty( $control['resolved'] ) || empty( $control['store']['state'] ) ) {
			return $repository;
		}

		if ( function_exists( 'apply_filters' ) ) {
			$repository = apply_filters( 'mmed_v1_study_repository', $repository, $control );
		}

		if ( ! $repository instanceof MMED_V1_Study_Repository ) {
			return new MMED_V1_Study_Null_Repository( array( 'resolved' => false ) );
		}

		if ( ! self::matches_control( $repository, $control ) ) {
			return new MMED_V1_Study_Null_Repository( array( 'resolved' => false ) );
		}

		return $repository;
	}

	/**
	 * Reconcile a repository's physical identity with the atomic control tuple.
	 *
	 * @param MMED_V1_Study_Repository $repository Candidate repository.
	 * @param array                    $control Validated control.
	 * @return bool
	 */
	public static function matches_control( $repository, $control ) {
		if ( ! $repository instanceof MMED_V1_Study_Repository || empty( $control['resolved'] ) || empty( $control['store'] ) ) {
			return false;
		}

		try {
			$binding  = $repository->binding_kind();
			$physical = $repository->store_provenance();
		} catch ( Throwable $error ) {
			unset( $error );
			return false;
		}
		if ( ! is_array( $physical ) ) {
			return false;
		}

		$expected = $control['store'];
		if ( 'never_commissioned' === $expected['state'] ) {
			return MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED === $binding
				&& 'never_commissioned' === ( isset( $physical['state'] ) ? $physical['state'] : null )
				&& (int) $expected['generation'] === ( isset( $physical['generation'] ) ? (int) $physical['generation'] : 0 );
		}

		return MMED_V1_Study_Domain::BINDING_READY === $binding
			&& 'commissioned' === ( isset( $physical['state'] ) ? $physical['state'] : null )
			&& $expected['store_id'] === ( isset( $physical['store_id'] ) ? $physical['store_id'] : null )
			&& (int) $expected['generation'] === ( isset( $physical['generation'] ) ? (int) $physical['generation'] : 0 );
	}
}
