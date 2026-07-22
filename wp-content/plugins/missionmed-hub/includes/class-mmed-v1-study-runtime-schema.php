<?php
/**
 * Explicit, additive runtime-support schema for the V1 Study Schedule RC.
 *
 * This source is descriptor-only. It registers no hook and executes no DDL.
 * An operator-controlled release procedure must apply and verify each
 * descriptor before the production runtime constant can be enabled.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Pure names and ordered DDL/rollback descriptors for runtime support. */
final class MMED_V1_Study_Runtime_Schema {

	const VERSION = 'v1-study-rc-runtime-v1';
	const CALENDAR_INDEX = 'idx_v1ss_owner_type_id';

	/** @return array */
	public static function table_names( $database ) {
		$prefix = isset( $database->prefix ) ? (string) $database->prefix : '';
		if ( '' === $prefix || 1 !== preg_match( '/^[A-Za-z0-9_]+$/D', $prefix ) ) {
			throw new RuntimeException( 'V1 runtime database prefix is invalid.' );
		}
		$tables = array(
			'permits'      => $prefix . 'mmed_v1ss_runtime_permits',
			'rate_buckets' => $prefix . 'mmed_v1ss_rate_buckets',
			'calendar'     => $prefix . 'mmed_events',
		);
		foreach ( $tables as $table ) {
			if ( strlen( $table ) > 64 ) {
				throw new RuntimeException( 'V1 runtime table identifier is too long.' );
			}
		}
		return $tables;
	}

	/**
	 * Ordered, additive descriptors. Normal plugin requests never call these.
	 *
	 * @return array
	 */
	public static function migrations( $database ) {
		$tables = self::table_names( $database );
		$constraint_scope = substr( hash( 'sha256', (string) $database->prefix ), 0, 12 );
		$permit_owner = 'mmed_v1ss_' . $constraint_scope . '_permit_owner_ck';
		$permit_epoch = 'mmed_v1ss_' . $constraint_scope . '_permit_epoch_ck';
		$rate_count = 'mmed_v1ss_' . $constraint_scope . '_rate_count_ck';
		$tail = 'ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';
		$descriptors = array(
			array(
				'id'  => 'V1-RC-001-runtime-permits',
				'sql' => "CREATE TABLE `{$tables['permits']}` (
					owner_id bigint unsigned NOT NULL,
					actor_id bigint unsigned NOT NULL,
					release_digest binary(32) NOT NULL,
					store_generation bigint unsigned NOT NULL,
					permit_epoch bigint unsigned NOT NULL,
					revocation_epoch bigint unsigned NOT NULL DEFAULT 0,
					permit_state varbinary(16) NOT NULL,
					entitlement_digest binary(32) NOT NULL,
					expires_at datetime(6) NOT NULL,
					issued_at datetime(6) NOT NULL,
					updated_at datetime(6) NOT NULL,
					PRIMARY KEY (owner_id),
					KEY idx_state_expiry (permit_state, expires_at),
					CONSTRAINT `{$permit_owner}` CHECK (owner_id = actor_id),
					CONSTRAINT `{$permit_epoch}` CHECK (permit_epoch >= revocation_epoch)
				) {$tail}",
			),
			array(
				'id'  => 'V1-RC-002-rate-buckets',
				'sql' => "CREATE TABLE `{$tables['rate_buckets']}` (
					actor_id bigint unsigned NOT NULL,
					route_key varbinary(32) NOT NULL,
					window_start datetime NOT NULL,
					request_count int unsigned NOT NULL,
					updated_at datetime(6) NOT NULL,
					PRIMARY KEY (actor_id, route_key, window_start),
					KEY idx_window (window_start),
					CONSTRAINT `{$rate_count}` CHECK (request_count > 0)
				) {$tail}",
			),
			array(
				'id'  => 'V1-RC-003-calendar-owner-type-index',
				'sql' => "ALTER TABLE `{$tables['calendar']}` ADD INDEX `" . self::CALENDAR_INDEX . '` (`user_id`, `event_type`, `id`)',
			),
		);

		foreach ( $descriptors as $index => $descriptor ) {
			$canonical = self::canonical_sql( $descriptor['sql'] );
			$descriptors[ $index ] = array(
				'version'      => $index + 1,
				'id'           => $descriptor['id'],
				'sql'          => $canonical,
				'checksum_hex' => hash( 'sha256', self::VERSION . "\n" . $descriptor['id'] . "\n" . $canonical ),
			);
		}
		return $descriptors;
	}

	/**
	 * Disposable-environment reversal descriptors in reverse dependency order.
	 * Production rollback preserves additive tables unless separately approved.
	 *
	 * @return array
	 */
	public static function disposable_rollbacks( $database ) {
		$tables = self::table_names( $database );
		return array(
			array(
				'id'  => 'V1-RC-R003-calendar-owner-type-index',
				'sql' => "ALTER TABLE `{$tables['calendar']}` DROP INDEX `" . self::CALENDAR_INDEX . '`',
			),
			array(
				'id'  => 'V1-RC-R002-rate-buckets',
				'sql' => "DROP TABLE `{$tables['rate_buckets']}`",
			),
			array(
				'id'  => 'V1-RC-R001-runtime-permits',
				'sql' => "DROP TABLE `{$tables['permits']}`",
			),
		);
	}

	/** @return string */
	private static function canonical_sql( $sql ) {
		$sql = preg_replace( '/\s+/', ' ', trim( (string) $sql ) );
		if ( ! is_string( $sql ) || '' === $sql ) {
			throw new RuntimeException( 'V1 runtime schema SQL is invalid.' );
		}
		return $sql;
	}
}
