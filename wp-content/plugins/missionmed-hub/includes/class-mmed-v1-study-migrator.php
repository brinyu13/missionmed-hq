<?php
/**
 * Explicit, restartable 8010D capability-kernel migration runner.
 *
 * This class registers no WordPress hooks. It may be invoked only by an
 * isolated, operator-controlled migration command after backup and capability
 * gates; normal plugin load, activation, and requests never call it.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Content-addressed DDL runner with advisory-lock and restart reconciliation. */
final class MMED_V1_Study_Migrator {

	/** @var object */
	private $database;

	/** @var MMED_V1_Study_Schema_Inspector */
	private $inspector;

	/** @var callable|null */
	private $failpoint;

	/** @var int */
	private $connection_id;

	/** @var bool|null */
	private $is_mariadb;

	/**
	 * @param object        $database WordPress database connection.
	 * @param callable|null $failpoint Test-only deterministic failure callback.
	 */
	public function __construct( $database, $failpoint = null ) {
		if ( ! is_object( $database ) || ! method_exists( $database, 'query' ) || ! method_exists( $database, 'get_var' ) ) {
			throw new InvalidArgumentException( 'V1 migrator requires a database connection.' );
		}
		if ( null !== $failpoint && ! is_callable( $failpoint ) ) {
			throw new InvalidArgumentException( 'V1 migrator failpoint is invalid.' );
		}
		$this->database      = $database;
		$this->inspector     = new MMED_V1_Study_Schema_Inspector( $database );
		$this->failpoint     = $failpoint;
		$this->connection_id = 0;
		$this->is_mariadb    = null;
	}

	/**
	 * Apply or reconcile generation 1 and commission one synthetic store.
	 *
	 * @param string $store_id  Canonical lowercase RFC4122 v4 store UUID.
	 * @param string $runner_id Canonical lowercase RFC4122 v4 runner UUID.
	 * @return array
	 */
	public function run( $store_id, $runner_id ) {
		if ( ! MMED_V1_Study_Schema::valid_uuid( $store_id ) || ! MMED_V1_Study_Schema::valid_uuid( $runner_id ) ) {
			throw new InvalidArgumentException( 'V1 migration UUID is invalid.' );
		}

		$this->connection_id = $this->current_connection_id();
		$lock_name           = $this->lock_name();
		$existing_owner      = $this->database->get_var( $this->prepare( 'SELECT IS_USED_LOCK(%s)', $lock_name ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_probe_failed' );
		$this->verify_connection();
		if ( null !== $existing_owner ) {
			throw new RuntimeException(
				(int) $existing_owner === $this->connection_id ? 'v1_migration_reentrant' : 'v1_migration_busy'
			);
		}
		$got_lock            = $this->database->get_var( $this->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_error' );
		$this->verify_connection();
		if ( 1 !== (int) $got_lock ) {
			throw new RuntimeException( null === $got_lock ? 'v1_migration_lock_error' : 'v1_migration_busy' );
		}

		$result            = null;
		$primary           = null;
		$original_sql_mode = null;
		try {
			$this->verify_connection();
			$this->assert_clean_session();
			$original_sql_mode = $this->native_sql_mode();
			$this->native_set_sql_mode( $this->hardened_sql_mode( $original_sql_mode ) );
			$this->assert_sql_mode_hardened();
			$this->assert_no_temporary_table_shadows();
			$this->hit( 'after_lock' );
			$this->reconcile_migrations( $runner_id );
			$this->commission( $store_id );
			$inspection = $this->inspector->inspect();
			if ( empty( $inspection['ok'] ) || MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $inspection['state'] ) {
				throw new RuntimeException( 'v1_schema_postcondition_failed' );
			}
			$this->verify_connection();
			$result = array(
				'ok'            => true,
				'state'         => 'ready',
				'generation'    => MMED_V1_Study_Schema::GENERATION,
				'manifest_hash' => MMED_V1_Study_Schema::manifest_hash_hex( $this->database ),
			);
		} catch ( Throwable $error ) {
			$primary = $error;
		}

		$cleanup_errors = array();
		if ( null !== $original_sql_mode ) {
			try {
				$this->native_set_sql_mode( $original_sql_mode );
				if ( $original_sql_mode !== $this->native_sql_mode() ) {
					throw new RuntimeException( 'v1_migration_sql_mode_restore_verify_failed' );
				}
			} catch ( Throwable $error ) {
				$cleanup_errors[] = 'sql_mode=' . $error->getMessage();
			}
		}
		try {
			$this->release_lock( $lock_name );
		} catch ( Throwable $error ) {
			$cleanup_errors[] = 'lock=' . $error->getMessage();
		}
		if ( null !== $primary ) {
			if ( ! empty( $cleanup_errors ) ) {
				throw new RuntimeException( $primary->getMessage() . ';cleanup=' . implode( ',', $cleanup_errors ), 0, $primary );
			}
			throw $primary;
		}
		if ( ! empty( $cleanup_errors ) ) {
			throw new RuntimeException( 'v1_migration_cleanup_failed:' . implode( ',', $cleanup_errors ) );
		}
		return $result;
	}

	/** @return void */
	private function reconcile_migrations( $runner_id ) {
		$migrations = MMED_V1_Study_Schema::migrations( $this->database );
		$seen_gap   = false;
		foreach ( $migrations as $migration ) {
			$table = $this->inspector->inspect_table( $migration['table_key'] );
			if ( ! empty( $table['exists'] ) ) {
				if ( $seen_gap ) {
					throw new RuntimeException( 'v1_migration_noncontiguous_tables' );
				}
				if ( empty( $table['ok'] ) ) {
					throw new RuntimeException( 'v1_migration_schema_drift' );
				}
			} else {
				$seen_gap = true;
			}
		}

		$ledger = $this->ledger_rows();
		$this->validate_ledger( $ledger, $migrations );

		foreach ( $migrations as $migration ) {
			$this->verify_connection();
			$version = (int) $migration['version'];
			$table   = $this->inspector->inspect_table( $migration['table_key'] );
			$row     = isset( $ledger[ $version ] ) ? $ledger[ $version ] : null;

			if ( ! empty( $table['exists'] ) ) {
				if ( empty( $table['ok'] ) ) {
					throw new RuntimeException( 'v1_migration_schema_drift' );
				}
				if ( null === $row && 1 !== $version ) {
					throw new RuntimeException( 'v1_migration_unowned_table' );
				}
				if ( null !== $row && 'failed' === $row['state'] ) {
					throw new RuntimeException( 'v1_migration_failed_requires_review' );
				}
				if ( null === $row || 'applied' !== $row['state'] ) {
					$this->record_applied( $migration, $runner_id, null === $row ? 1 : ( (int) $row['attempt_count'] + 1 ), 'recovered_after_ddl' );
					$ledger = $this->ledger_rows();
				}
				continue;
			}

			if ( null !== $row && 'applied' === $row['state'] ) {
				throw new RuntimeException( 'v1_migration_applied_table_missing' );
			}
			if ( null !== $row && 'failed' === $row['state'] ) {
				throw new RuntimeException( 'v1_migration_failed_requires_review' );
			}

			if ( 1 !== $version ) {
				$this->hit( 'before_migration_' . $version . '_record' );
				$this->record_applying( $migration, $runner_id, $row );
				$this->hit( 'after_migration_' . $version . '_record' );
			}

			$this->hit( 'before_migration_' . $version . '_ddl' );
			try {
				$this->query_required( $migration['sql'], 'v1_migration_ddl_failed' );
			} catch ( Throwable $error ) {
				$record_error = null;
				if ( 1 !== $version ) {
					try {
						$this->record_failed( $migration, $runner_id, 'ddl_failed' );
					} catch ( Throwable $failure_error ) {
						$record_error = $failure_error;
					}
				}
				if ( null !== $record_error ) {
					throw new RuntimeException( $error->getMessage() . ';failure_record=' . $record_error->getMessage(), 0, $error );
				}
				throw $error;
			}
			$this->hit( 'after_migration_' . $version . '_ddl' );

			$table = $this->inspector->inspect_table( $migration['table_key'] );
			if ( empty( $table['exists'] ) || empty( $table['ok'] ) ) {
				$errors        = isset( $table['errors'] ) && is_array( $table['errors'] ) ? $table['errors'] : array( 'inspection_unavailable' );
				$postcondition = new RuntimeException(
					'v1_migration_postcondition_failed:' . $version . ':' . implode( ',', array_map( 'strval', $errors ) )
				);
				if ( 1 !== $version ) {
					try {
						$this->record_failed( $migration, $runner_id, 'postcondition_failed' );
					} catch ( Throwable $failure_error ) {
						throw new RuntimeException( $postcondition->getMessage() . ';failure_record=' . $failure_error->getMessage(), 0, $postcondition );
					}
				}
				throw $postcondition;
			}
			$this->hit( 'after_migration_' . $version . '_verify' );
			$this->record_applied( $migration, $runner_id, null === $row ? 1 : ( (int) $row['attempt_count'] + 1 ), 'verified' );
			$this->hit( 'after_migration_' . $version . '_applied' );
			$ledger = $this->ledger_rows();
		}

		$this->validate_ledger( $this->ledger_rows(), $migrations, true );
	}

	/** @return array */
	private function ledger_rows() {
		$table = MMED_V1_Study_Schema::table_names( $this->database );
		$probe = $this->inspector->inspect_table( 'migrations' );
		if ( empty( $probe['exists'] ) ) {
			return array();
		}
		if ( empty( $probe['ok'] ) ) {
			throw new RuntimeException( 'v1_migration_ledger_drift' );
		}

		$sql  = 'SELECT migration_version, migration_id, HEX(checksum) AS checksum_hex, state, checkpoint, attempt_count,';
		$sql .= ' HEX(runner_id) AS runner_hex, failure_code, started_at, applied_at, updated_at';
		$sql .= " FROM `{$table['migrations']}` ORDER BY migration_version";
		$rows = $this->rows( $sql );
		$out  = array();
		foreach ( $rows as $row ) {
			$version = (int) ( $row['migration_version'] ?? 0 );
			if ( $version <= 0 || isset( $out[ $version ] ) ) {
				throw new RuntimeException( 'v1_migration_ledger_invalid' );
			}
			$out[ $version ] = array(
				'id'            => (string) ( $row['migration_id'] ?? '' ),
				'checksum_hex'  => strtolower( (string) ( $row['checksum_hex'] ?? '' ) ),
				'state'         => (string) ( $row['state'] ?? '' ),
				'checkpoint'    => (string) ( $row['checkpoint'] ?? '' ),
				'attempt_count' => (int) ( $row['attempt_count'] ?? 0 ),
				'runner_hex'    => strtolower( (string) ( $row['runner_hex'] ?? '' ) ),
				'failure_code'  => null === ( $row['failure_code'] ?? null ) ? null : (string) $row['failure_code'],
				'started_at'    => null === ( $row['started_at'] ?? null ) ? null : (string) $row['started_at'],
				'applied_at'    => null === ( $row['applied_at'] ?? null ) ? null : (string) $row['applied_at'],
				'updated_at'    => null === ( $row['updated_at'] ?? null ) ? null : (string) $row['updated_at'],
			);
		}
		return $out;
	}

	/** @return void */
	private function validate_ledger( $ledger, $migrations, $require_applied = false ) {
		$expected = array();
		foreach ( $migrations as $migration ) {
			$expected[ (int) $migration['version'] ] = $migration;
		}
		$next_version = 1;
		foreach ( $ledger as $version => $row ) {
			if ( $version !== $next_version ) {
				throw new RuntimeException( 'v1_migration_ledger_version_gap' );
			}
			++$next_version;
			if ( ! isset( $expected[ $version ] ) ) {
				throw new RuntimeException( 'v1_migration_future_or_unknown_version' );
			}
			$migration = $expected[ $version ];
			if (
				$row['id'] !== $migration['id']
				|| $row['checksum_hex'] !== $migration['checksum_hex']
				|| ! in_array( $row['state'], array( 'applying', 'applied', 'failed' ), true )
				|| $row['attempt_count'] < 1
				|| 1 !== preg_match( '/^[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/', $row['runner_hex'] )
				|| ! $this->valid_ledger_timestamp( $row['started_at'] )
				|| ! $this->valid_ledger_timestamp( $row['updated_at'] )
				|| strcmp( $row['updated_at'], $row['started_at'] ) < 0
			) {
				throw new RuntimeException( 'v1_migration_ledger_mismatch' );
			}
			if ( 'applying' === $row['state'] ) {
				$valid_state = 'before_ddl' === $row['checkpoint']
					&& null === $row['failure_code']
					&& null === $row['applied_at'];
			} elseif ( 'failed' === $row['state'] ) {
				$valid_state = 'failed' === $row['checkpoint']
					&& is_string( $row['failure_code'] )
					&& 1 === preg_match( '/^[a-z0-9_]{1,64}$/', $row['failure_code'] )
					&& null === $row['applied_at'];
			} else {
				$valid_state = in_array( $row['checkpoint'], array( 'verified', 'recovered_after_ddl' ), true )
					&& null === $row['failure_code']
					&& $this->valid_ledger_timestamp( $row['applied_at'] )
					&& strcmp( $row['applied_at'], $row['started_at'] ) >= 0
					&& strcmp( $row['updated_at'], $row['applied_at'] ) >= 0;
			}
			if ( ! $valid_state ) {
				throw new RuntimeException( 'v1_migration_ledger_state_invalid' );
			}
			if ( $require_applied && 'applied' !== $row['state'] ) {
				throw new RuntimeException( 'v1_migration_not_applied' );
			}
		}
		if ( $require_applied && count( $ledger ) !== count( $expected ) ) {
			throw new RuntimeException( 'v1_migration_ledger_incomplete' );
		}
	}

	/** @return bool */
	private function valid_ledger_timestamp( $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}$/', $value ) ) {
			return false;
		}
		$timestamp = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $value, new DateTimeZone( 'UTC' ) );
		return false !== $timestamp && $value === $timestamp->format( 'Y-m-d H:i:s.u' );
	}

	/** @return void */
	private function record_applying( $migration, $runner_id, $existing ) {
		$table   = MMED_V1_Study_Schema::table_names( $this->database );
		$now     = $this->now();
		$attempt = null === $existing ? 1 : ( (int) $existing['attempt_count'] + 1 );
		if ( null === $existing ) {
			$sql = "INSERT INTO `{$table['migrations']}`";
			$sql .= ' (migration_version, migration_id, checksum, state, checkpoint, attempt_count, runner_id, failure_code, started_at, applied_at, updated_at)';
			$sql .= ' VALUES (%d, %s, UNHEX(%s), %s, %s, %d, UNHEX(%s), NULL, %s, NULL, %s)';
			$this->query_required(
				$this->prepare(
					$sql,
					$migration['version'],
					$migration['id'],
					$migration['checksum_hex'],
					'applying',
					'before_ddl',
					$attempt,
					$this->uuid_hex( $runner_id ),
					$now,
					$now
				),
				'v1_migration_ledger_insert_failed'
			);
			return;
		}

		$sql = "UPDATE `{$table['migrations']}` SET state = %s, checkpoint = %s, attempt_count = %d,";
		$sql .= ' runner_id = UNHEX(%s), failure_code = NULL, applied_at = NULL,';
		$sql .= ' updated_at = GREATEST(started_at, updated_at, %s) WHERE migration_version = %d';
		$this->query_exactly_one(
			$this->prepare( $sql, 'applying', 'before_ddl', $attempt, $this->uuid_hex( $runner_id ), $now, $migration['version'] ),
			'v1_migration_ledger_update_failed'
		);
	}

	/** @return void */
	private function record_applied( $migration, $runner_id, $attempt, $checkpoint ) {
		$table = MMED_V1_Study_Schema::table_names( $this->database );
		$now   = $this->now();
		$sql   = "INSERT INTO `{$table['migrations']}`";
		$sql  .= ' (migration_version, migration_id, checksum, state, checkpoint, attempt_count, runner_id, failure_code, started_at, applied_at, updated_at)';
		$sql  .= ' VALUES (%d, %s, UNHEX(%s), %s, %s, %d, UNHEX(%s), NULL, %s, %s, %s)';
		$sql  .= ' ON DUPLICATE KEY UPDATE state = VALUES(state), checkpoint = VALUES(checkpoint), attempt_count = VALUES(attempt_count),';
		$sql  .= ' runner_id = VALUES(runner_id), failure_code = NULL,';
		$sql  .= ' applied_at = GREATEST(started_at, updated_at, VALUES(applied_at)),';
		$sql  .= ' updated_at = GREATEST(started_at, updated_at, VALUES(applied_at), VALUES(updated_at))';
		$this->query_required(
			$this->prepare(
				$sql,
				$migration['version'],
				$migration['id'],
				$migration['checksum_hex'],
				'applied',
				$checkpoint,
				(int) $attempt,
				$this->uuid_hex( $runner_id ),
				$now,
				$now,
				$now
			),
			'v1_migration_ledger_apply_failed'
		);
	}

	/** @return void */
	private function record_failed( $migration, $runner_id, $failure_code ) {
		$table = MMED_V1_Study_Schema::table_names( $this->database );
		$sql   = "UPDATE `{$table['migrations']}` SET state = %s, checkpoint = %s, runner_id = UNHEX(%s),";
		$sql  .= ' failure_code = %s, applied_at = NULL, updated_at = GREATEST(started_at, updated_at, %s) WHERE migration_version = %d';
		$this->query_exactly_one(
			$this->prepare( $sql, 'failed', 'failed', $this->uuid_hex( $runner_id ), $failure_code, $this->now(), $migration['version'] ),
			'v1_migration_failure_record_failed'
		);
	}

	/** @return void */
	private function commission( $store_id ) {
		$this->hit( 'before_commission' );
		$inspection = $this->inspector->inspect();
		if ( empty( $inspection['ok'] ) || MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE !== $inspection['state'] ) {
			throw new RuntimeException( 'v1_commission_schema_unavailable' );
		}

		$current = $this->commissioning_rows();
		if ( 0 !== $current['generation_count'] || 0 !== $current['gate_count'] ) {
			$this->validate_commissioned_rows( $current, $store_id );
			return;
		}

		$this->verify_lock();
		$this->assert_clean_session();
		$this->assert_sql_mode_hardened();
		$original_isolation = $this->native_isolation_level();
		$transaction_started = false;
		$primary             = null;
		$cleanup_errors      = array();
		try {
			$this->native_set_isolation_level( 'READ-COMMITTED' );
			if ( 'READ-COMMITTED' !== $this->native_isolation_level() ) {
				throw new RuntimeException( 'v1_commission_isolation_verify_failed' );
			}
			$this->native_query_required( 'START TRANSACTION', 'v1_commission_begin_failed' );
			$transaction_started = true;
			if ( ! $this->native_transaction_is_active() ) {
				throw new RuntimeException( 'v1_commission_transaction_inactive' );
			}
			$table    = MMED_V1_Study_Schema::table_names( $this->database );
			$now      = $this->now();
			$storehex = $this->uuid_hex( $store_id );
			$manifest = MMED_V1_Study_Schema::manifest_hash_hex( $this->database );
			$sql      = "INSERT INTO `{$table['generations']}`";
			$sql     .= ' (generation, store_id, writer_schema_version, current_reader_version, previous_reader_version, manifest_hash, activated_at)';
			$sql     .= ' VALUES (%d, UNHEX(%s), %s, %s, NULL, UNHEX(%s), %s)';
			$this->assert_sql_mode_hardened();
			$this->native_query_exactly_one(
				$this->prepare(
					$sql,
					MMED_V1_Study_Schema::GENERATION,
					$storehex,
					MMED_V1_Study_Schema::SCHEMA_VERSION,
					MMED_V1_Study_Schema::CURRENT_READER_VERSION,
					$manifest,
					$now
				),
				'v1_generation_insert_failed'
			);
			if ( ! $this->native_transaction_is_active() ) {
				throw new RuntimeException( 'v1_commission_transaction_lost' );
			}
			$this->hit( 'after_generation_insert' );

			$sql  = "INSERT INTO `{$table['store_gate']}`";
			$sql .= ' (gate_key, store_id, current_generation, gate_state, commissioned_at, updated_at)';
			$sql .= ' VALUES (1, UNHEX(%s), %d, %s, %s, %s)';
			$this->assert_sql_mode_hardened();
			$this->native_query_exactly_one(
				$this->prepare( $sql, $storehex, MMED_V1_Study_Schema::GENERATION, 'ready', $now, $now ),
				'v1_gate_insert_failed'
			);
			if ( ! $this->native_transaction_is_active() ) {
				throw new RuntimeException( 'v1_commission_transaction_lost' );
			}
			$this->hit( 'after_gate_insert' );
			$this->native_query_required( 'COMMIT AND NO CHAIN NO RELEASE', 'v1_commission_commit_outcome_unknown' );
			$transaction_started = false;
			if ( $this->native_transaction_is_active() ) {
				throw new RuntimeException( 'v1_commission_commit_outcome_unknown' );
			}
			$this->hit( 'after_commission_commit' );
		} catch ( Throwable $error ) {
			$primary = $error;
		}

		if ( $transaction_started ) {
			try {
				$this->native_query_required( 'ROLLBACK AND NO CHAIN NO RELEASE', 'v1_commission_rollback_failed' );
				$transaction_started = false;
			} catch ( Throwable $error ) {
				$cleanup_errors[] = $error->getMessage();
			}
		}
		try {
			$this->native_set_isolation_level( $original_isolation );
			if ( $original_isolation !== $this->native_isolation_level() ) {
				throw new RuntimeException( 'v1_commission_isolation_restore_verify_failed' );
			}
		} catch ( Throwable $error ) {
			$cleanup_errors[] = $error->getMessage();
		}
		if ( null !== $primary ) {
			if ( ! empty( $cleanup_errors ) ) {
				throw new RuntimeException( $primary->getMessage() . ';transaction_cleanup=' . implode( ',', $cleanup_errors ), 0, $primary );
			}
			throw $primary;
		}
		if ( ! empty( $cleanup_errors ) ) {
			throw new RuntimeException( 'v1_commission_cleanup_failed:' . implode( ',', $cleanup_errors ) );
		}

		$this->verify_lock();
		$this->validate_commissioned_rows( $this->commissioning_rows(), $store_id );
	}

	/** @return array */
	private function commissioning_rows() {
		$table       = MMED_V1_Study_Schema::table_names( $this->database );
		$generations = $this->rows(
			"SELECT generation, HEX(store_id) AS store_hex, writer_schema_version, current_reader_version, previous_reader_version, HEX(manifest_hash) AS manifest_hex, activated_at FROM `{$table['generations']}` ORDER BY generation"
		);
		$gates = $this->rows(
			"SELECT gate_key, HEX(store_id) AS store_hex, current_generation, gate_state, commissioned_at FROM `{$table['store_gate']}` ORDER BY gate_key"
		);
		return array(
			'generation_count' => count( $generations ),
			'gate_count'       => count( $gates ),
			'generation'       => 1 === count( $generations ) ? $generations[0] : null,
			'gate'             => 1 === count( $gates ) ? $gates[0] : null,
		);
	}

	/** @return void */
	private function validate_commissioned_rows( $rows, $store_id ) {
		if ( 1 !== $rows['generation_count'] || 1 !== $rows['gate_count'] || ! is_array( $rows['generation'] ) || ! is_array( $rows['gate'] ) ) {
			throw new RuntimeException( 'v1_commission_state_partial' );
		}
		$generation = $rows['generation'];
		$gate       = $rows['gate'];
		$store_hex  = $this->uuid_hex( $store_id );
		if (
			1 !== (int) ( $generation['generation'] ?? 0 )
			|| strtoupper( $store_hex ) !== strtoupper( (string) ( $generation['store_hex'] ?? '' ) )
			|| MMED_V1_Study_Schema::SCHEMA_VERSION !== (string) ( $generation['writer_schema_version'] ?? '' )
			|| MMED_V1_Study_Schema::CURRENT_READER_VERSION !== (string) ( $generation['current_reader_version'] ?? '' )
			|| null !== ( $generation['previous_reader_version'] ?? null )
			|| MMED_V1_Study_Schema::manifest_hash_hex( $this->database ) !== strtolower( (string) ( $generation['manifest_hex'] ?? '' ) )
			|| 1 !== (int) ( $gate['gate_key'] ?? 0 )
			|| strtoupper( $store_hex ) !== strtoupper( (string) ( $gate['store_hex'] ?? '' ) )
			|| 1 !== (int) ( $gate['current_generation'] ?? 0 )
			|| 'ready' !== (string) ( $gate['gate_state'] ?? '' )
			|| empty( $gate['commissioned_at'] )
			|| empty( $generation['activated_at'] )
		) {
			throw new RuntimeException( 'v1_commission_state_mismatch' );
		}
	}

	/** @return string */
	private function lock_name() {
		$prefix = isset( $this->database->prefix ) ? (string) $this->database->prefix : '';
		return 'mmed_v1_8010d_' . substr( hash( 'sha256', $this->inspector->schema_name() . "\n" . $prefix ), 0, 40 );
	}

	/** @return void */
	private function release_lock( $lock_name ) {
		if ( $this->connection_id !== $this->current_connection_id() ) {
			throw new RuntimeException( 'v1_migration_connection_changed' );
		}
		$owner = $this->database->get_var( $this->prepare( 'SELECT IS_USED_LOCK(%s)', $lock_name ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_probe_failed' );
		$this->verify_connection();
		if ( null === $owner ) {
			throw new RuntimeException( 'v1_migration_lock_lost' );
		}
		if ( (int) $owner !== $this->connection_id ) {
			throw new RuntimeException( 'v1_migration_lock_owner_changed' );
		}
		$released = $this->database->get_var( $this->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_release_failed' );
		$this->verify_connection();
		if ( 1 !== (int) $released ) {
			throw new RuntimeException( 'v1_migration_lock_release_failed' );
		}
		$owner = $this->database->get_var( $this->prepare( 'SELECT IS_USED_LOCK(%s)', $lock_name ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_probe_failed' );
		$this->verify_connection();
		if ( null !== $owner && (int) $owner === $this->connection_id ) {
			throw new RuntimeException( 'v1_migration_lock_release_incomplete' );
		}
	}

	/** Verify the advisory lock and connection before/after mutable work. @return void */
	private function verify_lock() {
		$this->verify_connection();
		$owner = $this->database->get_var( $this->prepare( 'SELECT IS_USED_LOCK(%s)', $this->lock_name() ) );
		$this->assert_last_query_succeeded( 'v1_migration_lock_probe_failed' );
		$this->verify_connection();
		if ( null === $owner ) {
			throw new RuntimeException( 'v1_migration_lock_lost' );
		}
		if ( (int) $owner !== $this->connection_id ) {
			throw new RuntimeException( 'v1_migration_lock_owner_changed' );
		}
	}

	/** @return void */
	private function verify_connection() {
		if ( $this->connection_id <= 0 || $this->connection_id !== $this->current_connection_id() ) {
			throw new RuntimeException( 'v1_migration_connection_changed' );
		}
	}

	/** Reject an outer transaction or nonstandard autocommit session. @return void */
	private function assert_clean_session() {
		$autocommit = $this->guarded_scalar( 'SELECT @@SESSION.autocommit', 'v1_migration_session_probe_failed' );
		if (
			1 !== (int) $autocommit
			|| $this->transaction_is_active()
		) {
			throw new RuntimeException( 'v1_migration_session_not_clean' );
		}
		$foreign_keys = $this->guarded_scalar( 'SELECT @@SESSION.foreign_key_checks', 'v1_migration_session_probe_failed' );
		$unique_keys  = $this->guarded_scalar( 'SELECT @@SESSION.unique_checks', 'v1_migration_session_probe_failed' );
		$checks       = $this->server_is_mariadb()
			? $this->guarded_scalar( 'SELECT @@SESSION.check_constraint_checks', 'v1_migration_session_probe_failed' )
			: 1;
		if ( 1 !== (int) $foreign_keys || 1 !== (int) $unique_keys || 1 !== (int) $checks ) {
			throw new RuntimeException( 'v1_migration_session_constraints_disabled' );
		}
	}

	/**
	 * Permanent information_schema rows cannot reveal same-named session TEMPORARY
	 * tables. Probe the complete owned namespace without dropping caller state.
	 *
	 * @return void
	 */
	private function assert_no_temporary_table_shadows() {
		foreach ( MMED_V1_Study_Schema::table_names( $this->database ) as $table_name ) {
			$this->verify_lock();
			$handle  = $this->native_handle();
			$created = @mysqli_query(
				$handle,
				"CREATE TEMPORARY TABLE `{$table_name}` (v1_probe tinyint unsigned NOT NULL) ENGINE=InnoDB"
			);
			if ( true !== $created ) {
				$errno = (int) @mysqli_errno( $handle );
				$this->native_handle();
				throw new RuntimeException( 1050 === $errno ? 'v1_migration_temporary_shadow_detected' : 'v1_migration_temporary_shadow_probe_failed' );
			}
			$this->native_handle();
			if ( true !== @mysqli_query( $handle, "DROP TEMPORARY TABLE `{$table_name}`" ) ) {
				throw new RuntimeException( 'v1_migration_temporary_shadow_cleanup_failed' );
			}
			$this->native_handle();
			$this->verify_lock();
		}
	}

	/** @return bool */
	private function transaction_is_active() {
		return $this->native_transaction_probe( 'v1_migration_transaction_probe_failed' );
	}

	/** @return object */
	private function native_handle() {
		$handle = isset( $this->database->dbh ) ? $this->database->dbh : null;
		if (
			! is_object( $handle )
			|| ! function_exists( 'mysqli_thread_id' )
			|| ! function_exists( 'mysqli_query' )
			|| ! function_exists( 'mysqli_fetch_row' )
			|| ! function_exists( 'mysqli_free_result' )
			|| ! function_exists( 'mysqli_affected_rows' )
			|| ! function_exists( 'mysqli_errno' )
			|| ! function_exists( 'mysqli_sqlstate' )
		) {
			throw new RuntimeException( 'v1_native_database_capability_unavailable' );
		}
		$id = @mysqli_thread_id( $handle );
		if ( ! is_int( $id ) || $id !== $this->connection_id ) {
			throw new RuntimeException( 'v1_migration_connection_changed' );
		}
		return $handle;
	}

	/**
	 * Detect a local transaction without relying on optional instrumentation.
	 * SAVEPOINT is a no-op outside a transaction, followed by exact errno 1305;
	 * inside one, rollback/release of the unique probe savepoint both succeed.
	 *
	 * @return bool
	 */
	private function native_transaction_probe( $error_code ) {
		try {
			$name = 'mmed_v1_probe_' . bin2hex( random_bytes( 16 ) );
		} catch ( Throwable $error ) {
			throw new RuntimeException( $error_code, 0, $error );
		}
		$handle = $this->native_handle();
		if ( true !== @mysqli_query( $handle, 'SAVEPOINT `' . $name . '`' ) ) {
			throw new RuntimeException( $error_code );
		}
		$this->native_handle();
		$rolled_back = @mysqli_query( $handle, 'ROLLBACK TO SAVEPOINT `' . $name . '`' );
		if ( true === $rolled_back ) {
			$this->native_handle();
			if ( true !== @mysqli_query( $handle, 'RELEASE SAVEPOINT `' . $name . '`' ) ) {
				throw new RuntimeException( $error_code );
			}
			$this->native_handle();
			return true;
		}
		$errno    = (int) @mysqli_errno( $handle );
		$sqlstate = (string) @mysqli_sqlstate( $handle );
		$this->native_handle();
		if ( 1305 === $errno && '42000' === $sqlstate ) {
			return false;
		}
		// The savepoint probably still exists after an unexpected rollback error.
		// Cleanup is best-effort only; the captured probe failure remains primary.
		@mysqli_query( $handle, 'RELEASE SAVEPOINT `' . $name . '`' );
		throw new RuntimeException( $error_code );
	}

	/** @return void */
	private function native_query_required( $sql, $error_code ) {
		$handle = $this->native_handle();
		$result = @mysqli_query( $handle, $sql );
		if ( true !== $result ) {
			throw new RuntimeException( $error_code );
		}
		$this->native_handle();
	}

	/** @return void */
	private function native_query_exactly_one( $sql, $error_code ) {
		$this->native_query_required( $sql, $error_code );
		if ( 1 !== (int) @mysqli_affected_rows( $this->native_handle() ) ) {
			throw new RuntimeException( $error_code );
		}
	}

	/** @return mixed */
	private function native_scalar_required( $sql, $error_code ) {
		$handle = $this->native_handle();
		$result = @mysqli_query( $handle, $sql );
		if ( ! is_object( $result ) ) {
			throw new RuntimeException( $error_code );
		}
		$row = @mysqli_fetch_row( $result );
		@mysqli_free_result( $result );
		$this->native_handle();
		if ( ! is_array( $row ) || 1 !== count( $row ) ) {
			throw new RuntimeException( $error_code );
		}
		return $row[0];
	}

	/** @return string */
	private function native_sql_mode() {
		$value = $this->native_scalar_required( 'SELECT @@SESSION.sql_mode', 'v1_migration_sql_mode_probe_failed' );
		if ( ! is_string( $value ) ) {
			throw new RuntimeException( 'v1_migration_sql_mode_probe_failed' );
		}
		return $value;
	}

	/** @return string */
	private function hardened_sql_mode( $current ) {
		$modes = array_values( array_filter( array_map( 'trim', explode( ',', strtoupper( (string) $current ) ) ), 'strlen' ) );
		if ( ! in_array( 'STRICT_TRANS_TABLES', $modes, true ) && ! in_array( 'STRICT_ALL_TABLES', $modes, true ) ) {
			$modes[] = 'STRICT_TRANS_TABLES';
		}
		foreach ( array( 'NO_ZERO_IN_DATE', 'NO_ZERO_DATE' ) as $required ) {
			if ( ! in_array( $required, $modes, true ) ) {
				$modes[] = $required;
			}
		}
		return implode( ',', $modes );
	}

	/** @return void */
	private function native_set_sql_mode( $mode ) {
		$this->native_query_required(
			$this->prepare( 'SET SESSION sql_mode = %s', (string) $mode ),
			'v1_migration_sql_mode_set_failed'
		);
	}

	/** @return void */
	private function assert_sql_mode_hardened() {
		$modes = array_map( 'trim', explode( ',', strtoupper( $this->native_sql_mode() ) ) );
		if (
			( ! in_array( 'STRICT_TRANS_TABLES', $modes, true ) && ! in_array( 'STRICT_ALL_TABLES', $modes, true ) )
			|| ! in_array( 'NO_ZERO_IN_DATE', $modes, true )
			|| ! in_array( 'NO_ZERO_DATE', $modes, true )
		) {
			throw new RuntimeException( 'v1_migration_sql_mode_verify_failed' );
		}
	}

	/** @return string */
	private function native_isolation_level() {
		$sql   = $this->server_is_mariadb() ? 'SELECT @@SESSION.tx_isolation' : 'SELECT @@SESSION.transaction_isolation';
		$value = strtoupper( str_replace( array( '_', ' ' ), '-', (string) $this->native_scalar_required( $sql, 'v1_commission_isolation_probe_failed' ) ) );
		if ( ! in_array( $value, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new RuntimeException( 'v1_commission_isolation_probe_failed' );
		}
		return $value;
	}

	/** @return void */
	private function native_set_isolation_level( $level ) {
		if ( ! in_array( $level, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new RuntimeException( 'v1_commission_isolation_invalid' );
		}
		$sql_level = str_replace( '-', ' ', $level );
		$this->native_query_required( 'SET SESSION TRANSACTION ISOLATION LEVEL ' . $sql_level, 'v1_commission_isolation_failed' );
	}

	/** @return bool */
	private function native_transaction_is_active() {
		return $this->native_transaction_probe( 'v1_commission_transaction_probe_failed' );
	}

	/** @return bool */
	private function server_is_mariadb() {
		if ( null !== $this->is_mariadb ) {
			return $this->is_mariadb;
		}
		$version = $this->guarded_scalar( 'SELECT VERSION()', 'v1_database_server_identity_unavailable' );
		if ( ! is_string( $version ) || '' === $version ) {
			throw new RuntimeException( 'v1_database_server_identity_unavailable' );
		}
		$this->is_mariadb = false !== stripos( $version, 'mariadb' );
		return $this->is_mariadb;
	}

	/** @return int */
	private function current_connection_id() {
		$id = (int) $this->database->get_var( 'SELECT CONNECTION_ID()' );
		if ( $id <= 0 ) {
			throw new RuntimeException( 'v1_database_connection_unavailable' );
		}
		return $id;
	}

	/** @return void */
	private function hit( $name ) {
		if ( is_callable( $this->failpoint ) ) {
			call_user_func( $this->failpoint, (string) $name );
		}
	}

	/** @return string */
	private function now() {
		$now = $this->native_scalar_required( 'SELECT UTC_TIMESTAMP(6)', 'v1_database_time_unavailable' );
		if ( ! $this->valid_ledger_timestamp( $now ) ) {
			throw new RuntimeException( 'v1_database_time_unavailable' );
		}
		return $now;
	}

	/** @return string */
	private function uuid_hex( $uuid ) {
		return bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $uuid ) );
	}

	/** @return string */
	private function prepare() {
		$args = func_get_args();
		$sql  = array_shift( $args );
		$out  = $this->database->prepare( $sql, $args );
		if ( ! is_string( $out ) || '' === $out ) {
			throw new RuntimeException( 'v1_database_prepare_failed' );
		}
		return $out;
	}

	/** @return void */
	private function query_required( $sql, $error_code ) {
		$this->verify_lock();
		$this->assert_sql_mode_hardened();
		$this->native_query_required( $sql, $error_code );
		$this->verify_lock();
	}

	/** @return void */
	private function query_exactly_one( $sql, $error_code ) {
		$this->verify_lock();
		$this->assert_sql_mode_hardened();
		$this->native_query_exactly_one( $sql, $error_code );
		$this->verify_lock();
	}

	/** @return array */
	private function rows( $sql ) {
		$this->verify_lock();
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows   = $this->database->get_results( $sql, $format );
		$this->assert_last_query_succeeded( 'v1_database_read_failed' );
		$this->verify_lock();
		if ( ! is_array( $rows ) ) {
			throw new RuntimeException( 'v1_database_read_failed' );
		}
		return $rows;
	}

	/** @return mixed */
	private function guarded_scalar( $sql, $error_code ) {
		$this->verify_lock();
		$value = $this->database->get_var( $sql );
		$this->assert_last_query_succeeded( $error_code );
		$this->verify_lock();
		return $value;
	}

	/** @return void */
	private function assert_last_query_succeeded( $error_code ) {
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error ) {
			throw new RuntimeException( $error_code );
		}
	}
}
