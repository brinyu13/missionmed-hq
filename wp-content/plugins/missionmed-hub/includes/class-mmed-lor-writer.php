<?php
/**
 * MissionMed Matrix LOR GhostWriter request tracker.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns LOR request metadata and authenticated CRUD.
 */
class MMED_LOR_Writer {

	/**
	 * LOR schema version.
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
	 * Create or update the LOR requests table via dbDelta().
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_lor_writer_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			faculty_name varchar(200) NOT NULL,
			faculty_email varchar(200) DEFAULT '',
			faculty_institution varchar(200) DEFAULT '',
			specialty varchar(100) DEFAULT '',
			relationship varchar(100) DEFAULT '',
			status varchar(20) DEFAULT 'draft',
			requested_date datetime DEFAULT NULL,
			due_date datetime DEFAULT NULL,
			submitted_date datetime DEFAULT NULL,
			notes longtext DEFAULT '',
			draft_file_id bigint(20) unsigned DEFAULT NULL,
			final_file_id bigint(20) unsigned DEFAULT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_user_status (user_id, status),
			KEY idx_due_date (user_id, due_date)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_lor_writer_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return the LOR table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_lor_requests';
	}

	/**
	 * List current user's LOR requests.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_requests( $request ) {
		global $wpdb;

		self::maybe_install();

		$user_id = get_current_user_id();
		$status  = self::sanitize_status( $request->get_param( 'status' ), '' );
		$limit   = min( 100, max( 1, absint( $request->get_param( 'limit' ) ?: 50 ) ) );
		$where   = array( 'user_id = %d' );
		$values  = array( $user_id );

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		$sql      = 'SELECT * FROM ' . self::table_name() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY COALESCE(due_date, requested_date, created_at) ASC, id DESC LIMIT %d';
		$values[] = $limit;
		$rows     = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return new WP_REST_Response(
			array(
				'requests' => array_map( array( __CLASS__, 'format_request' ), is_array( $rows ) ? $rows : array() ),
				'counts'   => self::get_counts( $user_id ),
				'statuses' => self::statuses(),
			),
			200
		);
	}

	/**
	 * Create an LOR request for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_request( $request ) {
		global $wpdb;

		self::maybe_install();

		$payload = self::sanitize_payload( self::request_payload( $request ), false );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$payload['user_id']    = get_current_user_id();
		$payload['created_at'] = current_time( 'mysql' );
		$payload['updated_at'] = current_time( 'mysql' );

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_lor_create_failed', 'LOR request could not be created.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'request' => self::format_request( self::get_owned_request( (int) $wpdb->insert_id, get_current_user_id() ) ),
				'counts'  => self::get_counts( get_current_user_id() ),
			),
			201
		);
	}

	/**
	 * Update an owned LOR request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_request( $request ) {
		global $wpdb;

		self::maybe_install();

		$request_id = absint( $request['id'] );
		$user_id    = get_current_user_id();
		$row        = self::get_owned_request( $request_id, $user_id );

		if ( ! $row ) {
			return new WP_Error( 'mmed_lor_not_found', 'LOR request not found.', array( 'status' => 404 ) );
		}

		$payload = self::sanitize_payload( self::request_payload( $request ), true );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		if ( empty( $payload ) ) {
			return new WP_REST_Response( array( 'request' => self::format_request( $row ) ), 200 );
		}

		$payload['updated_at'] = current_time( 'mysql' );

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			array(
				'id'      => $request_id,
				'user_id' => $user_id,
			),
			self::format_map( $payload ),
			array( '%d', '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_lor_update_failed', 'LOR request could not be updated.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'request' => self::format_request( self::get_owned_request( $request_id, $user_id ) ),
				'counts'  => self::get_counts( $user_id ),
			),
			200
		);
	}

	/**
	 * Update only the workflow status for an owned request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_status( $request ) {
		global $wpdb;

		self::maybe_install();

		$request_id = absint( $request['id'] );
		$user_id    = get_current_user_id();
		$row        = self::get_owned_request( $request_id, $user_id );

		if ( ! $row ) {
			return new WP_Error( 'mmed_lor_not_found', 'LOR request not found.', array( 'status' => 404 ) );
		}

		$params = self::request_payload( $request );
		$status = self::sanitize_status( $params['status'] ?? '', '' );

		if ( ! $status ) {
			return new WP_Error( 'mmed_lor_status_required', 'A valid LOR status is required.', array( 'status' => 400 ) );
		}

		$payload = array(
			'status'     => $status,
			'updated_at' => current_time( 'mysql' ),
		);

		if ( 'requested' === $status && empty( $row->requested_date ) ) {
			$payload['requested_date'] = current_time( 'mysql' );
		}

		if ( in_array( $status, array( 'submitted', 'completed' ), true ) && empty( $row->submitted_date ) ) {
			$payload['submitted_date'] = current_time( 'mysql' );
		}

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			array(
				'id'      => $request_id,
				'user_id' => $user_id,
			),
			self::format_map( $payload ),
			array( '%d', '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_lor_status_failed', 'LOR status could not be updated.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response(
			array(
				'request' => self::format_request( self::get_owned_request( $request_id, $user_id ) ),
				'counts'  => self::get_counts( $user_id ),
			),
			200
		);
	}

	/**
	 * Format a database row for REST.
	 *
	 * @param object|null $row Database row.
	 * @return array
	 */
	public static function format_request( $row ) {
		if ( ! $row ) {
			return array();
		}

		$status = self::sanitize_status( $row->status ?? 'draft', 'draft' );

		return array(
			'id'                  => absint( $row->id ),
			'faculty_name'        => (string) $row->faculty_name,
			'faculty_email'       => (string) $row->faculty_email,
			'faculty_institution' => (string) $row->faculty_institution,
			'specialty'           => (string) $row->specialty,
			'relationship'        => (string) $row->relationship,
			'status'              => $status,
			'status_label'        => self::status_label( $status ),
			'requested_date'      => self::nullable_datetime( $row->requested_date ),
			'due_date'            => self::nullable_datetime( $row->due_date ),
			'submitted_date'      => self::nullable_datetime( $row->submitted_date ),
			'notes'               => (string) $row->notes,
			'draft_file_id'       => $row->draft_file_id ? absint( $row->draft_file_id ) : 0,
			'final_file_id'       => $row->final_file_id ? absint( $row->final_file_id ) : 0,
			'created_at'          => self::nullable_datetime( $row->created_at ),
			'updated_at'          => self::nullable_datetime( $row->updated_at ),
		);
	}

	/**
	 * Count requests by workflow status.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_counts( $user_id ) {
		global $wpdb;

		self::maybe_install();

		$user_id = absint( $user_id );
		$counts  = array_fill_keys( self::statuses(), 0 );
		$counts['total'] = 0;
		$counts['active'] = 0;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT status, COUNT(*) as total FROM ' . self::table_name() . ' WHERE user_id = %d GROUP BY status',
				$user_id
			)
		);

		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$status = self::sanitize_status( $row->status, '' );
			if ( ! $status ) {
				continue;
			}

			$total = absint( $row->total );
			$counts[ $status ] = $total;
			$counts['total'] += $total;

			if ( ! in_array( $status, array( 'completed' ), true ) ) {
				$counts['active'] += $total;
			}
		}

		return $counts;
	}

	/**
	 * Return an owned request row.
	 *
	 * @param int $request_id Request ID.
	 * @param int $user_id    WordPress user ID.
	 * @return object|null
	 */
	protected static function get_owned_request( $request_id, $user_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d AND user_id = %d LIMIT 1',
				absint( $request_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Sanitize create/update payload.
	 *
	 * @param array $params  Raw params.
	 * @param bool  $partial Whether partial update is allowed.
	 * @return array|WP_Error
	 */
	protected static function sanitize_payload( $params, $partial = false ) {
		$payload = array();

		if ( array_key_exists( 'faculty_name', $params ) || ! $partial ) {
			$faculty_name = sanitize_text_field( $params['faculty_name'] ?? '' );
			if ( '' === $faculty_name ) {
				return new WP_Error( 'mmed_lor_faculty_required', 'Faculty name is required.', array( 'status' => 400 ) );
			}
			$payload['faculty_name'] = $faculty_name;
		}

		$text_fields = array(
			'faculty_institution' => 200,
			'specialty'           => 100,
			'relationship'        => 100,
		);

		foreach ( $text_fields as $field => $length ) {
			if ( array_key_exists( $field, $params ) || ! $partial ) {
				$payload[ $field ] = substr( sanitize_text_field( $params[ $field ] ?? '' ), 0, $length );
			}
		}

		if ( array_key_exists( 'faculty_email', $params ) || ! $partial ) {
			$email = sanitize_email( $params['faculty_email'] ?? '' );
			if ( ! empty( $params['faculty_email'] ) && ! is_email( $email ) ) {
				return new WP_Error( 'mmed_lor_email_invalid', 'Faculty email must be valid.', array( 'status' => 400 ) );
			}
			$payload['faculty_email'] = $email;
		}

		if ( array_key_exists( 'status', $params ) || ! $partial ) {
			$payload['status'] = self::sanitize_status( $params['status'] ?? 'draft', 'draft' );
		}

		foreach ( array( 'requested_date', 'due_date', 'submitted_date' ) as $field ) {
			if ( array_key_exists( $field, $params ) ) {
				$payload[ $field ] = self::mysql_datetime_or_null( $params[ $field ] );
			}
		}

		if ( array_key_exists( 'notes', $params ) || ! $partial ) {
			$payload['notes'] = sanitize_textarea_field( $params['notes'] ?? '' );
		}

		foreach ( array( 'draft_file_id', 'final_file_id' ) as $field ) {
			if ( array_key_exists( $field, $params ) ) {
				$value = absint( $params[ $field ] );
				$payload[ $field ] = $value > 0 ? $value : null;
			}
		}

		return $payload;
	}

	/**
	 * Read JSON/body params as an array.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array
	 */
	protected static function request_payload( $request ) {
		$json = $request instanceof WP_REST_Request && is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$body = $request instanceof WP_REST_Request && is_array( $request->get_body_params() ) ? $request->get_body_params() : array();

		return array_merge( $body, $json );
	}

	/**
	 * Return allowed statuses.
	 *
	 * @return array
	 */
	public static function statuses() {
		return array( 'draft', 'requested', 'in_review', 'revision', 'submitted', 'completed' );
	}

	/**
	 * Sanitize workflow status.
	 *
	 * @param string $status   Raw status.
	 * @param string $fallback Fallback status.
	 * @return string
	 */
	protected static function sanitize_status( $status, $fallback = 'draft' ) {
		$status = sanitize_key( $status );
		return in_array( $status, self::statuses(), true ) ? $status : $fallback;
	}

	/**
	 * Display label for a status.
	 *
	 * @param string $status Status.
	 * @return string
	 */
	protected static function status_label( $status ) {
		return ucwords( str_replace( '_', ' ', self::sanitize_status( $status, 'draft' ) ) );
	}

	/**
	 * Convert a date-ish string to MySQL datetime or null.
	 *
	 * @param string $value Raw value.
	 * @return string|null
	 */
	protected static function mysql_datetime_or_null( $value ) {
		$value = sanitize_text_field( $value );
		if ( '' === $value ) {
			return null;
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d H:i:s', $timestamp ) : null;
	}

	/**
	 * Normalize nullable dates for JSON.
	 *
	 * @param string|null $value Raw DB date.
	 * @return string
	 */
	protected static function nullable_datetime( $value ) {
		if ( empty( $value ) || '0000-00-00 00:00:00' === $value ) {
			return '';
		}

		return (string) $value;
	}

	/**
	 * Build wpdb format list for a payload.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	protected static function format_map( $payload ) {
		$formats = array(
			'id'                  => '%d',
			'user_id'             => '%d',
			'faculty_name'        => '%s',
			'faculty_email'       => '%s',
			'faculty_institution' => '%s',
			'specialty'           => '%s',
			'relationship'        => '%s',
			'status'              => '%s',
			'requested_date'      => '%s',
			'due_date'            => '%s',
			'submitted_date'      => '%s',
			'notes'               => '%s',
			'draft_file_id'       => '%d',
			'final_file_id'       => '%d',
			'created_at'          => '%s',
			'updated_at'          => '%s',
		);

		$output = array();
		foreach ( array_keys( $payload ) as $key ) {
			$output[] = $formats[ $key ] ?? '%s';
		}

		return $output;
	}
}
