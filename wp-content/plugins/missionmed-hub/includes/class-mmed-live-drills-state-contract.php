<?php
/**
 * Pure state contract for the Drills LIVE production floor.
 *
 * This file intentionally has no WordPress dependency so the public state read
 * path can validate and render snapshots without booting WordPress or a database.
 *
 * @package MissionMed_Hub
 */

if ( class_exists( 'MMED_Live_Drills_State_Contract', false ) ) {
	return;
}

final class MMED_Live_Drills_State_Contract {

	const SCHEMA_VERSION = 2;
	const PRIVATE_SNAPSHOT_RELATIVE_PATH = 'missionmed-live-drills-v3/team-challenge-state.json';
	const PUBLIC_SNAPSHOT_RELATIVE_PATH = 'missionmed-live-drills-v3/team-challenge-state.json';
	const VIEWER_TICKET_VERSION = 1;

	/**
	 * Return current Unix time in milliseconds.
	 *
	 * @return int
	 */
	public static function now_ms() {
		return (int) floor( microtime( true ) * 1000 );
	}

	/**
	 * Normalize the shared state without inferring LIVE from a countdown.
	 *
	 * @param mixed $state Raw state.
	 * @return array
	 */
	public static function normalize_state( $state ) {
		$state = is_array( $state ) ? $state : array();
		$state['schemaVersion'] = self::SCHEMA_VERSION;
		$state['eventSeq'] = max( 0, (int) ( $state['eventSeq'] ?? 0 ) );

		$session_id = self::key( $state['sessionId'] ?? '' );
		if ( '' === $session_id ) {
			$legacy_seed = (string) ( $state['updatedAt'] ?? '' ) . '|' . (string) ( $state['rosterHash'] ?? '' );
			$session_id = 'legacy-' . substr( hash( 'sha256', $legacy_seed ), 0, 16 );
		}
		$state['sessionId'] = $session_id;
		$public_id_salt = strtolower( preg_replace( '/[^a-f0-9]/', '', (string) ( $state['publicIdSalt'] ?? '' ) ) );
		if ( 32 <= strlen( $public_id_salt ) ) {
			$state['publicIdSalt'] = substr( $public_id_salt, 0, 64 );
		} else {
			unset( $state['publicIdSalt'] );
		}
		$state['lifecycle'] = self::normalize_lifecycle( $state['lifecycle'] ?? array() );
		$state['countdown'] = self::normalize_countdown( $state['countdown'] ?? array() );
		$state['spectators'] = self::normalize_spectators( $state['spectators'] ?? array() );
		$state['spectatorCount'] = count( $state['spectators'] );
		$state['snapshotGeneratedAtMs'] = max(
			0,
			(int) ( $state['snapshotGeneratedAtMs'] ?? self::state_timestamp_ms( $state ) )
		);

		return $state;
	}

	/**
	 * Normalize lifecycle state. Legacy snapshots always migrate to idle.
	 *
	 * @param mixed $lifecycle Raw lifecycle.
	 * @return array
	 */
	public static function normalize_lifecycle( $lifecycle ) {
		$lifecycle = is_array( $lifecycle ) ? $lifecycle : array();
		$state = self::key( $lifecycle['state'] ?? '' );
		$allowed = array( 'idle', 'doors_open', 'live', 'ended', 'archived' );
		if ( ! in_array( $state, $allowed, true ) ) {
			$state = 'idle';
		}

		return array(
			'state'       => $state,
			'changedAt'   => self::text( $lifecycle['changedAt'] ?? '' ),
			'startedAt'   => self::text( $lifecycle['startedAt'] ?? '' ),
			'endedAt'     => self::text( $lifecycle['endedAt'] ?? '' ),
			'archivedAt'  => self::text( $lifecycle['archivedAt'] ?? '' ),
		);
	}

	/**
	 * Normalize countdown data and resolve expired timestamps truthfully.
	 *
	 * @param mixed $countdown Raw countdown.
	 * @return array
	 */
	public static function normalize_countdown( $countdown ) {
		$countdown = is_array( $countdown ) ? $countdown : array();
		$duration = min( 10800, max( 0, (int) ( $countdown['durationSeconds'] ?? 0 ) ) );
		$ends_at = max( 0, (int) ( $countdown['endsAtEpoch'] ?? 0 ) );
		$running = ! empty( $countdown['isRunning'] ) && $ends_at > time();
		$expired = ! empty( $countdown['isRunning'] ) && $ends_at > 0 && $ends_at <= time();

		if ( $expired ) {
			$duration = 0;
			$ends_at = 0;
		}

		return array(
			'durationSeconds' => $duration,
			'endsAtEpoch'     => $ends_at,
			'isRunning'       => $running,
			'expired'         => $expired,
			'updatedAt'       => self::text( $countdown['updatedAt'] ?? '' ),
		);
	}

	/**
	 * Normalize spectator rows retained only in privileged snapshots.
	 *
	 * @param mixed $spectators Raw spectators.
	 * @return array
	 */
	public static function normalize_spectators( $spectators ) {
		$clean = array();
		if ( ! is_array( $spectators ) ) {
			return $clean;
		}

		foreach ( array_slice( $spectators, -100 ) as $spectator ) {
			if ( ! is_array( $spectator ) ) {
				continue;
			}
			$id = self::key( $spectator['id'] ?? '' );
			if ( '' === $id ) {
				continue;
			}
			$clean[] = array(
				'id'       => $id,
				'name'     => substr( self::text( $spectator['name'] ?? 'Viewer' ), 0, 80 ),
				'joinedAt' => self::text( $spectator['joinedAt'] ?? '' ),
				'isGuest'  => ! empty( $spectator['isGuest'] ),
			);
		}

		return array_values( $clean );
	}

	/**
	 * Prepare a state mutation with one monotonic sequence increment.
	 *
	 * @param mixed $state Raw state.
	 * @param int   $minimum_sequence Sequence observed in durable storage.
	 * @return array
	 */
	public static function prepare_mutation( $state, $minimum_sequence = 0 ) {
		$state = self::normalize_state( $state );
		if ( empty( $state['publicIdSalt'] ) ) {
			$state['publicIdSalt'] = self::new_public_id_salt();
		}
		$state['eventSeq'] = max( (int) $state['eventSeq'], (int) $minimum_sequence ) + 1;
		$state['snapshotGeneratedAtMs'] = self::now_ms();

		return $state;
	}

	/**
	 * Build the minimum anonymous state needed to render a safe room preview.
	 *
	 * @param mixed $state Full state.
	 * @return array
	 */
	public static function public_view( $state ) {
		$state = self::normalize_state( $state );
		$session_id = $state['sessionId'];
		$public_id_salt = (string) ( $state['publicIdSalt'] ?? '' );
		$id_map = array();
		$teams = array();

		foreach ( (array) ( $state['teams'] ?? array() ) as $team ) {
			$team_id = self::key( $team['id'] ?? '' );
			$students = array();
			foreach ( (array) ( $team['students'] ?? array() ) as $student ) {
				$internal_id = self::key( $student['id'] ?? '' );
				if ( '' === $internal_id ) {
					continue;
				}
				$public_id = self::public_id( $session_id, $internal_id, $public_id_salt );
				$id_map[ $internal_id ] = $public_id;
				$initials = self::initials( $student['initials'] ?? ( $student['name'] ?? '' ) );
				$students[] = array(
					'id'             => $public_id,
					'name'           => $initials,
					'initials'       => $initials,
					'points'         => max( 0, (int) ( $student['points'] ?? 0 ) ),
					'attempts'       => max( 0, (int) ( $student['attempts'] ?? 0 ) ),
					'questionsAsked' => max( 0, (int) ( $student['questionsAsked'] ?? ( $student['attempts'] ?? 0 ) ) ),
					'joined'         => ! array_key_exists( 'joined', $student ) || ! empty( $student['joined'] ),
				);
			}

			$teams[] = array(
				'id'       => $team_id,
				'name'     => substr( self::text( $team['name'] ?? ( $team['label'] ?? $team_id ) ), 0, 80 ),
				'label'    => substr( self::text( $team['label'] ?? ( $team['name'] ?? $team_id ) ), 0, 80 ),
				'color'    => self::safe_color( $team['color'] ?? '' ),
				'score'    => max( 0, (int) ( $team['score'] ?? 0 ) ),
				'students' => $students,
			);
		}

		$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
		$winner = is_array( $state['winner'] ?? null ) ? $state['winner'] : null;
		$public_winner = null;
		if ( $winner ) {
			$mvp_internal = self::key( $winner['mvpStudentId'] ?? '' );
			$public_winner = array(
				'teamId'       => self::key( $winner['teamId'] ?? '' ),
				'teamName'     => substr( self::text( $winner['teamName'] ?? '' ), 0, 80 ),
				'mvpStudentId' => $id_map[ $mvp_internal ] ?? '',
				'mvpName'      => self::initials( $winner['mvpName'] ?? '' ),
				'updatedAt'    => self::text( $winner['updatedAt'] ?? '' ),
			);
		}

		$active_internal = self::key( $active['studentId'] ?? '' );
		$last_event = is_array( $state['lastEvent'] ?? null ) ? $state['lastEvent'] : array();

		return array(
			'schemaVersion'         => self::SCHEMA_VERSION,
			'mode'                  => 'team_challenge',
			'sessionId'             => $session_id,
			'sessionTitle'          => substr( self::text( $state['sessionTitle'] ?? 'Dr J Drills LIVE' ), 0, 100 ),
			'lifecycle'             => $state['lifecycle'],
			'teams'                 => $teams,
			'active'                => array(
				'teamId'    => self::key( $active['teamId'] ?? '' ),
				'studentId' => $id_map[ $active_internal ] ?? '',
			),
			'nextTeamId'            => self::key( $state['nextTeamId'] ?? '' ),
			'winner'                => $public_winner,
			'hostNote'              => substr( self::text( $state['hostNote'] ?? '' ), 0, 220 ),
			'countdown'             => $state['countdown'],
			'spectatorCount'        => max( 0, (int) $state['spectatorCount'] ),
			'lastEvent'             => array(
				'type'      => self::key( $last_event['type'] ?? '' ),
				'message'   => self::public_event_message( $last_event['type'] ?? '' ),
				'updatedAt' => self::text( $last_event['updatedAt'] ?? '' ),
			),
			'updatedAt'             => self::text( $state['updatedAt'] ?? '' ),
			'eventSeq'              => (int) $state['eventSeq'],
			'snapshotGeneratedAtMs' => (int) $state['snapshotGeneratedAtMs'],
			'viewer'                => array( 'role' => 'public', 'id' => '' ),
		);
	}

	/**
	 * Build a role-appropriate privileged response.
	 *
	 * @param mixed $state Full state.
	 * @param mixed $viewer Verified viewer context.
	 * @return array
	 */
	public static function viewer_view( $state, $viewer ) {
		$state = self::normalize_state( $state );
		$viewer = is_array( $viewer ) ? $viewer : array();
		$role = self::key( $viewer['role'] ?? 'public' );
		$viewer_id = self::key( $viewer['id'] ?? '' );
		if ( ! in_array( $role, array( 'host', 'participant' ), true ) || '' === $viewer_id ) {
			return self::public_view( $state );
		}

		if ( 'host' !== $role ) {
			unset(
				$state['history'],
				$state['scoreLedger'],
				$state['rosterHash'],
				$state['sourceRosterHash'],
				$state['internalDiagnostics']
			);
			$state['chatMessages'] = self::filter_chat_for_viewer( $state, $viewer_id );
			$state['spectators'] = array();
		}

		foreach ( (array) ( $state['teams'] ?? array() ) as $team_index => $team ) {
			foreach ( (array) ( $team['students'] ?? array() ) as $student_index => $student ) {
				unset(
					$state['teams'][ $team_index ]['students'][ $student_index ]['email'],
					$state['teams'][ $team_index ]['students'][ $student_index ]['emailHash']
				);
				if ( 'host' !== $role ) {
					unset( $state['teams'][ $team_index ]['students'][ $student_index ]['userId'] );
				}
			}
		}

		$state['viewer'] = array(
			'role' => $role,
			'id'   => $viewer_id,
		);
		$state['currentUserId'] = 'u' === substr( $viewer_id, 0, 1 ) ? (int) substr( $viewer_id, 1 ) : 0;
		unset( $state['publicIdSalt'] );

		return $state;
	}

	/**
	 * Filter private chat to messages the participant may read.
	 *
	 * @param array  $state Full state.
	 * @param string $viewer_id Viewer subject.
	 * @return array
	 */
	private static function filter_chat_for_viewer( $state, $viewer_id ) {
		$team_id = '';
		$active_id = self::key( $state['active']['studentId'] ?? '' );
		foreach ( (array) ( $state['teams'] ?? array() ) as $team ) {
			foreach ( (array) ( $team['students'] ?? array() ) as $student ) {
				if ( self::key( $student['id'] ?? '' ) === $viewer_id ) {
					$team_id = self::key( $team['id'] ?? '' );
					break 2;
				}
			}
		}

		$allowed = array();
		foreach ( (array) ( $state['chatMessages'] ?? array() ) as $message ) {
			if ( ! is_array( $message ) ) {
				continue;
			}
			$target = (string) ( $message['target'] ?? 'all' );
			$from_id = self::key( $message['fromId'] ?? '' );
			$visible = 'all' === $target || $from_id === $viewer_id;
			$visible = $visible || ( 'team:' . $team_id === $target );
			$visible = $visible || ( 'team:mine' === $target && '' !== $team_id );
			$visible = $visible || ( 'student:' . $viewer_id === $target );
			$visible = $visible || ( 'active' === $target && $active_id === $viewer_id );
			if ( $visible ) {
				$allowed[] = $message;
			}
		}

		return array_slice( $allowed, -40 );
	}

	/**
	 * Issue a signed, session-bound viewer ticket.
	 *
	 * @param string $secret Secret derived from WordPress salts.
	 * @param string $subject Internal viewer ID.
	 * @param string $role Viewer role.
	 * @param string $session_id Session ID.
	 * @param int    $ttl_seconds Lifetime.
	 * @return string
	 */
	public static function issue_viewer_ticket( $secret, $subject, $role, $session_id, $ttl_seconds = 43200 ) {
		$subject = self::key( $subject );
		$role = self::key( $role );
		$session_id = self::key( $session_id );
		if ( '' === $secret || '' === $subject || '' === $session_id || ! in_array( $role, array( 'host', 'participant' ), true ) ) {
			return '';
		}

		$payload = array(
			'v'   => self::VIEWER_TICKET_VERSION,
			'sub' => $subject,
			'rol' => $role,
			'sid' => $session_id,
			'exp' => time() + max( 300, min( 86400, (int) $ttl_seconds ) ),
		);
		$encoded = self::base64url_encode( json_encode( $payload ) );
		$signature = self::base64url_encode( hash_hmac( 'sha256', $encoded, $secret, true ) );

		return $encoded . '.' . $signature;
	}

	/**
	 * Verify and decode a viewer ticket.
	 *
	 * @param string $secret Secret derived from WordPress salts.
	 * @param string $ticket Ticket value.
	 * @param string $session_id Expected session ID, when known.
	 * @return array
	 */
	public static function verify_viewer_ticket( $secret, $ticket, $session_id = '' ) {
		$parts = explode( '.', (string) $ticket );
		if ( '' === $secret || 2 !== count( $parts ) ) {
			return array();
		}
		$expected = self::base64url_encode( hash_hmac( 'sha256', $parts[0], $secret, true ) );
		if ( ! hash_equals( $expected, $parts[1] ) ) {
			return array();
		}

		$decoded = self::base64url_decode( $parts[0] );
		$payload = is_string( $decoded ) ? json_decode( $decoded, true ) : array();
		if ( ! is_array( $payload ) || self::VIEWER_TICKET_VERSION !== (int) ( $payload['v'] ?? 0 ) ) {
			return array();
		}
		if ( time() > (int) ( $payload['exp'] ?? 0 ) ) {
			return array();
		}
		$subject = self::key( $payload['sub'] ?? '' );
		$role = self::key( $payload['rol'] ?? '' );
		$ticket_session = self::key( $payload['sid'] ?? '' );
		if ( '' === $subject || '' === $ticket_session || ! in_array( $role, array( 'host', 'participant' ), true ) ) {
			return array();
		}
		if ( '' !== $session_id && ! hash_equals( self::key( $session_id ), $ticket_session ) ) {
			return array();
		}

		return array(
			'id'        => $subject,
			'role'      => $role,
			'sessionId' => $ticket_session,
			'expiresAt' => (int) $payload['exp'],
		);
	}

	/**
	 * Read a JSON snapshot.
	 *
	 * @param string $path Snapshot path.
	 * @return array
	 */
	public static function read_json( $path ) {
		if ( ! is_string( $path ) || '' === $path || ! is_file( $path ) || ! is_readable( $path ) ) {
			return array();
		}
		$raw = file_get_contents( $path );
		$decoded = is_string( $raw ) ? json_decode( $raw, true ) : array();

		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Atomically write JSON with a sibling temporary file.
	 *
	 * @param string $path Snapshot path.
	 * @param mixed  $data JSON data.
	 * @param int    $mode File mode.
	 * @return bool
	 */
	public static function write_json_atomic( $path, $data, $mode = 0640 ) {
		$path = (string) $path;
		if ( '' === $path ) {
			return false;
		}
		$directory = dirname( $path );
		if ( ! is_dir( $directory ) && ! mkdir( $directory, 0750, true ) ) {
			return false;
		}
		$json = json_encode( $data, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			return false;
		}
		try {
			$suffix = bin2hex( random_bytes( 8 ) );
		} catch ( Exception $error ) {
			$suffix = uniqid( '', true );
		}
		$tmp_path = $path . '.tmp.' . preg_replace( '/[^a-zA-Z0-9]/', '', $suffix );
		if ( false === file_put_contents( $tmp_path, $json, LOCK_EX ) ) {
			return false;
		}
		@chmod( $tmp_path, $mode );
		if ( ! rename( $tmp_path, $path ) ) {
			@unlink( $tmp_path );
			return false;
		}

		return true;
	}

	/**
	 * Return an ETag for a state payload. nowMs is deliberately excluded.
	 *
	 * @param mixed $payload Response payload.
	 * @return string
	 */
	public static function etag( $payload ) {
		$payload = is_array( $payload ) ? $payload : array();
		unset( $payload['nowMs'], $payload['diagnostics'] );

		return '"mmed-' . substr( hash( 'sha256', json_encode( $payload, JSON_UNESCAPED_SLASHES ) ), 0, 32 ) . '"';
	}

	/**
	 * Compare state versions using eventSeq first and timestamps only for migration.
	 *
	 * @param mixed $left First state.
	 * @param mixed $right Second state.
	 * @return int
	 */
	public static function compare_states( $left, $right ) {
		$left = is_array( $left ) ? $left : array();
		$right = is_array( $right ) ? $right : array();
		$left_seq = max( 0, (int) ( $left['eventSeq'] ?? 0 ) );
		$right_seq = max( 0, (int) ( $right['eventSeq'] ?? 0 ) );
		if ( $left_seq !== $right_seq ) {
			return $left_seq <=> $right_seq;
		}

		return self::state_timestamp_ms( $left ) <=> self::state_timestamp_ms( $right );
	}

	/**
	 * Return a state timestamp in milliseconds.
	 *
	 * @param mixed $state State.
	 * @return int
	 */
	public static function state_timestamp_ms( $state ) {
		if ( ! is_array( $state ) ) {
			return 0;
		}
		if ( ! empty( $state['snapshotGeneratedAtMs'] ) ) {
			return max( 0, (int) $state['snapshotGeneratedAtMs'] );
		}
		$timestamp = ! empty( $state['updatedAt'] ) ? strtotime( (string) $state['updatedAt'] ) : false;

		return $timestamp ? (int) $timestamp * 1000 : 0;
	}

	/**
	 * Generate a non-enumerable display ID.
	 *
	 * @param string $session_id Session ID.
	 * @param string $internal_id Internal participant ID.
	 * @param string $salt Private random salt retained only in authoritative state.
	 * @return string
	 */
	private static function public_id( $session_id, $internal_id, $salt ) {
		if ( preg_match( '/^p-[a-f0-9]{16}$/', $internal_id ) ) {
			return $internal_id;
		}

		$key = '' !== $salt ? $salt : hash( 'sha256', 'legacy-public-id|' . $session_id );

		return 'p-' . substr( hash_hmac( 'sha256', $session_id . '|' . $internal_id, $key ), 0, 16 );
	}

	/**
	 * Generate a private salt for non-enumerable session display identifiers.
	 *
	 * @return string
	 */
	private static function new_public_id_salt() {
		try {
			return bin2hex( random_bytes( 32 ) );
		} catch ( Exception $error ) {
			return hash( 'sha256', uniqid( 'mmed-live-drills-', true ) . '|' . mt_rand() );
		}
	}

	/**
	 * Convert a name or existing initials to at most two initials.
	 *
	 * @param mixed $value Name value.
	 * @return string
	 */
	private static function initials( $value ) {
		$parts = preg_split( '/\s+/', trim( self::text( $value ) ) );
		$parts = array_values( array_filter( is_array( $parts ) ? $parts : array() ) );
		if ( empty( $parts ) ) {
			return 'ST';
		}
		$first = function_exists( 'mb_substr' ) ? mb_substr( $parts[0], 0, 1 ) : substr( $parts[0], 0, 1 );
		$last_part = 1 < count( $parts ) ? $parts[ count( $parts ) - 1 ] : '';
		$last = '' !== $last_part ? ( function_exists( 'mb_substr' ) ? mb_substr( $last_part, 0, 1 ) : substr( $last_part, 0, 1 ) ) : '';

		return strtoupper( preg_replace( '/[^a-zA-Z0-9]/', '', $first . $last ) ) ?: 'ST';
	}

	/**
	 * Return a generic public event message that cannot contain a person's name.
	 *
	 * @param mixed $type Event type.
	 * @return string
	 */
	private static function public_event_message( $type ) {
		$type = self::key( $type );
		$messages = array(
			'correct'          => 'Correct answer recorded.',
			'missed'           => 'Turn complete. No point added.',
			'undo_score'       => 'The latest score was corrected.',
			'reset'            => 'Scores were reset.',
			'declare_winner'   => 'The host ended the match.',
			'select_student'   => 'The next player is ready.',
			'auto_select_next' => 'The next player is ready.',
			'guest_join'       => 'A player joined the room.',
			'join_in'          => 'A player joined the room.',
			'guest_watch'      => 'A viewer joined the room.',
			'watch'            => 'A viewer joined the room.',
			'session_lifecycle'=> 'Room status updated.',
		);

		return $messages[ $type ] ?? ( '' === $type ? '' : 'Room update received.' );
	}

	/**
	 * Sanitize a scalar key without WordPress.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	private static function key( $value ) {
		return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $value ) );
	}

	/**
	 * Sanitize display text without WordPress.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	private static function text( $value ) {
		$text = strip_tags( (string) $value );

		return trim( preg_replace( '/[\x00-\x1F\x7F]/', '', $text ) );
	}

	/**
	 * Keep CSS colors limited to a hex literal.
	 *
	 * @param mixed $value Color.
	 * @return string
	 */
	private static function safe_color( $value ) {
		$value = trim( (string) $value );

		return preg_match( '/^#[0-9a-fA-F]{3,8}$/', $value ) ? $value : '';
	}

	/**
	 * URL-safe base64 encode.
	 *
	 * @param string $value Raw value.
	 * @return string
	 */
	private static function base64url_encode( $value ) {
		return rtrim( strtr( base64_encode( (string) $value ), '+/', '-_' ), '=' );
	}

	/**
	 * URL-safe base64 decode.
	 *
	 * @param string $value Encoded value.
	 * @return string|false
	 */
	private static function base64url_decode( $value ) {
		$padding = strlen( $value ) % 4;
		if ( $padding ) {
			$value .= str_repeat( '=', 4 - $padding );
		}

		return base64_decode( strtr( $value, '-_', '+/' ), true );
	}
}
