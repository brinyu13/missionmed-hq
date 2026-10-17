<?php
/**
 * MissionMed persistent session chat and Q&A.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stores session chat messages.
 */
class MMED_Session_Chat {

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
		return $wpdb->prefix . 'mmed_session_chat';
	}

	/**
	 * Create or update table.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_session_chat_db_version' ) === self::DB_VERSION ) {
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
			user_id bigint(20) unsigned NOT NULL,
			message text NOT NULL,
			is_question tinyint(1) DEFAULT 0,
			is_answered tinyint(1) DEFAULT 0,
			answered_by bigint(20) unsigned DEFAULT 0,
			parent_id bigint(20) unsigned DEFAULT 0,
			pinned tinyint(1) DEFAULT 0,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_session_date (session_group_id, event_date),
			KEY idx_user (user_id),
			KEY idx_parent (parent_id),
			KEY idx_pinned (pinned)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_session_chat_db_version', self::DB_VERSION, false );
	}

	/**
	 * Post a message.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @param string $message          Message.
	 * @param bool   $is_question      Question flag.
	 * @param int    $parent_id        Parent ID.
	 * @return int|WP_Error
	 */
	public static function post_message( $session_group_id, $event_date, $user_id, $message, $is_question = false, $parent_id = 0 ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$user_id          = absint( $user_id );
		$message          = wp_kses_post( $message );
		$parent_id        = absint( $parent_id );

		if ( ! $session_group_id || ! $event_date || ! $user_id || '' === trim( wp_strip_all_tags( $message ) ) ) {
			return new WP_Error( 'mmed_chat_invalid', 'Session, date, user, and message are required.', array( 'status' => 400 ) );
		}

		if ( ! self::user_can_access_session( $session_group_id, $event_date, $user_id ) ) {
			return new WP_Error( 'mmed_chat_forbidden', 'You do not have access to this session chat.', array( 'status' => 403 ) );
		}

		$inserted = $wpdb->insert(
			self::table_name(),
			array(
				'session_group_id' => $session_group_id,
				'event_date'       => $event_date,
				'user_id'          => $user_id,
				'message'          => $message,
				'is_question'      => $is_question ? 1 : 0,
				'is_answered'      => 0,
				'answered_by'      => 0,
				'parent_id'        => $parent_id,
				'pinned'           => 0,
				'created_at'       => current_time( 'mysql' ),
				'updated_at'       => current_time( 'mysql' ),
			),
			array( '%d', '%s', '%d', '%s', '%d', '%d', '%d', '%d', '%d', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return new WP_Error( 'mmed_chat_create_failed', 'Message could not be posted.', array( 'status' => 500 ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Get messages.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $limit            Limit.
	 * @param int    $offset           Offset.
	 * @return array
	 */
	public static function get_messages( $session_group_id, $event_date, $limit = 50, $offset = 0 ) {
		global $wpdb;

		self::maybe_install();

		$limit  = min( 100, max( 1, absint( $limit ) ) );
		$offset = max( 0, absint( $offset ) );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s ORDER BY pinned DESC, created_at ASC, id ASC LIMIT %d OFFSET %d',
				absint( $session_group_id ),
				self::sanitize_date( $event_date ),
				$limit,
				$offset
			)
		);

		return array_map( array( __CLASS__, 'format_message' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Mark a question answered.
	 *
	 * @param int $message_id    Message ID.
	 * @param int $admin_user_id Admin user ID.
	 * @return bool
	 */
	public static function mark_answered( $message_id, $admin_user_id ) {
		return self::update_message_flags(
			$message_id,
			array(
				'is_answered' => 1,
				'answered_by' => absint( $admin_user_id ),
			)
		);
	}

	/**
	 * Pin a message.
	 *
	 * @param int $message_id Message ID.
	 * @return bool
	 */
	public static function pin_message( $message_id ) {
		$row = self::get_message_row( $message_id );
		return self::update_message_flags( $message_id, array( 'pinned' => $row && ! empty( $row->pinned ) ? 0 : 1 ) );
	}

	/**
	 * Delete a message.
	 *
	 * @param int $message_id Message ID.
	 * @return bool
	 */
	public static function delete_message( $message_id ) {
		global $wpdb;
		return (bool) $wpdb->delete( self::table_name(), array( 'id' => absint( $message_id ) ), array( '%d' ) );
	}

	/**
	 * Count messages for event payloads.
	 *
	 * @param object $event Event row.
	 * @return int
	 */
	public static function count_for_event( $event ) {
		global $wpdb;

		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_chat' ) ) {
			return 0;
		}

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
	 * REST: list messages.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_list( $request ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_chat' ) ) {
			return new WP_Error( 'mmed_chat_disabled', 'Session chat is not enabled.', array( 'status' => 403 ) );
		}

		$session_group_id = absint( $request['session_group_id'] );
		$date             = self::sanitize_date( $request->get_param( 'date' ) );

		if ( ! self::user_can_access_session( $session_group_id, $date, get_current_user_id() ) ) {
			return new WP_Error( 'mmed_chat_forbidden', 'You do not have access to this session chat.', array( 'status' => 403 ) );
		}

		return new WP_REST_Response(
			array(
				'messages' => self::get_messages( $session_group_id, $date, $request->get_param( 'limit' ), $request->get_param( 'offset' ) ),
			),
			200
		);
	}

	/**
	 * REST: post message.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_post( $request ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_chat' ) ) {
			return new WP_Error( 'mmed_chat_disabled', 'Session chat is not enabled.', array( 'status' => 403 ) );
		}

		$user_id = get_current_user_id();
		$key     = 'mmed_chat_rate_' . $user_id;

		if ( get_transient( $key ) ) {
			return new WP_Error( 'mmed_chat_rate_limited', 'Please wait before sending another message.', array( 'status' => 429 ) );
		}

		$payload = self::request_payload( $request );
		$id      = self::post_message(
			absint( $request['session_group_id'] ),
			$payload['date'] ?? '',
			$user_id,
			$payload['message'] ?? '',
			! empty( $payload['is_question'] ),
			absint( $payload['parent_id'] ?? 0 )
		);

		if ( is_wp_error( $id ) ) {
			return $id;
		}

		set_transient( $key, 1, 3 );

		return new WP_REST_Response( self::format_message( self::get_message_row( $id ) ), 201 );
	}

	/**
	 * REST: mark answered.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_mark_answered( $request ) {
		self::mark_answered( absint( $request['message_id'] ), get_current_user_id() );
		return new WP_REST_Response( array( 'answered' => true ), 200 );
	}

	/**
	 * REST: pin.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_pin( $request ) {
		self::pin_message( absint( $request['message_id'] ) );
		return new WP_REST_Response( array( 'pinned' => true ), 200 );
	}

	/**
	 * REST: delete.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_delete( $request ) {
		self::delete_message( absint( $request['message_id'] ) );
		return new WP_REST_Response( array( 'deleted' => true ), 200 );
	}

	/**
	 * Format a message.
	 *
	 * @param object|null $row Row.
	 * @return array
	 */
	public static function format_message( $row ) {
		if ( ! $row ) {
			return array();
		}

		$user = get_user_by( 'id', (int) $row->user_id );

		return array(
			'id'               => (int) $row->id,
			'session_group_id' => (int) $row->session_group_id,
			'event_date'       => (string) $row->event_date,
			'user_id'          => (int) $row->user_id,
			'user_name'        => $user ? $user->display_name : 'Student',
			'message'          => wp_kses_post( $row->message ),
			'is_question'      => (bool) $row->is_question,
			'is_answered'      => (bool) $row->is_answered,
			'answered_by'      => (int) $row->answered_by,
			'parent_id'        => (int) $row->parent_id,
			'pinned'           => (bool) $row->pinned,
			'created_at'       => (string) $row->created_at,
			'updated_at'       => (string) $row->updated_at,
		);
	}

	/**
	 * Update flags.
	 *
	 * @param int   $message_id Message ID.
	 * @param array $payload    Payload.
	 * @return bool
	 */
	private static function update_message_flags( $message_id, $payload ) {
		global $wpdb;

		$payload['updated_at'] = current_time( 'mysql' );
		$formats              = array();
		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'is_answered', 'answered_by', 'pinned' ), true ) ? '%d' : '%s';
		}

		return false !== $wpdb->update(
			self::table_name(),
			$payload,
			array( 'id' => absint( $message_id ) ),
			$formats,
			array( '%d' )
		);
	}

	/**
	 * Access check for student chat.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param int    $user_id          User ID.
	 * @return bool
	 */
	private static function user_can_access_session( $session_group_id, $event_date, $user_id ) {
		global $wpdb;

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return false;
		}

		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . MMED_Calendar_Engine::table_name() . ' WHERE user_id = %d AND source_group_id = %d AND DATE(start_at) = %s AND status <> %s LIMIT 1',
				absint( $user_id ),
				absint( $session_group_id ),
				self::sanitize_date( $event_date ),
				'cancelled'
			)
		);
	}

	/**
	 * Return message row.
	 *
	 * @param int $id Message ID.
	 * @return object|null
	 */
	private static function get_message_row( $id ) {
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
}
