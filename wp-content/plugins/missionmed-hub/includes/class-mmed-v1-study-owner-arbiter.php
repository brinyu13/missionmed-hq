<?php
/**
 * Unbound synthetic E3 shared-owner transaction arbiter.
 *
 * This file registers no hook, route, filter, option, installer, provider,
 * cron task, or CLI command. It is deliberately absent from plugin boot. The
 * only accepted use is a disposable MySQL/MariaDB fixture after the E0-E2
 * classes have been loaded explicitly.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Stable internal arbiter failure. Public callers receive bounded reasons. */
final class MMED_V1_Study_Owner_Arbiter_Exception extends RuntimeException {

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

/**
 * Exact synthetic owner arbiter shared by the isolated V1 fence and legacy
 * Calendar mutation oracle. It intentionally has no revision-zero importer:
 * the V1 repository must reject every non-empty locked Calendar snapshot.
 */
final class MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter implements MMED_V1_Study_Shared_Owner_Arbiter {

	const PATH_V1 = 'v1';
	const PATH_LEGACY = 'legacy';
	const CALENDAR_TYPE = 'study_block';
	const MAX_CALENDAR_ROWS = 4096;

	/** @var object */
	private $database;

	/** @var object */
	private $native_handle;

	/** @var string */
	private $calendar_table;

	/** @var string */
	private $options_table;

	/** @var callable|null */
	private $failpoint;

	/** @var int */
	private $connection_id = 0;

	/** @var string|null */
	private $locked_store_id;

	/** @var array|null */
	private $authority;

	/** @var array|null */
	private $calendar_snapshot;

	/** @var bool|null Commit-fresh path decision derived from locked controls. */
	private $authority_allowed;

	/** @var string|null */
	private $isolation_variable;

	/**
	 * @param object        $database WordPress database connection.
	 * @param callable|null $failpoint Synthetic barrier/failure injector only.
	 */
	public function __construct( $database, $failpoint = null ) {
		if (
			! is_object( $database )
			|| ! isset( $database->dbh )
			|| ! is_object( $database->dbh )
			|| ! isset( $database->prefix )
			|| ! is_string( $database->prefix )
			|| 1 !== preg_match( '/^[A-Za-z0-9_]+$/D', $database->prefix )
			|| ! method_exists( $database, 'prepare' )
			|| ! method_exists( $database, 'remove_placeholder_escape' )
			|| ( null !== $failpoint && ! is_callable( $failpoint ) )
		) {
			throw new InvalidArgumentException( 'V1 synthetic owner arbiter dependencies are invalid.' );
		}
		$this->database = $database;
		$this->native_handle = $database->dbh;
		$this->calendar_table = (string) $database->prefix . 'mmed_events';
		$this->options_table = (string) $database->prefix . 'options';
		$this->failpoint = $failpoint;
	}

	/** @return string */
	public function scope() {
		return self::SCOPE_SYNTHETIC_SHARED_OWNER;
	}

	/** @return array|null */
	public function locked_authority() {
		return is_array( $this->authority ) ? $this->authority : null;
	}

	/** @return array|null */
	public function locked_calendar_snapshot() {
		return is_array( $this->calendar_snapshot ) ? $this->calendar_snapshot : null;
	}

	/** Lock and validate the exact raw V1 control records on the V1 transaction. */
	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		$this->assert_fence_call( $database, $connection_id, $owner_id );
		$this->authority = null;
		$this->calendar_snapshot = null;
		$this->authority_allowed = null;
		$this->pin_shared_metadata_and_shapes();
		$this->lock_control_records( self::PATH_V1, $owner_id );
		$this->assert_transaction();
		return true;
	}

	/** Lock the permanent owner Plan and exact ordered Calendar Study census. */
	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		$this->assert_fence_call( $database, $connection_id, $owner_id );
		if (
			! is_array( $this->authority )
			|| self::PATH_V1 !== ( $this->authority['path'] ?? null )
			|| $owner_id !== (int) ( $this->authority['owner_id'] ?? 0 )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$plan = $this->lock_plan( $owner_id );
		$this->lock_calendar_set( $owner_id, $plan );
		$this->assert_transaction();
		return true;
	}

	/**
	 * Execute one exact legacy Study intent under the same owner mutex.
	 *
	 * This is intentionally not wired to Calendar runtime. It accepts no
	 * arbitrary callback and exposes no raw Calendar content in its result.
	 *
	 * @return array Bounded synthetic result.
	 */
	public function run_legacy_study_mutation( $owner_id, $actor_id, $actor_kind, $intent ) {
		$started = false;
		$isolation_changed = false;
		$original_isolation = null;
		$this->authority = null;
		$this->calendar_snapshot = null;
		$this->authority_allowed = null;
		$this->locked_store_id = null;
		try {
			$this->assert_identity( $owner_id, $actor_id, $actor_kind );
			$intent = $this->normalize_intent( $intent );
			$this->connection_id = $this->current_connection_id();
			$this->assert_clean_session();
			$original_isolation = $this->isolation_level();
			$this->assert_no_temporary_shadows();
			$provenance = ( new MMED_V1_Study_InnoDB_Repository( $this->database ) )->store_provenance();
			if (
				'commissioned' !== (string) ( $provenance['state'] ?? '' )
				|| 2 !== (int) ( $provenance['generation'] ?? 0 )
				|| ! is_string( $provenance['store_id'] ?? null )
			) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			$preflight_store_id = $provenance['store_id'];
			$this->set_isolation( 'READ-COMMITTED' );
			$isolation_changed = true;
			$this->execute( 'START TRANSACTION READ WRITE' );
			$started = true;
			$this->assert_transaction();
			$this->hit( 'after_begin' );

			$this->locked_store_id = $this->lock_store_gate();
			if ( ! hash_equals( $preflight_store_id, $this->locked_store_id ) ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			$this->hit( 'after_gate_lock' );
			$this->pin_shared_metadata_and_shapes();
			$this->lock_control_records( self::PATH_LEGACY, $owner_id );
			$this->hit( 'after_control_lock' );

			$now = $this->trusted_timestamp();
			$this->insert_or_existing_plan( $owner_id, $now );
			$plan = $this->lock_plan( $owner_id );
			if ( true !== $this->authority_allowed || '0' !== $plan['revision'] || true === $plan['watermark_present'] ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_write_disabled' );
			}
			$this->hit( 'after_plan_lock' );
			$this->lock_calendar_set( $owner_id, $plan );
			$this->hit( 'after_calendar_lock' );

			$event_id = $this->execute_legacy_intent( $owner_id, $intent, $now );
			$this->hit( 'after_calendar_write' );
			$this->assert_transaction();
			$this->hit( 'before_commit' );
			$this->execute( 'COMMIT AND NO CHAIN NO RELEASE' );
			$started = false;
			$this->assert_transaction_ended();
			$this->hit( 'after_commit' );
			$this->set_isolation( $original_isolation );
			$isolation_changed = false;
			return array(
				'event_id'   => $event_id,
				'ok'         => true,
				'reason_code'=> 'ok',
				'status'     => 'committed',
			);
		} catch ( Throwable $error ) {
			$cleanup_failed = false;
			if ( $started ) {
				try {
					$this->execute( 'ROLLBACK AND NO CHAIN NO RELEASE' );
					$started = false;
					$this->assert_transaction_ended();
				} catch ( Throwable $rollback_error ) {
					unset( $rollback_error );
					$cleanup_failed = true;
				}
			}
			if ( $isolation_changed && is_string( $original_isolation ) ) {
				try {
					$this->set_isolation( $original_isolation );
					$isolation_changed = false;
				} catch ( Throwable $isolation_error ) {
					unset( $isolation_error );
					$cleanup_failed = true;
				}
			}
			if ( $cleanup_failed ) {
				return $this->legacy_failure( 'dependency_unavailable' );
			}
			$reason = $error instanceof MMED_V1_Study_Owner_Arbiter_Exception
				? $error->reason_code()
				: 'dependency_unavailable';
			unset( $error );
			return $this->legacy_failure( $reason );
		}
	}

	/** @return array */
	private function legacy_failure( $reason ) {
		if ( ! in_array( $reason, array( 'legacy_conflict', 'legacy_write_disabled' ), true ) ) {
			$reason = 'dependency_unavailable';
		}
		return array(
			'event_id'    => null,
			'ok'          => false,
			'reason_code' => $reason,
			'status'      => 'dependency_unavailable' === $reason ? 'unavailable' : 'denied',
		);
	}

	/** Require exact learner ownership from server-derived identity. */
	private function assert_identity( $owner_id, $actor_id, $actor_kind ) {
		if ( ! is_int( $owner_id ) || $owner_id <= 0 || $owner_id !== $actor_id || 'learner' !== $actor_kind ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_write_disabled' );
		}
	}

	/** Validate one deliberately narrow legacy create/update/delete intent. */
	private function normalize_intent( $intent ) {
		if ( ! is_array( $intent ) || ! isset( $intent['action'] ) || ! is_string( $intent['action'] ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
		$action = $intent['action'];
		if ( 'create' === $action ) {
			$this->assert_exact_keys( $intent, array( 'action', 'end_at', 'start_at', 'status', 'title' ) );
			$this->assert_event_values( $intent );
			return $intent;
		}
		if ( 'update' === $action ) {
			$this->assert_exact_keys( $intent, array( 'action', 'end_at', 'event_id', 'expected_fingerprint', 'start_at', 'status', 'title' ) );
			$this->assert_event_id_and_fingerprint( $intent );
			$this->assert_event_values( $intent );
			return $intent;
		}
		if ( 'delete' === $action ) {
			$this->assert_exact_keys( $intent, array( 'action', 'event_id', 'expected_fingerprint' ) );
			$this->assert_event_id_and_fingerprint( $intent );
			return $intent;
		}
		throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
	}

	/** @return void */
	private function assert_exact_keys( $candidate, $expected ) {
		$keys = array_keys( $candidate );
		sort( $keys, SORT_STRING );
		$sorted_expected = $expected;
		sort( $sorted_expected, SORT_STRING );
		if ( $sorted_expected !== $keys ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
	}

	/** @return void */
	private function assert_event_id_and_fingerprint( $intent ) {
		if (
			! is_int( $intent['event_id'] )
			|| $intent['event_id'] <= 0
			|| ! is_string( $intent['expected_fingerprint'] )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $intent['expected_fingerprint'] )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
	}

	/** @return void */
	private function assert_event_values( $intent ) {
		if (
			! is_string( $intent['title'] )
			|| '' === trim( $intent['title'] )
			|| strlen( $intent['title'] ) > 255
			|| ! $this->valid_mysql_timestamp( $intent['start_at'] )
			|| ( null !== $intent['end_at'] && ! $this->valid_mysql_timestamp( $intent['end_at'] ) )
			|| ( null !== $intent['end_at'] && strcmp( $intent['end_at'], $intent['start_at'] ) <= 0 )
			|| ! in_array( $intent['status'], array( 'active', 'completed' ), true )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
	}

	/** Pin Calendar/options metadata and prove exact disposable physical support. */
	private function pin_shared_metadata_and_shapes() {
		$this->assert_no_temporary_shadows();
		foreach ( array( $this->options_table, $this->calendar_table ) as $table ) {
			$this->rows( "SELECT 1 AS v1_metadata_pin FROM `{$table}` WHERE 1 = 0 LOCK IN SHARE MODE" );
			$this->assert_transaction();
		}
		$this->assert_innodb_table( $this->options_table );
		$this->assert_calendar_shape();
	}

	/** Lock the physical store gate before any shared control or owner row. */
	private function lock_store_gate() {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT LOWER(HEX(sg.store_id)) AS store_hex, CAST(sg.current_generation AS CHAR) AS generation,';
		$sql .= ' sg.gate_state, g.writer_schema_version, g.current_reader_version, g.previous_reader_version,';
		$sql .= ' LOWER(HEX(g.manifest_hash)) AS manifest_hash';
		$sql .= " FROM `{$tables['store_gate']}` sg INNER JOIN `{$tables['generations']}` g";
		$sql .= ' ON g.store_id = sg.store_id AND g.generation = sg.current_generation';
		$sql .= ' WHERE sg.gate_key = 1 LIMIT 2 LOCK IN SHARE MODE';
		$rows = $this->rows( $sql );
		if (
			1 !== count( $rows )
			|| '2' !== (string) ( $rows[0]['generation'] ?? '' )
			|| 'ready' !== (string) ( $rows[0]['gate_state'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $rows[0]['writer_schema_version'] ?? '' )
			|| MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION !== (string) ( $rows[0]['current_reader_version'] ?? '' )
			|| null !== ( $rows[0]['previous_reader_version'] ?? null )
			|| MMED_V1_Study_Week_Schema::manifest_hash_hex( $this->database ) !== (string) ( $rows[0]['manifest_hash'] ?? '' )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return $this->uuid_from_hex( $rows[0]['store_hex'] ?? null );
	}

	/** Lock raw option bytes and derive immutable content-free authority. */
	private function lock_control_records( $path, $owner_id ) {
		if ( ! in_array( $path, array( self::PATH_V1, self::PATH_LEGACY ), true ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		if ( null === $this->locked_store_id ) {
			$this->locked_store_id = $this->lock_store_gate();
		}
		$sql = $this->prepare(
			"SELECT option_name, option_value FROM `{$this->options_table}` WHERE option_name IN (%s, %s) ORDER BY option_name LIMIT 3 LOCK IN SHARE MODE",
			MMED_V1_Study_Release::RELEASE_OPTION,
			MMED_V1_Study_Release::STORE_OPTION
		);
		$rows = $this->rows( $sql );
		$raw = array();
		foreach ( $rows as $row ) {
			$name = $row['option_name'] ?? null;
			$value = $row['option_value'] ?? null;
			if ( ! is_string( $name ) || ! is_string( $value ) || isset( $raw[ $name ] ) ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			$raw[ $name ] = $value;
		}
		if (
			2 !== count( $raw )
			|| ! array_key_exists( MMED_V1_Study_Release::STORE_OPTION, $raw )
			|| ! array_key_exists( MMED_V1_Study_Release::RELEASE_OPTION, $raw )
			|| ! function_exists( 'maybe_unserialize' )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$control = MMED_V1_Study_Control::from_records(
			maybe_unserialize( $raw[ MMED_V1_Study_Release::STORE_OPTION ] ),
			maybe_unserialize( $raw[ MMED_V1_Study_Release::RELEASE_OPTION ] )
		);
		$store = $control['store'] ?? null;
		$release = $control['release'] ?? null;
		if (
			empty( $control['resolved'] )
			|| ! is_array( $store )
			|| ! is_array( $release )
			|| 'commissioned' !== (string) ( $store['state'] ?? '' )
			|| 2 !== (int) ( $store['generation'] ?? 0 )
			|| $this->locked_store_id !== (string) ( $store['store_id'] ?? '' )
			|| 2 !== (int) ( $release['generation'] ?? 0 )
			|| MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION !== (string) ( $release['current_reader_version'] ?? '' )
			|| null !== ( $release['previous_reader_version'] ?? null )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$mode = MMED_V1_Study_Domain::resolve_mode(
			$release,
			array( 'state' => MMED_V1_Study_Domain::TRUTH_ABSENT, 'schema_version' => null, 'watermark_evidence' => false ),
			MMED_V1_Study_Domain::BINDING_READY,
			array( MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION )
		);
		$allowed = self::PATH_V1 === $path
			? ! empty( $mode['v1_writer_allowed'] )
			: ! empty( $mode['legacy_writer_allowed'] );
		$this->authority_allowed = $allowed;
		if ( ! $allowed && self::PATH_V1 === $path ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception(
				'dependency_unavailable'
			);
		}
		$authority = array(
			'connection_id'          => $this->connection_id,
			'current_reader_version' => (string) $release['current_reader_version'],
			'decision_12_state'       => (string) $release['decision_12_state'],
			'exposure'                => true === $release['exposure'],
			'generation'              => (int) $release['generation'],
			'mode'                    => (string) $release['mode'],
			'owner_id'                => $owner_id,
			'path'                    => $path,
			'previous_reader_version' => $release['previous_reader_version'],
			'release_digest'          => (string) $release['release_digest'],
			'release_record_hash'     => hash( 'sha256', $raw[ MMED_V1_Study_Release::RELEASE_OPTION ] ),
			'stop'                    => true === $release['stop'],
			'store_id_hash'           => hash( 'sha256', $this->locked_store_id ),
			'store_record_hash'        => hash( 'sha256', $raw[ MMED_V1_Study_Release::STORE_OPTION ] ),
		);
		$this->authority = array_merge(
			array( 'authority_hash' => hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $authority ) ) ),
			$authority
		);
		$this->assert_transaction();
	}

	/** Exact insert-or-existing permanent revision-zero owner mutex. */
	private function insert_or_existing_plan( $owner_id, $now ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = "INSERT INTO `{$tables['plans']}`";
		$sql .= ' (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at)';
		$sql .= ' SELECT %d, NULL, 2, NULL, 0, NULL, NULL, NULL, NULL, %s, %s';
		$sql .= " FROM `{$tables['store_gate']}` sg INNER JOIN `{$tables['generations']}` g";
		$sql .= ' ON g.store_id = sg.store_id AND g.generation = 2';
		$sql .= ' WHERE sg.gate_key = 1 AND sg.current_generation = 2 AND sg.gate_state = %s';
		$failure = null;
		$result = $this->native_query( $this->prepare( $sql, $owner_id, $now, $now, 'ready' ), $failure );
		if ( false === $result ) {
			if ( 1062 !== (int) ( $failure['errno'] ?? 0 ) || '23000' !== (string) ( $failure['sqlstate'] ?? '' ) ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			$this->assert_transaction();
			return;
		}
		if ( true !== $result || 1 !== $this->affected_rows() ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->assert_transaction();
	}

	/** Lock and minimally validate the permanent owner mutex row. */
	private function lock_plan( $owner_id ) {
		$tables = MMED_V1_Study_Schema::table_names( $this->database );
		$sql  = 'SELECT CAST(owner_id AS CHAR) AS owner_id, CAST(store_generation AS CHAR) AS generation,';
		$sql .= ' CAST(current_revision AS CHAR) AS revision, LOWER(HEX(plan_id)) AS plan_hex,';
		$sql .= ' schema_version, LOWER(HEX(watermark_operation_id)) AS watermark_hex, watermark_at,';
		$sql .= ' plan_json, LOWER(HEX(plan_hash)) AS plan_hash_hex, created_at, updated_at';
		$sql .= " FROM `{$tables['plans']}` WHERE owner_id = %d LIMIT 2 FOR UPDATE";
		$rows = $this->rows( $this->prepare( $sql, $owner_id ) );
		if ( 1 !== count( $rows ) || (string) $owner_id !== (string) ( $rows[0]['owner_id'] ?? '' ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$row = $rows[0];
		$revision = $this->decimal_revision( $row['revision'] ?? null );
		$watermark_present = null !== ( $row['watermark_hex'] ?? null ) || null !== ( $row['watermark_at'] ?? null );
		if ( '0' === $revision ) {
			if (
				null !== ( $row['plan_hex'] ?? null )
				|| null !== ( $row['schema_version'] ?? null )
				|| $watermark_present
				|| null !== ( $row['plan_json'] ?? null )
				|| null !== ( $row['plan_hash_hex'] ?? null )
			) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
		} elseif (
			'2' !== (string) ( $row['generation'] ?? '' )
			|| MMED_V1_Study_Week_Schema::SCHEMA_VERSION !== (string) ( $row['schema_version'] ?? '' )
			|| ! $this->is_uuid_hex( $row['plan_hex'] ?? null )
			|| ! $this->is_uuid_hex( $row['watermark_hex'] ?? null )
			|| ! $this->valid_mysql_timestamp( $row['watermark_at'] ?? null, true )
			|| ! is_string( $row['plan_json'] ?? null )
			|| ! $this->is_hash_hex( $row['plan_hash_hex'] ?? null )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->assert_transaction();
		return array(
			'revision'          => $revision,
			'watermark_present' => $watermark_present,
		);
	}

	/** Lock every Study row for the owner in deterministic identity order. */
	private function lock_calendar_set( $owner_id, $plan ) {
		$sql  = 'SELECT CAST(id AS CHAR) AS event_id, CAST(user_id AS CHAR) AS owner_id, event_type, status,';
		$sql .= ' LOWER(SHA2(CONCAT_WS(CHAR(31), CAST(id AS CHAR), CAST(user_id AS CHAR), HEX(event_type),';
		$sql .= ' HEX(title), COALESCE(HEX(description), %s), HEX(start_at), COALESCE(HEX(end_at), %s),';
		$sql .= ' COALESCE(CAST(all_day AS CHAR), %s), COALESCE(HEX(location), %s), COALESCE(HEX(meeting_url), %s),';
		$sql .= ' COALESCE(HEX(meeting_platform), %s), COALESCE(HEX(recurrence), %s), COALESCE(HEX(recurrence_end), %s),';
		$sql .= ' COALESCE(CAST(parent_event_id AS CHAR), %s), COALESCE(HEX(source), %s), COALESCE(HEX(source_id), %s),';
		$sql .= ' COALESCE(HEX(category), %s), COALESCE(CAST(priority AS CHAR), %s), HEX(status), COALESCE(HEX(meta_json), %s),';
		$sql .= ' COALESCE(HEX(created_at), %s), COALESCE(HEX(updated_at), %s)), 256)) AS fingerprint';
		$sql .= " FROM `{$this->calendar_table}` WHERE user_id = %d AND event_type = %s";
		$sql .= ' ORDER BY id LIMIT ' . ( self::MAX_CALENDAR_ROWS + 1 ) . ' FOR UPDATE';
		$null = '~';
		$rows = $this->rows(
			$this->prepare(
				$sql,
				$null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null, $null,
				$owner_id,
				self::CALENDAR_TYPE
			)
		);
		if ( count( $rows ) > self::MAX_CALENDAR_ROWS ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$content_free = array();
		$previous = 0;
		foreach ( $rows as $row ) {
			$event_id = isset( $row['event_id'] ) && ctype_digit( (string) $row['event_id'] ) ? (int) $row['event_id'] : 0;
			if (
				$event_id <= $previous
				|| (string) $owner_id !== (string) ( $row['owner_id'] ?? '' )
				|| self::CALENDAR_TYPE !== (string) ( $row['event_type'] ?? '' )
				|| ! in_array( (string) ( $row['status'] ?? '' ), array( 'active', 'completed', 'cancelled' ), true )
				|| ! $this->is_hash_hex( $row['fingerprint'] ?? null )
			) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			$content_free[] = array(
				'event_id'   => $event_id,
				'fingerprint' => (string) $row['fingerprint'],
			);
			$previous = $event_id;
		}
		$this->calendar_snapshot = array(
			'aggregate_hash'    => hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $content_free ) ),
			'connection_id'     => $this->connection_id,
			'owner_id'          => $owner_id,
			'plan_revision'     => (string) $plan['revision'],
			'row_count'         => count( $content_free ),
			'rows'              => $content_free,
			'watermark_present' => true === $plan['watermark_present'],
		);
		$this->assert_transaction();
	}

	/** Execute one already-normalized exact legacy intent. */
	private function execute_legacy_intent( $owner_id, $intent, $now ) {
		$action = $intent['action'];
		if ( 'create' === $action ) {
			$sql = $this->prepare(
				"INSERT INTO `{$this->calendar_table}` (user_id, event_type, title, start_at, end_at, status, source, created_at, updated_at) VALUES (%d, %s, %s, %s, NULLIF(%s, ''), %s, %s, %s, %s)",
				$owner_id,
				self::CALENDAR_TYPE,
				$intent['title'],
				$intent['start_at'],
				$intent['end_at'],
				$intent['status'],
				'manual',
				$now,
				$now
			);
			$this->execute( $sql );
			$event_id = $this->insert_id();
			if ( $event_id <= 0 || 1 !== $this->affected_rows() ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
			return $event_id;
		}
		$current = null;
		foreach ( $this->calendar_snapshot['rows'] as $row ) {
			if ( $intent['event_id'] === $row['event_id'] ) {
				$current = $row;
				break;
			}
		}
		if ( ! is_array( $current ) || ! hash_equals( $intent['expected_fingerprint'], $current['fingerprint'] ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
		if ( 'update' === $action ) {
			$sql = $this->prepare(
				"UPDATE `{$this->calendar_table}` SET title = %s, start_at = %s, end_at = NULLIF(%s, ''), status = %s, updated_at = %s WHERE id = %d AND user_id = %d AND event_type = %s",
				$intent['title'],
				$intent['start_at'],
				$intent['end_at'],
				$intent['status'],
				$now,
				$intent['event_id'],
				$owner_id,
				self::CALENDAR_TYPE
			);
			$this->execute( $sql );
		} else {
			$sql = $this->prepare(
				"UPDATE `{$this->calendar_table}` SET status = %s, updated_at = %s WHERE id = %d AND user_id = %d AND event_type = %s",
				'cancelled',
				$now,
				$intent['event_id'],
				$owner_id,
				self::CALENDAR_TYPE
			);
			$this->execute( $sql );
		}
		if ( 1 !== $this->affected_rows() ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'legacy_conflict' );
		}
		return $intent['event_id'];
	}

	/** Prove the Calendar table is InnoDB, trigger-free, and has the owner index. */
	private function assert_calendar_shape() {
		$this->assert_innodb_table( $this->calendar_table );
		$schema = $this->schema_name();
		$required = array( 'id', 'user_id', 'event_type', 'title', 'description', 'start_at', 'end_at', 'all_day', 'location', 'meeting_url', 'meeting_platform', 'recurrence', 'recurrence_end', 'parent_event_id', 'source', 'source_id', 'category', 'priority', 'status', 'meta_json', 'created_at', 'updated_at' );
		$column_rows = $this->rows(
			$this->prepare(
				'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION',
				$schema,
				$this->calendar_table
			)
		);
		$actual = array();
		foreach ( $column_rows as $row ) {
			$actual[] = (string) ( $row['COLUMN_NAME'] ?? '' );
		}
		foreach ( $required as $column ) {
			if ( ! in_array( $column, $actual, true ) ) {
				throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
			}
		}
		$index_rows = $this->rows(
			$this->prepare(
				'SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY INDEX_NAME, SEQ_IN_INDEX',
				$schema,
				$this->calendar_table
			)
		);
		$indexes = array();
		foreach ( $index_rows as $row ) {
			$name = (string) ( $row['INDEX_NAME'] ?? '' );
			$sequence = (int) ( $row['SEQ_IN_INDEX'] ?? 0 );
			if ( '' !== $name && $sequence > 0 ) {
				$indexes[ $name ][ $sequence ] = (string) ( $row['COLUMN_NAME'] ?? '' );
			}
		}
		$found = false;
		foreach ( $indexes as $columns ) {
			ksort( $columns, SORT_NUMERIC );
			if ( array( 'user_id', 'event_type', 'id' ) === array_slice( array_values( $columns ), 0, 3 ) ) {
				$found = true;
				break;
			}
		}
		$triggers = $this->scalar(
			$this->prepare(
				'SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = %s AND EVENT_OBJECT_TABLE = %s',
				$schema,
				$this->calendar_table
			)
		);
		if ( ! $found || '0' !== (string) $triggers ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** Require one permanent InnoDB table in the pinned schema. */
	private function assert_innodb_table( $table ) {
		$rows = $this->rows(
			$this->prepare(
				'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s LIMIT 2',
				$this->schema_name(),
				$table
			)
		);
		if ( 1 !== count( $rows ) || 'innodb' !== strtolower( (string) ( $rows[0]['ENGINE'] ?? '' ) ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** Prove no exact permanent authority table is hidden by a temporary shadow. */
	private function assert_no_temporary_shadows() {
		$tables = array_merge(
			array_values( MMED_V1_Study_Schema::table_names( $this->database ) ),
			array_values( MMED_V1_Study_Week_Schema::table_names( $this->database ) ),
			array( $this->options_table, $this->calendar_table )
		);
		MMED_V1_Study_Native_Session_Guard::assert_no_temporary_table_shadows( $this->database, $this->connection_id, $tables );
		$this->assert_connection();
	}

	/** Require exact database object, owner and pinned transaction. */
	private function assert_fence_call( $database, $connection_id, $owner_id ) {
		if ( $database !== $this->database || ! is_int( $owner_id ) || $owner_id <= 0 || (int) $connection_id <= 0 ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->connection_id = (int) $connection_id;
		$this->assert_transaction();
	}

	/** Require one clean, writable, strict, utf8mb4 session. */
	private function assert_clean_session() {
		$this->assert_connection();
		if (
			'1' !== (string) $this->scalar( 'SELECT @@SESSION.autocommit' )
			|| '1' !== (string) $this->scalar( 'SELECT @@SESSION.foreign_key_checks' )
			|| '1' !== (string) $this->scalar( 'SELECT @@SESSION.unique_checks' )
			|| '0' !== (string) $this->scalar( $this->is_mariadb() ? 'SELECT @@SESSION.tx_read_only' : 'SELECT @@SESSION.transaction_read_only' )
			|| true === MMED_V1_Study_Native_Session_Guard::transaction_active( $this->database, $this->connection_id, 'v1_arbiter_transaction_probe_failed' )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$encoding = $this->rows( 'SELECT @@SESSION.character_set_client AS client_set, @@SESSION.character_set_connection AS connection_set, @@SESSION.character_set_results AS result_set, @@SESSION.collation_connection AS connection_collation' );
		$modes = array_map( 'trim', explode( ',', strtoupper( (string) $this->scalar( 'SELECT @@SESSION.sql_mode' ) ) ) );
		if (
			1 !== count( $encoding )
			|| 'utf8mb4' !== strtolower( (string) ( $encoding[0]['client_set'] ?? '' ) )
			|| 'utf8mb4' !== strtolower( (string) ( $encoding[0]['connection_set'] ?? '' ) )
			|| 'utf8mb4' !== strtolower( (string) ( $encoding[0]['result_set'] ?? '' ) )
			|| 0 !== strpos( strtolower( (string) ( $encoding[0]['connection_collation'] ?? '' ) ), 'utf8mb4_' )
			|| ( ! in_array( 'STRICT_TRANS_TABLES', $modes, true ) && ! in_array( 'STRICT_ALL_TABLES', $modes, true ) )
			|| ! in_array( 'NO_ENGINE_SUBSTITUTION', $modes, true )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** Require the exact pinned connection and an active transaction. */
	private function assert_transaction() {
		$this->assert_connection();
		if ( true !== MMED_V1_Study_Native_Session_Guard::transaction_active( $this->database, $this->connection_id, 'v1_arbiter_transaction_probe_failed' ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		if ( 'READ-COMMITTED' !== $this->isolation_level() ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** Require the transaction to be ended without accepting reconnect. */
	private function assert_transaction_ended() {
		$this->assert_connection();
		if ( true === MMED_V1_Study_Native_Session_Guard::transaction_active( $this->database, $this->connection_id, 'v1_arbiter_transaction_probe_failed' ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** Invoke a synthetic barrier and immediately re-prove transaction continuity. */
	private function hit( $name ) {
		if ( null === $this->failpoint ) {
			return;
		}
		call_user_func( $this->failpoint, (string) $name );
		if ( 'after_commit' === $name ) {
			$this->assert_transaction_ended();
		} else {
			$this->assert_transaction();
		}
	}

	/** @return int */
	private function current_connection_id() {
		$this->assert_connection( false );
		$id = $this->scalar( 'SELECT CONNECTION_ID()' );
		if ( ! is_numeric( $id ) || (int) $id <= 0 ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->connection_id = (int) $id;
		$this->assert_connection();
		return $this->connection_id;
	}

	/** Prove the same native handle and thread are still in use. */
	private function assert_connection( $require_id = true ) {
		$handle = isset( $this->database->dbh ) ? $this->database->dbh : null;
		$id = is_object( $handle ) && function_exists( 'mysqli_thread_id' ) ? @mysqli_thread_id( $handle ) : null;
		if (
			! is_object( $handle )
			|| $handle !== $this->native_handle
			|| ! is_int( $id )
			|| $id <= 0
			|| ( $require_id && $id !== $this->connection_id )
		) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** @return bool */
	private function is_mariadb() {
		return false !== stripos( (string) $this->scalar( 'SELECT VERSION()' ), 'mariadb' );
	}

	/** @return string */
	private function isolation_level() {
		if ( null === $this->isolation_variable ) {
			$this->isolation_variable = $this->is_mariadb() ? 'tx_isolation' : 'transaction_isolation';
		}
		$value = strtoupper( str_replace( ' ', '-', trim( (string) $this->scalar( 'SELECT @@SESSION.' . $this->isolation_variable ) ) ) );
		if ( ! in_array( $value, array( 'READ-UNCOMMITTED', 'READ-COMMITTED', 'REPEATABLE-READ', 'SERIALIZABLE' ), true ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return $value;
	}

	/** @return void */
	private function set_isolation( $level ) {
		$levels = array(
			'READ-UNCOMMITTED' => 'READ UNCOMMITTED',
			'READ-COMMITTED'   => 'READ COMMITTED',
			'REPEATABLE-READ'  => 'REPEATABLE READ',
			'SERIALIZABLE'     => 'SERIALIZABLE',
		);
		if ( ! isset( $levels[ $level ] ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->execute( 'SET SESSION TRANSACTION ISOLATION LEVEL ' . $levels[ $level ] );
		if ( $level !== $this->isolation_level() ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
	}

	/** @return string */
	private function trusted_timestamp() {
		$value = $this->scalar( "SELECT DATE_FORMAT(UTC_TIMESTAMP(6), '%Y-%m-%d %H:%i:%s.%f')" );
		if ( ! $this->valid_mysql_timestamp( $value, true ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return (string) $value;
	}

	/** @return string */
	private function schema_name() {
		$schema = $this->scalar( 'SELECT DATABASE()' );
		if ( ! is_string( $schema ) || 1 !== preg_match( '/^[A-Za-z0-9_$-]{1,64}$/D', $schema ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return $schema;
	}

	/** @return string */
	private function prepare( $query, ...$arguments ) {
		$sql = $this->database->prepare( $query, ...$arguments );
		if ( ! is_string( $sql ) || '' === $sql ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$sql = $this->database->remove_placeholder_escape( $sql );
		if ( ! is_string( $sql ) || '' === $sql ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return $sql;
	}

	/** @return array */
	private function rows( $sql ) {
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( ! is_object( $result ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$rows = array();
		while ( $row = @mysqli_fetch_assoc( $result ) ) {
			$rows[] = $row;
		}
		@mysqli_free_result( $result );
		$this->assert_connection( 0 !== $this->connection_id );
		return $rows;
	}

	/** @return mixed */
	private function scalar( $sql ) {
		$rows = $this->rows( $sql );
		if ( 1 !== count( $rows ) || 1 !== count( $rows[0] ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return reset( $rows[0] );
	}

	/** @return void */
	private function execute( $sql ) {
		$failure = null;
		$result = $this->native_query( $sql, $failure );
		if ( true !== $result ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		$this->assert_connection();
	}

	/** Normalize native query failures across strict and non-strict MySQLi. */
	private function native_query( $sql, &$failure ) {
		$this->assert_connection( 0 !== $this->connection_id );
		$failure = array( 'errno' => 0, 'sqlstate' => '' );
		try {
			$result = @mysqli_query( $this->native_handle, $sql );
		} catch ( Throwable $error ) {
			$failure['errno'] = (int) $error->getCode();
			$failure['sqlstate'] = method_exists( $error, 'getSqlState' )
				? (string) $error->getSqlState()
				: (string) @mysqli_sqlstate( $this->native_handle );
			return false;
		}
		if ( false === $result ) {
			$failure['errno'] = (int) @mysqli_errno( $this->native_handle );
			$failure['sqlstate'] = (string) @mysqli_sqlstate( $this->native_handle );
		}
		return $result;
	}

	/** @return int */
	private function affected_rows() {
		$this->assert_connection();
		$value = @mysqli_affected_rows( $this->native_handle );
		return is_int( $value ) ? $value : -1;
	}

	/** @return int */
	private function insert_id() {
		$this->assert_connection();
		$value = @mysqli_insert_id( $this->native_handle );
		return is_int( $value ) ? $value : (int) $value;
	}

	/** @return string */
	private function decimal_revision( $value ) {
		$value = is_string( $value ) ? $value : '';
		if ( 1 !== preg_match( '/^(?:0|[1-9][0-9]{0,18})$/D', $value ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return $value;
	}

	/** @return string */
	private function uuid_from_hex( $hex ) {
		if ( ! $this->is_uuid_hex( $hex ) ) {
			throw new MMED_V1_Study_Owner_Arbiter_Exception( 'dependency_unavailable' );
		}
		return substr( $hex, 0, 8 ) . '-' . substr( $hex, 8, 4 ) . '-' . substr( $hex, 12, 4 ) . '-' . substr( $hex, 16, 4 ) . '-' . substr( $hex, 20, 12 );
	}

	/** @return bool */
	private function is_uuid_hex( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[a-f0-9]{32}$/D', $value ) && '00000000000000000000000000000000' !== $value;
	}

	/** @return bool */
	private function is_hash_hex( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[a-f0-9]{64}$/D', $value );
	}

	/** @return bool */
	private function valid_mysql_timestamp( $value, $microseconds = false ) {
		if ( ! is_string( $value ) ) {
			return false;
		}
		$pattern = $microseconds
			? '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/D'
			: '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D';
		return 1 === preg_match( $pattern, $value ) && false !== strtotime( $value . ' UTC' );
	}
}
