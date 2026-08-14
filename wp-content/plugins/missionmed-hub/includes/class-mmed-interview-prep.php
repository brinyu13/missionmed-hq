<?php
/**
 * MissionMed Interview Prep rooms.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Owns private interview prep sessions, feedback, and manual slots.
 */
class MMED_Interview_Prep {

	const DB_VERSION           = '20260519.1';
	const QUESTION_BANK_OPTION = 'mmed_interview_question_bank';

	/**
	 * Initialize runtime hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
		add_action( 'mmed_ssa_appointment_synced', array( __CLASS__, 'on_ssa_appointment_synced' ), 10, 2 );
	}

	/**
	 * Return the interview sessions table name.
	 *
	 * @return string
	 */
	public static function table_name() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_interview_sessions';
	}

	/**
	 * Return the manual interview slots table name.
	 *
	 * @return string
	 */
	public static function slots_table() {
		global $wpdb;
		return $wpdb->prefix . 'mmed_interview_slots';
	}

	/**
	 * Create or update tables.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		if ( get_option( 'mmed_interview_prep_db_version' ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$sessions        = self::table_name();
		$slots           = self::slots_table();
		$charset_collate = $wpdb->get_charset_collate();

		$sql_sessions = "CREATE TABLE {$sessions} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			student_id bigint(20) unsigned NOT NULL DEFAULT 0,
			interviewer_id bigint(20) unsigned NOT NULL DEFAULT 0,
			interview_type varchar(40) NOT NULL DEFAULT 'behavioral',
			scheduled_date date NOT NULL,
			scheduled_time time NOT NULL,
			duration_minutes int unsigned NOT NULL DEFAULT 20,
			meeting_url text NULL,
			webex_meeting_id varchar(255) NULL,
			status varchar(30) NOT NULL DEFAULT 'scheduled',
			feedback_json longtext NULL,
			rubric_scores_json longtext NULL,
			notes longtext NULL,
			ssa_appointment_id bigint(20) unsigned NOT NULL DEFAULT 0,
			created_at datetime NOT NULL,
			updated_at datetime NULL,
			PRIMARY KEY  (id),
			KEY student_id (student_id),
			KEY interviewer_id (interviewer_id),
			KEY status (status),
			KEY scheduled_date (scheduled_date),
			KEY ssa_appointment_id (ssa_appointment_id)
		) {$charset_collate};";

		$sql_slots = "CREATE TABLE {$slots} (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			interviewer_id bigint(20) unsigned NOT NULL DEFAULT 0,
			slot_date date NOT NULL,
			slot_time time NOT NULL,
			duration_minutes int unsigned NOT NULL DEFAULT 20,
			interview_type varchar(40) NOT NULL DEFAULT 'traditional',
			status varchar(30) NOT NULL DEFAULT 'open',
			claimed_by bigint(20) unsigned NULL,
			interview_session_id bigint(20) unsigned NULL,
			created_at datetime NOT NULL,
			updated_at datetime NULL,
			PRIMARY KEY  (id),
			KEY interviewer_date (interviewer_id, slot_date),
			KEY status (status),
			KEY claimed_by (claimed_by)
		) {$charset_collate};";

		dbDelta( $sql_sessions );
		dbDelta( $sql_slots );

		update_option( 'mmed_interview_prep_db_version', self::DB_VERSION, false );
	}

	/**
	 * Create an interview session.
	 *
	 * @param int   $student_id Student user ID.
	 * @param array $data       Session data.
	 * @return array|WP_Error
	 */
	public static function create_session( $student_id, $data ) {
		global $wpdb;

		self::maybe_install();

		$student_id = absint( $student_id );
		if ( ! $student_id || ! get_user_by( 'id', $student_id ) ) {
			return new WP_Error( 'mmed_interview_invalid_student', 'A valid student is required.', array( 'status' => 400 ) );
		}

		$type = self::sanitize_enum( $data['interview_type'] ?? 'behavioral', self::allowed_types(), 'behavioral' );
		$date = self::sanitize_date( $data['scheduled_date'] ?? '' );
		$time = self::sanitize_time( $data['scheduled_time'] ?? '' );

		if ( ! $date || ! $time ) {
			return new WP_Error( 'mmed_interview_invalid_time', 'Scheduled date and time are required.', array( 'status' => 400 ) );
		}

		$duration = min( 120, max( 5, absint( $data['duration_minutes'] ?? 20 ) ) );
		$status   = self::sanitize_enum( $data['status'] ?? 'scheduled', self::allowed_statuses(), 'scheduled' );

		$payload = array(
			'student_id'          => $student_id,
			'interviewer_id'      => absint( $data['interviewer_id'] ?? 0 ),
			'interview_type'      => $type,
			'scheduled_date'      => $date,
			'scheduled_time'      => $time,
			'duration_minutes'    => $duration,
			'meeting_url'         => isset( $data['meeting_url'] ) ? esc_url_raw( $data['meeting_url'] ) : '',
			'webex_meeting_id'    => sanitize_text_field( $data['webex_meeting_id'] ?? '' ),
			'status'              => $status,
			'feedback_json'       => null,
			'rubric_scores_json'  => null,
			'notes'               => wp_kses_post( $data['notes'] ?? '' ),
			'ssa_appointment_id'  => absint( $data['ssa_appointment_id'] ?? 0 ),
			'created_at'          => current_time( 'mysql' ),
			'updated_at'          => current_time( 'mysql' ),
		);

		$inserted = $wpdb->insert( self::table_name(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_interview_create_failed', 'Interview session could not be created.', array( 'status' => 500 ) );
		}

		$session_id = (int) $wpdb->insert_id;
		$meeting    = self::auto_create_meeting( $session_id );
		if ( is_wp_error( $meeting ) ) {
			self::append_admin_note( $session_id, 'Webex meeting creation needs review: ' . $meeting->get_error_message() );
		}

		self::sync_calendar_event( $session_id );

		return self::get_session( $session_id );
	}

	/**
	 * Create a Webex meeting for an interview session.
	 *
	 * @param int $session_id Session ID.
	 * @return array|WP_Error
	 */
	public static function auto_create_meeting( $session_id ) {
		global $wpdb;

		$session_id = absint( $session_id );
		$row        = self::get_session_row( $session_id );

		if ( ! $row ) {
			return new WP_Error( 'mmed_interview_not_found', 'Interview session not found.', array( 'status' => 404 ) );
		}

		if ( ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'create_meeting' ) ) {
			return new WP_Error( 'mmed_webex_create_missing', 'Webex meeting creation is unavailable.', array( 'status' => 500 ) );
		}

		if ( ! empty( $row->webex_meeting_id ) && ! empty( $row->meeting_url ) ) {
			return self::format_session( $row );
		}

		$student = get_user_by( 'id', (int) $row->student_id );
		$title   = 'Interview Prep: ' . ( $student ? $student->display_name : 'MissionMed Student' );
		$start   = $row->scheduled_date . 'T' . $row->scheduled_time;
		$end     = gmdate( 'Y-m-d\TH:i:s', strtotime( $row->scheduled_date . ' ' . $row->scheduled_time . ' +' . absint( $row->duration_minutes ) . ' minutes' ) );

		$meeting = MMED_Webex_Client::create_meeting(
			array(
				'title'    => $title,
				'start'    => $start,
				'end'      => $end,
				'timezone' => 'America/New_York',
			)
		);

		if ( is_wp_error( $meeting ) ) {
			return $meeting;
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'meeting_url'      => esc_url_raw( $meeting['webLink'] ?? '' ),
				'webex_meeting_id' => sanitize_text_field( $meeting['id'] ?? '' ),
				'updated_at'       => current_time( 'mysql' ),
			),
			array( 'id' => $session_id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_interview_meeting_save_failed', 'Webex meeting details could not be saved.', array( 'status' => 500 ) );
		}

		self::sync_calendar_event( $session_id );

		return self::format_session( self::get_session_row( $session_id ) );
	}

	/**
	 * Submit private interviewer feedback.
	 *
	 * @param int    $session_id     Session ID.
	 * @param int    $interviewer_id Current interviewer user ID.
	 * @param array  $rubric_scores  Rubric scores.
	 * @param string $feedback_text  Feedback text.
	 * @return array|WP_Error
	 */
	public static function submit_feedback( $session_id, $interviewer_id, $rubric_scores, $feedback_text ) {
		global $wpdb;

		$session_id     = absint( $session_id );
		$interviewer_id = absint( $interviewer_id );

		if ( ! self::user_can_manage_session( $session_id, $interviewer_id ) ) {
			return new WP_Error( 'mmed_interview_feedback_forbidden', 'You cannot submit feedback for this interview.', array( 'status' => 403 ) );
		}

		$feedback = array(
			'text'         => wp_kses_post( $feedback_text ),
			'submitted_by' => $interviewer_id,
			'submitted_at' => current_time( 'mysql' ),
		);

		$payload = array(
			'feedback_json'      => wp_json_encode( $feedback ),
			'rubric_scores_json' => wp_json_encode( self::normalize_rubric( $rubric_scores ) ),
			'status'             => 'completed',
			'updated_at'         => current_time( 'mysql' ),
		);

		$updated = $wpdb->update(
			self::table_name(),
			$payload,
			array( 'id' => $session_id ),
			array( '%s', '%s', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_interview_feedback_failed', 'Feedback could not be saved.', array( 'status' => 500 ) );
		}

		self::sync_calendar_event( $session_id );

		return self::get_session( $session_id );
	}

	/**
	 * Return sessions for one student.
	 *
	 * @param int    $student_id    Student user ID.
	 * @param string $status_filter Optional status filter.
	 * @return array
	 */
	public static function get_student_sessions( $student_id, $status_filter = '' ) {
		global $wpdb;

		self::maybe_install();

		$student_id = absint( $student_id );
		$status     = self::sanitize_enum( $status_filter, self::allowed_statuses(), '' );

		$where  = array( 'student_id = %d' );
		$values = array( $student_id );

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY scheduled_date DESC, scheduled_time DESC, id DESC',
				$values
			)
		);

		return array_map( array( __CLASS__, 'format_session' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Return upcoming or filtered sessions for admin views.
	 *
	 * @param string $date          Optional date.
	 * @param string $status_filter Optional status.
	 * @return array
	 */
	public static function get_upcoming_sessions( $date = '', $status_filter = '' ) {
		global $wpdb;

		self::maybe_install();

		$date   = self::sanitize_date( $date );
		$status = self::sanitize_enum( $status_filter, self::allowed_statuses(), '' );
		$where  = array();
		$values = array();

		if ( $date ) {
			$where[]  = 'scheduled_date = %s';
			$values[] = $date;
		} else {
			$where[]  = 'scheduled_date >= %s';
			$values[] = current_time( 'Y-m-d' );
		}

		if ( $status ) {
			$where[]  = 'status = %s';
			$values[] = $status;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY scheduled_date ASC, scheduled_time ASC, id ASC LIMIT 200',
				$values
			)
		);

		return array_map( array( __CLASS__, 'format_session' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Cancel an interview session.
	 *
	 * @param int $session_id Session ID.
	 * @param int $user_id    Acting user ID.
	 * @return array|WP_Error
	 */
	public static function cancel_session( $session_id, $user_id = 0 ) {
		global $wpdb;

		$session_id = absint( $session_id );
		$user_id    = $user_id ? absint( $user_id ) : get_current_user_id();
		$row        = self::get_session_row( $session_id );

		if ( ! $row ) {
			return new WP_Error( 'mmed_interview_not_found', 'Interview session not found.', array( 'status' => 404 ) );
		}

		$is_admin = current_user_can( 'manage_options' );
		$is_owner = (int) $row->student_id === $user_id;

		if ( ! $is_admin && ! $is_owner ) {
			return new WP_Error( 'mmed_interview_cancel_forbidden', 'You cannot cancel this interview.', array( 'status' => 403 ) );
		}

		if ( ! $is_admin && 'scheduled' !== $row->status ) {
			return new WP_Error( 'mmed_interview_cancel_locked', 'Only scheduled interviews can be cancelled by students.', array( 'status' => 400 ) );
		}

		if ( $is_admin && ! in_array( $row->status, array( 'scheduled', 'in_progress' ), true ) ) {
			return new WP_Error( 'mmed_interview_cancel_locked', 'This interview cannot be cancelled from its current status.', array( 'status' => 400 ) );
		}

		$delete_status = 'not_available';
		if ( ! empty( $row->webex_meeting_id ) && class_exists( 'MMED_Webex_Client' ) && method_exists( 'MMED_Webex_Client', 'delete_meeting' ) ) {
			$deleted       = MMED_Webex_Client::delete_meeting( $row->webex_meeting_id );
			$delete_status = is_wp_error( $deleted ) ? 'failed' : 'requested';
		}

		$notes = trim( (string) $row->notes );
		$notes = trim( $notes . "\n" . 'Cancellation requested by user ' . $user_id . '. Webex deletion: ' . $delete_status . '.' );

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'     => 'cancelled',
				'notes'      => wp_kses_post( $notes ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $session_id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_interview_cancel_failed', 'Interview session could not be cancelled.', array( 'status' => 500 ) );
		}

		self::sync_calendar_event( $session_id );

		$result = self::get_session( $session_id );
		if ( is_array( $result ) ) {
			$result['webex_delete_status'] = $delete_status;
		}

		return $result;
	}

	/**
	 * Update admin-managed status.
	 *
	 * @param int    $session_id Session ID.
	 * @param string $status     New status.
	 * @return array|WP_Error
	 */
	public static function update_status( $session_id, $status ) {
		global $wpdb;

		$session_id = absint( $session_id );
		$status     = self::sanitize_enum( $status, self::allowed_statuses(), '' );

		if ( ! $session_id || ! $status ) {
			return new WP_Error( 'mmed_interview_status_invalid', 'A valid status is required.', array( 'status' => 400 ) );
		}

		if ( ! self::get_session_row( $session_id ) ) {
			return new WP_Error( 'mmed_interview_not_found', 'Interview session not found.', array( 'status' => 404 ) );
		}

		$updated = $wpdb->update(
			self::table_name(),
			array(
				'status'     => $status,
				'updated_at' => current_time( 'mysql' ),
			),
			array( 'id' => $session_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'mmed_interview_status_failed', 'Interview status could not be updated.', array( 'status' => 500 ) );
		}

		self::sync_calendar_event( $session_id );

		return self::get_session( $session_id );
	}

	/**
	 * Return one formatted session.
	 *
	 * @param int $session_id Session ID.
	 * @return array|WP_Error
	 */
	public static function get_session( $session_id ) {
		$row = self::get_session_row( absint( $session_id ) );
		if ( ! $row ) {
			return new WP_Error( 'mmed_interview_not_found', 'Interview session not found.', array( 'status' => 404 ) );
		}

		return self::format_session( $row );
	}

	/**
	 * Whether a user can read the session.
	 *
	 * @param int $session_id Session ID.
	 * @param int $user_id    User ID.
	 * @return bool
	 */
	public static function user_can_access_session( $session_id, $user_id ) {
		$row     = self::get_session_row( absint( $session_id ) );
		$user_id = absint( $user_id );

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( ! $row || ! $user_id ) {
			return false;
		}

		return (int) $row->student_id === $user_id || (int) $row->interviewer_id === $user_id;
	}

	/**
	 * Whether a user can manage feedback/status for the session.
	 *
	 * @param int $session_id Session ID.
	 * @param int $user_id    User ID.
	 * @return bool
	 */
	public static function user_can_manage_session( $session_id, $user_id ) {
		$row     = self::get_session_row( absint( $session_id ) );
		$user_id = absint( $user_id );

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		return $row && $user_id && (int) $row->interviewer_id === $user_id;
	}

	/**
	 * Normalize rubric values.
	 *
	 * @param array $rubric_scores Raw rubric scores.
	 * @return array
	 */
	public static function normalize_rubric( $rubric_scores ) {
		$rubric_scores = is_array( $rubric_scores ) ? $rubric_scores : array();
		$normalized    = array();

		foreach ( self::rubric_categories() as $category ) {
			$item = isset( $rubric_scores[ $category ] ) && is_array( $rubric_scores[ $category ] ) ? $rubric_scores[ $category ] : array();
			$normalized[ $category ] = array(
				'score' => min( 5, max( 1, absint( $item['score'] ?? 1 ) ) ),
				'notes' => self::limit_text( sanitize_textarea_field( $item['notes'] ?? '' ), 500 ),
			);
		}

		return $normalized;
	}

	/**
	 * Return the saved or default question bank.
	 *
	 * @return array
	 */
	public static function get_question_bank() {
		$bank = get_option( self::QUESTION_BANK_OPTION, array() );
		if ( ! is_array( $bank ) || empty( $bank ) ) {
			$bank = self::default_question_bank();
		}

		return self::sanitize_question_bank( $bank );
	}

	/**
	 * Save the interview question bank.
	 *
	 * @param array $bank Raw question bank.
	 * @return array
	 */
	public static function save_question_bank( $bank ) {
		$bank = self::sanitize_question_bank( is_array( $bank ) ? $bank : array() );
		update_option( self::QUESTION_BANK_OPTION, $bank, false );
		return $bank;
	}

	/**
	 * Return starter interview questions.
	 *
	 * @return array
	 */
	public static function default_question_bank() {
		return array(
			'behavioral'  => array(
				'Tell me about a time you received difficult feedback and how you responded.',
				'Describe a conflict on a team and what you learned from it.',
				'What would your recent supervisor say is your greatest area for growth?',
				'Tell me about a time you had to adapt quickly.',
			),
			'clinical'    => array(
				'Walk me through how you approach an unstable patient.',
				'Describe a clinical mistake you observed and how you handled it.',
				'How do you prioritize when several patients need attention at once?',
				'Tell me how you communicate uncertainty to a patient or team.',
			),
			'traditional' => array(
				'Why this specialty?',
				'Why this program?',
				'Tell me about yourself.',
				'What are you looking for in a residency training environment?',
			),
			'mmi'         => array(
				'You see a colleague behaving unprofessionally. What do you do?',
				'A patient refuses a recommended treatment. How do you respond?',
				'You have limited resources and competing needs. How do you decide?',
				'How would you handle a disagreement with a senior physician?',
			),
		);
	}

	/**
	 * React to a MissionMed-owned SSA sync hook.
	 *
	 * @param array $event   Matrix calendar event payload.
	 * @param array $ssa_row Raw SSA row.
	 * @return void
	 */
	public static function on_ssa_appointment_synced( $event, $ssa_row ) {
		$event   = is_array( $event ) ? $event : array();
		$ssa_row = is_array( $ssa_row ) ? $ssa_row : array();
		$meta    = isset( $event['meta_json'] ) ? json_decode( (string) $event['meta_json'], true ) : array();
		$meta    = is_array( $meta ) ? $meta : array();

		$haystack = strtolower(
			implode(
				' ',
				array(
					$event['title'] ?? '',
					$event['category'] ?? '',
					$meta['ssa_appointment_type'] ?? '',
				)
			)
		);

		if ( false === strpos( $haystack, 'mock' ) && false === strpos( $haystack, 'interview' ) && false === strpos( $haystack, 'interview prep' ) ) {
			return;
		}

			$student_id     = absint( $event['user_id'] ?? 0 );
			$appointment_id = absint( $event['source_id'] ?? 0 );
			$appointment_id = $appointment_id ? $appointment_id : absint( $ssa_row['id'] ?? 0 );
			$start          = sanitize_text_field( $event['start_at'] ?? '' );
			$end            = sanitize_text_field( $event['end_at'] ?? '' );

		if ( ! $student_id || ! $appointment_id || ! $start ) {
			return;
		}

		$existing = self::get_session_by_ssa_id( $appointment_id );
		$date     = date( 'Y-m-d', strtotime( $start ) );
		$time     = date( 'H:i:s', strtotime( $start ) );
		$duration = 20;
		if ( $end && strtotime( $end ) > strtotime( $start ) ) {
			$duration = max( 5, min( 120, (int) round( ( strtotime( $end ) - strtotime( $start ) ) / 60 ) ) );
		}

		if ( $existing ) {
			self::update_session_fields(
				(int) $existing->id,
				array(
					'student_id'          => $student_id,
					'scheduled_date'      => $date,
					'scheduled_time'      => $time,
					'duration_minutes'    => $duration,
					'ssa_appointment_id'  => $appointment_id,
					'updated_at'          => current_time( 'mysql' ),
				)
			);

			if ( empty( $existing->meeting_url ) ) {
				self::auto_create_meeting( (int) $existing->id );
			}

			return;
		}

		self::create_session(
			$student_id,
			array(
				'interview_type'      => 'traditional',
				'scheduled_date'      => $date,
				'scheduled_time'      => $time,
				'duration_minutes'    => $duration,
				'ssa_appointment_id'  => $appointment_id,
			)
		);
	}

	/**
	 * Determine whether a user can access a session group.
	 *
	 * @param int $session_group_id Session group ID.
	 * @param int $user_id          User ID.
	 * @return bool
	 */
	public static function user_can_access_session_group( $session_group_id, $user_id ) {
		if ( class_exists( 'MMED_Arena_Live' ) && method_exists( 'MMED_Arena_Live', 'user_can_access_session_group' ) ) {
			return MMED_Arena_Live::user_can_access_session_group( $session_group_id, $user_id );
		}

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		if ( ! class_exists( 'MMED_Session_Manager' ) ) {
			return false;
		}

		$group = MMED_Session_Manager::get_group_by_id( absint( $session_group_id ) );
		if ( ! $group ) {
			return false;
		}

		$students = MMED_Session_Manager::get_enrolled_students( $group->enrollment_template );
		foreach ( is_array( $students ) ? $students : array() as $student ) {
			if ( (int) $student->ID === absint( $user_id ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Format a session row for the current viewer.
	 *
	 * @param object|null $row Session row.
	 * @return array
	 */
	public static function format_session( $row ) {
		if ( ! $row ) {
			return array();
		}

		$current_user = get_current_user_id();
		$can_read     = self::user_can_access_session( (int) $row->id, $current_user );
		$can_manage   = self::user_can_manage_session( (int) $row->id, $current_user );
		$student      = get_user_by( 'id', (int) $row->student_id );
		$interviewer  = $row->interviewer_id ? get_user_by( 'id', (int) $row->interviewer_id ) : null;

		$session = array(
			'id'                  => (int) $row->id,
			'student_id'          => (int) $row->student_id,
			'student_name'        => $student ? $student->display_name : '',
			'interviewer_id'      => (int) $row->interviewer_id,
			'interviewer_name'    => $interviewer ? $interviewer->display_name : '',
			'interview_type'      => (string) $row->interview_type,
			'scheduled_date'      => (string) $row->scheduled_date,
			'scheduled_time'      => (string) $row->scheduled_time,
			'duration_minutes'    => (int) $row->duration_minutes,
			'meeting_url'         => $can_read ? (string) $row->meeting_url : '',
			'status'              => (string) $row->status,
			'ssa_appointment_id'  => $can_manage ? (int) $row->ssa_appointment_id : 0,
			'can_manage_feedback' => $can_manage,
			'can_cancel'          => current_user_can( 'manage_options' ) || ( (int) $row->student_id === $current_user && 'scheduled' === $row->status ),
			'created_at'          => (string) $row->created_at,
			'updated_at'          => (string) $row->updated_at,
		);

		if ( $can_manage ) {
			$session['webex_meeting_id'] = (string) $row->webex_meeting_id;
			$session['notes']            = wp_kses_post( $row->notes );
		}

		if ( $can_read ) {
			$session['feedback'] = self::decode_json( $row->feedback_json );
			$session['rubric']   = self::decode_json( $row->rubric_scores_json );
		}

		return $session;
	}

	/**
	 * Return allowed interview types.
	 *
	 * @return array
	 */
	public static function allowed_types() {
		return array( 'behavioral', 'clinical', 'traditional', 'mmi' );
	}

	/**
	 * Return allowed session statuses.
	 *
	 * @return array
	 */
	public static function allowed_statuses() {
		return array( 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show' );
	}

	/**
	 * Return allowed rubric categories.
	 *
	 * @return array
	 */
	public static function rubric_categories() {
		return array( 'communication', 'clinical_reasoning', 'professionalism', 'composure', 'answer_structure', 'overall' );
	}

	/**
	 * Create a manual interview slot.
	 *
	 * @param array $data Slot data.
	 * @return array|WP_Error
	 */
	public static function create_slot( $data ) {
		global $wpdb;

		self::maybe_install();

		$date = self::sanitize_date( $data['slot_date'] ?? '' );
		$time = self::sanitize_time( $data['slot_time'] ?? '' );
		$type = self::sanitize_enum( $data['interview_type'] ?? 'traditional', self::allowed_types(), 'traditional' );

		if ( ! $date || ! $time ) {
			return new WP_Error( 'mmed_interview_slot_invalid', 'Slot date and time are required.', array( 'status' => 400 ) );
		}

		$payload = array(
			'interviewer_id'   => absint( $data['interviewer_id'] ?? get_current_user_id() ),
			'slot_date'        => $date,
			'slot_time'        => $time,
			'duration_minutes' => min( 120, max( 5, absint( $data['duration_minutes'] ?? 20 ) ) ),
			'interview_type'   => $type,
			'status'           => 'open',
			'claimed_by'       => null,
			'created_at'       => current_time( 'mysql' ),
			'updated_at'       => current_time( 'mysql' ),
		);

		$inserted = $wpdb->insert( self::slots_table(), $payload, self::format_map( $payload ) );
		if ( false === $inserted ) {
			return new WP_Error( 'mmed_interview_slot_create_failed', 'Interview slot could not be created.', array( 'status' => 500 ) );
		}

		return self::format_slot( self::get_slot_row( (int) $wpdb->insert_id ) );
	}

	/**
	 * Return open slots.
	 *
	 * @param array $filters Optional filters.
	 * @return array
	 */
	public static function list_open_slots( $filters = array() ) {
		global $wpdb;

		self::maybe_install();

		$where  = array( 'status = %s' );
		$values = array( 'open' );
		$date   = self::sanitize_date( $filters['date'] ?? '' );
		$type   = self::sanitize_enum( $filters['interview_type'] ?? '', self::allowed_types(), '' );

		if ( $date ) {
			$where[]  = 'slot_date = %s';
			$values[] = $date;
		} else {
			$where[]  = 'slot_date >= %s';
			$values[] = current_time( 'Y-m-d' );
		}

		if ( $type ) {
			$where[]  = 'interview_type = %s';
			$values[] = $type;
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT * FROM ' . self::slots_table() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY slot_date ASC, slot_time ASC, id ASC LIMIT 100',
				$values
			)
		);

		return array_map( array( __CLASS__, 'format_slot' ), is_array( $rows ) ? $rows : array() );
	}

	/**
	 * Atomically claim a manual slot.
	 *
	 * @param int $slot_id    Slot ID.
	 * @param int $student_id Student ID.
	 * @return array|WP_Error
	 */
	public static function claim_slot( $slot_id, $student_id ) {
		global $wpdb;

		self::maybe_install();

		$slot_id    = absint( $slot_id );
		$student_id = absint( $student_id );
		$slot       = self::get_slot_row( $slot_id );

		if ( ! $slot || 'open' !== $slot->status ) {
			return new WP_Error( 'slot_unavailable', 'This interview slot is no longer available.', array( 'status' => 409 ) );
		}

		$updated = $wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::slots_table() . " SET status = 'claimed', claimed_by = %d, updated_at = %s WHERE id = %d AND status = 'open'",
				$student_id,
				current_time( 'mysql' ),
				$slot_id
			)
		);

		if ( 1 !== (int) $updated ) {
			return new WP_Error( 'slot_unavailable', 'This interview slot is no longer available.', array( 'status' => 409 ) );
		}

		$session = self::create_session(
			$student_id,
			array(
				'interviewer_id'   => (int) $slot->interviewer_id,
				'interview_type'   => (string) $slot->interview_type,
				'scheduled_date'   => (string) $slot->slot_date,
				'scheduled_time'   => (string) $slot->slot_time,
				'duration_minutes' => (int) $slot->duration_minutes,
			)
		);

		if ( is_wp_error( $session ) ) {
			self::update_slot_fields(
				$slot_id,
				array(
					'status'     => 'open',
					'claimed_by' => null,
					'updated_at' => current_time( 'mysql' ),
				)
			);
			return $session;
		}

		self::update_slot_fields(
			$slot_id,
			array(
				'interview_session_id' => absint( $session['id'] ?? 0 ),
				'updated_at'           => current_time( 'mysql' ),
			)
		);

		return array(
			'slot'    => self::format_slot( self::get_slot_row( $slot_id ) ),
			'session' => $session,
		);
	}

	/**
	 * Cancel a manual slot.
	 *
	 * @param int $slot_id Slot ID.
	 * @return array|WP_Error
	 */
	public static function cancel_slot( $slot_id ) {
		$slot_id = absint( $slot_id );
		if ( ! self::get_slot_row( $slot_id ) ) {
			return new WP_Error( 'mmed_interview_slot_not_found', 'Interview slot not found.', array( 'status' => 404 ) );
		}

		$result = self::update_slot_fields(
			$slot_id,
			array(
				'status'     => 'cancelled',
				'updated_at' => current_time( 'mysql' ),
			)
		);

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return self::format_slot( self::get_slot_row( $slot_id ) );
	}

	/**
	 * Return a raw session row.
	 *
	 * @param int $session_id Session ID.
	 * @return object|null
	 */
	private static function get_session_row( $session_id ) {
		global $wpdb;

		self::maybe_install();

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE id = %d LIMIT 1',
				absint( $session_id )
			)
		);
	}

	/**
	 * Return a row by SSA appointment ID.
	 *
	 * @param int $appointment_id SSA appointment ID.
	 * @return object|null
	 */
	private static function get_session_by_ssa_id( $appointment_id ) {
		global $wpdb;

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::table_name() . ' WHERE ssa_appointment_id = %d LIMIT 1',
				absint( $appointment_id )
			)
		);
	}

	/**
	 * Return a raw slot row.
	 *
	 * @param int $slot_id Slot ID.
	 * @return object|null
	 */
	private static function get_slot_row( $slot_id ) {
		global $wpdb;

		self::maybe_install();

		return $wpdb->get_row(
			$wpdb->prepare(
				'SELECT * FROM ' . self::slots_table() . ' WHERE id = %d LIMIT 1',
				absint( $slot_id )
			)
		);
	}

	/**
	 * Update session fields.
	 *
	 * @param int   $session_id Session ID.
	 * @param array $fields     Fields.
	 * @return true|WP_Error
	 */
	private static function update_session_fields( $session_id, $fields ) {
		global $wpdb;

		$updated = $wpdb->update(
			self::table_name(),
			$fields,
			array( 'id' => absint( $session_id ) ),
			self::format_map( $fields ),
			array( '%d' )
		);

		return false === $updated ? new WP_Error( 'mmed_interview_update_failed', 'Interview session could not be updated.', array( 'status' => 500 ) ) : true;
	}

	/**
	 * Update slot fields.
	 *
	 * @param int   $slot_id Slot ID.
	 * @param array $fields  Fields.
	 * @return true|WP_Error
	 */
	private static function update_slot_fields( $slot_id, $fields ) {
		global $wpdb;

		$updated = $wpdb->update(
			self::slots_table(),
			$fields,
			array( 'id' => absint( $slot_id ) ),
			self::format_map( $fields ),
			array( '%d' )
		);

		return false === $updated ? new WP_Error( 'mmed_interview_slot_update_failed', 'Interview slot could not be updated.', array( 'status' => 500 ) ) : true;
	}

	/**
	 * Append an admin-only note.
	 *
	 * @param int    $session_id Session ID.
	 * @param string $note       Note.
	 * @return void
	 */
	private static function append_admin_note( $session_id, $note ) {
		$row = self::get_session_row( $session_id );
		if ( ! $row ) {
			return;
		}

		$notes = trim( (string) $row->notes );
		$notes = trim( $notes . "\n" . sanitize_textarea_field( $note ) );
		self::update_session_fields(
			$session_id,
			array(
				'notes'      => $notes,
				'updated_at' => current_time( 'mysql' ),
			)
		);
	}

	/**
	 * Sync the interview into the Matrix calendar when available.
	 *
	 * @param int $session_id Session ID.
	 * @return void
	 */
	private static function sync_calendar_event( $session_id ) {
		global $wpdb;

		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return;
		}

		$row = self::get_session_row( $session_id );
		if ( ! $row ) {
			return;
		}

		MMED_Calendar_Engine::maybe_install();

		$table     = MMED_Calendar_Engine::table_name();
		$source_id = 'interview_session_' . (int) $row->id;
		$existing  = $wpdb->get_var(
			$wpdb->prepare(
				'SELECT id FROM ' . $table . ' WHERE user_id = %d AND source = %s AND source_id = %s LIMIT 1',
				(int) $row->student_id,
				'advisor',
				$source_id
			)
		);

		$start = $row->scheduled_date . ' ' . $row->scheduled_time;
		$end   = gmdate( 'Y-m-d H:i:s', strtotime( $start . ' +' . absint( $row->duration_minutes ) . ' minutes' ) );

		$payload = array(
			'user_id'          => (int) $row->student_id,
			'event_type'       => 'mock_interview_slot',
			'title'            => 'Interview Prep Session',
			'description'      => 'Private MissionMed interview prep session.',
			'start_at'         => $start,
			'end_at'           => $end,
			'all_day'          => 0,
			'meeting_url'      => (string) $row->meeting_url,
			'meeting_platform' => $row->meeting_url ? 'webex' : '',
			'source'           => 'advisor',
			'source_id'        => $source_id,
			'category'         => 'appointment',
			'priority'         => 2,
			'status'           => 'cancelled' === $row->status ? 'cancelled' : 'active',
			'meta_json'        => wp_json_encode(
				array(
					'interview_session_id' => (int) $row->id,
					'interview_type'       => (string) $row->interview_type,
				)
			),
			'updated_at'       => current_time( 'mysql' ),
		);

		$formats = array( '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s' );

		if ( $existing ) {
			$wpdb->update( $table, $payload, array( 'id' => absint( $existing ) ), $formats, array( '%d' ) );
			return;
		}

		$payload['created_at'] = current_time( 'mysql' );
		$formats[]             = '%s';
		$wpdb->insert( $table, $payload, $formats );
	}

	/**
	 * Format a slot.
	 *
	 * @param object|null $row Slot row.
	 * @return array
	 */
	private static function format_slot( $row ) {
		if ( ! $row ) {
			return array();
		}

		$interviewer = $row->interviewer_id ? get_user_by( 'id', (int) $row->interviewer_id ) : null;

		return array(
			'id'                   => (int) $row->id,
			'interviewer_id'       => (int) $row->interviewer_id,
			'interviewer_name'     => $interviewer ? $interviewer->display_name : '',
			'slot_date'            => (string) $row->slot_date,
			'slot_time'            => (string) $row->slot_time,
			'duration_minutes'     => (int) $row->duration_minutes,
			'interview_type'       => (string) $row->interview_type,
			'status'               => (string) $row->status,
			'claimed_by'           => (int) $row->claimed_by,
			'interview_session_id' => (int) $row->interview_session_id,
		);
	}

	/**
	 * Sanitize a YYYY-MM-DD date.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitize a HH:MM or HH:MM:SS time.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	private static function sanitize_time( $value ) {
		$value = sanitize_text_field( (string) $value );
		if ( preg_match( '/^\d{2}:\d{2}$/', $value ) ) {
			$value .= ':00';
		}

		return preg_match( '/^\d{2}:\d{2}:\d{2}$/', $value ) ? $value : '';
	}

	/**
	 * Sanitize a value against an enum list.
	 *
	 * @param mixed  $value   Raw value.
	 * @param array  $allowed Allowed values.
	 * @param string $default Default value.
	 * @return string
	 */
	private static function sanitize_enum( $value, $allowed, $default ) {
		$value = sanitize_key( $value );
		return in_array( $value, $allowed, true ) ? $value : $default;
	}

	/**
	 * Sanitize a question bank.
	 *
	 * @param array $bank Question bank.
	 * @return array
	 */
	private static function sanitize_question_bank( $bank ) {
		$clean = array();
		foreach ( self::allowed_types() as $type ) {
			$items = isset( $bank[ $type ] ) && is_array( $bank[ $type ] ) ? $bank[ $type ] : array();
			$clean[ $type ] = array_values(
				array_filter(
					array_map(
						static function ( $item ) {
							return self::limit_text( sanitize_text_field( $item ), 240 );
						},
						$items
					)
				)
			);
		}

		return $clean;
	}

	/**
	 * Limit a sanitized text value safely.
	 *
	 * @param string $value Text value.
	 * @param int    $limit Character limit.
	 * @return string
	 */
	private static function limit_text( $value, $limit ) {
		$value = (string) $value;
		$limit = absint( $limit );

		if ( ! $limit ) {
			return '';
		}

		return function_exists( 'mb_substr' ) ? mb_substr( $value, 0, $limit ) : substr( $value, 0, $limit );
	}

	/**
	 * Decode JSON safely.
	 *
	 * @param mixed $value JSON value.
	 * @return array
	 */
	private static function decode_json( $value ) {
		$decoded = json_decode( (string) $value, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Return wpdb formats for a payload.
	 *
	 * @param array $payload Payload.
	 * @return array
	 */
	private static function format_map( $payload ) {
		$formats = array();
		foreach ( array_keys( $payload ) as $key ) {
			if ( in_array( $key, array( 'id', 'student_id', 'interviewer_id', 'duration_minutes', 'ssa_appointment_id', 'claimed_by', 'interview_session_id' ), true ) ) {
				$formats[] = '%d';
			} else {
				$formats[] = '%s';
			}
		}

		return $formats;
	}
}
