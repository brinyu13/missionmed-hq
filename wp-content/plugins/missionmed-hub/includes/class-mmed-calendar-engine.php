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
	 * Fence Calendar-owned Study mutations through the V1 cutover decision.
	 *
	 * This closes generic Calendar and bulk route bypasses in 8010C. The gate is
	 * deliberately a compatibility fence only; 8010D must place Calendar DML and
	 * the first V1 watermark under one per-owner arbitration mechanism before a V1
	 * writer can be activated.
	 *
	 * @param string $event_type Calendar event type.
	 * @param int    $owner_id Event owner.
	 * @return true|WP_Error
	 */
	private static function v1_study_writer_gate( $event_type, $owner_id ) {
		if ( 'study_block' !== (string) $event_type ) {
			return true;
		}
		if ( ! class_exists( 'MMED_V1_Study_Access' ) ) {
			return new WP_Error(
				'mmed_study_dependency_unavailable',
				'Study write service is unavailable.',
				array( 'status' => 503 )
			);
		}

		$decision = MMED_V1_Study_Access::legacy_writer_decision( (int) $owner_id );
		if ( ! empty( $decision['allowed'] ) ) {
			return true;
		}

		$status = isset( $decision['status'] ) ? (int) $decision['status'] : 503;
		return new WP_Error(
			503 === $status ? 'mmed_study_dependency_unavailable' : 'mmed_study_write_disabled',
			503 === $status ? 'Study write service is unavailable.' : 'Study writes are disabled.',
			array( 'status' => $status )
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

		$raw     = self::request_payload( $request );
		$payload = self::sanitize_event_payload( $raw, false );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$payload['user_id']    = self::resolve_event_user_id( $raw, get_current_user_id(), $payload['source'] ?? '' );
		$payload['created_at'] = current_time( 'mysql' );
		$payload['updated_at'] = current_time( 'mysql' );

		$writer_gate = self::v1_study_writer_gate( $payload['event_type'] ?? '', (int) $payload['user_id'] );
		if ( is_wp_error( $writer_gate ) ) {
			return $writer_gate;
		}

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

		$event_id        = absint( $request['id'] );
		$user_id         = get_current_user_id();
		$strict_owner    = self::is_strict_owner_request( $request );
		$required_type   = self::required_event_type( $request );
		$strict_scope    = $strict_owner && '' !== $required_type;
		$expected_status = $strict_scope ? self::expected_event_status( $request ) : '';
		$expect_meta     = $strict_scope ? self::expects_event_meta_snapshot( $request ) : false;
		$expected_meta   = $expect_meta ? $request->get_param( '_mmed_expected_meta_json' ) : null;
		$event           = self::get_owned_event( $event_id, $user_id );

		if ( ! $event && ! $strict_owner && current_user_can( 'manage_options' ) ) {
			$event = self::get_admin_editable_event( $event_id );
		}

		if ( ! $event || ( $required_type && $required_type !== (string) $event->event_type ) ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}
		if ( $expect_meta && null !== $expected_meta && ! is_string( $expected_meta ) ) {
			return self::mutation_conflict();
		}

		if ( ! self::event_matches_expected_state( $event, $expected_status, $expect_meta, $expected_meta ) ) {
			return self::mutation_conflict();
		}

		$raw     = self::request_payload( $request );
		$payload = self::sanitize_event_payload( $raw, true );
		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$event_source   = isset( $payload['source'] ) ? $payload['source'] : (string) $event->source;
		$target_user_id = $strict_owner
			? (int) $event->user_id
			: self::resolve_event_user_id( $raw, (int) $event->user_id, $event_source );
		if ( current_user_can( 'manage_options' ) && (int) $event->user_id !== $target_user_id ) {
			$payload['user_id'] = $target_user_id;
		}

		$target_type = isset( $payload['event_type'] ) ? (string) $payload['event_type'] : (string) $event->event_type;
		if ( 'study_block' === (string) $event->event_type ) {
			$writer_gate = self::v1_study_writer_gate( 'study_block', (int) $event->user_id );
			if ( is_wp_error( $writer_gate ) ) {
				return $writer_gate;
			}
		}
		if (
			'study_block' === $target_type
			&& ( 'study_block' !== (string) $event->event_type || (int) $event->user_id !== $target_user_id )
		) {
			$writer_gate = self::v1_study_writer_gate( 'study_block', $target_user_id );
			if ( is_wp_error( $writer_gate ) ) {
				return $writer_gate;
			}
		}

		if ( empty( $payload ) ) {
			return new WP_REST_Response( self::format_event( $event ), 200 );
		}

		$payload['updated_at'] = current_time( 'mysql' );

		$where = array(
			'id'      => $event_id,
			'user_id' => (int) $event->user_id,
		);
		$where_formats = array( '%d', '%d' );

		if ( $required_type ) {
			$where['event_type'] = $required_type;
			$where_formats[]      = '%s';
		}

		if ( $expected_status ) {
			$where['status'] = $expected_status;
			$where_formats[] = '%s';
		}

		if ( $expect_meta ) {
			$where['meta_json'] = $expected_meta;
			$where_formats[]    = '%s';
		}

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			$where,
			self::format_map( $payload ),
			$where_formats
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_event_update_failed', 'Event could not be updated.', array( 'status' => 500 ) );
		}

		$current = self::get_owned_event( $event_id, $target_user_id );
		if ( $strict_scope && ( ! $current || $required_type !== (string) $current->event_type ) ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}
		if ( $strict_scope && ! in_array( (string) $current->status, array( 'active', 'completed' ), true ) ) {
			return self::mutation_conflict();
		}

		if ( $strict_scope && 0 === (int) $updated ) {
			if (
				! self::event_matches_expected_state( $current, $expected_status, $expect_meta, $expected_meta )
				|| ! self::event_matches_payload( $current, $payload )
			) {
				return self::mutation_conflict();
			}
		}

		return new WP_REST_Response( self::format_event( $current ), 200 );
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

		$event_id        = absint( $request['id'] );
		$user_id         = get_current_user_id();
		$strict_owner    = self::is_strict_owner_request( $request );
		$required_type   = self::required_event_type( $request );
		$strict_scope    = $strict_owner && '' !== $required_type;
		$expected_status = $strict_scope ? self::expected_event_status( $request ) : '';

		$event = self::get_owned_event( $event_id, $user_id );
		if ( ! $event && ! $strict_owner && current_user_can( 'manage_options' ) ) {
			$event = self::get_admin_editable_event( $event_id );
		}

		if ( ! $event || ( $required_type && $required_type !== (string) $event->event_type ) ) {
			return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
		}

		if ( ! self::event_matches_expected_state( $event, $expected_status, false, null ) ) {
			return self::mutation_conflict();
		}

		$writer_gate = self::v1_study_writer_gate( (string) $event->event_type, (int) $event->user_id );
		if ( is_wp_error( $writer_gate ) ) {
			return $writer_gate;
		}

		$where = array(
			'id'      => $event_id,
			'user_id' => (int) $event->user_id,
		);
		$where_formats = array( '%d', '%d' );

		if ( $required_type ) {
			$where['event_type'] = $required_type;
			$where_formats[]      = '%s';
		}

		if ( $expected_status ) {
			$where['status'] = $expected_status;
			$where_formats[] = '%s';
		}

		$deleted = $wpdb->update(
			self::table_name(),
			array(
				'status'     => 'cancelled',
				'updated_at' => current_time( 'mysql' ),
			),
			$where,
			array( '%s', '%s' ),
			$where_formats
		);

		if ( false === $deleted && $strict_owner ) {
			return new WP_Error( 'mmed_event_delete_failed', 'Event could not be deleted.', array( 'status' => 500 ) );
		}

		if ( $strict_scope && 0 === (int) $deleted ) {
			$current = self::get_owned_event( $event_id, $user_id );
			if ( ! $current || $required_type !== (string) $current->event_type ) {
				return new WP_Error( 'mmed_event_not_found', 'Event not found.', array( 'status' => 404 ) );
			}

			return self::mutation_conflict();
		}

		return new WP_REST_Response( array( 'deleted' => true, 'id' => $event_id ), 200 );
	}

	/**
	 * Determine whether an internal caller requires owner-only mutation semantics.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return bool
	 */
	protected static function is_strict_owner_request( $request ) {
		return $request instanceof WP_REST_Request
			&& self::is_truthy_request_value( $request->get_param( '_mmed_strict_owner' ) );
	}

	/**
	 * Read an optional event-type constraint that can only narrow a mutation.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return string
	 */
	protected static function required_event_type( $request ) {
		if ( ! $request instanceof WP_REST_Request ) {
			return '';
		}

		$type = sanitize_key( $request->get_param( '_mmed_required_event_type' ) );
		return in_array( $type, self::event_types(), true ) ? $type : '';
	}

	/**
	 * Read the Study adapter's preflight status snapshot.
	 *
	 * The value is used only with strict owner and type constraints, and can only
	 * narrow the SQL mutation predicate.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return string
	 */
	protected static function expected_event_status( $request ) {
		if ( ! $request instanceof WP_REST_Request ) {
			return '';
		}

		$status = sanitize_key( $request->get_param( '_mmed_expected_status' ) );
		return in_array( $status, self::statuses(), true ) ? $status : '';
	}

	/**
	 * Determine whether a strict metadata replacement carries its source snapshot.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return bool
	 */
	protected static function expects_event_meta_snapshot( $request ) {
		return $request instanceof WP_REST_Request
			&& self::is_truthy_request_value( $request->get_param( '_mmed_expect_meta_snapshot' ) );
	}

	/**
	 * Compare a current row to the Study adapter's preflight state.
	 *
	 * @param object|null $event           Current event row.
	 * @param string      $expected_status Expected status, or empty.
	 * @param bool        $expect_meta     Whether metadata is constrained.
	 * @param mixed       $expected_meta   Expected nullable metadata JSON.
	 * @return bool
	 */
	protected static function event_matches_expected_state( $event, $expected_status, $expect_meta, $expected_meta ) {
		if ( ! $event ) {
			return false;
		}

		if ( $expected_status && $expected_status !== (string) ( $event->status ?? '' ) ) {
			return false;
		}

		if ( $expect_meta && ! self::database_values_match( $expected_meta, $event->meta_json ?? null ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Confirm that a zero-row strict update was a genuine database no-op.
	 *
	 * @param object $event   Current event row.
	 * @param array  $payload Sanitized update payload.
	 * @return bool
	 */
	protected static function event_matches_payload( $event, $payload ) {
		foreach ( $payload as $key => $value ) {
			$current = $event->{$key} ?? null;
			if ( 'meta_json' === $key ) {
				$current_json = null === $current ? null : json_decode( (string) $current, true );
				$value_json   = null === $value ? null : json_decode( (string) $value, true );
				if ( $current_json !== $value_json ) {
					return false;
				}
				continue;
			}

			if ( ! self::database_values_match( $current, $value ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Compare nullable database scalar values without type noise from wpdb.
	 *
	 * @param mixed $left  First value.
	 * @param mixed $right Second value.
	 * @return bool
	 */
	protected static function database_values_match( $left, $right ) {
		if ( null === $left || null === $right ) {
			return null === $left && null === $right;
		}

		return (string) $left === (string) $right;
	}

	/**
	 * Return the common non-enumerating strict mutation conflict.
	 *
	 * @return WP_Error
	 */
	protected static function mutation_conflict() {
		return new WP_Error(
			'mmed_event_conflict',
			'Event changed before the update could be applied. Reload and try again.',
			array( 'status' => 409 )
		);
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
			// An explicit private audience must win over Calendar's historical
			// admin-authored global default. Existing callers without this marker
			// retain their current behavior.
			if ( 'private' === $audience ) {
				return absint( $default_user_id );
			}

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
		return array( 'manual', 'ssa', 'scheduler', 'learndash', 'system', 'advisor', 'enrollment', 'admin' );
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
		return array(
			'drill_step1'    => array( 'label' => "Dr. J Drills (Step/Level 1)", 'color' => '#3bb7ff', 'icon' => 'microscope' ),
			'drill_step23'   => array( 'label' => "Dr. J Drills (Step/Level 2/3)", 'color' => '#78d4ff', 'icon' => 'stethoscope' ),
			'mr_session'     => array( 'label' => 'Mission Residency Sessions', 'color' => '#ffcc4d', 'icon' => 'target' ),
			'mock_interview' => array( 'label' => 'Mock Interviews', 'color' => '#ff8a3d', 'icon' => 'microphone' ),
			'nrmp_date'      => array( 'label' => 'NRMP / Application Dates', 'color' => '#ff5c7a', 'icon' => 'clipboard' ),
			'rotation'       => array( 'label' => 'Rotations / Clinicals', 'color' => '#3dff9a', 'icon' => 'hospital' ),
			'arena_event'    => array( 'label' => 'Arena Events', 'color' => '#9cffc7', 'icon' => 'lightning' ),
			'appointment'    => array( 'label' => 'Appointments', 'color' => '#f7f2e5', 'icon' => 'calendar' ),
			'study_block'    => array( 'label' => 'Study Blocks', 'color' => '#a78bfa', 'icon' => 'book' ),
			'exam'           => array( 'label' => 'Exams', 'color' => '#f472b6', 'icon' => 'exam' ),
			'deadline'       => array( 'label' => 'Deadlines', 'color' => '#ef4444', 'icon' => 'deadline' ),
			'milestone'      => array( 'label' => 'Milestones', 'color' => '#22c55e', 'icon' => 'milestone' ),
			'general'        => array( 'label' => 'General', 'color' => '#94a3b8', 'icon' => 'dot' ),
			'custom'         => array( 'label' => 'Custom', 'color' => '#e2e8f0', 'icon' => 'custom' ),
		);
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
