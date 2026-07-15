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
	private $result;

	public function __construct( $result ) {
		$this->result = $result;
	}

	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		unset( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
		return array(
			'ok' => true,
			'reason_code' => 'ok',
			'replayed' => false,
			'result' => $this->result,
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

final class V1_8010E_E2_Gap_Repository implements MMED_V1_Study_Command_Repository {
	private $malformed;

	public function __construct( $malformed = false ) {
		$this->malformed = (bool) $malformed;
	}

	public function commit( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope ) {
		unset( $candidate, $owner_id, $actor_id, $actor_kind, $temporal_envelope );
		$suggestion = array( 'fold_required' => false, 'local_date' => '2026-07-15', 'local_time' => '06:00' );
		if ( $this->malformed ) {
			$suggestion['private'] = 'must-not-escape';
		}
		throw new MMED_V1_Study_Week_Domain_Exception( 'dst_gap', array( 'suggested_slot' => $suggestion ) );
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
$created_state = $state;

/* Every learner mutation rejects a canonical external fixed anchor. */
$fixed_rows = $created_state['block_rows'];
$fixed_rows[0]['state_code'] = (string) MMED_V1_Study_Week_Domain::STATE_CODE_FIXED;
$fixed_rows[0]['source_code'] = (string) MMED_V1_Study_Week_Domain::SOURCE_CODE_EXTERNAL;
$fixed_rows[0]['source_namespace_hash_hex'] = str_repeat( 'a', 64 );
$fixed_rows[0]['source_ref_hash_hex'] = str_repeat( 'b', 64 );
$fixed_rows[0]['source_version_hash_hex'] = str_repeat( 'c', 64 );
$fixed_bodies = array(
	v1_8010e_e2_body( '8010E-e2-fixed-move-01', '1', MMED_V1_Study_Week_Domain::COMMAND_MOVE, array( 'block_id' => $block_id, 'local_date' => '2026-07-15', 'local_time' => '11:00', 'fold' => null, 'temporal_context' => $temporal['context'] ) ),
	v1_8010e_e2_body( '8010E-e2-fixed-resize-1', '1', MMED_V1_Study_Week_Domain::COMMAND_RESIZE, array( 'block_id' => $block_id, 'duration_minutes' => 120, 'temporal_context' => $temporal['context'] ) ),
	v1_8010e_e2_body( '8010E-e2-fixed-delete-1', '1', MMED_V1_Study_Week_Domain::COMMAND_DELETE, array( 'block_id' => $block_id, 'temporal_context' => $temporal['context'] ) ),
);
$fixed_before = MMED_V1_Study_Week_Domain::canonical_json( $fixed_rows );
foreach ( $fixed_bodies as $fixed_body ) {
	$fixed_command = MMED_V1_Study_Week_Domain::normalize_command( $fixed_body, 42, 42, 'learner', $temporal );
	v1_8010e_e2_expect(
		'fixed_anchor_immutable' === v1_8010e_e2_reason(
			static function () use ( $fixed_command, $plan_id, $created_state, $fixed_rows, $now ) {
				MMED_V1_Study_Week_Command_State::apply( $fixed_command, 42, $plan_id, '1', $created_state['week_rows'], $fixed_rows, array(), $now );
			}
		),
		'fixed anchor rejects command: ' . $fixed_command['command']
	);
	v1_8010e_e2_expect( $fixed_before === MMED_V1_Study_Week_Domain::canonical_json( $fixed_rows ), 'fixed-anchor rejection leaves reducer input unchanged' );
}

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

$fake_plan_hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $created_state['snapshot'] ) );
$fake_result = MMED_V1_Study_Week_Command_State::command_result(
	$created_state['snapshot'],
	$temporal['week_start'],
	'2026-07-15',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	$block_id,
	'40000000-0000-4000-8000-000000000001',
	$fake_plan_hash
);
$other_week = array(
	'blocks'     => array(),
	'plan_id'    => $plan_id,
	'revision'   => '1',
	'week_id'    => '20000000-0000-4000-8000-000000000002',
	'week_start' => '2026-07-20',
);
$other_week['projection_hash'] = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $other_week ) );
$two_week_snapshot = $created_state['snapshot'];
$two_week_snapshot['weeks'] = array( $other_week, $created_state['snapshot']['weeks'][0] );
$two_week_hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $two_week_snapshot ) );
$selected_result = MMED_V1_Study_Week_Command_State::command_result(
	$two_week_snapshot,
	$temporal['week_start'],
	'2026-07-15',
	MMED_V1_Study_Week_Domain::COMMAND_CREATE,
	$block_id,
	'40000000-0000-4000-8000-000000000002',
	$two_week_hash
);
v1_8010e_e2_expect( $temporal['week_start'] === $selected_result['week']['week_start'], 'command result selects the requested Week rather than the first Plan Week' );
v1_8010e_e2_expect(
	'week_projection_missing' === v1_8010e_e2_reason(
		static function () use ( $two_week_snapshot, $two_week_hash, $block_id ) {
			$missing = $two_week_snapshot;
			$missing['weeks'] = array( $two_week_snapshot['weeks'][0] );
			$hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $missing ) );
			MMED_V1_Study_Week_Command_State::command_result( $missing, '2026-07-13', '2026-07-15', MMED_V1_Study_Week_Domain::COMMAND_CREATE, $block_id, '40000000-0000-4000-8000-000000000003', $hash );
		}
	),
	'command result rejects a missing selected Week'
);
v1_8010e_e2_expect(
	'week_projection_duplicate_week' === v1_8010e_e2_reason(
		static function () use ( $created_state, $block_id ) {
			$duplicate = $created_state['snapshot'];
			$duplicate['weeks'][] = $duplicate['weeks'][0];
			$hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $duplicate ) );
			MMED_V1_Study_Week_Command_State::command_result( $duplicate, '2026-07-13', '2026-07-15', MMED_V1_Study_Week_Domain::COMMAND_CREATE, $block_id, '40000000-0000-4000-8000-000000000004', $hash );
		}
	),
	'command result rejects duplicate selected Weeks'
);
v1_8010e_e2_expect(
	'command_result_invalid' === v1_8010e_e2_reason(
		static function () use ( $created_state, $block_id ) {
			MMED_V1_Study_Week_Command_State::command_result( $created_state['snapshot'], '2026-07-13', '2026-07-15', MMED_V1_Study_Week_Domain::COMMAND_CREATE, $block_id, '40000000-0000-4000-8000-000000000005', str_repeat( '0', 64 ) );
		}
	),
	'command result rejects a hash not bound to the full Plan snapshot'
);
$tampered_results = array();
$tampered = $fake_result;
$tampered['private'] = true;
$tampered_results[] = $tampered;
$tampered = $fake_result;
$tampered['mission']['revision'] = '2';
$tampered_results[] = $tampered;
$tampered = $fake_result;
$tampered['week']['projection_hash'] = str_repeat( '0', 64 );
$tampered_results[] = $tampered;
$tampered = $fake_result;
$tampered['revision'] = '2';
$tampered_results[] = $tampered;
$tampered = $fake_result;
$tampered['block_id'] = '50000000-0000-4000-8000-000000000001';
$tampered_results[] = $tampered;
$tampered = $fake_result;
$tampered['action'] = MMED_V1_Study_Week_Domain::COMMAND_DELETE;
$tampered_results[] = $tampered;
foreach ( $tampered_results as $tampered_result ) {
	v1_8010e_e2_expect(
		'command_result_invalid' === v1_8010e_e2_reason( static function () use ( $tampered_result ) { MMED_V1_Study_Week_Command_State::assert_command_result( $tampered_result ); } ),
		'every command-result tamper collapses to one stable invalid reason'
	);
}
$service_result = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Fake_Repository( $fake_result ) ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( true === $service_result['ok'] && 200 === $service_result['status'], 'service accepts only the exact internal success envelope' );
v1_8010e_e2_expect( $created_state['snapshot']['weeks'][0] === $service_result['result']['week'], 'service success carries the exact selected Week' );
v1_8010e_e2_expect( $mission === $service_result['result']['mission'], 'service success carries Mission derived from that same Week and today' );
$compact_result = $fake_result;
unset( $compact_result['mission'] );
$rejected_success = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Fake_Repository( $compact_result ) ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( false === $rejected_success['ok'] && 'dependency_unavailable' === $rejected_success['reason_code'], 'service rejects a success that omits same-revision Mission' );
$failure = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Failing_Repository() ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( false === $failure['ok'] && 'stale_revision' === $failure['reason_code'] && 409 === $failure['status'], 'service returns a content-free allowlisted conflict' );
$gap = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Gap_Repository() ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( false === $gap['ok'] && 'dst_gap' === $gap['reason_code'] && array( 'suggested_slot' => array( 'fold_required' => false, 'local_date' => '2026-07-15', 'local_time' => '06:00' ) ) === $gap['result'], 'DST gap returns only the complete safe suggestion allowlist' );
$malformed_gap = ( new MMED_V1_Study_Command_Service( new V1_8010E_E2_Gap_Repository( true ) ) )->execute( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_e2_expect( false === $malformed_gap['ok'] && 'dependency_unavailable' === $malformed_gap['reason_code'] && null === $malformed_gap['result'], 'malformed DST context is downgraded and never leaks' );

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
foreach ( array( 'add_action', 'add_filter', 'register_rest_route', 'get_option', 'add_option', 'update_option', 'delete_option', 'set_transient' ) as $forbidden_call ) {
	v1_8010e_e2_expect( false === stripos( $source, $forbidden_call . '(' ), 'E2 writer remains isolated: ' . $forbidden_call );
}
foreach ( array( 'wp_remote_', 'curl_', 'INSERT IGNORE', 'DELETE FROM' ) as $forbidden_fragment ) {
	v1_8010e_e2_expect( false === stripos( $source, $forbidden_fragment ), 'E2 writer remains isolated: ' . $forbidden_fragment );
}
v1_8010e_e2_expect( false === stripos( $source, 'mmed_study_schedule' ), 'E2 contains no legacy Calendar table SQL' );
v1_8010e_e2_expect( false === strpos( $source, '$this->database->query' ), 'transactional E2 SQL never uses reconnecting wpdb mutation' );
v1_8010e_e2_expect( false !== strpos( $source, 'pinned_native_handle' ) && false !== strpos( $source, 'mysqli_thread_id' ), 'E2 pins one native database session and rejects reconnects' );
v1_8010e_e2_expect( false !== strpos( $source, 'remove_placeholder_escape' ), 'E2 removes the wpdb placeholder token before native SQL execution' );
v1_8010e_e2_expect( false !== strpos( $source, 'READ COMMITTED' ) && false !== strpos( $source, 'READ-COMMITTED' ), 'E2 pins and verifies READ COMMITTED' );
v1_8010e_e2_expect( false !== strpos( $source, '@@SESSION.timestamp AS session_epoch' ) && false !== strpos( $source, 'UNIX_TIMESTAMP(SYSDATE(6))' ), 'E2 bounds the mutable session clock against server and process time' );
v1_8010e_e2_expect( false !== strpos( $source, 'SET NAMES utf8mb4 COLLATE utf8mb4_bin' ) && false !== strpos( $source, '@@SESSION.character_set_client' ), 'E2 pins and verifies the complete utf8mb4 connection tuple' );
v1_8010e_e2_expect( false !== strpos( $source, 'trusted_plan_state' ), 'E2 contains stored projection failures as dependency errors' );
v1_8010e_e2_expect( false !== strpos( $source, "\$result['today'] !== \$this->learner_local_date" ), 'E2 binds receipt today to trusted committed_at and learner timezone' );
v1_8010e_e2_expect( false !== strpos( $source, 'assert_receipt_chain_summary' ) && false !== strpos( $source, 'assert_receipt_chain_rows' ) && false !== strpos( $source, 'JSON_VALID(request_json)' ), 'E2 proves every append-only receipt is contiguous, hash-intact, and semantically valid' );
v1_8010e_e2_expect( false !== strpos( $source, 'MAX_RECEIPTS_PER_PLAN = 4096' ) && false !== strpos( $source, 'assert_receipt_transition' ), 'E2 bounds sequential replay cost pending an E3 checkpoint design' );
v1_8010e_e2_expect( false !== strpos( $source, "array( 'action', 'block_id', 'mission', 'operation_id', 'plan_hash', 'revision', 'today', 'week' )" ), 'E2 accepts only the exact Week plus Mission response' );
v1_8010e_e2_expect( false !== strpos( $source, 'store_generation IN (1, 2)' ), 'first command accepts the inherited exact generation-1 revision-0 fence and upgrades atomically' );
$plugin = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php' );
v1_8010e_e2_expect( is_string( $plugin ) && false === strpos( $plugin, 'class-mmed-v1-study-command-service.php' ), 'E2 has no plugin runtime include' );
v1_8010e_e2_expect( false === strpos( $plugin, 'class-mmed-v1-study-innodb-command-repository.php' ), 'E2 physical writer has no runtime binding' );

$worker_source = file_get_contents( $root . '/tests/php/v1-study-schedule-8010e-e2-worker.php' );
$process_source = file_get_contents( $root . '/tests/php/v1-study-schedule-8010e-e2-process.php' );
v1_8010e_e2_expect( is_string( $worker_source ) && is_string( $process_source ), 'E2 independent-process proof sources are readable' );
foreach ( array( 'control_before_plan', 'after_plan_publish', 'after_week_write', 'after_block_write', 'after_receipt_write', 'before_commit', 'after_commit', 'READY response_lost', 'KILL CONNECTION', 'INNODB_TRX', 'LOCK_WAIT', 'linkage_valid', 'native_handle_preserved' ) as $proof_token ) {
	v1_8010e_e2_expect( false !== strpos( $worker_source . $process_source, $proof_token ), 'E2 process proof includes exact boundary: ' . $proof_token );
}
$same_key_wait = strpos( $process_source, 'v1_8010e_e2_process_wait_for_owner_lock( (int) $second_match[1], (int) $first_match[1] );' );
$same_key_release = strpos( $process_source, "v1_8010e_e2_process_result( \$first, true, 'first same-key writer commits' );" );
v1_8010e_e2_expect( false !== $same_key_wait && false !== $same_key_release && $same_key_wait < $same_key_release, 'E2 process proof observes owner serialization before releasing the first writer' );
v1_8010e_e2_expect( false !== strpos( $process_source, 'response-loss retry returns the exact durable result bytes' ), 'E2 process proof binds post-commit response loss to an exact replay hash' );
v1_8010e_e2_expect( false !== strpos( $process_source, 'e2_worker_finish_timeout' ), 'E2 process controller has a hard completion watchdog' );

echo "V1 Study Schedule 8010E E2 pure command contract: ok\n";
