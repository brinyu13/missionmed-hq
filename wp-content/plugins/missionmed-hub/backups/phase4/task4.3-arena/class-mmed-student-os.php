<?php
/**
 * MissionMed Matrix controller.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Feature-flagged Student OS shell controller.
 */
class MMED_Student_OS {

	/**
	 * Feature flag option name.
	 */
	const OPTION_ENABLED = 'mmed_student_os_enabled';

	/**
	 * Initialize Matrix hooks.
	 *
	 * @return void
	 */
	public static function init() {
		// Hook reserved for Matrix module registration in subsequent tasks.
	}

	/**
	 * Determine whether Matrix is enabled.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		return (bool) get_option( self::OPTION_ENABLED, false );
	}

	/**
	 * Enqueue Matrix shell assets.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		if ( ! self::is_enabled() ) {
			return;
		}

		$css_path = MMED_HUB_PATH . 'assets/student-os.css';
		$js_path  = MMED_HUB_PATH . 'assets/student-os.js';

		wp_enqueue_style(
			'mmed-student-os-css',
			MMED_HUB_URL . 'assets/student-os.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : MMED_HUB_VERSION
		);

		wp_enqueue_script(
			'mmed-student-os-js',
			MMED_HUB_URL . 'assets/student-os.js',
			array(),
			file_exists( $js_path ) ? (string) filemtime( $js_path ) : MMED_HUB_VERSION,
			true
		);
	}

	/**
	 * Render the Matrix shell template.
	 *
	 * @return string
	 */
	public static function render_shell() {
		if ( ! is_user_logged_in() ) {
			wp_redirect( wp_login_url( get_permalink() ) );
			exit;
		}

		$template = MMED_HUB_PATH . 'templates/student-os-shell.php';
		if ( ! file_exists( $template ) ) {
			return '';
		}

		ob_start();
		include $template;
		return ob_get_clean();
	}

	/**
	 * Return initial real WordPress data for the Matrix shell.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_initial_data( $user_id ) {
		$user_id = absint( $user_id );

		return array(
			'profile' => self::get_profile_data( $user_id ),
			'stats'   => self::get_shell_stats( $user_id ),
			'modules' => self::get_active_modules(),
		);
	}

	/**
	 * Get the active module registry.
	 *
	 * @return array
	 */
	private static function get_active_modules() {
		$modules = array();

		if ( class_exists( 'MMED_Calendar_Engine' ) ) {
			$modules[] = array(
				'id'      => 'calendar',
				'route'   => 'calendar',
				'label'   => 'Calendar',
				'icon'    => 'Cal',
				'section' => 'Planning',
			);
		}

		$modules[] = array(
			'id'      => 'courses',
			'route'   => 'courses',
			'label'   => 'My Courses',
			'icon'    => 'Cr',
			'section' => 'Learning',
		);

		$modules[] = array(
			'id'      => 'orders',
			'route'   => 'orders',
			'label'   => 'Orders',
			'icon'    => 'Or',
			'section' => 'Account',
		);

		$modules[] = array(
			'id'      => 'settings',
			'route'   => 'settings',
			'label'   => 'Settings',
			'icon'    => 'St',
			'section' => 'Account',
		);

		$modules[] = array(
			'id'      => 'notifications',
			'route'   => 'notifications',
			'label'   => 'Notifications',
			'icon'    => 'Nt',
			'section' => 'Account',
		);

		$modules[] = array(
			'id'      => 'messages',
			'route'   => 'messages',
			'label'   => 'Messages',
			'icon'    => 'Ms',
			'section' => 'Account',
		);

		$modules[] = array(
			'id'      => 'help',
			'route'   => 'help',
			'label'   => 'Help',
			'icon'    => '?',
			'section' => 'Support',
		);

		if ( class_exists( 'MMED_File_Vault' ) ) {
			$modules[] = array(
				'id'      => 'filevault',
				'route'   => 'filevault',
				'label'   => 'File Vault',
				'icon'    => 'Fv',
				'section' => 'Documents',
			);
		}

		if ( class_exists( 'MMED_Study_Schedule' ) ) {
			$modules[] = array(
				'id'      => 'study',
				'route'   => 'study',
				'label'   => 'Study Schedule',
				'icon'    => 'Sd',
				'section' => 'Learning',
			);
		}

		if ( class_exists( 'MMED_Ranklist' ) ) {
			$modules[] = array(
				'id'      => 'ranklist',
				'route'   => 'ranklist',
				'label'   => 'RankList IQ',
				'icon'    => 'RL',
				'section' => 'Match Prep',
			);
		}

		if ( class_exists( 'MMED_LOR_Writer' ) ) {
			$modules[] = array(
				'id'      => 'lor',
				'route'   => 'lor',
				'label'   => 'LOR Writer',
				'icon'    => 'LR',
				'section' => 'Match Prep',
			);
		}

		return $modules;
	}

	/**
	 * Build current user profile data from WordPress and Hub meta.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_profile_data( $user_id ) {
		$user            = get_user_by( 'id', $user_id );
		$program_tier    = get_user_meta( $user_id, '_mmed_program_tier', true );
		$division        = get_user_meta( $user_id, '_mmed_primary_division', true );
		$placement_ready = '1' === get_user_meta( $user_id, '_mmed_placement_ready', true );
		$task_counts     = self::get_task_counts( $user_id );

		return array(
			'id'              => $user_id,
			'display_name'    => $user ? $user->display_name : '',
			'email'           => $user ? $user->user_email : '',
			'division'        => $division,
			'program_tier'    => $program_tier,
			'enrolled_date'   => get_user_meta( $user_id, '_mmed_enrolled_date', true ),
			'placement_ready' => $placement_ready,
			'avatar_url'      => get_avatar_url( $user_id ),
			'tasks'           => $task_counts,
			'phase'           => self::get_phase_data( $user_id, $program_tier ),
		);
	}

	/**
	 * Get shell-level stats from currently available real sources.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_shell_stats( $user_id ) {
		$task_counts      = self::get_task_counts( $user_id );
		$enrolled_courses = function_exists( 'learndash_user_get_enrolled_courses' )
			? learndash_user_get_enrolled_courses( $user_id )
			: array();

		return array(
			'active_courses' => is_array( $enrolled_courses ) ? count( $enrolled_courses ) : 0,
			'tasks_total'    => $task_counts['total'],
			'tasks_approved' => $task_counts['approved'],
		);
	}

	/**
	 * Count assigned Hub tasks for a student.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_task_counts( $user_id ) {
		$tasks = self::get_user_task_ids( $user_id );

		$approved = 0;
		foreach ( $tasks as $task_id ) {
			if ( 'approved' === get_post_meta( $task_id, '_mmed_status', true ) ) {
				$approved++;
			}
		}

		return array(
			'total'    => count( $tasks ),
			'approved' => $approved,
		);
	}

	/**
	 * Get assigned Hub task IDs for a student.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_user_task_ids( $user_id ) {
		return get_posts(
			array(
				'post_type'   => 'mmed_task',
				'numberposts' => -1,
				'fields'      => 'ids',
				'orderby'     => 'meta_value_num',
				'meta_key'    => '_mmed_sort_order',
				'order'       => 'ASC',
				'meta_query'  => array(
					array(
						'key'   => '_mmed_student_id',
						'value' => $user_id,
					),
				),
			)
		);
	}

	/**
	 * Build phase progress from the existing Hub task phase model.
	 *
	 * @param int    $user_id      WordPress user ID.
	 * @param string $program_tier Program tier.
	 * @return array
	 */
	private static function get_phase_data( $user_id, $program_tier ) {
		$phase_map = self::get_phase_map();
		$tier      = '360elite_onboarding' === $program_tier ? '360elite' : $program_tier;

		if ( ! isset( $phase_map[ $tier ] ) ) {
			return array(
				'current'       => '',
				'current_index' => 0,
				'total_phases'  => 0,
				'phases'        => array(),
			);
		}

		$task_statuses = self::get_task_statuses_by_order( $user_id );
		$phases        = array();
		$current_index = 0;

		foreach ( $phase_map[ $tier ] as $index => $phase ) {
			$complete = true;
			foreach ( $phase['tasks'] as $task_order ) {
				if ( empty( $task_statuses[ $task_order ] ) || 'approved' !== $task_statuses[ $task_order ] ) {
					$complete = false;
					break;
				}
			}

			if ( ! $complete && 0 === $current_index ) {
				$current_index = $index;
			}

			$phases[] = array(
				'id'       => $phase['id'],
				'name'     => $phase['name'],
				'complete' => $complete,
			);
		}

		if ( ! empty( $phases ) && count( $phases ) === count( array_filter( $phases, static function ( $phase ) {
			return ! empty( $phase['complete'] );
		} ) ) ) {
			$current_index = count( $phases ) - 1;
		}

		return array(
			'current'       => $phases[ $current_index ]['id'] ?? '',
			'current_index' => $current_index,
			'total_phases'  => count( $phases ),
			'phases'        => $phases,
		);
	}

	/**
	 * Get task statuses keyed by sort order.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_task_statuses_by_order( $user_id ) {
		$statuses = array();
		foreach ( self::get_user_task_ids( $user_id ) as $task_id ) {
			$sort_order = absint( get_post_meta( $task_id, '_mmed_sort_order', true ) );
			if ( $sort_order ) {
				$statuses[ $sort_order ] = get_post_meta( $task_id, '_mmed_status', true );
			}
		}

		return $statuses;
	}

	/**
	 * Existing Hub phase map replicated for the Matrix shell payload.
	 *
	 * @return array
	 */
	private static function get_phase_map() {
		return array(
			'360elite'        => array(
				array(
					'id'    => 'foundation',
					'name'  => 'Foundation',
					'tasks' => array( 1, 2, 3 ),
				),
				array(
					'id'    => 'applications',
					'name'  => 'Applications',
					'tasks' => array( 4, 5, 6 ),
				),
				array(
					'id'    => 'interviews',
					'name'  => 'Interviews',
					'tasks' => array( 7, 8, 9 ),
				),
				array(
					'id'    => 'match_strategy',
					'name'  => 'Match Strategy',
					'tasks' => array( 10, 11, 12 ),
				),
			),
			'usce_onboarding' => array(
				array(
					'id'    => 'compliance',
					'name'  => 'Compliance',
					'tasks' => array( 1, 2 ),
				),
				array(
					'id'    => 'certifications',
					'name'  => 'Certifications',
					'tasks' => array( 3, 4 ),
				),
				array(
					'id'    => 'clearance',
					'name'  => 'Clearance',
					'tasks' => array( 5, 6, 7 ),
				),
			),
		);
	}
}
