<?php
/** Independent database-session worker for 8010E E2 command atomicity proofs. */

$wp_root = getenv( 'V1_WP_ROOT' );
$repo_root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $wp_root ) || '' === $wp_root || ! is_string( $repo_root ) || '' === $repo_root ) {
	fwrite( STDERR, "e2_worker_environment_invalid\n" );
	exit( 70 );
}

chdir( $wp_root );
require $wp_root . '/wp-load.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema-inspector.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-command-service.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-command-state.php';
require_once $repo_root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-command-repository.php';

$mode = isset( $argv[1] ) ? (string) $argv[1] : '';
$scenario_name = isset( $argv[2] ) ? (string) $argv[2] : '';
$target_connection = isset( $argv[3] ) ? (string) $argv[3] : '';

global $wpdb;
$wpdb->set_prefix( 'v1e2_' );
$wpdb->suppress_errors( true );
$connection_id = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
if ( $connection_id <= 0 ) {
	fwrite( STDERR, "e2_worker_connection_invalid\n" );
	exit( 70 );
}
$original_native_handle = $wpdb->dbh;

/** Execute one observer scalar on the exact current native handle. */
function v1_8010e_e2_worker_scalar( $database, $sql ) {
	$handle = isset( $database->dbh ) ? $database->dbh : null;
	if ( ! is_object( $handle ) || ! is_string( $sql ) || '' === $sql ) {
		throw new RuntimeException( 'e2_worker_observer_query_invalid' );
	}
	$connection_id = @mysqli_thread_id( $handle );
	try {
		$result = @mysqli_query( $handle, $sql );
	} catch ( Throwable $error ) {
		unset( $error );
		throw new RuntimeException( 'e2_worker_observer_query_failed' );
	}
	if ( ! is_object( $result ) || 1 !== (int) @mysqli_num_rows( $result ) ) {
		if ( is_object( $result ) ) {
			@mysqli_free_result( $result );
		}
		throw new RuntimeException( 'e2_worker_observer_shape_invalid' );
	}
	$row = @mysqli_fetch_row( $result );
	@mysqli_free_result( $result );
	if (
		! is_array( $row )
		|| 1 !== count( $row )
		|| ! isset( $database->dbh )
		|| $database->dbh !== $handle
		|| (int) $connection_id <= 0
		|| (int) $connection_id !== (int) @mysqli_thread_id( $handle )
	) {
		throw new RuntimeException( 'e2_worker_observer_session_changed' );
	}
	return $row[0];
}

/** Execute one exact observer-row query on the current native handle. */
function v1_8010e_e2_worker_row( $database, $sql ) {
	$handle = isset( $database->dbh ) ? $database->dbh : null;
	if ( ! is_object( $handle ) || ! is_string( $sql ) || '' === $sql ) {
		throw new RuntimeException( 'e2_worker_observer_row_query_invalid' );
	}
	$connection_id = @mysqli_thread_id( $handle );
	try {
		$result = @mysqli_query( $handle, $sql );
	} catch ( Throwable $error ) {
		unset( $error );
		throw new RuntimeException( 'e2_worker_observer_row_query_failed' );
	}
	if ( ! is_object( $result ) || 1 !== (int) @mysqli_num_rows( $result ) ) {
		if ( is_object( $result ) ) {
			@mysqli_free_result( $result );
		}
		throw new RuntimeException( 'e2_worker_observer_row_shape_invalid' );
	}
	$row = @mysqli_fetch_assoc( $result );
	@mysqli_free_result( $result );
	if (
		! is_array( $row )
		|| ! isset( $database->dbh )
		|| $database->dbh !== $handle
		|| (int) $connection_id <= 0
		|| (int) $connection_id !== (int) @mysqli_thread_id( $handle )
	) {
		throw new RuntimeException( 'e2_worker_observer_row_session_changed' );
	}
	return $row;
}

/** Return an exact, allowlisted synthetic scenario. */
function v1_8010e_e2_worker_scenario( $name ) {
	$scenarios = array(
		'same-a' => array( 8501, '8010E-e2-process-same-key-0001', 'Concurrent same key', '0', 'after_plan_lock', false, 101 ),
		'same-b' => array( 8501, '8010E-e2-process-same-key-0001', 'Concurrent same key', '0', '', true, 102 ),
		'same-changed' => array( 8501, '8010E-e2-process-same-key-0001', 'Changed same key', '0', '', false, 103 ),
		'race-a' => array( 8502, '8010E-e2-process-race-key-a-001', 'Revision race A', '0', 'after_plan_lock', false, 111 ),
		'race-b' => array( 8502, '8010E-e2-process-race-key-b-001', 'Revision race B', '0', '', true, 112 ),
		'isolation-a' => array( 8503, '8010E-e2-process-owner-a-00001', 'Held owner', '0', 'before_commit', false, 121 ),
		'isolation-b' => array( 8504, '8010E-e2-process-owner-b-00001', 'Independent owner', '0', '', false, 122 ),
		'crash-plan' => array( 8510, '8010E-e2-process-crash-plan-01', 'Crash plan boundary', '0', 'after_plan_publish', false, 131 ),
		'crash-week' => array( 8511, '8010E-e2-process-crash-week-01', 'Crash week boundary', '0', 'after_week_write', false, 132 ),
		'crash-block' => array( 8512, '8010E-e2-process-crash-block-1', 'Crash block boundary', '0', 'after_block_write', false, 133 ),
		'crash-receipt' => array( 8513, '8010E-e2-process-crash-receipt-01', 'Crash receipt boundary', '0', 'after_receipt_write', false, 134 ),
		'crash-commit' => array( 8514, '8010E-e2-process-crash-commit-01', 'Crash commit boundary', '0', 'before_commit', false, 135 ),
		'kill-before-commit' => array( 8520, '8010E-e2-process-kill-connection-1', 'Killed connection', '0', 'before_commit', false, 141 ),
		'kill-retry' => array( 8520, '8010E-e2-process-kill-connection-1', 'Killed connection', '0', '', false, 141 ),
		'response-commit-loss' => array( 8529, '8010E-e2-process-commit-loss-01', 'Commit boundary loss', '0', 'after_commit', false, 149 ),
		'response-loss' => array( 8530, '8010E-e2-process-response-loss-01', 'Response loss', '0', '', false, 151, true ),
		'response-retry' => array( 8530, '8010E-e2-process-response-loss-01', 'Response loss', '0', '', false, 151, false ),
		'rev-move-seed' => array( 8540, '8010E-e2-rev-move-seed-0001', 'Revision move seed', '0', '', false, 201, false, MMED_V1_Study_Week_Domain::COMMAND_CREATE, 201, null ),
		'rev-move-crash' => array( 8540, '8010E-e2-rev-move-crash-001', 'Revision move crash', '1', 'after_receipt_write', false, 202, false, MMED_V1_Study_Week_Domain::COMMAND_MOVE, 201, '10:00' ),
		'rev-move-race-a' => array( 8540, '8010E-e2-rev-move-race-a-001', 'Revision move race A', '2', 'after_plan_lock', false, 203, false, MMED_V1_Study_Week_Domain::COMMAND_MOVE, 201, '11:00' ),
		'rev-move-race-b' => array( 8540, '8010E-e2-rev-move-race-b-001', 'Revision move race B', '2', '', true, 204, false, MMED_V1_Study_Week_Domain::COMMAND_MOVE, 201, '12:00' ),
		'rev-resize-seed' => array( 8541, '8010E-e2-rev-resize-seed-01', 'Revision resize seed', '0', '', false, 211, false, MMED_V1_Study_Week_Domain::COMMAND_CREATE, 211, null ),
		'rev-resize-crash' => array( 8541, '8010E-e2-rev-resize-crash-1', 'Revision resize crash', '1', 'after_receipt_write', false, 212, false, MMED_V1_Study_Week_Domain::COMMAND_RESIZE, 211, 60 ),
		'rev-resize-race-a' => array( 8541, '8010E-e2-rev-resize-race-a-1', 'Revision resize race A', '2', 'after_plan_lock', false, 213, false, MMED_V1_Study_Week_Domain::COMMAND_RESIZE, 211, 90 ),
		'rev-resize-race-b' => array( 8541, '8010E-e2-rev-resize-race-b-1', 'Revision resize race B', '2', '', true, 214, false, MMED_V1_Study_Week_Domain::COMMAND_RESIZE, 211, 120 ),
		'rev-delete-crash-seed' => array( 8542, '8010E-e2-rev-delete-crash-seed', 'Revision delete crash seed', '0', '', false, 221, false, MMED_V1_Study_Week_Domain::COMMAND_CREATE, 221, null ),
		'rev-delete-crash' => array( 8542, '8010E-e2-rev-delete-crash-01', 'Revision delete crash', '1', 'after_receipt_write', false, 222, false, MMED_V1_Study_Week_Domain::COMMAND_DELETE, 221, null ),
		'rev-delete-race-seed' => array( 8543, '8010E-e2-rev-delete-race-seed-1', 'Revision delete race seed', '0', '', false, 231, false, MMED_V1_Study_Week_Domain::COMMAND_CREATE, 231, null ),
		'rev-delete-race-a' => array( 8543, '8010E-e2-rev-delete-race-a-01', 'Revision delete race A', '1', 'after_plan_lock', false, 232, false, MMED_V1_Study_Week_Domain::COMMAND_DELETE, 231, null ),
		'rev-delete-race-b' => array( 8543, '8010E-e2-rev-delete-race-b-01', 'Revision delete race B', '1', '', true, 233, false, MMED_V1_Study_Week_Domain::COMMAND_DELETE, 231, null ),
	);
	if ( ! isset( $scenarios[ $name ] ) ) {
		throw new RuntimeException( 'e2_worker_scenario_invalid' );
	}
	$row = $scenarios[ $name ];
	return array(
		'owner_id' => $row[0],
		'key' => $row[1],
		'title' => $row[2],
		'expected_revision' => $row[3],
		'barrier' => $row[4],
		'announce_control' => $row[5],
		'uuid_lane' => $row[6],
		'response_loss_hold' => isset( $row[7] ) && true === $row[7],
		'command' => isset( $row[8] ) ? $row[8] : MMED_V1_Study_Week_Domain::COMMAND_CREATE,
		'seed_uuid_lane' => isset( $row[9] ) ? $row[9] : $row[6],
		'target' => $row[10] ?? null,
	);
}

/** Wait for the controller without accepting arbitrary input. */
function v1_8010e_e2_worker_wait_for_go() {
	stream_set_blocking( STDIN, false );
	$deadline = microtime( true ) + 45.0;
	while ( microtime( true ) < $deadline ) {
		$read = array( STDIN );
		$write = null;
		$except = null;
		$ready = stream_select( $read, $write, $except, 1, 0 );
		if ( false === $ready ) {
			throw new RuntimeException( 'e2_worker_barrier_select_failed' );
		}
		if ( 0 === $ready ) {
			continue;
		}
		$command = fgets( STDIN );
		if ( is_string( $command ) && 'GO' === trim( $command ) ) {
			return;
		}
		throw new RuntimeException( 'e2_worker_barrier_release_invalid' );
	}
	throw new RuntimeException( 'e2_worker_barrier_timeout' );
}

/** Synthetic fence that never queries through wpdb and can announce one phase. */
final class V1_8010E_E2_Process_Fence implements MMED_V1_Study_Command_Fence {
	private $announce_control;
	private $announced = false;

	public function __construct( $announce_control ) {
		$this->announce_control = (bool) $announce_control;
	}

	public function scope() {
		return self::SCOPE_SYNTHETIC_ISOLATED;
	}

	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		if ( ! isset( $database->dbh ) || ! is_object( $database->dbh ) || (int) $connection_id !== (int) @mysqli_thread_id( $database->dbh ) ) {
			return false;
		}
		if ( $this->announce_control && ! $this->announced ) {
			$this->announced = true;
			echo 'READY control_before_plan connection=' . (int) $connection_id . "\n";
			fflush( STDOUT );
		}
		return true;
	}

	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		return isset( $database->dbh ) && is_object( $database->dbh ) && (int) $connection_id === (int) @mysqli_thread_id( $database->dbh );
	}
}

/** Deterministic UUID-v4 source scoped to one process scenario. */
function v1_8010e_e2_worker_uuid( $lane, $counter ) {
	$lane = (int) $lane;
	$counter = (int) $counter;
	if ( $lane <= 0 || $lane > 4095 || $counter <= 0 || $counter > 4095 ) {
		throw new RuntimeException( 'e2_worker_uuid_lane_invalid' );
	}
	return sprintf( '%08x-%04x-4%03x-8%03x-%012x', 0xe2000000 + $lane, $counter, $counter, $lane, $counter );
}

/** Deterministic UUID-v4 source scoped to one process scenario. */
final class V1_8010E_E2_Process_UUID_Source implements MMED_V1_Study_UUID_Source {
	private $lane;
	private $counter = 1;

	public function __construct( $lane ) {
		$this->lane = (int) $lane;
	}

	public function next_uuid() {
		$value = v1_8010e_e2_worker_uuid( $this->lane, $this->counter );
		++$this->counter;
		return $value;
	}
}

/** Construct one fixed synthetic command body; no learner content enters argv. */
function v1_8010e_e2_worker_command( $scenario ) {
	$runtime_tzdb = function_exists( 'timezone_version_get' ) ? (string) timezone_version_get() : '';
	if ( '' === $runtime_tzdb || strlen( $runtime_tzdb ) > 64 || 1 !== preg_match( '/^[A-Za-z0-9._:-]+$/D', $runtime_tzdb ) ) {
		throw new RuntimeException( 'e2_worker_tzdb_version_invalid' );
	}
	$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-e2-process-v1', $runtime_tzdb );
	$command = $scenario['command'];
	if ( MMED_V1_Study_Week_Domain::COMMAND_CREATE === $command ) {
		$payload = array(
			'title' => $scenario['title'],
			'activity_type' => 'qbank',
			'priority' => 'critical',
			'local_date' => '2026-07-15',
			'local_time' => '09:00',
			'duration_minutes' => 30,
			'fold' => null,
			'temporal_context' => $temporal['context'],
		);
	} else {
		$block_id = v1_8010e_e2_worker_uuid( $scenario['seed_uuid_lane'], 3 );
		if ( MMED_V1_Study_Week_Domain::COMMAND_MOVE === $command ) {
			$payload = array(
				'block_id' => $block_id,
				'local_date' => '2026-07-15',
				'local_time' => $scenario['target'],
				'fold' => null,
				'temporal_context' => $temporal['context'],
			);
		} elseif ( MMED_V1_Study_Week_Domain::COMMAND_RESIZE === $command ) {
			$payload = array(
				'block_id' => $block_id,
				'duration_minutes' => $scenario['target'],
				'temporal_context' => $temporal['context'],
			);
		} elseif ( MMED_V1_Study_Week_Domain::COMMAND_DELETE === $command ) {
			$payload = array(
				'block_id' => $block_id,
				'temporal_context' => $temporal['context'],
			);
		} else {
			throw new RuntimeException( 'e2_worker_command_invalid' );
		}
	}
	$body = array(
		'idempotency_key' => $scenario['key'],
		'expected_revision' => $scenario['expected_revision'],
		'command' => $command,
		'payload' => $payload,
	);
	return array( $body, $temporal );
}

/** Emit one bounded, content-free command result. */
function v1_8010e_e2_worker_emit_result( $result, $connection_id, $native_handle_preserved ) {
	$payload = is_array( $result['result'] ?? null ) ? $result['result'] : null;
	$summary = array(
		'state' => 'RESULT',
		'connection_id' => (int) $connection_id,
		'ok' => true === ( $result['ok'] ?? null ),
		'reason_code' => (string) ( $result['reason_code'] ?? '' ),
		'replayed' => true === ( $result['replayed'] ?? null ),
		'status' => is_int( $result['status'] ?? null ) ? $result['status'] : null,
		'revision' => is_array( $payload ) ? (string) ( $payload['revision'] ?? '' ) : null,
		'result_hash' => is_array( $payload ) ? hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $payload ) ) : null,
		'native_handle_preserved' => true === $native_handle_preserved,
	);
	echo wp_json_encode( $summary, JSON_UNESCAPED_SLASHES ) . "\n";
}

/** Emit committed row counts and the immutable receipt result hash. */
function v1_8010e_e2_worker_observe( $database, $scenario, $connection_id ) {
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$week = MMED_V1_Study_Week_Schema::table_names( $database );
	$owner_id = $scenario['owner_id'];
	$count_values = array(
		'plans' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$kernel['plans']}` WHERE owner_id = %d", $owner_id ) ),
		'operations' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = %d", $owner_id ) ),
		'weeks' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$week['weeks']}` WHERE owner_id = %d", $owner_id ) ),
		'blocks' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$week['blocks']}` WHERE owner_id = %d", $owner_id ) ),
	);
	$counts = array();
	foreach ( $count_values as $name => $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $value ) ) {
			throw new RuntimeException( 'e2_worker_observer_count_invalid' );
		}
		$counts[ $name ] = (int) $value;
	}
	$receipt_hash = v1_8010e_e2_worker_scalar(
		$database,
		$database->prepare(
			"SELECT MAX(LOWER(SHA2(result_json, 256))) FROM `{$kernel['operations']}` WHERE owner_id = %d AND idempotency_key = %s",
			$owner_id,
			$scenario['key']
		)
	);
	$revision = v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT MAX(CAST(current_revision AS CHAR)) FROM `{$kernel['plans']}` WHERE owner_id = %d", $owner_id ) );
	$linkage_count = v1_8010e_e2_worker_scalar(
		$database,
		$database->prepare(
			"SELECT COUNT(*) FROM `{$kernel['plans']}` p"
			. " INNER JOIN `{$week['weeks']}` w ON w.owner_id = p.owner_id AND w.plan_id = p.plan_id"
			. " INNER JOIN `{$week['blocks']}` b ON b.owner_id = w.owner_id AND b.plan_id = w.plan_id AND b.week_id = w.week_id"
			. " INNER JOIN `{$kernel['operations']}` o ON o.owner_id = p.owner_id AND o.plan_id = p.plan_id AND o.operation_id = p.watermark_operation_id"
			. ' WHERE p.owner_id = %d AND p.current_revision = 1 AND w.created_revision = 1 AND w.updated_revision = 1'
			. ' AND b.created_revision = 1 AND b.updated_revision = 1 AND o.expected_revision = 0 AND o.revision = 1'
			. ' AND p.plan_hash = o.plan_hash',
			$owner_id
		)
	);
	if ( null !== $receipt_hash && ( ! is_string( $receipt_hash ) || 1 !== preg_match( '/^[a-f0-9]{64}$/D', $receipt_hash ) ) ) {
		throw new RuntimeException( 'e2_worker_observer_hash_invalid' );
	}
	if ( null !== $revision && ( ! is_string( $revision ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $revision ) ) ) {
		throw new RuntimeException( 'e2_worker_observer_revision_invalid' );
	}
	if ( ! is_string( $linkage_count ) || ! in_array( $linkage_count, array( '0', '1' ), true ) ) {
		throw new RuntimeException( 'e2_worker_observer_linkage_invalid' );
	}
	echo wp_json_encode(
		array(
			'state' => 'OBSERVED',
			'connection_id' => (int) $connection_id,
			'counts' => $counts,
			'linkage_valid' => '1' === $linkage_count,
			'revision' => $revision,
			'result_hash' => $receipt_hash,
		),
		JSON_UNESCAPED_SLASHES
	) . "\n";
}

/** Emit an exact selected revision-greater-than-zero owner projection without row content. */
function v1_8010e_e2_worker_observe_revision( $database, $scenario, $connection_id ) {
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$week = MMED_V1_Study_Week_Schema::table_names( $database );
	$owner_id = $scenario['owner_id'];
	$count_values = array(
		'plans' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$kernel['plans']}` WHERE owner_id = %d", $owner_id ) ),
		'operations' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = %d", $owner_id ) ),
		'weeks' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$week['weeks']}` WHERE owner_id = %d", $owner_id ) ),
		'blocks' => v1_8010e_e2_worker_scalar( $database, $database->prepare( "SELECT COUNT(*) FROM `{$week['blocks']}` WHERE owner_id = %d", $owner_id ) ),
	);
	$counts = array();
	foreach ( $count_values as $name => $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $value ) ) {
			throw new RuntimeException( 'e2_worker_revision_count_invalid' );
		}
		$counts[ $name ] = (int) $value;
	}
	$target_receipt_hash = v1_8010e_e2_worker_scalar(
		$database,
		$database->prepare(
			"SELECT MAX(LOWER(SHA2(result_json, 256))) FROM `{$kernel['operations']}` WHERE owner_id = %d AND idempotency_key = %s",
			$owner_id,
			$scenario['key']
		)
	);
	$operation_chain = v1_8010e_e2_worker_scalar(
		$database,
		$database->prepare(
			"SELECT GROUP_CONCAT(CONCAT(CAST(expected_revision AS CHAR), '>', CAST(revision AS CHAR), ':', action) ORDER BY revision SEPARATOR '|')"
			. " FROM `{$kernel['operations']}` WHERE owner_id = %d",
			$owner_id
		)
	);
	$sql  = 'SELECT CAST(p.current_revision AS CHAR) AS revision,';
	$sql .= ' CASE WHEN LOWER(HEX(p.plan_hash)) = LOWER(SHA2(p.plan_json, 256))';
	$sql .= " AND p.current_revision = (SELECT COUNT(*) FROM `{$kernel['operations']}` count_o WHERE count_o.owner_id = p.owner_id AND count_o.plan_id = p.plan_id)";
	$sql .= " AND 0 = (SELECT COUNT(*) FROM `{$kernel['operations']}` broken_o WHERE broken_o.owner_id = p.owner_id AND broken_o.plan_id = p.plan_id AND broken_o.revision <> broken_o.expected_revision + 1)";
	$sql .= " AND 1 = (SELECT COUNT(*) FROM `{$kernel['operations']}` watermark_o WHERE watermark_o.owner_id = p.owner_id AND watermark_o.plan_id = p.plan_id AND watermark_o.operation_id = p.watermark_operation_id AND watermark_o.expected_revision = 0 AND watermark_o.revision = 1)";
	$sql .= " AND 1 = (SELECT COUNT(*) FROM `{$kernel['operations']}` current_o WHERE current_o.owner_id = p.owner_id AND current_o.plan_id = p.plan_id AND current_o.revision = p.current_revision AND current_o.plan_hash = p.plan_hash)";
	$sql .= ' AND w.created_revision = 1 AND w.updated_revision = p.current_revision';
	$sql .= ' AND b.created_revision = 1 AND b.updated_revision = p.current_revision THEN 1 ELSE 0 END AS plan_linkage_valid,';
	$sql .= ' CAST(w.created_revision AS CHAR) AS week_created_revision, CAST(w.updated_revision AS CHAR) AS week_updated_revision,';
	$sql .= ' LOWER(HEX(b.block_id)) AS block_hex, CAST(b.state_code AS CHAR) AS block_state_code,';
	$sql .= ' CAST(b.start_at_utc AS CHAR) AS start_at_utc, CAST(b.end_at_utc AS CHAR) AS end_at_utc,';
	$sql .= ' CAST(b.local_date AS CHAR) AS local_date, CAST(b.local_minute AS CHAR) AS local_minute, CAST(b.duration_minutes AS CHAR) AS duration_minutes,';
	$sql .= ' CAST(b.created_revision AS CHAR) AS block_created_revision, CAST(b.updated_revision AS CHAR) AS block_updated_revision,';
	$sql .= ' CAST(b.tombstoned_revision AS CHAR) AS tombstoned_revision, CASE WHEN b.tombstoned_at IS NULL THEN 0 ELSE 1 END AS tombstoned_at_present';
	$sql .= " FROM `{$kernel['plans']}` p";
	$sql .= " INNER JOIN `{$week['weeks']}` w ON w.owner_id = p.owner_id AND w.plan_id = p.plan_id";
	$sql .= " INNER JOIN `{$week['blocks']}` b ON b.owner_id = w.owner_id AND b.plan_id = w.plan_id AND b.week_id = w.week_id";
	$sql .= ' WHERE p.owner_id = %d LIMIT 2';
	$row = v1_8010e_e2_worker_row( $database, $database->prepare( $sql, $owner_id ) );
	$revision_fields = array( 'revision', 'week_created_revision', 'week_updated_revision', 'block_created_revision', 'block_updated_revision' );
	foreach ( $revision_fields as $field ) {
		if ( ! is_string( $row[ $field ] ?? null ) || 1 !== preg_match( '/^[1-9][0-9]*$/D', $row[ $field ] ) ) {
			throw new RuntimeException( 'e2_worker_revision_shape_invalid' );
		}
	}
	if (
		( null !== $target_receipt_hash && ( ! is_string( $target_receipt_hash ) || 1 !== preg_match( '/^[a-f0-9]{64}$/D', $target_receipt_hash ) ) )
		|| ! is_string( $operation_chain )
		|| 1 !== preg_match( '/^[0-9]+>[0-9]+:(?:create_block|move_block|resize_block|delete_block)(?:\|[0-9]+>[0-9]+:(?:create_block|move_block|resize_block|delete_block))*$/D', $operation_chain )
		|| '1' !== (string) ( $row['plan_linkage_valid'] ?? '' )
		|| ! is_string( $row['block_hex'] ?? null )
		|| 1 !== preg_match( '/^[a-f0-9]{32}$/D', $row['block_hex'] )
		|| ! in_array( (string) ( $row['block_state_code'] ?? '' ), array( '1', '3' ), true )
		|| ! is_string( $row['start_at_utc'] ?? null )
		|| ! is_string( $row['end_at_utc'] ?? null )
		|| ! is_string( $row['local_date'] ?? null )
		|| 1 !== preg_match( '/^2026-07-15$/D', $row['local_date'] )
		|| ! is_string( $row['local_minute'] ?? null )
		|| ! is_string( $row['duration_minutes'] ?? null )
		|| ! in_array( (string) ( $row['tombstoned_at_present'] ?? '' ), array( '0', '1' ), true )
		|| ( null !== ( $row['tombstoned_revision'] ?? null ) && ( ! is_string( $row['tombstoned_revision'] ) || 1 !== preg_match( '/^[1-9][0-9]*$/D', $row['tombstoned_revision'] ) ) )
	) {
		throw new RuntimeException( 'e2_worker_revision_observation_invalid' );
	}
	echo wp_json_encode(
		array(
			'state' => 'REVISION_OBSERVED',
			'connection_id' => (int) $connection_id,
			'counts' => $counts,
			'revision' => $row['revision'],
			'target_receipt_hash' => $target_receipt_hash,
			'operation_chain' => $operation_chain,
			'plan_linkage_valid' => true,
			'week_created_revision' => $row['week_created_revision'],
			'week_updated_revision' => $row['week_updated_revision'],
			'block_hex' => $row['block_hex'],
			'block_state_code' => (int) $row['block_state_code'],
			'start_at_utc' => $row['start_at_utc'],
			'end_at_utc' => $row['end_at_utc'],
			'local_date' => $row['local_date'],
			'local_minute' => (int) $row['local_minute'],
			'duration_minutes' => (int) $row['duration_minutes'],
			'block_created_revision' => $row['block_created_revision'],
			'block_updated_revision' => $row['block_updated_revision'],
			'tombstoned_revision' => $row['tombstoned_revision'],
			'tombstoned_at_present' => '1' === $row['tombstoned_at_present'],
		),
		JSON_UNESCAPED_SLASHES
	) . "\n";
}

try {
	if ( 'kill' === $mode ) {
		if ( 1 !== preg_match( '/^[1-9][0-9]{0,9}$/D', $target_connection ) || (int) $target_connection === $connection_id ) {
			throw new RuntimeException( 'e2_worker_kill_target_invalid' );
		}
		if ( true !== @mysqli_query( $wpdb->dbh, 'KILL CONNECTION ' . (int) $target_connection ) ) {
			throw new RuntimeException( 'e2_worker_kill_failed' );
		}
		echo wp_json_encode( array( 'state' => 'KILLED', 'connection_id' => $connection_id, 'target_connection' => (int) $target_connection ) ) . "\n";
		exit( 0 );
	}
	if ( 'thread' === $mode ) {
		if ( 1 !== preg_match( '/^[1-9][0-9]{0,9}$/D', $target_connection ) ) {
			throw new RuntimeException( 'e2_worker_thread_target_invalid' );
		}
		$process_value = v1_8010e_e2_worker_scalar( $wpdb, $wpdb->prepare( 'SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE ID = %d', (int) $target_connection ) );
		$transaction_value = v1_8010e_e2_worker_scalar( $wpdb, $wpdb->prepare( 'SELECT COUNT(*) FROM information_schema.INNODB_TRX WHERE TRX_MYSQL_THREAD_ID = %d', (int) $target_connection ) );
		if (
			! is_string( $process_value )
			|| ! is_string( $transaction_value )
			|| ! in_array( $process_value, array( '0', '1' ), true )
			|| ! in_array( $transaction_value, array( '0', '1' ), true )
		) {
			throw new RuntimeException( 'e2_worker_thread_observation_invalid' );
		}
		$process_count = (int) $process_value;
		$transaction_count = (int) $transaction_value;
		echo wp_json_encode(
			array(
				'state' => 'THREAD',
				'connection_id' => $connection_id,
				'target_connection' => (int) $target_connection,
				'process_present' => 1 === $process_count,
				'transaction_present' => 1 === $transaction_count,
			)
		) . "\n";
		exit( 0 );
	}
	if ( 'lock-wait' === $mode ) {
		if (
			1 !== preg_match( '/^[1-9][0-9]{0,9}$/D', $target_connection )
			|| 1 !== preg_match( '/^[1-9][0-9]{0,9}$/D', $scenario_name )
			|| $target_connection === $scenario_name
		) {
			throw new RuntimeException( 'e2_worker_lock_wait_target_invalid' );
		}
		$version = v1_8010e_e2_worker_scalar( $wpdb, 'SELECT VERSION()' );
		if ( ! is_string( $version ) ) {
			throw new RuntimeException( 'e2_worker_lock_wait_version_invalid' );
		}
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
		$wait_value = v1_8010e_e2_worker_scalar( $wpdb, $wpdb->prepare( $sql, (int) $target_connection, (int) $scenario_name ) );
		if ( ! is_string( $wait_value ) || 1 !== preg_match( '/^(?:0|[1-9][0-9]*)$/D', $wait_value ) ) {
			throw new RuntimeException( 'e2_worker_lock_wait_observation_invalid' );
		}
		echo wp_json_encode(
			array(
				'state' => 'LOCK_WAIT',
				'connection_id' => $connection_id,
				'requester_connection' => (int) $target_connection,
				'blocker_connection' => (int) $scenario_name,
				'waiting' => (int) $wait_value > 0,
			)
		) . "\n";
		exit( 0 );
	}

	$scenario = v1_8010e_e2_worker_scenario( $scenario_name );
	if ( 'observe-revision' === $mode ) {
		v1_8010e_e2_worker_observe_revision( $wpdb, $scenario, $connection_id );
		exit( 0 );
	}
	if ( 'observe' === $mode ) {
		v1_8010e_e2_worker_observe( $wpdb, $scenario, $connection_id );
		exit( 0 );
	}
	if ( 'command-retry' === $mode ) {
		$scenario['barrier'] = '';
		$scenario['announce_control'] = false;
		$scenario['response_loss_hold'] = false;
		$mode = 'command';
	}
	if ( 'command' !== $mode ) {
		throw new RuntimeException( 'e2_worker_mode_invalid' );
	}

	list( $body, $temporal ) = v1_8010e_e2_worker_command( $scenario );
	$barrier_fired = false;
	$barrier = $scenario['barrier'];
	$failpoint = '' === $barrier ? null : static function ( $name ) use ( $barrier, $connection_id, &$barrier_fired ) {
		if ( ! $barrier_fired && $barrier === $name ) {
			$barrier_fired = true;
			echo 'READY ' . $barrier . ' connection=' . $connection_id . "\n";
			fflush( STDOUT );
			v1_8010e_e2_worker_wait_for_go();
		}
	};
	$repository = new MMED_V1_Study_InnoDB_Command_Repository(
		$wpdb,
		new V1_8010E_E2_Process_Fence( $scenario['announce_control'] ),
		new V1_8010E_E2_Process_UUID_Source( $scenario['uuid_lane'] ),
		$failpoint
	);
	$result = ( new MMED_V1_Study_Command_Service( $repository ) )->execute(
		$body,
		$scenario['owner_id'],
		$scenario['owner_id'],
		'learner',
		$temporal
	);
	if ( '' !== $barrier && ! $barrier_fired ) {
		throw new RuntimeException( 'e2_worker_barrier_not_reached' );
	}
	if ( $scenario['response_loss_hold'] ) {
		if ( empty( $result['ok'] ) || ! is_array( $result['result'] ?? null ) ) {
			throw new RuntimeException( 'e2_worker_response_loss_result_invalid' );
		}
		$result_hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $result['result'] ) );
		echo 'READY response_lost connection=' . $connection_id
			. ' revision=' . (string) $result['result']['revision']
			. ' hash=' . $result_hash . "\n";
		fflush( STDOUT );
		v1_8010e_e2_worker_wait_for_go();
	}
	v1_8010e_e2_worker_emit_result( $result, $connection_id, isset( $wpdb->dbh ) && $wpdb->dbh === $original_native_handle );
} catch ( Throwable $error ) {
	unset( $error );
	fwrite( STDERR, "e2_worker_failed\n" );
	exit( 70 );
}
