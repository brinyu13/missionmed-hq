<?php
defined( 'ABSPATH' ) || exit;

$live      = WP_CONTENT_DIR . '/mu-plugins/missionmed-drj-examprep-commerce.php';
$candidate = '/tmp/missionmed-drj-examprep-commerce-0921c.php';
$expected  = 'c86e7bb9210381a1e7a541fc94bb8018d146d38de8ad1c072a379fa8f7f8c388';
if ( ! is_file( $live ) || hash_file( 'sha256', $live ) !== $expected ) {
	throw new RuntimeException( 'Add-on fix preimage hash mismatch.' );
}
if ( ! is_file( $candidate ) ) {
	throw new RuntimeException( 'Add-on fix candidate missing.' );
}
$backup = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0921C/missionmed-drj-examprep-commerce-pre-live-selector-fix.php';
copy( $live, $backup );
chmod( $backup, 0600 );
if ( ! copy( $candidate, $live ) ) {
	throw new RuntimeException( 'Could not install add-on fix.' );
}
chmod( $live, 0644 );
wp_cache_flush();
echo wp_json_encode( array( 'deployed' => true, 'backup' => $backup, 'sha256' => hash_file( 'sha256', $live ), 'money_moved_cents' => 0 ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
