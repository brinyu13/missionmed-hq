<?php
/**
 * MissionMed Matrix study schedule engine.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Study schedule REST layer backed by the calendar events table.
 */
class MMED_Study_Schedule {

	/**
	 * Initialize schedule dependencies.
	 *
	 * @return void
	 */
	public static function init() {
		if ( class_exists( 'MMED_Calendar_Engine' ) ) {
			MMED_Calendar_Engine::maybe_install();
		}
	}

	/**
	 * Get study blocks for a day or date range.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_blocks( $request ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return new WP_Error( 'mmed_calendar_missing', 'Calendar engine is unavailable.', array( 'status' => 500 ) );
		}

		MMED_Calendar_Engine::maybe_install();

		$user_id = get_current_user_id();
		$date    = sanitize_text_field( $request->get_param( 'date' ) );
		$start   = sanitize_text_field( $request->get_param( 'start' ) );
		$end     = sanitize_text_field( $request->get_param( 'end' ) );

		if ( $date ) {
			$start = $date . ' 00:00:00';
			$end   = $date . ' 23:59:59';
		} else {
			$start = self::mysql_datetime( $start ) ?: current_time( 'Y-m-d' ) . ' 00:00:00';
			$end   = self::mysql_datetime( $end ) ?: current_time( 'Y-m-d' ) . ' 23:59:59';
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . MMED_Calendar_Engine::table_name() . " WHERE user_id = %d AND event_type = 'study_block' AND status <> 'cancelled' AND start_at <= %s AND (end_at IS NULL OR end_at >= %s) ORDER BY start_at ASC, id ASC",
				$user_id,
				$end,
				$start
			)
		);

		return new WP_REST_Response(
			array(
				'blocks' => array_map( array( __CLASS__, 'format_block' ), is_array( $rows ) ? $rows : array() ),
			),
			200
		);
	}

	/**
	 * Create a study block.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_block( $request ) {
		$params  = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$payload = self::block_payload_to_event( $params );

		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$request->set_body_params( $payload );
		$request->set_param( 'event_type', 'study_block' );

		return MMED_Calendar_Engine::create_event( self::request_from_payload( $payload ) );
	}

	/**
	 * Update a study block.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_block( $request ) {
		$params  = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$payload = self::block_payload_to_event( $params, true );

		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		$event_request = self::request_from_payload( $payload );
		$event_request->set_param( 'id', absint( $request['id'] ) );

		return MMED_Calendar_Engine::update_event( $event_request );
	}

	/**
	 * Delete a study block.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_block( $request ) {
		return MMED_Calendar_Engine::delete_event( $request );
	}

	/**
	 * Format a study block row for REST.
	 *
	 * @param object $row Event row.
	 * @return array
	 */
	public static function format_block( $row ) {
		$event = MMED_Calendar_Engine::format_event( $row );
		$meta  = ! empty( $event['meta'] ) && is_array( $event['meta'] ) ? $event['meta'] : array();

		return array(
			'id'          => $event['id'],
			'title'       => $event['title'],
			'subject'     => $meta['subject'] ?? $event['category'],
			'notes'       => $event['description'],
			'start_at'    => $event['start_at'],
			'end_at'      => $event['end_at'],
			'duration'    => self::duration_minutes( $event['start_at'], $event['end_at'] ),
			'status'      => $event['status'],
			'completed'   => 'completed' === $event['status'] || ! empty( $meta['completed'] ),
			'category'    => $event['category'],
			'event'       => $event,
		);
	}

	/**
	 * Convert schedule payload to event payload.
	 *
	 * @param array $params  Request params.
	 * @param bool  $partial Whether partial updates are allowed.
	 * @return array|WP_Error
	 */
	protected static function block_payload_to_event( $params, $partial = false ) {
		$payload = array(
			'event_type' => 'study_block',
		);
		$meta    = array();

		if ( ! $partial ) {
			$subject             = sanitize_text_field( $params['subject'] ?? 'Study' );
			$payload['source']   = 'manual';
			$payload['category'] = sanitize_key( $subject ?: 'study' );
			$meta['subject']     = $subject ?: 'Study';
			$meta['completed']   = ! empty( $params['completed'] );
		} elseif ( array_key_exists( 'subject', $params ) ) {
			$subject             = sanitize_text_field( $params['subject'] );
			$payload['category'] = sanitize_key( $subject ?: 'study' );
			$meta['subject']     = $subject ?: 'Study';
		}

		if ( array_key_exists( 'title', $params ) || ! $partial ) {
			$subject          = sanitize_text_field( $params['subject'] ?? 'Study' );
			$payload['title'] = sanitize_text_field( $params['title'] ?? $subject . ' Study Block' );
		}

		if ( array_key_exists( 'notes', $params ) ) {
			$payload['description'] = wp_kses_post( $params['notes'] );
		}

		if ( array_key_exists( 'start_at', $params ) ) {
			$payload['start_at'] = sanitize_text_field( $params['start_at'] );
		}

		$duration = isset( $params['duration'] ) ? max( 30, min( 480, absint( $params['duration'] ) ) ) : 60;
		if ( array_key_exists( 'end_at', $params ) ) {
			$payload['end_at'] = sanitize_text_field( $params['end_at'] );
		} elseif ( ! empty( $payload['start_at'] ) ) {
			$payload['end_at'] = gmdate( 'Y-m-d\TH:i:s', strtotime( $payload['start_at'] . ' +' . $duration . ' minutes' ) );
		}

		if ( array_key_exists( 'completed', $params ) ) {
			$payload['status'] = ! empty( $params['completed'] ) ? 'completed' : 'active';
			$meta['completed'] = ! empty( $params['completed'] );
		}

		if ( ! empty( $meta ) ) {
			$payload['meta'] = $meta;
		}

		if ( ! $partial && empty( $payload['start_at'] ) ) {
			return new WP_Error( 'mmed_study_start_required', 'A start time is required.', array( 'status' => 400 ) );
		}

		return $payload;
	}

	/**
	 * Build a REST request object for the calendar engine from sanitized payload.
	 *
	 * @param array $payload Payload.
	 * @return WP_REST_Request
	 */
	protected static function request_from_payload( $payload ) {
		$request = new WP_REST_Request();
		$request->set_body_params( $payload );
		$request->set_header( 'content-type', 'application/json' );
		return $request;
	}

	/**
	 * Convert date string to MySQL datetime.
	 *
	 * @param string $value Raw value.
	 * @return string
	 */
	protected static function mysql_datetime( $value ) {
		$timestamp = strtotime( sanitize_text_field( $value ) );
		return $timestamp ? date_i18n( 'Y-m-d H:i:s', $timestamp ) : '';
	}

	/**
	 * Calculate duration in minutes.
	 *
	 * @param string $start Start timestamp.
	 * @param string $end   End timestamp.
	 * @return int
	 */
	protected static function duration_minutes( $start, $end ) {
		$start_ts = strtotime( $start );
		$end_ts   = strtotime( $end );

		if ( ! $start_ts || ! $end_ts || $end_ts <= $start_ts ) {
			return 60;
		}

		return (int) round( ( $end_ts - $start_ts ) / MINUTE_IN_SECONDS );
	}
}
