<?php
/**
 * Deterministic 8010C REST request-cache, response, and loader isolation proof.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );
$root = dirname( __DIR__, 2 );
define( 'MMED_HUB_PATH', $root . '/wp-content/plugins/missionmed-hub/' );
define( 'MMED_HUB_URL', 'https://example.invalid/wp-content/plugins/missionmed-hub/' );

$GLOBALS['v1_hooks']             = array();
$GLOBALS['v1_filters']           = array();
$GLOBALS['v1_options']           = array();
$GLOBALS['v1_routes']            = array();
$GLOBALS['v1_enqueued_scripts']  = array();
$GLOBALS['v1_enqueued_styles']   = array();
$GLOBALS['v1_inline_scripts']    = array();
$GLOBALS['v1_registered_script'] = array();
$GLOBALS['v1_registered_style']  = array();
$GLOBALS['v1_nonce_calls']       = 0;
$GLOBALS['v1_user_id']           = 10;
$GLOBALS['v1_logged_in']         = true;

function absint( $value ) {
	return abs( (int) $value );
}

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['v1_hooks'][ $hook ][] = array( $callback, $priority, $accepted_args );
}

function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	$GLOBALS['v1_hooks'][ $hook ][] = array( $callback, $priority, $accepted_args );
}

function apply_filters( $hook, $value ) {
	$args = func_get_args();
	if ( isset( $GLOBALS['v1_filters'][ $hook ] ) ) {
		return call_user_func_array( $GLOBALS['v1_filters'][ $hook ], array_slice( $args, 1 ) );
	}
	return $value;
}

function get_option( $key, $default = false ) {
	return array_key_exists( $key, $GLOBALS['v1_options'] ) ? $GLOBALS['v1_options'][ $key ] : $default;
}

function is_user_logged_in() {
	return true === $GLOBALS['v1_logged_in'];
}

function get_current_user_id() {
	return (int) $GLOBALS['v1_user_id'];
}

function user_can( $user_id, $capability ) {
	unset( $user_id, $capability );
	return false;
}

function mmed_hub_is_student_os_enabled() {
	return true;
}

function wp_verify_nonce( $nonce, $action ) {
	$GLOBALS['v1_nonce_calls']++;
	return 'valid' === $nonce && 'wp_rest' === $action ? 1 : false;
}

function wp_generate_uuid4() {
	static $index = 0;
	$index++;
	return sprintf( '00000000-0000-4000-8000-%012d', $index );
}

function wp_json_encode( $value, $flags = 0 ) {
	return json_encode( $value, $flags );
}

function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['v1_routes'][ $namespace . $route ] = $args;
}

function wp_script_is( $handle, $state ) {
	if ( 'mmed-student-os-js' === $handle && 'enqueued' === $state ) {
		return true;
	}
	return 'registered' === $state && isset( $GLOBALS['v1_registered_script'][ $handle ] );
}

function wp_style_is( $handle, $state ) {
	return 'registered' === $state && isset( $GLOBALS['v1_registered_style'][ $handle ] );
}

function wp_scripts() {
	$object = new stdClass();
	$object->registered = $GLOBALS['v1_registered_script'];
	return $object;
}

function wp_styles() {
	$object = new stdClass();
	$object->registered = $GLOBALS['v1_registered_style'];
	return $object;
}

function wp_enqueue_script( $handle, $src, $dependencies, $version, $footer ) {
	$GLOBALS['v1_enqueued_scripts'][ $handle ] = compact( 'src', 'dependencies', 'version', 'footer' );
	$registered = new stdClass();
	$registered->src = $src;
	$GLOBALS['v1_registered_script'][ $handle ] = $registered;
}

function wp_enqueue_style( $handle, $src, $dependencies, $version ) {
	$GLOBALS['v1_enqueued_styles'][ $handle ] = compact( 'src', 'dependencies', 'version' );
	$registered = new stdClass();
	$registered->src = $src;
	$GLOBALS['v1_registered_style'][ $handle ] = $registered;
}

function wp_add_inline_script( $handle, $source, $position ) {
	$GLOBALS['v1_inline_scripts'][ $handle ] = compact( 'source', 'position' );
}

function v1_rest_expect_same( $expected, $actual, $label ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

final class MMED_Hub_Page {
	public static function is_hub_page() {
		return true;
	}
}

final class WP_REST_Server {
	const READABLE = 'GET';
}

class WP_REST_Request {
	private $headers = array();
	private $route;

	public function __construct( $method = 'GET', $route = '' ) {
		unset( $method );
		$this->route = $route;
	}

	public function set_header( $name, $value ) {
		$this->headers[ strtolower( $name ) ] = $value;
	}

	public function get_header( $name ) {
		$key = strtolower( $name );
		return isset( $this->headers[ $key ] ) ? $this->headers[ $key ] : '';
	}

	public function get_route() {
		return $this->route;
	}
}

class WP_Error {
	private $code;
	private $message;
	private $data;

	public function __construct( $code, $message, $data = array() ) {
		$this->code = $code;
		$this->message = $message;
		$this->data = $data;
	}

	public function get_error_code() {
		return $this->code;
	}

	public function get_error_data() {
		return $this->data;
	}
}

class WP_REST_Response {
	private $data;
	private $status;
	private $headers = array();

	public function __construct( $data = null, $status = 200 ) {
		$this->data = $data;
		$this->status = $status;
	}

	public function get_data() {
		return $this->data;
	}

	public function get_status() {
		return $this->status;
	}

	public function header( $name, $value ) {
		$this->headers[ $name ] = $value;
	}

	public function get_headers() {
		return $this->headers;
	}
}

require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-domain.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-release.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-repository.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-access.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-observability.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-loader.php';
require_once MMED_HUB_PATH . 'includes/class-mmed-v1-study-rest-api.php';

final class V1_REST_Entitlement_Provider implements MMED_V1_Study_Entitlement_Provider {
	public $calls = 0;

	public function claim( $user_id ) {
		unset( $user_id );
		$this->calls++;
		return array(
			'product'                 => 'cam',
			'source'                  => 'wordpress_learndash_handoff',
			'verified'                => true,
			'trusted'                 => true,
			'active'                  => true,
			'status'                  => 'active',
			'course_ids'              => array( '3893' ),
			'restricted'              => false,
			'revoked'                 => false,
			'current_access_verified' => true,
			'purchase_verified'       => true,
			'purchase_match_found'    => true,
			'enrollment_verified'     => true,
			'authority_mode'          => 'learndash_and_woocommerce',
			'revocation_checked'      => true,
			'expires_at'              => gmdate( 'c', time() + 3600 ),
			'evaluated_at'            => gmdate( 'c' ),
		);
	}
}

final class V1_REST_Repository implements MMED_V1_Study_Repository {
	public $calls = 0;

	public function binding_kind() {
		return MMED_V1_Study_Domain::BINDING_READY;
	}

	public function store_provenance() {
		return array( 'state' => 'commissioned', 'store_id' => 'v1_rest_synthetic', 'generation' => 1 );
	}

	public function cutover_provenance( $owner_id ) {
		unset( $owner_id );
		$this->calls++;
		return array( 'state' => 'absent', 'schema_version' => null, 'watermark_evidence' => false );
	}

	public function compatible_reader_versions() {
		return array( '1' );
	}

	public function load( $owner_id, $reader_version ) {
		return array( 'ok' => true, 'owner' => $owner_id, 'reader' => $reader_version );
	}
}

function v1_rest_store_record( $state = 'commissioned' ) {
	$record = array( 'contract_version' => 1, 'state' => $state, 'generation' => 1 );
	if ( 'commissioned' === $state ) {
		$record['store_id'] = 'v1_rest_synthetic';
		$record['commissioned_at'] = '2026-07-15T00:00:00Z';
	}
	return $record;
}

function v1_rest_release_record( $mode, $exposure, $decision_12 ) {
	$record = array(
		'contract_version'        => 1,
		'generation'              => 1,
		'mode'                    => $mode,
		'exposure'                => $exposure,
		'decision_12_state'       => $decision_12,
		'stop'                    => false,
		'release_digest'          => MMED_V1_Study_Release::RELEASE_SHA256,
		'current_reader_version'  => '1',
		'previous_reader_version' => null,
		'effective_at'            => '2026-07-15T00:00:00Z',
		'reason'                  => 'synthetic_fixture',
	);
	if ( 'approved' === $decision_12 ) {
		$record['policy_version'] = 'synthetic-policy-v1';
	}
	return $record;
}

$provider   = new V1_REST_Entitlement_Provider();
$repository = new V1_REST_Repository();
$GLOBALS['v1_options'][ MMED_V1_Study_Release::STORE_OPTION ] = v1_rest_store_record();
$GLOBALS['v1_options'][ MMED_V1_Study_Release::RELEASE_OPTION ] = v1_rest_release_record( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved' );
$GLOBALS['v1_filters']['mmed_v1_study_entitlement_provider'] = static function () use ( $provider ) {
	return $provider;
};
$GLOBALS['v1_filters']['mmed_v1_study_repository'] = static function () use ( $repository ) {
	return $repository;
};
$GLOBALS['v1_filters']['mmed_v1_study_actor_kind'] = static function ( $default, $actor_id ) {
	unset( $default );
	return 10 === (int) $actor_id ? 'learner' : 'unknown';
};

MMED_V1_Study_REST_API::init();
MMED_V1_Study_REST_API::register_routes();
$route_key = MMED_V1_Study_Release::REST_NAMESPACE . MMED_V1_Study_Release::BOOTSTRAP_ROUTE;
v1_rest_expect_same( true, isset( $GLOBALS['v1_routes'][ $route_key ] ), 'dedicated GET bootstrap route registered' );
v1_rest_expect_same( 'GET', $GLOBALS['v1_routes'][ $route_key ]['methods'], 'bootstrap route is GET-only' );

$request = new WP_REST_Request( 'GET', '/' . $route_key );
$request->set_header( 'X-WP-Nonce', 'valid' );
v1_rest_expect_same( true, MMED_V1_Study_REST_API::can_read_bootstrap( $request ), 'valid request passes permission' );
$response = MMED_V1_Study_REST_API::get_bootstrap( $request );
v1_rest_expect_same( true, $response instanceof WP_REST_Response, 'valid request returns response' );
v1_rest_expect_same( 1, $GLOBALS['v1_nonce_calls'], 'permission and callback verify nonce once' );
v1_rest_expect_same( 1, $provider->calls, 'permission and callback resolve claim once' );
v1_rest_expect_same( 1, $repository->calls, 'permission and callback resolve repository mode once' );

$payload = $response->get_data();
v1_rest_expect_same( array( 'contract_version', 'mode', 'entitlement', 'exposure', 'reader', 'writer', 'release' ), array_keys( $payload ), 'public payload exact allowlist' );
v1_rest_expect_same( false, array_key_exists( 'api', $payload ), 'public payload contains no API or nonce carrier' );
v1_rest_expect_same( false, false !== strpos( json_encode( $payload ), 'course_ids' ), 'public payload omits raw claim data' );

$second = new WP_REST_Request( 'GET', '/' . $route_key );
$second->set_header( 'X-WP-Nonce', 'valid' );
MMED_V1_Study_REST_API::can_read_bootstrap( $second );
MMED_V1_Study_REST_API::get_bootstrap( $second );
v1_rest_expect_same( 2, $GLOBALS['v1_nonce_calls'], 'second request object re-verifies nonce' );
v1_rest_expect_same( 2, $provider->calls, 'second request object re-resolves claim' );
v1_rest_expect_same( 2, $repository->calls, 'second request object re-resolves mode' );

$denied_request = new WP_REST_Request( 'GET', '/' . $route_key );
$denied_request->set_header( 'X-WP-Nonce', 'invalid' );
$denied_permission = MMED_V1_Study_REST_API::can_read_bootstrap( $denied_request );
$denied_callback   = MMED_V1_Study_REST_API::get_bootstrap( $denied_request );
v1_rest_expect_same( true, $denied_permission instanceof WP_Error, 'invalid nonce permission denied' );
v1_rest_expect_same( true, $denied_callback instanceof WP_Error, 'invalid nonce callback denied' );
v1_rest_expect_same( 3, $GLOBALS['v1_nonce_calls'], 'denied result is cached per request' );
v1_rest_expect_same( $denied_permission->get_error_data()['request_id'], $denied_callback->get_error_data()['request_id'], 'denied phases share one request ID' );
v1_rest_expect_same( 2, $provider->calls, 'invalid nonce does not call entitlement provider' );

$header_response = MMED_V1_Study_REST_API::private_no_store( new WP_REST_Response( array(), 200 ), null, $request );
$headers = $header_response->get_headers();
v1_rest_expect_same( 'private, no-store, max-age=0, must-revalidate', $headers['Cache-Control'], 'V1 response is private and no-store' );
v1_rest_expect_same( 'Cookie, X-WP-Nonce', $headers['Vary'], 'V1 response varies on cookie and nonce' );

// Approved loader emits exact local assets only after the established Matrix shell.
$GLOBALS['v1_enqueued_scripts'] = array();
$GLOBALS['v1_enqueued_styles']  = array();
$GLOBALS['v1_inline_scripts']   = array();
$GLOBALS['v1_registered_script'] = array();
$GLOBALS['v1_registered_style']  = array();
MMED_V1_Study_Loader::enqueue();
v1_rest_expect_same( true, isset( $GLOBALS['v1_enqueued_scripts'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ] ), 'approved loader script enqueued' );
v1_rest_expect_same( true, isset( $GLOBALS['v1_enqueued_styles'][ MMED_V1_Study_Loader::STYLE_HANDLE ] ), 'approved loader style enqueued' );
$script = $GLOBALS['v1_enqueued_scripts'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ];
v1_rest_expect_same( MMED_HUB_URL . 'assets/' . MMED_V1_Study_Release::LOADER_ASSET, $script['src'], 'loader uses exact content-addressed URL' );
v1_rest_expect_same( null, $script['version'], 'loader has no mutable version query' );
v1_rest_expect_same( array( 'mmed-student-os-js' ), $script['dependencies'], 'loader follows stable Matrix handle' );
$inline = $GLOBALS['v1_inline_scripts'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ]['source'];
v1_rest_expect_same( false, false !== strpos( $inline, 'nonce' ), 'inline bootstrap contains no nonce' );
v1_rest_expect_same( true, MMED_V1_Study_Loader::assets_valid(), 'full local asset hashes validate' );

// A conflicting prior registration refuses both the asset and trusted bootstrap.
$GLOBALS['v1_enqueued_scripts'] = array();
$GLOBALS['v1_enqueued_styles']  = array();
$GLOBALS['v1_inline_scripts']   = array();
$conflict = new stdClass();
$conflict->src = 'https://example.invalid/conflicting-loader.js';
$GLOBALS['v1_registered_script'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ] = $conflict;
MMED_V1_Study_Loader::enqueue();
v1_rest_expect_same( false, isset( $GLOBALS['v1_enqueued_scripts'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ] ), 'conflicting script handle blocks enqueue' );
v1_rest_expect_same( false, isset( $GLOBALS['v1_inline_scripts'][ MMED_V1_Study_Loader::SCRIPT_HANDLE ] ), 'conflicting script handle blocks bootstrap' );

// Decision 12 hold remains entirely hidden and emits no assets.
$GLOBALS['v1_options'][ MMED_V1_Study_Release::STORE_OPTION ] = v1_rest_store_record( 'never_commissioned' );
$GLOBALS['v1_options'][ MMED_V1_Study_Release::RELEASE_OPTION ] = v1_rest_release_record( MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, false, 'hold' );
$GLOBALS['v1_enqueued_scripts'] = array();
$GLOBALS['v1_enqueued_styles']  = array();
$GLOBALS['v1_inline_scripts']   = array();
$GLOBALS['v1_registered_script'] = array();
$GLOBALS['v1_registered_style']  = array();
MMED_V1_Study_Loader::enqueue();
v1_rest_expect_same( array(), $GLOBALS['v1_enqueued_scripts'], 'hold emits no loader script' );
v1_rest_expect_same( array(), $GLOBALS['v1_enqueued_styles'], 'hold emits no loader style' );
v1_rest_expect_same( array(), $GLOBALS['v1_inline_scripts'], 'hold emits no inline configuration' );

echo "V1 Study Schedule 8010C REST and loader contract: ok\n";
