<?php
/**
 * Additive installer. Creates only the prototype's own tables. Never alters,
 * reads or writes any File Vault table. Deactivation leaves data dormant.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Install {

	const DB_VERSION        = '5';
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
			idempotency_key varchar(191) NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY run_uuid (run_uuid),
			UNIQUE KEY idempotency_key (idempotency_key),
			KEY user_root (user_id,root_id)
		) $c;" );

		/*
		 * M3 client-driven jobs are durable and resumable without WP-Cron. The
		 * signed-in browser asks for one bounded item at a time; optimistic locks
		 * and idempotency keys prevent duplicate provider work across reloads.
		 */
		dbDelta( 'CREATE TABLE ' . self::table( 'jobs' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			job_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			root_id bigint(20) unsigned NOT NULL,
			specialty_label varchar(120) NOT NULL DEFAULT '',
			status varchar(24) NOT NULL DEFAULT 'QUEUED',
			total_items int(11) NOT NULL DEFAULT 0,
			processed_items int(11) NOT NULL DEFAULT 0,
			ready_items int(11) NOT NULL DEFAULT 0,
			attention_items int(11) NOT NULL DEFAULT 0,
			failed_items int(11) NOT NULL DEFAULT 0,
			active_items int(11) NOT NULL DEFAULT 0,
			config_json longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY job_uuid (job_uuid),
			KEY user_root (user_id,root_id),
			KEY user_status (user_id,status)
		) $c;" );

		/* Every provider call, including a failed call, consumes one daily slot. */
		dbDelta( 'CREATE TABLE ' . self::table( 'provider_attempts' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			attempt_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			root_id bigint(20) unsigned NOT NULL DEFAULT 0,
			program_specialty_id varchar(191) NOT NULL DEFAULT '',
			idempotency_key varchar(191) NOT NULL DEFAULT '',
			day_key char(10) NOT NULL,
			attempt_no int(11) unsigned NOT NULL,
			outcome_code varchar(80) NOT NULL DEFAULT 'STARTED',
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY attempt_uuid (attempt_uuid),
			UNIQUE KEY user_day_slot (user_id,day_key,attempt_no),
			KEY user_created (user_id,created_at)
		) $c;" );

		dbDelta( 'CREATE TABLE ' . self::table( 'job_items' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			item_uuid char(36) NOT NULL,
			job_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			program_specialty_id varchar(191) NOT NULL DEFAULT '',
			acgme_id varchar(32) NOT NULL DEFAULT '',
			program_name varchar(255) NOT NULL DEFAULT '',
			tier_requested varchar(12) NOT NULL DEFAULT 'ESSENTIAL',
			tier_effective varchar(24) NOT NULL DEFAULT '',
			status varchar(24) NOT NULL DEFAULT 'QUEUED',
			attempt_count int(11) NOT NULL DEFAULT 0,
			max_attempts int(11) NOT NULL DEFAULT 3,
			run_uuid char(36) NOT NULL DEFAULT '',
			approved_doc_uuid char(36) NOT NULL DEFAULT '',
			idempotency_key varchar(191) NOT NULL DEFAULT '',
			last_error_code varchar(80) NOT NULL DEFAULT '',
			lock_token char(36) NOT NULL DEFAULT '',
			locked_until datetime NULL,
			priority_position int(11) NULL,
			gold_starred tinyint(1) NOT NULL DEFAULT 0,
			evidence_json longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY item_uuid (item_uuid),
			UNIQUE KEY job_program (job_id,program_specialty_id),
			UNIQUE KEY idempotency_key (idempotency_key),
			KEY user_status (user_id,status),
			KEY job_status (job_id,status)
		) $c;" );

		/*
		 * M4 uploads remain quarantined here. They are never read by generation
		 * and never written into RISE by this plugin.
		 */
		dbDelta( 'CREATE TABLE ' . self::table( 'research_artifacts' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			artifact_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			root_id bigint(20) unsigned NOT NULL DEFAULT 0,
			program_specialty_id varchar(191) NOT NULL DEFAULT '',
			acgme_id varchar(32) NOT NULL DEFAULT '',
			program_name varchar(255) NOT NULL DEFAULT '',
			status varchar(40) NOT NULL DEFAULT 'QUARANTINED_REJECTED',
			original_filename varchar(255) NOT NULL DEFAULT '',
			byte_size int(11) unsigned NOT NULL DEFAULT 0,
			sha256 char(64) NOT NULL DEFAULT '',
			validation_json longtext NOT NULL,
			artifact_markdown longtext NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY artifact_uuid (artifact_uuid),
			KEY user_program (user_id,program_specialty_id),
			KEY status (status)
		) $c;" );

		/* M5 stores only keyed fingerprints; no student prose or shingles. */
		dbDelta( 'CREATE TABLE ' . self::table( 'similarity_fingerprints' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			doc_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			algorithm varchar(40) NOT NULL DEFAULT '',
			exact_hmac char(64) NOT NULL DEFAULT '',
			bucket_a char(32) NOT NULL DEFAULT '',
			bucket_b char(32) NOT NULL DEFAULT '',
			bucket_c char(32) NOT NULL DEFAULT '',
			bucket_d char(32) NOT NULL DEFAULT '',
			signature_json text NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY doc_uuid (doc_uuid),
			KEY exact_cross_user (exact_hmac,user_id),
			KEY bucket_a (bucket_a),
			KEY bucket_b (bucket_b),
			KEY bucket_c (bucket_c),
			KEY bucket_d (bucket_d)
		) $c;" );

		dbDelta( 'CREATE TABLE ' . self::table( 'similarity_buckets' ) . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			doc_uuid char(36) NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			bucket_index tinyint(3) unsigned NOT NULL,
			bucket_hash char(32) NOT NULL DEFAULT '',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY doc_bucket (doc_uuid,bucket_index),
			KEY bucket_user (bucket_hash,user_id)
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

		// Record the version only when all ten tables really exist, so a failed install is retried, not hidden.
		foreach ( array( 'roots', 'runs', 'library', 'audit', 'jobs', 'job_items', 'provider_attempts', 'research_artifacts', 'similarity_fingerprints', 'similarity_buckets' ) as $name ) {
			$table = self::table( $name );
			if ( $table !== $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) ) ) {
				return;
			}
		}
		// M3 upgrades depend on these additive columns; table existence alone is
		// not a sufficient migration postcondition.
		$previous = $wpdb->suppress_errors( true );
		$run_probe = $wpdb->get_results( 'SELECT idempotency_key FROM ' . self::table( 'runs' ) . ' LIMIT 0' );
		$job_probe = $wpdb->get_results( 'SELECT active_items FROM ' . self::table( 'jobs' ) . ' LIMIT 0' );
		$research_probe = $wpdb->get_results( 'SELECT validation_json,artifact_markdown FROM ' . self::table( 'research_artifacts' ) . ' LIMIT 0' );
		$similarity_probe = $wpdb->get_results( 'SELECT exact_hmac,signature_json FROM ' . self::table( 'similarity_fingerprints' ) . ' LIMIT 0' );
		$bucket_probe = $wpdb->get_results( 'SELECT bucket_index,bucket_hash FROM ' . self::table( 'similarity_buckets' ) . ' LIMIT 0' );
		$wpdb->suppress_errors( $previous );
		if ( false === $run_probe || false === $job_probe || false === $research_probe || false === $similarity_probe || false === $bucket_probe || ! self::has_unique_index( self::table( 'runs' ), 'idempotency_key' ) || ! self::has_unique_index( self::table( 'provider_attempts' ), 'user_day_slot' ) || ! self::has_unique_index( self::table( 'similarity_fingerprints' ), 'doc_uuid' ) || ! self::has_unique_index( self::table( 'similarity_buckets' ), 'doc_bucket' ) ) {
			return;
		}
		update_option( self::OPTION_DB_VERSION, self::DB_VERSION, true );
	}

	protected static function has_unique_index( $table, $name ) {
		global $wpdb;
		$previous = $wpdb->suppress_errors( true );
		if ( isset( $wpdb->is_mysql ) && ! $wpdb->is_mysql ) {
			$rows = $wpdb->get_results( 'PRAGMA index_list(' . $table . ')', ARRAY_A );
			$ok   = false;
			foreach ( (array) $rows as $row ) {
				if ( $name === (string) ( $row['name'] ?? '' ) && ! empty( $row['unique'] ) ) { $ok = true; break; }
			}
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( 'SHOW INDEX FROM ' . $table . ' WHERE Key_name=%s', $name ), ARRAY_A );
			$ok   = ! empty( $rows );
			foreach ( (array) $rows as $row ) { if ( 0 !== absint( $row['Non_unique'] ?? 1 ) ) { $ok = false; } }
		}
		$wpdb->suppress_errors( $previous );
		return $ok;
	}
}
