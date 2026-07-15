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
		$writer_gate = self::v1_legacy_writer_gate();
		if ( is_wp_error( $writer_gate ) ) {
			return $writer_gate;
		}

		$params  = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$payload = self::block_payload_to_event( $params );

		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		// Study blocks are always private to the authenticated learner. This also
		// prevents Calendar's admin-authored global-event default from leaking a
		// block to every learner when an administrator exercises the legacy view.
		$payload['audience'] = 'private';
		$request->set_body_params( $payload );
		$request->set_param( 'event_type', 'study_block' );

		$response = MMED_Calendar_Engine::create_event( self::request_from_payload( $payload ) );
		return self::format_mutation_response( $response );
	}

	/**
	 * Update a study block.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_block( $request ) {
		$writer_gate = self::v1_legacy_writer_gate();
		if ( is_wp_error( $writer_gate ) ) {
			return $writer_gate;
		}

		$event = self::get_owned_study_event( absint( $request['id'] ) );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		$params  = is_array( $request->get_json_params() ) ? $request->get_json_params() : array();
		$payload = self::block_payload_to_event( $params, true );

		if ( is_wp_error( $payload ) ) {
			return $payload;
		}

		if ( isset( $payload['meta'] ) ) {
			$payload['meta'] = array_merge( self::event_meta( $event ), $payload['meta'] );
		}

		$event_request = self::request_from_payload( $payload );
		$event_request->set_param( 'id', absint( $request['id'] ) );
		self::scope_legacy_mutation( $event_request, $event, isset( $payload['meta'] ) );

		$response = MMED_Calendar_Engine::update_event( $event_request );
		return self::format_mutation_response( $response );
	}

	/**
	 * Delete a study block.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_block( $request ) {
		$writer_gate = self::v1_legacy_writer_gate();
		if ( is_wp_error( $writer_gate ) ) {
			return $writer_gate;
		}

		$event = self::get_owned_study_event( absint( $request['id'] ) );
		if ( is_wp_error( $event ) ) {
			return $event;
		}

		self::scope_legacy_mutation( $request, $event );
		return MMED_Calendar_Engine::delete_event( $request );
	}

	/**
	 * Apply the V1 cutover law before any Calendar lookup or mutation. Legacy-only
	 * fixtures and installations without the 8010C boundary retain 8010B behavior.
	 *
	 * @return true|WP_Error
	 */
	protected static function v1_legacy_writer_gate() {
		if ( ! class_exists( 'MMED_V1_Study_Access' ) ) {
			return true;
		}

		$decision = MMED_V1_Study_Access::legacy_writer_decision( get_current_user_id() );
		if ( ! empty( $decision['allowed'] ) ) {
			return true;
		}

		$status = isset( $decision['status'] ) ? (int) $decision['status'] : 503;
		$code   = 503 === $status ? 'mmed_study_dependency_unavailable' : 'mmed_study_write_disabled';
		return new WP_Error(
			$code,
			503 === $status ? 'Study write service is unavailable.' : 'Study writes are disabled.',
			array( 'status' => $status )
		);
	}

	/**
	 * Add internal constraints consumed by the shared Calendar mutation seam.
	 *
	 * These parameters can only narrow a generic Calendar mutation. The Study
	 * adapter overwrites any client values after it verifies the current row.
	 *
	 * @param WP_REST_Request $request      Internal Calendar request.
	 * @param object          $event        Preflighted Study event snapshot.
	 * @param bool            $protect_meta Whether the update replaces metadata.
	 * @return void
	 */
	protected static function scope_legacy_mutation( $request, $event, $protect_meta = false ) {
		$request->set_param( '_mmed_strict_owner', true );
		$request->set_param( '_mmed_required_event_type', 'study_block' );
		$request->set_param( '_mmed_expected_status', (string) ( $event->status ?? '' ) );

		if ( $protect_meta ) {
			$request->set_param( '_mmed_expect_meta_snapshot', true );
			$request->set_param( '_mmed_expected_meta_json', $event->meta_json ?? null );
		}
	}

	/**
	 * Fetch a Study event owned by the current user without the Calendar admin bypass.
	 *
	 * Legacy Study endpoints must not become a generic numeric-ID mutation path for
	 * Calendar events. A foreign owner and a foreign event type intentionally share
	 * the same non-enumerating response.
	 *
	 * @param int $event_id Event ID.
	 * @return object|WP_Error
	 */
	protected static function get_owned_study_event( $event_id ) {
		$user_id = get_current_user_id();
		$event   = $event_id > 0 && $user_id > 0
			? MMED_Calendar_Engine::get_owned_event( $event_id, $user_id )
			: null;

		$status = (string) ( $event->status ?? '' );
		if (
			! $event
			|| 'study_block' !== (string) ( $event->event_type ?? '' )
			|| ! in_array( $status, array( 'active', 'completed' ), true )
		) {
			return new WP_Error(
				'mmed_study_block_not_found',
				'Study block not found.',
				array( 'status' => 404 )
			);
		}

		return $event;
	}

	/**
	 * Decode existing Calendar metadata for a metadata-preserving partial update.
	 *
	 * @param object $event Calendar event row.
	 * @return array
	 */
	protected static function event_meta( $event ) {
		if ( empty( $event->meta_json ) ) {
			return array();
		}

		$meta = json_decode( (string) $event->meta_json, true );
		return is_array( $meta ) ? $meta : array();
	}

	/**
	 * Format a study block row for REST.
	 *
	 * @param object $row Event row.
	 * @return array
	 */
	public static function format_block( $row ) {
		$event = MMED_Calendar_Engine::format_event( $row );
		return self::format_event_block( $event );
	}

	/**
	 * Replace a generic Calendar mutation response with the legacy Study allowlist.
	 *
	 * @param WP_REST_Response|WP_Error $response Calendar mutation response.
	 * @return WP_REST_Response|WP_Error
	 */
	protected static function format_mutation_response( $response ) {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( ! is_object( $response ) || ! method_exists( $response, 'get_data' ) || ! method_exists( $response, 'set_data' ) ) {
			return new WP_Error( 'mmed_study_response_invalid', 'Study block response is unavailable.', array( 'status' => 500 ) );
		}

		$event = $response->get_data();
		if ( ! is_array( $event ) || empty( $event['id'] ) ) {
			return new WP_Error( 'mmed_study_response_invalid', 'Study block response is unavailable.', array( 'status' => 500 ) );
		}

		$response->set_data( self::format_event_block( $event ) );
		return $response;
	}

	/**
	 * Format a Calendar event array as the exact legacy Study response allowlist.
	 *
	 * Calendar ownership, meeting, recurrence, source, timestamps, priority, and
	 * unrestricted metadata are intentionally not exposed through Study routes.
	 *
	 * @param array $event Formatted Calendar event.
	 * @return array
	 */
	protected static function format_event_block( $event ) {
		$meta  = ! empty( $event['meta'] ) && is_array( $event['meta'] ) ? $event['meta'] : array();

		return array(
			'id'        => absint( $event['id'] ?? 0 ),
			'title'     => (string) ( $event['title'] ?? '' ),
			'subject'   => (string) ( $meta['subject'] ?? ( $event['category'] ?? '' ) ),
			'notes'     => (string) ( $event['description'] ?? '' ),
			'start_at'  => (string) ( $event['start_at'] ?? '' ),
			'end_at'    => isset( $event['end_at'] ) ? (string) $event['end_at'] : null,
			'duration'  => self::duration_minutes( $event['start_at'] ?? '', $event['end_at'] ?? '' ),
			'status'    => (string) ( $event['status'] ?? '' ),
			'completed' => 'completed' === ( $event['status'] ?? '' ) || ! empty( $meta['completed'] ),
			'category'  => (string) ( $event['category'] ?? '' ),
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
		// This is an internal request, not an HTTP JSON body. Marking it as JSON
		// makes real WP_REST_Request::set_param() place the later owner/type
		// constraints in a separate JSON bag; Calendar would then ignore these
		// body params and report a false no-op success.
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
