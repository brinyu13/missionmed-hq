<?php
/**
 * Exact V1 fallback lock checks for J1-FileVault-1002.
 */

$root = dirname( __DIR__ );
$files = array(
	'wp-content/plugins/missionmed-hub/assets/student-os.js' => 'c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a',
	'wp-content/plugins/missionmed-hub/assets/student-os.c1d97237eab4936d.js' => 'c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a',
	'wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php' => '2e2a282d05ac876c658b0c5717e4412989b362ce63cc0731f7f97f8187126b16',
	'wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js' => 'f1639c41d32ffe74d6d2712c93a321abd67c36ef12adb75b36061b2b39331edd',
	'wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css' => '6daeaf25071f0850dbedfd522e9f0819f46fcf0e5c7a8ffc5ad3abba73ef0990',
);

$checks = 0;
function fv2_v1_assert( $condition, $message ) {
	global $checks;
	++$checks;
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: {$message}\n" );
		exit( 1 );
	}
}

foreach ( $files as $path => $expected ) {
	$absolute = $root . '/' . $path;
	fv2_v1_assert( is_file( $absolute ), "locked V1 file exists: {$path}" );
	fv2_v1_assert( $expected === hash_file( 'sha256', $absolute ), "locked V1 hash matches: {$path}" );
}

$rest = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php' );
$contracts = array(
	"'/files'" => "'callback'            => array( __CLASS__, 'get_files' )",
	"'/files/upload-url'" => "'callback'            => array( __CLASS__, 'get_file_upload_url' )",
	"'/files/(?P<id>\\d+)/download'" => "'callback'            => array( __CLASS__, 'get_file_download' )",
	"'/files/(?P<id>\\d+)/confirm'" => "'callback'            => array( __CLASS__, 'confirm_file_upload' )",
);
foreach ( $contracts as $route => $callback ) {
	fv2_v1_assert( false !== strpos( $rest, $route ), "V1 route remains registered: {$route}" );
	fv2_v1_assert( false !== strpos( $rest, $callback ), "V1 callback remains registered for {$route}" );
}

fv2_v1_assert( 1 === substr_count( $rest, "'/files/upload-url'" ), 'V1 upload route is registered once' );
fv2_v1_assert( 1 === substr_count( $rest, "'/files/(?P<id>\\d+)/download'" ), 'V1 download route is registered once' );
fv2_v1_assert( 1 === substr_count( $rest, "'/files/(?P<id>\\d+)/confirm'" ), 'V1 confirm route is registered once' );

$v1_repository = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault.php' );
fv2_v1_assert( false !== strpos( $v1_repository, 'mmed_file_vault_v2_confirm_required' ), 'V1 confirm cannot rewrite V2-managed rows' );
fv2_v1_assert( false !== strpos( $v1_repository, 'ready_clean' ), 'V1 compatibility download requires V2 verification' );
fv2_v1_assert( false !== strpos( $v1_repository, '$expires = 60' ), 'V1 compatibility download uses the V2 short expiry' );
fv2_v1_assert( false !== strpos( $v1_repository, 'record_compatibility_download' ), 'V1 compatibility download records an operational event' );
fv2_v1_assert( false !== strpos( $v1_repository, "'needs_changes', 'reviewed', 'final'" ), 'V1 response projects V2 workflow status for rollback truth' );
fv2_v1_assert( false !== strpos( $v1_repository, 'mmed_file_vault_v2_upload_required' ) && false !== strpos( $v1_repository, 'is_user_eligible' ), 'V1 upload issuance is unavailable to accounts actively routed to V2' );
fv2_v1_assert( false !== strpos( $v1_repository, 'mmed_file_vault_v1_bounded_upload_unavailable' ) && false !== strpos( $v1_repository, 'mmed_file_vault_v1_bounded_confirm_unavailable' ), 'unbounded V1 PUT issuance and client-trusted confirmation fail closed without a verified server adapter' );
fv2_v1_assert( false === strpos( $v1_repository, "self::presign_url( 'PUT'" ), 'V1 fallback does not issue an unrestricted direct PUT URL' );
fv2_v1_assert( false === strpos( $v1_repository, "apply_filters( 'mmed_file_vault_v1_bounded" ), 'no unenforced V1 adapter hook can bypass the fail-closed upload boundary' );

echo "PASS: {$checks} File Vault V1 fallback lock checks\n";
