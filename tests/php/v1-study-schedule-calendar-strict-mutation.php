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
	#[\ReturnTypeWillChange]
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

final class MMED_V1_Study_Access {
	public static function legacy_writer_decision( $owner_id ): array {
		unset( $owner_id );
		return array( 'allowed' => true, 'status' => 200 );
	}
}

final class V1_Strict_WPDB {
	public string $prefix = 'wp_';
	public array $events = array();
	public array $last_where = array();
	public $before_update = null;
	public $after_update = null;
	public bool $force_zero_without_write = false;
	public bool $force_failure = false;

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
		if ( is_callable( $this->before_update ) ) {
			$before_update       = $this->before_update;
			$this->before_update = null;
			$before_update( $this, $payload, $where );
		}

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

		if ( $this->force_failure ) {
			$this->force_failure = false;
			return false;
		}

		if ( $this->force_zero_without_write ) {
			$this->force_zero_without_write = false;
			return 0;
		}

		$changed = false;
		foreach ( $payload as $key => $value ) {
			if ( (string) ( $row->{$key} ?? '' ) !== (string) $value ) {
				$changed = true;
			}
			$row->{$key} = $value;
		}
		$this->events[ $id ] = $row;
		if ( is_callable( $this->after_update ) ) {
			$after_update       = $this->after_update;
			$this->after_update = null;
			$after_update( $this, $payload, $where );
		}
		return $changed ? 1 : 0;
	}
}

function fixture( int $id, int $owner, string $type, ?string $meta = '{}' ): object {
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

function strict_params( int $id, string $status = 'active', bool $protect_meta = false, $meta = null ): array {
	$params = array(
		'id' => $id,
		'_mmed_strict_owner' => true,
		'_mmed_required_event_type' => 'study_block',
		'_mmed_expected_status' => $status,
	);
	if ( $protect_meta ) {
		$params['_mmed_expect_meta_snapshot'] = true;
		$params['_mmed_expected_meta_json']   = $meta;
	}
	return $params;
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
	15 => fixture( 15, 42, 'study_block', '{"subject":"Cardio"}' ),
	16 => fixture( 16, 42, 'study_block', '{"subject":"Neuro"}' ),
	17 => fixture( 17, 42, 'study_block' ),
	18 => fixture( 18, 42, 'study_block' ),
	19 => fixture( 19, 42, 'study_block' ),
	20 => fixture( 20, 42, 'study_block' ),
	21 => fixture( 21, 42, 'study_block' ),
	22 => fixture( 22, 42, 'study_block' ),
	23 => fixture( 23, 42, 'study_block' ),
	24 => fixture( 24, 42, 'study_block', null ),
	25 => fixture( 25, 42, 'study_block' ),
	26 => fixture( 26, 42, 'study_block' ),
	27 => fixture( 27, 42, 'study_block' ),
);
$GLOBALS['wpdb'] = $wpdb;

$request = new WP_REST_Request(
	array( 'status' => 'completed', 'meta' => array( 'subject' => 'Renal', 'completed' => true ) ),
	strict_params( 10, 'active', true, '{"subject":"Renal"}' )
);
$result = MMED_Calendar_Engine::update_event( $request );
expect_same( 200, $result->status, 'strict owned Study update succeeds' );
expect_same( 42, $wpdb->last_where['user_id'] ?? null, 'owner is in atomic predicate' );
expect_same( 'study_block', $wpdb->last_where['event_type'] ?? null, 'type is in atomic predicate' );
expect_same( 'active', $wpdb->last_where['status'] ?? null, 'status snapshot is in atomic predicate' );
expect_same( '{"subject":"Renal"}', $wpdb->last_where['meta_json'] ?? null, 'metadata snapshot is in atomic predicate' );

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
expect_same( true, is_wp_error( $deleted ), 'stale status snapshot cannot delete a completed Study event' );
expect_same( 409, $deleted->data['status'] ?? null, 'stale delete status returns conflict' );
expect_same( 'completed', $wpdb->events[10]->status, 'stale delete leaves target untouched' );

$deleted = MMED_Calendar_Engine::delete_event( new WP_REST_Request( array(), strict_params( 10, 'completed' ) ) );
expect_same( 200, $deleted->status, 'strict owned Study delete succeeds with current snapshot' );
expect_same( 'cancelled', $wpdb->events[10]->status, 'strict delete soft-cancels only target' );

$wpdb->before_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[15]->status = 'cancelled';
};
$status_race = MMED_Calendar_Engine::update_event(
	new WP_REST_Request(
		array( 'status' => 'completed' ),
		strict_params( 15, 'active' )
	)
);
expect_same( true, is_wp_error( $status_race ), 'concurrent cancellation denies stale update' );
expect_same( 409, $status_race->data['status'] ?? null, 'concurrent cancellation returns conflict' );
expect_same( 'cancelled', $wpdb->events[15]->status, 'cancelled Study event is never resurrected' );

$wpdb->before_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[16]->meta_json = '{"subject":"Neuro","mentor_hint":"new"}';
};
$meta_race = MMED_Calendar_Engine::update_event(
	new WP_REST_Request(
		array( 'meta' => array( 'subject' => 'Neuro', 'completed' => true ) ),
		strict_params( 16, 'active', true, '{"subject":"Neuro"}' )
	)
);
expect_same( true, is_wp_error( $meta_race ), 'concurrent metadata change denies stale replacement' );
expect_same( 409, $meta_race->data['status'] ?? null, 'metadata race returns conflict' );
expect_same(
	'{"subject":"Neuro","mentor_hint":"new"}',
	$wpdb->events[16]->meta_json,
	'concurrent metadata remains intact'
);

$meta_retry = MMED_Calendar_Engine::update_event(
	new WP_REST_Request(
		array( 'meta' => array( 'subject' => 'Neuro', 'mentor_hint' => 'new', 'completed' => true ) ),
		strict_params( 16, 'active', true, '{"subject":"Neuro","mentor_hint":"new"}' )
	)
);
expect_same( 200, $meta_retry->status, 'retry succeeds after reloading the metadata snapshot' );
expect_same(
	array( 'subject' => 'Neuro', 'mentor_hint' => 'new', 'completed' => true ),
	json_decode( $wpdb->events[16]->meta_json, true ),
	'retry preserves concurrent metadata and applies intended change'
);

$wpdb->events[17]->title      = 'Fixture event';
$wpdb->events[17]->updated_at = '2026-07-15 00:01:00';
$no_op = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'title' => 'Fixture event' ), strict_params( 17 ) )
);
expect_same( 200, $no_op->status, 'verified zero-row no-op remains successful' );

$wpdb->before_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[18]->event_type = 'appointment';
};
$type_race = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'status' => 'completed' ), strict_params( 18 ) )
);
expect_same( true, is_wp_error( $type_race ), 'concurrent type change denies stale update' );
expect_same( 404, $type_race->data['status'] ?? null, 'concurrent type change stays non-enumerating' );

$wpdb->before_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[19]->status = 'cancelled';
};
$delete_race = MMED_Calendar_Engine::delete_event(
	new WP_REST_Request( array(), strict_params( 19 ) )
);
expect_same( true, is_wp_error( $delete_race ), 'concurrent delete is not reported as this request success' );
expect_same( 409, $delete_race->data['status'] ?? null, 'concurrent delete returns conflict' );

$wpdb->before_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[20]->user_id = 99;
};
$owner_race = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'status' => 'completed' ), strict_params( 20 ) )
);
expect_same( true, is_wp_error( $owner_race ), 'concurrent owner change denies stale update' );
expect_same( 404, $owner_race->data['status'] ?? null, 'concurrent owner change stays non-enumerating' );

$wpdb->force_zero_without_write = true;
$zero_mismatch = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'title' => 'Unapplied title' ), strict_params( 21 ) )
);
expect_same( true, is_wp_error( $zero_mismatch ), 'unapplied zero-row update is not reported as success' );
expect_same( 409, $zero_mismatch->data['status'] ?? null, 'unapplied zero-row update returns conflict' );

$wpdb->after_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[22]->event_type = 'appointment';
};
$post_write_type_race = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'status' => 'completed' ), strict_params( 22 ) )
);
expect_same( true, is_wp_error( $post_write_type_race ), 'post-write type change is not projected as Study' );
expect_same( 404, $post_write_type_race->data['status'] ?? null, 'post-write type change stays non-enumerating' );

$wpdb->after_update = static function ( V1_Strict_WPDB $db ): void {
	$db->events[23]->status = 'cancelled';
};
$post_write_cancel = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'title' => 'Applied before delete' ), strict_params( 23 ) )
);
expect_same( true, is_wp_error( $post_write_cancel ), 'post-write cancellation is not projected as mutable Study' );
expect_same( 409, $post_write_cancel->data['status'] ?? null, 'post-write cancellation returns conflict' );

$invalid_meta_snapshot = MMED_Calendar_Engine::update_event(
	new WP_REST_Request(
		array( 'meta' => array( 'completed' => true ) ),
		strict_params( 24, 'active', true, array( 'not' => 'a database scalar' ) )
	)
);
expect_same( true, is_wp_error( $invalid_meta_snapshot ), 'invalid metadata snapshot fails closed' );
expect_same( 409, $invalid_meta_snapshot->data['status'] ?? null, 'invalid metadata snapshot returns conflict' );

$owner_only_scope = MMED_Calendar_Engine::update_event(
	new WP_REST_Request(
		array( 'title' => 'Owner-only narrowed update' ),
		array( 'id' => 25, '_mmed_strict_owner' => true )
	)
);
expect_same( 200, $owner_only_scope->status, 'owner-only narrowing does not create a false post-write 404' );

$wpdb->force_failure = true;
$failed_update = MMED_Calendar_Engine::update_event(
	new WP_REST_Request( array( 'title' => 'Must not persist' ), strict_params( 26 ) )
);
expect_same( true, is_wp_error( $failed_update ), 'database update failure returns an error' );
expect_same( 500, $failed_update->data['status'] ?? null, 'database update failure returns 500' );
expect_same( 'Fixture event', $wpdb->events[26]->title, 'failed update leaves original row intact' );

$wpdb->force_failure = true;
$failed_delete = MMED_Calendar_Engine::delete_event(
	new WP_REST_Request( array(), strict_params( 27 ) )
);
expect_same( true, is_wp_error( $failed_delete ), 'database delete failure returns an error' );
expect_same( 500, $failed_delete->data['status'] ?? null, 'database delete failure returns 500' );
expect_same( 'active', $wpdb->events[27]->status, 'failed delete leaves original row active' );

echo "Calendar strict mutation seam: ok\n";
