<?php
/** Disposable physical post-restore relationship census proof for 8010E E3. */

function v1_8010e_e3_restore_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010e_e3_restore_query( $database, $sql, $expected, $message ) {
	$result = $database->query( $sql );
	v1_8010e_e3_restore_expect(
		'' === (string) $database->last_error && (int) $expected === (int) $result,
		$message
	);
	return (int) $result;
}

function v1_8010e_e3_restore_fk_checks( $database, $enabled ) {
	$value = $enabled ? 1 : 0;
	v1_8010e_e3_restore_query( $database, 'SET SESSION foreign_key_checks = ' . $value, 0, 'restore fixture changes FK enforcement exactly' );
	v1_8010e_e3_restore_expect( $value === (int) $database->get_var( 'SELECT @@SESSION.foreign_key_checks' ), 'restore fixture verifies FK enforcement' );
}

function v1_8010e_e3_restore_violations( $database, $descriptors ) {
	$violations = array();
	foreach ( $descriptors as $descriptor ) {
		v1_8010e_e3_restore_expect(
			is_array( $descriptor )
			&& array( 'reason', 'sql', 'arguments' ) === array_keys( $descriptor )
			&& is_string( $descriptor['reason'] )
			&& is_string( $descriptor['sql'] )
			&& is_array( $descriptor['arguments'] ),
			'restore descriptor shape is exact'
		);
		$sql = empty( $descriptor['arguments'] )
			? $descriptor['sql']
			: $database->prepare( $descriptor['sql'], $descriptor['arguments'] );
		v1_8010e_e3_restore_expect( is_string( $sql ) && '' !== $sql, 'restore descriptor prepares exactly' );
		$value = $database->get_var( $sql );
		v1_8010e_e3_restore_expect( '' === (string) $database->last_error, 'restore descriptor query succeeds' );
		if ( null !== $value ) {
			v1_8010e_e3_restore_expect( '1' === (string) $value, 'restore descriptor exposes only constant one' );
			$violations[] = $descriptor['reason'];
		}
	}
	return $violations;
}

function v1_8010e_e3_restore_schema_compatible( $database ) {
	$parent = ( new MMED_V1_Study_Schema_Inspector( $database ) )->inspect();
	$week = ( new MMED_V1_Study_Week_Schema_Inspector( $database ) )->inspect();
	v1_8010e_e3_restore_expect(
		! empty( $parent['ok'] )
		&& MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === ( $parent['state'] ?? null )
		&& ! empty( $week['ok'] )
		&& MMED_V1_Study_Schema_Inspector::STATE_COMPATIBLE === ( $week['state'] ?? null ),
		'schema remains structurally compatible while restored relationships are invalid'
	);
}

function v1_8010e_e3_restore_corrupt( $database, $mutate, $restore, $assertion ) {
	$mutated = false;
	try {
		v1_8010e_e3_restore_fk_checks( $database, false );
		try {
			$result = $mutate();
			$mutated = false !== $result && 0 < (int) $result;
			v1_8010e_e3_restore_expect( 1 === (int) $result, 'restore fixture introduces exactly one corruption' );
		} finally {
			v1_8010e_e3_restore_fk_checks( $database, true );
		}
		$assertion();
	} finally {
		if ( $mutated ) {
			v1_8010e_e3_restore_fk_checks( $database, false );
			try {
				v1_8010e_e3_restore_expect( 1 === (int) $restore(), 'restore fixture restores exactly one relation' );
			} finally {
				v1_8010e_e3_restore_fk_checks( $database, true );
			}
		}
	}
}

function v1_8010e_e3_restore_assert_relation( $database, $owner_id, $reason, $public_reader = true ) {
	v1_8010e_e3_restore_schema_compatible( $database );
	v1_8010e_e3_restore_expect(
		array( $reason ) === v1_8010e_e3_restore_violations( $database, MMED_V1_Study_Restore_Census::global_descriptors( $database ) ),
		'offline global census identifies only ' . $reason
	);
	v1_8010e_e3_restore_expect(
		array( $reason ) === v1_8010e_e3_restore_violations( $database, MMED_V1_Study_Restore_Census::owner_descriptors( $database, $owner_id ) ),
		'owner census identifies only ' . $reason
	);
	if ( $public_reader ) {
		$read = ( new MMED_V1_Study_Week_Current_Reader( $database ) )->load( $owner_id );
		v1_8010e_e3_restore_expect(
			array( 'ok', 'reason_code', 'plan' ) === array_keys( $read )
			&& false === $read['ok']
			&& 'plan_corrupt' === $read['reason_code']
			&& null === $read['plan'],
			'reader collapses private restore relation to content-free plan_corrupt'
		);
	}
}

global $wpdb;
v1_8010e_e3_restore_expect( is_object( $wpdb ), 'restore fixture requires WordPress database' );
v1_8010e_e3_restore_expect(
	class_exists( 'V1_8010E_E2_Synthetic_Fence' )
	&& class_exists( 'V1_8010E_E2_UUID_Source' )
	&& isset( $create, $temporal )
	&& is_array( $create )
	&& is_array( $temporal ),
	'restore fixture requires the accepted E2 synthetic seed in the same disposable process'
);
$v1_e3_original_prefix = $wpdb->prefix;
$wpdb->set_prefix( 'v1e2_' );
$wpdb->suppress_errors( true );
$v1_e3_owner = 8201;
$v1_e3_kernel = MMED_V1_Study_Schema::table_names( $wpdb );
$v1_e3_week = MMED_V1_Study_Week_Schema::table_names( $wpdb );
$v1_e3_global_reasons = array(
	'v1_restore_relation_gate_generation',
	'v1_restore_relation_plan_generation',
	'v1_restore_relation_operation_plan',
	'v1_restore_relation_operation_generation',
	'v1_restore_relation_week_plan',
	'v1_restore_relation_block_week',
	'v1_restore_relation_plan_watermark_operation',
	'v1_restore_relation_plan_current_operation',
	'v1_restore_relation_operation_prior',
	'v1_restore_relation_operation_beyond_plan',
);

try {
	$global_descriptors = MMED_V1_Study_Restore_Census::global_descriptors( $wpdb );
	$owner_descriptors = MMED_V1_Study_Restore_Census::owner_descriptors( $wpdb, $v1_e3_owner );
	v1_8010e_e3_restore_expect( $v1_e3_global_reasons === array_column( $global_descriptors, 'reason' ), 'global restore descriptor order is exact' );
	v1_8010e_e3_restore_expect( array_slice( $v1_e3_global_reasons, 1 ) === array_column( $owner_descriptors, 'reason' ), 'owner restore descriptor order omits only the gate relation' );
	v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, $global_descriptors ), 'accepted E2 store begins with a clean global census' );
	v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, $owner_descriptors ), 'accepted E2 owner begins with a clean owner census' );
	$baseline = ( new MMED_V1_Study_Week_Current_Reader( $wpdb ) )->load( $v1_e3_owner );
	v1_8010e_e3_restore_expect( ! empty( $baseline['ok'] ), 'accepted E2 owner has readable baseline truth' );

	/* Gate -> generation. Only the constant-size control probe is request-path bound. */
	$gate_generation = (int) $wpdb->get_var( "SELECT current_generation FROM `{$v1_e3_kernel['store_gate']}` WHERE gate_key = 1" );
	v1_8010e_e3_restore_expect( 2 === $gate_generation, 'restore fixture captures exact gate generation' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel ) {
			return $wpdb->query( "UPDATE `{$v1_e3_kernel['store_gate']}` SET current_generation = 99 WHERE gate_key = 1" );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $gate_generation ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['store_gate']}` SET current_generation = %d WHERE gate_key = 1", $gate_generation ) );
		},
		static function () use ( $wpdb ) {
			v1_8010e_e3_restore_schema_compatible( $wpdb );
			v1_8010e_e3_restore_expect(
				array( 'v1_restore_relation_gate_generation' ) === v1_8010e_e3_restore_violations( $wpdb, MMED_V1_Study_Restore_Census::global_descriptors( $wpdb ) ),
				'gate corruption is identified exactly'
			);
			v1_8010e_e3_restore_expect( MMED_V1_Study_Domain::BINDING_UNAVAILABLE === ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->binding_kind(), 'gate relation fails provenance closed' );
		}
	);

	/* Plan -> generation. */
	$plan_generation = (int) $wpdb->get_var( $wpdb->prepare( "SELECT store_generation FROM `{$v1_e3_kernel['plans']}` WHERE owner_id = %d", $v1_e3_owner ) );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET store_generation = 99 WHERE owner_id = %d", $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $plan_generation ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET store_generation = %d WHERE owner_id = %d", $plan_generation, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_plan_generation' );
		}
	);

	/* Operation -> Plan, using a standalone revision-1 orphan. */
	$orphan_operation_owner = 8997;
	$orphan_operation_id = 'e3000000000040008000000000000401';
	$orphan_operation_plan = 'e3000000000040008000000000000402';
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $orphan_operation_owner, $orphan_operation_id, $orphan_operation_plan ) {
			$sql  = "INSERT INTO `{$v1_e3_kernel['operations']}` (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at)";
			$sql .= ' SELECT UNHEX(%s), %d, UNHEX(%s), 1, 0, %s, request_json, request_hash, %d, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at';
			$sql .= " FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 1";
			return $wpdb->query( $wpdb->prepare( $sql, $orphan_operation_id, $orphan_operation_owner, $orphan_operation_plan, '8010E-e3-orphan-plan-0001', $orphan_operation_owner, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $orphan_operation_owner, $orphan_operation_id ) {
			return $wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND operation_id = UNHEX(%s)", $orphan_operation_owner, $orphan_operation_id ) );
		},
		static function () use ( $wpdb, $orphan_operation_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $orphan_operation_owner, 'v1_restore_relation_operation_plan' );
		}
	);

	/* Operation -> generation. */
	$operation_generation = (int) $wpdb->get_var( $wpdb->prepare( "SELECT store_generation FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 5", $v1_e3_owner ) );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['operations']}` SET store_generation = 99 WHERE owner_id = %d AND revision = 5", $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $operation_generation ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['operations']}` SET store_generation = %d WHERE owner_id = %d AND revision = 5", $operation_generation, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_operation_generation' );
		}
	);

	/* Empty Week -> Plan, so Block -> Week remains clean. */
	$orphan_week_owner = 8998;
	$orphan_plan_hex = 'e3000000000040008000000000000101';
	$orphan_week_hex = 'e3000000000040008000000000000102';
	$context_hash = hash( 'sha256', 'v1-e3-restore-week' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_week, $orphan_week_owner, $orphan_plan_hex, $orphan_week_hex, $context_hash ) {
			$sql  = "INSERT INTO `{$v1_e3_week['weeks']}` (owner_id, plan_id, week_id, week_start_local, timezone, profile_version, tzdb_version, temporal_policy_version, temporal_context_hash, created_revision, updated_revision, created_at, updated_at)";
			$sql .= ' VALUES (%d, UNHEX(%s), UNHEX(%s), %s, %s, %s, %s, %s, UNHEX(%s), 1, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))';
			return $wpdb->query( $wpdb->prepare( $sql, $orphan_week_owner, $orphan_plan_hex, $orphan_week_hex, '2026-07-13', 'America/New_York', 'restore-census-v1', 'synthetic-2026a', 'wall-v1', $context_hash ) );
		},
		static function () use ( $wpdb, $v1_e3_week, $orphan_week_owner, $orphan_week_hex ) {
			return $wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_week['weeks']}` WHERE owner_id = %d AND week_id = UNHEX(%s)", $orphan_week_owner, $orphan_week_hex ) );
		},
		static function () use ( $wpdb, $orphan_week_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $orphan_week_owner, 'v1_restore_relation_week_plan' );
		}
	);

	/* Block -> Week. The orphan is otherwise a valid copy of accepted truth. */
	$orphan_block_week = 'e3000000000040008000000000000201';
	$orphan_block_id = 'e3000000000040008000000000000202';
	$block_columns = 'owner_id, plan_id, week_id, block_id, title, activity_type, activity_catalog_version, storage_codebook_version, family_code, state_code, priority_code, goal_ref_hash, goal_source_version, source_code, source_namespace_hash, source_ref_hash, source_version_hash, start_at_utc, end_at_utc, timezone, profile_version, tzdb_version, local_date, local_minute, fold_code, temporal_policy_version, temporal_context_hash, duration_minutes, created_revision, updated_revision, tombstoned_revision, created_at, updated_at, tombstoned_at';
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_week, $v1_e3_owner, $orphan_block_week, $orphan_block_id, $block_columns ) {
			$sql  = "INSERT INTO `{$v1_e3_week['blocks']}` ({$block_columns})";
			$sql .= ' SELECT owner_id, plan_id, UNHEX(%s), UNHEX(%s), title, activity_type, activity_catalog_version, storage_codebook_version, family_code, state_code, priority_code, goal_ref_hash, goal_source_version, source_code, source_namespace_hash, source_ref_hash, source_version_hash, start_at_utc, end_at_utc, timezone, profile_version, tzdb_version, local_date, local_minute, fold_code, temporal_policy_version, temporal_context_hash, duration_minutes, created_revision, updated_revision, tombstoned_revision, created_at, updated_at, tombstoned_at';
			$sql .= " FROM `{$v1_e3_week['blocks']}` WHERE owner_id = %d ORDER BY block_id LIMIT 1";
			return $wpdb->query( $wpdb->prepare( $sql, $orphan_block_week, $orphan_block_id, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_week, $v1_e3_owner, $orphan_block_id ) {
			return $wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_week['blocks']}` WHERE owner_id = %d AND block_id = UNHEX(%s)", $v1_e3_owner, $orphan_block_id ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_block_week' );
		}
	);

	/* Plan watermark -> immutable revision-1 operation. Use an existing wrong receipt first. */
	$watermark_hex = strtolower( (string) $wpdb->get_var( $wpdb->prepare( "SELECT HEX(watermark_operation_id) FROM `{$v1_e3_kernel['plans']}` WHERE owner_id = %d", $v1_e3_owner ) ) );
	$revision_two_hex = strtolower( (string) $wpdb->get_var( $wpdb->prepare( "SELECT HEX(operation_id) FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 2", $v1_e3_owner ) ) );
	v1_8010e_e3_restore_expect( 32 === strlen( $watermark_hex ) && 32 === strlen( $revision_two_hex ) && $watermark_hex !== $revision_two_hex, 'restore fixture captures distinct existing watermark and revision-2 operations' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $revision_two_hex ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET watermark_operation_id = UNHEX(%s) WHERE owner_id = %d", $revision_two_hex, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $watermark_hex ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET watermark_operation_id = UNHEX(%s) WHERE owner_id = %d", $watermark_hex, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_plan_watermark_operation' );
		}
	);
	$watermark_at = (string) $wpdb->get_var( $wpdb->prepare( "SELECT watermark_at FROM `{$v1_e3_kernel['plans']}` WHERE owner_id = %d", $v1_e3_owner ) );
	v1_8010e_e3_restore_expect( '' !== $watermark_at, 'restore fixture captures exact watermark timestamp' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET watermark_at = TIMESTAMPADD(MICROSECOND, 1, watermark_at) WHERE owner_id = %d", $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $watermark_at ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET watermark_at = %s WHERE owner_id = %d", $watermark_at, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_plan_watermark_operation' );
		}
	);

	/* Plan current revision -> current operation. */
	$current_revision = (int) $wpdb->get_var( $wpdb->prepare( "SELECT current_revision FROM `{$v1_e3_kernel['plans']}` WHERE owner_id = %d", $v1_e3_owner ) );
	v1_8010e_e3_restore_expect( 5 === $current_revision, 'restore fixture captures exact accepted current revision' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $current_revision ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET current_revision = %d WHERE owner_id = %d", $current_revision + 1, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $current_revision ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET current_revision = %d WHERE owner_id = %d", $current_revision, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_plan_current_operation' );
		}
	);
	$current_updated_at = (string) $wpdb->get_var( $wpdb->prepare( "SELECT updated_at FROM `{$v1_e3_kernel['plans']}` WHERE owner_id = %d", $v1_e3_owner ) );
	v1_8010e_e3_restore_expect( '' !== $current_updated_at, 'restore fixture captures exact current Plan timestamp' );
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET updated_at = TIMESTAMPADD(MICROSECOND, 1, updated_at) WHERE owner_id = %d", $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $current_updated_at ) {
			return $wpdb->query( $wpdb->prepare( "UPDATE `{$v1_e3_kernel['plans']}` SET updated_at = %s WHERE owner_id = %d", $current_updated_at, $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_plan_current_operation' );
		}
	);

	/* Operation revision -> prior operation. Preserve exact receipt bytes. */
	$backup_table = 'v1e3_restore_receipt_backup';
	v1_8010e_e3_restore_query( $wpdb, "DROP TEMPORARY TABLE IF EXISTS `{$backup_table}`", 1, 'restore fixture clears receipt backup' );
	v1_8010e_e3_restore_query( $wpdb, $wpdb->prepare( "CREATE TEMPORARY TABLE `{$backup_table}` AS SELECT * FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 4", $v1_e3_owner ), 1, 'restore fixture preserves one exact prior receipt' );
	try {
		v1_8010e_e3_restore_expect( 1 === (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$backup_table}`" ), 'restore fixture backup cardinality is exact' );
		v1_8010e_e3_restore_corrupt(
			$wpdb,
			static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner ) {
				return $wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 4", $v1_e3_owner ) );
			},
			static function () use ( $wpdb, $v1_e3_kernel, $backup_table ) {
				return $wpdb->query( "INSERT INTO `{$v1_e3_kernel['operations']}` SELECT * FROM `{$backup_table}`" );
			},
			static function () use ( $wpdb, $v1_e3_owner ) {
				v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_operation_prior' );
			}
		);
	} finally {
		v1_8010e_e3_restore_query( $wpdb, "DROP TEMPORARY TABLE IF EXISTS `{$backup_table}`", 1, 'restore fixture drops receipt backup' );
	}

	/* No operation may exist beyond the Plan current revision. */
	$beyond_operation = 'e3000000000040008000000000000601';
	v1_8010e_e3_restore_corrupt(
		$wpdb,
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $beyond_operation ) {
			$sql  = "INSERT INTO `{$v1_e3_kernel['operations']}` (operation_id, owner_id, plan_id, revision, expected_revision, idempotency_key, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, committed_at)";
			$sql .= ' SELECT UNHEX(%s), owner_id, plan_id, 6, 5, %s, request_json, request_hash, actor_id, actor_kind, action, store_generation, schema_version, plan_hash, result_status, result_json, result_hash, TIMESTAMPADD(MICROSECOND, 1, committed_at)';
			$sql .= " FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND revision = 5";
			return $wpdb->query( $wpdb->prepare( $sql, $beyond_operation, '8010E-e3-beyond-plan-0001', $v1_e3_owner ) );
		},
		static function () use ( $wpdb, $v1_e3_kernel, $v1_e3_owner, $beyond_operation ) {
			return $wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_kernel['operations']}` WHERE owner_id = %d AND operation_id = UNHEX(%s)", $v1_e3_owner, $beyond_operation ) );
		},
		static function () use ( $wpdb, $v1_e3_owner ) {
			v1_8010e_e3_restore_assert_relation( $wpdb, $v1_e3_owner, 'v1_restore_relation_operation_beyond_plan' );
		}
	);

	/* Inject an owner orphan after writer control locking to prove the writer call site. */
	$writer_orphan_week = 'e3000000000040008000000000000701';
	$writer_orphan_block = 'e3000000000040008000000000000702';
	$writer_injected = false;
	$writer_failpoint = static function ( $name ) use ( $wpdb, $v1_e3_week, $v1_e3_owner, $writer_orphan_week, $writer_orphan_block, $block_columns, &$writer_injected ) {
		if ( $writer_injected || 'after_control_lock' !== $name ) {
			return;
		}
		v1_8010e_e3_restore_fk_checks( $wpdb, false );
		try {
			$sql  = "INSERT INTO `{$v1_e3_week['blocks']}` ({$block_columns})";
			$sql .= ' SELECT owner_id, plan_id, UNHEX(%s), UNHEX(%s), title, activity_type, activity_catalog_version, storage_codebook_version, family_code, state_code, priority_code, goal_ref_hash, goal_source_version, source_code, source_namespace_hash, source_ref_hash, source_version_hash, start_at_utc, end_at_utc, timezone, profile_version, tzdb_version, local_date, local_minute, fold_code, temporal_policy_version, temporal_context_hash, duration_minutes, created_revision, updated_revision, tombstoned_revision, created_at, updated_at, tombstoned_at';
			$sql .= " FROM `{$v1_e3_week['blocks']}` WHERE owner_id = %d ORDER BY block_id LIMIT 1";
			v1_8010e_e3_restore_expect( 1 === (int) $wpdb->query( $wpdb->prepare( $sql, $writer_orphan_week, $writer_orphan_block, $v1_e3_owner ) ), 'writer failpoint injects one owner orphan' );
			$writer_injected = true;
		} finally {
			v1_8010e_e3_restore_fk_checks( $wpdb, true );
		}
	};
	$writer_service = new MMED_V1_Study_Command_Service(
		new MMED_V1_Study_InnoDB_Command_Repository( $wpdb, new V1_8010E_E2_Synthetic_Fence(), new V1_8010E_E2_UUID_Source( 30900 ), $writer_failpoint )
	);
	try {
		$writer_result = $writer_service->execute( $create, $v1_e3_owner, $v1_e3_owner, 'learner', $temporal );
		v1_8010e_e3_restore_expect(
			$writer_injected
			&& is_array( $writer_result )
			&& array( 'ok', 'reason_code', 'replayed', 'result', 'status' ) === array_keys( $writer_result )
			&& false === $writer_result['ok']
			&& 'dependency_unavailable' === $writer_result['reason_code']
			&& false === $writer_result['replayed']
			&& null === $writer_result['result']
			&& 503 === $writer_result['status'],
			'writer owner census returns only content-free dependency unavailable'
		);
		v1_8010e_e3_restore_expect( 0 === (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM `{$v1_e3_week['blocks']}` WHERE owner_id = %d AND block_id = UNHEX(%s)", $v1_e3_owner, $writer_orphan_block ) ), 'writer rollback removes the injected orphan exactly' );
		v1_8010e_e3_restore_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.autocommit' ), 'writer restore rejection leaves autocommit enabled' );
		v1_8010e_e3_restore_expect( 1 === (int) $wpdb->get_var( 'SELECT @@SESSION.foreign_key_checks' ), 'writer restore rejection leaves foreign-key enforcement enabled' );
		$writer_connection = (int) $wpdb->get_var( 'SELECT CONNECTION_ID()' );
		v1_8010e_e3_restore_expect( false === MMED_V1_Study_Native_Session_Guard::transaction_active( $wpdb, $writer_connection, 'v1_e3_restore_writer_probe_failed' ), 'writer restore rejection leaves no active transaction' );
		v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, MMED_V1_Study_Restore_Census::global_descriptors( $wpdb ) ), 'writer rollback leaves the global census clean' );
		v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, MMED_V1_Study_Restore_Census::owner_descriptors( $wpdb, $v1_e3_owner ) ), 'writer rollback leaves the owner census clean' );
	} finally {
		v1_8010e_e3_restore_fk_checks( $wpdb, false );
		try {
			$wpdb->query( $wpdb->prepare( "DELETE FROM `{$v1_e3_week['blocks']}` WHERE owner_id = %d AND block_id = UNHEX(%s)", $v1_e3_owner, $writer_orphan_block ) );
		} finally {
			v1_8010e_e3_restore_fk_checks( $wpdb, true );
		}
	}

	v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, MMED_V1_Study_Restore_Census::global_descriptors( $wpdb ) ), 'all exact restorations leave the global census clean' );
	v1_8010e_e3_restore_expect( array() === v1_8010e_e3_restore_violations( $wpdb, MMED_V1_Study_Restore_Census::owner_descriptors( $wpdb, $v1_e3_owner ) ), 'all exact restorations leave the owner census clean' );
	v1_8010e_e3_restore_expect( MMED_V1_Study_Domain::BINDING_READY === ( new MMED_V1_Study_InnoDB_Repository( $wpdb ) )->binding_kind(), 'exact restoration returns generation 2 to ready' );
	$restored = ( new MMED_V1_Study_Week_Current_Reader( $wpdb ) )->load( $v1_e3_owner );
	v1_8010e_e3_restore_expect( $baseline === $restored, 'exact restoration preserves byte-equivalent accepted reader truth' );
} finally {
	try {
		v1_8010e_e3_restore_fk_checks( $wpdb, true );
	} finally {
		$wpdb->set_prefix( $v1_e3_original_prefix );
	}
}

echo "V1 Study Schedule 8010E E3 physical restore census: ok\n";
