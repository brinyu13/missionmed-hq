<?php
/**
 * V3-only low-latency Team Challenge action endpoint.
 *
 * This intentionally does not bootstrap the full MissionMed plugin stack. It
 * only accepts host scoring actions after validating the WordPress logged-in
 * cookie, REST nonce, and manage_options capability with a SHORTINIT load.
 */

define( 'SHORTINIT', true );

$mmed_v3_root = dirname( __DIR__, 4 );
require_once $mmed_v3_root . '/wp-load.php';

$mmed_v3_method = strtoupper( $_SERVER['REQUEST_METHOD'] ?? 'GET' );

if ( 'GET' === $mmed_v3_method ) {
	$state = mmed_v3_read_snapshot();
	if ( empty( $state['teams'] ) || ! is_array( $state['teams'] ) ) {
		mmed_v3_json( array( 'message' => 'Team Challenge state is unavailable.' ), 404 );
	}
	mmed_v3_json( $state, 200 );
}

if ( 'POST' !== $mmed_v3_method ) {
	mmed_v3_json( array( 'message' => 'Method not allowed.' ), 405 );
}

$mmed_v3_admin_auth = mmed_v3_authenticate_admin_request();
if ( ! $mmed_v3_admin_auth['ok'] ) {
	mmed_v3_json( array( 'message' => 'Host/admin session required.' ), 403 );
}

$payload = json_decode( file_get_contents( 'php://input' ), true );
if ( ! is_array( $payload ) ) {
	mmed_v3_json( array( 'message' => 'Invalid Team Challenge action.' ), 400 );
}

$state = mmed_v3_read_snapshot();
if ( empty( $state['teams'] ) || ! is_array( $state['teams'] ) ) {
	mmed_v3_json( array( 'message' => 'Team Challenge state is unavailable.' ), 409 );
}

$action = mmed_v3_key( $payload['action'] ?? '' );

if ( 'score' === $action ) {
	$state = mmed_v3_apply_score( $state, ! empty( $payload['correct'] ) );
	if ( ! empty( $payload['autoNext'] ) ) {
		$state = mmed_v3_auto_select_next( $state, mmed_v3_key( $payload['autoNextMode'] ?? '' ) );
		$action = 'score_auto_next';
	}
} elseif ( 'declare_winner' === $action ) {
	$state = mmed_v3_declare_winner( $state, mmed_v3_key( $payload['teamId'] ?? '' ) );
} elseif ( 'undo_score' === $action ) {
	$state = mmed_v3_undo_score( $state );
} elseif ( 'auto_select_next' === $action ) {
	$state = mmed_v3_auto_select_next( $state, mmed_v3_key( $payload['mode'] ?? '' ) );
} elseif ( 'select_student' === $action ) {
	$state = mmed_v3_select_student( $state, mmed_v3_key( $payload['teamId'] ?? '' ), mmed_v3_key( $payload['studentId'] ?? '' ) );
} elseif ( 'set_countdown' === $action ) {
	$state = mmed_v3_set_countdown( $state, mmed_v3_key( $payload['command'] ?? '' ), $payload['durationSeconds'] ?? 0 );
} elseif ( 'reset' === $action ) {
	$state = mmed_v3_reset_scores( $state );
} else {
	mmed_v3_json( array( 'message' => 'Action requires the standard Team Challenge endpoint.' ), 405 );
}

$state = mmed_v3_append_history( $state, $action );
$state['snapshotGeneratedAtMs'] = (int) floor( microtime( true ) * 1000 );

if ( ! mmed_v3_persist_option_state( $state ) || ! mmed_v3_write_snapshot( $state ) ) {
	mmed_v3_json( array( 'message' => 'Could not save Team Challenge state.' ), 500 );
}

mmed_v3_json( $state, 200 );

function mmed_v3_authenticate_admin_request() {
	$nonce = isset( $_SERVER['HTTP_X_WP_NONCE'] ) ? (string) $_SERVER['HTTP_X_WP_NONCE'] : '';
	if ( '' === $nonce ) {
		return array( 'ok' => false, 'reason' => 'missing_nonce' );
	}

	$auth = mmed_v3_validate_logged_in_cookie();
	if ( empty( $auth['user_id'] ) || empty( $auth['token'] ) ) {
		return array( 'ok' => false, 'reason' => $auth['reason'] ?? 'invalid_cookie' );
	}

	if ( ! mmed_v3_verify_rest_nonce( $nonce, (int) $auth['user_id'], (string) $auth['token'] ) ) {
		return array( 'ok' => false, 'reason' => 'invalid_nonce' );
	}

	if ( ! mmed_v3_user_has_administrator_cap( (int) $auth['user_id'] ) ) {
		return array( 'ok' => false, 'reason' => 'missing_admin_cap' );
	}

	return array(
		'ok'      => true,
		'user_id' => (int) $auth['user_id'],
	);
}

function mmed_v3_validate_logged_in_cookie() {
	global $wpdb;

	$cookie_name = mmed_v3_logged_in_cookie_name();
	if ( ! $wpdb ) {
		return array( 'reason' => 'missing_database' );
	}
	if ( '' === $cookie_name ) {
		return array( 'reason' => 'missing_cookie_name' );
	}
	if ( empty( $_COOKIE[ $cookie_name ] ) ) {
		return array( 'reason' => 'missing_cookie_value' );
	}

	$cookie = (string) wp_unslash( $_COOKIE[ $cookie_name ] );
	$parts  = explode( '|', $cookie );
	if ( 4 !== count( $parts ) ) {
		return array( 'reason' => 'bad_cookie_parts' );
	}

	list( $username, $expiration, $token, $hmac ) = $parts;
	$expiration = (int) $expiration;
	if ( $expiration < time() || '' === $username || '' === $token || '' === $hmac ) {
		return array( 'reason' => 'expired_or_empty_cookie' );
	}

	$user = $wpdb->get_row(
		$wpdb->prepare(
			"SELECT ID, user_login, user_pass FROM {$wpdb->users} WHERE user_login = %s LIMIT 1",
			$username
		),
		ARRAY_A
	);
	if ( ! is_array( $user ) || empty( $user['ID'] ) || empty( $user['user_pass'] ) ) {
		return array( 'reason' => 'user_not_found' );
	}

	$pass_frag = mmed_v3_password_fragment( (string) $user['user_pass'] );
	$key       = mmed_v3_wp_hash( $username . '|' . $pass_frag . '|' . $expiration . '|' . $token, 'logged_in' );
	$hash      = hash_hmac( 'sha256', $username . '|' . $expiration . '|' . $token, $key );
	if ( ! hash_equals( $hash, $hmac ) ) {
		return array( 'reason' => 'cookie_hash_mismatch' );
	}

	if ( ! mmed_v3_session_token_is_active( (int) $user['ID'], $token ) ) {
		return array( 'reason' => 'session_token_inactive' );
	}

	return array(
		'user_id' => (int) $user['ID'],
		'token'   => $token,
	);
}

function mmed_v3_logged_in_cookie_name() {
	if ( defined( 'LOGGED_IN_COOKIE' ) && '' !== LOGGED_IN_COOKIE && isset( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
		return LOGGED_IN_COOKIE;
	}

	foreach ( array_keys( $_COOKIE ) as $cookie_name ) {
		if ( 0 === strpos( (string) $cookie_name, 'wordpress_logged_in_' ) ) {
			return (string) $cookie_name;
		}
	}

	return defined( 'LOGGED_IN_COOKIE' ) ? (string) LOGGED_IN_COOKIE : '';
}

function mmed_v3_password_fragment( $hash ) {
	if ( 0 === strpos( $hash, '$P$' ) || 0 === strpos( $hash, '$2y$' ) || 0 === strpos( $hash, '$2a$' ) ) {
		return substr( $hash, 8, 4 );
	}

	return substr( $hash, -4 );
}

function mmed_v3_session_token_is_active( $user_id, $token ) {
	global $wpdb;
	if ( ! $wpdb || empty( $wpdb->usermeta ) ) {
		return false;
	}

	$row = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s LIMIT 1",
			$user_id,
			'session_tokens'
		)
	);
	$sessions = mmed_v3_maybe_unserialize( $row );
	if ( ! is_array( $sessions ) ) {
		return false;
	}

	$verifier = hash( 'sha256', $token );
	if ( empty( $sessions[ $verifier ] ) || ! is_array( $sessions[ $verifier ] ) ) {
		return false;
	}

	return empty( $sessions[ $verifier ]['expiration'] ) || (int) $sessions[ $verifier ]['expiration'] >= time();
}

function mmed_v3_verify_rest_nonce( $nonce, $user_id, $token ) {
	$nonce = (string) $nonce;
	if ( '' === $nonce || ! $user_id || '' === $token ) {
		return false;
	}

	$life = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
	$tick = (int) ceil( time() / ( $life / 2 ) );
	foreach ( array( $tick, $tick - 1 ) as $candidate_tick ) {
		$expected = substr( mmed_v3_wp_hash( $candidate_tick . '|wp_rest|' . $user_id . '|' . $token, 'nonce' ), -12, 10 );
		if ( hash_equals( $expected, $nonce ) ) {
			return true;
		}
	}

	return false;
}

function mmed_v3_wp_hash( $data, $scheme ) {
	return hash_hmac( 'md5', (string) $data, mmed_v3_salt( $scheme ) );
}

function mmed_v3_salt( $scheme ) {
	$scheme = strtolower( (string) $scheme );
	if ( 'nonce' === $scheme ) {
		return mmed_v3_constant( 'NONCE_KEY' ) . mmed_v3_constant( 'NONCE_SALT' );
	}
	if ( 'logged_in' === $scheme ) {
		return mmed_v3_constant( 'LOGGED_IN_KEY' ) . mmed_v3_constant( 'LOGGED_IN_SALT' );
	}

	return mmed_v3_constant( 'AUTH_KEY' ) . mmed_v3_constant( 'AUTH_SALT' );
}

function mmed_v3_constant( $name ) {
	return defined( $name ) ? (string) constant( $name ) : '';
}

function mmed_v3_user_has_administrator_cap( $user_id ) {
	global $wpdb;
	if ( ! $wpdb || empty( $wpdb->usermeta ) ) {
		return false;
	}

	$key = $wpdb->prefix . 'capabilities';
	$row = $wpdb->get_var( $wpdb->prepare( "SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s LIMIT 1", $user_id, $key ) );
	if ( ! is_string( $row ) || '' === $row ) {
		return false;
	}

	$caps = mmed_v3_maybe_unserialize( $row );
	return is_array( $caps ) && ! empty( $caps['administrator'] );
}

function mmed_v3_maybe_unserialize( $value ) {
	if ( ! is_string( $value ) ) {
		return $value;
	}

	$trimmed = trim( $value );
	if ( '' === $trimmed ) {
		return $value;
	}

	if ( 'N;' === $trimmed || preg_match( '/^[aOsibd]:/', $trimmed ) ) {
		$decoded = @unserialize( $trimmed );
		if ( false !== $decoded || 'b:0;' === $trimmed ) {
			return $decoded;
		}
	}

	return $value;
}

function mmed_v3_snapshot_path() {
	return dirname( __DIR__, 3 ) . '/uploads/missionmed-live-drills-v3/team-challenge-state.json';
}

function mmed_v3_read_snapshot() {
	$path = mmed_v3_snapshot_path();
	if ( ! file_exists( $path ) ) {
		return array();
	}

	$decoded = json_decode( file_get_contents( $path ), true );
	return is_array( $decoded ) ? $decoded : array();
}

function mmed_v3_write_snapshot( $state ) {
	$path = mmed_v3_snapshot_path();
	$dir  = dirname( $path );
	if ( ! is_dir( $dir ) && ! mkdir( $dir, 0755, true ) ) {
		return false;
	}

	$json = mmed_v3_json_encode( $state );
	if ( ! is_string( $json ) || '' === $json ) {
		return false;
	}

	$tmp = $path . '.tmp.' . bin2hex( random_bytes( 6 ) );
	if ( false === file_put_contents( $tmp, $json, LOCK_EX ) ) {
		return false;
	}
	@chmod( $tmp, 0644 );
	if ( ! rename( $tmp, $path ) ) {
		@unlink( $tmp );
		return false;
	}

	return true;
}

function mmed_v3_persist_option_state( $state ) {
	global $wpdb;

	if ( ! $wpdb || empty( $wpdb->options ) || ! is_array( $state ) ) {
		return false;
	}

	$option_name  = 'mmed_live_drills_v3_team_challenge_state';
	$option_value = serialize( $state );
	$existing_id  = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT option_id FROM {$wpdb->options} WHERE option_name = %s LIMIT 1",
			$option_name
		)
	);

	if ( $existing_id ) {
		$updated = $wpdb->update(
			$wpdb->options,
			array(
				'option_value' => $option_value,
				'autoload'     => 'no',
			),
			array( 'option_name' => $option_name ),
			array( '%s', '%s' ),
			array( '%s' )
		);

		return false !== $updated;
	}

	$inserted = $wpdb->insert(
		$wpdb->options,
		array(
			'option_name'  => $option_name,
			'option_value' => $option_value,
			'autoload'     => 'no',
		),
		array( '%s', '%s', '%s' )
	);

	return false !== $inserted;
}

function mmed_v3_apply_score( $state, $correct ) {
	$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
	$team_id = mmed_v3_key( $active['teamId'] ?? '' );
	$student_id = mmed_v3_key( $active['studentId'] ?? '' );

	foreach ( $state['teams'] as $team_index => $team ) {
		if ( mmed_v3_key( $team['id'] ?? '' ) !== $team_id || empty( $team['students'] ) || ! is_array( $team['students'] ) ) {
			continue;
		}
		foreach ( $team['students'] as $student_index => $student ) {
			if ( mmed_v3_key( $student['id'] ?? '' ) !== $student_id ) {
				continue;
			}
			$name = mmed_v3_text( $student['name'] ?? 'Student' );
			$state['teams'][ $team_index ]['students'][ $student_index ]['attempts'] = (int) ( $student['attempts'] ?? 0 ) + 1;
			$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = (int) ( $student['questionsAsked'] ?? $student['attempts'] ?? 0 ) + 1;
			if ( $correct ) {
				$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = (int) ( $student['points'] ?? 0 ) + 1;
			}
			$state = mmed_v3_recalculate_scores( $state );
			$state['lastScore'] = array(
				'teamId' => $team_id,
				'studentId' => $student_id,
				'correct' => (bool) $correct,
				'updatedAt' => gmdate( 'c' ),
			);
			$state['lastEvent'] = array(
				'type' => $correct ? 'correct' : 'missed',
				'message' => $name . ( $correct ? ' answered correctly.' : ' missed this one.' ),
				'updatedAt' => gmdate( 'c' ),
			);
			$state['nextTeamId'] = mmed_v3_next_team_id( $state, $team_id );
			$state['winner'] = null;
			$state['updatedAt'] = gmdate( 'c' );
			return $state;
		}
	}

	mmed_v3_json( array( 'message' => 'Choose an active student before scoring.' ), 409 );
}

function mmed_v3_declare_winner( $state, $team_id ) {
	foreach ( $state['teams'] as $team ) {
		if ( mmed_v3_key( $team['id'] ?? '' ) !== $team_id ) {
			continue;
		}
		$mvp = mmed_v3_team_mvp( $team );
		$state['winner'] = array(
			'teamId' => mmed_v3_key( $team['id'] ?? '' ),
			'teamName' => mmed_v3_text( $team['name'] ?? 'Winning Team' ),
			'mvpStudentId' => $mvp ? mmed_v3_key( $mvp['id'] ?? '' ) : '',
			'mvpName' => $mvp ? mmed_v3_text( $mvp['name'] ?? '' ) : '',
			'updatedAt' => gmdate( 'c' ),
		);
		$state['lastEvent'] = array(
			'type' => 'declare_winner',
			'message' => $state['winner']['teamName'] . ' win.',
			'updatedAt' => gmdate( 'c' ),
		);
		$state['updatedAt'] = gmdate( 'c' );
		return $state;
	}

	mmed_v3_json( array( 'message' => 'Selected team is unavailable.' ), 409 );
}

function mmed_v3_undo_score( $state ) {
	$last = is_array( $state['lastScore'] ?? null ) ? $state['lastScore'] : array();
	$team_id = mmed_v3_key( $last['teamId'] ?? $state['active']['teamId'] ?? '' );
	$student_id = mmed_v3_key( $last['studentId'] ?? $state['active']['studentId'] ?? '' );
	$decrement_point = array_key_exists( 'correct', $last ) ? (bool) $last['correct'] : true;

	foreach ( $state['teams'] as $team_index => $team ) {
		if ( mmed_v3_key( $team['id'] ?? '' ) !== $team_id || empty( $team['students'] ) || ! is_array( $team['students'] ) ) {
			continue;
		}
		foreach ( $team['students'] as $student_index => $student ) {
			if ( mmed_v3_key( $student['id'] ?? '' ) !== $student_id ) {
				continue;
			}
			if ( $decrement_point ) {
				$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = max( 0, (int) ( $student['points'] ?? 0 ) - 1 );
			}
			$state['teams'][ $team_index ]['students'][ $student_index ]['attempts'] = max( 0, (int) ( $student['attempts'] ?? 0 ) - 1 );
			$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = max( 0, (int) ( $student['questionsAsked'] ?? $student['attempts'] ?? 0 ) - 1 );
			$state = mmed_v3_recalculate_scores( $state );
			unset( $state['lastScore'] );
			$state['winner'] = null;
			$state['lastEvent'] = array(
				'type' => 'undo_score',
				'message' => 'Score corrected for ' . mmed_v3_text( $student['name'] ?? 'Student' ) . '.',
				'updatedAt' => gmdate( 'c' ),
			);
			$state['updatedAt'] = gmdate( 'c' );
			return $state;
		}
	}

	return $state;
}

function mmed_v3_reset_scores( $state ) {
	foreach ( (array) ( $state['teams'] ?? array() ) as $team_index => $team ) {
		$state['teams'][ $team_index ]['score'] = 0;
		foreach ( (array) ( $team['students'] ?? array() ) as $student_index => $student ) {
			$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = 0;
			$state['teams'][ $team_index ]['students'][ $student_index ]['attempts'] = 0;
			$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = 0;
		}
	}

	$state['winner'] = null;
	unset( $state['lastScore'] );
	$state['lastEvent'] = array(
		'type'      => 'reset',
		'message'   => 'Scores reset to zero.',
		'updatedAt' => gmdate( 'c' ),
	);
	$state['updatedAt'] = gmdate( 'c' );
	return $state;
}

function mmed_v3_select_student( $state, $team_id, $student_id ) {
	if ( ! mmed_v3_find_student( $state, $team_id, $student_id ) ) {
		mmed_v3_json( array( 'message' => 'Selected student is unavailable.' ), 409 );
	}

	$state['active'] = array( 'teamId' => $team_id, 'studentId' => $student_id );
	$student = mmed_v3_find_student( $state, $team_id, $student_id );
	$state['nextTeamId'] = mmed_v3_next_team_id( $state, $team_id );
	$state['lastEvent'] = array(
		'type' => 'select_student',
		'message' => mmed_v3_text( $student['name'] ?? 'Student' ) . ' is up.',
		'updatedAt' => gmdate( 'c' ),
	);
	$state['updatedAt'] = gmdate( 'c' );
	return $state;
}

function mmed_v3_set_countdown( $state, $command, $duration_seconds ) {
	$duration = min( 10800, max( 0, (int) $duration_seconds ) );
	$current  = is_array( $state['countdown'] ?? null ) ? mmed_v3_sanitize_countdown( $state['countdown'] ) : mmed_v3_sanitize_countdown( array() );

	if ( 'start' === $command ) {
		if ( 0 === $duration ) {
			$duration = max( 1, (int) ( $current['durationSeconds'] ?? 300 ) );
		}
		$state['countdown'] = mmed_v3_sanitize_countdown(
			array(
				'durationSeconds' => $duration,
				'endsAtEpoch'     => time() + $duration,
				'isRunning'       => true,
				'updatedAt'       => gmdate( 'c' ),
			)
		);
	} elseif ( 'stop' === $command ) {
		if ( 0 === $duration && ! empty( $current['isRunning'] ) && ! empty( $current['endsAtEpoch'] ) ) {
			$duration = max( 0, (int) $current['endsAtEpoch'] - time() );
		}
		$state['countdown'] = mmed_v3_sanitize_countdown(
			array(
				'durationSeconds' => $duration,
				'endsAtEpoch'     => 0,
				'isRunning'       => false,
				'updatedAt'       => gmdate( 'c' ),
			)
		);
	} elseif ( 'reset' === $command ) {
		$state['countdown'] = mmed_v3_sanitize_countdown( array() );
	} else {
		$state['countdown'] = mmed_v3_sanitize_countdown(
			array(
				'durationSeconds' => $duration,
				'endsAtEpoch'     => 0,
				'isRunning'       => false,
				'updatedAt'       => gmdate( 'c' ),
			)
		);
	}

	$state['lastEvent'] = array(
		'type'      => 'set_countdown',
		'message'   => ! empty( $state['countdown']['isRunning'] ) ? 'Countdown started.' : 'Countdown updated.',
		'updatedAt' => gmdate( 'c' ),
	);
	$state['updatedAt'] = gmdate( 'c' );

	return $state;
}

function mmed_v3_sanitize_countdown( $countdown ) {
	$countdown = is_array( $countdown ) ? $countdown : array();
	$duration  = min( 10800, max( 0, (int) ( $countdown['durationSeconds'] ?? 0 ) ) );
	$ends_at   = max( 0, (int) ( $countdown['endsAtEpoch'] ?? 0 ) );
	$running   = ! empty( $countdown['isRunning'] ) && $ends_at > 0;

	return array(
		'durationSeconds' => $duration,
		'endsAtEpoch'     => $ends_at,
		'isRunning'       => $running,
		'updatedAt'       => mmed_v3_text( $countdown['updatedAt'] ?? gmdate( 'c' ) ),
	);
}

function mmed_v3_auto_select_next( $state, $mode ) {
	$teams = is_array( $state['teams'] ?? null ) ? $state['teams'] : array();
	$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
	$team_id = mmed_v3_key( $state['nextTeamId'] ?? '' );
	if ( '' === $team_id ) {
		$team_id = mmed_v3_next_team_id( $state, mmed_v3_key( $active['teamId'] ?? '' ) );
	}

	$candidates = array();
	foreach ( $teams as $team ) {
		if ( mmed_v3_key( $team['id'] ?? '' ) !== $team_id || empty( $team['students'] ) || ! is_array( $team['students'] ) ) {
			continue;
		}
		foreach ( $team['students'] as $student ) {
			$candidates[] = $student;
		}
	}
	if ( empty( $candidates ) ) {
		return $state;
	}

	$lowest = null;
	foreach ( $candidates as $candidate ) {
		$count = mmed_v3_question_count( $candidate );
		$lowest = null === $lowest ? $count : min( $lowest, $count );
	}
	$candidates = array_values(
		array_filter(
			$candidates,
			function ( $student ) use ( $lowest ) {
				return mmed_v3_question_count( $student ) === $lowest;
			}
		)
	);

	if ( 'fair_random' === $mode ) {
		$student = $candidates[ array_rand( $candidates ) ];
	} else {
		$current_id = mmed_v3_key( $active['studentId'] ?? '' );
		$student = $candidates[0];
		if ( 1 < count( $candidates ) && mmed_v3_key( $student['id'] ?? '' ) === $current_id ) {
			$student = $candidates[1];
		}
	}

	return mmed_v3_select_student( $state, $team_id, mmed_v3_key( $student['id'] ?? '' ) );
}

function mmed_v3_question_count( $student ) {
	return (int) ( $student['questionsAsked'] ?? $student['attempts'] ?? 0 );
}

function mmed_v3_recalculate_scores( $state ) {
	foreach ( $state['teams'] as $team_index => $team ) {
		$total = 0;
		foreach ( (array) ( $team['students'] ?? array() ) as $student ) {
			$total += (int) ( $student['points'] ?? 0 );
		}
		$state['teams'][ $team_index ]['score'] = $total;
	}
	return $state;
}

function mmed_v3_next_team_id( $state, $current_team_id ) {
	$ids = array_values( array_filter( array_map( function ( $team ) { return mmed_v3_key( $team['id'] ?? '' ); }, (array) ( $state['teams'] ?? array() ) ) ) );
	if ( empty( $ids ) ) {
		return '';
	}
	$index = array_search( $current_team_id, $ids, true );
	if ( false === $index ) {
		return $ids[0];
	}
	return $ids[ ( $index + 1 ) % count( $ids ) ];
}

function mmed_v3_team_mvp( $team ) {
	$students = is_array( $team['students'] ?? null ) ? $team['students'] : array();
	$mvp = null;
	foreach ( $students as $student ) {
		if ( ! $mvp || (int) ( $student['points'] ?? 0 ) > (int) ( $mvp['points'] ?? 0 ) ) {
			$mvp = $student;
		}
	}
	return $mvp;
}

function mmed_v3_find_student( $state, $team_id, $student_id ) {
	foreach ( (array) ( $state['teams'] ?? array() ) as $team ) {
		if ( mmed_v3_key( $team['id'] ?? '' ) !== $team_id ) {
			continue;
		}
		foreach ( (array) ( $team['students'] ?? array() ) as $student ) {
			if ( mmed_v3_key( $student['id'] ?? '' ) === $student_id ) {
				return $student;
			}
		}
	}
	return null;
}

function mmed_v3_append_history( $state, $event_type ) {
	$history = is_array( $state['history'] ?? null ) ? $state['history'] : array();
	$event = is_array( $state['lastEvent'] ?? null ) ? $state['lastEvent'] : array();
	$history[] = array(
		'type' => mmed_v3_key( $event_type ),
		'event' => mmed_v3_key( $event['type'] ?? $event_type ),
		'message' => mmed_v3_text( $event['message'] ?? '' ),
		'updatedAt' => mmed_v3_text( $event['updatedAt'] ?? gmdate( 'c' ) ),
	);
	if ( 50 < count( $history ) ) {
		$history = array_slice( $history, -50 );
	}
	$state['history'] = $history;
	return $state;
}

function mmed_v3_key( $value ) {
	return strtolower( preg_replace( '/[^a-zA-Z0-9_\\-]/', '', (string) $value ) );
}

function mmed_v3_text( $value ) {
	$text = function_exists( 'wp_strip_all_tags' ) ? wp_strip_all_tags( (string) $value ) : strip_tags( (string) $value );
	return trim( preg_replace( '/[\\x00-\\x1F\\x7F]/', '', $text ) );
}

function mmed_v3_json( $data, $status ) {
	http_response_code( $status );
	header( 'Content-Type: application/json; charset=UTF-8' );
	header( 'Cache-Control: no-store, no-cache, must-revalidate, max-age=0' );
	echo mmed_v3_json_encode( $data );
	exit;
}

function mmed_v3_json_encode( $data ) {
	return function_exists( 'wp_json_encode' ) ? wp_json_encode( $data ) : json_encode( $data );
}
