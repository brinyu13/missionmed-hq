<?php
/**
 * Fixture-only characterization for the legacy Study dependency boundary.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );

final class WP_Error {
	public string $code;
	public string $message;
	public array $data;

	public function __construct( string $code, string $message, array $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
}

final class WP_REST_Response {
	public $data;
	public int $status;

	public function __construct( $data, int $status = 200 ) {
		$this->data   = $data;
		$this->status = $status;
	}

	public function get_data() {
		return $this->data;
	}

	public function set_data( $data ): void {
		$this->data = $data;
	}
}

final class WP_REST_Request implements ArrayAccess {
	private array $json = array();
	private array $body = array();
	private array $params = array();

	public function __construct( array $json = array(), array $params = array() ) {
		$this->json   = $json;
		$this->params = $params;
	}

	public function get_json_params(): array {
		return $this->json;
	}

	public function get_param( string $key ) {
		return $this->params[ $key ] ?? null;
	}

	public function has_param( string $key ): bool {
		return array_key_exists( $key, $this->params );
	}

	public function set_body_params( array $body ): void {
		$this->body = $body;
	}

	public function get_body_params(): array {
		return $this->body;
	}

	public function set_param( string $key, $value ): void {
		$this->params[ $key ] = $value;
	}

	public function set_header( string $key, string $value ): void {}
	public function offsetExists( $offset ): bool { return isset( $this->params[ $offset ] ); }
	#[\ReturnTypeWillChange]
	public function offsetGet( $offset ) { return $this->params[ $offset ] ?? null; }
	public function offsetSet( $offset, $value ): void { $this->params[ $offset ] = $value; }
	public function offsetUnset( $offset ): void { unset( $this->params[ $offset ] ); }
}

function is_wp_error( $value ): bool { return $value instanceof WP_Error; }
function absint( $value ): int { return abs( (int) $value ); }
function sanitize_text_field( $value ): string { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ): string { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ) ?? ''; }
function wp_kses_post( $value ): string { return (string) $value; }
function current_time( string $format ): string { return '2026-07-15 00:00:00'; }
function date_i18n( string $format, int $timestamp ): string { return date( $format, $timestamp ); }
function get_current_user_id(): int { return 42; }

final class MMED_V1_Study_Access {
	public static function legacy_writer_decision( $owner_id ): array {
		unset( $owner_id );
		return array( 'allowed' => true, 'status' => 200 );
	}
}

final class MMED_Calendar_Engine {
	public static array $events = array();
	public static ?WP_REST_Request $created = null;
	public static ?WP_REST_Request $updated = null;
	public static ?WP_REST_Request $deleted = null;

	public static function maybe_install(): void {}
	public static function table_name(): string { return 'wp_mmed_events'; }
	public static function format_event( object $event ): array {
		$meta = json_decode( $event->meta_json ?? '{}', true );
		return array(
			'id' => $event->id,
			'user_id' => $event->user_id ?? 42,
			'event_type' => $event->event_type ?? 'study_block',
			'title' => $event->title ?? '',
			'description' => $event->description ?? '',
			'start_at' => $event->start_at ?? '',
			'end_at' => $event->end_at ?? '',
			'status' => $event->status ?? 'active',
			'category' => $event->category ?? '',
			'meeting_url' => 'https://calendar-only.invalid/meeting',
			'source_id' => 'calendar-internal-source-id',
			'updated_at' => $event->updated_at ?? '2026-07-15 00:00:00',
			'meta' => is_array( $meta ) ? $meta : array(),
		);
	}
	public static function get_owned_event( int $event_id, int $user_id ): ?object {
		$event = self::$events[ $event_id ] ?? null;
		return $event && (int) $event->user_id === $user_id ? $event : null;
	}
	public static function create_event( WP_REST_Request $request ): WP_REST_Response {
		self::$created = $request;
		$body = $request->get_body_params();
		return new WP_REST_Response(
			array(
				'id' => 13,
				'user_id' => 42,
				'event_type' => 'study_block',
				'title' => $body['title'] ?? '',
				'description' => $body['description'] ?? '',
				'start_at' => $body['start_at'] ?? '',
				'end_at' => $body['end_at'] ?? '',
				'status' => $body['status'] ?? 'active',
				'category' => $body['category'] ?? '',
				'meeting_url' => 'https://calendar-only.invalid/meeting',
				'source_id' => 'calendar-internal-source-id',
				'updated_at' => '2026-07-15 00:00:00',
				'meta' => array_merge( $body['meta'] ?? array(), array( 'mentor_hint' => 'internal' ) ),
			),
			201
		);
	}
	public static function update_event( WP_REST_Request $request ): WP_REST_Response {
		self::$updated = $request;
		$id   = (int) $request->get_param( 'id' );
		$body = $request->get_body_params();
		$base = self::format_event( self::$events[ $id ] );
		foreach ( array( 'title', 'description', 'start_at', 'end_at', 'status', 'category' ) as $field ) {
			if ( array_key_exists( $field, $body ) ) {
				$base[ $field ] = $body[ $field ];
			}
		}
		if ( isset( $body['meta'] ) ) {
			$base['meta'] = $body['meta'];
		}
		return new WP_REST_Response( $base, 200 );
	}
	public static function delete_event( WP_REST_Request $request ): WP_REST_Response {
		self::$deleted = $request;
		return new WP_REST_Response( array( 'deleted' => true ), 200 );
	}
}

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php';

function expect_same( $expected, $actual, string $label ): void {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

function event_fixture( int $id, int $owner, string $type, array $meta = array(), string $status = 'active' ): object {
	return (object) array(
		'id' => $id,
		'user_id' => $owner,
		'event_type' => $type,
		'meta_json' => json_encode( $meta, JSON_THROW_ON_ERROR ),
		'status' => $status,
		'updated_at' => '2026-07-15 00:00:00',
	);
}

MMED_Calendar_Engine::$events = array(
	10 => event_fixture( 10, 42, 'study_block', array( 'subject' => 'Renal', 'completed' => false, 'mentor_hint' => 'retain' ) ),
	11 => event_fixture( 11, 42, 'appointment' ),
	12 => event_fixture( 12, 99, 'study_block' ),
	13 => event_fixture( 13, 42, 'study_block', array(), 'cancelled' ),
);

$foreign_type = MMED_Study_Schedule::update_block( new WP_REST_Request( array( 'completed' => true ), array( 'id' => 11 ) ) );
expect_same( true, is_wp_error( $foreign_type ), 'foreign event type denied' );
expect_same( 'mmed_study_block_not_found', $foreign_type->code, 'foreign event type is non-enumerating' );
expect_same( null, MMED_Calendar_Engine::$updated, 'foreign event type never delegated' );

$foreign_owner = MMED_Study_Schedule::delete_block( new WP_REST_Request( array(), array( 'id' => 12 ) ) );
expect_same( true, is_wp_error( $foreign_owner ), 'foreign owner denied' );
expect_same( 'mmed_study_block_not_found', $foreign_owner->code, 'foreign owner is non-enumerating' );
expect_same( null, MMED_Calendar_Engine::$deleted, 'foreign owner never delegated' );

$updated = MMED_Study_Schedule::update_block(
	new WP_REST_Request(
		array(
			'completed' => true,
			'event_type' => 'appointment',
			'user_id' => 99,
			'meeting_url' => 'https://attacker.invalid/meeting',
		),
		array( 'id' => 10 )
	)
);
expect_same( 200, $updated->status, 'owned Study update delegated' );
$update_body = MMED_Calendar_Engine::$updated instanceof WP_REST_Request
	? MMED_Calendar_Engine::$updated->get_body_params()
	: array();
expect_same( 'Renal', $update_body['meta']['subject'] ?? null, 'existing subject retained' );
expect_same( 'retain', $update_body['meta']['mentor_hint'] ?? null, 'unrelated metadata retained' );
expect_same( true, $update_body['meta']['completed'] ?? null, 'changed metadata applied' );
expect_same( 'study_block', $update_body['event_type'] ?? null, 'type cannot be changed' );
expect_same( false, array_key_exists( 'user_id', $update_body ), 'owner mass assignment is ignored' );
expect_same( false, array_key_exists( 'meeting_url', $update_body ), 'Calendar-only mass assignment is ignored' );
expect_same( true, MMED_Calendar_Engine::$updated->get_param( '_mmed_strict_owner' ), 'admin fallback disabled' );
expect_same( 'study_block', MMED_Calendar_Engine::$updated->get_param( '_mmed_required_event_type' ), 'atomic type constraint supplied' );
expect_same( 'active', MMED_Calendar_Engine::$updated->get_param( '_mmed_expected_status' ), 'status snapshot supplied' );
expect_same( true, MMED_Calendar_Engine::$updated->get_param( '_mmed_expect_meta_snapshot' ), 'metadata replacement is snapshot constrained' );
expect_same(
	MMED_Calendar_Engine::$events[10]->meta_json,
	MMED_Calendar_Engine::$updated->get_param( '_mmed_expected_meta_json' ),
	'original metadata snapshot supplied'
);
$update_response = $updated->get_data();
expect_same(
	array( 'id', 'title', 'subject', 'notes', 'start_at', 'end_at', 'duration', 'status', 'completed', 'category' ),
	array_keys( $update_response ),
	'update response uses the exact Study allowlist'
);
expect_same( false, array_key_exists( 'event', $update_response ), 'update omits nested Calendar event' );
expect_same( false, array_key_exists( 'user_id', $update_response ), 'update omits Calendar owner' );
expect_same( false, array_key_exists( 'meeting_url', $update_response ), 'update omits Calendar meeting data' );
expect_same( false, array_key_exists( 'meta', $update_response ), 'update omits unrestricted metadata' );

$deleted = MMED_Study_Schedule::delete_block( new WP_REST_Request( array(), array( 'id' => 10 ) ) );
expect_same( 200, $deleted->status, 'owned Study delete delegated' );
expect_same( 'active', MMED_Calendar_Engine::$deleted->get_param( '_mmed_expected_status' ), 'delete carries status snapshot' );

$cancelled_update = MMED_Study_Schedule::update_block(
	new WP_REST_Request( array( 'completed' => false ), array( 'id' => 13 ) )
);
expect_same( true, is_wp_error( $cancelled_update ), 'cancelled Study event cannot be resurrected' );
expect_same( 'mmed_study_block_not_found', $cancelled_update->code, 'cancelled update is non-enumerating' );

$cancelled_delete = MMED_Study_Schedule::delete_block( new WP_REST_Request( array(), array( 'id' => 13 ) ) );
expect_same( true, is_wp_error( $cancelled_delete ), 'cancelled Study event cannot be deleted again' );
expect_same( 'mmed_study_block_not_found', $cancelled_delete->code, 'cancelled delete is non-enumerating' );

$created = MMED_Study_Schedule::create_block(
	new WP_REST_Request(
		array(
			'title' => 'Renal review',
			'subject' => 'Renal',
			'start_at' => '2026-07-15T09:00:00',
			'audience' => 'all_students',
		)
	)
);
$create_body = MMED_Calendar_Engine::$created instanceof WP_REST_Request
	? MMED_Calendar_Engine::$created->get_body_params()
	: array();
expect_same( 201, $created->status, 'legacy Study create delegated' );
expect_same( 'private', $create_body['audience'] ?? null, 'legacy Study create is explicitly private' );
expect_same( 'study_block', $create_body['event_type'] ?? null, 'legacy Study create fixes type' );
$create_response = $created->get_data();
expect_same(
	array( 'id', 'title', 'subject', 'notes', 'start_at', 'end_at', 'duration', 'status', 'completed', 'category' ),
	array_keys( $create_response ),
	'create response uses the exact Study allowlist'
);
expect_same( false, array_key_exists( 'user_id', $create_response ), 'create omits Calendar owner' );
expect_same( false, array_key_exists( 'source_id', $create_response ), 'create omits Calendar source identity' );
expect_same( false, array_key_exists( 'meta', $create_response ), 'create omits internal metadata' );

$formatted = MMED_Study_Schedule::format_block( MMED_Calendar_Engine::$events[10] );
expect_same(
	array( 'id', 'title', 'subject', 'notes', 'start_at', 'end_at', 'duration', 'status', 'completed', 'category' ),
	array_keys( $formatted ),
	'GET response uses the exact Study allowlist'
);
expect_same( false, array_key_exists( 'event', $formatted ), 'GET block omits nested Calendar event' );
expect_same( false, array_key_exists( 'user_id', $formatted ), 'GET block omits Calendar owner' );
expect_same( false, array_key_exists( 'mentor_hint', $formatted ), 'GET block omits internal metadata keys' );

echo "legacy Study containment: ok\n";
