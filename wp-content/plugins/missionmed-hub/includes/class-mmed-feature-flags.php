<?php
/**
 * MissionMed Matrix feature flags.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Option-backed feature flag registry for Matrix experiments.
 */
class MMED_Feature_Flags {

	/**
	 * Option key used to store flag states.
	 */
	const OPTION_KEY = 'mmed_feature_flags';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * Seed missing flags without overwriting saved states.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		$current = get_option( self::OPTION_KEY, null );
		$states  = is_array( $current ) ? $current : array();
		$changed = ! is_array( $current );

		foreach ( self::known_flags() as $name => $definition ) {
			if ( ! array_key_exists( $name, $states ) ) {
				$states[ $name ] = (bool) $definition['default'];
				$changed         = true;
			}
		}

		foreach ( self::flag_aliases() as $alias => $canonical ) {
			if ( ! empty( $states[ $alias ] ) && empty( $states[ $canonical ] ) ) {
				$states[ $canonical ] = true;
				$changed              = true;
			}
		}

		foreach ( array_keys( $states ) as $name ) {
			if ( ! isset( self::known_flags()[ $name ] ) ) {
				unset( $states[ $name ] );
				$changed = true;
			}
		}

		if ( $changed ) {
			update_option( self::OPTION_KEY, $states, false );
		}
	}

	/**
	 * Determine whether a flag is enabled.
	 *
	 * @param string $flag_name Flag name.
	 * @return bool
	 */
	public static function is_enabled( $flag_name ) {
		$flag_name = sanitize_key( $flag_name );
		$known     = self::known_flags();

		if ( ! isset( $known[ $flag_name ] ) ) {
			return false;
		}

		$states = self::get_flag_states();

		if ( ! empty( $states[ $flag_name ] ) ) {
			return true;
		}

		$alias_map = self::flag_aliases();
		if ( isset( $alias_map[ $flag_name ] ) ) {
			return ! empty( $states[ $alias_map[ $flag_name ] ] );
		}

		$canonical_map = array_flip( $alias_map );
		return isset( $canonical_map[ $flag_name ] ) && ! empty( $states[ $canonical_map[ $flag_name ] ] );
	}

	/**
	 * Set a known flag state.
	 *
	 * @param string $flag_name Flag name.
	 * @param bool   $enabled Enabled state.
	 * @return true|WP_Error
	 */
	public static function set_flag( $flag_name, $enabled ) {
		$flag_name = sanitize_key( $flag_name );
		$known     = self::known_flags();

		if ( ! isset( $known[ $flag_name ] ) ) {
			return new WP_Error(
				'mmed_unknown_feature_flag',
				'Unknown feature flag.',
				array( 'status' => 400 )
			);
		}

		$states               = self::get_flag_states();
		$states[ $flag_name ] = (bool) $enabled;

		if ( isset( self::flag_aliases()[ $flag_name ] ) ) {
			$states[ self::flag_aliases()[ $flag_name ] ] = (bool) $enabled;
		}
		foreach ( self::flag_aliases() as $alias => $canonical ) {
			if ( $canonical === $flag_name ) {
				$states[ $alias ] = (bool) $enabled;
			}
		}

		update_option( self::OPTION_KEY, $states, false );

		return true;
	}

	/**
	 * Return all flags with descriptions.
	 *
	 * @return array
	 */
	public static function get_all_flags() {
		$states = self::get_flag_states();
		$flags  = array();

		foreach ( self::known_flags() as $name => $definition ) {
			$flags[] = array(
				'name'        => $name,
				'enabled'     => ! empty( $states[ $name ] ),
				'description' => $definition['description'],
			);
		}

		return $flags;
	}

	/**
	 * Return an associative map of flag states for frontend bootstraps.
	 *
	 * @return array
	 */
	public static function get_flag_states() {
		$stored = get_option( self::OPTION_KEY, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$states = array();

		foreach ( self::known_flags() as $name => $definition ) {
			$states[ $name ] = array_key_exists( $name, $stored ) ? (bool) $stored[ $name ] : (bool) $definition['default'];
		}

		foreach ( self::flag_aliases() as $alias => $canonical ) {
			if ( ! empty( $states[ $alias ] ) && empty( $states[ $canonical ] ) ) {
				$states[ $canonical ] = true;
			}
		}

		return $states;
	}

	/**
	 * REST list endpoint.
	 *
	 * @return WP_REST_Response
	 */
	public static function rest_list() {
		return new WP_REST_Response(
			array(
				'flags' => self::get_all_flags(),
			),
			200
		);
	}

	/**
	 * REST update endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_update( $request ) {
		$flag    = sanitize_key( $request->get_param( 'flag' ) );
		$enabled = rest_sanitize_boolean( $request->get_param( 'enabled' ) );
		$result  = self::set_flag( $flag, $enabled );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return new WP_REST_Response(
			array(
				'flags' => self::get_all_flags(),
			),
			200
		);
	}

	/**
	 * Known flag whitelist.
	 *
	 * @return array
	 */
	private static function known_flags() {
		return array(
			'webex_embedded_widget' => array(
				'default'     => false,
				'description' => 'Use embedded Webex meeting widget instead of external link',
			),
			'webex_live_drills_shell_preview' => array(
				'default'     => false,
				'description' => 'Enable admin-only Daily Drills live Webex shell preview route',
			),
			'live_drills_team_challenge' => array(
				'default'     => false,
				'description' => 'Enable gated Daily Drills Live Team Challenge prototype',
			),
			'attendance_tracking'   => array(
				'default'     => false,
				'description' => 'Track session attendance via Webex API',
			),
			'session_recordings'    => array(
				'default'     => false,
				'description' => 'Sync and display Webex session recordings',
			),
			'session_chat'          => array(
				'default'     => false,
				'description' => 'Enable persistent chat/Q&A for live sessions',
			),
			'arena_live_battles'    => array(
				'default'     => false,
				'description' => 'Enable real-time Arena quiz battles during sessions',
			),
			'drill_gamification'    => array(
				'default'     => false,
				'description' => 'Enable self-reported Dr. J drill scoreboard and streaks',
			),
			'interview_prep_rooms'  => array(
				'default'     => false,
				'description' => 'Enable private Interview Prep rooms, slots, and feedback',
			),
			'office_hours_queue'    => array(
				'default'     => false,
				'description' => 'Enable student Office Hours queue controls',
			),
			'interview_prep'        => array(
				'default'     => false,
				'description' => 'Alias for Interview Prep Rooms',
			),
			'office_hours'          => array(
				'default'     => false,
				'description' => 'Alias for Office Hours Queue',
			),
			'session_reminders'     => array(
				'default'     => false,
				'description' => 'Send email reminders before sessions',
			),
			'appointments_force_classic' => array(
				'default'     => false,
				'description' => 'Force the Classic Appointments presentation without changing student preferences or appointment data',
			),
		);
	}

	/**
	 * Legacy flag aliases.
	 *
	 * @return array
	 */
	private static function flag_aliases() {
		return array(
			'interview_prep' => 'interview_prep_rooms',
			'office_hours'   => 'office_hours_queue',
		);
	}
}
