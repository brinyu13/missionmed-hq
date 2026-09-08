<?php
/**
 * MissionMed session reminder scheduling.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Sends email reminders for upcoming live session occurrences.
 */
class MMED_Session_Reminders {

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		add_action( 'mmed_session_reminder_1h', array( __CLASS__, 'send_reminder' ), 10, 3 );
		add_action( 'mmed_session_reminder_15m', array( __CLASS__, 'send_reminder' ), 10, 3 );
		add_action( 'mmed_session_group_saved', array( __CLASS__, 'schedule_reminders' ), 30, 1 );
		add_action( 'mmed_session_group_deactivated', array( __CLASS__, 'cancel_reminders' ), 10, 1 );
	}

	/**
	 * No custom table is needed.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		return;
	}

	/**
	 * Schedule reminders for upcoming occurrences.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return int Number scheduled.
	 */
	public static function schedule_reminders( $session_group_id ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_reminders' ) ) {
			return 0;
		}

		$group = self::get_group( $session_group_id );
		if ( ! $group || empty( $group->is_active ) || empty( $group->reminders_enabled ) ) {
			return 0;
		}

		$scheduled = 0;
		$dates     = self::get_weekly_dates( $group->day_of_week, $group->recurrence_start, $group->recurrence_end );

		foreach ( $dates as $date ) {
			$start_ts = strtotime( $date . ' ' . $group->start_time );
			if ( ! $start_ts || $start_ts <= time() ) {
				continue;
			}

			$scheduled += self::schedule_single( $session_group_id, $date, '1h', $start_ts - HOUR_IN_SECONDS );
			$scheduled += self::schedule_single( $session_group_id, $date, '15m', $start_ts - 15 * MINUTE_IN_SECONDS );
		}

		return $scheduled;
	}

	/**
	 * Send one reminder type for one occurrence.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $occurrence_date  Occurrence date.
	 * @param string $type             Reminder type.
	 * @return int Number sent.
	 */
	public static function send_reminder( $session_group_id, $occurrence_date, $type ) {
		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'session_reminders' ) ) {
			return 0;
		}

		$group = self::get_group( $session_group_id );
		if ( ! $group || empty( $group->reminders_enabled ) || ! class_exists( 'MMED_Session_Manager' ) ) {
			return 0;
		}

		$type = sanitize_key( $type );
		if ( ! in_array( $type, array( '1h', '15m' ), true ) ) {
			return 0;
		}

		$students = MMED_Session_Manager::get_enrolled_students( $group->enrollment_template );
		$sent     = 0;
		$subject  = sprintf(
			'[MissionMed] %1$s starts in %2$s',
			$group->group_name,
			'1h' === $type ? '1 hour' : '15 minutes'
		);

		foreach ( $students as $student ) {
			$prefs = self::get_user_preferences( $student->ID );
			if ( empty( $prefs[ 'email_' . $type ] ) ) {
				continue;
			}

			$event_id = self::find_event_id( $student->ID, $session_group_id, $occurrence_date );
			if ( ! $event_id ) {
				continue;
			}

			$start_ts = strtotime( $occurrence_date . ' ' . $group->start_time );
			$time     = $start_ts ? date_i18n( 'l, F j, Y g:i A T', $start_ts ) : $occurrence_date;
			$link     = 'https://missionmedinstitute.com/hub/#/live-session/' . absint( $event_id );
			$body     = self::render_email_body( $group, $student, $time, $link );

			$headers = array( 'Content-Type: text/html; charset=UTF-8' );
			if ( wp_mail( $student->user_email, $subject, $body, $headers ) ) {
				$sent++;
			}
		}

		return $sent;
	}

	/**
	 * Cancel future reminders for a group.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return int Number unscheduled.
	 */
	public static function cancel_reminders( $session_group_id ) {
		$group = self::get_group( $session_group_id );
		if ( ! $group ) {
			return 0;
		}

		$removed = 0;
		$dates   = self::get_weekly_dates( $group->day_of_week, $group->recurrence_start, $group->recurrence_end );

		foreach ( $dates as $date ) {
			foreach ( array( '1h', '15m' ) as $type ) {
				$hook = '1h' === $type ? 'mmed_session_reminder_1h' : 'mmed_session_reminder_15m';
				$args = array( absint( $session_group_id ), $date, $type );
				$next = wp_next_scheduled( $hook, $args );

				if ( $next ) {
					wp_unschedule_event( $next, $hook, $args );
					$removed++;
				}
			}
		}

		return $removed;
	}

	/**
	 * REST: enable or disable reminders for a group.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_toggle_group( $request ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Session_Manager' ) ) {
			return new WP_Error( 'mmed_sessions_missing', 'Session manager is unavailable.', array( 'status' => 500 ) );
		}

		$group_id = absint( $request['id'] );
		$group    = MMED_Session_Manager::get_group_by_id( $group_id );

		if ( ! $group ) {
			return new WP_Error( 'mmed_session_not_found', 'Session group not found.', array( 'status' => 404 ) );
		}

		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}
		$enabled = rest_sanitize_boolean( is_array( $payload ) ? ( $payload['enabled'] ?? false ) : false );

		$wpdb->update(
			MMED_Session_Manager::table_name(),
			array(
				'reminders_enabled' => $enabled ? 1 : 0,
				'updated_at'        => current_time( 'mysql' ),
			),
			array( 'id' => $group_id ),
			array( '%d', '%s' ),
			array( '%d' )
		);

		if ( $enabled ) {
			self::schedule_reminders( $group_id );
		} else {
			self::cancel_reminders( $group_id );
		}

		return new WP_REST_Response(
			array(
				'id'                => $group_id,
				'reminders_enabled' => $enabled,
			),
			200
		);
	}

	/**
	 * REST: update current user reminder preferences.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_update_preferences( $request ) {
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}
		$payload = is_array( $payload ) ? $payload : array();

		$prefs = array(
			'email_1h'  => rest_sanitize_boolean( $payload['email_1h'] ?? true ),
			'email_15m' => rest_sanitize_boolean( $payload['email_15m'] ?? true ),
		);

		update_user_meta( get_current_user_id(), '_mmed_reminder_prefs', $prefs );

		return new WP_REST_Response( array( 'preferences' => $prefs ), 200 );
	}

	/**
	 * Return user preferences with defaults.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	public static function get_user_preferences( $user_id ) {
		$prefs = get_user_meta( absint( $user_id ), '_mmed_reminder_prefs', true );
		$prefs = is_array( $prefs ) ? $prefs : array();

		return array(
			'email_1h'  => array_key_exists( 'email_1h', $prefs ) ? (bool) $prefs['email_1h'] : true,
			'email_15m' => array_key_exists( 'email_15m', $prefs ) ? (bool) $prefs['email_15m'] : true,
		);
	}

	/**
	 * Render the HTML reminder body.
	 *
	 * @param object  $group   Session group.
	 * @param WP_User $student Student user.
	 * @param string  $time    Formatted time.
	 * @param string  $link    Deep link.
	 * @return string
	 */
	private static function render_email_body( $group, $student, $time, $link ) {
		$instructor = ! empty( $group->instructor_id ) ? get_user_by( 'id', (int) $group->instructor_id ) : null;

		return '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14213d;">'
			. '<p>Hi ' . esc_html( $student->display_name ) . ',</p>'
			. '<p>Your MissionMed session is coming up.</p>'
			. '<p><strong>' . esc_html( $group->group_name ) . '</strong><br>'
			. esc_html( $time ) . '<br>'
			. 'Instructor: ' . esc_html( $instructor ? $instructor->display_name : 'MissionMed Team' ) . '</p>'
			. '<p><a href="' . esc_url( $link ) . '" style="display:inline-block;background:#0e75a8;color:#fff;padding:10px 14px;text-decoration:none;border-radius:4px;">Open Live Session</a></p>'
			. '<p>MissionMed Institute</p>'
			. '</div>';
	}

	/**
	 * Schedule one cron event.
	 *
	 * @param int    $session_group_id Group ID.
	 * @param string $date             Date.
	 * @param string $type             Reminder type.
	 * @param int    $timestamp        Timestamp.
	 * @return int
	 */
	private static function schedule_single( $session_group_id, $date, $type, $timestamp ) {
		if ( $timestamp <= time() ) {
			return 0;
		}

		$hook = '1h' === $type ? 'mmed_session_reminder_1h' : 'mmed_session_reminder_15m';
		$args = array( absint( $session_group_id ), $date, $type );

		if ( wp_next_scheduled( $hook, $args ) ) {
			return 0;
		}

		wp_schedule_single_event( $timestamp, $hook, $args );
		return 1;
	}

	/**
	 * Return a group row.
	 *
	 * @param int $session_group_id Group ID.
	 * @return object|null
	 */
	private static function get_group( $session_group_id ) {
		return class_exists( 'MMED_Session_Manager' ) ? MMED_Session_Manager::get_group_by_id( absint( $session_group_id ) ) : null;
	}

	/**
	 * Find a student's calendar event for a group and date.
	 *
	 * @param int    $user_id          User ID.
	 * @param int    $session_group_id Session group ID.
	 * @param string $date             Date.
	 * @return int
	 */
	private static function find_event_id( $user_id, $session_group_id, $date ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return 0;
		}

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . MMED_Calendar_Engine::table_name() . ' WHERE user_id = %d AND source_group_id = %d AND DATE(start_at) = %s AND status <> %s LIMIT 1',
				absint( $user_id ),
				absint( $session_group_id ),
				sanitize_text_field( $date ),
				'cancelled'
			)
		);
	}

	/**
	 * Generate weekly date strings.
	 *
	 * @param string $day_name Day name.
	 * @param string $start    Start date.
	 * @param string $end      End date.
	 * @return array
	 */
	private static function get_weekly_dates( $day_name, $start, $end ) {
		$day_name = sanitize_text_field( (string) $day_name );
		$start    = sanitize_text_field( (string) $start );
		$end      = sanitize_text_field( (string) $end );

		if ( ! $day_name || ! $start || ! $end ) {
			return array();
		}

		$dates   = array();
		$current = strtotime( 'next ' . $day_name, strtotime( $start ) - DAY_IN_SECONDS );
		$end_ts  = strtotime( $end );

		if ( date( 'l', strtotime( $start ) ) === $day_name ) {
			$current = strtotime( $start );
		}

		while ( $current && $current <= $end_ts ) {
			$dates[] = date( 'Y-m-d', $current );
			$current = strtotime( '+7 days', $current );
		}

		return $dates;
	}
}
