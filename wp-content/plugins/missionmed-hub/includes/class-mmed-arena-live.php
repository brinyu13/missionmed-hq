<?php
/**
 * MissionMed Arena Live Battles.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-authoritative Arena battle engine for Matrix live sessions.
 */
class MMED_Arena_Live {

	const DB_VERSION = '20260519.1';

	/**
	 * Initialize runtime hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Create or update battle tables.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_arena_live_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$battles          = self::battles_table();
		$questions        = self::questions_table();
		$responses        = self::responses_table();
		$charset_collate  = $wpdb->get_charset_collate();

		$sql_battles = "CREATE TABLE {$battles} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			session_group_id bigint(20) unsigned NOT NULL,
			event_date date NOT NULL,
			battle_title varchar(255) NOT NULL DEFAULT '',
			battle_format varchar(40) NOT NULL DEFAULT 'lightning',
			status varchar(30) NOT NULL DEFAULT 'draft',
			question_count int(10) unsigned NOT NULL DEFAULT 0,
			time_per_question_seconds int(10) unsigned NOT NULL DEFAULT 30,
			current_question_index int NOT NULL DEFAULT -1,
			current_question_started_at datetime NULL,
			started_at datetime NULL,
			ended_at datetime NULL,
			created_by bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NULL,
			PRIMARY KEY  (id),
			KEY session_date (session_group_id, event_date),
			KEY status (status)
		) {$charset_collate};";

		$sql_questions = "CREATE TABLE {$questions} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			battle_id bigint(20) unsigned NOT NULL,
			question_index int(10) unsigned NOT NULL DEFAULT 0,
			question_text longtext NOT NULL,
			question_type varchar(40) NOT NULL DEFAULT 'mcq',
			options_json longtext NULL,
			correct_answer text NULL,
			explanation longtext NULL,
			points int(10) unsigned NOT NULL DEFAULT 100,
			time_limit_override int(10) unsigned NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			KEY battle_order (battle_id, question_index)
		) {$charset_collate};";

		$sql_responses = "CREATE TABLE {$responses} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			battle_id bigint(20) unsigned NOT NULL,
			question_id bigint(20) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			answer longtext NOT NULL,
			is_correct tinyint(1) NOT NULL DEFAULT 0,
			points_earned int(10) unsigned NOT NULL DEFAULT 0,
			response_time_ms int(10) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY unique_response_per_question (battle_id, question_id, user_id),
			KEY battle_user (battle_id, user_id)
		) {$charset_collate};";

		dbDelta( $sql_battles );
		dbDelta( $sql_questions );
		dbDelta( $sql_responses );

		update_option( 'mmed_arena_live_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return battle table name.
	 *
	 * @return string
	 */
	public static function battles_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_arena_battles';
	}

	/**
	 * Return question table name.
	 *
	 * @return string
	 */
	public static function questions_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_arena_battle_questions';
	}

	/**
	 * Return response table name.
	 *
	 * @return string
	 */
	public static function responses_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_arena_battle_responses';
	}

	/**
	 * Create a battle.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param string $format           Battle format.
	 * @param array  $data             Battle payload.
	 * @return array|WP_Error
	 */
	public static function create_battle( $session_group_id, $event_date, $format, $data ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$format           = self::sanitize_battle_format( $format );
		$data             = is_array( $data ) ? $data : array();

		if ( ! $session_group_id || ! $event_date || ! $format ) {
			return new WP_Error( 'mmed_arena_battle_invalid', 'Session group, event date, and battle format are required.', array( 'status' => 400 ) );
		}

		if ( ! self::session_group_exists( $session_group_id ) ) {
			return new WP_Error( 'mmed_arena_session_missing', 'Session group not found.', array( 'status' => 404 ) );
		}

		$payload = array(
			'session_group_id'           => $session_group_id,
			'event_date'                 => $event_date,
			'battle_title'               => sanitize_text_field( $data['battle_title'] ?? $data['title'] ?? '' ),
			'battle_format'              => $format,
			'status'                     => 'draft',
			'question_count'             => 0,
			'time_per_question_seconds'  => self::sanitize_positive_int( $data['time_per_question_seconds'] ?? 30, 30, 5, 600 ),
			'current_question_index'     => -1,
			'current_question_started_at' => null,
			'started_at'                 => null,
			'ended_at'                   => null,
			'created_by'                 => absint( $data['created_by'] ?? get_current_user_id() ),
			'created_at'                 => current_time( 'mysql' ),
			'updated_at'                 => current_time( 'mysql' ),
		);

		if ( '' === $payload['battle_title'] ) {
			$payload['battle_title'] = 'Arena Battle';
		}

		$inserted = $wpdb->insert(
			self::battles_table(),
			$payload,
			array( '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%d', '%s', '%s', '%s', '%d', '%s', '%s' )
		);

		if ( false === $inserted ) {
			return new WP_Error( 'mmed_arena_battle_create_failed', 'Battle could not be created.', array( 'status' => 500 ) );
		}

		$battle_id = (int) $wpdb->insert_id;

		if ( ! empty( $data['questions'] ) && is_array( $data['questions'] ) ) {
			$result = self::add_questions( $battle_id, $data['questions'] );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		return self::format_battle( self::get_battle_row( $battle_id ) );
	}

	/**
	 * Add sanitized questions to a battle.
	 *
	 * @param int   $battle_id       Battle ID.
	 * @param array $questions_array Questions.
	 * @return array|WP_Error
	 */
	public static function add_questions( $battle_id, $questions_array ) {
		global $wpdb;

		self::maybe_install();

		$battle_id       = absint( $battle_id );
		$questions_array = is_array( $questions_array ) ? $questions_array : array();
		$battle          = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return new WP_Error( 'mmed_arena_battle_not_found', 'Battle not found.', array( 'status' => 404 ) );
		}

		if ( 'completed' === $battle->status ) {
			return new WP_Error( 'mmed_arena_battle_locked', 'Completed battles cannot be edited.', array( 'status' => 400 ) );
		}

		$created = array();
		$index   = self::next_question_index( $battle_id );

		foreach ( $questions_array as $question ) {
			$question = is_array( $question ) ? $question : array();
			$text     = wp_kses_post( $question['question_text'] ?? $question['text'] ?? '' );
			$type     = self::sanitize_question_type( $question['question_type'] ?? $question['type'] ?? 'mcq' );

			if ( '' === trim( wp_strip_all_tags( $text ) ) ) {
				continue;
			}

			$options = null;
			if ( 'mcq' === $type ) {
				$options = self::sanitize_options( $question['options'] ?? $question['options_json'] ?? array() );
				if ( empty( $options ) ) {
					return new WP_Error( 'mmed_arena_question_options_required', 'MCQ questions require answer options.', array( 'status' => 400 ) );
				}
			}

			$correct_answer = self::sanitize_correct_answer( $type, $question['correct_answer'] ?? '' );
			$explanation    = wp_kses_post( $question['explanation'] ?? '' );
			$points         = self::sanitize_positive_int( $question['points'] ?? 100, 100, 0, 10000 );
			$override       = isset( $question['time_limit_override'] ) && '' !== $question['time_limit_override']
				? self::sanitize_positive_int( $question['time_limit_override'], 0, 5, 600 )
				: null;

			$payload = array(
				'battle_id'           => $battle_id,
				'question_index'      => $index,
				'question_text'       => $text,
				'question_type'       => $type,
				'options_json'        => $options ? wp_json_encode( $options ) : null,
				'correct_answer'      => $correct_answer,
				'explanation'         => $explanation,
				'points'              => $points,
				'time_limit_override' => $override,
				'created_at'          => current_time( 'mysql' ),
			);

			$inserted = $wpdb->insert(
				self::questions_table(),
				$payload,
				array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s' )
			);

			if ( false === $inserted ) {
				return new WP_Error( 'mmed_arena_question_create_failed', 'Question could not be created.', array( 'status' => 500 ) );
			}

			$created[] = self::format_question( self::get_question_row( (int) $wpdb->insert_id ), true );
			$index++;
		}

		self::sync_question_count( $battle_id );

		return array(
			'battle_id' => $battle_id,
			'questions' => $created,
		);
	}

	/**
	 * Start a battle.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array|WP_Error
	 */
	public static function start_battle( $battle_id ) {
		global $wpdb;

		self::maybe_install();

		$battle_id = absint( $battle_id );
		$battle    = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return new WP_Error( 'mmed_arena_battle_not_found', 'Battle not found.', array( 'status' => 404 ) );
		}

		self::sync_question_count( $battle_id );
		$battle = self::get_battle_row( $battle_id );

		if ( empty( $battle->question_count ) ) {
			return new WP_Error( 'mmed_arena_battle_no_questions', 'Add questions before starting this battle.', array( 'status' => 400 ) );
		}

		$updated = $wpdb->update(
			self::battles_table(),
			array(
				'status'                     => 'active',
				'started_at'                 => current_time( 'mysql' ),
				'ended_at'                   => null,
				'current_question_index'     => -1,
				'current_question_started_at' => null,
				'updated_at'                 => current_time( 'mysql' ),
			),
			array( 'id' => $battle_id ),
			array( '%s', '%s', '%s', '%d', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_arena_battle_start_failed', 'Battle could not be started.', array( 'status' => 500 ) );
		}

		return self::format_battle( self::get_battle_row( $battle_id ) );
	}

	/**
	 * Advance to the next question.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array|WP_Error
	 */
	public static function advance_question( $battle_id ) {
		global $wpdb;

		self::maybe_install();

		$battle_id = absint( $battle_id );
		$battle    = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return new WP_Error( 'mmed_arena_battle_not_found', 'Battle not found.', array( 'status' => 404 ) );
		}

		if ( 'active' !== $battle->status ) {
			return new WP_Error( 'mmed_arena_battle_not_active', 'Battle must be active before advancing.', array( 'status' => 400 ) );
		}

		self::sync_question_count( $battle_id );
		$battle     = self::get_battle_row( $battle_id );
		$next_index = (int) $battle->current_question_index + 1;

		if ( $next_index >= (int) $battle->question_count ) {
			return new WP_Error( 'mmed_arena_battle_complete', 'No more questions are available.', array( 'status' => 400 ) );
		}

		$updated = $wpdb->update(
			self::battles_table(),
			array(
				'current_question_index'      => $next_index,
				'current_question_started_at' => current_time( 'mysql' ),
				'updated_at'                  => current_time( 'mysql' ),
			),
			array( 'id' => $battle_id ),
			array( '%d', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_arena_question_advance_failed', 'Battle question could not be advanced.', array( 'status' => 500 ) );
		}

		return self::get_current_state( $battle_id, 0 );
	}

	/**
	 * Submit one student response.
	 *
	 * @param int    $battle_id        Battle ID.
	 * @param int    $question_id      Question ID.
	 * @param int    $user_id          User ID.
	 * @param string $answer           Answer.
	 * @param int    $response_time_ms Client display response time.
	 * @return array|WP_Error
	 */
	public static function submit_response( $battle_id, $question_id, $user_id, $answer, $response_time_ms = 0 ) {
		global $wpdb;

		self::maybe_install();

		$battle_id        = absint( $battle_id );
		$question_id      = absint( $question_id );
		$user_id          = absint( $user_id );
		$response_time_ms = min( 3600000, max( 0, absint( $response_time_ms ) ) );
		$answer           = sanitize_textarea_field( (string) $answer );
		$battle           = self::get_battle_row( $battle_id );
		$question         = self::get_question_row( $question_id );

		if ( ! $battle || ! $question || (int) $question->battle_id !== $battle_id ) {
			return new WP_Error( 'mmed_arena_response_invalid', 'Battle question is invalid.', array( 'status' => 400 ) );
		}

		if ( ! $user_id || ! self::user_can_access_battle( $battle_id, $user_id ) ) {
			return new WP_Error( 'mmed_arena_battle_forbidden', 'You do not have access to this battle.', array( 'status' => 403 ) );
		}

		if ( 'active' !== $battle->status ) {
			return new WP_Error( 'mmed_arena_battle_not_active', 'This battle is not accepting answers.', array( 'status' => 400 ) );
		}

		if ( (int) $question->question_index !== (int) $battle->current_question_index ) {
			return new WP_Error( 'mmed_arena_wrong_question', 'This question is not active.', array( 'status' => 409 ) );
		}

		$existing = self::get_response_row( $battle_id, $question_id, $user_id );
		if ( $existing ) {
			return array(
				'duplicate' => true,
				'response'  => self::format_response( $existing ),
				'state'     => self::get_current_state( $battle_id, $user_id ),
			);
		}

		$time_remaining = self::time_remaining_for_question( $battle, $question );
		if ( $time_remaining <= 0 ) {
			return new WP_Error( 'mmed_arena_time_expired', 'Time has expired for this question.', array( 'status' => 409 ) );
		}

		$score = self::calculate_score( $battle, $question, $answer, $response_time_ms );

		$inserted = $wpdb->insert(
			self::responses_table(),
			array(
				'battle_id'        => $battle_id,
				'question_id'      => $question_id,
				'user_id'          => $user_id,
				'answer'           => $answer,
				'is_correct'       => ! empty( $score['is_correct'] ) ? 1 : 0,
				'points_earned'    => absint( $score['points_earned'] ?? 0 ),
				'response_time_ms' => $response_time_ms,
				'created_at'       => current_time( 'mysql' ),
			),
			array( '%d', '%d', '%d', '%s', '%d', '%d', '%d', '%s' )
		);

		if ( false === $inserted ) {
			$existing = self::get_response_row( $battle_id, $question_id, $user_id );
			if ( $existing ) {
				return array(
					'duplicate' => true,
					'response'  => self::format_response( $existing ),
					'state'     => self::get_current_state( $battle_id, $user_id ),
				);
			}

			return new WP_Error( 'mmed_arena_response_create_failed', 'Response could not be saved.', array( 'status' => 500 ) );
		}

		return array(
			'duplicate' => false,
			'response'  => self::format_response( self::get_response_row( $battle_id, $question_id, $user_id ) ),
			'state'     => self::get_current_state( $battle_id, $user_id ),
		);
	}

	/**
	 * Return leaderboard rows.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array
	 */
	public static function get_leaderboard( $battle_id ) {
		global $wpdb;

		self::maybe_install();

		$battle_id = absint( $battle_id );
		if ( ! $battle_id ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT user_id, COUNT(*) response_count, SUM(points_earned) total_points, SUM(is_correct) correct_count, AVG(response_time_ms) avg_response_time FROM ' . self::responses_table() . ' WHERE battle_id = %d GROUP BY user_id ORDER BY total_points DESC, avg_response_time ASC, user_id ASC',
				$battle_id
			)
		);

		$rank        = 1;
		$leaderboard = array();

		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$user = get_user_by( 'id', (int) $row->user_id );
			$leaderboard[] = array(
				'rank'              => $rank,
				'user_id'           => (int) $row->user_id,
				'display_name'      => $user ? $user->display_name : 'Student',
				'total_points'      => (int) $row->total_points,
				'response_count'    => (int) $row->response_count,
				'correct_count'     => (int) $row->correct_count,
				'avg_response_time' => (int) round( (float) $row->avg_response_time ),
			);
			$rank++;
		}

		return $leaderboard;
	}

	/**
	 * End a battle and award match points.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array|WP_Error
	 */
	public static function end_battle( $battle_id ) {
		global $wpdb;

		self::maybe_install();

		$battle_id = absint( $battle_id );
		$battle    = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return new WP_Error( 'mmed_arena_battle_not_found', 'Battle not found.', array( 'status' => 404 ) );
		}

		$updated = $wpdb->update(
			self::battles_table(),
			array(
				'status'     => 'completed',
				'ended_at'   => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $battle_id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_arena_battle_end_failed', 'Battle could not be ended.', array( 'status' => 500 ) );
		}

		$awards = self::award_match_points( $battle_id );
		$results = self::get_results( $battle_id );
		$results['match_point_awards'] = $awards;

		return $results;
	}

	/**
	 * Return current battle state.
	 *
	 * @param int $battle_id Battle ID.
	 * @param int $user_id   Optional user ID.
	 * @return array|WP_Error
	 */
	public static function get_current_state( $battle_id, $user_id = 0 ) {
		global $wpdb;

		self::maybe_install();

		$battle_id = absint( $battle_id );
		$user_id   = absint( $user_id );
		$battle    = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return new WP_Error( 'mmed_arena_battle_not_found', 'Battle not found.', array( 'status' => 404 ) );
		}

		if ( $user_id && ! self::user_can_access_battle( $battle_id, $user_id ) ) {
			return new WP_Error( 'mmed_arena_battle_forbidden', 'You do not have access to this battle.', array( 'status' => 403 ) );
		}

		$current_question = self::get_question_for_index( $battle_id, (int) $battle->current_question_index );
		$current_response = $current_question && $user_id ? self::get_response_row( $battle_id, (int) $current_question->id, $user_id ) : null;
		$completed        = 'completed' === $battle->status;
		$include_answer   = $completed || ( $current_response && $user_id );
		$leaderboard      = self::get_leaderboard( $battle_id );

		$participant_count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(DISTINCT user_id) FROM ' . self::responses_table() . ' WHERE battle_id = %d',
				$battle_id
			)
		);

		$state = array(
			'battle'            => self::format_battle( $battle ),
			'current_question'  => $current_question ? self::format_question( $current_question, $include_answer ) : null,
			'current_response'  => $current_response ? self::format_response( $current_response ) : null,
			'time_remaining'    => $current_question ? self::time_remaining_for_question( $battle, $current_question ) : 0,
			'leaderboard'       => $leaderboard,
			'participant_count' => $participant_count,
			'current_score'     => $user_id ? self::get_user_score( $battle_id, $user_id ) : 0,
			'user_rank'         => $user_id ? self::rank_for_user( $leaderboard, $user_id ) : 0,
			'server_time'       => current_time( 'mysql' ),
		);

		if ( $completed ) {
			$state['results'] = self::get_results( $battle_id );
		}

		return $state;
	}

	/**
	 * Return completed battle results.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array
	 */
	public static function get_results( $battle_id ) {
		$battle_id = absint( $battle_id );
		$battle    = self::get_battle_row( $battle_id );

		if ( ! $battle ) {
			return array(
				'battle'      => array(),
				'questions'   => array(),
				'leaderboard' => array(),
			);
		}

		$questions = array_map(
			static function ( $row ) {
				return self::format_question( $row, true );
			},
			self::get_question_rows( $battle_id )
		);

		return array(
			'battle'      => self::format_battle( $battle ),
			'questions'   => $questions,
			'leaderboard' => self::get_leaderboard( $battle_id ),
		);
	}

	/**
	 * List battles by session group and optional date.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $date             Optional date.
	 * @return array
	 */
	public static function list_battles( $session_group_id, $date = '' ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$date             = self::sanitize_date( $date );

		if ( $session_group_id && $date ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM ' . self::battles_table() . ' WHERE session_group_id = %d AND event_date = %s ORDER BY event_date DESC, id DESC',
					$session_group_id,
					$date
				)
			);
		} elseif ( $session_group_id ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM ' . self::battles_table() . ' WHERE session_group_id = %d ORDER BY event_date DESC, id DESC LIMIT 100',
					$session_group_id
				)
			);
		} else {
			$rows = $wpdb->get_results( 'SELECT * FROM ' . self::battles_table() . ' ORDER BY event_date DESC, id DESC LIMIT 100' );
		}

		return array_map( array( __CLASS__, 'format_battle' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Return active battles available to a user.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	public static function get_active_for_user( $user_id ) {
		global $wpdb;

		self::maybe_install();

		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::battles_table() . ' WHERE status IN (%s, %s) ORDER BY started_at DESC, id DESC LIMIT 50',
				'lobby',
				'active'
			)
		);

		$battles = array();
		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			if ( self::user_can_access_session_group( (int) $row->session_group_id, $user_id ) ) {
				$battles[] = self::format_battle( $row );
			}
		}

		return $battles;
	}

	/**
	 * Determine whether a user can access a battle.
	 *
	 * @param int $battle_id Battle ID.
	 * @param int $user_id   User ID.
	 * @return bool
	 */
	public static function user_can_access_battle( $battle_id, $user_id ) {
		$battle = self::get_battle_row( absint( $battle_id ) );
		if ( ! $battle ) {
			return false;
		}

		return self::user_can_access_session_group( (int) $battle->session_group_id, $user_id );
	}

	/**
	 * Determine whether a user can access a session group.
	 *
	 * @param int $session_group_id Session group ID.
	 * @param int $user_id          User ID.
	 * @return bool
	 */
	public static function user_can_access_session_group( $session_group_id, $user_id ) {
		global $wpdb;

		$session_group_id = absint( $session_group_id );
		$user_id          = absint( $user_id );

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( ! $session_group_id || ! $user_id || ! class_exists( 'MMED_Session_Manager' ) ) {
			return false;
		}

		$group = MMED_Session_Manager::get_group_by_id( $session_group_id );
		if ( ! $group ) {
			return false;
		}

		if ( class_exists( 'MMED_Calendar_Engine' ) ) {
			$has_event = (bool) $wpdb->get_var(
				$wpdb->prepare(
					'SELECT id FROM ' . MMED_Calendar_Engine::table_name() . ' WHERE user_id = %d AND source_group_id = %d AND status <> %s LIMIT 1',
					$user_id,
					$session_group_id,
					'cancelled'
				)
			);

			if ( $has_event ) {
				return true;
			}
		}

		$students = MMED_Session_Manager::get_enrolled_students( $group->enrollment_template );
		foreach ( $students as $student ) {
			if ( (int) $student->ID === $user_id ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Calculate score for one answer.
	 *
	 * @param object $battle           Battle row.
	 * @param object $question         Question row.
	 * @param string $answer           Answer.
	 * @param int    $response_time_ms Response time.
	 * @return array
	 */
	public static function calculate_score( $battle, $question, $answer, $response_time_ms ) {
		$type             = (string) $question->question_type;
		$answer           = sanitize_textarea_field( (string) $answer );
		$correct_answer   = sanitize_textarea_field( (string) $question->correct_answer );
		$response_time_ms = max( 0, absint( $response_time_ms ) );
		$is_correct       = false;

		if ( 'mcq' === $type ) {
			$is_correct = (string) $answer === (string) $correct_answer;
		} elseif ( 'free_response' === $type && '' !== $correct_answer ) {
			$is_correct = self::normalize_answer( $answer ) === self::normalize_answer( $correct_answer );
		}

		$points = 0;
		if ( $is_correct ) {
			$base   = absint( $question->points );
			$points = max( 10, $base - (int) floor( $response_time_ms / 1000 ) );
		}

		return array(
			'is_correct'    => $is_correct,
			'points_earned' => $points,
		);
	}

	/**
	 * Award match points after completion.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array
	 */
	public static function award_match_points( $battle_id ) {
		$leaderboard = self::get_leaderboard( $battle_id );
		$awards      = array();

		foreach ( $leaderboard as $row ) {
			$rank = (int) $row['rank'];
			if ( 1 === $rank ) {
				$points = 50;
			} elseif ( 2 === $rank ) {
				$points = 30;
			} elseif ( 3 === $rank ) {
				$points = 20;
			} else {
				$points = 5;
			}

			$user_id        = (int) $row['user_id'];
			$current_points = absint( get_user_meta( $user_id, '_mmed_arena_match_points', true ) );
			$played         = absint( get_user_meta( $user_id, '_mmed_arena_battles_played', true ) );
			$best_rank      = absint( get_user_meta( $user_id, '_mmed_arena_best_rank', true ) );

			update_user_meta( $user_id, '_mmed_arena_match_points', $current_points + $points );
			update_user_meta( $user_id, '_mmed_arena_battles_played', $played + 1 );
			if ( ! $best_rank || $rank < $best_rank ) {
				update_user_meta( $user_id, '_mmed_arena_best_rank', $rank );
			}

			$awards[] = array(
				'user_id'      => $user_id,
				'rank'         => $rank,
				'match_points' => $points,
				'storage'      => 'user_meta',
			);
		}

		return $awards;
	}

	/**
	 * Format a battle row.
	 *
	 * @param object|null $row Battle row.
	 * @return array
	 */
	public static function format_battle( $row ) {
		if ( ! $row ) {
			return array();
		}

		return array(
			'id'                            => (int) $row->id,
			'session_group_id'              => (int) $row->session_group_id,
			'event_date'                    => (string) $row->event_date,
			'battle_title'                  => (string) $row->battle_title,
			'battle_format'                 => (string) $row->battle_format,
			'status'                        => (string) $row->status,
			'question_count'                => (int) $row->question_count,
			'time_per_question_seconds'     => (int) $row->time_per_question_seconds,
			'current_question_index'        => (int) $row->current_question_index,
			'current_question_started_at'   => $row->current_question_started_at ? (string) $row->current_question_started_at : null,
			'started_at'                    => $row->started_at ? (string) $row->started_at : null,
			'ended_at'                      => $row->ended_at ? (string) $row->ended_at : null,
			'created_by'                    => (int) $row->created_by,
			'created_at'                    => (string) $row->created_at,
			'updated_at'                    => $row->updated_at ? (string) $row->updated_at : null,
		);
	}

	/**
	 * Validate session group existence.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return bool
	 */
	private static function session_group_exists( $session_group_id ) {
		return class_exists( 'MMED_Session_Manager' ) && (bool) MMED_Session_Manager::get_group_by_id( absint( $session_group_id ) );
	}

	/**
	 * Return a battle row.
	 *
	 * @param int $battle_id Battle ID.
	 * @return object|null
	 */
	private static function get_battle_row( $battle_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::battles_table() . ' WHERE id = %d LIMIT 1',
				absint( $battle_id )
			)
		);
	}

	/**
	 * Return one question row.
	 *
	 * @param int $question_id Question ID.
	 * @return object|null
	 */
	private static function get_question_row( $question_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::questions_table() . ' WHERE id = %d LIMIT 1',
				absint( $question_id )
			)
		);
	}

	/**
	 * Return question rows for a battle.
	 *
	 * @param int $battle_id Battle ID.
	 * @return array
	 */
	private static function get_question_rows( $battle_id ) {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::questions_table() . ' WHERE battle_id = %d ORDER BY question_index ASC, id ASC',
				absint( $battle_id )
			)
		);

		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * Return the active question for an index.
	 *
	 * @param int $battle_id Battle ID.
	 * @param int $index     Question index.
	 * @return object|null
	 */
	private static function get_question_for_index( $battle_id, $index ) {
		global $wpdb;

		if ( $index < 0 ) {
			return null;
		}

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::questions_table() . ' WHERE battle_id = %d AND question_index = %d LIMIT 1',
				absint( $battle_id ),
				absint( $index )
			)
		);
	}

	/**
	 * Return an existing response.
	 *
	 * @param int $battle_id   Battle ID.
	 * @param int $question_id Question ID.
	 * @param int $user_id     User ID.
	 * @return object|null
	 */
	private static function get_response_row( $battle_id, $question_id, $user_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::responses_table() . ' WHERE battle_id = %d AND question_id = %d AND user_id = %d LIMIT 1',
				absint( $battle_id ),
				absint( $question_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Format a question row.
	 *
	 * @param object|null $row            Question row.
	 * @param bool        $include_answer Include answer fields.
	 * @return array
	 */
	private static function format_question( $row, $include_answer = false ) {
		if ( ! $row ) {
			return array();
		}

		$options = json_decode( (string) $row->options_json, true );
		$options = is_array( $options ) ? array_values( array_map( 'sanitize_text_field', $options ) ) : array();

		$question = array(
			'id'                  => (int) $row->id,
			'battle_id'           => (int) $row->battle_id,
			'question_index'      => (int) $row->question_index,
			'question_text'       => wp_kses_post( $row->question_text ),
			'question_type'       => (string) $row->question_type,
			'options'             => $options,
			'points'              => (int) $row->points,
			'time_limit_override' => null === $row->time_limit_override ? null : (int) $row->time_limit_override,
		);

		if ( $include_answer ) {
			$question['correct_answer'] = (string) $row->correct_answer;
			$question['explanation']    = wp_kses_post( $row->explanation );
		}

		return $question;
	}

	/**
	 * Format a response row.
	 *
	 * @param object|null $row Response row.
	 * @return array
	 */
	private static function format_response( $row ) {
		if ( ! $row ) {
			return array();
		}

		return array(
			'id'               => (int) $row->id,
			'battle_id'        => (int) $row->battle_id,
			'question_id'      => (int) $row->question_id,
			'user_id'          => (int) $row->user_id,
			'answer'           => (string) $row->answer,
			'is_correct'       => (bool) $row->is_correct,
			'points_earned'    => (int) $row->points_earned,
			'response_time_ms' => (int) $row->response_time_ms,
			'created_at'       => (string) $row->created_at,
		);
	}

	/**
	 * Sync cached question count.
	 *
	 * @param int $battle_id Battle ID.
	 * @return void
	 */
	private static function sync_question_count( $battle_id ) {
		global $wpdb;

		$count = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COUNT(*) FROM ' . self::questions_table() . ' WHERE battle_id = %d',
				absint( $battle_id )
			)
		);

		$wpdb->update(
			self::battles_table(),
			array(
				'question_count' => $count,
				'updated_at'     => current_time( 'mysql' ),
			),
			array( 'id' => absint( $battle_id ) ),
			array( '%d', '%s' ),
			array( '%d' )
		);
	}

	/**
	 * Return next question index for a battle.
	 *
	 * @param int $battle_id Battle ID.
	 * @return int
	 */
	private static function next_question_index( $battle_id ) {
		global $wpdb;

		$max = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT MAX(question_index) FROM ' . self::questions_table() . ' WHERE battle_id = %d',
				absint( $battle_id )
			)
		);

		return null === $max ? 0 : (int) $max + 1;
	}

	/**
	 * Return seconds remaining for the current question.
	 *
	 * @param object $battle   Battle row.
	 * @param object $question Question row.
	 * @return int
	 */
	private static function time_remaining_for_question( $battle, $question ) {
		if ( empty( $battle->current_question_started_at ) || 'active' !== $battle->status ) {
			return 0;
		}

		$limit   = self::question_time_limit( $battle, $question );
		$started = strtotime( (string) $battle->current_question_started_at );
		$elapsed = $started ? max( 0, current_time( 'timestamp' ) - $started ) : $limit;

		return max( 0, $limit - $elapsed );
	}

	/**
	 * Resolve question time limit.
	 *
	 * @param object $battle   Battle row.
	 * @param object $question Question row.
	 * @return int
	 */
	private static function question_time_limit( $battle, $question ) {
		$override = isset( $question->time_limit_override ) ? absint( $question->time_limit_override ) : 0;
		return $override ? $override : max( 5, absint( $battle->time_per_question_seconds ) );
	}

	/**
	 * Return user total score for a battle.
	 *
	 * @param int $battle_id Battle ID.
	 * @param int $user_id   User ID.
	 * @return int
	 */
	private static function get_user_score( $battle_id, $user_id ) {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT COALESCE(SUM(points_earned), 0) FROM ' . self::responses_table() . ' WHERE battle_id = %d AND user_id = %d',
				absint( $battle_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Return rank for a user from leaderboard.
	 *
	 * @param array $leaderboard Leaderboard.
	 * @param int   $user_id     User ID.
	 * @return int
	 */
	private static function rank_for_user( $leaderboard, $user_id ) {
		foreach ( $leaderboard as $row ) {
			if ( (int) $row['user_id'] === absint( $user_id ) ) {
				return (int) $row['rank'];
			}
		}

		return 0;
	}

	/**
	 * Sanitize a date.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitize battle format.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_battle_format( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, self::battle_formats(), true ) ? $value : '';
	}

	/**
	 * Sanitize question type.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_question_type( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, self::question_types(), true ) ? $value : 'mcq';
	}

	/**
	 * Sanitize options.
	 *
	 * @param mixed $options Raw options.
	 * @return array
	 */
	private static function sanitize_options( $options ) {
		if ( is_string( $options ) ) {
			$decoded = json_decode( $options, true );
			$options = is_array( $decoded ) ? $decoded : preg_split( '/\r\n|\r|\n/', $options );
		}

		if ( ! is_array( $options ) ) {
			return array();
		}

		$clean = array();
		foreach ( $options as $option ) {
			$text = sanitize_text_field( $option );
			if ( '' !== $text ) {
				$clean[] = $text;
			}
		}

		return array_slice( $clean, 0, 8 );
	}

	/**
	 * Sanitize correct answer.
	 *
	 * @param string $type  Question type.
	 * @param mixed  $value Raw answer.
	 * @return string
	 */
	private static function sanitize_correct_answer( $type, $value ) {
		$value = sanitize_textarea_field( (string) $value );
		if ( 'mcq' === $type ) {
			return preg_match( '/^\d+$/', $value ) ? (string) absint( $value ) : '';
		}

		if ( 'rating' === $type ) {
			return '';
		}

		return $value;
	}

	/**
	 * Sanitize bounded positive integer.
	 *
	 * @param mixed $value   Raw value.
	 * @param int   $default Default.
	 * @param int   $min     Min.
	 * @param int   $max     Max.
	 * @return int
	 */
	private static function sanitize_positive_int( $value, $default, $min, $max ) {
		$value = absint( $value );
		if ( $value < $min ) {
			return $default;
		}

		return min( $max, $value );
	}

	/**
	 * Normalize free-response answers.
	 *
	 * @param string $value Raw value.
	 * @return string
	 */
	private static function normalize_answer( $value ) {
		$value = strtolower( trim( wp_strip_all_tags( (string) $value ) ) );
		$value = preg_replace( '/\s+/', ' ', $value );

		return $value;
	}

	/**
	 * Supported battle formats.
	 *
	 * @return array
	 */
	private static function battle_formats() {
		return array( 'lightning', 'case_showdown', 'app_review', 'interview_sim', 'weekly_challenge' );
	}

	/**
	 * Supported question types.
	 *
	 * @return array
	 */
	private static function question_types() {
		return array( 'mcq', 'free_response', 'rating' );
	}
}
