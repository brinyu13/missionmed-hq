<?php
/**
 * Additive installer. Creates only the prototype's own tables. Never alters,
 * reads or writes any File Vault table. Deactivation leaves data dormant.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Install {

	const DB_VERSION        = '1';
	const OPTION_DB_VERSION = 'mmed_ps_proto_db_version';

	public static function table( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'mmed_ps_proto_' . $name;
	}

	public static function activate() {
		self::maybe_install();
		// Tiny, autoloaded: the gate then costs no extra query on any request.
		if ( false === get_option( MMPS_Gate::OPTION_MODE, false ) ) {
			add_option( MMPS_Gate::OPTION_MODE, 'allowlist', '', true );
		}
		if ( false === get_option( MMPS_Gate::OPTION_ALLOW_ADMINS, false ) ) {
			add_option( MMPS_Gate::OPTION_ALLOW_ADMINS, '1', '', true );
		}
		if ( false === get_option( MMPS_Gate::OPTION_ALLOW_USERS, false ) ) {
			add_option( MMPS_Gate::OPTION_ALLOW_USERS, array(), '', true );
		}
	}

	public static function maybe_install() {
		if ( self::DB_VERSION === (string) get_option( self::OPTION_DB_VERSION, '' ) ) {
			return;
		}
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();

		dbDelta( 'CREATE TABLE ' . self::table( 'roots' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			specialty_label varchar(120) NOT NULL DEFAULT '',
			source_kind varchar(20) NOT NULL DEFAULT 'SYNTHETIC',
			is_synthetic tinyint(1) NOT NULL DEFAULT 0,
			fv_file_id bigint(20) unsigned NOT NULL DEFAULT 0,
			fv_version_number int(11) NOT NULL DEFAULT 0,
			fv_version_uuid varchar(64) NOT NULL DEFAULT '',
			root_label varchar(200) NOT NULL DEFAULT '',
			source_sha256 char(64) NOT NULL DEFAULT '',
			text_sha256 char(64) NOT NULL DEFAULT '',
			paragraphs_json longtext NOT NULL,
			region_json text NOT NULL,
			prefs_json longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY user_id (user_id)
		) $c;" );

		dbDelta( 'CREATE TABLE ' . self::table( 'runs' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			run_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			root_id bigint(20) unsigned NOT NULL,
			program_specialty_id varchar(191) NOT NULL DEFAULT '',
			tier_requested varchar(12) NOT NULL DEFAULT '',
			tier_effective varchar(24) NOT NULL DEFAULT '',
			strategy_key varchar(40) NOT NULL DEFAULT '',
			regen_ordinal int(11) NOT NULL DEFAULT 0,
			provider varchar(40) NOT NULL DEFAULT '',
			model varchar(80) NOT NULL DEFAULT '',
			status varchar(24) NOT NULL DEFAULT '',
			bundle_sha256 char(64) NOT NULL DEFAULT '',
			bundle_json longtext NOT NULL,
			output_json longtext NOT NULL,
			validation_json longtext NOT NULL,
			latency_ms int(11) NOT NULL DEFAULT 0,
			tokens_in int(11) NOT NULL DEFAULT 0,
			tokens_out int(11) NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY run_uuid (run_uuid),
			KEY user_root (user_id,root_id)
		) $c;" );

		dbDelta( 'CREATE TABLE ' . self::table( 'library' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			doc_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			root_id bigint(20) unsigned NOT NULL,
			run_id bigint(20) unsigned NOT NULL,
			specialty_label varchar(120) NOT NULL DEFAULT '',
			program_specialty_id varchar(191) NOT NULL DEFAULT '',
			acgme_id varchar(32) NOT NULL DEFAULT '',
			program_name varchar(255) NOT NULL DEFAULT '',
			institution varchar(255) NOT NULL DEFAULT '',
			city varchar(120) NOT NULL DEFAULT '',
			state varchar(40) NOT NULL DEFAULT '',
			tier varchar(24) NOT NULL DEFAULT '',
			version_number int(11) NOT NULL DEFAULT 1,
			status varchar(16) NOT NULL DEFAULT 'DRAFT',
			title varchar(255) NOT NULL DEFAULT '',
			root_label varchar(200) NOT NULL DEFAULT '',
			full_text longtext NOT NULL,
			full_text_sha256 char(64) NOT NULL DEFAULT '',
			region_text longtext NOT NULL,
			metadata_json longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY doc_uuid (doc_uuid),
			UNIQUE KEY one_version (user_id,root_id,program_specialty_id,version_number),
			KEY user_id (user_id)
		) $c;" );

		dbDelta( 'CREATE TABLE ' . self::table( 'audit' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			action varchar(40) NOT NULL,
			ref varchar(191) NOT NULL DEFAULT '',
			detail_json text NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY user_id (user_id)
		) $c;" );

		// Record the version only when all four tables really exist, so a failed install is retried, not hidden.
		foreach ( array( 'roots', 'runs', 'library', 'audit' ) as $name ) {
			$table = self::table( $name );
			if ( $table !== $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) ) ) {
				return;
			}
		}
		update_option( self::OPTION_DB_VERSION, self::DB_VERSION, true );
	}
}
