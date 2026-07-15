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
$server_version = (string) $wpdb->get_var( 'SELECT VERSION()' );
$is_mariadb     = false !== stripos( $server_version, 'mariadb' );
$isolation_variable = $is_mariadb ? '@@SESSION.tx_isolation' : '@@SESSION.transaction_isolation';
$initial_isolation  = (string) $wpdb->get_var( 'SELECT ' . $isolation_variable );
v1_8010d_wp_expect( 1 === preg_match( $is_mariadb ? '/^10\.11\./' : '/^8\.0\./', $server_version ), 'disposable database version is in the governed engine family' );

$store_id  = '11111111-1111-4111-8111-111111111111';
$runner_a  = '22222222-2222-4222-8222-222222222222';
$runner_b  = '33333333-3333-4333-8333-333333333333';
$inspector = new MMED_V1_Study_Schema_Inspector( $wpdb );
$before    = $inspector->inspect();
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $before['state'], 'fresh isolated prefix starts physically absent' );

foreach ( array( 'foreign_key_checks', 'unique_checks' ) as $session_guard ) {
	v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION ' . $session_guard . ' = 0' ), 'fixture disables ' . $session_guard );
	v1_8010d_wp_expect_error(
		static function () use ( $wpdb, $store_id, $runner_a ) {
			( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
		},
		'v1_migration_session_constraints_disabled',
		'migrator rejects disabled database constraint enforcement'
	);
	v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION ' . $session_guard . ' = 1' ), 'fixture restores ' . $session_guard );
}
if ( $is_mariadb ) {
	v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION check_constraint_checks = 0' ), 'fixture disables MariaDB CHECK enforcement' );
	v1_8010d_wp_expect_error(
		static function () use ( $wpdb, $store_id, $runner_a ) {
			( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
		},
		'v1_migration_session_constraints_disabled',
		'migrator rejects disabled MariaDB CHECK enforcement'
	);
	v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION check_constraint_checks = 1' ), 'fixture restores MariaDB CHECK enforcement' );
}
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $inspector->inspect()['state'], 'constraint-gate rejection leaves the kernel absent' );

$original_sql_mode = (string) $wpdb->get_var( 'SELECT @@SESSION.sql_mode' );
v1_8010d_wp_expect( false !== $wpdb->query( "SET SESSION sql_mode = ''" ), 'fixture disables strict SQL mode' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_session_sql_mode_unsafe',
	'migrator rejects non-strict SQL coercion before DDL'
);
v1_8010d_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'SET SESSION sql_mode = %s', $original_sql_mode ) ), 'fixture restores strict SQL mode' );

v1_8010d_wp_expect( false !== $wpdb->query( 'SET autocommit = 0' ), 'fixture disables autocommit' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_session_not_clean',
	'migrator rejects autocommit-disabled sessions before DDL'
);
v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK' ) && false !== $wpdb->query( 'SET autocommit = 1' ), 'fixture restores autocommit' );

v1_8010d_wp_expect( false !== $wpdb->query( 'CREATE TEMPORARY TABLE v1d_transaction_sentinel (sentinel_id int NOT NULL PRIMARY KEY) ENGINE=InnoDB' ), 'fixture creates a session-local transaction sentinel' );
$wpdb->query( 'START TRANSACTION' );
v1_8010d_wp_expect( 1 === (int) $wpdb->query( 'INSERT INTO v1d_transaction_sentinel (sentinel_id) VALUES (1)' ), 'outer transaction writes a sentinel before the probe' );
v1_8010d_wp_expect( false !== $wpdb->query( 'SAVEPOINT caller_anchor' ), 'outer transaction creates a caller-owned savepoint' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_session_not_clean',
	'migrator rejects an outer transaction before any DDL'
);
v1_8010d_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM v1d_transaction_sentinel' ), 'transaction probe preserves the caller sentinel write' );
v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK TO SAVEPOINT caller_anchor' ), 'transaction probe preserves caller savepoints and outer state' );
v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK' ), 'outer transaction rolls back cleanly after rejection' );
v1_8010d_wp_expect( 0 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM v1d_transaction_sentinel' ), 'caller rollback removes its own sentinel write' );
v1_8010d_wp_expect( false !== $wpdb->query( 'DROP TEMPORARY TABLE v1d_transaction_sentinel' ), 'fixture removes the session-local transaction sentinel' );
$still_absent = $inspector->inspect();
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $still_absent['state'], 'outer-transaction rejection leaves the kernel absent' );

v1_8010d_wp_expect( false !== $wpdb->query( 'START TRANSACTION READ ONLY' ), 'fixture starts an explicit read-only transaction' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_session_not_clean',
	'migrator rejects an outer read-only transaction'
);
v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK' ), 'read-only outer transaction rolls back cleanly' );

$xa_id = 'v1_8010d_synthetic_xa';
v1_8010d_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'XA START %s', $xa_id ) ), 'fixture starts a synthetic XA transaction' );
$xa_error = null;
try {
	( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
} catch ( RuntimeException $error ) {
	$xa_error = $error->getMessage();
}
v1_8010d_wp_expect(
	in_array( $xa_error, array( 'v1_migration_session_not_clean', 'v1_migration_transaction_probe_failed' ), true ),
	'active XA is classified as active or probe-failed, never as a clean session'
);
v1_8010d_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'XA END %s', $xa_id ) ), 'fixture ends the synthetic XA branch' );
v1_8010d_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'XA ROLLBACK %s', $xa_id ) ), 'fixture rolls back the synthetic XA branch' );

if ( ! $is_mariadb ) {
	$consumer_enabled = (string) $wpdb->get_var( "SELECT ENABLED FROM performance_schema.setup_consumers WHERE NAME = 'events_transactions_current'" );
	v1_8010d_wp_expect( 'YES' === $consumer_enabled, 'MySQL transaction consumer starts enabled in isolated CI' );
	v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE performance_schema.setup_consumers SET ENABLED = 'NO' WHERE NAME = 'events_transactions_current'" ), 'fixture disables optional MySQL transaction instrumentation' );
	v1_8010d_wp_expect( false !== $wpdb->query( 'START TRANSACTION' ), 'fixture starts an outer transaction without PFS transaction events' );
	v1_8010d_wp_expect_error(
		static function () use ( $wpdb, $store_id, $runner_a ) {
			( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
		},
		'v1_migration_session_not_clean',
		'native transaction probe rejects an outer transaction without PFS authority'
	);
	v1_8010d_wp_expect( false !== $wpdb->query( 'ROLLBACK' ), 'uninstrumented outer transaction rolls back cleanly' );
	v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE performance_schema.setup_consumers SET ENABLED = 'YES' WHERE NAME = 'events_transactions_current'" ), 'fixture restores MySQL transaction instrumentation' );
}

$absent_tables = MMED_V1_Study_Schema::table_names( $wpdb );
v1_8010d_wp_expect( false !== $wpdb->query( "CREATE TEMPORARY TABLE `{$absent_tables['migrations']}` (probe int NOT NULL) ENGINE=InnoDB" ), 'fixture creates a same-named temporary shadow before persistent DDL' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_a ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
	},
	'v1_migration_temporary_shadow_detected',
	'migrator rejects a same-session temporary shadow before persistent DDL'
);
v1_8010d_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$absent_tables['migrations']}`" ), 'shadow rejection preserves the caller temporary table' );
v1_8010d_wp_expect( false !== $wpdb->query( "DROP TEMPORARY TABLE `{$absent_tables['migrations']}`" ), 'fixture removes its pre-DDL temporary shadow' );
v1_8010d_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $inspector->inspect()['state'], 'temporary-shadow rejection leaves the permanent kernel absent' );

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

$main_connection = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION completion_type = 2' ), 'fixture requests RELEASE completion semantics' );
$result = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_a );
v1_8010d_wp_expect( $main_connection === (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' ), 'explicit NO RELEASE keeps the commissioning connection alive' );
v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION completion_type = 0' ), 'fixture restores default completion semantics' );
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

$wpdb->set_prefix( 'v1dcompletion_' );
$completion_connection = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
$completion_failed     = false;
$completion_probe      = static function ( $name ) use ( &$completion_failed ) {
	if ( ! $completion_failed && 'after_generation_insert' === $name ) {
		$completion_failed = true;
		throw new RuntimeException( 'synthetic_completion_rollback' );
	}
};
v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION completion_type = 1' ), 'fixture requests CHAIN completion semantics' );
v1_8010d_wp_expect_failure(
	static function () use ( $wpdb, $completion_probe ) {
		( new MMED_V1_Study_Migrator( $wpdb, $completion_probe ) )->run( '12121212-1212-4121-8121-121212121212', '34343434-3434-4343-8343-343434343434' );
	},
	'synthetic commissioning failure exercises explicit rollback completion'
);
v1_8010d_wp_expect( $completion_failed, 'completion rollback failpoint was reached' );
v1_8010d_wp_expect( $completion_connection === (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' ), 'explicit NO RELEASE keeps the rollback connection alive' );
$completion_recovered = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( '12121212-1212-4121-8121-121212121212', '56565656-5656-4565-8565-565656565656' );
v1_8010d_wp_expect( ! empty( $completion_recovered['ok'] ), 'explicit NO CHAIN leaves a clean session for rollback recovery' );
v1_8010d_wp_expect( false !== $wpdb->query( 'SET SESSION completion_type = 0' ), 'fixture restores completion semantics after rollback proof' );
$wpdb->set_prefix( 'v1dmain_' );

$tables = MMED_V1_Study_Schema::table_names( $wpdb );
$migration_ddl = MMED_V1_Study_Schema::migrations( $wpdb )[0]['sql'];
$temporary_ddl = preg_replace( '/^CREATE TABLE /', 'CREATE TEMPORARY TABLE ', $migration_ddl, 1 );
v1_8010d_wp_expect( is_string( $temporary_ddl ) && false !== $wpdb->query( $temporary_ddl ), 'fixture creates an exact-shape temporary ledger shadow beside the permanent table' );
v1_8010d_wp_expect_error(
	static function () use ( $wpdb, $store_id, $runner_b ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_b );
	},
	'v1_migration_temporary_shadow_detected',
	'exact-shape temporary ledger cannot shadow durable migration authority'
);
v1_8010d_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$tables['migrations']}`" ), 'shadow rejection preserves the caller exact-shape temporary ledger' );
v1_8010d_wp_expect( false !== $wpdb->query( "DROP TEMPORARY TABLE `{$tables['migrations']}`" ), 'fixture removes its exact-shape temporary ledger shadow' );
v1_8010d_wp_expect( 5 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$tables['migrations']}`" ), 'durable ledger remains complete after temporary-shadow rejection' );
$ledger = $wpdb->get_results( "SELECT migration_version, migration_id, state, attempt_count FROM `{$tables['migrations']}` ORDER BY migration_version", ARRAY_A );
v1_8010d_wp_expect( 5 === count( $ledger ), 'ledger has one row per immutable migration' );
foreach ( $ledger as $offset => $row ) {
	v1_8010d_wp_expect( ( $offset + 1 ) === (int) $row['migration_version'], 'ledger versions stay contiguous' );
	v1_8010d_wp_expect( 'applied' === $row['state'], 'every migration is applied' );
	v1_8010d_wp_expect( (int) $row['attempt_count'] >= 1, 'every migration records an attempt' );
}

$ledger_snapshot = $wpdb->get_row(
	"SELECT state, checkpoint, HEX(runner_id) AS runner_hex, failure_code, started_at, applied_at, updated_at FROM `{$tables['migrations']}` WHERE migration_version = 5",
	ARRAY_A
);
v1_8010d_wp_expect( is_array( $ledger_snapshot ) && 'applied' === $ledger_snapshot['state'], 'fixture captures the canonical applied ledger row' );
$restore_ledger = static function () use ( $wpdb, $tables, $ledger_snapshot ) {
	$sql  = "UPDATE `{$tables['migrations']}` SET state = %s, checkpoint = %s, runner_id = UNHEX(%s), failure_code = NULL,";
	$sql .= ' started_at = %s, applied_at = %s, updated_at = %s WHERE migration_version = 5';
	return $wpdb->query(
		$wpdb->prepare(
			$sql,
			$ledger_snapshot['state'],
			$ledger_snapshot['checkpoint'],
			$ledger_snapshot['runner_hex'],
			$ledger_snapshot['started_at'],
			$ledger_snapshot['applied_at'],
			$ledger_snapshot['updated_at']
		)
	);
};
$rerun_main = static function () use ( $wpdb, $store_id, $runner_b ) {
	( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_b );
};

v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$tables['migrations']}` SET runner_id = UNHEX(REPEAT('00', 16)) WHERE migration_version = 5" ), 'fixture corrupts ledger runner identity' );
v1_8010d_wp_expect_error( $rerun_main, 'v1_migration_ledger_mismatch', 'all-zero runner identity fails closed' );
v1_8010d_wp_expect( 1 === (int) $restore_ledger(), 'fixture restores canonical ledger runner identity' );

v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$tables['migrations']}` SET checkpoint = 'before_ddl' WHERE migration_version = 5" ), 'fixture corrupts applied ledger checkpoint' );
v1_8010d_wp_expect_error( $rerun_main, 'v1_migration_ledger_state_invalid', 'applied ledger checkpoint mismatch fails closed' );
v1_8010d_wp_expect( 1 === (int) $restore_ledger(), 'fixture restores canonical ledger checkpoint' );

v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$tables['migrations']}` SET applied_at = NULL WHERE migration_version = 5" ), 'fixture removes applied ledger timestamp' );
v1_8010d_wp_expect_error( $rerun_main, 'v1_migration_ledger_state_invalid', 'missing applied timestamp fails closed' );
v1_8010d_wp_expect( 1 === (int) $restore_ledger(), 'fixture restores canonical applied timestamp' );

v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$tables['migrations']}` SET updated_at = DATE_SUB(started_at, INTERVAL 1 SECOND) WHERE migration_version = 5" ), 'fixture reverses ledger timestamp order' );
v1_8010d_wp_expect_error( $rerun_main, 'v1_migration_ledger_mismatch', 'reversed ledger timestamp order fails closed' );
v1_8010d_wp_expect( 1 === (int) $restore_ledger(), 'fixture restores canonical ledger timestamp order' );

v1_8010d_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$tables['migrations']}` SET state = 'failed', checkpoint = 'failed', failure_code = 'ddl_failed', applied_at = NULL WHERE migration_version = 5" ), 'fixture creates a structurally valid terminal failed row beside an exact table' );
v1_8010d_wp_expect_error( $rerun_main, 'v1_migration_failed_requires_review', 'failed migration cannot be silently rehabilitated by exact table state' );
v1_8010d_wp_expect( 1 === (int) $restore_ledger(), 'fixture restores canonical applied ledger state' );
v1_8010d_wp_expect( ! empty( ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_b )['ok'] ), 'restored ledger remains commission-compatible' );

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

$wpdb->set_prefix( 'v1dcheck_' );
$check_store = 'abcdefab-cdef-4abc-8def-abcdefabcdef';
$check_run   = 'abcdefab-cdef-4abc-9def-abcdefabcdef';
( new MMED_V1_Study_Migrator( $wpdb ) )->run( $check_store, $check_run );
$check_tables      = MMED_V1_Study_Schema::table_names( $wpdb );
$check_constraints = MMED_V1_Study_Schema::constraint_names( $wpdb );
$trigger_name      = 'v1_8010d_owned_plan_guard';
v1_8010d_wp_expect(
	false !== $wpdb->query( "CREATE TRIGGER `{$trigger_name}` BEFORE UPDATE ON `{$check_tables['plans']}` FOR EACH ROW SET NEW.updated_at = NEW.updated_at" ),
	'fixture installs an unowned trigger on a disposable owned table'
);
$trigger_drift = ( new MMED_V1_Study_Schema_Inspector( $wpdb ) )->inspect_table( 'plans' );
v1_8010d_wp_expect( empty( $trigger_drift['ok'] ), 'owned-table trigger fails exact inspection' );
v1_8010d_wp_expect( in_array( $check_tables['plans'] . ':trigger_set', $trigger_drift['errors'], true ), 'trigger drift has a stable structural error' );
v1_8010d_wp_expect( false !== $wpdb->query( "DROP TRIGGER `{$trigger_name}`" ), 'fixture removes the disposable unowned trigger' );
v1_8010d_wp_expect( ! empty( ( new MMED_V1_Study_Schema_Inspector( $wpdb ) )->inspect_table( 'plans' )['ok'] ), 'trigger removal restores exact table compatibility' );

$drop_check_sql = $is_mariadb
	? "ALTER TABLE `{$check_tables['plans']}` DROP CONSTRAINT `{$check_constraints['plan_shape']}`"
	: "ALTER TABLE `{$check_tables['plans']}` DROP CHECK `{$check_constraints['plan_shape']}`";
v1_8010d_wp_expect( false !== $wpdb->query( $drop_check_sql ), 'fixture removes the exact Plan CHECK in disposable schema' );
v1_8010d_wp_expect(
	false !== $wpdb->query( "ALTER TABLE `{$check_tables['plans']}` ADD CONSTRAINT `{$check_constraints['plan_shape']}` CHECK (1 = 1)" ),
	'fixture installs a same-named no-op CHECK in disposable schema'
);
$check_drift = ( new MMED_V1_Study_Schema_Inspector( $wpdb ) )->inspect_table( 'plans' );
v1_8010d_wp_expect( empty( $check_drift['ok'] ), 'same-named no-op CHECK fails exact inspection' );
v1_8010d_wp_expect( in_array( $check_tables['plans'] . ':check_set', $check_drift['errors'], true ), 'CHECK clause drift has a stable structural error' );

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

$environment = $wpdb->get_row(
	'SELECT @@SESSION.sql_mode AS sql_mode, @@SESSION.autocommit AS autocommit, @@SESSION.foreign_key_checks AS foreign_key_checks,'
	. ' @@SESSION.unique_checks AS unique_checks, @@SESSION.character_set_client AS character_set_client,'
	. ' @@SESSION.character_set_connection AS character_set_connection, @@SESSION.character_set_results AS character_set_results,'
	. ' @@SESSION.collation_connection AS collation_connection, @@character_set_server AS character_set_server, @@collation_server AS collation_server',
	ARRAY_A
);
v1_8010d_wp_expect( is_array( $environment ), 'database environment evidence is readable' );
$environment['engine']          = $is_mariadb ? 'MariaDB' : 'MySQL';
$environment['server_version']  = $server_version;
$environment['isolation_level'] = (string) $wpdb->get_var( 'SELECT ' . $isolation_variable );
if ( $is_mariadb ) {
	$environment['check_constraint_checks'] = (string) $wpdb->get_var( 'SELECT @@SESSION.check_constraint_checks' );
}
v1_8010d_wp_expect( $initial_isolation === $environment['isolation_level'], 'commissioning restores the original isolation level' );
v1_8010d_wp_expect( $original_sql_mode === $environment['sql_mode'], 'adversarial SQL-mode fixture restores the exact original mode' );
v1_8010d_wp_expect( 1 === (int) $environment['autocommit'], 'database session ends with autocommit enabled' );
v1_8010d_wp_expect( 1 === (int) $environment['foreign_key_checks'] && 1 === (int) $environment['unique_checks'], 'database session ends with FK and UNIQUE enforcement enabled' );
v1_8010d_wp_expect( ! $is_mariadb || 1 === (int) $environment['check_constraint_checks'], 'MariaDB session ends with CHECK enforcement enabled' );
$environment_json = json_encode( $environment, JSON_UNESCAPED_SLASHES );
v1_8010d_wp_expect( is_string( $environment_json ), 'database environment evidence encodes deterministically' );

$wpdb->set_prefix( $original_prefix );
echo 'V1 Study Schedule 8010D environment: ' . $environment_json . "\n";
echo "V1 Study Schedule 8010D disposable WordPress/InnoDB: ok\n";
