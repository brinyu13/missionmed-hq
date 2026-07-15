<?php
/** Pure PHP 7.4-compatible 8010E Week domain contract. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';

function v1_8010e_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010e_reason( $callback ) {
	try {
		$callback();
	} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
		return array( $error->reason_code(), $error->safe_context() );
	}
	throw new RuntimeException( 'Expected governed domain exception.' );
}

function v1_8010e_block( $overrides = array() ) {
	return array_merge(
		array(
			'activity_type'    => 'qbank',
			'block_id'         => '00000000-0000-4000-8000-000000000001',
			'duration_minutes' => 90,
			'family'           => 'practice',
			'fold'             => 'normal',
			'goal_linked'      => false,
			'local_date'       => '2026-07-15',
			'local_time'       => '09:00',
			'priority'         => 'normal',
			'state'            => 'planned_flexible',
			'title'            => 'UWorld cardiology',
		),
		$overrides
	);
}

function v1_8010e_week_row( $temporal, $revision = '7', $overrides = array() ) {
	return array_merge(
		array(
			'owner_id'                 => '42',
			'plan_id'                  => '10000000-0000-4000-8000-000000000001',
			'week_id'                  => '20000000-0000-4000-8000-000000000001',
			'week_start_local'         => $temporal['week_start'],
			'plan_revision'            => $revision,
			'week_created_revision'    => '1',
			'week_updated_revision'    => $revision,
			'timezone'                 => $temporal['timezone'],
			'profile_version'          => $temporal['profile_version'],
			'tzdb_version'             => $temporal['tzdb_version'],
			'temporal_policy_version'  => $temporal['temporal_policy_version'],
			'temporal_context_hash_hex'=> $temporal['context'],
		),
		$overrides
	);
}

function v1_8010e_storage_block_at( $local_date = '2026-07-15', $local_minute = 540, $duration = 90, $overrides = array() ) {
	$timezone = 'America/New_York';
	$profile_version = 'profile-42-v7';
	$tzdb_version = '2026a';
	$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', $timezone, $profile_version, $tzdb_version );
	$local_time = sprintf( '%02d:%02d', intdiv( $local_minute, 60 ), $local_minute % 60 );
	$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( $local_date, $local_time, $duration, null, $temporal );
	return array_merge(
		array(
			'owner_id'                  => '42',
			'plan_id'                   => '10000000-0000-4000-8000-000000000001',
			'week_id'                   => '20000000-0000-4000-8000-000000000001',
			'week_start_local'          => '2026-07-13',
			'block_id'                  => '00000000-0000-4000-8000-000000000001',
			'title'                     => 'UWorld cardiology',
			'activity_type'             => 'qbank',
			'activity_catalog_version'  => MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION,
			'storage_codebook_version'  => MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION,
			'family_code'               => '2',
			'state_code'                => '1',
			'priority_code'             => '0',
			'goal_ref_hash_hex'         => null,
			'goal_source_version'       => null,
			'source_code'               => '1',
			'source_namespace_hash_hex' => null,
			'source_ref_hash_hex'       => null,
			'source_version_hash_hex'   => null,
			'start_at_utc'              => $slot['start_at_utc'],
			'end_at_utc'                => $slot['end_at_utc'],
			'timezone'                  => $timezone,
			'profile_version'           => $profile_version,
			'tzdb_version'              => $tzdb_version,
			'local_date'                => $local_date,
			'local_minute'              => (string) $local_minute,
			'fold_code'                 => '0',
			'temporal_policy_version'   => MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION,
			'temporal_context_hash_hex' => $temporal['context'],
			'duration_minutes'          => (string) $duration,
			'created_revision'          => '1',
			'updated_revision'          => '7',
			'tombstoned_revision'       => null,
		),
		$overrides
	);
}

v1_8010e_expect( array( 'create_block', 'move_block', 'resize_block', 'delete_block' ) === MMED_V1_Study_Week_Domain::commands(), '8010E command vocabulary is exact and excludes execution' );
v1_8010e_expect( '3f044b3a7b0a215fa36135eb9b8baca09ead05fb0a472c41a9c5cf18209b5630' === MMED_V1_Study_Week_Domain::activity_catalog_fingerprint(), 'activity catalog fingerprint is immutable' );
v1_8010e_expect( '7f14be5a2cea325dc4d11b16ee6fb3cbfced45ff3c8df1df2d4aa5e62c653fa8' === MMED_V1_Study_Week_Domain::storage_codebook_fingerprint(), 'storage codebook fingerprint is immutable' );
foreach ( MMED_V1_Study_Week_Domain::storage_codebooks() as $enum_kind => $enum_map ) {
	foreach ( $enum_map as $enum_value => $enum_code ) {
		v1_8010e_expect( $enum_value === MMED_V1_Study_Week_Domain::enum_value( $enum_kind, MMED_V1_Study_Week_Domain::enum_code( $enum_kind, $enum_value ) ), 'database enum map round trip is exact' );
	}
}
foreach ( array( '1', 1.0, true, null ) as $invalid_code ) {
	v1_8010e_expect( 'enum_invalid' === v1_8010e_reason( static function () use ( $invalid_code ) { MMED_V1_Study_Week_Domain::enum_value( 'family', $invalid_code ); } )[0], 'storage decoder rejects coercible code types' );
}
v1_8010e_expect( 'enum_invalid' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::enum_code( 'unknown', 'learn' ); } )[0], 'unknown codebook kind fails closed' );
v1_8010e_expect( 'enum_invalid' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::enum_value( 'family', 99 ); } )[0], 'unknown storage code fails closed' );
v1_8010e_expect( '{"a":{"a":1,"b":2},"z":1}' === MMED_V1_Study_Week_Domain::canonical_json( array( 'z' => 1, 'a' => array( 'b' => 2, 'a' => 1 ) ) ), 'canonical JSON recursively sorts object keys' );
v1_8010e_expect( '[]' === MMED_V1_Study_Week_Domain::canonical_json( array() ), 'empty array has explicit list semantics' );
v1_8010e_expect( '{}' === MMED_V1_Study_Week_Domain::canonical_json( new MMED_V1_Study_Canonical_Object() ), 'empty object remains distinct from empty list' );
v1_8010e_expect( 'canonical_number_invalid' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::canonical_json( 1.0 ); } )[0], 'floats cannot vary across runtimes' );

$uuid = '12345678-1234-4abc-8def-1234567890ab';
v1_8010e_expect( $uuid === MMED_V1_Study_Week_Domain::binary_to_uuid( MMED_V1_Study_Week_Domain::uuid_to_binary( $uuid ) ), 'UUID v4 round trip is exact' );
v1_8010e_expect( 'uuid_invalid' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::uuid( '12345678-1234-1abc-8def-1234567890ab' ); } )[0], 'non-v4 UUID fails closed' );

$temporal = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-42-v7', '2026a' );
v1_8010e_expect( 1 === preg_match( '/^[a-f0-9]{64}$/', $temporal['context'] ), 'complete server temporal envelope has an integrity tag' );
$create_body = array(
	'idempotency_key'  => '8010E-create-0001',
	'expected_revision'=> '0',
	'command'          => 'create_block',
	'payload'          => array(
		'title'            => '  UWorld   cardiology  ',
		'activity_type'    => 'qbank',
		'priority'         => 'normal',
		'local_date'       => '2026-07-15',
		'local_time'       => '09:00',
		'duration_minutes' => 90,
		'fold'             => null,
		'temporal_context' => $temporal['context'],
	),
);
$create = MMED_V1_Study_Week_Domain::normalize_command( $create_body, 42, 42, 'learner', $temporal );
v1_8010e_expect( '06c59ff65a4315e2a6bb2cd79587206c3e482a7f0286d578ddcdb91eccef5e58' === $temporal['context'], 'temporal context matches the cross-runtime golden vector' );
v1_8010e_expect( 'UWorld cardiology' === $create['payload']['title'], 'title whitespace is normalized without HTML interpretation' );
v1_8010e_expect( 'practice' === $create['payload']['family'], 'family is server-derived from the versioned activity catalog' );
v1_8010e_expect( MMED_V1_Study_Week_Domain::activity_catalog_fingerprint() === $create['activity_catalog_fingerprint'], 'normalized DTO exposes the exact catalog semantics' );
v1_8010e_expect( MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION === $create['storage_codebook_version'] && MMED_V1_Study_Week_Domain::storage_codebook_fingerprint() === $create['storage_codebook_fingerprint'], 'normalized DTO exposes exact persistence semantics without reparsing request JSON' );
v1_8010e_expect( '0' === $create['expected_revision'], 'revision remains an exact decimal string' );
v1_8010e_expect( 1 === preg_match( '/^[a-f0-9]{64}$/', $create['request_hash'] ), 'server-bound request hash is canonical' );
v1_8010e_expect( '8c9fae090e08cd4379ea39a3681ac9e8e2c8b5f618cbb42baca7742847233c45' === $create['request_hash'], 'request hash matches the cross-runtime golden vector including replay identity, catalog, and storage semantics' );
v1_8010e_expect( $create['request_hash'] === MMED_V1_Study_Week_Domain::normalize_command( $create_body, 42, 42, 'learner', $temporal )['request_hash'], 'identical commands bind to one semantic hash' );

$move_body = array(
	'idempotency_key'   => '8010E-move-000001',
	'expected_revision' => '7',
	'command'           => 'move_block',
	'payload'           => array(
		'block_id'         => $uuid,
		'local_date'       => '2026-07-16',
		'local_time'       => '10:15',
		'fold'             => null,
		'temporal_context' => $temporal['context'],
	),
);
$resize_body = array(
	'idempotency_key'   => '8010E-resize-0001',
	'expected_revision' => '8',
	'command'           => 'resize_block',
	'payload'           => array( 'block_id' => $uuid, 'duration_minutes' => 105, 'temporal_context' => $temporal['context'] ),
);
$delete_body = array(
	'idempotency_key'   => '8010E-delete-0001',
	'expected_revision' => '9',
	'command'           => 'delete_block',
	'payload'           => array( 'block_id' => $uuid, 'temporal_context' => $temporal['context'] ),
);
$move = MMED_V1_Study_Week_Domain::normalize_command( $move_body, 42, 42, 'learner', $temporal );
$resize = MMED_V1_Study_Week_Domain::normalize_command( $resize_body, 42, 42, 'learner', $temporal );
$delete = MMED_V1_Study_Week_Domain::normalize_command( $delete_body, 42, 42, 'learner', $temporal );
v1_8010e_expect( 'move_block' === $move['command'] && 'resize_block' === $resize['command'] && 'delete_block' === $delete['command'], 'all four strict command shapes normalize' );
v1_8010e_expect( $temporal['context'] === $delete['payload']['temporal_context'], 'delete is bound to the same temporal context as arrangement commands' );
foreach ( array( $create_body, $move_body, $resize_body, $delete_body ) as $valid_body ) {
	foreach ( array_keys( $valid_body['payload'] ) as $required_payload_key ) {
		$missing = $valid_body;
		unset( $missing['payload'][ $required_payload_key ] );
		v1_8010e_expect( false !== strpos( v1_8010e_reason( static function () use ( $missing, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $missing, 42, 42, 'learner', $temporal ); } )[0], 'payload_shape' ), 'every command payload field is required exactly' );
	}
}

$changed = $create_body;
$changed['payload']['duration_minutes'] = 105;
v1_8010e_expect( $create['request_hash'] !== MMED_V1_Study_Week_Domain::normalize_command( $changed, 42, 42, 'learner', $temporal )['request_hash'], 'changed semantics bind to a different request hash' );
$different_owner = MMED_V1_Study_Week_Domain::normalize_command( $create_body, 43, 43, 'learner', $temporal );
v1_8010e_expect( $create['request_hash'] !== $different_owner['request_hash'], 'server-derived owner and actor are bound into the request hash' );
$different_revision_body = $create_body;
$different_revision_body['expected_revision'] = '1';
v1_8010e_expect( $create['request_hash'] !== MMED_V1_Study_Week_Domain::normalize_command( $different_revision_body, 42, 42, 'learner', $temporal )['request_hash'], 'expected revision is bound into the request hash' );
$different_key_body = $create_body;
$different_key_body['idempotency_key'] = '8010E-create-0002';
v1_8010e_expect( $create['request_hash'] !== MMED_V1_Study_Week_Domain::normalize_command( $different_key_body, 42, 42, 'learner', $temporal )['request_hash'], 'idempotency key is cryptographically bound to its immutable receipt identity' );
$changed_envelope = MMED_V1_Study_Week_Domain::temporal_envelope( '2026-07-13', 'America/New_York', 'profile-42-v8', '2026a' );
$changed_body = $create_body;
$changed_body['payload']['temporal_context'] = $changed_envelope['context'];
v1_8010e_expect( $create['request_hash'] !== MMED_V1_Study_Week_Domain::normalize_command( $changed_body, 42, 42, 'learner', $changed_envelope )['request_hash'], 'profile-context version changes bind to a different request hash' );
$extra = $create_body;
$extra['owner_id'] = 42;
v1_8010e_expect( 'command_body_shape' === v1_8010e_reason( static function () use ( $extra, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $extra, 42, 42, 'learner', $temporal ); } )[0], 'client-supplied owner is rejected' );
$nested_extra = $create_body;
$nested_extra['payload']['family'] = 'practice';
v1_8010e_expect( 'create_payload_shape' === v1_8010e_reason( static function () use ( $nested_extra, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $nested_extra, 42, 42, 'learner', $temporal ); } )[0], 'redundant client family authority is rejected' );
$number_revision = $create_body;
$number_revision['expected_revision'] = 0;
v1_8010e_expect( 'revision_invalid' === v1_8010e_reason( static function () use ( $number_revision, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $number_revision, 42, 42, 'learner', $temporal ); } )[0], 'numeric revisions are rejected' );
$stale = $create_body;
$stale['payload']['temporal_context'] = str_repeat( '0', 64 );
v1_8010e_expect( 'temporal_context_stale' === v1_8010e_reason( static function () use ( $stale, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $stale, 42, 42, 'learner', $temporal ); } )[0], 'stale temporal context cannot reinterpret a command' );
foreach ( array( '42', 42.0, true, 0, -1 ) as $invalid_actor ) {
	v1_8010e_expect( 'actor_owner_invalid' === v1_8010e_reason( static function () use ( $create_body, $temporal, $invalid_actor ) { MMED_V1_Study_Week_Domain::normalize_command( $create_body, $invalid_actor, $invalid_actor, 'learner', $temporal ); } )[0], 'coercible or non-positive server identity fails closed' );
}
v1_8010e_expect( 'actor_owner_invalid' === v1_8010e_reason( static function () use ( $create_body, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $create_body, 42, 43, 'learner', $temporal ); } )[0], 'actor/owner mismatch fails closed' );
$short_key = $create_body;
$short_key['idempotency_key'] = str_repeat( 'a', 15 );
v1_8010e_expect( 'idempotency_key_invalid' === v1_8010e_reason( static function () use ( $short_key, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $short_key, 42, 42, 'learner', $temporal ); } )[0], 'idempotency key lower byte bound is exact' );
$long_key = $create_body;
$long_key['idempotency_key'] = str_repeat( 'a', 65 );
v1_8010e_expect( 'idempotency_key_invalid' === v1_8010e_reason( static function () use ( $long_key, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $long_key, 42, 42, 'learner', $temporal ); } )[0], 'idempotency key upper byte bound is exact' );

v1_8010e_expect( MMED_V1_Study_Week_Domain::MAX_UNSIGNED_BIGINT === MMED_V1_Study_Week_Domain::decimal_revision( MMED_V1_Study_Week_Domain::MAX_UNSIGNED_BIGINT ), 'unsigned BIGINT revision boundary is accepted as text' );
v1_8010e_expect( '9223372036854775808' === MMED_V1_Study_Week_Domain::increment_revision( '9223372036854775807' ), 'revision increments beyond signed PHP integer range without coercion' );
v1_8010e_expect( 'revision_exhausted' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::increment_revision( MMED_V1_Study_Week_Domain::MAX_UNSIGNED_BIGINT ); } )[0], 'revision overflow fails closed' );

$short_exam = $create_body;
$short_exam['payload']['activity_type'] = 'practice_exam';
$short_exam['payload']['duration_minutes'] = 15;
v1_8010e_expect( 'activity_duration_too_short' === v1_8010e_reason( static function () use ( $short_exam, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $short_exam, 42, 42, 'learner', $temporal ); } )[0], 'activity-specific minimum prevents a 15-minute practice exam' );
$source_owned = $create_body;
$source_owned['payload']['activity_type'] = 'live_class';
$source_owned['payload']['duration_minutes'] = 60;
v1_8010e_expect( 'activity_source_owned' === v1_8010e_reason( static function () use ( $source_owned, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $source_owned, 42, 42, 'learner', $temporal ); } )[0], 'learner command cannot forge a source-owned anchor' );
$sleep = $create_body;
$sleep['payload']['activity_type'] = 'sleep';
$sleep['payload']['duration_minutes'] = 480;
v1_8010e_expect( 'life' === MMED_V1_Study_Week_Domain::normalize_command( $sleep, 42, 42, 'learner', $temporal )['payload']['family'], 'D9 Sleep remains a learner-creatable Life activity' );
$multibyte = $create_body;
$multibyte['payload']['title'] = str_repeat( 'é', 120 );
v1_8010e_expect( 120 === preg_match_all( '/./us', MMED_V1_Study_Week_Domain::normalize_command( $multibyte, 42, 42, 'learner', $temporal )['payload']['title'], $unused ), 'multibyte title limit is dependency independent' );
unset( $unused );
$multibyte['payload']['title'] .= 'é';
v1_8010e_expect( 'title_invalid' === v1_8010e_reason( static function () use ( $multibyte, $temporal ) { MMED_V1_Study_Week_Domain::normalize_command( $multibyte, 42, 42, 'learner', $temporal ); } )[0], 'multibyte title over the character limit fails identically' );

$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '09:00', 90, null, $temporal );
v1_8010e_expect( '2026-07-15 13:00:00.000000' === $slot['start_at_utc'] && '2026-07-15 14:30:00.000000' === $slot['end_at_utc'], 'normal local slot resolves to an exact half-open UTC interval' );
v1_8010e_expect( $temporal['context'] === $slot['temporal_context'] && '2026a' === $slot['tzdb_version'], 'resolved slot retains the bound temporal provenance' );
v1_8010e_expect( 'outside_selected_week' === v1_8010e_reason( static function () use ( $temporal ) { MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-20', '09:00', 60, null, $temporal ); } )[0], 'next Monday is outside the selected civil Week' );
v1_8010e_expect( 'outside_display_window' === v1_8010e_reason( static function () use ( $temporal ) { MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '05:45', 60, null, $temporal ); } )[0], 'canvas creation cannot start before 06:00' );
v1_8010e_expect( 'outside_display_window' === v1_8010e_reason( static function () use ( $temporal ) { MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '23:30', 45, null, $temporal ); } )[0], 'canvas creation cannot extend beyond local midnight' );
v1_8010e_expect( '00:00' === MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-15', '23:30', 30, null, $temporal )['end_local_time'], 'exact local-midnight boundary remains valid' );

$gap = v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::resolve_local_instant( '2026-03-08', '02:00', 'America/New_York', null ); } );
v1_8010e_expect( 'dst_gap' === $gap[0] && '2026-03-08' === $gap[1]['suggested_slot']['local_date'] && '03:00' === $gap[1]['suggested_slot']['local_time'], 'one-hour spring gap returns a complete valid-slot suggestion' );
v1_8010e_expect( array( 'fold_required', 'local_date', 'local_time' ) === array_keys( $gap[1]['suggested_slot'] ), 'one-hour gap suggestion uses the exact canonical public key order' );
$lord_howe = v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::resolve_local_instant( '2026-10-04', '02:00', 'Australia/Lord_Howe', null ); } );
v1_8010e_expect( 'dst_gap' === $lord_howe[0] && '02:30' === $lord_howe[1]['suggested_slot']['local_time'], 'half-hour DST gap returns the first valid quarter-hour slot' );
$apia = v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::resolve_local_instant( '2011-12-30', '09:00', 'Pacific/Apia', null ); } );
v1_8010e_expect( 'dst_gap' === $apia[0] && '2011-12-31' === $apia[1]['suggested_slot']['local_date'], 'skipped civil date searches safely into the next valid date' );
v1_8010e_expect( array( 'fold_required', 'local_date', 'local_time' ) === array_keys( $apia[1]['suggested_slot'] ), 'skipped-date suggestion uses the exact canonical public key order' );
v1_8010e_expect( 'dst_fold_choice_required' === v1_8010e_reason( static function () { MMED_V1_Study_Week_Domain::resolve_local_instant( '2026-11-01', '01:30', 'America/New_York', null ); } )[0], 'fall-back fold is never guessed' );
$earlier = MMED_V1_Study_Week_Domain::resolve_local_instant( '2026-11-01', '01:30', 'America/New_York', 'earlier' );
$later = MMED_V1_Study_Week_Domain::resolve_local_instant( '2026-11-01', '01:30', 'America/New_York', 'later' );
v1_8010e_expect( '2026-11-01 05:30:00' === $earlier['utc'] && '2026-11-01 06:30:00' === $later['utc'] && 3600 === $later['epoch'] - $earlier['epoch'], 'both fold choices remain distinct exact instants' );

v1_8010e_expect( true === MMED_V1_Study_Week_Domain::intervals_overlap( '2026-07-15 13:00:00.000000', '2026-07-15 14:00:00.000000', '2026-07-15 13:30:00.000000', '2026-07-15 14:30:00.000000' ), 'half-open intervals detect real overlap' );
v1_8010e_expect( false === MMED_V1_Study_Week_Domain::intervals_overlap( '2026-07-15 13:00:00.000000', '2026-07-15 14:00:00.000000', '2026-07-15 14:00:00.000000', '2026-07-15 14:30:00.000000' ), 'adjacent half-open intervals do not collide' );
foreach ( array(
	array( '2026-7-15 13:00:00.000000', '2026-07-15 14:00:00.000000' ),
	array( '2026-07-15T13:00:00+00:00', '2026-07-15 14:00:00.000000' ),
	array( '2026-07-15 14:00:00.000000', '2026-07-15 14:00:00.000000' ),
	array( '2026-07-15 15:00:00.000000', '2026-07-15 14:00:00.000000' ),
) as $invalid_interval ) {
	v1_8010e_expect( 'interval_invalid' === v1_8010e_reason( static function () use ( $invalid_interval ) { MMED_V1_Study_Week_Domain::intervals_overlap( $invalid_interval[0], $invalid_interval[1], '2026-07-15 13:00:00.000000', '2026-07-15 14:00:00.000000' ); } )[0], 'noncanonical, zero, or reversed interval fails closed' );
}

$goal_hash = str_repeat( 'a', 64 );
$source_ref_hash = str_repeat( 'b', 64 );
$source_version_hash = str_repeat( 'c', 64 );
$source_namespace_hash = str_repeat( 'd', 64 );
$week_row = v1_8010e_week_row( $temporal );
$storage_rows = array(
	v1_8010e_storage_block_at( '2026-07-15', 720, 120, array( 'block_id' => '00000000-0000-4000-8000-000000000004', 'title' => 'Largest movable' ) ),
	v1_8010e_storage_block_at( '2026-07-15', 660, 60, array( 'block_id' => '00000000-0000-4000-8000-000000000003', 'title' => 'Goal work', 'activity_type' => 'content_review', 'family_code' => '1', 'goal_ref_hash_hex' => $goal_hash, 'goal_source_version' => 'goals-v1' ) ),
	v1_8010e_storage_block_at( '2026-07-15', 540, 120, array( 'block_id' => '00000000-0000-4000-8000-000000000002', 'title' => 'Assessment', 'activity_type' => 'practice_exam', 'family_code' => '3' ) ),
	v1_8010e_storage_block_at( '2026-07-15', 900, 30, array( 'block_id' => '00000000-0000-4000-8000-000000000001', 'title' => 'Critical', 'activity_type' => 'content_review', 'family_code' => '1', 'priority_code' => '1' ) ),
	v1_8010e_storage_block_at( '2026-07-15', 480, 120, array( 'block_id' => '00000000-0000-4000-8000-000000000005', 'title' => 'Deleted', 'activity_type' => 'practice_exam', 'family_code' => '3', 'state_code' => '3', 'priority_code' => '1', 'goal_ref_hash_hex' => $goal_hash, 'goal_source_version' => 'goals-v1', 'tombstoned_revision' => '7' ) ),
);
$model = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, $storage_rows );
$mission = MMED_V1_Study_Week_Domain::derive_mission( $model, '2026-07-15' );
v1_8010e_expect( 'Critical' === $mission['title'] && '7' === $mission['revision'], 'critical Mission is bound to the exact Plan projection revision' );
v1_8010e_expect( array_keys( $mission['primary'] ) === array( 'activity_type', 'block_id', 'duration_minutes', 'family', 'fold', 'goal_linked', 'local_date', 'local_time', 'priority', 'state', 'title' ), 'Mission primary exposes only the learner-safe allowlist' );
v1_8010e_expect( array_keys( $model['blocks'][0] ) === array( 'activity_type', 'block_id', 'duration_minutes', 'family', 'fold', 'goal_linked', 'local_date', 'local_time', 'priority', 'state', 'title' ), 'private ownership, storage codes, hashes, and provenance never escape the row adapter' );
$tampered = $model;
$tampered['revision'] = '8';
v1_8010e_expect( 'week_projection_hash_mismatch' === v1_8010e_reason( static function () use ( $tampered ) { MMED_V1_Study_Week_Domain::derive_mission( $tampered, '2026-07-15' ); } )[0], 'stale rows cannot be paired with a newer revision' );
$private = v1_8010e_storage_block_at();
$private['private_note'] = 'must-not-cross-boundary';
v1_8010e_expect( 'week_storage_block_invalid' === v1_8010e_reason( static function () use ( $week_row, $private ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $private ) ); } )[0], 'extra internal row fields are rejected before projection' );

$week_row_revision_one = v1_8010e_week_row( $temporal, '1' );
$fixed_source = array( 'state_code' => '2', 'source_code' => '2', 'source_namespace_hash_hex' => $source_namespace_hash, 'source_ref_hash_hex' => $source_ref_hash, 'source_version_hash_hex' => $source_version_hash, 'created_revision' => '1', 'updated_revision' => '1' );
$fixed_clinical_row = v1_8010e_storage_block_at( '2026-07-15', 540, 360, array_merge( $fixed_source, array( 'activity_type' => 'usce_shift', 'family_code' => '5' ) ) );
$fixed_clinical = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row_revision_one, array( $fixed_clinical_row ) );
v1_8010e_expect( 'protect_the_day' === MMED_V1_Study_Week_Domain::derive_mission( $fixed_clinical, '2026-07-15' )['state'], 'ordinary fixed clinical anchor is not an executable Mission' );
$fixed_assessment_row = v1_8010e_storage_block_at( '2026-07-15', 540, 120, array_merge( $fixed_source, array( 'activity_type' => 'practice_exam', 'family_code' => '3' ) ) );
$fixed_assessment = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row_revision_one, array( $fixed_assessment_row ) );
v1_8010e_expect( 'planned' === MMED_V1_Study_Week_Domain::derive_mission( $fixed_assessment, '2026-07-15' )['state'], 'fixed assessment remains an explicit Mission exception' );

foreach ( array( 'owner_id' => '43', 'plan_id' => '10000000-0000-4000-8000-000000000002', 'week_id' => '20000000-0000-4000-8000-000000000002', 'week_start_local' => '2026-07-20' ) as $identity_field => $wrong_value ) {
	$wrong_row = v1_8010e_storage_block_at();
	$wrong_row[ $identity_field ] = $wrong_value;
	v1_8010e_expect( 'week_storage_ownership_invalid' === v1_8010e_reason( static function () use ( $week_row, $wrong_row ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $wrong_row ) ); } )[0], 'row adapter rejects mismatched ' . $identity_field );
}

$duplicate = v1_8010e_storage_block_at();
foreach ( array( $duplicate, array_merge( $duplicate, array( 'title' => 'Conflicting duplicate' ) ) ) as $second_duplicate ) {
	v1_8010e_expect( 'week_projection_duplicate_block' === v1_8010e_reason( static function () use ( $week_row, $duplicate, $second_duplicate ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $duplicate, $second_duplicate ) ); } )[0], 'duplicate Block UUIDs fail closed before sorting or hashing' );
}
$overlap_a = v1_8010e_storage_block_at( '2026-07-15', 540, 60 );
$overlap_b = v1_8010e_storage_block_at( '2026-07-15', 570, 60, array( 'block_id' => '00000000-0000-4000-8000-000000000002' ) );
v1_8010e_expect( 'week_storage_collision_invalid' === v1_8010e_reason( static function () use ( $week_row, $overlap_a, $overlap_b ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $overlap_a, $overlap_b ) ); } )[0], 'reader corruption cannot surface overlapping active Blocks' );
$adjacent_b = v1_8010e_storage_block_at( '2026-07-15', 600, 60, array( 'block_id' => '00000000-0000-4000-8000-000000000002' ) );
v1_8010e_expect( 2 === count( MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $overlap_a, $adjacent_b ) )['blocks'] ), 'half-open adjacent active Blocks remain valid' );
$deleted_overlap = array_merge( $overlap_b, array( 'state_code' => '3', 'tombstoned_revision' => '7' ) );
v1_8010e_expect( 2 === count( MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $overlap_a, $deleted_overlap ) )['blocks'] ), 'tombstones do not create false collision failures' );

$dense_rows = array();
$dense_week_start = new DateTimeImmutable( '2026-07-13 00:00:00', new DateTimeZone( 'UTC' ) );
$dense_index = 1;
for ( $day = 0; $day < 7; ++$day ) {
	$local_date = $dense_week_start->modify( '+' . $day . ' days' )->format( 'Y-m-d' );
	for ( $slot_index = 0; $slot_index < 72; ++$slot_index ) {
		$dense_rows[] = v1_8010e_storage_block_at(
			$local_date,
			360 + ( $slot_index * 15 ),
			15,
			array(
				'block_id' => sprintf( '30000000-0000-4000-8000-%012d', $dense_index ),
				'activity_type' => 'flashcards',
				'family_code' => '2',
			)
		);
		++$dense_index;
	}
}
$dense_model = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array_reverse( $dense_rows ) );
v1_8010e_expect( 504 === count( $dense_model['blocks'] ), 'maximum quarter-hour Week density remains deterministic under unsorted input' );
unset( $dense_rows, $dense_model, $dense_week_start );

foreach ( array( '1', '2', '3' ) as $state_code ) {
	foreach ( array( '2026-07-12', '2026-07-20' ) as $outside_date ) {
		$outside_row = v1_8010e_storage_block_at();
		$outside_row['local_date'] = $outside_date;
		$outside_row['state_code'] = $state_code;
		v1_8010e_expect( 'week_projection_membership_invalid' === v1_8010e_reason( static function () use ( $week_row, $outside_row ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $outside_row ) ); } )[0], 'every Block state is civil-Week bound' );
	}
}
foreach ( array( v1_8010e_storage_block_at( '2026-07-13', 540, 90 ), v1_8010e_storage_block_at( '2026-07-19', 540, 90 ) ) as $boundary_row ) {
	v1_8010e_expect( 1 === count( MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $boundary_row ) )['blocks'] ), 'Monday and in-Week Sunday boundaries are accepted' );
}

$unsupported_codebook = v1_8010e_storage_block_at();
$unsupported_codebook['storage_codebook_version'] = 'week-storage-v2';
v1_8010e_expect( 'week_storage_provenance_invalid' === v1_8010e_reason( static function () use ( $week_row, $unsupported_codebook ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $unsupported_codebook ) ); } )[0], 'unsupported storage codebooks are never reinterpreted' );
$bad_block_context = v1_8010e_storage_block_at();
$bad_block_context['profile_version'] = 'profile-42-v8';
v1_8010e_expect( 'week_storage_provenance_invalid' === v1_8010e_reason( static function () use ( $week_row, $bad_block_context ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $bad_block_context ) ); } )[0], 'per-Block temporal provenance is self-verifying' );
$bad_week_context = v1_8010e_week_row( $temporal, '7', array( 'tzdb_version' => '2026b' ) );
v1_8010e_expect( 'week_storage_provenance_invalid' === v1_8010e_reason( static function () use ( $bad_week_context ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $bad_week_context, array() ); } )[0], 'Week header provenance is self-verifying' );
$bad_goal = v1_8010e_storage_block_at( '2026-07-15', 540, 90, array( 'goal_ref_hash_hex' => $goal_hash ) );
v1_8010e_expect( 'week_storage_goal_invalid' === v1_8010e_reason( static function () use ( $week_row, $bad_goal ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $bad_goal ) ); } )[0], 'goal linkage is derived only from a complete server-owned pair' );
$bad_source = v1_8010e_storage_block_at( '2026-07-15', 540, 90, array( 'source_code' => '2', 'source_namespace_hash_hex' => $source_namespace_hash, 'source_ref_hash_hex' => $source_ref_hash ) );
v1_8010e_expect( 'week_storage_source_invalid' === v1_8010e_reason( static function () use ( $week_row, $bad_source ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $bad_source ) ); } )[0], 'external-source provenance requires namespace, reference, version, and compatible state' );
$forged_manual_anchor = v1_8010e_storage_block_at( '2026-07-15', 540, 60, array( 'activity_type' => 'live_class', 'family_code' => '1' ) );
v1_8010e_expect( 'week_storage_source_invalid' === v1_8010e_reason( static function () use ( $week_row, $forged_manual_anchor ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $forged_manual_anchor ) ); } )[0], 'manual storage cannot forge a source-owned catalog activity' );
$early_block_week = v1_8010e_week_row( $temporal, '7', array( 'week_created_revision' => '5', 'week_updated_revision' => '5' ) );
$early_block = v1_8010e_storage_block_at( '2026-07-15', 540, 90, array( 'created_revision' => '1', 'updated_revision' => '5' ) );
v1_8010e_expect( 'week_storage_revision_invalid' === v1_8010e_reason( static function () use ( $early_block_week, $early_block ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $early_block_week, array( $early_block ) ); } )[0], 'a Block cannot predate its owning Week' );
$late_block_week = v1_8010e_week_row( $temporal, '7', array( 'week_updated_revision' => '5' ) );
$late_block = v1_8010e_storage_block_at( '2026-07-15', 540, 90, array( 'updated_revision' => '7' ) );
v1_8010e_expect( 'week_storage_revision_invalid' === v1_8010e_reason( static function () use ( $late_block_week, $late_block ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $late_block_week, array( $late_block ) ); } )[0], 'a Block cannot be newer than its owning Week snapshot' );
$lagging_valid_block = v1_8010e_storage_block_at( '2026-07-15', 540, 90, array( 'updated_revision' => '5' ) );
v1_8010e_expect( '7' === MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $late_block_week, array( $lagging_valid_block ) )['revision'], 'another Week may advance Plan revision without tearing this Week snapshot' );
$bad_interval = v1_8010e_storage_block_at();
$bad_interval['end_at_utc'] = '2026-07-15 14:31:00.000000';
v1_8010e_expect( 'week_storage_temporal_invalid' === v1_8010e_reason( static function () use ( $week_row, $bad_interval ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $bad_interval ) ); } )[0], 'stored UTC interval must exactly match local intent and duration' );
$late_invalid = v1_8010e_storage_block_at( '2026-07-15', 1410, 30 );
$late_invalid['duration_minutes'] = '45';
v1_8010e_expect( 'outside_display_window' === v1_8010e_reason( static function () use ( $week_row, $late_invalid ) { MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( $late_invalid ) ); } )[0], 'row projection rejects 23:30 plus 45 minutes' );
v1_8010e_expect( 1 === count( MMED_V1_Study_Week_Domain::week_model_from_repository_rows( 42, $week_row, array( v1_8010e_storage_block_at( '2026-07-15', 1425, 15, array( 'activity_type' => 'flashcards' ) ) ) )['blocks'] ), '23:45 plus 15 minutes is the exact valid upper boundary' );

v1_8010e_expect( true === MMED_V1_Study_Week_Domain::assert_mutation_target( 'move_block', v1_8010e_block( array( 'block_id' => $uuid ) ), $move['payload'] ), 'flexible move target is legal' );
v1_8010e_expect( true === MMED_V1_Study_Week_Domain::assert_mutation_target( 'resize_block', v1_8010e_block( array( 'block_id' => $uuid ) ), $resize['payload'] ), 'flexible resize target is legal' );
v1_8010e_expect( true === MMED_V1_Study_Week_Domain::assert_mutation_target( 'delete_block', v1_8010e_block( array( 'block_id' => $uuid ) ), $delete['payload'] ), 'flexible delete target is legal' );
$fixed_block = v1_8010e_block( array( 'block_id' => $uuid, 'state' => 'planned_fixed' ) );
v1_8010e_expect( 'fixed_anchor_immutable' === v1_8010e_reason( static function () use ( $fixed_block, $move ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'move_block', $fixed_block, $move['payload'] ); } )[0], 'fixed anchor cannot move' );
$tombstone = v1_8010e_block( array( 'block_id' => $uuid, 'state' => 'tombstoned' ) );
v1_8010e_expect( 'block_not_found' === v1_8010e_reason( static function () use ( $tombstone, $delete ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'delete_block', $tombstone, $delete['payload'] ); } )[0], 'tombstone cannot silently resurrect or enumerate' );
foreach ( array( 'move_block' => $move['payload'], 'resize_block' => $resize['payload'], 'delete_block' => $delete['payload'] ) as $mutation_command => $mutation_payload ) {
	$mutation_payload['block_id'] = '00000000-0000-4000-8000-000000000002';
	foreach ( array( 'planned_flexible', 'planned_fixed', 'tombstoned' ) as $target_state ) {
		$target = v1_8010e_block( array( 'state' => $target_state ) );
		v1_8010e_expect( 'block_not_found' === v1_8010e_reason( static function () use ( $mutation_command, $target, $mutation_payload ) { MMED_V1_Study_Week_Domain::assert_mutation_target( $mutation_command, $target, $mutation_payload ); } )[0], 'target identity is checked before state for ' . $mutation_command );
	}
}
$late_move = $move['payload'];
$late_move['local_time'] = '23:30';
v1_8010e_expect( 'outside_display_window' === v1_8010e_reason( static function () use ( $late_move, $uuid ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'move_block', v1_8010e_block( array( 'block_id' => $uuid, 'duration_minutes' => 45 ) ), $late_move ); } )[0], 'move validation cannot place a Block past midnight' );
$late_resize = $resize['payload'];
$late_resize['duration_minutes'] = 45;
v1_8010e_expect( 'outside_display_window' === v1_8010e_reason( static function () use ( $late_resize, $uuid ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'resize_block', v1_8010e_block( array( 'block_id' => $uuid, 'local_time' => '23:30', 'duration_minutes' => 30 ) ), $late_resize ); } )[0], 'resize validation cannot extend a Block past midnight' );
$no_move = $move['payload'];
$no_move['local_date'] = '2026-07-15';
$no_move['local_time'] = '09:00';
v1_8010e_expect( 'no_state_change' === v1_8010e_reason( static function () use ( $no_move, $uuid ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'move_block', v1_8010e_block( array( 'block_id' => $uuid ) ), $no_move ); } )[0], 'no-op move consumes no revision' );
$no_resize = $resize['payload'];
$no_resize['duration_minutes'] = 90;
v1_8010e_expect( 'no_state_change' === v1_8010e_reason( static function () use ( $no_resize, $uuid ) { MMED_V1_Study_Week_Domain::assert_mutation_target( 'resize_block', v1_8010e_block( array( 'block_id' => $uuid ) ), $no_resize ); } )[0], 'no-op resize consumes no revision' );

echo "V1 Study Schedule 8010E pure Week domain: ok\n";
