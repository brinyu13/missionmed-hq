<?php
/** Standalone DR-327 access-gate regression. */
define( 'ABSPATH', __DIR__ . '/' );

$mmps_options = array(
	'mmed_ps_proto_mode'           => 'off',
	'mmed_ps_proto_allow_user_ids' => array(),
	'mmed_ps_proto_allow_admins'   => '0',
);
$mmps_user_id = 0;
$mmps_admins  = array();
$mmps_claim   = null;
$mmps_throw   = false;

function get_option( $key, $default = false ) {
	global $mmps_options;
	return array_key_exists( $key, $mmps_options ) ? $mmps_options[ $key ] : $default;
}
function get_current_user_id() {
	global $mmps_user_id;
	return $mmps_user_id;
}
function absint( $value ) { return abs( (int) $value ); }
function user_can( $user_id, $capability ) {
	global $mmps_admins;
	return 'manage_options' === $capability && ! empty( $mmps_admins[ (int) $user_id ] );
}
function sanitize_key( $value ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ); }
function mmhq_cam_build_entitlement( $user_id ) {
	global $mmps_claim, $mmps_throw;
	if ( $mmps_throw ) {
		throw new RuntimeException( 'fixture failure' );
	}
	return $mmps_claim;
}

require dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-gate.php';

$pass = 0;
$fail = 0;
function check_gate( $condition, $name ) {
	global $pass, $fail;
	if ( $condition ) {
		++$pass;
		echo "PASS $name\n";
	} else {
		++$fail;
		echo "FAIL $name\n";
	}
}
function valid_claim( $mode = 'learndash_and_woocommerce' ) {
	$purchase = 'learndash_and_woocommerce' === $mode;
	return array(
		'active'                  => true,
		'status'                  => 'active',
		'verified'                => true,
		'trusted'                 => true,
		'current_access_verified' => true,
		'purchase_verified'       => $purchase,
		'purchase_match_found'    => $purchase,
		'enrollment_verified'     => true,
		'authority_mode'          => $mode,
		'revocation_checked'      => true,
		'restricted'              => false,
		'revoked'                 => false,
		'expires_at'              => gmdate( 'c', time() + 3600 ),
	);
}

$mmps_user_id = 20;
$mmps_claim   = valid_claim();
check_gate( ! MMPS_Gate::user_allowed(), 'off denies a valid member' );
check_gate( ! MMPS_Gate::user_allowed( 0 ), 'anonymous access fails closed' );

$mmps_options['mmed_ps_proto_mode'] = 'allowlist';
check_gate( ! MMPS_Gate::user_allowed(), 'allowlist mode still denies an unlisted member' );
$mmps_options['mmed_ps_proto_allow_user_ids'] = array( 20 );
check_gate( MMPS_Gate::user_allowed(), 'explicit canary allowlist remains valid' );
$mmps_options['mmed_ps_proto_allow_user_ids'] = array();

$mmps_options['mmed_ps_proto_mode'] = 'members';
$mmps_admins[30] = true;
check_gate( MMPS_Gate::user_allowed( 30 ), 'members mode admits manage_options administrator' );
check_gate( MMPS_Gate::user_allowed( 20 ), 'members mode admits verified purchase-backed current 360 member' );
$mmps_claim = valid_claim( 'learndash_current_access' );
check_gate( MMPS_Gate::user_allowed( 20 ), 'members mode admits verified legacy-current 360 member' );

$invalid = array(
	'non-array claim'       => null,
	'inactive'              => array_merge( valid_claim(), array( 'active' => false ) ),
	'wrong status'          => array_merge( valid_claim(), array( 'status' => 'refunded' ) ),
	'unverified'            => array_merge( valid_claim(), array( 'verified' => false ) ),
	'untrusted'             => array_merge( valid_claim(), array( 'trusted' => false ) ),
	'not current'           => array_merge( valid_claim(), array( 'current_access_verified' => false ) ),
	'not enrollment-backed' => array_merge( valid_claim(), array( 'enrollment_verified' => false ) ),
	'wrong authority mode'  => array_merge( valid_claim(), array( 'authority_mode' => 'role_only' ) ),
	'not revocation-checked'=> array_merge( valid_claim(), array( 'revocation_checked' => false ) ),
	'restricted'            => array_merge( valid_claim(), array( 'restricted' => true ) ),
	'revoked'               => array_merge( valid_claim(), array( 'revoked' => true ) ),
	'expired'               => array_merge( valid_claim(), array( 'expires_at' => gmdate( 'c', time() - 60 ) ) ),
	'malformed expiry'      => array_merge( valid_claim(), array( 'expires_at' => 'not-a-date' ) ),
);
foreach ( $invalid as $name => $claim ) {
	$mmps_claim = $claim;
	check_gate( ! MMPS_Gate::user_allowed( 20 ), $name . ' fails closed' );
}
$mmps_claim = valid_claim();
$mmps_throw = true;
check_gate( ! MMPS_Gate::user_allowed( 20 ), 'entitlement exception fails closed' );
$mmps_throw = false;

$entry = file_get_contents( dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/assets/mmps-entry.js' );
check_gate( false !== strpos( $entry, '.sos-nav-list' ) && false !== strpos( $entry, '.sos-nav-link[href="#filevault"]' ), 'menu mounts through stable Matrix selectors' );
check_gate( false !== strpos( $entry, "label.textContent = 'Program-Specific PS'" ) && false !== strpos( $entry, "link.href = cfg.url" ), 'menu label and direct PSV URL are explicit' );
check_gate( false !== strpos( $entry, 'data-mmps-menu' ) && false !== strpos( $entry, 'menuMounted()' ), 'menu insertion is idempotent' );

echo "RESULT $pass passed, $fail failed\n";
exit( $fail ? 1 : 0 );
