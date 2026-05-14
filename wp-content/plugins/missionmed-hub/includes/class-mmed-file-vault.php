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
	const DB_VERSION = '20260514.1';

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
	 * Create a metadata row and return a presigned upload URL.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_upload_url( $request ) {
		global $wpdb;

		self::maybe_install();

		if ( ! self::storage_configured() ) {
			return new WP_Error(
				'mmed_r2_not_configured',
				'File storage is being configured. Upload will be available soon.',
				array( 'status' => 503 )
			);
		}

		$params        = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$original_name = sanitize_file_name( $params['filename'] ?? '' );
		$mime_type     = sanitize_text_field( $params['mime_type'] ?? 'application/octet-stream' );
		$category      = self::sanitize_category( $params['category'] ?? 'other', 'other' );
		$user_id       = get_current_user_id();

		if ( '' === $original_name ) {
			return new WP_Error( 'mmed_file_name_required', 'A filename is required.', array( 'status' => 400 ) );
		}

		$filename = time() . '_' . $original_name;
		$r2_key   = 'student-files/' . $user_id . '/' . $category . '/' . $filename;

		$inserted = $wpdb->insert(
			self::table_name(),
			array(
				'user_id'       => $user_id,
				'filename'      => $filename,
				'original_name' => $original_name,
				'r2_key'        => $r2_key,
				'mime_type'     => $mime_type,
				'file_size'     => 0,
				'category'      => $category,
				'version'       => 1,
				'status'        => 'pending_review',
				'created_at'    => current_time( 'mysql' ),
				'updated_at'    => current_time( 'mysql' ),
			),
			array( '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%d', '%s', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return new WP_Error( 'mmed_file_create_failed', 'File metadata could not be created.', array( 'status' => 500 ) );
		}

		$file_id = (int) $wpdb->insert_id;
		$url     = self::presign_url( 'PUT', $r2_key, 900 );

		return new WP_REST_Response(
			array(
				'upload_url' => $url,
				'file_id'    => $file_id,
				'r2_key'     => $r2_key,
				'expires'    => 900,
			),
			201
		);
	}

	/**
	 * Confirm direct browser upload completion.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function confirm_upload( $request ) {
		global $wpdb;

		self::maybe_install();

		$file_id = absint( $request['id'] );
		$user_id  = get_current_user_id();
		$file     = self::get_owned_file( $file_id, $user_id );

		if ( ! $file ) {
			return new WP_Error( 'mmed_file_not_found', 'File not found.', array( 'status' => 404 ) );
		}

		$params    = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$file_size = isset( $params['file_size'] ) ? absint( $params['file_size'] ) : 0;

		$wpdb->update(
			self::table_name(),
			array(
				'file_size'  => $file_size,
				'status'     => 'uploaded',
				'updated_at' => current_time( 'mysql' ),
			),
			array(
				'id'      => $file_id,
				'user_id' => $user_id,
			),
			array( '%d', '%s', '%s' ),
			array( '%d', '%d' )
		);

		return new WP_REST_Response( self::format_file( self::get_owned_file( $file_id, $user_id ) ), 200 );
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

		return new WP_REST_Response(
			array(
				'url'     => self::presign_url( 'GET', $file->r2_key, 300 ),
				'expires' => 300,
			),
			200
		);
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

		return array(
			'id'            => (int) $row->id,
			'filename'      => (string) $row->filename,
			'original_name' => (string) $row->original_name,
			'mime_type'     => (string) $row->mime_type,
			'file_size'     => (int) $row->file_size,
			'category'      => (string) $row->category,
			'tags'          => (string) $row->tags,
			'version'       => (int) $row->version,
			'status'        => (string) $row->status,
			'reviewed_by'   => $reviewer,
			'reviewed_at'   => self::format_datetime( $row->reviewed_at ),
			'created_at'    => self::format_datetime( $row->created_at ),
			'download_url'  => null,
		);
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
					'region'      => 'auto',
					'version'     => 'latest',
					'endpoint'    => rtrim( MMED_R2_ENDPOINT, '/' ),
					'credentials' => array(
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
