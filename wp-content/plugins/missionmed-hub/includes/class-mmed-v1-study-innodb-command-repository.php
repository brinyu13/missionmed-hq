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

	const CLOCK_SKEW_SECONDS = 5.0;
	const MAX_SNAPSHOT_BYTES = 2097152;
	const MAX_RECEIPT_BYTES = 262144;
	const RECEIPT_AUDIT_BATCH = 32;
	const MAX_RECEIPTS_PER_PLAN = 4096;

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

	/** @var object|null Exact native mysqli handle; reconnect is never followed. */
	private $native_handle;

	/** @var string|null Preflight store UUID hex bound to the locked gate. */
	private $provenance_store_hex;

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
			|| ! method_exists( $database, 'remove_placeholder_escape' )
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
		$this->native_handle = isset( $database->dbh ) && is_object( $database->dbh ) ? $database->dbh : null;
		$this->provenance_store_hex = null;
	}

	/** @return array */
	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		$idempotency_key = $this->outer_idempotency_key( $candidate );
		$this->assert_identity( $owner_id, $actor_id, $actor_kind );
		$this->connection_id = $this->current_connection_id();
		$this->assert_clean_session();
		$original_session_controls = $this->session_controls();
		$original_isolation = $this->isolation_level();
		$original_sql_mode = $this->native_sql_mode();
		$original_encoding = $this->session_encoding();
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
		$isolation_changed = false;
		$sql_mode_changed = false;
		$encoding_changed = false;
		try {
			$encoding_changed = true;
			$this->pin_session_encoding();
			$sql_mode_changed = true;
			$this->native_set_sql_mode( $this->hardened_sql_mode( $original_sql_mode ) );
			$this->assert_sql_mode_hardened();
			$isolation_changed = true;
			$this->execute( 'SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED', 'v1_command_isolation_failed' );
			if ( 'READ-COMMITTED' !== $this->isolation_level() ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->execute( 'START TRANSACTION READ WRITE', 'v1_command_begin_failed' );
			$started = true;
			if ( true !== $this->transaction_active() ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_begin' );

			$this->lock_store_gate();
			$this->assert_transaction_context();
			$this->lock_owned_metadata_and_ledger();
			$this->assert_in_transaction_provenance();
			$this->hit( 'after_gate_lock' );
			$this->invoke_fence( 'lock_control_rows', $owner_id );
			$this->hit( 'after_control_lock' );
			$this->assert_owner_restore_census( $owner_id );

			$placeholder_at = $this->trusted_timestamp();
			$this->insert_or_existing_plan( $owner_id, $placeholder_at );
			$plan = $this->lock_plan( $owner_id );
			$now = $this->trusted_timestamp();
			$this->hit( 'after_plan_lock' );

			$receipt = $this->receipt_by_idempotency( $owner_id, $idempotency_key, false );
			$normalized = null;
			$replay = false;
			if ( null !== $receipt ) {
				$this->assert_receipt_integrity( $receipt, $owner_id, null );
				$receipt_temporal = $this->receipt_temporal_envelope( $receipt );
				try {
					$normalized = MMED_V1_Study_Week_Domain::normalize_command(
						$candidate,
						$owner_id,
						$actor_id,
						$actor_kind,
						$receipt_temporal
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
				if ( strlen( $current_revision ) > 4 || (int) $current_revision >= self::MAX_RECEIPTS_PER_PLAN ) {
					throw new MMED_V1_Study_Command_Exception( 'revision_exhausted' );
				}
			}

			$this->invoke_fence( 'lock_calendar_rows', $owner_id );
			$this->hit( 'after_calendar_fence' );

			$domain_rows = $this->lock_domain_rows( $owner_id );
			$state = $this->trusted_plan_state( $plan, $owner_id, $domain_rows['weeks'], $domain_rows['blocks'] );
			if ( strcmp( $now, $state['updated_at'] ) < 0 ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$current_committed_at = null;
			if ( '0' !== $state['revision'] ) {
				$current_committed_at = $this->assert_receipt_chain( $owner_id, $state, $domain_rows['weeks'] );
				if ( strcmp( $now, $current_committed_at ) < 0 ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
			}
			$this->hit( 'after_domain_lock' );

			if ( $replay ) {
				if ( null === $state['plan_id'] ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				$this->assert_receipt_integrity( $receipt, $owner_id, $state['plan_id'] );
				$result = $this->decode_receipt_result( $receipt );
				$this->assert_session_integrity( true );
				$this->execute( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_command_commit_failed' );
				$started = false;
				$this->hit( 'after_commit' );
				$this->assert_transaction_ended();
				$this->restore_isolation( $original_isolation );
				$isolation_changed = false;
				$this->native_set_sql_mode( $original_sql_mode );
				if ( $original_sql_mode !== $this->native_sql_mode() ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				$sql_mode_changed = false;
				$this->restore_session_encoding( $original_encoding );
				$encoding_changed = false;
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
			try {
				$result = MMED_V1_Study_Week_Command_State::command_result(
					$reduced['snapshot'],
					$normalized['temporal']['week_start'],
					$this->learner_local_date( $now, $normalized['temporal']['timezone'] ),
					$normalized['command'],
					$reduced['block_id'],
					$ids['operation_id'],
					$plan_hash
				);
			} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
				unset( $error );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$result_json = MMED_V1_Study_Week_Domain::canonical_json( $result );
			if ( strlen( $result_json ) > self::MAX_RECEIPT_BYTES ) {
				throw new MMED_V1_Study_Command_Exception( 'block_limit_exceeded' );
			}

			$this->persist_reduction( $owner_id, $state, $normalized, $ids, $reduced, $plan_json, $plan_hash, $now );
			$this->hit( 'after_domain_write' );

			$verified_rows = $this->lock_domain_rows( $owner_id );
			$verified_current_block = null;
			foreach ( $verified_rows['blocks'] as $verified_block ) {
				if ( (string) ( $verified_block['block_hex'] ?? '' ) === (string) $reduced['block_after']['block_hex'] ) {
					$verified_current_block = $verified_block;
					break;
				}
			}
			if ( ! is_array( $verified_current_block ) ) {
				$this->hit( 'verified_block_missing' );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			foreach ( array( 'start_at_utc', 'end_at_utc' ) as $interval_field ) {
				$verified_interval = $verified_current_block[ $interval_field ] ?? null;
				if ( ! $this->valid_timestamp( $verified_interval ) ) {
					$length = is_string( $verified_interval ) ? strlen( $verified_interval ) : -1;
					$this->hit( 'verified_' . $interval_field . '_invalid_length_' . $length );
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				if ( ! hash_equals( (string) $reduced['block_after'][ $interval_field ], $verified_interval ) ) {
					$this->hit( 'verified_' . $interval_field . '_mismatch' );
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
			}
			try {
				$verified_snapshot = MMED_V1_Study_Week_Command_State::snapshot(
					$owner_id,
					$ids['plan_id'],
					$reduced['next_revision'],
					$verified_rows['weeks'],
					$verified_rows['blocks']
				);
			} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
				$this->hit( 'snapshot_rebuild_failed_' . $error->reason_code() );
				unset( $error );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_snapshot_rebuild' );
			$verified_json = MMED_V1_Study_Week_Domain::canonical_json( $verified_snapshot );
			if ( ! hash_equals( $plan_json, $verified_json ) || ! hash_equals( $plan_hash, hash( 'sha256', $verified_json ) ) ) {
				$this->hit( 'snapshot_mismatch' );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_snapshot_match' );
			$this->assert_published_plan( $owner_id, $ids['plan_id'], $reduced['next_revision'], $plan_json, $plan_hash, $ids['operation_id'], $state['revision'], $now );
			$this->hit( 'after_plan_verify' );
			$this->hit( 'after_snapshot_verify' );

			$this->insert_receipt( $owner_id, $actor_id, $normalized, $ids, $reduced['next_revision'], $plan_hash, $result_json, $now );
			$this->hit( 'after_receipt_write' );
			$stored = $this->receipt_by_idempotency( $owner_id, $idempotency_key, true );
			$this->hit( 'after_receipt_lookup' );
			$this->assert_receipt_integrity( $stored, $owner_id, $ids['plan_id'] );
			$this->hit( 'after_receipt_integrity' );
			if (
				! hash_equals( $result_json, (string) $stored['result_json'] )
				|| (string) $stored['committed_at'] !== $now
				|| ( null !== $state['watermark_at'] && strcmp( $now, $state['watermark_at'] ) < 0 )
			) {
				$this->hit( 'receipt_postcheck_failed' );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_receipt_postcheck' );
			$this->assert_session_integrity( true );
			$this->hit( 'before_commit' );
			$this->execute( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_command_commit_failed' );
			$started = false;
			$this->hit( 'after_commit' );
			$this->assert_transaction_ended();
			$this->restore_isolation( $original_isolation );
			$isolation_changed = false;
			$this->native_set_sql_mode( $original_sql_mode );
			if ( $original_sql_mode !== $this->native_sql_mode() ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$sql_mode_changed = false;
			$this->restore_session_encoding( $original_encoding );
			$encoding_changed = false;
			return $this->success( $result, false );
		} catch ( Throwable $error ) {
			$cleanup_failed = false;
			if ( $started ) {
				try {
					$this->execute( 'ROLLBACK AND NO CHAIN NO RELEASE', 'v1_command_rollback_failed' );
					$started = false;
					$this->assert_transaction_ended();
				} catch ( Throwable $rollback_error ) {
					unset( $rollback_error );
					$this->best_effort_detached_rollback();
					$cleanup_failed = true;
				}
			}
			if ( $isolation_changed ) {
				try {
					$this->restore_isolation( $original_isolation );
					$isolation_changed = false;
				} catch ( Throwable $isolation_error ) {
					unset( $isolation_error );
					$cleanup_failed = true;
				}
			}
			if ( $sql_mode_changed ) {
				try {
					$this->native_set_sql_mode( $original_sql_mode );
					if ( $original_sql_mode !== $this->native_sql_mode() ) {
						throw new RuntimeException( 'v1_command_sql_mode_restore_failed' );
					}
					$sql_mode_changed = false;
				} catch ( Throwable $sql_mode_error ) {
					unset( $sql_mode_error );
					$cleanup_failed = true;
				}
			}
			if ( $encoding_changed ) {
				try {
					$this->restore_session_encoding( $original_encoding );
					$encoding_changed = false;
				} catch ( Throwable $encoding_error ) {
					unset( $encoding_error );
					$cleanup_failed = true;
				}
			}
			try {
				$this->restore_session_controls( $original_session_controls );
				$this->assert_clean_session();
			} catch ( Throwable $session_error ) {
				unset( $session_error );
				$cleanup_failed = true;
			}
			if ( $cleanup_failed ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
		$provenance = $repository->store_provenance();
		if (
			'commissioned' !== (string) ( $provenance['state'] ?? '' )
			|| 2 !== (int) ( $provenance['generation'] ?? 0 )
			|| ! is_string( $provenance['store_id'] ?? null )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->provenance_store_hex = $this->uuid_hex( $provenance['store_id'] );
		$this->verify_connection();
	}

	/** @return void */
	private function assert_clean_session() {
		if ( 1 !== (int) $this->scalar( 'SELECT @@SESSION.autocommit' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( true === $this->transaction_active() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( 0 !== (int) $this->scalar( $this->is_mariadb() ? 'SELECT @@SESSION.tx_read_only' : 'SELECT @@SESSION.transaction_read_only' ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_session_integrity( false, false, false );
	}

	/**
	 * Acquire transaction-duration metadata locks for the complete owned store
	 * and shared locks for the immutable migration ledger. This closes the gap
	 * between preflight provenance and the first domain write without taking an
	 * application row lock out of the governed order.
	 *
	 * @return void
	 */
	private function lock_owned_metadata_and_ledger() {
		$tables = array_merge(
			array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
			array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
		);
		foreach ( array_values( array_unique( $tables ) ) as $table ) {
			if ( ! is_string( $table ) || 1 !== preg_match( '/^[A-Za-z0-9_]{1,64}$/D', $table ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->rows( "SELECT 1 AS v1_metadata_pin FROM `{$table}` WHERE 1 = 0 LOCK IN SHARE MODE" );
			$this->assert_transaction_context();
		}
		$kernel = MMED_V1_Study_Schema::table_names( $this->database );
		$expected = array_merge(
			MMED_V1_Study_Schema::migrations( $this->database ),
			MMED_V1_Study_Week_Schema::migrations( $this->database )
		);
		$rows = $this->rows(
			'SELECT migration_version, migration_id, LOWER(HEX(checksum)) AS checksum_hex, state, checkpoint,'
			. ' attempt_count, LOWER(HEX(runner_id)) AS runner_hex, failure_code, started_at, applied_at, updated_at'
			. " FROM `{$kernel['migrations']}` ORDER BY migration_version LIMIT "
			. ( count( $expected ) + 1 ) . ' LOCK IN SHARE MODE'
		);
		if ( count( $expected ) !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
				|| ! $this->is_uuid_hex( $row['runner_hex'] ?? null )
				|| null !== ( $row['failure_code'] ?? null )
				|| ! $this->valid_timestamp( $row['started_at'] ?? null )
				|| ! $this->valid_timestamp( $row['applied_at'] ?? null )
				|| ! $this->valid_timestamp( $row['updated_at'] ?? null )
				|| strcmp( $row['applied_at'], $row['started_at'] ) < 0
				|| strcmp( $row['updated_at'], $row['applied_at'] ) < 0
				|| ( null !== $previous_applied_at && strcmp( $row['started_at'], $previous_applied_at ) < 0 )
			) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$previous_applied_at = $row['applied_at'];
		}
		$this->assert_transaction_context();
	}

	/** Revalidate exact live table/trigger shapes while metadata locks are held. */
	private function assert_in_transaction_provenance() {
		$parent_inspector = new MMED_V1_Study_Schema_Inspector( $this->database );
		$parent = $parent_inspector->inspect();
		$week = ( new MMED_V1_Study_Week_Schema_Inspector( $this->database ) )->inspect();
		$this->verify_connection();
		$expected_tables = array_merge(
			array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
			array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) )
		);
		$prefix = (string) $this->database->prefix . 'mmed_v1_study_';
		$namespace_rows = $this->rows(
			$this->prepare(
				'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s'
				. ' AND LEFT(TABLE_NAME, CHAR_LENGTH(%s)) = %s ORDER BY TABLE_NAME LIMIT ' . ( count( $expected_tables ) + 1 ),
				$parent_inspector->schema_name(),
				$prefix,
				$prefix
			)
		);
		$actual_tables = array();
		foreach ( $namespace_rows as $row ) {
			$actual_tables[] = (string) ( $row['TABLE_NAME'] ?? '' );
		}
		sort( $expected_tables, SORT_STRING );
		sort( $actual_tables, SORT_STRING );
		if (
			empty( $parent['ok'] )
			|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== ( $parent['state'] ?? null )
			|| empty( $week['ok'] )
			|| MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== ( $week['state'] ?? null )
			|| $expected_tables !== $actual_tables
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_transaction_context();
	}

	/** Reject owner rows hidden by relationship joins before any Plan DML. */
	private function assert_owner_restore_census( $owner_id ) {
		foreach ( MMED_V1_Study_Restore_Census::owner_descriptors( $this->database, $owner_id ) as $descriptor ) {
			$sql = $this->prepare( $descriptor['sql'], ...$descriptor['arguments'] );
			if ( ! empty( $this->rows( $sql ) ) ) {
				$this->hit( 'restore_census_failed_' . $descriptor['reason'] );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->assert_transaction_context();
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
				|| ! is_string( $this->provenance_store_hex )
				|| ! hash_equals( $this->provenance_store_hex, (string) $row['gate_store_hex'] )
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
		$sql .= " FROM `{$tables['store_gate']}` sg INNER JOIN `{$tables['generations']}` g";
		$sql .= ' ON g.store_id = sg.store_id AND g.generation = 2 WHERE sg.gate_key = 1 AND sg.current_generation = 2 AND sg.gate_state = %s';
		$failure = null;
		$result = $this->native_query( $this->prepare( $sql, $owner_id, $now, $now, 'ready' ), $failure );
		if ( false === $result ) {
			if ( 1062 !== (int) ( $failure['errno'] ?? 0 ) || '23000' !== (string) ( $failure['sqlstate'] ?? '' ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$this->assert_transaction_context();
			return;
		}
		if ( true !== $result || 1 !== $this->native_affected_rows() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_transaction_context();
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
				|| ! in_array( (string) ( $plan['store_generation'] ?? '' ), array( '1', '2' ), true )
			|| ! is_string( $plan['current_revision'] ?? null )
			|| ! $this->valid_timestamp( $plan['created_at'] ?? null )
			|| ! $this->valid_timestamp( $plan['updated_at'] ?? null )
			|| strcmp( (string) $plan['created_at'], (string) $plan['updated_at'] ) > 0
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
				'2' !== (string) ( $plan['store_generation'] ?? '' )
				|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $plan['schema_version'] ?? '' )
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
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
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
				'updated_at' => (string) $plan['updated_at'],
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
			'updated_at' => (string) $plan['updated_at'],
			'watermark_at' => (string) $plan['watermark_at'],
			'watermark_id' => $this->uuid_from_hex( $plan['watermark_hex'] ),
		);
	}

	/** Reconstruct stored truth without allowing corruption to become a client 4xx. */
	private function trusted_plan_state( $plan, $owner_id, $weeks, $blocks ) {
		try {
			return $this->assert_plan_state( $plan, $owner_id, $weeks, $blocks );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			unset( $error );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
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

	/** @return array */
	private function assert_receipt_integrity( $receipt, $owner_id, $plan_id ) {
		try {
			return $this->assert_receipt_integrity_inner( $receipt, $owner_id, $plan_id );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			$this->hit( 'receipt_domain_failed_' . $error->reason_code() );
			unset( $error );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** Validate one stored receipt after provenance errors are contained. */
	private function assert_receipt_integrity_inner( $receipt, $owner_id, $plan_id ) {
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
		) {
			$this->hit( 'receipt_shape_failed_identity' );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if (
			! is_string( $receipt['request_json'] ?? null )
			|| ! is_numeric( $receipt['request_bytes'] ?? null )
			|| (int) $receipt['request_bytes'] <= 0
			|| (int) $receipt['request_bytes'] > self::MAX_RECEIPT_BYTES
			|| (int) $receipt['request_bytes'] !== strlen( $receipt['request_json'] )
			|| ! $this->is_hash_hex( $receipt['request_hash_hex'] ?? null )
			|| ! hash_equals( (string) $receipt['request_hash_hex'], (string) ( $receipt['request_actual_hash_hex'] ?? '' ) )
		) {
			$this->hit( 'receipt_shape_failed_request' );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if (
			(int) ( $receipt['actor_id'] ?? 0 ) <= 0
			|| 'learner' !== (string) ( $receipt['actor_kind'] ?? '' )
			|| ! in_array( (string) ( $receipt['action'] ?? '' ), MMED_V1_Study_Week_Domain::commands(), true )
			|| '2' !== (string) ( $receipt['store_generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $receipt['schema_version'] ?? '' )
			|| ! $this->is_hash_hex( $receipt['plan_hash_hex'] ?? null )
			|| 200 !== (int) ( $receipt['result_status'] ?? 0 )
		) {
			$this->hit( 'receipt_shape_failed_provenance' );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if (
			! is_string( $receipt['result_json'] ?? null )
			|| ! is_numeric( $receipt['result_bytes'] ?? null )
			|| (int) $receipt['result_bytes'] <= 0
			|| (int) $receipt['result_bytes'] > self::MAX_RECEIPT_BYTES
			|| (int) $receipt['result_bytes'] !== strlen( $receipt['result_json'] )
			|| ! $this->is_hash_hex( $receipt['result_hash_hex'] ?? null )
			|| ! hash_equals( (string) $receipt['result_hash_hex'], (string) ( $receipt['result_actual_hash_hex'] ?? '' ) )
		) {
			$this->hit( 'receipt_shape_failed_result' );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( ! $this->valid_timestamp( $receipt['committed_at'] ?? null ) ) {
			$this->hit( 'receipt_shape_failed_timestamp' );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->hit( 'receipt_shape_valid' );

		$request = json_decode( $receipt['request_json'], true );
		$temporal = $this->receipt_temporal_envelope_inner( $receipt );
		$candidate_payload = is_array( $request ) && isset( $request['payload'] ) && is_array( $request['payload'] ) ? $request['payload'] : null;
		if ( MMED_V1_Study_Week_Domain::COMMAND_CREATE === (string) ( $receipt['action'] ?? '' ) && is_array( $candidate_payload ) ) {
			unset( $candidate_payload['family'] );
		}
		$candidate = array(
			'idempotency_key' => $receipt['idempotency_key'],
			'expected_revision' => $request['expected_revision'] ?? null,
			'command' => $request['command'] ?? null,
			'payload' => $candidate_payload,
		);
		$normalized = MMED_V1_Study_Week_Domain::normalize_command(
			$candidate,
			$owner_id,
			(int) $receipt['actor_id'],
			(string) $receipt['actor_kind'],
			$temporal
		);
		$this->hit( 'receipt_request_normalized' );
		if (
			! is_array( $request )
			|| ! hash_equals( $receipt['request_json'], MMED_V1_Study_Week_Domain::canonical_json( $request ) )
			|| ! hash_equals( $receipt['request_json'], $normalized['request_json'] )
			|| ! hash_equals( (string) $receipt['request_hash_hex'], $normalized['request_hash'] )
			|| (string) $receipt['idempotency_key'] !== $normalized['idempotency_key']
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
		$this->hit( 'receipt_request_valid' );
		$result = $this->decode_receipt_result( $receipt );
		$this->hit( 'receipt_result_decoded' );
		if (
			$operation_id !== $result['operation_id']
			|| $revision !== $result['revision']
			|| (string) $receipt['action'] !== $result['action']
				|| ! hash_equals( (string) $receipt['plan_hash_hex'], $result['plan_hash'] )
				|| $receipt_plan_id !== (string) ( $result['week']['plan_id'] ?? '' )
				|| ( MMED_V1_Study_Week_Domain::COMMAND_CREATE !== $result['action'] && $result['block_id'] !== (string) ( $request['payload']['block_id'] ?? '' ) )
				|| (string) ( $request['temporal']['week_start'] ?? '' ) !== (string) ( $result['week']['week_start'] ?? '' )
				|| $result['today'] !== $this->learner_local_date( (string) $receipt['committed_at'], (string) ( $request['temporal']['timezone'] ?? '' ) )
			) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->hit( 'receipt_result_valid' );
		return array( 'normalized' => $normalized, 'result' => $result );
	}

	/** @return array */
	private function receipt_temporal_envelope( $receipt ) {
		try {
			return $this->receipt_temporal_envelope_inner( $receipt );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			unset( $error );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** Rebuild the immutable receipt envelope after provenance errors are contained. */
	private function receipt_temporal_envelope_inner( $receipt ) {
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
		try {
			$result = MMED_V1_Study_Week_Command_State::assert_command_result( $result );
		} catch ( Throwable $error ) {
			unset( $error );
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( ! hash_equals( (string) $receipt['result_json'], MMED_V1_Study_Week_Domain::canonical_json( $result ) ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $result;
	}

	/** @return string Current receipt commit timestamp. */
	private function assert_receipt_chain( $owner_id, $state, $week_rows ) {
		$this->assert_receipt_chain_summary( $owner_id, $state['plan_id'], $state['revision'], $week_rows );
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
				|| $state['updated_at'] !== (string) $current['committed_at']
				|| strcmp( (string) $current['committed_at'], $state['watermark_at'] ) < 0
			|| ( '1' === $state['revision'] && (string) $watermark['operation_hex'] !== (string) $current['operation_hex'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return (string) $current['committed_at'];
	}

	/** Prove the append-only owner receipt namespace is contiguous and hash-intact. */
	private function assert_receipt_chain_summary( $owner_id, $plan_id, $revision, $week_rows ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT CAST(COUNT(*) AS CHAR) AS receipt_count, CAST(COALESCE(MIN(revision), 0) AS CHAR) AS minimum_revision,';
		$sql .= ' CAST(COALESCE(MAX(revision), 0) AS CHAR) AS maximum_revision,';
		$sql .= ' CAST(COALESCE(SUM(CASE WHEN plan_id <> UNHEX(%s) OR revision <> expected_revision + 1';
		$sql .= ' OR store_generation <> 2 OR schema_version <> %s OR result_status <> 200 OR actor_kind <> %s OR actor_id <> owner_id';
		$sql .= ' OR action NOT IN (%s, %s, %s, %s) OR OCTET_LENGTH(idempotency_key) NOT BETWEEN 16 AND 64';
		$sql .= ' OR OCTET_LENGTH(request_json) NOT BETWEEN 1 AND ' . self::MAX_RECEIPT_BYTES;
		$sql .= ' OR OCTET_LENGTH(result_json) NOT BETWEEN 1 AND ' . self::MAX_RECEIPT_BYTES;
		$sql .= ' OR JSON_VALID(request_json) <> 1 OR JSON_VALID(result_json) <> 1';
		$sql .= ' OR request_hash <> UNHEX(SHA2(request_json, 256)) OR result_hash <> UNHEX(SHA2(result_json, 256))';
		$sql .= ' THEN 1 ELSE 0 END), 0) AS CHAR) AS invalid_rows';
		$sql .= " FROM `{$tables['operations']}` WHERE owner_id = %d";
		$rows = $this->rows(
			$this->prepare(
				$sql,
				$this->uuid_hex( $plan_id ),
				MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
				'learner',
				MMED_V1_Study_Week_Domain::COMMAND_CREATE,
				MMED_V1_Study_Week_Domain::COMMAND_MOVE,
				MMED_V1_Study_Week_Domain::COMMAND_RESIZE,
				MMED_V1_Study_Week_Domain::COMMAND_DELETE,
				$owner_id
			)
		);
		if (
			1 !== count( $rows )
			|| $revision !== (string) ( $rows[0]['receipt_count'] ?? '' )
			|| '1' !== (string) ( $rows[0]['minimum_revision'] ?? '' )
			|| $revision !== (string) ( $rows[0]['maximum_revision'] ?? '' )
			|| '0' !== (string) ( $rows[0]['invalid_rows'] ?? '' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$regressions = $this->scalar(
			$this->prepare(
				"SELECT COUNT(*) FROM `{$tables['operations']}` current_receipt INNER JOIN `{$tables['operations']}` prior_receipt"
				. ' ON prior_receipt.owner_id = current_receipt.owner_id AND prior_receipt.revision = current_receipt.expected_revision'
				. ' WHERE current_receipt.owner_id = %d AND current_receipt.revision > 1'
				. ' AND current_receipt.committed_at < prior_receipt.committed_at',
				$owner_id
			)
		);
		if ( '0' !== (string) $regressions ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_receipt_chain_rows( $owner_id, $plan_id, $revision, $week_rows );
		$this->assert_transaction_context();
	}

	/** Deep-validate every bounded receipt so self-consistent semantic tampering cannot hide between endpoints. */
	private function assert_receipt_chain_rows( $owner_id, $plan_id, $revision, $week_rows ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		if ( strlen( $revision ) > 4 || (int) $revision < 1 || (int) $revision > self::MAX_RECEIPTS_PER_PLAN ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$expected_count = (int) $revision;
		$validated = 0;
		$previous_committed_at = null;
		$replayed_weeks = array();
		while ( $validated < $expected_count ) {
			$sql = $this->receipt_select();
			$sql .= " FROM `{$tables['operations']}` WHERE owner_id = %d AND revision > %d";
			$sql .= ' ORDER BY revision LIMIT ' . self::RECEIPT_AUDIT_BATCH . ' FOR UPDATE';
			$rows = $this->rows( $this->prepare( $sql, $owner_id, $validated ) );
			if ( empty( $rows ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			foreach ( $rows as $receipt ) {
				++$validated;
				if (
					(string) $validated !== (string) ( $receipt['revision'] ?? '' )
					|| (string) ( $validated - 1 ) !== (string) ( $receipt['expected_revision'] ?? '' )
					|| ( null !== $previous_committed_at && strcmp( (string) ( $receipt['committed_at'] ?? '' ), $previous_committed_at ) < 0 )
				) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				$validated_receipt = $this->assert_receipt_integrity( $receipt, $owner_id, $plan_id );
				try {
					$this->assert_receipt_transition(
						$validated_receipt['normalized'],
						$validated_receipt['result'],
						$plan_id,
						$replayed_weeks
					);
				} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
					unset( $error );
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
				$previous_committed_at = (string) $receipt['committed_at'];
			}
		}
		if ( $validated !== $expected_count ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_replayed_week_provenance( $replayed_weeks, $week_rows, $owner_id, $plan_id );
		$this->assert_transaction_context();
	}

	/** Bind replayed historic temporal envelopes to the final locked Week provenance rows. */
	private function assert_replayed_week_provenance( $replayed_weeks, $week_rows, $owner_id, $plan_id ) {
		if ( ! is_array( $replayed_weeks ) || ! is_array( $week_rows ) || count( $replayed_weeks ) !== count( $week_rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$plan_hex = $this->uuid_hex( $plan_id );
		foreach ( $week_rows as $row ) {
			$week_start = (string) ( $row['week_start_local'] ?? '' );
			$known = $replayed_weeks[ $week_start ] ?? null;
			if (
				! is_array( $known )
				|| (string) $owner_id !== (string) ( $row['owner_id'] ?? '' )
				|| $plan_hex !== (string) ( $row['plan_hex'] ?? '' )
				|| $this->uuid_from_hex( $row['week_hex'] ?? null ) !== (string) ( $known['week']['week_id'] ?? '' )
				|| MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION !== (string) ( $row['temporal_policy_version'] ?? '' )
			) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$temporal = MMED_V1_Study_Week_Domain::temporal_envelope(
				$week_start,
				$row['timezone'] ?? null,
				$row['profile_version'] ?? null,
				$row['tzdb_version'] ?? null
			);
			if (
				! hash_equals( (string) ( $row['temporal_context_hash_hex'] ?? '' ), $temporal['context'] )
				|| MMED_V1_Study_Week_Domain::canonical_json( $known['temporal'] ) !== MMED_V1_Study_Week_Domain::canonical_json( $temporal )
			) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
		}
	}

	/** Replay one historic learner transition and bind its full Plan hash. */
	private function assert_receipt_transition( $normalized, $result, $plan_id, &$weeks ) {
		if ( ! is_array( $normalized ) || ! is_array( $result ) || ! is_array( $weeks ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$revision = (string) $result['revision'];
		foreach ( $weeks as $known_start => $known ) {
			if ( ! is_array( $known ) || ! is_array( $known['week'] ?? null ) || ! is_array( $known['temporal'] ?? null ) ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$known['week'] = $this->rebase_receipt_week( $known['week'], $revision );
			$weeks[ $known_start ] = $known;
		}
		$week_start = (string) $normalized['temporal']['week_start'];
		$actual = $result['week'];
		if (
			$plan_id !== (string) ( $actual['plan_id'] ?? '' )
			|| $week_start !== (string) ( $actual['week_start'] ?? '' )
			|| $revision !== (string) ( $actual['revision'] ?? '' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$command = $normalized['command'];
		$payload = $normalized['payload'];
		$prior = $weeks[ $week_start ] ?? null;
		if (
			null !== $prior
			&& MMED_V1_Study_Week_Domain::canonical_json( $prior['temporal'] ) !== MMED_V1_Study_Week_Domain::canonical_json( $normalized['temporal'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( MMED_V1_Study_Week_Domain::COMMAND_CREATE === $command ) {
			$expected_blocks = null === $prior ? array() : $prior['week']['blocks'];
			if ( null !== $prior && (string) $prior['week']['week_id'] !== (string) $actual['week_id'] ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			foreach ( $expected_blocks as $existing ) {
				if ( $result['block_id'] === (string) ( $existing['block_id'] ?? '' ) ) {
					throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
				}
			}
			$expected_blocks[] = array(
				'activity_type' => $payload['activity_type'],
				'block_id' => $result['block_id'],
				'duration_minutes' => $payload['duration_minutes'],
				'family' => $payload['family'],
				'fold' => null === $payload['fold'] ? 'normal' : $payload['fold'],
				'goal_linked' => false,
				'local_date' => $payload['local_date'],
				'local_time' => $payload['local_time'],
				'priority' => $payload['priority'],
				'state' => MMED_V1_Study_Week_Domain::STATE_FLEXIBLE,
				'title' => $payload['title'],
			);
			$expected = $this->receipt_week_model( $plan_id, (string) $actual['week_id'], $week_start, $revision, $expected_blocks );
		} else {
			if ( null === $prior || (string) $prior['week']['week_id'] !== (string) $actual['week_id'] ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$expected_blocks = $prior['week']['blocks'];
			$target_index = null;
			foreach ( $expected_blocks as $index => $block ) {
				if ( $result['block_id'] === (string) ( $block['block_id'] ?? '' ) ) {
					if ( null !== $target_index ) {
						throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
					}
					$target_index = $index;
				}
			}
			if ( null === $target_index || MMED_V1_Study_Week_Domain::STATE_FLEXIBLE !== (string) $expected_blocks[ $target_index ]['state'] ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			MMED_V1_Study_Week_Domain::assert_mutation_target( $command, $expected_blocks[ $target_index ], $payload );
			if ( MMED_V1_Study_Week_Domain::COMMAND_MOVE === $command ) {
				$expected_blocks[ $target_index ]['local_date'] = $payload['local_date'];
				$expected_blocks[ $target_index ]['local_time'] = $payload['local_time'];
				$expected_blocks[ $target_index ]['fold'] = null === $payload['fold'] ? 'normal' : $payload['fold'];
			} elseif ( MMED_V1_Study_Week_Domain::COMMAND_RESIZE === $command ) {
				$expected_blocks[ $target_index ]['duration_minutes'] = $payload['duration_minutes'];
			} elseif ( MMED_V1_Study_Week_Domain::COMMAND_DELETE === $command ) {
				$expected_blocks[ $target_index ]['state'] = MMED_V1_Study_Week_Domain::STATE_TOMBSTONE;
			} else {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$expected = $this->receipt_week_model( $plan_id, (string) $prior['week']['week_id'], $week_start, $revision, $expected_blocks );
		}
		$this->assert_receipt_week_collision_free( $expected, $normalized['temporal'] );
		if ( MMED_V1_Study_Week_Domain::canonical_json( $expected ) !== MMED_V1_Study_Week_Domain::canonical_json( $actual ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$weeks[ $week_start ] = array( 'week' => $actual, 'temporal' => $normalized['temporal'] );
		$plan_weeks = array();
		foreach ( $weeks as $known ) {
			$plan_weeks[] = $known['week'];
		}
		usort(
			$plan_weeks,
			static function ( $left, $right ) {
				$start = strcmp( (string) $left['week_start'], (string) $right['week_start'] );
				return 0 !== $start ? $start : strcmp( (string) $left['week_id'], (string) $right['week_id'] );
			}
		);
		$snapshot = array(
			'plan_id' => $plan_id,
			'revision' => $revision,
			'schema_version' => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
			'weeks' => $plan_weeks,
		);
		if ( ! hash_equals( $result['plan_hash'], hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $snapshot ) ) ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** Rebase an unchanged historic Week to the next Plan revision. */
	private function rebase_receipt_week( $week, $revision ) {
		if ( ! is_array( $week ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $this->receipt_week_model(
			(string) ( $week['plan_id'] ?? '' ),
			(string) ( $week['week_id'] ?? '' ),
			(string) ( $week['week_start'] ?? '' ),
			$revision,
			$week['blocks'] ?? null
		);
	}

	/** Build the exact public Week hash envelope from replayed block state. */
	private function receipt_week_model( $plan_id, $week_id, $week_start, $revision, $blocks ) {
		if ( ! is_array( $blocks ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		usort(
			$blocks,
			static function ( $left, $right ) {
				return strcmp( (string) ( $left['block_id'] ?? '' ), (string) ( $right['block_id'] ?? '' ) );
			}
		);
		$model = array(
			'blocks' => array_values( $blocks ),
			'plan_id' => MMED_V1_Study_Week_Domain::uuid( $plan_id ),
			'revision' => MMED_V1_Study_Week_Domain::decimal_revision( $revision ),
			'week_id' => MMED_V1_Study_Week_Domain::uuid( $week_id ),
			'week_start' => $week_start,
		);
		$model['projection_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $model ) );
		MMED_V1_Study_Week_Domain::derive_mission( $model, $week_start );
		return $model;
	}

	/** Recheck active interval collisions while replaying one Week transition. */
	private function assert_receipt_week_collision_free( $week, $temporal ) {
		$intervals = array();
		foreach ( $week['blocks'] as $block ) {
			if ( MMED_V1_Study_Week_Domain::STATE_TOMBSTONE === $block['state'] ) {
				continue;
			}
			$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope(
				$block['local_date'],
				$block['local_time'],
				$block['duration_minutes'],
				'normal' === $block['fold'] ? null : $block['fold'],
				$temporal
			);
			$intervals[] = array( $slot['start_at_utc'], $slot['end_at_utc'], $block['block_id'] );
		}
		usort(
			$intervals,
			static function ( $left, $right ) {
				foreach ( array( 0, 1, 2 ) as $index ) {
					$comparison = strcmp( $left[ $index ], $right[ $index ] );
					if ( 0 !== $comparison ) {
						return $comparison;
					}
				}
				return 0;
			}
		);
		$active_end = null;
		foreach ( $intervals as $interval ) {
			if ( null !== $active_end && strcmp( $interval[0], $active_end ) < 0 ) {
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			if ( null === $active_end || strcmp( $interval[1], $active_end ) > 0 ) {
				$active_end = $interval[1];
			}
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
			$sql .= ' WHERE owner_id = %d AND plan_id IS NULL AND store_generation IN (1, 2) AND schema_version IS NULL AND current_revision = 0';
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
				|| (string) ( $plan['updated_at'] ?? '' ) !== $now
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
		return $this->database_clock_timestamp();
	}

	/** Convert the trusted server instant to the server-owned learner civil date. */
	private function learner_local_date( $timestamp, $timezone ) {
		if ( ! $this->valid_timestamp( $timestamp ) || ! is_string( $timezone ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		try {
			$instant = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $timestamp, new DateTimeZone( 'UTC' ) );
			$zone = new DateTimeZone( $timezone );
		} catch ( Throwable $error ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( ! $instant instanceof DateTimeImmutable ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $instant->setTimezone( $zone )->format( 'Y-m-d' );
	}

	/** @return string */
	private function next_uuid() {
		return MMED_V1_Study_Week_Domain::uuid( $this->uuid_source->next_uuid() );
	}

	/** @return void */
	private function hit( $name ) {
		if ( null !== $this->failpoint ) {
			call_user_func( $this->failpoint, (string) $name );
			if ( 'after_commit' === $name ) {
				$this->assert_transaction_ended();
				$this->assert_session_encoding_pinned();
			} else {
				$this->assert_transaction_context();
			}
		}
	}

	/** Invoke one exact synthetic seam behind a transaction-continuity canary. */
	private function invoke_fence( $method, $owner_id ) {
		if ( ! in_array( $method, array( 'lock_control_rows', 'lock_calendar_rows' ), true ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$savepoint = 'v1_e2_' . bin2hex( random_bytes( 16 ) );
		$this->execute( 'SAVEPOINT `' . $savepoint . '`', 'v1_command_fence_savepoint_failed' );
		$result = call_user_func( array( $this->fence, $method ), $this->database, $this->connection_id, $owner_id );
		if ( true !== $result ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_transaction_context();
		$this->execute( 'RELEASE SAVEPOINT `' . $savepoint . '`', 'v1_command_fence_savepoint_lost' );
		$this->assert_transaction_context();
	}

	/** Require an injected seam to preserve this exact live transaction. */
	private function assert_transaction_context() {
		$this->verify_connection();
		if ( true !== $this->transaction_active() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->assert_session_integrity( true );
	}

	/** Require all relational and session invariants used by the writer. */
	private function assert_session_integrity( $inside_transaction, $require_hardened_mode = true, $require_pinned_encoding = true ) {
		if (
			1 !== (int) $this->scalar( 'SELECT @@SESSION.autocommit' )
			|| 1 !== (int) $this->scalar( 'SELECT @@SESSION.foreign_key_checks' )
			|| 1 !== (int) $this->scalar( 'SELECT @@SESSION.unique_checks' )
			|| ( $this->is_mariadb() && 1 !== (int) $this->scalar( 'SELECT @@SESSION.check_constraint_checks' ) )
			|| 0 !== (int) $this->scalar( $this->is_mariadb() ? 'SELECT @@SESSION.tx_read_only' : 'SELECT @@SESSION.transaction_read_only' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$modes = array_map( 'trim', explode( ',', strtoupper( (string) $this->scalar( 'SELECT @@SESSION.sql_mode' ) ) ) );
		if (
			( $require_hardened_mode && ! in_array( 'STRICT_TRANS_TABLES', $modes, true ) && ! in_array( 'STRICT_ALL_TABLES', $modes, true ) )
			|| ( $require_hardened_mode && ! in_array( 'NO_ZERO_IN_DATE', $modes, true ) )
			|| ( $require_hardened_mode && ! in_array( 'NO_ZERO_DATE', $modes, true ) )
			|| ( $require_hardened_mode && ! in_array( 'ERROR_FOR_DIVISION_BY_ZERO', $modes, true ) )
			|| ( $require_hardened_mode && ! in_array( 'NO_ENGINE_SUBSTITUTION', $modes, true ) )
			|| ( $inside_transaction && 'READ-COMMITTED' !== $this->isolation_level() )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		if ( $require_pinned_encoding ) {
			$this->assert_session_encoding_pinned();
		}
		$this->assert_database_clock_unspoofed();
	}

	/** Capture every mutable relational control guarded by this writer. */
	private function session_controls() {
		$controls = array(
			'autocommit' => (string) $this->scalar( 'SELECT @@SESSION.autocommit' ),
			'foreign_key_checks' => (string) $this->scalar( 'SELECT @@SESSION.foreign_key_checks' ),
			'unique_checks' => (string) $this->scalar( 'SELECT @@SESSION.unique_checks' ),
			'check_constraint_checks' => $this->is_mariadb() ? (string) $this->scalar( 'SELECT @@SESSION.check_constraint_checks' ) : null,
			'transaction_read_only' => (string) $this->scalar( $this->is_mariadb() ? 'SELECT @@SESSION.tx_read_only' : 'SELECT @@SESSION.transaction_read_only' ),
		);
		if (
			'1' !== $controls['autocommit']
			|| '1' !== $controls['foreign_key_checks']
			|| '1' !== $controls['unique_checks']
			|| ( $this->is_mariadb() && '1' !== $controls['check_constraint_checks'] )
			|| ( ! $this->is_mariadb() && null !== $controls['check_constraint_checks'] )
			|| '0' !== $controls['transaction_read_only']
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $controls;
	}

	/** Restore the exact clean relational controls after any rejected transaction seam. */
	private function restore_session_controls( $controls ) {
		if (
			! is_array( $controls )
			|| array( 'autocommit', 'foreign_key_checks', 'unique_checks', 'check_constraint_checks', 'transaction_read_only' ) !== array_keys( $controls )
			|| '1' !== $controls['autocommit']
			|| '1' !== $controls['foreign_key_checks']
			|| '1' !== $controls['unique_checks']
			|| ( $this->is_mariadb() && '1' !== $controls['check_constraint_checks'] )
			|| ( ! $this->is_mariadb() && null !== $controls['check_constraint_checks'] )
			|| '0' !== $controls['transaction_read_only']
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->execute( 'SET SESSION ' . ( $this->is_mariadb() ? 'tx_read_only' : 'transaction_read_only' ) . ' = 0', 'v1_command_read_only_restore_failed' );
		$this->execute( 'SET SESSION foreign_key_checks = 1', 'v1_command_foreign_keys_restore_failed' );
		$this->execute( 'SET SESSION unique_checks = 1', 'v1_command_unique_checks_restore_failed' );
		if ( $this->is_mariadb() ) {
			$this->execute( 'SET SESSION check_constraint_checks = 1', 'v1_command_check_constraints_restore_failed' );
		}
		$this->execute( 'SET SESSION autocommit = 1', 'v1_command_autocommit_restore_failed' );
		$this->execute( 'SET SESSION timestamp = DEFAULT', 'v1_command_timestamp_restore_failed' );
		if ( $controls !== $this->session_controls() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** Bound mutable @@timestamp to independent process and server clocks. */
	private function assert_database_clock_unspoofed() {
		$this->database_clock_timestamp();
	}

	/** Return one UTC timestamp only when the session clock demonstrably advances. */
	private function database_clock_timestamp() {
		$previous = null;
		for ( $attempt = 0; $attempt < 3; ++$attempt ) {
			$current = $this->database_clock_sample();
			if ( null !== $previous && strcmp( $current, $previous ) > 0 ) {
				return $current;
			}
			$previous = $current;
		}
		throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
	}

	/** Return one UTC timestamp from a single independently bounded clock row. */
	private function database_clock_sample() {
		$process_before = microtime( true );
		$rows = $this->rows(
			'SELECT @@SESSION.timestamp AS session_epoch, UNIX_TIMESTAMP(SYSDATE(6)) AS system_epoch,'
			. ' UTC_TIMESTAMP(6) AS utc_now'
		);
		$process_after = microtime( true );
		if ( 1 !== count( $rows ) || $process_after < $process_before ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$row = $rows[0];
		$session_timestamp = $row['session_epoch'] ?? null;
		$server_timestamp = $row['system_epoch'] ?? null;
		$utc_now = $row['utc_now'] ?? null;
		if ( ! is_numeric( $session_timestamp ) || ! is_numeric( $server_timestamp ) || ! $this->valid_timestamp( $utc_now ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$minimum = $process_before - self::CLOCK_SKEW_SECONDS;
		$maximum = $process_after + self::CLOCK_SKEW_SECONDS;
		$session = (float) $session_timestamp;
		$server = (float) $server_timestamp;
		if (
			$session < $minimum
			|| $session > $maximum
			|| $server < $minimum
			|| $server > $maximum
			|| abs( $session - $server ) > self::CLOCK_SKEW_SECONDS
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $utc_now, new DateTimeZone( 'UTC' ) );
		if ( ! $parsed instanceof DateTimeImmutable || abs( (float) $parsed->format( 'U.u' ) - $session ) > self::CLOCK_SKEW_SECONDS ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $utc_now;
	}

	/** Return the exact supported session isolation level. */
	private function isolation_level() {
		$sql = $this->is_mariadb() ? 'SELECT @@SESSION.tx_isolation' : 'SELECT @@SESSION.transaction_isolation';
		$value = strtoupper( str_replace( array( '_', ' ' ), '-', (string) $this->scalar( $sql ) ) );
		if ( ! in_array( $value, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $value;
	}

	/** @return string */
	private function native_sql_mode() {
		$value = $this->scalar( 'SELECT @@SESSION.sql_mode' );
		if ( ! is_string( $value ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $value;
	}

	/** Return the exact connection encoding tuple used by the current native session. */
	private function session_encoding() {
		$rows = $this->rows(
			'SELECT @@SESSION.character_set_client AS character_set_client,'
			. ' @@SESSION.character_set_connection AS character_set_connection,'
			. ' @@SESSION.character_set_results AS character_set_results,'
			. ' @@SESSION.collation_connection AS collation_connection'
		);
		if ( 1 !== count( $rows ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$row = $rows[0];
		$encoding = array(
			'character_set_client' => $row['character_set_client'] ?? null,
			'character_set_connection' => $row['character_set_connection'] ?? null,
			'character_set_results' => $row['character_set_results'] ?? null,
			'collation_connection' => $row['collation_connection'] ?? null,
		);
		if (
			! $this->encoding_identifier( $encoding['character_set_client'] )
			|| ! $this->encoding_identifier( $encoding['character_set_connection'] )
			|| ( null !== $encoding['character_set_results'] && ! $this->encoding_identifier( $encoding['character_set_results'] ) )
			|| ! $this->encoding_identifier( $encoding['collation_connection'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $encoding;
	}

	/** Pin all text ingress/egress to the exact utf8mb4 storage contract. */
	private function pin_session_encoding() {
		$this->execute( 'SET NAMES utf8mb4 COLLATE utf8mb4_bin', 'v1_command_encoding_set_failed' );
		$this->assert_session_encoding_pinned();
	}

	/** Require the complete canonical connection tuple. */
	private function assert_session_encoding_pinned() {
		$expected = array(
			'character_set_client' => MMED_V1_Study_Schema::TABLE_CHARSET,
			'character_set_connection' => MMED_V1_Study_Schema::TABLE_CHARSET,
			'character_set_results' => MMED_V1_Study_Schema::TABLE_CHARSET,
			'collation_connection' => MMED_V1_Study_Schema::TABLE_COLLATION,
		);
		if ( $expected !== $this->session_encoding() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** Restore the caller's exact clean-session connection tuple. */
	private function restore_session_encoding( $encoding ) {
		if (
			! is_array( $encoding )
			|| array( 'character_set_client', 'character_set_connection', 'character_set_results', 'collation_connection' ) !== array_keys( $encoding )
			|| ! $this->encoding_identifier( $encoding['character_set_client'] )
			|| ! $this->encoding_identifier( $encoding['character_set_connection'] )
			|| ( null !== $encoding['character_set_results'] && ! $this->encoding_identifier( $encoding['character_set_results'] ) )
			|| ! $this->encoding_identifier( $encoding['collation_connection'] )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->execute( $this->prepare( 'SET SESSION character_set_client = %s', $encoding['character_set_client'] ), 'v1_command_encoding_restore_failed' );
		$this->execute( $this->prepare( 'SET SESSION character_set_connection = %s', $encoding['character_set_connection'] ), 'v1_command_encoding_restore_failed' );
		if ( null === $encoding['character_set_results'] ) {
			$this->execute( 'SET SESSION character_set_results = NULL', 'v1_command_encoding_restore_failed' );
		} else {
			$this->execute( $this->prepare( 'SET SESSION character_set_results = %s', $encoding['character_set_results'] ), 'v1_command_encoding_restore_failed' );
		}
		$this->execute( $this->prepare( 'SET SESSION collation_connection = %s', $encoding['collation_connection'] ), 'v1_command_encoding_restore_failed' );
		if ( $encoding !== $this->session_encoding() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return bool */
	private function encoding_identifier( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[A-Za-z0-9_]{1,64}$/D', $value );
	}

	/** @return string */
	private function hardened_sql_mode( $current ) {
		$modes = array_values( array_filter( array_map( 'trim', explode( ',', strtoupper( (string) $current ) ) ), 'strlen' ) );
		if ( ! in_array( 'STRICT_TRANS_TABLES', $modes, true ) && ! in_array( 'STRICT_ALL_TABLES', $modes, true ) ) {
			$modes[] = 'STRICT_ALL_TABLES';
		}
		foreach ( array( 'NO_ZERO_IN_DATE', 'NO_ZERO_DATE', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION' ) as $required ) {
			if ( ! in_array( $required, $modes, true ) ) {
				$modes[] = $required;
			}
		}
		return implode( ',', $modes );
	}

	/** @return void */
	private function native_set_sql_mode( $mode ) {
		$this->execute( $this->prepare( 'SET SESSION sql_mode = %s', (string) $mode ), 'v1_command_sql_mode_set_failed' );
	}

	/** @return void */
	private function assert_sql_mode_hardened() {
		$this->assert_session_integrity( false, true );
	}

	/** Restore the caller's clean-session isolation exactly. */
	private function restore_isolation( $isolation ) {
		if ( ! in_array( $isolation, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$this->execute( 'SET SESSION TRANSACTION ISOLATION LEVEL ' . str_replace( '-', ' ', $isolation ), 'v1_command_isolation_restore_failed' );
		if ( $isolation !== $this->isolation_level() ) {
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
		$handle = $this->pinned_native_handle();
		$id = @mysqli_thread_id( $handle );
		if ( ! is_int( $id ) || $id <= 0 ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $id;
	}

	/** @return void */
	private function verify_connection() {
		if ( $this->connection_id <= 0 || $this->connection_id !== $this->current_connection_id() ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return mixed */
	private function scalar( $sql ) {
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( ! is_object( $result ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$row = @mysqli_fetch_row( $result );
		@mysqli_free_result( $result );
		$this->pinned_native_handle();
		if ( ! is_array( $row ) || 1 !== count( $row ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $row[0];
	}

	/** @return array */
	private function rows( $sql ) {
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( ! is_object( $result ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$rows = array();
		while ( true ) {
			$row = @mysqli_fetch_assoc( $result );
			if ( null === $row ) {
				break;
			}
			if ( false === $row || ! is_array( $row ) ) {
				@mysqli_free_result( $result );
				throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
			}
			$rows[] = $row;
		}
		@mysqli_free_result( $result );
		$this->pinned_native_handle();
		return $rows;
	}

	/** @return void */
	private function execute( $sql, $error_code ) {
		unset( $error_code );
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( true !== $result ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
	}

	/** @return int */
	private function execute_affected( $sql, $error_code ) {
		unset( $error_code );
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( true !== $result ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$affected = $this->native_affected_rows();
		$this->assert_transaction_context();
		return $affected;
	}

	/** Return and continuously verify the exact original mysqli handle. */
	private function pinned_native_handle() {
		$handle = isset( $this->database->dbh ) ? $this->database->dbh : null;
		if (
			! is_object( $handle )
			|| ! is_object( $this->native_handle )
			|| $handle !== $this->native_handle
			|| ! function_exists( 'mysqli_thread_id' )
			|| ! function_exists( 'mysqli_query' )
			|| ! function_exists( 'mysqli_fetch_row' )
			|| ! function_exists( 'mysqli_fetch_assoc' )
			|| ! function_exists( 'mysqli_free_result' )
			|| ! function_exists( 'mysqli_affected_rows' )
			|| ! function_exists( 'mysqli_errno' )
			|| ! function_exists( 'mysqli_sqlstate' )
		) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$id = @mysqli_thread_id( $handle );
		if ( ! is_int( $id ) || $id <= 0 || ( $this->connection_id > 0 && $id !== $this->connection_id ) ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $handle;
	}

	/** Native no-reconnect query with normalized exact error evidence. @return mixed */
	private function native_query( $sql, &$failure ) {
		$failure = array( 'errno' => 0, 'sqlstate' => '' );
		$handle = $this->pinned_native_handle();
		try {
			$result = @mysqli_query( $handle, $sql );
		} catch ( Throwable $error ) {
			$failure['errno'] = (int) $error->getCode();
			$failure['sqlstate'] = method_exists( $error, 'getSqlState' )
				? (string) $error->getSqlState()
				: (string) @mysqli_sqlstate( $handle );
			$this->pinned_native_handle();
			return false;
		}
		if ( false === $result ) {
			$failure['errno'] = (int) @mysqli_errno( $handle );
			$failure['sqlstate'] = (string) @mysqli_sqlstate( $handle );
		}
		$this->pinned_native_handle();
		return $result;
	}

	/** @return int */
	private function native_affected_rows() {
		$affected = @mysqli_affected_rows( $this->pinned_native_handle() );
		if ( ! is_int( $affected ) || $affected < 0 ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $affected;
	}

	/** Best-effort cleanup on the original handle after a forbidden reconnect. */
	private function best_effort_detached_rollback() {
		$handle = $this->native_handle;
		if ( is_object( $handle ) && function_exists( 'mysqli_query' ) ) {
			try {
				@mysqli_query( $handle, 'ROLLBACK AND NO CHAIN NO RELEASE' );
			} catch ( Throwable $error ) {
				unset( $error );
			}
		}
	}

	/** @return string */
	private function prepare() {
		$args = func_get_args();
		$sql = array_shift( $args );
		$prepared = $this->database->prepare( $sql, $args );
		if ( ! is_string( $prepared ) || '' === $prepared ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		$prepared = $this->database->remove_placeholder_escape( $prepared );
		if ( ! is_string( $prepared ) || '' === $prepared ) {
			throw new MMED_V1_Study_Command_Exception( 'dependency_unavailable' );
		}
		return $prepared;
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
