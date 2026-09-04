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
	 * Runtime v2 feature flag option name.
	 */
	const OPTION_RUNTIME_V2 = 'mmed_matrix_runtime_v2';

	/**
	 * LearnDash course that unlocks the StoryForge student bootstrap workspace.
	 */
	const STORYFORGE_COURSE_ID = 3893;

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

		$css_path           = MMED_HUB_PATH . 'assets/student-os.css';
		$js_asset           = 'student-os.16ca42c53ca2e890.js';
		$js_path            = MMED_HUB_PATH . 'assets/' . $js_asset;
		$scheduler_mount_js = MMED_HUB_PATH . 'assets/scheduler-mount.js';
		$runtime_v2_enabled = self::is_runtime_v2_enabled();
		$calendar_experience = class_exists( 'MMED_Calendar_Experience' )
			? MMED_Calendar_Experience::bootstrap()
			: array( 'experience' => 'classic', 'forced' => false );

		wp_enqueue_style(
			'mmed-student-os-css',
			MMED_HUB_URL . 'assets/student-os.css',
			array(),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : MMED_HUB_VERSION
		);

		wp_enqueue_script(
			'mmed-student-os-js',
			MMED_HUB_URL . 'assets/' . $js_asset,
			array(),
			null,
			true
		);

		wp_localize_script(
			'mmed-student-os-js',
			'mmedStudentOsFeatureFlags',
			array(
				'feature_flags' => self::get_feature_flags(),
				'calendar_experience' => $calendar_experience,
				'runtime_v2'    => array(
					'enabled' => $runtime_v2_enabled,
					'flag'    => self::OPTION_RUNTIME_V2,
					'assets'  => self::get_runtime_v2_assets(),
				),
			)
		);

		self::optimize_runtime_v2_member_dashboard_assets( $runtime_v2_enabled );

		/* MX-DASH-6000C: Dashboard 2.0 renderer for the #dashboard route (server-resolved; Classic untouched). */
		if ( class_exists( 'MMED_Dashboard_Experience' ) ) {
			MMED_Dashboard_Experience::enqueue_assets();

			/*
			 * MX-DASH-6010B: the public CDN strips WordPress's `ver` query string,
			 * so the administrator-only morph canary needs immutable filenames.
			 * Students retain the established handles and bytes until Founder approval.
			 */
			if ( current_user_can( 'manage_options' ) && 'matrix2' === MMED_Dashboard_Experience::resolve() ) {
				wp_dequeue_style( 'mmed-dashboard-v2-css' );
				wp_deregister_style( 'mmed-dashboard-v2-css' );
				wp_enqueue_style(
					'mmed-dashboard-v2-css',
					MMED_HUB_URL . 'assets/dashboard-v2/mmed-dashboard-v2.6010b-polish.css',
					array( 'mmed-student-os-css' ),
					null
				);

				wp_dequeue_script( 'mmed-dashboard-v2-js' );
				wp_deregister_script( 'mmed-dashboard-v2-js' );
				wp_enqueue_script(
					'mmed-dashboard-v2-js',
					MMED_HUB_URL . 'assets/dashboard-v2/mmed-dashboard-v2.6010b-polish.js',
					array( 'mmed-student-os-js', 'mmed-dashboard-v2-art-js' ),
					null,
					true
				);
				wp_localize_script(
					'mmed-dashboard-v2-js',
					'mmedDashboardV2',
					MMED_Dashboard_Experience::bootstrap( 'matrix2', false, true )
				);
			}
		}

		$file_vault_css        = MMED_HUB_PATH . 'assets/student-os-file-vault.css';
		$file_vault_js         = MMED_HUB_PATH . 'assets/student-os-file-vault.js';
		$file_vault_ui_version = 'mm064-006d-fidelity';

		if ( file_exists( $file_vault_css ) ) {
			wp_enqueue_style(
				'mmed-student-os-file-vault-css',
				MMED_HUB_URL . 'assets/student-os-file-vault.css',
				array( 'mmed-student-os-css' ),
				filemtime( $file_vault_css ) . '-' . $file_vault_ui_version
			);
		}

		if ( $runtime_v2_enabled ) {
			return;
		}

		if ( file_exists( $file_vault_js ) ) {
			wp_enqueue_script(
				'mmed-student-os-file-vault-js',
				MMED_HUB_URL . 'assets/student-os-file-vault.js',
				array( 'mmed-student-os-js' ),
				filemtime( $file_vault_js ) . '-' . $file_vault_ui_version,
				true
			);
		}

		if ( file_exists( $scheduler_mount_js ) ) {
			wp_enqueue_script(
				'mmed-scheduler-mount-js',
				MMED_HUB_URL . 'assets/scheduler-mount.js',
				array( 'mmed-student-os-js' ),
				(string) filemtime( $scheduler_mount_js ),
				true
			);
		}

		/* Calendar shared core plus exactly one server-resolved renderer. */
		$calendar_is_v2 = 'storyforge' === ( $calendar_experience['experience'] ?? 'classic' );
		$core_js       = MMED_HUB_PATH . 'assets/calendar-core/mmed-calendar-core.js';
		$renderer_css  = $calendar_is_v2
			? MMED_HUB_PATH . 'assets/calendar-v2/mmed-calendar-v2.css'
			: MMED_HUB_PATH . 'assets/student-os-calendar-v4.css';
		$renderer_js   = $calendar_is_v2
			? MMED_HUB_PATH . 'assets/calendar-v2/mmed-calendar-v2.js'
			: MMED_HUB_PATH . 'assets/student-os-calendar-v4.js';
		$renderer_css_url = $calendar_is_v2
			? MMED_HUB_URL . 'assets/calendar-v2/mmed-calendar-v2.css'
			: MMED_HUB_URL . 'assets/student-os-calendar-v4.css';
		$renderer_js_url = $calendar_is_v2
			? MMED_HUB_URL . 'assets/calendar-v2/mmed-calendar-v2.js'
			: MMED_HUB_URL . 'assets/student-os-calendar-v4.js';
		$renderer_style_handle = $calendar_is_v2 ? 'mmed-student-os-calendar-v2-css' : 'mmed-student-os-cal4-css';
		$renderer_script_handle = $calendar_is_v2 ? 'mmed-student-os-calendar-v2-js' : 'mmed-student-os-cal4-js';

		wp_enqueue_style(
			$renderer_style_handle,
			$renderer_css_url,
			array( 'mmed-student-os-css' ),
			file_exists( $renderer_css ) ? (string) filemtime( $renderer_css ) : MMED_HUB_VERSION
		);

		wp_enqueue_script(
			'mmed-calendar-core-js',
			MMED_HUB_URL . 'assets/calendar-core/mmed-calendar-core.js',
			array( 'mmed-student-os-js' ),
			file_exists( $core_js ) ? (string) filemtime( $core_js ) : MMED_HUB_VERSION,
			true
		);

		wp_enqueue_script(
			$renderer_script_handle,
			$renderer_js_url,
			array( 'mmed-calendar-core-js' ),
			file_exists( $renderer_js ) ? (string) filemtime( $renderer_js ) : MMED_HUB_VERSION,
			true
		);

		$live_css  = MMED_HUB_PATH . 'assets/student-os-live-session.css';
		$live_js   = MMED_HUB_PATH . 'assets/student-os-live-session.js';
		$live_deps = array( $renderer_script_handle );
		$widget_js = MMED_HUB_PATH . 'assets/webex-widget-bundle.min.js';

		if (
			class_exists( 'MMED_Feature_Flags' )
			&& MMED_Feature_Flags::is_enabled( 'webex_embedded_widget' )
			&& file_exists( $widget_js )
		) {
			wp_enqueue_script(
				'mmed-webex-widget-bundle',
				MMED_HUB_URL . 'assets/webex-widget-bundle.min.js',
				array(),
				(string) filemtime( $widget_js ),
				true
			);
			$live_deps[] = 'mmed-webex-widget-bundle';
		}

		if ( class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( 'office_hours_queue' ) ) {
			$office_js = MMED_HUB_PATH . 'assets/student-os-office-hours.js';

			wp_enqueue_script(
				'mmed-student-os-office-hours-js',
				MMED_HUB_URL . 'assets/student-os-office-hours.js',
				array( $renderer_script_handle ),
				file_exists( $office_js ) ? (string) filemtime( $office_js ) : MMED_HUB_VERSION,
				true
			);

			$live_deps[] = 'mmed-student-os-office-hours-js';
		}

		wp_enqueue_script(
			'mmed-student-os-live-session-js',
			MMED_HUB_URL . 'assets/student-os-live-session.js',
			$live_deps,
			file_exists( $live_js ) ? (string) filemtime( $live_js ) : MMED_HUB_VERSION,
			true
		);

		wp_enqueue_style(
			'mmed-student-os-live-session-css',
			MMED_HUB_URL . 'assets/student-os-live-session.css',
			array( $renderer_style_handle ),
			file_exists( $live_css ) ? (string) filemtime( $live_css ) : MMED_HUB_VERSION
		);

		if ( class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( 'interview_prep_rooms' ) ) {
			$interview_css = MMED_HUB_PATH . 'assets/student-os-interview-prep.css';
			$interview_js  = MMED_HUB_PATH . 'assets/student-os-interview-prep.js';

			wp_enqueue_script(
				'mmed-student-os-interview-prep-js',
				MMED_HUB_URL . 'assets/student-os-interview-prep.js',
				array( 'mmed-student-os-js' ),
				file_exists( $interview_js ) ? (string) filemtime( $interview_js ) : MMED_HUB_VERSION,
				true
			);

			wp_enqueue_style(
				'mmed-student-os-interview-prep-css',
				MMED_HUB_URL . 'assets/student-os-interview-prep.css',
				array( 'mmed-student-os-css' ),
				file_exists( $interview_css ) ? (string) filemtime( $interview_css ) : MMED_HUB_VERSION
			);
		}

		if ( class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( 'office_hours_queue' ) ) {
			$office_css = MMED_HUB_PATH . 'assets/student-os-office-hours.css';

			wp_enqueue_style(
				'mmed-student-os-office-hours-css',
				MMED_HUB_URL . 'assets/student-os-office-hours.css',
				array( 'mmed-student-os-live-session-css' ),
				file_exists( $office_css ) ? (string) filemtime( $office_css ) : MMED_HUB_VERSION
			);
		}

		if ( class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( 'arena_live_battles' ) ) {
			$arena_css = MMED_HUB_PATH . 'assets/student-os-arena-battle.css';
			$arena_js  = MMED_HUB_PATH . 'assets/student-os-arena-battle.js';

			wp_enqueue_script(
				'mmed-student-os-arena-battle-js',
				MMED_HUB_URL . 'assets/student-os-arena-battle.js',
				array( 'mmed-student-os-live-session-js' ),
				file_exists( $arena_js ) ? (string) filemtime( $arena_js ) : MMED_HUB_VERSION,
				true
			);

			wp_enqueue_style(
				'mmed-student-os-arena-battle-css',
				MMED_HUB_URL . 'assets/student-os-arena-battle.css',
				array( 'mmed-student-os-live-session-css' ),
				file_exists( $arena_css ) ? (string) filemtime( $arena_css ) : MMED_HUB_VERSION
			);
		}

			$drill_css = MMED_HUB_PATH . 'assets/student-os-drill-game.css';
			$drill_js  = MMED_HUB_PATH . 'assets/student-os-drill-game.js';
			if ( file_exists( $drill_js ) ) {
				wp_enqueue_script(
					'mmed-student-os-drill-game-js',
					MMED_HUB_URL . 'assets/student-os-drill-game.js',
					array( 'mmed-student-os-live-session-js' ),
					(string) filemtime( $drill_js ),
					true
				);
			}

			if ( file_exists( $drill_css ) ) {
				wp_enqueue_style(
					'mmed-student-os-drill-game-css',
					MMED_HUB_URL . 'assets/student-os-drill-game.css',
					array( 'mmed-student-os-live-session-css' ),
					(string) filemtime( $drill_css )
				);
			}
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
		$is_admin_full_access = $user_id > 0 && user_can( $user_id, 'manage_options' );

		if ( class_exists( 'MMED_Supabase_Bridge' ) ) {
			MMED_Supabase_Bridge::get_supabase_uuid( $user_id );
		}

		$access_payload = class_exists( 'MMED_Access_Gate' ) ? MMED_Access_Gate::get_access_payload( $user_id ) : array(
			'tier'              => 'enrolled',
			'free_modules'      => array( 'dashboard', 'arena' ),
			'is_enrolled'       => true,
			'is_admin'          => $is_admin_full_access,
			'admin_full_access' => $is_admin_full_access,
			'enrolled_courses'  => array(),
			'promo_courses'     => array(),
		);
		$access_payload = self::add_storyforge_access_payload( $access_payload, $user_id, $is_admin_full_access );
		$access_payload = self::add_cam_access_payload( $access_payload, $user_id );
		$access_payload = self::add_ivprep_access_payload( $access_payload, $user_id );

		return array(
			'profile'       => self::get_profile_data( $user_id ),
			'stats'         => self::get_shell_stats( $user_id ),
			'modules'       => self::get_active_modules( $user_id, $access_payload ),
			'feature_flags' => self::get_feature_flags(),
			'access'        => $access_payload,
			'ssa'     => class_exists( 'MMED_SSA_Adapter' ) ? MMED_SSA_Adapter::status() : array(
				'active'      => false,
				'enabled'     => false,
				'available'   => false,
				'scheduled'   => false,
				'last_synced' => '',
				'message'     => 'SSA adapter is unavailable.',
			),
		);
	}

	/**
	 * Get the active module registry.
	 *
	 * @param int   $user_id WordPress user ID.
	 * @param array $access  Server-derived Matrix access payload.
	 * @return array
	 */
	private static function get_active_modules( $user_id, $access ) {
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

		if ( file_exists( MMED_HUB_PATH . 'assets/scheduler-mount.js' ) ) {
			$modules[] = array(
				'id'      => 'scheduler',
				'route'   => 'scheduler',
				'label'   => 'Scheduler',
				'icon'    => 'Sc',
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
			'id'      => 'profile',
			'route'   => 'profile',
			'label'   => 'My Profile',
			'icon'    => 'Pr',
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

		if ( self::is_storyforge_enabled() && file_exists( MMED_HUB_PATH . 'assets/student-os-storyforge.js' ) ) {
			$modules[] = array(
				'id'      => 'storyforge',
				'route'   => 'storyforge',
				'label'   => 'StoryForge',
				'icon'    => 'SF',
				'section' => 'Match Prep',
			);
		}

		$cam_access = isset( $access['cam'] ) && is_array( $access['cam'] ) ? $access['cam'] : array();
		if (
			$user_id > 0
			&& ! empty( $access['module_permissions']['cam'] )
			&& ! empty( $cam_access['launch_url'] )
		) {
			$modules[] = array(
				'id'         => 'cam',
				'route'      => 'cam',
				'label'      => 'CAM Interview',
				'icon'       => 'CA',
				'section'    => 'Match Prep',
				'launch_url' => $cam_access['launch_url'],
			);
		}

		$ivprep_access = isset( $access['ivprep'] ) && is_array( $access['ivprep'] ) ? $access['ivprep'] : array();
		if (
			$user_id > 0
			&& ! empty( $access['module_permissions']['ivprep'] )
			&& ! empty( $ivprep_access['launch_url'] )
		) {
			$modules[] = array(
				'id'         => 'ivprep',
				'route'      => 'ivprep',
				'label'      => 'IV Prep On-Call',
				'icon'       => 'IV',
				'section'    => 'Match Prep',
				'launch_url' => $ivprep_access['launch_url'],
			);
		}

		if ( class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( 'interview_prep_rooms' ) ) {
			$modules[] = array(
				'id'      => 'interview-prep',
				'route'   => 'interview-prep',
				'label'   => 'Interview Prep',
				'icon'    => 'IV',
				'section' => 'Match Prep',
			);
		}

		if ( class_exists( 'MMED_Arena' ) ) {
			$modules[] = array(
				'id'      => 'arena',
				'route'   => 'arena',
				'label'   => 'Arena',
				'icon'    => 'Ar',
				'section' => 'Training',
			);
		}

		return $modules;
	}

	/**
	 * Return frontend feature flag states.
	 *
	 * @return array
	 */
	private static function get_feature_flags() {
		if ( class_exists( 'MMED_Feature_Flags' ) ) {
			$flags = MMED_Feature_Flags::get_flag_states();
			$flags['matrix_runtime_v2'] = self::is_runtime_v2_enabled();
			$flags['storyforge_bootstrap'] = self::is_storyforge_enabled();
			return $flags;
		}

		return array(
			'webex_embedded_widget' => false,
			'attendance_tracking'   => false,
			'session_recordings'    => false,
			'session_chat'          => false,
			'arena_live_battles'    => false,
			'drill_gamification'    => false,
			'interview_prep_rooms'  => false,
			'office_hours_queue'    => false,
			'session_reminders'     => false,
			'matrix_runtime_v2'     => self::is_runtime_v2_enabled(),
			'storyforge_bootstrap'  => self::is_storyforge_enabled(),
		);
	}

	/**
	 * Determine whether the lazy Matrix Runtime v2 kernel is enabled.
	 *
	 * @return bool
	 */
	private static function is_runtime_v2_enabled() {
		$value = get_option( self::OPTION_RUNTIME_V2, false );

		if ( is_string( $value ) ) {
			$value = strtolower( trim( $value ) );
			$value = in_array( $value, array( '1', 'true', 'yes', 'on' ), true );
		}

		return (bool) apply_filters( 'mmed_matrix_runtime_v2_enabled', (bool) $value );
	}

	/**
	 * Determine whether the StoryForge bootstrap frontend is available in Matrix.
	 *
	 * @return bool
	 */
	private static function is_storyforge_enabled() {
		$value = true;

		if ( defined( 'MMED_ENABLE_STORYFORGE' ) ) {
			$value = (bool) MMED_ENABLE_STORYFORGE;
		}

		return (bool) apply_filters( 'mmed_matrix_storyforge_enabled', $value );
	}

	/**
	 * Add StoryForge entitlement data to the Matrix access payload.
	 *
	 * @param array $access Access payload from the Matrix gate.
	 * @param int   $user_id WordPress user ID.
	 * @param bool  $is_admin_full_access Whether the user has admin bypass.
	 * @return array
	 */
	private static function add_storyforge_access_payload( $access, $user_id, $is_admin_full_access ) {
		if ( ! is_array( $access ) ) {
			$access = array();
		}

		$enabled         = self::is_storyforge_enabled();
		$has_entitlement = $enabled && self::user_has_storyforge_access( $user_id, $is_admin_full_access );
		$mode            = 'locked';

		if ( ! $enabled ) {
			$mode = 'disabled';
		} elseif ( $is_admin_full_access ) {
			$mode = 'admin_preview';
		} elseif ( $has_entitlement ) {
			$mode = 'student_bootstrap';
		}

		if ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
			$access['module_permissions'] = array();
		}

		$access['module_permissions']['storyforge'] = $has_entitlement;
		$access['storyforge'] = array(
			'enabled'            => $enabled,
			'required_course_id' => self::STORYFORGE_COURSE_ID,
			'unlocked'           => $has_entitlement,
			'mode'               => $mode,
		);

		return $access;
	}

	/**
	 * Determine whether a user can open the StoryForge student bootstrap.
	 *
	 * @param int  $user_id WordPress user ID.
	 * @param bool $is_admin_full_access Whether the user has admin bypass.
	 * @return bool
	 */
	private static function user_has_storyforge_access( $user_id, $is_admin_full_access = false ) {
		$user_id = absint( $user_id );

		if ( $is_admin_full_access || ( $user_id > 0 && user_can( $user_id, 'manage_options' ) ) ) {
			return true;
		}

		if ( $user_id <= 0 || ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			return false;
		}

		$enrolled_courses = learndash_user_get_enrolled_courses( $user_id );
		if ( ! is_array( $enrolled_courses ) ) {
			return false;
		}

		$enrolled_course_ids = array_map( 'absint', $enrolled_courses );
		return in_array( self::STORYFORGE_COURSE_ID, $enrolled_course_ids, true );
	}

	/**
	 * Add fail-closed CAM launch entitlement data to the Matrix payload.
	 *
	 * CAM accepts only a current 360 entitlement or the real WordPress manage_options capability.
	 *
	 * @param array $access Matrix access payload.
	 * @param int   $user_id WordPress user ID.
	 * @return array
	 */
	private static function add_cam_access_payload( $access, $user_id ) {
		if ( ! is_array( $access ) ) {
			$access = array();
		}

		$entitlement = self::get_cam_entitlement( $user_id );
		$launch_url  = ! empty( $entitlement['active'] ) ? self::get_cam_launch_url() : '';
		$unlocked    = ! empty( $entitlement['active'] ) && '' !== $launch_url;

		if ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
			$access['module_permissions'] = array();
		}

		$access['module_permissions']['cam'] = $unlocked;
		$access['cam'] = array(
			'enabled'    => '' !== $launch_url,
			'unlocked'   => $unlocked,
			'status'     => isset( $entitlement['status'] ) ? sanitize_key( $entitlement['status'] ) : 'source_unavailable',
			'reason_code' => isset( $entitlement['reason_code'] ) ? sanitize_key( $entitlement['reason_code'] ) : 'cam_entitlement_unavailable',
			'launch_url' => $unlocked ? $launch_url : '',
		);

		return $access;
	}

	/**
	 * Add fail-closed IV Prep On-Call launch data for administrators or current
	 * LearnDash course 3893 students.
	 *
	 * The launch target is fixed in server-owned code. Anonymous and
	 * non-entitled visitors receive neither permission nor the handoff URL.
	 *
	 * @param array $access Matrix access payload.
	 * @param int   $user_id WordPress user ID.
	 * @return array
	 */
	private static function add_ivprep_access_payload( $access, $user_id ) {
		if ( ! is_array( $access ) ) {
			$access = array();
		}

		$is_admin        = $user_id > 0 && user_can( $user_id, 'manage_options' );
		$enrolled        = array();
		$course_entitled = false;

		if ( $user_id > 0 && function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$resolved_courses = learndash_user_get_enrolled_courses( $user_id );
			$enrolled = is_array( $resolved_courses ) ? array_map( 'intval', $resolved_courses ) : array();
			$course_entitled = in_array( 3893, $enrolled, true );
		}

		$allowed    = $is_admin || $course_entitled;
		$launch_url = $allowed ? self::get_ivprep_launch_url() : '';
		$unlocked   = $allowed && '' !== $launch_url;

		if ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
			$access['module_permissions'] = array();
		}

		$access['module_permissions']['ivprep'] = $unlocked;
		$access['ivprep'] = array(
			'enabled'            => '' !== $launch_url,
			'unlocked'           => $unlocked,
			'status'             => $unlocked ? ( $is_admin ? 'administrator' : 'course_entitled' ) : 'not_authorized',
			'reason_code'        => $unlocked ? ( $is_admin ? 'ivprep_admin_access' : 'ivprep_course_3893_access' ) : 'ivprep_entitlement_required',
			'required_course_id' => 3893,
			'launch_url'         => $unlocked ? $launch_url : '',
		);

		return $access;
	}

	/**
	 * Resolve the WordPress-owned CAM claim with one narrow capability-derived administrator override.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_cam_entitlement( $user_id ) {
		$denied = array(
			'active' => false,
			'status' => 'source_unavailable',
		);

		if ( $user_id <= 0 || ! function_exists( 'mmhq_cam_build_entitlement' ) ) {
			return $denied;
		}

		if ( user_can( $user_id, 'manage_options' ) ) {
			return array(
				'active'      => true,
				'status'      => 'admin_override',
				'reason_code' => 'cam_admin_override',
			);
		}

		$claim = mmhq_cam_build_entitlement( absint( $user_id ) );
		if ( ! is_array( $claim ) ) {
			return $denied;
		}

		$expires_at = isset( $claim['expires_at'] ) ? strtotime( (string) $claim['expires_at'] ) : false;
		$authority_mode = sanitize_key( (string) ( $claim['authority_mode'] ?? '' ) );
		$verified_authority = (
			true === ( $claim['purchase_verified'] ?? false )
			&& true === ( $claim['purchase_match_found'] ?? false )
			&& true === ( $claim['enrollment_verified'] ?? false )
			&& 'learndash_and_woocommerce' === $authority_mode
		) || (
			false === ( $claim['purchase_verified'] ?? false )
			&& false === ( $claim['purchase_match_found'] ?? false )
			&& true === ( $claim['enrollment_verified'] ?? false )
			&& 'learndash_current_access' === $authority_mode
		);
		$active = true === ( $claim['active'] ?? false )
			&& 'active' === ( $claim['status'] ?? '' )
			&& true === ( $claim['verified'] ?? false )
			&& true === ( $claim['trusted'] ?? false )
			&& true === ( $claim['current_access_verified'] ?? false )
			&& true === ( $claim['revocation_checked'] ?? false )
			&& $verified_authority
			&& empty( $claim['restricted'] )
			&& empty( $claim['revoked'] )
			&& ( false === $expires_at || $expires_at > time() );

		return array(
			'active'      => $active,
			'status'      => $active ? 'active' : sanitize_key( (string) ( $claim['status'] ?? 'not_eligible' ) ),
			'reason_code' => $active ? 'cam_360_active' : 'cam_not_eligible',
		);
	}

	/**
	 * Build a public CAM launch URL from an explicitly configured HTTPS target.
	 *
	 * @return string
	 */
	private static function get_cam_launch_url() {
		$target = defined( 'MMED_CAM_LAUNCH_URL' ) ? (string) MMED_CAM_LAUNCH_URL : '';
		$target = apply_filters( 'mmed_matrix_cam_launch_url', $target );
		$target = is_string( $target ) ? trim( $target ) : '';

		if ( '' === $target || ! wp_http_validate_url( $target ) ) {
			return '';
		}

		$parts = wp_parse_url( $target );
		if (
			! is_array( $parts )
			|| 'https' !== strtolower( (string) ( $parts['scheme'] ?? '' ) )
			|| 'cam-hq-production-cam-production.up.railway.app' !== strtolower( (string) ( $parts['host'] ?? '' ) )
				|| '/cam/' !== (string) ( $parts['path'] ?? '' )
				|| ( ! empty( $parts['port'] ) && 443 !== absint( $parts['port'] ) )
			|| ! empty( $parts['user'] )
			|| ! empty( $parts['pass'] )
			|| ! empty( $parts['query'] )
			|| ! empty( $parts['fragment'] )
		) {
			return '';
		}

		$return_to = home_url( '/member-dashboard/' ) . '#dashboard';
		$final     = self::build_cam_query_url(
			$target,
			array(
				'entry'     => 'matrix',
				'return_to' => $return_to,
			)
		);
		$auth_url  = 'https://cam-hq-production-cam-production.up.railway.app/api/auth/start';

		return esc_url_raw(
			self::build_cam_query_url(
				$auth_url,
				array(
					'audience'  => 'cam',
					'entry'     => 'matrix',
					'return_to' => $return_to,
					'final'     => $final,
				)
			)
		);
	}

	/**
	 * Build the fixed HQ-authenticated IV Prep On-Call launch URL.
	 *
	 * @return string
	 */
	private static function get_ivprep_launch_url() {
		$origin   = 'https://missionmed-hq-production.up.railway.app';
		$final    = $origin . '/iv-prep-analytics/';
		$auth_url = $origin . '/api/auth/start';

		return esc_url_raw(
			self::build_cam_query_url(
				$auth_url,
				array(
					'final' => $final,
				)
			)
		);
	}

	/**
	 * Build a CAM URL with RFC3986 encoding so nested fragments remain query data.
	 *
	 * WordPress add_query_arg() preserves a literal # inside parameter values. In a
	 * browser that starts the outer fragment early and drops the nested final URL.
	 *
	 * @param string $base Base HTTPS URL without a query or fragment.
	 * @param array  $args Query parameters.
	 * @return string
	 */
	private static function build_cam_query_url( $base, $args ) {
		return rtrim( (string) $base, '?' ) . '?' . http_build_query( $args, '', '&', PHP_QUERY_RFC3986 );
	}

	/**
	 * Remove admin/reporting assets that are not used by the Runtime v2 Matrix shell.
	 *
	 * @param bool $runtime_v2_enabled Whether Runtime v2 is active.
	 * @return void
	 */
	private static function optimize_runtime_v2_member_dashboard_assets( $runtime_v2_enabled ) {
		if ( ! $runtime_v2_enabled || ! self::is_member_dashboard_request() ) {
			return;
		}

		self::dequeue_runtime_v2_report_assets();
		add_action( 'wp_print_scripts', array( __CLASS__, 'dequeue_runtime_v2_report_assets' ), 100 );
		add_action( 'wp_print_styles', array( __CLASS__, 'dequeue_runtime_v2_report_assets' ), 100 );
	}

	/**
	 * Determine whether the current request is the Matrix member dashboard route.
	 *
	 * @return bool
	 */
	private static function is_member_dashboard_request() {
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

		return false !== strpos( $request_uri, '/member-dashboard' );
	}

	/**
	 * Dequeue LearnDash ProPanel reporting assets that inflate Matrix Runtime v2 routes.
	 *
	 * @return void
	 */
	public static function dequeue_runtime_v2_report_assets() {
		if ( ! self::is_runtime_v2_enabled() || ! self::is_member_dashboard_request() ) {
			return;
		}

		self::dequeue_handles_by_prefix(
			'wp_scripts',
			array(
				'wisdm-learndash-reports-front-end-script-',
				'wrld_admin_dashboard_settings_',
			),
			array(
				'qre-common-js',
				'wrld-common-script',
			)
		);

		self::dequeue_handles_by_prefix(
			'wp_styles',
			array(
				'wisdm-learndash-reports-front-end-style-',
			),
			array(
				'qre-common-css',
				'wrld_global_styles',
			)
		);
	}

	/**
	 * Dequeue queued script/style handles by prefix or exact handle.
	 *
	 * @param string $registry_name WordPress registry global name.
	 * @param array  $prefixes Handle prefixes.
	 * @param array  $exact_handles Exact handles.
	 * @return void
	 */
	private static function dequeue_handles_by_prefix( $registry_name, $prefixes, $exact_handles ) {
		$registry = 'wp_scripts' === $registry_name ? wp_scripts() : wp_styles();

		foreach ( (array) $registry->queue as $handle ) {
			$matched = in_array( $handle, $exact_handles, true );

			if ( ! $matched ) {
				foreach ( $prefixes as $prefix ) {
					if ( 0 === strpos( $handle, $prefix ) ) {
						$matched = true;
						break;
					}
				}
			}

			if ( ! $matched ) {
				continue;
			}

			if ( 'wp_scripts' === $registry_name ) {
				wp_dequeue_script( $handle );
			} else {
				wp_dequeue_style( $handle );
			}
		}
	}

	/**
	 * Build lazy asset descriptors for Runtime v2 modules.
	 *
	 * @return array
	 */
	private static function get_runtime_v2_assets() {
		$experience = class_exists( 'MMED_Calendar_Experience' ) ? MMED_Calendar_Experience::resolve() : 'classic';
		$calendar_css = 'storyforge' === $experience
			? 'assets/calendar-v2/mmed-calendar-v2.css'
			: 'assets/student-os-calendar-v4.css';

		return array(
			'scheduler_js'       => self::runtime_asset( 'assets/scheduler-mount.js' ),
			'calendar_css'       => self::runtime_asset( $calendar_css ),
			'calendar_js'        => self::runtime_asset( 'assets/calendar-core/mmed-calendar-runtime.js' ),
			'file_vault_css'     => self::runtime_asset( 'assets/student-os-file-vault.css', 'mm064-006d-fidelity' ),
			'file_vault_js'      => self::runtime_asset( 'assets/student-os-file-vault.js', 'mm064-006d-fidelity' ),
			'storyforge_css'     => self::runtime_asset( 'assets/student-os-storyforge.css' ),
			'storyforge_js'      => self::runtime_asset( 'assets/student-os-storyforge.js' ),
			'live_session_css'   => self::runtime_asset( 'assets/student-os-live-session.css' ),
			'live_session_js'    => self::runtime_asset( 'assets/student-os-live-session.js' ),
			'webex_widget_js'    => self::runtime_asset( 'assets/webex-widget-bundle.min.js' ),
			'office_hours_css'   => self::runtime_asset( 'assets/student-os-office-hours.css' ),
			'office_hours_js'    => self::runtime_asset( 'assets/student-os-office-hours.js' ),
			'interview_prep_css' => self::runtime_asset( 'assets/student-os-interview-prep.css' ),
			'interview_prep_js'  => self::runtime_asset( 'assets/student-os-interview-prep.js' ),
			'arena_battle_css'   => self::runtime_asset( 'assets/student-os-arena-battle.css' ),
			'arena_battle_js'    => self::runtime_asset( 'assets/student-os-arena-battle.js' ),
			'drill_game_css'     => self::runtime_asset( 'assets/student-os-drill-game.css' ),
			'drill_game_js'      => self::runtime_asset( 'assets/student-os-drill-game.js' ),
		);
	}

	/**
	 * Build a single lazy asset descriptor.
	 *
	 * @param string $relative_path Relative plugin path.
	 * @param string $version_suffix Optional version suffix.
	 * @return array
	 */
	private static function runtime_asset( $relative_path, $version_suffix = '' ) {
		$path   = MMED_HUB_PATH . $relative_path;
		$exists = file_exists( $path );
		$ver    = $exists ? (string) filemtime( $path ) : MMED_HUB_VERSION;

		if ( $version_suffix ) {
			$ver .= '-' . $version_suffix;
		}

		return array(
			'url'     => MMED_HUB_URL . $relative_path,
			'version' => $ver,
			'exists'  => $exists,
		);
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
			'avatar_url'        => get_avatar_url( $user_id ),
			'is_admin'          => user_can( $user_id, 'manage_options' ),
			'admin_full_access' => user_can( $user_id, 'manage_options' ),
			'tasks'             => $task_counts,
			'phase'             => self::get_phase_data( $user_id, $program_tier ),
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
