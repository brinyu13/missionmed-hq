<?php
/**
 * MissionMed session attendance tracking.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Tracks attendance for Webex-backed session events.
 */
class MMED_Attendance {

	const DB_VERSION = '20260519.1';

	/**
	 * Initialize runtime hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		add_action( 'mmed_sync_attendance', array( __CLASS__, 'cron_sync_attendance' ), 10, 2 );
		add_action( 'mmed_session_group_saved', array( __CLASS__, 'schedule_sync_for_group' ), 20, 1 );
	}

	/**
	 * Return the attendance table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_session_attendance';
	}

	/**
	 * Create or update the attendance table.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_attendance_db_version' ) === self::DB_VERSION ) {
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
			event_id bigint(20) unsigned NOT NULL,
			webex_meeting_id varchar(100) NULL,
			join_time datetime NULL,
			leave_time datetime NULL,
			duration_minutes int DEFAULT 0,
			attendance_status varchar(20) DEFAULT 'absent',
			source varchar(20) DEFAULT 'system',
			created_at datetime DEFAULT CURRENT_TIMESTAMP,
			updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			UNIQUE KEY idx_user_event (user_id, event_id),
			KEY idx_user_date (user_id, join_time),
			KEY idx_group_event (session_group_id, event_id),
			KEY idx_status (attendance_status)
		) {$charset_collate};";

		dbDelta( $sql );
		update_option( 'mmed_attendance_db_version', self::DB_VERSION, false );
	}

	/**
	 * Record or update attendance for one user and event.
	 *
	 * @param int   $user_id          User ID.
	 * @param int   $session_group_id Session group ID.
	 * @param int   $event_id         Calendar event ID.
	 * @param array $data             Attendance data.
	 * @return int|WP_Error
	 */
	public static function record_attendance( $user_id, $session_group_id, $event_id, $data ) {
		global $wpdb;

		self::maybe_install();

		$user_id          = absint( $user_id );
		$session_group_id = absint( $session_group_id );
		$event_id         = absint( $event_id );
		$data             = is_array( $data ) ? $data : array();

		if ( ! $user_id || ! $session_group_id || ! $event_id ) {
			return new WP_Error( 'mmed_attendance_invalid_target', 'Attendance target is invalid.', array( 'status' => 400 ) );
		}

		$event = self::get_event_row( $event_id );
		$join  = self::sanitize_datetime( $data['join_time'] ?? '' );
		$leave = self::sanitize_datetime( $data['leave_time'] ?? '' );

		$duration = absint( $data['duration_minutes'] ?? $data['duration'] ?? 0 );
		if ( ! $duration && $join && $leave ) {
			$duration = max( 0, (int) round( ( strtotime( $leave ) - strtotime( $join ) ) / MINUTE_IN_SECONDS ) );
		}

		$status = self::sanitize_status( $data['attendance_status'] ?? '' );
		if ( '' === $status ) {
			$status = self::derive_status( $event, $join, $leave, $duration );
		}

		$source = self::sanitize_source( $data['source'] ?? 'system' );

		$payload = array(
			'user_id'            => $user_id,
			'session_group_id'   => $session_group_id,
			'event_id'           => $event_id,
			'webex_meeting_id'   => sanitize_text_field( $data['webex_meeting_id'] ?? '' ),
			'join_time'          => $join ?: null,
			'leave_time'         => $leave ?: null,
			'duration_minutes'   => $duration,
			'attendance_status'  => $status,
			'source'             => $source,
			'updated_at'         => current_time( 'mysql' ),
		);

		$existing_id = (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . self::table_name() . ' WHERE user_id = %d AND event_id = %d LIMIT 1',
				$user_id,
				$event_id
			)
		);

		if ( $existing_id ) {
			$updated = $wpdb->update(
				self::table_name(),
				$payload,
				array( 'id' => $existing_id ),
				self::format_map( $payload ),
				array( '%d' )
			);

			if ( false === $updated ) {
				return new WP_Error( 'mmed_attendance_update_failed', 'Attendance could not be updated.', array( 'status' => 500 ) );
			}

			return $existing_id;
		}

		$payload['created_at'] = current_time( 'mysql' );
		$inserted              = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );

		if ( false === $inserted ) {
			return new WP_Error( 'mmed_attendance_create_failed', 'Attendance could not be recorded.', array( 'status' => 500 ) );
		}

		return (int) $wpdb->insert_id;
	}

	/**
	 * Return attendance records for a student.
	 *
	 * @param int    $user_id   User ID.
	 * @param string $date_from Start date.
	 * @param string $date_to   End date.
	 * @return array
	 */
	public static function get_student_attendance( $user_id, $date_from = '', $date_to = '' ) {
		global $wpdb;

		self::maybe_install();

		$user_id   = absint( $user_id );
		$date_from = self::sanitize_date( $date_from );
		$date_to   = self::sanitize_date( $date_to );
		$events    = class_exists( 'MMED_Calendar_Engine' ) ? MMED_Calendar_Engine::table_name() : '';

		if ( ! $user_id || ! $events ) {
			return array();
		}

		$where  = array( 'a.user_id = %d' );
		$values = array( $user_id );

		if ( $date_from ) {
			$where[]  = 'e.start_at >= %s';
			$values[] = $date_from . ' 00:00:00';
		}

		if ( $date_to ) {
			$where[]  = 'e.start_at <= %s';
			$values[] = $date_to . ' 23:59:59';
		}

		$sql  = 'SELECT a.*, e.title, e.start_at, e.end_at, e.meeting_platform FROM ' . self::table_name() . ' a ';
		$sql .= "LEFT JOIN {$events} e ON e.id = a.event_id ";
		$sql .= 'WHERE ' . implode( ' AND ', $where ) . ' ORDER BY e.start_at DESC, a.id DESC';

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return array_map( array( __CLASS__, 'format_record' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Return attendance rows for one session occurrence.
	 *
	 * @param int    $session_group_id Session group ID.
	 * @param string $event_date       Occurrence date.
	 * @return array
	 */
	public static function get_session_attendance( $session_group_id, $event_date ) {
		global $wpdb;

		self::maybe_install();

		$session_group_id = absint( $session_group_id );
		$event_date       = self::sanitize_date( $event_date );
		$group            = class_exists( 'MMED_Session_Manager' ) ? MMED_Session_Manager::get_group_by_id( $session_group_id ) : null;

		if ( ! $session_group_id || ! $event_date || ! $group || ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return array();
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$events       = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$events_table} WHERE source_group_id = %d AND DATE(start_at) = %s",
				$session_group_id,
				$event_date
			)
		);

		$events_by_user = array();
		foreach ( is_array( $events ) ? $events : array() as $event ) {
			$events_by_user[ (int) $event->user_id ] = $event;
		}

		$event_ids = array_map( 'absint', wp_list_pluck( is_array( $events ) ? $events : array(), 'id' ) );
		$records   = array();

		if ( ! empty( $event_ids ) ) {
			$placeholders = implode( ', ', array_fill( 0, count( $event_ids ), '%d' ) );
			$rows         = $wpdb->get_results(
				$wpdb->prepare(
					'SELECT * FROM ' . self::table_name() . " WHERE event_id IN ({$placeholders})",
					$event_ids
				)
			);

			foreach ( is_array( $rows ) ? $rows : array() as $row ) {
				$records[ (int) $row->user_id ] = $row;
			}
		}

		$students = MMED_Session_Manager::get_enrolled_students( $group->enrollment_template );
		$output   = array();

		foreach ( $students as $student ) {
			$user_id = (int) $student->ID;
			$record  = $records[ $user_id ] ?? null;
			$event   = $events_by_user[ $user_id ] ?? null;

			if ( $record ) {
				$item = self::format_record( $record );
			} else {
				$item = array(
					'id'                 => 0,
					'user_id'            => $user_id,
					'session_group_id'   => $session_group_id,
					'event_id'           => $event ? (int) $event->id : 0,
					'attendance_status'  => 'absent',
					'duration_minutes'   => 0,
					'join_time'          => null,
					'leave_time'         => null,
					'source'             => 'system',
				);
			}

			$item['student_name']  = $student->display_name;
			$item['student_email'] = $student->user_email;
			$item['event_date']    = $event_date;
			$output[]              = $item;
		}

		return $output;
	}

	/**
	 * Calculate attendance rate for a student and template.
	 *
	 * @param int    $user_id  User ID.
	 * @param string $template Template slug.
	 * @return int
	 */
	public static function get_attendance_rate( $user_id, $template = '' ) {
		$stats = self::get_stats_for_user( $user_id, $template );
		return (int) $stats['attendance_rate'];
	}

	/**
	 * Return student attendance stats.
	 *
	 * @param int    $user_id  User ID.
	 * @param string $template Optional template slug.
	 * @return array
	 */
	public static function get_stats_for_user( $user_id, $template = '' ) {
		global $wpdb;

		self::maybe_install();

		$user_id = absint( $user_id );
		if ( ! $user_id || ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return self::empty_stats();
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$where        = array(
			'e.user_id = %d',
			'e.source_group_id > 0',
			'e.start_at <= %s',
			"e.status <> 'cancelled'",
		);
		$values       = array( $user_id, current_time( 'mysql' ) );

		$group_ids = self::group_ids_for_template( $template );
		if ( ! empty( $group_ids ) ) {
			$placeholders = implode( ', ', array_fill( 0, count( $group_ids ), '%d' ) );
			$where[]      = "e.source_group_id IN ({$placeholders})";
			$values       = array_merge( $values, $group_ids );
		}

		$total_sql = "SELECT COUNT(*) FROM {$events_table} e WHERE " . implode( ' AND ', $where );
		$total     = (int) $wpdb->get_var( $wpdb->prepare( $total_sql, $values ) );

		if ( ! $total ) {
			return self::empty_stats();
		}

		$attended_sql  = 'SELECT COUNT(*) FROM ' . self::table_name() . " a INNER JOIN {$events_table} e ON e.id = a.event_id WHERE ";
		$attended_sql .= implode( ' AND ', $where );
		$attended_sql .= " AND a.attendance_status IN ('present', 'partial')";
		$attended      = (int) $wpdb->get_var( $wpdb->prepare( $attended_sql, $values ) );

		$missed = max( 0, $total - $attended );

		return array(
			'attendance_rate'   => (int) round( ( $attended / $total ) * 100 ),
			'sessions_attended' => $attended,
			'sessions_total'    => $total,
			'sessions_missed'   => $missed,
		);
	}

	/**
	 * Sync Webex participants into attendance records for a group.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return array|WP_Error
	 */
	public static function sync_webex_participants( $session_group_id ) {
		global $wpdb;

		if ( class_exists( 'MMED_Feature_Flags' ) && ! MMED_Feature_Flags::is_enabled( 'attendance_tracking' ) ) {
			return new WP_Error( 'mmed_attendance_disabled', 'Attendance tracking is not enabled.', array( 'status' => 403 ) );
		}

		self::maybe_install();

		if ( ! class_exists( 'MMED_Webex_Client' ) || ! class_exists( 'MMED_Session_Manager' ) || ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return new WP_Error( 'mmed_attendance_dependencies_missing', 'Attendance sync dependencies are unavailable.', array( 'status' => 500 ) );
		}

		$session_group_id = absint( $session_group_id );
		$group            = MMED_Session_Manager::get_group_by_id( $session_group_id );

		if ( ! $group || empty( $group->webex_meeting_id ) ) {
			return new WP_Error( 'mmed_attendance_group_missing', 'Session group or Webex meeting is missing.', array( 'status' => 404 ) );
		}

		$participants = MMED_Webex_Client::get_meeting_participants( $group->webex_meeting_id );
		if ( is_wp_error( $participants ) ) {
			return $participants;
		}

		$participants_by_email = array();
		foreach ( $participants as $participant ) {
			$email = sanitize_email( $participant['email'] ?? '' );
			if ( ! $email ) {
				continue;
			}
			$participants_by_email[ strtolower( $email ) ][] = $participant;
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$events       = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$events_table} WHERE source_group_id = %d AND end_at <= %s AND start_at >= %s AND status <> 'cancelled' ORDER BY start_at ASC",
				$session_group_id,
				current_time( 'mysql' ),
				gmdate( 'Y-m-d H:i:s', time() - 180 * DAY_IN_SECONDS )
			)
		);

		$students = MMED_Session_Manager::get_enrolled_students( $group->enrollment_template );
		$users    = array();
		foreach ( $students as $student ) {
			$users[ (int) $student->ID ] = $student;
		}

		$created = 0;
		$updated = 0;
		$absent  = 0;

		foreach ( is_array( $events ) ? $events : array() as $event ) {
			$user_id = (int) $event->user_id;
			if ( ! isset( $users[ $user_id ] ) ) {
				continue;
			}

			$email      = strtolower( sanitize_email( $users[ $user_id ]->user_email ) );
			$candidate  = self::match_participant_for_event( $participants_by_email[ $email ] ?? array(), $event );
			$before_id  = self::get_record_id_for_event_user( (int) $event->id, $user_id );
			$recorded   = null;

			if ( $candidate ) {
				$recorded = self::record_attendance(
					$user_id,
					$session_group_id,
					(int) $event->id,
					array(
						'webex_meeting_id'  => $group->webex_meeting_id,
						'join_time'         => $candidate['join_time'] ?? '',
						'leave_time'        => $candidate['leave_time'] ?? '',
						'duration_minutes'  => absint( $candidate['duration'] ?? 0 ),
						'source'            => 'webex_api',
					)
				);
			} else {
				$recorded = self::record_attendance(
					$user_id,
					$session_group_id,
					(int) $event->id,
					array(
						'webex_meeting_id'  => $group->webex_meeting_id,
						'attendance_status' => 'absent',
						'source'            => 'system',
					)
				);
				$absent++;
			}

			if ( is_wp_error( $recorded ) ) {
				continue;
			}

			if ( $before_id ) {
				$updated++;
			} else {
				$created++;
			}
		}

		return array(
			'session_group_id' => $session_group_id,
			'created'          => $created,
			'updated'          => $updated,
			'absent'           => $absent,
			'participants'     => count( $participants ),
		);
	}

	/**
	 * Cron callback for attendance sync.
	 *
	 * @param int $session_group_id Session group ID.
	 * @param int $event_id         Event ID.
	 * @return void
	 */
	public static function cron_sync_attendance( $session_group_id, $event_id = 0 ) {
		$result = self::sync_webex_participants( absint( $session_group_id ) );
		if ( is_wp_error( $result ) ) {
			do_action( 'mmed_attendance_sync_failed', $session_group_id, $event_id, $result );
		}
	}

	/**
	 * Schedule attendance sync 30 minutes after each future session end time.
	 *
	 * @param int $session_group_id Session group ID.
	 * @return void
	 */
	public static function schedule_sync_for_group( $session_group_id ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return;
		}

		$session_group_id = absint( $session_group_id );
		if ( ! $session_group_id ) {
			return;
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$events       = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, end_at FROM {$events_table} WHERE source_group_id = %d AND end_at >= %s AND status <> 'cancelled' ORDER BY end_at ASC",
				$session_group_id,
				current_time( 'mysql' )
			)
		);

		foreach ( is_array( $events ) ? $events : array() as $event ) {
			if ( empty( $event->end_at ) ) {
				continue;
			}

			$timestamp = strtotime( $event->end_at ) + 30 * MINUTE_IN_SECONDS;
			$args      = array( $session_group_id, (int) $event->id );

			if ( $timestamp > time() && ! wp_next_scheduled( 'mmed_sync_attendance', $args ) ) {
				wp_schedule_single_event( $timestamp, 'mmed_sync_attendance', $args );
			}
		}
	}

	/**
	 * Return attendance for one event and user for calendar payloads.
	 *
	 * @param int $event_id Event ID.
	 * @param int $user_id  User ID.
	 * @return array
	 */
	public static function get_event_attendance_for_user( $event_id, $user_id ) {
		global $wpdb;

		self::maybe_install();

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE event_id = %d AND user_id = %d LIMIT 1',
				absint( $event_id ),
				absint( $user_id )
			)
		);

		if ( ! $row ) {
			return array(
				'attendance_status' => 'absent',
				'duration_minutes'  => 0,
				'join_time'         => null,
				'leave_time'        => null,
			);
		}

		return self::format_record( $row );
	}

	/**
	 * REST: student attendance history.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_get_me( $request ) {
		$user_id = get_current_user_id();
		$from    = self::sanitize_date( $request->get_param( 'from' ) );
		$to      = self::sanitize_date( $request->get_param( 'to' ) );

		return new WP_REST_Response(
			array(
				'stats'   => self::get_stats_for_user( $user_id ),
				'history' => self::get_student_attendance( $user_id, $from, $to ),
			),
			200
		);
	}

	/**
	 * REST: admin session attendance list.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_admin_session( $request ) {
		$session_group_id = absint( $request->get_param( 'session_group_id' ) );
		$date             = self::sanitize_date( $request->get_param( 'date' ) );

		return new WP_REST_Response(
			array(
				'attendance' => self::get_session_attendance( $session_group_id, $date ),
			),
			200
		);
	}

	/**
	 * REST: admin manual sync.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_admin_sync( $request ) {
		$result = self::sync_webex_participants( absint( $request['session_group_id'] ) );
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( $result, 200 );
	}

	/**
	 * REST: admin template report.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_admin_report( $request ) {
		$template = sanitize_key( $request->get_param( 'template' ) );
		$from     = self::sanitize_date( $request->get_param( 'from' ) );
		$to       = self::sanitize_date( $request->get_param( 'to' ) );

		return new WP_REST_Response(
			array(
				'template' => $template,
				'from'     => $from,
				'to'       => $to,
				'rows'     => self::get_template_report( $template, $from, $to ),
			),
			200
		);
	}

	/**
	 * REST: admin manual attendance update.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_admin_update( $request ) {
		global $wpdb;

		$id  = absint( $request['id'] );
		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				$id
			)
		);

		if ( ! $row ) {
			return new WP_Error( 'mmed_attendance_not_found', 'Attendance record not found.', array( 'status' => 404 ) );
		}

		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) || empty( $payload ) ) {
			$payload = $request->get_body_params();
		}
		$payload = is_array( $payload ) ? $payload : array();

		$status = self::sanitize_status( $payload['attendance_status'] ?? $payload['status'] ?? '' );
		if ( '' === $status ) {
			return new WP_Error( 'mmed_attendance_status_required', 'Attendance status is required.', array( 'status' => 400 ) );
		}

		$result = self::record_attendance(
			(int) $row->user_id,
			(int) $row->session_group_id,
			(int) $row->event_id,
			array(
				'webex_meeting_id'   => $row->webex_meeting_id,
				'join_time'          => $payload['join_time'] ?? $row->join_time,
				'leave_time'         => $payload['leave_time'] ?? $row->leave_time,
				'duration_minutes'   => absint( $payload['duration_minutes'] ?? $row->duration_minutes ),
				'attendance_status'  => $status,
				'source'             => 'manual',
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response( self::get_record_by_id( $id ), 200 );
	}

	/**
	 * Build a simple report by session occurrence.
	 *
	 * @param string $template Template slug.
	 * @param string $from     Start date.
	 * @param string $to       End date.
	 * @return array
	 */
	public static function get_template_report( $template, $from, $to ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return array();
		}

		$events_table = MMED_Calendar_Engine::table_name();
		$group_ids    = self::group_ids_for_template( $template );

		if ( empty( $group_ids ) ) {
			return array();
		}

		$where  = array( 'e.source_group_id IN (' . implode( ', ', array_fill( 0, count( $group_ids ), '%d' ) ) . ')' );
		$values = $group_ids;

		if ( $from ) {
			$where[]  = 'e.start_at >= %s';
			$values[] = $from . ' 00:00:00';
		}

		if ( $to ) {
			$where[]  = 'e.start_at <= %s';
			$values[] = $to . ' 23:59:59';
		}

		$sql  = "SELECT e.source_group_id, DATE(e.start_at) event_date, MAX(e.title) session_name, COUNT(DISTINCT e.user_id) total_enrolled, ";
		$sql .= "SUM(CASE WHEN a.attendance_status IN ('present', 'partial') THEN 1 ELSE 0 END) attended ";
		$sql .= "FROM {$events_table} e LEFT JOIN " . self::table_name() . ' a ON a.event_id = e.id ';
		$sql .= 'WHERE ' . implode( ' AND ', $where ) . ' GROUP BY e.source_group_id, DATE(e.start_at) ORDER BY event_date DESC';

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $values ) );

		return array_map(
			static function ( $row ) {
				$total    = max( 0, (int) $row->total_enrolled );
				$attended = max( 0, (int) $row->attended );

				return array(
					'session_group_id' => (int) $row->source_group_id,
					'session_name'     => (string) $row->session_name,
					'date'             => (string) $row->event_date,
					'total_enrolled'   => $total,
					'attended'         => $attended,
					'attendance_rate'  => $total ? (int) round( ( $attended / $total ) * 100 ) : 0,
				);
			},
			is_array( $rows ) ? $rows : array()
		);
	}

	/**
	 * Format a DB row.
	 *
	 * @param object|null $row Attendance row.
	 * @return array
	 */
	public static function format_record( $row ) {
		if ( ! $row ) {
			return array();
		}

		return array(
			'id'                => (int) $row->id,
			'user_id'           => (int) $row->user_id,
			'session_group_id'  => (int) $row->session_group_id,
			'event_id'          => (int) $row->event_id,
			'webex_meeting_id'  => (string) ( $row->webex_meeting_id ?? '' ),
			'join_time'         => ! empty( $row->join_time ) ? (string) $row->join_time : null,
			'leave_time'        => ! empty( $row->leave_time ) ? (string) $row->leave_time : null,
			'duration_minutes'  => (int) $row->duration_minutes,
			'attendance_status' => (string) $row->attendance_status,
			'source'            => (string) $row->source,
			'title'             => (string) ( $row->title ?? '' ),
			'start_at'          => (string) ( $row->start_at ?? '' ),
			'end_at'            => (string) ( $row->end_at ?? '' ),
			'created_at'        => (string) ( $row->created_at ?? '' ),
			'updated_at'        => (string) ( $row->updated_at ?? '' ),
		);
	}

	/**
	 * Empty stats shape.
	 *
	 * @return array
	 */
	private static function empty_stats() {
		return array(
			'attendance_rate'   => 0,
			'sessions_attended' => 0,
			'sessions_total'    => 0,
			'sessions_missed'   => 0,
		);
	}

	/**
	 * Return group IDs for a template.
	 *
	 * @param string $template Template slug.
	 * @return array
	 */
	private static function group_ids_for_template( $template ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Session_Manager' ) ) {
			return array();
		}

		$template = sanitize_key( $template );
		$where    = array( 'is_active = %d' );
		$values   = array( 1 );

		if ( $template ) {
			$where[]  = 'enrollment_template = %s';
			$values[] = $template;
		}

		$sql = 'SELECT id FROM ' . MMED_Session_Manager::table_name() . ' WHERE ' . implode( ' AND ', $where );
		$ids = $wpdb->get_col( $wpdb->prepare( $sql, $values ) );

		return array_map( 'absint', is_array( $ids ) ? $ids : array() );
	}

	/**
	 * Match a participant row to an event by date.
	 *
	 * @param array  $participants Participant rows.
	 * @param object $event        Event row.
	 * @return array|null
	 */
	private static function match_participant_for_event( $participants, $event ) {
		$event_start = strtotime( $event->start_at );
		$event_end   = ! empty( $event->end_at ) ? strtotime( $event->end_at ) : $event_start + HOUR_IN_SECONDS;

		foreach ( $participants as $participant ) {
			$join_ts = ! empty( $participant['join_time'] ) ? strtotime( $participant['join_time'] ) : 0;
			if ( ! $join_ts ) {
				continue;
			}

			if ( $join_ts >= $event_start - HOUR_IN_SECONDS && $join_ts <= $event_end + 6 * HOUR_IN_SECONDS ) {
				return $participant;
			}
		}

		return null;
	}

	/**
	 * Derive present, partial, or absent.
	 *
	 * @param object|null $event    Event row.
	 * @param string      $join     Join time.
	 * @param string      $leave    Leave time.
	 * @param int         $duration Duration minutes.
	 * @return string
	 */
	private static function derive_status( $event, $join, $leave, $duration ) {
		if ( ! $join || ! $event || empty( $event->start_at ) ) {
			return 'absent';
		}

		$start_ts      = strtotime( $event->start_at );
		$end_ts        = ! empty( $event->end_at ) ? strtotime( $event->end_at ) : $start_ts + HOUR_IN_SECONDS;
		$join_ts       = strtotime( $join );
		$session_mins  = max( 1, (int) round( ( $end_ts - $start_ts ) / MINUTE_IN_SECONDS ) );
		$joined_ontime = $join_ts <= $start_ts + 15 * MINUTE_IN_SECONDS;

		if ( $joined_ontime && $duration >= $session_mins * 0.5 ) {
			return 'present';
		}

		return 'partial';
	}

	/**
	 * Return an event row.
	 *
	 * @param int $event_id Event ID.
	 * @return object|null
	 */
	private static function get_event_row( $event_id ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return null;
		}

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . MMED_Calendar_Engine::table_name() . ' WHERE id = %d',
				absint( $event_id )
			)
		);
	}

	/**
	 * Return attendance ID for event and user.
	 *
	 * @param int $event_id Event ID.
	 * @param int $user_id  User ID.
	 * @return int
	 */
	private static function get_record_id_for_event_user( $event_id, $user_id ) {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . self::table_name() . ' WHERE event_id = %d AND user_id = %d LIMIT 1',
				absint( $event_id ),
				absint( $user_id )
			)
		);
	}

	/**
	 * Return a formatted record by ID.
	 *
	 * @param int $id Attendance ID.
	 * @return array
	 */
	private static function get_record_by_id( $id ) {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d',
				absint( $id )
			)
		);

		return self::format_record( $row );
	}

	/**
	 * Sanitize date.
	 *
	 * @param mixed $value Raw date.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitize datetime.
	 *
	 * @param mixed $value Raw date time.
	 * @return string
	 */
	private static function sanitize_datetime( $value ) {
		$value = sanitize_text_field( (string) $value );
		if ( '' === $value ) {
			return '';
		}

		$timestamp = strtotime( $value );
		return $timestamp ? date_i18n( 'Y-m-d H:i:s', $timestamp ) : '';
	}

	/**
	 * Sanitize attendance status.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_status( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, array( 'present', 'partial', 'absent' ), true ) ? $value : '';
	}

	/**
	 * Sanitize attendance source.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_source( $value ) {
		$value = sanitize_key( $value );
		return in_array( $value, array( 'webex_api', 'manual', 'system' ), true ) ? $value : 'system';
	}

	/**
	 * Build wpdb format map.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();

		foreach ( array_keys( $payload ) as $key ) {
			$formats[] = in_array( $key, array( 'user_id', 'session_group_id', 'event_id', 'duration_minutes' ), true ) ? '%d' : '%s';
		}

		return $formats;
	}
}
