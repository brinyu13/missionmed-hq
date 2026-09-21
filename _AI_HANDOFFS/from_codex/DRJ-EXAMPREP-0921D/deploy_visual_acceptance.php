<?php
defined( 'ABSPATH' ) || exit;

$targets = array(
	'/tmp/missionmed-drj-examprep-commerce-0921d.php' => array(
		'path'     => WP_CONTENT_DIR . '/mu-plugins/missionmed-drj-examprep-commerce.php',
		'preimage' => '20ee76ee4afd188c6cbbbdb67acf3d32aa3d7f5aa1f03a87d434d11f446539eb',
		'expected' => '55e9f5e286aba25e1ee1d48db9dd2cdaa4affa3d15dd490815e3008f069d7e97',
	),
	'/tmp/missionmed-examprep-enrollment-0921d.php' => array(
		'path'     => WP_CONTENT_DIR . '/mu-plugins/missionmed-examprep-enrollment.php',
		'preimage' => 'a82769268d5b40f889973e997f2ba9771921fbfc34279c13fc644d5f008ef4c6',
		'expected' => 'a82769268d5b40f889973e997f2ba9771921fbfc34279c13fc644d5f008ef4c6',
	),
);

foreach ( $targets as $candidate => $config ) {
	if ( ! is_file( $candidate ) || $config['expected'] !== hash_file( 'sha256', $candidate ) ) {
		throw new RuntimeException( 'Candidate hash mismatch: ' . basename( $candidate ) );
	}
	if ( ! is_file( $config['path'] ) || $config['preimage'] !== hash_file( 'sha256', $config['path'] ) ) {
		throw new RuntimeException( 'Live preimage hash mismatch: ' . basename( $config['path'] ) );
	}
}

$backup_root = dirname( rtrim( ABSPATH, '/' ) ) . '/private/codex-backups/DRJ-EXAMPREP-0921D/' . gmdate( 'Ymd-His' ) . '-visual-acceptance';
if ( ! wp_mkdir_p( $backup_root ) ) {
	throw new RuntimeException( 'Could not create rollback directory.' );
}
chmod( $backup_root, 0700 );

foreach ( $targets as $candidate => $config ) {
	$backup = $backup_root . '/' . basename( $config['path'] );
	if ( ! copy( $config['path'], $backup ) ) {
		throw new RuntimeException( 'Could not create rollback preimage.' );
	}
	chmod( $backup, 0600 );
	if ( ! copy( $candidate, $config['path'] ) ) {
		throw new RuntimeException( 'Could not install candidate.' );
	}
	chmod( $config['path'], 0644 );
	if ( $config['expected'] !== hash_file( 'sha256', $config['path'] ) ) {
		throw new RuntimeException( 'Installed hash mismatch.' );
	}
}

foreach ( array( 5687, 3651, 6360, 9017 ) as $post_id ) {
	clean_post_cache( $post_id );
}
wp_cache_flush();
if ( function_exists( 'wpcode' ) && is_object( wpcode() ) && isset( wpcode()->cache ) ) {
	wpcode()->cache->cache_all_loaded_snippets();
}
if ( class_exists( '\\Elementor\\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
	\Elementor\Plugin::$instance->files_manager->clear_cache();
}

$result = array(
	'deployed'          => true,
	'backup_root'       => $backup_root,
	'commerce_sha256'   => hash_file( 'sha256', WP_CONTENT_DIR . '/mu-plugins/missionmed-drj-examprep-commerce.php' ),
	'enrollment_sha256' => hash_file( 'sha256', WP_CONTENT_DIR . '/mu-plugins/missionmed-examprep-enrollment.php' ),
	'money_moved_cents' => 0,
);
echo wp_json_encode( $result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
