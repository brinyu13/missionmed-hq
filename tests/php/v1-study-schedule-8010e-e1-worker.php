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
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';

$mode = isset( $argv[1] ) ? (string) $argv[1] : '';
$prefix = isset( $argv[2] ) ? (string) $argv[2] : '';
$store_id = isset( $argv[3] ) ? (string) $argv[3] : '';
$runner_id = isset( $argv[4] ) ? (string) $argv[4] : '';
$target = isset( $argv[5] ) ? (string) $argv[5] : '';

global $wpdb;
$wpdb->set_prefix( $prefix );
$connection_id = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );

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
