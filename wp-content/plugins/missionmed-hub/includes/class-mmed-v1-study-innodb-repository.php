<?php
/**
 * Isolated generation-2 InnoDB repository and current reader for 8010E E1.
 *
 * This file registers no hook, filter, route, option, or automatic installer.
 * It becomes reachable only when a later governed integration explicitly binds
 * it to the repository provider.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Content corruption marker that never exposes private row details. */
final class MMED_V1_Study_Reader_Corruption extends RuntimeException {}

/** Read one complete Plan through a single read-only consistent snapshot. */
final class MMED_V1_Study_Week_Current_Reader {

	const MAX_SNAPSHOT_BYTES = 2097152;

	/** @var object */
	private $database;

	/** @var int */
	private $connection_id;

	/** @var bool|null */
	private $is_mariadb;

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		if (
			! is_object( $database )
			|| ! method_exists( $database, 'query' )
			|| ! method_exists( $database, 'get_var' )
			|| ! method_exists( $database, 'get_results' )
			|| ! method_exists( $database, 'prepare' )
		) {
			throw new InvalidArgumentException( 'V1 current reader requires a database connection.' );
		}
		$this->database      = $database;
		$this->connection_id = 0;
		$this->is_mariadb    = null;
	}

	/**
	 * @param int $owner_id Server-derived learner owner.
	 * @return array
	 */
	public function load( $owner_id ) {
		if ( ! is_int( $owner_id ) || $owner_id <= 0 ) {
			return $this->failure( 'dependency_unavailable' );
		}
		try {
			$result = $this->with_consistent_snapshot(
				function () use ( $owner_id ) {
					return $this->read_plan( $owner_id );
				}
			);
			return is_array( $result ) ? $result : $this->failure( 'dependency_unavailable' );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			unset( $error );
			return $this->failure( 'plan_corrupt' );
		} catch ( MMED_V1_Study_Reader_Corruption $error ) {
			unset( $error );
			return $this->failure( 'plan_corrupt' );
		} catch ( Throwable $error ) {
			unset( $error );
			return $this->failure( 'dependency_unavailable' );
		}
	}

	/** @return array */
	private function read_plan( $owner_id ) {
		$kernel = MMED_V1_Study_Schema::table_names( $this->database );
		$week   = MMED_V1_Study_Week_Schema::table_names( $this->database );
		$sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex,';
		$sql .= ' CAST(store_generation AS CHAR) AS store_generation, schema_version,';
		$sql .= ' CAST(current_revision AS CHAR) AS current_revision, LOWER(HEX(watermark_operation_id)) AS watermark_hex,';
		$sql .= ' watermark_at, plan_json, LOWER(HEX(plan_hash)) AS plan_hash_hex, OCTET_LENGTH(plan_json) AS plan_bytes';
		$sql .= " FROM `{$kernel['plans']}` WHERE owner_id = %d LIMIT 2";
		$plans = $this->rows( $this->prepare( $sql, $owner_id ) );
		if ( empty( $plans ) ) {
			return $this->failure( 'no_truth' );
		}
		if ( 1 !== count( $plans ) ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_plan_cardinality_invalid' );
		}
		$plan = $plans[0];
		if (
			(string) $owner_id !== (string) ( $plan['owner_id'] ?? '' )
			|| ! is_string( $plan['current_revision'] ?? null )
		) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_plan_shape_invalid' );
		}
		$revision = MMED_V1_Study_Week_Domain::decimal_revision( $plan['current_revision'] );
		if ( '0' === $revision ) {
			if (
				null !== ( $plan['plan_hex'] ?? null )
				|| null !== ( $plan['schema_version'] ?? null )
				|| null !== ( $plan['watermark_hex'] ?? null )
				|| null !== ( $plan['watermark_at'] ?? null )
				|| null !== ( $plan['plan_json'] ?? null )
				|| null !== ( $plan['plan_hash_hex'] ?? null )
			) {
				throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_empty_plan_corrupt' );
			}
			return $this->failure( 'no_truth' );
		}

		if (
			'2' !== (string) ( $plan['store_generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $plan['schema_version'] ?? '' )
			|| ! is_string( $plan['watermark_hex'] ?? null )
			|| 32 !== strlen( $plan['watermark_hex'] )
			|| ! is_string( $plan['watermark_at'] ?? null )
			|| ! is_string( $plan['plan_json'] ?? null )
			|| ! is_string( $plan['plan_hash_hex'] ?? null )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $plan['plan_hash_hex'] )
			|| ! is_numeric( $plan['plan_bytes'] ?? null )
			|| (int) $plan['plan_bytes'] <= 0
			|| (int) $plan['plan_bytes'] > self::MAX_SNAPSHOT_BYTES
		) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_plan_shape_invalid' );
		}
		$plan_id = $this->uuid_from_hex( $plan['plan_hex'] ?? null );

		$week_sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex, LOWER(HEX(week_id)) AS week_hex,';
		$week_sql .= ' week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version,';
		$week_sql .= ' LOWER(HEX(temporal_context_hash)) AS temporal_context_hash_hex,';
		$week_sql .= ' CAST(created_revision AS CHAR) AS created_revision, CAST(updated_revision AS CHAR) AS updated_revision';
		$week_sql .= " FROM `{$week['weeks']}` WHERE owner_id = %d AND plan_id = UNHEX(%s)";
		$week_sql .= ' ORDER BY week_start_local, week_id';
		$week_rows = $this->rows( $this->prepare( $week_sql, $owner_id, $plan['plan_hex'] ) );

		$block_sql  = 'SELECT CAST(b.owner_id AS CHAR) AS owner_id, LOWER(HEX(b.plan_id)) AS plan_hex,';
		$block_sql .= ' LOWER(HEX(b.week_id)) AS week_hex, w.week_start_local, LOWER(HEX(b.block_id)) AS block_hex,';
		$block_sql .= ' b.title, b.activity_type, b.activity_catalog_version, b.storage_codebook_version,';
		$block_sql .= ' CAST(b.family_code AS CHAR) AS family_code, CAST(b.state_code AS CHAR) AS state_code,';
		$block_sql .= ' CAST(b.priority_code AS CHAR) AS priority_code, LOWER(HEX(b.goal_ref_hash)) AS goal_ref_hash_hex,';
		$block_sql .= ' b.goal_source_version, CAST(b.source_code AS CHAR) AS source_code,';
		$block_sql .= ' LOWER(HEX(b.source_namespace_hash)) AS source_namespace_hash_hex,';
		$block_sql .= ' LOWER(HEX(b.source_ref_hash)) AS source_ref_hash_hex, LOWER(HEX(b.source_version_hash)) AS source_version_hash_hex,';
		// Escaped percent signs survive wpdb::prepare() as DATE_FORMAT literals.
		$block_sql .= " DATE_FORMAT(b.start_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS start_at_utc,";
		$block_sql .= " DATE_FORMAT(b.end_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS end_at_utc,";
		$block_sql .= ' b.timezone, b.profile_version, b.tzdb_version, b.local_date,';
		$block_sql .= ' CAST(b.local_minute AS CHAR) AS local_minute, CAST(b.fold_code AS CHAR) AS fold_code,';
		$block_sql .= ' b.temporal_policy_version, LOWER(HEX(b.temporal_context_hash)) AS temporal_context_hash_hex,';
		$block_sql .= ' CAST(b.duration_minutes AS CHAR) AS duration_minutes, CAST(b.created_revision AS CHAR) AS created_revision,';
		$block_sql .= ' CAST(b.updated_revision AS CHAR) AS updated_revision, CAST(b.tombstoned_revision AS CHAR) AS tombstoned_revision';
		$block_sql .= " FROM `{$week['blocks']}` b INNER JOIN `{$week['weeks']}` w";
		$block_sql .= ' ON w.owner_id = b.owner_id AND w.plan_id = b.plan_id AND w.week_id = b.week_id';
		$block_sql .= ' WHERE b.owner_id = %d AND b.plan_id = UNHEX(%s) ORDER BY b.week_id, b.block_id';
		$block_rows = $this->rows( $this->prepare( $block_sql, $owner_id, $plan['plan_hex'] ) );

		$blocks_by_week = array();
		foreach ( $block_rows as $row ) {
			$week_hex = isset( $row['week_hex'] ) ? (string) $row['week_hex'] : '';
			if ( ! isset( $blocks_by_week[ $week_hex ] ) ) {
				$blocks_by_week[ $week_hex ] = array();
			}
			$blocks_by_week[ $week_hex ][] = $row;
		}

		$weeks = array();
		$seen  = array();
		foreach ( $week_rows as $row ) {
			$week_hex = isset( $row['week_hex'] ) ? (string) $row['week_hex'] : '';
			if ( isset( $seen[ $week_hex ] ) ) {
				throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_week_duplicate' );
			}
			$seen[ $week_hex ] = true;
			$week_dto = array(
				'owner_id'                 => (string) ( $row['owner_id'] ?? '' ),
				'plan_id'                  => $this->uuid_from_hex( $row['plan_hex'] ?? null ),
				'week_id'                  => $this->uuid_from_hex( $week_hex ),
				'week_start_local'         => (string) ( $row['week_start_local'] ?? '' ),
				'plan_revision'            => $revision,
				'week_created_revision'    => (string) ( $row['created_revision'] ?? '' ),
				'week_updated_revision'    => (string) ( $row['updated_revision'] ?? '' ),
				'timezone'                  => (string) ( $row['timezone'] ?? '' ),
				'profile_version'           => (string) ( $row['profile_version'] ?? '' ),
				'tzdb_version'              => (string) ( $row['tzdb_version'] ?? '' ),
				'temporal_policy_version'   => (string) ( $row['temporal_policy_version'] ?? '' ),
				'temporal_context_hash_hex' => (string) ( $row['temporal_context_hash_hex'] ?? '' ),
			);
			$block_dtos = array();
			foreach ( $blocks_by_week[ $week_hex ] ?? array() as $block ) {
				if (
					(string) ( $block['timezone'] ?? '' ) !== $week_dto['timezone']
					|| (string) ( $block['profile_version'] ?? '' ) !== $week_dto['profile_version']
					|| (string) ( $block['tzdb_version'] ?? '' ) !== $week_dto['tzdb_version']
					|| (string) ( $block['temporal_policy_version'] ?? '' ) !== $week_dto['temporal_policy_version']
					|| (string) ( $block['temporal_context_hash_hex'] ?? '' ) !== $week_dto['temporal_context_hash_hex']
				) {
					throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_temporal_context_mismatch' );
				}
				$block_dtos[] = array(
					'owner_id'                  => (string) ( $block['owner_id'] ?? '' ),
					'plan_id'                   => $this->uuid_from_hex( $block['plan_hex'] ?? null ),
					'week_id'                   => $this->uuid_from_hex( $block['week_hex'] ?? null ),
					'week_start_local'          => (string) ( $block['week_start_local'] ?? '' ),
					'block_id'                  => $this->uuid_from_hex( $block['block_hex'] ?? null ),
					'title'                     => (string) ( $block['title'] ?? '' ),
					'activity_type'             => (string) ( $block['activity_type'] ?? '' ),
					'activity_catalog_version'  => (string) ( $block['activity_catalog_version'] ?? '' ),
					'storage_codebook_version'  => (string) ( $block['storage_codebook_version'] ?? '' ),
					'family_code'               => (string) ( $block['family_code'] ?? '' ),
					'state_code'                => (string) ( $block['state_code'] ?? '' ),
					'priority_code'             => (string) ( $block['priority_code'] ?? '' ),
					'goal_ref_hash_hex'          => $block['goal_ref_hash_hex'] ?? null,
					'goal_source_version'        => $block['goal_source_version'] ?? null,
					'source_code'               => (string) ( $block['source_code'] ?? '' ),
					'source_namespace_hash_hex' => $block['source_namespace_hash_hex'] ?? null,
					'source_ref_hash_hex'       => $block['source_ref_hash_hex'] ?? null,
					'source_version_hash_hex'   => $block['source_version_hash_hex'] ?? null,
					'start_at_utc'               => (string) ( $block['start_at_utc'] ?? '' ),
					'end_at_utc'                 => (string) ( $block['end_at_utc'] ?? '' ),
					'timezone'                   => (string) ( $block['timezone'] ?? '' ),
					'profile_version'            => (string) ( $block['profile_version'] ?? '' ),
					'tzdb_version'               => (string) ( $block['tzdb_version'] ?? '' ),
					'local_date'                 => (string) ( $block['local_date'] ?? '' ),
					'local_minute'               => (string) ( $block['local_minute'] ?? '' ),
					'fold_code'                  => (string) ( $block['fold_code'] ?? '' ),
					'temporal_policy_version'    => (string) ( $block['temporal_policy_version'] ?? '' ),
					'temporal_context_hash_hex'  => (string) ( $block['temporal_context_hash_hex'] ?? '' ),
					'duration_minutes'           => (string) ( $block['duration_minutes'] ?? '' ),
					'created_revision'           => (string) ( $block['created_revision'] ?? '' ),
					'updated_revision'           => (string) ( $block['updated_revision'] ?? '' ),
					'tombstoned_revision'        => $block['tombstoned_revision'] ?? null,
				);
			}
			$weeks[] = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( $owner_id, $week_dto, $block_dtos );
			unset( $blocks_by_week[ $week_hex ] );
		}
		if ( ! empty( $blocks_by_week ) ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_orphan_block' );
		}

		$snapshot = array(
			'plan_id'        => $plan_id,
			'revision'       => $revision,
			'schema_version' => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
			'weeks'          => $weeks,
		);
		$json = MMED_V1_Study_Week_Domain::canonical_json( $snapshot );
		if (
			! hash_equals( $json, $plan['plan_json'] )
			|| ! hash_equals( hash( 'sha256', $json ), $plan['plan_hash_hex'] )
		) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_snapshot_mismatch' );
		}
		return array( 'ok' => true, 'reason_code' => 'ok', 'plan' => $snapshot );
	}

	/** @return mixed */
	private function with_consistent_snapshot( $callback ) {
		if ( ! is_callable( $callback ) ) {
			throw new InvalidArgumentException( 'V1 reader callback is invalid.' );
		}
		$this->connection_id = $this->current_connection_id();
		$initial_transaction_state = $this->transaction_active();
		if ( 1 !== (int) $this->scalar( 'SELECT @@SESSION.autocommit' ) || true === $initial_transaction_state ) {
			throw new RuntimeException( 'v1_reader_session_not_clean' );
		}
		$original_isolation = $this->isolation_level();
		$started = false;
		$result  = null;
		$primary = null;
		$cleanup = array();
		try {
			$this->execute( 'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ', 'v1_reader_isolation_failed' );
			if ( 'REPEATABLE-READ' !== $this->isolation_level() ) {
				throw new RuntimeException( 'v1_reader_isolation_failed' );
			}
			$this->execute( 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY', 'v1_reader_begin_failed' );
			$started = true;
			if ( false === $this->transaction_active() ) {
				throw new RuntimeException( 'v1_reader_transaction_inactive' );
			}
			$result = call_user_func( $callback );
			if ( false === $this->transaction_active() ) {
				throw new RuntimeException( 'v1_reader_transaction_lost' );
			}
			$this->execute( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_reader_commit_failed' );
			$started = false;
			if ( true === $this->transaction_active() ) {
				throw new RuntimeException( 'v1_reader_commit_failed' );
			}
		} catch ( Throwable $error ) {
			$primary = $error;
		}
		if ( $started ) {
			try {
				$this->execute( 'ROLLBACK AND NO CHAIN NO RELEASE', 'v1_reader_rollback_failed' );
				$started = false;
			} catch ( Throwable $error ) {
				$cleanup[] = $error->getMessage();
			}
		}
		try {
			$this->execute(
				'SET SESSION TRANSACTION ISOLATION LEVEL ' . str_replace( '-', ' ', $original_isolation ),
				'v1_reader_isolation_restore_failed'
			);
			if ( $original_isolation !== $this->isolation_level() ) {
				throw new RuntimeException( 'v1_reader_isolation_restore_failed' );
			}
		} catch ( Throwable $error ) {
			$cleanup[] = $error->getMessage();
		}
		if ( null !== $primary ) {
			if ( ! empty( $cleanup ) ) {
				throw new RuntimeException( $primary->getMessage() . ';cleanup=' . implode( ',', $cleanup ), 0, $primary );
			}
			throw $primary;
		}
		if ( ! empty( $cleanup ) ) {
			throw new RuntimeException( 'v1_reader_cleanup_failed:' . implode( ',', $cleanup ) );
		}
		return $result;
	}

	/** @return string */
	private function isolation_level() {
		$sql = $this->is_mariadb() ? 'SELECT @@SESSION.tx_isolation' : 'SELECT @@SESSION.transaction_isolation';
		$value = strtoupper( str_replace( array( '_', ' ' ), '-', (string) $this->scalar( $sql ) ) );
		if ( ! in_array( $value, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new RuntimeException( 'v1_reader_isolation_probe_failed' );
		}
		return $value;
	}

	/**
	 * MariaDB exposes an SQL transaction-state variable; MySQL exposes the
	 * equivalent only through client protocol state. A null result therefore
	 * means that same-connection transaction commands are the authoritative
	 * proof for MySQL, not that the transaction is inactive.
	 *
	 * @return bool|null
	 */
	private function transaction_active() {
		return $this->is_mariadb() ? 1 === (int) $this->scalar( 'SELECT @@SESSION.in_transaction' ) : null;
	}

	/** @return bool */
	private function is_mariadb() {
		if ( null === $this->is_mariadb ) {
			$this->is_mariadb = false !== stripos( (string) $this->scalar( 'SELECT VERSION()' ), 'mariadb' );
		}
		return $this->is_mariadb;
	}

	/** @return int */
	private function current_connection_id() {
		$id = (int) $this->database->get_var( 'SELECT CONNECTION_ID()' );
		$this->assert_query( 'v1_reader_connection_unavailable' );
		if ( $id <= 0 ) {
			throw new RuntimeException( 'v1_reader_connection_unavailable' );
		}
		return $id;
	}

	/** @return mixed */
	private function scalar( $sql ) {
		$value = $this->database->get_var( $sql );
		$this->assert_query( 'v1_reader_query_failed' );
		$this->verify_connection();
		return $value;
	}

	/** @return array */
	private function rows( $sql ) {
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows = $this->database->get_results( $sql, $format );
		$this->assert_query( 'v1_reader_query_failed' );
		$this->verify_connection();
		if ( ! is_array( $rows ) ) {
			throw new RuntimeException( 'v1_reader_query_failed' );
		}
		return $rows;
	}

	/** @return void */
	private function execute( $sql, $error_code ) {
		$result = $this->database->query( $sql );
		$this->assert_query( $error_code );
		$this->verify_connection();
		if ( false === $result ) {
			throw new RuntimeException( $error_code );
		}
	}

	/** @return string */
	private function prepare() {
		$args = func_get_args();
		$sql  = array_shift( $args );
		$out  = $this->database->prepare( $sql, $args );
		if ( ! is_string( $out ) || '' === $out ) {
			throw new RuntimeException( 'v1_reader_prepare_failed' );
		}
		return $out;
	}

	/** @return void */
	private function verify_connection() {
		$id = (int) $this->database->get_var( 'SELECT CONNECTION_ID()' );
		$this->assert_query( 'v1_reader_connection_changed' );
		if ( $this->connection_id <= 0 || $id !== $this->connection_id ) {
			throw new RuntimeException( 'v1_reader_connection_changed' );
		}
	}

	/** @return void */
	private function assert_query( $error_code ) {
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error ) {
			throw new RuntimeException( $error_code );
		}
	}

	/** @return string */
	private function uuid_from_hex( $hex ) {
		if ( ! is_string( $hex ) || 1 !== preg_match( '/^[a-f0-9]{32}$/D', $hex ) ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_uuid_invalid' );
		}
		$binary = hex2bin( $hex );
		if ( false === $binary ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_uuid_invalid' );
		}
		return MMED_V1_Study_Week_Domain::binary_to_uuid( $binary );
	}

	/** @return array */
	private function failure( $reason_code ) {
		return array( 'ok' => false, 'reason_code' => $reason_code, 'plan' => null );
	}
}

/** Exact physical repository binding for commissioned generation 2. */
final class MMED_V1_Study_InnoDB_Repository implements MMED_V1_Study_Repository {

	/** @var object */
	private $database;

	/** @var MMED_V1_Study_Week_Current_Reader */
	private $reader;

	/** @var array|null */
	private $provenance;

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		$this->database   = $database;
		$this->reader     = new MMED_V1_Study_Week_Current_Reader( $database );
		$this->provenance = null;
	}

	/** @return string */
	public function binding_kind() {
		return 'commissioned' === $this->physical_provenance()['state']
			? MMED_V1_Study_Domain::BINDING_READY
			: MMED_V1_Study_Domain::BINDING_UNAVAILABLE;
	}

	/** @return array */
	public function store_provenance() {
		return $this->physical_provenance();
	}

	/** @return array */
	public function cutover_provenance( $owner_id ) {
		if ( ! is_int( $owner_id ) || $owner_id <= 0 || MMED_V1_Study_Domain::BINDING_READY !== $this->binding_kind() ) {
			return $this->unknown_cutover();
		}
		$result = $this->reader->load( $owner_id );
		if ( ! empty( $result['ok'] ) ) {
			return array(
				'state'              => MMED_V1_Study_Domain::TRUTH_PRESENT,
				'schema_version'     => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
				'watermark_evidence' => true,
			);
		}
		if ( 'no_truth' === ( $result['reason_code'] ?? null ) ) {
			return array(
				'state'              => MMED_V1_Study_Domain::TRUTH_ABSENT,
				'schema_version'     => null,
				'watermark_evidence' => false,
			);
		}
		return $this->unknown_cutover();
	}

	/** @return array */
	public function compatible_reader_versions() {
		return MMED_V1_Study_Domain::BINDING_READY === $this->binding_kind() ? array( '2' ) : array();
	}

	/** @return array */
	public function load( $owner_id, $reader_version ) {
		if (
			! is_int( $owner_id )
			|| $owner_id <= 0
			|| '2' !== $reader_version
			|| MMED_V1_Study_Domain::BINDING_READY !== $this->binding_kind()
		) {
			return array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null );
		}
		return $this->reader->load( $owner_id );
	}

	/** @return array */
	private function physical_provenance() {
		if ( is_array( $this->provenance ) ) {
			return $this->provenance;
		}
		$this->provenance = array( 'state' => 'unknown', 'store_id' => null, 'generation' => null );
		try {
			$parent = ( new MMED_V1_Study_Schema_Inspector( $this->database ) )->inspect();
			$week   = ( new MMED_V1_Study_Week_Schema_Inspector( $this->database ) )->inspect();
			if (
				empty( $parent['ok'] )
				|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $parent['state']
				|| empty( $week['ok'] )
				|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $week['state']
				|| ! $this->ledger_ready()
			) {
				return $this->provenance;
			}
			$tables = MMED_V1_Study_Schema::table_names( $this->database );
			$sql  = 'SELECT LOWER(HEX(g1.store_id)) AS store_hex, g1.writer_schema_version AS g1_schema,';
			$sql .= ' g1.current_reader_version AS g1_reader, g1.previous_reader_version AS g1_previous,';
			$sql .= ' LOWER(HEX(g1.manifest_hash)) AS g1_manifest, g1.activated_at AS g1_activated,';
			$sql .= ' g2.writer_schema_version AS g2_schema, g2.current_reader_version AS g2_reader,';
			$sql .= ' g2.previous_reader_version AS g2_previous, LOWER(HEX(g2.manifest_hash)) AS g2_manifest,';
			$sql .= ' g2.activated_at AS g2_activated, sg.gate_key, sg.current_generation, sg.gate_state, sg.commissioned_at';
			$sql .= " FROM `{$tables['store_gate']}` sg";
			$sql .= " INNER JOIN `{$tables['generations']}` g2 ON g2.store_id = sg.store_id AND g2.generation = sg.current_generation";
			$sql .= " INNER JOIN `{$tables['generations']}` g1 ON g1.store_id = sg.store_id AND g1.generation = 1";
			$sql .= ' WHERE sg.gate_key = 1 AND sg.current_generation = 2 AND sg.gate_state = %s';
			$rows = $this->rows( $this->prepare( $sql, 'ready' ) );
			if ( 1 !== count( $rows ) ) {
				return $this->provenance;
			}
			$row = $rows[0];
			if (
				MMED_V1_Study_Schema::SCHEMA_VERSION !== (string) ( $row['g1_schema'] ?? '' )
				|| MMED_V1_Study_Schema::CURRENT_READER_VERSION !== (string) ( $row['g1_reader'] ?? '' )
				|| null !== ( $row['g1_previous'] ?? null )
				|| MMED_V1_Study_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g1_manifest'] ?? '' )
				|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $row['g2_schema'] ?? '' )
				|| MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION !== (string) ( $row['g2_reader'] ?? '' )
				|| null !== ( $row['g2_previous'] ?? null )
				|| MMED_V1_Study_Week_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g2_manifest'] ?? '' )
				|| empty( $row['g1_activated'] )
				|| empty( $row['g2_activated'] )
				|| empty( $row['commissioned_at'] )
			) {
				return $this->provenance;
			}
			$store_id = $this->uuid_from_hex( $row['store_hex'] ?? null );
			$this->provenance = array( 'state' => 'commissioned', 'store_id' => $store_id, 'generation' => 2 );
		} catch ( Throwable $error ) {
			unset( $error );
		}
		return $this->provenance;
	}

	/** @return bool */
	private function ledger_ready() {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT migration_version, migration_id, LOWER(HEX(checksum)) AS checksum_hex, state, checkpoint, failure_code';
		$sql .= " FROM `{$tables['migrations']}` ORDER BY migration_version";
		$rows = $this->rows( $sql );
		$expected = array_merge(
			MMED_V1_Study_Schema::migrations( $this->database ),
			MMED_V1_Study_Week_Schema::migrations( $this->database )
		);
		if ( count( $rows ) !== count( $expected ) ) {
			return false;
		}
		foreach ( $expected as $index => $migration ) {
			$row = $rows[ $index ];
			if (
				(int) $migration['version'] !== (int) ( $row['migration_version'] ?? 0 )
				|| $migration['id'] !== (string) ( $row['migration_id'] ?? '' )
				|| $migration['checksum_hex'] !== (string) ( $row['checksum_hex'] ?? '' )
				|| 'applied' !== (string) ( $row['state'] ?? '' )
				|| ! in_array( (string) ( $row['checkpoint'] ?? '' ), array( 'verified', 'recovered_after_ddl' ), true )
				|| null !== ( $row['failure_code'] ?? null )
			) {
				return false;
			}
		}
		return true;
	}

	/** @return array */
	private function rows( $sql ) {
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows = $this->database->get_results( $sql, $format );
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error || ! is_array( $rows ) ) {
			throw new RuntimeException( 'v1_repository_read_failed' );
		}
		return $rows;
	}

	/** @return string */
	private function prepare() {
		$args = func_get_args();
		$sql  = array_shift( $args );
		$out  = $this->database->prepare( $sql, $args );
		if ( ! is_string( $out ) || '' === $out ) {
			throw new RuntimeException( 'v1_repository_prepare_failed' );
		}
		return $out;
	}

	/** @return string */
	private function uuid_from_hex( $hex ) {
		if ( ! is_string( $hex ) || 1 !== preg_match( '/^[a-f0-9]{32}$/D', $hex ) ) {
			throw new RuntimeException( 'v1_repository_store_invalid' );
		}
		$binary = hex2bin( $hex );
		if ( false === $binary ) {
			throw new RuntimeException( 'v1_repository_store_invalid' );
		}
		return MMED_V1_Study_Week_Domain::binary_to_uuid( $binary );
	}

	/** @return array */
	private function unknown_cutover() {
		return array(
			'state'              => MMED_V1_Study_Domain::TRUTH_UNKNOWN,
			'schema_version'     => null,
			'watermark_evidence' => false,
		);
	}
}
