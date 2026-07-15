<?php
/** Disposable WordPress/InnoDB proof for the unbound E3 owner arbiter. */

if ( ! defined( 'ABSPATH' ) || ! isset( $GLOBALS['wpdb'] ) || ! function_exists( 'v1_8010e_wp_expect' ) ) {
	throw new RuntimeException( 'This E3 fixture must run after the disposable E0-E2 fixtures.' );
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1 repository root is unavailable.' );
}

require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-owner-arbiter.php';

/** Build one exact synthetic control record pair. */
function v1_8010e_e3_arbiter_controls( $store_id, $active ) {
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
		'current_reader_version'  => MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION,
		'previous_reader_version' => null,
		'effective_at'            => '2026-07-15T12:00:00Z',
		'reason'                  => $active ? 'synthetic_e3_active' : 'synthetic_e3_legacy',
	);
	if ( $active ) {
		$release['policy_version'] = 'synthetic-e3-policy-v1';
	}
	return array( $store, $release );
}

/** Replace only the two disposable raw option records. */
function v1_8010e_e3_arbiter_set_controls( $database, $store_id, $active ) {
	list( $store, $release ) = v1_8010e_e3_arbiter_controls( $store_id, $active );
	$table = $database->prefix . 'options';
	foreach (
		array(
			MMED_V1_Study_Release::STORE_OPTION   => $store,
			MMED_V1_Study_Release::RELEASE_OPTION => $release,
		) as $name => $record
	) {
		$sql = $database->prepare(
			"INSERT INTO `{$table}` (option_name, option_value, autoload) VALUES (%s, %s, %s) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value), autoload = VALUES(autoload)",
			$name,
			maybe_serialize( $record ),
			'no'
		);
		v1_8010e_wp_expect( false !== $database->query( $sql ), 'disposable E3 raw control record is replaced: ' . $name );
	}
}

/** Compute the exact content-free locked-row fingerprint used by the arbiter. */
function v1_8010e_e3_arbiter_fingerprint( $database, $owner_id, $event_id ) {
	$table = $database->prefix . 'mmed_events';
	$null = '~';
	$sql  = 'SELECT LOWER(SHA2(CONCAT_WS(CHAR(31), CAST(id AS CHAR), CAST(user_id AS CHAR), HEX(event_type),';
	$sql .= ' HEX(title), COALESCE(HEX(description), %s), HEX(start_at), COALESCE(HEX(end_at), %s),';
	$sql .= ' COALESCE(CAST(all_day AS CHAR), %s), COALESCE(HEX(location), %s), COALESCE(HEX(meeting_url), %s),';
	$sql .= ' COALESCE(HEX(meeting_platform), %s), COALESCE(HEX(recurrence), %s), COALESCE(HEX(recurrence_end), %s),';
	$sql .= ' COALESCE(CAST(parent_event_id AS CHAR), %s), COALESCE(HEX(source), %s), COALESCE(HEX(source_id), %s),';
	$sql .= ' COALESCE(HEX(category), %s), COALESCE(CAST(priority AS CHAR), %s), HEX(status), COALESCE(HEX(meta_json), %s),';
	$sql .= ' COALESCE(HEX(created_at), %s), COALESCE(HEX(updated_at), %s)), 256))';
	$sql .= " FROM `{$table}` WHERE id = %d AND user_id = %d AND event_type = %s";
	$arguments = array_fill( 0, 16, $null );
	$arguments[] = $event_id;
	$arguments[] = $owner_id;
	$arguments[] = MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter::CALENDAR_TYPE;
	$value = $database->get_var( v1_8010e_wp_prepare( $database, $sql, $arguments ) );
	return is_string( $value ) ? $value : '';
}

global $wpdb;
$original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e3_' );
$wpdb->suppress_errors( true );

$options = $wpdb->prefix . 'options';
$calendar = $wpdb->prefix . 'mmed_events';
$options_sql = "CREATE TABLE `{$options}` (
	option_id bigint unsigned NOT NULL AUTO_INCREMENT,
	option_name varchar(191) NOT NULL DEFAULT '',
	option_value longtext NOT NULL,
	autoload varchar(20) NOT NULL DEFAULT 'yes',
	PRIMARY KEY (option_id),
	UNIQUE KEY uq_option_name (option_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";
$calendar_sql = "CREATE TABLE `{$calendar}` (
	id bigint unsigned NOT NULL AUTO_INCREMENT,
	user_id bigint unsigned NOT NULL,
	event_type varchar(30) NOT NULL DEFAULT 'general',
	title varchar(255) NOT NULL,
	description text NULL,
	start_at datetime NOT NULL,
	end_at datetime NULL,
	all_day tinyint(1) DEFAULT 0,
	location varchar(255) NULL,
	meeting_url varchar(500) NULL,
	meeting_platform varchar(30) NULL,
	recurrence varchar(100) NULL,
	recurrence_end date NULL,
	parent_event_id bigint unsigned NULL,
	source varchar(30) DEFAULT 'manual',
	source_id varchar(100) NULL,
	category varchar(50) NULL,
	priority tinyint DEFAULT 0,
	status varchar(20) DEFAULT 'active',
	meta_json JSON NULL,
	created_at datetime DEFAULT CURRENT_TIMESTAMP,
	updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_user_date (user_id, start_at),
	KEY idx_type (event_type),
	KEY idx_source (source, source_id),
	KEY idx_v1_owner_type_id (user_id, event_type, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $options_sql ), 'disposable E3 options table is created' );
v1_8010e_wp_expect( 1 === (int) $wpdb->query( $calendar_sql ), 'disposable E3 Calendar table is created with the governed owner index' );

$store_id = '8010e300-0000-4000-8000-000000000001';
$runner_1 = '8010e300-0000-4000-8000-000000000002';
$runner_2 = '8010e300-0000-4000-8000-000000000003';
$parent = ( new MMED_V1_Study_Migrator( $wpdb ) )->run( $store_id, $runner_1 );
$week = ( new MMED_V1_Study_Migrator( $wpdb ) )->run_week_generation( $store_id, $runner_2 );
v1_8010e_wp_expect( ! empty( $parent['ok'] ) && ! empty( $week['ok'] ) && 2 === (int) $week['generation'], 'disposable E3 generation-2 store commissions' );

$legacy_owner = 9301;
v1_8010e_e3_arbiter_set_controls( $wpdb, $store_id, false );
$legacy = ( new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ) )->run_legacy_study_mutation(
	$legacy_owner,
	$legacy_owner,
	'learner',
	array(
		'action'   => 'create',
		'end_at'   => '2026-07-15 14:30:00',
		'start_at' => '2026-07-15 14:00:00',
		'status'   => 'active',
		'title'    => 'Synthetic legacy owner-arbiter row',
	)
);
v1_8010e_wp_expect( ! empty( $legacy['ok'] ) && is_int( $legacy['event_id'] ), 'legacy intent commits under the permanent owner mutex' );
$legacy_event = $legacy['event_id'];
$fingerprint = v1_8010e_e3_arbiter_fingerprint( $wpdb, $legacy_owner, $legacy_event );
v1_8010e_wp_expect( 64 === strlen( $fingerprint ), 'fixture independently observes the locked row fingerprint' );
$updated = ( new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ) )->run_legacy_study_mutation(
	$legacy_owner,
	$legacy_owner,
	'learner',
	array(
		'action'               => 'update',
		'end_at'               => '2026-07-15 15:00:00',
		'event_id'             => $legacy_event,
		'expected_fingerprint' => $fingerprint,
		'start_at'             => '2026-07-15 14:15:00',
		'status'               => 'completed',
		'title'                => 'Synthetic legacy row updated',
	)
);
v1_8010e_wp_expect( ! empty( $updated['ok'] ) && $legacy_event === $updated['event_id'], 'exact fingerprint update commits once' );
$updated_fingerprint = v1_8010e_e3_arbiter_fingerprint( $wpdb, $legacy_owner, $legacy_event );
$deleted = ( new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ) )->run_legacy_study_mutation(
	$legacy_owner,
	$legacy_owner,
	'learner',
	array(
		'action'               => 'delete',
		'event_id'             => $legacy_event,
		'expected_fingerprint' => $updated_fingerprint,
	)
);
v1_8010e_wp_expect( ! empty( $deleted['ok'] ) && 'cancelled' === $wpdb->get_var( $wpdb->prepare( "SELECT status FROM `{$calendar}` WHERE id = %d", $legacy_event ) ), 'exact fingerprint delete is a bounded soft delete' );

v1_8010e_e3_arbiter_set_controls( $wpdb, $store_id, true );
$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-synthetic-e3', 'tzdb-synthetic-e3' );
$blocked_body = v1_8010e_e2_physical_create( '8010E-e3-existing-legacy-01', '0', $temporal, 'Must not replace legacy', '10:00', 30 );
$blocked = ( new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository(
		$wpdb,
		new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ),
		new V1_8010E_E2_UUID_Source( 41000 )
	)
) )->execute( $blocked_body, $legacy_owner, $legacy_owner, 'learner', $temporal );
v1_8010e_wp_expect( empty( $blocked['ok'] ) && 'dependency_unavailable' === $blocked['reason_code'] && 503 === $blocked['status'], 'V1 refuses a non-empty locked Calendar snapshot without an importer' );
$kernel = MMED_V1_Study_Schema::table_names( $wpdb );
v1_8010e_wp_expect( '0' === (string) $wpdb->get_var( $wpdb->prepare( "SELECT current_revision FROM `{$kernel['plans']}` WHERE owner_id = %d", $legacy_owner ) ), 'rejected conversion writes no watermark or V1 revision' );

$v1_owner = 9302;
$v1_body = v1_8010e_e2_physical_create( '8010E-e3-fresh-v1-owner-01', '0', $temporal, 'Fresh V1 owner', '11:00', 30 );
$v1_result = ( new MMED_V1_Study_Command_Service(
	new MMED_V1_Study_InnoDB_Command_Repository(
		$wpdb,
		new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ),
		new V1_8010E_E2_UUID_Source( 42000 )
	)
) )->execute( $v1_body, $v1_owner, $v1_owner, 'learner', $temporal );
v1_8010e_wp_expect( ! empty( $v1_result['ok'] ) && '1' === $v1_result['result']['revision'], 'empty owner V1 transaction commits revision 1 and watermark through typed E3 locks' );
$legacy_after_watermark = ( new MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter( $wpdb ) )->run_legacy_study_mutation(
	$v1_owner,
	$v1_owner,
	'learner',
	array(
		'action'   => 'create',
		'end_at'   => '2026-07-15 16:30:00',
		'start_at' => '2026-07-15 16:00:00',
		'status'   => 'active',
		'title'    => 'Must remain denied',
	)
);
v1_8010e_wp_expect( empty( $legacy_after_watermark['ok'] ) && 'legacy_write_disabled' === $legacy_after_watermark['reason_code'], 'active control and sticky watermark deny every legacy retry' );
v1_8010e_wp_expect( 0 === (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM `{$calendar}` WHERE user_id = %d", $v1_owner ) ), 'denied legacy retry performs zero Calendar DML' );

$wpdb->set_prefix( $original_prefix );
echo "V1 Study Schedule 8010E E3 owner-arbiter physical contract: ok\n";
