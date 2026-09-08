<?php
/**
 * MissionMed Dr. J drill gamification.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Self-reported, non-punitive drill score tracker for Matrix live sessions.
 */
class MMED_Drill_Game {

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
	 * Create or update drill score table.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_drill_game_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table           = self::table_name();
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			user_id bigint(20) unsigned NOT NULL,
			session_group_id bigint(20) unsigned NOT NULL,
			event_date date NOT NULL,
			questions_attempted int(10) unsigned NOT NULL DEFAULT 0,
			questions_correct int(10) unsigned NOT NULL DEFAULT 0,
			points_earned int(10) unsigned NOT NULL DEFAULT 0,
			current_streak int(10) unsigned NOT NULL DEFAULT 0,
			streak_max int(10) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY unique_user_session_date (user_id, session_group_id, event_date),
			KEY session_date (session_group_id, event_date),
			KEY user_id (user_id)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_drill_game_db_version', self::DB_VERSION, false );
	}

	/**
	 * Return score table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_drill_scores';
	}

	/**
	 * Submit a self-reported drill answer.
	 *
	 * @param int    $user_id          User ID.
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @param bool   $correct          Whether answer was correct.
	 * @return array|WP_Error
	 */
	public static function submit_drill_answer( $user_id, $session_group_id, $event_date, $correct ) {
		global $wpdb;

		self::maybe_install();

		$user_id          = absint( $user_id );
		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$correct          = rest_sanitize_boolean( $correct );

		if ( ! $user_id || ! $session_group_id || ! $event_date ) {
			return new WP_Error( 'mmed_drill_score_invalid', 'User, session group, and event date are required.', array( 'status' => 400 ) );
		}

		if ( ! self::user_can_access_drill_session( $session_group_id, $user_id ) ) {
			return new WP_Error( 'mmed_drill_forbidden', 'You do not have access to this drill session.', array( 'status' => 403 ) );
		}

		$row = self::get_score_row( $user_id, $session_group_id, $event_date );

		$attempted = $row ? (int) $row->questions_attempted : 0;
		$right     = $row ? (int) $row->questions_correct : 0;
		$points    = $row ? (int) $row->points_earned : 0;
		$streak    = $row ? (int) $row->current_streak : 0;
		$max       = $row ? (int) $row->streak_max : 0;

		$attempted++;

		if ( $correct ) {
			$right++;
			$streak++;
			$points += 10;
			if ( 0 === $streak % 5 ) {
				$points += 5;
			}
			$max = max( $max, $streak );
		} else {
			$streak = 0;
		}

		$payload = array(
			'user_id'             => $user_id,
			'session_group_id'    => $session_group_id,
			'event_date'          => $event_date,
			'questions_attempted' => $attempted,
			'questions_correct'   => $right,
			'points_earned'       => $points,
			'current_streak'      => $streak,
			'streak_max'          => $max,
			'updated_at'          => current_time( 'mysql' ),
		);

		if ( $row ) {
			$updated = $wpdb->update(
				self::table_name(),
				$payload,
				array( 'id' => (int) $row->id ),
				self::format_map( $payload ),
				array( '%d' )
			);

			if ( false === $updated ) {
				return new WP_Error( 'mmed_drill_score_update_failed', 'Drill score could not be updated.', array( 'status' => 500 ) );
			}

			return self::format_score( self::get_score_by_id( (int) $row->id ) );
		}

		$payload['created_at'] = current_time( 'mysql' );
		$inserted              = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );

		if ( false === $inserted ) {
			return new WP_Error( 'mmed_drill_score_create_failed', 'Drill score could not be created.', array( 'status' => 500 ) );
		}

		return self::format_score( self::get_score_by_id( (int) $wpdb->insert_id ) );
	}

	/**
	 * Return a session leaderboard.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return array
	 */
	public static function get_drill_leaderboard( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );

		if ( ! $session_group_id || ! $event_date ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE session_group_id = %d AND event_date = %s ORDER BY points_earned DESC, questions_correct DESC, streak_max DESC, updated_at ASC',
				$session_group_id,
				$event_date
			)
		);

		return self::format_leaderboard_rows( $rows );
	}

	/**
	 * Return cumulative leaderboard by drill event type.
	 *
	 * @param string $event_type Event type.
	 * @return array
	 */
	public static function get_cumulative_leaderboard( $event_type ) {
		global $wpdb;

		self::maybe_install();

		$event_type = self::sanitize_event_type( $event_type );
		if ( ! $event_type || ! class_exists( 'MMED_Session_Manager' ) ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT s.user_id, SUM(s.questions_attempted) questions_attempted, SUM(s.questions_correct) questions_correct, SUM(s.points_earned) points_earned, MAX(s.current_streak) current_streak, MAX(s.streak_max) streak_max, MAX(s.updated_at) updated_at FROM ' . self::table_name() . ' s INNER JOIN ' . MMED_Session_Manager::table_name() . ' g ON g.id = s.session_group_id WHERE g.event_type = %s GROUP BY s.user_id ORDER BY points_earned DESC, questions_correct DESC, streak_max DESC, updated_at ASC LIMIT 50',
				$event_type
			)
		);

		return self::format_leaderboard_rows( $rows );
	}

	/**
	 * Return current student drill stats.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	public static function get_student_drill_stats( $user_id ) {
		global $wpdb;

		self::maybe_install();

		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return self::empty_stats();
		}

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT COUNT(*) sessions_attended, SUM(questions_attempted) questions_attempted, SUM(questions_correct) questions_correct, SUM(points_earned) points_earned, MAX(streak_max) streak_max FROM ' . self::table_name() . ' WHERE user_id = %d',
				$user_id
			)
		);

		if ( ! $row ) {
			return self::empty_stats();
		}

		$attempted = (int) $row->questions_attempted;
		$right     = (int) $row->questions_correct;

		return array(
			'drill_sessions_attended'    => (int) $row->sessions_attended,
			'drill_questions_attempted'  => $attempted,
			'drill_questions_correct'    => $right,
			'drill_accuracy'             => $attempted > 0 ? (int) round( ( $right / $attempted ) * 100 ) : 0,
			'drill_points_earned'        => (int) $row->points_earned,
			'drill_max_streak'           => (int) $row->streak_max,
		);
	}

	/**
	 * Determine whether a user can access a drill session.
	 *
	 * @param int $session_group_id Session group ID.
	 * @param int $user_id          User ID.
	 * @return bool
	 */
	public static function user_can_access_drill_session( $session_group_id, $user_id ) {
		if ( class_exists( 'MMED_Arena_Live' ) ) {
			return MMED_Arena_Live::user_can_access_session_group( $session_group_id, $user_id );
		}

		return current_user_can( 'manage_options' );
	}

	/**
	 * Format one score row.
	 *
	 * @param object|null $row Score row.
	 * @return array
	 */
	public static function format_score( $row ) {
		if ( ! $row ) {
			return array();
		}

		$user      = get_user_by( 'id', (int) $row->user_id );
		$attempted = (int) $row->questions_attempted;
		$right     = (int) $row->questions_correct;

		return array(
			'id'                   => isset( $row->id ) ? (int) $row->id : 0,
			'user_id'              => (int) $row->user_id,
			'display_name'         => $user ? $user->display_name : 'Student',
			'session_group_id'     => isset( $row->session_group_id ) ? (int) $row->session_group_id : 0,
			'event_date'           => isset( $row->event_date ) ? (string) $row->event_date : '',
			'questions_attempted'  => $attempted,
			'questions_correct'    => $right,
			'accuracy'             => $attempted > 0 ? (int) round( ( $right / $attempted ) * 100 ) : 0,
			'points_earned'        => (int) $row->points_earned,
			'current_streak'       => (int) $row->current_streak,
			'streak_max'           => (int) $row->streak_max,
			'created_at'           => isset( $row->created_at ) ? (string) $row->created_at : '',
			'updated_at'           => isset( $row->updated_at ) ? (string) $row->updated_at : '',
		);
	}

	/**
	 * Return score row by natural key.
	 *
	 * @param int    $user_id          User ID.
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Event date.
	 * @return object|null
	 */
	private static function get_score_row( $user_id, $session_group_id, $event_date ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE user_id = %d AND session_group_id = %d AND event_date = %s LIMIT 1',
				absint( $user_id ),
				absint( $session_group_id ),
				self::sanitize_date( $event_date )
			)
		);
	}

	/**
	 * Return score row by ID.
	 *
	 * @param int $id Score ID.
	 * @return object|null
	 */
	private static function get_score_by_id( $id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d LIMIT 1',
				absint( $id )
			)
		);
	}

	/**
	 * Format leaderboard rows with rank.
	 *
	 * @param array $rows Rows.
	 * @return array
	 */
	private static function format_leaderboard_rows( $rows ) {
		$rank  = 1;
		$items = array();

		foreach ( is_array( $rows ) ? $rows : array() as $row ) {
			$item         = self::format_score( $row );
			$item['rank'] = $rank;
			$items[]      = $item;
			$rank++;
		}

		return $items;
	}

	/**
	 * Empty stat payload.
	 *
	 * @return array
	 */
	private static function empty_stats() {
		return array(
			'drill_sessions_attended'   => 0,
			'drill_questions_attempted' => 0,
			'drill_questions_correct'   => 0,
			'drill_accuracy'            => 0,
			'drill_points_earned'       => 0,
			'drill_max_streak'          => 0,
		);
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
	 * Sanitize supported event type.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_event_type( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, array( 'drill_step1', 'drill_step23' ), true ) ? $value : '';
	}

	/**
	 * wpdb format map.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();

		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array(
				$key,
				array( 'id', 'user_id', 'session_group_id', 'questions_attempted', 'questions_correct', 'points_earned', 'current_streak', 'streak_max' ),
				true
			) ? '%d' : '%s';
		}

		return $formats;
	}
}
