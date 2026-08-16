<?php
/**
 * Local contract for the DR-111/112 Matrix IV Prep administrator launch.
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'MMED_HUB_PATH', dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/' );

$GLOBALS['mmed_test_admin_users'] = array( 1 );

function user_can( $user_id, $capability ) {
	return 'manage_options' === $capability
		&& in_array( (int) $user_id, $GLOBALS['mmed_test_admin_users'], true );
}

function esc_url_raw( $value ) {
	return (string) $value;
}

function apply_filters( $hook, $value ) {
	return $value;
}

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php';

function mmed_private_static( $method, array $args ) {
	$reflection = new ReflectionMethod( 'MMED_Student_OS', $method );
	return $reflection->invokeArgs( null, $args );
}

function mmed_assert( $condition, $message ) {
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

$admin_access = mmed_private_static( 'add_ivprep_access_payload', array( array(), 1 ) );
$admin_url    = $admin_access['ivprep']['launch_url'] ?? '';
$admin_parts  = parse_url( $admin_url );
parse_str( (string) ( $admin_parts['query'] ?? '' ), $admin_query );

mmed_assert( true === $admin_access['module_permissions']['ivprep'], 'administrator permission must be enabled' );
mmed_assert( 'missionmed-hq-production.up.railway.app' === ( $admin_parts['host'] ?? '' ), 'handoff host must be exact' );
mmed_assert( '/api/auth/start' === ( $admin_parts['path'] ?? '' ), 'handoff path must be exact' );
mmed_assert( array( 'final' ) === array_keys( $admin_query ), 'handoff query must contain only final' );
mmed_assert( 'https://missionmed-hq-production.up.railway.app/iv-prep-on-call/' === $admin_query['final'], 'final target must be exact' );

$admin_modules = mmed_private_static( 'get_active_modules', array( 1, $admin_access ) );
$ivprep_modules = array_values(
	array_filter(
		$admin_modules,
		static function ( $module ) {
			return 'ivprep' === ( $module['route'] ?? '' );
		}
	)
);
mmed_assert( 1 === count( $ivprep_modules ), 'administrator must receive one IV Prep module' );
mmed_assert( 'IV Prep On-Call' === $ivprep_modules[0]['label'], 'visible label must be exact' );

$student_access  = mmed_private_static( 'add_ivprep_access_payload', array( array(), 2 ) );
$student_modules = mmed_private_static( 'get_active_modules', array( 2, $student_access ) );
mmed_assert( false === $student_access['module_permissions']['ivprep'], 'student permission must remain denied' );
mmed_assert( '' === $student_access['ivprep']['launch_url'], 'student payload must not expose the handoff URL' );
mmed_assert(
	0 === count(
		array_filter(
			$student_modules,
			static function ( $module ) {
				return 'ivprep' === ( $module['route'] ?? '' );
			}
		)
	),
	'student module registry must omit IV Prep'
);

$handoff_source = file_get_contents( dirname( __DIR__, 2 ) . '/wp-content/mu-plugins/missionmed-hq-auth-handoff.php' );
mmed_assert( is_string( $handoff_source ), 'handoff source must be readable' );
mmed_assert(
	false !== strpos( $handoff_source, "'missionmed-hq-production.up.railway.app'" ),
	'exact HQ host must be in the final-host allowlist'
);
mmed_assert(
	false !== strpos( $handoff_source, 'function mmhq_handoff_requested_final($final_raw, $return_to)' ),
	'handoff must expose the bounded nested-final compatibility helper'
);
mmed_assert(
	false !== strpos( $handoff_source, 'if (!mmhq_handoff_is_allowed_return_url($return_to))' ),
	'nested final extraction must fail closed before parsing return_to'
);
mmed_assert(
	false !== strpos( $handoff_source, '$final_raw = mmhq_handoff_requested_final($final_raw, $return_to);' ),
	'handler must normalize the bounded nested final before signing'
);

echo "PASS: Matrix IV Prep admin launch and nested HQ final are exact; student access remains denied.\n";
