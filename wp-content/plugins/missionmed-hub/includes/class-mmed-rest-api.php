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
			'/user/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_user_stats' ),
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
					'args'                => self::event_query_args(),
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
	 * Allow logged-in users only.
	 *
	 * @return bool
	 */
	public static function can_access() {
		return is_user_logged_in();
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
