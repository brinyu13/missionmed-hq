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
		$where   = array( 'user_id = %d', "status <> 'cancelled'" );
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
	 * Create an event for the current user.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_event( $request ) {
		global $wpdb;

		self::maybe_install();

		$payload = self::sanitize_event_payload( self::request_payload( $request ), false );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$payload['user_id']    = get_current_user_id();
		$payload['created_at'] = current_time( 'mysql' );
		$payload['updated_at'] = current_time( 'mysql' );

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_event_create_failed', 'Event could not be created.', array( 'status' => 500 ) );
		}

		$event = self::get_owned_event( (int) $wpdb->insert_id, get_current_user_id() );

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

		if ( ! $event ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		$payload = self::sanitize_event_payload( self::request_payload( $request ), true );
		if ( is_wp_error( $payload ) ) {
			return $payload;
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
				'user_id' => $user_id,
			),
			self::format_map( $payload ),
			array( '%d', '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_event_update_failed', 'Event could not be updated.', array( 'status' => 500 ) );
		}

		return new WP_REST_Response( self::format_event( self::get_owned_event( $event_id, $user_id ) ), 200 );
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

		if ( ! self::get_owned_event( $event_id, $user_id ) ) {
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
				'user_id' => $user_id,
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

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::table_name() . " WHERE user_id = %d AND status = 'active' AND start_at >= %s AND start_at <= %s",
				absint( $user_id ),
				$now,
				$end
			)
		);
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
			'id'          => (int) $row->id,
			'event_type'  => (string) $row->event_type,
			'title'       => (string) $row->title,
			'description' => (string) $row->description,
			'start_at'    => self::format_datetime( $row->start_at ),
			'end_at'      => $row->end_at ? self::format_datetime( $row->end_at ) : null,
			'all_day'     => (bool) $row->all_day,
			'location'    => (string) $row->location,
			'source'      => (string) $row->source,
			'source_id'   => (string) $row->source_id,
			'category'    => (string) $row->category,
			'priority'    => (int) $row->priority,
			'status'      => (string) $row->status,
			'meta'        => $meta,
			'created_at'  => self::format_datetime( $row->created_at ),
			'updated_at'  => self::format_datetime( $row->updated_at ),
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
		return array( 'appointment', 'deadline', 'study_block', 'milestone', 'exam', 'interview', 'general' );
	}

	/**
	 * Allowed sources.
	 *
	 * @return array
	 */
	protected static function sources() {
		return array( 'manual', 'ssa', 'learndash', 'system', 'advisor' );
	}

	/**
	 * Allowed statuses.
	 *
	 * @return array
	 */
	protected static function statuses() {
		return array( 'active', 'completed', 'cancelled' );
	}
}
