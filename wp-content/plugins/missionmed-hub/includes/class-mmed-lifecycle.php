<?php
/**
 * MissionMed Hub lifecycle stage detection.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMED_Lifecycle {

	/**
	 * Valid lifecycle stages.
	 *
	 * @var array
	 */
	const VALID_STAGES = array(
		'PRE_APPLICATION',
		'APPLICATION',
		'INTERVIEW',
		'MATCH_STRATEGY',
		'POST_MATCH',
		'USCE_ONBOARDING',
	);

	/**
	 * Master lifecycle detection. Checks manual override first, then computes from data.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	public static function detect_stage( $user_id ) {
		$override = get_user_meta( $user_id, '_mmed_lifecycle_stage', true );
		if ( $override && in_array( $override, self::VALID_STAGES, true ) ) {
			return self::get_stage_config( $override );
		}

		$tier     = get_user_meta( $user_id, '_mmed_program_tier', true );
		$division = get_user_meta( $user_id, '_mmed_primary_division', true );
		$phases   = MMED_Hub_Page::get_phases_for_user( $tier, self::get_tasks( $user_id ) );
		$month    = (int) current_time( 'n' );

		if ( 'clinicals' === $division ) {
			return self::get_stage_config( 'USCE_ONBOARDING' );
		}

		if ( self::all_phases_complete( $phases ) ) {
			return self::get_stage_config( 'POST_MATCH' );
		}

		$active = self::get_active_phase_id( $phases );

		if ( 'match_strategy' === $active || in_array( $month, array( 1, 2, 3 ), true ) ) {
			if ( in_array( $active, array( 'foundation', 'applications' ), true ) ) {
				return self::get_stage_config( 'APPLICATION' );
			}

			return self::get_stage_config( 'MATCH_STRATEGY' );
		}

		if ( 'interviews' === $active || in_array( $month, array( 10, 11, 12 ), true ) ) {
			if ( 'foundation' === $active ) {
				return self::get_stage_config( 'PRE_APPLICATION' );
			}

			return self::get_stage_config( 'INTERVIEW' );
		}

		if ( 'applications' === $active || in_array( $month, array( 8, 9 ), true ) ) {
			return self::get_stage_config( 'APPLICATION' );
		}

		return self::get_stage_config( 'PRE_APPLICATION' );
	}

	/**
	 * Returns messaging templates, CTA set, and display config for a given stage.
	 *
	 * @param string $stage Lifecycle stage.
	 * @return array
	 */
	public static function get_stage_config( $stage ) {
		$configs = array(
			'PRE_APPLICATION' => array(
				'stage'     => 'PRE_APPLICATION',
				'label'     => 'Pre-Application Phase',
				'messaging' => array(
					'greeting'    => 'Focus on building your foundation.',
					'status_line' => 'Your match journey is underway.',
				),
				'cta_set'   => array( 'upgrade_to_360', 'cross_division_usce', 'booking_gap' ),
			),
			'APPLICATION' => array(
				'stage'     => 'APPLICATION',
				'label'     => 'Application Phase',
				'messaging' => array(
					'greeting'    => 'Stay focused on submissions and deadlines.',
					'status_line' => 'Your application work is in motion.',
				),
				'cta_set'   => array( 'upgrade_to_360', 'booking_gap' ),
			),
			'INTERVIEW' => array(
				'stage'     => 'INTERVIEW',
				'label'     => 'Interview Phase',
				'messaging' => array(
					'greeting'    => 'Prepare for each interview with intention.',
					'status_line' => 'Interview season is active for your journey.',
				),
				'cta_set'   => array( 'booking_gap' ),
			),
			'MATCH_STRATEGY' => array(
				'stage'     => 'MATCH_STRATEGY',
				'label'     => 'Match Strategy',
				'messaging' => array(
					'greeting'    => 'Refine your rank strategy with confidence.',
					'status_line' => 'Match strategy is now the focus.',
				),
				'cta_set'   => array( 'booking_gap' ),
			),
			'POST_MATCH' => array(
				'stage'     => 'POST_MATCH',
				'label'     => 'Post-Match',
				'messaging' => array(
					'greeting'    => 'Celebrate how far you have come.',
					'status_line' => 'Your primary match journey is complete.',
				),
				'cta_set'   => array( 'post_match_alumni' ),
			),
			'USCE_ONBOARDING' => array(
				'stage'     => 'USCE_ONBOARDING',
				'label'     => 'USCE Onboarding',
				'messaging' => array(
					'greeting'    => 'Stay on top of compliance and onboarding steps.',
					'status_line' => 'Your clinical placement preparation is active.',
				),
				'cta_set'   => array( 'booking_gap' ),
			),
		);

		return $configs[ $stage ] ?? $configs['PRE_APPLICATION'];
	}

	/**
	 * Returns current match cycle dates (ERAS open, IV season, rank deadline, Match Day, SOAP).
	 *
	 * @return array
	 */
	private static function get_match_calendar() {
		$defaults = array(
			'cycle'                  => '2026-2027',
			'eras_open'              => '2026-09-07',
			'interview_season_start' => '2026-10-01',
			'interview_season_end'   => '2027-01-31',
			'rank_deadline'          => '2027-02-28',
			'match_day'              => '2027-03-14',
			'soap_start'             => '2027-03-17',
			'soap_end'               => '2027-03-21',
		);

		$stored = get_option( 'mmed_match_calendar', array() );
		return is_array( $stored ) ? array_merge( $defaults, $stored ) : $defaults;
	}

	/**
	 * Task data used for lifecycle phase detection.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_tasks( $user_id ) {
		$posts = get_posts(
			array(
				'post_type'   => 'mmed_task',
				'numberposts' => -1,
				'meta_query'  => array(
					array(
						'key'   => '_mmed_student_id',
						'value' => $user_id,
						'type'  => 'NUMERIC',
					),
				),
				'orderby'     => 'meta_value_num',
				'meta_key'    => '_mmed_sort_order',
				'order'       => 'ASC',
			)
		);

		$tasks = array();
		foreach ( $posts as $post ) {
			$tasks[] = array(
				'ID'         => $post->ID,
				'status'     => get_post_meta( $post->ID, '_mmed_status', true ) ?: 'not_started',
				'sort_order' => (int) get_post_meta( $post->ID, '_mmed_sort_order', true ),
			);
		}

		return $tasks;
	}

	/**
	 * Determine whether every phase is complete.
	 *
	 * @param array $phases Phase data.
	 * @return bool
	 */
	private static function all_phases_complete( $phases ) {
		if ( empty( $phases ) ) {
			return false;
		}

		foreach ( $phases as $phase ) {
			if ( 'complete' !== ( $phase['state'] ?? '' ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Resolve the current active phase ID.
	 *
	 * @param array $phases Phase data.
	 * @return string
	 */
	private static function get_active_phase_id( $phases ) {
		foreach ( $phases as $phase ) {
			if ( 'active' === ( $phase['state'] ?? '' ) ) {
				return (string) ( $phase['id'] ?? '' );
			}
		}

		return ! empty( $phases[0]['id'] ) ? (string) $phases[0]['id'] : '';
	}
}
