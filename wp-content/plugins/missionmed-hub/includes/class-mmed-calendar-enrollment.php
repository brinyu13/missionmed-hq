<?php
/**
 * MissionMed Calendar Enrollment Pipeline.
 *
 * Auto-populates calendar events when a student enrolls.
 * Hooks into mmed_enrollment_complete action.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Calendar auto-population on enrollment.
 */
class MMED_Calendar_Enrollment {

	const DEFAULT_EVENTS_VERSION = '20260518.1';

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'mmed_enrollment_complete', array( __CLASS__, 'on_enrollment' ), 20, 2 );
		self::maybe_seed_default_calendar_events();
	}

	/**
	 * Fired after a student is enrolled in a program.
	 *
	 * @param int    $user_id       WordPress user ID.
	 * @param string $template_slug The enrollment template (e.g. '360elite', 'usce_onboarding').
	 */
	public static function on_enrollment( $user_id, $template_slug ) {
		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return;
		}

		$sessions = self::get_session_templates( $template_slug );

		if ( empty( $sessions ) ) {
			return;
		}

		global $wpdb;
		$table = MMED_Calendar_Engine::table_name();

		foreach ( $sessions as $session ) {
			// Prevent duplicate enrollment events for same user + title + date.
			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT COUNT(*) FROM {$table} WHERE user_id = %d AND title = %s AND DATE(start_at) = %s AND source = 'enrollment'",
					$user_id,
					$session['title'],
					date( 'Y-m-d', strtotime( $session['start_at'] ) )
				)
			);

			if ( $exists ) {
				continue;
			}

			$wpdb->insert(
				$table,
				array(
					'user_id'          => $user_id,
					'title'            => sanitize_text_field( $session['title'] ),
					'description'      => wp_kses_post( $session['description'] ?? '' ),
					'start_at'         => $session['start_at'],
					'end_at'           => $session['end_at'],
						'all_day'          => ! empty( $session['all_day'] ) ? 1 : 0,
						'event_type'       => sanitize_key( $session['event_type'] ?? 'mr_session' ),
						'source'           => 'enrollment',
						'source_group_id'  => absint( $session['source_group_id'] ?? 0 ),
						'meeting_url'      => esc_url_raw( $session['meeting_url'] ?? '' ),
						'meeting_platform' => self::sanitize_platform( $session['meeting_platform'] ?? '' ),
						'created_at'       => current_time( 'mysql' ),
					'updated_at'       => current_time( 'mysql' ),
				)
			);
		}
	}

	/**
	 * Seed system events once per default event version.
	 *
	 * @return void
	 */
	public static function maybe_seed_default_calendar_events() {
		if ( get_option( 'mmed_calendar_default_events_version' ) === self::DEFAULT_EVENTS_VERSION ) {
			return;
		}

		self::seed_default_calendar_events();
		update_option( 'mmed_calendar_default_events_version', self::DEFAULT_EVENTS_VERSION, false );
	}

	/**
	 * Seed Match 2027 and Dr. J drill default events.
	 *
	 * @return array
	 */
	public static function seed_default_calendar_events() {
		if ( ! class_exists( 'MMED_Calendar_Engine' ) ) {
			return array(
				'created' => 0,
				'skipped' => 0,
			);
		}

		MMED_Calendar_Engine::maybe_install();

		global $wpdb;
		$table   = MMED_Calendar_Engine::table_name();
		$created = 0;
		$skipped = 0;
		$now     = current_time( 'mysql' );

		foreach ( self::default_system_events() as $event ) {
			$exists = $wpdb->get_var(
				$wpdb->prepare(
					"SELECT id FROM {$table} WHERE user_id = 0 AND title = %s AND start_at = %s AND source = 'system' LIMIT 1",
					$event['title'],
					$event['start_at']
				)
			);

			if ( $exists ) {
				$skipped++;
				continue;
			}

			$inserted = $wpdb->insert(
				$table,
				array(
					'user_id'     => 0,
					'event_type'  => sanitize_key( $event['event_type'] ),
					'title'       => sanitize_text_field( $event['title'] ),
					'description' => wp_kses_post( $event['description'] ?? '' ),
					'start_at'    => $event['start_at'],
					'end_at'      => $event['end_at'] ?? null,
					'all_day'     => ! empty( $event['all_day'] ) ? 1 : 0,
					'source'      => 'system',
					'source_id'   => sanitize_key( $event['source_id'] ?? '' ),
					'category'    => sanitize_key( $event['category'] ?? $event['event_type'] ),
					'priority'    => absint( $event['priority'] ?? 0 ),
					'status'      => 'active',
					'meta_json'   => ! empty( $event['meta'] ) ? wp_json_encode( self::sanitize_event_meta( $event['meta'] ) ) : null,
					'created_at'  => $now,
					'updated_at'  => $now,
				),
				array( '%d', '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s' )
			);

			if ( false !== $inserted ) {
				$created++;
			}
		}

		return array(
			'created' => $created,
			'skipped' => $skipped,
		);
	}

	/**
	 * Build default system event list.
	 *
	 * @return array
	 */
	private static function default_system_events() {
		return array_merge( self::match_2027_events(), self::dr_j_drill_events() );
	}

	/**
	 * Match 2027 system events.
	 *
	 * @return array
	 */
	private static function match_2027_events() {
		$items = array(
			array( '2026-06-01 00:00:00', '2026-09-23 23:59:00', 'Research Programs', 'Use the Program Directory to explore over 6,000 PGY-1 and PGY-2 programs.', true, 'registration' ),
			array( '2026-09-15 12:00:00', '2026-09-15 13:00:00', 'Registration Opens', 'Match Registration opens. Create R3 account. Standard registration runs until Jan 29.', false, 'registration' ),
			array( '2027-01-29 23:59:00', '2027-01-30 00:30:00', 'Standard Registration Deadline', '$50 late fee after this date.', false, 'registration' ),
			array( '2027-02-01 12:00:00', '2027-02-01 13:00:00', 'Ranking Opens', 'Login to R3 to build Rank Order List. Quotas finalized.', false, 'ranking' ),
			array( '2027-03-03 21:00:00', '2027-03-03 22:00:00', 'Rank Order List Certification Deadline', 'Credential verification deadline for schools and IMGs.', false, 'ranking' ),
			array( '2027-03-03 21:00:00', '2027-03-03 22:00:00', 'Registration Deadline', 'Late registration and withdrawal deadline.', false, 'ranking' ),
			array( '2027-03-15 10:00:00', '2027-03-15 11:00:00', 'Applicant Match Status Available', 'Learn if matched by email and R3.', false, 'match_week' ),
			array( '2027-03-15 10:00:00', '2027-03-15 11:00:00', 'SOAP Begins', 'SOAP-eligible applicants access List of Unfilled Programs.', false, 'match_week' ),
			array( '2027-03-15 11:00:00', '2027-03-15 12:00:00', 'SOAP Applicants Can Start Preparing', 'Contact application services.', false, 'match_week' ),
			array( '2027-03-16 08:00:00', '2027-03-16 09:00:00', 'Programs Begin Reviewing SOAP Applications', 'Programs may contact and interview applicants.', false, 'match_week' ),
			array( '2027-03-18 09:00:00', '2027-03-18 11:00:00', 'SOAP Round 1', 'Offers at 9 AM. Deadline 11 AM.', false, 'match_week' ),
			array( '2027-03-18 12:00:00', '2027-03-18 14:00:00', 'SOAP Round 2', 'Offers at noon. Deadline 2 PM.', false, 'match_week' ),
			array( '2027-03-18 15:00:00', '2027-03-18 17:00:00', 'SOAP Round 3', 'Offers at 3 PM. Deadline 5 PM.', false, 'match_week' ),
			array( '2027-03-18 18:00:00', '2027-03-18 20:00:00', 'SOAP Round 4', 'Offers at 6 PM. Deadline 8 PM.', false, 'match_week' ),
			array( '2027-03-18 21:00:00', '2027-03-18 22:00:00', 'SOAP Ends', 'Final List of Unfilled Programs posted.', false, 'match_week' ),
			array( '2027-03-19 12:00:00', '2027-03-19 13:00:00', 'MATCH DAY', 'Results available, ceremonies, Advance Data Tables.', false, 'match_week' ),
		);

		$events = array();
		foreach ( $items as $index => $item ) {
			$events[] = array(
				'title'       => $item[2],
				'description' => $item[3],
				'start_at'    => $item[0],
				'end_at'      => $item[1],
				'all_day'     => $item[4],
				'event_type'  => 'nrmp_date',
				'category'    => 'nrmp_date',
				'priority'    => 8,
				'source_id'   => 'match_2027_' . ( $index + 1 ),
				'meta'        => array(
					'match_2027' => true,
					'phase'      => $item[5],
					'match_day'  => 'MATCH DAY' === $item[2],
				),
			);
		}

		return $events;
	}

	/**
	 * Dr. J drill schedule system events.
	 *
	 * @return array
	 */
	private static function dr_j_drill_events() {
		$rows = array(
			array( '2026-05-11', '13:00:00', 'Immuno', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-11', '14:15:00', 'Preventative / Vaccines / Vitamins', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-12', '13:00:00', 'Muscle / Rheum', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-12', '14:15:00', 'Rheum', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-13', '13:00:00', 'Endocrine', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-13', '14:15:00', 'Endocrine', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-14', '13:00:00', 'Neuro', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-14', '14:15:00', 'Neuro', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-15', '13:00:00', 'Derm / Ophtho', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-15', '14:15:00', 'Derm / Ophtho', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-18', '13:00:00', 'Micro / Inf. Disease', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-18', '14:15:00', 'Inf. Disease', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-19', '13:00:00', 'Viruses / Protozoa / Parasites', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-19', '14:15:00', 'Surgery', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-20', '13:00:00', 'GIT / HEP', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-20', '14:15:00', 'GIT / HEP', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-21', '13:00:00', 'Psych', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-21', '14:15:00', 'Psych', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-22', '13:00:00', 'Ethics', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-22', '14:15:00', 'Ethics', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-26', '13:00:00', 'Repro / GYN / OB', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-26', '14:15:00', 'OB / GYN', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-27', '13:00:00', 'Biochem / Genetics / Vitamins', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-27', '14:15:00', 'Peds', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-28', '13:00:00', 'Renal / GU', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-28', '14:15:00', 'Renal / GU / Electrolytes', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-05-29', '13:00:00', 'ER Medicine (Bites / Hypo-Hyperthermia / Toxicology / Overdose)', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-05-29', '14:15:00', 'ER Medicine (Bites / Hypo-Hyperthermia / Toxicology / Overdose)', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-06-01', '13:00:00', 'Heme / Onc', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-06-01', '14:15:00', 'Heme / Onc', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-06-02', '13:00:00', 'Cardio', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-06-02', '14:15:00', 'Cardio', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-06-03', '13:00:00', 'Biostats / Public Safety', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-06-03', '14:15:00', 'Biostats / Public Safety', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-06-04', '13:00:00', 'Pulmonary', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-06-04', '14:15:00', 'Pulmonary', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
			array( '2026-06-05', '13:00:00', 'MIXED REVIEW', 'Step 1 / COMLEX 1', 'drill_step1' ),
			array( '2026-06-05', '14:15:00', 'MIXED REVIEW', 'Step 2-3 / COMLEX 2-3', 'drill_step23' ),
		);

		$events = array(
			array(
				'title'       => 'MEMORIAL DAY - NO GROUPS',
				'description' => 'Holiday. No Dr. J drill groups scheduled.',
				'start_at'    => '2026-05-25 00:00:00',
				'end_at'      => '2026-05-25 23:59:00',
				'all_day'     => true,
				'event_type'  => 'general',
				'category'    => 'general',
				'priority'    => 2,
				'source_id'   => 'drj_2026_memorial_day',
				'meta'        => array( 'drj_default' => true, 'holiday' => true ),
			),
		);

		foreach ( $rows as $index => $row ) {
			$start = $row[0] . ' ' . $row[1];
			$end   = date( 'Y-m-d H:i:s', strtotime( $start . ' +60 minutes' ) );
			$events[] = array(
				'title'       => 'Dr. J Drill: ' . $row[2],
				'description' => $row[3],
				'start_at'    => $start,
				'end_at'      => $end,
				'all_day'     => false,
				'event_type'  => $row[4],
				'category'    => $row[4],
				'priority'    => 5,
				'source_id'   => 'drj_2026_' . ( $index + 1 ),
				'meta'        => array(
					'drj_default' => true,
					'subtitle'    => $row[3],
					'topic'       => $row[2],
				),
			);
		}

		return $events;
	}

	/**
	 * Sanitize system event metadata.
	 *
	 * @param array $meta Metadata.
	 * @return array
	 */
	private static function sanitize_event_meta( $meta ) {
		$clean = array();
		foreach ( $meta as $key => $value ) {
			$key = sanitize_key( $key );
			if ( is_bool( $value ) ) {
				$clean[ $key ] = $value;
			} elseif ( is_numeric( $value ) ) {
				$clean[ $key ] = 0 + $value;
			} else {
				$clean[ $key ] = sanitize_text_field( (string) $value );
			}
		}
		return $clean;
	}

	/**
	 * Get session templates for an enrollment tier.
	 *
	 * Session data is stored in a WP option so admins can update
	 * without code changes. Falls back to built-in defaults.
	 *
	 * @param string $template_slug Enrollment template slug.
	 * @return array Array of event data arrays.
	 */
	public static function get_session_templates( $template_slug ) {
		$custom = get_option( 'mmed_calendar_sessions_' . sanitize_key( $template_slug ), array() );

			if ( ! empty( $custom ) && is_array( $custom ) ) {
				return $custom;
			}

			if ( class_exists( 'MMED_Session_Manager' ) ) {
				$dynamic = MMED_Session_Manager::get_sessions_for_template( $template_slug );
				if ( ! empty( $dynamic ) && is_array( $dynamic ) ) {
					return $dynamic;
				}
			}

			return self::default_session_templates( $template_slug );
		}

	/**
	 * Built-in session templates.
	 *
	 * These serve as defaults until admin configures custom sessions
	 * via the Matrix admin panel or REST API.
	 *
	 * @param string $slug Template slug.
	 * @return array
	 */
	private static function default_session_templates( $slug ) {
		$templates = array(
			'360elite'          => self::build_360elite_sessions(),
			'360elite_onboarding' => self::build_360elite_sessions(),
			'usce_onboarding'   => self::build_usce_sessions(),
		);

		return isset( $templates[ $slug ] ) ? $templates[ $slug ] : array();
	}

	/**
	 * 360 Elite default session schedule.
	 *
	 * @return array
	 */
	private static function build_360elite_sessions() {
		$sessions = array();

		// Session A schedule (Webex, Wednesdays at 8 PM ET).
		$session_a_dates = self::get_weekly_dates( 'Wednesday', '2026-06-03', '2026-12-16' );
		foreach ( $session_a_dates as $date ) {
			$sessions[] = array(
				'title'            => 'Mission Residency - Session A',
				'description'      => 'Live group coaching session with Dr. Brian. Topics: ERAS strategy, personal statement review, and application timeline management.',
				'start_at'         => $date . ' 20:00:00',
				'end_at'           => $date . ' 21:30:00',
				'event_type'       => 'mr_session',
				'meeting_url'      => 'https://missionmedinstitute.my.webex.com/meet/missionmedtv',
				'meeting_platform' => 'webex',
			);
		}

		// Session B schedule (Webex, Saturdays at 10 AM ET).
		$session_b_dates = self::get_weekly_dates( 'Saturday', '2026-06-06', '2026-12-19' );
		foreach ( $session_b_dates as $date ) {
			$sessions[] = array(
				'title'            => 'Mission Residency - Session B',
				'description'      => 'Live group coaching session with Dr. Brian. Topics: interview prep, program research, and match list strategy.',
				'start_at'         => $date . ' 10:00:00',
				'end_at'           => $date . ' 11:30:00',
				'event_type'       => 'mr_session',
				'meeting_url'      => 'https://missionmedinstitute.my.webex.com/meet/missionmedtv',
				'meeting_platform' => 'webex',
			);
		}

		// Dr. J Drills - Step 1 (Zoom, Thursdays at 7 PM ET).
		$drill1_dates = self::get_weekly_dates( 'Thursday', '2026-06-04', '2026-12-17' );
		foreach ( $drill1_dates as $date ) {
			$sessions[] = array(
				'title'            => "Dr. J's Drill - Step/Level 1",
				'description'      => 'Medical knowledge drill session. Rapid-fire Q&A format targeting high-yield Step 1 topics.',
				'start_at'         => $date . ' 19:00:00',
				'end_at'           => $date . ' 20:00:00',
				'event_type'       => 'drill_step1',
				'meeting_url'      => 'https://us06web.zoom.us/j/missionmeddrills',
				'meeting_platform' => 'zoom',
			);
		}

		// Dr. J Drills - Step 2/3 (Zoom, Fridays at 7 PM ET).
		$drill23_dates = self::get_weekly_dates( 'Friday', '2026-06-05', '2026-12-18' );
		foreach ( $drill23_dates as $date ) {
			$sessions[] = array(
				'title'            => "Dr. J's Drill - Step/Level 2/3",
				'description'      => 'Clinical knowledge drill session. Case-based format targeting CK/Step 3 concepts.',
				'start_at'         => $date . ' 19:00:00',
				'end_at'           => $date . ' 20:00:00',
				'event_type'       => 'drill_step23',
				'meeting_url'      => 'https://us06web.zoom.us/j/missionmeddrills',
				'meeting_platform' => 'zoom',
			);
		}

		// Key NRMP dates.
		$sessions[] = array(
			'title'       => 'ERAS Opens',
			'description' => 'ERAS application portal opens for the 2027 Match cycle.',
			'start_at'    => '2026-09-01 00:00:00',
			'end_at'      => '2026-09-01 23:59:00',
			'all_day'     => true,
			'event_type'  => 'nrmp_date',
		);
		$sessions[] = array(
			'title'       => 'NRMP Rank Order List Deadline',
			'description' => 'Final deadline to submit your rank order list to the NRMP.',
			'start_at'    => '2027-02-26 00:00:00',
			'end_at'      => '2027-02-26 23:59:00',
			'all_day'     => true,
			'event_type'  => 'nrmp_date',
		);
		$sessions[] = array(
			'title'       => 'Match Day',
			'description' => 'NRMP Match results released.',
			'start_at'    => '2027-03-21 00:00:00',
			'end_at'      => '2027-03-21 23:59:00',
			'all_day'     => true,
			'event_type'  => 'nrmp_date',
		);

		return $sessions;
	}

	/**
	 * USCE onboarding default session schedule.
	 *
	 * @return array
	 */
	private static function build_usce_sessions() {
		return array(
			array(
				'title'       => 'USCE Orientation Webinar',
				'description' => 'Mandatory orientation covering compliance requirements, documentation expectations, and site-specific protocols.',
				'start_at'    => '2026-06-15 18:00:00',
				'end_at'      => '2026-06-15 19:30:00',
				'event_type'  => 'mr_session',
				'meeting_url' => 'https://missionmedinstitute.my.webex.com/meet/missionmedtv',
				'meeting_platform' => 'webex',
			),
		);
	}

	/**
	 * Generate weekly date strings for a given day of week within a range.
	 *
	 * @param string $day_name  Day of week (e.g. 'Wednesday').
	 * @param string $start     Start date (Y-m-d).
	 * @param string $end       End date (Y-m-d).
	 * @return array Array of Y-m-d date strings.
	 */
	private static function get_weekly_dates( $day_name, $start, $end ) {
		$dates   = array();
		$current = strtotime( "next {$day_name}", strtotime( $start ) - 86400 );
		$end_ts  = strtotime( $end );

		if ( strtotime( $start ) === strtotime( date( 'Y-m-d', $current ) ) ) {
			// Start date IS the target day, include it.
		} elseif ( date( 'l', strtotime( $start ) ) === $day_name ) {
			$current = strtotime( $start );
		}

		while ( $current <= $end_ts ) {
			$dates[] = date( 'Y-m-d', $current );
			$current = strtotime( '+7 days', $current );
		}

		return $dates;
	}

	/**
	 * Sanitize meeting platform value.
	 *
	 * @param string $platform Platform string.
	 * @return string
	 */
	private static function sanitize_platform( $platform ) {
		$allowed = array( 'webex', 'zoom', 'google_meet', 'teams', '' );
		return in_array( $platform, $allowed, true ) ? $platform : '';
	}
}
