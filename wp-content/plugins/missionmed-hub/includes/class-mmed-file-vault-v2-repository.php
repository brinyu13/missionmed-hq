<?php
/**
 * File Vault V2 repository on top of the proven WordPress/MySQL and R2 runtime.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds V2 document workflow metadata without changing the V1 table or routes.
 */
class MMED_File_Vault_V2_Repository extends MMED_File_Vault {

	const META_KEY      = 'file_vault_v2';
	const META_VERSION  = 1;
	const MAX_FILE_SIZE = 26214400;
	const APPLICATION_PHOTO_MAX_FILE_SIZE = 153600;
	const INTENT_TTL    = 1200;
	const STAFF_PAGE_SIZE = 50;
	const STAFF_DOCUMENT_LIMIT = 1000;
	const STAFF_META_BYTES_LIMIT = 8388608;
	const STAFF_EVENT_PAGE_SIZE = 200;
	const STAFF_EVENT_LIMIT = 5000;

	/**
	 * Return the supported document vocabulary.
	 *
	 * @return array
	 */
	public static function document_types() {
		$types = array(
			'personal_statement'         => array( 'label' => 'Personal Statement', 'category' => 'documents' ),
			'curriculum_vitae'           => array( 'label' => 'Curriculum Vitae', 'category' => 'documents' ),
			'mspe'                       => array( 'label' => 'MSPE', 'category' => 'academic' ),
			'medical_school_transcript'  => array( 'label' => 'Medical School Transcript', 'category' => 'academic' ),
			'usmle_transcript'           => array( 'label' => 'USMLE Transcript', 'category' => 'certifications' ),
			'letter_of_recommendation_1' => array( 'label' => 'Letter of Recommendation 1', 'category' => 'letters' ),
			'letter_of_recommendation_2' => array( 'label' => 'Letter of Recommendation 2', 'category' => 'letters' ),
			'letter_of_recommendation_3' => array( 'label' => 'Letter of Recommendation 3', 'category' => 'letters' ),
			'ecfmg_status_report'        => array( 'label' => 'ECFMG Status Report', 'category' => 'certifications' ),
			'application_photo'          => array( 'label' => 'Application Photo', 'category' => 'personal' ),
			'other'                      => array( 'label' => 'Other Document', 'category' => 'other' ),
		);

		return (array) apply_filters( 'mmed_file_vault_v2_document_types', $types );
	}

	/**
	 * Return the safe upload vocabulary exposed to the browser.
	 *
	 * @return array
	 */
	public static function document_type_labels() {
		$labels = array();
		foreach ( self::document_types() as $key => $definition ) {
			$key = sanitize_key( $key );
			if ( ! $key || ! is_array( $definition ) || empty( $definition['label'] ) ) {
				continue;
			}
			$labels[ $key ] = sanitize_text_field( $definition['label'] );
		}
		return $labels;
	}

	/**
	 * Return accepted extensions and MIME aliases.
	 *
	 * @return array
	 */
	public static function accepted_files() {
		return array(
			'pdf'  => array( 'application/pdf' ),
			'docx' => array( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ),
			'png'  => array( 'image/png' ),
			'jpg'  => array( 'image/jpeg' ),
			'jpeg' => array( 'image/jpeg' ),
		);
	}

	/**
	 * Return server-owned file constraints by document type.
	 *
	 * @return array
	 */
	public static function upload_contracts() {
		return array(
			'default' => array(
				'extensions'    => array( 'pdf', 'docx', 'png' ),
				'max_file_size' => self::MAX_FILE_SIZE,
			),
			'application_photo' => array(
				'extensions'    => array( 'jpg', 'jpeg' ),
				'max_file_size' => self::APPLICATION_PHOTO_MAX_FILE_SIZE,
			),
		);
	}

	/**
	 * Normalize a document type.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function normalize_document_type( $value ) {
		$value = sanitize_key( $value );
		return isset( self::document_types()[ $value ] ) ? $value : 'other';
	}

	/**
	 * Normalize the V2 workflow status.
	 *
	 * @param mixed  $value Raw value.
	 * @param string $default Default status.
	 * @return string
	 */
	public static function normalize_workflow_status( $value, $default = 'draft' ) {
		$value   = sanitize_key( $value );
		$allowed = array( 'draft', 'uploaded', 'submitted', 'in_review', 'needs_changes', 'reviewed', 'final' );
		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Map V2 status back to the legacy V1 status vocabulary.
	 *
	 * @param string $status V2 status.
	 * @return string
	 */
	public static function legacy_status( $status ) {
		$status = self::normalize_workflow_status( $status );
		if ( 'needs_changes' === $status ) {
			return 'rejected';
		}
		if ( in_array( $status, array( 'submitted', 'in_review' ), true ) ) {
			return 'pending_review';
		}
		if ( in_array( $status, array( 'reviewed', 'final' ), true ) ) {
			return 'verified';
		}
		return 'uploaded';
	}

	/**
	 * Return whether the existing R2 signer is configured.
	 *
	 * @return bool
	 */
	public static function storage_ready() {
		$testing = defined( 'MMED_FILE_VAULT_V2_TESTING' ) && true === MMED_FILE_VAULT_V2_TESTING;
		return self::storage_configured()
			&& defined( 'MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED' )
			&& true === MMED_FILE_VAULT_PRIVATE_STORAGE_VERIFIED
			&& ( $testing || class_exists( '\\Aws\\S3\\S3Client' ) )
			&& ( $testing || has_filter( 'mmed_file_vault_v2_scan_object' ) )
			&& ( $testing || rest_sanitize_boolean( get_option( 'mmed_file_vault_v2_staging_lifecycle_verified', false ) ) )
			&& absint( get_option( 'mmed_file_vault_v2_user_quota_bytes', 0 ) ) > 0;
	}

	/**
	 * Sign HEAD probes correctly when the AWS SDK is present.
	 *
	 * @param string $method Request method.
	 * @param string $r2_key Object key.
	 * @param int    $expires Expiration seconds.
	 * @return string
	 */
	protected static function presign_url( $method, $r2_key, $expires ) {
		if ( 'HEAD' !== strtoupper( $method ) ) {
			return parent::presign_url( $method, $r2_key, $expires );
		}

		if ( class_exists( '\\Aws\\S3\\S3Client' ) ) {
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
				'HeadObject',
				array(
					'Bucket' => MMED_R2_BUCKET,
					'Key'    => $r2_key,
				)
			);
			return (string) $client->createPresignedRequest( $command, '+' . absint( $expires ) . ' seconds' )->getUri();
		}

		return parent::presign_sigv4( 'HEAD', $r2_key, $expires );
	}

	/**
	 * Bind the upload URL to the exact MIME and browser-computed checksum.
	 *
	 * @param string $r2_key Object key.
	 * @param string $mime_type MIME type.
	 * @param string $sha256 Hex SHA-256.
	 * @return string
	 */
	protected static function presign_upload_url( $r2_key, $mime_type, $sha256 ) {
		if ( defined( 'MMED_FILE_VAULT_V2_TESTING' ) && true === MMED_FILE_VAULT_V2_TESTING ) {
			return parent::presign_url( 'PUT', $r2_key, 600 );
		}
		if ( ! class_exists( '\\Aws\\S3\\S3Client' ) ) {
			return '';
		}
		try {
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
				'PutObject',
				array(
					'Bucket'         => MMED_R2_BUCKET,
					'Key'            => $r2_key,
					'ContentType'    => $mime_type,
					'ChecksumSHA256' => base64_encode( hex2bin( $sha256 ) ),
				)
			);
			return (string) $client->createPresignedRequest( $command, '+600 seconds' )->getUri();
		} catch ( \Throwable $error ) {
			return '';
		}
	}

	/**
	 * Issue a short-lived attachment-only download URL.
	 *
	 * @param string $r2_key Object key.
	 * @param string $filename Safe client filename.
	 * @return string
	 */
	protected static function presign_download_url( $r2_key, $filename ) {
		if ( defined( 'MMED_FILE_VAULT_V2_TESTING' ) && true === MMED_FILE_VAULT_V2_TESTING ) {
			return parent::presign_url( 'GET', $r2_key, 60 );
		}
		if ( ! class_exists( '\\Aws\\S3\\S3Client' ) ) {
			return '';
		}
		try {
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
				'GetObject',
				array(
					'Bucket'                     => MMED_R2_BUCKET,
					'Key'                        => $r2_key,
					'ResponseContentDisposition' => "attachment; filename*=UTF-8''" . rawurlencode( sanitize_file_name( $filename ) ),
				)
			);
			return (string) $client->createPresignedRequest( $command, '+60 seconds' )->getUri();
		} catch ( \Throwable $error ) {
			return '';
		}
	}

	/**
	 * Return one user's complete truthful V2 bootstrap.
	 *
	 * @param int    $user_id Target student ID.
	 * @param string $viewer_role Viewer role.
	 * @return array
	 */
	public static function bootstrap( $user_id, $viewer_role ) {
		$user_id   = absint( $user_id );
		$documents = $user_id ? self::list_documents( $user_id ) : array();
		$journey   = self::build_journey( $documents, $user_id );
		$activity  = self::build_activity( $documents );
		$user      = $user_id ? get_user_by( 'id', $user_id ) : null;

		return array(
			'viewer_role' => sanitize_key( $viewer_role ),
			'student'     => $user ? array(
				'id'           => absint( $user->ID ),
				'display_name' => sanitize_text_field( $user->display_name ?: 'Student' ),
			) : null,
			'documents'   => $documents,
			'journey'     => $journey,
			'library'     => array_values(
				array_filter(
					$documents,
					static function ( $document ) {
						return 'admin' === ( $document['category'] ?? '' );
					}
				)
			),
				'activity'    => $activity,
				'document_types' => self::document_type_labels(),
			'next_action' => self::next_action( $documents, $journey ),
			'storage'     => array(
				'ready'         => self::storage_ready(),
				'max_file_size' => self::MAX_FILE_SIZE,
				'extensions'    => array_keys( self::accepted_files() ),
				'contracts'     => self::upload_contracts(),
			),
			'rubrics'     => self::rubrics(),
		);
	}

	/**
	 * List V2-formatted documents for one student.
	 *
	 * @param int $user_id Student ID.
	 * @return array
	 */
	public static function list_documents( $user_id ) {
		global $wpdb;

		parent::maybe_install();
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . parent::table_name() . ' WHERE user_id = %d ORDER BY updated_at DESC, id DESC',
				absint( $user_id )
			)
		);

		return array_map( array( __CLASS__, 'format_document' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Return one document by numeric ID.
	 *
	 * @param int $file_id File ID.
	 * @return array|WP_Error
	 */
	public static function get_document( $file_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		return self::format_document( $row );
	}

	/**
	 * Return a document owner without exposing its object key.
	 *
	 * @param int $file_id File ID.
	 * @return int
	 */
	public static function owner_id( $file_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		return $row ? absint( $row->user_id ) : 0;
	}

	/**
	 * Return whether the current immutable version passed V2 verification.
	 *
	 * @param int $file_id File ID.
	 * @return bool
	 */
	public static function current_version_verified( $file_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return false;
		}
		$versions = self::internal_versions( $row, self::meta_for_row( $row ) );
		$current  = empty( $versions ) ? null : end( $versions );
		return is_array( $current ) && 'ready_clean' === sanitize_key( $current['verification_state'] ?? '' );
	}

	/**
	 * Record a V1 compatibility download for a V2-managed row.
	 *
	 * @param int $file_id File ID.
	 * @param int $actor_id Actor ID.
	 * @return true|WP_Error
	 */
	public static function record_compatibility_download( $file_id, $actor_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		$meta               = self::meta_for_row( $row );
		$meta['activity'][] = self::event( 'compatibility_download_issued', $actor_id, 'Secure compatibility download issued.' );
		return self::save_meta( $row, $meta );
	}

	/**
	 * Create a signed upload intent for a new document or version.
	 *
	 * @param int   $user_id Student owner.
	 * @param int   $actor_id Current actor.
	 * @param array $params Request fields.
	 * @param int   $file_id Existing file for a new version.
	 * @return array|WP_Error
	 */
	public static function create_upload_intent( $user_id, $actor_id, $params, $file_id = 0 ) {
		parent::maybe_install();
		if ( ! self::storage_ready() ) {
			return new WP_Error( 'mmed_file_vault_v2_storage_unavailable', 'Private file storage is unavailable.', array( 'status' => 503 ) );
		}

		$user_id  = absint( $user_id );
		$actor_id = absint( $actor_id );
		$file_id  = absint( $file_id );
		$row      = $file_id ? self::get_owned_file( $file_id, $user_id ) : null;
		if ( $file_id && ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		$row_meta      = $row ? self::meta_for_row( $row ) : array();
		$document_type = $row ? self::normalize_document_type( $row_meta['document_type'] ?? 'other' ) : self::normalize_document_type( $params['document_type'] ?? 'other' );
		$validated     = self::validate_upload( $params, $document_type );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}
		$owner_lock = self::issuance_owner_lock_key( $user_id );
		$actor_lock = self::issuance_actor_lock_key( $actor_id );
		if ( ! self::acquire_lock( $owner_lock ) ) {
			return new WP_Error( 'mmed_file_vault_v2_issue_in_progress', 'Another upload is being prepared for this Vault. Try again.', array( 'status' => 409 ) );
		}
		if ( ! self::acquire_lock( $actor_lock ) ) {
			delete_option( $owner_lock );
			return new WP_Error( 'mmed_file_vault_v2_issue_in_progress', 'Another upload is being prepared by this account. Try again.', array( 'status' => 409 ) );
		}

		try {
		$limit = self::check_upload_limits( $user_id, $actor_id, $validated['file_size'] );
		if ( is_wp_error( $limit ) ) {
			return $limit;
		}

		$upload_id     = wp_generate_uuid4();
		$confirm_token = self::random_token();
		$definition    = self::document_types()[ $document_type ];
		$category      = $row ? self::sanitize_category( $row->category, 'other' ) : $definition['category'];
		$version       = $row ? max( 1, absint( $row->version ) + 1 ) : 1;
		$extension     = strtolower( pathinfo( $validated['filename'], PATHINFO_EXTENSION ) );
		$version_uuid  = wp_generate_uuid4();
		$document_uuid = ! empty( $row_meta['document_uuid'] ) ? sanitize_text_field( $row_meta['document_uuid'] ) : wp_generate_uuid4();
		$filename      = 'MMED_' . $document_type . '_v' . $version . '_' . gmdate( 'Ymd_His' ) . '_' . substr( $version_uuid, 0, 8 ) . '.' . $extension;
		$r2_key        = 'student-files/v2/staging/' . $upload_id . '.' . $extension;
		$intent        = array(
			'upload_id'        => $upload_id,
			'token_hash'       => hash( 'sha256', $confirm_token ),
			'user_id'          => $user_id,
			'actor_id'         => $actor_id,
			'file_id'          => $file_id,
			'filename'         => $filename,
			'original_name'    => $validated['filename'],
			'mime_type'        => $validated['mime_type'],
			'declared_size'    => $validated['file_size'],
			'max_size'         => $validated['max_size'],
			'declared_sha256'  => $validated['sha256'],
			'category'         => $category,
			'document_type'    => $document_type,
			'display_name'     => sanitize_text_field( $params['display_name'] ?? $definition['label'] ),
			'note'             => sanitize_textarea_field( $params['note'] ?? '' ),
			'ready_for_review' => rest_sanitize_boolean( $params['ready_for_review'] ?? false ),
			'version'          => $version,
			'document_uuid'    => $document_uuid,
			'version_uuid'     => $version_uuid,
			'r2_key'           => $r2_key,
			'final_r2_key'     => 'student-files/v2/objects/' . $document_uuid . '/' . $version_uuid . '.' . $extension,
			'created_at'       => gmdate( 'c' ),
		);

		$upload_url = self::presign_upload_url( $r2_key, $validated['mime_type'], $validated['sha256'] );
		if ( '' === $upload_url ) {
			return new WP_Error( 'mmed_file_vault_v2_r2_adapter_unavailable', 'A private upload URL could not be issued.', array( 'status' => 503 ) );
		}
		if ( ! set_transient( self::intent_key( $upload_id ), $intent, self::INTENT_TTL ) ) {
			return new WP_Error( 'mmed_file_vault_v2_intent_unavailable', 'The private upload session could not be stored.', array( 'status' => 503 ) );
		}
		if ( ! self::record_upload_issuance( $user_id, $actor_id, $upload_id, $validated['file_size'] ) ) {
			delete_transient( self::intent_key( $upload_id ) );
			return new WP_Error( 'mmed_file_vault_v2_intent_unavailable', 'The private upload reservation could not be stored.', array( 'status' => 503 ) );
		}

		return array(
			'upload_id'  => $upload_id,
			'confirm_token' => $confirm_token,
			'upload_url' => $upload_url,
			'canonical_name' => $filename,
			'expires'    => 600,
			'version'    => $version,
			'max_size'   => $validated['max_size'],
			'required_headers' => array(
				'Content-Type'          => $validated['mime_type'],
				'x-amz-checksum-sha256' => base64_encode( hex2bin( $validated['sha256'] ) ),
				),
			);
		} finally {
			delete_option( $actor_lock );
			delete_option( $owner_lock );
		}
	}

	/**
	 * Confirm an upload only after R2 reports the object through a signed HEAD.
	 *
	 * @param string $upload_id Upload UUID.
	 * @param string $confirm_token One-time confirmation secret.
	 * @param int    $actor_id Current actor.
	 * @return array|WP_Error
	 */
	public static function confirm_upload_intent( $upload_id, $confirm_token, $actor_id ) {
		global $wpdb;

		$upload_id    = strtolower( trim( (string) $upload_id ) );
		$supplied_hash = hash( 'sha256', (string) $confirm_token );
		if ( ! preg_match( '/^[a-f0-9-]{36}$/', $upload_id ) || ! preg_match( '/^[a-f0-9]{64}$/', (string) $confirm_token ) ) {
			return new WP_Error( 'mmed_file_vault_v2_intent_missing', 'Upload session not found.', array( 'status' => 404 ) );
		}
		$completed = get_transient( self::completed_key( $upload_id ) );
		if ( is_array( $completed ) ) {
			if ( absint( $completed['actor_id'] ?? 0 ) !== absint( $actor_id ) || ! hash_equals( (string) ( $completed['token_hash'] ?? '' ), $supplied_hash ) ) {
				return new WP_Error( 'mmed_file_vault_v2_intent_missing', 'Upload session not found.', array( 'status' => 404 ) );
			}
			return self::get_document( absint( $completed['file_id'] ?? 0 ) );
		}

		$intent = get_transient( self::intent_key( $upload_id ) );
		if ( ! is_array( $intent ) || ! hash_equals( (string) ( $intent['upload_id'] ?? '' ), $upload_id ) || ! hash_equals( (string) ( $intent['token_hash'] ?? '' ), $supplied_hash ) ) {
			return new WP_Error( 'mmed_file_vault_v2_intent_missing', 'Upload session not found.', array( 'status' => 404 ) );
		}
		if ( absint( $intent['actor_id'] ?? 0 ) !== absint( $actor_id ) ) {
			return new WP_Error( 'mmed_file_vault_v2_intent_forbidden', 'This upload session belongs to another user.', array( 'status' => 403 ) );
		}
		if ( absint( $intent['user_id'] ?? 0 ) !== absint( $actor_id ) && ! user_can( absint( $actor_id ), 'mmed_manage_file_vault' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_intent_forbidden', 'Your current role no longer permits finalizing this upload for another user.', array( 'status' => 403 ) );
		}
		$lock_key = self::confirm_lock_key( absint( $intent['user_id'] ?? 0 ) );
		$lock_token = self::acquire_owned_lock( $lock_key, self::INTENT_TTL );
		if ( ! $lock_token ) {
			return new WP_Error( 'mmed_file_vault_v2_confirm_in_progress', 'This upload is already being finalized.', array( 'status' => 409 ) );
		}
		$promoted_key = '';
		$persisted    = false;

		try {

		$probe = self::verify_object( $intent );
		if ( is_wp_error( $probe ) ) {
			if ( 422 === absint( $probe->get_error_data()['status'] ?? 0 ) ) {
				self::abandon_upload_intent( $intent );
			}
			return $probe;
		}
		$scan = self::scan_object( $intent, $probe );
		if ( is_wp_error( $scan ) ) {
			if ( 422 === absint( $scan->get_error_data()['status'] ?? 0 ) ) {
				self::abandon_upload_intent( $intent );
			}
			return $scan;
		}
		$quota = self::check_confirm_quota( absint( $intent['user_id'] ), $upload_id, absint( $probe['size'] ?? 0 ) );
		if ( is_wp_error( $quota ) ) {
			self::abandon_upload_intent( $intent );
			return $quota;
		}
		$file_id = absint( $intent['file_id'] ?? 0 );
		if ( $file_id ) {
			$current_row = self::get_owned_file( $file_id, absint( $intent['user_id'] ) );
			if ( ! $current_row ) {
				self::abandon_upload_intent( $intent );
				return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
			}
			if ( absint( $intent['version'] ) !== max( 1, absint( $current_row->version ) + 1 ) ) {
				self::abandon_upload_intent( $intent );
				return new WP_Error( 'mmed_file_vault_v2_version_conflict', 'A newer version was finalized first. Start this version upload again.', array( 'status' => 409 ) );
			}
		}
		$promoted = self::promote_object( $intent, $probe, $scan );
		if ( is_wp_error( $promoted ) ) {
			self::abandon_upload_intent( $intent, true );
			return $promoted;
		}
		$probe            = $promoted;
		$intent['r2_key'] = $promoted['r2_key'];
		$promoted_key     = (string) $promoted['r2_key'];

		$status  = ! empty( $intent['ready_for_review'] ) ? 'submitted' : 'draft';
		$now     = current_time( 'mysql' );
		$event   = self::event( $file_id ? 'version_uploaded' : 'document_uploaded', $actor_id, $file_id ? 'New version uploaded.' : 'Document uploaded.' );

		if ( $file_id ) {
			$row = self::get_owned_file( $file_id, absint( $intent['user_id'] ) );
			if ( ! $row ) {
				return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
			}
			if ( absint( $intent['version'] ) !== max( 1, absint( $row->version ) + 1 ) ) {
				return new WP_Error( 'mmed_file_vault_v2_version_conflict', 'A newer version was finalized first. Start this version upload again.', array( 'status' => 409 ) );
			}
			$meta             = self::meta_for_row( $row );
			$meta['document_uuid'] = sanitize_text_field( $intent['document_uuid'] );
			$meta['versions'] = self::internal_versions( $row, $meta );
			$meta['versions'][] = self::version_entry( $intent, $probe, $actor_id );
			$meta['workflow_status'] = $status;
			$meta['note']             = sanitize_textarea_field( $intent['note'] ?? '' );
			$meta['activity'][]       = $event;
			$updated = $wpdb->update(
				parent::table_name(),
				array(
					'filename'      => $intent['filename'],
					'original_name' => $intent['original_name'],
					'r2_key'        => $intent['r2_key'],
					'mime_type'     => $intent['mime_type'],
					'file_size'     => absint( $probe['size'] ),
					'version'       => absint( $intent['version'] ),
					'status'        => self::legacy_status( $status ),
					'meta_json'     => self::merge_meta_json( $row, $meta ),
					'updated_at'    => $now,
				),
				array(
					'id'        => $file_id,
					'user_id'   => absint( $intent['user_id'] ),
					'version'   => absint( $row->version ),
					'meta_json' => isset( $row->meta_json ) ? $row->meta_json : null,
				),
				array( '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s', '%s' ),
				array( '%d', '%d', '%d', '%s' )
			);
			if ( 0 === $updated ) {
				return new WP_Error( 'mmed_file_vault_v2_version_conflict', 'The document changed while this version was finalizing. Start the version upload again.', array( 'status' => 409 ) );
			}
			if ( false === $updated ) {
				return new WP_Error( 'mmed_file_vault_v2_confirm_failed', 'The uploaded version could not be finalized.', array( 'status' => 500 ) );
			}
		} else {
			$meta = self::empty_meta();
			$meta['document_type']  = self::normalize_document_type( $intent['document_type'] );
			$meta['document_uuid']  = sanitize_text_field( $intent['document_uuid'] );
			$meta['display_name']   = sanitize_text_field( $intent['display_name'] );
			$meta['note']           = sanitize_textarea_field( $intent['note'] );
			$meta['workflow_status'] = $status;
			$meta['versions'][]     = self::version_entry( $intent, $probe, $actor_id );
			$meta['activity'][]     = $event;
			$inserted = $wpdb->insert(
				parent::table_name(),
				array(
					'user_id'       => absint( $intent['user_id'] ),
					'filename'      => $intent['filename'],
					'original_name' => $intent['original_name'],
					'r2_key'        => $intent['r2_key'],
					'mime_type'     => $intent['mime_type'],
					'file_size'     => absint( $probe['size'] ),
					'category'      => $intent['category'],
					'version'       => 1,
					'status'        => self::legacy_status( $status ),
					'meta_json'     => wp_json_encode( array( self::META_KEY => $meta ) ),
					'created_at'    => $now,
					'updated_at'    => $now,
				),
				array( '%d', '%s', '%s', '%s', '%s', '%d', '%s', '%d', '%s', '%s', '%s', '%s' )
			);
			if ( false === $inserted ) {
				return new WP_Error( 'mmed_file_vault_v2_confirm_failed', 'The uploaded document could not be finalized.', array( 'status' => 500 ) );
			}
			$file_id = absint( $wpdb->insert_id );
		}
		$persisted = true;

		delete_transient( self::intent_key( $upload_id ) );
		self::remove_pending_upload( absint( $intent['user_id'] ), $upload_id );
		set_transient(
			self::completed_key( $upload_id ),
			array(
				'file_id'    => $file_id,
				'actor_id'   => absint( $actor_id ),
				'token_hash' => $supplied_hash,
			),
			300
		);
		do_action( 'mmed_file_uploaded', $file_id, absint( $intent['user_id'] ) );

			return self::get_document( $file_id );
			} finally {
				if ( $promoted_key && ! $persisted ) {
					self::delete_private_object( $promoted_key );
					self::abandon_upload_intent( $intent );
				}
				self::release_owned_lock( $lock_key, $lock_token );
			}
	}

	/**
	 * Issue a signed download for an authorized current or historical version.
	 *
	 * @param int $file_id File ID.
	 * @param int $version Version number, or zero for current.
	 * @param int $actor_id Actor ID for audit.
	 * @return array|WP_Error
	 */
	public static function download( $file_id, $version, $actor_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		if ( ! self::storage_ready() ) {
			return new WP_Error( 'mmed_file_vault_v2_storage_unavailable', 'Private file storage is unavailable.', array( 'status' => 503 ) );
		}

		$meta     = self::meta_for_row( $row );
		$versions = self::internal_versions( $row, $meta );
		$selected = end( $versions );
		if ( absint( $version ) ) {
			$selected = null;
			foreach ( $versions as $candidate ) {
				if ( absint( $candidate['number'] ?? 0 ) === absint( $version ) ) {
					$selected = $candidate;
					break;
				}
			}
		}
		if ( ! $selected || empty( $selected['r2_key'] ) ) {
			return new WP_Error( 'mmed_file_vault_v2_version_not_found', 'Document version not found.', array( 'status' => 404 ) );
		}
		if ( 'ready_clean' !== sanitize_key( $selected['verification_state'] ?? '' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_download_unverified', 'This legacy or unverified file is available only through the unchanged V1 fallback.', array( 'status' => 409 ) );
		}

		$download_name = sanitize_file_name( $selected['original_name'] ?? $row->original_name );
		$url = self::presign_download_url( $selected['r2_key'], $download_name );
		if ( '' === $url ) {
			return new WP_Error( 'mmed_file_vault_v2_r2_adapter_unavailable', 'A private download URL could not be issued.', array( 'status' => 503 ) );
		}
		$meta['activity'][] = self::event( 'download_issued', $actor_id, 'Secure download issued.' );
		$saved = self::save_meta( $row, $meta );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		return array(
			'url'      => $url,
			'expires'  => 60,
			'version'  => absint( $selected['number'] ?? $row->version ),
			'filename' => $download_name,
		);
	}

	/**
	 * Add a comment to a document.
	 *
	 * @param int    $file_id File ID.
	 * @param int    $actor_id Actor ID.
	 * @param string $role Actor role.
	 * @param string $body Comment body.
	 * @return array|WP_Error
	 */
	public static function add_comment( $file_id, $actor_id, $role, $body ) {
		$row  = self::get_file_by_id( absint( $file_id ) );
		$body = trim( sanitize_textarea_field( $body ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		if ( '' === $body || strlen( $body ) > 2000 ) {
			return new WP_Error( 'mmed_file_vault_v2_comment_invalid', 'Comment text must be between 1 and 2,000 characters.', array( 'status' => 422 ) );
		}

		$meta    = self::meta_for_row( $row );
		$comment = array(
			'id'          => wp_generate_uuid4(),
			'author_id'   => absint( $actor_id ),
			'author_name' => self::actor_name( $actor_id ),
			'author_role' => sanitize_key( $role ),
			'version'     => max( 1, absint( $row->version ) ),
			'body'        => $body,
			'resolved'    => false,
			'created_at'  => gmdate( 'c' ),
		);
		$meta['comments'][] = $comment;
		$meta['activity'][] = self::event( 'comment_added', $actor_id, 'Comment added.' );
		$saved = self::save_meta( $row, $meta );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		return self::public_comment( $comment );
	}

	/**
	 * Resolve a comment.
	 *
	 * @param int    $file_id File ID.
	 * @param string $comment_id Comment UUID.
	 * @param int    $actor_id Actor ID.
	 * @return array|WP_Error
	 */
	public static function resolve_comment( $file_id, $comment_id, $actor_id ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		$meta  = self::meta_for_row( $row );
		$found = null;
		foreach ( $meta['comments'] as &$comment ) {
			if ( hash_equals( (string) ( $comment['id'] ?? '' ), (string) $comment_id ) ) {
				$comment['resolved']    = true;
				$comment['resolved_at'] = gmdate( 'c' );
				$comment['resolved_by'] = absint( $actor_id );
				$found                  = $comment;
				break;
			}
		}
		unset( $comment );
		if ( ! $found ) {
			return new WP_Error( 'mmed_file_vault_v2_comment_not_found', 'Comment not found.', array( 'status' => 404 ) );
		}
		$meta['activity'][] = self::event( 'comment_resolved', $actor_id, 'Comment resolved.' );
		$saved = self::save_meta( $row, $meta );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		return self::public_comment( $found );
	}

	/**
	 * Update workflow status while preserving a V1-compatible status.
	 *
	 * @param int    $file_id File ID.
	 * @param string $status V2 status.
	 * @param int    $actor_id Actor ID.
	 * @param string $note Optional review note.
	 * @return array|WP_Error
	 */
	public static function update_status( $file_id, $status, $actor_id, $note = '' ) {
		global $wpdb;

		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		$status = self::normalize_workflow_status( $status, '' );
		if ( ! $status ) {
			return new WP_Error( 'mmed_file_vault_v2_status_invalid', 'Workflow status is invalid.', array( 'status' => 422 ) );
		}
		$meta                    = self::meta_for_row( $row );
		$previous                = $meta['workflow_status'];
		$transitions             = self::status_transitions();
		if ( $status !== $previous && ! in_array( $status, $transitions[ $previous ] ?? array(), true ) ) {
			return new WP_Error( 'mmed_file_vault_v2_status_transition', 'That review status transition is not allowed.', array( 'status' => 409 ) );
		}
		$meta['workflow_status'] = $status;
		$meta['review_note']     = sanitize_textarea_field( $note );
		$meta['versions']        = self::internal_versions( $row, $meta );
		for ( $index = count( $meta['versions'] ) - 1; $index >= 0; --$index ) {
			if ( absint( $meta['versions'][ $index ]['number'] ?? 0 ) === max( 1, absint( $row->version ) ) ) {
				$meta['versions'][ $index ]['verdict'] = $status;
				break;
			}
		}
		$meta['activity'][]      = self::event( 'status_changed', $actor_id, 'Status changed from ' . $previous . ' to ' . $status . '.' );
		$updated = $wpdb->update(
			parent::table_name(),
			array(
				'status'      => self::legacy_status( $status ),
				'reviewed_by' => absint( $actor_id ),
				'reviewed_at' => current_time( 'mysql' ),
				'meta_json'   => self::merge_meta_json( $row, $meta ),
				'updated_at'  => current_time( 'mysql' ),
			),
			array(
				'id'        => absint( $file_id ),
				'status'    => (string) $row->status,
				'meta_json' => isset( $row->meta_json ) ? $row->meta_json : null,
			),
			array( '%s', '%d', '%s', '%s', '%s' ),
			array( '%d', '%s', '%s' )
		);
		if ( 0 === $updated ) {
			return new WP_Error( 'mmed_file_vault_v2_write_conflict', 'The document changed while this review was being saved. Reload and try again.', array( 'status' => 409 ) );
		}
		if ( false === $updated ) {
			return new WP_Error( 'mmed_file_vault_v2_status_failed', 'Status could not be updated.', array( 'status' => 500 ) );
		}
		do_action( 'mmed_status_changed', absint( $file_id ), $previous, $status );
		return self::get_document( $file_id );
	}

	/**
	 * Add a staff score and rubric payload.
	 *
	 * @param int   $file_id File ID.
	 * @param int   $actor_id Actor ID.
	 * @param array $params Score payload.
	 * @return array|WP_Error
	 */
	public static function add_score( $file_id, $actor_id, $params ) {
		$row = self::get_file_by_id( absint( $file_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		$meta   = self::meta_for_row( $row );
		$rubric = self::rubric( $meta['document_type'] );
		if ( empty( $rubric ) ) {
			return new WP_Error( 'mmed_file_vault_v2_rubric_unavailable', 'A review rubric has not been configured for this document type.', array( 'status' => 503 ) );
		}
		$submitted = (array) ( $params['category_scores'] ?? array() );
		$categories = array();
		foreach ( $rubric as $label ) {
			$key = self::rubric_key( $label );
			if ( ! $key || ! array_key_exists( $key, $submitted ) ) {
				return new WP_Error( 'mmed_file_vault_v2_score_incomplete', 'Every configured rubric category requires a score.', array( 'status' => 422 ) );
			}
			$categories[ $key ] = min( 10, max( 0, absint( $submitted[ $key ] ) ) );
		}
		$maximum = count( $rubric ) * 10;
		$total   = min( $maximum, array_sum( $categories ) );
		$score = array(
			'id'              => wp_generate_uuid4(),
			'total_score'     => $total,
			'max_score'       => $maximum,
			'document_type'   => self::normalize_document_type( $meta['document_type'] ),
			'version'         => max( 1, absint( $row->version ) ),
			'category_scores' => $categories,
			'readiness_label' => self::score_label( $total ),
			'notes'           => sanitize_textarea_field( $params['notes'] ?? '' ),
			'scorer_name'     => self::actor_name( $actor_id ),
			'created_at'      => gmdate( 'c' ),
		);
		$meta['scores'][]   = $score;
		$meta['activity'][] = self::event( 'score_added', $actor_id, 'Review score added.' );
		$saved = self::save_meta( $row, $meta );
		if ( is_wp_error( $saved ) ) {
			return $saved;
		}
		return $score;
	}

	/**
	 * List students visible to an admin or mentor.
	 *
	 * @param string $viewer_role Viewer role.
	 * @param int    $viewer_id Viewer ID.
	 * @param string $search Search term.
	 * @return array|WP_Error
	 */
	public static function list_students( $viewer_role, $viewer_id, $search = '' ) {
		$scope = self::staff_scope( $viewer_role, $viewer_id, $search );
		return is_wp_error( $scope ) ? $scope : $scope['students'];
	}

	/**
	 * Load one staff-visible roster, queue, and audit feed with one document query.
	 *
	 * @param string $viewer_role Viewer role.
	 * @param int    $viewer_id Viewer ID.
	 * @param string $search Search term.
	 * @param int    $page One-based roster page.
	 * @param int    $per_page Bounded roster page size.
	 * @param bool   $include_audit Build bounded operational event data.
	 * @return array|WP_Error
	 */
	public static function staff_scope( $viewer_role, $viewer_id, $search = '', $page = 1, $per_page = self::STAFF_PAGE_SIZE, $include_audit = false ) {
		global $wpdb;

		$page     = max( 1, absint( $page ) );
		$per_page = absint( $per_page );
		$per_page = $per_page ? min( self::STAFF_PAGE_SIZE, $per_page ) : self::STAFF_PAGE_SIZE;
		$empty = array(
			'students'     => array(),
			'review_queue' => array(),
			'audit_events' => array(),
			'pagination'   => array(
				'page'           => $page,
				'per_page'       => $per_page,
				'has_more'       => false,
				'next_page'      => null,
				'scope_complete' => true,
			),
		);
		$viewer_role = sanitize_key( $viewer_role );
		if ( ! in_array( $viewer_role, array( 'admin', 'mentor' ), true ) ) {
			return $empty;
		}

		$args = array(
			'number'       => $per_page + 1,
			'offset'       => ( $page - 1 ) * $per_page,
			'orderby'      => 'display_name',
			'order'        => 'ASC',
			'role__not_in' => array( 'administrator' ),
			'fields'       => array( 'ID', 'display_name' ),
		);
		$search = sanitize_text_field( $search );
		if ( $search ) {
			$args['search']         = '*' . esc_attr( $search ) . '*';
			$args['search_columns'] = array( 'display_name', 'user_login', 'user_email' );
		}
		if ( 'mentor' === $viewer_role ) {
			$args['meta_key']   = '_mmed_file_vault_mentor_id';
			$args['meta_value'] = absint( $viewer_id );
		}

		$users       = array_values( (array) get_users( $args ) );
		$has_more    = count( $users ) > $per_page;
		$users       = array_slice( $users, 0, $per_page );
		$student_ids = array_values(
			array_unique(
				array_filter(
					array_map(
						static function ( $user ) {
							return isset( $user->ID ) ? absint( $user->ID ) : 0;
						},
						$users
					)
				)
			)
		);
		$documents_by_student = array_fill_keys( $student_ids, array() );
		if ( ! empty( $student_ids ) ) {
			parent::maybe_install();
			$placeholders = implode( ', ', array_fill( 0, count( $student_ids ), '%d' ) );
			$rows         = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM ' . parent::table_name() . ' WHERE user_id IN (' . $placeholders . ') ORDER BY user_id ASC, updated_at DESC, id DESC LIMIT %d',
					array_merge( $student_ids, array( self::STAFF_DOCUMENT_LIMIT + 1 ) )
				)
			);
			if ( count( (array) $rows ) > self::STAFF_DOCUMENT_LIMIT ) {
				return new WP_Error( 'mmed_file_vault_v2_staff_scope_too_large', 'This staff roster page contains too many document records. Narrow the student search or page size.', array( 'status' => 503 ) );
			}
			$meta_bytes = 0;
			foreach ( (array) $rows as $row ) {
				$meta_bytes += strlen( (string) ( $row->meta_json ?? '' ) );
				if ( $meta_bytes > self::STAFF_META_BYTES_LIMIT ) {
					return new WP_Error( 'mmed_file_vault_v2_staff_payload_too_large', 'This staff roster page contains too much document metadata. Narrow the student search or page size.', array( 'status' => 503 ) );
				}
				$owner_id = absint( $row->user_id ?? 0 );
				if ( isset( $documents_by_student[ $owner_id ] ) ) {
					$documents_by_student[ $owner_id ][] = self::format_staff_document( $row, $include_audit );
				}
			}
		}

		$students = array();
		$queue    = array();
		$events   = array();
		foreach ( $users as $user ) {
			$student_id = isset( $user->ID ) ? absint( $user->ID ) : 0;
			if ( ! $student_id ) {
				continue;
			}
			$documents = $documents_by_student[ $student_id ] ?? array();
			$journey   = self::build_journey( $documents, $user->ID );
			$student   = array(
				'id'               => $student_id,
				'display_name'     => sanitize_text_field( $user->display_name ?: 'Student' ),
				'document_count'   => count( $documents ),
				'coverage_percent' => absint( $journey['coverage_percent'] ?? 0 ),
				'needs_attention'  => count(
					array_filter(
						$documents,
						static function ( $document ) {
							return in_array( $document['status'] ?? '', array( 'submitted', 'needs_changes' ), true );
						}
					)
				),
			);
			$students[] = $student;
			foreach ( $documents as $document ) {
				if ( in_array( $document['status'], array( 'submitted', 'in_review', 'needs_changes' ), true ) ) {
					$queue_document            = $document;
					$queue_document['student'] = array( 'id' => $student['id'], 'display_name' => $student['display_name'] );
					$queue[]                    = $queue_document;
				}
				if ( $include_audit ) {
					foreach ( (array) ( $document['activity'] ?? array() ) as $event ) {
						$event['document_id']   = $document['id'];
						$event['document_name'] = $document['name'];
						$event['student']       = $student;
						if ( empty( $event['id'] ) ) {
							$event['id'] = hash( 'sha256', $document['id'] . '|' . ( $event['at'] ?? '' ) . '|' . ( $event['type'] ?? '' ) . '|' . ( $event['message'] ?? '' ) );
						}
						$events[] = $event;
						if ( count( $events ) > self::STAFF_EVENT_LIMIT ) {
							return new WP_Error( 'mmed_file_vault_v2_audit_scope_too_large', 'This roster page contains too many operational events. Narrow the roster page size.', array( 'status' => 503 ) );
						}
					}
				}
			}
		}
		usort(
			$queue,
			static function ( $left, $right ) {
				return strcmp( (string) ( $left['updated_at'] ?? '' ), (string) ( $right['updated_at'] ?? '' ) );
			}
		);
		usort(
			$events,
			static function ( $left, $right ) {
				$left_time  = strtotime( (string) ( $left['at'] ?? '' ) );
				$right_time = strtotime( (string) ( $right['at'] ?? '' ) );
				$time_order = ( false === $right_time ? 0 : $right_time ) <=> ( false === $left_time ? 0 : $left_time );
				return 0 !== $time_order ? $time_order : strcmp( (string) ( $right['id'] ?? '' ), (string) ( $left['id'] ?? '' ) );
			}
		);
		return array(
			'students'     => $students,
			'review_queue' => $queue,
			'audit_events' => $events,
			'pagination'   => array(
				'page'           => $page,
				'per_page'       => $per_page,
				'has_more'       => $has_more,
				'next_page'      => $has_more ? $page + 1 : null,
				'scope_complete' => ! $has_more,
			),
		);
	}

	/**
	 * Return submitted/active review documents for visible students.
	 *
	 * @param string $viewer_role Viewer role.
	 * @param int    $viewer_id Viewer ID.
	 * @param int    $page One-based roster page.
	 * @param int    $per_page Bounded roster page size.
	 * @return array|WP_Error
	 */
	public static function review_queue( $viewer_role, $viewer_id, $page = 1, $per_page = self::STAFF_PAGE_SIZE ) {
		$scope = self::staff_scope( $viewer_role, $viewer_id, '', $page, $per_page );
		return is_wp_error( $scope ) ? $scope : $scope['review_queue'];
	}

	/**
	 * Return one stable cursor page of operational events for a roster page.
	 *
	 * @param string $viewer_role Viewer role.
	 * @param int    $viewer_id Viewer ID.
	 * @param int    $page One-based roster page.
	 * @param int    $per_page Bounded roster page size.
	 * @param string $before_at Cursor timestamp within the roster page.
	 * @param string $before_id Cursor event ID within the roster page.
	 * @param int    $event_limit Bounded event page size.
	 * @return array|WP_Error
	 */
	public static function audit_scope( $viewer_role, $viewer_id, $page = 1, $per_page = self::STAFF_PAGE_SIZE, $before_at = '', $before_id = '', $event_limit = self::STAFF_EVENT_PAGE_SIZE ) {
		$page        = max( 1, absint( $page ) );
		$event_limit = absint( $event_limit );
		$event_limit = $event_limit ? min( self::STAFF_EVENT_PAGE_SIZE, $event_limit ) : self::STAFF_EVENT_PAGE_SIZE;
		$scope       = self::staff_scope( $viewer_role, $viewer_id, '', $page, $per_page, true );
		if ( is_wp_error( $scope ) ) {
			return $scope;
		}

		$before_at        = trim( sanitize_text_field( $before_at ) );
		$before_id        = trim( sanitize_text_field( $before_id ) );
		$before_timestamp = false;
		if ( ( '' === $before_at ) !== ( '' === $before_id ) ) {
			return new WP_Error( 'mmed_file_vault_v2_audit_cursor_invalid', 'The operational event cursor is invalid.', array( 'status' => 422 ) );
		}
		if ( $before_at ) {
			$before_timestamp = strtotime( $before_at );
			if ( false === $before_timestamp || ! preg_match( '/^[A-Za-z0-9_-]{8,128}$/', $before_id ) ) {
				return new WP_Error( 'mmed_file_vault_v2_audit_cursor_invalid', 'The operational event cursor is invalid.', array( 'status' => 422 ) );
			}
		}

		$events = $scope['audit_events'];
		if ( $before_at ) {
			$events = array_values(
				array_filter(
					$events,
					static function ( $event ) use ( $before_timestamp, $before_id ) {
						$event_timestamp = strtotime( (string) ( $event['at'] ?? '' ) );
						$event_id        = (string) ( $event['id'] ?? '' );
						if ( false === $event_timestamp ) {
							return true;
						}
						return $event_timestamp < $before_timestamp || ( $event_timestamp === $before_timestamp && strcmp( $event_id, $before_id ) < 0 );
					}
				)
			);
		}

		$chunk           = array_slice( $events, 0, $event_limit );
		$more_on_page    = count( $events ) > $event_limit;
		$more_roster     = ! empty( $scope['pagination']['has_more'] );
		$last_event      = empty( $chunk ) ? null : end( $chunk );
		$has_more        = $more_on_page || $more_roster;
		$next_page       = $more_on_page ? $page : ( $more_roster ? absint( $scope['pagination']['next_page'] ) : null );
		$next_before_at  = $more_on_page && $last_event ? (string) ( $last_event['at'] ?? '' ) : '';
		$next_before_id  = $more_on_page && $last_event ? (string) ( $last_event['id'] ?? '' ) : '';

		return array(
			'events'     => $chunk,
			'pagination' => array(
				'page'            => $page,
				'per_page'        => absint( $scope['pagination']['per_page'] ?? self::STAFF_PAGE_SIZE ),
				'event_limit'     => $event_limit,
				'has_more'        => $has_more,
				'next_page'       => $next_page,
				'next_before_at'  => $next_before_at,
				'next_before_id'  => $next_before_id,
				'scope_complete'  => ! $has_more,
			),
		);
	}

	/**
	 * Aggregate the first stable operational event page for compatibility callers.
	 *
	 * @param string $viewer_role Viewer role.
	 * @param int    $viewer_id Viewer ID.
	 * @param int    $page One-based roster page.
	 * @param int    $per_page Bounded roster page size.
	 * @return array|WP_Error
	 */
	public static function audit_feed( $viewer_role, $viewer_id, $page = 1, $per_page = self::STAFF_PAGE_SIZE ) {
		$scope = self::audit_scope( $viewer_role, $viewer_id, $page, $per_page );
		return is_wp_error( $scope ) ? $scope : $scope['events'];
	}

	/**
	 * Check one mentor-to-student assignment.
	 *
	 * @param int $mentor_id Mentor ID.
	 * @param int $student_id Student ID.
	 * @return true|WP_Error
	 */
	public static function mentor_can_view( $mentor_id, $student_id ) {
		$mentor_id  = absint( $mentor_id );
		$student_id = absint( $student_id );
		return $mentor_id && $student_id && absint( get_user_meta( $student_id, '_mmed_file_vault_mentor_id', true ) ) === $mentor_id;
	}

	/**
	 * Format a row without exposing R2 object keys.
	 *
	 * @param object $row Database row.
	 * @return array
	 */
	protected static function format_document( $row ) {
		$meta     = self::meta_for_row( $row );
		$versions = self::internal_versions( $row, $meta );
		$comments = array_values( array_map( array( __CLASS__, 'public_comment' ), (array) $meta['comments'] ) );
		$scores   = array_values( (array) $meta['scores'] );
		$latest   = empty( $scores ) ? null : end( $scores );
		$public_versions = array_values( array_map( array( __CLASS__, 'public_version' ), $versions ) );
		$current_version = empty( $versions ) ? array() : end( $versions );
		foreach ( $public_versions as &$version ) {
			foreach ( array_reverse( $scores ) as $score ) {
				if ( absint( $score['version'] ?? 0 ) === absint( $version['number'] ?? 0 ) ) {
					$version['score']     = absint( $score['total_score'] ?? 0 );
					$version['score_max'] = max( 1, absint( $score['max_score'] ?? 100 ) );
					break;
				}
			}
		}
		unset( $version );
		return array(
			'id'                => absint( $row->id ),
			'name'              => sanitize_text_field( $meta['display_name'] ?: $row->original_name ),
			'original_name'     => sanitize_file_name( $row->original_name ),
			'canonical_name'    => sanitize_file_name( $row->filename ),
			'document_type'     => self::normalize_document_type( $meta['document_type'] ),
			'category'          => sanitize_key( $row->category ),
			'mime_type'         => sanitize_text_field( $row->mime_type ),
			'file_size'         => absint( $row->file_size ),
			'version'           => max( 1, absint( $row->version ) ),
			'status'            => self::normalize_workflow_status( $meta['workflow_status'], self::workflow_from_legacy( $row->status ) ),
			'status_label'      => self::status_label( $meta['workflow_status'] ),
			'note'              => sanitize_textarea_field( $meta['note'] ),
			'review_note'       => sanitize_textarea_field( $meta['review_note'] ),
			'created_at'        => mysql_to_rfc3339( $row->created_at ),
			'updated_at'        => mysql_to_rfc3339( $row->updated_at ),
			'versions'          => $public_versions,
			'comments'          => $comments,
			'open_comment_count'=> count(
				array_filter(
					$comments,
					static function ( $comment ) {
						return empty( $comment['resolved'] );
					}
				)
			),
			'scores'            => $scores,
			'latest_score'      => $latest ?: null,
				'activity'          => array_values( (array) $meta['activity'] ),
				'verification_state'=> sanitize_key( $current_version['verification_state'] ?? 'legacy_unverified' ),
				'download_available'=> self::storage_ready() && 'ready_clean' === sanitize_key( $current_version['verification_state'] ?? '' ),
		);
	}

	/**
	 * Format the compact document projection used by bounded staff list routes.
	 *
	 * @param object $row Database row.
	 * @param bool   $include_activity Include operational events for the audit cursor.
	 * @return array
	 */
	protected static function format_staff_document( $row, $include_activity = false ) {
		$meta   = self::meta_for_row( $row );
		$status = self::normalize_workflow_status( $meta['workflow_status'], self::workflow_from_legacy( $row->status ) );
		$document = array(
			'id'            => absint( $row->id ),
			'name'          => sanitize_text_field( $meta['display_name'] ?: $row->original_name ),
			'document_type' => self::normalize_document_type( $meta['document_type'] ),
			'file_size'     => absint( $row->file_size ),
			'version'       => max( 1, absint( $row->version ) ),
			'status'        => $status,
			'status_label'  => self::status_label( $status ),
			'updated_at'    => mysql_to_rfc3339( $row->updated_at ),
		);
		if ( $include_activity ) {
			$document['activity'] = array_values( (array) $meta['activity'] );
		}
		return $document;
	}

	/**
	 * Decode V2 metadata and synthesize truthful defaults for legacy rows.
	 *
	 * @param object $row Database row.
	 * @return array
	 */
	protected static function meta_for_row( $row ) {
		$root = array();
		if ( ! empty( $row->meta_json ) ) {
			$decoded = json_decode( (string) $row->meta_json, true );
			$root    = is_array( $decoded ) ? $decoded : array();
		}
		$has_v2_meta = isset( $root[ self::META_KEY ] ) && is_array( $root[ self::META_KEY ] );
		$meta = $has_v2_meta ? $root[ self::META_KEY ] : array();
		$meta = array_merge( self::empty_meta(), $meta );
		$meta['document_type']   = self::normalize_document_type( $meta['document_type'] );
		$meta['display_name']    = sanitize_text_field( $meta['display_name'] ?: ( $has_v2_meta ? self::label_for_type( $meta['document_type'], $row->original_name ) : $row->original_name ) );
		$meta['workflow_status'] = $has_v2_meta
			? self::normalize_workflow_status( $meta['workflow_status'], self::workflow_from_legacy( $row->status ) )
			: self::workflow_from_legacy( $row->status );
		foreach ( array( 'versions', 'comments', 'scores', 'activity' ) as $collection ) {
			$meta[ $collection ] = is_array( $meta[ $collection ] ) ? $meta[ $collection ] : array();
		}
		return $meta;
	}

	/**
	 * Return normalized internal versions, including object keys.
	 *
	 * @param object $row Database row.
	 * @param array  $meta V2 metadata.
	 * @return array
	 */
	protected static function internal_versions( $row, $meta ) {
		$versions = (array) ( $meta['versions'] ?? array() );
		if ( empty( $versions ) ) {
			$versions[] = array(
				'number'        => max( 1, absint( $row->version ) ),
				'r2_key'        => (string) $row->r2_key,
				'original_name' => sanitize_file_name( $row->original_name ),
				'mime_type'     => sanitize_text_field( $row->mime_type ),
				'file_size'     => absint( $row->file_size ),
				'uploaded_at'   => mysql_to_rfc3339( $row->created_at ),
					'uploader_name' => 'Legacy File Vault',
				'note'          => '',
				'verification_state' => 'legacy_unverified',
			);
		}
		return $versions;
	}

	/**
	 * Build a version record for persisted metadata.
	 *
	 * @param array $intent Upload intent.
	 * @param array $probe Object probe.
	 * @param int   $actor_id Actor ID.
	 * @return array
	 */
	protected static function version_entry( $intent, $probe, $actor_id ) {
		return array(
			'number'        => absint( $intent['version'] ),
			'r2_key'        => (string) $intent['r2_key'],
			'original_name' => sanitize_file_name( $intent['original_name'] ),
			'mime_type'     => sanitize_text_field( $intent['mime_type'] ),
			'file_size'     => absint( $probe['size'] ),
			'etag'          => sanitize_text_field( $probe['etag'] ?? '' ),
			'sha256'        => sanitize_text_field( $probe['sha256'] ?? '' ),
			'version_uuid'   => sanitize_text_field( $intent['version_uuid'] ?? '' ),
			'verification_state' => sanitize_key( $probe['verification_state'] ?? 'ready_clean' ),
			'uploaded_at'   => gmdate( 'c' ),
			'uploader_name' => self::actor_name( $actor_id ),
			'note'          => sanitize_textarea_field( $intent['note'] ?? '' ),
		);
	}

	/**
	 * Remove private fields from a version response.
	 *
	 * @param array $version Internal version.
	 * @return array
	 */
	protected static function public_version( $version ) {
		unset( $version['r2_key'], $version['etag'], $version['sha256'] );
		return $version;
	}

	/**
	 * Sanitize a comment response.
	 *
	 * @param array $comment Comment payload.
	 * @return array
	 */
	protected static function public_comment( $comment ) {
		unset( $comment['author_id'], $comment['resolved_by'] );
		return $comment;
	}

	/**
	 * Save one metadata document while preserving unrelated legacy metadata.
	 *
	 * @param object $row Database row.
	 * @param array  $meta V2 metadata.
	 * @return bool
	 */
	protected static function save_meta( $row, $meta ) {
		global $wpdb;
		$result = $wpdb->update(
			parent::table_name(),
			array(
				'meta_json'  => self::merge_meta_json( $row, $meta ),
				'updated_at' => current_time( 'mysql' ),
			),
			array(
				'id'        => absint( $row->id ),
				'meta_json' => isset( $row->meta_json ) ? $row->meta_json : null,
			),
			array( '%s', '%s' ),
			array( '%d', '%s' )
		);
		if ( 0 === $result ) {
			return new WP_Error( 'mmed_file_vault_v2_write_conflict', 'The document changed while this action was being saved. Reload and try again.', array( 'status' => 409 ) );
		}
		if ( false === $result ) {
			return new WP_Error( 'mmed_file_vault_v2_write_failed', 'The document action could not be saved.', array( 'status' => 503 ) );
		}
		return true;
	}

	/**
	 * Preserve non-V2 keys in meta_json.
	 *
	 * @param object $row Database row.
	 * @param array  $meta V2 metadata.
	 * @return string
	 */
	protected static function merge_meta_json( $row, $meta ) {
		$root = array();
		if ( ! empty( $row->meta_json ) ) {
			$decoded = json_decode( (string) $row->meta_json, true );
			$root    = is_array( $decoded ) ? $decoded : array();
		}
		$root[ self::META_KEY ] = $meta;
		return wp_json_encode( $root );
	}

	/**
	 * Validate declared upload metadata before signing.
	 *
	 * @param array  $params Request fields.
	 * @param string $document_type Server-resolved document type.
	 * @return array|WP_Error
	 */
	protected static function validate_upload( $params, $document_type ) {
		$raw_name          = (string) ( $params['filename'] ?? '' );
		$filename          = sanitize_file_name( $raw_name );
		$mime              = sanitize_text_field( $params['mime_type'] ?? 'application/octet-stream' );
		$size              = absint( $params['file_size'] ?? 0 );
		$sha256            = strtolower( sanitize_text_field( $params['sha256'] ?? '' ) );
		$ext               = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		$accepted          = self::accepted_files();
		$contracts         = self::upload_contracts();
		$document_type     = self::normalize_document_type( $document_type );
		$contract          = $contracts[ $document_type ] ?? $contracts['default'];
		$allowed_extensions = array_values( array_filter( array_map( 'sanitize_key', (array) ( $contract['extensions'] ?? array() ) ) ) );
		$max_size          = max( 1, absint( $contract['max_file_size'] ?? self::MAX_FILE_SIZE ) );
		$stem              = pathinfo( $filename, PATHINFO_FILENAME );
		if ( strlen( $raw_name ) > 180 || preg_match( '/[\\x00-\\x1F\\x7F\\\\\/]/', $raw_name ) || preg_match( '/[\\x{202A}-\\x{202E}\\x{2066}-\\x{2069}]/u', $raw_name ) || false !== strpos( $stem, '.' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_file_name', 'Choose a filename with one safe approved extension.', array( 'status' => 422 ) );
		}
		if ( ! $filename || ! in_array( $ext, $allowed_extensions, true ) || ! isset( $accepted[ $ext ] ) || ! in_array( $mime, $accepted[ $ext ], true ) ) {
			$message = 'application_photo' === $document_type ? 'Choose a JPEG application photo.' : 'Choose a PDF, DOCX, or PNG file.';
			return new WP_Error( 'mmed_file_vault_v2_file_type', $message, array( 'status' => 415 ) );
		}
		if ( $size < 1 || $size > $max_size ) {
			$message = 'application_photo' === $document_type ? 'Application photo size must be between 1 byte and 150 KB.' : 'File size must be between 1 byte and 25 MB.';
			return new WP_Error( 'mmed_file_vault_v2_file_size', $message, array( 'status' => 413 ) );
		}
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $sha256 ) ) {
			return new WP_Error( 'mmed_file_vault_v2_checksum', 'The browser must calculate a SHA-256 checksum before upload.', array( 'status' => 422 ) );
		}
		return array( 'filename' => $filename, 'mime_type' => $mime, 'file_size' => $size, 'sha256' => $sha256, 'max_size' => $max_size );
	}

	/**
	 * Verify object existence and authoritative size with a signed HEAD request.
	 *
	 * @param array $intent Upload intent.
	 * @return array|WP_Error
	 */
	protected static function verify_object( $intent ) {
		$override = apply_filters( 'mmed_file_vault_v2_object_probe', null, $intent );
		if ( is_array( $override ) ) {
			return $override;
		}
		$url      = self::presign_url( 'HEAD', $intent['r2_key'], 60 );
		$response = wp_remote_head( $url, array( 'timeout' => 15, 'redirection' => 0 ) );
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'mmed_file_vault_v2_object_unverified', 'The upload reached storage but could not be verified. Retry finalization.', array( 'status' => 503 ) );
		}
		$code     = wp_remote_retrieve_response_code( $response );
		$size     = absint( wp_remote_retrieve_header( $response, 'content-length' ) );
		$max_size = max( 1, absint( $intent['max_size'] ?? self::MAX_FILE_SIZE ) );
		if ( 200 !== $code || $size < 1 || $size > $max_size || $size !== absint( $intent['declared_size'] ?? 0 ) ) {
			return new WP_Error( 'mmed_file_vault_v2_object_unverified', 'The uploaded object did not pass private-storage verification.', array( 'status' => 422 ) );
		}
		$content_type = strtolower( trim( (string) wp_remote_retrieve_header( $response, 'content-type' ) ) );
		$expected_type = strtolower( (string) ( $intent['mime_type'] ?? '' ) );
		if ( $content_type && 'application/octet-stream' !== $content_type && $expected_type && 0 !== strpos( $content_type, $expected_type ) ) {
			return new WP_Error( 'mmed_file_vault_v2_object_type', 'The uploaded object type does not match the selected file.', array( 'status' => 422 ) );
		}
		return array(
			'size' => $size,
			'etag' => trim( (string) wp_remote_retrieve_header( $response, 'etag' ), '"' ),
		);
	}

	/**
	 * Require a server-side scanner to approve the staged object.
	 *
	 * @param array $intent Upload intent.
	 * @param array $probe Staging HEAD result.
	 * @return array|WP_Error
	 */
	protected static function scan_object( $intent, $probe ) {
		$result = apply_filters( 'mmed_file_vault_v2_scan_object', null, $intent, $probe );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		if ( ! is_array( $result ) ) {
			return new WP_Error( 'mmed_file_vault_v2_scanner_unavailable', 'The upload scanner is unavailable. No file was finalized.', array( 'status' => 503 ) );
		}
		if ( true !== ( $result['clean'] ?? false ) ) {
			return new WP_Error( 'mmed_file_vault_v2_scan_rejected', 'The file did not pass private upload verification.', array( 'status' => 422 ) );
		}
		$sha256 = strtolower( sanitize_text_field( $result['sha256'] ?? '' ) );
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $sha256 ) || ! hash_equals( (string) ( $intent['declared_sha256'] ?? '' ), $sha256 ) ) {
			return new WP_Error( 'mmed_file_vault_v2_scanner_unavailable', 'The upload scanner did not return a verified checksum.', array( 'status' => 503 ) );
		}
		return array( 'clean' => true, 'sha256' => $sha256 );
	}

	/**
	 * Copy the scanned staging object to an immutable V2 object key.
	 *
	 * @param array $intent Upload intent.
	 * @param array $probe Staging HEAD result.
	 * @param array $scan Scanner result.
	 * @return array|WP_Error
	 */
	protected static function promote_object( $intent, $probe, $scan ) {
		$override = apply_filters( 'mmed_file_vault_v2_promote_object', null, $intent, $probe, $scan );
		if ( is_array( $override ) ) {
			return $override;
		}
		if ( ! class_exists( '\\Aws\\S3\\S3Client' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_r2_adapter_unavailable', 'Private object promotion is unavailable. No file was finalized.', array( 'status' => 503 ) );
		}

		try {
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
			$copy_source = rawurlencode( MMED_R2_BUCKET ) . '/' . str_replace( '%2F', '/', rawurlencode( $intent['r2_key'] ) );
			$args = array(
				'Bucket'     => MMED_R2_BUCKET,
				'Key'        => $intent['final_r2_key'],
				'CopySource' => $copy_source,
			);
			if ( ! empty( $probe['etag'] ) ) {
				$args['CopySourceIfMatch'] = (string) $probe['etag'];
			}
			$client->copyObject( $args );
			$head = $client->headObject(
				array(
					'Bucket' => MMED_R2_BUCKET,
					'Key'    => $intent['final_r2_key'],
				)
			);
			$size = absint( $head['ContentLength'] ?? 0 );
			if ( $size !== absint( $probe['size'] ?? 0 ) ) {
				return new WP_Error( 'mmed_file_vault_v2_promotion_failed', 'The immutable private copy could not be verified.', array( 'status' => 503 ) );
			}
			$client->deleteObject(
				array(
					'Bucket' => MMED_R2_BUCKET,
					'Key'    => $intent['r2_key'],
				)
			);
			return array(
				'r2_key'             => $intent['final_r2_key'],
				'size'               => $size,
				'etag'               => trim( (string) ( $head['ETag'] ?? '' ), '"' ),
				'sha256'             => $scan['sha256'],
				'verification_state' => 'ready_clean',
			);
		} catch ( \Throwable $error ) {
			return new WP_Error( 'mmed_file_vault_v2_promotion_failed', 'The verified file could not be promoted to private storage.', array( 'status' => 503 ) );
		}
	}

	/**
	 * Best-effort cleanup when object promotion succeeds but persistence fails.
	 *
	 * @param string $r2_key Promoted private object key.
	 * @return bool
	 */
	protected static function delete_private_object( $r2_key ) {
		if ( defined( 'MMED_FILE_VAULT_V2_TESTING' ) && true === MMED_FILE_VAULT_V2_TESTING ) {
			return true;
		}
		if ( ! class_exists( '\\Aws\\S3\\S3Client' ) || '' === (string) $r2_key ) {
			return false;
		}
		try {
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
			$client->deleteObject( array( 'Bucket' => MMED_R2_BUCKET, 'Key' => $r2_key ) );
			return true;
		} catch ( \Throwable $error ) {
			do_action( 'mmed_file_vault_v2_orphan_cleanup_failed', $r2_key );
			return false;
		}
	}

	/**
	 * Remove a terminal upload reservation and its private staging bytes.
	 *
	 * Abandoned browser uploads are additionally bounded by the separately
	 * verified R2 staging lifecycle required by storage_ready().
	 *
	 * @param array $intent Upload intent.
	 * @param bool  $delete_final Also remove the unique promoted destination.
	 * @return void
	 */
	protected static function abandon_upload_intent( $intent, $delete_final = false ) {
		if ( ! is_array( $intent ) ) {
			return;
		}
		self::delete_private_object( (string) ( $intent['r2_key'] ?? '' ) );
		if ( $delete_final ) {
			self::delete_private_object( (string) ( $intent['final_r2_key'] ?? '' ) );
		}
		delete_transient( self::intent_key( (string) ( $intent['upload_id'] ?? '' ) ) );
		self::remove_pending_upload( absint( $intent['user_id'] ?? 0 ), (string) ( $intent['upload_id'] ?? '' ) );
	}

	/**
	 * Build journey coverage from server-returned documents.
	 *
	 * @param array $documents Documents.
	 * @param int   $user_id Student owner.
	 * @return array
	 */
	protected static function build_journey( $documents, $user_id ) {
		$assignment = self::requirement_assignment( $user_id );
		$items      = array();
		$done       = 0;
		$types      = self::document_types();
		foreach ( $assignment['types'] as $key ) {
			if ( ! isset( $types[ $key ] ) ) {
				continue;
			}
			$definition = $types[ $key ];
			$matched = null;
			foreach ( $documents as $document ) {
				if ( $key === ( $document['document_type'] ?? '' ) ) {
					$matched = $document;
					break;
				}
			}
			$status = $matched ? $matched['status'] : 'missing';
			if ( $matched && in_array( $status, array( 'submitted', 'in_review', 'reviewed', 'final' ), true ) ) {
				++$done;
			}
			$items[] = array(
				'document_type' => $key,
				'label'         => sanitize_text_field( $definition['label'] ),
				'status'        => $status,
				'document_id'   => $matched ? absint( $matched['id'] ) : null,
			);
		}
		$total = count( $items );
		$gates = self::journey_gates();
		$next_gate = null;
		$today = current_time( 'timestamp' );
		foreach ( $gates as $gate ) {
			$timestamp = strtotime( $gate['date'] . ' 23:59:59' );
			if ( $timestamp && $timestamp >= $today ) {
				$gate['days_remaining'] = max( 0, (int) ceil( ( $timestamp - $today ) / DAY_IN_SECONDS ) );
				$next_gate = $gate;
				break;
			}
		}
		return array(
			'label'            => $assignment['label'],
			'requirement_set'  => array(
				'id'     => $assignment['id'],
				'label'  => $assignment['label'],
				'source' => $assignment['source'],
			),
			'coverage_percent' => $total ? (int) round( ( $done / $total ) * 100 ) : 0,
			'complete_count'   => $done,
			'total_count'      => $total,
			'items'            => $items,
			'gates'            => $gates,
			'next_gate'        => $next_gate,
			'gate_source'      => empty( $gates ) ? 'unavailable' : 'server_configuration',
		);
	}

	/**
	 * Return only server-configured match gates; prototype dates are never used.
	 *
	 * @return array
	 */
	public static function journey_gates() {
		$explicit = get_option( 'mmed_file_vault_v2_journey_gates', array() );
		if ( is_array( $explicit ) && ! empty( $explicit ) ) {
			$raw = $explicit;
		} else {
			$calendar = get_option( 'mmed_match_calendar', array() );
			$calendar = is_array( $calendar ) ? $calendar : array();
			$labels = array(
				'cycle_start'            => 'Cycle Start',
				'eras_open'              => 'ERAS Opens',
				'application_submit'     => 'Application Submit',
				'interview_season_start' => 'Interview Season',
				'rank_deadline'          => 'Rank Order List Deadline',
				'match_day'              => 'Match Day',
			);
			$raw = array();
			foreach ( $labels as $key => $label ) {
				if ( ! empty( $calendar[ $key ] ) ) {
					$raw[] = array( 'key' => $key, 'label' => $label, 'date' => $calendar[ $key ] );
				}
			}
		}

		$gates = array();
		foreach ( (array) apply_filters( 'mmed_file_vault_v2_journey_gates', $raw ) as $gate ) {
			$key   = sanitize_key( $gate['key'] ?? '' );
			$label = sanitize_text_field( $gate['label'] ?? '' );
			$date  = sanitize_text_field( $gate['date'] ?? '' );
			if ( ! $key || ! $label || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) || ! strtotime( $date ) ) {
				continue;
			}
			$gates[] = array( 'key' => $key, 'label' => $label, 'date' => $date );
		}
		usort(
			$gates,
			static function ( $left, $right ) {
				return strcmp( $left['date'], $right['date'] );
			}
		);
		return $gates;
	}

	/**
	 * Aggregate activity and synthesize only facts present on legacy rows.
	 *
	 * @param array $documents Documents.
	 * @return array
	 */
	protected static function build_activity( $documents ) {
		$events = array();
		foreach ( $documents as $document ) {
			$activity = (array) ( $document['activity'] ?? array() );
			if ( empty( $activity ) ) {
				$activity[] = array(
					'id'      => 'legacy-' . absint( $document['id'] ),
					'type'    => 'document_present',
					'message' => 'Document added to File Vault.',
					'at'      => $document['created_at'],
					'actor'   => 'Legacy File Vault',
				);
			}
			foreach ( $activity as $event ) {
				$event['document_id']   = absint( $document['id'] );
				$event['document_name'] = sanitize_text_field( $document['name'] );
				$events[]               = $event;
			}
		}
		usort(
			$events,
			static function ( $left, $right ) {
				return strcmp( (string) ( $right['at'] ?? '' ), (string) ( $left['at'] ?? '' ) );
			}
		);
		return array_slice( $events, 0, 100 );
	}

	/**
	 * Compute one calm next action from real workflow state.
	 *
	 * @param array $documents Documents.
	 * @param array $journey Journey model.
	 * @return array
	 */
	protected static function next_action( $documents, $journey ) {
		foreach ( $documents as $document ) {
			if ( 'needs_changes' === $document['status'] ) {
					return array( 'kind' => 'open_document', 'document_id' => $document['id'], 'title' => 'Feedback is ready to review', 'detail' => $document['name'] );
			}
		}
		foreach ( (array) ( $journey['items'] ?? array() ) as $item ) {
			if ( 'missing' === $item['status'] ) {
					return array( 'kind' => 'upload', 'document_type' => $item['document_type'], 'title' => 'Add ' . $item['label'], 'detail' => 'This server-configured document is not in your Vault yet.' );
			}
		}
		foreach ( $documents as $document ) {
			if ( in_array( $document['status'], array( 'draft', 'uploaded' ), true ) ) {
				return array( 'kind' => 'submit', 'document_id' => $document['id'], 'title' => 'Submit ' . $document['name'], 'detail' => 'The latest version is still private to you.' );
			}
		}
		return array( 'kind' => 'journey', 'title' => 'Nothing is waiting on you', 'detail' => 'Review your document journey whenever you are ready.' );
	}

	/**
	 * Default V2 metadata.
	 *
	 * @return array
	 */
	protected static function empty_meta() {
		return array(
				'schema_version'  => self::META_VERSION,
			'document_uuid'   => '',
			'document_type'   => 'other',
			'display_name'    => '',
			'workflow_status' => 'draft',
			'note'            => '',
			'review_note'     => '',
			'versions'        => array(),
			'comments'        => array(),
			'scores'          => array(),
			'activity'        => array(),
		);
	}

	/**
	 * Map legacy status to a truthful V2 display status.
	 *
	 * @param string $status Legacy status.
	 * @return string
	 */
	protected static function workflow_from_legacy( $status ) {
		$map = array( 'pending_review' => 'submitted', 'uploaded' => 'uploaded', 'verified' => 'reviewed', 'rejected' => 'needs_changes' );
		return $map[ sanitize_key( $status ) ] ?? 'uploaded';
	}

	/**
	 * Human label for a status.
	 *
	 * @param string $status Status.
	 * @return string
	 */
	protected static function status_label( $status ) {
		$status = self::normalize_workflow_status( $status );
		$labels = array( 'draft' => 'Draft', 'uploaded' => 'Uploaded', 'submitted' => 'Submitted', 'in_review' => 'In Review', 'needs_changes' => 'Needs Changes', 'reviewed' => 'Reviewed', 'final' => 'Final' );
		return $labels[ $status ];
	}

	/**
	 * Return a document label from server configuration.
	 *
	 * @param string $type Document type.
	 * @param string $fallback Filename fallback.
	 * @return string
	 */
	protected static function label_for_type( $type, $fallback ) {
		$types = self::document_types();
		return isset( $types[ $type ] ) ? $types[ $type ]['label'] : sanitize_file_name( $fallback );
	}

	/**
	 * Create an audit event without exposing IDs in the browser response.
	 *
	 * @param string $type Event type.
	 * @param int    $actor_id Actor ID.
	 * @param string $message Event message.
	 * @return array
	 */
	protected static function event( $type, $actor_id, $message ) {
		return array(
			'id'      => wp_generate_uuid4(),
			'type'    => sanitize_key( $type ),
			'message' => sanitize_text_field( $message ),
			'at'      => gmdate( 'c' ),
			'actor'   => self::actor_name( $actor_id ),
		);
	}

	/**
	 * Return a safe display name.
	 *
	 * @param int $user_id User ID.
	 * @return string
	 */
	protected static function actor_name( $user_id ) {
		$user = get_user_by( 'id', absint( $user_id ) );
		return $user ? sanitize_text_field( $user->display_name ?: 'MissionMed user' ) : 'MissionMed user';
	}

	/**
	 * Build transient key.
	 *
	 * @param string $token Token.
	 * @return string
	 */
	protected static function intent_key( $token ) {
		return 'mmed_fv2_intent_' . $token;
	}

	/**
	 * Build completed-intent key.
	 *
	 * @param string $token Token.
	 * @return string
	 */
	protected static function completed_key( $token ) {
		return 'mmed_fv2_done_' . $token;
	}

	/**
	 * Build the atomic WordPress option lock key for confirmation.
	 *
	 * @param int $user_id Owner ID.
	 * @return string
	 */
	protected static function confirm_lock_key( $user_id ) {
		return 'mmed_fv2_confirm_owner_' . absint( $user_id );
	}

	/** @return string */
	protected static function issuance_owner_lock_key( $user_id ) {
		return 'mmed_fv2_issue_owner_' . absint( $user_id );
	}

	/** @return string */
	protected static function issuance_actor_lock_key( $actor_id ) {
		return 'mmed_fv2_issue_actor_' . absint( $actor_id );
	}

	/**
	 * Acquire a short atomic lock using wp_options' unique option name.
	 *
	 * @param string $lock_key Lock option key.
	 * @return bool
	 */
	protected static function acquire_lock( $lock_key ) {
		$expires = time() + 120;
		if ( add_option( $lock_key, $expires, '', false ) ) {
			return true;
		}
		if ( absint( get_option( $lock_key, 0 ) ) >= time() ) {
			return false;
		}
		delete_option( $lock_key );
		return add_option( $lock_key, $expires, '', false );
	}

	/**
	 * Acquire a token-owned lock that an expired prior worker cannot release.
	 *
	 * @param string $lock_key Lock option key.
	 * @param int    $ttl Lock lifetime.
	 * @return string|false
	 */
	protected static function acquire_owned_lock( $lock_key, $ttl ) {
		$token = self::random_token();
		$value = array( 'token' => $token, 'expires' => time() + max( 120, absint( $ttl ) ) );
		if ( add_option( $lock_key, $value, '', false ) ) {
			return $token;
		}

		$current = get_option( $lock_key, array() );
		$expires = is_array( $current ) ? absint( $current['expires'] ?? 0 ) : absint( $current );
		if ( $expires >= time() ) {
			return false;
		}
		delete_option( $lock_key );
		return add_option( $lock_key, $value, '', false ) ? $token : false;
	}

	/**
	 * Release a lock only while this worker still owns its token.
	 *
	 * @param string $lock_key Lock option key.
	 * @param string $token Lock owner token.
	 * @return bool
	 */
	protected static function release_owned_lock( $lock_key, $token ) {
		$current = get_option( $lock_key, array() );
		if ( ! is_array( $current ) || empty( $current['token'] ) || ! hash_equals( (string) $current['token'], (string) $token ) ) {
			return false;
		}
		return delete_option( $lock_key );
	}

	/**
	 * Enforce server-configured quota, pending count and issuance rates.
	 *
	 * @param int $user_id Owner ID.
	 * @param int $actor_id Actor ID.
	 * @param int $new_size Declared upload size.
	 * @return true|WP_Error
	 */
	protected static function check_upload_limits( $user_id, $actor_id, $new_size ) {
		$quota = absint( get_option( 'mmed_file_vault_v2_user_quota_bytes', 0 ) );
		if ( ! $quota ) {
			return new WP_Error( 'mmed_file_vault_v2_quota_unavailable', 'A File Vault storage quota has not been configured.', array( 'status' => 503 ) );
		}
		$pending = self::pending_uploads( $user_id );
		if ( count( $pending ) >= 5 ) {
			return new WP_Error( 'mmed_file_vault_v2_pending_limit', 'Finish or wait for an existing upload before starting another.', array( 'status' => 429 ) );
		}
		$now       = current_time( 'timestamp' );
		$issuances = (array) get_transient( self::rate_key( $actor_id ) );
		$issuances = array_values( array_filter( array_map( 'absint', $issuances ), static function ( $at ) use ( $now ) { return $at >= $now - DAY_IN_SECONDS; } ) );
		$recent    = array_filter( $issuances, static function ( $at ) use ( $now ) { return $at >= $now - 600; } );
		if ( count( $recent ) >= 10 || count( $issuances ) >= 50 ) {
			return new WP_Error( 'mmed_file_vault_v2_rate_limit', 'Upload initiation is temporarily limited. Try again later.', array( 'status' => 429 ) );
		}

		$current       = self::used_storage_bytes( $user_id );
		$pending_bytes = array_sum( array_map( static function ( $item ) { return absint( $item['size'] ?? 0 ); }, $pending ) );
		if ( $current + $pending_bytes + absint( $new_size ) > $quota ) {
			return new WP_Error( 'mmed_file_vault_v2_quota_exceeded', 'This upload would exceed the configured private storage quota.', array( 'status' => 413 ) );
		}
		return true;
	}

	/**
	 * Revalidate quota under the owner confirmation lock.
	 *
	 * @param int    $user_id Owner ID.
	 * @param string $upload_id Upload UUID.
	 * @param int    $size Verified object size.
	 * @return true|WP_Error
	 */
	protected static function check_confirm_quota( $user_id, $upload_id, $size ) {
		$quota = absint( get_option( 'mmed_file_vault_v2_user_quota_bytes', 0 ) );
		if ( ! $quota ) {
			return new WP_Error( 'mmed_file_vault_v2_quota_unavailable', 'A File Vault storage quota has not been configured.', array( 'status' => 503 ) );
		}
		$pending_bytes = 0;
		$intent_found  = false;
		foreach ( self::pending_uploads( $user_id ) as $pending ) {
			$pending_bytes += absint( $pending['size'] ?? 0 );
			if ( hash_equals( (string) ( $pending['upload_id'] ?? '' ), (string) $upload_id ) ) {
				$intent_found = true;
			}
		}
		if ( ! $intent_found ) {
			$pending_bytes += absint( $size );
		}
		if ( self::used_storage_bytes( $user_id ) + $pending_bytes > $quota ) {
			return new WP_Error( 'mmed_file_vault_v2_quota_exceeded', 'This upload no longer fits within the configured private storage quota.', array( 'status' => 413 ) );
		}
		return true;
	}

	/**
	 * Count every retained immutable version, not only each row's current size.
	 *
	 * @param int $user_id Owner ID.
	 * @return int
	 */
	protected static function used_storage_bytes( $user_id ) {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . parent::table_name() . ' WHERE user_id = %d',
				absint( $user_id )
			)
		);
		$total = 0;
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$versions = self::internal_versions( $row, self::meta_for_row( $row ) );
			foreach ( $versions as $version ) {
				$total += absint( $version['file_size'] ?? 0 );
			}
		}
		return $total;
	}

	/**
	 * Record a successfully issued upload session.
	 *
	 * @param int    $user_id Owner ID.
	 * @param int    $actor_id Actor ID.
	 * @param string $upload_id Upload UUID.
	 * @param int    $size Declared size.
	 * @return bool
	 */
	protected static function record_upload_issuance( $user_id, $actor_id, $upload_id, $size ) {
		$now       = current_time( 'timestamp' );
		$issuances = (array) get_transient( self::rate_key( $actor_id ) );
		$issuances = array_values( array_filter( array_map( 'absint', $issuances ), static function ( $at ) use ( $now ) { return $at >= $now - DAY_IN_SECONDS; } ) );
		$pending = self::pending_uploads( $user_id );
		$pending[] = array( 'upload_id' => $upload_id, 'size' => absint( $size ), 'expires_at' => $now + self::INTENT_TTL );
		if ( ! set_transient( self::pending_key( $user_id ), $pending, self::INTENT_TTL ) ) {
			return false;
		}
		$issuances[] = $now;
		if ( ! set_transient( self::rate_key( $actor_id ), $issuances, DAY_IN_SECONDS ) ) {
			self::remove_pending_upload( $user_id, $upload_id );
			return false;
		}
		return true;
	}

	/**
	 * Return unexpired pending uploads for an owner.
	 *
	 * @param int $user_id Owner ID.
	 * @return array
	 */
	protected static function pending_uploads( $user_id ) {
		$now = current_time( 'timestamp' );
		return array_values(
			array_filter(
				(array) get_transient( self::pending_key( $user_id ) ),
				static function ( $item ) use ( $now ) {
					return is_array( $item ) && absint( $item['expires_at'] ?? 0 ) >= $now;
				}
			)
		);
	}

	/**
	 * Remove one finalized upload from the pending owner list.
	 *
	 * @param int    $user_id Owner ID.
	 * @param string $upload_id Upload UUID.
	 * @return void
	 */
	protected static function remove_pending_upload( $user_id, $upload_id ) {
		$pending = array_values(
			array_filter(
				self::pending_uploads( $user_id ),
				static function ( $item ) use ( $upload_id ) {
					return ! hash_equals( (string) ( $item['upload_id'] ?? '' ), (string) $upload_id );
				}
			)
		);
		set_transient( self::pending_key( $user_id ), $pending, self::INTENT_TTL );
	}

	/** @return string */
	protected static function rate_key( $actor_id ) {
		return 'mmed_fv2_rate_' . absint( $actor_id );
	}

	/** @return string */
	protected static function pending_key( $user_id ) {
		return 'mmed_fv2_pending_' . absint( $user_id );
	}

	/**
	 * Generate a 256-bit one-time confirmation secret.
	 *
	 * @return string
	 */
	protected static function random_token() {
		try {
			return bin2hex( random_bytes( 32 ) );
		} catch ( \Throwable $error ) {
			return hash( 'sha256', wp_generate_uuid4() . wp_generate_uuid4() . microtime( true ) );
		}
	}

	/**
	 * Return the review rubric configured for one document type.
	 *
	 * @param string $document_type Document type.
	 * @return array
	 */
	public static function rubric( $document_type ) {
		$value = get_option( 'mmed_file_vault_v2_rubric', array() );
		$document_type = self::normalize_document_type( $document_type );
		if ( ! is_array( $value ) || ! isset( $value[ $document_type ] ) || ! is_array( $value[ $document_type ] ) ) {
			return array();
		}
		$labels = array_values( array_filter( array_map( 'sanitize_text_field', array_slice( $value[ $document_type ], 0, 10 ) ) ) );
		$keys   = array_map( array( __CLASS__, 'rubric_key' ), $labels );
		if ( empty( $labels ) || in_array( '', $keys, true ) || count( $keys ) !== count( array_unique( $keys ) ) ) {
			return array();
		}
		return $labels;
	}

	/**
	 * Return only valid document-scoped rubrics for browser rendering.
	 *
	 * @return array
	 */
	public static function rubrics() {
		$rubrics = array();
		foreach ( array_keys( self::document_types() ) as $document_type ) {
			$labels = self::rubric( $document_type );
			if ( ! empty( $labels ) ) {
				$rubrics[ $document_type ] = $labels;
			}
		}
		return $rubrics;
	}

	/**
	 * Human score label.
	 *
	 * @param int $score Score.
	 * @return string
	 */
	protected static function score_label( $score ) {
		return 'Score recorded';
	}

	/**
	 * Return one explicitly assigned, provenance-bearing requirement set.
	 *
	 * @param int $user_id Student owner.
	 * @return array
	 */
	protected static function requirement_assignment( $user_id ) {
		$assignments = get_option( 'mmed_file_vault_v2_requirement_assignments', array() );
		$assignments = is_array( $assignments ) ? $assignments : array();
		$value       = $assignments[ (string) absint( $user_id ) ] ?? null;
		$value       = apply_filters( 'mmed_file_vault_v2_requirement_assignment', $value, absint( $user_id ) );
		if ( ! is_array( $value ) ) {
			return array( 'id' => '', 'label' => 'No document set assigned', 'source' => '', 'types' => array() );
		}

		$id     = sanitize_key( $value['id'] ?? '' );
		$label  = sanitize_text_field( $value['label'] ?? '' );
		$source = sanitize_text_field( $value['source'] ?? '' );
		$types  = self::document_types();
		$keys   = array_values(
			array_unique(
				array_filter(
					array_map( 'sanitize_key', (array) ( $value['types'] ?? array() ) ),
					static function ( $key ) use ( $types ) {
						return isset( $types[ $key ] );
					}
				)
			)
		);
		if ( ! $id || ! $label || ! $source || empty( $keys ) ) {
			return array( 'id' => '', 'label' => 'No document set assigned', 'source' => '', 'types' => array() );
		}
		return array( 'id' => $id, 'label' => $label, 'source' => $source, 'types' => $keys );
	}

	/**
	 * Match the browser's stable rubric-key transform.
	 *
	 * @param string $label Rubric label.
	 * @return string
	 */
	protected static function rubric_key( $label ) {
		$key = strtolower( sanitize_text_field( $label ) );
		$key = preg_replace( '/[^a-z0-9]+/', '_', $key );
		return trim( (string) $key, '_' );
	}

	/**
	 * Explicit staff review transition matrix.
	 *
	 * @return array
	 */
	protected static function status_transitions() {
		return array(
			'draft'         => array( 'submitted', 'in_review' ),
			'uploaded'      => array( 'submitted', 'in_review' ),
			'submitted'     => array( 'in_review', 'needs_changes', 'reviewed', 'final' ),
			'in_review'     => array( 'needs_changes', 'reviewed', 'final' ),
			'needs_changes' => array( 'submitted', 'in_review', 'reviewed', 'final' ),
			'reviewed'      => array( 'needs_changes', 'final' ),
			'final'         => array(),
		);
	}
}
