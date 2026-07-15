<?php
/**
 * Synthetic-only generation-2 InnoDB command writer for 8010E E2.
 *
 * This file is intentionally unreachable from plugin runtime. It registers no
 * hook, route, filter, option, provider binding, installer, or Calendar SQL.
 * E3 must replace the synthetic fence with the shared Calendar/V1 transaction
 * arbiter before any protected runtime integration is considered.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Exact same-connection command repository for disposable synthetic stores. */
final class MMED_V1_Study_InnoDB_Command_Repository implements MMED_V1_Study_Command_Repository {

	const MAX_SNAPSHOT_BYTES = 2097152;
	const MAX_RECEIPT_BYTES = 262144;

	/** @var object */
	private $database;

	/** @var MMED_V1_Study_Command_Fence */
	private $fence;

	/** @var MMED_V1_Study_UUID_Source */
	private $uuid_source;

	/** @var callable|null */
	private $failpoint;

	/** @var int */
	private $connection_id = 0;

	/** @var bool|null */
	private $is_mariadb;

	/**
	 * @param object                         $database WordPress database connection.
	 * @param MMED_V1_Study_Command_Fence    $fence Synthetic-only lock seam.
	 * @param MMED_V1_Study_UUID_Source|null $uuid_source Optional deterministic test source.
	 * @param callable|null                  $failpoint Test-only pre-commit failure injector.
	 */
	public function __construct( $database, $fence, $uuid_source = null, $failpoint = null ) {
		if (
			! is_object( $database )
			|| ! method_exists( $database, 'query' )
			|| ! method_exists( $database, 'get_var' )
			|| ! method_exists( $database, 'get_results' )
			|| ! method_exists( $database, 'prepare' )
			|| ! $fence instanceof MMED_V1_Study_Command_Fence
			|| MMED_V1_Study_Command_Fence::SCOPE_SYNTHETIC_ISOLATED !== $fence->scope()
			|| ( null !== $uuid_source && ! $uuid_source instanceof MMED_V1_Study_UUID_Source )
			|| ( null !== $failpoint && ! is_callable( $failpoint ) )
		) {
			throw new InvalidArgumentException( 'V1 isolated command repository dependencies are invalid.' );
		}
		$this->database = $database;
		$this->fence = $fence;
		$this->uuid_source = null === $uuid_source ? new MMED_V1_Study_CSPRNG_UUID_Source() : $uuid_source;
		$this->failpoint = $failpoint;
		$this->is_mariadb = null;
	}

	/** @return array */
	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		$idempotency_key = $this->outer_idempotency_key( $candidate );
		$this->assert_identity( $owner_id, $actor_id, $actor_kind );
		$this->connection_id = $this->current_connection_id();
		$this->assert_clean_session();
		$this->assert_physical_provenance();
		MMED_V1_Study_Native_Session_Guard::assert_no_temporary_table_shadows(
			$this->database,
			$this->connection_id,
			array_merge(
				array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
				array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
			)
		);

		$started = false;
		try {
			$this->execute( 'START TRANSACTION READ WRITE', 'v1_command_begin_failed' );
			$started = true;
			if ( false === $this->transaction_active() ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_begin' );

			$this->lock_store_gate();
			$this->hit( 'after_gate_lock' );
			$this->assert_fence_result( $this->fence->lock_control_rows( $this->database, $this->connection_id, $owner_id ) );
			$this->verify_connection();
			$this->hit( 'after_control_lock' );

			$now = $this->trusted_timestamp();
			$this->insert_or_existing_plan( $owner_id, $now );
			$plan = $this->lock_plan( $owner_id );
			$this->hit( 'after_plan_lock' );

			$receipt = $this->receipt_by_idempotency( $owner_id, $idempotency_key, false );
			$normalized = null;
			$replay = false;
			if ( null !== $receipt ) {
				$this->assert_receipt_integrity( $receipt, $owner_id, null );
				try {
					$normalized = MMED_V1_Study_Week_Domain::normalize_command(
						$candidate,
						$owner_id,
						$actor_id,
						$actor_kind,
						$this->receipt_temporal_envelope( $receipt )
					);
				} catch ( Throwable $error ) {
					unset( $error );
					throw new MMED_V1_Study_Command_Exception( 'idempotency_conflict' );
				}
				if (
					! hash_equals( (string) $receipt['request_hash_hex'], $normalized['request_hash'] )
					|| ! hash_equals( (string) $receipt['request_json'], $normalized['request_json'] )
					|| (string) $receipt['actor_id'] !== (string) $actor_id
					|| 'learner' !== (string) $receipt['actor_kind']
					|| $normalized['command'] !== (string) $receipt['action']
				) {
					throw new MMED_V1_Study_Command_Exception( 'idempotency_conflict' );
				}
				$replay = true;
			} else {
				$normalized = MMED_V1_Study_Week_Domain::normalize_command( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
				if ( strlen( $normalized['request_json'] ) > self::MAX_RECEIPT_BYTES ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				$current_revision = $this->basic_plan_revision( $plan, $owner_id );
				if ( $normalized['expected_revision'] !== $current_revision ) {
					throw new MMED_V1_Study_Command_Exception( 'stale_revision' );
				}
			}

			$this->assert_fence_result( $this->fence->lock_calendar_rows( $this->database, $this->connection_id, $owner_id ) );
			$this->verify_connection();
			$this->hit( 'after_calendar_fence' );

			$domain_rows = $this->lock_domain_rows( $owner_id );
			$state = $this->assert_plan_state( $plan, $owner_id, $domain_rows['weeks'], $domain_rows['blocks'] );
			if ( '0' !== $state['revision'] ) {
				$this->assert_receipt_chain( $owner_id, $state );
			}
			$this->hit( 'after_domain_lock' );

			if ( $replay ) {
				$result = $this->decode_receipt_result( $receipt );
				$this->execute( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_command_commit_failed' );
				$started = false;
				$this->assert_transaction_ended();
				return $this->success( $result, true );
			}

			$ids = array(
				'plan_id'      => null === $state['plan_id'] ? $this->next_uuid() : $state['plan_id'],
				'week_id'      => $this->next_uuid(),
				'block_id'     => $this->next_uuid(),
				'operation_id' => $this->next_uuid(),
			);
			$reduced = MMED_V1_Study_Week_Command_State::apply(
				$normalized,
				$owner_id,
				$ids['plan_id'],
				$state['revision'],
				$domain_rows['weeks'],
				$domain_rows['blocks'],
				$ids,
				$now
			);
			$plan_json = MMED_V1_Study_Week_Domain::canonical_json( $reduced['snapshot'] );
			if ( strlen( $plan_json ) > self::MAX_SNAPSHOT_BYTES ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$plan_hash = hash( 'sha256', $plan_json );
			$result = array(
				'action'       => $normalized['command'],
				'block_id'     => $reduced['block_id'],
				'operation_id' => $ids['operation_id'],
				'plan_hash'    => $plan_hash,
				'revision'     => $reduced['next_revision'],
			);
			$result_json = MMED_V1_Study_Week_Domain::canonical_json( $result );
			if ( strlen( $result_json ) > self::MAX_RECEIPT_BYTES ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}

			$this->persist_reduction( $owner_id, $state, $normalized, $ids, $reduced, $plan_json, $plan_hash, $now );
			$this->hit( 'after_domain_write' );

			$verified_rows = $this->lock_domain_rows( $owner_id );
			$verified_snapshot = MMED_V1_Study_Week_Command_State::snapshot(
				$owner_id,
				$ids['plan_id'],
				$reduced['next_revision'],
				$verified_rows['weeks'],
				$verified_rows['blocks']
			);
			$verified_json = MMED_V1_Study_Week_Domain::canonical_json( $verified_snapshot );
			if ( ! hash_equals( $plan_json, $verified_json ) || ! hash_equals( $plan_hash, hash( 'sha256', $verified_json ) ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->assert_published_plan( $owner_id, $ids['plan_id'], $reduced['next_revision'], $plan_json, $plan_hash, $ids['operation_id'], $state['revision'], $now );
			$this->hit( 'after_snapshot_verify' );

			$this->insert_receipt( $owner_id, $actor_id, $normalized, $ids, $reduced['next_revision'], $plan_hash, $result_json, $now );
			$this->hit( 'after_receipt_write' );
			$stored = $this->receipt_by_idempotency( $owner_id, $idempotency_key, true );
			$this->assert_receipt_integrity( $stored, $owner_id, $ids['plan_id'] );
			if ( ! hash_equals( $result_json, (string) $stored['result_json'] ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'before_commit' );
			$this->execute( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_command_commit_failed' );
			$started = false;
			$this->assert_transaction_ended();
			return $this->success( $result, false );
		} catch ( Throwable $error ) {
			if ( $started ) {
				try {
					$this->execute( 'ROLLBACK AND NO CHAIN NO RELEASE', 'v1_command_rollback_failed' );
					$started = false;
					$this->assert_transaction_ended();
				} catch ( Throwable $rollback_error ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
			}
			throw $error;
		}
	}

	/** @return string */
	private function outer_idempotency_key( $candidate ) {
		if ( ! is_array( $candidate ) ) {
			throw new MMED_V1_Study_Command_Exception( 'command_body_shape' );
		}
		$keys = array_keys( $candidate );
		sort( $keys, SORT_STRING );
		if ( array( 'command', 'expected_revision', 'idempotency_key', 'payload' ) !== $keys ) {
			throw new MMED_V1_Study_Command_Exception( 'command_body_shape' );
		}
		$key = $candidate['idempotency_key'];
		if ( ! is_string( $key ) || strlen( $key ) < 16 || strlen( $key ) > 64 || 1 !== preg_match( '/^[A-Za-z0-9._:-]+$/D', $key ) ) {
			throw new MMED_V1_Study_Command_Exception( 'idempotency_key_invalid' );
		}
		return $key;
	}

	/** @return void */
	private function assert_identity( $owner_id, $actor_id, $actor_kind ) {
		if ( ! is_int( $owner_id ) || ! is_int( $actor_id ) || $owner_id <= 0 || $owner_id !== $actor_id || 'learner' !== $actor_kind ) {
			throw new MMED_V1_Study_Command_Exception( 'actor_owner_invalid' );
		}
	}

	/** @return void */
	private function assert_physical_provenance() {
		$repository = new MMED_V1_Study_InnoDB_Repository( $this->database );
		if ( MMED_V1_Study_Domain::BINDING_READY !== $repository->binding_kind() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->verify_connection();
	}

	/** @return void */
	private function assert_clean_session() {
		if (
			1 !== (int) $this->scalar( 'SELECT @@SESSION.autocommit' )
			|| true === $this->transaction_active()
			|| 0 !== (int) $this->scalar( $this->is_mariadb() ? 'SELECT @@SESSION.tx_read_only' : 'SELECT @@SESSION.transaction_read_only' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function lock_store_gate() {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT sg.gate_key, LOWER(HEX(sg.store_id)) AS gate_store_hex, CAST(sg.current_generation AS CHAR) AS current_generation,';
		$sql .= ' sg.gate_state, LOWER(HEX(g1.store_id)) AS g1_store_hex, g1.writer_schema_version AS g1_schema,';
		$sql .= ' g1.current_reader_version AS g1_reader, g1.previous_reader_version AS g1_previous, LOWER(HEX(g1.manifest_hash)) AS g1_manifest,';
		$sql .= ' LOWER(HEX(g2.store_id)) AS g2_store_hex, g2.writer_schema_version AS g2_schema,';
		$sql .= ' g2.current_reader_version AS g2_reader, g2.previous_reader_version AS g2_previous, LOWER(HEX(g2.manifest_hash)) AS g2_manifest';
		$sql .= " FROM `{$tables['store_gate']}` sg";
		$sql .= " INNER JOIN `{$tables['generations']}` g1 ON g1.store_id = sg.store_id AND g1.generation = 1";
		$sql .= " INNER JOIN `{$tables['generations']}` g2 ON g2.store_id = sg.store_id AND g2.generation = 2";
		$sql .= ' WHERE sg.gate_key = 1 LIMIT 2 LOCK IN SHARE MODE';
		$rows = $this->rows( $sql );
		if ( 1 !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$row = $rows[0];
		if (
			'2' !== (string) ( $row['current_generation'] ?? '' )
			|| 'ready' !== (string) ( $row['gate_state'] ?? '' )
			|| ! is_string( $row['gate_store_hex'] ?? null )
			|| ! hash_equals( (string) $row['gate_store_hex'], (string) ( $row['g1_store_hex'] ?? '' ) )
			|| ! hash_equals( (string) $row['gate_store_hex'], (string) ( $row['g2_store_hex'] ?? '' ) )
			|| MMED_V1_Study_Schema::SCHEMA_VERSION !== (string) ( $row['g1_schema'] ?? '' )
			|| MMED_V1_Study_Schema::CURRENT_READER_VERSION !== (string) ( $row['g1_reader'] ?? '' )
			|| null !== ( $row['g1_previous'] ?? null )
			|| MMED_V1_Study_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g1_manifest'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $row['g2_schema'] ?? '' )
			|| MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION !== (string) ( $row['g2_reader'] ?? '' )
			|| null !== ( $row['g2_previous'] ?? null )
			|| MMED_V1_Study_Week_Schema::manifest_hash_hex( $this->database ) !== (string) ( $row['g2_manifest'] ?? '' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function insert_or_existing_plan( $owner_id, $now ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = "INSERT INTO `{$tables['plans']}`";
		$sql .= ' (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at)';
		$sql .= ' SELECT %d, NULL, 2, NULL, 0, NULL, NULL, NULL, NULL, %s, %s';
		$sql .= " FROM `{$tables['generations']}` WHERE generation = 2";
		$this->verify_connection();
		$result = $this->database->query( $this->prepare( $sql, $owner_id, $now, $now ) );
		if ( false === $result ) {
			$handle = isset( $this->database->dbh ) ? $this->database->dbh : null;
			$errno = is_object( $handle ) && function_exists( 'mysqli_errno' ) ? (int) @mysqli_errno( $handle ) : 0;
			$sqlstate = is_object( $handle ) && function_exists( 'mysqli_sqlstate' ) ? (string) @mysqli_sqlstate( $handle ) : '';
			if ( 1062 !== $errno || '23000' !== $sqlstate ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->database->last_error = '';
			$this->verify_connection();
			return;
		}
		$this->assert_query( 'v1_command_plan_fence_failed' );
		$this->verify_connection();
		if ( 1 !== (int) $result ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return array */
	private function lock_plan( $owner_id ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex,';
		$sql .= ' CAST(store_generation AS CHAR) AS store_generation, schema_version, CAST(current_revision AS CHAR) AS current_revision,';
		$sql .= ' LOWER(HEX(watermark_operation_id)) AS watermark_hex, watermark_at,';
		$sql .= ' CASE WHEN OCTET_LENGTH(plan_json) <= ' . self::MAX_SNAPSHOT_BYTES . ' THEN plan_json ELSE NULL END AS plan_json,';
		$sql .= ' OCTET_LENGTH(plan_json) AS plan_bytes, LOWER(HEX(plan_hash)) AS plan_hash_hex, created_at, updated_at';
		$sql .= " FROM `{$tables['plans']}` WHERE owner_id = %d LIMIT 2 FOR UPDATE";
		$rows = $this->rows( $this->prepare( $sql, $owner_id ) );
		if ( 1 !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $rows[0];
	}

	/** @return string */
	private function basic_plan_revision( $plan, $owner_id ) {
		if (
			! is_array( $plan )
			|| (string) $owner_id !== (string) ( $plan['owner_id'] ?? '' )
			|| '2' !== (string) ( $plan['store_generation'] ?? '' )
			|| ! is_string( $plan['current_revision'] ?? null )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			return $revision;
		}
		if (
			MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $plan['schema_version'] ?? '' )
			|| ! $this->is_uuid_hex( $plan['plan_hex'] ?? null )
			|| ! $this->is_uuid_hex( $plan['watermark_hex'] ?? null )
			|| ! $this->valid_timestamp( $plan['watermark_at'] ?? null )
			|| ! is_string( $plan['plan_json'] ?? null )
			|| ! is_numeric( $plan['plan_bytes'] ?? null )
			|| (int) $plan['plan_bytes'] <= 0
			|| (int) $plan['plan_bytes'] > self::MAX_SNAPSHOT_BYTES
			|| ! $this->is_hash_hex( $plan['plan_hash_hex'] ?? null )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $revision;
	}

	/** @return array */
	private function lock_domain_rows( $owner_id ) {
		$week = MMED_V1_Study_Week_Schema::table_names( $this->database );
		$week_sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex, LOWER(HEX(week_id)) AS week_hex,';
		$week_sql .= ' week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version,';
		$week_sql .= ' LOWER(HEX(temporal_context_hash)) AS temporal_context_hash_hex,';
		$week_sql .= ' CAST(created_revision AS CHAR) AS created_revision, CAST(updated_revision AS CHAR) AS updated_revision, created_at, updated_at';
		$week_sql .= " FROM `{$week['weeks']}` WHERE owner_id = %d";
		$week_sql .= ' ORDER BY week_start_local, week_id LIMIT ' . ( MMED_V1_Study_Week_Command_State::MAX_WEEKS_PER_PLAN + 1 ) . ' FOR UPDATE';
		$weeks = $this->rows( $this->prepare( $week_sql, $owner_id ) );
		if ( count( $weeks ) > MMED_V1_Study_Week_Command_State::MAX_WEEKS_PER_PLAN ) {
			throw new MMED_V1_Study_Command_Exception( 'week_limit_exceeded' );
		}

		$block_sql  = 'SELECT CAST(b.owner_id AS CHAR) AS owner_id, LOWER(HEX(b.plan_id)) AS plan_hex, LOWER(HEX(b.week_id)) AS week_hex,';
		$block_sql .= ' w.week_start_local, LOWER(HEX(b.block_id)) AS block_hex, b.title, b.activity_type, b.activity_catalog_version,';
		$block_sql .= ' b.storage_codebook_version, CAST(b.family_code AS CHAR) AS family_code, CAST(b.state_code AS CHAR) AS state_code,';
		$block_sql .= ' CAST(b.priority_code AS CHAR) AS priority_code, LOWER(HEX(b.goal_ref_hash)) AS goal_ref_hash_hex, b.goal_source_version,';
		$block_sql .= ' CAST(b.source_code AS CHAR) AS source_code, LOWER(HEX(b.source_namespace_hash)) AS source_namespace_hash_hex,';
		$block_sql .= ' LOWER(HEX(b.source_ref_hash)) AS source_ref_hash_hex, LOWER(HEX(b.source_version_hash)) AS source_version_hash_hex,';
		$block_sql .= " DATE_FORMAT(b.start_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS start_at_utc,";
		$block_sql .= " DATE_FORMAT(b.end_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS end_at_utc,";
		$block_sql .= ' b.timezone, b.profile_version, b.tzdb_version, b.local_date, CAST(b.local_minute AS CHAR) AS local_minute,';
		$block_sql .= ' CAST(b.fold_code AS CHAR) AS fold_code, b.temporal_policy_version, LOWER(HEX(b.temporal_context_hash)) AS temporal_context_hash_hex,';
		$block_sql .= ' CAST(b.duration_minutes AS CHAR) AS duration_minutes, CAST(b.created_revision AS CHAR) AS created_revision,';
		$block_sql .= ' CAST(b.updated_revision AS CHAR) AS updated_revision, CAST(b.tombstoned_revision AS CHAR) AS tombstoned_revision,';
		$block_sql .= ' b.created_at, b.updated_at, b.tombstoned_at';
		$block_sql .= " FROM `{$week['blocks']}` b INNER JOIN `{$week['weeks']}` w";
		$block_sql .= ' ON w.owner_id = b.owner_id AND w.plan_id = b.plan_id AND w.week_id = b.week_id';
		$block_sql .= ' WHERE b.owner_id = %d ORDER BY b.week_id, b.block_id LIMIT ' . ( MMED_V1_Study_Week_Command_State::MAX_BLOCKS_PER_PLAN + 1 ) . ' FOR UPDATE';
		$blocks = $this->rows( $this->prepare( $block_sql, $owner_id ) );
		if ( count( $blocks ) > MMED_V1_Study_Week_Command_State::MAX_BLOCKS_PER_PLAN ) {
			throw new MMED_V1_Study_Command_Exception( 'block_limit_exceeded' );
		}
		return array( 'weeks' => $weeks, 'blocks' => $blocks );
	}

	/** @return array */
	private function assert_plan_state( $plan, $owner_id, $weeks, $blocks ) {
		$revision = $this->basic_plan_revision( $plan, $owner_id );
		if ( '0' === $revision ) {
			if ( ! empty( $weeks ) || ! empty( $blocks ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			return array(
				'plan_hash' => null,
				'plan_id'   => null,
				'plan_json' => null,
				'revision'  => '0',
				'watermark_at' => null,
				'watermark_id' => null,
			);
		}
		$plan_id = $this->uuid_from_hex( $plan['plan_hex'] );
		$snapshot = MMED_V1_Study_Week_Command_State::snapshot( $owner_id, $plan_id, $revision, $weeks, $blocks );
		$json = MMED_V1_Study_Week_Domain::canonical_json( $snapshot );
		if (
			! hash_equals( $json, (string) $plan['plan_json'] )
			|| ! hash_equals( hash( 'sha256', $json ), (string) $plan['plan_hash_hex'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return array(
			'plan_hash' => (string) $plan['plan_hash_hex'],
			'plan_id'   => $plan_id,
			'plan_json' => $json,
			'revision'  => $revision,
			'watermark_at' => (string) $plan['watermark_at'],
			'watermark_id' => $this->uuid_from_hex( $plan['watermark_hex'] ),
		);
	}

	/** @return array|null */
	private function receipt_by_idempotency( $owner_id, $idempotency_key, $for_update ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql = $this->receipt_select();
		$sql .= " FROM `{$tables['operations']}` WHERE owner_id = %d AND idempotency_key = %s LIMIT 2";
		$sql .= $for_update ? ' FOR UPDATE' : '';
		$rows = $this->rows( $this->prepare( $sql, $owner_id, $idempotency_key ) );
		if ( count( $rows ) > 1 ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return empty( $rows ) ? null : $rows[0];
	}

	/** @return array|null */
	private function receipt_by_operation( $operation_id ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql = $this->receipt_select();
		$sql .= " FROM `{$tables['operations']}` WHERE operation_id = UNHEX(%s) LIMIT 2 FOR UPDATE";
		$rows = $this->rows( $this->prepare( $sql, $this->uuid_hex( $operation_id ) ) );
		if ( 1 !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $rows[0];
	}

	/** @return array|null */
	private function receipt_by_revision( $owner_id, $plan_id, $revision ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql = $this->receipt_select();
		$sql .= " FROM `{$tables['operations']}` WHERE owner_id = %d AND plan_id = UNHEX(%s) AND revision = %s LIMIT 2 FOR UPDATE";
		$rows = $this->rows( $this->prepare( $sql, $owner_id, $this->uuid_hex( $plan_id ), $revision ) );
		if ( 1 !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $rows[0];
	}

	/** @return string */
	private function receipt_select() {
		$sql  = 'SELECT LOWER(HEX(operation_id)) AS operation_hex, CAST(owner_id AS CHAR) AS owner_id, LOWER(HEX(plan_id)) AS plan_hex,';
		$sql .= ' CAST(revision AS CHAR) AS revision, CAST(expected_revision AS CHAR) AS expected_revision, idempotency_key,';
		$sql .= ' CASE WHEN OCTET_LENGTH(request_json) <= ' . self::MAX_RECEIPT_BYTES . ' THEN request_json ELSE NULL END AS request_json,';
		$sql .= ' OCTET_LENGTH(request_json) AS request_bytes, LOWER(HEX(request_hash)) AS request_hash_hex, LOWER(SHA2(request_json, 256)) AS request_actual_hash_hex,';
		$sql .= ' CAST(actor_id AS CHAR) AS actor_id, actor_kind, action, CAST(store_generation AS CHAR) AS store_generation, schema_version,';
		$sql .= ' LOWER(HEX(plan_hash)) AS plan_hash_hex, CAST(result_status AS CHAR) AS result_status,';
		$sql .= ' CASE WHEN OCTET_LENGTH(result_json) <= ' . self::MAX_RECEIPT_BYTES . ' THEN result_json ELSE NULL END AS result_json,';
		$sql .= ' OCTET_LENGTH(result_json) AS result_bytes, LOWER(HEX(result_hash)) AS result_hash_hex, LOWER(SHA2(result_json, 256)) AS result_actual_hash_hex, committed_at';
		return $sql;
	}

	/** @return void */
	private function assert_receipt_integrity( $receipt, $owner_id, $plan_id ) {
		if ( ! is_array( $receipt ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$operation_id = $this->uuid_from_hex( $receipt['operation_hex'] ?? null );
		$receipt_plan_id = $this->uuid_from_hex( $receipt['plan_hex'] ?? null );
		$revision = MMED_V1_Study_Week_Domain::decimal_revision( (string) ( $receipt['revision'] ?? '' ) );
		$expected = MMED_V1_Study_Week_Domain::decimal_revision( (string) ( $receipt['expected_revision'] ?? '' ) );
		if (
			(string) $owner_id !== (string) ( $receipt['owner_id'] ?? '' )
			|| ( null !== $plan_id && $receipt_plan_id !== $plan_id )
			|| $revision !== MMED_V1_Study_Week_Domain::increment_revision( $expected )
			|| ! is_string( $receipt['idempotency_key'] ?? null )
			|| strlen( $receipt['idempotency_key'] ) < 16
			|| strlen( $receipt['idempotency_key'] ) > 64
			|| ! is_string( $receipt['request_json'] ?? null )
			|| ! is_numeric( $receipt['request_bytes'] ?? null )
			|| (int) $receipt['request_bytes'] <= 0
			|| (int) $receipt['request_bytes'] > self::MAX_RECEIPT_BYTES
			|| ! $this->is_hash_hex( $receipt['request_hash_hex'] ?? null )
			|| ! hash_equals( (string) $receipt['request_hash_hex'], (string) ( $receipt['request_actual_hash_hex'] ?? '' ) )
			|| (int) ( $receipt['actor_id'] ?? 0 ) <= 0
			|| 'learner' !== (string) ( $receipt['actor_kind'] ?? '' )
			|| ! in_array( (string) ( $receipt['action'] ?? '' ), MMED_V1_Study_Week_Domain::commands(), true )
			|| '2' !== (string) ( $receipt['store_generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $receipt['schema_version'] ?? '' )
			|| ! $this->is_hash_hex( $receipt['plan_hash_hex'] ?? null )
			|| 200 !== (int) ( $receipt['result_status'] ?? 0 )
			|| ! is_string( $receipt['result_json'] ?? null )
			|| ! is_numeric( $receipt['result_bytes'] ?? null )
			|| (int) $receipt['result_bytes'] <= 0
			|| (int) $receipt['result_bytes'] > self::MAX_RECEIPT_BYTES
			|| ! $this->is_hash_hex( $receipt['result_hash_hex'] ?? null )
			|| ! hash_equals( (string) $receipt['result_hash_hex'], (string) ( $receipt['result_actual_hash_hex'] ?? '' ) )
			|| ! $this->valid_timestamp( $receipt['committed_at'] ?? null )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}

		$request = json_decode( $receipt['request_json'], true );
		if (
			! is_array( $request )
			|| ! hash_equals( $receipt['request_json'], MMED_V1_Study_Week_Domain::canonical_json( $request ) )
			|| (string) $owner_id !== (string) ( $request['owner_id'] ?? '' )
			|| (string) ( $receipt['actor_id'] ?? '' ) !== (string) ( $request['actor_id'] ?? '' )
			|| 'learner' !== (string) ( $request['actor_kind'] ?? '' )
			|| (string) $receipt['action'] !== (string) ( $request['command'] ?? '' )
			|| $expected !== (string) ( $request['expected_revision'] ?? '' )
			|| MMED_V1_Study_Week_Domain::CONTRACT_VERSION !== (int) ( $request['contract_version'] ?? 0 )
			|| MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION !== (string) ( $request['activity_catalog']['version'] ?? '' )
			|| MMED_V1_Study_Week_Domain::activity_catalog_fingerprint() !== (string) ( $request['activity_catalog']['fingerprint'] ?? '' )
			|| MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION !== (string) ( $request['storage_codebook']['version'] ?? '' )
			|| MMED_V1_Study_Week_Domain::storage_codebook_fingerprint() !== (string) ( $request['storage_codebook']['fingerprint'] ?? '' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$result = $this->decode_receipt_result( $receipt );
		if (
			$operation_id !== $result['operation_id']
			|| $receipt_plan_id !== $this->uuid_from_hex( $receipt['plan_hex'] )
			|| $revision !== $result['revision']
			|| (string) $receipt['action'] !== $result['action']
			|| ! hash_equals( (string) $receipt['plan_hash_hex'], $result['plan_hash'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return array */
	private function receipt_temporal_envelope( $receipt ) {
		$request = json_decode( (string) ( $receipt['request_json'] ?? '' ), true );
		$temporal = is_array( $request ) && isset( $request['temporal'] ) && is_array( $request['temporal'] ) ? $request['temporal'] : null;
		if ( ! is_array( $temporal ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$rebuilt = MMED_V1_Study_Week_Domain::temporal_envelope(
			$temporal['week_start'] ?? null,
			$temporal['timezone'] ?? null,
			$temporal['profile_version'] ?? null,
			$temporal['tzdb_version'] ?? null
		);
		if ( MMED_V1_Study_Week_Domain::canonical_json( $rebuilt ) !== MMED_V1_Study_Week_Domain::canonical_json( $temporal ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $rebuilt;
	}

	/** @return array */
	private function decode_receipt_result( $receipt ) {
		$result = json_decode( (string) ( $receipt['result_json'] ?? '' ), true );
		if ( ! is_array( $result ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$keys = array_keys( $result );
		sort( $keys, SORT_STRING );
		if (
			array( 'action', 'block_id', 'operation_id', 'plan_hash', 'revision' ) !== $keys
			|| ! hash_equals( (string) $receipt['result_json'], MMED_V1_Study_Week_Domain::canonical_json( $result ) )
			|| ! in_array( $result['action'], MMED_V1_Study_Week_Domain::commands(), true )
			|| MMED_V1_Study_Week_Domain::uuid( $result['block_id'] ) !== $result['block_id']
			|| MMED_V1_Study_Week_Domain::uuid( $result['operation_id'] ) !== $result['operation_id']
			|| ! $this->is_hash_hex( $result['plan_hash'] )
			|| MMED_V1_Study_Week_Domain::decimal_revision( $result['revision'] ) !== $result['revision']
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $result;
	}

	/** @return void */
	private function assert_receipt_chain( $owner_id, $state ) {
		$watermark = $this->receipt_by_operation( $state['watermark_id'] );
		$current = $this->receipt_by_revision( $owner_id, $state['plan_id'], $state['revision'] );
		$this->assert_receipt_integrity( $watermark, $owner_id, $state['plan_id'] );
		$this->assert_receipt_integrity( $current, $owner_id, $state['plan_id'] );
		if (
			'1' !== (string) $watermark['revision']
			|| '0' !== (string) $watermark['expected_revision']
			|| $state['watermark_id'] !== $this->uuid_from_hex( $watermark['operation_hex'] )
			|| $state['watermark_at'] !== (string) $watermark['committed_at']
			|| $state['revision'] !== (string) $current['revision']
			|| ! hash_equals( $state['plan_hash'], (string) $current['plan_hash_hex'] )
			|| strcmp( (string) $current['committed_at'], $state['watermark_at'] ) < 0
			|| ( '1' === $state['revision'] && (string) $watermark['operation_hex'] !== (string) $current['operation_hex'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function persist_reduction( $owner_id, $state, $normalized, $ids, $reduced, $plan_json, $plan_hash, $now ) {
		$first = '0' === $state['revision'];
		if ( $first ) {
			$this->hit( 'before_plan_publish' );
			$this->publish_plan( $owner_id, $state, $ids, $reduced['next_revision'], $plan_json, $plan_hash, $now );
			$this->hit( 'after_plan_publish' );
		}

		$this->hit( 'before_week_write' );
		$this->write_week( $owner_id, $reduced['week_before'], $reduced['week_after'] );
		$this->hit( 'after_week_write' );
		$this->hit( 'before_block_write' );
		$this->write_block( $owner_id, $normalized['command'], $reduced['block_before'], $reduced['block_after'] );
		$this->hit( 'after_block_write' );

		if ( ! $first ) {
			$this->hit( 'before_plan_publish' );
			$this->publish_plan( $owner_id, $state, $ids, $reduced['next_revision'], $plan_json, $plan_hash, $now );
			$this->hit( 'after_plan_publish' );
		}
	}

	/** @return void */
	private function publish_plan( $owner_id, $state, $ids, $revision, $plan_json, $plan_hash, $now ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		if ( '0' === $state['revision'] ) {
			$sql  = "UPDATE `{$tables['plans']}` SET plan_id = UNHEX(%s), store_generation = 2, schema_version = %s,";
			$sql .= ' current_revision = %s, watermark_operation_id = UNHEX(%s), watermark_at = %s, plan_json = %s,';
			$sql .= ' plan_hash = UNHEX(%s), updated_at = %s';
			$sql .= ' WHERE owner_id = %d AND plan_id IS NULL AND store_generation = 2 AND schema_version IS NULL AND current_revision = 0';
			$sql .= ' AND watermark_operation_id IS NULL AND watermark_at IS NULL AND plan_json IS NULL AND plan_hash IS NULL';
			$prepared = $this->prepare(
				$sql,
				$this->uuid_hex( $ids['plan_id'] ),
				MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
				$revision,
				$this->uuid_hex( $ids['operation_id'] ),
				$now,
				$plan_json,
				$plan_hash,
				$now,
				$owner_id
			);
		} else {
			$sql  = "UPDATE `{$tables['plans']}` SET current_revision = %s, plan_json = %s, plan_hash = UNHEX(%s), updated_at = %s";
			$sql .= ' WHERE owner_id = %d AND plan_id = UNHEX(%s) AND store_generation = 2 AND schema_version = %s';
			$sql .= ' AND current_revision = %s AND plan_hash = UNHEX(%s) AND watermark_operation_id = UNHEX(%s) AND watermark_at = %s';
			$prepared = $this->prepare(
				$sql,
				$revision,
				$plan_json,
				$plan_hash,
				$now,
				$owner_id,
				$this->uuid_hex( $state['plan_id'] ),
				MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
				$state['revision'],
				$state['plan_hash'],
				$this->uuid_hex( $state['watermark_id'] ),
				$state['watermark_at']
			);
		}
		if ( 1 !== $this->execute_affected( $prepared, 'v1_command_plan_publish_failed' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function write_week( $owner_id, $before, $after ) {
		$tables = MMED_V1_Study_Week_Schema::table_names( $this->database );
		if ( null === $before ) {
			$sql  = "INSERT INTO `{$tables['weeks']}`";
			$sql .= ' (owner_id, plan_id, week_id, week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version,';
			$sql .= ' temporal_context_hash, created_revision, updated_revision, created_at, updated_at)';
			$sql .= ' VALUES (%d, UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %s, UNHEX(%s), %s, %s, %s, %s)';
			$prepared = $this->prepare(
				$sql,
				$owner_id,
				$after['plan_hex'],
				$after['week_hex'],
				$after['week_start_local'],
				$after['timezone'],
				$after['profile_version'],
				$after['tzdb_version'],
				$after['temporal_policy_version'],
				$after['temporal_context_hash_hex'],
				$after['created_revision'],
				$after['updated_revision'],
				$after['created_at'],
				$after['updated_at']
			);
		} else {
			$sql  = "UPDATE `{$tables['weeks']}` SET updated_revision = %s, updated_at = %s";
			$sql .= ' WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND week_start_local = %s';
			$sql .= ' AND updated_revision = %s AND temporal_context_hash = UNHEX(%s)';
			$prepared = $this->prepare(
				$sql,
				$after['updated_revision'],
				$after['updated_at'],
				$owner_id,
				$before['plan_hex'],
				$before['week_hex'],
				$before['week_start_local'],
				$before['updated_revision'],
				$before['temporal_context_hash_hex']
			);
		}
		if ( 1 !== $this->execute_affected( $prepared, 'v1_command_week_write_failed' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function write_block( $owner_id, $command, $before, $after ) {
		$tables = MMED_V1_Study_Week_Schema::table_names( $this->database );
		if ( null === $before ) {
			$sql  = "INSERT INTO `{$tables['blocks']}`";
			$sql .= ' (owner_id, plan_id, week_id, block_id, title, activity_type, activity_catalog_version, storage_codebook_version,';
			$sql .= ' family_code, state_code, priority_code, goal_ref_hash, goal_source_version, source_code, source_namespace_hash,';
			$sql .= ' source_ref_hash, source_version_hash, start_at_utc, end_at_utc, timezone, profile_version, tzdb_version, local_date,';
			$sql .= ' local_minute, fold_code, temporal_policy_version, temporal_context_hash, duration_minutes, created_revision,';
			$sql .= ' updated_revision, tombstoned_revision, created_at, updated_at, tombstoned_at)';
			$sql .= ' VALUES (%d, UNHEX(%s), UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %s, %s, %s, NULL, NULL, %s, NULL, NULL, NULL,';
			$sql .= ' %s, %s, %s, %s, %s, %s, %s, %s, %s, UNHEX(%s), %s, %s, %s, NULL, %s, %s, NULL)';
			$prepared = $this->prepare(
				$sql,
				$owner_id,
				$after['plan_hex'],
				$after['week_hex'],
				$after['block_hex'],
				$after['title'],
				$after['activity_type'],
				$after['activity_catalog_version'],
				$after['storage_codebook_version'],
				$after['family_code'],
				$after['state_code'],
				$after['priority_code'],
				$after['source_code'],
				$after['start_at_utc'],
				$after['end_at_utc'],
				$after['timezone'],
				$after['profile_version'],
				$after['tzdb_version'],
				$after['local_date'],
				$after['local_minute'],
				$after['fold_code'],
				$after['temporal_policy_version'],
				$after['temporal_context_hash_hex'],
				$after['duration_minutes'],
				$after['created_revision'],
				$after['updated_revision'],
				$after['created_at'],
				$after['updated_at']
			);
		} elseif ( MMED_V1_Study_Week_Domain::COMMAND_MOVE === $command ) {
			$sql  = "UPDATE `{$tables['blocks']}` SET start_at_utc = %s, end_at_utc = %s, local_date = %s, local_minute = %s,";
			$sql .= ' fold_code = %s, updated_revision = %s, updated_at = %s';
			$sql .= ' WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND block_id = UNHEX(%s)';
			$sql .= ' AND state_code = 1 AND updated_revision = %s';
			$prepared = $this->prepare( $sql, $after['start_at_utc'], $after['end_at_utc'], $after['local_date'], $after['local_minute'], $after['fold_code'], $after['updated_revision'], $after['updated_at'], $owner_id, $before['plan_hex'], $before['week_hex'], $before['block_hex'], $before['updated_revision'] );
		} elseif ( MMED_V1_Study_Week_Domain::COMMAND_RESIZE === $command ) {
			$sql  = "UPDATE `{$tables['blocks']}` SET end_at_utc = %s, duration_minutes = %s, updated_revision = %s, updated_at = %s";
			$sql .= ' WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND block_id = UNHEX(%s)';
			$sql .= ' AND state_code = 1 AND updated_revision = %s';
			$prepared = $this->prepare( $sql, $after['end_at_utc'], $after['duration_minutes'], $after['updated_revision'], $after['updated_at'], $owner_id, $before['plan_hex'], $before['week_hex'], $before['block_hex'], $before['updated_revision'] );
		} elseif ( MMED_V1_Study_Week_Domain::COMMAND_DELETE === $command ) {
			$sql  = "UPDATE `{$tables['blocks']}` SET state_code = 3, updated_revision = %s, tombstoned_revision = %s,";
			$sql .= ' updated_at = %s, tombstoned_at = %s';
			$sql .= ' WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND block_id = UNHEX(%s)';
			$sql .= ' AND state_code = 1 AND updated_revision = %s AND tombstoned_revision IS NULL AND tombstoned_at IS NULL';
			$prepared = $this->prepare( $sql, $after['updated_revision'], $after['tombstoned_revision'], $after['updated_at'], $after['tombstoned_at'], $owner_id, $before['plan_hex'], $before['week_hex'], $before['block_hex'], $before['updated_revision'] );
		} else {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( 1 !== $this->execute_affected( $prepared, 'v1_command_block_write_failed' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function insert_receipt( $owner_id, $actor_id, $normalized, $ids, $revision, $plan_hash, $result_json, $now ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = "INSERT INTO `{$tables['operations']}`";
		$sql .= ' (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash,';
		$sql .= ' actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at)';
		$sql .= ' VALUES (UNHEX(%s), %d, UNHEX(%s), %s, %s, %s, %s, UNHEX(%s), %d, %s, %s, 2, %s, UNHEX(%s), 200, %s, UNHEX(%s), %s)';
		$prepared = $this->prepare(
			$sql,
			$this->uuid_hex( $ids['operation_id'] ),
			$owner_id,
			$this->uuid_hex( $ids['plan_id'] ),
			$revision,
			$normalized['expected_revision'],
			$normalized['idempotency_key'],
			$normalized['request_json'],
			$normalized['request_hash'],
			$actor_id,
			'learner',
			$normalized['command'],
			MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
			$plan_hash,
			$result_json,
			hash( 'sha256', $result_json ),
			$now
		);
		if ( 1 !== $this->execute_affected( $prepared, 'v1_command_receipt_write_failed' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return void */
	private function assert_published_plan( $owner_id, $plan_id, $revision, $plan_json, $plan_hash, $operation_id, $prior_revision, $now ) {
		$plan = $this->lock_plan( $owner_id );
		if (
			(string) $owner_id !== (string) ( $plan['owner_id'] ?? '' )
			|| $this->uuid_from_hex( $plan['plan_hex'] ?? null ) !== $plan_id
			|| '2' !== (string) ( $plan['store_generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $plan['schema_version'] ?? '' )
			|| $revision !== (string) ( $plan['current_revision'] ?? '' )
			|| ! hash_equals( $plan_json, (string) ( $plan['plan_json'] ?? '' ) )
			|| ! hash_equals( $plan_hash, (string) ( $plan['plan_hash_hex'] ?? '' ) )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( '0' === $prior_revision ) {
			if ( $this->uuid_from_hex( $plan['watermark_hex'] ?? null ) !== $operation_id || (string) ( $plan['watermark_at'] ?? '' ) !== $now ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
		}
	}

	/** @return string */
	private function trusted_timestamp() {
		$value = $this->scalar( 'SELECT UTC_TIMESTAMP(6)' );
		if ( ! $this->valid_timestamp( $value ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $value;
	}

	/** @return string */
	private function next_uuid() {
		return MMED_V1_Study_Week_Domain::uuid( $this->uuid_source->next_uuid() );
	}

	/** @return void */
	private function hit( $name ) {
		if ( null !== $this->failpoint ) {
			call_user_func( $this->failpoint, (string) $name );
		}
	}

	/** @return void */
	private function assert_fence_result( $result ) {
		if ( true !== $result ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return array */
	private function success( $result, $replayed ) {
		return array(
			'ok'          => true,
			'reason_code' => 'ok',
			'replayed'    => (bool) $replayed,
			'result'      => $result,
			'status'      => 200,
		);
	}

	/** @return bool */
	private function transaction_active() {
		return MMED_V1_Study_Native_Session_Guard::transaction_active( $this->database, $this->connection_id, 'v1_command_transaction_probe_failed' );
	}

	/** @return void */
	private function assert_transaction_ended() {
		$this->verify_connection();
		if ( true === $this->transaction_active() || 1 !== (int) $this->scalar( 'SELECT @@SESSION.autocommit' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
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
		$id = $this->database->get_var( 'SELECT CONNECTION_ID()' );
		$this->assert_query( 'v1_command_connection_unavailable' );
		if ( null === $id || (int) $id <= 0 ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return (int) $id;
	}

	/** @return void */
	private function verify_connection() {
		if ( $this->connection_id <= 0 || $this->connection_id !== $this->current_connection_id() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return mixed */
	private function scalar( $sql ) {
		if ( $this->connection_id > 0 ) {
			$this->verify_connection();
		}
		$value = $this->database->get_var( $sql );
		$this->assert_query( 'v1_command_query_failed' );
		if ( $this->connection_id > 0 ) {
			$this->verify_connection();
		}
		return $value;
	}

	/** @return array */
	private function rows( $sql ) {
		$this->verify_connection();
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows = $this->database->get_results( $sql, $format );
		$this->assert_query( 'v1_command_query_failed' );
		$this->verify_connection();
		if ( ! is_array( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return int */
	private function execute_affected( $sql, $error_code ) {
		$this->verify_connection();
		$result = $this->database->query( $sql );
		$this->assert_query( $error_code );
		$this->verify_connection();
		if ( false === $result || ! is_int( $result ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $result;
	}

	/** @return string */
	private function prepare() {
		$args = func_get_args();
		$sql = array_shift( $args );
		$prepared = $this->database->prepare( $sql, $args );
		if ( ! is_string( $prepared ) || '' === $prepared ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $prepared;
	}

	/** @return void */
	private function assert_query( $error_code ) {
		unset( $error_code );
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return bool */
	private function valid_timestamp( $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}$/D', $value ) ) {
			return false;
		}
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $value, new DateTimeZone( 'UTC' ) );
		return $parsed instanceof DateTimeImmutable && $parsed->format( 'Y-m-d H:i:s.u' ) === $value;
	}

	/** @return bool */
	private function is_hash_hex( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[a-f0-9]{64}$/D', $value );
	}

	/** @return bool */
	private function is_uuid_hex( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/D', $value );
	}

	/** @return string */
	private function uuid_hex( $uuid ) {
		return str_replace( '-', '', MMED_V1_Study_Week_Domain::uuid( $uuid ) );
	}

	/** @return string */
	private function uuid_from_hex( $hex ) {
		if ( ! $this->is_uuid_hex( $hex ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$binary = hex2bin( $hex );
		if ( false === $binary ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return MMED_V1_Study_Week_Domain::binary_to_uuid( $binary );
	}
}
