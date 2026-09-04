<?php
/**
 * MissionMed Matrix Access Gate.
 *
 * Determines user access tier based on LearnDash enrollment status,
 * gates Matrix modules accordingly, and provides an admin UI for
 * managing course-to-tier mappings.
 *
 * Access is resolved per app. Registered users receive the Founder-approved
 * baseline, verified 360 and IV Prep Complete users receive every released
 * app, and existing stronger per-user or enrolled grants are preserved.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMED_Access_Gate {

	/** Founder-approved registered-user access floor. */
	const REGISTERED_BASELINE_MODULES = array( 'dashboard', 'profile', 'calendar', 'appointments', 'storyforge', 'rise', 'lor', 'lor-studio' );

	/** Account/support surfaces that were already available to registered users. */
	const REGISTERED_ACCOUNT_MODULES = array( 'orders', 'notifications', 'help' );

	/** Routes the pre-6020 enrolled tier already opened in the active Matrix runtime. */
	const LEGACY_ENROLLED_MODULES = array( 'scheduler', 'filevault', 'timeline', 'arena' );

	/**
	 * Option keys for admin settings.
	 */
	const OPTION_ENROLLED_COURSES  = 'mmed_gate_enrolled_courses';
	const OPTION_REDIRECT_ENABLED  = 'mmed_gate_login_redirect';
	const OPTION_REDIRECT_PAGE     = 'mmed_gate_redirect_page_id';
	const OPTION_FREE_MODULES      = 'mmed_gate_free_modules';
	const META_ALLOWED_MODULES     = '_mmed_matrix_allowed_modules';
	const PAGE_SLUG                = 'mmed-access-gate';

	/**
	 * Transient key prefix for per-user tier caching.
	 */
	const TIER_CACHE_PREFIX = 'mmed_tier_';
	const TIER_CACHE_TTL    = 300; // 5 minutes

	/**
	 * Initialize hooks.
	 */
	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_filter( 'login_redirect', array( __CLASS__, 'login_redirect' ), 999, 3 );

		// Clear tier cache when LearnDash enrollment changes.
		add_action( 'learndash_update_course_access', array( __CLASS__, 'clear_user_cache' ), 10, 2 );
	}

	/**
	 * Register admin menu under Settings.
	 */
	public static function register_menu() {
		add_submenu_page(
			'options-general.php',
			'Matrix Access Gate',
			'Matrix Access Gate',
			'manage_options',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_admin_page' )
		);
	}

	/**
	 * Register settings for the admin page.
	 */
	public static function register_settings() {
		register_setting( 'mmed_access_gate_group', self::OPTION_REDIRECT_ENABLED, array(
			'type'              => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
			'default'           => true,
		) );

		register_setting( 'mmed_access_gate_group', self::OPTION_REDIRECT_PAGE, array(
			'type'              => 'integer',
			'sanitize_callback' => 'absint',
			'default'           => 0,
		) );

		register_setting( 'mmed_access_gate_group', self::OPTION_ENROLLED_COURSES, array(
			'type'              => 'string',
			'sanitize_callback' => array( __CLASS__, 'sanitize_id_list' ),
			'default'           => '',
		) );

		register_setting( 'mmed_access_gate_group', self::OPTION_FREE_MODULES, array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => 'dashboard,arena',
		) );
	}

	/**
	 * Sanitize a comma-separated list of numeric IDs.
	 *
	 * @param string $input Raw input.
	 * @return string
	 */
	public static function sanitize_id_list( $input ) {
		$ids = array_filter( array_map( 'absint', explode( ',', (string) $input ) ) );
		return implode( ',', $ids );
	}

	// -------------------------------------------------------------------------
	// ACCESS TIER RESOLUTION
	// -------------------------------------------------------------------------

	/**
	 * Get the access tier for a user.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string 'enrolled' or 'free'
	 */
	public static function get_tier( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return 'free';
		}

		// Admins always get full access.
		if ( self::is_admin_full_access( $user_id ) ) {
			return 'enrolled';
		}

		// Check transient cache.
		$cache_key = self::TIER_CACHE_PREFIX . $user_id;
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		$tier = self::resolve_tier( $user_id );
		set_transient( $cache_key, $tier, self::TIER_CACHE_TTL );

		return $tier;
	}

	/**
	 * Resolve tier from LearnDash enrollment data.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string
	 */
	private static function resolve_tier( $user_id ) {
		if ( ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			// LearnDash not active: fall back to user meta.
			$program_tier = get_user_meta( $user_id, '_mmed_program_tier', true );
			return ! empty( $program_tier ) ? 'enrolled' : 'free';
		}

		$enrolled_courses = learndash_user_get_enrolled_courses( $user_id );
		if ( ! is_array( $enrolled_courses ) || empty( $enrolled_courses ) ) {
			return 'free';
		}

		// Check against configured enrolled course IDs.
		$gate_courses = self::get_enrolled_course_ids();
		if ( empty( $gate_courses ) ) {
			// No specific courses configured: any LearnDash enrollment counts.
			return 'enrolled';
		}

		$overlap = array_intersect(
			array_map( 'absint', $enrolled_courses ),
			$gate_courses
		);

		return ! empty( $overlap ) ? 'enrolled' : 'free';
	}

	/**
	 * Get the list of LearnDash course IDs that grant "enrolled" tier.
	 *
	 * @return int[]
	 */
	public static function get_enrolled_course_ids() {
		$raw = get_option( self::OPTION_ENROLLED_COURSES, '' );
		if ( empty( $raw ) ) {
			// Auto-populate from access audit mappings if available.
			if ( class_exists( 'MMED_Access_Audit' ) ) {
				$mappings = MMED_Access_Audit::get_program_mappings();
				$ids      = array();
				foreach ( $mappings as $mapping ) {
					if ( ! empty( $mapping['course_id'] ) ) {
						$ids[] = absint( $mapping['course_id'] );
					}
				}
				return array_values( array_unique( array_filter( $ids ) ) );
			}
			return array();
		}

		return array_values( array_unique( array_filter( array_map( 'absint', explode( ',', $raw ) ) ) ) );
	}

	/**
	 * Get the list of module routes accessible to free-tier users.
	 *
	 * @return string[]
	 */
	public static function get_free_modules() {
		$raw = get_option( self::OPTION_FREE_MODULES, '' );
		return self::sanitize_module_list(
			array_merge(
				self::REGISTERED_BASELINE_MODULES,
				self::REGISTERED_ACCOUNT_MODULES,
				array_filter( array_map( 'trim', explode( ',', (string) $raw ) ) )
			)
		);
	}

	/**
	 * Resolve the two verified programs that grant full released-app access.
	 *
	 * IDs come from the existing MissionMed product settings. No commerce or
	 * enrollment identifier is introduced by this ticket.
	 *
	 * @return int[]
	 */
	public static function get_full_access_course_ids() {
		$keys = array( 'mmed_course_360elite', 'mmed_course_complete' );
		$ids  = array();
		foreach ( $keys as $key ) {
			$fallback = function_exists( 'mmed_hub_default_option_value' ) ? mmed_hub_default_option_value( $key ) : 0;
			$ids[]    = absint( get_option( $key, $fallback ) );
		}

		return array_values( array_unique( array_filter( $ids ) ) );
	}

	/**
	 * Return all current LearnDash course grants for a user.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return int[]
	 */
	public static function get_user_course_ids( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return array();
		}

		$ids = array();
		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$enrolled = learndash_user_get_enrolled_courses( $user_id );
			$ids      = is_array( $enrolled ) ? array_map( 'absint', $enrolled ) : array();
		}

		// Group-derived current access may not appear in the direct enrollment list.
		if ( function_exists( 'sfwd_lms_has_access' ) ) {
			foreach ( self::get_enrolled_course_ids() as $course_id ) {
				if ( sfwd_lms_has_access( $course_id, $user_id ) ) {
					$ids[] = $course_id;
				}
			}
		}

		return array_values( array_unique( array_filter( array_map( 'absint', $ids ) ) ) );
	}

	/**
	 * Whether the user is in a Founder-approved full-access program.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	public static function user_has_full_access( $user_id ) {
		$user_id = absint( $user_id );
		if ( self::is_admin_full_access( $user_id ) ) {
			return true;
		}

		return ! empty( array_intersect( self::get_user_course_ids( $user_id ), self::get_full_access_course_ids() ) );
	}

	/**
	 * Normalize aliases used by older Matrix clients and live product routes.
	 *
	 * @param string $route Candidate route.
	 * @return string
	 */
	public static function normalize_app_route( $route ) {
		$route = sanitize_key( str_replace( '-', '_', preg_replace( '/^#\/?/', '', (string) $route ) ) );
		$aliases = array(
			'lor_writer' => 'lor',
			'lor_studio' => 'lor',
			'file_vault' => 'filevault',
			'ranklistiq' => 'ranklist',
			'my_appointments' => 'appointments',
		);

		return isset( $aliases[ $route ] ) ? $aliases[ $route ] : $route;
	}

	/**
	 * Current discovery catalog. A disabled item remains visible but can never
	 * be opened by a full-access tier.
	 *
	 * @return array<string,array<string,mixed>>
	 */
	public static function get_app_catalog() {
		$rise_url = add_query_arg(
			array( 'action' => 'mmed_rise_auth_redirect', 'final' => '/rise/' ),
			admin_url( 'admin-post.php' )
		);
		$ivprep_origin = 'https://missionmed-hq-production.up.railway.app';
		$ivprep_url    = add_query_arg( 'final', $ivprep_origin . '/iv-prep-analytics/', $ivprep_origin . '/api/auth/start' );

		return array(
			'dashboard'     => array( 'name' => 'Dashboard Home', 'released' => true, 'launch_url' => '#dashboard' ),
			'profile'       => array( 'name' => 'My Profile', 'released' => true, 'launch_url' => '#profile' ),
			'homebase'      => array( 'name' => 'HomeBase', 'released' => true, 'launch_url' => '#dashboard' ),
			'calendar'      => array( 'name' => 'Calendar', 'released' => true, 'launch_url' => '#calendar' ),
			'appointments'  => array( 'name' => 'My Appointments', 'released' => true, 'launch_url' => '#appointments' ),
			'storyforge'    => array( 'name' => 'StoryForge', 'released' => true, 'launch_url' => '#storyforge' ),
			'rise'          => array( 'name' => 'RISE', 'released' => true, 'launch_url' => esc_url_raw( $rise_url ) ),
			'lor'           => array( 'name' => 'LOR Studio', 'released' => true, 'launch_url' => 'https://missionmed-hq-production.up.railway.app/api/lor-studio/auth/start' ),
			'scheduler'     => array( 'name' => 'Scheduler', 'released' => true, 'launch_url' => '#scheduler' ),
			'filevault'     => array( 'name' => 'File Vault', 'released' => true, 'launch_url' => '#filevault' ),
			'timeline'      => array( 'name' => 'Timeline Builder', 'released' => true, 'launch_url' => '#timeline' ),
			'arena'         => array( 'name' => 'Arena', 'released' => true, 'launch_url' => '#arena' ),
			'ranklist'      => array( 'name' => 'RankList IQ', 'released' => true, 'launch_url' => '#ranklist' ),
			'ivprep'        => array( 'name' => 'IV Prep On-Call', 'released' => true, 'launch_url' => esc_url_raw( $ivprep_url ) ),
			'cam'           => array( 'name' => 'CAM Interview', 'released' => false, 'launch_url' => '' ),
			'courses'       => array( 'name' => 'My Match Training', 'released' => true, 'launch_url' => '#courses' ),
			'orders'        => array( 'name' => 'Orders', 'released' => true, 'launch_url' => '#orders' ),
			'notifications' => array( 'name' => 'Notifications', 'released' => true, 'launch_url' => '#notifications' ),
			'help'          => array( 'name' => 'Help', 'released' => true, 'launch_url' => '#help' ),
			'study'         => array( 'name' => 'Study Schedule', 'released' => true, 'launch_url' => '#study' ),
			'messages'      => array( 'name' => 'Med Messenger', 'released' => false, 'launch_url' => '#messages' ),
			'drjlivedrills' => array( 'name' => 'Dr J Live Drills', 'released' => false, 'launch_url' => '' ),
			'settings'      => array( 'name' => 'Settings', 'released' => false, 'launch_url' => '#settings' ),
		);
	}

	/**
	 * Preserve the dedicated Dr J restriction as a deny overlay.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param string $route Normalized route.
	 * @return bool
	 */
	private static function is_restricted_matrix_route( $user_id, $route ) {
		if ( ! function_exists( 'mm_drj_drills_access_user_is_restricted' ) || ! mm_drj_drills_access_user_is_restricted( $user_id ) ) {
			return false;
		}
		$config = function_exists( 'mm_drj_drills_access_config' ) ? mm_drj_drills_access_config() : array();
		$locked = isset( $config['locked_matrix_routes'] ) ? (array) $config['locked_matrix_routes'] : array();

		return in_array( $route, array_map( array( __CLASS__, 'normalize_app_route' ), $locked ), true );
	}

	/**
	 * Authoritative app decision for route and API gates.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param string $route App route.
	 * @return array<string,mixed>
	 */
	public static function get_app_access( $user_id, $route ) {
		$user_id = absint( $user_id );
		$route   = self::normalize_app_route( $route );
		$catalog = self::get_app_catalog();
		$app     = isset( $catalog[ $route ] ) ? $catalog[ $route ] : array( 'name' => ucwords( str_replace( '_', ' ', $route ) ), 'released' => false, 'launch_url' => '' );
		$allowed = false;
		$reason  = 'authentication_required';

		if ( $user_id > 0 ) {
			if ( empty( $app['released'] ) ) {
				$reason = 'not_released';
			} elseif ( self::is_restricted_matrix_route( $user_id, $route ) ) {
				$reason = 'restricted_role';
			} elseif ( self::user_has_full_access( $user_id ) ) {
				$allowed = true;
				$reason  = self::is_admin_full_access( $user_id ) ? 'administrator' : 'full_access_program';
			} else {
				$grants = array_merge( self::REGISTERED_BASELINE_MODULES, self::REGISTERED_ACCOUNT_MODULES, self::get_user_allowed_modules( $user_id ) );
				if ( 'enrolled' === self::get_tier( $user_id ) ) {
					$grants = array_merge( $grants, self::LEGACY_ENROLLED_MODULES );
				}
				$grants = array_map( array( __CLASS__, 'normalize_app_route' ), $grants );
				$allowed = in_array( $route, $grants, true );
				$reason  = $allowed ? ( 'enrolled' === self::get_tier( $user_id ) ? 'existing_entitlement' : 'registered_baseline' ) : 'entitlement_required';
			}
		}

		return array(
			'visible'    => true,
			'allowed'    => $allowed,
			'released'   => ! empty( $app['released'] ),
			'reason'     => $reason,
			'name'       => (string) $app['name'],
			'launch_url' => $allowed ? (string) $app['launch_url'] : '',
		);
	}

	/**
	 * Boolean gate used by direct-route and REST enforcement.
	 *
	 * @param int    $user_id WordPress user ID.
	 * @param string $route App route.
	 * @return bool
	 */
	public static function user_can_access_app( $user_id, $route ) {
		$decision = self::get_app_access( $user_id, $route );
		return true === $decision['allowed'];
	}

	/**
	 * Complete browser-safe per-app discovery and authorization projection.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array<string,array<string,mixed>>
	 */
	public static function get_matrix_apps( $user_id ) {
		$apps = array();
		foreach ( array_keys( self::get_app_catalog() ) as $route ) {
			$apps[ $route ] = self::get_app_access( $user_id, $route );
		}

		return $apps;
	}

	/**
	 * Get per-user Matrix modules opened for otherwise free-tier beta accounts.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string[]
	 */
	public static function get_user_allowed_modules( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return array();
		}

		$raw = get_user_meta( $user_id, self::META_ALLOWED_MODULES, true );
		if ( is_string( $raw ) ) {
			$raw = explode( ',', $raw );
		}

		return self::sanitize_module_list( (array) $raw );
	}

	/**
	 * Sanitize module route slugs.
	 *
	 * @param array $modules Candidate module route slugs.
	 * @return string[]
	 */
	private static function sanitize_module_list( $modules ) {
		$clean = array();
		foreach ( (array) $modules as $module ) {
			$module = sanitize_key( (string) $module );
			if ( '' !== $module ) {
				$clean[] = $module;
			}
		}

		return array_values( array_unique( $clean ) );
	}

	/**
	 * Determine whether a user has trusted WordPress admin-level Matrix access.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	public static function is_admin_full_access( $user_id ) {
		$user_id = absint( $user_id );

		return $user_id > 0 && user_can( $user_id, 'manage_options' );
	}

	/**
	 * Build the access payload for the frontend.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	public static function get_access_payload( $user_id ) {
		$is_admin_full_access = self::is_admin_full_access( $user_id );
		$tier                 = self::get_tier( $user_id );
		$free_modules         = self::get_free_modules();
		if ( ! $is_admin_full_access && 'free' === $tier ) {
			$free_modules = array_values(
				array_unique(
					array_merge(
						$free_modules,
						self::get_user_allowed_modules( $user_id )
					)
				)
			);
		}

		// Get enrolled course names for display.
		$enrolled_course_names = array();
		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$user_courses = learndash_user_get_enrolled_courses( $user_id );
			if ( is_array( $user_courses ) ) {
				foreach ( $user_courses as $course_id ) {
					$title = get_the_title( $course_id );
					if ( $title ) {
						$enrolled_course_names[] = $title;
					}
				}
			}
		}

		return array(
			'tier'              => $tier,
			'access_level'      => $is_admin_full_access ? 'administrator' : ( self::user_has_full_access( $user_id ) ? 'full' : ( 'enrolled' === $tier ? 'existing_paid' : 'registered' ) ),
			'dashboard'         => $user_id > 0,
			'full_access'       => self::user_has_full_access( $user_id ),
			'apps'              => self::get_matrix_apps( $user_id ),
			'free_modules'      => $free_modules,
			'is_enrolled'       => 'enrolled' === $tier,
			'is_admin'          => $is_admin_full_access,
			'admin_full_access' => $is_admin_full_access,
			'enrolled_courses' => $enrolled_course_names,
			'promo_courses'     => self::get_promo_courses(),
		);
	}

	/**
	 * Get promo course data for the FOMO enrollment CTA.
	 *
	 * @return array
	 */
	private static function get_promo_courses() {
		return array(
			array(
				'name'        => 'Mission Residency',
				'tagline'     => 'Complete match mentorship with interview prep, LOR strategy, and rank list optimization.',
				'icon'        => 'MR',
				'color'       => '#c8a84e',
				'url'         => '/mission-residency/',
			),
			array(
				'name'        => 'ExamPrep',
				'tagline'     => 'USMLE-focused study system with adaptive drills, performance analytics, and Arena access.',
				'icon'        => 'EP',
				'color'       => '#4ea0c8',
				'url'         => '/examprep/',
			),
			array(
				'name'        => 'Clinicals',
				'tagline'     => 'USCE clinical placement onboarding with compliance tracking and scheduling.',
				'icon'        => 'CL',
				'color'       => '#4ec870',
				'url'         => '/clinicals/',
			),
		);
	}

	// -------------------------------------------------------------------------
	// LOGIN REDIRECT
	// -------------------------------------------------------------------------

	/**
	 * Redirect users to the Matrix dashboard after login.
	 *
	 * @param string  $redirect_to   Default redirect URL.
	 * @param string  $requested     Requested redirect URL.
	 * @param WP_User $user          User object.
	 * @return string
	 */
	public static function login_redirect( $redirect_to, $requested, $user ) {
		if ( ! get_option( self::OPTION_REDIRECT_ENABLED, true ) ) {
			return $redirect_to;
		}

		// Only redirect non-admin users.
		if ( is_wp_error( $user ) || ! is_a( $user, 'WP_User' ) ) {
			return $redirect_to;
		}

		// If user explicitly requested a specific page (not wp-admin and not WC my-account), honor it.
		if ( ! empty( $requested ) && false === strpos( $requested, 'wp-admin' ) && $requested !== $redirect_to ) {
			// Don't honor WooCommerce my-account redirect - we always want Matrix dashboard.
			if ( false === strpos( $requested, 'my-account' ) ) {
				return $redirect_to;
			}
		}

		// Admins go to wp-admin as usual.
		if ( $user->has_cap( 'manage_options' ) ) {
			return $redirect_to;
		}

		$page_id = absint( get_option( self::OPTION_REDIRECT_PAGE, 0 ) );
		if ( ! $page_id ) {
			// Auto-detect: find the page with [mmed_hub] shortcode.
			$page_id = self::find_hub_page_id();
		}

		if ( $page_id ) {
			$url = get_permalink( $page_id );
			if ( $url ) {
				return $url;
			}
		}

		return $redirect_to;
	}

	/**
	 * Find the WordPress page that contains the [mmed_hub] shortcode.
	 *
	 * @return int Page ID or 0.
	 */
	private static function find_hub_page_id() {
		$pages = get_posts( array(
			'post_type'   => 'page',
			'post_status' => 'publish',
			'numberposts' => 50,
			's'           => 'mmed_hub',
		) );

		foreach ( $pages as $page ) {
			if ( has_shortcode( $page->post_content, 'mmed_hub' ) || has_shortcode( $page->post_content, 'mmed_command_center' ) ) {
				return $page->ID;
			}
		}

		return 0;
	}

	/**
	 * Clear cached tier for a user (called on enrollment change).
	 *
	 * @param int $user_id WordPress user ID.
	 */
	public static function clear_user_cache( $user_id ) {
		delete_transient( self::TIER_CACHE_PREFIX . absint( $user_id ) );
	}

	// -------------------------------------------------------------------------
	// ADMIN PAGE
	// -------------------------------------------------------------------------

	/**
	 * Render the admin settings page.
	 */
	public static function render_admin_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$redirect_enabled = get_option( self::OPTION_REDIRECT_ENABLED, true );
		$redirect_page    = absint( get_option( self::OPTION_REDIRECT_PAGE, 0 ) );
		$enrolled_courses = get_option( self::OPTION_ENROLLED_COURSES, '' );
		$free_modules     = get_option( self::OPTION_FREE_MODULES, 'dashboard,arena' );

		// Auto-detect hub page if not set.
		$auto_page = self::find_hub_page_id();

		// Get all LearnDash courses for the picker.
		$ld_courses = array();
		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$course_posts = get_posts( array(
				'post_type'   => 'sfwd-courses',
				'numberposts' => -1,
				'post_status' => 'publish',
				'orderby'     => 'title',
				'order'       => 'ASC',
			) );
			foreach ( $course_posts as $cp ) {
				$ld_courses[] = array(
					'id'    => $cp->ID,
					'title' => $cp->post_title,
				);
			}
		}

		// Current enrolled course IDs for checkbox state.
		$current_ids = array_filter( array_map( 'absint', explode( ',', $enrolled_courses ) ) );

		// Get all registered Matrix modules for free-module picker.
		$all_modules = array(
			'dashboard'     => 'Dashboard',
			'arena'         => 'Arena',
			'calendar'      => 'Calendar',
			'courses'       => 'My Courses',
			'orders'        => 'Orders',
			'settings'      => 'Settings',
			'notifications' => 'Notifications',
			'messages'      => 'Messages',
			'help'          => 'Help',
			'filevault'     => 'File Vault',
			'study'         => 'Study Schedule',
			'ranklist'      => 'RankList IQ',
			'lor'           => 'LOR Writer',
		);
		$current_free = array_filter( array_map( 'trim', explode( ',', $free_modules ) ) );

		// Quick user tier stats.
		$sample_users = get_users( array( 'number' => 200, 'fields' => 'ID' ) );
		$tier_counts  = array( 'enrolled' => 0, 'free' => 0 );
		foreach ( $sample_users as $uid ) {
			$t = self::get_tier( $uid );
			if ( isset( $tier_counts[ $t ] ) ) {
				$tier_counts[ $t ]++;
			}
		}

		?>
		<div class="wrap">
			<h1>Matrix Access Gate</h1>
			<p class="description">Control which Matrix modules are visible to enrolled vs. free-tier users, and configure login redirect behavior.</p>

			<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0;">
				<div style="background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:16px;">
					<h3 style="margin-top:0;color:#c8a84e;">Enrolled Users</h3>
					<p style="font-size:28px;font-weight:700;margin:0;"><?php echo esc_html( $tier_counts['enrolled'] ); ?></p>
					<p class="description">Full Matrix access</p>
				</div>
				<div style="background:#fff;border:1px solid #c3c4c7;border-radius:4px;padding:16px;">
					<h3 style="margin-top:0;color:#4ea0c8;">Free Users</h3>
					<p style="font-size:28px;font-weight:700;margin:0;"><?php echo esc_html( $tier_counts['free'] ); ?></p>
					<p class="description">Dashboard + Arena only</p>
				</div>
			</div>

			<form method="post" action="options.php">
				<?php settings_fields( 'mmed_access_gate_group' ); ?>

				<table class="form-table">
					<tr>
						<th scope="row">Login Redirect</th>
						<td>
							<label>
								<input type="checkbox" name="<?php echo esc_attr( self::OPTION_REDIRECT_ENABLED ); ?>" value="1" <?php checked( $redirect_enabled ); ?>>
								Redirect non-admin users to Matrix Dashboard after login
							</label>
							<p class="description">
								<?php if ( $auto_page ) : ?>
									Auto-detected Hub page: <strong><?php echo esc_html( get_the_title( $auto_page ) ); ?></strong> (ID: <?php echo esc_html( $auto_page ); ?>)
								<?php else : ?>
									No page with [mmed_hub] shortcode found. Create one or set the ID manually below.
								<?php endif; ?>
							</p>
						</td>
					</tr>
					<tr>
						<th scope="row">Redirect Page ID</th>
						<td>
							<input type="number" name="<?php echo esc_attr( self::OPTION_REDIRECT_PAGE ); ?>" value="<?php echo esc_attr( $redirect_page ); ?>" min="0" style="width:120px;">
							<p class="description">Leave 0 to auto-detect the page with [mmed_hub] shortcode.</p>
						</td>
					</tr>
					<tr>
						<th scope="row">Courses That Grant Full Access</th>
						<td>
							<?php if ( ! empty( $ld_courses ) ) : ?>
								<fieldset>
									<?php foreach ( $ld_courses as $course ) : ?>
										<label style="display:block;margin-bottom:6px;">
											<input type="checkbox"
											       class="mmed-gate-course-cb"
											       value="<?php echo esc_attr( $course['id'] ); ?>"
											       <?php checked( in_array( $course['id'], $current_ids, true ) ); ?>>
											<?php echo esc_html( $course['title'] ); ?>
											<span class="description">(ID: <?php echo esc_html( $course['id'] ); ?>)</span>
										</label>
									<?php endforeach; ?>
								</fieldset>
								<input type="hidden" name="<?php echo esc_attr( self::OPTION_ENROLLED_COURSES ); ?>" id="mmed-gate-courses-hidden" value="<?php echo esc_attr( $enrolled_courses ); ?>">
								<script>
									(function(){
										var hidden = document.getElementById('mmed-gate-courses-hidden');
										var cbs = document.querySelectorAll('.mmed-gate-course-cb');
										function sync() {
											var ids = [];
											cbs.forEach(function(cb) { if (cb.checked) ids.push(cb.value); });
											hidden.value = ids.join(',');
										}
										cbs.forEach(function(cb) { cb.addEventListener('change', sync); });
									})();
								</script>
							<?php else : ?>
								<p class="description">LearnDash is not active, or no courses exist. Enter course IDs manually:</p>
								<input type="text" name="<?php echo esc_attr( self::OPTION_ENROLLED_COURSES ); ?>" value="<?php echo esc_attr( $enrolled_courses ); ?>" style="width:400px;" placeholder="e.g. 3893,5227,3646">
							<?php endif; ?>
							<p class="description">Users enrolled in any of these courses get full Matrix access. Leave empty to use the mappings from the Access Audit settings.</p>
						</td>
					</tr>
					<tr>
						<th scope="row">Free-Tier Modules</th>
						<td>
							<fieldset>
								<?php foreach ( $all_modules as $slug => $label ) : ?>
									<label style="display:inline-block;margin-right:16px;margin-bottom:6px;">
										<input type="checkbox"
										       class="mmed-gate-free-cb"
										       value="<?php echo esc_attr( $slug ); ?>"
										       <?php checked( in_array( $slug, $current_free, true ) ); ?>
										       <?php disabled( 'dashboard' === $slug ); ?>>
										<?php echo esc_html( $label ); ?>
									</label>
								<?php endforeach; ?>
							</fieldset>
							<input type="hidden" name="<?php echo esc_attr( self::OPTION_FREE_MODULES ); ?>" id="mmed-gate-free-hidden" value="<?php echo esc_attr( $free_modules ); ?>">
							<script>
								(function(){
									var hidden = document.getElementById('mmed-gate-free-hidden');
									var cbs = document.querySelectorAll('.mmed-gate-free-cb');
									function sync() {
										var slugs = ['dashboard']; // Always include dashboard
										cbs.forEach(function(cb) { if (cb.checked && cb.value !== 'dashboard') slugs.push(cb.value); });
										hidden.value = slugs.join(',');
									}
									cbs.forEach(function(cb) { cb.addEventListener('change', sync); });
								})();
							</script>
							<p class="description">Modules available to non-enrolled users. Dashboard is always included. All other modules show a lock icon for free-tier users.</p>
						</td>
					</tr>
				</table>

				<?php submit_button( 'Save Access Gate Settings' ); ?>
			</form>
		</div>
		<?php
	}
}
