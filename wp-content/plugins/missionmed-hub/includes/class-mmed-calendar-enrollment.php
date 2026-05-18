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

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'mmed_enrollment_complete', array( __CLASS__, 'on_enrollment' ), 20, 2 );
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
					'meeting_url'      => esc_url_raw( $session['meeting_url'] ?? '' ),
					'meeting_platform' => self::sanitize_platform( $session['meeting_platform'] ?? '' ),
					'created_at'       => current_time( 'mysql' ),
					'updated_at'       => current_time( 'mysql' ),
				)
			);
		}
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
		// Priority 1: Dynamic session groups from DB.
		if ( class_exists( 'MMED_Session_Manager' ) ) {
			$dynamic = MMED_Session_Manager::get_sessions_for_template( $template_slug );
			if ( ! empty( $dynamic ) ) {
				return $dynamic;
			}
		}

		// Priority 2: WP option overrides.
		$custom = get_option( 'mmed_calendar_sessions_' . sanitize_key( $template_slug ), array() );

		if ( ! empty( $custom ) && is_array( $custom ) ) {
			return $custom;
		}

		// Priority 3: Hardcoded defaults.
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
