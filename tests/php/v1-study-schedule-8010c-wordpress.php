<?php
/**
 * Disposable real-WordPress 8010C route, database, and Calendar coexistence proof.
 */

declare(strict_types=1);

if ( ! defined( 'WPINC' ) ) {
	throw new RuntimeException( 'This fixture requires disposable WordPress.' );
}

function v1_8010c_wp_expect_same( $expected, $actual, $label ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

$root = getenv( 'V1_REPO_ROOT' );
if ( ! is_string( $root ) || '' === $root ) {
	throw new RuntimeException( 'V1_REPO_ROOT is required.' );
}

// This fixture exercises the explicitly enabled legacy 8010C seam. The
// separate default-off WordPress fixture proves that normal plugin boot is inert.
define( 'MMED_V1_STUDY_RUNTIME_BINDING', true );
update_option( 'mmed_student_os_enabled', 1, false );
require_once $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php';
require_once ABSPATH . 'wp-admin/includes/user.php';

final class V1_8010C_WP_Entitlement implements MMED_V1_Study_Entitlement_Provider {
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

final class V1_8010C_WP_Repository implements MMED_V1_Study_Repository {
	public $calls = 0;
	public $commissioned = true;
	public $truth_present = false;

	public function binding_kind() {
		return $this->commissioned
			? MMED_V1_Study_Domain::BINDING_READY
			: MMED_V1_Study_Domain::BINDING_NEVER_COMMISSIONED;
	}

	public function store_provenance() {
		return $this->commissioned
			? array( 'state' => 'commissioned', 'store_id' => 'v1_wp_synthetic', 'generation' => 1 )
			: array( 'state' => 'never_commissioned', 'store_id' => null, 'generation' => 1 );
	}

	public function cutover_provenance( $owner_id ) {
		unset( $owner_id );
		$this->calls++;
		return $this->truth_present
			? array( 'state' => 'present', 'schema_version' => '1', 'watermark_evidence' => true )
			: array( 'state' => 'absent', 'schema_version' => null, 'watermark_evidence' => false );
	}

	public function compatible_reader_versions() {
		return $this->commissioned ? array( '1' ) : array();
	}

	public function load( $owner_id, $reader_version ) {
		return array( 'ok' => true, 'owner' => $owner_id, 'reader' => $reader_version );
	}
}

function v1_8010c_wp_store( $commissioned ) {
	$record = array(
		'contract_version' => 1,
		'state'            => $commissioned ? 'commissioned' : 'never_commissioned',
		'generation'       => 1,
	);
	if ( $commissioned ) {
		$record['store_id'] = 'v1_wp_synthetic';
		$record['commissioned_at'] = '2026-07-15T00:00:00Z';
	}
	return $record;
}

function v1_8010c_wp_release( $mode, $exposure, $decision_12, $stop = false ) {
	$record = array(
		'contract_version'        => 1,
		'generation'              => 1,
		'mode'                    => $mode,
		'exposure'                => (bool) $exposure,
		'decision_12_state'       => $decision_12,
		'stop'                    => (bool) $stop,
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

function v1_8010c_wp_set_control( $commissioned, $mode, $exposure, $decision_12, $stop = false ) {
	update_option( MMED_V1_Study_Release::STORE_OPTION, v1_8010c_wp_store( $commissioned ), false );
	update_option( MMED_V1_Study_Release::RELEASE_OPTION, v1_8010c_wp_release( $mode, $exposure, $decision_12, $stop ), false );
}

function v1_8010c_wp_event_request( $method, $route, $body, $id = null ) {
	$request = new WP_REST_Request( $method, $route );
	$request->set_body_params( $body );
	if ( null !== $id ) {
		$request->set_param( 'id', (int) $id );
	}
	return $request;
}

global $wpdb;

$unique     = strtolower( str_replace( '-', '', wp_generate_uuid4() ) );
$learner_id = wp_insert_user(
	array(
		'user_login' => 'v18010c_' . substr( $unique, 0, 12 ),
		'user_pass'  => wp_generate_password( 32, true, true ),
		'user_email' => 'v18010c_' . substr( $unique, 0, 12 ) . '@example.invalid',
		'role'       => 'subscriber',
	)
);
$admin_id = wp_insert_user(
	array(
		'user_login' => 'v18010ca_' . substr( $unique, 12, 12 ),
		'user_pass'  => wp_generate_password( 32, true, true ),
		'user_email' => 'v18010ca_' . substr( $unique, 12, 12 ) . '@example.invalid',
		'role'       => 'administrator',
	)
);
if ( is_wp_error( $learner_id ) || is_wp_error( $admin_id ) ) {
	throw new RuntimeException( 'Synthetic users could not be created.' );
}

$provider   = new V1_8010C_WP_Entitlement();
$repository = new V1_8010C_WP_Repository();
$event_ids  = array();
$query_log  = array();
$table      = '';

$entitlement_filter = static function () use ( $provider ) {
	return $provider;
};
$repository_filter = static function () use ( $repository ) {
	return $repository;
};
$actor_filter = static function ( $default, $actor_id ) use ( $learner_id ) {
	unset( $default );
	return (int) $learner_id === (int) $actor_id ? 'learner' : 'unknown';
};
$query_filter = static function ( $query ) use ( &$query_log, &$table ) {
	if ( '' !== $table && preg_match( '/^\s*(?:INSERT|UPDATE|DELETE)\b/i', $query ) && false !== strpos( $query, $table ) ) {
		$query_log[] = $query;
	}
	return $query;
};

add_filter( 'mmed_v1_study_entitlement_provider', $entitlement_filter );
add_filter( 'mmed_v1_study_repository', $repository_filter );
add_filter( 'mmed_v1_study_actor_kind', $actor_filter, 10, 2 );
add_filter( 'query', $query_filter );

try {
	MMED_Calendar_Engine::maybe_install();
	$table = MMED_Calendar_Engine::table_name();
	v1_8010c_wp_set_control( true, MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved' );
	wp_set_current_user( (int) $learner_id );

	MMED_REST_API::register_routes();
	MMED_V1_Study_REST_API::register_routes();
	$routes = rest_get_server()->get_routes();
	$v1_route = '/' . MMED_V1_Study_Release::REST_NAMESPACE . MMED_V1_Study_Release::BOOTSTRAP_ROUTE;
	v1_8010c_wp_expect_same( true, isset( $routes[ $v1_route ] ), 'real WordPress registers dedicated V1 bootstrap' );
	v1_8010c_wp_expect_same( true, isset( $routes['/mmed/v1/study-blocks'] ), 'legacy Study route remains registered' );

	$query_log = array();
	$provider->calls = 0;
	$repository->calls = 0;
	$request = new WP_REST_Request( 'GET', $v1_route );
	$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
	$response = rest_do_request( $request );
	$response = apply_filters( 'rest_post_dispatch', $response, rest_get_server(), $request );
	v1_8010c_wp_expect_same( 200, $response->get_status(), 'real authenticated V1 bootstrap succeeds' );
	v1_8010c_wp_expect_same( 1, $provider->calls, 'real permission and callback normalize entitlement once' );
	v1_8010c_wp_expect_same( 1, $repository->calls, 'real permission and callback resolve mode once' );
	v1_8010c_wp_expect_same( array(), $query_log, 'real V1 bootstrap performs zero Calendar DML' );
	$data = $response->get_data();
	v1_8010c_wp_expect_same( array( 'contract_version', 'mode', 'entitlement', 'exposure', 'reader', 'writer', 'release' ), array_keys( $data ), 'real V1 payload exact allowlist' );
	$headers = $response->get_headers();
	v1_8010c_wp_expect_same( 'private, no-store, max-age=0, must-revalidate', $headers['Cache-Control'] ?? null, 'real success is private no-store' );
	v1_8010c_wp_expect_same( 'Cookie, X-WP-Nonce', $headers['Vary'] ?? null, 'real success varies on auth inputs' );

	$missing_request = new WP_REST_Request( 'GET', $v1_route );
	$missing_nonce = rest_do_request( $missing_request );
	$missing_nonce = apply_filters( 'rest_post_dispatch', $missing_nonce, rest_get_server(), $missing_request );
	v1_8010c_wp_expect_same( 403, $missing_nonce->get_status(), 'real direct endpoint rejects missing nonce' );
	$missing_headers = $missing_nonce->get_headers();
	v1_8010c_wp_expect_same( 'private, no-store, max-age=0, must-revalidate', $missing_headers['Cache-Control'] ?? null, 'real denial is private no-store' );

	wp_set_current_user( (int) $admin_id );
	$admin_request = new WP_REST_Request( 'GET', $v1_route );
	$admin_request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
	$admin_response = rest_do_request( $admin_request );
	v1_8010c_wp_expect_same( 404, $admin_response->get_status(), 'administrator cannot impersonate learner bootstrap' );

	wp_set_current_user( (int) $learner_id );
	$query_log = array();
	$blocked_create = MMED_Calendar_Engine::create_event(
		v1_8010c_wp_event_request(
			'POST',
			'/mmed/v1/events',
			array(
				'event_type' => 'study_block',
				'title'      => 'Blocked synthetic Study event',
				'start_at'   => '2026-07-15T09:00:00Z',
				'end_at'     => '2026-07-15T10:00:00Z',
				'source'     => 'manual',
			)
		)
	);
	v1_8010c_wp_expect_same( true, is_wp_error( $blocked_create ), 'generic Calendar cannot create Study after V1 activation' );
	v1_8010c_wp_expect_same( 409, $blocked_create->get_error_data()['status'] ?? null, 'generic Study create returns writer-disabled conflict' );
	v1_8010c_wp_expect_same( array(), $query_log, 'blocked generic Study create performs zero Calendar DML' );

	$query_log = array();
	$appointment = MMED_Calendar_Engine::create_event(
		v1_8010c_wp_event_request(
			'POST',
			'/mmed/v1/events',
			array(
				'event_type' => 'appointment',
				'title'      => 'Synthetic unaffected appointment',
				'start_at'   => '2026-07-15T11:00:00Z',
				'end_at'     => '2026-07-15T12:00:00Z',
				'source'     => 'manual',
			)
		)
	);
	v1_8010c_wp_expect_same( false, is_wp_error( $appointment ), 'non-Study Calendar create remains compatible' );
	$appointment_id = (int) ( $appointment->get_data()['id'] ?? 0 );
	$event_ids[] = $appointment_id;
	v1_8010c_wp_expect_same( true, count( $query_log ) >= 1, 'non-Study Calendar mutation still reaches DML' );

	$wpdb->insert(
		$table,
		array(
			'user_id'    => (int) $learner_id,
			'event_type' => 'study_block',
			'title'      => 'Synthetic pre-existing Study event',
			'start_at'   => '2026-07-15 13:00:00',
			'end_at'     => '2026-07-15 14:00:00',
			'source'     => 'manual',
			'status'     => 'active',
			'created_at' => '2026-07-15 00:00:00',
			'updated_at' => '2026-07-15 00:00:00',
		)
	);
	$study_id = (int) $wpdb->insert_id;
	$event_ids[] = $study_id;
	$query_log = array();
	$blocked_update = MMED_Calendar_Engine::update_event(
		v1_8010c_wp_event_request( 'PATCH', '/mmed/v1/events/' . $study_id, array( 'title' => 'Must not change' ), $study_id )
	);
	v1_8010c_wp_expect_same( true, is_wp_error( $blocked_update ), 'generic Calendar cannot update Study after V1 activation' );
	$blocked_delete = MMED_Calendar_Engine::delete_event(
		v1_8010c_wp_event_request( 'DELETE', '/mmed/v1/events/' . $study_id, array(), $study_id )
	);
	v1_8010c_wp_expect_same( true, is_wp_error( $blocked_delete ), 'generic Calendar cannot delete Study after V1 activation' );
	v1_8010c_wp_expect_same( array(), $query_log, 'blocked generic Study update/delete perform zero Calendar DML' );

	$query_log = array();
	$bulk = new WP_REST_Request( 'POST', '/mmed/v1/events/bulk' );
	$bulk->set_param(
		'events',
		array(
			array(
				'event_type' => 'study_block',
				'title'      => 'Blocked bulk Study event',
				'start_at'   => '2026-07-15T15:00:00Z',
				'end_at'     => '2026-07-15T16:00:00Z',
				'source'     => 'manual',
			),
		)
	);
	wp_set_current_user( (int) $admin_id );
	$bulk_response = MMED_Calendar_Engine::bulk_create_events( $bulk );
	v1_8010c_wp_expect_same( 0, $bulk_response->get_data()['created'] ?? null, 'admin bulk cannot bypass Study writer fence' );
	v1_8010c_wp_expect_same( array(), $query_log, 'blocked bulk Study create performs zero Calendar DML' );

	// Missing controls fail closed; rollout must pre-provision before source activation.
	delete_option( MMED_V1_Study_Release::STORE_OPTION );
	delete_option( MMED_V1_Study_Release::RELEASE_OPTION );
	wp_set_current_user( (int) $learner_id );
	$query_log = array();
	$missing_control_write = MMED_Study_Schedule::create_block(
		v1_8010c_wp_event_request(
			'POST',
			'/mmed/v1/study-blocks',
			array( 'title' => 'Blocked missing-control Study', 'subject' => 'Synthetic', 'start_at' => '2026-07-15T17:00:00Z' )
		)
	);
	v1_8010c_wp_expect_same( 503, $missing_control_write->get_error_data()['status'] ?? null, 'missing control blocks legacy writer' );
	v1_8010c_wp_expect_same( array(), $query_log, 'missing-control writer denial performs zero Calendar DML' );
} finally {
	foreach ( $event_ids as $event_id ) {
		$wpdb->delete( $table, array( 'id' => (int) $event_id ), array( '%d' ) );
	}
	delete_option( MMED_V1_Study_Release::STORE_OPTION );
	delete_option( MMED_V1_Study_Release::RELEASE_OPTION );
	delete_option( 'mmed_student_os_enabled' );
	remove_filter( 'mmed_v1_study_entitlement_provider', $entitlement_filter );
	remove_filter( 'mmed_v1_study_repository', $repository_filter );
	remove_filter( 'mmed_v1_study_actor_kind', $actor_filter, 10 );
	remove_filter( 'query', $query_filter );
	wp_set_current_user( 0 );
	wp_delete_user( (int) $learner_id );
	wp_delete_user( (int) $admin_id );
}

echo "V1 Study Schedule 8010C disposable WordPress integration: ok\n";
