<?php
/** Pure PHP 7.4-compatible 8010D schema and inertness contract. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php';
require $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';

function v1_8010d_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010d_expect_throws( $callback, $message ) {
	$threw = false;
	try {
		$callback();
	} catch ( Throwable $error ) {
		$threw = true;
	}
	if ( ! $threw ) {
		throw new RuntimeException( $message );
	}
}

$database_a         = new stdClass();
$database_a->prefix = 'wp_';
$database_b         = new stdClass();
$database_b->prefix = 'tenant_';

$migrations_a = MMED_V1_Study_Schema::migrations( $database_a );
$migrations_b = MMED_V1_Study_Schema::migrations( $database_b );
v1_8010d_expect( 5 === count( $migrations_a ), 'kernel has exactly five ordered migrations' );
v1_8010d_expect(
	array( 'migrations', 'generations', 'store_gate', 'plans', 'operations' ) === array_column( $migrations_a, 'table_key' ),
	'migration dependency order is exact'
);
v1_8010d_expect( array( 1, 2, 3, 4, 5 ) === array_column( $migrations_a, 'version' ), 'migration versions are contiguous' );
v1_8010d_expect(
	array(
		'8010D-001-migrations',
		'8010D-002-generations',
		'8010D-003-store-gate',
		'8010D-004-plans',
		'8010D-005-operations',
	) === array_column( $migrations_a, 'id' ),
	'migration IDs are immutable and explicit'
);
v1_8010d_expect( null === MMED_V1_Study_Schema::PREVIOUS_READER_VERSION, 'generation 1 claims no fictional N-1 reader' );
v1_8010d_expect(
	array( 'migrations', 'store_gate', 'generations', 'plans', 'operations' ) === array_keys( MMED_V1_Study_Schema::logical_table_suffixes() ),
	'physical table ownership suffixes are explicit and ordered'
);
v1_8010d_expect( 8 === count( MMED_V1_Study_Schema::logical_constraint_suffixes() ), 'constraint namespace has eight explicit logical symbols' );

foreach ( $migrations_a as $index => $migration ) {
	v1_8010d_expect( 1 === preg_match( '/^[a-f0-9]{64}$/', $migration['checksum_hex'] ), 'migration checksum is canonical hex' );
	v1_8010d_expect( false !== strpos( $migration['sql'], 'ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' ), 'DDL fixes engine, row format, charset, and collation' );
	v1_8010d_expect( false === stripos( $migration['sql'], 'IF NOT EXISTS' ), 'DDL cannot mask drift with IF NOT EXISTS' );
	v1_8010d_expect( $migration['checksum_hex'] === $migrations_b[ $index ]['checksum_hex'], 'source checksum is deployment-prefix independent' );
	v1_8010d_expect( $migration['sql'] !== $migrations_b[ $index ]['sql'], 'rendered tables remain prefix scoped' );
}

$constraints_a = MMED_V1_Study_Schema::constraint_names( $database_a );
$constraints_b = MMED_V1_Study_Schema::constraint_names( $database_b );
v1_8010d_expect( $constraints_a !== $constraints_b, 'constraint symbols are database-prefix scoped' );
v1_8010d_expect( MMED_V1_Study_Schema::manifest_hash_hex( $database_a ) === MMED_V1_Study_Schema::manifest_hash_hex( $database_b ), 'manifest binds logical ownership while remaining deployment-prefix independent' );
foreach ( $constraints_a as $constraint ) {
	v1_8010d_expect( strlen( $constraint ) <= 64, 'constraint identifier respects database limit' );
	v1_8010d_expect( 1 === preg_match( '/^[A-Za-z0-9_]+$/', $constraint ), 'constraint identifier is safe' );
}

$shapes = MMED_V1_Study_Schema::expected_shapes( $database_a );
v1_8010d_expect( array_keys( $shapes ) === array( 'migrations', 'store_gate', 'generations', 'plans', 'operations' ), 'all and only kernel postconditions exist' );
v1_8010d_expect( isset( $shapes['operations']['indexes']['uq_owner_revision'] ), 'owner revision is database unique' );
v1_8010d_expect( isset( $shapes['operations']['indexes']['uq_owner_idempotency'] ), 'owner idempotency is database unique' );
v1_8010d_expect( isset( $shapes['operations']['foreign_keys'][ $constraints_a['operation_plan'] ] ), 'operation owner/Plan relation is database enforced' );
v1_8010d_expect( isset( $shapes['operations']['checks'][ $constraints_a['operation_revision'] ] ), 'revision transition check clause is declared' );
v1_8010d_expect( isset( $shapes['plans']['checks'][ $constraints_a['plan_shape'] ] ), 'revision-zero/Plan shape check clause is declared' );

$inspector_reflection = new ReflectionClass( 'MMED_V1_Study_Schema_Inspector' );
$canonicalize         = $inspector_reflection->getMethod( 'canonical_check_clause' );
$canonicalize->setAccessible( true );
$inspector_without_database = $inspector_reflection->newInstanceWithoutConstructor();
$source_check = '(revision = expected_revision + 1 AND plan_hash IS NOT NULL) OR (OCTET_LENGTH(idempotency_key) BETWEEN 16 AND 64 AND plan_id IS NULL)';
$mariadb_check = 'revision = expected_revision + 1 and plan_hash is not null or octet_length(idempotency_key) between 16 and 64 and plan_id is null';
$mysql_check = '((`revision` = (`expected_revision` + 1)) and (`plan_hash` is not null)) or ((octet_length(`idempotency_key`) between 16 and 64) and (`plan_id` is null))';
$canonical_source = $canonicalize->invoke( $inspector_without_database, $source_check );
v1_8010d_expect( $canonical_source === $canonicalize->invoke( $inspector_without_database, $mariadb_check ), 'MariaDB flattened CHECK text preserves the source boolean contract' );
v1_8010d_expect( $canonical_source === $canonicalize->invoke( $inspector_without_database, $mysql_check ), 'MySQL parenthesized CHECK text preserves arithmetic and boolean semantics' );
v1_8010d_expect( $canonical_source !== $canonicalize->invoke( $inspector_without_database, '1 = 1' ), 'same-named no-op CHECK cannot canonicalize as the owned contract' );
v1_8010d_expect_throws(
	static function () use ( $canonicalize, $inspector_without_database ) {
		$canonicalize->invoke( $inspector_without_database, 'revision = 1; SELECT 1' );
	},
	'unsupported CHECK grammar fails closed'
);

$uuid   = '12345678-1234-4abc-8def-1234567890ab';
$binary = MMED_V1_Study_Schema::uuid_to_binary( $uuid );
v1_8010d_expect( 16 === strlen( $binary ), 'UUID packs to 16 bytes' );
v1_8010d_expect( $uuid === MMED_V1_Study_Schema::binary_to_uuid( $binary ), 'UUID round trip is exact' );
v1_8010d_expect_throws(
	static function () {
		MMED_V1_Study_Schema::uuid_to_binary( '12345678-1234-1abc-8def-1234567890ab' );
	},
	'non-v4 UUID fails closed'
);
v1_8010d_expect_throws(
	static function () {
		$database         = new stdClass();
		$database->prefix = str_repeat( 'x', 50 ) . '_';
		MMED_V1_Study_Schema::table_names( $database );
	},
	'overlength rendered identifier fails closed'
);

$files = array(
	$root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php',
	$root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema-inspector.php',
	$root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php',
);
$source = '';
foreach ( $files as $file ) {
	$bytes = file_get_contents( $file );
	v1_8010d_expect( is_string( $bytes ), 'kernel source is readable' );
	$source .= "\n" . $bytes;
}
foreach ( array( 'dbDelta', 'update_option', 'add_option', 'delete_option', 'register_rest_route', 'add_action', 'wp_remote_', 'curl_' ) as $forbidden ) {
	v1_8010d_expect( false === strpos( $source, $forbidden . '(' ), 'kernel source remains inert: ' . $forbidden );
}
v1_8010d_expect( 0 === preg_match( '/\b(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE)\b/i', $source ), 'kernel source contains no destructive schema command' );

echo "V1 Study Schedule 8010D pure contract: ok\n";
