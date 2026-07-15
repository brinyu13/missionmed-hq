<?php
/**
 * Disposable WordPress/InnoDB proof for the isolated 8010E E2 command writer.
 *
 * This fixture exercises only synthetic generation-2 stores. The writer remains
 * absent from plugin runtime and accepts only the explicit synthetic E2 fence.
 */

if ( ! defined( 'ABSPATH' ) || ! isset( $GLOBALS['wpdb'] ) || ! function_exists( 'v1_8010e_wp_expect' ) ) {
	throw new RuntimeException( 'This E2 fixture must run after the disposable E0 and E1 fixtures.' );
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1 repository root is unavailable.' );
}

require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-command-service.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-command-state.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-command-repository.php';

/** Exact synthetic fence. It proves both callbacks stay on the pinned session. */
final class V1_8010E_E2_Synthetic_Fence implements MMED_V1_Study_Command_Fence {
	public $control_locks = 0;
	public $calendar_locks = 0;

	public function scope() {
		return self::SCOPE_SYNTHETIC_ISOLATED;
	}

	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		++$this->control_locks;
		return (int) $connection_id > 0 && (int) $connection_id === (int) $database->get_var( 'SELECT CONNECTION_ID()' );
	}

	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		++$this->calendar_locks;
		return (int) $connection_id > 0 && (int) $connection_id === (int) $database->get_var( 'SELECT CONNECTION_ID()' );
	}
}

/** Deterministic, unique UUID-v4 source for synthetic physical assertions. */
final class V1_8010E_E2_UUID_Source implements MMED_V1_Study_UUID_Source {
	private $counter;

	public function __construct( $counter ) {
		$this->counter = (int) $counter;
	}

	public function next_uuid() {
		return sprintf( 'e2000000-0000-4000-8000-%012d', $this->counter++ );
	}
}

/** Synthetic fence that attempts to weaken the live transaction encoding. */
final class V1_8010E_E2_Encoding_Mutating_Fence implements MMED_V1_Study_Command_Fence {
	public function scope() {
		return self::SCOPE_SYNTHETIC_ISOLATED;
	}

	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		return (int) $connection_id === (int) $database->get_var( 'SELECT CONNECTION_ID()' );
	}

	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		if ( (int) $connection_id !== (int) $database->get_var( 'SELECT CONNECTION_ID()' ) ) {
			return false;
		}
		return false !== $database->query( 'SET NAMES latin1' );
	}
}

/** Synthetic fence that poisons every mutable relational guard without committing. */
final class V1_8010E_E2_Session_Mutating_Fence implements MMED_V1_Study_Command_Fence {
	public function scope() {
		return self::SCOPE_SYNTHETIC_ISOLATED;
	}

	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		return (int) $connection_id === (int) $database->get_var( 'SELECT CONNECTION_ID()' );
	}

	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		unset( $owner_id );
		if ( (int) $connection_id !== (int) $database->get_var( 'SELECT CONNECTION_ID()' ) ) {
			return false;
		}
		$is_mariadb = false !== stripos( (string) $database->get_var( 'SELECT VERSION()' ), 'mariadb' );
		$mutations = array(
			'SET SESSION foreign_key_checks = 0',
			'SET SESSION unique_checks = 0',
			'SET SESSION autocommit = 0',
		);
		if ( $is_mariadb ) {
			$mutations[] = 'SET SESSION check_constraint_checks = 0';
		}
		foreach ( $mutations as $sql ) {
			if ( false === $database->query( $sql ) ) {
				return false;
			}
		}
		return true;
	}
}

function v1_8010e_e2_physical_body( $key, $revision, $command, $payload ) {
	return array(
		'idempotency_key'   => $key,
		'expected_revision' => (string) $revision,
		'command'           => $command,
		'payload'           => $payload,
	);
}

function v1_8010e_e2_physical_create( $key, $revision, $temporal, $title, $time, $duration ) {
	return v1_8010e_e2_physical_body(
		$key,
		$revision,
		MMED_V1_Study_Week_Domain::COMMAND_CREATE,
		array(
			'title'             => $title,
			'activity_type'     => 'qbank',
			'priority'          => 'critical',
			'local_date'        => '2026-07-15',
			'local_time'        => $time,
			'duration_minutes'  => $duration,
			'fold'              => null,
			'temporal_context'  => $temporal['context'],
		)
	);
}

function v1_8010e_e2_physical_expect_failure( $result, $reason, $status, $message ) {
	v1_8010e_wp_expect(
		is_array( $result )
		&& array( 'ok', 'reason_code', 'replayed', 'result', 'status' ) === array_keys( $result )
		&& false === $result['ok']
		&& $reason === $result['reason_code']
		&& false === $result['replayed']
		&& null === $result['result']
		&& $status === $result['status'],
		$message . '; reason=' . (string) ( $result['reason_code'] ?? 'missing' )
	);
}

function v1_8010e_e2_physical_owner_counts( $database, $owner_id ) {
	$kernel = MMED_V1_Study_Schema::table_names( $database );
	$week = MMED_V1_Study_Week_Schema::table_names( $database );
	return array(
		'plans'      => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$kernel['plans']}` WHERE owner_id = %d", $owner_id ) ),
		'operations' => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = %d", $owner_id ) ),
		'weeks'      => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$week['weeks']}` WHERE owner_id = %d", $owner_id ) ),
		'blocks'     => (int) $database->get_var( $database->prepare( "SELECT COUNT(*) FROM `{$week['blocks']}` WHERE owner_id = %d", $owner_id ) ),
	);
}

function v1_8010e_e2_session_encoding( $database ) {
	$row = $database->get_row(
		'SELECT @@SESSION.character_set_client AS character_set_client, @@SESSION.character_set_connection AS character_set_connection, @@SESSION.character_set_results AS character_set_results, @@SESSION.collation_connection AS collation_connection',
		ARRAY_A
	);
	if ( ! is_array( $row ) ) {
		throw new RuntimeException( 'E2 session encoding fixture failed.' );
	}
	return $row;
}

function v1_8010e_e2_restore_session_encoding( $database, $encoding ) {
	foreach ( array( 'character_set_client', 'character_set_connection' ) as $name ) {
		if ( false === $database->query( $database->prepare( 'SET SESSION ' . $name . ' = %s', $encoding[ $name ] ) ) ) {
			throw new RuntimeException( 'E2 session encoding restore failed.' );
		}
	}
	if ( null === $encoding['character_set_results'] ) {
		$result = $database->query( 'SET SESSION character_set_results = NULL' );
	} else {
		$result = $database->query( $database->prepare( 'SET SESSION character_set_results = %s', $encoding['character_set_results'] ) );
	}
	if ( false === $result || false === $database->query( $database->prepare( 'SET SESSION collation_connection = %s', $encoding['collation_connection'] ) ) ) {
		throw new RuntimeException( 'E2 session encoding restore failed.' );
	}
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e2_' );
$wpdb->suppress_errors( true );

$store = 'e2000000-0000-4000-8000-000000000001';
$runner_1 = 'e2000000-0000-4000-8000-000000000002';
$runner_2 = 'e2000000-0000-4000-8000-000000000003';
$parent = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store, $runner_1 );
v1_8010e_wp_expect( ! empty( $parent['ok'] ) && 1 === (int) $parent['generation'], 'E2 parent synthetic store commissions at generation 1' );
$generation = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $store, $runner_2 );
v1_8010e_wp_expect( ! empty( $generation['ok'] ) && 2 === (int) $generation['generation'], 'E2 synthetic store advances to ready generation 2' );

$kernel = MMED_V1_Study_Schema::table_names( $wpdb );
$week_tables = MMED_V1_Study_Week_Schema::table_names( $wpdb );
$owner_id = 8201;
$runtime_tzdb = function_exists( 'timezone_version_get' ) ? (string) timezone_version_get() : '';
v1_8010e_wp_expect( '' !== $runtime_tzdb && strlen( $runtime_tzdb ) <= 64 && 1 === preg_match( '/^[A-Za-z0-9._:-]+$/D', $runtime_tzdb ), 'fixture binds temporal evidence to the exact PHP runtime tzdb version' );
$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-e2-v1', $runtime_tzdb );
$fence = new V1_8010E_E2_Synthetic_Fence();
$uuid_source = new V1_8010E_E2_UUID_Source( 1000 );
$service = new MMED_V1_Study_Command_Service( new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, $fence, $uuid_source ) );

/* Generation 2 must accept and atomically upgrade an inherited empty E1 fence. */
$inherited_owner = 8202;
$inherited_insert = $wpdb->query(
	$wpdb->prepare(
		"INSERT INTO `{$kernel['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, NULL, 1, NULL, 0, NULL, NULL, NULL, NULL, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))",
		$inherited_owner
	)
);
v1_8010e_wp_expect( 1 === (int) $inherited_insert, 'fixture creates one exact inherited generation-1 revision-0 owner fence' );
$inherited_hits = array();
$inherited_probe = static function ( $name ) use ( &$inherited_hits ) {
	$inherited_hits[] = (string) $name;
};
$inherited_service = new MMED_V1_Study_Command_Service( new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, $fence, $uuid_source, $inherited_probe ) );
$inherited_body = v1_8010e_e2_physical_create( '8010E-e2-inherited-fence-001', '0', $temporal, 'Inherited fence command', '15:00', 30 );
$inherited = $inherited_service->execute(
	$inherited_body,
	$inherited_owner,
	$inherited_owner,
	'learner',
	$temporal
);
$inherited_last_hit = empty( $inherited_hits ) ? 'none' : (string) end( $inherited_hits );
v1_8010e_wp_expect(
	! empty( $inherited['ok'] ) && '1' === $inherited['result']['revision'],
	'first command succeeds from an inherited generation-1 empty fence; reason=' . (string) ( $inherited['reason_code'] ?? 'missing' ) . '; last=' . $inherited_last_hit
);
v1_8010e_wp_expect( '2' === (string) $wpdb->get_var( $wpdb->prepare( "SELECT CAST(store_generation AS CHAR) FROM `{$kernel['plans']}` WHERE owner_id = %d", $inherited_owner ) ), 'first command atomically upgrades the inherited fence to generation 2' );

/* A self-consistent stored CREATE-family rewrite must fail semantic re-derivation. */
$inherited_receipt = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT request_json, LOWER(HEX(request_hash)) AS request_hash_hex FROM `{$kernel['operations']}` WHERE owner_id = %d AND revision = 1",
		$inherited_owner
	),
	ARRAY_A
);
$inherited_request = is_array( $inherited_receipt ) ? json_decode( (string) $inherited_receipt['request_json'], true ) : null;
v1_8010e_wp_expect(
	is_array( $inherited_request )
	&& 'practice' === (string) ( $inherited_request['payload']['family'] ?? '' )
	&& hash( 'sha256', (string) $inherited_receipt['request_json'] ) === (string) $inherited_receipt['request_hash_hex'],
	'fixture captures the exact server-derived CREATE-family receipt'
);
$inherited_request_tampered = $inherited_request;
$inherited_request_tampered['payload']['family'] = 'life';
$inherited_tampered_json = MMED_V1_Study_Week_Domain::canonical_json( $inherited_request_tampered );
$inherited_tampered_hash = hash( 'sha256', $inherited_tampered_json );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET request_json = %s, request_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 1",
			$inherited_tampered_json,
			$inherited_tampered_hash,
			$inherited_owner
		)
	),
	'fixture rewrites CREATE family and both integrity representations consistently'
);
$inherited_hits = array();
$inherited_tamper_replay = $inherited_service->execute( $inherited_body, $inherited_owner, $inherited_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure(
	$inherited_tamper_replay,
	'dependency_unavailable',
	503,
	'self-consistent stored CREATE-family tamper fails closed after semantic re-derivation'
);
v1_8010e_wp_expect(
	in_array( 'receipt_shape_valid', $inherited_hits, true )
	&& in_array( 'receipt_request_normalized', $inherited_hits, true )
	&& ! in_array( 'receipt_request_valid', $inherited_hits, true ),
	'CREATE-family tamper reaches semantic normalization and fails before request acceptance'
);
v1_8010e_wp_expect(
	array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $inherited_owner ),
	'CREATE-family tamper rejection writes no duplicate truth'
);
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET request_json = %s, request_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 1",
			$inherited_receipt['request_json'],
			$inherited_receipt['request_hash_hex'],
			$inherited_owner
		)
	),
	'fixture restores the exact original CREATE receipt'
);
$inherited_restored = $inherited_service->execute( $inherited_body, $inherited_owner, $inherited_owner, 'learner', $temporal );
v1_8010e_wp_expect(
	! empty( $inherited_restored['ok'] ) && true === $inherited_restored['replayed'] && $inherited['result'] === $inherited_restored['result'],
	'restored CREATE receipt replays the exact original result'
);

$create = v1_8010e_e2_physical_create( '8010E-e2-physical-create-0001', '0', $temporal, 'Cardiology question bank', '09:00', 90 );
$first = $service->execute( $create, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $first['ok'] ) && false === $first['replayed'] && 200 === $first['status'], 'first physical command commits exactly once' );
v1_8010e_wp_expect( '1' === $first['result']['revision'] && MMED_V1_Study_Week_Domain::COMMAND_CREATE === $first['result']['action'], 'first command returns revision 1 create receipt' );
$first_result = $first['result'];
v1_8010e_wp_expect( array( 'action', 'block_id', 'mission', 'operation_id', 'plan_hash', 'revision', 'today', 'week' ) === array_keys( $first_result ), 'first response has the exact Week plus Mission allowlist' );
v1_8010e_wp_expect( '1' === $first_result['week']['revision'] && '1' === $first_result['mission']['revision'], 'first response binds Plan, Week, and Mission to revision 1' );
v1_8010e_wp_expect( $first_result['mission'] === MMED_V1_Study_Week_Domain::derive_mission( $first_result['week'], $first_result['today'] ), 'first response Mission is derived from its exact Week and trusted today' );
$block_id = $first_result['block_id'];
$operation_id = $first_result['operation_id'];
$counts = v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id );
v1_8010e_wp_expect( array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === $counts, 'first command atomically creates one Plan, receipt, Week, and Block' );

$plan_row = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT LOWER(HEX(plan_id)) AS plan_hex, CAST(current_revision AS CHAR) AS revision, LOWER(HEX(watermark_operation_id)) AS watermark_hex, LOWER(HEX(plan_hash)) AS plan_hash_hex FROM `{$kernel['plans']}` WHERE owner_id = %d",
		$owner_id
	),
	ARRAY_A
);
v1_8010e_wp_expect( is_array( $plan_row ) && '1' === $plan_row['revision'], 'physical Plan publishes revision 1' );
v1_8010e_wp_expect( str_replace( '-', '', $operation_id ) === $plan_row['watermark_hex'], 'first receipt is the immutable Plan watermark' );
v1_8010e_wp_expect( $first_result['plan_hash'] === $plan_row['plan_hash_hex'], 'receipt and Plan publish the same canonical hash' );
$plan_hex = $plan_row['plan_hex'];
$week_hex = strtolower( (string) $wpdb->get_var( $wpdb->prepare( "SELECT HEX(week_id) FROM `{$week_tables['weeks']}` WHERE owner_id = %d", $owner_id ) ) );
$block_hex = strtolower( (string) $wpdb->get_var( $wpdb->prepare( "SELECT HEX(block_id) FROM `{$week_tables['blocks']}` WHERE owner_id = %d", $owner_id ) ) );
v1_8010e_wp_expect( str_replace( '-', '', $block_id ) === $block_hex, 'server-issued Block identity is the stored identity' );

$reader = new MMED_V1_Study_InnoDB_Repository( $wpdb );
$loaded = $reader->load( $owner_id, '2' );
v1_8010e_wp_expect( ! empty( $loaded['ok'] ) && '1' === $loaded['plan']['revision'], 'accepted current reader sees the committed command immediately' );
v1_8010e_wp_expect( $first_result['plan_hash'] === hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $loaded['plan'] ) ), 'current reader reconstructs the exact committed Plan hash' );
v1_8010e_wp_expect( $first_result['week'] === $loaded['plan']['weeks'][0], 'command response and accepted reader return the exact same Week bytes' );
$mission = MMED_V1_Study_Week_Domain::derive_mission( $loaded['plan']['weeks'][0], $first_result['today'] );
v1_8010e_wp_expect( '1' === $mission['revision'] && $block_id === $mission['primary']['block_id'], 'Mission derives from the same committed Week revision' );

$changed_temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-e2-v2', 'synthetic-future-tzdb-v2' );
$replay = $service->execute( $create, $owner_id, $owner_id, 'learner', $changed_temporal );
v1_8010e_wp_expect(
	! empty( $replay['ok'] ) && true === $replay['replayed'] && $first_result === $replay['result'],
	'exact replay survives a later server temporal-envelope version; reason=' . (string) ( $replay['reason_code'] ?? 'missing' ) . '; status=' . (string) ( $replay['status'] ?? 'missing' )
);
v1_8010e_wp_expect( $counts === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id ), 'exact replay writes no duplicate physical row' );

$changed = $create;
$changed['payload']['title'] = 'Different command body';
$conflict = $service->execute( $changed, $owner_id, $owner_id, 'learner', $changed_temporal );
v1_8010e_e2_physical_expect_failure( $conflict, 'idempotency_conflict', 409, 'same idempotency key with changed payload conflicts before stale handling' );
$stale = v1_8010e_e2_physical_create( '8010E-e2-physical-stale-0001', '0', $temporal, 'Stale command', '13:00', 30 );
v1_8010e_e2_physical_expect_failure( $service->execute( $stale, $owner_id, $owner_id, 'learner', $temporal ), 'stale_revision', 409, 'new key with an old revision fails closed' );
v1_8010e_wp_expect( $counts === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id ), 'conflict and stale failures create no receipts or domain rows' );

$move = v1_8010e_e2_physical_body(
	'8010E-e2-physical-move-000001',
	'1',
	MMED_V1_Study_Week_Domain::COMMAND_MOVE,
	array( 'block_id' => $block_id, 'local_date' => '2026-07-15', 'local_time' => '11:00', 'fold' => null, 'temporal_context' => $temporal['context'] )
);
$moved = $service->execute( $move, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $moved['ok'] ) && '2' === $moved['result']['revision'] && $block_id === $moved['result']['block_id'], 'move preserves Block identity and advances once' );

$resize = v1_8010e_e2_physical_body(
	'8010E-e2-physical-resize-0001',
	'2',
	MMED_V1_Study_Week_Domain::COMMAND_RESIZE,
	array( 'block_id' => $block_id, 'duration_minutes' => 120, 'temporal_context' => $temporal['context'] )
);
$resized = $service->execute( $resize, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $resized['ok'] ) && '3' === $resized['result']['revision'] && $block_id === $resized['result']['block_id'], 'resize preserves Block identity and advances once' );

$before_collision = v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id );
$collision_body = v1_8010e_e2_physical_create( '8010E-e2-physical-collision-01', '3', $temporal, 'Overlapping work', '12:30', 30 );
v1_8010e_e2_physical_expect_failure( $service->execute( $collision_body, $owner_id, $owner_id, 'learner', $temporal ), 'block_collision', 409, 'collision is rechecked under the locked physical owner state' );
v1_8010e_wp_expect( $before_collision === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id ), 'collision rollback leaves no receipt or Block' );

$adjacent_body = v1_8010e_e2_physical_create( '8010E-e2-physical-adjacent-001', '3', $temporal, 'Adjacent question bank', '13:00', 30 );
$adjacent = $service->execute( $adjacent_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $adjacent['ok'] ) && '4' === $adjacent['result']['revision'], 'adjacent interval is accepted without a false collision' );
$adjacent_block_id = $adjacent['result']['block_id'];

$delete = v1_8010e_e2_physical_body(
	'8010E-e2-physical-delete-0001',
	'4',
	MMED_V1_Study_Week_Domain::COMMAND_DELETE,
	array( 'block_id' => $block_id, 'temporal_context' => $temporal['context'] )
);
$deleted = $service->execute( $delete, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $deleted['ok'] ) && '5' === $deleted['result']['revision'] && $block_id === $deleted['result']['block_id'], 'delete creates one durable tombstone revision' );

$before_second_delete = v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id );
$second_delete = $delete;
$second_delete['idempotency_key'] = '8010E-e2-physical-delete-0002';
$second_delete['expected_revision'] = '5';
v1_8010e_e2_physical_expect_failure( $service->execute( $second_delete, $owner_id, $owner_id, 'learner', $temporal ), 'block_not_found', 404, 'a new-key second delete is non-enumerating and does not advance' );
v1_8010e_wp_expect( $before_second_delete === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id ), 'second delete creates no receipt or revision' );

$final = $reader->load( $owner_id, '2' );
v1_8010e_wp_expect( ! empty( $final['ok'] ) && '5' === $final['plan']['revision'], 'current reader publishes the final CRUD revision' );
v1_8010e_wp_expect( $plan_hex === str_replace( '-', '', $final['plan']['plan_id'] ), 'Plan identity is stable across all commands' );
v1_8010e_wp_expect( $week_hex === str_replace( '-', '', $final['plan']['weeks'][0]['week_id'] ), 'Week identity is stable across all commands' );
$final_blocks = array();
foreach ( $final['plan']['weeks'][0]['blocks'] as $final_block ) {
	$final_blocks[ $final_block['block_id'] ] = $final_block;
}
v1_8010e_wp_expect( isset( $final_blocks[ $block_id ] ) && 'tombstoned' === $final_blocks[ $block_id ]['state'], 'deleted Block identity remains as a durable tombstone' );
v1_8010e_wp_expect( isset( $final_blocks[ $adjacent_block_id ] ) && MMED_V1_Study_Week_Domain::STATE_FLEXIBLE === $final_blocks[ $adjacent_block_id ]['state'], 'adjacent Block remains active' );
v1_8010e_wp_expect( $block_hex === str_replace( '-', '', $final_blocks[ $block_id ]['block_id'] ), 'original physical Block identifier never changes' );
v1_8010e_wp_expect( 5 === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id )['operations'], 'exactly five successful commands have receipts' );
$late_replay = $service->execute( $create, $owner_id, $owner_id, 'learner', $changed_temporal );
v1_8010e_wp_expect( ! empty( $late_replay['ok'] ) && true === $late_replay['replayed'] && $first_result === $late_replay['result'], 'revision-1 retry after revision 5 replays the exact stored Week, Mission, and today' );
v1_8010e_wp_expect( 5 === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id )['operations'], 'late replay creates no receipt or revision' );

/* Append-only chain gaps are detected before any later revision can publish. */
v1_8010e_wp_expect( false !== $wpdb->query( "CREATE TEMPORARY TABLE v1e2_receipt_gap_backup AS SELECT * FROM `{$kernel['operations']}` WHERE owner_id = {$owner_id} AND revision = 3" ), 'fixture preserves the exact intermediate receipt in a temporary backup' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM v1e2_receipt_gap_backup' ), 'fixture backup contains exactly revision 3' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $wpdb->prepare( "DELETE FROM `{$kernel['operations']}` WHERE owner_id = %d AND revision = 3", $owner_id ) ), 'fixture introduces one intermediate append-only gap' );
$gap_chain_body = v1_8010e_e2_physical_create( '8010E-e2-receipt-gap-00001', '5', $temporal, 'Receipt gap command', '15:00', 30 );
$gap_chain_result = $service->execute( $gap_chain_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $gap_chain_result, 'dependency_unavailable', 503, 'missing intermediate receipt fails closed before revision 6' );
v1_8010e_wp_expect( 4 === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id )['operations'], 'gap rejection creates no replacement receipt' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "INSERT INTO `{$kernel['operations']}` SELECT * FROM v1e2_receipt_gap_backup" ), 'fixture restores exact intermediate receipt bytes' );
v1_8010e_wp_expect( false !== $wpdb->query( 'DROP TEMPORARY TABLE v1e2_receipt_gap_backup' ), 'fixture removes intermediate receipt backup' );

$intermediate_original = $wpdb->get_row( $wpdb->prepare( "SELECT result_json, LOWER(HEX(plan_hash)) AS plan_hash_hex FROM `{$kernel['operations']}` WHERE owner_id = %d AND revision = 3", $owner_id ), ARRAY_A );
v1_8010e_wp_expect( is_array( $intermediate_original ), 'fixture reads the exact intermediate result and Plan hash' );
$intermediate_original_json = (string) $intermediate_original['result_json'];
$intermediate_tampered = json_decode( $intermediate_original_json, true );
v1_8010e_wp_expect( is_array( $intermediate_tampered ), 'fixture decodes the exact intermediate receipt' );
$intermediate_tampered['today'] = '2000-01-01';
$intermediate_tampered['mission'] = MMED_V1_Study_Week_Domain::derive_mission( $intermediate_tampered['week'], $intermediate_tampered['today'] );
$intermediate_tampered_json = MMED_V1_Study_Week_Domain::canonical_json( $intermediate_tampered );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 3",
			$intermediate_tampered_json,
			hash( 'sha256', $intermediate_tampered_json ),
			$owner_id
		)
	),
	'fixture creates a structurally and hash-valid semantic tamper at intermediate revision 3'
);
$intermediate_chain_result = $service->execute( $gap_chain_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $intermediate_chain_result, 'dependency_unavailable', 503, 'semantic corruption in an intermediate receipt fails closed before revision 6' );
v1_8010e_wp_expect( 5 === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id )['operations'], 'intermediate semantic rejection creates no receipt' );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 3",
			$intermediate_original_json,
			hash( 'sha256', $intermediate_original_json ),
			$owner_id
		)
	),
	'fixture restores the exact intermediate receipt bytes and hash'
);

$transition_tampered = json_decode( $intermediate_original_json, true );
$transition_target_found = false;
foreach ( $transition_tampered['week']['blocks'] as &$transition_block ) {
	if ( $transition_tampered['block_id'] === $transition_block['block_id'] ) {
		$transition_block['title'] = 'Self-consistent historical title tamper';
		$transition_target_found = true;
	}
}
unset( $transition_block );
v1_8010e_wp_expect( $transition_target_found, 'fixture locates the exact historic resize target' );
unset( $transition_tampered['week']['projection_hash'] );
$transition_tampered['week']['projection_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $transition_tampered['week'] ) );
$transition_tampered['mission'] = MMED_V1_Study_Week_Domain::derive_mission( $transition_tampered['week'], $transition_tampered['today'] );
$transition_snapshot = array(
	'plan_id' => $transition_tampered['week']['plan_id'],
	'revision' => $transition_tampered['revision'],
	'schema_version' => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
	'weeks' => array( $transition_tampered['week'] ),
);
$transition_tampered['plan_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $transition_snapshot ) );
$transition_tampered_json = MMED_V1_Study_Week_Domain::canonical_json( $transition_tampered );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET plan_hash = UNHEX(%s), result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 3",
			$transition_tampered['plan_hash'],
			$transition_tampered_json,
			hash( 'sha256', $transition_tampered_json ),
			$owner_id
		)
	),
	'fixture creates a fully self-consistent historic state-transition tamper'
);
$transition_chain_result = $service->execute( $gap_chain_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $transition_chain_result, 'dependency_unavailable', 503, 'sequential receipt replay rejects a historic resize that changes title' );
v1_8010e_wp_expect( 5 === v1_8010e_e2_physical_owner_counts( $wpdb, $owner_id )['operations'], 'transition-tamper rejection creates no receipt' );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET plan_hash = UNHEX(%s), result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 3",
			$intermediate_original['plan_hash_hex'],
			$intermediate_original_json,
			hash( 'sha256', $intermediate_original_json ),
			$owner_id
		)
	),
	'fixture restores the exact historic transition receipt and Plan hash'
);
$chain_restored = $service->execute( $create, $owner_id, $owner_id, 'learner', $changed_temporal );
v1_8010e_wp_expect( ! empty( $chain_restored['ok'] ) && true === $chain_restored['replayed'] && $first_result === $chain_restored['result'], 'restored contiguous receipt chain replays exact revision-1 truth' );

/* Sequential receipt replay rebases untouched Weeks and binds the full Plan hash. */
$multi_owner = 8421;
$multi_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30700 ) )
);
$multi_a_body = v1_8010e_e2_physical_create( '8010E-e2-multi-week-a-create-01', '0', $temporal, 'Week A study block', '09:00', 30 );
$multi_a = $multi_service->execute( $multi_a_body, $multi_owner, $multi_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $multi_a['ok'] ) && '1' === $multi_a['result']['revision'], 'multi-Week fixture commits Week A at revision 1' );
$multi_b_temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-20', 'America/New_York', 'profile-e2-v1', $runtime_tzdb );
$multi_b_body = v1_8010e_e2_physical_body(
	'8010E-e2-multi-week-b-create-01',
	'1',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	array(
		'title' => 'Week B study block',
		'activity_type' => 'qbank',
		'priority' => 'critical',
		'local_date' => '2026-07-22',
		'local_time' => '09:00',
		'duration_minutes' => 30,
		'fold' => null,
		'temporal_context' => $multi_b_temporal['context'],
	)
);
$multi_b = $multi_service->execute( $multi_b_body, $multi_owner, $multi_owner, 'learner', $multi_b_temporal );
v1_8010e_wp_expect( ! empty( $multi_b['ok'] ) && '2' === $multi_b['result']['revision'], 'multi-Week fixture commits Week B while rebasing Week A to revision 2' );
$multi_move_a = v1_8010e_e2_physical_body(
	'8010E-e2-multi-week-a-move-0001',
	'2',
	MMED_V1_Study_Week_Domain::COMMAND_MOVE,
	array(
		'block_id' => $multi_a['result']['block_id'],
		'local_date' => '2026-07-15',
		'local_time' => '11:00',
		'fold' => null,
		'temporal_context' => $temporal['context'],
	)
);
$multi_moved = $multi_service->execute( $multi_move_a, $multi_owner, $multi_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $multi_moved['ok'] ) && '3' === $multi_moved['result']['revision'], 'multi-Week fixture mutates Week A while rebasing untouched Week B to revision 3' );
$multi_loaded = ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->load( $multi_owner, '2' );
v1_8010e_wp_expect( ! empty( $multi_loaded['ok'] ) && 2 === count( $multi_loaded['plan']['weeks'] ) && '3' === $multi_loaded['plan']['revision'], 'accepted reader reconstructs both Weeks at the current Plan revision' );
v1_8010e_wp_expect( hash_equals( $multi_moved['result']['plan_hash'], hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $multi_loaded['plan'] ) ) ), 'multi-Week mutation result binds the complete two-Week Plan hash' );
$multi_omitted = $multi_b['result'];
$multi_omitted_snapshot = array(
	'plan_id' => $multi_omitted['week']['plan_id'],
	'revision' => $multi_omitted['revision'],
	'schema_version' => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
	'weeks' => array( $multi_omitted['week'] ),
);
$multi_omitted['plan_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $multi_omitted_snapshot ) );
$multi_omitted_json = MMED_V1_Study_Week_Domain::canonical_json( $multi_omitted );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET plan_hash = UNHEX(%s), result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 2",
			$multi_omitted['plan_hash'],
			$multi_omitted_json,
			hash( 'sha256', $multi_omitted_json ),
			$multi_owner
		)
	),
	'fixture creates a self-consistent revision-2 Plan hash that omits prior Week A'
);
$multi_omitted_replay = $multi_service->execute( $multi_b_body, $multi_owner, $multi_owner, 'learner', $multi_b_temporal );
v1_8010e_e2_physical_expect_failure( $multi_omitted_replay, 'dependency_unavailable', 503, 'sequential replay rejects a historic Plan hash that omits a prior Week' );
$multi_b_original_json = MMED_V1_Study_Week_Domain::canonical_json( $multi_b['result'] );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET plan_hash = UNHEX(%s), result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 2",
			$multi_b['result']['plan_hash'],
			$multi_b_original_json,
			hash( 'sha256', $multi_b_original_json ),
			$multi_owner
		)
	),
	'fixture restores the exact revision-2 two-Week Plan hash and result'
);
$multi_b_drift_temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-20', 'America/New_York', 'profile-e2-drift', $runtime_tzdb );
$multi_b_drift_body = $multi_b_body;
$multi_b_drift_body['payload']['temporal_context'] = $multi_b_drift_temporal['context'];
$multi_b_drift_normalized = MMED_V1_Study_Week_Domain::normalize_command( $multi_b_drift_body, $multi_owner, $multi_owner, 'learner', $multi_b_drift_temporal );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET request_json = %s, request_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 2",
			$multi_b_drift_normalized['request_json'],
			$multi_b_drift_normalized['request_hash'],
			$multi_owner
		)
	),
	'fixture creates a canonical historic Week B request with drifted temporal provenance'
);
$multi_b_drift_replay = $multi_service->execute( $multi_b_drift_body, $multi_owner, $multi_owner, 'learner', $multi_b_drift_temporal );
v1_8010e_e2_physical_expect_failure( $multi_b_drift_replay, 'dependency_unavailable', 503, 'sequential replay binds first-seen temporal provenance to the locked Week row' );
$multi_b_original_normalized = MMED_V1_Study_Week_Domain::normalize_command( $multi_b_body, $multi_owner, $multi_owner, 'learner', $multi_b_temporal );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET request_json = %s, request_hash = UNHEX(%s) WHERE owner_id = %d AND revision = 2",
			$multi_b_original_normalized['request_json'],
			$multi_b_original_normalized['request_hash'],
			$multi_owner
		)
	),
	'fixture restores exact Week B receipt temporal provenance'
);
$multi_b_replay = $multi_service->execute( $multi_b_body, $multi_owner, $multi_owner, 'learner', $multi_b_temporal );
v1_8010e_wp_expect( ! empty( $multi_b_replay['ok'] ) && true === $multi_b_replay['replayed'] && $multi_b['result'] === $multi_b_replay['result'], 'late Week B replay returns its exact revision-2 result after Week A advances' );
v1_8010e_wp_expect( array( 'plans' => 1, 'operations' => 3, 'weeks' => 2, 'blocks' => 2 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $multi_owner ), 'multi-Week replay creates no fourth operation or duplicate projection row' );

/* Every pre-commit exception boundary must roll back the provisional Plan too. */
$failpoints = array(
	'after_begin', 'after_gate_lock', 'after_control_lock', 'after_plan_lock', 'after_calendar_fence',
	'after_domain_lock', 'before_plan_publish', 'after_plan_publish', 'before_week_write', 'after_week_write',
	'before_block_write', 'after_block_write', 'after_domain_write', 'after_snapshot_verify',
	'after_receipt_write', 'before_commit',
);
foreach ( $failpoints as $index => $failpoint ) {
	$fail_owner = 8300 + $index;
	$fired = false;
	$probe = function ( $name ) use ( $failpoint, &$fired ) {
		if ( ! $fired && $name === $failpoint ) {
			$fired = true;
			throw new RuntimeException( 'synthetic_e2_failpoint' );
		}
	};
	$fail_service = new MMED_V1_Study_Command_Service(
		new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 10000 + $index * 10 ), $probe )
	);
	$fail_body = v1_8010e_e2_physical_create( sprintf( '8010E-e2-failpoint-%02d-0001', $index ), '0', $temporal, 'Rollback boundary', '09:00', 30 );
	$failure = $fail_service->execute( $fail_body, $fail_owner, $fail_owner, 'learner', $temporal );
	v1_8010e_e2_physical_expect_failure( $failure, 'dependency_unavailable', 503, 'pre-commit failpoint is content-free: ' . $failpoint );
	v1_8010e_wp_expect( $fired, 'requested E2 failpoint is reached: ' . $failpoint );
	v1_8010e_wp_expect(
		array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $fail_owner ),
		'pre-commit failpoint rolls back every owner row: ' . $failpoint
	);
}

/* Caller-owned transaction and altered session modes fail before any writer BEGIN. */
v1_8010e_wp_expect( false !== $wpdb->query( 'CREATE TEMPORARY TABLE v1e2_command_transaction_sentinel (sentinel_id int NOT NULL PRIMARY KEY) ENGINE=InnoDB' ), 'E2 creates a caller transaction sentinel' );
v1_8010e_wp_expect( false !== $wpdb->query( 'START TRANSACTION' ), 'E2 caller starts an outer transaction' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( 'INSERT INTO v1e2_command_transaction_sentinel (sentinel_id) VALUES (1)' ), 'E2 caller writes an uncommitted sentinel' );
$outer = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-outer-transaction-01', '0', $temporal, 'Outer transaction', '14:00', 30 ), 8401, 8401, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $outer, 'dependency_unavailable', 503, 'command writer rejects a caller-owned transaction' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM v1e2_command_transaction_sentinel' ), 'transaction rejection preserves caller uncommitted state' );
v1_8010e_wp_expect( false !== $wpdb->query( 'ROLLBACK' ), 'caller retains control of its own rollback' );
v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( 'SELECT COUNT(*) FROM v1e2_command_transaction_sentinel' ), 'caller rollback removes the sentinel' );
v1_8010e_wp_expect( false !== $wpdb->query( 'DROP TEMPORARY TABLE v1e2_command_transaction_sentinel' ), 'E2 removes the caller transaction sentinel' );

v1_8010e_wp_expect( false !== $wpdb->query( 'SET autocommit = 0' ), 'E2 caller disables autocommit' );
$autocommit_off = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-autocommit-off-0001', '0', $temporal, 'Autocommit off', '14:30', 30 ), 8402, 8402, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $autocommit_off, 'dependency_unavailable', 503, 'command writer rejects autocommit-off session' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET autocommit = 1' ), 'E2 caller restores autocommit' );

/* Writer hardens and restores caller SQL mode and isolation exactly. */
$is_mariadb = false !== stripos( (string) $wpdb->get_var( 'SELECT VERSION()' ), 'mariadb' );
$isolation_variable = $is_mariadb ? '@@SESSION.tx_isolation' : '@@SESSION.transaction_isolation';
$original_sql_mode = (string) $wpdb->get_var( 'SELECT @@SESSION.sql_mode' );
$original_isolation = (string) $wpdb->get_var( 'SELECT ' . $isolation_variable );
v1_8010e_wp_expect( false !== $wpdb->query( "SET SESSION sql_mode = ''" ), 'fixture supplies a non-strict SQL mode' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE' ), 'fixture supplies SERIALIZABLE caller isolation' );
$hardened_owner = 8403;
$hardened_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30000 ) )
);
$hardened_result = $hardened_service->execute( v1_8010e_e2_physical_create( '8010E-e2-session-restore-001', '0', $temporal, 'Session restore', '16:00', 30 ), $hardened_owner, $hardened_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $hardened_result['ok'] ), 'writer succeeds after hardening non-strict SERIALIZABLE caller state' );
v1_8010e_wp_expect( '' === (string) $wpdb->get_var( 'SELECT @@SESSION.sql_mode' ), 'writer restores the exact empty caller SQL mode after success' );
v1_8010e_wp_expect( 'SERIALIZABLE' === strtoupper( str_replace( array( '_', ' ' ), '-', (string) $wpdb->get_var( 'SELECT ' . $isolation_variable ) ) ), 'writer restores SERIALIZABLE after success' );

$restore_fail_owner = 8404;
$restore_failpoint = static function ( $name ) {
	if ( 'after_plan_publish' === $name ) {
		throw new RuntimeException( 'synthetic_session_restore_failure' );
	}
};
$restore_fail_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30100 ), $restore_failpoint )
);
$restore_failure = $restore_fail_service->execute( v1_8010e_e2_physical_create( '8010E-e2-session-rollback-01', '0', $temporal, 'Session rollback', '16:30', 30 ), $restore_fail_owner, $restore_fail_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $restore_failure, 'dependency_unavailable', 503, 'failpoint rolls back under hardened caller state' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $restore_fail_owner ), 'hardened failure leaves no owner truth' );
v1_8010e_wp_expect( '' === (string) $wpdb->get_var( 'SELECT @@SESSION.sql_mode' ), 'writer restores the exact empty caller SQL mode after rollback' );
v1_8010e_wp_expect( 'SERIALIZABLE' === strtoupper( str_replace( array( '_', ' ' ), '-', (string) $wpdb->get_var( 'SELECT ' . $isolation_variable ) ) ), 'writer restores SERIALIZABLE after rollback' );
v1_8010e_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'SET SESSION sql_mode = %s', $original_sql_mode ) ), 'fixture restores original SQL mode' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION TRANSACTION ISOLATION LEVEL ' . str_replace( '-', ' ', strtoupper( str_replace( array( '_', ' ' ), '-', $original_isolation ) ) ) ), 'fixture restores original isolation' );

/* Writer pins utf8mb4 ingress, preserves Unicode, and restores caller encoding. */
$original_encoding = v1_8010e_e2_session_encoding( $wpdb );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET NAMES latin1' ), 'fixture supplies a hostile latin1 connection tuple' );
$latin1_encoding = v1_8010e_e2_session_encoding( $wpdb );
$unicode_owner = 8405;
$unicode_title = 'Café β-cells 🧠 — 100% exact %s %d';
$unicode_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30150 ) )
);
$unicode_body = v1_8010e_e2_physical_create( '8010E-e2-unicode-session-001', '0', $temporal, $unicode_title, '16:45', 30 );
$unicode_result = $unicode_service->execute( $unicode_body, $unicode_owner, $unicode_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $unicode_result['ok'] ), 'writer succeeds after pinning hostile latin1 ingress to utf8mb4' );
v1_8010e_wp_expect( $unicode_title === $unicode_result['result']['week']['blocks'][0]['title'], 'command response preserves the exact Unicode title' );
v1_8010e_wp_expect( $latin1_encoding === v1_8010e_e2_session_encoding( $wpdb ), 'writer restores the exact latin1 caller tuple after success' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET NAMES utf8mb4 COLLATE utf8mb4_bin' ), 'fixture switches to a fresh canonical read tuple' );
$stored_unicode = (string) $wpdb->get_var( $wpdb->prepare( "SELECT title FROM `{$week_tables['blocks']}` WHERE owner_id = %d", $unicode_owner ) );
v1_8010e_wp_expect( $unicode_title === $stored_unicode, 'fresh utf8mb4 read proves non-ASCII title bytes were not mojibake-corrupted' );
$unicode_loaded = ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->load( $unicode_owner, '2' );
v1_8010e_wp_expect( ! empty( $unicode_loaded['ok'] ) && $unicode_result['result']['week'] === $unicode_loaded['plan']['weeks'][0], 'accepted reader returns the exact Unicode Week projection' );
$unicode_receipt = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT request_json, result_json, LOWER(HEX(request_hash)) AS request_hash_hex, LOWER(HEX(result_hash)) AS result_hash_hex FROM `{$kernel['operations']}` WHERE owner_id = %d",
		$unicode_owner
	),
	ARRAY_A
);
v1_8010e_wp_expect( is_array( $unicode_receipt ), 'Unicode receipt is readable through a fresh canonical tuple' );
$unicode_request = json_decode( (string) $unicode_receipt['request_json'], true );
$unicode_stored_result = json_decode( (string) $unicode_receipt['result_json'], true );
v1_8010e_wp_expect( is_array( $unicode_request ) && $unicode_title === $unicode_request['payload']['title'], 'request receipt preserves exact Unicode JSON bytes' );
v1_8010e_wp_expect( $unicode_result['result'] === $unicode_stored_result, 'result receipt preserves the exact Unicode command DTO' );
v1_8010e_wp_expect( hash_equals( hash( 'sha256', $unicode_receipt['request_json'] ), $unicode_receipt['request_hash_hex'] ), 'Unicode request receipt hash matches its exact bytes' );
v1_8010e_wp_expect( hash_equals( hash( 'sha256', $unicode_receipt['result_json'] ), $unicode_receipt['result_hash_hex'] ), 'Unicode result receipt hash matches its exact bytes' );
$unicode_replay = $unicode_service->execute( $unicode_body, $unicode_owner, $unicode_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $unicode_replay['ok'] ) && true === $unicode_replay['replayed'] && $unicode_result['result'] === $unicode_replay['result'], 'Unicode retry replays the exact immutable receipt DTO' );
v1_8010e_e2_restore_session_encoding( $wpdb, $original_encoding );
v1_8010e_wp_expect( $original_encoding === v1_8010e_e2_session_encoding( $wpdb ), 'fixture restores its original connection tuple exactly' );

$encoding_mutation_owner = 8406;
$encoding_mutation_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Encoding_Mutating_Fence(), new V1_8010E_E2_UUID_Source( 30160 ) )
);
$encoding_mutation = $encoding_mutation_service->execute( v1_8010e_e2_physical_create( '8010E-e2-fence-encoding-001', '0', $temporal, 'Encoding mutation', '16:45', 30 ), $encoding_mutation_owner, $encoding_mutation_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $encoding_mutation, 'dependency_unavailable', 503, 'writer rejects a fence that mutates the pinned transaction encoding' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $encoding_mutation_owner ), 'encoding-mutating fence rolls back every provisional owner row' );
v1_8010e_wp_expect( $original_encoding === v1_8010e_e2_session_encoding( $wpdb ), 'encoding-mutating fence failure restores the original tuple exactly' );

$session_mutation_owner = 8420;
$session_mutation_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Session_Mutating_Fence(), new V1_8010E_E2_UUID_Source( 30165 ) )
);
$session_mutation = $session_mutation_service->execute( v1_8010e_e2_physical_create( '8010E-e2-fence-session-0001', '0', $temporal, 'Session mutation', '16:45', 30 ), $session_mutation_owner, $session_mutation_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $session_mutation, 'dependency_unavailable', 503, 'writer rejects a fence that weakens relational session controls' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $session_mutation_owner ), 'session-mutating fence rolls back every provisional owner row' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.autocommit' ), 'failure restores autocommit exactly' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.foreign_key_checks' ), 'failure restores foreign-key enforcement exactly' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.unique_checks' ), 'failure restores unique-key enforcement exactly' );
if ( $is_mariadb ) {
	v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.check_constraint_checks' ), 'failure restores MariaDB CHECK enforcement exactly' );
}
v1_8010e_wp_expect( false === MMED_V1_Study_Native_Session_Guard::transaction_active( $wpdb, (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' ), 'v1_e2_session_mutation_probe_failed' ), 'session-mutating fence leaves no active transaction' );

/* Stored-truth corruption is a dependency failure, never a learner 4xx. */
$corrupt_owner = 8407;
$corrupt_body = v1_8010e_e2_physical_create( '8010E-e2-corrupt-state-0001', '0', $temporal, 'Corruption sentinel', '16:45', 30 );
$corrupt_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30170 ) )
);
$corrupt_first = $corrupt_service->execute( $corrupt_body, $corrupt_owner, $corrupt_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $corrupt_first['ok'] ), 'corruption fixture first commits valid owner truth' );
$corrupt_counts = v1_8010e_e2_physical_owner_counts( $wpdb, $corrupt_owner );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $wpdb->prepare( "UPDATE `{$week_tables['blocks']}` SET activity_type = %s WHERE owner_id = %d", 'not_catalogued', $corrupt_owner ) ), 'fixture introduces a DB-valid but domain-invalid stored activity code' );
$corrupt_replay = $corrupt_service->execute( $corrupt_body, $corrupt_owner, $corrupt_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $corrupt_replay, 'dependency_unavailable', 503, 'stored projection corruption cannot escape as activity_type_invalid 422' );
v1_8010e_wp_expect( $corrupt_counts === v1_8010e_e2_physical_owner_counts( $wpdb, $corrupt_owner ), 'corrupt-store rejection creates no new row or receipt' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $wpdb->prepare( "UPDATE `{$week_tables['blocks']}` SET activity_type = %s WHERE owner_id = %d", 'qbank', $corrupt_owner ) ), 'fixture restores exact accepted activity code' );
$corrupt_restored = $corrupt_service->execute( $corrupt_body, $corrupt_owner, $corrupt_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $corrupt_restored['ok'] ) && true === $corrupt_restored['replayed'] && $corrupt_first['result'] === $corrupt_restored['result'], 'restored state replays the original receipt exactly' );

/* Receipt today is bound to trusted commit time, even under self-consistent tampering. */
$today_owner = 8408;
$today_body = v1_8010e_e2_physical_create( '8010E-e2-receipt-today-0001', '0', $temporal, 'Today binding', '16:45', 30 );
$today_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30180 ) )
);
$today_first = $today_service->execute( $today_body, $today_owner, $today_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $today_first['ok'] ), 'today-binding fixture first commits valid receipt truth' );
$today_original_json = MMED_V1_Study_Week_Domain::canonical_json( $today_first['result'] );
$today_tampered = $today_first['result'];
$today_tampered['today'] = '2000-01-01';
$today_tampered['mission'] = MMED_V1_Study_Week_Domain::derive_mission( $today_tampered['week'], $today_tampered['today'] );
$today_tampered_json = MMED_V1_Study_Week_Domain::canonical_json( $today_tampered );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d",
			$today_tampered_json,
			hash( 'sha256', $today_tampered_json ),
			$today_owner
		)
	),
	'fixture creates self-consistent result/Mission/hash tampering around a false today'
);
$today_replay = $today_service->execute( $today_body, $today_owner, $today_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $today_replay, 'dependency_unavailable', 503, 'receipt today cannot diverge from trusted committed_at in learner timezone' );
v1_8010e_wp_expect(
	1 === (int) $wpdb->query(
		$wpdb->prepare(
			"UPDATE `{$kernel['operations']}` SET result_json = %s, result_hash = UNHEX(%s) WHERE owner_id = %d",
			$today_original_json,
			hash( 'sha256', $today_original_json ),
			$today_owner
		)
	),
	'fixture restores the original immutable result bytes and hash'
);
$today_restored = $today_service->execute( $today_body, $today_owner, $today_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $today_restored['ok'] ) && true === $today_restored['replayed'] && $today_first['result'] === $today_restored['result'], 'restored today binding replays exact original bytes' );

/* Constraint and clock weakening fail before any command row can be written. */
foreach ( array( 'foreign_key_checks', 'unique_checks' ) as $guard_index => $session_guard ) {
	$guard_owner = 8410 + $guard_index;
	v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION ' . $session_guard . ' = 0' ), 'fixture disables ' . $session_guard );
	$guard_result = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-guard-' . $guard_index . '-0000001', '0', $temporal, 'Constraint guard', '17:00', 30 ), $guard_owner, $guard_owner, 'learner', $temporal );
	v1_8010e_e2_physical_expect_failure( $guard_result, 'dependency_unavailable', 503, 'writer rejects disabled ' . $session_guard );
	v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $guard_owner ), 'disabled ' . $session_guard . ' writes nothing' );
	v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION ' . $session_guard . ' = 1' ), 'fixture restores ' . $session_guard );
}
if ( $is_mariadb ) {
	$check_owner = 8412;
	v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION check_constraint_checks = 0' ), 'fixture disables MariaDB CHECK enforcement' );
	$check_result = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-check-guard-0001', '0', $temporal, 'Check guard', '17:00', 30 ), $check_owner, $check_owner, 'learner', $temporal );
	v1_8010e_e2_physical_expect_failure( $check_result, 'dependency_unavailable', 503, 'writer rejects disabled MariaDB CHECK enforcement' );
	v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $check_owner ), 'disabled CHECK enforcement writes nothing' );
	v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION check_constraint_checks = 1' ), 'fixture restores MariaDB CHECK enforcement' );
}
$clock_owner = 8413;
$near_current_timestamp = (int) $wpdb->get_var( 'SELECT UNIX_TIMESTAMP(SYSDATE())' );
v1_8010e_wp_expect( $near_current_timestamp > 0 && false !== $wpdb->query( 'SET SESSION timestamp = ' . $near_current_timestamp ), 'fixture freezes the mutable session clock at a plausible near-current value' );
$clock_result = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-clock-guard-0001', '0', $temporal, 'Clock guard', '17:30', 30 ), $clock_owner, $clock_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $clock_result, 'dependency_unavailable', 503, 'writer rejects even a near-current frozen session clock' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $clock_owner ), 'frozen clock writes nothing' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION timestamp = DEFAULT' ), 'fixture restores the live session clock' );

/* Explicit NO CHAIN / NO RELEASE survives hostile completion defaults. */
$original_completion_type = (string) $wpdb->get_var( 'SELECT @@SESSION.completion_type' );
$completion_connection = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
v1_8010e_wp_expect( false !== $wpdb->query( 'SET SESSION completion_type = 2' ), 'fixture requests implicit RELEASE by default' );
$completion_owner = 8414;
$completion_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30200 ) )
);
$completion_result = $completion_service->execute( v1_8010e_e2_physical_create( '8010E-e2-completion-type-01', '0', $temporal, 'Completion type', '18:00', 30 ), $completion_owner, $completion_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $completion_result['ok'] ), 'writer commits under hostile completion_type' );
v1_8010e_wp_expect( $completion_connection === (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' ), 'NO RELEASE preserves the exact native connection' );
v1_8010e_wp_expect( false === MMED_V1_Study_Native_Session_Guard::transaction_active( $wpdb, $completion_connection, 'v1_e2_completion_probe_failed' ), 'NO CHAIN leaves no active transaction' );
v1_8010e_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'SET SESSION completion_type = %s', $original_completion_type ) ), 'fixture restores completion_type' );

/* Native duplicate handling remains exact under strict MySQLi reporting. */
$driver = new mysqli_driver();
$original_report_mode = $driver->report_mode;
$driver->report_mode = MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT;
$strict_replay = $service->execute( $create, $owner_id, $owner_id, 'learner', $changed_temporal );
$driver->report_mode = $original_report_mode;
v1_8010e_wp_expect(
	! empty( $strict_replay['ok'] ) && true === $strict_replay['replayed'] && $first_result === $strict_replay['result'],
	'native duplicate fence accepts only exact 1062/23000 under strict MySQLi reporting; reason=' . (string) ( $strict_replay['reason_code'] ?? 'missing' ) . '; status=' . (string) ( $strict_replay['status'] ?? 'missing' )
);

$shadow_owner = 8415;
v1_8010e_wp_expect( false !== $wpdb->query( "CREATE TEMPORARY TABLE `{$kernel['operations']}` (v1_probe tinyint unsigned NOT NULL) ENGINE=InnoDB" ), 'fixture shadows one owned table on the command session' );
$shadow_result = $service->execute( v1_8010e_e2_physical_create( '8010E-e2-temp-shadow-0001', '0', $temporal, 'Shadow guard', '18:30', 30 ), $shadow_owner, $shadow_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $shadow_result, 'dependency_unavailable', 503, 'writer rejects a same-session owned-table shadow' );
v1_8010e_wp_expect( false !== $wpdb->query( "DROP TEMPORARY TABLE `{$kernel['operations']}`" ), 'fixture removes the owned-table shadow' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $shadow_owner ), 'temporary shadow rejection writes nothing' );

/* A command-level skipped civil day returns only a usable in-Week suggestion. */
$apia_owner = 8416;
$apia_temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2011-12-26', 'Pacific/Apia', 'profile-apia-v1', $runtime_tzdb );
$apia_gap_body = v1_8010e_e2_physical_body(
	'8010E-e2-apia-gap-000001',
	'0',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	array(
		'title' => 'Skipped civil day',
		'activity_type' => 'qbank',
		'priority' => 'normal',
		'local_date' => '2011-12-30',
		'local_time' => '09:00',
		'duration_minutes' => 30,
		'fold' => null,
		'temporal_context' => $apia_temporal['context'],
	)
);
$apia_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30300 ) )
);
$apia_gap = $apia_service->execute( $apia_gap_body, $apia_owner, $apia_owner, 'learner', $apia_temporal );
v1_8010e_wp_expect(
	false === $apia_gap['ok']
	&& 'dst_gap' === $apia_gap['reason_code']
	&& 422 === $apia_gap['status']
	&& array( 'suggested_slot' => array( 'fold_required' => false, 'local_date' => '2011-12-31', 'local_time' => '06:00' ) ) === $apia_gap['result'],
	'skipped civil day returns one complete display-valid suggestion without private context'
);
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $apia_owner ), 'DST gap writes no provisional truth' );
$apia_retry = $apia_gap_body;
$apia_retry['payload']['local_date'] = $apia_gap['result']['suggested_slot']['local_date'];
$apia_retry['payload']['local_time'] = $apia_gap['result']['suggested_slot']['local_time'];
$apia_ok = $apia_service->execute( $apia_retry, $apia_owner, $apia_owner, 'learner', $apia_temporal );
v1_8010e_wp_expect( ! empty( $apia_ok['ok'] ) && '1' === $apia_ok['result']['revision'], 'resubmitting the safe DST suggestion succeeds exactly once' );
$apia_block = $apia_ok['result']['week']['blocks'][0];
v1_8010e_wp_expect( '2011-12-31' === $apia_block['local_date'] && '06:00' === $apia_block['local_time'] && 'normal' === $apia_block['fold'], 'safe suggestion round-trips as the exact normal local slot' );
$apia_storage = $wpdb->get_row(
	$wpdb->prepare(
		"SELECT CAST(fold_code AS CHAR) AS fold_code, DATE_FORMAT(start_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS start_utc, DATE_FORMAT(end_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS end_utc FROM `{$week_tables['blocks']}` WHERE owner_id = %d",
		$apia_owner
	),
	ARRAY_A
);
v1_8010e_wp_expect( is_array( $apia_storage ) && '0' === $apia_storage['fold_code'] && '2011-12-30 16:00:00.000000' === $apia_storage['start_utc'] && '2011-12-30 16:30:00.000000' === $apia_storage['end_utc'], 'Apia retry persists the exact post-skip UTC interval' );
$apia_loaded = $reader->load( $apia_owner, '2' );
v1_8010e_wp_expect( ! empty( $apia_loaded['ok'] ) && $apia_ok['result']['week'] === $apia_loaded['plan']['weeks'][0], 'accepted reader returns the exact Week produced by the Apia retry' );
$apia_replay = $apia_service->execute( $apia_retry, $apia_owner, $apia_owner, 'learner', $apia_temporal );
v1_8010e_wp_expect( ! empty( $apia_replay['ok'] ) && true === $apia_replay['replayed'] && $apia_ok['result'] === $apia_replay['result'], 'safe-slot retry replays byte-identical Week/Mission truth' );
v1_8010e_wp_expect( array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $apia_owner ), 'Apia gap plus retry leaves exactly one committed row set' );

/* Monday civil-week and 06:00-to-24:00 display boundaries reach the writer. */
$boundary_owner = 8417;
$boundary_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30400 ) )
);
$monday_body = v1_8010e_e2_physical_create( '8010E-e2-monday-boundary-01', '0', $temporal, 'Monday boundary', '06:00', 30 );
$monday_body['payload']['local_date'] = '2026-07-13';
$monday_ok = $boundary_service->execute( $monday_body, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $monday_ok['ok'] ) && '1' === $monday_ok['result']['revision'], 'Monday 06:00 is an accepted first display slot' );
$sunday_body = v1_8010e_e2_physical_body(
	'8010E-e2-sunday-boundary-01',
	'1',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	array(
		'title' => 'Sunday boundary',
		'activity_type' => 'video_lesson',
		'priority' => 'normal',
		'local_date' => '2026-07-19',
		'local_time' => '23:45',
		'duration_minutes' => 15,
		'fold' => null,
		'temporal_context' => $temporal['context'],
	)
);
$sunday_ok = $boundary_service->execute( $sunday_body, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $sunday_ok['ok'] ) && '2' === $sunday_ok['result']['revision'], 'Sunday 23:45 through local midnight remains inside the selected civil Week' );
$next_monday = $sunday_body;
$next_monday['idempotency_key'] = '8010E-e2-next-monday-out-01';
$next_monday['expected_revision'] = '2';
$next_monday['payload']['local_date'] = '2026-07-20';
$next_monday['payload']['local_time'] = '06:00';
$next_monday_result = $boundary_service->execute( $next_monday, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $next_monday_result, 'outside_selected_week', 422, 'next Monday belongs to a different civil Week' );
$previous_sunday = $next_monday;
$previous_sunday['idempotency_key'] = '8010E-e2-previous-sunday-01';
$previous_sunday['payload']['local_date'] = '2026-07-12';
$previous_sunday['payload']['local_time'] = '23:45';
$previous_sunday_result = $boundary_service->execute( $previous_sunday, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $previous_sunday_result, 'outside_selected_week', 422, 'previous Sunday belongs to the prior civil Week' );
$before_canvas = $next_monday;
$before_canvas['idempotency_key'] = '8010E-e2-before-canvas-0001';
$before_canvas['payload']['local_date'] = '2026-07-13';
$before_canvas['payload']['local_time'] = '05:45';
$before_canvas_result = $boundary_service->execute( $before_canvas, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $before_canvas_result, 'outside_display_window', 422, 'Monday 05:45 is before the learner canvas' );
$past_midnight = $next_monday;
$past_midnight['idempotency_key'] = '8010E-e2-past-midnight-0001';
$past_midnight['payload']['local_date'] = '2026-07-19';
$past_midnight['payload']['local_time'] = '23:45';
$past_midnight['payload']['duration_minutes'] = 30;
$past_midnight_result = $boundary_service->execute( $past_midnight, $boundary_owner, $boundary_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $past_midnight_result, 'outside_display_window', 422, 'Sunday 23:45 plus 30 minutes exceeds the civil canvas' );
v1_8010e_wp_expect( 2 === v1_8010e_e2_physical_owner_counts( $wpdb, $boundary_owner )['operations'], 'boundary rejection creates no third revision' );

/* A learner-visible civil fold reaches the writer and is never guessed. */
$fold_owner = 8418;
$fold_temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2010-03-01', 'Antarctica/Casey', 'profile-casey-v1', $runtime_tzdb );
$fold_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30500 ) )
);
$fold_body = v1_8010e_e2_physical_body(
	'8010E-e2-daytime-fold-0001',
	'0',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	array(
		'title' => 'Visible fold earlier',
		'activity_type' => 'qbank',
		'priority' => 'normal',
		'local_date' => '2010-03-04',
		'local_time' => '23:30',
		'duration_minutes' => 30,
		'fold' => null,
		'temporal_context' => $fold_temporal['context'],
	)
);
$fold_missing = $fold_service->execute( $fold_body, $fold_owner, $fold_owner, 'learner', $fold_temporal );
v1_8010e_e2_physical_expect_failure( $fold_missing, 'dst_fold_choice_required', 422, 'ambiguous learner-visible fold requires an explicit earlier/later choice' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $fold_owner ), 'missing fold choice writes no provisional truth' );
$fold_body['payload']['fold'] = 'earlier';
$fold_earlier = $fold_service->execute( $fold_body, $fold_owner, $fold_owner, 'learner', $fold_temporal );
v1_8010e_wp_expect( ! empty( $fold_earlier['ok'] ) && '1' === $fold_earlier['result']['revision'], 'explicit earlier fold commits one exact instant' );
$fold_earlier_result = $fold_earlier['result'];
$fold_earlier_id = $fold_earlier_result['block_id'];
v1_8010e_wp_expect( 'earlier' === $fold_earlier_result['week']['blocks'][0]['fold'], 'earlier fold survives the command response projection' );
$fold_later_body = $fold_body;
$fold_later_body['idempotency_key'] = '8010E-e2-daytime-fold-0002';
$fold_later_body['expected_revision'] = '1';
$fold_later_body['payload']['title'] = 'Visible fold later';
$fold_later_body['payload']['fold'] = 'later';
$fold_later = $fold_service->execute( $fold_later_body, $fold_owner, $fold_owner, 'learner', $fold_temporal );
v1_8010e_wp_expect( ! empty( $fold_later['ok'] ) && '2' === $fold_later['result']['revision'], 'explicit later fold commits the distinct repeated-wall-time instant' );
$fold_later_id = $fold_later['result']['block_id'];
$fold_projection = array();
foreach ( $fold_later['result']['week']['blocks'] as $fold_block ) {
	$fold_projection[ $fold_block['block_id'] ] = $fold_block;
}
v1_8010e_wp_expect( 'earlier' === $fold_projection[ $fold_earlier_id ]['fold'] && 'later' === $fold_projection[ $fold_later_id ]['fold'], 'revision 2 preserves both distinct fold identities' );
$fold_rows = $wpdb->get_results(
	$wpdb->prepare(
		"SELECT LOWER(HEX(block_id)) AS block_hex, CAST(fold_code AS CHAR) AS fold_code, DATE_FORMAT(start_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS start_utc, DATE_FORMAT(end_at_utc, '%%Y-%%m-%%d %%H:%%i:%%s.%%f') AS end_utc FROM `{$week_tables['blocks']}` WHERE owner_id = %d ORDER BY start_at_utc",
		$fold_owner
	),
	ARRAY_A
);
v1_8010e_wp_expect(
	is_array( $fold_rows )
	&& 2 === count( $fold_rows )
	&& '1' === $fold_rows[0]['fold_code']
	&& '2010-03-04 12:30:00.000000' === $fold_rows[0]['start_utc']
	&& '2010-03-04 13:00:00.000000' === $fold_rows[0]['end_utc']
	&& '2' === $fold_rows[1]['fold_code']
	&& '2010-03-04 15:30:00.000000' === $fold_rows[1]['start_utc']
	&& '2010-03-04 16:00:00.000000' === $fold_rows[1]['end_utc']
	&& 10800 === strtotime( $fold_rows[1]['start_utc'] . ' UTC' ) - strtotime( $fold_rows[0]['start_utc'] . ' UTC' ),
	'physical fold code and UTC intervals preserve the three-hour Casey repetition exactly'
);
$fold_loaded = $reader->load( $fold_owner, '2' );
v1_8010e_wp_expect( ! empty( $fold_loaded['ok'] ) && $fold_later['result']['week'] === $fold_loaded['plan']['weeks'][0], 'accepted reader returns the exact same folded Week as the revision-2 command' );
$fold_replay = $fold_service->execute( $fold_body, $fold_owner, $fold_owner, 'learner', $fold_temporal );
v1_8010e_wp_expect( ! empty( $fold_replay['ok'] ) && true === $fold_replay['replayed'] && $fold_earlier_result === $fold_replay['result'], 'late earlier-fold retry replays its original revision-1 Week and Mission bytes' );
v1_8010e_wp_expect( 2 === v1_8010e_e2_physical_owner_counts( $wpdb, $fold_owner )['operations'], 'both explicit fold instants have one immutable receipt each' );

$unexpected_fold_owner = 8419;
$unexpected_fold_body = v1_8010e_e2_physical_create( '8010E-e2-unexpected-fold-001', '0', $temporal, 'Unexpected fold', '19:00', 30 );
$unexpected_fold_body['payload']['fold'] = 'earlier';
$unexpected_fold_service = new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30600 ) )
);
$unexpected_fold = $unexpected_fold_service->execute( $unexpected_fold_body, $unexpected_fold_owner, $unexpected_fold_owner, 'learner', $temporal );
v1_8010e_e2_physical_expect_failure( $unexpected_fold, 'dst_fold_choice_unexpected', 422, 'normal wall time rejects an invented fold choice' );
v1_8010e_wp_expect( array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === v1_8010e_e2_physical_owner_counts( $wpdb, $unexpected_fold_owner ), 'unexpected fold choice writes no provisional truth' );

v1_8010e_wp_expect( $fence->control_locks >= 9 && $fence->calendar_locks >= 8, 'synthetic fence is exercised for successful, replayed, and rejected post-Plan commands' );
v1_8010e_wp_expect( MMED_V1_Study_Domain::BINDING_READY === ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->binding_kind(), 'all E2 fixtures preserve exact generation-2 readiness' );

$wpdb->set_prefix( $original_prefix );
echo "V1 Study Schedule 8010E E2 physical command writer: ok\n";
