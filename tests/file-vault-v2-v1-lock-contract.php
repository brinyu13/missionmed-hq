<?php
/**
 * Exact V1 fallback and current Matrix shell lock checks for J1-FileVault-1014.
 */

$root = dirname( __DIR__ );
$files = array(
	'wp-content/plugins/missionmed-hub/assets/student-os.js' => '809093d2b5b2bc05cdd4f355511f2c8d5303c71edbca4f71823d319976ced54f',
	'wp-content/plugins/missionmed-hub/assets/student-os.809093d2b5b2bc05.js' => '809093d2b5b2bc05cdd4f355511f2c8d5303c71edbca4f71823d319976ced54f',
	'wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php' => '70e7bae598a804f547425085e90e2b4e52d659c2c41755d124184619b92c29da',
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

$immutable_assets = array(
	'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.js' => array(
		'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.6214d981ea1494f3.js',
		'6214d981ea1494f3b0bb172a2a2f8f1142422a45591cf10799140291ece915d2',
	),
	'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.css' => array(
		'wp-content/plugins/missionmed-hub/assets/student-os-file-vault-v2.ea5100ed2573a88a.css',
		'ea5100ed2573a88a6b2318dfdb1e5651ee3618f107f236e333869d2cf199eee6',
	),
);
foreach ( $immutable_assets as $canonical => $lock ) {
	$canonical_path = $root . '/' . $canonical;
	$immutable_path = $root . '/' . $lock[0];
	$canonical_hash = hash_file( 'sha256', $canonical_path );
	fv2_v1_assert( is_file( $immutable_path ), "immutable V2 asset exists: {$lock[0]}" );
	fv2_v1_assert( $lock[1] === $canonical_hash, "canonical V2 asset matches approved release bytes: {$canonical}" );
	fv2_v1_assert( $canonical_hash === hash_file( 'sha256', $immutable_path ), "immutable V2 asset matches canonical source: {$lock[0]}" );
	fv2_v1_assert( false !== strpos( basename( $lock[0] ), substr( $canonical_hash, 0, 16 ) ), "immutable V2 filename matches its content hash: {$lock[0]}" );
}

$v2_controller = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-file-vault-v2.php' );
fv2_v1_assert( false !== strpos( $v2_controller, "const ASSET_JS          = 'student-os-file-vault-v2.6214d981ea1494f3.js';" ), 'V2 controller pins the immutable JavaScript asset' );
fv2_v1_assert( false !== strpos( $v2_controller, "const ASSET_CSS         = 'student-os-file-vault-v2.ea5100ed2573a88a.css';" ), 'V2 controller pins the immutable CSS asset' );
fv2_v1_assert( false === strpos( $v2_controller, 'filemtime( $js_path )' ) && false === strpos( $v2_controller, 'filemtime( $css_path )' ), 'immutable V2 assets do not depend on mutable filemtime cache keys' );

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
