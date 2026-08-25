<?php
/**
 * MissionMed Matrix REST API.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Feature-flagged Matrix REST endpoint registry.
 */
class MMED_REST_API {

	/**
	 * REST namespace.
	 */
	const NAMESPACE = 'mmed/v1';

	/**
	 * Canonical Matrix student profile user-meta key.
	 */
	const STUDENT_PROFILE_META_KEY = '_mmed_ecosystem_student_profile';

	/**
	 * Per-user profile prompt dismissal flag.
	 */
	const STUDENT_PROFILE_PROMPT_DISMISSED_META_KEY = '_mmed_student_profile_prompt_dismissed';

	/**
	 * Register REST hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Register Matrix REST routes.
	 *
	 * @return void
	 */
	public static function register_routes() {
			register_rest_route(
				self::NAMESPACE,
				'/user/profile',
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_user_profile' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				)
			);

			register_rest_route(
				self::NAMESPACE,
				'/profile/me',
				array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( __CLASS__, 'get_current_student_profile' ),
						'permission_callback' => array( __CLASS__, 'can_access' ),
					),
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( __CLASS__, 'save_current_student_profile' ),
						'permission_callback' => array( __CLASS__, 'can_access' ),
					),
				)
			);

			register_rest_route(
				self::NAMESPACE,
				'/profile/me/dismiss-prompt',
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'dismiss_student_profile_prompt' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				)
			);

			register_rest_route(
				self::NAMESPACE,
				'/user/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_user_stats' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/user/relink-supabase',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'relink_supabase' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/debug/supabase-link',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'debug_supabase_link' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/courses',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_courses' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/events',
				array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( __CLASS__, 'get_events' ),
						'permission_callback' => array( __CLASS__, 'can_access' ),
						'args'                => array_merge( self::event_query_args(), self::event_validation_args() ),
					),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_event' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/events/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'update_event' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'delete_event' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/files',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_files' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => array(
					'category' => array(
						'sanitize_callback' => 'sanitize_key',
					),
					'status'   => array(
						'sanitize_callback' => 'sanitize_key',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/files/upload-url',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'get_file_upload_url' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/files/(?P<id>\d+)/download',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_file_download' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/files/(?P<id>\d+)/confirm',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'confirm_file_upload' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/students',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_students' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => array(
					'search' => array( 'sanitize_callback' => 'sanitize_text_field' ),
					'limit'  => array( 'sanitize_callback' => 'absint' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/students/(?P<uid>\d+)/files',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_student_files' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => array(
					'uid'      => array(
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $param ) {
							return absint( $param ) > 0;
						},
					),
					'category' => array( 'sanitize_callback' => 'sanitize_key' ),
					'status'   => array( 'sanitize_callback' => 'sanitize_key' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/files/(?P<id>\d+)/download',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_download' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/files/(?P<id>\d+)/status',
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_update_status' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/students/(?P<uid>\d+)/upload-url',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_upload_url' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => array(
					'uid'       => array(
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $param ) {
							return absint( $param ) > 0;
						},
					),
					'filename'  => array( 'sanitize_callback' => 'sanitize_file_name' ),
					'mime_type' => array( 'sanitize_callback' => 'sanitize_mime_type' ),
					'category'  => array( 'sanitize_callback' => 'sanitize_key' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/file-vault/students/(?P<uid>\d+)/files/(?P<id>\d+)/confirm',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'admin_file_vault_confirm' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => array(
					'uid' => array(
						'sanitize_callback' => 'absint',
						'validate_callback' => static function ( $param ) {
							return absint( $param ) > 0;
						},
					),
					'id'  => array( 'sanitize_callback' => 'absint' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/lor',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_lor' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_lor' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/lor/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'update_lor' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/lor/(?P<id>\d+)/status',
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'update_lor_status' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/ranklist',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_ranklist' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'get_ranklist' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/ranklist/reorder',
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'get_ranklist' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/ranklist/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => array( __CLASS__, 'get_ranklist' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/arena/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_arena_stats' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/ssa/sync',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'sync_ssa' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/orders',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_orders' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/timeline',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_timeline' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/notifications',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_notifications' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::pagination_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/messages',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_messages' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
				'args'                => self::pagination_args(),
			)
		);

		/* ── Todos ───────────────────────────────────────────────── */
		register_rest_route(
			self::NAMESPACE,
			'/todos',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_todos' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_todo' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/todos/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'update_todo' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'delete_todo' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
			)
		);

		/* -- Live Sessions (admin) -- */
		register_rest_route(
			self::NAMESPACE,
			'/admin/sessions',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( 'MMED_Session_Manager', 'get_groups' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( 'MMED_Session_Manager', 'create_group' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/sessions/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( 'MMED_Session_Manager', 'get_group' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
					'args'                => self::id_args(),
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( 'MMED_Session_Manager', 'update_group' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
					'args'                => self::id_args(),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( 'MMED_Session_Manager', 'delete_group' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
					'args'                => self::id_args(),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/sessions/(?P<id>\d+)/propagate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( 'MMED_Session_Manager', 'propagate_meeting_url' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => self::id_args(),
			)
		);

		/* -- Webex Integration (admin) -- */
		register_rest_route(
			self::NAMESPACE,
			'/admin/webex/auth-url',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Webex_Client', 'get_auth_url' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/webex/callback',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Webex_Client', 'handle_oauth_callback' ),
				'permission_callback' => '__return_true',
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/webex/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Webex_Client', 'get_status' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/webex/settings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( 'MMED_Webex_Client', 'get_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( 'MMED_Webex_Client', 'save_settings' ),
					'permission_callback' => array( __CLASS__, 'can_manage' ),
				),
			)
		);

		/* -- Session Webex Actions (admin) -- */
		register_rest_route(
			self::NAMESPACE,
			'/admin/sessions/(?P<id>\d+)/create-meeting',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( 'MMED_Session_Manager', 'auto_create_webex_meeting' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => self::id_args(),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/admin/sessions/(?P<id>\d+)/invite-students',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( 'MMED_Session_Manager', 'invite_enrolled_students' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => self::id_args(),
			)
		);

		/* -- Webex Student Endpoints -- */
		register_rest_route(
			self::NAMESPACE,
			'/webex/guest-token',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Webex_Client', 'generate_guest_token' ),
				'permission_callback' => array( __CLASS__, 'can_access_webex_guest_token' ),
				'args'                => array(
					'displayName' => array(
						'sanitize_callback' => 'sanitize_text_field',
					),
					'guestId'     => array(
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/webex/host-token',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Webex_Client', 'generate_host_token' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/webex/start-meeting',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( 'MMED_Webex_Client', 'start_meeting' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
				'args'                => array(
					'meeting_id' => array(
						'sanitize_callback' => 'sanitize_text_field',
					),
					'join_url'   => array(
						'sanitize_callback' => 'esc_url_raw',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/meetings/(?P<event_id>\d+)/join',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( 'MMED_Session_Manager', 'get_join_info' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		/* ── Bulk Events (admin) ─────────────────────────────────── */
		register_rest_route(
			self::NAMESPACE,
			'/events/bulk',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'bulk_create_events' ),
				'permission_callback' => array( __CLASS__, 'can_manage' ),
			)
		);

		/* ── Calendar Categories ─────────────────────────────────── */
		register_rest_route(
			self::NAMESPACE,
			'/calendar/categories',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_calendar_categories' ),
				'permission_callback' => array( __CLASS__, 'can_access' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/study-blocks',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'get_study_blocks' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::event_query_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( __CLASS__, 'create_study_block' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/study-blocks/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'update_study_block' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( __CLASS__, 'delete_study_block' ),
					'permission_callback' => array( __CLASS__, 'can_access' ),
					'args'                => self::id_args(),
				),
			)
		);
	}

	/**
	 * Temporary diagnostic endpoint for Supabase link debugging.
	 *
	 * @return WP_REST_Response
	 */
	public static function debug_supabase_link() {
		$user_id = get_current_user_id();
		$user    = get_user_by( 'id', $user_id );
		$diag    = array(
			'wp_user_id'    => $user_id,
			'wp_email'      => $user ? $user->user_email : '',
			'bridge_exists' => class_exists( 'MMED_Supabase_Bridge' ),
			'configured'    => false,
			'cached_uuid'   => '',
			'api_test'      => null,
		);

		if ( ! class_exists( 'MMED_Supabase_Bridge' ) ) {
			return new WP_REST_Response( $diag, 200 );
		}

		$diag['configured'] = MMED_Supabase_Bridge::configured();
		$diag['cached_uuid'] = get_user_meta( $user_id, '_mmed_supabase_uuid', true );

		if ( ! $diag['configured'] ) {
			$diag['api_test'] = 'skipped_not_configured';
			return new WP_REST_Response( $diag, 200 );
		}

		$headers = MMED_Supabase_Bridge::get_supabase_client_headers();
		$diag['has_headers'] = ! empty( $headers );
		$diag['url_defined'] = defined( 'MMED_SUPABASE_URL' );
		$diag['url_prefix']  = defined( 'MMED_SUPABASE_URL' ) ? substr( (string) MMED_SUPABASE_URL, 0, 30 ) . '...' : '';

		$test_url = untrailingslashit( (string) MMED_SUPABASE_URL ) . '/auth/v1/admin/users?page=1&per_page=1';
		$response = wp_remote_get( $test_url, array( 'timeout' => 15, 'headers' => $headers ) );

		if ( is_wp_error( $response ) ) {
			$diag['api_test'] = array(
				'status'  => 'wp_error',
				'code'    => $response->get_error_code(),
				'message' => $response->get_error_message(),
			);
		} else {
			$code = (int) wp_remote_retrieve_response_code( $response );
			$body = (string) wp_remote_retrieve_body( $response );
			$decoded = json_decode( $body, true );
			$diag['api_test'] = array(
				'status'     => 'http_' . $code,
				'http_code'  => $code,
				'user_count' => is_array( $decoded ) && isset( $decoded['users'] ) ? count( $decoded['users'] ) : null,
				'total'      => $decoded['total'] ?? null,
				'error'      => $decoded['error'] ?? $decoded['message'] ?? $decoded['msg'] ?? null,
				'body_len'   => strlen( $body ),
			);
		}

		return new WP_REST_Response( $diag, 200 );
	}

	/**
	 * Allow logged-in users only.
	 *
	 * @return bool
	 */
	public static function can_access() {
		return is_user_logged_in();
	}

	/**
	 * Allow live-page students to request a Webex guest token.
	 *
	 * Team Challenge can run in guest mode before a WordPress account exists, so
	 * this endpoint accepts the same REST nonce printed into the live route.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function can_access_webex_guest_token( $request ) {
		if ( is_user_logged_in() ) {
			return true;
		}

		$nonce = $request instanceof WP_REST_Request ? $request->get_header( 'X-WP-Nonce' ) : '';
		if ( $nonce && wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return true;
		}

		return new WP_Error(
			'rest_forbidden',
			'Sorry, you are not allowed to request a Webex guest token.',
			array( 'status' => 401 )
		);
	}

	/**
	 * Get current user profile data.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_user_profile() {
		$user_id = get_current_user_id();

		if ( class_exists( 'MMED_Student_OS' ) ) {
			$initial_data = MMED_Student_OS::get_initial_data( $user_id );
			if ( ! empty( $initial_data['profile'] ) ) {
				return new WP_REST_Response( $initial_data['profile'], 200 );
			}
		}

		$user        = get_user_by( 'id', $user_id );
		$task_counts = self::get_task_counts( $user_id );

		return new WP_REST_Response(
			array(
				'id'              => $user_id,
				'display_name'    => $user ? $user->display_name : '',
				'email'           => $user ? $user->user_email : '',
				'division'        => get_user_meta( $user_id, '_mmed_primary_division', true ),
				'program_tier'    => get_user_meta( $user_id, '_mmed_program_tier', true ),
				'enrolled_date'   => get_user_meta( $user_id, '_mmed_enrolled_date', true ),
				'placement_ready' => '1' === get_user_meta( $user_id, '_mmed_placement_ready', true ),
				'avatar_url'      => get_avatar_url( $user_id ),
				'tasks'           => $task_counts,
				'phase'           => array(
					'current'       => '',
					'current_index' => 0,
					'total_phases'  => 0,
					'phases'        => array(),
				),
			),
			200
		);
	}

	/**
	 * Get the current user's canonical ecosystem profile.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_current_student_profile() {
		$user_id = get_current_user_id();

		return new WP_REST_Response( self::get_student_profile_response_payload( $user_id ), 200 );
	}

	/**
	 * Save the current user's canonical ecosystem profile.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function save_current_student_profile( WP_REST_Request $request ) {
		$user_id       = get_current_user_id();
		$params        = $request->get_json_params();
		$params        = is_array( $params ) ? $params : array();
		$profile_input = isset( $params['profile'] ) && is_array( $params['profile'] ) ? $params['profile'] : $params;
		$existing      = self::get_student_profile_payload( $user_id );
		$profile       = self::sanitize_student_profile_payload( array_merge( $existing, $profile_input ), $user_id );
		$missing       = self::get_missing_student_profile_required_fields( $profile );
		$mark_complete = ! empty( $params['mark_complete'] );

		if ( $mark_complete && ! empty( $missing ) ) {
			return new WP_Error(
				'mmed_profile_required',
				'Please complete the required profile fields.',
				array(
					'status'         => 400,
					'missing_fields' => $missing,
				)
			);
		}

		$profile['updated_at'] = current_time( 'mysql' );
		$profile['status']     = empty( $missing ) ? 'complete' : 'draft';

		update_user_meta( $user_id, self::STUDENT_PROFILE_META_KEY, $profile );

		if ( ! empty( $profile['first_name'] ) ) {
			update_user_meta( $user_id, 'first_name', $profile['first_name'] );
		}

		if ( ! empty( $profile['last_name'] ) ) {
			update_user_meta( $user_id, 'last_name', $profile['last_name'] );
		}

		return new WP_REST_Response( self::get_student_profile_response_payload( $user_id ), 200 );
	}

	/**
	 * Permanently dismiss the profile prompt for the current user.
	 *
	 * @return WP_REST_Response
	 */
	public static function dismiss_student_profile_prompt() {
		$user_id = get_current_user_id();

		update_user_meta( $user_id, self::STUDENT_PROFILE_PROMPT_DISMISSED_META_KEY, '1' );

		return new WP_REST_Response(
			array(
				'dismissed' => true,
			),
			200
		);
	}

	/**
	 * Build the REST payload for the current user's student profile.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_student_profile_response_payload( $user_id ) {
		$profile = self::get_student_profile_payload( $user_id );

		return array(
			'profile'          => $profile,
			'progress'         => self::get_student_profile_completion( $profile ),
			'required_fields'  => self::get_student_profile_required_fields(),
			'prompt_dismissed' => '1' === get_user_meta( $user_id, self::STUDENT_PROFILE_PROMPT_DISMISSED_META_KEY, true ),
			'storage'          => array(
				'type' => 'wordpress_user_meta',
				'key'  => self::STUDENT_PROFILE_META_KEY,
			),
		);
	}

	/**
	 * Read the stored student profile, merging account defaults.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_student_profile_payload( $user_id ) {
		$stored = get_user_meta( $user_id, self::STUDENT_PROFILE_META_KEY, true );

		if ( is_string( $stored ) && '' !== $stored ) {
			$decoded = json_decode( $stored, true );
			if ( is_array( $decoded ) ) {
				$stored = $decoded;
			}
		}

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return self::sanitize_student_profile_payload( array_merge( self::get_student_profile_defaults( $user_id ), $stored ), $user_id );
	}

	/**
	 * Get default profile values from the WordPress account.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function get_student_profile_defaults( $user_id ) {
		$user       = get_user_by( 'id', $user_id );
		$first_name = get_user_meta( $user_id, 'first_name', true );
		$last_name  = get_user_meta( $user_id, 'last_name', true );
		$display    = $user ? $user->display_name : '';

		return array(
			'first_name'                  => $first_name,
			'last_name'                   => $last_name,
			'phone_mobile'                => get_user_meta( $user_id, 'billing_phone', true ),
			'email'                       => $user ? $user->user_email : '',
			'current_location'            => '',
			'time_zone'                   => wp_timezone_string(),
			'preferred_contact_method'    => '',
			'medical_school'              => '',
			'medical_school_country'      => '',
			'current_status'              => '',
			'medical_school_year'         => '',
			'graduation_year'             => '',
			'primary_specialty'           => '',
			'primary_specialty_other'     => '',
			'backup_specialty'            => '',
			'backup_specialty_other'      => '',
			'primary_care_interest'       => '',
			'fellowship_interest'         => '',
			'fellowship_goal'             => '',
			'long_term_goal'              => '',
			'step1_status'                => '',
			'step1_score'                 => '',
			'step1_attempts'              => '',
			'step1_target_date'           => '',
			'step2_status'                => '',
			'step2_score'                 => '',
			'step2_attempts'              => '',
			'step2_target_date'           => '',
			'step3_status'                => '',
			'step3_score'                 => '',
			'step3_attempts'              => '',
			'step3_target_date'           => '',
			'ecfmg_status'                => '',
			'match_cycle'                 => '',
			'prior_match_cycles'          => '',
			'previously_unmatched'        => '',
			'soap_history'                => '',
			'interviews_last_cycle'       => '',
			'matched_prelim'              => '',
			'is_img'                      => '',
			'visa_status'                 => '',
			'img_specialty_practiced'     => '',
			'img_years_practicing'        => '',
			'most_recent_clinical_work_date' => '',
			'usce_months'                 => '',
			'usce_setting'                => '',
			'lor_status'                  => '',
			'publications_count'          => '',
			'presentations_count'         => '',
			'research_experience'         => '',
			'pubmed_indexed'              => '',
			'languages_spoken'            => array(),
			'hobbies'                     => '',
			'leadership_experience'       => '',
			'volunteer_service'           => '',
			'teaching_experience'         => '',
			'red_flags'                   => array(),
			'other_red_flags'             => '',
			'advisor_notes'               => '',
			'avatar_version'              => 'v3',
			'avatar_gender'               => '',
			'avatar_body_type'            => '',
			'avatar_style'                => '',
			'active_avatar_id'            => '',
			'avatar_url'                  => '',
			'avatar_thumbnail_url'        => '',
			'avatar_prompt_set_id'        => '',
			'avatar_generation_source'    => 'matrix_profile_contract',
			'avatar_initials'             => self::student_profile_initials( $first_name, $last_name, $display ),
			'status'                      => 'draft',
			'updated_at'                  => '',
		);
	}

	/**
	 * Sanitize profile fields before returning or saving.
	 *
	 * @param array $payload Raw profile payload.
	 * @param int   $user_id User ID.
	 * @return array
	 */
	private static function sanitize_student_profile_payload( $payload, $user_id ) {
		$defaults = self::get_student_profile_allowed_fields();
		$clean    = array();

		foreach ( $defaults as $field => $type ) {
			$value = isset( $payload[ $field ] ) ? $payload[ $field ] : '';

			if ( 'array' === $type ) {
				$value = is_array( $value ) ? $value : ( '' === $value ? array() : explode( ',', (string) $value ) );
				$clean[ $field ] = array_values(
					array_filter(
						array_map(
							static function ( $item ) {
								return sanitize_text_field( wp_unslash( $item ) );
							},
							$value
						)
					)
				);
				continue;
			}

			if ( 'textarea' === $type ) {
				$clean[ $field ] = sanitize_textarea_field( wp_unslash( $value ) );
				continue;
			}

			if ( 'email' === $type ) {
				$user            = get_user_by( 'id', $user_id );
				$clean[ $field ] = $user ? sanitize_email( $user->user_email ) : '';
				continue;
			}

			if ( is_array( $value ) ) {
				$value = '';
			}

			if ( 'int' === $type ) {
				$clean[ $field ] = '' === $value ? '' : (string) absint( $value );
				continue;
			}

			$clean[ $field ] = sanitize_text_field( wp_unslash( $value ) );
		}

		$enum_fields = array(
			'avatar_gender'    => array( '', 'male', 'female' ),
			'avatar_body_type' => array( '', 'slim', 'athletic', 'strong' ),
			'avatar_style'     => array( '', 'doctor', 'superhero' ),
		);

		foreach ( $enum_fields as $field => $allowed_values ) {
			if ( isset( $clean[ $field ] ) ) {
				$clean[ $field ] = strtolower( $clean[ $field ] );
				if ( ! in_array( $clean[ $field ], $allowed_values, true ) ) {
					$clean[ $field ] = '';
				}
			}
		}

		$clean['avatar_version'] = 'v3';
		if ( empty( $clean['avatar_generation_source'] ) ) {
			$clean['avatar_generation_source'] = 'matrix_profile_contract';
		}

		if ( empty( $clean['avatar_initials'] ) ) {
			$user                     = get_user_by( 'id', $user_id );
			$clean['avatar_initials'] = self::student_profile_initials(
				isset( $clean['first_name'] ) ? $clean['first_name'] : '',
				isset( $clean['last_name'] ) ? $clean['last_name'] : '',
				$user ? $user->display_name : ''
			);
		}

		return $clean;
	}

	/**
	 * Allowed profile fields and their sanitizer type.
	 *
	 * @return array
	 */
	private static function get_student_profile_allowed_fields() {
		return array(
			'first_name'                  => 'text',
			'last_name'                   => 'text',
			'phone_mobile'                => 'text',
			'email'                       => 'email',
			'current_location'            => 'text',
			'time_zone'                   => 'text',
			'preferred_contact_method'    => 'text',
			'medical_school'              => 'text',
			'medical_school_country'      => 'text',
			'current_status'              => 'text',
			'medical_school_year'         => 'text',
			'graduation_year'             => 'text',
			'primary_specialty'           => 'text',
			'primary_specialty_other'     => 'text',
			'backup_specialty'            => 'text',
			'backup_specialty_other'      => 'text',
			'primary_care_interest'       => 'text',
			'fellowship_interest'         => 'text',
			'fellowship_goal'             => 'text',
			'long_term_goal'              => 'text',
			'step1_status'                => 'text',
			'step1_score'                 => 'text',
			'step1_attempts'              => 'int',
			'step1_target_date'           => 'text',
			'step2_status'                => 'text',
			'step2_score'                 => 'text',
			'step2_attempts'              => 'int',
			'step2_target_date'           => 'text',
			'step3_status'                => 'text',
			'step3_score'                 => 'text',
			'step3_attempts'              => 'int',
			'step3_target_date'           => 'text',
			'ecfmg_status'                => 'text',
			'match_cycle'                 => 'text',
			'prior_match_cycles'          => 'int',
			'previously_unmatched'        => 'text',
			'soap_history'                => 'text',
			'interviews_last_cycle'       => 'int',
			'matched_prelim'              => 'text',
			'is_img'                      => 'text',
			'visa_status'                 => 'text',
			'img_specialty_practiced'     => 'text',
			'img_years_practicing'        => 'int',
			'most_recent_clinical_work_date' => 'text',
			'usce_months'                 => 'int',
			'usce_setting'                => 'text',
			'lor_status'                  => 'text',
			'publications_count'          => 'int',
			'presentations_count'         => 'int',
			'research_experience'         => 'text',
			'pubmed_indexed'              => 'text',
			'languages_spoken'            => 'array',
			'hobbies'                     => 'textarea',
			'leadership_experience'       => 'text',
			'volunteer_service'           => 'text',
			'teaching_experience'         => 'text',
			'red_flags'                   => 'array',
			'other_red_flags'             => 'textarea',
			'advisor_notes'               => 'textarea',
			'avatar_version'              => 'text',
			'avatar_gender'               => 'text',
			'avatar_body_type'            => 'text',
			'avatar_style'                => 'text',
			'active_avatar_id'            => 'text',
			'avatar_url'                  => 'text',
			'avatar_thumbnail_url'        => 'text',
			'avatar_prompt_set_id'        => 'text',
			'avatar_generation_source'    => 'text',
			'avatar_initials'             => 'text',
			'status'                      => 'text',
			'updated_at'                  => 'text',
		);
	}

	/**
	 * Required profile fields.
	 *
	 * @return array
	 */
	private static function get_student_profile_required_fields() {
		return array( 'first_name', 'last_name', 'phone_mobile', 'primary_specialty' );
	}

	/**
	 * Get missing required fields.
	 *
	 * @param array $profile Profile payload.
	 * @return array
	 */
	private static function get_missing_student_profile_required_fields( $profile ) {
		$missing = array();

		foreach ( self::get_student_profile_required_fields() as $field ) {
			if ( empty( $profile[ $field ] ) ) {
				$missing[] = $field;
			}
		}

		if ( ! empty( $profile['primary_specialty'] ) && 'Other' === $profile['primary_specialty'] && empty( $profile['primary_specialty_other'] ) ) {
			$missing[] = 'primary_specialty_other';
		}

		return $missing;
	}

	/**
	 * Calculate student profile completion.
	 *
	 * @param array $profile Profile payload.
	 * @return array
	 */
	private static function get_student_profile_completion( $profile ) {
		$fields = array(
			'first_name',
			'last_name',
			'phone_mobile',
			'current_location',
			'time_zone',
			'current_status',
			'graduation_year',
			'primary_specialty',
			'backup_specialty',
			'primary_care_interest',
			'fellowship_interest',
			'step1_status',
			'step2_status',
			'match_cycle',
			'prior_match_cycles',
			'is_img',
			'languages_spoken',
			'hobbies',
			'red_flags',
			'avatar_gender',
			'avatar_body_type',
			'avatar_style',
		);
		$filled = 0;

		foreach ( $fields as $field ) {
			if ( self::is_student_profile_value_filled( isset( $profile[ $field ] ) ? $profile[ $field ] : '' ) ) {
				$filled++;
			}
		}

		return array(
			'filled'           => $filled,
			'total'            => count( $fields ),
			'percentage'       => count( $fields ) ? (int) round( ( $filled / count( $fields ) ) * 100 ) : 0,
			'missing_required' => self::get_missing_student_profile_required_fields( $profile ),
		);
	}

	/**
	 * Determine if a profile value is filled.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	private static function is_student_profile_value_filled( $value ) {
		if ( is_array( $value ) ) {
			return ! empty( array_filter( $value ) );
		}

		return '' !== trim( (string) $value );
	}

	/**
	 * Generate initials for the avatar default.
	 *
	 * @param string $first_name First name.
	 * @param string $last_name Last name.
	 * @param string $display Display name.
	 * @return string
	 */
	private static function student_profile_initials( $first_name, $last_name, $display ) {
		$letters = '';

		if ( $first_name ) {
			$letters .= substr( $first_name, 0, 1 );
		}

		if ( $last_name ) {
			$letters .= substr( $last_name, 0, 1 );
		}

		if ( '' === $letters && $display ) {
			$parts = preg_split( '/\s+/', trim( $display ) );
			foreach ( array_slice( $parts, 0, 2 ) as $part ) {
				$letters .= substr( $part, 0, 1 );
			}
		}

		return strtoupper( $letters ? $letters : 'MM' );
	}

	/**
	 * Clear and retry the current user's Supabase account link.
	 *
	 * @return WP_REST_Response
	 */
	public static function relink_supabase() {
		if ( ! class_exists( 'MMED_Supabase_Bridge' ) ) {
			return new WP_REST_Response(
				array(
					'linked'  => false,
					'status'  => 'not_configured',
					'message' => 'Supabase account linking is not available.',
				),
				200
			);
		}

		$result = MMED_Supabase_Bridge::relink_user( get_current_user_id() );

		return new WP_REST_Response(
			array(
				'linked'  => ! empty( $result['linked'] ),
				'status'  => sanitize_key( $result['status'] ?? 'pending' ),
				'message' => sanitize_text_field( $result['message'] ?? '' ),
			),
			200
		);
	}

	/**
	 * Get current user stats from LearnDash and Hub tasks.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_user_stats() {
		$user_id             = get_current_user_id();
		$courses             = self::get_course_items( $user_id );
		$task_counts         = self::get_task_counts( $user_id );
		$next_task           = self::get_next_open_task( $user_id );
		$courses_in_progress = 0;

		foreach ( $courses as $course ) {
			if ( 'in_progress' === $course['status'] ) {
				$courses_in_progress++;
			}
		}

		$match_readiness = $task_counts['total'] > 0
			? (int) round( ( $task_counts['approved'] / $task_counts['total'] ) * 100 )
			: 0;

		$file_counts = class_exists( 'MMED_File_Vault' ) ? MMED_File_Vault::get_counts( $user_id ) : array(
			'total'          => 0,
			'pending_review' => 0,
		);
		$arena_stats = class_exists( 'MMED_Arena' ) ? MMED_Arena::get_player_stats( $user_id ) : array();
		$arena_player = is_array( $arena_stats ) && ! empty( $arena_stats['player'] ) && is_array( $arena_stats['player'] )
			? $arena_stats['player']
			: array();

		return new WP_REST_Response(
			array(
				'match_readiness'       => $match_readiness,
				'days_to_next_step'     => $next_task['days_to_next_step'],
				'next_step_label'       => $next_task['next_step_label'],
				'active_courses'        => count( $courses ),
				'courses_in_progress'   => $courses_in_progress,
				'tasks_total'           => $task_counts['total'],
				'tasks_approved'        => $task_counts['approved'],
				'tasks_pending_review'  => $task_counts['pending_review'],
				'tasks_revision_needed' => $task_counts['revision_needed'],
				'vault_files'           => (int) ( $file_counts['total'] ?? 0 ),
				'vault_pending'         => (int) ( $file_counts['pending_review'] ?? 0 ),
				'arena_rank'            => (int) ( $arena_player['rank'] ?? 0 ),
				'arena_score'           => (int) ( $arena_player['total_score'] ?? 0 ),
				'arena_streak'          => (int) ( $arena_player['win_streak'] ?? 0 ),
				'unread_notifications'  => 0,
				'unread_messages'       => self::count_messages( $user_id ),
				'upcoming_events_week'  => class_exists( 'MMED_Calendar_Engine' ) ? MMED_Calendar_Engine::count_upcoming_events( $user_id, 7 ) : 0,
				'upcoming_events_month' => class_exists( 'MMED_Calendar_Engine' ) ? MMED_Calendar_Engine::count_upcoming_events( $user_id, 30 ) : 0,
			),
			200
		);
	}

	/**
	 * Get current user LearnDash courses.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_courses() {
		return new WP_REST_Response(
			array(
				'courses' => self::get_course_items( get_current_user_id() ),
			),
			200
		);
	}

	/**
	 * Calendar events endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_events( $request ) {
		if ( class_exists( 'MMED_Calendar_Engine' ) ) {
			return MMED_Calendar_Engine::get_events( $request );
		}

		return new WP_REST_Response( array( 'events' => array() ), 200 );
	}

	/**
	 * Create calendar event endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_event( $request ) {
		return class_exists( 'MMED_Calendar_Engine' )
			? MMED_Calendar_Engine::create_event( $request )
			: new WP_Error( 'mmed_calendar_missing', 'Calendar engine is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Update calendar event endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_event( $request ) {
		return class_exists( 'MMED_Calendar_Engine' )
			? MMED_Calendar_Engine::update_event( $request )
			: new WP_Error( 'mmed_calendar_missing', 'Calendar engine is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Delete calendar event endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_event( $request ) {
		return class_exists( 'MMED_Calendar_Engine' )
			? MMED_Calendar_Engine::delete_event( $request )
			: new WP_Error( 'mmed_calendar_missing', 'Calendar engine is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * File vault endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_files( $request ) {
		if ( class_exists( 'MMED_File_Vault' ) ) {
			return MMED_File_Vault::get_files( $request );
		}

		return new WP_REST_Response(
			array(
				'files'              => array(),
				'counts'             => array(
					'total'          => 0,
					'verified'       => 0,
					'pending_review' => 0,
					'categories'     => 0,
				),
				'storage_configured' => false,
				'storage_message'    => 'File storage is being configured. Upload will be available soon.',
			),
			200
		);
	}

	/**
	 * File upload request endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_file_upload_url( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::get_upload_url( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * File upload confirm endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function confirm_file_upload( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::confirm_upload( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * File download endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_file_download( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::get_download_url( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault student list endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_students( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_list_students( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault student files endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_student_files( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_get_student_files( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault download endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_download( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_get_file_download_url( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault status update endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_update_status( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_update_file_status( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault upload URL endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_upload_url( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_get_student_upload_url( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Admin File Vault upload confirm endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function admin_file_vault_confirm( $request ) {
		return class_exists( 'MMED_File_Vault' )
			? MMED_File_Vault::admin_confirm_student_upload( $request )
			: new WP_Error( 'mmed_file_vault_missing', 'File vault is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * LOR GhostWriter list endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_lor( $request ) {
		if ( class_exists( 'MMED_LOR_Writer' ) ) {
			return MMED_LOR_Writer::get_requests( $request );
		}

		return new WP_REST_Response(
			array(
				'requests' => array(),
				'counts'   => array(
					'total'       => 0,
					'completed'   => 0,
					'in_review'   => 0,
					'not_started' => 0,
				),
				'statuses' => array( 'draft', 'requested', 'in_review', 'revision', 'submitted', 'completed' ),
			),
			200
		);
	}

	/**
	 * LOR GhostWriter create endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_lor( $request ) {
		return class_exists( 'MMED_LOR_Writer' )
			? MMED_LOR_Writer::create_request( $request )
			: new WP_Error( 'mmed_lor_missing', 'LOR Writer is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * LOR GhostWriter update endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_lor( $request ) {
		return class_exists( 'MMED_LOR_Writer' )
			? MMED_LOR_Writer::update_request( $request )
			: new WP_Error( 'mmed_lor_missing', 'LOR Writer is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * LOR GhostWriter status endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_lor_status( $request ) {
		return class_exists( 'MMED_LOR_Writer' )
			? MMED_LOR_Writer::update_status( $request )
			: new WP_Error( 'mmed_lor_missing', 'LOR Writer is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * RankListIQ read-only summary endpoint.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_ranklist() {
		if ( class_exists( 'MMED_Ranklist' ) ) {
			return new WP_REST_Response( MMED_Ranklist::get_user_ranklist( get_current_user_id() ), 200 );
		}

		return new WP_REST_Response(
			array(
				'programs'           => array(),
				'counts'             => array(
					'total'         => 0,
					'ranked'        => 0,
					'needs_scoring' => 0,
				),
				'match_probability'  => 0,
				'last_updated'       => '',
				'supabase_connected' => false,
				'configured'         => false,
				'linked'             => false,
				'message'            => 'RankListIQ is not available in Matrix yet.',
				'standalone_url'     => '/ranklistiq/',
			),
			200
		);
	}

	/**
	 * Arena read-only stats endpoint.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_arena_stats() {
		if ( class_exists( 'MMED_Arena' ) ) {
			return new WP_REST_Response( MMED_Arena::get_player_stats( get_current_user_id() ), 200 );
		}

		return new WP_REST_Response(
			array(
				'player'             => array(
					'rank'           => 0,
					'total_score'    => 0,
					'win_streak'     => 0,
					'matches_played' => 0,
					'win_rate'       => 0,
					'avatar_url'     => '',
					'display_name'   => '',
				),
				'recent_activity'    => array(
					'matches_last_7_days'  => 0,
					'accuracy_last_7_days' => 0,
					'answers_total'        => 0,
				),
				'supabase_connected' => false,
				'configured'         => false,
				'linked'             => false,
				'message'            => 'Arena is not available in Matrix yet.',
				'last_updated'       => '',
				'standalone_url'     => '/homepage-arena/',
			),
			200
		);
	}

	/**
	 * Manually sync Simply Schedule Appointments into Matrix events.
	 *
	 * @return WP_REST_Response
	 */
	public static function sync_ssa() {
		if ( class_exists( 'MMED_SSA_Adapter' ) ) {
			return MMED_SSA_Adapter::sync_current_user();
		}

		return new WP_REST_Response(
			array(
				'counts' => array(
					'scanned' => 0,
					'created' => 0,
					'updated' => 0,
					'skipped' => 0,
				),
				'status' => array(
					'active'      => false,
					'enabled'     => false,
					'available'   => false,
					'scheduled'   => false,
					'last_synced' => '',
					'message'     => 'SSA adapter is unavailable.',
				),
				'message' => 'SSA adapter is unavailable.',
			),
			200
		);
	}

	/**
	 * Get current user WooCommerce orders and subscription status.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_orders() {
		$user_id = get_current_user_id();
		$orders  = array();

			if ( function_exists( 'wc_get_orders' ) ) {
				$wc_orders = wc_get_orders(
					array(
						'customer_id' => $user_id,
					'limit'       => 20,
					'orderby'     => 'date',
					'order'       => 'DESC',
						'return'      => 'objects',
					)
				);

				if ( is_array( $wc_orders ) ) {
				foreach ( $wc_orders as $order ) {
					if ( ! is_object( $order ) || ! method_exists( $order, 'get_id' ) ) {
						continue;
					}

					$order_date = method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
					$item_names = array();

					if ( method_exists( $order, 'get_items' ) ) {
						foreach ( $order->get_items() as $item ) {
							if ( is_object( $item ) && method_exists( $item, 'get_name' ) ) {
								$item_names[] = $item->get_name();
							}
						}
					}

					$orders[] = array(
						'id'       => $order->get_id(),
						'number'   => method_exists( $order, 'get_order_number' ) ? $order->get_order_number() : (string) $order->get_id(),
						'date'     => $order_date ? $order_date->date( 'Y-m-d' ) : '',
						'item'     => implode( ', ', $item_names ),
						'amount'   => method_exists( $order, 'get_total' ) ? (float) $order->get_total() : 0,
						'currency' => method_exists( $order, 'get_currency' ) ? $order->get_currency() : '',
						'status'   => method_exists( $order, 'get_status' ) ? $order->get_status() : '',
					);
				}
			}
		}

		return new WP_REST_Response(
			array(
				'subscription' => self::get_subscription_data( $user_id ),
				'orders'       => $orders,
			),
			200
		);
	}

	/**
	 * Placeholder timeline endpoint.
	 *
	 * @return WP_REST_Response
	 */
	public static function get_timeline() {
		return new WP_REST_Response(
			array(
				'milestones'       => array(),
				'current_phase'    => '',
				'journey_progress' => 0,
			),
			200
		);
	}

	/**
	 * Notifications endpoint from real tasks and events.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_notifications( $request ) {
		$user_id       = get_current_user_id();
		$limit         = min( 50, max( 1, absint( $request->get_param( 'limit' ) ) ?: 20 ) );
		$notifications = array();

		foreach ( self::get_user_task_ids( $user_id ) as $task_id ) {
			$status = get_post_meta( $task_id, '_mmed_status', true ) ?: 'not_started';
			$due    = get_post_meta( $task_id, '_mmed_due_date', true );

			if ( 'approved' === $status ) {
				continue;
			}

			$notifications[] = array(
				'id'         => 'task-' . $task_id,
				'type'       => 'task',
				'title'      => get_the_title( $task_id ),
				'message'    => $due ? 'Due ' . $due . ' - status: ' . str_replace( '_', ' ', $status ) : 'Status: ' . str_replace( '_', ' ', $status ),
				'timestamp'  => get_post_modified_time( 'c', true, $task_id ),
				'status'     => $status,
				'action_url' => '#dashboard',
			);
		}

		if ( class_exists( 'MMED_Calendar_Engine' ) ) {
			$event_request = new WP_REST_Request( 'GET', '/mmed/v1/events' );
			$event_request->set_param( 'start', current_time( 'Y-m-d' ) . ' 00:00:00' );
			$event_request->set_param( 'end', gmdate( 'Y-m-d H:i:s', strtotime( current_time( 'mysql' ) . ' +14 days' ) ) );
			$response = MMED_Calendar_Engine::get_events( $event_request );
			$data     = $response instanceof WP_REST_Response ? $response->get_data() : array();

			foreach ( $data['events'] ?? array() as $event ) {
				$notifications[] = array(
					'id'         => 'event-' . absint( $event['id'] ),
					'type'       => 'event',
					'title'      => $event['title'],
					'message'    => 'Upcoming ' . str_replace( '_', ' ', $event['event_type'] ) . ' on ' . $event['start_at'],
					'timestamp'  => $event['start_at'],
					'status'     => $event['status'],
					'action_url' => '#calendar',
				);
			}
		}

		usort(
			$notifications,
			static function ( $a, $b ) {
				return strcmp( (string) ( $b['timestamp'] ?? '' ), (string) ( $a['timestamp'] ?? '' ) );
			}
		);

		return new WP_REST_Response(
			array(
				'notifications' => array_slice( $notifications, 0, $limit ),
			),
			200
		);
	}

	/**
	 * Messages endpoint from comments on assigned Hub tasks.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function get_messages( $request ) {
		$user_id = get_current_user_id();
		$limit   = min( 50, max( 1, absint( $request->get_param( 'limit' ) ) ?: 20 ) );
		$task_ids = self::get_user_task_ids( $user_id );

		if ( empty( $task_ids ) ) {
			return new WP_REST_Response( array( 'messages' => array() ), 200 );
		}

		$comments = get_comments(
			array(
				'post__in' => $task_ids,
				'number'   => $limit,
				'status'   => 'approve',
				'orderby'  => 'comment_date_gmt',
				'order'    => 'DESC',
			)
		);

		$messages = array();
		foreach ( $comments as $comment ) {
			$messages[] = array(
				'id'        => (int) $comment->comment_ID,
				'title'     => get_the_title( (int) $comment->comment_post_ID ),
				'from'      => get_comment_author( $comment ),
				'message'   => wp_strip_all_tags( $comment->comment_content ),
				'timestamp' => mysql_to_rfc3339( $comment->comment_date_gmt ),
			);
		}

		return new WP_REST_Response( array( 'messages' => $messages ), 200 );
	}

	/* ── Todo Endpoints ──────────────────────────────────────────────── */

	public static function get_todos( $request ) {
		return class_exists( 'MMED_Todo_Engine' )
			? MMED_Todo_Engine::get_todos( $request )
			: new WP_REST_Response( array( 'todos' => array() ), 200 );
	}

	public static function create_todo( $request ) {
		return class_exists( 'MMED_Todo_Engine' )
			? MMED_Todo_Engine::create_todo( $request )
			: new WP_Error( 'mmed_todo_missing', 'Todo engine is unavailable.', array( 'status' => 500 ) );
	}

	public static function update_todo( $request ) {
		return class_exists( 'MMED_Todo_Engine' )
			? MMED_Todo_Engine::update_todo( $request )
			: new WP_Error( 'mmed_todo_missing', 'Todo engine is unavailable.', array( 'status' => 500 ) );
	}

	public static function delete_todo( $request ) {
		return class_exists( 'MMED_Todo_Engine' )
			? MMED_Todo_Engine::delete_todo( $request )
			: new WP_Error( 'mmed_todo_missing', 'Todo engine is unavailable.', array( 'status' => 500 ) );
	}

	/* ── Bulk Events / Calendar Categories ───────────────────────────── */

	public static function bulk_create_events( $request ) {
		return class_exists( 'MMED_Calendar_Engine' )
			? MMED_Calendar_Engine::bulk_create_events( $request )
			: new WP_Error( 'mmed_calendar_missing', 'Calendar engine is unavailable.', array( 'status' => 500 ) );
	}

	public static function get_calendar_categories() {
		$config = class_exists( 'MMED_Calendar_Engine' ) ? MMED_Calendar_Engine::category_config() : array();

		return new WP_REST_Response(
			array( 'categories' => $config ),
			200
		);
	}

	/**
	 * Admin-level permission callback.
	 */
	public static function can_manage() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Study block list endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_study_blocks( $request ) {
		return class_exists( 'MMED_Study_Schedule' )
			? MMED_Study_Schedule::get_blocks( $request )
			: new WP_Error( 'mmed_study_missing', 'Study schedule is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Study block create endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_study_block( $request ) {
		return class_exists( 'MMED_Study_Schedule' )
			? MMED_Study_Schedule::create_block( $request )
			: new WP_Error( 'mmed_study_missing', 'Study schedule is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Study block update endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_study_block( $request ) {
		return class_exists( 'MMED_Study_Schedule' )
			? MMED_Study_Schedule::update_block( $request )
			: new WP_Error( 'mmed_study_missing', 'Study schedule is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Study block delete endpoint.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function delete_study_block( $request ) {
		return class_exists( 'MMED_Study_Schedule' )
			? MMED_Study_Schedule::delete_block( $request )
			: new WP_Error( 'mmed_study_missing', 'Study schedule is unavailable.', array( 'status' => 500 ) );
	}

	/**
	 * Get enrolled LearnDash course payloads.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_course_items( $user_id ) {
		$user_id = absint( $user_id );

		if ( ! $user_id || ! function_exists( 'learndash_user_get_enrolled_courses' ) ) {
			return array();
		}

		$course_ids = learndash_user_get_enrolled_courses( $user_id );
		if ( ! is_array( $course_ids ) ) {
			return array();
		}

		$courses = array();
		foreach ( $course_ids as $course_id ) {
			$course_id = absint( $course_id );
			if ( ! $course_id ) {
				continue;
			}

			$progress = self::get_learndash_progress( $user_id, $course_id );
			$steps    = self::get_course_step_counts( $user_id, $course_id, $progress );

			$courses[] = array(
				'id'                => $course_id,
				'title'             => get_the_title( $course_id ),
				'instructor'        => self::get_course_instructor( $course_id ),
				'progress'          => $progress['percent'],
				'status'            => self::get_course_status( $progress['percent'] ),
				'lessons_total'     => $steps['lessons_total'],
				'lessons_completed' => $steps['lessons_completed'],
				'quizzes_total'     => $steps['quizzes_total'],
				'quizzes_completed' => $steps['quizzes_completed'],
				'next_lesson'       => $steps['next_lesson'],
				'last_activity'     => null,
				'url'               => get_permalink( $course_id ),
			);
		}

		return $courses;
	}

	/**
	 * Get LearnDash progress for a course.
	 *
	 * @param int $user_id   WordPress user ID.
	 * @param int $course_id LearnDash course ID.
	 * @return array
	 */
	private static function get_learndash_progress( $user_id, $course_id ) {
		$progress = array(
			'total'     => 0,
			'completed' => 0,
			'percent'   => 0,
		);

		if ( function_exists( 'learndash_course_progress' ) ) {
			$raw_progress = learndash_course_progress(
				array(
					'user_id'   => $user_id,
					'course_id' => $course_id,
					'array'     => true,
				)
			);

			if ( is_array( $raw_progress ) ) {
				$progress['total']     = (int) ( $raw_progress['total'] ?? 0 );
				$progress['completed'] = (int) ( $raw_progress['completed'] ?? 0 );
			}
		} elseif ( function_exists( 'learndash_user_get_course_progress' ) ) {
			$raw_progress = learndash_user_get_course_progress( $user_id, $course_id );
			if ( is_array( $raw_progress ) ) {
				$progress['total']     = (int) ( $raw_progress['total'] ?? 0 );
				$progress['completed'] = (int) ( $raw_progress['completed'] ?? 0 );
			}
		}

		if ( $progress['total'] > 0 ) {
			$progress['percent'] = (int) round( ( $progress['completed'] / $progress['total'] ) * 100 );
		}

		return $progress;
	}

	/**
	 * Count course steps and find the next incomplete lesson.
	 *
	 * @param int   $user_id   WordPress user ID.
	 * @param int   $course_id LearnDash course ID.
	 * @param array $progress  LearnDash progress payload.
	 * @return array
	 */
	private static function get_course_step_counts( $user_id, $course_id, $progress ) {
		$counts = array(
			'lessons_total'     => 0,
			'lessons_completed' => 0,
			'quizzes_total'     => 0,
			'quizzes_completed' => 0,
			'next_lesson'       => null,
		);

		if ( ! function_exists( 'learndash_get_course_steps' ) ) {
			$counts['lessons_total']     = $progress['total'];
			$counts['lessons_completed'] = $progress['completed'];
			return $counts;
		}

		$steps = learndash_get_course_steps( $course_id );
		if ( ! is_array( $steps ) ) {
			return $counts;
		}

		foreach ( $steps as $step_id ) {
			$step_id   = absint( $step_id );
			$post_type = get_post_type( $step_id );

			if ( 'sfwd-lessons' === $post_type ) {
				$counts['lessons_total']++;
				$is_complete = self::is_lesson_complete( $user_id, $course_id, $step_id );

				if ( $is_complete ) {
					$counts['lessons_completed']++;
				} elseif ( null === $counts['next_lesson'] ) {
					$counts['next_lesson'] = array(
						'id'    => $step_id,
						'title' => get_the_title( $step_id ),
						'url'   => get_permalink( $step_id ),
					);
				}
			}

			if ( 'sfwd-quiz' === $post_type || 'sfwd-quizzes' === $post_type ) {
				$counts['quizzes_total']++;
				if ( self::is_quiz_complete( $user_id, $course_id, $step_id ) ) {
					$counts['quizzes_completed']++;
				}
			}
		}

		if ( 0 === $counts['lessons_total'] && $progress['total'] > 0 ) {
			$counts['lessons_total']     = $progress['total'];
			$counts['lessons_completed'] = $progress['completed'];
		}

		return $counts;
	}

	/**
	 * Determine lesson completion using available LearnDash helpers.
	 *
	 * @param int $user_id   WordPress user ID.
	 * @param int $course_id Course ID.
	 * @param int $lesson_id Lesson ID.
	 * @return bool
	 */
	private static function is_lesson_complete( $user_id, $course_id, $lesson_id ) {
		if ( function_exists( 'learndash_is_lesson_complete' ) ) {
			return (bool) learndash_is_lesson_complete( $user_id, $lesson_id, $course_id );
		}

		if ( function_exists( 'learndash_is_item_complete' ) ) {
			return (bool) learndash_is_item_complete( $user_id, $lesson_id, $course_id );
		}

		return false;
	}

	/**
	 * Determine quiz completion using available LearnDash helpers.
	 *
	 * @param int $user_id   WordPress user ID.
	 * @param int $course_id Course ID.
	 * @param int $quiz_id   Quiz ID.
	 * @return bool
	 */
	private static function is_quiz_complete( $user_id, $course_id, $quiz_id ) {
		if ( function_exists( 'learndash_is_quiz_complete' ) ) {
			return (bool) learndash_is_quiz_complete( $user_id, $quiz_id, $course_id );
		}

		if ( function_exists( 'learndash_is_item_complete' ) ) {
			return (bool) learndash_is_item_complete( $user_id, $quiz_id, $course_id );
		}

		return false;
	}

	/**
	 * Get course instructor display name.
	 *
	 * @param int $course_id Course ID.
	 * @return string
	 */
	private static function get_course_instructor( $course_id ) {
		$author_id = (int) get_post_field( 'post_author', $course_id );
		if ( ! $author_id ) {
			return '';
		}

		$author = get_user_by( 'id', $author_id );
		return $author ? $author->display_name : '';
	}

	/**
	 * Convert progress percent to API status.
	 *
	 * @param int $progress Progress percent.
	 * @return string
	 */
	private static function get_course_status( $progress ) {
		$progress = (int) $progress;

		if ( $progress >= 100 ) {
			return 'complete';
		}

		if ( $progress > 0 ) {
			return 'in_progress';
		}

		return 'not_started';
	}

	/**
	 * Count current user's Hub tasks.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_task_counts( $user_id ) {
		$task_ids = self::get_user_task_ids( $user_id );
		$counts   = array(
			'total'           => count( $task_ids ),
			'approved'        => 0,
			'pending_review'  => 0,
			'revision_needed' => 0,
			'in_progress'     => 0,
			'not_started'     => 0,
		);

		foreach ( $task_ids as $task_id ) {
			$status = get_post_meta( $task_id, '_mmed_status', true ) ?: 'not_started';

			if ( isset( $counts[ $status ] ) ) {
				$counts[ $status ]++;
			}
		}

		return $counts;
	}

	/**
	 * Get current user's assigned Hub task IDs.
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
						'value' => absint( $user_id ),
						'type'  => 'NUMERIC',
					),
				),
			)
		);
	}

	/**
	 * Get next open Hub task.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_next_open_task( $user_id ) {
		$task_ids = self::get_user_task_ids( $user_id );
		$next     = array(
			'next_step_label'   => '',
			'days_to_next_step' => 0,
		);

		foreach ( $task_ids as $task_id ) {
			$status = get_post_meta( $task_id, '_mmed_status', true ) ?: 'not_started';
			if ( 'approved' === $status ) {
				continue;
			}

			$due_date                    = get_post_meta( $task_id, '_mmed_due_date', true );
			$next['next_step_label']     = get_the_title( $task_id );
			$next['days_to_next_step']   = self::days_until( $due_date );
			break;
		}

		return $next;
	}

	/**
	 * Calculate whole days until a due date.
	 *
	 * @param string $due_date Due date string.
	 * @return int
	 */
	private static function days_until( $due_date ) {
		$due_date = sanitize_text_field( $due_date );
		if ( '' === $due_date ) {
			return 0;
		}

		$due_timestamp   = strtotime( $due_date . ' 00:00:00' );
		$today_timestamp = strtotime( current_time( 'Y-m-d' ) . ' 00:00:00' );

		if ( ! $due_timestamp || ! $today_timestamp ) {
			return 0;
		}

		return max( 0, (int) ceil( ( $due_timestamp - $today_timestamp ) / DAY_IN_SECONDS ) );
	}

	/**
	 * Get WooCommerce Subscriptions summary if available.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return array
	 */
	private static function get_subscription_data( $user_id ) {
		$data = array(
			'status'       => '',
			'plan_name'    => '',
			'renewal_date' => null,
			'auto_renew'   => false,
		);

		if ( ! function_exists( 'wcs_get_users_subscriptions' ) ) {
			return $data;
		}

		$subscriptions = wcs_get_users_subscriptions( $user_id );
		if ( empty( $subscriptions ) || ! is_array( $subscriptions ) ) {
			return $data;
		}

		$selected_subscription = null;
		foreach ( $subscriptions as $subscription ) {
			if ( ! is_object( $subscription ) || ! method_exists( $subscription, 'get_status' ) ) {
				continue;
			}

			$selected_subscription = $subscription;
			if ( 'active' === $subscription->get_status() ) {
				break;
			}
		}

		if ( ! $selected_subscription ) {
			return $data;
		}

		$items = method_exists( $selected_subscription, 'get_items' ) ? $selected_subscription->get_items() : array();
		foreach ( $items as $item ) {
			if ( is_object( $item ) && method_exists( $item, 'get_name' ) ) {
				$data['plan_name'] = $item->get_name();
				break;
			}
		}

		$data['status'] = $selected_subscription->get_status();

		if ( method_exists( $selected_subscription, 'get_date' ) ) {
			$renewal_date = $selected_subscription->get_date( 'next_payment' );
			if ( $renewal_date ) {
				$data['renewal_date'] = $renewal_date;
			}
		}

		if ( method_exists( $selected_subscription, 'get_requires_manual_renewal' ) ) {
			$data['auto_renew'] = ! (bool) $selected_subscription->get_requires_manual_renewal();
		}

		return $data;
	}

	/**
	 * Count advisor/task comment messages for a user.
	 *
	 * @param int $user_id WordPress user ID.
	 * @return int
	 */
	private static function count_messages( $user_id ) {
		$task_ids = self::get_user_task_ids( $user_id );
		if ( empty( $task_ids ) ) {
			return 0;
		}

		$comments = get_comments(
			array(
				'post__in' => $task_ids,
				'count'    => true,
				'status'   => 'approve',
			)
		);

		return absint( $comments );
	}

	/**
	 * Shared positive ID route arg.
	 *
	 * @return array
	 */
	private static function id_args() {
		return array(
			'id' => array(
				'sanitize_callback' => 'absint',
				'validate_callback' => static function ( $param ) {
					return absint( $param ) > 0;
				},
			),
		);
	}

	/**
	 * Shared date range query args.
	 *
	 * @return array
	 */
	private static function event_query_args() {
		return array(
			'start' => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
			'end'   => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
			'type'  => array(
				'sanitize_callback' => 'sanitize_key',
			),
			'source' => array(
				'sanitize_callback' => 'sanitize_key',
			),
			'status' => array(
				'sanitize_callback' => 'sanitize_key',
			),
			'date'   => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
		);
	}

	/**
	 * Calendar validation query args.
	 *
	 * @return array
	 */
	private static function event_validation_args() {
		return array(
			'no_sync'    => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
			'validation' => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
			'sync'       => array(
				'sanitize_callback' => 'sanitize_text_field',
			),
		);
	}

	/**
	 * Shared pagination query args.
	 *
	 * @return array
	 */
	private static function pagination_args() {
		return array(
			'limit'  => array(
				'sanitize_callback' => 'absint',
			),
			'offset' => array(
				'sanitize_callback' => 'absint',
			),
		);
	}
}
