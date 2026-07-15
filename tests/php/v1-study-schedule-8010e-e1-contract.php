<?php
/** Pure source-boundary assertions for isolated 8010E E1. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
$migrator_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';
$repository_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';
$week_schema_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
$migrator = file_get_contents( $migrator_path );
$repository = file_get_contents( $repository_path );
$week_schema = file_get_contents( $week_schema_path );

function v1_8010e_e1_contract_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

v1_8010e_e1_contract_expect( is_string( $migrator ) && is_string( $repository ) && is_string( $week_schema ), 'E1 source files are readable' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'run_week_generation' ), 'explicit generation-2 operator path exists' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, "'mmed_v1_8010d_'" ), 'generation 2 reuses the generation-1 lock namespace' );
v1_8010e_e1_contract_expect( false === strpos( $migrator, "'mmed_v1_8010e_'" ), 'generation 2 cannot introduce a competing lock namespace' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'v1_migration_unowned_table' ), 'unledgered exact tables fail closed' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'v1_week_existing_truth_upgrade_unsupported' ), 'unproved initialized generation-1 truth cannot be stranded' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY' ), 'reader uses one read-only consistent snapshot' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, "array( '2' )" ), 'repository advertises only reader 2' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, "'plan_corrupt'" ), 'reader has a content-free corruption outcome' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'hash_equals( $json, $plan[' ), 'reader requires exact canonical snapshot bytes' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'v1_reader_temporal_context_mismatch' ), 'reader binds Block temporal provenance to its Week' );
foreach ( array( 'add_action', 'add_filter', 'register_rest_route', 'get_option', 'update_option', 'set_transient', 'localStorage' ) as $forbidden ) {
	v1_8010e_e1_contract_expect( false === strpos( $repository, $forbidden . '(' ), 'isolated repository registers no runtime integration: ' . $forbidden );
}
v1_8010e_e1_contract_expect( 1 === preg_match( "/const PREVIOUS_READER_VERSION = null;/", $week_schema ), 'reader 1 remains unclaimed' );

echo "V1 Study Schedule 8010E E1 isolated source contract: ok\n";
