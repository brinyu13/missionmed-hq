<?php
/** Pure source-boundary assertions for isolated 8010E E1. */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

$root = dirname( __DIR__, 2 );
$migrator_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-migrator.php';
$repository_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';
$week_schema_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';
$week_domain_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-domain.php';
$worker_path = $root . '/tests/php/v1-study-schedule-8010e-e1-worker.php';
$process_path = $root . '/tests/php/v1-study-schedule-8010e-e1-process.php';
$migrator = file_get_contents( $migrator_path );
$repository = file_get_contents( $repository_path );
$week_schema = file_get_contents( $week_schema_path );
$week_domain = file_get_contents( $week_domain_path );
$worker = file_get_contents( $worker_path );
$process = file_get_contents( $process_path );

function v1_8010e_e1_contract_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

v1_8010e_e1_contract_expect( is_string( $migrator ) && is_string( $repository ) && is_string( $week_schema ) && is_string( $week_domain ) && is_string( $worker ) && is_string( $process ), 'E1 source and physical-proof files are readable' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'run_week_generation' ), 'explicit generation-2 operator path exists' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, "'mmed_v1_8010d_'" ), 'generation 2 reuses the generation-1 lock namespace' );
v1_8010e_e1_contract_expect( false === strpos( $migrator, "'mmed_v1_8010e_'" ), 'generation 2 cannot introduce a competing lock namespace' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'v1_migration_unowned_table' ), 'unledgered exact tables fail closed' );
v1_8010e_e1_contract_expect( false !== strpos( $migrator, 'v1_week_existing_truth_upgrade_unsupported' ), 'unproved initialized generation-1 truth cannot be stranded' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY' ), 'reader uses one read-only consistent snapshot' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'native_transaction_probe' ) && false !== strpos( $repository, "'42000'" ), 'reader positively probes caller transaction state on both supported engines' );
v1_8010e_e1_contract_expect( false === strpos( $repository, '@@SESSION.in_transaction' ), 'reader does not depend on MariaDB-only transaction instrumentation' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, "array( '2' )" ), 'repository advertises only reader 2' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, "'plan_corrupt'" ), 'reader has a content-free corruption outcome' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'hash_equals( $json, $plan[' ), 'reader requires exact canonical snapshot bytes' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'v1_reader_temporal_context_mismatch' ), 'reader binds Block temporal provenance to its Week' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'assert_current_receipt' ) && false !== strpos( $repository, "'1' === \$revision" ), 'reader proves immutable watermark and distinct current receipt roles' );
v1_8010e_e1_contract_expect( false === strpos( $repository, 'private $provenance' ) && false === strpos( $repository, '$this->provenance' ), 'physical provenance cannot retain stale positive cache' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'generation_count' ) && false !== strpos( $repository, 'runner_hex' ) && false !== strpos( $repository, 'owned_table_set_ready' ), 'provenance verifies exact controls, ledger identity, and owned table set' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'const MAX_WEEKS_PER_PLAN = 260;' ) && false !== strpos( $repository, 'const MAX_BLOCKS_PER_PLAN = 4096;' ), 'normalized reader row budgets are explicit and governed' );
v1_8010e_e1_contract_expect( false !== strpos( $repository, 'v1_reader_week_limit_exceeded' ) && false !== strpos( $repository, 'v1_reader_block_limit_exceeded' ), 'over-budget normalized truth fails closed before projection' );
v1_8010e_e1_contract_expect( false !== strpos( $week_domain, 'usort(' ) && false !== strpos( $week_domain, '$active_end' ), 'collision verification is ordered rather than quadratic' );
v1_8010e_e1_contract_expect( false !== strpos( $worker, 'READY reader_after_plan' ) && false !== strpos( $worker, 'writer-v3' ), 'two-connection worker exposes the exact snapshot-tear barrier and atomic writer' );
v1_8010e_e1_contract_expect( false !== strpos( $process, 'held reader returns the complete old revision' ) && false !== strpos( $process, 'fresh reader returns the complete new revision' ), 'process proof requires both sides of one concurrent revision transition' );
foreach ( array( 'add_action', 'add_filter', 'register_rest_route', 'get_option', 'update_option', 'set_transient', 'localStorage' ) as $forbidden ) {
	v1_8010e_e1_contract_expect( false === strpos( $repository, $forbidden . '(' ), 'isolated repository registers no runtime integration: ' . $forbidden );
}
v1_8010e_e1_contract_expect( 1 === preg_match( "/const PREVIOUS_READER_VERSION = null;/", $week_schema ), 'reader 1 remains unclaimed' );

echo "V1 Study Schedule 8010E E1 isolated source contract: ok\n";
