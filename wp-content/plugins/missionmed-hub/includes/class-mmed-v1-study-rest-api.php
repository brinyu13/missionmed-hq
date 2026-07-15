<?php
/**
 * Read-only REST bootstrap seam for V1 Study Schedule 8010C.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Registers one distinct, read-only V1 bootstrap route. */
final class MMED_V1_Study_REST_API {

	/** @var SplObjectStorage|null */
	private static $request_cache;

	/** @return void */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'private_no_store' ), 20, 3 );
	}

	/** @return void */
	public static function register_routes() {
		if ( function_exists( 'mmed_hub_is_student_os_enabled' ) && ! mmed_hub_is_student_os_enabled() ) {
			return;
		}
		register_rest_route(
			MMED_V1_Study_Release::REST_NAMESPACE,
			MMED_V1_Study_Release::BOOTSTRAP_ROUTE,
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'get_bootstrap' ),
				'permission_callback' => array( __CLASS__, 'can_read_bootstrap' ),
			)
		);
	}

	/**
	 * @param WP_REST_Request $request REST request.
	 * @return true|WP_Error
	 */
	public static function can_read_bootstrap( $request ) {
		$decision = self::authorize_request( $request );
		return empty( $decision['allowed'] )
			? self::error_from_decision( $decision, $request )
			: true;
	}

	/**
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function get_bootstrap( $request ) {
		$decision = self::authorize_request( $request );
		if ( empty( $decision['allowed'] ) ) {
			return self::error_from_decision( $decision, $request );
		}
		if ( ! class_exists( 'MMED_V1_Study_Loader' ) ) {
			return self::error_from_decision(
				array(
					'error_code'  => 'v1_dependency_unavailable',
					'status'      => 503,
					'reason_code' => 'loader_unavailable',
				),
				$request
			);
		}

		return new WP_REST_Response( MMED_V1_Study_Loader::client_payload( $decision ), 200 );
	}

	/**
	 * Reuse one authorization result across permission and callback phases for
	 * the exact request object. Allows and denials are both request-local.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return array
	 */
	private static function authorize_request( $request ) {
		$cache = self::cache();
		if ( is_object( $request ) && $cache->contains( $request ) ) {
			$entry = $cache[ $request ];
			return $entry['decision'];
		}

		$request_id = self::new_request_id();
		$nonce      = is_object( $request ) && method_exists( $request, 'get_header' )
			? (string) $request->get_header( 'X-WP-Nonce' )
			: '';
		$nonce_verified = '' !== $nonce
			&& function_exists( 'wp_verify_nonce' )
			&& false !== wp_verify_nonce( $nonce, 'wp_rest' );

		$control  = MMED_V1_Study_Control::read();
		$decision = MMED_V1_Study_Access::authorize_rest(
			MMED_V1_Study_Domain::ACTION_PLAN_READ,
			null,
			array(),
			$nonce_verified,
			null,
			null,
			null,
			null,
			$control
		);

		$mode = isset( $decision['mode']['mode'] ) ? $decision['mode']['mode'] : '';
		MMED_V1_Study_Observability::record(
			'authorization_decision',
			array(
				'request_id'         => $request_id,
				'route_id'           => 'bootstrap',
				'action'             => MMED_V1_Study_Domain::ACTION_PLAN_READ,
				'mode'               => $mode,
				'actor_kind'         => isset( $decision['actor_kind'] ) ? $decision['actor_kind'] : 'unknown',
				'outcome'            => ! empty( $decision['allowed'] ) ? 'allow' : 'deny',
				'reason_code'        => isset( $decision['reason_code'] ) ? $decision['reason_code'] : 'unknown',
				'http_status'        => isset( $decision['status'] ) ? $decision['status'] : 500,
				'repository_binding' => self::repository_binding( $decision ),
			)
		);

		if ( is_object( $request ) ) {
			$cache[ $request ] = array(
				'decision'   => $decision,
				'request_id' => $request_id,
			);
		}

		return $decision;
	}

	/**
	 * Convert an internal denial to the public error allowlist.
	 *
	 * @param array           $decision Internal access decision.
	 * @param WP_REST_Request $request REST request.
	 * @return WP_Error
	 */
	public static function error_from_decision( $decision, $request = null ) {
		$code   = isset( $decision['error_code'] ) ? (string) $decision['error_code'] : 'v1_dependency_unavailable';
		$status = isset( $decision['status'] ) ? (int) $decision['status'] : 503;
		$messages = array(
			'v1_unauthenticated'        => 'Authentication required.',
			'v1_csrf_invalid'           => 'Request verification failed.',
			'v1_not_found'              => 'Not found.',
			'v1_write_disabled'         => 'Write unavailable.',
			'v1_revision_conflict'      => 'Request conflict.',
			'v1_idempotency_conflict'   => 'Request conflict.',
			'v1_validation_failed'      => 'Request validation failed.',
			'v1_dependency_unavailable' => 'Service unavailable.',
		);

		return new WP_Error(
			$code,
			isset( $messages[ $code ] ) ? $messages[ $code ] : 'Service unavailable.',
			array(
				'status'     => $status,
				'request_id' => self::request_id( $request ),
				'retryable'  => 503 === $status,
			)
		);
	}

	/**
	 * Apply private/no-store headers to every response in the V1 namespace.
	 *
	 * @param WP_HTTP_Response $response REST response.
	 * @param WP_REST_Server   $server REST server.
	 * @param WP_REST_Request  $request REST request.
	 * @return WP_HTTP_Response
	 */
	public static function private_no_store( $response, $server, $request ) {
		unset( $server );
		$route  = is_object( $request ) && method_exists( $request, 'get_route' ) ? (string) $request->get_route() : '';
		$prefix = '/' . MMED_V1_Study_Release::REST_NAMESPACE . '/';
		if ( 0 !== strpos( $route, $prefix ) || ! is_object( $response ) || ! method_exists( $response, 'header' ) ) {
			return $response;
		}

		$response->header( 'Cache-Control', 'private, no-store, max-age=0, must-revalidate' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'Expires', '0' );
		$response->header( 'Vary', 'Cookie, X-WP-Nonce' );
		return $response;
	}

	/** @return SplObjectStorage */
	private static function cache() {
		if ( ! self::$request_cache instanceof SplObjectStorage ) {
			self::$request_cache = new SplObjectStorage();
		}
		return self::$request_cache;
	}

	/** @return string */
	private static function request_id( $request ) {
		$cache = self::cache();
		if ( is_object( $request ) && $cache->contains( $request ) ) {
			$entry = $cache[ $request ];
			if ( ! empty( $entry['request_id'] ) ) {
				return $entry['request_id'];
			}
		}
		return self::new_request_id();
	}

	/** @return string */
	private static function new_request_id() {
		if ( function_exists( 'wp_generate_uuid4' ) ) {
			return (string) wp_generate_uuid4();
		}
		return 'v1-' . substr( md5( uniqid( '', true ) ), 0, 24 );
	}

	/** @return string */
	private static function repository_binding( $decision ) {
		if ( empty( $decision['mode']['resolved'] ) ) {
			return 'unresolved';
		}
		return ! empty( $decision['mode']['reader_allowed'] ) ? 'reader' : 'none';
	}

	/** Reset request-local state for deterministic process fixtures. @return void */
	public static function reset_for_tests() {
		self::$request_cache = new SplObjectStorage();
	}
}
