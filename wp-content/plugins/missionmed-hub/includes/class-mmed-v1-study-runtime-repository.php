<?php
/**
 * Request-local, direct physical reader binding for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Cache one request's physical provenance and exact current-reader result. */
final class MMED_V1_Study_Runtime_Repository implements MMED_V1_Study_Repository {

	/** @var array */
	private $provenance;

	/** @var MMED_V1_Study_Week_Current_Reader|null */
	private $reader;

	/** @var array */
	private $owner_results = array();

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		$physical = new MMED_V1_Study_InnoDB_Repository( $database );
		$this->provenance = $physical->store_provenance();
		$this->reader = 'commissioned' === (string) ( $this->provenance['state'] ?? '' )
			? new MMED_V1_Study_Week_Current_Reader( $database )
			: null;
	}

	/** @return string */
	public function binding_kind() {
		return $this->reader instanceof MMED_V1_Study_Week_Current_Reader
			? MMED_V1_Study_Domain::BINDING_READY
			: MMED_V1_Study_Domain::BINDING_UNAVAILABLE;
	}

	/** @return array */
	public function store_provenance() {
		return $this->provenance;
	}

	/** @return array */
	public function cutover_provenance( $owner_id ) {
		$result = $this->owner_result( $owner_id );
		if ( ! empty( $result['ok'] ) ) {
			return array(
				'state'              => MMED_V1_Study_Domain::TRUTH_PRESENT,
				'schema_version'     => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
				'watermark_evidence' => true,
			);
		}
		if ( 'no_truth' === (string) ( $result['reason_code'] ?? '' ) ) {
			return array(
				'state'              => MMED_V1_Study_Domain::TRUTH_ABSENT,
				'schema_version'     => null,
				'watermark_evidence' => false,
			);
		}
		return array(
			'state'              => MMED_V1_Study_Domain::TRUTH_UNKNOWN,
			'schema_version'     => null,
			'watermark_evidence' => false,
		);
	}

	/** @return array */
	public function compatible_reader_versions() {
		return $this->reader instanceof MMED_V1_Study_Week_Current_Reader ? array( '2' ) : array();
	}

	/** @return array */
	public function load( $owner_id, $reader_version ) {
		if ( '2' !== $reader_version ) {
			return array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null );
		}
		return $this->owner_result( $owner_id );
	}

	/** @return array */
	private function owner_result( $owner_id ) {
		if ( ! is_int( $owner_id ) || $owner_id <= 0 || ! $this->reader instanceof MMED_V1_Study_Week_Current_Reader ) {
			return array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null );
		}
		$key = (string) $owner_id;
		if ( ! array_key_exists( $key, $this->owner_results ) ) {
			$this->owner_results[ $key ] = $this->reader->load( $owner_id );
		}
		return $this->owner_results[ $key ];
	}
}
