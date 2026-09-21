<?php
defined( 'ABSPATH' ) || exit;

$snippet_id        = 88;
$expected_name     = 'MM-USCE-POST-CHECKOUT-021 Premium Onboarding Thank You';
$success_stage     = '/tmp/missionmed-purchase-success.php';
$webhook_stage     = '/tmp/missionmed-stripe-webhook-router.php';
$success_target    = WP_CONTENT_DIR . '/mu-plugins/missionmed-purchase-success.php';
$webhook_target    = WP_CONTENT_DIR . '/mu-plugins/missionmed-stripe-webhook-router.php';
$backup_root       = dirname( ABSPATH ) . '/private/codex-backups/DRJ-EXAMPREP-0921C/' . gmdate( 'Ymd-His' );

global $wpdb;
$snippet = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}snippets WHERE id = %d", $snippet_id ), ARRAY_A );
if ( ! $snippet || $expected_name !== $snippet['name'] || 1 !== (int) $snippet['active'] ) {
	throw new RuntimeException( 'Expected active confirmation snippet preimage was not found.' );
}
foreach ( array( $success_stage, $webhook_stage ) as $stage ) {
	if ( ! is_file( $stage ) || ! is_readable( $stage ) ) {
		throw new RuntimeException( 'Staged source is missing: ' . $stage );
	}
	$output = array();
	$code   = 1;
	exec( escapeshellarg( PHP_BINARY ) . ' -l ' . escapeshellarg( $stage ) . ' 2>&1', $output, $code );
	if ( 0 !== $code ) {
		throw new RuntimeException( 'PHP lint failed: ' . implode( ' ', $output ) );
	}
}
if ( ! is_dir( $backup_root ) && ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create private backup directory.' );
}
chmod( $backup_root, 0700 );
file_put_contents( $backup_root . '/snippet-88-code.php', $snippet['code'], LOCK_EX );
file_put_contents( $backup_root . '/snippet-88-row.json', wp_json_encode( $snippet, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ), LOCK_EX );
chmod( $backup_root . '/snippet-88-code.php', 0600 );
chmod( $backup_root . '/snippet-88-row.json', 0600 );

$targets = array( $success_stage => $success_target, $webhook_stage => $webhook_target );
$installed = array();
foreach ( $targets as $stage => $target ) {
	if ( is_file( $target ) ) {
		copy( $target, $backup_root . '/' . basename( $target ) . '.preimage' );
		chmod( $backup_root . '/' . basename( $target ) . '.preimage', 0600 );
	}
	$temp = $target . '.codex-' . wp_generate_uuid4() . '.tmp';
	if ( ! copy( $stage, $temp ) ) {
		throw new RuntimeException( 'Could not copy staged source.' );
	}
	chmod( $temp, 0644 );
	if ( ! rename( $temp, $target ) ) {
		@unlink( $temp );
		throw new RuntimeException( 'Could not atomically install source.' );
	}
	$installed[ basename( $target ) ] = hash_file( 'sha256', $target );
}

$updated = $wpdb->update( $wpdb->prefix . 'snippets', array( 'active' => 0, 'modified' => current_time( 'mysql' ) ), array( 'id' => $snippet_id ), array( '%d', '%s' ), array( '%d' ) );
if ( false === $updated ) {
	throw new RuntimeException( 'Could not deactivate the legacy snippet.' );
}
wp_cache_flush();

echo wp_json_encode(
	array(
		'deployed'              => true,
		'legacy_snippet_active' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT active FROM {$wpdb->prefix}snippets WHERE id = %d", $snippet_id ) ),
		'installed'             => $installed,
		'backup_root'           => $backup_root,
		'money_moved_cents'     => 0,
	),
	JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . "\n";
