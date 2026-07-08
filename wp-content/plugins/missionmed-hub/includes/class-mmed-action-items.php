<?php
/**
 * MissionMed session action items.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores post-session action items and spawns student todos.
 */
class MMED_Action_Items {

	const DB_VERSION = '20260519.1';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Return table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_session_action_items';
	}

	/**
	 * Create or update table.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_action_items_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_group_id bigint(20) unsigned NOT NULL,
			event_date date NOT NULL,
			title varchar(255) NOT NULL,
			description text NULL,
			due_date date NULL,
			priority varchar(20) DEFAULT 'medium',
			created_by bigint(20) unsigned NOT NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_session_date (session_group_id, event_date),
			KEY idx_created_by (created_by)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_action_items_db_version', self::DB_VERSION, false );
	}

	/**
	 * Create one action item.
	 *
	 * @param int   $session_group_id Session group ID.
	 * @param mixed $event_date       Event date.
	 * @param array $data             Raw data.
	 * @return int|WP_Error
	 */
	public static function create_action_item( $session_group_id, $event_date, $data ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$data             = is_array( $data ) ? $data : array();
		$title            = sanitize_text_field( $data['title'] ?? '' );

		if ( ! $session_group_id || ! $event_date || '' === $title ) {
			return new WP_Error( 'mmed_action_item_invalid', 'Session, date, and title are required.', array( 'status' => 400 ) );
		}

		$payload = array(
			'session_group_id' => $session_group_id,
			'event_date'       => $event_date,
			'title'            => $title,
			'description'      => wp_kses_post( $data['description'] ?? '' ),
			'due_date'         => self::sanitize_date( $data['due_date'] ?? '' ) ?: null,
			'priority'         => self::sanitize_priority( $data['priority'] ?? 'medium' ),
			'created_by'       => get_current_user_id(),
			'created_at'       => current_time( 'mysql' ),
		);

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_action_item_create_failed', 'Action item could not be created.', array( 'status' => 500 ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Spawn todos for attendees.
	 *
	 * @param int   $action_item_id    Action item ID.
	 * @param array $attendee_user_ids Optional user IDs.
	 * @return array|WP_Error
	 */
	public static function spawn_todos( $action_item_id, $attendee_user_ids = array() ) {
		$item = self::get_action_item_row( $action_item_id );
		if ( ! $item ) {
			return new WP_Error( 'mmed_action_item_not_found', 'Action item not found.', array( 'status' => 404 ) );
		}

		if ( ! class_exists( 'MMED_Todo_Engine' ) || ! method_exists( 'MMED_Todo_Engine', 'create_todo_for_user' ) ) {
			return new WP_Error( 'mmed_todo_engine_missing', 'Todo engine is unavailable.', array( 'status' => 500 ) );
		}

		$user_ids = array_filter( array_map( 'absint', is_array( $attendee_user_ids ) ? $attendee_user_ids : array() ) );
		if ( empty( $user_ids ) ) {
			$user_ids = self::attendee_user_ids( (int) $item->session_group_id, (string) $item->event_date );
		}

		$count = 0;
		foreach ( array_unique( $user_ids ) as $user_id ) {
			$result = MMED_Todo_Engine::create_todo_for_user(
				$user_id,
				array(
					'title'     => $item->title,
					'notes'     => $item->description,
					'due_date'  => $item->due_date,
					'priority'  => 'urgent' === $item->priority ? 'high' : $item->priority,
					'category'  => 'session_followup',
				)
			);

			if ( ! is_wp_error( $result ) ) {
				$count++;
			}
		}

		return array(
			'action_item_id' => (int) $item->id,
			'created'        => $count,
			'total'          => count( array_unique( $user_ids ) ),
		);
	}

	/**
	 * Get action items for a session date.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array
	 */
	public static function get_action_items( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s ORDER BY created_at DESC, id DESC',
				absint( $session_group_id ),
				self::sanitize_date( $event_date )
			)
		);

		return array_map( array( __CLASS__, 'format_item' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Delete an action item.
	 *
	 * @param int $id Action item ID.
	 * @return bool
	 */
	public static function delete_action_item( $id ) {
		global $wpdb;

		self::maybe_install();

		return (bool) $wpdb->delete( self::table_name(), array( 'id' => absint( $id ) ), array( '%d' ) );
	}

	/**
	 * Count action items for event payloads.
	 *
	 * @param object $event Event row.
	 * @return int
	 */
	public static function count_for_event( $event ) {
		global $wpdb;

		if ( empty( $event->source_group_id ) || empty( $event->start_at ) ) {
			return 0;
		}

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s',
				absint( $event->source_group_id ),
				date( 'Y-m-d', strtotime( $event->start_at ) )
			)
		);
	}

	/**
	 * REST: create.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_create( $request ) {
		$payload = self::request_payload( $request );
		$id      = self::create_action_item( absint( $request['id'] ), $payload['event_date'] ?? '', $payload );

		if ( is_wp_error( $id ) ) {
			return $id;
		}

		return new WP_REST_Response( self::format_item( self::get_action_item_row( $id ) ), 201 );
	}

	/**
	 * REST: list.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_list( $request ) {
		return new WP_REST_Response(
			array(
				'action_items' => self::get_action_items( absint( $request['id'] ), $request->get_param( 'date' ) ),
			),
			200
		);
	}

	/**
	 * REST: delete.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_delete( $request ) {
		$item = self::get_action_item_row( absint( $request['item_id'] ) );
		if ( ! $item || (int) $item->session_group_id !== absint( $request['id'] ) ) {
			return new WP_Error( 'mmed_action_item_not_found', 'Action item not found.', array( 'status' => 404 ) );
		}

		self::delete_action_item( $item->id );

		return new WP_REST_Response( array( 'deleted' => true, 'id' => (int) $item->id ), 200 );
	}

	/**
	 * REST: spawn todos.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_spawn( $request ) {
		$payload = self::request_payload( $request );
		$result  = self::spawn_todos( absint( $request['item_id'] ), $payload['attendee_user_ids'] ?? array() );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * Format an item.
	 *
	 * @param object|null $row Row.
	 * @return array
	 */
	public static function format_item( $row ) {
		if ( ! $row ) {
			return array();
		}

		return array(
			'id'               => (int) $row->id,
			'session_group_id' => (int) $row->session_group_id,
			'event_date'       => (string) $row->event_date,
			'title'            => (string) $row->title,
			'description'      => (string) $row->description,
			'due_date'         => $row->due_date ? (string) $row->due_date : null,
			'priority'         => (string) $row->priority,
			'created_by'       => (int) $row->created_by,
			'created_at'       => (string) $row->created_at,
		);
	}

	/**
	 * Return attendee IDs.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array
	 */
	private static function attendee_user_ids( $session_group_id, $event_date ) {
		if ( class_exists( 'MMED_Attendance' ) ) {
			$rows = MMED_Attendance::get_session_attendance( $session_group_id, $event_date );
			$ids  = array();
			foreach ( $rows as $row ) {
				if ( in_array( $row['attendance_status'] ?? '', array( 'present', 'partial' ), true ) ) {
					$ids[] = absint( $row['user_id'] ?? 0 );
				}
			}
			if ( ! empty( $ids ) ) {
				return array_values( array_unique( array_filter( $ids ) ) );
			}
		}

		if ( ! class_exists( 'MMED_Session_Manager' ) ) {
			return array();
		}

		$group = MMED_Session_Manager::get_group_by_id( $session_group_id );
		if ( ! $group ) {
			return array();
		}

		return array_map(
			static function ( $user ) {
				return (int) $user->ID;
			},
			MMED_Session_Manager::get_enrolled_students( $group->enrollment_template )
		);
	}

	/**
	 * Return action item row.
	 *
	 * @param int $id Item ID.
	 * @return object|null
	 */
	private static function get_action_item_row( $id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				absint( $id )
			)
		);
	}

	/**
	 * Request payload helper.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array
	 */
	private static function request_payload( $request ) {
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}
		return is_array( $payload ) ? $payload : array();
	}

	/**
	 * Sanitize date.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitize priority.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_priority( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, array( 'low', 'medium', 'high', 'urgent' ), true ) ? $value : 'medium';
	}

	/**
	 * wpdb format map.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();
		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'session_group_id', 'created_by' ), true ) ? '%d' : '%s';
		}
		return $formats;
	}
}
