<?php
/**
 * Legacy Study REST characterization and disposable WordPress integration proof.
 */

declare(strict_types=1);

if ( ! class_exists( 'MMED_V1_Study_Access' ) ) {
	final class MMED_V1_Study_Access {
		public static function legacy_writer_decision( $owner_id ): array {
			unset( $owner_id );
			return array( 'allowed' => true, 'status' => 200 );
		}
	}
}

if ( defined( 'WPINC' ) ) {
	/**
	 * Assert one disposable WordPress integration condition.
	 *
	 * @param mixed  $expected Expected value.
	 * @param mixed  $actual Actual value.
	 * @param string $label Assertion label.
	 * @return void
	 */
	function v1_wp_expect_same( $expected, $actual, string $label ): void {
		if ( $expected !== $actual ) {
			throw new RuntimeException(
				$label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true )
			);
		}
	}

	/**
	 * Build a JSON REST request against real WordPress request parsing.
	 *
	 * @param string $method HTTP method.
	 * @param string $route Route path.
	 * @param array  $body JSON body.
	 * @param array  $params Route parameters.
	 * @return WP_REST_Request
	 */
	function v1_wp_json_request( string $method, string $route, array $body, array $params = array() ): WP_REST_Request {
		$request = new WP_REST_Request( $method, $route );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		return $request;
	}

	$root = dirname( __DIR__, 2 );
	require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php';
	require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php';
	require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php';
	require_once ABSPATH . 'wp-admin/includes/user.php';

	global $wpdb;

	MMED_Calendar_Engine::maybe_install();
	$table       = MMED_Calendar_Engine::table_name();
	$event_ids   = array();
	$user_ids    = array();
	$unique      = strtolower( str_replace( '-', '', wp_generate_uuid4() ) );
	$learner_id  = wp_insert_user(
		array(
			'user_login' => 'v1learner_' . substr( $unique, 0, 12 ),
			'user_pass'  => wp_generate_password( 32, true, true ),
			'user_email' => 'v1learner_' . substr( $unique, 0, 12 ) . '@example.invalid',
			'role'       => 'subscriber',
		)
	);
	$admin_id    = wp_insert_user(
		array(
			'user_login' => 'v1admin_' . substr( $unique, 12, 12 ),
			'user_pass'  => wp_generate_password( 32, true, true ),
			'user_email' => 'v1admin_' . substr( $unique, 12, 12 ) . '@example.invalid',
			'role'       => 'administrator',
		)
	);

	if ( is_wp_error( $learner_id ) || is_wp_error( $admin_id ) ) {
		throw new RuntimeException( 'Synthetic WordPress users could not be created.' );
	}
	$user_ids = array( (int) $learner_id, (int) $admin_id );

	try {
		add_action( 'rest_api_init', array( 'MMED_REST_API', 'register_routes' ) );
		$routes     = rest_get_server()->get_routes();
		$collection = isset( $routes['/mmed/v1/study-blocks'] ) ? $routes['/mmed/v1/study-blocks'] : null;
		$item       = isset( $routes['/mmed/v1/study-blocks/(?P<id>\d+)'] ) ? $routes['/mmed/v1/study-blocks/(?P<id>\d+)'] : null;
		v1_wp_expect_same( true, is_array( $collection ), 'real WordPress registers Study collection route' );
		v1_wp_expect_same( true, is_array( $item ), 'real WordPress registers Study item route' );

		wp_set_current_user( (int) $learner_id );
		v1_wp_expect_same( true, MMED_REST_API::can_access(), 'real WordPress recognizes synthetic learner login' );

		$base = array(
			'user_id'    => (int) $learner_id,
			'title'      => 'Synthetic Study block',
			'description' => '',
			'start_at'   => '2026-07-15 09:00:00',
			'end_at'     => '2026-07-15 10:00:00',
			'source'     => 'manual',
			'category'   => 'study',
			'status'     => 'active',
			'created_at' => '2026-07-15 00:00:00',
			'updated_at' => '2026-07-15 00:00:00',
		);

		$inserted = $wpdb->insert(
			$table,
			array_merge(
				$base,
				array(
					'event_type' => 'study_block',
					'meta_json'  => null,
				)
			)
		);
		v1_wp_expect_same( 1, $inserted, 'real database accepts nullable Study metadata' );
		$null_meta_id = (int) $wpdb->insert_id;
		$event_ids[]  = $null_meta_id;
		$real_no_op = $wpdb->update(
			$table,
			array( 'status' => 'active' ),
			array(
				'id'         => $null_meta_id,
				'user_id'    => (int) $learner_id,
				'event_type' => 'study_block',
				'status'     => 'active',
				'meta_json'  => null,
			),
			array( '%s' ),
			array( '%d', '%d', '%s', '%s', '%s' )
		);
		v1_wp_expect_same( 0, $real_no_op, 'real wpdb reports exact nullable-predicate no-op as zero rows' );

		$updated = MMED_Study_Schedule::update_block(
			v1_wp_json_request(
				'PUT',
				'/mmed/v1/study-blocks/' . $null_meta_id,
				array( 'subject' => 'Renal', 'completed' => true ),
				array( 'id' => $null_meta_id )
			)
		);
		v1_wp_expect_same( false, is_wp_error( $updated ), 'real wpdb NULL snapshot update succeeds' );
		v1_wp_expect_same( 200, $updated->get_status(), 'real wpdb NULL snapshot returns 200' );
		$updated_row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $null_meta_id ) );
		$updated_meta = json_decode( (string) $updated_row->meta_json, true );
		v1_wp_expect_same( 'completed', (string) $updated_row->status, 'real database stores completed status' );
		v1_wp_expect_same( 'Renal', $updated_meta['subject'] ?? null, 'real database stores merged metadata' );
		v1_wp_expect_same( true, $updated_meta['completed'] ?? null, 'real database stores completion metadata' );

		$appointment = array_merge( $base, array( 'event_type' => 'appointment', 'meta_json' => '{}' ) );
		$wpdb->insert( $table, $appointment );
		$appointment_id = (int) $wpdb->insert_id;
		$event_ids[]    = $appointment_id;
		$wrong_type = MMED_Study_Schedule::update_block(
			v1_wp_json_request(
				'PUT',
				'/mmed/v1/study-blocks/' . $appointment_id,
				array( 'completed' => true ),
				array( 'id' => $appointment_id )
			)
		);
		v1_wp_expect_same( true, is_wp_error( $wrong_type ), 'real database rejects appointment through Study route' );
		v1_wp_expect_same( 404, $wrong_type->get_error_data()['status'] ?? null, 'wrong type is non-enumerating' );

		$cancelled = array_merge( $base, array( 'event_type' => 'study_block', 'status' => 'cancelled', 'meta_json' => '{}' ) );
		$wpdb->insert( $table, $cancelled );
		$cancelled_id = (int) $wpdb->insert_id;
		$event_ids[]  = $cancelled_id;
		$cancelled_update = MMED_Study_Schedule::update_block(
			v1_wp_json_request(
				'PUT',
				'/mmed/v1/study-blocks/' . $cancelled_id,
				array( 'completed' => false ),
				array( 'id' => $cancelled_id )
			)
		);
		v1_wp_expect_same( true, is_wp_error( $cancelled_update ), 'real cancelled row cannot be resurrected' );
		v1_wp_expect_same( 404, $cancelled_update->get_error_data()['status'] ?? null, 'cancelled row is non-enumerating' );

		wp_set_current_user( (int) $admin_id );
		$created = MMED_Study_Schedule::create_block(
			v1_wp_json_request(
				'POST',
				'/mmed/v1/study-blocks',
				array(
					'title'     => 'Synthetic private admin block',
					'subject'   => 'Renal',
					'start_at'  => '2026-07-15T13:00:00',
					'duration'  => 60,
					'audience'  => 'all_students',
				)
			)
		);
		v1_wp_expect_same( false, is_wp_error( $created ), 'real administrator Study create succeeds' );
		v1_wp_expect_same( 201, $created->get_status(), 'real administrator Study create returns 201' );
		$created_data = $created->get_data();
		$admin_event_id = (int) ( $created_data['id'] ?? 0 );
		$event_ids[]     = $admin_event_id;
		$admin_owner = (int) $wpdb->get_var( $wpdb->prepare( "SELECT user_id FROM {$table} WHERE id = %d", $admin_event_id ) );
		v1_wp_expect_same( (int) $admin_id, $admin_owner, 'administrator Study create remains private' );
		v1_wp_expect_same( false, array_key_exists( 'event', $created_data ), 'real mutation omits nested Calendar event' );
		v1_wp_expect_same(
			array( 'id', 'title', 'subject', 'notes', 'start_at', 'end_at', 'duration', 'status', 'completed', 'category' ),
			array_keys( $created_data ),
			'real mutation uses exact Study response allowlist'
		);
	} finally {
		foreach ( $event_ids as $event_id ) {
			$wpdb->delete( $table, array( 'id' => (int) $event_id ), array( '%d' ) );
		}
		wp_set_current_user( 0 );
		foreach ( $user_ids as $user_id ) {
			wp_delete_user( (int) $user_id );
		}
	}

	echo "disposable WordPress Study integration: ok\n";
	return;
}

if ( ! defined( 'WPINC' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );

	final class WP_REST_Server {
		const READABLE  = 'GET';
		const CREATABLE = 'POST';
		const EDITABLE  = 'PUT,PATCH';
		const DELETABLE = 'DELETE';
	}

	$GLOBALS['v1_registered_routes'] = array();
	$GLOBALS['v1_logged_in']         = false;

	function register_rest_route( string $namespace, string $route, array $args ): void {
		$GLOBALS['v1_registered_routes'][ $namespace . $route ] = $args;
	}

	function is_user_logged_in(): bool {
		return true === $GLOBALS['v1_logged_in'];
	}

	function expect_same( $expected, $actual, string $label ): void {
		if ( $expected !== $actual ) {
			throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
		}
	}

	require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php';

	MMED_REST_API::register_routes();

	$collection = $GLOBALS['v1_registered_routes']['mmed/v1/study-blocks'] ?? null;
	$item       = $GLOBALS['v1_registered_routes']['mmed/v1/study-blocks/(?P<id>\d+)'] ?? null;

	expect_same( true, is_array( $collection ), 'legacy Study collection route is registered' );
	expect_same( true, is_array( $item ), 'legacy Study item route is registered' );

	foreach ( array_merge( $collection, $item ) as $endpoint ) {
		$callback = $endpoint['permission_callback'] ?? null;
		expect_same( array( 'MMED_REST_API', 'can_access' ), $callback, 'legacy Study permission remains login-only' );
	}

	expect_same( false, MMED_REST_API::can_access(), 'anonymous access is denied' );
	$GLOBALS['v1_logged_in'] = true;
	expect_same( true, MMED_REST_API::can_access(), 'any logged-in user currently passes' );

	echo "legacy Study route baseline: ok\n";
}
