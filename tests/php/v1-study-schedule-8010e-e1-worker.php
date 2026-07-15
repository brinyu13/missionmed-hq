<?php
/** Independent database-session worker for 8010E E1 crash and lock proofs. */

$wp_root = getenv( 'V1_WP_ROOT' );
$repo_root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $wp_root ) || '' === $wp_root || ! is_string( $repo_root ) || '' === $repo_root ) {
	fwrite( STDERR, "e1_worker_environment_invalid\n" );
	exit( 70 );
}

chdir( $wp_root );
require $wp_root . '/wp-load.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema-inspector.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';

$mode = isset( $argv[1] ) ? (string) $argv[1] : '';
$prefix = isset( $argv[2] ) ? (string) $argv[2] : '';
$store_id = isset( $argv[3] ) ? (string) $argv[3] : '';
$runner_id = isset( $argv[4] ) ? (string) $argv[4] : '';
$target = isset( $argv[5] ) ? (string) $argv[5] : '';

global $wpdb;
$wpdb->set_prefix( $prefix );
$connection_id = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );

/** Forward one live wpdb connection and hold exactly after its Plan SELECT. */
final class V1_8010E_E1_Held_Reader_DB {
	public $prefix;
	public $last_error = '';
	public $dbh;
	private $inner;
	private $connection_id;
	private $held = false;

	public function __construct( $inner, $connection_id ) {
		$this->inner = $inner;
		$this->prefix = $inner->prefix;
		$this->dbh = $inner->dbh;
		$this->connection_id = (int) $connection_id;
	}

	public function prepare() {
		return call_user_func_array( array( $this->inner, 'prepare' ), func_get_args() );
	}

	public function query() {
		$value = call_user_func_array( array( $this->inner, 'query' ), func_get_args() );
		$this->last_error = (string) $this->inner->last_error;
		return $value;
	}

	public function get_var() {
		$value = call_user_func_array( array( $this->inner, 'get_var' ), func_get_args() );
		$this->last_error = (string) $this->inner->last_error;
		return $value;
	}

	public function get_results( $sql ) {
		$value = call_user_func_array( array( $this->inner, 'get_results' ), func_get_args() );
		$this->last_error = (string) $this->inner->last_error;
		$plan_table = '`' . $this->prefix . 'mmed_v1_study_plans`';
		if (
			! $this->held
			&& false !== strpos( (string) $sql, ' plan_json,' )
			&& false !== strpos( (string) $sql, ' FROM ' . $plan_table )
			&& false !== strpos( (string) $sql, ' WHERE owner_id = 8011 ' )
		) {
			$this->held = true;
			if ( ! is_array( $value ) || 1 !== count( $value ) || ! is_array( $value[0] ) ) {
				throw new RuntimeException( 'e1_reader_barrier_plan_invalid' );
			}
			$revision = (string) ( $value[0]['current_revision'] ?? '' );
			$hash = (string) ( $value[0]['plan_hash_hex'] ?? '' );
			if ( '2' !== $revision || 1 !== preg_match( '/^[a-f0-9]{64}$/D', $hash ) ) {
				throw new RuntimeException( 'e1_reader_barrier_revision_invalid' );
			}
			echo 'READY reader_after_plan connection=' . $this->connection_id . ' revision=' . $revision . ' hash=' . $hash . "\n";
			fflush( STDOUT );
			$this->wait_for_release();
		}
		return $value;
	}

	private function wait_for_release() {
		stream_set_blocking( STDIN, false );
		$deadline = microtime( true ) + 45.0;
		while ( microtime( true ) < $deadline ) {
			$read = array( STDIN );
			$write = null;
			$except = null;
			$ready = stream_select( $read, $write, $except, 1, 0 );
			if ( false === $ready ) {
				throw new RuntimeException( 'e1_reader_barrier_select_failed' );
			}
			if ( 0 === $ready ) {
				continue;
			}
			$command = fgets( STDIN );
			if ( is_string( $command ) && 'GO' === trim( $command ) ) {
				return;
			}
			throw new RuntimeException( 'e1_reader_barrier_release_invalid' );
		}
		throw new RuntimeException( 'e1_reader_barrier_timeout' );
	}
}

/** Prepare portable test SQL under PHP 7.4 and later. */
function v1_8010e_e1_worker_prepare( $database, $sql, $arguments ) {
	$prepared = call_user_func_array( array( $database, 'prepare' ), array_merge( array( $sql ), $arguments ) );
	if ( ! is_string( $prepared ) || '' === $prepared ) {
		throw new RuntimeException( 'e1_writer_prepare_failed' );
	}
	return $prepared;
}

/** Convert one validated UUID into the lowercase hex accepted by UNHEX(). */
function v1_8010e_e1_worker_uuid_hex( $uuid ) {
	if ( ! is_string( $uuid ) || 1 !== preg_match( '/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $uuid ) ) {
		throw new RuntimeException( 'e1_writer_uuid_invalid' );
	}
	return str_replace( '-', '', $uuid );
}

/** Return one content-free current-reader observation. */
function v1_8010e_e1_worker_read( $database, $connection_id, $owner_id, $hold ) {
	$reader_database = $hold ? new V1_8010E_E1_Held_Reader_DB( $database, $connection_id ) : $database;
	$result = ( new MMED_V1_Study_Week_Current_Reader( $reader_database ) )->load( $owner_id );
	$revision = null;
	$hash = null;
	$title = null;
	if ( ! empty( $result['ok'] ) && is_array( $result['plan'] ?? null ) ) {
		$revision = (string) ( $result['plan']['revision'] ?? '' );
		$hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $result['plan'] ) );
		if ( isset( $result['plan']['weeks'][0]['blocks'][0]['title'] ) ) {
			$title = (string) $result['plan']['weeks'][0]['blocks'][0]['title'];
		}
	}
	return array(
		'state' => 'READ',
		'connection_id' => (int) $connection_id,
		'owner_id' => (int) $owner_id,
		'ok' => ! empty( $result['ok'] ),
		'reason_code' => (string) ( $result['reason_code'] ?? '' ),
		'revision' => $revision,
		'hash' => $hash,
		'title' => $title,
	);
}

/** Seed a second, distinguishable positive owner without any Week rows. */
function v1_8010e_e1_worker_seed_owner_2( $database, $connection_id ) {
	$owner_id = 8012;
	$plan_id = '8010e100-0000-4000-8000-000000000020';
	$operation_id = '8010e100-0000-4000-8000-000000000021';
	$now = '2026-07-15 12:01:30.000000';
	$snapshot = array(
		'plan_id' => $plan_id,
		'revision' => '1',
		'schema_version' => '2',
		'weeks' => array(),
	);
	$plan_json = MMED_V1_Study_Week_Domain::canonical_json( $snapshot );
	$plan_hash = hash( 'sha256', $plan_json );
	$request_json = '{"action":"synthetic_owner_seed","expected_revision":"0"}';
	$result_json = '{"revision":"1"}';
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$started = false;
	try {
		if ( false === $database->query( 'START TRANSACTION' ) || '' !== (string) $database->last_error ) {
			throw new RuntimeException( 'e1_owner_seed_begin_failed' );
		}
		$started = true;
		$plan_sql = "INSERT INTO `{$kernel['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, UNHEX(%s), 2, %s, 1, UNHEX(%s), %s, %s, UNHEX(%s), %s, %s)";
		$plan_arguments = array( $owner_id, v1_8010e_e1_worker_uuid_hex( $plan_id ), '2', v1_8010e_e1_worker_uuid_hex( $operation_id ), $now, $plan_json, $plan_hash, $now, $now );
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $plan_sql, $plan_arguments ) ) ) {
			throw new RuntimeException( 'e1_owner_seed_plan_failed' );
		}
		$operation_sql = "INSERT INTO `{$kernel['operations']}` (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at) VALUES (UNHEX(%s), %d, UNHEX(%s), 1, 0, %s, %s, UNHEX(%s), %d, %s, %s, 2, %s, UNHEX(%s), 200, %s, UNHEX(%s), %s)";
		$operation_arguments = array(
			v1_8010e_e1_worker_uuid_hex( $operation_id ),
			$owner_id,
			v1_8010e_e1_worker_uuid_hex( $plan_id ),
			'8010e-e1-owner2-seed',
			$request_json,
			hash( 'sha256', $request_json ),
			$owner_id,
			'learner',
			'synthetic_owner_seed',
			'2',
			$plan_hash,
			$result_json,
			hash( 'sha256', $result_json ),
			$now,
		);
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $operation_sql, $operation_arguments ) ) ) {
			throw new RuntimeException( 'e1_owner_seed_receipt_failed' );
		}
		if ( false === $database->query( 'COMMIT' ) || '' !== (string) $database->last_error ) {
			throw new RuntimeException( 'e1_owner_seed_commit_failed' );
		}
		$started = false;
		return array(
			'state' => 'SEEDED',
			'connection_id' => (int) $connection_id,
			'owner_id' => $owner_id,
			'revision' => '1',
			'hash' => $plan_hash,
		);
	} catch ( Throwable $error ) {
		if ( $started ) {
			$database->query( 'ROLLBACK' );
		}
		throw $error;
	}
}

/** Atomically advance the synthetic revision-2 Plan while another reader is held. */
function v1_8010e_e1_worker_write_v3( $database, $connection_id ) {
	$owner_id = 8011;
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$week_tables = MMED_V1_Study_Week_Schema::table_names( $database );
	$started = false;
	try {
		if ( false === $database->query( 'START TRANSACTION' ) || '' !== (string) $database->last_error ) {
			throw new RuntimeException( 'e1_writer_begin_failed' );
		}
		$started = true;
		$plan_sql = "SELECT LOWER(HEX(plan_id)) AS plan_hex, CAST(store_generation AS CHAR) AS store_generation, schema_version, CAST(current_revision AS CHAR) AS current_revision, plan_json, LOWER(HEX(plan_hash)) AS plan_hash_hex FROM `{$kernel['plans']}` WHERE owner_id = %d FOR UPDATE";
		$plan_rows = $database->get_results( v1_8010e_e1_worker_prepare( $database, $plan_sql, array( $owner_id ) ), ARRAY_A );
		if ( '' !== (string) $database->last_error || ! is_array( $plan_rows ) || 1 !== count( $plan_rows ) ) {
			throw new RuntimeException( 'e1_writer_plan_lock_failed' );
		}
		$plan = $plan_rows[0];
		$old_json = (string) ( $plan['plan_json'] ?? '' );
		$old_hash = (string) ( $plan['plan_hash_hex'] ?? '' );
		$snapshot = json_decode( $old_json, true );
		if (
			'2' !== (string) ( $plan['store_generation'] ?? '' )
			|| '2' !== (string) ( $plan['schema_version'] ?? '' )
			|| '2' !== (string) ( $plan['current_revision'] ?? '' )
			|| 1 !== preg_match( '/^[a-f0-9]{32}$/D', (string) ( $plan['plan_hex'] ?? '' ) )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $old_hash )
			|| ! is_array( $snapshot )
			|| ! hash_equals( $old_json, MMED_V1_Study_Week_Domain::canonical_json( $snapshot ) )
			|| ! hash_equals( $old_hash, hash( 'sha256', $old_json ) )
			|| '2' !== (string) ( $snapshot['revision'] ?? '' )
			|| '2' !== (string) ( $snapshot['schema_version'] ?? '' )
			|| 1 !== count( $snapshot['weeks'] ?? array() )
			|| 1 !== count( $snapshot['weeks'][0]['blocks'] ?? array() )
			|| 'Retrieval practice' !== (string) ( $snapshot['weeks'][0]['blocks'][0]['title'] ?? '' )
		) {
			throw new RuntimeException( 'e1_writer_old_snapshot_invalid' );
		}

		$plan_hex = (string) $plan['plan_hex'];
		$week_id = (string) ( $snapshot['weeks'][0]['week_id'] ?? '' );
		$block_id = (string) ( $snapshot['weeks'][0]['blocks'][0]['block_id'] ?? '' );
		$week_hex = v1_8010e_e1_worker_uuid_hex( $week_id );
		$block_hex = v1_8010e_e1_worker_uuid_hex( $block_id );
		$snapshot['revision'] = '3';
		$snapshot['weeks'][0]['revision'] = '3';
		$snapshot['weeks'][0]['blocks'][0]['title'] = 'Retrieval practice advanced';
		unset( $snapshot['weeks'][0]['projection_hash'] );
		$snapshot['weeks'][0]['projection_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $snapshot['weeks'][0] ) );
		$new_json = MMED_V1_Study_Week_Domain::canonical_json( $snapshot );
		$new_hash = hash( 'sha256', $new_json );
		if ( hash_equals( $old_hash, $new_hash ) ) {
			throw new RuntimeException( 'e1_writer_snapshot_unchanged' );
		}

		$now = '2026-07-15 12:02:00.000000';
		$week_sql = "UPDATE `{$week_tables['weeks']}` SET updated_revision = 3, updated_at = %s WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND updated_revision = 1";
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $week_sql, array( $now, $owner_id, $plan_hex, $week_hex ) ) ) ) {
			throw new RuntimeException( 'e1_writer_week_cas_failed' );
		}
		$block_sql = "UPDATE `{$week_tables['blocks']}` SET title = %s, updated_revision = 3, updated_at = %s WHERE owner_id = %d AND plan_id = UNHEX(%s) AND week_id = UNHEX(%s) AND block_id = UNHEX(%s) AND title = %s AND updated_revision = 1";
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $block_sql, array( 'Retrieval practice advanced', $now, $owner_id, $plan_hex, $week_hex, $block_hex, 'Retrieval practice' ) ) ) ) {
			throw new RuntimeException( 'e1_writer_block_cas_failed' );
		}

		$operation_id = v1_8010e_e1_worker_uuid_hex( '8010e100-0000-4000-8000-000000000015' );
		$request_json = '{"action":"snapshot_tear_advance","expected_revision":"2"}';
		$result_json = '{"revision":"3"}';
		$operation_sql = "INSERT INTO `{$kernel['operations']}` (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at) VALUES (UNHEX(%s), %d, UNHEX(%s), 3, 2, %s, %s, UNHEX(%s), %d, %s, %s, 2, %s, UNHEX(%s), 200, %s, UNHEX(%s), %s)";
		$operation_arguments = array(
			$operation_id,
			$owner_id,
			$plan_hex,
			'8010e-e1-tear-v3-01',
			$request_json,
			hash( 'sha256', $request_json ),
			$owner_id,
			'learner',
			'snapshot_tear_advance',
			'2',
			$new_hash,
			$result_json,
			hash( 'sha256', $result_json ),
			$now,
		);
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $operation_sql, $operation_arguments ) ) ) {
			throw new RuntimeException( 'e1_writer_receipt_insert_failed' );
		}
		$update_plan_sql = "UPDATE `{$kernel['plans']}` SET current_revision = 3, plan_json = %s, plan_hash = UNHEX(%s), updated_at = %s WHERE owner_id = %d AND plan_id = UNHEX(%s) AND current_revision = 2 AND plan_hash = UNHEX(%s)";
		if ( 1 !== (int) $database->query( v1_8010e_e1_worker_prepare( $database, $update_plan_sql, array( $new_json, $new_hash, $now, $owner_id, $plan_hex, $old_hash ) ) ) ) {
			throw new RuntimeException( 'e1_writer_plan_cas_failed' );
		}
		if ( false === $database->query( 'COMMIT' ) || '' !== (string) $database->last_error ) {
			throw new RuntimeException( 'e1_writer_commit_failed' );
		}
		$started = false;
		return array(
			'state' => 'WROTE',
			'connection_id' => (int) $connection_id,
			'old_hash' => $old_hash,
			'new_hash' => $new_hash,
			'revision' => '3',
		);
	} catch ( Throwable $error ) {
		if ( $started ) {
			$database->query( 'ROLLBACK' );
		}
		throw $error;
	}
}

if ( 'observe-lock' === $mode ) {
	$inspector = new MMED_V1_Study_Schema_Inspector( $wpdb );
	$lock_name = 'mmed_v1_8010d_' . substr( hash( 'sha256', $inspector->schema_name() . "\n" . $prefix ), 0, 40 );
	$owner = $wpdb->get_var( $wpdb->prepare( 'SELECT IS_USED_LOCK(%s)', $lock_name ) );
	echo json_encode(
		array(
			'state' => 'OBSERVED',
			'connection_id' => $connection_id,
			'lock_owner' => null === $owner ? null : (int) $owner,
		),
		JSON_UNESCAPED_SLASHES
	) . "\n";
	exit( 0 );
}

if ( 'reader-hold' === $mode || 'reader-run' === $mode ) {
	$owner_id = '' === $target ? 8011 : (int) $target;
	try {
		echo json_encode(
			v1_8010e_e1_worker_read( $wpdb, $connection_id, $owner_id, 'reader-hold' === $mode ),
			JSON_UNESCAPED_SLASHES
		) . "\n";
		exit( 0 );
	} catch ( Throwable $error ) {
		fwrite( STDERR, 'e1_reader_worker_failed:' . $error->getMessage() . "\n" );
		exit( 75 );
	}
}

if ( 'writer-v3' === $mode ) {
	try {
		echo json_encode( v1_8010e_e1_worker_write_v3( $wpdb, $connection_id ), JSON_UNESCAPED_SLASHES ) . "\n";
		exit( 0 );
	} catch ( Throwable $error ) {
		fwrite( STDERR, 'e1_writer_worker_failed:' . $error->getMessage() . "\n" );
		exit( 76 );
	}
}

if ( 'seed-owner-2' === $mode ) {
	try {
		echo json_encode( v1_8010e_e1_worker_seed_owner_2( $wpdb, $connection_id ), JSON_UNESCAPED_SLASHES ) . "\n";
		exit( 0 );
	} catch ( Throwable $error ) {
		fwrite( STDERR, 'e1_owner_seed_worker_failed:' . $error->getMessage() . "\n" );
		exit( 77 );
	}
}

$parts = explode( '-', $mode );
$generation = isset( $parts[0] ) ? $parts[0] : '';
$behavior = isset( $parts[1] ) ? $parts[1] : '';
if ( ! in_array( $generation, array( 'g1', 'g2' ), true ) || ! in_array( $behavior, array( 'run', 'hold', 'busy' ), true ) ) {
	fwrite( STDERR, "e1_worker_mode_invalid\n" );
	exit( 71 );
}

$failpoint = null;
if ( 'hold' === $behavior ) {
	$failpoint = static function ( $name ) use ( $target, $connection_id ) {
		if ( $name !== $target ) {
			return;
		}
		echo 'READY ' . $name . ' connection=' . $connection_id . "\n";
		fflush( STDOUT );
		$command = fgets( STDIN );
		if ( ! is_string( $command ) || 'GO' !== trim( $command ) ) {
			fwrite( STDERR, "e1_worker_release_invalid\n" );
			exit( 72 );
		}
	};
}

try {
	$migrator = new MMED_V1_Study_Migrator( $wpdb, $failpoint );
	$result = 'g1' === $generation
		? $migrator->run( $store_id, $runner_id )
		: $migrator->run_week_generation( $store_id, $runner_id );
	if ( 'busy' === $behavior ) {
		fwrite( STDERR, "e1_worker_expected_busy_but_succeeded\n" );
		exit( 73 );
	}
	echo 'OK connection=' . $connection_id . ' generation=' . (int) $result['generation'] . "\n";
	exit( 0 );
} catch ( RuntimeException $error ) {
	if ( 'busy' === $behavior && 'v1_migration_busy' === $error->getMessage() ) {
		echo 'BUSY connection=' . $connection_id . "\n";
		exit( 0 );
	}
	fwrite( STDERR, 'e1_worker_failed:' . $error->getMessage() . "\n" );
	exit( 74 );
}
