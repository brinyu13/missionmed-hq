<?php
/* Focused native request and snippet isolation checks for DR-450. */
define( 'ABSPATH', __DIR__ );
define( 'LOGGED_IN_COOKIE', 'test_logged_in_cookie' );
$filters = array();
$state = array( 'admin' => false, 'ajax' => false, 'page' => true, 'cookie_user' => 12, 'user' => 12 );

function add_filter( $name, $callback, $priority, $args ) {
	global $filters;
	$filters[ $name ] = $callback;
}
function is_admin() {
	global $state;
	return $state['admin'];
}
function wp_doing_ajax() {
	global $state;
	return $state['ajax'];
}
function is_page( $id ) {
	global $state;
	return 4243 === $id && $state['page'];
}
function wp_parse_url( $uri, $component ) {
	return parse_url( $uri, $component );
}
function wp_validate_auth_cookie( $cookie, $scheme ) {
	global $state;
	return 'logged_in' === $scheme && 'valid' === $cookie ? $state['cookie_user'] : false;
}
function get_current_user_id() {
	global $state;
	return $state['user'];
}
function check_header( $label, $expect_excluded ) {
	global $filters;
	$snippet = new class {
		public function get_id() { return 6023; }
	};
	$output = $filters['wpcode_snippet_output']( '<header>website</header>', $snippet );
	$astra = $filters['astra_header_display']( 'enabled' );
	if ( $expect_excluded !== ( '' === $output && 'disabled' === $astra ) ) {
		throw new RuntimeException( $label . ': unexpected header condition' );
	}
	if ( ! $expect_excluded && ( '<header>website</header>' !== $output || 'enabled' !== $astra ) ) {
		throw new RuntimeException( $label . ': original filter values changed' );
	}
}

require __DIR__ . '/../../../../mu-plugins/missionmed-matrix-website-header.php';
$_SERVER['REQUEST_URI'] = '/member-dashboard/?app=calendar';
$_COOKIE[ LOGGED_IN_COOKIE ] = 'valid';
check_header( 'authenticated canonical Matrix', true );

$snippet = new class {
	public function get_id() { return 6024; }
};
if ( 'other' !== $filters['wpcode_snippet_output']( 'other', $snippet ) ) {
	throw new RuntimeException( 'other WPCode snippet changed' );
}
if ( 'missing' !== $filters['wpcode_snippet_output']( 'missing', null ) ) {
	throw new RuntimeException( 'missing snippet changed' );
}

foreach ( array( '/member-dashboard', '/member-dashboard/#calendar' ) as $uri ) {
	$_SERVER['REQUEST_URI'] = $uri;
	check_header( 'canonical path ' . $uri, true );
}
foreach ( array( '/', '/about/', '/member-dashboard-extra/', '/member-dashboard%2F' ) as $uri ) {
	$_SERVER['REQUEST_URI'] = $uri;
	check_header( 'public or noncanonical path ' . $uri, false );
}
$_SERVER['REQUEST_URI'] = '/member-dashboard/';
foreach ( array( 'admin', 'ajax' ) as $key ) {
	$state[ $key ] = true;
	check_header( $key, false );
	$state[ $key ] = false;
}
$state['page'] = false;
check_header( 'other WordPress page', false );
$state['page'] = true;
$state['cookie_user'] = 14;
check_header( 'different cookie principal', false );
$state['cookie_user'] = 12;
$_COOKIE[ LOGGED_IN_COOKIE ] = 'invalid';
check_header( 'invalid cookie', false );
unset( $_COOKIE[ LOGGED_IN_COOKIE ] );
check_header( 'anonymous request', false );

echo "PASS Matrix website header request isolation\n";
