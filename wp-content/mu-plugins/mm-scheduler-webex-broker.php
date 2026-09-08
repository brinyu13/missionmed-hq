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

		register_rest_route(
			MM_SCHED_WEBEX_BROKER_NAMESPACE,
			'/webex/recordings',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'mm_scheduler_webex_broker_get_recordings',
				'permission_callback' => 'mm_scheduler_webex_broker_can_access',
			)
		);

		register_rest_route(
			'mmed/v1',
			'/admin/webex/auth-url',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'mm_scheduler_webex_admin_auth_url',
				'permission_callback' => 'mm_scheduler_webex_admin_can_manage',
			),
			true
		);

		register_rest_route(
			'mmed/v1',
			'/admin/webex/callback',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'mm_scheduler_webex_admin_oauth_callback',
				'permission_callback' => 'mm_scheduler_webex_admin_can_manage',
			),
			true
		);

		register_rest_route(
			'mmed/v1',
			'/admin/webex/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'mm_scheduler_webex_admin_status',
				'permission_callback' => 'mm_scheduler_webex_admin_can_manage',
			),
			true
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
 * Whether the current WordPress user may manage Webex settings.
 *
 * @return bool
 */
function mm_scheduler_webex_admin_can_manage() {
	return current_user_can( 'manage_options' );
}

/**
 * Return the Webex OAuth authorization URL through the documented OAuth endpoint.
 *
 * @return WP_REST_Response|WP_Error
 */
function mm_scheduler_webex_admin_auth_url() {
	$client_id = mm_scheduler_webex_broker_webex_option( 'mmed_webex_client_id' );
	if ( '' === $client_id ) {
		return new WP_Error( 'webex_client_id_missing', 'Webex client ID is not configured.', array( 'status' => 400 ) );
	}

	$url = add_query_arg(
		array(
			'response_type' => 'code',
			'client_id'     => $client_id,
			'redirect_uri'  => mm_scheduler_webex_admin_redirect_uri(),
			'scope'         => mm_scheduler_webex_broker_oauth_scopes(),
			'state'         => wp_create_nonce( 'mmed_webex_oauth' ),
		),
		mm_scheduler_webex_broker_oauth_base() . '/authorize'
	);

	return rest_ensure_response( array( 'auth_url' => $url ) );
}

/**
 * Return the Scheduler Webex OAuth scopes required for booking and recordings.
 *
 * @return string
 */
function mm_scheduler_webex_broker_oauth_scopes() {
	return 'meeting:schedules_write meeting:schedules_read meeting:participants_read meeting:participants_write meeting:recordings_read spark:people_read';
}

/**
 * Complete Webex OAuth using the documented OAuth endpoint.
 *
 * @param WP_REST_Request $request REST request.
 * @return void
 */
function mm_scheduler_webex_admin_oauth_callback( $request ) {
	$code  = sanitize_text_field( $request->get_param( 'code' ) );
	$state = sanitize_text_field( $request->get_param( 'state' ) );

	if ( ! wp_verify_nonce( $state, 'mmed_webex_oauth' ) ) {
		wp_die( 'Invalid Webex OAuth state parameter.' );
	}

	$client_id     = mm_scheduler_webex_broker_webex_option( 'mmed_webex_client_id' );
	$client_secret = mm_scheduler_webex_broker_webex_option( 'mmed_webex_client_secret' );
	if ( '' === $client_id || '' === $client_secret ) {
		wp_die( 'Webex OAuth credentials are not configured.' );
	}

	$response = wp_remote_post(
		mm_scheduler_webex_broker_oauth_base() . '/access_token',
		array(
			'body'    => array(
				'grant_type'    => 'authorization_code',
				'client_id'     => $client_id,
				'client_secret' => $client_secret,
				'code'          => $code,
				'redirect_uri'  => mm_scheduler_webex_admin_redirect_uri(),
			),
			'timeout' => 20,
		)
	);
	$body = mm_scheduler_webex_broker_decode_response( $response );
	if ( is_wp_error( $body ) || empty( $body['access_token'] ) ) {
		wp_die( 'Webex OAuth failed: no access token received.' );
	}

	mm_scheduler_webex_broker_update_webex_option( 'mmed_webex_access_token', $body['access_token'] );
	if ( ! empty( $body['refresh_token'] ) ) {
		mm_scheduler_webex_broker_update_webex_option( 'mmed_webex_refresh_token', $body['refresh_token'] );
	}
	update_option( 'mmed_webex_token_expiry', time() + (int) ( $body['expires_in'] ?? 0 ), false );

	$me = mm_scheduler_webex_broker_api_get( '/people/me', $body['access_token'] );
	if ( ! is_wp_error( $me ) && ! empty( $me['emails'][0] ) ) {
		update_option( 'mmed_webex_host_email', sanitize_email( $me['emails'][0] ), false );
	}

	wp_safe_redirect( admin_url( 'admin.php?page=mmed-sessions&webex=connected' ) );
	exit;
}

/**
 * Return a safe Webex connection status.
 *
 * @return WP_REST_Response
 */
function mm_scheduler_webex_admin_status() {
	$connection = mm_scheduler_webex_broker_connection_health();

	return rest_ensure_response(
		array(
			'status'     => $connection['connected'] ? 'connected' : 'disconnected',
			'host_email' => sanitize_email( $connection['host_email'] ),
		)
	);
}

/**
 * Return the registered Webex OAuth redirect URI.
 *
 * @return string
 */
function mm_scheduler_webex_admin_redirect_uri() {
	return set_url_scheme( rest_url( 'mmed/v1/admin/webex/callback' ), 'https' );
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

	$result = mm_scheduler_webex_broker_rest_create_meeting(
		array(
			'title'       => $title,
			'start'       => $start,
			'end'         => $end,
			'timezone'    => sanitize_text_field( $meeting['timezone'] ?? 'America/New_York' ),
			'auto_record' => mm_scheduler_webex_broker_truthy( $meeting['enabledAutoRecordMeeting'] ?? $meeting['auto_record'] ?? $meeting['autoRecord'] ?? false ),
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
 * Look up Webex recordings for a Scheduler-created meeting.
 *
 * @param WP_REST_Request $request Request object.
 * @return WP_REST_Response|WP_Error
 */
function mm_scheduler_webex_broker_get_recordings( $request ) {
	if ( ! class_exists( 'MMED_Webex_Client' ) ) {
		return new WP_Error(
			'scheduler_webex_client_missing',
			'MissionMed Webex client is not available.',
			array( 'status' => 503 )
		);
	}

	$params     = $request->get_json_params();
	$params     = is_array( $params ) ? $params : array();
	$meeting_id = sanitize_text_field( $params['meeting_id'] ?? $params['meetingId'] ?? $params['webex_meeting_id'] ?? '' );

	if ( '' === $meeting_id ) {
		return new WP_Error(
			'scheduler_webex_recording_meeting_missing',
			'Scheduler Webex recording lookup requires a meeting id.',
			array( 'status' => 400 )
		);
	}

	$recordings    = null;
	$lookup_error  = null;
	if ( method_exists( 'MMED_Webex_Client', 'get_recordings' ) ) {
		$recordings = MMED_Webex_Client::get_recordings( $meeting_id );
		if ( is_wp_error( $recordings ) ) {
			$lookup_error = $recordings;
			$recordings   = array();
		}
	}
	if ( null === $recordings ) {
		$token = mm_scheduler_webex_broker_access_token();
		if ( is_wp_error( $token ) ) {
			return mm_scheduler_webex_broker_error( $token, 'scheduler_webex_recording_lookup_failed' );
		}
		$body = mm_scheduler_webex_broker_api_get( '/recordings?meetingId=' . rawurlencode( $meeting_id ), $token );
		if ( is_wp_error( $body ) ) {
			$lookup_error = $body;
			$recordings   = array();
		} else {
			$items      = is_array( $body['items'] ?? null ) ? $body['items'] : array();
			$recordings = array_map( 'mm_scheduler_webex_broker_normalize_recording', $items );
		}
	}

	$recordings = array_values(
		array_filter(
			array_map( 'mm_scheduler_webex_broker_normalize_recording', is_array( $recordings ) ? $recordings : array() ),
			function ( $recording ) {
				return ! empty( $recording['id'] ) || ! empty( $recording['playback_url'] );
			}
		)
	);

	if ( empty( $recordings ) ) {
		$fallback_recordings = mm_scheduler_webex_broker_find_recordings_by_context( $params, $meeting_id );
		if ( is_wp_error( $fallback_recordings ) ) {
			return mm_scheduler_webex_broker_error( $lookup_error ?: $fallback_recordings, 'scheduler_webex_recording_lookup_failed' );
		}
		$recordings = $fallback_recordings;
	}

	return rest_ensure_response(
		array(
			'ok'            => ! empty( $recordings ),
			'provider'      => 'webex',
			'meeting_id'    => $meeting_id,
			'has_recording' => ! empty( $recordings ),
			'recordings'    => $recordings,
			'count'         => count( $recordings ),
		)
	);
}

/**
 * Find recordings when Webex links a completed recording to an ended meeting
 * instance while Scheduler stores the scheduled meeting ID.
 *
 * @param array  $params     Scheduler lookup payload.
 * @param string $meeting_id Stored Webex meeting ID.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_find_recordings_by_context( $params, $meeting_id ) {
	$token = mm_scheduler_webex_broker_access_token();
	if ( is_wp_error( $token ) ) {
		return $token;
	}

	$window   = mm_scheduler_webex_broker_recording_window( $params );
	$query    = array();
	$from_ts  = $window['from_ts'];
	$to_ts    = $window['to_ts'];
	$title    = sanitize_text_field( $params['appointment_title'] ?? $params['appointmentTitle'] ?? $params['title'] ?? '' );

	if ( $from_ts > 0 ) {
		$query['from'] = gmdate( 'Y-m-d\TH:i:s\Z', $from_ts );
	}
	if ( $to_ts > 0 ) {
		$query['to'] = gmdate( 'Y-m-d\TH:i:s\Z', $to_ts );
	}

	$endpoint = '/recordings';
	if ( ! empty( $query ) ) {
		$endpoint .= '?' . http_build_query( $query, '', '&', PHP_QUERY_RFC3986 );
	}

	$body = mm_scheduler_webex_broker_api_get( $endpoint, $token );
	if ( is_wp_error( $body ) && ! empty( $query ) ) {
		$body = mm_scheduler_webex_broker_api_get( '/recordings', $token );
	}
	if ( is_wp_error( $body ) ) {
		return $body;
	}

	$items   = is_array( $body['items'] ?? null ) ? $body['items'] : array();
	$matches = array_values(
		array_filter(
			$items,
			function ( $recording ) use ( $meeting_id, $title ) {
				return mm_scheduler_webex_broker_recording_matches_context( $recording, $meeting_id, $title );
			}
		)
	);

	return array_values(
		array_filter(
			array_map( 'mm_scheduler_webex_broker_normalize_recording', $matches ),
			function ( $recording ) {
				return ! empty( $recording['id'] ) || ! empty( $recording['playback_url'] );
			}
		)
	);
}

/**
 * Build a bounded recording lookup window around the appointment time.
 *
 * @param array $params Scheduler lookup payload.
 * @return array{from_ts:int,to_ts:int}
 */
function mm_scheduler_webex_broker_recording_window( $params ) {
	$start_raw = sanitize_text_field( $params['appointment_start_at'] ?? $params['appointmentStartAt'] ?? $params['start_at'] ?? $params['startAt'] ?? '' );
	$end_raw   = sanitize_text_field( $params['appointment_end_at'] ?? $params['appointmentEndAt'] ?? $params['end_at'] ?? $params['endAt'] ?? '' );
	$start_ts  = '' !== $start_raw ? strtotime( $start_raw ) : 0;
	$end_ts    = '' !== $end_raw ? strtotime( $end_raw ) : 0;

	if ( $start_ts > 0 ) {
		$to_source = $end_ts > 0 ? $end_ts : $start_ts;
		return array(
			'from_ts' => max( 0, $start_ts - 6 * HOUR_IN_SECONDS ),
			'to_ts'   => $to_source + 2 * DAY_IN_SECONDS,
		);
	}

	return array(
		'from_ts' => time() - 7 * DAY_IN_SECONDS,
		'to_ts'   => time() + DAY_IN_SECONDS,
	);
}

/**
 * Whether a Webex recording belongs to the requested Scheduler meeting.
 *
 * @param array  $recording  Raw Webex recording item.
 * @param string $meeting_id Stored Webex meeting ID.
 * @param string $title      Scheduler appointment title.
 * @return bool
 */
function mm_scheduler_webex_broker_recording_matches_context( $recording, $meeting_id, $title ) {
	$recording = is_array( $recording ) ? $recording : array();
	$meeting_id = sanitize_text_field( $meeting_id );
	$ids = array_filter(
		array_map(
			'sanitize_text_field',
			array(
				$recording['meetingId'] ?? '',
				$recording['scheduledMeetingId'] ?? '',
				$recording['meetingSeriesId'] ?? '',
			)
		)
	);
	if ( '' !== $meeting_id && in_array( $meeting_id, $ids, true ) ) {
		return true;
	}

	return mm_scheduler_webex_broker_recording_title_matches(
		sanitize_text_field( $recording['topic'] ?? $recording['title'] ?? '' ),
		$title
	);
}

/**
 * Conservative title fallback for older recordings where Webex omits the
 * scheduled meeting ID from filtered lookup responses.
 *
 * @param string $recording_title Recording title/topic.
 * @param string $appointment_title Scheduler appointment title.
 * @return bool
 */
function mm_scheduler_webex_broker_recording_title_matches( $recording_title, $appointment_title ) {
	$haystack = mm_scheduler_webex_broker_normalize_match_text( $recording_title );
	$needle   = mm_scheduler_webex_broker_normalize_match_text( $appointment_title );
	if ( strlen( $needle ) < 12 || strlen( $haystack ) < 12 ) {
		return false;
	}
	if ( false !== strpos( $haystack, $needle ) || false !== strpos( $needle, $haystack ) ) {
		return true;
	}

	$tokens = array_values( array_filter( explode( ' ', $needle ), static function ( $token ) {
		return strlen( $token ) >= 3 && ! in_array( $token, array( 'the', 'and', 'for', 'with', 'webex', 'test', 'donotuse', 'do', 'not', 'use' ), true );
	} ) );
	if ( count( $tokens ) < 4 ) {
		return false;
	}

	$matched = 0;
	foreach ( $tokens as $token ) {
		if ( false !== strpos( $haystack, $token ) ) {
			++$matched;
		}
	}

	return $matched >= max( 4, (int) ceil( count( $tokens ) * 0.6 ) );
}

/**
 * Normalize text for fallback title comparison.
 *
 * @param string $value Text to normalize.
 * @return string
 */
function mm_scheduler_webex_broker_normalize_match_text( $value ) {
	$value = strtolower( sanitize_text_field( $value ) );
	$value = preg_replace( '/[^a-z0-9]+/', ' ', $value );
	return trim( preg_replace( '/\s+/', ' ', (string) $value ) );
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

	$result = mm_scheduler_webex_broker_create_invitee(
		$meeting_id,
		$email,
		sanitize_text_field( $invitee['display_name'] ?? '' )
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
 * Create a Webex meeting through the REST gateway reachable from production.
 *
 * @param array $params Meeting payload.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_rest_create_meeting( $params ) {
	$timezone = sanitize_text_field( $params['timezone'] ?? 'America/New_York' );
	return mm_scheduler_webex_broker_api_post(
		'/meetings',
		array(
			'title'                  => sanitize_text_field( $params['title'] ?? '' ),
			'start'                  => mm_scheduler_webex_broker_datetime_for_timezone( $params['start'] ?? '', $timezone ),
			'end'                    => mm_scheduler_webex_broker_datetime_for_timezone( $params['end'] ?? '', $timezone ),
			'timezone'               => $timezone,
			'enabledAutoRecordMeeting' => mm_scheduler_webex_broker_truthy( $params['auto_record'] ?? false ),
			'enabledJoinBeforeHost'  => true,
			'joinBeforeHostMinutes'  => 5,
			'allowAnyUserToBeCoHost' => false,
		)
	);
}

/**
 * Webex rejects UTC timestamps when a named timezone has a different offset.
 *
 * @param string $value    Incoming ISO datetime.
 * @param string $timezone IANA timezone.
 * @return string
 */
function mm_scheduler_webex_broker_datetime_for_timezone( $value, $timezone ) {
	$value    = sanitize_text_field( $value );
	$timezone = sanitize_text_field( $timezone ?: 'America/New_York' );
	if ( '' === $value ) {
		return '';
	}

	try {
		$zone = new DateTimeZone( $timezone );
		$date = new DateTimeImmutable( $value );
		return $date->setTimezone( $zone )->format( 'Y-m-d\TH:i:sP' );
	} catch ( Exception $error ) {
		return $value;
	}
}

/**
 * Interpret common truthy config values.
 *
 * @param mixed $value Raw value.
 * @return bool
 */
function mm_scheduler_webex_broker_truthy( $value ) {
	if ( is_bool( $value ) ) {
		return $value;
	}

	return in_array( strtolower( trim( (string) $value ) ), array( '1', 'true', 'yes', 'on', 'enabled' ), true );
}

/**
 * Return student-safe recording metadata.
 *
 * @param array $recording Webex recording payload.
 * @return array
 */
function mm_scheduler_webex_broker_normalize_recording( $recording ) {
	$recording = is_array( $recording ) ? $recording : array();
	$links     = is_array( $recording['temporaryDirectDownloadLinks'] ?? null ) ? $recording['temporaryDirectDownloadLinks'] : array();

	return array(
		'id'                   => sanitize_text_field( $recording['id'] ?? $recording['recording_id'] ?? '' ),
		'title'                => sanitize_text_field( $recording['topic'] ?? $recording['title'] ?? '' ),
		'playback_url'         => esc_url_raw( $recording['playback_url'] ?? $recording['playbackUrl'] ?? $recording['playbackURL'] ?? '' ),
		'download_url_present' => ! empty( $recording['download_url'] ) || ! empty( $recording['downloadUrl'] ) || ! empty( $recording['downloadURL'] ) || ! empty( $links['recordingDownloadLink'] ),
		'duration_seconds'     => absint( $recording['duration_seconds'] ?? $recording['durationSeconds'] ?? $recording['duration'] ?? 0 ),
		'file_size_bytes'      => absint( $recording['file_size_bytes'] ?? $recording['sizeBytes'] ?? $recording['fileSize'] ?? 0 ),
		'created_at'           => sanitize_text_field( $recording['created_at'] ?? $recording['createTime'] ?? $recording['createdTime'] ?? $recording['created'] ?? '' ),
	);
}

/**
 * Add one student invitee to a Webex meeting through REST.
 *
 * @param string $meeting_id   Webex meeting ID.
 * @param string $email        Invitee email.
 * @param string $display_name Invitee display name.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_create_invitee( $meeting_id, $email, $display_name = '' ) {
	return mm_scheduler_webex_broker_api_post(
		'/meetingInvitees',
		array(
			'meetingId'   => sanitize_text_field( $meeting_id ),
			'email'       => sanitize_email( $email ),
			'displayName' => sanitize_text_field( $display_name ),
			'coHost'      => false,
		)
	);
}

/**
 * Validate the stored Webex OAuth connection without exposing token details.
 *
 * @return array
 */
function mm_scheduler_webex_broker_connection_health() {
	$token = mm_scheduler_webex_broker_access_token();
	if ( is_wp_error( $token ) ) {
		return array(
			'connected'  => false,
			'host_email' => get_option( 'mmed_webex_host_email', '' ),
		);
	}

	$me = mm_scheduler_webex_broker_api_get( '/people/me', $token );
	if ( is_wp_error( $me ) ) {
		$data = $me->get_error_data();
		if ( is_array( $data ) && 401 === (int) ( $data['status'] ?? 0 ) ) {
			$token = mm_scheduler_webex_broker_refresh_token();
			if ( is_wp_error( $token ) ) {
				return array(
					'connected'  => false,
					'host_email' => get_option( 'mmed_webex_host_email', '' ),
				);
			}
			$me = mm_scheduler_webex_broker_api_get( '/people/me', $token );
		}
	}

	if ( is_wp_error( $me ) ) {
		return array(
			'connected'  => false,
			'host_email' => get_option( 'mmed_webex_host_email', '' ),
		);
	}

	$host_email = sanitize_email( $me['emails'][0] ?? get_option( 'mmed_webex_host_email', '' ) );
	if ( '' !== $host_email ) {
		update_option( 'mmed_webex_host_email', $host_email, false );
	}

	return array(
		'connected'  => true,
		'host_email' => $host_email,
	);
}

/**
 * POST to the Webex REST API using the existing encrypted Webex token store.
 *
 * @param string $endpoint Endpoint path.
 * @param array  $body     Request body.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_api_post( $endpoint, $body ) {
	$token = mm_scheduler_webex_broker_access_token();
	if ( is_wp_error( $token ) ) {
		return $token;
	}

	$response = mm_scheduler_webex_broker_post_with_token( $endpoint, $body, $token );
	$decoded  = mm_scheduler_webex_broker_decode_response( $response );
	$error_data = is_wp_error( $decoded ) ? $decoded->get_error_data() : null;
	if ( is_wp_error( $decoded ) && is_array( $error_data ) && 401 === (int) ( $error_data['status'] ?? 0 ) ) {
		$token = mm_scheduler_webex_broker_refresh_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$decoded = mm_scheduler_webex_broker_decode_response(
			mm_scheduler_webex_broker_post_with_token( $endpoint, $body, $token )
		);
	}

	return $decoded;
}

/**
 * POST a Webex REST request with a bearer token.
 *
 * @param string $endpoint Endpoint path.
 * @param array  $body     Request body.
 * @param string $token    Access token.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_post_with_token( $endpoint, $body, $token ) {
	return wp_remote_post(
		mm_scheduler_webex_broker_api_base() . $endpoint,
		array(
			'headers' => array(
				'Authorization' => 'Bearer ' . $token,
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode( $body ),
			'timeout' => 20,
		)
	);
}

/**
 * GET a Webex REST resource with a bearer token.
 *
 * @param string $endpoint Endpoint path.
 * @param string $token    Access token.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_api_get( $endpoint, $token ) {
	$response = wp_remote_get(
		mm_scheduler_webex_broker_api_base() . $endpoint,
		array(
			'headers' => array( 'Authorization' => 'Bearer ' . $token ),
			'timeout' => 20,
		)
	);

	return mm_scheduler_webex_broker_decode_response( $response );
}

/**
 * Return the documented Webex REST base URL.
 *
 * @return string
 */
function mm_scheduler_webex_broker_api_base() {
	$base = trim( (string) getenv( 'MM_SCHEDULER_WEBEX_API_BASE' ) );
	if ( '' === $base && defined( 'MM_SCHEDULER_WEBEX_API_BASE' ) ) {
		$base = trim( (string) MM_SCHEDULER_WEBEX_API_BASE );
	}
	if ( '' === $base ) {
		$base = 'https://webexapis.com/v1';
	}

	return untrailingslashit( esc_url_raw( $base ) );
}

/**
 * Return the documented Webex OAuth base URL.
 *
 * @return string
 */
function mm_scheduler_webex_broker_oauth_base() {
	$base = trim( (string) getenv( 'MM_SCHEDULER_WEBEX_OAUTH_BASE' ) );
	if ( '' === $base && defined( 'MM_SCHEDULER_WEBEX_OAUTH_BASE' ) ) {
		$base = trim( (string) MM_SCHEDULER_WEBEX_OAUTH_BASE );
	}
	if ( '' === $base ) {
		$base = 'https://webexapis.com/v1';
	}

	return untrailingslashit( esc_url_raw( $base ) );
}

/**
 * Read or refresh the existing encrypted Webex access token without exposing it.
 *
 * @return string|WP_Error
 */
function mm_scheduler_webex_broker_access_token() {
	$token  = mm_scheduler_webex_broker_webex_option( 'mmed_webex_access_token' );
	$expiry = (int) get_option( 'mmed_webex_token_expiry', 0 );
	if ( '' !== $token && time() < $expiry - 300 ) {
		return $token;
	}

	return mm_scheduler_webex_broker_refresh_token();
}

/**
 * Refresh the encrypted Webex token through the documented OAuth endpoint.
 *
 * @return string|WP_Error
 */
function mm_scheduler_webex_broker_refresh_token() {
	$client_id     = mm_scheduler_webex_broker_webex_option( 'mmed_webex_client_id' );
	$client_secret = mm_scheduler_webex_broker_webex_option( 'mmed_webex_client_secret' );
	$refresh       = mm_scheduler_webex_broker_webex_option( 'mmed_webex_refresh_token' );

	if ( '' === $client_id || '' === $client_secret || '' === $refresh ) {
		return new WP_Error( 'webex_not_connected', 'Webex OAuth credentials are not connected.', array( 'status' => 503 ) );
	}

	$response = wp_remote_post(
		mm_scheduler_webex_broker_oauth_base() . '/access_token',
		array(
			'body'    => array(
				'grant_type'    => 'refresh_token',
				'client_id'     => $client_id,
				'client_secret' => $client_secret,
				'refresh_token' => $refresh,
			),
			'timeout' => 20,
		)
	);
	$body = mm_scheduler_webex_broker_decode_response( $response );
	if ( is_wp_error( $body ) ) {
		return $body;
	}
	if ( empty( $body['access_token'] ) ) {
		return new WP_Error( 'webex_refresh_failed', 'Webex token refresh did not return an access token.', array( 'status' => 502 ) );
	}

	mm_scheduler_webex_broker_update_webex_option( 'mmed_webex_access_token', $body['access_token'] );
	if ( ! empty( $body['refresh_token'] ) ) {
		mm_scheduler_webex_broker_update_webex_option( 'mmed_webex_refresh_token', $body['refresh_token'] );
	}
	update_option( 'mmed_webex_token_expiry', time() + (int) ( $body['expires_in'] ?? 0 ), false );

	return $body['access_token'];
}

/**
 * Read an encrypted option through the active Webex client internals.
 *
 * @param string $key Option key.
 * @return string
 */
function mm_scheduler_webex_broker_webex_option( $key ) {
	if ( ! class_exists( 'MMED_Webex_Client' ) ) {
		return '';
	}
	try {
		$method = new ReflectionMethod( 'MMED_Webex_Client', 'get_option_value' );
		$method->setAccessible( true );
		return trim( (string) $method->invoke( null, $key ) );
	} catch ( Exception $error ) {
		return '';
	}
}

/**
 * Update an encrypted option through the active Webex client internals.
 *
 * @param string $key   Option key.
 * @param string $value Option value.
 * @return void
 */
function mm_scheduler_webex_broker_update_webex_option( $key, $value ) {
	if ( ! class_exists( 'MMED_Webex_Client' ) ) {
		return;
	}
	try {
		$method = new ReflectionMethod( 'MMED_Webex_Client', 'update_encrypted_option' );
		$method->setAccessible( true );
		$method->invoke( null, $key, $value );
	} catch ( Exception $error ) {
		return;
	}
}

/**
 * Decode a Webex REST response.
 *
 * @param array|WP_Error $response HTTP response.
 * @return array|WP_Error
 */
function mm_scheduler_webex_broker_decode_response( $response ) {
	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( $code >= 200 && $code < 300 ) {
		return is_array( $body ) ? $body : array();
	}

	return new WP_Error(
		'webex_api_error',
		'Webex API request failed.',
		array(
			'status' => $code,
			'body'   => is_array( $body ) ? $body : array(),
		)
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
