<?php
/**
 * Gated Daily Drills live Webex SDK V3 route.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-mmed-live-drills-state-contract.php';

/**
 * Registers an isolated SDK V3 route for WEBEX-081.
 */
class MMED_Live_Drills_SDK_V3 {

	/**
	 * Feature flag name.
	 */
	const FLAG_NAME = 'webex_live_drills_shell_preview';

	/**
	 * Feature flag for the two-team Team Challenge prototype.
	 */
	const TEAM_CHALLENGE_FLAG_NAME = 'live_drills_team_challenge';

	/**
	 * Public path for the gated preview.
	 */
	const ROUTE_PATH = 'daily-drills-live-webex-v3';

	/**
	 * Static preview asset path relative to the plugin root.
	 */
	const ASSET_PATH = 'assets/daily-drills-live-webex-v3.html';

	/**
	 * Webex widget adapter bundle path relative to the plugin root.
	 */
	const WIDGET_SCRIPT_PATH = 'assets/mmed-webex-widget-adapter.js';

	/**
	 * Webex widget CSS path relative to the plugin root.
	 */
	const WIDGET_CSS_PATH = 'assets/webex-widgets.css';

	/**
	 * Preview embed controller path relative to the plugin root.
	 */
	const EMBED_SCRIPT_PATH = 'assets/daily-drills-live-webex-v3-embed.js';

	/**
	 * Team Challenge prototype controller path relative to the plugin root.
	 */
	const TEAM_CHALLENGE_SCRIPT_PATH = 'assets/daily-drills-team-challenge-v3-studentflow.js';

	/**
	 * Dedicated background state reader.
	 */
	const TEAM_CHALLENGE_WORKER_PATH = 'assets/daily-drills-team-challenge-v3-worker.js';

	/**
	 * Isolated SDK V3 experiment controller path relative to the plugin root.
	 */
	const SDK_V3_SCRIPT_PATH = 'assets/daily-drills-live-webex-sdk-v3.js';

	/**
	 * Matrix launcher shim for Dr J Live Drills.
	 */
	const MATRIX_ENTRY_SCRIPT_PATH = 'assets/daily-drills-matrix-entry.js';

	/**
	 * Option key storing the admin-only test meeting metadata.
	 */
	const MEETING_OPTION = 'mmed_live_drills_v3_test_meeting';

	/**
	 * Option key storing admin-created Team Challenge Webex sessions.
	 */
	const TEAM_CHALLENGE_SESSIONS_OPTION = 'mmed_live_drills_v3_team_challenge_sessions';

	/**
	 * Option key storing explicit beta user IDs for student access.
	 */
	const BETA_USER_IDS_OPTION = 'mmed_live_drills_preview_beta_user_ids';

	/**
	 * Shared Team Challenge state option.
	 */
	const TEAM_CHALLENGE_STATE_OPTION = 'mmed_live_drills_v3_team_challenge_state';

	/**
	 * Public JSON snapshot for fast student polling.
	 */
	const TEAM_CHALLENGE_SNAPSHOT_RELATIVE_PATH = 'missionmed-live-drills-v3/team-challenge-state.json';

	/**
	 * Last persistence error for the sole mutation gateway.
	 *
	 * @var string
	 */
	private static $team_challenge_persist_error = '';

	/**
	 * Optional admin toggle for demo placeholders. Production beta defaults to real roster only.
	 */
	const TEAM_CHALLENGE_PLACEHOLDERS_OPTION = 'mmed_live_drills_team_challenge_placeholders_enabled';

	/**
	 * Maximum number of safe gameplay history events persisted with the session.
	 */
	const TEAM_CHALLENGE_HISTORY_LIMIT = 50;

	/**
	 * Default timezone for preview/test meeting scheduling.
	 */
	const DEFAULT_TIMEZONE = 'America/New_York';

	/**
	 * Test-only meeting title.
	 */
	const TEST_MEETING_TITLE = 'WEBEX-TEST-DO-NOT-USE Daily Drills Student Beta Gate Proof';

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'login_init', array( __CLASS__, 'maybe_redirect_v3_login' ), 0 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_render_preview' ), 0 );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
	}

	/**
	 * Release any upstream PHP session lock before V3 does longer work.
	 *
	 * @return void
	 */
	private static function release_php_session_lock() {
		if ( function_exists( 'session_status' ) && PHP_SESSION_ACTIVE === session_status() ) {
			session_write_close();
		}
	}

	/**
	 * Reject the retired route-class transport.
	 *
	 * The standalone action endpoint is the only state transport and the only
	 * mutation gateway. Keeping this explicit rejection prevents stale clients
	 * from silently reintroducing a second writer.
	 *
	 * @return void
	 */
	public static function maybe_handle_fast_team_challenge_state() {
		self::send_team_challenge_fast_json(
			array(
				'code'    => 'mmed_team_challenge_transport_retired',
				'message' => 'Refresh the room to use the current live connection.',
			),
			410
		);
	}

	/**
	 * Emit a no-cache JSON response for the V3 fast state endpoint.
	 *
	 * @param array|mixed $data Response data.
	 * @param int         $status HTTP status.
	 * @return void
	 */
	private static function send_team_challenge_fast_json( $data, $status = 200 ) {
		status_header( $status );
		nocache_headers();
		header( 'Content-Type: application/json; charset=' . get_option( 'blog_charset' ) );
		echo wp_json_encode( $data );
		exit;
	}

	/**
	 * Keep stale V3 sign-in links out of the default WordPress login screen.
	 *
	 * @return void
	 */
	public static function maybe_redirect_v3_login() {
		$redirect_to = isset( $_GET['redirect_to'] ) ? wp_unslash( $_GET['redirect_to'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$redirect_to = is_string( $redirect_to ) ? rawurldecode( $redirect_to ) : '';

		if ( '' === $redirect_to || false === strpos( $redirect_to, '/' . self::ROUTE_PATH . '/' ) ) {
			return;
		}

		$action = isset( $_GET['action'] ) ? sanitize_key( wp_unslash( $_GET['action'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( 'logout' === $action ) {
			return;
		}

		$account_url = add_query_arg(
			'redirect_to',
			rawurlencode( home_url( '/' . self::ROUTE_PATH . '/' ) ),
			home_url( '/my-account/' )
		);

		wp_safe_redirect( $account_url, 302 );
		exit;
	}

	/**
	 * Add a Matrix dashboard/sidebar entry point without editing locked Matrix runtime assets.
	 *
	 * @return void
	 */
	public static function maybe_enqueue_matrix_entry_point() {
		if ( ! self::should_enqueue_matrix_entry_point() ) {
			return;
		}

		$script_path = MMED_HUB_PATH . self::MATRIX_ENTRY_SCRIPT_PATH;
		if ( ! file_exists( $script_path ) ) {
			self::log_team_challenge_event(
				'matrix_entry_asset_missing',
				array(
					'asset' => self::MATRIX_ENTRY_SCRIPT_PATH,
				)
			);
			return;
		}

		wp_enqueue_script(
			'mmed-live-drills-matrix-entry',
			self::asset_url( self::MATRIX_ENTRY_SCRIPT_PATH ),
			array(),
			(string) filemtime( $script_path ),
			true
		);

		wp_localize_script(
			'mmed-live-drills-matrix-entry',
			'MMEDLiveDrillsMatrixEntry',
			array(
				'targetUrl'   => esc_url_raw( home_url( '/' . self::ROUTE_PATH . '/' ) ),
				'isAdmin'     => current_user_can( 'manage_options' ),
				'label'       => 'Dr J Live Drills',
				'adminCta'    => 'Open Control Room',
				'studentCta'  => 'Open Live Drills',
				'description' => 'Join the live Team Challenge room in the Daily Drills shell.',
			)
		);
	}

	/**
	 * Register admin-only preview utilities.
	 *
	 * @return void
	 */
	public static function register_rest_routes() {
			register_rest_route(
				'mmed/v1',
				'/admin/live-drills-v3/test-meeting',
				array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'create_test_meeting' ),
				'permission_callback' => function () {
					return current_user_can( 'manage_options' );
				},
				)
			);

			register_rest_route(
				'mmed/v1',
				'/live-drills-v3/team-challenge',
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_team_challenge_state' ),
					'permission_callback' => '__return_true',
				)
			);
			}

	/**
	 * Register an admin helper page under MissionMed Hub.
	 *
	 * @return void
	 */
	public static function register_admin_menu() {
		add_submenu_page(
			'missionmed-hub',
			'Live Drills Webex Preview',
			'Live Drills Preview',
			'manage_options',
			'mmed-live-drills-sdk-v3',
			array( __CLASS__, 'render_admin_page' )
		);
	}

	/**
	 * Render an admin-only helper page.
	 *
	 * @return void
	 */
	public static function render_admin_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$flag_enabled = self::is_preview_enabled();
		$preview_url  = home_url( '/' . self::ROUTE_PATH . '/' );
		$meeting      = self::get_preview_meeting();
		?>
		<div class="wrap">
			<h1>Live Drills Webex Preview</h1>
			<p>This route is a gated Daily Drills live-class preview. It does not replace <code>/drills</code>, <code>/daily-drills-v3</code>, or <code>/daily</code>.</p>
			<table class="widefat striped" style="max-width: 760px;">
				<tbody>
					<tr>
						<th scope="row">Route</th>
						<td><code><?php echo esc_html( $preview_url ); ?></code></td>
					</tr>
					<tr>
						<th scope="row">Feature flag</th>
						<td><code><?php echo esc_html( self::FLAG_NAME ); ?></code> is <strong><?php echo $flag_enabled ? 'ON' : 'OFF'; ?></strong></td>
					</tr>
					<tr>
						<th scope="row">Access</th>
						<td>Requires the feature flag and either <code>manage_options</code>, or explicit beta allowlist membership with enrolled-tier access. Anonymous and non-authorized users fail closed.</td>
					</tr>
					<tr>
						<th scope="row">Beta allowlist</th>
						<td><?php echo esc_html( self::format_id_list( self::get_beta_user_ids() ) ); ?></td>
					</tr>
					<tr>
						<th scope="row">Webex mode</th>
						<td>Embedded Webex preview with Open in Webex fallback. Host key is not a student workflow.</td>
					</tr>
					<tr>
						<th scope="row">Test meeting</th>
						<td>
							<?php if ( ! empty( $meeting['join_url'] ) ) : ?>
								<a href="<?php echo esc_url( $meeting['join_url'] ); ?>" target="_blank" rel="noopener noreferrer"><?php echo esc_html( $meeting['title'] ?? self::TEST_MEETING_TITLE ); ?></a>
								<br>
								<small><?php echo esc_html( trim( (string) ( $meeting['start'] ?? '' ) . ' to ' . ( $meeting['end'] ?? '' ) ) ); ?></small>
							<?php else : ?>
								No test meeting is wired yet.
							<?php endif; ?>
						</td>
					</tr>
				</tbody>
			</table>
			<p>
				<a class="button button-primary<?php echo $flag_enabled ? '' : ' disabled'; ?>" href="<?php echo esc_url( $preview_url ); ?>" target="_blank" rel="noopener noreferrer">Open Preview Route</a>
			</p>
		</div>
		<?php
	}

	/**
	 * Render the gated front-end preview route when requested.
	 *
	 * @return void
	 */
	public static function maybe_render_preview() {
		$request_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';
		$request_path = trim( (string) $request_path, '/' );

		if ( self::ROUTE_PATH !== $request_path ) {
			return;
		}

		self::release_php_session_lock();

		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow', true );
		header( 'X-MissionMed-Preview: WEBEX-081-V3', true );

		if ( ! self::is_preview_enabled() ) {
			self::log_team_challenge_event(
				'access_denied',
				array(
					'reason' => 'preview_flag_off',
					'path'   => self::ROUTE_PATH,
				)
			);
			self::render_gate_response( 404, 'Preview route is disabled.' );
		}

		if ( ! self::current_user_can_access_preview() ) {
			self::log_team_challenge_event(
				'access_denied',
				array(
					'reason'    => is_user_logged_in() ? 'unauthorized_user' : 'anonymous',
					'path'      => self::ROUTE_PATH,
					'user_id'   => get_current_user_id(),
					'is_beta'   => is_user_logged_in() ? self::is_beta_user_allowed( get_current_user_id() ) : false,
					'enrolled'  => is_user_logged_in() ? self::user_has_enrolled_tier( get_current_user_id() ) : false,
				)
			);
			self::render_gate_response( 403, 'Preview route is unavailable.' );
		}

		$asset_path = MMED_HUB_PATH . self::ASSET_PATH;
		if ( ! file_exists( $asset_path ) ) {
			self::log_team_challenge_event( 'preview_asset_missing', array( 'asset' => self::ASSET_PATH ) );
			self::render_gate_response( 500, 'Preview asset is unavailable.' );
		}

		$html = file_get_contents( $asset_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( false === $html ) {
			self::log_team_challenge_event( 'preview_asset_read_failed', array( 'asset' => self::ASSET_PATH ) );
			self::render_gate_response( 500, 'Preview asset could not be read.' );
		}

			$html = self::inject_preview_meeting( $html );
			$html = self::inject_embedded_assets( $html );
			$html = self::inject_team_challenge_assets( $html );
			$html = self::inject_sdk_v3_assets( $html );

			status_header( 200 );
		header( 'Content-Type: text/html; charset=utf-8', true );
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Static bundled preview HTML, admin gated.
		exit;
	}

	/**
	 * Create one test-only Webex meeting and store its safe join URL for the preview.
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_test_meeting() {
		if ( ! self::is_preview_enabled() ) {
			return new WP_Error( 'mmed_preview_disabled', 'Preview flag is disabled.', array( 'status' => 403 ) );
		}

		if ( ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'create_meeting' ) ) {
			return new WP_Error( 'mmed_webex_unavailable', 'Webex client is unavailable.', array( 'status' => 500 ) );
		}

		$timezone = self::get_default_timezone();
		$start    = new DateTimeImmutable( '+10 minutes', $timezone );
		$end      = $start->modify( '+60 minutes' );

		$meeting = MMED_Webex_Client::create_meeting(
			array(
				'title'    => self::TEST_MEETING_TITLE,
				'start'    => $start->format( DATE_ATOM ),
				'end'      => $end->format( DATE_ATOM ),
				'timezone' => self::DEFAULT_TIMEZONE,
			)
		);

		if ( is_wp_error( $meeting ) ) {
			return $meeting;
		}

		if ( empty( $meeting['webLink'] ) ) {
			return new WP_Error( 'mmed_webex_no_join_url', 'Webex did not return a meeting link.', array( 'status' => 502 ) );
		}

		$safe_meeting = array(
			'id'        => sanitize_text_field( $meeting['id'] ?? '' ),
			'title'     => self::TEST_MEETING_TITLE,
			'join_url'  => esc_url_raw( $meeting['webLink'] ),
			'sip_address' => sanitize_text_field( $meeting['sipAddress'] ?? '' ),
			'start'     => $start->format( DATE_ATOM ),
			'end'       => $end->format( DATE_ATOM ),
			'timezone'  => self::DEFAULT_TIMEZONE,
			'createdAt' => current_time( 'mysql' ),
		);

		update_option( self::MEETING_OPTION, $safe_meeting, false );

		return new WP_REST_Response( $safe_meeting, 201 );
	}

	/**
	 * Return the shared Team Challenge state for gated preview users.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_team_challenge_state() {
		if ( ! self::is_team_challenge_enabled() ) {
			return new WP_Error( 'mmed_team_challenge_disabled', 'Team Challenge is disabled.', array( 'status' => 403 ) );
		}

		nocache_headers();
		$state  = self::get_team_challenge_state_data();
		$viewer = self::current_team_challenge_viewer( $state );
		$data   = MMED_Live_Drills_State_Contract::viewer_view( $state, $viewer );
		$data['nowMs'] = MMED_Live_Drills_State_Contract::now_ms();
		$response = new WP_REST_Response( $data, 200 );
		$response->header( 'Cache-Control', empty( $viewer ) ? 'no-store, max-age=0' : 'no-store, private, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		return $response;
	}

	/**
	 * Update Team Challenge state from admin controls.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @param array           $verified_viewer Viewer verified by the sole gateway.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_team_challenge_state( $request, $verified_viewer = array() ) {
		if ( ! self::is_team_challenge_enabled() ) {
			return new WP_Error( 'mmed_team_challenge_disabled', 'Team Challenge is disabled.', array( 'status' => 403 ) );
		}

		self::$team_challenge_persist_error = '';
		nocache_headers();
		$state      = self::get_team_challenge_state_data();
		$verified_viewer = is_array( $verified_viewer ) ? $verified_viewer : array();
		$action     = sanitize_key( $request->get_param( 'action' ) );
		$team_id    = sanitize_key( $request->get_param( 'teamId' ) );
		$student_id = sanitize_key( $request->get_param( 'studentId' ) );

			$admin_only_actions = array(
				'reset',
				'shuffle_teams',
				'auto_assign',
				'move_student',
					'assign_student',
					'select_student',
					'score',
						'undo_score',
						'auto_select_next',
						'set_session_title',
						'set_host_note',
						'set_countdown',
						'set_meeting_link',
				'use_active_meeting',
				'schedule_session',
					'select_session',
					'declare_winner',
					'session_lifecycle',
				);

			if ( in_array( $action, $admin_only_actions, true ) && ! current_user_can( 'manage_options' ) ) {
				self::log_team_challenge_event(
					'access_denied',
					array(
						'reason'  => 'student_control_attempt',
						'action'  => $action,
						'user_id' => get_current_user_id(),
					)
				);
				return new WP_Error( 'mmed_team_challenge_admin_required', 'Only the host/admin can control Team Challenge scoring.', array( 'status' => 403 ) );
			}

			if ( 'session_lifecycle' === $action ) {
				$command = sanitize_key( $request->get_param( 'command' ) );
				$state = self::transition_team_challenge_lifecycle( $state, $command );
				if ( is_wp_error( $state ) ) {
					return $state;
				}
				self::persist_team_challenge_state( $state, 'session_lifecycle' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( in_array( $action, array( 'join_in', 'guest_join', 'watch', 'guest_watch' ), true ) && ! self::team_challenge_entry_is_open( $state ) ) {
				return new WP_Error(
					'mmed_team_challenge_room_closed',
					'This room is not accepting entries yet. Keep the page open until the host opens the doors.',
					array( 'status' => 409 )
				);
			}

				if ( 'join_in' === $action ) {
					$user = wp_get_current_user();
					if ( ! $user || empty( $user->ID ) ) {
						return new WP_Error( 'mmed_team_challenge_login_required', 'Choose guest entry or sign in, then try Play again.', array( 'status' => 401 ) );
					}

				$state = self::team_challenge_join_current_user( $state, $user );
				$state = self::remove_team_challenge_spectator( $state, 'u' . absint( $user->ID ) );
					self::persist_team_challenge_state( $state, 'join_in' );
					return new WP_REST_Response( $state, 200 );
				}

				if ( 'create_account_join' === $action ) {
					return self::create_team_challenge_account_and_join( $request, $state );
				}

			if ( 'guest_join' === $action ) {
				$guest_id = self::normalize_team_challenge_guest_id( $request->get_param( 'guestId' ) );
				$name = self::team_challenge_guest_name_from_request( $request );

				if ( '' === $guest_id || is_wp_error( $name ) ) {
					return is_wp_error( $name ) ? $name : new WP_Error( 'mmed_team_challenge_guest_id_required', 'Refresh the page and enter your name again.', array( 'status' => 400 ) );
				}

				$state = self::team_challenge_join_guest( $state, $guest_id, $name );
				$state = self::remove_team_challenge_spectator( $state, $guest_id );
				self::persist_team_challenge_state( $state, 'guest_join' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'watch' === $action ) {
				$user = wp_get_current_user();
				if ( ! $user || empty( $user->ID ) ) {
					return new WP_Error( 'mmed_team_challenge_login_required', 'Choose guest entry or sign in, then try Watch again.', array( 'status' => 401 ) );
				}
				$state = self::team_challenge_remove_current_user( $state, $user );
				$state = self::add_team_challenge_spectator( $state, 'u' . absint( $user->ID ), sanitize_text_field( $user->display_name ), false );
				self::persist_team_challenge_state( $state, 'watch' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'guest_watch' === $action ) {
				$guest_id = self::normalize_team_challenge_guest_id( $request->get_param( 'guestId' ) );
				$name = self::team_challenge_guest_name_from_request( $request );
				if ( '' === $guest_id || is_wp_error( $name ) ) {
					return is_wp_error( $name ) ? $name : new WP_Error( 'mmed_team_challenge_guest_id_required', 'Refresh the page and enter your name again.', array( 'status' => 400 ) );
				}
				$state = self::team_challenge_remove_guest( $state, $guest_id );
				$state = self::add_team_challenge_spectator( $state, $guest_id, $name, true );
				self::persist_team_challenge_state( $state, 'guest_watch' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'opt_out' === $action ) {
				$user = wp_get_current_user();
				if ( ! $user || empty( $user->ID ) ) {
					return new WP_Error( 'mmed_team_challenge_login_required', 'Sign in before updating Team Challenge roster status.', array( 'status' => 401 ) );
				}

				$state = self::team_challenge_remove_current_user( $state, $user );
				$state = self::add_team_challenge_spectator( $state, 'u' . absint( $user->ID ), sanitize_text_field( $user->display_name ), false );
				self::persist_team_challenge_state( $state, 'opt_out' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'guest_opt_out' === $action ) {
				$guest_id = self::normalize_team_challenge_guest_id( $request->get_param( 'guestId' ) );
				if ( ! self::verified_viewer_matches( $verified_viewer, $guest_id ) ) {
					return new WP_Error( 'mmed_team_challenge_guest_session_required', 'Choose Watch again to reconnect to this room.', array( 'status' => 401 ) );
				}

				$state = self::team_challenge_remove_guest( $state, $guest_id );
				$state = self::add_team_challenge_spectator( $state, $guest_id, 'Viewer', true );
				self::persist_team_challenge_state( $state, 'guest_opt_out' );
				return new WP_REST_Response( $state, 200 );
			}

		if ( 'reset' === $action ) {
			$state = self::reset_team_challenge_scores( $state );
			self::persist_team_challenge_state( $state, 'reset' );
			return new WP_REST_Response( $state, 200 );
		}

			if ( 'shuffle_teams' === $action || 'auto_assign' === $action ) {
				$state = self::shuffle_team_challenge_state( $state, 'shuffle_teams' === $action );
				$state['lastEvent'] = array(
					'type'      => 'shuffle_teams' === $action ? 'shuffle_teams' : 'auto_assign',
					'message'   => 'shuffle_teams' === $action ? 'Teams shuffled and ready.' : 'Teams auto-assigned evenly.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );
				self::persist_team_challenge_state( $state, 'shuffle_teams' === $action ? 'shuffle_teams' : 'auto_assign' );
				return new WP_REST_Response( $state, 200 );
		}

		if ( 'move_student' === $action ) {
			$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
			$team_id = sanitize_key( $active['teamId'] ?? '' );
			$student_id = sanitize_key( $active['studentId'] ?? '' );

			if ( ! self::team_challenge_student_exists( $state, $team_id, $student_id ) ) {
				return new WP_Error( 'mmed_team_challenge_no_active_student', 'Choose an active student before moving teams.', array( 'status' => 400 ) );
			}

			$state = self::move_team_challenge_student( $state, $team_id, $student_id );
			self::persist_team_challenge_state( $state, 'move_student' );
			return new WP_REST_Response( $state, 200 );
		}

		if ( 'assign_student' === $action ) {
			$target_team_id = sanitize_key( $request->get_param( 'targetTeamId' ) );

			if ( ! self::team_challenge_student_exists_anywhere( $state, $student_id ) ) {
				return new WP_Error( 'mmed_team_challenge_student_missing', 'Selected student is not available.', array( 'status' => 400 ) );
			}

			if ( ! self::team_challenge_team_exists( $state, $target_team_id ) ) {
				return new WP_Error( 'mmed_team_challenge_team_missing', 'Selected team is not available.', array( 'status' => 400 ) );
			}

			$state = self::assign_team_challenge_student( $state, $student_id, $target_team_id );
			self::persist_team_challenge_state( $state, 'assign_student' );
			return new WP_REST_Response( $state, 200 );
		}

		if ( 'select_student' === $action ) {
			if ( ! self::team_challenge_student_exists( $state, $team_id, $student_id ) ) {
				return new WP_Error( 'mmed_team_challenge_student_missing', 'Selected student is not available.', array( 'status' => 400 ) );
			}

				$state['active'] = array(
					'teamId'    => $team_id,
					'studentId' => $student_id,
				);
				$state['nextTeamId'] = self::get_team_challenge_next_team_id( $team_id );
				$student = self::get_team_challenge_student( $state, $team_id, $student_id );
				$state['lastEvent'] = array(
					'type'      => 'select_student',
					'message'   => ( $student['name'] ?? 'Student' ) . ' is up.',
					'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );
			self::persist_team_challenge_state( $state, 'select_student' );
				return new WP_REST_Response( $state, 200 );
			}

				if ( 'auto_select_next' === $action ) {
					$mode  = sanitize_key( $request->get_param( 'mode' ) );
					$state = self::auto_select_next_team_challenge_student( $state, $mode );
					self::persist_team_challenge_state( $state, 'auto_select_next' );
					return new WP_REST_Response( $state, 200 );
				}

			if ( 'set_session_title' === $action ) {
					$title = sanitize_text_field( wp_unslash( (string) $request->get_param( 'title' ) ) );
					$title = substr( $title, 0, 80 );
				$state['sessionTitle'] = '' !== $title ? $title : 'Live Team Challenge';
				$state['lastEvent'] = array(
					'type'      => 'set_session_title',
					'message'   => 'Session title updated.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );
					self::persist_team_challenge_state( $state, 'set_session_title' );
					return new WP_REST_Response( $state, 200 );
				}

					if ( 'set_host_note' === $action ) {
						$note = sanitize_textarea_field( wp_unslash( (string) $request->get_param( 'note' ) ) );
						$note = substr( $note, 0, 220 );
					$state['hostNote'] = $note;
					$state['lastEvent'] = array(
						'type'      => 'set_host_note',
						'message'   => '' !== $note ? 'Student note updated.' : 'Student note cleared.',
						'updatedAt' => current_time( 'mysql' ),
					);
					$state['updatedAt'] = current_time( 'mysql' );
						self::persist_team_challenge_state( $state, 'set_host_note' );
						return new WP_REST_Response( $state, 200 );
					}

					if ( 'set_countdown' === $action ) {
						$state['countdown'] = self::team_challenge_countdown_from_request(
							$request,
							is_array( $state['countdown'] ?? null ) ? $state['countdown'] : array()
						);
						$state['lastEvent'] = array(
							'type'      => 'set_countdown',
							'message'   => 'Countdown updated.',
							'updatedAt' => current_time( 'mysql' ),
						);
						$state['updatedAt'] = current_time( 'mysql' );
						self::persist_team_challenge_state( $state, 'set_countdown' );
						return new WP_REST_Response( $state, 200 );
					}

				if ( 'set_meeting_link' === $action ) {
				$join_url = esc_url_raw( trim( (string) $request->get_param( 'joinUrl' ) ) );
				if ( ! self::is_safe_webex_join_url( $join_url ) ) {
					return new WP_Error( 'mmed_team_challenge_invalid_meeting_url', 'Paste a valid Webex meeting link.', array( 'status' => 400 ) );
				}

				$title = sanitize_text_field( wp_unslash( (string) $request->get_param( 'title' ) ) );
				$title = substr( $title, 0, 120 );

				$meeting = self::get_preview_meeting();
				if ( ! is_array( $meeting ) ) {
					$meeting = array();
				}

				$meeting['join_url']  = $join_url;
				$meeting['title']     = '' !== $title ? $title : sanitize_text_field( $meeting['title'] ?? 'Live Team Challenge Webex Meeting' );
				$meeting['updatedAt'] = current_time( 'mysql' );

				update_option( self::MEETING_OPTION, $meeting, false );

				$state['meeting'] = self::team_challenge_meeting_for_client_state( $meeting );
				$state['lastEvent'] = array(
					'type'      => 'set_meeting_link',
					'message'   => 'Current Webex meeting confirmed. Roster kept for this live session.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );
				self::persist_team_challenge_state( $state, 'set_meeting_link' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'schedule_session' === $action ) {
				return self::schedule_team_challenge_session( $request, $state );
			}

			if ( 'select_session' === $action ) {
				return self::select_team_challenge_session( $request, $state );
			}

			if ( 'use_active_meeting' === $action ) {
				$meeting = self::find_current_webex_meeting();
				if ( is_wp_error( $meeting ) ) {
					self::log_team_challenge_event(
						'webex_active_meeting_lookup_failed',
						array(
							'code' => $meeting->get_error_code(),
						)
					);
					return $meeting;
				}

				$join_security_result = self::allow_webex_attendee_join_if_possible( $meeting );
				if ( ! is_wp_error( $join_security_result ) && is_array( $join_security_result ) ) {
					$meeting = $join_security_result;
				}

				update_option( self::MEETING_OPTION, $meeting, false );

				$state['meeting'] = self::team_challenge_meeting_for_client_state( $meeting );
				$state['lastEvent'] = array(
					'type'      => 'use_active_meeting',
					'message'   => 'Live Webex meeting selected: ' . sanitize_text_field( $meeting['title'] ?? 'Current Webex Meeting' ) . '.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );
				self::persist_team_challenge_state( $state, 'use_active_meeting' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'declare_winner' === $action ) {
				if ( 'live' !== self::team_challenge_lifecycle_state( $state ) ) {
					return new WP_Error( 'mmed_team_challenge_not_live', 'Start the room before declaring a winner.', array( 'status' => 409 ) );
				}
				if ( ! self::team_challenge_team_exists( $state, $team_id ) ) {
					return new WP_Error( 'mmed_team_challenge_team_missing', 'Selected team is not available.', array( 'status' => 400 ) );
				}

					$state = self::declare_team_challenge_winner( $state, $team_id );
					$state = self::transition_team_challenge_lifecycle( $state, 'ended' );
					self::persist_team_challenge_state( $state, 'declare_winner' );
					return new WP_REST_Response( $state, 200 );
				}

				if ( 'undo_score' === $action ) {
					$state = self::undo_team_challenge_score( $state );
					self::persist_team_challenge_state( $state, 'undo_score' );
					return new WP_REST_Response( $state, 200 );
				}

			if ( 'score' === $action ) {
				if ( 'live' !== self::team_challenge_lifecycle_state( $state ) ) {
					return new WP_Error( 'mmed_team_challenge_not_live', 'Start the room before scoring.', array( 'status' => 409 ) );
				}
			$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
			$team_id = sanitize_key( $active['teamId'] ?? '' );
			$student_id = sanitize_key( $active['studentId'] ?? '' );

			if ( ! self::team_challenge_student_exists( $state, $team_id, $student_id ) ) {
				return new WP_Error( 'mmed_team_challenge_no_active_student', 'Choose an active student before scoring.', array( 'status' => 400 ) );
			}

			$is_correct = rest_sanitize_boolean( $request->get_param( 'correct' ) );
			$state = self::apply_team_challenge_score( $state, $team_id, $student_id, $is_correct );
			self::persist_team_challenge_state( $state, $is_correct ? 'correct' : 'missed' );
				return new WP_REST_Response( $state, 200 );
			}

			if ( 'send_chat_message' === $action ) {
				$chat_guest_id = self::normalize_team_challenge_guest_id( $request->get_param( 'guestId' ) );
				if ( ! is_user_logged_in() && ! self::verified_viewer_matches( $verified_viewer, $chat_guest_id ) ) {
					return new WP_Error( 'mmed_team_challenge_guest_session_required', 'Choose Play or Watch again before sending a message.', array( 'status' => 401 ) );
				}
				if ( is_user_logged_in() && ! current_user_can( 'manage_options' ) && ! self::team_challenge_viewer_is_present( $state, 'u' . get_current_user_id() ) ) {
					return new WP_Error( 'mmed_team_challenge_entry_required', 'Choose Play or Watch before sending a message.', array( 'status' => 409 ) );
				}
				$message = sanitize_text_field( wp_unslash( (string) $request->get_param( 'message' ) ) );
				$message = substr( $message, 0, 180 );
				if ( '' === trim( $message ) ) {
					return new WP_Error( 'mmed_team_challenge_chat_empty', 'Type a message before sending.', array( 'status' => 400 ) );
				}

				$state = self::add_team_challenge_chat_message(
					$state,
					$message,
					sanitize_text_field( wp_unslash( (string) $request->get_param( 'target' ) ) ),
					$chat_guest_id,
					sanitize_text_field( wp_unslash( (string) $request->get_param( 'firstName' ) ) ),
					sanitize_text_field( wp_unslash( (string) $request->get_param( 'lastName' ) ) )
				);
				self::persist_team_challenge_state( $state, 'send_chat_message' );
				return new WP_REST_Response( $state, 200 );
			}

			return new WP_Error( 'mmed_team_challenge_action_invalid', 'Unsupported Team Challenge action.', array( 'status' => 400 ) );
		}

	/**
	 * Return the persistence error recorded during the current mutation.
	 *
	 * @return string
	 */
	public static function team_challenge_last_persist_error() {
		return self::$team_challenge_persist_error;
	}

	/**
	 * Return the current signed-in viewer role.
	 *
	 * @return array
	 */
	private static function current_team_challenge_viewer( $state = array() ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return array();
		}
		if ( ! current_user_can( 'manage_options' ) && ! self::team_challenge_viewer_is_present( $state, 'u' . absint( $user_id ) ) ) {
			return array();
		}

		return array(
			'id'   => 'u' . absint( $user_id ),
			'role' => current_user_can( 'manage_options' ) ? 'host' : 'participant',
		);
	}

	/**
	 * Return the signing secret shared with the direct state reader.
	 *
	 * @return string
	 */
	private static function team_challenge_viewer_secret() {
		$auth_key = defined( 'AUTH_KEY' ) ? (string) AUTH_KEY : '';
		$auth_salt = defined( 'AUTH_SALT' ) ? (string) AUTH_SALT : '';

		return hash( 'sha256', 'mmed-live-drills-viewer|' . $auth_key . '|' . $auth_salt );
	}

	/**
	 * Issue a viewer ticket for the current signed-in user.
	 *
	 * @param array $state Current state.
	 * @return string
	 */
	private static function current_team_challenge_viewer_ticket( $state ) {
		$viewer = self::current_team_challenge_viewer( $state );
		if ( empty( $viewer ) ) {
			return '';
		}
		$state = MMED_Live_Drills_State_Contract::normalize_state( $state );

		return MMED_Live_Drills_State_Contract::issue_viewer_ticket(
			self::team_challenge_viewer_secret(),
			$viewer['id'],
			$viewer['role'],
			$state['sessionId']
		);
	}

	/**
	 * Return whether an identity is on the active roster or spectator list.
	 *
	 * @param array  $state Current state.
	 * @param string $viewer_id Internal viewer ID.
	 * @return bool
	 */
	private static function team_challenge_viewer_is_present( $state, $viewer_id ) {
		$viewer_id = sanitize_key( $viewer_id );
		foreach ( (array) ( $state['teams'] ?? array() ) as $team ) {
			foreach ( (array) ( $team['students'] ?? array() ) as $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) === $viewer_id ) {
					return true;
				}
			}
		}
		foreach ( (array) ( $state['spectators'] ?? array() ) as $spectator ) {
			if ( is_array( $spectator ) && sanitize_key( $spectator['id'] ?? '' ) === $viewer_id ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Return the normalized lifecycle state.
	 *
	 * @param array $state Current state.
	 * @return string
	 */
	private static function team_challenge_lifecycle_state( $state ) {
		$state = MMED_Live_Drills_State_Contract::normalize_state( $state );

		return sanitize_key( $state['lifecycle']['state'] ?? 'idle' );
	}

	/**
	 * Return whether participant entry is currently accepted.
	 *
	 * @param array $state Current state.
	 * @return bool
	 */
	private static function team_challenge_entry_is_open( $state ) {
		return in_array( self::team_challenge_lifecycle_state( $state ), array( 'doors_open', 'live' ), true );
	}

	/**
	 * Apply a guarded lifecycle transition.
	 *
	 * @param array  $state Current state.
	 * @param string $command Transition command.
	 * @return array|WP_Error
	 */
	private static function transition_team_challenge_lifecycle( $state, $command ) {
		$state = MMED_Live_Drills_State_Contract::normalize_state( $state );
		$command = sanitize_key( $command );
		$current = self::team_challenge_lifecycle_state( $state );
		$now = current_time( 'mysql' );

		if ( 'new' === $command ) {
			$teams = array();
			foreach ( (array) ( $state['teams'] ?? array() ) as $team ) {
				$teams[] = array(
					'id'       => sanitize_key( $team['id'] ?? '' ),
					'name'     => sanitize_text_field( $team['name'] ?? ( $team['label'] ?? 'Team' ) ),
					'label'    => sanitize_text_field( $team['label'] ?? ( $team['name'] ?? 'Team' ) ),
					'color'    => sanitize_hex_color( $team['color'] ?? '' ) ?: '',
					'score'    => 0,
					'students' => array(),
				);
			}
			if ( 2 > count( $teams ) ) {
				$teams = self::build_team_challenge_teams();
				foreach ( $teams as $index => $team ) {
					$teams[ $index ]['students'] = array();
					$teams[ $index ]['score'] = 0;
				}
			}
			$state['sessionId'] = 'session-' . gmdate( 'YmdHis' ) . '-' . strtolower( wp_generate_password( 8, false, false ) );
			$state['teams'] = $teams;
			$state['active'] = array( 'teamId' => '', 'studentId' => '' );
			$state['nextTeamId'] = 'blue';
			$state['lastScore'] = null;
			$state['winner'] = null;
			$state['hostNote'] = '';
			$state['chatMessages'] = array();
			$state['history'] = array();
			$state['scoreLedger'] = array();
			$state['spectators'] = array();
			$state['spectatorCount'] = 0;
			$state['countdown'] = self::sanitize_team_challenge_countdown( array() );
			$state['lifecycle'] = array(
				'state'      => 'idle',
				'changedAt'  => $now,
				'startedAt'  => '',
				'endedAt'    => '',
				'archivedAt' => '',
			);
		} else {
			$transitions = array(
				'idle'       => array( 'idle', 'doors_open', 'archived' ),
				'doors_open' => array( 'idle', 'live', 'ended' ),
				'live'       => array( 'ended' ),
				'ended'      => array( 'archived' ),
				'archived'   => array(),
			);
			if ( ! isset( $transitions[ $current ] ) || ! in_array( $command, $transitions[ $current ], true ) ) {
				$next = in_array( $current, array( 'ended', 'archived' ), true ) ? 'Create a new session before reopening the doors.' : 'Use the next room step shown in the host controls.';
				return new WP_Error( 'mmed_team_challenge_lifecycle_invalid', 'That room change is not available. ' . $next, array( 'status' => 409 ) );
			}
			$state['lifecycle']['state'] = $command;
			$state['lifecycle']['changedAt'] = $now;
			if ( 'live' === $command ) {
				$state['lifecycle']['startedAt'] = $now;
				$state['lifecycle']['endedAt'] = '';
			}
			if ( 'ended' === $command ) {
				$state['lifecycle']['endedAt'] = $now;
				$state['countdown'] = self::sanitize_team_challenge_countdown( array() );
			}
			if ( 'archived' === $command ) {
				$state['lifecycle']['archivedAt'] = $now;
			}
			if ( 'idle' === $command ) {
				$state['countdown'] = self::sanitize_team_challenge_countdown( array() );
			}
		}

		$state['lastEvent'] = array(
			'type'      => 'session_lifecycle',
			'message'   => 'Room status changed to ' . str_replace( '_', ' ', $state['lifecycle']['state'] ) . '.',
			'updatedAt' => $now,
		);
		$state['updatedAt'] = $now;

		return $state;
	}

	/**
	 * Return a normalized name from guest entry.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return string|WP_Error
	 */
	private static function team_challenge_guest_name_from_request( $request ) {
		$name = sanitize_text_field( wp_unslash( (string) $request->get_param( 'displayName' ) ) );
		if ( '' === trim( $name ) ) {
			$name = trim(
				sanitize_text_field( wp_unslash( (string) $request->get_param( 'firstName' ) ) ) . ' ' .
				sanitize_text_field( wp_unslash( (string) $request->get_param( 'lastName' ) ) )
			);
		}
		$name = preg_replace( '/\s+/', ' ', trim( $name ) );
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $name ) : strlen( $name );
		if ( 2 > $length ) {
			return new WP_Error( 'mmed_team_challenge_guest_name_short', 'Enter the name you want the host to see.', array( 'status' => 400 ) );
		}
		if ( 60 < $length ) {
			return new WP_Error( 'mmed_team_challenge_guest_name_long', 'Use a name with 60 characters or fewer.', array( 'status' => 400 ) );
		}

		return $name;
	}

	/**
	 * Normalize a browser guest ID.
	 *
	 * @param mixed $guest_id Guest ID.
	 * @return string
	 */
	private static function normalize_team_challenge_guest_id( $guest_id ) {
		$guest_id = substr( sanitize_key( $guest_id ), 0, 80 );
		if ( '' === $guest_id ) {
			return '';
		}
		if ( 0 !== strpos( $guest_id, 'guest-' ) ) {
			$guest_id = 'guest-' . $guest_id;
		}

		return $guest_id;
	}

	/**
	 * Verify that the gateway-authenticated viewer owns a guest subject.
	 *
	 * @param array  $viewer Verified viewer.
	 * @param string $guest_id Guest ID.
	 * @return bool
	 */
	private static function verified_viewer_matches( $viewer, $guest_id ) {
		return is_array( $viewer ) && 'participant' === sanitize_key( $viewer['role'] ?? '' ) && hash_equals( sanitize_key( $viewer['id'] ?? '' ), sanitize_key( $guest_id ) );
	}

	/**
	 * Add or refresh a spectator row.
	 *
	 * @param array  $state Current state.
	 * @param string $id Viewer ID.
	 * @param string $name Viewer name.
	 * @param bool   $is_guest Guest flag.
	 * @return array
	 */
	private static function add_team_challenge_spectator( $state, $id, $name, $is_guest ) {
		$state = self::remove_team_challenge_spectator( $state, $id );
		$state['spectators'][] = array(
			'id'       => sanitize_key( $id ),
			'name'     => substr( sanitize_text_field( $name ?: 'Viewer' ), 0, 80 ),
			'joinedAt' => current_time( 'mysql' ),
			'isGuest'  => (bool) $is_guest,
		);
		$state['spectators'] = MMED_Live_Drills_State_Contract::normalize_spectators( $state['spectators'] );
		$state['spectatorCount'] = count( $state['spectators'] );

		return $state;
	}

	/**
	 * Remove a spectator row.
	 *
	 * @param array  $state Current state.
	 * @param string $id Viewer ID.
	 * @return array
	 */
	private static function remove_team_challenge_spectator( $state, $id ) {
		$id = sanitize_key( $id );
		$state['spectators'] = array_values(
			array_filter(
				(array) ( $state['spectators'] ?? array() ),
				function ( $spectator ) use ( $id ) {
					return ! is_array( $spectator ) || sanitize_key( $spectator['id'] ?? '' ) !== $id;
				}
			)
		);
		$state['spectatorCount'] = count( $state['spectators'] );

		return $state;
	}

	/**
	 * Return whether the preview flag is enabled.
	 *
	 * @return bool
	 */
	private static function is_preview_enabled() {
		return class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( self::FLAG_NAME );
	}

	/**
	 * Return whether the Team Challenge prototype flag is enabled.
	 *
	 * @return bool
	 */
	private static function is_team_challenge_enabled() {
		return class_exists( 'MMED_Feature_Flags' ) && MMED_Feature_Flags::is_enabled( self::TEAM_CHALLENGE_FLAG_NAME );
	}

	/**
	 * Return stored safe preview meeting metadata.
	 *
	 * @return array
	 */
	private static function get_preview_meeting() {
		$meeting = get_option( self::MEETING_OPTION, array() );

		return is_array( $meeting ) ? $meeting : array();
	}

	/**
	 * Return the admin-created Team Challenge Webex session list.
	 *
	 * @return array
	 */
	private static function get_team_challenge_sessions( $include_webex = true ) {
		$stored = get_option( self::TEAM_CHALLENGE_SESSIONS_OPTION, array() );
		$stored = is_array( $stored ) ? $stored : array();

		$sessions = array();
		foreach ( $stored as $session ) {
			$clean = self::sanitize_team_challenge_session( $session );
			if ( ! empty( $clean ) ) {
				$sessions[ self::team_challenge_session_key( $clean ) ] = $clean;
			}
		}

		if ( $include_webex && current_user_can( 'manage_options' ) ) {
			foreach ( self::get_webex_team_challenge_sessions() as $session ) {
				$clean = self::sanitize_team_challenge_session( $session );
				if ( ! empty( $clean ) ) {
					$sessions[ self::team_challenge_session_key( $clean ) ] = $clean;
				}
			}
		}

		usort(
			$sessions,
			function ( $a, $b ) {
				$now     = time();
				$a_start = self::parse_webex_timestamp( $a['start'] ?? '' );
				$b_start = self::parse_webex_timestamp( $b['start'] ?? '' );
				$a_end   = self::parse_webex_timestamp( $a['end'] ?? '' );
				$b_end   = self::parse_webex_timestamp( $b['end'] ?? '' );

				$a_expired = $a_end && $a_end < $now - 10 * MINUTE_IN_SECONDS;
				$b_expired = $b_end && $b_end < $now - 10 * MINUTE_IN_SECONDS;
				if ( $a_expired !== $b_expired ) {
					return $a_expired ? 1 : -1;
				}

				return $a_start <=> $b_start;
			}
		);

		return array_slice( array_values( $sessions ), 0, 25 );
	}

	/**
	 * Return upcoming Webex meetings from the connected instructor account.
	 *
	 * @return array
	 */
	private static function get_webex_team_challenge_sessions() {
		if ( ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'list_meetings' ) ) {
			return array();
		}

		$now      = time();
		$response = MMED_Webex_Client::list_meetings( gmdate( 'c', $now - 2 * HOUR_IN_SECONDS ), gmdate( 'c', $now + 14 * DAY_IN_SECONDS ) );
		if ( is_wp_error( $response ) ) {
			self::log_team_challenge_event(
				'webex_scheduled_meeting_lookup_failed',
				array(
					'code' => $response->get_error_code(),
				)
			);
			return array();
		}

		$sessions = array();
		$items    = is_array( $response['items'] ?? null ) ? $response['items'] : array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$meeting = self::normalize_webex_meeting_for_preview( $item );
			if ( is_wp_error( $meeting ) ) {
				continue;
			}

			$end_ts = self::parse_webex_timestamp( $meeting['end'] ?? '' );
			if ( $end_ts && $end_ts < $now - 10 * MINUTE_IN_SECONDS ) {
				continue;
			}

			$meeting['source']    = 'webex_scheduled_lookup';
			$meeting['createdAt'] = current_time( 'mysql' );
			$meeting['createdBy'] = 0;

			$session = self::preview_meeting_to_team_challenge_session( $meeting );
			if ( ! empty( $session ) ) {
				$sessions[] = $session;
			}
		}

		return $sessions;
	}

	/**
	 * Return a stable dedupe key for scheduled sessions.
	 *
	 * @param array $session Sanitized session.
	 * @return string
	 */
	private static function team_challenge_session_key( $session ) {
		$meeting_id = sanitize_text_field( $session['meetingId'] ?? '' );
		if ( '' !== $meeting_id ) {
			return 'id:' . $meeting_id;
		}

		return 'url:' . md5( esc_url_raw( $session['joinUrl'] ?? '' ) );
	}

	/**
	 * Persist the sanitized Team Challenge Webex session list.
	 *
	 * @param array $sessions Candidate sessions.
	 * @return array Sanitized persisted sessions.
	 */
	private static function persist_team_challenge_sessions( $sessions ) {
		$clean = array();
		foreach ( (array) $sessions as $session ) {
			$sanitized = self::sanitize_team_challenge_session( $session );
			if ( ! empty( $sanitized ) ) {
				$clean[ $sanitized['sessionId'] ] = $sanitized;
			}
		}

		$clean = array_slice( array_values( $clean ), 0, 25 );
		update_option( self::TEAM_CHALLENGE_SESSIONS_OPTION, $clean, false );

		return $clean;
	}

	/**
	 * Sanitize one stored Team Challenge Webex session.
	 *
	 * @param array $session Candidate session.
	 * @return array
	 */
	private static function sanitize_team_challenge_session( $session ) {
		if ( ! is_array( $session ) ) {
			return array();
		}

		$join_url = esc_url_raw( $session['joinUrl'] ?? $session['join_url'] ?? '' );
		if ( ! self::is_safe_webex_join_url( $join_url ) ) {
			return array();
		}

		$title = sanitize_text_field( $session['title'] ?? 'Live Team Challenge Webex Meeting' );
		$id    = sanitize_key( $session['sessionId'] ?? '' );
		if ( '' === $id ) {
			$id = 'ltc_' . substr( md5( $join_url . '|' . $title ), 0, 12 );
		}

		return array(
			'sessionId'  => $id,
			'meetingId'  => sanitize_text_field( $session['meetingId'] ?? $session['meeting_id'] ?? $session['id'] ?? '' ),
			'title'      => $title,
			'joinUrl'    => $join_url,
			'sipAddress' => sanitize_text_field( $session['sipAddress'] ?? $session['sip_address'] ?? '' ),
			'start'      => sanitize_text_field( $session['start'] ?? '' ),
			'end'        => sanitize_text_field( $session['end'] ?? '' ),
			'timezone'   => sanitize_text_field( $session['timezone'] ?? self::DEFAULT_TIMEZONE ),
			'source'     => sanitize_key( $session['source'] ?? 'scheduled_team_challenge' ),
			'createdAt'  => sanitize_text_field( $session['createdAt'] ?? current_time( 'mysql' ) ),
			'createdBy'  => absint( $session['createdBy'] ?? 0 ),
		);
	}

	/**
	 * Create a future Webex meeting and select it for this Team Challenge room.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @param array           $state   Current state.
	 * @return WP_REST_Response|WP_Error
	 */
	private static function schedule_team_challenge_session( $request, $state ) {
		if ( ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'create_meeting' ) ) {
			return new WP_Error( 'mmed_team_challenge_webex_client_missing', 'Webex meeting creation is unavailable.', array( 'status' => 500 ) );
		}

		$title = sanitize_text_field( wp_unslash( (string) $request->get_param( 'title' ) ) );
		$title = substr( $title, 0, 120 );
		if ( '' === $title ) {
			$title = 'Dr J Live Drills Team Challenge';
		}

		$duration_minutes = absint( $request->get_param( 'durationMinutes' ) );
		if ( $duration_minutes < 15 ) {
			$duration_minutes = 60;
		}
		$duration_minutes = min( $duration_minutes, 240 );

		$timezone = self::get_default_timezone();
		$raw_start = sanitize_text_field( wp_unslash( (string) $request->get_param( 'startLocal' ) ) );
		try {
			if ( '' === $raw_start ) {
				$start = new DateTimeImmutable( '+10 minutes', $timezone );
			} else {
				$start = new DateTimeImmutable( str_replace( 'T', ' ', $raw_start ), $timezone );
			}
		} catch ( Exception $exception ) {
			return new WP_Error( 'mmed_team_challenge_invalid_start_time', 'Choose a valid Eastern Time start.', array( 'status' => 400 ) );
		}

		$end     = $start->modify( '+' . $duration_minutes . ' minutes' );
		$meeting = MMED_Webex_Client::create_meeting(
			array(
				'title'    => $title,
				'start'    => $start->format( DATE_ATOM ),
				'end'      => $end->format( DATE_ATOM ),
				'timezone' => self::DEFAULT_TIMEZONE,
			)
		);

		if ( is_wp_error( $meeting ) ) {
			self::log_team_challenge_event(
				'webex_schedule_session_failed',
				array(
					'code' => $meeting->get_error_code(),
				)
			);
			return $meeting;
		}

		$normalized = self::normalize_webex_meeting_for_preview( $meeting );
		if ( is_wp_error( $normalized ) ) {
			return $normalized;
		}

		$normalized['title']     = $title;
		$normalized['source']    = 'scheduled_team_challenge';
		$normalized['timezone']  = self::DEFAULT_TIMEZONE;
		$normalized['createdAt'] = current_time( 'mysql' );
		$normalized['createdBy'] = get_current_user_id();

		$session = self::preview_meeting_to_team_challenge_session( $normalized );
		$sessions = self::get_team_challenge_sessions( false );
		$sessions[] = $session;
		self::persist_team_challenge_sessions( $sessions );

		update_option( self::MEETING_OPTION, $normalized, false );

		$state['sessionTitle'] = $title;
		$state['meeting'] = self::team_challenge_meeting_for_client_state( $normalized );
		$state['lastEvent'] = array(
			'type'      => 'schedule_session',
			'message'   => 'Scheduled Webex session created and selected. Roster kept for this live session.',
			'updatedAt' => current_time( 'mysql' ),
		);
		$state['updatedAt'] = current_time( 'mysql' );
		self::persist_team_challenge_state( $state, 'schedule_session' );

		return new WP_REST_Response( $state, 201 );
	}

	/**
	 * Select an already-created scheduled Webex meeting for this Team Challenge room.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @param array           $state   Current state.
	 * @return WP_REST_Response|WP_Error
	 */
	private static function select_team_challenge_session( $request, $state ) {
		$session_id = sanitize_key( $request->get_param( 'sessionId' ) );
		if ( '' === $session_id ) {
			return new WP_Error( 'mmed_team_challenge_session_missing', 'Choose a scheduled Webex session.', array( 'status' => 400 ) );
		}

		$selected = null;
		foreach ( self::get_team_challenge_sessions() as $session ) {
			if ( $session_id === sanitize_key( $session['sessionId'] ?? '' ) ) {
				$selected = $session;
				break;
			}
		}

		if ( ! $selected ) {
			return new WP_Error( 'mmed_team_challenge_session_not_found', 'That scheduled Webex session was not found.', array( 'status' => 404 ) );
		}

		$meeting = self::team_challenge_session_to_preview_meeting( $selected );
		$join_security_result = self::allow_webex_attendee_join_if_possible( $meeting );
		if ( ! is_wp_error( $join_security_result ) && is_array( $join_security_result ) ) {
			$meeting = $join_security_result;
		}

		update_option( self::MEETING_OPTION, $meeting, false );

		$state['sessionTitle'] = sanitize_text_field( $selected['title'] ?? 'Live Team Challenge' );
		$state['meeting'] = self::team_challenge_meeting_for_client_state( $meeting );
		$state['lastEvent'] = array(
			'type'      => 'select_session',
			'message'   => 'Scheduled Webex session selected. Roster kept for this live session.',
			'updatedAt' => current_time( 'mysql' ),
		);
		$state['updatedAt'] = current_time( 'mysql' );
		self::persist_team_challenge_state( $state, 'select_session' );

		return new WP_REST_Response( $state, 200 );
	}

	/**
	 * Convert current meeting option shape into a stored scheduled session shape.
	 *
	 * @param array $meeting Preview meeting metadata.
	 * @return array
	 */
	private static function preview_meeting_to_team_challenge_session( $meeting ) {
		$join_url = esc_url_raw( $meeting['join_url'] ?? '' );
		$title    = sanitize_text_field( $meeting['title'] ?? 'Live Team Challenge Webex Meeting' );
		$meeting_id = sanitize_text_field( $meeting['id'] ?? '' );

		return self::sanitize_team_challenge_session(
			array(
				'sessionId'  => 'ltc_' . substr( md5( $meeting_id . '|' . $join_url . '|' . $title ), 0, 12 ),
				'meetingId'  => $meeting_id,
				'title'      => $title,
				'joinUrl'    => $join_url,
				'sipAddress' => sanitize_text_field( $meeting['sip_address'] ?? '' ),
				'start'      => sanitize_text_field( $meeting['start'] ?? '' ),
				'end'        => sanitize_text_field( $meeting['end'] ?? '' ),
				'timezone'   => sanitize_text_field( $meeting['timezone'] ?? self::DEFAULT_TIMEZONE ),
				'source'     => sanitize_key( $meeting['source'] ?? 'scheduled_team_challenge' ),
				'createdAt'  => sanitize_text_field( $meeting['createdAt'] ?? current_time( 'mysql' ) ),
				'createdBy'  => absint( $meeting['createdBy'] ?? get_current_user_id() ),
			)
		);
	}

	/**
	 * Convert stored scheduled session shape into the current meeting option shape.
	 *
	 * @param array $session Stored scheduled session.
	 * @return array
	 */
	private static function team_challenge_session_to_preview_meeting( $session ) {
		return array(
			'id'          => sanitize_text_field( $session['meetingId'] ?? '' ),
			'title'       => sanitize_text_field( $session['title'] ?? 'Live Team Challenge Webex Meeting' ),
			'join_url'    => esc_url_raw( $session['joinUrl'] ?? '' ),
			'sip_address' => sanitize_text_field( $session['sipAddress'] ?? '' ),
			'start'       => sanitize_text_field( $session['start'] ?? '' ),
			'end'         => sanitize_text_field( $session['end'] ?? '' ),
			'timezone'    => sanitize_text_field( $session['timezone'] ?? self::DEFAULT_TIMEZONE ),
			'source'      => sanitize_key( $session['source'] ?? 'scheduled_team_challenge' ),
			'updatedAt'   => current_time( 'mysql' ),
		);
	}

	/**
	 * Return the current meeting shape expected by the live Team Challenge browser state.
	 *
	 * @param array $meeting Preview meeting metadata.
	 * @return array
	 */
	private static function team_challenge_meeting_for_client_state( $meeting ) {
		return array(
			'id'         => sanitize_text_field( $meeting['id'] ?? '' ),
			'title'      => sanitize_text_field( $meeting['title'] ?? 'Live Team Challenge Webex Meeting' ),
			'joinUrl'    => esc_url_raw( $meeting['join_url'] ?? $meeting['joinUrl'] ?? '' ),
			'sipAddress' => sanitize_text_field( $meeting['sip_address'] ?? $meeting['sipAddress'] ?? '' ),
			'start'      => sanitize_text_field( $meeting['start'] ?? '' ),
			'end'        => sanitize_text_field( $meeting['end'] ?? '' ),
		);
	}

	/**
	 * Select the best current/live Webex meeting for the connected instructor account.
	 *
	 * Browsers cannot inspect the local Webex desktop app directly, so this uses the
	 * connected Webex REST account as the production-safe source of truth.
	 *
	 * @return array|WP_Error
	 */
	private static function find_current_webex_meeting() {
		if ( ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'list_meetings' ) ) {
			return new WP_Error( 'mmed_team_challenge_webex_client_missing', 'Webex meeting lookup is unavailable.', array( 'status' => 500 ) );
		}

		$now      = time();
		$response = MMED_Webex_Client::list_meetings( gmdate( 'c', $now - 4 * HOUR_IN_SECONDS ), gmdate( 'c', $now + 8 * HOUR_IN_SECONDS ) );
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'mmed_team_challenge_webex_lookup_failed', 'Could not ask Webex for current meetings.', array( 'status' => 502 ) );
		}

		$items = is_array( $response['items'] ?? null ) ? $response['items'] : array();
		$best  = null;

		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}

			$join_url = esc_url_raw( $item['webLink'] ?? '' );
			if ( ! self::is_safe_webex_join_url( $join_url ) ) {
				continue;
			}

			$state    = strtolower( sanitize_key( $item['state'] ?? '' ) );
			$start_ts = self::parse_webex_timestamp( $item['start'] ?? '' );
			$end_ts   = self::parse_webex_timestamp( $item['end'] ?? '' );

			$is_in_progress = in_array( $state, array( 'inprogress', 'in_progress', 'started', 'ongoing' ), true );
			$is_current     = $start_ts && $end_ts && $start_ts <= $now + 10 * MINUTE_IN_SECONDS && $end_ts >= $now - 10 * MINUTE_IN_SECONDS;
			$is_expired     = $end_ts && $end_ts < $now - 10 * MINUTE_IN_SECONDS;

			if ( $is_expired ) {
				continue;
			}

			if ( ! $is_in_progress && ! $is_current ) {
				continue;
			}

			$score = $is_in_progress ? 10000 : 1000;
			if ( $start_ts && $start_ts <= $now && ( ! $end_ts || $end_ts >= $now ) ) {
				$score += 500;
			}
			if ( $start_ts ) {
				$score -= min( 480, absint( round( abs( $now - $start_ts ) / 60 ) ) );
			}

			if ( null === $best || $score > $best['score'] ) {
				$best = array(
					'score' => $score,
					'item'  => $item,
				);
			}
		}

		if ( null === $best ) {
			return new WP_Error( 'mmed_team_challenge_no_active_webex_meeting', 'No active Webex meeting was found. Copy the meeting link from Webex and use the manual meeting field.', array( 'status' => 404 ) );
		}

		return self::normalize_webex_meeting_for_preview( $best['item'] );
	}

	/**
	 * Try to make the selected Webex meeting joinable for embedded attendees.
	 *
	 * @param array $meeting Safe preview meeting metadata.
	 * @return array|WP_Error
	 */
	private static function allow_webex_attendee_join_if_possible( $meeting ) {
		$meeting_id = sanitize_text_field( $meeting['id'] ?? '' );
		if ( '' === $meeting_id || ! class_exists( 'MMED_Webex_Client' ) || ! method_exists( 'MMED_Webex_Client', 'allow_guest_join_for_meeting' ) ) {
			return $meeting;
		}

		$updated = MMED_Webex_Client::allow_guest_join_for_meeting( $meeting_id );
		if ( is_wp_error( $updated ) ) {
			self::log_team_challenge_event(
				'webex_join_security_update_failed',
				array(
					'code' => $updated->get_error_code(),
				)
			);
			return $meeting;
		}

		self::log_team_challenge_event( 'webex_join_security_updated', array( 'meeting_id' => $meeting_id ) );

		return self::normalize_webex_meeting_for_preview( $updated );
	}

	/**
	 * Convert a Webex meeting API item into the safe preview meeting option shape.
	 *
	 * @param array $item Webex meeting item.
	 * @return array|WP_Error
	 */
	private static function normalize_webex_meeting_for_preview( $item ) {
		$join_url = esc_url_raw( $item['webLink'] ?? '' );
		if ( ! self::is_safe_webex_join_url( $join_url ) ) {
			return new WP_Error( 'mmed_team_challenge_invalid_webex_meeting', 'Webex returned a meeting without a usable join link.', array( 'status' => 502 ) );
		}

		return array(
			'id'          => sanitize_text_field( $item['id'] ?? '' ),
			'title'       => sanitize_text_field( $item['title'] ?? 'Current Webex Meeting' ),
			'join_url'    => $join_url,
			'sip_address' => sanitize_text_field( $item['sipAddress'] ?? '' ),
			'start'       => sanitize_text_field( $item['start'] ?? '' ),
			'end'         => sanitize_text_field( $item['end'] ?? '' ),
			'state'       => sanitize_key( $item['state'] ?? '' ),
			'source'      => 'webex_active_lookup',
			'updatedAt'   => current_time( 'mysql' ),
		);
	}

	/**
	 * Parse Webex ISO timestamps safely.
	 *
	 * @param string $value Timestamp value.
	 * @return int
	 */
	private static function parse_webex_timestamp( $value ) {
		$timestamp = strtotime( sanitize_text_field( (string) $value ) );

		return false === $timestamp ? 0 : (int) $timestamp;
	}

	/**
	 * Validate admin-provided Webex meeting URLs without accepting host keys or arbitrary URLs.
	 *
	 * @param string $url Candidate meeting URL.
	 * @return bool
	 */
	private static function is_safe_webex_join_url( $url ) {
		if ( empty( $url ) || ! wp_http_validate_url( $url ) ) {
			return false;
		}

		$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		if ( empty( $host ) ) {
			return false;
		}

		return 'webex.com' === $host || (bool) preg_match( '/(^|\\.)webex\\.com$/', $host );
	}

	/**
	 * Detect a Webex Personal Meeting Room link for the admin shortcut.
	 *
	 * @param string $url Candidate Webex URL.
	 * @return bool
	 */
	private static function is_personal_meeting_room_url( $url ) {
		if ( ! self::is_safe_webex_join_url( $url ) ) {
			return false;
		}

		$path = wp_parse_url( $url, PHP_URL_PATH );
		return is_string( $path ) && false !== stripos( $path, '/meet/' );
	}

	/**
	 * Return the known non-secret MissionResidency Personal Meeting Room URL.
	 *
	 * @return string
	 */
	private static function get_default_personal_meeting_room_url() {
		$url = (string) apply_filters( 'mmed_live_drills_personal_meeting_room_url', 'https://missionresidency.my.webex.com/meet/alumni' );
		return self::is_personal_meeting_room_url( $url ) ? esc_url_raw( $url ) : '';
	}

	/**
	 * Return whether the current user can access the preview route.
	 *
	 * @return bool
	 */
	private static function current_user_can_access_preview() {
		if ( ! self::is_preview_enabled() ) {
			return false;
		}

		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		return self::is_team_challenge_enabled();
	}

	/**
	 * Determine whether the lightweight Matrix launcher should load on this request.
	 *
	 * @return bool
	 */
	private static function should_enqueue_matrix_entry_point() {
		if ( is_admin() || ! is_user_logged_in() || ! self::is_preview_enabled() || ! self::is_team_challenge_enabled() ) {
			return false;
		}

		if ( ! self::current_user_can_access_preview() ) {
			return false;
		}

		$request_path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';
		$request_path = trim( (string) $request_path, '/' );

		return in_array( $request_path, array( 'hub', 'member-dashboard' ), true );
	}

	/**
	 * Return whether a user is explicitly allowed into the student beta.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	private static function is_beta_user_allowed( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return false;
		}

		return in_array( $user_id, self::get_beta_user_ids(), true );
	}

	/**
	 * Return explicit student beta user IDs.
	 *
	 * @return int[]
	 */
	private static function get_beta_user_ids() {
		$ids = get_option( self::BETA_USER_IDS_OPTION, array() );

		return self::sanitize_id_list( $ids );
	}

	/**
	 * Return whether non-real placeholder students may hydrate the roster.
	 *
	 * Production beta keeps this off so only real allowed/enrolled users appear.
	 *
	 * @return bool
	 */
	private static function team_challenge_placeholders_enabled() {
		return (bool) get_option( self::TEAM_CHALLENGE_PLACEHOLDERS_OPTION, false );
	}

	/**
	 * Return whether the user has enrolled-tier Matrix access.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	private static function user_has_enrolled_tier( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return false;
		}

		if ( self::user_has_drills_on_call_access( $user_id ) ) {
			return true;
		}

		if ( class_exists( 'MMED_Access_Gate' ) && method_exists( 'MMED_Access_Gate', 'get_tier' ) ) {
			return 'enrolled' === MMED_Access_Gate::get_tier( $user_id );
		}

		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			return ! empty( learndash_user_get_enrolled_courses( $user_id ) );
		}

		return ! empty( get_user_meta( $user_id, '_mmed_program_tier', true ) );
	}

	/**
	 * Return whether the user has explicit Dr J, Drills On-Call access.
	 *
	 * This keeps Live Drills beta access scoped to the Dr J course instead of
	 * broadening the global Matrix Access Gate enrolled-course list.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return bool
	 */
	private static function user_has_drills_on_call_access( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return false;
		}

		$course_id = self::drills_on_call_course_id();
		if ( ! $course_id ) {
			return false;
		}

		if ( function_exists( 'mmdoc_user_has_explicit_learndash_course_enrollment' ) ) {
			return (bool) mmdoc_user_has_explicit_learndash_course_enrollment( $user_id, $course_id );
		}

		if ( get_user_meta( $user_id, 'course_' . $course_id . '_access_from', true ) ) {
			return true;
		}

		if ( function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			$course_ids = learndash_user_get_enrolled_courses( $user_id );
			if ( is_array( $course_ids ) && in_array( $course_id, array_map( 'absint', $course_ids ), true ) ) {
				return true;
			}
		}

		$access_list = get_post_meta( $course_id, '_sfwd-course_access_list', true );
		if ( is_array( $access_list ) ) {
			return in_array( $user_id, array_map( 'absint', $access_list ), true );
		}

		if ( is_string( $access_list ) && '' !== trim( $access_list ) ) {
			$ids = array_filter( array_map( 'absint', preg_split( '/[\s,]+/', $access_list ) ) );
			return in_array( $user_id, $ids, true );
		}

		return false;
	}

	/**
	 * Return the configured Dr J, Drills On-Call course ID.
	 *
	 * @return int
	 */
	private static function drills_on_call_course_id() {
		$course_id = absint( get_option( 'mmed_course_drills_on_call', 0 ) );
		if ( $course_id > 0 ) {
			return $course_id;
		}

		$candidates = get_posts(
			array(
				'post_type'     => 'sfwd-courses',
				'post_status'   => array( 'publish', 'private', 'draft' ),
				's'             => 'Drills On-Call',
				'numberposts'   => 10,
				'fields'        => 'ids',
				'no_found_rows' => true,
			)
		);

		foreach ( (array) $candidates as $candidate_id ) {
			if ( 0 === strcasecmp( (string) get_the_title( $candidate_id ), 'Dr J, Drills On-Call' ) ) {
				return absint( $candidate_id );
			}
		}

		return 0;
	}

	/**
	 * Sanitize a comma-delimited or array list of IDs.
	 *
	 * @param mixed $value Raw list.
	 * @return int[]
	 */
	private static function sanitize_id_list( $value ) {
		if ( is_string( $value ) ) {
			$value = preg_split( '/[\s,]+/', $value );
		}

		if ( ! is_array( $value ) ) {
			return array();
		}

		$ids = array_map( 'absint', $value );
		$ids = array_filter( $ids );

		return array_values( array_unique( $ids ) );
	}

	/**
	 * Format an ID list for admin display.
	 *
	 * @param int[] $ids User IDs.
	 * @return string
	 */
	private static function format_id_list( $ids ) {
		$ids = self::sanitize_id_list( $ids );

		return ! empty( $ids ) ? implode( ', ', $ids ) : 'None configured';
	}

	/**
	 * Return the explicit Eastern timezone used for preview meeting windows.
	 *
	 * @return DateTimeZone
	 */
	private static function get_default_timezone() {
		return new DateTimeZone( self::DEFAULT_TIMEZONE );
	}

	/**
	 * Wire the configured test meeting into the static preview shell.
	 *
	 * @param string $html Static preview HTML.
	 * @return string
	 */
	private static function inject_preview_meeting( $html ) {
		$state = self::get_team_challenge_state_data();
		if ( empty( self::current_team_challenge_viewer( $state ) ) ) {
			return $html;
		}
		$meeting  = self::get_preview_meeting();
		$join_url = esc_url( $meeting['join_url'] ?? '' );

		if ( empty( $join_url ) ) {
			return $html;
		}

		$link = '<a class="open-webex-btn" href="' . $join_url . '" target="_blank" rel="noopener noreferrer">Launch Test Webex Meeting</a><p class="preview-meeting-copy">Opens Webex in a new tab. Embedded Webex is not active in this preview.</p>';

		return str_replace(
			'<button class="open-webex-btn" type="button">Open in Webex</button>',
			$link,
			$html
		);
	}

	/**
	 * Inject preview-only embedded Webex assets and config.
	 *
	 * @param string $html Static preview HTML.
	 * @return string
	 */
	private static function inject_embedded_assets( $html ) {
		$state = self::get_team_challenge_state_data();
		$viewer = self::current_team_challenge_viewer( $state );
		$meeting = empty( $viewer ) ? array() : self::get_preview_meeting();
		$css_url    = self::asset_url( self::WIDGET_CSS_PATH );
		$widget_url = self::asset_url( self::WIDGET_SCRIPT_PATH );
		$embed_url  = self::asset_url( self::EMBED_SCRIPT_PATH );

				$config = array(
					'restUrl' => esc_url_raw( rest_url( 'mmed/v1' ) ),
					'nonce'   => wp_create_nonce( 'wp_rest' ),
					'widgetLayout' => 'Stack',
					'widgetScriptUrl' => esc_url_raw( $widget_url ),
						'meeting' => empty( $viewer ) ? array() : array(
				'id'         => sanitize_text_field( $meeting['id'] ?? '' ),
				'title'      => sanitize_text_field( $meeting['title'] ?? self::TEST_MEETING_TITLE ),
				'joinUrl'    => esc_url_raw( $meeting['join_url'] ?? '' ),
				'sipAddress' => sanitize_text_field( $meeting['sip_address'] ?? '' ),
				'start'      => sanitize_text_field( $meeting['start'] ?? '' ),
				'end'        => sanitize_text_field( $meeting['end'] ?? '' ),
			),
		);

		$head = "\n" . '<link rel="stylesheet" href="' . esc_url( $css_url ) . '">' . "\n";
		$tail = "\n" . '<script>window.MMEDLiveDrillsWebexPreview = ' . wp_json_encode( $config ) . ';</script>' . "\n";
		$tail .= '<script src="' . esc_url( $embed_url ) . '" defer></script>' . "\n";

		if ( false !== strpos( $html, '</head>' ) ) {
			$html = str_replace( '</head>', $head . '</head>', $html );
		}

		if ( false !== strpos( $html, '</body>' ) ) {
			return str_replace( '</body>', $tail . '</body>', $html );
		}

		return $html . $tail;
	}

	/**
	 * Inject Team Challenge assets only when the Team Challenge flag is on.
	 *
	 * @param string $html Static preview HTML.
	 * @return string
	 */
	private static function inject_team_challenge_assets( $html ) {
		if ( ! self::is_team_challenge_enabled() ) {
			return $html;
		}

					$state = self::get_team_challenge_state_data();
					$viewer = self::current_team_challenge_viewer( $state );
					$meeting = empty( $viewer ) ? array() : self::get_preview_meeting();
					$meeting_join_url = esc_url_raw( $meeting['join_url'] ?? '' );
					$personal_room_url = current_user_can( 'manage_options' ) && self::is_personal_meeting_room_url( $meeting_join_url ) ? $meeting_join_url : '';
					if ( current_user_can( 'manage_options' ) && '' === $personal_room_url ) {
						$personal_room_url = self::get_default_personal_meeting_room_url();
					}
					$action_url = esc_url_raw( self::asset_url( 'assets/daily-drills-team-challenge-v3-action.php' ) );

				$config = array(
			'enabled'       => true,
			'flag'          => self::TEAM_CHALLENGE_FLAG_NAME,
			'isAdmin'       => current_user_can( 'manage_options' ),
			'mode'          => current_user_can( 'manage_options' ) ? 'admin' : 'student',
				'currentUserId' => get_current_user_id(),
						'stateUrl'      => $action_url,
						'fastStateUrl'  => $action_url,
						'fastStateWriteUrl' => $action_url,
						'fastStateActionUrl' => $action_url,
						'workerUrl'     => esc_url_raw( self::asset_url( self::TEAM_CHALLENGE_WORKER_PATH ) ),
						'viewerTicket'  => self::current_team_challenge_viewer_ticket( $state ),
				'avatarBaseUrl' => esc_url_raw( MMED_HUB_URL . 'assets/team-challenge-avatars/' ),
					'loginUrl'      => esc_url_raw( add_query_arg( 'redirect_to', rawurlencode( home_url( '/' . self::ROUTE_PATH . '/' ) ), home_url( '/my-account/' ) ) ),
					'registrationUrl' => esc_url_raw( add_query_arg( 'redirect_to', rawurlencode( home_url( '/' . self::ROUTE_PATH . '/' ) ), home_url( '/my-account/' ) ) ),
				'avatarStudioUrl' => esc_url_raw( home_url( '/homepage-arena/' ) ),
				'personalMeetingRoomUrl' => $personal_room_url,
					'meeting'       => empty( $viewer ) ? array() : array(
					'title'   => sanitize_text_field( $meeting['title'] ?? 'Live Team Challenge Webex Meeting' ),
					'joinUrl' => $meeting_join_url,
					'start'   => sanitize_text_field( $meeting['start'] ?? '' ),
				'end'     => sanitize_text_field( $meeting['end'] ?? '' ),
			),
			'scheduledSessions' => current_user_can( 'manage_options' ) ? self::get_team_challenge_sessions() : array(),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
				'pollInterval'  => 450,
				'copy'          => array(
					'studentMode' => 'The host will choose each player in turn.',
					'adminMode'   => 'Select the active student, or use Auto next, then mark Correct or Missed.',
			),
		);

		$script_url = self::asset_url( self::TEAM_CHALLENGE_SCRIPT_PATH );
		$tail       = "\n" . '<script>window.MMEDLiveDrillsTeamChallengePreview = ' . wp_json_encode( $config ) . ';</script>' . "\n";
		$tail      .= '<script src="' . esc_url( $script_url ) . '" defer></script>' . "\n";

		if ( false !== strpos( $html, '</body>' ) ) {
			return str_replace( '</body>', $tail . '</body>', $html );
		}

		return $html . $tail;
	}

	/**
	 * Inject route-isolated SDK V3 bootstrap metadata without changing the widget runtime.
	 *
	 * @param string $html Static preview HTML.
	 * @return string
	 */
	private static function inject_sdk_v3_assets( $html ) {
		$state = self::get_team_challenge_state_data();
		$action_url = esc_url_raw( self::asset_url( 'assets/daily-drills-team-challenge-v3-action.php' ) );
		$config = array(
			'enabled'       => true,
			'route'         => self::ROUTE_PATH,
			'runtimeMode'   => 'sdk-v3-isolated',
			'legacyRoute'   => 'daily-drills-live-webex-preview',
			'stateEndpoint' => $action_url,
			'viewerTicket'  => self::current_team_challenge_viewer_ticket( $state ),
		);

		$script_url = self::asset_url( self::SDK_V3_SCRIPT_PATH );
		$tail       = "\n" . '<script>window.MMEDLiveDrillsSDKV3Config = ' . wp_json_encode( $config ) . ';</script>' . "\n";
		$tail      .= '<script src="' . esc_url( $script_url ) . '" defer></script>' . "\n";

		if ( false !== strpos( $html, '</body>' ) ) {
			return str_replace( '</body>', $tail . '</body>', $html );
		}

		return $html . $tail;
	}

	/**
	 * Return sanitized Team Challenge state, rebuilding if the roster changed.
	 *
	 * @return array
	 */
	private static function get_team_challenge_state_data() {
		$fresh = self::build_team_challenge_state();
		$state = get_option( self::TEAM_CHALLENGE_STATE_OPTION, array() );
		$private_snapshot = self::read_team_challenge_private_snapshot();
		if ( is_array( $private_snapshot ) && ! empty( $private_snapshot['teams'] ) && MMED_Live_Drills_State_Contract::compare_states( $private_snapshot, $state ) >= 0 ) {
			$state = $private_snapshot;
		}

		if ( ! is_array( $state ) || empty( $state['teams'] ) || empty( $state['rosterHash'] ) ) {
			$fresh['meeting'] = self::team_challenge_meeting_for_client_state( self::get_preview_meeting() );
			return MMED_Live_Drills_State_Contract::normalize_state( $fresh );
		}

		if ( $state['rosterHash'] !== $fresh['rosterHash'] ) {
			/*
			 * Preserve the live session state during beta. The roster hash is a
			 * coarse rebuild guard from the initial roster, but scoring, guest
			 * joins, team assignments, and meeting selection are also stored in
			 * this option. Resetting on a hash mismatch makes successful POST
			 * responses disappear on the next poll.
			 */
			$state['sourceRosterHash'] = $fresh['rosterHash'];
		}

		$state['meeting'] = self::team_challenge_meeting_for_client_state( self::get_preview_meeting() );
		$state['hostNote'] = sanitize_textarea_field( $state['hostNote'] ?? '' );
		$state['chatMessages'] = self::sanitize_team_challenge_chat_messages( $state['chatMessages'] ?? array() );
		$state['countdown'] = self::sanitize_team_challenge_countdown( $state['countdown'] ?? array() );

		return MMED_Live_Drills_State_Contract::normalize_state( $state );
	}

	/**
	 * Build the default Team Challenge state from current opt-ins or safe placeholders.
	 *
	 * @return array
	 */
	private static function build_team_challenge_state() {
		$teams = self::build_team_challenge_teams();

				return array(
					'schemaVersion' => MMED_Live_Drills_State_Contract::SCHEMA_VERSION,
					'mode'         => 'team_challenge',
					'sessionId'    => 'legacy-' . substr( md5( wp_json_encode( $teams ) ), 0, 16 ),
					'sessionTitle' => 'Live Team Challenge',
					'lifecycle'    => array(
						'state'      => 'idle',
						'changedAt'  => '',
						'startedAt'  => '',
						'endedAt'    => '',
						'archivedAt' => '',
					),
					'eventSeq'    => 0,
				'teams'        => $teams,
				'active'       => self::get_first_team_challenge_active( $teams ),
					'nextTeamId'   => 'red',
						'winner'       => null,
						'hostNote'     => '',
							'chatMessages' => array(),
							'spectators'   => array(),
							'spectatorCount' => 0,
						'countdown'    => self::sanitize_team_challenge_countdown( array() ),
						'rosterHash'   => md5( wp_json_encode( $teams ) ),
				'history'      => array(),
				'lastEvent'    => array(
					'type'      => 'ready',
					'message'   => 'Team Challenge ready.',
					'updatedAt' => current_time( 'mysql' ),
				),
				'updatedAt'    => current_time( 'mysql' ),
			);
		}

	/**
	 * Build two teams from current live opt-ins. Demo placeholders are opt-in only.
	 *
	 * @return array
	 */
	private static function build_team_challenge_teams() {
		$students = array();

		if ( self::team_challenge_placeholders_enabled() ) {
			$placeholder_students = self::get_team_challenge_bot_students();
			$placeholder_index    = 0;

			while ( count( $students ) < 14 && isset( $placeholder_students[ $placeholder_index ] ) ) {
				$students[] = $placeholder_students[ $placeholder_index ];
				$placeholder_index++;
			}
		}

		$students      = array_slice( $students, 0, 14 );
		$blue_students = array();
		$red_students  = array();
		foreach ( $students as $index => $student ) {
			if ( ( 0 === $index % 2 && count( $blue_students ) < 7 ) || count( $red_students ) >= 7 ) {
				$blue_students[] = $student;
			} else {
				$red_students[] = $student;
			}
		}

		return array(
			array(
				'id'       => 'blue',
				'name'     => 'Beta Blockers',
				'label'    => 'Beta Blockers',
				'color'    => '#2563eb',
				'score'    => 0,
				'students' => $blue_students,
			),
			array(
				'id'       => 'red',
				'name'     => 'Red Blood Cells',
				'label'    => 'Red Blood Cells',
				'color'    => '#dc2626',
				'score'    => 0,
				'students' => $red_students,
			),
		);
	}

	/**
	 * Build a Team Challenge student row from a WordPress user.
	 *
	 * @param WP_User $user WordPress user.
	 * @return array
	 */
	private static function build_team_challenge_student_from_user( $user ) {
		$name = trim( (string) $user->display_name );
		if ( '' === $name ) {
			$name = 'Student ' . absint( $user->ID );
		}

		$avatars = self::get_team_challenge_user_avatars( absint( $user->ID ) );

		return array(
			'id'            => 'u' . absint( $user->ID ),
			'userId'        => absint( $user->ID ),
			'name'          => sanitize_text_field( $name ),
				'initials'      => self::get_initials( $name ),
				'points'        => 0,
				'attempts'      => 0,
				'questionsAsked'=> 0,
				'avatarUrl'     => esc_url_raw( $avatars['thumb'] ?? '' ),
				'avatarFullUrl' => esc_url_raw( $avatars['full'] ?? '' ),
				'avatarSource'  => sanitize_key( $avatars['source'] ?? 'wordpress' ),
				'avatarSeed'    => sanitize_key( 'user-' . absint( $user->ID ) ),
				'isBot'         => false,
				'joined'        => true,
				);
			}

		/**
		 * Return the safe bot roster used to hydrate 7-v-7 testing.
		 *
		 * @return array
		 */
	private static function get_team_challenge_bot_students() {
			$bots = array(
				array( 'id' => 'bot-ava-quinn', 'name' => 'Ava Quinn', 'initials' => 'AQ', 'tone' => 'blue', 'style' => 'neuro' ),
				array( 'id' => 'bot-leo-santos', 'name' => 'Leo Santos', 'initials' => 'LS', 'tone' => 'blue', 'style' => 'cardio' ),
				array( 'id' => 'bot-mila-rowan', 'name' => 'Mila Rowan', 'initials' => 'MR', 'tone' => 'blue', 'style' => 'renal' ),
				array( 'id' => 'bot-noah-voss', 'name' => 'Noah Voss', 'initials' => 'NV', 'tone' => 'blue', 'style' => 'pulm' ),
				array( 'id' => 'bot-iris-chen', 'name' => 'Iris Chen', 'initials' => 'IC', 'tone' => 'blue', 'style' => 'heum' ),
				array( 'id' => 'bot-eli-foster', 'name' => 'Eli Foster', 'initials' => 'EF', 'tone' => 'blue', 'style' => 'micro' ),
				array( 'id' => 'bot-nina-park', 'name' => 'Nina Park', 'initials' => 'NP', 'tone' => 'blue', 'style' => 'ethics' ),
				array( 'id' => 'bot-rae-morgan', 'name' => 'Rae Morgan', 'initials' => 'RM', 'tone' => 'red', 'style' => 'ob' ),
				array( 'id' => 'bot-kai-mercer', 'name' => 'Kai Mercer', 'initials' => 'KM', 'tone' => 'red', 'style' => 'peds' ),
				array( 'id' => 'bot-sia-turner', 'name' => 'Sia Turner', 'initials' => 'ST', 'tone' => 'red', 'style' => 'gi' ),
				array( 'id' => 'bot-jude-knight', 'name' => 'Jude Knight', 'initials' => 'JK', 'tone' => 'red', 'style' => 'psych' ),
				array( 'id' => 'bot-mina-silva', 'name' => 'Mina Silva', 'initials' => 'MS', 'tone' => 'red', 'style' => 'biochem' ),
				array( 'id' => 'bot-cole-rivers', 'name' => 'Cole Rivers', 'initials' => 'CR', 'tone' => 'red', 'style' => 'pharm' ),
				array( 'id' => 'bot-rina-shaw', 'name' => 'Rina Shaw', 'initials' => 'RS', 'tone' => 'red', 'style' => 'stats' ),
			);

		return array_map(
			function ( $bot ) {
				return array(
					'id'            => sanitize_key( $bot['id'] ),
					'userId'        => 0,
					'name'          => sanitize_text_field( $bot['name'] ),
						'initials'      => sanitize_text_field( $bot['initials'] ),
						'points'        => 0,
						'attempts'      => 0,
						'questionsAsked'=> 0,
						'avatarUrl'     => '',
						'avatarFullUrl' => '',
						'avatarSource'  => 'professional_bot',
						'avatarTone'    => sanitize_key( $bot['tone'] ),
						'avatarSeed'    => sanitize_key( $bot['id'] ),
						'avatarStyle'   => sanitize_key( $bot['style'] ),
						'isBot'         => true,
						'joined'        => true,
					);
				},
			$bots
		);
	}

	/**
	 * Resolve Arena/WordPress avatar URLs for a beta student.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_team_challenge_user_avatars( $user_id ) {
		$user_id = absint( $user_id );
		if ( ! $user_id ) {
			return array( 'full' => '', 'thumb' => '', 'source' => 'none' );
		}

		$full_keys = array(
			'avatar_url',
			'mmed_avatar_url',
			'_mmed_avatar_url',
			'arena_avatar_url',
			'mmed_arena_avatar_url',
			'_mmed_arena_avatar_url',
			'arena_avatar_full',
			'_arena_avatar_full',
				'avatar_full_url',
				'avatar_image_url',
				'avatar_fullbody_url',
				'avatar_full_body_url',
				'fullbody_url',
				'full_body_url',
				'profile_avatar_url',
				'profile_photo',
				'picture',
			);
			$thumb_keys = array(
				'avatar_thumbnail_url',
				'mmed_avatar_thumbnail_url',
				'arena_avatar_face',
				'_arena_avatar_face',
				'thumbnail_url',
				'headshot_url',
				'arena_headshot_url',
				'avatar_headshot_url',
				'profile_headshot_url',
			);

		$source = 'none';
		$full   = self::first_user_meta_url( $user_id, $full_keys );
		$thumb  = self::first_user_meta_url( $user_id, $thumb_keys );
		if ( ! empty( $full ) || ! empty( $thumb ) ) {
			$source = 'user_meta';
		}

		$snapshot = get_user_meta( $user_id, 'avatar_snapshot', true );
		if ( is_string( $snapshot ) && '' !== $snapshot ) {
			$decoded = json_decode( $snapshot, true );
			if ( is_array( $decoded ) ) {
				$snapshot = $decoded;
			}
		}

		if ( is_array( $snapshot ) ) {
				foreach ( array( 'avatar_url', 'full_url', 'fullbody_url', 'full_body_url', 'image', 'src' ) as $snapshot_full_key ) {
					if ( empty( $full ) && ! empty( $snapshot[ $snapshot_full_key ] ) ) {
						$full = esc_url_raw( $snapshot[ $snapshot_full_key ] );
						$source = 'avatar_snapshot';
					}
				}
				foreach ( array( 'avatar_thumbnail_url', 'thumbnail_url', 'headshot_url', 'face_url', 'thumb', 'thumbnail' ) as $snapshot_thumb_key ) {
					if ( empty( $thumb ) && ! empty( $snapshot[ $snapshot_thumb_key ] ) ) {
						$thumb = esc_url_raw( $snapshot[ $snapshot_thumb_key ] );
						$source = 'avatar_snapshot';
					}
				}
		}

		if ( self::is_default_avatar_url( $full ) ) {
			$full = '';
		}
		if ( self::is_default_avatar_url( $thumb ) ) {
			$thumb = '';
		}

		if ( empty( $full ) || empty( $thumb ) ) {
			$supabase_avatar = self::get_team_challenge_supabase_avatar( $user_id );
			if ( ! empty( $supabase_avatar['full'] ) && empty( $full ) ) {
				$full = $supabase_avatar['full'];
				$source = 'supabase_user_avatars';
			}
			if ( ! empty( $supabase_avatar['thumb'] ) && empty( $thumb ) ) {
				$thumb = $supabase_avatar['thumb'];
				$source = 'supabase_user_avatars';
			}
		}

		if ( empty( $thumb ) ) {
			$thumb = $full;
		}
		if ( empty( $full ) ) {
			$full = $thumb;
		}

		if ( empty( $full ) && function_exists( 'get_avatar_url' ) ) {
			$wp_full = esc_url_raw( get_avatar_url( $user_id, array( 'size' => 192 ) ) );
			if ( ! self::is_default_avatar_url( $wp_full ) ) {
				$full = $wp_full;
				$source = 'wordpress_avatar';
			}
		}
		if ( empty( $thumb ) && function_exists( 'get_avatar_url' ) ) {
			$wp_thumb = esc_url_raw( get_avatar_url( $user_id, array( 'size' => 96 ) ) );
			if ( ! self::is_default_avatar_url( $wp_thumb ) ) {
				$thumb = $wp_thumb;
				$source = 'wordpress_avatar';
			}
		}

		return array(
			'full'   => $full,
			'thumb'  => $thumb,
			'source' => ! empty( $full ) ? $source : 'none',
		);
	}

	/**
	 * Resolve a Team Challenge avatar from the existing Supabase Arena profile table.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_team_challenge_supabase_avatar( $user_id ) {
		$supabase_uuid = self::get_team_challenge_supabase_uuid( $user_id );
		if ( empty( $supabase_uuid ) ) {
			return array( 'full' => '', 'thumb' => '' );
		}

		$avatar = self::query_team_challenge_supabase_avatar( $supabase_uuid, true );
		if ( empty( $avatar['full'] ) && empty( $avatar['thumb'] ) ) {
			$avatar = self::query_team_challenge_supabase_avatar( $supabase_uuid, false );
		}

		return $avatar;
	}

	/**
	 * Return a stored Supabase UUID for an existing WordPress user.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return string
	 */
	private static function get_team_challenge_supabase_uuid( $user_id ) {
		foreach ( array( '_mmed_supabase_uuid', 'missionmed_supabase_auth_uid', 'mmed_supabase_uuid', 'supabase_uuid', 'user_uuid' ) as $meta_key ) {
			$value = trim( (string) get_user_meta( $user_id, $meta_key, true ) );
			if ( self::looks_like_uuid( $value ) ) {
				return $value;
			}
		}

		if ( class_exists( 'MMED_Supabase_Bridge' ) && is_callable( array( 'MMED_Supabase_Bridge', 'get_supabase_uuid' ) ) ) {
			$value = trim( (string) MMED_Supabase_Bridge::get_supabase_uuid( $user_id ) );
			if ( self::looks_like_uuid( $value ) ) {
				return $value;
			}
		}

		return '';
	}

	/**
	 * Query Supabase user_avatars through the existing server-side bridge headers.
	 *
	 * @param string $supabase_uuid Supabase user UUID.
	 * @param bool   $active_only Whether to require the active avatar marker.
	 * @return array
	 */
	private static function query_team_challenge_supabase_avatar( $supabase_uuid, $active_only ) {
		if ( ! defined( 'MMED_SUPABASE_URL' ) || '' === trim( (string) MMED_SUPABASE_URL ) ) {
			return array( 'full' => '', 'thumb' => '' );
		}
		if ( ! class_exists( 'MMED_Supabase_Bridge' ) || ! is_callable( array( 'MMED_Supabase_Bridge', 'get_supabase_client_headers' ) ) ) {
			return array( 'full' => '', 'thumb' => '' );
		}

		$query = array(
			'user_id' => 'eq.' . $supabase_uuid,
			'select'  => 'avatar_url,thumbnail_url,is_active,created_at',
			'order'   => 'created_at.desc',
			'limit'   => 1,
		);
		if ( $active_only ) {
			$query['is_active'] = 'eq.true';
		}

		$url      = add_query_arg( $query, trailingslashit( untrailingslashit( MMED_SUPABASE_URL ) ) . 'rest/v1/user_avatars' );
		$response = wp_remote_get(
			$url,
			array(
				'timeout' => 8,
				'headers' => MMED_Supabase_Bridge::get_supabase_client_headers(),
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			self::log_team_challenge_event(
				'avatar_fetch_failure',
				array(
					'source'      => 'supabase_user_avatars',
					'active_only' => $active_only,
					'status'      => is_wp_error( $response ) ? 'wp_error' : wp_remote_retrieve_response_code( $response ),
				)
			);
			return array( 'full' => '', 'thumb' => '' );
		}

		$rows = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $rows ) || empty( $rows[0] ) || ! is_array( $rows[0] ) ) {
			return array( 'full' => '', 'thumb' => '' );
		}

		return array(
			'full'  => esc_url_raw( $rows[0]['avatar_url'] ?? '' ),
			'thumb' => esc_url_raw( $rows[0]['thumbnail_url'] ?? ( $rows[0]['avatar_url'] ?? '' ) ),
		);
	}

	/**
	 * Detect generated/default WordPress avatar URLs so the UI can use Arena art instead.
	 *
	 * @param string $url Avatar URL.
	 * @return bool
	 */
	private static function is_default_avatar_url( $url ) {
		$url = (string) $url;
		if ( '' === $url ) {
			return false;
		}

		return false !== stripos( $url, 'gravatar.com/avatar/' );
	}

	/**
	 * Return whether a string looks like a UUID.
	 *
	 * @param string $value Candidate value.
	 * @return bool
	 */
	private static function looks_like_uuid( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value );
	}

	/**
	 * Return the first URL stored in a user meta key list.
	 *
	 * @param int      $user_id WordPress user ID.
	 * @param string[] $keys Candidate meta keys.
	 * @return string
	 */
	private static function first_user_meta_url( $user_id, $keys ) {
		foreach ( $keys as $key ) {
			$value = get_user_meta( $user_id, $key, true );
			if ( is_array( $value ) ) {
					foreach ( array( 'url', 'avatar_url', 'avatar_thumbnail_url', 'thumbnail_url', 'headshot_url', 'full_url', 'fullbody_url', 'full_body_url', 'image', 'src' ) as $array_key ) {
					if ( ! empty( $value[ $array_key ] ) ) {
						return esc_url_raw( $value[ $array_key ] );
					}
				}
				continue;
			}

			$value = trim( (string) $value );
			if ( '' !== $value ) {
				return esc_url_raw( $value );
			}
		}

		return '';
	}

	/**
	 * Return the first active student in a Team Challenge roster.
	 *
	 * @param array $teams Team state.
	 * @return array
	 */
	private static function get_first_team_challenge_active( $teams ) {
		foreach ( $teams as $team ) {
			if ( ! empty( $team['students'][0]['id'] ) ) {
				return array(
					'teamId'    => sanitize_key( $team['id'] ),
					'studentId' => sanitize_key( $team['students'][0]['id'] ),
				);
			}
		}

		return array(
			'teamId'    => '',
			'studentId' => '',
		);
	}

	/**
	 * Shuffle team assignments for easy teacher setup.
	 *
	 * @param array $state Current Team Challenge state.
	 * @return array
	 */
		private static function shuffle_team_challenge_state( $state, $randomize = true ) {
			$students           = array();
			$previous_active_id = sanitize_key( $state['active']['studentId'] ?? '' );
			$previous_next_team = sanitize_key( $state['nextTeamId'] ?? '' );

			foreach ( $state['teams'] ?? array() as $team ) {
				foreach ( $team['students'] ?? array() as $student ) {
					if ( $randomize ) {
						$student['points']         = 0;
						$student['attempts']       = 0;
						$student['questionsAsked'] = 0;
					}
					$students[]                = $student;
				}
			}

			if ( $randomize ) {
				for ( $index = count( $students ) - 1; $index > 0; $index-- ) {
					$swap_index              = wp_rand( 0, $index );
					$temp                    = $students[ $index ];
					$students[ $index ]      = $students[ $swap_index ];
					$students[ $swap_index ] = $temp;
				}
			}

		$split_students = array(
			'blue' => array(),
			'red'  => array(),
		);

		foreach ( $students as $index => $student ) {
			$split_students[ 0 === $index % 2 ? 'blue' : 'red' ][] = $student;
		}

		foreach ( $state['teams'] as $team_index => $team ) {
			$team_id = sanitize_key( $team['id'] ?? '' );
			if ( isset( $split_students[ $team_id ] ) ) {
				$state['teams'][ $team_index ]['students'] = $split_students[ $team_id ];
			}
			}

			$state = self::recalculate_team_challenge_scores( $state );

			$state['active'] = self::get_first_team_challenge_active( $state['teams'] ?? array() );
			if ( '' !== $previous_active_id ) {
				foreach ( $state['teams'] ?? array() as $team ) {
					foreach ( $team['students'] ?? array() as $student ) {
						if ( sanitize_key( $student['id'] ?? '' ) === $previous_active_id ) {
							$state['active'] = array(
								'teamId'    => sanitize_key( $team['id'] ?? '' ),
								'studentId' => $previous_active_id,
							);
							break 2;
						}
					}
				}
			}
			$state['nextTeamId'] = $randomize || ! self::team_challenge_team_exists( $state, $previous_next_team ) ? 'red' : $previous_next_team;
			$state['winner']     = null;

			return $state;
		}

		/**
		 * Add the signed-in beta user to the live roster if they choose Jumping in.
		 *
		 * @param array   $state Team Challenge state.
		 * @param WP_User $user  Signed-in user.
		 * @return array
		 */
			private static function team_challenge_join_current_user( $state, $user ) {
				$student_id = 'u' . absint( $user->ID );
				foreach ( $state['teams'] ?? array() as $team_index => $team ) {
					foreach ( $team['students'] ?? array() as $student_index => $student ) {
						if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
						continue;
					}

					$state['teams'][ $team_index ]['students'][ $student_index ]['joined'] = true;
					$state['lastEvent'] = array(
						'type'      => 'join_in',
						'message'   => sanitize_text_field( $student['name'] ?? 'Student' ) . ' is jumping in.',
						'updatedAt' => current_time( 'mysql' ),
					);
					$state['updatedAt'] = current_time( 'mysql' );
					return $state;
				}
			}

			$target_index = self::get_smallest_team_index( $state );
			if ( null === $target_index ) {
				return $state;
			}

				$student = self::build_team_challenge_student_from_user( $user );
				$student['joined'] = true;
				$student = self::restore_team_challenge_score_snapshot( $state, $student );
				if ( 7 <= count( $state['teams'][ $target_index ]['students'] ?? array() ) ) {
					foreach ( $state['teams'][ $target_index ]['students'] as $student_index => $candidate ) {
						if ( ! empty( $candidate['isBot'] ) ) {
							array_splice( $state['teams'][ $target_index ]['students'], $student_index, 1 );
						break;
					}
				}
			}
			$state['teams'][ $target_index ]['students'][] = $student;
			$state = self::recalculate_team_challenge_scores( $state );
			$state['lastEvent'] = array(
				'type'      => 'join_in',
				'message'   => sanitize_text_field( $student['name'] ?? 'Student' ) . ' joined ' . sanitize_text_field( $state['teams'][ $target_index ]['name'] ?? 'Team' ) . '.',
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Add a name-only browser guest to the live roster.
		 *
		 * @param array  $state      Team Challenge state.
		 * @param string $guest_id   Browser-local guest ID.
		 * @param string $name       Display name.
		 * @return array
		 */
	private static function team_challenge_join_guest( $state, $guest_id, $name ) {
		$guest_id = self::normalize_team_challenge_guest_id( $guest_id );
		$name = substr( sanitize_text_field( $name ), 0, 60 );

		$existing = null;
		foreach ( $state['teams'] ?? array() as $team_index => $team ) {
			foreach ( $team['students'] ?? array() as $student_index => $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) !== $guest_id ) {
					continue;
				}

						$existing = $student;
						$state    = self::preserve_team_challenge_score_snapshot( $state, $student );
						array_splice( $state['teams'][ $team_index ]['students'], $student_index, 1 );
						$state['teams'][ $team_index ]['students'] = array_values( $state['teams'][ $team_index ]['students'] );
						break 2;
					}
				}

			$target_index = self::get_smallest_team_index( $state );
			if ( null === $target_index ) {
				return $state;
			}

			$student = array(
				'id'             => $guest_id,
				'userId'         => 0,
				'name'           => $name,
				'initials'       => self::get_initials( $name ),
				'points'         => absint( $existing['points'] ?? 0 ),
				'attempts'       => absint( $existing['attempts'] ?? 0 ),
				'questionsAsked' => absint( $existing['questionsAsked'] ?? 0 ),
				'avatarUrl'      => esc_url_raw( $existing['avatarUrl'] ?? '' ),
				'avatarFullUrl'  => esc_url_raw( $existing['avatarFullUrl'] ?? '' ),
				'avatarSource'   => sanitize_key( $existing['avatarSource'] ?? 'guest_fallback' ),
				'avatarSeed'     => sanitize_key( substr( hash( 'sha256', $guest_id ), 0, 16 ) ),
				'isBot'          => false,
				'isGuest'        => true,
				'joined'         => true,
			);
			$student = self::restore_team_challenge_score_snapshot( $state, $student );

				$state['teams'][ $target_index ]['students'][] = $student;
				$state = self::recalculate_team_challenge_scores( $state );
				$state['lastEvent'] = array(
				'type'      => 'guest_join',
				'message'   => $name . ' is jumping in.',
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Remove the signed-in beta user from the live roster when they choose not to jump in.
		 *
		 * @param array   $state Team Challenge state.
		 * @param WP_User $user  Signed-in user.
		 * @return array
		 */
		private static function team_challenge_remove_current_user( $state, $user ) {
			$student_id = 'u' . absint( $user->ID );
			$removed    = false;

			foreach ( $state['teams'] ?? array() as $team_index => $team ) {
				foreach ( $team['students'] ?? array() as $student_index => $student ) {
						if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
							continue;
						}

						$state = self::preserve_team_challenge_score_snapshot( $state, $student );
						array_splice( $state['teams'][ $team_index ]['students'], $student_index, 1 );
						$state['teams'][ $team_index ]['students'] = array_values( $state['teams'][ $team_index ]['students'] );
						$removed = true;
						break 2;
				}
			}

			if ( $removed ) {
				$state = self::recalculate_team_challenge_scores( $state );
			}

			if ( sanitize_key( $state['active']['studentId'] ?? '' ) === $student_id ) {
				$state['active'] = self::get_first_team_challenge_active( $state['teams'] ?? array() );
			}

			$state['winner'] = null;
			$state['lastEvent'] = array(
				'type'      => 'opt_out',
				'message'   => 'Roster updated.',
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Remove a browser guest from the roster.
		 *
		 * @param array  $state    Team Challenge state.
		 * @param string $guest_id Browser-local guest ID.
		 * @return array
		 */
	private static function team_challenge_remove_guest( $state, $guest_id ) {
		$guest_id = self::normalize_team_challenge_guest_id( $guest_id );
		$removed    = false;

			foreach ( $state['teams'] ?? array() as $team_index => $team ) {
				foreach ( $team['students'] ?? array() as $student_index => $student ) {
					if ( '' === $guest_id || sanitize_key( $student['id'] ?? '' ) !== $guest_id ) {
							continue;
						}

						$state = self::preserve_team_challenge_score_snapshot( $state, $student );
						array_splice( $state['teams'][ $team_index ]['students'], $student_index, 1 );
						$state['teams'][ $team_index ]['students'] = array_values( $state['teams'][ $team_index ]['students'] );
						$removed = true;
						break 2;
					}
			}

			if ( $removed ) {
				$state = self::recalculate_team_challenge_scores( $state );
			}

			if ( '' !== $guest_id && sanitize_key( $state['active']['studentId'] ?? '' ) === $guest_id ) {
				$state['active'] = self::get_first_team_challenge_active( $state['teams'] ?? array() );
			}

			$state['winner'] = null;
			$state['lastEvent'] = array(
				'type'      => 'guest_opt_out',
				'message'   => 'Roster updated.',
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

				return $state;
			}

			/**
			 * Store a participant's scoring history before Jump Out removes them.
			 *
			 * @param array $state   Team Challenge state.
			 * @param array $student Student row being removed.
			 * @return array
			 */
			private static function preserve_team_challenge_score_snapshot( $state, $student ) {
				$key = self::team_challenge_score_ledger_key( $student );
				if ( '' === $key ) {
					return $state;
				}

				$snapshot = array(
					'points'         => absint( $student['points'] ?? 0 ),
					'attempts'       => absint( $student['attempts'] ?? 0 ),
					'questionsAsked' => absint( $student['questionsAsked'] ?? ( $student['attempts'] ?? 0 ) ),
					'avatarUrl'      => esc_url_raw( $student['avatarUrl'] ?? '' ),
					'avatarFullUrl'  => esc_url_raw( $student['avatarFullUrl'] ?? '' ),
					'avatarSource'   => sanitize_key( $student['avatarSource'] ?? '' ),
					'avatarSeed'     => sanitize_key( $student['avatarSeed'] ?? '' ),
					'emailHash'      => sanitize_text_field( $student['emailHash'] ?? '' ),
					'updatedAt'      => current_time( 'mysql' ),
				);

				if ( ! isset( $state['scoreLedger'] ) || ! is_array( $state['scoreLedger'] ) ) {
					$state['scoreLedger'] = array();
				}

				if ( empty( $snapshot['points'] ) && empty( $snapshot['attempts'] ) && empty( $snapshot['questionsAsked'] ) ) {
					unset( $state['scoreLedger'][ $key ] );
				} else {
					$state['scoreLedger'][ $key ] = $snapshot;
				}

				return $state;
			}

			/**
			 * Restore scoring history when a participant jumps back in.
			 *
			 * @param array $state   Team Challenge state.
			 * @param array $student Student row being added.
			 * @return array
			 */
			private static function restore_team_challenge_score_snapshot( $state, $student ) {
				$key = self::team_challenge_score_ledger_key( $student );
				if ( '' === $key || empty( $state['scoreLedger'][ $key ] ) || ! is_array( $state['scoreLedger'][ $key ] ) ) {
					return $student;
				}

				$snapshot = $state['scoreLedger'][ $key ];

				$student['points']         = max( absint( $student['points'] ?? 0 ), absint( $snapshot['points'] ?? 0 ) );
				$student['attempts']       = max( absint( $student['attempts'] ?? 0 ), absint( $snapshot['attempts'] ?? 0 ) );
				$student['questionsAsked'] = max( absint( $student['questionsAsked'] ?? 0 ), absint( $snapshot['questionsAsked'] ?? 0 ) );

				foreach ( array( 'avatarUrl', 'avatarFullUrl', 'avatarSource', 'avatarSeed', 'emailHash' ) as $field ) {
					if ( empty( $student[ $field ] ) && ! empty( $snapshot[ $field ] ) ) {
						$student[ $field ] = $snapshot[ $field ];
					}
				}

				return $student;
			}

			/**
			 * Return a stable score-ledger key for a participant.
			 *
			 * @param array $student Student row.
			 * @return string
			 */
			private static function team_challenge_score_ledger_key( $student ) {
				$id = sanitize_key( $student['id'] ?? '' );
				if ( '' !== $id ) {
					return $id;
				}

				if ( ! empty( $student['emailHash'] ) ) {
					return 'email-' . substr( sanitize_key( $student['emailHash'] ), 0, 40 );
				}

				if ( ! empty( $student['userId'] ) ) {
					return 'u' . absint( $student['userId'] );
				}

				return '';
			}

			/**
			 * Return the index of the team with the fewest students.
			 *
			 * @param array $state Team Challenge state.
			 * @return int|null
		 */
			private static function get_smallest_team_index( $state ) {
			$smallest_index = null;
			$smallest_count = PHP_INT_MAX;
			foreach ( $state['teams'] ?? array() as $team_index => $team ) {
				$count = count( $team['students'] ?? array() );
				if ( $count < $smallest_count ) {
					$smallest_index = $team_index;
					$smallest_count = $count;
				}
			}

				return $smallest_index;
			}

			/**
			 * Append a sanitized short class chat message to live state.
			 *
			 * @param array  $state      Team Challenge state.
			 * @param string $message    Message text.
			 * @param string $target     Recipient selector.
			 * @param string $guest_id   Browser guest ID.
			 * @param string $first_name Guest first name.
			 * @param string $last_name  Guest last name.
			 * @return array
			 */
			private static function add_team_challenge_chat_message( $state, $message, $target, $guest_id, $first_name, $last_name ) {
				$user = wp_get_current_user();
				$is_host = current_user_can( 'manage_options' );
				$from_name = 'Guest';
				$from_id = '' !== $guest_id ? sanitize_key( $guest_id ) : 'guest';

				if ( $user && ! empty( $user->ID ) ) {
					$from_id = 'u' . absint( $user->ID );
					$from_name = $is_host ? 'Host' : sanitize_text_field( $user->display_name ?: $user->user_login );
				} else {
					$guest_name = trim( sanitize_text_field( $first_name ) . ' ' . sanitize_text_field( $last_name ) );
					if ( '' !== $guest_name ) {
						$from_name = $guest_name;
					}
				}

				$target = self::sanitize_team_challenge_chat_target( $target );
				$messages = self::sanitize_team_challenge_chat_messages( $state['chatMessages'] ?? array() );
				$messages[] = array(
					'id'          => uniqid( 'chat_', false ),
					'fromId'      => $from_id,
					'fromName'    => $from_name,
					'fromRole'    => $is_host ? 'host' : 'student',
					'target'      => $target,
					'targetLabel' => self::team_challenge_chat_target_label( $state, $target ),
					'message'     => substr( sanitize_text_field( $message ), 0, 180 ),
					'createdAt'   => current_time( 'mysql' ),
				);

				$state['chatMessages'] = array_slice( $messages, -40 );
				$state['lastEvent'] = array(
					'type'      => 'send_chat_message',
					'message'   => $from_name . ' sent a class message.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );
	
				return $state;
			}

			/**
			 * Create a low-privilege WordPress student account, sign it in, and join the roster.
			 *
			 * @param WP_REST_Request $request REST request.
			 * @param array           $state   Current Team Challenge state.
			 * @return WP_REST_Response|WP_Error
			 */
			private static function create_team_challenge_account_and_join( $request, $state ) {
				if ( is_user_logged_in() ) {
					$user = wp_get_current_user();
					$state = self::team_challenge_join_current_user( $state, $user );
					self::persist_team_challenge_state( $state, 'join_in' );
					return new WP_REST_Response( self::add_team_challenge_client_viewer_data( $state ), 200 );
				}

				$first_name = sanitize_text_field( wp_unslash( (string) $request->get_param( 'firstName' ) ) );
				$last_name  = sanitize_text_field( wp_unslash( (string) $request->get_param( 'lastName' ) ) );
				$email      = sanitize_email( wp_unslash( (string) $request->get_param( 'email' ) ) );
				$password   = (string) $request->get_param( 'password' );

				if ( '' === trim( $first_name ) || '' === trim( $last_name ) || ! is_email( $email ) ) {
					return new WP_Error( 'mmed_team_challenge_account_required', 'Enter first name, last name, and a valid email to create your account.', array( 'status' => 400 ) );
				}

				if ( 8 > strlen( $password ) ) {
					return new WP_Error( 'mmed_team_challenge_password_short', 'Use a password with at least 8 characters.', array( 'status' => 400 ) );
				}

				if ( email_exists( $email ) ) {
					return new WP_Error( 'mmed_team_challenge_email_exists', 'An account already exists for that email. Sign in or enter as guest for this round.', array( 'status' => 409 ) );
				}

				$rate_key = 'mmed_live_drills_v3_account_' . md5( strtolower( $email ) . '|' . self::get_client_ip_fingerprint() );
				if ( get_transient( $rate_key ) ) {
					return new WP_Error( 'mmed_team_challenge_account_rate_limited', 'Account creation is cooling down. Enter as guest for this round or try again shortly.', array( 'status' => 429 ) );
				}

				$user_login = self::unique_team_challenge_username( $email, $first_name, $last_name );
				$user_id    = wp_create_user( $user_login, $password, $email );

				if ( is_wp_error( $user_id ) ) {
					return new WP_Error( 'mmed_team_challenge_account_failed', 'Could not create the account. Enter as guest for this round.', array( 'status' => 500 ) );
				}

				wp_update_user(
					array(
						'ID'           => $user_id,
						'first_name'   => $first_name,
						'last_name'    => $last_name,
						'display_name' => trim( $first_name . ' ' . $last_name ),
					)
				);

				$user = new WP_User( $user_id );
				$user->set_role( 'subscriber' );
				update_user_meta( $user_id, 'mmed_live_drills_v3_created_at', current_time( 'mysql' ) );

				set_transient( $rate_key, 1, 5 * MINUTE_IN_SECONDS );
				wp_set_current_user( $user_id );
				wp_set_auth_cookie( $user_id, true, is_ssl() );
				do_action( 'wp_login', $user->user_login, $user );

				$state = self::team_challenge_join_current_user( $state, $user );
				$state['lastEvent'] = array(
					'type'      => 'create_account_join',
					'message'   => sanitize_text_field( $user->display_name ) . ' created an account and joined live.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['updatedAt'] = current_time( 'mysql' );

				self::persist_team_challenge_state( $state, 'create_account_join' );

				return new WP_REST_Response( self::add_team_challenge_client_viewer_data( $state ), 200 );
			}

		/**
		 * Add per-request viewer metadata without persisting it to shared state.
		 *
		 * @param array $state Team Challenge state.
		 * @return array
		 */
			private static function add_team_challenge_client_viewer_data( $state ) {
				if ( ! is_array( $state ) ) {
					$state = array();
				}

				$state['currentUserId'] = get_current_user_id();

				return $state;
			}

			/**
			 * Build a collision-safe WordPress username for inline beta registration.
			 *
			 * @param string $email      Student email.
			 * @param string $first_name First name.
			 * @param string $last_name  Last name.
			 * @return string
			 */
			private static function unique_team_challenge_username( $email, $first_name, $last_name ) {
				$email_local = strtolower( (string) strtok( $email, '@' ) );
				$base        = sanitize_user( $email_local, true );
				if ( 3 > strlen( $base ) ) {
					$base = sanitize_user( strtolower( $first_name . '.' . $last_name ), true );
				}
				if ( 3 > strlen( $base ) ) {
					$base = 'student';
				}

				$base     = substr( $base, 0, 38 );
				$username = $base;
				$suffix   = 1;

				while ( username_exists( $username ) ) {
					$suffix++;
					$username = substr( $base, 0, 34 ) . '-' . $suffix;
				}

				return $username;
			}

			/**
			 * Return a short-lived non-secret client fingerprint for throttling.
			 *
			 * @return string
			 */
			private static function get_client_ip_fingerprint() {
				$ip = '';
				if ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
					$ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
				}

				return hash( 'sha256', $ip );
			}

			/**
			 * Build countdown state from an admin countdown request.
			 *
			 * @param WP_REST_Request $request REST request.
			 * @param array           $current Current countdown state.
			 * @return array
			 */
			private static function team_challenge_countdown_from_request( $request, $current ) {
				$command  = sanitize_key( $request->get_param( 'command' ) );
				$duration = min( 10800, max( 0, absint( $request->get_param( 'durationSeconds' ) ) ) );
				$current  = self::sanitize_team_challenge_countdown( $current );

				if ( 'start' === $command ) {
					if ( 0 === $duration ) {
						$duration = max( 1, absint( $current['durationSeconds'] ?? 300 ) );
					}
					return self::sanitize_team_challenge_countdown(
						array(
							'durationSeconds' => $duration,
							'endsAtEpoch'     => time() + $duration,
							'isRunning'       => true,
							'updatedAt'       => current_time( 'mysql' ),
						)
					);
				}

				if ( 'stop' === $command ) {
					if ( 0 === $duration && ! empty( $current['isRunning'] ) && ! empty( $current['endsAtEpoch'] ) ) {
						$duration = max( 0, absint( $current['endsAtEpoch'] ) - time() );
					}
					return self::sanitize_team_challenge_countdown(
						array(
							'durationSeconds' => $duration,
							'endsAtEpoch'     => 0,
							'isRunning'       => false,
							'updatedAt'       => current_time( 'mysql' ),
						)
					);
				}

				if ( 'reset' === $command ) {
					return self::sanitize_team_challenge_countdown( array() );
				}

				return self::sanitize_team_challenge_countdown(
					array(
						'durationSeconds' => $duration,
						'endsAtEpoch'     => 0,
						'isRunning'       => false,
						'updatedAt'       => current_time( 'mysql' ),
					)
				);
			}

			/**
			 * Sanitize countdown state shared from host to students.
			 *
			 * @param array $countdown Raw countdown state.
			 * @return array
			 */
		private static function sanitize_team_challenge_countdown( $countdown ) {
			$normalized = MMED_Live_Drills_State_Contract::normalize_countdown( $countdown );
			if ( '' === $normalized['updatedAt'] ) {
				$normalized['updatedAt'] = current_time( 'mysql' );
			}

			return $normalized;
		}

			/**
			 * Sanitize stored chat messages.
			 *
			 * @param array $messages Raw messages.
			 * @return array
			 */
			private static function sanitize_team_challenge_chat_messages( $messages ) {
				$clean = array();
				if ( ! is_array( $messages ) ) {
					return $clean;
				}

				foreach ( array_slice( $messages, -40 ) as $message ) {
					if ( ! is_array( $message ) ) {
						continue;
					}
					$text = substr( sanitize_text_field( $message['message'] ?? '' ), 0, 180 );
					if ( '' === trim( $text ) ) {
						continue;
					}
					$clean[] = array(
						'id'          => sanitize_key( $message['id'] ?? uniqid( 'chat_', false ) ),
						'fromId'      => sanitize_text_field( $message['fromId'] ?? '' ),
						'fromName'    => sanitize_text_field( $message['fromName'] ?? 'Student' ),
						'fromRole'    => sanitize_key( $message['fromRole'] ?? 'student' ),
						'target'      => self::sanitize_team_challenge_chat_target( $message['target'] ?? 'all' ),
						'targetLabel' => sanitize_text_field( $message['targetLabel'] ?? 'Everyone' ),
						'message'     => $text,
						'createdAt'   => sanitize_text_field( $message['createdAt'] ?? '' ),
					);
				}

				return $clean;
			}

			/**
			 * Sanitize chat recipient selector.
			 *
			 * @param string $target Raw target.
			 * @return string
			 */
			private static function sanitize_team_challenge_chat_target( $target ) {
				$target = sanitize_text_field( (string) $target );
				if ( in_array( $target, array( 'all', 'host', 'active', 'team:blue', 'team:red', 'team:mine' ), true ) ) {
					return $target;
				}
				if ( 0 === strpos( $target, 'student:' ) ) {
					return 'student:' . sanitize_key( substr( $target, 8 ) );
				}
				return 'all';
			}

			/**
			 * Return a display label for a chat target.
			 *
			 * @param array  $state  Team Challenge state.
			 * @param string $target Sanitized target.
			 * @return string
			 */
			private static function team_challenge_chat_target_label( $state, $target ) {
				if ( 'host' === $target ) {
					return 'Host';
				}
				if ( 'active' === $target ) {
					return 'Active student';
				}
				if ( 'team:blue' === $target ) {
					return 'Beta team';
				}
				if ( 'team:red' === $target ) {
					return 'Red team';
				}
				if ( 'team:mine' === $target ) {
					return 'My team';
				}
				if ( 0 === strpos( $target, 'student:' ) ) {
					$student = self::get_team_challenge_student_anywhere( $state, substr( $target, 8 ) );
					return $student ? sanitize_text_field( $student['name'] ?? 'Student' ) : 'Student';
				}
				return 'Everyone';
			}

			/**
			 * Auto-select the next student while alternating teams and balancing question counts.
			 *
			 * @param array $state Team Challenge state.
			 * @param string $mode Selection mode.
			 * @return array
			 */
			private static function auto_select_next_team_challenge_student( $state, $mode = 'ordered' ) {
			$preferred_team_id = sanitize_key( $state['nextTeamId'] ?? 'red' );
			$team_index        = self::get_team_challenge_team_index( $state, $preferred_team_id );
			if ( null === $team_index || empty( $state['teams'][ $team_index ]['students'] ) ) {
				$team_index = self::get_first_nonempty_team_index( $state );
			}

			if ( null === $team_index ) {
				return $state;
			}

			$students = $state['teams'][ $team_index ]['students'];
			$minimum  = null;
			foreach ( $students as $student ) {
				$count = absint( $student['questionsAsked'] ?? ( $student['attempts'] ?? 0 ) );
				$minimum = null === $minimum ? $count : min( $minimum, $count );
			}

			$active_id = sanitize_key( $state['active']['studentId'] ?? '' );

				$candidates = array();
				foreach ( $students as $student ) {
					$count = absint( $student['questionsAsked'] ?? ( $student['attempts'] ?? 0 ) );
					if ( $count === $minimum ) {
						$candidates[] = $student;
					}
				}

				$chosen = $candidates[0] ?? $students[0];
				if ( 'fair_random' === $mode && count( $candidates ) > 1 ) {
					$chosen = $candidates[ wp_rand( 0, count( $candidates ) - 1 ) ];
				} elseif ( count( $candidates ) > 1 && sanitize_key( $chosen['id'] ?? '' ) === $active_id ) {
					$chosen = $candidates[1];
				}

			$team_id = sanitize_key( $state['teams'][ $team_index ]['id'] ?? '' );
			$state['active'] = array(
				'teamId'    => $team_id,
				'studentId' => sanitize_key( $chosen['id'] ?? '' ),
			);
			$state['nextTeamId'] = self::get_team_challenge_next_team_id( $team_id );
			$state['lastEvent']  = array(
				'type'      => 'auto_select_next',
				'message'   => sanitize_text_field( $chosen['name'] ?? 'Student' ) . ' is up next for ' . sanitize_text_field( $state['teams'][ $team_index ]['name'] ?? 'Team' ) . '.',
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Return the next team ID for alternating Auto next.
		 *
		 * @param string $team_id Current team ID.
		 * @return string
		 */
		private static function get_team_challenge_next_team_id( $team_id ) {
			return 'red' === $team_id ? 'blue' : 'red';
		}

		/**
		 * Return the team index for a given ID.
		 *
		 * @param array  $state   Team Challenge state.
		 * @param string $team_id Team ID.
		 * @return int|null
		 */
		private static function get_team_challenge_team_index( $state, $team_id ) {
			foreach ( $state['teams'] ?? array() as $team_index => $team ) {
				if ( sanitize_key( $team['id'] ?? '' ) === $team_id ) {
					return $team_index;
				}
			}

			return null;
		}

		/**
		 * Return the first non-empty team index.
		 *
		 * @param array $state Team Challenge state.
		 * @return int|null
		 */
		private static function get_first_nonempty_team_index( $state ) {
			foreach ( $state['teams'] ?? array() as $team_index => $team ) {
				if ( ! empty( $team['students'] ) ) {
					return $team_index;
				}
			}

			return null;
		}

	/**
	 * Move the active student to the opposite team.
	 *
	 * @param array  $state      Current Team Challenge state.
	 * @param string $team_id    Current team ID.
	 * @param string $student_id Active student ID.
	 * @return array
	 */
	private static function move_team_challenge_student( $state, $team_id, $student_id ) {
		$source_index = null;
		$target_index = null;
		$moved_student = null;

		foreach ( $state['teams'] ?? array() as $team_index => $team ) {
			$current_team_id = sanitize_key( $team['id'] ?? '' );
			if ( $current_team_id === $team_id ) {
				$source_index = $team_index;
			} elseif ( null === $target_index ) {
				$target_index = $team_index;
			}
		}

		if ( null === $source_index || null === $target_index ) {
			return $state;
		}

		foreach ( $state['teams'][ $source_index ]['students'] as $student_index => $student ) {
			if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
				continue;
			}

			$moved_student = $student;
			array_splice( $state['teams'][ $source_index ]['students'], $student_index, 1 );
			break;
		}

		if ( ! is_array( $moved_student ) ) {
			return $state;
		}

		$state['teams'][ $source_index ]['students'] = array_values( $state['teams'][ $source_index ]['students'] );
		$state['teams'][ $target_index ]['students'][] = $moved_student;

		$target_team_id = sanitize_key( $state['teams'][ $target_index ]['id'] ?? '' );
		$target_team_name = sanitize_text_field( $state['teams'][ $target_index ]['name'] ?? 'other team' );
		$student_name = sanitize_text_field( $moved_student['name'] ?? 'Student' );

			$state['active'] = array(
				'teamId'    => $target_team_id,
				'studentId' => sanitize_key( $moved_student['id'] ?? '' ),
			);
			$state['nextTeamId'] = self::get_team_challenge_next_team_id( $target_team_id );
			$state['winner']     = null;
			$state = self::recalculate_team_challenge_scores( $state );
		$state['lastEvent'] = array(
			'type'      => 'move_student',
			'message'   => $student_name . ' moved to ' . $target_team_name . '.',
			'updatedAt' => current_time( 'mysql' ),
		);
		$state['updatedAt'] = current_time( 'mysql' );

		return $state;
	}

	/**
	 * Assign a student to a specific team.
	 *
	 * @param array  $state          Current Team Challenge state.
	 * @param string $student_id     Student ID.
	 * @param string $target_team_id Target team ID.
	 * @return array
	 */
	private static function assign_team_challenge_student( $state, $student_id, $target_team_id ) {
		$source_index = null;
		$target_index = null;
		$moved_student = null;

		foreach ( $state['teams'] ?? array() as $team_index => $team ) {
			$current_team_id = sanitize_key( $team['id'] ?? '' );
			if ( $current_team_id === $target_team_id ) {
				$target_index = $team_index;
				break;
			}
		}

		foreach ( $state['teams'] ?? array() as $team_index => $team ) {
			foreach ( $team['students'] ?? array() as $student_index => $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
					continue;
				}

				$source_index  = $team_index;
				$moved_student = $student;
				array_splice( $state['teams'][ $team_index ]['students'], $student_index, 1 );
				break 2;
			}
		}

		if ( null === $target_index || ! is_array( $moved_student ) ) {
			return $state;
		}

		if ( null !== $source_index ) {
			$state['teams'][ $source_index ]['students'] = array_values( $state['teams'][ $source_index ]['students'] );
		}

		$state['teams'][ $target_index ]['students'][] = $moved_student;
		$state = self::recalculate_team_challenge_scores( $state );

		$target_team_name = sanitize_text_field( $state['teams'][ $target_index ]['name'] ?? 'team' );
		$student_name = sanitize_text_field( $moved_student['name'] ?? 'Student' );
			$state['active'] = array(
				'teamId'    => sanitize_key( $state['teams'][ $target_index ]['id'] ?? '' ),
				'studentId' => sanitize_key( $moved_student['id'] ?? '' ),
			);
			$state['nextTeamId'] = self::get_team_challenge_next_team_id( sanitize_key( $state['teams'][ $target_index ]['id'] ?? '' ) );
			$state['winner']     = null;
			$state['lastEvent'] = array(
			'type'      => 'assign_student',
			'message'   => $student_name . ' assigned to ' . $target_team_name . '.',
			'updatedAt' => current_time( 'mysql' ),
		);
		$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Declare a winner and mark the top scorer on that team as MVP.
		 *
		 * @param array  $state   Team Challenge state.
		 * @param string $team_id Winning team ID.
		 * @return array
		 */
		private static function declare_team_challenge_winner( $state, $team_id ) {
			$team_index = self::get_team_challenge_team_index( $state, $team_id );
			if ( null === $team_index ) {
				return $state;
			}

			$team = $state['teams'][ $team_index ];
			$mvp  = self::get_team_challenge_mvp( $team );
			$state['winner'] = array(
				'teamId'       => sanitize_key( $team['id'] ?? '' ),
				'teamName'     => sanitize_text_field( $team['name'] ?? 'Team' ),
				'mvpStudentId' => $mvp ? sanitize_key( $mvp['id'] ?? '' ) : '',
				'mvpName'      => $mvp ? sanitize_text_field( $mvp['name'] ?? '' ) : '',
				'updatedAt'    => current_time( 'mysql' ),
			);
			$state['lastEvent'] = array(
				'type'      => 'declare_winner',
				'message'   => sanitize_text_field( $team['name'] ?? 'Team' ) . ' wins.' . ( $mvp ? ' MVP: ' . sanitize_text_field( $mvp['name'] ?? 'Student' ) . '.' : '' ),
				'updatedAt' => current_time( 'mysql' ),
			);
			$state['updatedAt'] = current_time( 'mysql' );

			return $state;
		}

		/**
		 * Return the highest scoring student on a team.
		 *
		 * @param array $team Team row.
		 * @return array|null
		 */
		private static function get_team_challenge_mvp( $team ) {
			$winner = null;
			foreach ( $team['students'] ?? array() as $student ) {
				if ( null === $winner || absint( $student['points'] ?? 0 ) > absint( $winner['points'] ?? 0 ) ) {
					$winner = $student;
				}
			}

			return $winner && 0 < absint( $winner['points'] ?? 0 ) ? $winner : null;
		}

	/**
	 * Recalculate team totals from student points.
	 *
	 * @param array $state Current Team Challenge state.
	 * @return array
	 */
	private static function recalculate_team_challenge_scores( $state ) {
		foreach ( $state['teams'] as $team_index => $team ) {
			$total = 0;
			foreach ( $team['students'] ?? array() as $student ) {
				$total += absint( $student['points'] ?? 0 );
			}
			$state['teams'][ $team_index ]['score'] = $total;
		}

		return $state;
	}

	/**
	 * Reset only score fields for the current live room.
	 *
	 * Keeps roster, teams, active student, meeting, countdown, chat, and session metadata intact.
	 *
	 * @param array $state Team Challenge state.
	 * @return array
	 */
	private static function reset_team_challenge_scores( $state ) {
		if ( empty( $state['teams'] ) || ! is_array( $state['teams'] ) ) {
			$state['teams'] = array();
		}

		foreach ( $state['teams'] as $team_index => $team ) {
			$state['teams'][ $team_index ]['score'] = 0;
			foreach ( $team['students'] ?? array() as $student_index => $student ) {
				$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = 0;
				$state['teams'][ $team_index ]['students'][ $student_index ]['attempts'] = 0;
				$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = 0;
			}
		}

		if ( empty( $state['active'] ) || ! is_array( $state['active'] ) || ! self::team_challenge_student_exists_anywhere( $state, sanitize_key( $state['active']['studentId'] ?? '' ) ) ) {
			$state['active'] = self::get_first_team_challenge_active( $state['teams'] ?? array() );
		}

		$state['winner'] = null;
		unset( $state['lastScore'] );
		unset( $state['scoreLedger'] );
		$state['lastEvent'] = array(
			'type'      => 'reset',
			'message'   => 'Scores reset to zero.',
			'updatedAt' => current_time( 'mysql' ),
		);
		$state['updatedAt'] = current_time( 'mysql' );

		return $state;
	}

	/**
	 * Determine whether a student exists in a team.
	 *
	 * @param array  $state      Team Challenge state.
	 * @param string $team_id    Team ID.
	 * @param string $student_id Student ID.
	 * @return bool
	 */
	private static function team_challenge_student_exists( $state, $team_id, $student_id ) {
		return null !== self::get_team_challenge_student( $state, $team_id, $student_id );
	}

	/**
	 * Determine whether a team exists.
	 *
	 * @param array  $state   Team Challenge state.
	 * @param string $team_id Team ID.
	 * @return bool
	 */
	private static function team_challenge_team_exists( $state, $team_id ) {
		foreach ( $state['teams'] ?? array() as $team ) {
			if ( sanitize_key( $team['id'] ?? '' ) === $team_id ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Determine whether a student exists in any team.
	 *
	 * @param array  $state      Team Challenge state.
	 * @param string $student_id Student ID.
	 * @return bool
	 */
		private static function team_challenge_student_exists_anywhere( $state, $student_id ) {
			foreach ( $state['teams'] ?? array() as $team ) {
				foreach ( $team['students'] ?? array() as $student ) {
					if ( sanitize_key( $student['id'] ?? '' ) === $student_id ) {
						return true;
				}
			}
		}

			return false;
		}

		/**
		 * Return a student row from any team.
		 *
		 * @param array  $state      Team Challenge state.
		 * @param string $student_id Student ID.
		 * @return array|null
		 */
		private static function get_team_challenge_student_anywhere( $state, $student_id ) {
			$student_id = sanitize_key( $student_id );
			foreach ( $state['teams'] ?? array() as $team ) {
				foreach ( $team['students'] ?? array() as $student ) {
					if ( sanitize_key( $student['id'] ?? '' ) === $student_id ) {
						return $student;
					}
				}
			}

			return null;
		}

		/**
		 * Return a student row from Team Challenge state.
	 *
	 * @param array  $state      Team Challenge state.
	 * @param string $team_id    Team ID.
	 * @param string $student_id Student ID.
	 * @return array|null
	 */
	private static function get_team_challenge_student( $state, $team_id, $student_id ) {
		foreach ( $state['teams'] ?? array() as $team ) {
			if ( sanitize_key( $team['id'] ?? '' ) !== $team_id ) {
				continue;
			}

			foreach ( $team['students'] ?? array() as $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) === $student_id ) {
					return $student;
				}
			}
		}

		return null;
	}

	/**
	 * Apply a correct/incorrect result to the active student and team.
	 *
	 * @param array  $state      Team Challenge state.
	 * @param string $team_id    Team ID.
	 * @param string $student_id Student ID.
	 * @param bool   $is_correct Whether the answer was correct.
	 * @return array
	 */
	private static function apply_team_challenge_score( $state, $team_id, $student_id, $is_correct ) {
		foreach ( $state['teams'] as $team_index => $team ) {
			if ( sanitize_key( $team['id'] ?? '' ) !== $team_id ) {
				continue;
			}

			foreach ( $team['students'] as $student_index => $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
					continue;
				}

					$state['teams'][ $team_index ]['students'][ $student_index ]['attempts']       = absint( $student['attempts'] ?? 0 ) + 1;
					$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = absint( $student['questionsAsked'] ?? ( $student['attempts'] ?? 0 ) ) + 1;

				if ( $is_correct ) {
					$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = absint( $student['points'] ?? 0 ) + 1;
					$state['teams'][ $team_index ]['score'] = absint( $team['score'] ?? 0 ) + 1;
				}

					$name = sanitize_text_field( $student['name'] ?? 'Student' );
					$state['lastScore'] = array(
						'teamId'    => $team_id,
						'studentId' => $student_id,
						'correct'   => (bool) $is_correct,
						'updatedAt' => current_time( 'mysql' ),
					);
					$state['lastEvent'] = array(
						'type'      => $is_correct ? 'correct' : 'missed',
						'message'   => $is_correct ? $name . ' scored for ' . sanitize_text_field( $team['name'] ?? 'Team' ) . '.' : $name . ' missed. No point awarded.',
						'updatedAt' => current_time( 'mysql' ),
					);
					$state['nextTeamId'] = self::get_team_challenge_next_team_id( $team_id );
					$state['winner']     = null;
					$state['updatedAt'] = current_time( 'mysql' );

				return $state;
			}
		}

		return $state;
	}

	/**
	 * Undo the most recent scoring click, or the active student's score if no last score exists.
	 *
	 * @param array $state Team Challenge state.
	 * @return array
	 */
	private static function undo_team_challenge_score( $state ) {
		$target = is_array( $state['lastScore'] ?? null ) ? $state['lastScore'] : array();
		$has_last_score = array_key_exists( 'correct', $target );
		$should_decrement_point = $has_last_score ? (bool) $target['correct'] : true;
		$team_id = sanitize_key( $target['teamId'] ?? '' );
		$student_id = sanitize_key( $target['studentId'] ?? '' );

		if ( '' === $team_id || '' === $student_id || ! self::team_challenge_student_exists( $state, $team_id, $student_id ) ) {
			$active = is_array( $state['active'] ?? null ) ? $state['active'] : array();
			$team_id = sanitize_key( $active['teamId'] ?? '' );
			$student_id = sanitize_key( $active['studentId'] ?? '' );
		}

		foreach ( $state['teams'] as $team_index => $team ) {
			if ( sanitize_key( $team['id'] ?? '' ) !== $team_id ) {
				continue;
			}

			foreach ( $team['students'] as $student_index => $student ) {
				if ( sanitize_key( $student['id'] ?? '' ) !== $student_id ) {
					continue;
				}

				$name = sanitize_text_field( $student['name'] ?? 'Student' );
				$points = absint( $student['points'] ?? 0 );
				$attempts = absint( $student['attempts'] ?? 0 );
				$questions = absint( $student['questionsAsked'] ?? $attempts );

				if ( 0 === $points && 0 === $attempts && 0 === $questions ) {
					$state['lastEvent'] = array(
						'type'      => 'undo_score',
						'message'   => 'No score to undo for ' . $name . '.',
						'updatedAt' => current_time( 'mysql' ),
					);
					$state['updatedAt'] = current_time( 'mysql' );
					unset( $state['lastScore'] );
					return $state;
				}

				if ( $should_decrement_point && 0 < $points ) {
					$state['teams'][ $team_index ]['students'][ $student_index ]['points'] = $points - 1;
				}
				if ( 0 < $attempts ) {
					$state['teams'][ $team_index ]['students'][ $student_index ]['attempts'] = $attempts - 1;
				}
				if ( 0 < $questions ) {
					$state['teams'][ $team_index ]['students'][ $student_index ]['questionsAsked'] = $questions - 1;
				}

				$state = self::recalculate_team_challenge_scores( $state );
				$state['lastEvent'] = array(
					'type'      => 'undo_score',
					'message'   => 'Score corrected for ' . $name . '.',
					'updatedAt' => current_time( 'mysql' ),
				);
				$state['nextTeamId'] = self::get_team_challenge_next_team_id( $team_id );
				$state['winner']     = null;
				$state['updatedAt']  = current_time( 'mysql' );
				unset( $state['lastScore'] );

				return $state;
			}
		}

		return $state;
	}

	/**
	 * Build display-safe initials from a name.
	 *
	 * @param string $name Display name.
	 * @return string
	 */
	private static function get_initials( $name ) {
		$parts    = preg_split( '/\s+/', trim( (string) $name ) );
		$initials = '';

		foreach ( is_array( $parts ) ? $parts : array() as $part ) {
			if ( '' === $part ) {
				continue;
			}
			$initials .= strtoupper( substr( sanitize_text_field( $part ), 0, 1 ) );
			if ( 2 <= strlen( $initials ) ) {
				break;
			}
		}

		return '' !== $initials ? $initials : 'S';
	}

	/**
	 * Build a cache-busted plugin asset URL.
	 *
	 * @param string $relative_path Asset path relative to plugin root.
	 * @return string
	 */
	private static function asset_url( $relative_path ) {
		$file_path = MMED_HUB_PATH . ltrim( $relative_path, '/' );
		$version   = file_exists( $file_path ) ? (string) filemtime( $file_path ) : MMED_HUB_VERSION;

		return add_query_arg( 'ver', rawurlencode( $version ), MMED_HUB_URL . ltrim( $relative_path, '/' ) );
	}

	/**
	 * Return the public static Team Challenge snapshot URL.
	 *
	 * @return string
	 */
	private static function team_challenge_snapshot_url() {
		$location = self::team_challenge_snapshot_location();

		return esc_url_raw( $location['url'] ?? '' );
	}

	/**
	 * Return path and URL for the static Team Challenge snapshot.
	 *
	 * @return array{path:string,url:string}
	 */
	private static function team_challenge_snapshot_location() {
		$upload = wp_upload_dir( null, false );
		if ( ! empty( $upload['error'] ) || empty( $upload['basedir'] ) || empty( $upload['baseurl'] ) ) {
			return array(
				'path' => '',
				'url'  => '',
			);
		}

		return array(
			'path' => trailingslashit( $upload['basedir'] ) . self::TEAM_CHALLENGE_SNAPSHOT_RELATIVE_PATH,
			'url'  => trailingslashit( $upload['baseurl'] ) . self::TEAM_CHALLENGE_SNAPSHOT_RELATIVE_PATH,
		);
	}

	/**
	 * Return the private snapshot path outside the public document root.
	 *
	 * @return string
	 */
	private static function team_challenge_private_snapshot_path() {
		$override = getenv( 'MMED_V3_PRIVATE_STATE_PATH' );
		if ( is_string( $override ) && '' !== trim( $override ) ) {
			return $override;
		}

		return trailingslashit( dirname( untrailingslashit( ABSPATH ) ) ) . 'web/missionmed-private/' . MMED_Live_Drills_State_Contract::PRIVATE_SNAPSHOT_RELATIVE_PATH;
	}

	/**
	 * Read the private authoritative snapshot mirror.
	 *
	 * @return array
	 */
	private static function read_team_challenge_private_snapshot() {
		return MMED_Live_Drills_State_Contract::read_json( self::team_challenge_private_snapshot_path() );
	}

	/**
	 * Read the anonymous-safe public Team Challenge snapshot.
	 *
	 * @return array
	 */
	private static function read_team_challenge_state_snapshot() {
		$location = self::team_challenge_snapshot_location();
		$path     = $location['path'] ?? '';
		if ( '' === $path || ! file_exists( $path ) || ! is_readable( $path ) ) {
			return array();
		}

		$raw = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( ! is_string( $raw ) || '' === trim( $raw ) ) {
			return array();
		}

		$decoded = json_decode( $raw, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	/**
	 * Return a comparable millisecond timestamp for state conflict resolution.
	 *
	 * @param array $state Team Challenge state.
	 * @return int
	 */
	private static function team_challenge_state_timestamp_ms( $state ) {
		if ( ! is_array( $state ) ) {
			return 0;
		}
		if ( ! empty( $state['snapshotGeneratedAtMs'] ) ) {
			return absint( $state['snapshotGeneratedAtMs'] );
		}
		if ( ! empty( $state['updatedAt'] ) ) {
			$timestamp = strtotime( (string) $state['updatedAt'] );
			return $timestamp ? $timestamp * 1000 : 0;
		}

		return 0;
	}

	/**
	 * Write an anonymous-safe state snapshot for direct low-latency reads.
	 *
	 * @param array $state Team Challenge state.
	 * @return bool
	 */
	private static function write_team_challenge_state_snapshot( $state ) {
		$location = self::team_challenge_snapshot_location();
		$path     = $location['path'] ?? '';
		if ( '' === $path ) {
			return false;
		}

		$dir = dirname( $path );
		if ( ! wp_mkdir_p( $dir ) ) {
			return false;
		}

		$snapshot = MMED_Live_Drills_State_Contract::public_view( $state );

		return MMED_Live_Drills_State_Contract::write_json_atomic( $path, $snapshot, 0644 );
	}

	/**
	 * Write the full private snapshot mirror.
	 *
	 * @param array $state Full state.
	 * @return bool
	 */
	private static function write_team_challenge_private_snapshot( $state ) {
		return MMED_Live_Drills_State_Contract::write_json_atomic(
			self::team_challenge_private_snapshot_path(),
			$state,
			0640
		);
	}

	/**
	 * Restore exact prior file bytes after a partial persistence failure.
	 *
	 * @param string      $path Path.
	 * @param string|null $bytes Prior bytes, or null when the file did not exist.
	 * @param int         $mode File mode.
	 * @return bool
	 */
	private static function restore_team_challenge_snapshot_bytes( $path, $bytes, $mode ) {
		if ( null === $bytes ) {
			return ! file_exists( $path ) || unlink( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}
		$directory = dirname( $path );
		if ( ! wp_mkdir_p( $directory ) ) {
			return false;
		}
		$tmp_path = $path . '.restore.' . wp_generate_password( 12, false, false );
		if ( false === file_put_contents( $tmp_path, $bytes, LOCK_EX ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			return false;
		}
		@chmod( $tmp_path, $mode ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! rename( $tmp_path, $path ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
			@unlink( $tmp_path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged,WordPress.WP.AlternativeFunctions.unlink_unlink
			return false;
		}

		return true;
	}

	/**
	 * Persist Team Challenge state with bounded, non-secret event history.
	 *
	 * @param array  $state      Team Challenge state, updated by reference.
	 * @param string $event_type Safe event type.
	 * @return bool
	 */
	private static function persist_team_challenge_state( &$state, $event_type ) {
		self::$team_challenge_persist_error = '';
		$previous = get_option( self::TEAM_CHALLENGE_STATE_OPTION, array() );
		$state = MMED_Live_Drills_State_Contract::prepare_mutation( $state, (int) ( $previous['eventSeq'] ?? 0 ) );
		$state = self::append_team_challenge_history( $state, $event_type );

		$private_path = self::team_challenge_private_snapshot_path();
		$public_location = self::team_challenge_snapshot_location();
		$public_path = $public_location['path'] ?? '';
		$private_before = file_exists( $private_path ) ? file_get_contents( $private_path ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$public_before = '' !== $public_path && file_exists( $public_path ) ? file_get_contents( $public_path ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents

		if ( ! self::write_team_challenge_private_snapshot( $state ) ) {
			self::$team_challenge_persist_error = 'private_snapshot_write_failed';
			return false;
		}
		if ( ! self::write_team_challenge_state_snapshot( $state ) ) {
			self::restore_team_challenge_snapshot_bytes( $private_path, $private_before, 0640 );
			self::$team_challenge_persist_error = 'public_snapshot_write_failed';
			return false;
		}

		$saved = update_option( self::TEAM_CHALLENGE_STATE_OPTION, $state, false );
		if ( ! $saved ) {
			$option_matches = maybe_serialize( get_option( self::TEAM_CHALLENGE_STATE_OPTION, array() ) ) === maybe_serialize( $state );
			if ( ! $option_matches ) {
				self::restore_team_challenge_snapshot_bytes( $private_path, $private_before, 0640 );
				self::restore_team_challenge_snapshot_bytes( $public_path, $public_before, 0644 );
				self::$team_challenge_persist_error = 'option_write_failed';
				return false;
			}
		}

		return true;
	}

	/**
	 * Append a safe event summary to the shared session state.
	 *
	 * @param array  $state      Team Challenge state.
	 * @param string $event_type Event type.
	 * @return array
	 */
	private static function append_team_challenge_history( $state, $event_type ) {
		$history = isset( $state['history'] ) && is_array( $state['history'] ) ? $state['history'] : array();
		$event   = isset( $state['lastEvent'] ) && is_array( $state['lastEvent'] ) ? $state['lastEvent'] : array();

		$history[] = array(
			'type'      => sanitize_key( $event_type ),
			'event'     => sanitize_key( $event['type'] ?? $event_type ),
			'message'   => sanitize_text_field( $event['message'] ?? '' ),
			'updatedAt' => sanitize_text_field( $event['updatedAt'] ?? current_time( 'mysql' ) ),
			'eventSeq'  => (int) ( $state['eventSeq'] ?? 0 ),
		);

		if ( self::TEAM_CHALLENGE_HISTORY_LIMIT < count( $history ) ) {
			$history = array_slice( $history, -1 * self::TEAM_CHALLENGE_HISTORY_LIMIT );
		}

		$state['history'] = $history;

		return $state;
	}

	/**
	 * Log safe Team Challenge operational events without secrets or PII-heavy payloads.
	 *
	 * @param string $event   Event label.
	 * @param array  $context Safe context.
	 * @return void
	 */
	private static function log_team_challenge_event( $event, $context = array() ) {
		$safe_context = array(
			'event' => sanitize_key( $event ),
		);

		foreach ( is_array( $context ) ? $context : array() as $key => $value ) {
			$key = sanitize_key( $key );
			if ( preg_match( '/token|secret|password|key|auth|bearer|code/i', $key ) ) {
				continue;
			}
			if ( is_bool( $value ) || is_numeric( $value ) ) {
				$safe_context[ $key ] = $value;
				continue;
			}
			$safe_context[ $key ] = sanitize_text_field( (string) $value );
		}

		error_log( '[MissionMed Live Team Challenge] ' . wp_json_encode( $safe_context ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	}

	/**
	 * Render a friendly sign-in/create-account gate for public Team Challenge links.
	 *
	 * @return void
	 */
	private static function render_login_required_response() {
		$redirect_url = home_url( '/' . self::ROUTE_PATH . '/' );
		$login_url    = add_query_arg( 'redirect_to', rawurlencode( $redirect_url ), home_url( '/my-account/' ) );
		$register_url = $login_url;

		status_header( 200 );
		header( 'Content-Type: text/html; charset=utf-8', true );
		?>
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex,nofollow">
	<title>MissionMed Live Team Challenge Sign In</title>
	<style>
		:root {
			color-scheme: dark;
			--gold: #facc15;
			--ink: #060914;
			--panel: rgba(12, 19, 42, .92);
			--line: rgba(127, 149, 197, .32);
			--text: #eef5ff;
			--muted: #aebce0;
		}
		* { box-sizing: border-box; }
		body {
			min-height: 100vh;
			margin: 0;
			display: grid;
			place-items: center;
			padding: 24px;
			font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background:
				radial-gradient(circle at 16% 20%, rgba(37, 99, 235, .28), transparent 34%),
				radial-gradient(circle at 86% 76%, rgba(220, 38, 38, .22), transparent 30%),
				linear-gradient(135deg, #030611, #0b1022 48%, #050814);
			color: var(--text);
		}
		.mmed-login-card {
			width: min(620px, 100%);
			border: 1px solid var(--line);
			border-radius: 18px;
			background: linear-gradient(180deg, rgba(18, 27, 58, .96), rgba(4, 8, 20, .96));
			box-shadow: 0 28px 90px rgba(0, 0, 0, .48), inset 0 1px 0 rgba(255, 255, 255, .08);
			overflow: hidden;
		}
		.mmed-login-head {
			display: flex;
			align-items: center;
			gap: 14px;
			padding: 22px 24px;
			border-bottom: 1px solid rgba(127, 149, 197, .2);
			background: rgba(3, 6, 18, .34);
		}
		.mmed-mark {
			width: 46px;
			height: 46px;
			display: grid;
			place-items: center;
			border: 1px solid rgba(250, 204, 21, .62);
			border-radius: 12px;
			color: var(--gold);
			font-weight: 1000;
			background: linear-gradient(135deg, #111827, #1f2937);
			box-shadow: 0 0 28px rgba(250, 204, 21, .14);
		}
		h1, p { margin: 0; }
		h1 {
			font-size: clamp(26px, 4vw, 38px);
			line-height: 1;
			letter-spacing: .02em;
		}
		.mmed-eyebrow {
			margin-bottom: 6px;
			color: var(--gold);
			font-size: 12px;
			font-weight: 900;
			letter-spacing: .14em;
			text-transform: uppercase;
		}
		.mmed-login-body {
			display: grid;
			gap: 18px;
			padding: 24px;
		}
		.mmed-copy {
			color: var(--muted);
			font-size: 16px;
			line-height: 1.48;
		}
		.mmed-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		a.mmed-button {
			min-height: 54px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border: 1px solid rgba(127, 149, 197, .38);
			border-radius: 13px;
			padding: 12px 16px;
			color: #fff;
			text-decoration: none;
			font-size: 14px;
			font-weight: 1000;
			letter-spacing: .08em;
			text-transform: uppercase;
			background: #101a38;
		}
		a.mmed-button-primary {
			border-color: rgba(250, 204, 21, .74);
			color: #111827;
			background: linear-gradient(180deg, #fde68a, #f59e0b);
			box-shadow: 0 0 26px rgba(250, 204, 21, .2);
		}
		.mmed-note {
			padding: 12px 14px;
			border: 1px solid rgba(96, 165, 250, .22);
			border-radius: 12px;
			background: rgba(37, 99, 235, .1);
			color: #c8d4f4;
			font-size: 13px;
			line-height: 1.42;
		}
		@media (max-width: 560px) {
			.mmed-actions { grid-template-columns: 1fr; }
			.mmed-login-head { align-items: flex-start; }
		}
	</style>
</head>
<body>
	<main class="mmed-login-card" aria-labelledby="mmed-login-title">
		<header class="mmed-login-head">
			<div class="mmed-mark">M</div>
			<div>
				<p class="mmed-eyebrow">Dr J Live Drills</p>
				<h1 id="mmed-login-title">Sign in to join Team Challenge</h1>
			</div>
		</header>
		<section class="mmed-login-body">
			<p class="mmed-copy">Use your MissionMed account so your name and Arena avatar can appear correctly in the live roster. After signing in, you can choose whether you are jumping in or just watching.</p>
			<div class="mmed-actions">
				<a class="mmed-button mmed-button-primary" href="<?php echo esc_url( $login_url ); ?>">Sign In</a>
				<a class="mmed-button" href="<?php echo esc_url( $register_url ); ?>">Create Free Account</a>
			</div>
			<p class="mmed-note">Students do not get scoring or team-control buttons. Those controls only appear for WordPress admin accounts.</p>
		</section>
	</main>
</body>
</html>
		<?php
		exit;
	}

	/**
	 * Render a closed gate response.
	 *
	 * @param int    $status HTTP status code.
	 * @param string $message User-facing safe message.
	 * @return void
	 */
	private static function render_gate_response( $status, $message ) {
		status_header( $status );
		header( 'Content-Type: text/html; charset=utf-8', true );
		echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>MissionMed Preview Unavailable</title></head><body><h1>Preview unavailable</h1><p>' . esc_html( $message ) . '</p></body></html>';
		exit;
	}
}
