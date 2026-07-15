<?php
/** Pure source contract for the unbound E3 shared-owner arbiter slice. */

function v1_8010e_e3_arbiter_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$root = dirname( __DIR__, 2 );
$service_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-command-service.php';
$repository_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-command-repository.php';
$arbiter_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-owner-arbiter.php';
$boot_path = $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php';
$loader_path = $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-loader.php';
$worker_path = $root . '/tests/php/v1-study-schedule-8010e-e3-owner-arbiter-worker.php';
$process_path = $root . '/tests/php/v1-study-schedule-8010e-e3-owner-arbiter-process.php';

foreach ( array( $service_path, $repository_path, $arbiter_path, $boot_path, $loader_path, $worker_path, $process_path ) as $path ) {
	v1_8010e_e3_arbiter_expect( is_file( $path ), 'required E3 arbiter source exists: ' . basename( $path ) );
}

$service = file_get_contents( $service_path );
$repository = file_get_contents( $repository_path );
$arbiter = file_get_contents( $arbiter_path );
$boot = file_get_contents( $boot_path );
$loader = file_get_contents( $loader_path );
$worker = file_get_contents( $worker_path );
$process = file_get_contents( $process_path );
foreach ( compact( 'service', 'repository', 'arbiter', 'boot', 'loader', 'worker', 'process' ) as $name => $source ) {
	v1_8010e_e3_arbiter_expect( is_string( $source ) && '' !== $source, 'E3 source is readable: ' . $name );
}

v1_8010e_e3_arbiter_expect(
	false !== strpos( $service, "const SCOPE_SYNTHETIC_SHARED_OWNER = 'synthetic-isolated-e3-shared-owner';" )
	&& false !== strpos( $service, 'interface MMED_V1_Study_Shared_Owner_Arbiter extends MMED_V1_Study_Command_Fence' )
	&& false !== strpos( $service, 'public function locked_authority();' )
	&& false !== strpos( $service, 'public function locked_calendar_snapshot();' ),
	'E3 uses a distinct typed interface without weakening the E2 fence'
);
v1_8010e_e3_arbiter_expect(
	false !== strpos( $repository, 'MMED_V1_Study_Command_Fence::SCOPE_SYNTHETIC_ISOLATED === $fence_scope' )
	&& false !== strpos( $repository, 'MMED_V1_Study_Shared_Owner_Arbiter::SCOPE_SYNTHETIC_SHARED_OWNER === $fence_scope' )
	&& false !== strpos( $repository, '$fence instanceof MMED_V1_Study_Shared_Owner_Arbiter' ),
	'E2 remains accepted while E3 requires the exact typed interface'
);
v1_8010e_e3_arbiter_expect(
	false !== strpos( $repository, '$this->assert_shared_owner_authority( $owner_id );' )
	&& false !== strpos( $repository, '$this->assert_shared_owner_calendar_empty( $owner_id' )
	&& false !== strpos( $repository, "throw new MMED_V1_Study_Command_Exception( 'legacy_import_required' );" ),
	'physical writer consumes typed locks and refuses fictional legacy import'
);

foreach ( array( 'add_action', 'add_filter', 'register_rest_route', 'update_option', 'add_option', 'dbDelta', 'WP_CLI', 'register_activation_hook' ) as $forbidden ) {
	v1_8010e_e3_arbiter_expect( false === strpos( $arbiter, $forbidden ), 'unbound arbiter contains no runtime/installer token: ' . $forbidden );
}
v1_8010e_e3_arbiter_expect(
	false === strpos( $boot, 'class-mmed-v1-study-owner-arbiter.php' )
	&& false === strpos( $loader, 'class-mmed-v1-study-owner-arbiter.php' )
	&& false === strpos( $boot, 'MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter' )
	&& false === strpos( $loader, 'MMED_V1_Study_Synthetic_InnoDB_Owner_Arbiter' ),
	'arbiter remains absent from plugin boot and V1 loader'
);

v1_8010e_e3_arbiter_expect( false === stripos( $arbiter, 'INSERT IGNORE' ), 'owner mutex never uses INSERT IGNORE' );
foreach (
	array(
		'START TRANSACTION READ WRITE',
		'LOCK IN SHARE MODE',
		'ORDER BY option_name',
		'insert_or_existing_plan',
		'LIMIT 2 FOR UPDATE',
		'ORDER BY id LIMIT',
		'COMMIT AND NO CHAIN NO RELEASE',
		'ROLLBACK AND NO CHAIN NO RELEASE',
		'user_id = %d AND event_type = %s',
		"array( 'user_id', 'event_type', 'id' )",
		'assert_no_temporary_table_shadows',
	) as $required
) {
	v1_8010e_e3_arbiter_expect( false !== strpos( $arbiter, $required ), 'arbiter source contains exact lock/safety token: ' . $required );
}
$gate_position = strpos( $arbiter, '$this->locked_store_id = $this->lock_store_gate();' );
$control_position = strpos( $arbiter, '$this->lock_control_records( self::PATH_LEGACY, $owner_id );' );
$plan_position = strpos( $arbiter, '$this->insert_or_existing_plan( $owner_id, $now );' );
$calendar_position = strpos( $arbiter, '$this->lock_calendar_set( $owner_id, $plan );', $plan_position );
v1_8010e_e3_arbiter_expect(
	false !== $gate_position && false !== $control_position && false !== $plan_position && false !== $calendar_position
	&& $gate_position < $control_position && $control_position < $plan_position && $plan_position < $calendar_position,
	'legacy transaction follows gate then control then Plan then Calendar lock order'
);
v1_8010e_e3_arbiter_expect(
	false !== strpos( $arbiter, "if ( 'create' === \$action )" )
	&& false !== strpos( $arbiter, "if ( 'update' === \$action )" )
	&& false !== strpos( $arbiter, "if ( 'delete' === \$action )" )
	&& false === strpos( $arbiter, 'mutation_callback' ),
	'arbiter accepts exact intents and no arbitrary mutation callback'
);

foreach ( array( 'v1-first', 'legacy-first', 'different-owner', 'crash-before-commit', 'LOCK_WAIT', 'READY before_commit', 'READY after_calendar_write' ) as $token ) {
	v1_8010e_e3_arbiter_expect( false !== strpos( $worker . $process, $token ), 'two-process oracle contains governed scenario token: ' . $token );
}

echo "V1 Study Schedule 8010E E3 owner-arbiter source contract: ok\n";
