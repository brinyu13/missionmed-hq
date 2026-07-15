<?php
/**
 * Disposable WordPress/InnoDB proof for the 8010E Week physical contract.
 *
 * This fixture applies only the exact additive E0 DDL after commissioning the
 * accepted 8010D parent kernel. It intentionally does not claim ledgered E1
 * migration semantics, runtime wiring, production data, or deployment safety.
 */

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
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema-inspector.php';

function v1_8010e_wp_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

/** Prepare a query without relying on the variadic-call syntax added after PHP 7.4. */
function v1_8010e_wp_prepare( $database, $sql, $arguments ) {
	$prepared = call_user_func_array( array( $database, 'prepare' ), array_merge( array( $sql ), $arguments ) );
	if ( ! is_string( $prepared ) || '' === $prepared ) {
		throw new RuntimeException( 'Synthetic SQL preparation failed.' );
	}
	return $prepared;
}

/** Require one exact engine rejection and error number. */
function v1_8010e_wp_expect_sql_error( $database, $sql, $expected_errno, $message ) {
	$result = $database->query( $sql );
	$actual = isset( $database->dbh->errno ) ? (int) $database->dbh->errno : 0;
	if ( false !== $result || $expected_errno !== $actual ) {
		throw new RuntimeException( $message . '; expected_errno=' . $expected_errno . ' actual_errno=' . $actual );
	}
}

function v1_8010e_wp_uuid( $counter ) {
	return sprintf( '00000000-0000-4000-8000-%012d', $counter );
}

function v1_8010e_wp_uuid_hex( $uuid ) {
	return bin2hex( MMED_V1_Study_Schema::uuid_to_binary( $uuid ) );
}

/** Render one exact synthetic Block insert. */
function v1_8010e_wp_block_sql( $database, $table, $row ) {
	$keys = array(
		'owner_id', 'plan_id_hex', 'week_id_hex', 'block_id_hex', 'title', 'activity_type',
		'activity_catalog_version', 'storage_codebook_version', 'family_code', 'state_code',
		'priority_code', 'goal_ref_hash_hex', 'goal_source_version', 'source_code',
		'source_namespace_hash_hex', 'source_ref_hash_hex', 'source_version_hash_hex',
		'start_at_utc', 'end_at_utc', 'timezone', 'profile_version', 'tzdb_version',
		'local_date', 'local_minute', 'fold_code', 'temporal_policy_version',
		'temporal_context_hash_hex', 'duration_minutes', 'created_revision', 'updated_revision',
		'tombstoned_revision', 'created_at', 'updated_at', 'tombstoned_at',
	);
	if ( ! is_array( $row ) || $keys !== array_keys( $row ) ) {
		throw new RuntimeException( 'Synthetic Block row shape is not exact.' );
	}

	$sql  = "INSERT INTO `{$table}`";
	$sql .= ' (owner_id, plan_id, week_id, block_id, title, activity_type, activity_catalog_version, storage_codebook_version, family_code, state_code, priority_code, goal_ref_hash, goal_source_version, source_code, source_namespace_hash, source_ref_hash, source_version_hash, start_at_utc, end_at_utc, timezone, profile_version, tzdb_version, local_date, local_minute, fold_code, temporal_policy_version, temporal_context_hash, duration_minutes, created_revision, updated_revision, tombstoned_revision, created_at, updated_at, tombstoned_at)';
	$sql .= " VALUES (%d, UNHEX(%s), UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %d, %d, %d, UNHEX(NULLIF(%s, '')), NULLIF(%s, ''), %d, UNHEX(NULLIF(%s, '')), UNHEX(NULLIF(%s, '')), UNHEX(NULLIF(%s, '')), %s, %s, %s, %s, %s, %s, %d, %d, %s, UNHEX(%s), %d, %d, %d, NULLIF(%d, 0), %s, %s, NULLIF(%s, ''))";
	return v1_8010e_wp_prepare( $database, $sql, array_values( $row ) );
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e_' );
$wpdb->suppress_errors( true );

$server_version = (string) $wpdb->get_var( 'SELECT VERSION()' );
$is_mariadb     = false !== stripos( $server_version, 'mariadb' );
v1_8010e_wp_expect( 1 === preg_match( $is_mariadb ? '/^10\.11\./' : '/^8\.0\./', $server_version ), 'database is in the governed disposable engine family' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.autocommit' ), 'physical proof begins with autocommit enabled' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.foreign_key_checks' ), 'foreign-key enforcement is enabled' );
v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.unique_checks' ), 'unique-key enforcement is enabled' );
if ( $is_mariadb ) {
	v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.check_constraint_checks' ), 'MariaDB CHECK enforcement is enabled' );
}

$strict_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
v1_8010e_wp_expect( false !== $wpdb->query( $wpdb->prepare( 'SET SESSION sql_mode = %s', $strict_mode ) ), 'fixture pins strict SQL mode' );
v1_8010e_wp_expect( false !== $wpdb->query( "SET NAMES utf8mb4 COLLATE utf8mb4_bin" ), 'fixture pins the utf8mb4 connection' );
$observed_modes = array_map( 'trim', explode( ',', strtoupper( (string) $wpdb->get_var( 'SELECT @@SESSION.sql_mode' ) ) ) );
v1_8010e_wp_expect( in_array( 'STRICT_ALL_TABLES', $observed_modes, true ), 'strict SQL mode is active' );

$store_id = '8010e000-0000-4000-8000-000000000001';
$runner_id = '8010e000-0000-4000-8000-000000000002';
$parent_result = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_id );
v1_8010e_wp_expect( ! empty( $parent_result['ok'] ) && 'ready' === $parent_result['state'], 'accepted 8010D parent kernel commissions successfully' );
v1_8010e_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === ( new MMED_V1_Study_Schema_Inspector( $wpdb ) )->inspect()['state'], 'parent kernel is exact before E0 DDL' );

$week_inspector = new MMED_V1_Study_Week_Schema_Inspector( $wpdb );
v1_8010e_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_ABSENT === $week_inspector->inspect()['state'], 'isolated Week tables begin absent' );
$migrations = MMED_V1_Study_Week_Schema::migrations( $wpdb );
foreach ( $migrations as $index => $migration ) {
	v1_8010e_wp_expect( 1 === (int) $wpdb->query( $migration['sql'] ), 'exact additive E0 DDL applies: ' . $migration['id'] );
	$table_state = $week_inspector->inspect_table( $migration['table_key'] );
	v1_8010e_wp_expect( ! empty( $table_state['ok'] ), 'new additive table has its exact physical shape: ' . $migration['table_key'] . ' ' . implode( ',', $table_state['errors'] ) );
	if ( 0 === $index ) {
		v1_8010e_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_PARTIAL === $week_inspector->inspect()['state'], 'Week-only intermediate state is explicitly partial' );
	}
}
$physical = $week_inspector->inspect();
v1_8010e_wp_expect( ! empty( $physical['ok'] ) && MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === $physical['state'], 'exact Week information_schema inspection passes: ' . implode( ',', $physical['errors'] ) );

$parent_tables = MMED_V1_Study_Schema::table_names( $wpdb );
$week_tables   = MMED_V1_Study_Week_Schema::table_names( $wpdb );
$owner_id      = 8010;
$plan_id       = '8010e000-0000-4000-8000-000000000010';
$week_id       = '8010e000-0000-4000-8000-000000000011';
$operation_id  = '8010e000-0000-4000-8000-000000000012';
$plan_json     = '{"schema_version":"2","weeks":[]}';
$now           = '2026-07-15 12:00:00.000000';
$plan_sql      = "INSERT INTO `{$parent_tables['plans']}` (owner_id, plan_id, store_generation, schema_version, current_revision, watermark_operation_id, watermark_at, plan_json, plan_hash, created_at, updated_at) VALUES (%d, UNHEX(%s), 1, %s, 9, UNHEX(%s), %s, %s, UNHEX(%s), %s, %s)";
$plan_sql      = v1_8010e_wp_prepare(
	$wpdb,
	$plan_sql,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), '2', v1_8010e_wp_uuid_hex( $operation_id ), $now, $plan_json, hash( 'sha256', $plan_json ), $now, $now )
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $plan_sql ), 'synthetic revisioned parent Plan is valid' );

$week_start = '2026-07-13';
$timezone   = 'America/New_York';
$profile    = 'profile-synthetic-v1';
$tzdb       = 'tzdb-synthetic-v1';
$envelope   = MMED_V1_Study_Week_Domain::temporal_envelope( $week_start, $timezone, $profile, $tzdb );
$week_insert = "INSERT INTO `{$week_tables['weeks']}` (owner_id, plan_id, week_id, week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version, temporal_context_hash, created_revision, updated_revision, created_at, updated_at) VALUES (%d, UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %s, UNHEX(%s), %d, %d, %s, %s)";
$valid_week_sql = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( $week_id ), $week_start, $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 1, 9, $now, $now )
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $valid_week_sql ), 'valid Monday Week is accepted' );

$check_errno = $is_mariadb ? 4025 : 3819;
$fk_errno    = 1452;
$restrict_errno = 1451;
$unique_errno   = 1062;
$length_errno   = 1406;

$non_monday_sql = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 20 ) ), '2026-07-14', $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 1, 9, $now, $now )
);
v1_8010e_wp_expect_sql_error( $wpdb, $non_monday_sql, $check_errno, 'database rejects a non-Monday Week' );

$bad_week_revision = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 21 ) ), '2026-07-20', $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 9, 8, $now, $now )
);
v1_8010e_wp_expect_sql_error( $wpdb, $bad_week_revision, $check_errno, 'database rejects reversed Week revisions' );

$bad_week_provenance = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 22 ) ), '2026-07-20', '', $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 1, 9, $now, $now )
);
v1_8010e_wp_expect_sql_error( $wpdb, $bad_week_provenance, $check_errno, 'database rejects empty Week provenance' );

$wrong_owner_week = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id + 1, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 23 ) ), '2026-07-20', $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 1, 9, $now, $now )
);
v1_8010e_wp_expect_sql_error( $wpdb, $wrong_owner_week, $fk_errno, 'Week cannot cross owner/Plan identity' );

$duplicate_week_start = v1_8010e_wp_prepare(
	$wpdb,
	$week_insert,
	array( $owner_id, v1_8010e_wp_uuid_hex( $plan_id ), v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 24 ) ), $week_start, $timezone, $profile, $tzdb, MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION, $envelope['context'], 1, 9, $now, $now )
);
v1_8010e_wp_expect_sql_error( $wpdb, $duplicate_week_start, $unique_errno, 'one Plan cannot materialize two Week identities for one civil start' );

$base = array(
	'owner_id'                    => $owner_id,
	'plan_id_hex'                  => v1_8010e_wp_uuid_hex( $plan_id ),
	'week_id_hex'                  => v1_8010e_wp_uuid_hex( $week_id ),
	'block_id_hex'                 => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 100 ) ),
	'title'                        => str_repeat( "\xF0\x9F\xA7\xA0", 120 ),
	'activity_type'                => 'flashcards',
	'activity_catalog_version'     => MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION,
	'storage_codebook_version'     => MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION,
	'family_code'                  => MMED_V1_Study_Week_Domain::FAMILY_CODE_PRACTICE,
	'state_code'                   => MMED_V1_Study_Week_Domain::STATE_CODE_FLEXIBLE,
	'priority_code'                => MMED_V1_Study_Week_Domain::PRIORITY_CODE_NORMAL,
	'goal_ref_hash_hex'            => '',
	'goal_source_version'          => '',
	'source_code'                  => MMED_V1_Study_Week_Domain::SOURCE_CODE_MANUAL,
	'source_namespace_hash_hex'    => '',
	'source_ref_hash_hex'          => '',
	'source_version_hash_hex'      => '',
	'start_at_utc'                 => '',
	'end_at_utc'                   => '',
	'timezone'                     => $timezone,
	'profile_version'              => $profile,
	'tzdb_version'                 => $tzdb,
	'local_date'                   => '2026-07-15',
	'local_minute'                 => 540,
	'fold_code'                    => MMED_V1_Study_Week_Domain::FOLD_CODE_NORMAL,
	'temporal_policy_version'      => MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION,
	'temporal_context_hash_hex'    => $envelope['context'],
	'duration_minutes'             => 30,
	'created_revision'             => 1,
	'updated_revision'             => 9,
	'tombstoned_revision'          => 0,
	'created_at'                   => $now,
	'updated_at'                   => $now,
	'tombstoned_at'                => '',
);

$block_at = static function ( $counter, $local_time, $duration, $overrides = array() ) use ( $base, $envelope ) {
	$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', $local_time, $duration, null, $envelope );
	$parts = explode( ':', $local_time );
	$row = array_merge(
		$base,
		array(
			'block_id_hex'     => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( $counter ) ),
			'start_at_utc'     => $slot['start_at_utc'],
			'end_at_utc'       => $slot['end_at_utc'],
			'local_minute'     => ( (int) $parts[0] * 60 ) + (int) $parts[1],
			'duration_minutes' => $duration,
		),
		$overrides
	);
	return $row;
};

$manual = $block_at( 100, '09:00', 30 );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $manual ) ), 'valid 120-code-point manual Block is accepted' );
$stored_title = $wpdb->get_row( "SELECT CHAR_LENGTH(title) AS characters, OCTET_LENGTH(title) AS bytes FROM `{$week_tables['blocks']}` WHERE block_id = UNHEX('" . $manual['block_id_hex'] . "')", ARRAY_A );
v1_8010e_wp_expect( is_array( $stored_title ) && 120 === (int) $stored_title['characters'] && 480 === (int) $stored_title['bytes'], 'utf8mb4 title length is enforced in code points, not bytes' );

$adjacent = $block_at( 101, '09:30', 30, array( 'title' => 'Adjacent manual block' ) );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $adjacent ) ), 'adjacent half-open manual Block is accepted and nullable source uniqueness permits another manual row' );

$external_tuple = array(
	'source_namespace_hash_hex' => hash( 'sha256', 'synthetic-calendar' ),
	'source_ref_hash_hex'       => hash( 'sha256', 'synthetic-anchor-1' ),
	'source_version_hash_hex'   => hash( 'sha256', 'synthetic-version-1' ),
);
$external = $block_at(
	102,
	'11:00',
	60,
	array_merge(
		$external_tuple,
		array(
			'title'         => 'Synthetic fixed source anchor',
			'activity_type' => 'live_class',
			'family_code'   => MMED_V1_Study_Week_Domain::FAMILY_CODE_LEARN,
			'state_code'    => MMED_V1_Study_Week_Domain::STATE_CODE_FIXED,
			'source_code'   => MMED_V1_Study_Week_Domain::SOURCE_CODE_EXTERNAL,
		)
	)
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $external ) ), 'complete versioned external fixed anchor is accepted' );

$valid_tombstone = $block_at(
	103,
	'12:00',
	30,
	array(
		'title'                  => 'Valid synthetic tombstone',
		'state_code'             => MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE,
		'tombstoned_revision'    => 9,
		'tombstoned_at'          => $now,
	)
);
v1_8010e_wp_expect( 1 === (int) $wpdb->query( v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $valid_tombstone ) ), 'complete tombstone shape is accepted' );

$duplicate_external = $block_at(
	104,
	'12:30',
	60,
	array_merge(
		$external_tuple,
		array(
			'title'         => 'Duplicate fixed source anchor',
			'activity_type' => 'live_class',
			'family_code'   => MMED_V1_Study_Week_Domain::FAMILY_CODE_LEARN,
			'state_code'    => MMED_V1_Study_Week_Domain::STATE_CODE_FIXED,
			'source_code'   => MMED_V1_Study_Week_Domain::SOURCE_CODE_EXTERNAL,
		)
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $duplicate_external ), $unique_errno, 'duplicate versioned external anchor is rejected' );

$wrong_owner = $block_at( 105, '13:30', 30, array( 'owner_id' => $owner_id + 1, 'title' => 'Wrong owner' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $wrong_owner ), $fk_errno, 'Block cannot cross owner/Plan/Week identity' );

$manual_fixed = $block_at( 106, '13:30', 30, array( 'state_code' => MMED_V1_Study_Week_Domain::STATE_CODE_FIXED, 'title' => 'Manual fixed invalid' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $manual_fixed ), $check_errno, 'manual source cannot forge fixed state' );

$incomplete_external = $block_at(
	107,
	'13:30',
	30,
	array(
		'state_code'                 => MMED_V1_Study_Week_Domain::STATE_CODE_FIXED,
		'source_code'                => MMED_V1_Study_Week_Domain::SOURCE_CODE_EXTERNAL,
		'source_namespace_hash_hex'  => hash( 'sha256', 'incomplete-ns' ),
		'source_ref_hash_hex'        => hash( 'sha256', 'incomplete-ref' ),
		'source_version_hash_hex'    => '',
		'title'                      => 'Incomplete external tuple',
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $incomplete_external ), $check_errno, 'external source requires the complete source tuple' );

$empty_provenance = $block_at( 108, '13:30', 30, array( 'activity_catalog_version' => '', 'title' => 'Empty provenance' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $empty_provenance ), $check_errno, 'empty Block provenance is rejected' );

$empty_goal_version = $block_at( 109, '13:30', 30, array( 'goal_ref_hash_hex' => hash( 'sha256', 'goal' ), 'goal_source_version' => '', 'title' => 'Empty goal version' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $empty_goal_version ), $check_errno, 'goal hash cannot pair with an empty source version' );

$goal_version_without_hash = $block_at( 110, '13:30', 30, array( 'goal_source_version' => 'synthetic-goals-v1', 'title' => 'Goal version without hash' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $goal_version_without_hash ), $check_errno, 'goal source version cannot exist without its hash' );

$half_tombstone = $block_at( 111, '13:30', 30, array( 'state_code' => MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE, 'tombstoned_revision' => 0, 'tombstoned_at' => $now, 'title' => 'Half tombstone' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $half_tombstone ), $check_errno, 'SQL UNKNOWN cannot admit a tombstone with null revision and non-null time' );

$missing_tombstone = $block_at( 112, '13:30', 30, array( 'state_code' => MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE, 'title' => 'Missing tombstone metadata' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $missing_tombstone ), $check_errno, 'tombstone requires complete revision and time metadata' );

$tombstone_revision_without_time = $block_at( 113, '13:30', 30, array( 'state_code' => MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE, 'tombstoned_revision' => 9, 'title' => 'Tombstone revision without time' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $tombstone_revision_without_time ), $check_errno, 'tombstone revision cannot exist without tombstone time' );

$manual_with_source_hash = $block_at( 114, '13:30', 30, array( 'source_namespace_hash_hex' => hash( 'sha256', 'forged-manual-source' ), 'title' => 'Manual source hash invalid' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $manual_with_source_hash ), $check_errno, 'manual source cannot retain an external identity fragment' );

$external_flexible = $block_at(
	115,
	'13:30',
	30,
	array(
		'source_code'                => MMED_V1_Study_Week_Domain::SOURCE_CODE_EXTERNAL,
		'source_namespace_hash_hex'  => hash( 'sha256', 'flexible-external-ns' ),
		'source_ref_hash_hex'        => hash( 'sha256', 'flexible-external-ref' ),
		'source_version_hash_hex'    => hash( 'sha256', 'flexible-external-version' ),
		'title'                      => 'Flexible external invalid',
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $external_flexible ), $check_errno, 'external source cannot claim flexible learner ownership' );

$cross_midnight = array_merge(
	$base,
	array(
		'block_id_hex'     => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 116 ) ),
		'title'            => 'Cross midnight invalid',
		'start_at_utc'     => '2026-07-16 03:45:00.000000',
		'end_at_utc'       => '2026-07-16 04:15:00.000000',
		'local_minute'     => 1425,
		'duration_minutes' => 30,
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $cross_midnight ), $check_errno, 'Block cannot cross local midnight' );

$off_grid_duration = array_merge(
	$base,
	array(
		'block_id_hex'     => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 117 ) ),
		'title'            => 'Off-grid duration',
		'start_at_utc'     => '2026-07-15 14:00:00.000000',
		'end_at_utc'       => '2026-07-15 14:20:00.000000',
		'local_minute'     => 600,
		'duration_minutes' => 20,
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $off_grid_duration ), $check_errno, 'duration must use the 15-minute grid' );

$above_max_duration = array_merge(
	$base,
	array(
		'block_id_hex'     => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( 118 ) ),
		'title'            => 'Duration above maximum',
		'start_at_utc'     => '2026-07-15 10:00:00.000000',
		'end_at_utc'       => '2026-07-15 22:15:00.000000',
		'local_minute'     => 360,
		'duration_minutes' => 735,
	)
);
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $above_max_duration ), $check_errno, 'duration above the governed maximum is rejected' );

$off_grid_local = $block_at( 119, '14:00', 30, array( 'local_minute' => 841, 'title' => 'Off-grid local minute' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $off_grid_local ), $check_errno, 'local start minute must use the 15-minute grid' );

$interval_base = $block_at( 120, '14:00', 30, array( 'title' => 'Interval mismatch' ) );
$bad_ends = array(
	'2026-07-15 18:29:59.999999' => 'one microsecond short',
	'2026-07-15 18:30:00.000001' => 'one microsecond long',
	'2026-07-15 18:29:00.000000' => 'one minute short',
	'2026-07-15 18:31:00.000000' => 'one minute long',
);
$counter = 120;
foreach ( $bad_ends as $bad_end => $label ) {
	++$counter;
	$bad_interval = array_merge( $interval_base, array( 'block_id_hex' => v1_8010e_wp_uuid_hex( v1_8010e_wp_uuid( $counter ) ), 'end_at_utc' => $bad_end ) );
	v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $bad_interval ), $check_errno, 'exact UTC interval rejects ' . $label );
}

$non_forward = $block_at( 125, '14:00', 30, array( 'end_at_utc' => '2026-07-15 18:00:00.000000', 'title' => 'Non-forward interval' ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $non_forward ), $check_errno, 'UTC interval must move forward' );

$overlong = $block_at( 126, '15:00', 30, array( 'title' => str_repeat( "\xF0\x9F\xA7\xA0", 121 ) ) );
v1_8010e_wp_expect_sql_error( $wpdb, v1_8010e_wp_block_sql( $wpdb, $week_tables['blocks'], $overlong ), $length_errno, '121-code-point title is rejected under strict mode' );

$plan_delete = "DELETE FROM `{$parent_tables['plans']}` WHERE owner_id = {$owner_id}";
v1_8010e_wp_expect_sql_error( $wpdb, $plan_delete, $restrict_errno, 'Plan deletion is restricted while its Week exists' );
$week_delete = "DELETE FROM `{$week_tables['weeks']}` WHERE owner_id = {$owner_id} AND week_id = UNHEX('" . v1_8010e_wp_uuid_hex( $week_id ) . "')";
v1_8010e_wp_expect_sql_error( $wpdb, $week_delete, $restrict_errno, 'Week deletion is restricted while Blocks exist' );

v1_8010e_wp_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['weeks']}`" ), 'only the one valid Week persists' );
v1_8010e_wp_expect( 4 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$week_tables['blocks']}`" ), 'only the four valid Blocks persist' );
v1_8010e_wp_expect( MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === ( new MMED_V1_Study_Schema_Inspector( $wpdb ) )->inspect()['state'], 'parent kernel remains exact after physical probes' );
$final = $week_inspector->inspect();
v1_8010e_wp_expect( ! empty( $final['ok'] ) && MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === $final['state'], 'Week schema remains exact after physical probes: ' . implode( ',', $final['errors'] ) );

$wpdb->set_prefix( $original_prefix );
echo 'V1 Study Schedule 8010E physical Week contract: ok (' . ( $is_mariadb ? 'MariaDB 10.11' : 'MySQL 8.0' ) . ")\n";
