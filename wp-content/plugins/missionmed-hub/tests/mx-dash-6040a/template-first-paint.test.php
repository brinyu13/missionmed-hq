<?php
/** MX-DASH-6040A server-rendered first-paint contract. */

define( 'ABSPATH', __DIR__ );

$experience = 'matrix2';
foreach ( $argv as $argument ) {
	if ( 0 === strpos( $argument, '--render=' ) ) {
		$experience = substr( $argument, 9 );
	}
}

function wp_get_current_user() { return (object) array( 'ID' => 6040 ); }
function rest_url( $path ) { return 'https://example.test/wp-json/' . $path; }
function wp_create_nonce() { return 'test-nonce'; }
function esc_attr( $value ) { return htmlspecialchars( (string) $value, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $value ) { return esc_attr( $value ); }
function esc_attr__( $value ) { return $value; }
function esc_html__( $value ) { return $value; }
function wp_json_encode( $value ) { return json_encode( $value ); }

class MMED_Student_OS {
	public static function get_initial_data() { return array( 'student' => array( 'first_name' => 'QA' ) ); }
}

class MMED_Dashboard_Experience {
	public static $experience = 'matrix2';
	public static function resolve() { return self::$experience; }
}

MMED_Dashboard_Experience::$experience = $experience;
ob_start();
require dirname( __DIR__, 2 ) . '/templates/student-os-shell.php';
$html = ob_get_clean();

if ( in_array( '--html', $argv, true ) ) {
	echo $html;
	exit( 0 );
}

$checks = array(
	'matrix2 experience marker' => false !== strpos( $html, 'data-dashboard-experience="' . $experience . '"' ),
	'no product network call'   => 0 === preg_match( '/\b(fetch|XMLHttpRequest)\s*\(/', $html ),
);

if ( 'matrix2' === $experience ) {
	$checks['pending guard'] = false !== strpos( $html, 'data-dashboard-first-paint="pending"' );
	$checks['branded shell'] = false !== strpos( $html, 'MissionMed Matrix 2.0' );
	$checks['ready release'] = false !== strpos( $html, "classList.contains('mmdv2-active')" );
	$checks['failure recovery'] = false !== strpos( $html, 'data-dashboard-v2-failed' ) && false !== strpos( $html, '8000' );
} else {
	$checks['classic immediate'] = false === strpos( $html, 'data-dashboard-first-paint="pending"' );
	$checks['no matrix2 shell']  = false === strpos( $html, 'mmed-matrix2-first-paint-guard' );
}

$failed = array_keys( array_filter( $checks, function ( $passed ) { return ! $passed; } ) );
if ( $failed ) {
	fwrite( STDERR, 'FAIL: ' . implode( ', ', $failed ) . PHP_EOL );
	exit( 1 );
}

echo 'PASS ' . $experience . ': ' . implode( ', ', array_keys( $checks ) ) . PHP_EOL;
