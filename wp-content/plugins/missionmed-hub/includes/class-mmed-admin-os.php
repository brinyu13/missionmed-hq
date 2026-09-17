<?php
/**
 * MissionMed HQ/Admin Runtime v2 controller.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Feature-flagged Matrix Admin HQ runtime shell.
 */
class MMED_Admin_OS {

	const OPTION_ENABLED = 'mmed_admin_os_enabled';
	const CAPABILITY     = 'manage_options';
	const PAGE_SLUG      = 'mmed-admin-matrix';

	/**
	 * Registered admin page hook suffix.
	 *
	 * @var string
	 */
	private static $hook_suffix = '';

	/**
	 * Register admin hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_admin_page' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
	}

	/**
	 * Runtime feature flag.
	 *
	 * The option is the rollback switch. D8-439 ships active when the option has
	 * not been created yet so the deployed page can be validated immediately.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		$value = get_option( self::OPTION_ENABLED, 1 );
		return (bool) apply_filters( 'mmed_admin_os_enabled', (bool) $value );
	}

	/**
	 * Register the Matrix Admin HQ page only when the flag and capability allow it.
	 *
	 * @return void
	 */
	public static function register_admin_page() {
		if ( ! current_user_can( self::CAPABILITY ) || ! self::is_enabled() ) {
			return;
		}

		self::$hook_suffix = add_menu_page(
			__( 'Matrix Admin HQ', 'missionmed-hub' ),
			__( 'Matrix Admin HQ', 'missionmed-hub' ),
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' ),
			'dashicons-screenoptions',
			3
		);
	}

	/**
	 * Enqueue runtime assets only on the Matrix Admin HQ page.
	 *
	 * @param string $hook Current admin hook suffix.
	 * @return void
	 */
	public static function enqueue_assets( $hook ) {
		if ( ! self::is_matrix_screen( $hook ) ) {
			return;
		}

		if ( ! current_user_can( self::CAPABILITY ) || ! self::is_enabled() ) {
			return;
		}

		$css_path           = MMED_HUB_PATH . 'assets/admin-os.css';
		$js_path            = MMED_HUB_PATH . 'assets/admin-os.js';
		$scheduler_mount_js = MMED_HUB_PATH . 'assets/scheduler-mount.js';

		wp_enqueue_style(
			'mmed-admin-os-css',
			MMED_HUB_URL . 'assets/admin-os.css',
			array(),
			self::asset_version( $css_path )
		);

		$script_deps = array();
		if ( file_exists( $scheduler_mount_js ) ) {
			wp_enqueue_script(
				'mmed-admin-scheduler-mount-js',
				MMED_HUB_URL . 'assets/scheduler-mount.js',
				array(),
				self::asset_version( $scheduler_mount_js ),
				true
			);
			$script_deps[] = 'mmed-admin-scheduler-mount-js';
		}

		wp_enqueue_script(
			'mmed-admin-os-js',
			MMED_HUB_URL . 'assets/admin-os.js',
			$script_deps,
			self::asset_version( $js_path ),
			true
		);

		wp_localize_script( 'mmed-admin-os-js', 'MMED_ADMIN_OS_CONFIG', self::get_initial_data() );
	}

	/**
	 * Render the Matrix Admin HQ shell.
	 *
	 * @return void
	 */
	public static function render_page() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Unauthorized.', 'missionmed-hub' ) );
		}

		if ( ! self::is_enabled() ) {
			wp_die( esc_html__( 'Matrix Admin HQ is disabled.', 'missionmed-hub' ) );
		}

		$template = MMED_HUB_PATH . 'templates/admin-os-shell.php';
		if ( ! file_exists( $template ) ) {
			wp_die( esc_html__( 'Matrix Admin HQ template is unavailable.', 'missionmed-hub' ) );
		}

		$mmed_admin_os_data = self::get_initial_data();
		include $template;
	}

	/**
	 * Build safe bootstrap data for the runtime shell.
	 *
	 * @return array<string, mixed>
	 */
	public static function get_initial_data() {
		$user           = wp_get_current_user();
		$roles          = is_array( $user->roles ) ? array_values( $user->roles ) : array();
		$role_label     = ! empty( $roles ) ? ucwords( str_replace( '_', ' ', $roles[0] ) ) : __( 'Admin', 'missionmed-hub' );
		$operator_scope = self::resolve_operator_scope( $user );
		$current_user   = array(
			'id'          => absint( $user->ID ),
			'displayName' => $user->display_name ? $user->display_name : $user->user_login,
			'roleLabel'   => $role_label,
			'emailHash'   => $user->user_email ? hash( 'sha256', strtolower( trim( $user->user_email ) ) ) : '',
		);

		return array(
			'flag'        => array(
				'name'    => self::OPTION_ENABLED,
				'enabled' => self::is_enabled(),
			),
			'features'    => array(
				'live_data' => (bool) get_option( 'mmed_admin_os_live_data', 0 ),
			),
			'railwayBase' => defined( 'MMHQ_RAILWAY_URL' )
				? esc_url_raw( MMHQ_RAILWAY_URL )
				: 'https://hq.missionmedinstitute.com',
			'currentUser' => $current_user,
			'user'        => $current_user,
			'operator'    => $operator_scope['operator'],
			'auth'        => array(
				'capability'       => self::CAPABILITY,
				'canManageOptions' => current_user_can( self::CAPABILITY ),
				'role'             => 'admin',
				'nonce'            => wp_create_nonce( 'wp_rest' ),
				'restBase'         => esc_url_raw( rest_url( 'mmed/v1' ) ),
				'operatorScope'    => $operator_scope,
			),
			'endpoints'    => array(
				'authSession'         => esc_url_raw( home_url( '/api/auth/session' ) ),
				'wpAdminSchedulerOps' => esc_url_raw( home_url( '/hq/scheduler-ops' ) ),
				'studentDashboard'    => esc_url_raw( home_url( '/member-dashboard/' ) ),
				'welcomeEmailsAdmin'  => esc_url_raw( admin_url( 'admin.php?page=mmed-welcome-emails' ) ),
			),
			'modules'      => array(
				'dashboard',
				'welcome-emails',
				'scheduler-ops',
				'calendar-admin',
				'file-vault-admin',
				'storyforge-admin',
				'communications',
			),
			'generatedAt'  => gmdate( 'c' ),
		);
	}

	/**
	 * UI-only operator hint. Server endpoints remain the authority.
	 *
	 * @param WP_User $user Current user.
	 * @return array<string, mixed>
	 */
	private static function resolve_operator_scope( $user ) {
		$haystack = strtolower(
			implode(
				' ',
				array_filter(
					array(
						(string) $user->user_login,
						(string) $user->display_name,
						(string) $user->user_email,
					)
				)
			)
		);

		if ( false !== strpos( $haystack, 'dr_j' ) || false !== strpos( $haystack, 'dr j' ) || false !== strpos( $haystack, 'usmle' ) ) {
			return array(
				'operator'      => 'dr_j',
				'ownerName'     => 'Dr. J',
				'division'      => 'usmle_drills',
				'divisionLabel' => 'USMLE Drills',
				'isAll'         => false,
			);
		}

		if ( false !== strpos( $haystack, 'phil' ) || false !== strpos( $haystack, 'usce' ) ) {
			return array(
				'operator'      => 'phil',
				'ownerName'     => 'Phil',
				'division'      => 'usce',
				'divisionLabel' => 'Mission USCE',
				'isAll'         => false,
			);
		}

		return array(
			'operator'      => 'brian',
			'ownerName'     => 'Brian',
			'division'      => 'mission_residency',
			'divisionLabel' => 'Mission Residency',
			'isAll'         => true,
		);
	}

	/**
	 * Check whether the current hook belongs to Matrix Admin HQ.
	 *
	 * @param string $hook Current admin hook suffix.
	 * @return bool
	 */
	private static function is_matrix_screen( $hook ) {
		if ( self::$hook_suffix && $hook === self::$hook_suffix ) {
			return true;
		}

		return 'toplevel_page_' . self::PAGE_SLUG === $hook;
	}

	/**
	 * Version an asset by mtime where possible.
	 *
	 * @param string $path Absolute asset path.
	 * @return string
	 */
	private static function asset_version( $path ) {
		return file_exists( $path ) ? (string) filemtime( $path ) : MMED_HUB_VERSION;
	}
}
