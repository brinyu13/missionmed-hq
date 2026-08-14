<?php
/**
 * Sole Drills LIVE state transport and mutation gateway.
 *
 * Anonymous GET requests read a privacy-safe static snapshot without WordPress
 * or database boot. Authorized reads use a session-bound viewer ticket and a
 * SHORTINIT boot only to access the signing salts. Every mutation takes one
 * lock, boots WordPress once, and delegates to the protected gameplay class.
 *
 * @package MissionMed_Hub
 */

$mmed_v3_request_started_ms = (int) floor( microtime( true ) * 1000 );
$mmed_v3_method = strtoupper( (string) ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) );
$mmed_v3_root = dirname( __DIR__, 4 );

if ( ! getenv( 'MMED_V3_PRIVATE_STATE_PATH' ) ) {
	putenv( 'MMED_V3_PRIVATE_STATE_PATH=' . dirname( rtrim( $mmed_v3_root, '/' ) ) . '/web/missionmed-private/missionmed-live-drills-v3/team-challenge-state.json' );
}

require_once dirname( __DIR__ ) . '/includes/class-mmed-live-drills-state-contract.php';

if ( 'GET' === $mmed_v3_method || 'HEAD' === $mmed_v3_method ) {
	mmed_v3_floor_handle_get( $mmed_v3_root, 'HEAD' === $mmed_v3_method );
}

if ( 'POST' !== $mmed_v3_method ) {
	mmed_v3_floor_json( array( 'message' => 'This room does not support that request.' ), 405 );
}

require_once $mmed_v3_root . '/wp-load.php';

if ( ! class_exists( 'MMED_Live_Drills_SDK_V3' ) ) {
	mmed_v3_floor_json( array( 'message' => 'The live room is unavailable. Refresh the page or contact the host.' ), 503 );
}

mmed_v3_floor_require_same_origin();

$mmed_v3_nonce = isset( $_SERVER['HTTP_X_WP_NONCE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) ) : '';
if ( ! wp_verify_nonce( $mmed_v3_nonce, 'wp_rest' ) ) {
	mmed_v3_floor_json( array( 'message' => 'Your room session expired. Refresh the page and try again.' ), 403 );
}

$mmed_v3_payload = json_decode( (string) file_get_contents( 'php://input' ), true );
if ( ! is_array( $mmed_v3_payload ) ) {
	mmed_v3_floor_json( array( 'message' => 'That room action could not be read. Try again.' ), 400 );
}

$mmed_v3_action = sanitize_key( $mmed_v3_payload['action'] ?? '' );
$mmed_v3_ticket = mmed_v3_floor_viewer_ticket();
$mmed_v3_viewer = array();
$mmed_v3_private_path = mmed_v3_floor_private_snapshot_path( $mmed_v3_root );
$mmed_v3_private_state = MMED_Live_Drills_State_Contract::read_json( $mmed_v3_private_path );
$mmed_v3_session_id = sanitize_key( $mmed_v3_private_state['sessionId'] ?? '' );

if ( is_user_logged_in() ) {
	$mmed_v3_viewer = array(
		'id'        => 'u' . get_current_user_id(),
		'role'      => current_user_can( 'manage_options' ) ? 'host' : 'participant',
		'sessionId' => $mmed_v3_session_id,
	);
} elseif ( '' !== $mmed_v3_ticket && '' !== $mmed_v3_session_id ) {
	$mmed_v3_viewer = MMED_Live_Drills_State_Contract::verify_viewer_ticket(
		mmed_v3_floor_secret(),
		$mmed_v3_ticket,
		$mmed_v3_session_id
	);
}

$mmed_v3_anonymous_actions = array( 'guest_join', 'guest_watch' );
if ( empty( $mmed_v3_viewer ) && ! in_array( $mmed_v3_action, $mmed_v3_anonymous_actions, true ) ) {
	mmed_v3_floor_json( array( 'message' => 'Choose Play or Watch again to reconnect to this room.' ), 401 );
}

$mmed_v3_lock_started_ms = (int) floor( microtime( true ) * 1000 );
$mmed_v3_lock = mmed_v3_floor_acquire_writer_lock( $mmed_v3_root );
if ( ! is_resource( $mmed_v3_lock ) ) {
	mmed_v3_floor_json( array( 'message' => 'The room is processing another update. Try again in a moment.' ), 503 );
}
$mmed_v3_lock_wait_ms = (int) floor( microtime( true ) * 1000 ) - $mmed_v3_lock_started_ms;

$mmed_v3_request = new WP_REST_Request( 'POST', '/mmed/v1/live-drills-v3/team-challenge' );
foreach ( $mmed_v3_payload as $mmed_v3_key => $mmed_v3_value ) {
	if ( ! is_string( $mmed_v3_key ) || ! preg_match( '/^[A-Za-z][A-Za-z0-9_]{0,63}$/', $mmed_v3_key ) ) {
		continue;
	}
	$mmed_v3_request->set_param( $mmed_v3_key, $mmed_v3_value );
}

$mmed_v3_result = MMED_Live_Drills_SDK_V3::update_team_challenge_state( $mmed_v3_request, $mmed_v3_viewer );
$mmed_v3_accepted_ms = (int) floor( microtime( true ) * 1000 );

if ( is_wp_error( $mmed_v3_result ) ) {
	flock( $mmed_v3_lock, LOCK_UN );
	fclose( $mmed_v3_lock );
	$mmed_v3_error_data = $mmed_v3_result->get_error_data();
	$mmed_v3_error_status = is_array( $mmed_v3_error_data ) && ! empty( $mmed_v3_error_data['status'] ) ? absint( $mmed_v3_error_data['status'] ) : 400;
	mmed_v3_floor_json(
		array(
			'code'    => $mmed_v3_result->get_error_code(),
			'message' => $mmed_v3_result->get_error_message(),
		),
		$mmed_v3_error_status
	);
}

if ( method_exists( 'MMED_Live_Drills_SDK_V3', 'team_challenge_last_persist_error' ) ) {
	$mmed_v3_persist_error = MMED_Live_Drills_SDK_V3::team_challenge_last_persist_error();
	if ( '' !== $mmed_v3_persist_error ) {
		flock( $mmed_v3_lock, LOCK_UN );
		fclose( $mmed_v3_lock );
		mmed_v3_floor_json( array( 'message' => 'The room could not safely save that update. Nothing else should be changed; try again.' ), 500 );
	}
}

$mmed_v3_state = $mmed_v3_result instanceof WP_REST_Response ? $mmed_v3_result->get_data() : $mmed_v3_result;
$mmed_v3_state = MMED_Live_Drills_State_Contract::normalize_state( $mmed_v3_state );

if ( in_array( $mmed_v3_action, $mmed_v3_anonymous_actions, true ) ) {
	$mmed_v3_guest_id = sanitize_key( $mmed_v3_payload['guestId'] ?? '' );
	if ( 0 !== strpos( $mmed_v3_guest_id, 'guest-' ) ) {
		$mmed_v3_guest_id = 'guest-' . $mmed_v3_guest_id;
	}
	$mmed_v3_viewer = array(
		'id'        => $mmed_v3_guest_id,
		'role'      => 'participant',
		'sessionId' => $mmed_v3_state['sessionId'],
	);
}

if ( empty( $mmed_v3_viewer ) ) {
	$mmed_v3_viewer = array( 'id' => '', 'role' => 'public', 'sessionId' => $mmed_v3_state['sessionId'] );
}

$mmed_v3_response = MMED_Live_Drills_State_Contract::viewer_view( $mmed_v3_state, $mmed_v3_viewer );
if ( in_array( $mmed_v3_viewer['role'] ?? '', array( 'host', 'participant' ), true ) ) {
	$mmed_v3_response['_viewerTicket'] = MMED_Live_Drills_State_Contract::issue_viewer_ticket(
		mmed_v3_floor_secret(),
		$mmed_v3_viewer['id'],
		$mmed_v3_viewer['role'],
		$mmed_v3_state['sessionId']
	);
}

$mmed_v3_response['nowMs'] = $mmed_v3_accepted_ms;
$mmed_v3_response['_meta'] = array(
	'actionReceivedAtMs' => $mmed_v3_request_started_ms,
	'serverAcceptedAtMs' => $mmed_v3_accepted_ms,
	'processingMs'       => max( 0, $mmed_v3_accepted_ms - $mmed_v3_request_started_ms ),
	'lockWaitMs'         => max( 0, $mmed_v3_lock_wait_ms ),
	'eventSeq'           => (int) ( $mmed_v3_state['eventSeq'] ?? 0 ),
	'lifecycle'          => sanitize_key( $mmed_v3_state['lifecycle']['state'] ?? 'idle' ),
);

flock( $mmed_v3_lock, LOCK_UN );
fclose( $mmed_v3_lock );

mmed_v3_floor_json( $mmed_v3_response, 200 );

/**
 * Serve a conditional public or ticket-authorized state read.
 *
 * @param string $root WordPress root.
 * @param bool   $head Whether this is a HEAD request.
 * @return void
 */
function mmed_v3_floor_handle_get( $root, $head = false ) {
	$public_path = mmed_v3_floor_public_snapshot_path( $root );
	$public_state = MMED_Live_Drills_State_Contract::read_json( $public_path );
	$ticket = mmed_v3_floor_viewer_ticket();
	$viewer = array();
	$reader_mode = 'static-public';
	$state = $public_state;

	if ( '' !== $ticket ) {
		if ( ! defined( 'SHORTINIT' ) ) {
			define( 'SHORTINIT', true );
		}
		require_once $root . '/wp-load.php';
		$private_state = MMED_Live_Drills_State_Contract::read_json( mmed_v3_floor_private_snapshot_path( $root ) );
		$session_id = (string) ( $private_state['sessionId'] ?? '' );
		$viewer = MMED_Live_Drills_State_Contract::verify_viewer_ticket( mmed_v3_floor_secret(), $ticket, $session_id );
		if ( empty( $viewer ) ) {
			mmed_v3_floor_json( array( 'message' => 'Your room access expired. Choose Play or Watch again.' ), 401 );
		}
		$state = $private_state;
		$reader_mode = 'static-ticket';
	}

	if ( empty( $state['teams'] ) || ! is_array( $state['teams'] ) ) {
		mmed_v3_floor_json( array( 'message' => 'The live room is not ready yet. Keep this page open and try again shortly.' ), 404 );
	}

	$response = empty( $viewer )
		? MMED_Live_Drills_State_Contract::public_view( $state )
		: MMED_Live_Drills_State_Contract::viewer_view( $state, $viewer );
	$etag = MMED_Live_Drills_State_Contract::etag( $response );
	$now_ms = MMED_Live_Drills_State_Contract::now_ms();
	$snapshot_ms = (int) ( $response['snapshotGeneratedAtMs'] ?? 0 );
	$if_none_match = trim( (string) ( $_SERVER['HTTP_IF_NONE_MATCH'] ?? '' ) );

	header( 'ETag: ' . $etag );
	header( 'Vary: X-MMED-Viewer-Ticket' );
	header( 'X-MMED-Reader-Mode: ' . $reader_mode );
	header( 'X-MMED-Server-Now-Ms: ' . $now_ms );
	header( 'X-MMED-Event-Seq: ' . (int) ( $response['eventSeq'] ?? 0 ) );
	header( 'X-MMED-Lifecycle: ' . preg_replace( '/[^a-z_]/', '', (string) ( $response['lifecycle']['state'] ?? 'idle' ) ) );
	header( 'X-MMED-Snapshot-Age-Ms: ' . max( 0, $now_ms - $snapshot_ms ) );
	header( empty( $viewer ) ? 'Cache-Control: no-store, max-age=0' : 'Cache-Control: no-store, private, max-age=0' );
	header( 'Pragma: no-cache' );
	header( 'X-Content-Type-Options: nosniff' );

	if ( '*' === $if_none_match || in_array( $etag, array_map( 'trim', explode( ',', $if_none_match ) ), true ) ) {
		http_response_code( 304 );
		exit;
	}

	$response['nowMs'] = $now_ms;
	if ( $head ) {
		header( 'Content-Type: application/json; charset=UTF-8' );
		http_response_code( 200 );
		exit;
	}
	mmed_v3_floor_json( $response, 200 );
}

/**
 * Return the state reader ticket from an HTTP header only.
 *
 * @return string
 */
function mmed_v3_floor_viewer_ticket() {
	$ticket = (string) ( $_SERVER['HTTP_X_MMED_VIEWER_TICKET'] ?? '' );

	return strlen( $ticket ) <= 2048 ? trim( $ticket ) : '';
}

/**
 * Return the signing secret after WordPress configuration has loaded.
 *
 * @return string
 */
function mmed_v3_floor_secret() {
	$auth_key = defined( 'AUTH_KEY' ) ? (string) AUTH_KEY : '';
	$auth_salt = defined( 'AUTH_SALT' ) ? (string) AUTH_SALT : '';

	return hash( 'sha256', 'mmed-live-drills-viewer|' . $auth_key . '|' . $auth_salt );
}

/**
 * Return the anonymous public snapshot path.
 *
 * @param string $root WordPress root.
 * @return string
 */
function mmed_v3_floor_public_snapshot_path( $root ) {
	$override = getenv( 'MMED_V3_PUBLIC_STATE_PATH' );
	if ( is_string( $override ) && '' !== trim( $override ) ) {
		return $override;
	}

	return rtrim( $root, '/' ) . '/wp-content/uploads/' . MMED_Live_Drills_State_Contract::PUBLIC_SNAPSHOT_RELATIVE_PATH;
}

/**
 * Return the private snapshot path outside the public document root.
 *
 * @param string $root WordPress root.
 * @return string
 */
function mmed_v3_floor_private_snapshot_path( $root ) {
	$override = getenv( 'MMED_V3_PRIVATE_STATE_PATH' );
	if ( is_string( $override ) && '' !== trim( $override ) ) {
		return $override;
	}

	return dirname( rtrim( $root, '/' ) ) . '/web/missionmed-private/' . MMED_Live_Drills_State_Contract::PRIVATE_SNAPSHOT_RELATIVE_PATH;
}

/**
 * Acquire the sole writer lock with a bounded wait.
 *
 * @param string $root WordPress root.
 * @return resource|false
 */
function mmed_v3_floor_acquire_writer_lock( $root ) {
	$path = dirname( mmed_v3_floor_private_snapshot_path( $root ) ) . '/team-challenge-state.lock';
	$directory = dirname( $path );
	if ( ! is_dir( $directory ) && ! mkdir( $directory, 0750, true ) ) {
		return false;
	}
	$handle = fopen( $path, 'c+' );
	if ( ! is_resource( $handle ) ) {
		return false;
	}
	@chmod( $path, 0640 );
	$deadline = microtime( true ) + 2.0;
	do {
		if ( flock( $handle, LOCK_EX | LOCK_NB ) ) {
			return $handle;
		}
		usleep( 20000 );
	} while ( microtime( true ) < $deadline );

	fclose( $handle );
	return false;
}

/**
 * Enforce same-origin browser mutations.
 *
 * @return void
 */
function mmed_v3_floor_require_same_origin() {
	$origin = trim( (string) ( $_SERVER['HTTP_ORIGIN'] ?? '' ) );
	if ( '' === $origin ) {
		return;
	}
	$origin_host = strtolower( (string) wp_parse_url( $origin, PHP_URL_HOST ) );
	$site_host = strtolower( (string) wp_parse_url( home_url( '/' ), PHP_URL_HOST ) );
	if ( '' === $origin_host || '' === $site_host || ! hash_equals( $site_host, $origin_host ) ) {
		mmed_v3_floor_json( array( 'message' => 'Open this room from MissionMed and try again.' ), 403 );
	}
}

/**
 * Emit a JSON response with no-store headers.
 *
 * @param mixed $data Response data.
 * @param int   $status HTTP status.
 * @return void
 */
function mmed_v3_floor_json( $data, $status ) {
	http_response_code( (int) $status );
	header( 'Content-Type: application/json; charset=UTF-8' );
	header( 'Cache-Control: no-store, private, max-age=0' );
	header( 'Pragma: no-cache' );
	header( 'X-Content-Type-Options: nosniff' );
	echo json_encode( $data, JSON_UNESCAPED_SLASHES );
	exit;
}
