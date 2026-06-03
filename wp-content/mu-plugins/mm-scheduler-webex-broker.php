<?php
/**
 * Plugin Name: MissionMed Scheduler Webex Broker
 * Description: Server-side Scheduler bridge to the MissionMed Hub Webex REST client.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MM_SCHED_WEBEX_BROKER_NAMESPACE' ) ) {
	define( 'MM_SCHED_WEBEX_BROKER_NAMESPACE', 'missionmed-scheduler/v1' );
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			MM_SCHED_WEBEX_BROKER_NAMESPACE,
			'/webex/meeting',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'mm_scheduler_webex_broker_create_meeting',
				'permission_callback' => 'mm_scheduler_webex_broker_can_access',
			)
		);
	}
);

/**
 * Validate Scheduler server-to-server HMAC.
 *
 * @param WP_REST_Request $request Request object.
 * @return true|WP_Error
 */
function mm_scheduler_webex_broker_can_access( $request ) {
	$secret = mm_scheduler_webex_broker_secret();
	if ( '' === $secret ) {
		return new WP_Error(
			'scheduler_webex_broker_not_configured',
			'Scheduler Webex broker authentication is not configured.',
			array( 'status' => 503 )
		);
	}

	$timestamp = (int) $request->get_header( 'x-mm-scheduler-timestamp' );
	if ( $timestamp <= 0 || abs( time() - $timestamp ) > 300 ) {
		return new WP_Error(
			'scheduler_webex_broker_stale_signature',
			'Scheduler Webex broker signature is stale or missing.',
			array( 'status' => 401 )
		);
	}

	$signature = trim( (string) $request->get_header( 'x-mm-scheduler-signature' ) );
	if ( 0 === strpos( $signature, 'sha256=' ) ) {
		$signature = substr( $signature, 7 );
	}

	$body     = (string) $request->get_body();
	$expected = hash_hmac( 'sha256', $timestamp . '.' . $body, $secret );
	if ( '' === $signature || ! hash_equals( $expected, $signature ) ) {
		return new WP_Error(
			'scheduler_webex_broker_bad_signature',
			'Scheduler Webex broker signature is invalid.',
			array( 'status' => 401 )
		);
	}

	return true;
}

/**
 * Create a Webex meeting with the existing Hub Webex client.
 *
 * @param WP_REST_Request $request Request object.
 * @return WP_REST_Response|WP_Error
 */
function mm_scheduler_webex_broker_create_meeting( $request ) {
	if ( ! class_exists( 'MMED_Webex_Client' ) ) {
		return new WP_Error(
			'scheduler_webex_client_missing',
			'MissionMed Webex client is not available.',
			array( 'status' => 503 )
		);
	}

	$params  = $request->get_json_params();
	$params  = is_array( $params ) ? $params : array();
	$meeting = isset( $params['meeting'] ) && is_array( $params['meeting'] ) ? $params['meeting'] : $params;
	$invitee = isset( $params['invitee'] ) && is_array( $params['invitee'] ) ? $params['invitee'] : array();

	$title = sanitize_text_field( $meeting['title'] ?? '' );
	$start = sanitize_text_field( $meeting['start'] ?? '' );
	$end   = sanitize_text_field( $meeting['end'] ?? '' );

	if ( '' === $title || '' === $start || '' === $end ) {
		return new WP_Error(
			'scheduler_webex_payload_invalid',
			'Scheduler Webex broker requires title, start, and end.',
			array( 'status' => 400 )
		);
	}

	$result = MMED_Webex_Client::create_meeting(
		array(
			'title'    => $title,
			'start'    => $start,
			'end'      => $end,
			'timezone' => sanitize_text_field( $meeting['timezone'] ?? 'America/New_York' ),
		)
	);

	if ( is_wp_error( $result ) ) {
		return mm_scheduler_webex_broker_error( $result, 'scheduler_webex_create_failed' );
	}

	$meeting_id = sanitize_text_field( $result['id'] ?? $result['meetingId'] ?? '' );
	$join_url   = esc_url_raw(
		$result['webLink']
			?? $result['joinWebUrl']
			?? $result['meetingLink']
			?? ''
	);

	$invitee_result = mm_scheduler_webex_broker_invite_attendee( $meeting_id, $invitee );

	return rest_ensure_response(
		array(
			'ok'                => '' !== $join_url,
			'provider'          => 'webex',
			'id'                => $meeting_id,
			'external_event_id' => $meeting_id,
			'webLink'           => $join_url,
			'meeting_url'       => $join_url,
			'invitee'           => $invitee_result,
		)
	);
}

/**
 * Invite the booking student when present.
 *
 * @param string $meeting_id Webex meeting id.
 * @param array  $invitee    Invitee payload.
 * @return array
 */
function mm_scheduler_webex_broker_invite_attendee( $meeting_id, $invitee ) {
	$email = sanitize_email( $invitee['email'] ?? '' );
	if ( '' === $email ) {
		return array(
			'status'                => 'suppressed',
			'invitee_email_present' => false,
			'invitee_email_sent'    => false,
		);
	}

	if ( '' === $meeting_id ) {
		return array(
			'status'                => 'missing_meeting_id',
			'invitee_email_present' => true,
			'invitee_email_sent'    => false,
		);
	}

	$result = MMED_Webex_Client::invite_attendee(
		$meeting_id,
		$email,
		sanitize_text_field( $invitee['display_name'] ?? '' ),
		false
	);

	if ( is_wp_error( $result ) ) {
		return array(
			'status'                => 'failed',
			'invitee_email_present' => true,
			'invitee_email_sent'    => false,
			'error'                 => sanitize_key( $result->get_error_code() ),
		);
	}

	return array(
		'status'                => 'created',
		'id'                    => sanitize_text_field( $result['id'] ?? '' ),
		'invitee_email_present' => true,
		'invitee_email_sent'    => true,
	);
}

/**
 * Return the shared server-side HMAC secret.
 *
 * @return string
 */
function mm_scheduler_webex_broker_secret() {
	if ( function_exists( 'mmhq_handoff_secret' ) ) {
		return trim( (string) mmhq_handoff_secret() );
	}

	$env = trim( (string) getenv( 'MMHQ_HANDOFF_SECRET' ) );
	if ( '' !== $env ) {
		return $env;
	}

	if ( defined( 'MMHQ_HANDOFF_SECRET' ) ) {
		return trim( (string) MMHQ_HANDOFF_SECRET );
	}

	return '';
}

/**
 * Convert a Webex client error to a sanitized REST error.
 *
 * @param WP_Error $error         Source error.
 * @param string   $fallback_code Fallback code.
 * @return WP_Error
 */
function mm_scheduler_webex_broker_error( $error, $fallback_code ) {
	$data   = $error->get_error_data();
	$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 502;

	return new WP_Error(
		sanitize_key( $error->get_error_code() ?: $fallback_code ),
		sanitize_text_field( $error->get_error_message() ?: 'Webex broker request failed.' ),
		array( 'status' => $status )
	);
}
