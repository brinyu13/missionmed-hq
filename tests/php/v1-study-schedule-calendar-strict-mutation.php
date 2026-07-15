<?php
/**
 * Fixture-only proof that strict Calendar mutations are atomic by owner/type.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

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
}

final class WP_REST_Request implements ArrayAccess {
	private array $json;
	private array $params;

	public function __construct( array $json = array(), array $params = array() ) {
		$this->json   = $json;
		$this->params = $params;
	}

	public function get_json_params(): array { return $this->json; }
	public function get_body_params(): array { return array(); }
	public function get_param( string $key ) { return $this->params[ $key ] ?? null; }
	public function has_param( string $key ): bool { return array_key_exists( $key, $this->params ); }
	public function offsetExists( $offset ): bool { return array_key_exists( $offset, $this->params ); }
	public function offsetGet( $offset ) { return $this->params[ $offset ] ?? null; }
	public function offsetSet( $offset, $value ): void { $this->params[ $offset ] = $value; }
	public function offsetUnset( $offset ): void { unset( $this->params[ $offset ] ); }
}

function is_wp_error( $value ): bool { return $value instanceof WP_Error; }
function get_option( string $key ) { return 'mmed_calendar_engine_db_version' === $key ? MMED_Calendar_Engine::DB_VERSION : null; }
function get_current_user_id(): int { return 42; }
$GLOBALS['v1_strict_admin'] = true;
function current_user_can( string $capability ): bool {
	return 'manage_options' === $capability && true === $GLOBALS['v1_strict_admin'];
}
function current_time( string $format ): string { return '2026-07-15 00:01:00'; }
function sanitize_key( $value ): string { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ) ?? ''; }
function sanitize_text_field( $value ): string { return trim( strip_tags( (string) $value ) ); }
function wp_kses_post( $value ): string { return (string) $value; }
function esc_url_raw( $value ): string { return (string) $value; }
function absint( $value ): int { return abs( (int) $value ); }
function wp_json_encode( $value ): string { return json_encode( $value, JSON_THROW_ON_ERROR ); }
function date_i18n( string $format, int $timestamp ): string { return date( $format, $timestamp ); }

final class V1_Strict_WPDB {
	public string $prefix = 'wp_';
	public array $events = array();
	public array $last_where = array();

	public function prepare( string $query, ...$values ): array {
		if ( 1 === count( $values ) && is_array( $values[0] ) ) {
			$values = $values[0];
		}
		return array( $query, $values );
	}

	public function get_row( $prepared ): ?object {
		$values = is_array( $prepared ) ? $prepared[1] : array();
		$id     = (int) ( $values[0] ?? 0 );
		$owner  = isset( $values[1] ) ? (int) $values[1] : null;
		$row    = $this->events[ $id ] ?? null;
		if ( ! $row || ( null !== $owner && (int) $row->user_id !== $owner ) ) {
			return null;
		}
		return clone $row;
	}

	public function update( string $table, array $payload, array $where, array $formats, array $where_formats ) {
		$this->last_where = $where;
		$id               = (int) ( $where['id'] ?? 0 );
		$row              = $this->events[ $id ] ?? null;
		if ( ! $row ) {
			return 0;
		}

		foreach ( $where as $key => $expected ) {
			if ( (string) ( $row->{$key} ?? '' ) !== (string) $expected ) {
				return 0;
			}
		}

		foreach ( $payload as $key => $value ) {
			$row->{$key} = $value;
		}
		$this->events[ $id ] = $row;
		return 1;
	}
}

function fixture( int $id, int $owner, string $type, string $meta = '{}' ): object {
	return (object) array(
		'id' => $id,
		'user_id' => $owner,
		'event_type' => $type,
		'title' => 'Fixture event',
		'description' => '',
		'start_at' => '2026-07-15 09:00:00',
		'end_at' => '2026-07-15 10:00:00',
		'all_day' => 0,
		'location' => '',
		'meeting_url' => '',
		'meeting_platform' => '',
		'recurrence' => '',
		'recurrence_end' => null,
		'parent_event_id' => null,
		'source' => 'manual',
		'source_id' => '',
		'category' => 'study',
		'priority' => 0,
		'status' => 'active',
		'meta_json' => $meta,
		'created_at' => '2026-07-15 00:00:00',
		'updated_at' => '2026-07-15 00:00:00',
	);
}

function strict_params( int $id ): array {
	return array(
		'id' => $id,
		'_mmed_strict_owner' => true,
		'_mmed_required_event_type' => 'study_block',
	);
}

function expect_same( $expected, $actual, string $label ): void {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php';

$wpdb = new V1_Strict_WPDB();
$wpdb->events = array(
	10 => fixture( 10, 42, 'study_block', '{"subject":"Renal"}' ),
	11 => fixture( 11, 42, 'appointment' ),
	12 => fixture( 12, 99, 'study_block' ),
	13 => fixture( 13, 99, 'study_block' ),
	14 => fixture( 14, 42, 'study_block' ),
);
$GLOBALS['wpdb'] = $wpdb;

$row = $wpdb->events[10];
$request = new WP_REST_Request(
	array( 'status' => 'completed', 'meta' => array( 'subject' => 'Renal', 'completed' => true ) ),
	strict_params( 10 )
);
$result = MMED_Calendar_Engine::update_event( $request );
expect_same( 200, $result->status, 'strict owned Study update succeeds' );
expect_same( 42, $wpdb->last_where['user_id'] ?? null, 'owner is in atomic predicate' );
expect_same( 'study_block', $wpdb->last_where['event_type'] ?? null, 'type is in atomic predicate' );

$foreign_type = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'status' => 'completed' ), strict_params( 11 ) )
);
expect_same( true, is_wp_error( $foreign_type ), 'foreign type denied' );
expect_same( 404, $foreign_type->data['status'] ?? null, 'foreign type is non-enumerating' );

$foreign_owner = MMED_Calendar_Engine::delete_event(
	new WP_REST_Request( array(), strict_params( 12 ) )
);
expect_same( true, is_wp_error( $foreign_owner ), 'admin fallback disabled under strict scope' );
expect_same( 404, $foreign_owner->data['status'] ?? null, 'foreign owner is non-enumerating' );

$generic_admin_update = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'status' => 'completed' ), array( 'id' => 12 ) )
);
expect_same( 200, $generic_admin_update->status, 'unscoped admin update behavior is preserved' );
expect_same( 99, $wpdb->last_where['user_id'] ?? null, 'unscoped admin update targets original owner' );

$generic_admin_delete = MMED_Calendar_Engine::delete_event(
	new WP_REST_Request( array(), array( 'id' => 13 ) )
);
expect_same( 200, $generic_admin_delete->status, 'unscoped admin delete behavior is preserved' );
expect_same( 'cancelled', $wpdb->events[13]->status, 'unscoped admin delete still soft-cancels' );

$GLOBALS['v1_strict_admin'] = false;
$generic_learner_update = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'title' => 'Learner-owned update' ), array( 'id' => 10 ) )
);
expect_same( 200, $generic_learner_update->status, 'unscoped learner update behavior is preserved' );
expect_same( 42, $wpdb->last_where['user_id'] ?? null, 'unscoped learner update remains owner-scoped' );

$generic_learner_delete = MMED_Calendar_Engine::delete_event(
	new WP_REST_Request( array(), array( 'id' => 14 ) )
);
expect_same( 200, $generic_learner_delete->status, 'unscoped learner delete behavior is preserved' );
expect_same( 'cancelled', $wpdb->events[14]->status, 'unscoped learner delete still soft-cancels' );

$deleted = MMED_Calendar_Engine::delete_event( new WP_REST_Request( array(), strict_params( 10 ) ) );
expect_same( 200, $deleted->status, 'strict owned Study delete succeeds' );
expect_same( 'cancelled', $wpdb->events[10]->status, 'strict delete soft-cancels only target' );

echo "Calendar strict mutation seam: ok\n";
