<?php
/** Pure PHP 7.4-compatible 8010E E2 command-writer contract. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-command-service.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-command-state.php';

function v1_8010e_e2_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010e_e2_reason( $callback ) {
	try {
		$callback();
	} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
		return $error->reason_code();
	}
	throw new RuntimeException( 'Expected E2 domain failure.' );
}

function v1_8010e_e2_body( $key, $revision, $command, $payload ) {
	return array(
		'idempotency_key'  => $key,
		'expected_revision'=> $revision,
		'command'          => $command,
		'payload'          => $payload,
	);
}

final class V1_8010E_E2_Fake_Repository implements MMED_V1_Study_Command_Repository {
	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		unset( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
		return array(
			'ok' => true,
			'reason_code' => 'ok',
			'replayed' => false,
			'result' => array(
				'action' => 'create_block',
				'block_id' => '30000000-0000-4000-8000-000000000001',
				'operation_id' => '40000000-0000-4000-8000-000000000001',
				'plan_hash' => str_repeat( 'a', 64 ),
				'revision' => '1',
			),
			'status' => 200,
		);
	}
}

final class V1_8010E_E2_Failing_Repository implements MMED_V1_Study_Command_Repository {
	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		unset( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
		throw new MMED_V1_Study_Command_Exception( 'stale_revision' );
	}
}

$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-42-v7', '2026a' );
$plan_id = '10000000-0000-4000-8000-000000000001';
$week_id = '20000000-0000-4000-8000-000000000001';
$block_id = '30000000-0000-4000-8000-000000000001';
$now = '2026-07-15 12:00:00.000000';

$create_body = v1_8010e_e2_body(
	'8010E-e2-create-01',
	'0',
	'create_block',
	array(
		'title' => 'UWorld cardiology',
		'activity_type' => 'qbank',
		'priority' => 'critical',
		'local_date' => '2026-07-15',
		'local_time' => '09:00',
		'duration_minutes' => 90,
		'fold' => null,
		'temporal_context' => $temporal['context'],
	)
);
$create = MMED_V1_Study_Week_Domain::normalize_command( $create_body, 42, 42, 'learner', $temporal );
$state = MMED_V1_Study_Week_Command_State::apply(
	$create,
	42,
	$plan_id,
	'0',
	array(),
	array(),
	array( 'week_id' => $week_id, 'block_id' => $block_id ),
	$now
);
v1_8010e_e2_expect( '1' === $state['next_revision'], 'first command advances exactly 0 to 1' );
v1_8010e_e2_expect( $plan_id === $state['snapshot']['plan_id'], 'Plan UUID is server supplied and stable' );
v1_8010e_e2_expect( $week_id === $state['snapshot']['weeks'][0]['week_id'], 'Week UUID is server supplied and stable' );
v1_8010e_e2_expect( $block_id === $state['snapshot']['weeks'][0]['blocks'][0]['block_id'], 'Block UUID is server supplied and stable' );
v1_8010e_e2_expect( '1' === $state['snapshot']['weeks'][0]['revision'], 'Week projection carries the Plan revision' );
$mission = MMED_V1_Study_Week_Domain::derive_mission( $state['snapshot']['weeks'][0], '2026-07-15' );
v1_8010e_e2_expect( '1' === $mission['revision'] && $block_id === $mission['primary']['block_id'], 'Mission derives from the exact committed Week revision' );

$overlap_body = $create_body;
$overlap_body['idempotency_key'] = '8010E-e2-overlap-1';
$overlap_body['expected_revision'] = '1';
$overlap_body['payload']['local_time'] = '09:30';
$overlap = MMED_V1_Study_Week_Domain::normalize_command( $overlap_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect(
	'block_collision' === v1_8010e_e2_reason(
		static function () use ( $overlap, $plan_id, $state, $now ) {
			MMED_V1_Study_Week_Command_State::apply(
				$overlap,
				42,
				$plan_id,
				'1',
				$state['week_rows'],
				$state['block_rows'],
				array(
					'week_id' => '20000000-0000-4000-8000-000000000002',
					'block_id' => '30000000-0000-4000-8000-000000000002',
				),
				$now
			);
		}
	),
	'collision is rechecked against locked storage rows'
);

$move_body = v1_8010e_e2_body(
	'8010E-e2-move-0001',
	'1',
	'move_block',
	array( 'block_id' => $block_id, 'local_date' => '2026-07-15', 'local_time' => '11:00', 'fold' => null, 'temporal_context' => $temporal['context'] )
);
$move = MMED_V1_Study_Week_Domain::normalize_command( $move_body, 42, 42, 'learner', $temporal );
$state = MMED_V1_Study_Week_Command_State::apply( $move, 42, $plan_id, '1', $state['week_rows'], $state['block_rows'], array(), '2026-07-15 12:01:00.000000' );
v1_8010e_e2_expect( '2' === $state['next_revision'] && '11:00' === $state['snapshot']['weeks'][0]['blocks'][0]['local_time'], 'move preserves identity and advances once' );

$resize_body = v1_8010e_e2_body(
	'8010E-e2-resize-01',
	'2',
	'resize_block',
	array( 'block_id' => $block_id, 'duration_minutes' => 120, 'temporal_context' => $temporal['context'] )
);
$resize = MMED_V1_Study_Week_Domain::normalize_command( $resize_body, 42, 42, 'learner', $temporal );
$state = MMED_V1_Study_Week_Command_State::apply( $resize, 42, $plan_id, '2', $state['week_rows'], $state['block_rows'], array(), '2026-07-15 12:02:00.000000' );
v1_8010e_e2_expect( '3' === $state['next_revision'] && 120 === $state['snapshot']['weeks'][0]['blocks'][0]['duration_minutes'], 'resize preserves identity and advances once' );

$delete_body = v1_8010e_e2_body(
	'8010E-e2-delete-01',
	'3',
	'delete_block',
	array( 'block_id' => $block_id, 'temporal_context' => $temporal['context'] )
);
$delete = MMED_V1_Study_Week_Domain::normalize_command( $delete_body, 42, 42, 'learner', $temporal );
$state = MMED_V1_Study_Week_Command_State::apply( $delete, 42, $plan_id, '3', $state['week_rows'], $state['block_rows'], array(), '2026-07-15 12:03:00.000000' );
v1_8010e_e2_expect( '4' === $state['next_revision'], 'delete advances exactly once' );
v1_8010e_e2_expect( 'tombstoned' === $state['snapshot']['weeks'][0]['blocks'][0]['state'], 'delete is a durable tombstone' );
v1_8010e_e2_expect( '4' === $state['block_after']['tombstoned_revision'], 'tombstone binds the update revision' );
v1_8010e_e2_expect( $block_id === $state['snapshot']['weeks'][0]['blocks'][0]['block_id'], 'tombstone retains Block identity' );

$service_result = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Fake_Repository() ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( true === $service_result['ok'] && 200 === $service_result['status'], 'service accepts only the exact internal success envelope' );
$failure = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Failing_Repository() ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( false === $failure['ok'] && 'stale_revision' === $failure['reason_code'] && 409 === $failure['status'], 'service returns a content-free allowlisted conflict' );

$uuid_source = new MMED_V1_Study_CSPRNG_UUID_Source();
$seen = array();
for ( $index = 0; $index < 32; ++$index ) {
	$uuid = $uuid_source->next_uuid();
	v1_8010e_e2_expect( $uuid === MMED_V1_Study_Week_Domain::uuid( $uuid ), 'CSPRNG source emits lowercase UUID v4 values' );
	v1_8010e_e2_expect( ! isset( $seen[ $uuid ] ), 'CSPRNG UUIDs do not repeat in the contract sample' );
	$seen[ $uuid ] = true;
}

$source = '';
foreach ( array( 'class-mmed-v1-study-command-service.php', 'class-mmed-v1-study-week-command-state.php', 'class-mmed-v1-study-innodb-command-repository.php' ) as $source_file ) {
	$bytes = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/' . $source_file );
	v1_8010e_e2_expect( is_string( $bytes ), 'E2 source is readable' );
	$source .= $bytes;
}
foreach ( array( 'add_action', 'add_filter', 'register_rest_route', 'get_option', 'add_option', 'update_option', 'delete_option', 'set_transient', 'wp_remote_', 'curl_', 'INSERT IGNORE', 'DELETE FROM' ) as $forbidden ) {
	v1_8010e_e2_expect( false === stripos( $source, $forbidden . ( false === strpos( $forbidden, ' ' ) ? '(' : '' ) ), 'E2 writer remains isolated: ' . $forbidden );
}
v1_8010e_e2_expect( false === stripos( $source, 'mmed_study_schedule' ), 'E2 contains no legacy Calendar table SQL' );
$plugin = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php' );
v1_8010e_e2_expect( is_string( $plugin ) && false === strpos( $plugin, 'class-mmed-v1-study-command-service.php' ), 'E2 has no plugin runtime include' );
v1_8010e_e2_expect( false === strpos( $plugin, 'class-mmed-v1-study-innodb-command-repository.php' ), 'E2 physical writer has no runtime binding' );

echo "V1 Study Schedule 8010E E2 pure command contract: ok\n";
