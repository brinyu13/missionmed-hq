<?php
/**
 * MissionMed Matrix calendar event engine.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns the Matrix events table and authenticated event CRUD.
 */
class MMED_Calendar_Engine {

	/**
	 * Calendar table schema version.
	 */
	const DB_VERSION = '20260517.1';
	const CATEGORY_OPTION = 'mmed_calendar_system_categories_v1';
	const CATEGORY_USER_META = 'mmed_calendar_personal_categories_v1';
	const VISIBILITY_USER_META = 'mmed_calendar_category_visibility_v1';
	const FAVORITES_USER_META = 'mmed_calendar_favorites_v1';
	const NRMP_DATASET_VERSION = '2026.1';
	const NRMP_DATASET_OPTION = 'mmed_calendar_nrmp_dataset_version';
	const ADMIN_AUDIT_OPTION = 'mmed_calendar_admin_audit_v1';

	/**
	 * Initialize runtime checks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		self::maybe_seed_nrmp_dataset();
	}

	/**
	 * Create or update the calendar table via dbDelta().
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_calendar_engine_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table_name      = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			event_type varchar(30) NOT NULL DEFAULT 'general',
			title varchar(255) NOT NULL,
			description text NULL,
			start_at datetime NOT NULL,
			end_at datetime NULL,
			all_day tinyint(1) DEFAULT 0,
			location varchar(255) NULL,
			meeting_url varchar(500) NULL,
			meeting_platform varchar(30) NULL,
			recurrence varchar(100) NULL,
			recurrence_end date NULL,
			parent_event_id bigint(20) unsigned NULL,
			source varchar(30) DEFAULT 'manual',
			source_id varchar(100) NULL,
			category varchar(50) NULL,
			priority tinyint DEFAULT 0,
			status varchar(20) DEFAULT 'active',
			meta_json JSON NULL,
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY idx_user_date (user_id, start_at),
			KEY idx_type (event_type),
			KEY idx_source (source, source_id)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_calendar_engine_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return the events table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_events';
	}

	/**
	 * Read events for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_events( $request ) {
		global $wpdb;

		self::maybe_install();

		$user_id = get_current_user_id();
		$where   = array( '(user_id = %d OR user_id = 0)', "status <> 'cancelled'" );
		$values  = array( $user_id );

		$start = self::sanitize_datetime( $request->get_param( 'start' ), false );
		$end   = self::sanitize_datetime( $request->get_param( 'end' ), false );
		$type  = self::sanitize_enum( $request->get_param( 'type' ), self::event_types(), '' );
		$source = self::sanitize_enum( $request->get_param( 'source' ), self::sources(), '' );
		$status = self::sanitize_enum( $request->get_param( 'status' ), self::statuses(), '' );

		if ( $start ) {
			$where[]  = '(end_at IS NULL OR end_at >= %s)';
			$values[] = $start;
		}

		if ( $end ) {
			$where[]  = 'start_at <= %s';
			$values[] = $end;
		}

		if ( $type ) {
			$where[]  = 'event_type = %s';
			$values[] = $type;
		}

		if ( $source ) {
			$where[]  = 'source = %s';
			$values[] = $source;
		}

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		if ( ! self::is_no_sync_request( $request ) ) {
			self::sync_scheduler_events_for_user( $user_id, $start, $end );
		}

		$sql = 'SELECT * FROM ' . self::table_name();
		$sql .= ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY start_at ASC, id ASC';
		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return new WP_REST_Response(
			array(
				'events' => array_map( array( __CLASS__, 'format_event' ), is_array( $rows ) ? $rows : array() ),
			),
			200
		);
	}

	/**
	 * Determine whether this read should bypass Scheduler feed sync.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return bool
	 */
	private static function is_no_sync_request( $request ) {
		if ( ! $request instanceof WP_REST_Request ) {
			return false;
		}

		if ( self::is_truthy_request_value( $request->get_param( 'no_sync' ) ) ) {
			return true;
		}

		if ( self::is_truthy_request_value( $request->get_param( 'validation' ) ) ) {
			return true;
		}

		if ( $request->has_param( 'sync' ) && self::is_falsey_request_value( $request->get_param( 'sync' ) ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Normalize truthy request values.
	 *
	 * @param mixed $value Request value.
	 * @return bool
	 */
	private static function is_truthy_request_value( $value ) {
		if ( is_bool( $value ) ) {
			return $value;
		}

		return in_array( strtolower( trim( (string) $value ) ), array( '1', 'true', 'yes', 'y', 'on' ), true );
	}

	/**
	 * Normalize falsey request values.
	 *
	 * @param mixed $value Request value.
	 * @return bool
	 */
	private static function is_falsey_request_value( $value ) {
		if ( is_bool( $value ) ) {
			return ! $value;
		}

		return in_array( strtolower( trim( (string) $value ) ), array( '0', 'false', 'no', 'n', 'off' ), true );
	}

	/**
	 * Create an event for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_event( $request ) {
		global $wpdb;

		self::maybe_install();

		$raw     = self::request_payload( $request );
		if ( ! current_user_can( 'manage_options' ) ) {
			$requested_type = sanitize_key( $raw['event_type'] ?? '' );
			$requested_source = sanitize_key( $raw['source'] ?? 'manual' );
			$requested_audience = sanitize_key( $raw['audience'] ?? '' );
			if ( in_array( $requested_type, array( 'drill_step1', 'drill_step23', 'nrmp_date' ), true ) || in_array( $requested_source, array( 'system', 'admin' ), true ) || 'all_students' === $requested_audience ) {
				return new WP_Error( 'mmed_event_forbidden', 'This event type requires administrator access.', array( 'status' => 403 ) );
			}
		}
		$payload = self::sanitize_event_payload( $raw, false );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$payload['user_id']    = self::resolve_event_user_id( $raw, get_current_user_id(), $payload['source'] ?? '' );
		$payload['created_at'] = current_time( 'mysql' );
		$payload['updated_at'] = current_time( 'mysql' );

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_event_create_failed', 'Event could not be created.', array( 'status' => 500 ) );
		}

		$event = self::get_owned_event( (int) $wpdb->insert_id, (int) $payload['user_id'] );

		return new WP_REST_Response( self::format_event( $event ), 201 );
	}

	/**
	 * Update an owned event.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_event( $request ) {
		global $wpdb;

		self::maybe_install();

		$event_id = absint( $request['id'] );
		$user_id  = get_current_user_id();
		$event    = self::get_owned_event( $event_id, $user_id );

		if ( ! $event && current_user_can( 'manage_options' ) ) {
			$event = self::get_admin_editable_event( $event_id );
		}

		if ( ! $event ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		$raw     = self::request_payload( $request );
		$payload = self::sanitize_event_payload( $raw, true );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$event_source   = isset( $payload['source'] ) ? $payload['source'] : (string) $event->source;
		$target_user_id = self::resolve_event_user_id( $raw, (int) $event->user_id, $event_source );
		if ( current_user_can( 'manage_options' ) && (int) $event->user_id !== $target_user_id ) {
			$payload['user_id'] = $target_user_id;
		}

		if ( empty( $payload ) ) {
			return new WP_REST_Response( self::format_event( $event ), 200 );
		}

		$payload['updated_at'] = current_time( 'mysql' );

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			array(
				'id'      => $event_id,
				'user_id' => (int) $event->user_id,
			),
			self::format_map( $payload ),
			array( '%d', '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_event_update_failed', 'Event could not be updated.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response( self::format_event( self::get_owned_event( $event_id, $target_user_id ) ), 200 );
	}

	/**
	 * Soft delete an owned event.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_event( $request ) {
		global $wpdb;

		self::maybe_install();

		$event_id = absint( $request['id'] );
		$user_id  = get_current_user_id();

		$event = self::get_owned_event( $event_id, $user_id );
		if ( ! $event && current_user_can( 'manage_options' ) ) {
			$event = self::get_admin_editable_event( $event_id );
		}

		if ( ! $event ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		$wpdb->update(
			self::table_name(),
			array(
				'status'     => 'cancelled',
				'updated_at' => current_time( 'mysql' ),
			),
			array(
				'id'      => $event_id,
				'user_id' => (int) $event->user_id,
			),
			array( '%s', '%s' ),
			array( '%d', '%d' )
		);

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $event_id ), 200 );
	}

	/**
	 * Count upcoming events for dashboard stats.
	 *
	 * @param int $user_id WordPress user ID.
	 * @param int $days    Number of days to count.
	 * @return int
	 */
	public static function count_upcoming_events( $user_id, $days ) {
		global $wpdb;

		self::maybe_install();

		$now = current_time( 'mysql' );
		$end = gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) . ' +' . absint( $days ) . ' days' ) );

		self::sync_scheduler_events_for_user( $user_id, $now, $end );

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::table_name() . " WHERE (user_id = %d OR user_id = 0) AND status = 'active' AND start_at >= %s AND start_at <= %s",
				absint( $user_id ),
				$now,
				$end
			)
		);
	}

	/**
	 * Return the next Scheduler appointment for dashboard display.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array|null
	 */
	public static function get_next_appointment( $user_id ) {
		global $wpdb;

		self::maybe_install();

		$now = current_time( 'mysql' );
		$end = gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) . ' +30 days' ) );

		self::sync_scheduler_events_for_user( $user_id, $now, $end );

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . " WHERE user_id = %d AND source = 'scheduler' AND status = 'active' AND start_at >= %s ORDER BY start_at ASC, id ASC LIMIT 1",
				absint( $user_id ),
				$now
			)
		);

		return $row ? self::format_event( $row ) : null;
	}

	/**
	 * Pull current-user Scheduler appointments into the Matrix calendar cache.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param string $start   Range start.
	 * @param string $end     Range end.
	 * @return array
	 */
	public static function sync_scheduler_events_for_user( $user_id, $start = '', $end = '' ) {
		$user_id = absint( $user_id );
		if ( $user_id <= 0 ) {
			return array( 'ok' => false, 'status' => 'skipped', 'reason' => 'missing_user' );
		}

		$cache_key = 'mmed_sched_cal_' . $user_id . '_' . md5( (string) $start . '|' . (string) $end );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$query = array();
		if ( $start ) {
			$query['start'] = self::format_feed_datetime( $start );
		}
		if ( $end ) {
			$query['end'] = self::format_feed_datetime( $end );
		}

		$url = add_query_arg( $query, home_url( '/api/scheduler/calendar-feed' ) );
		$args = array(
			'timeout'     => 8,
			'redirection' => 0,
			'headers'     => array(
				'Accept' => 'application/json',
			),
		);

		if ( isset( $_SERVER['HTTP_COOKIE'] ) ) {
			$args['headers']['Cookie'] = str_replace( array( "\r", "\n" ), '', (string) wp_unslash( $_SERVER['HTTP_COOKIE'] ) );
		}

		$response = wp_remote_get( $url, $args );
		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false, 'status' => 'unreachable', 'reason' => 'request_failed' );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( 200 !== $status || empty( $body['ok'] ) || ! isset( $body['data']['events'] ) || ! is_array( $body['data']['events'] ) ) {
			return array( 'ok' => false, 'status' => 'unavailable', 'http_status' => $status );
		}

		$result = self::upsert_scheduler_feed_events( $user_id, $body['data']['events'], $start, $end );
		set_transient( $cache_key, $result, 5 * MINUTE_IN_SECONDS );

		return $result;
	}

	/**
	 * Upsert Scheduler feed events into wp_mmed_events.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param array  $events  Scheduler feed events.
	 * @param string $start   Range start.
	 * @param string $end     Range end.
	 * @return array
	 */
	protected static function upsert_scheduler_feed_events( $user_id, $events, $start = '', $end = '' ) {
		global $wpdb;

		$seen = array();
		$count = 0;

		foreach ( (array) $events as $event ) {
			if ( ! is_array( $event ) || 'scheduler' !== (string) ( $event['source'] ?? '' ) || empty( $event['source_id'] ) || empty( $event['start_at'] ) ) {
				continue;
			}

			$source_id = sanitize_text_field( $event['source_id'] );
			$seen[] = $source_id;
			$payload = self::sanitize_scheduler_feed_event( $user_id, $event );
			if ( empty( $payload['title'] ) || empty( $payload['start_at'] ) ) {
				continue;
			}

			$existing_id = $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM ' . self::table_name() . " WHERE user_id = %d AND source = 'scheduler' AND source_id = %s LIMIT 1",
					$user_id,
					$source_id
				)
			);

			if ( $existing_id ) {
				$wpdb->update( self::table_name(), $payload, array( 'id' => absint( $existing_id ) ), self::format_map( $payload ), array( '%d' ) );
			} else {
				$wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
			}
			$count++;
		}

		if ( $start || $end ) {
			self::cancel_missing_scheduler_events( $user_id, $seen, $start, $end );
		}

		return array( 'ok' => true, 'status' => 'synced', 'synced' => $count );
	}

	/**
	 * Sanitize one Scheduler feed event for local Calendar storage.
	 *
	 * @param int   $user_id WordPress user ID.
	 * @param array $event   Raw Scheduler feed event.
	 * @return array
	 */
	protected static function sanitize_scheduler_feed_event( $user_id, $event ) {
		$status = sanitize_key( $event['status'] ?? 'booked' );
		$status = in_array( $status, array( 'canceled', 'cancelled' ), true ) ? 'cancelled' : 'active';
		$meta = isset( $event['meta_json'] ) && is_array( $event['meta_json'] )
			? self::sanitize_meta( $event['meta_json'] )
			: array();

		$payload = array(
			'user_id'          => absint( $user_id ),
			'event_type'       => 'appointment',
			'title'            => sanitize_text_field( $event['title'] ?? 'MissionMed appointment' ),
			'description'      => wp_kses_post( $event['description'] ?? '' ),
			'start_at'         => self::format_feed_datetime( $event['start_at'] ?? '' ),
			'end_at'           => self::format_feed_datetime( $event['end_at'] ?? '' ),
			'all_day'          => 0,
			'location'         => sanitize_text_field( $event['location'] ?? '' ),
			'meeting_url'      => esc_url_raw( $event['meeting_url'] ?? '' ),
			'meeting_platform' => sanitize_key( $event['meeting_platform'] ?? '' ),
			'source'           => 'scheduler',
			'source_id'        => sanitize_text_field( $event['source_id'] ?? '' ),
			'category'         => sanitize_key( $event['category'] ?? 'appointment' ),
			'priority'         => 0,
			'status'           => $status,
			'meta_json'        => wp_json_encode( $meta ),
			'updated_at'       => current_time( 'mysql' ),
		);

		if ( empty( $payload['end_at'] ) && ! empty( $payload['start_at'] ) ) {
			$payload['end_at'] = gmdate( 'Y-m-d H:i:s', strtotime( $payload['start_at'] . ' +1 hour' ) );
		}

		return $payload;
	}

	/**
	 * Mark cached Scheduler events missing from a successful feed response cancelled.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param array  $seen    Source IDs seen in the feed.
	 * @param string $start   Range start.
	 * @param string $end     Range end.
	 * @return void
	 */
	protected static function cancel_missing_scheduler_events( $user_id, $seen, $start = '', $end = '' ) {
		global $wpdb;

		$where = array( "user_id = %d", "source = 'scheduler'", "status <> 'cancelled'" );
		$values = array( absint( $user_id ) );

		if ( $start ) {
			$where[] = 'start_at >= %s';
			$values[] = self::format_feed_datetime( $start );
		}
		if ( $end ) {
			$where[] = 'start_at <= %s';
			$values[] = self::format_feed_datetime( $end );
		}
		if ( ! empty( $seen ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $seen ), '%s' ) );
			$where[] = 'source_id NOT IN (' . $placeholders . ')';
			$values = array_merge( $values, array_map( 'sanitize_text_field', $seen ) );
		}

		$sql = 'UPDATE ' . self::table_name() . " SET status = 'cancelled', updated_at = %s WHERE " . implode( ' AND ', $where );
		array_unshift( $values, current_time( 'mysql' ) );
		$wpdb->query( $wpdb->prepare( $sql, $values ) );
	}

	/**
	 * Normalize feed date/time to Matrix Calendar local storage.
	 *
	 * Scheduler feed timestamps include their source offset. Store them in the
	 * WordPress site timezone so the Matrix Calendar renders host/student time.
	 *
	 * @param mixed $value Date/time value.
	 * @return string
	 */
	protected static function format_feed_datetime( $value ) {
		$value = sanitize_text_field( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		if ( preg_match( '/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?(?:\.\d+)?[+-]\d{2}:?\d{2}$/', $value, $matches ) ) {
			return $matches[1] . ' ' . $matches[2] . ':' . ( $matches[3] ?? '00' );
		}

		if ( preg_match( '/Z$/i', $value ) ) {
			try {
				$date = new DateTimeImmutable( $value );
				return $date->setTimezone( new DateTimeZone( 'America/New_York' ) )->format( 'Y-m-d H:i:s' );
			} catch ( Exception $e ) {
				return '';
			}
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d H:i:s', $timestamp ) : '';
	}

	/**
	 * Fetch one owned event.
	 *
	 * @param int $event_id Event ID.
	 * @param int $user_id  User ID.
	 * @return object|null
	 */
	public static function get_owned_event( $event_id, $user_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d AND user_id = %d',
				absint( $event_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Return an event an admin can edit, including global all-student events.
	 *
	 * @param int $event_id Event ID.
	 * @return object|null
	 */
	protected static function get_admin_editable_event( $event_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				absint( $event_id )
			)
		);
	}

	/**
	 * Convert a database row to REST shape.
	 *
	 * @param object|null $row Event row.
	 * @return array
	 */
	public static function format_event( $row ) {
		if ( ! $row ) {
			return array();
		}

		$meta = array();
		if ( ! empty( $row->meta_json ) ) {
			$decoded = json_decode( $row->meta_json, true );
			$meta    = is_array( $decoded ) ? $decoded : array();
		}

		return array(
			'id'               => (int) $row->id,
			'user_id'          => (int) $row->user_id,
			'event_type'       => (string) $row->event_type,
			'title'            => (string) $row->title,
			'description'      => (string) $row->description,
			'start_at'         => self::format_datetime( $row->start_at ),
			'end_at'           => $row->end_at ? self::format_datetime( $row->end_at ) : null,
			'all_day'          => (bool) $row->all_day,
			'location'         => (string) $row->location,
			'meeting_url'      => (string) ( $row->meeting_url ?? '' ),
			'meeting_platform' => (string) ( $row->meeting_platform ?? '' ),
			'recurrence'       => (string) ( $row->recurrence ?? '' ),
			'recurrence_end'   => ! empty( $row->recurrence_end ) ? (string) $row->recurrence_end : null,
			'parent_event_id'  => ! empty( $row->parent_event_id ) ? (int) $row->parent_event_id : null,
			'source'           => (string) $row->source,
			'source_id'        => (string) $row->source_id,
			'category'         => (string) $row->category,
			'priority'         => (int) $row->priority,
			'status'           => (string) $row->status,
			'meta'             => $meta,
			'created_at'       => self::format_datetime( $row->created_at ),
			'updated_at'       => self::format_datetime( $row->updated_at ),
		);
	}

	/**
	 * Sanitize incoming create/update payloads.
	 *
	 * @param array|null $raw      Raw payload.
	 * @param bool       $partial  Whether missing fields are allowed.
	 * @return array|WP_Error
	 */
	protected static function sanitize_event_payload( $raw, $partial ) {
		$raw     = is_array( $raw ) ? $raw : array();
		$payload = array();

		if ( array_key_exists( 'title', $raw ) ) {
			$payload['title'] = sanitize_text_field( $raw['title'] );
		}

		if ( array_key_exists( 'description', $raw ) ) {
			$payload['description'] = wp_kses_post( $raw['description'] );
		}

		if ( array_key_exists( 'event_type', $raw ) ) {
			$payload['event_type'] = self::sanitize_enum( $raw['event_type'], self::event_types(), 'general' );
		} elseif ( ! $partial ) {
			$payload['event_type'] = 'general';
		}

		if ( array_key_exists( 'start_at', $raw ) ) {
			$payload['start_at'] = self::sanitize_datetime( $raw['start_at'], true );
		}

		if ( array_key_exists( 'end_at', $raw ) ) {
			$payload['end_at'] = self::sanitize_datetime( $raw['end_at'], false );
		}

		if ( array_key_exists( 'all_day', $raw ) ) {
			$payload['all_day'] = ! empty( $raw['all_day'] ) ? 1 : 0;
		}

		if ( array_key_exists( 'location', $raw ) ) {
			$payload['location'] = sanitize_text_field( $raw['location'] );
		}

		if ( array_key_exists( 'meeting_url', $raw ) ) {
			$payload['meeting_url'] = esc_url_raw( $raw['meeting_url'] );
		}

		if ( array_key_exists( 'meeting_platform', $raw ) ) {
			$payload['meeting_platform'] = self::sanitize_enum(
				$raw['meeting_platform'],
				array( 'webex', 'zoom', 'google_meet', 'teams', '' ),
				''
			);
		}

		if ( array_key_exists( 'recurrence', $raw ) ) {
			$payload['recurrence'] = sanitize_text_field( $raw['recurrence'] );
		}

		if ( array_key_exists( 'recurrence_end', $raw ) ) {
			$payload['recurrence_end'] = self::sanitize_datetime( $raw['recurrence_end'], false );
		}

		if ( array_key_exists( 'parent_event_id', $raw ) ) {
			$payload['parent_event_id'] = absint( $raw['parent_event_id'] ) ?: null;
		}

		if ( array_key_exists( 'source', $raw ) ) {
			$payload['source'] = self::sanitize_enum( $raw['source'], self::sources(), 'manual' );
		} elseif ( ! $partial ) {
			$payload['source'] = 'manual';
		}

		if ( array_key_exists( 'source_id', $raw ) ) {
			$payload['source_id'] = sanitize_text_field( $raw['source_id'] );
		}

		if ( array_key_exists( 'category', $raw ) ) {
			$payload['category'] = sanitize_key( $raw['category'] );
		}

		if ( array_key_exists( 'priority', $raw ) ) {
			$payload['priority'] = min( 9, max( 0, absint( $raw['priority'] ) ) );
		}

		if ( array_key_exists( 'status', $raw ) ) {
			$payload['status'] = self::sanitize_enum( $raw['status'], self::statuses(), 'active' );
		} elseif ( ! $partial ) {
			$payload['status'] = 'active';
		}

		if ( array_key_exists( 'meta', $raw ) && is_array( $raw['meta'] ) ) {
			$payload['meta_json'] = wp_json_encode( self::sanitize_meta( $raw['meta'] ) );
		}

		if ( ! $partial && empty( $payload['title'] ) ) {
			return new WP_Error( 'mmed_event_title_required', 'Event title is required.', array( 'status' => 400 ) );
		}

		if ( ! $partial && empty( $payload['start_at'] ) ) {
			return new WP_Error( 'mmed_event_start_required', 'Event start date is required.', array( 'status' => 400 ) );
		}

		if ( empty( $payload['end_at'] ) && ! empty( $payload['start_at'] ) && ! empty( $payload['all_day'] ) ) {
			$payload['end_at'] = $payload['start_at'];
		} elseif ( empty( $payload['end_at'] ) && ! empty( $payload['start_at'] ) && ! $partial ) {
			$payload['end_at'] = gmdate( 'Y-m-d H:i:s', strtotime( $payload['start_at'] . ' +1 hour' ) );
		}

		return $payload;
	}

	/**
	 * Get JSON or form body parameters from a REST request.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array
	 */
	protected static function request_payload( $request ) {
		$payload = $request->get_json_params();

		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}

		return is_array( $payload ) ? $payload : array();
	}

	/**
	 * Resolve whether an admin-authored event should be visible to every student.
	 *
	 * @param array  $raw             Raw request payload.
	 * @param int    $default_user_id User ID to use for private events.
	 * @param string $event_source    Sanitized event source context.
	 * @return int
	 */
	protected static function resolve_event_user_id( $raw, $default_user_id, $event_source = '' ) {
		$audience = isset( $raw['audience'] ) ? sanitize_key( $raw['audience'] ) : '';
		if ( ! $audience && isset( $raw['meta']['audience'] ) ) {
			$audience = sanitize_key( $raw['meta']['audience'] );
		}

		if ( current_user_can( 'manage_options' ) ) {
			if ( 'all_students' === $audience ) {
				return 0;
			}

			if ( self::is_admin_global_event_source( $raw, $event_source ) ) {
				return 0;
			}
		}

		return absint( $default_user_id );
	}

	/**
	 * Determine whether an admin-authored event should default to global visibility.
	 *
	 * @param array  $raw          Raw request payload.
	 * @param string $event_source Sanitized event source context.
	 * @return bool
	 */
	protected static function is_admin_global_event_source( $raw, $event_source = '' ) {
		$source = $event_source ? sanitize_key( $event_source ) : '';

		if ( ! $source && isset( $raw['source'] ) ) {
			$source = sanitize_key( $raw['source'] );
		}

		if ( ! $source ) {
			$source = 'manual';
		}

		return in_array( $source, array( 'manual', 'admin' ), true );
	}

	/**
	 * Sanitize arbitrary event metadata recursively.
	 *
	 * @param array $meta Raw meta.
	 * @return array
	 */
	protected static function sanitize_meta( $meta ) {
		$clean = array();

		foreach ( $meta as $key => $value ) {
			$key = sanitize_key( $key );
			if ( is_array( $value ) ) {
				$clean[ $key ] = self::sanitize_meta( $value );
			} elseif ( is_bool( $value ) ) {
				$clean[ $key ] = $value;
			} elseif ( is_numeric( $value ) ) {
				$clean[ $key ] = 0 + $value;
			} else {
				$clean[ $key ] = sanitize_text_field( $value );
			}
		}

		return $clean;
	}

	/**
	 * Sanitize and normalize a date/time string to MySQL local time.
	 *
	 * @param mixed $value    Raw date/time.
	 * @param bool  $required Whether invalid values return empty or error upstream.
	 * @return string
	 */
	protected static function sanitize_datetime( $value, $required ) {
		$value = sanitize_text_field( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		$timestamp = strtotime( $value );
		if ( ! $timestamp ) {
			return $required ? '' : '';
		}

		return date_i18n( 'Y-m-d H:i:s', $timestamp );
	}

	/**
	 * Format MySQL date/time for REST.
	 *
	 * @param string $value MySQL date/time.
	 * @return string
	 */
	protected static function format_datetime( $value ) {
		if ( empty( $value ) ) {
			return '';
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d\TH:i:s', $timestamp ) : '';
	}

	/**
	 * Sanitize an enum value.
	 *
	 * @param mixed  $value   Raw value.
	 * @param array  $allowed Allowed values.
	 * @param string $default Default value.
	 * @return string
	 */
	protected static function sanitize_enum( $value, $allowed, $default ) {
		$value = sanitize_key( $value );
		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * wpdb format map for dynamic payloads.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	protected static function format_map( $payload ) {
		$formats = array();

		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'user_id', 'all_day', 'priority' ), true ) ? '%d' : '%s';
		}

		return $formats;
	}

	/**
	 * Allowed event types.
	 *
	 * @return array
	 */
	protected static function event_types() {
		return array( 'appointment', 'deadline', 'study_block', 'milestone', 'exam', 'interview', 'general', 'drill_step1', 'drill_step23', 'mr_session', 'mock_interview', 'nrmp_date', 'rotation', 'arena_event', 'custom' );
	}

	/**
	 * Allowed sources.
	 *
	 * @return array
	 */
	protected static function sources() {
		return array( 'manual', 'ssa', 'scheduler', 'webex', 'learndash', 'system', 'advisor', 'enrollment', 'admin' );
	}

	/**
	 * Allowed statuses.
	 *
	 * @return array
	 */
	protected static function statuses() {
		return array( 'active', 'completed', 'cancelled' );
	}

	/**
	 * Built-in category config with colors and icons.
	 *
	 * @return array
	 */
	public static function category_config() {
		return self::system_categories();
	}

	/**
	 * Return the durable category tree and the current user's presentation state.
	 *
	 * System definitions are site-owned. Personal definitions, visibility, and
	 * favorites remain isolated in user meta and never confer capabilities.
	 *
	 * @return array
	 */
	public static function category_state() {
		$user_id  = get_current_user_id();
		$personal = get_user_meta( $user_id, self::CATEGORY_USER_META, true );
		$visible  = get_user_meta( $user_id, self::VISIBILITY_USER_META, true );
		$favorites = get_user_meta( $user_id, self::FAVORITES_USER_META, true );

		return array(
			'categories' => array_values( array_merge( self::system_categories(), is_array( $personal ) ? $personal : array() ) ),
			'visibility' => is_array( $visible ) ? $visible : array(),
			'favorites'  => is_array( $favorites ) ? array_values( $favorites ) : array(),
			'can_manage_system' => current_user_can( 'manage_options' ),
			'dataset_version' => self::NRMP_DATASET_VERSION,
		);
	}

	/**
	 * Create a durable personal category, or an admin-owned system category.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_category( $request ) {
		$raw    = self::request_payload( $request );
		$name   = sanitize_text_field( $raw['name'] ?? $raw['label'] ?? '' );
		$system = ! empty( $raw['system'] );
		if ( '' === $name ) {
			return new WP_Error( 'mmed_category_name_required', 'Category name is required.', array( 'status' => 400 ) );
		}
		if ( $system && ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'mmed_category_forbidden', 'Only administrators can create system categories.', array( 'status' => 403 ) );
		}

		$user_id = get_current_user_id();
		$id      = ( $system ? 'system-' : 'personal-' . $user_id . '-' ) . sanitize_title( $name );
		$record  = self::sanitize_category_record( $raw, $id, $name, $system ? 'system' : 'personal', $user_id );
		if ( is_wp_error( $record ) ) {
			return $record;
		}

		if ( $system ) {
			$stored = get_option( self::CATEGORY_OPTION, array() );
			$stored = is_array( $stored ) ? $stored : array();
			if ( isset( self::system_categories()[ $id ] ) || isset( $stored[ $id ] ) ) {
				return new WP_Error( 'mmed_category_exists', 'A category with that name already exists.', array( 'status' => 409 ) );
			}
			$stored[ $id ] = $record;
			update_option( self::CATEGORY_OPTION, $stored, false );
			self::audit_admin_change( 'category_create', $id, array(), $record );
		} else {
			$stored = get_user_meta( $user_id, self::CATEGORY_USER_META, true );
			$stored = is_array( $stored ) ? $stored : array();
			if ( isset( $stored[ $id ] ) ) {
				$id = $id . '-' . wp_generate_password( 5, false, false );
				$record['id'] = $id;
			}
			$stored[ $id ] = $record;
			update_user_meta( $user_id, self::CATEGORY_USER_META, $stored );
		}

		return new WP_REST_Response( array( 'category' => $record, 'state' => self::category_state() ), 201 );
	}

	/**
	 * Update a category without allowing ownership escalation.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_category( $request ) {
		$id      = sanitize_key( $request['id'] );
		$raw     = self::request_payload( $request );
		$systems = self::system_categories();
		$user_id = get_current_user_id();

		if ( isset( $systems[ $id ] ) ) {
			if ( ! current_user_can( 'manage_options' ) ) {
				return new WP_Error( 'mmed_category_forbidden', 'System categories are read-only for students.', array( 'status' => 403 ) );
			}
			$before = $systems[ $id ];
			$record = self::sanitize_category_record( array_merge( $before, $raw ), $id, $raw['name'] ?? $raw['label'] ?? $before['name'], 'system', 0 );
			$stored = get_option( self::CATEGORY_OPTION, array() );
			$stored = is_array( $stored ) ? $stored : array();
			$stored[ $id ] = $record;
			update_option( self::CATEGORY_OPTION, $stored, false );
			self::audit_admin_change( 'category_update', $id, $before, $record );
		} else {
			$stored = get_user_meta( $user_id, self::CATEGORY_USER_META, true );
			$stored = is_array( $stored ) ? $stored : array();
			if ( ! isset( $stored[ $id ] ) || (int) ( $stored[ $id ]['owner_id'] ?? 0 ) !== $user_id ) {
				return new WP_Error( 'mmed_category_not_found', 'Personal category not found.', array( 'status' => 404 ) );
			}
			$record = self::sanitize_category_record( array_merge( $stored[ $id ], $raw ), $id, $raw['name'] ?? $raw['label'] ?? $stored[ $id ]['name'], 'personal', $user_id );
			$stored[ $id ] = $record;
			update_user_meta( $user_id, self::CATEGORY_USER_META, $stored );
		}

		return new WP_REST_Response( array( 'category' => $record, 'state' => self::category_state() ), 200 );
	}

	/**
	 * Delete a personal or non-required custom system category.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_category( $request ) {
		$id       = sanitize_key( $request['id'] );
		$user_id  = get_current_user_id();
		$required = array_keys( self::default_system_categories() );
		$systems  = self::system_categories();

		if ( isset( $systems[ $id ] ) ) {
			if ( ! current_user_can( 'manage_options' ) ) {
				return new WP_Error( 'mmed_category_forbidden', 'System categories are read-only for students.', array( 'status' => 403 ) );
			}
			if ( in_array( $id, $required, true ) ) {
				return new WP_Error( 'mmed_category_required', 'Required system categories cannot be deleted.', array( 'status' => 409 ) );
			}
			$stored = get_option( self::CATEGORY_OPTION, array() );
			$before = $systems[ $id ];
			unset( $stored[ $id ] );
			update_option( self::CATEGORY_OPTION, $stored, false );
			self::audit_admin_change( 'category_delete', $id, $before, array() );
		} else {
			$stored = get_user_meta( $user_id, self::CATEGORY_USER_META, true );
			$stored = is_array( $stored ) ? $stored : array();
			if ( ! isset( $stored[ $id ] ) || (int) ( $stored[ $id ]['owner_id'] ?? 0 ) !== $user_id ) {
				return new WP_Error( 'mmed_category_not_found', 'Personal category not found.', array( 'status' => 404 ) );
			}
			unset( $stored[ $id ] );
			update_user_meta( $user_id, self::CATEGORY_USER_META, $stored );
		}

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $id, 'state' => self::category_state() ), 200 );
	}

	/**
	 * Persist presentation-only category visibility for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function update_category_visibility( $request ) {
		$raw        = self::request_payload( $request );
		$visibility = isset( $raw['visibility'] ) && is_array( $raw['visibility'] ) ? $raw['visibility'] : array();
		$clean      = array();
		foreach ( $visibility as $id => $value ) {
			$clean[ sanitize_key( $id ) ] = ! empty( $value );
		}
		update_user_meta( get_current_user_id(), self::VISIBILITY_USER_META, $clean );
		return new WP_REST_Response( array( 'visibility' => $clean ), 200 );
	}

	/**
	 * Persist per-user event favorites; this never mutates shared event rows.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function update_favorites( $request ) {
		$raw       = self::request_payload( $request );
		$favorites = isset( $raw['favorites'] ) && is_array( $raw['favorites'] ) ? $raw['favorites'] : array();
		$clean     = array_values( array_unique( array_filter( array_map( 'sanitize_text_field', $favorites ) ) ) );
		$clean     = array_slice( $clean, 0, 500 );
		update_user_meta( get_current_user_id(), self::FAVORITES_USER_META, $clean );
		return new WP_REST_Response( array( 'favorites' => $clean ), 200 );
	}

	/**
	 * Default source/category hierarchy recovered from the production Classic model.
	 *
	 * @return array
	 */
	private static function default_system_categories() {
		$items = array(
			'exam_prep' => array( 'name' => 'ExamPrep', 'color' => '#24b7ed', 'icon' => 'exam', 'sort_order' => 10, 'source' => 'exam_prep' ),
			'drill_step1' => array( 'name' => "Dr. J's Drills — Step/Level 1", 'color' => '#35c8f5', 'icon' => 'microscope', 'sort_order' => 11, 'parent_id' => 'exam_prep', 'event_type' => 'drill_step1', 'admin_only' => true ),
			'drill_step23' => array( 'name' => "Dr. J's Drills — Step/Level 2 & 3", 'color' => '#7b8cff', 'icon' => 'stethoscope', 'sort_order' => 12, 'parent_id' => 'exam_prep', 'event_type' => 'drill_step23', 'admin_only' => true ),
			'mission_residency' => array( 'name' => 'Mission Residency', 'color' => '#efc84f', 'icon' => 'target', 'sort_order' => 20, 'source' => 'mission_residency' ),
			'mr_session_a' => array( 'name' => 'Session A', 'color' => '#f4d56e', 'sort_order' => 21, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'A' ),
			'mr_session_b' => array( 'name' => 'Session B', 'color' => '#f4d56e', 'sort_order' => 22, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'B' ),
			'mr_session_c' => array( 'name' => 'Session C', 'color' => '#f4d56e', 'sort_order' => 23, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'C' ),
			'mr_session_d' => array( 'name' => 'Session D', 'color' => '#f4d56e', 'sort_order' => 24, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'D' ),
			'mr_session_e' => array( 'name' => 'Session E', 'color' => '#f4d56e', 'sort_order' => 25, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'E' ),
			'mr_session_f' => array( 'name' => 'Session F', 'color' => '#f4d56e', 'sort_order' => 26, 'parent_id' => 'mission_residency', 'event_type' => 'mr_session', 'session' => 'F' ),
			'clinicals' => array( 'name' => 'Clinicals', 'color' => '#3ed597', 'icon' => 'hospital', 'sort_order' => 30, 'event_type' => 'rotation' ),
			'nrmp' => array( 'name' => 'NRMP', 'color' => '#ff5c7a', 'icon' => 'clipboard', 'sort_order' => 40, 'event_type' => 'nrmp_date' ),
			'arena' => array( 'name' => 'Arena', 'color' => '#8b5cf6', 'icon' => 'lightning', 'sort_order' => 50, 'event_type' => 'arena_event' ),
			'appointments' => array( 'name' => 'My Appointments', 'color' => '#56d8f5', 'icon' => 'calendar', 'sort_order' => 60, 'source' => 'scheduler' ),
		);

		foreach ( $items as $id => &$item ) {
			$item = array_merge(
				array( 'id' => $id, 'parent_id' => '', 'owner_scope' => 'system', 'owner_id' => 0, 'system' => true, 'visible' => true, 'sort_order' => 100, 'source' => '', 'event_type' => '', 'session' => '', 'admin_only' => false ),
				$item
			);
			$item['label'] = $item['name'];
		}
		unset( $item );

		return $items;
	}

	/**
	 * Merge durable admin overrides and additions over required definitions.
	 *
	 * @return array
	 */
	private static function system_categories() {
		$defaults = self::default_system_categories();
		$stored   = get_option( self::CATEGORY_OPTION, array() );
		$stored   = is_array( $stored ) ? $stored : array();
		return array_replace( $defaults, $stored );
	}

	/**
	 * Sanitize one category record while pinning ownership fields.
	 *
	 * @param array  $raw Raw category.
	 * @param string $id Stable ID.
	 * @param string $name Display name.
	 * @param string $scope Ownership scope.
	 * @param int    $owner_id Owner user ID.
	 * @return array|WP_Error
	 */
	private static function sanitize_category_record( $raw, $id, $name, $scope, $owner_id ) {
		$parent_id = sanitize_key( $raw['parent_id'] ?? '' );
		if ( 'personal' === $scope && $parent_id ) {
			$personal = get_user_meta( $owner_id, self::CATEGORY_USER_META, true );
			if ( ! isset( $personal[ $parent_id ] ) || (int) ( $personal[ $parent_id ]['owner_id'] ?? 0 ) !== (int) $owner_id ) {
				return new WP_Error( 'mmed_category_parent_forbidden', 'A personal subcategory must belong to one of your personal categories.', array( 'status' => 403 ) );
			}
		}
		$color = sanitize_hex_color( $raw['color'] ?? '#94a3b8' );
		return array(
			'id' => sanitize_key( $id ),
			'parent_id' => $parent_id,
			'name' => sanitize_text_field( $name ),
			'label' => sanitize_text_field( $name ),
			'color' => $color ? $color : '#94a3b8',
			'icon' => sanitize_key( $raw['icon'] ?? 'dot' ),
			'owner_scope' => $scope,
			'owner_id' => absint( $owner_id ),
			'system' => 'system' === $scope,
			'visible' => true,
			'sort_order' => absint( $raw['sort_order'] ?? 100 ),
			'source' => sanitize_key( $raw['source'] ?? '' ),
			'event_type' => sanitize_key( $raw['event_type'] ?? '' ),
			'session' => strtoupper( substr( sanitize_text_field( $raw['session'] ?? '' ), 0, 1 ) ),
			'admin_only' => ! empty( $raw['admin_only'] ),
		);
	}

	/**
	 * Idempotently reconcile the approved NRMP 2026 applicant dataset once.
	 *
	 * @return void
	 */
	private static function maybe_seed_nrmp_dataset() {
		if ( self::NRMP_DATASET_VERSION === get_option( self::NRMP_DATASET_OPTION ) ) {
			return;
		}

		global $wpdb;
		$source_url = 'https://www.nrmp.org/wp-content/uploads/2025/03/2026-Main-Residency-Match-Detailed-Calendar.pdf';
		$events = array(
			array( 'registration-opens', 'NRMP Registration Opens', 'Applicant and Medical School Registration opens.', '2025-09-15 12:00:00', '2025-09-15 13:00:00' ),
			array( 'standard-registration-deadline', 'NRMP Standard Registration Deadline', 'Applicant Standard Registration Deadline.', '2026-01-30 23:59:00', '2026-01-30 23:59:59' ),
			array( 'ranking-opens', 'NRMP Ranking Opens', 'Ranking opens for applicants and programs.', '2026-02-02 12:00:00', '2026-02-02 13:00:00' ),
			array( 'rol-certification-deadline', 'NRMP Rank Order List Certification Deadline', 'Applicant late registration, Match withdrawal, and IMG ECFMG verification deadlines.', '2026-03-04 21:00:00', '2026-03-04 21:00:59' ),
			array( 'match-status-soap-begins', 'NRMP Applicant Match Status Available / SOAP Begins', 'Applicant match status and program fill status become available; SOAP begins.', '2026-03-16 10:00:00', '2026-03-16 11:00:00' ),
			array( 'soap-prepare-applications', 'SOAP Applicants Can Begin Preparing Applications', 'Applicants can begin preparing applications in the program-required application service.', '2026-03-16 11:00:00', '2026-03-16 12:00:00' ),
			array( 'soap-program-review', 'SOAP Programs Begin Reviewing Applications', 'Programs may begin reviewing SOAP applications.', '2026-03-17 08:00:00', '2026-03-17 09:00:00' ),
			array( 'soap-offer-rounds', 'SOAP Offer Rounds', 'Four SOAP rounds occur during this window; SOAP ends at 9:00 PM ET.', '2026-03-19 09:00:00', '2026-03-19 21:00:00' ),
			array( 'match-day', 'NRMP Match Day', 'Applicant Match results available.', '2026-03-20 12:00:00', '2026-03-20 13:00:00' ),
		);

		foreach ( $events as $event ) {
			$source_id = 'nrmp-2026-' . $event[0];
			$meta = wp_json_encode( array( 'dataset' => 'nrmp-main-residency-applicant', 'cycle' => '2026', 'dataset_version' => self::NRMP_DATASET_VERSION, 'official_source' => $source_url, 'authoritative' => true ) );
			$existing = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . self::table_name() . ' WHERE source = %s AND source_id = %s LIMIT 1', 'system', $source_id ) );
			$data = array( 'user_id' => 0, 'event_type' => 'nrmp_date', 'title' => $event[1], 'description' => $event[2], 'start_at' => $event[3], 'end_at' => $event[4], 'all_day' => 0, 'source' => 'system', 'source_id' => $source_id, 'category' => 'nrmp', 'priority' => 1, 'status' => 'active', 'meta_json' => $meta, 'updated_at' => current_time( 'mysql' ) );
			if ( $existing ) {
				$wpdb->update( self::table_name(), $data, array( 'id' => absint( $existing ) ), self::format_map( $data ), array( '%d' ) );
			} else {
				$data['created_at'] = current_time( 'mysql' );
				$wpdb->insert( self::table_name(), $data, self::format_map( $data ) );
			}
		}

		update_option( self::NRMP_DATASET_OPTION, self::NRMP_DATASET_VERSION, false );
	}

	/**
	 * Keep a bounded admin preimage/postimage ledger for Calendar-owned metadata.
	 *
	 * @param string $action Action label.
	 * @param string $resource Resource ID.
	 * @param array  $before Preimage.
	 * @param array  $after Postimage.
	 * @return void
	 */
	private static function audit_admin_change( $action, $resource, $before, $after ) {
		$rows = get_option( self::ADMIN_AUDIT_OPTION, array() );
		$rows = is_array( $rows ) ? $rows : array();
		$rows[] = array( 'at' => current_time( 'mysql', true ), 'actor_id' => get_current_user_id(), 'action' => sanitize_key( $action ), 'resource' => sanitize_key( $resource ), 'before' => $before, 'after' => $after );
		update_option( self::ADMIN_AUDIT_OPTION, array_slice( $rows, -100 ), false );
	}

	/**
	 * Bulk create events (admin use).
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function bulk_create_events( $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'mmed_forbidden', 'Admin access required.', array( 'status' => 403 ) );
		}

		$items   = $request->get_param( 'events' );
		$created = array();

		if ( ! is_array( $items ) ) {
			return new WP_Error( 'mmed_invalid_payload', 'Events array required.', array( 'status' => 400 ) );
		}

		foreach ( $items as $item ) {
			$sub_request = new WP_REST_Request( 'POST', '/mmed/v1/events' );
			$sub_request->set_body_params( is_array( $item ) ? $item : array() );
			$result = self::create_event( $sub_request );

			if ( ! is_wp_error( $result ) ) {
				$data      = $result->get_data();
				$created[] = $data;
			}
		}

		return new WP_REST_Response( array( 'created' => count( $created ), 'events' => $created ), 201 );
	}
}
