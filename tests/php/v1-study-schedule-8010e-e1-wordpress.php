<?php
/** Disposable generation-2 migration/current-reader proof for 8010E E1. */

if ( ! defined( 'ABSPATH' ) || ! isset( $GLOBALS['wpdb'] ) || ! function_exists( 'v1_8010e_wp_expect' ) ) {
	throw new RuntimeException( 'This E1 fixture must run after the disposable E0 fixture.' );
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1 repository root is unavailable.' );
}

require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';

function v1_8010e_e1_expect_failure( $callback, $expected, $message ) {
	$actual = null;
	try {
		call_user_func( $callback );
	} catch ( RuntimeException $error ) {
		$actual = $error->getMessage();
	}
	v1_8010e_wp_expect( $expected === $actual, $message . '; expected=' . $expected . ' actual=' . (string) $actual );
}

function v1_8010e_e1_commission_parent( $database, $prefix, $counter ) {
	$database->set_prefix( $prefix );
	$store  = v1_8010e_wp_uuid( 2000 + $counter * 10 );
	$runner = v1_8010e_wp_uuid( 2001 + $counter * 10 );
	$result = ( new MMED_V1_Study_Migrator( $database ) )->run( $store, $runner );
	v1_8010e_wp_expect( ! empty( $result['ok'] ) && 1 === (int) $result['generation'], 'generation-1 parent commissions: ' . $prefix );
	return array( $store, $runner );
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e1_' );

$store  = '8010e100-0000-4000-8000-000000000001';
$runner = '8010e100-0000-4000-8000-000000000002';
$runner_2 = '8010e100-0000-4000-8000-000000000003';
( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store, $runner );
$result = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $store, $runner_2 );
v1_8010e_wp_expect( ! empty( $result['ok'] ) && 2 === (int) $result['generation'], 'clean generation-1 store advances to generation 2' );
v1_8010e_wp_expect( MMED_V1_Study_Week_Schema::manifest_hash_hex( $wpdb ) === $result['manifest_hash'], 'generation-2 result binds the exact Week manifest' );

$kernel = MMED_V1_Study_Schema::table_names( $wpdb );
$week_tables = MMED_V1_Study_Week_Schema::table_names( $wpdb );
v1_8010e_wp_expect( 7 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['migrations']}` WHERE state = 'applied'" ), 'combined ledger contains seven applied migrations' );
v1_8010e_wp_expect( 2 === (int) $wpdb->get_var( "SELECT current_generation FROM `{$kernel['store_gate']}` WHERE gate_key = 1 AND gate_state = 'ready'" ), 'store gate atomically names ready generation 2' );
v1_8010e_wp_expect( 2 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$kernel['generations']}`" ), 'generation registry contains immutable generations 1 and 2' );
v1_8010e_wp_expect( 7 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('" . implode( "','", array_merge( array_values( $kernel ), array_values( $week_tables ) ) ) . "')" ), 'all seven exact owned tables exist' );
$repeat = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $store, v1_8010e_wp_uuid( 2999 ) );
v1_8010e_wp_expect( ! empty( $repeat['ok'] ) && 2 === (int) $repeat['generation'], 'exact ready generation-2 rerun is idempotent' );

$repository = new MMED_V1_Study_InnoDB_Repository( $wpdb );
v1_8010e_wp_expect( MMED_V1_Study_Domain::BINDING_READY === $repository->binding_kind(), 'exact generation-2 repository binds ready' );
v1_8010e_wp_expect( array( '2' ) === $repository->compatible_reader_versions(), 'repository advertises only the implemented reader 2' );
v1_8010e_wp_expect( null === MMED_V1_Study_Week_Schema::PREVIOUS_READER_VERSION, 'generation 2 does not claim fictional reader 1' );
$provenance = $repository->store_provenance();
v1_8010e_wp_expect( 'commissioned' === $provenance['state'] && $store === $provenance['store_id'] && 2 === $provenance['generation'], 'repository proves physical store identity' );
$absent = $repository->load( 8011, '2' );
v1_8010e_wp_expect( empty( $absent['ok'] ) && 'no_truth' === $absent['reason_code'], 'missing learner Plan is positive no-truth, not Calendar fallback' );

$owner_id = 8011;
$plan_id = '8010e100-0000-4000-8000-000000000010';
$week_id = '8010e100-0000-4000-8000-000000000011';
$block_id = '8010e100-0000-4000-8000-000000000012';
$watermark_id = '8010e100-0000-4000-8000-000000000013';
$week_start = '2026-07-13';
$timezone = 'America/New_York';
$profile = 'profile-synthetic-v1';
$tzdb = 'tzdb-synthetic-v1';
$now = '2026-07-15 12:00:00.000000';
$envelope = MMED_V1_Study_Week_Domain::temporal_envelope( $week_start, $timezone, $profile, $tzdb );
$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '10:00', 30, null, $envelope );
$week_dto = array(
	'owner_id' => (string) $owner_id,
	'plan_id' => $plan_id,
	'week_id' => $week_id,
	'week_start_local' => $week_start,
	'plan_revision' => '1',
	'week_created_revision' => '1',
	'week_updated_revision' => '1',
	'timezone' => $timezone,
	'profile_version' => $profile,
	'tzdb_version' => $tzdb,
	'temporal_policy_version' => MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION,
	'temporal_context_hash_hex' => $envelope['context'],
);
$block_dto = array(
	'owner_id' => (string) $owner_id,
	'plan_id' => $plan_id,
	'week_id' => $week_id,
	'week_start_local' => $week_start,
	'block_id' => $block_id,
	'title' => 'Retrieval practice',
	'activity_type' => 'flashcards',
	'activity_catalog_version' => MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION,
	'storage_codebook_version' => MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION,
	'family_code' => (string) MMED_V1_Study_Week_Domain::FAMILY_CODE_PRACTICE,
	'state_code' => (string) MMED_V1_Study_Week_Domain::STATE_CODE_FLEXIBLE,
	'priority_code' => (string) MMED_V1_Study_Week_Domain::PRIORITY_CODE_NORMAL,
	'goal_ref_hash_hex' => null,
	'goal_source_version' => null,
	'source_code' => (string) MMED_V1_Study_Week_Domain::SOURCE_CODE_MANUAL,
	'source_namespace_hash_hex' => null,
	'source_ref_hash_hex' => null,
	'source_version_hash_hex' => null,
	'start_at_utc' => $slot['start_at_utc'],
	'end_at_utc' => $slot['end_at_utc'],
	'timezone' => $timezone,
	'profile_version' => $profile,
	'tzdb_version' => $tzdb,
	'local_date' => '2026-07-15',
	'local_minute' => '600',
	'fold_code' => (string) MMED_V1_Study_Week_Domain::FOLD_CODE_NORMAL,
	'temporal_policy_version' => MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION,
	'temporal_context_hash_hex' => $envelope['context'],
	'duration_minutes' => '30',
	'created_revision' => '1',
	'updated_revision' => '1',
	'tombstoned_revision' => null,
);
$week_model = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( $owner_id, $week_dto, array( $block_dto ) );
$snapshot = array( 'plan_id' => $plan_id, 'revision' => '1', 'schema_version' => '2', 'weeks' => array( $week_model ) );
$plan_json = MMED_V1_Study_Week_Domain::canonical_json( $snapshot );
$plan_hash = hash( 'sha256', $plan_json );
$plan_sql = "INSERT INTO `{$kernel['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, UNHEX(%s), 2, %s, 1, UNHEX(%s), %s, %s, UNHEX(%s), %s, %s)";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $plan_sql, array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), '2', v1_8010e_wp_uuid_hex( $watermark_id ), $now, $plan_json, $plan_hash, $now, $now ) ) ), 'synthetic generation-2 Plan snapshot inserts' );
$week_sql = "INSERT INTO `{$week_tables['weeks']}` (owner_id, plan_id, week_id, week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version, temporal_context_hash, created_revision, updated_revision, created_at, updated_at) VALUES (%d, UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %s, UNHEX(%s), 1, 1, %s, %s)";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $week_sql, array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( $week_id ), $week_start, $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], $now, $now ) ) ), 'synthetic normalized Week inserts' );
$block_row = array(
	'owner_id' => $owner_id,
	'plan_id_hex' => v1_8010e_wp_uuid_hex( $plan_id ),
	'week_id_hex' => v1_8010e_wp_uuid_hex( $week_id ),
	'block_id_hex' => v1_8010e_wp_uuid_hex( $block_id ),
	'title' => 'Retrieval practice',
	'activity_type' => 'flashcards',
	'activity_catalog_version' => MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION,
	'storage_codebook_version' => MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION,
	'family_code' => MMED_V1_Study_Week_Domain::FAMILY_CODE_PRACTICE,
	'state_code' => MMED_V1_Study_Week_Domain::STATE_CODE_FLEXIBLE,
	'priority_code' => MMED_V1_Study_Week_Domain::PRIORITY_CODE_NORMAL,
	'goal_ref_hash_hex' => '',
	'goal_source_version' => '',
	'source_code' => MMED_V1_Study_Week_Domain::SOURCE_CODE_MANUAL,
	'source_namespace_hash_hex' => '',
	'source_ref_hash_hex' => '',
	'source_version_hash_hex' => '',
	'start_at_utc' => $slot['start_at_utc'],
	'end_at_utc' => $slot['end_at_utc'],
	'timezone' => $timezone,
	'profile_version' => $profile,
	'tzdb_version' => $tzdb,
	'local_date' => '2026-07-15',
	'local_minute' => 600,
	'fold_code' => MMED_V1_Study_Week_Domain::FOLD_CODE_NORMAL,
	'temporal_policy_version' => MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION,
	'temporal_context_hash_hex' => $envelope['context'],
	'duration_minutes' => 30,
	'created_revision' => 1,
	'updated_revision' => 1,
	'tombstoned_revision' => 0,
	'created_at' => $now,
	'updated_at' => $now,
	'tombstoned_at' => '',
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $block_row ) ), 'synthetic normalized Block inserts' );

$loaded = $repository->load( $owner_id, '2' );
$expected_snapshot_hash = hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $snapshot ) );
$actual_snapshot_hash = isset( $loaded['plan'] ) && is_array( $loaded['plan'] ) ? hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $loaded['plan'] ) ) : 'none';
$loaded_reason = isset( $loaded['reason_code'] ) ? (string) $loaded['reason_code'] : 'none';
v1_8010e_wp_expect(
	! empty( $loaded['ok'] ) && $snapshot === $loaded['plan'],
	'reader returns the exact canonical normalized snapshot; reason=' . $loaded_reason . ' expected_hash=' . $expected_snapshot_hash . ' actual_hash=' . $actual_snapshot_hash
);
v1_8010e_wp_expect( MMED_V1_Study_Domain::TRUTH_PRESENT === $repository->cutover_provenance( $owner_id )['state'], 'hash-verified Plan is positive cutover truth' );
v1_8010e_wp_expect( 'dependency_unavailable' === $repository->load( $owner_id, '1' )['reason_code'], 'unimplemented reader 1 fails closed' );

$bad_hash = str_repeat( '0', 64 );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$kernel['plans']}` SET plan_hash = UNHEX('{$bad_hash}') WHERE owner_id = {$owner_id}" ), 'fixture corrupts Plan hash' );
v1_8010e_wp_expect( 'plan_corrupt' === $repository->load( $owner_id, '2' )['reason_code'], 'hash corruption fails content-free' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$kernel['plans']}` SET plan_hash = UNHEX('{$plan_hash}') WHERE owner_id = {$owner_id}" ), 'fixture restores Plan hash' );

$noncanonical = ' ' . $plan_json;
$noncanonical_hash = hash( 'sha256', $noncanonical );
$corrupt_json_sql = "UPDATE `{$kernel['plans']}` SET plan_json = %s, plan_hash = UNHEX(%s) WHERE owner_id = %d";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $corrupt_json_sql, array( $noncanonical, $noncanonical_hash, $owner_id ) ) ), 'fixture stores hash-consistent noncanonical JSON' );
v1_8010e_wp_expect( 'plan_corrupt' === $repository->load( $owner_id, '2' )['reason_code'], 'noncanonical JSON fails even with a matching hash' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $corrupt_json_sql, array( $plan_json, $plan_hash, $owner_id ) ) ), 'fixture restores canonical JSON' );

v1_8010e_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$week_tables['blocks']}` SET title = 'Drifted normalized title' WHERE owner_id = {$owner_id}" ), 'fixture drifts normalized truth' );
v1_8010e_wp_expect( 'plan_corrupt' === $repository->load( $owner_id, '2' )['reason_code'], 'normalized-row drift fails snapshot equivalence' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$week_tables['blocks']}` SET title = 'Retrieval practice' WHERE owner_id = {$owner_id}" ), 'fixture restores normalized title' );

$alternate = MMED_V1_Study_Week_Domain::temporal_envelope( $week_start, 'America/Chicago', 'profile-alternate-v1', $tzdb );
$alternate_slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '10:00', 30, null, $alternate );
$alternate_sql = "UPDATE `{$week_tables['blocks']}` SET timezone = %s, profile_version = %s, temporal_context_hash = UNHEX(%s), start_at_utc = %s, end_at_utc = %s WHERE owner_id = %d";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $alternate_sql, array( 'America/Chicago', 'profile-alternate-v1', $alternate['context'], $alternate_slot['start_at_utc'], $alternate_slot['end_at_utc'], $owner_id ) ) ), 'fixture stores a self-valid alternate Block temporal envelope' );
v1_8010e_wp_expect( 'plan_corrupt' === $repository->load( $owner_id, '2' )['reason_code'], 'reader rejects a Block envelope that differs from its Week envelope' );
$restore_temporal_sql = "UPDATE `{$week_tables['blocks']}` SET timezone = %s, profile_version = %s, temporal_context_hash = UNHEX(%s), start_at_utc = %s, end_at_utc = %s WHERE owner_id = %d";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $restore_temporal_sql, array( $timezone, $profile, $envelope['context'], $slot['start_at_utc'], $slot['end_at_utc'], $owner_id ) ) ), 'fixture restores Week-bound temporal envelope' );
v1_8010e_wp_expect( ! empty( $repository->load( $owner_id, '2' )['ok'] ), 'restored normalized snapshot reads successfully' );

list( $unowned_store ) = v1_8010e_e1_commission_parent( $wpdb, 'v1e1unowned_', 1 );
$unowned_migration = MMED_V1_Study_Week_Schema::migrations( $wpdb )[0];
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $unowned_migration['sql'] ), 'fixture creates an exact but unledgered Week table' );
v1_8010e_e1_expect_failure(
	function () use ( $wpdb, $unowned_store ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $unowned_store, v1_8010e_wp_uuid( 2109 ) );
	},
	'v1_week_ready_one_state_mismatch',
	'exact direct-DDL Week table is never silently adopted'
);

list( $truth_store ) = v1_8010e_e1_commission_parent( $wpdb, 'v1e1truth_', 2 );
$truth_tables = MMED_V1_Study_Schema::table_names( $wpdb );
$truth_json = '{}';
$truth_now = '2026-07-15 13:00:00.000000';
$truth_plan_sql = "INSERT INTO `{$truth_tables['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (9001, UNHEX(%s), 1, '1', 1, UNHEX(%s), %s, %s, UNHEX(%s), %s, %s)";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_prepare( $wpdb, $truth_plan_sql, array( v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 2201 ) ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 2202 ) ), $truth_now, $truth_json, hash( 'sha256', $truth_json ), $truth_now, $truth_now ) ) ), 'fixture creates initialized generation-1 truth' );
v1_8010e_e1_expect_failure(
	function () use ( $wpdb, $truth_store ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $truth_store, v1_8010e_wp_uuid( 2209 ) );
	},
	'v1_week_existing_truth_upgrade_unsupported',
	'initialized generation-1 truth cannot be stranded without a proved transformer'
);

list( $checksum_store ) = v1_8010e_e1_commission_parent( $wpdb, 'v1e1checksum_', 3 );
$checksum_tables = MMED_V1_Study_Schema::table_names( $wpdb );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "UPDATE `{$checksum_tables['migrations']}` SET checksum = UNHEX('" . str_repeat( '0', 64 ) . "') WHERE migration_version = 5" ), 'fixture corrupts immutable parent checksum' );
v1_8010e_e1_expect_failure(
	function () use ( $wpdb, $checksum_store ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $checksum_store, v1_8010e_wp_uuid( 2309 ) );
	},
	'v1_migration_ledger_mismatch',
	'parent checksum drift fails closed'
);

list( $unknown_store ) = v1_8010e_e1_commission_parent( $wpdb, 'v1e1unknown_', 4 );
$unknown_table = $wpdb->prefix . 'mmed_v1_study_intruder';
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "CREATE TABLE `{$unknown_table}` (id int unsigned NOT NULL PRIMARY KEY) ENGINE=InnoDB" ), 'fixture creates unexpected owned-namespace table' );
v1_8010e_e1_expect_failure(
	function () use ( $wpdb, $unknown_store ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $unknown_store, v1_8010e_wp_uuid( 2409 ) );
	},
	'v1_week_unknown_owned_table',
	'unexpected owned-namespace table fails closed'
);

list( $shadow_store ) = v1_8010e_e1_commission_parent( $wpdb, 'v1e1shadow_', 5 );
$shadow_table = MMED_V1_Study_Week_Schema::table_names( $wpdb )['weeks'];
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "CREATE TEMPORARY TABLE `{$shadow_table}` (id int unsigned NOT NULL) ENGINE=InnoDB" ), 'fixture creates same-session Week TEMPORARY shadow' );
v1_8010e_e1_expect_failure(
	function () use ( $wpdb, $shadow_store ) {
		( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $shadow_store, v1_8010e_wp_uuid( 2509 ) );
	},
	'v1_migration_temporary_shadow_detected',
	'Week TEMPORARY shadow fails before DDL'
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( "DROP TEMPORARY TABLE `{$shadow_table}`" ), 'fixture removes Week TEMPORARY shadow' );

if ( '1' === getenv( 'V1_E1_EXTENDED' ) ) {
	$failpoints = array( 'after_week_gate_migrating_update', 'after_week_gate_migrating_commit' );
	foreach ( array( 6, 7 ) as $version ) {
		foreach ( array( 'before_migration_%d_record', 'after_migration_%d_record', 'before_migration_%d_ddl', 'after_migration_%d_ddl', 'after_migration_%d_verify', 'after_migration_%d_applied' ) as $pattern ) {
			$failpoints[] = sprintf( $pattern, $version );
		}
	}
	$failpoints = array_merge( $failpoints, array( 'before_generation_2_activation', 'after_generation_2_insert', 'after_generation_2_gate_update', 'after_generation_2_commit' ) );
	foreach ( $failpoints as $index => $failpoint ) {
		$prefix = sprintf( 'v1e1f%02d_', $index + 1 );
		list( $fail_store ) = v1_8010e_e1_commission_parent( $wpdb, $prefix, 100 + $index );
		$fired = false;
		$probe = function ( $name ) use ( $failpoint, &$fired ) {
			if ( ! $fired && $name === $failpoint ) {
				$fired = true;
				throw new RuntimeException( 'synthetic_e1_failpoint' );
			}
		};
		v1_8010e_e1_expect_failure(
			function () use ( $wpdb, $fail_store, $probe, $index ) {
				( new MMED_V1_Study_Migrator( $wpdb, $probe ) )->run_week_generation( $fail_store, v1_8010e_wp_uuid( 5000 + $index ) );
			},
			'synthetic_e1_failpoint',
			'exception failpoint interrupts exact E1 boundary: ' . $failpoint
		);
		v1_8010e_wp_expect( $fired, 'requested E1 failpoint is reached: ' . $failpoint );
		$recovered = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $fail_store, v1_8010e_wp_uuid( 6000 + $index ) );
		v1_8010e_wp_expect( ! empty( $recovered['ok'] ) && 2 === (int) $recovered['generation'], 'restart reconciles E1 boundary: ' . $failpoint );
	}
}

$wpdb->set_prefix( $original_prefix );
echo "V1 Study Schedule 8010E E1 migration/current reader: ok\n";
