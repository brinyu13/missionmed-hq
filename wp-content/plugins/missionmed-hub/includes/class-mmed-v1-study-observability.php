<?php
/**
 * Request-local, privacy-safe observability seam for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds allowlisted structural events and keeps them only for this PHP request.
 */
final class MMED_V1_Study_Observability {

	/** @var array */
	private static $request_buffer = array();

	/**
	 * Build and retain one bounded in-memory event. No durable sink is attached.
	 *
	 * @param string $event_name Allowlisted event name.
	 * @param array  $context Candidate structural context.
	 * @return array
	 */
	public static function record( $event_name, $context = array() ) {
		$event = self::build_event( $event_name, $context );
		if ( empty( $event ) ) {
			return array();
		}

		self::$request_buffer[] = $event;
		if ( count( self::$request_buffer ) > 20 ) {
			array_shift( self::$request_buffer );
		}

		return $event;
	}

	/**
	 * Reduce arbitrary context to the approved operational allowlist.
	 *
	 * @param string $event_name Event name.
	 * @param array  $context Candidate context.
	 * @return array
	 */
	public static function build_event( $event_name, $context = array() ) {
		if ( ! in_array( $event_name, array( 'authorization_decision', 'bootstrap_decision', 'dependency_failure' ), true ) ) {
			return array();
		}

		$context = is_array( $context ) ? $context : array();
		$event   = array(
			'event_name'      => $event_name,
			'contract_version' => MMED_V1_Study_Domain::CONTRACT_VERSION,
		);

		$strings = array(
			'request_id',
			'release_digest',
			'route_id',
			'action',
			'mode',
			'actor_kind',
			'outcome',
			'reason_code',
			'reader_version',
			'repository_binding',
			'idempotency_outcome',
			'revision_outcome',
		);

		foreach ( $strings as $field ) {
			if ( ! isset( $context[ $field ] ) || ! is_scalar( $context[ $field ] ) ) {
				continue;
			}
			$value = preg_replace( '/[^A-Za-z0-9_.:\/-]/', '', (string) $context[ $field ] );
			if ( '' !== $value ) {
				$event[ $field ] = substr( $value, 0, 128 );
			}
		}

		if ( isset( $context['http_status'] ) ) {
			$event['http_status'] = max( 100, min( 599, (int) $context['http_status'] ) );
		}
		if ( isset( $context['duration_ms'] ) ) {
			$event['duration_ms'] = max( 0, min( 60000, (int) $context['duration_ms'] ) );
		}

		return $event;
	}

	/**
	 * Return request-local events for fixture assertions only.
	 *
	 * @return array
	 */
	public static function request_buffer() {
		return self::$request_buffer;
	}

	/**
	 * Clear request-local events for fixture assertions.
	 *
	 * @return void
	 */
	public static function reset() {
		self::$request_buffer = array();
	}
}
