<?php
/**
 * MissionMed Matrix file vault and R2 presigned URL integration.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns Matrix file metadata and private R2 access.
 */
class MMED_File_Vault {

	/**
	 * File vault schema version.
	 */
	const DB_VERSION = '20260902.2';

	/**
	 * Initialize runtime checks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Create or update the files table via dbDelta().
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_file_vault_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			filename varchar(255) NOT NULL,
			original_name varchar(255) NOT NULL,
			r2_key varchar(500) NOT NULL,
			mime_type varchar(100) NULL,
			file_size bigint(20) unsigned DEFAULT 0,
			category varchar(50) DEFAULT 'other',
			tags varchar(500) NULL,
			version int DEFAULT 1,
			status varchar(20) DEFAULT 'uploaded',
			reviewed_by bigint(20) unsigned NULL,
			reviewed_at datetime NULL,
			meta_json JSON NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_user (user_id),
			KEY idx_category (user_id, category),
			KEY idx_r2 (r2_key)
		) {$charset_collate};";

		dbDelta( $sql );

		$shares_table = self::shares_table_name();
		$shares_sql   = "CREATE TABLE {$shares_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			source_file_id bigint(20) unsigned NOT NULL,
			source_revision int unsigned NOT NULL DEFAULT 1,
			source_class varchar(24) NOT NULL,
			owner_user_id bigint(20) unsigned NOT NULL,
			actor_user_id bigint(20) unsigned NOT NULL,
			title varchar(180) NOT NULL,
			description text NULL,
			category varchar(80) NOT NULL DEFAULT 'resource',
			audience_mode varchar(24) NOT NULL,
			audience_group_ids text NULL,
			status varchar(20) NOT NULL DEFAULT 'active',
			moderation_status varchar(20) NOT NULL DEFAULT '',
			moderated_by bigint(20) unsigned NULL,
			moderated_at datetime NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY source_file (source_file_id),
			KEY active_class (status, source_class, updated_at),
			KEY owner_status (owner_user_id, status, updated_at),
			KEY actor_status (actor_user_id, status, updated_at)
		) {$charset_collate};";
		dbDelta( $shares_sql );

		$recipients_table = self::share_recipients_table_name();
		$recipients_sql   = "CREATE TABLE {$recipients_table} (
			share_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (share_id, user_id),
			KEY recipient_share (user_id, share_id)
		) {$charset_collate};";
		dbDelta( $recipients_sql );

		$downloads_table = self::downloads_table_name();
		$downloads_sql   = "CREATE TABLE {$downloads_table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			file_id bigint(20) unsigned NOT NULL,
			version_number int unsigned NOT NULL DEFAULT 1,
			version_uuid varchar(36) NULL,
			share_id bigint(20) unsigned NULL,
			user_id bigint(20) unsigned NOT NULL,
			owner_user_id bigint(20) unsigned NOT NULL,
			source_class varchar(24) NOT NULL,
			requester_role varchar(20) NOT NULL,
			subject_user_id bigint(20) unsigned NULL,
			created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY file_activity (file_id, version_number, created_at),
			KEY share_activity (share_id, user_id, created_at),
			KEY user_activity (user_id, created_at),
			KEY recent_activity (created_at)
		) {$charset_collate};";
		dbDelta( $downloads_sql );
		update_option( 'mmed_file_vault_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return the files table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_files';
	}

	/** Return the normalized share-definition table name. */
	public static function shares_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_file_vault_shares';
	}

	/** Return the explicit share-recipient table name. */
	public static function share_recipients_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_file_vault_share_recipients';
	}

	/** Return the normalized download-event table name. */
	public static function downloads_table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_file_vault_downloads';
	}

	/**
	 * List current user's files.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_files( $request ) {
		global $wpdb;

		self::maybe_install();

		$user_id  = get_current_user_id();
		$category = self::sanitize_category( $request->get_param( 'category' ), '' );
		$status   = self::sanitize_status( $request->get_param( 'status' ), '' );
		$where    = array( 'user_id = %d' );
		$values   = array( $user_id );

		if ( $category ) {
			$where[]  = 'category = %s';
			$values[] = $category;
		}

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		$sql  = 'SELECT * FROM ' . self::table_name() . ' WHERE ' . implode( ' AND ', $where );
		$sql .= ' ORDER BY created_at DESC, id DESC';

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return new WP_REST_Response(
			array(
				'files'              => array_map( array( __CLASS__, 'format_file' ), is_array( $rows ) ? $rows : array() ),
				'counts'             => self::get_counts( $user_id ),
				'storage_configured' => self::storage_configured(),
				'storage_message'    => self::storage_configured() ? '' : 'File storage is being configured. Upload will be available soon.',
			),
			200
		);
	}

	/**
	 * Delegate legacy upload issuance only to a verified bounded server adapter.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_upload_url( $request ) {
		self::maybe_install();
		$user_id = get_current_user_id();
		if ( class_exists( 'MMED_File_Vault_V2' ) && method_exists( 'MMED_File_Vault_V2', 'is_user_eligible' ) && MMED_File_Vault_V2::is_user_eligible( $user_id ) ) {
			return new WP_Error( 'mmed_file_vault_v2_upload_required', 'Use the current File Vault upload workflow for this account.', array( 'status' => 409 ) );
		}

		if ( ! self::storage_configured() ) {
			return new WP_Error(
				'mmed_r2_not_configured',
				'File storage is being configured. Upload will be available soon.',
				array( 'status' => 503 )
			);
		}

		return new WP_Error( 'mmed_file_vault_v1_bounded_upload_unavailable', 'Legacy direct upload is unavailable until a bounded private-storage adapter is verified.', array( 'status' => 503 ) );
	}

	/**
	 * Delegate legacy confirmation only to authoritative object verification.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function confirm_upload( $request ) {
		self::maybe_install();

		$file_id = absint( $request['id'] );
		$user_id  = get_current_user_id();
		$file     = self::get_owned_file( $file_id, $user_id );

		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found.', array( 'status' => 404 ) );
		}
		if ( self::v2_metadata_for_row( $file ) ) {
			return new WP_Error( 'mmed_file_vault_v2_confirm_required', 'This document is managed by File Vault V2 and cannot be changed through the legacy confirmation route.', array( 'status' => 409 ) );
		}

		return new WP_Error( 'mmed_file_vault_v1_bounded_confirm_unavailable', 'Legacy upload confirmation requires authoritative object verification.', array( 'status' => 503 ) );
	}

	/**
	 * Return a presigned download URL for an owned file.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_download_url( $request ) {
		self::maybe_install();

		if ( ! self::storage_configured() ) {
			return new WP_Error(
				'mmed_r2_not_configured',
				'File storage is being configured. Download will be available soon.',
				array( 'status' => 503 )
			);
		}

		$file = self::get_owned_file( absint( $request['id'] ), get_current_user_id() );
		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found.', array( 'status' => 404 ) );
		}

		$expires = 300;
		$r2_key  = (string) $file->r2_key;
		$v2_meta = self::v2_metadata_for_row( $file );
		if ( $v2_meta ) {
			$versions = isset( $v2_meta['versions'] ) && is_array( $v2_meta['versions'] ) ? $v2_meta['versions'] : array();
			$current  = empty( $versions ) ? null : end( $versions );
			if ( ! is_array( $current ) || 'ready_clean' !== sanitize_key( $current['verification_state'] ?? '' ) || empty( $current['r2_key'] ) ) {
				return new WP_Error( 'mmed_file_vault_v2_download_unverified', 'This document has not passed File Vault V2 private-storage verification.', array( 'status' => 409 ) );
			}
			$r2_key  = (string) $current['r2_key'];
			$expires = 60;
			if ( class_exists( 'MMED_File_Vault_V2_Repository' ) && method_exists( 'MMED_File_Vault_V2_Repository', 'record_compatibility_download' ) ) {
				$recorded = MMED_File_Vault_V2_Repository::record_compatibility_download( absint( $file->id ), get_current_user_id() );
				if ( is_wp_error( $recorded ) ) {
					return $recorded;
				}
			}
		}

		return new WP_REST_Response(
			array(
				'url'     => self::presign_url( 'GET', $r2_key, $expires ),
				'expires' => $expires,
			),
			200
		);
	}

	/**
	 * Return the additive V2 metadata envelope for a shared-table row.
	 *
	 * @param object|null $row File row.
	 * @return array
	 */
	protected static function v2_metadata_for_row( $row ) {
		if ( ! $row || empty( $row->meta_json ) ) {
			return array();
		}
		$decoded = json_decode( (string) $row->meta_json, true );
		return is_array( $decoded ) && isset( $decoded['file_vault_v2'] ) && is_array( $decoded['file_vault_v2'] )
			? $decoded['file_vault_v2']
			: array();
	}

	/**
	 * List students with file vault counts for Admin HQ.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function admin_list_students( $request ) {
		global $wpdb;

		self::maybe_install();

		$search = sanitize_text_field( $request->get_param( 'search' ) );
		$limit  = absint( $request->get_param( 'limit' ) );
		$limit  = $limit ? min( $limit, 80 ) : 40;
		$args   = array(
			'number'       => $limit,
			'orderby'      => 'display_name',
			'order'        => 'ASC',
			'role__not_in' => array( 'administrator' ),
			'fields'       => array( 'ID', 'display_name', 'user_email', 'user_registered' ),
		);

		if ( '' !== $search ) {
			$args['search']         = '*' . esc_attr( $search ) . '*';
			$args['search_columns'] = array( 'user_login', 'user_email', 'display_name' );
		}

		$users    = get_users( $args );
		$students = array();

		foreach ( $users as $user ) {
			$user_id = absint( $user->ID );
			$latest  = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT MAX(updated_at) FROM ' . self::table_name() . ' WHERE user_id = %d',
					$user_id
				)
			);

			$students[] = array(
				'id'             => $user_id,
				'display_name'   => $user->display_name ? $user->display_name : $user->user_email,
				'email'          => $user->user_email,
				'registered_at'  => self::format_datetime( $user->user_registered ),
				'latest_file_at' => self::format_datetime( $latest ),
				'vault_prefix'   => self::student_prefix( $user_id ),
				'counts'         => self::get_counts( $user_id ),
			);
		}

		return new WP_REST_Response(
			array(
				'students'           => $students,
				'storage_configured' => self::storage_configured(),
				'storage_message'    => self::storage_configured() ? '' : 'R2 storage is not configured, so uploads and downloads are disabled.',
			),
			200
		);
	}

	/**
	 * Return one student's file tree and files for Admin HQ.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_get_student_files( $request ) {
		global $wpdb;

		self::maybe_install();

		$user_id = absint( $request['uid'] );
		$user    = get_user_by( 'id', $user_id );

		if ( ! $user ) {
			return new WP_Error( 'mmed_file_vault_student_not_found', 'Student not found.', array( 'status' => 404 ) );
		}

		$category = self::sanitize_category( $request->get_param( 'category' ), '' );
		$status   = self::sanitize_status( $request->get_param( 'status' ), '' );
		$where    = array( 'user_id = %d' );
		$values   = array( $user_id );

		if ( $category ) {
			$where[]  = 'category = %s';
			$values[] = $category;
		}

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		$sql  = 'SELECT * FROM ' . self::table_name() . ' WHERE ' . implode( ' AND ', $where );
		$sql .= ' ORDER BY updated_at DESC, created_at DESC, id DESC';

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return new WP_REST_Response(
			array(
				'student'            => self::format_student( $user ),
				'files'              => array_map( array( __CLASS__, 'format_admin_file' ), is_array( $rows ) ? $rows : array() ),
				'folders'            => self::folder_tree( $user_id ),
				'counts'             => self::get_counts( $user_id ),
				'vault_prefix'       => self::student_prefix( $user_id ),
				'storage_configured' => self::storage_configured(),
				'storage_message'    => self::storage_configured() ? '' : 'R2 storage is not configured, so uploads and downloads are disabled.',
			),
			200
		);
	}

	/**
	 * Delegate admin-shared upload issuance to a verified bounded server adapter.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_get_student_upload_url( $request ) {
		self::maybe_install();

		if ( ! self::storage_configured() ) {
			return new WP_Error(
				'mmed_r2_not_configured',
				'R2 storage is not configured, so File Vault uploads are disabled.',
				array( 'status' => 503 )
			);
		}

		$user_id = absint( $request['uid'] );
		$user    = get_user_by( 'id', $user_id );

		if ( ! $user ) {
			return new WP_Error( 'mmed_file_vault_student_not_found', 'Student not found.', array( 'status' => 404 ) );
		}

		return new WP_Error( 'mmed_file_vault_v1_bounded_upload_unavailable', 'Legacy direct upload is unavailable until a bounded private-storage adapter is verified.', array( 'status' => 503 ) );
	}

	/**
	 * Delegate admin-shared confirmation to authoritative object verification.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_confirm_student_upload( $request ) {
		self::maybe_install();

		$file_id = absint( $request['id'] );
		$user_id = absint( $request['uid'] );
		$file    = self::get_owned_file( $file_id, $user_id );

		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found for this student.', array( 'status' => 404 ) );
		}

		return new WP_Error( 'mmed_file_vault_v1_bounded_confirm_unavailable', 'Legacy upload confirmation requires authoritative object verification.', array( 'status' => 503 ) );
	}

	/**
	 * Return a presigned download URL for an admin-visible student file.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_get_file_download_url( $request ) {
		self::maybe_install();

		if ( ! self::storage_configured() ) {
			return new WP_Error(
				'mmed_r2_not_configured',
				'R2 storage is not configured, so File Vault downloads are disabled.',
				array( 'status' => 503 )
			);
		}

		$file = self::get_file_by_id( absint( $request['id'] ) );
		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found.', array( 'status' => 404 ) );
		}

		return new WP_REST_Response(
			array(
				'url'     => self::presign_url( 'GET', $file->r2_key, 300 ),
				'expires' => 300,
				'file'    => self::format_admin_file( $file ),
			),
			200
		);
	}

	/**
	 * Update a file review status from Admin HQ.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_update_file_status( $request ) {
		global $wpdb;

		self::maybe_install();

		$file_id = absint( $request['id'] );
		$file    = self::get_file_by_id( $file_id );

		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found.', array( 'status' => 404 ) );
		}

		$params = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$status = self::sanitize_status( $params['status'] ?? '', '' );

		if ( ! $status ) {
			return new WP_Error( 'mmed_file_status_required', 'A valid status is required.', array( 'status' => 400 ) );
		}

		$wpdb->update(
			self::table_name(),
			array(
				'status'      => $status,
				'reviewed_by' => get_current_user_id(),
				'reviewed_at' => current_time( 'mysql' ),
				'updated_at'  => current_time( 'mysql' ),
			),
			array( 'id' => $file_id ),
			array( '%s', '%d', '%s', '%s' ),
			array( '%d' )
		);

		return new WP_REST_Response( self::format_admin_file( self::get_file_by_id( $file_id ) ), 200 );
	}

	/**
	 * Count files by status/category for the current dashboard.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_counts( $user_id ) {
		global $wpdb;

		self::maybe_install();

		$total = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table_name() . ' WHERE user_id = %d', absint( $user_id ) )
		);

		$verified = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table_name() . " WHERE user_id = %d AND status = 'verified'", absint( $user_id ) )
		);

		$pending = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::table_name() . " WHERE user_id = %d AND status IN ('pending_review','uploaded')", absint( $user_id ) )
		);

		$categories = (int) $wpdb->get_var(
			$wpdb->prepare( 'SELECT COUNT(DISTINCT category) FROM ' . self::table_name() . ' WHERE user_id = %d', absint( $user_id ) )
		);

		return array(
			'total'          => $total,
			'verified'       => $verified,
			'pending_review' => $pending,
			'categories'     => $categories,
		);
	}

	/**
	 * Fetch an owned file.
	 *
	 * @param int $file_id File ID.
	 * @param int $user_id User ID.
	 * @return object|null
	 */
	protected static function get_owned_file( $file_id, $user_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d AND user_id = %d',
				absint( $file_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Fetch a file by ID for admin review.
	 *
	 * @param int $file_id File ID.
	 * @return object|null
	 */
	protected static function get_file_by_id( $file_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				absint( $file_id )
			)
		);
	}

	/**
	 * Return the per-student R2 key prefix.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string
	 */
	protected static function student_prefix( $user_id ) {
		return 'student-files/' . absint( $user_id ) . '/';
	}

	/**
	 * Return the current file vault folder vocabulary.
	 *
	 * @return array
	 */
	protected static function category_labels() {
		return array(
			'documents'       => 'Documents',
			'medical_records' => 'Medical Records',
			'letters'         => 'Letters',
			'certifications'  => 'Certifications',
			'academic'        => 'Academic',
			'clinical'        => 'Clinical',
			'personal'        => 'Personal',
			'admin'           => 'Admin Shared',
			'general'         => 'General',
			'other'           => 'Other',
		);
	}

	/**
	 * Return category folders with live file counts.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	protected static function folder_tree( $user_id ) {
		global $wpdb;

		$counts = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT category, COUNT(*) AS total FROM ' . self::table_name() . ' WHERE user_id = %d GROUP BY category',
				absint( $user_id )
			),
			ARRAY_A
		);
		$by_key = array();

		foreach ( is_array( $counts ) ? $counts : array() as $row ) {
			$key            = self::sanitize_category( $row['category'] ?? 'other', 'other' );
			$by_key[ $key ] = absint( $row['total'] ?? 0 );
		}

		$folders = array();
		foreach ( self::category_labels() as $key => $label ) {
			$folders[] = array(
				'key'       => $key,
				'label'     => $label,
				'count'     => $by_key[ $key ] ?? 0,
				'r2_prefix' => self::student_prefix( $user_id ) . $key . '/',
			);
		}

		return $folders;
	}

	/**
	 * Format a user for Admin HQ file vault views.
	 *
	 * @param WP_User|object $user WordPress user.
	 * @return array
	 */
	protected static function format_student( $user ) {
		return array(
			'id'             => absint( $user->ID ),
			'display_name'   => $user->display_name ? $user->display_name : $user->user_email,
			'email'          => $user->user_email,
			'registered_at'  => self::format_datetime( $user->user_registered ),
			'vault_prefix'   => self::student_prefix( $user->ID ),
			'counts'         => self::get_counts( $user->ID ),
		);
	}

	/**
	 * Convert a database row into REST shape.
	 *
	 * @param object|null $row File row.
	 * @return array
	 */
	protected static function format_file( $row ) {
		if ( ! $row ) {
			return array();
		}

		$reviewer = '';
		if ( ! empty( $row->reviewed_by ) ) {
			$user     = get_user_by( 'id', (int) $row->reviewed_by );
			$reviewer = $user ? $user->display_name : '';
		}
		$status  = (string) $row->status;
		$v2_meta = self::v2_metadata_for_row( $row );
		if ( $v2_meta ) {
			$v2_status = sanitize_key( $v2_meta['workflow_status'] ?? '' );
			if ( in_array( $v2_status, array( 'draft', 'uploaded', 'submitted', 'in_review', 'needs_changes', 'reviewed', 'final' ), true ) ) {
				$status = $v2_status;
			}
		}

		return array(
			'id'            => (int) $row->id,
			'filename'      => (string) $row->filename,
			'original_name' => (string) $row->original_name,
			'mime_type'     => (string) $row->mime_type,
			'file_size'     => (int) $row->file_size,
			'category'      => (string) $row->category,
			'tags'          => (string) $row->tags,
			'version'       => (int) $row->version,
			'status'        => $status,
			'reviewed_by'   => $reviewer,
			'reviewed_at'   => self::format_datetime( $row->reviewed_at ),
			'created_at'    => self::format_datetime( $row->created_at ),
			'download_url'  => null,
		);
	}

	/**
	 * Convert a file row into an admin REST shape.
	 *
	 * @param object|null $row File row.
	 * @return array
	 */
	protected static function format_admin_file( $row ) {
		$file = self::format_file( $row );
		if ( ! $row ) {
			return $file;
		}

		$student = get_user_by( 'id', (int) $row->user_id );
		$meta    = array();
		if ( ! empty( $row->meta_json ) ) {
			$decoded = json_decode( (string) $row->meta_json, true );
			$meta    = is_array( $decoded ) ? $decoded : array();
		}

		$file['user_id']      = (int) $row->user_id;
		$file['student']      = $student ? self::format_student( $student ) : null;
		$file['vault_path']   = (string) $row->r2_key;
		$file['folder_label'] = self::category_labels()[ $file['category'] ] ?? ucfirst( $file['category'] );
		$file['meta']         = $meta;

		return $file;
	}

	/**
	 * Determine whether R2 constants are available.
	 *
	 * @return bool
	 */
	protected static function storage_configured() {
		return defined( 'MMED_R2_ENDPOINT' )
			&& defined( 'MMED_R2_ACCESS_KEY' )
			&& defined( 'MMED_R2_SECRET_KEY' )
			&& defined( 'MMED_R2_BUCKET' )
			&& MMED_R2_ENDPOINT
			&& MMED_R2_ACCESS_KEY
			&& MMED_R2_SECRET_KEY
			&& MMED_R2_BUCKET;
	}

	/**
	 * Generate a presigned R2 URL using AWS SDK when available, otherwise SigV4.
	 *
	 * @param string $method  HTTP method.
	 * @param string $r2_key  Object key.
	 * @param int    $expires Expiration seconds.
	 * @return string
	 */
	protected static function presign_url( $method, $r2_key, $expires ) {
		if ( class_exists( '\Aws\S3\S3Client' ) ) {
			$client = new \Aws\S3\S3Client(
				array(
					'region'                  => 'auto',
					'version'                 => 'latest',
					'endpoint'                => rtrim( MMED_R2_ENDPOINT, '/' ),
					'use_path_style_endpoint' => true,
					'credentials'             => array(
						'key'    => MMED_R2_ACCESS_KEY,
						'secret' => MMED_R2_SECRET_KEY,
					),
				)
			);

			$command = $client->getCommand(
				'PUT' === strtoupper( $method ) ? 'PutObject' : 'GetObject',
				array(
					'Bucket' => MMED_R2_BUCKET,
					'Key'    => $r2_key,
				)
			);

			return (string) $client->createPresignedRequest( $command, '+' . absint( $expires ) . ' seconds' )->getUri();
		}

		return self::presign_sigv4( $method, $r2_key, $expires );
	}

	/**
	 * Minimal S3-compatible SigV4 presigner for Cloudflare R2.
	 *
	 * @param string $method  HTTP method.
	 * @param string $r2_key  Object key.
	 * @param int    $expires Expiration seconds.
	 * @return string
	 */
	protected static function presign_sigv4( $method, $r2_key, $expires ) {
		$endpoint = rtrim( MMED_R2_ENDPOINT, '/' );
		$parts    = wp_parse_url( $endpoint );
		$host     = $parts['host'] ?? '';
		$scheme   = $parts['scheme'] ?? 'https';
		$region   = 'auto';
		$service  = 's3';
		$time     = time();
		$amz_date = gmdate( 'Ymd\THis\Z', $time );
		$date     = gmdate( 'Ymd', $time );
		$scope    = $date . '/' . $region . '/' . $service . '/aws4_request';
		$path     = '/' . rawurlencode( MMED_R2_BUCKET ) . '/' . str_replace( '%2F', '/', rawurlencode( $r2_key ) );

		$query = array(
			'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
			'X-Amz-Credential'    => MMED_R2_ACCESS_KEY . '/' . $scope,
			'X-Amz-Date'          => $amz_date,
			'X-Amz-Expires'       => absint( $expires ),
			'X-Amz-SignedHeaders' => 'host',
		);

		ksort( $query );

		$canonical_query = self::build_canonical_query( $query );
		$canonical       = strtoupper( $method ) . "\n" . $path . "\n" . $canonical_query . "\nhost:" . $host . "\n\nhost\nUNSIGNED-PAYLOAD";
		$string_to_sign  = "AWS4-HMAC-SHA256\n" . $amz_date . "\n" . $scope . "\n" . hash( 'sha256', $canonical );
		$signing_key     = self::signing_key( MMED_R2_SECRET_KEY, $date, $region, $service );
		$signature       = hash_hmac( 'sha256', $string_to_sign, $signing_key );

		return $scheme . '://' . $host . $path . '?' . $canonical_query . '&X-Amz-Signature=' . $signature;
	}

	/**
	 * Build canonical query string.
	 *
	 * @param array $query Query values.
	 * @return string
	 */
	protected static function build_canonical_query( $query ) {
		$parts = array();

		foreach ( $query as $key => $value ) {
			$parts[] = rawurlencode( $key ) . '=' . rawurlencode( (string) $value );
		}

		return implode( '&', $parts );
	}

	/**
	 * Build SigV4 signing key.
	 *
	 * @param string $secret  Secret key.
	 * @param string $date    Date.
	 * @param string $region  Region.
	 * @param string $service Service.
	 * @return string
	 */
	protected static function signing_key( $secret, $date, $region, $service ) {
		$k_date    = hash_hmac( 'sha256', $date, 'AWS4' . $secret, true );
		$k_region  = hash_hmac( 'sha256', $region, $k_date, true );
		$k_service = hash_hmac( 'sha256', $service, $k_region, true );
		return hash_hmac( 'sha256', 'aws4_request', $k_service, true );
	}

	/**
	 * Sanitize a file category.
	 *
	 * @param mixed  $value   Raw category.
	 * @param string $default Default category.
	 * @return string
	 */
	protected static function sanitize_category( $value, $default ) {
		$value   = sanitize_key( $value );
		$allowed = array( 'documents', 'medical_records', 'letters', 'certifications', 'other', 'academic', 'clinical', 'personal', 'admin', 'general' );

		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Sanitize a file status.
	 *
	 * @param mixed  $value   Raw status.
	 * @param string $default Default status.
	 * @return string
	 */
	protected static function sanitize_status( $value, $default ) {
		$value   = sanitize_key( $value );
		$allowed = array( 'pending_review', 'uploaded', 'verified', 'rejected' );

		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Format MySQL date/time for REST.
	 *
	 * @param string|null $value MySQL date/time.
	 * @return string|null
	 */
	protected static function format_datetime( $value ) {
		if ( empty( $value ) ) {
			return null;
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d\TH:i:s', $timestamp ) : null;
	}
}
