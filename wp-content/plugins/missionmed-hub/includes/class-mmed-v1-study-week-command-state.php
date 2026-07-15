<?php
/**
 * Pure normalized Week command reducer for the isolated 8010E E2 slice.
 *
 * This file has no WordPress, database, route, option, hook, or runtime side
 * effects. It converts exact locked-storage DTOs into the canonical reader
 * snapshot and applies one already-normalized learner command in memory.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Pure storage-to-snapshot builder and command reducer. */
final class MMED_V1_Study_Week_Command_State {

	const MAX_WEEKS_PER_PLAN = 260;
	const MAX_BLOCKS_PER_PLAN = 4096;

	/**
	 * Rebuild the exact generation-2 Plan snapshot from locked normalized rows.
	 *
	 * @param int    $owner_id Server-derived owner.
	 * @param string $plan_id Stable Plan UUID.
	 * @param string $revision Canonical unsigned decimal revision.
	 * @param array  $week_rows Exact locked Week rows.
	 * @param array  $block_rows Exact locked Block rows.
	 * @return array
	 */
	public static function snapshot( $owner_id, $plan_id, $revision, $week_rows, $block_rows ) {
		if ( ! is_int( $owner_id ) || $owner_id <= 0 || ! is_array( $week_rows ) || ! is_array( $block_rows ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_rows_invalid' );
		}
		$plan_id = MMED_V1_Study_Week_Domain::uuid( $plan_id );
		$revision = MMED_V1_Study_Week_Domain::decimal_revision( $revision );
		if ( '0' === $revision ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_revision_invalid' );
		}
		if ( count( $week_rows ) > self::MAX_WEEKS_PER_PLAN ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_limit_exceeded' );
		}
		if ( count( $block_rows ) > self::MAX_BLOCKS_PER_PLAN ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'block_limit_exceeded' );
		}

		$plan_hex = self::uuid_hex( $plan_id );
		$weeks = array_values( $week_rows );
		usort(
			$weeks,
			static function ( $left, $right ) {
				$start = strcmp( (string) ( $left['week_start_local'] ?? '' ), (string) ( $right['week_start_local'] ?? '' ) );
				return 0 !== $start ? $start : strcmp( (string) ( $left['week_hex'] ?? '' ), (string) ( $right['week_hex'] ?? '' ) );
			}
		);

		$blocks_by_week = array();
		foreach ( $block_rows as $block ) {
			if (
				(string) $owner_id !== (string) ( $block['owner_id'] ?? '' )
				|| $plan_hex !== (string) ( $block['plan_hex'] ?? '' )
				|| ! self::is_uuid_hex( $block['week_hex'] ?? null )
			) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_ownership_invalid' );
			}
			$week_hex = (string) $block['week_hex'];
			if ( ! isset( $blocks_by_week[ $week_hex ] ) ) {
				$blocks_by_week[ $week_hex ] = array();
			}
			$blocks_by_week[ $week_hex ][] = $block;
		}

		$models = array();
		$seen_weeks = array();
		foreach ( $weeks as $week ) {
			if (
				(string) $owner_id !== (string) ( $week['owner_id'] ?? '' )
				|| $plan_hex !== (string) ( $week['plan_hex'] ?? '' )
				|| ! self::is_uuid_hex( $week['week_hex'] ?? null )
			) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_ownership_invalid' );
			}
			$week_hex = (string) $week['week_hex'];
			if ( isset( $seen_weeks[ $week_hex ] ) ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_week' );
			}
			$seen_weeks[ $week_hex ] = true;
			$week_id = self::uuid_from_hex( $week_hex );
			$week_dto = array(
				'owner_id'                 => (string) $owner_id,
				'plan_id'                  => $plan_id,
				'week_id'                  => $week_id,
				'week_start_local'         => (string) ( $week['week_start_local'] ?? '' ),
				'plan_revision'            => $revision,
				'week_created_revision'    => (string) ( $week['created_revision'] ?? '' ),
				'week_updated_revision'    => (string) ( $week['updated_revision'] ?? '' ),
				'timezone'                  => (string) ( $week['timezone'] ?? '' ),
				'profile_version'           => (string) ( $week['profile_version'] ?? '' ),
				'tzdb_version'              => (string) ( $week['tzdb_version'] ?? '' ),
				'temporal_policy_version'   => (string) ( $week['temporal_policy_version'] ?? '' ),
				'temporal_context_hash_hex' => (string) ( $week['temporal_context_hash_hex'] ?? '' ),
			);
			$block_dtos = array();
			foreach ( $blocks_by_week[ $week_hex ] ?? array() as $block ) {
				if (
					(string) ( $block['week_start_local'] ?? '' ) !== $week_dto['week_start_local']
					|| (string) ( $block['timezone'] ?? '' ) !== $week_dto['timezone']
					|| (string) ( $block['profile_version'] ?? '' ) !== $week_dto['profile_version']
					|| (string) ( $block['tzdb_version'] ?? '' ) !== $week_dto['tzdb_version']
					|| (string) ( $block['temporal_policy_version'] ?? '' ) !== $week_dto['temporal_policy_version']
					|| ! is_string( $block['temporal_context_hash_hex'] ?? null )
					|| ! hash_equals( $week_dto['temporal_context_hash_hex'], $block['temporal_context_hash_hex'] )
				) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_ownership_invalid' );
				}
				$block_dtos[] = self::block_dto( $owner_id, $plan_id, $week_id, $block );
			}
			$models[] = MMED_V1_Study_Week_Domain::week_model_from_repository_rows( $owner_id, $week_dto, $block_dtos );
			unset( $blocks_by_week[ $week_hex ] );
		}
		if ( ! empty( $blocks_by_week ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_storage_orphan_block' );
		}

		return array(
			'plan_id'        => $plan_id,
			'revision'       => $revision,
			'schema_version' => MMED_V1_Study_Week_Schema::SCHEMA_VERSION,
			'weeks'          => $models,
		);
	}

	/**
	 * Build the exact replayable response for one accepted Week command.
	 *
	 * Mission is derived from the selected Week and is never stored as separate
	 * truth. The complete response is persisted in the immutable operation
	 * receipt so a later retry cannot mix revisions after subsequent commands.
	 *
	 * @return array
	 */
	public static function command_result( $snapshot, $week_start, $today, $action, $block_id, $operation_id, $plan_hash ) {
		if (
			! is_array( $snapshot )
			|| ! isset( $snapshot['weeks'] )
			|| ! is_array( $snapshot['weeks'] )
			|| ! is_string( $week_start )
			|| ! is_string( $today )
			|| ! is_string( $plan_hash )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $plan_hash )
			|| ! hash_equals( $plan_hash, hash( 'sha256', MMED_V1_Study_Week_Domain::canonical_json( $snapshot ) ) )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
		$week = null;
		foreach ( $snapshot['weeks'] as $candidate ) {
			if ( is_array( $candidate ) && $week_start === (string) ( $candidate['week_start'] ?? '' ) ) {
				if ( null !== $week ) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_week' );
				}
				$week = $candidate;
			}
		}
		if ( null === $week ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_missing' );
		}
		$result = array(
			'action'       => $action,
			'block_id'     => $block_id,
			'mission'      => MMED_V1_Study_Week_Domain::derive_mission( $week, $today ),
			'operation_id' => $operation_id,
			'plan_hash'    => $plan_hash,
			'revision'     => (string) ( $snapshot['revision'] ?? '' ),
			'today'        => $today,
			'week'         => $week,
		);
		return self::assert_command_result( $result );
	}

	/** Validate the exact public command result allowlist and revision binding. @return array */
	public static function assert_command_result( $result ) {
		try {
			return self::assert_command_result_inner( $result );
		} catch ( MMED_V1_Study_Week_Domain_Exception $error ) {
			unset( $error );
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
	}

	/** Validate the result while collapsing every nested DTO error to one reason. */
	private static function assert_command_result_inner( $result ) {
		if ( ! is_array( $result ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
		$keys = array_keys( $result );
		sort( $keys, SORT_STRING );
		if ( array( 'action', 'block_id', 'mission', 'operation_id', 'plan_hash', 'revision', 'today', 'week' ) !== $keys ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
		if (
			! in_array( $result['action'], MMED_V1_Study_Week_Domain::commands(), true )
			|| MMED_V1_Study_Week_Domain::uuid( $result['block_id'] ) !== $result['block_id']
			|| MMED_V1_Study_Week_Domain::uuid( $result['operation_id'] ) !== $result['operation_id']
			|| ! is_string( $result['plan_hash'] )
			|| 1 !== preg_match( '/^[a-f0-9]{64}$/D', $result['plan_hash'] )
			|| MMED_V1_Study_Week_Domain::decimal_revision( $result['revision'] ) !== $result['revision']
			|| ! is_array( $result['week'] )
			|| ! is_array( $result['mission'] )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
		$derived = MMED_V1_Study_Week_Domain::derive_mission( $result['week'], $result['today'] );
		$target_count = 0;
		$target_state = null;
		foreach ( $result['week']['blocks'] ?? array() as $block ) {
			if ( is_array( $block ) && $result['block_id'] === (string) ( $block['block_id'] ?? '' ) ) {
				++$target_count;
				$target_state = $block['state'] ?? null;
			}
		}
		if (
			$result['revision'] !== (string) ( $result['week']['revision'] ?? '' )
			|| $result['revision'] !== (string) ( $result['mission']['revision'] ?? '' )
			|| 1 !== $target_count
			|| ( MMED_V1_Study_Week_Domain::COMMAND_DELETE === $result['action'] && MMED_V1_Study_Week_Domain::STATE_TOMBSTONE !== $target_state )
			|| ( MMED_V1_Study_Week_Domain::COMMAND_DELETE !== $result['action'] && MMED_V1_Study_Week_Domain::STATE_FLEXIBLE !== $target_state )
			|| ! hash_equals(
				MMED_V1_Study_Week_Domain::canonical_json( $derived ),
				MMED_V1_Study_Week_Domain::canonical_json( $result['mission'] )
			)
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_result_invalid' );
		}
		return $result;
	}

	/**
	 * Apply one normalized command to exact locked storage rows.
	 *
	 * @param array  $normalized Canonical command DTO.
	 * @param int    $owner_id Server-derived owner.
	 * @param string $plan_id Stable or newly generated Plan UUID.
	 * @param string $current_revision Current canonical revision.
	 * @param array  $week_rows Locked Week rows.
	 * @param array  $block_rows Locked Block rows.
	 * @param array  $ids Server-issued UUIDs needed by create.
	 * @param string $now Trusted transaction timestamp.
	 * @return array
	 */
	public static function apply( $normalized, $owner_id, $plan_id, $current_revision, $week_rows, $block_rows, $ids, $now ) {
		if ( ! is_array( $normalized ) || ! is_array( $ids ) || ! is_array( $week_rows ) || ! is_array( $block_rows ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'command_state_invalid' );
		}
		$plan_id = MMED_V1_Study_Week_Domain::uuid( $plan_id );
		$current_revision = MMED_V1_Study_Week_Domain::decimal_revision( $current_revision );
		$next_revision = MMED_V1_Study_Week_Domain::increment_revision( $current_revision );
		self::timestamp( $now );
		$command = isset( $normalized['command'] ) ? $normalized['command'] : null;
		$payload = isset( $normalized['payload'] ) && is_array( $normalized['payload'] ) ? $normalized['payload'] : array();
		$temporal = isset( $normalized['temporal'] ) && is_array( $normalized['temporal'] ) ? $normalized['temporal'] : array();
		$week_start = isset( $temporal['week_start'] ) ? (string) $temporal['week_start'] : '';
		$plan_hex = self::uuid_hex( $plan_id );

		$current_snapshot = null;
		if ( '0' !== $current_revision ) {
			$current_snapshot = self::snapshot( $owner_id, $plan_id, $current_revision, $week_rows, $block_rows );
		}

		$week_index = self::week_index( $week_rows, $week_start );
		$week_before = null === $week_index ? null : $week_rows[ $week_index ];
		if ( null !== $week_before ) {
			self::assert_temporal_row( $week_before, $temporal );
		}

		$block_before = null;
		$block_index = null;
		$block_id = null;
		$created_week = false;
		if ( MMED_V1_Study_Week_Domain::COMMAND_CREATE === $command ) {
			if ( count( $block_rows ) >= self::MAX_BLOCKS_PER_PLAN ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'block_limit_exceeded' );
			}
			$block_id = MMED_V1_Study_Week_Domain::uuid( $ids['block_id'] ?? null );
			if ( null === $week_before ) {
				if ( count( $week_rows ) >= self::MAX_WEEKS_PER_PLAN ) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'week_limit_exceeded' );
				}
				$week_id = MMED_V1_Study_Week_Domain::uuid( $ids['week_id'] ?? null );
				$week_before = null;
				$week_after = self::new_week_row( $owner_id, $plan_hex, $week_id, $next_revision, $temporal, $now );
				$week_rows[] = $week_after;
				$week_index = count( $week_rows ) - 1;
				$created_week = true;
			} else {
				$week_after = $week_before;
				$week_after['updated_revision'] = $next_revision;
				$week_after['updated_at'] = $now;
				$week_rows[ $week_index ] = $week_after;
				$week_id = self::uuid_from_hex( $week_after['week_hex'] );
			}
			$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope(
				$payload['local_date'],
				$payload['local_time'],
				$payload['duration_minutes'],
				$payload['fold'],
				$temporal
			);
			self::assert_no_collision( $block_rows, $week_after['week_hex'], $slot['start_at_utc'], $slot['end_at_utc'], null );
			$block_after = self::new_block_row( $owner_id, $plan_hex, $week_id, $block_id, $next_revision, $payload, $slot, $temporal, $now );
			$block_rows[] = $block_after;
		} else {
			if ( null === $week_before || null === $current_snapshot ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'block_not_found' );
			}
			$block_id = isset( $payload['block_id'] ) ? $payload['block_id'] : null;
			$block_index = self::block_index( $block_rows, $week_before['week_hex'], $block_id );
			if ( null === $block_index ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'block_not_found' );
			}
			$block_before = $block_rows[ $block_index ];
			$projection = self::projection_block( $current_snapshot, $week_start, $block_id );
			MMED_V1_Study_Week_Domain::assert_mutation_target( $command, $projection, $payload );
			$block_after = $block_before;
			if ( MMED_V1_Study_Week_Domain::COMMAND_MOVE === $command ) {
				$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope(
					$payload['local_date'],
					$payload['local_time'],
					(int) $block_before['duration_minutes'],
					$payload['fold'],
					$temporal
				);
				self::assert_no_collision( $block_rows, $week_before['week_hex'], $slot['start_at_utc'], $slot['end_at_utc'], $block_id );
				$block_after['start_at_utc'] = $slot['start_at_utc'];
				$block_after['end_at_utc'] = $slot['end_at_utc'];
				$block_after['local_date'] = $payload['local_date'];
				$block_after['local_minute'] = (string) self::minute_of_day( $payload['local_time'] );
				$block_after['fold_code'] = (string) MMED_V1_Study_Week_Domain::enum_code( 'fold', $slot['fold'] );
			} elseif ( MMED_V1_Study_Week_Domain::COMMAND_RESIZE === $command ) {
				$fold = '0' === (string) $block_before['fold_code'] ? null : MMED_V1_Study_Week_Domain::enum_value( 'fold', (int) $block_before['fold_code'] );
				$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope(
					$block_before['local_date'],
					sprintf( '%02d:%02d', intdiv( (int) $block_before['local_minute'], 60 ), (int) $block_before['local_minute'] % 60 ),
					$payload['duration_minutes'],
					$fold,
					$temporal
				);
				self::assert_no_collision( $block_rows, $week_before['week_hex'], $slot['start_at_utc'], $slot['end_at_utc'], $block_id );
				$block_after['end_at_utc'] = $slot['end_at_utc'];
				$block_after['duration_minutes'] = (string) $payload['duration_minutes'];
			} elseif ( MMED_V1_Study_Week_Domain::COMMAND_DELETE === $command ) {
				$block_after['state_code'] = (string) MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE;
				$block_after['tombstoned_revision'] = $next_revision;
				$block_after['tombstoned_at'] = $now;
			} else {
				throw new MMED_V1_Study_Week_Domain_Exception( 'command_unknown' );
			}
			$block_after['updated_revision'] = $next_revision;
			$block_after['updated_at'] = $now;
			$block_rows[ $block_index ] = $block_after;
			$week_after = $week_before;
			$week_after['updated_revision'] = $next_revision;
			$week_after['updated_at'] = $now;
			$week_rows[ $week_index ] = $week_after;
		}

		$snapshot = self::snapshot( $owner_id, $plan_id, $next_revision, $week_rows, $block_rows );
		return array(
			'block_after'  => $block_after,
			'block_before' => $block_before,
			'block_id'     => $block_id,
			'block_rows'   => $block_rows,
			'created_week' => $created_week,
			'next_revision'=> $next_revision,
			'snapshot'     => $snapshot,
			'week_after'   => $week_after,
			'week_before'  => $week_before,
			'week_rows'    => $week_rows,
		);
	}

	/** @return array */
	private static function new_week_row( $owner_id, $plan_hex, $week_id, $revision, $temporal, $now ) {
		return array(
			'owner_id'                  => (string) $owner_id,
			'plan_hex'                  => $plan_hex,
			'week_hex'                  => self::uuid_hex( $week_id ),
			'week_start_local'          => $temporal['week_start'],
			'timezone'                  => $temporal['timezone'],
			'profile_version'           => $temporal['profile_version'],
			'tzdb_version'              => $temporal['tzdb_version'],
			'temporal_policy_version'   => $temporal['temporal_policy_version'],
			'temporal_context_hash_hex' => $temporal['context'],
			'created_revision'           => $revision,
			'updated_revision'           => $revision,
			'created_at'                 => $now,
			'updated_at'                 => $now,
		);
	}

	/** @return array */
	private static function new_block_row( $owner_id, $plan_hex, $week_id, $block_id, $revision, $payload, $slot, $temporal, $now ) {
		return array(
			'owner_id'                  => (string) $owner_id,
			'plan_hex'                  => $plan_hex,
			'week_hex'                  => self::uuid_hex( $week_id ),
			'week_start_local'          => $temporal['week_start'],
			'block_hex'                 => self::uuid_hex( $block_id ),
			'title'                     => $payload['title'],
			'activity_type'             => $payload['activity_type'],
			'activity_catalog_version'  => MMED_V1_Study_Week_Domain::ACTIVITY_CATALOG_VERSION,
			'storage_codebook_version'  => MMED_V1_Study_Week_Domain::STORAGE_CODEBOOK_VERSION,
			'family_code'               => (string) MMED_V1_Study_Week_Domain::enum_code( 'family', $payload['family'] ),
			'state_code'                => (string) MMED_V1_Study_Week_Domain::STATE_CODE_FLEXIBLE,
			'priority_code'             => (string) MMED_V1_Study_Week_Domain::enum_code( 'priority', $payload['priority'] ),
			'goal_ref_hash_hex'         => null,
			'goal_source_version'        => null,
			'source_code'               => (string) MMED_V1_Study_Week_Domain::SOURCE_CODE_MANUAL,
			'source_namespace_hash_hex' => null,
			'source_ref_hash_hex'       => null,
			'source_version_hash_hex'   => null,
			'start_at_utc'              => $slot['start_at_utc'],
			'end_at_utc'                => $slot['end_at_utc'],
			'timezone'                  => $temporal['timezone'],
			'profile_version'           => $temporal['profile_version'],
			'tzdb_version'              => $temporal['tzdb_version'],
			'local_date'                 => $payload['local_date'],
			'local_minute'               => (string) self::minute_of_day( $payload['local_time'] ),
			'fold_code'                  => (string) MMED_V1_Study_Week_Domain::enum_code( 'fold', $slot['fold'] ),
			'temporal_policy_version'    => $temporal['temporal_policy_version'],
			'temporal_context_hash_hex'  => $temporal['context'],
			'duration_minutes'           => (string) $payload['duration_minutes'],
			'created_revision'           => $revision,
			'updated_revision'           => $revision,
			'tombstoned_revision'        => null,
			'created_at'                 => $now,
			'updated_at'                 => $now,
			'tombstoned_at'              => null,
		);
	}

	/** @return array */
	private static function block_dto( $owner_id, $plan_id, $week_id, $row ) {
		return array(
			'owner_id'                  => (string) $owner_id,
			'plan_id'                   => $plan_id,
			'week_id'                   => $week_id,
			'week_start_local'          => (string) ( $row['week_start_local'] ?? '' ),
			'block_id'                  => self::uuid_from_hex( $row['block_hex'] ?? null ),
			'title'                     => (string) ( $row['title'] ?? '' ),
			'activity_type'             => (string) ( $row['activity_type'] ?? '' ),
			'activity_catalog_version'  => (string) ( $row['activity_catalog_version'] ?? '' ),
			'storage_codebook_version'  => (string) ( $row['storage_codebook_version'] ?? '' ),
			'family_code'               => (string) ( $row['family_code'] ?? '' ),
			'state_code'                => (string) ( $row['state_code'] ?? '' ),
			'priority_code'             => (string) ( $row['priority_code'] ?? '' ),
			'goal_ref_hash_hex'         => $row['goal_ref_hash_hex'] ?? null,
			'goal_source_version'        => $row['goal_source_version'] ?? null,
			'source_code'               => (string) ( $row['source_code'] ?? '' ),
			'source_namespace_hash_hex' => $row['source_namespace_hash_hex'] ?? null,
			'source_ref_hash_hex'       => $row['source_ref_hash_hex'] ?? null,
			'source_version_hash_hex'   => $row['source_version_hash_hex'] ?? null,
			'start_at_utc'              => (string) ( $row['start_at_utc'] ?? '' ),
			'end_at_utc'                => (string) ( $row['end_at_utc'] ?? '' ),
			'timezone'                   => (string) ( $row['timezone'] ?? '' ),
			'profile_version'            => (string) ( $row['profile_version'] ?? '' ),
			'tzdb_version'               => (string) ( $row['tzdb_version'] ?? '' ),
			'local_date'                 => (string) ( $row['local_date'] ?? '' ),
			'local_minute'               => (string) ( $row['local_minute'] ?? '' ),
			'fold_code'                  => (string) ( $row['fold_code'] ?? '' ),
			'temporal_policy_version'    => (string) ( $row['temporal_policy_version'] ?? '' ),
			'temporal_context_hash_hex'  => (string) ( $row['temporal_context_hash_hex'] ?? '' ),
			'duration_minutes'           => (string) ( $row['duration_minutes'] ?? '' ),
			'created_revision'           => (string) ( $row['created_revision'] ?? '' ),
			'updated_revision'           => (string) ( $row['updated_revision'] ?? '' ),
			'tombstoned_revision'        => $row['tombstoned_revision'] ?? null,
		);
	}

	/** @return void */
	private static function assert_temporal_row( $row, $temporal ) {
		$stored = MMED_V1_Study_Week_Domain::temporal_envelope(
			(string) ( $row['week_start_local'] ?? '' ),
			(string) ( $row['timezone'] ?? '' ),
			(string) ( $row['profile_version'] ?? '' ),
			(string) ( $row['tzdb_version'] ?? '' )
		);
		if (
			MMED_V1_Study_Week_Domain::canonical_json( $stored ) !== MMED_V1_Study_Week_Domain::canonical_json( $temporal )
			|| (string) ( $row['temporal_policy_version'] ?? '' ) !== MMED_V1_Study_Week_Domain::TEMPORAL_POLICY_VERSION
			|| ! hash_equals( (string) ( $row['temporal_context_hash_hex'] ?? '' ), $stored['context'] )
		) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'temporal_context_stale' );
		}
	}

	/** @return void */
	private static function assert_no_collision( $rows, $week_hex, $start, $end, $exclude_block_id ) {
		$exclude_hex = null === $exclude_block_id ? null : self::uuid_hex( $exclude_block_id );
		foreach ( $rows as $row ) {
			if (
				(string) ( $row['week_hex'] ?? '' ) !== $week_hex
				|| (string) MMED_V1_Study_Week_Domain::STATE_CODE_TOMBSTONE === (string) ( $row['state_code'] ?? '' )
				|| ( null !== $exclude_hex && $exclude_hex === (string) ( $row['block_hex'] ?? '' ) )
			) {
				continue;
			}
			if ( MMED_V1_Study_Week_Domain::intervals_overlap( $start, $end, (string) $row['start_at_utc'], (string) $row['end_at_utc'] ) ) {
				throw new MMED_V1_Study_Week_Domain_Exception( 'block_collision' );
			}
		}
	}

	/** @return array */
	private static function projection_block( $snapshot, $week_start, $block_id ) {
		foreach ( $snapshot['weeks'] as $week ) {
			if ( $week_start !== $week['week_start'] ) {
				continue;
			}
			foreach ( $week['blocks'] as $block ) {
				if ( $block_id === $block['block_id'] ) {
					return $block;
				}
			}
		}
		throw new MMED_V1_Study_Week_Domain_Exception( 'block_not_found' );
	}

	/** @return int|null */
	private static function week_index( $rows, $week_start ) {
		$found = null;
		foreach ( $rows as $index => $row ) {
			if ( $week_start === (string) ( $row['week_start_local'] ?? '' ) ) {
				if ( null !== $found ) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_week' );
				}
				$found = $index;
			}
		}
		return $found;
	}

	/** @return int|null */
	private static function block_index( $rows, $week_hex, $block_id ) {
		$block_hex = self::uuid_hex( $block_id );
		$found = null;
		foreach ( $rows as $index => $row ) {
			if ( $week_hex === (string) ( $row['week_hex'] ?? '' ) && $block_hex === (string) ( $row['block_hex'] ?? '' ) ) {
				if ( null !== $found ) {
					throw new MMED_V1_Study_Week_Domain_Exception( 'week_projection_duplicate_block' );
				}
				$found = $index;
			}
		}
		return $found;
	}

	/** @return int */
	private static function minute_of_day( $time ) {
		$parts = explode( ':', (string) $time );
		return ( (int) $parts[0] * 60 ) + (int) $parts[1];
	}

	/** @return bool */
	private static function is_uuid_hex( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/D', $value );
	}

	/** @return string */
	private static function uuid_hex( $uuid ) {
		return str_replace( '-', '', MMED_V1_Study_Week_Domain::uuid( $uuid ) );
	}

	/** @return string */
	private static function uuid_from_hex( $hex ) {
		if ( ! self::is_uuid_hex( $hex ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'uuid_invalid' );
		}
		$binary = hex2bin( $hex );
		if ( false === $binary ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'uuid_invalid' );
		}
		return MMED_V1_Study_Week_Domain::binary_to_uuid( $binary );
	}

	/** @return string */
	private static function timestamp( $value ) {
		if ( ! is_string( $value ) || 1 !== preg_match( '/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}$/D', $value ) ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'timestamp_invalid' );
		}
		$parsed = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s.u', $value, new DateTimeZone( 'UTC' ) );
		if ( ! $parsed instanceof DateTimeImmutable || $parsed->format( 'Y-m-d H:i:s.u' ) !== $value ) {
			throw new MMED_V1_Study_Week_Domain_Exception( 'timestamp_invalid' );
		}
		return $value;
	}
}
