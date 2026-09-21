<?php
/**
 * Plugin Name: MissionMed Hub harness stub
 * Description: Fictional local-only File Vault surface for PSV integration tests.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMED_File_Vault {
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_file_vault_stub';
	}

	public static function maybe_install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( 'CREATE TABLE ' . self::table_name() . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			name varchar(255) NOT NULL DEFAULT '',
			meta longtext NOT NULL,
			PRIMARY KEY  (id),
			KEY user_id (user_id)
		) " . $wpdb->get_charset_collate() . ';' );
	}
}

class MMED_File_Vault_V2_Repository extends MMED_File_Vault {
	public static function list_documents( $user_id ) {
		global $wpdb;
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . parent::table_name() . ' WHERE user_id = %d ORDER BY id DESC', absint( $user_id ) ) );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$meta  = static::meta_for_row( $row );
			$out[] = array(
				'id'            => absint( $row->id ),
				'name'          => (string) $row->name,
				'document_type' => (string) ( $meta['document_type'] ?? '' ),
				'versions'      => static::internal_versions( $row, $meta ),
			);
		}
		return $out;
	}

	protected static function meta_for_row( $row ) {
		$meta = json_decode( (string) $row->meta, true );
		return is_array( $meta ) ? $meta : array();
	}

	protected static function internal_versions( $row, $meta ) {
		return array_values( (array) ( $meta['versions'] ?? array() ) );
	}

	protected static function presign_download_url( $key, $name ) {
		return 'http://127.0.0.1:4013/' . rawurlencode( basename( (string) $key ) );
	}
}

class MMED_Hub_Page {
	public static function is_hub_page() {
		return is_page( 'member-dashboard' );
	}
}

/** Canonical 360 entitlement fixture; only the fictional tester is active. */
function mmhq_cam_build_entitlement( $user_id ) {
	$user   = get_user_by( 'id', absint( $user_id ) );
	$active = $user && 'tester' === $user->user_login;
	return array(
		'active'                  => $active,
		'status'                  => $active ? 'active' : 'not_eligible',
		'verified'                => true,
		'trusted'                 => true,
		'current_access_verified' => true,
		'purchase_verified'       => $active,
		'purchase_match_found'    => $active,
		'enrollment_verified'     => $active,
		'authority_mode'          => $active ? 'learndash_and_woocommerce' : '',
		'revocation_checked'      => true,
		'restricted'              => false,
		'revoked'                 => false,
		'expires_at'              => gmdate( 'c', time() + 3600 ),
	);
}

add_shortcode(
	'mmed_hub_stub',
	function () {
		return '<aside><ul class="sos-nav-list"><li><a class="sos-nav-link" href="#dashboard"><span class="sos-nav-icon">D</span><span class="sos-nav-text">Dashboard</span></a></li></ul><ul class="sos-nav-list"><li><a class="sos-nav-link" href="#filevault"><span class="sos-nav-icon">F</span><span class="sos-nav-text">File Vault</span></a></li></ul></aside><main id="sos-content"><section id="mmed-file-vault-v2-content" data-fv2-stage><div id="fv-canary"><h1>File Vault</h1><p>Local fictional harness surface.</p></div></section></main>';
	}
);
