<?php
/** Pure PHP 7.4-compatible 8010E additive Week schema contract. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema-inspector.php';

function v1_8010e_schema_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$database_a = new stdClass();
$database_a->prefix = 'wp_';
$database_b = new stdClass();
$database_b->prefix = 'tenant_';

$kernel = MMED_V1_Study_Schema::migrations( $database_a );
$week_a = MMED_V1_Study_Week_Schema::migrations( $database_a );
$week_b = MMED_V1_Study_Week_Schema::migrations( $database_b );
v1_8010e_schema_expect( array( 1, 2, 3, 4, 5 ) === array_column( $kernel, 'version' ), 'accepted 8010D migrations remain exactly 1-5' );
v1_8010e_schema_expect( array( 6, 7 ) === array_column( $week_a, 'version' ), '8010E owns only additive migrations 6-7' );
v1_8010e_schema_expect( array( '8010E-006-weeks', '8010E-007-blocks' ) === array_column( $week_a, 'id' ), '8010E migration IDs are immutable and explicit' );
v1_8010e_schema_expect( array( 'weeks', 'blocks' ) === array_column( $week_a, 'table_key' ), 'Week precedes its Block dependents' );
v1_8010e_schema_expect( 2 === MMED_V1_Study_Week_Schema::GENERATION, 'normalized Week store is generation 2' );
v1_8010e_schema_expect( '2' === MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION, 'reader 2 is explicit' );
v1_8010e_schema_expect( null === MMED_V1_Study_Week_Schema::PREVIOUS_READER_VERSION, 'no fictional N-1 reader is claimed before proof' );
v1_8010e_schema_expect( MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION === MMED_V1_Study_Week_Schema::ACTIVITY_CATALOG_VERSION, 'domain and physical schema bind one activity catalog' );
v1_8010e_schema_expect( MMED_V1_Study_Week_Domain::activity_catalog_fingerprint() === MMED_V1_Study_Week_Schema::ACTIVITY_CATALOG_FINGERPRINT, 'domain catalog content matches the schema-bound fingerprint' );
v1_8010e_schema_expect( MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION === MMED_V1_Study_Week_Schema::STORAGE_CODEBOOK_VERSION, 'domain and physical schema bind one storage codebook version' );
v1_8010e_schema_expect( MMED_V1_Study_Week_Domain::storage_codebook_fingerprint() === MMED_V1_Study_Week_Schema::STORAGE_CODEBOOK_FINGERPRINT, 'domain storage codes match the schema-bound fingerprint' );

foreach ( $week_a as $index => $migration ) {
	v1_8010e_schema_expect( 1 === preg_match( '/^[a-f0-9]{64}$/', $migration['checksum_hex'] ), 'additive migration checksum is canonical hex' );
	v1_8010e_schema_expect( $migration['checksum_hex'] === $week_b[ $index ]['checksum_hex'], 'source checksum is deployment-prefix independent' );
	v1_8010e_schema_expect( $migration['sql'] !== $week_b[ $index ]['sql'], 'rendered Week tables remain prefix scoped' );
	v1_8010e_schema_expect( false !== strpos( $migration['sql'], 'ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' ), 'DDL fixes engine, row format, charset, and collation' );
	v1_8010e_schema_expect( false === stripos( $migration['sql'], 'IF NOT EXISTS' ), 'DDL cannot hide drift with IF NOT EXISTS' );
	v1_8010e_schema_expect( 0 === preg_match( '/\b(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE)\b/i', $migration['sql'] ), 'additive schema contains no destructive command' );
}
v1_8010e_schema_expect(
	MMED_V1_Study_Week_Schema::manifest_hash_hex( $database_a ) === MMED_V1_Study_Week_Schema::manifest_hash_hex( $database_b ),
	'generation-2 manifest binds logical ownership while remaining prefix independent'
);

$constraints_a = MMED_V1_Study_Week_Schema::constraint_names( $database_a );
$constraints_b = MMED_V1_Study_Week_Schema::constraint_names( $database_b );
v1_8010e_schema_expect( $constraints_a !== $constraints_b, 'Week constraint symbols are deployment-prefix scoped' );
v1_8010e_schema_expect( 16 === count( $constraints_a ), 'all sixteen portable Week ownership and invariant constraints are named' );
foreach ( $constraints_a as $constraint ) {
	v1_8010e_schema_expect( strlen( $constraint ) <= 64 && 1 === preg_match( '/^[A-Za-z0-9_]+$/', $constraint ), 'constraint identifier is safe and portable' );
}

$shapes = MMED_V1_Study_Week_Schema::expected_shapes( $database_a );
v1_8010e_schema_expect( array( 'weeks', 'blocks' ) === array_keys( $shapes ), 'all and only normalized 8010E tables have exact postconditions' );
v1_8010e_schema_expect( isset( $shapes['weeks']['indexes']['uq_owner_plan_week'] ), 'Week composite identity is database unique' );
v1_8010e_schema_expect( isset( $shapes['weeks']['foreign_keys'][ $constraints_a['week_plan'] ] ), 'Week owner/Plan ownership is database enforced' );
v1_8010e_schema_expect( isset( $shapes['weeks']['checks'][ $constraints_a['week_provenance'] ] ), 'Week temporal provenance cannot be stored empty' );
v1_8010e_schema_expect( isset( $shapes['blocks']['foreign_keys'][ $constraints_a['block_week'] ] ), 'Block owner/Plan/Week ownership is database enforced' );
v1_8010e_schema_expect( array( 'owner_id', 'plan_id', 'week_id' ) === $shapes['blocks']['foreign_keys'][ $constraints_a['block_week'] ]['columns'], 'Block FK binds exact owner/Plan/Week identity' );
v1_8010e_schema_expect( array( 'owner_id', 'plan_id', 'week_id' ) === $shapes['blocks']['indexes']['idx_owner_plan_week']['columns'], 'Block FK uses one explicit portable child index' );
v1_8010e_schema_expect( isset( $shapes['blocks']['indexes']['idx_owner_week_interval'] ), 'owner-serialized collision query has an exact supporting index' );
v1_8010e_schema_expect( isset( $shapes['blocks']['indexes']['uq_owner_source_version'] ), 'one versioned external anchor cannot materialize twice for an owner' );
v1_8010e_schema_expect( isset( $shapes['blocks']['columns']['start_at_utc'], $shapes['blocks']['columns']['timezone'], $shapes['blocks']['columns']['local_date'], $shapes['blocks']['columns']['local_minute'], $shapes['blocks']['columns']['fold_code'] ), 'UTC instant and local temporal identity are both persisted' );
v1_8010e_schema_expect( isset( $shapes['weeks']['columns']['profile_version'], $shapes['weeks']['columns']['tzdb_version'], $shapes['weeks']['columns']['temporal_context_hash'], $shapes['blocks']['columns']['profile_version'], $shapes['blocks']['columns']['tzdb_version'], $shapes['blocks']['columns']['temporal_context_hash'], $shapes['blocks']['columns']['activity_catalog_version'], $shapes['blocks']['columns']['storage_codebook_version'] ), 'each Block independently preserves temporal, catalog, and codebook provenance' );
v1_8010e_schema_expect( 120 === $shapes['blocks']['columns']['title']['length'], 'storage title width exactly matches the 120-character domain contract' );
v1_8010e_schema_expect( isset( $shapes['blocks']['columns']['source_namespace_hash'], $shapes['blocks']['columns']['source_ref_hash'], $shapes['blocks']['columns']['source_version_hash'] ), 'external anchors retain a complete non-content source identity tuple' );
v1_8010e_schema_expect( isset( $shapes['blocks']['checks'][ $constraints_a['block_duration'] ] ), 'duration step and bounds are database constrained' );
v1_8010e_schema_expect( isset( $shapes['blocks']['checks'][ $constraints_a['block_source'] ] ), 'fixed/flexible source ownership is database constrained' );
v1_8010e_schema_expect( isset( $shapes['blocks']['checks'][ $constraints_a['block_goal'] ] ), 'server-owned goal reference and source version are paired' );
v1_8010e_schema_expect( false !== strpos( $shapes['blocks']['checks'][ $constraints_a['block_goal'] ], 'OCTET_LENGTH(goal_source_version) BETWEEN 1 AND 64' ), 'goal source versions cannot be empty' );
v1_8010e_schema_expect( isset( $shapes['blocks']['checks'][ $constraints_a['block_revision'] ] ), 'tombstone and revision shape are database constrained' );
v1_8010e_schema_expect( false !== strpos( $shapes['blocks']['checks'][ $constraints_a['block_revision'] ], 'tombstoned_revision IS NOT NULL' ), 'tombstone CHECK closes the SQL UNKNOWN null loophole' );
v1_8010e_schema_expect( false !== strpos( $shapes['blocks']['checks'][ $constraints_a['block_local'] ], 'local_minute + duration_minutes <= 1440' ), 'database prevents a Block from crossing local midnight' );
v1_8010e_schema_expect( false !== strpos( $shapes['blocks']['checks'][ $constraints_a['block_interval'] ], 'TIMESTAMPADD(MINUTE, duration_minutes, start_at_utc)' ), 'database interval length exactly equals duration' );
v1_8010e_schema_expect( false !== strpos( $shapes['blocks']['checks'][ $constraints_a['block_source'] ], 'source_version_hash IS NOT NULL' ), 'source-owned anchors require a versioned external reference' );
v1_8010e_schema_expect( is_subclass_of( 'MMED_V1_Study_Week_Schema_Inspector', 'MMED_V1_Study_Schema_Inspector' ), 'Week inspection reuses the accepted exact comparison engine' );
$inspector_reflection = new ReflectionClass( 'MMED_V1_Study_Schema_Inspector' );
$canonical_check = $inspector_reflection->getMethod( 'canonical_check_clause' );
$canonical_check->setAccessible( true );
$inspector_without_database = $inspector_reflection->newInstanceWithoutConstructor();
foreach ( $shapes['weeks']['checks'] + $shapes['blocks']['checks'] as $check_clause ) {
	$canonical = $canonical_check->invoke( $inspector_without_database, $check_clause );
	v1_8010e_schema_expect( is_string( $canonical ) && '' !== $canonical, 'every Week CHECK clause is accepted by the exact portable grammar' );
}
$mod_function = $canonical_check->invoke( $inspector_without_database, 'MOD(duration_minutes, 15) = 0' );
$mod_keyword  = $canonical_check->invoke( $inspector_without_database, 'duration_minutes MOD 15 = 0' );
$mod_percent  = $canonical_check->invoke( $inspector_without_database, 'duration_minutes % 15 = 0' );
v1_8010e_schema_expect( $mod_function === $mod_keyword && $mod_keyword === $mod_percent, 'MOD function and both governed engine metadata synonyms canonicalize identically' );
$mod_parenthesized = $canonical_check->invoke( $inspector_without_database, '(duration_minutes % 15) = 0' );
$mod_double_wrapped = $canonical_check->invoke( $inspector_without_database, '((duration_minutes % 15) = 0)' );
v1_8010e_schema_expect( $mod_percent === $mod_parenthesized && $mod_parenthesized === $mod_double_wrapped, 'MySQL arithmetic metadata parentheses preserve the exact MOD predicate' );
$timestampadd_function = $canonical_check->invoke( $inspector_without_database, 'end_at_utc = TIMESTAMPADD(MINUTE, duration_minutes, start_at_utc)' );
$timestampadd_interval = $canonical_check->invoke( $inspector_without_database, 'end_at_utc = start_at_utc + INTERVAL duration_minutes MINUTE' );
v1_8010e_schema_expect( $timestampadd_function === $timestampadd_interval, 'MariaDB interval metadata canonicalizes to the governed TIMESTAMPADD minute expression' );

$source = '';
foreach ( array( 'class-mmed-v1-study-week-schema.php', 'class-mmed-v1-study-week-schema-inspector.php' ) as $source_file ) {
	$bytes = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/' . $source_file );
	v1_8010e_schema_expect( is_string( $bytes ), 'Week schema source is readable' );
	$source .= $bytes;
}
foreach ( array( 'dbDelta', 'update_option', 'add_option', 'delete_option', 'register_rest_route', 'add_action', 'wp_remote_', 'curl_' ) as $forbidden ) {
	v1_8010e_schema_expect( false === strpos( $source, $forbidden . '(' ), 'Week schema remains inert: ' . $forbidden );
}

echo "V1 Study Schedule 8010E additive Week schema: ok\n";
