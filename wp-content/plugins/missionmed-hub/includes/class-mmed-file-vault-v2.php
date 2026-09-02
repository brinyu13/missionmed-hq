<?php
/**
 * Server-gated File Vault V2 runtime and REST controller.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers a parallel V2 surface while leaving V1 routes and assets intact.
 */
class MMED_File_Vault_V2 {

	const NAMESPACE         = 'mmed/v2';
	const OPTION_MODE       = 'mmed_file_vault_v2_mode';
	const OPTION_BETA_USERS = 'mmed_file_vault_v2_beta_user_ids';
	const CAP_TEST          = 'mmed_test_file_vault_v2';
	const CAP_REVIEW        = 'mmed_review_file_vault';
	const CAP_MANAGE        = 'mmed_manage_file_vault';
	const CAP_FINALIZE      = 'mmed_finalize_file_vault';
	const CAP_AUDIT         = 'mmed_view_file_vault_audit';
	const ASSET_CSS         = 'student-os-file-vault-v2.a6b07c660ab66b82.css';
	const ASSET_JS          = 'student-os-file-vault-v2.bbc7d514717fe1dc.js';

	/**
	 * Register runtime hooks.
	 *
	 * @return void
	 */
	public static function init() {
		if ( 'off' === self::get_mode() ) {
			return;
		}
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 30 );
		add_action( 'wp_ajax_mmed_file_vault_v2_nonce', array( __CLASS__, 'refresh_nonce' ) );
	}

	/**
	 * Register additive V2 routes. V1 route registration is not changed.
	 *
	 * @return void
	 */
	public static function register_routes() {
		if ( 'off' === self::get_mode() ) {
			return;
		}
		self::route( '/file-vault/bootstrap', WP_REST_Server::READABLE, 'get_bootstrap' );
		self::route( '/file-vault/students', WP_REST_Server::READABLE, 'get_students', 'can_staff' );
		self::route( '/file-vault/students/(?P<uid>\d+)', WP_REST_Server::READABLE, 'get_student_vault', 'can_staff', self::id_args( 'uid' ) );
		self::route( '/file-vault/review-queue', WP_REST_Server::READABLE, 'get_review_queue', 'can_staff' );
		self::route( '/file-vault/audit', WP_REST_Server::READABLE, 'get_audit', 'can_audit' );
		self::route( '/file-vault/files/(?P<id>\d+)', WP_REST_Server::READABLE, 'get_file', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/preview', WP_REST_Server::READABLE, 'preview_file', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/download', WP_REST_Server::READABLE, 'download_file', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/audiences', WP_REST_Server::READABLE, 'get_audiences' );
		self::route( '/file-vault/shares', WP_REST_Server::READABLE, 'get_shares' );
		self::route( '/file-vault/shares', WP_REST_Server::CREATABLE, 'create_share', 'can_use_v2', self::share_args() );
		self::route( '/file-vault/shares/(?P<id>\d+)', WP_REST_Server::READABLE, 'get_share', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/shares/(?P<id>\d+)/status', WP_REST_Server::EDITABLE, 'update_share_status', 'can_use_v2', array_merge( self::id_args(), self::share_status_args() ) );
		self::route( '/file-vault/shares/(?P<id>\d+)/preview', WP_REST_Server::READABLE, 'preview_share', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/shares/(?P<id>\d+)/download', WP_REST_Server::READABLE, 'download_share', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/shares/(?P<id>\d+)/recipients', WP_REST_Server::READABLE, 'get_share_recipients', 'can_staff', self::id_args() );
		self::route( '/file-vault/downloads', WP_REST_Server::READABLE, 'get_downloads', 'can_audit' );
		self::route( '/file-vault/uploads', WP_REST_Server::CREATABLE, 'create_upload', 'can_use_v2', self::upload_args( true ) );
		self::route( '/file-vault/uploads/(?P<upload_id>[a-f0-9-]{36})/confirm', WP_REST_Server::CREATABLE, 'confirm_upload', 'can_use_v2', self::confirm_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/versions', WP_REST_Server::CREATABLE, 'create_version', 'can_use_v2', array_merge( self::id_args(), self::upload_args( false ) ) );
		self::route( '/file-vault/files/(?P<id>\d+)/comments', WP_REST_Server::CREATABLE, 'add_comment', 'can_use_v2', array_merge( self::id_args(), self::comment_args() ) );
		self::route( '/file-vault/files/(?P<id>\d+)/comments/(?P<comment_id>[a-f0-9-]{36})/resolve', WP_REST_Server::EDITABLE, 'resolve_comment', 'can_staff', self::id_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/internal-notes', WP_REST_Server::READABLE, 'get_internal_notes', 'can_staff', self::id_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/internal-notes', WP_REST_Server::CREATABLE, 'add_internal_note', 'can_staff', array_merge( self::id_args(), self::comment_args() ) );
		self::route( '/file-vault/files/(?P<id>\d+)/submit', WP_REST_Server::CREATABLE, 'submit_file', 'can_use_v2', self::id_args() );
		self::route( '/file-vault/files/(?P<id>\d+)/status', WP_REST_Server::EDITABLE, 'update_status', 'can_staff', array_merge( self::id_args(), self::status_args() ) );
		self::route( '/file-vault/files/(?P<id>\d+)/score', WP_REST_Server::CREATABLE, 'add_score', 'can_staff', array_merge( self::id_args(), self::score_args() ) );
	}

	/**
	 * Enqueue V2 only after the server authorizes the current user.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		if ( ! class_exists( 'MMED_Hub_Page' ) || ! MMED_Hub_Page::is_hub_page() || ! self::is_user_eligible() ) {
			return;
		}

		$css_path = MMED_HUB_PATH . 'assets/' . self::ASSET_CSS;
		$js_path  = MMED_HUB_PATH . 'assets/' . self::ASSET_JS;
		if ( ! file_exists( $css_path ) || ! file_exists( $js_path ) ) {
			return;
		}

		// The locked Matrix router reads this server-owned permission before V2 mounts.
		wp_add_inline_script(
			'mmed-student-os-js',
			'window.MMED_OS=window.MMED_OS||{};window.MMED_OS.access=window.MMED_OS.access||{};window.MMED_OS.access.module_permissions=window.MMED_OS.access.module_permissions||{};window.MMED_OS.access.module_permissions.filevault=true;',
			'before'
		);

		wp_enqueue_style(
			'mmed-student-os-file-vault-v2-css',
			MMED_HUB_URL . 'assets/' . self::ASSET_CSS,
			array( 'mmed-student-os-css' ),
			null
		);

		$dependencies = array( 'mmed-student-os-js' );
		if ( wp_script_is( 'mmed-student-os-file-vault-js', 'enqueued' ) ) {
			$dependencies[] = 'mmed-student-os-file-vault-js';
		}
		wp_enqueue_script(
			'mmed-student-os-file-vault-v2-js',
			MMED_HUB_URL . 'assets/' . self::ASSET_JS,
			$dependencies,
			null,
			true
		);
		wp_localize_script(
			'mmed-student-os-file-vault-v2-js',
			'mmedFileVaultV2Config',
			array(
				'mode'        => self::get_mode(),
				'role'        => self::role_for_user(),
				'viewerName'  => sanitize_text_field( wp_get_current_user()->display_name ),
				'restUrl'     => untrailingslashit( rest_url( self::NAMESPACE . '/file-vault' ) ),
				'matrixUrl'   => home_url( '/member-dashboard/' ),
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'maxFileSize'     => MMED_File_Vault_V2_Repository::MAX_FILE_SIZE,
				'nonceRefreshUrl' => admin_url( 'admin-ajax.php?action=mmed_file_vault_v2_nonce' ),
				'v1'          => array(
					'css' => MMED_HUB_URL . 'assets/student-os-file-vault.css',
					'js'  => MMED_HUB_URL . 'assets/student-os-file-vault.js',
				),
			)
		);
	}

	/**
	 * Return the server-controlled exposure mode.
	 *
	 * @return string
	 */
	public static function get_mode() {
		$value = defined( 'MMED_FILE_VAULT_V2_MODE' ) ? MMED_FILE_VAULT_V2_MODE : get_option( self::OPTION_MODE, 'off' );
		$value = sanitize_key( $value );
		return in_array( $value, array( 'off', 'internal', 'beta', 'on' ), true ) ? $value : 'off';
	}

	/**
	 * Refresh the REST nonce for an authenticated eligible browser session.
	 *
	 * Long-lived Matrix tabs can outlive a WordPress REST nonce. The refresh
	 * endpoint is cookie-authenticated and intentionally returns no Vault data.
	 *
	 * @return void
	 */
	public static function refresh_nonce() {
		nocache_headers();
		if ( ! is_user_logged_in() || ! get_current_user_id() ) {
			wp_send_json_error( array( 'code' => 'mmed_file_vault_v2_auth_required' ), 401 );
		}
		if ( ! self::is_user_eligible() ) {
			wp_send_json_error( array( 'code' => 'rest_no_route' ), 404 );
		}
		wp_send_json_success( array( 'nonce' => wp_create_nonce( 'wp_rest' ) ) );
	}

	/**
	 * Evaluate exposure entirely on the server.
	 *
	 * @param int $user_id Optional user ID.
	 * @return bool
	 */
	public static function is_user_eligible( $user_id = 0 ) {
		$user_id = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( ! $user_id || ! is_user_logged_in() ) {
			return false;
		}

		$mode     = self::get_mode();
		$internal = user_can( $user_id, self::CAP_TEST ) || user_can( $user_id, self::CAP_MANAGE );
		if ( 'internal' === $mode ) {
			return $internal;
		}
		if ( 'beta' === $mode ) {
			return $internal || ( in_array( $user_id, self::beta_user_ids(), true ) && self::has_student_entitlement( $user_id ) );
		}
		if ( 'on' === $mode ) {
			return $internal || self::has_student_entitlement( $user_id );
		}
		return false;
	}

	/**
	 * Return the authoritative viewer role.
	 *
	 * @param int $user_id Optional user ID.
	 * @return string
	 */
	public static function role_for_user( $user_id = 0 ) {
		$user_id = $user_id ? absint( $user_id ) : get_current_user_id();
		if ( $user_id && user_can( $user_id, self::CAP_MANAGE ) ) {
			return 'admin';
		}
		if ( $user_id && user_can( $user_id, self::CAP_REVIEW ) ) {
			return 'mentor';
		}
		return 'student';
	}

	/**
	 * V2 permission callback.
	 *
	 * @return true|WP_Error
	 */
	public static function can_use_v2( $request = null ) {
		$auth = self::require_wp_browser_auth( $request );
		if ( is_wp_error( $auth ) ) {
			return $auth;
		}
		return self::rollout_decision( get_current_user_id() );
	}

	/**
	 * Staff permission callback, scoped further inside each endpoint.
	 *
	 * @return true|WP_Error
	 */
	public static function can_staff( $request = null ) {
		$eligible = self::can_use_v2( $request );
		if ( is_wp_error( $eligible ) ) {
			return $eligible;
		}
		if ( in_array( self::role_for_user(), array( 'admin', 'mentor' ), true ) ) {
			return true;
		}
		return new WP_Error( 'mmed_file_vault_v2_forbidden', 'You do not have permission to review student documents.', array( 'status' => 403 ) );
	}

	/**
	 * Audit permission callback.
	 *
	 * @param WP_REST_Request|null $request Request.
	 * @return true|WP_Error
	 */
	public static function can_audit( $request = null ) {
		$eligible = self::can_use_v2( $request );
		if ( is_wp_error( $eligible ) ) {
			return $eligible;
		}
		if ( current_user_can( self::CAP_AUDIT ) || current_user_can( self::CAP_MANAGE ) ) {
			return true;
		}
		return new WP_Error( 'mmed_file_vault_v2_forbidden', 'You do not have permission to view File Vault audit events.', array( 'status' => 403 ) );
	}

	/**
	 * Bootstrap the current role lens.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_bootstrap( $request ) {
		$role      = self::role_for_user();
		$viewer_id = get_current_user_id();
		$target_id = 'student' === $role ? $viewer_id : absint( $request->get_param( 'student_id' ) );
		if ( $target_id && ! self::can_view_student( $target_id ) ) {
			return self::forbidden_student();
		}

		$data                 = MMED_File_Vault_V2_Repository::bootstrap( $target_id, $role );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$data['mode']         = self::get_mode();
		$data['capabilities'] = self::capabilities( $target_id );
		if ( 'student' !== $role ) {
			$data['students']         = array();
			$data['review_queue']     = array();
			$data['command']          = self::command_summary( array(), array() );
			$data['staff_pagination'] = array(
				'page'      => 0,
				'per_page'  => 50,
				'has_more'  => true,
				'next_page' => 1,
				'deferred'  => true,
			);
		}
		return new WP_REST_Response( $data, 200 );
	}

	/**
	 * Return one staff-visible student vault.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_student_vault( $request ) {
		$student_id = absint( $request['uid'] );
		if ( ! self::can_view_student( $student_id ) ) {
			return self::forbidden_student();
		}
		$data                 = MMED_File_Vault_V2_Repository::bootstrap( $student_id, self::role_for_user() );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		$data['mode']         = self::get_mode();
		$data['capabilities'] = self::capabilities( $student_id );
		return new WP_REST_Response( $data, 200 );
	}

	/**
	 * List staff-visible students.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_students( $request ) {
		$scope = MMED_File_Vault_V2_Repository::staff_scope(
			self::role_for_user(),
			get_current_user_id(),
			$request->get_param( 'search' ),
			$request->get_param( 'page' ),
			$request->get_param( 'per_page' )
		);
		if ( is_wp_error( $scope ) ) {
			return $scope;
		}
		return new WP_REST_Response(
			array(
				'students'     => $scope['students'],
				'review_queue' => $scope['review_queue'],
				'pagination'   => $scope['pagination'],
				'command'      => self::command_summary( $scope['students'], $scope['review_queue'] ),
			),
			200
		);
	}

	/**
	 * Return staff review queue.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_review_queue( $request ) {
		$scope = MMED_File_Vault_V2_Repository::staff_scope( self::role_for_user(), get_current_user_id(), '', $request->get_param( 'page' ), $request->get_param( 'per_page' ) );
		if ( is_wp_error( $scope ) ) {
			return $scope;
		}
		return new WP_REST_Response( array( 'queue' => $scope['review_queue'], 'pagination' => $scope['pagination'] ), 200 );
	}

	/**
	 * Return permission-filtered audit events.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_audit( $request ) {
		$scope = MMED_File_Vault_V2_Repository::audit_scope(
			self::role_for_user(),
			get_current_user_id(),
			$request->get_param( 'page' ),
			$request->get_param( 'per_page' ),
			$request->get_param( 'before_at' ),
			$request->get_param( 'before_id' ),
			$request->get_param( 'event_limit' )
		);
		if ( is_wp_error( $scope ) ) {
			return $scope;
		}
		return new WP_REST_Response( $scope, 200 );
	}

	/**
	 * Return one authorized document.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_file( $request ) {
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$result = MMED_File_Vault_V2_Repository::get_document( $request['id'] );
		return self::response( $result );
	}

	/**
	 * Start a signed upload for the current student or a staff-visible student.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_upload( $request ) {
		$params = self::json_params( $request );
		$role   = self::role_for_user();
		if ( ! empty( $params['share_as_mission_file'] ) && 'admin' !== self::role_for_user() ) {
			return new WP_Error( 'mmed_file_vault_v2_mission_file_forbidden', 'Only File Vault administrators can share a Mission File.', array( 'status' => 403 ) );
		}
		$share_source = sanitize_key( $params['share_source'] ?? '' );
		if ( $share_source && ! in_array( $share_source, array( 'missionmed', 'student_shared' ), true ) ) {
			return new WP_Error( 'mmed_file_vault_v2_share_source', 'The sharing source is invalid.', array( 'status' => 422 ) );
		}
		if ( ( 'missionmed' === $share_source && 'admin' !== $role ) || ( 'student_shared' === $share_source && 'student' !== $role ) ) {
			return new WP_Error( 'mmed_file_vault_v2_share_forbidden', 'Your role cannot create this shared file.', array( 'status' => 403 ) );
		}
		if ( 'missionmed' === $share_source ) {
			$params['share_as_mission_file'] = true;
		}
		$target_id = $share_source ? get_current_user_id() : self::target_student_id( $params['student_id'] ?? 0 );
		if ( is_wp_error( $target_id ) ) {
			return $target_id;
		}
		$result = MMED_File_Vault_V2_Repository::create_upload_intent( $target_id, get_current_user_id(), $params );
		return self::response( $result, 201 );
	}

	/**
	 * Start a new immutable version upload.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function create_version( $request ) {
		if ( 'mentor' === self::role_for_user() ) {
			return new WP_Error( 'mmed_file_vault_v2_upload_forbidden', 'Reviewers cannot upload files for a student.', array( 'status' => 403 ) );
		}
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$result = MMED_File_Vault_V2_Repository::create_upload_intent( MMED_File_Vault_V2_Repository::owner_id( $request['id'] ), get_current_user_id(), self::json_params( $request ), $request['id'] );
		return self::response( $result, 201 );
	}

	/**
	 * Finalize a signed upload intent.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function confirm_upload( $request ) {
		$params = self::json_params( $request );
		$result = MMED_File_Vault_V2_Repository::confirm_upload_intent( $request['upload_id'], $params['confirm_token'] ?? '', get_current_user_id() );
		return self::response( $result );
	}

	/**
	 * Issue an authorized signed download.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function download_file( $request ) {
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		return self::response( MMED_File_Vault_V2_Repository::download( $request['id'], $request->get_param( 'version' ), get_current_user_id() ) );
	}

	/** Issue a lazy authorized inline preview for a private document. */
	public static function preview_file( $request ) {
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		return self::response( MMED_File_Vault_V2_Repository::preview( $request['id'], $request->get_param( 'version' ) ) );
	}

	/** Return server-filtered current enrollment audiences. */
	public static function get_audiences( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::audience_directory( get_current_user_id(), self::role_for_user(), $request->get_param( 'search' ), $request->get_param( 'page' ), $request->get_param( 'per_page' ) ) );
	}

	/** Return shares visible to the current viewer. */
	public static function get_shares( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::list_shares( get_current_user_id(), self::role_for_user(), $request->get_param( 'source_class' ), $request->get_param( 'page' ), $request->get_param( 'per_page' ), $request->get_param( 'search' ) ) );
	}

	/** Publish a verified private source file to a server-authorized audience. */
	public static function create_share( $request ) {
		$params = self::json_params( $request );
		return self::response( MMED_File_Vault_V2_Repository::publish_share( $params['file_id'] ?? 0, get_current_user_id(), self::role_for_user(), $params ), 201 );
	}

	/** Return one authorized shared resource. */
	public static function get_share( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::get_share( $request['id'], get_current_user_id(), self::role_for_user(), true ) );
	}

	/** Change share moderation state without deleting evidence. */
	public static function update_share_status( $request ) {
		$params = self::json_params( $request );
		return self::response( MMED_File_Vault_V2_Repository::update_share_status( $request['id'], get_current_user_id(), self::role_for_user(), $params['status'] ?? '' ) );
	}

	/** Issue a lazy authorized preview for a shared resource. */
	public static function preview_share( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::preview_share( $request['id'], get_current_user_id(), self::role_for_user() ) );
	}

	/** Issue and audit one shared-resource download. */
	public static function download_share( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::download_share( $request['id'], get_current_user_id(), self::role_for_user() ) );
	}

	/** Return recipient download status for staff. */
	public static function get_share_recipients( $request ) {
		$share = MMED_File_Vault_V2_Repository::get_share( $request['id'], get_current_user_id(), self::role_for_user(), true );
		if ( is_wp_error( $share ) ) {
			return $share;
		}
		return self::response( MMED_File_Vault_V2_Repository::recipient_status( $request['id'], $request->get_param( 'page' ), $request->get_param( 'per_page' ) ) );
	}

	/** Return normalized download evidence for authorized staff. */
	public static function get_downloads( $request ) {
		return self::response( MMED_File_Vault_V2_Repository::download_activity( $request->get_param( 'page' ), $request->get_param( 'per_page' ) ) );
	}

	/**
	 * Add an authorized persistent comment.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function add_comment( $request ) {
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$params = self::json_params( $request );
		$result = MMED_File_Vault_V2_Repository::add_comment( $request['id'], get_current_user_id(), self::role_for_user(), $params['body'] ?? '' );
		return self::response( $result, 201 );
	}

	/**
	 * Resolve a comment as assigned staff.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function resolve_comment( $request ) {
		$access = self::assert_file_access( $request['id'], true );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		return self::response( MMED_File_Vault_V2_Repository::resolve_comment( $request['id'], $request['comment_id'], get_current_user_id() ) );
	}

	/**
	 * Return staff-only notes without including them in student document data.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_internal_notes( $request ) {
		$access = self::assert_file_access( $request['id'], true );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		return self::response( MMED_File_Vault_V2_Repository::internal_notes( $request['id'] ) );
	}

	/**
	 * Add one staff-only note to an authorized document.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function add_internal_note( $request ) {
		$access = self::assert_file_access( $request['id'], true );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$params = self::json_params( $request );
		return self::response( MMED_File_Vault_V2_Repository::add_internal_note( $request['id'], get_current_user_id(), $params['body'] ?? '' ), 201 );
	}

	/**
	 * Submit a student-owned document for review.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function submit_file( $request ) {
		if ( 'student' !== self::role_for_user() || MMED_File_Vault_V2_Repository::owner_id( $request['id'] ) !== get_current_user_id() ) {
			return new WP_Error( 'mmed_file_vault_v2_submit_forbidden', 'Only the document owner can submit this file for review.', array( 'status' => 403 ) );
		}
		$access = self::assert_file_access( $request['id'] );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$verified = self::require_verified_current_version( $request['id'] );
		if ( is_wp_error( $verified ) ) {
			return $verified;
		}
		return self::response( MMED_File_Vault_V2_Repository::update_status( $request['id'], 'submitted', get_current_user_id(), '' ) );
	}

	/**
	 * Update staff review status.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function update_status( $request ) {
		$access = self::assert_file_access( $request['id'], true );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$verified = self::require_verified_current_version( $request['id'] );
		if ( is_wp_error( $verified ) ) {
			return $verified;
		}
		$params = self::json_params( $request );
		$status = sanitize_key( $params['status'] ?? '' );
		if ( 'mentor' === self::role_for_user() ) {
			$document = MMED_File_Vault_V2_Repository::get_document( $request['id'] );
			$current  = is_wp_error( $document ) ? '' : sanitize_key( $document['status'] ?? '' );
			$allowed  = array(
				'submitted' => array( 'in_review' ),
				'in_review' => array( 'needs_changes', 'reviewed' ),
			);
			if ( ! in_array( $status, $allowed[ $current ] ?? array(), true ) ) {
				return new WP_Error( 'mmed_file_vault_v2_status_forbidden', 'That review transition requires a File Vault manager.', array( 'status' => 403 ) );
			}
		}
		if ( 'final' === $status && ! current_user_can( self::CAP_FINALIZE ) && ! current_user_can( self::CAP_MANAGE ) ) {
			return new WP_Error( 'mmed_file_vault_v2_finalize_forbidden', 'Final approval requires the File Vault finalize capability.', array( 'status' => 403 ) );
		}
		return self::response( MMED_File_Vault_V2_Repository::update_status( $request['id'], $status, get_current_user_id(), $params['note'] ?? '' ) );
	}

	/**
	 * Add a staff rubric score.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function add_score( $request ) {
		$access = self::assert_file_access( $request['id'], true );
		if ( is_wp_error( $access ) ) {
			return $access;
		}
		$verified = self::require_verified_current_version( $request['id'] );
		if ( is_wp_error( $verified ) ) {
			return $verified;
		}
		return self::response( MMED_File_Vault_V2_Repository::add_score( $request['id'], get_current_user_id(), self::json_params( $request ) ), 201 );
	}

	/**
	 * Determine whether the current viewer may access one student.
	 *
	 * @param int $student_id Student ID.
	 * @return bool
	 */
	public static function can_view_student( $student_id ) {
		$viewer_id = get_current_user_id();
		$role      = self::role_for_user();
		if ( ! MMED_File_Vault_V2_Repository::is_eligible_student( absint( $student_id ) ) ) {
			return false;
		}
		if ( 'admin' === $role ) {
			return true;
		}
		if ( 'mentor' === $role ) {
			return MMED_File_Vault_V2_Repository::mentor_can_view( $viewer_id, absint( $student_id ) );
		}
		return $viewer_id === absint( $student_id );
	}

	/**
	 * Register one route.
	 *
	 * @param string $path Route path.
	 * @param string $methods REST methods.
	 * @param string $callback Method name.
	 * @param string $permission Permission method.
	 * @param array  $args Route args.
	 * @return void
	 */
	protected static function route( $path, $methods, $callback, $permission = 'can_use_v2', $args = array() ) {
		register_rest_route(
			self::NAMESPACE,
			$path,
			array(
				'methods'             => $methods,
				'callback'            => array( __CLASS__, $callback ),
				'permission_callback' => array( __CLASS__, $permission ),
				'args'                => $args,
			)
		);
	}

	/**
	 * Numeric route argument definition.
	 *
	 * @param string $name Argument name.
	 * @return array
	 */
	protected static function id_args( $name = 'id' ) {
		return array(
			$name => array(
				'required'          => true,
				'sanitize_callback' => 'absint',
				'validate_callback' => static function ( $value ) {
					return absint( $value ) > 0;
				},
			),
		);
	}

	/** @return array */
	protected static function upload_args( $include_student ) {
		$args = array(
			'filename'         => array( 'required' => true, 'type' => 'string' ),
			'mime_type'        => array( 'required' => true, 'type' => 'string' ),
			'file_size'        => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ),
			'document_type'    => array( 'type' => 'string' ),
			'display_name'     => array( 'type' => 'string' ),
			'program'          => array( 'type' => 'string', 'maxLength' => 180, 'enum' => MMED_File_Vault_V2_Repository::approved_programs() ),
			'session_letter'   => array( 'type' => 'string', 'pattern' => '^[A-Ga-g]$' ),
			'draft_label'      => array( 'type' => 'string', 'pattern' => '^(?:(?:Draft|Version)[0-9]{2,3}|Final)$' ),
			'version_number'   => array( 'type' => 'integer', 'minimum' => 1 ),
			'is_final'         => array( 'type' => 'boolean' ),
			'note'             => array( 'type' => 'string' ),
			'sha256'           => array( 'required' => true, 'type' => 'string', 'pattern' => '^[a-fA-F0-9]{64}$' ),
			'ready_for_review' => array( 'type' => 'boolean' ),
			'share_as_mission_file' => array( 'type' => 'boolean' ),
			'share_source'    => array( 'type' => 'string', 'enum' => array( 'missionmed', 'student_shared' ) ),
		);
		if ( $include_student ) {
			$args['student_id'] = array( 'type' => 'integer', 'minimum' => 1 );
		}
		return $args;
	}

	/** @return array */
	protected static function confirm_args() {
		return array(
			'confirm_token' => array( 'required' => true, 'type' => 'string', 'pattern' => '^[a-fA-F0-9]{64}$' ),
		);
	}

	/** @return array */
	protected static function comment_args() {
		return array(
			'body' => array( 'required' => true, 'type' => 'string', 'minLength' => 1, 'maxLength' => MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT ),
		);
	}

	/** @return array */
	protected static function status_args() {
		return array(
			'status' => array( 'required' => true, 'type' => 'string' ),
			'note'   => array( 'type' => 'string', 'maxLength' => MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT ),
		);
	}

	/** @return array */
	protected static function share_args() {
		return array(
			'file_id'       => array( 'required' => true, 'type' => 'integer', 'minimum' => 1 ),
			'title'         => array( 'required' => true, 'type' => 'string', 'minLength' => 1, 'maxLength' => MMED_File_Vault_V2_Repository::SHARE_TITLE_LENGTH_LIMIT ),
			'description'   => array( 'type' => 'string', 'maxLength' => MMED_File_Vault_V2_Repository::SHARE_DESCRIPTION_LENGTH_LIMIT ),
			'category'      => array( 'type' => 'string', 'maxLength' => 80 ),
			'audience_mode' => array( 'required' => true, 'type' => 'string', 'enum' => array( 'all_eligible', 'groups', 'selected' ) ),
			'group_ids'     => array( 'type' => 'array', 'maxItems' => MMED_File_Vault_V2_Repository::SHARE_GROUP_LIMIT, 'items' => array( 'type' => 'integer', 'minimum' => 1 ) ),
			'user_ids'      => array( 'type' => 'array', 'maxItems' => MMED_File_Vault_V2_Repository::SHARE_RECIPIENT_LIMIT, 'items' => array( 'type' => 'integer', 'minimum' => 1 ) ),
		);
	}

	/** @return array */
	protected static function share_status_args() {
		return array(
			'status' => array( 'required' => true, 'type' => 'string', 'enum' => array( 'active', 'disabled', 'archived' ) ),
		);
	}

	/** @return array */
	protected static function score_args() {
		return array(
			'total_score'     => array( 'type' => 'integer', 'minimum' => 0 ),
			'category_scores' => array( 'required' => true, 'type' => 'object' ),
			'notes'           => array( 'type' => 'string', 'maxLength' => MMED_File_Vault_V2_Repository::NOTE_LENGTH_LIMIT ),
		);
	}

	/**
	 * Read JSON params safely.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array
	 */
	protected static function json_params( $request ) {
		$params = $request->get_json_params();
		return is_array( $params ) ? $params : array();
	}

	/**
	 * Resolve a requested student without letting students choose another owner.
	 *
	 * @param int $requested_id Requested student.
	 * @return int|WP_Error
	 */
	protected static function target_student_id( $requested_id ) {
		$role = self::role_for_user();
		if ( 'student' === $role ) {
			return get_current_user_id();
		}
		if ( 'admin' !== $role ) {
			return new WP_Error( 'mmed_file_vault_v2_upload_forbidden', 'Reviewers cannot upload files for a student.', array( 'status' => 403 ) );
		}
		$requested_id = absint( $requested_id );
		if ( ! $requested_id || ! self::can_view_student( $requested_id ) ) {
			return self::forbidden_student();
		}
		return $requested_id;
	}

	/**
	 * Check file ownership/assignment.
	 *
	 * @param int  $file_id File ID.
	 * @param bool $staff_required Require staff role.
	 * @return true|WP_Error
	 */
	protected static function assert_file_access( $file_id, $staff_required = false ) {
		$owner_id = MMED_File_Vault_V2_Repository::owner_id( $file_id );
		if ( ! $owner_id ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		if ( ! self::can_view_student( $owner_id ) ) {
			return new WP_Error( 'mmed_file_vault_v2_not_found', 'Document not found.', array( 'status' => 404 ) );
		}
		if ( $staff_required && ! in_array( self::role_for_user(), array( 'admin', 'mentor' ), true ) ) {
			return new WP_Error( 'mmed_file_vault_v2_forbidden', 'Staff permission is required.', array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Prevent unverified legacy bytes from entering trusted review workflow.
	 *
	 * @param int $file_id File ID.
	 * @return true|WP_Error
	 */
	protected static function require_verified_current_version( $file_id ) {
		if ( MMED_File_Vault_V2_Repository::current_version_verified( $file_id ) ) {
			return true;
		}
		return new WP_Error( 'mmed_file_vault_v2_version_unverified', 'Upload and verify a V2 version before submitting, reviewing, or scoring this document.', array( 'status' => 409 ) );
	}

	/**
	 * Return role capabilities for the selected vault.
	 *
	 * @param int $student_id Selected student.
	 * @return array
	 */
	protected static function capabilities( $student_id ) {
		$role = self::role_for_user();
		return array(
			'upload'           => in_array( $role, array( 'student', 'admin' ), true ) && $student_id > 0 && self::can_view_student( $student_id ),
			'download'         => $student_id > 0 && self::can_view_student( $student_id ),
			'comment'          => $student_id > 0 && self::can_view_student( $student_id ),
			'submit'           => 'student' === $role && $student_id === get_current_user_id(),
			'review'           => in_array( $role, array( 'admin', 'mentor' ), true ) && $student_id > 0,
			'score'            => in_array( $role, array( 'admin', 'mentor' ), true ) && $student_id > 0,
			'finalize'         => current_user_can( self::CAP_FINALIZE ) || current_user_can( self::CAP_MANAGE ),
			'view_audit'       => current_user_can( self::CAP_AUDIT ) || current_user_can( self::CAP_MANAGE ),
			'view_student_list'=> in_array( $role, array( 'admin', 'mentor' ), true ),
			'internal_notes'   => in_array( $role, array( 'admin', 'mentor' ), true ) && $student_id > 0,
			'share_mission_file'=> 'admin' === $role,
			'share_student_file'=> 'student' === $role && $student_id === get_current_user_id(),
			'preview'           => $student_id > 0 && self::can_view_student( $student_id ),
		);
	}

	/**
	 * Return explicit beta cohort IDs.
	 *
	 * @return array
	 */
	protected static function beta_user_ids() {
		$value = get_option( self::OPTION_BETA_USERS, array() );
		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			$value   = is_array( $decoded ) ? $decoded : preg_split( '/[\s,]+/', $value );
		}
		return array_values( array_unique( array_filter( array_map( 'absint', $value ) ) ) );
	}

	/**
	 * Require same-origin WordPress cookie and header nonce authentication.
	 *
	 * @param WP_REST_Request|null $request Request.
	 * @return true|WP_Error
	 */
	protected static function require_wp_browser_auth( $request ) {
		if ( ! is_user_logged_in() || ! get_current_user_id() ) {
			return new WP_Error( 'mmed_file_vault_v2_auth_required', 'Authentication is required.', array( 'status' => 401 ) );
		}
		if ( ! $request || ! method_exists( $request, 'get_header' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_nonce_required', 'A valid REST nonce is required.', array( 'status' => 403 ) );
		}
		if ( '' !== trim( (string) $request->get_header( 'authorization' ) ) ) {
			return new WP_Error( 'mmed_file_vault_v2_auth_method', 'File Vault requires same-origin browser authentication.', array( 'status' => 403 ) );
		}
		$nonce = trim( (string) $request->get_header( 'x-wp-nonce' ) );
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_nonce_invalid', 'The REST nonce is missing or invalid.', array( 'status' => 403 ) );
		}

		$method = method_exists( $request, 'get_method' ) ? strtoupper( (string) $request->get_method() ) : 'GET';
		$origin = trim( (string) $request->get_header( 'origin' ) );
		$safe_method = in_array( $method, array( 'GET', 'HEAD', 'OPTIONS' ), true );
		if ( ( $origin && ! self::is_same_origin( $origin, home_url( '/' ) ) ) || ( ! $safe_method && ! $origin ) ) {
			return new WP_Error( 'mmed_file_vault_v2_origin_invalid', 'The request origin is not allowed.', array( 'status' => 403 ) );
		}

		return true;
	}

	/**
	 * Resolve mode, cohort and entitlement without browser-owned decisions.
	 *
	 * @param int $user_id User ID.
	 * @return true|WP_Error
	 */
	protected static function rollout_decision( $user_id ) {
		$user_id  = absint( $user_id );
		$mode     = self::get_mode();
		$internal = user_can( $user_id, self::CAP_TEST ) || user_can( $user_id, self::CAP_MANAGE );
		$hidden   = new WP_Error( 'rest_no_route', 'No route was found matching the URL and request method.', array( 'status' => 404 ) );

		if ( 'off' === $mode ) {
			return $hidden;
		}
		if ( 'internal' === $mode ) {
			return $internal ? true : $hidden;
		}
		if ( $internal ) {
			return true;
		}
		if ( 'beta' === $mode && ! in_array( $user_id, self::beta_user_ids(), true ) ) {
			return $hidden;
		}

		$entitlement = self::student_entitlement_decision( $user_id );
		if ( is_wp_error( $entitlement ) ) {
			return $entitlement;
		}
		return $entitlement ? true : $hidden;
	}

	/**
	 * Resolve File Vault entitlement from the authoritative Matrix Access Gate.
	 *
	 * @param int $user_id User ID.
	 * @return bool|WP_Error
	 */
	protected static function student_entitlement_decision( $user_id ) {
		if ( ! class_exists( 'MMED_Access_Gate' ) || ! method_exists( 'MMED_Access_Gate', 'get_access_payload' ) ) {
			return new WP_Error( 'mmed_file_vault_v2_access_unavailable', 'File Vault access could not be verified.', array( 'status' => 503 ) );
		}
		$payload = MMED_Access_Gate::get_access_payload( absint( $user_id ) );
		if ( ! is_array( $payload ) || ! array_key_exists( 'is_enrolled', $payload ) || ! isset( $payload['free_modules'] ) || ! is_array( $payload['free_modules'] ) ) {
			return new WP_Error( 'mmed_file_vault_v2_access_unavailable', 'File Vault access could not be verified.', array( 'status' => 503 ) );
		}
		$free_modules = array_values( array_filter( array_map( 'sanitize_key', $payload['free_modules'] ) ) );
		return true === $payload['is_enrolled'] || in_array( 'filevault', $free_modules, true );
	}

	/**
	 * Boolean entitlement helper for enqueue selection.
	 *
	 * @param int $user_id User ID.
	 * @return bool
	 */
	protected static function has_student_entitlement( $user_id ) {
		return true === self::student_entitlement_decision( $user_id );
	}

	/**
	 * Compare two origins by scheme, host and effective port.
	 *
	 * @param string $candidate Candidate origin.
	 * @param string $canonical Canonical site URL.
	 * @return bool
	 */
	protected static function is_same_origin( $candidate, $canonical ) {
		$left  = wp_parse_url( $candidate );
		$right = wp_parse_url( $canonical );
		if ( ! is_array( $left ) || ! is_array( $right ) || empty( $left['scheme'] ) || empty( $left['host'] ) ) {
			return false;
		}
		$left_port  = isset( $left['port'] ) ? absint( $left['port'] ) : ( 'https' === strtolower( $left['scheme'] ) ? 443 : 80 );
		$right_port = isset( $right['port'] ) ? absint( $right['port'] ) : ( 'https' === strtolower( $right['scheme'] ) ? 443 : 80 );
		return strtolower( $left['scheme'] ) === strtolower( $right['scheme'] )
			&& strtolower( $left['host'] ) === strtolower( $right['host'] )
			&& $left_port === $right_port;
	}

	/**
	 * Build four real command metrics.
	 *
	 * @param array $students Students.
	 * @param array $queue Queue.
	 * @return array
	 */
	protected static function command_summary( $students, $queue ) {
		$documents = array_sum( array_map( static function ( $student ) { return absint( $student['document_count'] ?? 0 ); }, $students ) );
		$attention = array_sum( array_map( static function ( $student ) { return absint( $student['needs_attention'] ?? 0 ); }, $students ) );
		return array(
			'student_count'   => count( $students ),
			'document_count'  => $documents,
			'review_count'    => count( $queue ),
			'attention_count' => $attention,
		);
	}

	/**
	 * Convert repository result to REST response.
	 *
	 * @param mixed $result Result.
	 * @param int   $status Success status.
	 * @return WP_REST_Response|WP_Error
	 */
	protected static function response( $result, $status = 200 ) {
		return is_wp_error( $result ) ? $result : new WP_REST_Response( $result, $status );
	}

	/**
	 * Consistent fail-closed student access error.
	 *
	 * @return WP_Error
	 */
	protected static function forbidden_student() {
		return new WP_Error( 'mmed_file_vault_v2_student_not_found', 'Student vault not found.', array( 'status' => 404 ) );
	}
}
