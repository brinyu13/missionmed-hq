<?php
/** Real disposable WordPress/InnoDB proof for the 8010D capability kernel. */

if ( ! defined( 'ABSPATH' ) || ! isset( $GLOBALS['wpdb'] ) ) {
	throw new RuntimeException( 'This fixture requires disposable WordPress.' );
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1 repository root is unavailable.' );
}

require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';

function v1_8010d_wp_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010d_wp_expect_failure( $callback, $message ) {
	$failed = false;
	try {
		$callback();
	} catch ( Throwable $error ) {
		$failed = true;
	}
	if ( ! $failed ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010d_wp_expect_error( $callback, $error_code, $message ) {
	$actual = null;
	try {
		$callback();
	} catch ( RuntimeException $error ) {
		$actual = $error->getMessage();
	}
	if ( $error_code !== $actual ) {
		throw new RuntimeException( $message . '; expected=' . $error_code . ' actual=' . ( null === $actual ? 'none' : $actual ) );
	}
}

function v1_8010d_wp_uuid( $counter, $lane ) {
	return sprintf( '%08x-%04x-4%03x-8%03x-%012x', $lane, $counter & 0xffff, $counter & 0xfff, $lane & 0xfff, $counter );
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1dmain_' );
$wpdb->suppress_errors( true );

$store_id  = '11111111-1111-4111-8111-111111111111';
$runner_a  = '22222222-2222-4222-8222-222222222222';
$runner_b  = '33333333-3333-4333-8333-333333333333';
$inspector = new MMED_V1_Study_Schema_Inspector( $wpdb );
$before    = $inspector->inspect();
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $before['state'], 'fresh isolated prefix starts physically absent' );

$wpdb->query( 'START TRANSACTION' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_session_not_clean',
	'migrator rejects an outer transaction before any DDL'
);
v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK' ), 'outer transaction rolls back cleanly after rejection' );
$still_absent = $inspector->inspect();
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $still_absent['state'], 'outer-transaction rejection leaves the kernel absent' );

$lock_name = 'mmed_v1_8010d_' . substr( hash( 'sha256', $inspector->schema_name() . "\n" . $wpdb->prefix ), 0, 40 );
v1_8010d_wp_expect( 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock_name ) ), 'fixture acquires the installer lock once' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_reentrant',
	'migrator rejects recursive same-session advisory-lock acquisition'
);
v1_8010d_wp_expect( 1 === (int) $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock_name ) ), 'fixture releases its single installer-lock reference' );
v1_8010d_wp_expect( null === $wpdb->get_var( $wpdb->prepare( 'SELECT IS_USED_LOCK(%s)', $lock_name ) ), 'recursive rejection does not increase advisory-lock depth' );

$result = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
v1_8010d_wp_expect( ! empty( $result['ok'] ) && 'ready' === $result['state'], 'explicit migration commissions generation 1' );
$after = $inspector->inspect();
v1_8010d_wp_expect( ! empty( $after['ok'] ) && MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === $after['state'], 'exact information_schema inspection passes' );

$repeat = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_b );
v1_8010d_wp_expect( ! empty( $repeat['ok'] ) && $repeat['manifest_hash'] === $result['manifest_hash'], 'same-store rerun is idempotent' );
v1_8010d_wp_expect_failure(
	static function () use ( $wpdb, $runner_b ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( '44444444-4444-4444-8444-444444444444', $runner_b );
	},
	'different store identity cannot adopt a commissioned kernel'
);

$tables = MMED_V1_Study_Schema::table_names( $wpdb );
$ledger = $wpdb->get_results( "SELECT migration_version, migration_id, state, attempt_count FROM `{$tables['migrations']}` ORDER BY migration_version", ARRAY_A );
v1_8010d_wp_expect( 5 === count( $ledger ), 'ledger has one row per immutable migration' );
foreach ( $ledger as $offset => $row ) {
	v1_8010d_wp_expect( ( $offset + 1 ) === (int) $row['migration_version'], 'ledger versions stay contiguous' );
	v1_8010d_wp_expect( 'applied' === $row['state'], 'every migration is applied' );
	v1_8010d_wp_expect( (int) $row['attempt_count'] >= 1, 'every migration records an attempt' );
}

$now = '2026-07-15 12:00:00.000000';
$bad = $wpdb->query(
	$wpdb->prepare(
		"INSERT INTO `{$tables['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, NULL, 1, NULL, 1, NULL, NULL, NULL, NULL, %s, %s)",
		9000,
		$now,
		$now
	)
);
v1_8010d_wp_expect( false === $bad, 'database rejects an impossible revision-1 Plan shape' );

foreach ( array( 9001, 9002 ) as $owner_id ) {
	$inserted = $wpdb->query(
		$wpdb->prepare(
			"INSERT INTO `{$tables['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, NULL, 1, NULL, 0, NULL, NULL, NULL, NULL, %s, %s)",
			$owner_id,
			$now,
			$now
		)
	);
	v1_8010d_wp_expect( 1 === (int) $inserted, 'multiple owners can hold permanent revision-0 fences' );
}

$plan_one      = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
$operation_one = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
$plan_json     = '{"schema_version":"1","weeks":[]}';
$plan_hash     = hash( 'sha256', $plan_json );
$updated       = $wpdb->query(
	$wpdb->prepare(
		"UPDATE `{$tables['plans']}` SET plan_id = UNHEX(%s), schema_version = %s, current_revision = 1, watermark_operation_id = UNHEX(%s), watermark_at = %s, plan_json = %s, plan_hash = UNHEX(%s), updated_at = %s WHERE owner_id = 9001 AND current_revision = 0",
		bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $plan_one ) ),
		'1',
		bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $operation_one ) ),
		$now,
		$plan_json,
		$plan_hash,
		$now
	)
);
v1_8010d_wp_expect( 1 === (int) $updated, 'synthetic first Plan snapshot satisfies shape constraint' );

$request_json = '{"action":"synthetic_seed","expected_revision":"0"}';
$result_json  = '{"revision":"1"}';
$insert_op    = static function ( $operation_id, $owner_id, $plan_id, $revision, $expected_revision, $key, $generation = 1 ) use ( $wpdb, $tables, $request_json, $result_json, $plan_hash, $now ) {
	$sql  = "INSERT INTO `{$tables['operations']}`";
	$sql .= ' (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at)';
	$sql .= ' VALUES (UNHEX(%s), %d, UNHEX(%s), %d, %d, %s, %s, UNHEX(%s), %d, %s, %s, %d, %s, UNHEX(%s), 200, %s, UNHEX(%s), %s)';
	return $wpdb->query(
		$wpdb->prepare(
			$sql,
			bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $operation_id ) ),
			$owner_id,
			bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $plan_id ) ),
			$revision,
			$expected_revision,
			$key,
			$request_json,
			hash( 'sha256', $request_json ),
			$owner_id,
			'learner',
			'synthetic_seed',
			$generation,
			'1',
			$plan_hash,
			$result_json,
			hash( 'sha256', $result_json ),
			$now
		)
	);
};

v1_8010d_wp_expect( 1 === (int) $insert_op( $operation_one, 9001, $plan_one, 1, 0, '0123456789abcdef' ), 'valid atomic receipt shape inserts' );
v1_8010d_wp_expect( false === $insert_op( 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 9001, $plan_one, 1, 0, 'fedcba9876543210' ), 'owner revision uniqueness rejects duplicate revision' );
v1_8010d_wp_expect( false === $insert_op( 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 9001, $plan_one, 2, 1, '0123456789abcdef' ), 'owner idempotency uniqueness rejects duplicate key' );
v1_8010d_wp_expect( false === $insert_op( 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 9001, $plan_one, 3, 0, 'abcdef0123456789' ), 'database rejects noncontiguous revision relation' );
v1_8010d_wp_expect( false === $insert_op( 'ffffffff-ffff-4fff-8fff-ffffffffffff', 9001, $plan_one, 2, 1, 'too-short' ), 'database rejects short idempotency keys' );
v1_8010d_wp_expect( false === $insert_op( '12345678-1234-4abc-8abc-1234567890ab', 9002, $plan_one, 1, 0, 'owner-two-key-01' ), 'composite foreign key rejects foreign-owner Plan identity' );
v1_8010d_wp_expect( false === $insert_op( '87654321-4321-4cba-8cba-ba0987654321', 9001, $plan_one, 2, 1, 'generation-key-1', 2 ), 'generation foreign key rejects unknown generation' );

$count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$tables['operations']}`" );
v1_8010d_wp_expect( 1 === $count, 'failed invariant probes leave exactly one valid receipt' );

if ( '1' === getenv( 'V1_D_EXTENDED' ) ) {
	$failpoints = array( 'after_lock', 'before_migration_1_ddl', 'after_migration_1_ddl', 'after_migration_1_verify', 'after_migration_1_applied' );
	foreach ( array( 2, 3, 4, 5 ) as $version ) {
		foreach ( array( 'before_migration_%d_record', 'after_migration_%d_record', 'before_migration_%d_ddl', 'after_migration_%d_ddl', 'after_migration_%d_verify', 'after_migration_%d_applied' ) as $pattern ) {
			$failpoints[] = sprintf( $pattern, $version );
		}
	}
	$failpoints = array_merge( $failpoints, array( 'before_commission', 'after_generation_insert', 'after_gate_insert', 'after_commission_commit' ) );
	foreach ( $failpoints as $index => $failpoint ) {
		$wpdb->set_prefix( sprintf( 'v1df%02d_', $index + 1 ) );
		$fired = false;
		$probe = static function ( $name ) use ( $failpoint, &$fired ) {
			if ( ! $fired && $name === $failpoint ) {
				$fired = true;
				throw new RuntimeException( 'synthetic_failpoint' );
			}
		};
		v1_8010d_wp_expect_failure(
			static function () use ( $wpdb, $probe, $index ) {
				( new MMED_V1_Study_Migrator( $wpdb, $probe ) )->run( v1_8010d_wp_uuid( $index + 1, 10 ), v1_8010d_wp_uuid( $index + 1, 11 ) );
			},
			'failpoint interrupts migration: ' . $failpoint
		);
		v1_8010d_wp_expect( $fired, 'requested failpoint was reached: ' . $failpoint );
		$recovered = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( v1_8010d_wp_uuid( $index + 1, 10 ), v1_8010d_wp_uuid( $index + 101, 11 ) );
		v1_8010d_wp_expect( ! empty( $recovered['ok'] ), 'restart reconciles failure boundary: ' . $failpoint );
	}
}

$wpdb->set_prefix( $original_prefix );
echo "V1 Study Schedule 8010D disposable WordPress/InnoDB: ok\n";
