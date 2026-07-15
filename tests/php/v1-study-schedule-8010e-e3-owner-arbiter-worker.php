<?php
/** Independent database-session worker for the unbound E3 owner arbiter. */

$wp_root = getenv( 'V1_WP_ROOT' );
$repo_root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $wp_root ) || '' === $wp_root || ! is_string( $repo_root ) || '' === $repo_root ) {
	fwrite( STDERR, "e3_arbiter_worker_environment_invalid\n" );
	exit( 70 );
}

chdir( $wp_root );
require $wp_root . '/wp-load.php';
foreach (
	array(
		'class-mmed-v1-study-schema.php',
		'class-mmed-v1-study-schema-inspector.php',
		'class-mmed-v1-study-week-schema.php',
		'class-mmed-v1-study-week-schema-inspector.php',
		'class-mmed-v1-study-week-domain.php',
		'class-mmed-v1-study-domain.php',
		'class-mmed-v1-study-repository.php',
		'class-mmed-v1-study-innodb-repository.php',
		'class-mmed-v1-study-release.php',
		'class-mmed-v1-study-command-service.php',
		'class-mmed-v1-study-week-command-state.php',
		'class-mmed-v1-study-innodb-command-repository.php',
		'class-mmed-v1-study-owner-arbiter.php',
	) as $source
) {
	require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/' . $source;
}

$mode = isset( $argv[1] ) ? (string) $argv[1] : '';
$scenario = isset( $argv[2] ) ? (string) $argv[2] : '';
$argument_3 = isset( $argv[3] ) ? (string) $argv[3] : '';
$argument_4 = isset( $argv[4] ) ? (string) $argv[4] : '';

global $wpdb;
$wpdb->set_prefix( 'v1e3_' );
$wpdb->suppress_errors( true );
$strict_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
if ( false === $wpdb->query( $wpdb->prepare( 'SET SESSION sql_mode = %s', $strict_mode ) ) || false === $wpdb->query( 'SET NAMES utf8mb4 COLLATE utf8mb4_bin' ) ) {
	fwrite( STDERR, "e3_arbiter_worker_session_invalid\n" );
	exit( 70 );
}
$connection_id = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
if ( $connection_id <= 0 ) {
	fwrite( STDERR, "e3_arbiter_worker_connection_invalid\n" );
	exit( 70 );
}

/** Deterministic test UUID source. */
final class V1_8010E_E3_Arbiter_UUID_Source implements MMED_V1_Study_UUID_Source {
	private $counter;
	public function __construct( $counter ) {
		$this->counter = (int) $counter;
	}
	public function next_uuid() {
		return sprintf( 'e3000000-0000-4000-8000-%012d', $this->counter++ );
	}
}

/** Exact allowlisted worker scenario. */
function v1_8010e_e3_arbiter_worker_scenario( $name ) {
	$scenarios = array(
		'v1-first'           => array( 'owner_id' => 9401, 'legacy_barrier' => '', 'v1_barrier' => 'before_commit', 'lane' => 501 ),
		'legacy-first'       => array( 'owner_id' => 9402, 'legacy_barrier' => 'after_calendar_write', 'v1_barrier' => '', 'lane' => 511 ),
		'different-owner-a'  => array( 'owner_id' => 9403, 'legacy_barrier' => '', 'v1_barrier' => 'before_commit', 'lane' => 521 ),
		'different-owner-b'  => array( 'owner_id' => 9404, 'legacy_barrier' => '', 'v1_barrier' => '', 'lane' => 531 ),
		'crash-before-commit'=> array( 'owner_id' => 9405, 'legacy_barrier' => 'after_calendar_write', 'v1_barrier' => '', 'lane' => 541 ),
		'crash-retry'        => array( 'owner_id' => 9405, 'legacy_barrier' => '', 'v1_barrier' => '', 'lane' => 551 ),
	);
	if ( ! isset( $scenarios[ $name ] ) ) {
		throw new RuntimeException( 'e3_arbiter_worker_scenario_invalid' );
	}
	return $scenarios[ $name ];
}

/** Wait for the exact controller release token. */
function v1_8010e_e3_arbiter_worker_wait() {
	$read = array( STDIN );
	$write = null;
	$except = null;
	$selected = @stream_select( $read, $write, $except, 30 );
	$line = 1 === $selected ? fgets( STDIN ) : false;
	if ( ! is_string( $line ) || "GO\n" !== $line ) {
		throw new RuntimeException( 'e3_arbiter_worker_barrier_timeout' );
	}
}

/** Emit one bounded worker result. */
function v1_8010e_e3_arbiter_worker_result( $result, $connection_id ) {
	echo 'RESULT ' . wp_json_encode( array( 'connection_id' => $connection_id, 'result' => $result ) ) . "\n";
}

/** Replace the two disposable raw control rows. */
function v1_8010e_e3_arbiter_worker_controls( $database, $active ) {
	$store_id = '8010e300-0000-4000-8000-000000000001';
	$store = array(
		'contract_version' => MMED_V1_Study_Release::CONTROL_VERSION,
		'state'            => 'commissioned',
		'generation'       => 2,
		'store_id'         => $store_id,
		'commissioned_at'  => '2026-07-15T12:00:00Z',
	);
	$release = array(
		'contract_version'        => MMED_V1_Study_Release::CONTROL_VERSION,
		'generation'              => 2,
		'mode'                    => $active ? MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE : MMED_V1_Study_Domain::MODE_LEGACY_PRECUTOVER,
		'exposure'                => (bool) $active,
		'decision_12_state'       => $active ? 'approved' : 'hold',
		'stop'                    => false,
		'release_digest'          => MMED_V1_Study_Release::RELEASE_SHA256,
		'current_reader_version'  => '2',
		'previous_reader_version' => null,
		'effective_at'            => '2026-07-15T12:00:00Z',
		'reason'                  => $active ? 'synthetic_e3_active' : 'synthetic_e3_legacy',
	);
	if ( $active ) {
		$release['policy_version'] = 'synthetic-e3-policy-v1';
	}
	$table = $database->prefix . 'options';
	foreach ( array( MMED_V1_Study_Release::STORE_OPTION => $store, MMED_V1_Study_Release::RELEASE_OPTION => $release ) as $name => $record ) {
		$sql = $database->prepare(
			"INSERT INTO `{$table}` (option_name, option_value, autoload) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value), autoload = VALUES(autoload)",
			$name,
			maybe_serialize( $record ),
			'no'
		);
		if ( false === $database->query( $sql ) ) {
			throw new RuntimeException( 'e3_arbiter_worker_control_write_failed' );
		}
	}
}

/** Return content-free owner state to an independent observer. */
function v1_8010e_e3_arbiter_worker_observe( $database, $owner_id ) {
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$week = MMED_V1_Study_Week_Schema::table_names( $database );
	$calendar = $database->prefix . 'mmed_events';
	$plan = $database->get_row(
		$database->prepare(
			"SELECT CAST(current_revision AS CHAR) AS revision, CASE WHEN watermark_operation_id IS NULL AND watermark_at IS NULL THEN 0 ELSE 1 END AS watermark FROM `{$kernel['plans']}` WHERE owner_id = %d",
			$owner_id
		),
		ARRAY_A
	);
	return array(
		'blocks'     => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$week['blocks']}` WHERE owner_id = %d", $owner_id ) ),
		'calendar'   => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$calendar}` WHERE user_id = %d AND event_type = %s", $owner_id, MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter::CALENDAR_TYPE ) ),
		'operations' => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = %d", $owner_id ) ),
		'plan'       => is_array( $plan ) ? 1 : 0,
		'revision'   => is_array( $plan ) ? (string) $plan['revision'] : null,
		'watermark'  => is_array( $plan ) ? (int) $plan['watermark'] : 0,
		'weeks'      => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$week['weeks']}` WHERE owner_id = %d", $owner_id ) ),
	);
}

try {
	if ( 'set-control' === $mode ) {
		v1_8010e_e3_arbiter_worker_controls( $wpdb, 'active' === $scenario );
		v1_8010e_e3_arbiter_worker_result( array( 'ok' => true, 'state' => $scenario ), $connection_id );
		exit( 0 );
	}
	if ( 'observe' === $mode ) {
		$state = v1_8010e_e3_arbiter_worker_scenario( $scenario );
		v1_8010e_e3_arbiter_worker_result( v1_8010e_e3_arbiter_worker_observe( $wpdb, $state['owner_id'] ), $connection_id );
		exit( 0 );
	}
	if ( 'lock-wait' === $mode ) {
		$requester = ctype_digit( $argument_3 ) ? (int) $argument_3 : 0;
		$blocker = ctype_digit( $argument_4 ) ? (int) $argument_4 : 0;
		if ( $requester <= 0 || $blocker <= 0 || $requester === $blocker ) {
			throw new RuntimeException( 'e3_arbiter_worker_lock_wait_identity_invalid' );
		}
		$version = (string) $wpdb->get_var( 'SELECT VERSION()' );
		if ( false !== stripos( $version, 'mariadb' ) ) {
			$sql = 'SELECT COUNT(*) FROM information_schema.INNODB_LOCK_WAITS w'
				. ' INNER JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id'
				. ' INNER JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id'
				. ' WHERE r.trx_mysql_thread_id = %d AND b.trx_mysql_thread_id = %d';
		} else {
			$sql = 'SELECT COUNT(*) FROM performance_schema.data_lock_waits w'
				. ' INNER JOIN performance_schema.threads r ON r.THREAD_ID = w.REQUESTING_THREAD_ID'
				. ' INNER JOIN performance_schema.threads b ON b.THREAD_ID = w.BLOCKING_THREAD_ID'
				. ' WHERE r.PROCESSLIST_ID = %d AND b.PROCESSLIST_ID = %d';
		}
		$waiting = (int) $wpdb->get_var( $wpdb->prepare( $sql, $requester, $blocker ) ) > 0;
		v1_8010e_e3_arbiter_worker_result( array( 'state' => 'LOCK_WAIT', 'waiting' => $waiting ), $connection_id );
		exit( 0 );
	}

	$state = v1_8010e_e3_arbiter_worker_scenario( $scenario );
	echo 'START connection=' . $connection_id . "\n";
	fflush( STDOUT );
	$barrier = 'legacy' === $mode ? $state['legacy_barrier'] : $state['v1_barrier'];
	$barrier_fired = false;
	$failpoint = '' === $barrier ? null : static function ( $name ) use ( $barrier, $connection_id, &$barrier_fired ) {
		if ( ! $barrier_fired && $barrier === $name ) {
			$barrier_fired = true;
			echo 'READY ' . $barrier . ' connection=' . $connection_id . "\n";
			fflush( STDOUT );
			v1_8010e_e3_arbiter_worker_wait();
		}
	};
	if ( 'legacy' === $mode ) {
		$result = ( new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb, $failpoint ) )->run_legacy_study_mutation(
			$state['owner_id'],
			$state['owner_id'],
			'learner',
			array(
				'action'   => 'create',
				'end_at'   => '2026-07-16 10:30:00',
				'start_at' => '2026-07-16 10:00:00',
				'status'   => 'active',
				'title'    => 'E3 ' . $scenario,
			)
		);
	} elseif ( 'v1' === $mode ) {
		$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-synthetic-e3', 'tzdb-synthetic-e3' );
		$body = array(
			'idempotency_key'   => '8010E-e3-' . $scenario . '-command-0001',
			'expected_revision' => '0',
			'command'           => MMED_V1_Study_Week_Domain::COMMAND_CREATE,
			'payload'           => array(
				'title'              => 'E3 ' . $scenario,
				'activity_type'      => 'qbank',
				'priority'           => 'normal',
				'local_date'         => '2026-07-16',
				'local_time'         => '11:00',
				'duration_minutes'   => 30,
				'fold'               => null,
				'temporal_context'   => $temporal['context'],
			),
		);
		$repository = new MMED_V1_Study_InnoDB_Command_Repository(
			$wpdb,
			new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ),
			new V1_8010E_E3_Arbiter_UUID_Source( $state['lane'] ),
			$failpoint
		);
		$result = ( new MMED_V1_Study_Command_Service( $repository ) )->execute( $body, $state['owner_id'], $state['owner_id'], 'learner', $temporal );
	} else {
		throw new RuntimeException( 'e3_arbiter_worker_mode_invalid' );
	}
	if ( '' !== $barrier && ! $barrier_fired ) {
		throw new RuntimeException( 'e3_arbiter_worker_barrier_not_reached' );
	}
	v1_8010e_e3_arbiter_worker_result( $result, $connection_id );
} catch ( Throwable $error ) {
	unset( $error );
	fwrite( STDERR, "e3_arbiter_worker_failed\n" );
	exit( 70 );
}
