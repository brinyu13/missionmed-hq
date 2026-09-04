<?php
error_reporting( E_ALL );

$GLOBALS['mmed_test_options'] = array(
	'mmed_course_360elite' => 3893,
	'mmed_course_complete' => 3646,
	'mmed_gate_enrolled_courses' => '3893,3646,5227,3848',
);
$GLOBALS['mmed_test_courses'] = array(
	1 => array(),
	2 => array( 3893 ),
	3 => array( 3646 ),
	4 => array(),
	5 => array( 5227 ),
	6 => array( 3893 ),
	7 => array(),
);
$GLOBALS['mmed_test_meta'] = array( 7 => array( '_mmed_matrix_allowed_modules' => array( 'ranklist' ) ) );

function absint( $value ) { return abs( (int) $value ); }
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function get_option( $key, $default = false ) { return $GLOBALS['mmed_test_options'][ $key ] ?? $default; }
function mmed_hub_default_option_value( $key ) { return 0; }
function get_user_meta( $user_id, $key, $single = false ) { return $GLOBALS['mmed_test_meta'][ $user_id ][ $key ] ?? ''; }
function user_can( $user_id, $capability ) { return 1 === (int) $user_id && 'manage_options' === $capability; }
function learndash_user_get_enrolled_courses( $user_id ) { return $GLOBALS['mmed_test_courses'][ $user_id ] ?? array(); }
function sfwd_lms_has_access( $course_id, $user_id ) { return in_array( (int) $course_id, $GLOBALS['mmed_test_courses'][ $user_id ] ?? array(), true ); }
function get_transient() { return false; }
function set_transient() { return true; }
function admin_url( $path = '' ) { return 'https://missionmedinstitute.com/wp-admin/' . ltrim( $path, '/' ); }
function add_query_arg( $key, $value = null, $url = null ) {
	$args = is_array( $key ) ? $key : array( $key => $value );
	$base = is_array( $key ) ? (string) $value : (string) $url;
	return $base . ( false === strpos( $base, '?' ) ? '?' : '&' ) . http_build_query( $args );
}
function esc_url_raw( $value ) { return (string) $value; }
function mm_drj_drills_access_user_is_restricted( $user_id = 0 ) { return 6 === (int) $user_id; }
function mm_drj_drills_access_config() { return array( 'locked_matrix_routes' => array( 'storyforge' ) ); }

if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ ); }
if ( ! defined( 'MINUTE_IN_SECONDS' ) ) { define( 'MINUTE_IN_SECONDS', 60 ); }
$plugin_root = getenv( 'MMED_6020A_PLUGIN_ROOT' );
$plugin_root = is_string( $plugin_root ) && '' !== $plugin_root ? $plugin_root : dirname( __DIR__, 2 );
require $plugin_root . '/includes/class-mmed-access-gate.php';

$checks = 0;
function expect_access( $user_id, $route, $expected, $label ) {
	global $checks;
	$checks++;
	$actual = MMED_Access_Gate::user_can_access_app( $user_id, $route );
	if ( $actual !== $expected ) {
		fwrite( STDERR, "FAIL: {$label}\n" );
		exit( 1 );
	}
}

foreach ( array( 'storyforge', 'lor', 'calendar', 'appointments', 'rise', 'dashboard', 'profile' ) as $route ) {
	expect_access( 4, $route, true, 'registered baseline ' . $route );
}
foreach ( array( 'homebase', 'scheduler', 'ivprep', 'ranklist', 'arena', 'filevault' ) as $route ) {
	expect_access( 4, $route, false, 'registered lock ' . $route );
}
foreach ( array( 1, 2, 3 ) as $user_id ) {
	foreach ( array( 'homebase', 'scheduler', 'ivprep', 'ranklist', 'arena', 'filevault', 'storyforge', 'lor', 'rise' ) as $route ) {
		expect_access( $user_id, $route, true, 'full persona ' . $user_id . ' ' . $route );
	}
	expect_access( $user_id, 'messages', false, 'globally unreleased remains locked' );
}
foreach ( array( 'scheduler', 'filevault', 'timeline', 'arena' ) as $route ) {
	expect_access( 5, $route, true, 'existing paid grant ' . $route );
}
expect_access( 5, 'ranklist', false, 'partial paid not over-granted' );
expect_access( 7, 'ranklist', true, 'per-user stronger grant preserved' );
expect_access( 6, 'storyforge', false, 'Dr J deny overlay' );
expect_access( 0, 'dashboard', false, 'anonymous dashboard denied' );

$lor = MMED_Access_Gate::get_app_access( 4, 'lor-studio' );
if ( 'LOR Studio' !== $lor['name'] || true !== $lor['allowed'] ) {
	fwrite( STDERR, "FAIL: canonical LOR Studio alias\n" );
	exit( 1 );
}

echo 'PASS ' . $checks . " entitlement assertions\n";
