<?php
/**
 * Matrix Dashboard 2.0 experience selection, featured-app content store, and
 * administrator-only front-end editing endpoints.
 *
 * Mirrors MMED_Calendar_Experience (MX-CAL-4200C) so both experiences share one
 * governance model: fail-closed availability, server-resolved precedence, and a
 * Force Classic emergency fallback.
 *
 * MX-DASH-6000C · additive only · Dashboard V1 (Classic) is untouched.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves exactly one Dashboard renderer and owns the featured-app content.
 */
class MMED_Dashboard_Experience {

	const REST_NAMESPACE = 'mmed/v1';
	const USER_META      = '_mmed_dashboard_experience';
	const OPTION_DEFAULT = 'mmed_dashboard_experience_default';
	const OPTION_ENABLED = 'mmed_dashboard_v2_enabled';
	const OPTION_FORCE   = 'mmed_dashboard_force_classic';
	const OPTION_APPS    = 'mmed_dashboard_featured_apps';
	const OPTION_INVITE  = 'mmed_dashboard_v2_invite';
	const ASSET_VERSION  = '6000c-1';

	/** Fixed featured-app identifiers. Content is editable; the set is not. */
	const APP_IDS = array( 'homebase', 'calendar', 'scheduler', 'storyforge', 'ivprep', 'rise', 'ranklist', 'lor' );

	/** Text fields an administrator may edit (key => max length). */
	const TEXT_FIELDS = array(
		'name'     => 60,
		'cat'      => 30,
		'sub'      => 160,
		'adminSub' => 160,
		'one'      => 160,
		'problem'  => 240,
		'how'      => 900,
		'outcome'  => 240,
		'when'     => 160,
		'cta'      => 40,
		'cta2'     => 40,
		'launch'   => 300,
	);

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_menu', array( __CLASS__, 'register_settings_page' ) );
	}

	/* ------------------------------------------------------------------ */
	/* Experience resolution (same precedence as Calendar V2)             */
	/* ------------------------------------------------------------------ */

	/** Register the fail-closed Dashboard controls with the Settings API. */
	public static function register_settings() {
		register_setting( 'mmed_dashboard_experience', self::OPTION_DEFAULT, array( 'sanitize_callback' => array( __CLASS__, 'sanitize_default' ), 'default' => 'classic' ) );
		register_setting( 'mmed_dashboard_experience', self::OPTION_ENABLED, array( 'sanitize_callback' => array( __CLASS__, 'sanitize_boolean' ), 'default' => false ) );
		register_setting( 'mmed_dashboard_experience', self::OPTION_FORCE, array( 'sanitize_callback' => array( __CLASS__, 'sanitize_boolean' ), 'default' => false ) );
		register_setting( 'mmed_dashboard_experience', self::OPTION_INVITE, array( 'sanitize_callback' => array( __CLASS__, 'sanitize_boolean' ), 'default' => true ) );
	}

	/** Register the administrator-only Dashboard experience page. */
	public static function register_settings_page() {
		add_options_page( 'Dashboard Experience', 'Dashboard Experience', 'manage_options', 'mmed-dashboard-experience', array( __CLASS__, 'render_settings_page' ) );
	}

	/** Render the administrator default and emergency fallback controls. */
	public static function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$default = get_option( self::OPTION_DEFAULT, 'classic' );
		$enabled = (bool) get_option( self::OPTION_ENABLED, false );
		$forced  = (bool) get_option( self::OPTION_FORCE, false );
		$invite  = (bool) get_option( self::OPTION_INVITE, true );
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Dashboard Experience', 'missionmed-hub' ); ?></h1>
			<p><?php esc_html_e( 'Matrix Dashboard 2.0 is an additive renderer for the #dashboard route. Classic (Dashboard V1) stays available and is the emergency fallback. Featured-app copy and images are edited on the front end by administrators.', 'missionmed-hub' ); ?></p>
			<form method="post" action="options.php">
				<?php settings_fields( 'mmed_dashboard_experience' ); ?>
				<table class="form-table" role="presentation">
					<tr><th scope="row"><?php esc_html_e( 'Default experience', 'missionmed-hub' ); ?></th><td>
						<label><input type="radio" name="<?php echo esc_attr( self::OPTION_DEFAULT ); ?>" value="classic" <?php checked( $default, 'classic' ); ?>> <?php esc_html_e( 'Classic (Dashboard V1)', 'missionmed-hub' ); ?></label><br>
						<label><input type="radio" name="<?php echo esc_attr( self::OPTION_DEFAULT ); ?>" value="matrix2" <?php checked( $default, 'matrix2' ); ?>> <?php esc_html_e( 'Matrix 2.0', 'missionmed-hub' ); ?></label>
					</td></tr>
					<tr><th scope="row"><?php esc_html_e( 'Matrix 2.0 availability', 'missionmed-hub' ); ?></th><td><input type="hidden" name="<?php echo esc_attr( self::OPTION_ENABLED ); ?>" value="0"><label><input type="checkbox" name="<?php echo esc_attr( self::OPTION_ENABLED ); ?>" value="1" <?php checked( $enabled ); ?>> <?php esc_html_e( 'Enable Matrix 2.0 (off = every user sees Classic, no 2.0 assets load)', 'missionmed-hub' ); ?></label></td></tr>
					<tr><th scope="row"><?php esc_html_e( 'Invite from Classic', 'missionmed-hub' ); ?></th><td><input type="hidden" name="<?php echo esc_attr( self::OPTION_INVITE ); ?>" value="0"><label><input type="checkbox" name="<?php echo esc_attr( self::OPTION_INVITE ); ?>" value="1" <?php checked( $invite ); ?>> <?php esc_html_e( 'Show a small "Try Matrix 2.0" banner on Classic for users who have not switched', 'missionmed-hub' ); ?></label></td></tr>
					<tr><th scope="row"><?php esc_html_e( 'Emergency fallback', 'missionmed-hub' ); ?></th><td><input type="hidden" name="<?php echo esc_attr( self::OPTION_FORCE ); ?>" value="0"><label><input type="checkbox" name="<?php echo esc_attr( self::OPTION_FORCE ); ?>" value="1" <?php checked( $forced ); ?>> <?php esc_html_e( 'Force Classic for every user', 'missionmed-hub' ); ?></label></td></tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * Resolve values in precedence order: force → enabled gate → user → default → classic.
	 *
	 * @param bool   $force_classic Emergency override.
	 * @param string $user_choice   Current-user preference.
	 * @param string $admin_default Site default.
	 * @param bool   $v2_enabled    Matrix 2.0 availability.
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
			get_option( self::OPTION_DEFAULT, 'classic' ),
			(bool) get_option( self::OPTION_ENABLED, false )
		);
	}

	/**
	 * Whether the Classic page should carry a "Try Matrix 2.0" invite.
	 *
	 * @return bool
	 */
	public static function should_invite() {
		return (bool) get_option( self::OPTION_ENABLED, false )
			&& ! (bool) get_option( self::OPTION_FORCE, false )
			&& (bool) get_option( self::OPTION_INVITE, true )
			&& 'classic' === self::resolve();
	}

	/* ------------------------------------------------------------------ */
	/* Asset enqueue (called from MMED_Student_OS::enqueue_assets)        */
	/* ------------------------------------------------------------------ */

	/**
	 * Enqueue the Dashboard 2.0 renderer only when it will be used.
	 *
	 * Runs before the Runtime v2 early return in MMED_Student_OS so the
	 * home route always has its renderer; nothing else is affected.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		$experience = self::resolve();
		$invite     = self::should_invite();
		if ( 'matrix2' !== $experience && ! $invite ) {
			return;
		}

		$css_path = MMED_HUB_PATH . 'assets/dashboard-v2/mmed-dashboard-v2.css';
		$js_path  = MMED_HUB_PATH . 'assets/dashboard-v2/mmed-dashboard-v2.js';
		$is_admin = current_user_can( 'manage_options' );

		wp_enqueue_style(
			'mmed-dashboard-v2-fonts',
			'https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,800;0,900;1,800;1,900&family=Rajdhani:wght@500;600;700&family=Lora:ital,wght@0,400;0,500;1,400;1,500&display=swap',
			array(),
			null
		);
		wp_enqueue_style(
			'mmed-dashboard-v2-css',
			MMED_HUB_URL . 'assets/dashboard-v2/mmed-dashboard-v2.css',
			array( 'mmed-student-os-css' ),
			file_exists( $css_path ) ? filemtime( $css_path ) . '-' . self::ASSET_VERSION : MMED_HUB_VERSION
		);
		$art_path = MMED_HUB_PATH . 'assets/dashboard-v2/mmed-dashboard-v2-art.js';
		wp_enqueue_script(
			'mmed-dashboard-v2-art-js',
			MMED_HUB_URL . 'assets/dashboard-v2/mmed-dashboard-v2-art.js',
			array(),
			file_exists( $art_path ) ? filemtime( $art_path ) . '-' . self::ASSET_VERSION : MMED_HUB_VERSION,
			true
		);
		wp_enqueue_script(
			'mmed-dashboard-v2-js',
			MMED_HUB_URL . 'assets/dashboard-v2/mmed-dashboard-v2.js',
			array( 'mmed-student-os-js', 'mmed-dashboard-v2-art-js' ),
			file_exists( $js_path ) ? filemtime( $js_path ) . '-' . self::ASSET_VERSION : MMED_HUB_VERSION,
			true
		);
		wp_localize_script( 'mmed-dashboard-v2-js', 'mmedDashboardV2', self::bootstrap( $experience, $invite, $is_admin ) );

		if ( $is_admin && 'matrix2' === $experience && current_user_can( 'upload_files' ) ) {
			/* WordPress-native front-end media picker for card / detail images. */
			wp_enqueue_media();
		}
	}

	/**
	 * Browser-safe bootstrap payload.
	 *
	 * @param string $experience Resolved experience.
	 * @param bool   $invite     Invite mode.
	 * @param bool   $is_admin   Server-resolved administrator flag.
	 * @return array
	 */
	public static function bootstrap( $experience, $invite, $is_admin ) {
		return array(
			'experience'     => $experience,
			'invite'         => (bool) $invite,
			'is_admin'       => (bool) $is_admin,
			'can_edit'       => (bool) $is_admin,
			'forced'         => (bool) get_option( self::OPTION_FORCE, false ),
			'preference_url' => rest_url( self::REST_NAMESPACE . '/me/dashboard-experience' ),
			'apps_url'       => rest_url( self::REST_NAMESPACE . '/dashboard/featured-apps' ),
			'settings_url'   => $is_admin ? admin_url( 'options-general.php?page=mmed-dashboard-experience' ) : '',
			'apps'           => self::get_apps(),
			'defaults'       => self::default_apps(),
			'asset_base'     => MMED_HUB_URL . 'assets/dashboard-v2/',
		);
	}

	/* ------------------------------------------------------------------ */
	/* REST                                                               */
	/* ------------------------------------------------------------------ */

	/** Register preference (self-only) and featured-app (admin write) routes. */
	public static function register_routes() {
		register_rest_route(
			self::REST_NAMESPACE,
			'/me/dashboard-experience',
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

		register_rest_route(
			self::REST_NAMESPACE,
			'/dashboard/featured-apps',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'rest_get_apps' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/dashboard/featured-apps/(?P<id>[a-z]+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'rest_save_app' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
					'args'                => array( 'id' => array( 'validate_callback' => array( __CLASS__, 'validate_app_id' ) ) ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'rest_reset_app' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
					'args'                => array( 'id' => array( 'validate_callback' => array( __CLASS__, 'validate_app_id' ) ) ),
				),
			)
		);
	}

	/** Authenticated Matrix user. */
	public static function can_access() {
		return is_user_logged_in();
	}

	/** Same administrator capability MMED_REST_API::can_manage uses. */
	public static function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/** Read the caller's preference and effective resolution. */
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
			return new WP_Error( 'mmed_dashboard_invalid_experience', 'Choose Classic or Matrix 2.0.', array( 'status' => 400 ) );
		}
		update_user_meta( get_current_user_id(), self::USER_META, $experience );
		return self::get_preference();
	}

	/** Merged featured-app content (defaults + administrator overrides). */
	public static function rest_get_apps() {
		return new WP_REST_Response( array( 'apps' => self::get_apps() ), 200 );
	}

	/**
	 * Save administrator overrides for one featured app.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_save_app( $request ) {
		$id = sanitize_key( $request->get_param( 'id' ) );
		if ( ! in_array( $id, self::APP_IDS, true ) ) {
			return new WP_Error( 'mmed_dashboard_unknown_app', 'Unknown featured app.', array( 'status' => 404 ) );
		}

		$body  = $request->get_json_params();
		$body  = is_array( $body ) ? $body : array();
		$clean = self::sanitize_override( $body );

		$all        = self::get_overrides();
		$all[ $id ] = $clean;
		update_option( self::OPTION_APPS, $all, false );

		$apps = self::get_apps();
		return new WP_REST_Response( array( 'app' => $apps[ $id ], 'apps' => $apps ), 200 );
	}

	/**
	 * Remove overrides for one featured app (restores server defaults).
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function rest_reset_app( $request ) {
		$id = sanitize_key( $request->get_param( 'id' ) );
		if ( ! in_array( $id, self::APP_IDS, true ) ) {
			return new WP_Error( 'mmed_dashboard_unknown_app', 'Unknown featured app.', array( 'status' => 404 ) );
		}
		$all = self::get_overrides();
		unset( $all[ $id ] );
		update_option( self::OPTION_APPS, $all, false );
		$apps = self::get_apps();
		return new WP_REST_Response( array( 'app' => $apps[ $id ], 'apps' => $apps ), 200 );
	}

	/* ------------------------------------------------------------------ */
	/* Content store                                                      */
	/* ------------------------------------------------------------------ */

	/** Stored overrides keyed by app id. */
	private static function get_overrides() {
		$stored = get_option( self::OPTION_APPS, array() );
		return is_array( $stored ) ? $stored : array();
	}

	/**
	 * Defaults merged with overrides; every app always has every field.
	 *
	 * @return array
	 */
	public static function get_apps() {
		$defaults  = self::default_apps();
		$overrides = self::get_overrides();
		$apps      = array();
		foreach ( $defaults as $id => $app ) {
			$over = isset( $overrides[ $id ] ) && is_array( $overrides[ $id ] ) ? self::sanitize_override( $overrides[ $id ] ) : array();
			$app  = array_merge( $app, array_filter( $over, array( __CLASS__, 'is_set_value' ) ) );
			$app['id']       = $id;
			$app['edited']   = ! empty( $over );
			$apps[ $id ]     = $app;
		}
		return $apps;
	}

	/** array_filter helper: keep non-empty strings, arrays, and integers. */
	public static function is_set_value( $value ) {
		if ( is_array( $value ) ) {
			return ! empty( $value );
		}
		if ( is_int( $value ) ) {
			return $value > 0;
		}
		return '' !== trim( (string) $value );
	}

	/**
	 * Sanitize an override payload. Unknown keys are dropped; every value is
	 * length-capped plain text, an absolute http(s) URL, or an attachment id.
	 *
	 * @param array $raw Raw override.
	 * @return array
	 */
	public static function sanitize_override( $raw ) {
		$clean = array();
		foreach ( self::TEXT_FIELDS as $key => $max ) {
			if ( ! isset( $raw[ $key ] ) ) {
				continue;
			}
			$value = 'how' === $key ? sanitize_textarea_field( (string) $raw[ $key ] ) : sanitize_text_field( (string) $raw[ $key ] );
			$value = trim( $value );
			if ( 'launch' === $key && '' !== $value && '#' !== substr( $value, 0, 1 ) ) {
				$value = esc_url_raw( $value, array( 'http', 'https' ) );
			}
			if ( '' !== $value ) {
				$clean[ $key ] = mb_substr( $value, 0, $max );
			}
		}

		if ( isset( $raw['benefits'] ) && is_array( $raw['benefits'] ) ) {
			$benefits = array();
			foreach ( array_slice( $raw['benefits'], 0, 5 ) as $pair ) {
				if ( ! is_array( $pair ) ) {
					continue;
				}
				$feature = mb_substr( trim( sanitize_text_field( (string) ( $pair[0] ?? '' ) ) ), 0, 60 );
				$benefit = mb_substr( trim( sanitize_text_field( (string) ( $pair[1] ?? '' ) ) ), 0, 160 );
				if ( '' !== $feature ) {
					$benefits[] = array( $feature, $benefit );
				}
			}
			if ( $benefits ) {
				$clean['benefits'] = $benefits;
			}
		}

		foreach ( array( 'card_image', 'detail_image' ) as $key ) {
			if ( isset( $raw[ $key ] ) ) {
				$url = esc_url_raw( trim( (string) $raw[ $key ] ), array( 'http', 'https' ) );
				if ( '' !== $url ) {
					$clean[ $key ] = $url;
				}
			}
			if ( isset( $raw[ $key . '_id' ] ) ) {
				$attachment_id = absint( $raw[ $key . '_id' ] );
				if ( $attachment_id > 0 ) {
					$clean[ $key . '_id' ] = $attachment_id;
				}
			}
		}

		return $clean;
	}

	/**
	 * Server-owned defaults. These never depend on the option, so the student
	 * experience cannot be emptied by a bad edit.
	 *
	 * @return array
	 */
	public static function default_apps() {
		return array(
			'homebase'   => array(
				'name' => 'HomeBase', 'cat' => 'Command', 'hue' => '#46d3c0', 'launch' => '#dashboard',
				'sub' => 'Your command center — what matters today, and where to go next.',
				'adminSub' => 'Operations command center — sessions, reviews, and student signals.',
				'one' => 'One calm place that makes your priorities and destinations obvious.',
				'problem' => "I have a lot going on and I don't know what to focus on or where to go.",
				'how' => 'HomeBase gathers your next session, open tasks, unread messages, and the work you last touched into one view, and puts the most time-sensitive item first. It is the front door to every other Matrix app, so you never start from a blank screen or a memory test of app names.',
				'benefits' => array( array( 'Today at a glance', 'Know your next step in five seconds instead of checking four places.' ), array( 'Priority tasks', 'Stop guessing what is due; deadlines surface before they become emergencies.' ), array( 'Continue where you left off', 'Your last StoryForge draft or RISE list is one click away — no hunting.' ), array( "Ask, don't browse", 'Type the problem you have and HomeBase routes you to the right tool.' ) ),
				'outcome' => 'You start every session knowing exactly what to do first — and you spend the time doing it.',
				'when' => 'Every time you open Matrix.', 'cta' => 'Open HomeBase', 'cta2' => "See today's plan",
			),
			'calendar'   => array(
				'name' => 'Calendar', 'cat' => 'Planning', 'hue' => '#39d6ff', 'launch' => '#calendar',
				'sub' => "See what's coming — classes, live sessions, appointments — in one timeline.",
				'adminSub' => 'Program schedule: Drills, live sessions, and student appointments in one timeline.',
				'one' => "Everything scheduled for you, in one timeline, with what's next always first.",
				'problem' => "I don't want to miss something important or waste time figuring out what is happening.",
				'how' => 'Calendar merges MissionMed classes, Drills, live sessions, and your booked appointments into one timeline. Join links live on the event itself, times show in Eastern and your local zone, and the next item is always at the top — so "what\'s happening?" has a one-glance answer.',
				'benefits' => array( array( 'One unified timeline', 'No cross-checking emails, Webex links, and course pages.' ), array( 'Next up, always first', 'The very next thing you need to be at is the first thing you see.' ), array( 'Join from the event', 'The link is where the event is — no searching your inbox at 2:59.' ), array( 'Eastern + your local time', 'Time-zone mistakes stop being a thing.' ) ),
				'outcome' => 'You never miss a session, and you never lose ten minutes finding one.',
				'when' => 'Whenever you ask "what\'s next?"', 'cta' => 'View My Calendar', 'cta2' => '',
			),
			'scheduler'  => array(
				'name' => 'Scheduler', 'cat' => 'Planning', 'hue' => '#4ade9d', 'launch' => '#scheduler',
				'sub' => 'Book advising, mock interviews, and practice time — no back-and-forth.',
				'adminSub' => 'Manage availability, appointment types, and who has booked what.',
				'one' => 'Find and book the right session with the right person, in under a minute.',
				'problem' => "I need help or practice time and I don't want the scheduling back-and-forth.",
				'how' => 'Scheduler shows only the times that are actually available for the kind of session you need — advising, mock interview, personal statement review — and books it in place. Rescheduling and cancelling happen in the same screen, so nothing needs an email chain.',
				'benefits' => array( array( 'Live availability', 'See only times that actually work — no "does Tuesday work?" threads.' ), array( 'Appointment types', 'The right session length and mentor for the job, pre-configured.' ), array( 'Eastern and your local time', 'Book with confidence from anywhere in the world.' ), array( 'Manage in place', 'Reschedule or cancel without writing a single message.' ) ),
				'outcome' => 'You go from "I need help" to a booked, confirmed slot without a single email.',
				'when' => 'When you need a person, not a page.', 'cta' => 'Find a Time', 'cta2' => '',
			),
			'storyforge' => array(
				'name' => 'StoryForge', 'cat' => 'Match Prep', 'hue' => '#ffb340', 'launch' => '#storyforge',
				'sub' => "Turn what you've lived into interview-ready stories.",
				'adminSub' => 'Review submitted stories and coach students through revisions.',
				'one' => 'Raw experience in, memorable interview stories out.',
				'problem' => "I know what I've done, but I struggle to turn experiences into strong stories and answers.",
				'how' => 'StoryForge lets you capture a moment the instant you remember it, then shapes it into beats an interviewer can follow — situation, what you did, what changed, what you learned. The Question Workshop matches your stories to the questions you will actually be asked. Stories stay private until you decide to submit them to your mentor.',
				'benefits' => array( array( 'Quick capture', 'Save a moment in ten seconds before it disappears.' ), array( 'Story shaping', 'Structure raw experience into beats that land under pressure.' ), array( 'Question workshop', 'Know which story answers which question — before the interview.' ), array( 'Mentor review, on your terms', "Submit when it's ready; private until then." ) ),
				'outcome' => 'You walk into interviews with a library of stories you can tell calmly and specifically.',
				'when' => 'Right after something happens — and the week before an interview.', 'cta' => 'Open StoryForge', 'cta2' => '',
			),
			'ivprep'     => array(
				'name' => 'IV Prep On-Call', 'cat' => 'Match Prep', 'hue' => '#8a7dff', 'launch' => '#ivprep',
				'sub' => "Realistic residency interview practice, whenever you're ready.",
				'adminSub' => 'Review practice sessions and recordings; coach delivery, not just content.',
				'one' => 'Repeatable interview practice so the real one feels familiar.',
				'problem' => 'I need realistic interview practice so I can answer confidently under pressure.',
				'how' => 'IV Prep On-Call runs timed practice sessions with residency-style questions — behavioral, clinical, program-fit — and records them so you can review delivery, not just content. Practice as often as you like; bring the recordings to a mentor when you want expert feedback.',
				'benefits' => array( array( 'Timed practice sessions', 'Composure comes from repetition; get the reps in on your schedule.' ), array( 'Question bank by type', 'Behavioral, clinical reasoning, "why this program" — all covered.' ), array( 'Delivery review', "Watch pacing and clarity, the things you can't hear while answering." ), array( 'Recordings for mentors', 'Turn a practice run into a coaching session.' ) ),
				'outcome' => 'You answer hard questions calmly — because you have already answered them.',
				'when' => 'The weeks before interviews, and the night before.', 'cta' => 'Start Interview Practice', 'cta2' => 'Book a mock interview',
			),
			'rise'       => array(
				'name' => 'RISE', 'cat' => 'Match Prep', 'hue' => '#5a8dff', 'launch' => '#rise',
				'sub' => 'Research residency programs and build a target list you can defend.',
				'adminSub' => 'Program registry and student target lists at a glance.',
				'one' => 'Residency Intelligence: research, compare, and strategize programs in one place.',
				'problem' => 'There are too many programs and too much scattered information.',
				'how' => 'RISE puts program profiles in one place instead of forty browser tabs, lets you filter on what matters to your situation, and compares programs side by side. As you learn, your target list updates with you — so applying becomes a strategy, not a spreadsheet.',
				'benefits' => array( array( 'Program profiles in one place', 'One search instead of forty tabs and a spreadsheet.' ), array( 'Filters that fit your situation', 'Narrow the landscape to programs that fit you.' ), array( 'Side-by-side comparison', 'Decide with evidence, not vibes.' ), array( 'A living target list', 'Refine as you learn; the list grows with your strategy.' ) ),
				'outcome' => 'You apply to a list you understand and can defend to a mentor — or to yourself.',
				'when' => 'Application season, from first look to final list.', 'cta' => 'Research Programs', 'cta2' => '',
			),
			'ranklist'   => array(
				'name' => 'RankList IQ', 'cat' => 'Match Prep', 'hue' => '#ffd76a', 'launch' => '#ranklist',
				'sub' => 'Rank your programs with clarity and a defensible order.',
				'adminSub' => 'See how students are weighing priorities before rank lists lock.',
				'one' => 'Turn competing priorities into a rank order that explains itself.',
				'problem' => 'I have interviews and competing priorities, but I need clarity on how to rank programs.',
				'how' => 'RankList IQ asks you to decide what matters before you decide where, scores each program on the same criteria, and produces an order you can inspect — why #3 is #3. Revisit after every interview; the order updates as your view does.',
				'benefits' => array( array( 'Weighted priorities', "Decide what matters first, so the ranking is yours, not your mood's." ), array( 'Consistent program scoring', 'Compare every interview on the same terms.' ), array( 'An order that explains itself', 'See exactly why a program sits where it does.' ), array( 'Revisit as interviews finish', 'Update one score; the list re-ranks.' ) ),
				'outcome' => 'You submit a rank list you trust — and can explain.',
				'when' => 'After each interview, and before the list certifies.', 'cta' => 'Build My Rank List', 'cta2' => '',
			),
			'lor'        => array(
				'name' => 'LOR Builder', 'cat' => 'Match Prep', 'hue' => '#ff7a9d', 'launch' => '#lor',
				'sub' => 'Give recommenders exactly what they need to write a strong letter.',
				'adminSub' => 'Track letter requests and help students prepare recommender packets.',
				'one' => 'Organized evidence in, specific and strong letters out.',
				'problem' => "I need a strong letter but don't know what to give my recommender or how to make it easy for them.",
				'how' => 'LOR Builder walks you through the specifics recommenders forget to ask for — cases, moments, outcomes — and assembles them into a brief a busy physician can write from. You track who has what and by when, so you stop chasing.',
				'benefits' => array( array( 'Evidence packet', 'Your accomplishments organized for the person writing about them.' ), array( 'Guided prompts', 'Surface the specific moments that make a letter believable.' ), array( 'Recommender-ready brief', 'Less work for them; a better letter for you.' ), array( 'Request tracking', 'Know who has what, and when it is due.' ) ),
				'outcome' => 'Your recommenders write specific letters faster — and you stop sending reminder emails.',
				'when' => 'The moment you know who you will ask.', 'cta' => 'Prepare My LOR', 'cta2' => '',
			),
		);
	}

	/* ------------------------------------------------------------------ */
	/* Sanitizers                                                         */
	/* ------------------------------------------------------------------ */

	/** Normalize an experience name. */
	public static function sanitize_experience( $value ) {
		$value = strtolower( sanitize_key( (string) $value ) );
		return in_array( $value, array( 'classic', 'matrix2' ), true ) ? $value : '';
	}

	/** Sanitize the administrator default and fail closed to Classic. */
	public static function sanitize_default( $value ) {
		$value = self::sanitize_experience( $value );
		return $value ? $value : 'classic';
	}

	/** Normalize Settings API checkbox values. */
	public static function sanitize_boolean( $value ) {
		return empty( $value ) ? 0 : 1;
	}

	/** Validate an experience name for REST argument handling. */
	public static function validate_experience( $value ) {
		return '' !== self::sanitize_experience( $value );
	}

	/** Validate a featured-app id for REST argument handling. */
	public static function validate_app_id( $value ) {
		return in_array( sanitize_key( (string) $value ), self::APP_IDS, true );
	}
}
