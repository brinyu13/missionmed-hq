<?php
/**
 * Matrix Calendar experience selection and current-user preference endpoint.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves exactly one Calendar renderer before assets are selected.
 */
class MMED_Calendar_Experience {

	const REST_NAMESPACE = 'mmed/v1';
	const USER_META      = '_mmed_calendar_experience';
	const OPTION_DEFAULT = 'mmed_calendar_experience_default';
	const OPTION_ENABLED = 'mmed_calendar_v2_enabled';
	const OPTION_FORCE   = 'mmed_calendar_force_classic';

	/**
	 * Register the current-user preference route.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register authenticated, self-only preference reads and writes.
	 *
	 * @return void
	 */
	public static function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/me/calendar-experience',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_preference' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'save_preference' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => array(
						'experience' => array(
							'required'          => true,
							'sanitize_callback' => array( __CLASS__, 'sanitize_experience' ),
							'validate_callback' => array( __CLASS__, 'validate_experience' ),
						),
					),
				),
			)
		);
	}

	/**
	 * Require an authenticated Matrix user. The endpoint never accepts a user id.
	 *
	 * @return bool
	 */
	public static function can_access() {
		return is_user_logged_in();
	}

	/**
	 * Resolve values in the documented precedence order.
	 *
	 * @param bool   $force_classic Emergency override.
	 * @param string $user_choice   Current-user preference.
	 * @param string $admin_default Site default.
	 * @param bool   $v2_enabled    StoryForge renderer availability.
	 * @return string
	 */
	public static function resolve_values( $force_classic, $user_choice, $admin_default, $v2_enabled ) {
		if ( $force_classic || ! $v2_enabled ) {
			return 'classic';
		}

		$user_choice = self::sanitize_experience( $user_choice );
		if ( $user_choice ) {
			return $user_choice;
		}

		$admin_default = self::sanitize_experience( $admin_default );
		return $admin_default ? $admin_default : 'classic';
	}

	/**
	 * Resolve the effective experience for a user.
	 *
	 * @param int|null $user_id User id; defaults to the current user.
	 * @return string
	 */
	public static function resolve( $user_id = null ) {
		$user_id = null === $user_id ? get_current_user_id() : absint( $user_id );
		return self::resolve_values(
			(bool) get_option( self::OPTION_FORCE, false ),
			$user_id ? get_user_meta( $user_id, self::USER_META, true ) : '',
			get_option( self::OPTION_DEFAULT, 'storyforge' ),
			(bool) get_option( self::OPTION_ENABLED, true )
		);
	}

	/**
	 * Build a browser-safe bootstrap payload before renderer selection.
	 *
	 * @return array
	 */
	public static function bootstrap() {
		$experience = self::resolve();
		$forced     = (bool) get_option( self::OPTION_FORCE, false );
		$base       = trailingslashit( MMED_HUB_URL . 'assets' );

		return array(
			'experience'  => $experience,
			'forced'      => $forced,
			'v2_enabled'  => (bool) get_option( self::OPTION_ENABLED, true ),
			'timezone'    => 'America/New_York',
			'timezone_label' => 'Eastern Time (ET)',
			'preference_url' => rest_url( self::REST_NAMESPACE . '/me/calendar-experience' ),
			'assets'      => array(
				'core'       => $base . 'calendar-core/mmed-calendar-core.js',
				'classic_js' => $base . 'student-os-calendar-v4.js',
				'v2_js'      => $base . 'calendar-v2/mmed-calendar-v2.js',
			),
		);
	}

	/**
	 * Read the caller's preference and effective resolution.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_preference() {
		$user_id = get_current_user_id();
		return new WP_REST_Response(
			array(
				'preference' => self::sanitize_experience( get_user_meta( $user_id, self::USER_META, true ) ),
				'resolved'   => self::resolve( $user_id ),
				'forced'     => (bool) get_option( self::OPTION_FORCE, false ),
			),
			200
		);
	}

	/**
	 * Save only the authenticated caller's preference.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save_preference( $request ) {
		$experience = self::sanitize_experience( $request->get_param( 'experience' ) );
		if ( ! $experience ) {
			return new WP_Error( 'mmed_calendar_invalid_experience', 'Choose Classic or StoryForge.', array( 'status' => 400 ) );
		}

		update_user_meta( get_current_user_id(), self::USER_META, $experience );
		return self::get_preference();
	}

	/**
	 * Normalize an experience name.
	 *
	 * @param mixed $value Candidate value.
	 * @return string
	 */
	public static function sanitize_experience( $value ) {
		$value = strtolower( sanitize_key( (string) $value ) );
		return in_array( $value, array( 'classic', 'storyforge' ), true ) ? $value : '';
	}

	/**
	 * Validate an experience name for REST argument handling.
	 *
	 * @param mixed $value Candidate value.
	 * @return bool
	 */
	public static function validate_experience( $value ) {
		return '' !== self::sanitize_experience( $value );
	}
}
