<?php
/** Pure source contract for the synthetic 8010E E3 restore census. */

function v1_8010e_e3_census_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$root = dirname( __DIR__, 2 );
$reader_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php';
$writer_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-command-repository.php';
$reader_source = file_get_contents( $reader_path );
$writer_source = file_get_contents( $writer_path );
v1_8010e_e3_census_expect( is_string( $reader_source ) && is_string( $writer_source ), 'restore census sources are readable' );

$class_start = strpos( $reader_source, 'final class MMED_V1_Study_Restore_Census' );
$class_end = strpos( $reader_source, '/** Read one complete Plan', $class_start );
v1_8010e_e3_census_expect( false !== $class_start && false !== $class_end && $class_end > $class_start, 'restore census descriptor class is bounded' );
$class_source = substr( $reader_source, $class_start, $class_end - $class_start );

$reasons = array(
	'v1_restore_relation_gate_generation',
	'v1_restore_relation_plan_generation',
	'v1_restore_relation_operation_plan',
	'v1_restore_relation_operation_generation',
	'v1_restore_relation_week_plan',
	'v1_restore_relation_block_week',
	'v1_restore_relation_plan_watermark_operation',
	'v1_restore_relation_plan_current_operation',
	'v1_restore_relation_operation_prior',
	'v1_restore_relation_operation_beyond_plan',
);
foreach ( $reasons as $reason ) {
	v1_8010e_e3_census_expect( 1 === substr_count( $class_source, "'reason' => '" . $reason . "'" ), 'restore census reason is declared exactly once: ' . $reason );
}
v1_8010e_e3_census_expect( 10 === substr_count( $class_source, 'SELECT 1 AS v1_restore_invalid' ), 'all ten restore probes select only a constant' );
v1_8010e_e3_census_expect( 10 === substr_count( $class_source, 'LIMIT 1' ), 'all ten restore probes bound returned rows' );
v1_8010e_e3_census_expect( false === stripos( $class_source, 'COUNT(' ), 'restore probes expose no counts' );
v1_8010e_e3_census_expect( false === stripos( $class_source, 'FOR UPDATE' ), 'restore probes take no Plan/domain locks' );
v1_8010e_e3_census_expect( false === stripos( $class_source, 'LOCK IN SHARE MODE' ), 'restore probes do not introduce shared row locks' );

$reader_method = strpos( $reader_source, 'private function read_plan( $owner_id )' );
$reader_census = strpos( $reader_source, '$this->assert_owner_restore_census( $owner_id );', $reader_method );
$reader_plan = strpos( $reader_source, 'MMED_V1_Study_Schema::table_names', $reader_method );
v1_8010e_e3_census_expect( false !== $reader_method && false !== $reader_census && false !== $reader_plan && $reader_census < $reader_plan, 'owner census is the first current-reader statement inside the snapshot callback' );

$writer_control = strpos( $writer_source, '$this->hit( \'after_control_lock\' );' );
$writer_census = strpos( $writer_source, '$this->assert_owner_restore_census( $owner_id );', $writer_control );
$writer_plan = strpos( $writer_source, '$this->insert_or_existing_plan( $owner_id, $placeholder_at );', $writer_control );
v1_8010e_e3_census_expect( false !== $writer_control && false !== $writer_census && false !== $writer_plan && $writer_control < $writer_census && $writer_census < $writer_plan, 'writer owner census runs after control and before Plan DML' );
$writer_method = strpos( $writer_source, 'private function assert_owner_restore_census( $owner_id )' );
$writer_method_end = strpos( $writer_source, '/** @return void */', $writer_method );
v1_8010e_e3_census_expect( false !== $writer_method && false !== $writer_method_end && $writer_method_end > $writer_method, 'writer census method is bounded' );
$writer_method_source = substr( $writer_source, $writer_method, $writer_method_end - $writer_method );
v1_8010e_e3_census_expect( false !== strpos( $writer_method_source, "MMED_V1_Study_Command_Exception( 'dependency_unavailable' )" ), 'writer census collapses private relation reasons to dependency unavailable' );
v1_8010e_e3_census_expect( false !== strpos( $reader_source, '$this->failure( \'plan_corrupt\' )' ), 'reader census collapses private relation reasons to plan corrupt' );
v1_8010e_e3_census_expect( false !== strpos( $reader_source, 'private function restore_control_relation_ready()' ), 'provenance retains only the constant-size gate relation' );
v1_8010e_e3_census_expect( false !== strpos( $reader_source, '$descriptor = array_shift( $descriptors );' ), 'provenance does not execute the full global census' );
v1_8010e_e3_census_expect( false !== strpos( $reader_source, '! $this->restore_control_relation_ready()' ), 'physical provenance calls the bounded gate relation' );
v1_8010e_e3_census_expect( false !== strpos( $class_source, 'o.expected_revision <> o.revision - 1' ), 'operation chain rejects non-adjacent restored revisions' );
v1_8010e_e3_census_expect( false !== strpos( $class_source, 'o.committed_at = p.updated_at' ), 'current operation binds the exact Plan commit timestamp' );

echo "V1 Study Schedule 8010E E3 restore census source contract: ok\n";
