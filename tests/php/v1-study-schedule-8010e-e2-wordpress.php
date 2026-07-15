<?php
/** Disposable WordPress/InnoDB proof for the isolated 8010E E2 writer. */

if ( ! defined( 'ABSPATH' ) || ! isset( $GLOBALS['wpdb'] ) || ! function_exists( 'v1_8010e_wp_expect' ) ) {
	throw new RuntimeException( 'This E2 fixture must run after the disposable E0/E1 fixtures.' );
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1 repository root is unavailable.' );
}

require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-command-service.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-command-state.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-command-repository.php';

/** Synthetic same-transaction seam; E3 must replace this before runtime use. */
final class V1_8010E_E2_Synthetic_Fence implements MMED_V1_Study_Command_Fence {
	public $events = array();

	public function scope() {
		return self::SCOPE_SYNTHETIC_ISOLATED;
	}

	public function lock_control_rows( $database, $connection_id, $owner_id ) {
		$actual = (int) $database->get_var( 'SELECT CONNECTION_ID()' );
		if ( $actual !== (int) $connection_id || (int) $owner_id <= 0 ) {
			return false;
		}
		$this->events[] = 'control:' . (string) $owner_id;
		return true;
	}

	public function lock_calendar_rows( $database, $connection_id, $owner_id ) {
		$actual = (int) $database->get_var( 'SELECT CONNECTION_ID()' );
		if ( $actual !== (int) $connection_id || (int) $owner_id <= 0 ) {
			return false;
		}
		$this->events[] = 'calendar-seam:' . (string) $owner_id;
		return true;
	}
}

/** Deterministic valid UUIDs for disposable row-identity assertions. */
final class V1_8010E_E2_UUID_Source implements MMED_V1_Study_UUID_Source {
	private $counter;

	public function __construct( $counter = 1 ) {
		$this->counter = (int) $counter;
	}

	public function next_uuid() {
		$uuid = sprintf( 'e2000000-0000-4000-8000-%012d', $this->counter );
		++$this->counter;
		return $uuid;
	}
}

function v1_8010e_e2_wp_body( $key, $revision, $command, $payload ) {
	return array(
		'idempotency_key' => $key,
		'expected_revision' => $revision,
		'command' => $command,
		'payload' => $payload,
	);
}

function v1_8010e_e2_wp_create( $key, $revision, $temporal, $time, $title = 'UWorld cardiology' ) {
	return v1_8010e_e2_wp_body(
		$key,
		$revision,
		'create_block',
		array(
			'title' => $title,
			'activity_type' => 'qbank',
			'priority' => 'critical',
			'local_date' => '2026-07-15',
			'local_time' => $time,
			'duration_minutes' => 90,
			'fold' => null,
			'temporal_context' => $temporal['context'],
		)
	);
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e2_' );
$wpdb->suppress_errors( true );

$store = 'e2010000-0000-4000-8000-000000000001';
$runner_1 = 'e2010000-0000-4000-8000-000000000002';
$runner_2 = 'e2010000-0000-4000-8000-000000000003';
$parent = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store, $runner_1 );
v1_8010e_wp_expect( ! empty( $parent['ok'] ) && 1 === (int) $parent['generation'], 'E2 synthetic parent commissions generation 1' );
$generation = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $store, $runner_2 );
v1_8010e_wp_expect( ! empty( $generation['ok'] ) && 2 === (int) $generation['generation'], 'E2 synthetic store commissions exact generation 2' );

$kernel = MMED_V1_Study_Schema::table_names( $wpdb );
$week_tables = MMED_V1_Study_Week_Schema::table_names( $wpdb );
$owner_id = 8201;
$fence = new V1_8010E_E2_Synthetic_Fence();
$uuid_source = new V1_8010E_E2_UUID_Source();
$service = new MMED_V1_Study_Command_Service( new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, $fence, $uuid_source ) );
$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-8201-v1', '2026a' );

$create_body = v1_8010e_e2_wp_create( '8010E-e2-physical-create', '0', $temporal, '09:00' );
$created = $service->execute( $create_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $created['ok'] ) && false === $created['replayed'] && '1' === $created['result']['revision'], 'first E2 command commits revision 1' );
v1_8010e_wp_expect( 'e2000000-0000-4000-8000-000000000003' === $created['result']['block_id'], 'first E2 Block UUID is server issued' );
v1_8010e_wp_expect( 'e2000000-0000-4000-8000-000000000004' === $created['result']['operation_id'], 'first E2 operation UUID is server issued' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['plans']}` WHERE owner_id = {$owner_id} AND current_revision = 1" ), 'first command creates one positive Plan' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['weeks']}` WHERE owner_id = {$owner_id}" ), 'first command creates one Week' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['blocks']}` WHERE owner_id = {$owner_id}" ), 'first command creates one Block' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = {$owner_id}" ), 'first command creates one receipt' );
$watermark_hex = (string) $wpdb->get_var( "SELECT LOWER(HEX(watermark_operation_id)) FROM `{$kernel['plans']}` WHERE owner_id = {$owner_id}" );
v1_8010e_wp_expect( v1_8010e_wp_uuid_hex( $created['result']['operation_id'] ) === $watermark_hex, 'revision-1 operation is the immutable owner watermark' );

$reader = new MMED_V1_Study_Week_Current_Reader( $wpdb );
$loaded = $reader->load( $owner_id );
v1_8010e_wp_expect( ! empty( $loaded['ok'] ) && '1' === $loaded['plan']['revision'], 'E1 current reader reloads first E2 truth' );
$plan_id = $loaded['plan']['plan_id'];
$week_id = $loaded['plan']['weeks'][0]['week_id'];
$block_id = $loaded['plan']['weeks'][0]['blocks'][0]['block_id'];
$mission = MMED_V1_Study_Week_Domain::derive_mission( $loaded['plan']['weeks'][0], '2026-07-15' );
v1_8010e_wp_expect( '1' === $mission['revision'] && $block_id === $mission['primary']['block_id'], 'Mission derives from the exact first-operation revision' );

$changed_profile = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-8201-v2', '2026a' );
$replayed = $service->execute( $create_body, $owner_id, $owner_id, 'learner', $changed_profile );
v1_8010e_wp_expect( ! empty( $replayed['ok'] ) && true === $replayed['replayed'] && $created['result'] === $replayed['result'], 'same key/request replays exact stored result after profile-context drift' );
$changed = $create_body;
$changed['payload']['duration_minutes'] = 120;
$conflict = $service->execute( $changed, $owner_id, $owner_id, 'learner', $changed_profile );
v1_8010e_wp_expect( empty( $conflict['ok'] ) && 'idempotency_conflict' === $conflict['reason_code'], 'changed same-key semantics conflict before stale revision' );
$stale = v1_8010e_e2_wp_create( '8010E-e2-stale-key-01', '0', $changed_profile, '13:00' );
$stale_result = $service->execute( $stale, $owner_id, $owner_id, 'learner', $changed_profile );
v1_8010e_wp_expect( empty( $stale_result['ok'] ) && 'stale_revision' === $stale_result['reason_code'], 'new stale key writes no receipt' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = {$owner_id}" ), 'replay and conflicts consume no receipt or revision' );

$move = v1_8010e_e2_wp_body(
	'8010E-e2-physical-move1',
	'1',
	'move_block',
	array( 'block_id' => $block_id, 'local_date' => '2026-07-15', 'local_time' => '11:00', 'fold' => null, 'temporal_context' => $temporal['context'] )
);
$moved = $service->execute( $move, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $moved['ok'] ) && '2' === $moved['result']['revision'] && $block_id === $moved['result']['block_id'], 'move advances one revision and preserves Block UUID' );
$resize = v1_8010e_e2_wp_body(
	'8010E-e2-physical-size1',
	'2',
	'resize_block',
	array( 'block_id' => $block_id, 'duration_minutes' => 120, 'temporal_context' => $temporal['context'] )
);
$resized = $service->execute( $resize, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $resized['ok'] ) && '3' === $resized['result']['revision'], 'resize advances one revision' );

$collision_body = v1_8010e_e2_wp_create( '8010E-e2-physical-hit01', '3', $temporal, '12:00', 'Overlapping review' );
$collision = $service->execute( $collision_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( empty( $collision['ok'] ) && 'block_collision' === $collision['reason_code'], 'physical writer rejects overlap inside owner transaction' );
$adjacent_body = v1_8010e_e2_wp_create( '8010E-e2-physical-next1', '3', $temporal, '13:00', 'Adjacent review' );
$adjacent = $service->execute( $adjacent_body, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $adjacent['ok'] ) && '4' === $adjacent['result']['revision'], 'half-open adjacency commits' );

$delete = v1_8010e_e2_wp_body(
	'8010E-e2-physical-del01',
	'4',
	'delete_block',
	array( 'block_id' => $block_id, 'temporal_context' => $temporal['context'] )
);
$deleted = $service->execute( $delete, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $deleted['ok'] ) && '5' === $deleted['result']['revision'], 'delete advances one revision' );
$second_delete = $delete;
$second_delete['idempotency_key'] = '8010E-e2-delete-again1';
$second_delete['expected_revision'] = '5';
$second_delete_result = $service->execute( $second_delete, $owner_id, $owner_id, 'learner', $temporal );
v1_8010e_wp_expect( empty( $second_delete_result['ok'] ) && 'block_not_found' === $second_delete_result['reason_code'], 'new-key second delete is non-enumerating and non-mutating' );

$loaded = $reader->load( $owner_id );
v1_8010e_wp_expect( ! empty( $loaded['ok'] ) && '5' === $loaded['plan']['revision'], 'current reader reloads the complete CRUD revision' );
v1_8010e_wp_expect( $plan_id === $loaded['plan']['plan_id'] && $week_id === $loaded['plan']['weeks'][0]['week_id'], 'Plan and Week UUIDs remain stable across CRUD' );
$by_id = array();
foreach ( $loaded['plan']['weeks'][0]['blocks'] as $block ) {
	$by_id[ $block['block_id'] ] = $block;
}
v1_8010e_wp_expect( isset( $by_id[ $block_id ] ) && 'tombstoned' === $by_id[ $block_id ]['state'], 'delete retains the original row as a tombstone' );
v1_8010e_wp_expect( 2 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['blocks']}` WHERE owner_id = {$owner_id}" ), 'tombstone and adjacent Block are both durable' );
v1_8010e_wp_expect( 5 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = {$owner_id}" ), 'only five accepted commands have receipts' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['blocks']}` WHERE owner_id = {$owner_id} AND block_id = UNHEX('" . v1_8010e_wp_uuid_hex( $block_id ) . "') AND state_code = 3 AND updated_revision = 5 AND tombstoned_revision = 5 AND tombstoned_at IS NOT NULL" ), 'physical tombstone revision and timestamp are exact' );

$failpoints = array(
	'after_begin', 'after_gate_lock', 'after_control_lock', 'after_plan_lock', 'after_calendar_fence', 'after_domain_lock',
	'before_plan_publish', 'after_plan_publish', 'before_week_write', 'after_week_write', 'before_block_write',
	'after_block_write', 'after_domain_write', 'after_snapshot_verify', 'after_receipt_write', 'before_commit',
);
foreach ( $failpoints as $index => $target ) {
	$fail_owner = 8300 + $index;
	$fail = static function ( $name ) use ( $target ) {
		if ( $name === $target ) {
			throw new RuntimeException( 'synthetic-e2-failpoint' );
		}
	};
	$fail_service = new MMED_V1_Study_Command_Service(
		new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 1000 + $index * 10 ), $fail )
	);
	$failed = $fail_service->execute( v1_8010e_e2_wp_create( '8010E-e2-fail-' . str_pad( (string) $index, 4, '0', STR_PAD_LEFT ), '0', $temporal, '09:00' ), $fail_owner, $fail_owner, 'learner', $temporal );
	v1_8010e_wp_expect( empty( $failed['ok'] ) && 'dependency_unavailable' === $failed['reason_code'], 'first-operation failpoint is content-free: ' . $target );
	v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['plans']}` WHERE owner_id = {$fail_owner}" ), 'failpoint rolls back Plan fence: ' . $target );
	v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['weeks']}` WHERE owner_id = {$fail_owner}" ), 'failpoint rolls back Week: ' . $target );
	v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['blocks']}` WHERE owner_id = {$fail_owner}" ), 'failpoint rolls back Block: ' . $target );
	v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['operations']}` WHERE owner_id = {$fail_owner}" ), 'failpoint rolls back receipt: ' . $target );
}

v1_8010e_wp_expect( count( $fence->events ) >= 12, 'synthetic fence was invoked for every physical command attempt after Plan lock' );
v1_8010e_wp_expect( MMED_V1_Study_Domain::BINDING_READY === ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->binding_kind(), 'E2 command and failpoint proofs preserve exact store provenance' );
$wpdb->set_prefix( $original_prefix );

echo "V1 Study Schedule 8010E E2 physical command writer: ok\n";
