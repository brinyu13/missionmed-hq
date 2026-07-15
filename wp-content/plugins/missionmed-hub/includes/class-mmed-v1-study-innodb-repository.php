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

/** Same-connection probes shared by physical provenance and current reads. */
final class MMED_V1_Study_Native_Session_Guard {

	/** Return whether the pinned native session is inside a transaction. */
	public static function transaction_active( $database, $connection_id, $error_code ) {
		try {
			$name = 'mmed_v1_reader_probe_' . bin2hex( random_bytes( 16 ) );
		} catch ( Throwable $error ) {
			throw new RuntimeException( $error_code, 0, $error );
		}
		$handle = self::handle( $database, $connection_id, $error_code );
		$failure = null;
		if ( true !== self::native_query( $handle, 'SAVEPOINT `' . $name . '`', $failure ) ) {
			self::handle( $database, $connection_id, $error_code );
			if ( 1305 === (int) ( $failure['errno'] ?? 0 ) && '42000' === (string) ( $failure['sqlstate'] ?? '' ) ) {
				return false;
			}
			throw new RuntimeException( $error_code );
		}
		self::handle( $database, $connection_id, $error_code );
		$rolled_back = self::native_query( $handle, 'ROLLBACK TO SAVEPOINT `' . $name . '`', $failure );
		if ( true === $rolled_back ) {
			self::handle( $database, $connection_id, $error_code );
			if ( true !== self::native_query( $handle, 'RELEASE SAVEPOINT `' . $name . '`', $failure ) ) {
				throw new RuntimeException( $error_code );
			}
			self::handle( $database, $connection_id, $error_code );
			return true;
		}
		$errno    = (int) ( $failure['errno'] ?? 0 );
		$sqlstate = (string) ( $failure['sqlstate'] ?? '' );
		self::handle( $database, $connection_id, $error_code );
		if ( 1305 === $errno && '42000' === $sqlstate ) {
			return false;
		}
		self::native_query( $handle, 'RELEASE SAVEPOINT `' . $name . '`', $failure );
		throw new RuntimeException( $error_code );
	}

	/** Prove non-destructively that no permanent table is hidden by a TEMPORARY table. */
	public static function assert_no_temporary_table_shadows( $database, $connection_id, $table_names ) {
		if ( ! is_array( $table_names ) ) {
			throw new RuntimeException( 'v1_reader_temporary_shadow_probe_failed' );
		}
		foreach ( array_values( array_unique( $table_names ) ) as $table_name ) {
			if ( ! is_string( $table_name ) || 1 !== preg_match( '/^[A-Za-z0-9_]{1,64}$/D', $table_name ) ) {
				throw new RuntimeException( 'v1_reader_temporary_shadow_probe_failed' );
			}
			$handle = self::handle( $database, $connection_id, 'v1_reader_temporary_shadow_probe_failed' );
			$failure = null;
			$result = self::native_query( $handle, "SHOW CREATE TABLE `{$table_name}`", $failure );
			if ( ! is_object( $result ) ) {
				throw new RuntimeException( 'v1_reader_temporary_shadow_probe_failed' );
			}
			$row = @mysqli_fetch_assoc( $result );
			@mysqli_free_result( $result );
			self::handle( $database, $connection_id, 'v1_reader_temporary_shadow_probe_failed' );
			$create = null;
			foreach ( is_array( $row ) ? $row : array() as $value ) {
				if ( is_string( $value ) && 1 === preg_match( '/^CREATE(?:\s+TEMPORARY)?\s+TABLE\b/iD', ltrim( $value ) ) ) {
					$create = ltrim( $value );
					break;
				}
			}
			if ( ! is_string( $create ) ) {
				throw new RuntimeException( 'v1_reader_temporary_shadow_probe_failed' );
			}
			if ( 1 === preg_match( '/^CREATE\s+TEMPORARY\s+TABLE\b/iD', $create ) ) {
				throw new RuntimeException( 'v1_reader_temporary_shadow_detected' );
			}
		}
	}

	/** Normalize native query failures even when a caller enables strict MySQLi reporting. */
	private static function native_query( $handle, $sql, &$failure ) {
		$failure = array( 'errno' => 0, 'sqlstate' => '' );
		try {
			$result = @mysqli_query( $handle, $sql );
		} catch ( Throwable $error ) {
			$failure['errno'] = (int) $error->getCode();
			$failure['sqlstate'] = method_exists( $error, 'getSqlState' )
				? (string) $error->getSqlState()
				: (string) @mysqli_sqlstate( $handle );
			return false;
		}
		if ( false === $result ) {
			$failure['errno'] = (int) @mysqli_errno( $handle );
			$failure['sqlstate'] = (string) @mysqli_sqlstate( $handle );
		}
		return $result;
	}

	/** Return the exact mysqli handle bound to the pinned connection. */
	private static function handle( $database, $connection_id, $error_code ) {
		$handle = is_object( $database ) && isset( $database->dbh ) ? $database->dbh : null;
		if (
			! is_object( $handle )
			|| ! function_exists( 'mysqli_thread_id' )
			|| ! function_exists( 'mysqli_query' )
			|| ! function_exists( 'mysqli_fetch_assoc' )
			|| ! function_exists( 'mysqli_free_result' )
			|| ! function_exists( 'mysqli_errno' )
			|| ! function_exists( 'mysqli_sqlstate' )
		) {
			throw new RuntimeException( $error_code );
		}
		$id = @mysqli_thread_id( $handle );
		if ( ! is_int( $id ) || $id !== (int) $connection_id ) {
			throw new RuntimeException( 'v1_reader_connection_changed' );
		}
		return $handle;
	}
}

/** Read one complete Plan through a single read-only consistent snapshot. */
final class MMED_V1_Study_Week_Current_Reader {

	const MAX_SNAPSHOT_BYTES = 2097152;
	const MAX_RECEIPT_BYTES = 262144;
	const MAX_WEEKS_PER_PLAN = 260;
	const MAX_BLOCKS_PER_PLAN = 4096;

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
		$sql .= ' watermark_at, CASE WHEN OCTET_LENGTH(plan_json) <= ' . self::MAX_SNAPSHOT_BYTES . ' THEN plan_json ELSE NULL END AS plan_json,';
		$sql .= ' LOWER(HEX(plan_hash)) AS plan_hash_hex, OCTET_LENGTH(plan_json) AS plan_bytes';
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
		$this->assert_current_receipt( $owner_id, $plan, $revision );

		$week_sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex, LOWER(HEX(week_id)) AS week_hex,';
		$week_sql .= ' week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version,';
		$week_sql .= ' LOWER(HEX(temporal_context_hash)) AS temporal_context_hash_hex,';
		$week_sql .= ' CAST(created_revision AS CHAR) AS created_revision, CAST(updated_revision AS CHAR) AS updated_revision';
		$week_sql .= " FROM `{$week['weeks']}` WHERE owner_id = %d AND plan_id = UNHEX(%s)";
		$week_sql .= ' ORDER BY week_start_local, week_id LIMIT ' . ( self::MAX_WEEKS_PER_PLAN + 1 );
		$week_rows = $this->rows( $this->prepare( $week_sql, $owner_id, $plan['plan_hex'] ) );
		if ( count( $week_rows ) > self::MAX_WEEKS_PER_PLAN ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_week_limit_exceeded' );
		}

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
		$block_sql .= ' WHERE b.owner_id = %d AND b.plan_id = UNHEX(%s) ORDER BY b.week_id, b.block_id LIMIT ' . ( self::MAX_BLOCKS_PER_PLAN + 1 );
		$block_rows = $this->rows( $this->prepare( $block_sql, $owner_id, $plan['plan_hex'] ) );
		if ( count( $block_rows ) > self::MAX_BLOCKS_PER_PLAN ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_block_limit_exceeded' );
		}

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

	/**
	 * Prove both immutable cutover watermark and latest-revision receipts.
	 * Both lookups run inside the same consistent snapshot as the Plan read.
	 *
	 * @return void
	 */
	private function assert_current_receipt( $owner_id, $plan, $revision ) {
		$watermark = $this->receipt_rows(
			'operation_id = UNHEX(%s)',
			array( $plan['watermark_hex'] )
		);
		$current = $this->receipt_rows(
			'owner_id = %d AND plan_id = UNHEX(%s) AND revision = %s',
			array( $owner_id, $plan['plan_hex'], $revision )
		);
		if ( 1 !== count( $watermark ) || 1 !== count( $current ) ) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_receipt_missing' );
		}
		$watermark = $watermark[0];
		$current = $current[0];
		$this->assert_receipt_shape( $watermark, $owner_id, $plan['plan_hex'] );
		$this->assert_receipt_shape( $current, $owner_id, $plan['plan_hex'] );
		if (
			(string) $plan['watermark_hex'] !== (string) $watermark['operation_hex']
			|| '1' !== MMED_V1_Study_Week_Domain::decimal_revision( $watermark['revision'] )
			|| '0' !== MMED_V1_Study_Week_Domain::decimal_revision( $watermark['expected_revision'] )
			|| (string) $plan['watermark_at'] !== (string) $watermark['committed_at']
			|| $revision !== MMED_V1_Study_Week_Domain::decimal_revision( $current['revision'] )
			|| $revision !== MMED_V1_Study_Week_Domain::increment_revision( $current['expected_revision'] )
			|| ! hash_equals( (string) $plan['plan_hash_hex'], (string) $current['plan_hash_hex'] )
			|| strcmp( (string) $current['committed_at'], (string) $plan['watermark_at'] ) < 0
			|| ( '1' === $revision && (string) $watermark['operation_hex'] !== (string) $current['operation_hex'] )
		) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_receipt_invalid' );
		}
	}

	/** @return array */
	private function receipt_rows( $where, $arguments ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT LOWER(HEX(operation_id)) AS operation_hex, CAST(owner_id AS CHAR) AS owner_id,';
		$sql .= ' LOWER(HEX(plan_id)) AS plan_hex, CAST(revision AS CHAR) AS revision,';
		$sql .= ' CAST(expected_revision AS CHAR) AS expected_revision, OCTET_LENGTH(idempotency_key) AS idempotency_bytes,';
		$sql .= ' OCTET_LENGTH(request_json) AS request_bytes, LOWER(HEX(request_hash)) AS request_hash_hex,';
		$sql .= ' LOWER(SHA2(request_json, 256)) AS request_actual_hash_hex, CAST(actor_id AS CHAR) AS actor_id,';
		$sql .= ' actor_kind, action, CAST(store_generation AS CHAR) AS store_generation, schema_version,';
		$sql .= ' LOWER(HEX(plan_hash)) AS plan_hash_hex, CAST(result_status AS CHAR) AS result_status,';
		$sql .= ' OCTET_LENGTH(result_json) AS result_bytes, LOWER(HEX(result_hash)) AS result_hash_hex,';
		$sql .= ' LOWER(SHA2(result_json, 256)) AS result_actual_hash_hex, committed_at';
		$sql .= " FROM `{$tables['operations']}` WHERE {$where} LIMIT 2";
		return $this->rows( $this->prepare( $sql, ...$arguments ) );
	}

	/** @return void */
	private function assert_receipt_shape( $receipt, $owner_id, $plan_hex ) {
		$this->uuid_from_hex( $receipt['operation_hex'] ?? null );
		$request_bytes = isset( $receipt['request_bytes'] ) && is_numeric( $receipt['request_bytes'] ) ? (int) $receipt['request_bytes'] : 0;
		$result_bytes = isset( $receipt['result_bytes'] ) && is_numeric( $receipt['result_bytes'] ) ? (int) $receipt['result_bytes'] : 0;
		$result_status = isset( $receipt['result_status'] ) && is_numeric( $receipt['result_status'] ) ? (int) $receipt['result_status'] : 0;
		if (
			(string) $owner_id !== (string) ( $receipt['owner_id'] ?? '' )
			|| (string) $plan_hex !== (string) ( $receipt['plan_hex'] ?? '' )
			|| (int) ( $receipt['idempotency_bytes'] ?? 0 ) < 16
			|| (int) ( $receipt['idempotency_bytes'] ?? 0 ) > 64
			|| $request_bytes <= 0
			|| $request_bytes > self::MAX_RECEIPT_BYTES
			|| $result_bytes <= 0
			|| $result_bytes > self::MAX_RECEIPT_BYTES
			|| ! is_string( $receipt['request_hash_hex'] ?? null )
			|| ! hash_equals( $receipt['request_hash_hex'], (string) ( $receipt['request_actual_hash_hex'] ?? '' ) )
			|| ! is_string( $receipt['result_hash_hex'] ?? null )
			|| ! hash_equals( $receipt['result_hash_hex'], (string) ( $receipt['result_actual_hash_hex'] ?? '' ) )
			|| (int) ( $receipt['actor_id'] ?? 0 ) <= 0
			|| '' === (string) ( $receipt['actor_kind'] ?? '' )
			|| '' === (string) ( $receipt['action'] ?? '' )
			|| '2' !== (string) ( $receipt['store_generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $receipt['schema_version'] ?? '' )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', (string) ( $receipt['plan_hash_hex'] ?? '' ) )
			|| $result_status < 200
			|| $result_status > 299
			|| ! is_string( $receipt['committed_at'] ?? null )
			|| '' === $receipt['committed_at']
		) {
			throw new MMED_V1_Study_Reader_Corruption( 'v1_reader_receipt_invalid' );
		}
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
		MMED_V1_Study_Native_Session_Guard::assert_no_temporary_table_shadows(
			$this->database,
			$this->connection_id,
			array_merge(
				array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
				array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
			)
		);
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

	/** @return bool */
	private function transaction_active() {
		return MMED_V1_Study_Native_Session_Guard::transaction_active(
			$this->database,
			$this->connection_id,
			'v1_reader_transaction_probe_failed'
		);
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
		$this->verify_connection();
		$value = $this->database->get_var( $sql );
		$this->assert_query( 'v1_reader_query_failed' );
		$this->verify_connection();
		return $value;
	}

	/** @return array */
	private function rows( $sql ) {
		$this->verify_connection();
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
		$this->verify_connection();
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

	/** @var int */
	private $connection_id;

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		$this->database      = $database;
		$this->connection_id = $this->read_connection_id();
		$this->reader        = new MMED_V1_Study_Week_Current_Reader( $database );
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
		$provenance = array( 'state' => 'unknown', 'store_id' => null, 'generation' => null );
		try {
			$this->assert_connection();
			if ( ! $this->session_is_clean() ) {
				return $provenance;
			}
			MMED_V1_Study_Native_Session_Guard::assert_no_temporary_table_shadows(
				$this->database,
				$this->connection_id,
				array_merge(
					array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
					array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
				)
			);
			$parent_inspector = new MMED_V1_Study_Schema_Inspector( $this->database );
			$parent = $parent_inspector->inspect();
			$this->assert_connection();
			$week   = ( new MMED_V1_Study_Week_Schema_Inspector( $this->database ) )->inspect();
			$this->assert_connection();
			$ledger_applied_at = $this->ledger_ready();
			if (
				empty( $parent['ok'] )
				|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $parent['state']
				|| empty( $week['ok'] )
				|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $week['state']
				|| false === $ledger_applied_at
				|| ! $this->owned_table_set_ready( $parent_inspector->schema_name() )
			) {
				return $provenance;
			}
			$tables = MMED_V1_Study_Schema::table_names( $this->database );
			$sql  = 'SELECT LOWER(HEX(g1.store_id)) AS store_hex, g1.writer_schema_version AS g1_schema,';
			$sql .= ' g1.current_reader_version AS g1_reader, g1.previous_reader_version AS g1_previous,';
			$sql .= ' LOWER(HEX(g1.manifest_hash)) AS g1_manifest, g1.activated_at AS g1_activated,';
			$sql .= ' g2.writer_schema_version AS g2_schema, g2.current_reader_version AS g2_reader,';
			$sql .= ' g2.previous_reader_version AS g2_previous, LOWER(HEX(g2.manifest_hash)) AS g2_manifest,';
			$sql .= ' g2.activated_at AS g2_activated, sg.gate_key, sg.current_generation, sg.gate_state, sg.commissioned_at,';
			$sql .= ' sg.updated_at AS gate_updated,';
			$sql .= " (SELECT COUNT(*) FROM `{$tables['generations']}`) AS generation_count,";
			$sql .= " (SELECT COUNT(*) FROM `{$tables['store_gate']}`) AS gate_count";
			$sql .= " FROM `{$tables['store_gate']}` sg";
			$sql .= " INNER JOIN `{$tables['generations']}` g2 ON g2.store_id = sg.store_id AND g2.generation = sg.current_generation";
			$sql .= " INNER JOIN `{$tables['generations']}` g1 ON g1.store_id = sg.store_id AND g1.generation = 1";
			$sql .= ' WHERE sg.gate_key = 1 AND sg.current_generation = 2 AND sg.gate_state = %s';
			$rows = $this->rows( $this->prepare( $sql, 'ready' ) );
			if ( 1 !== count( $rows ) ) {
				return $provenance;
			}
			$row = $rows[0];
			if (
				2 !== (int) ( $row['generation_count'] ?? 0 )
				|| 1 !== (int) ( $row['gate_count'] ?? 0 )
				|| MMED_V1_Study_Schema::SCHEMA_VERSION !== (string) ( $row['g1_schema'] ?? '' )
				|| MMED_V1_Study_Schema::CURRENT_READER_VERSION !== (string) ( $row['g1_reader'] ?? '' )
				|| null !== ( $row['g1_previous'] ?? null )
				|| MMED_V1_Study_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g1_manifest'] ?? '' )
				|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $row['g2_schema'] ?? '' )
				|| MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION !== (string) ( $row['g2_reader'] ?? '' )
				|| null !== ( $row['g2_previous'] ?? null )
				|| MMED_V1_Study_Week_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g2_manifest'] ?? '' )
				|| ! $this->valid_timestamp( $row['g1_activated'] ?? null )
				|| ! $this->valid_timestamp( $row['g2_activated'] ?? null )
				|| ! $this->valid_timestamp( $row['commissioned_at'] ?? null )
				|| ! $this->valid_timestamp( $row['gate_updated'] ?? null )
				|| (string) $row['commissioned_at'] !== (string) $row['g1_activated']
				|| strcmp( $row['g2_activated'], $row['commissioned_at'] ) < 0
				|| strcmp( $row['gate_updated'], $row['g2_activated'] ) < 0
				|| strcmp( $row['g2_activated'], $ledger_applied_at ) < 0
			) {
				return $provenance;
			}
			$store_id = $this->uuid_from_hex( $row['store_hex'] ?? null );
			$this->assert_connection();
			$provenance = array( 'state' => 'commissioned', 'store_id' => $store_id, 'generation' => 2 );
		} catch ( Throwable $error ) {
			unset( $error );
		}
		return $provenance;
	}

	/** @return string|false Latest exact applied timestamp, or false. */
	private function ledger_ready() {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$expected = array_merge(
			MMED_V1_Study_Schema::migrations( $this->database ),
			MMED_V1_Study_Week_Schema::migrations( $this->database )
		);
		$sql  = 'SELECT migration_version, migration_id, LOWER(HEX(checksum)) AS checksum_hex, state, checkpoint,';
		$sql .= ' attempt_count, LOWER(HEX(runner_id)) AS runner_hex, failure_code, started_at, applied_at, updated_at';
		$sql .= " FROM `{$tables['migrations']}` ORDER BY migration_version LIMIT " . ( count( $expected ) + 1 );
		$rows = $this->rows( $sql );
		if ( count( $rows ) !== count( $expected ) ) {
			return false;
		}
		$previous_applied_at = null;
		foreach ( $expected as $index => $migration ) {
			$row = $rows[ $index ];
			if (
				(int) $migration['version'] !== (int) ( $row['migration_version'] ?? 0 )
				|| $migration['id'] !== (string) ( $row['migration_id'] ?? '' )
				|| $migration['checksum_hex'] !== (string) ( $row['checksum_hex'] ?? '' )
				|| 'applied' !== (string) ( $row['state'] ?? '' )
				|| ! in_array( (string) ( $row['checkpoint'] ?? '' ), array( 'verified', 'recovered_after_ddl' ), true )
				|| (int) ( $row['attempt_count'] ?? 0 ) < 1
				|| 1 !== preg_match( '/^[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/D', (string) ( $row['runner_hex'] ?? '' ) )
				|| null !== ( $row['failure_code'] ?? null )
				|| ! $this->valid_timestamp( $row['started_at'] ?? null )
				|| ! $this->valid_timestamp( $row['applied_at'] ?? null )
				|| ! $this->valid_timestamp( $row['updated_at'] ?? null )
				|| strcmp( $row['applied_at'], $row['started_at'] ) < 0
				|| strcmp( $row['updated_at'], $row['applied_at'] ) < 0
				|| ( null !== $previous_applied_at && strcmp( $row['started_at'], $previous_applied_at ) < 0 )
			) {
				return false;
			}
			$previous_applied_at = $row['applied_at'];
		}
		return null === $previous_applied_at ? false : $previous_applied_at;
	}

	/** @return bool */
	private function owned_table_set_ready( $schema_name ) {
		$prefix = (string) $this->database->prefix . 'mmed_v1_study_';
		$expected = array_merge(
			array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
			array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
		);
		$sql  = 'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s';
		$sql .= ' AND LEFT(TABLE_NAME, CHAR_LENGTH(%s)) = %s ORDER BY TABLE_NAME LIMIT ' . ( count( $expected ) + 1 );
		$rows = $this->rows( $this->prepare( $sql, $schema_name, $prefix, $prefix ) );
		$actual = array();
		foreach ( $rows as $row ) {
			$actual[] = isset( $row['TABLE_NAME'] ) ? (string) $row['TABLE_NAME'] : '';
		}
		sort( $actual, SORT_STRING );
		sort( $expected, SORT_STRING );
		return $expected === $actual;
	}

	/** @return bool */
	private function valid_timestamp( $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}$/D', $value ) ) {
			return false;
		}
		$timestamp = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $value, new DateTimeZone( 'UTC' ) );
		return false !== $timestamp && $value === $timestamp->format( 'Y-m-d H:i:s.u' );
	}

	/** @return array */
	private function rows( $sql ) {
		$this->assert_connection();
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows = $this->database->get_results( $sql, $format );
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error || ! is_array( $rows ) ) {
			throw new RuntimeException( 'v1_repository_read_failed' );
		}
		$this->assert_connection();
		return $rows;
	}

	/** @return int */
	private function read_connection_id() {
		$id = $this->database->get_var( 'SELECT CONNECTION_ID()' );
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error || null === $id || (int) $id <= 0 ) {
			throw new RuntimeException( 'v1_repository_connection_unavailable' );
		}
		return (int) $id;
	}

	/** Return whether provenance may safely probe the current native session. */
	private function session_is_clean() {
		$this->assert_connection();
		$autocommit = $this->database->get_var( 'SELECT @@SESSION.autocommit' );
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error || null === $autocommit ) {
			throw new RuntimeException( 'v1_repository_session_probe_failed' );
		}
		$this->assert_connection();
		if ( 1 !== (int) $autocommit ) {
			return false;
		}
		return false === MMED_V1_Study_Native_Session_Guard::transaction_active(
			$this->database,
			$this->connection_id,
			'v1_repository_transaction_probe_failed'
		);
	}

	/** @return void */
	private function assert_connection() {
		if ( $this->connection_id !== $this->read_connection_id() ) {
			throw new RuntimeException( 'v1_repository_connection_changed' );
		}
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
