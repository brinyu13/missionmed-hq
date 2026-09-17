<?php
/**
 * MissionMed Matrix to-do engine.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns the Matrix todos table and authenticated CRUD.
 */
class MMED_Todo_Engine {

	const DB_VERSION = '20260518.1';

	public static function init() {
		self::maybe_install();
	}

	public static function maybe_install() {
		if ( get_option( 'mmed_todo_engine_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			title varchar(255) NOT NULL,
			notes text NULL,
			priority varchar(10) DEFAULT 'medium',
			due_date date NULL,
			completed tinyint(1) DEFAULT 0,
			category varchar(50) NULL,
			subtasks_json longtext NULL,
			meeting_url varchar(500) NULL,
			meeting_platform varchar(30) NULL,
			sort_order int DEFAULT 0,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_user (user_id),
			KEY idx_user_completed (user_id, completed)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_todo_engine_db_version', self::DB_VERSION, false );
	}

	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_todos';
	}

	/**
	 * Get todos for current user.
	 */
	public static function get_todos( $request ) {
		global $wpdb;
		self::maybe_install();

		$user_id = get_current_user_id();
		$rows    = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE user_id = %d ORDER BY completed ASC, sort_order ASC, FIELD(priority, "high", "medium", "low"), created_at DESC',
				$user_id
			)
		);

		return new WP_REST_Response(
			array(
				'todos' => array_map( array( __CLASS__, 'format_todo' ), is_array( $rows ) ? $rows : array() ),
			),
			200
		);
	}

	/**
	 * Create a todo.
	 */
	public static function create_todo( $request ) {
		self::maybe_install();

		$raw = $request->get_json_params();
		if ( ! is_array( $raw ) || empty( $raw ) ) {
			$raw = $request->get_body_params();
		}
		$raw = is_array( $raw ) ? $raw : array();

		$title = sanitize_text_field( $raw['title'] ?? '' );
		if ( empty( $title ) ) {
			return new WP_Error( 'mmed_todo_title_required', 'Title is required.', array( 'status' => 400 ) );
		}

		$result = self::create_todo_for_user( get_current_user_id(), $raw );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 201 );
	}

	/**
	 * Create a todo for a specific user.
	 *
	 * @param int   $user_id User ID.
	 * @param array $raw     Raw todo data.
	 * @return array|WP_Error
	 */
	public static function create_todo_for_user( $user_id, $raw ) {
		global $wpdb;
		self::maybe_install();

		$raw     = is_array( $raw ) ? $raw : array();
		$user_id = absint( $user_id );
		$title   = sanitize_text_field( $raw['title'] ?? '' );

		if ( ! $user_id || empty( $title ) ) {
			return new WP_Error( 'mmed_todo_title_required', 'Title is required.', array( 'status' => 400 ) );
		}

		$priority = sanitize_key( $raw['priority'] ?? 'medium' );
		if ( ! in_array( $priority, array( 'high', 'medium', 'low' ), true ) ) {
			$priority = 'medium';
		}

		$platform = sanitize_key( $raw['meeting_platform'] ?? '' );
		if ( ! in_array( $platform, array( 'webex', 'zoom', 'google_meet', 'teams', '' ), true ) ) {
			$platform = '';
		}

		$data = array(
			'user_id'          => $user_id,
			'title'            => $title,
			'notes'            => wp_kses_post( $raw['notes'] ?? '' ),
			'priority'         => $priority,
			'due_date'         => ! empty( $raw['due_date'] ) ? sanitize_text_field( $raw['due_date'] ) : null,
			'completed'        => ! empty( $raw['completed'] ) ? 1 : 0,
			'category'         => sanitize_key( $raw['category'] ?? '' ),
			'subtasks_json'    => wp_json_encode( self::sanitize_subtasks( $raw['subtasks'] ?? array() ) ),
			'meeting_url'      => esc_url_raw( $raw['meeting_url'] ?? '' ),
			'meeting_platform' => $platform,
			'sort_order'       => absint( $raw['sort_order'] ?? 0 ),
			'created_at'       => current_time( 'mysql' ),
			'updated_at'       => current_time( 'mysql' ),
		);

		$wpdb->insert( self::table_name(), $data );

		if ( ! $wpdb->insert_id ) {
			return new WP_Error( 'mmed_todo_create_failed', 'Could not create todo.', array( 'status' => 500 ) );
		}

		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table_name() . ' WHERE id = %d', $wpdb->insert_id ) );

		return self::format_todo( $row );
	}

	/**
	 * Update a todo.
	 */
	public static function update_todo( $request ) {
		global $wpdb;
		self::maybe_install();

		$id      = absint( $request['id'] );
		$user_id = get_current_user_id();
		$row     = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table_name() . ' WHERE id = %d AND user_id = %d', $id, $user_id ) );

		if ( ! $row ) {
			return new WP_Error( 'mmed_todo_not_found', 'Todo not found.', array( 'status' => 404 ) );
		}

		$raw = $request->get_json_params();
		if ( ! is_array( $raw ) || empty( $raw ) ) {
			$raw = $request->get_body_params();
		}
		$raw     = is_array( $raw ) ? $raw : array();
		$payload = array( 'updated_at' => current_time( 'mysql' ) );

		if ( array_key_exists( 'title', $raw ) ) {
			$payload['title'] = sanitize_text_field( $raw['title'] );
		}
		if ( array_key_exists( 'notes', $raw ) ) {
			$payload['notes'] = wp_kses_post( $raw['notes'] );
		}
		if ( array_key_exists( 'priority', $raw ) ) {
			$payload['priority'] = in_array( $raw['priority'], array( 'high', 'medium', 'low' ), true ) ? $raw['priority'] : 'medium';
		}
		if ( array_key_exists( 'due_date', $raw ) ) {
			$payload['due_date'] = ! empty( $raw['due_date'] ) ? sanitize_text_field( $raw['due_date'] ) : null;
		}
		if ( array_key_exists( 'completed', $raw ) ) {
			$payload['completed'] = ! empty( $raw['completed'] ) ? 1 : 0;
		}
		if ( array_key_exists( 'category', $raw ) ) {
			$payload['category'] = sanitize_key( $raw['category'] );
		}
		if ( array_key_exists( 'subtasks', $raw ) && is_array( $raw['subtasks'] ) ) {
			$payload['subtasks_json'] = wp_json_encode( self::sanitize_subtasks( $raw['subtasks'] ) );
		}
		if ( array_key_exists( 'meeting_url', $raw ) ) {
			$payload['meeting_url'] = esc_url_raw( $raw['meeting_url'] );
		}
		if ( array_key_exists( 'meeting_platform', $raw ) ) {
			$payload['meeting_platform'] = in_array( $raw['meeting_platform'], array( 'webex', 'zoom', 'google_meet', 'teams', '' ), true ) ? $raw['meeting_platform'] : '';
		}
		if ( array_key_exists( 'sort_order', $raw ) ) {
			$payload['sort_order'] = absint( $raw['sort_order'] );
		}

		$wpdb->update( self::table_name(), $payload, array( 'id' => $id, 'user_id' => $user_id ) );

		$updated = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table_name() . ' WHERE id = %d', $id ) );

		return new WP_REST_Response( self::format_todo( $updated ), 200 );
	}

	/**
	 * Delete a todo.
	 */
	public static function delete_todo( $request ) {
		global $wpdb;
		self::maybe_install();

		$id      = absint( $request['id'] );
		$user_id = get_current_user_id();
		$row     = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::table_name() . ' WHERE id = %d AND user_id = %d', $id, $user_id ) );

		if ( ! $row ) {
			return new WP_Error( 'mmed_todo_not_found', 'Todo not found.', array( 'status' => 404 ) );
		}

		$wpdb->delete( self::table_name(), array( 'id' => $id, 'user_id' => $user_id ) );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id ), 200 );
	}

	/**
	 * Format a todo row for REST output.
	 */
	public static function format_todo( $row ) {
		if ( ! $row ) {
			return array();
		}

		return array(
			'id'               => (int) $row->id,
			'title'            => (string) $row->title,
			'notes'            => (string) ( $row->notes ?? '' ),
			'priority'         => (string) $row->priority,
			'due_date'         => $row->due_date ?: null,
			'completed'        => (bool) $row->completed,
			'category'         => (string) ( $row->category ?? '' ),
			'subtasks'         => self::decode_subtasks( $row->subtasks_json ?? '' ),
			'meeting_url'      => (string) ( $row->meeting_url ?? '' ),
			'meeting_platform' => (string) ( $row->meeting_platform ?? '' ),
			'sort_order'       => (int) $row->sort_order,
			'created_at'       => (string) $row->created_at,
			'updated_at'       => (string) $row->updated_at,
		);
	}

	/**
	 * Count pending todos for a user.
	 */
	public static function count_pending( $user_id ) {
		global $wpdb;
		self::maybe_install();

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::table_name() . ' WHERE user_id = %d AND completed = 0',
				absint( $user_id )
			)
		);
	}

	private static function sanitize_subtasks( $subtasks ) {
		$clean = array();
		if ( ! is_array( $subtasks ) ) {
			return $clean;
		}

		foreach ( $subtasks as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$title = sanitize_text_field( $item['title'] ?? '' );
			if ( '' === $title ) {
				continue;
			}
			$clean[] = array(
				'title'     => $title,
				'completed' => ! empty( $item['completed'] ),
			);
		}

		return $clean;
	}

	private static function decode_subtasks( $json ) {
		$decoded = ! empty( $json ) ? json_decode( (string) $json, true ) : array();
		return self::sanitize_subtasks( is_array( $decoded ) ? $decoded : array() );
	}
}
